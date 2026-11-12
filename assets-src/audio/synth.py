"""Core DSP for the audio pipeline (numpy only, no scipy).

Contents
  * band-limited oscillators (wavetables built with irfft, one table per octave band)
  * ADSR envelopes, FFT-based one-pole filters
  * circular (loop-safe) SNES-style echo and a synthetic-IR stereo reverb
  * master helpers (high-pass, soft clip, normalise, fades)

All buffers are float64 and stereo buffers are shaped (2, N).
"""
from __future__ import annotations

import numpy as np

SR = 44100
TWO_PI = 2.0 * np.pi

# Deterministic noise so that every build is bit-identical.
_RNG = np.random.default_rng(1987)


def noise(n: int) -> np.ndarray:
    return _RNG.standard_normal(n)


def reseed(seed: int = 1987) -> None:
    global _RNG
    _RNG = np.random.default_rng(seed)


def hz(midi: float) -> float:
    return 440.0 * 2.0 ** ((float(midi) - 69.0) / 12.0)


def tgrid(n: int) -> np.ndarray:
    return np.arange(n) / SR


# --------------------------------------------------------------------------- oscillators
_TN = 4096
_TABLES: dict[tuple[str, int], np.ndarray] = {}


def _table(kind: str, f_ref: float) -> np.ndarray:
    """Band-limited single-cycle table safe up to frequency f_ref."""
    nh_max = max(1, int(0.46 * SR / max(f_ref, 1.0)))
    nh = 1
    while nh * 2 <= min(nh_max, _TN // 4):
        nh *= 2
    key = (kind, nh)
    if key not in _TABLES:
        n = np.arange(1, nh + 1, dtype=float)
        if kind == "saw":
            amps = (1.0 / n) * (2.0 / np.pi)           # raw sum sin(nx)/n has peak pi/2
        elif kind == "tri":
            sign = 1.0 - 2.0 * (((n - 1) // 2) % 2)
            amps = np.where(n % 2 == 1, sign / n**2, 0.0) * (8.0 / np.pi**2)
        elif kind == "sine":
            amps = np.zeros_like(n)
            amps[0] = 1.0
        else:
            raise ValueError(kind)
        spec = np.zeros(_TN // 2 + 1, complex)
        spec[1:nh + 1] = -0.5j * _TN * amps
        _TABLES[key] = np.fft.irfft(spec, _TN)
    return _TABLES[key]


def _lookup(tab: np.ndarray, phase: np.ndarray) -> np.ndarray:
    x = (phase % 1.0) * _TN
    i = x.astype(np.int64)
    fr = x - i
    return tab[i % _TN] * (1.0 - fr) + tab[(i + 1) % _TN] * fr


def saw(phase, f_ref):
    return _lookup(_table("saw", f_ref), phase)


def tri(phase, f_ref):
    return _lookup(_table("tri", f_ref), phase)


def pulse(phase, f_ref, duty=0.5):
    """Band-limited pulse = difference of two phase-shifted saws (duty 0.125/0.25/0.5)."""
    tab = _table("saw", f_ref)
    return 0.7 * (_lookup(tab, phase) - _lookup(tab, phase - duty))


def sine(phase):
    return np.sin(TWO_PI * phase)


# --------------------------------------------------------------------------- envelopes
def adsr(n: int, dur: float, a: float, d: float, s: float, r: float) -> np.ndarray:
    """Attack (linear) / decay (exp, settles in ~d s) / sustain / release (exp, -40 dB in r s)."""
    t = tgrid(n)
    a = max(a, 1e-4)
    dtau = max(d / 3.0, 1e-4)
    env = np.minimum(t / a, 1.0) * (s + (1.0 - s) * np.exp(-np.maximum(t - a, 0.0) / dtau))
    lvl = min(dur / a, 1.0) * (s + (1.0 - s) * np.exp(-max(dur - a, 0.0) / dtau))
    rt = np.maximum(t - dur, 0.0)
    env = np.where(t < dur, env, lvl * np.exp(-rt / max(r / 4.6, 1e-4)))
    k = min(int(0.003 * SR), n)
    if k > 0:
        env[-k:] *= np.linspace(1.0, 0.0, k)
    return env


def vibrato(t, rate, depth, delay=0.0, ramp=0.3):
    amt = np.clip((t - delay) / max(ramp, 1e-3), 0.0, 1.0)
    return 1.0 + depth * amt * np.sin(TWO_PI * rate * t)


# --------------------------------------------------------------------------- filters
def _fftconv(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    n = x.shape[-1] + len(h) - 1
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft, axis=-1) * np.fft.rfft(h, nfft), nfft, axis=-1)
    return y[..., : x.shape[-1]]


def lowpass(x: np.ndarray, fc: float, order: int = 1) -> np.ndarray:
    """One-pole low-pass (6 dB/oct per order) implemented by truncated-IR FFT convolution."""
    if fc >= 0.45 * SR:
        return x
    a = np.exp(-TWO_PI * fc / SR)
    length = int(min(x.shape[-1], np.ceil(np.log(1e-4) / np.log(a))))
    h = (1.0 - a) * a ** np.arange(max(length, 2))
    for _ in range(order):
        x = _fftconv(x, h)
    return x


def highpass(x: np.ndarray, fc: float, order: int = 1) -> np.ndarray:
    for _ in range(order):
        x = x - lowpass(x, fc)
    return x


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return lowpass(highpass(x, lo), hi)


# --------------------------------------------------------------------------- effects (stereo, circular)
def echo(x: np.ndarray, delays=(0.19, 0.23), fb=0.45, wet=0.35, damp=3200.0, hp=220.0) -> np.ndarray:
    """SPC700-flavoured feedback echo, solved exactly in the frequency domain.

    Because the FFT length equals the buffer length, the echo is *circular*: tails that run
    past the end wrap to the start, which is what makes music loops seamless.  Feedback is
    low-passed (damp) and high-passed (hp) so repeats get darker and do not build up mud.
    """
    n = x.shape[1]
    spec = np.fft.rfft(x, axis=1)
    k = np.arange(spec.shape[1])
    zi = np.exp(-2j * np.pi * k / n)                         # one-sample delay
    a = np.exp(-TWO_PI * damp / SR)
    g_lp = (1.0 - a) / (1.0 - a * zi)
    b = np.exp(-TWO_PI * hp / SR)
    g_hp = b * (1.0 - zi) / (1.0 - b * zi)
    out = np.empty_like(spec)
    for ch in range(2):
        d = int(round(delays[ch] * SR))
        loop = g_lp * g_hp * zi**d
        out[ch] = spec[ch] * (1.0 + wet * loop / (1.0 - fb * loop))
    return np.fft.irfft(out, n, axis=1)


def _make_ir(length_s: float, rt60: float, seed: int, pre: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(length_s * SR)
    t = np.arange(n) / SR
    raw = rng.standard_normal(n)
    bright = lowpass(raw * np.exp(-6.9 * t / (rt60 * 0.55)), 6500)
    dark = lowpass(raw * np.exp(-6.9 * t / rt60), 2200)
    ir = (bright * 0.8 + dark) * (1.0 - np.exp(-t / 0.015))
    ir = np.concatenate([np.zeros(int(pre * SR)), ir])
    return ir / np.sqrt(np.sum(ir**2))


def reverb(x: np.ndarray, wet=0.2, rt60=1.4, pre=0.018) -> np.ndarray:
    """Circular stereo reverb: mono send convolved with two decorrelated synthetic IRs."""
    n = x.shape[1]
    length = min(rt60 * 1.6, n / SR * 0.9)
    mono = x.mean(axis=0)
    spec = np.fft.rfft(mono)
    out = np.empty_like(x)
    for ch, seed in enumerate((11, 29)):
        ir = _make_ir(length, rt60, seed, pre)[:n]
        out[ch] = np.fft.irfft(spec * np.fft.rfft(ir, n), n)
    return x + wet * out


# --------------------------------------------------------------------------- master helpers
def dc_highpass(x: np.ndarray, fc: float = 28.0) -> np.ndarray:
    """Circular one-pole high-pass in the frequency domain (no start-up transient)."""
    n = x.shape[1]
    k = np.arange(n // 2 + 1)
    f = k * SR / n
    h = (1j * f / fc) / (1.0 + 1j * f / fc)
    return np.fft.irfft(np.fft.rfft(x, axis=1) * h, n, axis=1)


def tilt_eq(x: np.ndarray, low_cut_db: float = 4.0, high_boost_db: float = 3.0) -> np.ndarray:
    """Gentle frequency-domain shelves: cut below ~130 Hz, lift above ~3 kHz (keeps mixes from being muddy)."""
    n = x.shape[1]
    f = np.fft.rfftfreq(n, 1.0 / SR)
    gdb = -low_cut_db / (1.0 + (f / 130.0) ** 2) + high_boost_db * (f / 3000.0) ** 2 / (1.0 + (f / 3000.0) ** 2)
    return np.fft.irfft(np.fft.rfft(x, axis=1) * 10.0 ** (gdb / 20.0), n, axis=1)


def db(v: float) -> float:
    return 20.0 * np.log10(max(v, 1e-12))


def undb(d: float) -> float:
    return 10.0 ** (d / 20.0)


def soft_clip(x: np.ndarray, drive: float = 1.25) -> np.ndarray:
    peak = np.max(np.abs(x))
    x = x / max(peak, 1e-9)
    return np.tanh(drive * x) / np.tanh(drive)


def normalize(x: np.ndarray, peak_db: float) -> np.ndarray:
    return x * (undb(peak_db) / max(np.max(np.abs(x)), 1e-9))


def fade_out(x: np.ndarray, seconds: float, curve: float = 1.6) -> np.ndarray:
    k = min(int(seconds * SR), x.shape[1])
    if k <= 0:
        return x
    ramp = np.linspace(1.0, 0.0, k) ** curve
    x = x.copy()
    x[:, -k:] *= ramp
    return x


def fade_in(x: np.ndarray, seconds: float) -> np.ndarray:
    k = min(int(seconds * SR), x.shape[1])
    x = x.copy()
    if k > 0:
        x[:, :k] *= np.linspace(0.0, 1.0, k)
    return x


def pan_gains(pan: float) -> tuple[float, float]:
    """Constant-power pan, pan in [-1, 1]."""
    th = (np.clip(pan, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return float(np.cos(th)), float(np.sin(th))


class Bus:
    """Stereo accumulation buffer; with wrap=True overruns wrap to the start (loops)."""

    def __init__(self, n: int, wrap: bool):
        self.n = n
        self.wrap = wrap
        self.buf = np.zeros((2, n))

    def add(self, start: int, sig: np.ndarray, pan: float, gain: float) -> None:
        if sig.ndim == 1:
            gl, gr = pan_gains(pan)
            sig = np.stack([sig * gl, sig * gr])
        else:
            gl, gr = pan_gains(pan)
            sig = np.stack([sig[0] * min(1.0, gl * 1.414), sig[1] * min(1.0, gr * 1.414)])
        sig = sig * gain
        start = int(start)
        if self.wrap:
            start %= self.n
            m = sig.shape[1]
            if m > self.n:
                m = self.n
                sig = sig[:, :m]
            first = min(m, self.n - start)
            self.buf[:, start:start + first] += sig[:, :first]
            if first < m:
                self.buf[:, : m - first] += sig[:, first:]
        else:
            if start < 0:                      # jitter before t=0: drop the first samples
                sig = sig[:, -start:]
                start = 0
            if start >= self.n or sig.shape[1] == 0:
                return
            m = min(sig.shape[1], self.n - start)
            self.buf[:, start:start + m] += sig[:, :m]

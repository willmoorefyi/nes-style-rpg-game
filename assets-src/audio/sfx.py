"""Sound effects.  Each function returns a float stereo array (2, n) before mastering;
`render_sfx(name)` masters it (fx tail, trim, fade, peak -1 dBFS)."""
from __future__ import annotations

import numpy as np

from . import instruments as I
from . import synth as S
from .synth import SR, TWO_PI, bandpass, highpass, lowpass, noise, tgrid

PAD_S = 2.5          # zero padding so that circular fx tails never wrap into the start


def _mono_buf(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * SR))


def _put(buf: np.ndarray, t0: float, sig: np.ndarray, gain: float = 1.0) -> None:
    i = int(t0 * SR)
    m = min(len(sig), len(buf) - i)
    buf[i:i + m] += sig[:m] * gain


def _stereo(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    gl, gr = S.pan_gains(pan)
    return np.stack([mono * gl * 1.414, mono * gr * 1.414])


# --------------------------------------------------------------------------- the effects
def cursor_move():
    b = _mono_buf(0.12)
    _put(b, 0, I.pulse_lead(1046.5, 0.03, duty=0.5, a=0.002, d=0.04, s=0.1, r=0.05, vib=0.0, cutoff=3500.0))
    return _stereo(b), None, 0.10, 1.6


def cursor_select():
    b = _mono_buf(0.35)
    _put(b, 0.0, I.pulse_lead(1318.5, 0.05, duty=0.25, a=0.002, d=0.05, s=0.5, r=0.04, vib=0.0, cutoff=5000.0))
    _put(b, 0.065, I.pulse_lead(1760.0, 0.12, duty=0.25, a=0.002, d=0.1, s=0.5, r=0.12, vib=0.0, cutoff=6000.0))
    _put(b, 0.065, I.bell(3520.0, 0.1, ratio=3.5, index=1.0, decay=0.14), 0.3)
    return _stereo(b), dict(echo=dict(delays=(0.07, 0.09), fb=0.3, wet=0.25, damp=5000.0), reverb=dict(wet=0.1, rt60=0.6)), 0.42, 1.6


def cursor_cancel():
    b = _mono_buf(0.25)
    _put(b, 0.0, I.pulse_lead(880.0, 0.05, duty=0.5, a=0.002, d=0.05, s=0.5, r=0.04, vib=0.0, cutoff=2400.0))
    _put(b, 0.065, I.pulse_lead(587.3, 0.1, duty=0.5, a=0.002, d=0.1, s=0.4, r=0.1, vib=0.0, cutoff=1900.0, glide=-1.0))
    return _stereo(b), dict(reverb=dict(wet=0.08, rt60=0.5)), 0.30, 1.6


def battle_hit():
    n = int(0.5 * SR)
    t = tgrid(n)
    thump = np.sin(np.cumsum(45.0 + 150.0 * np.exp(-t / 0.035)) / SR * TWO_PI) * np.exp(-t / 0.1)
    body = bandpass(noise(n), 180.0, 3800.0) * np.exp(-t / 0.055)
    crack = highpass(noise(n), 2500.0) * np.exp(-t / 0.011)
    sig = 0.7 * thump + 0.75 * body + 0.9 * crack
    sig *= 1.0 - np.exp(-t / 0.0008)
    return _stereo(sig), dict(reverb=dict(wet=0.1, rt60=0.5)), 0.42, 2.2


def battle_miss():
    T = 0.42
    n = int(T * SR)
    t = tgrid(n)
    x = noise(n)
    centers = np.geomspace(450.0, 4200.0, 9)
    pos = np.log(450.0) + (np.log(4200.0) - np.log(450.0)) * np.clip(t / T, 0, 1) ** 0.8
    out = np.zeros(n)
    for c in centers:
        w = np.exp(-((np.log(c) - pos) ** 2) / (2 * 0.32**2))
        out += bandpass(x, c / 1.35, c * 1.35) * w
    env = np.sin(np.pi * np.clip(t / T, 0, 1)) ** 1.6
    sig = out * env
    return _stereo(sig * 2.0), dict(reverb=dict(wet=0.12, rt60=0.5)), 0.50, 1.6


def battle_victory():
    b = _mono_buf(2.0)
    notes = [(0.0, 523.25), (0.1, 659.25), (0.2, 783.99), (0.3, 1046.5)]
    for t0, f in notes:
        _put(b, t0, I.pulse_lead(f, 0.08, duty=0.25, a=0.003, d=0.08, s=0.6, r=0.06, vib=0.0, cutoff=6500.0))
        _put(b, t0, I.celesta(f * 2, 0.1), 0.35)
    for f in (1046.5, 1318.5, 1568.0):                      # C major chord, last hit
        _put(b, 0.42, I.pulse_lead(f, 0.35, duty=0.25, a=0.004, d=0.2, s=0.55, r=0.4, vib=0.004, cutoff=6000.0), 0.45)
        _put(b, 0.42, I.chime(f * 2, 0.5), 0.2)
    _put(b, 0.42, I.chime(2093.0, 0.5), 0.3)
    return _stereo(b), dict(echo=dict(delays=(0.11, 0.14), fb=0.35, wet=0.3, damp=4500.0), reverb=dict(wet=0.2, rt60=1.0)), 1.9, 1.4


def spell_cast():
    T = 1.0
    n = int(T * SR)
    t = tgrid(n)
    prog = np.clip(t / 0.6, 0.0, 1.0)
    f = 330.0 * 7.0 ** (prog**1.25)                          # rising sweep ~330 Hz -> 2.3 kHz
    ph = np.cumsum(f) / SR
    mod = np.sin(TWO_PI * ph * 2.01)
    idx = 1.0 + 2.2 * prog
    car = np.sin(TWO_PI * ph + idx * mod) + 0.4 * np.sin(TWO_PI * ph * 2.0 + 0.5 * idx * mod)
    env = np.minimum(t / 0.12, 1.0) * np.where(t < 0.6, 1.0, np.exp(-(t - 0.6) / 0.1))
    sig = car * env * 0.55
    sig += highpass(noise(n), 5000.0) * env * 0.05 * prog      # airy shimmer
    rng = np.random.default_rng(5)
    pent = np.array([0, 2, 4, 7, 9])
    for _ in range(16):                                        # sparkles
        t0 = rng.uniform(0.05, 0.75)
        semis = pent[rng.integers(0, 5)] + 12 * rng.integers(0, 2)
        fr = 2093.0 * 2.0 ** (semis / 12.0)
        _put(sig, t0, I.bell(fr, 0.1, ratio=3.5, index=0.8, decay=0.16), 0.16 + 0.1 * t0)
    return _stereo(sig), dict(echo=dict(delays=(0.15, 0.2), fb=0.45, wet=0.38, damp=4000.0),
                              reverb=dict(wet=0.22, rt60=1.2)), 1.2, 1.4


SFX = dict(**{
    "cursor-move": cursor_move, "cursor-select": cursor_select, "cursor-cancel": cursor_cancel,
    "battle-hit": battle_hit, "battle-miss": battle_miss, "battle-victory": battle_victory,
    "spell-cast": spell_cast,
})


def render_sfx(name: str) -> np.ndarray:
    S.reseed(2024)
    x, fx, max_len, drive = SFX[name]()
    x = np.concatenate([x, np.zeros((2, int(PAD_S * SR)))], axis=1)
    if fx:
        if "echo" in fx:
            x = S.echo(x, **fx["echo"])
        if "reverb" in fx:
            x = S.reverb(x, **fx["reverb"])
    x = S.dc_highpass(x, 20.0)
    # trim trailing near-silence (below -50 dB of peak), then cap length with a short fade
    env = np.max(np.abs(x), axis=0)
    last = int(np.nonzero(env > env.max() * S.undb(-50.0))[0][-1])
    x = x[:, : min(x.shape[1], last + int(0.01 * SR), int(max_len * SR))]
    x = S.fade_in(x, 0.0008)
    x = S.fade_out(x, min(0.12, x.shape[1] / SR * 0.35), curve=1.3)
    x = S.soft_clip(x, drive)
    return S.normalize(x, -1.0)

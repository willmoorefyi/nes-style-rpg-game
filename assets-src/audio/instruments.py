"""Instrument voices.  Every melodic voice is  fn(freq, dur, **kw) -> ndarray  (mono (n,) or
stereo (2, n)) whose length is the gate time plus its own release/ring.  Velocity is applied
by the caller (so renders can be cached).  Drum voices are  fn() -> ndarray  at unit level.
"""
from __future__ import annotations

import numpy as np

from . import synth as S
from .synth import SR, TWO_PI, adsr, bandpass, highpass, lowpass, noise, tgrid


# --------------------------------------------------------------------------- melodic voices
def pulse_lead(freq, dur, duty=0.25, a=0.006, d=0.15, s=0.7, r=0.12, vib=0.004, vib_rate=5.6,
               vib_delay=0.22, cutoff=7000.0, glide=0.0):
    """Classic pulse-wave lead (duty 0.125 / 0.25 / 0.5) with delayed vibrato."""
    n = int((dur + r) * SR)
    t = tgrid(n)
    f = freq * S.vibrato(t, vib_rate, vib, vib_delay)
    if glide:
        f = f * 2.0 ** (-glide / 12.0 * np.exp(-t / 0.05))
    ph = np.cumsum(f) / SR
    sig = S.pulse(ph, freq * 1.1, duty) * 1.4
    sig = lowpass(sig, cutoff)
    return sig * adsr(n, dur, a, d, s, r)


def flute(freq, dur, a=0.07, r=0.16, vib=0.005, breath=0.16):
    n = int((dur + r) * SR)
    t = tgrid(n)
    f = freq * S.vibrato(t, 5.2, vib, 0.18, 0.4)
    ph = np.cumsum(f) / SR
    tone = np.sin(TWO_PI * ph) + 0.26 * np.sin(2 * TWO_PI * ph) + 0.07 * np.sin(3 * TWO_PI * ph)
    env = adsr(n, dur, a, 0.1, 0.85, r)
    air = bandpass(noise(n), 1400.0, 6500.0) * breath
    chiff = np.exp(-t / 0.045)
    return tone * env + air * (0.35 * env + 0.9 * chiff) * 0.6


def bell(freq, dur, ratio=3.5, index=2.4, decay=1.3, ring=None):
    """FM bell / celesta.  Rings for its own length (gate time ignored)."""
    ring = ring or min(3.2, decay * 3.4)
    n = int(ring * SR)
    t = tgrid(n)
    mod = np.sin(TWO_PI * freq * ratio * t)
    idx = index * np.exp(-t / (decay * 0.35))
    car = np.sin(TWO_PI * freq * t + idx * mod)
    car += 0.18 * np.sin(TWO_PI * freq * 2.0 * t + 0.4 * idx * mod)
    env = np.exp(-t / decay) * (1.0 - np.exp(-t / 0.0025))
    out = car * env
    k = int(0.01 * SR)
    out[-k:] *= np.linspace(1.0, 0.0, k)
    return out


def pluck(freq, dur, tau=0.6, nh=12, tilt=1.0, hi_decay=0.25, cutoff=None, bright_attack=True):
    """Additive plucked string (harp / guitar / pizzicato): upper partials die faster."""
    ring = min(4.0, tau * 4.6 + 0.12)
    n = int(ring * SR)
    t = tgrid(n)
    sig = np.zeros(n)
    for k in range(1, nh + 1):
        fk = freq * k * np.sqrt(1.0 + 1.5e-4 * k * k)
        if fk > 0.45 * SR:
            break
        tk = tau / (1.0 + (k - 1) * hi_decay)
        sig += (1.0 / k**tilt) * np.sin(TWO_PI * fk * t + 0.37 * k) * np.exp(-t / tk)
    sig *= (1.0 - np.exp(-t / 0.0012))
    if cutoff:
        sig = lowpass(sig, cutoff)
    kk = int(0.008 * SR)
    sig[-kk:] *= np.linspace(1.0, 0.0, kk)
    return sig * 1.3


def harp(freq, dur):
    return pluck(freq, dur, tau=0.9, nh=14, tilt=1.1, hi_decay=0.35)


def guitar(freq, dur):
    return pluck(freq, dur, tau=0.42, nh=10, tilt=0.9, hi_decay=0.5, cutoff=3800.0)


def pizz(freq, dur):
    return pluck(freq, dur, tau=0.11, nh=8, tilt=1.2, hi_decay=0.6, cutoff=4500.0)


def celesta(freq, dur):
    return bell(freq, dur, ratio=4.0, index=1.3, decay=0.9)


def chime(freq, dur):
    return bell(freq, dur, ratio=3.5, index=2.6, decay=1.8)


def deep_bell(freq, dur):
    return bell(freq, dur, ratio=1.41, index=3.2, decay=2.4, ring=4.0)


def bass(freq, dur, a=0.006, d=0.12, s=0.78, r=0.09, saw_mix=0.3, cutoff=950.0, slide=0.7):
    """Fretless-ish bass: triangle + sine sub + a little low-passed saw, tiny pitch scoop."""
    n = int((dur + r) * SR)
    t = tgrid(n)
    f = freq * 2.0 ** (-slide / 12.0 * np.exp(-t / 0.03))
    ph = np.cumsum(f) / SR
    sig = 0.8 * S.tri(ph, freq * 1.1) + 0.5 * np.sin(TWO_PI * ph)
    sig += saw_mix * lowpass(S.saw(ph, freq * 1.1), cutoff, 2)
    return sig * adsr(n, dur, a, d, s, r)


def strings(freq, dur, a=0.35, r=0.7, cutoff=2400.0, detune=9.0, vib=0.003, trem_rate=0.0,
            trem_depth=0.0, sustain=1.0):
    """Warm string pad: three detuned saws spread across the stereo field, low-passed."""
    n = int((dur + r) * SR)
    t = tgrid(n)
    left = np.zeros(n)
    right = np.zeros(n)
    weights = ((0.9, 0.25), (0.6, 0.6), (0.25, 0.9))
    for k, cents in enumerate((-detune, 0.0, detune)):
        f = freq * 2.0 ** (cents / 1200.0) * S.vibrato(t + 0.37 * k, 4.6 + 0.35 * k, vib, 0.3, 0.8)
        ph = np.cumsum(f) / SR + 0.31 * k
        w = S.saw(ph, freq * 1.1)
        left += weights[k][0] * w
        right += weights[k][1] * w
    sig = np.stack([left, right]) * 0.5
    sig = lowpass(sig, cutoff, 2)
    env = adsr(n, dur, a, 0.5, sustain, r)
    if trem_rate:
        env = env * (1.0 - trem_depth + trem_depth * (0.5 + 0.5 * np.sin(TWO_PI * trem_rate * t)))
    return sig * env


def brass(freq, dur, a=0.045, r=0.14, vib=0.0035, bright=4800.0, dark=1100.0):
    """Brass: two detuned saws, filter opens during the attack (crossfade dark -> bright)."""
    n = int((dur + r) * SR)
    t = tgrid(n)
    f = freq * S.vibrato(t, 5.4, vib, 0.25, 0.4)
    ph = np.cumsum(f) / SR
    w = S.saw(ph, freq * 1.1) + 0.8 * S.saw(ph * 1.0035 + 0.2, freq * 1.1)
    xb = lowpass(w, bright)
    xd = lowpass(w, dark, 2)
    mix = np.clip(t / 0.11, 0.0, 1.0) ** 0.7
    sig = xd * (1 - mix) + xb * mix
    return sig * 0.55 * adsr(n, dur, a, 0.12, 0.82, r)


def wind(freq, dur, a=1.2, r=1.6):
    """Slow filtered-noise swell; freq sets the centre of the (two-pole) low-pass."""
    n = int((dur + r) * SR)
    sig = lowpass(noise(n), freq, 2)
    sig = highpass(sig, 80.0)
    sig = sig / (np.max(np.abs(sig)) + 1e-9)
    return sig * adsr(n, dur, a, 0.5, 1.0, r)


# --------------------------------------------------------------------------- drums
def kick():
    n = int(0.42 * SR)
    t = tgrid(n)
    f = 46.0 + 120.0 * np.exp(-t / 0.028)
    sig = np.sin(np.cumsum(f) / SR * TWO_PI) * np.exp(-t / 0.13)
    sig += 0.5 * lowpass(noise(n), 2500.0) * np.exp(-t / 0.004)
    return sig * 1.1


def snare():
    n = int(0.34 * SR)
    t = tgrid(n)
    nz = highpass(noise(n), 1300.0) * np.exp(-t / 0.085)
    f = 200.0 + 60.0 * np.exp(-t / 0.02)
    tone = np.sin(np.cumsum(f) / SR * TWO_PI) * np.exp(-t / 0.055)
    return 0.75 * nz + 0.55 * tone


def hat_closed():
    n = int(0.09 * SR)
    t = tgrid(n)
    return highpass(noise(n), 7000.0, 2) * np.exp(-t / 0.018) * 0.55


def hat_open():
    n = int(0.45 * SR)
    t = tgrid(n)
    return highpass(noise(n), 6500.0, 2) * np.exp(-t / 0.13) * 0.45


def _tom(f0):
    def fn():
        n = int(0.5 * SR)
        t = tgrid(n)
        f = f0 * (1.0 + 0.7 * np.exp(-t / 0.035))
        sig = np.sin(np.cumsum(f) / SR * TWO_PI) * np.exp(-t / 0.17)
        sig += 0.25 * lowpass(noise(n), 3000.0) * np.exp(-t / 0.01)
        return sig
    return fn


def timpani(f0=73.4):
    n = int(1.6 * SR)
    t = tgrid(n)
    f = f0 * (1.0 + 0.25 * np.exp(-t / 0.05))
    ph = np.cumsum(f) / SR
    sig = np.sin(TWO_PI * ph) * np.exp(-t / 0.55) + 0.35 * np.sin(TWO_PI * ph * 1.5) * np.exp(-t / 0.3)
    sig += 0.4 * lowpass(noise(n), 900.0) * np.exp(-t / 0.012)
    return sig


def crash():
    n = int(2.4 * SR)
    t = tgrid(n)
    return highpass(noise(n), 4200.0, 2) * np.exp(-t / 0.75) * 0.5 * (1 - np.exp(-t / 0.002))


DRUMS = {
    "k": (kick, 0.0, 1.0),
    "s": (snare, 0.0, 0.9),
    "h": (hat_closed, 0.3, 0.7),
    "H": (hat_open, 0.3, 0.7),
    "1": (_tom(190.0), -0.35, 0.9),
    "2": (_tom(140.0), 0.0, 0.9),
    "3": (_tom(100.0), 0.35, 0.95),
    "T": (timpani, 0.0, 1.0),
    "C": (crash, 0.0, 0.7),
}

INSTRUMENTS = {
    "pulse": pulse_lead, "flute": flute, "bell": bell, "pluck": pluck, "harp": harp,
    "guitar": guitar, "pizz": pizz, "celesta": celesta, "chime": chime, "deep_bell": deep_bell,
    "bass": bass, "strings": strings, "brass": brass, "wind": wind,
}

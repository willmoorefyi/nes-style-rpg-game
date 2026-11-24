"""The data and pixel helpers of chaos_orrery_orbs.py (pass EF-E): the hand seeds of the two rings, the four orbs'
painted spots, the fill constants, premultiplied-alpha helpers and the band profile's gap filling (numpy only)."""
from __future__ import annotations

import numpy as np

# hand seeds on each ring's centre line (art px; read off the master), the fit refines them
SEEDS = {
    "A": [(60, 590), (172, 652), (300, 660), (450, 652), (600, 630), (750, 590), (900, 540), (1050, 490), (1180, 430),
          (1258, 330), (1250, 300), (1150, 275), (1000, 265), (850, 280), (200, 460), (300, 420), (120, 505)],
    "B": [(155, 370), (250, 325), (160, 345), (250, 460), (400, 550), (600, 630), (812, 682), (900, 695), (1050, 700),
          (1150, 680), (1167, 645), (1150, 600), (1050, 530)],
}
# orb: (centre (colour-segmented centroid on the master), disc radius, spot radius (halo rim and caps included), ring)
ORBS = {
    "white": ((338.9, 382.6), 44.0, 57.0, "A"),
    "cyan": ((1224.4, 403.4), 43.5, 57.0, "A"),
    "orange": ((172.3, 655.6), 40.0, 56.0, "A"),
    "teal": ((813.6, 681.3), 43.5, 61.0, "B"),
}
END = 0.5                        # |sin t| below this is a ring end: its band over the sky goes under every orb
GLOW_R = 100                     # orb halos in glow.png end inside this radius (measured: 0 beyond ~84)
FEATHER = 6.0
RIM = 7                          # px of an orb's glassy rim outside its disc (unmixed from what lies behind)
WIN = 12                         # px past a spot whose band profile the redraw carries on
ON = np.linspace(-1, 1, 41)      # the profile's normalised offsets across the band
CLONE_BIAS = 1.25                # the mirror is kept unless a same-side clone matches the spot's surround 25 % better
INVENTED = 100.0                 # the mirror search's cost of a spot made wholly of filled (invented) source pixels
TS = np.linspace(-np.pi, np.pi, 2880, endpoint=False)


def armour_gold(x, y):
    """The armour and crown trims, never a ring-only pixel (excluded from the fit)."""
    return ((x > 370) & (x < 950) & (y < 520)) | ((y < 300) & (x > 480) & (x < 900))


def premul(a: np.ndarray) -> np.ndarray:
    out = a.astype(float).copy()
    out[..., :3] *= out[..., 3:] / 255
    return out


def straight(p: np.ndarray) -> np.ndarray:
    out = p.copy()
    a = np.maximum(out[..., 3:], 1e-6)
    out[..., :3] = np.where(out[..., 3:] > 0, out[..., :3] * 255 / a, 0)
    return np.clip(np.round(out), 0, 255).astype(np.uint8)


def over(top: np.ndarray, bot: np.ndarray) -> np.ndarray:
    return top + bot * (1 - top[..., 3:] / 255)


def fill_gaps(v: np.ndarray, max_gap: int) -> np.ndarray:
    """Circular linear interpolation across NaN runs up to max_gap samples, then a 9-sample smoothing."""
    n = len(v)
    ok = ~np.isnan(v)
    out = v.copy()
    idx = np.nonzero(ok)[0]
    for i, j in zip(idx, np.roll(idx, -1)):
        gap = (j - i) % n
        if 1 < gap <= max_gap:
            for s in range(1, gap):
                out[(i + s) % n] = v[i] + (v[j] - v[i]) * s / gap
    sm = out.copy()
    good = ~np.isnan(out)
    k = np.ones(9)
    num = np.convolve(np.concatenate([np.where(good, out, 0)[-4:], np.where(good, out, 0), np.where(good, out, 0)[:4]]), k, "valid")
    den = np.convolve(np.concatenate([good[-4:], good, good[:4]]).astype(float), k, "valid")
    sm[good] = (num / np.maximum(den, 1))[good]
    return sm



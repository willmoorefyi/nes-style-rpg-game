"""Re-outline of the hero kneel frames at the class's own outline thickness (docs/KNEEL_PLAN.md D-K18 additive
option, K2-D; opt-in `kneel: {reoutline: true}` in anim/<class>.yaml).

Classes drawn with a 2 px dark outline (thief, ninja, black_mage ...) lose part of its inner row when the kneel
re-poses limbs (nearest-sampled turns, cut faces with the 1 px seam ink of `puppet.outline`) or squashes the robe
(dropped rows of a stepped hem). `reoutline` restores that inner row: the second ring of the silhouette (the ring
metric of `puppet._second_ring`) is re-inked with the class's own inner-outline colour, growing the existing dark runs
one pixel per pass (a pixel joins when an 8-neighbour of the second ring is already dark), until the frame's ring is
back at ready's. A class with a 1 px outline (ready ring < THICK_RING) is left as it is. Without the key nothing runs,
so every class without it stays byte-identical.
"""
from __future__ import annotations

from collections import Counter

import numpy as np
from PIL import Image

from gen import puppet as PU

DARK = 60                     # the dark threshold of puppet._second_ring
THICK_RING = 0.5              # ready ring at or above this = a 2 px outline
MAX_PASSES = 24


def _rings(a: np.ndarray):
    solid = a[..., 3] > 0
    dark = solid & (a[..., :3].max(2) < DARK)
    edge = solid & PU._grow(~solid)
    second = solid & ~edge & PU._grow(edge)
    return solid, dark, edge, second


def _ring(a: np.ndarray) -> float:
    _, dark, edge, second = _rings(a)
    return float((dark & second).sum() / max(edge.sum(), 1))


def saturated(a: np.ndarray) -> bool:
    """True when every second-ring pixel is already dark (the ring cannot rise without changing the silhouette)."""
    _, dark, _, second = _rings(a)
    return bool(not (second & ~dark).any())


def thickness(ready: Image.Image) -> int:
    """The class's outline thickness measured on ready: 2 when most of the second ring is dark, else 1."""
    return 2 if _ring(np.asarray(ready)) >= THICK_RING else 1


def ink(ready: Image.Image) -> tuple[int, int, int]:
    """The class's inner-outline colour: the most common colour of ready's dark second ring (ties: the darkest)."""
    a = np.asarray(ready)
    _, dark, _, second = _rings(a)
    cols = Counter(tuple(int(v) for v in c) for c in a[dark & second][:, :3])
    if not cols:
        return tuple(PU.OUTLINE)
    return max(cols, key=lambda c: (cols[c], -sum(c), c))


def _n8(m: np.ndarray) -> np.ndarray:
    n = np.zeros(m.shape, np.int32)
    p = np.pad(m, 1)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                n += p[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]]
    return n


def reoutline(img: Image.Image, ready: Image.Image) -> Image.Image:
    """`img` with its second ring re-inked toward ready's ring (see the module doc); deterministic."""
    if thickness(ready) < 2:
        return img
    target = _ring(np.asarray(ready))
    a = np.asarray(img).copy()
    col = ink(ready)
    for _ in range(MAX_PASSES):
        _, dark, edge, second = _rings(a)
        need = int(np.ceil(target * edge.sum() - 1e-9)) - int((dark & second).sum())
        grow = second & ~dark & (_n8(second & dark) > 0)
        if need > 0 and not grow.any():               # no dark run left to grow from: seed on the bare ring
            grow = second & ~dark
        if need <= 0 or not grow.any():
            break
        ys, xs = np.nonzero(grow)                     # raster order; the last pass inks only what is needed
        a[ys[:need], xs[:need], :3] = col
    return Image.fromarray(a, "RGBA")


def apply(out: dict, ready: Image.Image) -> dict:
    """{name: (image, rots, source)} with every image re-outlined."""
    return {n: (reoutline(img, ready), rots, src) for n, (img, rots, src) in out.items()}

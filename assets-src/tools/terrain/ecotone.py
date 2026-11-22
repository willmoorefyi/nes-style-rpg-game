"""AR-T2 boundary helpers for the organic painter (terrain/__init__.py): the AR textures, sampling in global phase,
clustered transition bands ("ecotones") and 15-bit shading.

An ecotone shows, on the receiving side of a material pair, the neighbour's (or a transition) texture wherever
falloff(d) beats a cluster noise (value noise in 2 octaves plus 20 % Bayer), d being the distance to the neighbour.
The falloff is capped below 1 (`top`), so the band breaks up right at the outline too and no contour line forms.
Everything is a function of global pixels (terrain.frame), so a chunk still depends only on about a cell round it.
"""
from __future__ import annotations

import numpy as np

import kit as K
from .base import _bayer, _vnoise, _vnoise_at
from .frame import CTX

# the organic painter's textures: AR names first (gen/terrain_cut.py; kit.AR_SHEET), then the kit's own
AR = {"grass": "ar_grass", "forest": "ar_forest", "mountain": "ar_mountain", "sand": "ar_sand", "ocean": "ar_ocean",
      "dirt": "ar_dirt", "cobble": "ar_cobble", "river": "water_calm", "lake": "water_calm"}
FALLBACK = {"beach": "sand", "shallows": "ocean", "water_calm": "water", "water_calm_shallow": "water",
            "mountain_cold": "mountain", "river": "water", "lake": "water"}
CLUMP = {"tree_clump": "ar_tree_clump", "tree_clump@taiga": "conifer_clump"}


def tex_name(kit: K.Kit, m: str) -> str:
    """The texture the organic painter draws material (or texture) `m` with."""
    for n in (AR.get(m), m, FALLBACK.get(m)):
        if n and n in kit.materials:
            return n
    raise KeyError(f"kit '{kit.id}' has no material '{m}'")


def clump_name(kit: K.Kit, part: str) -> str:
    n = CLUMP.get(part)
    return n if n and n in kit.parts else part


def sample(tex: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """The texture's px under `mask` (window coordinates), in the frame's global phase; no full-window tile."""
    ys, xs = np.nonzero(mask)
    th, tw = tex.shape[:2]
    return tex[(ys + CTX.oy) % th, (xs + CTX.ox) % tw]


def put(below: np.ndarray, mask: np.ndarray, tex: np.ndarray) -> None:
    if mask.any():
        below[mask] = sample(tex, mask)


def snap15(a: np.ndarray) -> np.ndarray:
    v = np.clip(np.round(a.astype(np.float32) / 255 * 31), 0, 31).astype(np.int32)
    return ((v << 3) | (v >> 2)).astype(np.uint8)


def shade(below: np.ndarray, mask: np.ndarray, f: float, add: float = 0.0) -> None:
    if mask.any():
        below[mask] = snap15(np.minimum(below[mask].astype(np.float32) * f + add, 255))


def cluster(h: int, w: int, seed: int, cell: int = 6, y0: int = 0, x0: int = 0) -> np.ndarray:
    """Cluster noise in 0..1 over the h x w box at window px (y0, x0): value noise at `cell` px and 2 px, plus 20 %
    Bayer (so a threshold breaks up in clumps of a few px, never along a line)."""
    oy, ox = CTX.oy + y0, CTX.ox + x0
    n = 0.62 * _vnoise_at(oy, ox, h, w, max(2, cell), seed) + 0.38 * _vnoise_at(oy, ox, h, w, 2, seed + 7)
    by = np.roll(np.roll(_bayer(h + 4, w + 4), -(oy % 4), 0), -(ox % 4), 1)[:h, :w]
    return np.clip(0.5 + 0.55 * n, 0, 1) * 0.8 + 0.2 * by


def bbox(mask: np.ndarray) -> tuple[slice, slice] | None:
    rows, cols = np.nonzero(mask.any(axis=1))[0], np.nonzero(mask.any(axis=0))[0]
    if not len(rows):
        return None
    return slice(int(rows[0]), int(rows[-1]) + 1), slice(int(cols[0]), int(cols[-1]) + 1)


def band(recv: np.ndarray, d: np.ndarray, width: float, seed: int, gamma: float = 1.0, cell: int = 6,
         top: float = 0.8) -> np.ndarray:
    """The px of `recv` within `width` px of the neighbour (distance d) where the falloff beats the cluster noise
    (evaluated on the band's bounding box only)."""
    near = recv & (d <= width)
    box = bbox(near)
    if box is None:
        return near
    ys, xs = box
    p = top * np.clip(1 - (d[box] - 0.5) / width, 0, 1) ** gamma
    out = np.zeros_like(near)
    out[box] = near[box] & (p > cluster(ys.stop - ys.start, xs.stop - xs.start, seed, cell, ys.start, xs.start))
    return out


def macro(h: int, w: int, seed: int) -> np.ndarray:
    """Where the macro variant shows: low-frequency noise (5 cells, plus 1 cell), about 45 % of the ground."""
    T = K.T
    return (_vnoise(h, w, 5 * T, seed + 901) + 0.25 * _vnoise(h, w, T, seed + 902)) > 0.1

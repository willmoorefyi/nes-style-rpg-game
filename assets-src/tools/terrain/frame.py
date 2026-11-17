"""The raster frame and per-chunk random numbers (GAP-14, docs/QUEST_PLAN.md 3.5; docs/WORLD_PLAN.md 2.9).

A compile paints one or more pixel windows of a map (the whole map, or for `build_map.py --region` each region rect
plus a 1-chunk ring). `CTX` holds the map id and the window's origin in global map pixels while a window is painted.
Everything random is a pure function of the map id, a chunk and a purpose, never of the window or of a running
generator, so a chunk's pixels depend only on its own cells plus at most about one cell of neighbouring blend:

- `chunk_rng(purpose, col, row)`: `np.random.default_rng(crc32(f"{map_id}:{col}:{row}:{purpose}"))`; placement code
  walks one chunk's cells (or pixels) in row-major order with it.
- `lattice(...)`: the value-noise lattices. Lattice point (i, j) sits at global pixel (i * cy, j * cx); its value is
  drawn from the rng of the chunk that contains that pixel.

Window origins are whole cells, so every pattern that repeats with the cell (T px) or the Bayer matrix (4 px; T is
a multiple of 4) is the same in every window.
"""
from __future__ import annotations

import zlib
from contextlib import contextmanager
from dataclasses import dataclass

import numpy as np

import kit as K

T = K.T
CHUNK = 16                                         # cells per chunk side (build_map.CHUNK)
CPX = CHUNK * T                                    # px per chunk side


@dataclass
class Frame:
    map_id: str = ""
    oy: int = 0                                    # global px of the window's top-left pixel
    ox: int = 0
    mh: int = 0                                    # the whole map's px (0: the window is the whole map)
    mw: int = 0


CTX = Frame()


@contextmanager
def frame(map_id: str, oy: int = 0, ox: int = 0, mh: int = 0, mw: int = 0):
    """Paint inside the window whose top-left pixel is global (ox, oy) of map `map_id`, a map of mw x mh px
    (origins are whole cells)."""
    if oy % T or ox % T:
        raise ValueError(f"frame origin ({ox}, {oy}) is not cell-aligned")
    saved = (CTX.map_id, CTX.oy, CTX.ox, CTX.mh, CTX.mw)
    CTX.map_id, CTX.oy, CTX.ox, CTX.mh, CTX.mw = map_id, oy, ox, mh, mw
    try:
        yield CTX
    finally:
        CTX.map_id, CTX.oy, CTX.ox, CTX.mh, CTX.mw = saved


def map_px(h: int, w: int) -> tuple[int, int]:
    """The whole map's px (h, w), given the current window's."""
    return (CTX.mh or CTX.oy + h), (CTX.mw or CTX.ox + w)


def chunk_rng(purpose: str, col: int, row: int) -> np.random.Generator:
    return np.random.default_rng(zlib.crc32(f"{CTX.map_id}:{col}:{row}:{purpose}".encode()))


def window_chunks(h: int, w: int):
    """(col, row, (y0, y1, x0, x1)) for every global chunk that the current window of h x w px overlaps, in global
    row-major order; the box is the chunk's px in window coordinates, clipped to the window."""
    for r in range(CTX.oy // CPX, (CTX.oy + h - 1) // CPX + 1):
        for c in range(CTX.ox // CPX, (CTX.ox + w - 1) // CPX + 1):
            y0, x0 = r * CPX - CTX.oy, c * CPX - CTX.ox
            yield c, r, (max(0, y0), min(h, y0 + CPX), max(0, x0), min(w, x0 + CPX))


def lattice(purpose: str, i0: int, i1: int, j0: int, j1: int, cy: int, cx: int) -> np.ndarray:
    """Uniform 0..1 values (float64) of the lattice points i0..i1 (rows, spaced cy px) x j0..j1 (columns, cx px),
    inclusive; each point's value comes from the rng of the chunk holding its pixel."""
    out = np.empty((i1 - i0 + 1, j1 - j0 + 1))
    first = lambda k, step: -(-k * CPX // step)       # noqa: E731  (first lattice index in chunk k)
    for r in range(i0 * cy // CPX, i1 * cy // CPX + 1):
        ra, rb = first(r, cy), first(r + 1, cy)        # lattice rows of chunk row r: ra .. rb - 1
        for c in range(j0 * cx // CPX, j1 * cx // CPX + 1):
            ca, cb = first(c, cx), first(c + 1, cx)
            if ra >= rb or ca >= cb:
                continue
            block = chunk_rng(purpose, c, r).random((rb - ra, cb - ca))
            ya, yb, xa, xb = max(ra, i0), min(rb, i1 + 1), max(ca, j0), min(cb, j1 + 1)
            if ya < yb and xa < xb:
                out[ya - i0:yb - i0, xa - j0:xb - j0] = block[ya - ra:yb - ra, xa - ca:xb - ca]
    return out


def tile_at(tex: np.ndarray, h: int, w: int, oy: int | None = None, ox: int | None = None) -> np.ndarray:
    """`tex` repeated over an h x w window whose top-left is global px (ox, oy) (default: the frame's origin), so a
    texture lines up across windows."""
    oy = CTX.oy if oy is None else oy
    ox = CTX.ox if ox is None else ox
    th, tw = tex.shape[:2]
    sy, sx = oy % th, ox % tw
    return np.tile(tex, ((sy + h) // th + 1, (sx + w) // tw + 1) + (1,) * (tex.ndim - 2))[sy:sy + h, sx:sx + w]

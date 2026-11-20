"""Stage `owners` (docs/NATURAL_WORLD_PLAN.md 3.1, 3.4): the owner grid, a region's chunks and its raster.

Each cell goes to the region of the continent field that is strongest there (the act-1 template's is a1); an isle
field with an `owner` (Cardia) claims its disc; then every non-ocean component (an island with its lakes and
rivers) belongs to the region most of it lies in. Sea cells keep the region of the strongest field, which is the
nearest continent's (a field is a signed distance).

`owned_chunks(region, r)` lists the chunks holding at least one owner cell of r; `raster(region, r)` merges them row by
row into maximal horizontal runs (x0, y0, x1, y1 inclusive cells), the `regions.<r>.raster` of 3.4 (NW-4 writes it
into the source); `chunk_owner` names a shared chunk's bookkeeping owner (the most cells, ties in REGIONS order).
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import components
from .noise import XX, YY
from .shape import TEMPLATE

CHUNK = 16
CARDIA_PAD = 3                               # cells beyond an owned isle field's radius
CARDIA_NORTH = 60                            # ... only north of this many rows above Cornelia


def owners(sh: dict, g: np.ndarray, b: RegionSpec, regions: tuple[str, ...]) -> np.ndarray:
    """The owner grid: per cell, the index of its region in `regions`."""
    cont = sh["cont"]
    names = list(cont)
    best = np.argmax(np.stack([cont[k] for k in names]), axis=0)
    reg_of = {c.name: c.region for c in b.continents}
    reg_of[TEMPLATE] = "a1"
    region = np.array([regions.index(reg_of[n]) for n in names])[best]
    for isle in b.isles:
        if isle.owner:
            cx, cy = S.poly([isle.centre])[0]
            near = np.hypot(XX - cx, YY - cy) < isle.radius + CARDIA_PAD
            region[near & (YY < S.CORNELIA_NW[1] - CARDIA_NORTH)] = regions.index(isle.owner)
    lab, sz = components(g != "o")           # an island belongs to the region most of it lies in
    for k in range(1, len(sz)):
        m = lab == k
        region[m] = int(np.argmax(np.bincount(region[m], minlength=len(regions))))
    return region


def owned_chunks(region: np.ndarray, r: int) -> list[tuple[int, int]]:
    """(column, row) of every chunk holding an owner cell of region index r, row-major."""
    h, w = region.shape
    return [(cx, cy) for cy in range(h // CHUNK) for cx in range(w // CHUNK)
            if (region[cy * CHUNK:(cy + 1) * CHUNK, cx * CHUNK:(cx + 1) * CHUNK] == r).any()]


def raster(region: np.ndarray, r: int) -> list[tuple[int, int, int, int]]:
    """Region r's chunk rects merged row by row into maximal horizontal runs (inclusive cell rects)."""
    out = []
    rows: dict[int, list[int]] = {}
    for cx, cy in owned_chunks(region, r):
        rows.setdefault(cy, []).append(cx)
    for cy in sorted(rows):
        xs = rows[cy]
        start = prev = xs[0]
        for cx in xs[1:] + [None]:
            if cx is not None and cx == prev + 1:
                prev = cx
                continue
            out.append((start * CHUNK, cy * CHUNK, (prev + 1) * CHUNK - 1, (cy + 1) * CHUNK - 1))
            if cx is not None:
                start = prev = cx
    return out


def chunk_owner(region: np.ndarray, cx: int, cy: int) -> int:
    """The bookkeeping owner of a chunk: the region with the most cells in it (ties: the lower index)."""
    block = region[cy * CHUNK:(cy + 1) * CHUNK, cx * CHUNK:(cx + 1) * CHUNK]
    return int(np.argmax(np.bincount(block.ravel(), minlength=int(region.max()) + 1)))

"""Stage `owners` (docs/NATURAL_WORLD_PLAN.md 3.1, 3.4): the owner grid, a region's chunks and its raster.

Each land cell goes to the region of the continent field that is strongest there (the act-1 template's is a1); an
isle field with an `owner` (Cardia) claims its disc. Then each non-ocean component (a landmass with its lakes and
rivers): when at most one region holds MAJOR cells of it (an island), the whole of it belongs to the region most of
it lies in; when several do (a continent shared by regions, split along their fields: A1 and FIRE at Pravoka's neck,
EARTH and ELF at the isthmus), the cells of the other regions (fragments) go to the strongest field among those
regions'. Each sea cell belongs to the region of the nearest land cell (4-connected steps), ties broken by `REGIONS`
order (NW-4; NW-2 gave a whole landmass to its majority region, so the south continent was FIRE's and the north
WATER's, and its sea cells kept the strongest field's region).

`owned_chunks(region, r)` lists the chunks holding at least one owner cell of r; `raster(region, r)` merges them row by
row into maximal horizontal runs (x0, y0, x1, y1 inclusive cells), the `regions.<r>.raster` of 3.4 (NW-4 writes it
into the source); `chunk_owner` names a shared chunk's bookkeeping owner (the most cells, ties in REGIONS order).
"""
from __future__ import annotations

import numpy as np

from world_api import PREFIXES

from . import spec as S
from .bundle import RegionSpec
from .geom import components
from .noise import XX, YY
from .shape import TEMPLATE

CHUNK = 16
CARDIA_PAD = 3                               # cells beyond an owned isle field's radius
CARDIA_NORTH = 60                            # ... only north of this many rows above Cornelia
MAJOR = 200                                  # a region holding this many cells of a landmass shares it


def owners(sh: dict, g: np.ndarray, b: RegionSpec, regions: tuple[str, ...]) -> np.ndarray:
    """The owner grid: per cell, the index of its region in `regions`."""
    cont = sh["cont"]
    names = list(cont)
    fields = np.stack([cont[k] for k in names])
    reg_of = {c.name: c.region for c in b.continents}
    reg_of[TEMPLATE] = "a1"
    idx = np.array([regions.index(reg_of[n]) for n in names])
    region = idx[np.argmax(fields, axis=0)]
    for isle in b.isles:
        if isle.owner:
            cx, cy = S.poly([isle.centre])[0]
            near = np.hypot(XX - cx, YY - cy) < isle.radius + CARDIA_PAD
            region[near & (YY < S.CORNELIA_NW[1] - CARDIA_NORTH)] = regions.index(isle.owner)
    land = g != "o"
    lab, sz = components(land)
    for k in range(1, len(sz)):
        m = lab == k
        count = np.bincount(region[m], minlength=len(regions))
        major = [i for i in range(len(regions)) if count[i] >= MAJOR]
        if len(major) <= 1:                  # an island: its sites' region, else the region most of it lies in
            mine = sorted(regions.index(_site_region(e)) for e, (x, y) in b.sites.items() if m[y, x])
            region[m] = mine[0] if mine else int(np.argmax(count))
            continue
        frag = m & ~np.isin(region, major)   # a shared continent: fragments to the strongest major field
        if frag.any():
            sub = np.where(np.isin(idx, major)[:, None, None], fields, -np.inf)
            region[frag] = idx[np.argmax(sub, axis=0)][frag]
    return _sea(region, land, len(regions))


def _site_region(entrance: str) -> str:
    """A site's region from its entrance prefix (world_api.PREFIXES); act 1's legacy names are a1's."""
    by_prefix = {v: k for k, v in PREFIXES.items()}
    return by_prefix.get(entrance.split("_")[0], "a1")


def _sea(region: np.ndarray, land: np.ndarray, n: int) -> np.ndarray:
    """Every sea cell to the region of its nearest land cell (4-connected layers; a tie goes to the lower index)."""
    out = np.where(land, region, n)
    done = land.copy()
    while not done.all():
        cand = np.full(out.shape, n)
        for s, a in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
            src = np.roll(np.where(done, out, n), s, a)
            if a == 0:
                src[0 if s == 1 else -1, :] = n
            else:
                src[:, 0 if s == 1 else -1] = n
            cand = np.minimum(cand, src)
        new = ~done & (cand < n)
        if not new.any():
            break
        out[new] = cand[new]
        done |= new
    return np.where(out == n, region, out)


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

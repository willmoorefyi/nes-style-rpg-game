"""NW2's gorge stamp (docs/NW2_EDITS_PLAN.md 4, 8; NW2-F): the rock banks of a canoe gate.

A `bundle.Gorge(route, i0, i1, ...)` record names a stretch of a pinned canoe route: its raster cells `i0..i1`
(Python indices; a negative `i1` counts from the route's end, -1 its last cell). Every land cell within a reach
(Chebyshev) of those cells that is not itself a route cell is a **bank**:

- `relief.carve` raises the banks within RAISE_R to BANK_ELEV after the route's valley is carved (the valley reaches
  3 cells, so no walkable strip runs beside the gorge; the generated hydrology never runs a river along it, and the
  biome table makes the banks mountain);
- `stamp` forces the banks within BANK_R Mountain after the biomes (the sea and the spec lakes are left), so on the
  finished ground each gorge cell has no walkable 4-neighbour and rock on both sides: the `gorges` check's pass
  cells.

No generated river or pit lake forms within DRY_R of a gorge (the raised banks would otherwise pond the ground
beside it), and the banks are frozen against the finish's jogs (`compose`).
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import disc

BANK_R = 2                                   # a gorge's stamped rock banks reach this far (Chebyshev) from its cells
RAISE_R = 3                                  # ... and its raised ground this far
DRY_R = 6                                    # no generated river or pit lake this near a gorge (hydro's `banned`)
BANK_ELEV = 0.8                              # ... raised to at least this (climate.H_M 0.46, hydro.RIVER_MAX_ELEV 0.75)


def stretch(cells: list, i0: int, i1: int) -> list:
    """A gorge's route cells: `cells[i0..i1]` inclusive, `i1` negative from the end."""
    return cells[i0:(i1 + 1) or None] if i1 < 0 else cells[i0:i1 + 1]


def banks(b: RegionSpec, routes: dict, shape: tuple[int, int], r: int = BANK_R) -> np.ndarray:
    """The bank mask (reach `r`) of every declared gorge (route cells of any route excluded)."""
    out = np.zeros(shape, bool)
    h, w = shape
    for gz in b.gorges:
        for x, y in stretch(routes[gz.route], gz.i0, gz.i1):
            out[max(0, y - r):min(h, y + r + 1), max(0, x - r):min(w, x + r + 1)] = True
    for cells in routes.values():
        for x, y in cells:
            out[y, x] = False
    return out


def raise_banks(elev: np.ndarray, land: np.ndarray, bank: np.ndarray) -> np.ndarray:
    return np.where(bank & land, np.maximum(elev, BANK_ELEV), elev)


def stamp(g: np.ndarray, bank: np.ndarray, b: RegionSpec) -> int:
    """The banks to Mountain: every land cell, a generated river or lake too (so no generated water opens a side
    way out of the gorge), but not the sea or a spec lake. Returns the cells stamped."""
    keep = np.zeros(g.shape, bool)
    for lk in b.lakes:
        keep |= disc(*S.poly([lk.centre])[0], lk.radius)
    hit = bank & ~keep & ~np.isin(g, ["o", "m"])
    g[hit] = "m"
    return int(hit.sum())

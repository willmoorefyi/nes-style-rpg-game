"""NW2's hike pass (docs/NW2_EDITS_PLAN.md 7, D-NW2-1): the ground round each declared `bundle.Hike` site.

The composer (`layouts/world.py`) calls `apply` after the regions' content and before the spots are resolved, so a
hike's landing spot resolves onto the meadow this pass stamps. For each hike, with every patch on:
- **the ring:** every grass cell within K + jitter steps of the site's arrival on foot+canoe (the floor's mode; the
  jitter 0-4 from fbm, so the ring's edge is never a clean disc) becomes `fill`; `climate` picks it by the local
  climate: taiga where `cold` > COLD_FILL, sand in an `arid` hint, swamp in a `wet` hint, forest otherwise. The
  arrival cell becomes taiga or sand (walkable either way); pins (act 1's kept cells) and roads are left alone. Every
  fill is walkable, so no distance moves;
- **the meadow:** a ragged grass disc of MEADOW_R round the landing spot's target, on its walkable cells that are at
  least K steps (foot+canoe) from every declared site, so no meadow cell serves another hike too close.
The check `hikes` (`gates_hike.py`) then measures the floor, the cap and E_hike. Returns the cells filled per site
(a figure the `hikes` line reports). Deterministic: seeded fbm, row-major order, no set iteration.
"""
from __future__ import annotations

import numpy as np

from .bundle import Hike, RegionSpec
from .climate import _gauss
from .gates import BLOCK, LANDING, canoe, with_patches
from .geom import bfs_dist
from .noise import XX, YY, fbm
from .spots import target

COLD_FILL = 0.2                              # taiga where cold > this (the plan's rule; T_TAIGA is 0.25)
MEADOW_R = 1.5                               # the landing meadow's radius (cells), before its ragged edge
ROADS = ",:"
HINT_EDGE = float(np.exp(-3.0))              # a climate hint's own radius (its _gauss there)


def _hint(b: RegionSpec, kind: str) -> np.ndarray:
    m = np.zeros(XX.shape, bool)
    for h in b.climate:
        if h.kind == kind:
            m |= _gauss(h.centre, h.radius) > HINT_EDGE
    return m


def fill_of(b: RegionSpec, cold: np.ndarray) -> np.ndarray:
    """The `climate` fill per cell: taiga, sand, swamp or forest (in that order of precedence)."""
    out = np.full(XX.shape, "f", object)
    out[_hint(b, "wet")] = "w"
    out[_hint(b, "arid")] = "s"
    out[cold > COLD_FILL] = "t"
    return out


def apply(g: np.ndarray, meta: dict, b: RegionSpec, recs: list[Hike], floor: int, seed: int) -> dict[str, int]:
    if not recs:
        return {}
    h = with_patches(g, meta)
    ok = canoe(h)
    dist = {r.site: bfs_dist(ok, [tuple(meta["entrances"][r.site])]) for r in recs}
    fill = fill_of(b, meta["cold"])
    jitter = np.clip(np.rint(2 + fbm(seed + 1501, (6, 3)) / 0.15), 0, 4).astype(int)
    keep = meta["keep"] | np.isin(g, list(ROADS))
    grass = np.isin(g, LANDING) & ~keep
    out = {}
    for r in recs:
        d = dist[r.site]
        ring = grass & (d >= 0) & (d < floor + jitter)
        for y, x in np.argwhere(ring):
            g[y, x] = fill[y, x]
        ax, ay = meta["entrances"][r.site]
        if ring[ay, ax]:                     # the arrival: taiga or sand, never forest or swamp
            g[ay, ax] = "t" if meta["cold"][ay, ax] > COLD_FILL else "s"
        out[r.site] = int(ring.sum())
    far = np.logical_and.reduce([(d < 0) | (d >= floor) for d in dist.values()])
    docks = {d["id"]: (d["x"], d["y"]) for d in meta["docks"]}
    spots = {s.name: s for s in b.spots}
    for i, r in enumerate(recs):
        tx, ty = target(spots[r.landing], b.sites, docks)
        disc = np.hypot(XX - tx, YY - ty) <= MEADOW_R + 1.5 * fbm(seed + 1511 + i, (4, 2))
        disc[ty, tx] = True
        g[disc & far & ~keep & ~np.isin(g, BLOCK)] = "."
    return out

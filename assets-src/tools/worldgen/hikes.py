"""NW2's hike pass (docs/NW2_EDITS_PLAN.md 7, R5; NW2-W): the ground round each declared `bundle.Hike` site.

`world.py` runs it after the regions' content and before the spots resolve. For each declared hike (the bounds from
`world-anchors.yaml`'s `hike:` block, D-NW2-12):

- **the ring:** every grass cell whose foot+canoe distance from the site's arrival cell (every patch on) is under
  K + jitter (jitter 0..JITTER whole steps from fbm, so the ring is never a clean disc) becomes the hike's `fill`.
  `climate` (the only fill today) picks by the local climate: taiga where `cold > COLD_FILL` (the composer's cold
  field, `meta["cold"]`), sand inside an `arid` hint, swamp inside a `wet` hint (within one hint radius), forest
  otherwise. Only grass changes, so the walking and canoe distances stay as they are; roads (cobble, dirt, bridge)
  and act 1's kept cells are left alone. The arrival cell is grass, so it becomes taiga or sand and stays walkable;
- **the meadow:** a ragged grass disc of radius MEADOW_R round the hike's `landing` spot target (its entrance plus
  the spot offset): its centre always, the other cells unless the jitter field drops them; only walkable land that
  is not a road changes, and only cells the ring did not keep (the meadow is outside every ring by construction:
  the `hikes` check proves the floor).

The airship can then land only on the meadow (or on grass beyond the floor); `gates_hike.hikes` checks the floor,
the cap, the zones and E_hike. Deterministic: seeded fbm, row-major order, no set iteration.
"""
from __future__ import annotations

import numpy as np

from . import climate
from .gates import canoe, with_patches
from .geom import bfs_dist, disc
from .noise import fbm

JITTER = 4                                   # the ring's edge: K + 0..JITTER steps
MEADOW_R = 1.5                               # the landing meadow's radius (cells)
COLD_FILL = 0.2                              # the fill is taiga where the cold field is above this
SEED = 1987 + 501                            # the jitter field's seed (the world's seed plus this pass's offset)
WALKABLE_LAND = (".", "f", "t", "s", "w", "n")   # what a meadow may cover (no road, rock, water or wall)


def _in_hint(b, kind: str) -> np.ndarray:
    out = np.zeros((climate.N, climate.N), bool)
    for h in b.climate:
        if h.kind == kind:
            out |= climate._gauss(h.centre, h.radius) > np.exp(-3)      # within one hint radius
    return out


def fill_of(meta: dict, b) -> np.ndarray:
    """The `climate` fill per cell: taiga, sand, swamp or forest."""
    out = np.full((climate.N, climate.N), "f")
    out[_in_hint(b, "wet")] = "w"
    out[_in_hint(b, "arid")] = "s"
    out[meta["cold"] > COLD_FILL] = "t"
    return out


def jitter() -> np.ndarray:
    """Whole steps 0..JITTER per cell (fbm, about uniform over the range)."""
    j = fbm(SEED, (12, 6, 3))
    return np.clip(np.floor((j / 0.3 + 1.5) / 3 * (JITTER + 1)), 0, JITTER).astype(int)


def apply(g: np.ndarray, meta: dict, b, hike: dict, targets: dict) -> dict:
    """In place on `g`. `hike`: `world_specs.common.hike()`; `targets`: {hike site: its landing spot's target cell}.
    Returns {site: {"converted": ring cells changed, "meadow": meadow cells laid}}."""
    if not b.hikes:
        return {}
    K, jit, fill = hike["floor"], jitter(), fill_of(meta, b)
    passable = canoe(with_patches(g, meta))
    keep = meta["keep"]
    ring = np.zeros(g.shape, bool)
    out = {}
    for r in b.hikes:
        d = bfs_dist(passable, [tuple(meta["entrances"][r.site])])
        near = (d >= 0) & (d < K + jit) & (g == ".") & ~keep
        g[near] = fill[near]
        ring |= (d >= 0) & (d < K)
        out[r.site] = {"converted": int(near.sum())}
    for r in b.hikes:
        tx, ty = targets[r.site]
        m = disc(tx, ty, MEADOW_R) & np.isin(g, WALKABLE_LAND) & ~ring & ~keep
        m &= (jit < JITTER) | disc(tx, ty, 0)        # ragged: the jitter's top step drops a cell, never the centre
        g[m] = "."
        out[r.site]["meadow"] = int(m.sum())
    return out

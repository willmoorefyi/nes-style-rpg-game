"""Water by depth (AR-T2): one rule for the sea, lakes and rivers, the beach and the fresh-water banks.

Every water px is coloured by its distance to land: shallows give way to deep water in clustered steps (no contour
line), with a broken foam line at the shore and the bank's shadow lip under a north or west shore (light from the
top-left). The sea draws the approved ocean and its shallows; rivers and lakes draw the calm fresh water
(`water_calm_shallow` -> `water_calm`: no waves, no streaks), handing over to the sea's rule within two cells of
the sea, so river mouths and lake-to-sea joins show no seam.
"""
from __future__ import annotations

import numpy as np

from .base import T, _dist, _low_dist
from .ecotone import band, cluster, put, shade, tex_name

SHORE, DEEP = 4, 22          # px: water this close to land is all shallow; deep water is reached DEEP px further out
FRESH = (2, 10)              # px: the same for rivers and lakes (they are 1-3 cells wide)
FOAM, LIP = 2.2, 3           # px: the foam line; the bank's shadow on the water under a north / west shore
HANDOVER = 2 * T             # px: a river or lake this close to the sea takes the sea's colours (clustered)


def depth(below: np.ndarray, sea: np.ndarray, fresh: np.ndarray, land: np.ndarray, kit, seed: int) -> None:
    """Paint every water px (sea | fresh) by its distance to land."""
    water = sea | fresh
    if not water.any():
        return
    H, W = water.shape
    if land.any():
        d = _low_dist(land, SHORE + DEEP + 8)
        d = np.where(d <= 12, np.minimum(d, _dist(land, 12)), d)     # exact near the shore, smooth further out
    else:
        d = np.full((H, W), np.float32(1e9))
    c = cluster(H, W, seed + 301, 8)
    if fresh.any() and sea.any():
        near = _low_dist(sea, HANDOVER)
        as_sea = fresh & (np.clip(1 - near / HANDOVER, 0, 1) > c)
    else:
        as_sea = np.zeros_like(fresh)
    salt, calm = sea | as_sea, fresh & ~as_sea
    for mask, (s0, s1), shal, deep in ((salt, (SHORE, DEEP), "shallows", "ocean"),
                                       (calm, FRESH, "water_calm_shallow", "water_calm")):
        if not mask.any():
            continue
        frac = np.clip((d - s0) / s1, 0, 1)
        dsel = mask & (frac > c)
        put(below, mask & ~dsel, kit.material(tex_name(kit, shal)))
        put(below, dsel, kit.material(tex_name(kit, deep)))
    edge = water & (d <= FOAM) & (cluster(H, W, seed + 302, 5) > 0.35)
    shade(below, edge, 1.18, 28)
    lip = np.zeros_like(water)
    for j in range(1, LIP + 1):
        lip[j:, :] |= land[:-j, :]
        lip[:, j:] |= land[:, :-j]
    shade(below, water & lip & ~edge, 0.78)


def beach(below: np.ndarray, sea: np.ndarray, soft: np.ndarray, d_sea: np.ndarray, kit, seed: int) -> np.ndarray:
    """A beach on soft land meeting the sea, darker (wet) at the waterline. Returns its px."""
    bm = band(soft, d_sea, 9, seed + 1, 0.6, 5, top=1.0)
    put(below, bm, kit.material(tex_name(kit, "beach")))
    shade(below, bm & (d_sea <= 2.5), 0.86)
    return bm


def banks(below: np.ndarray, open_land: np.ndarray, d_fresh: np.ndarray, kit, seed: int) -> np.ndarray:
    """River and lake banks: a 4 px fringe of earth in clusters on the land side. Returns its px."""
    bm = band(open_land, d_fresh, 4, seed + 12, 0.8, 3, top=1.0)
    put(below, bm, kit.material(tex_name(kit, "dirt")))
    return bm

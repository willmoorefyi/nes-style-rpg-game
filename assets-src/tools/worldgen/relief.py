"""Stage `relief` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rules 3, 4, 4b, 7): the elevation field.

Elevation is a coast-distance term plus the ridgelines (a Gaussian falloff of each ridge's width, modulated by ridged
noise: spurs, crags, saddles) and the volcanic cones, plus a little fbm. The wall lines and barrier ridges are forced
high; the passes (the canal saddle) are forced low. Then the pinned canoe routes carve their valleys (so the
hydrology follows them), the walking corridors are kept under mountain height outside the walls, and every site is
flattened round its pin. NW-0's pilot math, unchanged.
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import disc, edt_signed, pline
from .noise import N, XX, YY, fbm

ROUTE_FLOOR, ROUTE_SLOPE, ROUTE_REACH = 0.05, 0.1, 3     # a route's valley: its floor and walls (cells)
CORRIDOR_MAX = 0.45                          # a corridor stays under mountain height (climate.H_M 0.46)
SITE_MAX, SITE_R = 0.3, 2.5                  # every site is flattened within 2.5 cells of its pin


def relief(sh: dict, b: RegionSpec, seed: int, land: np.ndarray) -> np.ndarray:
    """Elevation in [0, ~1.4] on land, -1 at sea."""
    dist_in = np.clip(edt_signed(land), 0, 30) / 30
    rn = sh["rn"]
    ridge = np.zeros((N, N))
    for r in b.ridges:
        d = pline(S.poly(r.points))
        ridge = np.maximum(ridge, r.height * np.exp(-(d / (r.width * (0.8 + rn))) ** 2))
    for c in b.cones:
        x, y = S.poly([c.at])[0]
        ridge = np.maximum(ridge, c.height * np.exp(-((XX - x) ** 2 + (YY - y) ** 2) / (c.width * c.width)))
    elev = 0.25 * dist_in + 0.85 * ridge * (0.75 + 0.5 * rn) + 0.08 * fbm(seed + 41)
    elev = np.where(sh["walls"], np.maximum(elev, 0.8), elev)
    for m in sh["barriers"].values():
        elev = np.where(m, np.maximum(elev, 0.85), elev)
    for ps in b.passes:
        cx, cy = S.poly([ps.at])[0]
        elev = np.where(disc(cx, cy, ps.radius), np.minimum(elev, 0.3), elev)
    return np.where(land, elev, -1.0)


def walls_all(sh: dict) -> np.ndarray:
    """Every wall line and barrier ridge mask."""
    return sh["walls"] | np.logical_or.reduce(list(sh["barriers"].values()))


def carve(elev: np.ndarray, land: np.ndarray, sh: dict, rmask: np.ndarray, cmask: np.ndarray, sites: dict):
    """The pinned canoe valleys (2.4 rule 4), the corridors under mountain height (4b), the sites flattened (7)."""
    valley = edt_signed(rmask)
    nobar = ~walls_all(sh) | rmask
    elev = np.where(land & (valley > -ROUTE_REACH) & nobar,
                    np.minimum(elev, ROUTE_FLOOR + ROUTE_SLOPE * np.clip(-valley, 0, ROUTE_REACH)), elev)
    elev = np.where(cmask & land & ~walls_all(sh), np.minimum(elev, CORRIDOR_MAX), elev)
    for x, y in sites.values():
        elev = np.where(disc(x, y, SITE_R) & land, np.minimum(elev, SITE_MAX), elev)
    return elev


def corridor_mask(corr: dict) -> np.ndarray:
    """The 3-cell band of every corridor's raster line."""
    cmask = np.zeros((N, N), bool)
    for cells in corr.values():
        for x, y in cells:
            cmask[max(0, y - 1):y + 2, max(0, x - 1):x + 2] = True
    return cmask

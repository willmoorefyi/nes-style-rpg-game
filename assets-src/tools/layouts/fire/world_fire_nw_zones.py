"""Region FIRE's encounter zones on the NW world (pass NW, NW-R FIRE; docs/NATURAL_WORLD_PLAN.md 3.3, 3.8
`coverage`): every FIRE-owned walkable, canoe and sea cell to its zone (today's ids and rosters, `fire_tables.py`).
Used by `world_fire_nw.content`; the coverage rule itself (with FIRE's ship-zone rule) is the composer's single
check, `world_content.coverage` (NW-RINT).

- Crescent's shore (`fir_lakeshore`): the land walkable from its gate (and FIRE land nearer Crescent than the south);
- the cold tip north of `ice_neck` (NW2: the Frost Shore, the Rime Fells' pockets and the Rime Hollow) the frost
  zone (`fir_tundra`), unless it is walkable from Crescent's gate;
- the south lands: the ash (`fir_ashlands`) within ASH_R of Gurgu or nearer it than the hull, the hull desert
  (`fir_desert`) the rest;
- rivers and lakes `fir_rivers`; sea by basin, `fir_aldi` (the Aldi flood, canal shut) or `fir_sea`.
"""
from __future__ import annotations

import numpy as np

from world_api import REGIONS
from worldgen.gates import BLOCK, with_patches
from worldgen import spec as S
from worldgen.geom import flood

from fire import fire_tables as T

REGION = "fire"
SOUTH = ("fir_volcano", "fir_desert")
ASH_R = 12                               # the ash round Gurgu
TIP_Y = -27                              # NW2: the tip north of ice_neck (Cornelia-relative row) is the Frost Hollow


def row_rects(cells: set) -> list[list[int]]:
    """Cells -> inclusive [x0, y, x1, y] runs, row-major (overworld_zones.row_rects' format; that file retires at NW-5)."""
    out = []
    for y in sorted({y for _, y in cells}):
        xs = sorted(x for x, yy in cells if yy == y)
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            out.append([start, y, prev, y])
            start = prev = x
    return out


def zone_cells(g, meta) -> dict[str, set]:
    """Every FIRE-owned walkable, canoe and sea cell -> its zone id."""
    own = meta["region"] == REGIONS.index(REGION)
    e = {k: tuple(v) for k, v in meta["entrances"].items()}
    walk = ~np.isin(g, BLOCK)
    shore = flood(walk, [e["fir_crescent"]])
    south = flood(walk, [e[s] for s in SOUTH])
    aldi = flood(with_patches(g, meta, canal=False) == "o", [tuple(meta["seeds"]["aldi"])])
    out: dict[str, set] = {z: set() for z in T.ZONES}
    for y, x in np.argwhere(own):
        c = g[y, x]
        if c == "o":
            out["fir_aldi" if aldi[y, x] else "fir_sea"].add((int(x), int(y)))
        elif c in "r≈":
            out["fir_rivers"].add((int(x), int(y)))
        elif walk[y, x]:
            out[_land_zone(x, y, e, shore[y, x], south[y, x])].add((int(x), int(y)))
    return out


def _land_zone(x: int, y: int, e: dict, shore: bool, south: bool) -> str:
    d = {k: float(np.hypot(x - e[k][0], y - e[k][1])) for k in ("fir_crescent",) + SOUTH}
    if not shore and not south and y <= S.world((0, TIP_Y))[1]:
        return "fir_tundra"
    if shore or (not south and d["fir_crescent"] <= min(d[s] for s in SOUTH)):
        return "fir_lakeshore"
    if d["fir_volcano"] <= ASH_R or d["fir_volcano"] <= d["fir_desert"]:
        return "fir_ashlands"
    return "fir_desert"

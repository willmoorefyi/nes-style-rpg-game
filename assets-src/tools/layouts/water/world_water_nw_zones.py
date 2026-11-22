"""Region WATER's encounter zones and battle backdrops on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8
`coverage`, 2.6; NW-R): WAT-O's four zones with the same ids, names, modes and tables (`world_water_zones.py`), built
from the composed ground and WATER's owner cells instead of today's box. The first zone that holds a cell wins:

- `wat_streams` (canoe): every River and Lake cell WATER owns (R-waterfall, the tarns, the lakes) and the ledge
  behind the falls (its arrival and the cave door);
- `wat_dunes`: the caravan's dune field (the sand patches within DUNE_R of the camp, with a one-cell fringe), the
  oasis meadow within OASIS_R of the camp's arrival and the tent's door;
- `wat_isles`: every other walkable cell WATER owns (grass, forest, taiga, snow, sand; the look-only islands too);
- `wat_sea` (ship): every Water cell WATER owns.

So every walkable or canoe cell of WATER is in one of its zones (3.8 `coverage`). Backdrops: today's, plus D-NW9's
cold ground on `wat_isles`: snow fights on `ice_cave` (the frozen floor), taiga fights on `dark_forest` (the conifer
belt, NW2 Q8); both are staged ids already (no new art).
"""
from __future__ import annotations

import numpy as np

import world_water_zones as WZ  # noqa: E402  (today's tables, backdrops and row_rects)
import sea_tables as ST  # noqa: E402  (WR F-WR: the early seas' tables)
from worldgen import gates
from worldgen.geom import components

DUNE_R = 8                      # the dune field: sand patches that come this close to the caravan's arrival
OASIS_R = 3                     # ... and the meadow round the camp
COLD = {"taiga": "dark_forest", "snow": "ice_cave"}


def _disc(shape, c, r: float) -> np.ndarray:
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r


def _grow(m: np.ndarray) -> np.ndarray:
    out = m.copy()
    out[1:] |= m[:-1]
    out[:-1] |= m[1:]
    out[:, 1:] |= m[:, :-1]
    out[:, :-1] |= m[:, 1:]
    return out


def _rects(m: np.ndarray) -> list[list[int]]:
    ys, xs = np.nonzero(m)
    return WZ.row_rects({(int(x), int(y)) for y, x in zip(ys, xs)})


def zones(g: np.ndarray, p) -> list[dict]:
    """`p`: world_water_nw.Places (WATER's owner cells and its places)."""
    mine, walk = p.mine, gates.walk(g)
    lab, _ = components((g == "s") & mine)
    near = _disc(g.shape, p.camp, DUNE_R)
    field = np.isin(lab, [k for k in np.unique(lab[near & (lab > 0)])])
    dunes = walk & mine & (_grow(field) | _disc(g.shape, p.camp, OASIS_R))
    dunes[p.tent_door[1], p.tent_door[0]] = True
    ledge = np.zeros(g.shape, bool)
    for x, y in (p.ledge, p.cave_door):
        ledge[y, x] = True
    streams = (np.isin(g, ["r", "≈"]) & mine) | ledge
    isles = walk & mine & ~dunes
    sea = (g == "o") & mine
    # WR F-WR (docs/WORLD_WRAP_PLAN.md 8.4): the seam bands meet FIRE's sea (west, y 98-119) and ELF's (north)
    seam_w = sea & ST.band(g.shape, 0, 98, ST.SEAM_BAND - 1, 119)
    seam_n = sea & ST.north(g.shape, 0, 106) & ~seam_w
    sea &= ~(seam_w | seam_n)
    return [
        {"id": "wat_streams", "name": "Waterfall River", "modes": ["canoe"], "rects": _rects(streams),
         "encounters": WZ.STREAMS},
        {"id": "wat_dunes", "name": "Caravan Dunes", "rects": _rects(dunes), "encounters": WZ.DUNE_TABLE},
        {"id": "wat_isles", "name": "Onrac Coast", "rects": _rects(isles), "encounters": WZ.COAST_TABLE},
        {"id": "wat_sea", "name": "Onrac Seas", "modes": ["ship"], "rects": _rects(sea), "encounters": WZ.SEA_TABLE},
        {"id": "wat_seam_w", "name": "Onrac Seas, far rim", "modes": ["ship"], "rects": _rects(seam_w),
         "encounters": ST.EARLY_EAST},
        {"id": "wat_seam_n", "name": "Onrac Seas, far rim", "modes": ["ship"], "rects": _rects(seam_n),
         "encounters": ST.EARLY_SOUTH},
    ]


def backdrops() -> dict:
    out = {k: {kk: dict(vv) if isinstance(vv, dict) else vv for kk, vv in v.items()} for k, v in WZ.BACKDROPS.items()}
    out["wat_isles"]["terrain"].update(COLD)
    out["wat_seam_w"] = {"default": "ocean"}   # WR F-WR
    out["wat_seam_n"] = {"default": "ocean"}
    return out

"""The encounter zones of region WATER (docs/WORLD_PLAN.md 4.0.3, 4.6; WAT-O), in world cells.

Four zones, region-prefixed, the first that holds a cell wins (the runtime skips a zone whose `modes` exclude the
party's mode):

- `wat_streams` (canoe; S21: red_piranha, crocodile): the R-waterfall river and the ledge behind the falls;
- `wat_dunes` (S22: sand_worm, desert_baretta, manticore): the dune field, its oasis and the caravan's track;
- `wat_isles` (S20 land: nightmare, weretiger): every other walkable cell of the box, the ledge and the falls'
  door included;
- `wat_sea` (ship; sahagin_prince, white_shark, deepeyes, sea_snake): every Water cell of the box, band cells too.

So every walkable cell is in a walking zone and every Water cell in exactly one ship zone. Neighbouring zones share
no species (the W5 rule).

`zone_keys_accepted()` asks the compiler's zone check (`map_checks_encounters.py`) whether it takes `modes`,
`name` and a water-only ship zone (it does since the FIR-O merge); on an older check the zones fall back to
the plain keys and `wat_sea` is left out.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common import Grid, polygon_mask  # noqa: E402
from world_water_land import DUNES, FALLS, H, LEDGE, OASIS, TRACK, W  # noqa: E402

WALK = frozenset(".,:fs=%w_+-")


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


STREAMS = [{"groups": [_g("red_piranha", 2, 4)], "weight": 4},
           {"groups": [_g("crocodile", 1, 2)], "weight": 3},
           {"groups": [_g("crocodile", 1), _g("red_piranha", 1, 3)], "weight": 2}]
DUNE_TABLE = [{"groups": [_g("desert_baretta", 2, 3)], "weight": 4},
              {"groups": [_g("manticore", 1, 2)], "weight": 3},
              {"groups": [_g("sand_worm", 1)], "weight": 2},
              {"groups": [_g("manticore", 1), _g("desert_baretta", 1, 2)], "weight": 2}]
COAST_TABLE = [{"groups": [_g("weretiger", 2, 3)], "weight": 4},
               {"groups": [_g("nightmare", 1, 2)], "weight": 3},
               {"groups": [_g("nightmare", 1), _g("weretiger", 1, 2)], "weight": 3}]
SEA_TABLE = [{"groups": [_g("sahagin_prince", 2, 3)], "weight": 4},
             {"groups": [_g("sea_snake", 1, 3)], "weight": 3},
             {"groups": [_g("white_shark", 1, 2)], "weight": 3},
             {"groups": [_g("deepeyes", 1), _g("sahagin_prince", 1, 2)], "weight": 2}]
BACKDROPS = {"wat_streams": {"default": "waterfall"},
             "wat_dunes": {"default": "desert"},
             "wat_isles": {"terrain": {"forest": "forest", "desert": "shoreline", "water": "ocean", "river": "river"}},
             "wat_sea": {"default": "ocean"}}


def row_rects(cells: set[tuple[int, int]]) -> list[list[int]]:
    """Cells run-length encoded per row into inclusive [x0, y, x1, y] rects, row-major."""
    out = []
    for y in sorted({y for _, y in cells}):
        xs = sorted(x for x, yy in cells if yy == y)
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            out.append([start, y, prev, y])
            if x is not None:
                start = prev = x
    return out


def zone_keys_accepted() -> bool:
    """Whether the compiler's zone check takes `modes`, `name` and a ship zone that covers only water."""
    import map_checks_encounters as MCE  # noqa: PLC0415
    from map_graph import WATER  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415

    class _C:
        width = height = 1
        collision = np.full((1, 1), WATER)

    zone = {"id": "probe", "name": "Probe", "modes": ["ship"], "rects": [[0, 0, 0, 0]], "encounters": []}
    return not MCE.encounter_errors({"encounterZones": [zone]}, _C())


def zones(g: Grid) -> list[dict]:
    full = zone_keys_accepted()
    dune_mask = polygon_mask(W, H, DUNES)
    oasis = polygon_mask(W, H, OASIS)
    river = {(x, y) for y in range(H) for x in range(W) if g[x, y] == "r"}
    walk = {(x, y) for y in range(H) for x in range(W) if g[x, y] in WALK}
    dunes = {(x, y) for x, y in walk if dune_mask[y][x] or oasis[y][x]} | set(TRACK)
    coast = (walk - dunes) | {(FALLS[0], FALLS[1] + 2)} | set(LEDGE)    # the cave door is walked onto
    sea = {(x, y) for y in range(H) for x in range(W) if g[x, y] == "o"}
    out = [
        {"id": "wat_streams", "name": "Waterfall River", "modes": ["canoe"], "rects": row_rects(river | set(LEDGE)),
         "encounters": STREAMS},
        {"id": "wat_dunes", "name": "Caravan Dunes", "rects": row_rects(dunes), "encounters": DUNE_TABLE},
        {"id": "wat_isles", "name": "Onrac Coast", "rects": row_rects(coast), "encounters": COAST_TABLE},
        {"id": "wat_sea", "name": "Onrac Seas", "modes": ["ship"], "rects": row_rects(sea), "encounters": SEA_TABLE},
    ]
    if full:
        return out
    return [{k: v for k, v in z.items() if k not in ("modes", "name")} for z in out if z["id"] != "wat_sea"]

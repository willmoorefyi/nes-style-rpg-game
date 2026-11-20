"""Region WATER's encounter tables (docs/WORLD_PLAN.md 4.0.3, 4.6; WAT-O): the four zones' tables and backdrops,
`wat_streams` (canoe), `wat_dunes`, `wat_isles` and `wat_sea` (ship), and `row_rects`. Pass W's zone cells retired at
NW-5 (docs/NATURAL_WORLD_PLAN.md 3.6.1, 7): the NW world builds the zones in `water/world_water_nw_zones.py`.
"""
from __future__ import annotations

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

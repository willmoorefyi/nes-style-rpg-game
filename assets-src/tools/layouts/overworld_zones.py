"""Act 1's encounter tables (T4 1.6): the fields (the map default), the temple approach and the east pocket, their
battle backdrops, and `row_rects`. Pass W's act-1 zone cells retired at NW-5 (docs/NATURAL_WORLD_PLAN.md 3.6.1, 3.6.4):
the NW world builds act 1's zones in `a1/world_a1_nw.py`.
"""
from __future__ import annotations


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


# the map default: the Cornelia fields, the north road to the bridge included (FF1: the Coneria domain)
FIELDS = [{"groups": [_g("goblin", 3, 5)], "weight": 5},
          {"groups": [_g("wolf", 1, 2)], "weight": 3},
          {"groups": [_g("goblin", 2, 3), _g("wolf", 1)], "weight": 3},
          {"groups": [_g("gr_imp", 1, 2), _g("goblin", 1, 3)], "weight": 2},
          {"groups": [_g("wolf", 2, 4)], "weight": 1}]
# W5: no goblins on the approach; skeletons leak from the temple
TEMPLE_APPROACH = [{"groups": [_g("gr_imp", 2, 4)], "weight": 3},
                   {"groups": [_g("wolf", 2, 3)], "weight": 3},
                   {"groups": [_g("skeleton", 1, 2), _g("gr_imp", 1, 2)], "weight": 2},
                   {"groups": [_g("gr_imp", 1, 2), _g("wolf", 1, 2)], "weight": 2}]
EAST_POCKET = [{"groups": [_g("wolf", 3, 5)], "weight": 3},
               {"groups": [_g("gr_imp", 3, 5)], "weight": 2},
               {"groups": [_g("gr_wolf", 1), _g("wolf", 0, 2)], "weight": 1}]
# battle backgrounds per zone (BA-12, T6h; the plan's TF-3 table): only the temple approach's forest is the dark
# forest; with no zone default its open fields, beaches and water fall through to the map's table. The east pocket
# fights in the ruined forest; a zone default wins over the map's terrain table, so its beaches and water list theirs
_WET = {"desert": "shoreline", "water": "ocean", "river": "river"}
ZONE_BACKDROPS = {"temple_approach": {"terrain": {"forest": "dark_forest"}},
                  "east_pocket": {"default": "ruined_forest", "terrain": dict(_WET)}}


def row_rects(cells: set[tuple[int, int]]) -> list[list[int]]:
    """Run-length encode cells per row into inclusive [x0, y, x1, y] rects (row-major order)."""
    rects = []
    for y in sorted({y for _, y in cells}):
        xs = sorted(x for x, yy in cells if yy == y)
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            rects.append([start, y, prev, y])
            if x is not None:
                start = prev = x
    return rects

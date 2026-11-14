"""Encounter tables and zones of the act-1 overworld (T4 §1.6; layouts/overworld.py)."""
from __future__ import annotations

from common import Grid
from overworld_consts import ARRIVE, RX, RY, TEMPLE_DOOR, TOMB_END
from overworld_grid import bfs, walk_grid


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


def _components(cells: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    """4-connected components of `cells`, in row-major order of their first cell."""
    seen: set[tuple[int, int]] = set()
    out = []
    for start in sorted(cells, key=lambda p: (p[1], p[0])):
        if start in seen:
            continue
        comp, stack = {start}, [start]
        while stack:
            x, y = stack.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in cells and q not in comp:
                    comp.add(q)
                    stack.append(q)
        seen |= comp
        out.append(comp)
    return out


def encounter_zones(g: Grid) -> list[dict]:
    """`east_pocket`: what TOMB_END reaches with the east bridge closed. `temple_approach`: with the east bridge
    closed, the cells strictly closer on foot to the temple door than to the city; a cell that one of the two can't
    reach is infinitely far from it (revision 17), so cells neither reaches are in no zone. "The city" is the nearest
    of its four gate arrivals, not only the south one: from the south gate the north bridge foot is 21 steps round the
    walls but only 20 from the temple, and §1.6 keeps the north road to the bridge in the fields. W7: then each
    4-connected forest component (of the cells either reaches) with at least half its cells in the approach joins it
    whole, otherwise leaves whole, so the zone's edge never splits a forest (and its battle backdrop)."""
    ok = walk_grid(g)
    shut = {(RX, RY), (RX + 1, RY)}
    pocket = set(bfs(ok, TOMB_END, shut))
    to_temple = bfs(ok, TEMPLE_DOOR, shut)
    to_city: dict[tuple[int, int], int] = {}
    for gate in ("cornelia", "cornelia_west", "cornelia_east", "cornelia_north"):
        for p, d in bfs(ok, ARRIVE[gate], shut).items():
            to_city[p] = min(d, to_city.get(p, d))
    approach = {p for p, d in to_temple.items() if d < to_city.get(p, float("inf"))}
    forest = {p for p in set(to_temple) | set(to_city) if g[p[0], p[1]] == "f"}
    for comp in _components(forest):
        approach = approach | comp if 2 * len(comp & approach) >= len(comp) else approach - comp
    assert not pocket & approach and not pocket & set(to_city), "the east pocket is cut off by the east bridge"
    return [{"id": "east_pocket", "rects": row_rects(pocket), "encounters": EAST_POCKET},
            {"id": "temple_approach", "rects": row_rects(approach), "encounters": TEMPLE_APPROACH}]

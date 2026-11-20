"""Region ORDEAL's world-map data (docs/WORLD_PLAN.md 4.5; ORD-O): the encounter tables and zones, the hermit's
slate and `_deco`. Pass W's cell logic (the ground's named cells, entrances, doors, objects) retired at NW-5
(docs/NATURAL_WORLD_PLAN.md 3.6.1, 7): the NW world places ORDEAL's content in `ordeal/world_ordeal_nw.py`. Every line
of text here is original.
"""
from __future__ import annotations

import kit as K


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


def _t(*rows: tuple[int, list[dict]]) -> list[dict]:
    return [{"groups": groups, "weight": w} for w, groups in rows]


# 3.2 / 4.5: S18's heath, S19's isles, the north seas
HEATH = _t((4, [_g("weretiger", 1, 3)]), (3, [_g("nightmare", 1, 2)]), (2, [_g("rakshasa", 1, 2)]),
           (2, [_g("weretiger", 1, 2), _g("nightmare", 1)]))
ISLES = _t((4, [_g("wyvern", 1, 3)]), (3, [_g("basilisk", 1, 2)]), (2, [_g("wyrm", 1)]),
           (1, [_g("wyvern", 1, 2), _g("wyrm", 1)]))
SEA = _t((4, [_g("sahagin_prince", 2, 4)]), (3, [_g("white_shark", 1, 2)]), (2, [_g("deepeyes", 1, 3)]),
         (2, [_g("sea_snake", 1, 2)]))

# zone id -> (bestiary name, modes, table, battle backdrop of the zone)
ZONES = {
    "ord_heath": ("Citadel Heath", ["walking"], HEATH, {"default": "grassland", "terrain": {"forest": "forest"}}),
    "ord_isles": ("Cardia Isles", ["walking"], ISLES, {"default": "shoreline", "terrain": {"forest": "forest"}}),
    "ord_sea": ("Cardia Sound", ["ship"], SEA, {"default": "ocean"}),
}


HERMIT_TEXT = [
    "A hut of driftwood and whale rib, lashed shut with tarred rope. A slate hangs on the door:",
    "\"Gone fishing for the big one. If the dragons ask, I still owe them nothing. - Oddo\"",
]


def _deco(name: str, x: int, y: int, **kw) -> dict:
    return {"type": "deco", "name": name, "parts": K.landmark_parts(name), "x": x, "y": y, **kw}

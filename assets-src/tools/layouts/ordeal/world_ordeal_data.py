"""Region ORDEAL's data (docs/WORLD_PLAN.md 4.5; ORD-O): encounter tables and zones, the landmarks, the hermit's
inspect cell, the entrances and the doors.

The ground and the named cells are `world_ordeal_ground.py`'s. Every line of text here is original.
"""
from __future__ import annotations

import kit as K
from world_api import Cell
from world_ordeal_ground import CAVE, CITADEL, LANDINGS, TENT


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


def zone_of(ch: str, mass: str | None) -> str | None:
    """The zone of an ORDEAL cell: every water cell is the sound's, the walkable land its landmass's."""
    if ch == "o":
        return "ord_sea"
    if ch == "m" or mass is None:
        return None
    return "ord_heath" if mass == "plateau" else "ord_isles"


def zones(cells: dict[str, set[Cell]], row_rects) -> list[dict]:
    out = []
    for zid, (name, modes, table, _bg) in ZONES.items():
        if cells.get(zid):
            out.append({"id": zid, "name": name, "modes": modes, "rects": row_rects(cells[zid]), "encounters": table})
    return out


def backdrops() -> dict:
    return {z: bg for z, (_n, _m, _t, bg) in ZONES.items() if bg}


DOOR = (CITADEL[0] + 1, CITADEL[1] + 1)
CAVE_DOOR = (CAVE[0] + 1, CAVE[1] + 1)
ENTRANCES: dict[str, list[int]] = {
    "ord_citadel": [DOOR[0], DOOR[1] + 1], "ord_bahamut": [CAVE_DOOR[0], CAVE_DOOR[1] + 1],
    "ord_meadow": [DOOR[0], DOOR[1] + 5],              # the landing meadow below the gate (w_s18_start flies over it)
    **{f"ord_isle_{k}": list(v) for k, v in LANDINGS.items()},
}
TRANSITIONS = [{"x": DOOR[0], "y": DOOR[1], "targetMap": "citadel-1f", "targetEntrance": "arrival"},
               {"x": CAVE_DOOR[0], "y": CAVE_DOOR[1], "targetMap": "bahamut-cave", "targetEntrance": "arrival"}]
HERMIT_CELL = (TENT[0] + 1, TENT[1] + 1)
INSPECT = [{"x": HERMIT_CELL[0], "y": HERMIT_CELL[1], "text": [
    "A hut of driftwood and whale rib, lashed shut with tarred rope. A slate hangs on the door:",
    "\"Gone fishing for the big one. If the dragons ask, I still owe them nothing. - Oddo\"",
]}]


def _deco(name: str, x: int, y: int, **kw) -> dict:
    return {"type": "deco", "name": name, "parts": K.landmark_parts(name), "x": x, "y": y, **kw}


def objects() -> list[dict]:
    """The landmarks: the citadel's gate between two broken pillars, Bahamut's cave mouth, the hermit's hut, and a
    few boulders on the heath."""
    x, y = CITADEL
    out = [{"type": "deco", "name": "citadel", "parts": [["castle_icon_0_0", "castle_icon_0_1"],
                                                         ["castle_icon_1_0", "castle_icon_1_1"]],
            "x": x, "y": y, "style": "stone", "walk_cells": [[1, 1]]},
           {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": x - 1, "y": y},
           {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": x + 2, "y": y},
           _deco("cave_mouth", *CAVE, walk_cells=[[1, 1]]),
           _deco("tent", *TENT, style="dune", collide="alpha")]
    for bx, by in ((78, 38), (70, 33), (79, 15)):
        out.append({"type": "deco", "parts": [["boulder"]], "x": bx, "y": by, "collide": "alpha"})
    return out

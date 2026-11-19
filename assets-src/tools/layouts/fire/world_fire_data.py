"""Region FIRE's data (docs/WORLD_PLAN.md 4.4; FIR-O): encounter tables and zones, the hull's hatch, the landmarks.

The ground and the named cells are `world_fire_ground.py`'s; Crescent Lake's icon, gate and dock are FIR-T's
`town_crescent_site.py`. Every line of dialogue here is original.
"""
from __future__ import annotations

import kit as K
from world_fire_ground import AIRSHIP, HULL, ICE_MOUTH, ISLET, VOLCANO
from world_api import Cell


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


def _t(*rows: tuple[int, list[dict]]) -> list[dict]:
    return [{"groups": groups, "weight": w} for w, groups in rows]


# 3.2: S14 land and river, S15's ash, S16's frost, S17's dunes; the Aldi and the outer seas (4.4)
LAKESHORE = _t((4, [_g("ankheg", 1, 3)]), (3, [_g("ochu", 1, 2)]), (2, [_g("hydra", 1, 2)]),
               (2, [_g("ankheg", 1, 2), _g("ochu", 1)]), (1, [_g("neochu", 1)]))
ASHLANDS = _t((4, [_g("fire_lizard", 1, 2)]), (3, [_g("hellhound", 2, 4)]), (3, [_g("lava_worm", 1, 2)]),
              (2, [_g("hellhound", 1, 2), _g("fire_lizard", 1)]))
TUNDRA = _t((4, [_g("winter_wolf", 3, 5)]), (2, [_g("ice_gigas", 1)]), (2, [_g("winter_wolf", 2, 3), _g("ice_gigas", 1)]))
DESERT = _t((3, [_g("desert_baretta", 1, 2)]), (3, [_g("sand_worm", 1, 2)]), (2, [_g("sabertooth", 1, 3)]),
            (2, [_g("manticore", 1, 3)]), (2, [_g("basilisk", 1, 2)]), (2, [_g("baretta", 1, 2)]),
            (1, [_g("wyvern", 1, 2), _g("wyrm", 1)]), (1, [_g("allosaurus", 1)]))
RIVERS = _t((4, [_g("red_piranha", 2, 4)]), (3, [_g("crocodile", 1, 2)]), (1, [_g("white_crocodile", 1)]))
ALDI = _t((4, [_g("sahagin", 3, 5)]), (3, [_g("shark", 1, 2)]), (2, [_g("buccaneer", 2, 4)]), (1, [_g("bigeyes", 2, 4)]))
SEA = _t((4, [_g("sahagin_chief", 2, 4)]), (3, [_g("shark", 1, 3)]), (2, [_g("bigeyes", 3, 5)]))

# zone id -> (bestiary name, modes, table, battle backdrop of the zone)
ZONES = {
    "fir_lakeshore": ("Crescent Shore", ["walking"], LAKESHORE, None),
    "fir_ashlands": ("Ashlands", ["walking"], ASHLANDS, {"default": "desert"}),
    "fir_tundra": ("Frost Hollow", ["walking"], TUNDRA, {"terrain": {"forest": "forest"}}),
    "fir_desert": ("Hull Desert", ["walking"], DESERT, {"default": "desert"}),
    "fir_rivers": ("Crescent Waters", ["canoe"], RIVERS, {"default": "river"}),
    "fir_aldi": ("Aldi Sea", ["ship"], ALDI, {"default": "ocean"}),
    "fir_sea": ("Southern Seas", ["ship"], SEA, {"default": "ocean"}),
}


def zone_of(x: int, y: int, ch: str, south: bool) -> str | None:
    """The zone of a FIRE cell: water by basin, rivers and the lake, then the land by where it lies."""
    if ch == "o":
        return "fir_aldi" if y <= 145 and x <= 137 else "fir_sea"
    if ch in "r≈":
        return "fir_rivers"
    if ch == "m":
        return None
    if not south:
        return "fir_lakeshore"
    if x <= 131:
        return "fir_ashlands"
    if x <= 141 and y <= 153:
        return "fir_tundra"
    return "fir_desert"


def zones(cells: dict[str, set[Cell]], row_rects) -> list[dict]:
    out = []
    for zid, (name, modes, table, _bg) in ZONES.items():
        if cells.get(zid):
            out.append({"id": zid, "name": name, "modes": modes, "rects": row_rects(cells[zid]), "encounters": table})
    return out


def backdrops() -> dict:
    return {z: bg for z, (_n, _m, _t, bg) in ZONES.items() if bg}


# the smouldering ash vents by the volcano (damage 1 a step; the path from the river's sink to the mouth is clear)
VENTS = [(122, 157, 127, 159), (124, 164, 130, 167), (119, 171, 124, 174)]


def hazards(g, row_rects) -> list[dict]:
    """The vents' open ash cells (never a rock spur), as row rects."""
    cells = {(x, y) for x0, y0, x1, y1 in VENTS for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if g[y, x] == "s"}
    return [{"id": "fir_ash_vents", "damage": 1, "rects": row_rects(cells)}]


# the volcano's smoke (LM-INT): the approved icon has no smoke; the engine loops it from the crater, art px (26, 12)
# of the icon's top middle cell
SMOKE = [{"kind": "smoke", "x": VOLCANO[0] + 1, "y": VOLCANO[1], "ox": 26, "oy": 12}]


def _deco(name: str, x: int, y: int, **kw) -> dict:
    return {"type": "deco", "name": name, "parts": K.landmark_parts(name), "x": x, "y": y, **kw}


def objects(site) -> list[dict]:
    """The landmarks: Crescent Lake's icon (FIR-T may restyle it in its site file), the volcano, the ice cavern's
    mouth, the frozen pools of the hollow, the buried hull and the Circle's stones on the lake islet."""
    xs, ys = [c[0] for c in site.ICON], [c[1] for c in site.ICON]
    x0, y0 = min(xs), min(ys)
    door = [site.DOOR[0] - x0, site.DOOR[1] - y0]
    # LM4-INT: the approved Bedrock town icon `town_crescent` (3x3) over the whole ICON box, the door in its left
    # column (before, the walled-town icon's bottom row ringed by copses)
    icon = getattr(site, "ICON_PARTS", None) or K.landmark_parts("town_crescent")
    out = [{"type": "deco", "name": "crescent_icon", "parts": icon, "x": x0, "y": y0, "walk_cells": [door],
            "collide": "alpha"},
           _deco("volcano", *VOLCANO, walk_cells=[[1, 1]], collide="alpha"),
           _deco("cave_mouth", *ICE_MOUTH, walk_cells=[[1, 1]], style="snow"),
           _deco("ice_floe", 132, 151, collide="alpha"),
           _deco("buried_hull", *HULL, collide="alpha"),             # LM-INT: no dune, its sand turns orange
           _deco("standing_stones", *ISLET[0], collide="alpha")]    # LM4-INT: the Circle's stones (was the shrine)
    for x, y in ((124, 155), (128, 161), (121, 167), (152, 166)):
        out.append({"type": "deco", "parts": [["boulder"]], "x": x, "y": y, "collide": "alpha"})
    return out


HATCH = (HULL[0] + 1, HULL[1] + 2)
HULL_NPC = {
    "id": "fir_hull_hatch", "sprite": "chest", "tint": "#9a7a52", "x": HATCH[0], "y": HATCH[1],
    "requiredItem": "levistone", "hideIf": "AIRSHIP_RAISED",
    "cutscene": {"id": "fir_airship_rises", "onceFlag": "AIRSHIP_RAISED"},
    "dialog": [
        {"condition": "item:levistone",
         "text": ["The levistone hums against the hatch. Sand begins to trickle upward around the buried keel..."]},
        {"text": ["A brass hatch juts from the dune. Scratched beside the latch: \"She sleeps till the floatstone wakes her.\"",
                  "There is a socket beside it, shaped for a stone that weighs less than nothing."]},
    ],
}
AIRSHIP_CELL = AIRSHIP

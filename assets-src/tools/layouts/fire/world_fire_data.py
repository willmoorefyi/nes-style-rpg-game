"""Region FIRE's data (docs/WORLD_PLAN.md 4.4; FIR-O): the zones' cells, the vents, the landmarks and the hatch.

The ground and the named cells are `world_fire_ground.py`'s; Crescent Lake's icon, gate and dock are FIR-T's
`town_crescent_site.py`; the encounter tables, the zone records and the hatch's dialogue are `fire_tables.py`'s (shared
with the NW world, pass NW).
"""
from __future__ import annotations

import kit as K
from world_fire_ground import AIRSHIP, HULL, ICE_MOUTH, ISLET, VOLCANO
from world_api import Cell
from fire_tables import ZONES, backdrops, hull_npc, zones  # noqa: F401  (the shared tables, pass NW)


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
HULL_NPC = hull_npc(*HATCH)
AIRSHIP_CELL = AIRSHIP

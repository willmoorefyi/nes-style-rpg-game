"""The places of region EARTH on the world map (docs/WORLD_PLAN.md 2.2, 2.6, 2.9, 4.3; ERT-O): the landmark objects,
the entrances (anchors), the transitions into the site and town maps, the docks, the canal patch, the inspect cell,
the encounter zones and their tables, and the Aldi walls and the western range barrier as cell sets.

Melmond's icon, gate, door and harbour come from `town_melmond_site.py` (ERT-T's file, imported, never edited here).
"""
from __future__ import annotations

import town_melmond_site as MEL
from world_api import CANAL_PATCH, MOUNTAIN, SEAMS, WATER, Cell
import world_earth_ground as G

WALKABLE = frozenset(".,fs")


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


def _t(*rows: tuple[int, list[dict]]) -> list[dict]:
    return [{"groups": groups, "weight": w} for w, groups in rows]


# 3.2 rosters: S10 isthmus, S11 plain, S12-S13 badlands, Sarda's coast; the Aldi and the western sea (ship zones)
TABLES = {
    "ert_isthmus": _t((4, [_g("mummy", 2, 3)]), (3, [_g("wraith", 1, 3)]), (3, [_g("anaconda", 1, 2)]),
                      (2, [_g("mummy", 1, 2), _g("wraith", 1, 2)])),
    "ert_plain": _t((4, [_g("hyenadon", 1, 3)]), (3, [_g("lesser_tiger", 1, 2)]), (3, [_g("anaconda", 2, 3)]),
                    (2, [_g("troll", 1, 2), _g("hyenadon", 0, 1)])),
    "ert_badlands": _t((4, [_g("ogre_mage", 1, 2)]), (3, [_g("sphinx", 1)]), (2, [_g("earth_elemental", 1)]),
                       (2, [_g("hill_gigas", 1)]), (3, [_g("wight", 2, 4)])),
    "ert_sarda_coast": _t((4, [_g("ogre_mage", 1, 3)]), (3, [_g("sphinx", 1, 2)])),
    "ert_aldi": _t((4, [_g("sahagin", 3, 5)]), (3, [_g("shark", 1, 2)]), (2, [_g("buccaneer", 2, 4)]),
                   (1, [_g("bigeyes", 2, 4)])),
    "ert_sea": _t((4, [_g("sahagin_chief", 2, 4)]), (3, [_g("shark", 1, 3)]), (3, [_g("buccaneer", 3, 5)])),
}
NAMES = {"ert_isthmus": "Duergar Isthmus", "ert_plain": "Melmond Plain", "ert_badlands": "Grey Badlands",
         "ert_sarda_coast": "Sarda's Coast", "ert_aldi": "Aldi Sea", "ert_sea": "Western Sea"}
BACKDROPS = {"ert_badlands": {"default": "cracked_earth"}}

SHRINE_TEXT = ["A shrine to the earth, its roof fallen in. Grey roots have split the altar stone.",
               "Someone has scratched a line under the carved crystal: \"It will wake again.\""]


def _mouth(at: Cell, door: int, block: bool = True) -> dict:
    """A 2x2 cave mouth; `door` 0 or 1 is the column of its walkable bottom-row cell."""
    import kit  # noqa: PLC0415  (the placeholder landmark names)
    return {"type": "deco", "parts": kit.landmark_parts("cave_mouth"), "x": at[0], "y": at[1],
            "walk_cells": [[door, 1]], **({} if block else {"collide": "alpha"})}


def objects() -> list[dict]:
    import kit  # noqa: PLC0415
    icon_x, icon_y = min(MEL.ICON)
    door = [MEL.DOOR[0] - icon_x, MEL.DOOR[1] - icon_y]
    return [
        _mouth(G.HALL_MOUTH, 1), _mouth(G.GIANT_EAST_MOUTH, 0), _mouth(G.GIANT_WEST_MOUTH, 1),
        _mouth(G.SAGE_MOUTH, 1), _mouth(G.CAVE_MOUTH, 0),
        # Melmond's icon: a placeholder farmhouse from the town kit, its door the icon's DOOR cell
        {"type": "deco", "parts": [["roof_ridge_l", "roof_ridge_m", "roof_ridge_r"],
                                   ["wall_up_l", "wall_up_window", "wall_door_top"],
                                   ["wall_lo_l", "wall_lo_plain", "wall_lo_r"]],
         "x": icon_x, "y": icon_y, "walk_cells": [door]},
        {"type": "deco", "parts": kit.landmark_parts("windmill"), "x": G.WINDMILL[0], "y": G.WINDMILL[1],
         "style": "pale_dune", "collide": "alpha"},
        {"type": "deco", "parts": kit.landmark_parts("shrine"), "x": G.SHRINE[0], "y": G.SHRINE[1], "style": "snow"},
        {"type": "deco", "parts": kit.landmark_parts("dock_post"), "x": G.DOCK_POST[0], "y": G.DOCK_POST[1],
         "collide": "alpha"},
    ]


ENTRANCES = {"ert_dwarf": G.HALL_GATE, MEL.ANCHOR: MEL.GATE, "ert_earth_cave": G.CAVE_GATE, "ert_giant": G.GIANT_EAST,
             "ert_giant_west": G.GIANT_WEST, "ert_sarda": G.SAGE_GATE}


def transitions() -> list[dict]:
    rows = [(G.HALL_DOOR, "dwarf-hall", "arrival"), (MEL.DOOR, MEL.TOWN, "gate"),
            (G.CAVE_DOOR, "cavern-earth-b1", "arrival"), (G.GIANT_EAST_DOOR, "giant-tunnel", "arrival"),
            (G.GIANT_WEST_DOOR, "giant-tunnel", "west"), (G.SAGE_DOOR, "sage-cave", "arrival")]
    return [{"x": x, "y": y, "targetMap": m, "targetEntrance": e} for (x, y), m, e in rows]


def docks() -> list[dict]:
    return [{"id": "ert_dwarf", "x": G.DWARF_DOCK[0], "y": G.DWARF_DOCK[1], "basin": "aldi"}, dict(MEL.DOCK)]


def canal() -> dict:
    """2.6: the patch `canal` (CANAL_OPEN) turns the saddle into Water, joining the Aldi to the strait."""
    cells = [[x, y] for y in G.CANAL_ROWS for x in range(G.ISTHMUS_X[0], G.ISTHMUS_X[1] + 1)]
    return {"id": CANAL_PATCH, "flag": "CANAL_OPEN", "ground": WATER, "cells": cells}


def inspect() -> list[dict]:
    x, y = G.SHRINE
    return [{"x": x + i, "y": y + 1, "text": list(SHRINE_TEXT)} for i in (0, 1)]


def _row_rects(cells: set[Cell]) -> list[list[int]]:
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


def _flood(cells: set[Cell], seed: Cell) -> set[Cell]:
    seen, stack = {seed}, [seed]
    while stack:
        x, y = stack.pop()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n in cells and n not in seen:
                seen.add(n)
                stack.append(n)
    return seen


def zones(g: dict[Cell, str], band: set[Cell], box: set[Cell]) -> list[dict]:
    """4.0.3: every walkable cell of the box in one walking zone, every Water cell in one ship zone (band cells of
    the box included: the bands are ocean, `seam_n`'s EARTH rows grass)."""
    seam = {c for s in SEAMS.values() for c in s.rect.cells()}
    walk = {c for c, ch in g.items() if ch in WALKABLE}
    seam_walk = {c for c in SEAMS["seam_n"].rect.cells() if c in box}       # its EARTH rows, y 110-111
    water = {c for c, ch in g.items() if ch == WATER} | {c for c in band if c in box and c not in seam}
    aldi = _flood(water, (62, 100))
    isthmus = {c for c in walk if c[0] >= 48} | seam_walk
    sarda = {c for c in walk if c[0] <= 23}
    bad = {c for c in walk - isthmus - sarda if c[1] >= G.BADLANDS_Y}
    plain = walk - isthmus - sarda - bad
    sets = [("ert_isthmus", isthmus, None), ("ert_plain", plain, None), ("ert_badlands", bad, None),
            ("ert_sarda_coast", sarda, None), ("ert_aldi", aldi, ["ship"]), ("ert_sea", water - aldi, ["ship"])]
    out = []
    for zid, cells, modes in sets:
        z = {"id": zid, "name": NAMES[zid], "rects": _row_rects(cells), "encounters": TABLES[zid]}
        if modes:
            z["modes"] = modes
        out.append(z)
    return out


def walls(g: dict[Cell, str]) -> dict[str, set[Cell]]:
    """2.6: EARTH's parts of W_west (the hogback north of the canal strip) and W_isthmus (the strip and the downs
    to seam_n), every non-water cell of the isthmus columns."""
    land = {c for c, ch in g.items() if ch != WATER and 48 <= c[0] <= 61}
    return {"W_west": {c for c in land if 76 <= c[1] <= 87}, "W_isthmus": {c for c in land if 88 <= c[1] <= 109}}


def barriers(g: dict[Cell, str]) -> dict[str, tuple[set[Cell], Cell, Cell]]:
    """2.9 / GT-35: the western range, from Melmond's plain (side a) to Sarda's coast (side b)."""
    cells = {c for c, ch in g.items() if ch == MOUNTAIN and G.RANGE_X[0] <= c[0] <= G.RANGE_X[1]}
    return {"western_range": (cells, (36, 100), (18, 100))}

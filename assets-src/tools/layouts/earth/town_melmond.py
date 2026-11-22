"""Melmond, the farming town on the western continent's east coast (docs/WORLD_PLAN.md 4.0.1, 4.3; ERT-T) ->
assets-src/maps/melmond.yaml.

  python3 -I assets-src/tools/layouts/earth/town_melmond.py && python3 -I assets-src/tools/build_map.py melmond

An original layout. The town lies in a fold of grey hills that runs down to the strait; the harbour road comes in over
the stone quay on the east shore and crosses the town through the green, where the great dead oak stands over the dry
well. The shops line the harbour road; the homes stand on the hill lane (north) and the field lane (south). Fenced
plots of withered crops fill the west and south, a vineyard of grey vines climbs the north-west slope, the crooked
windmill leans on its mound in the north-east and the millpond has shrunk to a small pool. The patch
`ert_melmond_bloom` (flag EARTH_CRYSTAL_LIT) turns the plots and the green's lawn to grass, with fresh crops and
flowers, once the Earth crystal is lit (art only: those cells walk before and after).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
sys.path.insert(2, str(Path(__file__).resolve().parents[2]))
from common import Grid, write_map  # noqa: E402
from build_map import footprint  # noqa: E402
from town_common import Outdoor  # noqa: E402
import town_theme as THEME  # noqa: E402
import town_melmond_people as P  # noqa: E402

W, H = 46, 42
LANE = (19, 20)                                  # the harbour road's two rows
HILL_LANE, FIELD_LANE = 12, 30                   # the one-row lanes north and south of it
GATE = (43, 19)                                  # the arrival from the overworld, on the quay
EXIT = [(45, y) for y in LANE]                   # the quay's end: back to the overworld (ert_melmond)
BLOOM = "ert_melmond_bloom"
GREEN = (17, 14, 28, 24)                         # the green: a cobble ring round a lawn of dead ground
# the fenced plots (inclusive rects inside their fences)
PLOTS = [(11, 22, 14, 27), (4, 33, 12, 37), (16, 34, 19, 37), (30, 34, 37, 37)]
VINE_ROWS, VINE_X = (3, 5), (4, 15)              # the vineyard on the north-west slope: two rows of grey vines
DEAD = "stone"                                   # the grey recolour of the dying plants (build_map.RECOLOR)
NOTE = """Concept: a farming town dying from the root up, in a fold of grey hills on the strait: the harbour road from the
quay through a cracked green, fenced plots of withered crops, a vineyard of grey vines, a crooked windmill.
Distinct: a stone quay running out into the strait as the only way in; the great dead oak on the green with the
dry well at its foot; the millpond shrunk to a small pool among withered reeds; grey vine rows on the north-west
slope; a shut-up farmstead with a farewell note tacked to its wall; the plots and the green turn green with fresh crops when the Earth crystal is lit.
Topology: one outdoor map, the quay (gate) in the east -> harbour road -> green; 5 houses with interiors (unne,
miller, vintner, ploughman, healer), the shut-up farmstead, 5 shops and the inn open off three lanes; no stairs."""

g = Grid(W, H, ",")                              # cracked dirt everywhere: the town's dead ground


def coast(y: int) -> int:
    """The first ocean column of row y: the strait's shore bends east round the quay."""
    return 42 if y < 8 else 43 if y < 16 else 44 if y < 24 else 43 if y < 33 else 42


for y in range(H):
    c = coast(y)
    g.rect(c - 2, y, c - 1, y, "s")              # the shingle beach
    g.rect(c, y, W - 1, y, "o")                  # the strait
# the grey hills: north, west and south, their inner foot ragged
g.rect(0, 0, 41, 1, "m", only=",s")
g.rect(0, 0, 1, H - 1, "m")
g.rect(0, 40, 41, H - 1, "m", only=",s")
for (x0, y0, x1, y1) in [(2, 2, 9, 2), (2, 2, 2, 11), (17, 2, 19, 2), (24, 2, 25, 2), (30, 2, 35, 2), (36, 2, 39, 3),
                         (2, 14, 2, 18), (2, 22, 2, 26), (2, 31, 2, 39), (2, 39, 39, 39), (3, 38, 3, 39), (25, 38, 28, 38),
                         (20, 39, 22, 39), (26, 39, 29, 39), (38, 39, 39, 39), (33, 38, 34, 39)]:
    g.rect(x0, y0, x1, y1, "m", only=",")

# lanes (cobble): the harbour road over the quay, the hill and field lanes, the west lane, the green and its spurs
g.rect(3, LANE[0], W - 1, LANE[1], ":")
x0, y0, x1, y1 = GREEN
for (x, y) in [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]:
    if x in (x0, x1) or y in (y0, y1):
        g.set(x, y, ":")
for (x, y) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
    g.set(x, y, ",")                             # the ring's corners rounded off
g.rect(3, HILL_LANE, 37, HILL_LANE, ":")
g.rect(22, HILL_LANE + 1, 23, y0, ":")           # hill lane -> green
g.rect(3, FIELD_LANE, 39, FIELD_LANE, ":")
g.rect(22, y1, 23, FIELD_LANE - 1, ":")          # green -> field lane
g.rect(3, HILL_LANE, 3, FIELD_LANE, ":")         # the west lane joins the three
g.rect(37, 6, 37, HILL_LANE - 1, ":")            # the mill track up to the windmill's mound
g.rect(14, 31, 14, 32, ":")                      # the field gate between the south plots
# the millpond, shrunk to a small pool
g.rect(24, 34, 26, 36, "~")
LAWN = [(x, y) for y in range(y0 + 1, y1) for x in range(x0 + 1, x1) if g[x, y] == ","]

town = Outdoor()
obj, deco = town.obj, town.deco
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])


def dead_oak(x: int, y: int) -> None:            # (x, y) its crown's top-left; the crown row is walkable
    deco([["oak_0_0", "oak_0_1"], ["oak_1_0", "oak_1_1"], ["oak_2_0", "oak_2_1"]], x, y, above_rows=1, style=DEAD)


def dead_fir(x: int, y: int) -> None:            # (x, y) the trunk; the crown is the cell above
    deco([["tree_crown"], ["tree_trunk"]], x, y - 1, above_rows=1, style=DEAD)


def vine(x: int, y: int) -> None:
    deco([["hedge"]], x, y, style=DEAD)


# ── the harbour road: four shops face it from the north; the item shop, the inn and the healer face the field lane ──
obj(**HOUSE, name="weapon_shop", x=30, y=14, h=5, storeys=2, roof="brown", wall="plaster", sign="weapon",
    enter={"map": "melmond-weapon-shop", "entrance": "door"})
obj(**HOUSE, name="armor_shop", x=36, y=14, h=5, storeys=2, roof="red", wall="ochre", sign="armor",
    enter={"map": "melmond-armor-shop", "entrance": "door"})
obj(**HOUSE, name="white_magic", x=5, y=14, h=5, storeys=2, roof="blue", wall="white", sign="white_magic",
    enter={"map": "melmond-white-magic", "entrance": "door"})
obj(**HOUSE, name="black_magic", x=11, y=14, h=5, storeys=2, roof="slate", wall="stone", sign="black_magic",
    enter={"map": "melmond-black-magic", "entrance": "door"})
obj(**HOUSE, name="item_shop", x=30, y=26, h=4, roof="teal", wall="ochre", sign="item", chimney=3,
    enter={"map": "melmond-item-shop", "entrance": "door"})
obj(type="prefab", prefab="inn", name="inn", x=16, y=25, w=4, h=5, door=2, sign="inn",
    enter={"map": "melmond-inn", "entrance": "door"})

# ── homes: the hill lane (north) and the field lane (south) ──
HOMES = [  # (slug, x, y, h, storeys, roof, wall, chimney, sign)
    ("vintner", 5, 8, 4, 1, "brown", "ochre", 1, None), ("unne", 19, 7, 5, 2, "slate", "stone", 3, None),
    ("miller", 31, 8, 4, 1, "red", "plaster", 3, None), ("ploughman", 5, 26, 4, 1, "brown", "plaster", None, None),
    ("healer", 35, 25, 5, 2, "red", "white", None, "shrine")]
for (slug, x, y, h, st, roof, wall, ch, sign) in HOMES:
    obj(**HOUSE, name=f"house_{slug}", x=x, y=y, h=h, storeys=st, roof=roof, wall=wall,
        **({"sign": sign} if sign else {}), **({"chimney": ch} if ch is not None else {}),
        enter={"map": f"melmond-house-{slug}", "entrance": "door"})
BOARDED = dict(x=12, y=8, h=4)                   # the shut-up farmstead: no door, a note (inspect) on its front
obj(type="house", w=5, windows=[1, 3], roof="brown", wall="rose", **BOARDED)

# ── the green: the great dead oak, the dry well, an empty stall, benches, the signpost ──
dead_oak(19, 15)
obj(type="well", x=21, y=17)
deco([["stall_0_0", "stall_0_1"], ["stall_1_0", "stall_1_1"]], 25, 21, style=DEAD)
for x in (31, 32):
    obj(type="bench", x=x, y=23)
SIGNPOST = (27, 18)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
for (x, y, t) in [(29, 17, "barrel"), (29, 18, "crate"), (24, 25, "barrel")]:
    obj(type=t, x=x, y=y)
for (x, y) in [(8, 21), (16, 21), (29, 21), (35, 21)]:         # lamps along the harbour road's south side
    deco([["lamp_top"], ["lamp_bottom"]], x, y, above_rows=1)

# ── the windmill on its mound: one whole deco (QF: the old per-row east offsets sheared the art into visible
# horizontal breaks); it blocks where its art is. No above rows: its top row stands on the hill rock (36-39, 2-3),
# where no hero walks, so there is nothing to pass behind ──
MILL = (37, 3)
deco([[f"windmill_icon_{r}_{c}" for c in range(2)] for r in range(3)], MILL[0], MILL[1], style=DEAD, collide="alpha")
for (x, y, t) in [(36, 7, "crate"), (38, 7, "crate"), (38, 8, "barrel"), (34, 13, "crate")]:
    obj(type=t, x=x, y=y)

# ── the quay: crates and barrels waiting for a cargo ──
for (x, y, t) in [(42, 17, "crate"), (43, 17, "barrel"), (42, 22, "barrel"), (43, 23, "crate")]:
    obj(type=t, x=x, y=y)

# ── the vineyard (grey vine rows), the plots (fences round withered crops) ──
for y in VINE_ROWS:
    for x in range(VINE_X[0], VINE_X[1] + 1):
        if x not in (9, 10):                     # a gap down the middle of each row
            vine(x, y)
for (px0, py0, px1, py1) in PLOTS:
    mid = (py0 + py1) // 2
    obj(type="fence", **{"from": [px0 - 1, py0 - 1], "to": [px1 + 1, py0 - 1]})
    obj(type="fence", **{"from": [px0 - 1, py1 + 1], "to": [px1 + 1, py1 + 1]})
    obj(type="fence", **{"from": [px0 - 1, py0], "to": [px0 - 1, py1]})
    obj(type="fence", **{"from": [px1 + 1, py0], "to": [px1 + 1, mid - 1]})     # a gap in the east fence
    obj(type="fence", **{"from": [px1 + 1, mid + 1], "to": [px1 + 1, py1]})
PLOT_CELLS = sorted({(x, y) for (px0, py0, px1, py1) in PLOTS for y in range(py0, py1 + 1) for x in range(px0, px1 + 1)})
CROP_ROWS = sorted({(x, y) for (px0, py0, px1, py1) in PLOTS for y in range(py0, py1 + 1, 2) for x in range(px0, px1 + 1)})
for (x, y) in CROP_ROWS:
    deco([["crops"]], x, y, style=DEAD, block=False)

# ── dead trees, grey bushes, the millpond's withered reeds ──
for (x, y) in [(26, 3), (26, 7), (16, 3)]:
    dead_oak(x, y)
for (x, y) in [(29, 5), (29, 9), (11, 7), (39, 37), (21, 38), (4, 31), (39, 33), (39, 10)]:
    dead_fir(x, y)
for (x, y) in [(22, 33), (28, 33), (22, 37), (28, 37), (10, 13), (16, 13), (34, 24), (40, 26), (4, 23), (28, 13)]:
    deco([["bush"]], x, y, style=DEAD)

INSPECT = [
    {"x": BOARDED["x"] + 2, "y": BOARDED["y"] + BOARDED["h"] - 1, "text": P.BOARDED_TEXT},
    {"x": SIGNPOST[0], "y": SIGNPOST[1], "text": P.SIGNPOST_TEXT},
]

# ── the bloom (EARTH_CRYSTAL_LIT): the plots and the lawn turn to grass, fresh crops replace the withered ones and
# flowers come up on the lawn. Art only: every cell of the patch is walkable before and after (the crops never block).
# a base object touching a patch cell is left out of the patched compile (build_hooks.bake_patches): the lawn keeps
# clear of every object's footprint (crowns and lamp heads included); only the withered crops are meant to go
_taken = {c for o in town.objects if not (o["type"] == "deco" and o["parts"] == [["crops"]]) for c in footprint(o)}
BLOOM_CELLS = sorted(set(PLOT_CELLS) | {c for c in LAWN if c not in _taken})
FLOWERS = [(20, 19), (21, 20), (24, 15), (26, 19), (18, 21), (23, 22)]
PATCH = {"id": BLOOM, "flag": P.LIT, "ground": ".", "cells": [list(c) for c in BLOOM_CELLS],
         "objects": [{"type": "deco", "parts": [["crops"]], "x": x, "y": y, "block": False} for (x, y) in CROP_ROWS]
         + [{"type": "flowers", "x": x, "y": y} for (x, y) in FLOWERS]}

doc = {
    "id": "melmond",
    "name": "Melmond",
    "kits": ["town", "castle", "overworld"],
    "music": "town",
    "materials": {"dirt": {"from": "dirt", "sat": 0.45, "shade": 0.9}},
    "entrances": {"gate": list(GATE)},
    "objects": town.objects,
    "npcs": P.outdoor(),
    "inspect": INSPECT,
    "transitions": [{"x": x, "y": y, "targetMap": "overworld", "targetEntrance": "ert_melmond"} for (x, y) in EXIT],
    "patches": [PATCH],
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "canSave": True,
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
}
HEADER = f"""GENERATED by assets-src/tools/layouts/earth/town_melmond.py - edit the script, not this file.
{NOTE}
ground legend: , cracked dirt  : cobble  ~ water (the millpond)  s shingle  o the strait  m grey hills"""

THEME.apply(doc, "melmond", g)               # AR-W2: the approved town theme (docs/TOWN_THEMES.md)
if __name__ == "__main__":
    print(write_map("melmond", HEADER, doc, g.text()))

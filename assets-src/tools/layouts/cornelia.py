"""Cornelia: the walled royal city (castle precinct in the north, town in the south) -> assets-src/maps/cornelia.yaml.

  python3 -I assets-src/tools/layouts/cornelia.py && python3 -I assets-src/tools/build_map.py cornelia

An original layout. One outer wall with bends and bastions wraps both the castle and the town; a river comes in under
the north wall, fills the castle moat and winds through the town to leave under the south wall. Gates: the south
gate (main road), west and east gates, the castle precinct's east gate and a north postern by the royal orchard. An
inner wall with a gatehouse separates the castle gardens from the town.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Grid, polygon_mask, ring, write_map  # noqa: E402

W, H = 62, 72
CX = 30                                          # the castle door column: the grand axis of the city

g = Grid(W, H, ".")
objects: list[dict] = []


def obj(**o):
    objects.append(o)


def deco(parts, x, y, **kw):
    obj(type="deco", parts=parts, x=x, y=y, **kw)


def oak(x, y):                                   # 2x3 broadleaf tree; (x, y) is its top-left (crown row walkable)
    deco([["oak_0_0", "oak_0_1"], ["oak_1_0", "oak_1_1"], ["oak_2_0", "oak_2_1"]], x, y, above_rows=1)


def lamp(x, y):                                  # (x, y) is the lamp head (walkable, drawn over characters)
    deco([["lamp_top"], ["lamp_bottom"]], x, y, above_rows=1)


def fir(x, y):                                   # (x, y) is the trunk; the crown is the cell above
    obj(type="tree", x=x, y=y)


def win(x, y):
    return {"parts": [["arch_window_top"], ["arch_window_bottom"]], "x": x, "y": y}


def flag(x, y):
    return {"parts": [["flag_top"], ["flag_bottom"]], "x": x, "y": y}


TURRET = [["tower_0_0", "tower_0_1"], ["tower_1_0", "tower_1_1"], ["tower_2_0", "tower_2_1"]]

# ── outer wall: a bent ring with bastions, 2 cells thick ──
OUTLINE = [(5, 2), (54, 2), (58, 6), (58, 27), (55, 30), (55, 35), (58, 38), (58, 54), (54, 60), (47, 65), (35, 68),
           (25, 68), (13, 64), (6, 58), (3, 49), (3, 38), (6, 33), (6, 28), (3, 24), (3, 6)]
inside = polygon_mask(W, H, OUTLINE)
walls = ring(inside, 2)
for (x, y) in walls:
    g.set(x, y, "#")
# inner wall between the castle gardens and the town: a shallow chevron pointing south at the gatehouse
INNER = [(3, 29), (16, 29), (21, 31), (39, 31), (44, 29), (58, 29)]
walls |= set(g.line(INNER, "#", 2))

# ── water: in under the north wall, round the moat, then winding through the town and out under the south wall ──
water = g.line([(51, 0), (51, 20)], "~", 2)
water += g.line([(9, 20), (52, 20)], "~", 2)                                    # the moat
water += g.line([(9, 20), (9, 34), (10, 37), (14, 40), (17, 43), (17, 48), (21, 52), (32, 53), (37, 55), (39, 59),
                 (39, H - 1)], "~", 2)
for (x, y) in set(water) & walls:
    g.set(x, y, "u")                                                           # arched culverts under the walls
g.rect(6, 56, 10, 58, "~")                                                     # lily pond in the magic quarter

# ── streets (drawn over grass only; bridges below where they cross water) ──
ST = ".,"
g.rect(10, 19, 50, 19, ":", only=".")            # castle apron
g.rect(CX - 1, 19, CX + 1, 30, ":", only=ST)     # promenade through the gardens
g.rect(CX - 1, 33, CX + 1, H - 1, ":", only=ST)  # the high street to the south gate
g.rect(21, 38, 39, 48, ":", only=ST)             # market square, corners rounded off
for (x, y) in [(21, 38), (22, 38), (21, 39), (39, 38), (38, 38), (39, 39), (21, 48), (22, 48), (21, 47), (39, 48),
               (38, 48), (39, 47)]:
    g.set(x, y, ".")
g.rect(0, 44, 20, 45, ":", only=ST)              # west road
g.rect(40, 44, W - 1, 45, ":", only=ST)          # east road
g.rect(11, 25, 27, 25, ":", only=ST)             # garden walks
g.rect(33, 25, 54, 25, ":", only=ST)
g.rect(4, 25, 8, 25, ":", only=ST)
g.rect(55, 24, W - 1, 25, ":", only=ST)          # the castle precinct's east gate
g.rect(6, 0, 7, 9, ",", only=ST + "#")           # north postern and the orchard track
g.rect(7, 46, 8, 54, ":", only=ST)               # lane down to the magic quarter
g.rect(4, 54, 16, 54, ":", only=ST)
g.rect(23, 60, CX - 2, 60, ":", only=ST)         # lane to the inn
g.rect(42, 46, 43, 51, ":", only=ST)             # east quarter lanes
g.rect(44, 51, 53, 51, ":", only=ST)
g.rect(33, 56, 37, 56, ",", only=".")            # dirt paths through the orchard
g.rect(41, 60, 52, 60, ",", only=".")
for (x0, y0, x1, y1) in [(CX - 1, 20, CX + 1, 21), (17, 44, 18, 45), (CX - 1, 52, CX + 1, 54), (9, 25, 10, 25),
                         (39, 60, 40, 60)]:
    g.rect(x0, y0, x1, y1, "=", only="~")
for (x0, y0, x1, y1) in [(CX - 1, 66, CX + 1, H - 1), (0, 44, 3, 45), (56, 44, W - 1, 45), (56, 24, W - 1, 25),
                         (CX - 1, 31, CX + 1, 32)]:
    g.rect(x0, y0, x1, y1, ":", only="#.")       # gate passages through the walls

# ── the castle: a keep with a central tower, two wings and two tall end towers ──
obj(type="facade", name="castle", x=CX - 7, y=5, w=15,
    bands=[{"kind": "roof", "rows": 2, "ridge": 1, "x": 4, "w": 7}, {"kind": "wall", "rows": 2, "x": 4, "w": 7},
           {"kind": "roof", "rows": 3}, {"kind": "wall", "rows": 3}, {"kind": "battlement", "rows": 1},
           {"kind": "wall", "rows": 3}],
    parts=[win(5, 2), win(9, 2), flag(7, 2),
           {"parts": TURRET, "x": 0, "y": 4}, {"parts": TURRET, "x": 13, "y": 4},
           *[win(c, 7) for c in (2, 4, 10, 12)], flag(7, 7),
           {"parts": [["gate_0_0", "gate_0_1", "gate_0_2"], ["gate_1_0", "gate_1_1", "gate_1_2"],
                      ["gate_2_0", "gate_2_1", "gate_2_2"]], "x": 6, "y": 11, "match": "castle_face"},
           {"parts": TURRET, "x": 3, "y": 11}, {"parts": TURRET, "x": 10, "y": 11},
           flag(1, 11), flag(13, 11)],
    door=[7, 13], enter={"map": "cornelia-castle", "entrance": "gate"})
for x0 in (CX - 17, CX + 8):                     # wings
    obj(type="facade", x=x0, y=10, w=10,
        bands=[{"kind": "roof", "rows": 3, "ridge": 1}, {"kind": "wall", "rows": 3}, {"kind": "battlement", "rows": 1},
               {"kind": "wall", "rows": 2}],
        parts=[*[win(c, 3) for c in (1, 4, 7)], *[{"parts": [["banner"]], "x": c, "y": 7} for c in (2, 5, 8)]])
for x0 in (CX - 20, CX + 18):                    # end towers
    obj(type="facade", x=x0, y=7, w=3,
        bands=[{"kind": "roof", "rows": 2, "ridge": 1}, {"kind": "wall", "rows": 5}, {"kind": "battlement", "rows": 1},
               {"kind": "wall", "rows": 4}],
        parts=[win(1, 3), win(1, 9)])

# ── castle gardens (between the moat and the inner wall) ──
for x in (CX - 2, CX + 2):
    deco([["urn"]], x, 22)
    for y in (24, 27):
        deco([["topiary"]], x, y)
for fx in (19, 40):
    obj(type="fountain", x=fx, y=23)
    deco([["stone_bench"]], fx, 27)
    deco([["stone_bench"]], fx + 1, 27)
    for x in range(fx - 3, fx + 5):
        if x not in (fx, fx + 1):
            obj(type="flowers", x=x, y=22)
for x in list(range(13, 17)) + list(range(23, 27)) + list(range(34, 38)) + list(range(44, 48)):
    obj(type="bush", x=x, y=27)
for (x, y) in [(12, 22), (47, 22), (25, 22), (34, 22)]:
    oak(x, y)
# the royal orchard by the north postern, and a quiet garden east of the river
for (x, y) in [(3, 5), (3, 11), (3, 16)]:
    oak(x, y)
for (x, y) in [(5, 14), (8, 14), (9, 4), (9, 7), (8, 18)]:
    fir(x, y)
for (x, y) in [(4, 20), (5, 20), (6, 20), (4, 21), (5, 21), (6, 21)]:
    deco([["crops"]], x, y)
obj(type="fence", **{"from": [3, 19], "to": [7, 19]})
obj(type="well", x=7, y=22)
for (x, y) in [(53, 14), (55, 15), (56, 12)]:
    obj(type="flowers", x=x, y=y)
deco([["stone_bench"]], 54, 16)
obj(type="bush", x=56, y=9)
fir(54, 7)
fir(56, 22)
oak(53, 3)

# ── town: shops ──
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])
obj(**HOUSE, name="weapon_shop", x=20, y=33, h=5, storeys=2, roof="red", wall="plaster", sign="weapon",
    enter={"map": "cornelia-weapon-shop", "entrance": "door"})
obj(**HOUSE, name="armor_shop", x=36, y=33, h=5, storeys=2, roof="brown", wall="plaster", sign="armor",
    enter={"map": "cornelia-armor-shop", "entrance": "door"})
obj(**HOUSE, name="item_shop", x=42, y=40, h=4, roof="teal", wall="ochre", sign="item", chimney=3,
    enter={"map": "cornelia-item-shop", "entrance": "door"})
obj(**HOUSE, name="white_magic", x=4, y=49, h=5, storeys=2, roof="blue", wall="white", sign="white_magic",
    enter={"map": "cornelia-white-magic", "entrance": "door"})
obj(**HOUSE, name="black_magic", x=11, y=49, h=5, storeys=2, roof="slate", wall="stone", sign="black_magic",
    enter={"map": "cornelia-black-magic", "entrance": "door"})
obj(type="prefab", prefab="inn", name="inn", x=22, y=55, w=4, h=5, door=2, sign="inn",
    enter={"map": "cornelia-inn", "entrance": "door"})

# ── town: houses (not entered) ──
for (x, y, h, st, roof, wall, ch) in [
        (44, 32, 5, 2, "blue", "plaster", 1), (50, 34, 4, 1, "green", "white", None), (48, 46, 4, 1, "red", "ochre", 3),
        (42, 52, 5, 2, "slate", "white", 3), (48, 53, 4, 1, "brown", "rose", None), (13, 33, 4, 1, "green", "plaster", 1),
        (12, 60, 4, 1, "red", "white", None), (4, 38, 4, 1, "teal", "plaster", 3), (44, 57, 4, 1, "blue", "ochre", 1),
        (33, 58, 5, 2, "red", "stone", None)]:
    obj(**HOUSE, x=x, y=y, h=h, storeys=st, roof=roof, wall=wall, **({"chimney": ch} if ch is not None else {}))

# ── town: the market square ──
deco([["statue_top"], ["statue_bottom"]], CX, 42)
for x in (CX - 1, CX + 1):
    obj(type="flowers", x=x, y=43)
obj(type="fountain", x=24, y=42)
obj(type="fountain", x=35, y=42)
STALL = [["stall_0_0", "stall_0_1"], ["stall_1_0", "stall_1_1"]]
for (x, y) in [(23, 39), (26, 39), (33, 39), (36, 39), (23, 46), (36, 46)]:
    deco(STALL, x, y)
for (x, y) in [(CX - 2, 34), (CX + 2, 34), (CX - 2, 50), (CX + 2, 50), (CX - 2, 57), (CX + 2, 57), (CX - 2, 64),
               (CX + 2, 64), (19, 42), (41, 42)]:
    lamp(x, y)
for x in (27, 33):
    obj(type="bench", x=x, y=48)
for (x, y) in [(28, 39), (32, 39), (22, 41), (38, 41)]:
    obj(type="barrel" if x % 2 else "crate", x=x, y=y)
for (x, y) in [(21, 41), (39, 41), (21, 45), (39, 45)]:
    deco([["topiary"]], x, y)

# ── town: gardens, trees and the river banks ──
for (x, y) in [(35, 64), (54, 55), (54, 40), (24, 62), (17, 56), (4, 46), (21, 64), (45, 62)]:
    oak(x, y)
for (x, y) in [(19, 35), (41, 35), (18, 65), (54, 48), (55, 51), (3, 47), (10, 42)]:
    fir(x, y)
for (x, y) in [(50, 41), (51, 41), (52, 41), (50, 42), (51, 42), (52, 42)]:
    deco([["crops"]], x, y)
obj(type="fence", **{"from": [49, 40], "to": [53, 40]})
obj(type="well", x=46, y=49)
for (x, y) in [(7, 56), (9, 57), (6, 58)]:
    deco([["lilies"]], x, y, on_water=True)
for (x, y) in [(11, 56), (11, 58), (5, 55), (15, 56), (34, 50), (36, 52), (24, 49), (26, 51), (10, 46), (11, 46),
               (12, 46)]:
    obj(type="flowers", x=x, y=y)
obj(type="bench", x=12, y=57)
obj(type="signpost", x=CX + 2, y=66)

# ── backdrop: woods behind the castle and outside the walls; turrets on the wall's bends ──
for x in list(range(13, 23, 3)) + list(range(39, 49, 3)):
    fir(x, 4)
for x in (14, 19, 39, 44):
    oak(x, 6)
for (x, y) in [(1, 52), (2, 56), (4, 60), (8, 64), (13, 67), (20, 69), (40, 69), (47, 68), (52, 65), (57, 59),
               (60, 52), (60, 48), (60, 33), (61, 15), (60, 10), (0, 30), (0, 18), (1, 64), (58, 64)]:
    if g.inside(x, y) and g[x, y] == "." and g[x, y - 1] == ".":
        fir(x, y)
for (x, y) in [(55, 2), (56, 27), (56, 36), (56, 58), (1, 22), (1, 33), (4, 56), (24, 66), (33, 66)]:
    deco(TURRET, x, y, on_wall=True)

npcs = [
    {"id": "castle_door_guard_w", "sprite": "guard", "x": CX - 1, "y": 19,
     "dialog": ["The castle of Cornelia. The King receives travellers in the throne room upstairs."]},
    {"id": "castle_door_guard_e", "sprite": "guard", "x": CX + 1, "y": 19,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["The princess is home! The whole kingdom rejoices."]},
                {"text": ["Since Garland took the princess, the King has not slept."]}]},
    {"id": "inner_gate_guard", "sprite": "guard", "x": CX - 2, "y": 33,
     "dialog": ["Beyond this gate are the castle gardens. Mind the moat!"]},
    {"id": "guard", "sprite": "guard", "x": CX + 3, "y": 50, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["The princess is safe.", "Thank you, Warriors of Light!"]},
                {"text": ["The princess has been kidnapped!",
                          "Garland took her to the Temple of Fiends, north-west of here."]}]},
    {"id": "south_gate_guard", "sprite": "guard", "x": CX - 2, "y": 66,
     "dialog": ["Welcome to Cornelia, the royal city.", "The castle stands at the top of the high street."]},
    {"id": "old_man", "sprite": "old_man", "x": 26, "y": 44, "wander": True,
     "dialog": [{"condition": "INTRO_COMPLETE", "text": ["They say the King's builders are mending the bridge to the north.",
                                                         "Seek the four crystals across the land."]},
                {"text": ["The four crystals have gone dark.", "Only the Warriors of Light can restore them."]}]},
    {"id": "villager", "sprite": "villager", "x": 34, "y": 45, "wander": True,
     "dialog": ["Buy spells early. They make a huge difference in the first dungeon!"]},
    {"id": "market_vendor_w", "sprite": "merchant", "x": 24, "y": 41,
     "dialog": ["Fresh apples from the royal orchard!", "...Sorry, these are not for adventurers."]},
    {"id": "market_vendor_e", "sprite": "merchant", "x": 37, "y": 41,
     "dialog": ["Bread and cheese, the finest in Cornelia!"]},
    {"id": "townswoman", "sprite": "villager_f", "x": 44, "y": 49, "wander": True,
     "dialog": ["The river runs right through the city.", "My grandmother says it once flooded the market square!"]},
    {"id": "gardener", "sprite": "villager", "x": 5, "y": 23, "wander": True,
     "dialog": ["I tend the royal orchard.", "The princess loved to read under these trees."]},
    {"id": "mage_student", "sprite": "mage", "x": 9, "y": 55, "wander": True,
     "dialog": ["White magic heals, black magic harms.", "A wise party carries both."]},
    {"id": "fisher", "sprite": "old_man", "x": 38, "y": 62,
     "dialog": ["The fish bite best where the river bends."]},
    {"id": "east_gate_guard", "sprite": "guard", "x": 56, "y": 46,
     "dialog": ["The east road leads around the bay."]},
    {"id": "postern_guard", "sprite": "guard", "x": 8, "y": 3,
     "dialog": ["This postern lets the gardeners out to the fields.", "Watch for wolves past the orchard."]},
    {"id": "garden_maid", "sprite": "villager_f", "x": 42, "y": 25, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["Her Highness walks in the gardens again. Thank you!"]},
                {"text": ["Garland was the King's most trusted knight...", "Why would he turn against us?"]}]},
]

OUT = "overworld"
doc = {
    "id": "cornelia",
    "kits": ["town", "castle"],
    "music": "town",
    "entrances": {"south_gate": [CX, 67], "west_gate": [4, 44], "east_gate": [55, 44], "castle_gate": [55, 24],
                  "north_postern": [6, 3]},
    "objects": objects,
    "npcs": npcs,
    "transitions": [*[{"x": x, "y": H - 1, "targetMap": OUT, "targetEntrance": "cornelia"} for x in (CX - 1, CX, CX + 1)],
                    *[{"x": 0, "y": y, "targetMap": OUT, "targetEntrance": "cornelia_west"} for y in (44, 45)],
                    *[{"x": W - 1, "y": y, "targetMap": OUT, "targetEntrance": "cornelia_east"} for y in (44, 45)],
                    *[{"x": W - 1, "y": y, "targetMap": OUT, "targetEntrance": "cornelia_east"} for y in (24, 25)],
                    *[{"x": x, "y": 0, "targetMap": OUT, "targetEntrance": "castle"} for x in (6, 7)]],
}
HEADER = """GENERATED by assets-src/tools/layouts/cornelia.py - edit the script, not this file.
Cornelia (original layout): castle precinct and town inside one bent outer wall; the river feeds the moat and winds
through the town. Compiled by assets-src/tools/build_map.py.
ground legend: . grass  : cobble  , dirt  ~ water  # wall  = bridge  u culvert (wall over water)"""
print(write_map("cornelia", HEADER, doc, g.text()))

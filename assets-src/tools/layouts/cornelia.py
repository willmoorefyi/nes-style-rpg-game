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
import cornelia_gates  # noqa: E402
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
g.rect(0, 0, 2, 17, "#", only=".")                # the sealed pocket outside the NW corner: solid wall (CT-6)
# CU (T5c): the grass pocket between the south oak, the turret and the south wall: solid wall (the NE pocket is opened
# up instead, see the quiet garden's fir)
g.rect(35, 67, 36, 67, "#", only=".")

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
g.rect(11, 25, 54, 25, ":", only=ST)             # garden walks, joining the promenade
g.rect(7, 25, 8, 25, ":", only=ST)               # ... over the bridge, then a spur to the orchard well
g.rect(7, 23, 7, 24, ":", only=ST)
g.rect(55, 24, W - 1, 25, ":", only=ST)          # the castle precinct's east gate
g.rect(6, 0, 7, 9, ",", only=ST + "#")           # north postern and the orchard track, down to the castle apron
g.rect(6, 10, 7, 18, ",", only=ST)
g.rect(6, 19, 9, 19, ",", only=ST)
g.rect(53, 19, 54, 19, ":", only=ST)             # over the river to the bench in the quiet garden
g.rect(54, 17, 54, 18, ":", only=ST)
g.rect(9, 46, 10, 54, ":", only=ST)              # lane down to the magic quarter, between the two magic shops
g.rect(6, 54, 13, 54, ":", only=ST)              # ... and along their doors
g.rect(24, 60, CX - 2, 60, ":", only=ST)         # lane to the inn
g.rect(CX + 2, 63, 38, 63, ":", only=ST)         # past the shrine door to the river path
g.rect(42, 46, 43, 51, ":", only=ST)             # east quarter lanes, ending at a bench and flower garden
g.rect(44, 51, 53, 51, ":", only=ST)
g.rect(38, 61, 38, 62, ",", only=".")            # the river path: over the bridge, past the tavern door,
g.rect(41, 61, 51, 61, ",", only=".")            # to the oak garden by the east wall
g.rect(51, 59, 52, 60, ",", only=".")
for (x0, y0, x1, y1) in [(CX - 1, 20, CX + 1, 21), (17, 44, 18, 45), (CX - 1, 52, CX + 1, 54), (9, 25, 10, 25),
                         (39, 61, 40, 61), (51, 19, 52, 19)]:
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
    deco([["urn"]], x + (x - CX) // 2, 22)       # M1: (27, 22) and (33, 22); the door guards stand inside them
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
    obj(type="flowers", x=x, y=28)               # M9: the lawn under each hedge run
for x in (21, 39):
    deco([["statue_top"], ["statue_bottom"]], x, 26)
for (x, y) in [(12, 22), (47, 22), (25, 22), (34, 22)]:
    oak(x, y)
# the royal orchard by the north postern, and a quiet garden east of the river
for (x, y) in [(3, 5), (3, 11), (3, 16)]:
    oak(x, y)
for (x, y) in [(5, 14), (8, 14), (9, 4), (9, 7), (8, 18)]:
    fir(x, y)
for (x, y) in [(4, 20), (5, 20), (6, 20), (4, 21), (5, 21), (6, 21)]:
    deco([["crops"]], x, y)
obj(type="fence", **{"from": [3, 19], "to": [5, 19]})
obj(type="well", x=7, y=22)
for (x, y) in [(53, 14), (55, 15), (56, 12)]:
    obj(type="flowers", x=x, y=y)
deco([["stone_bench"]], 54, 16)
obj(type="bush", x=56, y=9)
fir(54, 7)
fir(56, 22)
fir(53, 5)                                       # CU: was an oak at (53, 3) that walled in the grass behind it

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

# ── town: houses, each with its own interior (layouts/interiors.py writes cornelia-house-<name>) ──
HOUSES = [  # (name, x, y, h, storeys, roof, wall, chimney); the door is at (x + 2, y + h - 1)
    ("scholar", 44, 32, 5, 2, "blue", "plaster", 1), ("fisher", 50, 34, 4, 1, "green", "white", None),
    ("farm", 48, 46, 4, 1, "red", "ochre", 3), ("knight", 42, 52, 5, 2, "slate", "white", 3),
    ("weaver", 48, 53, 4, 1, "brown", "rose", None), ("gardener", 13, 33, 4, 1, "green", "plaster", 1),
    ("family", 12, 60, 4, 1, "red", "white", None), ("apprentice", 4, 38, 4, 1, "teal", "plaster", 3),
    ("tavern", 44, 57, 4, 1, "blue", "ochre", 1), ("shrine", 33, 58, 5, 2, "red", "stone", None)]
for (name, x, y, h, st, roof, wall, ch) in HOUSES:              # M7: the tavern and the shrine hang their signs
    obj(**HOUSE, name=f"house_{name}", x=x, y=y, h=h, storeys=st, roof=roof, wall=wall,
        **({"sign": name} if name in ("tavern", "shrine") else {}), **({"chimney": ch} if ch is not None else {}),
        enter={"map": f"cornelia-house-{name}", "entrance": "door"})

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
for (x, y) in [(11, 56), (11, 58), (5, 55), (15, 56), (34, 50), (36, 52), (24, 49), (26, 51), (11, 46), (12, 46),
               (13, 46)]:
    obj(type="flowers", x=x, y=y)
obj(type="bench", x=12, y=57)
# where the lanes end (CT-8): a bench and flower garden in the east quarter, the oak garden by the east wall
obj(type="bench", x=54, y=51)
obj(type="bench", x=53, y=59)
for (x, y) in [(53, 50), (54, 50), (53, 52), (54, 52), (52, 58), (53, 58)]:
    obj(type="flowers", x=x, y=y)
LANE_ENDS = [[7, 22], [54, 16], [54, 51], [53, 59]]   # the orchard well, the quiet garden's bench, the two gardens
SIGNPOST = (CX + 2, 66)                          # by the south gate, east of the high street
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
# CT-9: what the signpost says (checked against the layout: the high street runs north from the south gate past the
# inn lane (y 60, west side) and the market square (y 38-48) to the castle; the magic shops stand south of the west
# road (y 44-45), down the lane at x 9-10)
INSPECT = [{"x": SIGNPOST[0], "y": SIGNPOST[1], "text": [
    "The sign reads: \"CORNELIA, the royal city.\"",
    "North, up the high street: the Inn (first lane on the left), then the Market Square, and the Castle at the top.",
    "Magic Quarter: from the Market Square, west along the road, then south down the lane.",
]}]

# ── backdrop: woods behind the castle and outside the walls; turrets on the wall's bends ──
for x in list(range(13, 23, 3)) + list(range(39, 49, 3)):
    fir(x, 4)
for x in (14, 19, 39, 44):
    oak(x, 6)
for (x, y) in [(1, 52), (2, 56), (4, 60), (8, 64), (13, 67), (20, 69), (40, 69), (47, 68), (52, 65), (57, 59),
               (60, 52), (60, 48), (60, 33), (61, 15), (60, 10), (0, 30), (0, 18), (1, 64), (58, 64)]:
    if g.inside(x, y) and g[x, y] == "." and g[x, y - 1] == ".":
        fir(x, y)
# M7: turrets on the bends and both sides of every gate; arches over the south gate, the gatehouse and the postern
cornelia_gates.place(g, deco, obj, TURRET, CX)

npcs = [
    # CT-4 / M1: the door guards stand at the bridge's garden end, beside it, so the castle apron (row 19) stays open
    {"id": "castle_door_guard_w", "sprite": "guard", "x": CX - 2, "y": 22,
     "dialog": ["The castle of Cornelia. The King receives travellers in the throne room upstairs."]},
    {"id": "castle_door_guard_e", "sprite": "guard", "x": CX + 2, "y": 22,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["Her Highness rode in through this very gate.",
                                                           "I will tell my grandchildren I stood guard that day!"]},
                {"text": ["I keep watch on the castle gate, day and night.",
                          "No one has crossed this bridge unseen since Garland rode out."]}]},
    {"id": "inner_gate_guard", "sprite": "guard", "x": CX - 2, "y": 33,
     "dialog": ["Beyond this gate are the castle gardens. Mind the moat!"]},
    {"id": "guard", "sprite": "villager", "x": CX + 3, "y": 50, "wander": True,     # M8: a town crier, not a guard
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["The princess is safe.", "Thank you, Warriors of Light!"]},
                {"text": ["The princess has been kidnapped!",
                          "Garland took her to the Temple of Fiends, north-west of here."]}]},
    {"id": "south_gate_guard", "sprite": "guard", "x": CX - 2, "y": 66,
     "dialog": ["Welcome to Cornelia, the royal city.", "The castle stands at the top of the high street."]},
    {"id": "old_man", "sprite": "old_man", "x": 26, "y": 44, "wander": True,
     "dialog": [{"condition": "INTRO_COMPLETE", "text": ["They say the King's builders are mending the bridge to the north.",
                                                         "Seek the four crystals across the land."]},
                {"text": ["The four crystals have gone dark.", "Only the Warriors of Light can restore them."]}]},
    {"id": "villager", "sprite": "burgher", "x": 34, "y": 45, "wander": True,
     "dialog": [{"condition": "GARLAND_DEFEATED", "text": [
                    "You beat Garland! Keep buying spells early. Whatever waits past the bridge won't be easier."]},
                {"text": ["Buy spells early. Garland is no easy foe!"]}]},
    # UI-2: the market vendors are townsfolk (the merchant sprite is kept for keepers with a shop), and they chat
    {"id": "market_vendor_w", "sprite": "vendor_f", "x": 24, "y": 41,
     "dialog": [{"condition": c, "text": ["Apples from the royal orchard! Half price today, for the princess is home.", t]}
                for c, t in [("INTRO_COMPLETE",      # T5: the builders only once the King has ordered them
                              "They say the King has builders out at the north bridge. Trade will come back, you'll see."),
                             ("PRINCESS_RESCUED",
                              "Now if only someone would mend the north bridge. Trade would come back, you'll see.")]] + [
                {"text": ["Apples from the royal orchard! Dear this week, I'm sorry to say.",
                          "The carters won't use the roads. Wolves, right up to the walls, and in daylight too.",
                          "Since the princess was taken, nobody has the heart to haggle."]}]},
    {"id": "market_vendor_e", "sprite": "farmer", "x": 37, "y": 41,
     "dialog": [{"condition": "PRINCESS_RESCUED",
                 "text": ["Bread and cheese, the finest in Cornelia! Folk are buying again, now Her Highness is safe.",
                          "Once the north bridge is mended I'll take my cheeses across. They fetch double over there."]},
                {"text": ["Bread and cheese, the finest in Cornelia!",
                          "With the north bridge broken, nothing comes in from across the water. Flour costs a fortune.",
                          "And with the princess gone, who has an appetite?"]}]},
    {"id": "townswoman", "sprite": "villager_f", "x": 44, "y": 49, "wander": True,
     "dialog": ["The river runs right through the city.", "My grandmother says it once flooded the market square!"]},
    {"id": "gardener", "sprite": "villager", "x": 5, "y": 23, "wander": True,
     "dialog": ["I tend the royal orchard.", "The princess loved to read under these trees."]},
    {"id": "mage_student", "sprite": "mage", "x": 9, "y": 55, "wander": True,
     "dialog": ["White magic heals, black magic harms.", "A wise party carries both."]},
    {"id": "fisher", "sprite": "villager", "x": 38, "y": 64,
     "dialog": ["The fish bite best where the river bends."]},
    {"id": "east_gate_guard", "sprite": "guard", "x": 56, "y": 46,
     "dialog": ["The east road crosses the river and ends at an old tomb below the mountains."]},
    {"id": "postern_guard", "sprite": "guard", "x": 8, "y": 3,
     "dialog": ["This postern lets the gardeners out to the fields.", "Watch for wolves past the orchard."]},
    {"id": "garden_maid", "sprite": "villager_f", "x": 42, "y": 25, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["Her Highness is home at last! I will cut her the first roses."]},
                {"text": ["I tend the roses for Her Highness.", "I hope she comes home before they fade."]}]},
]

OUT = "overworld"
doc = {
    "id": "cornelia",
    "name": "Cornelia",
    "kits": ["town", "castle"],
    "music": "town",
    "entrances": {"south_gate": [CX, 67], "west_gate": [4, 44], "east_gate": [55, 44], "castle_gate": [55, 24],
                  "north_postern": [6, 3]},
    # the single-file north-postern route and its bridge (CT-3): wandering NPCs (the gardener) never plug it
    "noWander": [[x, y] for x in range(8, 12) for y in range(17, 26)],
    "objects": objects,
    "npcs": npcs,
    "inspect": INSPECT,
    # CT-6 / CT-7: every walkable edge cell leaves town; the castle precinct's side of the east edge (and its east
    # gate, (61, 24-25)) comes out north of the city icon, like the north edge and the postern
    "edge_exits": {**{side: {"targetMap": OUT, "targetEntrance": f"cornelia{sfx}"} for side, sfx in
                      (("north", "_north"), ("west", "_west"), ("east", "_east"), ("south", ""))},
                   "split": [{"side": "east", "from": 0, "to": 30, "targetEntrance": "cornelia_north"}]},
    # CT-8: every road and lane ends at a gate, a door, a bridge or one of these gardens
    "road_check": {"materials": ["cobble", "dirt"], "ends": LANE_ENDS},
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,              # CU (T5c): every walkable cell can be reached
}
HEADER = """GENERATED by assets-src/tools/layouts/cornelia.py - edit the script, not this file.
Cornelia (original layout): castle precinct and town inside one bent outer wall; the river feeds the moat and winds
through the town. Compiled by assets-src/tools/build_map.py.
ground legend: . grass  : cobble  , dirt  ~ water  # wall  = bridge  u culvert (wall over water)"""
print(write_map("cornelia", HEADER, doc, g.text()))

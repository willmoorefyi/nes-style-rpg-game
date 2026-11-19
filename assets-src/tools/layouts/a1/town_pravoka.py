"""Pravoka: the harbour town on the fjord (docs/WORLD_PLAN.md 4.0.1, 4.1; A1-T) -> assets-src/maps/pravoka.yaml.

  python3 -I assets-src/tools/layouts/a1/town_pravoka.py && python3 -I assets-src/tools/build_map.py pravoka

An original layout. The town fills a shelf between the cliffs and the fjord. Three streets run down from the west
cliffs to the quay, crossed by one street that climbs north to the cliff path. The path runs round the fjord's head
to the lighthouse shelf at the range's foot, where the keeper's house is the clinic. Two warehouses stand over the
water on piles, beside a plank landing. The pirate brig is moored at the south pier, and the captain waits at the
pier's end. Before BIKKE_DEFEATED the pirates loiter at the gate, on the quay and outside their den. After it they
are gone, and the dockhands are back at work.

The people and their lines are in `town_pravoka_people.py`; the interiors in `town_pravoka_rooms.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent.parent))
from common import Grid, write_map  # noqa: E402
from kit import landmark_parts  # noqa: E402
from town_common import Outdoor  # noqa: E402
import town_pravoka_people as PEOPLE  # noqa: E402
import town_pravoka_site as SITE  # noqa: E402

W, H = 48, 44
g = Grid(W, H, ".")
town = Outdoor()
obj, deco, oak, lamp, fir = town.obj, town.deco, town.oak, town.lamp, town.fir

# ── the frame: north cliffs, the west cliff with the land gate, the range across the fjord, the south crags ──
g.rect(0, 0, W - 1, 1, "m")
g.rect(0, 0, 1, H - 1, "m")
g.rect(44, 0, W - 1, H - 1, "m")
g.rect(0, 42, 30, H - 1, "m")
for (x0, x1) in [(2, 9), (21, 27)]:                 # the cliff foot is ragged under the north wall
    g.rect(x0, 2, x1, 2, "m")
g.rect(2, 3, 4, 3, "m")
g.rect(2, 38, 2, 41, "m")                           # a buttress of the west cliff over the south lane
GATE_ROWS = (34, 35)
g.rect(0, GATE_ROWS[0], 1, GATE_ROWS[1], ":")       # the land gate: the high street leaves town to the west

# ── the fjord: its head under the north path, the channel down the east side, the harbour off the quay ──
g.rect(31, 8, 36, 12, "~")
g.rect(31, 13, 43, H - 1, "~")

# ── streets (cobble over grass) and the cliff path (dirt) ──
STREETS = [(5, 14, 30, 15), (5, 24, 30, 25), (0, 34, 30, 35)]        # Rope Walk, Cooper's Row, the high street
for (x0, y0, x1, y1) in STREETS:
    g.rect(x0, y0, x1, y1, ":", only=".")
g.rect(14, 8, 15, 41, ":", only=".")                # Lantern Street: north from the fish market to the cliff path
g.rect(29, 8, 30, 41, ":", only=".")                # the quay, the whole length of the town
g.rect(5, 40, 13, 41, ":", only=".")                # the cooper's lane under the west cliff
g.rect(16, 38, 28, 41, ":", only=".")               # the fish market, between Lantern Street and the quay
g.rect(14, 6, 42, 7, ",", only=".~")                # the cliff path round the fjord's head to the lighthouse
g.rect(31, 6, 36, 7, ",")

# ── the water side: the plank landing under the warehouses, two piers ──
LANDING = (31, 19, 41, 20)
g.rect(31, 15, 41, 15, ",")                         # the boardwalk behind the warehouses (their ridges)
g.rect(*LANDING, "=", only="~")
g.rect(31, 26, 37, 27, "=", only="~")               # the fishers' pier
BRIG_PIER = (31, 33, 40, 34)
g.rect(*BRIG_PIER, "=", only="~")                   # the brig's pier

# ── buildings: houses with interiors (town_pravoka_rooms.py), the five shops, the inn ──
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])


def home(slug, x, y, h, storeys, roof, wall, chimney=None, **kw):
    obj(**HOUSE, name=f"house_{slug}", x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall,
        **({"chimney": chimney} if chimney is not None else {}), **kw,
        enter={"map": f"{SITE.TOWN}-house-{slug}", "entrance": "door"})


def shop(name, part, x, y, h, storeys, roof, wall, sign, chimney=None):
    obj(**HOUSE, name=name, x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall, sign=sign,
        **({"chimney": chimney} if chimney is not None else {}),
        enter={"map": f"{SITE.TOWN}-{part}", "entrance": "door"})


# Rope Walk (doors on y 13, the street on y 14-15)
home("netmaker", 3, 10, 4, 1, "green", "plaster", 1)
home("chandler", 8, 9, 5, 2, "brown", "ochre", 3)
shop("weapon_shop", "weapon-shop", 17, 9, 5, 2, "red", "stone", "weapon")
home("harbormaster", 23, 9, 5, 2, "slate", "white", 1)
# Cooper's Row (doors on y 23)
shop("white_magic", "white-magic", 3, 19, 5, 2, "blue", "white", "white_magic")
shop("black_magic", "black-magic", 8, 19, 5, 2, "slate", "stone", "black_magic", 3)
shop("item_shop", "item-shop", 17, 20, 4, 1, "teal", "ochre", "item", 3)
obj(type="prefab", prefab="inn", name="inn", x=23, y=19, w=4, h=5, door=2, sign="inn",
    enter={"map": f"{SITE.TOWN}-inn", "entrance": "door"})
# the high street (doors on y 33)
shop("armor_shop", "armor-shop", 3, 29, 5, 2, "brown", "plaster", "armor", 1)
obj(**{**HOUSE, "windows": [1]}, name="sail_loft", x=8, y=30, h=4, roof="rose", wall="white")         # no door: shut
obj(**{**HOUSE, "windows": [3]}, name="pirates_den", x=17, y=30, h=4, roof="slate", wall="stone")    # boarded up
# the cooper's lane (doors on y 39)
home("cooper", 3, 36, 4, 1, "red", "ochre", 3)
obj(**{**HOUSE, "windows": []}, name="boarded_cottage", x=8, y=36, h=4, roof="brown", wall="rose")
# over the water on piles, the doors onto the landing (y 19)
home("warehouse", 31, 15, 4, 1, "brown", "stone", None, on_water=True)
obj(**{**HOUSE, "windows": [1, 3]}, name="old_warehouse", x=37, y=15, h=4, roof="slate", wall="stone", on_water=True)
# the lighthouse shelf: the keeper's house (the clinic) and the tower on the shelf's tip, at the range's foot
home("lighthouse", 38, 2, 4, 1, "red", "white", 3)
LIGHTHOUSE = (41, 10)
deco(landmark_parts("tower"), *LIGHTHOUSE, style="bright", collide="alpha")

# ── the water side's dressing: piles, the moored brig, nets and cargo ──
for x in range(31, 42):
    deco([[landmark_parts("dock_post")[0][0]]], x, LANDING[3] + 1, on_water=True)
for y in (15, 17):
    deco([[landmark_parts("dock_post")[0][0]]], 42, y, on_water=True)
BRIG = (35, 35)                                     # the pirates' brig, moored along the south side of its pier
deco(landmark_parts("buried_hull"), *BRIG, on_water=True)
for (x, y) in [(28, 16), (28, 22), (28, 27), (28, 31)]:
    obj(type="barrel", x=x, y=y)
for (x, y) in [(28, 17), (28, 21), (28, 28), (28, 36), (28, 37)]:
    obj(type="crate", x=x, y=y)
# the fish market
STALL = [["stall_0_0", "stall_0_1"], ["stall_1_0", "stall_1_1"]]
for (x, y) in [(18, 38), (22, 38), (25, 40)]:
    deco(STALL, x, y)
obj(type="well", x=17, y=40)
for (x, y) in [(20, 41), (21, 41)]:
    obj(type="barrel", x=x, y=y)

# ── lamps, gardens and the meadow under the north cliffs ──
for (x, y) in [(13, 12), (16, 12), (13, 22), (16, 22), (13, 32), (16, 32), (28, 12), (28, 32), (16, 36),
               (37, 9)]:
    lamp(x, y)
for (x, y) in [(5, 5), (8, 4), (11, 5), (18, 4), (29, 4), (33, 3), (36, 4), (6, 17), (11, 17), (20, 17), (25, 17)]:
    fir(x, y)
for (x, y) in [(23, 26), (19, 27)]:
    oak(x, y)
for (x, y) in [(4, 16), (5, 16), (9, 16), (10, 16), (21, 16), (22, 16), (26, 28), (27, 28), (9, 28), (10, 28)]:
    obj(type="flowers", x=x, y=y)
for (x, y) in [(4, 26), (5, 26), (6, 26), (4, 27), (5, 27), (6, 27)]:
    deco([["crops"]], x, y)
obj(type="fence", **{"from": [3, 28], "to": [7, 28]})
obj(type="well", x=12, y=27)
for (x, y) in [(38, 9), (39, 9)]:
    obj(type="bench", x=x, y=y)
obj(type="bench", x=24, y=4)
for (x, y) in [(38, 11), (43, 8)]:
    obj(type="bush", x=x, y=y)
SIGNPOST = (2, 33)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
LANE_ENDS = [[42, 7], [24, 5], [13, 41], [41, 15]]           # the lighthouse bench, the meadow bench, the lane's foot
INSPECT = [
    {"x": SIGNPOST[0], "y": SIGNPOST[1], "text": [
        "The sign reads: \"PRAVOKA. Harbour dues payable at the quay.\"",
        "Someone has painted over \"harbour dues\" in red: \"CAPTAIN'S SHARE\".",
        "East down the high street: the quay. The inn and the shops stand on the streets above it."]},
    {"x": LIGHTHOUSE[0], "y": LIGHTHOUSE[1] + 2, "text": [
        "The lighthouse door is barred from inside. Its lamp has been dark for weeks.",
        "Through a crack you see the stair wind up into the gloom."]},
    {"x": BRIG[0] + 1, "y": BRIG[1], "text": [
        {"condition": "BIKKE_DEFEATED", "text": ["The brig rides at her mooring, swept and ready. She is yours now."]},
        {"text": ["A black-hulled brig, low and fast. A cutlass is nailed to her bowsprit."]}]},
]

doc = {
    "id": SITE.TOWN,
    "name": "Pravoka",
    "kits": ["town", "overworld"],
    "music": "town",
    "entrances": {"gate": [3, GATE_ROWS[0]]},
    "objects": town.objects,
    "npcs": PEOPLE.npcs(),
    "inspect": INSPECT,
    "scriptedEncounters": [PEOPLE.CAPTAIN_FIGHT],
    "edge_exits": {"west": {"targetMap": "overworld", "targetEntrance": SITE.ANCHOR}},
    "noWander": PEOPLE.NO_WANDER,
    "road_check": {"materials": ["cobble", "dirt"], "ends": LANE_ENDS},
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "battleBackgrounds": {"default": "shoreline"},        # the captain's fight on the brig pier
}
HEADER = """GENERATED by assets-src/tools/layouts/a1/town_pravoka.py - edit the script, not this file.
Concept: a harbour town on a shelf between the cliffs and a fjord, held by Captain Bikke's pirates: three streets
  fall from the west cliff to a quay, the brig lies at the south pier, and a cliff path rounds the fjord's head to
  the lighthouse at the foot of the range.
Distinct: two warehouses on piles over the water beside a plank landing; a cliff path round the fjord's head to a
  lighthouse shelf on the far shore; a boarded-up pirates' den on the high street; a fish market between the
  streets and the quay.
Topology: one map, no stairs: the west land gate -> the high street -> the quay; Lantern Street north to the cliff
  path and the lighthouse shelf; the captain's fight at the brig pier's end (the boss, an NPC).
ground legend: . grass  : cobble  , dirt  ~ water  = planks  m cliff"""
print(write_map(SITE.TOWN, HEADER, doc, g.text()))

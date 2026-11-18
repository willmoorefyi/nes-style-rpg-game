"""Crescent Lake: the scholars' town on terraces above the crescent water (docs/WORLD_PLAN.md 4.0.1, 4.4; FIR-T) ->
assets-src/maps/crescent.yaml.

  python3 -I assets-src/tools/layouts/fire/town_crescent.py && python3 -I assets-src/tools/build_map.py crescent

An original layout. The town stands on a headland whose inner shore bends round in a crescent: the lake wraps the
east and the south of the map, and its far bank shows in the south-east corner. Three terraces step down towards the
water, each held up by a band of rock with stone stairs cut through it:
- the Star Terrace (north, highest): the tutor's school, the archive, a shuttered reading room, the astronomer's
  house and the observatory, a domed hall with its telescope tower;
- the Market Terrace (middle): the Sea Road comes in from the land gate on the west and runs east to a landing stage
  on the lake; the five shops and the inn line its north side, the healer's house (the clinic), the potter, a
  scriptorium and the pilgrims' hostel its south side;
- the Lakeside (south, lowest): a lawn in the bowl of the shore, the boatwright's yard, two boathouses on piles, and
  at its southern tip the causeway that crosses the water to the Circle of Sages (`crescent-circle`).
The people and their lines are in `town_crescent_people.py`, the interiors in `town_crescent_rooms.py`.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent.parent))
from common import Grid, write_map  # noqa: E402
from kit import landmark_parts  # noqa: E402
from town_common import TURRET, Outdoor, flag  # noqa: E402
import town_crescent_people as PEOPLE  # noqa: E402
import town_crescent_site as SITE  # noqa: E402

W, H = 54, 46
CENTRE, SHORE, FAR = (20, 12), 27, 38               # the inner shore is a circle arc about CENTRE: the crescent
g = Grid(W, H, ".")
town = Outdoor()
obj, deco, oak, lamp, fir = town.obj, town.deco, town.oak, town.lamp, town.fir


def dist(x: int, y: int) -> float:
    return math.hypot(x - CENTRE[0], y - CENTRE[1])


# ── the water: the crescent lake round the east and the south, its far bank in the south-east corner ──
for y in range(H):
    for x in range(W):
        d = dist(x, y)
        if d >= FAR:
            g.set(x, y, "m")
        elif d >= SHORE:
            g.set(x, y, "~")

# ── the frame: the headland's crags on the north and the west, the land gate on the Sea Road ──
GATE_ROWS = (17, 18)
g.rect(0, 0, W - 1, 1, "m", only=".")
g.rect(0, 2, 1, H - 1, "m", only=".")
g.rect(0, GATE_ROWS[0], 1, GATE_ROWS[1], ":")
for (x0, x1) in [(2, 3), (21, 23), (30, 31)]:          # the crag foot is ragged under the north wall
    g.rect(x0, 2, x1, 2, "m")

# ── the terrace walls: two bands of rock across the headland, cut by stone stairs ──
CLIFFS = {(10, 11): [(21, 22), (45, 46)], (24, 25): [(9, 10), (29, 30)]}
for (y0, y1), stairs in CLIFFS.items():
    g.rect(2, y0, W - 1, y1, "m", only=".")
    for (x0, x1) in stairs:
        g.rect(x0, y0, x1, y1, ":")

# ── streets: the Star Walk (upper), the Sea Road and the Hostel Lane (middle), the lakeside path (lower) ──
g.rect(2, 8, 46, 9, ":", only=".")                  # the Star Walk, along the doors of the upper terrace
g.rect(0, 17, 46, 18, ":", only=".")                # the Sea Road, from the land gate to the landing stage
g.rect(2, 23, 44, 23, ",", only=".")                # the Hostel Lane, under the south row's doors
g.rect(21, 12, 27, 16, ":", only=".")               # the Fountain Court between the item shop and the inn
g.rect(45, 12, 46, 16, ":", only=".")               # the east stair's street, past the black magic shop
for x0 in (9, 29):                                   # two lanes down from the Sea Road to the lower stairs
    g.rect(x0, 19, x0 + 1, 22, ",", only=".")
LANDING = (47, 17, 50, 18)
g.rect(*LANDING, "=", only="~")                      # the landing stage on the lake, at the Sea Road's end
for y in range(26, 39):                              # the lakeside path: a dirt ring just inside the shore
    for x in range(2, W):
        if g[x, y] == "." and SHORE - 2.2 <= dist(x, y) < SHORE:
            g.set(x, y, ",")
g.rect(9, 26, 10, 35, ",", only=".")                 # the path down from the west stair to the shore
g.rect(29, 26, 30, 36, ",", only=".")                # and from the east stair
CAUSEWAY = (19, 39, 20, H - 1)
g.rect(*CAUSEWAY, "=", only="~")                     # the causeway to the Circle's islet (off the south edge)
YARD = (3, 30, 8, 31)
g.rect(*YARD, ",", only=".")                         # the boatwright's yard
SLIP = (40, 28, 44, 28)
g.rect(*SLIP, ",")                                  # the boathouse walk on piles, under the east boathouse's ridge
g.set(37, 33, ",")                                   # and the south boathouse's

# ── buildings: the six homes with interiors, the five shops, the inn, and the shut ones ──
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])


def home(slug, x, y, h, storeys, roof, wall, chimney=None, **kw):
    obj(**HOUSE, name=f"house_{slug}", x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall,
        **({"chimney": chimney} if chimney is not None else {}), **kw,
        enter={"map": f"{SITE.TOWN}-house-{slug}", "entrance": "door"})


def shop(name, part, x, y, roof, wall, sign, chimney=None):
    obj(**HOUSE, name=name, x=x, y=y, h=4, storeys=1, roof=roof, wall=wall, sign=sign,
        **({"chimney": chimney} if chimney is not None else {}),
        enter={"map": f"{SITE.TOWN}-{part}", "entrance": "door"})


def shut(name, x, y, h, roof, wall, windows, storeys=1, door=2, **kw):
    obj(**{**HOUSE, "windows": windows, "door": door}, name=name, x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall, **kw)


# the Star Terrace (doors on y 7, the Star Walk on y 8-9)
home("tutor", 4, 3, 5, 2, "red", "plaster", 3)
home("archivist", 10, 3, 5, 2, "slate", "stone", 1)
shut("reading_room", 17, 4, 4, "teal", "white", [1, 2, 3])
home("astronomer", 24, 4, 4, 1, "blue", "white", 3)
shut("observatory", 33, 3, 5, "blue", "stone", [1, 3], storeys=2)
deco(TURRET, 38, 2)                                  # the telescope tower beside the observatory hall
# the Market Terrace, north side of the Sea Road (doors on y 16)
shop("weapon_shop", "weapon-shop", 3, 13, "red", "stone", "weapon")
shop("armor_shop", "armor-shop", 9, 13, "brown", "plaster", "armor", 1)
shop("item_shop", "item-shop", 15, 13, "teal", "ochre", "item", 3)
obj(type="prefab", prefab="inn", name="inn", x=29, y=12, w=4, h=5, door=2, sign="inn",
    enter={"map": f"{SITE.TOWN}-inn", "entrance": "door"})
shop("white_magic", "white-magic", 34, 13, "blue", "white", "white_magic")
shop("black_magic", "black-magic", 40, 13, "slate", "stone", "black_magic", 3)
# the Market Terrace, south side (doors on y 22, the Hostel Lane on y 23)
home("healer", 3, 19, 4, 1, "rose", "white", 1)
home("potter", 13, 19, 4, 1, "brown", "ochre", 3)
shut("scriptorium", 19, 19, 4, "slate", "plaster", [1, 3])
shut("pilgrims_hostel", 33, 19, 4, "green", "white", [1, 2, 3])
# the Lakeside
home("boatwright", 4, 26, 4, 1, "green", "ochre", 3)
shut("boathouse_east", 40, 28, 4, "brown", "stone", [1, 3], door=None, on_water=True)
shut("boathouse_south", 33, 33, 4, "brown", "plaster", [3], door=None, on_water=True)

# ── dressing: the fountain court, lamps, gardens, the boatwright's yard and the water's edge ──
obj(type="fountain", x=23, y=13)
for (x, y) in [(22, 16), (26, 16)]:
    obj(type="bench", x=x, y=y)
for (x, y) in [(9, 6), (16, 6), (31, 6), (2, 15), (20, 15), (28, 15), (39, 15), (12, 21), (31, 21), (39, 21)]:
    lamp(x, y)
for (x, y) in [(15, 4), (22, 4), (29, 4), (42, 6), (44, 4), (41, 3)]:
    fir(x, y)
for (x, y) in [(14, 27), (22, 27), (34, 26)]:
    oak(x, y)
deco([["statue_top"], ["statue_bottom"]], 19, 30, above_rows=1)   # the first sage, on the lawn
for (x, y) in [(18, 32), (21, 32), (13, 33), (26, 33)]:
    obj(type="flowers", x=x, y=y)
for (x, y) in [(36, 29), (37, 29)]:
    obj(type="barrel", x=x, y=y)
for (x, y) in [(24, 20), (25, 20), (27, 20), (28, 20), (24, 21), (28, 21)]:
    obj(type="flowers", x=x, y=y)
obj(type="well", x=26, y=21)
for (x, y) in [(3, 30), (4, 30), (8, 31)]:
    obj(type="crate", x=x, y=y)
for (x, y) in [(7, 30), (3, 31)]:
    obj(type="barrel", x=x, y=y)
for x in range(40, 45):
    deco([[landmark_parts("dock_post")[0][0]]], x, SLIP[1] + 4, on_water=True)
for x in (47, 50):
    deco([[landmark_parts("dock_post")[0][0]]], x, LANDING[3] + 1, on_water=True)
for (x, y) in [(46, 24), (45, 30), (2, 33), (7, 36), (28, 37), (12, 38)]:
    deco([["lilies"]], x, y, on_water=True)
for (x, y) in [(16, 31), (24, 31), (17, 36), (22, 36)]:
    obj(type="bench", x=x, y=y)
for (x, y) in [(11, 31), (27, 34)]:
    obj(type="bush", x=x, y=y)
SIGNPOST = (2, 19)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
LANE_ENDS = [[44, 23], [2, 23], [2, 8], [46, 8], [43, 26], [44, 28]]   # lane, walk and boardwalk ends
INSPECT = [
    {"x": SIGNPOST[0], "y": SIGNPOST[1], "text": [
        "The sign reads: \"CRESCENT LAKE. Quiet on the terraces, please: scholars at work.\"",
        "Below, in smaller letters: \"The Circle receives visitors at the causeway. Knock on nothing.\""]},
    {"x": 35, "y": 7, "text": [
        "The observatory hall is locked. A brass plate says the astronomer keeps the only key.",
        "Through the shutters you glimpse a long tube of brass aimed at the sky."]},
    {"x": 21, "y": 22, "text": [
        "The scriptorium's door is barred. A note pinned to it: \"Copying in progress. Ink is drying. Go away kindly.\""]},
]

doc = {
    "id": SITE.TOWN,
    "name": "Crescent Lake",
    "kits": ["town", "castle", "overworld"],
    "music": "town",
    "entrances": {"gate": [3, GATE_ROWS[0]], "circle": [CAUSEWAY[0], H - 2]},
    "objects": town.objects,
    "npcs": PEOPLE.npcs(),
    "inspect": INSPECT,
    "edge_exits": {"west": {"targetMap": "overworld", "targetEntrance": SITE.ANCHOR},
                   "south": {"targetMap": "crescent-circle", "targetEntrance": "arrival"}},
    "noWander": PEOPLE.NO_WANDER,
    "road_check": {"materials": ["cobble", "dirt"], "ends": LANE_ENDS},
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
}
HEADER = """GENERATED by assets-src/tools/layouts/fire/town_crescent.py - edit the script, not this file.
Concept: a scholars' town on a headland above a crescent lake: three terraces held up by bands of rock step down from
  the observatory to the water, and a causeway crosses the lake to the Circle of Sages on its islet.
Distinct: the town's terraces are cut by rock bands with stone stairs instead of walls; the lake wraps the town in a
  crescent with its far bank showing across the water; an observatory hall with a telescope tower on the top terrace;
  boathouses on piles and a landing stage at the Sea Road's end; a causeway that leaves the map to the sages' islet.
Topology: one map, no stairs to other floors: the west land gate -> the Sea Road on the middle terrace; stone stairs
  north to the Star Terrace and south to the Lakeside; the causeway south to the Circle (crescent-circle). No boss.
ground legend: . grass  : cobble  , dirt  ~ water  = planks  m rock"""
print(write_map(SITE.TOWN, HEADER, doc, g.text()))

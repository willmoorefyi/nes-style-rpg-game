"""Onrac, the cold port on the Water region's south coast (docs/WORLD_PLAN.md 4.0.1, 4.6; WAT-T) ->
assets-src/maps/onrac.yaml.

  python3 -I assets-src/tools/layouts/water/town_onrac.py && python3 -I assets-src/tools/build_map.py onrac

An original layout. The town fills a frosted shelf between the northern cliffs and the bay. Bell Road comes down from
the land gate in the cliffs to the harbour, past Bell Square, where the sea bell hangs in its stone tower. Three lanes
cross it: Tar Lane under the cliffs (the magic shops, the arms and the north yard where the tar is boiled), Salt Row
through the middle (the drying racks, the item shop, the inn) and the quay along the shingle, where two plank piers
run out into the bay. East of the square the dry dock is a stone-walled basin at the bay's edge, its sea-gate shut
while the shipwright's iron submarine is fitted out in it; and its gangway is the way down to the Sea Shrine (the oxyale gate: `keyItemGates`
requiredItem oxyale, its message in the shipwright's voice; the transition leads to `sea-shrine-b3` entrance `nave`).
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(1, str(HERE))
sys.path.insert(2, str(HERE.parent.parent))
from common import Grid, write_map  # noqa: E402
from kit import landmark_parts  # noqa: E402
from town_common import Outdoor  # noqa: E402
import town_onrac_people as P  # noqa: E402
import town_onrac_site as SITE  # noqa: E402

W, H = 50, 44
ROAD = (23, 24)                                  # Bell Road's two columns, from the land gate to the quay
GATE = (23, 2)                                   # the arrival from the overworld, inside the cliff gap
EXIT = [(x, 0) for x in ROAD]                    # the gap's mouth: back to the overworld (wat_onrac)
TAR_LANE, SALT_ROW, QUAY = (13, 14), (23, 24), (31, 32)
SQUARE = (18, 16, 30, 22)                        # Bell Square
BASIN = (38, 23, 43, 33)                         # the dry dock's stone-walled basin (canal water), its sea-gate shut
HULL = (39, 26)                                  # the submarine, 3x2 cells on the basin water
GANGWAY = (38, 27)                               # the plank onto the hull: the oxyale gate and the way down
DRY_DOCK = (37, 27)                              # the walkway cell in front of the gangway (the return point)
NOTE = """Concept: a cold fishing port of stone and tarred timber on a frosted shelf between the cliffs and the bay: a road
down from a cliff gate past the sea bell's tower to a shingle quay, racks of drying cod, and a stone dry dock where
an iron submarine waits for air that lungs can breathe in the deep.
Distinct: a stone-walled dry-dock basin at the bay's edge, sealed from the sea, with the iron submarine lying in it; a bell tower on its
own square hung with a barnacled bell netted from the sunken city; cod racks between two lanes; tar barrels stacked in
a yard under the cliffs; two plank piers, one with a moored fishing boat.
Topology: one outdoor map: the cliff gate (north) -> Bell Road -> the quay; Tar Lane, Salt Row and the quay cross
it; 6 houses with interiors (bellringer, netmender, smoker, shipwright, healer, tanner), two shut stores, 5 shops
and the inn; the dry dock's gangway leads down to sea-shrine-b3 (the oxyale gate); no stairs."""

g = Grid(W, H, ".")                              # frosted grass (a pale `grass` remap)
# ── the frame: the northern cliffs with the gate gap, the west cliff, the east headland ──
g.rect(0, 0, W - 1, 1, "m")
for (x0, x1) in [(2, 9), (14, 20), (28, 34), (40, 46)]:
    g.rect(x0, 2, x1, 2, "m")                    # the cliff foot is ragged
g.rect(0, 0, 1, 33, "m")
g.rect(47, 0, W - 1, 22, "m")
# ── the bay: shingle under the quay, open water below; the east shore under the headland ──
g.rect(2, 33, W - 1, 33, "s")
g.rect(47, 23, W - 2, 33, "s")
g.rect(W - 1, 23, W - 1, 33, "m")            # the headland's seaward rocks
g.rect(0, 34, W - 1, H - 1, "o")
# ── lanes (cobble): Bell Road, the west lane, Tar Lane, Salt Row, the quay and the square ──
g.rect(ROAD[0], 0, ROAD[1], QUAY[1], ":")
g.rect(2, 3, 3, QUAY[1], ":")
g.rect(2, TAR_LANE[0], 46, TAR_LANE[1], ":")
g.rect(2, SALT_ROW[0], 34, SALT_ROW[1], ":")
g.rect(2, QUAY[0], 37, QUAY[1], ":")
g.rect(*SQUARE, ":")
# ── the dry dock: walkways round the basin, the basin open to the bay, the gangway onto the hull ──
g.rect(35, 21, 46, 22, ":")                      # the north walkway under the shipwright's shed
g.rect(35, 21, 37, QUAY[1], ":")                 # the west walkway, down to the quay
g.rect(44, 15, 46, 33, ":")                      # the east walkway, from Tar Lane to the shore
x0, y0, x1, y1 = BASIN
g.rect(x0, y0, x1, y1, "~")
g.set(*GANGWAY, "=")
# ── the piers: the fishers' pier and the long pier, planks over the shingle and the bay ──
PIERS = [(12, 13, 40), (29, 30, 41)]             # (x0, x1, last row)
for (px0, px1, py) in PIERS:
    g.rect(px0, 33, px1, py, "=")

town = Outdoor()
obj, deco, lamp = town.obj, town.deco, town.lamp
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])


def home(slug, x, y, h, storeys, roof, wall, chimney=None, **kw):
    obj(**HOUSE, name=f"house_{slug}", x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall,
        **({"chimney": chimney} if chimney is not None else {}), **kw,
        enter={"map": f"{SITE.TOWN}-house-{slug}", "entrance": "door"})


def shop(name, part, x, y, h, storeys, roof, wall, sign, chimney=None):
    obj(**HOUSE, name=name, x=x, y=y, h=h, storeys=storeys, roof=roof, wall=wall, sign=sign,
        **({"chimney": chimney} if chimney is not None else {}),
        enter={"map": f"{SITE.TOWN}-{part}", "entrance": "door"})


def snow_fir(x: int, y: int) -> None:            # (x, y) the trunk; the crown is the cell above
    deco([["tree_crown"], ["tree_trunk"]], x, y - 1, above_rows=1, style="snow")


# Tar Lane, under the cliffs (doors on y 12)
shop("white_magic", "white-magic", 4, 8, 5, 2, "blue", "white", "white_magic")
shop("black_magic", "black-magic", 10, 8, 5, 2, "slate", "stone", "black_magic", 3)
home("bellringer", 16, 9, 4, 1, "slate", "stone", 1)
home("netmender", 27, 9, 4, 1, "brown", "plaster", 3)
shop("weapon_shop", "weapon-shop", 33, 8, 5, 2, "brown", "stone", "weapon", 1)
shop("armor_shop", "armor-shop", 39, 8, 5, 2, "slate", "plaster", "armor")
# Salt Row (doors on y 22)
home("smoker", 4, 19, 4, 1, "brown", "stone", 1)
shop("item_shop", "item-shop", 10, 19, 4, 1, "teal", "plaster", "item", 3)
obj(type="prefab", prefab="inn", name="inn", x=30, y=18, w=4, h=5, door=2, sign="inn",
    enter={"map": f"{SITE.TOWN}-inn", "entrance": "door"})
# the quay (doors on y 30); the net store and the salt store are shut for the winter (no door)
home("healer", 4, 26, 5, 2, "slate", "white", None, sign="shrine")
home("tanner", 10, 27, 4, 1, "brown", "plaster", 3)
obj(**{**HOUSE, "windows": [1]}, name="net_store", x=16, y=27, h=4, roof="slate", wall="stone")
obj(**{**HOUSE, "windows": [3]}, name="salt_store", x=27, y=27, h=4, roof="teal", wall="stone")
# the dry dock: the shipwright's shed at the basin's head (door on y 20)
home("shipwright", 39, 16, 5, 2, "slate", "stone", 3)

# ── Bell Square: the bell tower, the well, benches, the signpost by the gate ──
TOWER = (27, 17)
deco(landmark_parts("tower"), *TOWER, style="stone", collide="alpha")
obj(type="well", x=20, y=17)
for x in (19, 20):
    obj(type="bench", x=x, y=21)
SIGNPOST = (22, 4)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
for (x, y) in [(21, 25), (26, 25), (33, 28), (35, 15)]:
    lamp(x, y)

# ── the cod racks between Tar Lane and Salt Row (two racks with a gap between), barrels of salt at their ends ──
for (rx0, rx1) in [(4, 8), (10, 14)]:
    obj(type="fence", **{"from": [rx0, 16], "to": [rx1, 16]})
for (x, y, t) in [(16, 16, "barrel"), (16, 17, "crate"), (17, 18, "barrel")]:
    obj(type=t, x=x, y=y)

# ── the north yard: the tar barrels, firs in the snow, boulders ──
for (x, y, t) in [(12, 4, "barrel"), (13, 5, "barrel"), (15, 6, "crate"), (11, 5, "barrel"), (16, 5, "barrel"),
                  (15, 4, "crate"), (36, 5, "crate"), (37, 5, "barrel")]:
    obj(type=t, x=x, y=y)
for (x, y) in [(5, 5), (9, 6), (19, 5), (21, 7), (30, 5), (32, 7), (39, 6), (44, 5), (46, 7), (26, 7)]:
    snow_fir(x, y)
for (x, y) in [(7, 4), (34, 4), (45, 10)]:
    deco([["boulder"]], x, y)

# ── the quay and the yard by the stores: cargo waiting, a bench by the salt store ──
for (x, y, t) in [(32, 26, "crate"), (33, 26, "barrel"), (34, 26, "crate"), (15, 27, "barrel"), (22, 28, "crate"),
                  (25, 26, "barrel")]:
    obj(type=t, x=x, y=y)
obj(type="bench", x=32, y=30)

# ── the water side: dock posts by the piers, the moored fishing boat, the submarine in the basin ──
POST = [[landmark_parts("dock_post")[0][0]]]
for (x, y) in [(11, 35), (11, 38), (14, 35), (28, 36), (28, 39), (31, 36), (31, 39)]:
    deco(POST, x, y, on_water=True)
deco(landmark_parts("buried_hull"), 14, 37, on_water=True)                     # the fishing boat
deco(landmark_parts("buried_hull"), *HULL, on_water=True, style="slate")       # the iron submarine

INSPECT = [
    {"x": SIGNPOST[0], "y": SIGNPOST[1], "text": P.SIGNPOST_TEXT},
    {"x": TOWER[0], "y": TOWER[1] + 2, "text": P.BELL_TEXT},
]
GATES = [{"x": GANGWAY[0], "y": GANGWAY[1], "requiredItem": "oxyale", "permanent": False, "message": P.GATE_MESSAGE}]

doc = {
    "id": SITE.TOWN,
    "name": "Onrac",
    "kits": ["town", "castle", "overworld"],
    "music": "town",
    "materials": {"grass": {"from": "grass", "sat": 0.45, "shade": 1.12}},
    "entrances": {"gate": list(GATE), "dry_dock": list(DRY_DOCK)},
    "objects": town.objects,
    "npcs": P.outdoor(),
    "inspect": INSPECT,
    "keyItemGates": GATES,
    "transitions": [{"x": x, "y": y, "targetMap": "overworld", "targetEntrance": SITE.ANCHOR} for (x, y) in EXIT]
    + [{"x": GANGWAY[0], "y": GANGWAY[1], "targetMap": "sea-shrine-b3", "targetEntrance": "nave"}],
    "noWander": P.NO_WANDER,
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "canSave": True,
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
}
HEADER = f"""GENERATED by assets-src/tools/layouts/water/town_onrac.py - edit the script, not this file.
{NOTE}
ground legend: . frosted grass  : cobble  ~ the dry dock's basin  = planks  s shingle  o the bay  m cliffs"""

if __name__ == "__main__":
    print(write_map(SITE.TOWN, HEADER, doc, g.text()))

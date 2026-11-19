"""Gaia, the terraced town in the mountain bowl of the far north (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-T) ->
assets-src/maps/gaia.yaml.

  python3 -I assets-src/tools/layouts/wind/town_gaia.py && python3 -I assets-src/tools/build_map.py gaia

An original layout. The town climbs a mountain face in four terraces held up by bands of bare rock, and a gorge with a
snow-melt torrent at its bottom splits every terrace in two. The climb is one switchback: a rock stair joins two
terraces on one side of the gorge, a plank-and-rope footbridge crosses the gorge on the terrace above, and the next
stair rises on the far side. The gate terrace holds the inn and the trade shops, the mill terrace the magic shops
and the windmiller and ropemaker, the loom terrace the healer (the clinic), the spinner, the beekeeper and the
shepherd's fold, and the top terrace is the dry spring court, where a dry sand channel runs down from the grotto in
the cliff (`spring`, the way to `gaia-spring`). Windmills stand on every terrace; not one sail turns.
The people are in `town_gaia_people.py`, the rooms in `town_gaia_homes.py` / `town_gaia_shops.py` and the grotto in
`town_gaia_spring.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from common import Grid, write_map  # noqa: E402
from town_common import Outdoor  # noqa: E402
import town_gaia_people as P  # noqa: E402

W, H = 52, 46
GATE_X = 17                                      # the gate road, columns 17-18 of the bottom edge
GATE = (GATE_X, 43)                              # the arrival from the overworld
EXIT = [(GATE_X, H - 1), (GATE_X + 1, H - 1)]    # back to the overworld (wnd_gaia)
# the terraces (x0, y0, x1, y1) from the gate up, the lane row on each (2 rows: the row and the one below), and the
# rock band (2 rows) under each terrace above the gate's
TERRACES = [(3, 35, 48, 44), (3, 24, 48, 32), (4, 13, 47, 21), (9, 3, 43, 10)]
LANES = [41, 30, 19, 8]                          # the court's walk is the top one
STAIRS = [(7, 33), (44, 33), (46, 22), (12, 11)]  # (x, top row): 2 wide, 2 rows through a band
GROTTO = (24, 2)                                 # the grotto mouth's top-left cell (2x2); its bottom-left cell leads in
SPRING = (GROTTO[0], GROTTO[1] + 2)              # the entrance `spring`, the court cell below the mouth
NOTE = """Concept: a terraced town on a mountain face in four steps of rock, a gorge with a torrent splitting every terrace,
and windmills standing still on every one; the dry spring court at the top.
Distinct: footbridges over the gorge on every terrace; rock stairs on both sides above the gate terrace, then east, then west;
a dry channel of pale sand running from the grotto mouth down through the spring court; a
shepherd's empty fold on the loom terrace; crates of hive frames by the beekeeper's door; a weather-vane arrow on a post in the court; a
well-head on the lip of the gorge where the town hauls its water up from the torrent.
Topology: one outdoor map, the gate in the south -> four terraces joined by 4 rock stairs and 4 footbridges -> the
spring court and the grotto (gaia-spring); 6 houses, 5 shops and the inn open off the terrace lanes; no stairs
inside."""

g = Grid(W, H, "m")
for (x0, y0, x1, y1) in TERRACES:
    g.rect(x0, y0, x1, y1, ".")
# ragged rock where the terraces meet the mountain: shoulders and outcrops
for (x0, y0, x1, y1) in [(3, 35, 4, 36), (47, 35, 48, 37), (3, 24, 4, 25), (47, 24, 48, 24), (4, 13, 5, 13),
                         (47, 13, 47, 13), (9, 3, 11, 3), (40, 3, 43, 4), (42, 5, 43, 6), (9, 4, 9, 5), (3, 44, 9, 44),
                         (28, 44, 34, 44), (44, 44, 48, 44), (3, 32, 3, 32), (48, 32, 48, 32), (20, 3, 23, 3),
                         (26, 3, 29, 3), (38, 3, 39, 3)]:
    g.rect(x0, y0, x1, y1, "m")
# the gorge: a snow-melt torrent from the heights to the foot of the town
GORGE = g.line([(36, 0), (36, 5), (33, 12), (33, 21), (35, 27), (36, 34), (37, 45)], "r", 2)

# lanes (cobble), the gate road, the stairs through the rock bands and the paths up to them
for y in LANES:
    g.rect(4, y, 47, y + 1, ":", only=".")
g.rect(GATE_X, LANES[0], GATE_X + 1, H - 1, ":")
for (x, y) in STAIRS:
    g.rect(x, y, x + 1, y + 1, ":")
g.rect(7, 35, 8, 40, ":", only=".")              # gate terrace -> the west stair
g.rect(7, 32, 8, 32, ":", only=".")              # ... onto the mill lane
g.rect(44, 35, 45, 40, ":", only=".")            # gate terrace -> the east stair
g.rect(44, 32, 45, 32, ":", only=".")
g.rect(46, 24, 47, 29, ":", only=".")            # mill lane -> the east stair up
g.rect(46, 21, 47, 21, ":", only=".")            # ... onto the loom lane
g.rect(12, 13, 13, 18, ":", only=".")            # loom lane -> the west stair up
g.rect(12, 9, 13, 10, ":", only=".")             # ... into the court
g.rect(17, 4, 31, 7, ":", only=".")              # the spring court's paving
# the footbridges: wherever a lane crosses the gorge
BRIDGE_CELLS = sorted({(x, yy) for y in LANES for yy in (y, y + 1) for x in range(W) if g[x, yy] == "r"})
for (x, y) in BRIDGE_CELLS:
    g.set(x, y, "=")
# the dry channel: from the grotto mouth down through the court, dry sand in a stone bed
CHANNEL = [(GROTTO[0] + 1, y) for y in range(4, 8)] + [(GROTTO[0] + 1 + i, 7) for i in range(1, 6)]
for (x, y) in CHANNEL:
    g.set(x, y, "s")

town = Outdoor()
obj, deco, lamp, fir = town.obj, town.deco, town.lamp, town.fir
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])
SNOW = "snow"                                    # the snow recolour of the trees (build_map.RECOLOR, kit.py)


def windmill(x: int, y: int, alpha: bool = True) -> None:   # (x, y) the sails' top-left; 2x3, blocks where its
    # art is (LM-INT: the approved sails leave the top row mostly sky); `alpha` False blocks the whole box
    deco([[f"windmill_icon_{r}_{c}" for c in range(2)] for r in range(3)], x, y, **({"collide": "alpha"} if alpha else {}))


def pine(x: int, y: int) -> None:                # a snowy fir; (x, y) the trunk
    deco([["tree_crown"], ["tree_trunk"]], x, y - 1, above_rows=1, style=SNOW)


# ── the gate terrace (lane y 41-42): the inn, the item and weapon shops, the armour shop beyond the gorge ──
obj(type="prefab", prefab="inn", name="inn", x=10, y=36, w=4, h=5, door=2, sign="inn",
    enter={"map": "gaia-inn", "entrance": "door"})
SHOPS = [("item_shop", "gaia-item-shop", 21, "teal", "plaster", "item", 3),
         ("weapon_shop", "gaia-weapon-shop", 27, "brown", "stone", "weapon", None),
         ("armor_shop", "gaia-armor-shop", 39, "slate", "stone", "armor", 1)]
for (name, mid, x, roof, wall, sign, ch) in SHOPS:
    obj(**HOUSE, name=name, x=x, y=36, h=5, storeys=2, roof=roof, wall=wall, sign=sign,
        **({"chimney": ch} if ch is not None else {}), enter={"map": mid, "entrance": "door"})
# ── the mill terrace (lane y 30-31): the windmiller, the ropemaker, the two magic shops ──
obj(**HOUSE, name="house_windmiller", x=10, y=26, h=4, roof="brown", wall="ochre", chimney=1,
    enter={"map": "gaia-house-windmiller", "entrance": "door"})
obj(**HOUSE, name="house_ropemaker", x=18, y=25, h=5, storeys=2, roof="red", wall="plaster", chimney=3,
    enter={"map": "gaia-house-ropemaker", "entrance": "door"})
obj(**HOUSE, name="white_magic", x=24, y=25, h=5, storeys=2, roof="blue", wall="white", sign="white_magic",
    enter={"map": "gaia-white-magic", "entrance": "door"})
obj(**HOUSE, name="black_magic", x=39, y=25, h=5, storeys=2, roof="slate", wall="stone", sign="black_magic",
    enter={"map": "gaia-black-magic", "entrance": "door"})
# ── the loom terrace (lane y 19-20): the healer, the spinner, the beekeeper, the shepherd and his fold ──
obj(**HOUSE, name="house_healer", x=5, y=15, h=4, roof="red", wall="white", sign="shrine",
    enter={"map": "gaia-house-healer", "entrance": "door"})
obj(**HOUSE, name="house_spinner", x=16, y=14, h=5, storeys=2, roof="teal", wall="rose", chimney=1,
    enter={"map": "gaia-house-spinner", "entrance": "door"})
obj(**HOUSE, name="house_beekeeper", x=24, y=15, h=4, roof="brown", wall="ochre", chimney=3,
    enter={"map": "gaia-house-beekeeper", "entrance": "door"})
obj(**HOUSE, name="house_shepherd", x=37, y=15, h=4, roof="green", wall="stone", chimney=1,
    enter={"map": "gaia-house-shepherd", "entrance": "door"})
SHUTTERED = dict(x=29, y=14, h=5)                # the wind-reader's tall house, shut: no door, a note on its front
obj(type="house", w=4, windows=[1, 2], storeys=2, roof="slate", wall="white", **SHUTTERED)

# ── the stilled windmills: two on the gate terrace, one each on the mill and loom terraces, two in the court ──
for (x, y) in [(4, 37), (33, 36), (15, 26), (21, 13), (10, 4)]:
    windmill(x, y)
windmill(38, 4, alpha=False)                     # its sails' row is a pocket against the cliff: keep it solid
# ── the court: the weather vane, benches, lamps; the grotto mouth in the cliff (the way to the spring) ──
deco([["cave_mouth_icon_0_0", "cave_mouth_icon_0_1"], ["cave_mouth_icon_1_0", "cave_mouth_icon_1_1"]], *GROTTO,
     walk_cells=[[0, 1]], collide="alpha")
VANE = (20, 5)
obj(type="signpost", x=VANE[0], y=VANE[1])
for x in (28, 29):
    obj(type="bench", x=x, y=5)
for (x, y) in [(16, 6), (32, 6)]:
    lamp(x, y)
for (x, y) in [(18, 9), (31, 9), (15, 4), (40, 6)]:
    obj(type="flowers", x=x, y=y)
# ── the well-head on the gorge's lip (the town hauls its water up from the torrent) ──
WINDLASS = (35, 39)
obj(type="well", x=WINDLASS[0], y=WINDLASS[1])
# ── the beekeeper's hives and the shepherd's empty fold ──
for x in (22, 23):                               # the hives (crates) by the beekeeper's door
    obj(type="crate", x=x, y=18)
FOLD = (43, 15, 45, 17)                          # inside the fence
obj(type="fence", **{"from": [FOLD[0] - 1, FOLD[1] - 1], "to": [FOLD[2] + 1, FOLD[1] - 1]})
obj(type="fence", **{"from": [FOLD[0] - 1, FOLD[3] + 1], "to": [FOLD[0] + 1, FOLD[3] + 1]})
obj(type="fence", **{"from": [FOLD[0] + 3, FOLD[3] + 1], "to": [FOLD[2] + 1, FOLD[3] + 1]})
obj(type="fence", **{"from": [FOLD[0] - 1, FOLD[1]], "to": [FOLD[0] - 1, FOLD[3]]})
obj(type="fence", **{"from": [FOLD[2] + 1, FOLD[1]], "to": [FOLD[2] + 1, FOLD[3]]})
for (x, y) in [(43, 15), (45, 16), (44, 17)]:
    deco([["tuft_icon_0_0"]], x, y, block=False)          # LM-INT: the approved grass tuft
# ── snowy pines, bushes, crates and barrels ──
for (x, y) in [(5, 43), (11, 43), (24, 43), (41, 43), (46, 41), (4, 29), (31, 27), (44, 26), (7, 21), (20, 21),
               (10, 9), (41, 9), (36, 21)]:
    pine(x, y)
for (x, y) in [(15, 43), (26, 43), (21, 32), (31, 32), (38, 32), (27, 21), (9, 21), (15, 10), (36, 7)]:
    obj(type="bush", x=x, y=y)
for (x, y, t) in [(20, 40, "barrel"), (26, 40, "crate"), (33, 42, "barrel"), (33, 43, "crate"), (23, 29, "crate"),
                  (17, 29, "barrel"), (10, 17, "crate"), (36, 18, "barrel")]:
    obj(type=t, x=x, y=y)
for (x, y) in [(15, 39), (19, 39), (32, 28), (14, 17), (30, 6)]:
    lamp(x, y)
# ── terrace gardens: potato rows on the gate terrace's lip, a herb bed by the healer's ──
for (x, y) in [(6, 43), (7, 43), (8, 43), (9, 43), (12, 43), (13, 43), (44, 43), (45, 43), (46, 43)]:
    deco([["crops"]], x, y, block=False)
for (x, y) in [(10, 15), (11, 15), (10, 16), (11, 16)]:
    deco([["crops"]], x, y, block=False)
SIGNPOST = (19, 43)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])

INSPECT = [
    {"x": SIGNPOST[0], "y": SIGNPOST[1], "text": P.SIGNPOST_TEXT},
    {"x": VANE[0], "y": VANE[1], "text": [{"condition": P.FREED, "text": P.VANE_FREED}, {"text": P.VANE_TEXT}]},
    {"x": SHUTTERED["x"] + 1, "y": SHUTTERED["y"] + SHUTTERED["h"] - 1, "text": P.SHUTTERED_TEXT},
    {"x": WINDLASS[0], "y": WINDLASS[1], "text": P.WINDLASS_TEXT},
]

doc = {
    "id": "gaia",
    "name": "Gaia",
    "kits": ["town", "castle", "overworld"],
    "music": "town",
    "entrances": {"gate": list(GATE), "spring": list(SPRING)},
    "objects": town.objects,
    "npcs": P.outdoor(),
    "inspect": INSPECT,
    "transitions": [{"x": x, "y": y, "targetMap": "overworld", "targetEntrance": "wnd_gaia"} for (x, y) in EXIT]
    + [{"x": GROTTO[0], "y": GROTTO[1] + 1, "targetMap": "gaia-spring", "targetEntrance": "arrival"}],
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "canSave": True,
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
}
HEADER = f"""GENERATED by assets-src/tools/layouts/wind/town_gaia.py - edit the script, not this file.
{NOTE}
ground legend: . grass  : cobble  s dry channel (sand)  = footbridge  r the gorge torrent  m mountain rock"""

if __name__ == "__main__":
    print(write_map("gaia", HEADER, doc, g.text()))

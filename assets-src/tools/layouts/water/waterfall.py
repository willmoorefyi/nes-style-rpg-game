"""The waterfall cave (docs/WORLD_PLAN.md 4.6; WAT-O) -> assets-src/maps/waterfall-cave.yaml.

  python3 -I assets-src/tools/layouts/water/waterfall.py && python3 -I assets-src/tools/build_map.py waterfall-cave

One floor, 30x22, entered from the ledge behind the falls (overworld `wat_waterfall`, reached only by canoe). A wet
ramp climbs from the curtain into the spray hall, which a channel of falls water cuts in two: one footbridge crosses
it. North of the bridge a short passage leads to the vault where the automaton keeps the cube (S21: `giftItem: cube`,
`giftFlag: CUBE_GIVEN`, then the cutscene `wat_cube_given`, the lore of its twin). Two dripping galleries branch off
the hall, the west one from the north bank and the east one from the south bank, each ending at a chest.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room  # noqa: E402

MAP, W, H = "waterfall-cave", 30, 22
GAP = (14, 15)                                   # the exit on the bottom row, back to the ledge
HEADER = """Concept: a sanctum hidden behind the falls, where an automaton of old make has stood watch over a humming cube
  for centuries; the falls' water runs through the hall in a cut channel and the spray drips off every wall.
Distinct: a falls-fed channel splitting the hall, crossed by one footbridge; two dripping side galleries off
  opposite banks; the automaton's workbench and a worn statue whose plinth shows its twin.
Topology: one floor, no stairs: entry ramp -> spray hall (footbridge over the channel) -> passage -> the vault (the
  automaton); the west gallery leaves the hall's north bank, the east gallery its south bank, each a dead end with a
  chest. No boss.
legend: W wall top  F wall face  - wet stone floor  ≈ falls water  = footbridge"""
MATS = {"floor_stone": {"from": "ar_cave"},                     # AR-T2: the AR cave floor
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.4},
        "in_wall_face": {"from": "temple_wall_face", "hue": 150, "sat": 0.6, "shade": 1.0}}
AUTOMATON = {
    "id": "automaton", "x": 14, "y": 4, "sprite": "knight", "tint": "#c8a860",
    "dialog": [
        {"condition": "CUBE_GIVEN",
         "text": ["The automaton stands still again. Somewhere in its chest a slow tick keeps time with the falls."]},
        {"text": ["Brass shutters slide back from two lamp-eyes. A voice like a wound-down music box:",
                  "\"Visitor. Warm hands, at last. I have held this for the sky folk longer than the river has run "
                  "this way.\"",
                  "\"They are not coming back for it. Take it to a tower that remembers them, and it will open.\"",
                  "The cube leaves the brass hands, and the automaton's lamp-eyes flicker."]},
    ],
    "giftItem": "cube", "giftFlag": "CUBE_GIVEN",
    "cutscene": {"id": "wat_cube_given", "requiredFlag": "CUBE_GIVEN", "onceFlag": "WAT_O_TWIN_TOLD"},
}
CARVING = ["A stone likeness of the automaton, worn smooth by the spray. Scratched into its plinth is a second "
           "figure of the same make, taller, holding a blade where this one holds a lantern."]


def build() -> Room:
    r = Room(MAP, "Waterfall Cave", W, H)
    g = r.g
    g.carve(GAP[0], H - 1, GAP[1], H - 1)        # the curtain gap
    g.carve(13, 16, 16, 20)                      # the wet ramp
    g.carve(5, 11, 24, 16)                       # the spray hall
    g.carve(5, 13, 24, 13, "≈")                  # the channel of falls water ...
    g.carve(14, 13, 15, 13, "=")                 # ... and its footbridge
    g.carve(2, 4, 3, 12)                         # the west gallery (from the north bank)
    g.carve(4, 11, 4, 12)
    g.carve(26, 6, 27, 16)                       # the east gallery (from the south bank)
    g.carve(25, 15, 25, 16)
    g.carve(14, 8, 15, 10)                       # the passage to the vault
    g.carve(8, 3, 21, 7)                         # the vault
    g.faces()
    r.npcs.append(dict(AUTOMATON))
    r.npcs += [
        {"id": "chest_wat_o_falls_west", "sprite": "chest", "x": 2, "y": 4, "chestItem": "ether",
         "chestFlag": "CHEST_WAT_O_FALLS_WEST", "dialog": ["You found an Ether!"]},
        {"id": "chest_wat_o_falls_east", "sprite": "chest", "x": 27, "y": 6, "chestItem": "hi_potion",
         "chestFlag": "CHEST_WAT_O_FALLS_EAST", "dialog": ["You found a Hi-Potion!"]},
    ]
    r.deco([["map_table_l", "map_table_r"]], 10, 4)          # the automaton's workbench
    r.deco([["lectern"]], 18, 4)
    for x in (9, 20):
        r.pillar(x, 6)
    r.statue(12, 3)
    for x, y in ((5, 9), (24, 9), (2, 2), (27, 4)):
        r.deco([["vines"]], x, y, on_wall=True, block=True)
    r.deco([["urn"]], 6, 15)
    r.deco([["urn"]], 23, 11)
    r.transitions += [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "wat_waterfall"} for x in GAP]
    return r


def main() -> None:
    r = build()
    extra = {"inspect": [{"x": 12, "y": 3, "text": list(CARVING)}], "exit": {"map": "overworld",
             "entrance": "wat_waterfall"}, "no_static_chokepoints": True, "no_unreachable_walkable": True}
    print(r.write(HEADER, {"arrival": [GAP[0], H - 2]}, kits=["temple", "castle", "interior", "town"], mats=MATS,
                  trim=None, quiet={"encounterRate": {"min": 999, "max": 999}, "encounters": []},
                  script="water/waterfall.py", legend="", music="dungeon", extra=extra))


if __name__ == "__main__":
    main()

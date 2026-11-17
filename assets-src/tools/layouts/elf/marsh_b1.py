"""Marsh Cave B1 (docs/WORLD_PLAN.md 4.2, stage S5; ELF-D) -> assets-src/maps/marsh-cave-b1.yaml.

  python3 -I assets-src/tools/layouts/elf/marsh_b1.py && python3 -I assets-src/tools/build_map.py marsh-cave-b1

A peat bog in a flooded cavern under the fens. Four mud banks stand in black water: the south bank (the way in), the
west and east banks (each with a stair down to its own half of B2) and the north mound, the roof of the drowned
barrow below. Single-plank boardwalks join them in one ring. Peat shoals spread off the banks; one joins the south
bank to the west bank, a short cut that burns. Two dead-end boardwalks end at chests, a third at a rotten pier.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marsh_common import Floor, chest, talk  # noqa: E402

NOTE = ("Concept: a drowned fen cavern under the elven marshes, where the bog seeped down into an old barrow and the "
        "elves laid boardwalks across the black water to reach it.\n"
        "Distinct: four mud banks in a ring of single-plank boardwalks; peat shoals that burn the feet, one of them a "
        "short cut between two banks; two stairs down to two halves of the floor below that never meet there; the "
        "barrow's sunken door showing under the north mound; a rotten pier that leads nowhere.\n"
        "Topology: B1 (2 stairs: west and east) -> B2 west half and B2 east half (not joined on B2); B2 west -> B3 "
        "by stair, one-way pit B2 east -> B3; B3 boss north-west of the arrival.")
W, H = 40, 32
GATE = (19, 20)                          # the bottom-row exit cells, up the bank to the fens


def build() -> Floor:
    f = Floor("marsh-cave-b1", "Marsh Cave B1", W, H)
    g = f.g
    g.rect(2, 4, 37, 28, "≈")            # the black water
    for x0, y0, x1, y1 in ((2, 4, 4, 6), (35, 4, 37, 5), (2, 26, 8, 28), (33, 27, 37, 28), (12, 13, 13, 15),
                           (26, 15, 27, 17)):
        g.rect(x0, y0, x1, y1, "W")      # rock knuckles in the water
    g.rect(4, 21, 12, 24, "w")           # the south-west peat shoal
    g.rect(9, 20, 14, 22, "w")           # ... which reaches the south bank: the burning short cut
    g.rect(15, 9, 24, 11, "w")           # the peat skirt below the north mound
    g.rect(27, 21, 35, 24, "w")          # the south-east peat shoal
    g.rect(15, 22, 24, 27, "-")          # the south bank
    g.rect(GATE[0], 28, GATE[1], H - 1, "-")   # the bank up to the fens
    g.rect(3, 13, 10, 19, "-")           # the west bank
    g.rect(29, 13, 36, 19, "-")          # the east bank
    g.rect(14, 4, 25, 8, "-")            # the north mound, the barrow's roof
    g.rect(17, 5, 22, 7, "+")            # the hollow where the barrow breathes up
    for pts in (((14, 25), (7, 25), (7, 20)),       # the ring of boardwalks: south -> west
                ((8, 12), (8, 6), (13, 6)),         # west -> north
                ((26, 6), (31, 6), (31, 12)),       # north -> east
                ((32, 20), (32, 25), (25, 25)),     # east -> south
                ((4, 12), (4, 8)),                  # dead end to the west chest
                ((35, 12), (35, 8)),                # dead end to the east chest
                ((25, 27), (29, 27))):              # the rotten pier
        g.line(list(pts), "_", width=1)
    g.set(29, 27, "%")                   # the pier's broken end
    g.faces(2)
    f.stairs_down(4, 15, "marsh-cave-b2", "arrival")         # the west stair, to B2's west half
    f.stairs_down(34, 15, "marsh-cave-b2", "arrival_east")   # the east stair, to B2's east half
    f.transitions += [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "elf_marsh"} for x in GATE]
    f.deco([["fallen_l", "fallen_r"]], 6, 13)
    f.deco([["skulls"]], 16, 26)
    f.deco([["skulls"]], 33, 18)
    for x in (9, 30):
        f.deco([["vines"]], x, 2, on_wall=True)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 15, 4)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 24, 4)
    f.npcs += [
        chest("b1_west", "hi_potion", "a Hi-Potion", 4, 8),
        chest("b1_east", "antidote", "an Antidote", 35, 8),
        {"id": "elf_d_fenwarden", "sprite": "guard", "tint": "#7f9a6a", "x": 22, "y": 24, "dialog": talk(
            ["Fenwarden Ysolde: Keep to the planks. The brown shoals look like firm ground, and they eat your boots "
             "and then your feet.", "Both stairs go down to the same hall, the old ones say. They are wrong. The "
             "hall below was split when the barrow sank."],
            ["Fenwarden Ysolde: The water has gone still since you came up. Whatever kept the barrow is quiet.",
             "The crown you carry was never the marsh's to keep. Take it north to the keep on the arm."])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 19, "y": 3, "text": [
        "Under the mound the rock is cut square: a door lintel, carved with reeds, sunk to its shoulders in the bog.",
        "Whatever was buried here, the elves who buried it are long gone. The way in must lie deeper."]}]
    print(f.write("b1", "Marsh Cave B1: a peat bog under the fens; a ring of boardwalks over black water.\n" + NOTE,
                  {"arrival": [GATE[0], H - 3], "down": [4, 17], "down_east": [34, 17]},
                  extra={"inspect": inspect}))


if __name__ == "__main__":
    main()

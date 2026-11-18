"""Ice Cavern B1 (docs/WORLD_PLAN.md 4.4, stage S16; FIR-D2) -> assets-src/maps/ice-cavern-b1.yaml.

  python3 -I assets-src/tools/layouts/fire/ice_b1.py && python3 -I assets-src/tools/build_map.py ice-cavern-b1

The mouth opens south (WORLD 4.4: below the cliff rows) into a hall of frozen pillars. Three branches leave it: north
to the stair chamber (the way down) and its blind cutters' alcove; west up a long gully to the frozen fall's grotto
(a chest, and a dead-end spur); east to the meltwater pool (a chest, a dead-end drain). Two pockets of the floor are
cut off from the hall: the west pocket and the north-east pocket are reached only by breaking through B2's cracked
ice (the hot spring under it throws you up a meltwater spout), and each has a stair back down to B2's arrival (the
west one also holds a chest).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ice_common import DONE, Floor, chest, talk  # noqa: E402

NOTE = ("Concept: a cavern of blue ice under the Frost Hollow, where meltwater from a hot seam far below freezes again "
        "on the way up, and a guild of ice-cutters once quarried the clear ice for the lake town's cellars.\n"
        "Distinct: a hall of frost-whitened pillars with three branches and a frozen fall at the end of one; "
        "cracked ice over a hot spring that, when it gives way, throws you up a meltwater spout into a sealed pocket "
        "of the floor above, with a stair back down as the only way out; an old ice-cutter who still works the "
        "shelf that hides the true stair.\n"
        "Topology: B1 (stair down) -> B2 (one-way pits, the cracked cells, up to B1's two pockets, each with a "
        "stair down to B2's arrival); B2 -> B3 by the stair behind the ice shelf (opened on FIR_D2_SHELF); B3 boss north-east of the "
        "arrival.")
W, H = 40, 34
GATE = (19, 20)                          # the bottom-row exit cells, out of the south mouth to the Frost Hollow


def build() -> Floor:
    f = Floor("ice-cavern-b1", "Ice Cavern B1", W, H)
    g = f.g
    g.rect(GATE[0], 29, GATE[1], H - 1, "-")   # the mouth, up from the hollow
    g.rect(12, 15, 27, 28, "-")          # the hall of frozen pillars
    g.rect(15, 24, 24, 27, "+")          # a sheet of clear ice before the mouth
    g.rect(19, 9, 20, 14, "-")           # north branch: the corridor to the stair chamber
    g.rect(14, 4, 25, 8, "-")            # the stair chamber
    g.rect(11, 6, 13, 6, "_")            # the cutters' alcove off it (a dead end)
    g.line([(11, 21), (5, 21), (5, 12)], "-", width=2)    # west branch: the long gully
    g.rect(2, 4, 8, 11, "-")             # the frozen fall's grotto
    g.rect(5, 5, 7, 7, "≈")              # the pool under the fall
    g.rect(7, 16, 9, 16, "_")            # a snow-choked spur off the gully (a dead end)
    g.line([(28, 24), (31, 24)], "-", width=2)            # east branch, to the meltwater pool
    g.rect(30, 13, 37, 23, "-")          # the pool chamber
    g.rect(32, 15, 35, 19, "≈")          # the meltwater pool
    g.rect(36, 24, 36, 28, "_")          # the drain below it (a dead end)
    g.rect(2, 26, 8, 31, "+")            # the west pocket (the pit from B2's west lands here)
    g.rect(30, 3, 37, 9, "+")            # the north-east pocket (the pit from B2's east)
    g.faces(2)
    f.stairs_down(19, 5, "ice-cavern-b2", "arrival")
    f.stairs_down(3, 27, "ice-cavern-b2", "arrival")         # the west pocket's only way out, back down
    f.stairs_down(35, 4, "ice-cavern-b2", "arrival")         # the north-east pocket's
    f.transitions += [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "fir_ice"} for x in GATE]
    for x, y in ((14, 17), (24, 17), (14, 21), (24, 21), (17, 19), (22, 19)):
        f.pillar(x, y)
    f.floe(3, 9)
    f.floe(31, 21)
    f.floe(6, 29)
    f.deco([["skulls"]], 25, 5)
    f.deco([["fallen_l", "fallen_r"]], 12, 27)
    f.npcs += [
        chest("b1_grotto", "hi_potion", "a Hi-Potion", 2, 4),
        chest("b1_pool", "ether", "an Ether", 37, 13),
        chest("b1_pocket", "cabin", "a Cabin", 2, 31),
        {"id": "fir_d2_cutter", "sprite": "farmer", "tint": "#c8dcec", "x": 17, "y": 26, "dialog": talk(
            (DONE, ["Ice-cutter Brannoc: The cold has gone out of the deep ice. You did that, didn't you? The whole "
                    "cavern sighed an hour ago, like a sleeper turning over."]),
            (None, ["Ice-cutter Brannoc: Mind the white ice below. Where it is crazed like an old plate, it won't "
                    "hold a cat. My brother went through it once, and the hot spring under it spat him straight up "
                    "into a hole on this floor he'd never seen.",
                    "The stair you'll find is not the end of it. My father hid the last stair behind a shelf of ice "
                    "on the lower floor, to keep the quarry to ourselves. Old Hesk still sits by it."]))},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 6, "y": 3, "text": [
        "A waterfall hangs frozen from the roof, every ripple stopped. Behind the ice, something pale and round "
        "seems to watch you, then is gone."]}]
    print(f.write("b1", "Ice Cavern B1: a hall of frozen pillars with three branches; two sealed pockets.\n" + NOTE,
                  {"arrival": [GATE[0], H - 3], "down": [19, 7], "pocket_w": [6, 27], "pocket_e": [32, 5]},
                  extra={"inspect": inspect}, roots=["pocket_w", "pocket_e"]))


if __name__ == "__main__":
    main()

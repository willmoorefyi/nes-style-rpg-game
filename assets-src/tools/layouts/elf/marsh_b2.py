"""Marsh Cave B2 (docs/WORLD_PLAN.md 4.2, stage S5; ELF-D) -> assets-src/maps/marsh-cave-b2.yaml.

  python3 -I assets-src/tools/layouts/elf/marsh_b2.py && python3 -I assets-src/tools/build_map.py marsh-cave-b2

Two halves on one map with a rock spine between them; they are joined only through B1 (each has its own stair up).
West half: the arrival hall, a peat neck straight down to the fog-filled eel pool (or a boardwalk round by the east
wall), and the stair down to B3 beside the pool. East half: the arrival room, a gallery north to the ledge, and the
ledge's boardwalk west to where it has collapsed: the one-way pit to B3. Four chests, two in each half.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marsh_b1 import NOTE  # noqa: E402
from marsh_common import Floor, chest, talk  # noqa: E402

W, H = 46, 30
PIT = [(27, 5), (27, 6)]                 # the collapsed end of the north ledge


def west(f: Floor) -> None:
    g = f.g
    g.rect(2, 5, 10, 10, "-")            # the arrival hall
    g.rect(10, 2, 10, 4, "_")            # the north niche (a dead end)
    g.rect(5, 11, 6, 16, "w")            # the peat neck, straight down to the pool hall
    g.line([(11, 7), (16, 7), (16, 16)], "_", width=1)   # ... or the boardwalk round by the east wall
    g.rect(2, 17, 17, 25, "+")           # the eel pool hall, in fog
    g.rect(6, 19, 12, 23, "≈")           # the eel pool
    g.line([(3, 26), (3, 28)], "_", width=1)             # the drowned alcove (a dead end)
    g.rect(18, 19, 20, 20, "w")          # a peat bay off the pool hall


def east(f: Floor) -> None:
    g = f.g
    g.rect(30, 21, 40, 27, "-")          # the arrival room
    g.rect(31, 26, 35, 27, "w")          # its peat corner
    g.line([(29, 25), (26, 25)], "_", width=1)           # the west alcove (a dead end)
    g.line([(41, 24), (43, 24), (43, 7)], "-", width=2)  # the gallery north to the ledge
    g.rect(27, 5, 44, 6, "_")            # the north ledge's boardwalk
    g.line([(42, 14), (37, 14)], "_", width=1)           # the side cut to the sunken boat (a dead end)
    for x, y in PIT:
        g.set(x, y, "%")                 # where the boardwalk gave way


def build() -> Floor:
    f = Floor("marsh-cave-b2", "Marsh Cave B2", W, H)
    west(f)
    east(f)
    f.g.faces(2)
    f.stairs_up(3, 3, "marsh-cave-b1", "down")               # the west half's stair, back to B1's west bank
    f.stairs_up(34, 19, "marsh-cave-b1", "down_east")        # the east half's stair, back to B1's east bank
    f.stairs_down(13, 23, "marsh-cave-b3", "arrival")        # beside the eel pool, down to the barrow
    f.transitions += [{"x": x, "y": y, "targetMap": "marsh-cave-b3", "targetEntrance": "pit"} for x, y in PIT]
    f.deco([["skulls"]], 4, 9)
    f.deco([["fallen_l", "fallen_r"]], 35, 23)
    f.deco([["vines"]], 9, 15, on_wall=True)
    for x in (31, 39):
        f.deco([["vines"]], x, 3, on_wall=True)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 2, 17)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 16, 24)
    f.npcs += [
        chest("b2_niche", "phoenix_down", "a Phoenix Down", 10, 2),
        chest("b2_alcove", "mythril_helm", "a Mythril Helm", 3, 28),
        chest("b2_boat", "ether", "an Ether", 37, 14),
        chest("b2_sluice", "power_staff", "a Power Staff", 26, 25),
        {"id": "elf_d_drowned_scout", "sprite": "old_man", "tint": "#9fb8c8", "x": 15, "y": 18, "dialog": talk(
            ["A pale elf sits by the pool, wet to the skin, though no water drips from him.",
             "\"We came down for the king's crown when the marsh took his escort. Three things came up out of the "
             "water below and we did not go back up.\"",
             "\"The east stair from the bog above leads to a ledge that will not hold you. That is the fast way down. "
             "It is not a way back.\""],
            ["The pale elf is gone. A ring of dry stone shows where he sat."])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 28, "y": 4, "text": [
        "The boardwalk ends in splinters. Below, a shaft drops into the dark, and something far down drips."]}]
    print(f.write("b2", "Marsh Cave B2: two halves split by the sunken barrow's wall, each with its own stair from "
                        "B1.\n" + NOTE,
                  {"arrival": [3, 5], "arrival_east": [34, 21], "down": [13, 22]},
                  extra={"canSave": False, "inspect": inspect}, roots=["arrival_east"]))


if __name__ == "__main__":
    main()

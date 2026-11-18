"""Sea Shrine B4, the flooded halls (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D) -> assets-src/maps/sea-shrine-b4.yaml.

  python3 -I assets-src/tools/layouts/water/shrine_b4.py && python3 -I assets-src/tools/build_map.py sea-shrine-b4

Two routes from the stair room (north-east, the stair up to the nave) to the throne below, each to its own stairwell.
East and round, the flooded halls: down a passage to the channel hall (a plank bridge over the channel), then the long
pool hall, west along the pools to the stairwell `down`. West, the sunken library: a corridor to the stacks, rows of
shelves standing in the tide with a sinkhole among them, and south down the copyists' stair to the reading room and
the stairwell `down_west`. The routes meet only in the stair room. Four chests: two in the halls, two in the library.
The whole floor is the boss approach (`canSave: false`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shrine_common import NOTE, Floor, chest, talk  # noqa: E402

W, H = 46, 36


def halls(f: Floor) -> None:
    g = f.g
    g.rect(40, 10, 41, 13, "-")          # the passage south from the stair room
    g.rect(33, 14, 43, 20, "-")          # the channel hall ...
    g.rect(33, 17, 43, 17, "≈")          # ... cut by the channel ...
    g.rect(37, 17, 38, 17, "_")          # ... and its plank bridge
    g.rect(44, 15, 44, 15, "_")          # the channel hall's east alcove (a dead end)
    g.rect(38, 21, 39, 24, "-")          # the passage south to the pool hall
    g.rect(24, 25, 43, 31, "-")          # the long pool hall
    for x0 in (29, 34, 39):
        g.rect(x0, 27, x0 + 2, 29, "≈")  # its three pools
    g.rect(33, 32, 33, 33, "_")          # the pool hall's south drain (a dead end)


def library(f: Floor) -> None:
    g = f.g
    g.rect(26, 6, 35, 7, "-")            # the corridor west from the stair room
    g.rect(4, 4, 25, 17, "+")            # the sunken library, kelp-dark
    g.rect(14, 9, 17, 11, "≈")           # the sinkhole among the stacks
    g.rect(2, 10, 3, 10, "_")            # a copyist's carrel (a dead end)
    g.rect(20, 2, 20, 3, "_")            # the map closet (a dead end)
    g.rect(6, 18, 7, 26, "-")            # the copyists' stair passage south
    g.rect(3, 27, 12, 32, "-")           # the reading room


def build() -> Floor:
    f = Floor("sea-shrine-b4", "Sea Shrine B4", W, H)
    f.g.rect(36, 4, 43, 9, "-")          # the stair room (from the nave)
    halls(f)
    library(f)
    f.g.faces(2)
    f.stairs_up(39, 2, "sea-shrine-b3", "down")              # back up to the nave
    f.stairs_down(26, 28, "sea-shrine-b5", "arrival")        # the halls' stairwell, to the throne's south door
    f.stairs_down(8, 30, "sea-shrine-b5", "arrival_west")    # the library's stairwell, to the throne's west door
    for y in (6, 13):                    # the stacks: rows of shelves standing in the tide
        for x in (6, 8, 10, 19, 21, 23):
            f.deco([["bookshelf_top"], ["bookshelf_bottom"]], x, y)
    f.deco([["lectern"]], 12, 15)
    f.deco([["globe"]], 24, 4)
    f.deco([["desk"]], 4, 28)
    f.deco([["map_table_l", "map_table_r"]], 9, 27)
    for x, y in ((34, 14), (42, 18), (24, 25), (43, 25)):
        f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], x, y)
    f.deco([["fallen_l", "fallen_r"]], 35, 19)
    f.deco([["skulls"]], 42, 30)
    for x in (28, 37):
        f.deco([["vines"]], x, 24, on_wall=True)
    f.npcs += [
        chest("b4_alcove", "coral_sword", "a Coral Sword", 44, 15),
        chest("b4_drain", "ether", "an Ether", 33, 33),
        chest("b4_carrel", "diamond_armlet", "a Diamond Armlet", 2, 10),
        chest("b4_closet", "phoenix_down", "a Phoenix Down", 20, 2),
        {"id": "wat_d_librarian", "sprite": "old_man", "tint": "#8fb0b8", "x": 11, "y": 29, "dialog": talk(
            ["A drowned librarian sits at the map table, his finger on a chart of a city that is not there any more.",
             "\"The sky folk sent a tablet of their tongue down to us, long ago, so the sea could speak with the "
             "air. We were to copy it. We never finished.\"",
             "\"The king carried it down to his throne. A scholar on the land could finish what we began, if the "
             "tablet ever saw the sun.\""],
            ["The librarian has let go of the chart.",
             "\"Find a scholar who loves dead tongues. The sky folk's words were never meant to stay under water.\""])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 15, "y": 9, "text": [
        "The floor among the stacks has given way. Books float in the sinkhole, their ink running out of them in "
        "slow blue threads."]}]
    print(f.write("b4", "Sea Shrine B4: the flooded halls; two routes from the stair room, each to its own stairwell "
                        "down.\n" + NOTE,
                  {"arrival": [39, 4], "down": [26, 27], "down_west": [8, 29]},
                  extra={"canSave": False, "inspect": inspect}))


if __name__ == "__main__":
    main()

"""Sea Shrine B5, the drowned throne (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D) -> assets-src/maps/sea-shrine-b5.yaml.

  python3 -I assets-src/tools/layouts/water/shrine_b5.py && python3 -I assets-src/tools/build_map.py sea-shrine-b5

The bottom of the shrine. The halls' stairwell comes up in the south vestibule (`arrival`), the library's in the west
vestibule (`arrival_west`). A drowned court fills the middle; two galleries climb its sides, joined across the water by
a causeway, to the throne terrace in the north, where the Drowned Sovereign sits with the sky folk's tablet on his
breast (drowned_sovereign; his fall, `wat_drowned_falls`, lights the water crystal in its socket behind the throne and
gives the slab). Two chests in niches off the terrace and the east gallery. The boss approach (`canSave: false`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shrine_common import DONE, NOTE, Floor, chest  # noqa: E402

W, H = 32, 34
KING = (15, 7)                           # the Drowned Sovereign before his throne


def build() -> Floor:
    f = Floor("sea-shrine-b5", "Sea Shrine B5", W, H)
    g = f.g
    g.rect(7, 4, 24, 11, "+")            # the throne terrace, kelp-dark
    g.rect(7, 12, 8, 30, "-")            # the west gallery
    g.rect(23, 12, 24, 30, "-")          # the east gallery
    g.rect(9, 12, 22, 26, "≈")           # the drowned court
    g.rect(9, 18, 22, 19, "_")           # the causeway across it
    g.rect(13, 29, 18, 31, "-")          # the south vestibule (the halls' stair)
    g.rect(9, 30, 12, 30, "-")           # its west door to the gallery
    g.rect(19, 30, 22, 30, "-")          # its east door
    g.rect(2, 22, 5, 25, "-")            # the west vestibule (the library's stair)
    g.rect(6, 23, 6, 24, "-")            # its door to the west gallery
    g.rect(4, 8, 6, 8, "_")              # the terrace's west niche (a dead end)
    g.rect(25, 27, 28, 27, "_")          # the east gallery's niche (a dead end)
    g.faces(2)
    f.stairs_up(15, 27, "sea-shrine-b4", "down")             # back up the halls' stair
    f.stairs_up(3, 20, "sea-shrine-b4", "down_west")         # back up the library's stair
    f.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 15, 4)
    for x in (8, 23):
        f.deco([["statue_top"], ["statue_bottom"]], x, 4)
    for x, y in ((11, 5), (20, 5), (11, 10), (20, 10)):
        f.deco([["brazier"]], x, y)
    f.deco([["skulls"]], 24, 15)
    f.deco([["fallen_l", "fallen_r"]], 17, 10)
    for x in (10, 21):
        f.deco([["vines"]], x, 28, on_wall=True)
    f.npcs += [
        chest("b5_niche_w", "diamond_shield", "a Diamond Shield", 4, 8),
        chest("b5_niche_e", "hi_potion", "a Hi-Potion", 28, 27),
        {"id": "wat_d_sovereign", "sprite": "king", "tint": "#3d6f78", "x": KING[0], "y": KING[1], "hideIf": DONE,
         "dialog": ["A king sits before his throne in robes that move as if a current runs through them. A grey tablet "
                    "hangs on a chain at his breast."]},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 19, "y": 3, "text": [
        {"condition": DONE, "text": ["In the socket behind the throne the water crystal burns a clear sea-blue. The "
                                     "court below is draining, step by step."]},
        {"text": ["A socket in the wall behind the throne holds a crystal the colour of deep water, dark as a "
                  "closed eye."]}]}]
    encounter = {"x": KING[0], "y": KING[1], "npc": "wat_d_sovereign", "enemyIds": ["drowned_sovereign"], "flag": DONE,
                 "isBoss": True, "postVictoryCutscene": "wat_drowned_falls",
                 "message": "The king lifts his head. \"You came down through my sea. Then you know it is calm. Stay, "
                            "and you will never be afraid of a storm again.\""}
    print(f.write("b5", "Sea Shrine B5: the drowned throne; the throne terrace lies north of the south vestibule.\n"
                  + NOTE, {"arrival": [15, 29], "arrival_west": [3, 22], "boss": [KING[0], KING[1] + 2]},
                  extra={"canSave": False, "inspect": inspect, "scriptedEncounters": [encounter]}, throne=True))


if __name__ == "__main__":
    main()

"""Marsh Cave B3, the drowned barrow (docs/WORLD_PLAN.md 4.2, stage S5; ELF-D) -> assets-src/maps/marsh-cave-b3.yaml.

  python3 -I assets-src/tools/layouts/elf/marsh_b3.py && python3 -I assets-src/tools/build_map.py marsh-cave-b3

The barrow under the bog. The stair from B2's west half comes down into the flooded antechamber (south-east); the
pit from B2's ledge drops into the fallen gallery (north-east). Two ways run west: the long south passage, half drowned
in peat, to the burial gallery and its niches; or the fog-dark crypt of pillars in the middle. The burial gallery
climbs north to the bier hall (north-west), where the crown lies and its three keepers wait (piscodemon x3; the
cutscene `elf_d_crown` gives the crown). The whole floor is the boss approach (`canSave: false`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marsh_b1 import NOTE  # noqa: E402
from marsh_common import DONE, Floor, chest, talk  # noqa: E402

W, H = 38, 36
BIER = (7, 4)                          # the crown on its bier: talking to it wakes the keepers
GUARD = ["piscodemon", "piscodemon", "piscodemon"]


def build() -> Floor:
    f = Floor("marsh-cave-b3", "Marsh Cave B3", W, H)
    g = f.g
    g.rect(26, 27, 35, 32, "-")          # the flooded antechamber (the stair from B2)
    g.rect(31, 31, 34, 32, "≈")          # its sump
    g.rect(8, 30, 25, 31, "-")           # the long south passage ...
    g.rect(12, 30, 19, 31, "w")          # ... half drowned in peat
    g.rect(4, 12, 7, 31, "-")            # the burial gallery, south to north
    for y, x0, x1 in ((16, 1, 3), (22, 8, 10), (26, 8, 12)):
        g.rect(x0, y, x1, y, "_")        # burial niches off the gallery (dead ends)
    g.rect(2, 3, 13, 9, "+")             # the bier hall, in fog
    g.rect(5, 10, 6, 11, "-")            # the bier hall's door
    g.rect(14, 14, 24, 24, "+")          # the crypt of pillars, in fog
    g.rect(8, 19, 13, 20, "-")           # crypt <-> burial gallery
    g.line([(24, 24), (27, 24), (27, 26)], "-", width=2)   # crypt <-> antechamber
    g.rect(26, 4, 34, 10, "%")           # the fallen gallery (the pit from B2 lands here)
    g.rect(28, 6, 32, 9, "-")
    g.rect(35, 7, 36, 7, "_")            # its east niche (a dead end)
    g.line([(29, 11), (29, 16), (25, 16)], "-", width=2)   # fallen gallery -> crypt
    g.rect(18, 25, 18, 27, "_")          # a dead-end drain below the crypt
    g.rect(5, 32, 5, 34, "_")            # the cist below the gallery's foot (a dead end)
    g.faces(2)
    f.stairs_up(30, 25, "marsh-cave-b2", "down")             # back up to B2's west half
    f.deco([["altar_l", "altar_r"]], 7, 3)                   # the bier
    f.deco([["crown_cushion"]], 9, 3)
    for x, y in ((3, 4), (12, 4), (3, 8), (12, 8)):
        f.deco([["brazier"]], x, y)
    for x, y in ((16, 16), (22, 16), (16, 22), (22, 22)):
        f.deco([["tpillar_top"], ["tpillar_bottom"]], x, y)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 19, 18)
    for x, y in ((5, 14), (6, 24), (27, 31), (33, 5)):
        f.deco([["skulls"]], x, y)
    f.deco([["vines"]], 28, 25, on_wall=True)
    f.npcs += [
        chest("b3_niche", "scimitar", "a Scimitar", 1, 16),
        chest("b3_cist", "soft", "a Soft", 5, 34),
        chest("b3_fallen", "hi_potion", "a Hi-Potion", 36, 7),
        {"id": "elf_d_bier", "sprite": "chest", "x": BIER[0], "y": BIER[1], "hideIf": DONE,
         "dialog": ["On the bier lies a slim crown of elven silver, green with marsh-rot."]},
        # P1-1-09 (FX-S): the last word before the keepers, on the gallery both ways to the bier hall share
        {"id": "elf_d_last_escort", "sprite": "knight", "tint": "#8fa38a", "x": 7, "y": 13, "dialog": talk(
            ["A knight of the king's escort leans on the wall, his blade notched to the hilt.",
             "\"Three keepers wait by the bier, and they strike together. Our swords alone were not enough.\"",
             "\"Let your mages cast from the first breath, fire and the white healing both, and keep potions to "
             "hand. Do not count on steel.\""],
            ["The knight has slid down the wall to rest. \"The keepers are gone? Then the king will have his "
             "crown. Go on, I will follow when I can.\""])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 8, "y": 3, "text": [
        "Reeds are carved along the bier's edge, and a line in the old elven hand: HE WHO RULES THE KEEP WEARS THIS, "
        "AND NO ONE ELSE.", "Someone has scratched a newer line under it, shallow and hurried: OR WHO HOLDS IT."]}]
    encounter = {"x": BIER[0], "y": BIER[1], "npc": "elf_d_bier", "enemyIds": list(GUARD), "flag": DONE,
                 "isBoss": True, "postVictoryCutscene": "elf_d_crown",
                 "message": "As your hand closes on the crown, the braziers gutter out. Three hunched shapes unfold "
                            "from the fog behind the bier, tentacles where their mouths should be, eyes like lamps."}
    print(f.write("b3", "Marsh Cave B3: the drowned barrow; the bier hall lies north-west of the antechamber.\n" + NOTE,
                  {"arrival": [30, 27], "pit": [30, 7], "boss": [BIER[0], BIER[1] + 3]},
                  extra={"canSave": False, "inspect": inspect, "scriptedEncounters": [encounter]}))


if __name__ == "__main__":
    main()

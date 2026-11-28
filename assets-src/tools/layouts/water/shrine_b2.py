"""Sea Shrine B2, the cloister (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D) -> assets-src/maps/sea-shrine-b2.yaml.

  python3 -I assets-src/tools/layouts/water/shrine_b2.py && python3 -I assets-src/tools/build_map.py sea-shrine-b2

The sea folk's cloister, one floor above the nave. The stairwell from B3 comes up in the south-east stair room; a
two-wide walk runs all the way round the garth, a sunken sea garden of kale beds under the tide, so either way round
leads to the north-west stair room and its stair up to the grotto. Off the north walk, three narrow cells (two with
chests, one with the tally of the last brother who stayed); off the south walk, the chapter house with the third
chest.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shrine_common import NOTE, Floor, chest, talk  # noqa: E402

W, H = 36, 30


def build() -> Floor:
    f = Floor("sea-shrine-b2", "Sea Shrine B2", W, H)
    g = f.g
    g.rect(8, 6, 27, 23, "-")            # the cloister walk ...
    g.rect(10, 8, 25, 21, "≈")           # ... round the garth, a sea garden under the tide
    g.rect(2, 5, 7, 10, "-")             # the north-west stair room (the stair up)
    g.rect(28, 19, 33, 25, "-")          # the south-east stair room (from B3)
    for x in (13, 18, 23):
        g.rect(x, 2, x, 5, "_")          # the brothers' cells off the north walk (dead ends)
    g.rect(17, 24, 18, 24, "-")          # the chapter house door
    g.rect(11, 25, 24, 27, "+")          # the chapter house, kelp-dark
    g.rect(2, 11, 2, 14, "_")            # the stair room's flooded closet (a dead end)
    g.faces(2)
    f.stairs_up(3, 3, "sea-shrine-b1", "down")               # up to the grotto
    f.stairs_down(30, 22, "sea-shrine-b3", "up")             # back down to the nave
    for x, y in ((8, 6), (27, 6), (8, 22), (27, 22)):
        f.deco([["pillar_top"], ["pillar_bottom"]], x, y, fit=True)
    f.deco([["lectern"]], 17, 25)
    f.deco([["vines"]], 5, 4, on_wall=True)
    f.npcs += [
        chest("b2_cell_w", "phoenix_down", "a Phoenix Down", 13, 2),
        chest("b2_cell_e", "opal_armlet", "an Opal Armlet", 23, 2),
        chest("b2_chapter_power", "power_gauntlet", "a Power Gauntlet", 24, 27),
        {"id": "wat_d_brother", "sprite": "mage", "tint": "#6f9aa6", "x": 13, "y": 26, "dialog": talk(
            ["A drowned brother of the shrine reads at the chapter table. The pages do not turn; the water turns them.",
             "\"The garth was our garden. The king said the sea would tend it, and it has, better than we did.\"",
             "\"Go up if you want counsel. The sea folk above are kinder than we were.\""],
            ["The brother has closed his book.", "\"The garden is drying at the edges. I had forgotten the colour "
             "of the kale in the light.\""])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 18, "y": 1, "text": [
        "Scratched on the cell wall, a tally of days, then of years, then nothing.",
        "At the end of it: I STAYED TO KEEP THE GARDEN. THE GARDEN KEPT ME."]},
        {"x": 10, "y": 8, "text": [
            "Under the water lies a garden: rows of sea-kale in stone beds, swaying in a current you cannot feel."]}]
    print(f.write("b2", "Sea Shrine B2: the cloister round a drowned garth; the stair up to the grotto is north-west.\n"
                  + NOTE, {"down": [30, 21], "up": [3, 5]}, extra={"inspect": inspect}))


if __name__ == "__main__":
    main()

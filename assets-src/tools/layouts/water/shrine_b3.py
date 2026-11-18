"""Sea Shrine B3, the nave (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D) -> assets-src/maps/sea-shrine-b3.yaml.

  python3 -I assets-src/tools/layouts/water/shrine_b3.py && python3 -I assets-src/tools/build_map.py sea-shrine-b3

The submarine from Onrac's dry dock surfaces in the berth pool at the foot of the nave and ties up at a plank pier
(stepping back onto the pier's end sails home, once Onrac is built). The berth hall runs across the nave's foot; the nave climbs north
between pillars and four tide pools to the dry apse, where the echo of a sea priest still keeps the font. Two
transepts open off the nave's middle: the west one holds the stair up (B2, the cloister, then the grotto above), the
east one the stairwell down (B4, the flooded halls, then the throne). Three chests, each at the end of a niche.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parents[1]))
from shrine_common import NOTE, Floor, chest, talk  # noqa: E402
from common import MAPS  # noqa: E402
from stubs import is_stub  # noqa: E402

W, H = 44, 34
PIER = [(21, 30), (22, 30)]              # the pier's end: back aboard the submarine, to Onrac's dry dock
# The pier sails back to `onrac:dry_dock` (the canon link) only once WAT-T's Onrac is built: a link into its stub
# would name a map that is never compiled. Until then the pier's end is a dead end and the EXIT spell (or the walk
# back up) is the way out; the integrator's regeneration after WAT-T's merge (this script, then build_map.py
# sea-shrine-b3) adds the link, as WAT-O's world does for Onrac's door.
ONRAC_BUILT = (MAPS / "onrac.yaml").is_file() and not is_stub(MAPS / "onrac.yaml")


def build() -> Floor:
    f = Floor("sea-shrine-b3", "Sea Shrine B3", W, H)
    g = f.g
    g.rect(15, 6, 28, 21, "-")           # the nave
    g.rect(18, 3, 25, 5, "+")            # the apse, kelp-dark
    for x0, y0 in ((17, 9), (25, 9), (17, 15), (25, 15)):
        g.rect(x0, y0, x0 + 1, y0 + 2, "≈")   # the nave's four tide pools
    g.rect(9, 22, 34, 25, "-")           # the berth hall across the nave's foot
    g.rect(14, 26, 29, 31, "≈")          # the berth pool
    g.rect(21, 26, 22, 30, "_")          # the plank pier out to the submarine
    g.rect(4, 23, 8, 23, "-")            # the berth hall's west passage (a dead end)
    g.rect(35, 24, 38, 24, "_")          # the east drain (a dead end)
    g.rect(9, 12, 14, 13, "-")           # nave <-> west transept
    g.rect(3, 8, 10, 17, "-")            # the west transept (the stair up)
    g.rect(4, 18, 4, 20, "_")            # its south niche (a dead end)
    g.rect(29, 12, 32, 13, "-")          # nave <-> east transept
    g.rect(33, 8, 40, 17, "-")           # the east transept (the stairwell down)
    g.rect(39, 5, 39, 7, "_")            # its north niche (a dead end)
    g.faces(2)
    f.stairs_up(5, 6, "sea-shrine-b2", "down")               # up to the cloister
    f.stairs_down(36, 11, "sea-shrine-b4", "arrival")        # down to the flooded halls
    if ONRAC_BUILT:
        f.transitions += [{"x": x, "y": y, "targetMap": "onrac", "targetEntrance": "dry_dock"} for x, y in PIER]
    f.deco([["altar_l", "altar_r"]], 21, 4)                  # the font
    for x, y in ((16, 7), (27, 7), (16, 13), (27, 13), (16, 19), (27, 19)):
        f.deco([["tpillar_top"], ["tpillar_bottom"]], x, y)
    f.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 8, 15)
    for x, y in ((19, 3), (24, 3)):
        f.deco([["brazier"]], x, y)
    for x, y in ((10, 22), (33, 22), (34, 16)):
        f.deco([["barrel"]], x, y)
    f.deco([["crate"]], 11, 22)
    for x in (12, 31):
        f.deco([["vines"]], x, 20, on_wall=True)
    f.deco([["skulls"]], 3, 16)
    f.npcs += [
        chest("b3_berth", "cabin", "a Cabin", 4, 23),
        chest("b3_niche", "aegis_shield", "an Aegis Shield", 4, 20),
        chest("b3_vestry", "hi_potion", "a Hi-Potion", 39, 5),
        {"id": "wat_d_echo", "sprite": "old_man", "tint": "#9cc4d4", "x": 22, "y": 7, "dialog": talk(
            ["A priest in a robe of sea-silk stands by the font. You can see the pillars through him.",
             "\"Up is the sea folk's grotto, the last dry rooms. They will tell you what they know, if you ask "
             "gently.\"",
             "\"Down is where the king went when he gave the water his kingdom. He took the tablet of the sky folk "
             "with him. He keeps it still.\""],
            ["The priest is fainter now, and he is smiling.",
             "\"The crystal shines again. Listen: you can hear the tide going out, for the first time in an age.\""])},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 21, "y": 2, "text": [
        "A mural over the font: a king with a crown of shells, walking down into the sea, and a city following him "
        "under the waves, roof by roof.",
        "Below it, cut later and less carefully: HE SAVED US FROM THE STORM BY GIVING US TO THE SEA."]}]
    print(f.write("b3", "Sea Shrine B3: the nave; the submarine berths here, the stair up is west, the stairwell down "
                        "east.\n" + NOTE,
                  {"nave": [21, 28], "up": [5, 8], "down": [36, 10]},
                  extra={"inspect": inspect}))


if __name__ == "__main__":
    main()

"""Ice Cavern B3, the eye's vault (docs/WORLD_PLAN.md 4.4, stage S16; FIR-D2) -> assets-src/maps/ice-cavern-b3.yaml.

  python3 -I assets-src/tools/layouts/fire/ice_b3.py && python3 -I assets-src/tools/build_map.py ice-cavern-b3

The stair from B2's hidden hall comes down in the south-west. Two ways lead to the vault in the north-east: north up
the gallery of the frozen watchers (ice-bound figures in a row of whitened pillars) and east along its upper passage;
or east along the long south gut to the sump hall, then north up the rime stair. Between them lies the mirror pool,
joined to both. The vault holds the floating stone on its plinth; touching it wakes the eye, its warden and two
rime-seers (`[evil_eye, ice_gigas, dark_wizard x2]`, postVictoryCutscene `fir_evil_eye_falls`, which gives the
levistone). The whole floor is the boss approach (`canSave: false`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ice_b1 import NOTE  # noqa: E402
from ice_common import DONE, Floor, chest  # noqa: E402

W, H = 40, 34
STONE = (33, 4)                          # the levistone on its plinth: touching it wakes the eye
GUARD = ["evil_eye", "ice_gigas", "dark_wizard", "dark_wizard"]


def build() -> Floor:
    f = Floor("ice-cavern-b3", "Ice Cavern B3", W, H)
    g = f.g
    g.rect(2, 26, 12, 29, "-")           # the landing (the stair from B2)
    g.rect(5, 10, 7, 25, "-")            # the gallery of the frozen watchers, south to north
    g.rect(2, 3, 13, 9, "+")             # its north hall, glazed with sheet ice
    g.rect(2, 1, 3, 2, "_")              # a snow-filled cleft above it (a dead end)
    g.rect(14, 5, 25, 6, "-")            # the upper passage east to the vault
    g.rect(13, 27, 31, 28, "-")          # the long south gut
    g.rect(20, 29, 20, 32, "_")          # a long drain off the gut (a dead end)
    g.rect(32, 22, 37, 29, "-")          # the sump hall
    g.rect(34, 26, 36, 28, "≈")          # its sump
    g.rect(34, 11, 35, 21, "-")          # the rime stair, north to the vault's door
    g.rect(15, 13, 27, 20, "+")          # the mirror pool's chamber
    g.rect(18, 15, 24, 18, "≈")          # the mirror pool
    g.rect(7, 16, 14, 17, "-")           # gallery <-> mirror chamber
    g.rect(28, 17, 33, 18, "-")          # mirror chamber <-> rime stair
    g.rect(26, 2, 37, 10, "-")           # the eye's vault
    g.rect(29, 2, 37, 6, "+")            # its glazed dais
    g.rect(38, 8, 38, 8, "-")            # a niche in the vault's east wall (a dead end; frost floor, FX-D P3-04)
    g.faces(2)
    f.stairs_up(9, 24, "ice-cavern-b2", "down")              # back up to B2's hidden hall
    for y in (11, 14, 20, 23):           # the watchers stand along the gallery's east side
        f.pillar(7, y)
    for x, y in ((28, 3), (36, 3), (28, 8), (36, 8)):
        f.pillar(x, y)
    f.deco([["altar_l", "altar_r"]], 32, 3)                  # the plinth; the stone NPC hangs before it
    f.floe(11, 28)
    f.floe(16, 19)
    f.deco([["skulls"]], 4, 5)
    f.deco([["fallen_l", "fallen_r"]], 22, 27)
    f.npcs += [
        chest("b3_cleft", "opal_helm", "an Opal Helm", 2, 1),
        chest("b3_drain", "phoenix_down", "a Phoenix Down", 20, 32),
        chest("b3_niche", "hi_potion", "a Hi-Potion", 38, 8),
        {"id": "fir_d2_stone", "sprite": "chest", "tint": "#b8d8ff", "x": STONE[0], "y": STONE[1],
         "hideIf": DONE,
         "dialog": ["On the plinth a grey stone the size of a fist hangs a finger's width above the ice, turning "
                    "slowly, though no air moves."]},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 7, "y": 11, "text": [
        "Figures stand inside the ice of the pillars, arms raised as if to shield their eyes. Their own eyes are "
        "open."]}]
    encounter = {"x": STONE[0], "y": STONE[1], "npc": "fir_d2_stone", "enemyIds": list(GUARD), "flag": DONE,
                 "isBoss": True, "postVictoryCutscene": "fir_evil_eye_falls",
                 "message": "As your fingers close on the stone, the dais groans. Out of the vault's dark roof sinks "
                            "a great eye ringed with stalks, and the frost giant who keeps it steps out of the wall."}
    print(f.write("b3", "Ice Cavern B3: the eye's vault lies north-east of the landing; two ways lead there.\n" + NOTE,
                  {"arrival": [9, 27], "boss": [33, 8]},
                  extra={"canSave": False, "inspect": inspect, "scriptedEncounters": [encounter]}))


if __name__ == "__main__":
    main()

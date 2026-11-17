"""The giant's tunnel under the western range (docs/WORLD_PLAN.md 4.3; ERT-O) -> assets-src/maps/giant-tunnel.yaml.
One 32x20 cave map from the east mouth (`arrival`, overworld `ert_giant`) to the west mouth (`west`, overworld
`ert_giant_west`, Sarda's coast). Its only way through is a two-cell neck where the giant lies; he takes the ruby in
his cutscene `ert_giant_feast` (TITAN_FED) and is gone after it (`hideIf: TITAN_FED`). GT-36 removes him; GT-15 his
`requiredItem`.

  python3 -I assets-src/tools/layouts/earth/giant.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dwarf import KITS, LEGEND, MATS  # noqa: E402  (the shared cave materials)
from common import Room  # noqa: E402

NOTE = ("Concept: a raw tunnel bored straight through the western range, two caverns joined by a gallery that "
        "narrows to a single throat where a hungry giant has wedged himself.\n"
        "Distinct: the mouths open on the map's flanks, not a stair; the giant lies across the throat itself, so "
        "the tunnel is shut by a body, not a door; a niche off the west gallery is where he squeezes in once fed.\n"
        "Topology: one map, no stairs: east mouth (ert_giant) -> east cavern -> throat (the giant) -> west gallery "
        "-> west cavern -> west mouth (ert_giant_west); a dead-end pocket with a chest off the west cavern.")
NECK = [(15, 10), (16, 10)]                              # the throat: the only cells joining the two halves
GIANT = (15, 10)


def build() -> Path:
    r = Room("giant-tunnel", "Giant's Tunnel", 32, 20)
    g = r.g
    g.carve(22, 4, 30, 15)                               # east cavern
    g.carve(30, 9, 31, 10)                               # east mouth (the map's east edge)
    g.carve(17, 8, 22, 12)                               # east gallery
    for x, y in NECK:
        g.carve(x, y, x, y)
    g.carve(8, 8, 14, 12)                                # west gallery
    g.carve(13, 5, 15, 7)                                # the giant's niche (west side only)
    g.carve(1, 5, 8, 15)                                 # west cavern
    g.carve(0, 11, 1, 12)                                # west mouth (the west edge)
    g.carve(3, 16, 5, 18)                                # a dead-end pocket
    g.carve(25, 1, 26, 3)                                # a blind bore north of the east cavern
    for x0, y0, x1, y1 in ((24, 13, 26, 14), (10, 11, 11, 12), (2, 6, 3, 6)):
        g.carve(x0, y0, x1, y1, "%")
    g.faces(2)
    r.deco([["torch"]], 23, 2, on_wall=True)
    r.deco([["skulls"]], 29, 14)
    r.deco([["skulls"]], 22, 5)
    r.deco([["vines"]], 9, 6, on_wall=True)
    r.deco([["fallen_l", "fallen_r"]], 5, 7)             # props from an old dig
    r.objects.append({"type": "crate", "x": 28, "y": 4})
    r.npcs.append({"id": "ert_giant", "sprite": "monk", "tint": "#8c7a62", "x": GIANT[0], "y": GIANT[1],
                   "requiredItem": "ruby", "hideIf": "TITAN_FED",
                   "cutscene": {"id": "ert_giant_feast", "onceFlag": "TITAN_FED"}, "dialog": [
                       {"condition": "item:ruby", "text": [
                           "The giant's nostrils flare. \"That smell... a fire-stone! Give it! GIVE IT!\""]},
                       {"text": ["A giant lies wedged in the throat of the tunnel like a stopper in a bottle.",
                                 "\"HUNGRY. Rock is cold. Rock is dull. Bring a stone that tastes of fire, then I move.\""]}]})
    r.npcs.append({"id": "ert_tunnel_prospector", "sprite": "farmer", "tint": "#b08860", "x": 27, "y": 9, "dialog": [
        {"condition": "TITAN_FED", "text": ["He's gone into his hole, snoring. The coast beyond the range is yours."]},
        {"text": ["Don't wake him, friend. He only eats stones, but he likes the burning kind best.",
                  "The thing that rules the Cavern of Earth is said to keep such a stone."]}]})
    r.npcs.append({"id": "chest_ert_o_tunnel", "sprite": "chest", "x": 4, "y": 18, "chestItem": "hi_potion",
                   "chestFlag": "CHEST_ERT_O_TUNNEL", "dialog": ["You found a Hi-Potion!"]})
    r.transitions += [{"x": 31, "y": y, "targetMap": "overworld", "targetEntrance": "ert_giant"} for y in (9, 10)]
    r.transitions += [{"x": 0, "y": y, "targetMap": "overworld", "targetEntrance": "ert_giant_west"} for y in (11, 12)]
    return r.write(NOTE, {"arrival": [30, 9], "west": [1, 11]}, kits=KITS, mats=MATS, trim=None,
                   quiet={"encounterRate": {"min": 999, "max": 999}, "encounters": []}, script="earth/giant.py",
                   legend=LEGEND, music="dungeon", extra={
                       "no_unreachable_walkable": True, "unreachable_ok": ["west"], "contrast": [{"a": "W", "b": "-", "min": 0.2}],
                       "exit": {"map": "overworld", "entrance": "ert_giant"}})


if __name__ == "__main__":
    print(build())

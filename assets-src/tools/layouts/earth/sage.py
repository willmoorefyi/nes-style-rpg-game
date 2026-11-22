"""Sarda's cave on the coast beyond the western range (docs/WORLD_PLAN.md 4.0.1 small sites, 4.3; ERT-O) ->
assets-src/maps/sage-cave.yaml. One 16x12 room: the hermit Sarda and his two pupils. Once VAMPIRE_DEFEATED is set his
cutscene `ert_sarda_rod` gives the `rod` (ERT_O_ROD_GIVEN); the flag check is non-load-bearing (6.3 GT-16: the cave is
behind the giant, who needs the ruby, which needs the vampire).

  python3 -I assets-src/tools/layouts/earth/sage.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dwarf import KITS, LEGEND, MATS  # noqa: E402  (the shared cave materials)

MATS = {**MATS, "floor_stone": {"from": "ar_cave"}, "rubble": {**MATS["rubble"], "from": "ar_temple_rubble_cool"}}   # AR-T2
from common import Room  # noqa: E402

NOTE = ("Concept: a hermit's sea cave above the surf of Sarda's coast, half library, half tide pool.\n"
        "Distinct: the sage reads by the light of a white orb on a sunken reading floor; drift timber shelves "
        "hold the books his two pupils copy; a rubble slope where the sea once came in.\n"
        "Topology: one room, no stairs: overworld (ert_sarda) -> the cave; exit south.")


def build() -> Path:
    r = Room("sage-cave", "Sarda's Cave", 16, 12)
    npc = lambda i, s, x, y, d, **kw: r.npcs.append({"id": i, "sprite": s, "x": x, "y": y, "dialog": d, **kw})  # noqa: E731
    g = r.g
    g.carve(2, 4, 13, 10)
    g.carve(5, 4, 10, 6, "_")                            # the reading floor
    g.carve(7, 11, 8, 11)
    g.carve(2, 9, 3, 10, "%")
    g.faces(2)
    for x in (2, 12):
        r.tall("bookshelf", x, 4)
    r.deco([["window_in"]], 7, 3, on_wall=True)
    r.deco([["orb_white"]], 9, 4)
    r.deco([["lectern"]], 6, 4)
    r.deco([["plant"]], 13, 9)
    r.deco([["table"]], 11, 7)
    sarda = [
        {"condition": "ERT_O_ROD_GIVEN", "text": [
            "Strike the seal in the Cavern with the rod. What sleeps under it is older than the rot, and colder."]},
        {"condition": "VAMPIRE_DEFEATED", "text": [
            "So the thing that drank the earth's blood is dust. I felt the land breathe when it fell.",
            "But the rot runs deeper than one beast. Listen, and take what I have kept."]},
        {"text": ["Go away. I have watched too many brave fools walk into the Cavern of Earth.",
                  "Come back when the creature that drinks the land is gone, and not before."]}]
    npc("ert_sarda", "master", 7, 5, sarda,
          cutscene={"id": "ert_sarda_rod", "requiredFlags": ["VAMPIRE_DEFEATED"], "onceFlag": "ERT_O_ROD_GIVEN"})
    npc("ert_sarda_pupil_a", "white_mage", 4, 7, [
        {"condition": "ERT_O_ROD_GIVEN", "text": ["The master hasn't parted with that rod in my lifetime. Be worthy of it."]},
        {"text": ["The master speaks to the stones. Mostly they don't answer."]}])
    npc("ert_sarda_pupil_b", "black_mage", 11, 9, [
        "We reached this coast before the giant blocked the tunnel. Now no one visits. You came through him?"])
    r.transitions += [{"x": x, "y": 11, "targetMap": "overworld", "targetEntrance": "ert_sarda"} for x in (7, 8)]
    return r.write(NOTE, {"arrival": [7, 10]}, kits=KITS, mats=MATS, trim=None,
                   quiet={"encounterRate": {"min": 999, "max": 999}, "encounters": []}, script="earth/sage.py",
                   legend=LEGEND, music="town", extra={
                       "no_static_chokepoints": True, "no_unreachable_walkable": True,
                       "contrast": [{"a": "W", "b": "-", "min": 0.2}],
                       "exit": {"map": "overworld", "entrance": "ert_sarda"}})


if __name__ == "__main__":
    print(build())

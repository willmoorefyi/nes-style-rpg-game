"""The Cavern of Earth B4-B5 (docs/WORLD_PLAN.md 4.3, stage S13; ERT-D), original layouts -> assets-src/maps/
cavern-earth-b4..b5.yaml: the frozen undercroft of the Rime Sovereign's old fortress (QUEST 4.9 lore; the `ice`
remap).

  python3 -I assets-src/tools/layouts/earth/cavern_lower.py && python3 -I assets-src/tools/build_map.py cavern-earth-b4 cavern-earth-b5

  cavern-earth-b4  a ring of frozen corridors round the fortress's buried keep; two stairwells open off it, the true
                   one in the north-east room and a false one in the north-west room, a one-way pit into a pocket
                   sealed inside the keep, whose only way out is a crack that climbs back to the arrival
  cavern-earth-b5  the throne of frost: a long cold approach round the west side to the throne hall in the north; the
                   crystal's altar in the alcove beside the throne

The Rime Sovereign (`lich`) is an NPC on his throne; talking to him starts the fight with two earth elementals
(EARTH_CAVE_COMPLETE); his postVictoryCutscene `ert_lich_falls` sets it again and points to the altar, where his
shade waits (showIf EARTH_CAVE_COMPLETE); the shade's cutscene `ert_earth_crystal` sets EARTH_CRYSTAL_LIT. B5 is the
boss floor: canSave false. The milestones are EARTH_SEAL_BROKEN (B3's gate), EARTH_CAVE_COMPLETE, EARTH_CRYSTAL_LIT.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cavern_common import ICE, Room, preview, table  # noqa: E402

B4_TABLE = table((3, [("wight", 3, 5)]), (3, [("ogre_mage", 1, 2)]), (2, [("hill_gigas", 1, 2)]),
                 (1, [("sphinx", 1, 1), ("wight", 0, 2)]))
B5_TABLE = table((3, [("earth_elemental", 1, 1)]), (3, [("ogre_mage", 2, 3)]), (2, [("sphinx", 1, 1)]),
                 (2, [("hill_gigas", 1, 1), ("wight", 2, 3)]))


def b4() -> Room:
    r = Room("cavern-earth-b4", "Cavern of Earth B4", 40, 36)
    g = r.g
    g.carve(17, 28, 23, 33)                  # the arrival chamber under B3's seal stair
    g.carve(17, 25, 18, 27)
    g.carve(6, 6, 33, 24)                    # the frozen ring ...
    g.rect(9, 9, 30, 21, "W")                # ... round the buried keep
    g.carve(1, 3, 5, 8)                      # the north-west stairwell room (the false stair)
    g.carve(34, 3, 38, 8)                    # the north-east stairwell room (the true stair)
    g.carve(14, 13, 25, 17)                  # the pocket sealed inside the keep
    g.carve(3, 20, 5, 20)                    # a blind drift off the ring (west)
    g.carve(34, 18, 37, 18)                  # a blind drift off the ring (east)
    for x0, y0, x1, y1 in ((7, 22, 8, 23), (31, 7, 32, 8), (21, 15, 23, 16)):
        g.carve(x0, y0, x1, y1, "%")
    g.faces(2)
    r.stairs_up(21, 26, "cavern-earth-b3", "down")
    r.stairs_down(35, 4, "cavern-earth-b5", "arrival")
    r.stairs_down(2, 4, "cavern-earth-b4", "pocket")          # the false stair: a pit into the pocket
    r.transitions += [{"x": x, "y": 13, "targetMap": "cavern-earth-b4", "targetEntrance": "arrival"} for x in (24, 25)]
    r.deco([["vines"]], 24, 11, on_wall=True)                 # the crack the pocket is climbed out by
    for (x, y) in ((12, 7), (27, 7), (12, 23), (27, 23)):
        r.pillar(x, y)
    r.deco([["skulls"]], 15, 16)
    r.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 19, 6)
    r.chest("b4_drift_w", "ether", "an Ether", 3, 20)
    r.chest("b4_drift_e", "hi_potion", "a Hi-Potion", 37, 18)
    r.chest("b4_pocket", "black_robe", "a Black Robe", 14, 17)
    r.chest("b4_stair", "soft", "a Soft", 38, 8)
    r.npcs.append({"id": "ert_d_frozen_herald", "sprite": "knight", "tint": "#9fb8d0", "x": 22, "y": 30, "dialog": [
        {"condition": "EARTH_CRYSTAL_LIT", "text": ["The frost is going out of my joints. My king has let the earth go."]},
        {"text": ["A herald in rimed armour speaks without moving his frozen jaw.",
                  "\"Two stairs lead down from the ring. My king built one of them for his enemies.\""]}]})
    r.write_floor("Cavern of Earth B4: the frozen ring round the buried keep, its two stairwells and the sealed pocket.",
                  {"arrival": [21, 28], "down": [35, 6], "pocket": [16, 15]}, mats=ICE, encounters=B4_TABLE,
                  extra={"no_unreachable_walkable": {"reach_roots": ["pocket"]}, "no_static_chokepoints": False})
    return r


def b5() -> Room:
    r = Room("cavern-earth-b5", "Cavern of Earth B5", 30, 34)
    g = r.g
    g.carve(11, 27, 18, 32)                  # the arrival chamber
    g.carve(16, 19, 17, 26)                  # the approach climbs north ...
    g.carve(5, 18, 17, 19)                   # ... turns west ...
    g.carve(5, 9, 6, 17)                     # ... and north up the west side
    g.carve(7, 10, 8, 11)
    g.carve(9, 3, 22, 13)                    # the throne hall
    g.carve(23, 4, 26, 8)                    # the altar alcove
    g.carve(2, 13, 4, 13)                    # a blind drift off the west side
    g.carve(18, 18, 22, 18)                  # a blind drift off the approach
    g.faces(2)
    r.stairs_up(13, 25, "cavern-earth-b4", "down")
    r.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 15, 4, fit=True)
    r.deco([["altar_l", "altar_r"]], 24, 4)
    r.deco([["orb_white"]], 26, 4)
    for (x, y) in ((10, 6), (21, 6), (10, 11), (21, 11)):
        r.pillar(x, y)
    for (x, y) in ((12, 28), (17, 28)):
        r.deco([["brazier"]], x, y)
    r.chest("b5_drift_w", "phoenix_down", "a Phoenix Down", 2, 13)
    r.chest("b5_drift_e", "wizard_staff", "a Wizard Staff", 22, 18)
    r.npcs.append({"id": "ert_d_lich", "sprite": "king", "tint": "#b9d4ec", "x": 15, "y": 6,
                   "hideIf": "EARTH_CAVE_COMPLETE", "dialog": [
                       "A crowned skeleton in plate rimed with frost sits on a throne of ice. Its sockets kindle blue.",
                       "Rime Sovereign: I swore my realm would never end. I took the earth's warmth to keep that oath.",
                       "It is still not enough. Yours will help."]})
    r.npcs.append({"id": "ert_d_altar_shade", "sprite": "king", "tint": "#e4eef8", "x": 24, "y": 6,
                   "showIf": "EARTH_CAVE_COMPLETE", "hideIf": "EARTH_CRYSTAL_LIT",
                   "cutscene": {"id": "ert_earth_crystal", "onceFlag": "EARTH_CRYSTAL_LIT",
                                "requiredFlags": ["EARTH_CAVE_COMPLETE"]},
                   "dialog": ["A pale shade of the king kneels at the altar, his hands on a dull grey crystal."]})
    r.write_floor("Cavern of Earth B5: the cold approach round the west side to the throne hall; the crystal's altar "
                  "beside the throne.",
                  {"arrival": [13, 27], "boss": [15, 8]}, mats=ICE, encounters=B5_TABLE, background="throne_lich",
                  can_save=False, extra={"scriptedEncounters": [{
                      "x": 15, "y": 6, "npc": "ert_d_lich", "enemyIds": ["lich", "earth_elemental", "earth_elemental"],
                      "flag": "EARTH_CAVE_COMPLETE", "isBoss": True,
                      "postVictoryCutscene": "ert_lich_falls",
                      "message": "The Sovereign stands, and the cavern walls bulge: two shapes of living rock tear "
                                 "free to stand at his side."}]})
    return r


if __name__ == "__main__":
    for f in (b4, b5):
        room = f()
        if "--preview" in sys.argv:
            print(room.id)
            print(preview(room))
    print("cavern-earth-b4, cavern-earth-b5 written")

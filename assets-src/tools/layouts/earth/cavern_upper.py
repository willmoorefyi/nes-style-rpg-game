"""The Cavern of Earth B1-B3 (docs/WORLD_PLAN.md 4.3, stage S11; ERT-D), original layouts -> assets-src/maps/
cavern-earth-b1..b3.yaml.

  python3 -I assets-src/tools/layouts/earth/cavern_upper.py && python3 -I assets-src/tools/build_map.py cavern-earth-b1 cavern-earth-b2 cavern-earth-b3

  cavern-earth-b1  a split gallery: from the mouth hall a west arm runs to the stair down to B2, an east arm to a second
                   stair down into the ore annex (a dead end on B2's map); B2's rubble slide lands in an alcove north
                   of the hall
  cavern-earth-b2  a loop around a still cave lake; the stair down to B3 in a chamber east of it; a rubble slide on the
                   north shore throws the party back up to B1; the walled-off ore annex in the south-west
  cavern-earth-b3  the vampire's crypt: a hall of burial niches east of the arrival to his chamber; the side chamber of
                   the rod seal (keyItemGates, requiredItem rod, permanent, EARTH_SEAL_BROKEN) holds the stair to B4

The vampire is an NPC on his bier; talking to him starts the fight with three mummies (VAMPIRE_DEFEATED); his
postVictoryCutscene `ert_vampire_falls` gives the ruby (D-W14). B3 is the boss floor: canSave false.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cavern_common import CAVE, Room, preview, table  # noqa: E402

B1_TABLE = table((3, [("mummy", 2, 4)]), (3, [("troll", 1, 3)]), (2, [("cockatrice", 1, 2), ("wight", 1, 2)]),
                 (2, [("wight", 2, 4)]))
B2_TABLE = table((3, [("ochre_jelly", 1, 2), ("troll", 0, 2)]), (3, [("wraith", 1, 3)]), (2, [("cockatrice", 2, 3)]),
                 (1, [("minotaur", 1, 1)]))
B3_TABLE = table((3, [("mummy", 2, 4)]), (3, [("wraith", 2, 3)]), (2, [("wight", 2, 3), ("mummy", 0, 2)]),
                 (1, [("hill_gigas", 1, 1)]), (1, [("minotaur", 1, 2)]))
UP, DOWN = "cavern-earth-b{}", "arrival"


def b1() -> Room:
    r = Room("cavern-earth-b1", "Cavern of Earth B1", 34, 28)
    g = r.g
    g.carve(15, 22, 18, 27)                  # the mouth passage, out to the badlands at the south edge
    g.carve(10, 15, 23, 21)                  # the mouth hall
    g.carve(14, 10, 19, 13, "%")             # the slide alcove (B2's rubble slide lands here)
    g.carve(16, 14, 17, 14)
    g.carve(3, 17, 9, 19)                    # the west arm
    g.carve(3, 7, 5, 16)
    g.carve(2, 3, 11, 6)                     # the west stair room
    g.carve(6, 12, 9, 12)                    # a blind drift off the west arm
    g.carve(24, 17, 30, 19)                  # the east arm
    g.carve(28, 7, 30, 16)
    g.carve(22, 3, 31, 6)                    # the annex stair room
    g.carve(31, 13, 32, 13)                  # a blind drift off the east arm
    g.carve(11, 22, 11, 25)                  # the ore spur
    for x0, y0, x1, y1 in ((21, 19, 23, 21), (4, 18, 5, 19), (29, 9, 30, 10)):
        g.carve(x0, y0, x1, y1, "%")
    g.faces(2)
    r.stairs_down(8, 4, "cavern-earth-b2", "arrival")
    r.stairs_down(26, 4, "cavern-earth-b2", "annex")
    r.transitions += [{"x": x, "y": 27, "targetMap": "overworld", "targetEntrance": "ert_earth_cave"} for x in (16, 17)]
    r.deco([["torch"]], 13, 13, on_wall=True)
    r.deco([["torch"]], 20, 13, on_wall=True)
    r.deco([["skulls"]], 22, 16)
    r.deco([["vines"]], 4, 1, on_wall=True)
    r.deco([["fallen_l", "fallen_r"]], 12, 16)
    for x in (23, 30):
        r.objects.append({"type": "crate", "x": x, "y": 3})
    r.chest("b1_drift_w", "hi_potion", "a Hi-Potion", 9, 12)
    r.chest("b1_drift_e", "phoenix_down", "a Phoenix Down", 32, 13)
    r.chest("b1_ore", "tent", "a Tent", 11, 25)
    r.npcs.append({"id": "ert_d_prospector", "sprite": "farmer", "tint": "#9c8a6e", "x": 19, "y": 20, "dialog": [
        {"condition": "VAMPIRE_DEFEATED", "text": [
            "The thing in the crypt is dead? Then I'll dig the annex again. The ore down there is still warm."]},
        {"text": ["Two stairs, two ways. The west one goes on down to the lake. The east one only to the old ore annex.",
                  "Below the lake there's a crypt. Something there drinks the life out of the ground. Melmond feels it."]}]})
    r.write_floor("Cavern of Earth B1: the mouth hall, the split gallery and its two stairs down.",
                  {"arrival": [16, 25], "down": [8, 6], "annex_up": [26, 6], "slide": [16, 12]},
                  mats=CAVE, encounters=B1_TABLE)
    return r


def b2() -> Room:
    r = Room("cavern-earth-b2", "Cavern of Earth B2", 38, 30)
    g = r.g
    g.carve(2, 6, 8, 12)                     # the arrival chamber under B1's west stair
    g.carve(9, 9, 9, 10)
    g.carve(10, 6, 29, 22)                   # the shore path around the lake
    g.rect(13, 9, 26, 19, "~")               # the cave lake
    g.carve(18, 2, 21, 5, "%")               # the rubble slide up the north shore
    g.carve(32, 12, 36, 18)                  # the stair chamber east of the lake
    g.carve(30, 14, 31, 15)
    g.carve(19, 23, 19, 26)                  # a blind cut south of the lake
    g.carve(35, 19, 35, 23)                  # a blind cut below the stair chamber
    g.carve(2, 20, 8, 26)                    # the ore annex (walled off; only B1's east stair reaches it)
    g.carve(6, 27, 6, 28)
    g.carve(11, 21, 12, 22, "%")
    g.faces(2)
    r.stairs_up(4, 4, "cavern-earth-b1", "down")
    r.stairs_up(4, 18, "cavern-earth-b1", "annex_up")
    r.stairs_down(33, 13, "cavern-earth-b3", "arrival")
    r.transitions += [{"x": x, "y": 3, "targetMap": "cavern-earth-b1", "targetEntrance": "slide"} for x in (19, 20)]
    r.deco([["skulls"]], 28, 21)
    r.deco([["vines"]], 24, 4, on_wall=True)
    r.deco([["torch"]], 34, 10, on_wall=True)
    for x, y in ((3, 22), (3, 23), (8, 20)):
        r.objects.append({"type": "crate", "x": x, "y": y})
    r.deco([["gold_heap"]], 7, 22)
    r.chest("b2_south_cut", "ether", "an Ether", 19, 26)
    r.chest("b2_stair_cut", "soft", "a Soft", 35, 23)
    r.chest("b2_annex", "mythril_helm", "a Mythril Helm", 2, 26)
    r.chest("b2_annex_shaft", "hi_potion", "a Hi-Potion", 6, 28)
    r.write_floor("Cavern of Earth B2: the shore path around the cave lake, the slide, and the walled-off ore annex.",
                  {"arrival": [4, 6], "down": [33, 15], "annex": [4, 20]}, mats=CAVE, encounters=B2_TABLE,
                  extra={"no_unreachable_walkable": {"reach_roots": ["annex"]}, "no_static_chokepoints": False})
    return r


def b3() -> Room:
    r = Room("cavern-earth-b3", "Cavern of Earth B3", 40, 28)
    g = r.g
    g.carve(2, 11, 9, 17)                    # the arrival chamber under B2's stair
    g.carve(10, 13, 24, 15)                  # the hall of burial niches
    g.carve(25, 9, 37, 19)                   # the vampire's chamber
    g.carve(17, 11, 17, 12)                  # the seal's doorway (the keyItemGate is its lower cell)
    g.carve(13, 4, 21, 10)                   # the seal chamber
    g.carve(12, 16, 12, 19)                  # a burial niche (blind)
    g.carve(21, 16, 21, 20)                  # a burial niche (blind)
    g.carve(4, 18, 5, 22)                    # an ossuary below the arrival
    for x0, y0, x1, y1 in ((27, 17, 29, 19), (36, 9, 37, 10)):
        g.carve(x0, y0, x1, y1, "%")
    g.faces(2)
    r.stairs_up(4, 9, "cavern-earth-b2", "down")
    r.stairs_down(16, 5, "cavern-earth-b4", "arrival")
    for x in (16, 18):
        r.statue(x, 9)                       # broken guardians on either side of the seal's doorway
    r.deco([["altar_l", "altar_r"]], 35, 13)  # the vampire's bier
    for (x, y) in ((27, 10), (35, 18)):
        r.deco([["brazier"]], x, y)
    for x in (11, 15, 19, 23):
        r.deco([["torch"]], x, 11, on_wall=True)
    r.deco([["skulls"]], 5, 21)
    r.deco([["skulls"]], 30, 11)
    r.chest("b3_niche_w", "phoenix_down", "a Phoenix Down", 12, 19)
    r.chest("b3_niche_e", "cabin", "a Cabin", 21, 20)
    r.chest("b3_seal", "falchion", "a Falchion", 20, 5)
    r.npcs.append({"id": "ert_d_vampire", "sprite": "burgher", "tint": "#8a3040", "x": 34, "y": 14,
                   "hideIf": "VAMPIRE_DEFEATED", "dialog": [
                       "A pale young man in a red-lined cape sits up on the bier, licking cold lips.",
                       "Vampire: Living blood, this deep? The ground went dry years ago. I'll have you instead."]})
    r.npcs.append({"id": "ert_d_crypt_ghost", "sprite": "old_man", "tint": "#a9b6c8", "x": 7, "y": 13, "dialog": [
        {"condition": "EARTH_SEAL_BROKEN", "text": [
            "The seal is broken. Below it the cold is older than the crypt. Mind the stairwells in the ring."]},
        {"condition": "VAMPIRE_DEFEATED", "text": [
            "The blood-drinker is ash. But the seal north of the niches still holds, and the rot comes from below it.",
            "Only a sage's rod could break that stone. Ask in the west, beyond the range."]},
        {"text": ["I was a gravedigger here, before the crypt filled with the wrong kind of sleeper.",
                  "He keeps a red stone on his bier, warm as a coal. He likes to hold it while he waits."]}]})
    r.write_floor("Cavern of Earth B3: the hall of burial niches, the vampire's chamber east of the arrival, and the "
                  "rod seal's side chamber with the stair down.",
                  {"arrival": [4, 11], "down": [16, 7], "boss": [32, 14]}, mats=CAVE, encounters=B3_TABLE,
                  can_save=False, extra={
                      "keyItemGates": [{"x": 17, "y": 12, "requiredItem": "rod", "flag": "EARTH_SEAL_BROKEN",
                                        "permanent": True, "message": [
                                            {"condition": "item:rod", "text": [
                                                "The rod hums in your hand. The fused stone of the seal cracks along a hair-thin line."]},
                                            {"text": ["A plug of stone, fused smooth as glass, fills the doorway.",
                                                      "Carved over it: \"Sealed by the sages. Opened by their rod alone.\""]}]}],
                      "scriptedEncounters": [{
                          "x": 34, "y": 14, "npc": "ert_d_vampire", "enemyIds": ["vampire", "mummy", "mummy", "mummy"],
                          "flag": "VAMPIRE_DEFEATED", "isBoss": True, "postVictoryCutscene": "ert_vampire_falls",
                          "message": "He rises off the bier in one smooth motion, and three wrapped shapes climb out of "
                                     "the niches behind him."}]})
    return r


if __name__ == "__main__":
    for f in (b1, b2, b3):
        room = f()
        if "--preview" in sys.argv:
            print(room.id)
            print(preview(room))
    print("cavern-earth-b1, cavern-earth-b2, cavern-earth-b3 written")

"""The Temple of the Past, floors 4-5, and the shrine of Chaos (docs/WORLD_PLAN.md 4.8, stage S30; PST), original
layouts -> assets-src/maps/past-temple-4.yaml, -5.yaml, past-chaos.yaml.

  python3 -I assets-src/tools/layouts/past/past_lower.py && python3 -I assets-src/tools/build_map.py past-temple-4 past-temple-5 past-chaos

  past-temple-4  a stairwell spiral: three square rings, each plugged just past the point where the ring before it
                 drops in, wind down to a small well room in the middle, where the Hollow Seraph waits by the stair;
                 blind alcoves in the walls between the rings hold chests (the Masamune in the deepest)
  past-temple-5  a hall of eyes: from the south hall two routes climb to the north landing, a colonnade in the west
                 and a chain of three chambers in the east, either side of a wall carved with watching eyes; the
                 Death Eye guards the landing's stair down to the shrine
  past-chaos     the shrine of Chaos: from the vestibule a pillared processional runs up to a blank wall with a
                 painted shadow; the sanctum is entered by the side aisles at its two ends; no random battles
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from past_common import LOWER, Room, chest  # noqa: E402

SCRIPT = "past/past_lower.py"

# ════════════════════════════ floor 4: the stairwell spiral ════════════════════════════
f4 = Room("past-temple-4", "Temple of the Past 4", 34, 36)
g = f4.g
RINGS = [(2, 4, 31, 33), (6, 8, 27, 29), (10, 12, 23, 25)]
for x0, y0, x1, y1 in RINGS:
    g.carve(x0, y0, x1, y0 + 1)                  # each ring's top ...
    g.carve(x0, y1 - 1, x1, y1)                  # ... bottom ...
    g.carve(x0, y0, x0 + 1, y1)                  # ... west ...
    g.carve(x1 - 1, y0, x1, y1)                  # ... and east sides, two cells wide
for x0, y0, _, _ in RINGS:
    g.rect(x0 + 2, y0, x0 + 3, y0 + 1, "W")      # the plug just east of where the ring is entered
    g.carve(x0 + 4, y0 + 2, x0 + 5, y0 + 3)      # the drop into the next ring (or the well room), past the plug
g.carve(14, 16, 19, 21)                          # the well room
g.carve(32, 18, 32, 18)                          # alcoves: outside the outer ring (blind)
g.carve(16, 34, 16, 34)
g.carve(8, 20, 8, 20)                            # between the first and second rings
g.carve(12, 19, 12, 19)                          # between the second ring and the well (the deepest)
g.faces(2)
f4.stairs_up(2, 2, "past-temple-3", "down")
f4.gated_stairs_down(18, 16, "past-temple-5", "arrival", "PAST_SERAPH_DEFEATED")
f4.npcs += [
    chest("spiral_outer_east", "hi_potion", "a Hi-Potion", 32, 18),
    chest("spiral_outer_south", "ether", "an Ether", 16, 34),
    chest("spiral_middle", "phoenix_down", "a Phoenix Down", 8, 20),
    chest("spiral_deep", "masamune", "a Masamune", 12, 19),
]
seraph = f4.boss({"id": "past_hollow_seraph", "sprite": "white_wizard", "tint": "#d8d8f0", "x": 16, "y": 19,
                  "dialog": ["A winged shape of light hangs above the well, its four blades turning slowly like the "
                             "hands of a clock that has lost its numbers.",
                             "Hollow Seraph: Every road you climbed to reach me in the sky winds down to this well. "
                             "Fall a little further."]},
                 ["hollow_seraph_2"], "PAST_SERAPH_DEFEATED", "pst_seraph_falls",
                 "The blades stop turning, and every one of them turns toward you.")
f4.write("Temple of the Past 4: a stairwell spiral of three rings round a well room; the Hollow Seraph waits there.",
         {"arrival": [2, 4], "down": [16, 17], "boss": [15, 20]}, table=LOWER, script=SCRIPT,
         extra={"scriptedEncounters": [seraph]})

# ════════════════════════════ floor 5: the hall of eyes ════════════════════════════
f5 = Room("past-temple-5", "Temple of the Past 5", 46, 34)
g = f5.g
g.carve(4, 27, 41, 30)                           # the south hall (from floor 4)
g.carve(4, 6, 9, 26)                             # the west route: the colonnade
g.carve(34, 20, 41, 26)                          # the east route: the first chamber ...
g.carve(37, 17, 38, 19)
g.carve(34, 12, 41, 16)                          # ... the second ...
g.carve(35, 9, 36, 11)
g.carve(34, 6, 41, 8)                            # ... and the third
g.carve(4, 3, 41, 5)                             # the north landing, where the routes meet
g.carve(2, 15, 3, 15)                            # niches: off the colonnade (blind)
g.carve(42, 14, 43, 14)                          # off the second chamber (blind)
g.carve(12, 31, 12, 32)                          # off the south hall (blind)
g.carve(22, 3, 23, 5, "+")
g.faces(2)
f5.stairs_up(22, 25, "past-temple-4", "down")
f5.gated_stairs_down(22, 3, "past-chaos", "arrival", "DEATH_EYE_DEFEATED")
for y in (9, 14, 19, 24):
    f5.deco([["tpillar_top"], ["tpillar_bottom"]], 7, y - 1)
f5.npcs += [
    chest("eyes_colonnade", "hi_potion", "a Hi-Potion", 2, 15),
    chest("eyes_chamber", "ether", "an Ether", 43, 14),
    chest("eyes_hall", "phoenix_down", "a Phoenix Down", 12, 32),
]
EYES = [{"x": 10, "y": y, "text": line} for y, line in [
    (10, ["An eye is carved deep into the wall, its pupil a polished black stone. It is turned toward the stair."]),
    (17, ["Another carved eye. Its stone pupil has been set off-centre, as if it glanced aside when you passed."]),
    (23, ["The carving here is of an eye half shut. Someone has scratched a tally of days beneath it and given up."]),
]] + [{"x": 33, "y": 14, "text": ["Eyes are carved on this wall in a ring, every one of them looking inward at "
                                  "its empty centre."]}]
eye = f5.boss({"id": "past_death_eye", "sprite": "black_wizard", "tint": "#6a5a80", "x": 22, "y": 5,
               "dialog": ["A single great eye, wound in grave cloth, hangs above the stair. It has not blinked since "
                          "you came up the hall.",
                          "The eye's gaze settles on you, and you feel the last few minutes go thin, as if they might "
                          "be taken back."]},
              ["death_eye", "iron_golem"], "DEATH_EYE_DEFEATED", "pst_death_eye_falls",
              "The grave cloth unwinds, and an iron warden clanks out of the wall to stand beside the eye.")
f5.write("Temple of the Past 5: a hall of eyes; two routes meet at the landing the Death Eye guards.",
         {"arrival": [22, 27], "down": [24, 4], "boss": [20, 5]}, table=LOWER, script=SCRIPT,
         extra={"scriptedEncounters": [eye], "inspect": EYES})

# ════════════════════════════ the shrine of Chaos ════════════════════════════
fc = Room("past-chaos", "Chaos's Shrine", 30, 32)
g = fc.g
g.carve(4, 26, 25, 29)                           # the vestibule (from floor 5)
g.carve(12, 12, 17, 25)                          # the processional, ending at a blank wall
g.carve(4, 9, 5, 25)                             # the west side aisle ...
g.carve(24, 9, 25, 25)                           # ... and the east, up to the sanctum's two ends
g.carve(4, 3, 25, 8)                             # the sanctum
g.carve(2, 6, 3, 6)                              # the sanctum's side niches (blind)
g.carve(26, 6, 27, 6)
g.carve(14, 4, 15, 8, "+")
g.carve(14, 12, 15, 25, "+")
g.faces(2)
fc.stairs_up(20, 24, "past-temple-5", "down")
for y in (13, 17, 21):
    for x in (12, 17):
        fc.deco([["tpillar_top"], ["tpillar_bottom"]], x, y)
for x in (9, 20):
    fc.deco([["brazier"]], x, 3)
fc.npcs += [
    chest("shrine_west", "ether", "an Ether", 2, 6),
    chest("shrine_east", "phoenix_down", "a Phoenix Down", 27, 6),
]
SHADOW = [{"x": 14, "y": 11, "text": ["On the blank wall where the processional ends, someone has painted a shadow: a "
                                      "crowned shape with too many arms, reaching up toward the sanctum."]},
          {"x": 15, "y": 11, "text": ["The paint of the shadow is still wet. It has run down the wall in four thin "
                                      "streaks, one for each of the fiends."]}]
chaos = fc.boss({"id": "past_chaos", "sprite": "king", "tint": "#5b3d84", "x": 14, "y": 5,
                 "dialog": ["A robed figure sits on the sanctum's dais, crowned with a ring of flame that gives no "
                            "heat. Four dim orbs turn slowly about its head.",
                            "Chaos: The fiends fed me from the four corners of the world, and twice you starved me of "
                            "them. Very well. I will make a meal of the ones who did it."]},
                ["chaos"], "CHAOS_DEFEATED", "ending",
                "The crown of flame climbs from its head to the ceiling, and the robed shape rises after it, "
                "growing until the sanctum is too small to hold it.")
fc.write("Chaos's Shrine: a processional to a blank wall; side aisles climb to the sanctum where Chaos waits.",
         {"arrival": [20, 26], "boss": [14, 7]}, table=[], bg="rim", script=SCRIPT,
         extra={"scriptedEncounters": [chaos], "encounterRate": {"min": 999, "max": 999}, "inspect": SHADOW})
print("past-temple-4, past-temple-5, past-chaos written")

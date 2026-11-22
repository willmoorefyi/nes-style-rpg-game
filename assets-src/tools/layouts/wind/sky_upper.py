"""The sky castle 3F to 5F (docs/WORLD_PLAN.md 4.7, stage S28; WND-D2), original layouts -> assets-src/maps/
sky-castle-3f.yaml, sky-castle-4f.yaml, sky-castle-5f.yaml.

  python3 -I assets-src/tools/layouts/wind/sky_upper.py && python3 -I assets-src/tools/build_map.py sky-castle-3f sky-castle-4f sky-castle-5f

  sky-castle-3f  the archive: the stair arrives in a south landing below a reading hall of shelf stacks and star
                 charts; a door in the hall's west wall opens on a narrow stair-passage down to the sealed vault (a
                 dead end holding the adamant, CHEST_WND_D2_ADAMANT); two blind north niches and an east niche hold
                 chests; the stair up stands in the hall's north wall
  sky-castle-4f  the engine halls: three long halls run west to east, the stokers' aisles between their furnaces and
                 pistons, joined by cross passages that never line up; the stair up rises from the south hall's east
                 end; three blind bays hold chests. The whole floor is the zone `wnd_d2_engine`, where the Warmech, the
                 engines' watchman, walks (1 in 64)
  sky-castle-5f  the seraph's spire (`canSave: false`): a narrow nave runs due north of the arrival up a light-bridge
                 runner to the Hollow Seraph before the wind crystal's altar; her fall (`wnd_seraph_falls`) lights
                 the crystal (WIND_CRYSTAL_LIT); two blind side alcoves hold chests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sky_common import ENGINE, ENGINE_ZONE, RATE, UPPER, WON, Room, chest  # noqa: E402

SCRIPT = "wind/sky_upper.py"

# ════════════════════════════ 3F: the archive ════════════════════════════
f3 = Room("sky-castle-3f", "Sky Castle 3F", 36, 30)
g = f3.g
g.carve(15, 24, 22, 27)                          # the south landing (from 2F)
g.carve(17, 21, 18, 23)                          # up into the hall
g.carve(5, 6, 31, 20)                            # the reading hall
g.carve(12, 3, 12, 5)                            # a north niche (blind)
g.carve(27, 3, 27, 5)                            # a second north niche (blind)
g.carve(32, 11, 34, 11)                          # the east niche (blind)
g.carve(2, 13, 4, 13)                            # the west door ...
g.carve(2, 14, 2, 21)                            # ... and the narrow passage down to the vault
g.carve(1, 22, 6, 27)                            # the sealed vault
g.faces(2)
f3.stairs_down(18, 26, "sky-castle-2f", "up")
f3.stairs_up(20, 4, "sky-castle-4f", "arrival")
for x in list(range(7, 15)) + list(range(22, 30)):
    if x not in (10, 26):                        # two rows of shelf stacks, each with an aisle through it
        f3.tall("bookshelf", x, 9)
        f3.tall("bookshelf", x, 15)
for x, y in [(9, 13), (26, 13)]:
    f3.deco([["lectern"]], x, y)
f3.deco([["globe"]], 18, 12)
f3.deco([["map_table_l", "map_table_r"]], 15, 18)
f3.deco([["gold_heap"]], 2, 25)
f3.deco([["crown_cushion"]], 5, 22)
f3.npcs += [
    chest("adamant", "adamant", "the Adamant", 4, 26),
    chest("niche_north_west", "ether", "an Ether", 12, 3),
    chest("niche_north_east", "phoenix_down", "a Phoenix Down", 27, 3),
    chest("niche_east", "diamond_armlet", "a Diamond Armlet", 34, 11),
    {"id": "wnd_d2_archivist", "sprite": "old_man", "tint": "#c9a45a", "x": 24, "y": 19,
     "dialog": [{"condition": WON, "text": [
         "Archivist: The vane on the spire is turning. I had stopped recording the wind. I shall have to begin again."]},
         {"text": ["A brass figure in a scholar's gown dusts a shelf that has no dust on it.",
                   "Archivist: The charts are in order. The stars have not moved. Only the wind is wrong, and the "
                   "steward upstairs will not let me write it down."]}]},
    {"id": "wnd_ancient_archive", "sprite": "robot_ancient", "x": 30, "y": 19, "dialog": [   # AR-N3: flavour only
        "An old robot, green with age, stands in the corner of the hall. Its eyes brighten as you pass, then dim."]},
]
f3.write("Sky Castle 3F: the archive; shelf stacks and star charts, a sealed vault down a west passage.",
         {"arrival": [20, 25], "up": [20, 7]}, table=UPPER, bg="sky_palace", script=SCRIPT,
         extra={"inspect": [{"x": 15, "y": 18, "text": [
             "A star chart lies open on the table, every star joined to the next by a line of fine brass wire. In one "
             "corner a note: the hard ore for the forge below the isthmus is kept in the vault."]}]})

# ════════════════════════════ 4F: the engine halls ════════════════════════════
f4 = Room("sky-castle-4f", "Sky Castle 4F", 44, 30)
g = f4.g
g.carve(2, 13, 7, 17)                            # the west landing (from 3F)
g.carve(8, 4, 39, 8)                             # the north hall
g.carve(8, 13, 39, 17)                           # the middle hall
g.carve(8, 22, 39, 26)                           # the south hall
g.carve(14, 9, 15, 12)                           # north - middle, west
g.carve(33, 9, 34, 12)                           # north - middle, east
g.carve(24, 18, 25, 21)                          # middle - south
g.carve(20, 1, 20, 3)                            # a north bay (blind)
g.carve(40, 6, 42, 6)                            # an east bay off the north hall (blind)
g.carve(40, 24, 42, 24)                          # an east bay off the south hall (blind)
g.carve(8, 27, 8, 28)                            # a coal chute off the south hall (blind)
g.faces(2)
f4.stairs_down(3, 16, "sky-castle-3f", "up")
f4.stairs_up(36, 20, "sky-castle-5f", "arrival")
for x in (11, 19, 28, 38):                        # pistons along the halls' north walls
    f4.pillar(x, 4)
    f4.pillar(x, 22)
for x in (18, 30):
    f4.deco([["brazier"]], x, 13)                # the furnaces of the middle hall
f4.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 22, 6)
f4.npcs += [
    chest("bay_north", "hi_potion", "a Hi-Potion", 20, 1),
    chest("bay_east", "diamond_shield", "a Diamond Shield", 42, 6),
    chest("bay_south_east", "cabin", "a Cabin", 42, 24),
    {"id": "wnd_ancient_stoker", "sprite": "robot_ancient", "x": 31, "y": 13, "dialog": [   # AR-N3: flavour only
        "The old robot tends the furnace with an empty shovel. It swings it to the fire, and lifts it again."]},
]
f4.write("Sky Castle 4F: the engine halls; three halls of furnaces and pistons, the Warmech's beat.",
         {"arrival": [5, 14], "up": [36, 23]}, table=UPPER, bg="sky_palace", script=SCRIPT,
         extra={"encounterZones": [{"id": ENGINE_ZONE, "name": "Sky Castle Engine Halls", "rects": [[0, 0, 43, 29]],
                                    "encounters": ENGINE, "encounterRate": RATE}],
                "inspect": [{"x": 22, "y": 7, "text": [
                    "A piston lies snapped in two, its iron scored by something that walks on more feet than a man. "
                    "The scoring runs on down the hall."]}]})

# ════════════════════════════ 5F: the seraph's spire ════════════════════════════
f5 = Room("sky-castle-5f", "Sky Castle 5F", 26, 34)
g = f5.g
g.carve(9, 28, 16, 31)                           # the stair landing (from 4F)
g.carve(8, 5, 17, 27)                            # the nave
g.carve(12, 7, 13, 27, "+")                      # the light-bridge runner, due north to the seraph
g.carve(3, 16, 7, 16)                            # the west alcove (blind)
g.carve(18, 21, 22, 21)                          # the east alcove (blind)
g.faces(2)
f5.stairs_down(12, 30, "sky-castle-4f", "up")
f5.deco([["altar_l", "altar_r"]], 12, 5)         # the wind crystal's altar
for y in (9, 14, 19, 24):
    f5.pillar(9, y)
    f5.pillar(16, y)
f5.npcs += [
    chest("alcove_west", "vorpal_sword", "a Vorpal Sword", 3, 16),
    chest("alcove_east", "ether", "an Ether", 22, 21),
    {"id": "hollow_seraph", "sprite": "knight", "tint": "#b9a46e", "x": 12, "y": 8, "hideIf": WON,
     "dialog": ["A figure of brass plates hangs in the air before the altar, the plates drifting a finger's width "
                "apart. Behind them something ticks.",
                "Hollow Seraph: The wind was loud. It wore the charts thin and the stars crooked. I closed it in the "
                "crystal, and the world has been quiet since. You will not open it."]},
]
f5.write("Sky Castle 5F: the seraph's spire; she waits due north of the stair, before the wind crystal's altar.",
         {"arrival": [12, 28], "boss": [12, 11]}, table=UPPER, bg="throne_tiamat", script=SCRIPT,
         extra={"canSave": False,
                "inspect": [{"x": 12, "y": 5, "text": [
                    {"condition": WON, "text": ["The crystal on the altar spins slowly on its point, and a draught "
                                                "you can feel on your face pours out of it."]},
                    {"text": ["A crystal stands on the altar, still and cloudy, like a breath held too long."]}]}],
                "scriptedEncounters": [{
                    "x": 12, "y": 8, "npc": "hollow_seraph", "enemyIds": ["hollow_seraph", "air_elemental"],
                    "flag": WON, "isBoss": True, "postVictoryCutscene": "wnd_seraph_falls",
                    "message": "The plates snap together into a shell with four blades of light for wings, and the "
                               "crystal coughs out one hard gust that spins into a whirlwind at her side."}]})
print("sky-castle-3f, sky-castle-4f, sky-castle-5f written")

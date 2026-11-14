"""Cornelia Castle interiors (original layouts) -> assets-src/maps/cornelia-castle*.yaml.

  python3 -I assets-src/tools/layouts/castle.py && python3 -I assets-src/tools/build_map.py

Four floors joined by stairs:
  cornelia-castle         1F  grand hall, barracks, banquet hall, library and its reading gallery, treasury
  cornelia-castle-2f      2F  throne room, the princess's chamber, the King's study, chapel, guard room (tower stair)
  cornelia-castle-tower   3F  the sage's lookout at the top of the east tower
  cornelia-castle-cellar  B1  storerooms and wine cellar under the treasury

CA-3 (won't fix, T6 decision 1): the 1F stairs leave at the hall's north end and 2F is entered at the throne room's
foot, as in FF1; 2F's north end is the dais and the throne, so the stairs cannot line up without rebuilding 2F.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Room as BaseRoom  # noqa: E402

KITS = ["castle", "interior", "town"]
CASTLE_MATS = {"floor_stone": "marble", "in_wall_face": "castle_wall_in",
               "in_wall_top": {"from": "slate", "shade": 0.55}, "floor": {"from": "floor", "shade": 0.8}}
GOLD = [214, 170, 64]
LEGEND = "legend: W wall top  F wall face  - marble  _ wood floor  + royal carpet"
QUIET = {"encounterRate": {"min": 999, "max": 999}, "encounters": [], "no_static_chokepoints": True,
         "no_unreachable_walkable": True}                                                  # M4


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, extra: dict | None = None, mats: dict | None = None,
              kits: list | None = None):
        return super().write(header, entrances, kits=kits or KITS, mats=mats or CASTLE_MATS, trim=GOLD, quiet=QUIET,
                             script="castle.py", legend=LEGEND, extra=extra)


# ════════════════════════════ 1F: the grand hall ════════════════════════════
f1 = Room("cornelia-castle", "Cornelia Castle 1F", 44, 34)
g = f1.g
g.carve(12, 3, 31, 5)                    # north gallery joining the wings (the library's reading gallery)
g.carve(2, 4, 11, 15, "_")               # barracks
g.carve(2, 19, 11, 30, "_")              # banquet hall
g.carve(32, 4, 41, 15, "_")              # library
g.carve(32, 19, 41, 30)                  # treasury
g.carve(14, 9, 29, 31)                   # grand hall
for y0 in (12, 25):                      # doorways from the hall into the wings
    g.carve(12, y0, 13, y0 + 1)
    g.carve(30, y0, 31, y0 + 1)
g.carve(9, 16, 10, 18, "_")              # barracks <-> banquet hall
g.carve(36, 16, 37, 18)                  # library <-> treasury
g.carve(21, 9, 22, 33, "+")              # the royal runner, out through the main door
for y0 in (12, 25):                      # cross runners to the side doors
    g.carve(12, y0, 31, y0 + 1, "+")
g.faces(2)
# the grand staircase between statues, under banners and arched windows
f1.stairs_up(21, 7, "cornelia-castle-2f", "stairs")
f1.statue(19, 9)
f1.statue(24, 9)
for x in (15, 28):
    f1.wall([["arch_window_top"], ["arch_window_bottom"]], x, 7)
for x in (17, 26):
    f1.wall([["flag_top"], ["flag_bottom"]], x, 7)
for x in (20, 23):
    f1.wall([["torch"]], x, 7)
for y in (15, 20, 28):
    f1.pillar(16, y)
    f1.pillar(27, y)
for (x, y) in [(15, 30), (28, 30), (14, 9), (29, 9), (14, 23), (29, 23)]:
    f1.deco([["plant"]], x, y)
for (x, y) in [(14, 18), (29, 18)]:
    f1.statue(x, y)
# gallery (CA-7): the library's reading gallery. Shelves stand against the north wall and the lecterns, the bench
# and the scholar keep to the top row, so rows 4 and 5 stay open from the barracks to the library.
for x in (12, 13, 15, 16, 17, 26, 27, 28, 30, 31):
    f1.deco([["bookshelf_top"], ["bookshelf_bottom"]], x, 2, on_wall=True)
for x in (19, 24):
    f1.deco([["lectern"]], x, 3)             # castle/kit_stairs_lib
for x in (21, 22):
    f1.deco([["stone_bench"]], x, 3)
for x in (14, 18, 25, 29):
    f1.wall([["arch_window_top"], ["arch_window_bottom"]], x, 1)
for x in (16, 27):
    f1.wall([["tapestry"]], x, 1)
f1.wall([["banner"]], 21, 1)
f1.wall([["banner"]], 22, 1)
# barracks
for x in (3, 5, 7):
    f1.tall("bed", x, 4)
for x in (3, 6):
    f1.wall([["weapon_rack"]], x, 2)
f1.wall([["torch"]], 9, 2)
for (x, y) in [(11, 6), (11, 9)]:
    f1.deco([["armor_stand"]], x, y)
for (x, y, t) in [(2, 14, "barrel"), (3, 14, "crate"), (2, 13, "barrel")]:
    f1.objects.append({"type": t, "x": x, "y": y})
# banquet hall
f1.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], 4, 17, on_wall=True)
f1.wall([["tapestry"]], 7, 17)
f1.wall([["torch"]], 2, 17)
for (x, y) in [(3, 22), (7, 22), (3, 26), (7, 26)]:
    f1.deco([["banquet_l", "banquet_r"]], x, y)
for (x, y, t) in [(11, 29, "barrel"), (11, 30, "barrel"), (10, 30, "crate"), (2, 30, "crate")]:
    f1.objects.append({"type": t, "x": x, "y": y})
# library
for x in (34, 35, 38, 39, 40, 41):          # M2: (32-33, 4-5) stays open to the reading gallery
    f1.tall("bookshelf", x, 4)
f1.wall([["window_in"]], 36, 2)
f1.wall([["window_in"]], 37, 2)
for (x, y) in [(35, 9), (38, 9), (35, 12)]:
    f1.deco([["desk"]], x, y)
f1.deco([["orb_white"]], 41, 14)
f1.deco([["plant"]], 32, 14)
f1.deco([["globe"]], 38, 12)                 # castle/kit_stairs_lib
# treasury, with the stair down to the cellar
f1.wall([["banner"]], 34, 17)
f1.wall([["torch"]], 39, 17)
f1.stairs_down(39, 28, "cornelia-castle-cellar", "stairs")
for (x, y, t) in [(32, 30, "crate"), (33, 30, "barrel"), (41, 19, "crate"), (41, 20, "barrel")]:
    f1.objects.append({"type": t, "x": x, "y": y})
f1.deco([["armor_stand"]], 32, 19)
f1.deco([["armor_stand"]], 33, 19)
f1.wall([["weapon_rack"]], 35, 17)          # not 37: that cell is in the library doorway (CA-4)
f1.wall([["weapon_rack"]], 40, 17)
for (x, y) in [(32, 21), (32, 22)]:          # CA-4: clear of the doorway from the hall at (32, 25-26)
    f1.objects.append({"type": "barrel", "x": x, "y": y})
# CA-7: the gold heap and the crown on its cushion, between the two chests (castle/kit_stairs_lib)
f1.deco([["gold_heap"]], 36, 22)
f1.deco([["crown_cushion"]], 38, 22)

f1.npcs += [
    {"id": "hall_guard_w", "sprite": "guard", "x": 19, "y": 30, "dialog": ["Welcome to Cornelia Castle.",
                                                                            "The throne room is up the grand staircase."]},
    {"id": "hall_guard_e", "sprite": "guard", "x": 24, "y": 30,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["The princess is home! The whole kingdom rejoices."]},
                {"text": ["Since Garland took the princess, the King has not slept."]}]},
    {"id": "stair_guard", "sprite": "guard", "x": 20, "y": 11,
     "dialog": [{"condition": "INTRO_COMPLETE", "text": [
         "The throne room is up the stairs. His Majesty will always receive the Warriors of Light."]},
                {"text": ["His Majesty awaits you upstairs."]}]},
    {"id": "hall_noble", "sprite": "burgher", "x": 18, "y": 20, "wander": True,
     "dialog": ["They say the four crystals once shone over the whole world."]},
    {"id": "barracks_captain", "sprite": "guard", "x": 5, "y": 9,
     "dialog": [{"condition": "GARLAND_DEFEATED", "text": ["You bested Garland? He trained every soldier in this room."]},
                {"text": ["Garland was our captain.", "He taught me everything I know with a sword. And now..."]}]},
    {"id": "barracks_soldier", "sprite": "guard", "x": 8, "y": 12, "wander": True,
     "dialog": ["Off duty. Do not tell the captain I was napping."]},
    {"id": "castle_cook", "sprite": "villager_f", "x": 6, "y": 24, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["The feast is ready! Her Highness is home!"]},
                {"text": ["A feast for the princess's return is ready the moment she is home!"]}]},
    {"id": "castle_maid", "sprite": "villager_f", "x": 9, "y": 28, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED", "text": ["Her Highness is safe at last. Thank you!"]},
                {"text": ["Garland was the King's most trusted knight...", "Why would he turn against us?"]}]},
    {"id": "court_scholar", "sprite": "old_man", "x": 36, "y": 11,
     "dialog": ["The Temple of Fiends was built to honour the light, long ago.",
                "Now darkness gathers there. Garland chose it for a reason."]},
    {"id": "library_mage", "sprite": "mage", "x": 39, "y": 12, "wander": True,
     "dialog": ["Shh! This is a library.", "...The sage in the east tower knows more than every book here."]},
    {"id": "gallery_scholar", "sprite": "old_man", "x": 20, "y": 3,
     "dialog": ["These shelves hold the chronicles of Cornelia, back to the sailors who founded it.",
                "The old charts show a bridge to the north since long before my time. A winter storm took it."]},
    {"id": "chest_treasury_cabin", "sprite": "chest", "x": 35, "y": 24, "chestItem": "cabin",
     "chestFlag": "CHEST_CORNELIA_TREASURY_1", "dialog": ["You found a Cabin!"]},
    {"id": "chest_treasury_phoenix", "sprite": "chest", "x": 37, "y": 24, "chestItem": "phoenix_down",
     "chestFlag": "CHEST_CORNELIA_TREASURY_2", "dialog": ["You found a Phoenix Down!"]},
    {"id": "treasury_guard", "sprite": "guard", "x": 34, "y": 23,        # M13: not in front of the gold heap
     # ST-9: the default holds before the audience with the King (there is no "met the King" flag)
     "dialog": [{"condition": "GARLAND_DEFEATED", "text": ["Garland is beaten, but the storeroom below stays open to "
                                                           "you.", "Take what you need for the road ahead."]},
                {"text": ["The storeroom below is open to any who would face Garland.",
                          "Take what you need before you set out."]}]},
]
f1.transitions += [{"x": x, "y": 33, "targetMap": "cornelia", "targetEntrance": "castle"} for x in (21, 22)]
f1.write("Cornelia Castle 1F: grand hall (stairs up to the throne room), barracks, banquet hall, library and its"
         " reading gallery, treasury (stairs down to the cellar).",
         {"gate": [21, 31], "stairs": [21, 9], "cellar": [39, 27]})


# ════════════════════════════ 2F: the throne room ════════════════════════════
f2 = Room("cornelia-castle-2f", "Cornelia Castle 2F", 44, 30)
g = f2.g
g.carve(12, 6, 31, 25)                   # throne room
g.carve(2, 6, 10, 14, "_")               # the princess's chamber
g.carve(2, 18, 10, 25, "_")              # the King's study
g.carve(33, 6, 41, 14)                   # tower stair hall
g.carve(33, 18, 41, 25)                  # chapel
for (x, y0) in [(11, 10), (11, 21), (32, 10), (32, 21)]:
    g.carve(x, y0, x, y0 + 1)
g.carve(19, 6, 24, 8, "+")               # the dais
g.carve(20, 9, 23, 25, "+")              # the royal runner, 4 wide (1F's is 2: CA-7)
for y0 in (10, 21):                      # cross runners to the side doors
    g.carve(11, y0, 32, y0 + 1, "+")
for dy in range(-3, 4):                  # a medallion rug before the dais
    g.carve(17 + abs(dy), 15 + dy, 26 - abs(dy), 15 + dy, "+")
g.carve(5, 9, 7, 11, "+")                # rug in the princess's chamber
g.carve(36, 19, 38, 25, "+")             # chapel aisle
g.faces(2)
# CA-5 / M13 (reverses T6 decision 7): the throne is shifted half a cell west so its seat is centred on column 21;
# the King stands before it at (21, 8) so the chair shows (there is no sitting pose), talked to from (21, 9).
f2.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 21, 6, fit=True, offset=[-24, 0])
f2.stairs_down(21, 24, "cornelia-castle", "stairs")
for x in (13, 16, 27, 30):
    f2.wall([["arch_window_top"], ["arch_window_bottom"]], x, 4)
for x, parts in [(x, [["flag_top"], ["flag_bottom"]]) for x in (19, 24)] + [(x, [["torch"]]) for x in (18, 25)] + [
        (x, [["banner"]]) for x in (20, 23)]:
    f2.wall(parts, x, 4)
for x in (19, 24):                       # U18: pillars close the dais's back corners, plants (below) its front
    f2.pillar(x, 6)
for y in (9, 13, 17):
    f2.pillar(15, y)
    f2.pillar(28, y)
for (x, y) in [(13, 24), (30, 24), (13, 14), (30, 14)]:
    f2.statue(x, y)
for (x, y) in [(12, 6), (31, 6), (12, 25), (31, 25), (18, 25), (25, 25), (19, 8), (20, 8), (23, 8), (24, 8)]:
    f2.deco([["plant"]], x, y)
# the princess's chamber
f2.tall("bed", 2, 6)
f2.deco([["desk"]], 9, 6)
f2.tall("bookshelf", 10, 6)
f2.deco([["plant"]], 4, 6)
f2.deco([["plant"]], 2, 13)
f2.wall([["window_in"]], 5, 4)
f2.wall([["window_in"]], 7, 4)
f2.wall([["tapestry"]], 3, 4)
for (x, y) in [(9, 13), (10, 13)]:
    f2.objects.append({"type": "flowers", "x": x, "y": y})
# the King's study
f2.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], 7, 16, on_wall=True)
for x in (2, 3, 4):
    f2.tall("bookshelf", x, 18)
f2.deco([["desk"]], 5, 22)
f2.wall([["tapestry"]], 5, 16)
f2.deco([["armor_stand"]], 10, 25)
# the guard room, with the tower stair and the war-map table (CA-7)
f2.stairs_up(37, 4, "cornelia-castle-tower", "stairs")
f2.wall([["banner"]], 35, 4)
f2.wall([["banner"]], 40, 4)
for x in (36, 39):
    f2.wall([["weapon_rack"]], x, 4)
f2.statue(34, 6)
f2.statue(41, 6)
for y in (8, 10, 12):
    f2.deco([["armor_stand"]], 41, y)
f2.deco([["map_table_l", "map_table_r"]], 37, 12)   # castle/kit_stairs_lib
# chapel
f2.deco([["orb_white"]], 36, 18)
f2.deco([["orb_white"]], 38, 18)
f2.wall([["arch_window_top"], ["arch_window_bottom"]], 37, 16)
f2.wall([["tapestry"]], 34, 16)
f2.wall([["tapestry"]], 40, 16)
for (x, y) in [(34, 21), (34, 23), (40, 21), (40, 23)]:
    f2.deco([["stone_bench"]], x, y)

f2.npcs += [
    {"id": "king", "sprite": "king", "x": 21, "y": 8,
     # first match wins: INTRO_COMPLETE must come before PRINCESS_RESCUED
     "dialog": [{"condition": "INTRO_COMPLETE",
                 "text": ["My builders are hard at work on the bridge to the north.",
                          "Go with our blessing, and may the crystals guide you."]},
                {"condition": "PRINCESS_RESCUED",
                 "text": ["You have brought my daughter home. Cornelia is in your debt, Warriors of Light!",
                          "As I promised, I will order the bridge to the north rebuilt at once."]},
                {"text": ["Welcome, travellers. I am the King of Cornelia.",
                          "Garland, once my finest knight, has carried off my daughter, Princess Liora.",
                          "He holds her in the Temple of Fiends, north-west of the city. Leave by the west gate and"
                          " follow the road; it ends at the temple door.",
                          "Bring her home safely, and I will rebuild the bridge to the north for you."]}],
     "cutscene": {"id": "act1_complete", "requiredFlag": "PRINCESS_RESCUED", "onceFlag": "INTRO_COMPLETE"}},
    {"id": "princess", "sprite": "princess", "x": 22, "y": 8, "showIf": "PRINCESS_RESCUED",
     "dialog": [{"condition": "GOT_LUTE", "text": ["Thank you again. Keep the lute safe."]},
                {"text": ["Thank you for rescuing me from Garland.",
                          "Please take this lute. It has been in our family for generations.",
                          "They say that one day its song will open a sealed way."]}],
     "giftItem": "lute", "giftFlag": "GOT_LUTE"},
    {"id": "chancellor", "sprite": "burgher", "x": 18, "y": 10,
     "dialog": [{"condition": "INTRO_COMPLETE", "text": ["The King's builders are at work on the bridge to the north."]},
                {"condition": "PRINCESS_RESCUED", "text": ["Her Highness is home! The King wishes to thank you himself."]},
                {"text": ["Garland is a fearsome swordsman. Buy armour in town before you go.",
                          "And rest at the inn, if you are wounded."]}]},
    {"id": "throne_guard_w", "sprite": "guard", "x": 19, "y": 21, "dialog": ["Long live the King!"]},
    {"id": "throne_guard_e", "sprite": "guard", "x": 24, "y": 21,
     "dialog": ["Speak plainly to His Majesty. He has no patience for flattery."]},
    {"id": "princess_maid", "sprite": "villager_f", "x": 7, "y": 12, "wander": True,
     "dialog": [{"condition": "PRINCESS_RESCUED",
                 "text": ["Her Highness is with the King in the throne room. She talks of nothing but you!"]},
                {"text": ["This is Her Highness's chamber. I keep it ready for her return.",
                          "Every morning I set out fresh flowers."]}]},
    {"id": "court_mage", "sprite": "mage", "x": 7, "y": 21,
     "dialog": ["His Majesty's study.", "The King reads old accounts of the Warriors of Light late into the night."]},
    {"id": "tower_guard", "sprite": "guard", "x": 36, "y": 9,
     "dialog": ["The castle guard keeps watch from this room. These stairs climb the east tower.",
                "The old sage lives at the top. Mind your head."]},
    {"id": "chapel_priest", "sprite": "mage", "x": 37, "y": 21,
     "dialog": ["Welcome to the royal chapel.", "May the light of the crystals watch over you."]},
]
f2.write("Cornelia Castle 2F: throne room, the princess's chamber, the King's study, guard room (tower stair),"
         " chapel.",
         {"stairs": [21, 23], "tower": [37, 6], "throne_return": [21, 9]},     # T2: the rescue warps here
         extra={"unreachable_ok": [[x, y] for x in (20, 23) for y in (6, 7)]})  # U18: the dais behind the royals


# ════════════════════════════ 3F: the sage's lookout ════════════════════════════
f3 = Room("cornelia-castle-tower", "Cornelia Castle 3F", 20, 13)    # M13: as wide as the 20-cell view
g = f3.g
g.carve(5, 4, 14, 10, "_")
g.carve(7, 6, 12, 9, "+")
g.faces(2)
f3.stairs_down(9, 9, "cornelia-castle-2f", "tower")
for x in (6, 9, 13):
    f3.wall([["arch_window_top"], ["arch_window_bottom"]], x, 2)
f3.wall([["banner"]], 11, 2)
for x in (5, 14):
    f3.tall("bookshelf", x, 4)
f3.deco([["desk"]], 11, 4)
f3.deco([["orb_white"]], 5, 8)
f3.deco([["plant"]], 14, 9)
f3.npcs += [{"id": "tower_sage", "sprite": "old_man", "x": 8, "y": 5,
             "dialog": [{"condition": "GOT_LUTE",
                         "text": ["So the princess gave you the old lute.",
                                  "Keep it close. Somewhere a door sleeps that only its song can wake."]},
                        {"text": ["Ah, visitors! From up here I watch the stars... and the crystals.",
                                  "Four crystals hold the world in balance. Their light is fading.",
                                  "Legend says four Warriors of Light will come. Perhaps you are they."]}]}]
f3.write("Cornelia Castle 3F: the sage's lookout at the top of the east tower.", {"stairs": [9, 8]})


# ════════════════════════════ B1: the cellar ════════════════════════════
b1 = Room("cornelia-castle-cellar", "Cornelia Castle B1", 22, 15)
g = b1.g
g.carve(2, 4, 19, 12)
g.carve(2, 4, 8, 12)
g.faces(2)
b1.stairs_up(10, 2, "cornelia-castle", "cellar")
for x in (3, 16):
    b1.wall([["torch"]], x, 2)
for (x, y, t) in [(2, 4, "barrel"), (3, 4, "barrel"), (4, 4, "barrel"), (2, 5, "barrel"), (17, 4, "crate"),
                  (18, 4, "crate"), (19, 4, "crate"), (19, 5, "crate"), (2, 12, "crate"), (19, 12, "barrel"),
                  (18, 12, "barrel"), (18, 7, "barrel"), (19, 7, "barrel"), (18, 8, "barrel"), (19, 8, "barrel"),
                  (19, 9, "barrel"), (2, 10, "crate"), (3, 10, "crate"), (2, 11, "crate")]:   # M9: casks, grain
    b1.objects.append({"type": t, "x": x, "y": y})
for x in (5, 6, 7, 8, 13, 14, 15, 16):      # CA-7: a row of wine racks along the north wall
    b1.wall([["potion_shelf"]], x, 3)
for (x, y, part) in [(14, 4, "armor_stand"), (15, 4, "armor_stand"), (11, 8, "table")]:      # M9
    b1.deco([[part]], x, y)
# M10: the cellar loot no longer repeats the house chests (flags unchanged)
b1.npcs += [
    {"id": "chest_castle_potion", "sprite": "chest", "x": 6, "y": 9, "chestItem": "hi_potion",
     "chestFlag": "CHEST_CORNELIA_POTION", "dialog": ["You found a Hi-Potion!"]},
    {"id": "chest_castle_antidote", "sprite": "chest", "x": 9, "y": 10, "chestItem": "wooden_armor",
     "chestFlag": "CHEST_CORNELIA_ANTIDOTE", "dialog": ["You found Wooden Armor!"]},
    {"id": "chest_castle_tent", "sprite": "chest", "x": 15, "y": 9, "chestItem": "robe",
     "chestFlag": "CHEST_CORNELIA_TENT", "dialog": ["You found a Robe!"]},
    {"id": "chest_castle_ether", "sprite": "chest", "x": 3, "y": 5, "chestItem": "ether",   # behind the barrels
     "chestFlag": "CHEST_CORNELIA_ETHER", "dialog": ["You found an Ether!"]},
    {"id": "cellar_steward", "sprite": "villager", "x": 13, "y": 6,
     "dialog": ["Wine, grain and old armour, all the way to the walls.", "Take what you need. The King would want it so."]},
]
b1.write("Cornelia Castle B1: the cellar storerooms and wine racks under the treasury.", {"stairs": [10, 4]},
         mats={"floor_stone": "floor_stone", "in_wall_face": "castle_wall_in",
               "in_wall_top": {"from": "slate", "shade": 0.45}})

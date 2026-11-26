"""Act 1's pins (docs/NATURAL_WORLD_PLAN.md 3.6.2). Derived by NW-3's `a1/world_a1_derive.py` from pass W's world;
since NW-5 (pass W's world and the derive script retired) this file is the source: edit it by hand, under review.

Act 1's pins and stamps, every cell **Cornelia-relative** (rel = p_today - (92, 111); its NW world cell is
CORNELIA_NW + rel, `worldgen.spec.world`). `TEMPLATE` is act 1's template grid from `TEMPLATE_AT` (today's outline
and its kept cells): a legend char is a kept cell (copied as is), `#` regenerated land, a space regenerated sea.
`ROADS` are routed (2.4 rule 8) through their points, each gate road starting on its gate's warp cell; `TODAY_WALKS`
is 3.6.3's feel table measured on today's ground.
"""
# flake8: noqa: E501
TEMPLATE_AT = (-28, -47)
ENTRANCES = {"cornelia": (0, 0), "cornelia_west": (-3, -2), "cornelia_east": (3, -2), "cornelia_north": (0, -5), "castle": (0, -5), "north_shore": (1, -19), "temple": (-13, -8), "a1_matoya": (-18, -35), "a1_pravoka": (39, -10)}
TRANSITIONS = [
    {"x": 0, "y": -4, "targetMap": "cornelia", "targetEntrance": "castle"},
    {"x": -2, "y": -2, "targetMap": "cornelia", "targetEntrance": "west_gate"},
    {"x": 2, "y": -2, "targetMap": "cornelia", "targetEntrance": "east_gate"},
    {"x": 0, "y": -1, "targetMap": "cornelia", "targetEntrance": "south_gate"},
    {"x": -13, "y": -9, "targetMap": "temple-of-fiends", "targetEntrance": "entry"},
    {"x": -18, "y": -36, "targetMap": "matoya-cave", "targetEntrance": "arrival"},
    {"x": 39, "y": -11, "targetMap": "pravoka", "targetEntrance": "gate"},
]
GATES = [
    {"id": "a1_bridge_gate_w", "x": 1, "y": -15, "requiredFlag": "BRIDGE_BUILT", "message": [{"condition": "INTRO_COMPLETE", "text": ["The King's builders are at work on the bridge, but it isn't finished yet."]}, {"text": ["The bridge has collapsed into the sea. Only the King's builders could repair it."]}], "permanent": False},
    {"id": "a1_bridge_gate_e", "x": 2, "y": -15, "requiredFlag": "BRIDGE_BUILT", "message": [{"condition": "INTRO_COMPLETE", "text": ["The King's builders are at work on the bridge, but it isn't finished yet."]}, {"text": ["The bridge has collapsed into the sea. Only the King's builders could repair it."]}], "permanent": False},
]
OBJECTS = [
    {"type": "deco", "parts": [["city_0_0", "city_0_1", "city_0_2", "city_0_3", None], ["city_1_0", "city_1_1", "city_1_2", "city_1_3", None], ["city_2_0", "city_2_1", "city_2_2", "city_2_3", None], ["city_3_0", "city_3_1", "city_3_2", "city_3_3", None]], "x": -2, "y": -4, "offset": [24, 0], "collide": "alpha", "walk_cells": [[2, 0], [0, 2], [4, 2], [2, 3]]},
    {"type": "deco", "name": "temple", "x": -14, "y": -10, "offset": [13, 0], "collide": "alpha", "style": "brighter", "parts": [["temple_ruin_0_0", "temple_ruin_0_1", None], ["temple_ruin_1_0", "temple_ruin_1_1", None]], "walk_cells": [[1, 1]]},
    {"type": "deco", "parts": [["altar_l", "altar_r"]], "x": 22, "y": -4, "style": "stone"},
    {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": 21, "y": -5},
    {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": 24, "y": -5},
    {"type": "flowers", "x": 21, "y": -3},
    {"type": "flowers", "x": 24, "y": -3},
    {"type": "deco", "parts": [["bridge_gap_0_0", "bridge_gap_0_1"], ["bridge_gap_1_0", "bridge_gap_1_1"]], "name": "broken_bridge", "x": 1, "y": -17, "block": False, "on_water": True, "style": "pale_stone"},
    {"type": "deco", "parts": [["boulder"]], "x": -8, "y": 0, "collide": "alpha"},
    {"type": "deco", "parts": [["boulder"]], "x": 9, "y": -6, "collide": "alpha"},
    {"type": "deco", "parts": [["boulder"]], "x": -17, "y": 4, "collide": "alpha"},
    {"type": "deco", "name": "matoya_cave", "parts": [["cave_mouth_icon_0_0", "cave_mouth_icon_0_1"], ["cave_mouth_icon_1_0", "cave_mouth_icon_1_1"]], "x": -18, "y": -37, "offset": [-24, 0], "walk_cells": [[0, 1]]},
    {"type": "deco", "name": "pravoka", "parts": [["town_pravoka_icon_0_0", "town_pravoka_icon_0_1", "town_pravoka_icon_0_2"], ["town_pravoka_icon_1_0", "town_pravoka_icon_1_1", "town_pravoka_icon_1_2"], ["town_pravoka_icon_2_0", "town_pravoka_icon_2_1", "town_pravoka_icon_2_2"]], "x": 38, "y": -13, "walk_cells": [[1, 2]], "collide": "alpha", "on_water": True},
    {"type": "deco", "name": "lighthouse", "parts": [["lighthouse_icon_0_0", "lighthouse_icon_0_1"], ["lighthouse_icon_1_0", "lighthouse_icon_1_1"], ["lighthouse_icon_2_0", "lighthouse_icon_2_1"]], "x": 46, "y": -13, "collide": "alpha"},
    {"type": "deco", "name": "cairn", "parts": [["boulder"]], "x": 34, "y": -15},
    # PT-4 (docs/PLAYTEST_ELFHEIM_PLAN.md): Pravoka's berth, marked by two mooring posts in the water either side of
    # the dock (non-blocking: the ship sails past them), beside the plank quay of TEMPLATE (rel (39, -9), (39, -8))
    {"type": "deco", "name": "pravoka_mooring", "parts": [["dock_post_icon_0_0"]], "x": 40, "y": -10, "on_water": True, "block": False},
    {"type": "deco", "name": "pravoka_mooring", "parts": [["dock_post_icon_0_0"]], "x": 40, "y": -8, "on_water": True, "block": False},
]
INSPECT = [
    {"x": 22, "y": -4, "text": ["Here lies Erdrick."]},
    {"x": 23, "y": -4, "text": ["Here lies Erdrick."]},
    {"x": 0, "y": 10, "text": ["The pier runs out into the bay. No ship calls at Cornelia while pirates rule the seas."]},
    {"x": 34, "y": -15, "text": ["Travellers have stacked stones on this saddle, one for each safe crossing.", "Someone has scratched an arrow on the topmost stone. It points down the slope, east, to the harbour."]},
]
NPCS = [
    {"id": "chest_tomb", "sprite": "chest", "x": 25, "y": -4, "chestItem": "iron_shield", "chestFlag": "CHEST_ERDRICK_TOMB", "dialog": ["You found an Iron Shield!"]},
    {"id": "bridge_worker_w", "sprite": "farmer", "x": 0, "y": -14, "showIf": "INTRO_COMPLETE", "dialog": [{"condition": "BRIDGE_BUILT", "text": ["Every stone in that span came off the old quarry road. It'll outlast the lot of us.", "North of the strait the land climbs. Keep to the open ground and you'll see the coast soon enough."]}, {"condition": "item:lute", "text": ["The King's own warriors! Then the span's waiting on nobody. Stand back a moment."]}, {"text": ["Nearly there. But the princess sent word from the castle: she has a gift for you before you cross.", "Go and see her, and the span will be ready when you're back."]}], "requiredItem": "lute", "cutscene": {"id": "a1_bridge_finished", "requiredFlag": "INTRO_COMPLETE", "onceFlag": "BRIDGE_BUILT"}},
    {"id": "bridge_worker_e", "sprite": "villager", "x": 3, "y": -14, "showIf": "INTRO_COMPLETE", "dialog": [{"condition": "BRIDGE_BUILT", "text": ["We worked by lantern three nights running. The King wanted you on your way.", "They say a harbour town lies east of the mainland's hills, under a lighthouse."]}, {"text": ["The King's orders: the north bridge before the harvest. Mind the scaffolding!"]}]},
]
VEHICLES = [
    {"type": "ship", "x": 40, "y": -9, "requiredFlag": "BIKKE_DEFEATED"},
]
SPOTS = {"a1_s_cornelia": {"at": (0, 0), "kind": "land"}, "a1_s_temple": {"at": (-13, -8), "kind": "land"}, "a1_s_temple_road": {"at": (-13, -5), "kind": "land"}, "a1_s_bridge": {"at": (1, -13), "kind": "land"}, "a1_s_bridge_foot": {"at": (1, -14), "kind": "land"}, "a1_s_north_shore": {"at": (1, -19), "kind": "land"}, "a1_s_east": {"at": (20, -1), "kind": "land"}, "a1_s_matoya": {"at": (-18, -35), "kind": "land"}, "a1_s_pravoka": {"at": (39, -10), "kind": "land"}, "a1_s_pravoka_ship": {"at": (40, -9), "kind": "dock"}, "a1_s_airship": {"at": (1, 0), "kind": "landing"}, "a1_s_airship_se": {"at": (2, 1), "kind": "landing"}, "a1_s_temple_airship": {"at": (-10, -7), "kind": "landing"}}
BRIDGE_PATCH = [(1, -17), (2, -17), (1, -16), (2, -16), (1, -15), (2, -15)]
BRIDGE_GATE = (1, -15)
BRIDGE_FOOT = (1, -14)
NORTH_SHORE = (1, -19)
JETTY = [(0, 7), (0, 8), (0, 9)]
ALDI_SEED = (0, 10)
PRAVOKA_DOCK = (40, -9)
PRAVOKA_QUAY = [(39, -9), (39, -8)]      # PT-4: the plank quay beside the dock (TEMPLATE `=`)
CITY_ICON = [(-2, -4), (-2, -3), (-2, -2), (-2, -1), (-1, -4), (-1, -3), (-1, -2), (-1, -1), (0, -4), (0, -3), (0, -2), (0, -1), (1, -4), (1, -3), (1, -2), (1, -1), (2, -4), (2, -3), (2, -2), (2, -1)]
PRAVOKA_ICON = [(38, -13), (38, -12), (38, -11), (39, -13), (39, -12), (39, -11), (40, -13), (40, -12), (40, -11)]
TEMPLE_ICON = [(-14, -10), (-14, -9), (-13, -10), (-13, -9), (-12, -10), (-12, -9)]
PONDS = [(-2, -4), (-1, -4), (-2, -3), (1, -4), (2, -4), (2, -5), (3, -5), (2, -1)]
FOOTBRIDGE = [(17, -2), (18, -2)]
CITY_FOOTBRIDGE = (-2, 1)
TOMB = (22, -4)
TOMB_END = (22, -3)
BOULDERS = [(-8, 0), (9, -6), (-17, 4)]
CHANNEL = (40, -19, 45, -1)
SOUND_LINE = [(-30, -16), (-22, -15.5), (-12, -16), (-4, -16.4), (1, -16.2), (6, -17.5), (11, -18.5), (13, -19)]
SPINE = [(14.8, -19.5), (17, -16), (20, -12.4), (23.5, -9.5), (27, -6.5), (29, -3.4), (31.2, -0.6)]
ROADS = [[(0, -4), (0, -5), (0, -10), (1, -10), (1, -14)], [(-5, -2), (-5, -5), (-2, -8), (3, -8), (6, -5), (6, 1), (3, 4), (0, 4)], [(-2, -2), (-3, -2), (-4, -2)], [(-6, -5), (-10, -5), (-12, -7), (-13, -7), (-13, -8)], [(2, -2), (3, -2), (5, -2)], [(7, -2), (16, -2), (19, -2), (20, -2), (22, -2), (22, -3)], [(0, -1), (0, 0), (0, 6)], [(0, 1), (-1, 1), (-2, 1)]]
KEEP_RECTS = {"bridge": (-4, -22, 7, -13), "pravoka": (32, -16, 44, -6), "jetty": (-1, 3, 2, 11)}
TODAY_WALKS = {"south gate -> bridge gate": 22, "Cornelia -> Temple door": 23, "bridge -> Pravoka gate": 59, "bridge -> Matoya's door": 39}
TEMPLATE = (
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                             ########        ##           ",
    "            ##  #######                     ##########    ######          ",
    "       ###.###############                 ######################         ",
    "       #.mmmm######################       #######################         ",
    "       #.mmmm#######################     ########################         ",
    "       ..m.mm.###################################################         ",
    "      ##.....#############################################################",
    "      ##f...f#############################################################",
    "##########f####################################################   ########",
    "##############################################################    ########",
    "##############################################################    ########",
    "##############################################################    ########",
    "##############################################################    ########",
    "##############################################################          ##",
    "#######  #####################################################          ##",
    "         ######################################################          #",
    "        ########################################################         #",
    "       #########################################################         #",
    "      ##########################################################         #",
    "      ##################fffff.......#############################         ",
    "      ##################............##    ########################        ",
    "    ######  ####        oo.........o       #######################        ",
    "    #####               ooo.....oooo       ######################         ",
    "     ####               ooooo==ooooo       #####################          ",
    "      ##                oooooooooooo############################          ",
    "                        oooooooooooo########################fmmmooooooooo ",
    "                       #.oooo==oooo.########################fmmmooooooooo ",
    "                      ##.oo..,...oof########################.....mmmooooo ",
    "             mmmms######.....,...fff########################mmmm.mmmooooo ",
    "            mmmmmmf#############################mm##########mmmm.mmmooooo ",
    "           ommmmmmmf###########################mmmm#########mmmm....ooooo ",
    "          #..mmmmm..##########################..≈≈mm########.mmm....ooooo ",
    "          #.....mm..##########################..≈≈≈mm#######..m....=ooooo ",
    "          #....,....######,,,,,###############..rrmmm#######.......=ooooo ",
    "         ##....,,...####.,,.,...,###...######..rrrmmmm######.......oooooo ",
    "         ###....,,.####.,,..,....,##...######..rrrmmmmm#####....ssooooooo ",
    "         ####....,#####,,...,.≈≈..##...#####..rrrmmmmmm###########        ",
    "        ##############.,..≈≈,≈≈...,########..rrrr.....m###########        ",
    "        ##############.,..≈..rr...,########..rr...,...m###########        ",
    "         #############.,,,,rrr,,,,,########,,==,,,,..ff###########        ",
    "         ##########.......rr,.≈...,########..rr.ffffff###########         ",
    "         ##########.......r.,.....,#######..rrrffffff############         ",
    "        ###########fff#...=,,....,########..rrrff########   #####       ##",
    "        ###############...r.,...,,########..rrff####        ####         #",
    "        ##...###########.rr.,..,,########..rrrff##         #####         #",
    "       ###...##########.rr..,,,##########..rrrff          ######         #",
    "       ###...########..rr...,..#########..rrr..#         #######         #",
    "        #############.rr..#.,oo    #####..rrr..#         #######         #",
    "        ############.rr.#  o=oo     ####..rr..##        ########        ##",
    "        ############.r.#   o=oo     ####..rr..##        #######         ##",
    "        ############.oo    o=oo          oo..##        #######          ##",
    "        ############       oooo           o.###        #######           #",
    "       #############       oooo            ###         #######           #",
    "      ##############                                   ######            #",
    "      ###############                                  ######            #",
    "      ################                                  ####             #",
    "       ###############                                   ##               ",
    "       ###############                                                    ",
    "        #############                                                     ",
    "         #####                                                           #",
    "                                                                         #",
    "                                                                        ##",
    "                                                                        ##",
    "                                                                        ##",
    "                                                                        ##",
    "                                                                         #",
    "                                                                         #",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
    "                                                                          ",
)

"""Constants of the act-1 overworld (layouts/overworld.py): the map size and seed, the fixed points (city, gates,
bridges, temple, tomb), the cell fixes, and the polygon and polyline tables the shapes are drawn from."""
from __future__ import annotations

DY = 16                              # rows of mainland added above the T3c map (OW-15: the mainland is the larger land)
W, H = 72, 56 + DY
SEED = 1987

# ───────────────────────────── fixed points ─────────────────────────────
CX, CY = 26, 43                      # the city icon's top-left cell: a 5x4 footprint (the 4x4 art shifted 24 px right)
# the gates: N at the wall's top edge in front of the keep (W10: no longer inside the keep's art), W / E the flank
# arches, S the main arch. Each gate road runs onto its warp cell. M11: the N warp lands at Cornelia's `castle`
# entrance, in front of the castle door (not the precinct's east gate)
N_WARP, W_WARP, E_WARP, S_WARP = (CX + 2, CY), (CX, CY + 2), (CX + 4, CY + 2), (CX + 2, CY + 3)
ARRIVE = {"cornelia": (CX + 2, CY + 4), "cornelia_west": (CX - 1, CY + 2), "cornelia_east": (CX + 5, CY + 2),
          "cornelia_north": (CX + 2, CY - 1)}
BX = 29                              # the north bridge (columns BX, BX+1): south stub, a 2-cell gap of open water, north stub
S_STUB, N_STUB = 32, 29              # rows of the two stubs; the two rows between them stay open water
BRIDGE_FOOT, NORTH_SHORE = (BX, S_STUB + 1), (BX, N_STUB - 1)
TX, TY = 14, 37                      # the temple icon (2x2); its door is (TX+1, TY+1), the arrival one cell south
TEMPLE_DOOR = (TX + 1, TY + 2)
RX, RY = 45, 45                      # the east bridge: two cells (RX, RY), (RX+1, RY) over the 2-wide east river
TOMB = (50, 43)                      # the sarcophagus' left cell (altar_l); altar_r is east of it
TOMB_END = (TOMB[0], TOMB[1] + 1)    # the E road ends in front of the sarcophagus
JETTY: list[tuple[int, int]] = []    # 3 bridge-deck cells straight out from the shore below the S road (set by build)
BOULDERS = [(20, 47), (37, 41), (11, 51)]     # on open grass, never on a road
# OW-5: cell-mask fixes where the noise left a long straight edge or a regular staircase (the organic painter rounds
# a cell edge but cannot hide one that runs straight for 8 cells): a headland and a cove on the sound's south shore,
# a bulge in the steps up to the fjord head, and a ragged top edge for the south-west forest
SHORE_LAND = [(22, 33), (23, 33), (24, 33), (23, 32), (24, 32), (36, 31), (36, 30), (37, 30), (58, 47), (59, 47)]
SHORE_SEA = [(33, 33), (34, 33)]
FOREST_ADD = [(13, 56), (14, 56), (15, 56), (14, 55), (15, 55)]
FOREST_CUT = [(17, 57), (18, 57)]

# moat ponds in the icon's transparent corner cells, so every gate is a doorway (one walkable neighbour); the stream
# (river cells) enters at the north-east corner, runs under the town and leaves at the south-west corner
PONDS = [(CX, CY), (CX + 1, CY), (CX, CY + 1),                                                  # north-west
         (CX + 3, CY), (CX + 4, CY), (CX + 4, CY - 1), (CX + 5, CY - 1),                           # the spring (NE)
         (CX + 4, CY + 3)]                                                                         # south-east
UNDER_TOWN = [(CX + 4, CY + 1), (CX + 3, CY + 1), (CX + 3, CY + 2), (CX + 2, CY + 2), (CX + 1, CY + 2), (CX + 1, CY + 3),
              (CX, CY + 3)]
# W6: the stream runs straight south for rows CY+4..CY+6 (one river cell), crossed by a footbridge west of the S gate
STREAM = [(CX, CY + 3), (CX, CY + 7), (CX - 2, CY + 9), (CX - 4, CY + 10), (CX - 5, CY + 12)]
FOOTBRIDGE, FOOT_ROAD = (CX, CY + 5), (CX + 1, CY + 5)     # the bridge cell, and the road cell joining the S road

# the whole landmass (mainland and peninsula), then the waters cut out of it
LAND = [(7, 8.5), (10, 6.6), (15, 7.4), (19, 6.2), (24, 7.2), (29, 6.4), (32.5, 7.8), (35.5, 10.2), (39.5, 10.8),  # north
        (42.5, 8.4), (46, 6.6), (51, 7.4), (56, 6.2), (60.5, 7.6),                                # coast, with a bay
        (63.5, 9.5), (64.8, 12.5), (62, 15.5), (64.6, 23),                                    # the mainland's east coast
        (64.5, 27), (62.5, 31), (64.8, 35), (64, 40), (65.5, 45), (65.8, 51), (64.5, 57), (62, 62),
        (58.5, 64), (55, 62.5), (50, 60), (45, 58.5), (40, 62), (34, 61.5), (28, 60.5), (22, 62.5), (17, 65), (12, 65.6),
        (8.5, 63.5), (7.5, 60), (9, 56.5), (7, 52.5), (8.2, 48), (7, 43.5), (8.5, 39), (-2, 38), (-2, 28), (6.8, 27.5),
        (6, 24.5), (9.5, 21.5), (6.6, 14.5), (6.2, 11.5)]                                      # and its west coast
SOUND = [(-3, 27), (6, 27.4), (12, 27.8), (18, 28.2), (24, 28.6), (28, 28.7), (31, 28.6), (33.5, 28.2), (36, 27.2),
         (39, 26.6), (41.5, 26.8), (42.6, 27.8), (42, 28.9), (39.5, 29.4), (37, 30.3), (34.5, 31.6), (32, 32.6), (28, 32.7),
         (25, 33.4), (21, 34.2), (17, 35), (12, 36.2), (7, 37.4), (-3, 39)]
GULF = [(50, 76), (48, 60), (48, 56), (49.8, 52.4), (53.4, 49.2), (57.2, 47.2), (59, 46.4), (59.6, 48.5), (58, 51.5),
        (56.5, 55), (55.5, 59), (56, 76)]   # the eastern sea: a gulf between the pocket and the east arm
SOUTH_BAY = [(19, 57.5), (21.5, 55.2), (25, 54), (29, 53.6), (33, 54), (37, 54.6), (40, 55.2), (42.5, 56.5), (43, 63),
             (21, 65)]
SPINE = [(42.8, 27.5), (45, 31), (48, 34.6), (51.5, 37.5), (55, 40.5), (57, 43.6), (59.2, 46.4)]
SPUR = [(50.5, 37.2), (51.5, 36)]     # the tarn sits in a notch of the range: rock on its north-east side
TARN = [(48, 37), (49, 37), (48, 38), (49, 38), (50, 38)]
NORTH_LAKE = [(20, 17), (21, 17), (22, 17), (20, 18), (21, 18), (22, 18), (21, 19)]   # a mere on the mainland
RIVER = [(48, 39), (47, 41), (46, 43), (RX, RY - 1), (RX, RY + 1), (44, 49), (43, 51), (42, 53)]   # 2 wide (x, x+1)

RING = [(CX - 3, CY + 2), (CX - 3, CY - 1), (CX, CY - 4), (CX + 5, CY - 4), (CX + 8, CY - 1), (CX + 8, CY + 5),
        (CX + 5, CY + 8), (CX + 2, CY + 8)]                # round the city from the W gate to the S road (not across the stream)
ROADS = [
    [N_WARP, ARRIVE["cornelia_north"], (CX + 2, 37), (BX, 37), BRIDGE_FOOT],         # N: to the north bridge
    RING,
    [W_WARP, ARRIVE["cornelia_west"], (CX - 2, CY + 2)],                             # W gate: onto the ring
    [(CX - 4, CY - 1), (18, CY - 1), (16, 40), (TX + 1, 40), TEMPLE_DOOR],          # the temple road (W)
    [E_WARP, ARRIVE["cornelia_east"], (CX + 7, CY + 2)],                             # E gate: onto the ring
    [(CX + 9, CY + 2), (RX - 1, RY)],                                                # E: to the east bridge
    [(RX + 2, RY), (TOMB[0] - 2, RY), (TOMB[0] - 2, TOMB_END[1] + 1), (TOMB[0], TOMB_END[1] + 1), TOMB_END],  # tomb
]

# build()'s shape tables. Mountain blobs: (cx, cy, rx, ry, noise weight, threshold); with the spine they make the hills
# behind the temple, a south-west ridge, two mainland ranges and the deep north (the rows added for OW-15: a range
# across the north-west, a ridge north-east, a spur by the coast)
MOUNTAIN_BLOBS = [(13.5, 35.2, 4.6, 2.0, 0.5, 0.15), (17.2, 36.6, 1.4, 1.6, 0, 0), (8.5, 55.5, 2.2, 4.2, 0.6, 0.1),
                  (16, 22.8, 5.5, 1.8, 0.5, 0.1), (54, 26.5, 6.5, 2.4, 0.5, 0.1), (62.5, 35, 2.6, 4.5, 0.5, 0.1),
                  (61.5, 59, 1.6, 2.6, 0.4, 0.05), (20, 9.5, 6.5, 2.0, 0.5, 0.1), (47, 8.5, 5.5, 1.8, 0.5, 0.1),
                  (58.5, 13.5, 2.2, 3.4, 0.5, 0.1), (45, 19, 2.6, 1.3, 0.4, 0.1)]
# forest zones and sand beaches: ellipses (cx, cy, rx, ry) that noise thins out
FOREST_ZONES = [(9, 45, 5.5, 5.0), (15, 60, 6.5, 3.6), (35.5, 35.5, 4.0, 2.2), (51.5, 50, 6.5, 6.0), (21, 49.5, 3.0, 2.2),
                (32.5, 57.5, 3.0, 1.6), (26, 23.5, 7, 2.6), (44, 24, 5, 2.6), (58, 31, 4, 3), (63, 25, 3.2, 2.6),
                (50, 42.5, 2.0, 1.4), (21, 35.6, 3.2, 1.6), (35, 53.5, 2.6, 1.4), (14, 47, 2.2, 1.8), (38.5, 49.5, 2.4, 1.8),
                (16.5, 54, 2.4, 1.8), (61, 53.5, 1.8, 3.4), (39.5, 37, 2.2, 1.4), (33, 10, 7, 3), (10, 14, 3, 3),
                (52, 14, 4, 2.5), (40, 15.5, 4, 1.8), (31, 18.5, 5, 1.6), (55, 19, 3.5, 1.5), (12, 19.5, 2.4, 1.4)]
BEACHES = [(7.5, 51, 2.5, 6), (19, 34.5, 3.5, 1.5), (12, 65, 7, 3), (22, 59, 4, 3), (33, 55.5, 5, 2), (47, 55, 3, 2),
           (56, 50, 4, 3), (6, 29, 3, 4), (64, 44, 3, 3), (30, 4.5, 6, 1.5), (61, 7, 3, 2)]
# grass in front of the temple; rock behind it and east of its door (so the door is a doorway); rock behind the tomb's
# sarcophagus and behind its columns' broken tops
TEMPLE_GRASS = [(TX - 1, TY + 2), (TX, TY + 2), (TX + 1, TY + 2), (TX + 2, TY + 2), (TX - 1, TY + 1)]
TEMPLE_ROCK = [(TX, TY), (TX + 1, TY), (TX + 2, TY), (TX + 2, TY + 1), (TX + 3, TY + 1), (TX + 3, TY), (TX - 1, TY)]
TOMB_ROCK = [(TOMB[0] - 1, TOMB[1] - 1), (TOMB[0], TOMB[1] - 1), (TOMB[0] + 1, TOMB[1] - 1), (TOMB[0] + 2, TOMB[1] - 1),
             (TOMB[0], TOMB[1] - 2), (TOMB[0] + 1, TOMB[1] - 2), (TOMB[0], TOMB[1] - 3)]

# Erdrick's tomb: a stone sarcophagus between two broken columns (both cells block: the rock behind them is the range's
# foot, so there is no walkable pocket behind the tomb), flowers in front. (W11: the free-standing vines are gone; the
# nook east of the columns holds the tomb chest, TOMB_CHEST)
TOMB_OBJECTS = [
    {"type": "deco", "parts": [["altar_l", "altar_r"]], "x": TOMB[0], "y": TOMB[1], "style": "stone"},
    {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": TOMB[0] - 1, "y": TOMB[1] - 1},
    {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": TOMB[0] + 2, "y": TOMB[1] - 1},
    {"type": "flowers", "x": TOMB[0] - 1, "y": TOMB[1] + 1},
    {"type": "flowers", "x": TOMB[0] + 2, "y": TOMB[1] + 1},
]

# W12: the east pocket's reward (the Iron Shield isn't sold in Cornelia)
TOMB_CHEST = {"id": "chest_tomb", "sprite": "chest", "x": TOMB[0] + 3, "y": TOMB[1], "chestItem": "iron_shield",
              "chestFlag": "CHEST_ERDRICK_TOMB", "dialog": ["You found an Iron Shield!"]}
# W9: the pier's end, where the ship would wait (it needs BIKKE_DEFEATED, not in act 1)
PIER_TEXT = ["The pier runs out into the bay. No ship calls at Cornelia while pirates rule the seas."]
# T1: the north bridge's gate message, once the King has ordered the repair (INTRO_COMPLETE) and before
GATE_MESSAGE = [{"condition": "INTRO_COMPLETE", "text": ["The King's builders are at work on the bridge, but it isn't finished yet."]},
                {"text": ["The bridge has collapsed into the sea. Only the King's builders could repair it."]}]

# OW-9: the snapped ends, pilings and loose planks of the north bridge (overworld/kit_grand `bridge_gap`), drawn over
# the two open-water gap rows. Art only: the cells stay ocean in collision and BRIDGE_BUILT stays unset in act 1.
# FIX_PLAN T6 note: the future bridge cutscene needs a built variant of the span (the gap cells become bridge in
# collision and art, e.g. a flag-gated map variant), and that variant must drop BROKEN_BRIDGE.
BROKEN_BRIDGE = [{"type": "deco", "parts": [["bridge_gap_0_0", "bridge_gap_0_1"], ["bridge_gap_1_0", "bridge_gap_1_1"]],
                  "name": "broken_bridge", "x": BX, "y": N_STUB + 1, "block": False, "on_water": True,
                  "style": "pale_stone"}]        # W8: recoloured to the stubs' pale stone (build_map.RECOLOR)

HEADER = """GENERATED by assets-src/tools/layouts/overworld.py - edit the script, not this file.
Act-1 overworld (original layout): the Cornelia peninsula hangs south-west from the mainland; the sound, the broken
north bridge at its strait, the spine range sealing the isthmus, the east river from its tarn, Erdrick's tomb.
Compiled by assets-src/tools/build_map.py.
ground legend: . grass  f forest  m mountain  s sand  , dirt road  r river  o ocean  = bridge  ≈ lake"""

"""A1's places on the world map (docs/WORLD_PLAN.md 4.1; A1-O), in world cells: Matoya's cave mouth, Pravoka's icon,
gate, quay and brig (read from A1-T's `town_pravoka_site.py`), the lighthouse on the range's foot, the cairn on the
saddle pass, and the `north_bridge` patch (flag BRIDGE_BUILT) that lays the span over the two gap rows.

GT-2 (6.3): the patch also covers the bridge gate cells, the south stub's deck (93, 96) and (94, 96), so forcing it on
removes the gates as well as filling the gap.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent.parent))
import town_pravoka_site as PRAVOKA  # noqa: E402
from kit import landmark_parts  # noqa: E402
from world_a1_ground import CAIRN, MATOYA_ARRIVAL, MATOYA_DOOR  # noqa: E402

# the north bridge (act-1 BX = 29, N_STUB = 29, S_STUB = 32, at the A1 origin): the gap rows y 94-95 and the gates
BRIDGE_X = (93, 94)
GAP_ROWS = (94, 95)
GATE_ROW = 96
NORTH_BRIDGE = {"id": "north_bridge", "flag": "BRIDGE_BUILT", "ground": "=",
                "cells": [[x, y] for y in (*GAP_ROWS, GATE_ROW) for x in BRIDGE_X]}
LIGHTHOUSE = (138, 98)                         # the tower's top-left cell, on the range across the channel from the quay

CAIRN_TEXT = ["Travellers have stacked stones on this saddle, one for each safe crossing.",
              "Someone has scratched an arrow on the topmost stone. It points down the slope, east, to the harbour."]


def objects() -> list[dict]:
    mx, my = MATOYA_DOOR
    # LM4-INT: the approved Bedrock town icon `town_pravoka` (3x3) over the whole ICON box (before, the walled-town
    # icon's drawn row under the headland rock); the door is the art's gate
    ix, iy = min(x for x, _ in PRAVOKA.ICON), min(y for _, y in PRAVOKA.ICON)
    door = [PRAVOKA.DOOR[0] - ix, PRAVOKA.DOOR[1] - iy]
    return [
        # Matoya's door: a crack in the hillock's south face, the art centred on the door cell
        {"type": "deco", "name": "matoya_cave", "parts": landmark_parts("cave_mouth"), "x": mx, "y": my - 1,
         "offset": [-24, 0], "walk_cells": [[0, 1]]},
        {"type": "deco", "name": "pravoka", "parts": landmark_parts("town_pravoka"),
         "x": ix, "y": iy, "walk_cells": [door], "collide": "alpha", "on_water": True},
        {"type": "deco", "name": "lighthouse", "parts": landmark_parts("lighthouse"), "x": LIGHTHOUSE[0],
         "y": LIGHTHOUSE[1], "collide": "alpha"},                 # LM4-INT: its own art (was the bright tower)
        {"type": "deco", "name": "cairn", "parts": [["boulder"]], "x": CAIRN[0], "y": CAIRN[1]},
    ]


def transitions() -> list[dict]:
    return [{"x": MATOYA_DOOR[0], "y": MATOYA_DOOR[1], "targetMap": "matoya-cave", "targetEntrance": "arrival"},
            {"x": PRAVOKA.DOOR[0], "y": PRAVOKA.DOOR[1], "targetMap": PRAVOKA.TOWN, "targetEntrance": "gate"}]


def entrances() -> dict[str, list[int]]:
    return {"a1_matoya": list(MATOYA_ARRIVAL), PRAVOKA.ANCHOR: list(PRAVOKA.GATE)}


def inspect() -> list[dict]:
    return [{"x": CAIRN[0], "y": CAIRN[1], "text": list(CAIRN_TEXT)}]


def docks() -> list[dict]:
    return [dict(PRAVOKA.DOCK)]


def ship() -> dict:
    """The brig at Pravoka's quay; it replaces the act-1 spawn off Cornelia's jetty (2.5: the ship spawn moves)."""
    return dict(PRAVOKA.SPAWN)

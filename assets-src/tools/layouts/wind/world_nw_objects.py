"""WIND's icons, dressing and inspect cells on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3; NW-R WIND), each placed
relative to its door exactly as pass W's `wind/world_sites.py` places it on today's world:

- Gaia: the approved icon `town_gaia` (3x2, LM4-INT), the door its bottom-left cell (`walk_cells [[0, 1]]`,
  `collide: alpha`); a tree clump on the door's west side and a rocky knoll under the hall's roof row behind it, so
  the door's one way in is from its arrival (OW-2);
- the Mirage Tower: `mirage_tower` (2x3), the door its bottom-right cell, a fallen block of its masonry east of the
  door; the door leads to `mirage-1f` `arrival` (WND-D1's chime door is inside);
- Lufenia: the approved icon `lufenia` (4x2), the door its walk cell [2, 1];
- two inspect boulders: the cairn in the neck between Gaia's arm and the Pinewold, the bronze dial in the sands.

A boulder goes on the walkable cell nearest its target that keeps its part in one piece (no pass is closed).
"""
from __future__ import annotations

import numpy as np

from worldgen.geom import flood
from wind import world_sites as WS

DOOR = (0, -1)                               # every WIND door is one step north of its arrival (pass W)
CAIRN = (224, 51)                            # the cairn's target (world): the neck between the arm and the Pinewold
DIAL = (6, 2)                                # the dial's target: this far from the Mirage Tower's arrival
NOTES = [
    "NW-R WIND: the Mirage sands in a closed mountain ring (salt pan, stone spine, oasis meadow), the tower door on "
    "the sands' south side",
    "NW-R WIND: Gaia's arm (snow rim, grass bowl, crater tarn) and the Pinewold down the tail; the cairn in the neck",
    "NW-R WIND: Lufenia's mesa (moor, copses) at the tail's end, cut off from the Pinewold by cliffs; no dock",
]


def doors(ent: dict) -> dict:
    return {e: (x + DOOR[0], y + DOOR[1]) for e, (x, y) in ent.items()}


def ground(ent: dict) -> list:
    """The ground under the icons: (cells, legend char) pairs."""
    d = doors(ent)
    gx, gy = d["wnd_gaia"]
    mx, my = d["wnd_mirage"]
    lx, ly = d["wnd_lufenia"]
    return [([(gx + i, gy - j) for i in (0, 1) for j in (1, 2)], "m"),            # Gaia's knoll
            ([(gx + 2, gy - 1), (gx, gy), (gx + 1, gy), (gx + 2, gy), (gx - 1, gy), ent["wnd_gaia"]], "."),
            ([(mx + i, my - j) for i in (-1, 0) for j in (0, 1, 2)] + [(mx + 1, my), ent["wnd_mirage"]], "s"),
            ([(lx + i, ly - j) for i in range(-2, 2) for j in (0, 1)] + [ent["wnd_lufenia"]], ".")]


def icons(ent: dict) -> list[dict]:
    d = doors(ent)
    (gx, gy), (mx, my), (lx, ly) = d["wnd_gaia"], d["wnd_mirage"], d["wnd_lufenia"]
    return [
        {"type": "deco", "name": "gaia", "parts": WS.landmark_parts("town_gaia"), "x": gx, "y": gy - 1,
         "walk_cells": [[0, 1]], "collide": "alpha"},
        {"type": "deco", "name": "gaia_door_west", "parts": [["tree_clump"]], "x": gx - 1, "y": gy},
        {"type": "deco", "name": "mirage", "parts": WS.landmark_parts("mirage_tower"), "x": mx - 1, "y": my - 2,
         "walk_cells": [[1, 2]], "collide": "alpha"},
        {"type": "deco", "parts": [["boulder"]], "x": mx + 1, "y": my},
        {"type": "deco", "name": "lufenia", "parts": WS.landmark_parts("lufenia"), "x": lx - 2, "y": ly - 1,
         "walk_cells": [[2, 1]], "collide": "alpha"},
    ]


def covered(objs: list[dict]) -> set:
    return {(o["x"] + i, o["y"] + j) for o in objs for j, row in enumerate(o["parts"]) for i, _p in enumerate(row)}


def _boulder(part: np.ndarray, target, taken: set):
    """The cell of `part` nearest `target` (ties by (y, x)) that leaves the part in one piece and touches it."""
    n = int(part.sum())
    for y, x in sorted(map(tuple, np.argwhere(part)), key=lambda c: ((c[1] - target[0]) ** 2 + (c[0] - target[1]) ** 2,
                                                                      c[0], c[1])):
        if (x, y) in taken or any((x + i, y + j) in taken for i in (-1, 0, 1) for j in (-1, 0, 1)):
            continue
        rest = part.copy()
        rest[y, x] = False
        nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        start = next((c for c in nb if rest[c[1], c[0]]), None)
        if start is not None and sum(rest[c[1], c[0]] for c in nb) >= 2 and flood(rest, [start]).sum() == n - 1:
            return (int(x), int(y))
    raise SystemExit(f"wind: no cell for a boulder near {target}")


def objects(g: np.ndarray, ent: dict, parts: dict) -> tuple[list[dict], list[dict]]:
    """(objects, inspect cells)."""
    objs = icons(ent)
    taken = covered(objs) | set(ent.values())
    mx, my = ent["wnd_mirage"]
    cells = [_boulder(parts["wnd_highlands"], CAIRN, taken)]
    cells.append(_boulder(parts["wnd_mirage_sands"], (mx + DIAL[0], my + DIAL[1]), taken | set(cells)))
    insp = []
    for (x, y), (_x, _y, text) in zip(cells, WS.INSPECT):
        objs.append({"type": "deco", "parts": [["boulder"]], "x": x, "y": y})
        insp.append({"x": x, "y": y, "text": list(text)})
    return objs, insp

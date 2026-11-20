"""Act 1's template read from today's world source (docs/NATURAL_WORLD_PLAN.md 3.6, NW-0's `today.py`; NW-2).

Act 1 is regenerated round pins at today's cells relative to Cornelia (rel = p_today - (92, 111); world =
CORNELIA_NW + rel = p_today + A1_DELTA). Until NW-3 derives `a1/world_a1_pins.py` by script, the template is read
here from today's 192x192 source, `assets-src/maps/overworld.yaml` (read only; mainline still builds it): today's
act-1 outline, the cells whose chars are copied (the keep masks of the bridge, Pravoka's shore, the jetty, Cornelia,
the temple, Matoya, the tomb, the boulders, the city stream and the east river), the entrances, the transitions and
the act-1 objects. Every constant below is in today's cells.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import yaml

SRC = Path(__file__).resolve().parents[3] / "maps" / "overworld.yaml"      # assets-src/maps/overworld.yaml
CORNELIA_TODAY = (92, 111)

# act 1's template box: the act-1 block without Pravoka's range strip (regenerated as W_east)
TPL_X0, TPL_X1, TPL_Y0, TPL_Y1 = 64, 137, 64, 145
OBJ_X1 = 141                                 # act-1 objects: x 64-141, y 64-145
KEEP_RECTS = {
    "bridge": (88, 89, 99, 98),              # the strait, both stubs, the gate cells and the north shore
    "pravoka": (124, 95, 136, 105),          # shelf, headland, pass, cairn, icon, quay, channel rows
    "jetty": (91, 114, 94, 121),             # the jetty and the Aldi seed below it
}
KEEP_DISCS = {
    "cornelia": ((92, 109), 6.5), "temple": ((79, 102), 4.5), "matoya": ((74, 75), 2.5), "tomb": ((114, 107), 4.5),
    "boulder1": ((84, 111), 1.5), "boulder2": ((101, 105), 1.5), "boulder3": ((75, 115), 1.5),
}
STREAM = [(90, 110), (90, 114), (88, 116), (86, 117), (85, 119)]
EAST_RIVER_BOX = (100, 99, 118, 122)         # the east river and its tarn (r / lake cells), with a 2-cell buffer

ENTRANCES = ["cornelia", "cornelia_west", "cornelia_east", "cornelia_north", "castle", "north_shore", "temple",
             "a1_matoya", "a1_pravoka"]
BRIDGE_PATCH = [(93, 94), (94, 94), (93, 95), (94, 95), (93, 96), (94, 96)]
BRIDGE_GATE = (93, 96)
BRIDGE_FOOT = (93, 97)
JETTY = [(92, 118), (92, 119), (92, 120)]
ALDI_SEED = (92, 121)
PRAVOKA_DOCK = (132, 102)
PRAVOKA_ICON = [(x, y) for x in range(130, 133) for y in range(98, 101)]
CITY_ICON = [(x, y) for x in range(90, 95) for y in range(107, 111)]
TEMPLE_ICON = [(x, y) for x in range(78, 81) for y in range(101, 103)]
FOOTBRIDGE = [(109, 109), (110, 109)]
TOMB_END = (114, 108)
BOULDERS = [(84, 111), (101, 105), (75, 115)]
CHANNEL = (132, 92, 137, 110)                # x 132-137 stay Water on rows 92-110 (>= 6 cells)
SOUND_LINE = [(62, 95), (70, 95.5), (80, 95), (88, 94.6), (93, 94.8), (98, 93.5), (103, 92.5), (105, 92)]
SPINE = [(106.8, 91.5), (109, 95), (112, 98.6), (115.5, 101.5), (119, 104.5), (121, 107.6), (123.2, 110.4)]
# act 1's routed roads (2.4 rule 8): the south gate -> the bridge foot; -> the temple; -> the footbridge -> TOMB_END
ROADS = [[(92, 111), (93, 97)], [(92, 111), (79, 103)], [(92, 111), (108, 109), (111, 109), TOMB_END]]
ROAD_KEEP = ((92, 109), 6.5)                 # today's roads kept only round Cornelia's gates


@lru_cache(maxsize=1)
def doc() -> dict:
    return yaml.safe_load(SRC.read_text())


def chars() -> np.ndarray:
    """Today's ground as a 192x192 char array."""
    return np.array([list(r) for r in doc()["ground"].rstrip("\n").split("\n")])


def entrances() -> dict:
    return doc()["entrances"]


def transitions() -> list[dict]:
    return doc()["transitions"]


def gates() -> list[dict]:
    return doc().get("keyItemGates") or []


def objects() -> list[dict]:
    """Today's objects inside the act-1 box (today's cells; the caller translates them)."""
    return [o for o in doc().get("objects") or []
            if TPL_X0 <= o.get("x", -1) <= OBJ_X1 and TPL_Y0 <= o.get("y", -1) <= TPL_Y1]


def inspect() -> list[dict]:
    return [i for i in doc().get("inspect") or [] if TPL_X0 <= i["x"] <= OBJ_X1 and TPL_Y0 <= i["y"] <= TPL_Y1]


def spots() -> dict:
    return doc().get("spots") or {}


def template_land(ch: np.ndarray) -> np.ndarray:
    """Today's act-1 land inside the template box."""
    land = np.zeros(ch.shape, bool)
    land[TPL_Y0:TPL_Y1 + 1, TPL_X0:TPL_X1 + 1] = ch[TPL_Y0:TPL_Y1 + 1, TPL_X0:TPL_X1 + 1] != "o"
    return land


def keep_mask(ch: np.ndarray) -> np.ndarray:
    """The cells whose chars are copied (today's cells)."""
    h, w = ch.shape
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in KEEP_RECTS.values():
        m[y0:y1 + 1, x0:x1 + 1] = True
    for (cx, cy), r in KEEP_DISCS.values():
        m |= np.hypot(xx - cx, yy - cy) <= r
    for (x0, y0), (x1, y1) in zip(STREAM, STREAM[1:]):
        for t in np.linspace(0, 1, 20):
            m |= np.hypot(xx - (x0 + (x1 - x0) * t), yy - (y0 + (y1 - y0) * t)) <= 1.5
    x0, y0, x1, y1 = EAST_RIVER_BOX
    river = np.zeros((h, w), bool)
    river[y0:y1 + 1, x0:x1 + 1] = np.isin(ch[y0:y1 + 1, x0:x1 + 1], ["r", "≈", "="])
    buf = river.copy()
    for _ in range(2):
        buf = buf | np.roll(buf, 1, 0) | np.roll(buf, -1, 0) | np.roll(buf, 1, 1) | np.roll(buf, -1, 1)
    return m | buf


def place(arr: np.ndarray, fill, delta: tuple[int, int], n: int) -> np.ndarray:
    """A today-cell array placed into the n x n world grid by the act-1 delta."""
    out = np.full((n, n), fill, dtype=arr.dtype)
    ox, oy = delta
    h, w = arr.shape
    ys, xs = slice(max(0, oy), min(n, oy + h)), slice(max(0, ox), min(n, ox + w))
    out[ys, xs] = arr[ys.start - oy:ys.stop - oy, xs.start - ox:xs.stop - ox]
    return out


def door_of() -> dict[str, tuple[tuple[int, int], dict]]:
    """Each entrance's door: the transition within 1 step (the nearest), as (offset, transition) in today's cells."""
    ents = entrances()
    best: dict[str, tuple[int, tuple[int, int], dict]] = {}
    for t in transitions():
        for name, (x, y) in ents.items():
            d = abs(t["x"] - x) + abs(t["y"] - y)
            if d <= 1 and (name not in best or d < best[name][0]):
                best[name] = (d, (t["x"] - x, t["y"] - y), t)
    return {k: (v[1], v[2]) for k, v in best.items()}

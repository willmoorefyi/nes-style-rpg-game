"""Region WATER's content on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.5, 7 NW-R; WAT-O's places ported):
Onrac's icon and its scattered dressing, the falls over the waterfall cave, the caravan's tent on its outcrop with
the crate and the oasis post, the cairn at the meadow's canoe launch, the two inspect cells, and the
basalt sea-stacks across the mouth of Onrac's bay. Called by `world_specs/water.py`'s `content` on the composed
ground (`world_content.merge`); the zones are `world_water_nw_zones.py`.

Every place hangs off its entrance's cell on the NW world (the anchors' targets, `world_specs/common.sites`), at the
offsets today's world (`world_water_sites.py`, `world_water_land.py`) uses, so the content follows the spec:

- Onrac (`wat_onrac`, its 2.2 target): the approved 5x3 `town_onrac` icon over the 5x3 box above the gate, its door
  the bottom-middle cell (NW2-W: the airship's landing is the hike's south-coast meadow, `HIKES` below);
- the waterfall (`wat_waterfall`): NW-4's canoe-only ledge (`stamps.ledges`: door and arrival sand in a rock ring,
  a river cell to R-waterfall; its grass bank is now in the hike's ring) is kept; the 2x3 falls icon stands on it, its
  bottom-left cell the cave door, its top row stamped to rock;
- the caravan (`wat_caravan`): the 2x2 tent above the arrival, its top row on a rock outcrop, the crate west of the
  door (so the door has one way out) and the oasis signpost (today's dirt track is left out: on the NW world
  every road tip must be a door or a listed end, `road_check.no_stubs` and act 1's `stubs` check);
- the cairn: on the first grass bank of R-waterfall at least CAIRN_FROM rows below the ledge (where the gorge opens
  into Onrac's meadow, the canoe launch); the sea-stacks: 2x2 rock in open WATER sea, each with a ring of water.

Ground stamps touch only WATER's own cells (asserted).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
for p in (HERE, HERE.parent, HERE.parents[1]):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
import world_water_sites as WS  # noqa: E402  (today's texts and dressing seed)
from kit import landmark_parts  # noqa: E402
from world_dress import door_sides, ring_of, scatter  # noqa: E402

Cell = tuple[int, int]
REGION = "water"
CLEAR_OFF = (-2, 0)              # kept clear of Onrac's dressing (NW's landing beside the gate, before the hikes)
# NW2-W (docs/NW2_EDITS_PLAN.md 7; K 25, U 50): the hikes' landings, rel their sites (spot, site, offset). Onrac and
# the caravan share the south-coast meadow (Q14), the waterfall's lies on the east downs (foot+canoe); re-measured on
# NW2-T's ground: d 34 / 35 / 35 steps, floor 30 (the `hikes` line is the authority)
HIKES = (("wat_s_onrac_airship", "wat_onrac", (-14, 16)), ("wat_s_caravan_airship", "wat_caravan", (7, 28)),
         ("wat_s_waterfall_airship", "wat_waterfall", (15, 20)))
OUTCROP = [(x, y) for y in (-3, -2) for x in range(-1, 3)]   # rock under the tent's top row, rel the arrival
CRATE_OFF = (-1, -1)             # west of the tent's door
POST_OFF = (5, 0)                # the oasis signpost, rel the arrival
CAIRN_FROM = 6                   # the cairn: first grass bank of R-waterfall this many rows below the ledge
STACKS = [(-1, 23), (3, 20), (7, 22), (11, 19)]       # sea-stacks (top-left), rel Onrac's gate: the bay's mouth


def _add(c: Cell, d: Cell) -> Cell:
    return (c[0] + d[0], c[1] + d[1])


class Places:
    """WATER's places on the composed ground: `g` the legend chars, `mine` WATER's owner cells."""

    def __init__(self, g: np.ndarray, meta: dict):
        self.g, self.meta = g, meta
        self.mine = meta["region"] == meta["regions"].index(REGION)
        e = meta["entrances"]
        self.gate, self.ledge, self.camp = (tuple(e[k]) for k in ("wat_onrac", "wat_waterfall", "wat_caravan"))
        gx, gy = self.gate
        self.icon = [(x, y) for y in range(gy - 3, gy) for x in range(gx - 2, gx + 3)]
        self.door = (gx, gy - 1)
        self.clear = _add(self.gate, CLEAR_OFF)
        lx, ly = self.ledge
        self.falls = (lx, ly - 3)            # the falls icon's top-left; its bottom-left cell is the cave door
        self.cave_door = (lx, ly - 1)
        cx, cy = self.camp
        self.tent, self.tent_door = (cx, cy - 2), (cx, cy - 1)
        self.crate, self.post = _add(self.camp, CRATE_OFF), _add(self.camp, POST_OFF)
        self.cairn = self._cairn()
        self.stacks = [_add(self.gate, d) for d in STACKS]

    def ch(self, c: Cell) -> str:
        return str(self.g[c[1], c[0]])

    def stamp(self, cells, char: str) -> None:
        for x, y in cells:
            assert self.mine[y, x], f"WATER stamps only its own cells: ({x}, {y})"
            self.g[y, x] = char

    def _cairn(self) -> Cell:
        route = self.meta["routes"]["R-waterfall"]
        on = set(route)
        for x, y in route:
            if y < self.ledge[1] + CAIRN_FROM:
                continue
            for c in ((x - 1, y), (x + 1, y)):
                if self.ch(c) == "." and c not in on and self.mine[c[1], c[0]]:
                    return c
        raise AssertionError("WATER: no grass bank on R-waterfall below the gorge for the cairn")

    def ground(self) -> None:
        """The stamps: rock under the falls' top rows and the tent's outcrop, the sea-stacks."""
        fx, fy = self.falls
        self.stamp([(fx + i, fy + j) for j in range(3) for i in range(2) if (fx + i, fy + j) != self.cave_door], "m")
        self.stamp([_add(self.camp, d) for d in OUTCROP], "m")
        self.stamp([self.tent_door, _add(self.tent_door, (1, 0)), self.crate, self.post], ".")
        for x, y in self.stacks:
            ring = [(x + i, y + j) for j in range(-1, 3) for i in range(-1, 3)]
            assert all(self.ch(c) == "o" and self.mine[c[1], c[0]] for c in ring), f"sea-stack ({x}, {y})"
            self.stamp([(x + i, y + j) for j in range(2) for i in range(2)], "m")
        for c in self.icon:
            assert self.ch(c) not in "omr≈", f"Onrac's icon stands on land: {c} is {self.ch(c)!r}"

    def objects(self) -> list[dict]:
        x0, y0 = self.icon[0]
        gx, gy = self.gate
        taken = set(self.icon) | {self.gate, (gx - 1, gy), (gx + 1, gy), (gx, gy + 1), self.clear}
        walk = lambda c: self.mine[c[1], c[0]] and self.ch(c) == "."       # noqa: E731
        return [
            {"type": "deco", "name": "onrac", "x": x0, "y": y0, "parts": landmark_parts("town_onrac"),
             "collide": "alpha", "walk_cells": [[self.door[0] - x0, self.door[1] - y0]]},
            *scatter(self.icon, taken, WS.DRESS_SEED, ring_of(self.icon), walk,
                     door_sides(self.door, self.icon, taken), self.gate),
            {"type": "deco", "name": "waterfall", "x": self.falls[0], "y": self.falls[1],
             "parts": landmark_parts("waterfall"), "walk_cells": [[0, 2]], "collide": "alpha"},
            {"type": "deco", "name": "caravan", "x": self.tent[0], "y": self.tent[1], "parts": landmark_parts("tent"),
             "walk_cells": [[0, 1]], "style": "dune", "collide": "alpha"},
            {"type": "deco", "parts": [["crate"]], "x": self.crate[0], "y": self.crate[1]},
            {"type": "deco", "parts": [["boulder"]], "x": self.cairn[0], "y": self.cairn[1], "collide": "alpha",
             "style": "bright"},
            {"type": "deco", "parts": [["signpost"]], "x": self.post[0], "y": self.post[1]},
        ]

    def inspect(self) -> list[dict]:
        return [{"x": self.cairn[0], "y": self.cairn[1], "text": list(WS.CAIRN_TEXT)},
                {"x": self.post[0], "y": self.post[1], "text": list(WS.POST_TEXT)}]

"""A1's ground edits on the translated act-1 block (docs/WORLD_PLAN.md 2.5, 2.6, 4.1; A1-O): the four exception rects
and the east strip. Every cell is a world cell; `Ground` is the A1 box's rows, indexed by world coordinates.

- X_west and X_east: ocean turns to mountain (nothing else changes), the Aldi's north-west wall and the north end of
  Pravoka's range;
- the east strip: Pravoka's range, a mountain wall on rows y 76-141 with a ragged crest (FX-D: its west foot wanders
  over x 136-139, its east face over x 140-141, `range_cells`), joined to X_east by x 136-137, y 76-82, with a few
  spurs into x 136-137 south of the channel rows (they keep the fjord ragged, never narrower than the sea lane);
- X_pravoka: Pravoka's shelf, grass pushed east to x 131 under the town icon and the quay (A1-T's site file), and the
  saddle pass over the coastal knot west of it (the cairn's pass);
- X_matoya: a hillock of rock in the north-west forest with a clearing in front of its south face (Matoya's door).

Pravoka's channel: x 132-137 stay Water on every row y 92-110 (`tests/quest/a1/pravokaChannel.test.ts`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from world_api import FROZEN_EXCEPTIONS, MOUNTAIN, WATER, GRASS, Cell, Rect  # noqa: E402
from world_coast import wobble  # noqa: E402

FOREST = "f"
X_WEST, X_EAST = FROZEN_EXCEPTIONS["X_west"].world, FROZEN_EXCEPTIONS["X_east"].world
X_PRAVOKA, X_MATOYA = FROZEN_EXCEPTIONS["X_pravoka"].world, FROZEN_EXCEPTIONS["X_matoya"].world
RANGE = Rect(138, 76, 141, 141)               # Pravoka's range rows (W_east's A1 part with X_east and the joint)
RANGE_SEED = 4101                              # its crest's wobble (range_cells)
JOINT = Rect(136, 76, 137, 82)                # joins X_east to the range
CHANNEL_ROWS = (92, 110)                       # x 132-137 stay Water on these rows (>= 6 cells, 4.1)
# spurs off the range's west foot, outside the channel rows: (x0, y0, x1, y1)
SPURS = [Rect(137, 83, 137, 88), Rect(137, 116, 137, 121), Rect(136, 118, 136, 120), Rect(137, 129, 137, 136),
         Rect(136, 131, 136, 134)]
# Pravoka's shelf (grass) and the saddle pass over the knot west of it (the cairn stands on its north rock)
SHELF = [Rect(128, 97, 131, 103), Rect(128, 104, 130, 104)]
SHELF_SAND = [(129, 105)]                      # the shelf's south foot runs into the beach (no 1-cell inlet)
# the rocky headland the town sits under: it fills the icon's top row (the approved town icon is drawn in its bottom
# row only), so Pravoka's door has one walkable neighbour, the gate
HEADLAND = Rect(129, 97, 131, 99)
PASS = Rect(125, 97, 127, 97)
# sea left open inside the o>m rects, so no 1-cell inlet forms against the frozen coast: the fjord head (X_east)
# and the sound's north-west corner (X_west)
KEEP_SEA = set(Rect(128, 78, 129, 82).cells()) | {(71, 84)}
CAIRN: Cell = (126, 96)                        # a rock cell on the pass's north side; inspected from (126, 97)
# Matoya's hillock: rock behind and beside her door, a clearing in front (the anchor a1_matoya, target (74, 76))
HILL = [(73, 73), (74, 73), (75, 73), (76, 73), (73, 74), (74, 74), (75, 74), (76, 74), (73, 75), (75, 75),
        (76, 75)]
MATOYA_DOOR: Cell = (74, 75)                   # the cave mouth's walkable cell (the transition)
MATOYA_ARRIVAL: Cell = (74, 76)                # the anchor: in front of the door
CLEARING = [(73, 76), (74, 76), (75, 76), (73, 77), (74, 77), (75, 77), (72, 76), (76, 76)]


def range_cells() -> set[Cell]:
    """FX-D (G-1): Pravoka's range with a ragged crest instead of a ruler-straight strip: per row its west foot wanders
    over x 136-139 (x 138-139 on the channel rows, which stay open sea) and its east face over x 140-141, so it is 2
    to 6 cells thick and never breached; no 1-row notch is left in either face (no 1-cell inlet)."""
    n = RANGE.y1 - RANGE.y0 + 1
    west = [138 + d for d in wobble(RANGE_SEED, n, 4.0, 2.2)]
    east = [141 - (d > 0) for d in wobble(RANGE_SEED + 1, n, 3.0, 1.3)]
    for i in range(n):
        y = RANGE.y0 + i
        west[i] = min(139, max(138 if lo_row(y) else 136, west[i]))
        west[i] = min([west[i]] + [x for r in SPURS + [JOINT] for x, yy in r.cells() if yy == y])   # spurs join it
    for side in (west, east):                       # a 1-row notch either way is smoothed out
        for i in range(1, n - 1):
            if side[i - 1] == side[i + 1] != side[i]:
                side[i] = side[i - 1]
    cells = {(x, RANGE.y0 + i) for i in range(n) for x in range(west[i], east[i] + 1)}
    cells |= set(JOINT.cells()) | {c for r in SPURS for c in r.cells()}
    for y in range(RANGE.y0 + 1, RANGE.y1):         # a sea cell between two rock rows (a 1-cell inlet) is filled
        for x in range(136, 142):
            if (x, y - 1) in cells and (x, y + 1) in cells and not (x <= 137 and lo_row(y)):
                cells.add((x, y))
    return cells


def lo_row(y: int) -> bool:
    """A row of Pravoka's channel (and the one either side): x 132-137 stay open sea there."""
    return CHANNEL_ROWS[0] - 1 <= y <= CHANNEL_ROWS[1] + 1


class Ground:
    """The A1 box's ground rows (lists of legend chars), read and written by world cell."""

    def __init__(self, rows: list[list[str]], x0: int, y0: int):
        self.rows, self.x0, self.y0 = rows, x0, y0

    def __getitem__(self, c: Cell) -> str:
        return self.rows[c[1] - self.y0][c[0] - self.x0]

    def __setitem__(self, c: Cell, ch: str) -> None:
        self.rows[c[1] - self.y0][c[0] - self.x0] = ch


def _o_to_m(g: Ground, rect: Rect) -> set[Cell]:
    """Ocean to mountain in `rect` (X_west, X_east: the only change allowed there); returns the rect's mountains."""
    out = set()
    for c in rect.cells():
        if g[c] == WATER and c not in KEEP_SEA:
            g[c] = MOUNTAIN
        if g[c] == MOUNTAIN:
            out.add(c)
    return out


def apply(g: Ground, band: set[Cell]) -> dict[str, set[Cell]]:
    """Edit the ground in place; returns A1's parts of the Aldi walls (WALLS keys W_west, W_east)."""
    west = {c for c in _o_to_m(g, X_WEST) if c not in band}
    east = _o_to_m(g, X_EAST)
    ridge = range_cells()
    for c in sorted(ridge, key=lambda c: (c[1], c[0])):
        g[c] = MOUNTAIN
    east |= set(JOINT.cells()) | ridge
    for rect in SHELF:
        for c in rect.cells():
            g[c] = GRASS
    for c in SHELF_SAND:
        g[c] = "s"
    for c in HEADLAND.cells():
        g[c] = MOUNTAIN
    for c in PASS.cells():
        g[c] = GRASS
    for c in HILL:
        g[c] = MOUNTAIN
    for c in CLEARING + [MATOYA_DOOR]:
        g[c] = GRASS
    for x in range(70, 79):                    # the grove: a belt of woods south of the clearing
        for y in (78, 79):
            if g[(x, y)] == GRASS and 71 <= x <= 77:
                g[(x, y)] = FOREST
    for y in range(CHANNEL_ROWS[0], CHANNEL_ROWS[1] + 1):
        for x in range(132, 138):
            if g[(x, y)] != WATER:
                raise SystemExit(f"world_a1: Pravoka's channel cell ({x}, {y}) is {g[(x, y)]!r}, not Water")
    return {"W_west": west, "W_east": east}

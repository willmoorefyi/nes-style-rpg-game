"""The ground of region EARTH (docs/WORLD_PLAN.md 2.4-2.6, 2.8, 4.3; ERT-O): the Duergar isthmus and the western
continent, in world cells, drawn into a dict {(x, y): legend char} over the region's writable cells (its rects minus
the edge bands). `world_earth.py` turns it into the RegionOut ground rows.

Shapes (all original):
- the isthmus (x 49-61): a mountain hogback from the north shore (y 76) to the canal saddle (y 92-93, grass until
  CANAL_OPEN), then the dwarves' downs (y 94-109), whose ridge holds the hall's mouth, with the landing cove on the
  Aldi side (x 59-61, y 103-105), running down to `seam_n`;
- the western strait (x 42-48), open from the north sea to the south sea;
- the western continent (x 12-42, y 73-139), split from coast to coast by the western range (x 24-27 and its crags),
  pierced nowhere: the giant's tunnel is a map of its own. East of it lie Melmond's plain (forest copses, the crooked
  windmill's rise) and, south of y 118, the grey badlands (sand, rock tables, the Cavern of Earth's mesa); west of it
  Sarda's coast, a sealed sliver of downs and pinewood.
Wobble comes from a fixed integer hash of the cell, so the ground never depends on PYTHONHASHSEED.
"""
from __future__ import annotations

from world_api import BOXES, GRASS, MOUNTAIN, WATER, Cell

FOREST, SAND = "f", "s"

# key cells (world); the anchors are within +-2 of world-anchors.yaml (2.2)
CANAL_ROWS = (92, 93)                          # the saddle the canal cuts (2.6: "about y 88-92"; see the design note)
ISTHMUS_X = (49, 61)                           # the isthmus' land columns
COVE = [(x, y) for y in (103, 104, 105) for x in (59, 60, 61)]   # the dwarves' landing (Aldi water)
DWARF_DOCK = (59, 104)                         # the dock cell; the landing's land cell is (58, 104)
DOCK_POST = (58, 106)                          # the landing's mooring post (a 1x1 landmark on the shore)
HALL_MOUTH = (54, 102)                         # the hall's cave-mouth deco (2x2); its door is (55, 103)
HALL_DOOR, HALL_GATE = (55, 103), (55, 104)    # the transition cell, the `ert_dwarf` arrival
RANGE_X = (24, 27)                             # the western range's core columns (the barrier western_range)
GIANT_EAST_MOUTH, GIANT_EAST_DOOR, GIANT_EAST = (28, 110), (28, 111), (28, 112)
GIANT_WEST_MOUTH, GIANT_WEST_DOOR, GIANT_WEST = (22, 110), (23, 111), (23, 112)
SAGE_MOUTH, SAGE_DOOR, SAGE_GATE = (18, 107), (19, 108), (19, 109)
CAVE_MOUTH, CAVE_DOOR, CAVE_GATE = (30, 124), (30, 125), (30, 126)
WINDMILL = (35, 103)                           # 2x3 landmark on the rise north-west of Melmond
SHRINE = (35, 131)                             # 2x2 rotted shrine in the badlands; inspected from its south row
BADLANDS_Y = 118                               # the badlands begin at this row (east of the range)


def _h(x: int, y: int, salt: int = 0) -> int:
    """A small fixed hash (0-255) of a cell: the coast and crag wobble."""
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) & 0xFF


def writable(band: set[Cell]) -> set[Cell]:
    return {c for r in BOXES["earth"] for c in r.cells() if c not in band}


def _coast(y: int) -> tuple[int, int] | None:
    """The continent's land span (x0, x1) on row y, or None for sea."""
    if y < 73 or y > 139:
        return None
    taper = {73: (21, 30), 74: (17, 34), 75: (15, 37), 137: (15, 37), 138: (17, 34), 139: (21, 30)}
    if y in taper:
        return taper[y]
    k = y // 2                                   # wobble in 2-row steps: no 1-cell inlet
    west = 13 + (_h(0, k, 1) % 3 == 0) - (_h(0, k, 2) % 5 == 0)
    if 96 <= y <= 101:
        west += 2                                # a bight on Sarda's coast
    east = 40 + (_h(0, k, 3) % 3 == 0)
    if 108 <= y <= 115:
        east = 42                                # Melmond's shore: gate (42, 112), harbour (43, 113)
    elif y >= 128:
        east = 39 - (y - 128) // 4               # the badlands' coast falls away south-west
    return west, east


def _blob(g: dict, cells, ch: str) -> None:
    for c in cells:
        if c in g:
            g[c] = ch


def _wood(x0: int, y0: int, x1: int, y1: int) -> list[Cell]:
    """A copse: the ellipse in the rect, its rim nibbled by the cell hash (no straight forest edges)."""
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 0.6, (y1 - y0) / 2 + 0.6
    out = []
    for x, y in _rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1):
        d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if d <= 0.7 or (d <= 1.15 and _h(x, y, 6) % 3):
            out.append((x, y))
    return out


def _rect(x0: int, y0: int, x1: int, y1: int) -> list[Cell]:
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def ground(band: set[Cell]) -> dict[Cell, str]:
    g = {c: WATER for c in writable(band)}
    # the western continent
    for y in range(73, 140):
        span = _coast(y)
        for x in range(span[0], span[1] + 1):
            if (x, y) in g:
                g[(x, y)] = GRASS
    for y in (73, 74, 138, 139):                   # the range's sea-cliffs: both tips are wall from coast to coast
        span = _coast(y)
        _blob(g, [(x, y) for x in range(span[0], span[1] + 1) if 20 <= x <= 31], MOUNTAIN)
    # the western range: the core columns on every land row, crags spilling one cell either side
    for y in range(73, 140):
        for x in range(RANGE_X[0], RANGE_X[1] + 1):
            g[(x, y)] = MOUNTAIN
        if not 106 <= y <= 113:
            if _h(23, y, 4) % 3 == 0:
                g[(23, y)] = MOUNTAIN
            if _h(28, y, 5) % 3 == 0 and not 121 <= y <= 127:
                g[(28, y)] = MOUNTAIN
    # the giant's tunnel mouths: the deco cells are crag, the door cells walkable
    _blob(g, _rect(28, 110, 29, 111) + _rect(21, 110, 23, 111), MOUNTAIN)
    for c in (GIANT_EAST_DOOR, GIANT_WEST_DOOR, GIANT_EAST, GIANT_WEST, (29, 112), (22, 112)):
        g[c] = GRASS
    # Melmond's plain: copses, a hill knot, the windmill's rise (its cells stay grass under the landmark)
    _blob(g, _wood(31, 78, 36, 85), FOREST)
    _blob(g, _wood(36, 91, 39, 96), FOREST)
    _blob(g, _rect(31, 93, 33, 95) + [(34, 94)], MOUNTAIN)
    _blob(g, _wood(31, 114, 34, 117), FOREST)
    # the grey badlands: sand, the Cavern's mesa (its mouth deco on the south face), a second rock table
    for y in range(BADLANDS_Y, 140):
        for x in range(28, 43):
            if g.get((x, y)) == GRASS:
                g[(x, y)] = SAND
    _blob(g, _rect(28, 121, 33, 123) + _rect(28, 124, 29, 126) + _rect(30, 124, 31, 125), MOUNTAIN)
    _blob(g, _rect(36, 124, 38, 127) + [(39, 125)], MOUNTAIN)
    g[CAVE_DOOR], g[CAVE_GATE] = SAND, SAND
    # Sarda's coast: pinewoods and the sage's knoll (the cave mouth deco and its flanking crags)
    _blob(g, _wood(15, 83, 19, 91), FOREST)
    _blob(g, _wood(15, 121, 19, 128), FOREST)
    _blob(g, _rect(17, 105, 20, 108), MOUNTAIN)
    g[SAGE_DOOR], g[SAGE_GATE] = GRASS, GRASS
    # the isthmus: hogback, saddle, downs, the hall's ridge, the landing cove
    for y in range(76, 110):
        for x in range(ISTHMUS_X[0], ISTHMUS_X[1] + 1):
            g[(x, y)] = MOUNTAIN if y < CANAL_ROWS[0] else GRASS
    for y in (76, 77, 90, 91):                     # the hogback's ends taper on the strait side
        g[(49, y)] = WATER
    _blob(g, _rect(51, 99, 57, 103), MOUNTAIN)
    _blob(g, _rect(52, 96, 56, 98), MOUNTAIN)
    g[HALL_DOOR] = GRASS
    _blob(g, _wood(50, 105, 52, 108), FOREST)
    for c in COVE:
        g[c] = WATER
    return g

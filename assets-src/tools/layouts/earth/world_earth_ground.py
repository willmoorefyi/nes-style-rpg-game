"""The ground of region EARTH (docs/WORLD_PLAN.md 2.4-2.6, 2.8, 4.3; ERT-O): the Duergar isthmus and the western
continent, in world cells, drawn into a dict {(x, y): legend char} over the region's writable cells (its rects minus
the edge bands). `world_earth.py` turns it into the RegionOut ground rows.

Shapes (all original):
- the isthmus (x 49-61): a mountain hogback from the north shore (y 76) to the canal saddle (y 92-93, grass until
  CANAL_OPEN) between two stone quays (y 91 and 94, FX-D: the dug cut), then the dwarves' downs (y 95-109), whose
  ridge holds the hall's mouth, with the landing cove on the Aldi side (x 59-61, y 103-105), running down to `seam_n`;
- the western strait (x 43-48), open from the north sea to the south sea;
- the western continent (about x 6-42, y 66-141; FX-D: a hand-drawn outline bent by seeded noise, `OUTLINE` and
  world_coast.organic), split from coast to coast by the western range (x 24-27 and its crags), pierced nowhere: the
  giant's tunnel is a map of its own. East of it lie Melmond's plain (forest copses, the crooked windmill's rise) and,
  south of y 118, the grey badlands (sand, rock tables, the Cavern of Earth's mesa); west of it Sarda's coast, a
  sealed sliver of downs and pinewood.
The crag wobble comes from a fixed integer hash of the cell and the coast from numpy's seeded generator, so the
ground never depends on PYTHONHASHSEED.
"""
from __future__ import annotations

import numpy as np

from world_api import BOXES, GRASS, MOUNTAIN, WATER, WORLD_H, WORLD_W, Cell
from world_coast import organic, tidy

FOREST, SAND, COBBLE = "f", "s", ":"

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


# FX-D (G-1): the continent's outline, a hand-drawn polygon bent by seeded noise (world_coast.organic), instead of
# straight spans: bays on Sarda's coast, a hooked north cape under the range, Melmond's shore and the badlands' fall
# to the south-west. Clockwise from the north cape.
OUTLINE = [(24, 67.5), (29, 70), (34, 71.5), (38, 70.5), (41, 74), (39, 80), (37.5, 86), (39.5, 92), (40, 98),
           (39, 103), (43, 107), (43, 116.5), (40, 121), (40, 128), (37, 133), (34, 137.5), (29, 140), (25, 138),
           (20, 141), (15, 137.5), (11, 133), (9, 126), (12.5, 120), (10, 114), (12, 108), (15.5, 103), (17, 98),
           (13, 93), (10, 87), (12, 81), (14.5, 76), (19, 71)]
COAST_SEED, COAST_AMP = 4303, 16.0
# kept land: the sites and the walks between them (Sarda's sliver, the tunnel mouths, Melmond's shore, the Cavern's
# mesa, the shrine, the windmill's rise)
KEEP_LAND = [(17, 104, 23, 112), (28, 109, 31, 113), (38, 109, 42, 115), (28, 120, 39, 127), (34, 130, 37, 133),
             (34, 102, 37, 106)]
CONTINENT_X1 = 42                              # the strait (x 43-48) stays open water on every row


def continent(band: set[Cell]) -> np.ndarray:
    """The western continent's land mask (world grid)."""
    mine = np.zeros((WORLD_H, WORLD_W), bool)
    for x, y in writable(band):
        if x <= CONTINENT_X1:
            mine[y, x] = True
    keep = np.zeros_like(mine)
    for x0, y0, x1, y1 in KEEP_LAND:
        keep[y0:y1 + 1, x0:x1 + 1] = True
    return organic(OUTLINE, COAST_AMP, COAST_SEED, mine, keep_land=keep)


def _blob(g: dict, cells, ch: str, land_only: bool = False) -> None:
    for c in cells:
        if c in g and not (land_only and g[c] == WATER):
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
    # the western continent (FX-D: an organic outline, world_coast.organic)
    land = continent(band)
    for y, x in zip(*np.nonzero(land)):
        g[(int(x), int(y))] = GRASS
    cols = {x: [y for y in range(WORLD_H) if land[y, x]] for x in range(20, 32)}
    for x, ys in cols.items():                     # the range's sea-cliffs: both tips are wall from coast to coast
        _blob(g, [(x, y) for y in ys[:2] + ys[-2:]], MOUNTAIN)
    # the western range: the core columns on every land row, crags spilling one cell either side
    for y in range(WORLD_H):
        for x in range(RANGE_X[0], RANGE_X[1] + 1):
            _blob(g, [(x, y)], MOUNTAIN, land_only=True)
        if not 106 <= y <= 113:
            if _h(23, y, 4) % 3 == 0:
                _blob(g, [(23, y)], MOUNTAIN, land_only=True)
            if _h(28, y, 5) % 3 == 0 and not 121 <= y <= 127:
                _blob(g, [(28, y)], MOUNTAIN, land_only=True)
    # the giant's tunnel mouths: the deco cells are crag, the door cells walkable
    _blob(g, _rect(28, 110, 29, 111) + _rect(21, 110, 23, 111), MOUNTAIN)
    for c in (GIANT_EAST_DOOR, GIANT_WEST_DOOR, GIANT_EAST, GIANT_WEST, (29, 112), (22, 112)):
        g[c] = GRASS
    # Melmond's plain: copses, a hill knot, the windmill's rise (its cells stay grass under the landmark)
    _blob(g, _wood(31, 78, 36, 85), FOREST, land_only=True)
    _blob(g, _wood(36, 91, 39, 96), FOREST, land_only=True)
    _blob(g, _rect(31, 93, 33, 95) + [(34, 94)], MOUNTAIN)
    _blob(g, _wood(31, 114, 34, 117), FOREST, land_only=True)
    # the grey badlands: sand, the Cavern's mesa (its mouth deco on the south face), a second rock table
    for y in range(BADLANDS_Y, WORLD_H):
        for x in range(28, 43):
            if g.get((x, y)) == GRASS:
                g[(x, y)] = SAND
    _blob(g, _rect(28, 121, 33, 123) + _rect(28, 124, 29, 126) + _rect(30, 124, 31, 125), MOUNTAIN)
    _blob(g, _rect(36, 124, 38, 127) + [(39, 125)], MOUNTAIN)
    g[CAVE_DOOR], g[CAVE_GATE] = SAND, SAND
    # Sarda's coast: pinewoods and the sage's knoll (the cave mouth deco and its flanking crags)
    _blob(g, _wood(15, 83, 19, 91), FOREST, land_only=True)
    _blob(g, _wood(15, 121, 19, 128), FOREST, land_only=True)
    _blob(g, _rect(17, 105, 20, 108), MOUNTAIN)
    g[SAGE_DOOR], g[SAGE_GATE] = GRASS, GRASS
    # the isthmus: hogback, saddle, downs, the hall's ridge, the landing cove
    for y in range(76, 110):
        for x in range(ISTHMUS_X[0], ISTHMUS_X[1] + 1):
            g[(x, y)] = MOUNTAIN if y < CANAL_ROWS[0] else GRASS
    for y in (76, 77, 90, 91):                     # the hogback's ends taper on the strait side
        g[(49, y)] = WATER
    # FX-D (P1-1-10 / G-2): the canal is a dug cut, its stone quays along both sides (the north one cut into the
    # hogback's foot); the lock gates at its two mouths are the canal patch's own objects (world_earth_sites.canal)
    for x in range(ISTHMUS_X[0] + 1, ISTHMUS_X[1] + 1):
        g[(x, CANAL_ROWS[0] - 1)] = COBBLE
    for x in range(ISTHMUS_X[0], ISTHMUS_X[1] + 1):
        g[(x, CANAL_ROWS[1] + 1)] = COBBLE
    _blob(g, _rect(51, 99, 57, 103), MOUNTAIN)
    _blob(g, _rect(52, 96, 56, 98), MOUNTAIN)
    g[HALL_DOOR] = GRASS
    _blob(g, _wood(50, 105, 52, 108), FOREST)
    for c in COVE:
        g[c] = WATER
    tidy(g, GRASS)                                 # FX-D: no crumb of rock on the noisy coast (min_blob)
    _rock_strays(g)
    return g


def _rock_strays(g: dict[Cell, str]) -> None:
    """FX-D: a walkable pocket of the noisy coast that no site reaches on foot (behind the range's sea-cliffs)
    becomes rock, joined to the cliffs it hides behind."""
    walk = set(".,fs:")
    roots = [HALL_GATE, GIANT_EAST, GIANT_WEST, SAGE_GATE, CAVE_GATE, (42, 112)]   # (42, 112): Melmond's gate
    seen, todo = set(roots), list(roots)
    while todo:
        x, y = todo.pop()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and g.get(n) in walk:
                seen.add(n)
                todo.append(n)
    for c in sorted(g, key=lambda c: (c[1], c[0])):
        if g[c] in walk and c not in seen:
            g[c] = MOUNTAIN

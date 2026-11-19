"""The ground of region WATER (docs/WORLD_PLAN.md 4.6; WAT-O): Onrac's cold coastland in world cells (the box is
(0, 0, 63, 63), so world = box cells). Imported by `layouts/world_water.py`.

The land is one long coast from the frozen north highlands down to Onrac's bay. Polygons (hand-placed vertices) give
the coast, the ranges, the dune field and the heath; the coast's is bent by seeded noise (FX-D, world_coast.organic);
the region's set pieces are cut in afterwards:

- the **R-waterfall gorge**: the river (x 31-32) leaves a 2-cell ledge behind the falls at y 11 and runs south
  between two mountain walls (x 28-30 and x 33+) to y 27, then south-east across the meadow's edge to the sea at the
  bay's north-east corner. The ledge touches only mountains, the falls and the river, so the cave behind the falls
  is reached by canoe only (2.7). The ledge is sand: the airship lands on grass only, so it can't set down there;
- **the spill tarn**, a lake in the peaks above the falls (the river's head);
- **the dune field** on the west coast with its oasis meadow (the airship's landing for the caravan);
- **Onrac's bay** south of the town, with a ring of sea-stacks across its mouth;
- **the west heath**, a forested arm that closes the bay on the west.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Grid, polygon_mask  # noqa: E402
import numpy as np  # noqa: E402
from world_api import WORLD_H, WORLD_W  # noqa: E402
from world_coast import components, organic  # noqa: E402

W = H = 64
# 2.7: the 3-cell ledge behind the falls (its east cell is the anchor wat_waterfall, the 2.2 target (30, 11))
LEDGE = [(28, 11), (29, 11), (30, 11)]
FALLS = (30, 8)                    # top-left of the 2x3 falls icon; its bottom-left cell (30, 10) is the cave door
RIVER_X = (31, 32)                 # the gorge's two river columns
GORGE_END = 27                     # the last gorge row; below it the river turns south-east to the sea
RIVER_LOW = [(31, 27), (31, 29), (34, 31), (35, 34), (38, 35), (40, 38), (43, 40)]   # the lower course (2-wide)
TARN = [(29, 4), (34, 4), (35, 6), (31, 7), (28, 6)]
# the tent (2x2) and its door cell (bottom-left); the arrival below the door is the anchor wat_caravan
TENT = (8, 26)
CRATE = (7, 27)                    # caravan goods west of the door, so the door has one walkable neighbour
OUTCROP = (7, 25, 10, 26)          # the rock the tent is pitched against (its top row stands on it)
OASIS = [(11, 27), (14, 27), (15, 30), (12, 32), (10, 30)]
TRACK = [(8, 28), (8, 29), (9, 29), (10, 29), (11, 29)]      # the caravan's dirt track from the tent to the oasis
LAND_SEED = (24, 39)               # a meadow cell west of Onrac: the coast every walkable cell must join on foot
STACKS = [(25, 54), (31, 57), (37, 55), (43, 51), (54, 22), (56, 33)]     # 2x2 basalt sea-stacks (top-left cells)

COAST = [(7, 7), (12, 4), (20, 5.5), (27, 3), (35, 4), (42, 3), (48, 6), (53, 9), (49, 13), (54, 17), (50, 21),
         (49, 25), (50, 30), (47, 34), (46, 38), (44, 41), (40, 41), (36, 42), (32, 41), (28, 42), (24, 41), (22, 44),
         (22, 49), (20, 53), (16, 57), (11, 56), (7, 53), (5, 47), (8, 41), (4, 35), (5, 28), (3.5, 22), (7, 16),
         (5, 11)]
# FX-D (G-1): the coast polygon is bent by seeded noise (world_coast.organic), so the west and north coasts are no
# longer ruler-straight; the cells the set pieces need stay land (the caravan's dunes and oasis, Onrac's meadow and
# bay shore, the falls, the gorge and the river's mouth)
COAST_SEED, COAST_AMP = 4606, 16.0
KEEP_LAND = [(5, 23, 16, 33), (22, 35, 35, 41), (26, 3, 36, 28), (33, 28, 44, 40)]
# the north highlands and the eastern massif (everything east of the gorge, down to the coast)
HIGHLANDS = [(5, 3), (52, 3), (55, 12), (52, 24), (51, 36), (45, 39), (41, 37), (38, 34), (35, 31), (33, 28),
             (33, 12), (28, 12), (25, 11), (20, 13), (15, 11), (10, 13), (5, 12)]
WEST_RIDGE = [(28, 11), (31, 11), (31, 28), (29, 28), (27, 24), (28, 17)]     # the gorge's west wall
DUNES = [(4, 19), (11, 18), (16, 21), (17, 27), (16, 33), (12, 37), (5, 37), (3, 30)]
FORESTS = [
    [(7, 12), (14, 13), (16, 17), (11, 19), (6, 17)],             # the snow firs under the highlands
    [(19, 19), (25, 18), (26, 23), (21, 25), (18, 23)],           # the tarn wood round the upland tarn
    [(7, 44), (15, 42), (19, 46), (17, 52), (10, 53), (6, 49)],   # the west heath
    [(33, 32), (36, 34), (35, 36), (32, 35)],                     # alders on the river's south bank
]
SPURS = [[(20, 30), (23, 29), (24, 32), (21, 33)], [(16, 38), (19, 38), (19, 40), (16, 40)]]   # upland knolls
UPLAND_TARN = [(20, 20), (23, 20), (23, 22), (20, 22)]


def polygon_mask_np(pts) -> np.ndarray:
    """The polygon's cells on the world grid (the kept land is only kept where the plain coast had land)."""
    m = np.zeros((WORLD_H, WORLD_W), bool)
    m[:H, :W] = np.array(polygon_mask(W, H, pts), bool)
    return m


def _fill(g: Grid, pts, ch: str, only: str | None = None) -> None:
    mask = polygon_mask(W, H, pts)
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                g.set(x, y, ch, only)


def ground(band: set[tuple[int, int]]) -> Grid:
    """The region's ground grid (legend chars), band cells left ocean (the composer owns them)."""
    g = Grid(W, H, "o")
    mine = np.zeros((WORLD_H, WORLD_W), bool)
    mine[:H, :W] = True
    for x, y in band:
        if 0 <= x < W and 0 <= y < H:
            mine[y, x] = False
    keep = np.zeros_like(mine)
    for x0, y0, x1, y1 in KEEP_LAND:
        keep[y0:y1 + 1, x0:x1 + 1] = True
    land = organic(COAST, COAST_AMP, COAST_SEED, mine, keep_land=keep & polygon_mask_np(COAST))
    for y, x in zip(*np.nonzero(land)):
        g.set(int(x), int(y), ".")
    _fill(g, HIGHLANDS, "m", only=".")
    _fill(g, WEST_RIDGE, "m", only=".")
    _fill(g, DUNES, "s", only=".")
    for f in FORESTS:
        _fill(g, f, "f", only=".")
    for s in SPURS:
        _fill(g, s, "m", only=".")
    _fill(g, OASIS, ".", only="s")
    _fill(g, UPLAND_TARN, "≈", only=".f")
    _fill(g, TARN, "≈", only="m")
    # the gorge: river columns from the ledge row down, mountain walls either side
    for y in range(LEDGE[0][1], GORGE_END + 1):
        for x in RIVER_X:
            g.set(x, y, "r")
        for x in (28, 29, 30, 33, 34):
            if (x, y) not in LEDGE:
                g.set(x, y, "m")
    g.line(RIVER_LOW, "r", width=2)
    for x, y in LEDGE:
        g.set(x, y, "s")
    # the falls icon stands on rock; its door cell is the only way into the cave
    for dy in range(3):
        for dx in range(2):
            g.set(FALLS[0] + dx, FALLS[1] + dy, "m")
    g.rect(*OUTCROP, "m")
    for x, y in TRACK:
        g.set(x, y, ",")
    for x0, y0 in STACKS:
        g.rect(x0, y0, x0 + 1, y0 + 1, "m", only="o")
    for x, y in band:
        if 0 <= x < W and 0 <= y < H:
            g.set(x, y, "o")
    _rock_strays(g)
    _drop_crumbs(g)
    return g


def _drop_crumbs(g: Grid) -> None:
    """FX-D: a mountain, sand or forest patch under 3 cells (min_blob) left on the noisy coast goes to the sea when it
    touches it (a crumb of rock off a headland); row-major, so deterministic."""
    for ch in "msf":
        mask = np.zeros((WORLD_H, WORLD_W), bool)
        for y in range(H):
            for x in range(W):
                mask[y, x] = g[x, y] == ch
        for comp in components(mask):
            if len(comp) < 3 and any(g.inside(x + dx, y + dy) and g[x + dx, y + dy] == "o" for x, y in comp
                                     for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                for x, y in comp:
                    g.set(x, y, "o")


def _rock_strays(g: Grid) -> None:
    """Walkable cells cut off from Onrac's coast on foot (slivers the river leaves on its east bank) become rock;
    the ledge behind the falls is the one walkable pocket the canoe alone reaches."""
    walk = set(".,sf")
    seen, todo = {LAND_SEED}, [LAND_SEED]
    while todo:
        x, y = todo.pop()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and g.inside(*n) and g[n] in walk:
                seen.add(n)
                todo.append(n)
    for y in range(H):
        for x in range(W):
            if g[x, y] in walk and (x, y) not in seen and (x, y) not in LEDGE:
                g.set(x, y, "m")

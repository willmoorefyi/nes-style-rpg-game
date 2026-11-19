"""The ground of region FIRE (docs/WORLD_PLAN.md 4.4; FIR-O): the south-east continent on the 192x192 world grid.

`ground(band)` returns a world grid ([y][x] legend chars, numpy) whose FIRE cells outside the bands are painted, and
the cell sets the module exports: the ring (barrier `crescent_ring`), the Aldi walls' FIRE parts and the rivers.
Shapes are fixed polylines and rects bent by seeded value noise (numpy only, no `random`, no `hash()`), so a rerun
is byte-identical. Every coordinate here is a world cell; F (below) holds the named places.

Concept: a lake country walled off by a brass-coloured fold of mountains, whose two outlets carry the canoe south
through the fold into ash, frost and dune.
Distinct: both rivers sink into the ground instead of reaching the sea (the lake's water feeds the volcano's roots);
the volcano's river runs right past the ice cavern's door, two rows below it; the cavern mouths are cut into the Aldi cliffs from below.
Topology: Crescent's shore (dock, town, lake) | the ring | the south lands (ash -> volcano; frost -> ice cavern;
dunes -> the buried hull), joined on foot; R-volcano and R-ice the only ways through.
"""
from __future__ import annotations

from collections import deque

import numpy as np

from world_api import WORLD_H, WORLD_W, Cell
from world_coast import fbm as coast_fbm, organic, signed_distance

SEED = 4404
N_X0, N_X1, N_Y0 = 146, 189, 66          # the north rect's land box (outside the bands)
S_X0, S_X1, S_Y1 = 114, 189, 189         # the south rect's land box
BELT_TOP, BELT_BOT = 138, 147            # the ring between Crescent's land and the south lands (x >= 142)
CLIFF_ROWS = (146, 147)                  # W_south's cliffs facing the Aldi (x 114-141; northWest.test.ts)
LAKE_C, LAKE_R = (167, 124), 13          # the crescent: an outer disc less an inner disc to its east
LAKE_IN_C, LAKE_IN_R = (175, 123), 9.5
ISLET = [(159, 123), (160, 123), (159, 124), (160, 124)]          # the Circle's standing stones
# 4-connected river courses (the canoe moves orthogonally), from the lake outlet to the sink
R_VOLCANO = [(159, 134), (159, 139), (154, 139), (154, 142), (151, 142), (151, 150), (132, 150)]
R_ICE = [(167, 136), (167, 146), (165, 146), (165, 153), (140, 153)]
VOLCANO = (119, 149)                     # the 3x2 volcano icon's top-left; its door (120, 150), the anchor (120, 151)
ICE_MOUTH = (135, 147)                   # the 2x2 cave mouth's top-left; door (136, 148), anchor (136, 149)
HULL = (142, 157)                        # the 3x2 buried hull's top-left; the hatch (143, 159), the anchor (143, 160)
AIRSHIP = (149, 162)                     # where the airship settles: a grass cell on the desert's edge
RING_SEEDS = ((152, 130), (143, 161))    # one walkable cell on each side of the ring


def _noise(cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 over the world grid (bilinear knots, smoothstep)."""
    r = np.random.default_rng(seed)
    gw, gh = int(WORLD_W / cell) + 3, int(WORLD_H / cell) + 3
    g = r.random((gh, gw))
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W].astype(np.float64)
    fy, fx = (yy + 0.5) / cell, (xx + 0.5) / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(seed: int) -> np.ndarray:
    return _noise(7, seed) * 0.6 + _noise(3.5, seed + 1) * 0.3 + _noise(1.7, seed + 2) * 0.1 - 0.5


def path4(pts: list[Cell]) -> list[Cell]:
    """The cells of orthogonal segments through `pts` (each pair shares x or y), in order, without repeats."""
    out: list[Cell] = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        assert x0 == x1 or y0 == y1, f"segment {(x0, y0)}->{(x1, y1)} is not orthogonal"
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            c = (x0 + (x1 - x0) * k // n, y0 + (y1 - y0) * k // n)
            if not out or out[-1] != c:
                out.append(c)
    return out


def _lake(x: int, y: int) -> bool:
    out = np.hypot(x + 0.5 - LAKE_C[0] - 0.5, y + 0.5 - LAKE_C[1] - 0.5) <= LAKE_R
    inner = np.hypot((x - LAKE_IN_C[0]) * 1.0, (y - LAKE_IN_C[1]) * 1.1) <= LAKE_IN_R
    return bool(out and not inner)


# FX-D (G-1): the two coasts are hand-drawn polygons bent by seeded noise (world_coast.organic), not boxes with a
# 1-3 cell wobble: Crescent's land has bays on its north and east coasts and a ragged outer-channel shore, the south
# lands a crooked south coast. Clockwise, world cells.
NORTH_COAST = [(148, 70), (154, 66.5), (162, 68.5), (170, 66.5), (177, 69), (184, 66.5), (189.5, 70), (186, 77),
               (189, 85), (185, 92), (189, 100), (186.5, 107), (189.5, 115), (186, 123), (189, 131), (187, 138),
               (190, 144), (190, 148.5), (141.5, 148.5), (141.5, 145.5), (147.5, 139), (146, 133), (146.5, 127),
               (146.5, 118), (151, 113), (149, 107), (154.5, 101), (150, 95), (148, 89), (153.5, 84), (155, 78.5),
               (150, 74.5)]
SOUTH_COAST = [(113.5, 145.5), (190, 145.5), (189, 153), (186, 160), (189, 168), (185.5, 175), (188.5, 182),
               (183, 186.5), (176, 184), (168, 187.5), (160, 185), (151, 188), (142, 185), (133, 187.5), (125, 184.5),
               (119, 187), (118, 181), (123, 173), (118.5, 165), (121.5, 157.5), (117, 152), (116.5, 148)]
COAST_AMP = 12.0
# kept land: Crescent's shore, the lake and its banks, the river courses, the ring's west end, the volcano's rock
# and ash, the frost hollow, the vents, the hull's dunes and the airship's grass
KEEP_LAND = [(147, 118, 153, 130), (152, 109, 182, 138), (150, 133, 168, 155), (142, 146, 145, 147),
             (117, 148, 131, 152), (132, 148, 141, 153), (122, 157, 127, 159), (124, 164, 130, 167),
             (119, 171, 124, 174), (140, 155, 146, 162), (147, 160, 151, 164), (123, 154, 129, 162)]
KEEP_WATER = [(114, 148, 115, 191), (146, 119, 146, 129)]   # the western sea lane, the harbour by Crescent
# the two deserts (FX-D: noisy outlines, no longer sand boxes parted by a straight column): the Gurgu ash fields and
# the hull's dunes, a ragged strip of downs between them
ASH = [(115.5, 148.5), (131.5, 148.5), (130.5, 154), (127.5, 160), (130.5, 167), (126.5, 174), (128.5, 180),
       (123, 182.5), (118.5, 179)]
DUNES = [(136.5, 153.5), (145, 152.5), (155, 154.5), (162.5, 158), (159.5, 165), (165, 171), (161.5, 177), (154, 181),
         (145, 179), (139, 182), (137.5, 175), (139.5, 167), (137, 160)]


def _rects(rects) -> np.ndarray:
    m = np.zeros((WORLD_H, WORLD_W), bool)
    for x0, y0, x1, y1 in rects:
        m[y0:y1 + 1, x0:x1 + 1] = True
    return m


def _land(mine: np.ndarray) -> np.ndarray:
    """True where FIRE has land before the features: the two organic coasts, the cliffs and the ring's west end."""
    keep, wet = _rects(KEEP_LAND), _rects(KEEP_WATER)
    north = organic(NORTH_COAST, COAST_AMP, SEED, mine, keep_land=keep, keep_water=wet)
    south = organic(SOUTH_COAST, COAST_AMP, SEED + 50, mine, keep_land=keep, keep_water=wet)
    land = north | south
    land[146:148, 114:146] = True                    # W_south's cliff rows and the ring's west end
    return land & mine & ~wet


def ground(mine: np.ndarray) -> tuple[np.ndarray, dict]:
    """The painted world grid and the exported cell sets (see the module docstring)."""
    g = np.full((WORLD_H, WORLD_W), "o", dtype="<U1")
    land = _land(mine)
    g[land] = "."
    n3, n4 = fbm(SEED + 20), fbm(SEED + 30)
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W]
    # forests and hills on Crescent's downs and in the east of the south lands
    forest = land & (n3 > 0.08) & ~((xx < 156) & (yy > 110) & (yy < 138))
    g[forest] = "f"
    hills = land & (n4 > 0.16) & (yy < 104) | land & (n4 > 0.2) & (xx > 168) & (yy > 150)
    g[hills] = "m"
    # the ring: a fold of mountains from the outer channel to the east coast, ragged on both faces
    ring: set[Cell] = set()
    for x in range(142, WORLD_W):
        top = BELT_TOP if x < 150 else BELT_TOP + int(round(1.2 * (n3[BELT_TOP, x] + 0.5)))
        bot = BELT_BOT if x < 152 else BELT_BOT + int(round(1.4 * (n4[BELT_BOT, x] + 0.5)))
        for y in range(top if x >= 146 else 146, bot + 1):
            if land[y, x]:
                g[y, x] = "m"
                ring.add((x, y))
    # W_south's cliffs, the volcano's backdrop, the western sea lane and the south lands' grounds
    cliffs = {(x, y) for y in CLIFF_ROWS for x in range(114, 142)}
    for x, y in cliffs:
        g[y, x] = "m"
    g[148, 114:131] = "m"
    g[148:S_Y1 + 1, 114:116] = "o"
    ash = land & (yy >= 149) & (signed_distance(ASH) + 8 * coast_fbm(SEED + 60) > 0)
    g[ash & (g != "o")] = "s"
    spurs = ash & (n4 > 0.18) & (yy > 156)
    g[spurs] = "m"
    g[148:153, 132:142] = "."                         # the frost hollow below the cliffs
    dunes = land & (signed_distance(DUNES) + 8 * coast_fbm(SEED + 70) > 0)
    g[dunes] = "s"
    # the lake, its islet and the two rivers
    for y in range(LAKE_C[1] - LAKE_R - 1, LAKE_C[1] + LAKE_R + 2):
        for x in range(LAKE_C[0] - LAKE_R - 1, LAKE_C[0] + LAKE_R + 2):
            if _lake(x, y):
                g[y, x] = "≈"
    for x, y in ISLET:
        g[y, x] = "m"
    rivers = {}
    for name, pts in (("volcano", R_VOLCANO), ("ice", R_ICE)):
        cells = [c for c in path4(pts) if g[c[1], c[0]] != "≈"]
        for x, y in cells:
            g[y, x] = "r"
        ring -= set(cells)
        rivers[name] = cells
    # the places: the volcano and cave mouth icons stand on rock and ash, the hull in the dunes
    vx, vy = VOLCANO
    g[vy, vx:vx + 3], g[vy + 1, vx:vx + 3], g[vy + 2, vx - 1:vx + 12] = "m", "s", "s"
    mx, my = ICE_MOUTH
    g[my + 1, mx], g[my + 1, mx + 1], g[my + 1, mx + 2], g[my + 2, mx - 1:mx + 3] = ".", ".", "m", "."
    hx, hy = HULL
    g[hy - 1:hy + 4, hx - 1:hx + 4] = "s"
    ax, ay = AIRSHIP
    g[ay - 1:ay + 2, ax - 1:ax + 2] = "."
    g[119:130, 147:153] = np.where(g[119:130, 147:153] == "o", "o", ".")   # Crescent's shore stays open
    _tidy(g, mine)
    walls = {"W_south": {c for c in cliffs if c[0] <= 137},
             "W_east": {(x, y) for y in CLIFF_ROWS for x in range(138, 146)}}
    return g, {"ring": ring & {(x, y) for y in range(WORLD_H) for x in range(WORLD_W) if g[y, x] == "m"},
               "walls": walls, "rivers": rivers}


def _components(mask: np.ndarray) -> list[list[Cell]]:
    seen = np.zeros_like(mask)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp, q = [], deque([(x, y)])
        seen[y, x] = True
        while q:
            cx, cy = q.popleft()
            comp.append((cx, cy))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < WORLD_W and 0 <= ny < WORLD_H and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        out.append(comp)
    return out


def _tidy(g: np.ndarray, mine: np.ndarray) -> None:
    """Blobs of forest, sand or mountain under 3 cells become grass (min_blob), twice, row-major (deterministic).
    Fixed cells (the islet, the icons' rock) are 2+ cells already."""
    for _ in range(2):
        for ch in "fsm":
            for comp in _components((g == ch) & mine):
                if len(comp) < 3:
                    for x, y in comp:
                        g[y, x] = "."

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


def _land(mine: np.ndarray) -> np.ndarray:
    """True where FIRE has land before the features: noisy coasts on the two land boxes, the cliffs and the ring."""
    n1, n2 = fbm(SEED), fbm(SEED + 10)
    land = np.zeros((WORLD_H, WORLD_W), bool)
    for y in range(N_Y0, BELT_BOT + 1):
        west = 147 if 119 <= y <= 129 else N_X0 if y >= 132 else N_X0 + int(round(1.4 + 2.6 * n1[y, N_X0]))
        east = N_X1 - int(round(1.6 + 3.0 * n2[y, N_X1]))
        for x in range(max(west, N_X0), east + 1):
            north = N_Y0 + int(round(1.5 + 3.0 * n1[N_Y0, x]))
            land[y, x] = y >= north
    for y in range(146, S_Y1 + 1):
        east = S_X1 - int(round(1.6 + 3.0 * n2[y, S_X1]))
        for x in range(S_X0, east + 1):
            south = S_Y1 - int(round(2.0 + 5.0 * (n1[S_Y1, x] + 0.5)))
            west = 116 if y >= 148 else S_X0
            land[y, x] = y <= south and x >= west
    land[146:148, 142:146] = True                    # the ring's west end, against the outer channel
    return land & mine


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
    ash = land & (xx >= 116) & (xx <= 131) & (yy >= 149) & (yy <= 176 + (n3 * 6).astype(int))
    g[ash & (g != "o")] = "s"
    spurs = ash & (n4 > 0.18) & (yy > 156)
    g[spurs] = "m"
    g[148:153, 132:142] = "."                         # the frost hollow below the cliffs
    dunes = land & (xx >= 133) & (xx <= 160 + (n4 * 6).astype(int)) & (yy >= 154) & (yy <= 177 + (n3 * 5).astype(int))
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

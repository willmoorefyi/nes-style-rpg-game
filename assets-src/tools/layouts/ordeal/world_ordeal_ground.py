"""The ground of region ORDEAL (docs/WORLD_PLAN.md 4.5; ORD-O): the Citadel plateau and the Cardia isles.

`ground(mine)` returns a world grid ([y][x] legend chars, numpy) whose ORDEAL cells outside the bands are painted,
and the land of each landmass by name. Shapes are fixed ellipses bent by seeded value noise (numpy only, no
`random`, no `hash()`), so a rerun is byte-identical. Every coordinate here is a world cell.

Concept: a wind-scoured tableland walled by a rim of peaks, with a hollow citadel built into its western crag, and
east of it a broken arc of six islets where the dragons keep their oldest den.
Distinct: a knife ridge runs from the north-east rim into the heart of the plateau and splits its heath into a glen
and a forested sink; Bahamut's isle is a horseshoe whose bay cuts deep into its east side; a hermit lives alone on
the arc's northernmost isle.
Topology: the plateau (rim peaks, heath, the glen behind the ridge, the forest sink; the citadel's meadow) | six isles
(Bahamut's horseshoe, the hermit's isle and four bare ones), none joined on foot; the airship lands on the plateau's
meadow and on every isle.
"""
from __future__ import annotations

from collections import deque

import numpy as np

from world_api import WORLD_H, WORLD_W, Cell

SEED = 4505
PLATEAU = (81.0, 28.0, 15.5, 18.0)       # centre x, y and radii of the plateau's outline
RIM = 2                                  # the rim of peaks: land within this many cells of the coast
CITADEL = (74, 25)                       # the 3x3 citadel icon's top-left (LM5-INT; was 2x2 at (74, 26)); its door
                                         # (75, 27) bottom centre, the anchor (75, 28)
MEADOW = (71, 28, 80, 34)                # the grass landing meadow below the gate (x0, y0, x1, y1)
CRAG = (69, 19, 81, 25)                  # the crag the citadel is cut into
RIDGE = [(94, 15), (90, 20), (86, 25), (85, 29)]   # the knife ridge, north-east rim to the plateau's heart
SINK = (84, 31, 93, 42)                  # the forested sink south of the ridge's end
# the isles: name -> (centre x, centre y, radius x, radius y)
ISLES = {
    "bahamut": (107.0, 52.0, 6.5, 5.5),
    "hermit": (119.0, 39.0, 4.0, 3.5),
    "north": (103.0, 38.0, 3.5, 3.0),
    "east": (121.0, 53.0, 3.0, 4.0),
    "stack": (110.0, 42.0, 2.3, 2.0),
    "west": (95.0, 55.0, 2.8, 2.5),
}
CAVE = (105, 51)                         # the 2x2 cave mouth on Bahamut's isle; door (106, 52), the anchor (106, 53)
BAY = (111, 50, 115, 53)                 # the horseshoe's bay, open to the east
TENT = (118, 38)                         # the hermit's 2x2 hut; its inspect cell (119, 39)
# one walkable landing cell per isle (the reach roots, `ord_isle_<name>`; Bahamut's is its anchor)
LANDINGS = {"hermit": (118, 41), "north": (103, 39), "east": (121, 54), "stack": (110, 43), "west": (95, 56)}


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


def _blob(cx: float, cy: float, rx: float, ry: float, n: np.ndarray, amp: float) -> np.ndarray:
    """An ellipse whose radius wobbles by `amp` (in units of the radius) with the noise."""
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W].astype(np.float64)
    d = np.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry)
    return d <= 1.0 + amp * n


def _components(mask: np.ndarray) -> list[list[Cell]]:
    seen = np.zeros_like(mask)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp, q = [], deque([(int(x), int(y))])
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


def _coast_dist(land: np.ndarray, k: int) -> np.ndarray:
    """Land cells within `k` steps (Chebyshev) of a non-land cell."""
    near = np.zeros_like(land)
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            near |= ~np.roll(np.roll(land, dy, 0), dx, 1)
    return land & near


def _ridge(pts: list[Cell]) -> set[Cell]:
    """A 2-cell-wide line through the points."""
    out: set[Cell] = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            x, y = x0 + round((x1 - x0) * k / n), y0 + round((y1 - y0) * k / n)
            out |= {(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)}
    return out


def ground(mine: np.ndarray) -> tuple[np.ndarray, dict[str, set[Cell]]]:
    """The painted world grid and the land of each landmass (`plateau` and each isle's name)."""
    g = np.full((WORLD_H, WORLD_W), "o", dtype="<U1")
    n1, n2, n3 = fbm(SEED), fbm(SEED + 10), fbm(SEED + 20)
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W]
    plateau = _blob(*PLATEAU, n1, 0.22) & mine
    isles = {k: _blob(*v, n2 if i % 2 else n3, 0.25) & mine for i, (k, v) in enumerate(ISLES.items())}
    bx0, by0, bx1, by1 = BAY
    isles["bahamut"][by0:by1 + 1, bx0:bx1 + 1] = False                 # the horseshoe's bay
    isles["bahamut"][50:53, 109:111] = False
    land = plateau.copy()
    for m in isles.values():
        land |= m
    g[land] = "."
    # the plateau: a rim of peaks on its whole coast, the crag behind the citadel, the knife ridge, the forested sink
    g[_coast_dist(plateau, RIM)] = "m"
    rim_hills = plateau & (n2 > 0.12) & ~_coast_dist(plateau, RIM + 3)
    g[rim_hills] = "m"
    cx0, cy0, cx1, cy1 = CRAG
    g[cy0:cy1 + 1, cx0:cx1 + 1] = np.where(plateau[cy0:cy1 + 1, cx0:cx1 + 1], "m", g[cy0:cy1 + 1, cx0:cx1 + 1])
    for x, y in _ridge(RIDGE):
        if plateau[y, x]:
            g[y, x] = "m"
    sx0, sy0, sx1, sy1 = SINK
    sink = plateau & (xx >= sx0) & (xx <= sx1) & (yy >= sy0) & (yy <= sy1) & (g == ".") & (n3 > -0.18)
    g[sink] = "f"
    heath_wood = plateau & (g == ".") & (n1 > 0.17) & (yy < 24)
    g[heath_wood] = "f"
    # the citadel's icon cells and its meadow
    mx0, my0, mx1, my1 = MEADOW
    g[my0:my1 + 1, mx0:mx1 + 1] = np.where(plateau[my0:my1 + 1, mx0:mx1 + 1], ".", g[my0:my1 + 1, mx0:mx1 + 1])
    x, y = CITADEL
    g[y, x - 1:x + 4], g[y + 1:y + 3, x - 1:x + 4] = "m", "."   # the icon's top row stands against the crag, its
    # body and gate on the meadow's grass; the two broken pillars (x - 1, x + 3) stand with their tops on the crag
    g[y + 1, x - 1], g[y + 1, x + 3] = "m", "m"
    # the isles: a crag on each, wood on the larger ones, Bahamut's landing patch before the cave
    for i, (k, m) in enumerate(isles.items()):
        nn = n2 if i % 2 else n3
        g[_coast_dist(m, 1) & (nn > 0.1)] = "m"
        if k in ("bahamut", "hermit", "north"):
            g[m & ~_coast_dist(m, 1) & (nn < -0.12)] = "f"
    cx, cy = CAVE
    g[cy - 4:cy, cx - 3:cx + 5] = np.where(isles["bahamut"][cy - 4:cy, cx - 3:cx + 5], "m", "o")
    g[cy:cy + 2, cx:cx + 2] = "."
    g[cy:cy + 2, cx - 1], g[cy:cy + 2, cx + 2] = "m", "m"                # the door opens only south
    g[cy + 2:cy + 6, cx - 3:cx + 5] = np.where(isles["bahamut"][cy + 2:cy + 6, cx - 3:cx + 5], ".", "o")
    tx, ty = TENT
    g[ty - 1:ty + 4, tx - 1:tx + 3] = np.where(isles["hermit"][ty - 1:ty + 4, tx - 1:tx + 3], ".", "o")
    for x, y in LANDINGS.values():
        g[y, x] = "."
    _tidy(g, mine)
    return g, {"plateau": {(int(x), int(y)) for y, x in zip(*np.nonzero(plateau))},
               **{k: {(int(x), int(y)) for y, x in zip(*np.nonzero(m))} for k, m in isles.items()}}


def _tidy(g: np.ndarray, mine: np.ndarray) -> None:
    """Water the open sea doesn't reach (a pocket inside the land) becomes rock; then blobs of forest or mountain
    under 3 cells become grass (min_blob), twice, row-major (deterministic)."""
    for comp in _components((g == "o") & mine):
        if not any(not mine[y + dy, x + dx] for x, y in comp for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            for x, y in comp:
                g[y, x] = "m"
    for _ in range(2):
        for ch in "fm":
            for comp in _components((g == ch) & mine):
                if len(comp) < 3:
                    for x, y in comp:
                        g[y, x] = "."

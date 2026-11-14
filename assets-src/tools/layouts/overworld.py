"""The act-1 overworld -> assets-src/maps/overworld.yaml.

  python3 -I assets-src/tools/layouts/overworld.py && python3 -I assets-src/tools/build_map.py overworld

An original layout on the classic idea (docs/FIX_PLAN_PENINSULA.md, T3c). The Cornelia peninsula hangs south-west from
a larger landmass. A sound opens to the western ocean north of it, narrows eastward to a strait (the broken north
bridge) and ends in a fjord head. From the fjord head an unbroken range, the spine, runs south-east to the eastern sea
and seals the land route, so the north bridge is the only way out. The east river rises at a tarn in the spine's
foothills and runs south-west to the south bay; the east pocket between the river and the spine holds Erdrick's tomb.
The city stream feeds the moat ponds at the walled city's corners, runs under the town (as the icon draws it) and
leaves at the south-west corner for the bay.

Shapes come from polygons whose outlines are perturbed by seeded value noise (numpy only; no `random`, no `hash()`),
then tidied (no stray single cells, no 1-cell inlets) so the compiler's map checks pass.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Grid, write_map  # noqa: E402

W, H = 72, 56
SEED = 1987

# ───────────────────────────── fixed points ─────────────────────────────
CX, CY = 26, 27                      # the city icon's top-left cell: a 5x4 footprint (the 4x4 art shifted 24 px right)
N_WARP, W_WARP, E_WARP, S_WARP = (CX + 2, CY), (CX, CY + 2), (CX + 4, CY + 2), (CX + 2, CY + 3)
ARRIVE = {"cornelia": (CX + 2, CY + 4), "cornelia_west": (CX - 1, CY + 2), "cornelia_east": (CX + 5, CY + 2),
          "cornelia_north": (CX + 2, CY - 1)}
BX = 29                              # the north bridge (columns BX, BX+1): south stub, a 2-cell gap of open water, north stub
S_STUB, N_STUB = 16, 13                # rows of the two stubs; rows 14-15 between them stay open water
BRIDGE_FOOT, NORTH_SHORE = (BX, S_STUB + 1), (BX, N_STUB - 1)
TX, TY = 14, 21                      # the temple icon (2x2); its door is (TX+1, TY+1), the arrival one cell south
TEMPLE_DOOR = (TX + 1, TY + 2)
RX, RY = 45, 29                      # the east bridge: two cells (RX, RY), (RX+1, RY) over the 2-wide east river
TOMB = (50, 27)                      # the sarcophagus' left cell (altar_l); altar_r is east of it
TOMB_END = (TOMB[0], TOMB[1] + 1)    # the E road ends in front of the sarcophagus
JETTY: list[tuple[int, int]] = []    # 3 bridge-deck cells straight out from the shore below the S road (set by build)

# moat ponds in the icon's transparent corner cells, so every gate is a doorway (one walkable neighbour); the stream
# (river cells) enters at the north-east corner, runs under the town and leaves at the south-west corner
PONDS = [(CX, CY), (CX + 1, CY), (CX, CY + 1),                                                  # north-west
         (CX + 3, CY), (CX + 4, CY), (CX + 4, CY - 1), (CX + 5, CY - 1),                           # the spring (NE)
         (CX + 4, CY + 3)]                                                                         # south-east
UNDER_TOWN = [(CX + 4, CY + 1), (CX + 3, CY + 1), (CX + 3, CY + 2), (CX + 2, CY + 2), (CX + 1, CY + 2), (CX + 1, CY + 3),
              (CX, CY + 3)]
STREAM = [(CX, CY + 3), (CX, CY + 5), (CX - 2, CY + 7), (CX - 4, CY + 9), (CX - 5, CY + 12)]

# ───────────────────────────── noise and shapes ─────────────────────────────


def value_noise(cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 on the cell grid (bilinear with smoothstep)."""
    r = np.random.default_rng(seed)
    gw, gh = int(W / cell) + 3, int(H / cell) + 3
    g = r.random((gh, gw))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    fy, fx = (yy + 0.5) / cell, (xx + 0.5) / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(seed: int) -> np.ndarray:
    """Two-and-a-bit octaves, centred on 0 (about -0.5..0.5)."""
    return value_noise(7, seed) * 0.6 + value_noise(3.5, seed + 1) * 0.3 + value_noise(1.7, seed + 2) * 0.1 - 0.5


def signed_distance(pts: list[tuple[float, float]]) -> np.ndarray:
    """Per cell centre: distance to the polygon outline, positive inside."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    px, py = xx + 0.5, yy + 0.5
    best = np.full((H, W), np.inf)
    inside = np.zeros((H, W), bool)
    n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
        if y0 != y1:
            cross = ((y0 > py) != (y1 > py)) & (px < x0 + (py - y0) * dx / dy)
            inside ^= cross
    return np.where(inside, best, -best)


def polyline_distance(pts: list[tuple[float, float]]) -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    px, py = xx + 0.5, yy + 0.5
    best = np.full((H, W), np.inf)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
    return best


def blob(cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    """Ellipse field: > 0 inside (about 1 at the centre)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    return 1 - np.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry)


# the whole landmass (mainland and peninsula), then the waters cut out of it
LAND = [(6.5, 6.5), (11, 4.8), (17, 5.4), (22, 4.6), (28, 5.4), (34, 4.6), (40, 5.2), (46, 4.4), (52, 5.4), (58, 4.6),
        (63, 6.5), (64.5, 11), (62.5, 15), (64.8, 19), (64, 24), (65.5, 29), (65.8, 35), (64.5, 41), (62, 46),
        (58.5, 48), (55, 46.5), (50, 44), (45, 42.5), (40, 46), (34, 45.5), (28, 44.5), (22, 46.5), (17, 49), (12, 49.6),
        (8.5, 47.5), (7.5, 44), (9, 40.5), (7, 36.5), (8.2, 32), (7, 27.5), (8.5, 23), (-2, 22), (-2, 12), (6.8, 11.5)]
SOUND = [(-3, 11), (6, 11.4), (12, 11.8), (18, 12.2), (24, 12.6), (28, 12.7), (31, 12.6), (33.5, 12.2), (36, 11.2),
         (39, 10.6), (41.5, 10.8), (42.6, 11.8), (42, 12.9), (39.5, 13.4), (37, 14.3), (34.5, 15.6), (32, 16.6), (28, 16.7),
         (25, 17.4), (21, 18.2), (17, 19), (12, 20.2), (7, 21.4), (-3, 23)]
GULF = [(50, 60), (48, 44), (48, 40), (49.8, 36.4), (53.4, 33.2), (57.2, 31.2), (59, 30.4), (59.6, 32.5), (58, 35.5),
        (56.5, 39), (55.5, 43), (56, 60)]   # the eastern sea: a gulf between the pocket and the east arm
SOUTH_BAY = [(19, 41.5), (21.5, 39.2), (25, 38), (29, 37.6), (33, 38), (37, 38.6), (40, 39.2), (42.5, 40.5), (43, 47),
             (21, 49)]
SPINE = [(42.8, 11.5), (45, 15), (48, 18.6), (51.5, 21.5), (55, 24.5), (57, 27.6), (59.2, 30.4)]
SPUR = [(50.5, 21.2), (51.5, 20)]     # the tarn sits in a notch of the range: rock on its north-east side
TARN = [(48, 21), (49, 21), (48, 22), (49, 22), (50, 22)]
RIVER = [(48, 23), (47, 25), (46, 27), (RX, RY - 1), (RX, RY + 1), (44, 33), (43, 35), (42, 37)]   # 2 wide (x, x+1)

RING = [(CX - 3, CY + 2), (CX - 3, CY - 1), (CX, CY - 4), (CX + 5, CY - 4), (CX + 8, CY - 1), (CX + 8, CY + 5),
        (CX + 5, CY + 8), (CX + 2, CY + 8)]                # round the city from the W gate to the S road (not across the stream)
ROADS = [
    [ARRIVE["cornelia_north"], (CX + 2, 21), (BX, 21), BRIDGE_FOOT],                 # N: to the north bridge
    RING,
    [ARRIVE["cornelia_west"], (CX - 2, CY + 2)],                                     # W gate: onto the ring
    [(CX - 4, CY - 1), (18, CY - 1), (16, 24), (TX + 1, 24), TEMPLE_DOOR],          # the temple road (W)
    [ARRIVE["cornelia_east"], (CX + 7, CY + 2)],                                     # E gate: onto the ring
    [(CX + 9, CY + 2), (RX - 1, RY)],                                                # E: to the east bridge
    [(RX + 2, RY), (TOMB[0] - 2, RY), (TOMB[0] - 2, TOMB_END[1] + 1), (TOMB[0], TOMB_END[1] + 1), TOMB_END],  # tomb
]


def build() -> tuple[Grid, list[str]]:
    notes: list[str] = []
    land_f = signed_distance(LAND)
    for water in (SOUND, GULF, SOUTH_BAY):
        land_f = np.minimum(land_f, -signed_distance(water))
    land = land_f + 8.0 * fbm(SEED) > 0
    # hard constraints: ocean ring on the map edge, the strait at the bridge, dry ground round the city and temple
    land[:4, :] = land[-4:, :] = False
    land[:, :4] = land[:, -3:] = False
    for x in range(BX - 2, BX + 3):
        land[N_STUB:S_STUB + 1, x] = False
        land[N_STUB - 2:N_STUB, x] = True
        land[S_STUB + 1:S_STUB + 4, x] = True
    land[18:37, 13:41] |= True
    land[18:37, 13:41] &= ~(np.asarray(signed_distance(SOUTH_BAY)) > 0)[18:37, 13:41]
    land[TY - 2:TY + 3, TX - 2:TX + 4] = True
    land = tidy_land(land)

    g = Grid(W, H, "o")
    for y in range(H):
        for x in range(W):
            if land[y, x]:
                g.set(x, y, ".")

    # mountains: the spine (seals the isthmus), the hills behind the temple, a south-west ridge and two mainland ranges
    n1 = fbm(SEED + 20)
    spine = (polyline_distance(SPINE) < 2.7 + 0.8 * n1) | (polyline_distance(SPUR) < 1.3)
    hills = (blob(13.5, 19.2, 4.6, 2.0) + 0.5 * n1 > 0.15) | (blob(17.2, 20.6, 1.4, 1.6) > 0)
    ridge = blob(8.5, 39.5, 2.2, 4.2) + 0.6 * n1 > 0.1
    north = (blob(16, 6.8, 5.5, 1.8) + 0.5 * n1 > 0.1) | (blob(54, 10.5, 6.5, 2.4) + 0.5 * n1 > 0.1) | \
            (blob(62.5, 19, 2.6, 4.5) + 0.5 * n1 > 0.1) | (blob(61.5, 43, 1.6, 2.6) + 0.4 * n1 > 0.05)
    mountain = (spine | hills | ridge | north) & land
    # forests: noise inside loose zones, kept off the roads' surroundings below
    n2 = fbm(SEED + 30)
    zones = np.maximum.reduce([blob(9, 29, 5.5, 5.0), blob(15, 44, 6.5, 3.6), blob(35.5, 19.5, 4.0, 2.2),
                               blob(51.5, 34, 6.5, 6.0), blob(21, 33.5, 3.0, 2.2), blob(32.5, 41.5, 3.0, 1.6),
                               blob(26, 7.5, 7, 2.6), blob(44, 8, 5, 2.6), blob(58, 15, 4, 3), blob(63, 9, 3.2, 2.6),
                               blob(50, 26.5, 2.0, 1.4), blob(21, 19.6, 3.2, 1.6), blob(35, 37.5, 2.6, 1.4),
                               blob(14, 31, 2.2, 1.8), blob(38.5, 33.5, 2.4, 1.8),
                               blob(16.5, 38, 2.4, 1.8), blob(61, 37.5, 1.8, 3.4), blob(39.5, 21, 2.2, 1.4)])
    forest = (zones + 0.55 * n2 > 0.12) & land & ~mountain
    for y in range(H):
        for x in range(W):
            if mountain[y, x]:
                g.set(x, y, "m")
            elif forest[y, x]:
                g.set(x, y, "f")
    # keep the city surroundings, the strait headlands and the tomb clearing open grass
    clear_rect(g, CX - 3, CY - 3, CX + 7, CY + 7)
    clear_rect(g, BX - 3, S_STUB + 1, BX + 3, S_STUB + 3)
    clear_rect(g, BX - 3, N_STUB - 3, BX + 3, N_STUB - 1)
    clear_disc(g, TOMB[0] + 1, TOMB[1] + 0.5, 2.6, "fs")
    for x, y in [(TX - 1, TY + 2), (TX, TY + 2), (TX + 1, TY + 2), (TX + 2, TY + 2), (TX - 1, TY + 1)]:
        g.set(x, y, ".")
    # the temple sits against the hills: rock behind it and east of its door, so the door is a doorway
    for x, y in [(TX, TY), (TX + 1, TY), (TX + 2, TY), (TX + 2, TY + 1), (TX + 3, TY + 1), (TX + 3, TY), (TX - 1, TY)]:
        g.set(x, y, "m")

    # sand beaches: coastal land in some stretches
    n3 = fbm(SEED + 40)
    beach = np.maximum.reduce([blob(7.5, 35, 2.5, 6), blob(19, 18.5, 3.5, 1.5), blob(12, 49, 7, 3), blob(22, 43, 4, 3), blob(33, 39.5, 5, 2),
                               blob(47, 39, 3, 2), blob(56, 34, 4, 3), blob(6, 13, 3, 4), blob(64, 28, 3, 3)])
    for y in range(H):
        for x in range(W):
            if g[x, y] in ".f" and beach[y, x] + 0.4 * n3[y, x] > 0 and near(g, x, y, "o", 1 + (n3[y, x] > 0.1)):
                g.set(x, y, "s")

    # water features: the tarn and the east river, the moat ponds and the city stream
    for x, y in TARN:
        g.set(x, y, "≈")
    g.line(RIVER, "r", 2)
    extend_to_sea(g, RIVER[-1], 2)
    for y in range(RY - 1, RY + 2):                  # straight through the east bridge: exactly the span's columns
        g.set(RX - 1, y, ".", only="r")
        g.set(RX + 2, y, ".", only="r")
        g.set(RX, y, "r")
        g.set(RX + 1, y, "r")
    for x, y in PONDS:
        g.set(x, y, "≈")
    for x, y in UNDER_TOWN:
        g.set(x, y, "r")
    g.line(STREAM, "r", 1)
    extend_to_sea(g, STREAM[-1], 1)

    # roads, bridges and the jetty (no road under the icons; the river stays straight through the east bridge)
    shore = next(y for y in range(CY + 5, H) if g[CX + 2, y + 1] == "o")
    JETTY[:] = [(CX + 2, shore + 1 + i) for i in range(3)]
    before = [row[:] for row in g.g]
    for pts in ROADS + [[ARRIVE["cornelia"], (CX + 2, shore)]]:                      # S: to the jetty
        for x, y in g.line(pts, ",", 1):
            if before[y][x] in "r≈om":
                raise SystemExit(f"road crosses {before[y][x]!r} at ({x}, {y})")
    g.set(RX, RY, "=")
    g.set(RX + 1, RY, "=")
    for x in (BX, BX + 1):
        g.set(x, S_STUB, "=")
        g.set(x, N_STUB, "=")
    for x, y in JETTY:
        g.set(x, y, "=")
    tidy_blobs(g, notes)
    return g, notes


def walk_grid(g: Grid) -> np.ndarray:
    """Walkable cells on foot, as the compiler will make them (icons blocked except their gates)."""
    ok = np.array([[g[x, y] not in "mor≈" for x in range(W)] for y in range(H)])
    for j in range(4):
        for i in range(5):
            ok[CY + j, CX + i] = False
    for j in range(2):
        for i in range(2):
            ok[TY + j, TX + i] = False
    ok[TOMB[1], TOMB[0]:TOMB[0] + 2] = False
    ok[TOMB[1], [TOMB[0] - 1, TOMB[0] + 2]] = False
    return ok


def bfs(ok: np.ndarray, start: tuple[int, int], blocked: set = frozenset()) -> dict[tuple[int, int], int]:
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in dist and n not in blocked and ok[n[1], n[0]]:
                dist[n] = dist[(x, y)] + 1
                q.append(n)
    return dist


def check(g: Grid) -> list[str]:
    """The layout's own promises (the compiler and the vitest suite check the compiled map again)."""
    errs = []
    ok = walk_grid(g)
    d = bfs(ok, ARRIVE["cornelia"])
    if NORTH_SHORE in d:
        errs.append("north_shore is reachable on foot: the range does not seal the land route")
    for name, (lo, hi), p in (("temple door", (25, 40), TEMPLE_DOOR), ("bridge foot", (18, 30), BRIDGE_FOOT)):
        if not lo <= d.get(p, 999) <= hi:
            errs.append(f"south gate to the {name}: {d.get(p)} steps, want {lo}-{hi}")
    pocket = bfs(ok, TOMB_END, {(RX, RY), (RX + 1, RY)})
    if ARRIVE["cornelia"] in pocket:
        errs.append("the east pocket can be reached without the east bridge")
    if not 60 <= len(pocket) <= 90:
        errs.append(f"the east pocket has {len(pocket)} walkable cells, want 60-90")
    water = np.array([[g[x, y] in "o=" for x in range(W)] for y in range(H)])
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if g[x, y] == "o" and ((not water[y, x - 1] and not water[y, x + 1]) or (not water[y - 1, x] and not water[y + 1, x])):
                errs.append(f"1-cell ocean inlet at ({x}, {y})")
    print(f"  reachable from cornelia: {len(d)} cells; to the temple door {d.get(TEMPLE_DOOR)}, to the bridge foot "
          f"{d.get(BRIDGE_FOOT)}; east pocket {len(pocket)} cells")
    return errs


def clear_rect(g: Grid, x0: int, y0: int, x1: int, y1: int) -> None:
    g.rect(x0, y0, x1, y1, ".", only="fms")


def clear_disc(g: Grid, cx: float, cy: float, r: float, only: str = "fms") -> None:
    for y in range(H):
        for x in range(W):
            if np.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                g.set(x, y, ".", only=only)


def near(g: Grid, x: int, y: int, chars: str, r: int) -> bool:
    return any(g.inside(x + dx, y + dy) and g[x + dx, y + dy] in chars
               for dy in range(-r, r + 1) for dx in range(-r, r + 1) if abs(dx) + abs(dy) <= r)


def extend_to_sea(g: Grid, start: tuple[int, int], width: int) -> None:
    """Carry a river on south (then south-west) from its last point until it meets the ocean."""
    x, y = start
    for _ in range(12):
        if any(g.inside(x + i, y + 1) and g[x + i, y + 1] == "o" for i in range(width)):
            return
        y += 1
        for i in range(width):
            g.set(x + i, y, "r", only=".fs")
    raise SystemExit(f"river from {start} never reaches the sea")


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                comp, q = [], deque([(x, y)])
                seen[y, x] = True
                while q:
                    cx, cy = q.popleft()
                    comp.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((nx, ny))
                out.append(comp)
    return out


def tidy_land(land: np.ndarray) -> np.ndarray:
    """One landmass, no enclosed sea, and no ocean run shorter than 2 cells between land (1-cell inlets)."""
    for _ in range(8):
        comps = sorted(components(land), key=len, reverse=True)
        for cs in comps[1:]:
            for x, y in cs:
                land[y, x] = False
        for cs in components(~land):
            if not any(x in (0, W - 1) or y in (0, H - 1) for x, y in cs):
                for x, y in cs:
                    land[y, x] = True
        changed = False
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if land[y, x]:
                    continue
                if (land[y, x - 1] and land[y, x + 1]) or (land[y - 1, x] and land[y + 1, x]):
                    land[y, x] = True
                    changed = True
        # land one cell wide between two waters reads as a stray spit: drop it
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if land[y, x] and ((not land[y, x - 1] and not land[y, x + 1]) or (not land[y - 1, x] and not land[y + 1, x])):
                    if not (BX - 3 <= x <= BX + 3 and N_STUB - 3 <= y <= S_STUB + 3):
                        land[y, x] = False
                        changed = True
        if not changed:
            break
    return land


def tidy_blobs(g: Grid, notes: list[str]) -> None:
    """No mountain, forest or sand patch smaller than 4 cells (the compiler's min_blob asks for 3)."""
    for ch, fill in (("m", "."), ("f", "."), ("s", ".")):
        mask = np.array([[g[x, y] == ch for x in range(W)] for y in range(H)])
        for cs in components(mask):
            if len(cs) < 4:
                for x, y in cs:
                    g.set(x, y, fill)
                notes.append(f"dropped a {len(cs)}-cell {ch} patch at {cs[0]}")


# ───────────────────────────── objects and the source map ─────────────────────────────

def objects() -> list[dict]:
    city = [[f"city_{j}_{i}" for i in range(4)] + [None] for j in range(4)]
    objs = [
        {"type": "deco", "parts": city, "x": CX, "y": CY, "offset": [24, 0], "collide": "alpha",
         # the four gates, one doorway cell each (N: the castle postern, W and E: the flank arches, S: the main arch)
         "walk_cells": [[N_WARP[0] - CX, 0], [0, 2], [4, 2], [2, 3]]},
        {"type": "prefab", "prefab": "temple_icon", "name": "temple", "x": TX, "y": TY, "w": 2, "h": 2, "door": 1,
         "ridge_rows": 0, "collide": "alpha", "enter": {"map": "temple-of-fiends", "entrance": "entry"}},
        # Erdrick's tomb: a stone sarcophagus between two broken columns, flowers and vines
        {"type": "deco", "parts": [["altar_l", "altar_r"]], "x": TOMB[0], "y": TOMB[1], "style": "stone"},
        {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": TOMB[0] - 1,
         "y": TOMB[1] - 1, "above_rows": 1},
        {"type": "deco", "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "x": TOMB[0] + 2,
         "y": TOMB[1] - 1, "above_rows": 1},
        {"type": "deco", "parts": [["vines"]], "x": TOMB[0], "y": TOMB[1] - 1, "block": False},
        {"type": "deco", "parts": [["vines"]], "x": TOMB[0] + 3, "y": TOMB[1], "block": False},
        {"type": "flowers", "x": TOMB[0] - 1, "y": TOMB[1] + 1},
        {"type": "flowers", "x": TOMB[0] + 2, "y": TOMB[1] + 1},
        {"type": "flowers", "x": TOMB[0] + 1, "y": TOMB[1] - 1},
    ]
    for x, y in [(20, 31), (37, 25), (11, 35)]:          # a few boulders on open grass, never on a road
        objs.append({"type": "deco", "parts": [["boulder"]], "x": x, "y": y, "collide": "alpha"})
    return objs


def main() -> None:
    g, notes = build()
    for x, y in [(20, 31), (37, 25), (11, 35)]:
        if g[x, y] != ".":
            raise SystemExit(f"boulder at ({x}, {y}) is on {g[x, y]!r}, not grass")
    canoe = next((x, RY + 5) for x in range(W) if g[x, RY + 5] == "r")      # on the east river below the bridge
    gate = "The bridge has collapsed into the sea. Only the King's builders could repair it."
    doc = {
        "id": "overworld",
        "kits": ["overworld", "town", "temple"],
        "music": "overworld",
        "terrain": "organic",
        "sealed_edges": True,
        "road_check": {"materials": ["dirt"], "ends": [list(TOMB_END)], "check_under": True},
        "warp_leaves": True,
        "min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2},
        "river_check": True,
        "art_coverage": True,
        "unreachable_ok": ["north_shore"],
        # `cornelia` first: safeSpawn moves old saves that are cut off from it (the act-1 component)
        "entrances": {"cornelia": list(ARRIVE["cornelia"]), "cornelia_west": list(ARRIVE["cornelia_west"]),
                      "cornelia_east": list(ARRIVE["cornelia_east"]), "cornelia_north": list(ARRIVE["cornelia_north"]),
                      "castle": list(ARRIVE["cornelia_north"]), "north_shore": list(NORTH_SHORE)},
        "objects": objects(),
        "inspect": [{"x": TOMB[0], "y": TOMB[1], "text": ["Here lies Erdrick."]},
                    {"x": TOMB[0] + 1, "y": TOMB[1], "text": ["Here lies Erdrick."]}],
        "keyItemGates": [{"x": x, "y": S_STUB, "requiredFlag": "BRIDGE_BUILT", "message": gate, "permanent": False}
                         for x in (BX, BX + 1)],
        "encounterRate": {"min": 15, "max": 30},
        "encounters": [{"enemies": ["goblin"], "weight": 4}, {"enemies": ["goblin", "goblin"], "weight": 3},
                       {"enemies": ["wolf"], "weight": 3}, {"enemies": ["wolf", "wolf"], "weight": 2},
                       {"enemies": ["skeleton"], "weight": 2}, {"enemies": ["goblin", "wolf"], "weight": 2},
                       {"enemies": ["pirate"], "weight": 1}],
        "battleBackgrounds": {"default": "grassland",
                              "terrain": {"forest": "forest", "desert": "desert", "swamp": "swamp", "water": "ocean",
                                          "river": "river", "sand": "desert"}},
        # OW-10 stays open: the ship waits off the jetty, the canoe on the east river
        "vehicles": [{"type": "ship", "x": JETTY[-1][0], "y": JETTY[-1][1] + 1, "requiredFlag": "BIKKE_DEFEATED"},
                     {"type": "canoe", "x": canoe[0], "y": canoe[1], "requiredFlag": "EARTH_CAVE_COMPLETE"}],
        "transitions": [{"x": N_WARP[0], "y": N_WARP[1], "targetMap": "cornelia", "targetEntrance": "castle_gate"},
                        {"x": W_WARP[0], "y": W_WARP[1], "targetMap": "cornelia", "targetEntrance": "west_gate"},
                        {"x": E_WARP[0], "y": E_WARP[1], "targetMap": "cornelia", "targetEntrance": "east_gate"},
                        {"x": S_WARP[0], "y": S_WARP[1], "targetMap": "cornelia", "targetEntrance": "south_gate"}],
    }
    for v in doc["vehicles"]:
        assert g[v["x"], v["y"]] in "or", f"vehicle {v['type']} at ({v['x']}, {v['y']}) is on {g[v['x'], v['y']]!r}"
    header = """GENERATED by assets-src/tools/layouts/overworld.py - edit the script, not this file.
Act-1 overworld (original layout): the Cornelia peninsula hangs south-west from the mainland; the sound, the broken
north bridge at its strait, the spine range sealing the isthmus, the east river from its tarn, Erdrick's tomb.
Compiled by assets-src/tools/build_map.py.
ground legend: . grass  f forest  m mountain  s sand  , dirt road  r river  o ocean  = bridge  ≈ lake"""
    print(write_map("overworld", header, doc, g.text()))
    for n in notes:
        print("  " + n)
    errs = check(g)
    if errs:
        raise SystemExit("overworld layout: " + "; ".join(errs))


if __name__ == "__main__":
    main()

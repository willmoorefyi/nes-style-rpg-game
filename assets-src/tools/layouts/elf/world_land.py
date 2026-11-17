"""Elfland's ground (docs/WORLD_PLAN.md 4.2; ELF-O): the north arm, the Elfland continent, the fens and the fells,
painted on the ELF region's bounding box (world x 0-111, y 112-191) in build_map legend chars.

Every shape is an original outline in world cells, roughened by seeded value noise (numpy only, no `random`), so the
output is the same on every run. `paint(band, seams)` returns the grid as `{(x, y): char}` for the region's own cells
(outside the bands); world_elf.py turns it into RegionOut.ground and adds the sites (layouts/elf/world_sites.py).
"""
from __future__ import annotations

import numpy as np

X0, Y0, X1, Y1 = 0, 112, 111, 191                 # the bounding box of ELF's two rects (world cells, inclusive)
W, H = X1 - X0 + 1, Y1 - Y0 + 1
ARM = (48, 112, 63, 143)                          # ELF's narrow rect: the north arm
SEED = 4207

# the continent (clockwise from the arm's root); the Aldi coast (x 62-109) is drawn separately, straight on y 146
MAIN = [(50, 143), (45, 147), (37, 146.5), (29, 148.5), (21, 147.5), (12, 151), (5.5, 155), (3.5, 161), (6, 167),
        (4.5, 173), (7.5, 179), (13, 184), (21, 186.5), (30, 186), (37, 183.5), (45, 186.5), (56, 187.5), (66, 186),
        (75, 187.5), (85, 185), (93, 182.5), (99, 178), (104, 172.5), (108, 168.5), (110, 166), (110, 145), (62, 145),
        (62, 143)]
FENS = [(31, 158), (40, 154.5), (50, 155.5), (60, 154), (67, 158), (68, 166), (63, 172.5), (52, 176), (41, 175),
        (33, 170)]
TARNS = [(38.5, 161.5, 2.6, 1.6), (45, 170.5, 2.2, 1.5), (60.5, 167.5, 2.8, 1.6), (49, 158.2, 1.8, 1.2)]
ELFWOOD = [(66, 151), (78, 152.5), (95, 151.5), (98, 158), (96, 168), (86, 173), (74, 171), (68, 163)]
WESTWOOD = [(7, 156), (17, 151.5), (28, 152.5), (30, 160), (27, 171), (18, 180), (9, 176)]
GREYFELLS = [(42, 181), (55, 178.5), (68, 179.5), (80, 177), (92, 175.5), (99, 171.5)]   # the southern spine
FELLS_EAST = 99.5                                 # the east fells: mountains east of this x, y 146-168 (seam_s's side)
HARBOUR = [(x, 146) for x in range(82, 88)] + [(x, 147) for x in range(83, 87)]       # Elfheim's bay (aldi water)
COVE = [(x, 146) for x in range(66, 71)] + [(x, 147) for x in range(67, 70)]          # a second Aldi cove
TOR_RIDGE = (127, 140)                            # the arm's tors on its ocean side (rows)


def _edge(y: int) -> float:
    """The east fells' ragged west edge: a cell offset per row."""
    return 2.6 * np.sin(y * 0.55) + 1.4 * np.sin(y * 1.7 + 1.0)


def _noise(cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 on the box (bilinear with smoothstep)."""
    g = np.random.default_rng(seed).random((int(H / cell) + 3, int(W / cell) + 3))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    fy, fx = (yy + 0.5) / cell, (xx + 0.5) / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def _fbm(seed: int) -> np.ndarray:
    return _noise(6, seed) * 0.6 + _noise(3, seed + 1) * 0.3 + _noise(1.5, seed + 2) * 0.1 - 0.5


def _grid() -> tuple[np.ndarray, np.ndarray]:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    return xx + X0 + 0.5, yy + Y0 + 0.5


def signed(pts: list[tuple[float, float]]) -> np.ndarray:
    """Per cell centre: the distance to the polygon's outline, positive inside."""
    px, py = _grid()
    best, inside = np.full((H, W), np.inf), np.zeros((H, W), bool)
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
        if y0 != y1:
            inside ^= ((y0 > py) != (y1 > py)) & (px < x0 + (py - y0) * dx / dy)
    return np.where(inside, best, -best)


def along(pts: list[tuple[float, float]]) -> np.ndarray:
    """Per cell centre: the distance to the polyline."""
    px, py = _grid()
    best = np.full((H, W), np.inf)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
    return best


def arm_edges(y: int) -> tuple[int, int]:
    """The arm's west and east coast columns on row y (inclusive land): the ocean side wavers by up to 2 cells, the
    Aldi side by 1, and the keep's stretch (rows 120-129) reaches the last writable column."""
    w = 50 + (0 if y < 118 else (1, 2, 2, 1, 0, 0, 1, 1)[(y * 5 // 7) % 8])
    e = 61 if 118 <= y <= 130 or y < 116 else 61 - (0, 1, 1, 0, 0, 1)[(y * 3 // 5) % 6]
    return w, e


def paint(band: set[tuple[int, int]]) -> dict[tuple[int, int], str]:
    """The region's ground: `{(x, y): char}` for every cell of ELF's rects outside the bands."""
    n1, n2, n3 = _fbm(SEED), _fbm(SEED + 10), _fbm(SEED + 20)
    land = signed(MAIN) + n1 * 3.0 > 0.6
    fens = signed(FENS) + n2 * 3.0 > 0
    elfwood = (signed(ELFWOOD) + n3 * 3.5 > 0) & (n1 > -0.16)       # glades where the noise dips
    westwood = (signed(WESTWOOD) + n3 * 3.5 > 0) & (n2 > -0.14)
    fells = (along(GREYFELLS) + n2 * 2.0) < 1.9
    out: dict[tuple[int, int], str] = {}
    for j in range(H):
        for i in range(W):
            x, y = X0 + i, Y0 + j
            if (x, y) in band or not (ARM[0] <= x <= ARM[2] and y <= ARM[3]) and y < 144:
                continue
            if y <= ARM[3] or (y <= 145 and x < 62):
                w, e = arm_edges(min(y, 143))
                ch = "." if w <= x <= e else "o"
            elif x >= 62 and y <= 149 and x <= 109:
                ch = "." if y >= 146 else "o"            # the straight Aldi coast; coves are cut below
            elif x >= 104 and y <= 167 or x > FELLS_EAST + _edge(y) and y <= 166 - (104 - x) // 2:
                ch = "m"                                 # the east fells always stand: they wall the Aldi at seam_s
            else:
                ch = "." if land[j, i] else "o"
            if ch == "o":
                out[(x, y)] = ch
                continue
            if fens[j, i]:
                ch = "w"
            elif elfwood[j, i] or westwood[j, i]:
                ch = "f"
            if fells[j, i] or (x > FELLS_EAST + _edge(y) and y <= 166 - (104 - x) // 2):
                ch = "m"
            out[(x, y)] = ch
    for x, y in HARBOUR + COVE:
        out[(x, y)] = "o"
    for y in range(*TOR_RIDGE):                     # the tors: a broken ridge on the arm's ocean side
        w, _ = arm_edges(y)
        for x in range(w, w + 3 - (1 if y % 5 == 0 else 0)):
            out[(x, y)] = "m"
    for cx, cy, rx, ry in TARNS:                    # the fens' tarns (Lake: no Water cell outside a basin)
        for (x, y), ch in list(out.items()):
            if ch != "o" and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                out[(x, y)] = "≈"
    return out


def beaches(out: dict[tuple[int, int], str], band: set[tuple[int, int]]) -> None:
    """Sand on the outer coasts: a land cell next to ocean (or an ocean band cell) south or west of the fens'
    latitude, plus the harbour's quay row. Mountains, swamp and lakes keep their char."""
    def wet(c: tuple[int, int]) -> bool:
        return out.get(c) == "o" or (c in band and c[1] >= 146)
    for (x, y), ch in sorted(out.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if ch not in ".f" or y < 150 and x >= 62:
            continue
        if any(wet((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (x + 2 * y) % 7 != 0:
            out[(x, y)] = "s"
    for x in range(81, 89):
        if out.get((x, 148)) in (".", "f"):
            out[(x, 148)] = "s"


def _comps(out: dict[tuple[int, int], str], ch: str) -> list[list[tuple[int, int]]]:
    seen: set[tuple[int, int]] = set()
    comps = []
    for c in sorted((c for c, v in out.items() if v == ch), key=lambda c: (c[1], c[0])):
        if c in seen:
            continue
        comp, stack = [c], [c]
        seen.add(c)
        while stack:
            x, y = stack.pop()
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n not in seen and out.get(n) == ch:
                    seen.add(n)
                    comp.append(n)
                    stack.append(n)
        comps.append(comp)
    return comps


def tidy(out: dict[tuple[int, int], str], band: set[tuple[int, int]], seams: set[tuple[int, int]]) -> None:
    """The map checks' minimums (min_blob): no forest, sand, swamp or mountain patch under 3 cells (it becomes
    grass), and no ocean run of 1 cell closed by land on both sides (it becomes sand, then the sand rule runs)."""
    def wet(c: tuple[int, int]) -> bool:
        return out.get(c) == "o" or (c in band and c not in seams)
    for _ in range(4):
        for c in sorted((c for c, v in out.items() if v == "o"), key=lambda c: (c[1], c[0])):
            x, y = c
            for dx, dy in ((1, 0), (0, 1)):
                if not wet((x - dx, y - dy)) and not wet((x + dx, y + dy)):
                    out[c] = "s"
        for ch in "fswm":
            for comp in _comps(out, ch):
                if len(comp) < 3:
                    for c in comp:
                        out[c] = "."

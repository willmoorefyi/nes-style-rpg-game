"""Grid geometry of the NW generator (docs/NATURAL_WORLD_PLAN.md 3.1, 3.2): signed polygon and polyline distances,
4-connected rasters, the signed Euclidean distance of a mask, bilinear sampling, floods, BFS distances, components
and discs, on the 256x256 world grid of `noise.py`. NW-0's pilot math unchanged (NW-2 reproduces preset B with it).

Determinism (2.5): numpy only, row-major loops, no set iteration.
"""
from __future__ import annotations

from collections import deque

import numpy as np

from .noise import N, XX, YY

D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
Pt = tuple[float, float]


def sdist(poly: list[Pt], px: np.ndarray | None = None, py: np.ndarray | None = None) -> np.ndarray:
    """Signed distance to a closed polygon (world coordinates): + inside, - outside."""
    px = XX + .5 if px is None else px
    py = YY + .5 if py is None else py
    best = np.full(px.shape, np.inf)
    inside = np.zeros(px.shape, bool)
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
        if y0 != y1:
            inside ^= ((y0 > py) != (y1 > py)) & (px < x0 + (py - y0) * dx / dy)
    return np.where(inside, best, -best)


def pline(pts: list[Pt], px: np.ndarray | None = None, py: np.ndarray | None = None) -> np.ndarray:
    """Distance to an open polyline (world coordinates)."""
    px = XX + .5 if px is None else px
    py = YY + .5 if py is None else py
    best = np.full(px.shape, np.inf)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
    return best


def raster_line(pts: list[Pt]) -> list[tuple[int, int]]:
    """The 4-connected cells along a polyline (cell coordinates), in order, no repeats."""
    out: list[tuple[int, int]] = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        x, y = int(round(x0)), int(round(y0))
        x1, y1 = int(round(x1)), int(round(y1))
        n = max(abs(x1 - x), abs(y1 - y), 1) * 4
        for i in range(n + 1):
            t = i / n
            cx = int(round(x + (x1 - x) * t))
            cy = int(round(y + (y1 - y) * t))
            if out and (cx, cy) == out[-1]:
                continue
            if out:
                px, py = out[-1]
                if cx != px and cy != py:           # a diagonal step: insert the orthogonal one
                    out.append((cx, py))
            out.append((cx, cy))
    return out


def edt_signed(mask: np.ndarray) -> np.ndarray:
    """Signed Euclidean distance of a boolean mask: + inside (to the nearest outside cell), - outside."""
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    edge2 = ~mask & (np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1))
    pts = np.argwhere(edge | edge2).astype(float) + .5
    if not len(pts):
        return np.where(mask, 1e3, -1e3)
    cy, cx = YY.ravel() + .5, XX.ravel() + .5
    best = np.full(cy.shape, np.inf)
    for i in range(0, len(pts), 256):
        p = pts[i:i + 256]
        d = np.hypot(cy[:, None] - p[None, :, 0], cx[:, None] - p[None, :, 1]).min(axis=1)
        best = np.minimum(best, d)
    best = best.reshape(mask.shape) - .5
    return np.where(mask, best, -best)


def bilinear(a: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
    """Sample a raster at fractional cell-centre coordinates (clamped at its edges)."""
    fx = np.clip(px - .5, 0, a.shape[1] - 1.001)
    fy = np.clip(py - .5, 0, a.shape[0] - 1.001)
    x0, y0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - x0, fy - y0
    return ((a[y0, x0] * (1 - tx) + a[y0, x0 + 1] * tx) * (1 - ty)
            + (a[y0 + 1, x0] * (1 - tx) + a[y0 + 1, x0 + 1] * tx) * ty)


def flood(passable: np.ndarray, seeds) -> np.ndarray:
    """BFS from (x, y) seeds over a boolean grid (4-connected); the reached mask."""
    seen = np.zeros(passable.shape, bool)
    h, w = passable.shape
    q: deque = deque()
    for x, y in seeds:
        if 0 <= x < w and 0 <= y < h and passable[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in D4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    return seen


def bfs_dist(passable: np.ndarray, seeds) -> np.ndarray:
    """Step distances (4-connected) from (x, y) seeds; -1 where unreachable."""
    dist = np.full(passable.shape, -1, int)
    q: deque = deque()
    for x, y in seeds:
        if passable[y, x] and dist[y, x] < 0:
            dist[y, x] = 0
            q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in D4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < passable.shape[1] and 0 <= ny < passable.shape[0] and passable[ny, nx] and dist[ny, nx] < 0:
                dist[ny, nx] = dist[y, x] + 1
                q.append((nx, ny))
    return dist


def components(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """4-connected components, labelled in row-major order of their first cell: (labels, sizes), label 0 =
    background."""
    lab = np.zeros(mask.shape, int)
    sizes = [0]
    k = 0
    for y, x in np.argwhere(mask):
        if lab[y, x]:
            continue
        k += 1
        lab[y, x] = k
        q = deque([(x, y)])
        n = 0
        while q:
            cx, cy = q.popleft()
            n += 1
            for dx, dy in D4:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = k
                    q.append((nx, ny))
        sizes.append(n)
    return lab, np.array(sizes)


def disc(cx: float, cy: float, r: float) -> np.ndarray:
    """The cells whose centre lies within r of cell (cx, cy)'s centre."""
    return np.hypot(XX + .5 - (cx + .5), YY + .5 - (cy + .5)) <= r


def ring1(mask: np.ndarray) -> np.ndarray:
    """The mask plus its one-cell 4-ring (0.1.1's exemption ring)."""
    out = mask.copy()
    for s, a in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        out |= np.roll(mask, s, a)
    return out


__all__ = ["N", "D4", "sdist", "pline", "raster_line", "edt_signed", "bilinear", "flood", "bfs_dist", "components",
           "disc", "ring1"]

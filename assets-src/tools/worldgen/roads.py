"""Stage `roads` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rule 8): roads are routed, not drawn.

A pinned road (a region spec's `roads`: ordered ends) is laid after the biomes by A* on the generated ground: grass 1,
road 0.6, tundra 1.2, snow 1.5, sand or forest 2, swamp 4, a bridge or ford 1; mountain, water and river cells are
refused (except the road's own end). Ties are broken by (cost, y, x) in the heap. The laid cells become dirt `,`
where they were open ground. NW-0's pilot router, unchanged.
"""
from __future__ import annotations

import heapq

import numpy as np

from .noise import N

COST = {".": 1, ",": 0.6, ":": 0.6, "s": 2, "f": 2, "t": 1.2, "n": 1.5, "w": 4, "=": 1}
PAVED = ".sftnw"                             # the chars a laid road turns into dirt `,`


def astar(g: np.ndarray, a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]] | None:
    """The cheapest 4-connected path from a to b, or None."""
    (ax, ay), (bx, by) = a, b
    pq = [(0, ay, ax)]
    best = {(ax, ay): 0}
    came = {}
    while pq:
        _f, y, x = heapq.heappop(pq)
        if (x, y) == (bx, by):
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < N and 0 <= ny < N):
                continue
            c = COST.get(g[ny, nx])
            if c is None and (nx, ny) != (bx, by):
                continue
            nc = best[(x, y)] + (c or 1)
            if nc < best.get((nx, ny), 1e18):
                best[(nx, ny)] = nc
                came[(nx, ny)] = (x, y)
                heapq.heappush(pq, (nc + abs(nx - bx) + abs(ny - by), ny, nx))
    if (bx, by) not in came:
        return None
    path, c = [], (bx, by)
    while c != (ax, ay):
        path.append(c)
        c = came[c]
    return [(ax, ay)] + path[::-1]


def lay(g: np.ndarray, roads: list[list[tuple[int, int]]]) -> list[bool]:
    """Lay every road (its ends in world cells) on `g` in place; per road, whether every leg was routed."""
    ok = []
    for pts in roads:
        routed = True
        for a, b in zip(pts, pts[1:]):
            path = astar(g, a, b)
            if path is None:
                routed = False
                continue
            for x, y in path:
                if g[y, x] in PAVED:
                    g[y, x] = ","
        ok.append(routed)
    return ok

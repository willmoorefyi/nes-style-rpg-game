"""Elfland's king's road on the NW world (docs/NATURAL_WORLD_PLAN.md 2.4 rule 8; NW-R ELF): Elfheim's gate to the
Western Keep's arrival and to the Marsh Cave's, routed on the generated ground after the icons are stamped.

The router is `worldgen.roads.astar`'s (its costs: grass 1, road 0.6, sand or forest 2, swamp 4, a ford 1; mountain,
water and river refused), with each step's cost scaled by a smooth noise field in [1 - WOBBLE, 1 + WOBBLE]: on open
grass every path costs the same and the heap's (y, x) tie-break alone lays straight L-shaped roads; the noise bends
them like a worn track. The objects' cells are refused, so the road never runs under an icon.
"""
from __future__ import annotations

import heapq

import numpy as np

from worldgen import roads as R
from worldgen.noise import fbm

WOBBLE, ROAD_SEED = 0.7, 1987 + 151          # the step-cost noise (x 1 +- WOBBLE) and its seed


def astar(g: np.ndarray, a: tuple[int, int], b: tuple[int, int], wob: np.ndarray) -> list[tuple[int, int]] | None:
    """The cheapest 4-connected path from a to b under the noisy costs, or None."""
    (ax, ay), (bx, by) = a, b
    pq, best, came = [(0.0, ay, ax)], {(ax, ay): 0.0}, {}
    h, w = g.shape
    while pq:
        _f, y, x = heapq.heappop(pq)
        if (x, y) == (bx, by):
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            c = R.COST.get(g[ny, nx])
            if c is None and (nx, ny) != (bx, by):
                continue
            nc = best[(x, y)] + (c or 1) * wob[ny, nx]
            if nc < best.get((nx, ny), 1e18):
                best[(nx, ny)] = nc
                came[(nx, ny)] = (x, y)
                heapq.heappush(pq, (nc + (1 - WOBBLE) * (abs(nx - bx) + abs(ny - by)), ny, nx))
    if (bx, by) not in came:
        return None
    path, c = [], (bx, by)
    while c != (ax, ay):
        path.append(c)
        c = came[c]
    return [(ax, ay)] + path[::-1]


def route(g: np.ndarray, blocked: set, a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]] | None:
    """The road from a to b with the `blocked` (object) cells refused, paved to dirt `,` in `g`; None if unroutable."""
    gg = g.copy()
    for x, y in blocked:
        gg[y, x] = "o"
    wob = 1 + WOBBLE * np.clip(2 * fbm(ROAD_SEED, (6, 3, 1.5)), -1, 1)
    path = astar(gg, a, b, wob)
    for x, y in path or []:
        if g[y, x] in R.PAVED:
            g[y, x] = ","
    return path

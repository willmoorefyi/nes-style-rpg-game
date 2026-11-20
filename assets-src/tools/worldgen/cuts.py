"""The minimal cuts of the travel gates (docs/NATURAL_WORLD_PLAN.md 3.8, 4.5; NW-4), exported as `world.cuts`.

The mutation suite opens them (WORLD 6.3 GT-13, GT-35: `questMutateFind.cutOpen`): a wall's cut is set to Water, a
barrier's to Grass, and the verifier must then catch the skip. So each cut is the **fewest** cells that, opened, make
the leak the gate prevents:

- `min_cut(free, cost, sources, targets)`: a 0-1 search where a `cost` cell costs 1, a `free` cell 0 and the rest is
  closed; the cut cells of the cheapest path, in path order ([] when nothing joins). Sources are seeded row-major and
  the queue is FIFO per cost (world_geom.min_cut's rule on numpy grids of any size), so the result is deterministic.
- `vertex_cut(free, a, b)`: the minimum vertex separator of two cells on a walk grid (unit capacities, augmenting
  paths): the spine's cut with the bridge patch on must be exactly bridge patch cells (3.8 `barriers`).
"""
from __future__ import annotations

from collections import deque

import numpy as np

from .geom import D4

INF = 1 << 30


def min_cut(free: np.ndarray, cost: np.ndarray, sources: np.ndarray, targets: np.ndarray,
            via: np.ndarray | None = None) -> list[tuple[int, int]]:
    """`via`: the path must cross at least one of these cells (a wall's or a barrier's own cells): the search runs on
    two layers, the second entered at a `via` cell, and ends only on the second."""
    h, w = free.shape
    layers = 1 if via is None else 2
    dist = np.full((layers, h, w), INF, np.int64)
    prev: dict[tuple[int, int, int], tuple[int, int, int] | None] = {}
    q: deque = deque()
    for y, x in np.argwhere(sources):
        lay = 0 if via is None or not via[y, x] else 1
        dist[lay, y, x] = 0
        prev[(int(x), int(y), lay)] = None
        q.append((0, int(x), int(y), lay))
    end = None
    while q:
        d, x, y, lay = q.popleft()
        if d != dist[lay, y, x]:
            continue
        if targets[y, x] and lay == layers - 1:
            end = (x, y, lay)
            break
        for dx, dy in D4:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            c = 1 if cost[ny, nx] else 0 if free[ny, nx] else None
            nl = 1 if via is not None and (lay or via[ny, nx]) else 0
            if c is None or dist[nl, ny, nx] <= d + c:
                continue
            dist[nl, ny, nx] = d + c
            prev[(nx, ny, nl)] = (x, y, lay)
            if c:
                q.append((d + c, nx, ny, nl))
            else:
                q.appendleft((d, nx, ny, nl))
    path = []
    while end is not None:
        if cost[end[1], end[0]]:
            path.append(end[:2])
        end = prev[end]
    return path[::-1]


def vertex_cut(free: np.ndarray, a: tuple[int, int], b: tuple[int, int], cap: int = 8) -> list[tuple[int, int]] | None:
    """The minimum vertex separator of a and b over `free` cells (a and b excluded), row-major; None when it has more
    than `cap` cells (no narrow cut) and [] when a and b are already apart. Each cell is split into in / out with
    capacity 1 (a and b unbounded); neighbours join out -> in with unbounded capacity."""
    h, w = free.shape
    used = np.zeros((h, w), bool)                 # the cell's in -> out edge carries flow
    flow: dict[tuple[int, int, int, int], int] = {}   # (x, y, nx, ny): flow on out(x, y) -> in(nx, ny)

    def special(x, y):
        return (x, y) in (a, b)

    def augment() -> tuple[bool, np.ndarray]:
        seen = np.zeros((h, w, 2), bool)          # side 0 = in, 1 = out
        prev: dict[tuple[int, int, int], tuple[int, int, int] | None] = {(a[0], a[1], 1): None}
        seen[a[1], a[0], 1] = True
        q = deque([(a[0], a[1], 1)])
        while q:
            x, y, s = q.popleft()
            if (x, y) == b:
                node = (x, y, s)
                while prev[node] is not None:      # push one unit back along the path
                    px, py, ps = prev[node]
                    nx, ny, ns = node
                    if (px, py) == (nx, ny):
                        if not special(nx, ny):
                            used[ny, nx] = ps == 0
                    elif ps == 1:
                        flow[(px, py, nx, ny)] = flow.get((px, py, nx, ny), 0) + 1
                    else:
                        flow[(nx, ny, px, py)] -= 1
                    node = prev[node]
                return True, seen
            nxt = []
            if s == 0:
                if special(x, y) or not used[y, x]:
                    nxt.append((x, y, 1))
                nxt += [(x + dx, y + dy, 1) for dx, dy in D4 if flow.get((x + dx, y + dy, x, y), 0) > 0]
            else:
                if not special(x, y) and used[y, x]:
                    nxt.append((x, y, 0))
                nxt += [(x + dx, y + dy, 0) for dx, dy in D4
                        if 0 <= x + dx < w and 0 <= y + dy < h and free[y + dy, x + dx]]
            for n in nxt:
                if not seen[n[1], n[0], n[2]]:
                    seen[n[1], n[0], n[2]] = True
                    prev[n] = (x, y, s)
                    q.append(n)
        return False, seen

    for _ in range(cap + 1):
        ok, seen = augment()
        if not ok:
            # the cut: cells whose in side is reached and out side is not (their unit edge is saturated)
            cut = seen[..., 0] & ~seen[..., 1] & used
            return [(int(x), int(y)) for y, x in np.argwhere(cut)]
    return None

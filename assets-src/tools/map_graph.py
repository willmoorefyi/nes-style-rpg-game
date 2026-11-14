"""Walk-graph helpers for the map checks (map_checks.py) and the map report (map_report.py).

Collision values are TerrainType (src/types/index.ts); BLOCKED is what blocks on foot.
"""
from __future__ import annotations

from collections import deque
from typing import Iterable

import numpy as np

WALL, WATER, MOUNTAIN, RIVER, COUNTER = 1, 2, 3, 7, 10
BLOCKED = frozenset({WALL, WATER, COUNTER, MOUNTAIN, RIVER})
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))

Cell = tuple[int, int]


def walkable(coll: np.ndarray, x: int, y: int) -> bool:
    return 0 <= y < coll.shape[0] and 0 <= x < coll.shape[1] and int(coll[y, x]) not in BLOCKED


def reach(coll: np.ndarray, starts: Iterable[Iterable[int]], blocked: frozenset | set = frozenset()) -> set[Cell]:
    """Cells reachable on foot from any start (4-connected), never entering a `blocked` cell."""
    seen: set[Cell] = set()
    q: deque[Cell] = deque()
    for s in starts:
        s = (int(s[0]), int(s[1]))
        if s not in seen and s not in blocked:
            seen.add(s)
            q.append(s)
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n not in seen and n not in blocked and walkable(coll, *n):
                seen.add(n)
                q.append(n)
    return seen


def distances(coll: np.ndarray, start: Iterable[int], blocked: frozenset | set = frozenset()) -> dict[Cell, int]:
    start = (int(start[0]), int(start[1]))
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n not in dist and n not in blocked and walkable(coll, *n):
                dist[n] = dist[(x, y)] + 1
                q.append(n)
    return dist


def static_npc_cells(npcs: list[dict]) -> set[Cell]:
    return {(n["x"], n["y"]) for n in npcs if not n.get("wander")}


def talkable(coll: np.ndarray, npc: dict, seen: set[Cell]) -> bool:
    """A reachable 4-neighbour, or a reachable cell straight across a counter."""
    x, y = npc["x"], npc["y"]
    for dx, dy in DIRS:
        a, b = (x + dx, y + dy), (x + 2 * dx, y + 2 * dy)
        if a in seen:
            return True
        if 0 <= a[1] < coll.shape[0] and 0 <= a[0] < coll.shape[1] and int(coll[a[1], a[0]]) == COUNTER and b in seen:
            return True
    return False


def articulation_points(coll: np.ndarray, start: Iterable[int], blocked: frozenset | set = frozenset()) -> set[Cell]:
    """Single cells whose blocking splits the walkable component of `start` (iterative Tarjan)."""
    start = (int(start[0]), int(start[1]))
    if start in blocked or not walkable(coll, *start):
        return set()
    disc: dict[Cell, int] = {start: 0}
    low: dict[Cell, int] = {start: 0}
    parent: dict[Cell, Cell | None] = {start: None}
    aps: set[Cell] = set()
    root_children = 0
    t = 1

    def nbrs(c: Cell):
        return [(c[0] + dx, c[1] + dy) for dx, dy in DIRS
                if (c[0] + dx, c[1] + dy) not in blocked and walkable(coll, c[0] + dx, c[1] + dy)]

    stack = [(start, iter(nbrs(start)))]
    while stack:
        v, it = stack[-1]
        advanced = False
        for w in it:
            if w not in disc:
                parent[w] = v
                disc[w] = low[w] = t
                t += 1
                if v == start:
                    root_children += 1
                stack.append((w, iter(nbrs(w))))
                advanced = True
                break
            if w != parent[v]:
                low[v] = min(low[v], disc[w])
        if advanced:
            continue
        stack.pop()
        p = parent[v]
        if p is not None:
            low[p] = min(low[p], low[v])
            if p != start and low[v] >= disc[p]:
                aps.add(p)
    if root_children > 1:
        aps.add(start)
    return aps


def components(mask: np.ndarray) -> list[list[Cell]]:
    """4-connected components of a boolean cell mask, in scan order."""
    hgt, wid = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(hgt):
        for x in range(wid):
            if not mask[y, x] or seen[y, x]:
                continue
            comp, q = [], deque([(x, y)])
            seen[y, x] = True
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in DIRS:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < wid and 0 <= ny < hgt and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            out.append(comp)
    return out


def edge_cells(width: int, height: int) -> list[Cell]:
    return [(x, y) for y in range(height) for x in range(width) if x in (0, width - 1) or y in (0, height - 1)]

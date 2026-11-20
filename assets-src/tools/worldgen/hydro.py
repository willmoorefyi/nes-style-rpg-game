"""Stage `hydro` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rules 4 and 4b): rivers that flow downhill.

A priority flood from every coast cell fills the pits (heap ties broken by (elevation, y, x)) and gives each land
cell its D8 receiver; a rain field (fbm and moisture) is accumulated down the flow; rivers are the cells whose
accumulation exceeds `a_r` (below mountain height, outside the banned walls, pins and kept cells), made 4-connected by
the diagonal fix-up (the canoe moves orthogonally); pits deeper than `d_l` become lakes. The pinned canoe routes are
laid by the composer over the result; `tarns` ends a river that reaches neither the sea nor a lake. `fords`: an
unpinned river crossing a walking corridor gets a ford (a bridge
cell `=` on the corridor's centre line) at most `max_fords` times; any further crossing is cut to grass. NW-0's pilot
math, unchanged.
"""
from __future__ import annotations

import heapq

import numpy as np

from .geom import components
from .noise import N, fbm

D8 = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))
A_R = 55                                     # accumulation threshold of a river cell
RIVER_MAX_ELEV = 0.75
MIN_RIVER = 6                                # river components under this many cells are dropped
D_L, LAKE_MAX_ELEV, MIN_LAKE = 0.035, 0.6, 5  # a filled pit deeper than d_l (and low enough, big enough) is a lake


def flow(land: np.ndarray, elev: np.ndarray):
    """(fill, receiver y, receiver x, order) of the priority flood from every water cell."""
    fill = np.where(land, elev, -1.0).copy()
    seen = ~land.copy()
    ry = np.full((N, N), -1, int)
    rx = np.full((N, N), -1, int)
    pq: list = []
    for y in range(N):
        for x in range(N):
            if not land[y, x]:
                continue
            for dx, dy in D8[:4]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and not land[ny, nx]:
                    heapq.heappush(pq, (fill[y, x], y, x))
                    seen[y, x] = True
                    ry[y, x], rx[y, x] = ny, nx
                    break
    order = []
    while pq:
        e, y, x = heapq.heappop(pq)
        order.append((y, x))
        for dx, dy in D8:
            nx, ny = x + dx, y + dy
            if 0 <= nx < N and 0 <= ny < N and not seen[ny, nx]:
                seen[ny, nx] = True
                fill[ny, nx] = max(fill[ny, nx], e + 1e-4)
                ry[ny, nx], rx[ny, nx] = y, x
                heapq.heappush(pq, (fill[ny, nx], ny, nx))
    return fill, ry, rx, order


def rivers(land: np.ndarray, elev: np.ndarray, moist: np.ndarray, seed: int, banned: np.ndarray, thr: float = A_R):
    """(river, lake, accumulation) masks."""
    fill, ry, rx, order = flow(land, elev)
    rain = np.clip(0.5 + 0.8 * fbm(seed + 51) + 0.6 * moist, 0.1, 1.6)
    acc = np.where(land, rain, 0.0)
    for y, x in reversed(order):
        py, px = ry[y, x], rx[y, x]
        if py >= 0 and land[py, px]:
            acc[py, px] += acc[y, x]
    river = land & (acc > thr) & (elev < RIVER_MAX_ELEV) & ~banned
    add = []                                 # 4-connect: a diagonal step gets its orthogonal cell (the lower one)
    for y, x in np.argwhere(river):
        py, px = ry[y, x], rx[y, x]
        if py < 0:
            continue
        if py != y and px != x:
            a, b = (y, px), (py, x)
            add.append(a if elev[a] <= elev[b] else b)
    for c in add:
        if land[c] and not banned[c]:
            river[c] = True
    lab, sz = components(river)
    river &= (sz >= MIN_RIVER)[lab]
    pit = land & (fill - elev > D_L) & ~banned & (elev < LAKE_MAX_ELEV)
    lab, sz = components(pit)
    lake = pit & (sz >= MIN_LAKE)[lab]
    return river, lake, acc


def tarns(g: np.ndarray, elev: np.ndarray, frozen: np.ndarray) -> int:
    """2.4 rule 4: a river ends in the sea or a lake. A river course (its `r` cells and fords) that touches neither
    ends in a one-cell tarn: its lowest unfrozen cell becomes lake `≈` (ties by (y, x)). Returns the tarns made."""
    lab, sz = components(np.isin(g, ["r", "="]))
    wet = np.isin(g, ["o", "≈"])
    near = wet.copy()
    near[1:, :] |= wet[:-1, :]
    near[:-1, :] |= wet[1:, :]
    near[:, 1:] |= wet[:, :-1]
    near[:, :-1] |= wet[:, 1:]
    made = 0
    for k in range(1, len(sz)):
        m = lab == k
        if (near & m).any():
            continue
        cells = [(float(elev[y, x]), y, x) for y, x in np.argwhere(m & (g == "r") & ~frozen)]
        if cells:
            _, y, x = min(cells)
            g[y, x] = "≈"
            made += 1
    return made


def fords(grid: np.ndarray, corridors: dict, routes_cells: list, keep: np.ndarray, limits: dict | None = None):
    """2.4 rule 4b on `grid` (in place). Returns ({corridor: [ford cells]}, the number of crossings cut)."""
    out, cut = {}, 0
    pinned = set(routes_cells)
    for name, cells in corridors.items():
        max_fords = (limits or {}).get(name, 2)
        line = set(cells)
        band = {(x + dx, y + dy) for x, y in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        crossings, seen = [], set()
        for c in cells:
            x, y = c
            if grid[y, x] == "r" and c not in seen and c not in pinned and not keep[y, x]:
                comp, stack = [], [c]
                while stack:
                    q = stack.pop()
                    if q in seen or q not in band or grid[q[1], q[0]] != "r" or keep[q[1], q[0]]:
                        continue
                    seen.add(q)
                    comp.append(q)
                    for dx, dy in D8[:4]:
                        stack.append((q[0] + dx, q[1] + dy))
                crossings.append(comp)
        crossings.sort(key=len)
        fl = []
        for i, comp in enumerate(crossings):
            if i < max_fords:
                for q in comp:
                    if q in line:
                        grid[q[1], q[0]] = "="
                        fl.append(q)
            else:
                cut += 1
                for q in comp:
                    grid[q[1], q[0]] = "."
        out[name] = fl
    return out, cut

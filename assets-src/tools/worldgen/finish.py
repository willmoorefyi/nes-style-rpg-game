"""The last tidy (docs/NATURAL_WORLD_PLAN.md 3.1 biomes' tidy, 2.4 rule 9; NW-0's `finish.py`).

`seal`: stray water (a pocket the stamps left, not one of the basins) becomes grass (under 6 cells) or lake.
`jog`: any coast run (G-NW1) or chunk-line class run longer than 6 edges outside the exemptions gets a one-cell jog
near its midpoint (every 6 edges along it): a sea cell becomes land of its neighbour's char, or a land cell becomes
sea where the sea side is forced sea; a chunk-line cell takes its neighbour's class. At most 10 rounds; it never
touches a pin, stamp, exempt or forced cell. The count is reported (`--metrics`); over JOG_WARN is a warning that a
spec has a straight edge to fix at its source.
"""
from __future__ import annotations

import numpy as np

from . import metrics
from .geom import components

JOG_WARN = 100
ROUNDS = 10


def seal(g: np.ndarray, gap: list, seeds: list) -> int:
    """Seal stray water in place (with the `gap` cells, the bridge's gap rows, open); returns the cells changed."""
    h = g.copy()
    for x, y in gap:
        h[y, x] = "o"
    lab, sz = components(h == "o")
    keep = {int(lab[y, x]) for x, y in seeds}
    n = 0
    for k in range(1, len(sz)):
        if k in keep:
            continue
        m = (lab == k) & (g == "o")
        g[m] = "." if sz[k] < 6 else "≈"
        n += int(m.sum())
    return n


def _coast_jog(g, line, s, ln, k, frozen, keep, exempt, cores) -> int:
    n = 0
    for j0 in range(s + 3, s + ln - 3, 6) if ln > 6 else []:
        for j in sorted(range(max(s + 1, j0 - 2), min(s + ln - 1, j0 + 3)), key=lambda q: abs(q - j0)):
            c1, c2 = ((j, line), (j, line + 1)) if k == "v" else ((line, j), (line + 1, j))
            sea_c, land_c = (c1, c2) if g[c1] == "o" else (c2, c1)
            dy, dx = sea_c[0] - land_c[0], sea_c[1] - land_c[1]
            wide = 0                                 # open water beyond the bumped cell, across the run
            y, x = sea_c[0] + dy, sea_c[1] + dx
            while 0 <= y < g.shape[0] and 0 <= x < g.shape[1] and g[y, x] == "o" and wide < 6:
                wide += 1
                y, x = y + dy, x + dx
            thick = 0                                # land behind the cut cell (a wall stays >= 3 wide)
            y, x = land_c[0] - dy, land_c[1] - dx
            while 0 <= y < g.shape[0] and 0 <= x < g.shape[1] and g[y, x] not in "o≈r" and thick < 4:
                thick += 1
                y, x = y - dy, x - dx
            if not frozen[sea_c] or (wide >= 4 and not keep[sea_c] and not exempt[sea_c]):
                g[sea_c] = g[land_c] if g[land_c] in ".fstm" else "."
            elif not frozen[land_c] and not cores[land_c] and thick >= 3:
                g[land_c] = "o"
            else:
                continue
            n += 1
            break
    return n


def _chunk_jog(g, line, s, ln, k, frozen) -> int:
    n = 0
    for j0 in range(s + 3, s + ln - 3, 6) if ln > 6 else []:
        for j in sorted(range(max(s + 1, j0 - 2), min(s + ln - 1, j0 + 3)), key=lambda q: abs(q - j0)):
            c1, c2 = ((j, line - 1), (j, line)) if k == "v" else ((line - 1, j), (line, j))
            a, b = g[c1], g[c2]
            if a in ".fstwn" and b in ".fstwnm" and not frozen[c1]:
                g[c1] = b
            elif b in ".fstwn" and a in ".fstwnmr" and not frozen[c2]:
                g[c2] = a
            elif a in ".fstwn" and b == "r" and not frozen[c1]:
                g[c1] = b
            else:
                continue
            n += 1
            break
    return n


def jog(g: np.ndarray, exempt: np.ndarray, keep: np.ndarray, frozen: np.ndarray, cores: np.ndarray,
        rounds: int = ROUNDS, max_run: int = 6) -> int:
    """The jog pass on `g` in place; returns the number of jogs."""
    n = 0
    for _ in range(rounds):
        runs, _, _ = metrics.coast_runs(g, exempt)
        bad = [r for r in runs if r[3] > max_run and not r[4]]
        cr = [r for r in metrics.chunk_runs(g, exempt, nw0=True) if r[3] > max_run and not r[4]]
        if not bad and not cr:
            break
        for k, line, s, ln, _ in bad:
            n += _coast_jog(g, line, s, ln, k, frozen, keep, exempt, cores)
        for k, line, s, ln, _ in cr:
            n += _chunk_jog(g, line, s, ln, k, frozen)
    return n

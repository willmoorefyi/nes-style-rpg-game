"""The world's metrics (docs/NATURAL_WORLD_PLAN.md 0.1.1 and 2.5; printed by `world.py --metrics`).

Measured on the source's `ground` with every patch off. Sea is `o` only; every other char is land.
- G-NW1: a straight coast run (coast edges on one grid line, consecutive, sea on the same side) longer than 6 fails,
  unless every edge of it touches an exempt cell.
- G-NW2: the coast index, coast edges / sqrt(land cells), at least world_api.G2_MIN.
- G-NW3: a run of boundary edges between two **land classes** on a chunk line (between cells 16k-1 and 16k) longer
  than 6 fails, unless every edge touches an exempt cell. Sea and inland water take part in no edge; beach sand (a
  sand cell 4-adjacent to sea, lake or river) is grass-class, as are roads and bridges (rev 3.2).
Also: the biome shares, the per-region coast index (reported, not gated) and the exemption count, and NW2's
`taiga_share` (D-NW2-8, gated by world.py from NW2-T on): taiga over the walkable land of the given regions, on the
owner grid, leaving out mountain, water (ocean, river, lake, canal) and snow.
"""
from __future__ import annotations

import numpy as np

from .noise import N

WATER_CLASS, GRASS_CLASS = 1, 8
CLASS = {"o": 0, "≈": WATER_CLASS, "r": WATER_CLASS, "m": 2, "f": 3, "s": 4, "w": 5, "n": 6, "t": 7,
         ".": GRASS_CLASS, ",": GRASS_CLASS, ":": GRASS_CLASS, "=": GRASS_CLASS}
SHARES = (("mountain", "m"), ("forest", "f"), ("sand", "s"), ("swamp", "w"), ("taiga", "t"), ("snow", "n"),
          ("river", "r"), ("lake", "≈"), ("grass", "."))


def _runs(e, side, ex):
    """Runs along axis 1 of edge arrays: e (edge present), side (sea side), ex (edge touches an exempt cell).
    Returns [(line, start, length, all_exempt)]."""
    out = []
    H, L = e.shape
    for i in range(H):
        j = 0
        while j < L:
            if not e[i, j]:
                j += 1
                continue
            k, allx = j, True
            while k < L and e[i, k] and side[i, k] == side[i, j]:
                allx &= bool(ex[i, k])
                k += 1
            out.append((i, j, k - j, allx))
            j = k
    return out


def coast_runs(g: np.ndarray, exempt: np.ndarray | None = None):
    """(runs [(axis, line, start, length, all_exempt)], coast edges, land cells)."""
    sea = g == "o"
    ex = np.zeros(g.shape, bool) if exempt is None else exempt
    ev = (sea[:, :-1] != sea[:, 1:]).T                   # edges between columns x and x+1, along y: [x, y]
    sv = sea[:, :-1].T
    xv = (ex[:, :-1] | ex[:, 1:]).T
    eh = sea[:-1, :] != sea[1:, :]                       # edges between rows y and y+1, along x: [y, x]
    xh = ex[:-1, :] | ex[1:, :]
    runs = [("v",) + r for r in _runs(ev, sv, xv)] + [("h",) + r for r in _runs(eh, sea[:-1, :], xh)]
    return runs, int(ev.sum() + eh.sum()), int((~sea).sum())


def classes(g: np.ndarray) -> np.ndarray:
    """G-NW3's material class per cell (beach sand is grass-class)."""
    cls = np.vectorize(lambda c: CLASS.get(c, GRASS_CLASS))(g)
    wet = (cls == 0) | (cls == WATER_CLASS)
    near = np.zeros(g.shape, bool)
    near[1:, :] |= wet[:-1, :]
    near[:-1, :] |= wet[1:, :]
    near[:, 1:] |= wet[:, :-1]
    near[:, :-1] |= wet[:, 1:]
    cls[(g == "s") & near] = GRASS_CLASS
    return cls


def chunk_runs(g: np.ndarray, exempt: np.ndarray | None = None, chunk: int = 16, nw0: bool = False):
    """G-NW3's chunk-line runs [(axis, line, start, length, all_exempt)] between two land classes. `nw0`: NW-0's
    stricter measure, which the jog pass breaks (every class boundary, sea and inland water included, beach sand
    as sand); it is the one B's pilot figures report."""
    cls = np.vectorize(lambda c: CLASS.get(c, GRASS_CLASS))(g) if nw0 else classes(g)
    land = np.ones(g.shape, bool) if nw0 else (cls != 0) & (cls != WATER_CLASS)
    ex = np.zeros(g.shape, bool) if exempt is None else exempt
    out = []
    H, W = g.shape
    for x in range(chunk, W, chunk):                     # the line between columns x-1 and x
        e = (cls[:, x - 1] != cls[:, x]) & land[:, x - 1] & land[:, x]
        xx = ex[:, x - 1] | ex[:, x]
        out += [("v", x, s, n, a) for _, s, n, a in _runs(e[None, :], np.zeros((1, H), bool), xx[None, :])]
    for y in range(chunk, H, chunk):
        e = (cls[y - 1, :] != cls[y, :]) & land[y - 1, :] & land[y, :]
        xx = ex[y - 1, :] | ex[y, :]
        out += [("h", y, s, n, a) for _, s, n, a in _runs(e[None, :], np.zeros((1, W), bool), xx[None, :])]
    return out


def gates(g: np.ndarray, exempt: np.ndarray | None = None, max_run: int = 6, nw0: bool = False) -> dict:
    """G-NW1-3 (with `nw0`, G-NW3 by NW-0's stricter measure, as B's pilot json reports it)."""
    runs, edges, land = coast_runs(g, exempt)
    fails1 = [r for r in runs if r[3] > max_run and not r[4]]
    cr = chunk_runs(g, exempt, nw0=nw0)
    fails3 = [r for r in cr if r[3] > max_run and not r[4]]
    return {
        "coast_edges": edges, "land": land, "G2_index": round(float(edges / np.sqrt(max(land, 1))), 1),
        "G1_fail_runs_gt6": len(fails1), "G1_longest": max([r[3] for r in runs], default=0),
        "G1_longest_nonexempt": max([r[3] for r in runs if not r[4]], default=0),
        "runs_ge8": len([r for r in runs if r[3] >= 8]), "G3_fail_runs_gt6": len(fails3),
        "G3_longest": max([r[3] for r in cr if not r[4]], default=0),
        "G1_fail_list": [(r[0], r[1], r[2], r[3]) for r in sorted(fails1, key=lambda r: -r[3])[:12]],
        "G3_fail_list": [(r[0], r[1], r[2], r[3]) for r in sorted(fails3, key=lambda r: -r[3])[:12]],
    }


def shares(g: np.ndarray) -> dict:
    n = max(int((g != "o").sum()), 1)
    return {k: round(100 * float((g == c).sum()) / n, 1) for k, c in SHARES}


NOT_COUNTED = list("o≈rmn~")                  # taiga_share: mountain, water and snow are not counted


def taiga_share(g: np.ndarray, region: np.ndarray, regions, north, floor: float) -> dict:
    """D-NW2-8: taiga cells over the north regions' walkable non-snow land (the owner grid `region`)."""
    own = np.isin(region, [regions.index(r) for r in north])
    land = own & ~np.isin(g, NOT_COUNTED)
    t, n = int((land & (g == "t")).sum()), int(land.sum())
    s = t / max(n, 1)
    return {"ok": s >= floor, "taiga": t, "land": n, "share": round(s, 4),
            "note": f"{100 * s:.1f} % >= {100 * floor:.0f} %: {t} taiga of {n} walkable non-snow cells of "
                    f"{', '.join(north)}",
            "why": [] if s >= floor else [f"taiga {100 * s:.1f} % of {', '.join(north)}'s walkable non-snow land, "
                                         f"under {100 * floor:.0f} % (D-NW2-8)"]}


def region_index(g: np.ndarray, region: np.ndarray, regions) -> dict:
    """The coast index per region (its land's coast edges / sqrt(its land); reported, not gated)."""
    sea = g == "o"
    out = {}
    for i, r in enumerate(regions):
        mine = ~sea & (region == i)
        e = sum(int((mine & np.roll(sea, s, ax)).sum()) for ax in (0, 1) for s in (1, -1))
        n = int(mine.sum())
        out[r] = round(e / np.sqrt(n), 1) if n else None
    return out


def kept_rect_edges(rects: list[tuple[int, int, int, int]], chunk: int = 16) -> list:
    """0.1.1: the kept rectangles (x0, y0, x1, y1 inclusive) with an edge on a chunk line (reported)."""
    out = []
    for x0, y0, x1, y1 in rects:
        on = [s for s, v in (("west", x0), ("north", y0)) if v % chunk == 0]
        on += [s for s, v in (("east", x1), ("south", y1)) if (v + 1) % chunk == 0]
        if on:
            out.append(((x0, y0, x1, y1), on))
    return out


__all__ = ["N", "coast_runs", "chunk_runs", "classes", "gates", "shares", "taiga_share", "region_index", "kept_rect_edges"]

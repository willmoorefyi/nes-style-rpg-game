"""Stages `climate` and `biomes` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rules 5-6, 2.6): moisture, temperature, the
biome table and the tidy.

Moisture is a westerly sweep per row that refills over the sea and drains slowly over land and fast over high ground
(rain shadow), smoothed across rows, plus a coast term, fbm and the hand climate hints (arid, wet, mild, warm, cold;
ragged, never discs). Temperature is latitude (cold from about row COLD_Y north) minus elevation, with a noisy cut-off
and the `warm` / `cold` hints (NW-R, NW2). The biome
table on (moisture, temperature, elevation) writes the legend chars: ocean `o`, grass `.`, forest `f` (stands), sand
`s` (deserts and low hot beaches), swamp `w` (wet lowland), tundra `t`, snow `n`, mountain `m`, river `r`, lake `≈`.
The tidy merges patches under `min_blob` into their neighbours and fills one-cell ocean inlets. NW-0's pilot math;
the tidy's tie-break is fixed (TIE), where the pilot iterated a set (2.5: no set iteration).
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import components
from .noise import N, XX, YY, fbm

COLD_Y = 62                                  # world row: cold from about here north (2.4 rule 5)
H_M = 0.46                                   # mountain above this elevation
TIE = "fstwn."                               # the tidy's tie-break among equally common neighbours (first wins)
# The forest and desert thresholds: NW-0 / NW-2 took them per compose as quantiles over all the land (forest above
# the 0.72 quantile of `mf`, sand below the 0.05 quantile of `moist`), so any region's land edit moved every
# region's forest and desert edges (NW-R ELF: its T2 strait alone, 48 land cells, flipped sand in 44 chunks across
# the world, past `--region`'s PAINT_LIMIT). NW-R ELF, ORDEAL and WIND each froze them at those quantiles of the NW-4
# world, bit for bit and with the same values (the NW-4 world is reproduced exactly), so a region's edit stays local
# (2.5). Integrator ruling (NW-RINT, docs/NATURAL_WORLD_PLAN.md 15): fixed thresholds, one pair, these names.
Q_FOREST, Q_SAND = 0.8816931895841574, 0.14384668557967306


def _gauss(c0, r: float) -> np.ndarray:
    x, y = S.poly([c0])[0]
    return np.exp(-((XX - x) ** 2 + (YY - y) ** 2) / (r * S.S_STAR) ** 2 * 3)


def climate(b: RegionSpec, land: np.ndarray, elev: np.ndarray, field: np.ndarray, seed: int):
    """(moisture, cold, wet) fields."""
    moist = np.zeros((N, N))
    for y in range(N):
        m = 1.0
        for x in range(N):
            if not land[y, x]:
                m = min(1.0, m + 0.1)
            else:
                m = max(0.0, min(1.0, m - 0.004 - 0.12 * max(elev[y, x] - 0.5, 0)))
            moist[y, x] = m
    k = np.ones(7) / 7                       # smooth the per-row sweep across rows (no banding)
    moist = np.apply_along_axis(lambda c: np.convolve(np.pad(c, 3, mode="edge"), k, "valid"), 0, moist)
    moist = 0.7 * moist + 0.3 * np.clip(1 - np.abs(field) / 20, 0, 1) + 0.45 * fbm(seed + 61, (24, 12, 6, 3))
    hn = 1 + 2.2 * fbm(seed + 63, (10, 5, 2.5))
    for h in b.climate:
        if h.kind == "arid":
            moist -= 0.9 * _gauss(h.centre, h.radius) * hn
    for h in b.climate:
        if h.kind == "mild":
            moist -= 0.3 * _gauss(h.centre, h.radius)
    wet = sum(_gauss(h.centre, h.radius) for h in b.climate if h.kind == "wet")
    wet = wet * np.clip(1 + 2.2 * fbm(seed + 64, (8, 4, 2)), 0, 2)
    moist += 0.8 * wet
    cold = np.clip((COLD_Y - YY - 40 * fbm(seed + 71, (32, 16, 8, 4))) / 26, 0, 1)
    for h in b.climate:                      # NW-R ORDEAL: a sheltered lee (cold lowered before the height term,
        if h.kind == "warm":                 # so its peaks stay snowy; cut at 1.5 radii: nothing far moves)
            gw = _gauss(h.centre, h.radius)
            cold = np.clip(cold - 0.9 * gw * np.clip(hn, 0.8, 2) * (gw > np.exp(-6.75 / S.S_STAR ** 2)), 0, 1)
    for h in b.climate:                      # NW2 (docs/NW2_EDITS_PLAN.md 3): a cold pocket, the warm hint's mirror
        if h.kind == "cold":                 # (same ragged disc and 1.5-radius cut; none is declared before NW2-T)
            gc = _gauss(h.centre, h.radius)
            cold = np.clip(cold + 0.9 * gc * np.clip(hn, 0.8, 2) * (gc > np.exp(-6.75 / S.S_STAR ** 2)), 0, 1)
    cold = np.clip(cold + 0.6 * np.clip(elev - 0.45, 0, 1) * (cold > 0.05), 0, 1)
    return moist, cold, wet


def biomes(land, elev, moist, cold, wet, river, lake, seed: int, h_m: float = H_M) -> np.ndarray:
    """The biome table (2.4 rule 6) -> a char grid."""
    g = np.full((N, N), "o")
    beachn = fbm(seed + 91, (6, 3))
    coast1 = land & ~(np.roll(land, 1, 0) & np.roll(land, -1, 0) & np.roll(land, 1, 1) & np.roll(land, -1, 1))
    g[land] = "."
    mf = moist + 0.35 * fbm(seed + 92, (10, 5, 2.5))     # forests come in stands, not sheets
    qf, qs = Q_FOREST, Q_SAND
    g[land & (mf > qf)] = "f"
    g[land & (moist < qs)] = "s"
    g[land & coast1 & (cold < 0.1) & (elev < 0.14) & (beachn > 0.18)] = "s"
    g[land & (wet + 0.5 * fbm(seed + 93, (6, 3)) > 0.45) & (elev < 0.32) & (moist > 0.5)] = "w"
    g[land & (cold > 0.5)] = "t"
    g[land & (cold > 0.93) & (moist > 0.4)] = "n"
    g[land & (elev > h_m)] = "m"
    g[river & land] = "r"
    g[lake & land] = "≈"
    return g


def tidy_blobs(g: np.ndarray, frozen: np.ndarray, min_blob: int = 3) -> np.ndarray:
    """Patches under `min_blob` cells take their most common land neighbour (ties: TIE order); one-cell ocean inlets
    (3 land 4-neighbours) become grass."""
    for ch in "mfswtn":
        lab, sz = components(g == ch)
        for k in np.nonzero(sz < min_blob)[0]:
            if k == 0:
                continue
            for y, x in np.argwhere(lab == k):
                if frozen[y, x]:
                    continue
                nb = [g[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                      if 0 <= x + dx < N and 0 <= y + dy < N and g[y + dy, x + dx] in ".fstwn"
                      and g[y + dy, x + dx] != ch]
                g[y, x] = max(sorted(set(nb), key=TIE.index), key=nb.count) if nb else "."
    for _ in range(2):
        o = g == "o"
        n_land = sum((~np.roll(o, s, a)).astype(int) for s in (1, -1) for a in (0, 1))
        g[o & (n_land >= 3) & ~frozen] = "."
    return g

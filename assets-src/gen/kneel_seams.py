"""Whole-line seam resize for the kneel bridge (docs/KNEEL_TWEEN_PLAN.md D-KT2): a band of pixel rows (or columns)
gets shorter or longer by dropping or doubling the lines most like their neighbour, so outlines do not turn into the
2 px stairs an even nearest pick leaves on diagonals. Pure numpy, deterministic (ties go to the lower index)."""
from __future__ import annotations

import numpy as np


def seam_cost(lines: np.ndarray) -> np.ndarray:
    """cost[i] = how many pixels differ (colour or alpha) between line i and line i + 1."""
    a = lines.astype(np.int16)
    return (np.abs(a[1:] - a[:-1]).sum(-1) > 0).sum(-1).astype(np.int64)


def pick(cost: np.ndarray, n: int) -> list[int]:
    """n line indices, cheapest first: first spread out (no two picks on adjacent lines), then any line not yet picked,
    then (doubling only) repeats."""
    order = sorted(range(len(cost)), key=lambda i: (int(cost[i]), i))
    picked: list[int] = []
    for i in order:
        if len(picked) < n and all(abs(i - j) > 1 for j in picked):
            picked.append(i)
    for i in order:
        if len(picked) < n and i not in picked:
            picked.append(i)
    k = 0
    while len(picked) < n and order:
        picked.append(order[k % len(order)])
        k += 1
    return sorted(picked)


def resize_band(band: np.ndarray, n_new: int) -> np.ndarray:
    """The band (lines along axis 0) at n_new lines."""
    n = band.shape[0]
    if n_new == n or n < 2:
        return band.copy()
    cost = seam_cost(band)
    if n_new < n:
        drop = set(pick(cost, n - n_new))               # line i is dropped (its neighbour i + 1 stays)
        return band[[i for i in range(n) if i not in drop]]
    dup = pick(cost, n_new - n)
    out = []
    for i in range(n):
        out.append(band[i])
        out.extend([band[i]] * dup.count(i))
    return np.stack(out)

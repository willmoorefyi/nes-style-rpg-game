"""D-KA7 first guess of the kneel key's joints (docs/KNEEL_AI_PLAN.md 4; offline). The rig agent then marks the joints
by hand from `monster_anim.py mark` (heroes: `puppet_kneel.py review`); this guess only starts it.

1. the template targets (kneel_ai_guide.targets), then a one-pass per-part fit in topological order: each part's idle
   pixels are posed rigidly on its target bone (the parent's fitted shift carried down) and searched over dx, dy in
   [-4, 4] and dtheta in {-10, -5, 0, 5, 10} deg for the best fit (`_fit`: the share of the posed part's pixels that
   land on a key pixel of their own colour; the plan's "alpha IoU", made local);
2. IoU floor: a part under 0.60 keeps no guess (`hand`); a mean under 0.75 sends the whole key to hand marking.
"""
from __future__ import annotations

import math
import time

import numpy as np

from gen import kneel_ai_data as D
from gen import kneel_ai_guide as G

SHIFT = range(-4, 5)
TURNS = (-10, -5, 0, 5, 10)
PART_FLOOR, MEAN_FLOOR = 0.60, 0.75


def _fit(xs: np.ndarray, ys: np.ndarray, cols: np.ndarray, key_ids: np.ndarray, key_op: np.ndarray) -> float:
    """Share of the posed part's pixels that land on a key pixel of their own colour (a local fit: an alpha IoU
    against the whole key is dominated by the other parts)."""
    h, w = key_op.shape
    ok = (xs >= 0) & (ys >= 0) & (xs < w) & (ys < h)
    if not ok.any():
        return 0.0
    hit = key_op[ys[ok], xs[ok]] & (key_ids[ys[ok], xs[ok]] == cols[ok])
    return float(hit.sum()) / len(xs)


def guess(sp: D.Sprite, key: np.ndarray) -> dict:
    """{joints, iou: {part: v}, hand: [parts], whole: bool, seconds}."""
    from gen import rig as R
    t0, w0 = time.process_time(), time.perf_counter()
    rig, S, T = sp.rig, sp.rig.keyframes["idle"], G.targets(sp)
    lab, names = R.segment(rig, "idle", sp.idle)
    K = key[..., 3] > 0
    kid, iid = (a[..., :3].astype(np.int64) @ np.array([65536, 256, 1]) for a in (key, sp.idle))
    J = {j: tuple(T.get(j, S[j])) for j in S}
    carry = {j: (0.0, 0.0) for j in S}
    depth = {j: rig.order.index(j) if j in rig.order else 0 for j in S}
    parts = [n for n in rig.parts if rig.present(n, "idle") and (lab == names.index(n)).any()]
    parts.sort(key=lambda n: depth.get(rig.joints_of(n, "idle")[0], 0))
    ious = {}
    for n in parts:
        js = rig.joints_of(n, "idle")
        a0, b0 = S[js[0]], S[js[-1]]
        cx, cy = carry[js[0]]
        a1 = (T.get(js[0], a0)[0] + cx, T.get(js[0], a0)[1] + cy)
        b1 = T.get(js[-1], b0)
        base = math.atan2(b1[1] - a1[1], b1[0] - a1[0]) - math.atan2(b0[1] - a0[1], b0[0] - a0[0])
        ys, xs = np.nonzero(lab == names.index(n))
        cols, dx0, dy0 = iid[ys, xs], xs - a0[0], ys - a0[1]
        best = (-1.0, 0, 0, 0.0)
        for turn in TURNS:
            t = base + math.radians(turn)
            X = a1[0] + dx0 * math.cos(t) - dy0 * math.sin(t)
            Y = a1[1] + dx0 * math.sin(t) + dy0 * math.cos(t)
            for dx in SHIFT:
                for dy in SHIFT:
                    v = _fit(np.round(X + dx).astype(int), np.round(Y + dy).astype(int), cols, kid, K)
                    if v > best[0]:
                        best = (v, dx, dy, t)
        v, dx, dy, t = best
        ious[n] = round(v, 3)
        for j in js:
            px, py = S[j][0] - a0[0], S[j][1] - a0[1]
            J[j] = (a1[0] + px * math.cos(t) - py * math.sin(t) + dx, a1[1] + px * math.sin(t) + py * math.cos(t) + dy)
            carry[j] = (J[j][0] - T.get(j, S[j])[0], J[j][1] - T.get(j, S[j])[1])
    hand = sorted(n for n, v in ious.items() if v < PART_FLOOR)
    mean = float(np.mean(list(ious.values()))) if ious else 0.0
    return {"joints": {j: [int(round(x)), int(round(y))] for j, (x, y) in J.items()}, "iou": ious, "hand": hand,
            "mean": round(mean, 3), "whole": mean < MEAN_FLOOR, "seconds": round(time.process_time() - t0, 2),
            "wall": round(time.perf_counter() - w0, 2)}

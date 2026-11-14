"""Leg helpers of the monster pose solve (rig.solve): two-bone IK and the pinned-foot reach clamp."""
from __future__ import annotations

import math


def keep_reach(rig, S: dict, out: dict, pins: set, fixed: set) -> dict:
    """A pinned foot never moves: when the solved hip socket is out of the leg's reach (the hip rose too far), the
    body (every joint not pinned) is moved toward that foot until the leg reaches it, instead of the IK lifting it."""
    for _ in range(4):
        best = None
        for h, k, f in rig.limbs:
            if f not in pins or k in pins or not all(j in out and j in S for j in (h, k, f)):
                continue
            reach = math.hypot(S[k][0] - S[h][0], S[k][1] - S[h][1]) + math.hypot(S[f][0] - S[k][0], S[f][1] - S[k][1])
            dx, dy = out[f][0] - out[h][0], out[f][1] - out[h][1]
            d = math.hypot(dx, dy)
            if d - reach > 0.45 and (best is None or d - reach > best[0]):   # less than that rounds back to the pin
                best = (d - reach - 0.4, dx / d, dy / d)
        if best is None:
            break
        e, ux, uy = best
        out = {j: v if j in fixed else (v[0] + ux * e, v[1] + uy * e) for j, v in out.items()}
    return out


def ik(hip, foot, sh, sk, sf) -> tuple[tuple[float, float], tuple[float, float]]:
    """Two-bone IK: the knee for `foot` with the source thigh / shin lengths, bent to the source knee's side."""
    l1, l2 = math.hypot(sk[0] - sh[0], sk[1] - sh[1]), math.hypot(sf[0] - sk[0], sf[1] - sk[1])
    d = min(math.hypot(foot[0] - hip[0], foot[1] - hip[1]), l1 + l2 - 1e-6)
    base = math.atan2(foot[1] - hip[1], foot[0] - hip[0])
    side = 1.0 if (sf[0] - sh[0]) * (sk[1] - sh[1]) - (sf[1] - sh[1]) * (sk[0] - sh[0]) >= 0 else -1.0
    bend = math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / max(2 * l1 * d, 1e-9))))
    knee = (hip[0] + l1 * math.cos(base + side * bend), hip[1] + l1 * math.sin(base + side * bend))
    return knee, (hip[0] + d * math.cos(base), hip[1] + d * math.sin(base))

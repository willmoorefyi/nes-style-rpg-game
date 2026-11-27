"""Pass CL (docs/CLASS_LANCE_PLAN.md 5.2.3): a lance redrawn at a clean pixel-art angle, turned about its grip: the
head by RotSprite, the shaft as pixel-perfect strands (one rounding rule, so a .5 tie never alternates) with the colours
sampled along the source's completed shaft, one cross-section. Kept for a lance that must turn (no frame of the pass
uses it since review round 2: puppet_lance.RIGID); selftested in selftest_hero_lance.py."""
from __future__ import annotations

import math

import numpy as np

from gen import hero_user_lance as HL
from gen import puppet_lance as PL


def snap(angle: float) -> float:
    return min(PL.S_ANGLES, key=lambda s: abs(s - angle))


def _profile(part: dict, head: float):
    """The source shaft (completed): [(t, {minor offset: rgba})] per major-axis step, beyond the head."""
    tip, u, n = HL.seg(part["line"])
    major, rows = PL._rows(part["lpx"], part["lmask"], part["line"], head)
    return sorted((float((maj - tip[major]) / u[major]), offs) for maj, offs in rows.items())


def redraw(part: dict, angle: float, grip_src, grip_dst, head: float, size) -> dict:
    """The keyframe's lance at a clean `angle` (deg, up-left positive), turned about its grip: the head by RotSprite,
    the shaft as pixel-perfect strands sampled along the source shaft. `rear`: the mask of the butt half (drawn only
    where the body is not)."""
    from gen.rig_rotsprite import rotsprite
    w, h = size
    tip, u, n = HL.seg(part["line"])
    tg = float((np.asarray(grip_src, float) - tip) @ u)            # the grip's arc position on the source lance
    a = math.radians(angle)
    ud = np.array([math.cos(a), math.sin(a)])                        # unit tip -> butt (HL.angle's convention)
    gd = np.asarray(grip_dst, float)
    for _ in range(80):                       # the butt (or the tip) would leave the cell: the hand slides on the shaft
        b_ = gd + (n - tg) * ud
        t_ = gd - tg * ud
        if all(PL.BUTT_MARGIN + 1 <= v[0] <= w - 2 - PL.BUTT_MARGIN and 0 <= v[1] <= h - 2 - PL.BUTT_MARGIN for v in (b_, t_)):
            break
        tg += 1.0 if not (PL.BUTT_MARGIN + 1 <= b_[0] <= w - 2 - PL.BUTT_MARGIN and b_[1] <= h - 2 - PL.BUTT_MARGIN) else -1.0
    pt = lambda t: gd + (t - tg) * ud                                # noqa: E731
    px = np.zeros((h, w, 4), np.uint8)
    gy, gx = np.mgrid[0:h, 0:w]
    tt = (np.stack([gx, gy], -1) - tip) @ u
    hmask = part["mask"] & (tt < head)
    rot = math.atan2(ud[1], ud[0]) - math.atan2(u[1], u[0])
    junction_src = tip + head * u
    img, m = rotsprite(part["img"], hmask, tuple(junction_src), tuple(pt(head)), rot, (h, w))
    px[m] = img[m]
    drawn = m.copy()
    prof = _profile(part, head)
    from collections import Counter                  # one cross-section: the rows that have the common strands
    full = Counter(frozenset(o) for _, o in prof).most_common(1)[0][0]
    prof = [(t, o) for t, o in prof if frozenset(o) == full]
    major = 0 if abs(ud[0]) >= abs(ud[1]) else 1
    p0, p1 = pt(head), pt(n)
    steps = int(round(abs(p1[major] - p0[major])))
    sgn = 1 if p1[major] >= p0[major] else -1
    ts = np.array([t for t, _ in prof])
    rear = np.zeros((h, w), bool)
    for i in range(steps + 1):
        maj = int(round(p0[major])) + sgn * i
        f = (maj - p0[major]) / (p1[major] - p0[major]) if steps else 0.0
        mn = p0[1 - major] + f * (p1[1 - major] - p0[1 - major])
        t = head + f * (n - head)
        offs = prof[int(np.abs(ts - t).argmin())][1]
        for off, c in offs.items():
            q = [0, 0]
            q[major], q[1 - major] = maj, int(math.floor(mn + 0.5 + 1e-6)) + off   # one rounding rule: a .5 tie never alternates
            x, y = q
            if 0 <= x < w and 0 <= y < h and not drawn[y, x]:
                px[y, x] = c
                drawn[y, x] = True
                rear[y, x] = t > tg
    tip_d, butt_d = pt(0.0), pt(n)
    return {"px": px, "mask": drawn, "line": [tip_d.tolist(), butt_d.tolist()], "mode": "redraw", "angle": angle, "head": head,
            "headmask": m,
            "rear": rear}

"""Hero rotsprite renderer for the kneel (docs/KNEEL_PLAN.md D-K19, split from puppet_kneel_render.py for the 250-line
limit): the puppet parts of puppet.py posed onto target joints as in `puppet.render`, but a part turned more than
30 deg is sampled with rotsprite (`rig_rotsprite`), a part turned under 0.5 deg is moved by whole pixels, and the
render also returns its label map (the part every pixel came from) and each part's rotation, so `kneel_in2` can be cut
from the derived kneel key and the K-rot caps measured."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from gen import puppet as PU
from gen import rig_rotsprite as RS

ROTSPRITE_DEG = 30.0
LIMBS = ("uarm_n", "farm_n", "uarm_f", "farm_f", "thigh_n", "shin_n", "thigh_f", "shin_f")
NAMES = list(PU.PARTS)


def _dist(a, b) -> float:
    return float(math.hypot(b[0] - a[0], b[1] - a[1]))


def _rot_about(p, c, deg: float):
    """Rotate p about c; + turns a point above c toward -x (forward, the heroes face left)."""
    r = math.radians(deg)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(r) + y * math.sin(r), c[1] - x * math.sin(r) + y * math.cos(r))


def ik(hip, foot, a: float, b: float, near):
    """Two-bone IK: the knee closer to `near`; an out-of-reach foot is pulled toward the hip."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    c0 = max(math.hypot(dx, dy), 1e-6)
    c = min(max(c0, abs(a - b) + 1e-3), a + b - 1e-3)
    base = math.atan2(dy, dx)
    ang = math.acos(max(-1.0, min(1.0, (a * a + c * c - b * b) / (2 * a * c))))
    cands = [(hip[0] + a * math.cos(base + s * ang), hip[1] + a * math.sin(base + s * ang)) for s in (1, -1)]
    knee = min(cands, key=lambda k: (_dist(k, near), k[0], k[1]))
    return knee, (hip[0] + dx / c0 * c, hip[1] + dy / c0 * c)


def _fill_labels(lab: np.ndarray, solid: np.ndarray) -> np.ndarray:
    lab = np.where(solid, lab, -1)
    for _ in range(4):
        todo = solid & (lab < 0)
        if not todo.any():
            break
        for oy, ox in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.full_like(lab, -1)
            sh[max(oy, 0):lab.shape[0] + min(oy, 0), max(ox, 0):lab.shape[1] + min(ox, 0)] = \
                lab[max(-oy, 0):lab.shape[0] + min(-oy, 0), max(-ox, 0):lab.shape[1] + min(-ox, 0)]
            put = todo & (lab < 0) & (sh >= 0)
            lab[put] = sh[put]
    return lab


def render(target: dict, sources: dict, default: str, z: list[str], robed: bool, size=(80, 80)):
    """sources: name -> (frame, joints, labels | None). Returns (image, labels, {part: rotation deg})."""
    w, h = size
    out = np.zeros((h, w, 4), np.uint8)
    lab_out = np.full((h, w), -1, np.int32)
    gy, gx = np.mgrid[0:h, 0:w]
    rots: dict[str, float] = {}
    frame, sj, labels = sources[default]
    if labels is None:
        labels = PU.segment(frame, sj, robed)
    arr = np.asarray(frame)
    for part in z:
        if robed and part in PU.LEGS:
            continue
        j0, j1 = PU._bone(part, sj)
        tj0 = j0 if part != "weapon" else f"hand_{target.get('weapon_hand', sj.get('weapon_hand', 'n'))}"
        mask = labels == NAMES.index(part)
        if j0 not in sj or j1 not in sj or tj0 not in target or j1 not in target or not mask.any():
            continue
        rot = PU._angle(target[tj0], target[j1]) - PU._angle(sj[j0], sj[j1])
        rot = (rot + math.pi) % (2 * math.pi) - math.pi
        deg = math.degrees(rot)
        if abs(deg) < 0.5:                                  # a translation: whole pixels, no resampling
            deg = 0.0
            sx = gx - int(round(target[tj0][0] - sj[j0][0]))
            sy = gy - int(round(target[tj0][1] - sj[j0][1]))
        if abs(deg) > ROTSPRITE_DEG:
            vals, hit = RS.rotsprite(arr, mask, sj[j0], target[tj0], rot, (h, w))
        else:
            if deg != 0.0:
                c, s = math.cos(-rot), math.sin(-rot)
                dx, dy = gx - target[tj0][0], gy - target[tj0][1]
                sx = np.rint(c * dx - s * dy + sj[j0][0]).astype(int)
                sy = np.rint(s * dx + c * dy + sj[j0][1]).astype(int)
            ok = (sx >= 0) & (sx < arr.shape[1]) & (sy >= 0) & (sy < arr.shape[0])
            hit = np.zeros_like(ok)
            hit[ok] = mask[sy[ok], sx[ok]]
            vals = np.zeros_like(out)
            vals[hit] = arr[sy[hit], sx[hit]]
        rots[part] = round(deg, 2)
        out[hit] = vals[hit]
        lab_out[hit] = NAMES.index(part)
    img = PU.outline(Image.fromarray(out, "RGBA"))
    return img, _fill_labels(lab_out, np.asarray(img)[..., 3] > 0), rots

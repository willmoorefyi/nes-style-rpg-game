"""Hero kneel poses (docs/KNEEL_PLAN.md D-K4, D-K5, D-K19), split from puppet_kneel.py for its 250-line limit.

Rendering (rotsprite above 30 deg, label maps, rotations): puppet_kneel_rot.py.

Variant A (D-K4; R3 = A for every class, user ruling, so variant B is not built):
- unrobed: re-posed from `ready`: hip down until the back knee joint is on the foot row (back thigh 0.3 L_thigh
  behind the hip, back shin along the ground), front foot planted with the knee forward (2-bone IK), chest `lean`,
  head `bow`, the `arms` hands down 0.5 L_thigh; a leg reaching into the bottom margin is lifted out of it, then a
  rear knee pad 1-2 px above the ground row is lowered onto it (`knee_down`, default on).
- robed: rows below `hip` squashed to sy 0.55 (or the class's `squash`) about the foot row (plan section 4), then
  the head `bow`. `reoutline: true` re-inks the class's 2 px outline afterwards (puppet_kneel_outline.py).
In-betweens: kneel_in1 is cut from ready, kneel_in2 from the derived key (near-keyframe, t 0.33 each); kneel_b is the
key with idle_b's 1 px bob.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from gen import puppet as PU
from gen import puppet_kneel_outline as KO
from gen import puppet_kneel_paint as KP
from gen.puppet_kneel_rot import LIMBS, NAMES, _dist, _rot_about, ik, render  # noqa: F401 - LIMBS re-exported

ROBE_SY = 0.55
TWEEN_LIMB_DEG = 40.0            # D-K19: kneel_in1 / kneel_in2 limb parts
T_IN = 0.33                      # kneel_in1 = idle toward kneel, kneel_in2 = kneel toward idle (D-K5)


def _lerp(a: dict, b: dict, t: float) -> dict:
    out = dict(a)
    for k, v in b.items():
        if isinstance(v, tuple) and isinstance(a.get(k), tuple):
            out[k] = (a[k][0] + (v[0] - a[k][0]) * t, a[k][1] + (v[1] - a[k][1]) * t)
    return out


def solve(t: dict, src: dict, robed: bool, near: dict) -> dict:
    """Bone lengths of `src`: arm chains (and the weapon) by keep_lengths, legs by IK toward the knees in `near`."""
    t = PU.keep_lengths(t, lambda a, b: src, True)
    if not robed:
        for s in ("n", "f"):
            a, b = _dist(src[f"hip_{s}"], src[f"knee_{s}"]), _dist(src[f"knee_{s}"], src[f"foot_{s}"])
            t[f"knee_{s}"], t[f"foot_{s}"] = ik(t[f"hip_{s}"], t[f"foot_{s}"], a, b, near[f"knee_{s}"])
    return t


def fk_lerp(a: dict, b: dict, t: float) -> dict:
    """Fallback in-between joints from `a` (the pixel source) toward `b` when the IK one turns a limb past the cap:
    chain roots move linearly and every bone turns by t of its angle change at its `a` length."""
    out = _lerp(a, b, t)
    wh = a.get("weapon_hand", "n")
    for ch in [("neck", "crown"), ("sh_n", "el_n", "hand_n"), ("sh_f", "el_f", "hand_f"),
               ("hip_n", "knee_n", "foot_n"), ("hip_f", "knee_f", "foot_f")]:
        ch = (*ch, "tip") if "tip" in a and "tip" in b and ch[-1] == f"hand_{wh}" else ch
        if not all(j in a and j in b for j in ch):
            continue
        for j0, j1 in zip(ch, ch[1:]):
            aa, ab = PU._angle(a[j0], a[j1]), PU._angle(b[j0], b[j1])
            r = aa + t * ((ab - aa + math.pi) % (2 * math.pi) - math.pi)
            ln = _dist(a[j0], a[j1])
            out[j1] = (out[j0][0] + ln * math.cos(r), out[j0][1] + ln * math.sin(r))
    return out


def target_a(R: dict, kn: dict, robed: bool, ground: float) -> dict:
    """Variant A kneel joints from the ready joints (heroes face left: the front leg has the smaller foot x)."""
    front = "n" if R["foot_n"][0] <= R["foot_f"][0] else "f"
    back = "f" if front == "n" else "n"
    lt = _dist(R[f"hip_{back}"], R[f"knee_{back}"])
    kx = 0.3 * lt
    d = 0 if robed else int(round(ground - R[f"hip_{back}"][1] - math.sqrt(lt * lt - kx * kx)))
    t = PU._moved(R, 0, d)
    hip = t["hip"]
    for k in ("neck", "crown", "chest", "sh_n", "el_n", "hand_n", "sh_f", "el_f", "hand_f", "tip"):
        if k in t and not robed:
            t[k] = _rot_about(t[k], hip, kn.get("lean", 8))
    t["crown"] = _rot_about(t["crown"], t["neck"], kn.get("bow", 12))
    lt_avg = (lt + _dist(R[f"hip_{front}"], R[f"knee_{front}"])) / 2
    for s in kn.get("arms", ["n"]):
        t[f"el_{s}"] = PU._add(t[f"el_{s}"], (0, 0.25 * lt_avg))
        t[f"hand_{s}"] = PU._add(t[f"hand_{s}"], (0, 0.5 * lt_avg))
    t = PU._carry_tip(t, R) if "tip" in R else t
    if not robed:
        ls = _dist(R[f"knee_{back}"], R[f"foot_{back}"])
        t[f"knee_{back}"] = (t[f"hip_{back}"][0] + kx, ground)
        t[f"foot_{back}"] = (t[f"knee_{back}"][0] + ls, ground)
        t[f"foot_{front}"] = R[f"foot_{front}"]
        t[f"knee_{front}"] = (t[f"hip_{front}"][0] - 2 * lt, t[f"hip_{front}"][1] - lt)
    for j, dv in (kn.get("tweaks") or {}).items():
        t[j] = PU._add(t[j], dv)
    near = dict(t)
    t = solve(t, R, robed, near)
    if not robed:                                        # the back leg lies on the ground: keep it as placed
        t[f"knee_{back}"], t[f"foot_{back}"] = near[f"knee_{back}"], near[f"foot_{back}"]
    return t


def squash(frame: Image.Image, cut: int, sy: float, bottom: int) -> tuple[Image.Image, int]:
    """Rows cut..bottom resampled (nearest rows, the foot row kept) to sy of their height; the rows above move down."""
    a = np.asarray(frame)
    out = np.zeros_like(a)
    n_src = bottom - cut + 1
    n = max(1, int(round(n_src * sy)))
    drop = n_src - n
    for i in range(n):
        out[bottom - i] = a[bottom - (i * n_src) // n]
    out[drop:cut + drop] = np.where(a[:cut, :, 3:] > 0, a[:cut], out[drop:cut + drop])
    out[bottom + 1:] = a[bottom + 1:]
    return Image.fromarray(out, "RGBA"), drop


def ground_fix(img: Image.Image, bottom: int) -> Image.Image:
    """Move the whole frame so its lowest opaque row is `bottom` (K-ground)."""
    a = np.asarray(img)
    rows = np.where((a[..., 3] > 0).any(1))[0]
    dy = bottom - int(rows.max()) if len(rows) else 0
    if dy == 0:
        return img
    out = np.zeros_like(a)
    out[max(dy, 0):a.shape[0] + min(dy, 0)] = a[max(-dy, 0):a.shape[0] + min(-dy, 0)]
    return Image.fromarray(out, "RGBA")


def _robed_a(frames: dict, R: dict, kn: dict, z: list[str], bottom: int, t: float):
    sy = float(kn.get("squash", ROBE_SY))               # per-class squash (D-K18 additive; default ROBE_SY)
    sq, drop = squash(frames["ready"], int(R["hip"][1]), 1 - t * (1 - sy), bottom)
    J = PU._moved(R, 0, drop)
    tgt = solve(_lerp(J, target_a(J, kn, True, bottom), t), J, True, J)
    img, _, rots = render(tgt, {"sq": (sq, J, None)}, "sq", z, True)
    return ground_fix(img, bottom), rots, int(J["hip"][1])


def _grounded(T: dict, sources: dict, default: str, z: list[str], bottom: int, per_leg: bool = False):
    """Render; while a leg reaches into the bottom margin, lift that leg's knee and foot by the overflow (the frame's,
    or with `per_leg` (opt-in `kneel: {per_leg_lift: true}`) that leg's own, so a planted foot is not lifted with it)."""
    T = dict(T)
    for _ in range(4):
        img, lab, rots = render(T, sources, default, z, False)
        solid = np.asarray(img)[..., 3] > 0
        over = int(np.where(solid.any(1))[0].max()) - bottom
        legs = sorted({NAMES[i][-1] for i in np.unique(lab[bottom + 1:][solid[bottom + 1:]]) if NAMES[i] in PU.LEGS})
        if over <= 0 or not legs:
            break
        for sd in legs:
            own = np.isin(lab, [NAMES.index(f"thigh_{sd}"), NAMES.index(f"shin_{sd}")]) & solid
            lift = int(np.where(own.any(1))[0].max()) - bottom if per_leg else over
            for j in (f"knee_{sd}", f"foot_{sd}"):
                T[j] = PU._add(T[j], (0, -lift))
    return img, lab, rots, T


def _knee_down(R: dict, K: dict, key, klab, src: dict, z: list[str], bottom: int, max_px: int = 2):
    """Polish: when the rear knee pad stops 1-2 px above the ground row, lower the knee joint by that much (the foot
    stays), if the frame still ends on the ground row with nothing in the margin; else keep the key as drawn."""
    back = "f" if R["foot_n"][0] <= R["foot_f"][0] else "n"
    kx = int(round(K[f"knee_{back}"][0]))
    near = np.isin(klab, [NAMES.index(f"thigh_{back}"), NAMES.index(f"shin_{back}")])[:, max(kx - 2, 0):kx + 3]
    rows = np.where(near.any(1))[0]
    gap = bottom - int(rows.max()) if len(rows) else 0
    if not 1 <= gap <= max_px:
        return key, klab, None, K
    K2 = {**K, f"knee_{back}": PU._add(K[f"knee_{back}"], (0, gap))}
    img, lab, rots = render(K2, src, next(iter(src)), z, False)
    low = np.where((np.asarray(img)[..., 3] > 0).any(1))[0].max()
    sub = np.isin(lab, [NAMES.index(f"thigh_{back}"), NAMES.index(f"shin_{back}")])[:, max(kx - 2, 0):kx + 3]
    if low != bottom or np.where(sub.any(1))[0].max() != bottom:
        return key, klab, None, K
    return img, lab, rots, K2


def _tween(a: dict, b: dict, sources: dict, default: str, z: list[str], bottom: int, per_leg: bool = False):
    """The IK in-between a -> b at T_IN (a = the pixel source); fk_lerp if it turns a limb past the in-between cap."""
    out = _grounded(solve(_lerp(a, b, T_IN), a, False, _lerp(a, b, T_IN)), sources, default, z, bottom, per_leg)
    if max([abs(d) for p, d in out[2].items() if p in LIMBS] or [0]) > TWEEN_LIMB_DEG:
        out = _grounded(fk_lerp(a, b, T_IN), sources, default, z, bottom, per_leg)
    return out


def variant_a(frames: dict, R: dict, kn: dict, robed: bool, z: list[str], bottom: int) -> dict:
    """{name: (image, rotations relative to the pixel source, source name)} for the four kneel frames."""
    if robed:
        made = {n: _robed_a(frames, R, kn, z, bottom, tt) for n, tt in (("kneel_in1", T_IN), ("kneel_in2", 1 - T_IN),
                                                                         ("kneel", 1.0))}
        out = {n: (img, rots, "ready") for n, (img, rots, _) in made.items()}
        hip_row = made["kneel"][2]
    else:
        ground = float(R["foot_n"][1] + R["foot_f"][1]) / 2
        lab = KP.relabel(PU.segment(frames["ready"], R, False), frames["ready"], kn["labels"]) if kn.get("labels") \
            else None                                    # opt-in: boxes cut with one part (puppet_kneel_paint)
        src_r = {"ready": (frames["ready"], R, lab)}
        pl = bool(kn.get("per_leg_lift"))
        key, klab, krot, K = _grounded(target_a(R, kn, False, ground), src_r, "ready", z, bottom, pl)
        if kn.get("knee_down", True):
            key, klab, rot2, K = _knee_down(R, K, key, klab, src_r, z, bottom)
            krot = rot2 or krot
        img1, _, rot1, _ = _tween(R, K, src_r, "ready", z, bottom, pl)
        img2, _, rot2, _ = _tween(K, R, {"key": (key, K, klab)}, "key", z, bottom, pl)
        if kn.get("ground_tweens"):                      # opt-in: an in-between left above the ground row drops to it
            img1, img2 = ground_fix(img1, bottom), ground_fix(img2, bottom)
        out = {"kneel_in1": (img1, rot1, "ready"), "kneel_in2": (img2, rot2, "kneel"), "kneel": (key, krot, "ready")}
        hip_row = int(round(K["hip"][1]))
    if kn.get("paint"):                                  # opt-in per-frame paint / stamps (puppet_kneel_paint)
        out = {n: (KP.paint(img, n, kn["paint"], frames), rots, src) for n, (img, rots, src) in out.items()}
    if kn.get("reoutline"):                              # opt-in: the class's own 2 px outline (puppet_kneel_outline)
        out = KO.apply(out, frames["ready"])
    out["kneel_b"] = (PU.bob(out["kneel"][0], hip_row, 1), {}, "kneel")     # idle_b's 1 px bob, on the kneel
    if kn.get("paint"):
        out["kneel_b"] = (KP.paint(out["kneel_b"][0], "kneel_b", kn["paint"], frames), {}, "kneel")
    if kn.get("reoutline"):
        out["kneel_b"] = (KO.reoutline(out["kneel_b"][0], frames["ready"]), {}, "kneel")
    return out

"""Framework fixes found by the T4 / T5b rig agents (docs/ENEMY_ANIM_PLAN.md 5.1 checks 6 and 8, 4.2 solve and cloth),
each RED first: per-foot feet check, the adjacent-IoU bound, pinned feet out of leg reach, per-keyframe cloth chains."""
from __future__ import annotations

from typing import Callable

import numpy as np

FEET_ERRS = ("lowest opaque row", "feet x", "no foot pixels", "below the plain", "kept paw", "foot ")


def _rect(x0: int, y0: int, x1: int, y1: int) -> np.ndarray:
    a = np.zeros((80, 80, 4), np.uint8)
    a[y0:y1, x0:x1] = (90, 90, 90, 255)
    return a


def run_iou_bound(check: Callable[[bool, str], None]) -> None:
    """Check 6: adjacent frames need IoU >= min(0.55, IoU(spanning keyframe pair) + 0.02)."""
    from gen import anim_checks as C
    base = _rect(10, 10, 50, 70)                                      # 40 px wide; a shift of s gives (40-s)/(40+s)
    span = (base, _rect(25, 10, 65, 70))                              # keyframe pair IoU 0.45
    near, far = _rect(24, 10, 64, 70), _rect(30, 10, 70, 70)          # adjacent pairs at 0.48 and 0.33
    ok = [e for e in C.continuity(base, near, span, 80) if "IoU" in e]
    bad = [e for e in C.continuity(base, far, span, 80) if "IoU" in e]
    check(not ok, f"6: an in-between pair at {C.iou(base, near):.2f} >= keyframe pair {C.iou(*span):.2f} + 0.02 passes {ok}")
    check(bool(bad), f"6: an in-between pair at {C.iou(base, far):.2f} (below the keyframe pair) fails")


def run_per_foot(check: Callable[[bool, str], None]) -> None:
    """Check 8 per foot: a foot lifted in either keyframe of the span is skipped (the mummy's attack lifts the near
    foot), a foot grounded in both must follow the lerp, a pinned grounded foot must stay exactly."""
    from gen import monster_anim as MA
    from gen import monster_check as MC
    from gen import selftest_rig as SR
    attack = {**SR.ATTACK, "knee_n": (49, 58), "foot_n": (52, 66)}     # near foot kicked up, far foot planted
    kfs = {"idle": SR.draw(SR.IDLE, True), "attack": SR.draw(attack, True), "hurt": SR.draw(SR.HURT, False)}
    cfg = {**SR.RIG, "keyframes": {"idle": SR.IDLE, "attack": attack, "hurt": SR.HURT}}
    gen = MA.generate("synthetic_lift", cfg, kfs, SR.META)
    rep = MC.check_sprite("synthetic_lift", cfg, kfs, SR.META, gen, with_lock=False)
    bad = [e for e in rep["atk_mid"] if e.startswith(FEET_ERRS)]
    check(not bad, f"8: atk_mid with the near foot lifted in attack is judged on the far foot only {bad}")
    f = gen["atk_mid"]
    moved = np.roll(f["img"], 3, 1)                                  # every foot 3 px off its lerp
    fails = MC.frame_checks("atk_mid", {**f, "img": moved, "labels": np.roll(f["labels"], 3, 1)},
                            {k: np.asarray(v) for k, v in kfs.items()}, gen, SR.META, MC.palette(kfs))
    check(any(e.startswith(FEET_ERRS) for e in fails), "8: the grounded far foot 3 px off its lerp still fails")
    w = gen["atk_wind1"]
    moved = np.roll(w["img"], 2, 1)
    fails = MC.frame_checks("atk_wind1", {**w, "img": moved, "labels": np.roll(w["labels"], 2, 1)},
                            {k: np.asarray(v) for k, v in kfs.items()}, gen, SR.META, MC.palette(kfs))
    check(any(e.startswith(FEET_ERRS) for e in fails), "8: a pinned grounded foot moved 2 px (tolerance 1) still fails")


def run_pinned_reach(check: Callable[[bool, str], None]) -> None:
    """rig.solve: a pinned foot never moves, even when the hip rises out of the leg's reach (vampire hurt_in1)."""
    from gen import rig as R
    from gen import selftest_rig as SR
    rig = R.Rig(SR.RIG, (80, 80))
    S = SR.IDLE
    T = {**SR.HURT, "hip": (40, 30)}                                 # hip 22 px higher: far out of leg reach at 35%
    J = R.solve(rig, S, T, 0.35, "all", ["foot_n", "foot_f"])
    moved = {f: J[f] for f in ("foot_n", "foot_f") if J[f] != S[f]}
    check(not moved, f"solve: pinned feet stay put when the hip rises out of reach {moved}")
    for s in "nf":
        h, k, f = J[f"hip_{s}"], J[f"knee_{s}"], J[f"foot_{s}"]
        lim = np.hypot(*np.subtract(S[f"knee_{s}"], S[f"hip_{s}"])) + np.hypot(*np.subtract(S[f"foot_{s}"], S[f"knee_{s}"]))
        check(np.hypot(*np.subtract(f, h)) <= lim + 1.5, f"solve: the {s} leg stays within reach "
              f"({np.hypot(*np.subtract(f, h)):.1f} <= {lim:.1f}; knee {k})")


def run_cloth_chain(check: Callable[[bool, str], None]) -> None:
    """A cloth part may give its chain per keyframe (`chain: {idle: [...], attack: [...]}`): the rig builds, the
    frames render, and its joints join the wind / cast move sets like a plain chain."""
    from gen import monster_anim as MA
    from gen import rig as R
    from gen import selftest_rig as SR
    kfs = SR.keyframes()
    cl = {"c1": (36, 40), "c2": (34, 50)}
    cfg = {**SR.RIG, "keyframes": {k: {**v, **cl, **({"c3": (30, 48)} if k == "attack" else {})}
                                   for k, v in SR.RIG["keyframes"].items()},
           "parts": {**SR.RIG["parts"], "cape": {"kind": "cloth", "radius": 3.0,
                                                 "chain": {"idle": ["chest", "c1", "c2"], "attack": ["chest", "c1", "c3"],
                                                           "hurt": ["chest", "c1", "c2"]}}}}
    try:
        rig = R.Rig(cfg, (80, 80))
        gen = MA.generate("synthetic_cloth", cfg, kfs, SR.META)
        moves, _ = MA._joint_sets(rig, "atk_wind1", MA.RECIPES["atk_wind1"], cfg)
    except (TypeError, KeyError, ValueError) as e:
        check(False, f"cloth with a per-keyframe chain builds and renders ({type(e).__name__}: {e})")
        return
    check(len(gen) == 8 and rig.parent.get("c1") == "chest" and rig.parent.get("c3") == "c1",
          f"cloth with a per-keyframe chain builds and renders ({len(gen)} frames)")
    check({"c1", "c2", "c3"} <= set(moves), f"per-keyframe cloth joints join the wind moves {sorted(moves)[-4:]}")


def _two_parts(gap: int) -> tuple[np.ndarray, np.ndarray]:
    """Two light 20x40 slabs side by side (parts 0 and 1), `gap` px apart; returns the image and its label map."""
    a = _rect(10, 20, 30, 60)
    a[20:60, 30 + gap:50 + gap] = (90, 90, 90, 255)
    lab = np.full((80, 80), -1, np.int32)
    lab[20:60, 10:30], lab[20:60, 30 + gap:50 + gap] = 0, 1
    return a, lab


def _compose(arr: np.ndarray, lab: np.ndarray, shift: int) -> tuple[np.ndarray, np.ndarray]:
    """Part 0 in place, part 1 moved `shift` px right, through rigid + composite with the source's own gaps."""
    from gen import rig_render as RR
    pairs = {frozenset((0, 1))}
    gaps = RR.source_gaps(lab, pairs)
    layers = []
    for i, dx in ((0, 0), (1, shift)):
        rgba, hit, mapped = RR.rigid(arr, lab == i, (40.0, 40.0), (40.0 + dx, 40.0), 0.0, (80, 80), gaps)
        layers.append((i, rgba, hit, mapped))
    return RR.composite(layers, (80, 80), pairs)


def run_kept_gaps(check: Callable[[bool, str], None]) -> None:
    """rig_render.composite: the joint-crack fill and the outline repair close only cracks the motion created; a gap
    the approved art already has between two parts that did not move apart stays open (troll far arm / belly,
    cockatrice coil channel), and the seam and hole checks accept it."""
    from gen import anim_checks as C
    arr, lab = _two_parts(2)
    try:
        img, out = _compose(arr, lab, 0)
    except (AttributeError, TypeError) as e:                          # before the fix: no source-gap inputs
        check(False, f"composite: an unmoved approved 2 px gap between two parts stays open ({e})")
        return
    open_px = int((img[20:60, 30:32, 3] == 0).sum())
    check(open_px == 80, f"composite: an unmoved approved 2 px gap between two parts stays open ({open_px} / 80 px)")
    check(not C.seam_gaps(img, out, 0, {frozenset((0, 1))}), "seam check: the approved gap is not a seam gap")
    check(not C.new_holes(img, arr, 4, out), "hole check: the approved gap is not a new hole")
    arr, lab = _two_parts(0)
    img, out = _compose(arr, lab, 1)
    filled = int((img[20:60, 30, 3] > 0).sum())
    check(filled == 40, f"composite: a 1 px crack the motion opened is still closed ({filled} / 40 px)")


def run_fixes(check: Callable[[bool, str], None]) -> None:
    run_iou_bound(check)
    run_per_foot(check)
    run_pinned_reach(check)
    run_cloth_chain(check)
    run_kept_gaps(check)

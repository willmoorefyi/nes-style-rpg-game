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


def run_fixes(check: Callable[[bool, str], None]) -> None:
    run_iou_bound(check)
    run_per_foot(check)
    run_pinned_reach(check)
    run_cloth_chain(check)

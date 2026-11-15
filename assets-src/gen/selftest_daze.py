"""Pass F (docs/FEEDBACK_PLAN_2026-11-14.md 3.5a, 3.7b) framework self-tests, run from selftest.py (test_monster_anim):
the shared `daze` / `daze_b` recipe with its symbolic `head` tweak, the missing-head error, the hurt_in1 hold fallback,
the per-sequence holds cap and spans, and the heavy raise frames around an `attack_raise` keyframe. Synthetic biped
from selftest_rig.py (no approved art)."""
from __future__ import annotations

import copy
from typing import Callable

import numpy as np

from gen import selftest_rig as SR

# a raised two-handed pose for the heavy attack: both fists over the head, the dagger pointing up
RAISE = {**SR.IDLE, "sh_n": (44, 34), "el_n": (47, 25), "hand_n": (45, 16), "tip": (44, 8), "sh_f": (36, 34),
         "el_f": (35, 25), "hand_f": (41, 16)}


def footed() -> dict:
    """The synthetic biped with foot parts ([foot, toe], as every act-1 rig has): the paws ride the pinned ankles."""
    cfg = copy.deepcopy(SR.RIG)
    for kf in cfg["keyframes"].values():
        kf.update({"toe_n": (kf["foot_n"][0] + 4, kf["foot_n"][1]), "toe_f": (kf["foot_f"][0] - 4, kf["foot_f"][1])})
    cfg["parts"].update({"ft_n": {"bone": ["foot_n", "toe_n"], "radius": 3.0}, "ft_f": {"bone": ["foot_f", "toe_f"], "radius": 3.0}})
    return cfg


def _gen(cfg: dict, keyframes=None):
    from gen import monster_anim as MA
    return MA.generate(cfg.get("sprite", "synthetic"), cfg, keyframes or SR.keyframes(), SR.META)


def _with(**frames) -> dict:
    cfg = footed()
    cfg["frames"] = frames
    return cfg


def _fails(cfg: dict, name: str, gen: dict, keyframes=None) -> list[str]:
    from gen import monster_check as MC
    rep = MC.check_sprite("synthetic", cfg, keyframes or SR.keyframes(), SR.META, gen, with_lock=False)
    return rep.get(name, [])


def run_daze(check: Callable[[bool, str], None]) -> None:
    from gen import anim_checks as C
    from gen import monster_anim as MA
    base = footed()
    gen = _gen(base)
    check({"daze", "daze_b"} <= set(gen) and len(gen) == 10, f"a rigged monster gets daze and daze_b (10 generated "
                                                              f"frames: {sorted(gen)})")
    bad = [f"{k}: {e}" for k in ("daze", "daze_b", "sequence:daze") for e in _fails(base, k, gen)
           if not any(t in e for t in SR.TUNING)]
    check(not bad, f"synthetic daze / daze_b pass the construction checks (feet pinned, 35% rule, ...) {bad[:3]}")
    S, J, Jb = SR.IDLE, gen["daze"]["joints"], gen["daze_b"]["joints"]
    drop = (J["crown"][1] - J["chest"][1]) - (S["crown"][1] - S["chest"][1])
    check(drop >= 1 and J["neck"][1] - J["chest"][1] - (S["neck"][1] - S["chest"][1]) >= 1,
          f"the recipe's shared head tweak [1, 1] lowers crown and neck against the chest (crown {drop:+.0f} px)")
    check(Jb["chest"][1] - J["chest"][1] == 1, f"daze_b sways 1 px lower than daze (chest {J['chest']} -> {Jb['chest']})")
    more = _gen(_with(daze={"tweaks": {"crown": [0, 1], "neck": [0, 1]}}))["daze"]["joints"]
    check(more["crown"][1] == J["crown"][1] + 1 and more["neck"][1] == J["neck"][1] + 1,
          "a rig's frames.daze tweaks add to the recipe's (per joint; the recipe's head = crown + neck)")
    check(MA._tweaks({"head": [1, 1]}, {"head": [2, 0]}, ("head", "snout")) == {"head": [3, 1], "snout": [1, 1]},
          "a beast rig's own `head` tweak is its real joint, only the recipe's `head` is symbolic (locks unchanged)")
    from gen import rig as R
    check(R.BODY["quadruped"]["head"] == ("head", "snout") and R.BODY["bird"]["head"] == ("head", "beak")
          and R.BODY["biped"]["head"] == ("crown", "neck"), "head joints per body template (biped, quadruped, bird)")
    up = {j: [0, -1] for j in ("hip_n", "knee_n", "foot_n", "toe_n", "hip_f", "knee_f", "foot_f", "toe_f")}
    lifted = _gen(_with(daze={"tweaks": up}))
    f = _fails(base, "daze", lifted)
    check(any("lowest opaque row" in e or "foot" in e for e in f), f"daze: feet lifted 1 px fail the feet check {f[:1]}")
    far = _with(daze={"t": 0.40})
    f = _fails(far, "daze", _gen(far))
    check(any("more than 0.35" in e for e in f), f"daze: t 0.40 fails the near-keyframe rule {f[:1]}")
    nohead = footed()
    nohead["sprite"] = "headless"
    nohead["keyframes"]["idle"] = {k: v for k, v in SR.IDLE.items() if k != "crown"}
    try:
        _gen(nohead)
        err = ""
    except ValueError as e:
        err = str(e)
    check("headless" in err and "crown" in err, f"a rig with no head joint raises an error naming the rig ({err[:70]})")
    held = footed()
    held["holds"] = [{"frame": "daze", "reason": "selftest"}]
    hg = _gen(held)
    have = {**SR.keyframes(), **hg}
    check("daze" not in hg and "daze_b" not in hg and MA.resolve("daze", have) == "hurt_in1"
          and MA.resolve("daze_b", have) == "hurt_in1", "a daze hold aliases daze and daze_b to hurt_in1 (not idle)")
    rep = _fails(held, "sequence:daze", hg)
    check(not any("daze" in e and "KeyError" in e for e in rep), "a held daze still runs its sequence check")
    check(not C.holds_cap(["daze", "atk_mid"]) and bool(C.holds_cap(["daze", "daze_b"])),
          "holds cap per sequence covers daze (2 daze holds fail, one daze + one attack pass)")
    check(MA.span_of("attack", 0) == ("idle", "attack") and MA.span_of("attack", 5) == ("attack", "idle")
          and MA.span_of("daze", 1) == ("idle", "hurt") and MA.span_of("cast", 3) == ("idle", "cast"),
          "sequence spans: the keyframes around each step, else the sequence's SPAN")
    run_heavy(check)
    run_ledger(check)


def run_ledger(check: Callable[[bool, str], None]) -> None:
    """FB-8 (plan §7): pass F's own Gemini cap in budget.json `passes`, enforced by check_budget, and the real ledger."""
    import json
    from types import SimpleNamespace
    from gen import generate as GEN
    cap = next(p for p in json.loads(GEN.BUDGET.read_text())["passes"] if p["name"].startswith("pass F"))
    led = GEN.read_ledger()
    gem = [e for e in led if e.get("event") == "attempt" and e.get("backend") != "bedrock"]
    new = gem[cap["gemini_before"]:]
    per = {}
    for e in new:
        per[(e["character"], e["sheet"])] = per.get((e["character"], e["sheet"]), 0) + 1
    check(len(new) <= cap["max_new"] and all(n <= cap["max_per_sheet"] for n in per.values())
          and all(s == "boss_attack_raise" and c in ("garland", "lich") for c, s in per)
          and per.get(("garland", "boss_attack_raise"), 0) <= 2,
          f"ledger: pass F made {len(new)} Gemini attempts (<= {cap['max_new']}, <= {cap['max_per_sheet']} per sheet, "
          f"garland <= 2 by decision, garland / lich boss_attack_raise only): {per}")
    end = cap["gemini_before"] - json.loads(GEN.BUDGET.read_text())["attempts_before"] + cap["max_new"]
    check(len(gem) - json.loads(GEN.BUDGET.read_text())["attempts_before"] <= end,
          f"the run budget ends at <= {end} (pass F's cap; 2026-11-15: the user raised it by one lich attempt)")

    def refused(n_new: int, sheet: str) -> bool:
        fake = gem[:cap["gemini_before"]] + [{"event": "attempt", "backend": "gemini", "character": "lich",
                                               "sheet": sheet}] * n_new
        req = SimpleNamespace(cached=False, character="lich", sheet=SimpleNamespace(name="boss_attack_raise"))
        try:
            GEN.check_budget([req], paid=True, max_paid=1, retry=True, ledger=fake)
        except SystemExit as e:
            return "refused" in str(e)          # pass F's cap, or the run's per-sheet cap when it is the same (3)
        return False
    per_sheet, total = cap["max_per_sheet"], cap["max_new"]
    check(refused(per_sheet, "boss_attack_raise") and refused(total, "kit_x")
          and not refused(per_sheet - 1, "boss_attack_raise"),
          f"check_budget refuses attempt {per_sheet + 1} at one pass F sheet and attempt {total + 1} in total")


def run_heavy(check: Callable[[bool, str], None]) -> None:
    from gen import anim_checks as C
    from gen import monster_anim as MA
    kfs = {**SR.keyframes(), "attack_raise": SR.draw(RAISE, True)}
    cfg = copy.deepcopy(SR.RIG)
    cfg["keyframes"]["attack_raise"] = RAISE
    cfg["parts"]["dagger"]["bone"]["attack_raise"] = ["hand_n", "tip"]
    cfg["parts"]["dagger"]["in"] = ["idle", "attack", "attack_raise"]
    gen = _gen(cfg, kfs)
    want = {"atk_raise_in", "atk_raise_b", "atk_swing", "atk_swing2"}
    check(want <= set(gen) and len(gen) == 14, f"an attack_raise keyframe adds the 4 heavy in-betweens ({sorted(gen)})")
    check(gen["atk_swing2"]["src"] == "attack" and gen["atk_swing"]["src"] == "attack_raise",
          "atk_swing is cut from attack_raise, atk_swing2 (the heavy mid frame) from attack")
    from gen import monster_check as MC
    rep = MC.check_sprite("synthetic", cfg, kfs, SR.META, gen, with_lock=False)
    plain = MC.check_sprite("synthetic", SR.RIG, SR.keyframes(), SR.META, None, with_lock=False)
    check("sequence:heavy" in rep and "sequence:daze" in rep and "sequence:heavy" not in plain,
          "the continuity checks visit the daze and heavy sequences (heavy only with an attack_raise key)")
    check(MA.span_of("heavy", 4) == ("attack_raise", "attack") and MA.span_of("heavy", 0) == ("idle", "attack_raise"),
          "heavy spans: idle->attack_raise for the raise, attack_raise->attack for the swing")
    check(MA.frames_for(True, True)[-5:] == MA.RAISE_FRAMES and "attack_raise" not in MA.frames_for(True),
          "frames_for lists the raise frames only for a sheet with attack_raise")
    check(bool(C.holds_cap(["atk_swing", "atk_raise_b"])), "holds cap: 2 holds in the heavy sequence fail")
    b = gen["atk_raise_b"]["img"]
    low = int(np.where((b[..., 3] > 0).any(1))[0].max())
    check(low == SR.META["bottom_row"], f"atk_raise_b keeps its feet on the plain (row {low})")

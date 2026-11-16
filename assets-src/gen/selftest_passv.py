"""Pass V (docs/REDESIGN_PLAN.md 6, FW-V0) budget-guard self-tests, run from selftest.py (test_monster_anim, also
--anim). The real budget.json is pinned field by field to the literals below; the guard is then driven with the real
budget over fake ledgers (the real ledger's first N_V0 Gemini attempts plus fake ones): the 51st pass-V attempt, the
4th attempt at one sheet, fresh per-sheet counts at N_V0, `only_ids`, `only_sheets` (hollow_seraph/boss_attack_raise
under D-V9), the consistency guard, and that `history` is never read. Last, the real ledger's pass-V slice.

  python3 -I assets-src/gen/selftest_passv.py
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# literals (rev 5): never computed from the ledger
N_V0 = 367                      # Gemini attempts in the main-checkout ledger when pass V opened (V1, re-counted)
PASS_R = (100, 300)             # pass R: attempts_before, cap
R_FIX = (363, 37)               # pass R fix: gemini_before, max_new
CAP_V, PER_SHEET = 50, 3
ONLY_IDS = ["crazy_horse", "piscodemon", "black_knight", "guardian", "vampire", "hollow_seraph", "chaos"]
ONLY_SHEETS = {"crazy_horse": ["monster_large"], "piscodemon": ["monster_small"], "black_knight": ["monster_small"],
               "guardian": ["monster_large"], "vampire": ["monster_small"],
               "hollow_seraph": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt"],
               "chaos": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt", "boss_attack_raise"]}
# append-only: later passes may add entries after this prefix, never change it
HISTORY_PREFIX = [{"name": "pass R", "attempts_before": PASS_R[0], "cap": PASS_R[1], "gemini_end": N_V0,
                   "max_attempts_per_sheet": 3}]


def _passes(b: dict) -> dict[str, dict]:
    return {p["name"]: p for p in b.get("passes", [])}


def run_passv(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen.selftest_roster import _fake, _gemini, _refused, _verdict
    real = json.loads(GEN.BUDGET.read_text())
    p = _passes(real)
    pv, fix, build, pf = (p.get(n, {}) for n in ("pass V", "pass R fix", "pass R build", "pass F (FB-8)"))

    # pinned literals
    check((real.get("attempts_before"), real.get("cap"), real.get("max_attempts_per_sheet")) == (N_V0, CAP_V, PER_SHEET),
          f"budget.json top level: attempts_before {N_V0} (literal N_V0), cap {CAP_V}, {PER_SHEET} per sheet "
          f"({real.get('attempts_before')}, {real.get('cap')}, {real.get('max_attempts_per_sheet')})")
    hist = real.get("history")
    check(isinstance(hist, list) and hist[:len(HISTORY_PREFIX)] == HISTORY_PREFIX,
          f"budget.json history starts with the pinned pass-R entry (append-only): {hist}")
    check((pf.get("gemini_before"), pf.get("gemini_end"), build.get("gemini_before"), build.get("gemini_end"),
           build.get("max_new")) == (95, PASS_R[0], PASS_R[0], R_FIX[0], 285),
          "budget.json: pass F (95..100) and pass R build (100..363, 285) unchanged and closed")
    check((fix.get("gemini_before"), fix.get("max_new"), fix.get("max_per_sheet"), fix.get("only_approved"),
           fix.get("gemini_end")) == (*R_FIX, 3, True, N_V0),
          f"budget.json: pass R fix ({R_FIX[0]}, {R_FIX[1]}) closed at gemini_end {N_V0} ({fix})")
    check(pv.get("gemini_before") == N_V0 and pv.get("max_new") == CAP_V and pv.get("max_per_sheet") == PER_SHEET
          and "gemini_end" not in pv and pv.get("only_ids") == ONLY_IDS and pv.get("only_sheets") == ONLY_SHEETS,
          f"budget.json: pass V open at {N_V0}, {CAP_V} new, {PER_SHEET} per sheet, only the 7 ids and their sheets")

    gem = _gemini(GEN.read_ledger())
    base = gem[:N_V0]
    check(len(base) == N_V0, f"the real ledger has at least N_V0 = {N_V0} Gemini attempts ({len(gem)})")
    approved = GEN.HERE / "approved"

    def v(budget: dict, led: list[dict], cid: str, sheet: str) -> str:
        return _verdict(budget, led, cid, sheet, approved)

    # the 51st pass-V attempt is refused, the 50th is not
    led = base + [_fake(f"pv{i}", "monster_small") for i in range(CAP_V)]
    v51, v50 = v(real, led, "chaos", "boss_idle"), v(real, led[:-1], "chaos", "boss_idle")
    check(_refused(v51) and v50 == "", f"pass V: attempt {CAP_V + 1} is refused ({v51[:80]!r}), attempt {CAP_V} is "
                                       f"not ({v50[:60]!r})")
    # 4th attempt at one sheet in pass V refused, 3rd not
    led3 = base + [_fake("crazy_horse", "monster_large")] * PER_SHEET
    v4, v3 = v(real, led3, "crazy_horse", "monster_large"), v(real, led3[:-1], "crazy_horse", "monster_large")
    check(_refused(v4) and v3 == "", f"pass V: attempt {PER_SHEET + 1} at one sheet is refused ({v4[:80]!r}), attempt "
                                     f"{PER_SHEET} is not ({v3[:60]!r})")
    # fresh counts: chaos/boss_attack has 3 pass-R attempts and still gets its 1st pass-V attempt
    prior = sum(e.get("character") == "chaos" and e.get("sheet") == "boss_attack" for e in base[PASS_R[0]:])
    vf = v(real, base, "chaos", "boss_attack")
    check(prior == 3 and vf == "", f"pass V: fresh per-sheet counts at N_V0, chaos/boss_attack ({prior} pass-R "
                                   f"attempts) gets its 1st pass-V attempt ({vf[:70]!r})")
    vg = v(real, base, "guardian", "monster_large")
    check(vg == "", f"pass V: guardian/monster_large (3 pass-R attempts) is allowed ({vg[:70]!r})")
    # only_ids, only_sheets
    vo = v(real, base, "goblin", "monster_small")
    check(_refused(vo) and "pass V" in vo and "goblin" in vo and "only_ids" in vo,
          f"pass V: goblin/monster_small is refused by only_ids, naming the pass and the id ({vo[:100]!r})")
    vr = v(real, base, "hollow_seraph", "boss_attack_raise")
    check(_refused(vr) and "pass V" in vr and "hollow_seraph/boss_attack_raise" in vr and "only_sheets" in vr,
          f"pass V: hollow_seraph/boss_attack_raise is refused by only_sheets (D-V9) ({vr[:100]!r})")
    vs = v(real, base, "crazy_horse", "monster_small")
    check(_refused(vs) and "only_sheets" in vs, f"pass V: a sheet not listed for a listed id is refused ({vs[:90]!r})")
    vc = v(real, base, "chaos", "boss_attack_raise")
    check(vc == "", f"pass V: chaos/boss_attack_raise is allowed ({vc[:70]!r})")

    # the consistency guard
    ahead = {**real, "attempts_before": N_V0 + 1}
    va = v(ahead, base, "chaos", "boss_idle")
    check(_refused(va) and "inconsistent" in va and "attempts_before" in va,
          f"consistency: attempts_before > the ledger's Gemini attempts is refused ({va[:100]!r})")
    for label, edit in (("pass V.gemini_before", lambda b: _passes(b)["pass V"].update(gemini_before=N_V0 - 1)),
                        ("pass R fix.gemini_end", lambda b: _passes(b)["pass R fix"].update(gemini_end=N_V0 - 1)),
                        ("attempts_before", lambda b: b.update(attempts_before=N_V0 - 1))):
        bad = copy.deepcopy(real)
        try:
            edit(bad)
        except KeyError as e:                       # RED before FW-V0: no pass V / pass R fix to edit
            check(False, f"consistency: budget.json has no {e} entry to edit")
            continue
        vb = v(bad, base, "chaos", "boss_idle")
        check(_refused(vb) and "inconsistent" in vb, f"consistency: a different {label} is refused ({vb[:100]!r})")
    open_fix = copy.deepcopy(real)
    _passes(open_fix).get("pass R fix", {}).pop("gemini_end", None)
    vo2 = v(open_fix, base, "chaos", "boss_idle")
    check(_refused(vo2) and "inconsistent" in vo2, f"consistency: an open pass R fix beside pass V is refused ({vo2[:90]!r})")

    # history is never read
    no_hist = {k: x for k, x in real.items() if k != "history"}
    junk = {**real, "history": [{"name": "pass R", "attempts_before": 0, "cap": 0, "gemini_end": 0}, "junk"]}
    same = all(v(b, base, c, s) == v(real, base, c, s) for b in (no_hist, junk)
               for c, s in (("chaos", "boss_attack"), ("goblin", "monster_small"), ("hollow_seraph", "boss_attack_raise")))
    check(same, "the guard never reads history (no history, or a junk history, gives the same verdicts)")

    # the real ledger's pass-V slice
    run = gem[N_V0:]
    per: dict = {}
    for e in run:
        per[(e["character"], e["sheet"])] = per.get((e["character"], e["sheet"]), 0) + 1
    foreign = sorted(k for k in per if k[1] not in ONLY_SHEETS.get(k[0], []))
    check(len(run) <= CAP_V and not foreign and all(n <= PER_SHEET for n in per.values()),
          f"ledger: pass V used {len(run)} of {CAP_V}, max per sheet {max(per.values(), default=0)} <= {PER_SHEET}, "
          f"foreign {foreign}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_passv(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

"""Pass V (docs/REDESIGN_PLAN.md 6, FW-V0) budget-guard self-tests, run from selftest.py (test_monster_anim, also
--anim). The real budget.json is pinned field by field to the literals below; the guard is then driven with the real
budget over fake ledgers (the real ledger's first N_V0 Gemini attempts plus fake ones): the 51st pass-V attempt, the
4th attempt at one sheet, fresh per-sheet counts at N_V0, `only_ids`, `only_sheets` (hollow_seraph/boss_attack_raise
under D-V9), the consistency guard, and that `history` is never read. FW-V8 (docs/REDESIGN_FIX_PLAN.md 1, rev 5):
the pass-V `sheet_caps` map, read by both per-sheet rules of `check_budget` and checked by `budget_consistency`.
Last, the real ledger's pass-V slice (within the caps and the V8 halt of 47). Since pass KA-G (docs/KNEEL_AI_PLAN.md
rev 7 section 5) pass V is closed at N_V_END = 405: the real budget.json is pinned to the closed pass V and the KA-G top
level, and the pass-V guard cases run on `pv_open(real)`, the real budget as it stood while pass V was open.

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
ONLY_IDS_V1 = ["crazy_horse", "piscodemon", "black_knight", "guardian", "vampire", "hollow_seraph", "chaos"]
# the orchestrator's V3 addition (2026-11-16): the red dragon's low, wide approved pose cannot reach the size step
# by rescale, so it is redesigned within the same 50 (monster_large only); later additions append after it
ONLY_IDS = ONLY_IDS_V1 + ["dragon"]
ONLY_SHEETS = {"crazy_horse": ["monster_large"], "piscodemon": ["monster_small"], "black_knight": ["monster_small"],
               "guardian": ["monster_large"], "vampire": ["monster_small"],
               "hollow_seraph": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt"],
               "chaos": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt", "boss_attack_raise"],
               "dragon": ["monster_large"]}
# FW-V8 (rev 5 ruling, D-U1 = b, D-U2 = b; user 2026-11-16): per-sheet caps above PER_SHEET; every other sheet stays 3
SHEET_CAPS = {"hollow_seraph/boss_idle": 6, "hollow_seraph/boss_attack": 6, "hollow_seraph/boss_cast": 5,
              "hollow_seraph/boss_hurt": 4, "crazy_horse/monster_large": 5}
V8_HALT = 47                    # this round stops generating at 47 pass-V images (the guard's cap stays CAP_V)
N_V_END = 405                   # pass V closed here when pass KA-G opened (38 of 50 used)
KAG_TOP = (405, 665, 4)         # the top level since pass KA-G: attempts_before, cap, max attempts per sheet
PASS_V_HISTORY = {"name": "pass V", "attempts_before": N_V0, "cap": CAP_V, "gemini_end": N_V_END,
                  "max_attempts_per_sheet": PER_SHEET}
# append-only: later passes may add entries after this prefix, never change it
HISTORY_PREFIX = [{"name": "pass R", "attempts_before": PASS_R[0], "cap": PASS_R[1], "gemini_end": N_V0,
                   "max_attempts_per_sheet": 3}]


def _passes(b: dict) -> dict[str, dict]:
    return {p["name"]: p for p in b.get("passes", [])}


def pv_open(b: dict) -> dict:
    """The real budget as it stood while pass V was open: the pass-V top level, pass V without gemini_end, no later
    pass, the history up to the pass-R entry."""
    o = copy.deepcopy(b)
    o.update(attempts_before=N_V0, cap=CAP_V, max_attempts_per_sheet=PER_SHEET,
             history=o["history"][:len(HISTORY_PREFIX)])
    names = [x["name"] for x in o["passes"]]
    o["passes"] = o["passes"][:names.index("pass V") + 1]
    o["passes"][-1].pop("gemini_end", None)
    return o


def run_passv(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen.selftest_roster import _fake, _gemini, _refused, _verdict
    closed = json.loads(GEN.BUDGET.read_text())
    pvc = _passes(closed).get("pass V", {})
    check((closed.get("attempts_before"), closed.get("cap"), closed.get("max_attempts_per_sheet")) == KAG_TOP
          and pvc.get("gemini_end") == N_V_END,
          f"budget.json top level: pass KA-G's {KAG_TOP}; pass V closed at gemini_end {N_V_END} "
          f"({closed.get('attempts_before')}, {closed.get('cap')}, {pvc.get('gemini_end')})")
    hist = closed.get("history")
    check(isinstance(hist, list) and hist[:len(HISTORY_PREFIX)] == HISTORY_PREFIX
          and hist[len(HISTORY_PREFIX):len(HISTORY_PREFIX) + 1] == [PASS_V_HISTORY],
          f"budget.json history: the pinned pass-R entry, then pass V closed at {N_V_END} (append-only): {hist}")
    real = pv_open(closed)
    p = _passes(real)
    pv, fix, build, pf = (p.get(n, {}) for n in ("pass V", "pass R fix", "pass R build", "pass F (FB-8)"))

    # pinned literals (pass V's own fields are unchanged by its close)
    check((real.get("attempts_before"), real.get("cap"), real.get("max_attempts_per_sheet")) == (N_V0, CAP_V, PER_SHEET),
          f"pv_open: the pass-V top level attempts_before {N_V0} (literal N_V0), cap {CAP_V}, {PER_SHEET} per sheet")
    check((pf.get("gemini_before"), pf.get("gemini_end"), build.get("gemini_before"), build.get("gemini_end"),
           build.get("max_new")) == (95, PASS_R[0], PASS_R[0], R_FIX[0], 285),
          "budget.json: pass F (95..100) and pass R build (100..363, 285) unchanged and closed")
    check((fix.get("gemini_before"), fix.get("max_new"), fix.get("max_per_sheet"), fix.get("only_approved"),
           fix.get("gemini_end")) == (*R_FIX, 3, True, N_V0),
          f"budget.json: pass R fix ({R_FIX[0]}, {R_FIX[1]}) closed at gemini_end {N_V0} ({fix})")
    check(pv.get("gemini_before") == N_V0 and pv.get("max_new") == CAP_V and pv.get("max_per_sheet") == PER_SHEET
          and "gemini_end" not in pv and pv.get("only_ids") == ONLY_IDS and pv.get("only_sheets") == ONLY_SHEETS,
          f"budget.json: pass V open at {N_V0}, {CAP_V} new, {PER_SHEET} per sheet, only the {len(ONLY_IDS)} ids and their "
          f"sheets ({pv.get('only_ids')})")
    ids = pv.get("only_ids") or []
    check(ids[:len(ONLY_IDS_V1)] == ONLY_IDS_V1 and len(ONLY_IDS) == 8,
          f"budget.json: pass V only_ids keeps the V1 seven first, in order; additions only append ({ids})")

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
    # 4th attempt at a sheet without a sheet_caps entry refused, 3rd not
    led3 = base + [_fake("piscodemon", "monster_small")] * PER_SHEET
    v4, v3 = v(real, led3, "piscodemon", "monster_small"), v(real, led3[:-1], "piscodemon", "monster_small")
    check(_refused(v4) and v3 == "", f"pass V: attempt {PER_SHEET + 1} at piscodemon/monster_small (no sheet_caps "
                                     f"entry) is refused ({v4[:80]!r}), attempt {PER_SHEET} is not ({v3[:60]!r})")

    # FW-V8: the literal sheet_caps map, then each cap allows its last attempt and refuses the next
    check(pv.get("sheet_caps") == SHEET_CAPS, f"budget.json: pass V sheet_caps is the rev-5 map ({pv.get('sheet_caps')})")
    for key, n in SHEET_CAPS.items():
        cid, sheet = key.split("/")
        led_n = base + [_fake(cid, sheet)] * n
        over, last, fourth = v(real, led_n, cid, sheet), v(real, led_n[:-1], cid, sheet), v(real, led_n[:N_V0 + 3], cid, sheet)
        check(_refused(over) and last == "" and fourth == "",
              f"sheet_caps: {key} attempt 4 and attempt {n} allowed, attempt {n + 1} refused "
              f"({fourth[:40]!r}, {last[:40]!r}, {over[:70]!r})")
    # both per-sheet rules read sheet_caps: either rule alone at 3 would refuse the 4th hollow_seraph/boss_idle
    led_s = base + [_fake("hollow_seraph", "boss_idle")] * 3
    no_caps = copy.deepcopy(real)
    _passes(no_caps).get("pass V", {}).pop("sheet_caps", None)
    top_only = copy.deepcopy(real)                  # the pass rule loosened: only the top-level rule can refuse
    _passes(top_only).get("pass V", {}).update(max_per_sheet=9, sheet_caps={})
    pass_only = {**copy.deepcopy(real), "max_attempts_per_sheet": 9}   # only the pass rule can refuse
    _passes(pass_only).get("pass V", {}).pop("sheet_caps", None)
    vn, vt, vp = (v(b, led_s, "hollow_seraph", "boss_idle") for b in (no_caps, top_only, pass_only))
    check(_refused(vn) and _refused(vt) and "max 3" in vt and _refused(vp) and "per sheet" in vp,
          f"sheet_caps: without the map the 4th hollow_seraph/boss_idle is refused by the top-level rule ({vt[:70]!r}) "
          f"and by the pass rule ({vp[:70]!r})")
    vb3 = v(real, base + [_fake("black_knight", "monster_small")] * 3, "black_knight", "monster_small")
    check(_refused(vb3), f"sheet_caps: black_knight/monster_small (2 used, cap 3) is refused at its 4th ({vb3[:70]!r})")
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
    vd, vds = v(real, base, "dragon", "monster_large"), v(real, base, "dragon", "monster_small")
    check(vd == "" and _refused(vds) and "only_sheets" in vds,
          f"pass V: dragon/monster_large is allowed (the V3 addition), dragon/monster_small refused ({vd[:60]!r}; "
          f"{vds[:80]!r})")
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
    # FW-V8: a bad sheet_caps entry refuses every paid request and names the entry
    for label, caps in (("a cap of 7", {"hollow_seraph/boss_idle": 7}), ("a cap of 2", {"crazy_horse/monster_large": 2}),
                        ("a non-integer cap", {"hollow_seraph/boss_idle": "6"}), ("a bool cap", {"vampire/monster_small": True}),
                        ("an unknown sheet", {"hollow_seraph/boss_attack_raise": 4}),
                        ("a non-listed id", {"goblin/monster_small": 4}), ("a key without a sheet", {"hollow_seraph": 4})):
        bad = copy.deepcopy(real)
        _passes(bad)["pass V"]["sheet_caps"] = {**SHEET_CAPS, **caps}
        bad_key = next(iter(caps))
        verdicts = [v(bad, base, c, s) for c, s in (("chaos", "boss_idle"), ("dragon", "monster_large"))]
        check(all(_refused(x) and "inconsistent" in x and "sheet_caps" in x and bad_key in x for x in verdicts),
              f"consistency: {label} in sheet_caps refuses every paid request, naming {bad_key} ({verdicts[0][:110]!r})")
    open_fix = copy.deepcopy(real)
    _passes(open_fix).get("pass R fix", {}).pop("gemini_end", None)
    vo2 = v(open_fix, base, "chaos", "boss_idle")
    check(_refused(vo2) and "inconsistent" in vo2, f"consistency: an open pass R fix beside pass V is refused ({vo2[:90]!r})")

    # history is never read
    no_hist = {k: x for k, x in real.items() if k != "history"}
    junk = {**real, "history": [{"name": "pass R", "attempts_before": 0, "cap": 0, "gemini_end": 0}, "junk"]}
    same = all(v(b, base, c, s) == v(real, base, c, s) for b in (no_hist, junk)
               for c, s in (("chaos", "boss_attack"), ("goblin", "monster_small"), ("hollow_seraph", "boss_attack_raise")))
    led6 = base + [_fake("hollow_seraph", "boss_idle")] * 5
    same = same and all(v(b, led6, "hollow_seraph", "boss_idle") == "" for b in (no_hist, junk))
    check(same, "the guard never reads history (no history, or a junk history, gives the same verdicts)")

    # the real ledger's pass-V slice
    run = gem[N_V0:N_V_END]
    per: dict = {}
    for e in run:
        per[(e["character"], e["sheet"])] = per.get((e["character"], e["sheet"]), 0) + 1
    foreign = sorted(k for k in per if k[1] not in ONLY_SHEETS.get(k[0], []))
    over = sorted(f"{c}/{s}: {n}" for (c, s), n in per.items() if n > SHEET_CAPS.get(f"{c}/{s}", PER_SHEET))
    check(len(run) <= V8_HALT <= CAP_V and not foreign and not over,
          f"ledger: pass V used {len(run)} of {CAP_V} (V8 halt {V8_HALT}), every sheet within {PER_SHEET} or its "
          f"sheet_caps entry (over: {over}), foreign {foreign}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_passv(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

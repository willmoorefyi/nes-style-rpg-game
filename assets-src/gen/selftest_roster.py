"""Pass R (docs/ROSTER_PLAN.md 6.4, FW-0) budget-guard self-tests, run from selftest.py (test_monster_anim, also --anim):
the 286th `pass R build` attempt, the 301st pass-R attempt in total, the 4th attempt at one sheet, a closed pass, and
`only_approved` in `pass R fix` are each tested on synthetic budgets over a fake ledger (the real ledger's first N0
Gemini attempts plus fake ones); then the real budget.json entries and the real ledger."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

BUILD_MAX, TOTAL_CAP, PER_SHEET = 285, 300, 3


def _gemini(ledger: list[dict]) -> list[dict]:
    return [e for e in ledger if e.get("event") == "attempt" and e.get("backend") != "bedrock"]


def _fake(character: str, sheet: str = "monster") -> dict:
    return {"event": "attempt", "backend": "gemini", "character": character, "sheet": sheet}


def _budget(n0: int, passes: list[dict]) -> dict:
    return {"note": "selftest", "attempts_before": n0, "cap": TOTAL_CAP, "max_attempts_per_sheet": PER_SHEET,
            "passes": passes}


def _verdict(budget: dict, ledger: list[dict], character: str, sheet: str, approved: Path) -> str:
    """'' when the request is allowed, the refusal message when it is refused, 'ERROR ...' on any other failure."""
    from gen import generate as GEN
    req = SimpleNamespace(cached=False, character=character, sheet=SimpleNamespace(name=sheet))
    try:
        GEN.check_budget([req], paid=True, max_paid=1, retry=True, ledger=ledger, budget=budget, approved_root=approved)
    except SystemExit as e:
        return str(e) or "refused"
    except Exception as e:  # noqa: BLE001 - reported as a failed check, never swallowed
        return f"ERROR {type(e).__name__}: {e}"
    return ""


def _refused(v: str) -> bool:
    return v.startswith("refused")


def run_roster(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    real = json.loads(GEN.BUDGET.read_text())
    build = next((p for p in real.get("passes", []) if p["name"] == "pass R build"), None)
    gem = _gemini(GEN.read_ledger())
    check(build is not None, "budget.json has a 'pass R build' entry")
    n0 = build["gemini_before"] if build else len(gem)     # (RED run before FW-0: the synthetic tests still run)
    base = gem[:n0]
    check(len(base) == n0, f"the real ledger has at least N0 = {n0} Gemini attempts ({len(gem)})")
    pass_f = {"name": "pass F (FB-8)", "gemini_before": 95, "gemini_end": n0, "max_new": 5, "max_per_sheet": 3}
    r_build = {"name": "pass R build", "gemini_before": n0, "max_new": BUILD_MAX, "max_per_sheet": PER_SHEET}
    at_r0 = _budget(n0, [pass_f, r_build])

    with tempfile.TemporaryDirectory() as tmp:
        approved = Path(tmp)
        (approved / "rs_done").mkdir()

        # 286th build attempt (285 on distinct sheets before it)
        led = base + [_fake(f"rs{i}") for i in range(BUILD_MAX)]
        v286 = _verdict(at_r0, led, "rs_new", "monster", approved)
        v285 = _verdict(at_r0, led[:-1], "rs_new", "monster", approved)
        check(_refused(v286) and "pass R build" in v286 and v285 == "",
              f"pass R build: attempt {BUILD_MAX + 1} is refused, naming the pass ({v286[:90]!r}); attempt {BUILD_MAX} "
              f"is not ({v285[:60]!r})")

        # 301st pass-R attempt in total: build closed at N1 = N0 + 285, fix open with 15 left
        n1 = n0 + BUILD_MAX
        closed = {**r_build, "gemini_end": n1}
        r_fix = {"name": "pass R fix", "gemini_before": n1, "max_new": TOTAL_CAP - (n1 - n0), "max_per_sheet": PER_SHEET,
                 "only_approved": True}
        at_fix = _budget(n0, [pass_f, closed, r_fix])
        led = base + [_fake(f"rs{i}") for i in range(TOTAL_CAP)]
        v301 = _verdict(at_fix, led, "rs_done", "monster", approved)
        v300 = _verdict(at_fix, led[:-1], "rs_done", "monster", approved)
        check(_refused(v301) and v300 == "",
              f"pass R in total: attempt {TOTAL_CAP + 1} is refused ({v301[:90]!r}), attempt {TOTAL_CAP} (the 15th fix "
              f"attempt, approved id) is not ({v300[:60]!r})")
        loose = _budget(n0, [pass_f, closed, {**r_fix, "max_new": 100}])
        vtop = _verdict(loose, led, "rs_done", "monster", approved)
        check(_refused(vtop) and "run cap" in vtop,
              f"the top-level cap {TOTAL_CAP} stays authoritative over a fix pass that would allow more ({vtop[:90]!r})")

        # 4th attempt at one sheet in pass R refused, 3rd not
        led3 = base + [_fake("rs_done")] * PER_SHEET
        v4 = _verdict(at_r0, led3, "rs_done", "monster", approved)
        v3 = _verdict(at_r0, led3[:-1], "rs_done", "monster", approved)
        check(_refused(v4) and v3 == "", f"pass R: attempt {PER_SHEET + 1} at one sheet is refused ({v4[:90]!r}), "
                                         f"attempt {PER_SHEET} is not ({v3[:60]!r})")
        prior = [_fake("lich", "boss_attack_raise")] * 3     # pass F's per-sheet 3 at the lich, before N0
        led_l = gem[:n0 - 3] + prior + [_fake("lich", "boss_attack_raise")] * 2
        vl = _verdict(at_r0, led_l, "lich", "boss_attack_raise", approved)
        check(vl == "", f"per-sheet counts start at N0: a sheet with 3 attempts before N0 and 2 after may try once "
                        f"more ({vl[:70]!r})")

        # a closed pass is ignored; the same pass open refuses (control)
        tight = {"name": "pass T", "gemini_before": 0, "max_new": 0, "max_per_sheet": 1}
        vc = _verdict(_budget(n0, [{**tight, "gemini_end": n0}]), base, "rs_new", "monster", approved)
        vo = _verdict(_budget(n0, [tight]), base, "rs_new", "monster", approved)
        check(vc == "" and _refused(vo), f"a closed pass (gemini_end) refuses nothing ({vc[:60]!r}); open, the same "
                                         f"pass refuses ({vo[:60]!r})")
        vf = _verdict(at_r0, base + [_fake("lich", "boss_attack_raise")], "lich", "boss_attack_raise", approved)
        check(vf == "", f"closed pass F does not refuse a 6th attempt after its start ({vf[:70]!r})")

        # pass R fix: only ids with approved/<id>/
        led_f = base + [_fake(f"rs{i}") for i in range(n1 - n0)]
        vu = _verdict(at_fix, led_f, "rs_unbuilt", "monster", approved)
        va = _verdict(at_fix, led_f, "rs_done", "monster", approved)
        check(_refused(vu) and "pass R fix" in vu and "rs_unbuilt" in vu and va == "",
              f"pass R fix refuses an id without approved/<id>/, naming the pass and the id ({vu[:90]!r}); an approved "
              f"id is allowed ({va[:60]!r})")
        vb = _verdict(at_r0, base, "rs_unbuilt", "monster", approved)
        check(vb == "", f"pass R build (no only_approved) allows an unbuilt id ({vb[:60]!r})")

    # the real budget.json entries (FW-0) and the real ledger
    if build is None:
        return
    f = next((p for p in real["passes"] if p["name"] == "pass F (FB-8)"), {})
    check(real["attempts_before"] == n0 and real["cap"] == TOTAL_CAP and real["max_attempts_per_sheet"] == PER_SHEET
          and f.get("gemini_end") == n0 and build["max_new"] == BUILD_MAX and build["max_per_sheet"] == PER_SHEET,
          f"budget.json: attempts_before = N0 = {n0}, cap {TOTAL_CAP}, 3 per sheet; pass F closed at N0; pass R build "
          f"{BUILD_MAX}")
    fix = next((p for p in real["passes"] if p["name"] == "pass R fix"), None)
    if fix is not None:
        n1 = build.get("gemini_end")
        check(n1 == fix["gemini_before"] and fix["max_new"] == TOTAL_CAP - (n1 - n0) and fix.get("only_approved") is True,
              f"budget.json: pass R build closed at N1 = {n1}, pass R fix opens there with {TOTAL_CAP} - (N1 - N0)")
    run = gem[n0:]
    per: dict = {}
    for e in run:
        per[(e["character"], e["sheet"])] = per.get((e["character"], e["sheet"]), 0) + 1
    built = gem[n0:build.get("gemini_end", len(gem))]
    check(len(run) <= TOTAL_CAP and len(built) <= BUILD_MAX and all(n <= PER_SHEET for n in per.values()),
          f"ledger: pass R used {len(run)} of {TOTAL_CAP} (build {len(built)} of {BUILD_MAX}), max per sheet "
          f"{max(per.values(), default=0)} <= {PER_SHEET}")
    if fix is not None:
        root = GEN.HERE / "approved"
        bad = [e["character"] for e in gem[fix["gemini_before"]:] if not (root / e["character"]).is_dir()]
        check(not bad, f"ledger: every pass R fix attempt has an approved id ({bad[:3]})")

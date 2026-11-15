"""Pass R (docs/ROSTER_PLAN.md 6.4, FW-0) budget-guard self-tests, run from selftest.py (test_monster_anim, also --anim):
the 286th `pass R build` attempt, the 301st pass-R attempt in total, the 4th attempt at one sheet, a closed pass, and
`only_approved` in `pass R fix` are each tested on synthetic budgets over a fake ledger (the real ledger's first N0
Gemini attempts plus fake ones); then the real budget.json entries and the real ledger.

`run_prompts` (FW-9): every approved request's cache key recomputed unchanged, and each new monsters.yaml prompt field
(`idle_negative`, `body`, `base`) changes only its own text."""
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


# ───────────────── FW-9 prompt fields (docs/ROSTER_PLAN.md 5.4): no approved key moves, each field changes only its text ─

FIENDS = ("ashen_queen", "drowned_sovereign", "hollow_seraph")


def _approved_keys(check: Callable[[bool, str], None]) -> None:
    """Every approved request (approved/*/*.json) re-planned from today's code and yaml reproduces its cache key."""
    from gen import generate as GEN
    have_style = GEN.STYLE_REF.exists()       # character sheets send the style reference (gen/refs, not committed)
    metas = [json.loads(p.read_text()) for p in sorted((GEN.HERE / "approved").glob("*/*.json"))]
    bad, done, skipped = [], 0, 0
    for meta in metas:
        cid = meta.get("character") or meta.get("kit")
        char = GEN.load_character(cid)
        if not (GEN.is_monster(char) or GEN.is_kit(char)) and not have_style:
            skipped += 1
            continue
        req = GEN.plan_request(char, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"])
        done += 1
        if req.key != meta["cache_key"] or not req.cached:
            bad.append(f"{cid} {meta['sheet']}: {req.key} != {meta['cache_key']}")
        if GEN.is_monster(char) and any(t in req.prompt for t in ("BODY:", "BASE:", "idle cell only")):
            bad.append(f"{cid} {meta['sheet']}: FW-9 wording in an approved request")
    check(not bad and done + skipped == len(metas) and done >= 1,
          f"FW-9: all {done} approved request keys recomputed unchanged and cached ({len(metas)} approved, {skipped} "
          f"character sheets skipped without gen/refs) {bad[:3]}")
    check(have_style, "FW-9: gen/refs present, so the character sheets' keys were recomputed too")


def _only(check: Callable[[bool, str], None], label: str, before: str, after: str, old: str, new: str) -> None:
    """`after` is `before` with its one `old` replaced by `new` (an insertion when `new` keeps `old` as an anchor)."""
    ok = before.count(old) == 1 and after == before.replace(old, new, 1) and before != after
    check(ok, f"FW-9: {label} changes only its own text")


def _fields(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen import monster as M
    from gen import spec as S
    small, boss = S.MONSTER_BANDS["small"], S.MONSTER_BANDS["boss"]
    sheet = {"id": "fw9_sheet", "prompt": "a test beast", "attack": "biting", "hurt": "flinching"}
    pose = {"id": "fw9_boss", "prompt": "a test boss", "action_prompt": "a test boss in motion", "attack": "slashing",
            "cast": "casting", "hurt": "staggering", "attack_raise": "raising", "extra_negative": "a throne"}

    def p3(m: dict) -> str:
        return M.prompt(m, small, False, has_monster_ref=True)

    def pp(m: dict, p: str) -> str:
        return M.pose_prompt(m, boss, p, p != "idle")

    action_poses = [p for p in S.BOSS_POSES if p != "idle"]

    # (a) idle_negative: boss_idle's Avoid list and the 3-pose sheet's idle cell; nowhere else
    neg = "tentacles, suckers"
    m = {**pose, "idle_negative": neg}
    _only(check, "idle_negative (boss_idle Avoid list)", pp(pose, "idle"), pp(m, "idle"), "a throne.", f"a throne, {neg}.")
    check(all(pp(pose, p) == pp(m, p) for p in action_poses),
          f"FW-9: idle_negative leaves every action pose's request text unchanged ({', '.join(action_poses)})")
    idle_cell = "- left cell: idle, a ready battle stance facing right."
    _only(check, "idle_negative (3-pose idle cell)", p3(sheet), p3({**sheet, "idle_negative": neg}), idle_cell,
          f"{idle_cell} In the idle cell only, show none of these: {neg}.")

    # (b) body: replaces the fixed biped MOVEMENT wording only; every body has a line; an unknown body is refused
    olds = [pp(pose, p).split("MOVEMENT: ", 1)[1].split("\n\n", 1)[0] for p in action_poses]
    check(len(set(olds)) == 1 and "No mist, smoke or ground effects." in olds[0],
          "FW-9: the fixed boss MOVEMENT paragraph is the same in every action pose")
    for body in sorted(M.BODY_LINES):
        mb = {**sheet, "body": body}
        _only(check, f"body {body} (3-pose)", p3(sheet), p3(mb), M.ACTION_3, M.body_motion_3(mb))
        bb = {**pose, "body": body}
        anchor = "Pose: idle, a ready battle stance, facing right.\n\n"
        _only(check, f"body {body} (boss_idle)", pp(pose, "idle"), pp(bb, "idle"), anchor,
              anchor + M.body_motion_pose(bb, "idle"))
        for p in action_poses:
            _only(check, f"body {body} (boss_{p})", pp(pose, p), pp(bb, p), f"MOVEMENT: {olds[0]}\n\n",
                  M.body_motion_pose(bb, p))
    check(len({M.body_motion_3({**sheet, "body": b}) for b in M.BODY_LINES}) == len(M.BODY_LINES),
          "FW-9: every body gets its own motion line")
    try:
        p3({**sheet, "body": "centaur"})
        refused = False
    except SystemExit as e:
        refused = "centaur" in str(e)
    check(refused, "FW-9: an unknown body is refused, naming it")

    # (c) base: the base-is-the-creature sentence, nothing else
    base = "the broken stone altar"
    head3 = p3(sheet).split("Cells:\n", 1)[0]
    _only(check, "base (3-pose)", p3(sheet), p3({**sheet, "base": base}), head3,
          head3 + M.base_sentence({"base": base}, "cell"))
    for p in S.BOSS_POSES:
        anchor = "Pose: " + pp(pose, p).split("Pose: ", 1)[1].split("\n", 1)[0]
        _only(check, f"base (boss_{p})", pp(pose, p), pp({**pose, "base": base}, p), anchor,
              M.base_sentence({"base": base}, "pose") + anchor)
    check(base in M.base_sentence({"base": base}, "pose") and M.base_sentence({}, "pose") == "",
          "FW-9: the base sentence names the base and is empty without the field")

    # the G1 fiend entries carry the fields the plan gives them (4.1)
    q, d, h = (GEN.load_character(c) for c in FIENDS)
    check(q.get("body") == "naga" and "altar" in (q.get("base") or "") and d.get("body") == "robed"
          and "tentacles" in (d.get("idle_negative") or "") and h.get("body") == "floating" and h.get("floating") is True
          and all(c.get("per_pose") and c.get("size") == "boss" and c.get("design_ref") is False for c in (q, d, h)),
          "FW-9: ashen_queen naga + altar base, drowned_sovereign robed + idle_negative, hollow_seraph floating")

    def avoid(p: str) -> str:
        return pp(d, p).rsplit("Avoid: ", 1)[1]

    check("tentacles" in avoid("idle") and all("tentacles" not in avoid(p) for p in action_poses),
          "FW-9: the Drowned Sovereign bans tentacles in boss_idle only")
    check(all("BASE: the broken stone altar" in pp(q, p) for p in S.BOSS_POSES)
          and all("exactly six arms" in pp(q, p) for p in S.BOSS_POSES)
          and all("exactly six articulated mechanical wings" in pp(h, p) for p in S.BOSS_POSES),
          "FW-9: the altar sentence in every Ashen Queen pose; six arms / six wings in words in every pose")


def run_prompts(check: Callable[[bool, str], None]) -> None:
    _approved_keys(check)
    _fields(check)

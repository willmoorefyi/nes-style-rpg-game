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

    # the real budget.json entries and the real ledger. Since pass V (docs/REDESIGN_PLAN.md 6, FW-V0) the top level is
    # pass V's; pass R's bounds are read from `history["pass R"]` and the closed `pass R build` / `pass R fix` entries
    if build is None:
        return
    hist = next((h for h in real.get("history", []) if isinstance(h, dict) and h.get("name") == "pass R"), {})
    end = hist.get("gemini_end")                         # N_V0: pass R ends where pass V opens
    f = next((p for p in real["passes"] if p["name"] == "pass F (FB-8)"), {})
    check(hist.get("attempts_before") == n0 and hist.get("cap") == TOTAL_CAP
          and hist.get("max_attempts_per_sheet") == PER_SHEET and isinstance(end, int)
          and f.get("gemini_end") == n0 and build["max_new"] == BUILD_MAX and build["max_per_sheet"] == PER_SHEET,
          f"budget.json history 'pass R': attempts_before = N0 = {n0}, cap {TOTAL_CAP}, 3 per sheet, ended at {end}; "
          f"pass F closed at N0; pass R build {BUILD_MAX}")
    fix = next((p for p in real["passes"] if p["name"] == "pass R fix"), None)
    n1 = build.get("gemini_end")
    check(fix is not None and n1 == fix["gemini_before"] and fix["max_new"] == TOTAL_CAP - (n1 - n0)
          and fix.get("only_approved") is True and fix.get("gemini_end") == end,
          f"budget.json: pass R build closed at N1 = {n1}, pass R fix opens there with {TOTAL_CAP} - (N1 - N0) and is "
          f"closed at the pass-R end {end}")
    run = gem[n0:end]
    per: dict = {}
    for e in run:
        per[(e["character"], e["sheet"])] = per.get((e["character"], e["sheet"]), 0) + 1
    built = gem[n0:n1]
    check(len(run) <= TOTAL_CAP and len(built) <= BUILD_MAX and all(n <= PER_SHEET for n in per.values()),
          f"ledger: pass R used {len(run)} of {TOTAL_CAP} (build {len(built)} of {BUILD_MAX}), max per sheet "
          f"{max(per.values(), default=0)} <= {PER_SHEET}")
    if fix is not None:
        root = GEN.HERE / "approved"
        bad = [e["character"] for e in gem[fix["gemini_before"]:fix.get("gemini_end", end)]
               if not (root / e["character"]).is_dir()]
        check(not bad, f"ledger: every pass R fix attempt has an approved id ({bad[:3]})")


# ───────────────── FW-9 prompt fields (docs/ROSTER_PLAN.md 5.4): no approved key moves, each field changes only its text ─

FIENDS = ("ashen_queen", "drowned_sovereign", "hollow_seraph")


def approved_metas(root: Path) -> list[Path]:
    """The approved jsons, one level deep (approved/<id>/*.json): approved/_retired/<id>_vN/ is never listed."""
    return sorted(root.glob("*/*.json"))


def revived_ok(meta: dict, cache: Path) -> bool:
    """FW-RT revival (docs/REDESIGN_PLAN.md 5): a json with `revived_from` was approved under the old id and prompt, so
    it is checked against the archived key's committed cache file instead of a re-plan."""
    key = meta.get("cache_key")
    return bool(key) and (cache / f"{key}.png").is_file() and (cache / f"{key}.json").is_file()


def bedrock_keys(meta: dict) -> list[str]:
    """The render keys of a Bedrock-cut approved sheet: a landmark sheet's per-landmark keys (and remove_bg keys), or
    an NPC field sheet's `sources` (npc_field_cut.py), or a dungeon prop sheet's per-prop keys (prop_cut.py, AR-P2)."""
    keys = [meta["cache_key"]] if meta.get("cache_key") else []
    for lm in [*(meta.get("landmarks") or {}).values(), *(meta.get("props") or {}).values()]:
        keys += [k for k in (lm.get("cache_key"), lm.get("nobg_key")) if k]
    keys += [s["cache_key"] for s in meta.get("sources") or []]
    return sorted(set(keys))


def bedrock_ok(meta: dict, cache: Path, ledger: list[dict] | None = None) -> bool:
    """A Bedrock-cut approved sheet (Stability renders re-cut offline: landmark_cut.py, npc_field_cut.py, prop_cut.py) is not a
    Gemini request to re-plan: each of its render keys must be a request in the tracked BR ledger and in the cache."""
    from gen import bedrock as B
    rows = B.read_br_ledger() if ledger is None else ledger
    asked = {r.get("key") for r in rows if r.get("event") in ("request", "result")}
    keys = bedrock_keys(meta)
    return bool(keys) and all(k in asked and (cache / f"{k}.png").is_file() for k in keys)


def kneel_ok(meta: dict, ledger: list[dict], br_ledger: list[dict], gen: Path) -> str | None:
    """A pass-KA approved kneel key (approved/<id>/kneel.json, heroes battle_kneel.json; kneel_ai.py approve) is not a
    `generate.py` sheet to re-plan: its request is kneel_ai_gem's, built from guide images in out/kneel_ai (not
    committed). It is checked as kneel_ai.py approves and kneel_tools.py coverage counts it: the sheet fits the id
    (battle_kneel for a hero class, kneel for a monster), its png sits beside it, the rig or class file says
    `kneel: {source: ai}`, a key without a J0 PASS carries the user's review, and every key is a successful request
    of pass KA in its ledger (the Gemini ledger for arm g, the BR ledger for a Bedrock arm). None when all hold, else
    the reason."""
    import yaml
    cid, sheet = meta.get("character"), meta.get("sheet")
    hero = (gen / "anim" / f"{cid}.yaml").is_file()
    rig = gen / "anim" / f"{cid}.yaml" if hero else gen / "anim" / "monsters" / f"{cid}.yaml"
    if sheet != ("battle_kneel" if hero else "kneel"):
        return f"sheet {sheet} for a {'hero' if hero else 'monster'}"
    if not (gen / "approved" / str(cid) / f"{sheet}.png").is_file():
        return f"approved/{cid}/{sheet}.png missing"
    block = (yaml.safe_load(rig.read_text()) or {}).get("kneel") if rig.is_file() else None
    user_block = isinstance(block, dict) and block.get("source") == "user"
    if hero and (meta.get("backend") == "user") != user_block:   # pass CB: a user hero key <-> `kneel: {source: user}`
        return (f"{rig.relative_to(gen)} has no kneel: {{source: user}}" if meta.get("backend") == "user"
                else f"{rig.relative_to(gen)} says kneel: {{source: user}} but the key is not backend user")
    if hero and user_block:
        from gen import hero_user as HU
        return HU.check(meta, gen)
    if not (isinstance(block, dict) and block.get("source") == "ai"):
        return f"{rig.relative_to(gen)} has no kneel: {{source: ai}}"
    if meta.get("j0") and not meta.get("user_review"):
        return f"J0 {meta['j0']} without a user review"
    if meta.get("backend") == "user":                 # EF-H: a user-rendered key, re-imported from its tracked render
        from gen import monster_user as MU
        return MU.check(meta, gen)
    if meta.get("arm") == "g":
        keys, rows = meta.get("gemini_cache_keys") or [], ledger
        asked = {r.get("key") for r in rows if r.get("event") == "attempt" and r.get("character") == cid
                 and r.get("sheet") == sheet and str(r.get("pass", "")).startswith("KA")}
        done = {r.get("key") for r in rows if r.get("event") == "result" and r.get("ok")}
        ok = {k for k in asked if k in done}
    else:
        keys, rows = meta.get("br_cache_keys") or [], br_ledger
        ok = {r.get("key") for r in rows if r.get("event") in ("request", "result")}
    missing = [k for k in keys if k not in ok]
    return f"keys {missing or '[]'} not successful pass-KA requests of {cid} {sheet}" if not keys or missing else None


def _approved_keys(check: Callable[[bool, str], None]) -> None:
    """Every approved request (approved/*/*.json) re-planned from today's code and yaml reproduces its cache key."""
    from gen import generate as GEN
    have_style = GEN.STYLE_REF.exists()       # character sheets send the style reference (gen/refs, not committed)
    metas = [json.loads(p.read_text()) for p in approved_metas(GEN.HERE / "approved")]
    bad, done, skipped = [], 0, 0
    for meta in metas:
        cid = meta.get("character") or meta.get("kit")
        if meta.get("revived_from"):
            done += 1
            if not revived_ok(meta, GEN.CACHE):
                bad.append(f"{cid} {meta['sheet']}: revived from {meta['revived_from']}, cache/{meta.get('cache_key')} "
                           "missing")
            continue
        if meta.get("backend") == "user":            # EF-H / PT: user-rendered sheets, re-imported byte for byte
            from gen import field_user as FU
            done += 1
            why = FU.user_check(meta)
            if why:
                bad.append(f"{cid} {meta['sheet']}: {why}")
            continue
        if meta.get("backend") == "bedrock" or meta.get("vehicle"):   # LM-INT .. LM5-INT: Bedrock cuts (landmarks, NPCs, vehicles)
            done += 1
            if not bedrock_ok(meta, GEN.CACHE):
                bad.append(f"{cid} {meta['sheet']}: a Bedrock key not in the BR ledger or not cached")
            continue
        char = GEN.load_character(cid)
        if meta.get("sheet") in ("kneel", "battle_kneel"):   # pass KA-G keys: kneel_ai_gem's request, not generate's
            skipped += 1
            continue
        if not (GEN.is_monster(char) or GEN.is_kit(char)) and not have_style:
            skipped += 1
            continue
        req = GEN.plan_request(char, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"])
        done += 1
        if req.key != meta["cache_key"] or not req.cached:
            bad.append(f"{cid} {meta['sheet']}: {req.key} != {meta['cache_key']}")
        # FW-9 entries (`body:` set, e.g. the pass-R FIENDS) were approved with that wording; every other must not have it
        fw9 = bool(char.get("body")) or cid in FIENDS
        if GEN.is_monster(char) and not fw9 and any(t in req.prompt for t in ("BODY:", "BASE:", "idle cell only")):
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

    # (b2) motion: replaces only the body's movement line, in the action poses it names; idle never changes
    mo = "Keep a composed front view, every wing visible."
    for body in ("floating", "naga"):
        bb = {**pose, "body": body}
        move = M.BODY_LINES[body][1]
        check(pp({**bb, "motion": mo}, "idle") == pp(bb, "idle"), f"FW-9: motion leaves boss_idle unchanged ({body})")
        for p in action_poses:
            _only(check, f"motion str ({body}, boss_{p})", pp(bb, p), pp({**bb, "motion": mo}, p), move, mo)
        md = {**bb, "motion": {"hurt": mo, "attack_raise": mo}}
        for p in action_poses:
            if p in ("hurt", "attack_raise"):
                _only(check, f"motion map ({body}, boss_{p})", pp(bb, p), pp(md, p), move, mo)
            else:
                check(pp(md, p) == pp(bb, p), f"FW-9: a motion map leaves boss_{p} unchanged when it does not name it")
        mb = {**sheet, "body": body}
        _only(check, f"motion str ({body}, 3-pose)", p3(mb), p3({**mb, "motion": mo}), move, mo)
    for bad, label in (({**pose, "motion": mo}, "motion without body"),
                       ({**pose, "body": "floating", "motion": {"idle": mo}}, "a motion map naming idle"),
                       ({**sheet, "body": "floating", "motion": {"attack": mo}}, "a motion map on a 3-pose sheet")):
        try:
            (pp(bad, "attack") if "action_prompt" in bad else p3(bad))
            refused = False
        except SystemExit as e:
            refused = bad["id"] in str(e)
        check(refused, f"FW-9: {label} is refused")

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

    # the G1 fiend entries carry the fields the plan gives them (4.1). docs/REDESIGN_PLAN.md 9.5: for a redesigned id
    # these pass-R pins read its archived entry (retired/monsters_v1.yaml), still true of the archived design
    q, d, h = (pass_r_entry(c) for c in FIENDS)
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
    hm = h.get("motion") or {}
    check(isinstance(hm, dict) and set(hm) == {"hurt", "attack_raise"} and all("six wings" in v for v in hm.values())
          and all(M.BODY_LINES["floating"][1] not in pp(h, p) and hm[p].strip() in pp(h, p) for p in hm)
          and all(M.BODY_LINES["floating"][1] in pp(h, p) for p in ("attack", "cast")),
          "FW-9: hollow_seraph motion (six wings visible) only in hurt and attack_raise; approved attack/cast keep the line")
    c = pass_r_entry("chaos")
    check(all("exactly four" in pp(c, p) for p in S.BOSS_POSES) and "four arms" in str((c.get("motion") or {}).get("cast")),
          "FW-9: chaos (pass R) has four arms in words in every pose and in its motion line")
    _pass_v_fields(check, pp)


# docs/REDESIGN_PLAN.md 9.5 / 4: once a redesigned boss's live entry differs from its archived one (state B on), the
# pass-V pins apply to the live entry: the count words in every pose it may generate, motion keys among those poses
PASS_V_COUNTS = {"hollow_seraph": "exactly four", "chaos": "exactly two"}


def pass_r_entry(cid: str) -> dict:
    """The archived pass-R entry of a redesigned id (retired/monsters_v1.yaml, `retired_as: <id>_v1`) when it exists,
    else the live monsters.yaml entry."""
    from gen import generate as GEN
    from gen import retire as RT
    block = RT.retired_block(RT.Tree(), f"{cid}_v1")
    if block is None:
        return GEN.load_character(cid)
    return {**{k: v for k, v in RT._parse_one(block).items() if k != "retired_as"}, "kind": "monster"}


def _pass_v_fields(check: Callable[[bool, str], None], pp: Callable[[dict, str], str]) -> None:
    from gen import generate as GEN
    from gen.selftest_passv import ONLY_SHEETS
    for cid, words in PASS_V_COUNTS.items():
        live, old = GEN.load_character(cid), pass_r_entry(cid)
        if live == old:
            print(f"  info {cid}: live entry is the pass-R design (no pass-V text yet)")
            continue
        poses = [sh.removeprefix("boss_") for sh in ONLY_SHEETS[cid]]
        motion = live.get("motion") or {}
        keys = set(motion) if isinstance(motion, dict) else set(poses) - {"idle"}
        check(all(words in pp(live, p) for p in poses) and keys <= set(poses) - {"idle"},
              f"pass V: {cid} has '{words}' in every pose it may generate ({poses}), motion keys {sorted(keys)} among them")


def run_prompts(check: Callable[[bool, str], None]) -> None:
    _approved_keys(check)
    _fields(check)

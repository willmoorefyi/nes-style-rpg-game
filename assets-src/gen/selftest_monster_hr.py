"""EF-G G5 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): selftests of the puppet-then-repaint tools. Prep and puppet are
byte-deterministic on a synthetic figure and reproduce every recorded sha256 of gen/monster_hr.yaml (when the EF3 raws
are in the cache); the yaml schema; the closed EF4 and the EF5 budget block; every EF4 / EF5 cache key reproducible
from monster_hr.yaml and a successful request of its pass of the BR ledger with its render cached; the held approve's json shapes (into a temp tree)."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np

STRENGTHS = {0.3, 0.38, 0.45}


def _synthetic() -> tuple[np.ndarray, dict]:
    """A grey page (896x1088) with a figure (a dark body, a red arm, a light head) and an enclosed page pocket."""
    a = np.full((1088, 896, 3), (150, 152, 150), np.uint8)
    a[300:1000, 350:550] = (40, 30, 60)          # body
    a[600:700, 420:480] = (150, 152, 150)        # an enclosed page pocket (keyed by `holes`)
    a[350:650, 550:600] = (190, 30, 40)          # arm
    a[180:300, 400:500] = (230, 220, 210)        # head
    return a, {"mode": "flat", "tol": 20, "holes": 400}


def _check_synthetic(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_prep as P
    from gen import monster_hr_puppet as U
    rgb, k = _synthetic()
    m = P.key(rgb, k)
    check(not m[0].any() and not m[650, 450] and m[500, 400] and m[400, 575] and m[200, 450],
          "EF4 prep: the border-sampled key takes the page and the enclosed pocket, keeps body, arm and head")
    imgs = [P.place(rgb, P.main_figure(m), 470) for _ in range(2)]
    al = np.asarray(imgs[0])[..., 3] > 0
    ys = np.where(al.any(1))[0]
    check(P.sha(imgs[0]) == P.sha(imgs[1]) and int(ys.max()) == P.FEET and int(ys.max() - ys.min() + 1) == P.HEIGHT,
          "EF4 prep: place() is byte-deterministic, the figure 880 px tall with its feet on row 960")
    sp = {"sprites": {"syn": {"puppet": {"sigma": 150, "parts": [
        {"name": "chest", "poly": None, "pivot": [480, 700]},
        {"name": "body", "rest": True, "warp": True, "pins": [[430, 300], [520, 300], [430, 950], [520, 950]],
         "follow": {0: "chest", 1: "chest"}},
        {"name": "arm", "poly": [[560, 330], [640, 330], [640, 660], [560, 660]], "pivot": [590, 340],
         "parent": "chest"}],
        "poses": {"attack": {"xf": {"chest": [8, 20, 0], "arm": [-80]}, "z": ["body", "arm"]}}}}}}
    outs = [U.pose("syn", "attack", sp, master=imgs[0]) for _ in range(2)]
    check(P.sha(outs[0][0]) == P.sha(outs[1][0]) and outs[0][2]["ok"]["feet"] and outs[0][2]["iou_idle"] < 0.95,
          f"EF4 puppet: a synthetic pose is byte-deterministic, its feet on row 960 and moved ({outs[0][2]['iou_idle']})")


def _check_yaml(check: Callable[[bool, str], None], sp: dict) -> None:
    from gen import monster_hr_br as H
    bad = []
    for sid, sm in sp["sprites"].items():
        for f in ("brief", "subject", "poses", "prep"):
            if f not in sm:
                bad.append(f"{sid}: no {f}")
        if set(sm.get("poses") or {}) != set(H.POSES):
            bad.append(f"{sid}: poses {sorted(sm.get('poses') or {})}")
        for pose, rows in (sm.get("variations") or {}).items():
            ns = [r["n"] for r in rows]                # n unique per pose; <= 5 rows per pass (EF5 continues n)
            per = {}
            for r in rows:
                per[H.row_pass(r)[0]] = per.get(H.row_pass(r)[0], 0) + 1
            if (pose not in H.POSES or len(set(ns)) != len(ns) or max(per.values()) > 5
                    or not set(per) <= {"EF4", "EF5", "EF6"}):
                bad.append(f"{sid} {pose}: rows {ns} {per} (at most 5 per image per pass)")
            bad += [f"{sid} {pose} v{r['n']}: strength {r['strength']}" for r in rows
                    if float(r["strength"]) not in STRENGTHS]
        for pose, n in (sm.get("pick") or {}).items():
            rows = [r for r in (sm.get("variations") or {}).get(pose) or [] if r["n"] == n]
            if not rows or not rows[0].get("key"):
                bad.append(f"{sid}: pick {pose} v{n} has no generated row")
    check(sp.get("pass") == "EF4" and sp.get("purpose") == "ef4_pose" and not bad,
          f"EF4 / EF5 yaml: briefs, four poses, <= 5 rows per image per pass (row `pass` tags, EF4 the default) at "
          f"strengths {sorted(STRENGTHS)}, picks generated {bad[:3]}")


def _check_budget(check: Callable[[bool, str], None]) -> None:
    from gen import bedrock as B
    budget = json.loads(B.BUDGET.read_text())
    br = B.pass_view(budget, "EF4").get("bedrock") or {}
    check(br.get("pass") == "EF4" and br.get("cap") == 80 and br.get("per_purpose_caps") == {"ef4_pose": 80, "reserve": 0}
          and (budget.get("bedrock") or {}).get("pass") != "EF4" and br.get("closed") and "used" in br,
          "EF4 budget: closed into bedrock_history, cap 80, per_purpose_caps {ef4_pose: 80, reserve: 0}")
    b5 = B.pass_view(budget, "EF5").get("bedrock") or {}
    asked5 = [r for r in B.read_br_ledger() if r.get("pass") == "EF5" and r.get("event") == "request"]
    if b5.get("pass") != "EF5":                       # amendment A3 opens it after the user's A2 approval
        check(not asked5, f"EF5 budget: no block yet (A2 user gate), so no EF5 ledger request ({len(asked5)})")
    else:
        check(b5.get("cap") == 15 and b5.get("per_purpose_caps") == {"ef5_pose": 15, "reserve": 0}
              and len(asked5) <= 15, f"EF5 budget: cap 15, per_purpose_caps {{ef5_pose: 15, reserve: 0}} ({len(asked5)})")


def _check_recorded(check: Callable[[bool, str], None], sp: dict) -> dict:
    """Every recorded master / pose sha256 reproduced, then every EF4 key from the recomputed images."""
    from gen import bedrock as B
    from gen import monster_hr_br as H
    from gen import monster_hr_prep as P
    from gen import monster_hr_puppet as U
    images, bad, n = {}, [], 0
    for sid, sm in sp["sprites"].items():
        if not sm.get("master_sha256"):
            continue
        srcs = [sm["prep"]["source"]] + [k for k in ((sm["prep"].get("graft") or {}).get("source"),
                                                    sm["prep"].get("nobg_key")) if k]   # B0: the remove_bg render
        if not all(B.is_cached(k) for k in srcs):
            print(f"  skip {sid} (EF3 raws not in this checkout's cache)")
            continue
        m = P.master(sid, sp)
        images[(sid, "idle")] = m
        n += 1
        if P.sha(m) != sm["master_sha256"]:
            bad.append(f"{sid} master")
        for pose in (sm.get("puppet") or {}).get("poses") or {}:      # attack, hurt, kneel and superseded inputs
            if sm.get(f"{pose}_sha256"):
                img = U.pose(sid, pose, sp, master=m)[0]
                images[(sid, pose)] = img
                n += 1
                if P.sha(img) != sm[f"{pose}_sha256"]:
                    bad.append(f"{sid} {pose}")
    check(not bad, f"EF4 prep / puppet: {n} recorded sha256 reproduced {bad}")
    led = B.read_br_ledger()
    ok = {r["key"] for r in led if r.get("event") == "result" and r.get("ok")}
    for ps in ("EF4", "EF5", "EF6"):                  # each pass's *_pose requests against its rows (ef6_nobg: EF6 file)
        rows = [r for r in led if r.get("pass") == ps and r.get("event") == "request"
                and str(r.get("purpose", "")).endswith("_pose")]
        asked = {r["key"] for r in rows}
        keyed, bad = 0, []
        for sid, sm in sp["sprites"].items():
            for pose, vs in (sm.get("variations") or {}).items():
                for v in vs:
                    if not v.get("key") or H.row_pass(v)[0] != ps:
                        continue
                    keyed += 1
                    src = (sid, v.get("input", pose))
                    if src in images and H.request(sid, pose, v["n"], sp, images[src])[1] != v["key"]:
                        bad.append(f"{sid} {pose} v{v['n']} key")
                    if v["key"] not in asked or v["key"] not in ok or not B.is_cached(v["key"]):
                        bad.append(f"{sid} {pose} v{v['n']} not a cached, successful {ps} request")
        check(not bad and keyed == len(rows) == len(asked),
              f"{ps} keys: {keyed} rows, {len(rows)} ledger requests; every key reproducible and cached {bad[:3]}")
    return images


def _check_approve(check: Callable[[bool, str], None], sp: dict) -> None:
    """The held approve into a temp tree (never the real one): Bedrock json shapes, monster_small removed."""
    from gen import bedrock as B
    from gen import monster_hr_br as H
    from gen import selftest_roster as SRo
    sid = next((s for s, sm in sp["sprites"].items() if sm.get("pick") and
                all(B.is_cached(k) for *_, k in H.picks(s, sp))), None)
    if sid is None:
        print("  skip approve shape (no picked set cached)")
        return
    gen = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "approved"
        shutil.copytree(gen / "approved" / sid, root / sid)
        for d in (gen / "approved" / "_retired").glob(f"{sid}_v*"):
            shutil.copytree(d, root / "_retired" / d.name)
        H.approve(sid, sp, root)
        meta = json.loads((root / sid / "monster_large.json").read_text())
        kneel = json.loads((root / sid / "kneel.json").read_text())
        keys = [k for *_, k in H.picks(sid, sp)]
        check(meta["backend"] == "bedrock" and meta["cache_key"] == keys[0] and [s["pose"] for s in meta["sources"]]
              == ["idle", "attack", "hurt"] and set(meta["inputs"]) == set(H.POSES) and meta["recipe"].endswith(sid)
              and SRo.bedrock_ok(meta, B.CACHE) and set(keys[:3]) <= set(SRo.bedrock_keys(meta)),
              f"EF4 approve ({sid}, temp tree): monster_large.json is a Bedrock record SRo.bedrock_ok accepts")
        check(kneel["arm"] != "g" and kneel["br_cache_keys"] == [keys[3]] and "backend" not in kneel
              and not (root / sid / "monster_small.png").exists(),
              "EF4 approve: kneel.json in the Bedrock kneel shape, monster_small removed (archived under _retired)")


def _check_ef5_tools(check: Callable[[bool, str], None]) -> None:
    """EF-G amendment A0: per-row pass tags, per-pass row caps, `prompt_pose`, per-pass review dirs, the EF5 IoU bars
    and the new measures (prop and chest world angles, the body height without props)."""
    from gen import monster_hr_br as H
    from gen import monster_hr_check as C
    from gen import monster_hr_puppet as U
    rows = [{"n": i, "seed": i, "strength": 0.3} for i in (1, 2)] + [
        {"n": i, "seed": i, "strength": 0.3, "pass": "EF5", "prompt_pose": "flung back"} for i in range(3, 8)]
    sm = {"subject": "S.", "poses": {"hurt": "plain"}, "variations": {"hurt": rows}}
    sp = {"style": "st", "negative": "neg", "sprites": {"s": sm}}
    ok = (H.row_pass(rows[0]) == ("EF4", "ef4_pose") and H.row_pass(rows[2]) == ("EF5", "ef5_pose")
          and H.variation(sm, "hurt", 7)["n"] == 7 and "flung back" in H.text(sp, sm, "hurt", rows[2])[0]
          and "plain" in H.text(sp, sm, "hurt", rows[0])[0] and H.text(sp, sm, "hurt")[0] == H.text(sp, sm, "hurt", rows[0])[0])
    six = {**sm, "variations": {"hurt": rows + [{"n": 8, "seed": 8, "strength": 0.3, "pass": "EF5"}]}}
    try:
        H.variation(six, "hurt", 8)
        ok = False
    except SystemExit:
        pass
    check(ok, "EF5 br: pass / purpose from each row's tag, <= 5 rows per pass per pose (n continues), prompt_pose")
    check(H.review_dir("EF4").name == "bedrock4" and H.review_dir("EF5").name == "bedrock5"
          and U.review_dir("EF5", "x") == U.REVIEW.parent / "bedrock5" / "x" / "posed"
          and U.review_dir("EF4", "x") == U.REVIEW / "x" / "g2",
          "EF5 review dirs: bedrock4/<id>/g2 for EF4, bedrock5/<id>/posed for EF5 (EF4's files never touched)")
    check(C.iou_bar("EF5", "attack") == 0.70 and C.iou_bar("EF5", "hurt") == 0.70 and C.iou_bar("EF5", "kneel") == 0.65
          and C.iou_bar("EF4", "attack_ef4") == 0.80 and C.iou_bar("EF4", "hurt_r2") == 0.80,
          "EF5 checks: IoU bars attack / hurt 0.70, kneel 0.65; EF4 0.80")
    a = np.zeros((1024, 1024), bool)
    a[200:960, 400:500] = True                      # the body
    p = np.zeros_like(a)
    p[100:960, 600:620] = True                      # a vertical prop
    parts = [{"name": "chest", "pivot": [450, 600]}, {"name": "arm", "pivot": [600, 400], "parent": "chest"},
             {"name": "staff", "pivot": [610, 400], "parent": "arm"}]
    m = C.measures(U.worlds(parts, {"chest": [15], "arm": [-30], "staff": [70]}), parts, a | p, p, p)
    parts2 = parts + [{"name": "head", "pivot": [450, 200], "parent": "chest"}]
    m2 = C.measures(U.worlds(parts2, {"chest": [26], "head": [-18]}), parts2, a | p, p, p)
    check(m2.get("head_deg") == 8.0, f"EF5 measures: the head's world tilt (8 = chest 26 + head -18) {m2.get('head_deg')}")
    check(m["chest_deg"] == 15.0 and m["staff_deg"] == 55.0 and m["staff_idle_deg"] == 0.0 and m["body_h"] == 760,
          f"EF5 measures: chest 15, staff world 55 from its idle 0 (composed through worlds()), body height 760 "
          f"without the prop {m}")

    import numpy as _np
    from PIL import Image as _I
    rgba = _np.zeros((1024, 1024, 4), _np.uint8)
    rgba[300:961, 350:551] = (40, 30, 60, 255)      # the robe
    rgba[500:600, 400:500] = (220, 220, 210, 255)   # a claw on it
    rgba[520:560, 420:460] = (200, 40, 40, 255)     # a ring on the claw
    parts = [{"name": "body", "rest": True}, {"name": "claw", "poly": [[400, 500], [500, 500], [500, 600], [400, 600]],
              "pivot": [450, 500], "minus": ["ring"]}, {"name": "ring", "poly": [[420, 520], [460, 520], [460, 560],
              [420, 560]], "pivot": [440, 520], "parent": "claw"}]
    mk = U.part_masks(rgba[..., 3] > 0, parts)
    ps = {"xf": {"claw": [0, 200, 0]}, "z": ["body", "claw", "ring"], "ground": False, "speck": 0, "close": 0,
          "prefill": [{"part": "body", "poly": [[390, 490], [510, 490], [510, 610], [390, 610]], "clone": [0, 150]}]}
    spx = {"sprites": {"syn": {"puppet": {"parts": parts, "poses": {"a": ps, "b": {**ps, "prefill": None}}}}}}
    pa = _np.asarray(U.pose("syn", "a", spx, master=_I.fromarray(rgba))[0])
    pb = _np.asarray(U.pose("syn", "b", spx, master=_I.fromarray(rgba))[0])
    check(not mk["claw"][540, 440] and mk["ring"][540, 440] and mk["claw"][510, 410]
          and tuple(pa[550, 450, :3]) == (40, 30, 60) and pb[550, 450, 3] == 0 and tuple(pa[540, 640, :3]) == (200, 40, 40),
          "EF5 puppet: `minus` takes the ring's px out of the claw; `prefill` closes the claw's place in the robe on the "
          "master (cloned robe), so it does not open when the claw moves")


def run_monster_hr(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_prep as P
    sp = P.spec()
    _check_synthetic(check)
    _check_ef5_tools(check)
    _check_yaml(check, sp)
    _check_budget(check)
    _check_recorded(check, sp)
    _check_approve(check, sp)

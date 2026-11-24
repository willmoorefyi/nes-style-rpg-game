"""EF-G G5 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): selftests of the puppet-then-repaint tools. Prep and puppet are
byte-deterministic on a synthetic figure and reproduce every recorded sha256 of gen/monster_hr.yaml (when the EF3 raws
are in the cache); the yaml schema; the EF4 budget block; every EF4 cache key reproducible from monster_hr.yaml and a
successful EF4 request of the BR ledger with its render cached; the held approve's json shapes (into a temp tree)."""
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
            ns = [r["n"] for r in rows]
            if pose not in H.POSES or len(rows) > 5 or len(set(ns)) != len(ns) or max(ns) > 5:
                bad.append(f"{sid} {pose}: rows {ns} (at most 5 per image)")
            bad += [f"{sid} {pose} v{r['n']}: strength {r['strength']}" for r in rows
                    if float(r["strength"]) not in STRENGTHS]
        for pose, n in (sm.get("pick") or {}).items():
            rows = [r for r in (sm.get("variations") or {}).get(pose) or [] if r["n"] == n]
            if not rows or not rows[0].get("key"):
                bad.append(f"{sid}: pick {pose} v{n} has no generated row")
    check(sp.get("pass") == "EF4" and sp.get("purpose") == "ef4_pose" and not bad,
          f"EF4 yaml: briefs, four poses, <= 5 rows per image at strengths {sorted(STRENGTHS)}, picks generated {bad[:3]}")


def _check_budget(check: Callable[[bool, str], None]) -> None:
    from gen import bedrock as B
    budget = json.loads(B.BUDGET.read_text())
    br = B.pass_view(budget, "EF4").get("bedrock") or {}
    check(br.get("pass") == "EF4" and br.get("cap") == 80 and br.get("per_purpose_caps") == {"ef4_pose": 80, "reserve": 0},
          "EF4 budget: cap 80, per_purpose_caps {ef4_pose: 80, reserve: 0} (no remove_bg purpose)")


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
        srcs = [sm["prep"]["source"]] + ([sm["prep"]["graft"]["source"]] if sm["prep"].get("graft") else [])
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
    rows = [r for r in B.read_br_ledger() if r.get("pass") == "EF4" and r.get("event") == "request"]
    ok = {r["key"] for r in B.read_br_ledger() if r.get("event") == "result" and r.get("ok")}
    asked = {r["key"] for r in rows}
    keyed, bad = 0, []
    for sid, sm in sp["sprites"].items():
        for pose, vs in (sm.get("variations") or {}).items():
            for v in vs:
                if not v.get("key"):
                    continue
                keyed += 1
                src = (sid, v.get("input", pose))
                if src in images and H.request(sid, pose, v["n"], sp, images[src])[1] != v["key"]:
                    bad.append(f"{sid} {pose} v{v['n']} key")
                if v["key"] not in asked or v["key"] not in ok or not B.is_cached(v["key"]):
                    bad.append(f"{sid} {pose} v{v['n']} not a cached, successful EF4 request")
    check(not bad and keyed == len(rows) == len(asked),
          f"EF4 keys: {keyed} rows, {len(rows)} ledger requests; every key reproducible and cached {bad[:3]}")
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


def run_monster_hr(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_prep as P
    sp = P.spec()
    _check_synthetic(check)
    _check_yaml(check, sp)
    _check_budget(check)
    _check_recorded(check, sp)
    _check_approve(check, sp)

"""EF-G amendment B0 (docs/ENEMY_FEEDBACK_PLAN.md): selftests of the EF6 tool changes. The EF6 pass tag and IoU bars,
the per-sprite targets schema (`puppet.targets.<recipe>`; EF5's targets in dark_wizard's yaml), the `nobg` body (one
Stability Remove Background request, model `remove_bg`, purpose `ef6_nobg`, its key recorded as `prep.nobg_key`), the
`key: remove_bg` prep path (the colour-key hand polygons ignored, the graft composited on the body's alpha, its `erase`
trim), the puppet's `mirror` option, the monsters.yaml rewrite with the picked row's `prompt_pose`, the approve json's
`nobg_key`, the EF5 / EF6 budget blocks and the ledger's `ef6_nobg` row."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image


def _check_tags(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_br as H
    from gen import monster_hr_check as C
    from gen import monster_hr_puppet as U
    check(H.row_pass({"pass": "EF6"}) == ("EF6", "ef6_pose") and H.review_dir("EF6").name == "bedrock6"
          and U.review_dir("EF6", "x") == U.REVIEW.parent / "bedrock6" / "x" / "posed",
          "EF6 br: the EF6 row tag -> purpose ef6_pose, review dirs bedrock6/<id>/ and bedrock6/<id>/posed/")
    check(C.iou_bar("EF6", "attack") == 0.80 and C.iou_bar("EF6", "hurt") == 0.70 and C.iou_bar("EF6", "kneel") == 0.65
          and C.iou_bar("EF5", "attack") == 0.70 and C.iou_bar("EF4", "attack_ef4") == 0.80,
          "EF6 checks: IoU bars attack 0.80 (upright), hurt 0.70, kneel 0.65; EF5 / EF4 unchanged")


def _check_targets(check: Callable[[bool, str], None], sp: dict) -> None:
    from gen import monster_hr_check as C
    m = {"chest_deg": 4.0, "head_deg": -3.0, "staff_deg": 60.0, "staff_idle_deg": 0.0, "body_h": 500}
    tg = {"chest": [-5, 10], "head": [-5, 10], "prop": [40, 90], "prop_delta": [50, 180], "height_max": 0.70}
    r = C.targets(tg, "attack", m, 800)
    bad = C.targets({"chest": [-5, 3], "prop_delta": [61, 180], "height_max": 0.6}, "attack", m, 800)
    edge = C.targets({"chest": [4, 4], "head": [-3, -3]}, "attack", m, 800)   # inclusive ends
    check(r == {"t_chest": True, "t_head": True, "t_prop": True, "t_prop_delta": True, "t_height_max": True}
          and bad == {"t_chest": False, "t_prop_delta": False, "t_height_max": False} and all(edge.values())
          and C.targets(None, "attack", m, 800) == {},
          f"EF6 targets: chest / head / prop / prop_delta ranges inclusive, height_max a ratio, any key optional {r} {bad}")
    dw = ((sp["sprites"].get("dark_wizard") or {}).get("puppet") or {}).get("targets") or {}
    check(dw.get("attack") == {"prop_delta": [50, 180], "chest": [15, 90]}
          and dw.get("hurt") == {"chest": [-90, -20], "prop_delta": [-180, -15]} and dw.get("kneel") == {"height_max": 0.70}
          and "attack_ef4" not in dw, "EF6 targets: EF5's hard-coded targets moved into dark_wizard's yaml (EF5 recipes)")
    bad = []
    for sid, sm in sp["sprites"].items():
        rec = ((sm.get("puppet") or {}).get("poses")) or {}
        for name, t in (((sm.get("puppet") or {}).get("targets")) or {}).items():
            if name not in rec or not set(t) <= {"chest", "head", "prop", "prop_delta", "height_max"}:
                bad.append(f"{sid} {name}")
            bad += [f"{sid} {name} {k}" for k, v in t.items() if k != "height_max" and (len(v) != 2 or v[0] > v[1])]
    check(not bad, f"EF6 targets schema: every target names a recipe, known keys, [lo, hi] ranges {bad[:3]}")


def _check_nobg(check: Callable[[bool, str], None]) -> None:
    from gen import bedrock as B
    from gen import monster_hr_br_nobg as N
    raw = Image.new("RGBA", (16, 8), (10, 200, 30, 255))
    calls = []

    def fake(model, body, *, paid, purpose):
        calls.append((model, sorted(body), paid, purpose))
        return Image.new("RGBA", (16, 8))
    with tempfile.TemporaryDirectory() as tmp:
        y = Path(tmp) / "hr.yaml"
        y.write_text("sprites:\n  syn:\n    brief: b\n    prep:\n      source: abc\n      flip: false\n")
        key = N.nobg("syn", {"sprites": {"syn": {"prep": {"source": "abc"}}}}, True, invoke=fake, raw=raw, path=y)
        rec = y.read_text()
    body = N.body(raw)
    check(calls == [("remove_bg", ["image", "output_format"], True, "ef6_nobg")] and body["output_format"] == "png"
          and body["image"] == B.png_b64(raw.convert("RGB")) and key == B.cache_key("remove_bg", body)
          and "    prep:\n      nobg_key: " + key + "\n      source: abc" in rec,
          f"EF6 nobg: one remove_bg request (model 'remove_bg', purpose ef6_nobg, the RGB raw), its key recorded as "
          f"prep.nobg_key {calls}")


def _check_prep_nobg(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_prep_nobg as Q
    p = {"key": "remove_bg", "keep": [1], "keep_light": [1], "erase_hue": [1], "erase_out": [1], "restore_out": [2],
         "cx": 470}
    e = Q.effective(p)
    e2 = Q.effective({**p, "nobg_erase_hue": [3], "nobg_erase_out": [4]})
    check(e2.get("erase_hue") == [3] and e2.get("erase_out") == [4] and "nobg_erase_hue" not in e2,
          "EF6 prep: under remove_bg its own nobg_erase_hue / nobg_erase_out polygons take the colour-key ones' places")
    check(set(e) == {"key", "restore_out", "cx"} and Q.effective({**p, "key": {"mode": "flat"}}) == {**p, "key":
          {"mode": "flat"}}, "EF6 prep: under key remove_bg the colour-key hand polygons are ignored, restore_out kept")
    nb = np.zeros((40, 40, 4), np.uint8)
    nb[10:30, 5:20, 3] = 255
    al = Q.body_alpha(Image.fromarray(nb), (40, 40))
    rgb = np.full((40, 40, 3), (0, 128, 128), np.uint8)
    rgb[10:30, 5:20] = (100, 20, 20)
    src = np.full((40, 40, 3), (0, 128, 128), np.uint8)
    src[8:22, 14:28] = (220, 180, 150)              # the face, partly outside the body
    src[8:22, 25:28] = (240, 230, 180)              # a beige strip at its right edge
    g = {"poly": [[12, 6], [30, 6], [30, 24], [12, 24]], "key": {"mode": "flat", "tol": 30},
         "src_marks": [[14, 8], [27, 8], [14, 21], [27, 21]], "dst_marks": [[14, 8], [27, 8], [14, 21], [27, 21]],
         "feather": 2, "gain": [1.0, 1.0], "erase": [[[25, 6], [30, 6], [30, 24], [25, 24]]]}
    out, a2 = Q.graft_layer(rgb, al, src, g)
    check(al[20, 10] and not al[20, 22] and a2[15, 22] and a2[20, 10] and not a2[15, 26]
          and tuple(out[15, 22]) == (220, 180, 150) and tuple(out[25, 10]) == (100, 20, 20),
          "EF6 prep: the body's alpha from the remove_bg output; the graft drawn on top with its own alpha (union), "
          "its `erase` polygon trimmed off the graft layer")


def _check_mirror(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_puppet as U
    rgba = np.zeros((1024, 1024, 4), np.uint8)
    rgba[300:961, 400:600] = (40, 30, 60, 255)      # the body
    rgba[600:900, 420:470] = (200, 40, 40, 255)     # the visible thigh (left)
    rgba[600:620, 420:430] = (250, 250, 250, 255)   # a marker on its outer edge
    parts = [{"name": "body", "rest": True},
             {"name": "thigh", "poly": [[420, 600], [470, 600], [470, 900], [420, 900]], "pivot": [445, 600]},
             {"name": "hidden", "poly": None, "pivot": [555, 600], "mirror": {"from": "thigh", "about": [500, 600]}}]
    ps = {"xf": {}, "z": ["hidden", "body", "thigh"], "ground": False, "speck": 0, "close": 0}
    sp = {"sprites": {"syn": {"puppet": {"parts": parts, "poses": {"a": ps, "b": {**ps, "z": ["body", "thigh",
                                                                                                  "hidden"]}}}}}}
    a = np.asarray(U.pose("syn", "a", sp, master=Image.fromarray(rgba))[0])
    b = np.asarray(U.pose("syn", "b", sp, master=Image.fromarray(rgba))[0])
    check(tuple(a[700, 550, :3]) == (40, 30, 60) and tuple(b[700, 550, :3]) == (200, 40, 40)
          and tuple(b[610, 575, :3]) == (250, 250, 250) and tuple(b[700, 445, :3]) == (200, 40, 40),
          "EF6 puppet: `mirror` paints a hidden limb from the visible one's own px mirrored about a vertical line, "
          "drawn under the covering parts by z")


def _check_review(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_review as R
    sm = {"brief": "A brief.", "poses": {"idle": "i", "attack": "lunging", "hurt": "h", "kneel": "k"},
          "master_sha256": "m", "attack_sha256": "a", "hurt_sha256": "h", "kneel_sha256": "k",
          "prep": {"source": "raw1", "nobg_key": "nb1", "graft": {"source": "raw2"}}}
    rows = {"idle": {"n": 1, "seed": 1, "strength": 0.3}, "attack": {"n": 2, "seed": 2, "strength": 0.3, "pass": "EF6",
            "prompt_pose": "standing tall, the claw driven at the party"}, "hurt": {"n": 1, "seed": 3, "strength": 0.3},
            "kneel": {"n": 1, "seed": 4, "strength": 0.3}}
    with tempfile.TemporaryDirectory() as tmp:
        y = Path(tmp) / "monsters.yaml"
        y.write_text("- id: syn\n  body: biped\n  prompt: old\n- id: other\n  prompt: x\n")
        R.write_monsters_yaml("syn", sm, y, rows)
        text = y.read_text()
    pk = [(p, r["n"], f"k{p}", r) for p, r in rows.items()]
    meta, kneel, srcs = R.approve_json("syn", sm, pk, {}, (128, 128), "sd35")
    check("  attack: standing tall, the claw driven at the party\n" in text and "  hurt: h\n" in text
          and "- id: other" in text and meta["inputs"]["idle"]["raw_keys"] == ["raw1", "raw2", "nb1"]
          and srcs[1]["pass"] == "EF6" and srcs[1]["purpose"] == "ef6_pose",
          "EF6 review: monsters.yaml takes the picked row's prompt_pose; approve_json lists prep.nobg_key in "
          "inputs.idle.raw_keys")


def _check_budget(check: Callable[[bool, str], None], sp: dict) -> None:
    from gen import bedrock as B
    budget = json.loads(B.BUDGET.read_text())
    b5 = (budget.get("bedrock_history") or [{}])
    b5 = next((x for x in b5 if x.get("pass") == "EF5"), {})
    led = B.read_br_ledger()
    n5 = sum(r.get("pass") == "EF5" and r.get("event") == "request" for r in led)
    check(b5.get("closed") and b5.get("used") == n5 and (budget.get("bedrock") or {}).get("pass") != "EF5",
          f"EF5 budget: closed into bedrock_history, used = its {n5} ledger requests")
    b6 = B.pass_view(budget, "EF6").get("bedrock") or {}
    req6 = [r for r in led if r.get("pass") == "EF6" and r.get("event") == "request"]
    live = (budget.get("bedrock") or {}).get("pass") == "EF6"
    check(b6.get("pass") == "EF6" and b6.get("cap") == 57 and b6.get("per_purpose_caps") == {"ef6_pose": 56,
          "ef6_nobg": 1, "reserve": 0} and len(req6) <= 57 and (live or (b6.get("closed") and b6.get("used") ==
          len(req6))), f"EF6 budget: {'live' if live else 'closed'}, cap 57, ef6_pose 56 + ef6_nobg 1 ({len(req6)})")
    ok = {r["key"] for r in led if r.get("event") == "result" and r.get("ok")}
    nb = [r for r in req6 if r.get("purpose") == "ef6_nobg"]
    keys = {s: sm["prep"]["nobg_key"] for s, sm in sp["sprites"].items() if (sm.get("prep") or {}).get("nobg_key")}
    check(len(nb) <= 1 and {r["key"] for r in nb} <= set(keys.values()) and all(
          k in ok and B.is_cached(k) for k in keys.values() if k in {r["key"] for r in nb}) and len(nb) == len(keys),
          f"EF6 nobg rows: each ef6_nobg request is a recorded prep.nobg_key, cached and successful ({len(nb)})")


def run_monster_hr_ef6(check: Callable[[bool, str], None]) -> None:
    from gen import monster_hr_prep as P
    sp = P.spec()
    _check_tags(check)
    _check_targets(check, sp)
    _check_nobg(check)
    _check_prep_nobg(check)
    _check_mirror(check)
    _check_review(check)
    _check_budget(check, sp)

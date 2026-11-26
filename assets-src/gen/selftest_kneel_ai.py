"""Pass KA self-tests (docs/KNEEL_AI_PLAN.md 4 file table), run from selftest.py (--anim too); 0 calls (a fake client).

Part 1 (here): request-body keys per arm, prompts, the price rule, the gate on a fake invoke (dry-run sends nothing;
pass KA purposes only), `budget --check`, the guides use no source colours, the weapons / heads lists, the pinned
calibration exclusions, the coverage format, approve.py's kneel overwrite gate, retire_kneel and an approved
kneel.png being unread without `source: ai`. selftest_kneel_ai_cut.py: the D-KA6 cut (round trip, offset, window
edge, width, height, peel). selftest_kneel_ai_fix.py: the section 6 failure fixtures.

  python3 -I assets-src/gen/selftest_kneel_ai.py
"""
from __future__ import annotations

import contextlib
import io
import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
# pinned (section 6 Calibration): the hurt keys that are not approved art, excluded from every calibration
# EF-H batch 2: black_knight left the list; batch 3: chimera (its hurt key is the user's render, no FW-Q alias)
# EF-H batch 2: black_knight left the list (its hurt key is the user's render; the old keyframe paint is retired)
EXCLUDED = {"ashen_queen": "key_offset", "black_widow": "FW-Q alias",
            "cobra": "keyframe paint", "crocodile": "keyframe paint",
            "hollow_seraph": "FW-H hurt_from"}   # EF-H batch 3: king_mummy left (its hurt key is the user render)
BODY_KEYS = {"a": ("sd35", {"mode", "image", "strength"}),
             "b": ("style_transfer", {"init_image", "style_image", "change_strength", "style_strength",
                                      "composition_fidelity"}),
             "b2": ("style_transfer", {"init_image", "style_image", "change_strength", "style_strength",
                                       "composition_fidelity"}),
             "c": ("control_sketch", {"image", "control_strength", "style_preset"}),
             "d": ("style_guide", {"image", "fidelity", "style_preset"})}
BASE = {"prompt", "negative_prompt", "seed", "output_format"}


def _guide(tmp: Path, sid: str = "goblin"):
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    sp = D.load(sid)
    G.build(sp, tmp / sid, sp.idle.copy())          # the idle stands in for the derived kneel: no render needed
    return sp, tmp / sid


def _bodies(check) -> None:
    from gen import kneel_ai_req as RQ
    with tempfile.TemporaryDirectory() as t:
        sp, gd = _guide(Path(t))
        for arm, (model, keys) in BODY_KEYS.items():
            reqs = RQ.build(sp, arm, 1234, gd)
            m, body = reqs[0]
            check(m == model and set(body) == BASE | keys and "aspect_ratio" not in body,
                  f"arm ({arm}): {model} with exactly {sorted(keys)} + the base keys ({sorted(set(body) - BASE)})")
        _, b = RQ.build(sp, "b", 1234, gd)[0]
        _, b2 = RQ.build(sp, "b2", 1234, gd)[0]
        _, a = RQ.build(sp, "a", 1234, gd)[0]
        check((b["change_strength"], b["style_strength"], b["composition_fidelity"], b2["style_strength"],
               a["strength"]) == (0.85, 1.0, 0.5, 0.6, 0.40), "D-KA4 settings: (b) 0.85 / 1.0 / 0.5, (b2) "
                                                               "style_strength 0.6, (a) strength 0.40")
        c = RQ.build(sp, "c", 1235, gd, c1=Image.new("RGB", (1024, 1024), (255, 0, 255)))
        check([m for m, _ in c] == ["control_sketch", "style_transfer"] and c[1][1]["change_strength"] == 0.4
              and c[1][1]["composition_fidelity"] == 0.9 and c[0][1]["style_preset"] == "pixel-art",
              "arm (c): c1 control_sketch (pixel-art), then c2 style_transfer of c1 (0.4, fidelity 0.9)")
        p, n = RQ.prompts(sp)
        check("holding exactly 1 dagger" in p and "exactly 1 head" in p and "plain flat magenta background" in p
              and "facing right" in p and "magenta" not in n and "white background" in n and "facing left" in n,
              "5b prompt: counts from kneel_ai.yaml, {bg} magenta, the negative names the other colour and side")
        hero = _guide(Path(t), "warrior")[0]
        hp, _ = RQ.prompts(hero)
        check("empty-handed" in hp and "facing left" in hp and "holding" not in hp.split("empty-handed")[0],
              "5b prompt: an empty-handed hero ready says empty-handed (no battle_gear weapon)")


def _gate(check) -> None:
    from gen import bedrock as B
    from gen import kneel_ai_req as RQ
    from gen.selftest_colossus import _refused, _rows, sandbox
    real = B.pass_view(json.loads((HERE / "budget.json").read_text()), "KA")    # pass KA as it ran (now closed)
    with tempfile.TemporaryDirectory() as t:
        sp, gd = _guide(Path(t))
        with sandbox(real) as (BB, tmp, cl):
            with contextlib.redirect_stdout(io.StringIO()):
                RQ.send(sp, "b", 1234, "ka_probe", False, gdir=gd)
            check(not cl.calls and not _rows(BB) and (gd / "req_b_1234.json").exists(),
                  "gen without --paid: nothing sent or logged, req_b_1234.json written")
            RQ.send(sp, "c", 1234, "ka_probe", True, gdir=gd)
            rows = [r for r in _rows(BB) if r.get("event") == "request"]
            check(len(cl.calls) == 2 and [r["pass"] for r in rows] == ["KA", "KA"] and (gd / "raw_c_1234.png").exists()
                  and cl.calls[0].endswith("control-sketch-v1:0") and cl.calls[1].endswith("style-transfer-v1:0"),
                  f"gen --paid arm (c): 2 calls (sketch, then style transfer), 2 pass-KA ledger rows ({cl.calls})")
            r = _refused(lambda: RQ.send(sp, "d", 1234, "v0", True, gdir=gd), "purpose")
            check(bool(r), f"a pass-C purpose is refused under pass KA ({r[:70]!r})")
        saved = set(B.PRICE_CONFIRMED)
        B.PRICE_CONFIRMED.discard("sd35")
        try:
            r = _refused(lambda: RQ.send(sp, "a", 1234, "ka_probe", False, gdir=gd), "price")
        finally:
            B.PRICE_CONFIRMED |= saved
        check(bool(r), f"an arm whose model has no confirmed price is refused, even dry ({r[:60]!r})")
    check(B.COST_USD.get("style_transfer") == 0.08 and B.COST_USD.get("control_sketch") == 0.07
          and B.COST_USD.get("control_structure") == 0.07 and B.COST_USD.get("sd35") == 0.08
          and {"sd35", "style_transfer", "control_sketch", "style_guide"} <= B.PRICE_CONFIRMED
          and B.MODELS["style_transfer"] == "us.stability.stable-style-transfer-v1:0",
          "bedrock: confirmed KA prices (style_transfer 0.08, control_sketch / control_structure 0.07, sd35 0.08)")


def _budget(check) -> None:
    from gen import bedrock as B
    from gen import kneel_ai_budget as KB
    real = json.loads((HERE / "budget.json").read_text())
    hist = {h.get("pass"): h for h in real.get("bedrock_history") or []}
    ka, c = hist.get("KA") or {}, hist.get("C") or {}
    live = (real.get("bedrock") or {}).get("pass")      # another pass's live block (EF6) is allowed; no KA one
    check(not str(live or "").startswith("KA") and (ka.get("cap"), ka.get("per_purpose_caps"), ka.get("used")) ==
          (91, {"ka_probe": 55, "ka_pilot": 36}, 54) and bool(ka.get("closed")),
          "budget.json: pass KA closed into bedrock_history at 54 / 91 (rev 5); no live KA bedrock block")
    check(c.get("cap") == 80 and c.get("used") == 25, "pass C closed into bedrock_history at 25 / 80")
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = KB.check(True)
    check(code == 0 and "closed pass C 25/80, closed pass KA 54/91" in out.getvalue()
          and re.search(r"OK pass KA-G pilot \d+/30", out.getvalue()) is not None,
          f"kneel_ai.py budget --check on the real ledgers: {out.getvalue().strip()[-60:]!r}")
    check(B.pass_view(real, "C")["bedrock"]["pass"] == "C" and B.pass_view(real, "KA")["bedrock"]["pass"] == "KA",
          "bedrock.pass_view reads passes C and KA from bedrock_history")


def _guides(check) -> None:
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    with tempfile.TemporaryDirectory() as t:
        sp = D.load("goblin")
        g1 = G.build(sp, Path(t) / "a")
        rgb = np.random.default_rng(3).integers(0, 255, sp.idle.shape[:2] + (3,), dtype=np.uint8)
        sp.keys["idle"] = np.dstack([rgb, sp.idle[..., 3]])
        g2 = G.build(sp, Path(t) / "b")
        check(g1["sha"]["sil"] == g2["sha"]["sil"] and g1["sha"]["skel"] == g2["sha"]["skel"]
              and g1["sha"]["ref"] != g2["sha"]["ref"], "guides: a recoloured idle gives byte-identical G-sil / G-skel")
        w = g1["window"]
        check(w["k"] == 12 and (w["w"], w["h"]) == (960, 960) and Image.open(Path(t) / "a" / "guide_sil.png").size
              == (1024, 1024), f"guide window = k*w x k*h on the 1024 canvas, written to guide.json ({w})")
    sp = D.load("goblin")
    sp.__dict__["palette"] = np.vstack([sp.palette, [[240, 20, 230]]]).astype(np.uint8)
    check(sp.key_name == "white" and D.load("goblin").key_name == "magenta",
          "D-KA1 key: white when a palette colour is within dE 30 of magenta, else magenta")


def _lists(check) -> None:
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    sprites = D.conf().get("sprites") or {}
    bad_w, bad_h = [], []
    for sid in D.monsters() + D.heroes():
        e, sp = sprites.get(sid) or {}, D.load(sid)
        props = [n for n in G.prop_parts(sp.rig) if sp.rig.present(n, "idle")]
        if props and not e.get("weapons"):
            bad_w.append(sid)
        if not isinstance(e.get("heads"), list) or (not e["heads"] and not e.get("heads_none")):
            bad_h.append(sid)
    check(not bad_w, f"every rig with a kind: prop or weapon-named part has a weapons entry ({bad_w[:5]})")
    check(not bad_h, f"every sprite has a heads entry, [] only with heads_none ({bad_h[:5]})")
    check(sprites.get("rhyos", {}).get("heads") == ["head", "ram_n", "ram_f", "lizard"]
          and sprites.get("goblin", {}).get("weapons") == ["dagger"], "reviewed lists: rhyos 4 heads, goblin dagger")


def _calib(check) -> None:
    from gen import kneel_ai_data as D
    t = json.loads(D.THRESH.read_text())
    keys = {"T_hist", "T_adj", "T_area_lo", "T_area_hi", "T_prop_iou", "T_prop_outside", "T_head_iou",
            "T_head_outside", "T_dup_match", "T_pal_mean", "T_pal_p95"}
    check(set(t["thresholds"]) == keys and all(isinstance(v, float) for v in t["thresholds"].values()),
          "kneel_ai_thresholds.json pins every threshold")
    live = {s: D.load(s).excluded for s in D.monsters()}
    check(t["excluded"] == EXCLUDED == {s: w for s, w in live.items() if w},
          f"calibration exclusions pinned: {sorted(EXCLUDED)}")


def _coverage(check) -> None:
    from gen import kneel_tools as KT
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        KT.coverage()
    m = re.search(r"monsters (\d+)/123 \(ai (\d+), derived (\d+), alias (\d+)\)", out.getvalue())
    h = re.search(r"heroes (\d+)/12 \(ai (\d+), derived (\d+), alias (\d+)\)", out.getvalue())
    check(bool(m and h) and sum(map(int, m.groups()[1:])) == 123 and sum(map(int, h.groups()[1:])) == 12,
          f"coverage: G3 format ({out.getvalue().splitlines()[:1]})")


def run_kneel_ai(check: Callable[[bool, str], None]) -> None:
    from gen import selftest_kneel_ai_cut as SKC
    from gen import selftest_kneel_ai_fix as SKF
    from gen import selftest_kneel_ai_io as SKI
    from gen.selftest_colossus import sections
    sections(check, _bodies, _gate, _budget, _guides, _lists, _calib, _coverage)
    SKI.run_io(check)
    SKC.run_cut(check)
    SKF.run_fix(check)


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_kneel_ai(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

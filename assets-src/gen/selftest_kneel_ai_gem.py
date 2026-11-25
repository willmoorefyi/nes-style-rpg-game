"""Pass KA-G arm g and guard self-tests (run by selftest_gemini_batch.py; 0 calls: its fake client and sandbox).

The cache key without image_size, the request (model, refs, seeds, the prompt per body, the config), the interactive
send (dry-run, paid rows with usage, the duplicate try 1, retry from try 2, the usage stop, a linked worktree, the
reserve try), `check_budget` on the real budget.json, the cap refusals, KG1 / KG2 and the J0 pitch / arm g cut.
"""
from __future__ import annotations

import contextlib
import copy
import hashlib
import io
import json
import re
from types import SimpleNamespace

import numpy as np
from PIL import Image

from gen.selftest_gemini_batch import N0, kag_rows, real_budget, rows, sandbox, seed_ledger


def _verdict(reqs, ledger, budget=None, retry=True) -> str:
    from gen import generate as GEN
    try:
        GEN.check_budget(reqs, paid=True, max_paid=len(reqs), retry=retry, ledger=ledger,
                         budget=budget if budget is not None else real_budget())
    except SystemExit as e:
        return str(e) or "refused"
    except Exception as e:  # noqa: BLE001 - a crash is a failed check, never swallowed
        return f"ERROR {type(e).__name__}: {e}"
    return ""


def _req(sid="goblin", sheet="kneel", purpose="ka_g_pilot", n_try=1):
    from gen.kneel_ai_req import KneelRequest
    return KneelRequest(sid, SimpleNamespace(name=sheet), 1233 + n_try, f"k-{sid}-{n_try}-{purpose}", purpose, n_try)


def _row(sid, purpose, sheet="kneel"):
    return {"event": "attempt", "backend": "gemini", "character": sid, "sheet": sheet, "purpose": purpose,
            "pass": "KA-G", "key": f"r-{sid}-{purpose}", "model": "gemini-nano-banana-2.1"}


def key_and_request(check) -> None:
    from gen import gemini as GM
    from gen import kneel_ai_data as D
    from gen import kneel_ai_gem as KG
    im = Image.new("RGB", (4, 4), (1, 2, 3))
    h = hashlib.sha256(json.dumps({"backend": "gemini", "model": GM.DEFAULT_MODEL, "prompt": "p", "aspect": "1:1",
                                   "seed": 7}).encode())
    h.update(hashlib.sha256(GM._png_bytes(im)).digest())
    old = GM.cache_key("p", [im], aspect_ratio="1:1", seed=7)
    check(old == h.hexdigest()[:24] and GM.cache_key("p", [im], aspect_ratio="1:1", seed=7, image_size="1K") != old,
          "gemini.cache_key: unchanged without image_size (every older key), changed with it")
    real_conf = D.conf

    def conf():
        c = copy.deepcopy(real_conf())
        c["sprites"]["goblin"].update(refs=["idle", "hurt"], g_lines={2: {"extra": "Keep the dagger in the near hand.",
                                                                          "avoid": "a second dagger"}})
        return c
    with sandbox() as sb:
        D.conf = conf
        try:
            sp = D.load("goblin")
            r1, r2, r4 = (KG.request(sp, n, "ka_g_pilot") for n in (1, 2, 4))
        finally:
            D.conf = real_conf
        check((r1.refs, len(r1.images), r1.seed, r2.refs, len(r2.images), r2.seed, r4.seed) ==
              (("idle", "pose"), 2, 1234, ("idle", "pose", "hurt"), 3, 1235, 1237) and r1.sheet.name == "kneel",
              "request: try 1 sends [idle, pose] (m8), a later try adds the hurt when refs lists it; seeds 1234 + N - 1, "
              "the reserve 1237")
        p1, p2 = r1.prompt, r2.prompt
        check(p1.startswith("Image 1 shows one character. Redraw this exact character in the pose of the grey "
                            "silhouette in image 2: kneeling on one knee") and "holding exactly 1 dagger" in p1
              and "exactly 1 head" in p1 and "Side view facing right" in p1 and "Plain flat magenta" in p1
              and "Do not add:" in p1 and "magenta background" not in p1 and "white background" in p1
              and "near hand" not in p1, f"prompt (biped): the rev-7 text, counts, facing, key colour, the "
                                         f"negatives without the key colour ({p1[:90]!r})")
        check(p2.startswith("Image 1 and image 3 show one character") and "Keep the dagger in the near hand." in p2
              and "a second dagger" in p2, "prompt try 2: image 3 wording, the g_lines extra and avoid lines")
        cases = {s: KG.prompt(D.load(s), 1) for s in ("wolf", "green_slime", "white_mage")}
        check("lying down" in cases["wolf"] and "slumped and flattened" in cases["green_slime"]
              and "robe pooled" in cases["white_mage"] and "facing left" in cases["white_mage"],
              "prompt per body: quadruped, blob, robed hero (facing left)")
        GM.generate(r1.prompt, list(r1.images), aspect_ratio="1:1", seed=1234, model=KG.gconf()["model"],
                    image_size="1K")
        model, contents, cfg = sb.fake.models.last
        check(model == "gemini-nano-banana-2.1" and cfg.response_modalities == ["IMAGE"] and cfg.seed == 1234
              and cfg.image_config.aspect_ratio == "1:1" and cfg.image_config.image_size == "1K"
              and len(contents) == 3 and GM.LAST_USAGE.get("prompt_token_count") == 1026,
              "gemini.generate: model passed explicitly, IMAGE, 1:1, 1K, the seed; usage_metadata recorded")


def interactive(check) -> None:
    from gen import kneel_ai_data as D
    from gen import kneel_ai_gem as KG
    # the real pass KA-G has recorded usage_recounted: true since its pilot; the usage gate is tested from a fresh pass
    fresh = real_budget()
    next(p for p in fresh["passes"] if p.get("name") == "pass KA-G")["usage_recounted"] = False
    with sandbox(fresh) as sb:
        sp = D.load("goblin")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            KG.send(sp, 1, "ka_g_pilot", False)
        check(sb.fake.models.calls == 0 and not kag_rows() and (D.OUT / "goblin" / "req_g_1.json").exists()
              and "guard OK" in out.getvalue(), f"gen --arm g without --paid: nothing sent or logged ({out.getvalue()[-60:]!r})")
        path, stop = KG.send(sp, 1, "ka_g_pilot", True)
        a, res = kag_rows(), rows("result")[-1]
        check(sb.fake.models.calls == 1 and path.name == "raw_g_1.png" and path.exists() and stop is None and len(a) == 1
              and (a[0]["backend"], a[0]["purpose"], a[0]["req"], a[0]["seed"], a[0]["est_usd"], a[0]["sheet"]) ==
              ("gemini", "ka_g_pilot", "goblin:1", 1234, 0.0351, "kneel") and res["ok"]
              and res["usage"]["prompt_token_count"] == 1026, f"gen --paid: attempt row then result row with usage ({a})")
        sb.conf["template"] = sb.conf["template"] + " "
        sb.conf["template"] = sb.conf["template"].replace("Same 16-bit", "The same 16-bit")
        r = _refused(lambda: KG.send(sp, 1, "ka_g_pilot", True))
        check("already has 1 paid attempt" in r and sb.fake.models.calls == 1, f"a duplicate try 1 is refused ({r[:70]!r})")
        KG.send(sp, 2, "ka_g_pilot", True)
        check(sb.fake.models.calls == 2 and len(kag_rows()) == 2, "try 2 passes retry=True and is allowed")
        r = _refused(lambda: KG.send(sp, 4, "ka_g_pilot", True))
        check("reserve" in r, f"try 4 needs ka_g_reserve ({r[:70]!r})")
        sb.fake.models.usage = {**sb.fake.models.usage, "thoughts_token_count": 12}
        _, stop = KG.send(sp, 3, "ka_g_pilot", True)
        r = _refused(lambda: KG.send(D.load("wolf"), 1, "ka_g_pilot", True))
        check(stop is not None and "recount" in stop and "recount" in r and sb.fake.models.calls == 3,
              f"usage: billed thoughts stop the pilot; the next call is refused until usage_recounted ({r[:60]!r})")
    with sandbox(linked=True) as sb:
        r = _refused(lambda: KG.send(D.load("goblin"), 1, "ka_g_pilot", True))
        check("main checkout" in r and sb.fake.models.calls == 0 and not kag_rows(), "a linked worktree is refused")


def _refused(fn) -> str:
    try:
        fn()
    except SystemExit as e:
        return str(e)
    return ""


def guard(check) -> None:
    base = [json.loads(x) for x in seed_ledger().splitlines() if x.strip()]
    v = _verdict([_req()], base, retry=False)
    check(v == "", f"check_budget on the real budget.json: a goblin/kneel pilot try passes, no KeyError ({v[:80]!r})")
    full = base + [_row(f"s{i}", p) for p, n in (("ka_g_pilot", 30), ("ka_g_batch", 375), ("ka_g_reserve", 135),
                                                  ("ka_g_expiry", 125)) for i in range(n)]
    cases = [("the 666th image", [_req(purpose="ka_g_reserve", n_try=4)], full, "run cap of 665"),
             ("a 5th try", [_req(purpose="ka_g_reserve", n_try=4)], base + [_row("goblin", "ka_g_pilot")] * 3
              + [_row("goblin", "ka_g_reserve")], "already used 4"),
             ("a 4th without ka_g_reserve", [_req(n_try=4)], base + [_row("goblin", "ka_g_pilot")] * 3, "must carry"),
             ("a non-kneel sheet", [_req(sheet="monster_small")], base, "only_sheet_names"),
             ("try 2 without retry", "noretry", base + [_row("goblin", "ka_g_pilot")], "--retry"),
             ("a 31st pilot image", [_req("x31")], base + [_row(f"p{i}", "ka_g_pilot") for i in range(30)], "ka_g_pilot"),
             ("an unknown purpose", [_req(purpose="ka_probe")], base, "needs a purpose")]
    for label, reqs, led, word in cases:
        v = _verdict([_req(n_try=2)], led, retry=False) if reqs == "noretry" else _verdict(reqs, led)
        check(bool(v) and word in v and not v.startswith("ERROR"), f"guard: {label} is refused ({v[:90]!r})")
    ok = [_verdict([_req(purpose="ka_g_reserve", n_try=4)], base + [_row("goblin", "ka_g_pilot")] * 3
                   + [_row("goblin", "ka_g_expiry")] * 2),
          _verdict([_req(purpose="ka_g_expiry")], base + [_row("goblin", "ka_g_batch")] * 3 + [_row("goblin", "ka_g_reserve")])]
    check(ok == ["", ""], f"guard: ka_g_expiry rows are not counted per sheet (a reserve 4th after 2 expiry rows, an "
                          f"expiry re-send after 4 tries) ({ok})")
    r = _verdict([_req()], base[:-3])
    check("inconsistent" in r, f"consistency: a ledger short of attempts_before 405 refuses ({r[:60]!r})")


def kg1_kg2(check) -> None:
    from gen import bedrock as B
    from gen import kneel_ai_budget as KB
    from gen.selftest_colossus import _refused as refused, sandbox as br_sandbox
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = KB.check(True)
    text = out.getvalue()
    check(code == 0 and "closed pass C 25/80, closed pass KA 54/91, closed pass KA-FIX 2/60" in text and re.search(
        r"OK pass KA-G pilot \d+/30, batch \d+/375, reserve \d+/135, total \d+/540, expiry \d+/125, est \$\d+\.\d\d",
        text) is not None, f"KG1: kneel_ai.py budget --check on the real ledgers ({text.strip()!r})")
    real, br = real_budget(), B.read_br_ledger()
    base = [json.loads(x) for x in seed_ledger().splitlines() if x.strip()]
    for label, edit, word in (
            ("a non-KA-G Gemini row", lambda b, r, g: g.append({"event": "attempt", "backend": "gemini",
                                                                "character": "x", "sheet": "kneel"}), "not a KA-G"),
            ("a Bedrock row of pass KA", lambda b, r, g: r.append({"event": "request", "pass": "KA"}), "pass KA"),
            ("a live bedrock block", lambda b, r, g: b.update(bedrock={"pass": "KA"}), "live bedrock"),
            ("a kneel row on another sheet", lambda b, r, g: g.append(_row("x", "ka_g_batch", "monster")), "not a")):
        b, r, g = copy.deepcopy(real), list(br), list(base)
        edit(b, r, g)
        bad, _ = KB.breaches(b, r, g)
        check(any(word in x for x in bad), f"KG1: {label} breaches ({bad[:1]})")
    ka = sum(x.get("event") == "request" and x.get("pass") == "KA" for x in br)
    fix = sum(x.get("event") == "request" and x.get("pass") == "KA-FIX" for x in br)
    later = {h.get("pass") for h in real.get("bedrock_history") or [] if h.get("closed")}   # LM .. AR, closed since KA
    other = {x.get("pass") for x in br if x.get("event") == "request"} - {"C", "KA", "KA-FIX"} - later
    other -= {(real.get("bedrock") or {}).get("pass")} - {"KA", "KA-FIX", "KA-G"}   # a live non-kneel pass (EF6)
    check(ka == 54 and fix == 2 and not other, f"KG2: the BR ledger holds 54 pass-KA rows, the 2 rows of KA-FIX (closed "
          f"by KT3, 2026-11-18) and otherwise only passes closed in bedrock_history ({ka}, {fix}, {other})")
    with br_sandbox({k: v for k, v in real.items() if k != "bedrock"}) as (BB, tmp, cl):   # as after any pass closes
        r = refused(lambda: BB.invoke("core", {"prompt": "x", "seed": 1}, paid=True, purpose="ka_probe"), "bedrock")
        check(bool(r) and not cl.calls, f"bedrock.invoke refuses every call with no live bedrock block ({r[:60]!r})")


def pitch(check) -> None:
    from gen import kneel_ai_cut as C
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    from gen import kneel_ai_pitch as PT
    with sandbox():
        sp = D.load("goblin")
        g = G.build(sp, D.OUT / "goblin", None)
        k, raw = g["window"]["k"], Image.open(D.OUT / "goblin" / "reference.png")
        m = PT.measure(np.asarray(raw.convert("RGB")), k)
        check(m["grid"] and m["rel"] < 0.05, f"J0 pitch: a k-upscaled idle has a grid at p ~ k ({PT.note(m)})")
        r = C.cut(raw, sp, k, "g", PT.sil_height(D.OUT / "goblin"))
        check(r["info"]["pitch"]["grid"] and r["info"]["scale_path"] in (None, "arm-d") and "window" in r["info"],
              f"arm g cut at k: pitch recorded, window phase aligned ({r['info'].get('scale_path')})")
        e = ""
        try:
            C.cut(raw.crop((0, 0, 1024, 900)), sp, k, "g")
        except C.CutFail as x:
            e = str(x)
        check(e.startswith("size"), f"J0 size: a non-square raw fails the cut ({e[:60]!r})")
    p = {"grid": True, "p": 12.0, "phase": [0.0, 0.0], "conf": 0.9}
    check(PT.scale(105, 100, 10, p, 50) == (1.0, None) and PT.scale(120, 100, 10, p, 50)[1] == "pitch"
          and abs(PT.scale(120, 100, 10, p, 50)[0] - 10 / 12) < 1e-9 and PT.scale(150, 100, 10, p, 50)[1] == "arm-d",
          "scale: within 10 % s = 1; off by k/p -> s = k / p; otherwise the arm-(d) path")
    check(PT.align(13, 0, 1.0, {**p, "p": 10.0}, 10, 0) == 10 and PT.align(13, 0, 1.0, {**p, "grid": False}, 10, 0) == 13
          and PT.align(17, 0, 1.0, {**p, "p": 10.0}, 10, 0) == 20,
          "align: the window origin moves to the nearest grid line (at most k / 2), not without a grid")


def run_gem(check) -> None:
    from gen.selftest_colossus import sections
    sections(check, key_and_request, interactive, guard, kg1_kg2, pitch)
    _ = N0

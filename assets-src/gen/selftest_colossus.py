"""Pass C framework self-tests (docs/CHAOS_FORMS_PLAN.md 5.1, 9.3; FW-C), run from selftest.py (test_monster_anim,
also --anim). Part 1 (this file): the BR ledger, cap and paid / purpose / linked-worktree gate inside
`bedrock.invoke` (R23, A6) on a mocked client (no request ever leaves the machine), `colossus.py budget --check` (R24),
the budget.json `bedrock` block, the Gemini guard and generate.py's Bedrock paths, and the approve overwrite gate with
`retire.py --colossus`. Part 2 (selftest_colossus_art.py): the `colossus` build stage and its TS contract (18.5, R25,
R26), locks and tools/stage_rim.py; selftest_colossus_up / _ip (upscale, inpaint); selftest_colossus_paint (rev 4: the
painted pipeline, 18.2 / 18.7 / B1) and selftest_colossus_gate (rev 4: upscale --form, the reserve cost rule B7, the
v1 archive and approve).

  python3 -I assets-src/gen/selftest_colossus.py
"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import sys
import tempfile
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HERE = Path(__file__).resolve().parent
# literals (pass C, docs/CHAOS_FORMS_PLAN.md 5.6 / 6): never computed from the ledgers
N_C0 = 405                      # Gemini attempts in the main-checkout ledger at C1 (counted 2026-11-16)
CAP_C = 80                      # D-U5 (user)
PURPOSE_CAPS = {"v0": 9, "f3_gen": 12, "f3_upscale": 6, "f3_nobg": 4, "f2_gen": 2, "f2_upscale": 2, "f2_nobg": 4,
                "f4_variant": 2, "f4_inpaint": 8, "rim_upscale": 2, "reserve": 29}
# rev 4 (18.9, B7), re-tabled at 17 of 80 used: v0 and f4_variant closed at their use; rim_upscale 2 (7.3) stays, so the
# reserve is 18.9's 31 less those 2; the reserve only takes calls <= $0.08 (RESERVE_MAX_USD)
RESERVE_MAX_USD = 0.08


def _refused(fn: Callable[[], object], *words: str) -> str:
    """'' when fn did not refuse; else the refusal text (SystemExit starting with 'refused')."""
    try:
        fn()
    except SystemExit as e:
        msg = str(e)
        return msg if msg.startswith("refused") and all(w in msg for w in words) else ""
    return ""


class _FakeClient:
    """A bedrock-runtime stand-in: records calls; `fail` raises, `reject` raises ValidationException for those ids."""

    class exceptions:
        class ValidationException(Exception):
            pass

    def __init__(self, fail: bool = False, reject: tuple[str, ...] = ()):
        self.calls: list[str] = []
        self.bodies: list[dict] = []
        self.fail, self.reject = fail, reject

    def invoke_model(self, modelId, body, accept, contentType):     # noqa: N803 (boto3 names)
        self.calls.append(modelId)
        self.bodies.append(json.loads(body))
        if self.fail:
            raise RuntimeError("mocked network failure")
        if modelId in self.reject:
            raise self.exceptions.ValidationException("mocked: inference profile id not accepted")
        from PIL import Image
        from gen import bedrock as B
        payload = json.dumps({"images": [B.png_b64(Image.new("RGBA", (8, 4), (9, 9, 9, 255)))],
                              "finish_reasons": ["SUCCESS"]}).encode()
        return {"body": io.BytesIO(payload)}


@contextlib.contextmanager
def sandbox(budget: dict | None = None, linked: bool = False, client: _FakeClient | None = None):
    """bedrock.CACHE / BR_LEDGER / BUDGET in a temp dir, a fake client and a fake git layout (main checkout unless
    `linked`). Yields (B, tmp, client)."""
    from gen import bedrock as B
    real = B.CACHE, B.BR_LEDGER, B.BUDGET, B._client, B.git_dirs
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        B.CACHE, B.BR_LEDGER, B.BUDGET = tmp / "cache", tmp / "cache" / "bedrock_ledger.jsonl", tmp / "budget.json"
        if budget is not None:
            B.BUDGET.write_text(json.dumps(budget))
        B._client = client or _FakeClient()
        B.git_dirs = (lambda: (tmp / ".git" / "worktrees" / "x", tmp / ".git")) if linked else \
            (lambda: (tmp / ".git", tmp / ".git"))
        try:
            yield B, tmp, B._client
        finally:
            B.CACHE, B.BR_LEDGER, B.BUDGET, B._client, B.git_dirs = real


def _budget() -> dict:
    return json.loads((HERE / "budget.json").read_text())


def _rows(B) -> list[dict]:
    return B.read_br_ledger()


def _fake_rows(purpose: str, n: int, pass_name: str = "C") -> list[dict]:
    return [{"event": "request", "ts": "t", "tool": "selftest", "model": "core", "purpose": purpose, "seed": i,
             "key": f"k{purpose}{i}", "pass": pass_name} for i in range(n)]


def _seed_ledger(B, rows: list[dict]) -> None:
    B.BR_LEDGER.parent.mkdir(parents=True, exist_ok=True)
    B.BR_LEDGER.write_text("".join(json.dumps(r) + "\n" for r in rows))


def sections(check: Callable[[bool, str], None], *fns: Callable) -> None:
    """Run each section; a crash (e.g. RED: the code under test is missing) is one FAIL, and the next section runs."""
    for fn in fns:
        try:
            fn(check)
        except (Exception, SystemExit) as e:
            check(False, f"{fn.__name__}: crashed: {type(e).__name__}: {str(e)[:160]}")


def run_colossus(check: Callable[[bool, str], None]) -> None:
    sections(check, _pinned, _guard, _generate_paths, _budget_check, _approve, _edit_models, _edit_bodies,
             _edit_gate, _edit_cache)
    from gen import selftest_colossus_art as SCA
    from gen import selftest_colossus_gate as SCG
    from gen import selftest_colossus_ip as SCI
    from gen import selftest_colossus_paint as SCP
    from gen import selftest_colossus_up as SCU
    SCA.run_art(check)
    SCU.run_up(check)
    SCI.run_ip(check)
    SCP.run_paint(check)
    SCG.run_gate(check)


def _pinned(check) -> None:
    br = _budget().get("bedrock") or {}
    check((br.get("pass"), br.get("cap"), br.get("per_purpose_caps"), br.get("gemini_before")) ==
          ("C", CAP_C, PURPOSE_CAPS, N_C0) and br.get("reserve_max_usd") == RESERVE_MAX_USD,
          f"budget.json bedrock block: pass C, cap {CAP_C}, the 5.6 per-purpose caps, gemini_before N_C0 = {N_C0} "
          f"({ {k: br.get(k) for k in ('pass', 'cap', 'gemini_before')} })")
    check(sum(PURPOSE_CAPS.values()) == CAP_C, f"the 5.6 per-purpose caps sum to the cap {CAP_C}")
    from gen import selftest_passv as SPV
    check(_budget().get("attempts_before") == SPV.N_V0 and _budget().get("cap") == SPV.CAP_V,
          "budget.json: the pass-V literals are untouched by the bedrock block")


def _guard(check) -> None:
    body = {"prompt": "selftest", "seed": 7, "output_format": "png"}
    real = _budget()
    with sandbox(real) as (B, tmp, cl):
        r = _refused(lambda: B.invoke("core", body, paid=False, purpose="v0"), "paid")
        check(bool(r) and not cl.calls and not _rows(B), f"invoke: refused without paid=True, nothing sent or logged ({r[:70]!r})")
        img = B.invoke("core", body, paid=True, purpose="v0")
        rows = _rows(B)
        req = [x for x in rows if x.get("event") == "request"]
        res = [x for x in rows if x.get("event") == "result"]
        check(img.size == (8, 4) and len(req) == 1 and set(req[0]) >= {"ts", "tool", "model", "purpose", "seed", "key",
                                                                      "pass"}
              and req[0]["pass"] == "C" and req[0]["purpose"] == "v0" and req[0]["seed"] == 7
              and len(res) == 1 and res[0].get("ok") is True and res[0].get("served") == cl.calls[-1],
              f"invoke: a paid v0 call writes one request row (ts, tool, model, purpose, seed, key, pass C) and a result "
              f"with the serving id ({rows})")
        n_calls = len(cl.calls)
        B.invoke("core", body, paid=False, purpose="not-a-purpose")
        check(len(_rows(B)) == len(rows) and len(cl.calls) == n_calls,
              "invoke: a cache hit returns before every check and is not logged (even unpaid, unknown purpose)")
    with sandbox(real, client=_FakeClient(reject=("us.stability.stable-image-remove-background-v1:0",))) as (B, tmp, cl):
        B.invoke("remove_bg", {"image": "x", "output_format": "png"}, paid=True, purpose="f3_nobg")
        rows = _rows(B)
        check(len(cl.calls) == 2 and [x["event"] for x in rows] == ["request", "result"]
              and rows[1]["served"] == "stability.stable-image-remove-background-v1:0",
              f"invoke: the us.-prefix fallback is one logical request (one row), its result names the id that served "
              f"({rows})")
    with sandbox(real, client=_FakeClient(fail=True)) as (B, tmp, cl):
        with contextlib.suppress(RuntimeError):
            B.invoke("core", body, paid=True, purpose="f3_gen")
        rows = _rows(B)
        check([x["event"] for x in rows] == ["request", "result"] and rows[1]["ok"] is False and len(cl.calls) >= 1,
              f"invoke: the request row is written before the first try; a failure is logged and counts as spent ({rows})")
    for label, purpose in (("an unknown purpose", "character_sheet"), ("a bare reserve", "reserve"),
                           ("a reserve with an empty reason", "reserve:")):
        with sandbox(real) as (B, tmp, cl):
            r = _refused(lambda: B.invoke("core", body, paid=True, purpose=purpose), "purpose")
            check(bool(r) and not cl.calls and not _rows(B), f"invoke: {label} ({purpose!r}) is refused under pass C, nothing "
                                                             f"sent or logged ({r[:90]!r})")
    with sandbox(real) as (B, tmp, cl):
        B.invoke("core", body, paid=True, purpose="reserve:F3 first, orchestrator note")
        check(_rows(B)[0]["purpose"] == "reserve:F3 first, orchestrator note", "invoke: reserve:<reason> is allowed and "
                                                                              "logged with its note")
    with sandbox(real, linked=True) as (B, tmp, cl):
        r = _refused(lambda: B.invoke("core", body, paid=True, purpose="v0"), "worktree")
        check(bool(r) and not cl.calls and not _rows(B), f"invoke: refused from a linked worktree ({r[:90]!r})")
    from gen import bedrock as B0
    gd, cd = B0.git_dirs()
    check((gd != cd) == ((HERE.parent.parent / ".git").is_file()), f"git_dirs: this checkout is linked = {gd != cd} "
                                                                    f"(git-dir {gd.name}, common {cd.name})")
    wide = copy.deepcopy(real)                       # the pass cap alone: a reserve cap above the pass cap
    wide["bedrock"]["per_purpose_caps"]["reserve"] = CAP_C + 10
    for label, b, purpose, rows, word in (
            ("the pass cap", wide, "reserve:x", _fake_rows("reserve", CAP_C), f"cap of {CAP_C}"),
            ("the v0 cap", real, "v0", _fake_rows("v0", PURPOSE_CAPS["v0"]), "v0"),
            ("the reserve cap", real, "reserve:x", _fake_rows("reserve", PURPOSE_CAPS["reserve"]), "reserve")):
        with sandbox(b) as (B, tmp, cl):
            _seed_ledger(B, rows)
            r = _refused(lambda: B.invoke("core", body, paid=True, purpose=purpose), "cap", word)
            n_sent = len(cl.calls)
            _seed_ledger(B, rows[:-1])
            ok = B.invoke("core", body, paid=True, purpose=purpose) is not None
            check(bool(r) and n_sent == 0 and ok,
                  f"invoke: refused at {label} ({len(rows)} rows: {r[:80]!r}); one row less is allowed")
    with sandbox(real) as (B, tmp, cl):
        _seed_ledger(B, _fake_rows("v0", PURPOSE_CAPS["v0"], pass_name="B"))
        check(B.invoke("core", body, paid=True, purpose="v0") is not None, "invoke: rows of another pass do not count")
    no_block = {k: v for k, v in real.items() if k != "bedrock"}
    with sandbox(no_block) as (B, tmp, cl):
        r = _refused(lambda: B.invoke("core", body, paid=True, purpose="v0"), "bedrock")
        check(bool(r) and not cl.calls, f"invoke: fail-closed without a budget.json bedrock block ({r[:80]!r})")


def _generate_paths(check) -> None:
    from gen import generate as GEN
    real = _budget()
    char = GEN.load_character("knight")
    with sandbox(real) as (B, tmp, cl):
        req = GEN.plan_request(char, GEN.SHEETS["battle"], 990001, "bedrock", None, paid=True)
        r = _refused(req.run, "purpose", GEN.BEDROCK_PURPOSE)
        check(bool(r) and not cl.calls and not _rows(B),
              f"generate.py: the character-sheet Bedrock path passes paid / purpose and is refused under pass C (A6) "
              f"({r[:90]!r})")
        req0 = GEN.plan_request(char, GEN.SHEETS["battle"], 990001, "bedrock", None)
        r0 = _refused(req0.run, "paid")
        check(bool(r0) and not cl.calls, f"generate.py: without --paid the Bedrock path is refused by invoke ({r0[:70]!r})")
    mon = GEN.load_character("goblin")
    r = _refused(lambda: GEN.plan_request(mon, GEN.SHEETS["monster_small"], 1, "bedrock", None), "Gemini-only")
    check(bool(r), f"generate.py: monster sheets still refuse Bedrock ({r[:60]!r})")
    from gen.selftest import _req
    loose = {"attempts_before": 0, "cap": 1, "max_attempts_per_sheet": 3, "passes": []}
    bed = [{"event": "attempt", "backend": "bedrock", "character": "x", "sheet": "y"}] * 5
    a = _req("selftest-colossus-a")
    ok = GEN.check_budget([a], paid=True, max_paid=1, retry=False, ledger=bed, budget=loose) == [a]
    r = _refused(lambda: GEN.check_budget([a], paid=True, max_paid=1, retry=False, budget=loose,
                                          ledger=bed + [{"event": "attempt", "backend": "gemini", "character": "x",
                                                         "sheet": "y"}]))
    check(ok and bool(r), "the Gemini guard still skips Bedrock entries (5 Bedrock attempts leave a cap of 1 open; 1 "
                          "Gemini attempt closes it)")


def _budget_check(check) -> None:
    from gen import colossus as C
    real = _budget()
    gem = N_C0

    def breaches(rows, g=gem, b=real):
        return C.budget_breaches(b, rows, g)
    full = [r for p, c in PURPOSE_CAPS.items() for r in _fake_rows(p, c)]
    check(breaches([]) == [] and breaches(full) == [], f"budget --check: an empty and a full pass C ({len(full)}) pass")
    over = breaches(full + _fake_rows("v0", 1))
    check(any("80" in x for x in over) and any("v0" in x for x in over), f"budget --check: call 81 breaches the cap and v0 "
                                                                        f"({over})")
    check(any("f2_gen" in x for x in breaches(_fake_rows("f2_gen", 9))), "budget --check: a purpose over its cap breaches")
    check(any("gem" in x.lower() for x in breaches([], g=gem + 1)), "budget --check: one Gemini attempt past N_C0 breaches "
                                                                   "(D-U6)")
    check(any("unknown" in x for x in breaches(_fake_rows("character_sheet", 1))), "budget --check: a pass-C row with an "
                                                                                    "unknown purpose breaches")
    bad = copy.deepcopy(real)
    bad["bedrock"]["per_purpose_caps"]["v0"] = 13
    check(any("sum" in x for x in breaches([], b=bad)), "budget --check: per-purpose caps that do not sum to the cap breach")
    check(breaches(_fake_rows("v0", 40, pass_name="B")) == [], "budget --check: other passes' rows are not counted")
    with sandbox(real) as (B, tmp, cl):
        _seed_ledger(B, full + _fake_rows("v0", 1))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code_bad = C.main(["budget", "--check"], gem_ledger=tmp / "none.jsonl")
        _seed_ledger(B, full)
        with contextlib.redirect_stdout(out):
            code_ok = C.main(["budget", "--check"], gem_ledger=tmp / "none.jsonl", gem_count=N_C0)
    check(code_bad != 0 and code_ok == 0, f"colossus.py budget --check exits non-zero on a breach ({code_bad}), 0 at the cap")
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = C.main(["budget", "--check"])
    check(code == 0, f"colossus.py budget --check on the real ledgers exits 0 ({out.getvalue().strip()[-120:]!r})")


def _approve(check) -> None:
    from PIL import Image
    from gen import colossus as C
    from gen import retire as RT
    with tempfile.TemporaryDirectory() as t:
        gen = Path(t) / "gen"
        (gen / "colossus").mkdir(parents=True)
        tree = RT.Tree(gen)
        pix = Path(t) / "pix.png"
        Image.new("RGBA", (6, 4), (24, 24, 33, 255)).save(pix)
        meta = {"source": "raw.png", "seed": 1, "model": "core", "prompt_sha256": "0" * 64, "cache_keys": ["abc"]}
        (gen / "cache").mkdir()
        for e in ("png", "json"):
            (gen / "cache" / f"abc.{e}").write_text(e)
        dst = C.approve("chaos_horizon", pix, meta, tree=tree, gitignore=Path(t) / ".gitignore")
        m = json.loads((dst.parent / "meta.json").read_text())
        ign = (Path(t) / ".gitignore").read_text()
        check(dst.read_bytes() == pix.read_bytes() and m["cache_keys"] == ["abc"]
              and "!assets-src/gen/cache/abc.png" in ign and "!assets-src/gen/cache/abc.json" in ign,
              "approve: copies the master, writes meta.json and un-ignores its cache files")
        Image.new("RGBA", (6, 4), (222, 165, 82, 255)).save(pix)
        r = _refused(lambda: C.approve("chaos_horizon", pix, meta, tree=tree, gitignore=Path(t) / ".gitignore"),
                     "archive")
        check(bool(r), f"approve: refuses to overwrite a master without a byte-identical archive ({r[:90]!r})")
        (gen / "colossus" / "chaos_horizon.yaml").write_text("form: chaos_horizon\n")
        rid = RT.retire_colossus(tree, "chaos_horizon")
        arch = tree.archive / rid
        check(rid == "chaos_horizon_v1" and (arch / "master.png").read_bytes() == dst.read_bytes()
              and (arch / "meta.json").exists() and (arch / "chaos_horizon.yaml").exists()
              and (arch / "cache" / "abc.png").exists(),
              f"retire.py --colossus: archives master, meta.json, layer yaml and cache keys as {rid}")
        check(RT.retire_colossus(tree, "chaos_horizon") == rid, "retire.py --colossus: idempotent")
        dst2 = C.approve("chaos_horizon", pix, meta, tree=tree, gitignore=Path(t) / ".gitignore")
        check(dst2.read_bytes() == pix.read_bytes(), "approve: with the archive in place the overwrite is allowed")
        r = _refused(lambda: RT.retire_colossus(tree, "chaos_horizon", "chaos_horizon_v1"), "different")
        check(bool(r), f"retire.py --colossus: refuses an existing archive id with different bytes ({r[:80]!r})")


# ───────────── the edit subcommands: outpaint, search_replace, structure (V0-e, V0-d, C3 / F4; 0 paid) ─────────────

OUTPAINT_ID = "us.stability.stable-outpaint-v1:0"       # confirmed read-only in us-west-2 (ROSTER_LOG Pass C - C2)


def _src(tmp: Path, size=(256, 112), mode="RGB") -> Path:
    from PIL import Image
    p = tmp / "core_11_raw.png"
    Image.new(mode, size, (40, 40, 44) if mode == "RGB" else (40, 40, 44, 255)).save(p)
    p.with_suffix(".json").write_text(json.dumps({"seed": 11, "model": "core", "cache_keys": ["k0"]}))
    return p


def _main(C, argv: list[str]) -> tuple[int | None, str]:
    """(exit code | None on a refusal, stdout + refusal text)."""
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            code = C.main(argv)
    except SystemExit as e:
        return None, out.getvalue() + str(e)
    return code, out.getvalue()


def _edit_argv(kind: str, src: Path, *extra: str) -> list[str]:
    base = {"outpaint": ["outpaint", "chaos_horizon", str(src), "--left", "512", "--right", "384", "--up", "256",
                         "--prompt", "the far shoulder range", "--seed", "11"],
            "search_replace": ["search_replace", "chaos_horizon", str(src), "--search", "the chest fissure",
                               "--prompt", "a torn-open fissure, white-hot core", "--seed", "12"],
            "structure": ["structure", "chaos_horizon", str(src), "--prompt", "arms raised", "--seed", "13"]}[kind]
    return base + list(extra)


def _edit_models(check) -> None:
    from gen import bedrock as B
    check(B.MODELS.get("outpaint") == OUTPAINT_ID, f"bedrock.MODELS: outpaint = {OUTPAINT_ID} ({B.MODELS.get('outpaint')})")
    check(B.MODELS.get("search_replace") == "us.stability.stable-image-search-replace-v1:0"
          and B.MODELS.get("structure") == "us.stability.stable-image-control-structure-v1:0",
          "bedrock.MODELS: search_replace and structure keep their inference-profile ids")


def _edit_bodies(check) -> None:
    import base64
    from PIL import Image
    from gen import colossus as C
    want = {"outpaint": ({"image", "left", "right", "up", "down", "prompt", "creativity", "seed", "output_format"},
                         {"left": 512, "right": 384, "up": 256, "down": 0, "creativity": 0.5, "seed": 11,
                          "prompt": "the far shoulder range"}, OUTPAINT_ID),
            "search_replace": ({"image", "prompt", "search_prompt", "seed", "output_format", "grow_mask"},
                               {"search_prompt": "the chest fissure", "prompt": "a torn-open fissure, white-hot core",
                                "grow_mask": 5, "seed": 12}, "us.stability.stable-image-search-replace-v1:0"),
            "structure": ({"image", "prompt", "control_strength", "seed", "output_format"},
                          {"prompt": "arms raised", "control_strength": 0.7, "seed": 13},
                          "us.stability.stable-image-control-structure-v1:0")}
    for kind, (keys, vals, mid) in want.items():
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp)
            code, out = _main(C, _edit_argv(kind, src, "--purpose", "v0", "--paid"))
            body = cl.bodies[0] if cl.bodies else {}
            img = Image.open(io.BytesIO(base64.b64decode(body.get("image", "")))) if body.get("image") else None
            check(code == 0 and set(body) == keys and all(body.get(k) == v for k, v in vals.items())
                  and body.get("output_format") == "png" and img is not None and img.size == (256, 112)
                  and img.format == "PNG" and cl.calls[:1] == [mid],
                  f"{kind}: body keys {sorted(keys)}, the given values, image = the source as base64 PNG, "
                  f"output_format png, sent to {mid} ({code}, {sorted(body)}, {cl.calls})")
            dst = [p for p in tmp.glob("*_raw.png") if p != src]
            side = json.loads(dst[0].with_suffix(".json").read_text()) if len(dst) == 1 else {}
            check(len(dst) == 1 and side.get("model") == kind and side.get("purpose") == "v0"
                  and side.get("source") == str(src) and len(side.get("cache_keys", [])) == 2
                  and side["cache_keys"][0] == "k0",
                  f"{kind}: writes one *_raw.png next to the source with a sidecar (model, purpose, source, the "
                  f"source's cache keys plus this one) ({[p.name for p in dst]}, {side})")
    with sandbox(_budget()) as (B, tmp, cl):
        src = _src(tmp, mode="RGBA")
        _main(C, _edit_argv("structure", src, "--control-strength", "0.4", "--negative", "a face", "--purpose", "v0",
                            "--paid"))
        b = cl.bodies[0] if cl.bodies else {}
        img = Image.open(io.BytesIO(base64.b64decode(b["image"]))) if b.get("image") else None
        check(b.get("control_strength") == 0.4 and b.get("negative_prompt") == "a face" and img is not None
              and img.mode == "RGB", f"structure: --control-strength / --negative reach the body; an RGBA source is "
                                     f"sent as RGB ({ {k: v for k, v in b.items() if k != 'image'} })")
    bad = (("outpaint with no direction", ["outpaint", "chaos_horizon", "{src}", "--seed", "1"], "direction"),
           ("outpaint over 2000 px", _edit_argv("outpaint", Path("{src}"), "--down", "2001"), "2000"),
           ("creativity out of range", _edit_argv("outpaint", Path("{src}"), "--creativity", "1.5"), "creativity"),
           ("control_strength out of range", _edit_argv("structure", Path("{src}"), "--control-strength", "1.2"),
            "control_strength"),
           ("grow_mask out of range", _edit_argv("search_replace", Path("{src}"), "--grow-mask", "21"), "grow_mask"),
           ("seed 0 (random, not repeatable)", _edit_argv("structure", Path("{src}"))[:-1] + ["0"], "seed"),
           ("an unknown form", ["structure", "chaos_nope", "{src}", "--prompt", "x", "--seed", "1"], "unknown form"))
    for label, argv, word in bad:
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp)
            code, out = _main(C, [a.replace("{src}", str(src)) for a in argv] + ["--purpose", "v0", "--paid"])
            check(code != 0 and word in out and not cl.calls and not _rows(B),
                  f"edit: {label} is refused before any request, nothing sent or logged ({out.strip()[-90:]!r})")
    for label, size in (("a side under 64 px", (63, 100)), ("an aspect over 2.5:1", (260, 100)),
                        ("over 9,437,184 px", (4000, 2400))):
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp, size=size)
            code, out = _main(C, _edit_argv("search_replace", src, "--purpose", "v0", "--paid"))
            check(code != 0 and "input image" in out and not cl.calls and not _rows(B),
                  f"edit: a source with {label} {size} is refused before any request ({out.strip()[-90:]!r})")


def _edit_gate(check) -> None:
    from gen import colossus as C
    real = _budget()
    with sandbox(real) as (B, tmp, cl):
        src = _src(tmp)
        code, out = _main(C, _edit_argv("outpaint", src, "--purpose", "v0"))
        check(code == 0 and "dry run" in out and '"left": 512' in out and not cl.calls and not _rows(B)
              and not [p for p in tmp.glob("*_raw.png") if p != src],
              "edit: without --paid an uncached request is only printed (no call, no row, no file)")
    defaults = (("outpaint", "f3_gen"), ("search_replace", "f4_variant"), ("structure", "v0"))
    for kind, purpose in defaults:
        with sandbox(real) as (B, tmp, cl):
            _main(C, _edit_argv(kind, _src(tmp), "--paid"))
            rows = _rows(B)
            check([r["event"] for r in rows] == ["request", "result"] and rows[0]["purpose"] == purpose
                  and rows[0]["model"] == kind and rows[0]["pass"] == "C" and rows[1]["ok"] is True
                  and rows[1]["served"] == cl.calls[-1],
                  f"{kind}: the default purpose is {purpose}; one request row (model {kind}, pass C) before the call "
                  f"and one result row naming the serving id ({rows})")
    wrong = (("outpaint", "f4_variant"), ("outpaint", "f3_nobg"), ("search_replace", "f3_gen"),
             ("structure", "f3_gen"), ("structure", "f4_variant"))
    for kind, purpose in wrong:
        with sandbox(real) as (B, tmp, cl):
            code, out = _main(C, _edit_argv(kind, _src(tmp), "--purpose", purpose, "--paid"))
            check(code is None and "refused" in out and purpose in out and not cl.calls and not _rows(B),
                  f"{kind}: purpose {purpose} is not one of its 5.6 purposes, refused before invoke "
                  f"({out.strip()[-90:]!r})")
    with sandbox(real) as (B, tmp, cl):
        r = _main(C, _edit_argv("outpaint", _src(tmp), "--purpose", "reserve:F3 first, orchestrator note", "--paid"))
        check(r[0] == 0 and _rows(B)[0]["purpose"] == "reserve:F3 first, orchestrator note",
              "outpaint: reserve:<reason> passes through to the ledger row")
    with sandbox(real) as (B, tmp, cl):
        code, out = _main(C, _edit_argv("outpaint", _src(tmp), "--purpose", "reserve", "--paid"))
        check(code is None and "reserve" in out and not cl.calls, "outpaint: a bare reserve is refused by invoke")
    with sandbox(real) as (B, tmp, cl):
        _seed_ledger(B, _fake_rows("v0", PURPOSE_CAPS["v0"]))
        code, out = _main(C, _edit_argv("structure", _src(tmp), "--purpose", "v0", "--paid"))
        check(code is None and "cap" in out and not cl.calls and len(_rows(B)) == PURPOSE_CAPS["v0"],
              f"structure: refused at the v0 cap ({PURPOSE_CAPS['v0']} rows), nothing sent or logged "
              f"({out.strip()[-80:]!r})")
    with sandbox(real) as (B, tmp, cl):
        _seed_ledger(B, _fake_rows("f3_gen", PURPOSE_CAPS["f3_gen"]))
        code, out = _main(C, _edit_argv("outpaint", _src(tmp), "--paid"))
        check(code is None and "f3_gen" in out and not cl.calls, "outpaint: refused at the f3_gen cap (gen + outpaint "
                                                                 "share it, 5.6)")
    with sandbox(real, linked=True) as (B, tmp, cl):
        code, out = _main(C, _edit_argv("search_replace", _src(tmp), "--purpose", "v0", "--paid"))
        check(code is None and "worktree" in out and not cl.calls and not _rows(B),
              "search_replace: refused from a linked worktree, nothing sent or logged")
    with sandbox(real, client=_FakeClient(fail=True)) as (B, tmp, cl):
        with contextlib.suppress(RuntimeError):
            _main(C, _edit_argv("outpaint", _src(tmp), "--purpose", "v0", "--paid"))
        rows = _rows(B)
        check([r["event"] for r in rows] == ["request", "result"] and rows[1]["ok"] is False,
              f"outpaint: a failed call is logged and counts as spent ({rows})")


def _edit_cache(check) -> None:
    from gen import colossus as C
    with sandbox(_budget()) as (B, tmp, cl):
        src = _src(tmp)
        _main(C, _edit_argv("outpaint", src, "--purpose", "v0", "--paid"))
        n_rows, n_calls, key = len(_rows(B)), len(cl.calls), _rows(B)[0]["key"]
        code, out = _main(C, _edit_argv("outpaint", src, "--purpose", "v0"))
        check(code == 0 and len(_rows(B)) == n_rows and len(cl.calls) == n_calls and '"cached": true' in out
              and (B.CACHE / f"{key}.png").exists(),
              "outpaint: the same request again is a cache hit by request hash (free without --paid, no row, no call)")
        check(key == B.cache_key("outpaint", cl.bodies[0]), "outpaint: the ledger key is the hash of the sent body")
        _main(C, _edit_argv("outpaint", src)[:-1] + ["12", "--purpose", "v0", "--paid"])
        _main(C, _edit_argv("outpaint", src, "--down", "64", "--purpose", "v0", "--paid"))
        keys = [r["key"] for r in _rows(B) if r["event"] == "request"]
        check(len(cl.calls) == n_calls + 2 and len(set(keys)) == 3,
              f"outpaint: another seed or another direction is a new request (new key, new row) ({keys})")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_colossus(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

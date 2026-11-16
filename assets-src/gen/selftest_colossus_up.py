"""Pass C upscale self-tests (docs/CHAOS_FORMS_PLAN.md 5.6 `rim_upscale`, 7.2; FW-C), run from selftest_colossus.py:
`colossus.py upscale` (Stability conservative / creative / fast upscale on Bedrock) on a mocked client (0 paid calls:
the body shape, the local input and range checks, the purpose and its cap of 2, the BR ledger rows, the cache) and
tools/stage_rim.py with a higher-resolution source (the horizon row scaled from 485 at 768 px, a Lanczos downsample,
the same staged geometry).

  python3 -I assets-src/gen/selftest_colossus_up.py
"""
from __future__ import annotations

import base64
import io
import json
import sys
import tempfile
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from gen.selftest_colossus import (_budget, _fake_rows, _main, _rows, _seed_ledger, sandbox,  # noqa: E402
                                   sections)

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parent / "tools"
RIM_SRC = HERE.parent / "backgrounds" / "rim-src.png"
# literals (AWS Bedrock Stability Image Services, us-west-2, read-only listing confirmed by the orchestrator)
UPSCALE_IDS = {"conservative": "us.stability.stable-conservative-upscale-v1:0",
               "creative": "us.stability.stable-creative-upscale-v1:0",
               "fast": "us.stability.stable-fast-upscale-v1:0"}
RIM_UPSCALE_CAP = 2


def run_up(check) -> None:
    sections(check, _up_models, _up_bodies, _up_refusals, _up_gate, _up_cache, _stage_hires)


def _src(tmp: Path, size=(1344, 768), mode="RGB") -> Path:
    p = tmp / "rim-src.png"
    Image.new(mode, size, (60, 40, 70) if mode == "RGB" else (60, 40, 70, 255)).save(p)
    return p


def _argv(src: Path, model: str = "conservative", *extra: str) -> list[str]:
    base = ["upscale", str(src), "--model", model]
    if model != "fast":
        base += ["--prompt", "pixel art nebula over a crystal floor", "--seed", "21"]
    return base + list(extra)


def _up_models(check) -> None:
    from gen import bedrock as B
    got = {k: B.MODELS.get(f"upscale_{k}") for k in UPSCALE_IDS}
    check(got == UPSCALE_IDS, f"bedrock.MODELS: upscale_conservative / _creative / _fast are the us. profile ids ({got})")
    real = _budget()["bedrock"]["per_purpose_caps"]
    check(real.get("rim_upscale") == RIM_UPSCALE_CAP, f"budget.json: purpose rim_upscale has a cap of {RIM_UPSCALE_CAP} "
                                                      f"({real.get('rim_upscale')})")


def _up_bodies(check) -> None:
    from gen import colossus as C
    want = {"conservative": ({"image", "prompt", "creativity", "seed", "output_format"}, 0.35),
            "creative": ({"image", "prompt", "creativity", "seed", "output_format"}, 0.3),
            "fast": ({"image", "output_format"}, None)}
    for model, (keys, crea) in want.items():
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp)
            code, out = _main(C, _argv(src, model, "--paid"))
            body = cl.bodies[0] if cl.bodies else {}
            img = Image.open(io.BytesIO(base64.b64decode(body["image"]))) if body.get("image") else None
            vals_ok = model == "fast" or (body.get("prompt") == "pixel art nebula over a crystal floor"
                                          and body.get("seed") == 21 and body.get("creativity") == crea)
            check(code == 0 and set(body) == keys and vals_ok and body.get("output_format") == "png"
                  and img is not None and img.format == "PNG" and img.size == (1344, 768) and img.mode == "RGB"
                  and cl.calls[:1] == [UPSCALE_IDS[model]],
                  f"upscale --model {model}: body keys {sorted(keys)}, default creativity {crea}, the source as base64 "
                  f"RGB PNG, output_format png, sent to {UPSCALE_IDS[model]} ({code}, {sorted(body)}, {cl.calls})")
            dst = [p for p in tmp.glob("*.png") if p != src]
            side = json.loads(dst[0].with_suffix(".json").read_text()) if len(dst) == 1 else {}
            check(len(dst) == 1 and side.get("model") == f"upscale_{model}" and side.get("purpose") == "rim_upscale"
                  and side.get("source") == str(src) and len(side.get("cache_keys", [])) == 1,
                  f"upscale --model {model}: one output next to the source with a sidecar (model, purpose, source, "
                  f"cache key) ({[p.name for p in dst]}, {side})")
    with sandbox(_budget()) as (B, tmp, cl):
        src, out = _src(tmp, mode="RGBA"), tmp / "sub" / "up.png"
        _main(C, _argv(src, "conservative", "--creativity", "0.25", "--negative", "blur, text", "--out", str(out),
                       "--paid"))
        b = cl.bodies[0] if cl.bodies else {}
        img = Image.open(io.BytesIO(base64.b64decode(b["image"]))) if b.get("image") else None
        check(b.get("creativity") == 0.25 and b.get("negative_prompt") == "blur, text" and img is not None
              and img.mode == "RGB" and out.exists(),
              f"upscale: --creativity / --negative reach the body, an RGBA source is sent as RGB, --out is honoured "
              f"({ {k: v for k, v in b.items() if k != 'image'} }, {out.exists()})")


def _up_refusals(check) -> None:
    from gen import colossus as C
    bad = (("conservative creativity 0.19 (< 0.2)", _argv(Path("{src}"), "conservative", "--creativity", "0.19"),
            "creativity"),
           ("conservative creativity 0.51", _argv(Path("{src}"), "conservative", "--creativity", "0.51"), "creativity"),
           ("creative creativity 0.6", _argv(Path("{src}"), "creative", "--creativity", "0.6"), "creativity"),
           ("seed 0 (random, not repeatable)", _argv(Path("{src}"))[:-1] + ["0"], "seed"),
           ("conservative without --seed", ["upscale", "{src}", "--model", "conservative", "--prompt", "x"], "seed"),
           ("conservative without --prompt", ["upscale", "{src}", "--model", "conservative", "--seed", "3"], "prompt"),
           ("an empty prompt", ["upscale", "{src}", "--model", "conservative", "--prompt", " ", "--seed", "3"],
            "prompt"),
           ("fast with a prompt (ignored by the model)", ["upscale", "{src}", "--model", "fast", "--prompt", "x"],
            "fast"),
           ("an unknown model", ["upscale", "{src}", "--model", "ultra4k", "--prompt", "x", "--seed", "3"], "model"))
    for label, argv, word in bad:
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp)
            code, out = _main(C, [a.replace("{src}", str(src)) for a in argv] + ["--paid"])
            check(code != 0 and word in out and not cl.calls and not _rows(B),
                  f"upscale: {label} is refused before any request, nothing sent or logged ({out.strip()[-90:]!r})")
    sizes = (("conservative", "a side under 64 px", (63, 100)), ("conservative", "an aspect over 2.5:1", (260, 100)),
             ("conservative", "over 9,437,184 px", (4000, 2400)),
             ("creative", "over 1,048,576 px", (1400, 768)), ("creative", "a side under 64 px", (64, 63)),
             ("fast", "a side over 1,536 px", (1600, 640)), ("fast", "over 1,048,576 px", (1400, 768)),
             ("fast", "a side under 32 px", (31, 64)))
    for model, label, size in sizes:
        with sandbox(_budget()) as (B, tmp, cl):
            src = _src(tmp, size=size)
            code, out = _main(C, _argv(src, model, "--paid"))
            check(code != 0 and "input image" in out and not cl.calls and not _rows(B),
                  f"upscale --model {model}: a source with {label} {size} is refused before any request "
                  f"({out.strip()[-90:]!r})")
    for model in UPSCALE_IDS:                       # the accepted rim source fits every model's input limits
        with sandbox(_budget()) as (B, tmp, cl):
            code, _ = _main(C, _argv(_src(tmp), model))
            check(code == 0 and not cl.calls, f"upscale --model {model}: a 1344x768 source passes the local checks")


def _up_gate(check) -> None:
    from gen import colossus as C
    real = _budget()
    with sandbox(real) as (B, tmp, cl):
        src = _src(tmp)
        code, out = _main(C, _argv(src))
        check(code == 0 and "dry run" in out and '"creativity": 0.35' in out and not cl.calls and not _rows(B)
              and [p for p in tmp.glob("*.png")] == [src],
              "upscale: without --paid an uncached request is only printed (no call, no row, no file)")
    with sandbox(real) as (B, tmp, cl):
        _main(C, _argv(_src(tmp), "conservative", "--paid"))
        rows = _rows(B)
        check([r["event"] for r in rows] == ["request", "result"] and rows[0]["purpose"] == "rim_upscale"
              and rows[0]["model"] == "upscale_conservative" and rows[0]["pass"] == "C" and rows[0]["seed"] == 21
              and rows[0]["key"] == B.cache_key("upscale_conservative", cl.bodies[0])
              and rows[1]["ok"] is True and rows[1]["served"] == UPSCALE_IDS["conservative"],
              f"upscale: default purpose rim_upscale; one request row (model upscale_conservative, pass C, seed, the "
              f"body's key) before the call and one result row naming the serving id ({rows})")
    for purpose in ("v0", "f3_gen", "f4_variant"):
        with sandbox(real) as (B, tmp, cl):
            code, out = _main(C, _argv(_src(tmp), "conservative", "--purpose", purpose, "--paid"))
            check(code is None and "refused" in out and purpose in out and not cl.calls and not _rows(B),
                  f"upscale: purpose {purpose} is not an upscale purpose, refused before invoke ({out.strip()[-80:]!r})")
    with sandbox(real) as (B, tmp, cl):
        code, _ = _main(C, _argv(_src(tmp), "conservative", "--purpose", "reserve:rim retry, orchestrator", "--paid"))
        check(code == 0 and _rows(B)[0]["purpose"] == "reserve:rim retry, orchestrator",
              "upscale: reserve:<reason> passes through to the ledger row")
    with sandbox(real) as (B, tmp, cl):
        _seed_ledger(B, _fake_rows("rim_upscale", RIM_UPSCALE_CAP))
        code, out = _main(C, _argv(_src(tmp), "conservative", "--paid"))
        check(code is None and "cap" in out and "rim_upscale" in out and not cl.calls
              and len(_rows(B)) == RIM_UPSCALE_CAP,
              f"upscale: refused at the rim_upscale cap ({RIM_UPSCALE_CAP} rows), nothing sent or logged "
              f"({out.strip()[-80:]!r})")
        _seed_ledger(B, _fake_rows("rim_upscale", RIM_UPSCALE_CAP - 1))
        code, _ = _main(C, _argv(_src(tmp), "conservative", "--paid"))
        check(code == 0 and len(cl.calls) == 1, "upscale: one row under the rim_upscale cap is allowed")
    with sandbox(real, linked=True) as (B, tmp, cl):
        code, out = _main(C, _argv(_src(tmp), "conservative", "--paid"))
        check(code is None and "worktree" in out and not cl.calls and not _rows(B),
              "upscale: refused from a linked worktree, nothing sent or logged")
    from gen import colossus as C2
    full = [r for p, c in real["bedrock"]["per_purpose_caps"].items() for r in _fake_rows(p, c)]
    over = C2.budget_breaches(real, full + _fake_rows("rim_upscale", 1), real["bedrock"]["gemini_before"])
    check(C2.budget_breaches(real, full, real["bedrock"]["gemini_before"]) == []
          and any("rim_upscale" in x for x in over),
          f"budget --check: a full pass C including rim_upscale passes; a 3rd rim_upscale call breaches ({over})")


def _up_cache(check) -> None:
    from gen import colossus as C
    with sandbox(_budget()) as (B, tmp, cl):
        src = _src(tmp)
        _main(C, _argv(src, "conservative", "--paid"))
        n_rows, n_calls, key = len(_rows(B)), len(cl.calls), _rows(B)[0]["key"]
        code, out = _main(C, _argv(src, "conservative"))
        check(code == 0 and len(_rows(B)) == n_rows and len(cl.calls) == n_calls and '"cached": true' in out
              and (B.CACHE / f"{key}.png").exists(),
              "upscale: the same request again is a cache hit (free without --paid, no row, no call)")
        _main(C, _argv(src)[:-1] + ["22", "--paid"])                       # the 2nd and last rim_upscale call
        _main(C, _argv(src, "conservative", "--creativity", "0.3", "--purpose", "reserve:selftest", "--paid"))
        keys = [r["key"] for r in _rows(B) if r["event"] == "request"]
        check(len(cl.calls) == n_calls + 2 and len(set(keys)) == 3,
              f"upscale: another seed or another creativity is a new request (new key, new row) ({keys})")


# ───────────── stage_rim with a higher-resolution source (7.2): same geometry, Lanczos downsample ─────────────

def _pattern(h: int = 768, w: int = 1344) -> np.ndarray:
    """48 px colour blocks; sky above source row 485 (at 768 px), floor below: a low-frequency fixture."""
    yy, xx = np.mgrid[0:h, 0:w]
    a = np.stack([(xx // 48 * 37) % 200 + 20, (yy // 48 * 53) % 200 + 20, ((xx // 48 + yy // 48) * 29) % 200 + 20], -1)
    a[485:, :, 2] = 250
    return a.astype(np.uint8)


def _stage_hires(check) -> None:
    sys.path.insert(0, str(TOOLS))
    import stage_rim as SR
    check(SR.RIM == ("rim-src.png", 485, 1.05, "center", 370) and getattr(SR, "RIM_SRC_H", None) == 768,
          f"stage_rim: the accepted entry {SR.RIM}; the horizon row is recorded at RIM_SRC_H = 768 px source height")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        base = _pattern()
        Image.fromarray(base).save(tmp / "x1.png")
        Image.fromarray(base).resize((1344 * 4, 768 * 4), Image.Resampling.NEAREST).save(tmp / "x4.png")
        s1, w1, i1 = SR.stage(tmp / "x1.png", *SR.RIM[1:])
        s4, w4, i4 = SR.stage(tmp / "x4.png", *SR.RIM[1:])
        geo = ("top", "bottom", "left", "horizon_y", "zoom")
        check(s4.size == (1920, 1080) and w4.size == (1944, 1080)
              and i4["src_size"] == (5376, 3072) and i4["scale"] == 0.375 and i4["horizon_src"] == 1940
              and all(i4[k] == i1[k] for k in geo) and (i1["top"], i1["bottom"]) == (-358, 794),
              f"stage_rim: a 4x source (5376x3072) stages at scale 0.375 with horizon row 1940 (485 x 4) and the same "
              f"top / bottom / left / horizon / zoom as the 1x source ({i4})")
        a1, a4 = np.asarray(s1).astype(int), np.asarray(s4).astype(int)
        diff = float(np.abs(a1 - a4).mean())
        b1, b4 = a1[:, :, 2], a4[:, :, 2]
        hz1 = int(np.argmax((b1[:, 960] == 250))), int(np.argmax((b4[:, 960] >= 245)))
        check(diff < 2.0 and abs(hz1[0] - hz1[1]) <= 1 and 369 <= hz1[1] <= 371,
              f"stage_rim: the 4x stage matches the 1x stage (mean |diff| {diff:.2f} < 2) and the floor starts at screen "
              f"y {hz1[1]} (1x {hz1[0]}; the horizon at 370)")
        mid = a4[300:340, 1000:1048].reshape(-1, 3)        # a block edge: Lanczos leaves intermediate values
        check(len(np.unique(mid, axis=0)) > len(np.unique(a1[300:340, 1000:1048].reshape(-1, 3), axis=0)),
              "stage_rim: a source larger than the stage is downsampled with Lanczos (filtered edges, not nearest)")
        check((np.asarray(w4)[:, SR.BLEED:-SR.BLEED] == np.asarray(s4)).all() and SR.coverage(s4) == 1.0,
              "stage_rim: the 4x bleed-wide stage equals the screen in its middle 1920 columns; no uncovered row")
        SR.write(s4, w4, tmp)
        fa = np.asarray(Image.open(tmp / "rim_floor.webp").convert("RGBA"))
        ra = np.asarray(Image.open(tmp / "rim.webp").convert("RGB"))
        check((fa[:370, :, 3] == 0).all() and (fa[370:, SR.BLEED:-SR.BLEED, :3] == ra[370:]).all(),
              "stage_rim: the 4x rim_floor.webp cuts at y 370 and is pixel-exact with rim.webp below it")
        if RIM_SRC.exists():
            real = Image.open(RIM_SRC).convert("RGB")
            real.resize((real.width * 2, real.height * 2), Image.Resampling.LANCZOS).save(tmp / "rim-src.png")
            s2, w2, i2 = SR.stage(tmp / "rim-src.png", *SR.RIM[1:])
            SR.write(s2, w2, tmp)
            ok, line = SR.check(tmp / "rim.webp")
            check(ok and i2["horizon_src"] == 970 and (i2["top"], i2["bottom"]) == (-358, 794),
                  f"stage_rim: the real rim source at 2x (offline Lanczos, a stand-in for the upscale) stages with the "
                  f"same geometry and passes --check rim ({line.strip()[17:]})")
            r = _cli(SR, tmp)
            check(bool(r), f"stage_rim: `rim --file <png> --out DIR` stages that file into DIR ({r})")


def _cli(SR, tmp: Path) -> str:
    import contextlib
    out_dir, buf = tmp / "cli", io.StringIO()
    with contextlib.redirect_stdout(buf):
        SR.main(["stage_backgrounds.py", "rim", "--file", str(tmp / "rim-src.png"), "--out", str(out_dir)])
    ok = (out_dir / "rim.webp").exists() and "2688" in buf.getvalue()
    return buf.getvalue().strip()[:120] if ok else ""


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_up(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

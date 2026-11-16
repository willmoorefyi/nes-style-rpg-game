"""Pass C inpaint self-tests (docs/CHAOS_FORMS_PLAN.md 5.6 `f4_variant`; FW-C, F4 "Core Laid Bare"), run from
selftest_colossus.py on a mocked client (0 paid calls): `colossus.py inpaint` (Stability inpaint on Bedrock: body
shape, the local image / mask checks, purposes and the f4_variant cap, BR ledger rows, the cache) and the offline
`colossus.py inpaint_merge` (the result is composited onto the source only inside the mask; every pixel outside it,
and the source's alpha everywhere, stays byte-identical; 0 calls).

  python3 -I assets-src/gen/selftest_colossus_ip.py
"""
from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from gen.selftest_colossus import (PURPOSE_CAPS, _budget, _fake_rows, _main, _rows, _seed_ledger,  # noqa: E402
                                   sandbox, sections)

INPAINT_ID = "us.stability.stable-image-inpaint-v1:0"     # AWS Bedrock Stability Image Services (Edit: Inpaint)
BOX = (40, 30, 90, 70)                                     # the fixture mask's white rectangle x0 y0 x1 y1


def run_ip(check) -> None:
    sections(check, _ip_model, _ip_bodies, _ip_refusals, _ip_gate, _ip_cache, _ip_merge)


def _noise(size, seed: int, alpha: bool) -> Image.Image:
    rng = np.random.default_rng(seed)
    a = rng.integers(0, 256, (size[1], size[0], 4 if alpha else 3), dtype=np.uint8)
    if alpha:
        a[..., 3] = np.where(rng.random((size[1], size[0])) < 0.3, 0, 255)
    return Image.fromarray(a, "RGBA" if alpha else "RGB")


def _fixture(tmp: Path, size=(128, 96), mask_size=None, box=BOX, alpha=True) -> tuple[Path, Path]:
    src, mask = tmp / "f3_master.png", tmp / "core_mask.png"
    _noise(size, 1, alpha).save(src)
    src.with_suffix(".json").write_text(json.dumps({"seed": 5, "model": "core", "cache_keys": ["k0"]}))
    m = np.zeros(((mask_size or size)[1], (mask_size or size)[0]), np.uint8)
    if box:
        m[box[1]:box[3], box[0]:box[2]] = 255
    Image.fromarray(m, "L").save(mask)
    return src, mask


def _argv(src: Path, mask: Path | None, *extra: str) -> list[str]:
    base = ["inpaint", str(src)] + (["--mask", str(mask)] if mask else [])
    return base + ["--prompt", "a torn-open chest, molten white-hot core", "--seed", "31"] + list(extra)


def _ip_model(check) -> None:
    from gen import bedrock as B
    check(B.MODELS.get("inpaint") == INPAINT_ID, f"bedrock.MODELS: inpaint = {INPAINT_ID} ({B.MODELS.get('inpaint')})")


def _ip_bodies(check) -> None:
    from gen import colossus as C
    with sandbox(_budget()) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        code, out = _main(C, _argv(src, mask, "--paid"))
        b = cl.bodies[0] if cl.bodies else {}
        img = Image.open(io.BytesIO(base64.b64decode(b["image"]))) if b.get("image") else None
        msk = Image.open(io.BytesIO(base64.b64decode(b["mask"]))) if b.get("mask") else None
        check(code == 0 and set(b) == {"image", "mask", "prompt", "grow_mask", "seed", "output_format"}
              and b.get("prompt") == "a torn-open chest, molten white-hot core" and b.get("grow_mask") == 5
              and b.get("seed") == 31 and b.get("output_format") == "png" and cl.calls[:1] == [INPAINT_ID]
              and img is not None and img.format == "PNG" and img.mode == "RGB" and img.size == (128, 96)
              and msk is not None and msk.format == "PNG" and msk.mode == "L"
              and (np.asarray(msk) == np.asarray(Image.open(mask))).all(),
              f"inpaint: body {{image, mask, prompt, grow_mask 5, seed, output_format png}}, the source as RGB PNG and "
              f"the mask as an L PNG, sent to {INPAINT_ID} ({code}, {sorted(b)}, {cl.calls})")
        dst = [p for p in tmp.glob("*_raw.png")]
        side = json.loads(dst[0].with_suffix(".json").read_text()) if len(dst) == 1 else {}
        check(len(dst) == 1 and side.get("model") == "inpaint" and side.get("purpose") == "f4_variant"
              and side.get("source") == str(src) and side.get("mask") == str(mask)
              and side.get("cache_keys", [None])[0] == "k0" and len(side.get("cache_keys", [])) == 2,
              f"inpaint: one *_raw.png next to the source with a sidecar (model, purpose, source, mask, cache keys) "
              f"({[p.name for p in dst]}, {side})")
    with sandbox(_budget()) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        _main(C, _argv(src, mask, "--negative", "a face, text", "--grow-mask", "0", "--paid"))
        b = cl.bodies[0] if cl.bodies else {}
        check(b.get("negative_prompt") == "a face, text" and b.get("grow_mask") == 0,
              f"inpaint: --negative and --grow-mask 0 reach the body ({ {k: v for k, v in b.items() if k not in ('image', 'mask')} })")


def _ip_refusals(check) -> None:
    from gen import colossus as C
    bad = (("grow_mask 21", ("--grow-mask", "21"), "grow_mask"), ("grow_mask -1", ("--grow-mask", "-1"), "grow_mask"),
           ("seed 0 (random, not repeatable)", ("--seed", "0"), "seed"))
    for label, extra, word in bad:
        with sandbox(_budget()) as (B, tmp, cl):
            src, mask = _fixture(tmp)
            code, out = _main(C, _argv(src, mask, *extra, "--paid"))
            check(code != 0 and word in out and not cl.calls and not _rows(B),
                  f"inpaint: {label} is refused before any request ({out.strip()[-80:]!r})")
    for label, argv_fn, word in (
            ("no --mask", lambda s, m: _argv(s, None), "mask"),
            ("no --seed", lambda s, m: ["inpaint", str(s), "--mask", str(m), "--prompt", "x"], "seed"),
            ("an empty prompt", lambda s, m: ["inpaint", str(s), "--mask", str(m), "--prompt", " ", "--seed", "3"],
             "prompt")):
        with sandbox(_budget()) as (B, tmp, cl):
            src, mask = _fixture(tmp)
            code, out = _main(C, argv_fn(src, mask) + ["--paid"])
            check(code != 0 and word in out and not cl.calls and not _rows(B),
                  f"inpaint: {label} is refused before any request ({out.strip()[-80:]!r})")
    for label, kw, word in (("a mask of another size", {"mask_size": (64, 48)}, "mask"),
                            ("an all-black mask (nothing to inpaint)", {"box": None}, "mask"),
                            ("a source side under 64 px", {"size": (63, 100)}, "input image"),
                            ("a source aspect over 2.5:1", {"size": (260, 100)}, "input image"),
                            ("a source over 9,437,184 px", {"size": (4000, 2400), "alpha": False}, "input image")):
        with sandbox(_budget()) as (B, tmp, cl):
            src, mask = _fixture(tmp, **kw)
            code, out = _main(C, _argv(src, mask, "--paid"))
            check(code != 0 and word in out and not cl.calls and not _rows(B),
                  f"inpaint: {label} is refused before any request ({out.strip()[-80:]!r})")


def _ip_gate(check) -> None:
    from gen import colossus as C
    real = _budget()
    with sandbox(real) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        code, out = _main(C, _argv(src, mask))
        check(code == 0 and "dry run" in out and '"grow_mask": 5' in out and not cl.calls and not _rows(B)
              and not list(tmp.glob("*_raw.png")),
              "inpaint: without --paid an uncached request is only printed (no call, no row, no file)")
    with sandbox(real) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        _main(C, _argv(src, mask, "--paid"))
        rows = _rows(B)
        check([r["event"] for r in rows] == ["request", "result"] and rows[0]["purpose"] == "f4_variant"
              and rows[0]["model"] == "inpaint" and rows[0]["pass"] == "C" and rows[0]["seed"] == 31
              and rows[0]["key"] == B.cache_key("inpaint", cl.bodies[0]) and rows[1]["ok"] is True
              and rows[1]["served"] == INPAINT_ID,
              f"inpaint: default purpose f4_variant; one request row (model inpaint, pass C) before the call and one "
              f"result row naming the serving id ({rows})")
    for purpose, allowed in (("v0", True), ("reserve:F4 core, orchestrator", True), ("f3_gen", False),
                             ("rim_upscale", False), ("reserve", False)):
        with sandbox(real) as (B, tmp, cl):
            src, mask = _fixture(tmp)
            code, out = _main(C, _argv(src, mask, "--purpose", purpose, "--paid"))
            ok = (code == 0 and _rows(B)[0]["purpose"] == purpose) if allowed else \
                (code is None and "refused" in out and not cl.calls and not _rows(B))
            check(ok, f"inpaint: purpose {purpose!r} is {'allowed' if allowed else 'refused before any request'} "
                      f"({out.strip()[-70:]!r})")
    with sandbox(real) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        _seed_ledger(B, _fake_rows("f4_variant", PURPOSE_CAPS["f4_variant"]))
        code, out = _main(C, _argv(src, mask, "--paid"))
        check(code is None and "cap" in out and "f4_variant" in out and not cl.calls,
              f"inpaint: refused at the f4_variant cap ({PURPOSE_CAPS['f4_variant']}; shared with search_replace) "
              f"({out.strip()[-70:]!r})")
    with sandbox(real, linked=True) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        code, out = _main(C, _argv(src, mask, "--paid"))
        check(code is None and "worktree" in out and not cl.calls and not _rows(B),
              "inpaint: refused from a linked worktree, nothing sent or logged")


def _ip_cache(check) -> None:
    from gen import colossus as C
    with sandbox(_budget()) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        _main(C, _argv(src, mask, "--paid"))
        n_rows, n_calls = len(_rows(B)), len(cl.calls)
        code, out = _main(C, _argv(src, mask))
        check(code == 0 and len(_rows(B)) == n_rows and len(cl.calls) == n_calls and '"cached": true' in out,
              "inpaint: the same request again is a cache hit (free without --paid, no row, no call)")
        _fixture(tmp, box=(10, 10, 50, 40))                   # another mask, same source and prompt
        _main(C, _argv(src, mask, "--paid"))
        keys = [r["key"] for r in _rows(B) if r["event"] == "request"]
        check(len(cl.calls) == n_calls + 1 and len(set(keys)) == 2, f"inpaint: another mask is a new request ({keys})")


def _ip_merge(check) -> None:
    from gen import colossus as C
    for alpha in (True, False):
        with sandbox(_budget()) as (B, tmp, cl):
            src, mask = _fixture(tmp, alpha=alpha)
            raw = tmp / "f3_master_ip_31_raw.png"
            _noise((128, 96), 2, False).convert("RGBA").save(raw)
            raw.with_suffix(".json").write_text(json.dumps({"cache_keys": ["k0", "kip"], "model": "inpaint"}))
            code, out = _main(C, ["inpaint_merge", str(src), str(raw), "--mask", str(mask)])
            dst = tmp / "f3_master_ip_31_merged.png"
            s = np.asarray(Image.open(src))
            m = np.asarray(Image.open(dst)) if dst.exists() else np.zeros_like(s)
            r = np.asarray(Image.open(raw).convert("RGB"))
            inside = np.asarray(Image.open(mask)) > 0
            mode_ok = dst.exists() and Image.open(dst).mode == Image.open(src).mode
            check(code == 0 and not cl.calls and mode_ok and (m[~inside] == s[~inside]).all()
                  and (m[inside][:, :3] == r[inside]).all() and (m[..., 3] == s[..., 3]).all() if alpha else
                  code == 0 and not cl.calls and mode_ok and (m[~inside] == s[~inside]).all()
                  and (m[inside] == r[inside]).all(),
                  f"inpaint_merge ({'RGBA' if alpha else 'RGB'} source): outside the mask every pixel is the source's "
                  f"(byte-identical), inside it the result's RGB" + (", the source's alpha everywhere" if alpha else "")
                  + f"; 0 calls ({code}, {out.strip()[-60:]!r})")
            side = json.loads(dst.with_suffix(".json").read_text()) if dst.exists() else {}
            check(side.get("cache_keys") == ["k0", "kip"] and side.get("mask") == str(mask)
                  and side.get("merged_px") == int(inside.sum()),
                  f"inpaint_merge: a sidecar with the raw's cache keys, the mask and the merged pixel count ({side})")
    with sandbox(_budget()) as (B, tmp, cl):
        src, mask = _fixture(tmp)
        raw = tmp / "small_raw.png"
        _noise((64, 48), 3, False).save(raw)
        code, out = _main(C, ["inpaint_merge", str(src), str(raw), "--mask", str(mask), "--out", str(tmp / "m.png")])
        m, s = np.asarray(Image.open(tmp / "m.png")), np.asarray(Image.open(src))
        inside = np.asarray(Image.open(mask)) > 0
        side = json.loads((tmp / "m.json").read_text())
        check(code == 0 and (m[~inside] == s[~inside]).all() and side.get("resized_from") == [64, 48],
              f"inpaint_merge: a result of another size is resized (Lanczos) to the source first, recorded in the "
              f"sidecar; outside the mask still byte-identical ({side.get('resized_from')})")
    with sandbox(_budget()) as (B, tmp, cl):
        src, mask = _fixture(tmp, mask_size=(64, 48))
        raw = tmp / "r_raw.png"
        _noise((128, 96), 2, False).save(raw)
        code, out = _main(C, ["inpaint_merge", str(src), str(raw), "--mask", str(mask)])
        check(code is None and "mask" in out, f"inpaint_merge: a mask of another size is refused ({out.strip()[-70:]!r})")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_ip(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

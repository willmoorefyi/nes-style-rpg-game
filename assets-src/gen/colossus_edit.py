"""colossus.py's edit subcommands (docs/CHAOS_FORMS_PLAN.md 5.2 V0-e / V0-d, 5.3a S-B, 5.6; FW-C): outpaint,
search_replace and structure on an existing render. Each is one call through bedrock.invoke (paid, purpose caps, BR
ledger, main checkout only; cached by request hash), with the request schemas of the Stability Image Services on
Bedrock (image as base64 PNG, output_format png):

  outpaint        {image, left, right, up, down, prompt, creativity, seed, output_format}   left..down 0-2000, >= 1 > 0
  search_replace  {image, prompt, search_prompt, [negative_prompt], grow_mask, seed, output_format}   grow_mask 0-20
  structure       {image, prompt, control_strength, [negative_prompt], seed, output_format}   control_strength 0-1

Inputs are checked locally first (every side >= 64 px, <= 9,437,184 px, aspect within 1:2.5..2.5:1; seed >= 1, since 0
means random and could not be repeated), so a malformed request never spends a call. Each subcommand only takes the
5.6 purposes it is planned for (outpaint: v0 / f3_gen / f2_gen, search_replace: v0 / f4_variant, structure: v0; plus
reserve:<reason>); the cap check stays in invoke. The output is `<source stem>_<tag>_raw.png` next to the source, with
a sidecar holding the source's cache keys plus this one.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

MAX_PX, MIN_SIDE, MAX_ASPECT, MAX_SEED = 9_437_184, 64, 2.5, 4_294_967_294
PURPOSES = {"outpaint": ("v0", "f3_gen", "f2_gen"), "search_replace": ("v0", "f4_variant"), "structure": ("v0",)}


def _refuse(msg: str):
    raise SystemExit(f"refused: {msg}")


def default_purpose(kind: str, form: dict) -> str:
    return {"outpaint": form["gen"], "search_replace": "f4_variant", "structure": "v0"}[kind]


def check_purpose(kind: str, purpose: str) -> None:
    from gen import bedrock as B
    if B.purpose_key(purpose) not in (*PURPOSES[kind], "reserve"):
        _refuse(f"purpose {purpose!r} is not one of {kind}'s 5.6 purposes ({', '.join(PURPOSES[kind])}, "
                "reserve:<reason>)")


def check_input(img: Image.Image) -> None:
    w, h = img.size
    if min(w, h) < MIN_SIDE or w * h > MAX_PX or max(w / h, h / w) > MAX_ASPECT:
        _refuse(f"input image {w}x{h}: every side >= {MIN_SIDE} px, <= {MAX_PX:,} px and an aspect within "
                f"1:{MAX_ASPECT}..{MAX_ASPECT}:1")


def _range(name: str, v: float, lo: float, hi: float) -> None:
    if not lo <= v <= hi:
        _refuse(f"{name} {v} is outside {lo}..{hi}")


def build_body(kind: str, a, image_b64: str) -> tuple[dict, str]:
    """(request body, output-name tag) for one edit; refuses a malformed request."""
    _range("seed", a.seed, 1, MAX_SEED)
    body: dict = {"image": image_b64}
    if kind == "outpaint":
        dirs = {d: getattr(a, d) for d in ("left", "right", "up", "down")}
        for d, v in dirs.items():
            _range(d, v, 0, 2000)
        if not any(dirs.values()):
            _refuse("outpaint needs at least one non-zero direction (--left / --right / --up / --down)")
        _range("creativity", a.creativity, 0.1, 1.0)
        body.update(dirs, creativity=a.creativity)
        if a.prompt:
            body["prompt"] = a.prompt
        tag = "op_" + "".join(f"{d[0]}{v}" for d, v in dirs.items() if v)
    elif kind == "search_replace":
        _range("grow_mask", a.grow_mask, 0, 20)
        body.update(prompt=a.prompt, search_prompt=a.search, grow_mask=a.grow_mask)
        tag = "sr"
    else:
        _range("control_strength", a.control_strength, 0.0, 1.0)
        body.update(prompt=a.prompt, control_strength=a.control_strength)
        tag = "st"
    if kind != "outpaint" and a.negative:
        body["negative_prompt"] = a.negative
    body.update(seed=a.seed, output_format="png")
    return body, f"{tag}_{a.seed}"


def cmd_edit(a) -> int:
    from gen import bedrock as B
    from gen import colossus as C
    form, src = C._form(a.form), Path(a.image)
    kind = a.cmd
    purpose = a.purpose or default_purpose(kind, form)
    check_purpose(kind, purpose)
    img = Image.open(src)
    check_input(img)
    body, tag = build_body(kind, a, "")
    body["image"] = B.png_b64(img.convert("RGB"))
    side = C._read_sidecar(src)
    meta = {**side, "source": str(src), "edit": {k: v for k, v in body.items() if k != "image"},
            "cache_keys": list(side.get("cache_keys", []))}
    dst = src.with_name(f"{src.stem.removesuffix('_raw')}_{tag}_raw.png")
    return C._call(kind, body, purpose, a.paid, dst, meta)


def add_parsers(sub: argparse._SubParsersAction) -> None:
    for kind in PURPOSES:
        p = sub.add_parser(kind)
        p.add_argument("form"); p.add_argument("image", help="the source render (PNG; sent as RGB)")
        p.add_argument("--seed", type=int, required=True)
        p.add_argument("--purpose", help=f"a 5.6 purpose: {', '.join(PURPOSES[kind])} or reserve:<reason>")
        p.add_argument("--paid", action="store_true")
        if kind == "outpaint":
            for d in ("left", "right", "up", "down"):
                p.add_argument(f"--{d}", type=int, default=0)
            p.add_argument("--creativity", type=float, default=0.5)
            p.add_argument("--prompt")
        else:
            p.add_argument("--prompt", required=True)
            p.add_argument("--negative")
        if kind == "search_replace":
            p.add_argument("--search", required=True, help="search_prompt: what to replace")
            p.add_argument("--grow-mask", type=int, default=5)
        if kind == "structure":
            p.add_argument("--control-strength", type=float, default=0.7)

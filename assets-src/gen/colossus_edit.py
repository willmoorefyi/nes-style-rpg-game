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

`upscale <src> --model conservative|creative|fast [--form F]` (7.3, the rim backdrop fix, purpose `rim_upscale`; with
--form, 18.2 step 2: purpose `f3_upscale` / `f2_upscale`, then the offline upfit to the form canvas, refused when the
output is narrower; a source over the 2.5:1 aspect gets 4 edge rows top and bottom, cropped after). The reserve takes
no upscale (B7: the gate refuses reserve calls over $0.08). Its bodies and local input limits (AWS Bedrock Stability Image Services, Upscale):
  conservative  {image, prompt, [negative_prompt], creativity 0.2-0.5 (default 0.35), seed, output_format}
                every side >= 64 px, <= 9,437,184 px, aspect 1:2.5..2.5:1 (the model is meant for <= 1 MP inputs)
  creative      {image, prompt, [negative_prompt], creativity 0.1-0.5 (default 0.3), seed, output_format}
                every side >= 64 px, 4,096..1,048,576 px
  fast          {image, output_format}   (4x; no prompt, creativity or seed) sides 32..1,536 px, 1,024..1,048,576 px
The output is `<src stem>_up_<model>_<seed>.png` next to the source (or --out), with a sidecar.
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


UPSCALE_PURPOSES = ("rim_upscale", "f3_upscale", "f2_upscale")
# model: (min side, max side, min px, max px, max aspect, creativity range, default creativity); None = no limit
UPSCALE = {"conservative": (64, None, 0, MAX_PX, MAX_ASPECT, (0.2, 0.5), 0.35),
           "creative": (64, None, 4_096, 1_048_576, None, (0.1, 0.5), 0.3),
           "fast": (32, 1_536, 1_024, 1_048_576, None, None, None)}


def check_upscale_input(model: str, img: Image.Image) -> None:
    lo, hi, pmin, pmax, asp, _, _ = UPSCALE[model]
    w, h = img.size
    if min(w, h) < lo or (hi and max(w, h) > hi) or not pmin <= w * h <= pmax or (asp and max(w / h, h / w) > asp):
        _refuse(f"input image {w}x{h} does not fit {model} upscale: every side >= {lo} px"
                + (f" and <= {hi:,} px" if hi else "") + f", {pmin:,}..{pmax:,} px"
                + (f", an aspect within 1:{asp}..{asp}:1" if asp else ""))


def upscale_body(a, image_b64: str) -> tuple[dict, str]:
    """(request body, output-name tag) for one upscale; refuses a malformed request."""
    if a.model not in UPSCALE:
        _refuse(f"unknown upscale model {a.model!r} ({', '.join(UPSCALE)})")
    crange, cdef = UPSCALE[a.model][5:]
    body: dict = {"image": image_b64}
    if a.model == "fast":
        given = [n for n, v in (("--prompt", a.prompt), ("--negative", a.negative), ("--creativity", a.creativity),
                                ("--seed", a.seed)) if v is not None]
        if given:
            _refuse(f"fast upscale takes no {', '.join(given)} (its body is image and output_format only)")
        body["output_format"] = "png"
        return body, "up_fast"
    if a.seed is None:
        _refuse(f"{a.model} upscale needs --seed (>= 1; 0 means random and could not be repeated)")
    _range("seed", a.seed, 1, MAX_SEED)
    if not (a.prompt or "").strip():
        _refuse(f"{a.model} upscale needs a non-empty --prompt (a required parameter)")
    crea = cdef if a.creativity is None else a.creativity
    _range("creativity", crea, *crange)
    body.update(prompt=a.prompt, creativity=crea)
    if a.negative:
        body["negative_prompt"] = a.negative
    body.update(seed=a.seed, output_format="png")
    return body, f"up_{a.model}_{a.seed}"


def cmd_upscale(a) -> int:
    from gen import bedrock as B
    from gen import colossus as C
    from gen import colossus_paint as P
    form = C._form(a.form) if a.form else None
    purpose = a.purpose or (form["upscale"] if form else UPSCALE_PURPOSES[0])
    if B.purpose_key(purpose) not in (*UPSCALE_PURPOSES, "reserve"):
        _refuse(f"purpose {purpose!r} is not an upscale purpose ({', '.join(UPSCALE_PURPOSES)}, reserve:<reason>)")
    src = Path(a.src)
    body, tag = upscale_body(a, "")
    img = Image.open(src).convert("RGB")
    pad = P.pad_rows_for(img.size, UPSCALE[a.model][4] or 1e9) if form else 0
    img = P.pad(img, pad)
    check_upscale_input(a.model, img)
    body["image"] = B.png_b64(img)
    meta = {"source": str(src), "upscale": {k: v for k, v in body.items() if k != "image"}, "src_size": list(img.size),
            **({"form": a.form, "pad_rows": pad} if form else {})}
    dst = Path(a.out) if a.out else src.with_name(f"{src.stem}_{tag}.png")
    code = C._call(f"upscale_{a.model}", body, purpose, a.paid, dst, meta)
    if form and dst.exists():
        from gen import colossus_glowcmd as CG
        return CG.upfit(a.form, dst, src, tuple(form["canvas"]), pad, dst.with_name(f"{dst.stem}_fit.png"))
    return code


def add_upscale_parser(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("upscale", help="Stability upscale of one image (purpose rim_upscale)")
    p.add_argument("src", help="the image to upscale (PNG; sent as RGB)")
    p.add_argument("--model", required=True, help=f"one of {', '.join(UPSCALE)}")
    p.add_argument("--prompt"); p.add_argument("--negative")
    p.add_argument("--creativity", type=float); p.add_argument("--seed", type=int)
    p.add_argument("--form", help="a colossus form: purpose f3_upscale / f2_upscale and the fit to its canvas (18.2)")
    p.add_argument("--purpose", help=f"{', '.join(UPSCALE_PURPOSES)} (default rim_upscale, or the form's)")
    p.add_argument("--out", help="output PNG (default: <src stem>_up_<model>_<seed>.png next to the source)")
    p.add_argument("--paid", action="store_true")


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
    add_upscale_parser(sub)

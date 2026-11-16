"""colossus.py's masked inpaint and its offline merge (docs/CHAOS_FORMS_PLAN.md 5.6 `f4_variant`; FW-C, F4 "Core Laid
Bare"). Separate from colossus_edit.py (file size).

  python3 -I assets-src/gen/colossus.py inpaint <src.png> --mask <mask.png> --prompt P [--negative N] [--grow-mask N]
                                        --seed N [--purpose f4_variant|v0|reserve:<reason>] [--out F] [--paid]
  python3 -I assets-src/gen/colossus.py inpaint_merge <src.png> <raw.png> --mask <mask.png> [--out F]     # 0 calls

inpaint is one call through bedrock.invoke (paid, purpose caps, BR ledger, main checkout only; cached by request hash)
with the AWS Bedrock Stability Inpaint schema (`us.stability.stable-image-inpaint-v1:0`):
  {image, mask, prompt, [negative_prompt], grow_mask 0-20 (default 5), seed, output_format: png}
image is the source as an RGB PNG, mask an L PNG (white = full inpaint strength, black = none). Checked locally first:
the source (every side >= 64 px, <= 9,437,184 px, aspect 1:2.5..2.5:1), the mask the same size as the source (the
service would resize it; the merge needs the exact grid) and not all black; seed >= 1; a non-empty prompt. The output is
`<src stem>_ip_<seed>_raw.png` next to the source (or --out), with a sidecar.

inpaint_merge composites the raw result onto the source only where the mask is non-black: every pixel outside the mask
stays byte-identical, and an RGBA source keeps its alpha everywhere (only RGB is taken from the result inside the mask,
so the silhouette never changes). grow_mask widens the service's edit region past the mask, but the merge still clips to
the mask itself. A result of another size is resized to the source with Lanczos first (recorded as `resized_from`).
The output is `<raw stem without _raw>_merged.png` (or --out) with a sidecar.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

PURPOSES = ("f4_variant", "v0")


def _refuse(msg: str):
    raise SystemExit(f"refused: {msg}")


def _mask(path: Path, size: tuple[int, int]) -> Image.Image:
    m = Image.open(path).convert("L")
    if m.size != size:
        _refuse(f"mask {path.name} is {m.size[0]}x{m.size[1]}, the source is {size[0]}x{size[1]}: they must match")
    if not np.asarray(m).any():
        _refuse(f"mask {path.name} is all black: nothing to inpaint")
    return m


def build_body(a) -> dict:
    """The body without image and mask; refuses a malformed request."""
    from gen import colossus_edit as CE
    if not a.mask:
        _refuse("inpaint needs --mask <mask.png> (white = inpaint, black = keep)")
    if a.seed is None:
        _refuse("inpaint needs --seed (>= 1; 0 means random and could not be repeated)")
    CE._range("seed", a.seed, 1, CE.MAX_SEED)
    if not (a.prompt or "").strip():
        _refuse("inpaint needs a non-empty --prompt (a required parameter)")
    CE._range("grow_mask", a.grow_mask, 0, 20)
    body = {"prompt": a.prompt, "grow_mask": a.grow_mask}
    if a.negative:
        body["negative_prompt"] = a.negative
    return body


def cmd_inpaint(a) -> int:
    from gen import bedrock as B
    from gen import colossus as C
    from gen import colossus_edit as CE
    purpose = a.purpose or PURPOSES[0]
    if B.purpose_key(purpose) not in (*PURPOSES, "reserve"):
        _refuse(f"purpose {purpose!r} is not an inpaint purpose ({', '.join(PURPOSES)}, reserve:<reason>)")
    fields = build_body(a)
    src = Path(a.src)
    img = Image.open(src)
    CE.check_input(img)
    mask = _mask(Path(a.mask), img.size)
    body = {"image": B.png_b64(img.convert("RGB")), "mask": B.png_b64(mask), **fields, "seed": a.seed,
            "output_format": "png"}
    side = C._read_sidecar(src)
    meta = {**side, "source": str(src), "mask": str(a.mask),
            "inpaint": {k: v for k, v in body.items() if k not in ("image", "mask")},
            "cache_keys": list(side.get("cache_keys", []))}
    dst = Path(a.out) if a.out else src.with_name(f"{src.stem.removesuffix('_raw')}_ip_{a.seed}_raw.png")
    code = C._call("inpaint", body, purpose, a.paid, dst, meta)
    if dst.exists():
        print(f"next (offline, 0 calls): colossus.py inpaint_merge {src} {dst} --mask {a.mask}")
    return code


def merge(src: Image.Image, result: Image.Image, mask: Image.Image) -> Image.Image:
    """src with result's RGB where mask > 0; src's alpha (if any) everywhere; outside the mask src is untouched."""
    if mask.size != src.size:
        _refuse(f"mask is {mask.size[0]}x{mask.size[1]}, the source is {src.size[0]}x{src.size[1]}: they must match")
    s = np.asarray(src).copy()
    r = np.asarray(result.convert("RGB"))
    inside = np.asarray(mask.convert("L")) > 0
    if s.ndim == 2:                                   # L / P sources: work in RGB, the merge needs colour
        raise SystemExit(f"refused: source mode {src.mode} (merge needs RGB or RGBA)")
    s[..., :3][inside] = r[inside]
    return Image.fromarray(s, src.mode)


def cmd_merge(a) -> int:
    from gen import colossus as C
    src_p, raw_p = Path(a.src), Path(a.raw)
    src = Image.open(src_p)
    if src.mode not in ("RGB", "RGBA"):
        src = src.convert("RGBA")
    result = Image.open(raw_p)
    meta = {**C._read_sidecar(raw_p), "source": str(src_p), "raw": str(raw_p), "mask": str(a.mask)}
    if result.size != src.size:
        meta["resized_from"] = list(result.size)
        result = result.convert("RGB").resize(src.size, Image.Resampling.LANCZOS)
    mask = Image.open(a.mask).convert("L")
    out = merge(src, result, mask)
    meta["merged_px"] = int((np.asarray(mask) > 0).sum()) if mask.size == src.size else 0
    dst = Path(a.out) if a.out else raw_p.with_name(f"{raw_p.stem.removesuffix('_raw')}_merged.png")
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    C._sidecar(dst, meta)
    print(f"wrote {dst} {out.size} ({meta['merged_px']} px inside the mask from the result; the rest is the source)")
    return 0


def add_parsers(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("inpaint", help="Stability masked inpaint of one image (purpose f4_variant)")
    p.add_argument("src", help="the source image (PNG; sent as RGB)")
    p.add_argument("--mask", help="L / black-and-white PNG, the source's size; white = inpaint")
    p.add_argument("--prompt"); p.add_argument("--negative")
    p.add_argument("--grow-mask", type=int, default=5); p.add_argument("--seed", type=int)
    p.add_argument("--purpose", help=f"{', '.join(PURPOSES)} (default {PURPOSES[0]}) or reserve:<reason>")
    p.add_argument("--out", help="output PNG (default: <src stem>_ip_<seed>_raw.png next to the source)")
    p.add_argument("--paid", action="store_true")
    m = sub.add_parser("inpaint_merge", help="offline: the inpaint result onto the source inside the mask only")
    m.add_argument("src"); m.add_argument("raw"); m.add_argument("--mask", required=True)
    m.add_argument("--out", help="output PNG (default: <raw stem without _raw>_merged.png)")

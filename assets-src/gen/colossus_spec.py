"""The colossus layer yaml rules and the bestiary still (docs/CHAOS_FORMS_PLAN.md 18.5, 18.8; FW-C), split from
colossus_build.py (file size). `spec_problems` refuses everything the TS reader (colossusIndex.ts formProblems) would
refuse plus the painted-layer rules, before any pixel is read; `preview` is the 940x720 opaque still per form.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

KINDS = ("body", "limb", "core", "glow", "moon", "eyes", "cloud", "corona", "overhang")   # colossusIndex.ts LAYER_KINDS
ANCHORS = ("target", "core", "head", "melee", "feet")
FIELD_Y1 = 780                      # the rest view's bottom (the strip)
PREVIEW = (940, 720)                # 18.8: the bestiary still, Lanczos-fit and opaque


def _ints(v, n: int) -> bool:
    return isinstance(v, (list, tuple)) and len(v) == n and all(isinstance(x, int) and not isinstance(x, bool) for x in v)


def spec_problems(spec: dict) -> list[str]:
    """Everything the TS reader would refuse, plus the painted-layer rules, before any pixel is read."""
    p: list[str] = []
    cw, ch = spec.get("canvas") or (0, 0)
    if not _ints(spec.get("canvas"), 2) or cw <= 0 or ch <= 0:
        return ["canvas must be two positive integers"]
    if not isinstance(spec.get("scale", 1), int) or spec.get("scale", 1) < 1:
        p.append("scale must be an integer >= 1")
    if not _ints(spec.get("place"), 2):
        p.append("place must be two integers")
    a = spec.get("anchors") or {}
    inside = lambda xy: _ints(xy, 2) and 0 <= xy[0] <= cw and 0 <= xy[1] <= ch   # noqa: E731
    if not all(inside(a.get(k)) for k in ANCHORS) or not (isinstance(a.get("hands"), list) and len(a["hands"]) == 2
                                                          and all(inside(h) for h in a["hands"])):
        p.append("anchors (target, core, head, melee, feet, hands [l, r]) must be integer points inside the canvas")
    r = spec.get("target_rect")
    if not _ints(r, 4) or r[2] <= 0 or r[3] <= 0 or r[0] < 0 or r[1] < 0 or r[0] + r[2] > cw or r[1] + r[3] > ch:
        p.append(f"target_rect {r} must be [x, y, w, h] with w, h > 0 inside the canvas")
    for k in ("cover_box", "visible_box"):
        if k in spec and not _ints(spec[k], 4):
            p.append(f"{k} must be 4 integers")
    names = [L.get("name") for L in spec.get("layers") or []]
    if not names or len(set(names)) != len(names):
        p.append(f"layers must be a non-empty list with unique names ({names})")
    for L in spec.get("layers") or []:
        n = L.get("name")
        if L.get("kind") not in KINDS:
            p.append(f"layer {n}: unknown kind {L.get('kind')}")
        if L.get("blend", "normal") not in ("normal", "add"):
            p.append(f"layer {n}: blend {L.get('blend')} is not normal | add")
        al = L.get("alpha", 1.0)
        if not isinstance(al, (int, float)) or not 0 < al <= 1:
            p.append(f"layer {n}: alpha {al} is not in (0, 1]")
        if L.get("tex_scale", 1) not in (1, 2, 3, 4):
            p.append(f"layer {n}: tex_scale {L.get('tex_scale')} is not 1-4")
        if "box" in L and not _ints(L["box"], 4):
            p.append(f"layer {n}: box must be 4 integers")
        if "base" not in (L.get("frames") or {}):
            p.append(f"layer {n}: no base frame")
    return [f"colossus {spec.get('form', '?')}: {m}" for m in p]


def visible_box_of(entry: dict) -> list[int]:
    """colossusIndex.ts visibleBoxOf: the canvas (art px) inside (0, 0, 1920, 780) at rest when the json has none."""
    s, (px, py), (cw, ch) = entry["scale"], entry["place"], entry["canvas"]
    clip = lambda v, hi: max(0, min(hi, v))   # noqa: E731
    return [clip(-px // s, cw), clip(-py // s, ch), clip(-(-(1920 - px) // s), cw), clip(-(-(FIELD_Y1 - py) // s), ch)]


def preview(entry: dict, spec: dict, approved: Path, form: str, bg_path: Path | None) -> Image.Image | None:
    """18.8: the rest view (base frames, or the yaml's `variant` {layer: frame}, e.g. F4's core: open; glow added) over
    rim with the sky dim, cropped to the visible box, fit into 940x720, opaque. `form` is the art dir. None without a
    backdrop."""
    from gen import colossus_paint as P
    if bg_path is None or not bg_path.exists():
        return None
    bg = np.asarray(Image.open(bg_path).convert("RGB").resize((1920, 1080), Image.Resampling.LANCZOS)).astype(float)
    out = bg * float(spec.get("sky_dim", 1.0))
    px, py = entry["place"]
    for L, e in zip(spec["layers"], entry["layers"]):
        src, box = L["frames"].get((spec.get("variant") or {}).get(L["name"], "base")), L.get("box")
        if src is None:
            continue
        img = Image.open(approved / form / src).convert("RGBA")
        if box:
            img = _boxed(img, box)
        out = P.place_layer(out, img, (px, py), e.get("blend", "normal"), e.get("alpha", 1.0))
    vb = entry.get("visibleBox") or visible_box_of(entry)
    crop = (max(0, px + vb[0]), max(0, py + vb[1]), min(1920, px + vb[2]), min(FIELD_Y1, py + vb[3]))
    shot = Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8), "RGB").crop(crop)
    f = min(PREVIEW[0] / shot.width, PREVIEW[1] / shot.height)
    return shot.resize((max(1, round(shot.width * f)), max(1, round(shot.height * f))),
                       Image.Resampling.LANCZOS).convert("RGBA")


def _boxed(img: Image.Image, box) -> Image.Image:
    a = np.asarray(img).copy()
    keep = np.zeros(a.shape[:2], bool)
    keep[box[1]:box[3], box[0]:box[2]] = True
    a[~keep] = 0
    return Image.fromarray(a, "RGBA")

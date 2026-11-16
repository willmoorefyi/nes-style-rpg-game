"""Colossus forms' pixel work (docs/CHAOS_FORMS_PLAN.md 4.3, 5.3, 5.4): `pix` (render -> palette-locked pixel art),
the layer split of an approved master by its layer yaml, the offline glow bake and the limb bake, plus the checks the
build and colossus.py run (binary alpha outside glow, the 4 glow levels, the palette lock, masks covering the master
exactly once). No network, no backend.

Layer yaml (gen/colossus/<form>.yaml, written by the rigger; coordinates in art px):
  form, canvas [w, h] (= the master's size), scale (integer), place [x, y] (screen px, the canvas top-left),
  anchors {target, core, head, hands: [l, r], melee, feet}, target_rect [x0, y0, x1, y1], visible_box (optional),
  layers: list in draw order (bottom first), each {name, kind, mask (polygon; not for body / glow), z, over: bool}:
    body  - every opaque master pixel not in another layer
    limb  - + pivot [x, y], frames {name: degrees, |deg| <= 20, positive = clockwise}, fill (polygon: the body under
            the limb painted with the nearest body colour, no inpainting)
    core | moon | eyes | cloud | corona | overhang - a cut-out (overhang: over: true, above floorFront)
    glow  - sources {layer: dilation px}: an aura baked from those layers' alpha, 4 stepped alpha levels, blend add
  variants {layer: {name: png in the approved form dir}} (e.g. F4's core: open), replacing that layer's pixels.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen import pixelize as PX

# The shared base palette (5.3): exact colours of F1's approved sheets (approved/chaos/boss_*.png), by role. FW-C's
# pick, measured on boss_idle: the void black robe, the gold trim, the ember shadow of the flame crown and the
# ember orb, the white of the flame core and the frost / storm orbs, and the four orb colours (frost cyan ring, abyss
# teal fill, ember crimson rim, storm grey). selftest_colossus_art.py checks every value is in F1's sheets.
BASE_PALETTE = {
    "void_black": (24, 24, 33),
    "gold": (222, 165, 82),
    "ember": (165, 90, 49),
    "white": (231, 239, 222),
    "orb_frost": (66, 132, 148),
    "orb_abyss": (41, 41, 49),
    "orb_ember": (148, 41, 74),
    "orb_storm": (132, 123, 132),
}
NEAR = 24                       # a free colour closer than this (RGB distance) to a base colour is snapped to it
GLOW_LEVELS = (64, 128, 191, 255)   # alpha 0.25 / 0.5 / 0.75 / 1
GLOW_COLOURS = ("ember", "ember", "gold", "white")   # per level, outermost first
MAX_ROT = 20                    # degrees, like the rig rotation cap
CUTOUT = ("core", "moon", "eyes", "cloud", "corona", "overhang", "limb")
SPECK = 0.002                   # pieces under 0.2 % of the largest blob are dropped (the /tmp/stab pix.py rule)


def _base() -> np.ndarray:
    return np.array(list(BASE_PALETTE.values()), np.float32)


def poly_mask(poly, size: tuple[int, int]) -> np.ndarray:
    """A polygon (art px vertex list) rasterised on a canvas of size (w, h), edges included."""
    im = Image.new("L", size, 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in poly], fill=1, outline=1)
    return np.asarray(im).astype(bool)


# ───────────────────────────── pix ─────────────────────────────

def lock_palette(rgb: np.ndarray, solid: np.ndarray) -> np.ndarray:
    """Every opaque colour within NEAR of a base colour becomes that base colour (the outline stays)."""
    out = rgb.copy()
    px = out[solid].astype(np.float32)
    d = ((px[:, None, :] - _base()[None]) ** 2).sum(-1)
    near = d.min(1) < NEAR ** 2
    keep = (px == np.array(PX.OUTLINE, np.float32)).all(1)
    px[near & ~keep] = _base()[d.argmin(1)][near & ~keep]
    out[solid] = px.astype(np.uint8)
    return out


def pix(img: Image.Image, canvas: tuple[int, int], colors: int, seed: int = 0) -> Image.Image:
    """A remove_bg result -> the form's canvas: alpha >= 128, specks dropped, block vote (pixelize) at the largest
    size that fits the canvas, a palette of the base colours plus `colors` free ones (15-bit), the base lock, a 1 px
    outline; centred horizontally, bottom-aligned (the base sits behind floorFront)."""
    a = np.asarray(img.convert("RGBA"))
    mask = a[..., 3] >= 128
    lab, n = PX.components(mask)
    if n == 0:
        raise ValueError("pix: the image has no opaque pixels (alpha >= 128)")
    sizes = np.bincount(lab.ravel())[1:]
    mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= SPECK * sizes.max()])
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, mk = a[y0:y1, x0:x1, :3].copy(), mask[y0:y1, x0:x1]
    rgb[~mk] = (255, 0, 255)
    cw, ch = canvas
    f = min((cw - 2) / (x1 - x0), (ch - 1) / (y1 - y0))          # room for the outline ring
    grid = (max(1, round((x1 - x0) * f)), max(1, round((y1 - y0) * f)))
    free = PX.sheet_palette([rgb[mk].astype(np.float32)], colors, seed)
    pal = np.concatenate([_base(), np.asarray(free, np.float32)])
    spr = np.asarray(PX.pixelize(Image.fromarray(rgb), mk, grid, colors=len(pal), seed=seed, palette=pal)).copy()
    solid = spr[..., 3] > 0
    spr[..., :3] = lock_palette(spr[..., :3], solid)
    out = np.zeros((ch, cw, 4), np.uint8)
    gh, gw = spr.shape[:2]
    ox, oy = (cw - gw) // 2, ch - gh
    out[max(0, oy):oy + gh, max(0, ox):ox + gw] = spr[max(0, -oy):, max(0, -ox):][:ch - max(0, oy), :cw - max(0, ox)]
    return Image.fromarray(out, "RGBA")


def palette_problems(img: Image.Image) -> list[str]:
    """Free colours within NEAR of a base colour (the lock was skipped) and colours that are not 15-bit."""
    a = np.asarray(img.convert("RGBA"))
    cols = np.unique(a[a[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    base, probs = _base(), []
    for c in cols:
        t = tuple(int(v) for v in c)
        if t == PX.OUTLINE or (base == c).all(1).any():
            continue
        d = float(np.sqrt(((base - c) ** 2).sum(1)).min())
        if d < NEAR:
            probs.append(f"palette: {t} is near a base colour ({d:.1f} < {NEAR})")
        if tuple(PX.snap15(c).tolist()) != t:
            probs.append(f"palette: {t} is not a 15-bit colour")
    return probs


# ───────────────────────────── split, glow, bake ─────────────────────────────

def _layer_masks(spec: dict, size: tuple[int, int], opaque: np.ndarray) -> dict[str, np.ndarray]:
    return {L["name"]: poly_mask(L["mask"], size) & opaque for L in spec["layers"]
            if L["kind"] not in ("body", "glow")}


def cover_problems(master: Image.Image, spec: dict) -> list[str]:
    """Masks cover the master exactly once: no two cut-out layers share a pixel (a fill under a limb is declared and is
    not an overlap); body takes the rest, so there is no gap. Also the canvas, kinds and names."""
    probs = []
    if list(master.size) != list(spec["canvas"]):
        probs.append(f"canvas {spec['canvas']} != the master's size {list(master.size)}")
    names = [L["name"] for L in spec["layers"]]
    if len(set(names)) != len(names) or names.count("body") != 1:
        probs.append(f"layer names must be unique with exactly one body ({names})")
    for L in spec["layers"]:
        if L["kind"] not in ("body", "glow", *CUTOUT):
            probs.append(f"{L['name']}: unknown kind {L['kind']}")
        elif L["kind"] not in ("body", "glow") and not L.get("mask"):
            probs.append(f"{L['name']}: a {L['kind']} layer needs a mask")
    if probs:
        return probs
    opaque = np.asarray(master.convert("RGBA"))[..., 3] > 0
    seen = np.zeros(opaque.shape, np.int32)
    for name, m in _layer_masks(spec, master.size, opaque).items():
        if not m.any():
            probs.append(f"{name}: its mask covers no opaque pixel")
        seen += m
    if (seen > 1).any():
        ys, xs = np.where(seen > 1)
        probs.append(f"overlap: {int((seen > 1).sum())} px are in two layers (first at {int(xs[0])}, {int(ys[0])})")
    return probs


def _dilate(m: np.ndarray) -> np.ndarray:
    n = m.copy()
    n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
    n[1:, 1:] |= m[:-1, :-1]; n[:-1, :-1] |= m[1:, 1:]; n[1:, :-1] |= m[:-1, 1:]; n[:-1, 1:] |= m[1:, :-1]
    return n


def glow(layers: dict[str, Image.Image], sources: dict[str, int]) -> Image.Image:
    """The aura (5.3): each source layer's alpha dilated `r` px (8-neighbour steps); the ring at step s gets band
    5 - ceil(4 s / r): 4 innermost (white, alpha 1) ... 1 outermost (ember, alpha 0.25); the strongest band wins; the
    source pixels themselves stay 0."""
    first = next(iter(layers.values()))
    w, h = first.size
    level = np.zeros((h, w), np.int32)
    src_all = np.zeros((h, w), bool)
    for name, r in sources.items():
        m = np.asarray(layers[name])[..., 3] > 0
        src_all |= m
        cur = m
        for s in range(1, int(r) + 1):
            nxt = _dilate(cur)
            band = 5 - math.ceil(4 * s / r)                     # 4 (inner) .. 1 (outer)
            level = np.where(nxt & ~cur & (level < band), band, level)
            cur = nxt
    level[src_all] = 0
    out = np.zeros((h, w, 4), np.uint8)
    for band in range(1, 5):
        sel = level == band
        out[sel, :3] = BASE_PALETTE[GLOW_COLOURS[band - 1]]
        out[sel, 3] = GLOW_LEVELS[band - 1]
    return Image.fromarray(out, "RGBA")


def bake(layer: Image.Image, pivot, deg: float) -> Image.Image:
    """One limb frame: the layer rotated `deg` (clockwise) about its pivot with the rotsprite sampler, same canvas."""
    if abs(deg) > MAX_ROT:
        raise ValueError(f"bake: {deg} degrees is over the {MAX_ROT} degree rotation cap")
    from gen import rig_rotsprite as RS
    arr = np.asarray(layer.convert("RGBA"))
    if deg == 0:
        return Image.fromarray(arr.copy(), "RGBA")
    p = np.asarray(pivot, float)
    rgba, _ = RS.rotsprite(arr, arr[..., 3] > 0, p, p, math.radians(deg), arr.shape[:2])
    return Image.fromarray(rgba, "RGBA")


def split(master: Image.Image, spec: dict) -> dict[str, Image.Image]:
    """The master cut into its layers (canvas-sized RGBA, draw order kept) plus `glow`; raises on any cover problem
    or a limb frame over the rotation cap."""
    probs = cover_problems(master, spec)
    for L in spec["layers"]:
        for f, deg in (L.get("frames") or {}).items():
            if abs(deg) > MAX_ROT:
                probs.append(f"{L['name']}/{f}: {deg} degrees is over the {MAX_ROT} degree rotation cap")
    if probs:
        raise ValueError("; ".join(probs))
    a = np.asarray(master.convert("RGBA"))
    opaque = a[..., 3] > 0
    masks = _layer_masks(spec, master.size, opaque)
    rest = opaque.copy()
    for m in masks.values():
        rest &= ~m
    out: dict[str, Image.Image] = {}
    for L in spec["layers"]:
        if L["kind"] == "glow":
            continue
        m = rest if L["kind"] == "body" else masks[L["name"]]
        lay = np.where(m[..., None], a, 0).astype(np.uint8)
        out[L["name"]] = Image.fromarray(lay, "RGBA")
    body_name = next(L["name"] for L in spec["layers"] if L["kind"] == "body")
    body = np.asarray(out[body_name]).copy()
    cols = np.unique(body[body[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    for L in spec["layers"]:
        if L["kind"] == "limb" and L.get("fill") and len(cols):
            ys, xs = np.where(poly_mask(L["fill"], master.size) & masks[L["name"]])
            px = a[ys, xs, :3].astype(np.float32)          # nearest body colour (no inpainting)
            body[ys, xs, :3] = cols[((px[:, None, :] - cols[None]) ** 2).sum(-1).argmin(1)]
            body[ys, xs, 3] = 255
    out[body_name] = Image.fromarray(body, "RGBA")
    for L in spec["layers"]:
        if L["kind"] == "glow":
            out[L["name"]] = glow(out, L.get("sources") or {})
    return out


def alpha_problems(name: str, kind: str, img: Image.Image) -> list[str]:
    """Binary alpha everywhere except glow, whose alpha is 0 or one of the 4 GLOW_LEVELS."""
    vals = set(np.unique(np.asarray(img.convert("RGBA"))[..., 3]).tolist())
    allowed = {0, *GLOW_LEVELS} if kind == "glow" else {0, 255}
    bad = sorted(vals - allowed)
    if not bad:
        return []
    return [f"{name}: alpha {bad[:4]} is not a glow level {GLOW_LEVELS}" if kind == "glow" else
            f"{name}: alpha {bad[:4]} is not binary (0 / 255 outside glow)"]

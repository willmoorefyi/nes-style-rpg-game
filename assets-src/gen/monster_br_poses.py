"""EF-F F3 fallback route for monster_br.py: the idle alone by Stable Image Ultra (text-to-image), then attack, hurt
and kneel each by Control Structure on a guide drawn from the old approved pose silhouettes (the retired sheet and
kneel key, approved/_retired/<id>_vN/), the new idle described in the prompt. Each render's figure is scaled to its
old pose's height share (size is normalised, never a reason to reject) and the four are stitched into one 1x4 strip
for the shared cutter.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from gen import bedrock as B
from gen import monster as M

KEY = (255, 0, 255)
CANVAS = {"square": (1024, 1024), "wide": (1344, 768)}       # guide sizes (1:1, 16:9); 2x2 cells
BOX = {"biped": (0.42, 0.80, 0.50, 0.58), "quadruped": (0.82, 0.78, 0.74, 0.58)}   # w, h, kneel w, kneel h (cell)
POSES = ("idle", "attack", "hurt", "kneel")
POSE_MODELS = (("ultra", "ef_sheet"), ("structure", "ef_structure"), ("structure", "ef_structure"),
               ("structure", "ef_structure"))
SIDE = 1024
FIG = 0.70              # the tallest old pose's share of the guide height
FEET = 0.90
CONTROL = 0.70          # control_strength (AR: 0.5-0.65 for field sheets; poses need a firmer hold)


def old_rgba(sm: dict) -> list[np.ndarray]:
    """The retired sheet's idle, attack, hurt cells and the retired kneel key (same cell), RGBA."""
    d = B.HERE / "approved" / "_retired" / sm["retired"]
    sh = np.asarray(Image.open(d / f"monster_{sm['size']}.png").convert("RGBA"))
    w = sh.shape[1] // 3
    return [sh[:, k * w:(k + 1) * w] for k in range(3)] + [np.asarray(Image.open(d / "kneel.png").convert("RGBA"))]


def old_poses(sm: dict) -> list[np.ndarray]:
    return [a[..., 3] > 0 for a in old_rgba(sm)]


def heights(masks: list[np.ndarray]) -> list[int]:
    return [int(np.ptp(np.where(m.any(1))[0])) + 1 for m in masks]


def _open(m: np.ndarray) -> np.ndarray:
    """3x3 binary opening (numpy only)."""
    def shifts(x):
        p = np.pad(x, 1)
        return [p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    e = np.logical_and.reduce(shifts(m))
    return np.logical_or.reduce(shifts(e))


def silhouette_grid(sm: dict, size: tuple[int, int], feet: float, key: tuple, colour: bool = False,
                    fill: tuple | None = None) -> Image.Image:
    """The 2x2 main-route guide rev 3: the four old poses as silhouettes (dark grey, or `fill`; one scale, the tallest
    at 0.75 of a cell's height) on the magenta key, feet on each cell's ground row; rev 4 (`colour`): the old pixels."""
    masks, rgba = old_poses(sm), old_rgba(sm)
    if sm.get("open_guide"):               # drop thin spikes (the old bone spine ridge) from the guide's shapes
        masks = [_open(m) for m in masks]
    cw, ch = size[0] // 2, size[1] // 2
    s = min(0.75 * ch / max(heights(masks)), 0.9 * cw / max(m.any(0).sum() for m in masks))
    img = Image.new("RGB", size, key)
    for k, m in enumerate(masks):
        ys, xs = np.where(m)
        crop = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        sil = Image.fromarray((crop * 255).astype(np.uint8)).resize((round(crop.shape[1] * s), round(crop.shape[0] * s)),
                                                                    Image.Resampling.NEAREST)
        x0, y1 = (k % 2) * cw + (cw - sil.width) // 2, (k // 2) * ch + round(feet * ch)
        art = Image.fromarray(rgba[k][ys.min():ys.max() + 1, xs.min():xs.max() + 1, :3]).resize(sil.size,
                                                                                              Image.Resampling.NEAREST)
        rc = sm.get(sm.get("recolor_key", "recolor"))
        if colour and rc:
            art = recolor(art, rc)
        img.paste(art if colour else Image.new("RGB", sil.size, tuple(fill or (72, 72, 82))), (x0, y1 - sil.height), sil)
    return img


def recolor(art: Image.Image, rc: dict) -> Image.Image:
    """Guide-only recolour of the old pixels (the design changes, the pose stays): `light` low-saturation bright
    pixels (bone, beard, ash hide), `warm` skin, `glow` saturated yellow-green, each to one shaded colour."""
    import colorsys
    a = np.asarray(art).astype(float) / 255
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in a.reshape(-1, 3)]).reshape(a.shape)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sel = {"light": (s < 0.22) & (v > 0.38), "warm": (h < 0.11) & (s >= 0.22) & (v > 0.3),
           "glow": (h > 0.11) & (h < 0.4) & (s >= 0.35), "bright": v > 0.5}
    out = a.copy()
    for name, rgb in rc.items():
        if name in sel:                    # `flat`: one colour, no shading (drops rib / crack texture)
            m = sel[name]
            out[m] = np.asarray(rgb, float)[None] / 255 * (1.0 if rc.get("flat") else 0.55 + 0.6 * v[m, None])
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def structure_guide(sm: dict, k: int) -> Image.Image:
    """Old pose k as a dark silhouette on white, all four poses at one scale (the tallest at FIG of the side)."""
    masks = old_poses(sm)
    s = FIG * SIDE / max(heights(masks))
    m = masks[k]
    ys, xs = np.where(m)
    crop = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    sil = Image.fromarray((crop * 255).astype(np.uint8)).resize((round(crop.shape[1] * s), round(crop.shape[0] * s)),
                                                                Image.Resampling.NEAREST)
    img = Image.new("RGB", (SIDE, SIDE), (255, 255, 255))
    x0, y1 = (SIDE - sil.width) // 2, round(FEET * SIDE)
    img.paste(Image.new("RGB", sil.size, (64, 64, 72)), (x0, y1 - sil.height), sil)
    ImageDraw.Draw(img).line([40, y1 + 2, SIDE - 40, y1 + 2], fill=(160, 160, 160), width=3)
    return img


def bodies(sp: dict, sm: dict, v: dict) -> list[tuple[str, str, dict]]:
    """[(model, purpose, body)] for idle (Ultra t2i), attack, hurt, kneel (structure)."""
    subject = " ".join(f"{sm['subject']} {v.get('add', '')}".split())
    neg = " ".join(", ".join(x for x in (sp["negative"], sm.get("negative", ""), v.get("negative", "")) if x).split())
    out = []
    for k, (pose, (model, purpose)) in enumerate(zip(("idle", "attack", "hurt", "kneel"), POSE_MODELS)):
        text = " ".join(" ".join(t.split()) for t in (
            sp["style2" if v.get("text", 1) == 2 else "style"], f"One single full-body figure of this character: {subject}",
            f"The pose: {sm['poses'][pose]}, facing right with the face and chest turned to the right side of the "
            "image.", sp["background"]))
        b = {"prompt": text, "negative_prompt": neg, "seed": int(v["seed"]), "output_format": "png"}
        if model == "ultra":
            b["aspect_ratio"] = "1:1"
        else:
            b.update(image=B.png_b64(structure_guide(sm, k)), control_strength=float(v.get("control", CONTROL)))
        out.append((model, purpose, b))
    return out


def stitch(sm: dict, renders: list[Image.Image], flip: list[int] = ()) -> Image.Image:
    """Each render's figure (the cutter's own mask) scaled to its old pose's height share, feet on one ground row,
    on a magenta 1x4 strip of SIDE cells (cells in `flip` mirrored)."""
    hs = heights(old_poses(sm))
    strip = Image.new("RGB", (SIDE * 4, SIDE), (255, 0, 255))
    for k, r in enumerate(renders):
        rgb = np.asarray(r.convert("RGB").resize((SIDE, SIDE), Image.Resampling.LANCZOS))
        mask = M._figure_mask(rgb)
        ys, xs = np.where(mask)
        art = rgb.copy()
        art[~mask] = (255, 0, 255)
        crop = Image.fromarray(art[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
        cm = Image.fromarray((mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255).astype(np.uint8))
        th = round(FIG * SIDE * hs[k] / max(hs))
        size = (max(1, round(crop.width * th / crop.height)), th)
        crop, cm = crop.resize(size, Image.Resampling.LANCZOS), cm.resize(size, Image.Resampling.NEAREST)
        if k in flip:
            crop, cm = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT), cm.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        x0 = k * SIDE + (SIDE - min(size[0], SIDE)) // 2
        strip.paste(crop, (x0, round(FEET * SIDE) - th), cm)
    return strip


# ───────── the 2x2 main route: guide and text (monster_br.body) ─────────

def guide(sm: dict, rev: int = 2, fill: tuple | None = None) -> Image.Image:
    """Magenta page, 2x2 cells; per cell a figure box standing on a ground line (kneel: a lower box). rev 1: grey box
    (pirate v1-v2: kept as grey panels at strength 0.85); rev 2: the box and line in darker key magenta (keyed out;
    pirate v3-v4: a flat init stays flat); rev 3: the old poses' silhouettes (monster_br_poses.silhouettes)."""
    if rev >= 3:                                    # rev 4: the old poses in their own colours (or `fill`)
        return silhouette_grid(sm, CANVAS[sm["canvas"]], FEET, KEY, rev == 4, fill)
    w, h = CANVAS[sm["canvas"]]
    cw, ch = w // 2, h // 2
    img = Image.new("RGB", (w, h), KEY)
    d = ImageDraw.Draw(img)
    bw, bh, kw, kh = BOX[sm["body"]]
    for k in range(4):
        x0, y0 = (k % 2) * cw, (k // 2) * ch
        fw, fh = (kw, kh) if k == 3 else (bw, bh)
        gy = y0 + int(FEET * ch)
        bx = x0 + int((cw - fw * cw) / 2)
        d.rectangle([bx, gy - int(fh * ch), bx + int(fw * cw), gy], fill=(120, 120, 128) if rev == 1 else (210, 0, 210))
        d.line([x0 + 24, gy + 2, x0 + cw - 24, gy + 2], fill=(110, 0, 110) if rev == 1 else (170, 0, 170), width=4)
    return img


def prompt(sp: dict, sm: dict, v: dict) -> tuple[str, str]:
    """text 1 (pirate v1-v5) said "sprite sheet", which draws sheets of many small figures; text 2 avoids it."""
    poses, tx = sm["poses"], v.get("text", 1)
    if tx == 4:                     # text 4: short and positive only ("not chibi" in a prompt draws chibi)
        q = {**sm["poses4"], **{k: v[k] for k in POSES if k in v}}
        text = [sp["style4"], f"Four copies of the same {' '.join((sm['short_' + v['short4'] if 'short4' in v else 'short'], v.get('add', ''))).strip()}, one in each quarter, all "
                f"facing right: top left {q['idle']}; top right {q['attack']}; bottom left {q['hurt']}; bottom right "
                f"{q['kneel']}.", sp["background4"]]
        neg = ", ".join(x for x in (sp["negative4"], sm.get("negative", ""), v.get("negative", "")) if x)
        return " ".join(" ".join(t.split()) for t in text), " ".join(neg.split())
    text = [sp["style2" if tx > 1 else "style"], f"The character: {sm['subject']} {v.get('add', '')}",
            sp[f"grid{tx}"] if tx > 1 else "Four poses of this same character in a 2x2 grid, each pose alone in its own "
            "quarter, every pose facing right with the face and chest turned to the right side of the image:",
            f"top left, {poses['idle']}; top right, {poses['attack']}; bottom left, {poses['hurt']}; "
            f"bottom right, {poses['kneel']}.", sp["background"]]
    neg = ", ".join(x for x in (sp["negative"], sm.get("negative", ""), v.get("negative", "")) if x)
    return " ".join(" ".join(t.split()) for t in text), " ".join(neg.split())

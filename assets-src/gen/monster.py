"""Monster sheets: one Gemini request per monster type -> idle | attack | hurt (docs/ART_MONSTERS_PLAN.md).

Kept apart from the character code so character prompts, guides and cache keys cannot change.

  guide(band, floating)        1680x720 layout guide: per cell a light-grey size box, ground line, facing arrow
  prompt(m, band, n_images)    the request text
  cut(raw, band, floating)     raw render -> three frames in the band's square output cell
  recolor(frame, variant)      palette-swap variant of an approved frame (no extra images)
"""
from __future__ import annotations

import colorsys

import numpy as np
from PIL import Image, ImageDraw

from gen import pixelize as PX
from gen import spec as S

GUIDE_BOX = (200, 200, 200)
GUIDE_LINE = (150, 150, 150)
GUIDE_ARROW = (120, 120, 120)
HEIGHT_TOLERANCE = 0.10   # figures within 10% of the height band are kept at 1:1
STRAY_FRAC = 0.04     # drop separate blobs smaller than this share of the largest blob (sparks, stray pixels)


# ───────────────────────────── guide ─────────────────────────────

def box_px(band: S.MonsterBand, pitch: float = S.MONSTER_EXPECTED_PITCH) -> tuple[int, int]:
    """Size box (guide px) for the band's top figure height, capped to fit the cell with margins."""
    cw, ch = S.MONSTER_GUIDE_CELL
    side = band.height[1] * pitch
    return int(min(side, cw - 40)), int(min(side, ch - 60))


def guide(band: S.MonsterBand, floating: bool = False) -> Image.Image:
    cw, ch = S.MONSTER_GUIDE_CELL
    img = Image.new("RGB", (cw * 3, ch), (255, 255, 255))
    d = ImageDraw.Draw(img)
    bw, bh = box_px(band)
    ground = ch - 40
    for i in range(3):
        x0 = i * cw + (cw - bw) // 2
        y1 = ground - (60 if floating else 0)
        d.rectangle([x0, y1 - bh, x0 + bw, y1], fill=GUIDE_BOX)
        if not floating:
            d.line([i * cw + 20, ground, (i + 1) * cw - 20, ground], fill=GUIDE_LINE, width=4)
        ax, ay = x0 + bw // 2, y1 - bh - 22          # facing arrow above the box, pointing right (toward the party)
        d.line([ax - 50, ay, ax + 40, ay], fill=GUIDE_ARROW, width=8)
        d.polygon([(ax + 60, ay), (ax + 36, ay - 16), (ax + 36, ay + 16)], fill=GUIDE_ARROW)
    return img


# ───────────────────────────── prompt ─────────────────────────────

def prompt(m: dict, band: S.MonsterBand, has_design_ref: bool) -> str:
    face = m.get("face") or ("its face (eyes, mouth or muzzle) is clearly readable in every cell, drawn at the same "
                             "sprite-pixel size as the body")
    ref = ("Image 3 is the DESIGN REFERENCE: our current sprite of this exact creature. Keep its design, colours, "
           "silhouette and equipment; redraw it as larger, more detailed modern pixel art.\n\n") if has_design_ref else ""
    return (
        "Create a 3x1 sprite sheet for a modern 16-bit-style pixel-art RPG: one MONSTER in three battle poses.\n\n"
        "Image 1 is a LAYOUT GUIDE: three cells on white. In each cell the light-grey box shows where the monster "
        "stands and how big it is, the grey line is the ground, and the arrow shows the facing: the monster faces "
        "RIGHT, toward the heroes. Draw the SAME monster once in every cell, filling its box. Never draw the grey box, "
        "line or arrow.\n\n"
        "Image 2 is the HOUSE STYLE: an approved hero sprite sheet from this same game. Match its sprite-pixel size, "
        "black outlines, flat shading with 2-3 tones per colour and level of detail exactly, but do NOT copy the hero; "
        "it is a different character.\n\n"
        + ref +
        f"Render as true pixel art: the monster about {band.height[0]}-{band.height[1]} pixels tall in sprite pixels, "
        "every sprite pixel a hard-edged square, no anti-aliasing, no gradients.\n\n"
        f"Monster: {m['prompt'].strip()}. Keep every detail identical in every cell. FACE: {face}.\n\n"
        "Cells:\n"
        "- left cell: idle, a ready battle stance facing right.\n"
        f"- middle cell: attack, {m['attack'].strip()}, facing right.\n"
        f"- right cell: hurt, {m['hurt'].strip()}, recoiling away from the heroes (leaning left), still facing right.\n\n"
        "One monster per cell and nothing else: no props on the ground, no effects outside the monster, no text.\n"
        "Background: solid flat magenta (#FF00FF) everywhere, no floor, no shadows, no borders.\n"
        f"Avoid: {S.MONSTER_NEGATIVE}{', ' + m['extra_negative'] if m.get('extra_negative') else ''}."
    )


# ───────────────────────────── cut ─────────────────────────────

def _figure_mask(rgb: np.ndarray) -> np.ndarray:
    """Foreground of one cell. Background = magenta (the requested key) plus anything near-white or magenta connected
    to the cell border (Gemini sometimes draws magenta panels on a white page). Then keep the main figure: the largest
    blob and any blob overlapping its bounding box (staffs, held items); drop stray blobs outside it (shadows)."""
    bg = PX.magenta_bg(rgb)
    near_white = rgb.min(axis=2) > 225
    border_bg = PX.flood_bg(np.where((bg | near_white)[..., None], 255, 0).astype(np.uint8).repeat(3, 2), 10.0)
    fg = ~(bg | (near_white & border_bg))
    fg &= ~PX.magenta_fringe(rgb, fg)
    lab, n = PX.components(fg)
    if n == 0:
        return fg
    sizes = np.bincount(lab.ravel())[1:]
    main = int(sizes.argmax()) + 1
    ys, xs = np.where(lab == main)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = [main]
    for i in range(1, n + 1):
        if i == main or sizes[i - 1] < 3:
            continue
        cy, cx = np.where(lab == i)
        inside = (cy.min() <= y1) and (cy.max() >= y0) and (cx.min() <= x1) and (cx.max() >= x0)
        if inside and sizes[i - 1] >= STRAY_FRAC * sizes.max() * 0.25:
            keep.append(i)
    return np.isin(lab, keep)


def native_art(raw: Image.Image) -> tuple[Image.Image, dict]:
    """One pixel per sprite pixel: Gemini's own grid when detectable, else an area-average at the expected pitch."""
    rgb = np.asarray(raw.convert("RGB"))
    _, info = PX.clean_resample(raw, raw.size, min_conf=0.45)
    if info.get("native") is None and 4.0 <= info.get("pitch", 0) <= 8.0 and info.get("confidence", 0) >= 0.25:
        # weak but plausible grid (large figures): point-sample at Gemini's own pitch rather than averaging blur
        _, info = PX.clean_resample(raw, raw.size, min_conf=0.25)
        info["weak_grid"] = True
    meta = {k: v for k, v in info.items() if k != "native"}
    meta["raw_size"] = raw.size
    if info.get("native") is not None:
        meta["mode"] = "grid"
        return info["native"], meta
    pitch = S.MONSTER_EXPECTED_PITCH * raw.width / (S.MONSTER_GUIDE_CELL[0] * 3)
    meta["mode"] = f"no grid, area-averaged at {pitch:.2f} px"
    size = (max(1, round(rgb.shape[1] / pitch)), max(1, round(rgb.shape[0] / pitch)))
    return Image.fromarray(rgb).resize(size, Image.Resampling.BOX), meta


def cut(raw: Image.Image, band: S.MonsterBand, floating: bool = False, colors: int = 16,
        seed: int = 0) -> tuple[list[Image.Image], dict]:
    native, info = native_art(raw)
    a = np.asarray(native.convert("RGB"))
    h, w, _ = a.shape
    cells = [a[:, round(i * w / 3):round((i + 1) * w / 3)] for i in range(3)]
    masks = [_figure_mask(c) for c in cells]
    heights = []
    for m in masks:
        ys = np.where(m.any(1))[0]
        heights.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
    tallest = max(heights) or 1
    lo, hi = band.height
    # keep Gemini's pixels 1:1 unless the figure is clearly outside the band (rescaling by a few % drops or doubles
    # single pixel rows); far outside, nearest-neighbour scale to the band edge
    f = hi / tallest if tallest > hi * (1 + HEIGHT_TOLERANCE) else lo / tallest if tallest < lo * (1 - HEIGHT_TOLERANCE) else 1.0
    info.update({"native_heights": heights, "scale": round(f, 3), "art_cell": (round(w / 3, 1), h)})

    scaled, smasks = [], []
    for c, m in zip(cells, masks):
        size = (max(1, round(c.shape[1] * f)), max(1, round(c.shape[0] * f)))
        scaled.append(np.asarray(Image.fromarray(c).resize(size, Image.Resampling.NEAREST)))
        smasks.append(np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(size, Image.Resampling.NEAREST)) > 0)
    pixel_sets = [s[m] for s, m in zip(scaled, smasks)]
    detail = np.concatenate([s[PX.detail_mask(s, m, 1.0)] for s, m in zip(scaled, smasks)])
    palette = PX.sheet_palette(pixel_sets, colors, seed, detail_px=detail)

    figs = []
    for s, m in zip(scaled, smasks):
        art = s.copy()
        art[~m] = (255, 0, 255)            # only the kept figure: background and dropped blobs become key colour
        fig, _ = PX.pixelize_native(Image.fromarray(art), m, (art.shape[1], art.shape[0]), colors=colors, seed=seed,
                                    palette=palette)
        figs.append(np.asarray(fig))

    def bbox(fig: np.ndarray) -> tuple[int, int, int, int]:
        ys, xs = np.where(fig[..., 3] > 0)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

    c = band.cell
    ix0, iy0, ix1, iy1 = bbox(figs[0])
    dx = c // 2 - (ix0 + ix1 + 1) // 2           # one horizontal shift for all frames (keeps lunges and recoils)
    dy_shared = band.foot_row - iy1
    frames, clipped = [], []
    for k, fig in enumerate(figs):
        x0, y0, x1, y1 = bbox(fig)
        dy = dy_shared if floating else band.foot_row - y1
        out = np.zeros((c, c, 4), np.uint8)
        sx0, sy0 = max(0, -dx), max(0, -dy)
        tx0, ty0 = max(0, dx), max(0, dy)
        ww = min(fig.shape[1] - sx0, c - tx0)
        hh = min(fig.shape[0] - sy0, c - ty0)
        out[ty0:ty0 + hh, tx0:tx0 + ww] = fig[sy0:sy0 + hh, sx0:sx0 + ww]
        if (x0 + dx < 0 or x1 + dx >= c or y0 + dy < 0 or y1 + dy >= c):
            clipped.append(S.MONSTER_POSES[k])
        frames.append(Image.fromarray(out, "RGBA"))
    info["clipped"] = clipped
    return frames, info


def frame_report(frames: list[Image.Image], band: S.MonsterBand) -> dict:
    """Measured acceptance numbers (plan: height band, feet row, colours, outline, pose difference)."""
    arr = [np.asarray(f) for f in frames]
    alpha = [x[..., 3] > 0 for x in arr]
    heights, bottoms, colours = [], [], []
    for x, m in zip(arr, alpha):
        ys = np.where(m.any(1))[0]
        heights.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
        bottoms.append(int(ys.max()) if len(ys) else -1)
        colours.append(len({tuple(c) for c in x[m][:, :3].tolist()}))
    idle = alpha[0].sum() or 1
    diff = [round(float((alpha[0] ^ alpha[k]).sum()) / idle, 2) for k in (1, 2)]
    outline = all((x[m][:, :3] == np.array(PX.OUTLINE)).all(1).any() for x, m in zip(arr, alpha))
    return {"heights": heights, "bottoms": bottoms, "colours": max(colours), "outline": outline,
            "pose_diff": diff,
            "height_ok": all(band.height[0] * (1 - HEIGHT_TOLERANCE) <= hh <= band.height[1] * (1 + HEIGHT_TOLERANCE)
                             for hh in heights),
            "diff_ok": all(d >= 0.15 for d in diff)}


# ───────────────────────────── palette swaps ─────────────────────────────

def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def recolor(frame: Image.Image, variant: dict) -> Image.Image:
    """Variant of an approved frame. `map`: exact colour replacements ("#rrggbb": "#rrggbb"). `hue` (degrees) / `sat`
    (factor): shift every colour except the outline. Results are snapped to 15-bit like all sprite colours."""
    a = np.asarray(frame.convert("RGBA")).copy()
    vis = a[..., 3] > 0
    outline = np.all(a[..., :3] == np.array(PX.OUTLINE), axis=2)
    for src, dst in (variant.get("map") or {}).items():
        hit = vis & np.all(a[..., :3] == np.array(_hex(src)), axis=2)
        a[hit, :3] = _hex(dst)
    if variant.get("hue") or variant.get("sat"):
        dh = float(variant.get("hue", 0)) / 360.0
        sat = float(variant.get("sat", 1.0))
        sel = vis & ~outline
        cols = {tuple(c) for c in a[sel][:, :3].tolist()}
        lut = {}
        for c in cols:
            hh, ss, vv = colorsys.rgb_to_hsv(*(v / 255.0 for v in c))
            r, g, b = colorsys.hsv_to_rgb((hh + dh) % 1.0, min(1.0, ss * sat), vv)
            lut[c] = tuple(int(x) for x in PX.snap15(np.array([r * 255, g * 255, b * 255])))
        flat = a[..., :3].reshape(-1, 3)
        m = sel.reshape(-1)
        flat[m] = np.array([lut[tuple(c)] for c in flat[m].tolist()], np.uint8)
    return Image.fromarray(a, "RGBA")

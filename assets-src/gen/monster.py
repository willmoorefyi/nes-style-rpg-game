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

def prompt(m: dict, band: S.MonsterBand, has_design_ref: bool, has_monster_ref: bool = False) -> str:
    face = m.get("face") or ("its face (eyes, mouth or muzzle) is clearly readable in every cell, drawn at the same "
                             "sprite-pixel size as the body")
    ref = ("Image 3 is the DESIGN REFERENCE: our current sprite of this exact creature. Keep its design, colours, "
           "silhouette and equipment; redraw it as larger, more detailed modern pixel art.\n\n") if has_design_ref else ""
    if has_monster_ref:   # prompt rev 3: an approved monster from this game instead of our old sprite
        ref = ("Image 3 is an APPROVED MONSTER sheet from this same game (a DIFFERENT monster, idle | attack | hurt): "
               "match its sprite-pixel size, rendering, shading, outline weight and level of detail, and how much the "
               "poses move. Do NOT copy that monster's body, colours or equipment.\n\n")
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
        + (ACTION_3 if m.get("prompt_rev", 2) >= 2 else "") +
        "One monster per cell and nothing else: no props on the ground, no effects outside the monster, no text.\n"
        "Background: solid flat magenta (#FF00FF) everywhere, no floor, no shadows, no borders.\n"
        f"Avoid: {S.MONSTER_NEGATIVE}{', ' + m['extra_negative'] if m.get('extra_negative') else ''}."
    )


def pose_guide(band: S.MonsterBand, floating: bool = False) -> Image.Image:
    """Square single-pose guide (per-pose bosses): size box for the band's top height, ground line, facing arrow."""
    w, h = S.MONSTER_POSE_GUIDE
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    side = int(min(band.height[1] * S.MONSTER_EXPECTED_PITCH, h - 110))
    ground = h - 40
    x0, y1 = (w - side) // 2, ground - (60 if floating else 0)
    d.rectangle([x0, y1 - side, x0 + side, y1], fill=GUIDE_BOX)
    if not floating:
        d.line([30, ground, w - 30, ground], fill=GUIDE_LINE, width=5)
    ax, ay = x0 + side // 2, y1 - side - 26
    d.line([ax - 70, ay, ax + 50, ay], fill=GUIDE_ARROW, width=10)
    d.polygon([(ax + 76, ay), (ax + 46, ay - 20), (ax + 46, ay + 20)], fill=GUIDE_ARROW)
    return img


def pose_prompt(m: dict, band: S.MonsterBand, pose: str, has_identity: bool) -> str:
    face = m.get("face") or "its face is clearly readable, drawn at the same sprite-pixel size as the body"
    action = {"idle": "idle, a ready battle stance", "attack": m["attack"].strip(),
              "cast": (m.get("cast") or "casting a spell, one hand raised with magic gathering").strip(),
              "hurt": m["hurt"].strip() + ", recoiling away from the heroes (leaning left), still facing right"}[pose]
    identity = ("Image 3 is the APPROVED LOOK of this exact boss in its idle pose (pixel art). Keep the identical "
                "design, armour, colours, proportions and size; only the pose changes.\n\n") if has_identity else ""
    # action poses: the look without static staging details (e.g. mist), plus direction for movement
    look = (m.get("action_prompt") or m["prompt"]) if pose != "idle" else m["prompt"]
    motion = ("" if pose == "idle" else
              "MOVEMENT: this is a dramatic ACTION frame of a huge, intimidating boss, not a static stance. Use a "
              "strong diagonal line of action through the whole body, shift the weight clearly onto one leg, twist "
              "the torso, extend the limbs and weapon far from the body, and let the mantle and loose armour edges "
              "fly with the motion. The silhouette must be very different from the idle reference. Limbs, mantle "
              "and weapon may reach beyond the sides of the grey box. No mist, smoke or ground effects.\n\n")
    return (
        "Create ONE large boss monster sprite for a modern 16-bit-style pixel-art RPG battle (a single figure).\n\n"
        "Image 1 is a LAYOUT GUIDE: the light-grey box shows where the boss stands and how big it is (fill the box), "
        "the grey line is the ground, and the arrow shows the facing: the boss faces RIGHT, toward the heroes. Never "
        "draw the grey box, line or arrow.\n\n"
        "Image 2 is the HOUSE STYLE: an approved hero sprite sheet from this same game. Match its sprite-pixel size, "
        "black outlines, crisp cel shading and level of detail exactly, but do NOT copy the hero.\n\n"
        + identity +
        f"Render as true pixel art: the boss about {band.height[0]}-{band.height[1]} pixels tall in sprite pixels, "
        "every sprite pixel a hard-edged square, no anti-aliasing, no gradients, rich detail and 3-4 tones per "
        "colour like a premium modern pixel-art boss.\n\n"
        f"Boss: {look.strip()}. FACE: {face}.\n\n"
        f"Pose: {action}, facing right.\n\n"
        + motion +
        "Only the boss: no other characters, no scenery, no floor tiles, no text.\n"
        "Background: solid flat magenta (#FF00FF) everywhere, no shadows, no borders, no panels.\n"
        f"Avoid: {S.MONSTER_NEGATIVE}{', ' + m['extra_negative'] if m.get('extra_negative') else ''}."
    )


# prompt rev 2 (after the goblin / ogre approvals): the boss pilots showed static poses read as stiff
ACTION_3 = ("MOVEMENT: the attack and hurt cells are dramatic ACTION frames, not static stances. Use a strong diagonal "
            "line of action through the whole body, shift the weight clearly onto one side, twist the torso, extend "
            "limbs, jaws or weapon far from the body, and let hair, cloth, wings or tails move with the motion. Each "
            "of the three silhouettes must be clearly different. No mist, smoke or ground effects.\n\n")


# ───────────────────────────── cut ─────────────────────────────

def _haze(rgb: np.ndarray) -> np.ndarray:
    """Pale magenta-tinted pixels: semi-transparent effects (mist, glow) Gemini blended into the key colour."""
    f = rgb.astype(np.int32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    return (r - g > 10) & (b - g > 30) & (np.minimum(r, b) > 130)


def _painted_panel(rgb: np.ndarray, bg: np.ndarray, tol: int = 12) -> np.ndarray:
    """A copied guide box: Gemini sometimes paints the grey size box (or a pink-tinted version of it) behind the
    monster. Find the most common pale, flat colour touching the background and flood it from the background; the
    monster's black outline stops the flood."""
    f = rgb.astype(np.int32)
    ring = np.zeros_like(bg)
    ring[1:] |= bg[:-1]; ring[:-1] |= bg[1:]; ring[:, 1:] |= bg[:, :-1]; ring[:, :-1] |= bg[:, 1:]
    ring &= ~bg & (f.min(axis=2) > 140)
    if ring.sum() < 40:
        return np.zeros_like(bg)
    cols, counts = np.unique((f[ring] // 8) * 8, axis=0, return_counts=True)
    panel = cols[counts.argmax()] + 4
    near = np.abs(f - panel).max(axis=2) <= tol
    if near.sum() < 0.03 * bg.size:            # a few pale pixels on the figure's edge, not a painted box
        return np.zeros_like(bg)
    seed = np.where((near | bg)[..., None], 255, 0).astype(np.uint8).repeat(3, 2)
    return PX.flood_bg(seed, 10.0) & near


def _figure_mask(rgb: np.ndarray, haze: bool = False) -> np.ndarray:
    """Foreground of one cell. Background = magenta (the requested key) plus anything near-white or magenta connected
    to the cell border (Gemini sometimes draws magenta panels on a white page). Then keep the main figure: the largest
    blob and any blob overlapping its bounding box (staffs, held items); drop stray blobs outside it (shadows)."""
    bg = PX.magenta_bg(rgb)
    if haze:   # opt-in (monsters.yaml `haze: true`): blended mist touching the background is background too
        bg = bg | _haze(rgb)
    near_white = rgb.min(axis=2) > 225
    f = rgb.astype(np.int32)
    guide_grey = (np.abs(f - np.array(GUIDE_BOX)).max(2) < 14) | (np.abs(f - np.array(GUIDE_ARROW)).max(2) < 14)
    loose = near_white | guide_grey          # page / copied guide shapes: background where connected to the border
    border_bg = PX.flood_bg(np.where((bg | loose)[..., None], 255, 0).astype(np.uint8).repeat(3, 2), 10.0)
    fg = ~(bg | (loose & border_bg))
    fg &= ~_painted_panel(rgb, ~fg)
    fg &= ~PX.magenta_fringe(rgb, fg)
    lab, n = PX.components(fg)
    if n == 0:
        return fg
    sizes = np.bincount(lab.ravel())[1:]
    main = int(sizes.argmax()) + 1
    ys, xs = np.where(lab == main)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = [main]
    pad = int(0.15 * (y1 - y0 + 1))     # floating parts of the figure (a spell crystal over a hand) sit just outside
    h, w = fg.shape
    for i in range(1, n + 1):
        if i == main or sizes[i - 1] < 3:
            continue
        cy, cx = np.where(lab == i)
        bw, bh = cx.max() - cx.min() + 1, cy.max() - cy.min() + 1
        if min(bw, bh) <= 2 and max(bw, bh) >= 6:      # panel borders / divider lines Gemini drew
            continue
        if cx.min() == 0 or cx.max() == w - 1:          # bleed from the neighbouring cell (slash arcs, effects)
            continue
        inside = (cy.min() <= y1) and (cy.max() >= y0) and (cx.min() <= x1) and (cx.max() >= x0)
        near = (cy.max() >= y0 - pad) and (cy.min() <= y1 + pad) and (cx.max() >= x0 - pad) and (cx.min() <= x1 + pad)
        if (inside and sizes[i - 1] >= STRAY_FRAC * sizes.max() * 0.25) or (near and sizes[i - 1] >= 0.004 * sizes.max()):
            keep.append(i)
    return np.isin(lab, keep)


def native_art(raw: Image.Image, guide_width: int = S.MONSTER_GUIDE_CELL[0] * 3) -> tuple[Image.Image, dict]:
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
    pitch = S.MONSTER_EXPECTED_PITCH * raw.width / guide_width
    meta["mode"] = f"no grid, area-averaged at {pitch:.2f} px"
    size = (max(1, round(rgb.shape[1] / pitch)), max(1, round(rgb.shape[0] / pitch)))
    return Image.fromarray(rgb).resize(size, Image.Resampling.BOX), meta


def cut(raw: Image.Image, band: S.MonsterBand, floating: bool = False, colors: int = 16,
        seed: int = 0, n_cells: int = 3, cell: int | None = None,
        foot_row: int | None = None, haze: bool = False) -> tuple[list[Image.Image], dict]:
    """`cell` / `foot_row` override the band's output cell (per-pose bosses use a larger cell)."""
    native, info = native_art(raw, guide_width=S.MONSTER_GUIDE_CELL[0] * n_cells if n_cells == 3 else S.MONSTER_POSE_GUIDE[0])
    a = np.asarray(native.convert("RGB"))
    h, w, _ = a.shape
    cells = [a[:, round(i * w / n_cells):round((i + 1) * w / n_cells)] for i in range(n_cells)]
    masks = [_figure_mask(c, haze) for c in cells]
    heights = []
    for m in masks:
        ys = np.where(m.any(1))[0]
        heights.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
    tallest = max(heights) or 1
    lo, hi = band.height
    if foot_row is not None:
        hi = max(hi, foot_row + 1)        # larger per-pose cells: use their full height before rescaling
    # keep Gemini's pixels 1:1 unless the figure is clearly outside the band (rescaling by a few % drops or doubles
    # single pixel rows); far outside, nearest-neighbour scale to the band edge
    f = hi / tallest if tallest > hi * (1 + HEIGHT_TOLERANCE) else lo / tallest if tallest < lo * (1 - HEIGHT_TOLERANCE) else 1.0
    info.update({"native_heights": heights, "scale": round(f, 3), "art_cell": (round(w / n_cells, 1), h)})

    if f < 1.0:
        # shrinking: re-pixelize from the full-resolution render (block vote with facial-detail protection) instead of
        # dropping whole sprite pixels, as the character resample path does
        rgb_raw = np.asarray(raw.convert("RGB"))
        rh, rw, _ = rgb_raw.shape
        raw_cells = [rgb_raw[:, round(i * rw / n_cells):round((i + 1) * rw / n_cells)] for i in range(n_cells)]
        raw_masks = [np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((rc.shape[1], rc.shape[0]),
                                Image.Resampling.NEAREST)) > 0 for rc, m in zip(raw_cells, masks)]
        detail = np.concatenate([rc[PX.detail_mask(rc, rm, rc.shape[0] / max(1, c0.shape[0]))]
                                 for rc, rm, c0 in zip(raw_cells, raw_masks, cells)])
        palette = PX.sheet_palette([rc[rm] for rc, rm in zip(raw_cells, raw_masks)], colors, seed, detail_px=detail)
        figs = []
        for rc, rm, c0 in zip(raw_cells, raw_masks, cells):
            grid = (max(1, round(c0.shape[1] * f)), max(1, round(c0.shape[0] * f)))
            art = rc.copy()
            art[~rm] = (255, 0, 255)
            figs.append(np.asarray(PX.pixelize(Image.fromarray(art), rm, grid, colors=colors, seed=seed,
                                               palette=palette)))
        info["shrink"] = "re-pixelized from the render"
    else:
        scaled, smasks = [], []
        for c0, m in zip(cells, masks):
            size = (max(1, round(c0.shape[1] * f)), max(1, round(c0.shape[0] * f)))
            scaled.append(np.asarray(Image.fromarray(c0).resize(size, Image.Resampling.NEAREST)))
            smasks.append(np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(size, Image.Resampling.NEAREST)) > 0)
        pixel_sets = [s0[m] for s0, m in zip(scaled, smasks)]
        detail = np.concatenate([s0[PX.detail_mask(s0, m, 1.0)] for s0, m in zip(scaled, smasks)])
        palette = PX.sheet_palette(pixel_sets, colors, seed, detail_px=detail)
        figs = []
        for s0, m in zip(scaled, smasks):
            art = s0.copy()
            art[~m] = (255, 0, 255)        # only the kept figure: background and dropped blobs become key colour
            fig, _ = PX.pixelize_native(Image.fromarray(art), m, (art.shape[1], art.shape[0]), colors=colors,
                                        seed=seed, palette=palette)
            figs.append(np.asarray(fig))

    def bbox(fig: np.ndarray) -> tuple[int, int, int, int]:
        ys, xs = np.where(fig[..., 3] > 0)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

    c = cell or band.cell
    foot = foot_row if foot_row is not None else band.foot_row
    ix0, iy0, ix1, iy1 = bbox(figs[0])
    # cell width: the band's square cell, widened (height unchanged) when a lunge or a long body needs more room;
    # one horizontal shift for all frames keeps lunges and recoils relative to the idle pose
    lo_x = min(bbox(fg_)[0] for fg_ in figs)
    hi_x = max(bbox(fg_)[2] for fg_ in figs)
    cw = max(c, hi_x - lo_x + 1 + 4)
    cw += cw % 2
    dx = cw // 2 - (ix0 + ix1 + 1) // 2
    if lo_x + dx < 2 or hi_x + dx > cw - 3:
        dx = 2 - lo_x if lo_x + dx < 2 else cw - 3 - hi_x
    dy_shared = foot - iy1
    frames, clipped = [], []
    info["cell_px"] = (cw, c)
    for k, fig in enumerate(figs):
        x0, y0, x1, y1 = bbox(fig)
        dy = dy_shared if floating else foot - y1
        out = np.zeros((c, cw, 4), np.uint8)
        sx0, sy0 = max(0, -dx), max(0, -dy)
        tx0, ty0 = max(0, dx), max(0, dy)
        ww = min(fig.shape[1] - sx0, cw - tx0)
        hh = min(fig.shape[0] - sy0, c - ty0)
        out[ty0:ty0 + hh, tx0:tx0 + ww] = fig[sy0:sy0 + hh, sx0:sx0 + ww]
        if (x0 + dx < 0 or x1 + dx >= cw or y0 + dy < 0 or y1 + dy >= c):
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
    diff = [round(float((alpha[0] ^ alpha[k]).sum()) / idle, 2) for k in range(1, len(alpha))]
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
    (factor) / `val` (brightness factor): shift every colour except the outline. Results are snapped to 15-bit like all sprite colours."""
    a = np.asarray(frame.convert("RGBA")).copy()
    vis = a[..., 3] > 0
    outline = np.all(a[..., :3] == np.array(PX.OUTLINE), axis=2)
    for src, dst in (variant.get("map") or {}).items():
        hit = vis & np.all(a[..., :3] == np.array(_hex(src)), axis=2)
        a[hit, :3] = _hex(dst)
    if variant.get("hue") or variant.get("sat") or variant.get("val"):
        dh = float(variant.get("hue", 0)) / 360.0
        sat = float(variant.get("sat", 1.0))
        val = float(variant.get("val", 1.0))
        sel = vis & ~outline
        cols = {tuple(c) for c in a[sel][:, :3].tolist()}
        lut = {}
        for c in cols:
            hh, ss, vv = colorsys.rgb_to_hsv(*(v / 255.0 for v in c))
            r, g, b = colorsys.hsv_to_rgb((hh + dh) % 1.0, min(1.0, ss * sat), min(1.0, vv * val))
            lut[c] = tuple(int(x) for x in PX.snap15(np.array([r * 255, g * 255, b * 255])))
        flat = a[..., :3].reshape(-1, 3)
        m = sel.reshape(-1)
        flat[m] = np.array([lut[tuple(c)] for c in flat[m].tolist()], np.uint8)
    return Image.fromarray(a, "RGBA")

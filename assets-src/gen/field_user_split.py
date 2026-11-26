"""Pass PT (docs/PLAYTEST_ART_PLAN.md 4.1 steps 1-6): the pieces of gen/field_user.py's import: the figure mask
(alpha, magenta or a flat background), the big-pixel resample, the three row bands and three figures per band, the
padded crops, the off-band Box resample and the placement helpers."""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import pixelize as PX

GW, GH = 48, 96
SPECK, JOIN, ROW_GAP = 24, 0.5, 2


def figure_mask(img: Image.Image) -> tuple[np.ndarray, np.ndarray, str]:
    """(rgb, figure mask, background mode): the render's alpha when it has a transparent px, else a flat colour flooded
    from the corners (magenta keyed with its fringe). A render with neither is refused."""
    a = np.asarray(img)
    rgb = a[..., :3].copy()
    if (a[..., 3] < 128).any():
        return rgb, a[..., 3] >= 128, "alpha"
    if PX.is_magenta_bg(rgb):
        bg = PX.magenta_bg(rgb)
        return rgb, ~(bg | PX.magenta_fringe(rgb, ~bg)), "magenta"
    corners = rgb[[0, 0, -1, -1], [0, -1, 0, -1]].astype(int)
    if np.ptp(corners, axis=0).max() > 24:
        raise SystemExit(f"user sheet: no alpha and no flat background (corners {corners.tolist()})")
    return rgb, ~PX.flood_bg(rgb, 24), "flat"


def native(img: Image.Image) -> tuple[Image.Image, dict]:
    """A render not at 144 x 288 drawn as big pixels is point-sampled at every art pixel's centre (PX.detect_pitch's
    grid, as PX.clean_resample does), RGBA so a transparent background stays transparent."""
    if img.size == (3 * GW, 3 * GH):
        return img, {"pitch": 1.0}
    a = np.asarray(img)
    pitch, phx, phy, conf = PX.detect_pitch(a[..., :3])
    if conf < 0.5:
        return img, {"pitch": None, "pitch_conf": round(conf, 3)}
    cx = np.arange(phx + pitch / 2, img.width, pitch).astype(int)
    cy = np.arange(phy + pitch / 2, img.height, pitch).astype(int)
    out = a[np.ix_(cy[cy < img.height], cx[cx < img.width])]
    return Image.fromarray(np.ascontiguousarray(out)), {"pitch": round(float(pitch), 3), "pitch_conf": round(conf, 3)}


def bands(m: np.ndarray) -> list[tuple[int, int]]:
    """The opaque row bands, split at runs of >= ROW_GAP empty rows; exactly 3 or refused."""
    rows = m.any(1)
    out, y, h = [], 0, len(rows)
    while y < h:
        if not rows[y]:
            y += 1
            continue
        y0 = y
        while y < h and (rows[y] or (y + ROW_GAP <= h and rows[y:y + ROW_GAP].any())):
            y += 1
        out.append((y0, y))
    if len(out) != 3:
        raise SystemExit(f"user sheet: {len(out)} row bands, need exactly 3 (front, back, side)")
    return out


def pieces(m: np.ndarray, band: tuple[int, int]) -> list[np.ndarray]:
    """The band's figures left to right as masks over the whole sheet: 8-connected pieces >= SPECK px; a smaller piece
    whose x-range overlaps a figure's by >= JOIN of its own width joins it (a staff tip). Exactly 3 or refused."""
    from gen.anim_efix import pieces8
    sub = np.zeros_like(m)
    sub[band[0]:band[1]] = m[band[0]:band[1]]
    ps = pieces8(sub)
    big = [p for p in ps if len(p) >= SPECK]
    if len(big) != 3:
        raise SystemExit(f"user sheet: rows {band[0]}-{band[1]} hold {len(big)} figures of >= {SPECK} px, need 3")
    masks = []
    for p in sorted(big, key=lambda p: min(x for _, x in p)):
        mm = np.zeros_like(m)
        mm[tuple(np.array(p).T)] = True
        masks.append(mm)
    for p in ps:
        if len(p) >= SPECK:
            continue
        xs = np.array([x for _, x in p])
        for mm in masks:
            fx = np.where(mm.any(0))[0]
            ov = min(xs.max(), fx.max()) - max(xs.min(), fx.min()) + 1
            if ov >= JOIN * (xs.max() - xs.min() + 1):
                mm[tuple(np.array(p).T)] = True
                break
    return masks


def crop(rgb: np.ndarray, m: np.ndarray) -> tuple[np.ndarray, np.ndarray, tuple[int, int]]:
    """(rgb, mask) of a figure padded by 2 px, and its sheet origin (x, y) of the padded crop."""
    ys, xs = np.where(m)
    y0, x0 = ys.min() - 2, xs.min() - 2
    mm = np.zeros((ys.max() - ys.min() + 5, xs.max() - xs.min() + 5), bool)
    mm[ys - y0, xs - x0] = True
    rc = np.zeros((*mm.shape, 3), np.uint8)
    rc[mm] = rgb[ys, xs]
    return rc, mm, (int(x0), int(y0))


def height(m: np.ndarray) -> int:
    return int(np.ptp(np.where(m.any(1))[0]) + 1)


def in_cell(mm: np.ndarray, r: int, c: int) -> bool:
    """The figure lies inside its own 48 x 96 cell of the 3 x 3 grid, >= 1 px from the cell's sides (else the
    centring rule places it)."""
    ys, xs = np.where(mm)
    return c * GW + 1 <= xs.min() and xs.max() <= (c + 1) * GW - 2 and r * GH <= ys.min() and ys.max() < (r + 1) * GH


def resample(rc: np.ndarray, mm: np.ndarray, s: float) -> tuple[np.ndarray, np.ndarray]:
    """s == 1: the crop as is. Else npc_field_cut.down's settings: a Box resample of the premultiplied crop by s,
    UnsharpMask(1, 60, 2), alpha >= 170; the result goes through the 1:1 quantizer like a native render."""
    if s == 1.0:
        return rc, mm
    from PIL import ImageFilter
    h, w = mm.shape
    size = (max(1, round(w * s)), max(1, round(h * s)))
    rgba = np.dstack([rc, mm * 255]).astype(np.float32)
    rgba[..., :3] *= rgba[..., 3:4] / 255
    sm = np.asarray(Image.fromarray(rgba.astype(np.uint8)).resize(size, Image.Resampling.BOX)).astype(np.float32)
    a = sm[..., 3]
    col = np.where(a[..., None] > 0, sm[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
    col = np.asarray(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(1, 60, 2)))
    m2 = a > 170
    pad = np.zeros((size[1] + 4, size[0] + 4), bool)
    pad[2:-2, 2:-2] = m2
    out = np.zeros((*pad.shape, 3), np.uint8)
    out[2:-2, 2:-2][m2] = col[m2]
    return out, pad


def upper_cx(a: np.ndarray) -> float:
    """The mean x of the figure's opaque px above 60 % of its height (head and shoulders)."""
    ys, xs = np.where(a[..., 3] > 0)
    return float(xs[ys < ys.min() + 0.6 * (ys.max() - ys.min() + 1)].mean())

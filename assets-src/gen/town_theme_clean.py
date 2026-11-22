"""AR-W3: the crack clean-up of a town-theme module cut (Lufenia's stucco, docs/TOWN_THEMES.md 7).

SD3.5 paints hairline cracks into pale walls and domes even with a no-cracks negative. After the cut (48 px per cell,
15-bit colours) `clean` repaints the thin pale-grey lines over the pale wall with the most common pale colour round
them: a pixel is a crack candidate when it is grey (max - min < `sat`) and mid-light (`lo` <= max <= `hi`); it is
kept when it lies on a straight vertical or horizontal run of at least `run` darker pixels (pilaster edges, storey
bands, frames), or when candidates fill more than `share` of its (2k+1)^2 window (a shaded area, not a line).
Saturated pixels (gold ribs, glass, terracotta, cyan) and the dark ink are never touched. Deterministic.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

DEFAULTS = {"lo": 80, "hi": 228, "sat": 48, "run": 9, "share": 0.45, "k": 3}


def _runs(m: np.ndarray, n: int) -> np.ndarray:
    """True where m lies on a vertical run (along axis 0) of at least n."""
    out = np.zeros_like(m)
    for x in range(m.shape[1]):
        col, y = m[:, x], 0
        while y < len(col):
            if not col[y]:
                y += 1
                continue
            e = y
            while e < len(col) and col[e]:
                e += 1
            if e - y >= n:
                out[y:e, x] = True
            y = e
    return out


def clean(img: Image.Image, **opt) -> Image.Image:
    o = DEFAULTS | opt
    a = np.asarray(img.convert("RGBA")).copy()
    rgb, solid = a[..., :3].astype(int), a[..., 3] > 0
    mx, mn = rgb.max(-1), rgb.min(-1)
    grey = solid & (mx - mn < o["sat"])
    cand = grey & (mx >= o["lo"]) & (mx <= o["hi"])
    base = grey & (mx > o["hi"])
    dark = solid & (mx < o["hi"])
    keep = _runs(dark, o["run"]) | _runs(dark.T, o["run"]).T
    k = o["k"]
    pc, pb = np.pad(cand, k), np.pad(base, k)
    out = a.copy()
    for y, x in zip(*np.where(cand & ~keep)):
        if pc[y:y + 2 * k + 1, x:x + 2 * k + 1].mean() > o["share"]:
            continue
        yy, xx = np.where(pb[y:y + 2 * k + 1, x:x + 2 * k + 1])
        if len(yy) < 4:
            continue
        vals, cnt = np.unique(a[yy + y - k, xx + x - k, :3], axis=0, return_counts=True)
        out[y, x, :3] = vals[cnt.argmax()]
    return Image.fromarray(out, "RGBA")


def shrink(module: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    """A smaller copy of a piece of a module cut (Lufenia's dome cap: the villa's dome at half scale): the native px
    `box` box-resampled on the premultiplied figure to fit `size` cells (bottom-aligned, centred), every colour mapped
    to the nearest colour of the module (no new colours), binary alpha."""
    from gen.town_theme_pix import T
    src = np.asarray(module.convert("RGBA"))
    x0, y0, x1, y1 = box
    crop = src[y0:y1, x0:x1].astype(np.float32)
    crop[..., :3] *= crop[..., 3:4] / 255
    W, H = size[0] * T, size[1] * T
    s = min(W / (x1 - x0), H / (y1 - y0))
    w, h = round((x1 - x0) * s), round((y1 - y0) * s)
    sm = np.asarray(Image.fromarray(crop.astype(np.uint8)).resize((w, h), Image.BOX)).astype(np.float32)
    a = sm[..., 3]
    col = np.where(a[..., None] > 0, sm[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
    pal = np.unique(src[src[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    lab = ((col[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
    out = np.zeros((H, W, 4), np.uint8)
    ox = (W - w) // 2
    out[H - h:, ox:ox + w, :3] = pal[lab].astype(np.uint8)
    out[H - h:, ox:ox + w, 3] = (a > 110) * 255
    return Image.fromarray(out, "RGBA")

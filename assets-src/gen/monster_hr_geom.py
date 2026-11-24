"""EF-G geometry and keying helpers shared by gen/monster_hr_prep.py, monster_hr_fix.py and monster_hr_puppet.py:
polygon masks, 4-neighbour dilation / erosion / depth, the PIL flood from border seeds, the page colour (flat or per
row) and the border-sampled key. Pure numpy + Pillow."""
from __future__ import annotations

import colorsys

import numpy as np
from PIL import Image, ImageDraw


def poly_mask(shape: tuple[int, int], polys: list) -> np.ndarray:
    m = Image.new("L", (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys or []:
        d.polygon([tuple(map(float, q)) for q in p], fill=255)
    return np.asarray(m) > 0


def shift(m: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = m[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return out


def dilate(m: np.ndarray, n: int = 1) -> np.ndarray:
    for _ in range(n):
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return m


def erode(m: np.ndarray, n: int = 1) -> np.ndarray:
    return ~dilate(~m, n)


def depth(m: np.ndarray, cap: int) -> np.ndarray:
    """City-block depth of each mask px (1 at the edge), capped: the feather weight's distance."""
    d, cur = np.zeros(m.shape, np.int32), m.copy()
    for k in range(cap):
        d[cur] = k + 1
        cur = erode(cur)
    return d


def flood(cand: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    """The candidate px 4-connected to any seed (PIL floodfill on a mask image)."""
    m = Image.fromarray(np.where(cand, 255, 0).astype(np.uint8)).copy()
    for x, y in seeds:
        if m.getpixel((x, y)) == 255:
            ImageDraw.floodfill(m, (x, y), 128)
    return np.asarray(m) == 128


def border_seeds(h: int, w: int, step: int = 8) -> list[tuple[int, int]]:
    return [p for i in range(0, max(h, w), step) for p in ((min(i, w - 1), 0), (min(i, w - 1), h - 1),
                                                         (0, min(i, h - 1)), (w - 1, min(i, h - 1)))]


def page(f: np.ndarray, mode: str) -> np.ndarray:
    """The page colour behind each px: one border median (`flat`), or per row the left and right border strips'
    medians interpolated across x (`rows`: a gradient page, pirate v3's teal)."""
    h, w, _ = f.shape
    if mode == "flat":
        b = np.concatenate([f[0], f[-1], f[:, 0], f[:, -1]])
        return np.broadcast_to(np.median(b, 0), f.shape)
    lft, rgt = np.median(f[:, :8], 1), np.median(f[:, -8:], 1)
    t = np.linspace(0, 1, w)[None, :, None]
    return lft[:, None, :] * (1 - t) + rgt[:, None, :] * t


def key(rgb: np.ndarray, k: dict, protect: np.ndarray | None = None) -> np.ndarray:
    """Figure mask: page candidates (near the page colour, or of its hue when `hue` is set) connected to the border,
    plus enclosed page pockets >= `holes` px, are the page; the rest is figure."""
    f = rgb.astype(float)
    pg = page(f, k.get("mode", "flat"))
    cand = np.abs(f - pg).max(2) <= k.get("tol", 30)
    if k.get("hue"):
        hb = colorsys.rgb_to_hsv(*(np.median(pg.reshape(-1, 3), 0) / 255))[0]
        hsv = np.asarray(Image.fromarray(rgb).convert("HSV")).astype(float) / 255
        dh = np.minimum(np.abs(hsv[..., 0] - hb), 1 - np.abs(hsv[..., 0] - hb)) * 360
        cand |= (dh <= k["hue"]) & (hsv[..., 1] > k.get("sat", 0.45)) & (hsv[..., 2] > k.get("val", 0.0))
    bg = flood(cand, border_seeds(*rgb.shape[:2]))
    if k.get("holes"):
        from gen import pixelize as PX
        lab, n = PX.components(cand & ~bg)
        sizes = np.bincount(lab.ravel())
        kept = np.unique(lab[protect]) if protect is not None else []     # pockets inside a protected area stay
        bg |= np.isin(lab, [i for i in range(1, n + 1) if sizes[i] >= k["holes"] and i not in kept])
    return ~bg



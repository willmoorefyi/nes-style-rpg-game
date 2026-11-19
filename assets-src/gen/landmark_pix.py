"""Cut-out and pixelizer of the Bedrock landmark renders (passes LM / LM2; driven by landmark_cut.py).

The LM2 pilot pipeline, kept byte for byte so the approved sheet rebuilds from the cache:
  cutout()  render (+ optional remove_bg result) -> RGB + binary figure mask, cleaned by clean()
  pix()     figure -> a w x h cell native icon (48 px per cell): box resample, 15-bit k-means palette,
            speckle filter, a 1 px selective outline (none round the ground apron), bottom aligned
  hue_nudge() cool grey rock -> warm taupe (the cave mouth, to sit with the mountains)
Added in LM-INT: `smoke_y` (drop the grey smoke over a crater: the engine animates it) and `soft_y` / `soft_alpha`
(a remove_bg base kept solid: a lower alpha threshold below soft_y, holes closed).
Added in LM4-INT: `sea_y` (drop the painted sea round a town's walls: water-hued pixels joined to the background,
below sea_y) and `drop` (fractional rects cut out of the figure: Pravoka's pier).
"""
from __future__ import annotations

import colorsys

import numpy as np
from PIL import Image, ImageFilter

from gen.pixelize import OUTLINE, components, flood_bg, kmeans, snap15

T = 48


def _m(a): return Image.fromarray((a * 255).astype(np.uint8))
def _b(im): return np.asarray(im) > 127


def hsv(rgb):
    f = rgb.astype(np.float32) / 255; mx, mn = f.max(2), f.min(2); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(d == 0, 0, np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6,
                 np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4))) * 60
    return h, s, mx


def clean(rgb, fg, rim=0, rim_lum=170, rim_sat=0.16, pocket=0, pocket_min=236, base_y=None, green_y=None,
          smoke_y=None, smoke_sat=0.3, sea_y=None, sea_hue=(170, 215), sea_sat=0.25, sea_grow=2, drop=()):
    """rim: peel up to `rim` px of light, low-saturation pixels inward from the background (a sticker rim);
    pocket: erase near-white blobs >= `pocket` px wide trapped inside the figure (background seen through gaps);
    base_y / green_y / smoke_y: fractions of the render height: drop every row from base_y, grass-green pixels from
    green_y, and grey (saturation < smoke_sat) pixels above smoke_y."""
    h, s, v = hsv(rgb)
    if rim:
        light = fg & (((v * 255) > rim_lum) & (s < rim_sat) | (rgb.min(2) > 200))
        reach = ~fg
        for _ in range(rim):
            grow = _b(_m(reach).filter(ImageFilter.MaxFilter(3))) & light
            if not (grow & ~reach).any():
                break
            reach |= grow
        fg = fg & ~reach
    if pocket:
        nw = fg & (rgb.min(2) >= pocket_min) & (s < 0.12)
        k = pocket | 1
        blob = _b(_m(nw).filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k)))
        blob = _b(_m(blob).filter(ImageFilter.MaxFilter(5))) & (rgb.min(2) > 200)
        fg = fg & ~blob
    H = fg.shape[0]
    if base_y is not None:
        fg = fg.copy(); fg[int(base_y * H):] = False
    if green_y is not None:
        gr = (h > 55) & (h < 165) & (s > 0.22)
        band = np.zeros_like(fg); band[int(green_y * H):] = True
        fg = fg & ~(gr & band)
    if smoke_y is not None:
        band = np.zeros_like(fg); band[:int(smoke_y * H)] = True
        fg = fg & ~(band & (s < smoke_sat))
    if sea_y is not None:
        fg = fg & ~sea(rgb, fg, h, s, v, sea_y, sea_hue, sea_sat, sea_grow)
    for x0, y0, x1, y1 in drop:
        fg = fg.copy(); W = fg.shape[1]
        fg[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = False
    return fg


def sea(rgb, fg, h, s, v, sea_y, hue, sat, grow):
    """The painted sea round a figure: water-hued pixels (hue in `hue`, saturation > sat) in one region with the
    background (so a harbour basin inside the walls stays), below row sea_y * H, grown `grow` px into the dark wave
    ink and the white foam beside it."""
    water = (h >= hue[0]) & (h <= hue[1]) & (s > sat)
    lab, _ = components(water | ~fg)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    out = np.isin(lab, border[border > 0]) & water
    out[:int(sea_y * len(out))] = False
    for _ in range(grow):
        out |= _b(_m(out).filter(ImageFilter.MaxFilter(3))) & ((v < 0.25) | (s < 0.12) & (v > 0.85))
    return out


def solid_base(alpha: np.ndarray, fg: np.ndarray, soft_y: float, soft_alpha: int, light: np.ndarray | None = None,
               close: int = 7) -> np.ndarray:
    """Below row soft_y * H the figure is every pixel with alpha > soft_alpha that is not `light` (the near-white
    fringe against the render's background), closed (dilate then erode by `close`) and with every enclosed hole
    filled, so a soft base (grass, path, bushes) stays solid."""
    H = fg.shape[0]; y0 = int(soft_y * H)
    soft = alpha[y0:] > soft_alpha
    if light is not None:
        soft &= ~light[y0:]
    soft = _b(_m(soft).filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))) | soft
    lab, _ = components(np.pad(~soft, 1, constant_values=True))    # the gaps not joined to the border are holes
    soft |= (lab != lab[0, 0])[1:-1, 1:-1]
    fg = fg.copy(); fg[y0:] = soft | (fg[y0:] & ~light[y0:] if light is not None else fg[y0:])
    return fg


def cutout(raw, nobg=None, tol=28, soft_y=None, soft_alpha=24, **kw):
    """`raw` / `nobg` are PIL images (the render and its remove_bg result, or None)."""
    if nobg is not None:
        im = np.asarray(nobg.convert('RGBA')); rgb, fg = im[..., :3], im[..., 3] > 128
        if soft_y is not None:           # remove_bg drops parts of a soft base (a bush): take them from the render
            r = np.asarray(raw.convert('RGB')); y0 = int(soft_y * len(r))
            rgb = rgb.copy(); rgb[y0:] = r[y0:]
            fg = solid_base(np.maximum(im[..., 3], ~flood_bg(r, tol) * 255), fg, soft_y, soft_alpha, r.min(2) > 215)
    else:
        rgb = np.asarray(raw.convert('RGB')); fg = ~flood_bg(rgb, tol)
    return rgb, clean(rgb, fg, **kw)


def hue_nudge(img, src=(180, 270), dst=28, sat_mul=0.55, sat_add=0.05, max_sat=0.6):
    """Recolour cool grey rock (hue in src, low saturation) toward a warm taupe hue (native art, after the palette)."""
    a = np.asarray(img).copy(); rgb = a[..., :3]
    out = rgb.copy()
    h, s, v = hsv(rgb)
    m = (a[..., 3] > 0) & (h >= src[0]) & (h <= src[1]) & (s < max_sat)
    for y, x in zip(*np.where(m)):
        r, g, b = colorsys.hsv_to_rgb(dst / 360, min(1, s[y, x] * sat_mul + sat_add), v[y, x])
        out[y, x] = [int(r * 255), int(g * 255), int(b * 255)]
    a[..., :3] = snap15(out.astype(np.float32)); return Image.fromarray(a)


def keep_main(mask, min_frac=0.02):
    small = np.asarray(_m(mask).resize((mask.shape[1] // 8, mask.shape[0] // 8), Image.BOX)) > 100
    lab, n = components(small)
    if n == 0:
        return mask
    sizes = [(lab == i).sum() for i in range(1, n + 1)]
    big = max(sizes); keep = np.zeros_like(small)
    for i, s in enumerate(sizes, 1):
        if s >= min_frac * big:
            keep |= lab == i
    keep = np.asarray(_m(keep).filter(ImageFilter.MaxFilter(3)).resize(mask.shape[::-1], Image.NEAREST)) > 0
    return mask & keep


def pix(size, rgb, mask, fill=0.92, colors=14, hfill=None, seed=0, sharpen=1.0, bottom_pad=1, apron=0.0,
        edge_light=0.0):
    """The native icon, size = (cells wide, cells high); returns (RGBA image, figure px [w, h]).
    edge_light: in the bottom `edge_light` share of the figure, a light grey pixel on the silhouette (the sharpen
    halo against the empty background) takes the darkest colour of its figure neighbours."""
    w, h = size; W, H = int(w * T), int(h * T)
    mask = keep_main(mask)
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, mask = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    bw, bh = x1 - x0, y1 - y0
    s = min((W - 2) * fill / bw, (H - 2) * (hfill or fill) / bh)
    tw, th = max(1, round(bw * s)), max(1, round(bh * s))
    rgba = np.dstack([rgb, mask * 255]).astype(np.uint8)
    pm = rgba.astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    small = np.asarray(Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((tw, th), Image.BOX)).astype(np.float32)
    a = small[..., 3]; col = np.where(a[..., None] > 0, small[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
    if sharpen:
        im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(1, int(60 * sharpen), 2))
        col = np.asarray(im).astype(np.float32)
    solid = a > 127
    px = col[solid]
    rng = np.random.default_rng(seed)
    cent = snap15(kmeans(px[rng.choice(len(px), min(len(px), 20000), replace=False)], colors, seed=seed)).astype(np.float32)
    lab = ((px[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
    q = np.zeros((th, tw, 3), np.float32); q[solid] = cent[lab]
    li = np.full((th, tw), -1); li[solid] = lab
    for y in range(1, th - 1):           # speckle: a lone pixel whose 4 neighbours share another colour takes it
        for x in range(1, tw - 1):
            if li[y, x] < 0:
                continue
            nb = [li[y - 1, x], li[y + 1, x], li[y, x - 1], li[y, x + 1]]
            if nb.count(nb[0]) >= 3 and nb[0] >= 0 and nb[0] != li[y, x] and nb.count(li[y, x]) == 0:
                if abs(q[y, x].sum() - cent[nb[0]].sum()) < 200:      # keep strong highlights / ink
                    li[y, x] = nb[0]; q[y, x] = cent[nb[0]]
    if edge_light:
        for y in range(int(th * (1 - edge_light)), th):
            for x in range(tw):
                if not solid[y, x] or q[y, x].min() < 150 or q[y, x].max() - q[y, x].min() > 50:
                    continue
                nb = [(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                inside = [c for c in nb if 0 <= c[0] < th and 0 <= c[1] < tw and solid[c] and q[c].min() < 150]
                if len(inside) < 4 and inside:
                    q[y, x] = min((q[c] for c in inside), key=lambda v: v.sum())
    out = np.zeros((H, W, 4), np.uint8)
    fig = np.zeros((th + 2, tw + 2, 4), np.uint8)
    fig[1:-1, 1:-1, :3] = q.astype(np.uint8); fig[1:-1, 1:-1, 3] = solid * 255
    al = fig[..., 3] > 0
    ring = np.zeros_like(al)
    ring[1:] |= al[:-1]; ring[:-1] |= al[1:]; ring[:, 1:] |= al[:, :-1]; ring[:, :-1] |= al[:, 1:]
    ring &= ~al
    if apron:                                            # no outline round the ground apron: it melts into the terrain
        rows = np.where(al.any(1))[0]; cut = int(rows.max() - apron * (rows.max() - rows.min()))
        ring[cut:] = False
    src = np.zeros_like(fig[..., :3], dtype=np.float32); cnt = np.zeros(al.shape, np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):    # selective outline: a dark tint of the touching colour
        sh = np.roll(np.roll(fig, dy, 0), dx, 1); m = sh[..., 3] > 0
        src += sh[..., :3] * m[..., None]; cnt += m
    oc = snap15(src / np.maximum(cnt[..., None], 1) * 0.28 + np.array(OUTLINE) * 0.5)
    fig[ring, :3] = oc[ring]
    fig[ring, 3] = 255
    fh, fw = fig.shape[:2]
    ox = (W - fw) // 2; oy = H - bottom_pad - fh
    fy0 = max(0, -oy); oy = max(0, oy)
    out[oy:oy + fh - fy0, ox:ox + fw] = fig[fy0:, :]
    return Image.fromarray(out, 'RGBA'), [fw, fh]

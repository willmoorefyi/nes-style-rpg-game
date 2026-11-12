"""Turn a generated render of one cell into a clean sprite on its native pixel grid.

  1. remove the background: colour-key a solid magenta background, or (older white/grey renders)
     flood-fill from the cell border, which stops at the outline so light armour is never punched out
  2. keep only connected blobs that overlap the pose guide (drops invented props and bleed from
     neighbouring cells)
  3. palette: k-means on the full-resolution figure, snapped to 15-bit colour; darkest colour = outline
  4. each native pixel takes the most common palette colour in its block; near-black ink wins when it
     covers enough of the block (keeps eyes and part separations)
  5. majority-filter speckles, add a 1px outline, and shift the figure so its last opaque row is bottom_row
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter

OUTLINE = (6, 4, 10)
MAGENTA = np.array([255, 0, 255], np.float32)


def detect_pitch(rgb: np.ndarray, lo: float = 3.0, hi: float = 14.0, step: float = 0.02) -> tuple[float, float, float, float]:
    """Find the art-pixel size of a render drawn as pixel art.

    Returns (pitch, phase_x, phase_y, confidence). Confidence is the circular concentration of colour-edge
    positions modulo the pitch (1.0 = every edge on the grid); below ~0.5 the render has no usable grid.
    """
    f = rgb.astype(np.float32)
    xs = np.where(np.abs(np.diff(f, axis=1)).sum(2) > 90)[1] + 1
    ys = np.where(np.abs(np.diff(f, axis=0)).sum(2) > 90)[0] + 1
    if len(xs) < 50 or len(ys) < 50:
        return 0.0, 0.0, 0.0, 0.0
    best = (0.0, 0.0, 0.0, 0.0)
    for pitch in np.arange(lo, hi, step):
        zx = np.exp(2j * np.pi * xs / pitch).mean()
        zy = np.exp(2j * np.pi * ys / pitch).mean()
        conf = min(abs(zx), abs(zy))
        if conf > best[3]:
            px = (np.angle(zx) / (2 * np.pi)) % 1.0 * pitch
            py = (np.angle(zy) / (2 * np.pi)) % 1.0 * pitch
            best = (float(pitch), float(px), float(py), float(conf))
    return best


def clean_resample(img: Image.Image, size: tuple[int, int], min_conf: float = 0.5) -> tuple[Image.Image, dict]:
    """Resize a render to `size`. If it was drawn on a pixel grid, first point-sample every art pixel at its
    centre (removing anti-aliasing and JPEG-like smear), then scale those clean blocks with nearest-neighbour."""
    rgb = np.asarray(img.convert("RGB"))
    pitch, px, py, conf = detect_pitch(rgb)
    info = {"pitch": round(pitch, 2), "confidence": round(conf, 3), "grid_used": conf >= min_conf}
    if conf < min_conf:
        return img.convert("RGB").resize(size, Image.Resampling.LANCZOS), info
    h, w, _ = rgb.shape
    cx = np.arange(px + pitch / 2, w, pitch)
    cy = np.arange(py + pitch / 2, h, pitch)
    cx, cy = cx[cx < w].astype(int), cy[cy < h].astype(int)
    native = rgb[np.ix_(cy, cx)]
    info["art_px"] = (len(cx), len(cy))
    info["native"] = Image.fromarray(native)
    return Image.fromarray(native).resize(size, Image.Resampling.NEAREST), info


def is_magenta_bg(rgb: np.ndarray) -> bool:
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.float32)
    return float(np.linalg.norm(np.median(border, axis=0) - MAGENTA)) < 90.0


def magenta_bg(rgb: np.ndarray) -> np.ndarray:
    """Background = magenta-ish: red and blue high, green well below both (also catches anti-aliased fringes)."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    return (r > 150) & (b > 150) & (g < np.minimum(r, b) - 70)


def magenta_fringe(rgb: np.ndarray, fg: np.ndarray, band: int = 2) -> np.ndarray:
    """Magenta-tinted pixels within `band` px of the background: blends of the key colour, not costume colours.
    Purple costume areas deeper inside the figure are left alone."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    tinted = (r - g > 45) & (b - g > 45) & (np.abs(r - b) < 90)
    near_bg = np.asarray(Image.fromarray((~fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * band + 1))) > 0
    return fg & tinted & near_bg


def flood_bg(rgb: np.ndarray, tol: float) -> np.ndarray:
    """Pixels connected to the border whose colour is near the border colour."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    near = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) < tol
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not near[y, x]:
            continue
        seen[y, x] = True
        stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return seen


# kept for older callers
_flood_bg = flood_bg


def components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    lab = np.zeros(mask.shape, np.int32)
    n = 0
    h, w = mask.shape
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not lab[sy, sx]:
                n += 1
                stack = [(sy, sx)]
                while stack:
                    y, x = stack.pop()
                    if y < 0 or x < 0 or y >= h or x >= w or lab[y, x] or not mask[y, x]:
                        continue
                    lab[y, x] = n
                    stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return lab, n


def snap15(c: np.ndarray) -> np.ndarray:
    v = np.clip(np.round(c / 255.0 * 31.0), 0, 31).astype(np.int32)
    return ((v << 3) | (v >> 2)).astype(np.uint8)


def kmeans(px: np.ndarray, k: int, iters: int = 25, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    cent = px[rng.choice(len(px), size=min(k, len(px)), replace=False)].astype(np.float32)
    for _ in range(iters):
        lab = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
        for i in range(len(cent)):
            m = lab == i
            if m.any():
                cent[i] = px[m].mean(0)
    return cent


def _resize_mask(m: np.ndarray, size: tuple[int, int], how) -> np.ndarray:
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(size, how)) > 127


def foreground(rgb: np.ndarray, guide_mask: np.ndarray, bg_tol: float = 40.0, dilate: int = 25) -> np.ndarray:
    """Figure mask at render resolution: background removed, only blobs overlapping the guide kept."""
    magenta = is_magenta_bg(rgb)
    fg = ~(magenta_bg(rgb) if magenta else flood_bg(rgb, bg_tol))
    if magenta:
        fg &= ~magenta_fringe(rgb, fg)
    h, w = fg.shape
    work = (max(16, w // 4), max(16, h // 4)) if w > 200 else (w, h)
    gm = np.asarray(Image.fromarray((guide_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(dilate))) > 0
    small_fg = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).resize(work, Image.Resampling.BOX)) > 127
    small_g = np.asarray(Image.fromarray((gm * 255).astype(np.uint8)).resize(work, Image.Resampling.BOX)) > 0
    lab, n = components(small_fg)
    keep = np.zeros_like(small_fg)
    for i in range(1, n + 1):
        comp = lab == i
        if (comp & small_g).sum() > 0.25 * comp.sum():
            keep |= comp
    return fg & _resize_mask(keep, (w, h), Image.Resampling.NEAREST)


def pixelize(cell: Image.Image, guide_mask: np.ndarray, grid: tuple[int, int] | int, colors: int = 14,
             bg_tol: float = 40.0, seed: int = 0, ink_max: int = 40, ink_frac: float = 0.25,
             bottom_row: int | None = None, palette: np.ndarray | None = None) -> Image.Image:
    """cell: RGB(A) render of one cell; guide_mask: bool mask of that cell's pose guide, same size."""
    gw, gh = (grid, grid) if isinstance(grid, int) else grid
    rgb = np.asarray(cell.convert("RGB"))
    fg = foreground(rgb, guide_mask, bg_tol)
    cov = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).resize((gw, gh), Image.Resampling.BOX)).astype(np.float32)
    solid = cov > 110
    if not solid.any():
        return Image.new("RGBA", (gw, gh))
    fpx = rgb[fg].astype(np.float32)
    cent = palette.astype(np.float32).copy() if palette is not None else sheet_palette([fpx], colors, seed)
    dark = int(cent.sum(1).argmin())
    lab_full = np.full(fg.shape, -1, np.int32)
    lab_full[fg] = ((fpx[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    ink = fg & (rgb.max(axis=2) < ink_max)          # outline only if every channel is near black
    lab_full[ink] = dark
    h, w = fg.shape
    by, bx = h / gh, w / gw
    idx = np.zeros((gh, gw), np.int32)
    for y in range(gh):
        y0, y1 = int(round(y * by)), int(round((y + 1) * by))
        for x in range(gw):
            if not solid[y, x]:
                continue
            blk = lab_full[y0:y1, int(round(x * bx)):int(round((x + 1) * bx))]
            blk = blk[blk >= 0]
            counts = np.bincount(blk, minlength=len(cent))
            if counts[dark] >= ink_frac * blk.size:
                idx[y, x] = dark
            else:
                if counts.sum() > counts[dark]:
                    counts[dark] = 0
                idx[y, x] = int(counts.argmax())
    out_idx = idx.copy()
    for y in range(1, gh - 1):
        for x in range(1, gw - 1):
            if not solid[y, x]:
                continue
            nb = [idx[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if solid[y + dy, x + dx]]
            if len(nb) >= 3 and idx[y, x] not in nb:
                vals, counts = np.unique(nb, return_counts=True)
                out_idx[y, x] = vals[counts.argmax()]
    img = np.zeros((gh, gw, 4), np.uint8)
    img[..., :3] = cent[out_idx].astype(np.uint8)
    img[..., 3] = np.where(solid, 255, 0)
    a = solid
    ring = np.zeros_like(a)
    ring[1:] |= a[:-1]; ring[:-1] |= a[1:]; ring[:, 1:] |= a[:, :-1]; ring[:, :-1] |= a[:, 1:]
    ring &= ~a
    img[ring, :3] = OUTLINE
    img[ring, 3] = 255
    if bottom_row is not None:
        img = align_bottom(img, bottom_row)
    return Image.fromarray(img, "RGBA")


def align_bottom(img: np.ndarray, bottom_row: int) -> np.ndarray:
    """Shift vertically so the last opaque row is bottom_row (feet line up across every frame)."""
    rows = np.where(img[..., 3].any(axis=1))[0]
    if len(rows) == 0:
        return img
    dy = bottom_row - int(rows.max())
    if dy == 0:
        return img
    out = np.zeros_like(img)
    if dy > 0:
        out[dy:] = img[:-dy]
    else:
        out[:dy] = img[-dy:]
    return out


def sheet_palette(pixel_sets: list[np.ndarray], colors: int, seed: int = 0) -> np.ndarray:
    """One 15-bit palette for a whole sheet (k-means over every frame's figure pixels); darkest colour = outline.
    Sharing it keeps colours consistent across frames and stops a small region (a face) merging into a neighbour."""
    px = np.concatenate([p.astype(np.float32) for p in pixel_sets if len(p)])
    rng = np.random.default_rng(seed)
    sample = px[rng.choice(len(px), size=min(len(px), 40000), replace=False)]
    cent = snap15(kmeans(sample, colors, seed=seed)).astype(np.float32)
    cent[int(cent.sum(1).argmin())] = OUTLINE
    return cent


def pixelize_native(art: Image.Image, guide_mask: np.ndarray, out_size: tuple[int, int], colors: int = 14,
                    seed: int = 0, bottom_row: int | None = None, ink_max: int = 40) -> tuple[Image.Image, dict]:
    """1:1 path for renders that were drawn as pixel art: `art` is already one pixel per art pixel.

    No resampling: background key, prop filter, palette snap (k-means only if there are more colours than
    allowed), outline only where the art has none, then placed into `out_size` with the feet on bottom_row.
    """
    rgb = np.asarray(art.convert("RGB"))
    h, w, _ = rgb.shape
    fg = foreground(rgb, guide_mask, dilate=max(3, (min(w, h) // 20) | 1))
    report = {"cropped": False}
    out = np.zeros((out_size[1], out_size[0], 4), np.uint8)
    if not fg.any():
        return Image.fromarray(out, "RGBA"), report
    px = rgb[fg].astype(np.float32)
    uniq = np.unique(rgb[fg].reshape(-1, 3), axis=0)
    if len(uniq) > colors:
        rng = np.random.default_rng(seed)
        sample = px[rng.choice(len(px), size=min(len(px), 20000), replace=False)]
        cent = snap15(kmeans(sample, colors, seed=seed)).astype(np.float32)
    else:
        cent = snap15(uniq.astype(np.float32)).astype(np.float32)
    dark = int(cent.sum(1).argmin())
    cent[dark] = OUTLINE
    lab = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    lab[(rgb[fg].max(axis=1) < ink_max)] = dark
    fig = np.zeros((h, w, 4), np.uint8)
    fig[fg, :3] = cent[lab].astype(np.uint8)
    fig[fg, 3] = 255
    # outline: only around silhouette pixels that are not already outline-dark
    is_dark = np.zeros((h, w), bool)
    is_dark[fg] = lab == dark
    light_edge = fg & ~is_dark
    ring = np.zeros_like(fg)
    ring[1:] |= light_edge[:-1]; ring[:-1] |= light_edge[1:]; ring[:, 1:] |= light_edge[:, :-1]; ring[:, :-1] |= light_edge[:, 1:]
    ring &= ~fg
    fig[ring, :3] = OUTLINE
    fig[ring, 3] = 255
    # place: keep the horizontal position (scaled to the output width), feet on bottom_row
    alpha = fig[..., 3] > 0
    ys, xs = np.where(alpha)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    ow, oh = out_size
    dst_x0 = int(round(x0 * ow / w))
    dst_y1 = bottom_row if bottom_row is not None else int(round(y1 * oh / h))
    dst_y0 = dst_y1 - (y1 - y0)
    sx0, sy0 = x0, y0
    if dst_x0 + (x1 - x0) >= ow:
        dst_x0 = max(0, ow - 1 - (x1 - x0))
    if dst_y0 < 0 or dst_x0 + (x1 - x0) >= ow:
        report["cropped"] = True
        sy0 += max(0, -dst_y0); dst_y0 = max(0, dst_y0)
    cw = min(x1 - sx0 + 1, ow - dst_x0)
    ch = min(y1 - sy0 + 1, oh - dst_y0)
    out[dst_y0:dst_y0 + ch, dst_x0:dst_x0 + cw] = fig[sy0:sy0 + ch, sx0:sx0 + cw]
    report["size"] = (int(x1 - x0 + 1), int(y1 - y0 + 1))
    return Image.fromarray(out, "RGBA"), report

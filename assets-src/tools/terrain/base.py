"""Shared constants and pixel helpers for the organic terrain painter (terrain/__init__.py)."""
from __future__ import annotations

import zlib

import numpy as np
from PIL import Image

import kit as K

T = K.T
WILD = ["grass", "sand", "forest", "mountain", "river", "ocean", "lake"]   # organic partition; ties: earlier wins
ROADS = ("dirt", "cobble")                         # painted over the partition with a small ragged edge
WATERS = ("river", "ocean", "lake")
TEX = {"river": "water", "lake": "water"}          # texture of each material
LOW = 4                                            # the blurred fields are built at 1/LOW resolution
BLUR_R = 20                                        # px, applied twice to the cell masks
# Domain warp. The outline of a straight cell edge sits where the warp moves it, inside the 10 px left between the
# clamped cell centres. The main term is a meander (base._meander): knots of alternating sign every 24-48 px, so no
# 96 px stretch of an outline stays within 3 px of one line (a grid edge; metrics.RUN_MAX); its rows have their own
# phase. The gap then pushes the total off zero (an outline crosses its cell line steeply, so it seldom runs along
# it), and the value-noise octaves (cell px, amplitude px) roughen it. The old coarse octave (soft-limited through
# tanh(3 n / sqrt(|n| + eps))) is kept small: as a square wave it held outlines parallel to the cell lines for
# 200-300 px. Each value-noise component changes WARP_STRETCH times more slowly along its own axis, which keeps the
# warp from folding an outline into thin slivers.
WARP_COARSE = (96, 14.0, 0.5)                      # cell, nominal amplitude, soft limit
WARP_FINE = ((24, 2.5), (6, 1.0))
WARP_EPS, WARP_STRETCH = 0.01, 2
WARP_MEANDER = (40, 6.5, 0.65)                     # (mean half-wave px, amplitude px, least share of it); 0: off
WARP_GAP = (4.0, 12.0)                             # (px kept off zero, total warp reach px); 0: off
CORE = 28                                          # px: the centre of every cell always shows its own material
MARGIN = (T - CORE) // 2
CORE_PULL, CORE_REACH = 0.3, 3.0                   # corner cells: own-material bonus at the centre's edge, 3 px
SAND_BAND = 10                                     # px: dithered grass / sand band
BEACH = (6, 10)                                    # px: automatic beach where the ocean meets grass
SHALLOW, SHALLOW_TINT, CYAN = 10, 0.35, np.array((96, 200, 216), np.float32)
BANK = 3                                           # px: dithered earth banks along rivers and lakes
CLUMP_STEP, CLUMP_OUT, CLUMP_BULGE = 40, 14, (2, 14)  # px: tree_clump spacing along forest outlines, stick-out
FOOT, FOOT_COVER = 48, (0.40, 0.10)                 # px: foothill reach (one cell); rock cover at the range, at one cell
FOOT_PATCH = 0.3                                   # foothill dither: Bayer, plus this much patchy noise
FOOT_RISE, FOOT_FADE = (0.6, 8), 12                # cover starts at 60 % of itself, full after 8 px; fade px past the reach
PEAK_SCALES = (0.6, 0.8, 1.0, 1.25)
PEAK_SPACING = 34                                  # px x scale between peak anchors (the plan's minimum is 30)
FOOT_SCALES = (0.5, 0.6)
ROCK_CORE = 60                                     # px: a foothill rock covers at most this much of a cell centre
SNOW = np.array((232, 236, 244), np.float32)
OVERHANG = 8                                       # px: peaks may overhang a walkable cell by this much
NEAR_LINE = [T - 2, T - 1, 0, 1, 2]                  # (coordinate mod T) of the px rows / columns near a cell line
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) + 0.5) / 16


def _key(mat: np.ndarray) -> int:
    return zlib.crc32("\n".join("|".join(r) for r in mat.tolist()).encode())


def _up(cells: np.ndarray, f: int = T) -> np.ndarray:
    return np.repeat(np.repeat(cells, f, axis=0), f, axis=1)


def _tile(tex: np.ndarray, h: int, w: int) -> np.ndarray:
    th, tw = tex.shape[:2]
    return np.tile(tex, (h // th + 1, w // tw + 1, 1))[:h, :w]


def _blur(a: np.ndarray, r: int) -> np.ndarray:
    """Separable box blur of radius r (edges clamp)."""
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
        n = a.shape[axis]
        a = ((np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis))
             / (2 * r + 1)).astype(np.float32)
    return a


def _vnoise(h: int, w: int, cell: int, seed: int, cell_x: int | None = None) -> np.ndarray:
    """Smooth value noise in -1..1 (smoothstep interpolation) on global pixel coordinates; `cell_x` makes it
    anisotropic (cell px along y, cell_x px along x)."""
    cy, cx = cell, cell_x or cell
    g = np.random.default_rng(seed).random((h // cy + 3, w // cx + 3)).astype(np.float32) * 2 - 1
    fy, fx = np.arange(h, dtype=np.float32) / cy, np.arange(w, dtype=np.float32) / cx
    y0, x0 = fy.astype(np.int32), fx.astype(np.int32)
    ty, tx = fy - y0, fx - x0
    ty, tx = (ty * ty * (3 - 2 * ty))[:, None], (tx * tx * (3 - 2 * tx))[None, :]
    top = g[np.ix_(y0, x0)] * (1 - tx) + g[np.ix_(y0, x0 + 1)] * tx
    bot = g[np.ix_(y0 + 1, x0)] * (1 - tx) + g[np.ix_(y0 + 1, x0 + 1)] * tx
    return top * (1 - ty) + bot * ty


def _meander(h: int, w: int, cell: int, lo: float, seed: int, along_x: bool) -> np.ndarray:
    """A wave in -1..1 along one axis whose knots alternate in sign (spaced 0.6-1.2 x `cell` px, each of size
    lo..1), so any stretch of about 2 cells swings both ways, without a fixed period. The knot coordinate is shifted
    by slow noise along the other axis, so each row has its own phase (and rows never cancel each other out)."""
    n_along, n_across = (w, h) if along_x else (h, w)
    r = np.random.default_rng(seed)
    k = int(n_along / (0.6 * cell)) + 8
    size = lo + (1 - lo) * r.random(k)
    knots = (size * np.where(np.arange(k) % 2 == 0, 1, -1)).astype(np.float32)
    pos = np.concatenate([[0.0], np.cumsum(cell * (0.6 + 0.6 * r.random(k - 1)))]).astype(np.float32)
    phase = (_vnoise(n_across, 1, 4 * cell, seed + 1)[:, 0] * 0.5 + 0.5) * 2 * cell        # per row, 0..2 cells
    u = np.arange(n_along, dtype=np.float32)[None, :] + phase[:, None] + 2 * cell
    i = np.clip(np.searchsorted(pos, u, side="right") - 1, 0, k - 2)
    t = np.clip((u - pos[i]) / (pos[i + 1] - pos[i]), 0, 1)
    t = t * t * (3 - 2 * t)
    out = (knots[i] * (1 - t) + knots[i + 1] * t).astype(np.float32)
    return out if along_x else out.T


def _dist(mask: np.ndarray, maxd: int) -> np.ndarray:
    """Approximate Euclidean distance (px) to the nearest True pixel, 0 inside, capped at maxd + 1 (chamfer 1 / 1.41)."""
    big = np.float32(maxd + 1)
    d = np.where(mask, np.float32(0), big)
    for _ in range(int(np.ceil(maxd))):
        p = np.pad(d, 1, constant_values=big)
        n = np.minimum(np.minimum(p[:-2, 1:-1], p[2:, 1:-1]), np.minimum(p[1:-1, :-2], p[1:-1, 2:])) + 1
        dg = np.minimum(np.minimum(p[:-2, :-2], p[:-2, 2:]), np.minimum(p[2:, :-2], p[2:, 2:])) + np.float32(1.41)
        d = np.minimum(d, np.minimum(n, dg))
    return np.minimum(d, big)


def _bayer(h: int, w: int) -> np.ndarray:
    return np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]


def _core(h: int, w: int) -> np.ndarray:
    """Pixels in the central CORE x CORE square of their cell."""
    iy, ix = np.arange(h) % T, np.arange(w) % T
    return ((iy >= MARGIN) & (iy < MARGIN + CORE))[:, None] & ((ix >= MARGIN) & (ix < MARGIN + CORE))[None, :]


def _shade(img: np.ndarray, mask: np.ndarray, f: float) -> None:
    img[mask] = (img[mask].astype(np.float32) * f).astype(np.uint8)


def _edge(mask: np.ndarray) -> np.ndarray:
    p = np.pad(mask, 1, mode="edge")
    return mask & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def _stamp(img: np.ndarray, part: np.ndarray, px: int, py: int, allow: np.ndarray | None = None) -> np.ndarray:
    """Alpha-stamp an RGBA array (binary alpha) onto img at (px, py), clipped to the image (and to `allow`).
    Returns the stamped pixel mask in image coordinates."""
    H, W = img.shape[:2]
    h, w = part.shape[:2]
    x0, y0, x1, y1 = max(0, px), max(0, py), min(W, px + w), min(H, py + h)
    out = np.zeros((H, W), bool)
    if x0 >= x1 or y0 >= y1:
        return out
    sub = part[y0 - py:y1 - py, x0 - px:x1 - px]
    m = sub[..., 3] > 127
    if allow is not None:
        m &= allow[y0:y1, x0:x1]
    img[y0:y1, x0:x1][m] = sub[..., :3][m]
    out[y0:y1, x0:x1] = m
    return out


def _poisson(cands: np.ndarray, spacing: float, rng: np.random.Generator, limit: int | None = None,
             ok=None) -> list[int]:
    """Greedy Poisson-disc thinning of candidate points (N x 2, y x) in the given order; returns kept indices.
    `ok(i)`, if given, is asked only for points that keep the spacing and may still reject them."""
    cell = max(1.0, spacing / np.sqrt(2))
    grid: dict[tuple[int, int], int] = {}
    kept: list[int] = []
    for i, (y, x) in enumerate(cands.tolist()):
        gy, gx = int(y // cell), int(x // cell)
        near = (grid.get((gy + a, gx + b)) for a in range(-2, 3) for b in range(-2, 3))
        if any(j is not None and (cands[j][0] - y) ** 2 + (cands[j][1] - x) ** 2 < spacing ** 2 for j in near):
            continue
        if ok is not None and not ok(i):
            continue
        grid[(gy, gx)] = i
        kept.append(i)
        if limit and len(kept) >= limit:
            break
    return kept


def _inner_depth(mask: np.ndarray, cap: int) -> np.ndarray:
    """Distance (px, 4-steps) inside the mask from its edge, 1 on the edge pixels; off-map counts as inside."""
    depth = np.zeros(mask.shape, np.int16)
    cur = mask.copy()
    for i in range(1, cap + 1):
        p = np.pad(cur, 1, constant_values=True)
        cur = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        depth[cur] = i
    return np.where(mask, depth + 1, 0)


def _low_dist(mask: np.ndarray, maxd: int) -> np.ndarray:
    """_dist at 1/LOW resolution, upsampled (for long reaches like the foothills)."""
    H, W = mask.shape
    small = mask[:H - H % LOW, :W - W % LOW].reshape(H // LOW, LOW, W // LOW, LOW).any(axis=(1, 3))
    d = _dist(small, int(np.ceil(maxd / LOW)) + 1) * LOW
    big = _blur(_up(d, LOW), LOW // 2)
    out = np.full((H, W), np.float32(maxd + 1))
    out[:big.shape[0], :big.shape[1]] = big
    return np.where(mask, 0, np.maximum(out - LOW / 2, 0.5))


def _palette_snap(rgb: np.ndarray, palette: np.ndarray) -> np.ndarray:
    d = ((rgb[:, None, :].astype(np.int32) - palette[None, :, :].astype(np.int32)) ** 2).sum(axis=2)
    return palette[d.argmin(axis=1)]


def _resized(part: Image.Image, scale: float, mirror: bool) -> np.ndarray:
    """The part scaled with LANCZOS (premultiplied), alpha thresholded, colours snapped to the part's own palette."""
    a = np.asarray(part.convert("RGBA")).astype(np.float32)
    op = a[..., 3] > 127
    palette = np.unique(a[op][:, :3].astype(np.uint8), axis=0)
    if mirror:
        a = a[:, ::-1]
    size = max(1, round(part.width * scale)), max(1, round(part.height * scale))
    alpha = a[..., 3:4] / 255
    chans = [Image.fromarray(ch).resize(size, Image.Resampling.LANCZOS)
             for ch in [(a[..., i] * alpha[..., 0]).astype(np.float32) for i in range(3)] + [alpha[..., 0] * 255]]
    out = np.stack([np.asarray(c, np.float32) for c in chans], axis=2)
    keep = out[..., 3] > 127
    rgb = np.clip(out[..., :3] / np.maximum(out[..., 3:4] / 255, 1e-3), 0, 255)
    res = np.zeros(out.shape, np.uint8)
    res[keep, :3] = _palette_snap(rgb[keep], palette)
    res[keep, 3] = 255
    return res

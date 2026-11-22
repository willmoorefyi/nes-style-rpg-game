"""Mountains: peak variants (scaled, mirrored, snow-capped, AR-T2's grey cold rock), their Poisson-disc placement and
the scattered foothill rocks (the foothill ground itself is AR-T2's scree band, terrain/bands.py)."""
from __future__ import annotations

import numpy as np
from PIL import Image

import kit as K
from .base import (BAYER4, FOOT, FOOT_SCALES, OVERHANG, PEAK_SCALES, PEAK_SPACING, ROCK_CORE, SNOW, T, _core, _dist,
                   _low_dist, _poisson, _resized, _up)
from .frame import CPX, CTX, chunk_rng, window_chunks
from .outline import _cached_partition

_VARIANTS: dict[bytes, dict[str, tuple[np.ndarray, tuple[int, int]]]] = {}   # peak art -> variants


def _fill_holes(part: Image.Image) -> Image.Image:
    """Transparent pixels enclosed by opaque art (keying holes, e.g. in the boulder) take a neighbour's colour."""
    a = np.asarray(part.convert("RGBA")).copy()
    clear = a[..., 3] < 128
    outside = np.zeros_like(clear)
    outside[0, :], outside[-1, :], outside[:, 0], outside[:, -1] = clear[0, :], clear[-1, :], clear[:, 0], clear[:, -1]
    while True:
        p = np.pad(outside, 1)
        grown = clear & (outside | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])
        if (grown == outside).all():
            break
        outside = grown
    holes = clear & ~outside
    while holes.any():
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            src = np.roll(a, (dy, dx), axis=(0, 1))
            take = holes & (src[..., 3] > 127)
            a[take] = src[take]
            holes &= ~take
    return Image.fromarray(a)


def _snowcap(img: np.ndarray) -> np.ndarray:
    """Top 35 % of the opaque rows lightened toward snow behind a dithered line."""
    out = img.copy()
    op = out[..., 3] > 127
    rows = np.nonzero(op.any(axis=1))[0]
    top, h = rows.min(), rows.max() - rows.min() + 1
    line = top + 0.35 * h
    yy, xx = np.mgrid[0:out.shape[0], 0:out.shape[1]]
    thr = BAYER4[yy % 4, xx % 4]
    snow = op & ((yy < line - 2) | ((yy < line + 2) & ((line + 2 - yy) / 4 > thr)))
    px = out[snow, :3].astype(np.float32)
    lum = px.mean(axis=1, keepdims=True) / 255
    out[snow, :3] = np.clip(SNOW * (0.72 + 0.28 * lum / max(lum.max(), 1e-3)), 0, 255).astype(np.uint8)
    return out


def variants(kit: K.Kit) -> dict[str, tuple[np.ndarray, tuple[int, int]]]:
    """Peak (and foothill rock) variants built from the kit's parts: name -> (RGBA array, bottom-centre anchor).
    peak x {as drawn, mirrored} x {0.6, 0.8, 1.0, 1.25}, snow caps at scale >= 1.0, small 0.5 / 0.6 foothill peaks,
    and 0.5 / 0.6 boulders (holes filled)."""
    peak = kit.part("peak")
    key = peak.tobytes() + (kit.parts["boulder"].tobytes() if "boulder" in kit.parts else b"")
    if key in _VARIANTS:
        return _VARIANTS[key]
    out = {}
    for mirror in (False, True):
        for s in PEAK_SCALES:
            img = _resized(peak, s, mirror)
            out[f"peak_{s}{'m' if mirror else ''}"] = img
            if s >= 1.0:
                out[f"peak_{s}{'m' if mirror else ''}_snow"] = _snowcap(img)
        for s in FOOT_SCALES:
            out[f"foot_{s}{'m' if mirror else ''}"] = _resized(peak, s, mirror)
        if "boulder" in kit.parts and "boulder" in kit.approved:
            b = _fill_holes(kit.part("boulder"))
            for s in FOOT_SCALES:
                out[f"boulder_{s}{'m' if mirror else ''}"] = _resized(b, s, mirror)
    if "cold_rock" in K.RECOLORS:                   # AR-T2: every peak and rock again in grey rock (cold ranges)
        out.update({f"{n}_cold": _cold_rock(img) for n, img in list(out.items())})
    res = {}
    for name, img in out.items():
        ys, xs = np.nonzero(img[..., 3] > 127)
        res[name] = (img, (int((xs.min() + xs.max()) // 2), int(ys.max())))
    _VARIANTS[key] = res
    return res


def _cold_rock(img: np.ndarray) -> np.ndarray:
    """An RGBA variant recoloured to K.RECOLORS["cold_rock"] (HSV hue shift, saturation and value factors)."""
    hue, sat, val = K.RECOLORS["cold_rock"]
    hsv = np.asarray(Image.fromarray(np.ascontiguousarray(img[..., :3])).convert("HSV")).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue * 255 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    out = img.copy()
    out[..., :3] = np.asarray(Image.frombytes("HSV", (img.shape[1], img.shape[0]), hsv.astype(np.uint8).tobytes())
                              .convert("RGB"))
    return out


def _coldify(plan: list, mat: np.ndarray, var: dict) -> list:
    """AR-T2: a peak or rock anchored in (or a cell from) a cold range takes its grey-rock variant."""
    from .bands import cold_cells  # noqa: PLC0415
    cc = cold_cells(mat)
    if not cc.any():
        return plan
    p = np.pad(cc, 1)
    cc = cc | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    hgt, wid = mat.shape
    return [(k, f"{n}_cold" if f"{n}_cold" in var and cc[min(hgt - 1, y // T), min(wid - 1, x // T)] else n, x, y)
            for k, n, x, y in plan]


def plan_peaks(mat: np.ndarray, owner: dict, kit: K.Kit, seed: int | None = None) -> list[tuple[str, int, int]]:
    """Where the peaks go: [(variant, anchor x, anchor y)] in drawing (y) order. Poisson disc inside the mountain
    outline (spacing 30 px x scale), anchored at the bottom, bigger and snow-capped peaks deeper inside the range,
    overhanging walkable cells by at most 8 px; plus small peaks and boulders scattered on the foothills."""
    seed, names, label = _cached_partition(mat, seed)
    if "mountain" not in names:
        return []
    var = variants(kit)
    hgt, wid = mat.shape
    H, W = hgt * T, wid * T
    free = np.ones((hgt, wid), bool)
    for (x, y) in owner:
        free[y, x] = False
    mcells = (mat == "mountain") & free
    mpx = (label == names.index("mountain")) & _up(mcells)
    allowed = _dist(_up(mat == "mountain"), OVERHANG) <= OVERHANG
    depth = _low_dist(~_up(mat == "mountain"), 3 * T)              # px from the range's edge
    plan: list[tuple[float, str, int, int]] = []
    # chunk by chunk (GAP-14): each chunk draws from its own rng and keeps its anchors half the widest spacing inside
    # its border, so two chunks' peaks keep the spacing without looking at each other
    margin = int(np.ceil(PEAK_SPACING * max(PEAK_SCALES) / 2))
    for col, row, (ay0, ay1, ax0, ax1) in _inner_boxes(H, W, margin):
        pts = np.argwhere(mpx[ay0:ay1, ax0:ax1]) + (ay0, ax0)
        if not len(pts):
            continue
        rng = chunk_rng("peaks", col, row)
        pts = pts[rng.choice(len(pts), size=min(len(pts), max(64, len(pts) // 60)), replace=False)]
        key = depth[pts[:, 0], pts[:, 1]] + rng.random(len(pts)) * 30
        pts = pts[np.argsort(-key, kind="stable")]
        placed: list[tuple[int, int, float]] = []
        grid: dict[tuple[int, int], list[int]] = {}
        for y, x in pts.tolist():
            dcell = depth[y, x] / T
            opts = [1.25, 1.0] if dcell >= 1.25 else [1.0, 0.8] if dcell >= 0.5 else [0.8, 0.6]
            for s in (opts if rng.random() < 0.65 else opts[::-1]):
                snow = s >= 1.0 and dcell >= 2 and rng.random() < 0.75
                name = f"peak_{s}{'m' if rng.random() < 0.5 else ''}{'_snow' if snow else ''}"
                img, (ax, ay) = var[name]
                gy, gx = (y + CTX.oy) // 40, (x + CTX.ox) // 40     # global bins: the same in every window
                near = [placed[j] for a in (-1, 0, 1) for b in (-1, 0, 1) for j in grid.get((gy + a, gx + b), [])]
                if any((py - y) ** 2 + (px - x) ** 2 < (PEAK_SPACING * (s + ps) / 2) ** 2 for py, px, ps in near):
                    continue
                if not _fits(img, x - ax, y - ay, allowed):
                    continue
                grid.setdefault((gy, gx), []).append(len(placed))
                placed.append((y, x, s))
                plan.append((y, name, x, y))
                break
    plan += _foothill_rocks(mat, label, names, free, var, H, W)
    plan = _coldify(plan, mat, var)
    plan.sort(key=lambda p: (p[0], p[2]))
    return [(n, x, y) for _, n, x, y in plan]


def _inner_boxes(H: int, W: int, margin: int):
    """(col, row, box) per chunk of the window: the chunk's px (window coordinates) shrunk by `margin` on every side
    (global chunk borders, so the same in every window), clipped to the window; empty boxes are skipped."""
    for col, row, _ in window_chunks(H, W):
        gy, gx = row * CPX - CTX.oy, col * CPX - CTX.ox
        box = (max(0, gy + margin), min(H, gy + CPX - margin), max(0, gx + margin), min(W, gx + CPX - margin))
        if box[0] < box[1] and box[2] < box[3]:
            yield col, row, box


def _fits(img: np.ndarray, px: int, py: int, allowed: np.ndarray) -> bool:
    H, W = allowed.shape
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, px), max(0, py), min(W, px + w), min(H, py + h)
    if x0 >= x1 or y0 >= y1:
        return False
    sub = img[y0 - py:y1 - py, x0 - px:x1 - px, 3] > 127
    return not (sub & ~allowed[y0:y1, x0:x1]).any()


def _overlap(img: np.ndarray, px: int, py: int, mask: np.ndarray) -> int:
    """Opaque pixels of img (placed at px, py) that fall on mask."""
    H, W = mask.shape
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, px), max(0, py), min(W, px + w), min(H, py + h)
    if x0 >= x1 or y0 >= y1:
        return 0
    return int(((img[y0 - py:y1 - py, x0 - px:x1 - px, 3] > 127) & mask[y0:y1, x0:x1]).sum())


def _foothill_rocks(mat, label, names, free, var, H, W) -> list[tuple[float, str, int, int]]:
    """Small peaks (0.5-0.6x) and boulders scattered by Poisson disc on the grass of the foothills, chunk by chunk
    (each chunk its own rng; anchors half the spacing inside the chunk's border)."""
    grass_cells = (mat == "grass") & free
    if "grass" not in names or not grass_cells.any():
        return []
    ok = (label == names.index("grass")) & _up(grass_cells)
    core = _core(H, W)
    d = _low_dist(label == names.index("mountain"), FOOT + 8)
    zone = ok & (d >= 6) & (d <= FOOT * 0.8)
    rocks = [n for n in var if n.startswith(("boulder_", "foot_")) and not n.endswith("_cold")]
    plan = []
    for col, row, (ay0, ay1, ax0, ax1) in _inner_boxes(H, W, int(np.ceil(2.2 * T / 2))):
        pts = np.argwhere(zone[ay0:ay1, ax0:ax1]) + (ay0, ax0)
        if not len(pts):
            continue
        rng = chunk_rng("rocks", col, row)
        pts = pts[rng.permutation(len(pts))[:max(32, len(pts) // 200)]]
        for i in _poisson(pts, 2.2 * T, rng):
            if rng.random() < 0.35:
                continue
            y, x = pts[i]
            name = rocks[int(rng.integers(len(rocks)))]
            img, (ax, ay) = var[name]
            px, py = int(x - ax), int(y - ay)
            if _fits(img, px, py, ok) and _overlap(img, px, py, core) <= ROCK_CORE:
                plan.append((float(y), name, int(x), int(y)))
    return plan


def place_peaks(canvas: Image.Image, mat: np.ndarray, owner: dict, kit: K.Kit, rng: np.random.Generator) -> None:
    """Mountains for `terrain: organic`. Uses its own generator seeded from the map (not `rng`), so --metrics can
    replay the placement."""
    if "peak" not in kit.parts:
        return
    var = variants(kit)
    for name, x, y in plan_peaks(mat, owner, kit):
        img, (ax, ay) = var[name]
        im = Image.fromarray(img)
        px, py = x - ax, y - ay
        if px < 0 or py < 0:
            im = im.crop((max(0, -px), max(0, -py), im.width, im.height))
            px, py = max(0, px), max(0, py)
        canvas.alpha_composite(im, (px, py))

"""Organic overworld terrain for the map compiler (T3b: OW-4 / OW-5; docs/FIX_PLAN_PENINSULA.md).

Used by build_map.py for sources that set `terrain: organic`; every other map keeps the classic painting.
Only the approved kit art is used: the overworld textures and the `peak`, `tree_clump` and `boulder` parts.

  paint_soft(below, mat, kit, seed)            ground: organic outlines, dithered blends, beaches, banks, foothills
  place_peaks(canvas, mat, owner, kit, rng)    mountain ranges from peak variants, foothill rocks
  metrics(src, compiled)                       boundary / peak / foothill / fidelity numbers (build_map --metrics)
  selftest()                                   synthetic maps; each case fails on the classic painting

Determinism: every random choice comes from numpy generators seeded by the map seed; nothing iterates a set.
"""
from __future__ import annotations

import zlib
from pathlib import Path

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
# domain warp octaves: (value-noise cell px, amplitude px). The coarse octave (14 px) is soft-limited to 6.5 px
# through tanh(3 n / sqrt(|n| + eps)): the outline crosses a cell line steeply and otherwise keeps a few px off it,
# and the total (< 10 px) never reaches the clamped cell centre, which would cut straight notches. The 6 px octave
# breaks the flat stretches of the smooth noise. Each warp component changes WARP_STRETCH times more slowly along
# its own axis, which (with eps) keeps the warp from folding an outline into thin slivers.
WARP_COARSE = (96, 14.0, 6.5)                      # cell, nominal amplitude, soft limit
WARP_FINE = ((24, 2.5), (6, 1.0))
WARP_EPS, WARP_STRETCH = 0.01, 2
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

_PARTITION: dict[int, tuple[int, list[str], np.ndarray]] = {}   # mat key -> (seed, names, label), set by paint_soft
_VARIANTS: dict[bytes, dict[str, tuple[np.ndarray, tuple[int, int]]]] = {}   # peak art -> variants


# ───────────────────────────── helpers ─────────────────────────────

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


# ───────────────────────────── partition ─────────────────────────────

def wild_cells(mat: np.ndarray) -> np.ndarray:
    """Per cell, the WILD material its ground is drawn from: roads sit on grass; bridges and other hard cells take
    the water under them, else the most common wild neighbour (ties: WILD order)."""
    hgt, wid = mat.shape
    out = mat.astype("<U12").copy()
    for y in range(hgt):
        for x in range(wid):
            m = mat[y, x]
            if m in WILD:
                continue
            if m in ROADS:
                out[y, x] = "grass"
                continue
            near = [mat[yy, xx] for yy in range(max(0, y - 1), min(hgt, y + 2))
                    for xx in range(max(0, x - 1), min(wid, x + 2)) if mat[yy, xx] in WILD]
            water = [n for n in near if n in WATERS]
            pool = water or near
            out[y, x] = min(WILD, key=lambda w: (-pool.count(w), WILD.index(w))) if pool else "grass"
    return out


def _warp(H: int, W: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """(wy, wx). Each component changes WARP_STRETCH times more slowly along its own axis than across it, so the
    warp never folds an outline over itself (no thin slivers), while it still wanders along the outline."""
    def axis(base: int, along_y: bool) -> np.ndarray:
        def noise(c: int, k: int) -> np.ndarray:
            slow, fast = c * WARP_STRETCH, c
            return _vnoise(H, W, slow if along_y else fast, seed + base + k, fast if along_y else slow)
        cell, amp, lim = WARP_COARSE
        n = noise(cell, 0)
        out = lim * np.tanh(amp / lim * 1.4 * n / np.sqrt(np.abs(n) + WARP_EPS))
        for k, (c, a) in enumerate(WARP_FINE):
            out += a * noise(c, 1 + k)
        return out.astype(np.float32)
    return axis(101, True), axis(201, False)


def partition(mat: np.ndarray, seed: int) -> tuple[list[str], np.ndarray]:
    """Per-pixel index into `names`: each material's cell mask blurred (r 20 px, twice), resampled through the
    two-octave domain warp, the strongest field wins (= threshold 0.5 between two materials); then the centre
    CORE px of every cell is clamped to the cell's own material, so collision always matches the art."""
    wild = wild_cells(mat)
    hgt, wid = wild.shape
    H, W = hgt * T, wid * T
    names = [m for m in WILD if (wild == m).any()]
    lo, r = T // LOW, BLUR_R // LOW
    wy, wx = _warp(H, W, seed)
    h, w = hgt * lo, wid * lo
    sy = np.clip((np.arange(H, dtype=np.float32)[:, None] + wy) / LOW - 0.5, 0, h - 1.001)
    sx = np.clip((np.arange(W, dtype=np.float32)[None, :] + wx) / LOW - 0.5, 0, w - 1.001)
    y0, x0 = sy.astype(np.int32), sx.astype(np.int32)
    fy, fx = sy - y0, sx - x0
    i00 = y0 * w + x0
    best = np.full((H, W), -1.0, np.float32)
    label = np.zeros((H, W), np.uint8)
    own = _up(np.vectorize(names.index)(wild).astype(np.uint8))
    # in corner cells (two or more sides on another material) the cell's own material gains strength over the last
    # px before its clamped centre, so an outline that would cut into the centre bends around it, not cut off straight
    iy, ix = np.arange(H) % T, np.arange(W) % T
    oy = np.maximum(np.maximum(MARGIN - iy, iy - (MARGIN + CORE - 1)), 0).astype(np.float32)[:, None]
    ox = np.maximum(np.maximum(MARGIN - ix, ix - (MARGIN + CORE - 1)), 0).astype(np.float32)[None, :]
    bonus = CORE_PULL * np.clip(1 - np.sqrt(oy * oy + ox * ox) / CORE_REACH, 0, 1)
    pad = np.pad(wild, 1, mode="edge")
    sides = sum((pad[1 + dy:1 + dy + hgt, 1 + dx:1 + dx + wid] != wild).astype(np.int8)
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)))
    bonus = bonus * _up(sides >= 2)                     # only corner cells: straight edges keep their warp
    for i, m in enumerate(names):
        f = _blur(_blur(_up((wild == m).astype(np.float32), lo), r), r).ravel()
        v = ((f[i00] * (1 - fx) + f[i00 + 1] * fx) * (1 - fy) + (f[i00 + w] * (1 - fx) + f[i00 + w + 1] * fx) * fy)
        v = np.where(own == i, v + bonus, v)
        upd = v > best
        best[upd] = v[upd]
        label[upd] = i
    core = _core(H, W)
    label[core] = own[core]
    return names, label


def _cached_partition(mat: np.ndarray, seed: int | None = None) -> tuple[int, list[str], np.ndarray]:
    k = _key(mat)
    if k in _PARTITION and (seed is None or _PARTITION[k][0] == seed):
        return _PARTITION[k]
    seed = k % 100000 if seed is None else seed
    names, label = partition(mat, seed)
    if len(_PARTITION) > 3:
        _PARTITION.pop(next(iter(_PARTITION)))
    _PARTITION[k] = (seed, names, label)
    return _PARTITION[k]


# ───────────────────────────── ground ─────────────────────────────

def paint_soft(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Step 1 for `terrain: organic`: the soft ground with organic outlines and blends (see the module docstring)."""
    H, W = below.shape[:2]
    _, names, label = _cached_partition(mat, seed)
    lab = {m: label == i for i, m in enumerate(names)}
    none = np.zeros((H, W), bool)
    get = lambda m: lab.get(m, none)  # noqa: E731
    tex = {m: _tile(kit.material(TEX.get(m, m)), H, W) for m in names}
    for m in names:
        below[lab[m]] = tex[m][lab[m]]
    rng = np.random.default_rng(seed + 7)
    bayer, core = _bayer(H, W), _core(H, W)
    road_cells = _up(np.isin(mat, ROADS))
    grass, sand = get("grass").copy(), get("sand").copy()
    sand_tex = _tile(kit.material("sand"), H, W)
    grass_tex = _tile(kit.material("grass"), H, W)
    soil = _tile(kit.material("dirt"), H, W)
    ocean = get("ocean")
    # beach: ocean meeting grass grows a 6-10 px sand strip on the land side (never into a grass cell's centre)
    if ocean.any() and grass.any():
        d = _dist(ocean, BEACH[1] + 8)
        width = BEACH[0] + (BEACH[1] - BEACH[0]) * (_vnoise(H, W, 40, seed + 11) * 0.5 + 0.5)
        n = np.clip(0.5 + 0.5 * _vnoise(H, W, 24, seed + 12) + 0.35 * _vnoise(H, W, 8, seed + 14), 0, 1)
        width = _steer(d, width, n)                     # keep the inner edge off cell lines and cell centres
        p = np.clip((width - d) / 3.0, 0, 1)
        beach = grass & ~core & ~road_cells & (p > bayer)
        below[beach] = sand_tex[beach]
        grass &= ~beach
        sand |= beach
    # grass / sand: a 10 px band dithered with a 4x4 Bayer matrix instead of a dark line
    if grass.any() and sand.any():
        half = SAND_BAND / 2
        ds, dg = _dist(sand, int(half) + 1), _dist(grass, int(half) + 1)
        s = np.where(sand, 0.5 + (dg - 1) / SAND_BAND, 0.5 - ds / SAND_BAND)
        band = (sand & (dg <= half)) | (grass & (ds <= half))
        band &= ~core
        to_sand = band & grass & (s > bayer)
        to_grass = band & sand & (s <= bayer)
        below[to_sand] = sand_tex[to_sand]
        below[to_grass] = grass_tex[to_grass]
        grass = (grass & ~to_sand) | to_grass
        sand = (sand & ~to_grass) | to_sand
    # rivers and lakes: 3 px dithered earth banks on the land side
    fresh = get("river") | get("lake")
    if fresh.any():
        d = _dist(fresh, BANK + 1)
        bank = (grass | sand) & ~core & (d <= BANK) & (np.clip((BANK + 1.0 - d) / (BANK + 0.5), 0, 1) > bayer)
        below[bank] = soil[bank]
        grass &= ~bank
    # foothills: grass within a cell of a mountain shows the mountain texture at 40 -> 10 % (a little less on the
    # first px, so the range keeps its own edge; fading out past a noisy reach), dithered with Bayer plus some
    # low-frequency noise so the rock gathers a little
    mountain = get("mountain")
    if mountain.any():
        d = _low_dist(mountain, FOOT + FOOT_FADE + 16)
        reach = FOOT - 8 + 16 * (_vnoise(H, W, 48, seed + 15) * 0.5 + 0.5)
        ramp = FOOT_RISE[0] + (1 - FOOT_RISE[0]) * np.clip(d / FOOT_RISE[1], 0, 1)
        line = lambda v: FOOT_COVER[0] - (FOOT_COVER[0] - FOOT_COVER[1]) * v / FOOT  # noqa: E731
        cover = np.where(d <= reach, line(d), line(reach) * np.clip(1 - (d - reach) / FOOT_FADE, 0, 1)) * ramp
        cover = np.where(core, np.minimum(cover, 0.33), cover)    # a grass cell's centre stays mostly grass
        a = FOOT_PATCH                                  # share of the low-frequency noise in the threshold
        t = (1 - a) * bayer + a * np.clip(_vnoise(H, W, 8, seed + 13) * 0.6 + 0.5, 0, 1)
        b = 1 - a                                       # the CDF of the mix, so that cover = coverage
        thr = np.where(t < a, t * t / (2 * a * b), np.where(t <= b, (t - a / 2) / b, 1 - (1 - t) ** 2 / (2 * a * b)))
        foot = grass & ~mountain & (d > 0) & (cover > thr)
        mtex = tex["mountain"]
        below[foot] = mtex[foot]
        if ocean.any():                                  # a dark rock rim where mountains meet the sea
            dm = _dist(ocean, 3)
            _shade(below, mountain & (dm <= 1.5), 0.5)
            _shade(below, mountain & (dm > 1.5) & (dm <= 3) & (bayer < 0.5), 0.7)
    # roads: their own cells, with a small ragged edge (the partition put grass under them)
    for m in ROADS:
        cells = _up(mat == m)
        if not cells.any():
            continue
        inset = (_vnoise(H, W, 6, seed + 17 + ROADS.index(m)) * 0.5 + 0.5) * 4
        show = cells & (_inner_depth(cells, 5) > inset)
        below[show] = _tile(kit.material(m), H, W)[show]
        _shade(below, _edge(show) & ~_edge(cells), 0.85)
    _forest(below, get("forest"), (grass | sand) & ~road_cells & ~core, kit, rng)
    _water(below, [get(m) for m in WATERS], {m: get(m) for m in WATERS}, bayer, seed)


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


def _clumps(kit: K.Kit) -> list[tuple[np.ndarray, int, int]]:
    """tree_clump at 0.8 / 1.0 scale, as drawn and mirrored: (RGBA, centre y, centre x)."""
    out = []
    for s in (1.0, 0.8):
        for mirror in (False, True):
            img = _resized(kit.part("tree_clump"), s, mirror)
            ys, xs = np.nonzero(img[..., 3] > 127)
            out.append((img, int((ys.min() + ys.max()) // 2), int((xs.min() + xs.max()) // 2)))
    return out


def _steer(d: np.ndarray, width: np.ndarray, n: np.ndarray) -> np.ndarray:
    """Band widths for a band drawn as `d <= width` (d: distance from the band's outer edge, dithered over a 3 px
    ramp). Where the band would reach the clamped cell centre (and follow the centre squares) it narrows to a 2.5-4
    px strip that follows its outer edge; an inner edge that would run within 4.5 px of a cell line parallel to it
    moves to 4.5-9 px past the line (n in 0..1 picks where). Along the band's normal, s - d is constant (s: signed offset
    from the nearest parallel cell line), so every pixel of a normal makes the same choice."""
    H, W = d.shape
    gy, gx = np.zeros_like(d), np.zeros_like(d)
    gy[1:-1], gx[:, 1:-1] = d[2:] - d[:-2], d[:, 2:] - d[:, :-2]
    ry = (np.arange(H, dtype=np.float32) - T * np.round(np.arange(H) / T))[:, None] + 0.5
    rx = (np.arange(W, dtype=np.float32) - T * np.round(np.arange(W) / T))[None, :] + 0.5
    horiz = np.abs(gy) >= np.abs(gx)
    s = np.where(horiz, ry * np.sign(gy), rx * np.sign(gx))
    edge = s - d + width - 1.5                           # offset of the inner edge from the line
    width = np.where(edge > MARGIN - 1, 2.5 + 1.5 * n, width)   # deep: a thin strip that follows the coast
    edge = s - d + width - 1.5
    target = 4.5 + (MARGIN - 5.5) * n
    return np.where(np.abs(edge) < 4.5, width + target - edge, width)


def _line_edges(mask: np.ndarray, y0: int, x0: int) -> tuple[int, int]:
    """A mask's edges inside the box at (y0, x0): (all, those running along a cell line within 2 px)."""
    eh = mask[:-1, :] != mask[1:, :]
    ev = mask[:, :-1] != mask[:, 1:]
    ly = np.isin((np.arange(eh.shape[0]) + y0 + 1) % T, NEAR_LINE)
    lx = np.isin((np.arange(ev.shape[1]) + x0 + 1) % T, NEAR_LINE)
    return int(eh.sum() + ev.sum()), int(eh[ly].sum() + ev[:, lx].sum())


def _forest(below: np.ndarray, forest: np.ndarray, open_ground: np.ndarray, kit: K.Kit,
            rng: np.random.Generator) -> None:
    """Forest edges: tree_clump stamps about every 40 px along the outline (sticking out at most 14 px, only onto
    open grass or sand outside other cells' centres), a 1 px canopy rim and a 3 px shadow cast to the south-east."""
    if not forest.any():
        return
    H, W = forest.shape
    canopy = forest.copy()
    if "tree_clump" in kit.parts and "tree_clump" in kit.approved:
        clumps = _clumps(kit)
        out_d = _dist(forest, CLUMP_OUT + 1)
        inner = _inner_depth(forest, 13)
        cand = np.argwhere(forest & (inner >= 3) & (inner <= 12))
        land = forest | open_ground

        def fits(i: int) -> bool:
            # a clump bulges 2-14 px past the outline, onto open ground, and its new edge does not run along a
            # cell line (the partition keeps the outline off them; a bulge must not bring it back)
            y, x = cand[i]
            part, cy, cx = clumps[int(rng.integers(len(clumps)))]
            py, px = int(y - cy), int(x - cx)
            y0, x0, y1, x1 = max(0, py), max(0, px), min(H, py + part.shape[0]), min(W, px + part.shape[1])
            sub = part[y0 - py:y1 - py, x0 - px:x1 - px, 3] > 127
            stick = out_d[y0:y1, x0:x1][sub]
            if not stick.size or not CLUMP_BULGE[0] <= stick.max() <= CLUMP_BULGE[1] or (sub & ~land[y0:y1, x0:x1]).any():
                return False
            n0, l0 = _line_edges(canopy[y0:y1, x0:x1], y0, x0)
            n1, l1 = _line_edges(canopy[y0:y1, x0:x1] | sub, y0, x0)
            if l1 - l0 > 0.05 * n1:
                return False
            canopy[:] |= _stamp(below, part, px, py)
            return True

        if len(cand):
            cand = cand[rng.permutation(len(cand))[:max(1, len(cand) // 3)]]
            _poisson(cand, CLUMP_STEP, rng, ok=fits)
    rim = _edge(forest) & ~(canopy & ~forest)
    p = np.pad(canopy, 1, mode="edge")
    rim &= ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    _shade(below, rim, 0.55)
    shadow = np.zeros_like(canopy)
    for k in range(1, 4):
        shadow[k:, k:] |= canopy[:-k, :-k]
    _shade(below, shadow & ~canopy, 0.72)


def _water(below: np.ndarray, layers: list[np.ndarray], by: dict[str, np.ndarray], bayer: np.ndarray, seed: int) -> None:
    """Shallow water (ocean and lakes within 10 px of land tinted 35 % toward cyan, dithered) and a foam line
    broken by noise."""
    water = np.logical_or.reduce(layers)
    if not water.any() or water.all():
        return
    H, W = water.shape
    d = _dist(~water, SHALLOW + 1)
    deep = by["ocean"] | by["lake"]
    shallow = deep & (d <= SHALLOW) & (np.clip((SHALLOW + 1 - d) / SHALLOW, 0, 1) > bayer)
    px = below[shallow].astype(np.float32)
    below[shallow] = (px * (1 - SHALLOW_TINT) + CYAN * SHALLOW_TINT).astype(np.uint8)
    n = _vnoise(H, W, 10, seed + 23)
    foam = water & (d <= 1.0) & (n > -0.25)
    below[foam] = np.minimum(below[foam].astype(np.int32) + 70, 255).astype(np.uint8)
    spray = water & (d > 1.0) & (d <= 2.5) & (n > 0.35) & (bayer < 0.5)
    below[spray] = np.minimum(below[spray].astype(np.int32) + 40, 255).astype(np.uint8)


# ───────────────────────────── peaks ─────────────────────────────

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
    res = {}
    for name, img in out.items():
        ys, xs = np.nonzero(img[..., 3] > 127)
        res[name] = (img, (int((xs.min() + xs.max()) // 2), int(ys.max())))
    _VARIANTS[key] = res
    return res


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
    rng = np.random.default_rng(seed + 31)
    free = np.ones((hgt, wid), bool)
    for (x, y) in owner:
        free[y, x] = False
    mcells = (mat == "mountain") & free
    mpx = (label == names.index("mountain")) & _up(mcells)
    allowed = _dist(_up(mat == "mountain"), OVERHANG) <= OVERHANG
    depth = _low_dist(~_up(mat == "mountain"), 3 * T)              # px from the range's edge
    plan: list[tuple[float, str, int, int]] = []
    pts = np.argwhere(mpx)
    if len(pts):
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
                gy, gx = y // 40, x // 40
                near = [placed[j] for a in (-1, 0, 1) for b in (-1, 0, 1) for j in grid.get((gy + a, gx + b), [])]
                if any((py - y) ** 2 + (px - x) ** 2 < (PEAK_SPACING * (s + ps) / 2) ** 2 for py, px, ps in near):
                    continue
                if not _fits(img, x - ax, y - ay, allowed):
                    continue
                grid.setdefault((gy, gx), []).append(len(placed))
                placed.append((y, x, s))
                plan.append((y, name, x, y))
                break
    plan += _foothill_rocks(mat, label, names, free, var, rng, H, W)
    plan.sort(key=lambda p: (p[0], p[2]))
    return [(n, x, y) for _, n, x, y in plan]


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


def _foothill_rocks(mat, label, names, free, var, rng, H, W) -> list[tuple[float, str, int, int]]:
    """Small peaks (0.5-0.6x) and boulders scattered by Poisson disc on the grass of the foothills."""
    grass_cells = (mat == "grass") & free
    if "grass" not in names or not grass_cells.any():
        return []
    ok = (label == names.index("grass")) & _up(grass_cells)
    core = _core(H, W)
    d = _low_dist(label == names.index("mountain"), FOOT + 8)
    zone = ok & (d >= 6) & (d <= FOOT * 0.8)
    pts = np.argwhere(zone)
    if not len(pts):
        return []
    pts = pts[rng.permutation(len(pts))[:max(32, len(pts) // 200)]]
    rocks = [n for n in var if n.startswith(("boulder_", "foot_"))]
    plan = []
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


# ───────────────────────────── metrics ─────────────────────────────

GROUPS = {"coast": (("ocean", "water"), ("grass", "sand", "forest", "mountain", "dirt")),
          "sand_grass": (("sand",), ("grass",)), "forest_grass": (("forest",), ("grass",)),
          "mountain_grass": (("mountain",), ("grass",))}


PART_OF = {"forest": ("tree_clump",), "mountain": ("peak", "boulder")}


def classify(below: np.ndarray, kit: K.Kit, mats: tuple[str, ...]) -> np.ndarray:
    """Per pixel, the index into mats of the texture (tiled at that pixel) it is closest to. Shadows and rims are
    not materials: the texture is also tried at the shading factors both painters use."""
    H, W = below.shape[:2]
    best = np.full((H, W), np.inf, np.float32)
    out = np.zeros((H, W), np.uint8)
    b = below.astype(np.float32)
    for i, m in enumerate(mats):
        t = _tile(kit.material(m), H, W).astype(np.float32)
        d = np.min([np.abs(b - t * f).sum(axis=2) for f in (1.0, 0.85, 0.8, 0.72, 0.6, 0.55)], axis=0)
        parts = [kit.parts[p] for p in PART_OF.get(m, ()) if p in kit.parts and p in kit.approved]
        if parts:                                  # stamped art (clumps, peaks, rocks) counts as its material
            pal = np.unique(np.concatenate([np.asarray(p.convert("RGBA"))[..., :3][np.asarray(p)[..., 3] > 127]
                                            for p in parts]), axis=0).astype(np.int32)
            packed = (below[..., 0].astype(np.int32) << 16) | (below[..., 1].astype(np.int32) << 8) | below[..., 2]
            cols, inv = np.unique(packed, return_inverse=True)
            rgb = np.stack([cols >> 16, (cols >> 8) & 255, cols & 255], axis=1)
            dp = np.abs(rgb[:, None, :] - pal[None, :, :]).sum(axis=2).min(axis=1)
            d = np.minimum(d, dp[inv.reshape(H, W)].astype(np.float32))
        upd = d < best
        best[upd] = d[upd]
        out[upd] = i
    return out


def boundary_stats(a: np.ndarray, b: np.ndarray, window: tuple[slice, slice] | None = None) -> dict[str, float]:
    """Boundary between pixel sets a and b (smoothed r 4, so dither does not count as boundary): the longest
    straight axis-aligned run (px) and the share of boundary edges that run along a cell line within 2 px."""
    fa, fb = _blur(_blur(a.astype(np.float32), 4), 4), _blur(_blur(b.astype(np.float32), 4), 4)
    region = (fa + fb) > 0.6
    side = fa > 1.5 * fb                     # a: its clear majority (60 %); a dithered fringe below that is not its edge
    eh = region[:-1, :] & region[1:, :] & (side[:-1, :] != side[1:, :])      # between rows y and y+1
    ev = region[:, :-1] & region[:, 1:] & (side[:, :-1] != side[:, 1:])      # between columns x and x+1
    if window is not None:
        ys, xs = window
        eh, ev = eh[ys, xs], ev[ys, xs]
        oy, ox = ys.start or 0, xs.start or 0
    else:
        oy = ox = 0
    n = int(eh.sum() + ev.sum())
    if not n:
        return {"edges": 0, "longest_run": 0, "on_cell_line": 0.0}
    ly = (np.arange(eh.shape[0]) + oy + 1) % T
    lx = (np.arange(ev.shape[1]) + ox + 1) % T
    near_h = eh & np.isin(ly, [T - 2, T - 1, 0, 1, 2])[:, None]
    near_v = ev & np.isin(lx, [T - 2, T - 1, 0, 1, 2])[None, :]
    return {"edges": n, "longest_run": int(max(_longest(eh), _longest(ev.T))),
            "on_cell_line": round(float(near_h.sum() + near_v.sum()) / n, 3)}


def _longest(e: np.ndarray) -> int:
    d = np.diff(np.pad(e, ((0, 0), (1, 1))).astype(np.int8), axis=1)
    s, t = np.nonzero(d == 1), np.nonzero(d == -1)
    return int((t[1] - s[1]).max()) if len(s[1]) else 0


def peak_stats(placements: list[tuple[str, int, int]]) -> dict[str, float]:
    peaks = [(n, x, y) for n, x, y in placements if n.startswith("peak")]   # not the foothill rocks
    if not peaks:
        return {"peaks": 0, "variants": 0, "anchor_std_mod48": 0.0}
    xs, ys = np.array([p[1] for p in peaks]) % T, np.array([p[2] for p in peaks]) % T
    return {"peaks": len(peaks), "variants": len({p[0] for p in peaks}),
            "anchor_std_mod48": round(float(min(xs.std(), ys.std())), 1)}


def foothill_share(below: np.ndarray, mat: np.ndarray, kit: K.Kit) -> float:
    """Share of grass cells 4-next to a mountain cell whose centre holds foothill pixels (mountain texture or rock)."""
    H, W = below.shape[:2]
    mtex = _tile(kit.material("mountain"), H, W)
    gtex = _tile(kit.material("grass"), H, W)
    hgt, wid = mat.shape
    hits = total = 0
    for y in range(hgt):
        for x in range(wid):
            if mat[y, x] != "grass" or not any(0 <= y + b < hgt and 0 <= x + a < wid and mat[y + b, x + a] == "mountain"
                                               for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            sl = (slice(y * T + MARGIN, y * T + MARGIN + CORE), slice(x * T + MARGIN, x * T + MARGIN + CORE))
            px = below[sl].astype(np.int32)
            rock = np.all(px == mtex[sl], axis=2) | (np.abs(px - gtex[sl]).sum(axis=2) > 120)
            total += 1
            hits += int(rock.sum() >= 10)
    return round(hits / total, 3) if total else 1.0


FID_MATS = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt", "cobble")


def fidelity(below: np.ndarray, mat: np.ndarray, kit: K.Kit, skip: set | None = None) -> dict[str, float]:
    """Per soft cell: the share of its centre CORE px that read as its own material (classify: its texture, shaded,
    or its stamped art); the minimum and the number of cells under 50 %."""
    cls = classify(below, kit, FID_MATS)
    worst, bad = 1.0, 0
    hgt, wid = mat.shape
    for y in range(hgt):
        for x in range(wid):
            m = mat[y, x]
            if m not in WILD + list(ROADS) or (skip and (x, y) in skip):
                continue
            sl = (slice(y * T + MARGIN, y * T + MARGIN + CORE), slice(x * T + MARGIN, x * T + MARGIN + CORE))
            share = float((cls[sl] == FID_MATS.index(TEX.get(m, m))).mean())
            worst = min(worst, share)
            bad += share < 0.5
    return {"min_core_share": round(worst, 3), "cells_below_half": bad}


class _Recorder:
    """Stands in for the canvas: records which part goes where (for peak metrics)."""

    def __init__(self, names: dict[int, str]):
        self.names, self.pastes = names, []

    def alpha_composite(self, im, dest):
        self.pastes.append((self.names.get(id(im), "peak"), dest))


def metrics(src: dict, compiled) -> dict:
    """The T3b numbers for a compiled map (build_map.py --metrics)."""
    import build_map as B  # noqa: PLC0415
    kit = B.K.load_kits(src.get("kits") or [src.get("kit", "town")])
    mat, below = compiled.mat, compiled.below
    mats = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt")
    cls = classify(below, kit, mats)
    # roads, bridges, walls and objects are square by design: only the wild ground is measured
    wild = np.isin(mat, WILD)
    for (x, y) in compiled.owner:
        wild[y, x] = False
    keep = _up(wild)
    out: dict = {}
    for name, (ga, gb) in GROUPS.items():
        a = np.isin(cls, [mats.index(m) for m in ga]) & keep
        b = np.isin(cls, [mats.index(m) for m in gb]) & keep
        out[name] = boundary_stats(a, b)
    organic = src.get("terrain") == "organic"
    if organic and "peak" in kit.parts:
        seed = sum(map(ord, src["id"]))
        _cached_partition(mat, seed)
        out["peaks"] = peak_stats(plan_peaks(mat, compiled.owner, kit))
    elif "peak" in kit.parts:
        part = kit.part("peak")
        rec = _Recorder({id(part): "peak"})
        B.place_peaks(rec, mat, compiled.owner, kit, np.random.default_rng(sum(map(ord, src["id"]))))
        ax, ay = 24, 47
        out["peaks"] = peak_stats([(n, x + ax, y + ay) for n, (x, y) in rec.pastes])
    out["foothills"] = foothill_share(below, mat, kit)
    out["fidelity"] = fidelity(below, mat, kit, set(compiled.owner))
    return out


# ───────────────────────────── selftest ─────────────────────────────

def _ground(mat_rows: list[str], kit: K.Kit, organic: bool, seed: int = 99) -> tuple[np.ndarray, np.ndarray]:
    import build_map as B  # noqa: PLC0415
    mat = np.array(B.parse_ground("\n".join(mat_rows)))
    below = np.zeros((mat.shape[0] * T, mat.shape[1] * T, 3), np.uint8)
    (paint_soft if organic else B.paint_soft)(below, mat, kit, seed)
    return mat, below


def _boundary_case(rows, kit, organic, ga, gb, window):
    mat, below = _ground(rows, kit, organic)
    mats = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt")
    cls = classify(below, kit, mats)
    a, b = np.isin(cls, [mats.index(m) for m in ga]), np.isin(cls, [mats.index(m) for m in gb])
    return boundary_stats(a, b, window), mat, below


def selftest() -> int:
    """Synthetic straight boundaries and a mountain block: every check passes on the organic painting and at least
    one check per case fails on the classic painting (build_map.paint_soft / place_peaks)."""
    import build_map as B  # noqa: PLC0415
    kit = K.load_kits(["overworld", "town"])
    ok = 0
    win = (slice(2 * T, 6 * T), slice(T, 11 * T))            # the middle 10 cells of each straight boundary
    for ch, ga, gb in (("o", ("ocean", "water"), ("grass", "sand", "forest", "mountain", "dirt")),
                       ("s", ("sand",), ("grass",)), ("f", ("forest",), ("grass",)), ("m", ("mountain",), ("grass",))):
        rows = [ch * 12] * 4 + ["." * 12] * 4                   # a straight 12-cell boundary between rows 3 and 4
        cols = [ch * 4 + "." * 8] * 12                          # and a vertical one between columns 3 and 4
        for case, w in ((rows, win), (cols, (slice(T, 11 * T), slice(2 * T, 6 * T)))):
            new, mat, below = _boundary_case(case, kit, True, ga, gb, w)
            old, _, _ = _boundary_case(case, kit, False, ga, gb, w)
            assert new["edges"] > 0, f"{ch}: no boundary found"
            assert new["longest_run"] <= 72, f"{ch}: straight run {new['longest_run']} px > 72 ({new})"
            assert new["on_cell_line"] <= 0.15, f"{ch}: {new['on_cell_line']:.0%} of the boundary on cell lines"
            assert old["longest_run"] > 72 or old["on_cell_line"] > 0.15, f"{ch}: classic passes too ({old})"
            fid = fidelity(below, mat, kit)
            assert fid["cells_below_half"] == 0, f"{ch}: a cell centre does not show its material ({fid})"
            ok += 4
    # a 6x4 mountain block in grass
    block = ["." * 12] * 3 + ["...mmmmmm..."] * 4 + ["." * 12] * 3
    mat, below = _ground(block, kit, True)
    canvas = Image.fromarray(below).convert("RGBA")
    place_peaks(canvas, mat, {}, kit, np.random.default_rng(0))
    full = np.asarray(canvas.convert("RGB"))
    ps = peak_stats(plan_peaks(mat, {}, kit))
    assert ps["variants"] >= 4, f"peaks: {ps['variants']} variants < 4"
    assert ps["anchor_std_mod48"] >= 10, f"peaks: anchor spread {ps['anchor_std_mod48']} px < 10"
    fh = foothill_share(full, mat, kit)
    assert fh >= 0.9, f"foothills in {fh:.0%} of the grass cells next to the block"
    assert fidelity(below, mat, kit)["cells_below_half"] == 0
    ok += 4
    _, old_below = _ground(block, kit, False)
    old_canvas = Image.fromarray(old_below).convert("RGBA")
    rec = _Recorder({id(kit.part("peak")): "peak"})
    B.place_peaks(rec, mat, {}, kit, np.random.default_rng(0))
    B.place_peaks(old_canvas, mat, {}, kit, np.random.default_rng(0))
    old = peak_stats([(n, x + 24, y + 47) for n, (x, y) in rec.pastes])
    assert old["variants"] < 4 and old["anchor_std_mod48"] < 10, f"classic peaks pass ({old})"
    assert foothill_share(np.asarray(old_canvas.convert("RGB")), mat, kit) < 0.9, "classic has foothills"
    ok += 1
    # the lake: no stone rim, a soft natural edge (no rim texture in it), and collision stays water
    lake = {"id": "lk", "terrain": "organic", "kits": ["overworld", "town"],
            "ground": "\n".join(["......", ".≈≈≈..", ".≈≈≈≈.", "..≈≈..", "......"]), "entrances": {"a": [0, 0]}}
    c = B.compile_map(lake, kit, check_interiors=False)
    rim = _tile(kit.material("rim"), *c.below.shape[:2])
    assert not np.all(c.below == rim, axis=2).any() and c.collision[2, 2] == B.WATER
    ok += 1
    # determinism: the same pixels again, and under other string-hash seeds (subprocesses, as --check-determinism)
    _PARTITION.clear()
    _, again = _ground(block, kit, True)
    assert np.array_equal(again, below)
    import json  # noqa: PLC0415
    import tempfile  # noqa: PLC0415
    mixed = {"id": "mix", "terrain": "organic", "kits": ["overworld", "town"], "entrances": {"a": [4, 4]},
             "ground": "\n".join(["oooooooooo", "oos..ff.mo", "os...fffmo", "o..r....mo", "o..r.≈≈..o",
                                   "o..r.≈≈..o", "ooorrooooo"])}
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "mix.json"
        f.write_text(json.dumps(mixed))
        runs = [B.hash_run([], str(f), False, seed)["mix"] for seed in ("0", "5")]
    assert runs[0] == runs[1], f"organic terrain depends on PYTHONHASHSEED: {runs}"
    ok += 2
    # the castle and the temple do not use terrain: organic and still compile to their committed chunks
    import yaml  # noqa: PLC0415
    for mid in ("cornelia-castle", "temple-of-fiends"):
        src = yaml.safe_load((B.SRC / f"{mid}.yaml").read_text())
        assert src.get("terrain") != "organic"
        cc, _ = B.compile_source(src)
        for r, col, part in B.chunks(cc.below, cc.height, cc.width):
            ref = np.asarray(Image.open(B.OUT / mid / f"below_{r}_{col}.png").convert("RGB"))
            assert np.array_equal(ref, part), f"{mid}: chunk below_{r}_{col} differs from the committed output"
        ok += 1
    print(f"terrain selftest: {ok} checks passed")
    return ok

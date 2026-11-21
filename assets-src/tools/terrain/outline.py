"""Organic outlines: the per-pixel material partition (blurred, domain-warped cell masks with clamped cell
centres), the grass / sand band and the forest edges (tree clumps, canopy rim, shadow)."""
from __future__ import annotations

import numpy as np

import kit as K
from .frame import CPX, CTX, chunk_rng, map_px, window_chunks
from .base import (BLUR_R, CLUMP_BULGE, CLUMP_OUT, CLUMP_STEP, CORE, CORE_PULL, CORE_REACH, LOW, MARGIN, NEAR_LINE,
                   ROADS, SAND_BAND, T, WARP_COARSE, WARP_EPS, WARP_FINE, WARP_GAP, WARP_MEANDER, WARP_STRETCH, WATERS,
                   WILD, _blur, _core, _dist, _edge, _inner_depth, _key, _meander, _poisson, _resized, _shade, _stamp,
                   _up, _vnoise)

_PARTITION: dict[tuple, tuple[int, list[str], np.ndarray]] = {}   # (mat, frame) -> (seed, names, label), by paint_soft


def sand_band(below: np.ndarray, grass: np.ndarray, sand: np.ndarray, core: np.ndarray, bayer: np.ndarray,
              sand_tex: np.ndarray, grass_tex: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Grass / sand: a 10 px band dithered with a 4x4 Bayer matrix instead of a dark line. Returns (grass, sand)."""
    if not (grass.any() and sand.any()):
        return grass, sand
    half = SAND_BAND / 2
    ds, dg = _dist(sand, int(half) + 1), _dist(grass, int(half) + 1)
    s = np.where(sand, 0.5 + (dg - 1) / SAND_BAND, 0.5 - ds / SAND_BAND)
    band = (sand & (dg <= half)) | (grass & (ds <= half))
    band &= ~core
    to_sand = band & grass & (s > bayer)
    to_grass = band & sand & (s <= bayer)
    below[to_sand] = sand_tex[to_sand]
    below[to_grass] = grass_tex[to_grass]
    return (grass & ~to_sand) | to_grass, (sand & ~to_grass) | to_sand


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
        mc, ma, mlo = WARP_MEANDER
        if ma:
            out += ma * _meander(H, W, mc, mlo, seed + base + 50, along_x=along_y)
        gap, reach = WARP_GAP
        if gap:                                   # push offsets off zero: an outline crosses its cell line steeply
            out = out * (1 - gap / reach) + gap * np.tanh(out / 0.75)
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
    # sample in global low-res coordinates (the same float arithmetic in every window), then index the window's
    # fields; the clamp is the whole map's edge (a window edge inside the map only matters in its ring)
    mh, mw = map_px(H, W)
    sy = np.clip((np.arange(CTX.oy, CTX.oy + H, dtype=np.float32)[:, None] + wy) / LOW - 0.5, 0, mh // LOW - 1.001)
    sx = np.clip((np.arange(CTX.ox, CTX.ox + W, dtype=np.float32)[None, :] + wx) / LOW - 0.5, 0, mw // LOW - 1.001)
    gy0, gx0 = sy.astype(np.int32), sx.astype(np.int32)
    fy, fx = sy - gy0, sx - gx0
    y0 = np.clip(gy0 - CTX.oy // LOW, 0, h - 2)
    x0 = np.clip(gx0 - CTX.ox // LOW, 0, w - 2)
    del gy0, gx0, sy, sx
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
    key = (k, CTX.map_id, CTX.oy, CTX.ox, CTX.mh, CTX.mw)    # the same cells in another window are another partition
    if key in _PARTITION and (seed is None or _PARTITION[key][0] == seed):
        return _PARTITION[key]
    seed = k % 100000 if seed is None else seed
    names, label = partition(mat, seed)
    if len(_PARTITION) > 3:
        _PARTITION.pop(next(iter(_PARTITION)))
    _PARTITION[key] = (seed, names, label)
    return _PARTITION[key]


def _line_edges(mask: np.ndarray, y0: int, x0: int) -> tuple[int, int]:
    """A mask's edges inside the box at (y0, x0): (all, those running along a cell line within 2 px)."""
    eh = mask[:-1, :] != mask[1:, :]
    ev = mask[:, :-1] != mask[:, 1:]
    ly = np.isin((np.arange(eh.shape[0]) + y0 + 1) % T, NEAR_LINE)
    lx = np.isin((np.arange(ev.shape[1]) + x0 + 1) % T, NEAR_LINE)
    return int(eh.sum() + ev.sum()), int(eh[ly].sum() + ev[:, lx].sum())


def _clumps(kit: K.Kit, part: str = "tree_clump") -> list[tuple[np.ndarray, int, int]]:
    """tree_clump (or `part`, NW2's taiga recolour) at 0.8 / 1.0 scale, as drawn and mirrored: (RGBA, centre y,
    centre x)."""
    out = []
    for s in (1.0, 0.8):
        for mirror in (False, True):
            img = _resized(kit.part(part), s, mirror)
            ys, xs = np.nonzero(img[..., 3] > 127)
            out.append((img, int((ys.min() + ys.max()) // 2), int((xs.min() + xs.max()) // 2)))
    return out


def _forest(below: np.ndarray, forest: np.ndarray, open_ground: np.ndarray, kit: K.Kit,
            part: str = "tree_clump") -> None:
    """Forest edges: tree_clump stamps about every 40 px along the outline (sticking out at most 14 px, only onto
    open grass or sand outside other cells' centres), a 1 px canopy rim and a 3 px shadow cast to the south-east.
    The clumps are placed chunk by chunk (GAP-14): each chunk draws from its own rng, keeps its anchors CLUMP_STEP / 2
    px inside its border (so two chunks' clumps keep the spacing) and tests a bulge against its own clumps only.
    NW2: taiga's edges are drawn the same way with `part` = its recoloured clump (its own rng purpose)."""
    if not forest.any():
        return
    H, W = forest.shape
    canopy = forest.copy()
    if part in kit.parts and "tree_clump" in kit.approved:
        clumps = _clumps(kit, part)
        out_d = _dist(forest, CLUMP_OUT + 1)
        inner = _inner_depth(forest, 13)
        cand_px = forest & (inner >= 3) & (inner <= 12)
        land = forest | open_ground
        m, pad = CLUMP_STEP // 2, 2 * T
        for col, row, _ in window_chunks(H, W):
            gy, gx = row * CPX - CTX.oy, col * CPX - CTX.ox        # the chunk's top-left in window px
            ay0, ay1, ax0, ax1 = max(0, gy + m), min(H, gy + CPX - m), max(0, gx + m), min(W, gx + CPX - m)
            if ay0 >= ay1 or ax0 >= ax1:
                continue
            cand = np.argwhere(cand_px[ay0:ay1, ax0:ax1]) + (ay0, ax0)
            if not len(cand):
                continue
            rng = chunk_rng("clumps" if part == "tree_clump" else f"clumps:{part}", col, row)
            by0, by1, bx0, bx1 = max(0, ay0 - pad), min(H, ay1 + pad), max(0, ax0 - pad), min(W, ax1 + pad)
            own = forest[by0:by1, bx0:bx1].copy()             # the forest plus this chunk's clumps

            def fits(i: int) -> bool:
                # a clump bulges 2-14 px past the outline, onto open ground, and its new edge does not run along a
                # cell line (the partition keeps the outline off them; a bulge must not bring it back)
                y, x = cand[i]
                part, cy, cx = clumps[int(rng.integers(len(clumps)))]
                py, px = int(y - cy), int(x - cx)
                y0, x0, y1, x1 = max(by0, py), max(bx0, px), min(by1, py + part.shape[0]), min(bx1, px + part.shape[1])
                sub = part[y0 - py:y1 - py, x0 - px:x1 - px, 3] > 127
                stick = out_d[y0:y1, x0:x1][sub]
                if not stick.size or not CLUMP_BULGE[0] <= stick.max() <= CLUMP_BULGE[1] or (sub & ~land[y0:y1, x0:x1]).any():
                    return False
                cur = own[y0 - by0:y1 - by0, x0 - bx0:x1 - bx0]
                n0, l0 = _line_edges(cur, y0, x0)
                n1, l1 = _line_edges(cur | sub, y0, x0)
                if l1 - l0 > 0.05 * n1:
                    return False
                stamped = _stamp(below[y0:y1, x0:x1], part[y0 - py:y1 - py, x0 - px:x1 - px], 0, 0)
                cur |= stamped
                canopy[y0:y1, x0:x1] |= stamped
                return True

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

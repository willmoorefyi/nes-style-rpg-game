"""Monster animation quality checks (docs/ENEMY_ANIM_PLAN.md 5.1). Pure functions on RGBA numpy arrays (H x W x 4,
uint8); each returns a list of failure strings (empty = pass), so the selftest can feed them defective images.

Thresholds that depend on the art are relative to the approved keyframe the frame was cut from (S) and, where noted,
the keyframe it moves toward (T), so legitimate big pose changes do not fail.
"""
from __future__ import annotations

import numpy as np

from gen.anim_rules import (  # noqa: F401  (re-exported: checks 10-14)
    MAX_PAGE, NEAR_KEYFRAME, ROT_CAP, atlas_exact, frame_hash, holds_cap, lock_match, near_keyframe,
    page_size, prop_carry, rotation_cap, whole_pixel)

OUTLINE = (6, 4, 10)
MAGENTA = np.array([255, 0, 255])
MIN_PIECE = 12


def _solid(a: np.ndarray) -> np.ndarray:
    return a[..., 3] > 0


def _components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    from gen.pixelize import components                  # 4-connectivity
    return components(mask)


def _sizes(lab: np.ndarray, n: int) -> list[int]:
    return [int(v) for v in np.bincount(lab.ravel(), minlength=n + 1)[1:]] if n else []


def _grow8(m: np.ndarray) -> np.ndarray:
    g = m.copy()
    g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    g[1:, 1:] |= m[:-1, :-1]; g[1:, :-1] |= m[:-1, 1:]; g[:-1, 1:] |= m[1:, :-1]; g[:-1, :-1] |= m[1:, 1:]
    return g


def _bbox(m: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(m)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None


# 1-3: pixel values
def binary_alpha(a: np.ndarray) -> list[str]:
    bad = (a[..., 3] != 0) & (a[..., 3] != 255)
    return [f"semi-alpha {int(bad.sum())} px at {_first(bad)}"] if bad.any() else []


def palette_lock(a: np.ndarray, allowed: set) -> list[str]:
    cols = {tuple(int(v) for v in c) for c in np.unique(a[_solid(a)][:, :3], axis=0)}
    extra = sorted(cols - set(allowed) - {OUTLINE})
    return [f"off-palette colours {extra[:4]}{'...' if len(extra) > 4 else ''}"] if extra else []


def magenta(a: np.ndarray) -> list[str]:
    rgb = a[..., :3].astype(int)
    near = (np.sqrt(((rgb - MAGENTA) ** 2).sum(2)) <= 90) | ((rgb[..., 0] > 180) & (rgb[..., 2] > 180) & (rgb[..., 1] < 90))
    bad = near & _solid(a)
    return [f"magenta / key fringe {int(bad.sum())} px at {_first(bad)}"] if bad.any() else []


def _first(m: np.ndarray) -> tuple[int, int] | None:
    ys, xs = np.nonzero(m)
    return (int(xs[0]), int(ys[0])) if len(xs) else None


# 4-5: fragments, seams, holes
def detached(a: np.ndarray, src: np.ndarray) -> list[str]:
    lab, n = _components(_solid(a))
    slab, sn = _components(_solid(src))
    small, ssmall = sum(1 for s in _sizes(lab, n) if s < MIN_PIECE), sum(1 for s in _sizes(slab, sn) if s < MIN_PIECE)
    out = []
    if n > sn:
        out.append(f"pieces {n} > source {sn}")
    if small > ssmall:
        out.append(f"new pieces under {MIN_PIECE} px: {small} > source {ssmall}")
    return out


def seam_gaps(a: np.ndarray, labels: np.ndarray, tolerance: int = 0, pairs: set | None = None) -> list[str]:
    """A transparent pixel inside the silhouette bbox with two opposite neighbours (left/right, up/down or a
    diagonal pair) drawn by different parts is a crack between them; `pairs` limits it to joined parts."""
    box = _bbox(_solid(a))
    if box is None:
        return []
    h, w = labels.shape
    lab = np.full((h + 2, w + 2), -1, np.int32)
    lab[1:-1, 1:-1] = np.where(_solid(a), labels, -1)
    gap = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
        p, q = lab[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx], lab[1 - dy:h + 1 - dy, 1 - dx:w + 1 - dx]
        ok = (p >= 0) & (q >= 0) & (p != q)
        if pairs is not None and ok.any():
            ok &= np.array([frozenset((int(x), int(y))) in pairs for x, y in zip(p.ravel(), q.ravel())]).reshape(ok.shape)
        gap |= ok
    x0, y0, x1, y1 = box
    inside = np.zeros_like(gap); inside[y0:y1 + 1, x0:x1 + 1] = True
    gap &= inside & ~_solid(a)
    if int(gap.sum()) > tolerance:
        x, y = _first(gap)
        return [f"seam gaps {int(gap.sum())} > {tolerance} at ({x}, {y})"]
    return []


def _holes(a: np.ndarray) -> list[tuple[int, float, float]]:
    lab, n = _components(~_solid(a))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    out = []
    for i in range(1, n + 1):
        if i in border:
            continue
        ys, xs = np.nonzero(lab == i)
        out.append((len(xs), float(xs.mean()), float(ys.mean())))
    return out


def new_holes(a: np.ndarray, src: np.ndarray, min_px: int = 4) -> list[str]:
    """An enclosed transparent piece of >= min_px with no counterpart (similar size, nearby) in the source fails."""
    reach = 6 * a.shape[0] / 80
    shole = _holes(src)
    bad = [h for h in _holes(a) if h[0] >= min_px and not any(
        0.5 * h[0] <= s[0] <= 2 * h[0] + 2 and np.hypot(h[1] - s[1], h[2] - s[2]) <= reach for s in shole)]
    return [f"new hole {bad[0][0]} px at ({bad[0][1]:.0f}, {bad[0][2]:.0f})"] if bad else []


# 6: silhouette continuity
def _height(a: np.ndarray) -> int:
    rows = np.where(_solid(a).any(1))[0]
    return int(rows.max() - rows.min() + 1) if len(rows) else 0


def silhouette(a: np.ndarray, src: np.ndarray, toward: np.ndarray, u: float, cell_h: int) -> list[str]:
    out = []
    ratio = _solid(a).sum() / max(int(_solid(src).sum()), 1)
    if not 0.85 <= ratio <= 1.15:
        out.append(f"opaque area {ratio:.2f} of source (0.85-1.15)")
    want = _height(src) + (_height(toward) - _height(src)) * u
    tol = 4 if cell_h <= 80 else 6 if cell_h <= 128 else 10
    if abs(_height(a) - want) > tol:
        out.append(f"bbox height {_height(a)} vs lerp {want:.1f} (+-{tol})")
    return out


def iou(a: np.ndarray, b: np.ndarray) -> float:
    sa, sb = _solid(a), _solid(b)
    return float((sa & sb).sum() / max(int((sa | sb).sum()), 1))


def centroid(a: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(_solid(a))
    return (float(xs.mean()), float(ys.mean())) if len(xs) else (0.0, 0.0)


def continuity(prev: np.ndarray, nxt: np.ndarray, span: tuple[np.ndarray, np.ndarray], cell_h: int) -> list[str]:
    """Adjacent frames of a runtime sequence (same cell, feet aligned) against the keyframe pair they lie between."""
    out = []
    need = min(0.55, iou(*span) + 0.10)
    if iou(prev, nxt) < need:
        out.append(f"adjacent IoU {iou(prev, nxt):.2f} < {need:.2f}")
    (ax, ay), (bx, by) = centroid(prev), centroid(nxt)
    (kx, ky), (lx, ly) = centroid(span[0]), centroid(span[1])
    cap = max(6 * cell_h / 80, 0.5 * float(np.hypot(lx - kx, ly - ky)))
    if np.hypot(bx - ax, by - ay) > cap:
        out.append(f"centroid moves {np.hypot(bx - ax, by - ay):.1f} > {cap:.1f}")
    return out


# 7: outline
def second_ring(a: np.ndarray) -> float:
    s = _solid(a)
    dark = s & (a[..., :3].max(2) < 60)
    edge = s & _grow4(~s)
    inner = dark & ~edge & _grow4(edge)
    return float(inner.sum() / max(int(edge.sum()), 1))


def _grow4(m: np.ndarray) -> np.ndarray:
    g = m.copy()
    g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    return g


def dark_edge(a: np.ndarray) -> float:
    s = _solid(a)
    pad = np.pad(s, 1)
    edge = s & _grow4(~pad)[1:-1, 1:-1]
    return float((edge & (a[..., :3].max(2) < 60)).sum() / max(int(edge.sum()), 1))


def outline_kept(a: np.ndarray, src: np.ndarray) -> list[str]:
    out = []
    if abs(second_ring(a) - second_ring(src)) > 0.08:
        out.append(f"second ring {second_ring(a):.2f} vs source {second_ring(src):.2f} (+-0.08)")
    if dark_edge(a) < dark_edge(src) - 0.01:
        out.append(f"dark edge share {dark_edge(a):.2f} < source {dark_edge(src):.2f} - 0.01")
    return out


# 8-9: feet and cell border
def _feet_x(a: np.ndarray, bottom: int) -> tuple[int, int] | None:
    rows = _solid(a)[max(0, bottom - 2):bottom + 1]
    xs = np.where(rows.any(0))[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None


def feet(a: np.ndarray, src: np.ndarray, toward: np.ndarray, u: float, bottom_row: int, pinned: bool,
         floating: bool, float_dy: int = 0) -> list[str]:
    rows = np.where(_solid(a).any(1))[0]
    if not len(rows):
        return ["empty frame"]
    low = int(rows.max())
    srows = np.where(_solid(src).any(1))[0]
    want_low = (int(srows.max()) + float_dy) if floating else bottom_row
    if low != want_low:
        return [f"lowest opaque row {low} != {want_low}"]
    if floating:
        return []
    f, s, t = _feet_x(a, bottom_row), _feet_x(src, bottom_row), _feet_x(toward, bottom_row)
    if f is None or s is None:
        return ["no foot pixels"]
    ref, tol = (s, 1) if pinned or t is None else ((s[0] + (t[0] - s[0]) * u, s[1] + (t[1] - s[1]) * u), 2)
    if abs(f[0] - ref[0]) > tol or abs(f[1] - ref[1]) > tol:
        return [f"feet x {f} vs {tuple(round(v, 1) for v in ref)} (+-{tol})"]
    return []


def clipping(a: np.ndarray) -> list[str]:
    s = _solid(a)
    ring = s.copy(); ring[1:-1, 1:-1] = False
    return [f"opaque pixel on the cell border at {_first(ring)}"] if ring.any() else []

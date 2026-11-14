"""Rendering for the monster rig (docs/ENEMY_ANIM_PLAN.md 4.2): rigid parts by inverse affine map with nearest
sampling (or the optional rotsprite sampler), chain / cloth parts by a piecewise-affine mesh warp, back-to-front
compositing, puppet's seam-only outline repair, and the part-label map of the output (for the seam check).

Every step only copies existing source colours, so the palette is preserved by construction.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from gen.rig_rotsprite import U32_MAX, _pack, _unpack, block_mode, rotsprite, scale2x  # noqa: F401  (re-exported)


def _src_gap(gaps: np.ndarray, sx: np.ndarray, sy: np.ndarray, ok: np.ndarray) -> np.ndarray:
    """Output pixels whose source position (under the part's own map) is a gap pixel of the source keyframe."""
    out = np.zeros(ok.shape, bool)
    out[ok] = gaps[sy[ok], sx[ok]]
    return out


def _rigid_map(arr: np.ndarray, sj0, tj0, rot: float, size, scale: float = 1.0):
    """Inverse map of a part rotated by `rot` about sj0, scaled by `scale` about it and placed on tj0 (nearest)."""
    h, w = size
    gy, gx = np.mgrid[0:h, 0:w]
    c, s = math.cos(-rot), math.sin(-rot)
    dx, dy = gx - tj0[0], gy - tj0[1]
    if scale != 1.0:                                       # F2; scale 1 keeps today's arithmetic bit for bit
        dx, dy = dx / scale, dy / scale
    sx = np.rint(c * dx - s * dy + sj0[0]).astype(int)
    sy = np.rint(s * dx + c * dy + sj0[1]).astype(int)
    return sx, sy, (sx >= 0) & (sx < arr.shape[1]) & (sy >= 0) & (sy < arr.shape[0])


def rigid(arr: np.ndarray, mask: np.ndarray, sj0, tj0, rot: float, size, gaps: np.ndarray | None = None,
          scale: float = 1.0):
    """Rotate the masked source part by `rot` about sj0 (scaled by `scale` about it) and place sj0 on tj0 (inverse
    map, nearest). Given the source keyframe's `gaps` (crack_mask of its own labels), also return where they land
    under this part's map."""
    h, w = size
    sx, sy, ok = _rigid_map(arr, sj0, tj0, rot, size, scale)
    hit = np.zeros((h, w), bool)
    hit[ok] = mask[sy[ok], sx[ok]]
    out = np.zeros((h, w, 4), np.uint8)
    out[hit] = arr[sy[hit], sx[hit]]
    return (out, hit, _src_gap(gaps, sx, sy, ok)) if gaps is not None else (out, hit)


# ───────── mesh warp ─────────
def _normals(chain: np.ndarray) -> np.ndarray:
    seg = np.diff(chain, axis=0)
    n = np.stack([-seg[:, 1], seg[:, 0]], 1) / np.maximum(np.linalg.norm(seg, axis=1, keepdims=True), 1e-9)
    nj = np.concatenate([n[:1], (n[:-1] + n[1:]) / 2, n[-1:]], 0)
    return nj / np.maximum(np.linalg.norm(nj, axis=1, keepdims=True), 1e-9)


def _extend(chain: np.ndarray, d: float) -> np.ndarray:
    def ext(a, b):
        v = a - b
        return a + v / max(float(np.linalg.norm(v)), 1e-9) * d
    return np.concatenate([[ext(chain[0], chain[1])], chain, [ext(chain[-1], chain[-2])]], 0)


def mesh_warp(arr: np.ndarray, mask: np.ndarray, src_chain, dst_chain, width: float, size, gaps: np.ndarray | None = None):
    """Piecewise-affine warp of the masked pixels along a joint chain: quads of half-width `width` around every
    segment (the ends extended by `width`), two triangles each, inverse-mapped through barycentrics, nearest sampling.
    `gaps` as in rigid; outside the mesh the source position is unknown (not a gap)."""
    S, D = _extend(np.asarray(src_chain, float), width), _extend(np.asarray(dst_chain, float), width)
    ns, nd = _normals(S), _normals(D)
    h, w = size
    gy, gx = np.mgrid[0:h, 0:w]
    P = np.stack([gx.ravel(), gy.ravel()], 1).astype(float)
    hit = np.zeros(h * w, bool)
    seen, gap = np.zeros(h * w, bool), np.zeros(h * w, bool)
    out = np.zeros((h * w, 4), np.uint8)
    for i in range(len(S) - 1):
        qs = [S[i] + ns[i] * width, S[i] - ns[i] * width, S[i + 1] - ns[i + 1] * width, S[i + 1] + ns[i + 1] * width]
        qd = [D[i] + nd[i] * width, D[i] - nd[i] * width, D[i + 1] - nd[i + 1] * width, D[i + 1] + nd[i + 1] * width]
        for tri in ((0, 1, 2), (0, 2, 3)):
            a, b, c = (qd[t] for t in tri)
            m = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
            if abs(np.linalg.det(m)) < 1e-9:
                continue
            l12 = np.linalg.solve(m, (P - a).T).T
            l0 = 1 - l12.sum(1)
            inside = (l12 >= -1e-9).all(1) & (l0 >= -1e-9) & ~hit
            sa, sb, sc = (qs[t] for t in tri)
            src = sa + l12[:, :1] * (sb - sa) + l12[:, 1:] * (sc - sa)
            sx, sy = np.rint(src[:, 0]).astype(int), np.rint(src[:, 1]).astype(int)
            ok = inside & (sx >= 0) & (sx < arr.shape[1]) & (sy >= 0) & (sy < arr.shape[0])
            first = inside & ~seen
            if gaps is not None:
                gap[first & ok] = gaps[sy[first & ok], sx[first & ok]]
            seen |= inside
            take = np.zeros_like(ok)
            take[ok] = mask[sy[ok], sx[ok]]
            out[take] = arr[sy[take], sx[take]]
            hit |= take
    if gaps is not None:
        return out.reshape(h, w, 4), hit.reshape(h, w), gap.reshape(h, w)
    return out.reshape(h, w, 4), hit.reshape(h, w)


# ───────── compositing ─────────
PAIRS = ((0, 1), (1, 0), (1, 1), (1, -1))
KEPT = -3                                                  # label of a gap the approved art already had (left open)


def crack_mask(lab: np.ndarray, pairs: set | None, reach: int = 1, old: np.ndarray | None = None,
               was: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Empty pixels with opposite neighbours (at distance 1..reach) drawn by two different (joined) parts, and the
    label of the neighbour to copy from. With `old[label]` (pixels that land on a gap of that part's source keyframe
    under the part's own placement) `was` is set where both neighbours' sources already had a gap there."""
    h, w = lab.shape
    pad = np.full((h + 2 * reach, w + 2 * reach), -1, np.int32)
    pad[reach:-reach, reach:-reach] = lab
    gap = np.zeros((h, w), bool)
    src = np.full((h, w), -1, np.int32)
    for r in range(1, reach + 1):
        for dy, dx in PAIRS:
            p = pad[reach + dy * r:reach + dy * r + h, reach + dx * r:reach + dx * r + w]
            q = pad[reach - dy * r:reach - dy * r + h, reach - dx * r:reach - dx * r + w]
            ok = (p >= 0) & (q >= 0) & (p != q) & (lab == -1)
            if pairs is not None and ok.any():
                ok &= np.array([frozenset((int(x), int(y))) in pairs for x, y in zip(p.ravel(), q.ravel())]).reshape(ok.shape)
            if old is not None and was is not None and ok.any():
                ys, xs = np.nonzero(ok)
                was[ys, xs] |= old[p[ys, xs], ys, xs] & old[q[ys, xs], ys, xs]
            new = ok & ~gap
            src[new] = (dy * r * w + dx * r)                  # offset to the neighbour p
            gap |= ok
    return gap, src


def source_gaps(lab: np.ndarray, pairs: set | None, grow: int = 1) -> np.ndarray:
    """A keyframe's own gaps between parts: its crack_mask pixels, grown by `grow` px (8-neighbour) over transparent
    pixels so that a gap moved by a 1 px rounding still matches."""
    gap = crack_mask(lab, pairs, 2)[0]
    for _ in range(grow):
        g = np.pad(gap, 1)
        gap = gap | (np.max([g[1 + dy:g.shape[0] - 1 + dy, 1 + dx:g.shape[1] - 1 + dx]
                             for dy in (-1, 0, 1) for dx in (-1, 0, 1)], 0) & (lab == -1))
    return gap


def _fill(img: np.ndarray, lab: np.ndarray, pairs: set | None, old=None, keep=None) -> tuple[np.ndarray, np.ndarray]:
    """Close joint cracks in place (3 rounds of crack_mask, reach 2) except the `keep` pixels; returns the filled
    pixels and where both neighbours' sources already had a gap."""
    h, w = lab.shape
    filled, was = np.zeros((h, w), bool), np.zeros((h, w), bool)
    for _ in range(3):
        gap, off = crack_mask(lab, pairs, 2, old, was)
        if keep is not None:
            gap &= ~keep
        if not gap.any():
            break
        ys, xs = np.nonzero(gap)
        flat = ys * w + xs + off[ys, xs]
        img.reshape(-1, 4)[ys * w + xs] = img.reshape(-1, 4)[flat]
        lab.reshape(-1)[ys * w + xs] = lab.reshape(-1)[flat]
        filled |= gap
    return filled, was


def composite(layers: list[tuple], size, pairs: set | None = None) -> tuple[np.ndarray, np.ndarray]:
    """layers back to front as (part index, rgba, hit[, gaps]) -> outlined image and part-label map (-1 empty, -2 new
    ink, KEPT a gap the approved art already had). Joint cracks (1-2 px gaps between joined parts that a rotation
    opened) are closed with the neighbour's colour before puppet's outline repair.

    With every layer's mapped source gaps (the third output of rigid / rotsprite / mesh_warp given `gaps`) only cracks
    the motion created are closed: a would-be fill region (4-connected) at least half of whose pixels land on a source
    gap under both parts around them is the approved art's own gap between two parts that did not move apart, and it
    stays open (neither filled nor inked by the outline repair)."""
    from gen.pixelize import components
    from gen.puppet import outline
    h, w = size
    img = np.zeros((h, w, 4), np.uint8)
    lab = np.full((h, w), -1, np.int32)
    n = max([L[0] for L in layers] + [0]) + 1
    old = np.zeros((n, h, w), bool) if any(len(L) > 3 for L in layers) else None
    for L in layers:
        idx, rgba, hit = L[:3]
        img[hit] = rgba[hit]
        lab[hit] = idx
        if old is not None and len(L) > 3:
            old[idx] = L[3]
    kept = np.zeros((h, w), bool)
    if old is not None:
        trial, was = _fill(img.copy(), lab.copy(), pairs, old)
        comps, nc = components(trial)
        for i in range(1, nc + 1):
            c = comps == i
            if was[c].mean() >= 0.5:
                kept |= c & was
    _fill(img, lab, pairs, keep=kept)
    inked = np.asarray(outline(Image.fromarray(img, "RGBA"))).copy()
    inked[kept] = 0                                       # the outline repair leaves the kept gaps open too
    lab[inked[..., 3] == 0] = -1
    lab[(inked[..., 3] > 0) & (img[..., 3] == 0)] = -2
    lab[kept] = KEPT
    return inked, lab

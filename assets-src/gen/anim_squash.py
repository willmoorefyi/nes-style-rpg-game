"""The `squash` frame op (docs/ROSTER_PLAN.md 5.2 blob row, FW-6): squash-and-stretch about the bottom centre by
removing or duplicating whole interior rows and columns of a composited frame. Nothing is resampled: every pixel of the
output is a pixel of the input, so the palette and binary alpha survive by construction; the one exception is the ink
repair (a pixel that was interior in the source and ends up on the silhouette edge, not dark, takes the outline ink),
which keeps the outline closed where a removed row uncovered a flank.

  frames.<frame>.squash: {sx: 1.08, sy: 0.88}     # any body; the `blob` template sets it per recipe (rig_blob.py)

- **Anchor:** the lowest opaque row stays where it is (the ground) and column `cx` (the solved `base` joint, else the
  centre of the bottom rows) stays where it is; rows are taken out of or added above the ground, columns on both
  sides of `cx` (the left side gets the smaller half).
- **Outline rows kept:** the `KEEP` outermost rows and columns of the figure (its outline and the shading next to it)
  are never removed or duplicated, so a dome keeps its rim, a base keeps its ground row.
- **Which lines:** the interior range is split into one equal band per line and, in each band, the line whose sides are
  straightest (the smallest change of the left / right extents for a row, of the top / bottom extents for a column) is
  taken; ties go to the band's middle. A straight flank hides a removed or doubled row; it is deterministic.
- **Caps:** 0.80 <= sx, sy <= 1.25 and 0.85 <= sx * sy <= 1.15 (the silhouette check's area band); a figure pushed
  out of the cell raises. Counts are round(h * |sy - 1|) rows and round(w * |sx - 1|) columns.

`squash_px` is the counted core (the blob `idle_b` sag removes exactly one row: `squash_px(..., rows=-1)`).

`shear_part` renders a `kind: shear` part (the blob body): each source row slides sideways by the part chain's solved
x displacement at that height (linear between the joints), never vertically; its lean angle is capped like a chain's
(25 deg, anim_rules.ROT_CAP).
"""
from __future__ import annotations

import math

import numpy as np

KEEP = 2
INK = (6, 4, 10)                                           # anim_checks.OUTLINE (always in the palette)
S_MIN, S_MAX = 0.80, 1.25
AREA = (0.85, 1.15)


def validate(sq: dict, who: str) -> tuple[float, float]:
    """(sx, sy) of a `squash` option; raises ValueError naming `who` (rig and frame) when outside the caps."""
    if not isinstance(sq, dict) or set(sq) - {"sx", "sy"}:
        raise ValueError(f"{who}: squash must be {{sx, sy}} (got {sq!r})")
    sx, sy = float(sq.get("sx", 1.0)), float(sq.get("sy", 1.0))
    if not (S_MIN <= sx <= S_MAX and S_MIN <= sy <= S_MAX):
        raise ValueError(f"{who}: squash sx {sx} / sy {sy} outside {S_MIN}-{S_MAX}")
    if not AREA[0] <= sx * sy <= AREA[1]:
        raise ValueError(f"{who}: squash area sx * sy = {sx * sy:.3f} outside {AREA[0]}-{AREA[1]}")
    return sx, sy


def _extents(solid: np.ndarray, axis: int) -> tuple[np.ndarray, np.ndarray]:
    """Per row (axis 1) or column (axis 0): the first and last opaque index (-1 / -1 when empty)."""
    m = solid if axis == 1 else solid.T
    any_ = m.any(1)
    first = np.where(any_, m.argmax(1), -1)
    last = np.where(any_, m.shape[1] - 1 - m[:, ::-1].argmax(1), -1)
    return first, last


def _score(first: np.ndarray, last: np.ndarray) -> np.ndarray:
    """How much the sides bend at each line (lower = straighter); empty lines score high."""
    f, l = first.astype(float), last.astype(float)
    s = np.zeros(len(f))
    s[1:-1] = np.abs(f[1:-1] - f[:-2]) + np.abs(f[2:] - f[1:-1]) + np.abs(l[1:-1] - l[:-2]) + np.abs(l[2:] - l[1:-1])
    s[first < 0] = 1e9
    return s


def pick(cands: list[int], score: np.ndarray, n: int) -> list[int]:
    """n lines out of `cands`: one per equal band, the straightest in each (ties: nearest the band's middle)."""
    if n <= 0 or not cands:
        return []
    if n > len(cands):
        raise ValueError(f"squash needs {n} lines but the figure has only {len(cands)} interior lines")
    out = []
    for band in np.array_split(np.asarray(cands), n):
        mid = (len(band) - 1) / 2
        out.append(int(band[min(range(len(band)), key=lambda i: (score[band[i]], abs(i - mid), i))]))
    return sorted(out)


def _apply(a: np.ndarray, lines: list[int], grow: bool, axis: int) -> np.ndarray:
    return np.insert(a, [i + 1 for i in lines], np.take(a, lines, axis=axis), axis=axis) if grow \
        else np.delete(a, lines, axis=axis)


def _grow4(m: np.ndarray) -> np.ndarray:
    g = np.pad(m, 1, constant_values=True)
    return (g[:-2, 1:-1] | g[2:, 1:-1] | g[1:-1, :-2] | g[1:-1, 2:]) | m


def squash_px(img: np.ndarray, labels: np.ndarray | None, rows: int, cols, cx: int | None = None,
              keep: int = KEEP) -> tuple[np.ndarray, np.ndarray | None, dict]:
    """Remove (negative) or duplicate (positive) `rows` interior rows and `cols` interior columns about the ground row
    and column cx; `cols` is a count split over both sides (the left gets the smaller half) or a (left, right) pair
    of signed counts (squash `auto`: each side follows its own lerp). Returns (img, labels, info: {rows, cols, sx,
    sy, cx}) with the input's shape."""
    cl, cr = (int(cols[0]), int(cols[1])) if isinstance(cols, (tuple, list)) else \
        (int(np.sign(cols)) * (abs(int(cols)) // 2), int(cols) - int(np.sign(cols)) * (abs(int(cols)) // 2))
    solid = img[..., 3] > 0
    ys, xs = np.nonzero(solid)
    if not len(ys):
        return img.copy(), None if labels is None else labels.copy(), {"rows": [], "cols": [], "sx": 1.0, "sy": 1.0,
                                                                         "cx": cx}
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    if cx is None:
        bx = np.nonzero(solid[max(y0, y1 - 2):y1 + 1].any(0))[0]
        cx = int(round((bx.min() + bx.max()) / 2))
    cx = int(min(max(cx, x0), x1))
    H, W = solid.shape
    # carried along every row / column op: the labels (or -1) and the source silhouette edge (ink repair below)
    out, lab, edge = img, (labels if labels is not None else np.full((H, W), -1, np.int32)), \
        (solid & _grow4(~solid)).astype(np.int32)
    rsel = pick(list(range(y0 + keep, y1 - keep + 1)), _score(*_extents(solid, 1)), abs(rows))
    if rsel:
        out, lab, edge = (_apply(a, rsel, rows > 0, 0) for a in (out, lab, edge))
        d = out.shape[0] - H                                # + rows added above the ground: drop the top d rows
        if d > 0:
            if (out[:d, ..., 3] > 0).any():
                raise ValueError(f"squash: stretching by {rows} rows pushes the figure out of the cell's top")
            out, lab, edge = out[d:], lab[d:], edge[d:]
        else:
            out = np.concatenate([np.zeros((-d, W, 4), out.dtype), out], 0)
            lab = np.concatenate([np.full((-d, W), -1, lab.dtype), lab], 0)
            edge = np.concatenate([np.zeros((-d, W), edge.dtype), edge], 0)
    s2 = out[..., 3] > 0
    first, last = _extents(s2, 0)
    sc = _score(first, last)
    lsel, rsel_c = pick(list(range(x0 + keep, cx)), sc, abs(cl)), pick(list(range(cx + 1, x1 - keep + 1)), sc, abs(cr))
    csel = lsel + rsel_c
    if csel:
        out, lab, edge = (_apply(a, rsel_c, cr > 0, 1) if rsel_c else a for a in (out, lab, edge))   # right first:
        out, lab, edge = (_apply(a, lsel, cl > 0, 1) if lsel else a for a in (out, lab, edge))       # left stays valid
        shift = len(lsel) * (1 if cl > 0 else -1)           # where column cx went
        pad = W + abs(cl) + abs(cr) + 2
        start = pad + shift

        def place(a, fill):
            big = np.full((H, pad + a.shape[1] + pad) + a.shape[2:], fill, a.dtype)
            big[:, pad:pad + a.shape[1]] = a
            return big
        big = place(out, 0)
        if (big[..., 3] > 0).sum() != (big[:, start:start + W, 3] > 0).sum():
            raise ValueError(f"squash: widening by {cols} columns pushes the figure out of the cell's side")
        out, lab, edge = big[:, start:start + W], place(lab, -1)[:, start:start + W], place(edge, 0)[:, start:start + W]
    s3 = out[..., 3] > 0
    # ink repair: a pixel the op left on the silhouette edge that was interior in the source (a removed row's outline
    # uncovered its neighbour) and is not already dark takes the outline ink, so the outline stays closed
    bare = s3 & _grow4(~s3) & (edge == 0) & (out[..., :3].max(2) >= 60)
    if bare.any() and (rsel or csel):
        out = out.copy()
        out[bare] = (*INK, 255)
    lab = None if labels is None else lab
    ny, nx = np.nonzero(s3)
    info = {"rows": rsel, "cols": csel, "cx": cx,
            "sy": (int(ny.max() - ny.min()) + 1) / (y1 - y0 + 1), "sx": (int(nx.max() - nx.min()) + 1) / (x1 - x0 + 1)}
    return np.ascontiguousarray(out), None if lab is None else np.ascontiguousarray(lab), info


def squash(img: np.ndarray, labels: np.ndarray | None, sx: float, sy: float, cx: int | None = None
           ) -> tuple[np.ndarray, np.ndarray | None, dict]:
    """squash_px with counts from the factors: round(h * (sy - 1)) rows and round(w * (sx - 1)) columns."""
    ys, xs = np.nonzero(img[..., 3] > 0)
    if not len(ys):
        return squash_px(img, labels, 0, 0, cx)
    h, w = int(ys.max() - ys.min()) + 1, int(xs.max() - xs.min()) + 1
    return squash_px(img, labels, int(round(h * (sy - 1.0))), int(round(w * (sx - 1.0))), cx)


def _ext(a: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(a[..., 3] > 0)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None


def auto_counts(img: np.ndarray, src: np.ndarray, toward: np.ndarray, u: float, cap: float = 0.2,
                rows_only: bool = False) -> tuple[int, tuple[int, int]]:
    """`squash: auto` (a blob in-between toward a differently sized key): the rows and (left, right) columns that bring
    the frame's bbox height and its bottom band's x extents to the S -> T lerp by u (each count capped at `cap` of
    the frame's size, and growth at the room left inside the cell's 1 px border). Positive = duplicate, negative =
    remove. `rows_only` (a frame whose feet are pinned: its base keeps the source's footprint) moves no columns."""
    f, s, t = _ext(img), _ext(src), _ext(toward)
    if not (f and s and t):
        return 0, (0, 0)

    def band(a, bottom):
        xs = np.nonzero((a[max(0, bottom - 2):bottom + 1, :, 3] > 0).any(0))[0]
        return int(xs.min()), int(xs.max())
    (fl, fr), (sl, sr), (tl, tr) = band(img, f[3]), band(src, s[3]), band(toward, t[3])
    hs, ht, hf = s[3] - s[1] + 1, t[3] - t[1] + 1, f[3] - f[1] + 1
    lim_r, lim_c = int(cap * hf), int(cap * (f[2] - f[0] + 1) / 2)
    clip = lambda v, m: int(max(-m, min(m, round(v))))     # noqa: E731
    rows = min(clip(hs + (ht - hs) * u - hf, lim_r), f[1] - 1)
    if rows_only:
        return rows, (0, 0)
    left = min(clip(fl - (sl + (tl - sl) * u), lim_c), f[0] - 1)     # + = the band must reach further left: duplicate
    right = min(clip((sr + (tr - sr) * u) - fr, lim_c), img.shape[1] - 2 - f[2])
    return rows, (left, right)


def shear_offsets(src_chain, dst_chain, rows: np.ndarray) -> np.ndarray:
    """Whole-pixel x offset per source row: the chain's x displacement (dst - src) at that row's height, linear between
    the joints (by their source y) and held past the ends."""
    ys = np.array([p[1] for p in src_chain], float)
    d = np.array([q[0] - p[0] for p, q in zip(src_chain, dst_chain)], float)
    order = np.argsort(ys, kind="stable")
    return np.rint(np.interp(rows, ys[order], d[order])).astype(int)


def shear_part(arr: np.ndarray, mask: np.ndarray, src_chain, dst_chain, size, gaps: np.ndarray | None = None):
    """FW-6 `kind: shear` (the blob body): every row of the part slides sideways by the chain's x displacement at its
    height; rows never move vertically (that is the squash op's job), so nothing is resampled and the ground row of a
    planted base stays put. Returns (rgba, hit, mapped source gaps, shear angle in degrees: the largest lean of a
    joint's offset over its height above the first joint)."""
    h, w = size
    ys, xs = np.nonzero(mask)
    off = shear_offsets(src_chain, dst_chain, np.arange(arr.shape[0]))
    nx = xs + off[ys]
    ok = (nx >= 0) & (nx < w) & (ys < h)
    out = np.zeros((h, w, 4), np.uint8)
    hit = np.zeros((h, w), bool)
    out[ys[ok], nx[ok]] = arr[ys[ok], xs[ok]]
    hit[ys[ok], nx[ok]] = True
    emp = np.zeros((h, w), bool)
    if gaps is not None:
        gy, gx = np.nonzero(gaps)
        gn = gx + off[gy]
        g = (gn >= 0) & (gn < w)
        emp[gy[g], gn[g]] = True
    b, d0 = src_chain[0], dst_chain[0][0] - src_chain[0][0]
    ang = max((math.degrees(math.atan2(abs(q[0] - p[0] - d0), max(abs(b[1] - p[1]), 1e-9)))
               for p, q in zip(src_chain[1:], dst_chain[1:])), default=0.0)
    return out, hit, emp, ang

"""The airship views' offline cleanup edits and gates (docs/AIRSHIP_VIEWS_PLAN.md 4.1), used by vehicle_view_cut.py.

Edits, per frame, in order: `recolor` ({box, map: {src hex: dst hex}}, the outline kept), `seam_boost` (on the cream
envelope, a pixel darker by more than the delta than both its neighbours across a seam takes b_7's seam brown, if it
continues a seam), `highlight` (the top-left quarter of the envelope's box moves one cream ramp step lighter), `patch`
(`trim_plumb`: erase below the lowest row with 5 or more opaque px; `pixels`: [x, y, hex | null], at most 120). Then the
outline is redrawn. Gates: the visual centre (the centroid rule, 1 native px at both facings), the shadow under the
ship, the size (+-3 px of the plan's table), binary alpha, colours a subset of b_7's, the outline closed.
"""
from __future__ import annotations

import numpy as np

CREAM = ("#cead84", "#debd94", "#efd6ad", "#f7efc6", "#fff7d6", "#ffffe7")   # b_7's envelope ramp, dark -> light
SEAM = "#9c6b42"                                                              # b_7's envelope seam brown
KEEL_ROWS = 6
SIZES = {"airship": (147, 94), "airship_back": (87, 112), "airship_front": (87, 110),
         "airship_back_turn": (126, 102), "airship_front_turn": (126, 103)}          # plan 0.2, cropped sheet frames


def hexrgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def edge(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1)
    return m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def outline(a: np.ndarray, pal: np.ndarray) -> np.ndarray:
    a = a.copy()
    a[edge(a[..., 3] > 0), :3] = pal[np.argmin(pal.sum(1))]
    return a


def is_col(a: np.ndarray, hexes) -> np.ndarray:
    m = np.zeros(a.shape[:2], bool)
    for h in hexes:
        m |= np.all(a[..., :3] == hexrgb(h), axis=-1)
    return m & (a[..., 3] > 0)


def lum(a: np.ndarray) -> np.ndarray:
    return a[..., :3].astype(np.int32) @ np.array([299, 587, 114])


def edit(a: np.ndarray, spec: dict, pal: np.ndarray) -> tuple[np.ndarray, dict]:
    """The cleanup edits, in order: recolor, seam_boost, highlight, patch. Returns the frame and the edit log."""
    a = a.copy()
    log: dict[str, object] = {}
    for r in spec.get("recolor", []):
        x0, y0, x1, y1 = r["box"]
        n = 0
        for src, dst in r["map"].items():
            m = np.zeros(a.shape[:2], bool)
            m[y0:y1, x0:x1] = True
            m &= is_col(a, [src]) & ~edge(a[..., 3] > 0)
            a[m, :3] = hexrgb(dst)
            n += int(m.sum())
        log.setdefault("recolor", []).append({"box": r["box"], "px": n})
    cream = is_col(a, CREAM)
    if spec.get("seam_boost"):
        lu = lum(a)
        hit = np.zeros(cream.shape, bool)
        inner = (a[..., 3] > 0) & ~edge(a[..., 3] > 0) & ~is_col(a, [SEAM])
        for ax in (0, 1):
            lo, hi = np.roll(cream, 1, ax), np.roll(cream, -1, ax)
            dark = (lu + spec["seam_boost"] < np.roll(lu, 1, ax)) & (lu + spec["seam_boost"] < np.roll(lu, -1, ax))
            hit |= inner & lo & hi & dark
        line = np.pad(hit | is_col(a, [SEAM]), 1)
        nb = sum(line[1 + dy:line.shape[0] - 1 + dy, 1 + dx:line.shape[1] - 1 + dx]
                 for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
        hit &= nb >= 2                                     # a seam continues: no lone dots
        a[hit, :3] = hexrgb(SEAM)
        log["seam_boost"] = {"delta": spec["seam_boost"], "px": int(hit.sum())}
        cream &= ~hit
    if spec.get("highlight"):
        ys, xs = np.where(cream)
        x0, y0 = xs.min(), ys.min()
        box = np.zeros(cream.shape, bool)
        box[y0:y0 + (ys.max() - y0 + 1) // 2, x0:x0 + (xs.max() - x0 + 1) // 2] = True
        n = 0
        for i in range(len(CREAM) - 2, -1, -1):              # light first: a pixel moves one step only
            m = box & is_col(a, [CREAM[i]]) & cream
            a[m, :3] = hexrgb(CREAM[i + 1])
            cream &= ~m
            n += int(m.sum())
        log["highlight"] = {"px": n}
    p = spec.get("patch", {})
    if p.get("trim_plumb"):
        rows = (a[..., 3] > 0).sum(1)
        low = int(np.where(rows >= 5)[0].max())
        n = int((a[low + 1:, :, 3] > 0).sum())
        a[low + 1:] = 0
        log["trim_plumb"] = {"below_row": low, "px": n}
    px = p.get("pixels", [])
    if len(px) > 120:
        raise SystemExit("vehicle_view_cut: a patch is capped at 120 px per frame")
    for x, y, c in px:
        a[y, x] = (*hexrgb(c), 255) if c else (0, 0, 0, 0)
    if px:
        log["pixels"] = len(px)
    a = outline(a, pal)
    return a, log


def drawn(a: np.ndarray) -> np.ndarray:
    """The frame cropped to its drawn box (the sheet frame vehicles.py writes)."""
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def centroid_x(f: np.ndarray) -> float:
    return float((np.where(f[..., 3] > 0)[1] + 0.5).mean())


def keel_x(f: np.ndarray) -> float:
    """vehicles.py's keel anchor: the centroid column of the bottom KEEL_ROWS drawn rows, as a fraction of the width."""
    m = f[..., 3] > 0
    rows = np.where(m.any(1))[0][-KEEL_ROWS:]
    return round(float((np.where(m[rows])[1] + 0.5).mean()) / f.shape[1], 4)


def d7(b7: np.ndarray) -> float:
    """b_7's whole-mask x centroid minus its keel anchor, in native px (13.80 at AV-1)."""
    f = drawn(b7)
    return centroid_x(f) - keel_x(f) * f.shape[1]


def anchor_of(f: np.ndarray, dist: float) -> float:
    return round((centroid_x(f) - dist) / f.shape[1], 4)


def gates(name: str, f: np.ndarray, anchor: float, dist: float, pal: np.ndarray) -> list[str]:
    """Every failed gate of one cropped frame, as text (empty = pass)."""
    bad = []
    w, h = f.shape[1], f.shape[0]
    cx, foot = centroid_x(f), anchor * w
    for facing, off, want in (("right", cx - foot, dist), ("left", (w - cx) - (w - foot), -dist)):
        if abs(off - want) > 1:
            bad.append(f"{name}: visual centre {off:.2f} px from the foot facing {facing}, want {want:.2f} +- 1")
    m = f[..., 3] > 0
    xs = np.where(m[h - h // 3:].any(0))[0]
    lo, hi = float(xs.min()), float(xs.max() + 1)
    if not (foot - lo >= 10 and hi - foot >= 10):
        bad.append(f"{name}: the foot {foot:.1f} is within 10 px of the bottom third's x range {lo:.0f}-{hi:.0f}")
    s0, s1 = foot - 0.3 * w, foot + 0.3 * w
    if (min(s1, hi) - max(s0, lo)) < 0.6 * (s1 - s0):
        bad.append(f"{name}: under 60 % of the shadow span {s0:.1f}-{s1:.1f} lies over the hull {lo:.0f}-{hi:.0f}")
    sw, sh = SIZES[name]
    if abs(w - sw) > 3 or abs(h - sh) > 3:
        bad.append(f"{name}: size {w}x{h}, want {sw}x{sh} +- 3")
    if not set(np.unique(f[..., 3])) <= {0, 255}:
        bad.append(f"{name}: alpha is not binary")
    cols = {tuple(c) for c in f[m][:, :3].tolist()}
    if not cols <= {tuple(c) for c in pal.astype(int).tolist()}:
        bad.append(f"{name}: {len(cols - {tuple(c) for c in pal.astype(int).tolist()})} colours not in b_7's set")
    if name != "airship" and not np.all(f[edge(m), :3] == pal[np.argmin(pal.sum(1))]):
        bad.append(f"{name}: the outline is not closed in b_7's darkest colour")
    return bad

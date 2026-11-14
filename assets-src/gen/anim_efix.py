"""Wave-0 animation checks (docs/ENEMY_ANIM_ISSUES.md section 2; docs/ENEMY_ANIM_PLAN.md 5.1 checks 6, 15-18):
F1 the fx exclusion of check 6, F3 fx-mask integrity, F4 intra-part crease, F6 edge roughness (report only) and F7
prop attached. F5 (foot release) is in anim_feet.py. Pure functions on numpy arrays; each check returns a list of
failure strings (empty = pass). Label maps: part index >= 0, -1 empty, -2 new ink (rig_render.composite).
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

PAIRS = ((0, 1), (1, 0), (1, 1), (1, -1))
PROP_TOUCH = 4                                             # F7: measured minimum on the rigs is 12 (goblin atk_mid)


def _solid(a: np.ndarray) -> np.ndarray:
    return a[..., 3] > 0


def _grow8(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1)
    h, w = m.shape
    return np.max([p[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], 0)


def _n4(s: np.ndarray) -> np.ndarray:
    p = np.pad(s, 1).astype(np.int32)
    return p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]


def pieces8(m: np.ndarray) -> list[list[tuple[int, int]]]:
    """8-connected pieces of a boolean mask as lists of (y, x), largest first (ties: first pixel in raster order)."""
    seen = np.zeros(m.shape, bool)
    h, w = m.shape
    out = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        stack, piece = [(int(y0), int(x0))], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            piece.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    v, u = y + dy, x + dx
                    if 0 <= v < h and 0 <= u < w and m[v, u] and not seen[v, u]:
                        seen[v, u] = True
                        stack.append((v, u))
        out.append(sorted(piece))
    return sorted(out, key=lambda p: (-len(p), p[0]))


# F1: fx parts are left out of check 6's area ratio and bbox height
def fx_exclusion(labels: np.ndarray | None, fx: list[int]) -> np.ndarray | None:
    """Pixels check 6 ignores: those labelled with an fx part, plus new outline ink (-2) 8-adjacent to them (the fx's
    own ring, re-inked by the outline repair). None when there is no label map or no fx part."""
    if labels is None or not fx:
        return None
    m = np.isin(labels, fx)
    return m | ((labels == -2) & _grow8(m))


# F3: an fx part's mask polygon must keep every opaque pixel inside it
def poly_mask(poly: list, shape: tuple[int, int]) -> np.ndarray:
    """The polygon raster rig.segment uses for `masks` (PIL polygon fill, outline included)."""
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    return np.asarray(m) > 0


def mask_integrity(masks: dict, kinds: dict[str, str], kf: str, lab: np.ndarray, names: list[str],
                   solid: np.ndarray) -> tuple[list[str], dict]:
    """Opaque pixels of keyframe `kf` inside a part's mask polygon that the segmentation labelled as another part.
    (failures for fx parts, {part: {px, by: {other part: px}}} for the rest: report only)."""
    fails, overlap = [], {}
    for part, per_kf in (masks or {}).items():
        poly = (per_kf or {}).get(kf)
        if not poly or part not in names:
            continue
        other = solid & poly_mask(poly, lab.shape) & (lab >= 0) & (lab != names.index(part))
        n = int(other.sum())
        if not n:
            continue
        by = {names[i]: int(c) for i, c in enumerate(np.bincount(lab[other], minlength=len(names))) if c}
        if kinds.get(part) == "fx":
            top = max(by, key=lambda k: (by[k], k))
            y, x = (int(v[0]) for v in np.nonzero(other))
            fails.append(f"fx mask {part}: {n} opaque px labelled as other parts ({top} {by[top]}) from ({x}, {y})")
        else:
            overlap[part] = {"px": n, "by": by}
    return fails, overlap


# F4: an outline crease inside one part
def crease(a: np.ndarray, labels: np.ndarray, cell_h: int, names: list[str] | None = None) -> list[str]:
    """New ink (-2) with all 8 neighbours opaque and the same part on both sides (left / right, up / down or a
    diagonal pair) is a crease inside that part; its largest 8-connected piece must stay under ceil(5 * cell_h / 80)."""
    s = _solid(a)
    h, w = labels.shape
    full = np.pad(s, 1)
    inside = np.min([full[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], 0)
    lab = np.full((h + 2, w + 2), -1, np.int32)
    lab[1:-1, 1:-1] = np.where(s, labels, -1)
    same = np.zeros((h, w), bool)
    part = np.full((h, w), -1, np.int32)
    for dy, dx in PAIRS:
        p, q = lab[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx], lab[1 - dy:h + 1 - dy, 1 - dx:w + 1 - dx]
        hit = (p >= 0) & (p == q) & ~same
        part[hit] = p[hit]
        same |= hit
    cand = (labels == -2) & inside & same
    lim = math.ceil(5 * cell_h / 80)
    pcs = pieces8(cand)
    if not pcs or len(pcs[0]) < lim:
        return []
    y, x = pcs[0][0]
    who = names[part[y, x]] if names else str(int(part[y, x]))
    return [f"intra-part crease {len(pcs[0])} px >= {lim} at ({x}, {y}) in {who}"]


# F6: edge roughness (report only)
def roughness(a: np.ndarray) -> float:
    """Spur pixels (opaque, at most one opaque 4-neighbour) plus notch pixels (empty, at least three opaque
    4-neighbours) per 100 silhouette edge pixels."""
    s = _solid(a)
    n = _n4(s)
    edge = int((s & (n < 4)).sum())
    return 100.0 * int((s & (n <= 1)).sum() + (~s & (n >= 3)).sum()) / max(edge, 1)


# F7: a prop that is not carried stays in its grip
def prop_attached(labels: np.ndarray, grips: dict[int, list[int]], names: list[str] | None = None,
                  min_px: int = PROP_TOUCH) -> list[str]:
    """Each drawn prop touches (8-neighbour) its grip parts with at least `min_px` of its pixels."""
    out = []
    for prop, g in sorted(grips.items()):
        pm = labels == prop
        if not pm.any():
            continue
        n = int((pm & _grow8(np.isin(labels, g))).sum())
        if n < min_px:
            who = names[prop] if names else str(prop)
            grip = "/".join(names[i] for i in g) if names else str(g)
            out.append(f"prop {who} touches its grip {grip} by {n} px < {min_px}")
    return out

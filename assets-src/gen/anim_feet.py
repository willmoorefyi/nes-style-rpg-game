"""Monster animation check 8, feet anchored (docs/ENEMY_ANIM_PLAN.md 5.1): the lowest row on the plain, then the feet
judged on the whole bottom band, per foot (part labels; a foot lifted in either keyframe of the span is skipped), or on
the ground contact a pinned frame that releases feet keeps (a rearing hurt). Re-exported by anim_checks.py."""
from __future__ import annotations

import numpy as np

REAR = ("hurt_in1", "hurt_in2")                            # F5: the only frames that may release a grounded foot


def _solid(a: np.ndarray) -> np.ndarray:
    return a[..., 3] > 0


def _components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    from gen.pixelize import components                  # 4-connectivity
    return components(mask)


def contact_mask(rig, src: str, seg: tuple, pins: list[str], bottom: int) -> np.ndarray:
    """Ground contact a frame that releases feet keeps: the source keyframe's pixels in the bottom 3 rows drawn by a
    part ending on a pinned foot (e.g. the hind shins and paws of a rearing hurt)."""
    lab, names = seg
    own = [names.index(p) for p in rig.parts if p in names and any(j in pins for j in rig.joints_of(p, src))]
    m = np.isin(lab, own)
    m[:max(0, bottom - 2)] = False
    m[bottom + 1:] = False
    return m


def _feet_x(a: np.ndarray, bottom: int) -> tuple[int, int] | None:
    rows = _solid(a)[max(0, bottom - 2):bottom + 1]
    xs = np.where(rows.any(0))[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None


def _kept_contact(a: np.ndarray, contact: np.ndarray, bottom_row: int) -> list[str]:
    """A pinned frame that releases feet (a rearing hurt): judged on the ground contact of the paws it keeps pinned
    (`contact`: their source pixels in the bottom 3 rows). Nothing may sink below the plain, and each kept paw keeps
    its lowest row and its x extent (+-1) while released paws may leave the bottom rows."""
    rows = np.where(_solid(a).any(1))[0]
    low = int(rows.max())
    if low > bottom_row:
        return [f"opaque row {low} below the plain {bottom_row}"]
    lab, n = _components(contact)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
        win = _solid(a)[y0:y1 + 1, max(0, x0 - 3):x1 + 4]
        cols = np.where(win.any(0))[0] + max(0, x0 - 3)
        if not len(cols) or not _solid(a)[y1, max(0, x0 - 3):x1 + 4].any() or _solid(a)[y1 + 1:bottom_row + 1, x0:x1 + 1].any():
            return [f"kept paw at x {x0}-{x1} left its ground row {y1}"]
        if abs(int(cols.min()) - x0) > 1 or abs(int(cols.max()) - x1) > 1:
            return [f"kept paw x ({int(cols.min())}, {int(cols.max())}) vs ({x0}, {x1}) (+-1)"]
    return []


def _band_x(m: np.ndarray, bottom: int) -> tuple[int, int] | None:
    xs = np.where(m[max(0, bottom - 2):bottom + 1].any(0))[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None


def _per_foot(a: np.ndarray, pf: dict, u: float, bottom: int, pinned: bool) -> list[str]:
    """Per foot (`pf`: {"frame", "src", "toward"}: part-label maps, "parts": {foot: [part index, ...]}): its pixels in
    the bottom 3 rows. A foot lifted in either keyframe of the span is skipped; a pinned frame keeps every foot
    grounded in its source within +-1, any other frame keeps every foot grounded in both within +-2 of the lerp."""
    solid = _solid(a)
    out = []
    for foot, idx in sorted(pf["parts"].items()):
        s = _band_x(np.isin(pf["src"], idx), bottom)
        t = _band_x(np.isin(pf["toward"], idx), bottom) if pf.get("toward") is not None else None
        if s is None or (not pinned and t is None):
            continue                                       # lifted in the source or the target keyframe
        f = _band_x(solid & np.isin(pf["frame"], idx), bottom)
        ref, tol = (s, 1) if pinned else ((s[0] + (t[0] - s[0]) * u, s[1] + (t[1] - s[1]) * u), 2)
        if f is None:
            out.append(f"foot {foot} left the ground (source x {s})")
        elif abs(f[0] - ref[0]) > tol or abs(f[1] - ref[1]) > tol:
            out.append(f"foot {foot} x {f} vs {tuple(round(v, 1) for v in ref)} (+-{tol})")
    return out


def feet(a: np.ndarray, src: np.ndarray, toward: np.ndarray, u: float, bottom_row: int, pinned: bool,
         floating: bool, float_dy: int = 0, contact: np.ndarray | None = None, per_foot: dict | None = None) -> list[str]:
    rows = np.where(_solid(a).any(1))[0]
    if not len(rows):
        return ["empty frame"]
    if contact is not None and pinned and not floating and contact.any():
        return _kept_contact(a, contact, bottom_row)
    low = int(rows.max())
    srows = np.where(_solid(src).any(1))[0]
    want_low = (int(srows.max()) + float_dy) if floating else bottom_row
    if low != want_low:
        return [f"lowest opaque row {low} != {want_low}"]
    if floating:
        return []
    if per_foot:
        return _per_foot(a, per_foot, u, bottom_row, pinned)
    f, s, t = _feet_x(a, bottom_row), _feet_x(src, bottom_row), _feet_x(toward, bottom_row)
    if f is None or s is None:
        return ["no foot pixels"]
    ref, tol = (s, 1) if pinned or t is None else ((s[0] + (t[0] - s[0]) * u, s[1] + (t[1] - s[1]) * u), 2)
    if abs(f[0] - ref[0]) > tol or abs(f[1] - ref[1]) > tol:
        return [f"feet x {f} vs {tuple(round(v, 1) for v in ref)} (+-{tol})"]
    return []


def released_feet(a: np.ndarray, labels: np.ndarray, src_labels: np.ndarray, foot_parts: dict, bottom: int) -> list[str]:
    """F5 (docs/ENEMY_ANIM_ISSUES.md): a pinned frame other than a rearing hurt (REAR) may not release feet; each foot
    grounded in its source (its parts have pixels in the bottom 3 rows) keeps its lowest row within +-1."""
    out = []
    for foot, idx in sorted(foot_parts.items()):
        src = np.isin(src_labels, idx)
        if not src[max(0, bottom - 2):bottom + 1].any():
            continue                                       # lifted in the source
        s_low = int(np.nonzero(src.any(1))[0].max())
        rows = np.nonzero((_solid(a) & np.isin(labels, idx)).any(1))[0]
        if not len(rows):
            out.append(f"foot {foot} released outside a rearing hurt: not drawn (source row {s_low})")
        elif abs(int(rows.max()) - s_low) > 1:
            out.append(f"foot {foot} released outside a rearing hurt: lowest row {int(rows.max())} vs source {s_low} (+-1)")
    return out

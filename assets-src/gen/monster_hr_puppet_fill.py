"""EF-G amendment B0 helpers for gen/monster_hr_puppet.py: a part's source px on the master, with the part option
`mirror: {from: <part>, about: [x, y], poly: [...] (optional)}` that paints a hidden limb (the vampire's front thigh
and knee behind the tabard) from the visible one's own px, mirrored about the vertical line through `about`; drawn
where the pose's `z` puts it (under the covering parts). Pure numpy."""
from __future__ import annotations

import numpy as np

from gen import monster_hr_geom as G


def mirrored(rgba: np.ndarray, mask: np.ndarray, x0: float) -> tuple[np.ndarray, np.ndarray]:
    """The px of `mask` reflected about the column x = x0 (x -> 2 x0 - x, whole px), and their mask."""
    h, w = mask.shape
    ys, xs = np.where(mask)
    nx = np.round(2 * x0 - xs).astype(int)
    ok = (nx >= 0) & (nx < w)
    out, m = np.zeros_like(rgba), np.zeros_like(mask)
    out[ys[ok], nx[ok]] = rgba[ys[ok], xs[ok]]
    m[ys[ok], nx[ok]] = True
    return out, m


def part_src(rgba: np.ndarray, masks: dict, p: dict) -> tuple[np.ndarray, np.ndarray]:
    """(the part's px on the master, its mask): its own cut-out px, or for a `mirror` part the mirrored px of its
    `from` part (clipped to `mirror.poly` on the master first when given)."""
    mi = p.get("mirror")
    if not mi:
        src = rgba.copy()
        src[~masks[p["name"]]] = 0
        return src, masks[p["name"]]
    m = masks[mi["from"]]
    if mi.get("poly"):
        m = m & G.poly_mask(m.shape, [mi["poly"]])
    return mirrored(rgba, m, float(mi["about"][0]))

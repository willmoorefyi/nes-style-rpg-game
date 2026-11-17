"""K2-0 helpers of the derived kneel key (kneel.py): the block's `erase`, the template's `slump` and `fit: ground`.
Split out of kneel.py to keep it under 250 lines; nothing here runs for a rig whose template and block use none of
those keys (goblin and wolf stay byte-identical)."""
from __future__ import annotations

import numpy as np
from PIL import Image


def erase(arr: np.ndarray, spec) -> np.ndarray:
    """K2-0 block `erase`: [{poly: [[x, y], ...], dark: n}] idle pixels the kneel key leaves out (a cape seen between
    the legs that the fold would tear into shards): inside each polygon, the pixels with a red cast or darker than
    `dark` (max channel) are cleared before the key is cut. The idle key itself is untouched."""
    from PIL import ImageDraw
    for e in spec or []:
        m = Image.new("L", (arr.shape[1], arr.shape[0]), 0)
        ImageDraw.Draw(m).polygon([tuple(v) for v in e["poly"]], fill=1)
        c = arr[..., :3].astype(int)
        hit = (np.asarray(m) > 0) & ((c[..., 0] > c[..., 2] + 15) & (c[..., 0] > c[..., 1] + 15)
                                     | (c.max(2) < int(e.get("dark", 0))))
        arr[hit] = 0
    return arr


def slump_px(tpl: dict, idle: np.ndarray) -> int:
    """K2-0 `slump`: the upper body sinks this fraction of the idle's opaque height (whole px; 0 without the key)."""
    rows = np.nonzero((idle[..., 3] > 0).any(1))[0]
    return int(round(tpl.get("slump", 0.0) * (rows.max() - rows.min() + 1))) if len(rows) and tpl.get("slump") else 0


def slump_roots(rig, tpl: dict) -> list[str]:
    """The limb roots a `slump` pins at the idle key, in the key and its in-betweens (the legs stay; the body sinks
    between them)."""
    return [h for h, _, _ in rig.limbs if h in rig.keyframes["idle"]] if tpl.get("slump") else []


def fit_mask(rig, tpl: dict, labels: np.ndarray):
    """The pixels the ground-line fit measures: all (True), or with K2-0 `fit: ground` only the parts holding a
    `ground` joint (the rest, e.g. garland's armour skirt, is the block paint's to trim)."""
    if tpl.get("fit") != "ground":
        return True
    names = list(rig.parts)
    keep = [i for i, p in enumerate(names) if set(rig.joints_of(p, "idle")) & set(tpl.get("ground", {}))]
    return np.isin(labels, keep)

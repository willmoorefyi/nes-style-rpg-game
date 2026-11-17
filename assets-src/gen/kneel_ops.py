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


def leg_parts(rig) -> list[int]:
    """Indices of the parts on the leg chains (thighs, shins, feet): everything else rides the body."""
    legs = {j for h, k, f in rig.limbs for j in (h, k, f)} | {f"toe_{s}" for s in "nf"}
    return [i for i, p in enumerate(rig.parts)
            if (js := {j for kf in rig.keyframes for j in rig.joints_of(p, kf)}) and js <= legs]


def hem_row(rig, labels: np.ndarray) -> int | None:
    """The lowest row of the body's pixels (every part but the legs: the robe, a staff)."""
    rows = np.nonzero((~np.isin(labels, leg_parts(rig)) & (labels >= 0)).any(1))[0]
    return int(rows.max()) if len(rows) else None


def robe_fit(rig, tpl: dict, img: np.ndarray, labels: np.ndarray | None, S: dict, J: dict, hem0: int | None):
    """K2-0 template key `robe: f` (the robed variant): the band from the waist (f of the way from the chest to the
    hip, carried with the chest) down to the body's lowest row (the robe's hem, a staff's foot) is resampled row by
    row (nearest) so that row lands back on its idle row `hem0`: a robe the sunk body pushed toward the plain is
    compressed, one the rising body lifted is stretched. Rows above the band are kept; below the idle hem only the
    legs stay, and they show through where the resampled robe is empty."""
    f = tpl.get("robe")
    if f is None or labels is None or hem0 is None or "chest" not in S or "hip" not in S:
        return img, labels
    hem1 = hem_row(rig, labels)
    top = int(round(S["chest"][1] + f * (S["hip"][1] - S["chest"][1]) + J["chest"][1] - S["chest"][1]))
    if hem1 is None or hem1 == hem0 or top >= min(hem0, hem1):
        return img, labels
    src = np.round(np.linspace(top, hem1, hem0 - top + 1)).astype(int)
    out, lab = img.copy(), labels.copy()
    out[top:hem0 + 1], lab[top:hem0 + 1] = img[src], labels[src]
    legs = np.isin(labels, leg_parts(rig))
    low = np.zeros(labels.shape, bool)
    low[hem0 + 1:] = True
    out[low & ~legs], lab[low & ~legs] = 0, -1
    back = np.zeros(labels.shape, bool)
    back[top:hem0 + 1] = True
    show = back & (out[..., 3] == 0) & legs & (img[..., 3] > 0)   # the feet show through where the robe is empty
    out[show], lab[show] = img[show], labels[show]
    return out, lab


def robe_frame(rig, tpl: dict, name: str, img: np.ndarray, labels: np.ndarray | None, J: dict,
               idle_labels: np.ndarray):
    """The robe fit on a generated kneel frame (kneel_in1 / kneel_in2 / kneel_b); any other frame is unchanged."""
    if tpl.get("robe") is None or name not in ("kneel_in1", "kneel_in2", "kneel_b"):
        return img, labels
    return robe_fit(rig, tpl, img, labels, rig.keyframes["idle"], J, hem_row(rig, idle_labels))

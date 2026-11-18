"""The AI kneel bridge (docs/KNEEL_TWEEN_PLAN.md, pass KT): the in-betweens between the approved idle and the approved
AI kneel key, with no joints and no part cutting.

The idle and the AI kneel are two separate drawings, so a puppet tween between them mixes two silhouettes (mush).
Each bridge frame is instead **one** approved drawing, re-timed:

- `kneel_in1` = the idle, squashed u1 of the way toward the key: its height moves toward the key's by dropping rows
  from the middle band only (the top `keep_top` share, the head, and the bottom `keep_bot` share, the feet, are kept
  row for row), its width likewise when the two widths differ by more than WIDTH_MIN (nearest columns about the bbox
  centre, then u1 of the way to the key's centre), and its top leans toward the key's head by a whole-px row shear
  (0 at the ground, full at the top).
- `kneel_in2` = the key, stretched u2 of the way back toward the idle by the same rules (rows of its middle band
  repeated): the drawing on screen swaps from the idle's to the key's between in1 and in2, inside a moving smear.
- `kneel_b` = the key's breath: the upper body 1 px down (one row dropped at `breath_at` of the height from the base),
  the base rows unmoved, so the feet stay on the feet row (floaters too: their sink is the runtime kneelSink).

Every pixel is an approved pixel of one source (palette, binary alpha and the outline colours are kept by
construction), the lowest opaque row never moves, and nothing reaches the cell border. A rig or hero block tunes it
with `bridge: {u: [u1, u2], keep_top, keep_bot, shear, width, breath_at}` (D-KT3); unknown keys are refused.
"""
from __future__ import annotations

import numpy as np

from gen.kneel_seams import resize_band

DEFAULTS = {"u": [0.35, 0.35], "keep_top": 0.28, "keep_bot": 0.10, "shear": True, "width": True, "breath_at": 0.45}
WIDTH_MIN = 0.08            # the width is remapped only when the two widths differ by more than this share
U_MAX = 0.35                # the near-keyframe rule (anim_checks.near_keyframe)


def options(b: dict | None, who: str = "?") -> dict:
    """The block's `bridge` mapping merged over DEFAULTS, validated."""
    raw = (b or {}).get("bridge") or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{who}: kneel bridge must be a mapping, not {raw!r}")
    bad = sorted(set(raw) - set(DEFAULTS))
    if bad:
        raise ValueError(f"{who}: unknown kneel bridge keys {bad} ({', '.join(DEFAULTS)})")
    o = {**DEFAULTS, **raw}
    u = o["u"]
    if not (isinstance(u, (list, tuple)) and len(u) == 2 and all(0 < float(v) <= U_MAX for v in u)):
        raise ValueError(f"{who}: kneel bridge u {u!r} must be two values in (0, {U_MAX}]")
    for k in ("keep_top", "keep_bot"):
        if not 0 <= float(o[k]) < 0.5:
            raise ValueError(f"{who}: kneel bridge {k} {o[k]!r} is not in [0, 0.5)")
    if not 0.2 <= float(o["breath_at"]) <= 0.8:
        raise ValueError(f"{who}: kneel bridge breath_at {o['breath_at']!r} is not in [0.2, 0.8]")
    return o


def offset(key: np.ndarray, d) -> np.ndarray:
    """D-KT1 `offset: [dx, dy]`: the approved key moved by whole px (what leaves the cell is dropped)."""
    dx, dy = (int(v) for v in (d or (0, 0)))
    if not (dx or dy):
        return key
    out = np.zeros_like(key)
    h, w = key.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = key[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def _rows(a: np.ndarray) -> tuple[int, int]:
    r = np.nonzero((a[..., 3] > 0).any(1))[0]
    return int(r.min()), int(r.max())


def _cols(a: np.ndarray) -> tuple[int, int]:
    c = np.nonzero((a[..., 3] > 0).any(0))[0]
    return int(c.min()), int(c.max())


def _top_cx(a: np.ndarray, share: float = 0.3) -> float:
    t, b = _rows(a)
    ys, xs = np.nonzero(a[t:t + max(2, int((b - t + 1) * share)), :, 3] > 0)
    return float(xs.mean()) if len(xs) else 0.0


def remap_rows(a: np.ndarray, h_new: int, keep_top: float, keep_bot: float) -> np.ndarray:
    """The figure at height h_new about its lowest row: rows of the middle band are dropped or doubled where they are
    most like their neighbour (whole-row seams), the top and bottom bands are copied row for row."""
    t, b = _rows(a)
    h = b - t + 1
    ht, hb = int(round(h * keep_top)), max(1, int(round(h * keep_bot)))
    mid = h - ht - hb
    if mid < 2 or h_new == h:
        return a.copy()
    mid_band = resize_band(a[t + ht:b - hb + 1], max(1, mid + (h_new - h)))
    stack = np.concatenate([a[t:t + ht], mid_band, a[b - hb + 1:b + 1]])
    out = np.zeros_like(a)
    top = b + 1 - stack.shape[0]
    out[max(0, top):b + 1] = stack[max(0, -top):]
    return out


def remap_cols(a: np.ndarray, w_new: int, anchor: float) -> np.ndarray:
    """The figure at width w_new: columns dropped or doubled at the lowest-cost vertical seams, centred on anchor."""
    l, r = _cols(a)
    cols = resize_band(np.swapaxes(a[:, l:r + 1], 0, 1), max(1, w_new))
    out = np.zeros_like(a)
    x0 = int(round(anchor - (cols.shape[0] - 1) / 2))
    for k in range(cols.shape[0]):
        if 0 <= x0 + k < a.shape[1]:
            out[:, x0 + k] = cols[k]
    return out


def shift_cols(a: np.ndarray, d: int) -> np.ndarray:
    out = np.zeros_like(a)
    if d > 0:
        out[:, d:] = a[:, :-d]
    elif d < 0:
        out[:, :d] = a[:, -d:]
    else:
        out[:] = a
    return out


def shear(a: np.ndarray, dx_top: float, keep_bot: float) -> np.ndarray:
    """Rows shifted by whole px: 0 over the bottom band, rising linearly to dx_top at the top row."""
    t, b = _rows(a)
    h = b - t + 1
    out = np.zeros_like(a)
    for y in range(a.shape[0]):
        f = 0.0 if y > b else (b - y) / max(1, h - 1)
        f = max(0.0, (f - keep_bot) / (1 - keep_bot))
        out[y] = shift_cols(a[y:y + 1], int(round(dx_top * f)))[0]
    return out


def _pieces(a: np.ndarray) -> int:
    from gen.pixelize import components
    return int(components(a[..., 3] > 0)[1])


def toward(src: np.ndarray, dst: np.ndarray, u: float, o: dict) -> np.ndarray:
    """`src` moved u of the way toward `dst`; if a dropped seam splits off a piece, the width remap is left out, then
    the shear (a whole-line drop can cut a thin limb)."""
    n = _pieces(src)
    for opts in (o, {**o, "width": False}, {**o, "width": False, "shear": False}):
        out = _toward(src, dst, u, opts)
        if _pieces(out) <= n:
            return out
    return out


def _toward(src: np.ndarray, dst: np.ndarray, u: float, o: dict) -> np.ndarray:
    """`src` moved u of the way toward `dst` (height, width, head lean), drawn from src's pixels only."""
    ts, bs = _rows(src)
    td, bd = _rows(dst)
    hs, hd = bs - ts + 1, bd - td + 1
    out = remap_rows(src, int(round(hs + (hd - hs) * u)), float(o["keep_top"]), float(o["keep_bot"]))
    ls, rs = _cols(src)
    ld, rd = _cols(dst)
    ws, wd = rs - ls + 1, rd - ld + 1
    if o["width"] and abs(wd - ws) > WIDTH_MIN * ws:
        c = (ls + rs) / 2
        out = remap_cols(out, int(round(ws + (wd - ws) * u)), c)
        out = shift_cols(out, int(round(((ld + rd) / 2 - c) * u)))
    if o["shear"]:
        out = shear(out, (_top_cx(dst) - _top_cx(out)) * u, float(o["keep_bot"]))
    want = _cx(src) + (_cx(dst) - _cx(src)) * u        # the mass travels u of the way (no sideways pop)
    return shift_cols(out, int(round(want - _cx(out))))


def _cx(a: np.ndarray) -> float:
    xs = np.nonzero(a[..., 3] > 0)[1]
    return float(xs.mean()) if len(xs) else 0.0


def breath(key: np.ndarray, at: float) -> np.ndarray:
    """The upper body 1 px down: the rows above the breath row move down 1, the row at it is dropped."""
    t, b = _rows(key)
    cut = b - int((b - t + 1) * at)
    out = key.copy()
    out[t + 1:cut + 1] = key[t:cut]
    out[t] = 0
    return out


def clear_border(a: np.ndarray, bottom: int) -> np.ndarray:
    """K-fit: nothing below the feet row, nothing on the cell border."""
    out = a.copy()
    out[bottom + 1:] = 0
    out[0], out[:, 0], out[:, -1] = 0, 0, 0
    return out


def _edge(a: np.ndarray) -> np.ndarray:
    s = a[..., 3] > 0
    t = np.pad(~s, 1)
    near = t[:-2, 1:-1] | t[2:, 1:-1] | t[1:-1, :-2] | t[1:-1, 2:]
    return s & near


def reink(a: np.ndarray, src: np.ndarray) -> np.ndarray:
    """Re-ink the outline: a row drop or a shear can leave an inside colour on the silhouette's edge. Where the source
    inks its edge (dark share >= 0.9), every light edge pixel takes the source's most common dark edge colour."""
    se = _edge(src)
    dark = se & (src[..., :3].max(2) < 60)
    if not se.any() or dark.sum() < 0.9 * se.sum():
        return a
    cols, n = np.unique(src[dark][:, :3], axis=0, return_counts=True)
    ink = cols[int(np.argmax(n))]
    out = a.copy()
    fix = _edge(a) & (a[..., :3].max(2) >= 60)
    out[fix, :3] = ink
    return out


def frames(idle: np.ndarray, key: np.ndarray, bottom: int, o: dict) -> dict[str, np.ndarray]:
    """{kneel_in1, kneel_in2, kneel_b} (RGBA uint8, the idle's cell) for an approved idle and AI kneel key."""
    if idle.shape != key.shape:
        raise ValueError(f"kneel bridge: key {key.shape} != idle {idle.shape}")
    u1, u2 = (float(v) for v in o["u"])
    low = max(_rows(idle)[1], _rows(key)[1])
    lim = max(bottom, low)
    return {"kneel_in1": reink(clear_border(toward(idle, key, u1, o), lim), idle),
            "kneel_in2": reink(clear_border(toward(key, idle, u2, o), lim), key),
            "kneel_b": reink(clear_border(breath(key, float(o["breath_at"])), lim), key)}

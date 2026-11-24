"""Hi-res monster textures (docs/ENEMY_FEEDBACK_PLAN.md EF-A, A1-A3): the per-sheet table entries of
gen/monster_scale.yaml, the native `despur` clean-up and the Scale2x (EPX) + nearest upscaler. Pure numpy, no AI.

Runs in the monsters_ai build (monster_atlas.build) **after** the frames are generated, checked and locked, so no
approved PNG, rig or lock changes: only the atlas pages do.

- `entry(sprite, value)`: one table entry -> {scale, tex, smooth}. A plain number is today's integer display scale at
  the native texture (tex 1, no smoothing); a dict is {scale: S, tex: T, smooth: [despur]} with S a multiple of
  SCALE_STEP (0.05) in [SCALE_MIN, SCALE_MAX] = [2, 3.5] (`valid_scale`; int-ef2, the user's 2026-11-24 ruling: the
  golems and the sea troll need sizes between and beyond {2, 2.5, 3}) and T = S (the texture drawn 1:1 at full size)
  or T = 1 with an integer S (a smooth-only entry at today's texture). Every product with T is exact (`frac`,
  `ceil_mul`): a float 2.7 x 10 is 27.000000000000004. `crop: true` (int-ef2): gen/monster_hires_crop.py.
- `despur(frame, outline, rounds)`: up to 2 rounds of: drop an opaque px with <= 1 opaque 4-neighbour that is not on
  the frame's lowest opaque row (its foot row); fill a transparent px with >= 3 opaque 4-neighbours with the sheet's
  outline colour (`outline_colour`: the darkest colour of the idle key's 1-px edge ring).
- `despur_sheet(sid, frames, foot_row)`: despur on every frame, the 3 % opaque-area guard and the frame-level checks of
  monster_check / anim_checks on the result (binary alpha, palette, pieces, outline second ring, feet row, clipping);
  any failure is a build error naming the sprite, the frame and the check.
- `upscale(frame, T)`: Scale2x on exact RGBA equality until the image is >= 8x, then nearest down-sampling to
  round(w*T) x round(h*T) (the RotSprite scaling step). No new colour, binary alpha, colours stay on the 15-bit grid.
  The sample of texture px t is 8x px floor((t + SAMPLE_OFFSET) * 8 / T): with an offset under 0.5 the texture rows
  ceil((r + 1) * T) and below sample native rows below r. The feet guard: when that sample leaves the frame's last
  texture row ceil((r + 1) * T) - 1 empty (Scale2x rounded the foot row's lowest 8x sub-rows away; shadow atk_wind2 at
  2.5), the row is re-sampled from the 8x row at the native row's centre, then from the native row itself, so the
  lowest opaque texture row is exactly ceil((r + 1) * T) - 1 for the native lowest row r (`feet_row`, asserted per frame).
"""
from __future__ import annotations

import math
from fractions import Fraction

import numpy as np
from PIL import Image

from gen import anim_checks as C

# EF-A1 (user request 2026-11-24, overrides D-V1 S1's integer scales): {2, 2.5, 3}; int-ef2 (user ruling 2026-11-24,
# "grow the tougher enemies"): any multiple of SCALE_STEP in [SCALE_MIN, SCALE_MAX], T = S
SCALE_MIN, SCALE_MAX = Fraction(2), Fraction(7, 2)
SCALE_STEP = Fraction(1, 20)
SMOOTH_OPS = ("despur", "edges")   # int-ef2 B4 round 2: `edges` = Scale2x on the silhouette only (epx)
SUPER = 8                          # Scale2x until the image is >= SUPER x
SAMPLE_OFFSET = 0.4                # < 0.5: keeps the feet row invariant at T = 2.5 (see the header)
DESPUR_ROUNDS = 2
MAX_AREA_CHANGE = 0.03


def frac(t: float) -> Fraction:
    """A scale as an exact fraction (2.7 -> 27/10; through its shortest repr, so YAML's floats map exactly)."""
    return Fraction(t) if isinstance(t, int) else Fraction(repr(float(t)))


def ceil_mul(n: int, t: float) -> int:
    """ceil(n * t), exact."""
    return math.ceil(n * frac(t))


def valid_scale(s) -> bool:
    """A display scale: a number, a multiple of SCALE_STEP in [SCALE_MIN, SCALE_MAX] (int-ef2)."""
    if isinstance(s, bool) or not isinstance(s, (int, float)) or not math.isfinite(s):
        return False
    f = frac(s)
    return SCALE_MIN <= f <= SCALE_MAX and (f / SCALE_STEP).denominator == 1


def entry(sprite: str, value) -> dict:
    """A validated table entry {scale, tex, smooth}; SystemExit naming the sprite on a bad one (EF-A1)."""
    def bad(why: str):
        raise SystemExit(f"monsters_ai: monster_scale.yaml {sprite}: {why} ({value!r})")
    if isinstance(value, bool):
        bad("a scale must be a number")
    if isinstance(value, (int, float)):
        if value not in (2, 3) or value != int(value):
            bad("a plain entry must be the integer 2 or 3 (a fractional scale needs {scale, tex})")
        return {"scale": int(value), "tex": 1, "smooth": []}
    if not isinstance(value, dict) or set(value) - {"scale", "tex", "smooth", "crop"} or "scale" not in value:
        bad("an entry is a number or {scale: S, tex: T, smooth: [despur], crop: true}")
    s, t, smooth = value["scale"], value.get("tex", 1), value.get("smooth") or []
    if not valid_scale(s):
        bad(f"scale must be a multiple of {float(SCALE_STEP)} in [{float(SCALE_MIN)}, {float(SCALE_MAX)}]")
    if isinstance(t, bool) or not isinstance(t, (int, float)) or not (t == s or (t == 1 and s == int(s))):
        bad("tex must equal scale, or be 1 with an integer scale")
    if not isinstance(smooth, list) or any(op not in SMOOTH_OPS for op in smooth):
        bad(f"smooth must be a list of {SMOOTH_OPS}")
    crop = value.get("crop", False)
    if not isinstance(crop, bool) or (crop and t == 1):
        bad("crop must be true or false, and only on a hi-res entry (tex > 1)")
    num = (lambda v: int(v) if v == int(v) else float(v))
    return {"scale": num(s), "tex": num(t), "smooth": list(smooth), **({"crop": True} if crop else {})}


def unit(t: float) -> int:
    """The smallest texture px step u with u / t a whole number of art px (2 -> 2, 2.5 -> 5, 3 -> 3, 2.8 -> 14): the
    numerator of t in lowest terms."""
    return frac(t).numerator


def tex_cell(cell: tuple[int, int], t: float) -> tuple[int, int]:
    """The texture size of a cell: ceil(cell * t) (padded right / bottom when cell * t is not whole)."""
    return ceil_mul(cell[0], t), ceil_mul(cell[1], t)


def _clean(a: np.ndarray) -> np.ndarray:
    """RGBA with every transparent px (0, 0, 0, 0), so equality compares only drawn colours."""
    a = np.array(a, np.uint8, copy=True)
    a[a[..., 3] == 0] = 0
    return a


def epx(a: np.ndarray, edges: bool = False) -> np.ndarray:
    """Scale2x (EPX) on an H x W x 4 uint8 array with exact RGBA equality: each px becomes 2x2, a corner takes a
    neighbour's colour where the two neighbours on that corner agree and the other two differ. `edges` (int-ef2, the
    dragons' B4 round 2): only where that changes the alpha (the silhouette), the inside stays nearest."""
    h, w, _ = a.shape
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    e, b, hh, d, f = p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
    eq = (lambda x, y: np.all(x == y, axis=2))
    db, bf, dh, hf = eq(d, b), eq(b, f), eq(d, hh), eq(hh, f)
    out = np.empty((h * 2, w * 2, 4), np.uint8)
    for (dy, dx), c, src in (((0, 0), db & ~bf & ~dh, d), ((0, 1), bf & ~db & ~hf, f),
                             ((1, 0), dh & ~db & ~hf, d), ((1, 1), hf & ~dh & ~bf, f)):
        c = c & ((e[..., 3] > 0) != (src[..., 3] > 0)) if edges else c
        out[dy::2, dx::2] = np.where(c[..., None], src, e)
    return out


def _samples(n_out: int, n_big: int, t: float, k: int) -> np.ndarray:
    """floor((i + SAMPLE_OFFSET) * k / t) for each texture px i, in exact integers (t = p / q, SAMPLE_OFFSET 2 / 5;
    the same values as the float form at T 2, 2.5 and 3, where no product lands on a whole number)."""
    f, o = frac(t), Fraction(repr(SAMPLE_OFFSET))
    i = np.arange(n_out, dtype=np.int64)
    idx = ((i * o.denominator + o.numerator) * k * f.denominator) // (o.denominator * f.numerator)
    return np.clip(idx, 0, n_big - 1)


def upscale(a: np.ndarray, t: float, edges: bool = False) -> np.ndarray:
    """The frame at t texture px per art px (EF-A2; `edges`: silhouette-only Scale2x); t = 1 returns it unchanged."""
    a = _clean(a)
    if t == 1:
        return a
    h, w, _ = a.shape
    big, k = a, 1
    while k < SUPER:
        big, k = epx(big, edges), k * 2
    th, tw = ceil_mul(h, t), ceil_mul(w, t)
    ys, xs = _samples(th, big.shape[0], t, k), _samples(tw, big.shape[1], t, k)
    out = np.ascontiguousarray(big[ys][:, xs])
    r = lowest_row(a)
    if r is not None:                    # the feet guard: Scale2x can round the native foot row's edge sub-rows away
        want = ceil_mul(r + 1, t) - 1
        for row in (big[r * k + k // 2][xs], a[r][np.clip(xs // k, 0, w - 1)]):
            if out[want, :, 3].any():
                break
            out[want] = row
    return out


def lowest_row(a: np.ndarray) -> int | None:
    rows = np.nonzero((a[..., 3] > 0).any(axis=1))[0]
    return int(rows.max()) if len(rows) else None

def feet_row(native: np.ndarray, tex: np.ndarray, t: float) -> list[str]:
    """EF-A2 feet invariant: the lowest opaque texture row is ceil((r + 1) * t) - 1 for the native lowest row r."""
    r, got = lowest_row(native), lowest_row(tex)
    want = None if r is None else ceil_mul(r + 1, t) - 1
    return [] if got == want else [f"lowest texture row {got} != {want} (native row {r}, texScale {t})"]


def outline_colour(idle: np.ndarray) -> tuple[int, int, int]:
    """The darkest colour (by R + G + B, then RGB order) of the idle key's 1-px edge ring (opaque px with a transparent
    4-neighbour, the cell edge counting as transparent)."""
    s = idle[..., 3] > 0
    pad = np.pad(s, 1)
    edge = s & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    cols = {tuple(int(v) for v in c) for c in idle[edge][:, :3]}
    if not cols:
        raise SystemExit("monsters_ai: despur: the idle key has no opaque px")
    return min(cols, key=lambda c: (sum(c), c))


def _n4(op: np.ndarray) -> np.ndarray:
    p = np.pad(op, 1)
    return p[:-2, 1:-1].astype(np.int8) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]


def despur(a: np.ndarray, outline: tuple[int, int, int], rounds: int = DESPUR_ROUNDS) -> tuple[np.ndarray, int, int]:
    """(frame, px dropped, px filled) after up to `rounds` rounds of spur drops then notch fills (EF-A3)."""
    a = _clean(a)
    foot = lowest_row(a)
    dropped = filled = 0
    for _ in range(rounds):
        op = a[..., 3] > 0
        spur = op & (_n4(op) <= 1)
        if foot is not None:
            spur[foot] = False
        a[spur] = 0
        op = a[..., 3] > 0
        notch = ~op & (_n4(op) >= 3)
        a[notch] = (*outline, 255)
        dropped, filled = dropped + int(spur.sum()), filled + int(notch.sum())
        if not spur.any() and not notch.any():
            break
    return a, dropped, filled


def native_checks(post: np.ndarray, pre: np.ndarray, outline: tuple[int, int, int]) -> list[str]:
    """The frame-level checks on a post-processed native frame against the frame it came from: binary alpha, palette
    (pre's colours plus the outline colour), pieces / detached px, the outline second ring (+-0.08), the feet row
    (the lowest opaque row unchanged) and clipping (nothing on the cell border)."""
    allowed = {tuple(int(v) for v in c) for c in pre[pre[..., 3] > 0][:, :3]} | {outline}
    out = C.binary_alpha(post) + C.palette_lock(post, allowed) + C.detached(post, pre)
    if abs(C.second_ring(post) - C.second_ring(pre)) > 0.08:
        out.append(f"second ring {C.second_ring(post):.2f} vs source {C.second_ring(pre):.2f} (+-0.08)")
    if lowest_row(post) != lowest_row(pre):
        out.append(f"feet row {lowest_row(post)} != {lowest_row(pre)}")
    return out + C.clipping(post)


def despur_sheet(sid: str, frames: dict[str, Image.Image]) -> tuple[dict[str, Image.Image], dict]:
    """({name: frame} after despur, report {dropped, filled, frames}) for one sheet; SystemExit on the 3 % guard or a
    failing frame check, naming the sprite, the frame and the check."""
    outline = outline_colour(np.asarray(frames["idle"].convert("RGBA")))
    out, dropped, filled, fails = {}, 0, 0, []
    for name in sorted(frames):
        pre = _clean(np.asarray(frames[name].convert("RGBA")))
        post, d, f = despur(pre, outline)
        area0, area1 = int((pre[..., 3] > 0).sum()), int((post[..., 3] > 0).sum())
        if area0 and abs(area1 - area0) / area0 > MAX_AREA_CHANGE:
            fails.append(f"{sid} {name}: despur changes the opaque area by {abs(area1 - area0) / area0:.1%} > 3 %")
        fails += [f"{sid} {name}: despur: {e}" for e in native_checks(post, pre, outline)]
        dropped, filled = dropped + d, filled + f
        out[name] = Image.fromarray(post, "RGBA")
    if fails:
        raise SystemExit("monsters_ai: smooth checks failed\n  " + "\n  ".join(fails))
    return out, {"dropped": dropped, "filled": filled, "frames": len(frames), "outline": list(outline)}


def hires_sheet(sid: str, frames: dict[str, Image.Image], t: float, edges: bool = False) -> dict[str, Image.Image]:
    """{name: texture} at t texture px per art px; SystemExit naming the sprite and frame when the feet row moves."""
    out, fails = {}, []
    for name in sorted(frames):
        a = np.asarray(frames[name].convert("RGBA"))
        tex = upscale(a, t, edges)
        fails += [f"{sid} {name}: {e}" for e in feet_row(a, tex, t) + C.binary_alpha(tex)]
        out[name] = Image.fromarray(tex, "RGBA")
    if fails:
        raise SystemExit("monsters_ai: hi-res checks failed\n  " + "\n  ".join(fails))
    return out

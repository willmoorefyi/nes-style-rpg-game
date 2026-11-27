"""Pass CL (docs/CLASS_LANCE_PLAN.md 5): puppet in-betweens of an oversize hero holding a rigid lance.

Each keyframe (ready, attack, cast) is split into its body (the lance cut out, its footprint filled from the body
beside it, hero_user_lance.fill_footprint) and its lance (the pixels of the approved json's line, completed under the
fists). An in-between is one keyframe's body, never cut into parts (review round 1: the generic part rig broke these
detailed bodies), its upper body bobbed by whole px above the hips (`RIGID`). The lance is never resampled: it is
either *carried* (a keyframe's lance moved by whole px to the near fist, the user's pixels) or *redrawn* at a clean
pixel-art angle (the shaft as pixel-perfect strands with the colours sampled along the source shaft, the head turned
by RotSprite). Draw order: the body, the lance's own pixels over it, its completed / butt-side stretch only where the
body is not. Checks L1-L8 (5.2.5) and the body check on the body only: `review_checks`.
"""
from __future__ import annotations

import json
import math

import numpy as np
from PIL import Image

from gen import hero_user_lance as HL
from gen import puppet as PU

S_ANGLES = sorted({s * math.degrees(math.atan(r)) for r in (0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 3 / 2, 2, 3, 4)
                   for s in (1, -1)} | {90.0, -90.0})
TURN_MAX = 27.0
SWAPS = {("cast_gather", "cast_rise"), ("kneel_in1", "kneel_in2"),   # keyframe swaps every class makes (L8);
         ("atk_wind1", "atk_wind2")}                                # review round 2: the ready -> attack swap
# in-between -> (body keyframe, upper-body bob in px (+ down), lance keyframe, lance mode); atk_wind1's lance is
# redrawn at the clean angle nearest (ready + attack) / 2, every other lance is carried
RIGID = {"idle_b": ("ready", 1, "ready", "whole"), "atk_wind1": ("ready", 2, "ready", "whole"),
         "atk_wind2": ("attack", 2, "attack", "whole"), "atk_mid": ("attack", 1, "attack", "whole"),
         "atk_follow": ("attack", 2, "attack", "whole"), "cast_gather": ("ready", 1, "ready", "whole"),
         "cast_rise": ("cast", 1, "cast", "carry"), "cast_release": ("cast", -1, "cast", "carry")}
PLAN = {n: (v[3], v[2]) for n, v in RIGID.items()}       # in-between -> (lance mode, lance keyframe) for the checks
BUTT_MARGIN = 1          # a carried lance is slid along its own axis to keep this many px inside the cell edge


def meta_of(cid: str, sheet: str = "battle") -> dict:
    return json.loads((PU.APPROVED / cid / f"{sheet}.json").read_text())


def colours(meta: dict, key: str = "colours") -> list | None:
    """The lance (`colours`) or shaft (`shaft_colours`) colours in the approved (house) palette."""
    if meta["prop"].get(key) is None:
        return None
    src = {tuple(c) for c in meta["prop"][key]}
    return [d for s, d in meta["cut"]["palette"] if tuple(s) in src]


def lance_mask(meta: dict, img: np.ndarray, line) -> np.ndarray:
    p = meta["prop"]
    return HL.mask(img, line, colours(meta), p["radius"], float(p["head_len"]), colours(meta, "shaft_colours"))


def split(meta: dict, img: np.ndarray, line, foot: int | None = None) -> dict:
    """{img, mask, body (lance cut, footprint filled), filled, line, lpx / lmask (the lance completed under the
    hands), planted} of one approved cell."""
    m = lance_mask(meta, img, line)
    body, filled = HL.fill_footprint(img, m, line)
    part = {"img": img, "mask": m, "body": body, "filled": filled, "line": [list(map(float, v)) for v in line]}
    part["lpx"], part["lmask"], part["completed"] = complete(img, m, line, float(meta["prop"]["head_len"]))
    foot = int(meta["bottom_row"]) if foot is None else foot
    part["planted"] = bool(np.nonzero(m.any(1))[0].max() >= foot - 1)
    return part


def _rows(img: np.ndarray, m: np.ndarray, line, head: float) -> tuple[int, dict]:
    """The shaft beyond the head per major-axis step: (major axis, {major coordinate: {minor offset: rgba}})."""
    tip, u, n = HL.seg(line)
    major = 0 if abs(u[0]) >= abs(u[1]) else 1
    rows: dict[int, dict] = {}
    for y, x in zip(*np.nonzero(m)):
        p = np.array([x, y], float)
        if float((p - tip) @ u) < head:
            continue
        maj = int(p[major])
        off = int(round(p[1 - major] - (tip[1 - major] + (maj - tip[major]) / u[major] * u[1 - major])))
        rows.setdefault(maj, {})[off] = img[y, x]
    return major, rows


def complete(img: np.ndarray, m: np.ndarray, line, head: float) -> tuple[np.ndarray, np.ndarray, int]:
    """The lance with the stretches a hand or the body hides in the keyframe filled in: every major-axis step of the
    shaft between the head and the butt gets the full cross-section (the offsets most steps have), each missing offset
    from the nearest step that has it. Returns (rgba lance only, mask, px added)."""
    tip, u, n = HL.seg(line)
    major, rows = _rows(img, m, line, head)
    lpx = np.where(m[..., None], img, 0).astype(np.uint8)
    lm = m.copy()
    if not rows:
        return lpx, lm, 0
    from collections import Counter
    full = Counter(frozenset(o) for o in rows.values()).most_common(1)[0][0]
    a, b = tip + head * u, tip + n * u
    lo, hi = sorted((int(round(a[major])), int(round(b[major]))))
    have = sorted(rows)
    h, w = m.shape
    added = 0
    for maj in range(lo, hi + 1):
        for off in full:
            if off in rows.get(maj, {}):
                continue
            near = min((k for k in have if off in rows[k]), key=lambda k: abs(k - maj), default=None)
            if near is None:
                continue
            mn = tip[1 - major] + (maj - tip[major]) / u[major] * u[1 - major]
            q = [0, 0]
            q[major], q[1 - major] = maj, int(round(mn + off))
            x, y = q
            if 0 <= x < w and 0 <= y < h and not lm[y, x] and img[y, x, 3] > 0:   # only what a hand / the body hides
                lpx[y, x] = rows[near][off]
                lm[y, x] = True
                added += 1
    return lpx, lm, added


def shift(a: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def carry(part: dict, delta, completed: bool = True, under: bool = False) -> dict:
    """The keyframe's lance (completed under its hands) moved by whole px: slid back along its own axis if that would
    leave the cell, and by the hand's x only when it stands planted on the ground in its keyframe."""
    h, w = part["mask"].shape
    dx, dy = (int(round(v)) for v in delta)
    if part.get("planted"):
        dy = 0
    px, lm = (part["lpx"], part["lmask"]) if completed else (np.where(part["mask"][..., None], part["img"], 0), part["mask"])
    ys, xs = np.nonzero(lm)
    tip, u, n = HL.seg(part["line"])
    for _ in range(64):
        if xs.min() + dx >= BUTT_MARGIN and xs.max() + dx < w - BUTT_MARGIN and ys.min() + dy >= 0 and \
                ys.max() + dy < h - BUTT_MARGIN:
            break
        step = -u if (xs.max() + dx >= w - BUTT_MARGIN or ys.max() + dy >= h - BUTT_MARGIN) else u
        if abs(step[0]) >= abs(step[1]):
            dx += int(np.sign(step[0]))
        else:
            dy += int(np.sign(step[1]))
    line = [[part["line"][0][0] + dx, part["line"][0][1] + dy], [part["line"][1][0] + dx, part["line"][1][1] + dy]]
    return {"px": shift(px, dx, dy), "mask": shift(lm, dx, dy), "line": line, "mode": "carry", "completed": completed,
            "delta": (dx, dy), "rear": shift(part["lmask"] & ~part["mask"], dx, dy) if under else None}


def _keys(cid: str):
    meta = meta_of(cid)
    frames = PU.battle_sheet_frames(cid)
    return meta, {k: split(meta, np.asarray(frames[k].convert("RGBA")).copy(), meta["prop"]["lines"][k])
                  for k in PU.KEYFRAMES}


def line_dist(p, line) -> float:
    """Distance from p to the lance's line, extended both ways (the part behind the body is hidden, not gone)."""
    tip, u, _ = HL.seg(line)
    v = np.asarray(p, float) - tip
    return float(abs(v[0] * u[1] - v[1] * u[0]))


def bob(body: np.ndarray, cut: int, dy: int) -> np.ndarray:
    """The body with everything above row `cut` (the hips) moved dy px (puppet.bob: + down; up repeats the cut row),
    the legs and the feet row untouched."""
    return np.asarray(PU.bob(Image.fromarray(body), cut, dy)) if dy else body.copy()


def frames_of(cid: str, cfg: dict | None = None) -> dict[str, dict]:
    """{in-between: {img, body, lance, target, source}}. Each in-between is one user keyframe, never cut into parts
    (review round 1), its upper body bobbed by whole px (RIGID: body key, dy, lance key, mode; `tweaks: {<frame>:
    {dy: n}}`). `whole` (review round 2): the key with its own lance, nothing cut out, bobbed above a cut row below the
    hips and below the lance's lowest px, so the lance moves with the hands as drawn; `carry`: a lance that stands on
    the ground (the cast lance) is cut out (body footprint filled) and carried planted (x only), the body bobbed alone;
    `redraw` (kept for a lance that must turn): the lance at a clean angle, gripped at the near fist."""
    cfg = dict(cfg or PU.load_cfg(cid))
    if "prop" not in meta_of(cid):
        return plain_frames(cid, cfg)
    meta, keys = _keys(cid)
    head = float(meta["prop"]["head_len"])
    b = cfg["battle"]
    size = keys["ready"]["mask"].shape[::-1]
    ang_w1 = snap((HL.angle(keys["ready"]["line"]) + HL.angle(keys["attack"]["line"])) / 2)
    out = {}
    for name, (bk, dy, lk, mode) in RIGID.items():
        dy = int((((cfg.get("tweaks") or {}).get(name) or {}).get("dy", dy)))
        cut = int(round(min(b[bk]["hip_n"][1], b[bk]["hip_f"][1])))
        if mode == "whole":
            k = keys[bk]
            if k["planted"]:
                raise ValueError(f"{cid} {name}: a planted lance cannot bob with its key (use carry)")
            cut = max(cut, int(np.nonzero(k["mask"].any(1))[0].max()) + 1)
            img = bob(k["img"], cut, dy)
            lance = carry(k, (0, dy), completed=False)
            lance["mode"] = "whole"
            out[name] = {"img": Image.fromarray(img), "body": bob(k["body"], cut, dy), "lance": lance, "source": bk,
                         "target": {"hand_n": tuple(np.asarray(b[bk]["hand_n"], float) + (0, dy))}}
            continue
        body = bob(keys[bk]["body"], cut, dy)
        grip = np.asarray(b[bk]["hand_n"], float) + (0, dy if b[bk]["hand_n"][1] < cut else 0)
        if mode == "carry":
            lance = carry(keys[lk], grip - np.asarray(b[lk]["hand_n"], float), under=True)
        else:
            lance = redraw(keys[lk], ang_w1, b[lk]["hand_n"], grip, head, size)
        out[name] = {"img": compose(body, lance, None), "body": body, "lance": lance, "source": bk,
                     "target": {"hand_n": tuple(grip)}}
    for name in cfg.get("alias_frames") or []:
        out.pop(name, None)
    return out


def plain_frames(cid: str, cfg: dict) -> dict[str, dict]:
    """Pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md 6.1): a rigid class without a prop (`inbetweens: rigid`): each
    in-between is its RIGID key whole, everything above the cut row bobbed by dy, nothing cut out, so a blade moves
    rigidly with the figure. `rigid_cut: feet` puts the cut on the feet row (a blade held low crosses the hips; the
    feet row stays, so the figure sinks by its ankles); else the hips. `tweaks: {<frame>: {dy: n}}` as for a lance."""
    meta = meta_of(cid)
    keys = PU.battle_sheet_frames(cid)
    b = cfg["battle"]
    out = {}
    for name, (bk, dy, _, _) in RIGID.items():
        dy = int((((cfg.get("tweaks") or {}).get(name) or {}).get("dy", dy)))
        cut = int(meta["bottom_row"]) if cfg.get("rigid_cut") == "feet" else \
            int(round(min(b[bk]["hip_n"][1], b[bk]["hip_f"][1])))
        img = bob(np.asarray(keys[bk].convert("RGBA")).copy(), cut, dy)
        out[name] = {"img": Image.fromarray(img), "body": img, "lance": None, "source": bk,
                     "target": {"hand_n": tuple(b[bk]["hand_n"])}}
    for name in cfg.get("alias_frames") or []:
        out.pop(name, None)
    return out


def compose(body: np.ndarray, lance: dict, hands: np.ndarray | None) -> Image.Image:
    out = body.copy()
    m = lance["mask"].copy()
    if lance.get("rear") is not None:
        m &= ~(lance["rear"] & (body[..., 3] > 0))
    out[m] = lance["px"][m]
    if hands is not None:
        hm = hands[..., 3] > 0
        out[hm] = hands[hm]
    return Image.fromarray(out, "RGBA")


def inbetweens(cid: str, cfg: dict | None = None) -> dict[str, Image.Image]:
    return {n: f["img"] for n, f in frames_of(cid, cfg).items()}


from gen.puppet_lance_redraw import redraw, snap  # noqa: E402,F401  (the clean-angle redraw)
# the checks L1-L8 live in puppet_lance_checks.py (re-exported here; imported last: it reads this module's names)
from gen.puppet_lance_checks import lance_checks, review_checks, straight, turns  # noqa: E402,F401

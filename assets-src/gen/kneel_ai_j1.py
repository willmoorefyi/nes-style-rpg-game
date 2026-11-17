"""Group J1 (docs/KNEEL_AI_PLAN.md 6): checks that need the hand-marked kneel joints. A failure archives the key
(`retire_kneel.py --key`) and sends the sprite to its next try.

- A-prop / A-headdup: for each `weapons` / `heads` part of kneel_ai.yaml: the idle part's pixels posed rigidly on the
  marked bone vs the key's pixels of that part (rig.segment on the marked joints): alpha IoU >= T_prop_iou /
  T_head_iou; key pixels in the part's distinctive colours (>= 60 % of that colour's idle pixels are in the part, the
  outline excluded) outside the posed part dilated by 2 px <= T_outside / T_head_outside x the idle part's size.
  A `part:label` head (rhyos `body:lion`) is the `masks.<label>.<kf>` polygon, posed by its centroid shift.
- A-head: the head joint (crown, else the rig's first head joint) drops >= 0.15 x idle height.
- A-scale: the first `heads` part (or `scale_part`) is within +-10 % of the idle's in its larger dimension.
The same measures on the approved hurt keys and their marked hurt joints calibrate the thresholds (kneel_ai_calib).
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen import kneel_ai_cut as C
from gen import kneel_ai_data as D

OWN = 0.6                     # a colour belongs to a part when >= 60 % of its idle pixels are in it
SCALE_TOL = 0.10


def lists(sp: D.Sprite) -> tuple[list[str], list[str], str | None]:
    e = (D.conf().get("sprites") or {}).get(sp.sid) or {}
    return list(e.get("weapons") or []), list(e.get("heads") or []), e.get("scale_part")


def rig_for(sp: D.Sprite, kf: str, joints: dict | None):
    from gen import kneel as KN
    from gen import rig as R
    if kf == "kneel":
        return R.Rig(KN.extend_cfg(sp.rig.cfg, joints, []), sp.cell)
    return sp.rig


def _poly(rig, label: str, kf: str, shape) -> np.ndarray | None:
    poly = ((rig.cfg.get("masks") or {}).get(label) or {}).get(kf)
    if not poly:
        return None
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    return np.asarray(m) > 0


def part_mask(rig, name: str, kf: str, img: np.ndarray, lab: np.ndarray, names: list[str]) -> np.ndarray | None:
    if ":" in name:
        m = _poly(rig, name.split(":", 1)[1], kf, img.shape)
        return None if m is None else m & (img[..., 3] > 0)
    return (lab == names.index(name)) if name in names and rig.present(name, kf) else None


def pose(rig, name: str, kf: str, m: np.ndarray, poly_k: np.ndarray | None = None) -> np.ndarray:
    """The idle part mask moved rigidly onto the part's `kf` bone (a `part:label` by its polygon centroid shift)."""
    ys, xs = np.nonzero(m)
    out = np.zeros(m.shape, bool)
    if ":" in name:
        pi = _poly(rig, name.split(":", 1)[1], "idle", m.shape)
        (cy0, cx0), (cy1, cx1) = [np.argwhere(p).mean(0) for p in (pi, poly_k)]
        X, Y = xs + (cx1 - cx0), ys + (cy1 - cy0)
    else:
        js = rig.joints_of(name, kf)
        ji = rig.joints_of(name, "idle")
        a0, b0 = rig.keyframes["idle"][ji[0]], rig.keyframes["idle"][ji[-1]]
        a1, b1 = rig.keyframes[kf][js[0]], rig.keyframes[kf][js[-1]]
        t = math.atan2(b1[1] - a1[1], b1[0] - a1[0]) - math.atan2(b0[1] - a0[1], b0[0] - a0[0])
        dx, dy = xs - a0[0], ys - a0[1]
        X, Y = a1[0] + dx * math.cos(t) - dy * math.sin(t), a1[1] + dx * math.sin(t) + dy * math.cos(t)
    X, Y = np.round(X).astype(int), np.round(Y).astype(int)
    ok = (X >= 0) & (Y >= 0) & (X < m.shape[1]) & (Y < m.shape[0])
    out[Y[ok], X[ok]] = True
    return out


def grow(m: np.ndarray, n: int) -> np.ndarray:
    for _ in range(n):
        m = m | np.logical_or.reduce([C._shift(m, dy, dx) for dy, dx in C.DIRS])
    return m


def peaks(src: np.ndarray, m: np.ndarray, img: np.ndarray, floor: float = 0.4, n: int = 6) -> list[float]:
    """The part `m` of `src` as a template slid (translation only) over `img`: the scores (share of its pixels landing
    on an opaque pixel within dE76 12 of their own colour) of up to n separate peaks >= floor, best first. A copy of a
    part drawn twice, even in colours the rest of the body shares (rhyos' stone rams, the warrior's steel), is a peak."""
    ys, xs = np.nonzero(m)
    if not len(ys):
        return []
    v, u = ys - ys.min(), xs - xs.min()
    th, tw = int(v.max()) + 1, int(u.max()) + 1
    H, W = img.shape[:2]
    if th > H or tw > W:
        return []
    cols, inv = np.unique(src[ys, xs, :3].reshape(-1, 3), axis=0, return_inverse=True)
    lab_img, lab_c, inv = D.rgb2lab(img[..., :3]), D.rgb2lab(cols), inv.ravel()
    op, S = img[..., 3] > 0, np.zeros((H - th + 1, W - tw + 1), np.int32)
    for ci in range(len(cols)):
        mc = op & (np.linalg.norm(lab_img - lab_c[ci], axis=-1) <= 12)
        for vv, uu in zip(v[inv == ci], u[inv == ci]):
            S += mc[vv:vv + S.shape[0], uu:uu + S.shape[1]]
    S = S / len(ys)
    r, out = max(2, max(th, tw) // 2), []
    while len(out) < n:
        oy, ox = np.unravel_index(int(S.argmax()), S.shape)
        if S[oy, ox] < floor:
            break
        out.append(round(float(S[oy, ox]), 3))
        S[max(0, oy - r):oy + r + 1, max(0, ox - r):ox + r + 1] = -1
    return out


def extra(key_peaks: list[float], idle_peaks: list[float], tau: float) -> int:
    """Template peaks >= tau on the key beyond the idle's own (a second copy of the part)."""
    return sum(p >= tau for p in key_peaks) - sum(p >= tau for p in idle_peaks)


def score(sp: D.Sprite, rig, name: str, key: np.ndarray, kf: str) -> tuple | None:
    """(alpha IoU, outside ratio, key peaks, idle peaks) of one part on `key` posed by the rig's `kf` joints; None if
    the part is absent."""
    from gen import rig as R
    idle = sp.idle
    lab_i, names = R.segment(rig, "idle", idle)
    lab_k, _ = R.segment(rig, kf, key)
    mi, mk = part_mask(rig, name, "idle", idle, lab_i, names), part_mask(rig, name, kf, key, lab_k, names)
    if mi is None or mk is None or not mi.any():
        return None
    posed = pose(rig, name, kf, mi, _poly(rig, name.split(":", 1)[1], kf, idle.shape) if ":" in name else None)
    iou = float((posed & mk).sum() / max(int((posed | mk).sum()), 1))
    ink = C.outline_rgb(idle)
    ids_i = idle[..., :3].astype(np.int64) @ np.array([65536, 256, 1])
    ids_k = key[..., :3].astype(np.int64) @ np.array([65536, 256, 1])
    inkid = ink[0] * 65536 + ink[1] * 256 + ink[2]
    cols = [c for c in np.unique(ids_i[mi]).tolist() if c != inkid
            and (ids_i[mi] == c).sum() >= OWN * ((ids_i == c) & (idle[..., 3] > 0)).sum()]
    own = np.isin(ids_k, cols) & (key[..., 3] > 0)
    outside = float((own & ~grow(posed, 2)).sum()) / max(int(mi.sum()), 1)
    return iou, outside, peaks(idle, mi, key), peaks(idle, mi, idle)


def attack_mask(sp: D.Sprite) -> tuple:
    """(the `attack` key's weapon mask, the attack key) of a hero, or (None, None)."""
    from gen import rig as R
    att = {k: [float(v[0]), float(v[1])] for k, v in sp.cfg["battle"].get("attack", {}).items()
           if isinstance(v, (list, tuple))}
    if "tip" not in att or "attack" not in sp.keys:
        return None, None
    rig = R.Rig({**sp.rig.cfg, "keyframes": {**sp.rig.cfg["keyframes"], "attack": att}}, sp.cell)
    lab, names = R.segment(rig, "attack", sp.keys["attack"])
    return lab == names.index("weapon"), sp.keys["attack"]


def attack_weapon(sp: D.Sprite, key: np.ndarray, T: dict) -> list[tuple[str, bool | None, str]]:
    """An empty-handed hero `ready`: the attack key's weapon, slid over the kneel key, may not peak more often than
    over the ready (R3 variant B: a second sword and hand)."""
    m, a = attack_mask(sp)
    if m is None:
        return []
    x = extra(peaks(a, m, key), peaks(a, m, sp.idle), T["T_dup_match"])
    return [("A-prop weapon@attack", x <= 0, f"{x} extra copies of the attack weapon (template >= "
                                              f"{T['T_dup_match']:.2f})")]


def _extent(m: np.ndarray) -> int:
    ys, xs = np.nonzero(m)
    return int(max(ys.max() - ys.min() + 1, xs.max() - xs.min() + 1)) if len(ys) else 0


def j1(sp: D.Sprite, key: np.ndarray, joints: dict, T: dict) -> list[tuple[str, bool | None, str]]:
    from gen import rig as R
    rig, (weapons, heads, scale_part) = rig_for(sp, "kneel", joints), lists(sp)
    out = []
    for group, names, ti, to in (("A-prop", weapons, "T_prop_iou", "T_prop_outside"),
                                 ("A-headdup", heads, "T_head_iou", "T_head_outside")):
        for n in names:
            s = score(sp, rig, n, key, "kneel")
            if s is None:
                out.append((f"{group} {n}", False, "part not found on the marked key"))
                continue
            x = extra(s[2], s[3], T["T_dup_match"])
            out.append((f"{group} {n}", s[0] >= T[ti] and s[1] <= T[to] and x <= 0,
                        f"IoU {s[0]:.2f} (>= {T[ti]:.2f}), outside {s[1]:.2f} (<= {T[to]:.2f}), {x} extra copies"))
    if sp.hero and not weapons:
        out += attack_weapon(sp, key, T)
    S, K, h = rig.keyframes["idle"], rig.keyframes["kneel"], D.height(sp.idle)
    hj = "crown" if "crown" in S else next((j for j in rig.head if j in S), None)
    if hj and hj in K:
        drop = K[hj][1] - S[hj][1]
        out.append(("A-head", drop >= 0.15 * h, f"{hj} down {drop:.1f} px (>= {0.15 * h:.1f})"))
    ref = heads[:1] or ([scale_part] if scale_part else [])
    if ref:
        lab_i, names = R.segment(rig, "idle", sp.idle)
        lab_k, _ = R.segment(rig, "kneel", key)
        mi = part_mask(rig, ref[0], "idle", sp.idle, lab_i, names)
        mk = part_mask(rig, ref[0], "kneel", key, lab_k, names)
        r = _extent(mk) / max(_extent(mi), 1) if mi is not None and mk is not None else 0.0
        out.append(("A-scale", abs(r - 1) <= SCALE_TOL, f"{ref[0]} {r:.2f} x the idle's (+-{SCALE_TOL:.2f})"))
    return out

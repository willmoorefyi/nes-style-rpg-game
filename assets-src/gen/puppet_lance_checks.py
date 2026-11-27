"""Pass CL (docs/CLASS_LANCE_PLAN.md 5.2.5): the lance checks of puppet_lance's frames: L1 unbroken, L2 length, L3
pixel-perfect strands (a redrawn shaft), L4 a clean angle or the user's pixels carried byte-equal, L5 inside the cell
and above the feet row (but pixels carried from a key), L6 the palette and binary alpha, L7 the grip on the shaft, L8
the turn between played frames; `review_checks` adds the body check on the body and the feet row (puppet.py review)."""
from __future__ import annotations

from collections import Counter

import numpy as np
from PIL import Image

from gen import hero_user_lance as HL
from gen import puppet as PU
from gen import puppet_lance as PL


def lance_checks(img: np.ndarray, lance: dict, src: dict, palette: set, foot: int, exempt: np.ndarray | None = None,
                 grips=()) -> dict:
    """The lance checks of one generated frame; {name: bool, ...}. `exempt`: below-foot px allowed (carried from a key)."""
    h, w = img.shape[:2]
    rep = {}
    rep["L1"] = not HL.unbroken(img, lance["line"])
    n_src = HL.seg(src["line"])[2]
    if lance["mode"] in ("carry", "whole"):
        rep["L2"] = True
        ys, xs = np.nonzero(lance["mask"])
        base = src["lpx"] if lance.get("completed", True) else np.where(src["mask"][..., None], src["img"], 0)
        rep["L4"] = bool(np.array_equal(lance["px"], PL.shift(base, *lance["delta"])))
        rep["L3"] = True
    else:
        tip, u, _ = HL.seg(lance["line"])
        ys, xs = np.nonzero(lance["mask"])
        t = (np.stack([xs, ys], 1) - tip) @ u
        rep["L2"] = bool(abs((t.max() - t.min()) - n_src) <= 1.5)
        rep["L4"] = any(abs(lance["angle"] - s) < 1e-6 for s in PL.S_ANGLES)
        rep["L3"] = straight(lance)
    below = lance["mask"].copy()
    below[:foot + 1] = False
    if exempt is not None:
        below &= ~exempt
    rep["L5"] = not below.any() and lance["mask"].sum() > 0
    cols = {tuple(int(v) for v in c) for c in img[img[..., 3] > 0][:, :3]}
    rep["L6"] = cols <= palette and set(np.unique(img[..., 3]).tolist()) <= {0, 255}
    tip, u, n = HL.seg(lance["line"])
    rep["L7"] = all(PL.line_dist(g, lance["line"]) <= 2.5 for g in grips)
    return rep


def straight(lance: dict) -> bool:
    """L3: a redrawn shaft is pixel-perfect strands: per major-axis step one px per strand, each within 0.5 px of its
    strand's ideal line on the minor axis, and the same strands (cross-section) on at least 90 % of the steps."""
    tip, u, n = HL.seg(lance["line"])
    major = 0 if abs(u[0]) >= abs(u[1]) else 1
    ys, xs = np.nonzero(lance["mask"] & ~lance.get("headmask", np.zeros_like(lance["mask"])))   # the shaft (not the RotSprite head)
    p = np.stack([xs, ys], 1).astype(float)
    t = (p - tip) @ u
    p = p[t > float(lance.get("head", 0)) + 1]
    ideal = tip[1 - major] + (p[:, major] - tip[major]) / u[major] * u[1 - major]
    dev = p[:, 1 - major] - ideal
    k = p[:, 1 - major] - np.floor(ideal + 0.5 + 1e-6)   # the strand index, by the drawing's own rounding
    if not len(p) or np.abs(dev - k).max() > 0.5 + 1e-6:
        return False
    steps: dict[int, list] = {}
    for m_, kk in zip(p[:, major].astype(int), k.astype(int)):
        steps.setdefault(m_, []).append(kk)
    if any(len(v) != len(set(v)) for v in steps.values()):
        return False
    full, common = Counter(frozenset(v) for v in steps.values()).most_common(1)[0]
    return common >= 0.9 * len(steps) and all(set(v) <= full for v in steps.values())   # no extra strand anywhere


def _dist_line(p, tip, u, n) -> float:
    v = np.asarray(p, float) - tip
    t = min(max(float(v @ u), 0.0), n)
    return float(np.hypot(*(v - t * u)))


def turns(angles: dict[str, float], seqs) -> list[str]:
    """L8: consecutive frames of the played sequences turn the lance at most PL.TURN_MAX deg (the named swaps aside)."""
    bad = []
    for seq in seqs:
        for a, b in zip(seq, seq[1:]):
            if (a, b) in PL.SWAPS or a not in angles or b not in angles:
                continue
            if abs(angles[a] - angles[b]) > PL.TURN_MAX + 1e-6:
                bad.append(f"{a}->{b} {angles[a]:.1f}->{angles[b]:.1f}")
    return bad


def review_checks(cid: str, cfg: dict, new: dict | None = None) -> dict:
    """puppet.review's report for a lance class: the body check (on the body only) plus L1-L8 per frame."""
    meta, keys = PL._keys(cid)
    fr = PL.frames_of(cid, cfg)
    pal = {tuple(int(v) for v in d) for _, d in meta["cut"]["palette"]}
    foot = int(meta["bottom_row"])
    angles = {k: HL.angle(keys[k]["line"]) for k in PU.KEYFRAMES}
    rep = {}
    for n, f in fr.items():
        r = PU.check(Image.fromarray(f["body"]), Image.fromarray(keys[f["source"]]["body"]))
        from gen.pixelize import components
        src_pieces = components(keys[f["source"]]["body"][..., 3] > 0)[1]    # the dragoon's cast has two pebbles
        r["ok"] = bool(abs(r["ring"] - r["ring_src"]) <= 0.08 and 0.88 <= r["px"] <= 1.12
                       and abs(r["height"] - r["height_src"]) <= 4 and r["pieces"] <= max(2, src_pieces))
        lc = lance_checks(np.asarray(f["img"]), f["lance"], keys[PL.PLAN[n][1]], pal, foot,
                          grips=(f["target"]["hand_n"],))
        angles[n] = f["lance"].get("angle", HL.angle(f["lance"]["line"]))
        r.update(lc)
        rows = np.nonzero((np.asarray(f["img"])[..., 3] > 0).any(1))[0]
        r["feet"] = bool(len(rows) and int(rows.max()) == foot)          # the anchor: the feet stay on the row
        lc["feet"] = r["feet"]
        r["ok"] = bool(r["ok"] and all(lc.values()))
        rep[n] = r
    bad = turns(angles, (PU.ATTACK_SEQ, PU.CAST_SEQ))
    for n in rep:
        rep[n]["L8"] = not any(n in b for b in bad)
        rep[n]["ok"] = rep[n]["ok"] and rep[n]["L8"]
    return rep

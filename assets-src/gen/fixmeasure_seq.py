"""FW-M2 sequence measures of fixmeasure.py (docs/ROSTER_FIX_PLAN_2.md 4): `switch` (the T-K continuity pre-check)
and `sweep` (the roster edge-gap sweep); fixmeasure_edges.py holds the pixel measures and the CLI."""
from __future__ import annotations

import numpy as np

from gen import anim_checks as C
from gen import fixmeasure as FM
from gen import monster_anim as MA

SWITCH_KEY = {"attack": "attack", "hurt": "hurt", "cast": "cast"}


def _shift(a: np.ndarray, d) -> np.ndarray:
    """The frame moved by d = (dx, dy) (no wrap, transparent fill)."""
    dx, dy = int(d[0]), int(d[1])
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def _cont(a, b, span, cell_h) -> dict:
    need = min(0.55, C.iou(*span) + 0.02)
    (kx, ky), (lx, ly) = C.centroid(span[0]), C.centroid(span[1])
    cap = max(6 * cell_h / 80, 0.5 * float(np.hypot(lx - kx, ly - ky)))
    (ax, ay), (bx, by) = C.centroid(a), C.centroid(b)
    i, step = C.iou(a, b), float(np.hypot(bx - ax, by - ay))
    return {"iou": i, "step": step, "need": need, "cap": cap, "ok": i >= need and step <= cap}


def switch(sprite, seq: str, rig=None) -> dict:
    """With a rig (generated frames): {pairs: [...]} as monster_check runs them. Without: the T-K pre-check."""
    s = FM._sprite(sprite, rig, True)
    if seq not in MA.SEQUENCES or MA.NEEDS.get(seq, "idle") not in s.kfs:
        raise SystemExit(f"fixmeasure switch: {s.sid} has no sequence {seq!r}")
    arrs = {k: np.asarray(v.convert("RGBA")) for k, v in s.kfs.items()}
    cell_h = arrs["idle"].shape[0]
    if s.gen:
        names, rows = MA.SEQUENCES[seq], []
        for i, (a, b) in enumerate(zip(names, names[1:])):
            if a in s.gen or b in s.gen:
                span = tuple(arrs[k] for k in MA.span_of(seq, i))
                rows.append({"pair": f"{a}->{b}", **_cont(s.img(a), s.img(b), span, cell_h)})
        return {"rig": True, "pairs": rows}
    key = SWITCH_KEY.get(seq)
    if key not in arrs:
        raise SystemExit(f"fixmeasure switch: the pre-check needs the {seq!r} key")
    idle, k = arrs["idle"], arrs[key]
    floating = bool(s.meta.get("floating"))
    base = _cont(idle, k, (idle, k), cell_h)
    ci = np.array(C.centroid(idle))
    cand = [(C.iou(idle, _shift(k, (dx, dy))), dx, dy) for dx in range(-30, 31)
            for dy in (range(-12, 13) if floating else range(-3, 4))
            if np.linalg.norm(np.array(C.centroid(_shift(k, (dx, dy)))) - ci) <= base["cap"]]
    if not cand:
        return {"rig": False, "need": base["need"], "cap": base["cap"], "d": None, "pairs": []}
    best = max(cand)
    d = np.array(best[1:])
    h = np.round(d / 2).astype(int)
    r = d - h
    srcs = {n: MA.FRAME_SOURCE.get(n, n) for n in MA.SEQUENCES[seq]}
    shifts = {n: (tuple(-(h // 2)) if n == "atk_wind1" else tuple(-h) if srcs[n] == "idle" else tuple(r))
              for n in MA.SEQUENCES[seq] if n not in MA.KEYFRAMES}
    img = lambda n: _shift(arrs[srcs[n]], shifts.get(n, (0, 0)))
    names = MA.SEQUENCES[seq]
    pairs = [{"pair": f"{a}->{b}", **_cont(img(a), img(b), (idle, k), cell_h)} for a, b in zip(names, names[1:])]
    return {"rig": False, "need": base["need"], "cap": base["cap"], "d": tuple(int(v) for v in d), "iou": best[0],
            "shifts": {n: tuple(int(v) for v in sh) for n, sh in shifts.items()}, "pairs": pairs}


def sweep(top: int = 20) -> dict:
    """Edge gaps (whole frames) over every locked rig: {inbetweens: top list, keys: [(sprite, key, gaps)], sprites}."""
    frames, keys, sprites = [], [], 0
    for lock in sorted(MA.RIGS.glob("*.lock.json")):
        sid = lock.name[:-len(".lock.json")]
        s = FM.Sprite(sid)
        hit = False
        for n, a in s.frames.items():
            g = _gaps(a)["edge_gaps"]
            if g:
                hit = True
                (keys if n in s.kfs else frames).append((g, sid, n))
        sprites += hit
    order = lambda t: (-t[0], t[1], t[2])
    return {"inbetweens": sorted(frames, key=order)[:top], "keys": sorted(keys, key=order), "sprites": sprites,
            "rigs": len(list(MA.RIGS.glob("*.lock.json")))}


def _gaps(a: np.ndarray) -> dict:
    from gen.fixmeasure_edges import edge_metrics
    return edge_metrics(a)

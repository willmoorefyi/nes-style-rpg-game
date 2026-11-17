"""Section 6 identity and quality gates (docs/KNEEL_AI_PLAN.md): group J0 (joint-free, on the cut key; A-pal / A-grey
on the block-averaged raw) and group J1 (after the hand-marked kneel joints). Each check returns (name, ok, value);
ok None = report only. Thresholds come from kneel_ai_thresholds.json (`kneel_ai.py calibrate`).
"""
from __future__ import annotations

import json

import numpy as np

from gen import anim_checks as AC
from gen import kneel_ai_cut as C
from gen import kneel_ai_data as D
from gen import kneel_checks as KC


def thresholds() -> dict:
    return json.loads(D.THRESH.read_text())["thresholds"] if D.THRESH.exists() else {}


def _ids(a: np.ndarray) -> np.ndarray:
    return a[..., :3].astype(np.int64) @ np.array([65536, 256, 1])


def hist_l1(a: np.ndarray, b: np.ndarray) -> float:
    """L1 between the colour-area histograms (shares of opaque pixels) of a and b."""
    ha, hb = {}, {}
    for arr, hist in ((a, ha), (b, hb)):
        c, n = np.unique(_ids(arr)[arr[..., 3] > 0], return_counts=True)
        hist.update(zip(c.tolist(), (n / max(n.sum(), 1)).tolist()))
    return float(sum(abs(ha.get(k, 0.0) - hb.get(k, 0.0)) for k in set(ha) | set(hb)))


def adj_pairs(a: np.ndarray) -> set:
    ids, op, out = _ids(a), a[..., 3] > 0, set()
    for p, q, m in ((ids[:, :-1], ids[:, 1:], op[:, :-1] & op[:, 1:]), (ids[:-1], ids[1:], op[:-1] & op[1:])):
        m = m & (p != q)
        out |= {(min(x, y), max(x, y)) for x, y in zip(p[m].tolist(), q[m].tolist())}
    return out


def jaccard(a: set, b: set) -> float:
    return len(a & b) / max(len(a | b), 1)


def edge_share(a: np.ndarray, ink) -> float:
    op = a[..., 3] > 0
    edge = op & ~np.logical_and.reduce([C._shift(op, dy, dx) for dy, dx in C.DIRS])
    return float(((a[..., :3] == np.array(ink, np.uint8)).all(-1) & edge).sum() / max(int(edge.sum()), 1))


def pieces(a: np.ndarray) -> tuple[int, int]:
    lab, n = AC._components(a[..., 3] > 0)
    return n, sum(1 for s in AC._sizes(lab, n) if s < AC.MIN_PIECE)


def pal_stats(raw: np.ndarray, palette: np.ndarray) -> tuple[float, float, float]:
    """(mean dE76, p95 dE76, grey share) of the raw figure's native blocks against the approved palette."""
    px = raw[raw[..., 3] > 0][:, :3]
    if not len(px):
        return 0.0, 0.0, 0.0
    lab, plab = D.rgb2lab(px), D.rgb2lab(palette)
    de = np.linalg.norm(lab[:, None] - plab[None], axis=-1)
    near = de.min(1)
    neutral = np.hypot(plab[:, 1], plab[:, 2]) < 6
    grey = np.hypot(lab[:, 1], lab[:, 2]) < 6
    far = de[:, neutral].min(1) > 10 if neutral.any() else np.ones(len(px), bool)
    return float(near.mean()), float(np.percentile(near, 95)), float((grey & far).mean())


def j0(sp: D.Sprite, key: np.ndarray, raw: np.ndarray, info: dict, T: dict | None = None,
       derived: np.ndarray | None = None, sil: np.ndarray | None = None) -> list[tuple[str, bool | None, str]]:
    T = T or thresholds()
    idle, (w, _), out = sp.idle, sp.cell, []
    ink = C.outline_rgb(idle)
    add = lambda n, ok, v: out.append((n, ok, v))                                            # noqa: E731
    add("A-alpha", not AC.binary_alpha(key), "binary" if not AC.binary_alpha(key) else AC.binary_alpha(key)[0])
    mean, p95, grey = pal_stats(raw, sp.palette)
    add("A-pal", mean <= T.get("T_pal_mean", 12) and p95 <= T.get("T_pal_p95", 25), f"mean {mean:.1f} p95 {p95:.1f}")
    add("A-grey", grey <= 0.03, f"{100 * grey:.1f} %")
    hl = hist_l1(key, idle)
    add("A-hist", hl <= T.get("T_hist", 1.0), f"L1 {hl:.3f} (<= {T.get('T_hist', 1.0):.3f})")
    jc = jaccard(adj_pairs(key), adj_pairs(idle))
    add("A-adj", jc >= T.get("T_adj", 0.0), f"J {jc:.3f} (>= {T.get('T_adj', 0.0):.3f})")
    es, ei = edge_share(key, ink), edge_share(idle, ink)
    tk, ti = C.thickness(key, ink), C.thickness(idle, ink)
    add("A-outline", es >= ei - 0.08 and tk <= ti, f"edge {es:.2f} vs {ei:.2f}; thick {tk:g} vs {ti:g}")
    (nk, sk), (ni, si) = pieces(key), pieces(idle)
    extra = 1 if sp.keep_all else 0
    add("A-pieces", nk <= ni + extra and sk <= si, f"{nk} pieces ({sk} tiny) vs {ni} ({si})")
    rows = D.base_rows(D.height(idle))
    bk, bi = D.base_cx(key[..., 3] > 0, rows, sp.floating), D.base_cx(idle[..., 3] > 0, rows, sp.floating)
    add("A-base", abs(bk - bi) <= 0.10 * w, f"dx {bk - bi:+.1f} (<= {0.10 * w:.1f})")
    ar = float((key[..., 3] > 0).sum()) / max(int((idle[..., 3] > 0).sum()), 1)
    lo, hi = sp.band
    add("A-area", T.get("T_area_lo", 0.0) <= ar <= T.get("T_area_hi", 9.0),
        f"{ar:.3f} in [{T.get('T_area_lo', 0):.3f}, {T.get('T_area_hi', 9):.3f}]; band expects {(lo + hi) / 2:.3f}")
    sh = float(info.get("shrink_pct", 0.0))
    add("A-width", sh <= 100 * C.WIDTH_MAX, f"shrink {sh:.1f} %")
    g = KC.ground(key, idle, sp.bottom, sp.floating) + KC.fit(key, sp.bottom)
    add("K-ground", not g, "; ".join(g) or "ok")
    hk, (blo, bhi) = D.height(key), sp.band_px
    add("K-height", blo <= hk <= bhi + 1, f"{hk} px in {blo}-{bhi} (+1)")
    if sil is not None:
        op = key[..., 3] > 0
        add("A-agree", None, f"{float((op & sil).sum()) / max(int(op.sum()), 1):.3f} inside G-sil")
    if derived is not None:
        add("IoU-derived", None, f"{AC.iou(key, derived):.3f}")
    return out


def verdict(rows: list[tuple[str, bool | None, str]]) -> str:
    bad = [n for n, ok, _ in rows if ok is False]
    return "PASS" if not bad else "FAIL " + ", ".join(bad)

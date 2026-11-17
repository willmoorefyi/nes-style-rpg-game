"""`kneel_ai.py calibrate [--write]` (docs/KNEEL_AI_PLAN.md 6, Calibration; offline): the J0 / J1 thresholds from the
approved idle-vs-hurt pairs, pinned in kneel_ai_thresholds.json before any paid call (they may only tighten after
KA1-P).

- Excluded from every calibration: hurts that are not approved art (FW-Q aliases chimera / black_widow, FW-H
  hollow_seraph, any keyframe-painted or offset `kf:hurt`); printed, and pinned by selftest_kneel_ai.EXCLUDED.
- T_hist / T_adj: the 95th / 5th percentile of the colour-histogram L1 / adjacency Jaccard over the remaining
  monster idle-vs-hurt and hero ready-vs-hurt pairs that share a palette (colour-set Jaccard >= 0.5; a per-pose
  palette, as on the boss poses and hero cells, measures the palette split, not the pose; listed as `palette_split`).
- T_area_lo / T_area_hi: the 1st / 99th percentile of hurt area / idle area; the low end x the lowest band lo (0.55, a
  kneel is lower than a hurt), the high end unscaled (a band hi < 1 would narrow it: a lying quadruped is wider).
- T_prop_* / T_head_*: the 5th percentile IoU and 95th percentile outside ratio of the J1 measures on the approved
  hurt keys, posed by their marked hurt joints.
- T_dup_match: the lowest template score in DUP_TAUS at which <= 5 % of the approved hurt parts (heroes: the attack
  weapon on the hurt) show more template peaks than their idle (kneel_ai_j1.peaks).
- T_pal_mean / T_pal_p95: over the 72 cells of the 12 hero raws (cache/<battle.json cache_key>.png, each cell
  block-averaged to the native grid, the magenta fringe left out) against their approved battle.png palette: the
  largest cell mean dE76, and the 95th percentile of the cells' p95 (one cell, white_wizard's hurt, reaches 96).
"""
from __future__ import annotations

import json
import time

import numpy as np
from PIL import Image

from gen import kneel_ai_cut as C
from gen import kneel_ai_data as D
from gen import kneel_ai_gates as GT
from gen import kneel_ai_j1 as J1

BAND_LO_MIN = 0.55
DUP_TAUS = (0.5, 0.6, 0.7, 0.8, 0.9)   # T_dup_match: the lowest with <= 5 % of the hurt parts showing an extra copy
SHARED = 0.5                   # colour-set Jaccard below this = a per-pose palette (bosses, hero cells): no T_hist / T_adj


def hero_pal(sid: str) -> list[tuple[float, float]]:
    """Per cell of the hero raw (3x2 sheet, each cell block-averaged to 80x80): (mean, p95) dE76 of its figure blocks."""
    from gen import puppet as PU
    meta = json.loads((D.APPROVED / sid / "battle.json").read_text())
    raw = np.asarray(Image.open(D.HERE / "cache" / f"{meta['cache_key']}.png").convert("RGB"))
    frames = PU.battle_sheet_frames(sid)
    pal = np.array(sorted({tuple(int(v) for v in c[:3]) for im in frames.values()
                           for c in np.asarray(im.convert("RGBA")).reshape(-1, 4) if c[3] > 0} | {PU.OUTLINE}), np.uint8)
    cols, rows = meta["layout"]
    H, W = raw.shape[:2]
    blocks = []
    for r in range(rows):
        for c in range(cols):
            cell = raw[r * H // rows:(r + 1) * H // rows, c * W // cols:(c + 1) * W // cols]
            cell = np.ascontiguousarray(cell)
            blocks.append(C.block_raw(cell, C.figure_mask(cell), tuple(meta["grid"]), True))
    return [GT.pal_stats(b, pal)[:2] for b in blocks]


def measure() -> dict:
    excluded, pairs, j1 = {}, [], {"prop_iou": [], "prop_out": [], "head_iou": [], "head_out": [], "dup": []}
    for sid in D.monsters() + D.heroes():
        sp = D.load(sid)
        why = sp.excluded
        if why:
            excluded[sid] = why
            continue
        if "hurt" not in sp.keys:
            continue
        hurt = sp.keys["hurt"]
        cols = [set((a[..., :3].astype(np.int64) @ np.array([65536, 256, 1]))[a[..., 3] > 0].tolist())
                for a in (hurt, sp.idle)]
        pairs.append((sid, GT.hist_l1(hurt, sp.idle), GT.jaccard(GT.adj_pairs(hurt), GT.adj_pairs(sp.idle)),
                      float((hurt[..., 3] > 0).sum()) / max(int((sp.idle[..., 3] > 0).sum()), 1),
                      GT.jaccard(*cols)))
        if sp.hero:
            m, a = J1.attack_mask(sp)
            if m is not None:
                j1["dup"].append((sid, "weapon@attack", J1.peaks(a, m, hurt), J1.peaks(a, m, sp.idle)))
            continue
        if "hurt" not in sp.rig.keyframes:
            continue
        weapons, heads, _ = J1.lists(sp)
        for group, names in (("prop", weapons), ("head", heads)):
            for n in names:
                if ":" not in n and not sp.rig.present(n, "hurt"):
                    continue
                s = J1.score(sp, sp.rig, n, hurt, "hurt")
                if s is not None:
                    j1[f"{group}_iou"].append((sid, n, s[0]))
                    j1[f"{group}_out"].append((sid, n, s[1]))
                    j1["dup"].append((sid, n, s[2], s[3]))
    return {"excluded": excluded, "pairs": pairs, "j1": j1,
            "pal": {sid: hero_pal(sid) for sid in D.heroes()}}


def thresholds(m: dict) -> dict:
    p = lambda vals, q: float(np.percentile(vals, q)) if len(vals) else float("nan")      # noqa: E731
    shared = [x for x in m["pairs"] if x[4] >= SHARED]
    hl, jc = [x[1] for x in shared], [x[2] for x in shared]
    ar = [x[3] for x in m["pairs"]]
    j = {k: [v[2] for v in vs] for k, vs in m["j1"].items() if k != "dup"}
    dup = m["j1"]["dup"]
    tau = next((t for t in DUP_TAUS if sum(J1.extra(k, i, t) > 0 for _, _, k, i in dup) <= 0.05 * len(dup)), 1.0)
    return {"T_hist": round(p(hl, 95), 4), "T_adj": round(p(jc, 5), 4),
            "T_area_lo": round(p(ar, 1) * BAND_LO_MIN, 4), "T_area_hi": round(p(ar, 99), 4),
            "T_prop_iou": round(p(j["prop_iou"], 5), 4), "T_prop_outside": round(p(j["prop_out"], 95), 4),
            "T_head_iou": round(p(j["head_iou"], 5), 4), "T_head_outside": round(p(j["head_out"], 95), 4),
            "T_dup_match": tau,
            "T_pal_mean": round(max(c[0] for v in m["pal"].values() for c in v), 2),
            "T_pal_p95": round(p([c[1] for v in m["pal"].values() for c in v], 95), 2)}


def calibrate(write: bool) -> int:
    m = measure()
    T = thresholds(m)
    print(f"excluded ({len(m['excluded'])}): " + ", ".join(f"{s} ({w})" for s, w in sorted(m["excluded"].items())))
    split = sorted(x[0] for x in m["pairs"] if x[4] < SHARED)
    print(f"palette_split ({len(split)}, no T_hist / T_adj): {' '.join(split)}")
    print(f"pairs {len(m['pairs'])} (idle vs hurt; heroes ready vs hurt); J1 parts: "
          + ", ".join(f"{k} {len(v)}" for k, v in m["j1"].items()))
    for k, v in T.items():
        print(f"  {k} = {v}")
    if write:
        D.THRESH.write_text(json.dumps({"thresholds": T, "excluded": m["excluded"], "palette_split": split,
                                        "date": time.strftime("%Y-%m-%d"),
                                        "counts": {"pairs": len(m["pairs"]), **{k: len(v) for k, v in m["j1"].items()}},
                                        "source": "kneel_ai.py calibrate (docs/KNEEL_AI_PLAN.md 6)"}, indent=1) + "\n")
        print(f"wrote {D.THRESH.name}")
    return 0

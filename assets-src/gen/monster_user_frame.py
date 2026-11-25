"""EF-H amendment A (docs/ENEMY_FEEDBACK_PLAN.md): the frame a user-rendered sheet is cut into, and the tier report.

A `size: large` user sheet whose idle is above the large band (> 120 rows) or whose tallest pose is over the 121 rows a
large cell gives the figure is cut in the TALL frame: cell height 200, feet row 192 (the per-pose boss cell,
spec.BOSS_POSE_GEOM), figure band 96-184 for monster_user.scale, never narrower than the large cell (MIN_W 128). The
data size stays (monsters.yaml `large`, the sheet `monster_large`, enemies.yaml untouched); the approved jsons record
`frame: tall`. The frame is kept out of spec.MONSTER_BANDS (the Gemini request table).

A tall sheet takes the size-scaled tolerances of its 200-row cell (the per-pose boss tier, D-A2). `tiers` makes that
visible: every continuity step and silhouette check of the rigged sheet, as monster_check.check_sprite runs them,
recomputed at the large tier (cell_h 128); the steps and frames that pass at the cell but not at 128 are listed.

  python3 -I assets-src/gen/monster_user_frame.py tiers <id>     # ~/temp/ff-game/ef/user/<id>/tier_report.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from gen import spec as S

LARGE = S.MONSTER_BANDS["large"]
TALL = S.MonsterBand("tall", 200, (96, 184), 192)
MIN_W = LARGE.cell                     # a tall cell is never narrower than a large one
LARGE_TIER_H = LARGE.cell              # the cell height whose tolerances the report compares against


def frame_of(size: str, heights: list[int]) -> tuple[str, S.MonsterBand]:
    """(frame name, band) for a user sheet of data `size` with these native (split) heights, idle first."""
    if size != "large":
        return size, S.MONSTER_BANDS[size]
    if heights[0] > LARGE.height[1] or max(heights) > LARGE.foot_row - 1:
        return "tall", TALL
    return "large", LARGE


def band_of(name: str) -> S.MonsterBand:
    return TALL if name == "tall" else S.MONSTER_BANDS[name]


def anchors(figs: list[np.ndarray], foot, modes: dict | None = None) -> list[float]:
    """Each pose's anchor x: its feet (`foot`, the bottom rows' mean x), or with a recipe's `anchor: {<pose>: bbox}`
    its opaque box centre moved by the idle's own feet-to-centre offset (a kneel whose lowest rows are a draped tail,
    fire_lizard: its body keeps the idle's place instead of putting the tail tip under the idle's feet)."""
    def centre(a):
        xs = np.where((a[..., 3] > 0).any(0))[0]
        return (xs.min() + xs.max()) / 2
    names = list(modes or {}) or [None] * len(figs)
    bad = {m for m in (modes or {}).values() if m not in (None, "feet", "bbox")}
    if bad or (modes or {}).get(names[0]) == "bbox":
        raise SystemExit(f"recipe anchor: unknown mode {sorted(map(str, bad))} or a bbox idle (the idle is the reference)")
    out = [foot(f) for f in figs]
    off = out[0] - centre(figs[0])
    return [float(centre(f) + off) if (modes or {}).get(n) == "bbox" else x for f, x, n in zip(figs, out, names)]


def compare_step(prev: np.ndarray, nxt: np.ndarray, span: tuple, cell_h: int, share: float, margin: float) -> dict:
    """One continuity step at the sheet's cell height and at the large tier."""
    from gen import anim_checks as C
    return {"cell": C.continuity(prev, nxt, span, cell_h, share, margin),
            "large": C.continuity(prev, nxt, span, LARGE_TIER_H, share, margin)}


def tier_report(sid: str) -> dict:
    """Every sequence step and generated frame's silhouette check of a rigged sheet at its cell and at 128."""
    from gen import kneel_checks as KC
    from gen import monster_anim as MA
    from gen import monster_check as MC
    entry = next((e for e in MA.load_entries() if e[0] == sid), None)
    cfg = MA.load_rig(sid)
    if entry is None or not cfg:
        raise SystemExit(f"{sid}: no approved sheet or no rig")
    _, meta, kfs = entry
    gen = MA.generate(sid, cfg, kfs, meta)
    arrs = {k: np.asarray(v.convert("RGBA")) for k, v in kfs.items()}
    imgs = {**arrs, **{n: f["img"] for n, f in gen.items()}}
    cell_h = arrs["idle"].shape[0]
    steps, frames = [], []
    for seq, names in MA.SEQUENCES.items():
        if MA.NEEDS.get(seq, "idle") not in arrs:
            continue
        for i, (a, b) in enumerate(zip(names, names[1:])):
            if a in gen or b in gen:
                span = tuple(arrs[k] for k in MA.span_of(seq, i))
                margin = MC.ATTACK_SWAP_IOU.get(sid, 0.02) if seq == "attack" else 0.02
                r = compare_step(imgs[MA.resolve(a, imgs)], imgs[MA.resolve(b, imgs)], span, cell_h,
                                 KC.continuity_share(seq, a, b, gen, sid), margin)
                steps.append({"seq": seq, "step": f"{a}->{b}", **r})
    for n, f in gen.items():
        if f.get("orbit") or f.get("bridge") or f.get("labels") is None:
            continue
        S_, T_ = arrs[f["src"]], gen[f["toward"]]["img"] if f["toward"] in gen else arrs[f["toward"]]
        frames.append({"frame": n, "cell": MC._silhouette(f, f["img"], S_, T_, cell_h, True),
                       "large": MC._silhouette(f, f["img"], S_, T_, LARGE_TIER_H, True)})
    flagged = [s["step"] for s in steps if not s["cell"] and s["large"]] + \
              [f["frame"] for f in frames if not f["cell"] and f["large"]]
    return {"sprite": sid, "cell_h": cell_h, "large_tier_h": LARGE_TIER_H, "steps": steps, "silhouette": frames,
            "flagged": flagged}


def main(argv: list[str] | None = None) -> int:
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["tiers"])
    ap.add_argument("id")
    a = ap.parse_args(argv)
    rep = tier_report(a.id)
    out = Path.home() / "temp" / "ff-game" / "ef" / "user" / a.id / "tier_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rep, indent=2) + "\n")
    print(f"{a.id}: cell {rep['cell_h']}, {len(rep['steps'])} steps, {len(rep['silhouette'])} silhouette frames; "
          f"pass at the cell but not at {LARGE_TIER_H}: {rep['flagged'] or 'none'}\n{out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

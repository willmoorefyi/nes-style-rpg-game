"""F2 "Chaos, the Orrery": offline finish of the composed render's cut (0 Bedrock calls; docs/ROSTER_LOG.md C3).

  python3 -I assets-src/gen/colossus/chaos_orrery_finish.py CUT OUTDIR

CUT is the remove_bg result of `o12_metal_raw.png` (chaos_orrery_compose.py). At render resolution (1320x900):
  1. the eclipse: inside the head disc (r < DISC_R - 7 around DISC) the lit orb becomes a dark disc, keeping only a
     tiny star point at its centre (r < STAR_R) and the bright rim, so the head reads as F3's eclipse;
  2. the two pedestal slabs under the gauntlets (cut-out debris) are cleared outside an ellipse around each gauntlet;
  3. cold blue steel glints on the armour (outside the planets) are warmed to grey-gold;
then CL.pix to the 440x300 canvas (about 3 render px per art px) and the palette-safe despeck of F3's finish.
Writes OUTDIR/finish.png, master.png and master.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from gen import colossus_layers as CL  # noqa: E402
import chaos_horizon_finish as HF  # noqa: E402

DISC, DISC_R, STAR_R = (660, 235), 64, 5
DARK = np.array([22, 20, 27], float)
SLABS = [(120, 752, 450, 900), (875, 752, 1205, 900)]
GAUNTLETS = [((245, 805), 72, 105), ((1000, 805), 78, 105)]
PLANETS = [((1222, 402), 52), ((172, 652), 52), ((812, 680), 52), ((558, 798), 52)]


def finish(cut: np.ndarray) -> np.ndarray:
    a = cut.astype(float).copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    r = np.hypot(xx - DISC[0], yy - DISC[1])
    inner = (r < DISC_R - 7) & (r >= STAR_R)
    edge = np.clip((DISC_R - 7 - r) / 6, 0, 1)                 # a 6 px blend into the rim
    a[inner, :3] = a[inner, :3] * (1 - edge[inner, None]) + DARK * edge[inner, None]
    for (x0, y0, x1, y1), ((gx, gy), rx, ry) in zip(SLABS, GAUNTLETS):
        box = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
        keep = ((xx - gx) / rx) ** 2 + ((yy - gy) / ry) ** 2 <= 1
        a[box & ~keep, 3] = 0
    planet = np.zeros((h, w), bool)
    for (px, py), pr in PLANETS:
        planet |= np.hypot(xx - px, yy - py) <= pr
    rr, gg, bb = a[..., 0], a[..., 1], a[..., 2]
    cold = (bb > rr + 18) & (bb >= gg - 8) & ~planet & (a[..., 3] > 0)
    lum = (a[..., :3] @ np.array([0.299, 0.587, 0.114]))[cold]
    a[cold, :3] = lum[:, None] * np.array([1.0, 0.94, 0.84])
    return np.clip(a, 0, 255).astype(np.uint8)


def main(argv: list[str]) -> int:
    cut_p, outdir = Path(argv[0]), Path(argv[1])
    outdir.mkdir(parents=True, exist_ok=True)
    fin = finish(np.asarray(Image.open(cut_p).convert("RGBA")))
    Image.fromarray(fin, "RGBA").save(outdir / "finish.png")
    master = HF.despeck(CL.pix(Image.fromarray(fin, "RGBA"), (440, 300), 20, seed=0))
    master.save(outdir / "master.png")
    probs = CL.palette_problems(master)
    (outdir / "master.json").write_text(json.dumps({"cut": str(cut_p), "palette_problems": probs}, indent=2) + "\n")
    print(f"wrote {outdir / 'master.png'} {master.size}; palette {probs or 'OK'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

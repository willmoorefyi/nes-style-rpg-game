"""F2 "Chaos, the Orrery": offline finish of the composed render's cut (0 Bedrock calls; docs/ROSTER_LOG.md C3).

  python3 -I assets-src/gen/colossus/chaos_orrery_finish.py CUT OUTDIR

CUT is the remove_bg result of `o12_metal_raw.png` (chaos_orrery_compose.py). At render resolution (1320x900):
  1. the eclipse: inside the head disc (r < DISC_R - 4 around DISC) the lit orb becomes a dark disc (no centre dot,
     which read as a pupil), and the rim is lifted toward F3's white-gold, so the head reads as F3's eclipse;
     the storm-white planet is repainted larger (STORM) with cloud bands and a dark outline;
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

DISC, DISC_R, STAR_R = (660, 235), 64, 0
RIM_W = 0.0                              # C3' (painted): the render's own rim; the white-gold lift made a double ring at full res
STORM = ((558, 795), 60)                 # the storm planet's old spot (filled)
STORM_AT = (338, 382)                    # its new place, on the upper-left ring
_UNUSED = 0                 # the storm-white planet, enlarged and banded in place
DARK = np.array([22, 20, 27], float)
SLABS = [(120, 757, 450, 900), (875, 757, 1205, 900)]   # C3': cleared only below render row 757, which at place y +25
                                         # is behind the bottom strip (the old cut at 752 sliced the forearms on screen)
GAUNTLETS = [((245, 790), 70, 40), ((1000, 790), 76, 40)]
PLANETS = [((1222, 402), 46), ((172, 652), 52), ((812, 680), 52), ((338, 382), 52)]


def finish(cut: np.ndarray) -> np.ndarray:
    a = cut.astype(float).copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    r = np.hypot(xx - DISC[0], yy - DISC[1])
    inner = (r < DISC_R - 4) & (r >= STAR_R)
    edge = np.clip((DISC_R - 4 - r) / 5, 0, 1)                 # a 5 px blend into the rim (no dot, no ridge)
    a[inner, :3] = a[inner, :3] * (1 - edge[inner, None]) + DARK * edge[inner, None]
    rim = (r >= DISC_R - 4) & (r < DISC_R + 5) & (a[..., 3] > 0)  # the rim toward F3's white-gold
    a[rim, :3] = a[rim, :3] * (1 - RIM_W) + np.array([245, 232, 190]) * RIM_W
    # a faint radial gradient in the disc (a flat black read as a hole)
    a[inner, :3] += (np.array([14, 12, 17.0]) * np.clip(1 - r / (DISC_R - 4), 0, 1)[..., None])[inner]
    # the star's top point left a gold sliver on the rim: take the colour of the rim beside it
    sliver = (np.abs(xx - DISC[0]) < 10) & (yy < DISC[1]) & (r > DISC_R - 8) & (r < DISC_R + 34) \
        & (a[..., 0] > 170) & (a[..., 2] < 130)
    for y, x in zip(*np.where(sliver)):
        a[y, x, :3] = (a[y, x - 14, :3] + a[y, x + 14, :3]) / 2
    # the storm-white planet: its old spot (on the belt, under the strip) is filled from the mirrored armour, and it
    # is repainted glossy from the cyan planet's own shading and set on the upper-left ring (STORM_AT)
    (ox, oy), orad = STORM
    old = np.hypot(xx - ox, yy - oy) <= orad + 4
    mx = np.clip(2 * DISC[0] - xx, 0, w - 1)
    a[old] = a[yy[old], mx[old]]
    (tx, ty), tr = PLANETS[0]
    tpl = a[ty - tr:ty + tr, tx - tr:tx + tr].copy()
    py, px = np.mgrid[-tr:tr, -tr:tr]
    inside = np.hypot(px, py) <= tr - 2
    lum = (tpl[..., :3] @ np.array([0.299, 0.587, 0.114])) / 255
    band = 1 + 0.10 * np.sin(py * 0.42 + 0.8 * np.sin(px * 0.11))
    col = (np.array([92, 96, 128.0]) * (1 - lum[..., None]) + np.array([240, 242, 252.0]) * lum[..., None]) * band[..., None]
    (sx, sy) = STORM_AT
    dst = a[sy - tr:sy + tr, sx - tr:sx + tr]
    dst[inside, :3] = np.clip(col[inside], 0, 255)
    dst[inside, 3] = np.maximum(dst[inside, 3], tpl[inside, 3])
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

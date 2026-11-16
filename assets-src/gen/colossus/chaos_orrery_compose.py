"""F2 "Chaos, the Orrery": offline compose of the two structure renders (0 Bedrock calls; docs/ROSTER_LOG.md C3).

  python3 -I assets-src/gen/colossus/chaos_orrery_compose.py O1 O2 OUT

O1 (`control_st_5201_raw.png`) has the better head: an eclipse with one star point and a flame crown. O2
(`control_st_5202_raw.png`) has four planets, but its head carries a cross visor seam that reads as a helmet (3.5). Both
come from the same control image, so their heads line up within ~5 px. OUT = O2 with O1's head pasted in (a circle of
r HEAD_R around HEAD, above the shoulders, feathered over 14 px), and the four planets recoloured to the four Fiends'
lights (frost cyan, ember orange, deep teal, storm white) by hue, keeping each planet's own shading, and the orange ribbon rings recoloured
into black-iron bands with gold highlights (`metal_rings`).
"""
from __future__ import annotations

import colorsys
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HEAD, HEAD_R, FEATHER, SHOULDER_Y = (660, 205), 205, 14, 292
# planet centres in O2 (render px), radius, target (hue, saturation scale, value floor)
PLANETS = [((1222, 402), 46, (0.52, 0.85, 0.0)),    # frost cyan
           ((172, 652), 46, (0.07, 1.0, 0.0)),      # ember orange (kept)
           ((812, 680), 46, (0.47, 0.9, 0.0)),      # deep teal (darkened below)
           ((558, 798), 46, (0.0, 0.08, 0.25))]     # storm white


def compose(o1: np.ndarray, o2: np.ndarray) -> np.ndarray:
    out = o2.astype(float).copy()
    h, w = o2.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    r = np.hypot(xx - HEAD[0], yy - HEAD[1])
    wgt = np.clip((HEAD_R - r) / FEATHER, 0, 1) * np.clip((SHOULDER_Y - yy) / FEATHER, 0, 1)
    out[..., :3] = out[..., :3] * (1 - wgt[..., None]) + o1[..., :3] * wgt[..., None]
    for (cx, cy), rad, (hue, sat, vfloor) in PLANETS:
        y0, y1, x0, x1 = cy - rad, cy + rad, cx - rad, cx + rad
        patch = out[y0:y1, x0:x1, :3] / 255.0
        py, px = np.mgrid[y0:y1, x0:x1]
        inside = np.hypot(px - cx, py - cy) <= rad
        for j, i in zip(*np.where(inside)):
            rr, gg, bb = patch[j, i]
            hh, ss, vv = colorsys.rgb_to_hsv(rr, gg, bb)
            if ss < 0.25 and vv < 0.35:                # not the planet (dark armour or smoke behind it)
                continue
            vv2 = max(vfloor, vv * (0.62 if hue == 0.47 else 1.0))
            patch[j, i] = colorsys.hsv_to_rgb(hue, min(1.0, ss * sat), vv2)
        out[y0:y1, x0:x1, :3] = patch * 255
    return np.clip(out, 0, 255).astype(np.uint8)


RING_KEEP = [((660, 205), 200), ((1222, 402), 50), ((172, 652), 50), ((812, 680), 50), ((558, 798), 50)]
CHEST_FLAME = (515, 430, 805, 525)               # the breastplate's own ember flames stay


def metal_rings(rgb: np.ndarray) -> np.ndarray:
    """The rings came out as glowing orange ribbons (search_replace C15 on them rebuilt the whole figure): recolour the
    ribbon pixels into black-iron bands with gold highlights by value (dark iron core, gold where brightest)."""
    a = rgb.astype(float) / 255.0
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hue_orange = (r >= g) & (g >= b) & (r > 0.45) & ((g - b) > 0.12 * r)
    ribbon = hue_orange & (sat > 0.45) & (mx > 0.45)
    h, w = ribbon.shape
    yy, xx = np.mgrid[:h, :w]
    for (cx, cy), rad in RING_KEEP:
        ribbon &= np.hypot(xx - cx, yy - cy) > rad
    x0, y0, x1, y1 = CHEST_FLAME
    ribbon &= ~((xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1))
    v = mx[ribbon]
    t = np.clip((v - 0.45) / 0.55, 0, 1) ** 2.2        # most of the band dark iron, its brightest line gold
    iron, gold = np.array([0.13, 0.12, 0.14]), np.array([0.87, 0.65, 0.32])
    out = a.copy()
    out[ribbon] = iron * (1 - t[:, None]) + gold * t[:, None]
    return np.clip(out * 255, 0, 255).astype(np.uint8)


def main(argv: list[str]) -> int:
    o1 = np.asarray(Image.open(argv[0]).convert("RGB"))
    o2 = np.asarray(Image.open(argv[1]).convert("RGB"))
    Image.fromarray(metal_rings(compose(o1, o2))).save(argv[2])
    print(f"wrote {argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

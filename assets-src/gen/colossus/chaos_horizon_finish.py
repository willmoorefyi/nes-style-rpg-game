"""F3 "Chaos, the Last Horizon": offline finish of the approved base render (user ruling 2026-11-16, docs/ROSTER_LOG.md
"C3"). 0 Bedrock calls.

  python3 -I assets-src/gen/colossus/chaos_horizon_finish.py RAW CUT OUTDIR [--variant RAW2]

RAW is the face-removed structure render `s2_st_4102_sr_4201_raw.png` (1800x720) and CUT its remove_bg result. Steps,
all at render resolution before the pixel pass:
  1. alpha = CUT >= 128; the eclipse disc and its white-hot rim (r <= DISC_R + 8 around DISC) are forced opaque, and
     the corona fragments remove_bg kept above the shoulders (DISC_R + 8 < r < 230, y < 305) are cleared, and so are
     bright corona pixels beside the disc (lum > 110 within r < 230, y < its centre + 5): a clean, notch-free edge; specks < 0.2 % of the body are dropped by `pix`;
  2. darks lifted: a levels stretch of the stone (2..99.5 %, gamma GAMMA, red x 0.92), the disc kept black;
  3. rim light from the upper left: opaque pixels with sky within 3 px above / above-left blend 45 % toward gold, with
     sky within 2 px below 22 % toward ember (separates the arms from the sky);
  4. the base of the torso is made solid below y 690 and its colours below MIST_Y mirror the rows above it (the render's
     pale floor mist), behind the bottom strip in play;
  5. `colossus.py pix`-equivalent: CL.pix on a 902x362 canvas (exactly 2 render px per art px), cropped to 900x362;
  6. the corona glow layer: the raw's sky within 440 render px of the disc and above
     its centre + 30, outside the alpha, in 4 stepped levels
     (GLOW_LEVELS / GLOW_COLOURS: ember, ember, gold, white), at the same art grid, for additive blending.
Writes OUTDIR/finish.png (render res RGBA), master.png (900x362), glow.png (900x362) and finish.json. With --variant,
RAW2 (an edit of RAW that keeps everything else identical, e.g. F4's open core) is finished with the same alpha,
levels and grid: variant.png plus variant_mask.png (the art px that differ from master.png).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from gen import colossus_layers as CL  # noqa: E402

DISC, DISC_R = (898, 340), 92
GAMMA = 0.72                     # the darks lift (the stone stays off pure black)
MIST_Y = 660                     # render rows below this carry the render's pale floor mist
GOLD, EMBER = np.array(CL.BASE_PALETTE["gold"], float), np.array(CL.BASE_PALETTE["ember"], float)


def _shift(m: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = m[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def alpha_of(cut: np.ndarray) -> np.ndarray:
    a = cut[..., 3] >= 128
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    r = np.hypot(xx - DISC[0], yy - DISC[1])
    a[r <= DISC_R + 8] = True
    a[(r > DISC_R + 8) & (r < 230) & (yy < 305)] = False
    return a


def clear_corona(a: np.ndarray, raw: np.ndarray) -> np.ndarray:
    """Bright corona pixels remove_bg kept beside the disc (the notch on its right) go to the glow layer."""
    lum = raw[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    r = np.hypot(xx - DISC[0], yy - DISC[1])
    a = a.copy()
    a[(r > DISC_R + 8) & (r < 230) & (yy < DISC[1] + 5) & (lum > 110)] = False
    cols = a[680]
    a[690:, :] |= cols[None, :]
    return a


def finish_rgb(raw: np.ndarray, a: np.ndarray, levels: tuple[float, float] | None = None):
    rgb = raw[..., :3].astype(float)
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    disc = np.hypot(xx - DISC[0], yy - DISC[1]) <= DISC_R - 2
    stone = a & ~disc
    lo, hi = levels or (float(np.percentile(rgb[stone], 2)), float(np.percentile(rgb[stone], 99.5)))
    out = np.clip((rgb - lo) / (hi - lo), 0, 1) ** GAMMA * 255
    out[..., 0] *= 0.92
    out[disc] = rgb[disc]
    n = out.shape[0] - MIST_Y                           # the floor mist at the base: the stone mirrors down instead
    out[MIST_Y:] = out[MIST_Y - 1 - np.arange(n)]
    sky = ~a
    up = np.zeros_like(a)
    for d in range(1, 4):
        up |= _shift(sky, d, 0) | _shift(sky, d, d)
    down = _shift(sky, -1, 0) | _shift(sky, -2, 0)
    up &= stone
    down &= stone & ~up
    out[up] = out[up] * 0.55 + GOLD * 0.45
    out[down] = out[down] * 0.78 + EMBER * 0.22
    return np.clip(out, 0, 255).astype(np.uint8), (lo, hi)


def pix_grid(rgba: np.ndarray) -> Image.Image:
    im = CL.pix(Image.fromarray(rgba, "RGBA"), (902, 362), 24, seed=0)
    return im.crop((1, 0, 901, 362))


def glow_of(raw: np.ndarray, a: np.ndarray) -> Image.Image:
    rgb = raw[..., :3].astype(float)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    region = (~a) & (np.hypot(xx - DISC[0], yy - DISC[1]) < 440) & (yy < DISC[1] + 30)   # the corona, not the sky under the arms
    pad = np.pad(np.where(region, lum, 0), ((4, 0), (0, 0)))           # render row y -> art row (y + 4) / 2
    lum_a = np.asarray(Image.fromarray(pad.astype(np.uint8)).resize((900, 362), Image.Resampling.BOX)).astype(float)
    g = np.zeros((362, 900, 4), np.uint8)
    for thr, lvl, col in zip((55, 95, 150, 205), CL.GLOW_LEVELS, CL.GLOW_COLOURS):
        g[lum_a >= thr] = (*CL.BASE_PALETTE[col], lvl)
    return Image.fromarray(g, "RGBA")


def main(argv: list[str]) -> int:
    raw_p, cut_p, outdir = Path(argv[0]), Path(argv[1]), Path(argv[2])
    outdir.mkdir(parents=True, exist_ok=True)
    raw = np.asarray(Image.open(raw_p).convert("RGBA"))
    a = clear_corona(alpha_of(np.asarray(Image.open(cut_p).convert("RGBA"))), raw)
    rgb, lv = finish_rgb(raw, a)
    rgba = np.dstack([rgb, np.where(a, 255, 0).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(outdir / "finish.png")
    master = pix_grid(rgba)
    master.save(outdir / "master.png")
    glow = glow_of(raw, a)
    glow.save(outdir / "glow.png")
    info = {"raw": str(raw_p), "cut": str(cut_p), "disc": DISC, "disc_r": DISC_R, "levels": lv,
            "grid": "902x362 -> crop (1, 0, 901, 362); art = render / 2 (+2 rows: the cut top 240 lands on art row 122)", "size": master.size,
            "palette_problems": CL.palette_problems(master)}
    if "--variant" in argv:
        v_p = Path(argv[argv.index("--variant") + 1])
        v_rgb, _ = finish_rgb(np.asarray(Image.open(v_p).convert("RGBA")), a, lv)
        v = pix_grid(np.dstack([v_rgb, rgba[..., 3]]))
        v.save(outdir / "variant.png")
        diff = (np.asarray(v) != np.asarray(master)).any(-1)
        Image.fromarray((diff * 255).astype(np.uint8)).save(outdir / "variant_mask.png")
        ys, xs = np.where(diff)
        info["variant"] = {"raw": str(v_p), "changed_px": int(diff.sum()),
                           "box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if diff.any() else None,
                           "palette_problems": CL.palette_problems(v)}
    (outdir / "finish.json").write_text(json.dumps(info, indent=2) + "\n")
    print(json.dumps(info))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

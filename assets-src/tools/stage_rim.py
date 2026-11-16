"""The rim arena backdrop (docs/CHAOS_FORMS_PLAN.md 7.2; FW-C): staging, the floor-front cut and the `rim` check profile.
stage_backgrounds.py hands every command naming `rim` to this module (its 1-line hook, R16).

  python3 -I assets-src/tools/stage_backgrounds.py rim [--src DIR]          # DIR default assets-src/backgrounds
  python3 -I assets-src/tools/stage_backgrounds.py --check rim [--image FILE]

Why not stage_backgrounds.stage(): the source is 1344x768, not 1536x1024 (`src_size` is read from the image), the
user-accepted render (/tmp/stab2/sd35_v3_bg.webp, D-U7) was upscaled nearest (scale 1.5) and leaves the screen bottom
uncovered below y 794 (behind the bottom strip). `pad_bottom` mirrors the floor upwards from its last row into that
gap, exactly like the accepted render (so the staged rim.webp is byte-identical to it). Outputs in assets/backgrounds/:
  rim.webp        1920x1080, lossy quality 90 (the accepted encoding)
  rim_floor.webp  1944x1080 lossless RGBA: the floor below the horizon row with a hard edge on it (alpha 0 above),
                  12 px of bleed each side (from the same wide stage), pixel-exact with the decoded rim.webp below
                  the horizon: ColossusView's floorFront (4.1), drawn over the colossus so it stands behind the horizon
--check rim (CHECKS_RIM): field coverage 100 % (no constant-colour row in 0..1080), the boss contrast edge_delta of
the dark F1 composite (chaos's atlas idle at its titan placement, /tmp/stab2/scripts/stage_mock.py) >= 100, the party
band's luma contrast >= 0.8 x the field's, the enemy band's seam <= 30 (the sky's rift, D-O6).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stage_backgrounds as SB  # noqa: E402

ROOT = SB.ROOT
SRC_DIR = ROOT / "assets-src" / "backgrounds"
# (source file, horizon row in the source, zoom, align, screen horizon y): the user-accepted values (D-U7)
RIM = ("rim-src.png", 485, 1.05, "center", 370)
BLEED = 12
FIELD_BAND = (0, SB.FIELD_TOP, 1920, 780)
CHECKS_RIM = {"coverage": 1.0, "edge_delta": 100.0, "party_contrast": 0.8, "seam": 30.0}
TITAN = (80, 140, 1340, 745)     # EnemyLayoutAi TITAN_AREA x0 y0 x1 y1 (F1's placement)


def _pad_bottom(a: np.ndarray, bottom: int) -> np.ndarray:
    """Rows from `bottom` down mirror the rows above it (row bottom + i = row bottom - 1 - i)."""
    n = a.shape[0] - bottom
    if n <= 0:
        return a
    if n > bottom:
        raise SystemExit(f"rim: {n} uncovered rows cannot be mirrored from {bottom} covered ones")
    a = a.copy()
    a[bottom:] = a[bottom - 1 - np.arange(n)]
    return a


def stage(src: Path, horizon: int, zoom: float, align: str, horizon_y: int, bleed: int = BLEED):
    """(screen 1920x1080 RGB, wide (1920 + 2 bleed)x1080 RGB, info). Nearest upscale (scale >= 1), horizon row
    `horizon` of the source at screen y `horizon_y`, pad_bottom below the source."""
    im = Image.open(src).convert("RGB")
    scale = SB.SCREEN[0] / im.width * zoom
    rs = Image.Resampling.NEAREST if scale >= 1 else Image.Resampling.LANCZOS
    big = im.resize((round(im.width * scale), round(im.height * scale)), rs)
    extra = big.width - SB.SCREEN[0]
    left = {"left": 0, "center": round(extra * 0.5), "right": extra}[align]
    top = round(horizon_y - horizon * scale)
    if top > 0:
        raise SystemExit(f"{src.name}: horizon {horizon} would leave the screen uncovered above y {top}")
    if left < bleed or extra - left < bleed:
        raise SystemExit(f"{src.name}: {extra} px of width beyond the screen leaves no {bleed} px bleed each side")
    bottom = top + big.height
    out = []
    for x0, w in ((left, SB.SCREEN[0]), (left - bleed, SB.SCREEN[0] + 2 * bleed)):
        canvas = Image.new("RGB", (w, SB.SCREEN[1]))
        canvas.paste(big, (-x0, top))
        out.append(Image.fromarray(_pad_bottom(np.asarray(canvas), min(bottom, SB.SCREEN[1]))))
    info = {"src_size": im.size, "scale": round(scale, 3), "top": top, "bottom": bottom, "left": left,
            "horizon_src": horizon, "horizon_y": horizon_y, "zoom": zoom}
    return out[0], out[1], info


def floor(screen_decoded: Image.Image, wide: Image.Image, horizon_y: int, bleed: int = BLEED) -> Image.Image:
    """floorFront: the decoded rim's pixels below horizon_y, the wide stage's in the bleed; alpha 0 above."""
    a = np.zeros((wide.height, wide.width, 4), np.uint8)
    a[..., :3] = np.asarray(wide)
    a[:, bleed:bleed + screen_decoded.width, :3] = np.asarray(screen_decoded.convert("RGB"))
    a[horizon_y:, :, 3] = 255
    a[:horizon_y] = 0
    return Image.fromarray(a, "RGBA")


def write(screen: Image.Image, wide: Image.Image, out: Path = SB.OUT, horizon_y: int = RIM[4]) -> tuple[Path, Path]:
    out.mkdir(parents=True, exist_ok=True)
    rim, fl = out / "rim.webp", out / "rim_floor.webp"
    screen.save(rim, "WEBP", quality=90)                       # the accepted render's encoding (default method)
    floor(Image.open(rim), wide, horizon_y).save(fl, "WEBP", lossless=True, exact=True)
    return rim, fl


def coverage(img: Image.Image) -> float:
    """The share of rows 0..1080 that are not one constant colour (an unpainted fill row)."""
    a = np.asarray(img.convert("RGB"))
    return float((a != a[:, :1]).any(axis=(1, 2)).mean())


def _lum(a: np.ndarray) -> np.ndarray:
    return (a[..., :3].astype(float) * np.array([0.299, 0.587, 0.114])).sum(-1)


def _dilate(m: np.ndarray, n: int) -> np.ndarray:
    for _ in range(n):
        k = m.copy()
        k[1:] |= m[:-1]; k[:-1] |= m[1:]; k[:, 1:] |= m[:, :-1]; k[:, :-1] |= m[:, 1:]
        m = k
    return m


def edge_delta(img: Image.Image) -> float:
    """The backdrop's luma in a 6 px ring around F1's idle silhouette minus the silhouette's 6 px edge luma."""
    meta = json.loads((ROOT / "assets" / "sprites" / "monsters-ai.json").read_text())
    c = meta["sheets"]["chaos"]
    page = Image.open(ROOT / "assets" / "sprites" / meta["pages"][c["page"]]["file"]).convert("RGBA")
    (fx, fy), (cw, ch), s = c["frames"]["idle"], c["cell"], c["scale"]
    spr = np.asarray(page.crop((fx, fy, fx + cw, fy + ch)).resize((cw * s, ch * s), Image.Resampling.NEAREST))
    sx, sy = (TITAN[0] + TITAN[2]) // 2 - cw * s // 2, TITAN[3] - c["footRow"] * s
    bg = np.asarray(img.convert("RGB").crop((sx, sy, sx + spr.shape[1], sy + spr.shape[0])))
    m = spr[..., 3] > 0
    ring, edge = _dilate(m, 6) & ~m, m & _dilate(~m, 6)
    return float(_lum(bg)[ring].mean() - _lum(spr)[edge].mean())


def metrics(img: Image.Image) -> dict[str, float]:
    lum = _lum(np.asarray(img.convert("RGB")))
    x0, y0, x1, y1 = FIELD_BAND
    px0, py0, px1, py1 = SB.PARTY_BAND
    field = float(lum[y0:y1, x0:x1].std())
    return {"coverage": coverage(img), "edge_delta": edge_delta(img),
            "party_contrast": float(lum[py0:py1, px0:px1].std()) / field if field > 0 else 0.0,
            "seam": SB.seam(lum, SB.ENEMY_BAND)}


def check(image: Path) -> tuple[bool, str]:
    m, lim = metrics(Image.open(image)), CHECKS_RIM
    ok = (m["coverage"] >= lim["coverage"] and m["edge_delta"] >= lim["edge_delta"]
          and m["party_contrast"] >= lim["party_contrast"] and m["seam"] <= lim["seam"])
    return ok, (f"rim              coverage {m['coverage']:.1%} (>= {lim['coverage']:.0%}); boss edge_delta "
                f"{m['edge_delta']:.1f} (>= {lim['edge_delta']:.0f}); party band contrast {m['party_contrast']:.2f} x the "
                f"field's (>= {lim['party_contrast']}); seam {m['seam']:.1f} luma (<= {lim['seam']}) "
                f"{'ok' if ok else 'FAIL'}")


def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(description="Stage or check the rim backdrop (see the module docstring).")
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--src", help=f"directory with {RIM[0]} (default {SRC_DIR.relative_to(ROOT)})")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--image", help="with --check: measure this file instead of assets/backgrounds/rim.webp")
    a = ap.parse_args(argv[1:])
    if a.ids != ["rim"]:
        raise SystemExit(f"rim is staged and checked on its own (got {a.ids})")
    if a.check:
        ok, line = check(Path(a.image) if a.image else SB.OUT / "rim.webp")
        print(line)
        if not ok:
            raise SystemExit("--check failed: rim")
        return
    src = (Path(a.src).expanduser() if a.src else SRC_DIR) / RIM[0]
    screen, wide, info = stage(src, *RIM[1:])
    rim, fl = write(screen, wide)
    print(f"rim              <- {src.name:26s} {info} -> {rim.relative_to(ROOT)}, {fl.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv)

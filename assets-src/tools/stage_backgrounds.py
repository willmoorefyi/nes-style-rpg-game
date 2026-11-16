"""One-time remap of hand-made battle backgrounds onto the battle stage (docs/ART_BATTLE_PLAN.md).

  python3 -I assets-src/tools/stage_backgrounds.py [--src DIR] [ID ...]   # default: every id; `rim`: stage_rim.py
  python3 -I assets-src/tools/stage_backgrounds.py --check [ID ...] [--image FILE]   # measure CHECKS (see below)

Each source (1536x1024) is scaled to the 1920 px screen width and shifted so its horizon (where the scenery meets the
battle plain, measured by eye in source pixels) lands at screen y HORIZON_Y. The result is a screen-ready 1920x1080
image written to assets/backgrounds/<game id>.webp; the game draws it at (0, 0) unscaled.
This is not a build stage: rerun it only when a source image or a horizon changes, and name the ids you changed, so
the other images are not re-encoded. Only the ids a map's `battleBackgrounds` or a debug scenario uses are committed
(tests/data/assetCoverage.test.ts checks those); the rest stay staged locally until their act is built.

An id in COMPOSITES is then patched with a second copy of its own source (B14): `shoreline` has land only in its
right ~37 %, so the enemies stood on open sea. The source is mirrored, zoomed and pasted through a feathered mask
over the enemy side, which turns the beach into a rocky cove (rock under the enemies, sea and mountains behind; the
party's rocks are unchanged). `--check` measures the committed image (or FILE): water in the feet bands, the top
enemy row's water and contrast, and the largest straight vertical seam in the enemy band must stay within CHECKS.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "backgrounds"
DEFAULT_SRC = "~/temp/ffgame-assets/tiles/backgrounds/hd"
SCREEN = (1920, 1080)
FIELD_TOP = 120            # the message window covers 0-120
HORIZON_Y = 310            # stage spec: scenery above ~300, battle plain from ~340; feet at 360-770

# game background id -> (source file, horizon row in the 1536x1024 source[, zoom, align, horizon_y])
# zoom > 1 enlarges past the screen width; align picks which side stays ("left" / "center" / "right");
# horizon_y overrides HORIZON_Y for that image (raise the plain when the solid ground starts low)
STAGES = {
    "grassland": ("grassland-hd.png", 245),
    "forest": ("light-forest-hd.png", 280),
    "desert": ("dessert-hd.png", 260),
    "swamp": ("swamp-hd.png", 210),         # the party column (screen x 1380-1675) stands on the overgrown bank
    "marsh": ("marshland-hd.png", 210),
    "ocean": ("ship-hd.png", 200),          # sea battles on the deck
    "cave": ("earth-cave-hd.png", 210),
    # Temple of Fiends (act 1): the ruined temple, chosen on the stage over abandoned_castle (TF-3)
    "temple": ("evil-temple-hd.png", 170),
    "river": ("river-hd.png", 190),         # party on the right bank
    "shoreline": ("shoreline-hd.png", 280, 1.12, "right", 240),  # zoomed, right-aligned, horizon raised: rocks hold the party
    "waterfall": ("waterfall-hd.png", 230), # party on the grassy rocks
    # TF-3: the other hand-made sources, id = the file stem in snake_case (no "-hd")
    "fiend_hall": ("temple-of-fiends-hd.png", 155),  # the palace hall `temple` used before TF-3; for the act-4 return
    "abandoned_castle": ("abandoned-castle-hd.png", 215),
    "chaos": ("chaos-hd.png", 320),         # the party column stands on the floating floor (source x > 1050)
    "cracked_earth": ("cracked-earth-hd.png", 200),
    "dark_forest": ("dark-forest-hd.png", 195),
    "evil_temple": ("evil-temple-hd.png", 170),
    "fire_temple": ("fire-temple-hd.png", 215),
    "ice_cave": ("ice-cave-hd.png", 270),
    "magic_forest": ("magic-forest-hd.png", 190),
    "magma_temple": ("magma-temple-hd.png", 270),
    "palace": ("palace-hd.png", 175),
    "red_forest": ("red-forest-hd.png", 230),
    "ruined_forest": ("ruined-forest-hd.png", 280),
    "sky_palace": ("sky-palace-hd.png", 195),
    "swamp_cave": ("swamp-cave-hd.png", 290),
    "throne_kary": ("throne-kary-hd.png", 310),
    "throne_kraken": ("throne-kraken-hd.png", 245),
    "throne_lich": ("throne-lich-hd.png", 330),
    "throne_tiamat": ("throne-tiamat-hd.png", 340),  # pillar bases above the feet band
    "tower_of_babel": ("tower-of-babel-hd.png", 195),
    "town": ("town-hd.png", 230),
    "water_temple": ("water-temple-hd.png", 245),
}


# B14 (decision R-5), U10: id -> the free mirrored composite: zoom over the screen-width scale, y the paste row; the
# far-shore side (x <= drop[1]) sinks drop[0] px, easing to none at drop[2], so its rocks stay below the far shore.
# Only the layer's rock is pasted (water specks under `speck` px ignored; the rock shrunk `erode` px, blurred `soft`
# px), at x <= mask_x1 (the gap between the enemy area, x1 1340, and the party column) and below the layer's own
# sea/rock line: per column the first row from scan_y with no water in the next `solid` rows, `inset` px lower, never
# above top_min, and eased by at most `slope` px per column where it drops, so a boulder's shoulder ends in its own
# outline, not in a column (U10 review: a stepped max cut one off at x 1282). The top ramps in over feather_y px, the
# right edge over 2 x feather_x px, the mask is box-blurred `blur_x` px; the layer's rock is first matched to the
# base's in a `match` px band right of mask_x1 (per-channel mean and std), so the right edge shows no colour step.
COMPOSITES = {
    "shoreline": {"zoom": 1.9, "y": -680, "mask_x1": 1400, "feather_x": 40, "feather_y": 6, "top_min": 180,
                  "scan_y": 150, "solid": 30, "slope": 1.0, "inset": 4, "match": 120, "speck": 9, "erode": 3,
                  "soft": 1.5, "blur_x": 3, "drop": (40, 820, 1000)},
}

# --check: the feet bands (screen px, x0 y0 x1 y1) and the largest water share allowed in each
ENEMY_BAND = (80, 360, 1340, 770)
PARTY_BAND = (1380, 360, 1675, 770)
# U10: the top enemy row's feet band, and the band its contrast is compared with (a haze reads as low contrast)
TOP_BAND = (80, 360, 1340, 470)
BOTTOM_BAND = (80, 600, 1340, 745)
# U10 review: a seam is a straight vertical cut, a luma step between neighbouring columns that keeps its sign down a
# short window of rows (a painted edge wanders across columns, so its mean step over the window is much smaller)
SEAM_WIN = 60
CHECKS = {"shoreline": {"enemy": 0.15, "party": 0.10, "top_water": 0.15, "top_contrast": 0.8, "seam": 14.0}}


def is_water(a: np.ndarray) -> np.ndarray:
    """Water pixels of an RGB array: blue well above red and above green."""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (b > r + 40) & (b > g + 10)


def rock_line(layer: np.ndarray, x1: int, scan_y: int, solid: int, slope: float, inset: int, top_min: int) -> np.ndarray:
    """Per column x <= x1: the layer's sea/rock line, its drops eased to at most `slope` px per column (upwards only)."""
    water = is_water(layer)
    line = np.full(x1 + 1, layer.shape[0], dtype=float)
    for x in range(x1 + 1):
        dry = np.flatnonzero(np.convolve(water[scan_y:, x], np.ones(solid, dtype=int), mode="valid") == 0)
        if dry.size:
            line[x] = scan_y + int(dry[0])
    for xs, d in ((range(1, x1 + 1), -1), (range(x1 - 1, -1, -1), 1)):  # a sloped running min from each side
        for x in xs:
            line[x] = min(line[x], line[x + d] + slope)
    return np.maximum(top_min, line + inset)


def rock_mask(layer: np.ndarray, speck: int, erode: int, soft: int) -> np.ndarray:
    """1 where the layer is rock: its water without specks under `speck` px, the rest shrunk `erode` px, blurred `soft`."""
    water = Image.fromarray(is_water(layer).astype(np.uint8) * 255)
    water = water.filter(ImageFilter.MinFilter(speck)).filter(ImageFilter.MaxFilter(speck))
    rock = Image.fromarray(255 - np.asarray(water)).filter(ImageFilter.MinFilter(2 * erode + 1))
    return np.asarray(rock.filter(ImageFilter.GaussianBlur(soft))).astype(float) / 255


def colour_match(layer: np.ndarray, base: np.ndarray, x1: int, y0: int, band: int) -> np.ndarray:
    """`layer` shifted per channel so its rock left of x1 matches the base's in a `band` px band right of x1 (mean, std)."""
    lb, bb = layer[y0:, :x1].reshape(-1, 3), base[y0:, x1:x1 + band].reshape(-1, 3)
    lb, bb = lb[~is_water(lb)].astype(float), bb[~is_water(bb)]
    out = layer.astype(float)
    for c in range(3):
        sd_l, sd_b = lb[:, c].std(), bb[:, c].std()
        out[..., c] = (out[..., c] - lb[:, c].mean()) * (sd_b / sd_l if sd_l > 0 else 1.0) + bb[:, c].mean()
    return np.clip(out, 0, 255)


def composite(base: Image.Image, src: Path, zoom: float, y: int, mask_x1: int, feather_x: int, feather_y: int,
              top_min: int, scan_y: int, solid: int, slope: float, inset: int, match: int, speck: int, erode: int,
              soft: float, blur_x: int, drop: tuple[int, int, int]) -> Image.Image:
    """`base` with the mirrored, zoomed source's rock pasted at (0, y) below its own rock line, left of mask_x1 (U10)."""
    im = Image.open(src).convert("RGB").transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scale = SCREEN[0] / im.width * zoom
    big = np.asarray(im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS))
    # the far-shore side sinks (see COMPOSITES), rows sampled with linear blending
    cols = np.arange(SCREEN[0])
    src_y = np.arange(SCREEN[1])[:, None] - y - drop[0] * np.clip((drop[2] - cols) / (drop[2] - drop[1]), 0, 1)
    r0 = np.clip(np.floor(src_y).astype(int), 0, big.shape[0] - 2)
    f = (src_y - r0)[..., None]
    layer = (big[r0, cols] * (1 - f) + big[r0 + 1, cols] * f).round().astype(np.uint8)
    under = np.asarray(base.convert("RGB")).astype(float)
    line = rock_line(layer, mask_x1, scan_y, solid, slope, inset, top_min)
    line = np.concatenate([line, np.full(SCREEN[0] - line.size, line[-1])])  # runs on under the right-edge ramp
    vert = np.clip((np.arange(SCREEN[1])[:, None] - line[None, :]) / feather_y, 0, 1)
    horiz = np.clip((mask_x1 + feather_x - np.arange(SCREEN[0])) / (2 * feather_x), 0, 1)[None, :]
    mask = Image.fromarray(np.round(vert * horiz * rock_mask(layer, speck, erode, soft) * 255).astype(np.uint8))
    alpha = (np.asarray(mask.filter(ImageFilter.BoxBlur(blur_x))).astype(float) / 255)[..., None]
    matched = colour_match(layer, under, mask_x1, int(line.min()), match)
    return Image.fromarray((matched * alpha + under * (1 - alpha)).round().astype(np.uint8))


def water_share(img: Image.Image, box: tuple[int, int, int, int]) -> float:
    """The share of `box` that reads as water: blue well above red and above green."""
    return float(is_water(np.asarray(img.convert("RGB").crop(box))).mean())


def seam(lum: np.ndarray, box: tuple[int, int, int, int]) -> float:
    """The largest |luma step between neighbouring columns|, averaged over SEAM_WIN rows (every half window), in box."""
    x0, y0, x1, y1 = box
    step = np.diff(lum[:, x0 - 1:x1 + 1], axis=1)
    return max(float(np.abs(step[y:y + SEAM_WIN].mean(0)).max()) for y in range(y0, y1 - SEAM_WIN + 1, SEAM_WIN // 2))


def metrics(img: Image.Image) -> dict[str, float]:
    """--check's numbers: water in the feet bands; the top row's water and contrast; the enemy band's seam (U10)."""
    lum = (np.asarray(img.convert("RGB")).astype(float) * np.array([0.299, 0.587, 0.114])).sum(-1)
    std = {box: float(lum[box[1]:box[3], box[0]:box[2]].std()) for box in (TOP_BAND, BOTTOM_BAND)}
    return {"enemy": water_share(img, ENEMY_BAND), "party": water_share(img, PARTY_BAND),
            "top_water": water_share(img, TOP_BAND), "top_contrast": std[TOP_BAND] / std[BOTTOM_BAND],
            "seam": seam(lum, ENEMY_BAND)}


def check(ids: list[str], image: str | None = None) -> None:
    failed = []
    for gid in ids:
        if gid not in CHECKS:
            raise SystemExit(f"--check: no bounds for {gid} (known: {', '.join(CHECKS)})")
        m, lim = metrics(Image.open(image or OUT / f"{gid}.webp")), CHECKS[gid]
        ok = (m["enemy"] <= lim["enemy"] and m["party"] <= lim["party"] and m["top_water"] <= lim["top_water"]
              and m["top_contrast"] >= lim["top_contrast"] and m["seam"] <= lim["seam"])
        print(f"{gid:16s} water: enemy band {m['enemy']:.1%} (<= {lim['enemy']:.0%}), party band {m['party']:.1%} "
              f"(<= {lim['party']:.0%}); top row: water {m['top_water']:.1%} (<= {lim['top_water']:.0%}), contrast "
              f"{m['top_contrast']:.2f} x the bottom band's (>= {lim['top_contrast']}); seam {m['seam']:.1f} luma "
              f"(<= {lim['seam']}) {'ok' if ok else 'FAIL'}")
        if not ok:
            failed.append(gid)
    if failed:
        raise SystemExit(f"--check failed: {', '.join(failed)}")


def stage(src: Path, horizon: int, zoom: float = 1.0, align: str = "center", horizon_y: int = HORIZON_Y) -> Image.Image:
    im = Image.open(src).convert("RGB")
    scale = SCREEN[0] / im.width * zoom
    big = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    extra = big.width - SCREEN[0]
    left = {"left": 0, "center": extra // 2, "right": extra}[align]
    top = round(horizon_y - horizon * scale)
    if top > FIELD_TOP:
        raise SystemExit(f"{src.name}: horizon {horizon} would leave the battle field uncovered above y {top}")
    if top + big.height < SCREEN[1]:
        raise SystemExit(f"{src.name}: horizon {horizon} leaves the bottom of the screen uncovered")
    out = Image.new("RGB", SCREEN, big.getpixel((0, 0)))
    out.paste(big, (-left, top))
    return out


def main(argv: list[str]) -> None:
    if "rim" in argv[1:]: return __import__("runpy").run_path(str(Path(__file__).with_name("stage_rim.py")))["main"](argv)  # noqa: E701
    ap = argparse.ArgumentParser(description="Stage hand-made battle backgrounds (see the module docstring).")
    ap.add_argument("ids", nargs="*", help="background ids to (re)stage; default: all of STAGES")
    ap.add_argument("--src", default=DEFAULT_SRC, help=f"directory with the *-hd.png sources (default {DEFAULT_SRC})")
    ap.add_argument("--check", action="store_true", help="measure the committed images instead of staging")
    ap.add_argument("--image", help="with --check: measure this file instead of the committed one")
    args = ap.parse_args(argv[1:])
    unknown = [i for i in args.ids if i not in STAGES]
    if unknown:
        raise SystemExit(f"unknown background id(s): {', '.join(unknown)} (known: {', '.join(STAGES)})")
    if args.check:
        check(args.ids or list(CHECKS), args.image)
        return
    src_dir = Path(args.src).expanduser()
    OUT.mkdir(parents=True, exist_ok=True)
    for gid in args.ids or list(STAGES):
        name, horizon, *frame = STAGES[gid]
        img = stage(src_dir / name, horizon, *frame)
        if gid in COMPOSITES:
            img = composite(img, src_dir / name, **COMPOSITES[gid])
        path = OUT / f"{gid}.webp"
        img.save(path, "WEBP", quality=90, method=6)
        print(f"{gid:16s} <- {name:26s} horizon {horizon:3d} -> {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv)

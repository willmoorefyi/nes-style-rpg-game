"""One-time remap of hand-made battle backgrounds onto the battle stage (docs/ART_BATTLE_PLAN.md).

  python3 -I assets-src/tools/stage_backgrounds.py [--src DIR] [ID ...]   # default: every id; DIR defaults to
                                                                          # ~/temp/ffgame-assets/tiles/backgrounds/hd
  python3 -I assets-src/tools/stage_backgrounds.py --check [ID ...]      # water share under the actors' feet

Each source (1536x1024) is scaled to the 1920 px screen width and shifted so its horizon (where the scenery meets the
battle plain, measured by eye in source pixels) lands at screen y HORIZON_Y. The result is a screen-ready 1920x1080
image written to assets/backgrounds/<game id>.webp; the game draws it at (0, 0) unscaled.
This is not a build stage: rerun it only when a source image or a horizon changes, and name the ids you changed, so
the other images are not re-encoded. Only the ids a map's `battleBackgrounds` or a debug scenario uses are committed
(tests/data/assetCoverage.test.ts checks those); the rest stay staged locally until their act is built.

An id in COMPOSITES is then patched with a second copy of its own source (B14): `shoreline` has land only in its
right ~37 %, so the enemies stood on open sea. The source is mirrored, zoomed and pasted through a feathered mask
over the enemy side, which turns the beach into a rocky cove (rock under the enemies, sea and mountains behind; the
party's rocks are unchanged). `--check` measures the committed image: the share of water pixels (b > r + 40 and
b > g + 10) in the enemy and party feet bands must stay within CHECKS.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

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


# B14 (decision R-5), U10: id -> the free mirrored composite. zoom is over the screen-width scale, y the paste row.
# The mask covers x <= mask_x1 (1400: the gap between the enemy area, x1 1340, and the party column) below the pasted
# layer's own sea/rock line, found per column in the layer from row scan_y down (the first row with no water in the
# next `solid` rows), set `inset` px lower to the deepest line within `smooth` columns (so no sea fringe from the layer
# is pasted round a boulder's shoulder) and never above top_min (the far shore). Its top edge ramps in over feather_y
# px below that line only, so the rock under the top enemy row is solid and no sea from the layer is blended in (R's
# one 50 px blur left a haze of sea and rock there); its right edge ramps over 2 x feather_x px. Before pasting, the
# layer is colour-matched to the base (per-channel mean and std of the rock pixels in a `match` px band each side of
# the right edge), so the seam shows no colour step.
COMPOSITES = {
    "shoreline": {"zoom": 1.9, "y": -680, "mask_x1": 1400, "feather_x": 40, "feather_y": 10, "top_min": 180,
                  "scan_y": 150, "solid": 30, "smooth": 7, "inset": 4, "match": 120},
}

# --check: the feet bands (screen px, x0 y0 x1 y1) and the largest water share allowed in each
ENEMY_BAND = (80, 360, 1340, 770)
PARTY_BAND = (1380, 360, 1675, 770)
# U10: the top enemy row's feet band, and the band its contrast is compared with (a haze reads as low contrast)
TOP_BAND = (80, 360, 1340, 470)
BOTTOM_BAND = (80, 600, 1340, 745)
SEAM_ROWS = (380, 770)
SEAM_W = 30
CHECKS = {"shoreline": {"enemy": 0.15, "party": 0.10, "top_water": 0.15, "top_contrast": 0.8, "seam": 1.5}}


def is_water(a: np.ndarray) -> np.ndarray:
    """Water pixels of an RGB array: blue well above red and above green."""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (b > r + 40) & (b > g + 10)


def luma(a: np.ndarray) -> np.ndarray:
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def rock_line(layer: np.ndarray, x1: int, scan_y: int, solid: int, smooth: int, inset: int, top_min: int) -> np.ndarray:
    """Per column x <= x1: the layer's sea/rock line (the first row from scan_y with no water in the next `solid` rows)."""
    water = is_water(layer)
    h = layer.shape[0]
    line = np.full(x1 + 1, h, dtype=int)
    for x in range(x1 + 1):
        dry = np.flatnonzero(np.convolve(water[scan_y:, x], np.ones(solid, dtype=int), mode="valid") == 0)
        if dry.size:
            line[x] = scan_y + int(dry[0])
    padded = np.pad(line, smooth // 2, mode="edge")
    return np.maximum(top_min, np.array([int(padded[x:x + smooth].max()) + inset for x in range(x1 + 1)]))


def colour_match(layer: np.ndarray, base: np.ndarray, x1: int, y0: int, band: int) -> np.ndarray:
    """`layer` shifted per channel so its rock pixels left of x1 match the base's right of x1 in mean and std."""
    lb, bb = layer[y0:, x1 - band:x1].reshape(-1, 3), base[y0:, x1:x1 + band].reshape(-1, 3)
    lb, bb = lb[~is_water(lb)].astype(float), bb[~is_water(bb)]
    out = layer.astype(float)
    for c in range(3):
        sd_l, sd_b = lb[:, c].std(), bb[:, c].std()
        out[..., c] = (out[..., c] - lb[:, c].mean()) * (sd_b / sd_l if sd_l > 0 else 1.0) + bb[:, c].mean()
    return np.clip(out, 0, 255)


def composite(base: Image.Image, src: Path, zoom: float, y: int, mask_x1: int, feather_x: int, feather_y: int,
              top_min: int, scan_y: int, solid: int, smooth: int, inset: int, match: int) -> Image.Image:
    """`base` with the mirrored, zoomed source pasted at (0, y) below its own rock line, left of mask_x1 (U10)."""
    im = Image.open(src).convert("RGB").transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scale = SCREEN[0] / im.width * zoom
    big = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    layer_img = Image.new("RGB", SCREEN)
    layer_img.paste(big, (0, y))
    layer, under = np.asarray(layer_img), np.asarray(base.convert("RGB")).astype(float)
    line = rock_line(layer, mask_x1, scan_y, solid, smooth, inset, top_min)
    line = np.concatenate([line, np.full(SCREEN[0] - line.size, line[-1])])  # runs on under the right-edge ramp
    # a linear ramp from the line down: nothing of the layer above its own rock line is ever pasted
    vert = np.clip((np.arange(SCREEN[1])[:, None] - line[None, :]) / feather_y, 0, 1)
    horiz = np.clip((mask_x1 + feather_x - np.arange(SCREEN[0])) / (2 * feather_x), 0, 1)[None, :]
    alpha = (vert * horiz)[..., None]
    matched = colour_match(layer, under, mask_x1, int(line.min()), match)
    return Image.fromarray((matched * alpha + under * (1 - alpha)).round().astype(np.uint8))


def water_share(img: Image.Image, box: tuple[int, int, int, int]) -> float:
    """The share of `box` that reads as water: blue well above red and above green."""
    return float(is_water(np.asarray(img.convert("RGB").crop(box))).mean())


def seam_step(lum: np.ndarray, x: int) -> float:
    """Mean over SEAM_ROWS of the luma step between the SEAM_W px bands left and right of column x."""
    rows = lum[SEAM_ROWS[0]:SEAM_ROWS[1]]
    return float(np.abs(rows[:, x - SEAM_W:x].mean(1) - rows[:, x:x + SEAM_W].mean(1)).mean())


def band_std(lum: np.ndarray, box: tuple[int, int, int, int]) -> float:
    return float(lum[box[1]:box[3], box[0]:box[2]].std())


def metrics(img: Image.Image, x1: int) -> dict[str, float]:
    """--check's numbers: water in the feet bands; the top row's water and contrast; the seam step at x1 (U10)."""
    lum = luma(np.asarray(img.convert("RGB")).astype(float))
    steps = [seam_step(lum, x) for x in range(SEAM_W, SCREEN[0] - SEAM_W, 4)]
    return {"enemy": water_share(img, ENEMY_BAND), "party": water_share(img, PARTY_BAND),
            "top_water": water_share(img, TOP_BAND), "top_contrast": band_std(lum, TOP_BAND) / band_std(lum, BOTTOM_BAND),
            "seam": seam_step(lum, x1) / float(np.median(steps))}


def check(ids: list[str]) -> None:
    failed = []
    for gid in ids:
        if gid not in CHECKS:
            raise SystemExit(f"--check: no bounds for {gid} (known: {', '.join(CHECKS)})")
        m, lim = metrics(Image.open(OUT / f"{gid}.webp"), COMPOSITES[gid]["mask_x1"]), CHECKS[gid]
        ok = (m["enemy"] <= lim["enemy"] and m["party"] <= lim["party"] and m["top_water"] <= lim["top_water"]
              and m["top_contrast"] >= lim["top_contrast"] and m["seam"] <= lim["seam"])
        print(f"{gid:16s} water: enemy band {m['enemy']:.1%} (<= {lim['enemy']:.0%}), party band {m['party']:.1%} "
              f"(<= {lim['party']:.0%}); top row: water {m['top_water']:.1%} (<= {lim['top_water']:.0%}), contrast "
              f"{m['top_contrast']:.2f} x the bottom band's (>= {lim['top_contrast']}); seam {m['seam']:.2f} x the "
              f"median step (<= {lim['seam']}) {'ok' if ok else 'FAIL'}")
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
    ap = argparse.ArgumentParser(description="Stage hand-made battle backgrounds (see the module docstring).")
    ap.add_argument("ids", nargs="*", help="background ids to (re)stage; default: all of STAGES")
    ap.add_argument("--src", default=DEFAULT_SRC, help="directory with the *-hd.png sources")
    ap.add_argument("--check", action="store_true", help="measure the committed images' water share instead of staging")
    args = ap.parse_args(argv[1:])
    unknown = [i for i in args.ids if i not in STAGES]
    if unknown:
        raise SystemExit(f"unknown background id(s): {', '.join(unknown)} (known: {', '.join(STAGES)})")
    if args.check:
        check(args.ids or list(CHECKS))
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

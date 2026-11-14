"""One-time remap of hand-made battle backgrounds onto the battle stage (docs/ART_BATTLE_PLAN.md).

  python3 -I assets-src/tools/stage_backgrounds.py [--src DIR] [ID ...]   # default: every id; DIR defaults to
                                                                          # ~/temp/ffgame-assets/tiles/backgrounds/hd

Each source (1536x1024) is scaled to the 1920 px screen width and shifted so its horizon (where the scenery meets the
battle plain, measured by eye in source pixels) lands at screen y HORIZON_Y. The result is a screen-ready 1920x1080
image written to assets/backgrounds/<game id>.webp; the game draws it at (0, 0) unscaled.
This is not a build stage: rerun it only when a source image or a horizon changes, and name the ids you changed, so
the other images are not re-encoded. Only the ids a map's `battleBackgrounds` or a debug scenario uses are committed
(tests/data/assetCoverage.test.ts checks those); the rest stay staged locally until their act is built.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

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
    args = ap.parse_args(argv[1:])
    unknown = [i for i in args.ids if i not in STAGES]
    if unknown:
        raise SystemExit(f"unknown background id(s): {', '.join(unknown)} (known: {', '.join(STAGES)})")
    src_dir = Path(args.src).expanduser()
    OUT.mkdir(parents=True, exist_ok=True)
    for gid in args.ids or list(STAGES):
        name, horizon, *frame = STAGES[gid]
        img = stage(src_dir / name, horizon, *frame)
        path = OUT / f"{gid}.webp"
        img.save(path, "WEBP", quality=90, method=6)
        print(f"{gid:16s} <- {name:26s} horizon {horizon:3d} -> {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv)

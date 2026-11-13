"""One-time remap of hand-made battle backgrounds onto the battle stage (docs/ART_BATTLE_PLAN.md).

  python3 -I assets-src/tools/stage_backgrounds.py [SOURCE_DIR]      # default ~/temp/ffgame-assets/tiles/backgrounds/hd

Each source (1536x1024) is scaled to the 1920 px screen width and shifted so its horizon (where the scenery meets the
battle plain, measured by eye in source pixels) lands at screen y HORIZON_Y. The result is a screen-ready 1920x1080
image written to assets/backgrounds/<game id>.webp and committed; the game draws it at (0, 0) unscaled.
This is not a build stage: rerun it only when a source image or a horizon changes.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "backgrounds"
SCREEN = (1920, 1080)
FIELD_TOP = 120            # the message window covers 0-120
HORIZON_Y = 310            # stage spec: scenery above ~300, battle plain from ~340; feet at 360-770

# game background id -> (source file, horizon row in the 1536x1024 source[, zoom, align])
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
    "temple": ("temple-of-fiends-hd.png", 155),
    "river": ("river-hd.png", 190),         # party on the right bank
    "shoreline": ("shoreline-hd.png", 280, 1.12, "right", 240),  # zoomed, right-aligned, horizon raised: rocks hold the party
    "waterfall": ("waterfall-hd.png", 230), # party on the grassy rocks
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
    src_dir = Path(argv[1]).expanduser() if len(argv) > 1 else Path("~/temp/ffgame-assets/tiles/backgrounds/hd").expanduser()
    OUT.mkdir(parents=True, exist_ok=True)
    for gid, (name, horizon, *frame) in STAGES.items():
        img = stage(src_dir / name, horizon, *frame)
        path = OUT / f"{gid}.webp"
        img.save(path, "WEBP", quality=90, method=6)
        print(f"{gid:9s} <- {name:24s} horizon {horizon:3d} -> {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv)

"""Build all game art/audio from assets-src into assets/.

Usage (from repo root):  python3 -I assets-src/build_assets.py [terrain|characters|monsters|backgrounds|audio ...]
With no arguments every stage runs. Sprites are authored at native SNES resolution and
upscaled with nearest-neighbour: x3 for field art (TILE_SIZE=48 in LayoutConstants.ts) and x4
for the battle character atlas.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from PIL import Image  # noqa: E402

import characters  # noqa: E402
import tiles  # noqa: E402
from pixel import scaled  # noqa: E402

FIELD_SCALE = 3
BATTLE_SCALE = 4
ATLAS_BLOCKS_PER_ROW = 4
ASSETS = HERE.parent / "assets"
PREVIEW = HERE / "preview"


def build_terrain() -> None:
    out = ASSETS / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    terrain = tiles.build_terrain_sheet()
    scaled(terrain, FIELD_SCALE).save(out / "terrain.png")
    scaled(terrain, 8).save(PREVIEW / "terrain-8x.png")
    print(f"terrain.png: {terrain.width * FIELD_SCALE}x{terrain.height * FIELD_SCALE}")


def build_characters() -> None:
    out = ASSETS / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    ids = list(characters.ROSTER)
    bw, bh = characters.CELL_W * characters.BLOCK_COLS, characters.CELL_H * characters.BLOCK_ROWS
    rows = (len(ids) + ATLAS_BLOCKS_PER_ROW - 1) // ATLAS_BLOCKS_PER_ROW
    atlas = Image.new("RGBA", (bw * ATLAS_BLOCKS_PER_ROW, bh * rows), (0, 0, 0, 0))
    index: dict[str, dict[str, int]] = {}
    for n, cid in enumerate(ids):
        x, y = (n % ATLAS_BLOCKS_PER_ROW) * bw, (n // ATLAS_BLOCKS_PER_ROW) * bh
        atlas.paste(characters.build_block(characters.ROSTER[cid]), (x, y))
        index[cid] = {"x": x, "y": y}
    scaled(atlas, FIELD_SCALE).save(out / "characters.png")
    scaled(atlas, BATTLE_SCALE).save(out / "characters-battle.png")
    scaled(atlas, 4).save(PREVIEW / "characters-4x.png")
    meta = {
        "cell": [characters.CELL_W, characters.CELL_H],
        "cols": characters.BLOCK_COLS,
        "rows": characters.BLOCK_ROWS,
        "fieldScale": FIELD_SCALE,
        "battleScale": BATTLE_SCALE,
        "rowNames": ["down", "up", "left", "right", "battle"],
        "battleFrames": ["ready", "attack", "cast", "hurt", "down", "victory"],
        "sheets": index,
    }
    (out / "characters.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"characters: {len(ids)} sheets, atlas {atlas.width}x{atlas.height} native")


def build_monsters() -> None:
    import monsters

    monsters.build(ASSETS)
    out = ASSETS / "sprites" / "monsters"
    ids = sorted(p.stem for p in out.glob("*.png"))
    (out / "index.json").write_text(json.dumps(ids) + "\n")
    print(f"monsters: {len(ids)} sprites")


def build_optional(module_name: str) -> None:
    mod = __import__(module_name)
    mod.build(ASSETS)
    print(f"{module_name}: built")


STAGES = {
    "terrain": build_terrain,
    "characters": build_characters,
    "monsters": build_monsters,
    "backgrounds": lambda: build_optional("backgrounds"),
    "audio": lambda: build_optional("audio"),
}


def main() -> None:
    PREVIEW.mkdir(exist_ok=True)
    wanted = sys.argv[1:] or list(STAGES)
    unknown = [w for w in wanted if w not in STAGES]
    if unknown:
        raise SystemExit(f"unknown stage(s) {unknown}; choose from {list(STAGES)}")
    for name in wanted:
        STAGES[name]()


if __name__ == "__main__":
    main()

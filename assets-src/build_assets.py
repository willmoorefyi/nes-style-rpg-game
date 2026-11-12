"""Build all game art/audio from assets-src into assets/.

Usage (from repo root):  python3 -I assets-src/build_assets.py [terrain|characters|battle|battle_ai|monsters|backgrounds|audio ...]
With no arguments every stage runs. Sprites are authored at native SNES resolution and
upscaled with nearest-neighbour: x3 for the legacy field/terrain art (TILE_SIZE=48 in LayoutConstants.ts)
and the legacy battle atlas. AI-generated 2x art is built from assets-src/gen/ (see docs/ART_2X_PLAN.md).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from PIL import Image  # noqa: E402

import characters  # noqa: E402
from rig import figure as rig_figure  # noqa: E402
import tiles  # noqa: E402
from pixel import scaled  # noqa: E402

FIELD_SCALE = 3
BATTLE_SCALE = 3
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
    scaled(atlas, 4).save(PREVIEW / "characters-4x.png")
    meta = {
        "cell": [characters.CELL_W, characters.CELL_H],
        "cols": characters.BLOCK_COLS,
        "rows": characters.BLOCK_ROWS,
        "fieldScale": FIELD_SCALE,
        "rowNames": ["down", "up", "left", "right", "battle"],
        "sheets": index,
    }
    (out / "characters.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"characters: {len(ids)} sheets, atlas {atlas.width}x{atlas.height} native")


BATTLE_CLASSES = ["warrior", "thief", "monk", "white_mage", "black_mage", "red_mage",
                  "knight", "ninja", "master", "white_wizard", "black_wizard", "red_wizard"]


def build_battle() -> None:
    """Battle-size (40x46 native) posable figures: one row per class, one column per pose."""
    out = ASSETS / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    poses = list(rig_figure.POSES)
    atlas = Image.new("RGBA", (rig_figure.W * len(poses), rig_figure.H * len(BATTLE_CLASSES)), (0, 0, 0, 0))
    for row, cid in enumerate(BATTLE_CLASSES):
        for col, pose in enumerate(poses):
            atlas.paste(rig_figure.render_class(characters.ROSTER[cid], pose), (col * rig_figure.W, row * rig_figure.H))
    scaled(atlas, BATTLE_SCALE).save(out / "battle-characters.png")
    scaled(atlas, 2).save(PREVIEW / "battle-characters-2x.png")
    meta = {
        "cell": [rig_figure.W, rig_figure.H],
        "scale": BATTLE_SCALE,
        "poses": poses,
        "sheets": {cid: {"row": row} for row, cid in enumerate(BATTLE_CLASSES)},
    }
    (out / "battle-characters.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"battle: {len(BATTLE_CLASSES)} classes x {len(poses)} poses")


APPROVED = HERE / "gen" / "approved"
AI_SCALE = 2


def build_battle_ai() -> None:
    """Approved AI battle sheets (assets-src/gen/approved/<id>/battle.png, 3x2 native) -> one 6-frame row per id.

    Written to separate files so the legacy battle atlas is never touched.
    """
    out = ASSETS / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    entries = []
    for meta_path in sorted(APPROVED.glob("*/battle.json")):
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_name("battle.png")).convert("RGBA")
        entries.append((meta, sheet))
    if not entries:
        print("battle_ai: no approved sheets")
        return
    gw, gh = entries[0][0]["grid"]
    poses = entries[0][0]["poses"]
    cols = entries[0][0]["layout"][0]
    atlas = Image.new("RGBA", (gw * len(poses), gh * len(entries)), (0, 0, 0, 0))
    sheets = {}
    for row, (meta, sheet) in enumerate(entries):
        if meta["grid"] != [gw, gh] or meta["poses"] != poses:
            raise SystemExit(f"battle_ai: {meta['character']} grid/poses differ from the first approved sheet")
        for i in range(len(poses)):
            x, y = (i % cols) * gw, (i // cols) * gh
            atlas.paste(sheet.crop((x, y, x + gw, y + gh)), (i * gw, row * gh))
        sheets[meta["character"]] = {"row": row}
    scaled(atlas, AI_SCALE).save(out / "battle-characters-ai.png")
    (out / "battle-characters-ai.json").write_text(json.dumps({
        "cell": [gw, gh], "scale": AI_SCALE, "footRow": entries[0][0]["bottom_row"], "poses": poses, "sheets": sheets,
    }, indent=2) + "\n")
    print(f"battle_ai: {len(entries)} approved sheet(s): {list(sheets)}")


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
    "battle": build_battle,
    "battle_ai": build_battle_ai,
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

"""Build all game art/audio from assets-src into assets/.

Usage (from repo root):  python3 -I assets-src/build_assets.py [terrain|characters|battle_ai|field_ai|monsters_ai|audio ...]
With no arguments every stage runs. Sprites are authored at native SNES resolution and
upscaled with nearest-neighbour: x3 for the legacy field/terrain art (TILE_SIZE=48 in LayoutConstants.ts).
Battle art (party, monsters) is the AI-generated 2x art built from assets-src/gen/ (docs/ART_2X_PLAN.md,
docs/ART_MONSTERS_PLAN.md); battle backgrounds are staged once by assets-src/tools/stage_backgrounds.py.
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
ATLAS_BLOCKS_PER_ROW = 4
ASSETS = HERE.parent / "assets"
PREVIEW = HERE / "preview"


def build_terrain() -> None:
    out = ASSETS / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    terrain = tiles.build_terrain_sheet()
    scaled(terrain, FIELD_SCALE).save(out / "terrain.png")
    scaled(terrain, 6).save(out / "terrain-6x.png")      # stopgap for the 96 px AI-preview tiles (Phase 6 redraws terrain)
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


APPROVED = HERE / "gen" / "approved"
AI_SCALE = 2


def apply_face_fix(sheet: Image.Image, meta: dict, gw: int, gh: int, cols: int, poses: list) -> Image.Image:
    """Review fix applied at build time (the approved sheet itself is a style reference and must stay byte-identical):
    recolour `from` colours inside `box` of one pose, plus single `extra` pixels, to `to`."""
    fix = meta.get("face_fix")
    if not fix:
        return sheet
    import numpy as np
    a = np.asarray(sheet).copy()
    i = poses.index(fix["pose"])
    ox, oy = (i % cols) * gw, (i // cols) * gh
    x0, y0, x1, y1 = fix["box"]
    sub = a[oy + y0:oy + y1, ox + x0:ox + x1]
    for c in fix["from"]:
        sub[(sub[..., :3] == c).all(-1) & (sub[..., 3] > 0), :3] = fix["to"]
    for x, y in fix.get("extra", []):
        a[oy + y, ox + x, :3] = fix["to"]
    return Image.fromarray(a)


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
    from gen import puppet as PU
    gw, gh = entries[0][0]["grid"]
    poses = entries[0][0]["poses"]
    cols = entries[0][0]["layout"][0]
    # in-between poses (puppet.py, from gen/anim/<id>.yaml); a class without joints repeats its nearest keyframe
    all_poses = poses + PU.INBETWEENS
    atlas = Image.new("RGBA", (gw * len(all_poses), gh * len(entries)), (0, 0, 0, 0))
    sheets = {}
    for row, (meta, sheet) in enumerate(entries):
        if meta["grid"] != [gw, gh] or meta["poses"] != poses:
            raise SystemExit(f"battle_ai: {meta['character']} grid/poses differ from the first approved sheet")
        sheet = PU.apply_face_fix(sheet, meta, gw, gh, cols, poses)
        frames = {}
        for i, pose in enumerate(poses):
            x, y = (i % cols) * gw, (i // cols) * gh
            frames[pose] = sheet.crop((x, y, x + gw, y + gh))
        tween = PU.battle_inbetweens(meta["character"])
        for pose in PU.INBETWEENS:
            frames[pose] = tween.get(pose, frames[PU.SOURCE[pose]])
        for i, pose in enumerate(all_poses):
            atlas.paste(frames[pose], (i * gw, row * gh))
        sheets[meta["character"]] = {"row": row, "inbetweens": bool(tween)}
    scaled(atlas, AI_SCALE).save(out / "battle-characters-ai.png")
    (out / "battle-characters-ai.json").write_text(json.dumps({
        "cell": [gw, gh], "scale": AI_SCALE, "footRow": entries[0][0]["bottom_row"], "poses": all_poses, "sheets": sheets,
    }, indent=2) + "\n")
    print(f"battle_ai: {len(entries)} approved sheet(s); in-betweens for {[c for c, v in sheets.items() if v['inbetweens']]}")


FIELD_DIRS = ["down", "up", "left"]


def mirror_strip(strip: Image.Image, frame_w: int) -> Image.Image:
    """Mirror each frame of a horizontal strip in place (frame order stays stand, step L, step R)."""
    out = Image.new("RGBA", strip.size)
    for i in range(strip.width // frame_w):
        frame = strip.crop((i * frame_w, 0, (i + 1) * frame_w, strip.height))
        out.paste(frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (i * frame_w, 0))
    return out


def head_swap(row: Image.Image, gw: int, dst: int, src: int, head_rows: int) -> Image.Image:
    import numpy as np
    a = np.asarray(row.convert("RGBA")).copy()

    def head(i: int) -> tuple[int, float]:
        f = a[:, i * gw:(i + 1) * gw]
        top = int(np.where((f[..., 3] > 0).any(1))[0].min())
        xs = np.where((f[top:top + head_rows, :, 3] > 0).any(0))[0]
        return top, (xs.min() + xs.max()) / 2

    (td, cd), (ts, cs) = head(dst), head(src)
    dx = int(round(cd - cs))
    piece = a[ts:ts + head_rows, src * gw:(src + 1) * gw]
    shifted = np.zeros_like(piece)
    if dx >= 0:
        shifted[:, dx:] = piece[:, :gw - dx]
    else:
        shifted[:, :dx] = piece[:, -dx:]
    h = min(head_rows, a.shape[0] - td)
    a[td:td + h, dst * gw:(dst + 1) * gw] = shifted[:h]
    return Image.fromarray(a)


def field_rows() -> dict[str, dict]:
    """Every approved field sprite as {id: {direction: (meta, 3-frame row)}} with the review fixes applied
    (head_from, flip_frames, flip_rows, row_from); side rows face left."""
    chars: dict[str, dict] = {}
    for meta_path in sorted(APPROVED.glob("*/field_*.json")):
        meta = json.loads(meta_path.read_text())
        direction = meta["sheet"].removeprefix("field_")
        chars.setdefault(meta["character"], {})[direction] = (meta, Image.open(meta_path.with_suffix(".png")).convert("RGBA"))
    # A full field sheet (approved/<id>/field.json, 3x3: one row per direction) supersedes single-direction sheets.
    for meta_path in sorted(APPROVED.glob("*/field.json")):
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
        gw, gh = meta["grid"]
        dirs = {}
        for r, direction in enumerate(meta["rows"]):
            row = sheet.crop((0, r * gh, 3 * gw, (r + 1) * gh))
            # a frame whose head was drawn wrong (e.g. eyes on the back of the head) takes the head of another
            # frame in the same row: [dst, src, rows], aligned on the top row and the head's horizontal centre
            for dst_i, src_i, head_rows in meta.get("head_from", {}).get(direction, []):
                row = head_swap(row, gw, dst_i, src_i, head_rows)
            # single frames drawn facing the other way from the rest of their row (mirrored in place first)
            for i in meta.get("flip_frames", {}).get(direction, []):
                row.paste(row.crop((i * gw, 0, (i + 1) * gw, gh)).transpose(Image.Transpose.FLIP_LEFT_RIGHT), (i * gw, 0))
            if direction in meta.get("flip_rows", []):
                row = mirror_strip(row, gw)
            dirs[direction] = (meta, row)
        # a row drawn as the wrong character takes another row's frames (review fix, e.g. Garland's side view)
        for direction, src in meta.get("row_from", {}).items():
            dirs[direction] = dirs[src]
        chars[meta["character"]] = dirs
    # static props used as NPCs (chests): one kit part, bottom-aligned on the field feet row, in every frame
    relics = APPROVED / "temple" / "relics.json"
    if relics.exists() and chars:
        rmeta = json.loads(relics.read_text())
        rimg = Image.open(relics.with_suffix(".png")).convert("RGBA")
        pos = {n: (r, c) for r, row in enumerate(rmeta["cells"]) for c, n in enumerate(row) if n}
        if "chest_closed" in pos:
            r, c = pos["chest_closed"]
            part = rimg.crop((c * 48, r * 48, (c + 1) * 48, (r + 1) * 48))
            any_meta = next(iter(next(iter(chars.values())).values()))[0]
            gw, gh = any_meta["grid"]
            frame = Image.new("RGBA", (gw, gh))
            frame.alpha_composite(part, ((gw - 48) // 2, any_meta["bottom_row"] + 1 - 48))
            row = Image.new("RGBA", (3 * gw, gh))
            for i in range(3):
                row.alpha_composite(frame, (i * gw, 0))
            chars["chest"] = {d: (any_meta, row) for d in ("down", "up", "left", "right")}
    return chars


def build_field_ai() -> None:
    """Approved AI field sheets -> characters-ai.png/.json: rows down, up, left, right; 7 columns per direction
    (stand, then the walk cycle contact/down/pass for each foot, puppet.walk_row). Right is baked as a mirror of
    left. A direction that is not approved yet falls back to another approved direction ("fallbacks")."""
    from gen import puppet as PU
    out = ASSETS / "sprites"
    chars = field_rows()
    if not chars:
        print("field_ai: no approved field sheets")
        return
    first = next(iter(next(iter(chars.values())).values()))[0]
    gw, gh = first["grid"]
    ncol = len(PU.WALK_COLS)
    per_row = 4
    blocks = list(chars.items())
    atlas = Image.new("RGBA", (gw * ncol * per_row, gh * 4 * ((len(blocks) + per_row - 1) // per_row)), (0, 0, 0, 0))
    sheets, fallbacks = {}, {}
    for n, (cid, dirs) in enumerate(blocks):
        bx, by = (n % per_row) * gw * ncol, (n // per_row) * gh * 4
        cfg = PU.load_cfg(cid)
        rows = {}
        for d in FIELD_DIRS:
            if d in dirs:
                row = dirs[d][1]
            else:
                src = next(x for x in ("left", "down", "up") if x in dirs)
                row = dirs[src][1]
                fallbacks.setdefault(cid, []).append(f"{d}<-{src}")
            three = [row.crop((i * gw, 0, (i + 1) * gw, gh)) for i in range(3)]
            seven = PU.walk_row("side" if d == "left" else d, three, cfg, first["bottom_row"]) if cid != "chest" else \
                [three[0]] * ncol
            rows[d] = Image.new("RGBA", (gw * ncol, gh))
            for i, f in enumerate(seven):
                rows[d].paste(f, (i * gw, 0))
        rows["right"] = mirror_strip(rows["left"], gw)
        if "left" not in dirs:
            fallbacks.setdefault(cid, []).append("right<-mirror(fallback)")
        for r, d in enumerate(["down", "up", "left", "right"]):
            atlas.paste(rows[d], (bx, by + r * gh))
        sheets[cid] = {"x": bx, "y": by}
    scaled(atlas, AI_SCALE).save(out / "characters-ai.png")
    (out / "characters-ai.json").write_text(json.dumps({
        "cell": [gw, gh], "cols": ncol, "rows": 4, "fieldScale": AI_SCALE, "footRow": first["bottom_row"],
        "columns": PU.WALK_COLS, "walkSequence": PU.WALK_SEQUENCE, "walkPhases": PU.WALK_PHASES,
        "rowNames": ["down", "up", "left", "right"], "sheets": sheets, "fallbacks": fallbacks,
    }, indent=2) + "\n")
    print(f"field_ai: {list(sheets)}; fallbacks {fallbacks}")


def build_monsters_ai() -> None:
    """Approved AI monster sheets (approved/<id>/monster_<size>.png: idle | attack | hurt) plus palette-swap variants
    from gen/monsters.yaml -> assets/sprites/monsters-ai.png/.json (docs/ART_MONSTERS_PLAN.md). One row per sprite."""
    import yaml
    from gen import monster as M

    out = ASSETS / "sprites"
    entries: list[tuple[str, dict, list[Image.Image]]] = []
    for meta_path in sorted(APPROVED.glob("*/monster_*.json")):
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
        cw, ch = meta["grid"]
        frames = [sheet.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(3)]
        for i in meta.get("flip_frames", []):
            frames[i] = frames[i].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        entries.append((meta["character"], meta, frames))
    # per-pose bosses: approved/<id>/boss_{idle,attack,hurt}.png (one frame each), combined once all three exist
    for idle_meta in sorted(APPROVED.glob("*/boss_idle.json")):
        parts = [idle_meta.with_name(f"boss_{p}.json") for p in ("idle", "attack", "hurt")]
        if not all(p.exists() for p in parts):
            print(f"monsters_ai: {idle_meta.parent.name} boss poses incomplete, skipped")
            continue
        cast = idle_meta.with_name("boss_cast.json")      # optional spell stance
        poses = ["idle", "attack", "hurt"] + (["cast"] if cast.exists() else [])
        parts = [idle_meta.with_name(f"boss_{p}.json") for p in poses]
        metas = [json.loads(p.read_text()) for p in parts]
        frames = []
        for p, m in zip(parts, metas):
            f = Image.open(p.with_suffix(".png")).convert("RGBA")
            frames.append(f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if 0 in m.get("flip_frames", []) else f)
        meta = {**metas[0], "poses": poses}
        entries.append((meta["character"], meta, frames))
    if not entries:
        print("monsters_ai: no approved monster sheets")
        return
    specs = {m["id"]: m for m in yaml.safe_load((HERE / "gen" / "monsters.yaml").read_text())}
    for cid, meta, frames in list(entries):
        for variant in specs.get(cid, {}).get("variants", []) or []:
            entries.append((variant["id"], meta, [M.recolor(f, variant) for f in frames]))
    width = max(len(e[2]) * e[2][0].width for e in entries)
    height = sum(e[2][0].height for e in entries)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sheets, y = {}, 0
    for sid, meta, frames in entries:
        cw, ch = frames[0].size
        for i, f in enumerate(frames):
            atlas.paste(f, (i * cw, y))
        sheets[sid] = {"cell": [cw, ch], "footRow": meta["bottom_row"], "floating": meta.get("floating", False),
                       "frames": {pose: [i * cw, y] for i, pose in enumerate(meta["poses"])}}
        y += ch
    scaled(atlas, AI_SCALE).save(out / "monsters-ai.png")
    (out / "monsters-ai.json").write_text(json.dumps({"scale": AI_SCALE, "sheets": sheets}, indent=2) + "\n")
    print(f"monsters_ai: {list(sheets)}")


def build_optional(module_name: str) -> None:
    mod = __import__(module_name)
    mod.build(ASSETS)
    print(f"{module_name}: built")


def build_maps() -> None:
    """Compile assets-src/maps/*.yaml into baked 2x maps (assets/maps/ai/); docs/ART_TILES_PLAN.md."""
    sys.path.insert(0, str(HERE / "tools"))
    import build_map
    try:
        build_map.build()
    except build_map.MapError as e:
        raise SystemExit(f"map error: {e}")


STAGES = {
    "terrain": build_terrain,
    "characters": build_characters,
    "battle_ai": build_battle_ai,
    "field_ai": build_field_ai,
    "monsters_ai": build_monsters_ai,
    "maps": build_maps,
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

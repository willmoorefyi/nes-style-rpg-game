"""Re-cut the approved pass-AR ground textures (AR-T picks, AR-T2) from the render cache into one kit sheet.

    python3 -I assets-src/gen/terrain_cut.py            # write approved/overworld/terrain_ar.{png,json}
    python3 -I assets-src/gen/terrain_cut.py --check    # rebuild in memory, exit 1 if the committed sheet differs
    python3 -I assets-src/gen/terrain_cut.py --native DIR   # also write each material / part as its own PNG

No Bedrock or Gemini call: every render is read from the content-addressed cache assets-src/gen/cache/<key>.png
(Stability Image Core renders of pass AR, purpose ar_tiles; a missing key is an error: copy the cache file from the
main checkout into a worktree first). Each material is a 192 px tile (4 x 4 cells at 48 native, shown at x2),
seamless (quilted on the render's own wrap), opaque, 15-bit, 4-12 colours (gen/terrain_pix.py).

The sheet is loaded into every kit (kit.AR_SHEET) under these names, none of which an older sheet uses:
- `ar_<m>` (and `ar_<m>@b`, a second texture the organic painter mixes in by low-frequency noise) for the materials
  older sheets already have (grass, forest, mountain, sand, ocean, dirt, cobble): the organic painter
  (terrain.base.tex) prefers them, so towns and interiors keep their own;
- new materials by their own names: `beach`, `shallows`, `swamp`, `taiga`, `snow`, `mountain_cold` (+ `@b`), the calm
  fresh water `water_calm` / `water_calm_shallow` (AR-T2: rivers and lakes, derived from a rock-free window of the
  shallows render and the ocean's ramp; no streaks), so the classic painter finds them too (swamp, taiga and snow
  were build_map fallbacks before);
- the dungeon floors `ar_temple_floor`, `ar_temple_rubble` (and their `_cool` slate recolours), `ar_cave`,
  `ar_wood_floor`, `ar_marble`, `ar_lava`, `ar_ice`, used through the layout scripts' `materials:` remaps;
- the parts `ar_tree_clump` (the approved tree_clump in the new forest's ramp) and `conifer_clump` (the taiga's edge
  clump, code-drawn in the taiga's ramp: four pines, snow on the lit side).
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from gen import terrain_pix as TP  # noqa: E402

N = 192                                        # px per material tile (4 x 4 cells)
COLS = 6                                       # material tiles per sheet row
OUT = HERE / "approved" / "overworld" / "terrain_ar"
CACHE = HERE / "cache"
APPROVED = "2026-11-21"
MODEL = "stability.stable-image-core-v1:1"
# name: (render id, seed, cache key, tile settings)   (the AR-T picks, README.md "Picks"; user-approved 2026-11-21)
SPEC = {
    "ar_grass": ("grass_b_1", 1, "4192a5a59bb3c1119f9ba710", {"k": 9, "gain": 1.12, "sat": 0.9}),
    "ar_grass@b": ("grass_b_2", 2, "964ca93455b295b141b5dbb9", {"k": 9, "gain": 1.12, "sat": 0.9}),
    "ar_forest": ("forest_1", 1, "86d973a147788ae1a303e145", {"k": 9, "gain": 0.72, "sat": 0.65}),
    "ar_forest@b": ("forest_2", 2, "1480fa11266e2a1d5546626e", {"k": 9, "gain": 0.72, "sat": 0.65}),
    # AR-T2: taiga lifted out of the near-black (lift 0.3 on the darks): dark but readable at 2x
    "taiga": ("taiga_1", 1, "b7b8a34a3ff0002e5344b5e3", {"k": 9, "win": [0.0, 0.0, 0.42], "gain": 1.0, "sat": 0.8,
                                                         "lift": 0.3}),
    "snow": ("snow_b_2", 2, "1079bf9e773717fbb5bcc2c0", {"k": 7, "con": 0.7}),
    "ar_mountain": ("mountain_1", 1, "ff36bde7d07c903d152c3ac4", {"k": 9, "sat": 0.85}),
    "ar_mountain@b": ("mountain_2", 2, "9dc79db94acaff1de2f6330c", {"k": 9, "sat": 0.85}),
    "ar_sand": ("desert_2", 2, "caacb6ac4c6638263e48de1c", {"k": 7, "con": 0.45, "sat": 0.85, "gain": 1.05}),
    "beach": ("beach_1", 1, "c87e5812c6fb2207c44d59c1", {"k": 7}),
    "swamp": ("swamp_1", 1, "26eda99749ea2fbcfe9f8857", {"k": 9, "gain": 0.8, "sat": 0.65, "con": 0.75}),
    "ar_ocean": ("ocean_2", 2, "cdb80ce32cffa5e5cd184eff", {"k": 7, "con": 0.45}),
    "shallows": ("shallows_b_1", 1, "44f5bf6ff46e3d93ec9d902b", {"k": 7, "win": [0.63, 0.27, 0.33], "con": 0.8}),
    # AR-T2 river / lake fix: a rock-free window of open water in the same shallows render (calm caustics, no
    # streaks); the deep step is the same tile on the ocean's ramp (DERIVED below)
    "water_calm_shallow": ("shallows_b_1", 1, "44f5bf6ff46e3d93ec9d902b", {"k": 6, "win": [0.0, 0.42, 0.16],
                                                                          "con": 0.55}),
    "ar_dirt": ("dirt_b_1", 1, "ead80bf40da774964ad93667", {"k": 7, "con": 0.8}),
    "ar_cobble": ("cobble_2", 2, "528101b01d1a8853e75e63f6", {"k": 8, "crop": 0.6}),
    "ar_temple_floor": ("temple_floor_1", 1, "b32a201a140d65e5580d9f7e", {"k": 8, "crop": 0.6}),
    "ar_temple_rubble": ("rubble_1", 1, "7e98901167ae0c1fe5c4192c", {"k": 8, "crop": 0.6}),
    "ar_cave": ("cave_b_1", 1, "d77f7334f00433cd2ba84bf6", {"k": 8, "crop": 0.7}),
    "ar_wood_floor": ("wood_floor_1", 1, "74dce84e68e2b7185df9fb1e", {"k": 8, "crop": 0.6}),
    "ar_marble": ("marble_1", 1, "82314d361d4d6ee8c34571de", {"k": 8, "crop": 0.7}),
    "ar_lava": ("lava_1", 1, "55c34e8f98d5e00214d2871b", {"k": 9, "crop": 0.8}),
    "ar_ice": ("ice_b_2", 2, "523444fb9c5990188c0dd521", {"k": 8, "crop": 0.8}),
}
# derived materials: name -> (how, source material, args)
COLD_ROCK = (180, 0.15, 1.0)                    # hue, sat, val: grey rock (kit.RECOLORS["cold_rock"] for the peaks)
DERIVED = {
    "water_calm": ("rank", "water_calm_shallow", ("ar_ocean", 2, 5)),
    "mountain_cold": ("recolor", "ar_mountain", COLD_ROCK),
    "mountain_cold@b": ("recolor", "ar_mountain@b", COLD_ROCK),
    # the temple floors in the old temple kit's cool slate (hue 200, sat 0.3, val 0.3), so the dungeons' tuned
    # recolours (sea shrine, citadel, past, mirage, Bahamut) keep their look on the new stone
    "ar_temple_floor_cool": ("recolor", "ar_temple_floor", (141, 2.4, 0.75)),
    "ar_temple_rubble_cool": ("recolor", "ar_temple_rubble", (165, 2.45, 0.62)),
}
PARTS = {"ar_tree_clump": ("remap", "ar_forest"), "conifer_clump": ("conifer", "taiga")}


def _cached(key: str) -> Image.Image:
    p = CACHE / f"{key}.png"
    if not p.is_file():
        raise SystemExit(f"terrain_cut: render {key} is not in {CACHE} (copy it from the main checkout)")
    return Image.open(p)


def _tree_clump() -> Image.Image:
    sys.path.insert(0, str(HERE.parent / "tools"))
    import kit as K  # noqa: PLC0415
    return K.load_kit("overworld").part("tree_clump")


def materials() -> dict[str, np.ndarray]:
    out = {name: TP.tile(_cached(key), N, **kw) for name, (_, _, key, kw) in SPEC.items()}
    for name, (how, src, args) in DERIVED.items():
        if how == "rank":
            ref, lo, hi = args
            out[name] = TP.remap_rank(out[src], out[ref], lo, hi)
        else:
            out[name] = TP.recolor(out[src], *args)
    return out


def parts(mats: dict[str, np.ndarray]) -> dict[str, Image.Image]:
    res = {}
    for name, (how, src) in PARTS.items():
        res[name] = TP.remap_part(_tree_clump(), mats[src]) if how == "remap" else TP.conifer_clump(mats[src])
    return res


def build() -> tuple[Image.Image, dict]:
    mats = materials()
    prt = parts(mats)
    names = list(mats)
    rows = -(-len(names) // COLS)
    W, cell = COLS * N, 48
    sheet = Image.new("RGBA", (W, rows * N + cell), (0, 0, 0, 0))
    rects, sources, derived = {}, [], {}
    for i, n in enumerate(names):
        x, y = (i % COLS) * N, (i // COLS) * N
        sheet.paste(Image.fromarray(mats[n]).convert("RGBA"), (x, y))
        rects[n] = [x, y, N, N]
        colours = int(len(np.unique(mats[n].reshape(-1, 3), axis=0)))
        if n in SPEC:
            rid, seed, key, kw = SPEC[n]
            sources.append({"material": n, "render": rid, "model": MODEL, "seed": seed, "cache_key": key,
                            "settings": kw, "colours": colours})
        else:
            how, src, args = DERIVED[n]
            derived[n] = {"how": how, "from": src, "args": list(args), "colours": colours}
    cells = [[None] * (W // cell) for _ in range(rows * N // cell)] + [[None] * (W // cell)]
    for j, (n, im) in enumerate(prt.items()):
        sheet.alpha_composite(im, (j * cell, rows * N))
        cells[-1][j] = n
    meta = {"kit": "overworld", "sheet": "terrain_ar", "backend": "bedrock", "pass": "AR", "purpose": "ar_tiles",
            "approved": APPROVED, "tile": cell, "cells": cells, "materials": rects, "sources": sources, "derived": derived,
            "parts": {n: {"how": h, "from": s} for n, (h, s) in PARTS.items()},
            "note": "AR-T picks (user-approved 2026-11-21); AR-T2: calm river / lake water, lifted taiga, cold rock, "
                    "conifer clump. Re-cut by assets-src/gen/terrain_cut.py."}
    return sheet, meta


def _png(im: Image.Image) -> bytes:
    b = io.BytesIO()
    im.save(b, format="PNG", optimize=True)
    return b.getvalue()


def main(argv: list[str]) -> int:
    sheet, meta = build()
    text = json.dumps(meta, indent=1) + "\n"
    if "--check" in argv:
        old_png, old_json = OUT.with_suffix(".png"), OUT.with_suffix(".json")
        same = (old_json.is_file() and old_json.read_text() == text and old_png.is_file()
                and np.array_equal(np.asarray(Image.open(old_png).convert("RGBA")), np.asarray(sheet)))
        print("terrain_cut --check:", "OK" if same else "DIFFERS (run terrain_cut.py)")
        return 0 if same else 1
    sheet.save(OUT.with_suffix(".png"), optimize=True)
    OUT.with_suffix(".json").write_text(text)
    if "--native" in argv:
        d = Path(argv[argv.index("--native") + 1])
        d.mkdir(parents=True, exist_ok=True)
        for n, (x, y, w, h) in meta["materials"].items():
            sheet.crop((x, y, x + w, y + h)).save(d / f"{n}.png")
        for j, n in enumerate(meta["cells"][-1]):
            if n:
                sheet.crop((j * 48, sheet.height - 48, (j + 1) * 48, sheet.height)).save(d / f"part_{n}.png")
    print(f"terrain_cut: wrote {OUT.with_suffix('.png').relative_to(HERE.parent.parent)} "
          f"({len(meta['materials'])} materials, {sum(1 for n in meta['cells'][-1] if n)} parts)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

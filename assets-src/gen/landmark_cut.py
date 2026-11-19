"""Re-cut the approved Bedrock landmark icons (passes LM / LM2, and LM4) from the render cache into the kit sheets.

    python3 -I assets-src/gen/landmark_cut.py            # write approved/overworld/landmarks_lm{,4}.{png,json}
    python3 -I assets-src/gen/landmark_cut.py --check    # rebuild in memory, exit 1 if a committed sheet differs
    python3 -I assets-src/gen/landmark_cut.py --native DIR   # also write each icon at native size into DIR

No Bedrock or Gemini call: every render (and remove_bg result) is read from the content-addressed cache
assets-src/gen/cache/<key>.png; a missing key is an error. Model, seed and pass come from the tracked BR ledger.
The cells are named <name>_icon_<r>_<c> (48 px), the names kit.LANDMARKS gives them; kit.load_kit puts them over
the code-drawn placeholders in every kit. The cut is deterministic (seeded k-means, no hash order).
Two sheets: `landmarks_lm` (SPEC, the LM / LM2 picks, LM-INT) and `landmarks_lm4` (SPEC4, the LM4 picks, LM4-INT:
the town icons, the unique boats and the landmarks). LM4's Melmond and Onrac icons replace LM's 2x1 ones (the LM
renders stay in the cache: `town_melmond_ultra_a_2` a915ca48f390b339f9406ba1 and `town_onrac_ultra_a_2`
02b2da0c62a0affb86d1ef6c, both cut {"rim": 4}, {"fill": 0.9}).
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

from gen import bedrock as B  # noqa: E402
from gen import landmark_pix as LP  # noqa: E402

T = 48
OUT = HERE / "approved" / "overworld" / "landmarks_lm"
APPROVED = "2026-11-19"
SHEET_W = 16                                   # cells per sheet row (shelf packing in SPEC order)
# name: (pilot tag, render cache key, (cells wide, high), remove_bg?, cutout settings, pixelize settings, post)
SPEC = {
    "volcano": ("volcano_ultra_b_21", "3a63033a49d65f324f852e74", (3, 2), False,
                {"rim": 24, "smoke_y": 0.115}, {"apron": 0.15}, None),
    "buried_hull": ("buried_hull_ultra_d_42", "f0dad187220beca2c6552a2a", (3, 2), False,
                    {"rim": 6, "pocket": 5}, {"apron": 0.3}, None),
    "windmill": ("windmill_ultra_a_13", "dea2cc1542d91963ac1dc564", (2, 3), True,
                 {"soft_y": 0.76, "soft_alpha": 24}, {"apron": 0.1, "colors": 18, "edge_light": 0.2}, None),
    "cave_mouth": ("cave_mouth_ultra_a_12", "f463c668b21b92774d2feea3", (2, 2), True, {}, {"apron": 0.15}, "taupe"),
    "tower": ("tower_ultra_a_3", "80b1727353dc2fc7c3af6bf1", (2, 3), False, {"rim": 4, "green_y": 0.85}, {}, None),
    "shrine": ("shrine_ultra_a_3", "b3a0652919f92bc6660074d4", (2, 2), False,
               {"rim": 4, "green_y": 0.6}, {"apron": 0.15}, None),
    "dock_post": ("dock_post_ultra_a_3", "bd1f501d587eae6660ade39b", (1, 1), False, {"rim": 3}, {"apron": 0.15}, None),
    "sky_ring": ("sky_ring_ultra_b_4", "ae6cc0fa83fbbf2a377f630d", (2, 2), False,
                 {"rim": 4, "pocket": 7, "green_y": 0.7}, {"apron": 0.1}, None),
    "ice_floe": ("ice_floe_ultra_a_1", "eeddd7fe1e2492076ea6636f", (2, 2), False, {}, {}, None),
    "waterfall": ("waterfall_ultra_b_3", "992db99b04bffd7790c25e53", (2, 3), False, {}, {"apron": 0.1}, None),
    "tent": ("tent_ultra_a_1", "9f0bb0baf937c583bd57120c", (2, 2), False,
             {"rim": 4, "green_y": 0.8}, {"apron": 0.1}, None),
    "dome": ("dome_ultra_a_2", "a1c7267523a085f1ec616fa4", (2, 2), False, {"rim": 4, "green_y": 0.78}, {}, None),
    "tuft": ("tuft_ultra_a_2", "e1212c7b0403dcc3b0784843", (1, 1), False, {"rim": 3}, {}, None),
}
OUT4 = HERE / "approved" / "overworld" / "landmarks_lm4"
APPROVED4 = "2026-11-19"
R4, P4, Q4 = {"rim": 4}, {"fill": 0.95}, {"fill": 0.97, "apron": 0.12}      # LM4's review settings (run_sheet.py)
# LM4 (the user's picks, 2026-11-19), the same row shape as SPEC
SPEC4 = {
    "town_melmond": ("town_melmond_ultra_a_1", "709c3c99c3b59268d8f2c9b4", (4, 3), False, R4, Q4, None),
    "town_onrac": ("town_onrac_ultra_a_2", "d495d457c76fb08d332861f9", (5, 3), False, R4, {"fill": 0.97}, None),
    "town_pravoka": ("town_pravoka_ultra_a_3", "44ff0df3838561d243ffe09b", (3, 3), False,
                     {"rim": 4, "sea_y": 0.45, "drop": [[0.0, 0.69, 0.49, 1.0]]}, Q4, None),
    "town_elfheim": ("town_elfheim_ultra_a_3", "89d203e1f452094af4fde9dc", (3, 3), False, R4, Q4, None),
    "town_crescent": ("town_crescent_ultra_b_4", "62c1d000e031f2dcdca68c18", (3, 3), False, R4, Q4, None),
    "town_gaia": ("town_gaia_ultra_a_3", "47fb9c70bf664d435f608910", (3, 2), False, R4, Q4, None),
    "lufenia": ("lufenia_ultra_a_3", "d3fecf9be5789401cb7e4668", (4, 2), False, R4, {"fill": 0.97, "apron": 0.1}, None),
    "brig": ("brig_ultra_b_4", "58f156f5112d6d559d3c676c", (4, 3), False, R4, P4, None),
    "submarine": ("submarine_ultra_b_6", "739cea1ec20fc8eb089366ce", (4, 2), False, R4, P4, None),
    "fishing_boat": ("fishing_boat_ultra_a_3", "db9e0440ec808448a0ea3778", (3, 2), True, {}, P4, None),
    "bell_tower": ("bell_tower_ultra_a_2", "7427f3aca030b3112ef6454a", (2, 3), False, R4, {}, None),
    "lighthouse": ("lighthouse_ultra_a_3", "03de232e07f7214f74e33a7e", (2, 3), False, R4, {"apron": 0.1}, None),
    "mirage_tower": ("mirage_tower_ultra_a_1", "a3d09bb1fd1c99cb0159a424", (2, 3), False, R4, {"apron": 0.1}, None),
    "standing_stones": ("standing_stones_ultra_a_1", "4dedbe1adec5f94c29966260", (2, 2), False, R4, {"apron": 0.2},
                        None),
    "hermit_hut": ("hermit_hut_ultra_a_3", "a6c7cb7e75cc2b60f63cf20e", (2, 2), False, R4, {"apron": 0.15}, None),
}
NOTES = {
    "volcano": "LM-INT: the grey smoke over the crater is cut (smoke_y); the engine draws it (ambient smoke)",
    "windmill": "LM-INT: re-cut with its grass, path and bushes base, kept solid (soft_y alpha > soft_alpha, closed, "
                "holes filled); no outline round the bottom apron",
    "town_pravoka": "LM4-INT: re-cut bigger (3x3, user ruling 2026-11-19; LM4 reviewed it at 2x2): the painted sea "
                    "round the walls (sea_y) and the pier with its boat (drop) are cut away, the rock footing kept",
    "fishing_boat": "LM4: through remove_bg (it drops the render's white reflection on the water)",
}


def _cached(key: str) -> Image.Image:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"landmark_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; "
                         "this tool never calls Bedrock)")
    return Image.open(path)


def _ledger() -> dict[str, dict]:
    return {r["key"]: r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("key")}


def icon(name: str, spec: dict = SPEC, approved: str = APPROVED) -> tuple[Image.Image, dict]:
    tag, key, size, nobg, cut, px, post = spec[name]
    raw = _cached(key)
    meta = {"tag": tag, "cache_key": key, "cells": list(size)}
    nb = None
    if nobg:
        nkey = B.cache_key("remove_bg", {"image": B.png_b64(raw.convert("RGB")), "output_format": "png"})
        nb = _cached(nkey); meta["nobg_key"] = nkey
    rgb, fg = LP.cutout(raw, nb, **cut)
    im, fig = LP.pix(size, rgb, fg, **px)
    if post == "taupe":
        im = LP.hue_nudge(im)
    row = _ledger().get(key, {})
    meta.update({"model": row.get("model"), "seed": row.get("seed"), "pass": row.get("pass"),
                 "cut": {"mode": "remove_bg" if nobg else "flood", "tol": 28, **cut},
                 "pixelize": {"fill": 0.92, "colors": 14, "seed": 0, "sharpen": 1.0, "outline": "selective", **px},
                 "post": post, "fig_px": fig, "approved": approved})
    if name in NOTES:
        meta["note"] = NOTES[name]
    return im, meta


def build(spec: dict = SPEC, sheet_name: str = "landmarks_lm", approved: str = APPROVED,
          note: str | None = None) -> tuple[Image.Image, dict]:
    icons = {n: icon(n, spec, approved) for n in spec}
    shelves: list[list[str]] = [[]]
    used = 0
    for n in spec:                                   # shelf packing: rows of SHEET_W cells, each 3 cells high
        w = spec[n][2][0]
        if used + w > SHEET_W:
            shelves.append([]); used = 0
        shelves[-1].append(n); used += w
    shelf_h = max(s[2][1] for s in spec.values())
    sheet = Image.new("RGBA", (SHEET_W * T, len(shelves) * shelf_h * T), (0, 0, 0, 0))
    cells: list[list[str | None]] = [[None] * SHEET_W for _ in range(len(shelves) * shelf_h)]
    land = {}
    for si, shelf in enumerate(shelves):
        cx = 0
        for n in shelf:
            im, meta = icons[n]
            w, h = spec[n][2]
            r0 = si * shelf_h
            sheet.alpha_composite(im, (cx * T, r0 * T))
            for r in range(h):
                for c in range(w):
                    cells[r0 + r][cx + c] = f"{n}_icon_{r}_{c}"
            land[n] = {**meta, "at": [r0, cx]}
            cx += w
    meta = {"kit": "overworld", "sheet": sheet_name, "backend": "bedrock", "tool": "assets-src/gen/landmark_cut.py",
            "approved": approved, "tile": T, "cells": cells, "materials": {}, "landmarks": land,
            "note": note or ("LM-INT: the user's picks of passes LM / LM2 (Stability Ultra renders, the cave mouth "
                             "and the windmill through remove_bg), re-cut offline from the render cache")}
    return sheet, meta


NOTE4 = ("LM4-INT: the user's picks of pass LM4 (Stability Ultra renders, the fishing boat through remove_bg), re-cut "
         "offline from the render cache: the town icons of Melmond, Onrac, Pravoka, Elfheim, Crescent and Gaia, "
         "Lufenia's icon, the brig, submarine and fishing boat, and the bell tower, lighthouse, Mirage Tower, "
         "standing stones and hermit's hut")
SHEETS = {"landmarks_lm": (OUT, SPEC, APPROVED, None), "landmarks_lm4": (OUT4, SPEC4, APPROVED4, NOTE4)}


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=False); return buf.getvalue()


def main(argv: list[str]) -> int:
    bad = 0
    for sheet_name, (out, spec, approved, note) in SHEETS.items():
        sheet, meta = build(spec, sheet_name, approved, note)
        text = json.dumps(meta, indent=2) + "\n"
        if "--native" in argv:
            d = Path(argv[argv.index("--native") + 1]); d.mkdir(parents=True, exist_ok=True)
            for n in spec:
                r0, c0 = meta["landmarks"][n]["at"]; w, h = spec[n][2]
                sheet.crop((c0 * T, r0 * T, (c0 + w) * T, (r0 + h) * T)).save(d / f"{n}.png")
        if "--check" in argv:
            png, js = out.with_suffix(".png"), out.with_suffix(".json")
            same = (png.is_file() and js.is_file() and js.read_text() == text
                    and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), np.asarray(sheet)))
            print(f"landmark_cut: {sheet_name} OK (the committed sheet rebuilds)" if same
                  else f"landmark_cut: {sheet_name} DIFFERS")
            bad += not same
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.with_suffix(".png").write_bytes(_png_bytes(sheet))
        out.with_suffix(".json").write_text(text)
        print(f"landmark_cut: wrote {out.with_suffix('.png')} {sheet.size} ({len(spec)} landmarks)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

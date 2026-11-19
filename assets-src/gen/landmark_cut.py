"""Re-cut the approved Bedrock landmark icons (passes LM / LM2) from the render cache into one kit sheet.

    python3 -I assets-src/gen/landmark_cut.py            # write approved/overworld/landmarks_lm.{png,json}
    python3 -I assets-src/gen/landmark_cut.py --check    # rebuild in memory, exit 1 if the committed sheet differs
    python3 -I assets-src/gen/landmark_cut.py --native DIR   # also write each icon at native size into DIR

No Bedrock or Gemini call: every render (and remove_bg result) is read from the content-addressed cache
assets-src/gen/cache/<key>.png; a missing key is an error. Model, seed and pass come from the tracked BR ledger.
The cells are named <name>_icon_<r>_<c> (48 px), the names kit.LANDMARKS gives them; kit.load_kit puts them over
the code-drawn placeholders in every kit. The cut is deterministic (seeded k-means, no hash order).
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
    "town_melmond": ("town_melmond_ultra_a_2", "a915ca48f390b339f9406ba1", (2, 1), False,
                     {"rim": 4}, {"fill": 0.9}, None),
    "town_onrac": ("town_onrac_ultra_a_2", "02b2da0c62a0affb86d1ef6c", (2, 1), False, {"rim": 4}, {"fill": 0.9}, None),
}
NOTES = {
    "volcano": "LM-INT: the grey smoke over the crater is cut (smoke_y); the engine draws it (ambient smoke)",
    "windmill": "LM-INT: re-cut with its grass, path and bushes base, kept solid (soft_y alpha > soft_alpha, closed, "
                "holes filled); no outline round the bottom apron",
}


def _cached(key: str) -> Image.Image:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"landmark_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; "
                         "this tool never calls Bedrock)")
    return Image.open(path)


def _ledger() -> dict[str, dict]:
    return {r["key"]: r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("key")}


def icon(name: str) -> tuple[Image.Image, dict]:
    tag, key, size, nobg, cut, px, post = SPEC[name]
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
                 "post": post, "fig_px": fig, "approved": APPROVED})
    if name in NOTES:
        meta["note"] = NOTES[name]
    return im, meta


def build() -> tuple[Image.Image, dict]:
    icons = {n: icon(n) for n in SPEC}
    shelves: list[list[str]] = [[]]
    used = 0
    for n in SPEC:                                   # shelf packing: rows of SHEET_W cells, each 3 cells high
        w = SPEC[n][2][0]
        if used + w > SHEET_W:
            shelves.append([]); used = 0
        shelves[-1].append(n); used += w
    shelf_h = max(s[2][1] for s in SPEC.values())
    sheet = Image.new("RGBA", (SHEET_W * T, len(shelves) * shelf_h * T), (0, 0, 0, 0))
    cells: list[list[str | None]] = [[None] * SHEET_W for _ in range(len(shelves) * shelf_h)]
    land = {}
    for si, shelf in enumerate(shelves):
        cx = 0
        for n in shelf:
            im, meta = icons[n]
            w, h = SPEC[n][2]
            r0 = si * shelf_h
            sheet.alpha_composite(im, (cx * T, r0 * T))
            for r in range(h):
                for c in range(w):
                    cells[r0 + r][cx + c] = f"{n}_icon_{r}_{c}"
            land[n] = {**meta, "at": [r0, cx]}
            cx += w
    meta = {"kit": "overworld", "sheet": "landmarks_lm", "backend": "bedrock", "tool": "assets-src/gen/landmark_cut.py",
            "approved": APPROVED, "tile": T, "cells": cells, "materials": {}, "landmarks": land,
            "note": "LM-INT: the user's picks of passes LM / LM2 (Stability Ultra renders, the cave mouth and the "
                    "windmill through remove_bg), re-cut offline from the render cache"}
    return sheet, meta


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=False); return buf.getvalue()


def main(argv: list[str]) -> int:
    sheet, meta = build()
    text = json.dumps(meta, indent=2) + "\n"
    if "--native" in argv:
        d = Path(argv[argv.index("--native") + 1]); d.mkdir(parents=True, exist_ok=True)
        for n in SPEC:
            r0, c0 = meta["landmarks"][n]["at"]; w, h = SPEC[n][2]
            sheet.crop((c0 * T, r0 * T, (c0 + w) * T, (r0 + h) * T)).save(d / f"{n}.png")
    if "--check" in argv:
        png, js = OUT.with_suffix(".png"), OUT.with_suffix(".json")
        same = (png.is_file() and js.is_file() and js.read_text() == text
                and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), np.asarray(sheet)))
        print("landmark_cut: OK (the committed sheet rebuilds)" if same else "landmark_cut: DIFFERS")
        return 0 if same else 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.with_suffix(".png").write_bytes(_png_bytes(sheet))
    OUT.with_suffix(".json").write_text(text)
    print(f"landmark_cut: wrote {OUT.with_suffix('.png')} {sheet.size} ({len(SPEC)} landmarks)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""Re-cut the approved town-theme cells (pass AR, docs/TOWN_THEMES.md) from the render cache into the town kit.

    python3 -I assets-src/gen/town_theme_cut.py              # write approved/town/theme_<town>.{png,json}
    python3 -I assets-src/gen/town_theme_cut.py --check      # rebuild in memory, exit 1 if a committed sheet differs
    python3 -I assets-src/gen/town_theme_cut.py --native DIR # also write each sheet's pieces at x2 into DIR

No Bedrock or Gemini call: every render is read from the content-addressed cache assets-src/gen/cache/<key>.png (copy
it from the main checkout into a worktree; a missing key is an error). Model, seed and pass come from the tracked BR
ledger; the strengths and cut settings from town_theme_spec.py. The sheets load into every map that lists the `town`
kit: cells <part>@<theme> (build_map.styled: roof=<theme> / wall=<theme>), prefab and deco cells <name>_<r>_<c>,
`chimney@<theme>` and materials (`cre_bridge_v`, `dwf_wall`). The cut is deterministic.
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
from gen import town_theme_pix as P  # noqa: E402
from gen.town_theme_spec import TOWNS  # noqa: E402

T = P.T
OUT = HERE / "approved" / "town"
APPROVED = "2026-11-21"
COLS = 16
NOTE = ("AR-W2: the user's approved town theme of {town} (rulings 2026-11-21, docs/TOWN_THEMES.md; concept art in "
        "docs/art/town_themes/), Stability renders (SD3.5 image-to-image on grid guides, Ultra sprites) re-cut "
        "offline from the render cache")


def _cached(key: str) -> Image.Image:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"town_theme_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; "
                         "this tool never calls Bedrock)")
    return Image.open(path)


def _ledger() -> dict[str, dict]:
    return {r["key"]: r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("key")}


def _whole(im: Image.Image, name: str) -> dict[str, Image.Image]:
    w, h = im.width // T, im.height // T
    return {f"{name}_{r}_{c}": im.crop((c * T, r * T, (c + 1) * T, (r + 1) * T)) for r in range(h) for c in range(w)}


def _sprite_cells(name: str, im: Image.Image) -> dict[str, Image.Image]:
    return {name: im} if "@" in name else _whole(im, name)


def cut_town(town: str) -> tuple[dict[str, Image.Image], dict[str, np.ndarray], list[dict]]:
    sp = TOWNS[town]
    cells: dict[str, Image.Image] = {}
    mats: dict[str, np.ndarray] = {}
    src: list[dict] = []
    led = _ledger()

    def source(rid, key, use, **kw):
        row = led.get(key, {})
        src.append({"id": rid, "cache_key": key, "model": row.get("model"), "seed": row.get("seed"),
                    "pass": row.get("pass"), "use": use, **kw})

    theme = sp.get("theme")
    if sp.get("house"):
        rid, key, strength, opt = sp["house"]
        house = P.module(_cached(key), 5, 5)
        cells |= P.cells(house, theme, crops=opt.get("crops"), plain_band=opt.get("plain_band"))
        for part, (prid, pkey, w, h, col, row) in (sp.get("patch") or {}).items():
            pim = P.module(_cached(pkey), w, h)
            cells[f"{part}@{theme}"] = pim.crop((col * T, row * T, (col + 1) * T, (row + 1) * T))
        if opt.get("flat_roof"):
            cells |= P.flat_roof(cells, theme, opt["flat_roof"], opt["cornice_y"])
        for new, hsv in sp.get("tints", {}).items():
            cells |= P.tint(cells, theme, new, hsv, opt.get("tint_ref", "wall_lo_plain"))
        source(rid, key, f"house modules @{theme}", strength=strength, guide="5x5, 2 storeys, roof rows 2",
               cut={"colors": 20, "tol": 24, "sharpen": 0.6, **opt}, tints=sp.get("tints", {}))
    for name, rid, key, strength, (w, h), one in sp.get("grids", []):
        im = P.module(_cached(key), w, h)
        if one:
            cells |= _whole(im, f"{name}5") | _whole(P.one_storey(im), f"{name}4")
        else:
            cells |= _whole(im, name)
        source(rid, key, f"grid cut {name} {w}x{h}" + (" (+ 5x4)" if one else ""), strength=strength,
               cut={"colors": 20, "tol": 24, "sharpen": 0.6})
    for name, rid, key, size, cut, px in sp.get("sprites", []):
        cells |= _sprite_cells(name, P.sprite(_cached(key), size, cut, px))
        source(rid, key, f"sprite {name} {size[0]}x{size[1]}", cut={"rim": 4, **cut}, pixelize={"fill": 0.95,
               "colors": 16, **px})
    for rid, key, items, cut in sp.get("props", []):
        figs = P.split(_cached(key), len(items))
        if len(figs) != len(items):
            raise SystemExit(f"town_theme_cut: {rid} split into {len(figs)} figures, want {len(items)}")
        for (name, size), fig in zip(items, figs):
            cells |= _sprite_cells(name, P.sprite(fig, size, cut))
        source(rid, key, "props " + ", ".join(f"{n} {s[0]}x{s[1]}" for n, s in items), cut={"rim": 4, **cut})
    for name, rid, key, kind, opt in sp.get("mats", []):
        raw = _cached(key)
        if kind == "deck":                    # bridge_v: 2 cells across (parapet bands a quarter each), 2 along
            w, h = opt["cells"]
            deck = P.module(raw, w, h).convert("RGB")
            mats[name] = P.seamless(deck.crop((0, T, w * T, 3 * T)), w * T, 2 * T, 16, wrap_x=False)
        else:
            x0, y0, x1, y1 = opt["box"]
            mats[name] = P.seamless(raw.crop((round(x0 * raw.width), round(y0 * raw.height),
                                              round(x1 * raw.width), round(y1 * raw.height))), 96, 96, 16)
        source(rid, key, f"material {name} ({kind})", **opt)
    return cells, mats, src


def build(town: str) -> tuple[Image.Image, dict]:
    cells, mats, src = cut_town(town)
    names = sorted(cells)
    rows = (len(names) + COLS - 1) // COLS
    mat_h = 2 * T if mats else 0
    sheet = Image.new("RGBA", (COLS * T, rows * T + mat_h), (0, 0, 0, 0))
    grid: list[list[str | None]] = [[None] * COLS for _ in range(rows)]
    for i, n in enumerate(names):
        sheet.alpha_composite(cells[n].convert("RGBA"), ((i % COLS) * T, (i // COLS) * T))
        grid[i // COLS][i % COLS] = n
    mat_box, x = {}, 0
    for n, m in mats.items():
        sheet.paste(Image.fromarray(m).convert("RGBA"), (x, rows * T))
        mat_box[n] = [x, rows * T, m.shape[1], m.shape[0]]
        x += m.shape[1]
    meta = {"kit": "town", "sheet": f"theme_{town}", "backend": "bedrock", "tool": "assets-src/gen/town_theme_cut.py",
            "approved": APPROVED, "theme": TOWNS[town].get("theme"), "tints": sorted(TOWNS[town].get("tints", {})),
            "roofs": [r for r in [(TOWNS[town].get("house") or (0, 0, 0, {}))[3].get("flat_roof")] if r],
            "tile": T, "cells": grid, "materials": mat_box, "sources": src, "note": NOTE.format(town=town)}
    return sheet, meta


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=False)
    return buf.getvalue()


def main(argv: list[str]) -> int:
    bad = 0
    for town in TOWNS:
        sheet, meta = build(town)
        out = OUT / f"theme_{town}"
        text = json.dumps(meta, indent=1) + "\n"
        if "--native" in argv:
            d = Path(argv[argv.index("--native") + 1])
            d.mkdir(parents=True, exist_ok=True)
            sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(d / f"theme_{town}_x2.png")
        if "--check" in argv:
            png, js = out.with_suffix(".png"), out.with_suffix(".json")
            same = (png.is_file() and js.is_file() and js.read_text() == text
                    and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), np.asarray(sheet)))
            print(f"town_theme_cut: theme_{town} " + ("OK (the committed sheet rebuilds)" if same else "DIFFERS"))
            bad += not same
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.with_suffix(".png").write_bytes(_png_bytes(sheet))
        out.with_suffix(".json").write_text(text)
        print(f"town_theme_cut: wrote {out.with_suffix('.png')} {sheet.size} ({sum(map(bool, sum(meta['cells'], [])))}"
              f" cells, {len(meta['materials'])} materials)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

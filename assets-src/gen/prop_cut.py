"""Re-cut the approved Bedrock dungeon props (art pass AR, streams AR-P / AR-P2) from the render cache into a kit sheet.

    python3 -I assets-src/gen/prop_cut.py            # write approved/dungeon/props_ar.{png,json}
    python3 -I assets-src/gen/prop_cut.py --check    # rebuild in memory, exit 1 if the committed sheet differs
    python3 -I assets-src/gen/prop_cut.py --native DIR   # also write each prop at native size into DIR

No Bedrock or Gemini call: every render is read from the content-addressed cache assets-src/gen/cache/<key>.png; a
missing key is an error. Model, seed and pass come from the tracked BR ledger. Each render is a 2x2 grid of variants
of one prop; `objects` splits it into its figures (reading order) and SPEC names the one picked. The cut is the
landmark pipeline (gen/landmark_pix.py `clean`, `pix`): 48 px cells, a 15-bit k-means palette, binary alpha, a
selective outline, bottom aligned. Cells are named ar_<id>_<r>_<c>; tools/kit_props.py loads them into every kit.

A lit prop also gets its `flame`: the flame pixels (hue window, saturated and bright, inside the prop's flame rect, so
a face, a post or a panel never flickers) as rows of ramp levels '1'-'4' ('.' none), their top-left in prop px, the
style, whether the top quarter (the tongue) drops out, and the glow radius. The map compiler copies it into the
`flame` ambient entries (build_hooks.ambient); src/scenes/exploration/flame/ draws it.
"""
from __future__ import annotations

import colorsys
import io
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

from gen import bedrock as B  # noqa: E402
from gen import landmark_pix as LP  # noqa: E402
from gen.pixelize import components, flood_bg  # noqa: E402

T = 48
OUT = HERE / "approved" / "dungeon" / "props_ar"
APPROVED = "2026-11-21"
SHEET_W = 16
RECORD = ("approved", "purpose")   # pass CD (docs/CARDIA_PLAN.md 6.1): options written to the prop's record, not its cut
from gen.prop_spec import FLAME, HUES, SPEC, SPLIT  # noqa: E402,F401


def objects(raw, tol=30, rim=4, min_frac=0.004, join=3, split=0):
    """The figures of a render (AR-P's cut, byte for byte): flood the white background, clean the sticker rim, join
    nearby pieces at 1/4 scale, keep components of at least min_frac; reading order (rows of ~1/4 image)."""
    rgb = np.asarray(raw.convert("RGB"))
    fg = ~flood_bg(rgb, tol)
    fg = LP.clean(rgb, fg, rim=rim, pocket=6, pocket_min=238)
    if split:
        W = fg.shape[1]; out = []
        for k in range(split):
            part = fg.copy(); part[:, :int(k * W / split)] = False; part[:, int((k + 1) * W / split):] = False
            out.append(part)
        return rgb, out
    sm = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).resize((256, 256), Image.BOX)) > 20
    sm = np.asarray(Image.fromarray((sm * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * join + 1))) > 0
    lab, n = components(sm)
    objs = []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < min_frac * m.size * 8:
            continue
        big = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(fg.shape[::-1], Image.NEAREST)) > 0
        part = fg & big
        ys, xs = np.where(part)
        if len(ys) < 400:
            continue
        objs.append((ys.mean(), xs.mean(), part))
    objs.sort(key=lambda o: (round(o[0] / 256), o[1]))
    return rgb, [o[2] for o in objs]


def _cached(key: str) -> Image.Image:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"prop_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; this "
                         "tool never calls Bedrock)")
    return Image.open(path)


def flame(pid: str, im: Image.Image) -> dict | None:
    """The flame of lit prop `pid` on its native art: rows of ramp levels by brightness quartile."""
    if pid not in FLAME:
        return None
    style, rect, tongue, glow = FLAME[pid]
    a = np.asarray(im).astype(int)
    ys, xs = np.where(a[..., 3] > 0); fy, fx = ys.min(), xs.min(); H, W = ys.max() + 1 - fy, xs.max() + 1 - fx
    lo, hi = HUES[style]; vmin = 0.8 if style == "fire" else 0.62
    pts = []
    for y, x in zip(*np.where(a[..., 3] > 0)):
        if not (rect[0] * W <= x - fx < rect[2] * W and rect[1] * H <= y - fy < rect[3] * H):
            continue
        h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255))
        if s > 0.5 and v > vmin and lo <= h * 360 <= hi:
            pts.append((int(y), int(x), v))
    if not pts:
        raise SystemExit(f"prop_cut: {pid} has no flame pixels in its rect")
    vals = sorted(p[2] for p in pts)
    x0, x1 = min(p[1] for p in pts), max(p[1] for p in pts); y0, y1 = min(p[0] for p in pts), max(p[0] for p in pts)
    rows = [["."] * (x1 - x0 + 1) for _ in range(y1 - y0 + 1)]
    for y, x, v in pts:
        rows[y - y0][x - x0] = str(1 + min(3, int(np.searchsorted(vals, v) / len(vals) * 4)))
    return {"style": style, "x": x0, "y": y0, "rows": ["".join(r) for r in rows], "tongue": tongue, "glow": glow,
            "rect": rect}


def prop(pid: str, ledger: dict) -> tuple[Image.Image, dict]:
    tag, key, n, size, place, o = SPEC[pid]
    rgb, objs = objects(_cached(key), split=SPLIT.get(tag, 0))
    part = objs[n]
    if o.get("clean"):
        part = LP.clean(rgb, part, **o["clean"])
    if o.get("web"):                                    # the pale threads only (a black-ground render)
        part = part & (rgb.mean(2) > 110) & ((rgb.max(2) - rgb.min(2)) < 40)
    im, fig = LP.pix(size, rgb, part, fill=o.get("fill", 0.9))
    row = ledger.get(key, {})
    meta = {"tag": tag, "cache_key": key, "object": n, "cells": list(size), "place": place,
            "model": row.get("model"), "seed": row.get("seed"), "pass": row.get("pass"),
            "cut": {"mode": "flood", "tol": 30, "rim": 4, "pocket": 6, "join": 3, "split": SPLIT.get(tag, 0),
                    **{k: v for k, v in o.items() if k not in ("fill", *RECORD)}},
            "pixelize": {"fill": o.get("fill", 0.9), "colors": 14, "seed": 0, "sharpen": 1.0, "outline": "selective",
                         "apron": 0.0},
            "fig_px": fig, "approved": o.get("approved", APPROVED)}
    if "purpose" in o:                                  # pass CD: a prop approved later, under another purpose
        meta["purpose"] = o["purpose"]
    fl = flame(pid, im)
    if fl:
        meta["flame"] = fl
    return im, meta


def build() -> tuple[Image.Image, dict]:
    ledger = {r["key"]: r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("key")}
    shelves: list[list[str]] = [[]]
    used = 0
    for pid in SPEC:                                  # shelf packing: rows of SHEET_W cells, each 2 cells high
        w = SPEC[pid][3][0]
        if used + w > SHEET_W:
            shelves.append([]); used = 0
        shelves[-1].append(pid); used += w
    sh = 2
    sheet = Image.new("RGBA", (SHEET_W * T, len(shelves) * sh * T), (0, 0, 0, 0))
    cells: list[list[str | None]] = [[None] * SHEET_W for _ in range(len(shelves) * sh)]
    props = {}
    for si, shelf in enumerate(shelves):
        cx = 0
        for pid in shelf:
            im, meta = prop(pid, ledger)
            w, h = SPEC[pid][3]
            r0 = si * sh
            sheet.alpha_composite(im, (cx * T, r0 * T))
            for r in range(h):
                for c in range(w):
                    cells[r0 + r][cx + c] = f"ar_{pid}_{r}_{c}"
            props[pid] = {**meta, "at": [r0, cx]}
            cx += w
    meta = {"kit": "dungeon", "sheet": "props_ar", "backend": "bedrock", "tool": "assets-src/gen/prop_cut.py",
            "approved": APPROVED, "tile": T, "cells": cells, "materials": {}, "props": props,
            "note": ("AR-P2: the dungeon props of art pass AR (Stability Ultra renders, 2x2 variant grids, purpose "
                     "ar_props), re-cut offline from the render cache: AR-P's usable picks plus the AR-P2 re-rolls of "
                     "the wall torch (a sconce on stone) and the cobweb (thick threads); user rulings 2026-11-21")}
    return sheet, meta


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=False); return buf.getvalue()


def main(argv: list[str]) -> int:
    sheet, meta = build()
    text = json.dumps(meta, indent=2) + "\n"
    if "--native" in argv:
        d = Path(argv[argv.index("--native") + 1]); d.mkdir(parents=True, exist_ok=True)
        for pid, p in meta["props"].items():
            (r0, c0), (w, h) = p["at"], p["cells"]
            sheet.crop((c0 * T, r0 * T, (c0 + w) * T, (r0 + h) * T)).save(d / f"{pid}.png")
    if "--check" in argv:
        png, js = OUT.with_suffix(".png"), OUT.with_suffix(".json")
        same = (png.is_file() and js.is_file() and js.read_text() == text
                and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), np.asarray(sheet)))
        print("prop_cut: props_ar OK (the committed sheet rebuilds)" if same else "prop_cut: props_ar DIFFERS")
        return 0 if same else 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.with_suffix(".png").write_bytes(_png_bytes(sheet))
    OUT.with_suffix(".json").write_text(text)
    print(f"prop_cut: wrote {OUT.with_suffix('.png')} {sheet.size} ({len(SPEC)} props)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

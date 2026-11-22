"""Re-cut the approved Bedrock NPC field sheets (pass LM5: the fairy and the mermaid; pass AR: the Lufenians, the
dragon-kin, the robot sentry, the Circle sages and Dr. Unne) from the render cache.

    python3 -I assets-src/gen/npc_field_cut.py            # write approved/<id>/field.{png,json}
    python3 -I assets-src/gen/npc_field_cut.py --check    # rebuild in memory, exit 1 if a committed sheet differs
    python3 -I assets-src/gen/npc_field_cut.py --raw DIR  # also write each sheet before its post step (review)

No Bedrock or Gemini call: every render is read from the content-addressed cache assets-src/gen/cache/<key>.png (a
missing key is an error); model, seed and pass come from the tracked BR ledger. The renders are Stability
control-structure 3x3 sheets (rows: facing the viewer, from behind, side view facing right) or a 3x1 back strip;
each cell is cut to a native 48x96 field cell with the feet on row 93 (LM5's sheetcut.py, kept byte for byte), the
rows of one sheet share one 16-colour 15-bit palette, and a 1 px selective outline is drawn round each figure. The
sheet is the approve.py field layout (rows down, up, left; the side row is drawn facing right, so `flip_rows`).
Post steps (LM5-INT, the user's rulings of 2026-11-19):
  fairy    `scale` 2/3: each render cell is pixelized at 32x64 instead of 48x96 (about 60 of the hero's 90 px drawn),
           then outlined and centred in the 48x96 cell, feet on row 93; the down row's step_right is its step_left
           mirrored (the render's step_right is a stand)
  mermaid  the back row (a separate render, btail60_2) has greener hair and tail: each of its green colours that the
           down and side rows do not use is remapped to the down / side teal ramp colour of the nearest value
Pass AR entries (`npc_field_ar.AR_SPEC`, merged into SPEC) use per-cell picks with mirror flags, per-row hue shifts,
per-render flood tolerance and hole cuts, and offline edit steps (erase, ramp recolour, pixel patch): the format is
in `npc_field_edit.py`. `--only id[,id]` limits a run to some ids.
The cut is deterministic (seeded k-means, no hash order).
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
from gen.npc_field_ar import APPROVED_AR, AR_SPEC  # noqa: E402
from gen.pixelize import OUTLINE, components, flood_bg, kmeans, snap15  # noqa: E402

GW, GH, FOOT = 48, 96, 93
ERODE = 7
APPROVED = "2026-11-19"
# id: rows [(render tag, cache key, rows in the render, row used)] for down, up, side; colours; post steps
SPEC = {
    "fairy": {"rows": [("fairy_structure_swing55_1", "7a81ff15eca2448660a33f56", 3, r) for r in range(3)],
              "colors": 16, "scale": 2 / 3, "mirror_step": "down",
              "note": "LM5 fairy_A (winged guide, control strength 0.55, seed 1); LM5-INT: drawn at 2/3 of the "
                      "hero's height (cells pixelized at 32x64), the down row's step_right = its step_left mirrored"},
    "mermaid": {"rows": [("mermaid_structure_stail60_1", "8b6fc3f777b5f682a1d0dd75", 3, 0),
                         ("mermaid_structure_btail60_2", "29148efc7c6f4be2535f594a", 1, 0),
                         ("mermaid_structure_stail60_1", "8b6fc3f777b5f682a1d0dd75", 3, 2)],
                "colors": 16, "recolor_up": True,
                "note": "LM5 mermaid_A (tail guide, control strength 0.6, seed 1: down and side; the back row from "
                        "the back-strip render btail60_2, seed 2); LM5-INT: the back row's greens remapped onto "
                        "the down / side teal ramp (nearest value)"},
}
SPEC.update(AR_SPEC)


def _cached(key: str) -> Image.Image:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"npc_field_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; "
                         "this tool never calls Bedrock)")
    return Image.open(path)


def _ledger() -> dict[str, dict]:
    return {r["key"]: r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("key")}


# ───────── LM5's sheetcut (scratch ~/temp/ff-game/lm5/scripts/sheetcut.py), kept byte for byte ─────────
def cell_masks(raw, rows, tol=14):
    rgb = np.asarray(raw.convert('RGB')); fg = ~flood_bg(rgb, tol)
    fg = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(ERODE))) > 127
    H, W = fg.shape; ch, cw = H // rows, W // 3
    out = []
    for r in range(rows):
        for c in range(3):
            m = np.zeros_like(fg); sub = fg[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            lab, n = components(sub)
            if n:
                sizes = np.bincount(lab.ravel())[1:]; big = sizes.argmax() + 1
                keep = lab == big
                ys, xs = np.where(keep); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
                for i, s in enumerate(sizes, 1):      # attached-looking pieces inside the figure box (wing tips)
                    if i != big and s >= 0.01 * sizes.max():
                        yy, xx = np.where(lab == i)
                        if yy.min() >= y0 and yy.max() <= y1 + 4 and xx.min() >= x0 - 4 and xx.max() <= x1 + 4:
                            keep |= lab == i
                m[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] = keep
            out.append((r, c, m))
    return rgb, out, ch, cw


def down(rgb, m, box, size):
    x0, y0, x1, y1 = box
    rgba = np.dstack([rgb[y0:y1, x0:x1], m[y0:y1, x0:x1] * 255]).astype(np.float32)
    rgba[..., :3] *= rgba[..., 3:4] / 255
    sm = np.asarray(Image.fromarray(rgba.astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    a = sm[..., 3]; col = np.where(a[..., None] > 0, sm[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
    col = np.asarray(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(
        ImageFilter.UnsharpMask(1, 60, 2))).astype(np.float32)
    return col, a > 170


def frames(raw, rows, scale=1.0):
    rgb, cells, ch, cw = cell_masks(raw, rows)
    size = (round(GW * scale), round(GH * scale))
    return [down(rgb, m, (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch), size) for r, c, m in cells]


def quantize(frs, colors=16, seed=0):
    px = np.concatenate([c[s] for c, s in frs])
    rng = np.random.default_rng(seed)
    cent = snap15(kmeans(px[rng.choice(len(px), min(len(px), 20000), replace=False)], colors, seed=seed)).astype(np.float32)
    res = []
    for col, solid in frs:
        h, w = solid.shape
        q = np.zeros((h, w, 4), np.uint8)
        lab = ((col[solid][:, None] - cent[None]) ** 2).sum(-1).argmin(1)
        q[solid, :3] = cent[lab]; q[solid, 3] = 255
        al = q[..., 3] > 0                     # lone pixels (speckle): drop isolated alpha pixels
        nb = np.zeros_like(al, np.int8)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb += np.roll(np.roll(al, dy, 0), dx, 1)
        q[al & (nb == 0)] = 0
        res.append(outline(q))
    return res


def outline(q):
    al = q[..., 3] > 0
    ring = np.zeros_like(al)
    ring[1:] |= al[:-1]; ring[:-1] |= al[1:]; ring[:, 1:] |= al[:, :-1]; ring[:, :-1] |= al[:, 1:]
    ring &= ~al
    src = np.zeros(q.shape[:2] + (3,), np.float32); cnt = np.zeros(al.shape, np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(q, dy, 0), dx, 1); mm = sh[..., 3] > 0
        src += sh[..., :3] * mm[..., None]; cnt += mm
    oc = snap15(src / np.maximum(cnt[..., None], 1) * 0.2 + np.array(OUTLINE) * 0.7)
    q = q.copy(); q[ring, :3] = oc[ring]; q[ring, 3] = 255
    return q


def place(q):
    """bottom of the figure on FOOT, centred in the 48x96 cell (a scaled cell is padded first)."""
    h, w = q.shape[:2]
    if (h, w) != (GH, GW):
        pad = np.zeros((GH, GW, 4), np.uint8)
        x0 = (GW - w) // 2
        pad[GH - h:, x0:x0 + w] = q
        q = pad
    ys = np.where(q[..., 3].any(1))[0]
    dy = FOOT - ys.max()
    out = np.zeros_like(q)
    if dy >= 0:
        out[dy:] = q[:GH - dy]
    else:
        out[:GH + dy] = q[-dy:]
    return Image.fromarray(out)


# ───────── LM5-INT post steps ─────────
def _hsv(c) -> tuple[float, float, float]:
    h, s, v = colorsys.rgb_to_hsv(*(np.asarray(c, np.float64) / 255))
    return h * 360, s, v


def green(c) -> bool:
    h, s, v = _hsv(c)
    return 90 <= h <= 200 and s > 0.3 and v > 0.1


def recolor_row(sheet: Image.Image, row: int, ref_rows: tuple[int, ...], share: float = 0.01) -> tuple[Image.Image, dict]:
    """Each green colour of `row` that the reference rows hardly use (under `share` of their pixels: the sheet's one
    palette spreads every colour a little into every row) -> the reference rows' green colour of the nearest value
    (ties: the nearer saturation). Returns the sheet and the map {src hex: dst hex}."""
    a = np.asarray(sheet).copy()
    px = np.concatenate([a[r * GH:(r + 1) * GH][a[r * GH:(r + 1) * GH][..., 3] > 0][:, :3] for r in ref_rows])
    cols, counts = np.unique(px, axis=0, return_counts=True)
    ref = {tuple(int(v) for v in c) for c, n in zip(cols, counts) if n >= share * len(px)}
    ramp = sorted(c for c in ref if green(c))
    band = a[row * GH:(row + 1) * GH]
    used = sorted({tuple(int(v) for v in c) for c in band[band[..., 3] > 0][:, :3]})
    remap = {}
    for c in used:
        if c in ref or not green(c):
            continue
        _, s, v = _hsv(c)
        remap[c] = min(ramp, key=lambda d: (abs(_hsv(d)[2] - v), abs(_hsv(d)[1] - s), d))
    for src, dst in remap.items():
        m = (band[..., 3] > 0) & np.all(band[..., :3] == src, axis=-1)
        band[m, :3] = dst
    a[row * GH:(row + 1) * GH] = band
    hexs = lambda c: "#%02x%02x%02x" % c  # noqa: E731
    return Image.fromarray(a), {hexs(s): hexs(d) for s, d in remap.items()}


def sheet(cid: str) -> tuple[Image.Image, Image.Image, dict]:
    """(the sheet before its post recolour, the approved sheet, meta)."""
    spec = SPEC[cid]
    if "cells" in spec:
        return sheet_cells(cid)
    scale = spec.get("scale", 1.0)
    picked = []
    for _tag, key, rows, ri in spec["rows"]:
        fr = frames(_cached(key), rows, scale); picked += fr[ri * 3:ri * 3 + 3]
    q = quantize(picked, spec["colors"])
    out = Image.new("RGBA", (3 * GW, 3 * GH))
    for i, f in enumerate(q):
        out.alpha_composite(place(f), ((i % 3) * GW, (i // 3) * GH))
    if spec.get("mirror_step"):
        r = ["down", "up", "left"].index(spec["mirror_step"])
        out.paste(out.crop((GW, r * GH, 2 * GW, (r + 1) * GH)).transpose(Image.Transpose.FLIP_LEFT_RIGHT),
                  (2 * GW, r * GH))
    before = out.copy()
    remap = {}
    if spec.get("recolor_up"):
        out, remap = recolor_row(out, 1, (0, 2))
    led = _ledger()
    srcs = []
    for tag, key, rows, ri in spec["rows"]:
        row = led.get(key, {})
        src = {"tag": tag, "cache_key": key, "model": row.get("model"), "seed": row.get("seed"),
               "pass": row.get("pass"), "render_rows": rows, "row": ri}
        if src not in srcs:
            srcs.append(src)
    first = srcs[0]
    a = np.asarray(out)[..., 3] > 0
    heights = [int(np.ptp(np.where(a[r * GH:(r + 1) * GH, c * GW:(c + 1) * GW].any(1))[0]) + 1)
               for r in range(3) for c in range(3)]
    meta = {"character": cid, "sheet": "field", "backend": "bedrock", "model": first["model"], "seed": first["seed"],
            "cache_key": first["cache_key"], "pass": first["pass"], "approved": APPROVED,
            "tool": "assets-src/gen/npc_field_cut.py", "sources": srcs,
            "cut": {"flood_tol": 14, "erode": ERODE, "resample": "box", "sharpen": "unsharp 1/60/2", "alpha": 170,
                    "colors": spec["colors"], "kmeans_seed": 0, "outline": "selective 1 px",
                    "scale": round(scale, 4)},
            "post": {k: spec[k] for k in ("mirror_step",) if k in spec} | ({"recolor_up": remap} if remap else {}),
            "figure_px": heights,
            "grid": [GW, GH], "bottom_row": FOOT, "layout": [3, 3], "rows": ["down", "up", "left"],
            "frames": ["stand", "step_left", "step_right"], "flip_rows": ["left"], "note": spec["note"]}
    return before, out, meta


def _figure_px(im: Image.Image) -> list[int]:
    a = np.asarray(im)[..., 3] > 0
    return [int(np.ptp(np.where(a[r * GH:(r + 1) * GH, c * GW:(c + 1) * GW].any(1))[0]) + 1)
            for r in range(3) for c in range(3)]


def sheet_cells(cid: str) -> tuple[Image.Image, Image.Image, dict]:
    """A pass-AR `cells` entry: (the sheet before its edits, the approved sheet, meta)."""
    from gen import npc_field_edit as E
    spec = SPEC[cid]
    before, out, log = E.build(sys.modules[__name__], spec)
    led = _ledger()
    srcs = []
    for alias, (tag, key, rows) in spec["renders"].items():
        row = led.get(key, {})
        srcs.append({"alias": alias, "tag": tag, "cache_key": key, "model": row.get("model"), "seed": row.get("seed"),
                     "pass": row.get("pass"), "render_rows": rows} | ({"cut": spec["cut"][alias]}
                                                                       if alias in spec.get("cut", {}) else {}))
    first = srcs[0]
    meta = {"character": cid, "sheet": "field", "backend": "bedrock", "model": first["model"], "seed": first["seed"],
            "cache_key": first["cache_key"], "pass": first["pass"], "approved": APPROVED_AR,
            "tool": "assets-src/gen/npc_field_cut.py", "sources": srcs,
            "cut": {"flood_tol": 14, "erode": ERODE, "resample": "box", "sharpen": "unsharp 1/60/2", "alpha": 170,
                    "colors": spec.get("colors", 16), "kmeans_seed": 0, "outline": "selective 1 px", "scale": 1.0,
                    "hole_min_px": E.HOLE_MIN},
            "cells": spec["cells"], "shifts": {str(k): v for k, v in spec.get("shifts", {}).items()},
            "edits": log, "figure_px": _figure_px(out),
            "grid": [GW, GH], "bottom_row": FOOT, "layout": [3, 3], "rows": ["down", "up", "left"],
            "frames": ["stand", "step_left", "step_right"], "flip_rows": ["left"], "note": spec["note"]}
    return before, out, meta


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=False); return buf.getvalue()


def main(argv: list[str]) -> int:
    bad = 0
    only = argv[argv.index("--only") + 1].split(",") if "--only" in argv else list(SPEC)
    for cid in only:
        before, im, meta = sheet(cid)
        text = json.dumps(meta, indent=2) + "\n"
        out = HERE / "approved" / cid / "field"
        if "--raw" in argv:
            d = Path(argv[argv.index("--raw") + 1]); d.mkdir(parents=True, exist_ok=True)
            before.save(d / f"{cid}_before_post.png")
            im.save(d / f"{cid}_after.png")
        if "--check" in argv:
            png, js = out.with_suffix(".png"), out.with_suffix(".json")
            same = (png.is_file() and js.is_file() and js.read_text() == text
                    and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), np.asarray(im)))
            print(f"npc_field_cut: {cid} OK (the committed sheet rebuilds)" if same else f"npc_field_cut: {cid} DIFFERS")
            bad += not same
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.with_suffix(".png").write_bytes(_png_bytes(im))
        out.with_suffix(".json").write_text(text)
        print(f"npc_field_cut: wrote {out.with_suffix('.png')} (figure px {meta['figure_px']})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

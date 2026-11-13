"""Tile-kit sheets (docs/ART_TILES_PLAN.md): a complete object drawn on a tile grid, sliced into named 48x48 parts.

guide()  - layout guide: magenta page, the tile grid with grey blocks hinting roof / wall / door / window
prompt() - request text with the cell legend (cells are never labelled on the guide)
cut()    - find the drawn object, resample it to 48 native px per tile (<= 32 colours, 15-bit), slice and score it
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from gen import pixelize as PX
from gen import spec as S

ROOT = Path(__file__).resolve().parents[2]
GUIDE_SIZE = (1280, 1024)        # 5:4
TILE_GUIDE = 240                 # guide px per tile
MAGENTA = (255, 0, 255)
COLORS = 32
SHADES = {"roof": (150, 150, 150), "wall": (205, 205, 205), "door": (90, 90, 90), "window": (120, 120, 120)}


def geo(sheet: dict) -> tuple[tuple[int, int], int]:
    """(guide size, guide px per tile) of a kits.yaml sheet; defaults are the rev-2.1 5:4 pilot geometry."""
    return tuple(sheet.get("guide", GUIDE_SIZE)), int(sheet.get("tile_px", TILE_GUIDE))


def grid_box(cols: int, rows: int, size: tuple[int, int] = GUIDE_SIZE, tile: int = TILE_GUIDE) -> tuple[int, int, int, int]:
    w, h = cols * tile, rows * tile
    x0, y0 = (size[0] - w) // 2, (size[1] - h) // 2
    return x0, y0, x0 + w, y0 + h


def base(name: str) -> str:
    """Part name without its style suffix (roof_ridge_m@timber -> roof_ridge_m)."""
    return name.split("@")[0]


def _kind(name: str) -> str:
    name = base(name)
    if name.startswith("roof_"):
        return "roof"
    if "door" in name:
        return "door"
    if "window" in name:
        return "window"
    return "wall"


def guide(cells: list[list[str]], size: tuple[int, int] = GUIDE_SIZE, tile: int = TILE_GUIDE,
          grid_lines: bool = True) -> Image.Image:
    rows, cols = len(cells), len(cells[0])
    x0, y0, x1, y1 = grid_box(cols, rows, size, tile)
    TILE_GUIDE = tile  # noqa: N806 (local: the drawing below is in this sheet's tile size)
    im = Image.new("RGB", size, MAGENTA)
    d = ImageDraw.Draw(im)
    for r, row in enumerate(cells):
        for c, name in enumerate(row):
            if not name:
                continue
            bx, by = x0 + c * TILE_GUIDE, y0 + r * TILE_GUIDE
            kind = _kind(name)
            d.rectangle([bx, by, bx + TILE_GUIDE - 1, by + TILE_GUIDE - 1], fill=SHADES["roof" if kind == "roof" else "wall"])
            if kind == "door":
                top = round(tile * 70 / 240) if base(name).endswith("_top") else 0
                m = round(tile * 50 / 240)
                d.rectangle([bx + m, by + top, bx + TILE_GUIDE - m - 1, by + TILE_GUIDE - 1], fill=SHADES["door"])
            if kind == "window":
                m = round(tile * 60 / 240)
                d.rectangle([bx + m, by + m, bx + TILE_GUIDE - m - 1, by + TILE_GUIDE - round(tile * 50 / 240) - 1],
                            fill=SHADES["window"])
    if not grid_lines:
        return im
    for c in range(cols + 1):
        d.line([x0 + c * TILE_GUIDE, y0, x0 + c * TILE_GUIDE, y1], fill=(110, 110, 110), width=2)
    for r in range(rows + 1):
        d.line([x0, y0 + r * TILE_GUIDE, x1, y0 + r * TILE_GUIDE], fill=(110, 110, 110), width=2)
    return im


def prompt(kit: dict, sheet_name: str, sheet: dict, n_refs: int) -> str:
    if sheet.get("prompt_rev", 1) >= 2:
        return prompt_v2(sheet, n_refs)
    cells = sheet["cells"]
    rows, cols = len(cells), len(cells[0])
    legend = "\n".join(f"- row {r + 1}: " + ", ".join(f"column {c + 1} = {name}" for c, name in enumerate(row))
                       for r, row in enumerate(cells))
    refs = "".join(f"Image {3 + i} is an APPROVED tile sheet from this same game: match its colours, outline and shading.\n"
                   for i in range(n_refs))
    return (
        "Create pixel art for a modern 16-bit-style top-down RPG town (three-quarter overhead view, like a classic "
        "SNES JRPG town map).\n\n"
        f"Image 1 is a LAYOUT GUIDE: a {cols}x{rows} grid of square map tiles on a magenta page. Draw ONE object that "
        "fills exactly the grey grid area, with its outer edges on the outer grid lines and its parts inside the "
        "cells described below. Darker grey blocks mark where the roof, the door and the windows go. Do NOT draw the "
        "grid lines, the grey blocks or any labels.\n\n"
        "Image 2 is the HOUSE STYLE: the approved overworld walking sprite of a character from this game, drawn at "
        "the same pixel scale as the map. Match its sprite-pixel size exactly (each grid cell is 48 sprite pixels "
        "wide and tall, and this character is about 90 sprite pixels tall, i.e. two cells), its dark outlines, its "
        "flat 2-3 tone shading and its light from the upper left. The door must be tall enough for him to walk "
        "through.\n\n" + refs + "\n"
        f"Object: {sheet['prompt'].strip()}\n\n"
        "Cells (row 1 is the top):\n" + legend + "\n\n"
        "Render as true pixel art: every sprite pixel a hard-edged square, no anti-aliasing, no gradients, no blur. "
        "Repeated middle cells must look interchangeable so the object can be made wider by repeating them. "
        "Outside the object: solid flat magenta (#FF00FF), no ground, no grass, no cast shadow, no other objects, no "
        "text.\n"
    )


def prompt_v2(sheet: dict, n_refs: int) -> str:
    """Rev 2 (after the 4x4 retry drew its own black grid): never says grid / tiles / cells / rows / columns; the guide
    is described only as grey placement blocks, and the picture must be one continuous illustration."""
    cols, rows = len(sheet["cells"][0]), len(sheet["cells"])
    refs = "".join(f"Image {3 + i} is approved art from this same game: match its colours, outline and shading.\n"
                   for i in range(n_refs))
    return (
        "Create pixel art of ONE building for a modern 16-bit-style top-down RPG town map (three-quarter overhead "
        "view, like a classic SNES JRPG town).\n\n"
        "Image 1 is a PLACEMENT GUIDE on a magenta page. The big grey shape is exactly where the building goes: fill "
        "it edge to edge, with the building's outline on the edge of the grey shape. The darker grey upper part is "
        "the roof, the lighter grey lower part is the front wall, the dark upright block is the door and the small "
        "mid-grey block is the window. Do not copy the grey colours.\n\n"
        "Image 2 is the HOUSE STYLE: the approved walking sprite of a character from this game at the same pixel "
        f"scale as the map. The building is about {cols * 48} sprite pixels wide and {rows * 48} tall; this character "
        "is about 90 sprite pixels tall. Match its sprite-pixel size exactly, its dark outlines, its flat 2-3 tone "
        "shading and its light from the upper left. The door must be tall enough for him.\n\n" + refs + "\n"
        f"Building: {sheet['prompt'].strip()}\n\n"
        "Draw it as one continuous illustration: no lines, seams or borders dividing the building into squares or "
        "panels; roof courses and plaster run unbroken across the whole width.\n"
        "Render as true pixel art: every sprite pixel a hard-edged square, no anti-aliasing, no gradients, no blur.\n"
        "Outside the building: solid flat magenta (#FF00FF), no ground, no grass, no cast shadow, no other objects, "
        "no text.\n"
    )


# ───────────────────────────── cut ─────────────────────────────

def _object_box(rgb: np.ndarray) -> tuple[int, int, int, int]:
    fg = ~PX.magenta_bg(rgb) if PX.is_magenta_bg(rgb) else np.ones(rgb.shape[:2], bool)
    fg = _open(fg, 6)          # drop thin structures (grid lines drawn across the page)
    # ignore thin specks: a row / column counts when at least 2% of it is object
    rows = np.where(fg.mean(1) > 0.02)[0]
    cols = np.where(fg.mean(0) > 0.02)[0]
    if not len(rows) or not len(cols):
        raise ValueError("kit sheet: no object found on the magenta page")
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def _open(mask: np.ndarray, r: int) -> np.ndarray:
    """Morphological opening with a (2r+1) square: removes anything thinner than about 2r px."""
    m = mask.copy()
    for op in (np.logical_and, np.logical_or):
        for _ in range(r):
            p = np.pad(m, 1, constant_values=op is np.logical_and)
            m = op.reduce([p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
    return m


def _quantize(rgb: np.ndarray, k: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    px = rgb.reshape(-1, 3).astype(np.float32)
    rng = np.random.default_rng(seed)
    sample = px[rng.choice(len(px), size=min(len(px), 20000), replace=False)]
    cent = PX.snap15(PX.kmeans(sample, k, seed=seed)).astype(np.float32)
    cent = np.unique(cent, axis=0)
    lab = np.empty(len(px), np.int32)
    for i in range(0, len(px), 200000):      # chunked nearest-centre labelling
        chunk = px[i:i + 200000]
        lab[i:i + 200000] = ((chunk[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    return lab.reshape(rgb.shape[:2]), cent.astype(np.uint8)


def _block_mode(lab: np.ndarray, out_w: int, out_h: int, n: int) -> np.ndarray:
    h, w = lab.shape
    ys = np.linspace(0, h, out_h + 1).astype(int)
    xs = np.linspace(0, w, out_w + 1).astype(int)
    out = np.zeros((out_h, out_w), np.int32)
    for j in range(out_h):
        band = lab[ys[j]:max(ys[j + 1], ys[j] + 1)]
        for i in range(out_w):
            blk = band[:, xs[i]:max(xs[i + 1], xs[i] + 1)]
            out[j, i] = np.bincount(blk.ravel(), minlength=n).argmax()
    return out


def seam_ratio(tile: np.ndarray) -> float:
    """Colour error across the seam when a tile repeats horizontally, relative to the error between neighbouring
    interior columns (1.0 = the seam is as smooth as the tile's own texture)."""
    t = tile[..., :3].astype(np.float32)
    seam = np.abs(t[:, -1] - t[:, 0]).mean()
    inner = np.abs(np.diff(t, axis=1)).mean()
    return float(seam / max(inner, 1e-6))


def remove_thin_lines(rgb: np.ndarray, t: float = 16.0, same: float = 20.0) -> tuple[np.ndarray, int]:
    """Erase 1-2 px lines (guide grid lines the model copied): a pixel that differs from both neighbours 2-3 px away
    on either side, while those neighbours agree with each other, takes their mean. Art pixels are ~5-6 px wide, so
    real edges never match. Returns the cleaned image and how many pixels were changed."""
    a = rgb.astype(np.float32)
    out = a.copy()
    changed = np.zeros(a.shape[:2], bool)
    for axis in (1, 0):
        for k in (2, 3, 4):
            lo, hi = np.roll(a, k, axis), np.roll(a, -k, axis)
            d_lo, d_hi = np.abs(a - lo).sum(-1), np.abs(a - hi).sum(-1)
            agree = np.abs(lo - hi).sum(-1) < same
            m = (d_lo > t) & (d_hi > t) & agree & ~changed
            out[m] = ((lo + hi) / 2)[m]
            changed |= m
    return out.astype(np.uint8), int(changed.sum())


def has_drawn_grid(rgb: np.ndarray, box: tuple[int, int, int, int], cols: int, rows: int, near: int = 24) -> bool:
    """True when some inner vertical tile boundary carries a dark line along at least 70% of the object's height
    (a door frame or a wall edge never runs that far; horizontal structure like the eave cannot be told apart)."""
    x0, y0, x1, y1 = box
    a = rgb.astype(np.int32).sum(-1)
    for k in range(1, cols):
        c = round(x0 + k * (x1 - x0) / cols)
        if ((a[y0:y1, c - near:c + near + 1] < 200).mean(0) > 0.7).any():
            return True
    return False


def remove_grid_lines(rgb: np.ndarray, box: tuple[int, int, int, int], cols: int, rows: int,
                      max_w: int = 8, near: int = 24, agree: float = 110.0) -> tuple[np.ndarray, list]:
    """Erase dark grid lines the model drew on tile boundaries, one scanline at a time. Across each expected
    boundary (inside `box`, the object's extent), the dark run nearest the boundary - at most max_w px wide - is
    filled from the pixels just outside it when those two agree. Real structure on a boundary (the eave edge: roof
    above, wall below; a door frame: wall one side, wood the other) does not agree across the run, so it stays."""
    a = rgb.astype(np.int32).copy()
    x0, y0, x1, y1 = box
    H, W = a.shape[:2]
    filled = {"x": 0, "y": 0}
    for axis, n, lo, hi, (s0, s1) in (("x", cols, x0, x1, (y0, y1)), ("y", rows, y0, y1, (x0, x1))):
        step = (hi - lo) / n
        for k in range(1, n):
            c = round(lo + k * step)
            for t in range(s0, s1):
                line = a[t, c - near:c + near + 1] if axis == "x" else a[c - near:c + near + 1, t]
                dark = line.sum(-1) < 200
                hits = np.where(dark[near - 12:near + 13])[0]
                if not len(hits):
                    continue
                i = near - 12 + int(hits[np.argmin(np.abs(hits - 12))])     # the dark pixel nearest the boundary
                r0 = i
                while r0 > 0 and dark[r0 - 1]:
                    r0 -= 1
                r1 = i
                while r1 < len(dark) - 1 and dark[r1 + 1]:
                    r1 += 1
                if r1 - r0 + 1 > max_w or r0 < 3 or r1 > len(dark) - 4:
                    continue
                r0, r1 = r0 - 1, r1 + 1                      # the line's soft fringe
                before, after = line[r0 - 2], line[r1 + 2]
                g0, g1 = c - near + r0, c - near + r1            # run in image coordinates (along the scan axis)
                full = a[t] if axis == "x" else a[:, t]
                n_full = W if axis == "x" else H
                around = np.concatenate([full[max(0, g0 - 40):max(0, g0 - 12)], full[g1 + 12:g1 + 40]])
                textured = len(around) > 10 and around.sum(-1).std() > 40
                if textured:                                     # roof: the model shaded a band around its line
                    mc = (g0 + g1) // 2
                    g0, g1 = max(0, mc - 11), min(n_full - 1, mc + 11)
                    P = _period(full, g0, g1, n_full, lo=26, hi=72)
                    if P is None:
                        continue
                    vals = [full[j + P] if j + P < n_full else full[j - P] for j in range(g0, g1 + 1)]
                elif np.abs(before - after).sum() <= agree:
                    mid = (r0 + r1 + 1) // 2
                    vals = [before if j < mid else after for j in range(r0, r1 + 1)]
                else:
                    continue
                for j, v in zip(range(g0, g1 + 1), vals):
                    if axis == "x":
                        a[t, j] = v
                    else:
                        a[j, t] = v
                filled[axis] += 1
    return a.astype(np.uint8), [filled["x"], filled["y"]]


def _period(sig: np.ndarray, g0: int, g1: int, n: int, lo: int = 10, hi: int = 64, span: int = 90) -> int | None:
    """Repeat distance of a texture around [g0, g1] (excluded): the shift that best maps the surroundings onto
    themselves. None if nothing repeats well."""
    a, b = max(0, g0 - span), min(n, g1 + span)
    idx = np.array([i for i in range(a, b) if i < g0 - 1 or i > g1 + 1])
    best, best_p = None, None
    for P in range(lo, hi):
        j = idx + P
        ok = (j < n) & ((j < g0 - 1) | (j > g1 + 1))
        if ok.sum() < 20:
            continue
        cost = np.abs(sig[idx[ok]] - sig[j[ok]]).sum(-1).mean()
        if best is None or cost < best:
            best, best_p = cost, P
    return best_p if best is not None and best < 120 else None


def cut(raw: Image.Image, cells: list[list[str]], seed: int = 0, size: tuple[int, int] = GUIDE_SIZE,
        tile: int = TILE_GUIDE, derive: dict | None = None, hairlines: bool = True,
        prefab: str | None = None) -> tuple[Image.Image, dict]:
    """prefab: keep the drawing exactly as drawn (no repeated-part substitution, no derived parts) and name its
    cells <prefab>_<row>_<col>, for a unique building stamped whole."""
    rows, cols = len(cells), len(cells[0])
    GUIDE_SIZE, TILE_GUIDE = size, tile  # noqa: N806 (this sheet's geometry)
    T = 48
    raw = raw.convert("RGB")
    rgb = np.asarray(raw.resize(GUIDE_SIZE, Image.Resampling.NEAREST))
    bx0, by0, bx1, by1 = _object_box(rgb)
    sx, sy = raw.width / GUIDE_SIZE[0], raw.height / GUIDE_SIZE[1]
    raw_box = (round(bx0 * sx), round(by0 * sy), round(bx1 * sx), round(by1 * sy))
    clean = np.asarray(raw)
    grid_lines, n_line_px = [0, 0], 0
    if has_drawn_grid(clean, raw_box, cols, rows):                                    # drawn grid lines first
        clean, grid_lines = remove_grid_lines(clean, raw_box, cols, rows)
    if hairlines:                                                                     # copied guide hairlines
        clean, n_line_px = remove_thin_lines(clean)
    raw = Image.fromarray(clean)
    rgb = np.asarray(raw.resize(GUIDE_SIZE, Image.Resampling.LANCZOS))
    gx0, gy0, gx1, gy1 = grid_box(cols, rows, size, tile)
    tile_x, tile_y = (bx1 - bx0) / cols, (by1 - by0) / rows
    crop = rgb[by0:by1, bx0:bx1]
    rx0, ry0, rx1, ry1 = raw_box
    pitch, conf, _, _ = PX.detect_pitch(np.asarray(raw.convert("RGB"))[ry0:ry1, rx0:rx1])
    raw_scale = raw.width / GUIDE_SIZE[0]
    lab, cent = _quantize(crop, COLORS, seed)
    idx = _block_mode(lab, cols * T, rows * T, len(cent))
    sheet = np.concatenate([cent[idx], np.full(idx.shape + (1,), 255, np.uint8)], axis=2)
    c = sheet[..., :3].astype(int)
    page = (c[..., 0] > 170) & (c[..., 2] > 170) & (c[..., 1] < 110) & (np.abs(c[..., 0] - c[..., 2]) < 70)
    sheet[page] = 0                        # the magenta page (and its fringe colours) is transparent
    # metrics
    per_native = TILE_GUIDE / T
    align = max(abs(bx0 - gx0), abs(by0 - gy0), abs(bx1 - gx1), abs(by1 - gy1)) / per_native
    seams = {}
    for r, row in enumerate(cells):
        for c, name in enumerate(row):
            if name and base(name).endswith("_m"):
                seams.setdefault(name, []).append((seam_ratio(sheet[r * T:(r + 1) * T, c * T:(c + 1) * T]), r, c))
    best = {n: min(v) for n, v in seams.items()}
    # a repeatable middle part may come from anywhere along its row band (the roof runs unbroken across the
    # building): take the 48 px window between the edge cells that repeats most smoothly
    windows = {}
    for name, (_, r, c) in best.items():
        band = sheet[r * T:(r + 1) * T, T:(cols - 1) * T]
        cand = [(seam_ratio(band[:, x:x + T]), x) for x in range(0, band.shape[1] - T + 1)]
        ratio, x = min(cand)
        if ratio < best[name][0]:
            windows[name] = band[:, x:x + T].copy()
            best[name] = (ratio, r, c)
    door_h = _door_height(sheet, cells)
    report = {
        "native_px_per_tile": round(tile_x * raw_scale / pitch, 1) if conf > 0.3 and pitch else None,
        "drawn_pitch_raw_px": round(pitch, 2), "pitch_conf": round(conf, 2),
        "tile_guide_px": (round(tile_x, 1), round(tile_y, 1)),
        "grid_alignment_native_px": round(align, 1),
        "door_opening_px": door_h,
        "seam_ratio": {n: round(v[0], 2) for n, v in best.items()},
        "colours": int(len(np.unique(sheet[..., :3].reshape(-1, 3), axis=0))),
        "thin_line_px_removed": n_line_px,
        "grid_lines_removed": grid_lines,
    }
    report["pass"] = {
        "density": report["native_px_per_tile"] is not None and 40 <= report["native_px_per_tile"] <= 56,
        "alignment": align <= T / 4,         # rev 2.2: roof overhang / visible side wall are part of the edge tiles
        "door": door_h is not None and 70 <= door_h <= 96,
        "seams": all(v[0] <= 1.5 for v in best.values()),
        "colours": report["colours"] <= COLORS,
    }
    if prefab:
        report["cells"] = [[f"{prefab}_{r}_{c}" for c in range(cols)] for r in range(rows)]
        report["pass"]["seams"] = True               # nothing repeats in a prefab
        report["prefab"] = prefab
        return Image.fromarray(sheet), report
    # repeated middle parts: copy the best-seam copy into every slot so the kit is consistent
    out = sheet.copy()
    for name, (_, r, c) in best.items():
        src = windows.get(name, sheet[r * T:(r + 1) * T, c * T:(c + 1) * T])
        for rr, row in enumerate(cells):
            for cc, n2 in enumerate(row):
                if n2 == name:
                    out[rr * T:(rr + 1) * T, cc * T:(cc + 1) * T] = src
    # derived parts (made offline from another cell) go in an extra row; report["cells"] is the stored cell table
    table = [list(row) for row in cells]
    if derive:
        extra = np.zeros((T, out.shape[1], 4), np.uint8)
        names = [None] * cols
        for i, (name, rule) in enumerate(derive.items()):
            r, c = next((r, c) for r, row in enumerate(cells) for c, n in enumerate(row) if n == rule["from"])
            extra[:, i * T:(i + 1) * T] = paint_out(out[r * T:(r + 1) * T, c * T:(c + 1) * T])
            names[i] = name
        out = np.concatenate([out, extra], axis=0)
        table.append(names)
        report["derived"] = {n: f"{rule['from']} with its feature painted out" for n, rule in derive.items()}
    report["cells"] = table
    return Image.fromarray(out), report


def paint_out(tile: np.ndarray) -> np.ndarray:
    """A wall tile with its central feature (window) removed: every pixel far from the tile's dominant colour inside
    the central area takes that row's dominant colour (plaster rows keep their own shade)."""
    t = tile.copy()
    T = t.shape[0]
    flat = t[..., :3].reshape(-1, 3)
    cols, counts = np.unique(flat, axis=0, return_counts=True)
    dom = cols[counts.argmax()].astype(int)
    m = T // 8
    for y in range(T):
        row = t[y, :, :3].astype(int)
        near = np.abs(row - dom).sum(-1) < 35
        if not near.any():
            continue
        vals, cnt = np.unique(row[near], axis=0, return_counts=True)
        fill = vals[cnt.argmax()]
        far = ~near
        far[:m] = False
        far[T - m:] = False
        t[y, far, :3] = fill
    return t


def _door_height(sheet: np.ndarray, cells: list[list[str]]) -> int | None:
    """Rows of the door column (door_top over door_bottom) whose centre strip is mostly the door's own colours: the
    commonest colours in the middle of the door's bottom cell that are rare on the plain wall (works on smooth
    plaster and on textured stone alike)."""
    T = 48
    pos = {base(name): (r, c) for r, row in enumerate(cells) for c, name in enumerate(row) if name}
    if "wall_door_top" not in pos or "wall_lo_plain" not in pos:
        return None
    (rt, ct), (rp, cp) = pos["wall_door_top"], pos["wall_lo_plain"]
    key = lambda a: (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]  # noqa: E731
    strip = key(sheet[rt * T:(rt + 2) * T, ct * T + 16:ct * T + 32, :3])
    wall = key(sheet[rp * T:(rp + 1) * T, cp * T:(cp + 1) * T, :3])
    bottom = strip[T + 8:]                          # the door's bottom cell, below any frame
    vals, cnt = np.unique(bottom, return_counts=True)
    wall_vals, wall_cnt = np.unique(wall, return_counts=True)
    wall_share = dict(zip(wall_vals.tolist(), (wall_cnt / wall.size).tolist()))
    door_cols = {v for v, n in zip(vals.tolist(), cnt.tolist()) if n / bottom.size > 0.05 and wall_share.get(v, 0) < 0.02}
    if not door_cols:
        return None
    is_door = np.isin(strip, list(door_cols)).mean(1) > 0.5
    return int(is_door.sum())

def review(raw: Image.Image, sheet: Image.Image, report: dict, cells: list[list[str]]) -> Image.Image:
    """Raw | cut at in-game 2x | a test house 7 wide built from the parts, with the knight for scale."""
    T = 48
    s2 = sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST)
    parts = {base(name): sheet.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))
             for r, row in enumerate(report["cells"]) for c, name in enumerate(row) if name}
    plan = [["roof_ridge_l"] + ["roof_ridge_m"] * 5 + ["roof_ridge_r"],
            ["roof_eave_l"] + ["roof_eave_m"] * 5 + ["roof_eave_r"]]
    if "wall_up2_l" in parts:
        plan.append(["wall_up2_l", "wall_up2_window", "wall_up2_plain", "wall_up2_window", "wall_up2_plain",
                     "wall_up2_window", "wall_up2_r"])
    plan += [
            ["wall_up_l", "wall_up_plain", "wall_up_window", "wall_door_top", "wall_up_window", "wall_up_plain", "wall_up_r"],
            ["wall_lo_l", "wall_lo_plain", "wall_lo_plain", "wall_door_bottom", "wall_lo_plain", "wall_lo_plain", "wall_lo_r"]]
    rows = len(plan)
    wide = Image.new("RGBA", (7 * T + 64, rows * T), (70, 140, 60, 255))
    for r, names in enumerate(plan):
        for i, n in enumerate(names):
            if n in parts:
                wide.alpha_composite(parts[n], (i * T, r * T))
    knight = Image.open(ROOT / S.HOUSE_REFS["field"]).convert("RGBA")
    k = knight.crop((0, 0, 48, 96))
    wide.alpha_composite(k, (7 * T + 8, rows * T - 96))
    w2 = wide.resize((wide.width * 2, wide.height * 2), Image.Resampling.NEAREST)
    rs = raw.convert("RGBA").resize((s2.height * raw.width // raw.height, s2.height))
    W = rs.width + s2.width + w2.width + 48
    out = Image.new("RGBA", (W, max(s2.height, w2.height) + 60), (40, 40, 44, 255))
    out.alpha_composite(rs, (0, 24)); out.alpha_composite(s2, (rs.width + 16, 24)); out.alpha_composite(w2, (rs.width + s2.width + 32, 24))
    d = ImageDraw.Draw(out)
    d.text((4, 6), "raw", fill="white"); d.text((rs.width + 20, 6), "cut, in-game 2x", fill="white")
    d.text((rs.width + s2.width + 36, 6), "kit test: 7-wide house + knight (2x)", fill="white")
    d.text((4, out.height - 30), " ".join(f"{k}={v}" for k, v in report.items() if k != "pass"), fill="white")
    d.text((4, out.height - 16), "PASS " + str(report["pass"]), fill="white")
    return out


# ───────────────────────────── material sheets (checkpoint B) ─────────────────────────────
# A 2x2 arrangement of square swatches on a magenta page, each `swatch_tiles` x `swatch_tiles` map tiles. The cut
# finds each swatch, resamples it to native size with one shared palette and makes it seamless (wrap-around).

def swatch_boxes(sheet: dict) -> list[tuple[int, int, int, int]]:
    size, tile = geo(sheet)
    n = sheet.get("swatch_tiles", 2) * tile
    layout = sheet["layout"]
    rows, cols = len(layout), len(layout[0])
    gap = (size[0] - cols * n) // (cols + 1), (size[1] - rows * n) // (rows + 1)
    return [(gap[0] + c * (n + gap[0]), gap[1] + r * (n + gap[1]), gap[0] + c * (n + gap[0]) + n, gap[1] + r * (n + gap[1]) + n)
            for r in range(rows) for c in range(cols)]


def materials_guide(sheet: dict) -> Image.Image:
    size, _ = geo(sheet)
    im = Image.new("RGB", size, MAGENTA)
    d = ImageDraw.Draw(im)
    for box in swatch_boxes(sheet):
        d.rectangle([box[0], box[1], box[2] - 1, box[3] - 1], fill=(170, 170, 170))
    return im


def materials_prompt(sheet: dict, n_refs: int) -> str:
    layout = sheet["layout"]
    pos = {(0, 0): "top-left", (0, 1): "top-right", (1, 0): "bottom-left", (1, 1): "bottom-right"}
    n_px = sheet.get("swatch_tiles", 2) * 48
    lines = "\n".join(f"- {pos[(r, c)]} square: {sheet['materials'][name].strip()}"
                      for r, row in enumerate(layout) for c, name in enumerate(row))
    refs = "".join(f"Image {3 + i} is approved art from this same game (a building on this map): match its colours, "
                   "outline weight and shading.\n" for i in range(n_refs))
    return (
        "Create four ground textures for a modern 16-bit-style top-down RPG map (seen from straight above, like the "
        "ground of a classic SNES JRPG town).\n\n"
        "Image 1 is a PLACEMENT GUIDE on a magenta page: fill each grey square edge to edge with one texture. Do not "
        "copy the grey colour.\n\n"
        "Image 2 is the HOUSE STYLE: the approved walking sprite of a character from this game at the same pixel "
        f"scale as the map. Each square is about {n_px} sprite pixels wide and tall; this character is about 90 "
        "sprite pixels tall. Match its sprite-pixel size exactly and its flat 2-3 tone shading with light from the "
        "upper left. Ground is calmer than characters: lower contrast, no black outlines inside the texture.\n\n"
        + refs + "\n"
        "Textures:\n" + lines + "\n\n"
        "Each texture must be a SEAMLESS repeating pattern: its left edge continues into its right edge and its top "
        "edge into its bottom edge, with even detail and no large features, no borders, no frames and no objects. "
        "Render as true pixel art: every sprite pixel a hard-edged square, no anti-aliasing, no gradients, no blur. "
        "Between the squares: solid flat magenta (#FF00FF), no text.\n"
    )


def _min_path(err: np.ndarray, lo: int, hi: int) -> np.ndarray:
    """Per row, a column in [lo, hi) forming a connected path (moves at most 1 per row) of least total error."""
    sub = err[:, lo:hi].astype(np.float64)
    h, w = sub.shape
    cost = sub.copy()
    back = np.zeros((h, w), np.int64)
    for y in range(1, h):
        prev = np.stack([np.r_[np.inf, cost[y - 1, :-1]], cost[y - 1], np.r_[cost[y - 1, 1:], np.inf]])
        k = prev.argmin(0)
        back[y] = np.arange(w) + k - 1
        cost[y] += prev[k, np.arange(w)]
    path = np.zeros(h, np.int64)
    path[-1] = int(cost[-1].argmin())
    for y in range(h - 1, 0, -1):
        path[y - 1] = back[y, path[y]]
    return path + lo


def make_seamless(tex: np.ndarray, band: int = 16, seed: int = 0) -> np.ndarray:
    """Wrap-around fix for pixel art (image-quilting style): the swatch rolled by half its size is seamless at its
    border. Near each border use the rolled copy, switching to the original along a least-error path through the
    band (it follows mortar gaps and texture boundaries rather than cutting through stones); no colour blending, so
    the palette is kept."""
    h, w = tex.shape[:2]
    rolled = np.roll(np.roll(tex, h // 2, 0), w // 2, 1)
    err = np.abs(tex.astype(np.int32) - rolled.astype(np.int32)).sum(-1)
    use_rolled = np.zeros((h, w), bool)
    left = _min_path(err, 1, band)
    right = _min_path(err, w - band, w - 1)
    top = _min_path(err.T, 1, band)
    bottom = _min_path(err.T, h - band, h - 1)
    cols = np.arange(w)[None, :]
    rows = np.arange(h)[:, None]
    use_rolled |= cols < left[:, None]
    use_rolled |= cols > right[:, None]
    use_rolled |= rows < top[None, :]
    use_rolled |= rows > bottom[None, :]
    return np.where(use_rolled[..., None], rolled, tex)


def wrap_ratio(tex: np.ndarray) -> float:
    """Worst of the horizontal and vertical wrap seams (seam_ratio on the texture and its transpose)."""
    return max(seam_ratio(tex), seam_ratio(np.transpose(tex, (1, 0, 2))))


def cut_materials(raw: Image.Image, sheet: dict, seed: int = 0) -> tuple[Image.Image, dict]:
    size, tile = geo(sheet)
    n_tiles = sheet.get("swatch_tiles", 2)
    N = n_tiles * 48
    layout = sheet["layout"]
    names = [name for row in layout for name in row]
    rgb = np.asarray(raw.convert("RGB").resize(size, Image.Resampling.LANCZOS))
    mag = PX.magenta_bg(rgb)
    rows_n, cols_n = len(layout), len(layout[0])

    def spans(frac: np.ndarray, n: int) -> list[tuple[int, int]]:
        """The n longest runs of non-gap lines (a gap line is mostly magenta), in order."""
        solid = frac < 0.5
        runs, start = [], None
        for i, v in enumerate(list(solid) + [False]):
            if v and start is None:
                start = i
            elif not v and start is not None:
                runs.append((start, i)); start = None
        runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n])
        if len(runs) != n:
            raise ValueError(f"material sheet: expected {n} swatch bands, found {len(runs)}")
        return runs

    xs = spans(mag.mean(0), cols_n)
    ys = spans(mag.mean(1), rows_n)
    crops, boxes = [], []
    for (y0, y1) in ys:
        for (x0, x1) in xs:
            m = max(3, (x1 - x0) // 40)              # trim the soft edge of the drawn square
            boxes.append((x0 + m, y0 + m, x1 - m, y1 - m))
            crops.append(rgb[y0 + m:y1 - m, x0 + m:x1 - m])
    pitch, conf, _, _ = PX.detect_pitch(np.asarray(raw.convert("RGB")))
    scale = raw.width / size[0]
    per_colors = sheet.get("colors_per_material", 16)
    out = np.zeros((len(layout) * N, len(layout[0]) * N, 3), np.uint8)
    report = {"swatch_native_px": [], "wrap_before": {}, "wrap_after": {}, "materials": {}}
    for i, (crop, name) in enumerate(zip(crops, names)):
        lab, cent = _quantize(crop, per_colors, seed + i)       # each material keeps its own palette
        idx = _block_mode(lab, N, N, len(cent))
        tex = cent[idx]
        report["wrap_before"][name] = round(wrap_ratio(tex), 2)
        tex = make_seamless(tex, seed=seed + i)
        report["wrap_after"][name] = round(wrap_ratio(tex), 2)
        r, c = divmod(i, len(layout[0]))
        out[r * N:(r + 1) * N, c * N:(c + 1) * N] = tex
        report["materials"][name] = [c * N, r * N, N, N]
        if conf > 0.3 and pitch:
            report["swatch_native_px"].append(round((boxes[i][2] - boxes[i][0]) * scale / pitch, 1))
    per_tile = [v / n_tiles for v in report["swatch_native_px"]]
    report.update({"drawn_pitch_raw_px": round(pitch, 2), "pitch_conf": round(conf, 2),
                   "native_px_per_tile": round(float(np.median(per_tile)), 1) if per_tile else None,
                   "colours": int(len(np.unique(out.reshape(-1, 3), axis=0)))})
    report["pass"] = {
        # finer than 48 is fine for ground (the cut downsamples); coarser would mean upscaling
        "density": report["native_px_per_tile"] is not None and report["native_px_per_tile"] >= 40,
        "seamless": all(v <= 1.5 for v in report["wrap_after"].values()),
        "colours": all(len(np.unique(out[r0:r0 + N, c0:c0 + N].reshape(-1, 3), axis=0)) <= per_colors
                       for c0, r0, _, _ in report["materials"].values()),
    }
    return Image.fromarray(out), report


def materials_review(raw: Image.Image, sheet_img: Image.Image, report: dict, house: Image.Image | None) -> Image.Image:
    """Raw | the cut | each material repeated 3x3 at in-game 2x (seams show up here) with the house and knight on grass."""
    N = sheet_img.height // 2
    mats = report["materials"]
    tiles = []
    for name, (x, y, w, h) in mats.items():
        t = sheet_img.crop((x, y, x + w, y + h))
        big = Image.new("RGB", (w * 3, h * 3))
        for j in range(3):
            for i in range(3):
                big.paste(t, (i * w, j * h))
        tiles.append((name, big.resize((big.width * 2, big.height * 2), Image.Resampling.NEAREST)))
    if house is not None and "grass" in mats:
        g = tiles[[n for n, _ in tiles].index("grass")][1].convert("RGBA")
        hz = house.convert("RGBA").resize((house.width * 2, house.height * 2), Image.Resampling.NEAREST)
        g.alpha_composite(hz.crop((0, 0, hz.width, 4 * 96)), (40, 40))
        knight = Image.open(ROOT / S.HOUSE_REFS["field"]).convert("RGBA").crop((0, 0, 48, 96))
        g.alpha_composite(knight.resize((96, 192), Image.Resampling.NEAREST), (40 + hz.width + 20, 40 + 4 * 96 - 192))
        tiles[[n for n, _ in tiles].index("grass")] = ("grass", g.convert("RGB"))
    tw = tiles[0][1].width
    W = 2 * (tw + 12) + 520
    H = 2 * (tiles[0][1].height + 28) + 40
    out = Image.new("RGB", (W, H), (40, 40, 44))
    out.paste(raw.convert("RGB").resize((500, 500)), (0, 20))
    d = ImageDraw.Draw(out)
    d.text((4, 4), "raw", fill="white")
    for i, (name, t) in enumerate(tiles):
        x, y = 520 + (i % 2) * (tw + 12), 20 + (i // 2) * (t.height + 28)
        out.paste(t, (x, y))
        d.text((x + 2, y - 14), f"{name} x3 (in-game 2x)  wrap {report['wrap_before'][name]} -> {report['wrap_after'][name]}",
               fill="white")
    d.text((4, H - 30), f"px/tile {report['native_px_per_tile']} pitch {report['drawn_pitch_raw_px']} conf "
                        f"{report['pitch_conf']} colours {report['colours']}", fill="white")
    d.text((4, H - 16), "PASS " + str(report["pass"]), fill="white")
    return out


# ───────────────────────────── swatch sheets (checkpoint C) ─────────────────────────────
# Boxes of different sizes on a magenta page, placed in tile units: `swatches: [{name, at: [col, row], tiles:
# [w, h], wrap: both | x | none, text}]`. wrap both/x = a seamless material; none = a 48x48 part (or several).
# Output: every swatch at native size placed at its tile position (no gaps), plus `rotate` copies; materials are
# listed as rectangles, parts as cells.

def swatch_rects(sheet: dict) -> dict[str, tuple[int, int, int, int]]:
    tile, gap, margin = sheet["tile_px"], sheet.get("gap_px", 24), sheet.get("margin_px", 24)
    unit = tile + gap
    out = {}
    for sw in sheet["swatches"]:
        (c, r), (w, h) = sw["at"], sw["tiles"]
        x0, y0 = margin + c * unit, margin + r * unit
        out[sw["name"]] = (x0, y0, x0 + w * tile + (w - 1) * gap, y0 + h * tile + (h - 1) * gap)
    return out


def swatches_guide(sheet: dict) -> Image.Image:
    im = Image.new("RGB", tuple(sheet["guide"]), MAGENTA)
    d = ImageDraw.Draw(im)
    for box in swatch_rects(sheet).values():
        d.rectangle([box[0], box[1], box[2] - 1, box[3] - 1], fill=(170, 170, 170))
    return im


def swatches_prompt(sheet: dict, n_refs: int) -> str:
    rects = swatch_rects(sheet)
    W, H = sheet["guide"]

    def where(box):
        cx, cy = (box[0] + box[2]) / 2 / W, (box[1] + box[3]) / 2 / H
        v = "top" if cy < 0.4 else "bottom" if cy > 0.75 else "middle"
        h = "left" if cx < 0.4 else "right" if cx > 0.7 else "centre"
        return f"{v}-{h}"

    labels = [where(rects[sw["name"]]) for sw in sheet["swatches"]]
    ordered = len(set(labels)) < len(labels)        # ambiguous positions: list the boxes row by row instead
    if ordered:
        tops = sorted({rects[sw["name"]][1] for sw in sheet["swatches"]})
        names_row = {2: ["top", "bottom"], 3: ["top", "middle", "bottom"],
                     4: ["top", "second", "third", "bottom"]}.get(len(tops), [f"#{i + 1}" for i in range(len(tops))])
        nth = ["first", "second", "third", "fourth", "fifth"]
    lines = []
    for sw in sheet["swatches"]:
        w, h = sw["tiles"]
        kind = {"both": "a SEAMLESS texture (left edge continues into the right edge, top into bottom)",
                "x": "a strip that repeats SEAMLESSLY left to right (its top and bottom edges are real edges)",
                "none": "a single complete piece filling the box",
                "prop": "ONE object standing on the bottom edge of its box, as large as the box allows, with magenta "
                        "all around it (no ground, no shadow on the ground, no grass under it)"}[sw.get("wrap", "both")]
        if ordered and sheet.get("labels") == "absolute":    # position counted across the whole page width
            box = rects[sw["name"]]
            row_i = tops.index(box[1])
            xs_all = sorted({rects[q["name"]][0] for q in sheet["swatches"]})
            label = (f"box in the {names_row[row_i]} row of boxes, {nth[xs_all.index(box[0])]} position from the "
                     "left edge of the page")
        elif ordered:
            box = rects[sw["name"]]
            row_i = tops.index(box[1])
            peers = sorted(rects[q["name"]][0] for q in sheet["swatches"] if rects[q["name"]][1] == box[1])
            label = f"{nth[peers.index(box[0])]} box from the left in the {names_row[row_i]} row of boxes"
        else:
            label = f"{where(rects[sw['name']])} box"
        lines.append(f"- the {label} ({w * 48}x{h * 48} sprite pixels): {kind}. {sw['text'].strip()}")
    refs = "".join(f"Image {3 + i} is approved art from this same game map: match its colours, outline weight and "
                   "shading exactly.\n" for i in range(n_refs))
    return (
        "Create pixel-art pieces for a modern 16-bit-style top-down RPG town map (three-quarter overhead view, like a "
        "classic SNES JRPG town).\n\n"
        + ("Image 1 is a PLACEMENT GUIDE on a magenta page: draw each object inside its grey box, as described. "
           "Do not copy the grey colour.\n\n" if all(sw.get("wrap") == "prop" for sw in sheet["swatches"]) else
           "Image 1 is a PLACEMENT GUIDE on a magenta page: fill each grey box edge to edge with the piece described "
           "for it. Do not copy the grey colour.\n\n") +
        "Image 2 is the HOUSE STYLE: the approved walking sprite of a character from this game at the same pixel "
        "scale as the map (about 90 sprite pixels tall). Match its sprite-pixel size, its outlines and its flat "
        "2-3 tone shading with light from the upper left.\n\n" + refs + "\n"
        "Pieces:\n" + "\n".join(lines) + "\n\n"
        "Draw each piece as one continuous picture with no lines dividing it into squares. Render as true pixel art: "
        "every sprite pixel a hard-edged square, no anti-aliasing, no gradients, no blur. Between the boxes: solid "
        "flat magenta (#FF00FF), no text.\n"
    )


def make_seamless_x(tex: np.ndarray, band: int = 16) -> np.ndarray:
    """Horizontal-only version of make_seamless (top and bottom edges are real structure)."""
    h, w = tex.shape[:2]
    rolled = np.roll(tex, w // 2, 1)
    err = np.abs(tex.astype(np.int32) - rolled.astype(np.int32)).sum(-1)
    left = _min_path(err, 1, band)
    right = _min_path(err, w - band, w - 1)
    cols = np.arange(w)[None, :]
    use = (cols < left[:, None]) | (cols > right[:, None])
    return np.where(use[..., None], rolled, tex)


def _aspect_w(sw: dict) -> int:
    """Width (native px, a whole number of tiles) of a `keep_aspect` material at its height in tiles x 48 px, from
    its `source` rect (and `crop` fractions)."""
    x0, y0, x1, y1 = sw["source"]
    fx0, fy0, fx1, fy1 = sw.get("crop", [0, 0, 1, 1])
    w, h = (x1 - x0) * (fx1 - fx0), (y1 - y0) * (fy1 - fy0)
    return max(1, round(sw["tiles"][1] * w / h)) * 48


def cut_swatches(raw: Image.Image, sheet: dict, seed: int = 0) -> tuple[Image.Image, dict]:
    size = tuple(sheet["guide"])
    rgb = np.asarray(raw.convert("RGB").resize(size, Image.Resampling.LANCZOS))
    fg = _open(~PX.magenta_bg(rgb), 4)
    lab_cc, _ = PX.components(fg)
    rects = swatch_rects(sheet)
    per_colors = sheet.get("colors_per_material", 16)
    cols = max(sw["at"][0] + sw["tiles"][0] for sw in sheet["swatches"])
    rows = max(sw["at"][1] + sw["tiles"][1] for sw in sheet["swatches"])
    extra_w = sum(48 * sw["tiles"][1] for sw in sheet["swatches"] if sw.get("rotate"))
    extra_w += sum(_aspect_w(sw) for sw in sheet["swatches"] if sw.get("keep_aspect"))
    canvas = np.zeros((rows * 48, cols * 48 + extra_w, 4), np.uint8)
    report = {"materials": {}, "cells": [[None] * (canvas.shape[1] // 48) for _ in range(rows)],
              "wrap_before": {}, "wrap_after": {}, "fill": {}}
    rot_x = cols * 48

    def body(name: str) -> tuple[int, int, int, int]:
        """The drawn piece in a box: rows / columns at least 60% as full as the fullest (drops spills such as
        culvert water). A swatch's `source` (guide px, review fix) is used as is."""
        sw_ = next(q for q in sheet["swatches"] if q["name"] == name)
        if sw_.get("source"):
            return tuple(sw_["source"])
        x0, y0, x1, y1 = rects[name]
        k = lab_cc[(y0 + y1) // 2, (x0 + x1) // 2]
        if k == 0:
            raise ValueError(f"swatch sheet: nothing drawn in the {name} box")
        piece = lab_cc == k
        rw, cw = piece.sum(1), piece.sum(0)
        ys = np.where(rw >= 0.6 * rw.max())[0]
        xs = np.where(cw >= 0.6 * cw.max())[0]
        return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

    props = [sw for sw in sheet["swatches"] if sw.get("wrap") == "prop"]
    if props:
        return _cut_props(rgb, sheet, rects, report, canvas, seed)
    bodies = {sw["name"]: body(sw["name"]) for sw in sheet["swatches"]}
    report["piece_px"] = {n: [b[2] - b[0], b[3] - b[1]] for n, b in bodies.items()}
    for i, sw in enumerate(sheet["swatches"]):
        name, (c, r), (tw, th) = sw["name"], sw["at"], sw["tiles"]
        x0, y0, x1, y1 = rects[name]
        bx0, by0, bx1, by1 = bodies[name]
        report["fill"][name] = round(float((bx1 - bx0) * (by1 - by0)) / ((x1 - x0) * (y1 - y0)), 2)
        if sw.get("crop"):                           # review fix: keep only part of the drawn piece (fractions)
            fx0, fy0, fx1, fy1 = sw["crop"]
            bw, bh = bx1 - bx0, by1 - by0
            bx0, by0, bx1, by1 = bx0 + round(fx0 * bw), by0 + round(fy0 * bh), bx0 + round(fx1 * bw), by0 + round(fy1 * bh)
        m = max(2, (bx1 - bx0) // 60)
        crop = rgb[by0 + m:by1 - m, bx0 + m:bx1 - m]
        out_w, out_h = tw * 48, th * 48
        if sw.get("match_scale"):                    # same raw-px-per-native-px as a sibling piece
            ref = next(q for q in sheet["swatches"] if q["name"] == sw["match_scale"])
            ref_w = report["piece_px"][ref["name"]]
            fx0, _, fx1, _ = ref.get("crop", [0, 0, 1, 1])
            per = ref_w[0] * (fx1 - fx0) / (ref["tiles"][0] * 48)
            out_w = min(out_w, round(crop.shape[1] / per))
        if sw.get("keep_aspect"):                    # review fix: the drawn piece's proportions, stored past the grid
            out_w = _aspect_w(sw)
        lab, cent = _quantize(crop, per_colors, seed + i)
        tex = cent[_block_mode(lab, out_w, out_h, len(cent))]
        wrap = sw.get("wrap", "both")
        if wrap != "none":
            report["wrap_before"][name] = round(wrap_ratio(tex) if wrap == "both" else seam_ratio(tex), 2)
            if sw.get("seam_fix", True):             # review fix off: a regular pattern cropped to whole periods
                tex = make_seamless(tex, seed=seed + i) if wrap == "both" else make_seamless_x(tex)
            report["wrap_after"][name] = round(wrap_ratio(tex) if wrap == "both" else seam_ratio(tex), 2)
        if sw.get("keep_aspect"):
            c, r = rot_x // 48, 0
            rot_x += tex.shape[1]
        canvas[r * 48:r * 48 + tex.shape[0], c * 48:c * 48 + tex.shape[1], :3] = tex
        canvas[r * 48:r * 48 + tex.shape[0], c * 48:c * 48 + tex.shape[1], 3] = 255
        if wrap == "none":
            names = sw.get("parts") or [[name]]
            for j, row in enumerate(names):
                for q, part in enumerate(row):
                    report["cells"][r + j][c + q] = part
        else:
            report["materials"][name] = [c * 48, r * 48, int(tex.shape[1]), int(tex.shape[0])]
        if sw.get("rotate"):
            rt = np.rot90(tex, -1)
            canvas[:rt.shape[0], rot_x:rot_x + rt.shape[1], :3] = rt
            canvas[:rt.shape[0], rot_x:rot_x + rt.shape[1], 3] = 255
            report["materials"][sw["rotate"]] = [rot_x, 0, rt.shape[1], rt.shape[0]]
            rot_x += rt.shape[1]
    # derived from another material: a darkened copy (review fix, e.g. a wall top made from the wood floor)
    for sw in sheet["swatches"]:
        dm = sw.get("derive_material")
        if not dm:
            continue
        src_rect = report["materials"][dm["from"]]
        sx0, sy0, sw_w, sw_h = src_rect
        (c, r), (tw, th) = sw["at"], sw["tiles"]
        tex = canvas[sy0:sy0 + th * 48, sx0:sx0 + tw * 48, :3].astype(np.float32) * dm.get("shade", 1.0)
        tex = make_seamless_x(PX.snap15(tex)) if sw.get("wrap") == "x" else PX.snap15(tex)
        canvas[r * 48:(r + th) * 48, c * 48:(c + tw) * 48, :3] = tex
        report["materials"][sw["name"]] = [c * 48, r * 48, tw * 48, th * 48]
        report["wrap_after"][sw["name"]] = round(seam_ratio(tex), 2)
        report.setdefault("derived", {})[sw["name"]] = f"{dm['from']} x {dm.get('shade', 1.0)}"
    # derived materials: e.g. wall_face from the arrow-slit piece with the slit painted out (same bricks as the part)
    for sw in sheet["swatches"]:
        src = sw.get("derive_from")
        if not src:
            continue
        sp = next(q for q in sheet["swatches"] if q["name"] == src)
        (sc, sr) = sp["at"]
        part = canvas[sr * 48:(sr + 1) * 48, sc * 48:(sc + 1) * 48]
        tex = make_seamless_x(paint_out(part)[..., :3])
        (c, r), (tw, th) = sw["at"], sw["tiles"]
        canvas[r * 48:(r + th) * 48, c * 48:(c + tw) * 48, :3] = np.tile(tex, (th, tw, 1))
        report["wrap_after"][sw["name"]] = round(seam_ratio(np.tile(tex, (1, tw, 1))), 2)
        report.setdefault("derived", {})[sw["name"]] = f"{src} with its feature painted out, seamless left-right"
    pitch, conf, _, _ = PX.detect_pitch(np.asarray(raw.convert("RGB")))
    sx = raw.width / size[0]
    dens = {sw["name"]: round(report["piece_px"][sw["name"]][0] * sx / pitch / sw["tiles"][0], 1)
            for sw in sheet["swatches"]} if pitch else {}
    report.update({"drawn_pitch_raw_px": round(pitch, 2), "pitch_conf": round(conf, 2),
                   "native_px_per_tile": dens})
    derived = {sw["name"] for sw in sheet["swatches"] if sw.get("derive_from") or sw.get("match_scale")}
    report["pass"] = {
        # the model sizes each piece itself; what matters is that each piece's drawn pixels map to 40-64 per tile
        "density": bool(dens) and all(40 <= v <= 64 for k, v in dens.items() if k not in derived),
        "seamless": all(v <= 1.5 for v in report["wrap_after"].values()),
    }
    return Image.fromarray(canvas), report


def _cut_props(rgb: np.ndarray, sheet: dict, rects: dict, report: dict, canvas: np.ndarray,
               seed: int) -> tuple[Image.Image, dict]:
    """Props: everything drawn in (and slightly around) each box is the object; it keeps its drawn proportions,
    scaled by the box (box width -> its tiles x 48 native px), and stands on the bottom edge of its cells,
    centred. Magenta becomes transparent."""
    page = PX.magenta_bg(rgb)
    fg_all = _open(~page, 2)
    per_colors = sheet.get("colors_per_material", 16)
    report["prop_px"], report["scale"], report["skipped"] = {}, {}, []
    # scale: by the drawn pixel size (one native px per drawn pixel, like the other kit sheets) when the sheet says
    # `scale: pitch`, else by the box (box width -> its tiles x 48 native px)
    pitch = None
    if sheet.get("scale") == "pitch":
        pitch, conf, _, _ = PX.detect_pitch(rgb)
        report["pitch_px"] = round(pitch, 2)
    for i, sw in enumerate(sheet["swatches"]):
        name, (c, r), (tw, th) = sw["name"], sw["at"], sw["tiles"]
        if sw.get("skip"):                           # review: the model did not draw it (placeholder stays)
            report["skipped"].append(name)
            continue
        x0, y0, x1, y1 = rects[name]
        pad = (x1 - x0) // 10
        X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
        if sw.get("source"):                         # review fix: where the model actually drew it (guide px)
            X0, Y0, X1, Y1 = sw["source"]
        fg = fg_all[Y0:Y1, X0:X1]
        ys, xs = np.where(fg)
        if not len(ys):
            raise ValueError(f"prop sheet: nothing drawn in the {name} box")
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop, mask = rgb[Y0:Y1, X0:X1][by0:by1, bx0:bx1], fg[by0:by1, bx0:bx1].copy()
        if sw.get("key_border") and sw.get("key_mode") == "v1":
            # first keying version (median of the crop border); kept so the approved castle props reproduce exactly
            ring = np.concatenate([crop[0], crop[-1], crop[:, 0], crop[:, -1]]).astype(np.int32)
            bg = np.median(ring, axis=0)
            mask &= np.abs(crop.astype(np.int32) - bg).sum(-1) > sw.get("key_tol", 60)
            ys2, xs2 = np.where(mask)
            if len(ys2):
                crop = crop[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
                mask = mask[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
        elif sw.get("key_border"):                   # review fix: drop a backdrop the model painted behind it
            k_in = 4                                 # sample inside the edge (the edge blends with magenta)
            inner = crop[k_in:-k_in, k_in:-k_in]
            imask = mask[k_in:-k_in, k_in:-k_in]
            ring = np.concatenate([inner[0], inner[-1], inner[:, 0], inner[:, -1]]).astype(np.int32)
            rfg = np.concatenate([imask[0], imask[-1], imask[:, 0], imask[:, -1]])
            ring = ring[rfg] if rfg.any() else ring
            q = ring // 8
            keys, counts = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
            kk = keys[counts.argmax()]
            bg = np.array([kk // 1024, (kk // 32) % 32, kk % 32]) * 8 + 4    # most common backdrop colour
            ci = crop.astype(np.float32)
            mag = np.array([255.0, 0.0, 255.0])
            d = mag - bg
            t = np.clip(((ci - bg) @ d) / (d @ d), 0, 1)[..., None]
            residual = np.abs(ci - (bg + t * d)).sum(-1)       # distance from the backdrop..magenta blend line
            mask &= residual > sw.get("key_tol", 60) * 0.5
            mask &= np.abs(ci - bg).sum(-1) > sw.get("key_tol", 60)
            ys2, xs2 = np.where(mask)
            if len(ys2):
                crop = crop[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
                mask = mask[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
        scale = 1 / pitch if pitch else tw * 48 / (x1 - x0)   # native px per guide px
        if sw.get("fill"):                           # review fix: drawn small in fine pixels; fill its cells
            scale = min(tw * 48 / crop.shape[1], th * 48 / crop.shape[0]) * sw.get("fill_ratio", 0.96)
        ow, oh = max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))
        f = min(1.0, tw * 48 / ow, th * 48 / oh)     # never larger than its cells
        ow, oh = max(1, round(ow * f)), max(1, round(oh * f))
        lab, cent = _quantize(crop[mask].reshape(-1, 1, 3), per_colors, seed + i)
        full = np.full(mask.shape, len(cent), np.int32)
        full[mask] = lab[:, 0]
        idx = _block_mode(full, ow, oh, len(cent) + 1)
        img = np.zeros((oh, ow, 4), np.uint8)
        solid = idx < len(cent)
        img[solid, :3] = cent[idx[solid]]
        img[solid, 3] = 255
        cx0 = c * 48 + (tw * 48 - ow) // 2
        cy0 = r * 48 + (th * 48 - oh if sw.get("align", "bottom") == "bottom" else (th * 48 - oh) // 2)
        canvas[cy0:cy0 + oh, cx0:cx0 + ow] = img
        for j, row in enumerate(sw.get("parts") or [[name]]):
            for q, part in enumerate(row):
                report["cells"][r + j][c + q] = part
        report["prop_px"][name] = [ow, oh]
        report["scale"][name] = round(f, 2)
    report["pass"] = {
        "fits": all(v >= 0.6 for v in report["scale"].values()),      # not drawn far larger than its cells
        "not_tiny": all(w >= 24 or h >= 24 for w, h in report["prop_px"].values()),
    }
    return Image.fromarray(canvas), report

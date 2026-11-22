"""The cutter functions of the town-theme sheets (pass AR, AR-W / AR-W2; driven by town_theme_cut.py).

A house or inn render is an SD3.5 image-to-image result of a flat colour guide drawn on the kit's part grid: a w x h
cell building at GUIDE_CELL px per cell, centred on a white canvas with GUIDE_MARGIN px round it (each side rounded
up to a multiple of 64). `module` crops the render at that box and resamples it to 48 px per cell; `cells` names the
kit cells <part>@<theme> (build_map.styled picks them for roof=<theme> / wall=<theme>). Set pieces and props are
Stability Ultra sprites on white, cut by landmark_pix (flood cut, box resample, 15-bit k-means, binary alpha).
Deterministic: seeded k-means and sampling, no hash order.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter

from gen import landmark_pix as LP
from gen.pixelize import components, flood_bg, kmeans, snap15

T = 48
GUIDE_CELL, GUIDE_MARGIN = 160, 112


def guide_box(w: int, h: int) -> tuple[tuple[int, int], tuple[int, int, int, int]]:
    W, H = w * GUIDE_CELL + 2 * GUIDE_MARGIN, h * GUIDE_CELL + 2 * GUIDE_MARGIN
    W, H = (W + 63) // 64 * 64, (H + 63) // 64 * 64
    ox, oy = (W - w * GUIDE_CELL) // 2, (H - h * GUIDE_CELL) // 2
    return (W, H), (ox, oy, ox + w * GUIDE_CELL, oy + h * GUIDE_CELL)


def quantize(rgb: np.ndarray, solid: np.ndarray, colors: int, seed: int = 0) -> np.ndarray:
    px = rgb[solid].astype(np.float32)
    rng = np.random.default_rng(seed)
    pick = rng.choice(len(px), min(len(px), 20000), replace=False)
    cent = snap15(kmeans(px[pick], colors, seed=seed)).astype(np.float32)
    lab = ((px[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
    out = np.zeros_like(rgb, dtype=np.uint8)
    out[solid] = cent[lab].astype(np.uint8)
    return out


def module(raw: Image.Image, w: int, h: int, colors: int = 20, tol: int = 24, sharpen: float = 0.6) -> Image.Image:
    """The render cropped at the guide's box, resampled to w x h cells (box filter on the premultiplied figure),
    15-bit k-means colours, binary alpha (no outline: the render draws its own ink)."""
    size, (bx0, by0, bx1, by1) = guide_box(w, h)
    sx, sy = raw.width / size[0], raw.height / size[1]
    rgb = np.asarray(raw.convert("RGB"))
    fg = ~flood_bg(rgb, tol)
    box = (round(bx0 * sx), round(by0 * sy), round(bx1 * sx), round(by1 * sy))
    crop = np.dstack([rgb, fg * 255]).astype(np.uint8)[box[1]:box[3], box[0]:box[2]]
    pm = crop.astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    small = np.asarray(Image.fromarray(pm.astype(np.uint8), "RGBA").resize((w * T, h * T), Image.BOX)).astype(np.float32)
    a = small[..., 3]
    col = np.where(a[..., None] > 0, small[..., :3] * 255 / np.maximum(a[..., None], 1), 0)
    if sharpen:
        col = np.asarray(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(
            ImageFilter.UnsharpMask(1, int(60 * sharpen), 2))).astype(np.float32)
    solid = a > 127
    q = quantize(col, solid, colors)
    return Image.fromarray(np.dstack([q, solid * 255]).astype(np.uint8), "RGBA")


def _plain(cell: np.ndarray, band: np.ndarray) -> np.ndarray:
    """An upper wall cell with its window painted over by `band` (rows of plain wall) repeated down from row 4."""
    out = cell.copy()
    for y in range(4, 44, len(band)):
        n = min(len(band), 44 - y)
        out[y:y + n] = band[:n]
    return out


def cells(house: Image.Image, theme: str, w: int = 5, roof_rows: int = 2, door: int = 2,
          crops: dict | None = None, plain_band: list | None = None) -> dict[str, Image.Image]:
    """The kit cells of a w x (roof_rows + 3) two-storey house render (rows: ridge, eave, up2, up, lo).
    crops: {part: [x, y]} native px origins overriding the grid cell of that part (a render whose windows drifted
    off the grid); plain_band: [x, y, rows] the plain-wall rows that paint over the window (default: the lo row's middle)."""
    def at(col, row):
        return [col * T, row * T]
    up, lo = roof_rows + 1, roof_rows + 2
    m = w // 2
    grid = {}
    for row, rn in enumerate(["ridge", "eave"][:roof_rows]):
        grid |= {f"roof_{rn}_l": at(0, row), f"roof_{rn}_m": at(m, row), f"roof_{rn}_r": at(w - 1, row)}
    grid |= {"roof_mid_l": [0, T // 2], "roof_mid_m": [m * T, T // 2], "roof_mid_r": [(w - 1) * T, T // 2],
             "wall_up_l": at(0, up), "wall_up_window": at(1, up), "wall_up_r": at(w - 1, up),
             "wall_door_top": at(door, up), "wall_door_bottom": at(door, lo),
             "wall_lo_l": at(0, lo), "wall_lo_plain": at(1, lo), "wall_lo_r": at(w - 1, lo)}
    grid |= {"wall_up2_l": at(0, roof_rows), "wall_up2_window": at(1, roof_rows), "wall_up2_r": at(w - 1, roof_rows)}
    grid |= {"wall_up2_" + k[8:]: v for k, v in (crops or {}).items() if k.startswith("wall_up_")}
    grid |= crops or {}
    out = {f"{n}@{theme}": house.crop((x, y, x + T, y + T)) for n, (x, y) in grid.items()}
    arr = np.asarray(house)
    if plain_band:
        bx, by, rows = plain_band
        band = arr[by:by + rows, bx:bx + T]
    else:
        lx, ly = grid["wall_lo_plain"]
        b = arr[ly + 8:ly + 28, lx:lx + T]            # clear of the sill above and the plinth below, mirrored:
        band = np.concatenate([b, b[::-1]])             # no seam where it repeats
    wx, wy = grid["wall_up_window"]
    plain = Image.fromarray(_plain(arr[wy:wy + T, wx:wx + T], band))
    out[f"wall_up_plain@{theme}"] = out[f"wall_up2_plain@{theme}"] = plain
    return out


def flat_roof(cellset: dict, theme: str, style: str, cornice_y: int) -> dict[str, Image.Image]:
    """A flat roof style for a domed theme: the eave cells keep only their rows from `cornice_y` down (the cornice),
    the ridge and mid rows are empty (the walkable row behind the house shows the ground)."""
    out = {}
    for col in ("l", "m", "r"):
        arr = np.asarray(cellset[f"roof_eave_{col}@{theme}"]).copy()
        arr[:cornice_y] = 0
        out[f"roof_eave_{col}@{style}"] = Image.fromarray(arr)
        for row in ("ridge", "mid"):
            out[f"roof_{row}_{col}@{style}"] = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    return out


def one_storey(house: Image.Image) -> Image.Image:
    """5 x 4: the 5 x 5 house without its up2 row (as the compiler assembles a 1-storey house)."""
    out = Image.new("RGBA", (house.width, 4 * T))
    out.paste(house.crop((0, 0, house.width, 2 * T)), (0, 0))
    out.paste(house.crop((0, 3 * T, house.width, 5 * T)), (0, 2 * T))
    return out


def recolor(img: Image.Image, hue: float, sat: float, val: float) -> Image.Image:
    """build_map._recolor: an HSV hue shift (degrees), saturation and value factors; alpha kept."""
    hsv = np.asarray(img.convert("RGB").convert("HSV")).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue * 255 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    out = Image.frombytes("HSV", img.size, hsv.astype(np.uint8).tobytes()).convert("RGB").convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def colorize(img: Image.Image, hue: float, sat: float, val: float) -> Image.Image:
    """A flat tint for a near-white wall: every pixel takes hue `hue` (degrees) and saturation `sat` (0..1), its own
    value times `val` (a relative recolour would amplify the wall's faint noise into blotches)."""
    hsv = np.asarray(img.convert("RGB").convert("HSV")).astype(np.float32)
    hsv[..., 0] = hue * 255 / 360
    hsv[..., 1] = sat * 255
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    out = Image.frombytes("HSV", img.size, hsv.astype(np.uint8).tobytes()).convert("RGB").convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def tint(cellset: dict, theme: str, new: str, hsv: tuple, ref: str = "wall_lo_plain") -> dict:
    """A wall-colour variant (hsv: (hue shift, sat, val) relative, or ("abs", hue, sat, val) a flat tint): only the
    pixels near the wall's own colour (the median of the `ref` cell) are recoloured, so windows, doors and trims keep theirs; 15-bit snapped."""
    r = np.asarray(cellset[f"{ref}@{theme}"])
    med = np.median(r[r[..., 3] > 0][:, :3], 0)
    out = {}
    for n, im in cellset.items():
        if not n.startswith("wall_") or n.startswith("wall_door_"):
            continue
        arr = np.asarray(im).copy()
        near = (np.abs(arr[..., :3].astype(int) - med).sum(-1) < 90) & (arr[..., 3] > 0)
        rec = np.asarray(colorize(im, *hsv[1:]) if hsv[0] == "abs" else recolor(im, *hsv))
        arr[near] = rec[near]
        arr[..., :3] = snap15(arr[..., :3].astype(np.float32))
        out[n.replace(f"@{theme}", f"@{new}")] = Image.fromarray(arr)
    for n in ("wall_door_top", "wall_door_bottom"):
        out[f"{n}@{new}"] = cellset[f"{n}@{theme}"]
    return out


def whiten(raw: Image.Image, tol: float, passes: int) -> Image.Image:
    """Pass CD (`bg_passes`): flood the border colour to white `passes` times, for a two-tone backdrop (a grey
    vignette or letterbox bars over white) that one flood cannot take (CD-P's cdcut2.py `whiten`)."""
    a = np.asarray(raw.convert("RGB")).copy()
    for _ in range(passes):
        a[flood_bg(a, tol)] = 255
    return Image.fromarray(a)


def sprite(raw: Image.Image, size: tuple[int, int], cut: dict | None = None, px: dict | None = None) -> Image.Image:
    cut = dict(cut or {})
    passes = cut.pop("bg_passes", 0)
    if passes:
        raw = whiten(raw, cut.get("tol", 28), passes)
    rgb, fg = LP.cutout(raw, None, **({"rim": 4} | cut))
    return LP.pix(size, rgb, fg, **({"fill": 0.95, "colors": 16} | (px or {})))[0]


def split(raw: Image.Image, n: int, tol: int = 28, pad: int = 12, min_frac: float = 0.03) -> list[Image.Image]:
    """The n largest separate figures of a props sheet, left to right, each on white with padding."""
    rgb = np.asarray(raw.convert("RGB"))
    fg = ~flood_bg(rgb, tol)
    k = 6
    small = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).resize((rgb.shape[1] // k, rgb.shape[0] // k),
                                                                          Image.BOX)) > 40
    small = np.asarray(Image.fromarray((small * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    lab, cnt = components(small)
    sizes = sorted(((lab == i).sum(), i) for i in range(1, cnt + 1))[::-1]
    keep = [i for s, i in sizes[:n] if s >= min_frac * sizes[0][0]]
    boxes = []
    for i in keep:
        ys, xs = np.where(lab == i)
        boxes.append((xs.min() * k, ys.min() * k, (xs.max() + 1) * k, (ys.max() + 1) * k))
    out = []
    for x0, y0, x1, y1 in sorted(boxes):
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
        crop = Image.new("RGB", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), "white")
        crop.paste(Image.fromarray(rgb[y0:y1, x0:x1].copy()), (pad, pad))
        out.append(crop)
    return out


def seamless(tex: Image.Image, w: int, h: int, colors: int = 16, wrap_x: bool = True) -> np.ndarray:
    """A wrapping w x h material swatch (RGB): resample, cross-fade the wrap with a half-offset copy, quantize.
    wrap_x False: only the vertical wrap is blended (a bridge deck whose side bands must stay put)."""
    a = np.asarray(tex.convert("RGB").resize((w, h), Image.BOX)).astype(np.float32)
    b = np.roll(a, h // 2, 0)
    yy, xx = np.mgrid[0:h, 0:w]
    wy = np.minimum(yy, h - 1 - yy) / (h / 2)
    if wrap_x:
        b = np.roll(b, w // 2, 1)
        wy = np.minimum(wy, np.minimum(xx, w - 1 - xx) / (w / 2))
    wgt = np.clip(wy * 2.2, 0, 1)[..., None]
    return quantize(a * wgt + b * (1 - wgt), np.ones((h, w), bool), colors)

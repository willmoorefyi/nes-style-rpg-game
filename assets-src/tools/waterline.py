"""WL: a moored boat partly under water (deco `waterline: <art px>`), baked by the map compiler.

A deco with `waterline: n` (whole native px from the top of its parts grid; `on_water: true`, no `above` rows) is
drawn as usual above row n. On row n a 1 px light ripple runs along the hull (one px past it each side, where there
is water). Below it the art is seen through the water: a 4x4 ordered (Bayer) dither keeps 8 of 16 pixels just under
the line, thinning to 4 of 16 by DEEP px down, and each kept pixel is the art mixed toward its shape in the water's
hue (the water pixel under it, darkened or lit by the art's luminance; TINT0 just under the line, up to TINT1 deep).
Every output colour is snapped to 15 bits and the alpha stays binary: a dropped pixel is simply not drawn, so the
water shows through.

    python3 -I assets-src/tools/waterline.py      # selftest (also run by build_map.py --selftest)
"""
from __future__ import annotations

import numpy as np
from PIL import Image

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.int16)
SHOW0, SHOW1 = 8, 4          # dither pixels kept of 16: just under the line, and from DEEP px down
DEEP = 24                    # px under the line where the fade ends
TINT0, TINT1 = 0.55, 0.8     # share of the water-hued shape in a kept pixel: just under the line, and deep
SHADE_LO, SHADE_SPAN = 0.5, 0.6   # the shape: the water pixel x (SHADE_LO + SHADE_SPAN x the art's luminance 0..1)
RIPPLE = (232, 240, 248)     # the ripple: the water colour mixed RIPPLE_MIX toward this foam white
RIPPLE_MIX = 0.6


def snap15(c: np.ndarray) -> np.ndarray:
    """The 15-bit colour (5 bits a channel, gen/pixelize.snap15)."""
    v = np.clip(np.round(np.asarray(c, np.float64) / 255.0 * 31.0), 0, 31).astype(np.int32)
    return ((v << 3) | (v >> 2)).astype(np.uint8)


def check(o: dict, rows: int, T: int) -> str | None:
    """The problem with a deco's `waterline`, or None: a whole px inside the art, on water, no above rows."""
    line = o.get("waterline")
    if line is None:
        return None
    if isinstance(line, bool) or not isinstance(line, int) or not 1 <= line < rows * T:
        return f"waterline {line!r} must be a whole px in 1..{rows * T - 1}"
    if not o.get("on_water"):
        return "waterline needs on_water: true"
    if o.get("above") or o.get("above_rows"):
        return "waterline takes no above rows"
    return None


def blend(art: np.ndarray, under: np.ndarray, line: int) -> np.ndarray:
    """art: h x w x 4 uint8 (binary alpha), under: h x w x 3 (the canvas below it). Returns the h x w x 4 layer to
    composite: the art above `line`, the ripple on it and the dithered, water-tinted art below."""
    h, w = art.shape[:2]
    out = art.copy()
    solid = art[..., 3] > 127
    out[..., 3] = np.where(solid, 255, 0)
    if line >= h:
        return out
    ys, xs = np.mgrid[0:h, 0:w]
    d = ys - line                                            # px under the line (0 = the line itself)
    t = np.clip((d - 1) / max(1, DEEP - 1), 0.0, 1.0)
    show = np.rint(SHOW0 + (SHOW1 - SHOW0) * t)
    keep = BAYER4[ys % 4, xs % 4] < show
    tint = (TINT0 + (TINT1 - TINT0) * t)[..., None]
    deep = (d > 0) & solid
    rgb = art[..., :3].astype(np.float64)
    lum = (rgb @ np.array([0.299, 0.587, 0.114]) / 255.0)[..., None]
    shape = under.astype(np.float64) * (SHADE_LO + SHADE_SPAN * lum)     # the art's light and shade, in the water's hue
    mixed = snap15(rgb * (1 - tint) + shape * tint)
    out[deep & keep, :3] = mixed[deep & keep]
    out[deep & ~keep, 3] = 0
    cols = np.where(solid[line])[0]
    if len(cols):
        lo, hi = max(0, cols.min() - 1), min(w - 1, cols.max() + 1)
        span = np.zeros(w, bool); span[lo:hi + 1] = True
        rip = snap15(under[line].astype(np.float64) * (1 - RIPPLE_MIX) + np.array(RIPPLE) * RIPPLE_MIX)
        out[line, span, :3] = rip[span]
        out[line, span, 3] = 255
    return out


def paint(canvas: Image.Image, parts: list, x: int, y: int, dx: int, dy: int, line: int, T: int) -> None:
    """Draw a waterline deco: its parts (rows of PIL images or None, cell (x, y), px offset (dx, dy)) composed on
    one layer, blended against the canvas under it, composited onto the canvas (the part off the canvas is cut)."""
    rows, cols = len(parts), max(len(r) for r in parts)
    layer = Image.new("RGBA", (cols * T, rows * T), (0, 0, 0, 0))
    for j, row in enumerate(parts):
        for i, im in enumerate(row):
            if im is not None:
                layer.alpha_composite(im, (i * T, j * T))
    px, py = x * T + dx, y * T + dy
    lx0, ly0 = max(0, -px), max(0, -py)
    lx1, ly1 = min(layer.width, canvas.width - px), min(layer.height, canvas.height - py)
    if lx1 <= lx0 or ly1 <= ly0:
        return
    art = np.asarray(layer)
    under = np.zeros((layer.height, layer.width, 3), np.uint8)
    under[ly0:ly1, lx0:lx1] = np.asarray(canvas.crop((px + lx0, py + ly0, px + lx1, py + ly1)).convert("RGB"))
    out = blend(art, under, line)[ly0:ly1, lx0:lx1]
    canvas.alpha_composite(Image.fromarray(np.ascontiguousarray(out)), (px + lx0, py + ly0))


def selftest() -> int:
    """A pixel test of the blend: binary alpha, 15-bit colours, untouched art above the line, the ripple, the dither
    shares and the tint toward the water. Returns the number of checks."""
    h, w, line = 40, 32, 8
    art = np.zeros((h, w, 4), np.uint8)
    art[2:, 4:28] = (200, 40, 40, 255)                        # a red hull, rows 2..39, columns 4..27
    under = np.zeros((h, w, 3), np.uint8); under[:] = (24, 64, 160)
    out = blend(art, under, line)
    a = out[..., 3]
    n = 0
    assert set(np.unique(a)) <= {0, 255}, "waterline: alpha must stay binary"; n += 1
    assert np.array_equal(out[:line], art[:line]), "waterline: the art above the line is unchanged"; n += 1
    assert (a[line, 3:29] == 255).all() and (a[line, :3] == 0).all() and (a[line, 29:] == 0).all(), \
        "waterline: the ripple spans the hull and one px either side"; n += 1
    rip = out[line, 10, :3].astype(int)
    assert rip.sum() > np.array(under[0, 0], int).sum() + 150 and np.array_equal(snap15(rip), rip), \
        "waterline: the ripple is a light 15-bit colour"; n += 1
    near = a[line + 1:line + 5, 4:28] > 0
    deep = a[h - 8:, 4:28] > 0
    assert abs(near.mean() - SHOW0 / 16) < 0.05 and abs(deep.mean() - SHOW1 / 16) < 0.05, \
        f"waterline: dither shares {near.mean():.2f} / {deep.mean():.2f}"; n += 1
    kept = out[line + 1:, 4:28][a[line + 1:, 4:28] > 0, :3].astype(int)
    assert len(kept) and np.array_equal(snap15(kept), kept), "waterline: kept pixels are 15-bit"; n += 1
    assert (kept[:, 2] > 40).all() and (kept[:, 0] < 200).all(), "waterline: kept pixels lean toward the water"; n += 1
    shallow = out[line + 1:line + 5, 4:28, 0][a[line + 1:line + 5, 4:28] > 0]
    low = out[h - 4:, 4:28, 0][a[h - 4:, 4:28] > 0]
    assert shallow.mean() > low.mean(), "waterline: the art fades deeper"; n += 1
    assert (a[:, :3] == 0).all() and (a[:, 29:] == 0).all(), "waterline: nothing drawn beside the hull"; n += 1
    assert check({"waterline": 8, "on_water": True}, 2, 48) is None; n += 1
    for bad, needle in (({"waterline": 0, "on_water": True}, "1..95"), ({"waterline": 96, "on_water": True}, "1..95"),
                        ({"waterline": 2.5, "on_water": True}, "whole px"), ({"waterline": 8}, "on_water"),
                        ({"waterline": 8, "on_water": True, "above_rows": 1}, "above rows")):
        msg = check(bad, 2, 48)
        assert msg and needle in msg, f"waterline: check({bad}) gave {msg!r}"; n += 1
    canvas = Image.new("RGBA", (64, 48), (24, 64, 160, 255))     # paint: off the left edge, against the canvas
    part = Image.fromarray(np.ascontiguousarray(art[:40, :32])).resize((48, 48), Image.NEAREST)
    paint(canvas, [[part]], 0, 0, -10, 0, 20, 48)
    c = np.asarray(canvas)
    assert (c[..., 3] == 255).all() and np.array_equal(c[5, 0, :3], part.getpixel((10, 5))[:3]), \
        "waterline: paint cuts the part off the canvas and keeps the art above the line"; n += 1
    assert np.array_equal(c[30, 50:, :3], np.tile([24, 64, 160], (14, 1))), "waterline: water beside the hull"; n += 1
    return n


if __name__ == "__main__":
    print(f"waterline selftest: {selftest()} checks passed")

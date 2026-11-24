"""EF2 keying and pose warps for monster_br2.py: SD 3.5 paints a flat grey (or green) page instead of the magenta
key, so the page is keyed offline (no remove_bg call), and the attack / hurt / kneel guides are the NEW idle's figure
warped about its feet."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from gen import monster as M

SIDE, KEY, FEET = 1024, (255, 0, 255), 0.92


def square(img: Image.Image) -> Image.Image:
    """A portrait render (aspect 2:3) fitted into the SIDE square, padded with its border's median colour."""
    img = img.convert("RGB")
    if img.width == img.height:
        return img.resize((SIDE, SIDE), Image.Resampling.LANCZOS)
    f = np.asarray(img).astype(int)
    med = tuple(int(c) for c in np.median(np.concatenate([f[0], f[-1], f[:, 0], f[:, -1]]), 0))
    s = 0.92 * SIDE / max(img.size)               # a margin all round: feet cut by the page edge stay inside
    im = img.resize((round(img.width * s), round(img.height * s)), Image.Resampling.LANCZOS)
    out = Image.new("RGB", (SIDE, SIDE), med)
    out.paste(im, ((SIDE - im.width) // 2, round(0.96 * SIDE) - im.height))
    return out


def key_bg_v1(img: Image.Image, thresh: int = 30) -> Image.Image:
    """Guide keying of the first EF2 pose requests (kept so their cache keys reproduce): PIL floodfill from border
    points; it also eats dark figure pixels (pirate attack v3's legs), so key_bg replaced it for the cut."""
    from PIL import ImageDraw
    out = img.convert("RGB").resize((SIDE, SIDE), Image.Resampling.LANCZOS)
    for i in range(0, SIDE, 32):
        for xy in ((i, 0), (i, SIDE - 1), (0, i), (SIDE - 1, i)):
            if out.getpixel(xy) != KEY:
                ImageDraw.floodfill(out, xy, KEY, thresh=thresh)
    return deshadow(out)


def key_bg(img: Image.Image, thresh: int = 30, green: bool = False, floor: float | None = None,
           holes: int = 0) -> Image.Image:
    """SD 3.5 ignores the magenta request on a text-to-image page (a flat grey page) and paints the key unevenly on
    image-to-image: every pixel near the border's median colour or magenta-ish (PX.magenta_bg), connected to the
    border, becomes the key; then the cast shadow (`deshadow`). Offline, no remove_bg call."""
    from PIL import ImageDraw
    from gen import pixelize as PX
    if floor:                                       # a painted ground strip below this share of the height: page
        img = img.convert("RGB").copy()
        f0 = np.asarray(img).astype(int)
        med0 = tuple(int(c) for c in np.median(f0[0], 0))
        img.paste(med0, (0, int(floor * img.height), img.width, img.height))
    a = np.asarray(square(img)).copy()
    f = a.astype(int)
    border = np.concatenate([f[0], f[-1], f[:, 0], f[:, -1]])
    med = np.median(border, 0)
    cand = (np.abs(f - med).max(2) <= thresh) | PX.magenta_bg(a)
    if green:                                       # a painted grass strip (no green in the design)
        cand |= (f[..., 1] > f[..., 0] + 25) & (f[..., 1] > f[..., 2] + 25)
    m = Image.fromarray(np.where(cand, 255, 0).astype(np.uint8)).copy()   # a numpy-backed image does not take the fill
    for i in range(0, SIDE, 16):
        for xy in ((i, 0), (i, SIDE - 1), (0, i), (SIDE - 1, i)):
            if m.getpixel(xy) == 255:
                ImageDraw.floodfill(m, xy, 128)
    keyed = np.asarray(m) == 128
    if holes:                                       # enclosed page pockets (between a robe and a staff) too
        lab, n = PX.components(cand & ~keyed)
        sizes = np.bincount(lab.ravel())
        keyed |= np.isin(lab, [i for i in range(1, n + 1) if sizes[i] >= holes])
    a[keyed] = KEY
    return deshadow(Image.fromarray(a))


def deshadow(img: Image.Image) -> Image.Image:
    """Key the grey cast shadow SD 3.5 paints under the feet: low-saturation mid-dark pixels in the bottom 7 % of
    the figure's rows (boots are black or brown and survive)."""
    a = np.asarray(img).copy()
    f = a.astype(int)
    fg = ~((f[..., 0] > 150) & (f[..., 2] > 150) & (f[..., 1] < 100))
    ys = np.where(fg.any(1))[0]
    if not len(ys):
        return img
    y0 = ys.max() - int(0.07 * (ys.max() - ys.min()))
    mx, mn = f.max(2), f.min(2)
    sh = fg & (mx - mn < 22) & (mx > 55) & (mx < 150)
    sh[:y0] = False
    bg = ~fg
    for _ in range(80):                    # only shadow reachable from the page (not grey pixels inside the boots)
        p = np.pad(bg, 1)
        grow = sh & ~bg & (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])
        if not grow.any():
            break
        bg |= grow
    a[bg & fg] = KEY
    return Image.fromarray(a)


def figure(img: Image.Image, key: int = 1, floor: float | None = None) -> tuple[np.ndarray, np.ndarray]:
    rgb = np.asarray(key_bg(img, green=key == 3, floor=floor or (0.94 if key == 3 else None),
                            holes=400 if key == 4 else 0) if key >= 2
                     else key_bg_v1(img))
    return rgb, M._figure_mask(rgb)


def warp(img: Image.Image, w: dict) -> Image.Image:
    """The idle's figure warped about its feet (bottom centre): `rot` degrees (+ leans the top toward the heroes,
    right), `sx` / `sy` scales, `shear` (+ pushes the top right), `dx` / `dy` px; on the magenta key."""
    rgb, mask = figure(img, w.get("key", 1), w.get("floor"))
    ys, xs = np.where(mask)
    if "hip" in w:                        # kneel: the legs below the hip squashed to `legs` of their height
        hy = int(ys.min() + w["hip"] * (ys.max() - ys.min()))
        lh = ys.max() + 1 - hy
        nl = max(1, round(lh * w.get("legs", 0.4)))
        top, low = rgb[:hy], np.asarray(Image.fromarray(rgb[hy:ys.max() + 1]).resize((SIDE, nl)))
        mtop, mlow = mask[:hy], np.asarray(Image.fromarray(mask[hy:ys.max() + 1]).resize((SIDE, nl)))
        rgb, mask = np.full_like(rgb, KEY), np.zeros_like(mask)
        off = lh - nl
        rgb[off:off + hy], mask[off:off + hy] = top, mtop
        rgb[off + hy:ys.max() + 1], mask[off + hy:ys.max() + 1] = low, mlow
        ys, xs = np.where(mask)
    px, py = (xs.min() + xs.max()) / 2, ys.max()
    rgba = np.dstack([rgb, mask.astype(np.uint8) * 255])
    a = math.radians(w.get("rot", 0.0))            # image y points down: + turns the top toward the right
    sx, sy, sh = w.get("sx", 1.0), w.get("sy", 1.0), w.get("shear", 0.0)
    # forward map about (px, py): p' = R . Sh . Sc . (p - pivot) + pivot + d; Image.transform needs the inverse
    fwd = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) @ np.array([[1, -sh], [0, 1]]) @ np.diag([sx, sy])
    inv = np.linalg.inv(fwd)
    ox, oy = px + w.get("dx", 0), py + w.get("dy", 0)
    c = np.array([px, py]) - inv @ np.array([ox, oy])
    fig = Image.fromarray(rgba).transform((SIDE, SIDE), Image.Transform.AFFINE,
                                                  (inv[0, 0], inv[0, 1], c[0], inv[1, 0], inv[1, 1], c[1]),
                                                  Image.Resampling.BICUBIC)
    out = Image.new("RGB", (SIDE, SIDE), KEY)
    alpha = fig.getchannel("A").point(lambda x: 255 if x > 127 else 0)
    out.paste(fig.convert("RGB"), (0, 0), alpha)
    return out

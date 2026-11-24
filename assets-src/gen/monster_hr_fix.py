"""EF-G G1 helpers for gen/monster_hr_prep.py: the per-sprite cleanups of the recipe (`graft`: pirate v4's face onto
v3; `glow_cut`: the wizard's staff glow cut back; `extend`: boots completed downward; `pool_cut`: vampire v2's blood
pool; `canvas_fixes`: the hand polygons on the placed master). No AI: numpy + Pillow."""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen.monster_hr_geom import border_seeds, depth, dilate, flood, key, poly_mask, shift


def graft(rgb: np.ndarray, g: dict) -> np.ndarray:
    """Pirate (EF-G G1): v4's face (a polygon on v4's raw) affine-fitted by 4 landmarks (eyes, nose tip, chin) onto
    the source's face, colour-matched (v4's own face statistics, re-lit by the ratio of the two faces' neighbour-ring
    luminance), the seam feathered `feather` px, then the source's `over` polygons (hat brim, collar) put back on top."""
    from gen import bedrock as B
    src = np.asarray(Image.open(B.CACHE / f"{g['source']}.png").convert("RGB")).astype(float)
    sm, dm = np.asarray(g["src_marks"], float), np.asarray(g["dst_marks"], float)
    A = np.linalg.lstsq(np.c_[dm, np.ones(len(dm))], sm, rcond=None)[0]   # dst (x, y, 1) -> src (x, y)
    fpoly = poly_mask(src.shape[:2], [g["poly"]])
    if g.get("key"):                                   # only v4's own figure px (its ear and beard edge, not its page)
        fpoly &= key(src.astype(np.uint8), g["key"])
    ring_s = dilate(fpoly, 12) & ~fpoly
    h, w, _ = rgb.shape
    inv = (A[0, 0], A[1, 0], A[2, 0], A[0, 1], A[1, 1], A[2, 1])
    warped = np.asarray(Image.fromarray(src.astype(np.uint8)).transform((w, h), Image.Transform.AFFINE, inv,
                                                                         Image.Resampling.BICUBIC)).astype(float)
    wmask = np.asarray(Image.fromarray(fpoly.astype(np.uint8) * 255).transform(
        (w, h), Image.Transform.AFFINE, inv, Image.Resampling.BILINEAR)) > 127
    ring_d = dilate(wmask, 12) & ~wmask
    lum = np.array([0.299, 0.587, 0.114])
    gain = float(np.clip((rgb[ring_d].astype(float) * lum).sum(1).mean() / max(1.0, (src[ring_s] * lum).sum(1).mean()), *g.get("gain", (0.7, 1.4))))
    face = warped * gain
    wt = (np.minimum(depth(wmask, g.get("feather", 6)), g.get("feather", 6)) / g.get("feather", 6))[..., None]
    out = rgb.astype(float) * (1 - wt) + face * wt
    over = poly_mask(rgb.shape[:2], g.get("over"))
    out[over] = rgb[over]
    return np.clip(out.round(), 0, 255).astype(np.uint8)


def glow_cut(rgb: np.ndarray, m: np.ndarray, gl: dict) -> np.ndarray:
    """Wizard (G1): inside `box`, glow-coloured figure px (green over red and blue by > `green`) further than `keep`
    px from the non-glow figure (the staff head itself) leave the figure."""
    f = rgb.astype(int)
    x0, y0, x1, y1 = gl["box"]
    box = np.zeros_like(m)
    box[y0:y1, x0:x1] = True
    glow = m & box & (f[..., 1] - np.maximum(f[..., 0], f[..., 2]) > gl.get("green", 12))
    solid = m & ~glow
    near = solid.copy()
    for k in range(gl.get("keep", 12)):                # octagonal distance: 4- and 8-neighbour rings in turn
        near = near | shift(near, 1, 0) | shift(near, -1, 0) | shift(near, 0, 1) | shift(near, 0, -1)
        if k % 2:
            near = near | shift(near, 1, 1) | shift(near, -1, -1) | shift(near, 1, -1) | shift(near, -1, 1)
    return m & ~(glow & ~near)


def extend(rgb: np.ndarray, m: np.ndarray, ext: list) -> tuple[np.ndarray, np.ndarray]:
    """Boots / hems completed downward: in columns x0..x1, the figure px of row `from` copied into rows from+1..to."""
    rgb, m = rgb.copy(), m.copy()
    for e in ext or []:
        x0, x1 = e["x"]
        cols = np.arange(x0, x1 + 1)
        cols = cols[m[e["from"], cols]]
        for y in range(e["from"] + 1, e["to"] + 1):
            rgb[y, cols], m[y, cols] = rgb[e["from"], cols], True
    return rgb, m


def pool_cut(rgb: np.ndarray, m: np.ndarray, q: dict) -> np.ndarray:
    """Vampire v2 (G1): inside the pool's zone, the pool's purple shadow, red and white px leave the figure; boot px of
    those colours enclosed by the boot come back."""
    f = rgb.astype(int)
    z = poly_mask(rgb.shape[:2], [q["poly"]])
    pool = (f[..., 0] >= q["purple"][0]) & (f[..., 2] >= q["purple"][1])
    pool |= (f[..., 0] >= q["red"][0]) & (f[..., 1] < q["red"][1])
    pool |= f.min(2) >= q["light"]
    m = m & ~(z & pool)
    return m | (z & ~m & ~flood(~m, border_seeds(*m.shape)))


def canvas_fixes(a: np.ndarray, p: dict, rgb: np.ndarray, full: np.ndarray | None = None) -> np.ndarray:
    """The hand fixes on the placed master (canvas coordinates): `restore_out` (the raw px back), `erase_hue` (page-teal
    px only), `erase_out`, `paint_out` (nearest fill) and `despeck` (page-grey specks); `full` is the unkeyed raw crop on
    the canvas."""
    if p.get("restore_out"):                           # figure px the key took that no colour rule can tell from the
        r = poly_mask(a.shape[:2], p["restore_out"])   # page (the hat's teal-lit crown): the raw px, by hand polygon
        a[r, :3], a[r, 3] = full[r], 255
    if p.get("erase_hue"):                             # page-teal px only inside these polygons (floor shadows)
        f = a[..., :3].astype(int)
        teal = (np.minimum(f[..., 1], f[..., 2]) - f[..., 0] > 40) & (f[..., 1:].max(2) > 70) & (f[..., 0] < 70)
        a[poly_mask(a.shape[:2], p["erase_hue"]) & teal] = 0
    if p.get("erase_out"):                             # leftovers found on the master (canvas coordinates)
        a[poly_mask(a.shape[:2], p["erase_out"])] = 0
    if p.get("paint_out"):                             # stray px (a magenta cross on the tabard): nearest fill
        from gen.monster_hr_warp import nearest_fill
        a = nearest_fill(np.where(poly_mask(a.shape[:2], [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]] for x0, y0, x1, y1
                                                          in p["paint_out"]])[..., None], 0, a).astype(np.uint8),
                         poly_mask(a.shape[:2], [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]] for x0, y0, x1, y1
                                                 in p["paint_out"]]) & (a[..., 3] > 0))
    if p.get("despeck"):                               # page-grey specks in tattered hems (canvas coordinates): px
        d, f = p["despeck"], a[..., :3].astype(int)    # near the page colour and unsaturated, inside the polygons
        pg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), 0)
        grey = (np.abs(f - pg).max(2) <= d["tol"]) & (f.max(2) - f.min(2) <= d["sat"])
        a[poly_mask(a.shape[:2], d["polys"]) & grey] = 0
    return a

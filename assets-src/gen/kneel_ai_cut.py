"""D-KA6 cut of a raw AI kneel (docs/KNEEL_AI_PLAN.md 4; offline). `monster.cut` is not used.

1. mask: flood the key from the border at full resolution (`pixelize.flood_bg`, tol 40); keep the largest component
   plus the pieces inside its bounding box (`keep_pieces: all_in_cell` sprites keep every piece);
2-4. one uniform canvas scale s: arm (d) is scaled from its figure height to the band midpoint (flagged for J1
   A-scale); the width rule shrinks a figure wider than (w - 2) x k by at most 8 % (more: A-width FAIL); a height up
   to 2 px outside the band is corrected once (more: left to K-height);
   (momus rev-4 P2) the window is re-centred on the figure's base centroid x and foot row, and a figure touching the
   window edge fails ("figure touches the window edge") instead of being clipped;
5. the k*w x k*h window is cropped and pixelized once: `pixelize(window, mask, grid=(w, h), palette=<ndarray>)`;
6. flat blocks keep their colour (`restore_uniform`, crisp input only) and the one-pass outline peel;
7. the figure's lowest solid row (pixelize's own `cov > 110` rule) goes on the foot row (bottom_row, floaters the
   idle's lowest opaque row) and the pixelize ring below it is dropped. `pixelize` gets bottom_row=None: its
   align_bottom would put the ring, not the figure, on the foot row.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import kneel_ai_data as D
from gen import pixelize as P

TOL = 40.0
WIDTH_MAX = 0.08               # D-KA6.3
HEIGHT_FIX = 2                 # D-KA6.4
DIRS = ((0, 1), (0, -1), (1, 0), (-1, 0))


class CutFail(ValueError):
    pass


def figure_mask(rgb: np.ndarray, keep_all: bool = False) -> np.ndarray:
    fg = ~P.flood_bg(rgb, TOL)
    lab, n = P.components(fg)
    if n <= 1 or keep_all:
        return fg
    sizes = np.bincount(lab.ravel())[1:]
    main = int(sizes.argmax()) + 1
    ys, xs = np.nonzero(lab == main)
    box = (ys.min(), ys.max(), xs.min(), xs.max())
    keep = np.zeros(n + 1, bool)
    keep[main] = True
    for i in range(1, n + 1):
        cy, cx = np.nonzero(lab == i)
        keep[i] |= bool(cy.min() >= box[0] and cy.max() <= box[1] and cx.min() >= box[2] and cx.max() <= box[3])
    return keep[lab] & fg


def _shift(m: np.ndarray, dy: int, dx: int, fill=False) -> np.ndarray:
    """out[y, x] = m[y + dy, x + dx] (fill outside)."""
    h, w = m.shape[:2]
    out = np.full_like(m, fill)
    ys, yd = slice(max(0, dy), h + min(0, dy)), slice(max(0, -dy), h + min(0, -dy))
    xs, xd = slice(max(0, dx), w + min(0, dx)), slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = m[ys, xs]
    return out


def outline_rgb(a: np.ndarray) -> tuple[int, int, int]:
    """The most common colour of the boundary pixels (opaque with a transparent 4-neighbour)."""
    op = a[..., 3] > 0
    edge = op & ~np.logical_and.reduce([_shift(op, dy, dx) for dy, dx in DIRS])
    cols, n = np.unique(a[edge][:, :3], axis=0, return_counts=True)
    return tuple(int(v) for v in cols[n.argmax()]) if len(n) else P.OUTLINE


def runs(a: np.ndarray, ink: tuple[int, int, int], cap: int = 4) -> np.ndarray:
    """Per (boundary pixel, inward normal): the run of ink pixels from the boundary inward (>= 1 entries only)."""
    op = a[..., 3] > 0
    is_ink = op & (a[..., :3] == np.array(ink, np.uint8)).all(-1)
    out = []
    for dy, dx in DIRS:                              # (dy, dx) = the inward step; the outside is at -step
        start = is_ink & ~_shift(op, -dy, -dx)
        run, ok = np.zeros(op.shape, int), start.copy()
        for i in range(cap):
            run += ok
            ok = ok & _shift(is_ink, dy * (i + 1), dx * (i + 1))
        out.append(run[start])
    return np.concatenate(out) if out else np.zeros(0, int)


def thickness(a: np.ndarray, ink: tuple[int, int, int] | None = None) -> float:
    r = runs(a, ink or outline_rgb(a))
    return float(np.median(r)) if len(r) else 0.0


def peel(a: np.ndarray, idle: np.ndarray) -> np.ndarray:
    """D-KA6.6, one pass: an outer ink pixel goes when the ink run inward from it is longer than the idle's outline
    thickness t (median, `runs`) and the pixel after the run is opaque. For t = 1 that is the plan's rule (the outer
    pixel and the one inside it are both ink); t = 2 idles (cobra) lose the extra pixelize ring the same way."""
    ink = outline_rgb(idle)
    t = max(1, int(round(thickness(idle, ink))))
    op = a[..., 3] > 0
    is_ink = op & (a[..., :3] == np.array(ink, np.uint8)).all(-1)
    gone = np.zeros(op.shape, bool)
    for dy, dx in DIRS:
        run = is_ink & ~_shift(op, -dy, -dx)
        for i in range(1, t + 1):
            run &= _shift(is_ink, i * dy, i * dx)
        gone |= run & _shift(op, (t + 1) * dy, (t + 1) * dx)
    out = a.copy()
    out[gone] = 0
    return out


def restore_uniform(nat: np.ndarray, win: np.ndarray, wm: np.ndarray, palette: np.ndarray, k: int,
                    tol: int = 8, share: float = 0.9) -> np.ndarray:
    """An opaque output pixel whose k x k block is one flat colour (>= 90 % of its figure pixels within 8 of the block
    median per channel) takes that colour's nearest palette entry: pixelize's speckle filter would otherwise erase
    1-px details of crisp input (the round trip, D-KA6.8). A soft AI block is never flat, so it is left to pixelize."""
    h, w = nat.shape[:2]
    blk = win.reshape(h, k, w, k, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, k * k, 3).astype(np.int16)
    fig = wm.reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    med = np.median(blk, axis=2).astype(np.int16)
    near = (np.abs(blk - med[:, :, None]) <= tol).all(-1) & fig
    flat = (near.sum(-1) >= share * k * k) & (nat[..., 3] > 0)
    idx = ((med[flat][:, None, :].astype(np.int32) - palette[None].astype(np.int32)) ** 2).sum(-1).argmin(1)
    out = nat.copy()
    out[flat, :3] = palette[idx]
    return out


def _snap(x0: int, rgb: np.ndarray, k: int, axis: int) -> int:
    """Crisp input (a k-upscaled sprite: >= 60 % of its colour edges on one phase mod k) keeps its own pixel grid: the
    window origin moves < k/2 canvas px (< 1 native px) onto it. AI output has no such phase and is left alone."""
    d = (rgb[:, 1:] != rgb[:, :-1]).any(-1).sum(0) if axis == 1 else (rgb[1:] != rgb[:-1]).any(-1).sum(1)
    hist = np.bincount((np.arange(1, len(d) + 1)) % k, weights=d, minlength=k)
    if hist.sum() == 0 or hist.max() < 0.6 * hist.sum():
        return x0
    off = (int(hist.argmax()) - x0) % k
    return x0 + (off if off <= k // 2 else off - k)


def _scaled(rgb: np.ndarray, m: np.ndarray, s: float, key) -> tuple[np.ndarray, np.ndarray]:
    if abs(s - 1.0) < 1e-9:
        return rgb, m
    n = (max(1, round(rgb.shape[1] * s)), max(1, round(rgb.shape[0] * s)))
    r2 = np.asarray(Image.fromarray(rgb).resize(n, Image.Resampling.LANCZOS))
    m2 = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(n, Image.Resampling.BOX)) > 127
    return r2, m2


def cut(raw: Image.Image, sp: D.Sprite, k: int, arm: str = "b", sil_h: int | None = None) -> dict:
    """{key: native RGBA, raw: block-averaged raw RGBA (A-pal / A-grey), info}; CutFail on a window-edge touch.
    Arm g (rev 7 section 2): a non-square raw fails (J0 size); the J0 pitch is measured and only aligns the window's
    phase; the scale comes from the figure against the silhouette height `sil_h` (kneel_ai_pitch)."""
    from gen import kneel_ai_pitch as PT
    key = np.array(sp.key_rgb, np.uint8)
    im = raw.convert("RGB")
    if arm == "g" and im.size[0] != im.size[1]:
        raise CutFail(f"size: non-square output {im.size[0]}x{im.size[1]} (expected 1:1)")
    resized = list(im.size) if im.size != (D.CANVAS, D.CANVAS) else None
    if resized:                                  # a non-1024 output is scaled uniformly onto the 1024 key canvas
        f = D.CANVAS / max(im.size)
        im = im.resize((round(im.size[0] * f), round(im.size[1] * f)), Image.Resampling.LANCZOS)
    rgb = np.asarray(im).copy()
    pm = PT.measure(rgb, k) if arm == "g" else None
    m = figure_mask(rgb, sp.keep_all)
    if not m.any():
        raise CutFail("empty figure (nothing but the key)")
    if m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any():
        raise CutFail("figure touches the canvas edge (cropped by the model)")
    (w, h), lo, hi = sp.cell, *sp.band_px
    ys, xs = np.nonzero(m)
    Hc, Wc = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
    info = {"arm": arm, "k": k, "fails": [], "flag_scale": arm == "d", **({"resized_from": resized} if resized else {})}
    s = (lo + hi) / 2 * k / Hc if arm == "d" else 1.0
    if arm == "g":
        s, path = PT.scale(int(Hc), sil_h, k, pm, (lo + hi) / 2)
        info.update(pitch=pm, scale_path=path, flag_scale=path is not None)
    limit = (w - 2) * k
    shrink = max(0.0, 1 - limit / (Wc * s))
    if shrink > 0:
        s *= 1 - shrink
    info["shrink_pct"] = round(100 * shrink, 2)
    if shrink > WIDTH_MAX:
        info["fails"].append(f"A-width: the figure needs a {100 * shrink:.1f} % shrink > {100 * WIDTH_MAX:.0f} % "
                             "(pose too wide)")
    n = Hc * s / k
    target = lo if round(n) < lo else hi if round(n) > hi else None
    info["height_fix_px"] = 0 if target is None else int(round(n)) - target
    if target is not None and abs(round(n) - target) <= HEIGHT_FIX:
        s *= target / n
    info["s"] = round(s, 5)
    rgb, m = _scaled(rgb, m, s, key)
    pad = max(k * w, k * h)
    big = np.zeros((rgb.shape[0] + 2 * pad, rgb.shape[1] + 2 * pad, 3), np.uint8)
    big[:] = key
    big[pad:pad + rgb.shape[0], pad:pad + rgb.shape[1]] = rgb
    bm = np.zeros(big.shape[:2], bool)
    bm[pad:pad + m.shape[0], pad:pad + m.shape[1]] = m
    foot, rows = int(np.nonzero(bm.any(1))[0].max()), D.base_rows(D.height(sp.idle))
    cx_c, cx_n = D.base_cx(bm, rows * k, sp.floating), D.base_cx(sp.idle[..., 3] > 0, rows, sp.floating)
    X0, Y0 = int(round(cx_c - k * cx_n)), foot + 1 - k * (sp.foot_row + 1)
    X0, Y0 = (PT.align(X0, pad, s, pm, k, 0), PT.align(Y0, pad, s, pm, k, 1)) if arm == "g" else \
        (_snap(X0, big, k, 1), _snap(Y0, big, k, 0))
    inner = np.zeros(bm.shape, bool)
    inner[Y0 + 1:Y0 + k * h - 1, X0 + 1:X0 + k * w - 1] = True
    if (bm & ~inner).any():
        raise CutFail(f"figure touches the window edge ({int((bm & ~inner).sum())} px on or outside the "
                      f"{k * w}x{k * h} window)")
    win, wm = big[Y0:Y0 + k * h, X0:X0 + k * w], bm[Y0:Y0 + k * h, X0:X0 + k * w]
    info["window"] = {"x0": X0 - pad, "y0": Y0 - pad, "w": k * w, "h": k * h, "k": k}
    nat = np.asarray(P.pixelize(Image.fromarray(win), wm, (w, h), palette=sp.palette, bottom_row=None)).copy()
    if not info["fails"] and abs(s - 1.0) < 1e-9:
        nat = restore_uniform(nat, win, wm, sp.palette, k)
    cov = np.asarray(Image.fromarray((wm * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BOX)) / 255.0
    solid = np.nonzero((cov * 255 > 110).any(1))[0]
    dy = sp.foot_row - int(solid.max()) if len(solid) else 0
    key_img = _shift(peel(nat, sp.idle), -dy, 0, 0)
    key_img[sp.foot_row + 1:] = 0
    info["foot_shift"] = dy
    return {"key": key_img, "raw": block_raw(win, wm, (w, h), sp.key_rgb == D.MAGENTA), "info": info}


def block_raw(rgb: np.ndarray, m: np.ndarray, grid: tuple[int, int], magenta: bool) -> np.ndarray:
    """The raw figure block-averaged onto the native grid (A-pal / A-grey), the key-colour fringe left out; alpha 255
    where a block is more than half figure."""
    if magenta:
        m = m & ~P.magenta_fringe(rgb, m)
    cov = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(grid, Image.Resampling.BOX)) / 255.0
    acc = np.asarray(Image.fromarray((rgb * m[..., None]).astype(np.uint8)).resize(grid, Image.Resampling.BOX))
    avg = np.clip(acc.astype(np.float64) / np.maximum(cov[..., None], 1e-6), 0, 255).astype(np.uint8)
    return np.dstack([avg, np.where(cov > 0.5, 255, 0).astype(np.uint8)])

"""EF-G amendment B0 helpers for gen/monster_hr_prep.py: `prep.key: remove_bg`. The body's alpha comes from the cached
Stability Remove Background output (`prep.nobg_key`, made by `monster_hr_br.py nobg <id>`) instead of a colour key;
then the graft (pirate: v4's face) is composited on top with its own alpha (its v4 polygon and v4's page key, minus
its `erase` polygons on the graft layer, e.g. the beige strip beside the ear), union with the body's alpha. The
colour-key hand polygons (`keep`, `keep_light`, `erase_hue`, `erase_out`) are ignored; `restore_out` is kept."""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen.monster_hr_geom import depth, dilate, key, poly_mask

IGNORED = ("keep", "keep_light", "erase_hue", "erase_out")


def effective(p: dict) -> dict:
    """The prep recipe as used: under `key: remove_bg` without the colour-key hand polygons; its own canvas fixes
    `nobg_erase_hue` / `nobg_erase_out` (page-teal leftovers of the remove_bg cut) take their places, and
    `nobg_deteal` clears the darker teal fringe."""
    if p.get("key") != "remove_bg":
        return p
    out = {k: v for k, v in p.items() if k not in IGNORED and not k.startswith("nobg_erase")}
    out.update({k[5:]: p[k] for k in ("nobg_erase_hue", "nobg_erase_out") if p.get(k)})
    if p.get("nobg_deteal"):                           # the darker teal fringe (gen/monster_hr_fix.canvas_fixes)
        out["deteal"] = p["nobg_deteal"]
    return out


def body_alpha(nobg: Image.Image, shape: tuple[int, int]) -> np.ndarray:
    """The remove_bg output's alpha (> 128) at the raw's size."""
    im = nobg.convert("RGBA")
    if im.size != (shape[1], shape[0]):
        im = im.resize((shape[1], shape[0]), Image.Resampling.LANCZOS)
    return np.asarray(im)[..., 3] > 128


def graft_layer(rgb: np.ndarray, alpha: np.ndarray, src: np.ndarray, g: dict) -> tuple[np.ndarray, np.ndarray]:
    """The graft (a polygon on `src`, keyed by its own page, minus `erase`) affine-fitted by the landmarks onto `rgb`,
    re-lit by the two faces' neighbour-ring luminance (body px only), feathered `feather` px into the body and drawn
    whole where the body has no px; returns (rgb, alpha | the graft's alpha); `over` polygons put back the body."""
    srcf = src.astype(float)
    sm, dm = np.asarray(g["src_marks"], float), np.asarray(g["dst_marks"], float)
    A = np.linalg.lstsq(np.c_[dm, np.ones(len(dm))], sm, rcond=None)[0]   # dst (x, y, 1) -> src (x, y)
    fpoly = poly_mask(src.shape[:2], [g["poly"]])
    if g.get("key"):
        fpoly &= key(src.astype(np.uint8), g["key"])
    fpoly &= ~poly_mask(src.shape[:2], g.get("erase"))
    h, w, _ = rgb.shape
    inv = (A[0, 0], A[1, 0], A[2, 0], A[0, 1], A[1, 1], A[2, 1])
    warped = np.asarray(Image.fromarray(src.astype(np.uint8)).transform((w, h), Image.Transform.AFFINE, inv,
                                                                         Image.Resampling.BICUBIC)).astype(float)
    wmask = np.asarray(Image.fromarray(fpoly.astype(np.uint8) * 255).transform(
        (w, h), Image.Transform.AFFINE, inv, Image.Resampling.BILINEAR)) > 127
    ring_s, ring_d = dilate(fpoly, 12) & ~fpoly, dilate(wmask, 12) & ~wmask & alpha
    lum = np.array([0.299, 0.587, 0.114])
    num = (rgb[ring_d].astype(float) * lum).sum(1).mean() if ring_d.any() else 1.0
    den = (srcf[ring_s] * lum).sum(1).mean() if ring_s.any() else 1.0
    gain = float(np.clip(num / max(1.0, den), *g.get("gain", (0.7, 1.4))))
    f = g.get("feather", 6)
    wt = np.minimum(depth(wmask, f), f) / f
    wt = np.where(alpha, wt, wmask.astype(float))[..., None]   # outside the body the graft is drawn whole
    out = rgb.astype(float) * (1 - wt) + warped * gain * wt
    over = poly_mask(rgb.shape[:2], g.get("over"))
    out[over] = rgb[over]
    return np.clip(out.round(), 0, 255).astype(np.uint8), alpha | wmask


def body(rgb: np.ndarray, p: dict) -> tuple[np.ndarray, np.ndarray]:
    """(rgb, mask) of a `key: remove_bg` recipe: the raw, its remove_bg alpha, the graft on top."""
    from gen import bedrock as B
    if not p.get("nobg_key") or not B.is_cached(p["nobg_key"]):
        raise SystemExit(f"key remove_bg: prep.nobg_key {p.get('nobg_key')} is not cached (run monster_hr_br.py nobg "
                         "<id> --paid first; the orchestrator session makes the call)")
    m = body_alpha(Image.open(B.CACHE / f"{p['nobg_key']}.png"), rgb.shape[:2])
    if p.get("graft"):
        src = np.asarray(Image.open(B.CACHE / f"{p['graft']['source']}.png").convert("RGB"))
        rgb, m = graft_layer(rgb, m, src, p["graft"])
    return rgb, m

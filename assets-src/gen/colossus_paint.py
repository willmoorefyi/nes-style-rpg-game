"""Painted colossus art (docs/CHAOS_FORMS_PLAN.md 18.1-18.2, rev 4, D-U10; FW-C): full 24-bit colour and soft 8-bit
alpha. No pixelize, quantization, palette lock, binary alpha or stepped glow levels: those rev-3 rules (colossus_layers.py)
are not used for any colossus form. Pure numpy, no network, deterministic (float64, no hash order).

Order (B1): sky_base first, then despill (18.2 step 4), then the glow (step 3).
  sky_base   the render's sky without its bright features, at a scale above the halo:
             "open": a grey opening (square, radius >= 1.5x the ring band's half-width, about 60 px at 2700 wide) that
             ignores the body (a >= 0.05), then a normalised Gaussian (sigma 40) over the sky pixels only;
             "fit":  a low-order 2-D polynomial fitted to far-field sky samples outside the ring annulus and rays.
  despill    rgb_fg = (raw - (1 - a) * sky_base) / a, clamped, for 0 < a < 0.95 (no dark-sky fringe on the light arena)
  glow G1    "diff": clamp(raw - (a * fg + (1 - a) * sky_base), 0)    (default, D-O20)
  glow G2    "lum":  raw * smoothstep(L, t0, t1) * (1 - a)              (fallback)
  feather    the glow's top rows fade in over 120 px (the render's top edge cuts the ring, 18.4)
  encode     the additive glow as straight-alpha RGBA: a = max channel, rgb = glow / a, so rgb * a == glow (Pixi `add`)
  fit        the Conservative Upscale output Lanczos-downscaled to exactly the form canvas (2700x1080 for F3); refused
             if the output is narrower than the canvas (no runtime upscale); optional pad rows are cropped first
"""
from __future__ import annotations

import numpy as np
from PIL import Image

LUMA = np.array([0.299, 0.587, 0.114])
SKY_A = 0.05            # alpha below this is sky (the glow-strength and sky checks use the same bound)
SOLID_A = 0.95          # despill band: 0 < a < SOLID_A


def luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * LUMA[0] + rgb[..., 1] * LUMA[1] + rgb[..., 2] * LUMA[2]


def split_rgba(img: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    """(rgb float64 0..255, alpha float64 0..1)."""
    a = np.asarray(img.convert("RGBA")).astype(np.float64)
    return a[..., :3], a[..., 3] / 255.0


def alpha_of(cut: Image.Image, size: tuple[int, int]) -> np.ndarray:
    """The cut's alpha (0..1) on a canvas of `size`; another size is Lanczos-resized (the C7 cut fallback, 18.2)."""
    a = cut.convert("RGBA").getchannel("A")
    if a.size != size:
        a = a.resize(size, Image.Resampling.LANCZOS)
    return np.asarray(a).astype(np.float64) / 255.0


# ───────────────────────────── morphology and blur ─────────────────────────────

def _run(a: np.ndarray, r: int, axis: int, fn: np.ufunc, pad: float) -> np.ndarray:
    """Running min / max over a centred window of 2r + 1 along `axis` (van Herk / Gil-Werman, O(n))."""
    if r <= 0:
        return a.copy()
    a = np.moveaxis(a, axis, -1)
    n, k = a.shape[-1], 2 * r + 1
    m = -(-(n + 2 * r) // k) * k
    p = np.full(a.shape[:-1] + (m,), pad)
    p[..., r:r + n] = a
    b = p.reshape(a.shape[:-1] + (m // k, k))
    g = fn.accumulate(b, axis=-1).reshape(p.shape)
    h = np.flip(fn.accumulate(np.flip(b, -1), axis=-1), -1).reshape(p.shape)
    return np.moveaxis(fn(h[..., :n], g[..., k - 1:k - 1 + n]), -1, axis)


def _box(a: np.ndarray, r: int, axis: int) -> np.ndarray:
    """Zero-padded box sum over 2r + 1 along axis (cumsum)."""
    a = np.moveaxis(a, axis, -1)
    n = a.shape[-1]
    c = np.cumsum(np.pad(a, [(0, 0)] * (a.ndim - 1) + [(r + 1, r)]), axis=-1)
    return np.moveaxis(c[..., 2 * r + 1:2 * r + 1 + n] - c[..., :n], -1, axis)


def gauss(a: np.ndarray, sigma: float) -> np.ndarray:
    """Three zero-padded box passes per axis (~Gaussian of sigma), unnormalised at the borders (use as num / den)."""
    rb = max(1, int(round((np.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2)))
    out = a.astype(np.float64)
    for axis in (0, 1):
        for _ in range(3):
            out = _box(out, rb, axis) / (2 * rb + 1)
    return out


# ───────────────────────────── sky_base ─────────────────────────────

def sky_open(raw: np.ndarray, alpha: np.ndarray, radius: int = 60, sigma: float = 40.0) -> np.ndarray:
    """Grey opening of each channel that ignores body pixels (+inf for the erosion, -inf for the dilation, so neither
    the dark body nor a ring segment touching it survives), then a normalised Gaussian over the sky pixels."""
    sky = alpha < SKY_A
    out = np.empty_like(raw)
    for c in range(3):
        x = np.where(sky, raw[..., c], np.inf)
        e = _run(_run(x, radius, 0, np.minimum, np.inf), radius, 1, np.minimum, np.inf)
        e[~sky] = -np.inf
        o = _run(_run(e, radius, 0, np.maximum, -np.inf), radius, 1, np.maximum, -np.inf)
        ok = sky & np.isfinite(o)
        num = gauss(np.where(ok, o, 0.0), sigma)
        den = gauss(ok.astype(np.float64), sigma)
        fill = float(o[ok].mean()) if ok.any() else 0.0
        out[..., c] = np.where(den > 1e-6, num / np.maximum(den, 1e-12), fill)
    return out


def far_mask(shape: tuple[int, int], alpha: np.ndarray, ring: tuple[float, float, float, float]) -> np.ndarray:
    """Far-field sky: a < SKY_A and farther than radius + 1.5 bands from the ring centre (outside annulus and rays)."""
    cx, cy, r, band = ring
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (alpha < SKY_A) & (np.hypot(xx - cx, yy - cy) >= r + 1.5 * band)


def sky_fit(raw: np.ndarray, alpha: np.ndarray, ring: tuple[float, float, float, float], deg: int = 2,
            step: int = 4) -> np.ndarray:
    """A degree-`deg` 2-D polynomial per channel, least squares on the far-field sky samples (every `step` px)."""
    h, w = alpha.shape
    m = far_mask((h, w), alpha, ring)
    sub = np.zeros_like(m)
    sub[::step, ::step] = True
    ys, xs = np.where(m & sub)
    if len(xs) < (deg + 1) * (deg + 2):
        raise ValueError(f"sky fit: {len(xs)} far-field samples are too few for degree {deg}")

    def terms(x, y):
        u, v = x / w * 2 - 1, y / h * 2 - 1
        return np.stack([u ** i * v ** j for i in range(deg + 1) for j in range(deg + 1 - i)], -1)
    coef, *_ = np.linalg.lstsq(terms(xs.astype(float), ys.astype(float)), raw[ys, xs], rcond=None)
    yy, xx = np.mgrid[0:h, 0:w]
    return np.einsum("hwk,kc->hwc", terms(xx.astype(float), yy.astype(float)), coef)


# ───────────────────────────── despill and glow ─────────────────────────────

def despill(raw: np.ndarray, alpha: np.ndarray, sky: np.ndarray) -> np.ndarray:
    """rgb_fg = (raw - (1 - a) * sky_base) / a, clamped 0..255, for 0 < a < 0.95; raw elsewhere."""
    band = (alpha > 0) & (alpha < SOLID_A)
    a = np.where(band, alpha, 1.0)[..., None]
    fg = (raw - (1 - a) * sky) / a
    return np.where(band[..., None], np.clip(fg, 0, 255), raw)


def glow_diff(raw: np.ndarray, alpha: np.ndarray, fg: np.ndarray, sky: np.ndarray) -> np.ndarray:
    """G1: the light remove_bg removed, minus the sky (fg must be the despilled cut, B1)."""
    a = alpha[..., None]
    return np.clip(raw - (a * fg + (1 - a) * sky), 0, 255)


def glow_lum(raw: np.ndarray, alpha: np.ndarray, t0: float, t1: float) -> np.ndarray:
    """G2: raw * smoothstep(L, t0, t1) outside the body."""
    t = np.clip((luma(raw) - t0) / max(t1 - t0, 1e-9), 0, 1)
    return raw * (t * t * (3 - 2 * t) * (1 - alpha))[..., None]


def feather_top(glow: np.ndarray, rows: int = 120) -> np.ndarray:
    if rows <= 0:
        return glow
    ramp = np.clip(np.arange(glow.shape[0], dtype=np.float64) / rows, 0, 1)
    return glow * ramp[:, None, None]


def encode_glow(glow: np.ndarray) -> Image.Image:
    """Straight-alpha RGBA whose rgb * a reproduces the additive glow."""
    a = np.round(glow.max(-1)).astype(np.float64)
    rgb = np.where(a[..., None] > 0, glow * 255.0 / np.maximum(a, 1)[..., None], 0)
    out = np.dstack([np.clip(np.round(rgb), 0, 255), a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def decode_glow(img: Image.Image) -> np.ndarray:
    rgb, a = split_rgba(img)
    return rgb * a[..., None]


def body_image(fg: np.ndarray, alpha: np.ndarray) -> Image.Image:
    a = np.round(alpha * 255)
    rgb = np.where(a[..., None] > 0, np.round(fg), 0)
    return Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), "RGBA")


# ───────────────────────────── the upscale fit ─────────────────────────────

def fit(up: Image.Image, canvas: tuple[int, int], src_size: tuple[int, int] | None = None,
        pad_rows: int = 0) -> Image.Image:
    """The upscale output -> exactly `canvas` (Lanczos down). `pad_rows` edge rows were added top and bottom of a
    source of `src_size` before the call; they are cropped first (scaled to the output). Refuses an output narrower
    than the canvas: the generator stops and reports, there is no runtime upscale (18.2 step 2)."""
    cw, ch = canvas
    if up.width < cw:
        raise SystemExit(f"refused: the upscale output is {up.width}x{up.height}, narrower than the {cw} px canvas; "
                         "stop and report (no runtime upscale)")
    img = up.convert("RGB")
    if pad_rows:
        if not src_size:
            raise SystemExit("refused: pad_rows needs the source size")
        cut = round(pad_rows * img.height / (src_size[1] + 2 * pad_rows))
        img = img.crop((0, cut, img.width, img.height - cut))
    if abs(img.width / img.height - cw / ch) > 0.01 * cw / ch:
        raise SystemExit(f"refused: the upscale output aspect {img.width}x{img.height} is not the canvas {cw}x{ch}")
    return img if img.size == canvas else img.resize(canvas, Image.Resampling.LANCZOS)


def pad_rows_for(size: tuple[int, int], max_aspect: float = 2.5, rows: int = 4) -> int:
    """0 when the source fits the model's aspect limit; else the 4 edge-replicated rows top and bottom (18.2)."""
    w, h = size
    return 0 if w / h <= max_aspect else rows


def pad(img: Image.Image, rows: int) -> Image.Image:
    if not rows:
        return img
    a = np.asarray(img.convert("RGB"))
    return Image.fromarray(np.concatenate([np.repeat(a[:1], rows, 0), a, np.repeat(a[-1:], rows, 0)]), "RGB")


def place_layer(out: np.ndarray, img: Image.Image, at: tuple[int, int], blend: str = "normal",
                alpha: float = 1.0) -> np.ndarray:
    """`img` (RGBA, straight alpha) drawn onto the float rgb `out` with its top-left at `at` (clipped): `normal` is
    over, `add` adds rgb * a (the Pixi blend modes, shown at scale 1)."""
    h, w = out.shape[:2]
    x, y = at
    x0, y0, x1, y1 = max(0, x), max(0, y), min(w, x + img.width), min(h, y + img.height)
    if x0 >= x1 or y0 >= y1:
        return out
    rgb, a = split_rgba(img.crop((x0 - x, y0 - y, x1 - x, y1 - y)))
    a = a[..., None] * alpha
    res = out.copy()
    reg = res[y0:y1, x0:x1]
    res[y0:y1, x0:x1] = reg + rgb * a if blend == "add" else reg * (1 - a) + rgb * a
    return res

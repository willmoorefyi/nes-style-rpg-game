"""The offline checks of the painted colossus pipeline (docs/CHAOS_FORMS_PLAN.md 18.7, B1, B7). Thresholds are the plan's
floors; B7: a pinned threshold may only tighten them, never loosen them. Each check returns (ok, measured dict).

  glow_strength   inside the ring annulus and the corona disc, where a < 0.05: mean glow luma >= 0.7 x (mean raw luma
                  - the far-field sky mean)   (replaces the tautological reconstruction check)
  sky_clean       mean sky_base luma inside the ring annulus vs just outside it (a band each side): within 4 luma
  despill         mean luma of the 0 < a < 0.95 band >= the interior (a >= 0.95) mean minus 20 %
  fidelity        the body Lanczos-downscaled to the original (1800x720) vs the original inside a >= 0.9:
                  PSNR >= 30 dB and mean CIE76 delta E <= 3
  upscale_blobs   no connected bright blob over 0.1 % of the canvas in the fit that is absent from the nearest-upscaled raw
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import colossus_paint as P

GLOW_K = 0.7
SKY_LUMA = 4.0
DESPILL_DROP = 0.20
PSNR_DB, DELTA_E = 30.0, 3.0
BLOB_FRAC, BRIGHT = 0.001, 200.0
SRGB_XYZ = np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])


def _dist(shape, cx, cy):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return np.hypot(xx - cx, yy - cy)


def annulus(shape, ring) -> np.ndarray:
    cx, cy, r, band = ring
    return np.abs(_dist(shape, cx, cy) - r) <= band / 2


def ring_sides(shape, ring) -> np.ndarray:
    """A band-wide strip just inside and just outside the annulus."""
    cx, cy, r, band = ring
    d = np.abs(_dist(shape, cx, cy) - r)
    return (d > band / 2) & (d <= 1.5 * band)


def glow_strength(raw, alpha, glow, ring, corona) -> tuple[bool, dict]:
    """raw / glow float rgb (glow decoded, before the top feather), ring (cx, cy, r, band), corona (cx, cy, r)."""
    sky = alpha < P.SKY_A
    far = P.far_mask(alpha.shape, alpha, ring)
    far_mean = float(P.luma(raw)[far].mean()) if far.any() else 0.0
    out, ok = {"far_sky": round(far_mean, 2)}, True
    regions = {"annulus": annulus(alpha.shape, ring),
               "corona": _dist(alpha.shape, corona[0], corona[1]) <= corona[2]}
    for name, m in regions.items():
        m = m & sky
        if not m.any():
            out[name] = "no sky pixels"
            ok = False
            continue
        g, lift = float(P.luma(glow)[m].mean()), float(P.luma(raw)[m].mean()) - far_mean
        out[name] = {"glow": round(g, 2), "raw_minus_far": round(lift, 2), "ratio": round(g / lift, 3) if lift > 0 else None}
        ok &= g >= GLOW_K * lift
    return ok, out


def sky_clean(sky_base, alpha, ring) -> tuple[bool, dict]:
    sky = alpha < P.SKY_A
    ins, outs = annulus(alpha.shape, ring) & sky, ring_sides(alpha.shape, ring) & sky
    if not ins.any() or not outs.any():
        return False, {"error": "the ring annulus or its sides have no sky pixels"}
    li, lo = float(P.luma(sky_base)[ins].mean()), float(P.luma(sky_base)[outs].mean())
    return abs(li - lo) <= SKY_LUMA, {"inside": round(li, 2), "outside": round(lo, 2), "diff": round(abs(li - lo), 2)}


def despill_ok(body: Image.Image) -> tuple[bool, dict]:
    rgb, a = P.split_rgba(body)
    band, solid = (a > 0) & (a < P.SOLID_A), a >= P.SOLID_A
    if not band.any() or not solid.any():
        return True, {"band": None}
    lb, li = float(P.luma(rgb)[band].mean()), float(P.luma(rgb)[solid].mean())
    return lb >= (1 - DESPILL_DROP) * li, {"band": round(lb, 2), "interior": round(li, 2)}


def _lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = np.einsum("...k,kc->...c", c, SRGB_XYZ)
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def fidelity(body: Image.Image, orig: Image.Image) -> tuple[bool, dict]:
    small = body.convert("RGBA").resize(orig.size, Image.Resampling.LANCZOS)
    rgb, a = P.split_rgba(small)
    ref = np.asarray(orig.convert("RGB")).astype(np.float64)
    m = a >= 0.9
    if not m.any():
        return False, {"error": "no a >= 0.9 pixels"}
    mse = float(((rgb[m] - ref[m]) ** 2).mean())
    psnr = 99.0 if mse == 0 else 10 * np.log10(255.0 ** 2 / mse)
    de = float(np.linalg.norm(_lab(rgb[m]) - _lab(ref[m]), axis=-1).mean())
    return psnr >= PSNR_DB and de <= DELTA_E, {"psnr": round(psnr, 2), "delta_e": round(de, 3)}


def _blobs(mask: np.ndarray, k: int) -> tuple[np.ndarray, int]:
    from gen import pixelize as PX
    h, w = mask.shape
    small = mask[:h - h % k, :w - w % k].reshape(h // k, k, w // k, k).any(axis=(1, 3))
    return PX.components(small)


def upscale_blobs(raw: Image.Image, fitted: Image.Image, k: int = 4) -> tuple[bool, dict]:
    """Bright (luma >= 200) blobs of the fit, labelled on a /k grid; one counts as new when under half of it is bright
    in the nearest-upscaled raw and it covers more than 0.1 % of the canvas."""
    f = P.luma(np.asarray(fitted.convert("RGB")).astype(np.float64)) >= BRIGHT
    near = raw.convert("RGB").resize(fitted.size, Image.Resampling.NEAREST)
    r = P.luma(np.asarray(near).astype(np.float64)) >= BRIGHT
    lab, n = _blobs(f, k)
    h, w = lab.shape
    rs = r[:h * k, :w * k].reshape(h, k, w, k).mean(axis=(1, 3))
    fs = f[:h * k, :w * k].reshape(h, k, w, k).sum(axis=(1, 3))
    new = []
    for i in range(1, n + 1):
        m = lab == i
        area = int(fs[m].sum())
        if area > BLOB_FRAC * f.size and float(rs[m].mean()) < 0.5:
            ys, xs = np.where(m)
            new.append({"at": [int(xs.min()) * k, int(ys.min()) * k], "px": area})
    return not new, {"bright_blobs": n, "new": new}

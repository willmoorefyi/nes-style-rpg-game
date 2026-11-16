"""Pass C rev 4 self-tests: the painted colossus pipeline (docs/CHAOS_FORMS_PLAN.md 18.1-18.2, 18.7, B1; FW-C, 0 paid),
run by selftest_colossus.run_colossus. On a synthetic 400x160 render (a sky gradient, a 12 px halo ring, a soft-edged
body over it): sky_base at a scale above the halo ("open" and "fit"), despill, the G1 / G2 glow after despill, the top
feather, the additive encoding, the B1 checks (glow strength, sky-base clean) failing on a leaky sky base, despill,
fidelity, the upscale fit to the exact canvas (and its refusal when narrower), the new-blob check, and the
`colossus.py glow` / `upfit` commands end to end. The gate parts (upscale / inpaint purposes, the reserve cost rule,
approve extras, retire --colossus as _v1) are in selftest_colossus_gate.py.
"""
from __future__ import annotations

import contextlib
import io
import json
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 400, 160
RING = (200.0, 120.0, 90.0, 12.0)          # cx, cy, r, band (full width)
CORONA = (200.0, 120.0, 36.0)            # the disc around an inner ring (r 30, band 8)
FG = np.array([200.0, 170.0, 120.0])
RADIUS, SIGMA = 10, 6.0                    # 1.5x the band half-width (9) rounded up; the blur above the band


def sky_true() -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    return np.stack([30 + 0.1 * yy, 40 + 0.05 * xx, 70 + 0.15 * yy], -1)


def ring_light() -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    d = np.hypot(xx - RING[0], yy - RING[1])
    ring = 140 * np.exp(-((d - RING[2]) / (RING[3] / 3)) ** 2)
    core = 90 * np.exp(-((d - 30) / (8 / 3)) ** 2)
    return (ring + core)[..., None] * np.array([1.0, 0.85, 0.55])


def alpha_true() -> np.ndarray:
    """A soft-edged body (an ellipse low on the canvas, 4 px ramp) that hides the ring's lower arc."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    e = np.hypot((xx - 200) / 150, (yy - 175) / 50)
    return np.clip((1 - e) * 50 / 4 + 0.5, 0, 1)


def fixture() -> tuple[np.ndarray, np.ndarray]:
    """(raw rgb float, cut alpha float): raw = a * FG + (1 - a) * (sky + ring)."""
    a = alpha_true()[..., None]
    raw = a * FG + (1 - a) * (sky_true() + ring_light())
    return np.clip(raw, 0, 255), alpha_true()


def _img(rgb: np.ndarray, alpha: np.ndarray | None = None) -> Image.Image:
    if alpha is None:
        return Image.fromarray(np.round(rgb).astype(np.uint8), "RGB")
    return Image.fromarray(np.dstack([np.round(rgb), np.round(alpha * 255)]).astype(np.uint8), "RGBA")


def run_paint(check) -> None:
    from gen.selftest_colossus import sections
    sections(check, _sky, _despill_glow, _checks, _fit, _cli)


def _sky(check) -> None:
    from gen import colossus_paint as P
    raw, a = fixture()
    sky = a < P.SKY_A
    truth = P.luma(sky_true())
    base = P.sky_open(raw, a, RADIUS, SIGMA)
    err = np.abs(P.luma(base) - truth)
    ann = np.abs(np.hypot(*(np.mgrid[0:H, 0:W][::-1] - np.array(RING[:2])[:, None, None])) - RING[2]) <= RING[3] / 2
    check(float(err[sky].mean()) < 2.0 and float(err[ann & sky].mean()) < 3.0,
          f"sky_base open (radius {RADIUS} >= 1.5x the band half-width, sigma {SIGMA}): the sky without the halo "
          f"(mean err {err[sky].mean():.2f}, on the ring {err[ann & sky].mean():.2f} luma)")
    fit = P.sky_fit(raw, a, RING)
    ferr = np.abs(P.luma(fit) - truth)
    check(float(ferr[sky].max()) < 1.0, f"sky_base fit: a degree-2 far-field fit recovers the gradient under the ring "
                                        f"(max err {ferr[sky].max():.3f} luma)")
    check(P._run(np.array([[3.0, 1, 4, 1, 5, 9, 2, 6]]), 1, 1, np.minimum, np.inf).tolist() == [[1, 1, 1, 1, 1, 2, 2, 2]],
          "sky_base: the O(n) running min matches the brute-force window")


def _despill_glow(check) -> None:
    from gen import colossus_paint as P
    raw, a = fixture()
    base = P.sky_open(raw, a, RADIUS, SIGMA)
    fg = P.despill(raw, a, base)
    band = (a > 0.3) & (a < P.SOLID_A) & (P.luma(ring_light()) < 1)
    err = np.abs(fg - FG)[band].max()
    check(err < 4.0, f"despill: the 0 < a < 0.95 band un-mixed against sky_base recovers the body colour (max err "
                     f"{err:.2f}; raw band err {np.abs(raw - FG)[band].max():.1f})")
    g = P.glow_diff(raw, a, fg, base)
    lit = (a < P.SKY_A) & (P.luma(ring_light()) > 40)
    rel = float(np.abs(P.luma(g) - P.luma(ring_light()))[lit].mean() / P.luma(ring_light())[lit].mean())
    check(rel < 0.08 and float(P.luma(g)[band].max()) < 3.0,
          f"glow G1 diff after despill: the halo light in the sky ({rel:.3f} relative err), ~0 in the despilled band")
    gl = P.glow_lum(raw, a, 80, 140)
    check(float(gl[a >= P.SOLID_A].max()) < 0.06 * 255 and float(P.luma(gl)[lit].mean()) > 20
          and float(gl[(a < P.SKY_A) & (P.luma(raw) < 80)].max()) == 0.0,
          "glow G2 lum: zero below t0 and inside the body, positive on the ring")
    ft = P.feather_top(np.ones((200, 4, 3)), 120)
    check(ft[0].max() == 0 and abs(ft[60, 0, 0] - 0.5) < 1e-9 and (ft[120:] == 1).all(),
          "glow: the top 120 rows fade in linearly (the render's top edge cuts the ring)")
    enc = P.encode_glow(g)
    dec = P.decode_glow(enc)
    ea = np.asarray(enc)[..., 3]
    check(np.abs(dec - g).max() <= 1.5 and (ea[P.luma(g) == 0] == 0).all() and len(np.unique(ea)) > 8,
          f"glow encoding: straight alpha with rgb * a == glow (max err {np.abs(dec - g).max():.2f}), soft alpha "
          f"({len(np.unique(ea))} levels, no 4-level stepping)")


def _checks(check) -> None:
    from gen import colossus_paint as P
    from gen import colossus_paintcheck as PC
    raw, a = fixture()
    base = P.sky_open(raw, a, RADIUS, SIGMA)
    fg = P.despill(raw, a, base)
    g = P.glow_diff(raw, a, fg, base)
    ok_g, m_g = PC.glow_strength(raw, a, g, RING, CORONA)
    ok_s, m_s = PC.sky_clean(base, a, RING)
    check(ok_g and ok_s, f"B1: glow strength >= 0.7 x (raw - far sky) on the annulus and corona ({m_g}) and the sky base "
                         f"clean within 4 luma ({m_s})")
    leaky = P.gauss(raw * (a < P.SKY_A)[..., None], 2) / np.maximum(P.gauss((a < P.SKY_A).astype(float), 2),
                                                                     1e-9)[..., None]
    lg = P.glow_diff(raw, a, P.despill(raw, a, leaky), leaky)
    bad_g, mb_g = PC.glow_strength(raw, a, lg, RING, CORONA)
    bad_s, mb_s = PC.sky_clean(leaky, a, RING)
    check(not bad_g and not bad_s, f"B1: a sky base below the halo scale (a sigma-2 blur) fails both checks "
                                   f"(glow {mb_g.get('annulus')}, sky {mb_s})")
    body = P.body_image(fg, a)
    ok_d, m_d = PC.despill_ok(body)
    bad_d, mb_d = PC.despill_ok(P.body_image(raw, a))
    check(ok_d and not bad_d, f"despill check: the band keeps >= 80 % of the interior luma ({m_d}); the un-despilled "
                              f"cut fails ({mb_d})")
    big = _img(fg, a).resize((W * 3 // 2, H * 3 // 2), Image.Resampling.LANCZOS)
    ok_f, m_f = PC.fidelity(big, _img(raw))
    shifted = np.asarray(big).copy()
    shifted[..., 0] = np.clip(shifted[..., 0].astype(int) + 30, 0, 255)
    bad_f, mb_f = PC.fidelity(Image.fromarray(shifted), _img(raw))
    check(ok_f and not bad_f, f"fidelity: the 1.5x body downscaled vs the raw inside a >= 0.9 (PSNR >= 30, dE <= 3: "
                              f"{m_f}); a +30 red shift fails ({mb_f})")


def _fit(check) -> None:
    from gen import colossus_paint as P
    from gen import colossus_paintcheck as PC
    raw, _ = fixture()
    src = _img(raw)
    up = src.resize((W * 2 + 4, H * 2 + 2), Image.Resampling.BICUBIC)
    out = P.fit(up, (600, 240))
    check(out.size == (600, 240), f"fit: a model-sized upscale is Lanczos-downscaled to exactly the canvas ({out.size})")
    narrow = src.resize((590, 236))
    try:
        P.fit(narrow, (600, 240))
        r = ""
    except SystemExit as e:
        r = str(e)
    check("narrower" in r, f"fit: an output narrower than the canvas is refused: stop and report ({r[:70]!r})")
    padded = P.pad(src, 4)
    check(padded.size == (W, H + 8) and P.pad_rows_for((1800, 720)) == 0 and P.pad_rows_for((1810, 720)) == 4,
          "fit: 4 edge rows top and bottom only for a source the model refuses (2.5:1 passes as is)")
    back = P.fit(padded.resize((W * 2, (H + 8) * 2), Image.Resampling.NEAREST), (W * 2, H * 2), (W, H), 4)
    same = np.asarray(back).astype(int) - np.asarray(src.resize((W * 2, H * 2), Image.Resampling.NEAREST)).astype(int)
    check(back.size == (W * 2, H * 2) and np.abs(same).max() == 0, "fit: the pad rows are cropped after the call")
    ok, m = PC.upscale_blobs(src, out)
    blob = np.asarray(out).copy()
    blob[20:60, 20:60] = 250
    bad, mb = PC.upscale_blobs(src, Image.fromarray(blob))
    check(ok and not bad and mb["new"], f"upscale check: no new bright blob over 0.1 % ({m}); an invented one is found "
                                        f"({mb['new']})")


def _cli(check) -> None:
    from gen import colossus as C
    raw, a = fixture()
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        _img(raw).save(tmp / "raw.png")
        _img(raw, a).resize((W // 2, H // 2), Image.Resampling.LANCZOS).save(tmp / "cut_small.png")   # the C7 fallback
        ring = ",".join(str(v) for v in RING)
        argv = ["glow", "chaos_horizon", "--raw", str(tmp / "raw.png"), "--cut", str(tmp / "cut_small.png"),
                "--ring", ring, "--corona", ",".join(str(v) for v in CORONA), "--radius", str(RADIUS), "--sigma",
                str(SIGMA), "--feather", "0", "--orig", str(tmp / "raw.png"), "--out-dir", str(tmp / "p")]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = C.main(argv)
        rep = json.loads((tmp / "p" / "paint.json").read_text()) if (tmp / "p" / "paint.json").exists() else {}
        files = sorted(p.name for p in (tmp / "p").glob("*.png")) if (tmp / "p").exists() else []
        check(code == 0 and files == ["body.png", "glow.png", "sky_base.png"] and rep.get("order") ==
              ["sky_base", "despill", "glow"] and all(v["ok"] for v in rep.get("checks", {}).values())
              and rep.get("cut_resized_from") == [W // 2, H // 2],
              f"colossus.py glow: body / glow / sky_base + paint.json, B1 order, every check ok, the small cut's "
              f"alpha Lanczos-resized ({code}, {files}, {rep.get('checks')})")
        body = Image.open(tmp / "p" / "body.png") if files else Image.new("RGBA", (1, 1))
        check(body.mode == "RGBA" and body.size == (W, H) and len(np.unique(np.asarray(body)[..., 3])) > 8,
              "colossus.py glow: the body keeps soft 8-bit alpha at the raw's size")
        with contextlib.redirect_stdout(io.StringIO()):
            code2 = C.main([*argv[:-1], str(tmp / "q"), "--method", "lum", "--t0", "80", "--t1", "140", "--sky", "fit"])
        check(code2 in (0, 1) and (tmp / "q" / "glow.png").exists()
              and json.loads((tmp / "q" / "paint.json").read_text())["method"] == "lum",
              "colossus.py glow --method lum --sky fit: the G2 fallback with the far-field fit")
        up = _img(raw).resize((W * 2 + 6, H * 2 + 2), Image.Resampling.BICUBIC)
        up.save(tmp / "up.png")
        with contextlib.redirect_stdout(io.StringIO()):
            code3 = C.main(["upfit", "chaos_horizon", str(tmp / "up.png"), "--raw", str(tmp / "raw.png"),
                            "--canvas", f"{W * 3 // 2}x{H * 3 // 2}", "--out", str(tmp / "fit.png")])
        fitted = Image.open(tmp / "fit.png") if (tmp / "fit.png").exists() else None
        side = json.loads((tmp / "fit.json").read_text()) if (tmp / "fit.json").exists() else {}
        check(code3 == 0 and fitted is not None and fitted.size == (W * 3 // 2, H * 3 // 2)
              and side.get("upscale_blobs", {}).get("ok") is True,
              f"colossus.py upfit: the upscale fitted to the canvas, with the new-blob check in its sidecar ({code3})")
        with contextlib.redirect_stdout(io.StringIO()):
            try:
                code4 = C.main(["upfit", "chaos_horizon", str(tmp / "up.png"), "--raw", str(tmp / "raw.png"),
                                "--out", str(tmp / "fit2.png")])
            except SystemExit as e:
                code4 = str(e)
        check("narrower" in str(code4) and not (tmp / "fit2.png").exists(),
              f"colossus.py upfit: an 806 px output for the 2700 px F3 canvas is refused ({str(code4)[:60]!r})")

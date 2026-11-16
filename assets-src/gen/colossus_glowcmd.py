"""colossus.py's offline painted-art commands (docs/CHAOS_FORMS_PLAN.md 18.2 steps 2-4, 18.7; 0 calls):

  python3 -I assets-src/gen/colossus.py glow <form> --raw R --cut C [--method diff|lum] [--sky open|fit]
        [--radius 60] [--sigma 40] [--t0 T --t1 T] [--ring cx,cy,r,band] [--corona cx,cy,r] [--feather 120]
        [--orig ORIGINAL.png] [--out-dir D]
  python3 -I assets-src/gen/colossus.py upfit <form> <upscaled.png> --raw R [--canvas WxH] [--pad-rows N] [--out F]

glow: R is the raw fitted to the canvas (with its sky), C the remove_bg cut (its alpha; a cut of another size, e.g. the
C7 cut, is Lanczos-resized). In the B1 order: sky_base, despill, glow. Writes body.png (the despilled cut, soft alpha),
glow.png (the additive glow, straight alpha, top feather), sky_base.png and paint.json (parameters and every 18.7
check: glow strength and sky-base clean on the ring, despill, and fidelity against --orig, the picked 1800x720 raw).
Exit 1 if a check fails. The default ring / corona are the form's (FORMS, estimates; pass the measured ones).
upfit: the Conservative Upscale output Lanczos-downscaled to exactly the form canvas (refused when narrower), plus the
new-bright-blob check against R; writes <out> and its sidecar. `colossus.py upscale --form F` runs it after the call.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

from gen import colossus_paint as P
from gen import colossus_paintcheck as PC


def _nums(s: str | None, n: int, name: str):
    if s is None:
        return None
    v = tuple(float(x) for x in s.split(","))
    if len(v) != n:
        raise SystemExit(f"refused: --{name} needs {n} comma-separated numbers")
    return v


def _canvas(a, form: dict) -> tuple[int, int]:
    return tuple(int(v) for v in a.canvas.split("x")) if getattr(a, "canvas", None) else tuple(form["canvas"])


def cmd_glow(a) -> int:
    from gen import colossus as C
    form = C._form(a.form)
    raw_img = Image.open(a.raw).convert("RGB")
    raw = np.asarray(raw_img).astype(np.float64)
    cut = Image.open(a.cut)
    alpha = P.alpha_of(cut, raw_img.size)
    ring = _nums(a.ring, 4, "ring") or form.get("ring")
    corona = _nums(a.corona, 3, "corona") or form.get("corona")
    if a.sky == "open":
        if ring and a.radius < 1.5 * ring[3] / 2:
            raise SystemExit(f"refused: --radius {a.radius} is under 1.5x the ring band's half-width ({ring[3] / 2:g}); "
                             "the halo would leak into sky_base (B1)")
        sky = P.sky_open(raw, alpha, a.radius, a.sigma)
    else:
        if not ring:
            raise SystemExit("refused: --sky fit needs a ring (--ring cx,cy,r,band) to exclude the annulus and rays")
        sky = P.sky_fit(raw, alpha, ring)
    fg = P.despill(raw, alpha, sky)
    glow = P.glow_diff(raw, alpha, fg, sky) if a.method == "diff" else P.glow_lum(raw, alpha, a.t0, a.t1)
    body = P.body_image(fg, alpha)
    checks: dict[str, dict] = {}
    if ring and corona:
        ok, m = PC.glow_strength(raw, alpha, glow, ring, corona)
        checks["glow_strength"] = {"ok": bool(ok), **m}
        ok, m = PC.sky_clean(sky, alpha, ring)
        checks["sky_clean"] = {"ok": bool(ok), **m}
    ok, m = PC.despill_ok(body)
    checks["despill"] = {"ok": bool(ok), **m}
    if a.orig:
        ok, m = PC.fidelity(body, Image.open(a.orig))
        checks["fidelity"] = {"ok": bool(ok), **{k: float(v) for k, v in m.items() if not isinstance(v, str)}}
    out = Path(a.out_dir) if a.out_dir else C.OUT / a.form / "paint"
    out.mkdir(parents=True, exist_ok=True)
    body.save(out / "body.png")
    P.encode_glow(P.feather_top(glow, a.feather)).save(out / "glow.png")
    Image.fromarray(np.clip(np.round(sky), 0, 255).astype(np.uint8), "RGB").save(out / "sky_base.png")
    rep = {"form": a.form, "raw": str(a.raw), "cut": str(a.cut), "orig": a.orig, "method": a.method, "sky": a.sky,
           "radius": a.radius, "sigma": a.sigma, "t0": a.t0, "t1": a.t1, "ring": ring, "corona": corona,
           "feather": a.feather, "order": ["sky_base", "despill", "glow"], "checks": checks}
    if cut.size != raw_img.size:
        rep["cut_resized_from"] = list(cut.size)
    (out / "paint.json").write_text(json.dumps(rep, indent=2, sort_keys=True) + "\n")
    bad = [k for k, v in checks.items() if not v["ok"]]
    print(f"wrote {out}/body.png, glow.png, sky_base.png, paint.json; checks: "
          + ", ".join(f"{k} {'ok' if v['ok'] else 'FAIL'}" for k, v in checks.items()))
    return 1 if bad else 0


def upfit(form: str, up: Path, raw: Path, canvas: tuple[int, int], pad_rows: int, out: Path) -> int:
    from gen import colossus as C
    src = Image.open(raw)
    fitted = P.fit(Image.open(up), canvas, src.size, pad_rows)
    ok, m = PC.upscale_blobs(src, fitted)
    out.parent.mkdir(parents=True, exist_ok=True)
    fitted.save(out)
    C._sidecar(out, {**C._read_sidecar(up), "form": form, "upscaled": str(up), "raw": str(raw), "fit": list(canvas),
                     "pad_rows": pad_rows, "upscaled_size": list(Image.open(up).size),
                     "upscale_blobs": {"ok": bool(ok), **m}})
    print(f"wrote {out} {fitted.size} (Lanczos from {Image.open(up).size}); new bright blobs: "
          + ("none" if ok else json.dumps(m["new"])))
    return 0 if ok else 1


def cmd_upfit(a) -> int:
    from gen import colossus as C
    form = C._form(a.form)
    up = Path(a.upscaled)
    out = Path(a.out) if a.out else up.with_name(f"{up.stem}_fit.png")
    return upfit(a.form, up, Path(a.raw), _canvas(a, form), a.pad_rows, out)


def add_parsers(sub: argparse._SubParsersAction) -> None:
    g = sub.add_parser("glow", help="offline: sky_base, despill and the glow of a painted form (18.2)")
    g.add_argument("form"); g.add_argument("--raw", required=True); g.add_argument("--cut", required=True)
    g.add_argument("--method", choices=["diff", "lum"], default="diff")
    g.add_argument("--sky", choices=["open", "fit"], default="open")
    g.add_argument("--radius", type=int, default=60); g.add_argument("--sigma", type=float, default=40.0)
    g.add_argument("--t0", type=float, default=110.0); g.add_argument("--t1", type=float, default=200.0)
    g.add_argument("--ring"); g.add_argument("--corona")
    g.add_argument("--feather", type=int, default=120)
    g.add_argument("--orig", help="the picked original raw (fidelity check)"); g.add_argument("--out-dir")
    u = sub.add_parser("upfit", help="offline: an upscale output -> exactly the form canvas (Lanczos)")
    u.add_argument("form"); u.add_argument("upscaled"); u.add_argument("--raw", required=True)
    u.add_argument("--canvas", help="WxH (default: the form's canvas)")
    u.add_argument("--pad-rows", type=int, default=0); u.add_argument("--out")

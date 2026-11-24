"""EF-G G1 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): the idle masters of the four humanoids, no AI. Each master is one EF3 raw
render (assets-src/gen/cache/<key>.png) keyed off its page, cleaned by the recipe in gen/monster_hr.yaml (`prep`:
source key, flip, key settings, polygons, landmarks), and placed on a 1024x1024 RGBA canvas: the figure scaled
(Lanczos, premultiplied) to 880 px tall, feet on row 960, facing right. Output gen/out/hr/<id>/idle_master.png
(untracked); its sha256 is recorded in the yaml (`master_sha256`), so drift fails clearly.

  python3 -I assets-src/gen/monster_hr_prep.py <id> [--record]   # build (and record the sha256)
"""
from __future__ import annotations

import argparse
import hashlib
import io
import sys
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml
from PIL import Image

from gen.monster_hr_fix import canvas_fixes, extend, glow_cut, graft, pool_cut
from gen.monster_hr_geom import (border_seeds, depth, dilate, erode, flood, key, page,  # noqa: F401 (re-exported)
                                 poly_mask, shift)

HERE = Path(__file__).resolve().parent
SPEC = HERE / "monster_hr.yaml"
OUT = HERE / "out" / "hr"
SIDE, HEIGHT, FEET = 1024, 880, 960


def spec(path: Path | None = None) -> dict:
    return yaml.safe_load((path or SPEC).read_text())


def sha(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return hashlib.sha256(buf.getvalue()).hexdigest()


def main_figure(m: np.ndarray, touch: int = 3) -> np.ndarray:
    """The largest component and every piece within `touch` px of it (labelled at half resolution, for speed)."""
    from gen import pixelize as PX
    lab, n = PX.components(m[::2, ::2])
    if n == 0:
        return m
    sizes = np.bincount(lab.ravel())[1:]
    near = dilate(lab == int(sizes.argmax()) + 1, max(1, touch // 2))
    keep = np.isin(lab, np.unique(lab[near & (lab > 0)]))
    return np.kron(keep, np.ones((2, 2), bool))[:m.shape[0], :m.shape[1]] & m


MAP: dict = {}                                         # the last place(): raw -> canvas (s, x0, y0, ox, oy)


def place(rgb: np.ndarray, m: np.ndarray, cx: float) -> Image.Image:
    """The figure on the 1024 canvas: 880 px tall (Lanczos on premultiplied RGBA), feet on row 960, its box centred
    on x = cx; binary alpha (> 127)."""
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    s = HEIGHT / (y1 - y0)
    rgba = np.dstack([rgb, m.astype(np.uint8) * 255])[y0:y1, x0:x1]
    im = Image.fromarray(rgba).convert("RGBa").resize((round((x1 - x0) * s), HEIGHT),
                                                            Image.Resampling.LANCZOS).convert("RGBA")
    a = np.asarray(im).copy()
    a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    a[a[..., 3] == 0] = 0
    out = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    out.paste(Image.fromarray(a), (round(cx - im.width / 2), FEET + 1 - HEIGHT))
    MAP.update(s=s, x0=int(x0), y0=int(y0), ox=round(cx - im.width / 2), oy=FEET + 1 - HEIGHT, w=rgb.shape[1])
    full = Image.new("RGB", (SIDE, SIDE))               # the raw crop unkeyed, on the canvas (restore_out reads it)
    full.paste(Image.fromarray(rgb[y0:y1, x0:x1]).resize(im.size, Image.Resampling.LANCZOS), (MAP["ox"], MAP["oy"]))
    MAP["full"] = np.asarray(full)
    return out


def master(sid: str, sp: dict | None = None) -> Image.Image:
    from gen import bedrock as B
    p = (sp or spec())["sprites"][sid]["prep"]
    rgb = np.asarray(Image.open(B.CACHE / f"{p['source']}.png").convert("RGB")).copy()
    if p.get("graft"):
        rgb = graft(rgb, p["graft"])
    prot = poly_mask(rgb.shape[:2], p.get("protect")) if p.get("protect") else None
    m = key(rgb, p.get("key") or {}, prot) & ~poly_mask(rgb.shape[:2], p.get("erase"))
    if p.get("keep"):                                  # figure px the key took (gloves lit in the page's teal): every
        f = rgb.astype(float)                          # px of the polygons but those within keep_tol of the page
        near = np.abs(f - page(f, (p.get("key") or {}).get("mode", "flat"))).max(2) <= p.get("keep_tol", 10)
        m |= poly_mask(rgb.shape[:2], p["keep"]) & ~near & (f.max(2) <= p.get("keep_max", 255))
        m |= poly_mask(rgb.shape[:2], p.get("keep_light")) & ~near & (f.mean(2) >= p.get("light_min", 125))  # a blade edge
    if p.get("pool"):                                  # vampire v2: the blood pool's colours inside its zone
        m = pool_cut(rgb, m, p["pool"])
    rgb, m = extend(rgb, m, p.get("extend"))
    if p.get("glow"):
        m = glow_cut(rgb, m, p["glow"])
    if p.get("floor"):                                 # a painted ground line below this row: page
        m[p["floor"]:] = False
    m = main_figure(m)
    if p.get("erode"):                                 # page-tinted edge px
        m = erode(m, p["erode"])
    if p.get("close"):                                 # page specks inside the figure (along a kept hat crown)
        m = erode(dilate(m, p["close"]), p["close"])
    if p.get("flip"):
        rgb, m = rgb[:, ::-1], m[:, ::-1]
    out = place(rgb, m, p.get("cx", 470))
    out = Image.fromarray(canvas_fixes(np.asarray(out).copy(), p, rgb, MAP.get("full")))
    return out


def build(sid: str, record: bool = False) -> tuple[Path, str]:
    img = master(sid)
    out = OUT / sid / "idle_master.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    h = sha(img)
    if record:
        from gen.monster_hr_yaml import record
        record(sid, "master_sha256", h)
    return out, h


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--record", action="store_true", help="write the master's sha256 into monster_hr.yaml")
    a = ap.parse_args(argv)
    for sid in a.ids:
        path, h = build(sid, a.record)
        want = spec()["sprites"][sid].get("master_sha256")
        print(f"{sid}: {path} sha256 {h[:16]}{'' if a.record or not want else ' OK' if want == h else ' DRIFT (recorded ' + want[:16] + ')'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

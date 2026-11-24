"""EF-G G2 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): attack, hurt and kneel posed from the idle master, no AI. The recipe is
gen/monster_hr.yaml `puppet` (master coordinates):

- `parts`: rigid parts (polygon + pivot + parent), cut out of the master (a part's px leave the `rest` part unless
  `cut: false`; `cut_poly`: only those px leave it); cloth parts (`warp: true`, `pins`: control points on the cloth outline and its attachment line;
  `follow: {pin: part}` pins ride on another part, `anchor` pins stay put) are warped by gen/monster_hr_warp.py instead of moved rigidly.
- `poses.<pose>`: `xf: {part: [rot, dx, dy, sx, sy]}` (degrees about the part's pivot, then px; parents first),
  `pins: {part: {i: [dx, dy]}}` (cloth pin moves on top of the base transform), `z` (draw order, back first),
  `close` (joint gap closing radius), `fill` (destination polygons whose enclosed holes are filled) and
  `backfill` (polygons whose vacated master px are filled); `part_opts: {part: {option: value | null}}` overrides
  a part's options for that pose only. Exposed gaps
  near the moved pivots are filled from the nearest part's own px (dilation fill).

Output gen/out/hr/<id>/<pose>_posed.png and <pose>_overlay.png; the sha256 of every posed PNG is recorded in the
yaml (`<pose>_sha256`). Checks (`checks`): the figure inside the canvas with >= 16 px margin, the feet on row
960 +- 4, no enclosed transparent gap > 50 px within 60 px of a moved joint (a tear), IoU with the idle <= 0.8.

  python3 -I assets-src/gen/monster_hr_puppet.py <id> [poses...] [--record] [--review]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from PIL import Image

from gen import monster_hr_prep as P
from gen import monster_hr_warp as W
from gen.monster_hr_check import checks, overlay

POSES = ("attack", "hurt", "kneel")
REVIEW = Path.home() / "temp" / "ff-game" / "ef" / "bedrock4"


def load_master(sid: str, sp: dict) -> Image.Image:
    path = P.OUT / sid / "idle_master.png"
    img = Image.open(path).convert("RGBA") if path.exists() else P.master(sid, sp)
    want = sp["sprites"][sid].get("master_sha256")
    if want and P.sha(img) != want:
        raise SystemExit(f"{sid}: {path} drifted from master_sha256 {want[:16]} (re-run monster_hr_prep.py {sid})")
    return img


def part_masks(alpha: np.ndarray, parts: list[dict], rgb: np.ndarray | None = None) -> dict[str, np.ndarray]:
    masks, cut = {}, np.zeros_like(alpha)
    for p in parts:
        if p.get("rest"):
            continue
        masks[p["name"]] = alpha & P.poly_mask(alpha.shape, [p["poly"]] if p.get("poly") else [])   # null: no px
        if p.get("light") and rgb is not None:         # only the part's light px (bone claws, not the robe behind)
            lit = masks[p["name"]] & (rgb[..., :3].astype(int).mean(2) >= p["light"])
            lit = ~W.dilate(~W.dilate(lit, 4), 4)       # closed: the sleeve's own dark folds and outline come along
            masks[p["name"]] &= W.dilate(lit, 2)
        if p.get("cut_poly"):                          # only this part leaves the rest (a wing's lower tatters stay
            cut |= alpha & P.poly_mask(alpha.shape, [p["cut_poly"]])   # in the cape too: no cut line in the cloth)
        elif p.get("cut", True):
            cut |= masks[p["name"]]
    for p in parts:
        if p.get("rest"):
            masks[p["name"]] = alpha & ~cut
    return masks


def worlds(parts: list[dict], xf: dict) -> dict[str, np.ndarray]:
    by, out = {p["name"]: p for p in parts}, {}

    def world(n: str) -> np.ndarray:
        if n not in out:
            p, v = by[n], list(xf.get(n) or [])
            v += [0, 0, 0, 1, 1][len(v):]
            local = W.affine(v[0], v[3], v[4], v[1], v[2], tuple(p.get("pivot") or (0, 0)))
            out[n] = (world(p["parent"]) if p.get("parent") else np.eye(3)) @ local
        return out[n]
    for p in parts:
        world(p["name"])
    return out


def pose(sid: str, name: str, sp: dict | None = None,
         master: Image.Image | None = None) -> tuple[Image.Image, Image.Image, dict]:
    sp = sp or P.spec()
    pp = sp["sprites"][sid]["puppet"]
    ps = pp["poses"][name]
    master = master or load_master(sid, sp)
    rgba = np.asarray(master)
    alpha = rgba[..., 3] > 0
    parts = [{k: v for k, v in {**q, **((ps.get("part_opts") or {}).get(q["name"]) or {})}.items() if v is not None}
             for q in pp["parts"]]                     # `part_opts`: this pose's own part options (null drops one)
    masks, wl = part_masks(alpha, parts, rgba), worlds(parts, ps.get("xf") or {})
    order = ps.get("z") or [p["name"] for p in parts]
    canvas = Image.new("RGBA", (P.SIDE, P.SIDE), (0, 0, 0, 0))
    layers, meshes, pivots = {}, [], []
    for p in parts:
        n = p["name"]
        src = rgba.copy()
        src[~masks[n]] = 0
        if p.get("warp"):
            pins = np.asarray(p["pins"], float)
            dst = W.apply(wl[n], pins)
            for i, part in (p.get("follow") or {}).items():
                dst[int(i)] = W.apply(wl[part], pins[int(i):int(i) + 1])[0]
            for i in p.get("anchor") or []:            # pins that stay on the master (a wing's lowest tatters)
                dst[int(i)] = pins[int(i)]
            for i, mv in ((ps.get("pins") or {}).get(n) or {}).items():
                dst[int(i)] += np.asarray(mv, float)
            back = W.backward(wl[n], pins, dst, float(p.get("sigma", pp.get("sigma", 150))))
            meshes.append((n, pins, dst))
        else:
            back = W.backward(wl[n])
        layers[n] = W.warp(Image.fromarray(src), back, P.SIDE)
        if p.get("pivot") and not np.allclose(wl[n], np.eye(3)):
            pivots.append(W.apply(wl[n], np.asarray([p["pivot"]], float))[0])
    for n in order:
        canvas.alpha_composite(layers[n])
    out = np.asarray(canvas).copy()
    if ps.get("ground", True):                         # the lowest opaque row back on the feet row (a kneel's hem);
        dy = P.FEET - int(np.where(out[..., 3].any(1))[0].max())   # fills and checks are in these coordinates
        if abs(dy) <= 240:
            out = np.roll(out, dy, 0)
            pivots = [(x, y + dy) for x, y in pivots]
    comp = out[..., 3] > 0
    r = int(ps.get("close", 6))
    closed = ~W.dilate(~W.dilate(comp, r), r)
    near = np.zeros_like(comp)
    yy, xx = np.mgrid[:P.SIDE, :P.SIDE]
    for px, py in pivots:
        near |= (xx - px) ** 2 + (yy - py) ** 2 <= int(ps.get("near", 60)) ** 2
    holes = closed & ~comp & near
    out = W.nearest_fill(out, holes)
    if ps.get("fill"):                                 # enclosed gaps (after the joint fill sealed them)
        comp = out[..., 3] > 0
        enclosed = ~P.flood(~comp, P.border_seeds(P.SIDE, P.SIDE)) & P.poly_mask(comp.shape, ps["fill"]) & ~comp
        if pp.get("fill_rgb"):                         # a large gap behind the figure: the cloth's own flat colour
            out[enclosed] = (*pp["fill_rgb"], 255)
        else:
            out = W.nearest_fill(out, enclosed)
    if ps.get("backfill"):                             # vacated master px inside these polygons (a moved claw's place),
        comp = out[..., 3] > 0                         # cloned from the master `clone` px away (the robe's own
        gap = P.poly_mask(comp.shape, ps["backfill"]) & alpha & ~comp   # texture), else the nearest fill
        if ps.get("clone"):
            dx, dy = ps["clone"]
            src = W.shift(rgba, -dy, -dx)
            ok = gap & (src[..., 3] > 0)
            out[ok] = src[ok]
            gap &= ~ok
        out = W.nearest_fill(out, gap)
    from gen import pixelize as PX                     # floating specks (part slivers) under `speck` px leave
    lab, n = PX.components(out[..., 3] > 0)
    sizes = np.bincount(lab.ravel())
    out[np.isin(lab, [i for i in range(1, n + 1) if sizes[i] < ps.get("speck", 400)])] = 0
    if ps.get("ground", True):                         # once more after the specks left
        out = np.roll(out, P.FEET - int(np.where(out[..., 3].any(1))[0].max()), 0)
    img = Image.fromarray(out)
    info = checks(img, master, [tuple(map(float, q)) for q in pivots], ps.get("open"))
    return img, overlay(img, layers, order, meshes, pivots), info


def build(sid: str, poses: list[str], record: bool = False, review: bool = False) -> dict:
    sp, res = P.spec(), {}
    for name in poses:
        img, ov, info = pose(sid, name, sp)
        d = P.OUT / sid
        d.mkdir(parents=True, exist_ok=True)
        img.save(d / f"{name}_posed.png")
        ov.save(d / f"{name}_overlay.png")
        h = P.sha(img)
        if record:
            from gen.monster_hr_yaml import record as rec
            rec(sid, f"{name}_sha256", h)
        if review:
            r = REVIEW / sid / "g2"
            r.mkdir(parents=True, exist_ok=True)
            img.save(r / f"{name}_posed.png")
            ov.save(r / f"{name}_overlay.png")
        res[name] = {**info, "sha256": h}
    return res


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id")
    ap.add_argument("poses", nargs="*", help="poses of the recipe (default attack hurt kneel)")
    ap.add_argument("--record", action="store_true")
    ap.add_argument("--review", action="store_true", help="copy into ~/temp/ff-game/ef/bedrock4/<id>/g2/")
    a = ap.parse_args(argv)
    for name, info in build(a.id, a.poses or list(POSES), a.record, a.review).items():
        want = P.spec()["sprites"][a.id].get(f"{name}_sha256")
        drift = "" if a.record or not want else " OK" if want == info["sha256"] else " DRIFT"
        print(f"{a.id} {name}: {info}{drift}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

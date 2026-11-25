"""EF-H H1 (docs/ENEMY_FEEDBACK_PLAN.md EF-H): import a user-rendered sprite sheet (the user's own render in an
interactive image UI, e.g. ChatGPT) as an approved monster sheet. The render is the approved design; the import only
cuts it faithfully: one row of four poses (idle, attack, hurt, kneel) split into exactly four 8-connected pieces
(specks < 24 px dropped), scaled only when the idle is outside its band (s = 1.0 inside it: no resample), each pose
placed with its foot anchor (the mean x of its bottom 6 opaque rows) at the idle's and its feet on the band's feet row,
the cell widened by the cutter's rule, and one house palette for all four (PX.sheet_palette with the detail mask,
applied by PX.pixelize_native: 15-bit, the darkest entry PX.OUTLINE, <= 16 colours). Recipes: gen/monster_user.yaml.

  python3 -I assets-src/gen/monster_user.py cut <id> [--out DIR]  # measures, review pages (~/temp/ff-game/ef/user/<id>)
  python3 -I assets-src/gen/monster_user.py approve <id>          # approved/<id>/monster_<size>.*, kneel.*
  python3 -I assets-src/gen/monster_user.py check <id>            # the approved files re-import byte for byte
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml
from PIL import Image

from gen import pixelize as PX
from gen import monster_user_review as UR
from gen import spec as S

HERE = Path(__file__).resolve().parent
RECIPES = HERE / "monster_user.yaml"
POSES = ("idle", "attack", "hurt", "kneel")
SPECK, COLORS, SEED, ANCHOR_ROWS = 24, 16, 0, 6
check = UR.check                                       # the re-import check (selftest.py, selftest_roster.py)


def recipe(sid: str, path: Path | None = None) -> dict:
    rec = (yaml.safe_load((path or RECIPES).read_text()) or {}).get(sid)
    if not rec:
        raise SystemExit(f"{sid}: no recipe in {(path or RECIPES).name}")
    if list(rec.get("poses") or []) != list(POSES):
        raise SystemExit(f"{sid}: poses must be {list(POSES)}")
    return rec


def source(rec: dict, gen: Path = HERE) -> Image.Image:
    """The tracked user render, checked against the recipe's sha256 (refused on a mismatch)."""
    data = (gen / rec["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != rec["sha256"]:
        raise SystemExit(f"{rec['file']}: sha256 does not match the recipe")
    img = Image.open(gen / rec["file"]).convert("RGBA")
    return img.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if rec.get("flip") else img


def split(img: Image.Image) -> list[tuple[np.ndarray, np.ndarray]]:
    """The row's four poses, left to right: (rgb crop padded by 2 px, mask) per 8-connected piece of >= SPECK px.
    A row that is not exactly four pieces, or has semi-transparent pixels, is refused."""
    from gen.anim_efix import pieces8
    a = np.asarray(img)
    if ((a[..., 3] > 0) & (a[..., 3] < 255)).any():
        raise SystemExit("user sheet: semi-transparent pixels (binary alpha needed)")
    ps = [p for p in pieces8(a[..., 3] > 0) if len(p) >= SPECK]
    if len(ps) != 4:
        raise SystemExit(f"user sheet: {len(ps)} pieces of >= {SPECK} px, need exactly 4 (one per pose)")
    out = []
    for p in sorted(ps, key=lambda p: min(x for _, x in p)):
        ys, xs = np.array([q[0] for q in p]), np.array([q[1] for q in p])
        m = np.zeros((ys.max() - ys.min() + 5, xs.max() - xs.min() + 5), bool)
        m[ys - ys.min() + 2, xs - xs.min() + 2] = True
        rgb = np.zeros((*m.shape, 3), np.uint8)
        rgb[m] = a[ys, xs, :3]
        out.append((rgb, m))
    return out


def height(m: np.ndarray) -> int:
    return int(np.ptp(np.where(m.any(1))[0]) + 1)


def scale(heights: list[int], band: S.MonsterBand) -> tuple[float, str]:
    """s = min(target_idle, fit_tallest): 1.0 when the idle is in the band; a too-tall idle shrinks to the band top;
    a too-small idle keeps 1.0 (an integer upscale when under half the band); never past the cell's top rows."""
    lo, hi = band.height
    idle, tallest = heights[0], max(heights)
    if lo <= idle <= hi:
        target, why = 1.0, "idle in band"
    elif idle > hi:
        target, why = hi / idle, "idle above band"
    else:
        target, why = (float(lo // idle), "integer upscale (idle under half the band)") if idle * 2 < lo else (
            1.0, "idle below band")
    fit = (band.foot_row - 1) / tallest                 # rows 2..feet: 1 px for the outline ring, 1 px border
    return (round(fit, 4), "fit tallest") if fit < target else (target, why)


def quantize(cells: list[tuple[np.ndarray, np.ndarray]], s: float) -> tuple[list[np.ndarray], np.ndarray]:
    """The house quantizer: one sheet palette over the four poses (with the detail mask), applied per pose by
    pixelize_native (s >= 1; an integer s is a nearest upscale first) or, s < 1, re-pixelized as monster.py shrinks."""
    if s > 1.0:
        k = int(s)
        cells = [(np.asarray(Image.fromarray(rc).resize((rc.shape[1] * k, rc.shape[0] * k), Image.Resampling.NEAREST)),
                  np.repeat(np.repeat(m, k, 0), k, 1)) for rc, m in cells]
    detail = np.concatenate([rc[PX.detail_mask(rc, m, 1 / min(s, 1.0))] for rc, m in cells])
    pal = PX.sheet_palette([rc[m] for rc, m in cells], COLORS, SEED, detail_px=detail)
    figs = []
    for rc, m in cells:
        art = rc.copy()
        art[~m] = (255, 0, 255)
        if s < 1.0:
            grid = (max(1, round(m.shape[1] * s)), max(1, round(m.shape[0] * s)))
            figs.append(np.asarray(PX.pixelize(Image.fromarray(art), m, grid, colors=COLORS, seed=SEED, palette=pal)))
        else:
            figs.append(np.asarray(PX.pixelize_native(Image.fromarray(art), m, (m.shape[1], m.shape[0]), colors=COLORS,
                                                      seed=SEED, palette=pal)[0]))
    return figs, pal


def anchor(a: np.ndarray) -> float:
    """The mean x of the opaque px in the figure's bottom ANCHOR_ROWS rows (its feet)."""
    ys, xs = np.where(a[..., 3] > 0)
    sel = ys > ys.max() - ANCHOR_ROWS
    return float(xs[sel].mean())


def place(figs: list[np.ndarray], band: S.MonsterBand) -> tuple[list[Image.Image], dict]:
    """Every pose with its anchor at the idle's x and its feet on the feet row; the cell widened as the cutter
    does (monster.cut: max(cell, span + 4), even, the idle centred, clamped 2 px from the sides)."""
    def bbox(a):
        ys, xs = np.where(a[..., 3] > 0)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    anchors = [anchor(f) for f in figs]
    shift = [-int(round(x)) for x in anchors]
    boxes = [bbox(f) for f in figs]
    lo_x = min(b[0] + s for b, s in zip(boxes, shift))
    hi_x = max(b[2] + s for b, s in zip(boxes, shift))
    c = band.cell
    cw = max(c, hi_x - lo_x + 1 + 4)
    cw += cw % 2
    ix0, ix1 = boxes[0][0] + shift[0], boxes[0][2] + shift[0]
    dx = cw // 2 - (ix0 + ix1 + 1) // 2
    if lo_x + dx < 2 or hi_x + dx > cw - 3:
        dx = 2 - lo_x if lo_x + dx < 2 else cw - 3 - hi_x
    frames, offs = [], []
    for f, (x0, y0, x1, y1), s in zip(figs, boxes, shift):
        out = np.zeros((c, cw, 4), np.uint8)
        tx, ty = s + dx, band.foot_row - y1
        if x0 + tx < 1 or x1 + tx > cw - 2 or y0 + ty < 1:
            raise SystemExit(f"user sheet: a pose does not fit the {cw}x{c} cell clear of its border")
        out[ty + y0:ty + y1 + 1, tx + x0:tx + x1 + 1] = f[y0:y1 + 1, x0:x1 + 1]
        frames.append(Image.fromarray(out))
        offs.append((tx, ty))
    return frames, {"offsets": offs, "cw": cw, "anchors": [round(x, 2) for x in anchors],
                    "anchor_x": round(anchors[0] + shift[0] + dx, 2)}


def cut(sid: str, rec: dict | None = None, gen: Path = HERE) -> tuple[list[Image.Image], dict]:
    """The four placed frames (idle, attack, hurt, kneel) and the import measures."""
    from gen import monster as M
    rec = rec or recipe(sid)
    band = S.MONSTER_BANDS[rec.get("size", "large")]
    img = source(rec, gen)
    cells = split(img)
    hs = [height(m) for _, m in cells]
    s, why = scale(hs, band)
    figs, pal = quantize(cells, s)
    frames, pinfo = place(figs, band)
    src = np.asarray(img)
    info = {"source_size": list(img.size), "source_colours": len(np.unique(src[src[..., 3] > 0][:, :3], axis=0)),
            "native_heights": hs, "scale": s, "scale_why": why, **pinfo,
            "palette": [[int(v) for v in c] for c in pal], "error": UR.colour_error(cells, frames, s, pinfo)}
    info["report"] = M.frame_report(frames, band)
    if not info["report"]["outline"]:
        raise SystemExit(f"{sid}: PX.OUTLINE missing from a frame (frame_report)")
    return frames, info


def sheet(frames: list[Image.Image]) -> Image.Image:
    """The approved monster sheet: idle, attack, hurt in one row (the kneel is its own file)."""
    w, h = frames[0].size
    out = Image.new("RGBA", (w * 3, h))
    for k in range(3):
        out.paste(frames[k], (k * w, 0))
    return out


def approve(sid: str, root: Path | None = None, today: str | None = None) -> list[Path]:
    """approved/<id>/monster_<size>.{png,json} + kneel.{png,json} behind the overwrite gate; a live monster_small.*
    needs a byte-identical archive under _retired/ and is removed (monster_hr_br.approve's shape)."""
    from gen import approve as AP
    from gen import retire as RT
    root = root or AP.APPROVED
    gen = root.parent                                   # the generator tree (a temp one in the selftest)
    rec = recipe(sid, gen / "monster_user.yaml")
    frames, info = cut(sid, rec, gen)
    size = rec.get("size", "large")
    tmp = Path("/tmp/efH/approve") / sid
    tmp.mkdir(parents=True, exist_ok=True)
    sheet(frames).save(tmp / f"monster_{size}.png")
    frames[3].save(tmp / "kneel.png")
    AP.overwrite_gate(sid, f"monster_{size}", tmp / f"monster_{size}.png", root)
    AP.overwrite_gate(sid, "kneel", tmp / "kneel.png", root)
    other = root / sid / f"monster_{'small' if size == 'large' else 'large'}.png"   # the old size's sheet
    if other.exists() and not RT.has_archived_copy(RT.Tree(gen), sid, other.name, other.read_bytes()):
        raise SystemExit(f"{sid}: {other.name} has no byte-identical archive under _retired/ (retire.py first)")
    dst = root / sid
    dst.mkdir(parents=True, exist_ok=True)
    meta, kneel = UR.metas(sid, rec, info, today or time.strftime("%Y-%m-%d"))
    for name, m in ((f"monster_{size}", meta), ("kneel", kneel)):
        shutil.copy2(tmp / f"{name}.png", dst / f"{name}.png")
        (dst / f"{name}.json").write_text(json.dumps(m, indent=2) + "\n")
    for ext in ("png", "json"):
        other.with_suffix(f".{ext}").unlink(missing_ok=True)
    return [dst / f"monster_{size}.png", dst / f"monster_{size}.json", dst / "kneel.png", dst / "kneel.json"]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["cut", "approve", "check"])
    ap.add_argument("id")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args(argv)
    if a.cmd == "cut":
        paths = UR.review(a.id, a.out)
        info = json.loads(paths[-1].read_text())
        print(json.dumps({k: info[k] for k in ("native_heights", "scale", "scale_why", "cw", "anchors", "error")}))
        return print("\n".join(map(str, paths))) or 0
    if a.cmd == "approve":
        return print("\n".join(f"approved: {p}" for p in approve(a.id))) or 0
    bad = [f"{n}: {why}" for n in ("monster_large", "monster_small", "kneel")
           if (HERE / "approved" / a.id / f"{n}.json").is_file()
           and (why := check(json.loads((HERE / "approved" / a.id / f"{n}.json").read_text())))]
    print("\n".join(bad) or f"{a.id}: OK (re-import byte-identical)")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())

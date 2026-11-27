"""Pass PT (docs/PLAYTEST_ART_PLAN.md 4.1): import a user-rendered field sheet (the user's own render in an interactive
image UI, e.g. ChatGPT) as an approved NPC field sheet. The render is the approved design; the import only cuts it
faithfully: a 3 x 3 sheet (rows front, back, side facing left; columns stand, left step, right step) split into three
row bands and three 8-connected figures per band, scaled only when the stands' height is outside the sheet's band
(s = 1.0 inside it: no resample), each figure placed in its 48 x 96 cell with its feet on row 93 (the broom's hop
frames keep their lift), the steps aligned on the stand's upper body, and one house palette for all nine
(monster_user.quantize: PX.sheet_palette + PX.pixelize_native, 15-bit, <= 16 colours, the darkest PX.OUTLINE, the
selective outline only where the art has none). Recipes: gen/field_user.yaml; the renders: gen/user_art/<id>/.

  python3 -I assets-src/gen/field_user.py cut <id> [--out DIR]   # measures + review page (~/temp/ff-game/playtest/art/user/<id>)
  python3 -I assets-src/gen/field_user.py approve <id>           # approved/<id>/field.{png,json}
  python3 -I assets-src/gen/field_user.py check [<id> ...|--all] # the approved sheets re-import byte for byte
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml
from PIL import Image

from gen import pixelize as PX
from gen.field_user_split import bands, crop, figure_mask, height, in_cell, native, pieces, resample, upper_cx

HERE = Path(__file__).resolve().parent
RECIPES = HERE / "field_user.yaml"
GW, GH, FOOT = 48, 96, 93
ROWS, FRAMES = ("down", "up", "left"), ("stand", "step_left", "step_right")
MAX_W = 46
# drawn height bands (lo, hi, target) of the stand frames (plan 3.3)
BANDS = {"adult": (84, 92, 88), "old": (80, 88, 84), "child": (50, 58, 54), "broom": (56, 72, 64)}


def recipe(sid: str, path: Path | None = None) -> dict:
    rec = (yaml.safe_load((path or RECIPES).read_text()) or {}).get(sid)
    if not rec:
        raise SystemExit(f"{sid}: no recipe in {(path or RECIPES).name}")
    if rec.get("band") not in BANDS:
        raise SystemExit(f"{sid}: band must be one of {sorted(BANDS)}")
    return rec


def source(rec: dict, gen: Path = HERE) -> Image.Image:
    """The tracked user render, checked against the recipe's sha256 (refused on a mismatch)."""
    data = (gen / rec["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != rec["sha256"]:
        raise SystemExit(f"{rec['file']}: sha256 does not match the recipe")
    return Image.open(gen / rec["file"]).convert("RGBA")


def scale(stands: list[int], band: str) -> tuple[float, str]:
    """s = 1.0 when the stands' median height is in the band; else target / height (one factor for the sheet)."""
    lo, hi, target = BANDS[band]
    h = int(np.median(stands))
    return (1.0, "in band") if lo <= h <= hi else (round(target / h, 4), f"median stand {h} outside {lo}-{hi}")


def cut(sid: str, rec: dict | None = None, gen: Path = HERE) -> tuple[Image.Image, dict]:
    """The approved 144 x 288 field sheet and the import measures."""
    from gen import monster_user as MU
    rec = rec or recipe(sid)
    img, pinfo = native(source(rec, gen))
    rgb, m, bg = figure_mask(img)
    rows = [pieces(m, b) for b in bands(m)]
    on_grid = img.size == (3 * GW, 3 * GH) and all(in_cell(mm, r, c) for r, row in enumerate(rows)
                                                   for c, mm in enumerate(row))
    cells = [crop(rgb, mm) for row in rows for mm in row]
    if rec.get("side_faces") == "right":                  # the side row drawn facing right: mirror its figures
        cells[6:] = [(rc[:, ::-1].copy(), mm[:, ::-1].copy(), o) for rc, mm, o in cells[6:]]
    hs = [height(c[1]) for c in cells]
    s, why = scale(hs[0::3], rec["band"])
    figs, pal = MU.quantize([resample(rc, mm, s) for rc, mm, _ in cells], 1.0)
    hop = rec.get("walk") == "hop"
    out = np.zeros((3 * GH, 3 * GW, 4), np.uint8)
    lifts, offs = [], []
    for r in range(3):
        ground = cells[3 * r][2][1] + cells[3 * r][1].shape[0] - 3      # the stand's lowest row in the source
        for c in range(3):
            f = figs[3 * r + c]
            ys, xs = np.where(f[..., 3] > 0)
            bottom = cells[3 * r + c][2][1] + cells[3 * r + c][1].shape[0] - 3
            lift = int(round((ground - bottom) * s)) if hop else 0
            if on_grid and s == 1.0:                       # a render on the 3 x 3 grid keeps its own x in the cell
                tx = cells[3 * r + c][2][0] - c * GW
            elif c == 0:
                base = GW // 2 - (xs.min() + xs.max() + 1) // 2
                tx = base
                ref = upper_cx(f) + base
            else:
                tx = int(round(ref - upper_cx(f)))
            ty = FOOT - lift - ys.max()
            if xs.max() - xs.min() + 1 > MAX_W or xs.min() + tx < 1 or xs.max() + tx > GW - 2 or ys.min() + ty < 0:
                raise SystemExit(f"{sid}: {ROWS[r]} {FRAMES[c]} does not fit the 48 x 96 cell (1 px side margin)")
            out[r * GH + ty + ys, c * GW + tx + xs] = f[ys, xs]
            lifts.append(lift)
            offs.append((int(tx), int(ty)))
    src = np.asarray(img)
    info = {"source_size": list(img.size), "source_colours": int(len(np.unique(src[m][:, :3], axis=0))),
            "background": bg, **pinfo, "band": rec["band"], "heights": hs, "scale": s, "scale_why": why,
            "colours": int(len(np.unique(out[out[..., 3] > 0][:, :3], axis=0))),
            "palette": [[int(v) for v in c] for c in pal], "offsets": offs, **({"lift": lifts} if hop else {})}
    return Image.fromarray(out), info


def meta_of(sid: str, rec: dict, info: dict, today: str) -> dict:
    return {"character": sid, "sheet": "field", "backend": "user", "tool": "assets-src/gen/field_user.py",
            "source": {"file": rec["file"], "sha256": rec["sha256"]}, "recipe": f"field_user.yaml#{sid}",
            "rendered_in": rec.get("tool", "ChatGPT (interactive)"), "rendered": str(rec.get("rendered")),
            "author": rec.get("author", "user"), "refs": rec.get("refs"), "grid": [GW, GH], "bottom_row": FOOT,
            "rows": list(ROWS), "frames": list(FRAMES), "flip_rows": [], **({"walk": rec["walk"]} if rec.get("walk") else {}),
            "cut": {k: v for k, v in info.items() if k != "palette"}, "imported": today,
            "approved": rec.get("approved"), "user_review": rec.get("user_review"), "route": "PT: user-rendered field sheet (house quantizer, no AI call)"}


def approve(sid: str, root: Path | None = None, today: str | None = None) -> list[Path]:
    from gen import approve as AP
    root = root or AP.APPROVED
    rec = recipe(sid, root.parent / "field_user.yaml")
    sheet, info = cut(sid, rec, root.parent)
    tmp = Path("/tmp/playtest-art/approve") / sid
    tmp.mkdir(parents=True, exist_ok=True)
    sheet.save(tmp / "field.png")
    dst = root / sid
    old = dst / "field.png"
    if old.exists() and old.read_bytes() != (tmp / "field.png").read_bytes():
        from gen import retire as RT
        if not RT.has_archived_copy(RT.Tree(root.parent), sid, "field.png", old.read_bytes()):
            raise SystemExit(f"{sid}: approved/{sid}/field.png differs and has no byte-identical archive (retire.py first)")
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "field.png").write_bytes((tmp / "field.png").read_bytes())
    (dst / "field.json").write_text(json.dumps(meta_of(sid, rec, info, today or time.strftime("%Y-%m-%d")), indent=2) + "\n")
    return [dst / "field.png", dst / "field.json"]


def check(meta: dict, gen: Path | None = None) -> str | None:
    """A `backend: user` approved field json: its recipe's source matches the recorded file and sha256, and
    re-importing it gives the approved png pixel for pixel. None when it holds, else the reason."""
    gen = gen or HERE
    sid = meta.get("character")
    try:
        rec = recipe(sid, gen / "field_user.yaml")
        if meta.get("source") != {"file": rec["file"], "sha256": rec["sha256"]}:
            return "the recipe's source / sha256 differ from the approved json"
        sheet, _ = cut(sid, rec, gen)
    except SystemExit as e:
        return str(e)
    have = np.asarray(Image.open(gen / "approved" / sid / "field.png").convert("RGBA"))
    return None if np.array_equal(np.asarray(sheet), have) else f"approved/{sid}/field.png differs from the re-import"


def user_check(meta: dict) -> str | None:
    """The style-lock dispatch of a `backend: user` approved json (selftest.py, selftest_roster.py; plan 4.1): a
    vehicle frame -> vehicle_user.check, a hero battle / kneel sheet (pass CB) -> hero_user.check, a field sheet ->
    check above, every other user sheet (EF-H monsters and kneels) -> monster_user.check."""
    if meta.get("vehicle"):                              # the ship's end views (gen/vehicle_user.py)
        from gen import vehicle_user as VU
        return VU.check(meta)
    if meta.get("tool") == "assets-src/gen/hero_user.py":   # pass CB: a user-rendered hero class sheet
        from gen import hero_user as HU
        return HU.check(meta)
    if meta.get("sheet") == "field":
        return check(meta)
    from gen import monster_user as MU
    return MU.check(meta)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["cut", "approve", "check"])
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args(argv)
    if a.cmd == "cut":
        from gen import field_user_review as FR
        for sid in a.ids:
            print("\n".join(map(str, FR.review(sid, a.out))))
        return 0
    if a.cmd == "approve":
        return print("\n".join(f"approved: {p}" for sid in a.ids for p in approve(sid))) or 0
    ids = a.ids or (list(yaml.safe_load(RECIPES.read_text()) or {}) if a.all else [])
    bad = []
    for sid in ids:
        p = HERE / "approved" / sid / "field.json"
        why = check(json.loads(p.read_text())) if p.is_file() else "not approved"
        print(f"{sid}: {why or 'OK (re-import identical)'}")
        bad += [sid] if why else []
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())

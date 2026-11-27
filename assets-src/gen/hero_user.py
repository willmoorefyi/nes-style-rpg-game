"""Pass CB (docs/CLASS_BARBARIAN_PLAN.md 3): import a user-rendered hero class sheet (the user's own render in an
interactive image UI, e.g. ChatGPT, from the class pack ~/temp/ff-game/class_pack) as the approved battle sheets of
its classes. The render is the approved design; the import only checks and splits it: a grid of 80 x 80 cells, one
row per class (base, then enhanced), seven columns READY, ATTACK, CAST, HURT, DOWN, VICTORY, KNEEL, binary alpha,
every figure inside its cell, its feet on row 76, every pose facing left. One house palette for the sheet (or, with
the recipe's `palette: rows`, one per class row, each applied to its own row only; plan 11): at most 16 colours, each
snapped to 15 bits (PX.snap15), the darkest PX.OUTLINE, one-to-one. No pixel is moved, added or
removed. Per class: approved/<class>/battle.png (3 x 2: ready, attack, cast / hurt, down, victory) and
battle_kneel.png (the kneel key), with their jsons. Recipes: gen/hero_user.yaml; the renders: gen/user_art/<id>/.

  python3 -I assets-src/gen/hero_user.py cut <recipe> [--out DIR]   # measures + review page
  python3 -I assets-src/gen/hero_user.py approve <recipe>           # approved/<class>/battle*.{png,json}
  python3 -I assets-src/gen/hero_user.py check [<recipe> ...|--all] # the approved files re-import byte for byte
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

HERE = Path(__file__).resolve().parent
RECIPES = HERE / "hero_user.yaml"
TOOL = "assets-src/gen/hero_user.py"
CELL, FOOT, COLOURS = 80, 76, 16
COLUMNS = ("ready", "attack", "cast", "hurt", "down", "victory", "kneel")
POSES = COLUMNS[:6]                                    # battle.png, 3 x 2 (puppet._cells order)
REVIEW = Path.home() / "temp/ff-game/class_pack/review/import"
# docs/CLASS_BARBARIAN_PLAN.md 11 (A1): `sheet` = one house palette for the whole render (<= 16 colours); `rows` = one
# per class row (<= 16 each, the renders that give every class its own 16 colours)
PALETTES = ("sheet", "rows")


def recipes(path: Path | None = None) -> dict:
    return yaml.safe_load((path or RECIPES).read_text()) or {}


def recipe(rid: str, path: Path | None = None) -> dict:
    rec = recipes(path).get(rid)
    if not rec:
        raise SystemExit(f"{rid}: no recipe in {(path or RECIPES).name}")
    if list(rec.get("columns") or []) != list(COLUMNS):
        raise SystemExit(f"{rid}: columns must be {list(COLUMNS)}")
    if rec.get("faces") != "left":
        raise SystemExit(f"{rid}: faces must be left (every hero battle pose faces the enemies)")
    rows = rec.get("rows") or []
    if not rows or len(set(rows)) != len(rows):
        raise SystemExit(f"{rid}: rows must name each class once")
    if rec.get("palette", "sheet") not in PALETTES:
        raise SystemExit(f"{rid}: palette must be one of {list(PALETTES)}")
    return rec


def recipe_of(cid: str, gen: Path = HERE) -> tuple[str, dict, int]:
    """(recipe id, recipe, row) of the recipe that holds class `cid`."""
    for rid in recipes(gen / "hero_user.yaml"):
        rec = recipe(rid, gen / "hero_user.yaml")
        if cid in rec["rows"]:
            return rid, rec, rec["rows"].index(cid)
    raise SystemExit(f"{cid}: no hero_user recipe names it")


def source(rec: dict, gen: Path = HERE) -> np.ndarray:
    """The tracked user render, checked against the recipe's sha256 (refused on a mismatch)."""
    data = (gen / rec["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != rec["sha256"]:
        raise SystemExit(f"{rec['file']}: sha256 does not match the recipe")
    return np.asarray(Image.open(gen / rec["file"]).convert("RGBA")).copy()


def _cells_apart(m: np.ndarray, ncols: int, nrows: int) -> list[str]:
    """Every pair of 8-adjacent opaque px on either side of a cell border (a piece crossing it)."""
    bad = []
    for c in range(1, ncols):
        x = c * CELL
        left, right = m[:, x - 1], m[:, x]
        near = right.copy()
        near[1:] |= right[:-1]
        near[:-1] |= right[1:]
        if (left & near).any():
            bad.append(f"a figure crosses the border of columns {c - 1} / {c}")
    for r in range(1, nrows):
        y = r * CELL
        top, bot = m[y - 1], m[y]
        near = bot.copy()
        near[1:] |= bot[:-1]
        near[:-1] |= bot[1:]
        if (top & near).any():
            bad.append(f"a figure crosses the border of rows {r - 1} / {r}")
    return bad


def palette(a: np.ndarray) -> dict[tuple, tuple]:
    """The house mapping {source rgb: 15-bit rgb} of the opaque px of `a` (the sheet, or one class row with
    `palette: rows`): <= 16 colours, PX.snap15, the darkest PX.OUTLINE, one-to-one on the final colours."""
    uniq = [tuple(int(v) for v in c) for c in np.unique(a[a[..., 3] > 0][:, :3], axis=0)]
    if len(uniq) > COLOURS:
        raise SystemExit(f"user sheet: {len(uniq)} colours, at most {COLOURS} (no colour is invented by a k-means)")
    snapped = PX.snap15(np.array(uniq, np.float32)).astype(int)
    dark = int(np.array(uniq).sum(1).argmin())
    out = {c: tuple(int(v) for v in s) for c, s in zip(uniq, snapped)}
    out[uniq[dark]] = tuple(PX.OUTLINE)
    if len(set(out.values())) != len(out):
        raise SystemExit("user sheet: two colours snap to the same 15-bit colour (the mapping must be one-to-one)")
    return out


def cut(rec: dict, gen: Path = HERE) -> tuple[dict[str, dict[str, Image.Image]], dict]:
    """{class: {pose: 80 x 80 cell}} for every row of the recipe (the seven columns), and the import measures."""
    a = source(rec, gen)
    nrows = len(rec["rows"])
    if a.shape[:2] != (nrows * CELL, len(COLUMNS) * CELL):
        raise SystemExit(f"user sheet: {a.shape[1]}x{a.shape[0]}, need {len(COLUMNS) * CELL}x{nrows * CELL} "
                         f"({len(COLUMNS)} x {nrows} cells of {CELL})")
    al = a[..., 3]
    if ((al > 0) & (al < 255)).any():
        raise SystemExit("user sheet: semi-transparent pixels (binary alpha needed)")
    m = al > 0
    bad = _cells_apart(m, len(COLUMNS), nrows)
    if bad:
        raise SystemExit("user sheet: " + "; ".join(bad))
    out = a.copy()
    if rec.get("palette", "sheet") == "rows":         # A1: each class row's own 16 colours
        maps = {}
        for r, cid in enumerate(rec["rows"]):
            try:
                maps[cid] = palette(a[r * CELL:(r + 1) * CELL])
            except SystemExit as e:
                raise SystemExit(f"{cid}: {e}") from None
    else:
        maps = dict.fromkeys(rec["rows"], palette(a))
    for r, cid in enumerate(rec["rows"]):
        band, mb = a[r * CELL:(r + 1) * CELL], m[r * CELL:(r + 1) * CELL]
        for src, dst in maps[cid].items():
            out[r * CELL:(r + 1) * CELL][(band[..., :3] == src).all(-1) & mb, :3] = dst
    cells: dict[str, dict[str, Image.Image]] = {}
    boxes = {}
    for r, cid in enumerate(rec["rows"]):
        cells[cid] = {}
        for c, pose in enumerate(COLUMNS):
            cell = out[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]
            ys, xs = np.where(cell[..., 3] > 0)
            if not len(ys):
                raise SystemExit(f"user sheet: {cid} {pose} is empty")
            if ys.max() != FOOT:
                raise SystemExit(f"user sheet: {cid} {pose} feet on row {ys.max()}, need {FOOT}")
            cells[cid][pose] = Image.fromarray(np.ascontiguousarray(cell))
            boxes[f"{cid}/{pose}"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    listed = {cid: [[list(s), list(d)] for s, d in sorted(p.items())] for cid, p in maps.items()}
    rows_mode = rec.get("palette", "sheet") == "rows"
    info = {"source_size": [int(a.shape[1]), int(a.shape[0])],
            "colours": {cid: len(p) for cid, p in maps.items()} if rows_mode else len(maps[rec["rows"][0]]),
            "palette": listed if rows_mode else listed[rec["rows"][0]], "boxes": boxes}
    return cells, info


def battle_sheet(cells: dict[str, Image.Image]) -> Image.Image:
    out = Image.new("RGBA", (3 * CELL, 2 * CELL))
    for i, pose in enumerate(POSES):
        out.paste(cells[pose], ((i % 3) * CELL, (i // 3) * CELL))
    return out


def metas(cid: str, rid: str, rec: dict, row: int, info: dict, today: str) -> tuple[dict, dict]:
    base = {"character": cid, "backend": "user", "tool": TOOL, "source": {"file": rec["file"], "sha256": rec["sha256"]},
            "recipe": f"hero_user.yaml#{rid}", "row": row, "rendered_in": rec.get("tool", "ChatGPT (interactive)"),
            "rendered": str(rec.get("rendered")), "author": rec.get("author", "user"), "refs": rec.get("refs"),
            "source_name": rec.get("source_name"), "grid": [CELL, CELL], "bottom_row": FOOT, "faces": "left",
            "imported": today, "approved": rec.get("approved"), "user_review": rec.get("user_review"),
            "route": "CB: user-rendered hero class sheet (house palette map, no AI call)"}
    per_row = isinstance(info["palette"], dict)       # A1: a class's files carry only its own row's map
    cut_info = {"colours": info["colours"][cid] if per_row else info["colours"],
                "palette": info["palette"][cid] if per_row else info["palette"],
                "boxes": {k.split("/")[1]: v for k, v in info["boxes"].items() if k.startswith(f"{cid}/")}}
    battle = {**base, "sheet": "battle", "layout": [3, 2], "poses": list(POSES),
              "cut": {**cut_info, "boxes": {p: b for p, b in cut_info["boxes"].items() if p in POSES}}}
    kneel = {**base, "sheet": "battle_kneel", "foot_row": FOOT,
             "cut": {**cut_info, "boxes": {"kneel": cut_info["boxes"]["kneel"]}}}
    return battle, kneel


def files_of(cells: dict[str, Image.Image]) -> dict[str, Image.Image]:
    return {"battle": battle_sheet(cells), "battle_kneel": cells["kneel"]}


def approve(rid: str, root: Path | None = None, today: str | None = None) -> list[Path]:
    from gen import approve as AP
    from gen import retire as RT
    root = root or AP.APPROVED
    gen = root.parent
    rec = recipe(rid, gen / "hero_user.yaml")
    cells, info = cut(rec, gen)
    tmp = Path("/tmp/class-barbarian/approve") / rid
    tmp.mkdir(parents=True, exist_ok=True)
    plan = []
    for row, cid in enumerate(rec["rows"]):
        for name, img in files_of(cells[cid]).items():
            p = tmp / f"{cid}_{name}.png"
            img.save(p)
            old = root / cid / f"{name}.png"
            if name == "battle_kneel":
                AP.overwrite_gate(cid, name, p, root)
            elif old.exists() and old.read_bytes() != p.read_bytes() and \
                    not RT.has_archived_copy(RT.Tree(gen), cid, old.name, old.read_bytes()):
                raise SystemExit(f"{cid}: approved/{cid}/{old.name} differs and has no byte-identical archive "
                                 "(retire.py first)")
            plan.append((cid, row, name, p))
    written = []
    today = today or time.strftime("%Y-%m-%d")
    for cid, row, name, p in plan:
        dst = root / cid
        dst.mkdir(parents=True, exist_ok=True)
        (dst / f"{name}.png").write_bytes(p.read_bytes())
        meta = dict(zip(("battle", "battle_kneel"), metas(cid, rid, rec, row, info, today)))[name]
        (dst / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
        written += [dst / f"{name}.png", dst / f"{name}.json"]
    return written


def check(meta: dict, gen: Path | None = None) -> str | None:
    """A `backend: user` hero json (battle or battle_kneel): its recipe's source matches the recorded file and sha256,
    and re-importing gives the approved png pixel for pixel. None when it holds, else the reason."""
    gen = gen or HERE
    cid, sheet = meta.get("character"), meta.get("sheet")
    if sheet not in ("battle", "battle_kneel"):
        return f"sheet {sheet} is not a hero battle sheet"
    if meta.get("faces") != "left" or meta.get("facing_fix") or meta.get("face_fix"):
        return "a user hero sheet faces left as rendered (no face_fix / facing_fix)"
    try:
        _, rec, _ = recipe_of(str(cid), gen)
        if meta.get("source") != {"file": rec["file"], "sha256": rec["sha256"]}:
            return "the recipe's source / sha256 differ from the approved json"
        cells, _ = cut(rec, gen)
    except SystemExit as e:
        return str(e)
    want = np.asarray(files_of(cells[cid])[sheet])
    p = gen / "approved" / str(cid) / f"{sheet}.png"
    if not p.is_file():
        return f"approved/{cid}/{sheet}.png missing"
    have = np.asarray(Image.open(p).convert("RGBA"))
    return None if np.array_equal(want, have) else f"approved/{cid}/{sheet}.png differs from the re-import"


def review(rid: str, out: Path | None = None) -> list[Path]:
    """The 14 imported cells at x4 on a grey ground (one row per class) and the measures json."""
    out = out or REVIEW
    out.mkdir(parents=True, exist_ok=True)
    rec = recipe(rid)
    cells, info = cut(rec)
    k, sw = 4, 40
    h = len(rec["rows"]) * CELL * k
    strips = list(info["palette"].values()) if isinstance(info["palette"], dict) else [info["palette"]]
    sheet = Image.new("RGBA", (len(COLUMNS) * CELL * k, h + len(strips) * (2 * sw + 8)), (60, 60, 70, 255))
    for r, cid in enumerate(rec["rows"]):
        for c, pose in enumerate(COLUMNS):
            sheet.alpha_composite(cells[cid][pose].resize((CELL * k, CELL * k), Image.Resampling.NEAREST),
                                  (c * CELL * k, r * CELL * k))
    for j, strip in enumerate(strips):                      # the colour map per strip: source (top) -> house (below)
        y = h + j * (2 * sw + 8) + 4
        for i, (src, dst) in enumerate(strip):
            sheet.paste((*src, 255), (i * (sw + 4), y, i * (sw + 4) + sw, y + sw))
            sheet.paste((*dst, 255), (i * (sw + 4), y + sw, i * (sw + 4) + sw, y + 2 * sw))
    sheet.save(p := out / f"{rid}_import_x4.png")
    (q := out / f"{rid}_import.json").write_text(json.dumps(info, indent=2) + "\n")
    return [p, q]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["cut", "approve", "check"])
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args(argv)
    if a.cmd == "cut":
        return print("\n".join(str(p) for rid in a.ids for p in review(rid, a.out))) or 0
    if a.cmd == "approve":
        return print("\n".join(f"approved: {p}" for rid in a.ids for p in approve(rid))) or 0
    rids = a.ids or (list(recipes()) if a.all else [])
    bad = []
    for rid in rids:
        for cid in recipe(rid)["rows"]:
            for sheet in ("battle", "battle_kneel"):
                p = HERE / "approved" / cid / f"{sheet}.json"
                why = check(json.loads(p.read_text())) if p.is_file() else "not approved"
                print(f"{cid} {sheet}: {why or 'OK (re-import identical)'}")
                bad += [cid] if why else []
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())

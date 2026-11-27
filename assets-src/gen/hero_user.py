"""Pass CB (docs/CLASS_BARBARIAN_PLAN.md 3): import a user-rendered hero class sheet (the user's own render in an
interactive image UI, e.g. ChatGPT, from the class pack ~/temp/ff-game/class_pack) as the approved battle sheets of
its classes. The render is the approved design; the import only checks and splits it: a grid of 80 x 80 cells, one
row per class (base, then enhanced), seven columns READY, ATTACK, CAST, HURT, DOWN, VICTORY, KNEEL, binary alpha,
every figure inside its cell, its feet on row 76, every pose facing left. One house palette for the sheet: at most 16
colours, each snapped to 15 bits (PX.snap15), the darkest PX.OUTLINE, one-to-one. No pixel is moved, added or
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

from gen import hero_user_grid as HG

HERE = Path(__file__).resolve().parent
RECIPES = HERE / "hero_user.yaml"
TOOL = "assets-src/gen/hero_user.py"
CELL, FOOT, COLOURS, COLUMNS = HG.CELL, HG.FOOT, HG.COLOURS, HG.COLUMNS
POSES = COLUMNS[:6]                                    # battle.png, 3 x 2 (puppet._cells order)
REVIEW = Path.home() / "temp/ff-game/class_pack/review/import"


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


def cut(rec: dict, gen: Path = HERE) -> tuple[dict[str, dict[str, Image.Image]], dict]:
    """{class: {pose: cell}} for every row of the recipe (the seven columns), and the import measures (the checks and
    the recipe geometry live in hero_user_grid.py: pass CB's 80 x 80 rule, pass CL's oversize cells)."""
    return HG.cut(rec, source(rec, gen))


def palette(a: np.ndarray) -> dict[tuple, tuple]:
    return HG.palette(a)


def battle_sheet(cells: dict[str, Image.Image]) -> Image.Image:
    w, h = cells["ready"].size
    out = Image.new("RGBA", (3 * w, 2 * h))
    for i, pose in enumerate(POSES):
        out.paste(cells[pose], ((i % 3) * w, (i // 3) * h))
    return out


def metas(cid: str, rid: str, rec: dict, row: int, info: dict, today: str) -> tuple[dict, dict]:
    g = info["geometry"]
    base = {"character": cid, "backend": "user", "tool": TOOL, "source": {"file": rec["file"], "sha256": rec["sha256"]},
            "recipe": f"hero_user.yaml#{rid}", "row": row, "rendered_in": rec.get("tool", "ChatGPT (interactive)"),
            "rendered": str(rec.get("rendered")), "author": rec.get("author", "user"), "refs": rec.get("refs"),
            "source_name": rec.get("source_name"), "grid": [g["cw"], g["ch"]], "bottom_row": g["foot"],
            "faces": "left", "imported": today, "approved": rec.get("approved"), "user_review": rec.get("user_review"),
            "route": "CB: user-rendered hero class sheet (house palette map, no AI call)"}
    if (g["cw"], g["ch"]) != (CELL, CELL):             # pass CL (docs/CLASS_LANCE_PLAN.md 3, 4): the body anchor
        base = {**base, "body": HG.body_xywh(g), "palette": g["palette"],
                "route": "CL: user-rendered oversize hero class sheet (body-box anchor, lance prop; no AI call)"}
    pal = info["palettes"][cid] if g["palette"] == "per_row" else info["palette"]
    cut_info = {"colours": len(pal) if g["palette"] == "per_row" else info["colours"], "palette": pal,
                "boxes": {k.split("/")[1]: v for k, v in info["boxes"].items() if k.startswith(f"{cid}/")}}
    prop = g["prop"]

    def with_prop(m: dict, poses) -> dict:
        if not prop:
            return m
        lines = prop["lines"][cid]
        return {**m, "prop": {"kind": prop["kind"], "radius": prop["radius"], "head_len": HG.HL.head_len(prop, cid),
                              "colours": prop["colours"][cid],
                              "shaft_colours": (prop.get("shaft_colours") or {}).get(cid),
                              "lines": {p: lines[p] for p in poses}},
                "cut": {**m["cut"], "lance_px": {p: info["lance_px"][f"{cid}/{p}"] for p in poses}}}
    battle = with_prop({**base, "sheet": "battle", "layout": [3, 2], "poses": list(POSES),
                        "cut": {**cut_info, "boxes": {p: b for p, b in cut_info["boxes"].items() if p in POSES}}},
                       POSES)
    kneel = with_prop({**base, "sheet": "battle_kneel", "foot_row": g["foot"],
                       "cut": {**cut_info, "boxes": {"kneel": cut_info["boxes"]["kneel"]}}}, ("kneel",))
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
        cells, info = cut(rec, gen)
    except SystemExit as e:
        return str(e)
    g = info["geometry"]
    if [meta.get("grid"), meta.get("bottom_row"), meta.get("body")] != \
            [[g["cw"], g["ch"]], g["foot"], HG.body_xywh(g) if "body" in meta or g["prop"] else None]:
        return "the json's grid / bottom_row / body differ from the recipe"       # pass CL: the anchor
    if g["prop"] and any(meta["prop"]["lines"][p] != g["prop"]["lines"][cid][p] for p in meta["prop"]["lines"]):
        return "the json's lance lines differ from the recipe"
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
    cw, ch = cells[rec["rows"][0]]["ready"].size
    h = len(rec["rows"]) * ch * k
    sheet = Image.new("RGBA", (len(COLUMNS) * cw * k, h + 2 * sw + 8), (60, 60, 70, 255))
    for r, cid in enumerate(rec["rows"]):
        for c, pose in enumerate(COLUMNS):
            sheet.alpha_composite(cells[cid][pose].resize((cw * k, ch * k), Image.Resampling.NEAREST),
                                  (c * cw * k, r * ch * k))
    for i, (src, dst) in enumerate(info["palette"]):          # the colour map: source (top) -> house colour (below)
        sheet.paste((*src, 255), (i * (sw + 4), h + 4, i * (sw + 4) + sw, h + 4 + sw))
        sheet.paste((*dst, 255), (i * (sw + 4), h + 4 + sw, i * (sw + 4) + sw, h + 4 + 2 * sw))
    sheet.save(p := out / f"{rid}_import_x4.png")
    (q := out / f"{rid}_import.json").write_text(json.dumps(info, indent=2) + "\n")
    if not info["geometry"]["prop"]:
        return [p, q]
    from gen import hero_user_lance as HL                  # pass CL 4.2 item 7: the lance mask and the body box
    HL.review_sheet(source(rec), rec, info["geometry"]).save(o := out / f"{rid}_lance_x4.png")
    return [p, q, o]


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

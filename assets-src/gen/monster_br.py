"""EF-F (docs/ENEMY_FEEDBACK_PLAN.md F3/F4): Bedrock monster sheets. A thin layer over bedrock.invoke (the gate, the BR
ledger, the cache) and the monster cutter (monster.cut): one Stable Image Ultra image-to-image render per variation
holds all four poses in a 2x2 grid (idle, attack / hurt, kneel), drawn over a magenta layout guide, or (`route:
fallback`, monster_br_poses.py) an Ultra idle plus three Control Structure poses; the cut gives the 3-pose monster
sheet and the AI kneel key (the idle's cell). Variations, prompts and seeds: monster_br.yaml.

  python3 -I assets-src/gen/monster_br.py guide <id>                      # the layout guide (offline)
  python3 -I assets-src/gen/monster_br.py gen <id> --var N [--paid]       # one render (ledgered, cached)
  python3 -I assets-src/gen/monster_br.py cut <id> --var N                # cut + review sheet (offline)
  python3 -I assets-src/gen/monster_br.py approve <id> --var N            # approved/<id>/monster_<size>, kneel
  python3 -I assets-src/gen/monster_br.py status | selftest
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml
from PIL import Image

from gen import bedrock as B
from gen import monster as M
from gen import spec as S
from gen.monster_br_poses import BOX, CANVAS, FEET, KEY, guide, prompt  # noqa: F401 (the 2x2 guide and text)

HERE = Path(__file__).resolve().parent
SPEC = HERE / "monster_br.yaml"
REVIEW = Path.home() / "temp" / "ff-game" / "ef" / "bedrock"
MODEL = "ultra"                                               # default; a variation may name `model: sd35`
MODELS = ("ultra", "sd35", "structure")
PURPOSE = "ef_sheet"
POSES = ("idle", "attack", "hurt", "kneel")
GUIDE_OPTS = ("open_guide", "recolor_key")                   # per-variation guide options
TOP_MARGIN = 6                                                # headroom rows above the figure (overshoots)


def spec(path: Path = SPEC) -> dict:
    return yaml.safe_load(path.read_text())


def sprite(sid: str, sp: dict | None = None) -> dict:
    sp = sp or spec()
    if sid not in sp["sprites"]:
        raise SystemExit(f"{sid}: not in {SPEC.name} ({', '.join(sp['sprites'])})")
    return sp["sprites"][sid]


def variation(sid: str, n: int, sp: dict | None = None) -> dict:
    v = [x for x in sprite(sid, sp).get("variations") or [] if x["n"] == n]
    if not v or n > 5:
        raise SystemExit(f"{sid}: no variation {n} in {SPEC.name} (at most 5 per sprite, F0)")
    return v[0]


def body(sid: str, n: int, sp: dict | None = None) -> dict:
    sp = sp or spec()
    sm, v = sprite(sid, sp), variation(sid, n, sp)
    pos, neg = prompt(sp, sm, v)
    out = {"prompt": pos, "negative_prompt": neg, "image": B.png_b64(guide({**sm, **{k: v[k] for k in GUIDE_OPTS if k in v}}, v.get("guide", 2), v.get("fill"))),
           "strength": float(v["strength"]), "seed": int(v["seed"]), "output_format": "png"}
    if model_of(v) == "sd35":
        out["mode"] = "image-to-image"                 # SD 3.5 needs the mode; Ultra takes image + strength alone
    if model_of(v) == "structure":                     # route structure: one Control Structure call on the 2x2 guide
        out["control_strength"] = float(out.pop("strength"))
    return out


def model_of(v: dict) -> str:
    m = v.get("model", MODEL)
    if m not in MODELS:
        raise SystemExit(f"model {m!r}: one of {MODELS}")
    return m


def requests(sid: str, n: int, sp: dict | None = None) -> list[tuple[str, str, dict, str]]:
    """[(model, purpose, body, cache key)]: one 2x2 render, or the fallback's four (idle, attack, hurt, kneel)."""
    sp = sp or spec()
    sm, v = sprite(sid, sp), variation(sid, n, sp)
    if v.get("route") == "fallback":
        from gen import monster_br_poses as MP
        return [(m, p, b, B.cache_key(m, b)) for m, p, b in MP.bodies(sp, sm, v)]
    b, m = body(sid, n, sp), model_of(v)
    return [(m, "ef_structure" if m == "structure" else PURPOSE, b, B.cache_key(m, b))]


def strip(raw: Image.Image, flip: list[int] = ()) -> tuple[Image.Image, int]:
    """2x2 render -> one 1x4 strip (idle, attack, hurt, kneel); cells listed in `flip` are mirrored (wrong facing)."""
    w, h = raw.size
    cw, ch = w // 2, h // 2
    out = Image.new("RGB", (cw * 4, ch), KEY)
    for k in range(4):
        c = raw.crop(((k % 2) * cw, (k // 2) * ch, (k % 2 + 1) * cw, (k // 2 + 1) * ch)).convert("RGB")
        out.paste(c.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if k in flip else c, (k * cw, 0))
    return out, ch


def cut(raws: list[Image.Image], sm: dict, v: dict) -> tuple[list[Image.Image], dict]:
    band = S.MONSTER_BANDS[sm["size"]]
    if len(raws) == 4:
        from gen import monster_br_poses as MP
        st, ch = MP.stitch(sm, raws, v.get("flip") or []), MP.SIDE
    else:
        st, ch = strip(raws[0], v.get("flip") or [])
    pitch = 0.8 * ch / (1.5 * band.height[1])          # area-average above the band, then the re-pixelize shrink
    gw = round(S.MONSTER_EXPECTED_PITCH * st.width / pitch)
    native = M.native_art
    if v.get("regrid"):            # ignore the render's own coarse grid (SD 3.5: ~11 px, 50 rows): area path, then shrink
        M.native_art = lambda raw, guide_width: (raw.convert("RGB").resize((round(raw.width / pitch), round(
            raw.height / pitch)), Image.Resampling.BOX), {"mode": f"regrid, area-averaged at {pitch:.2f} px"})
    try:
        frames, info = M.cut(st, band, colors=16, seed=0, n_cells=4, top_margin=v.get("top_margin", TOP_MARGIN),
                             guide_width=gw, keep_pieces=v.get("keep_pieces"))
    finally:
        M.native_art = native
    info["report"] = M.frame_report(frames, band)
    return frames, info


def sheet(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    out = Image.new("RGBA", (w * 3, h))
    for k in range(3):
        out.paste(frames[k], (k * w, 0))
    return out


def approve(sid: str, n: int, root: Path | None = None, frames: list[Image.Image] | None = None,
            info: dict | None = None, keys: list[str] | None = None, sp: dict | None = None) -> list[Path]:
    from gen import approve as AP
    sp = sp or spec()
    sm, v, reqs = sprite(sid, sp), variation(sid, n, sp), requests(sid, n, sp)
    keys = keys or [r[3] for r in reqs]
    if frames is None:
        if not all(B.is_cached(k) for k in keys):
            raise SystemExit(f"{sid} v{n}: renders {keys} not all cached; gen and review first")
        frames, info = cut([Image.open(B.CACHE / f"{k}.png") for k in keys], sm, v)
    root, band, name = root or AP.APPROVED, S.MONSTER_BANDS[sm["size"]], f"monster_{sm['size']}"
    tmp = Path("/tmp/efF") / sid / f"v{n}"
    tmp.mkdir(parents=True, exist_ok=True)
    sheet(frames).save(tmp / f"{name}.png")
    frames[3].save(tmp / "kneel.png")
    AP.overwrite_gate(sid, name, tmp / f"{name}.png", root)
    AP.overwrite_gate(sid, "kneel", tmp / "kneel.png", root)
    dst = root / sid
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tmp / f"{name}.png", dst / f"{name}.png")
    shutil.copy2(tmp / "kneel.png", dst / "kneel.png")
    today, (w, h) = time.strftime("%Y-%m-%d"), frames[0].size
    route = "fallback: ultra idle + structure poses" if len(keys) == 4 else f"{reqs[0][0]} 2x2 image-to-image"
    models = [B.MODELS[r[0]] for r in reqs]
    meta = {"character": sid, "sheet": name, "backend": "bedrock", "model": models[0], "seed": v["seed"],
            "cache_key": keys[0], "purpose": reqs[0][1], "pass": "EF", "approved": today, "grid": [w, h],
            "bottom_row": band.foot_row, "layout": [3, 1], "poses": list(S.MONSTER_POSES), "size": sm["size"],
            "floating": False, "flip_frames": [], "route": f"{route} (monster_br.py)", "variation": n,
            "settings": {k: v[k] for k in ("strength", "control") if k in v}, "flipped_cells": v.get("flip") or [],
            "cut": {k: info.get(k) for k in ("mode", "scale", "fit", "shrink", "native_heights", "cell_px")},
            "note": v.get("note", "")}
    if len(keys) == 4:
        meta["sources"] = [{"pose": p, "model": m, "cache_key": k} for p, m, k in zip(POSES, models, keys)]
    kneel = {"character": sid, "sheet": "kneel", "arm": f"ef_{reqs[-1][0]}", "seed": v["seed"], "try": n,
             "grid": [w, h], "bottom_row": band.foot_row, "foot_row": band.foot_row, "models": [models[-1]],
             "br_cache_keys": [keys[-1]], "settings": {"route": f"{route}, the kneel cell (monster_br.py)",
                                                       **meta["settings"], "pass": "EF"}, "approved": today}
    (dst / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
    (dst / "kneel.json").write_text(json.dumps(kneel, indent=2) + "\n")
    if root == AP.APPROVED:
        for k in keys:
            AP._unignore(k)
    return [dst / f"{name}.png", dst / f"{name}.json", dst / "kneel.png", dst / "kneel.json"]


def status() -> str:
    rows = [r["purpose"] for r in B.read_br_ledger() if r.get("event") == "request" and r.get("pass") == "EF"]
    return f"pass EF: {len(rows)} requests {({p: rows.count(p) for p in sorted(set(rows))})}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["guide", "gen", "cut", "approve", "status", "selftest"])
    ap.add_argument("id", nargs="?")
    ap.add_argument("--var", type=int)
    ap.add_argument("--paid", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd in ("status", "selftest"):
        from gen import selftest_monster_br as T
        return print(status()) or 0 if a.cmd == "status" else T.main()
    out = REVIEW / a.id / f"v{a.var}" if a.var else REVIEW / a.id
    out.mkdir(parents=True, exist_ok=True)
    if a.cmd == "guide":
        return guide(sprite(a.id)).save(out / "guide.png") or 0
    sp = spec()
    sm, v, reqs = sprite(a.id, sp), variation(a.id, a.var, sp), requests(a.id, a.var, sp)
    if a.cmd == "gen":
        for m, p, b, k in reqs:
            B.invoke(m, b, paid=a.paid, purpose=p)
            print(f"{a.id} v{a.var}: {m} {k} ({status()})")
        return 0
    if a.cmd == "cut":
        raws = [Image.open(B.CACHE / f"{k}.png") for *_, k in reqs]
        frames, info = cut(raws, sm, v)
        if len(reqs) == 1:
            guide({**sm, **{k: v[k] for k in GUIDE_OPTS if k in v}}, v.get("guide", 2), v.get("fill")).save(out / "guide.png")
        (out / "prompt.txt").write_text("\n\n".join(f"{m} {k}\n{b['prompt']}\nNEGATIVE: {b['negative_prompt']}\n"
                                                    f"seed {b['seed']} {b.get('strength', b.get('control_strength'))}"
                                                    for m, _, b, k in reqs) + "\n")
        from gen.monster_br_review import review
        print(review(raws, frames, info, out, sheet), json.dumps(info["report"], default=str)[:400])
        return 0
    for path in approve(a.id, a.var):
        print("approved:", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

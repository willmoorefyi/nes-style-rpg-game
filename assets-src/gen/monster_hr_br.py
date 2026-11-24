"""EF-G G3 / G4 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): the SD 3.5 Large repaint of the idle masters and the puppet poses,
the large cut and the held approval. Variation rows: gen/monster_hr.yaml `<id>.variations.<pose>` ({n, seed, strength,
key}); one image-to-image request per row, the input being the master (idle) or the posed PNG (its sha256 checked
against the yaml) composited on flat mid-grey, through bedrock.invoke (main checkout only, pass EF4, purpose ef4_pose).

  python3 -I assets-src/gen/monster_hr_br.py gen <id> <pose> --var N [--paid]   # one repaint (ledgered, cached)
  python3 -I assets-src/gen/monster_hr_br.py cut <id>                           # the picks -> large cut + review sheets
  python3 -I assets-src/gen/monster_hr_br.py approve <id>                       # HELD: run only after the user's size decision
  python3 -I assets-src/gen/monster_hr_br.py status
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

import numpy as np
from PIL import Image

from gen import bedrock as B
from gen import monster_hr_prep as P

POSES = ("idle", "attack", "hurt", "kneel")
PURPOSE, PASS, MODEL = "ef4_pose", "EF4", "sd35"
REVIEW = Path.home() / "temp" / "ff-game" / "ef" / "bedrock4"
PITCH = {"large": P.HEIGHT / 115.0, "small": P.HEIGHT / 68.0}   # render px per art px: the figure ~115 / ~68 art px


def source(sid: str, pose: str, sp: dict) -> Image.Image:
    """The master (idle) or the posed PNG, checked against its recorded sha256 (RGBA)."""
    sm = sp["sprites"][sid]
    name, field = ("idle_master", "master_sha256") if pose == "idle" else (f"{pose}_posed", f"{pose}_sha256")
    img = Image.open(P.OUT / sid / f"{name}.png").convert("RGBA")
    if P.sha(img) != sm.get(field):
        raise SystemExit(f"{sid} {pose}: {name}.png does not match {field} in monster_hr.yaml (rebuild it)")
    return img


def on_grey(img: Image.Image, sp: dict) -> Image.Image:
    bg = Image.new("RGBA", img.size, (*sp.get("grey", [128, 128, 128]), 255))
    bg.alpha_composite(img)
    return bg.convert("RGB")


def variation(sm: dict, pose: str, n: int) -> dict:
    rows = [v for v in ((sm.get("variations") or {}).get(pose) or []) if v["n"] == n]
    if not rows or n > 5:
        raise SystemExit(f"no {pose} variation {n} (at most 5 calls per image, EF-G G3)")
    return rows[0]


def text(sp: dict, sm: dict, pose: str) -> tuple[str, str]:
    pos = f"{sm['subject']} Pose: {sm['poses'][pose]}. {sp['style']}"
    return " ".join(pos.split()), " ".join(sp["negative"].split())


def request(sid: str, pose: str, n: int, sp: dict, img: Image.Image | None = None) -> tuple[dict, str]:
    sm = sp["sprites"][sid]
    v = variation(sm, pose, n)
    pos, neg = text(sp, sm, pose)
    src = on_grey(img or source(sid, v.get("input", pose), sp), sp)   # `input`: a superseded pose of the recipe
    body = {"prompt": pos, "negative_prompt": neg, "seed": int(v["seed"]), "output_format": "png",
            "mode": "image-to-image", "image": B.png_b64(src), "strength": float(v["strength"])}
    return body, B.cache_key(MODEL, body)


def keyed(raw: Image.Image, sm: dict) -> Image.Image:
    """The repaint off its grey page by G1's key (border-sampled, the largest figure and the pieces touching it)."""
    rgb = np.asarray(raw.convert("RGB").resize((P.SIDE, P.SIDE), Image.Resampling.LANCZOS)).copy()
    k = sm.get("repaint_key") or {"mode": "flat", "tol": 26, "holes": 400}
    m = P.main_figure(P.key(rgb, k))
    return Image.fromarray(np.dstack([rgb, m.astype(np.uint8) * 255]))


def iou(a: Image.Image, b: Image.Image) -> float:
    x, y = np.asarray(a)[..., 3] > 0, np.asarray(b)[..., 3] > 0
    return round(float((x & y).sum() / max(1, (x | y).sum())), 3)


def gen(sid: str, pose: str, n: int, paid: bool, sp: dict) -> dict:
    src = source(sid, variation(sp["sprites"][sid], pose, n).get("input", pose), sp)
    body, key = request(sid, pose, n, sp, src)
    raw = B.invoke(MODEL, body, paid=paid, purpose=PURPOSE)
    k = keyed(raw, sp["sprites"][sid])
    d = REVIEW / sid / "g3" / f"{pose}_v{n}"
    d.mkdir(parents=True, exist_ok=True)
    on_grey(src, sp).save(d / "input.png")
    raw.save(d / "raw.png")
    k.save(d / "keyed.png")
    page = Image.new("RGB", (P.SIDE * 2 + 30, P.SIDE + 20), (40, 40, 44))
    page.paste(on_grey(src, sp), (10, 10))
    page.paste(raw.convert("RGB").resize((P.SIDE, P.SIDE)), (P.SIDE + 20, 10))
    page.save(d / "compare.png")
    info = {"key": key, "iou_posed": iou(k, src), "seed": body["seed"], "strength": body["strength"]}
    (d / "prompt.txt").write_text(f"{MODEL} {key}\n{body['prompt']}\nNEGATIVE: {body['negative_prompt']}\n"
                                  f"seed {body['seed']} strength {body['strength']} IoU {info['iou_posed']}\n")
    return info


def picks(sid: str, sp: dict) -> list[tuple[str, int, str]]:
    sm = sp["sprites"][sid]
    pk = sm.get("pick") or {}
    missing = [p for p in POSES if p not in pk]
    if missing:
        raise SystemExit(f"{sid}: no pick for {missing} in monster_hr.yaml")
    return [(p, pk[p], request(sid, p, pk[p], sp)[1]) for p in POSES]


def cut(sid: str, sp: dict, size: str = "large") -> tuple[list[Image.Image], dict, list[Image.Image]]:
    """The four keyed repaints cut together by the shared cutter (one palette from all four, <= 16 colours, the shared
    outline, feet on the band's feet row), area-averaged at PITCH (the figure ~115 art px at the large size)."""
    from gen import monster as M
    from gen import spec as S
    sm, band = sp["sprites"][sid], S.MONSTER_BANDS[size]
    raws = [Image.open(B.CACHE / f"{k}.png").convert("RGB") for _, _, k in picks(sid, sp)]
    keyed_ = [keyed(r, sm) for r in raws]
    st = Image.new("RGB", (P.SIDE * 4, P.SIDE), (255, 0, 255))
    for i, k in enumerate(keyed_):
        st.paste(k.convert("RGB"), (i * P.SIDE, 0), k.getchannel("A"))
    pitch = PITCH[size]
    native = M.native_art
    M.native_art = lambda raw, guide_width: (raw.convert("RGB").resize((round(raw.width / pitch), round(
        raw.height / pitch)), Image.Resampling.BOX), {"mode": f"area-averaged at {pitch:.2f} px"})
    try:
        frames, info = M.cut(st, band, colors=16, seed=0, n_cells=4, top_margin=6, guide_width=P.SIDE * 4)
    finally:
        M.native_art = native
    info["report"] = M.frame_report(frames, band)
    return frames, info, keyed_


def review(sid: str, sp: dict) -> list[Path]:
    from gen import monster_br as MB
    from gen.monster_br_review import review as page
    from gen.monster_hr_review import despur_page, screen
    out = REVIEW / sid
    big, info, raws = cut(sid, sp)
    small, sinfo, _ = cut(sid, sp, "small")
    paths = [page(raws, big, info, out / "set", MB.sheet), page(raws, small, sinfo, out / "set_small", MB.sheet)]
    paths += [screen(big, small, out / "screen_x2.png"), despur_page(sid, big, out / "despur.png")]
    return paths


def approve(sid: str, sp: dict, root: Path | None = None) -> list[Path]:
    """HELD until the user's size decision (EF-G G4): approved/<id>/monster_large.{png,json} and kneel.{png,json}
    (Bedrock shapes), approved/<id>/monster_small.* removed (an archived copy under _retired/<id>_vN required), and
    with the real tree the render cache files un-ignored and monsters.yaml's entry rewritten (size large, the brief)."""
    from gen import approve as AP
    from gen import monster_br as MB
    from gen import retire as RT
    from gen.monster_hr_review import write_monsters_yaml
    root = root or AP.APPROVED
    frames, info, _ = cut(sid, sp)
    tmp = Path("/tmp/efG/approve") / sid
    tmp.mkdir(parents=True, exist_ok=True)
    MB.sheet(frames).save(tmp / "monster_large.png")
    frames[3].save(tmp / "kneel.png")
    AP.overwrite_gate(sid, "monster_large", tmp / "monster_large.png", root)
    AP.overwrite_gate(sid, "kneel", tmp / "kneel.png", root)
    small = root / sid / "monster_small.png"
    if small.exists() and not RT.has_archived_copy(RT.Tree(root.parent), sid, small.name, small.read_bytes()):
        raise SystemExit(f"{sid}: monster_small.png has no byte-identical archive under _retired/ (retire.py first)")
    dst = root / sid
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tmp / "monster_large.png", dst / "monster_large.png")
    shutil.copy2(tmp / "kneel.png", dst / "kneel.png")
    sm, pk, today, (w, h) = sp["sprites"][sid], picks(sid, sp), time.strftime("%Y-%m-%d"), frames[0].size
    srcs = [{"pose": p, "cache_key": k, "variation": n, "seed": int(variation(sm, p, n)["seed"]),
             "strength": float(variation(sm, p, n)["strength"])} for p, n, k in pk]
    inputs = {"idle": {"master_sha256": sm["master_sha256"], "raw_keys": [sm["prep"]["source"]] + (
        [sm["prep"]["graft"]["source"]] if sm["prep"].get("graft") else [])}}
    inputs.update({p: {"posed_sha256": sm[f"{variation(sm, p, n).get('input', p)}_sha256"],
                       "master_sha256": sm["master_sha256"]} for p, n, _ in pk[1:]})
    meta = {"character": sid, "sheet": "monster_large", "backend": "bedrock", "model": B.MODELS[MODEL],
            "seed": srcs[0]["seed"], "cache_key": srcs[0]["cache_key"], "purpose": PURPOSE, "pass": PASS,
            "approved": today, "grid": [w, h], "bottom_row": 122, "layout": [3, 1], "poses": ["idle", "attack", "hurt"],
            "size": "large", "floating": False, "flip_frames": [], "sources": srcs[:3], "inputs": inputs,
            "recipe": f"monster_hr.yaml#{sid}", "route": "EF4: puppet-then-repaint (monster_hr_prep.py, "
            "monster_hr_puppet.py, SD 3.5 Large image-to-image monster_hr_br.py)",
            "cut": {k: info.get(k) for k in ("mode", "scale", "fit", "native_heights", "cell_px")}}
    kneel = {"character": sid, "sheet": "kneel", "arm": "ef4_sd35", "seed": srcs[3]["seed"], "try": srcs[3]["variation"],
             "grid": [w, h], "bottom_row": 122, "foot_row": 122, "models": [B.MODELS[MODEL]],
             "br_cache_keys": [srcs[3]["cache_key"]], "approved": today,
             "settings": {"route": "EF4 kneel: puppet pose repainted by SD 3.5 (monster_hr_br.py)", "pass": PASS,
                          "strength": srcs[3]["strength"], "posed_sha256": sm["kneel_sha256"]}}
    (dst / "monster_large.json").write_text(json.dumps(meta, indent=2) + "\n")
    (dst / "kneel.json").write_text(json.dumps(kneel, indent=2) + "\n")
    for ext in ("png", "json"):
        (dst / f"monster_small.{ext}").unlink(missing_ok=True)
    if root == AP.APPROVED:
        for s in srcs:
            AP._unignore(s["cache_key"])
        write_monsters_yaml(sid, sm)
    return [dst / "monster_large.png", dst / "monster_large.json", dst / "kneel.png", dst / "kneel.json"]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["gen", "cut", "approve", "status"])
    ap.add_argument("id", nargs="?")
    ap.add_argument("pose", nargs="?", choices=POSES)
    ap.add_argument("--var", type=int)
    ap.add_argument("--paid", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "status":
        rows = [r for r in B.read_br_ledger() if r.get("event") == "request" and r.get("pass") == PASS]
        return print(f"pass {PASS}: {len(rows)} requests") or 0
    sp = P.spec()
    if a.cmd == "gen":
        info = gen(a.id, a.pose, a.var, a.paid, sp)
        from gen.monster_hr_yaml import record_row
        record_row(a.id, a.pose, a.var, "key", info["key"])
        record_row(a.id, a.pose, a.var, "iou", str(info["iou_posed"]))
        return print(f"{a.id} {a.pose} v{a.var}: {info}") or 0
    if a.cmd == "cut":
        return print("\n".join(map(str, review(a.id, sp)))) or 0
    return print("\n".join(f"approved: {p}" for p in approve(a.id, sp))) or 0


if __name__ == "__main__":
    raise SystemExit(main())

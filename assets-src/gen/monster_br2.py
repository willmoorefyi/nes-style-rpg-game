"""EF2 (pass EF2, user approval 2026-11-24 after the EF debriefs): Bedrock monster sheets one pose per full-size
render. The idle first, by SD 3.5 Large text-to-image with no old-sprite guide (a new design); then attack, hurt and
kneel each by SD 3.5 image-to-image from a guide drawn from the NEW idle (its figure warped about the feet: lean,
squash, shift), never from the old sprites. The picked renders are cut together by the shared cutter (monster.cut)
into the 3-pose monster sheet and the AI kneel key. Prompts, variations and picks: monster_br2.yaml.

  python3 -I assets-src/gen/monster_br2.py gen <id> <pose> --var N [--paid]   # one render (ledgered, cached)
  python3 -I assets-src/gen/monster_br2.py look <id> <pose> --var N           # raw (+ guide) into the review folder
  python3 -I assets-src/gen/monster_br2.py cut <id>                           # the picks -> sheet, kneel, review
  python3 -I assets-src/gen/monster_br2.py approve <id>                       # approved/<id>/monster_<size>, kneel
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
import yaml
from PIL import Image

from gen import bedrock as B
from gen import monster as M
from gen import spec as S
from gen.monster_br2_key import FEET, KEY, SIDE, figure, key_bg, warp  # noqa: F401 (keying and the pose warp)

HERE = Path(__file__).resolve().parent
SPEC = HERE / "monster_br2.yaml"
REVIEW = Path.home() / "temp" / "ff-game" / "ef" / "bedrock2"
POSES = ("idle", "attack", "hurt", "kneel")
PURPOSE, PASS = "ef2_pose", "EF2"
TOP_MARGIN = 6


def spec(path: Path = SPEC) -> dict:
    return yaml.safe_load(path.read_text())


def sprite(sid: str, sp: dict) -> dict:
    if sid not in sp["sprites"]:
        raise SystemExit(f"{sid}: not in {SPEC.name}")
    return sp["sprites"][sid]


def variation(sm: dict, pose: str, n: int) -> dict:
    v = [x for x in (sm.get("variations") or {}).get(pose) or [] if x["n"] == n]
    if not v or n > 5:
        raise SystemExit(f"no {pose} variation {n} (at most 5 per pose, EF2)")
    return v[0]


def text(sp: dict, sm: dict, pose: str, v: dict) -> tuple[str, str]:
    """Short, positive-only prompt (EF lesson: 'sprite sheet' / 'not chibi' draw exactly that)."""
    tx = v.get("text", 1)              # text 2: no purple / pink in the negative (they fight the key); 3: no "dark fantasy"
    t2 = tx >= 2
    parts = [sp[{1: "style", 2: "style2", 3: "style3", 4: "style4"}[tx]], f"{sm['subject']} {v.get('add', '')}", f"Pose: {v.get('pose', sm['poses'][pose])}.",
             sp["background2" if t2 else "background"]]
    neg = ", ".join(x for x in (sp["negative2" if t2 else "negative"], sm.get("negative", ""), v.get("negative", ""))
                    if x)
    return " ".join(" ".join(p.split()) for p in parts), " ".join(neg.split())


def idle_pick(sid: str, sp: dict) -> Image.Image:
    sm = sprite(sid, sp)
    im = Image.open(B.CACHE / f"{request(sid, 'idle', sm['pick']['idle'], sp)[3]}.png")
    return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if 0 in (sm.get("flip") or []) else im   # a left-facing idle


def guide(sid: str, pose: str, v: dict, sp: dict) -> Image.Image:
    return warp(idle_pick(sid, sp), v.get("warp") or {})


def request(sid: str, pose: str, n: int, sp: dict) -> tuple[str, str, dict, str]:
    sm = sprite(sid, sp)
    v = variation(sm, pose, n)
    pos, neg = text(sp, sm, pose, v)
    b = {"prompt": pos, "negative_prompt": neg, "seed": int(v["seed"]), "output_format": "png"}
    if pose == "idle" and v.get("outpaint"):         # extend a cropped idle render (the feet) by Stable Outpaint
        o = v["outpaint"]
        src = Image.open(B.CACHE / f"{request(sid, 'idle', o['from'], sp)[3]}.png").convert("RGB")
        b = {"image": B.png_b64(src), "prompt": pos, "seed": int(v["seed"]), "output_format": "png",
             "creativity": float(o.get("creativity", 0.4)), **{d: int(o[d]) for d in ("left", "right", "up", "down")
                                                                 if d in o}}
        return "outpaint", PURPOSE, b, B.cache_key("outpaint", b)
    if pose == "idle":
        b.update(mode="text-to-image", aspect_ratio=v.get("aspect", "1:1"))
    else:
        b.update(mode="image-to-image", image=B.png_b64(guide(sid, pose, v, sp)), strength=float(v["strength"]))
    model = v.get("model", "sd35")
    if model == "ultra":                          # Ultra: no `mode`
        b.pop("mode")
    return model, PURPOSE, b, B.cache_key(model, b)


def picks(sid: str, sp: dict) -> list[tuple[str, str, dict, str]]:
    pk = sprite(sid, sp).get("pick") or {}
    missing = [p for p in POSES if p not in pk]
    if missing:
        raise SystemExit(f"{sid}: no pick for {missing} in {SPEC.name}")
    return [request(sid, p, pk[p], sp) for p in POSES]


def cut(sid: str, sp: dict) -> tuple[list[Image.Image], dict, list[Image.Image]]:
    sm = sprite(sid, sp)
    band = S.MONSTER_BANDS[sm["size"]]
    raws = [Image.open(B.CACHE / f"{k}.png") for *_, k in picks(sid, sp)]
    flip = sm.get("flip") or []
    st = Image.new("RGB", (SIDE * 4, SIDE), KEY)
    for k, r in enumerate(raws):
        c = key_bg(r, sm.get("key_thresh", 30), bool(sm.get("drop_green")), sm.get("floor") if k == 0 else None,
                   sm.get("holes", 0))
        if sm.get("drop_green"):                    # green tints left in the figure (mane tips): to their grey
            a = np.asarray(c).astype(int)
            gm = (a[..., 1] > a[..., 0] + 12) & (a[..., 1] > a[..., 2] + 12)
            a[gm] = a[gm].mean(1, keepdims=True).astype(int)
            c = Image.fromarray(a.astype(np.uint8))
        if sm.get("lift"):                          # lift the shadows of a near-black design before the 16-colour cut
            g = float(sm["lift"])
            a = np.asarray(c).astype(float) / 255
            keep = (a[..., 0] > 0.59) & (a[..., 2] > 0.59) & (a[..., 1] < 0.4)
            a = np.where(keep[..., None], a, a ** g)
            c = Image.fromarray((a * 255).round().astype(np.uint8))
        st.paste(c.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if k in flip else c, (k * SIDE, 0))
    pitch = 0.8 * SIDE / (sm.get("over", 1.5) * band.height[1])   # `over`: how far above the band the area path lands
    native = M.native_art           # area path at our pitch (SD 3.5's own ~11 px grid gives too few rows)
    M.native_art = lambda raw, guide_width: (raw.convert("RGB").resize((round(raw.width / pitch), round(
        raw.height / pitch)), Image.Resampling.BOX), {"mode": f"area-averaged at {pitch:.2f} px"})
    try:
        frames, info = M.cut(st, band, colors=16, seed=0, n_cells=4, top_margin=sm.get("top_margin", TOP_MARGIN),
                             guide_width=SIDE * 4, keep_pieces=sm.get("keep_pieces"))
    finally:
        M.native_art = native
    if sm.get("min_piece"):                       # drop detached specks / wisps under min_piece px from each frame
        from gen import pixelize as PX
        for k, fr in enumerate(frames):
            a = np.asarray(fr).copy()
            lab, n = PX.components(a[..., 3] > 0)
            sizes = np.bincount(lab.ravel())
            small = [i for i in range(1, n + 1) if sizes[i] < sm["min_piece"]]
            a[np.isin(lab, small)] = 0
            drop = band.foot_row - int(np.where(a[..., 3].any(1))[0].max())   # back onto the feet row
            if drop > 0:
                a = np.concatenate([np.zeros((drop, *a.shape[1:]), a.dtype), a[:-drop]])
            frames[k] = Image.fromarray(a)
    info["report"] = M.frame_report(frames, band)
    return frames, info, raws


def approve(sid: str, sp: dict, root: Path | None = None, cutres: tuple | None = None) -> list[Path]:
    from gen import approve as AP
    from gen import monster_br as MB
    sm, reqs = sprite(sid, sp), picks(sid, sp)
    frames, info, _ = cutres or cut(sid, sp)
    root, band, name = root or AP.APPROVED, S.MONSTER_BANDS[sm["size"]], f"monster_{sm['size']}"
    tmp = Path("/tmp/efF/ef2") / sid
    tmp.mkdir(parents=True, exist_ok=True)
    MB.sheet(frames).save(tmp / f"{name}.png")
    frames[3].save(tmp / "kneel.png")
    AP.overwrite_gate(sid, name, tmp / f"{name}.png", root)
    AP.overwrite_gate(sid, "kneel", tmp / "kneel.png", root)
    dst = root / sid
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tmp / f"{name}.png", dst / f"{name}.png")
    shutil.copy2(tmp / "kneel.png", dst / "kneel.png")
    today, (w, h), pk = time.strftime("%Y-%m-%d"), frames[0].size, sm["pick"]
    srcs = [{"pose": p, "model": B.MODELS[m], "cache_key": k, "variation": pk[p], "seed": b["seed"],
             **({"strength": b["strength"]} if "strength" in b else {})} for p, (m, _, b, k) in zip(POSES, reqs)]
    meta = {"character": sid, "sheet": name, "backend": "bedrock", "model": srcs[0]["model"],
            "seed": srcs[0]["seed"], "cache_key": srcs[0]["cache_key"], "purpose": PURPOSE, "pass": PASS,
            "approved": today, "grid": [w, h], "bottom_row": band.foot_row, "layout": [3, 1],
            "poses": list(S.MONSTER_POSES), "size": sm["size"], "floating": False, "flip_frames": [],
            "route": "EF2: SD 3.5 idle text-to-image, attack / hurt / kneel image-to-image from the new idle "
                     "(monster_br2.py)", "sources": srcs[:3], "flipped_cells": sm.get("flip") or [],
            "cut": {k: info.get(k) for k in ("mode", "scale", "fit", "shrink", "native_heights", "cell_px")},
            "review": sm.get("review", "")}
    kneel = {"character": sid, "sheet": "kneel", "arm": "ef2_sd35", "seed": srcs[3]["seed"], "try": pk["kneel"],
             "grid": [w, h], "bottom_row": band.foot_row, "foot_row": band.foot_row, "models": [srcs[3]["model"]],
             "br_cache_keys": [srcs[3]["cache_key"]], "settings": {"route": "EF2 kneel: SD 3.5 image-to-image from "
                                                                   "the new idle (monster_br2.py)", "pass": PASS,
                                                                   "strength": srcs[3].get("strength")},
             "approved": today}
    (dst / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
    (dst / "kneel.json").write_text(json.dumps(kneel, indent=2) + "\n")
    if root == AP.APPROVED:
        for s in srcs:
            AP._unignore(s["cache_key"])
    return [dst / f"{name}.png", dst / f"{name}.json", dst / "kneel.png", dst / "kneel.json"]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["gen", "look", "cut", "approve", "status"])
    ap.add_argument("id", nargs="?")
    ap.add_argument("pose", nargs="?", choices=POSES)
    ap.add_argument("--var", type=int)
    ap.add_argument("--paid", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "status":
        rows = [r["purpose"] for r in B.read_br_ledger() if r.get("event") == "request" and r.get("pass") == PASS]
        return print(f"pass {PASS}: {len(rows)} requests {({p: rows.count(p) for p in set(rows)})}") or 0
    sp = spec()
    out = REVIEW / a.id
    out.mkdir(parents=True, exist_ok=True)
    if a.cmd in ("gen", "look"):
        m, p, b, k = request(a.id, a.pose, a.var, sp)
        if a.cmd == "gen":
            B.invoke(m, b, paid=a.paid, purpose=p)
        d = out / f"{a.pose}_v{a.var}"
        d.mkdir(exist_ok=True)
        shutil.copy(B.CACHE / f"{k}.png", d / "raw.png")
        if a.pose != "idle":
            guide(a.id, a.pose, variation(sprite(a.id, sp), a.pose, a.var), sp).save(d / "guide.png")
        (d / "prompt.txt").write_text(f"{m} {k}\n{b['prompt']}\nNEGATIVE: {b.get('negative_prompt', '')}\nseed {b['seed']} "
                                      f"strength {b.get('strength')}\n")
        print(f"{a.id} {a.pose} v{a.var}: {m} {k} -> {d}")
        return 0
    if a.cmd == "cut":
        from gen import monster_br as MB
        from gen.monster_br_review import review
        frames, info, raws = cut(a.id, sp)
        print(review(raws, frames, info, out / "set", MB.sheet), json.dumps(info["report"], default=str)[:300])
        return 0
    for path in approve(a.id, sp):
        print("approved:", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""monsters_ai build stage (docs/ENEMY_ANIM_PLAN.md 6.1): approved keyframes + generated in-betweens + palette-swap
variants -> a native-size (texScale 1) shelf-packed atlas assets/sprites/monsters-ai.png and its JSON.

JSON: {scale: 2 (screen px per art px), texScale: 1 (PNG px per art px), sheets: {id: {cell, footRow, floating,
frames: {name: [x, y]} (every MONSTER_FRAMES / BOSS_FRAMES name, plus RAISE_FRAMES for a sheet with attack_raise; held
or missing frames alias along monster_recipes.FALLBACK, e.g. a held daze shows hurt_in1), anim, holds, lungePx,
hasRaise, opaqueRight (the idle key's rightmost opaque column), head ([x, y]: the centre of the idle key's topmost
opaque row), tip ([x, y]: the centre of attack_raise's topmost opaque row, the heavy attack's weapon tip; sheets with
attack_raise only), sequence_version, page}}}.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

from gen import anim_checks as C
from gen import monster_anim as MA

SCALE = 2
TEX_SCALE = 1
SHELF_W = 2048
SEQUENCE_VERSION = 1


def shelf_pack(sizes: list[tuple[int, int]], cap: int = SHELF_W) -> tuple[list[tuple[int, int]], int, int]:
    """Deterministic shelf packer in the given order: left to right, a new shelf when the row is full."""
    x = y = shelf_h = width = 0
    pos = []
    for w, h in sizes:
        if x and x + w > cap:
            y, x, shelf_h = y + shelf_h, 0, 0
        pos.append((x, y))
        x += w
        shelf_h = max(shelf_h, h)
        width = max(width, x)
    return pos, width, y + shelf_h


def sprite_frames(sid: str, meta: dict, kfs: dict[str, Image.Image]) -> tuple[dict[str, Image.Image], list[str], bool]:
    """(unique frames: keyframes + generated, holds, anim) for a base sprite; the build fails on a check failure in a
    frame that is not held (lock mismatches only warn here; `monster_anim.py check --all` fails on them). The wave-0
    checks F3-F5 and F7 are part of the build gate since V.3 (docs/ENEMY_ANIM_ISSUES.md, revision 1)."""
    from gen import monster_check as MC
    cfg = MA.load_rig(sid)
    if not cfg:
        return dict(kfs), [], False
    gen = MA.generate(sid, cfg, kfs, meta)
    holds = [h["frame"] for h in cfg.get("holds") or []]
    rep = MC.check_sprite(sid, cfg, kfs, meta, gen, efix_gates=True)   # V.3: the wave-0 checks gate the build
    lock = rep.pop("lock", [])
    fails = [f"{sid} {k}: {e}" for k, v in rep.items() for e in v]
    if fails:
        raise SystemExit("monsters_ai: animation checks failed\n  " + "\n  ".join(fails))
    if lock:
        print(f"monsters_ai: WARNING {sid} lock: {lock[0]} (run monster_anim.py lock {sid} after review)")
    return {**kfs, **{n: Image.fromarray(f["img"], "RGBA") for n, f in gen.items()}}, holds, True


def anchors(idle: Image.Image) -> dict:
    """Runtime anchors of the idle key (pass F): opaqueRight (enemy reach) and head (status overlays)."""
    a = np.asarray(idle)[..., 3] > 0
    ys, xs = np.nonzero(a)
    top = int(ys.min())
    row = np.nonzero(a[top])[0]
    return {"opaqueRight": int(xs.max()), "head": [int(round((row.min() + row.max()) / 2)), top]}


def tip(raise_key: Image.Image) -> dict:
    """The heavy attack's weapon tip (play-test fix): the topmost opaque pixel of `attack_raise` ([x, y], the centre of
    its top row; the glint plays there during the raised hold). Meta only: no frame changes."""
    a = np.asarray(raise_key)[..., 3] > 0
    top = int(np.nonzero(a.any(axis=1))[0][0])
    row = np.nonzero(a[top])[0]
    return {"tip": [int(round((row.min() + row.max()) / 2)), top]}


def build(out: Path) -> dict:
    from gen import monster as M
    entries = MA.load_entries()
    if not entries:
        print("monsters_ai: no approved monster sheets")
        return {}
    specs = {m["id"]: m for m in yaml.safe_load((MA.HERE / "monsters.yaml").read_text())}
    sprites: dict[str, tuple[dict, dict[str, Image.Image], list[str], bool, int]] = {}
    for sid, meta, kfs in entries:
        frames, holds, anim = sprite_frames(sid, meta, kfs)
        L = MA.lunge_px(kfs["idle"])
        sprites[sid] = (meta, frames, holds, anim, L)
        for v in specs.get(sid, {}).get("variants", []) or []:
            vf = {n: M.recolor(f, v) for n, f in frames.items()}
            allowed = {tuple(int(c) for c in px) for k in kfs for px in np.asarray(vf[k])[np.asarray(vf[k])[..., 3] > 0][:, :3]}
            bad = [f"{v['id']} {n}: {e}" for n in vf if n not in kfs
                   for e in C.palette_lock(np.asarray(vf[n]), allowed) + C.binary_alpha(np.asarray(vf[n]))]
            if bad:
                raise SystemExit("monsters_ai: variant checks failed\n  " + "\n  ".join(bad))
            sprites[v["id"]] = (meta, vf, holds, anim, L)
    order = sorted(sprites)
    names_of = {s: MA.frames_for("cast" in sprites[s][1], "attack_raise" in sprites[s][1]) for s in order}
    items = [(sid, n) for sid in order for n in names_of[sid] if n in sprites[sid][1]]
    pos, w, h = shelf_pack([sprites[s][1][n].size for s, n in items])
    page = C.page_size(w, h)
    if page:
        raise SystemExit(f"monsters_ai: {page[0]}")
    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rects: dict[str, dict[str, list[int]]] = {s: {} for s in order}
    for (sid, n), (x, y) in zip(items, pos):
        atlas.paste(sprites[sid][1][n], (x, y))
        rects[sid][n] = [x, y]
    arr = np.asarray(atlas)
    sheets = {}
    for sid in order:
        meta, frames, holds, anim, L = sprites[sid]
        names = names_of[sid]
        fr = {n: rects[sid][MA.resolve(n, rects[sid])] for n in names}
        cw, ch = frames["idle"].size
        for n in names:
            img = frames[MA.resolve(n, frames)]
            bad = C.atlas_exact(arr, (fr[n][0], fr[n][1], cw, ch), np.asarray(img))
            if bad:
                raise SystemExit(f"monsters_ai: {sid} {n}: {bad[0]}")
        sheets[sid] = {"cell": [cw, ch], "footRow": meta["bottom_row"], "floating": meta.get("floating", False),
                       "frames": fr, "anim": anim, "holds": holds, "lungePx": L, "hasRaise": "attack_raise" in frames,
                       **anchors(frames["idle"]), **(tip(frames["attack_raise"]) if "attack_raise" in frames else {}),
                       "sequence_version": SEQUENCE_VERSION, "page": 0}
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "monsters-ai.png")
    meta_json = {"scale": SCALE, "texScale": TEX_SCALE, "sheets": sheets}
    (out / "monsters-ai.json").write_text(json.dumps(meta_json, indent=2) + "\n")
    print(f"monsters_ai: {len(sheets)} sheets, atlas {w}x{h} native (texScale {TEX_SCALE}); "
          f"animated {[s for s in order if sheets[s]['anim']]}")
    return meta_json

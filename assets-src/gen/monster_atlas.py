"""monsters_ai build stage (docs/ENEMY_ANIM_PLAN.md 6.1): approved keyframes + generated in-betweens + palette-swap
variants -> native-size (texScale 1) shelf-packed atlas pages assets/sprites/monsters-ai-<n>.png (each <= MAX_PAGE,
2048 px a side; page groups in gen/monster_pages.py, docs/ROSTER_PLAN.md 8) and one JSON index, monsters-ai.json.

JSON: {scale: 2 (screen px per art px), texScale: 1 (PNG px per art px), pages: [{file, w, h}] (file names relative
to the JSON), sheets: {id: {cell, footRow, floating,
frames: {name: [x, y]} (every MONSTER_FRAMES / BOSS_FRAMES name, plus RAISE_FRAMES for a sheet with attack_raise; held
or missing frames alias along monster_recipes.FALLBACK, e.g. a held daze shows hurt_in1), anim, holds, lungePx,
hasRaise, opaqueRight (the idle key's rightmost opaque column), head ([x, y]: the centre of the idle key's topmost
opaque row), idleBox ([l, t, r, b]: the idle key's opaque box, inclusive; FW-A2), scale (only for a sheet listed in
gen/monster_scale.yaml: its integer display scale, FW-S), tip ([x, y]: the centre of attack_raise's topmost opaque row, the heavy attack's weapon tip; sheets with
attack_raise only, or atk_wind2's for a rig with `raise: false`, FW-R), travelTop / lungeRight / homeX (FW-A, below),
sequence_version, page (index into pages)}}}.

FW-A anchors (docs/ROSTER_FIX_PLAN.md 3; metadata only, no frame changes), native px in the cell, every extent
inclusive (int(xs.max()), as opaqueRight), frames resolved through MA.resolve: travelTop = the min opaque row over
TRAVEL_FRAMES; lungeRight = the max opaque column over LUNGE_FRAMES (the attack and raise frames); homeX = [min, max]
opaque column over HOME_FRAMES, plus RANGED_FRAMES for a sheet whose enemy has `attack: ranged` (enemies.yaml).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

from gen import anim_checks as C
from gen import monster_anim as MA
from gen import monster_pages as MP

SCALE = 2
TEX_SCALE = 1
SEQUENCE_VERSION = 1
TRAVEL_FRAMES = ("atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover", "atk_raise_in",
                 "attack_raise", "atk_raise_b", "atk_swing", "atk_swing2", "idle", "hurt_in1", "hurt_in2", "hurt")
LUNGE_FRAMES = TRAVEL_FRAMES[:11]
HOME_FRAMES = ("idle", "idle_b", "hurt_in1", "hurt_in2", "hurt", "daze", "daze_b")
RANGED_FRAMES = ("atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover")
ENEMIES = MA.HERE.parent.parent / "assets" / "data" / "enemies.yaml"
SCALE_TABLE = MA.HERE / "monster_scale.yaml"
DISPLAY_SCALES = (2, 3)            # FW-S: integer screen px per art px only (no stair-steps)


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
    """Runtime anchors of the idle key (pass F): opaqueRight (enemy reach) and head (status overlays); FW-A2
    (docs/REDESIGN_PLAN.md 1): idleBox [l, t, r, b], the idle frame's opaque box (inclusive; the bestiary centres it)."""
    a = np.asarray(idle)[..., 3] > 0
    ys, xs = np.nonzero(a)
    top = int(ys.min())
    row = np.nonzero(a[top])[0]
    return {"opaqueRight": int(xs.max()), "head": [int(round((row.min() + row.max()) / 2)), top],
            "idleBox": [int(xs.min()), top, int(xs.max()), int(ys.max())]}


def load_scale(sprites: list[str] | set[str], path: Path | None = None) -> dict[str, int]:
    """FW-S (docs/REDESIGN_PLAN.md 2.2, D-V1 S1): the per-sheet integer display scale table gen/monster_scale.yaml,
    {sprite: 3}. Allowed values: 2 and 3; a sprite that is not an atlas sheet is refused. Empty = every sheet at the
    atlas SCALE (no JSON change)."""
    path = path or SCALE_TABLE
    table = (yaml.safe_load(path.read_text()) if path.exists() else None) or {}
    if not isinstance(table, dict):
        raise SystemExit(f"monsters_ai: {path.name} must map sprite ids to a scale ({table!r})")
    bad = {k: v for k, v in table.items() if v not in DISPLAY_SCALES or isinstance(v, bool)}
    unknown = sorted(set(table) - set(sprites))
    if bad or unknown:
        raise SystemExit(f"monsters_ai: {path.name}: scales must be one of {DISPLAY_SCALES} ({bad}); unknown sprites "
                         f"{unknown}")
    return dict(table)


def tip(raise_key: Image.Image) -> dict:
    """The heavy attack's weapon tip (play-test fix): the topmost opaque pixel of `attack_raise` ([x, y], the centre of
    its top row; the glint plays there during the raised hold). Meta only: no frame changes."""
    a = np.asarray(raise_key)[..., 3] > 0
    top = int(np.nonzero(a.any(axis=1))[0][0])
    row = np.nonzero(a[top])[0]
    return {"tip": [int(round((row.min() + row.max()) / 2)), top]}


def ranged_sheets() -> set[str]:
    """The sheet ids of enemies with `attack: ranged` (their sprite, else their id, as BattleArt resolves it)."""
    return {str(e.get("sprite") or e["id"]).removesuffix(".png") for e in yaml.safe_load(ENEMIES.read_text()) or []
            if e.get("attack") == "ranged"}


def _extent(frames: dict[str, Image.Image], names: list[str], want: tuple[str, ...]) -> tuple[int, int, int]:
    """(min column, max column, min row) of the opaque pixels over the frames of `want` the sheet has (inclusive)."""
    left, right, top = [], [], []
    for n in want:
        if n not in names:
            continue
        ys, xs = np.nonzero(np.asarray(frames[MA.resolve(n, frames)])[..., 3] > 0)
        if len(xs):
            left.append(int(xs.min())), right.append(int(xs.max())), top.append(int(ys.min()))
    return min(left), max(right), min(top)


def travel_anchors(frames: dict[str, Image.Image], names: list[str], ranged: bool = False) -> dict:
    """FW-A: travelTop, lungeRight and homeX (inclusive) of a sheet's frames (`names`: its frame list)."""
    top = _extent(frames, names, TRAVEL_FRAMES)[2]
    right = _extent(frames, names, LUNGE_FRAMES)[1]
    left_h, right_h, _ = _extent(frames, names, HOME_FRAMES + (RANGED_FRAMES if ranged else ()))
    return {"travelTop": top, "lungeRight": right, "homeX": [left_h, right_h]}


def sheet_meta(meta: dict, frames: dict[str, Image.Image], names: list[str], fr: dict, holds: list[str], anim: bool,
               lunge: int, page: int, ranged: bool) -> dict:
    """One sheet's JSON entry. The heavy tip comes from attack_raise, or (FW-R, `raise: false`) from atk_wind2."""
    tip_key = "attack_raise" if "attack_raise" in frames else \
        MA.resolve("atk_wind2", frames) if meta.get("raise_off") else None
    cw, ch = frames["idle"].size
    return {"cell": [cw, ch], "footRow": meta["bottom_row"], "floating": meta.get("floating", False),
            "frames": fr, "anim": anim, "holds": holds, "lungePx": lunge, "hasRaise": "attack_raise" in frames,
            **anchors(frames["idle"]), **(tip(frames[tip_key]) if tip_key else {}),
            **travel_anchors(frames, names, ranged), "sequence_version": SEQUENCE_VERSION, "page": page}


def build(out: Path, scale_table: Path | None = None) -> dict:
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
    scales = load_scale(set(sprites), scale_table)
    groups = MP.group_order(sorted(sprites))
    order = [sid for _, ids in groups for sid in ids]
    names_of = {s: MA.frames_for("cast" in sprites[s][1], "attack_raise" in sprites[s][1]) for s in order}
    items = {sid: [n for n in names_of[sid] if n in sprites[sid][1]] for sid in order}
    sizes, placed = MP.pack_pages([[(sid, [sprites[sid][1][n].size for n in items[sid]]) for sid in ids]
                                   for _, ids in groups])
    for w, h in sizes:
        page = C.page_size(w, h)
        if page:
            raise SystemExit(f"monsters_ai: {page[0]}")
    atlases = [Image.new("RGBA", (w, h), (0, 0, 0, 0)) for w, h in sizes]
    rects: dict[str, dict[str, list[int]]] = {s: {} for s in order}
    for sid in order:
        pg, pos = placed[sid]
        for n, (x, y) in zip(items[sid], pos):
            atlases[pg].paste(sprites[sid][1][n], (x, y))
            rects[sid][n] = [x, y]
    arrs = [np.asarray(a) for a in atlases]
    sheets, ranged = {}, ranged_sheets()
    for sid in sorted(order):                        # JSON key order stays sorted by id (as at R0)
        meta, frames, holds, anim, L = sprites[sid]
        names = names_of[sid]
        pg = placed[sid][0]
        fr = {n: rects[sid][MA.resolve(n, rects[sid])] for n in names}
        cw, ch = frames["idle"].size
        for n in names:
            img = frames[MA.resolve(n, frames)]
            bad = C.atlas_exact(arrs[pg], (fr[n][0], fr[n][1], cw, ch), np.asarray(img))
            if bad:
                raise SystemExit(f"monsters_ai: {sid} {n}: {bad[0]}")
        sheets[sid] = sheet_meta(meta, frames, names, fr, holds, anim, L, pg, sid in ranged)
        if sid in scales:                            # FW-S: the sheet's own display scale (BattleArt: entry.scale ?? scale)
            sheets[sid]["scale"] = scales[sid]
    out.mkdir(parents=True, exist_ok=True)
    files = [page_file(i) for i in range(len(atlases))]
    for stale in sorted(out.glob("monsters-ai*.png")):   # the R0 single page and pages past the last one
        if stale.name not in files:
            stale.unlink()
    for a, f in zip(atlases, files):
        a.save(out / f)
    meta_json = {"scale": SCALE, "texScale": TEX_SCALE,
                 "pages": [{"file": f, "w": w, "h": h} for f, (w, h) in zip(files, sizes)], "sheets": sheets}
    (out / "monsters-ai.json").write_text(json.dumps(meta_json, indent=2) + "\n")
    print(f"monsters_ai: {len(sheets)} sheets on {len(files)} page(s) "
          f"{', '.join(f'{w}x{h}' for w, h in sizes)} native (texScale {TEX_SCALE}, max {C.MAX_PAGE}); "
          f"animated {[s for s in sorted(order) if sheets[s]['anim']]}")
    return meta_json


def page_file(i: int) -> str:
    """The PNG of atlas page i, next to monsters-ai.json."""
    return f"monsters-ai-{i}.png"

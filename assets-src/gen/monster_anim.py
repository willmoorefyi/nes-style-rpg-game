"""Monster battle in-betweens from approved pixels (docs/ENEMY_ANIM_PLAN.md): recipes, generation, checks, locks.

  python3 -I assets-src/gen/monster_anim.py check [ids ...|--all] [--calibrate]   # 5.1 checks + lock files
  python3 -I assets-src/gen/monster_anim.py review [ids ...]                      # gen/out/anim/review/monsters/
  python3 -I assets-src/gen/monster_anim.py mark <id>                             # zoomed keyframes, joints, parts
  python3 -I assets-src/gen/monster_anim.py lock <id>                             # write anim/monsters/<id>.lock.json

A sprite without a rig file (anim/monsters/<sprite>.yaml) gets no generated frames: the atlas aliases each generated
name to its source keyframe (anim: false). Used by monster_atlas.py (build stage monsters_ai).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent
APPROVED = HERE / "approved"
RIGS = HERE / "anim" / "monsters"
if str(HERE.parent) not in sys.path:                      # run as a script: make the `gen` package importable
    sys.path.insert(0, str(HERE.parent))
from gen.monster_recipes import (ARM, BOSS_FRAMES, FALLBACK, FRAME_SOURCE, HEAD, IDLE_B, KEYFRAMES,  # noqa: E402,F401
                                 MONSTER_FRAMES, NEEDS, RAISE_FRAMES, RECIPES, SEQUENCES, SPAN, frames_for,
                                 generated_names, head_joints, held, resolve, span_of)


def recipe_u(name: str, rig_cfg: dict | None = None) -> float:
    """Signed fraction of the way from the pixel source toward `toward` (the 35% rule is |u| <= 0.35)."""
    r = RECIPES.get(name, IDLE_B)
    t = float(((rig_cfg or {}).get("frames") or {}).get(name, {}).get("t", r["t"]))
    return -(t - 1.0) if r.get("over") else t


# ───────── approved keyframes ─────────
def load_entries() -> list[tuple[str, dict, dict[str, Image.Image]]]:
    """Every approved monster sprite as (id, meta, {keyframe: image}); grid sheets first, then per-pose bosses."""
    entries = []
    for meta_path in sorted(APPROVED.glob("*/monster_*.json")):
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
        cw, ch = meta["grid"]
        frames = [sheet.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(3)]
        for i in meta.get("flip_frames", []):
            frames[i] = frames[i].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        entries.append((meta["character"], meta, dict(zip(meta["poses"], frames))))
    for idle_meta in sorted(APPROVED.glob("*/boss_idle.json")):
        if not all(idle_meta.with_name(f"boss_{p}.json").exists() for p in ("idle", "attack", "hurt")):
            print(f"monsters_ai: {idle_meta.parent.name} boss poses incomplete, skipped")
            continue
        poses = ["idle", "attack", "hurt"] + [p for p in ("cast", "attack_raise")      # optional boss keyframes
                                              if idle_meta.with_name(f"boss_{p}.json").exists()]
        metas, frames = [], {}
        for p in poses:
            path = idle_meta.with_name(f"boss_{p}.json")
            m = json.loads(path.read_text())
            f = Image.open(path.with_suffix(".png")).convert("RGBA")
            frames[p] = f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if 0 in m.get("flip_frames", []) else f
            metas.append(m)
        frames, meta = pad_keyframes(frames, {**metas[0], "poses": poses})
        entries.append((metas[0]["character"], meta, frames))
    return entries


def pad_keyframes(kfs: dict[str, Image.Image], meta: dict) -> tuple[dict[str, Image.Image], dict]:
    """Wide boss cells (ROSTER_LOG G2): one cell per sheet, the max of its keyframes. A per-pose boss cut centres each
    figure in its own cell (monster.py), so a narrower keyframe is padded centred horizontally (left pad floor) and at
    the top (the feet row moves down by the idle's top pad; bottom_row follows), never cropped. A uniform sheet comes
    back untouched (the same image objects), so every existing frame and lock is byte-identical."""
    w = max(im.size[0] for im in kfs.values())
    h = max(im.size[1] for im in kfs.values())
    if all(im.size == (w, h) for im in kfs.values()):
        return kfs, meta
    out = {}
    for k, im in kfs.items():
        if im.size == (w, h):
            out[k] = im
            continue
        c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        c.paste(im, ((w - im.size[0]) // 2, h - im.size[1]))
        out[k] = c
    return out, {**meta, "bottom_row": meta["bottom_row"] + h - kfs["idle"].size[1], "grid": [w, h]}


def lunge_px(idle: Image.Image) -> int:
    """D2: L = round(24 + 16 * clamp((w - 55) / 130, 0, 1)), w = opaque width of the idle keyframe (native px)."""
    xs = np.where((np.asarray(idle)[..., 3] > 0).any(0))[0]
    w = int(xs.max() - xs.min() + 1) if len(xs) else 0
    return int(math.floor(24 + 16 * min(1.0, max(0.0, (w - 55) / 130.0)) + 0.5))


def load_rig(sprite: str) -> dict | None:
    p = RIGS / f"{sprite}.yaml"
    return (yaml.safe_load(p.read_text()) or {}) if p.exists() else None


def lock_path(sprite: str) -> Path:
    return RIGS / f"{sprite}.lock.json"


# ───────── generation ─────────
def hands(v) -> list[str]:
    """An arm option (`attack_hand`, `cast_hand`, `half_hand`): one suffix or a list of them (FW-3, e.g. [n, n2, n3])."""
    return [v] if isinstance(v, str) else list(v or [])


def half_hands(name: str, cfg: dict) -> list[str]:
    """The `half_hand` arms of a frame (they move with half the recipe's t); frames.<f>.half overrides the list."""
    return hands(((cfg.get("frames") or {}).get(name) or {}).get("half", cfg.get("half_hand")))


def half_joints(rig, name: str, cfg: dict) -> set[str]:
    return {a.format(h=h) for h in half_hands(name, cfg) for a in ARM} | rig.half_default   # + FW-2 tentacles


def _joint_sets(rig, name: str, r: dict, cfg: dict) -> tuple[object, list[str]]:
    hs, cast_hs = hands(cfg.get("attack_hand", "n")), hands(cfg.get("cast_hand", "n"))
    cloth = list(dict.fromkeys(j for p in rig.parts.values() if p["kind"] == "cloth"
                               for c in (p["chain"].values() if isinstance(p.get("chain"), dict) else [p.get("chain", [])])
                               for j in c[1:]))
    arm = [a.format(h=h) for h in hs + half_hands(name, cfg) for a in ARM]
    if rig.moves:                                          # beast templates (rig_templates.py) name their own sets
        moves = {"all": "all", **{k: v + cloth for k, v in rig.moves.items()}}[r["moves"]]
    else:                                                  # biped, naga (+ its `extra` serpent / tail joints)
        ex = rig.extra
        moves = {"all": "all", "wind": ["crown", "neck", "chest", *arm, "tip", *cloth, *ex.get("wind", [])],
                 "follow": ["crown", "chest", *arm, "tip", *ex.get("follow", [])],
                 "cast": ["crown", "chest", *[a.format(h=s) for s in rig.arms for a in ARM], *cloth, *ex.get("cast", [])],
                 "release": ["crown", *[a.format(h=h) for h in cast_hs for a in ARM], *cloth,
                             *ex.get("release", [])]}[r["moves"]]
    planted = [rig.planted] if isinstance(rig.planted, str) else list(rig.planted)
    pins = {"legs": list(rig.legs), "feet": list(rig.feet), "planted": planted}[r["pins"]]
    over = (cfg.get("frames") or {}).get(name, {})
    pins = list(over.get("pins", pins))
    return over.get("moves", moves), pins + [g for g in rig.ground if g not in pins]   # naga coil: pinned always


def _tweaks(recipe: dict | None, rig: dict | None, head: tuple[str, ...]) -> dict[str, list[float]]:
    """The recipe's shared tweaks, then the rig's frames.<f>.tweaks added per joint. In the recipe `head` stands for
    the body template's head joints (monster_recipes.HEAD); a rig's tweaks name real joints (a beast's `head`)."""
    out: dict[str, list[float]] = {}
    for src, symbolic in ((recipe or {}, True), (rig or {}, False)):
        for j, (dx, dy) in src.items():
            for k in (head if symbolic and j == HEAD else (j,)):
                out[k] = [out.get(k, [0, 0])[0] + dx, out.get(k, [0, 0])[1] + dy]
    return out


def sink(im: Image.Image, dy: int) -> np.ndarray:
    """The whole sprite dy px down (FW-1: a floating idle_b has no breath cut; the cell's bottom rows are empty)."""
    a = np.asarray(im.convert("RGBA"))
    out = np.zeros_like(a)
    out[dy:] = a[:a.shape[0] - dy]
    return out


def generate(sprite: str, cfg: dict, keyframes: dict[str, Image.Image], meta: dict) -> dict[str, dict]:
    """Every generated frame of a rigged sprite: {name: {img, labels, parts, u, src, toward, joints, rots, pinned,
    prop_px, ..., fx, grips, names (check-only, monster_render.check_info)}}. Held frames are skipped (the atlas
    aliases them to their source keyframe). Parts are drawn by monster_render.render_part (F2 scale, frame sampler)."""
    from gen import anim_feet as AF, puppet as PU
    from gen import rig as R
    from gen import monster_render as MR
    from gen import rig_render as RR
    cell = keyframes["idle"].size
    rig = R.Rig(cfg, cell)
    size = (cell[1], cell[0])
    arrs = {k: np.asarray(v.convert("RGBA")).copy() for k, v in keyframes.items()}
    segs = {k: R.segment(rig, k, arrs[k]) for k in arrs if k in rig.keyframes}
    holds, pairs = held(cfg.get("holds")), rig.joined_pairs()
    gaps = {k: RR.source_gaps(s[0], pairs) for k, s in segs.items()}     # the approved art's own part gaps
    foot_parts = {ft: [i for i, p in enumerate(rig.parts) if any(ft in rig.joints_of(p, k) for k in rig.keyframes)]
                  for ft in rig.feet}
    has_cast, has_raise = "cast" in keyframes, "attack_raise" in keyframes
    if has_raise and "attack_raise" not in rig.keyframes:
        raise ValueError(f"rig {sprite}: the approved attack_raise keyframe has no keyframes.attack_raise joints")
    head = head_joints(rig.head, rig.body, sprite, rig.keyframes["idle"])
    floating = bool(meta.get("floating")) or rig.floating   # FW-1: a floating sheet or body has no ground
    out: dict[str, dict] = {}
    tweaked = cfg.get("breath", True) and MR.idle_b_tweaks(rig, cfg) is not None   # FW-6: idle_b as a rig frame
    bobbed = [n for n, r in RECIPES.items() if r.get("bob") and n in generated_names(has_cast, has_raise)
              and ((cfg.get("frames") or {}).get(n) or {}).get("bob", True)]
    for name in (["idle_b"] if cfg.get("breath", True) else []) + bobbed:   # 1 px down above the breath joint's row
        src = RECIPES[name]["src"] if name in RECIPES else "idle"
        if name in holds or (name == "idle_b" and tweaked):
            continue
        img = sink(keyframes[src], 1) if floating else MR.breath(rig, arrs[src], None, False)[0] \
            if name == "idle_b" and rig.idle_b == "sag" else \
            np.asarray(PU.bob(keyframes[src], int(round(rig.keyframes[src][rig.breath][1])), 1)).copy()
        out[name] = {"img": img, "labels": None, "src": src, "toward": src, "u": 0.0, "joints": {}, "rots": {},
                     "pinned": True, "prop_px": {}, "dy": 1, "floating": floating}
    for name in generated_names(has_cast, has_raise):
        if name in out or name in holds or (name == "idle_b" and not tweaked):
            continue
        r, over = {**RECIPES.get(name, IDLE_B), **rig.recipes.get(name, {})}, (cfg.get("frames") or {}).get(name, {})
        u = recipe_u(name, cfg)
        S = rig.keyframes[r["src"]]
        T = out[r["toward"]]["joints"] if r["toward"] in out else rig.keyframes[r["toward"]]
        moves, pins = _joint_sets(rig, name, r, cfg)
        k = max(1, int(cell[1] / 80 + 0.5)) if r.get("cell_scale") else 1    # daze: px per 80 px of cell
        tweaks = _tweaks({j: [v[0] * k, v[1] * k] for j, v in (r.get("tweaks") or {}).items()}, over.get("tweaks"), head)
        for h in (hands(cfg.get("cast_hand", "n")) if r.get("raise") else []):
            hand = f"hand_{h}"
            tweaks[hand] = [tweaks.get(hand, [0, 0])[0], tweaks.get(hand, [0, 0])[1] - r["raise"]]
        dy, dx = int(over.get("dy", r.get("dy", 0) * k)), int(over.get("dx", r.get("dx", 0)))
        J = R.solve(rig, S, T, u, moves, pins, dy, tweaks, not floating, half_joints(rig, name, cfg), dx)
        layers, rots, prop_px = [], {}, {}
        lab, names = segs[r["src"]]
        drop = set(over.get("drop") or [])
        z = rig.z_for(r["src"])
        carried = [p for p, d in rig.parts.items() if r.get("carry") and d["kind"] == "prop" and d.get("carry_to")]
        z = [p for p in carried if rig.parts[p].get("carry_mode") == "behind"] + [p for p in z if p not in carried] + \
            [p for p in carried if rig.parts[p].get("carry_mode") != "behind"]
        scales, sampler = MR.frame_options(rig, name, over)
        for part in z:
            src_kf = "idle" if part in carried else r["src"]
            if part in drop or not rig.present(part, src_kf):
                continue
            plab, pnames = segs[src_kf]
            mask = plab == pnames.index(part)
            if not mask.any():
                continue
            rgba, hit, emp, rots[part] = MR.render_part(rig, part, src_kf, arrs[src_kf], mask, J, size, gaps[src_kf],
                                                        part in carried, scales.get(part, 1.0), sampler)
            layers.append((list(rig.parts).index(part), rgba, hit, emp))
        img, labels = RR.composite(layers, size, pairs)
        img, labels, squashed = MR.post_squash(rig, name, r, over, img, labels, J, arrs[r["src"]],
                                               out[r["toward"]]["img"] if r["toward"] in out else arrs[r["toward"]], u)
        if name == "idle_b":
            img, labels = MR.breath(rig, img, labels, floating)
            dy = 1
        for patch in cfg.get("paint") or []:
            if patch["frame"] == name:
                for x, y in patch["xy"]:
                    img[y, x] = (*patch["rgb"], 255) if patch.get("rgb") is not None else 0
        for p in rig.parts:
            if rig.parts[p]["kind"] == "prop":
                prop_px[p] = int((labels == list(rig.parts).index(p)).sum())
        pinned = r["pins"] in ("legs", "feet")
        out[name] = {"img": img, "labels": labels, "src": r["src"], "toward": r["toward"], "u": u, "joints": J,
                     "rots": rots, "pinned": pinned, "prop_px": prop_px, "dy": dy, "dx": dx, "floating": floating,
                     "squash": squashed,
                     "contact": AF.contact_mask(rig, r["src"], segs[r["src"]], pins, meta["bottom_row"]) if pinned
                     and set(rig.feet) - set(pins) else None,
                     "src_labels": lab, "foot_parts": foot_parts,
                     "toward_labels": out[r["toward"]]["labels"] if r["toward"] in out else segs.get(r["toward"], (None,))[0],
                     "carried": carried, "pairs": pairs, "seam_tolerance": int(cfg.get("seam_tolerance", 0)),
                     **MR.check_info(rig, r["src"], carried)}
    return out


def monster_frames(sprite: str, keyframes: dict[str, Image.Image] | None = None, meta: dict | None = None) -> dict[str, Image.Image]:
    """{name: image} for the build; {} for a sprite without a rig file."""
    cfg = load_rig(sprite)
    if not cfg:
        return {}
    if keyframes is None or meta is None:
        sid, meta, keyframes = next(e for e in load_entries() if e[0] == sprite)
    return {n: Image.fromarray(f["img"], "RGBA") for n, f in generate(sprite, cfg, keyframes, meta).items()}


if __name__ == "__main__":
    from gen import monster_review as MR
    sys.exit(MR.main(sys.argv[1:]))

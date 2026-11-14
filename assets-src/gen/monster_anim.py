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
KEYFRAMES = ("idle", "attack", "hurt", "cast")
MONSTER_FRAMES = ["idle", "idle_b", "atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover",
                  "hurt_in1", "hurt_in2", "hurt"]
BOSS_FRAMES = MONSTER_FRAMES + ["cast_gather", "cast_rise", "cast", "cast_release"]
FRAME_SOURCE = {"idle_b": "idle", "atk_wind1": "idle", "atk_wind2": "idle", "atk_mid": "attack", "atk_follow": "attack",
                "atk_recover": "idle", "hurt_in1": "idle", "hurt_in2": "hurt", "cast_gather": "idle", "cast_rise": "cast",
                "cast_release": "cast"}
SEQUENCES = {"attack": ["idle", "atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover", "idle"],
             "hurt": ["idle", "hurt_in1", "hurt_in2", "hurt"],
             "cast": ["idle", "cast_gather", "cast_rise", "cast", "cast_release"]}
SPAN = {"attack": ("idle", "attack"), "hurt": ("idle", "hurt"), "cast": ("idle", "cast")}
ARM = ("sh_{h}", "el_{h}", "hand_{h}")
# frame -> pixel source, toward, t (table 3.1 terms; `over` = overshoot of toward->src), moves, pins, body_dy
RECIPES = {
    "atk_wind1": {"src": "idle", "toward": "attack", "t": -0.20, "moves": "wind", "pins": "legs", "dy": 1},
    "atk_wind2": {"src": "idle", "toward": "attack", "t": -0.35, "moves": "wind", "pins": "legs", "dy": 2},
    "atk_mid": {"src": "attack", "toward": "atk_wind2", "t": 0.35, "moves": "all", "pins": "planted"},
    "atk_follow": {"src": "attack", "toward": "idle", "t": 1.10, "over": True, "moves": "follow", "pins": "feet"},
    "atk_recover": {"src": "idle", "toward": "attack", "t": 0.30, "moves": "follow", "pins": "legs"},
    "hurt_in1": {"src": "idle", "toward": "hurt", "t": 0.35, "moves": "all", "pins": "feet"},
    "hurt_in2": {"src": "hurt", "toward": "idle", "t": 0.35, "moves": "all", "pins": "feet", "carry": True},
    "cast_gather": {"src": "idle", "toward": "cast", "t": 0.25, "moves": "cast", "pins": "feet", "dy": 1},
    "cast_rise": {"src": "cast", "toward": "idle", "t": 0.35, "moves": "cast", "pins": "feet"},
    "cast_release": {"src": "cast", "toward": "idle", "t": 1.10, "over": True, "moves": "release", "pins": "feet",
                     "raise": 2},
}


def recipe_u(name: str, rig_cfg: dict | None = None) -> float:
    """Signed fraction of the way from the pixel source toward `toward` (the 35% rule is |u| <= 0.35)."""
    r = RECIPES[name]
    t = float(((rig_cfg or {}).get("frames") or {}).get(name, {}).get("t", r["t"]))
    return -(t - 1.0) if r.get("over") else t


def frames_for(has_cast: bool) -> list[str]:
    return BOSS_FRAMES if has_cast else MONSTER_FRAMES


def generated_names(has_cast: bool) -> list[str]:
    return [f for f in frames_for(has_cast) if f not in KEYFRAMES]


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
        poses = ["idle", "attack", "hurt"] + (["cast"] if idle_meta.with_name("boss_cast.json").exists() else [])
        metas, frames = [], {}
        for p in poses:
            path = idle_meta.with_name(f"boss_{p}.json")
            m = json.loads(path.read_text())
            f = Image.open(path.with_suffix(".png")).convert("RGBA")
            frames[p] = f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if 0 in m.get("flip_frames", []) else f
            metas.append(m)
        entries.append((metas[0]["character"], {**metas[0], "poses": poses}, frames))
    return entries


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
def _joint_sets(rig, name: str, r: dict, cfg: dict) -> tuple[object, list[str]]:
    h = cfg.get("attack_hand", "n")
    cast_h = cfg.get("cast_hand", "n")
    cloth = list(dict.fromkeys(j for p in rig.parts.values() if p["kind"] == "cloth"
                               for c in (p["chain"].values() if isinstance(p.get("chain"), dict) else [p.get("chain", [])])
                               for j in c[1:]))
    arm = [a.format(h=h) for a in ARM]
    if rig.moves:                                          # beast templates (rig_templates.py) name their own sets
        moves = {"all": "all", **{k: v + cloth for k, v in rig.moves.items()}}[r["moves"]]
    else:
        moves = {"all": "all", "wind": ["crown", "neck", "chest", *arm, "tip", *cloth],
                 "follow": ["crown", "chest", *arm, "tip"], "cast": ["crown", "chest", *[a.format(h=s) for s in "nf" for a in ARM], *cloth],
                 "release": ["crown", *[a.format(h=cast_h) for a in ARM], *cloth]}[r["moves"]]
    planted = [rig.planted] if isinstance(rig.planted, str) else list(rig.planted)
    pins = {"legs": list(rig.legs), "feet": list(rig.feet), "planted": planted}[r["pins"]]
    over = (cfg.get("frames") or {}).get(name, {})
    return over.get("moves", moves), list(over.get("pins", pins))


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
    holds, pairs = {h["frame"] for h in cfg.get("holds") or []}, rig.joined_pairs()
    gaps = {k: RR.source_gaps(s[0], pairs) for k, s in segs.items()}     # the approved art's own part gaps
    foot_parts = {ft: [i for i, p in enumerate(rig.parts) if any(ft in rig.joints_of(p, k) for k in rig.keyframes)]
                  for ft in rig.feet}
    has_cast = "cast" in keyframes
    out: dict[str, dict] = {}
    if cfg.get("breath", True) and "idle_b" not in holds:
        idle = keyframes["idle"]
        img = np.asarray(PU.bob(idle, cell[1], 1) if meta.get("floating") else
                         PU.bob(idle, int(round(rig.keyframes["idle"][rig.breath][1])), 1)).copy()
        out["idle_b"] = {"img": img, "labels": None, "src": "idle", "toward": "idle", "u": 0.0, "joints": {}, "rots": {},
                         "pinned": True, "prop_px": {}}
    for name in generated_names(has_cast):
        if name == "idle_b" or name in holds:
            continue
        r, over = RECIPES[name], (cfg.get("frames") or {}).get(name, {})
        u = recipe_u(name, cfg)
        S = rig.keyframes[r["src"]]
        T = out[r["toward"]]["joints"] if r["toward"] in out else rig.keyframes[r["toward"]]
        moves, pins = _joint_sets(rig, name, r, cfg)
        tweaks = dict(over.get("tweaks") or {})
        if r.get("raise"):
            hand = f"hand_{cfg.get('cast_hand', 'n')}"
            tweaks[hand] = [tweaks.get(hand, [0, 0])[0], tweaks.get(hand, [0, 0])[1] - r["raise"]]
        J = R.solve(rig, S, T, u, moves, pins, int(over.get("dy", r.get("dy", 0))), tweaks, not meta.get("floating"))
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
        for patch in cfg.get("paint") or []:
            if patch["frame"] == name:
                for x, y in patch["xy"]:
                    img[y, x] = (*patch["rgb"], 255) if patch.get("rgb") is not None else 0
        for p in rig.parts:
            if rig.parts[p]["kind"] == "prop":
                prop_px[p] = int((labels == list(rig.parts).index(p)).sum())
        pinned = r["pins"] in ("legs", "feet")
        out[name] = {"img": img, "labels": labels, "src": r["src"], "toward": r["toward"], "u": u, "joints": J,
                     "rots": rots, "pinned": pinned, "prop_px": prop_px,
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
    sys.path.insert(0, str(HERE.parent))
    from gen import monster_review as MR
    sys.exit(MR.main(sys.argv[1:]))

"""Cut-out puppet in-betweens built from a character's approved pixels (no AI).

Battle: each approved keyframe (ready, attack, cast) carries hand-marked joints in assets-src/gen/anim/<id>.yaml
(native px, figure faces left). Its pixels are split into parts by nearest bone; an in-between re-poses every part
rigidly (rotate about the proximal joint, keep the bone length) and composites the parts back to front, then patches
the outline only where a seam left an edge without ink. Walk: small edits on the approved field rows (1 px body bob,
a lifted passing foot) for every field sprite, with optional per-character overrides in the same file.

  python3 -I assets-src/gen/puppet.py review [id ...]    # contact sheets + GIFs + checks -> gen/out/anim/review/

Joint labels: n / f = near / far limb on an unmirrored keyframe (n is also the screen-left one on every approved key).
A keyframe turned by a battle.json `facing_fix` figure mirror (docs/HERO_FACING_PLAN.md, puppet_facing.py) keeps its
joints on the approved PNG in the yaml; load_cfg mirrors them and swaps n / f so the labels follow the screen side
(n = screen-left), and the in-betweens cut from it draw with n and f exchanged in the z order.

Used by build_assets.py (battle_ai, field_ai), so the atlases always carry the frames.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent
APPROVED = HERE / "approved"
ANIM = HERE / "anim"
OUTLINE = (6, 4, 10)
KEYFRAMES = ["ready", "attack", "cast"]
BATTLE_POSES = ["ready", "attack", "cast", "hurt", "down", "victory"]
JOINTS = ["neck", "crown", "chest", "hip", "sh_n", "el_n", "hand_n", "sh_f", "el_f", "hand_f",
          "hip_n", "knee_n", "foot_n", "hip_f", "knee_f", "foot_f"]
UPPER = ("neck", "crown", "chest", "hip", "sh_n", "el_n", "hand_n", "sh_f", "el_f", "hand_f", "hip_n", "hip_f", "tip",
         "tip_f")

# part -> (bone start, bone end, reach radius used for segmentation); the weapon bone starts at its holding hand
PARTS = {
    "head": ("neck", "crown", 11.0), "torso": ("chest", "hip", 9.0),
    "uarm_n": ("sh_n", "el_n", 3.5), "farm_n": ("el_n", "hand_n", 4.5),
    "uarm_f": ("sh_f", "el_f", 3.5), "farm_f": ("el_f", "hand_f", 4.5),
    "thigh_n": ("hip_n", "knee_n", 4.0), "shin_n": ("knee_n", "foot_n", 4.5),
    "thigh_f": ("hip_f", "knee_f", 4.0), "shin_f": ("knee_f", "foot_f", 4.5),
    "weapon": ("hand_n", "tip", 2.0),
    # pass CB (docs/CLASS_BARBARIAN_PLAN.md 5): an optional second weapon in the far hand (the barbarian's other axe);
    # a keyframe without `tip_f` never segments or draws it, so every other class is unchanged
    "weapon_f": ("hand_f", "tip_f", 2.0),
}
LEGS = ("thigh_n", "shin_n", "thigh_f", "shin_f")
Z_BACK_ARM = ["uarm_f", "farm_f", "weapon_f", "thigh_f", "shin_f", "torso", "thigh_n", "shin_n", "head", "uarm_n", "farm_n", "weapon"]
Z_FRONT_ARM = ["thigh_f", "shin_f", "uarm_f", "torso", "farm_f", "weapon_f", "thigh_n", "shin_n", "head", "uarm_n", "farm_n", "weapon"]

# battle in-betweens, in atlas order, with the keyframe they are cut from
INBETWEENS = ["idle_b", "atk_wind1", "atk_wind2", "atk_mid", "atk_follow", "cast_gather", "cast_rise", "cast_release"]
SOURCE = {"idle_b": "ready", "atk_wind1": "ready", "atk_wind2": "ready", "atk_mid": "attack", "atk_follow": "attack",
          "cast_gather": "ready", "cast_rise": "cast", "cast_release": "cast"}
ATTACK_SEQ = ["ready", "atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow"]
CAST_SEQ = ["ready", "cast_gather", "cast_rise", "cast", "cast_release", "cast"]


# ───────── config & keyframes ─────────
def load_cfg(cid: str) -> dict | None:
    p = ANIM / f"{cid}.yaml"
    if not p.exists():
        return None
    cfg = yaml.safe_load(p.read_text()) or {}
    for k in KEYFRAMES:
        kf = (cfg.get("battle") or {}).get(k)
        if kf:
            for j in [*JOINTS, "tip", "tip_f"]:
                if j in kf and kf[j] is not None:
                    kf[j] = tuple(float(v) for v in kf[j])
    bad = sorted(set(cfg.get("alias_frames") or []) - set(INBETWEENS))
    if bad:                                           # pass CB 5: in-betweens left aliased to their source keyframe
        raise ValueError(f"{cid}: alias_frames {bad} are not in-between names ({', '.join(INBETWEENS)})")
    cfg = _mirror_keyframes(cid, cfg)
    if any("tip_f" in ((cfg.get("battle") or {}).get(k) or {}) for k in cfg.get("mirrored", ())):
        raise ValueError(f"{cid}: tip_f on a facing_fix-mirrored keyframe (the n / f relabelling does not know it)")
    return cfg


def _mirror_keyframes(cid: str, cfg: dict) -> dict:
    """Joints of the keyframes a battle.json `facing_fix` figure mirror turns: x' = sum - x with the approved cell's
    `figure_sum` (the same S as the pixels), n / f swapped (also `cast_hand` for a mirrored cast); cfg['mirrored']
    lists them for the draw order."""
    from gen import puppet_facing as PF
    meta_p = APPROVED / cid / "battle.json"
    if not meta_p.exists() or not cfg.get("battle"):
        return cfg
    meta = json.loads(meta_p.read_text())
    poses = [f["pose"] for f in PF.entries(meta) if f["mirror"] == "figure" and f["pose"] in KEYFRAMES]
    if not poses:
        return cfg
    raw = battle_sheet_frames(cid, facing=False)
    for p in poses:
        if cfg["battle"].get(p):
            cfg["battle"][p] = PF.mirror_joints(cfg["battle"][p], PF.figure_sum(np.asarray(raw[p])))
    if "cast" in poses and cfg.get("cast_hand") in ("n", "f"):
        cfg["cast_hand"] = PF.swap_side(f"x_{cfg['cast_hand']}")[-1]
    cfg["mirrored"] = poses
    return cfg


def apply_face_fix(sheet: Image.Image, meta: dict, gw: int, gh: int, cols: int, poses: list) -> Image.Image:
    """Review fix applied at build time (an approved sheet may be a style reference and must stay byte-identical):
    recolour `from` colours inside `box` of one pose, plus single `extra` pixels, to `to`."""
    fixes = meta.get("face_fix")
    if not fixes:
        return sheet
    a = np.asarray(sheet.convert("RGBA")).copy()
    for fix in fixes if isinstance(fixes, list) else [fixes]:
        i = poses.index(fix["pose"])
        ox, oy = (i % cols) * gw, (i // cols) * gh
        x0, y0, x1, y1 = fix["box"]
        sub = a[oy + y0:oy + y1, ox + x0:ox + x1]
        for c in fix["from"]:
            sub[(sub[..., :3] == c).all(-1) & (sub[..., 3] > 0), :3] = fix["to"]
        for x, y in fix.get("extra", []):
            a[oy + y, ox + x, :3] = fix["to"]
    return Image.fromarray(a, "RGBA")


def _cells(sheet: Image.Image, meta: dict) -> dict[str, Image.Image]:
    gw, gh = meta["grid"]
    cols = meta["layout"][0]
    return {p: sheet.crop(((i % cols) * gw, (i // cols) * gh, (i % cols + 1) * gw, (i // cols + 1) * gh))
            for i, p in enumerate(meta["poses"])}


def apply_review_fixes(sheet: Image.Image, meta: dict) -> tuple[dict[str, Image.Image], dict[str, np.ndarray]]:
    """The cells of an approved battle sheet with `face_fix` then `facing_fix` (puppet_facing.py) applied, and the
    reflected head masks {pose: bool[h, w]} of its head mirrors."""
    from gen import puppet_facing as PF
    gw, gh = meta["grid"]
    sheet = apply_face_fix(sheet.convert("RGBA"), meta, gw, gh, meta["layout"][0], meta["poses"])
    cells, masks = PF.apply({p: np.asarray(c).copy() for p, c in _cells(sheet, meta).items()}, meta)
    return {p: Image.fromarray(a) for p, a in cells.items()}, masks


def battle_sheet_frames(cid: str, facing: bool = True) -> dict[str, Image.Image]:
    """The six approved battle poses of `cid`, review fixes applied (`facing=False`: `face_fix` only)."""
    meta = json.loads((APPROVED / cid / "battle.json").read_text())
    sheet = Image.open(APPROVED / cid / "battle.png").convert("RGBA")
    if facing:
        return apply_review_fixes(sheet, meta)[0]
    gw, gh = meta["grid"]
    return _cells(apply_face_fix(sheet, meta, gw, gh, meta["layout"][0], meta["poses"]), meta)


def facing_masks(cid: str) -> dict[str, np.ndarray]:
    """{source pose: reflected head mask} of the `facing_fix` head mirrors of `cid` (ready / attack)."""
    meta = json.loads((APPROVED / cid / "battle.json").read_text())
    return apply_review_fixes(Image.open(APPROVED / cid / "battle.png"), meta)[1]


# ───────── segmentation & rendering ─────────
def _seg_dist(px: np.ndarray, a, b) -> np.ndarray:
    a, b = np.asarray(a, float), np.asarray(b, float)
    ab = b - a
    t = np.clip(np.einsum('ij,j->i', px - a, ab) / max(float(ab[0] ** 2 + ab[1] ** 2), 1e-6), 0, 1)
    return np.linalg.norm(px - (a + t[:, None] * ab), axis=1)


def _bone(part: str, joints: dict) -> tuple[str, str]:
    j0, j1, _ = PARTS[part]
    if part == "weapon":
        j0 = f"hand_{joints.get('weapon_hand', 'n')}"
    return j0, j1


def segment(frame: Image.Image, joints: dict, robed: bool = False, head: np.ndarray | None = None) -> np.ndarray:
    """Label every opaque pixel with the index (into PARTS) of its nearest bone; -1 = transparent. `head`: a
    facing_fix head mirror's reflected mask, every pixel of which belongs to the head (its bandana tails included)."""
    a = np.asarray(frame)
    h, w = a.shape[:2]
    ys, xs = np.nonzero(a[..., 3] > 0)
    px = np.stack([xs, ys], 1).astype(float)
    names = list(PARTS)
    d = np.full((len(px), len(names)), np.inf)
    for i, n in enumerate(names):
        if robed and n in LEGS:
            continue
        j0, j1 = _bone(n, joints)
        if j0 in joints and j1 in joints:
            d[:, i] = _seg_dist(px, joints[j0], joints[j1]) / PARTS[n][2]
    lab = np.full((h, w), -1, np.int32)
    lab[ys, xs] = d.argmin(1)
    # cape / cloth behind the body belongs to the torso, never to a limb that will be rotated
    for rule in joints.get("torso_colors", []):
        lab[(a[..., :3] == rule).all(-1) & (a[..., 3] > 0)] = names.index("torso")
    if joints.get("cape_behind", True):
        rgb = a[..., :3].astype(int)
        cape = (a[..., 3] > 0) & (rgb[..., 2] > rgb[..., 0] + 30) & (np.arange(w)[None, :] > joints["hip"][0] + 5)
        lab[cape & (lab != names.index("weapon"))] = names.index("torso")
    if head is not None:
        lab[head & (a[..., 3] > 0)] = names.index("head")
    # pass CB: hand-marked boxes ([x0, y0, x1, y1), half-open) whose opaque px belong to one part (an axe head wider
    # than its bone's reach); only parts the keyframe has joints for
    for part, rects in (joints.get("part_boxes") or {}).items():
        if part not in PARTS:
            raise ValueError(f"part_boxes: unknown part {part!r}")
        for x0, y0, x1, y1 in rects:
            sub = lab[y0:y1, x0:x1]
            sub[sub >= 0] = names.index(part)
    return _absorb_orphans(lab)


def _absorb_orphans(lab: np.ndarray, keep: int = 6) -> np.ndarray:
    """Small islands of a part (stray outline bits next to another part) join the part that surrounds them."""
    from gen.pixelize import components
    out = lab.copy()
    for p in np.unique(lab[lab >= 0]):
        comps, n = components(lab == p)
        sizes = [(comps == i).sum() for i in range(1, n + 1)]
        big = int(np.argmax(sizes)) + 1 if sizes else 0
        for i in range(1, n + 1):
            if i == big or sizes[i - 1] >= keep:
                continue
            m = comps == i
            nb = lab[_grow(m) & ~m & (lab >= 0) & (lab != p)]
            if len(nb):
                out[m] = np.bincount(nb).argmax()
    return out


def _grow(m: np.ndarray) -> np.ndarray:
    g = m.copy()
    g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    return g


def _angle(a, b) -> float:
    return float(np.arctan2(b[1] - a[1], b[0] - a[0]))


def keep_lengths(target: dict, src_of, robed: bool) -> dict:
    """Rigid parts cannot stretch: walk each limb chain and keep every bone at its source length."""
    t = dict(target)
    wh = t.get("weapon_hand", "n")
    chains = [("sh_n", "el_n", "hand_n"), ("sh_f", "el_f", "hand_f")]
    if not robed:
        chains += [("hip_n", "knee_n", "foot_n"), ("hip_f", "knee_f", "foot_f")]
    for chain in chains:
        if "tip" in t and chain[-1] == f"hand_{wh}":
            chain = (*chain, "tip")
        elif "tip_f" in t and chain[-1] == "hand_f":     # pass CB: the far hand's own weapon
            chain = (*chain, "tip_f")
        for a, b in zip(chain, chain[1:]):
            sj = src_of(a, b)
            if a not in t or b not in t or a not in sj or b not in sj:
                break
            L = float(np.hypot(sj[b][0] - sj[a][0], sj[b][1] - sj[a][1]))
            dx, dy = t[b][0] - t[a][0], t[b][1] - t[a][1]
            dist = max(float(np.hypot(dx, dy)), 1e-6)
            t[b] = (t[a][0] + dx / dist * L, t[a][1] + dy / dist * L)
    return t


def outline(img: Image.Image) -> Image.Image:
    """Drop specks, then ink the edge only where a seam left a light pixel on the silhouette (the parts keep their
    own 1 px outline from the approved art; a fresh ring everywhere would double it)."""
    from gen.pixelize import components
    a = np.asarray(img).copy()
    solid = a[..., 3] > 0
    comps, n = components(solid)
    if n > 1:
        sizes = [(comps == i).sum() for i in range(1, n + 1)]
        keepm = np.isin(comps, [i + 1 for i, sz in enumerate(sizes) if sz >= 12])
        a[solid & ~keepm] = 0
        solid = keepm
    ring = _grow(solid) & ~solid
    light = solid & (a[..., :3].astype(int).max(axis=2) >= 60)
    ring &= _grow(light)
    a[ring, :3] = OUTLINE
    a[ring, 3] = 255
    return Image.fromarray(a, "RGBA")


def render(target: dict, sources: dict[str, tuple[Image.Image, dict]], part_src: dict[str, str], default: str,
           z: list[str], robed: bool, size=(80, 80), masks: dict | None = None, ink: bool = True) -> Image.Image:
    """Pose every part (taken from its source keyframe) onto the target joints and composite back to front.
    `masks`: {source pose: head mask} of facing_fix head mirrors (segment's `head`). `ink=False` (pass CL's hands
    layer, puppet_lance.py) skips the outline pass; `size` is the cell (width, height)."""
    names = list(PARTS)
    labels: dict[str, np.ndarray] = {}
    out = np.zeros((size[1], size[0], 4), np.uint8)
    gy, gx = np.mgrid[0:size[1], 0:size[0]]
    for part in z:
        if robed and part in LEGS:
            continue
        src = part_src.get(part, default)
        frame, sj = sources[src]
        j0, j1 = _bone(part, sj)
        tj0 = j0 if part != "weapon" else f"hand_{target.get('weapon_hand', sj.get('weapon_hand', 'n'))}"
        if j0 not in sj or j1 not in sj or tj0 not in target or j1 not in target:
            continue
        if src not in labels:
            labels[src] = segment(frame, sj, robed, (masks or {}).get(src))
        lab, arr = labels[src], np.asarray(frame)
        rot = _angle(target[tj0], target[j1]) - _angle(sj[j0], sj[j1])
        c, s = np.cos(-rot), np.sin(-rot)
        dx, dy = gx - target[tj0][0], gy - target[tj0][1]
        sx = np.rint(c * dx - s * dy + sj[j0][0]).astype(int)
        sy = np.rint(s * dx + c * dy + sj[j0][1]).astype(int)
        ok = (sx >= 0) & (sx < arr.shape[1]) & (sy >= 0) & (sy < arr.shape[0])
        hit = np.zeros_like(ok)
        hit[ok] = lab[sy[ok], sx[ok]] == names.index(part)
        out[hit] = arr[sy[hit], sx[hit]]
    return outline(Image.fromarray(out, "RGBA")) if ink else Image.fromarray(out, "RGBA")


# ───────── in-between targets (relative to each character's own keyframes) ─────────
def _add(p, d):
    return (p[0] + d[0], p[1] + d[1])


def _lerp(a: dict, b: dict, t: float) -> dict:
    out = dict(a)
    for k in JOINTS:
        if k in a and k in b:
            out[k] = (a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t)
    return out


def _moved(j: dict, dx: float, dy: float, keys=UPPER) -> dict:
    return {k: (_add(v, (dx, dy)) if k in keys and isinstance(v, tuple) else v) for k, v in j.items()}


def _weapon_dir(t: dict, src: dict, direction) -> dict:
    """Point the weapon (held in the moving hand) along `direction`; keep_lengths restores its length."""
    h = t[f"hand_{src.get('weapon_hand', 'n')}"]
    return {**t, "tip": _add(h, direction)}


def _carry_tip(t: dict, src: dict) -> dict:
    """A weapon nobody re-aims moves rigidly with its hand."""
    if "tip" not in src:
        return t
    wh = src.get("weapon_hand", "n")
    return {**t, "tip": _add(t[f"hand_{wh}"], (src["tip"][0] - src[f"hand_{wh}"][0], src["tip"][1] - src[f"hand_{wh}"][1])),
            "weapon_hand": wh}


def _far_tip(t: dict, src: dict) -> tuple[float, float]:
    """`tip_f` on target `t`: the source's hand_f -> tip_f vector, rotated by the far forearm's turn (el_f -> hand_f)."""
    rot = _angle(t["el_f"], t["hand_f"]) - _angle(src["el_f"], src["hand_f"])
    dx, dy = src["tip_f"][0] - src["hand_f"][0], src["tip_f"][1] - src["hand_f"][1]
    c, s = np.cos(rot), np.sin(rot)
    return (t["hand_f"][0] + c * dx - s * dy, t["hand_f"][1] + s * dx + c * dy)


def battle_targets(cfg: dict) -> dict[str, tuple[dict, dict[str, str]]]:
    """name -> (target joints, part sources). Offsets are the knight's, expressed relative to the character's joints;
    `tweaks` in the config add per-frame joint offsets (e.g. tweaks: {atk_wind1: {hand_n: [1, -2]}})."""
    b = cfg["battle"]
    R, A, C = b["ready"], b["attack"], b["cast"]
    h = cfg.get("attack_hand", A.get("weapon_hand", "n"))
    o = "f" if h == "n" else "n"
    cast_h = cfg.get("cast_hand") or max(("n", "f"), key=lambda s: R[f"hand_{s}"][1] - C[f"hand_{s}"][1])
    wsrc = "ready" if "tip" in R else "attack"         # which keyframe lends the weapon to the wind-up frames
    W = R if wsrc == "ready" else A
    lean = (1, 0)
    t: dict[str, tuple[dict, dict]] = {}

    t["idle_b"] = (_carry_tip(_moved(R, 0, 1), R), {})
    w1 = _moved(R, *lean, keys=("neck", "crown", "chest", f"sh_{o}", f"el_{o}", f"hand_{o}"))
    w1[f"el_{h}"] = _add(R[f"sh_{h}"], (4, 9))
    w1[f"hand_{h}"] = _add(w1[f"el_{h}"], (-5, 0))
    w1 = _carry_tip(w1, R) if wsrc == "ready" and W.get("weapon_hand", "n") != h else w1
    if W.get("weapon_hand", "n") == h:
        w1 = _weapon_dir({**w1, "weapon_hand": h}, W, (-19, -5))
    t["atk_wind1"] = (w1, {"weapon": wsrc})
    co = _moved(R, 2, 2)
    co[f"el_{h}"] = _add(co[f"sh_{h}"], (6, 9))
    co[f"hand_{h}"] = _add(co[f"el_{h}"], (-5, 1))
    if not cfg.get("robed"):
        co["knee_n"], co["knee_f"] = _add(R["knee_n"], (0, 2)), _add(R["knee_f"], (1, 2))
        co["foot_n"], co["foot_f"] = R["foot_n"], R["foot_f"]
    co = _carry_tip(co, R) if wsrc == "ready" and W.get("weapon_hand", "n") != h else co
    if W.get("weapon_hand", "n") == h:
        co = _weapon_dir({**co, "weapon_hand": h}, W, (-20, -3))
    t["atk_wind2"] = (co, {"weapon": wsrc})
    mid = _lerp(co, A, 0.55)
    t["atk_mid"] = (_carry_tip({**mid, "weapon_hand": A.get("weapon_hand", "n")}, A) if "tip" in A else mid, {})
    fo = _lerp(A, R, 0.25)
    fo[f"el_{h}"] = _add(A[f"el_{h}"], (1, 3))
    fo[f"hand_{h}"] = _add(A[f"hand_{h}"], (2, 6))
    if "tip" in A:
        fo = _weapon_dir({**fo, "weapon_hand": A.get("weapon_hand", "n")}, A, (-19, 5)) \
            if A.get("weapon_hand", "n") == h else _carry_tip(fo, A)
    t["atk_follow"] = (fo, {})

    ga = _moved(R, 0, 1)
    ch = ga["chest"]
    ga["hand_n"], ga["el_n"] = _add(ch, (-6, 7)), _add(R["el_n"], (1, 3))
    ga["hand_f"], ga["el_f"] = _add(ch, (1, 6)), _add(R["el_f"], (-2, 3))
    t["cast_gather"] = (_carry_tip(ga, R), {})
    t["cast_rise"] = (_carry_tip(_lerp(R, C, 0.5), C), {})
    re = _moved(C, -1, 0, keys=("neck", "crown"))
    re[f"el_{cast_h}"] = _add(C[f"el_{cast_h}"], (1, -3))
    re[f"hand_{cast_h}"] = _add(C[f"hand_{cast_h}"], (-1, -6))
    t["cast_release"] = (_carry_tip(re, C), {})

    tweaks = cfg.get("tweaks") or {}
    for name, offs in tweaks.items():
        tj = t[name][0]
        for j, d in offs.items():
            if j != "tip_f":
                tj[j] = _add(tj[j], d)
    for name, (tj, _) in t.items():                    # pass CB: the far weapon follows its (tweaked) forearm rigidly
        src = b[SOURCE[name]]
        if "tip_f" in src:
            tj["tip_f"] = _add(_far_tip(tj, src), (tweaks.get(name) or {}).get("tip_f", (0, 0)))
    return t


def is_lance(cid: str) -> bool:
    """Pass CL: the class's approved battle.json carries a lance prop (an oversize user sheet)."""
    p = APPROVED / cid / "battle.json"
    return p.exists() and (json.loads(p.read_text()).get("prop") or {}).get("kind") == "lance"


def battle_inbetweens(cid: str, cfg: dict | None = None) -> dict[str, Image.Image]:
    """The eight in-between frames of `cid` (empty dict when it has no joint file)."""
    cfg = cfg or load_cfg(cid)
    if not cfg or "battle" not in cfg:
        return {}
    if is_lance(cid):                                 # pass CL (docs/CLASS_LANCE_PLAN.md 5): the rigid lance prop
        from gen import puppet_lance as PL
        return PL.inbetweens(cid, cfg)
    from gen.puppet_facing import swap_z
    frames = battle_sheet_frames(cid)
    masks = facing_masks(cid)
    b = cfg["battle"]
    robed = bool(cfg.get("robed"))
    sources = {k: (frames[k], b[k]) for k in KEYFRAMES}
    out = {}
    for name, (tj, ps) in battle_targets(cfg).items():
        src = SOURCE[name]

        def src_of(a, bb, _ps=ps, _src=src):
            part = next((p for p in PARTS if _bone(p, b[_ps.get(p, _src)]) == (a, bb)), None)
            return b[_ps.get(part, _src)] if part else b[_src]
        tj = keep_lengths(tj, src_of, robed)
        front = (cfg.get("front_far_arm") or {}).get(src, src != "attack")
        z = Z_FRONT_ARM if front else Z_BACK_ARM
        out[name] = render(tj, sources, ps, src, swap_z(z) if src in cfg.get("mirrored", ()) else z, robed,
                           masks=masks)
    for name in cfg.get("alias_frames") or []:        # pass CB 5: the build falls back to the source keyframe
        out.pop(name, None)
    return out


# ───────── walk (processed field rows: down, up, left-facing side) ─────────
WALK_COLS = ["stand", "contact_l", "down_l", "pass_l", "contact_r", "down_r", "pass_r"]
WALK_SEQUENCE = [1, 2, 3, 4, 5, 6]
WALK_PHASES = 3


def bob(frame: Image.Image, cut: int, dy: int) -> Image.Image:
    """Move everything above row `cut` by dy (+ = down). Moving up repeats the row at the cut to close the gap."""
    a = np.asarray(frame).copy()
    upper = a[:cut].copy()
    out = a.copy()
    out[:cut] = 0
    if dy > 0:
        out[dy:cut + dy] = np.where(upper[..., 3:] > 0, upper, out[dy:cut + dy])
    else:
        out[:cut + dy] = upper[-dy:]
        out[cut + dy:cut] = np.where(a[cut + dy:cut, ..., 3:] > 0, a[cut + dy:cut], upper[-1:])
    return Image.fromarray(out, "RGBA")


def move_box(frame: Image.Image, src: Image.Image, box, dx: int, dy: int, behind: bool, erase: bool) -> Image.Image:
    a = np.asarray(frame).copy()
    s = np.asarray(src)
    x0, y0, x1, y1 = box
    patch = s[y0:y1, x0:x1].copy()
    if erase:
        a[y0:y1, x0:x1][patch[..., 3] > 0] = 0
    ty0, tx0 = y0 + dy, x0 + dx
    ty1, tx1 = min(a.shape[0], ty0 + patch.shape[0]), min(a.shape[1], tx0 + patch.shape[1])
    cy0, cx0 = max(0, ty0), max(0, tx0)
    region = a[cy0:ty1, cx0:tx1]
    p = patch[cy0 - ty0:cy0 - ty0 + region.shape[0], cx0 - tx0:cx0 - tx0 + region.shape[1]]
    m = p[..., 3] > 0
    if behind:
        m &= region[..., 3] == 0
    region[m] = p[m]
    return Image.fromarray(a, "RGBA")


def foot_top(frame: Image.Image, y_from: int, frac: float = 0.5) -> int:
    """First row (scanning up from the bottom) below any hem or body: rows whose widest opaque run is under `frac`
    of the figure width are feet; the row above the first wide run is where lifting may start."""
    a = np.asarray(frame)[..., 3] > 0
    cols = np.where(a.any(0))[0]
    width = cols.max() - cols.min() + 1 if len(cols) else 1
    rows = np.where(a.any(1))[0]
    y = int(rows.max()) if len(rows) else a.shape[0] - 1
    while y > y_from:
        r = np.concatenate([[0], a[y].astype(np.int8), [0]])
        d = np.diff(r)
        runs = np.where(d == -1)[0] - np.where(d == 1)[0]
        if len(runs) and runs.max() >= frac * width:
            return y + 1
        y -= 1
    return y_from


def walk_row(direction: str, frames: list[Image.Image], cfg: dict | None, bottom: int = 93) -> list[Image.Image]:
    """7 walk frames for one direction from the approved [stand, step_l, step_r] (side rows face left)."""
    stand, step_l, step_r = frames
    f = (cfg or {}).get("field", {}).get(direction, {})
    w = stand.width
    cut = f.get("cut", bottom - (14 if direction == "side" else 13))
    lift = f.get("lift", 2)
    if f.get("skip"):                                   # e.g. a floating or full-length robe sprite
        return [stand, step_l, step_l, stand, step_r, step_r, stand]
    if direction == "side":
        dx = f.get("dx", -10)
        rear = f.get("rear", [w // 2 + 2, max(cut + 1, foot_top(step_l, cut)), w, bottom + 2])
        pass_l = move_box(bob(stand, cut, -1), step_l, rear, dx, -lift - 1, behind=True, erase=False)
        pass_r = move_box(bob(stand, cut, -1), step_r, rear, dx, -lift - 1, behind=True, erase=False)
    else:
        y0 = max(cut + 2, foot_top(stand, cut))
        right, left = f.get("right", [w // 2, y0, w - 7, bottom + 2]), f.get("left", [7, y0, w // 2, bottom + 2])
        pass_l = move_box(bob(stand, cut, -1), stand, right, 0, -lift, behind=False, erase=True)
        pass_r = move_box(bob(stand, cut, -1), stand, left, 0, -lift, behind=False, erase=True)
    return [stand, step_l, bob(step_l, cut, 1), pass_l, step_r, bob(step_r, cut, 1), pass_r]


# ───────── checks & review ─────────
def _second_ring(img: Image.Image) -> float:
    a = np.asarray(img)
    s = a[..., 3] > 0
    dark = s & (a[..., :3].max(2) < 60)
    edge = s & _grow(~s)
    inner = dark & ~edge & _grow(edge)
    return float(inner.sum() / max(edge.sum(), 1))


def check(frame: Image.Image, source: Image.Image) -> dict:
    """Outline thickness, size and fragments of an in-between against the keyframe it was cut from."""
    from gen.pixelize import components
    fa, sa = np.asarray(frame)[..., 3] > 0, np.asarray(source)[..., 3] > 0
    ys_f, ys_s = np.where(fa.any(1))[0], np.where(sa.any(1))[0]
    _, n = components(fa)
    rep = {"ring": round(_second_ring(frame), 2), "ring_src": round(_second_ring(source), 2),
           "px": round(fa.sum() / max(sa.sum(), 1), 3), "height": int(np.ptp(ys_f) + 1), "height_src": int(np.ptp(ys_s) + 1),
           "pieces": n}
    rep["ok"] = bool(abs(rep["ring"] - rep["ring_src"]) <= 0.08 and 0.88 <= rep["px"] <= 1.12
                 and abs(rep["height"] - rep["height_src"]) <= 4 and n <= 2)
    return rep


def _strip(frames: list[Image.Image], scale: int = 4, gap: int = 4) -> Image.Image:
    w, h = frames[0].size
    out = Image.new("RGBA", (len(frames) * (w + gap) * scale, h * scale), (60, 60, 70, 255))
    for i, f in enumerate(frames):
        out.alpha_composite(f.resize((w * scale, h * scale), Image.Resampling.NEAREST), (i * (w + gap) * scale, 0))
    return out


def _gif(frames: list[Image.Image], path: Path, ms: int, scale: int = 4) -> None:
    w, h = frames[0].size
    imgs = []
    for f in frames:
        bg = Image.new("RGBA", (w, h), (60, 60, 70, 255))
        bg.alpha_composite(f)
        imgs.append(bg.convert("RGB").resize((w * scale, h * scale), Image.Resampling.NEAREST))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms, loop=0)


def review(cid: str, out: Path) -> dict:
    """Write <id>_battle.png (keyframes + in-betweens, with joints), GIFs, and return the checks."""
    from PIL import ImageDraw
    out.mkdir(parents=True, exist_ok=True)
    cfg = load_cfg(cid)
    assert cfg is not None
    frames = battle_sheet_frames(cid)
    new = battle_inbetweens(cid, cfg)
    allf = {**frames, **{n: new.get(n, frames[SOURCE[n]]) for n in INBETWEENS}}   # alias_frames: the key
    if is_lance(cid):                                 # pass CL: the body check on the body, plus the lance checks
        from gen import puppet_lance as PL
        rep = PL.review_checks(cid, cfg, new)
    else:
        rep = {n: check(new[n], frames[SOURCE[n]]) for n in new}
    # keyframes with their joints, so the marking can be checked by eye
    marked = []
    cw, ch = frames["ready"].size
    for k in KEYFRAMES:
        im = frames[k].resize((cw * 4, ch * 4), Image.Resampling.NEAREST)
        d = ImageDraw.Draw(im)
        j = cfg["battle"][k]
        for p in PARTS:
            a, b = _bone(p, j)
            if a in j and b in j:
                d.line([(j[a][0] * 4, j[a][1] * 4), (j[b][0] * 4, j[b][1] * 4)], fill=(255, 0, 0, 255), width=2)
        for n in [*JOINTS, "tip", "tip_f"]:
            if n in j:
                d.ellipse([j[n][0] * 4 - 3, j[n][1] * 4 - 3, j[n][0] * 4 + 3, j[n][1] * 4 + 3], fill=(0, 255, 0, 255))
        marked.append(im)
    seq = _strip([allf[n] for n in ATTACK_SEQ + CAST_SEQ[1:5]] + [allf["idle_b"]], 4)
    pw, ph = cw * 4 + 10, ch * 4 + 10
    sheet = Image.new("RGBA", (max(seq.width, 3 * pw), ph + seq.height), (40, 40, 48, 255))
    for i, im in enumerate(marked):
        sheet.alpha_composite(im, (i * pw, 0))
    sheet.alpha_composite(seq, (0, ph))
    sheet.save(out / f"{cid}_battle.png")
    _gif([allf[n] for n in ATTACK_SEQ], out / f"{cid}_attack.gif", 90)
    _gif([allf[n] for n in CAST_SEQ], out / f"{cid}_cast.gif", 110)
    return rep


def review_walk(cid: str, rows: dict[str, list[Image.Image]], out: Path) -> None:
    cfg = load_cfg(cid)
    strips = [_strip(walk_row(d, rows[d], cfg), 3) for d in ("down", "up", "side") if d in rows]
    sheet = Image.new("RGBA", (strips[0].width, sum(s.height + 6 for s in strips)), (40, 40, 48, 255))
    y = 0
    for s in strips:
        sheet.alpha_composite(s, (0, y))
        y += s.height + 6
    sheet.save(out / f"{cid}_walk.png")
    for d in ("down", "side"):
        if d in rows:
            seq = walk_row(d, rows[d], cfg)
            _gif([seq[i] for i in WALK_SEQUENCE], out / f"{cid}_walk_{d}.gif", 110, 3)


def main(argv: list[str]) -> None:
    sys.path.insert(0, str(HERE.parent))
    out = HERE / "out" / "anim" / "review"
    ids = argv[1:] or sorted(p.stem for p in ANIM.glob("*.yaml"))
    for cid in ids:
        cfg = load_cfg(cid)
        if (APPROVED / cid / "battle.json").exists() and cfg and "battle" in cfg:
            rep = review(cid, out)
            bad = {n: r for n, r in rep.items() if not r["ok"]}
            print(f"{cid}: battle {'OK' if not bad else 'CHECK ' + json.dumps(bad)}")
    print("->", out)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "review":
        main(sys.argv[1:])
    else:
        print(__doc__)

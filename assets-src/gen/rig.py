"""Generic monster rig (docs/ENEMY_ANIM_PLAN.md 4.2): body templates, segmentation and the pose solve.

A rig file (anim/monsters/<sprite>.yaml) marks joints on every approved keyframe in the image's own coordinates
(monsters face right: fwd = +1, no mirroring). Parts come from the body template plus the file's `parts` overrides;
kinds are rigid | torso | chain | cloth | prop | fx. Rendering lives in rig_render.py. puppet.py (the party) is not
touched; only its neutral helpers are imported.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen import rig_ik as RI
from gen.rig_blob import BLOB
from gen.rig_serpent import SERPENTS, rooted_half
from gen.rig_floating import FLOATERS
from gen.rig_naga import NAGA
from gen.rig_templates import BEASTS

# joint -> parent, rooted at the hip (biped template)
BIPED_PARENT = {"chest": "hip", "neck": "chest", "crown": "neck",
                "sh_n": "chest", "el_n": "sh_n", "hand_n": "el_n", "sh_f": "chest", "el_f": "sh_f", "hand_f": "el_f",
                "hip_n": "hip", "knee_n": "hip_n", "foot_n": "knee_n", "hip_f": "hip", "knee_f": "hip_f", "foot_f": "knee_f",
                "tip": "hand_n"}
# part -> bone, segmentation radius at an 80 px cell, kind
BIPED_PARTS = {
    "head": {"bone": ["neck", "crown"], "radius": 11.0}, "torso": {"bone": ["chest", "hip"], "radius": 9.0, "kind": "torso"},
    "uarm_n": {"bone": ["sh_n", "el_n"], "radius": 3.5}, "farm_n": {"bone": ["el_n", "hand_n"], "radius": 4.5},
    "uarm_f": {"bone": ["sh_f", "el_f"], "radius": 3.5}, "farm_f": {"bone": ["el_f", "hand_f"], "radius": 4.5},
    "thigh_n": {"bone": ["hip_n", "knee_n"], "radius": 4.0}, "shin_n": {"bone": ["knee_n", "foot_n"], "radius": 4.5},
    "thigh_f": {"bone": ["hip_f", "knee_f"], "radius": 4.0}, "shin_f": {"bone": ["knee_f", "foot_f"], "radius": 4.5},
    "weapon": {"bone": ["hand_n", "tip"], "radius": 2.0},
}
BIPED_Z = ["uarm_f", "farm_f", "thigh_f", "shin_f", "torso", "thigh_n", "shin_n", "head", "uarm_n", "farm_n", "weapon"]
TEMPLATES = {"biped": (BIPED_PARENT, BIPED_PARTS, BIPED_Z)}
LEGS = ("knee_n", "knee_f", "foot_n", "foot_f")
FEET = ("foot_n", "foot_f")
# per template: legs, feet, IK limbs, recipe joint sets (None = the biped sets in monster_anim), planted, breath joint
BODY = {"biped": {"legs": LEGS, "feet": FEET, "limbs": tuple((f"hip_{s}", f"knee_{s}", f"foot_{s}") for s in "nf"),
                  "moves": None, "planted": "foot_f", "breath": "hip", "head": ("crown", "neck")}}
for _name, _t in {**BEASTS, "naga": NAGA, **FLOATERS, "blob": BLOB, **SERPENTS}.items():   # T5a, FW-3, FW-1, FW-6, FW-2
    TEMPLATES[_name] = (_t["parent"], _t["parts"], _t["z"])
    BODY[_name] = {k: _t[k] for k in ("legs", "feet", "limbs", "moves", "planted", "breath", "head", "arms", "extra",
                                      "ground", "floating", "recipes", "idle_b", "rooted") if k in _t}


class Rig:
    """A parsed rig file: joints per keyframe, parts, joint tree, z orders, colour rules."""

    def __init__(self, cfg: dict, cell: tuple[int, int]):
        self.cfg = cfg
        self.body = cfg.get("body", "biped")
        if self.body not in TEMPLATES:
            raise ValueError(f"rig {cfg.get('sprite')}: body template {self.body!r} is not implemented (T5a)")
        parent, parts, z = TEMPLATES[self.body]
        b = BODY[self.body]
        self.legs, self.feet, self.limbs, self.moves, self.head = b["legs"], b["feet"], b["limbs"], b["moves"], b["head"]
        self.planted, self.breath = cfg.get("planted", b["planted"]), cfg.get("breath_joint", b["breath"])
        # arm suffixes of the cast set, extra recipe joints per set, contact joints pinned in every frame (naga)
        self.arms, self.extra, self.ground = b.get("arms", ("n", "f")), b.get("extra", {}), tuple(b.get("ground", ()))
        # FW-1: no ground (float band, ungrounded solve, whole-sprite idle_b) and per-frame recipe overrides (dx, dy)
        self.floating, self.recipes = bool(b.get("floating", False)), dict(b.get("recipes", {}))
        self.idle_b = b.get("idle_b", "bob")                # FW-6: "sag" (blob: one interior row removed)
        self.half_default = rooted_half(cfg) if b.get("rooted") else set()   # FW-2: non-lead tentacles sway
        self.cell = cell
        self.fwd = 1 if cfg.get("facing", "right") == "right" else -1
        self.sampler = cfg.get("sampler", "nearest")
        self.parent = dict(parent)
        wh = cfg.get("weapon_hand", "n")
        if "tip" in self.parent:
            self.parent["tip"] = f"hand_{wh}"
        scale = cell[1] / 80.0
        self.parts: dict[str, dict] = {}
        for name, p in parts.items():
            self.parts[name] = {"kind": "rigid", **p, "radius": p["radius"] * scale}
            if isinstance(p.get("width"), (int, float)):
                self.parts[name]["width"] = p["width"] * scale
        if "weapon" in self.parts:
            self.parts["weapon"]["bone"] = [f"hand_{wh}", "tip"]
        for name, p in (cfg.get("parts") or {}).items():
            if p.get("remove"):
                self.parts.pop(name, None)
                continue
            base = self.parts.get(name, {"kind": "rigid", "radius": 3.0 * scale})
            self.parts[name] = {**base, **p}
            given = p.get("chain") or p.get("bone") or []
            bones = given if isinstance(given, dict) else {"*": given}
            for joints in bones.values():                 # a prop may sit on other joints per keyframe
                for a, b in zip(joints, joints[1:]):
                    self.parent.setdefault(b, a)
        self.keyframes = {k: {j: (float(v[0]), float(v[1])) for j, v in kf.items()} for k, kf in (cfg.get("keyframes") or {}).items()}
        self.z = {k: list(v) for k, v in (cfg.get("z") or {}).items()}
        self.default_z = z + [n for n in self.parts if n not in z]
        self.order = _topo(self.parent)

    def z_for(self, kf: str) -> list[str]:
        z = self.z.get(kf, self.default_z)
        return [p for p in z if p in self.parts] + [p for p in self.parts if p not in z]

    def joined_pairs(self) -> set:
        """Part-index pairs that meet at a joint (one part's first joint is, or hangs from, a joint of the other)."""
        names = list(self.parts)
        js = {n: {j for kf in self.keyframes for j in self.joints_of(n, kf)} for n in names}
        first = {n: {self.joints_of(n, kf)[0] for kf in self.keyframes if self.joints_of(n, kf)} for n in names}
        out = set()
        for i, a in enumerate(names):
            for k, b in enumerate(names):
                if i != k and any(j in js[b] or self.parent.get(j) in js[b] for j in first[a]):
                    out.add(frozenset((i, k)))
        return out

    def joints_of(self, part: str, kf: str) -> list[str]:
        p = self.parts[part]
        bone = p.get("chain") or p["bone"]
        return list(bone.get(kf, []) if isinstance(bone, dict) else bone)

    def present(self, part: str, kf: str) -> bool:
        p = self.parts[part]
        js = self.joints_of(part, kf)
        return (not p.get("in") or kf in p["in"]) and len(js) >= 2 and all(j in self.keyframes.get(kf, {}) for j in js)


def _topo(parent: dict[str, str]) -> list[str]:
    out, seen = [], set()

    def visit(j: str) -> None:
        if j in seen:
            return
        seen.add(j)
        if j in parent:
            visit(parent[j])
        out.append(j)
    for j in sorted(parent):
        visit(j)
    return out


# ───────── segmentation ─────────
def _seg_dist(px: np.ndarray, a, b) -> np.ndarray:
    a, b = np.asarray(a, float), np.asarray(b, float)
    ab = b - a
    t = np.clip(np.einsum("ij,j->i", px - a, ab) / max(float(ab[0] ** 2 + ab[1] ** 2), 1e-6), 0, 1)
    return np.linalg.norm(px - (a + t[:, None] * ab), axis=1)


def segment(rig: Rig, kf: str, arr: np.ndarray) -> tuple[np.ndarray, list[str]]:
    """Label every opaque pixel of keyframe `kf` with the index (into the returned part list) of its nearest bone,
    then apply the colour rules and polygon masks; -1 = transparent."""
    from gen.puppet import _absorb_orphans
    names = list(rig.parts)
    joints = rig.keyframes[kf]
    h, w = arr.shape[:2]
    ys, xs = np.nonzero(arr[..., 3] > 0)
    px = np.stack([xs, ys], 1).astype(float)
    d = np.full((len(px), len(names)), np.inf)
    for i, n in enumerate(names):
        if not rig.present(n, kf):
            continue
        js = rig.joints_of(n, kf)
        d[:, i] = np.min([_seg_dist(px, joints[a], joints[b]) for a, b in zip(js, js[1:])], 0) / rig.parts[n]["radius"]
    lab = np.full((h, w), -1, np.int32)
    lab[ys, xs] = d.argmin(1) if len(names) else -1
    solid = arr[..., 3] > 0
    for key, cols in (rig.cfg.get("colors") or {}).items():
        kinds = [n for n in names if rig.present(n, kf) and (n == key or rig.parts[n]["kind"] == key)]
        if not kinds:
            continue
        hit = solid & np.isin(arr[..., :3].astype(np.int64) @ np.array([65536, 256, 1]),
                              [c[0] * 65536 + c[1] * 256 + c[2] for c in cols])
        if len(kinds) == 1:
            lab[hit] = names.index(kinds[0])
        else:
            hy, hx = np.nonzero(hit)
            dd = d[np.searchsorted(ys * w + xs, hy * w + hx)][:, [names.index(k) for k in kinds]]
            lab[hy, hx] = np.array([names.index(k) for k in kinds])[dd.argmin(1)]
    for part, per_kf in (rig.cfg.get("masks") or {}).items():
        poly = (per_kf or {}).get(kf)
        if poly and part in names:
            m = Image.new("L", (w, h), 0)
            ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
            lab[solid & (np.asarray(m) > 0)] = names.index(part)
    return _absorb_orphans(lab), names


# ───────── pose solve ─────────
def _ang(a, b) -> float:
    return math.atan2(b[1] - a[1], b[0] - a[0])


def _wrap(a: float) -> float:
    return (a + math.pi) % (2 * math.pi) - math.pi


def solve(rig: Rig, S: dict, T: dict, u: float, moves, pins, body_dy: int = 0, tweaks: dict | None = None,
          grounded: bool = True, half: set | None = None, body_dx: int = 0) -> dict:
    """Angle-space interpolation from S toward T by u (u < 0 extrapolates away; `half` joints by u / 2), bone lengths
    from S, root lerp, pinned joints, body offset (dy, and FW-1's floating drift dx) and tweaks; a grounded foot never
    sinks below the source's ground line (two-bone IK on the knee); the template's `ground` joints (naga coil) never
    move; every joint snapped to a whole pixel."""
    moves = set(S) if moves == "all" else set(moves)
    half = half or set()
    out: dict[str, tuple[float, float]] = {}
    for j in rig.order:
        if j not in S:
            continue
        p = rig.parent.get(j)
        uj = u * 0.5 if j in half else u
        if p is None or p not in out:
            tgt = T.get(j, S[j])
            out[j] = (S[j][0] + (tgt[0] - S[j][0]) * uj, S[j][1] + (tgt[1] - S[j][1]) * uj) if j in moves else S[j]
            continue
        L = math.hypot(S[j][0] - S[p][0], S[j][1] - S[p][1])
        a = _ang(S[p], S[j])
        if j in moves and j in T and p in T:
            a += _wrap(_ang(T[p], T[j]) - a) * uj
        out[j] = (out[p][0] + L * math.cos(a), out[p][1] + L * math.sin(a))
    base = dict(out)
    fixed = {j for j in pins if j in S}                    # joints placed absolutely after the tree solve
    for j in fixed:
        out[j] = S[j]
    if body_dy or body_dx:
        out = {j: (v[0] + body_dx, v[1] + body_dy) if j not in pins and j not in rig.legs else v for j, v in out.items()}
    for j, dv in (tweaks or {}).items():
        if j in out and j not in rig.ground:              # naga contact joints ignore tweaks too
            out[j] = (out[j][0] + dv[0], out[j][1] + dv[1])
    out = RI.keep_reach(rig, S, out, set(pins), fixed)
    ground = max((S[f][1] for f in rig.feet if f in S), default=1e9) if grounded else 1e9
    for h, k, f in rig.limbs:
        if not all(j in out for j in (h, k, f)) or k in pins:
            continue
        if f in pins or out[f][1] > ground:              # keep the shin's length to a held / grounded foot
            out[k], out[f] = RI.ik(out[h], (out[f][0], min(out[f][1], ground)), S[h], S[k], S[f])
            fixed |= {k, f}
    follow: set[str] = set()                               # children (e.g. toes) of pinned / IK-moved joints keep
    for j in rig.order:                                    # their solved offset from the parent (plus own tweak); not
        # the children of `ground` joints: the whole naga hangs from its coil and keeps its own dy and tweaks
        p = rig.parent.get(j)
        if j in out and j not in fixed and p in out and ((p in fixed and p not in rig.ground) or p in follow):
            tw = (tweaks or {}).get(j, (0, 0))
            out[j] = (out[p][0] + base[j][0] - base[p][0] + tw[0], out[p][1] + base[j][1] - base[p][1] + tw[1])
            follow.add(j)
    return {j: (float(np.rint(v[0])), float(np.rint(v[1]))) for j, v in out.items()}


def part_rotation(rig: Rig, part: str, kf: str, S: dict, out: dict) -> float:
    """Largest bone rotation (degrees) of a part between its source keyframe `kf` joints and the solved pose."""
    js = rig.joints_of(part, kf)
    rots = [math.degrees(_wrap(_ang(out[a], out[b]) - _ang(S[a], S[b]))) for a, b in zip(js, js[1:])
            if a in out and b in out and a in S and b in S]
    return max(rots, key=abs) if rots else 0.0

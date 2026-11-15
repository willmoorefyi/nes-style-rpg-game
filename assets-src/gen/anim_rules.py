"""Monster animation checks 10-14 (docs/ENEMY_ANIM_PLAN.md 5.1) that work on numbers, hashes and atlas crops rather
than on silhouettes: rotation cap, near-keyframe rule, whole-pixel joints, atlas exactness, page size, lock hashes,
D8 prop carry and the holds cap. Re-exported by anim_checks.py."""
from __future__ import annotations

import hashlib

import numpy as np

from gen.monster_recipes import KEYFRAMES, SEQUENCES as _RUNS

MAX_PAGE = 2048                    # docs/ROSTER_PLAN.md 8 (D10): every monster atlas page <= 2048x2048
NEAR_KEYFRAME = 0.35
ROT_CAP = {"rigid": 30.0, "torso": 20.0, "chain": 25.0, "cloth": 25.0, "prop": 30.0, "fx": 30.0,
           "shear": 25.0}                  # FW-6 blob body: its lean angle (anim_squash.shear_part)
# the generated frames of every runtime sequence (monster_recipes.SEQUENCES: attack, hurt, cast, daze, heavy)
SEQUENCES = {seq: tuple(dict.fromkeys(n for n in names if n not in KEYFRAMES)) for seq, names in _RUNS.items()}


# 10: rotation cap, near-keyframe rule, whole pixels
def rotation_cap(rots: dict[str, tuple[float, str]], cap: float | None = None) -> list[str]:
    """`cap` (FW-5 preset mechanical: 15) lowers every kind's cap to at most that."""
    def lim(p: str, k: str) -> float:
        c = ROT_CAP.get("torso" if p == "torso" else k, 30.0)
        return min(c, cap) if cap else c
    bad = [f"{p} {d:.1f} deg > {lim(p, k)}" for p, (d, k) in sorted(rots.items()) if abs(d) > lim(p, k)]
    return [f"rotation cap: {', '.join(bad)}"] if bad else []


def near_keyframe(u: float) -> list[str]:
    return [f"t {u:+.2f} is more than {NEAR_KEYFRAME} from the pixel source"] if abs(u) > NEAR_KEYFRAME + 1e-9 else []


def whole_pixel(joints: dict) -> list[str]:
    bad = [k for k, v in sorted(joints.items()) if isinstance(v, (tuple, list)) and len(v) == 2
           and any(abs(float(c) - round(float(c))) > 1e-9 for c in v)]
    return [f"joints not on whole pixels: {bad}"] if bad else []


# 11: atlas
def atlas_exact(atlas: np.ndarray, rect: tuple[int, int, int, int], frame: np.ndarray) -> list[str]:
    x, y, w, h = rect
    crop = atlas[y:y + h, x:x + w]
    if crop.shape != frame.shape or not np.array_equal(crop, frame):
        return [f"atlas crop at {rect} differs from the frame"]
    return []


def page_size(w: int, h: int) -> list[str]:
    return [f"atlas page {w}x{h} > {MAX_PAGE}"] if w > MAX_PAGE or h > MAX_PAGE else []


# 12: lock
def frame_hash(a: np.ndarray) -> str:
    a = np.ascontiguousarray(a, np.uint8)
    return hashlib.sha256(f"{a.shape}".encode() + a.tobytes()).hexdigest()


def lock_match(frames: dict[str, np.ndarray], lock: dict[str, str]) -> list[str]:
    out = [f"{n}: hash differs from the lock file" for n, a in sorted(frames.items()) if lock.get(n) != frame_hash(a)]
    out += [f"{n}: locked but not generated" for n in sorted(set(lock) - set(frames))]
    return out


# 13-14: prop carry, holds
def prop_carry(n_in1: int, n_in2: int) -> list[str]:
    if n_in2 <= 0:
        return [f"prop missing from hurt_in2 (hurt_in1 has {n_in1} px)"]
    if n_in2 > 0.6 * n_in1:
        return [f"prop in hurt_in2 {n_in2} px > 60% of hurt_in1 {n_in1} px"]
    return []


def holds_cap(holds: list[str]) -> list[str]:
    out = []
    for seq, frames in SEQUENCES.items():
        n = [h for h in holds if h in frames]
        if len(n) > 1:
            out.append(f"{len(n)} holds in the {seq} sequence {n} (max 1)")
    return out

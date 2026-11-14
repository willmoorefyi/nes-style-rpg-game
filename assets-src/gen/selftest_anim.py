"""Monster animation self-tests (docs/ENEMY_ANIM_PLAN.md 6.3), run from selftest.py (test_monster_anim).

Every checker of anim_checks.py (plan 5.1) is fed a synthetic sprite with one injected defect and must fail it; the
clean version must pass. Then the generator: a synthetic biped renders deterministically, an identity mesh warp is the
identity, rotsprite keeps the palette and breaks ties deterministically, and a monsters_ai build into a temp dir keeps
the approved sheets and the party atlas byte-identical and is independent of PYTHONHASHSEED.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUTLINE = (6, 4, 10)
BODY, SKIN, CLOTH = (60, 140, 60), (230, 190, 150), (120, 80, 40)


def figure(dx: int = 0, dy: int = 0) -> np.ndarray:
    """80x80 outlined blob creature, feet on row 76 (shifted by dx, dy)."""
    im = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([24 + dx, 30 + dy, 52 + dx, 76 + dy], fill=BODY + (255,), outline=OUTLINE + (255,))
    d.rectangle([28 + dx, 34 + dy, 48 + dx, 46 + dy], fill=SKIN + (255,))
    d.rectangle([28 + dx, 56 + dy, 48 + dx, 66 + dy], fill=CLOTH + (255,))
    d.rectangle([30 + dx, 14 + dy, 46 + dx, 30 + dy], fill=SKIN + (255,), outline=OUTLINE + (255,))
    return np.asarray(im).copy()


def _palette(a: np.ndarray) -> set:
    return {tuple(int(v) for v in c) for c in a[a[..., 3] > 0][:, :3]}


def run_checks(check: Callable[[bool, str], None]) -> None:
    from gen import anim_checks as C

    def red(name: str, clean: list[str], broken: list[str]) -> None:
        check(not clean, f"{name}: clean passes {clean}")
        check(bool(broken), f"{name}: defect fails ({broken[0] if broken else 'NOT DETECTED'})")

    src = figure()
    pal = _palette(src) | {OUTLINE}

    b = src.copy(); b[40, 30, 3] = 128
    red("1 binary alpha (semi-alpha pixel)", C.binary_alpha(src), C.binary_alpha(b))
    b = src.copy(); b[50, 30, :3] = (1, 2, 3)
    red("2 palette lock (off-palette colour)", C.palette_lock(src, pal), C.palette_lock(b, pal))
    b = src.copy(); b[50, 30, :3] = (250, 10, 245)
    red("3 magenta / key fringe", C.magenta(src), C.magenta(b))
    b = src.copy(); b[10, 70] = (*BODY, 255)
    red("4 detached pixels (stray pixel)", C.detached(src, src), C.detached(b, src))
    b = src.copy(); b[50:52, 36:38, 3] = 0
    red("5a new hole (4 px)", C.new_holes(src, src), C.new_holes(b, src))
    lab = np.where(src[..., 3] > 0, 0, -1).astype(np.int32)
    lab[:, 39:] = np.where(lab[:, 39:] >= 0, 1, -1)
    b = src.copy(); b[60, 38, 3] = 0
    lab_b = lab.copy(); lab_b[60, 38] = -1
    red("5b seam gap between two part labels", C.seam_gaps(src, lab), C.seam_gaps(b, lab_b))
    b = src.copy(); b[:52] = 0
    red("6a silhouette area / height", C.silhouette(src, src, src, 0.2, 80), C.silhouette(b, src, src, 0.2, 80))
    far = figure(dx=24)
    red("6b continuity (adjacent IoU / centroid)", C.continuity(src, figure(dx=1), (src, src), 80),
        C.continuity(src, far, (src, src), 80))
    b = src.copy(); b[np.all(b[..., :3] == OUTLINE, 2) & (b[..., 3] > 0), :3] = BODY
    red("7 outline (edge ink lost)", C.outline_kept(src, src), C.outline_kept(b, src))
    red("8 feet anchored (feet moved 1 px)", C.feet(src, src, src, 0.2, 76, True, False),
        C.feet(figure(dy=-1), src, src, 0.2, 76, True, False))
    b = src.copy(); b[40, 0] = (*BODY, 255)
    red("9 clipping (border pixel)", C.clipping(src), C.clipping(b))
    red("10a rotation cap (40 deg)", C.rotation_cap({"uarm_n": (10.0, "rigid")}), C.rotation_cap({"uarm_n": (40.0, "rigid")}))
    red("10b near-keyframe rule (t = 0.5)", C.near_keyframe(0.35), C.near_keyframe(0.5))
    red("10c whole-pixel joints (half-pixel joint)", C.whole_pixel({"hand_n": (10.0, 20.0)}),
        C.whole_pixel({"hand_n": (10.5, 20.0)}))
    atlas = np.zeros((100, 200, 4), np.uint8); atlas[5:85, 7:87] = src
    red("11a atlas exactness (crop off by one)", C.atlas_exact(atlas, (7, 5, 80, 80), src),
        C.atlas_exact(atlas, (8, 5, 80, 80), src))
    red("11b atlas page <= 4096", C.page_size(4096, 2000), C.page_size(4097, 100))
    lock = {"atk_mid": C.frame_hash(src)}
    red("12 lock hash", C.lock_match({"atk_mid": src}, lock), C.lock_match({"atk_mid": figure(dx=1)}, lock))
    red("13 D8 prop carry (prop missing from hurt_in2)", C.prop_carry(50, 20), C.prop_carry(50, 0))
    check(bool(C.prop_carry(50, 40)), "13 D8 prop carry: more than 60% of the hurt_in1 prop fails")
    red("14 holds cap (2 holds in attack)", C.holds_cap(["atk_mid", "hurt_in1"]), C.holds_cap(["atk_mid", "atk_follow"]))


def _approved_hashes() -> dict[str, str]:
    files = sorted((HERE / "approved").glob("*/monster_*.png")) + sorted((HERE / "approved").glob("*/boss_*.png"))
    return {str(p.relative_to(HERE)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def _party_hashes() -> dict[str, str]:
    sp = ROOT / "assets" / "sprites"
    return {n: hashlib.sha256((sp / n).read_bytes()).hexdigest() for n in
            ("battle-characters-ai.png", "battle-characters-ai.json", "characters-ai.png", "characters-ai.json") if (sp / n).exists()}


def run_build_locks(check: Callable[[bool, str], None]) -> None:
    """Style lock, party atlas lock and PYTHONHASHSEED independence of a monsters_ai build (into temp dirs)."""
    approved, party = _approved_hashes(), _party_hashes()
    outs = []
    with tempfile.TemporaryDirectory() as tmp:
        for seed in ("0", "1"):
            out = Path(tmp) / seed
            env = {**os.environ, "PYTHONHASHSEED": seed}
            code = ("import sys; sys.path.insert(0, %r); from gen import monster_atlas as MA; "
                    "from pathlib import Path; MA.build(Path(%r))") % (str(HERE.parent), str(out))
            r = subprocess.run([sys.executable, "-I", "-c", code], env=env, capture_output=True, text=True)
            check(r.returncode == 0, f"monsters_ai build (PYTHONHASHSEED={seed}) exits 0 {r.stderr.strip()[-300:]}")
            outs.append({n: (out / n).read_bytes() for n in ("monsters-ai.png", "monsters-ai.json") if (out / n).exists()})
        check(len(outs[0]) == 2 and outs[0] == outs[1], "monsters_ai PNG and JSON identical under PYTHONHASHSEED 0 and 1")
        if outs[0]:
            meta = json.loads(outs[0]["monsters-ai.json"])
            check(meta.get("texScale") == 1 and meta.get("scale") == 2, "atlas is native size (texScale 1, scale 2)")
    check(_approved_hashes() == approved, "style lock: approved monster_*.png / boss_*.png unchanged by a build")
    check(_party_hashes() == party, "party atlases unchanged by a monsters_ai build")


def run_generator(check: Callable[[bool, str], None]) -> None:
    from gen import anim_checks as C
    from gen import rig_render as RR
    from gen import selftest_rig as SR
    # identity mesh warp
    src = figure()
    mask = src[..., 3] > 0
    chain = [(38.0, 14.0), (38.0, 45.0), (38.0, 76.0)]
    out, hit = RR.mesh_warp(src, mask, chain, chain, 20.0, src.shape[:2])
    check(hit.sum() == mask.sum() and np.array_equal(out[hit], src[hit]), f"identity mesh warp is the identity ({hit.sum()} px)")
    bent = [(38.0, 14.0), (38.0, 45.0), (46.0, 74.0)]
    out2, hit2 = RR.mesh_warp(src, mask, chain, bent, 20.0, src.shape[:2])
    check(hit2.sum() > 0.8 * mask.sum() and _palette(out2) <= _palette(src), "bent mesh warp keeps the palette")
    # rotsprite
    rot = RR.rotsprite(src, mask, (38.0, 45.0), (38.0, 45.0), np.radians(17.0), src.shape[:2])
    rgba = rot[0]
    check(_palette(rgba) <= _palette(src) and set(np.unique(rgba[..., 3])) <= {0, 255}, "rotsprite keeps the palette (binary alpha)")
    again = RR.rotsprite(src, mask, (38.0, 45.0), (38.0, 45.0), np.radians(17.0), src.shape[:2])
    check(np.array_equal(rgba, again[0]), "rotsprite is deterministic")
    block = np.array([[1, 1, 2, 2], [3, 3, 4, 4]], np.uint32)            # each colour twice: a four-way tie
    check(RR.block_mode(block, centre=np.array([2, 4], np.uint32))[0] == 2 and
          RR.block_mode(np.array([[5, 5, 7, 7]], np.uint32), centre=np.array([1], np.uint32))[0] == 5,
          "rotsprite ties: the centre sample wins, then the lowest RGBA")
    # synthetic biped: deterministic, and every generated frame passes the per-frame checks
    one, two = SR.render_synthetic(), SR.render_synthetic()
    check(sorted(one) == sorted(two) and all(np.array_equal(one[k][0], two[k][0]) for k in one),
          f"synthetic biped renders deterministically ({len(one)} frames)")
    fails, tuning = SR.check_synthetic(one)
    check(not fails, f"synthetic biped frames pass the construction checks (alpha, palette, feet, border, rotation, "
                     f"35% rule, whole px, D8 carry, holds) {fails[:3]}")
    print(f"  info {len(tuning)} tuning findings on the stick figure (rig-tuning work, T1+): {tuning[:2]}")
    check(0 < one["hurt_in2"][1]["prop_px"]["dagger"] <= 0.6 * one["hurt_in1"][1]["prop_px"]["dagger"],
          "D8: the dagger is carried into hurt_in2, partly hidden behind the torso")
    check(len(one) == 8, f"a rigged monster gets 8 generated frames ({sorted(one)})")
    check(C.frame_hash(one["atk_mid"][0]) == C.frame_hash(two["atk_mid"][0]), "frame hashes are stable")

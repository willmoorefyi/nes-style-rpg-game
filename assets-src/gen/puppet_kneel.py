"""Hero kneel frames (docs/KNEEL_PLAN.md pass K: D-K4, D-K5, D-K7, D-K10, section 4 hero bands, section 7 checks).

  python3 -I assets-src/gen/puppet_kneel.py review <class ...>   # GIF + sheet -> gen/out/anim/review/kneel/
  python3 -I assets-src/gen/puppet_kneel.py check <class ...>    # hero K-checks + the lock: only OK lines
  python3 -I assets-src/gen/puppet_kneel.py lock <class ...>     # anim/<class>.lock.json (the 4 kneel frames)

Opt-in (D-K7): only a class whose anim/<class>.yaml has a `kneel:` block gets frames; `build_battle_ai` appends the
columns KNEEL_POSES after the 14 old ones and repeats `ready` there for every other class. R3 (user, at U1) = variant
A for every class, so variant B is not built. `kneel:` keys: `lean`, `bow` (deg), `arms` (the sides whose hands go
down), `tweaks` ({joint: [dx, dy]} on the key), `knee_down` (default true), `band: [lo, hi]` (override: only with a
section 13 row of KNEEL_PLAN.md naming the class and the band, lo >= H_down + 2). Poses: puppet_kneel_render.py;
renderer: puppet_kneel_rot.py; review artefacts: puppet_kneel_review.py; selftests: puppet_kneel_selftest.py.
puppet.py is unchanged.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from gen import puppet as PU  # noqa: E402
from gen import puppet_kneel_render as KR  # noqa: E402
from gen.anim_rules import ROT_CAP, frame_hash, lock_match  # noqa: E402

KNEEL_POSES = ["kneel_in1", "kneel_in2", "kneel", "kneel_b"]
HELD = ("kneel", "kneel_b")
ROOT = HERE.parent.parent
PLAN = ROOT / "docs" / "KNEEL_PLAN.md"
ATLAS = ROOT / "assets" / "sprites" / "battle-characters-ai"
REVIEW = HERE / "out" / "anim" / "review" / "kneel"
KEY_LIMB_CAP, TWEEN_LIMB_CAP = 100.0, KR.TWEEN_LIMB_DEG                # D-K19
PART_KIND = {"head": "rigid", "torso": "torso", "weapon": "prop"}


def bottom_row(cid: str) -> int:
    return int(json.loads((PU.APPROVED / cid / "battle.json").read_text())["bottom_row"])


KEY_SOURCES = ("ai", "user")             # pass CB (docs/CLASS_BARBARIAN_PLAN.md 4): a drawn key, AI or the user's


def is_ai(cfg: dict) -> bool:
    """The class's kneel block names a drawn key (`source: ai`, or pass CB's `source: user`) bridged from ready."""
    return isinstance(cfg.get("kneel"), dict) and cfg["kneel"].get("source") in KEY_SOURCES


def make(cfg: dict, frames: dict, bottom: int, cid: str | None = None) -> dict:
    """{name: (image, rotations relative to the pixel source, source)} for the four kneel frames (variant A, or the
    AI key and its bridge when the block says `source: ai`)."""
    if is_ai(cfg):
        if not cid:
            raise ValueError("kneel source ai needs the class id")
        from gen.kneel_source_ai import hero_frames   # pass KT D-KT1 / D-KT2
        return hero_frames(cid, cfg, frames, bottom)
    front = (cfg.get("front_far_arm") or {}).get("ready", True)
    return KR.variant_a(frames, cfg["battle"]["ready"], cfg.get("kneel") or {}, bool(cfg.get("robed")),
                        PU.Z_FRONT_ARM if front else PU.Z_BACK_ARM, bottom)


def kneel_frames(cid: str) -> dict[str, Image.Image]:
    """The four kneel frames of `cid`; {} for a class without a `kneel:` block (its columns repeat ready)."""
    cfg = PU.load_cfg(cid)
    if not cfg or not cfg.get("kneel") or "battle" not in cfg:
        return {}
    made = make(cfg, PU.battle_sheet_frames(cid), bottom_row(cid), cid)
    return {n: made[n][0] for n in KNEEL_POSES}


# ───────── checks (section 7, heroes) ─────────
def height(img: Image.Image) -> int:
    rows = np.where((np.asarray(img)[..., 3] > 0).any(1))[0]
    return int(rows.max() - rows.min() + 1) if len(rows) else 0


def default_band(h_ready: int, h_down: int) -> tuple[int, int]:
    return max(math.ceil(0.72 * h_ready - 1e-9), h_down + 4), math.floor(0.88 * h_ready + 1e-9)


def override_ok(cid: str, band, h_down: int, plan_text: str) -> list[str]:
    """A `kneel.band` override needs a section 13 row naming the class and the new band; lo >= H_down + 2."""
    lo, hi = int(band[0]), int(band[1])
    sec = plan_text.split("## 13.", 1)[1] if "## 13." in plan_text else ""
    rows = [r for r in sec.splitlines() if r.startswith("|") and re.search(rf"\b{re.escape(cid)}\b", r)]
    out = [] if any(f"{lo}-{hi}" in r or f"[{lo}, {hi}]" in r for r in rows) else \
        [f"band override [{lo}, {hi}] has no section 13 entry for {cid}"]
    return out + ([f"band override lo {lo} < H_down + 2 = {h_down + 2}"] if lo < h_down + 2 else [])


def band_of(cid: str, cfg: dict, frames: dict, plan_text: str | None = None) -> tuple[tuple[int, int], list[str]]:
    h_r, h_d = height(frames["ready"]), height(frames["down"])
    over = (cfg.get("kneel") or {}).get("band")
    if not over:
        return default_band(h_r, h_d), []
    return (int(over[0]), int(over[1])), override_ok(cid, over, h_d, plan_text if plan_text is not None else
                                                     (PLAN.read_text() if PLAN.exists() else ""))


def rot_check(name: str, rots: dict) -> list[str]:
    """K-rot (D-K19): limbs <= 100 deg in the key, <= 40 in kneel_in1 / kneel_in2, other parts <= ROT_CAP."""
    lim_limb = KEY_LIMB_CAP if name == "kneel" else TWEEN_LIMB_CAP
    bad = [f"{p} {d:.1f} deg" for p, d in sorted(rots.items())
           if abs(d) > (lim_limb if p in KR.LIMBS else ROT_CAP[PART_KIND.get(p, "rigid")])]
    return [f"{name}: K-rot {', '.join(bad)}"] if bad else []


def frame_checks(name: str, img: Image.Image, ready: Image.Image, bottom: int, palette: set,
                 ring_ref: Image.Image | None = None) -> list[str]:
    """K-ground, K-fit, binary alpha, palette, magenta, pieces <= 2, ring within 0.08 of ready. The bottom-2-rows
    contact rule applies to the held frames (kneel, kneel_b); the 4-frame transitions only touch the ground row."""
    from gen.pixelize import components
    a = np.asarray(img)
    solid = a[..., 3] > 0
    out = []
    rows = np.where(solid.any(1))[0]
    if not len(rows) or int(rows.max()) != bottom:
        out.append(f"{name}: K-ground lowest row {int(rows.max()) if len(rows) else None} != {bottom}")
    ra = np.asarray(ready)[..., 3] > 0
    if name in HELD and solid[bottom - 1:bottom + 1].sum() < 0.5 * ra[bottom - 1:bottom + 1].sum():
        out.append(f"{name}: K-ground bottom 2 rows {int(solid[bottom - 1:bottom + 1].sum())} px < half of ready's")
    if solid[bottom + 1:].any() or solid[0].any() or solid[:, 0].any() or solid[:, -1].any():
        out.append(f"{name}: K-fit pixels in the bottom margin or on the cell border")
    if not np.isin(a[..., 3], (0, 255)).all():
        out.append(f"{name}: alpha not binary")
    cols = {tuple(int(v) for v in c) for c in a[solid][:, :3]}
    if cols - palette:
        out.append(f"{name}: {len(cols - palette)} colours outside the source palette")
    if any(c[0] > 200 and c[2] > 200 and c[1] < 80 for c in cols):
        out.append(f"{name}: magenta pixels")
    n = components(solid)[1]
    if n > 2:
        out.append(f"{name}: {n} pieces > 2")
    ring, ring_r = PU._second_ring(img), PU._second_ring(ring_ref or ready)   # KT: a key-drawn frame vs the key
    if abs(ring - ring_r) > 0.08:
        out.append(f"{name}: ring {ring:.2f} not within 0.08 of ready {ring_r:.2f}")
    return out


def old_columns(cid: str) -> list[str]:
    """The 14 old committed atlas columns of this class equal the approved poses + puppet.py in-betweens (D-K10)."""
    if not ATLAS.with_suffix(".json").exists():
        return []
    meta = json.loads(ATLAS.with_suffix(".json").read_text())
    if cid not in meta["sheets"]:
        return [f"{cid}: not in the committed atlas"]
    sc, (gw, gh) = meta["scale"], meta["cell"]
    atlas = np.asarray(Image.open(ATLAS.with_suffix(".png")).convert("RGBA"))[::sc, ::sc]
    frames, tw = PU.battle_sheet_frames(cid), PU.battle_inbetweens(cid)
    row = meta["sheets"][cid]["row"]
    old = [p for p in meta["poses"] if p not in KNEEL_POSES]
    bad = [p for i, p in enumerate(old) if not np.array_equal(
        atlas[row * gh:(row + 1) * gh, i * gw:(i + 1) * gw],
        np.asarray(tw[p] if p in tw else frames[p] if p in frames else frames[PU.SOURCE[p]]))]
    return [f"{cid}: old atlas columns differ: {bad}"] if bad else []


def check_frames(cid: str, cfg: dict, frames: dict, bottom: int, plan_text: str | None = None):
    """(failures, info, made); info has the heights, the ratio and the band."""
    made = make(cfg, frames, bottom, cid)
    (lo, hi), fails = band_of(cid, cfg, frames, plan_text)
    palette = {tuple(int(v) for v in c) for f in frames.values()
               for c in np.asarray(f)[np.asarray(f)[..., 3] > 0][:, :3]}
    palette.add(tuple(PU.OUTLINE))
    if (cfg.get("kneel") or {}).get("source") == "user":   # pass CB: the key and the battle cells share one render's
        import json                                       # palette (hero_user.py), recorded in the key's json
        meta = json.loads((PU.APPROVED / cid / "battle_kneel.json").read_text())
        palette |= {tuple(int(v) for v in dst) for _, dst in meta["cut"]["palette"]}
    hr, hk = height(frames["ready"]), height(made["kneel"][0])
    for n in KNEEL_POSES:
        img, rots, _ = made[n]
        ref = made["kneel"][0] if is_ai(cfg) and n != "kneel_in1" else None          # D-KT4: drawn from the key
        fails += frame_checks(n, img, frames["ready"], bottom, palette, ref) + rot_check(n, rots)
        h = height(img)
        if n in HELD and not lo <= h <= hi and not is_ai(cfg):   # D-KT4: an AI key's band is reported only
            fails.append(f"{n}: K-height {h} outside the band {lo}-{hi}")
        if n not in HELD and not min(hr, hk) - 1 <= h <= max(hr, hk) + 1:
            fails.append(f"{n}: K-height {h} not between kneel {hk} and ready {hr}")
    info = {"ready": hr, "down": height(frames["down"]), "kneel": hk, "kneel_b": height(made["kneel_b"][0]),
            "band": (lo, hi), "ratio": round(hk / hr, 3), "rots": made["kneel"][1]}
    return fails, info, made


def lock_path(cid: str) -> Path:
    return PU.ANIM / f"{cid}.lock.json"


def _summary(info: dict) -> str:
    return f"kneel {info['kneel']} / ready {info['ready']} = {info['ratio']}, kneel_b {info['kneel_b']}, " \
           f"band {info['band'][0]}-{info['band'][1]}, down {info['down']}"


def check(cid: str) -> bool:
    cfg = PU.load_cfg(cid)
    if not cfg or not cfg.get("kneel"):
        print(f"{cid}: OK (no kneel block; the kneel columns repeat ready)")
        return True
    fails, info, made = check_frames(cid, cfg, PU.battle_sheet_frames(cid), bottom_row(cid))
    fails = old_columns(cid) + fails
    tag = ""
    if lock_path(cid).exists():
        fails += lock_match({n: np.asarray(made[n][0]) for n in KNEEL_POSES}, json.loads(lock_path(cid).read_text()))
    else:
        tag = " (unlocked)"
    print(f"{cid}: " + (f"OK{tag} [{_summary(info)}]" if not fails else "FAIL " + "; ".join(fails)))
    return not fails


def lock(cid: str) -> bool:
    cfg = PU.load_cfg(cid)
    if not cfg or not cfg.get("kneel"):
        print(f"{cid}: no kneel block, nothing to lock")
        return False
    fails, _, made = check_frames(cid, cfg, PU.battle_sheet_frames(cid), bottom_row(cid))
    fails = old_columns(cid) + fails
    if fails:
        print(f"{cid}: not locked: " + "; ".join(fails))
        return False
    lock_path(cid).write_text(json.dumps({n: frame_hash(np.asarray(made[n][0])) for n in sorted(KNEEL_POSES)},
                                         indent=2) + "\n")
    print(f"{cid}: locked -> {lock_path(cid).relative_to(ROOT)}")
    return True


# in 8f, 2 sway cycles, out 6f, stand 24f (60 fps; docs/KNEEL_PLAN.md section 8)
GIF_TRACK = [("kneel_in1", 4), ("kneel_in2", 4)] + [("kneel", 48), ("kneel_b", 48)] * 2 + \
            [("kneel_in2", 3), ("kneel_in1", 3), ("ready", 24)]


def review(cid: str, out: Path = REVIEW) -> bool:
    from gen.puppet_kneel_review import write_review
    cfg = PU.load_cfg(cid)
    if not cfg or not cfg.get("kneel"):
        print(f"{cid}: no kneel block")
        return False
    frames = PU.battle_sheet_frames(cid)
    fails, info, made = check_frames(cid, cfg, frames, bottom_row(cid))
    out.mkdir(parents=True, exist_ok=True)
    write_review(cid, "A", frames, {n: made[n][0] for n in KNEEL_POSES}, info, bottom_row(cid), out, GIF_TRACK)
    print(f"{cid}: " + ("OK" if not fails else "FAIL " + "; ".join(fails)) + f" [{_summary(info)}] -> {out}")
    return not fails


def selftest(check) -> None:  # noqa: F811 - `check` is the selftest's check(cond, msg)
    from gen.puppet_kneel_selftest import run
    run(check)


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("review", "check", "lock"):
        print(__doc__)
        return 2
    ids = argv[2:] or sorted(p.stem for p in PU.ANIM.glob("*.yaml") if (PU.load_cfg(p.stem) or {}).get("kneel"))
    fn = {"review": review, "check": check, "lock": lock}[argv[1]]
    return 0 if all([fn(cid) for cid in ids]) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

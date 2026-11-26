"""Selftest of pass HF's facing fix (puppet_facing.py, docs/HERO_FACING_PLAN.md): synthetic cells and the real heroes."""
from __future__ import annotations

import json

import numpy as np

OUT = (6, 4, 10)


def _cell() -> np.ndarray:
    """A 40x40 'figure': a body block, a head with a light face on its right and a tail to the left."""
    a = np.zeros((40, 40, 4), np.uint8)
    a[20:38, 12:26] = (*OUT, 255)
    a[21:37, 13:25] = (90, 60, 40, 255)
    a[6:20, 14:24] = (*OUT, 255)
    a[7:19, 15:23] = (40, 40, 60, 255)
    a[10:14, 19:23] = (230, 180, 120, 255)       # face, right side
    a[9:11, 6:15] = (*OUT, 255)                  # tail, left side
    return a


def _raises(fn) -> bool:
    try:
        fn()
    except ValueError:
        return True
    return False


def run_facing(check) -> None:
    from gen import puppet as PU
    from gen import puppet_facing as PF
    a = _cell()
    poses = ["ready", "hurt"]
    # figure mirror: exact reflection about the visual centre, rows kept
    s = PF.figure_sum(a)
    m = PF.mirror_figure(a)
    mean = lambda c: float(np.nonzero(c[..., 3] > 0)[1].mean())   # noqa: E731
    check((m[..., 3] > 0).any(1).tolist() == (a[..., 3] > 0).any(1).tolist() and abs(mean(m) - mean(a)) <= 0.5,
          f"HF figure mirror keeps the rows and the visual centre (S {s}, mean {mean(a):.2f} -> {mean(m):.2f})")
    ys, xs = np.nonzero(a[..., 3] > 0)
    check(np.array_equal(m[ys, s - xs], a[ys, xs]) and (m[..., 3] > 0).sum() == len(xs),
          "HF figure mirror is the exact reflection x' = S - x")
    check(np.array_equal(PF.mirror_figure(m, s), a), "HF figure mirror twice (same S) is the identity")
    edge = np.zeros_like(a)
    edge[10:30, 1:4] = (*OUT, 255)
    edge[10:12, 4:39] = (*OUT, 255)                    # mean far left of the bbox centre: S clamps into the cell
    check(int(np.nonzero(PF.mirror_figure(edge)[..., 3] > 0)[1].max()) <= 38, "HF figure_sum clamps to columns 1..w-2")
    # head mirror: rows outside the box +- 1 untouched, the face moves to the left, palette / alpha kept
    f = {"pose": "ready", "mirror": "head", "box": [4, 5, 30, 20], "sum": 38}
    h, mask = PF.mirror_head(a, f, "ready")
    check(np.array_equal(h[21:], a[21:]) and np.array_equal(h[:4], a[:4]), "HF head mirror leaves the other rows")
    face = np.where((h[10:14, ..., 0] == 230).any(0))[0]
    check(face.max() < 20 and mask.sum() == ((a[5:20, 4:30, 3] > 0).sum()), "HF head mirror moves the face left")
    check(np.isin(h[..., 3], (0, 255)).all(), "HF head mirror keeps binary alpha")
    # validation (fail closed)
    meta = {"poses": poses}
    check(_raises(lambda: PF.entries({**meta, "facing_fix": [{"pose": "kneel", "mirror": "figure"}]})),
          "HF refuses a pose not in poses")
    check(_raises(lambda: PF.entries({**meta, "facing_fix": [{"pose": "hurt", "mirror": "flip"}]})),
          "HF refuses an unknown mirror")
    check(_raises(lambda: PF.entries({**meta, "facing_fix": [{"pose": "hurt", "mirror": "figure", "sum": 3}]})),
          "HF refuses a figure entry with a sum")
    check(_raises(lambda: PF.entries({**meta, "facing_fix": [{"pose": "ready", "mirror": "head", "box": [0, 0, 1, 1],
                                                              "sum": 1.5}]})), "HF refuses a non-integer sum")
    check(_raises(lambda: PF.entries({**meta, "facing_fix": [{"pose": "hurt", "mirror": "figure"},
                                                             {"pose": "hurt", "mirror": "figure"}]})),
          "HF refuses two entries for one pose")
    check(_raises(lambda: PF.mirror_head(a, {**f, "sum": 70}, "ready")), "HF refuses a head reflected off the cell")
    tail = {"pose": "ready", "mirror": "head", "box": [4, 9, 14, 11], "sum": 44}   # the tail lands off the head
    check(_raises(lambda: PF.mirror_head(a, tail, "ready")), "HF refuses a head mirror that adds a piece")
    # joints: x' = sum - x and n <-> f
    j = PF.mirror_joints({"neck": (40.0, 20.0), "sh_n": (30.0, 25.0), "sh_f": (50.0, 25.0), "weapon_hand": "n",
                          "cape_behind": False}, 80)
    check(j["sh_n"] == (30.0, 25.0) and j["sh_f"] == (50.0, 25.0) and j["neck"] == (40.0, 20.0)
          and j["weapon_hand"] == "f", "HF joint mirror reflects and swaps n / f")
    check(PF.swap_z(["uarm_f", "torso", "farm_n"]) == ["uarm_n", "torso", "farm_f"], "HF swap_z exchanges n and f")
    # the real heroes: the joint mirror uses the pixel mirror's sum, the in-betweens keep n on the screen left
    for cid in ("ninja", "black_mage", "white_mage"):
        meta = json.loads((PU.APPROVED / cid / "battle.json").read_text())
        raw = PU.battle_sheet_frames(cid, facing=False)["cast"]
        fixed = PU.battle_sheet_frames(cid)["cast"]
        s = PF.figure_sum(np.asarray(raw))
        ry, rx = np.nonzero(np.asarray(raw)[..., 3] > 0)
        check(np.array_equal(np.asarray(fixed)[ry, s - rx], np.asarray(raw)[ry, rx])
              and any(e["pose"] == "cast" for e in PF.entries(meta)),
              f"HF {cid}: the cast cell is the approved cast reflected with the joints' sum {s}")
        cfg = PU.load_cfg(cid)
        c = cfg["battle"]["cast"]
        check(cfg.get("mirrored") == ["cast"] and c["sh_n"][0] < c["sh_f"][0] and c["hip_n"][0] < c["hip_f"][0],
              f"HF {cid}: mirrored cast joints keep n on the screen left")
    kn = np.asarray(PU.battle_sheet_frames("knight", facing=False)["hurt"])
    kf = np.asarray(PU.battle_sheet_frames("knight")["hurt"])
    check(abs(mean(kf) - mean(kn)) <= 0.5, "HF knight (with a face_fix): the hurt mirror keeps the visual centre")
    check(PU.load_cfg("white_mage").get("cast_hand") == "f", "HF white_mage: cast_hand follows the swap (n -> f)")
    check(PU.load_cfg("monk").get("mirrored") is None, "HF monk: no keyframe mirrored")

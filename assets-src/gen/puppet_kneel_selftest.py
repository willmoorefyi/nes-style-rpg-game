"""Selftests of the hero kneel (docs/KNEEL_PLAN.md section 7, heroes), run through `puppet_kneel.selftest(check)`
(called by selftest_kneel.py): variant A on synthetic robed and unrobed puppets, opt-in only, the 14 old columns
identical, the K-check failure cases, a band override without a section 13 entry refused, and determinism."""
# R3 = A (user): variant B is not built, so it has no selftest.
from __future__ import annotations

import copy

import numpy as np
from PIL import Image, ImageDraw

from gen import puppet as PU
from gen import puppet_kneel as PK
from gen.anim_rules import frame_hash, lock_match

BOTTOM = 76
JOINTS = {"neck": (40, 30), "crown": (40, 10), "chest": (41, 36), "hip": (41, 54),
          "sh_n": (34, 36), "el_n": (28, 43), "hand_n": (21, 40), "sh_f": (48, 36), "el_f": (52, 44),
          "hand_f": (47, 48), "hip_n": (37, 54), "knee_n": (33, 63), "foot_n": (30, 72),
          "hip_f": (45, 54), "knee_f": (48, 63), "foot_f": (52, 72)}
SKIN, CLOTH, LEG, BOOT, ROBE = (232, 184, 136), (176, 48, 48), (80, 72, 96), (120, 80, 40), (224, 224, 216)


def _outlined(im: Image.Image) -> Image.Image:
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = PU._grow(solid) & ~solid
    a[ring, :3], a[ring, 3] = PU.OUTLINE, 255
    return Image.fromarray(a, "RGBA")


def puppet(robed: bool) -> tuple[dict, dict]:
    """(cfg, frames) of a synthetic hero facing left: head, torso, two arms, legs or a robe; feet on row 76."""
    J = JOINTS
    im = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if robed:
        d.polygon([(33, 40), (49, 40), (55, 74), (27, 74)], fill=ROBE + (255,))
        d.rectangle([26, 72, 33, 75], fill=BOOT + (255,))
        d.rectangle([49, 72, 56, 75], fill=BOOT + (255,))
    else:
        for s in ("n", "f"):
            d.line([J[f"hip_{s}"], J[f"knee_{s}"], J[f"foot_{s}"]], fill=LEG + (255,), width=6)
            d.rectangle([J[f"foot_{s}"][0] - 4, 71, J[f"foot_{s}"][0] + 4, 75], fill=BOOT + (255,))
    d.rectangle([34, 30, 48, 56], fill=CLOTH + (255,))
    for s in ("f", "n"):
        d.line([J[f"sh_{s}"], J[f"el_{s}"], J[f"hand_{s}"]], fill=SKIN + (255,), width=5)
    d.ellipse([31, 9, 49, 30], fill=SKIN + (255,))
    ready = _outlined(im)
    down = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    down.paste(ready.resize((80, 40), Image.Resampling.NEAREST), (0, 37))
    cfg = {"robed": robed, "front_far_arm": {"ready": True}, "battle": {"ready": dict(J)},
           "kneel": {"arms": [] if robed else ["n"]}}
    return cfg, {"ready": ready, "down": down}


def run(check) -> None:
    print("kneel (heroes, puppet_kneel.py):")
    for robed in (False, True):
        cfg, frames = puppet(robed)
        made = PK.make(cfg, frames, BOTTOM)
        tag = "robed" if robed else "unrobed"
        check(sorted(made) == sorted(PK.KNEEL_POSES), f"{tag} puppet: variant A makes the 4 kneel frames")
        fails = [f for n in PK.KNEEL_POSES for f in PK.frame_checks(n, made[n][0], frames["ready"], BOTTOM,
                                                                     {PU.OUTLINE, SKIN, CLOTH, LEG, BOOT, ROBE})
                 + PK.rot_check(n, made[n][1]) if f.split(": ", 1)[1].startswith(("K-ground lowest", "K-fit", "K-rot"))]
        check(not fails, f"{tag} puppet: on the ground row, K-fit and K-rot pass on every kneel frame {fails}")
        hr, hk = PK.height(frames["ready"]), PK.height(made["kneel"][0])
        check(hk < hr and hk <= PK.height(made["kneel_in2"][0]) <= PK.height(made["kneel_in1"][0]) <= hr,
              f"{tag} puppet: heights fall ready {hr} >= in1 >= in2 >= kneel {hk}")
        again = PK.make(copy.deepcopy(cfg), frames, BOTTOM)
        check(all(frame_hash(np.asarray(made[n][0])) == frame_hash(np.asarray(again[n][0])) for n in PK.KNEEL_POSES),
              f"{tag} puppet: deterministic")
    cfg, frames = puppet(False)
    made = PK.make(cfg, frames, BOTTOM)
    check(made["kneel_in2"][2] == "kneel" and made["kneel_in1"][2] == "ready",
          "unrobed: kneel_in1 is cut from ready, kneel_in2 from the derived kneel key (near-keyframe)")
    # failure cases
    key = np.asarray(made["kneel"][0])
    lifted = Image.fromarray(np.concatenate([key[1:], key[:1] * 0]), "RGBA")
    pal = {tuple(int(v) for v in c) for c in key[key[..., 3] > 0][:, :3]}
    check(any("K-ground" in f for f in PK.frame_checks("kneel", lifted, frames["ready"], BOTTOM, pal)),
          "K-ground fails a 1 px lift")
    check(bool(PK.rot_check("kneel", {"thigh_n": 101.0})) and not PK.rot_check("kneel", {"thigh_n": 99.0}),
          "K-rot fails a 101 deg key limb, passes 99")
    check(bool(PK.rot_check("kneel_in1", {"shin_f": 41.0})) and not PK.rot_check("kneel_in2", {"shin_f": 39.0}),
          "K-rot fails a 41 deg in-between limb, passes 39")
    check(bool(PK.rot_check("kneel", {"torso": 21.0})), "K-rot keeps ROT_CAP for non-limb parts (torso 21 deg)")
    lock = {n: frame_hash(np.asarray(made[n][0])) for n in PK.KNEEL_POSES}
    check(not lock_match({n: np.asarray(made[n][0]) for n in PK.KNEEL_POSES}, lock), "K-lock: the lock matches")
    check(bool(lock_match({**{n: np.asarray(made[n][0]) for n in PK.KNEEL_POSES}, "kneel": np.asarray(lifted)}, lock)),
          "K-lock fails a changed kneel frame")
    hb = PK.height(frames["down"])
    (lo, hi), _ = PK.band_of("synthetic", cfg, frames, "")
    cfg2 = copy.deepcopy(cfg)
    cfg2["kneel"]["band"] = [lo - 1, hi]
    _, why = PK.band_of("synthetic", cfg2, frames, "## 13. Rulings\n| date | item | change |\n")
    check(bool(why), "a band override with no section 13 entry is refused")
    plan = f"## 13. Rulings\n| 2026-11-17 | synthetic band | {lo}-{hi} -> {lo - 1}-{hi}: reason |\n"
    check(not PK.band_of("synthetic", cfg2, frames, plan)[1], "a band override with a section 13 entry is accepted")
    check(bool(PK.override_ok("synthetic", [hb + 1, hi], hb, f"## 13.\n| synthetic | {hb + 1}-{hi} |\n")),
          "a band override below H_down + 2 is refused")
    check(PK.default_band(68, 44) == (49, 59) and PK.default_band(66, 51) == (55, 58),
          "plan section 4 bands: warrior 49-59, white_mage 55-58")
    # opt-in and the old columns
    check(PK.kneel_frames("knight") == {}, "opt-in: a class without a kneel block gets no kneel frames")
    real = PU.load_cfg("warrior")
    if real and real.get("kneel"):
        plain = copy.deepcopy(real)
        plain.pop("kneel")
        a, b = PU.battle_inbetweens("warrior", real), PU.battle_inbetweens("warrior", plain)
        check(sorted(a) == sorted(b) and all(np.array_equal(np.asarray(a[n]), np.asarray(b[n])) for n in a),
              "warrior: the puppet in-betweens are byte-identical with and without the kneel block")
        check(not PK.old_columns("warrior"), "warrior: the 14 committed atlas columns are identical")

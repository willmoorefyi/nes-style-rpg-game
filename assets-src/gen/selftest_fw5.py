"""FW-5 selftests (docs/ROSTER_PLAN.md 5.4), each RED first against the pre-FW-5 rig (no such parts / sets / checks):
biped wings (`wsh -> wel -> wtip`), extra biped arm pairs (`n2 f2 n3 f3`), multi-head quadruped neck lists (`neck<i>
head<i> snout<i>`, i = 2..5; the symbolic `head` becomes a list; non-lead heads lag in atk_* frames) and the
`preset: mechanical` rules. Optional parts appear only when a rig marks their joints, so no existing rig changes (the
real rigs are checked too: only the FW-5 prototypes use them)."""
from __future__ import annotations

from typing import Callable

import yaml

BIPED = {"crown": [40, 10], "neck": [40, 25], "chest": [40, 32], "hip": [40, 48], "sh_n": [46, 32], "el_n": [50, 40],
         "hand_n": [54, 46], "sh_f": [34, 32], "el_f": [30, 40], "hand_f": [26, 46], "hip_n": [44, 50],
         "knee_n": [46, 62], "foot_n": [47, 76], "hip_f": [36, 50], "knee_f": [34, 62], "foot_f": [33, 76],
         "tip": [60, 40]}
WINGS = {"wsh_n": [44, 28], "wel_n": [52, 12], "wtip_n": [66, 22], "wsh_f": [36, 28], "wel_f": [28, 12], "wtip_f": [14, 22]}
ARMS2 = {"sh_n2": [46, 40], "el_n2": [52, 46], "hand_n2": [58, 50], "sh_f2": [34, 40], "el_f2": [28, 46], "hand_f2": [22, 50]}
QUAD = {"hip": [20, 50], "back": [35, 45], "chest": [50, 45], "neck": [58, 30], "head": [62, 18], "snout": [72, 20],
        "sh_n": [52, 52], "el_n": [53, 64], "paw_n": [53, 74], "sh_f": [48, 52], "el_f": [47, 64], "paw_f": [47, 74],
        "hip_n": [22, 54], "knee_n": [24, 64], "foot_n": [22, 74], "hip_f": [18, 54], "knee_f": [16, 64], "foot_f": [14, 74]}
HEADS = {"neck2": [52, 28], "head2": [50, 14], "snout2": [60, 12], "neck3": [62, 38], "head3": [70, 34], "snout3": [78, 36]}
PROTOTYPES = {"gargoyle", "hydra", "fire_hydra", "warmech", "chaos", "hellhound",  # hellhound: second head (head2)
              "soldier", "guardian", "iron_golem", "chimera", "rhyos",  # batch D: mechanical preset (soldier, guardian, iron_golem), extra heads (chimera, rhyos)
              "horned_devil"}  # T-K (fix pass 2 G5): optional wing parts uwing_f / fwing_f (the hurt's far wing is its own part)


def _cfg(body: str, idle: dict, **kw) -> dict:
    return {"sprite": "fw5_test", "body": body, "keyframes": {"idle": dict(idle), "attack": dict(idle)}, **kw}


def run_fw5(check: Callable[[bool, str], None]) -> None:
    from gen import anim_rules as AR, monster_anim as MA, monster_render as MR, rig as R
    plain = R.Rig(_cfg("biped", BIPED), (80, 80))
    check(not plain.optional and set(plain.parts) == set(R.BIPED_PARTS),
          "FW-5: a biped that marks no optional joint has exactly the template parts")

    winged = R.Rig(_cfg("biped", {**BIPED, **WINGS}), (80, 80))
    wings = {"uwing_n", "fwing_n", "uwing_f", "fwing_f"}
    check(wings <= set(winged.parts) and winged.parent["wsh_n"] == "chest" and winged.parent["wtip_f"] == "wel_f",
          "FW-5 wings: wsh -> wel -> wtip from chest give uwing_* / fwing_* parts")
    z = winged.z_for("idle")
    check(max(z.index(w) for w in wings) < z.index("torso"), "FW-5 wings: drawn behind the body")
    for rec in ("wind", "follow", "cast"):
        moves, _ = MA._joint_sets(winged, "atk_wind1", {"moves": rec, "pins": "legs"}, {})
        check({"wsh_n", "wel_n", "wtip_n", "wtip_f"} <= set(moves), f"FW-5 wings: the wing joints join the {rec} set")

    four = R.Rig(_cfg("biped", {**BIPED, **ARMS2}), (80, 80))
    check({"uarm_n2", "farm_n2", "uarm_f2", "farm_f2"} <= set(four.parts) and four.arms[:4] == ("n", "f", "n2", "f2"),
          f"FW-5 arms: n2 / f2 arm pairs are parts and join the arm list ({four.arms})")
    z = four.z_for("idle")
    check(z.index("farm_f2") < z.index("torso") < z.index("uarm_n2") < z.index("uarm_n"),
          "FW-5 arms: far pairs behind the torso, near pairs in front (before the n arm)")
    cast, _ = MA._joint_sets(four, "cast_gather", {"moves": "cast", "pins": "feet"}, {})
    wind, _ = MA._joint_sets(four, "atk_wind1", {"moves": "wind", "pins": "legs"}, {"attack_hand": ["n", "n2"]})
    check("hand_f2" in cast and "hand_n2" in wind and "hand_f2" not in wind,
          "FW-5 arms: the cast set holds every arm, attack_hand [n, n2] picks the wind arms")

    q1 = R.Rig(_cfg("quadruped", QUAD), (80, 80))
    q3 = R.Rig(_cfg("quadruped", {**QUAD, **HEADS}), (80, 80))
    check(q1.head == ("head", "snout") and not q1.lag, "FW-5 heads: one head = the template's symbolic head, no lag")
    check({"neck2", "head2", "neck3", "head3"} <= set(q3.parts) and q3.parts["neck2"]["kind"] == "chain",
          "FW-5 heads: neck<i> chain and head<i> rigid parts for every marked head")
    check(q3.head == ("head", "snout", "head2", "snout2", "head3", "snout3"),
          f"FW-5 heads: the symbolic head resolves to every head ({q3.head})")
    hm = MA.half_joints(q3, "atk_wind2", {})
    rest = MA.half_joints(q3, "atk_mid", {}) | MA.half_joints(q3, "hurt_in1", {})
    check({"neck2", "head2", "snout2", "head3"} <= hm and "head" not in hm and not (rest & {"head2", "head3"}),
          "FW-5 heads: the non-lead heads lag (half t) in the wind-up only; they strike and recoil with the lead")
    lead2 = R.Rig(_cfg("quadruped", {**QUAD, **HEADS}, lead_heads=[1, 2]), (80, 80))
    check("head2" not in lead2.lag and "head3" in lead2.lag, "FW-5 heads: lead_heads [1, 2] makes head 2 lead too")
    check(all({"neck2", "head2", "snout2"} <= set(v) for v in q3.moves.values()),
          "FW-5 heads: every recipe set moves the extra heads")
    tw = MA._tweaks({"head": [1, 1]}, None, q3.head)
    check(all(tw.get(j) == [1, 1] for j in q3.head), "FW-5 heads: the daze slump drops every head")

    def refused(cfg) -> bool:
        try:
            R.Rig(cfg, (80, 80))
        except ValueError as e:
            return "mechanical" in str(e) or "preset" in str(e)
        return False
    check(refused(_cfg("biped", BIPED, preset="mechanical", parts={"cape": {"bone": ["neck", "hip"], "kind": "cloth"}})),
          "FW-5 mechanical: a cloth part is refused")
    check(refused(_cfg("biped", BIPED, preset="mechanical", sampler="rotsprite")) and
          refused(_cfg("biped", BIPED, preset="mechanical", frames={"atk_mid": {"sampler": "rotsprite"}})) and
          refused(_cfg("biped", BIPED, preset="robot")), "FW-5 mechanical: rotsprite and unknown presets are refused")
    mech = R.Rig(_cfg("biped", BIPED, preset="mechanical"), (80, 80))
    check(mech.rot_cap == R.MECH_CAP == 15.0 and plain.rot_cap is None, "FW-5 mechanical: the rotation cap is 15 deg")
    rots = {"farm_n": (20.0, "rigid"), "torso": (12.0, "torso")}
    check(not AR.rotation_cap(rots) and AR.rotation_cap(rots, mech.rot_cap) and "farm_n" in AR.rotation_cap(rots, 15.0)[0],
          "FW-5 mechanical: a 20 deg rigid turn passes the normal cap and fails the preset's")
    try:
        MR.frame_options(mech, "atk_mid", {"sampler": "rotsprite"})
        ok = False
    except ValueError:
        ok = True
    check(ok, "FW-5 mechanical: frame_options refuses a rotsprite frame")

    users = {}
    for p in sorted(MA.RIGS.glob("*.yaml")):
        cfg = yaml.safe_load(p.read_text()) or {}
        size = (80, 80)
        try:
            rig = R.Rig(cfg, size)
        except ValueError:
            continue
        if rig.optional or rig.preset:
            users[p.stem] = rig.optional
    check(set(users) <= PROTOTYPES, f"FW-5: only the prototypes use optional parts or a preset ({sorted(users)})")

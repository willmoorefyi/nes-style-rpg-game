"""Monster in-between tables (docs/ENEMY_ANIM_PLAN.md 3.1, docs/FEEDBACK_PLAN_2026-11-14.md 3.5 / 3.7): frame lists,
pixel sources, runtime sequences, keyframe spans and the recipes monster_anim.generate turns into frames. Pure data
plus small lookups; no imports from the rest of the pipeline.
"""
from __future__ import annotations

# approved keyframes (bosses add `cast` and, pass F, `attack_raise`: the heavy attack's raised hold)
KEYFRAMES = ("idle", "attack", "hurt", "cast", "attack_raise")
MONSTER_FRAMES = ["idle", "idle_b", "atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover",
                  "hurt_in1", "hurt_in2", "hurt", "daze", "daze_b"]
BOSS_FRAMES = MONSTER_FRAMES + ["cast_gather", "cast_rise", "cast", "cast_release"]
RAISE_FRAMES = ["attack_raise", "atk_raise_in", "atk_raise_b", "atk_swing", "atk_swing2"]
FRAME_SOURCE = {"idle_b": "idle", "atk_wind1": "idle", "atk_wind2": "idle", "atk_mid": "attack", "atk_follow": "attack",
                "atk_recover": "idle", "hurt_in1": "idle", "hurt_in2": "hurt", "cast_gather": "idle", "cast_rise": "cast",
                "cast_release": "cast", "daze": "idle", "daze_b": "idle", "atk_raise_in": "idle",
                "atk_raise_b": "attack_raise", "atk_swing": "attack_raise", "atk_swing2": "attack"}
# what a held (or missing) frame shows instead, followed until a frame exists (src/scenes/battle/enemyChoreography.ts
# FRAME_FALLBACK): a held daze shows the hurt_in1 flinch, daze_b then shows daze
FALLBACK = {**FRAME_SOURCE, "daze": "hurt_in1", "daze_b": "daze", "atk_raise_in": "atk_wind1", "atk_swing": "atk_mid",
            "atk_swing2": "atk_mid"}               # a held heavy frame shows the plain attack's (as the TS chain)
# runtime orders checked for continuity (monster_check.check_sprite); a pair's span is the keyframes around it
SEQUENCES = {"attack": ["idle", "atk_wind1", "atk_wind2", "atk_mid", "attack", "atk_follow", "atk_recover", "idle"],
             "hurt": ["idle", "hurt_in1", "hurt_in2", "hurt"],
             "cast": ["idle", "cast_gather", "cast_rise", "cast", "cast_release"],
             "daze": ["idle", "daze", "daze_b"],
             "heavy": ["idle", "atk_raise_in", "attack_raise", "atk_raise_b", "attack_raise", "atk_swing", "atk_swing2",
                       "attack", "atk_follow", "atk_recover", "idle"]}
# keyframe each sequence needs (skipped without it) and its default span
NEEDS = {"cast": "cast", "heavy": "attack_raise"}
SPAN = {"attack": ("idle", "attack"), "hurt": ("idle", "hurt"), "cast": ("idle", "cast"), "daze": ("idle", "hurt"),
        "heavy": ("idle", "attack_raise")}
ARM = ("sh_{h}", "el_{h}", "hand_{h}")
HEAD = "head"                                              # symbolic recipe joint, resolved per body template
# frame -> pixel source, toward, t (table 3.1 terms; `over` = overshoot of toward->src), moves, pins, body_dy, tweaks
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
    # item 5a: the dazed pose (sleep, stun): head and upper body slump a little toward the hurt flinch, knees and feet
    # pinned; daze_b sways 1 px lower. dy and the head tweak are px per 80 px of cell height (`cell_scale`). The plan's
    # draft (t 0.25, moves all, feet pins, dy 2 / 3, head [1, 2]) failed 9 of 12 rigs (35% arm swings over the 30 deg
    # cap, IK-bent shins under the plain, a 5 px drop out of the 80 px bbox band), so the sweep-tuned one ships.
    "daze": {"src": "idle", "toward": "hurt", "t": 0.15, "moves": "wind", "pins": "legs", "dy": 1,
             "tweaks": {HEAD: [1, 1]}, "cell_scale": True},
    "daze_b": {"src": "idle", "toward": "hurt", "t": 0.15, "moves": "wind", "pins": "legs", "dy": 2,
               "tweaks": {HEAD: [1, 1]}, "cell_scale": True},
    # item 7: the heavy attack around the approved attack_raise key (bosses)
    "atk_raise_in": {"src": "idle", "toward": "attack_raise", "t": 0.35, "moves": "all", "pins": "legs"},
    # the trembling hold: the raise with everything above the breath joint's row 1 px down (an idle_b-style bob, no part
    # cut: a 1 px part move tore the lich's leather); `frames.atk_raise_b.bob: false` cuts it with this recipe instead
    "atk_raise_b": {"src": "attack_raise", "toward": "attack_raise", "t": 0.0, "moves": "all", "pins": "legs", "dy": 1,
                    "bob": True},
    "atk_swing": {"src": "attack_raise", "toward": "attack", "t": 0.35, "moves": "all", "pins": "feet"},
    "atk_swing2": {"src": "attack", "toward": "attack_raise", "t": 0.35, "moves": "all", "pins": "planted"},
}

# FW-6: a tweaked idle_b (frames.idle_b.tweaks, 1 px cap) is a rig frame at t 0 from idle, then the body's idle_b op
IDLE_B = {"src": "idle", "toward": "idle", "t": 0.0, "moves": "wind", "pins": "feet"}


def frames_for(has_cast: bool, has_raise: bool = False) -> list[str]:
    return (BOSS_FRAMES if has_cast else MONSTER_FRAMES) + (RAISE_FRAMES if has_raise else [])


def generated_names(has_cast: bool, has_raise: bool = False) -> list[str]:
    return [f for f in frames_for(has_cast, has_raise) if f not in KEYFRAMES]


def held(holds) -> set[str]:
    """Frames a rig's `holds` alias (a held daze takes daze_b with it: both show the hurt_in1 flinch)."""
    out = {h["frame"] for h in holds or []}
    return out | ({"daze_b"} if "daze" in out else set())


def resolve(name: str, have) -> str:
    """The first frame along FALLBACK from `name` that is in `have` (a keyframe maps to itself)."""
    seen = set()
    while name not in have and name not in seen:
        seen.add(name)
        name = FALLBACK.get(name, name)
    return name


def span_of(seq: str, i: int) -> tuple[str, str]:
    """Keyframe pair around the step SEQUENCES[seq][i] -> [i + 1]: the last keyframe at or before it and the first one
    at or after the next frame, or the sequence's SPAN when either side has none."""
    names = SEQUENCES[seq]
    before = next((n for n in reversed(names[:i + 1]) if n in KEYFRAMES), None)
    after = next((n for n in names[i + 1:] if n in KEYFRAMES), None)
    return (before, after) if before and after and before != after else SPAN[seq]


def head_joints(js: tuple, body: str, sprite: str, idle: dict) -> tuple[str, ...]:
    """The joints the symbolic `head` stands for in this rig (`js` = rig.BODY[body]['head']); a rig whose idle keyframe
    lacks one of them is an error naming the rig, never skipped."""
    js = tuple(js or ())
    missing = [j for j in js if j not in idle] or ([] if js else ["(none for this body)"])
    if missing:
        raise ValueError(f"rig {sprite}: no head joint {missing} in the idle keyframe (body {body}, head = {list(js)})")
    return js

"""EF-J (docs/ENEMY_FEEDBACK_PLAN.md): a rig's orbs fall to the ground when it kneels. A rig option `kneel_orbs`
(beside EF-D's `orbit`, which gives the idle orb masks) cuts the orbs out of the idle and the AI kneel key, runs the
kneel bridge on the clean bodies, and pastes the orbs back: part-way down in kneel_in1 (the idle orbs, `fall[0]` of the
way) and kneel_in2 (the key orbs, `fall[1]`), on the ground beside the figure in the kneel key cell and kneel_b. No AI
and no resampling: an orb keeps its own pixels and moves by whole px; the out (in2, in1) plays the fall upward.

  kneel_orbs:
    fall: [0.3, 0.72]              # share of the way down in kneel_in1 / kneel_in2 (0 < f1 < f2 < 1)
    rest: {white: 11, ...}         # ground spot per orb: its bottom-centre x; its lowest row on the feet row
    shadow: true                   # a 1 px contact line (SHADOW, in the palette) beside each resting orb's foot
    parts:                         # the orbs in the AI key: a circle, optionally `colors` (as monster_orbit) and
      white: {at: [100, 70.5], r: 9.5, piece: true}   # `piece` (only the 4-connected piece holding most of the circle)

An orb's position in a frame: its source bottom-centre (mask bbox x centre, lowest row) moved f of the way to its
ground spot (rest x, feet row). The feet row is the idle's lowest opaque row. Orbs are drawn in front of the body.
Checks (frame_checks, detached): each orb's px equal its source px moved by its d; the frame outside the orb and shadow
px equals the clean bridge frame; no two orbs overlap; in the hold every orb's lowest row is the feet row and at most
COVER_CAP of it covers the body; the bridge `detached` rule is judged on the body (the orbs' pieces allowed).
"""
from __future__ import annotations

import math

import numpy as np

from gen import anim_checks as C
from gen import monster_orbit as MO
from gen.pixelize import components

SHADOW = (41, 41, 49)           # chaos's dark grey (idle, attack and kneel all use it)
COVER_CAP = 0.35                # share of a resting orb's px that may cover the body


def _round(v: float) -> int:
    return int(math.floor(v + 0.5))


def cfg_of(sid: str, cfg: dict | None) -> dict | None:
    """The validated `kneel_orbs` block, or None."""
    o = (cfg or {}).get("kneel_orbs")
    if not o:
        return None
    from gen import kneel as KN
    if not KN.is_ai(cfg):
        raise ValueError(f"rig {sid}: kneel_orbs needs kneel: {{source: ai}}")
    if not (cfg.get("orbit") or {}).get("parts"):
        raise ValueError(f"rig {sid}: kneel_orbs needs the idle orb masks of `orbit`")
    names = set(cfg["orbit"]["parts"])
    if set(o.get("parts") or {}) != names or set(o.get("rest") or {}) != names:
        raise ValueError(f"rig {sid}: kneel_orbs parts / rest names {sorted(o.get('parts') or {})} / "
                         f"{sorted(o.get('rest') or {})} != the orbit's {sorted(names)}")
    f = o.get("fall")
    if not (isinstance(f, (list, tuple)) and len(f) == 2 and 0 < float(f[0]) < float(f[1]) < 1):
        raise ValueError(f"rig {sid}: kneel_orbs fall {f!r} must be two values with 0 < f1 < f2 < 1")
    return o


def key_masks(key: np.ndarray, o: dict) -> dict[str, np.ndarray]:
    """The orbs in the AI key: monster_orbit's circle (and colour) masks, `piece` ones limited to one 4-connected piece."""
    masks = MO._orb_masks(key, o, 0, 0)
    lab, _ = components(key[..., 3] > 0)
    for nm, p in o["parts"].items():
        if p.get("piece") and masks[nm].any():
            ids, n = np.unique(lab[masks[nm]], return_counts=True)
            masks[nm] &= lab == ids[int(np.argmax(n))]
    return masks


def feet_row(idle: np.ndarray) -> int:
    return int(np.nonzero((idle[..., 3] > 0).any(1))[0].max())


def place(sid: str, frame: str, clean: np.ndarray, src: np.ndarray, masks: dict, o: dict, f: float, feet: int,
          clean_src: np.ndarray) -> tuple[np.ndarray, dict]:
    """`clean` with the orbs of `src` (their masks) moved f of the way to their ground spots; (image, record)."""
    img = clean.copy()
    h, w = img.shape[:2]
    drawn = np.zeros((h, w), bool)
    orbs = {}
    for nm, m in masks.items():
        ys, xs = np.nonzero(m)
        cx, b = (xs.min() + xs.max()) / 2, int(ys.max())
        d = (_round(f * (float(o["rest"][nm]) - cx)), _round(f * (feet - b)))
        tx, ty = xs + d[0], ys + d[1]
        if tx.min() < 1 or ty.min() < 1 or tx.max() > w - 2 or ty.max() > min(h - 2, feet):
            raise ValueError(f"rig {sid}: kneel_orbs orb {nm} leaves the cell (or the feet row) in {frame}")
        img[ty, tx] = src[ys, xs]
        drawn[ty, tx] = True
        orbs[nm] = {"d": d, "size": int(len(xs)), "bottom": int(ty.max()), "xs": xs, "ys": ys}
    if f >= 1 and o.get("shadow"):
        for nm, r in orbs.items():
            tx = r["xs"] + r["d"][0]
            for x in range(int(tx.min()) + 2, int(tx.max()) - 1):
                if not drawn[feet, x]:
                    img[feet, x] = (*SHADOW, 255)
                    drawn[feet, x] = True
                    r.setdefault("shadow", []).append(x)
    return img, {"drawn": drawn, "clean": clean, "clean_src": clean_src, "src": src, "orbs": orbs, "hold": f >= 1,
                 "feet": feet}


def _sources(sid: str, cfg: dict, kfs: dict) -> tuple:
    """(block, idle, clean idle, idle masks, raw key, clean key, key masks) for the hooks."""
    from gen import kneel_source_ai as KS
    o = cfg_of(sid, cfg)
    idle = np.asarray(kfs["idle"].convert("RGBA")).copy()
    key = KS.raw_key(sid, cfg, kfs)
    im = MO._orb_masks(idle, cfg["orbit"], 0, 0)
    km = key_masks(key, o)
    for nm, m in {**{f"idle {k}": v for k, v in im.items()}, **{f"key {k}": v for k, v in km.items()}}.items():
        if not m.any():
            raise ValueError(f"rig {sid}: kneel_orbs mask {nm} is empty")
    return o, idle, MO.clean(idle, im)[0], im, key, MO.clean(key, km)[0], km


def rest_key(sid: str, cfg: dict, kfs: dict) -> tuple[np.ndarray, dict]:
    """The kneel key cell: the clean raw key with the key orbs on their ground spots; (image, record)."""
    o, idle, _, _, key, ckey, km = _sources(sid, cfg, kfs)
    return place(sid, "kneel", ckey, key, km, o, 1.0, feet_row(idle), ckey)


def key_info(sid: str, cfg: dict, kfs: dict) -> dict:
    """The kf:kneel cell's record (rebuilt from the raw key; the key cell is not in generate's output)."""
    return rest_key(sid, cfg, kfs)[1]


def source_bottoms(sid: str, cfg: dict, kfs: dict) -> dict[str, dict[str, int]]:
    """{idle | kneel: {orb: its lowest row in that source}}."""
    _, _, _, im, _, _, km = _sources(sid, cfg, kfs)
    return {s: {nm: int(np.nonzero(m)[0].max()) for nm, m in ms.items()} for s, ms in (("idle", im), ("kneel", km))}


def bridge(sid: str, cfg: dict, kfs: dict, bottom: int, bo: dict) -> dict[str, tuple[np.ndarray, dict]]:
    """{kneel_in1 | kneel_in2 | kneel_b: (image, record)}: the bridge on the clean idle and clean raw key, the orbs pasted."""
    from gen import kneel_bridge as KB
    o, idle, cidle, im, key, ckey, km = _sources(sid, cfg, kfs)
    feet = feet_row(idle)
    made = KB.frames(cidle, ckey, bottom, bo)
    f1, f2 = (float(v) for v in o["fall"])
    return {"kneel_in1": place(sid, "kneel_in1", made["kneel_in1"], idle, im, o, f1, feet, cidle),
            "kneel_in2": place(sid, "kneel_in2", made["kneel_in2"], key, km, o, f2, feet, ckey),
            "kneel_b": place(sid, "kneel_b", made["kneel_b"], key, km, o, 1.0, feet, ckey)}


def frame_checks(name: str, a: np.ndarray, rec: dict) -> list[str]:
    """The EF-J checks of one kneel frame (see the module docstring)."""
    out = []
    seen = np.zeros(a.shape[:2], bool)
    body = rec["clean"][..., 3] > 0
    for nm, r in rec["orbs"].items():
        ty, tx = r["ys"] + r["d"][1], r["xs"] + r["d"][0]
        if (ty.min() < 0 or tx.min() < 0 or ty.max() >= a.shape[0] or tx.max() >= a.shape[1]
                or not np.array_equal(a[ty, tx], rec["src"][r["ys"], r["xs"]])):
            out.append(f"orb {nm}: its pixels are not the source's moved by {r['d']}")
            continue
        if seen[ty, tx].any():
            out.append(f"orb {nm} overlaps another orb")
        seen[ty, tx] = True
        if rec["hold"]:
            if int(ty.max()) != rec["feet"]:
                out.append(f"orb {nm}: lowest row {int(ty.max())} != the feet row {rec['feet']}")
            cov = float(body[ty, tx].mean())
            if cov > COVER_CAP:
                out.append(f"orb {nm} covers the body: {cov:.0%} of its px > {COVER_CAP:.0%}")
    keep = ~rec["drawn"]
    diff = np.any(a != rec["clean"], axis=2) & keep
    if diff.any():
        out.append(f"body changed outside the orbs: {int(diff.sum())} px at {C._first(diff)}")
    sh = rec["drawn"] & ~seen
    if sh.any() and not np.all(a[sh][:, :3] == SHADOW):
        out.append("a shadow px is not the shadow colour")
    return out


def detached(a: np.ndarray, rec: dict) -> list[str]:
    """EF-J's exception to the bridge `detached` rule: the body (the clean bridge frame, before the orbs were pasted in
    front of it) has no more pieces than the clean source, the frame no more than that plus one per orb, and no new
    piece under MIN_PIECE."""
    solid = a[..., 3] > 0
    lab, n = components(solid)
    _, bn = components(rec["clean"][..., 3] > 0)
    slab, sn = components(rec["clean_src"][..., 3] > 0)
    out = []
    if bn > sn:
        out.append(f"body pieces {bn} > the clean source's {sn}")
    if n > bn + len(rec["orbs"]):
        out.append(f"pieces {n} > body {bn} + {len(rec['orbs'])} orbs")
    small = sum(1 for s in C._sizes(lab, n) if s < C.MIN_PIECE)
    if small > sum(1 for s in C._sizes(slab, sn) if s < C.MIN_PIECE):
        out.append(f"new pieces under {C.MIN_PIECE} px: {small}")
    return out

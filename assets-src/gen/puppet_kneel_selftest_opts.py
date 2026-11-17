"""Selftests of the additive hero kneel options (docs/KNEEL_PLAN.md D-K18, K2-D): `reoutline`, `per_leg_lift`,
`ground_tweens` and the per-class robe `squash`, on the synthetic puppets of puppet_kneel_selftest.py. Every option
is opt-in: switched off (squash at the default 0.55) the frames are byte-identical to a block without it."""
from __future__ import annotations

import copy

import numpy as np
from PIL import Image

from gen import puppet as PU
from gen import puppet_kneel as PK
from gen import puppet_kneel_outline as KO


def _same(a: dict, b: dict) -> bool:
    return all(np.array_equal(np.asarray(a[n][0]), np.asarray(b[n][0])) for n in PK.KNEEL_POSES)


def _thick(im: Image.Image) -> Image.Image:
    """A 2 px dark outline: the synthetic puppet's 1 px ring plus a dark second ring inside it."""
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    edge = solid & PU._grow(~solid)
    a[solid & ~edge & PU._grow(edge), :3] = (20, 16, 28)
    return Image.fromarray(a, "RGBA")


def _colours(made: dict) -> set:
    return {tuple(int(v) for v in c) for n in PK.KNEEL_POSES
            for c in np.asarray(made[n][0])[np.asarray(made[n][0])[..., 3] > 0][:, :3]}


def run(check, puppet, bottom: int) -> None:
    for robed in (False, True):
        cfg, frames = puppet(robed)
        tag = "robed" if robed else "unrobed"
        base = PK.make(cfg, frames, bottom)
        off = copy.deepcopy(cfg)
        off["kneel"].update({"reoutline": False, "per_leg_lift": False, "ground_tweens": False})
        if robed:
            off["kneel"]["squash"] = 0.55
        check(_same(base, PK.make(off, frames, bottom)),
              f"{tag}: the K2-D options switched off (squash 0.55) are byte-identical to no option")
        on = copy.deepcopy(cfg)
        on["kneel"]["reoutline"] = True
        check(KO.thickness(frames["ready"]) == 1 and _same(base, PK.make(on, frames, bottom)),
              f"{tag}: reoutline leaves a class with a 1 px outline unchanged")
        fr2 = {k: _thick(v) for k, v in frames.items()}
        r0 = PU._second_ring(fr2["ready"])
        plain, fixed = PK.make(cfg, fr2, bottom), PK.make(on, fr2, bottom)
        rings = [round(PU._second_ring(fixed[n][0]), 2) for n in PK.KNEEL_POSES]
        before = [round(PU._second_ring(plain[n][0]), 2) for n in PK.KNEEL_POSES]
        full = [KO.saturated(np.asarray(fixed[n][0])) for n in PK.KNEEL_POSES]
        check(KO.thickness(fr2["ready"]) == 2 and all(r >= b for r, b in zip(rings, before))
              and all(abs(r - r0) <= 0.08 or f for r, f in zip(rings, full)) and rings != before,
              f"{tag}: reoutline raises the ring {before} -> {rings} toward ready's {r0:.2f}, to within 0.08 or "
              f"until the whole second ring is inked {full}")
        check(all(np.array_equal(np.asarray(plain[n][0])[..., 3], np.asarray(fixed[n][0])[..., 3])
                  for n in PK.KNEEL_POSES), f"{tag}: reoutline changes colours only, never the silhouette")
        pal = {tuple(int(v) for v in c) for f in fr2.values() for c in np.asarray(f)[np.asarray(f)[..., 3] > 0][:, :3]}
        check(_colours(fixed) <= pal | {tuple(PU.OUTLINE)}, f"{tag}: reoutline inks only source-palette colours")
        check(_same(fixed, PK.make(copy.deepcopy(on), fr2, bottom)), f"{tag}: reoutline is deterministic")
    cfg, frames = puppet(True)
    soft = copy.deepcopy(cfg)
    soft["kneel"]["squash"] = 0.75
    check(PK.height(PK.make(soft, frames, bottom)["kneel"][0]) > PK.height(PK.make(cfg, frames, bottom)["kneel"][0]),
          "robed: a gentler per-class squash (0.75) gives a taller kneel than the default 0.55")
    cfg, frames = puppet(False)
    gt = copy.deepcopy(cfg)
    gt["kneel"].update({"ground_tweens": True, "per_leg_lift": True})
    made = PK.make(gt, frames, bottom)
    low = [int(np.where((np.asarray(made[n][0])[..., 3] > 0).any(1))[0].max()) for n in PK.KNEEL_POSES]
    check(low == [bottom] * 4, f"unrobed: per_leg_lift + ground_tweens keep every kneel frame on the ground row {low}")
    run_paint(check, puppet, bottom)


def _raises(fn) -> bool:
    try:
        fn()
    except ValueError:
        return True
    return False


def run_paint(check, puppet, bottom: int) -> None:
    """`labels` and `paint` (puppet_kneel_paint.py): opt-in, the ops, the palette and the 160 px cap."""
    from gen import puppet_kneel_paint as KP
    cfg, frames = puppet(False)
    base = PK.make(cfg, frames, bottom)
    off = copy.deepcopy(cfg)
    off["kneel"].update({"labels": [], "paint": []})
    check(_same(base, PK.make(off, frames, bottom)), "paint / labels: empty lists are byte-identical to no key")
    key = base["kneel"][0]
    ka = np.asarray(key)
    ys, xs = np.nonzero(ka[..., 3] > 0)
    x, y = int(xs[0]), int(ys[0])
    ink = [int(v) for v in PU.OUTLINE]
    got = np.asarray(KP.paint(key, "kneel", [{"xy": [[x, y]], "rgb": None}], frames))
    check(got[y, x, 3] == 0 and int((got != ka).any(2).sum()) == 1, "paint: rgb null clears exactly that pixel")
    check(_raises(lambda: KP.paint(key, "kneel", [{"xy": [[x, y]], "rgb": [1, 2, 3]}], frames)),
          "paint: an off-palette colour is refused")
    check(_raises(lambda: KP.paint(key, "kneel", [{"rect": [0, 0, 12, 12], "rgb": ink}], frames)),
          "paint: more than 160 changed px in one frame is refused (13 x 13)")
    check(not _raises(lambda: KP.paint(key, "kneel", [{"rect": [0, 0, 9, 15], "rgb": ink}], frames)),
          "paint: 160 changed px are allowed (10 x 16)")
    only = np.asarray(KP.paint(key, "kneel", [{"rect": [0, 0, 79, 79], "only": list(PU.OUTLINE), "rgb": None}], frames)) \
        if int((np.all(ka[..., :3] == PU.OUTLINE, 2) & (ka[..., 3] > 0)).sum()) <= 160 else None
    check(only is None or not (np.all(only[..., :3] == PU.OUTLINE, 2) & (only[..., 3] > 0)).any(),
          "paint: rect with `only` recolours just that colour")
    r = np.asarray(frames["ready"])
    st = np.asarray(KP.paint(Image.new("RGBA", (80, 80)), "kneel", [{"stamp": [36, 12, 43, 21], "to": [0, 0], "rot": 90}],
                             frames))
    check(np.array_equal(st[:8, :10], np.rot90(r[12:22, 36:44], 1)), "paint: a stamp copies ready's box turned 90 deg")
    mv = np.asarray(KP.paint(Image.fromarray(st, "RGBA"), "kneel", [{"move": [0, 0, 9, 7], "by": [0, 2]}], frames))
    check(np.array_equal(mv[2:10, :10], st[:8, :10]) and not mv[:2, :10, 3].any(),
          "paint: move shifts the box's pixels by whole px and clears where they were")
    m2 = np.asarray(KP.paint(key, "kneel_b", [{"xy": [[x, y]], "rgb": None}], frames))
    check(np.array_equal(m2, ka), "paint: entries apply only to their own frame")
    lab = PU.segment(frames["ready"], cfg["battle"]["ready"], False)
    rel = KP.relabel(lab, frames["ready"], [{"part": "torso", "box": [30, 40, 50, 60]}])
    solid = r[..., 3] > 0
    check((rel[40:61, 30:51][solid[40:61, 30:51]] == list(PU.PARTS).index("torso")).all()
          and np.array_equal(rel[:40], lab[:40]), "labels: the box's opaque pixels are cut with the named part only")
    check(_raises(lambda: KP.relabel(lab, frames["ready"], [{"part": "tail", "box": [0, 0, 1, 1]}])),
          "labels: an unknown part is refused")
    lb = copy.deepcopy(cfg)
    lb["kneel"]["labels"] = [{"part": "torso", "box": [30, 40, 50, 60]}]
    check(not _same(base, PK.make(lb, frames, bottom)), "labels: a relabel changes the re-posed frames")

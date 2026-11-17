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

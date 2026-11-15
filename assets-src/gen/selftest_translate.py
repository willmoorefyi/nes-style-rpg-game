"""Rooted whole-figure translate self-tests (docs/NEW_MONSTER_GUIDE.md 2.2), run from selftest_serpent.run_serpent: a
`rooted` rig with `translate: true` moves the whole figure (the pinned mass, maw and tentacle roots with everything
else) by a frame's `dx` / `dy` as one rigid unit; the generated pixels are the untranslated frame shifted by exactly
that offset; check 8 (the root band) and the hole check follow the shift; without `translate` a frame's dx / dy still
leaves the ground joints where they are (neochu and every existing rig unchanged); `translate` on any other body is
an error."""
from __future__ import annotations

from typing import Callable

import numpy as np

SHIFT = {"atk_wind1": (-2, 0), "atk_wind2": (-4, 0), "atk_recover": (-2, 0), "hurt_in1": (1, -1)}


def _shifted(a: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def run_translate(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    from gen import selftest_serpent as SS
    frames = {n: {"dx": dx, "dy": dy} for n, (dx, dy) in SHIFT.items()}
    base = {**SS.OCHU, "frames": frames}
    moved = {**base, "translate": True}
    try:
        plain, one = SS.render(base), SS.render(moved)
    except (ValueError, KeyError) as e:
        check(False, f"rooted translate renders ({type(e).__name__}: {e})")
        return
    rig = R.Rig(moved, (80, 80))
    bad = [f"{n}:{j}" for n, (dx, dy) in SHIFT.items() for j in rig.ground if j in one[n]["joints"] and
           one[n]["joints"][j] != (rig.keyframes[one[n]["src"]][j][0] + dx, rig.keyframes[one[n]["src"]][j][1] + dy)]
    check(not bad, f"rooted translate: frame dx/dy moves the root, maw and every tentacle root together {bad[:3]}")
    ref = SS.render({**base, "frames": {n: {"dy": 0} for n in SHIFT}})   # a frame dy replaces the recipe's body dy
    off = [n for n, (dx, dy) in SHIFT.items() if not np.array_equal(one[n]["img"], _shifted(ref[n]["img"], dx, dy))]
    check(not off, f"rooted translate: each frame is the untranslated frame shifted rigidly by its dx/dy {off}")
    kept = [n for n in ref if n not in SHIFT and not np.array_equal(ref[n]["img"], one[n]["img"])]
    check(not kept, f"rooted translate: frames without dx/dy (atk_mid toward a moved wind2 too) are unchanged {kept}")
    still = [f"{n}:{j}" for n in SHIFT for j in rig.ground if j in plain[n]["joints"]
             and plain[n]["joints"][j] != rig.keyframes[plain[n]["src"]][j]]
    check(not still, f"rooted without translate: frame dx/dy leaves the ground joints pinned {still[:3]}")
    check(all(tuple(one[n].get("shift", (0, 0))) == SHIFT[n] for n in SHIFT) and
          all(tuple(plain[n].get("shift", (0, 0))) == (0, 0) for n in plain),
          "rooted translate: generated frames carry their shift (only with translate)")
    rep = MC.check_sprite(moved["sprite"], moved, SS.keyframes(moved), SS.META, one, with_lock=False)
    feet = [f"{k}: {e}" for k, v in rep.items() for e in v if k in SHIFT and not any(t in e for t in SR.TUNING)]
    check(not feet, f"rooted translate: check 8 (root band, lowest row) and holes follow the shift {feet[:3]}")
    blind = [n for n in SHIFT if MC.C.feet(one[n]["img"], SS.keyframes(moved)[one[n]["src"]], one[n]["img"], 0.0,
                                           SS.META["bottom_row"], True, False, 0, None, MC._per_foot(one[n]))]
    check(blind, f"rooted translate: an unshifted feet check would fail the moved frames {blind}")
    try:
        R.Rig({**SR.RIG, "translate": True}, (80, 80))
        check(False, "translate on a non-rooted body is an error")
    except ValueError:
        check(True, "translate on a non-rooted body is an error")

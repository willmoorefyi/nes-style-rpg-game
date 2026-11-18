"""Pass KT self-tests (docs/KNEEL_TWEEN_PLAN.md D-KT1 - D-KT4), offline, synthetic cells only.

- the bridge frames are one-source: every opaque pixel of kneel_in1 is a colour of the idle, of kneel_in2 / kneel_b a
  colour of the key; alpha stays binary; the lowest opaque row never moves; nothing on the cell border;
- heights run idle >= in1 >= in2 >= key (K-order) for a taller idle, and the other way for a taller key;
- the seam resize keeps the top (head) and bottom (feet) bands row for row and is deterministic;
- `options` refuses unknown keys and u outside (0, 0.35]; kneel.block refuses derived keys with `source: ai`;
- the K-order and bridge_frame checks fail a popping height and a squash with the plain area rule's numbers.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

INK, A, B, C = (6, 4, 10), (200, 60, 60), (60, 200, 60), (60, 60, 200)


def _figure(w: int, h: int, cell=(80, 80), bottom: int = 76, col=A, x0: int = 30) -> np.ndarray:
    """A banded rectangle with a 1 px ink outline standing on `bottom`."""
    a = np.zeros((cell[1], cell[0], 4), np.uint8)
    top = bottom - h + 1
    for i, y in enumerate(range(top, bottom + 1)):
        a[y, x0:x0 + w] = (*(col if i % 6 < 3 else C), 255)
    a[top, x0:x0 + w] = a[bottom, x0:x0 + w] = (*INK, 255)
    a[top:bottom + 1, x0] = a[top:bottom + 1, x0 + w - 1] = (*INK, 255)
    return a


def _cols(a: np.ndarray) -> set:
    return {tuple(int(v) for v in c) for c in a[a[..., 3] > 0][:, :3]}


def _h(a: np.ndarray) -> int:
    r = np.nonzero((a[..., 3] > 0).any(1))[0]
    return int(r.max() - r.min() + 1)


def run_kneel_bridge(check: Callable[[bool, str], None]) -> None:
    from gen import kneel as KN
    from gen import kneel_bridge as KB
    from gen import kneel_checks as KC
    idle, key = _figure(20, 60), _figure(34, 36, col=B, x0=24)
    o = KB.options({})
    fr = KB.frames(idle, key, 76, o)
    check(set(fr) == {"kneel_in1", "kneel_in2", "kneel_b"}, "bridge: three frames")
    check(_cols(fr["kneel_in1"]) <= _cols(idle), "bridge: kneel_in1 uses only the idle's colours")
    check(_cols(fr["kneel_in2"]) <= _cols(key) and _cols(fr["kneel_b"]) <= _cols(key),
          "bridge: kneel_in2 / kneel_b use only the key's colours")
    check(all(np.isin(f[..., 3], (0, 255)).all() for f in fr.values()), "bridge: binary alpha")
    low = [int(np.nonzero((f[..., 3] > 0).any(1))[0].max()) for f in fr.values()]
    check(low == [76, 76, 76], f"bridge: the lowest row stays on the feet row ({low})")
    check(all(not (f[0, :, 3].any() or f[:, 0, 3].any() or f[:, -1, 3].any()) for f in fr.values()),
          "bridge: nothing on the cell border")
    hs = [_h(idle), _h(fr["kneel_in1"]), _h(fr["kneel_in2"]), _h(key)]
    check(hs[0] >= hs[1] >= hs[2] >= hs[3] and hs[0] > hs[1] and hs[2] > hs[3], f"bridge: heights step down {hs}")
    check(not KC.order([idle, fr["kneel_in1"], fr["kneel_in2"], key]), "K-order passes the bridge")
    check(bool(KC.order([idle, key, idle, key])), "K-order fails a popping sequence")
    up = KB.frames(key, idle, 76, o)                                     # a key taller than the idle (a floater rising)
    check(_h(up["kneel_in1"]) >= _h(key), "bridge: a taller key stretches kneel_in1 up")
    t = 76 - 60 + 1
    ht = int(round(60 * o["keep_top"]))
    in1 = KB.remap_rows(idle, 50, o["keep_top"], o["keep_bot"])
    check(np.array_equal(in1[76 - 5:77], idle[76 - 5:77]), "bridge: the feet band is kept row for row")
    check(np.array_equal(in1[76 - 50 + 1:76 - 50 + 1 + ht], idle[t:t + ht]), "bridge: the head band is kept row for row")
    again = KB.frames(idle, key, 76, o)
    check(all(np.array_equal(fr[n], again[n]) for n in fr), "bridge: deterministic")
    kb = fr["kneel_b"]
    check(_h(kb) == _h(key) - 1 and np.array_equal(kb[70:77], key[70:77]), "bridge: kneel_b lowers the top 1 px only")
    for bad in ({"bridge": {"u": [0.5, 0.3]}}, {"bridge": {"zoom": 2}}, {"bridge": {"keep_top": 0.6}}):
        try:
            KB.options(bad)
            check(False, f"bridge options refuse {bad}")
        except ValueError:
            check(True, f"bridge options refuse {bad}")
    try:
        KN.block({"sprite": "x", "kneel": {"source": "ai", "variant": "short_legs"}})
        check(False, "kneel source ai refuses derived keys")
    except ValueError:
        check(True, "kneel source ai refuses derived keys")
    check(KN.is_ai({"kneel": {"source": "ai"}}) and not KN.is_ai({"kneel": {"variant": "x"}}) and not KN.is_ai({}),
          "kneel.is_ai")
    check(KN.skip({"kneel": 1}, {"kneel": {"source": "ai"}}) == set(KN.KNEEL_FRAMES) and
          KN.skip({"kneel": 1}, {"kneel": {}}) == {"kneel"}, "kneel.skip: source ai leaves all four to the bridge")
    # integrator ruling (KT2-A, 2026-11-18; plan rev 2 section 7): the bridge swap step's centroid cap is 0.65 x span
    from gen import anim_checks as AC
    s0, s1 = _figure(10, 40, x0=8), _figure(10, 40, x0=58)            # span: centroids 50 px apart
    p, q = _figure(10, 40, x0=18), _figure(10, 40, x0=48)              # a 30 px step = 0.6 of the span
    def cen(sh: float) -> list[str]:
        return [e for e in AC.continuity(p, q, (s0, s1), 80, sh) if "centroid" in e]
    check(bool(cen(0.5)) and not cen(KC.BRIDGE_SWAP_SHARE), "continuity: a 0.6-span step fails at 0.5, passes at 0.65")
    br = {"kneel_in1": {"bridge": True}, "kneel_in2": {"bridge": True}}
    check(KC.continuity_share("kneel", "kneel_in1", "kneel_in2", br) == 0.65 and
          KC.continuity_share("kneel", "idle", "kneel_in1", br) == 0.5 and
          KC.continuity_share("kneel", "kneel_in2", "kneel", br) == 0.5 and
          KC.continuity_share("kneel", "kneel_in1", "kneel_in2", {"kneel_in1": {}, "kneel_in2": {}}) == 0.5 and
          KC.continuity_share("daze", "kneel_in1", "kneel_in2", br) == 0.5,
          "continuity_share: 0.65 only for the bridge pair kneel_in1 -> kneel_in2 (derived and other steps 0.5)")
    # integrator ruling (KT3, 2026-11-18): AI-key-drawn frames skip the K-ground contact share, not the feet row
    wide, tip = np.zeros((80, 80, 4), np.uint8), np.zeros((80, 80, 4), np.uint8)
    wide[40:77, 10:70, 3] = 255
    tip[40:75, 10:70, 3] = 255
    tip[75:77, 10:14, 3] = 255                                         # thin leg tips on the feet row
    check(bool(KC.ground(tip, wide, 76)) and not KC.ground(tip, wide, 76, contact=False)
          and bool(KC.ground(tip[:76], wide, 76, contact=False)) and KC.KEY_DRAWN == ("kneel_in2", "kneel_b"),
          "K-ground: contact=False drops only the contact share (lowest row still on the feet row)")
    allowed = _cols(idle) | _cols(key)
    plain =KC.bridge_frame("kneel_in1", fr["kneel_in1"], idle, key, 0.35, 80, allowed)
    check(not plain, f"bridge_frame passes the bridge's kneel_in1 ({plain})")
    check(bool(KC.bridge_frame("kneel_in1", key, idle, key, 0.35, 80, allowed)),
          "bridge_frame fails a frame at the key's size for u 0.35 (height / area off the lerp)")

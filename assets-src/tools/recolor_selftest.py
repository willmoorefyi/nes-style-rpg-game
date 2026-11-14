"""W8 (docs/FIX_PLAN_PENINSULA.md R4b): the north bridge's debris (`bridge_gap_*`, approved brown planks) restyled
`pale_stone` (build_map.RECOLOR) is within CIE76 dE 12 of the stubs' `bridge_h` deck; unstyled it is about 31 away.
Run by map_selftest.run (build_map.py --selftest)."""
from __future__ import annotations

import numpy as np

import kit as K

DEBRIS = [f"bridge_gap_{j}_{i}" for j in (0, 1) for i in (0, 1)]
MAX_DE = 12.0


def _lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB (0-255) -> CIE L*a*b* (D65)."""
    c = np.asarray(rgb, np.float64) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = np.array([sum(m[r, i] * c[i] for i in range(3)) for r in range(3)]) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def _opaque_mean(images) -> np.ndarray:
    px = [np.asarray(im.convert("RGBA")).astype(np.float64) for im in images]
    return np.concatenate([a[..., :3][a[..., 3] > 127] for a in px]).mean(0)


def run(B) -> int:
    kit = K.load_kits(["overworld", "town", "temple"])
    if not all(p in kit.approved for p in DEBRIS + ["bridge_h"]):
        return 0                                     # placeholder kit (no approved art): nothing to compare
    deck = _lab(kit.material("bridge_h").reshape(-1, 3).astype(np.float64).mean(0))
    de = {s: float(np.linalg.norm(_lab(_opaque_mean([B.styled(kit, p, s) for p in DEBRIS])) - deck))
          for s in (None, "pale_stone")}
    assert de["pale_stone"] <= MAX_DE, f"W8: pale_stone debris is dE {de['pale_stone']:.1f} from the bridge deck"
    assert de[None] > MAX_DE, f"W8: the unstyled debris already matches the deck (dE {de[None]:.1f})"
    print(f"  W8: bridge debris dE {de[None]:.1f} unstyled, {de['pale_stone']:.1f} as pale_stone")
    return 1

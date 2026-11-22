"""Selftest of vehicle_view_cut.py (docs/AIRSHIP_VIEWS_PLAN.md 4.1): a synthetic render runs through the cut, the edits
and the gates; an off-centre anchor fails the visual-centre gate; `--check` passes on a clean tree; the output is equal
under PYTHONHASHSEED 0 / 1.

    python3 -I assets-src/gen/selftest_vehicle_view.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from gen import vehicle_view_cut as V  # noqa: E402
from gen import vehicle_view_edit as E  # noqa: E402


def synthetic() -> np.ndarray:
    """A white 832x1216 render: a cream envelope with brown seams over a brown hull, a 1 px plumb line under it."""
    im = Image.new("RGB", (832, 1216), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.ellipse([120, 300, 720, 700], fill=(235, 220, 185), outline=(60, 40, 30), width=6)
    for x in range(200, 700, 70):
        d.line([x, 320, x, 680], fill=(150, 100, 60), width=5)
    d.polygon([(200, 720), (640, 720), (560, 900), (280, 900)], fill=(110, 70, 40), outline=(40, 25, 20))
    d.rectangle([300, 690, 540, 725], fill=(120, 80, 50))
    d.rectangle([500, 890, 518, 1000], fill=(40, 25, 20))
    return np.asarray(im)


def main() -> int:
    fails = []
    ref = V.b7()
    pal = V.palette(ref)
    dist = E.d7(ref)
    if abs(dist - 13.80) > 0.05:
        fails.append(f"D7 {dist:.3f}, want 13.80")
    a = V.to_native(V.match(V.cut_white(synthetic()), ref), 89, pal)
    a, log = E.edit(a, {"seam_boost": 60, "highlight": True, "patch": {"trim_plumb": True}}, pal)
    f = E.drawn(a)
    if "trim_plumb" not in log or log["trim_plumb"]["px"] == 0:
        fails.append(f"the plumb line was not trimmed: {log}")
    E.SIZES["synthetic"] = (f.shape[1], f.shape[0])
    good = E.anchor_of(f, dist)
    bad_ok = E.gates("synthetic", f, good, dist, pal)
    if bad_ok:
        fails.append(f"the synthetic frame fails at its own anchor: {bad_ok}")
    off = E.gates("synthetic", f, good + 2.0 / f.shape[1], dist, pal)
    if not any("visual centre" in m for m in off):
        fails.append("an off-centre anchor (2 px) passed the visual-centre gate")
    E.SIZES["synthetic"] = (f.shape[1] + 5, f.shape[0])
    if not any("size" in m for m in E.gates("synthetic", f, good, dist, pal)):
        fails.append("a frame 5 px off the size table passed the size gate")
    soft = f.copy()
    soft[np.argwhere(soft[..., 3] > 0)[0][0], np.argwhere(soft[..., 3] > 0)[0][1], 3] = 200
    if not any("binary" in m for m in E.gates("synthetic", soft, good, dist, pal)):
        fails.append("a soft alpha pixel passed the binary alpha gate")
    del E.SIZES["synthetic"]
    tool = str(HERE / "vehicle_view_cut.py")
    r = subprocess.run([sys.executable, "-I", tool, "--check"], capture_output=True, text=True)
    if r.returncode:
        fails.append("--check fails on the tree:\n" + r.stdout + r.stderr)
    outs = []
    for seed in ("0", "1"):
        code = ("import sys, hashlib; sys.path.insert(0, %r); from gen import vehicle_view_cut as V; out, _ = V.build();"
                "print(hashlib.sha256(b''.join(a.tobytes() + t.encode() for a, t in out.values())).hexdigest())"
                % str(HERE.parent))
        outs.append(subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                                   env={**os.environ, "PYTHONHASHSEED": seed}).stdout.strip())
    if outs[0] != outs[1] or not outs[0]:
        fails.append(f"the cut differs under PYTHONHASHSEED 0 / 1: {outs}")
    for m in fails:
        print("selftest_vehicle_view: FAIL", m)
    print("selftest_vehicle_view: OK" if not fails else f"selftest_vehicle_view: {len(fails)} failed")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

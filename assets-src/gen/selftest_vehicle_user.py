"""Pass PT (docs/PLAYTEST_ART_PLAN.md 6.5): selftests of gen/vehicle_user.py, the import of the user-rendered ship end
views. A synthetic two-hull render in a temp generator tree (with a copy of the real ship.png as the colour and anchor
reference): the wake dropped, the two views split, colours snapped to ship.png's set, the outline closed, the centroid
rule at both facings, the height band, the refusals (one piece, a sha256 mismatch), the re-import check and the
style-lock dispatch; then the real recipe."""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import yaml
from PIL import Image


def hull(h: int, w: int) -> np.ndarray:
    """A w x h synthetic ship: a dark hull at the bottom quarter, a pale sail, a mast, a dark outline."""
    a = np.zeros((h, w, 4), np.uint8)
    a[: h * 3 // 4, w // 2 - 1:w // 2 + 1] = (110, 70, 40, 255)               # mast
    a[h // 8: h * 3 // 4, w // 4: w * 3 // 4] = (235, 225, 200, 255)          # sail
    a[h * 3 // 4:, 2:w - 2] = (70, 50, 40, 255)                               # hull
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    a[m & ~(p[2:, 1:-1] & p[:-2, 1:-1] & p[1:-1, 2:] & p[1:-1, :-2]), :3] = (20, 16, 20)
    return a


def render(one: bool = False, wake: bool = True) -> Image.Image:
    out = np.zeros((128, 240, 4), np.uint8)
    for k in range(1 if one else 2):
        f = hull(112, 80)
        out[10:122, 20 + 120 * k:100 + 120 * k] = f
        if wake:
            out[122, 30 + 120 * k:90 + 120 * k] = (230, 240, 255, 255)        # the thin wake line
    return Image.fromarray(out)


def tree(tmp: Path, img: Image.Image, sha: str | None = None) -> Path:
    gen = tmp / "gen"
    (gen / "approved" / "vehicles").mkdir(parents=True)
    from gen import vehicle_user as VU
    shutil.copy(VU.SHIP, gen / "approved" / "vehicles" / "ship.png")
    p = gen / "user_art" / "ship_views" / "sheet.png"
    p.parent.mkdir(parents=True)
    img.save(p)
    (gen / "vehicle_user.yaml").write_text(yaml.safe_dump({"ship_views": {
        "file": str(p.relative_to(gen)), "sha256": sha or hashlib.sha256(p.read_bytes()).hexdigest(), "tool": "test",
        "rendered": "2026-01-01", "approved": "2026-01-01", "user_review": "test"}}))
    return gen


def run_vehicle_user(check: Callable[[bool, str], None]) -> None:
    from gen import vehicle_user as VU
    from gen.vehicle_view_edit import drawn, edge
    ref = np.asarray(Image.open(VU.SHIP).convert("RGBA"))
    pal = VU.palette(ref)
    with tempfile.TemporaryDirectory() as td:
        gen = tree(Path(td), render())
        out, bad = VU.build(gen=gen, ship=gen / "approved" / "vehicles" / "ship.png")
        check(list(out) == ["ship_back", "ship_front"] and not bad, f"two views, every gate passes {bad}")
        for name, (f, text) in out.items():
            meta = json.loads(text)
            g = drawn(f)
            m = g[..., 3] > 0
            check(meta["cut_settings"]["wake_px_dropped"] == 120, f"{name}: the wake line is dropped (120 px)")
            check(g.shape[0] == 112 and meta["cut_settings"]["scale"] == 1.0, f"{name}: in band, not scaled ({g.shape})")
            check({tuple(c) for c in g[m][:, :3].tolist()} <= {tuple(c) for c in pal.astype(int).tolist()},
                  f"{name}: colours snapped to ship.png's set")
            check(bool(np.all(g[edge(m), :3] == pal[np.argmin(pal.sum(1))])), f"{name}: the outline is closed")
            check(meta["backend"] == "user" and meta["anchor"][1] == 1.0 and 0 < meta["anchor"][0] < 1,
                  f"{name}: backend user, an anchor by the centroid rule ({meta['anchor']})")
            d = gen / "approved" / "vehicles"
            (d / f"{name}.png").write_bytes(VU.png_bytes(f))
            (d / f"{name}.json").write_text(text)
            check(VU.check(meta, gen) is None, f"{name}: re-imports identically")
        Image.fromarray(np.zeros((118, 98, 4), np.uint8)).save(gen / "approved" / "vehicles" / "ship_back.png")
        check("differs" in (VU.check({"frame": "ship_back"}, gen) or ""), "check fails on a changed png")
    with tempfile.TemporaryDirectory() as td:
        gen = tree(Path(td), render(one=True))
        check("need 2" in (VU.check({"frame": "ship_back"}, gen) or ""), "one piece is refused")
    with tempfile.TemporaryDirectory() as td:
        gen = tree(Path(td), render(), sha="0" * 64)
        check("sha256" in (VU.check({"frame": "ship_back"}, gen) or ""), "a sha256 mismatch is refused")
    from gen import field_user as FU
    real = VU.HERE / "approved" / "vehicles"
    for name in VU.FRAMES:
        if (real / f"{name}.json").is_file():
            meta = json.loads((real / f"{name}.json").read_text())
            check(FU.user_check(meta) is None, f"{name}: the real recipe re-imports identically (style-lock dispatch)")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    fails = []
    run_vehicle_user(lambda ok, msg: (print(("  ok   " if ok else "  FAIL ") + msg), None if ok else fails.append(msg)))
    sys.exit(1 if fails else 0)

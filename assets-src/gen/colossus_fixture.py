"""The painted contract form (docs/CHAOS_FORMS_PLAN.md 18.5; FW-C): a 2700x1080 F3 stand-in whose layer files, built by
colossus_build.py, give exactly `contract_form` of the committed tests/fixtures/colossus/contract.json (written by the
TS side, makeFixture.mjs; the TS reader is the contract): glow at texScale 2 over the whole canvas, the body's rows
360-1079 in two tiles (2048 + 652), core with an empty base and `crack` / `open` patches at (1047, 300) 600x600, the
corona cut from the glow file to (997, 160) 700x700; skyDim 0.6. Not game art: soft alpha, full colour, numpy only,
no RNG. Used by selftest_colossus_art.py.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import yaml
from PIL import Image

FORM = "contract_form"
CANVAS = (2700, 1080)
DISC = (1347, 510)
RING = (1350, 570, 562, 37)


def _grid():
    yy, xx = np.mgrid[0:CANVAS[1], 0:CANVAS[0]].astype(np.float64)
    return xx, yy


def images() -> dict[str, Image.Image]:
    """{file name: canvas-sized RGBA} for approved/chaos_forms/<FORM>/."""
    xx, yy = _grid()
    torso = 1 - np.hypot((xx - 1350) / 400, (yy - 1000) / 560)
    arms = (70 - np.abs(yy - (640 - 90 * np.cos((xx - 1350) / 1350 * np.pi / 2)))) / 70
    head = 1 - np.hypot((xx - DISC[0]) / 120, (yy - 430) / 110)
    a = np.clip(np.maximum(np.maximum(torso, arms), head) * 60, 0, 1) * (yy >= 361)
    a[1079, :] = np.maximum(a[1079, :], 0.5)                     # the cut-off bottom edge (opaque to both sides)
    shade = 0.55 + 0.45 * np.clip((1080 - yy) / 700, 0, 1)
    body = np.dstack([58 * shade + 20, 34 * shade + 14 + 0.01 * xx, 82 * shade + 20, a * 255])
    d = np.hypot(xx - RING[0], yy - RING[1])
    light = np.exp(-((d - RING[2]) / RING[3]) ** 2) + 0.6 * np.exp(-(np.hypot(xx - DISC[0], yy - DISC[1]) / 260) ** 2)
    ga = np.clip(light + 0.02, 0, 1) * np.clip(yy / 120, 0, 1)
    ga[1:, :] = np.maximum(ga[1:, :], 1 / 255)                   # light everywhere below row 0: the frame is the canvas
    glow = np.dstack([np.full(xx.shape, 255.0), 196 + 40 * light, 150 + 0 * xx, ga * 255])
    out = {"master.png": body, "glow.png": glow}
    inside = (xx >= 1048) & (xx <= 1645) & (yy >= 301) & (yy <= 898)   # + the 1 px frame margin
    for name, col, k in (("core_crack.png", (255, 170, 60), 0.4), ("core_open.png", (255, 150, 50), 1.0)):
        e = np.clip(1 - np.hypot((xx - DISC[0]) / 300, (yy - 600) / 300), 0.02, 1) * k
        out[name] = np.dstack([np.full(xx.shape, c, np.float64) for c in col] + [np.where(inside, e * 255, 0)])
    return {k: Image.fromarray(np.clip(np.round(v), 0, 255).astype(np.uint8), "RGBA") for k, v in out.items()}


def spec() -> dict:
    return {"form": FORM, "canvas": list(CANVAS), "scale": 1, "place": [-527, -60], "sky_dim": 0.6,
            "anchors": {"target": [1347, 510], "core": [1347, 510], "head": [1347, 410],
                        "hands": [[647, 680], [1787, 630]], "melee": [1747, 590], "feet": [1347, 950]},
            "target_rect": [1170, 345, 360, 495],
            "layers": [{"name": "glow", "kind": "glow", "tex_scale": 2, "alpha": 1.0, "frames": {"base": "glow.png"}},
                       {"name": "body", "kind": "body", "frames": {"base": "master.png"}},
                       {"name": "core", "kind": "core",
                        "frames": {"base": None, "crack": "core_crack.png", "open": "core_open.png"}},
                       {"name": "corona", "kind": "corona", "box": [997, 160, 1697, 860],
                        "frames": {"base": "glow.png"}}]}


def write(root: Path, spec_over: dict | None = None, imgs: dict[str, Image.Image] | None = None) -> tuple[Path, Path]:
    """approved/chaos_forms/<FORM>/*.png + colossus/<FORM>.yaml under root; returns (approved root, spec root)."""
    app, specs = root / "approved" / "chaos_forms", root / "colossus"
    (app / FORM).mkdir(parents=True, exist_ok=True)
    specs.mkdir(parents=True, exist_ok=True)
    for name, img in (imgs or images()).items():
        img.save(app / FORM / name)
    (specs / f"{FORM}.yaml").write_text(yaml.safe_dump({**spec(), **(spec_over or {})}, sort_keys=False))
    return app, specs

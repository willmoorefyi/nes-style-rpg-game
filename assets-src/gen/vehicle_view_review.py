"""Review sheets of the airship views (`vehicle_view_cut.py --review DIR`): x4 strips, the top-down lineup at game scale
(x2 over the compiled world), and Mode 7 mock-ups (the FLIGHT projection over the far atlas). Ported from PA's mock.py.
Nothing here is read by a build or a check.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from gen.vehicle_view_edit import anchor_of, d7, drawn, keel_x

MAPS = Path(__file__).resolve().parents[2] / "assets" / "maps" / "ai" / "overworld"
FL = dict(h=6.0, theta=math.radians(18), f=1200.0, cx=960.0, cy=600.0, kappa=1 / 600, back=11.3)
GREEN = (70, 120, 70, 255)


def _on(bg: Image.Image, sp: Image.Image, foot: tuple[int, int], ax: float, k: int, shadow_h: int) -> None:
    sp = sp.resize((sp.width * k, sp.height * k), Image.Resampling.NEAREST)
    sh = Image.new("RGBA", bg.size)
    w = 0.3 * sp.width
    ImageDraw.Draw(sh).ellipse([foot[0] - w, foot[1] - shadow_h * k / 2, foot[0] + w, foot[1] + shadow_h * k / 2],
                               fill=(0, 0, 0, 77))
    bg.alpha_composite(sh)
    bg.paste(sp, (int(foot[0] - ax * sp.width), foot[1] - 10 * k - sp.height), sp)   # AIRSHIP_LIFT 10


def _views(frames: dict[str, np.ndarray], b7: np.ndarray) -> list[tuple[str, Image.Image, float]]:
    dist = d7(b7)
    side = drawn(b7)
    out = [("airship", Image.fromarray(side), keel_x(side))]
    for name, a in frames.items():
        f = drawn(a)
        out.append((name, Image.fromarray(f), anchor_of(f, dist)))
    return out


def strips(frames: dict[str, np.ndarray], b7: np.ndarray, k: int = 4) -> Image.Image:
    views = _views(frames, b7)
    rows = []
    for flip in (False, True):
        W = sum(im.width * k + 24 for _, im, _ in views)
        row = Image.new("RGBA", (W, 130 * k), GREEN)
        x = 0
        for name, im, ax in views:
            im, a = (ImageOps.mirror(im), 1 - ax) if flip else (im, ax)
            foot = (x + int(a * im.width * k), 120 * k)
            _on(row, im, foot, a, k, 10 if "_" in name else 8)
            ImageDraw.Draw(row).line([foot[0], foot[1] - 2, foot[0], foot[1] + 6 * k], fill=(255, 0, 0), width=2)
            ImageDraw.Draw(row).text((x + 4, 4), name + (" (mirrored)" if flip else ""), fill=(255, 240, 120))
            x += im.width * k + 24
        rows.append(row)
    s = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows)), GREEN)
    s.paste(rows[0], (0, 0))
    s.paste(rows[1], (0, rows[0].height))
    return s


def topdown(frames: dict[str, np.ndarray], b7: np.ndarray, cell: tuple[int, int] = (140, 160)) -> Image.Image:
    x0, y0 = cell[0] - 10, cell[1] - 5
    bg = Image.new("RGBA", (20 * 48, 11 * 48), GREEN)
    for cy in range(y0 // 16, (y0 + 11) // 16 + 1):
        for cx in range(x0 // 16, (x0 + 20) // 16 + 1):
            p = MAPS / f"below_{cy}_{cx}.png"
            if p.is_file():
                bg.paste(Image.open(p).convert("RGBA"), (cx * 768 - x0 * 48, cy * 768 - y0 * 48))
    x = 40
    for flip in (False, True):
        for name, im, ax in _views(frames, b7)[:3]:
            im, a = (ImageOps.mirror(im), 1 - ax) if flip else (im, ax)
            _on(bg, im, (x + int(a * im.width), 48 * 7), a, 1, 10 if "_" in name else 8)
            x += im.width + 12
    return bg.resize((bg.width * 2, bg.height * 2), Image.Resampling.NEAREST)


def mode7(sprite: Image.Image, ax: float, cell: tuple[float, float] = (146.5, 140.5), label: str = "") -> Image.Image:
    A = np.asarray(Image.open(MAPS / "mode7.png").convert("RGB"))
    cp = A.shape[0] / 256
    p = FL
    W, H = 1920, 1080
    v = (np.arange(H) + 0.5 - p["cy"]) / p["f"]
    c, sn = math.cos(p["theta"]), math.sin(p["theta"])
    a, b = c - v * sn, sn + v * c
    disc = b * b - 2 * p["h"] * p["kappa"] * a * a
    ok = (b > 0) & (disc >= 0)
    s = np.where(ok, 2 * p["h"] / (b + np.sqrt(np.maximum(disc, 0))), 0)
    X = cell[0] + (np.arange(W)[None] + 0.5 - p["cx"]) * s[:, None] / p["f"]
    Y = cell[1] + p["back"] - (a * s)[:, None] + 0 * X
    img = A[np.clip((Y * cp).astype(int), 0, A.shape[0] - 1), np.clip((X * cp).astype(int), 0, A.shape[1] - 1)]
    img = np.where(ok[:, None, None], img, np.array([96, 150, 230], np.uint8))
    bg = Image.fromarray(img.astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(bg, "RGBA")
    d.ellipse([960 - 0.6 * sprite.width, 742, 960 + 0.6 * sprite.width, 758], fill=(0, 0, 0, 77))
    sp = sprite.resize((sprite.width * 2, sprite.height * 2), Image.Resampling.NEAREST)
    bg.paste(sp, (int(960 - ax * sp.width), 750 - sp.height), sp)
    if label:
        d.rectangle([20, 20, 30 + 7 * len(label), 44], fill=(0, 0, 80, 220))
        d.text((28, 26), label, fill="white")
    return bg.crop((560, 330, 1360, 830))


def review(out: Path, frames: dict[str, np.ndarray], b7: np.ndarray) -> None:
    out.mkdir(parents=True, exist_ok=True)
    strips(frames, b7).save(out / "strips_x4.png")
    topdown(frames, b7).save(out / "topdown_x2.png")
    shots = [mode7(ImageOps.mirror(im) if flip else im, 1 - ax if flip else ax, label=name + (" mirrored" * flip))
             for flip in (False, True) for name, im, ax in _views(frames, b7)[:3]]
    sheet = Image.new("RGBA", (3 * 800, 2 * 500))
    for i, sh in enumerate(shots):
        sheet.paste(sh, ((i % 3) * 800, (i // 3) * 500))
    sheet.save(out / "mode7_mock.png")
    print(f"vehicle_view_cut: review sheets in {out}")

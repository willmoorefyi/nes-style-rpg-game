"""Review artefacts of the hero kneel (docs/KNEEL_PLAN.md section 8), written by `puppet_kneel.py review`:
gen/out/anim/review/kneel/<class>_<variant>_kneel.gif (in 8f, 2 sway cycles, out 6f, stand 24f at 60 fps) and
<class>_<variant>_sheet.png (ready, kneel_in1, kneel_in2, kneel, kneel_b, down at 4x, the ground line, height and
band per frame). Untracked scratch: never committed."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BG = (60, 60, 70, 255)
SHEET_COLS = ["ready", "kneel_in1", "kneel_in2", "kneel", "kneel_b", "down"]


def _height(img: Image.Image) -> int:
    rows = np.where((np.asarray(img)[..., 3] > 0).any(1))[0]
    return int(rows.max() - rows.min() + 1) if len(rows) else 0


def _on_bg(f: Image.Image, scale: int) -> Image.Image:
    bg = Image.new("RGBA", f.size, BG)
    bg.alpha_composite(f)
    return bg.convert("RGB").resize((f.width * scale, f.height * scale), Image.Resampling.NEAREST)


def write_gif(track: list[tuple[str, int]], allf: dict, path: Path, scale: int = 4) -> None:
    imgs = [_on_bg(allf[n], scale) for n, _ in track]
    ms = [int(round(k * 1000 / 60)) for _, k in track]
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms, loop=0, optimize=False)


def write_sheet(cid: str, variant: str, allf: dict, info: dict, bottom: int, path: Path, scale: int = 4) -> None:
    w, h = allf["ready"].size
    gap, top = 8, 34
    sheet = Image.new("RGBA", (len(SHEET_COLS) * (w * scale + gap), h * scale + top + 18), (40, 40, 48, 255))
    d = ImageDraw.Draw(sheet)
    lo, hi = info["band"]
    d.text((4, 2), f"{cid} variant {variant}: kneel {info['kneel']} / ready {info['ready']} = {info['ratio']}, "
                   f"band {lo}-{hi}, down {info['down']}", fill=(255, 255, 255, 255))
    for i, n in enumerate(SHEET_COLS):
        x = i * (w * scale + gap)
        sheet.paste(_on_bg(allf[n], scale), (x, top))
        gy = top + (bottom + 1) * scale
        d.line([(x, gy), (x + w * scale, gy)], fill=(80, 220, 80, 255))
        hh = _height(allf[n])
        band = n in ("kneel", "kneel_b")
        col = (255, 255, 255, 255) if not band else ((120, 255, 120, 255) if lo <= hh <= hi else (255, 90, 90, 255))
        d.text((x + 2, 18), f"{n} h {hh}" + (f" [{lo}-{hi}]" if band else ""), fill=col)
        for yb in ((bottom + 1 - lo), (bottom + 1 - hi)) if band else ():
            d.line([(x, top + yb * scale), (x + 10, top + yb * scale)], fill=(255, 200, 0, 255))
    sheet.save(path)


def write_review(cid: str, variant: str, frames: dict, kneel: dict, info: dict, bottom: int, out: Path,
                 track: list[tuple[str, int]]) -> None:
    allf = {**frames, **kneel}
    write_gif(track, allf, out / f"{cid}_{variant}_kneel.gif")
    write_sheet(cid, variant, allf, info, bottom, out / f"{cid}_{variant}_sheet.png")

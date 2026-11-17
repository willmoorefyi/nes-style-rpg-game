"""Pass KA review sheets (docs/KNEEL_AI_PLAN.md 3, 8; untracked, gen/out/kneel_ai/review/).

- `probe_sheet.png` (KA1-P, to the user before any pick): rows = sprites; columns = idle, derived kneel, G-sil, then
  (a), (b), (c), (d) x seeds 1234 / 1235, and (b2) 1234, at native x4 on a grey ground with the foot line; under each
  output its J0 verdict, A-area, A-width and IoU-derived (from gate_<arm>_<seed>.json).
- `<id>_review.png`: the same columns for one sprite, every try present (the review agent's sheet; R1-R5).
"""
from __future__ import annotations

import json
import textwrap

import numpy as np
from PIL import Image, ImageDraw

from gen import kneel_ai_data as D

REVIEW = D.OUT / "review"
SCALE, TEXT_H, BG, GROUND = 4, 78, (58, 58, 66), (90, 200, 90)
PROBE_COLS = [("a", 1234), ("a", 1235), ("b", 1234), ("b", 1235), ("c", 1234), ("c", 1235), ("d", 1234), ("d", 1235),
              ("b2", 1234)]


def _native(path, cell=None) -> np.ndarray | None:
    return np.asarray(Image.open(path).convert("RGBA")) if path.exists() else None


def _sil(sid: str) -> np.ndarray | None:
    d = D.OUT / sid
    if not (d / "guide.json").exists():
        return None
    g = json.loads((d / "guide.json").read_text())
    w, k = g["window"], g["window"]["k"]
    can = np.asarray(Image.open(d / "guide_sil.png").convert("RGB"))
    win = can[w["y0"]:w["y0"] + w["h"], w["x0"]:w["x0"] + w["w"]][k // 2::k, k // 2::k]
    m = (win == 128).all(-1)
    out = np.zeros(m.shape + (4,), np.uint8)
    out[m] = (128, 128, 128, 255)
    return out


def _gate_text(sid: str, arm: str, seed: int) -> list[str]:
    d = D.OUT / sid
    cut = d / f"cut_{arm}_{seed}.json"
    gate = d / f"gate_{arm}_{seed}.json"
    if gate.exists():
        g = json.loads(gate.read_text())
        vals = {r[0]: r[2] for r in g["rows"]}
        return [f"({arm}) {seed}: {g['verdict']}", f"area {vals.get('A-area', '-').split(';')[0]}",
                f"width {vals.get('A-width', '-')}", f"IoU-derived {vals.get('IoU-derived', '-')}"]
    if cut.exists():
        return [f"({arm}) {seed}: CUT FAIL", json.loads(cut.read_text()).get("fail", "")[:120]]
    return [f"({arm}) {seed}: -"]


def _cell(img: np.ndarray | None, cw: int, ch: int, foot: int, lines: list[str]) -> Image.Image:
    tile = Image.new("RGB", (cw * SCALE + 8, ch * SCALE + TEXT_H), BG)
    d = ImageDraw.Draw(tile)
    if img is not None:
        up = Image.fromarray(img, "RGBA").resize((img.shape[1] * SCALE, img.shape[0] * SCALE), Image.Resampling.NEAREST)
        tile.paste(up, (4, 0), up)
    d.line([(0, (foot + 1) * SCALE), (tile.width, (foot + 1) * SCALE)], fill=GROUND)
    y = ch * SCALE + 2
    for ln in lines:
        for part in textwrap.wrap(ln, max(20, (cw * SCALE) // 6))[:2]:
            d.text((4, y), part, fill=(235, 235, 235))
            y += 11
    return tile


def row(sid: str, cols: list[tuple[str, int]]) -> list[Image.Image]:
    sp = D.load(sid)
    (w, h), d = sp.cell, D.OUT / sid
    out = [_cell(sp.idle, w, h, sp.foot_row, [f"{sid} idle", f"{w}x{h}, band {sp.band_px[0]}-{sp.band_px[1]} px"]),
           _cell(_native(d / "derived_native.png", sp.cell), w, h, sp.foot_row, ["derived kneel"]),
           _cell(_sil(sid), w, h, sp.foot_row, ["G-sil (pose guide)"])]
    for arm, seed in cols:
        out.append(_cell(_native(d / f"key_{arm}_{seed}.png", sp.cell), w, h, sp.foot_row, _gate_text(sid, arm, seed)))
    return out


def sheet(ids: list[str], cols: list[tuple[str, int]], name: str) -> str:
    rows = [row(s, cols) for s in ids]
    cw = max(t.width for r in rows for t in r)
    rh = [max(t.height for t in r) for r in rows]
    im = Image.new("RGB", (cw * len(rows[0]), sum(rh)), (30, 30, 36))
    y = 0
    for r, h in zip(rows, rh):
        for i, t in enumerate(r):
            im.paste(t, (i * cw, y))
        y += h
    REVIEW.mkdir(parents=True, exist_ok=True)
    im.save(REVIEW / name)
    return str(REVIEW / name)


def probe(ids: list[str]) -> str:
    return sheet(ids, PROBE_COLS, "probe_sheet.png")


def review(sid: str) -> str:
    d = D.OUT / sid
    cols = sorted({(p.stem.split("_")[1], int(p.stem.split("_")[2])) for p in d.glob("key_*_*.png")})
    return sheet([sid], cols or PROBE_COLS, f"{sid}_review.png")

"""J0 pixel grid of a Gemini raw (arm g; docs/KNEEL_AI_PLAN.md rev 7 section 2, momus n1).

- `measure`: `pixelize.detect_pitch` on the 1024 raw: (p, phase, confidence) and |p - k| / k, reported for every raw
  (an R3 note and the pilot distribution); it never fails J0 by itself. Below confidence 0.5: `no grid`.
- The cut always runs at k. With a grid, `align` only moves the window origin (by at most k / 2 px) onto the nearest
  Gemini grid line, so each block covers whole Gemini pixels; the window's size does not change.
- `scale`: the figure's height against the silhouette's. Within 10 %: s = 1. Off by more: the arm-(d) path (one
  uniform scale to the band midpoint), or s = k / p when the ratio is within 5 % of k / p; both flag J1 A-scale.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from gen import pixelize as P

MIN_CONF = 0.5
SIZE_TOL = 0.10                 # the figure height against the silhouette's
PITCH_TOL = 0.05                # the ratio against k / p


def _edges(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    f = rgb.astype(np.float32)                  # pixelize.detect_pitch's colour-edge positions
    return np.where(np.abs(np.diff(f, axis=1)).sum(2) > 90)[1] + 1, np.where(np.abs(np.diff(f, axis=0)).sum(2) > 90)[0] + 1


def _at(xs: np.ndarray, ys: np.ndarray, q: float) -> tuple[float, float, float]:
    zx, zy = np.exp(2j * np.pi * xs / q).mean(), np.exp(2j * np.pi * ys / q).mean()
    return float(min(abs(zx), abs(zy))), float(np.angle(zx) / (2 * np.pi) % 1.0 * q), \
        float(np.angle(zy) / (2 * np.pi) % 1.0 * q)


def measure(rgb: np.ndarray, k: int) -> dict:
    """detect_pitch over [3, max(14, 1.6 k)], then the largest multiple (x2..x4) of its pitch that keeps the
    confidence (a k grid is also a k/2 or k/3 grid: the harmonic is not the pitch)."""
    top = max(14.0, 1.6 * k)
    p, px, py, conf = P.detect_pitch(rgb, hi=top)
    if conf > 0:
        xs, ys = _edges(rgb)
        for m in (4, 3, 2):
            c, qx, qy = _at(xs, ys, p * m)
            if p * m <= top + 1 and c >= conf - 0.05:
                p, px, py, conf = p * m, qx, qy, c
                break
    return {"p": round(p, 3), "phase": [round(px, 3), round(py, 3)], "conf": round(conf, 3), "k": k,
            "rel": round(abs(p - k) / k, 4) if p else None, "grid": bool(conf >= MIN_CONF and p > 0)}


def note(m: dict | None) -> str:
    if not m:
        return "-"
    if not m["grid"]:
        return f"no grid (conf {m['conf']:.2f})"
    return f"p {m['p']:.2f} vs k {m['k']} (|p-k|/k {m['rel']:.2f}), conf {m['conf']:.2f}"


def sil_height(gdir: Path) -> int | None:
    """The G-sil's height in canvas px (rows holding the flat grey), from the guide directory."""
    p = gdir / "guide_sil.png"
    if not p.exists():
        return None
    rows = np.nonzero((np.asarray(Image.open(p).convert("RGB")) == 128).all(-1).any(1))[0]
    return int(rows.max() - rows.min() + 1) if len(rows) else None


def scale(h_fig: int, h_sil: int | None, k: int, m: dict | None, mid: float) -> tuple[float, str | None]:
    """(s, path): path None (s = 1), 'pitch' (s = k / p) or 'arm-d' (s from the band midpoint)."""
    if not h_sil or abs(h_fig / h_sil - 1) <= SIZE_TOL:
        return 1.0, None
    if m and m["grid"] and abs((h_sil / h_fig) / (k / m["p"]) - 1) <= PITCH_TOL:
        return k / m["p"], "pitch"
    return mid * k / h_fig, "arm-d"


def align(x0: int, pad: int, s: float, m: dict | None, k: int, axis: int) -> int:
    """Move the window origin (big-canvas px; the raw sits at `pad`, scaled by s) onto the nearest grid line,
    by at most k // 2. Without a grid, unchanged."""
    if not m or not m["grid"]:
        return x0
    step, ph = s * m["p"], s * m["phase"][axis]
    n = round((x0 - pad - ph) / step)
    d = int(round(pad + ph + n * step)) - x0
    return x0 + int(np.clip(d, -(k // 2), k // 2))


def load(d: Path, n_try: int) -> dict | None:
    p = d / f"cut_g_{n_try}.json"
    return json.loads(p.read_text()).get("pitch") if p.exists() else None

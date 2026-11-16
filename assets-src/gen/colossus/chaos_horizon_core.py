"""F4 "the Core Laid Bare" and the F3 "cracking" state: offline paint variants of the approved F3 master (plan 5.2 V0-d
fallback: "a paint-patch variant of the core layer (0 images)"; user ruling 2026-11-16: the body splits open as the
fight nears its end). 0 Bedrock calls; two search_replace attempts (C10 whole render, C11 torso crop) changed far more
than the chest and were rejected (docs/ROSTER_LOG.md).

  python3 -I assets-src/gen/colossus/chaos_horizon_core.py [--out DIR]

Reads approved/chaos_forms/chaos_horizon/master.png (900x362) and writes, in DIR (default
gen/out/colossus/chaos_horizon/core):
  open.png / open_glow.png / open_mask.png    F4: the torso pulled apart along a jagged vertical split under the disc (the halves
                                              stretched apart, 0 at the band edges),
                                              a stepped molten core (white -> gold -> ember) in the gap, branching
                                              lava cracks, an additive core glow; the mask = art px that differ
  crack.png / crack_glow.png / crack_mask.png F3 below its own threshold: the same line as a thin glowing fissure with
                                              shorter cracks, nothing pulled apart
Only pixels inside the torso band (x CX +- BAND) change, and every colour is a 15-bit palette colour.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from gen import colossus_layers as CL  # noqa: E402
from gen import pixelize as PX  # noqa: E402

MASTER = HERE.parent / "approved" / "chaos_forms" / "chaos_horizon" / "master.png"
CX, TOP, BAND = 449, 224, 110                  # the split's centre column, its top (under the disc rim), the band
P = CL.BASE_PALETTE
WHITE, GOLD, EMBER, VOID = (np.array(P[k], np.uint8) for k in ("white", "gold", "ember", "void_black"))
ORANGE = PX.snap15(np.array([239.0, 140.0, 41.0])).astype(np.uint8)    # the molten mid tone (15-bit)
DEEP = PX.snap15(np.array([123.0, 33.0, 16.0])).astype(np.uint8)       # the split's rim, deep ember


def _half_width(y: np.ndarray, top: int, h: int, open_: bool, rng: np.random.Generator) -> np.ndarray:
    t = np.clip((y - top) / max(1, h - top), 0, 1)
    base = (3 + 22 * np.sin(np.pi * np.clip(t * 1.15, 0, 1)) ** 0.8) if open_ else np.full(t.shape, 1.0)
    jag = (np.repeat(rng.integers(-4, 5, size=len(y) // 3 + 1), 3)[:len(y)] if open_ else np.zeros(len(y), int))
    return np.maximum(1, np.round(base + jag)).astype(int)


def _centre(y: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    walk = np.cumsum(rng.integers(-1, 2, size=len(y)))
    return CX + np.clip(walk, -4, 4)


def variant(master: Image.Image, open_: bool, seed: int = 7) -> tuple[Image.Image, Image.Image, np.ndarray]:
    rng = np.random.default_rng(seed)
    src = np.asarray(master.convert("RGBA"))
    out = src.copy()
    h, w = src.shape[:2]
    ys = np.arange(TOP, h)
    hw, cx = _half_width(ys, TOP, h, open_, rng), _centre(ys, rng)
    glow = np.zeros_like(src)
    core = np.zeros((h, w), bool)
    for y, c, d in zip(ys, cx, hw):
        if not src[y, c, 3]:
            continue
        if open_:                                   # pull the halves apart: a linear stretch to 0 at the band edges
            lo, hi = c - BAND, c + BAND
            xr = np.arange(c + d, hi)
            out[y, c + d:hi] = src[y, np.round(c + (xr - c - d) * (hi - c) / (hi - c - d)).astype(int)]
            xl = np.arange(lo, c - d)
            out[y, lo:c - d] = src[y, np.round(lo + (xl - lo) * (c - lo) / (c - d - lo)).astype(int)]
        for x in range(c - d, c + d + 1):
            f = abs(x - c) / max(1, d)
            col = WHITE if f < 0.28 else GOLD if f < 0.55 else ORANGE if f < 0.85 else DEEP
            if open_ and 0.2 < f < 0.8 and rng.random() < 0.18:
                col = ORANGE if f < 0.5 else GOLD           # molten churn inside the split
            out[y, x, :3], out[y, x, 3] = col, 255
            core[y, x] = True
        for x in (c - d - 1, c + d + 1):            # the stone's torn rim: lit gold on the left (light from upper left)
            if 0 <= x < w and out[y, x, 3]:
                out[y, x, :3] = GOLD if x < c else EMBER
    # branching lava cracks from the split edges into the stone
    n = 14 if open_ else 8
    for _ in range(n):
        i = int(rng.integers(0, len(ys)))
        y, x = int(ys[i]), int(cx[i] + (hw[i] + 1) * (1 if rng.random() < 0.5 else -1))
        step = 1 if x > cx[i] else -1
        for _ in range(int(rng.integers(10, 34 if open_ else 20))):
            x += step
            y += int(rng.integers(-1, 2))
            if not (0 <= y < h and 0 <= x < w and abs(x - CX) < BAND - 4) or not out[y, x, 3]:
                break
            out[y, x, :3] = ORANGE if rng.random() < 0.6 else GOLD
            core[y, x] = True
    # the additive core glow: 1..3 px around the molten pixels, stepped
    ring = core.copy()
    for lvl, col in zip((191, 128, 64), ("gold", "ember", "ember")):
        k = ring.copy()
        k[1:] |= ring[:-1]; k[:-1] |= ring[1:]; k[:, 1:] |= ring[:, :-1]; k[:, :-1] |= ring[:, 1:]
        edge = k & ~ring
        glow[edge] = (*P[col], lvl)
        ring = k
    glow[core] = (*P["white"], 96)
    mask = (out != src).any(-1)
    return Image.fromarray(out, "RGBA"), Image.fromarray(glow, "RGBA"), mask


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=HERE.parent / "out" / "colossus" / "chaos_horizon" / "core")
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    master = Image.open(MASTER)
    for name, open_ in (("open", True), ("crack", False)):
        img, glow, mask = variant(master, open_)
        img.save(a.out / f"{name}.png")
        glow.save(a.out / f"{name}_glow.png")
        Image.fromarray((mask * 255).astype(np.uint8)).save(a.out / f"{name}_mask.png")
        ys, xs = np.where(mask)
        print(f"{name}: {int(mask.sum())} art px changed in x {xs.min()}..{xs.max()} y {ys.min()}..{ys.max()}; "
              f"palette {CL.palette_problems(img) or 'OK'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

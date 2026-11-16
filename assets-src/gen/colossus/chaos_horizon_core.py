"""F4 "the Core Laid Bare" and the F3 "cracking" state: offline paint variants of the approved F3 master (plan 5.2 V0-d
fallback: "a paint-patch variant of the core layer (0 images)"; user ruling 2026-11-16: the body splits open as the
fight nears its end). 0 Bedrock calls; two search_replace attempts (C10 whole render, C11 torso crop) changed far more
than the chest and were rejected (docs/ROSTER_LOG.md).

  python3 -I assets-src/gen/colossus/chaos_horizon_core.py [--out DIR]

Reads approved/chaos_forms/chaos_horizon/master.png (900x362) and writes, in DIR (default
gen/out/colossus/chaos_horizon/core):
  open.png / open_glow.png / open_mask.png    F4: the torso pulled apart along a jagged vertical split under the disc (the halves
                                              stretched apart, 0 at the band edges),
                                              a stone bridge under the disc, dark inner walls, a
                                              cluster-textured molten core, floating fragments, warm light on the
                                              nearby stone, short 2 px cracks, an additive core glow; the mask = art px that differ
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


def _smooth(v: np.ndarray, k: int) -> np.ndarray:
    return np.convolve(np.pad(v, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="valid")


def _cluster_noise(h: int, w: int, rng: np.random.Generator, cell: int = 3) -> np.ndarray:
    """Noise in cell x cell blocks (the stone's cluster scale)."""
    n = rng.random((h // cell + 2, w // cell + 2))
    return np.kron(n, np.ones((cell, cell)))[:h, :w]


def _warm(out: np.ndarray, src: np.ndarray, near: np.ndarray, rng: np.random.Generator, strength: float) -> None:
    """Stone pixels near the molten core take the core's light: dark -> DEEP, mid -> EMBER, light -> GOLD (palette
    colours only), in 2x2 clusters thinning with distance."""
    lum = src[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
    h, w = near.shape
    pick = _cluster_noise(h, w, rng, 2) < near * strength
    m = pick & (out[..., 3] > 0)
    out[m & (lum < 40), :3] = DEEP
    out[m & (lum >= 40) & (lum < 90), :3] = EMBER
    out[m & (lum >= 90), :3] = GOLD


def _dist(core: np.ndarray, n: int) -> np.ndarray:
    """1 at the core, falling to 0 at n px (4-neighbour steps)."""
    d = np.zeros(core.shape)
    ring = core.copy()
    for i in range(n):
        k = ring.copy()
        k[1:] |= ring[:-1]; k[:-1] |= ring[1:]; k[:, 1:] |= ring[:, :-1]; k[:, :-1] |= ring[:, 1:]
        d[k & ~ring] = 1 - (i + 1) / (n + 1)
        ring = k
    return d


def variant(master: Image.Image, open_: bool, seed: int = 7) -> tuple[Image.Image, Image.Image, np.ndarray]:
    rng = np.random.default_rng(seed)
    src = np.asarray(master.convert("RGBA"))
    out = src.copy()
    h, w = src.shape[:2]
    top = TOP + (18 if open_ else 10)               # a stone bridge under the disc rim
    ys = np.arange(top, h)
    t = (ys - top) / (h - top)
    cx = np.round(CX + _smooth(np.cumsum(rng.integers(-1, 2, size=len(ys))).astype(float), 3)).astype(int)
    cx = np.clip(cx, CX - 6, CX + 6)
    if open_:
        push = np.round(_smooth(3 + 24 * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 0.7, 6)).astype(int)
        jag_l = np.repeat(rng.integers(-3, 4, size=len(ys) // 3 + 1), 3)[:len(ys)]
        jag_r = np.repeat(rng.integers(-3, 4, size=len(ys) // 3 + 1), 3)[:len(ys)]
        left, right = cx - np.maximum(1, push + jag_l), cx + np.maximum(1, push + jag_r)
    else:
        zig = np.repeat(rng.integers(-1, 2, size=len(ys) // 2 + 1), 2)[:len(ys)]
        cx = np.clip(cx + zig, CX - 7, CX + 7)
        wid = np.repeat(rng.integers(0, 2, size=len(ys) // 4 + 1), 4)[:len(ys)]
        left, right = cx - wid, cx + 1
        push = np.zeros(len(ys), int)
    core = np.zeros((h, w), bool)
    noise = _cluster_noise(h, w, rng)
    for i, y in enumerate(ys):
        c, d, l, r = cx[i], push[i], left[i], right[i]
        if not src[y, c, 3]:
            continue
        if open_ and d > 0:                         # the halves pulled apart, stretched to 0 at the band edges
            lo, hi = c - BAND, c + BAND
            xr = np.arange(c + d, hi)
            out[y, c + d:hi] = src[y, np.round(c + (xr - c - d) * (hi - c) / (hi - c - d)).astype(int)]
            xl = np.arange(lo, c - d)
            out[y, lo:c - d] = src[y, np.round(lo + (xl - lo) * (c - lo) / (c - d - lo)).astype(int)]
        for x in range(l, r + 1):
            if open_:
                f = abs(x - (l + r) / 2) / max(1.0, (r - l) / 2)
                if f > 0.66:                         # the inner walls: shadowed on the left, lit ember on the right
                    col = VOID if x < c else DEEP
                else:
                    v = f + (noise[y, x] - 0.5) * 0.45
                    col = WHITE if v < 0.22 else GOLD if v < 0.45 else ORANGE if v < 0.68 else EMBER
            else:
                col = WHITE if (x == c and noise[y, x] < 0.55) else GOLD
            out[y, x, :3], out[y, x, 3] = col, 255
            core[y, x] = not (open_ and abs(x - (l + r) / 2) / max(1.0, (r - l) / 2) > 0.66)
        if open_:
            for x, col in ((l - 1, GOLD), (r + 1, EMBER)):   # the torn stone lips (light from the upper left)
                if 0 <= x < w and out[y, x, 3]:
                    out[y, x, :3] = col
    if open_:                                       # broken stone fragments floating in the molten core
        for _ in range(7):
            i = int(rng.integers(len(ys) // 6, len(ys) - 4))
            if right[i] - left[i] < 14:
                continue
            fy, fx = int(ys[i]), int(rng.integers(left[i] + 5, right[i] - 5))
            fw, fh = int(rng.integers(3, 6)), int(rng.integers(2, 5))
            out[fy:fy + fh, fx:fx + fw, :3] = VOID
            out[fy, fx:fx + fw, :3] = GOLD                   # the lit top edge
            out[fy + fh - 1, fx:fx + fw, :3] = DEEP
            core[fy:fy + fh, fx:fx + fw] = False
    # cracks at the stone's cluster scale: 2 px wide, short, stepping in 2 px
    for _ in range(9 if open_ else 5):
        i = int(rng.integers(len(ys) // 8, len(ys)))
        y = int(ys[i])
        side = 1 if rng.random() < 0.5 else -1
        x = int((right[i] + 2) if side > 0 else (left[i] - 2))
        for _ in range(int(rng.integers(3, 8 if open_ else 5))):
            for dy in (0, 1):
                for dx in (0, side):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and out[yy, xx, 3] and abs(xx - CX) < BAND - 6:
                        out[yy, xx, :3] = ORANGE
                        core[yy, xx] = True
            x += 2 * side
            y += int(rng.choice([-2, 0, 2]))
    near = _dist(core, 7 if open_ else 4)
    _warm(out, src, near, rng, 0.85 if open_ else 0.6)
    out[core] = np.where(out[core][:, 3:4] > 0, out[core], out[core])
    glow = np.zeros_like(src)
    g = _dist(core, 3)
    for lo_, lvl, col in ((0.6, 191, "gold"), (0.35, 128, "ember"), (0.01, 64, "ember")):
        sel = (g >= lo_) & (glow[..., 3] == 0) & ~core
        glow[sel] = (*P[col], lvl)
    glow[core] = (*P["white"], 80 if open_ else 48)
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

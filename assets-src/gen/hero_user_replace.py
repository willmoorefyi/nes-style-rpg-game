"""Pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md 2): one pose of a user hero sheet replaced by a separate user render that
is an *upscaled* pixel-art picture (soft alpha, thousands of colours: the death knight's leftward thrust).

The render has no clean pixel grid, so its art pixel is set by the user's rule: the figure's opaque height (alpha > 127)
equals a target pose's height on the sheet (`height_of`, READY). The grid starts at the opaque box's top-left corner.
Each art cell is opaque when at least half its render px are opaque (binary alpha), and takes the **majority** colour of
its opaque px, each first mapped to the nearest of the target row's own source colours (RGB squared distance): only the
row's palette, no resampling filter, no median cut, no k-means. The result is checked against the recipe's pinned size
and sha256 (of its RGBA bytes), so a changed render or converter fails loudly.
"""
from __future__ import annotations

import hashlib
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image


def load(gen: Path, spec: dict) -> np.ndarray:
    data = (gen / spec["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != spec["sha256"]:
        raise SystemExit(f"{spec['file']}: sha256 does not match the recipe")
    return np.asarray(Image.open(gen / spec["file"]).convert("RGBA")).astype(int)


def convert(render: np.ndarray, height: int, palette: np.ndarray) -> np.ndarray:
    """The native RGBA figure (source colours of `palette`), `height` rows tall."""
    op = render[..., 3] > 127
    ys, xs = np.nonzero(op)
    if not len(ys):
        raise SystemExit("replacement render: nothing opaque")
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    p = (y1 - y0 + 1) / height
    w = int(np.ceil((x1 - x0 + 1) / p))
    out = np.zeros((height, w, 4), np.uint8)
    pal = np.asarray(palette, int)
    for j in range(height):
        for i in range(w):
            r0, c0 = int(round(y0 + j * p)), int(round(x0 + i * p))
            blk = render[r0:int(round(y0 + (j + 1) * p)), c0:int(round(x0 + (i + 1) * p))]
            if not blk.size:
                continue
            m = blk[..., 3] > 127
            if m.mean() < 0.5:
                continue
            cols = blk[m][:, :3]
            near = ((cols[:, None, :] - pal[None, :, :]) ** 2).sum(-1).argmin(1)
            k = sorted(Counter(near.tolist()).items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            out[j, i, :3] = pal[k]
            out[j, i, 3] = 255
    return out


def native(gen: Path, spec: dict, height: int, palette: np.ndarray) -> np.ndarray:
    """The checked native replacement: converted, its size and sha256 equal to the recipe's pins."""
    fig = convert(load(gen, spec), height, palette)
    want = tuple(spec.get("native_size") or ())
    if want and (fig.shape[1], fig.shape[0]) != want:
        raise SystemExit(f"replacement: native {fig.shape[1]} x {fig.shape[0]}, the recipe pins {want[0]} x {want[1]}")
    sha = hashlib.sha256(np.ascontiguousarray(fig).tobytes()).hexdigest()
    if spec.get("native_sha256") and sha != spec["native_sha256"]:
        raise SystemExit(f"replacement: the native figure's sha256 {sha[:12]} differs from the recipe's pin")
    return fig


def native_sha(fig: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(fig).tobytes()).hexdigest()

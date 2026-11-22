"""Pass AR terrain pixelizer (AR-T, AR-T2): a Bedrock texture render -> a seamless, opaque, 15-bit ground tile, plus
the derived pieces (calm fresh water, the cold rock, the clump parts). Used by gen/terrain_cut.py; no Bedrock call.

  tile(render, n, k, ...)        window / crop -> quilted on its own wrap -> tone -> box downsample -> k-means (15-bit)
  remap_rank(t, ref, lo, hi)     t's colours, by luma rank, onto ref's ramp colours lo..hi-1 (calm deep water)
  recolor(t, hue, sat, val)      an HSV recolour, snapped to 15 bits (cold rock)
  remap_part(part, tex)          an RGBA part's opaque px, by luma rank, onto tex's ramp (the forest's tree_clump)
  conifer_clump(ramp, seed)      the taiga's edge clump: 4 code-drawn pines in the taiga's own ramp, snow on the lit side

Everything is deterministic: seeded k-means, seeded rngs, no hash order.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen.pixelize import kmeans, snap15

LUMA = np.array([0.299, 0.587, 0.114], np.float32)


def _seam(e: np.ndarray) -> np.ndarray:
    """Min-cost top-to-bottom path through cost e (H x W): a column index per row (8-connected DP)."""
    H, W = e.shape
    c = e.copy()
    back = np.zeros((H, W), np.int8)
    for y in range(1, H):
        p = c[y - 1]
        st = np.stack([np.concatenate([[np.inf], p[:-1]]), p, np.concatenate([p[1:], [np.inf]])])
        k = st.argmin(0)
        c[y] += st[k, np.arange(W)]
        back[y] = k - 1
    xs = np.zeros(H, int)
    xs[-1] = int(c[-1].argmin())
    for y in range(H - 1, 0, -1):
        xs[y - 1] = xs[y] + back[y, xs[y]]
    return xs


def quilt_wrap(a: np.ndarray, o: int | None = None) -> np.ndarray:
    """Make `a` (H x W x 3 float) tileable by quilting on its own wrap: the last `o` columns overlap the first and
    join along the min-error seam; then the same for the rows. Returns an (H - o) x (W - o) tile."""
    o = o or a.shape[1] // 7

    def cols(a: np.ndarray) -> np.ndarray:
        n = a.shape[1] - o
        left, right = a[:, :o], a[:, n:]
        xs = _seam(((left - right) ** 2).sum(2))
        m = np.arange(o)[None, :] < xs[:, None]        # left of the seam: the right strip (it continues column n-1)
        out = a[:, :n].copy()
        out[:, :o] = np.where(m[..., None], right, left)
        return out

    return cols(cols(a).transpose(1, 0, 2)).transpose(1, 0, 2)


def _tone(a: np.ndarray, gain: float, bias: float, sat: float, con: float, lift: float) -> np.ndarray:
    l = a.mean(2, keepdims=True)
    a = np.clip((l + (a - l) * sat) * gain + bias, 0, 255)
    if con != 1.0:
        m = a.reshape(-1, 3).mean(0)
        a = np.clip(m + (a - m) * con, 0, 255)
    if lift:                                            # raise the darks (gamma < 1 on luma, hue kept)
        l = (a @ LUMA)[..., None]
        a = np.clip(a * ((255 * (np.maximum(l, 1) / 255) ** (1 - lift)) / np.maximum(l, 1)), 0, 255)
    return a


def _quantize(small: np.ndarray, k: int, seed: int) -> np.ndarray:
    px = small.reshape(-1, 3).astype(np.float32)
    cent = np.unique(snap15(kmeans(px[::3], k, seed=seed)).astype(np.float32), axis=0)
    lab = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    return cent[lab].reshape(small.shape).astype(np.uint8)


def _despeckle(img: np.ndarray, passes: int = 1) -> np.ndarray:
    """A px whose 4 neighbours (wrapping) all share one other colour takes that colour."""
    out = img.copy()
    for _ in range(passes):
        nb = [np.roll(out, s, a) for s, a in ((1, 0), (-1, 0), (1, 1), (-1, 1))]
        same = np.all([np.all(n == nb[0], axis=2) for n in nb[1:]], axis=0)
        m = same & ~np.all(out == nb[0], axis=2)
        out[m] = nb[0][m]
    return out


def tile(render: Image.Image, n: int = 192, k: int = 9, gain: float = 1.0, bias: float = 0.0, sat: float = 1.0,
         crop: float = 1.0, seed: int = 0, speck: int = 1, win: list | None = None, con: float = 1.0,
         lift: float = 0.0) -> np.ndarray:
    """The ground tile (n x n RGB uint8, every colour 15-bit) from a render: `win` = [x0, y0, size] (fractions of the
    render's width) or a centred `crop`, quilted seamless, toned (gain, bias, sat, con, lift), box-downsampled,
    k-means quantized, despeckled."""
    im = render.convert("RGB")
    if win:
        x0, y0, sz = win
        w = im.width
        im = im.crop((int(x0 * w), int(y0 * w), int((x0 + sz) * w), int((y0 + sz) * w)))
    if crop < 1.0:
        s = int(im.width * crop)
        o = (im.width - s) // 2
        im = im.crop((o, o, o + s, o + s))
    a = _tone(quilt_wrap(np.asarray(im, np.float32)), gain, bias, sat, con, lift)
    small = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((n, n), Image.Resampling.BOX), np.float32)
    return _despeckle(_quantize(small, k, seed), speck)


def ramp(tex: np.ndarray) -> np.ndarray:
    """The texture's colours sorted dark to light (float32, N x 3)."""
    px = np.unique(tex.reshape(-1, 3), axis=0).astype(np.float32)
    return px[np.argsort(px @ LUMA, kind="stable")]


def remap_rank(t: np.ndarray, ref: np.ndarray, lo: int, hi: int) -> np.ndarray:
    """t's colours, by luma rank, onto ref's ramp colours lo .. hi - 1 (spread evenly)."""
    pal = ramp(ref)[lo:hi]
    cols = ramp(t)
    out = t.copy()
    for r, c in enumerate(cols):
        out[np.all(t == c.astype(np.uint8), axis=2)] = pal[min(len(pal) - 1, r * len(pal) // len(cols))]
    return out


def recolor(t: np.ndarray, hue: float, sat: float, val: float) -> np.ndarray:
    hsv = np.asarray(Image.fromarray(np.ascontiguousarray(t[..., :3])).convert("HSV")).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue * 255 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    rgb = np.asarray(Image.frombytes("HSV", (t.shape[1], t.shape[0]), hsv.astype(np.uint8).tobytes()).convert("RGB"))
    return snap15(rgb.astype(np.float32))


def remap_part(part: Image.Image, tex: np.ndarray, lo: float = 0.05, hi: float = 0.9) -> Image.Image:
    """The part's opaque px, by luma rank, onto the texture's ramp (its lo .. hi share): the approved tree_clump in
    the new forest's colours."""
    a = np.asarray(part.convert("RGBA")).copy()
    op = a[..., 3] > 127
    pal = ramp(tex)
    l = a[..., :3][op].astype(np.float32) @ LUMA
    q = np.argsort(np.argsort(l, kind="stable"), kind="stable") / max(1, len(l) - 1)
    i0, i1 = int(lo * len(pal)), max(int(hi * len(pal)), 1)
    a[..., :3][op] = pal[np.clip((i0 + q * (i1 - i0)).astype(int), 0, len(pal) - 1)].astype(np.uint8)
    a[..., 3] = np.where(op, 255, 0)
    return Image.fromarray(a)


SNOW = ((232, 240, 248), (184, 200, 216))
TRUNK = (74, 49, 41)
PINES = ((30, 15, 6, 4), (34, 17, 22, 0), (24, 13, 30, 18), (26, 14, 12, 20))   # (h, w, x, y) back to front


def _pine(h: int, w: int, pal: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """One pine, (h + 2) x (w + 2) RGBA with its outline: tiers of jagged triangles, lit from the left, snow on the
    lit upper edge of each tier, a 2 px trunk."""
    img = np.zeros((h, w, 4), np.uint8)
    cx, trunk = (w - 1) / 2, 3
    body = h - trunk
    tiers = max(3, h // 7)
    for t in range(tiers):
        y0 = int(t * body / (tiers + 0.6))
        y1 = min(int((t + 1.6) * body / (tiers + 0.6)), body)
        half_max = (w / 2) * (0.45 + 0.55 * (t + 1) / tiers)
        for y in range(y0, y1):
            f = (y - y0) / max(1, y1 - y0 - 1)
            half = 0.8 + half_max * f + rng.uniform(-0.6, 0.6)
            for x in range(w):
                dx = x - cx
                if abs(dx) <= half:
                    s = dx / max(half, 1)
                    shade = 0.75 - 0.55 * s - 0.25 * f + rng.uniform(-0.12, 0.12)
                    img[y, x, :3] = pal[int(np.clip(round(shade * (len(pal) - 2)), 0, len(pal) - 2)) + 1]
                    img[y, x, 3] = 255
        for y in range(y0, min(y0 + 2, y1)):
            for x in range(w):
                if img[y, x, 3] and x < cx and rng.random() < 0.45:
                    img[y, x, :3] = SNOW[0] if y == y0 else SNOW[1]
    tx = int(round(cx))
    img[body:h, tx - 1:tx + 1, :3] = TRUNK
    img[body:h, tx - 1:tx + 1, 3] = 255
    a = img[..., 3] > 0
    p = np.pad(a, 1)
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    out[1:-1, 1:-1] = img
    ring = np.pad(~a & (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]), 1)
    out[ring, :3] = pal[0]
    out[ring, 3] = 255
    return out


def conifer_clump(tex: np.ndarray, seed: int = 0) -> Image.Image:
    """The taiga's edge clump (48 x 48 RGBA, binary alpha): four pines in the taiga texture's ramp."""
    pal = ramp(tex)
    rng = np.random.default_rng(seed)
    cell = np.zeros((48, 48, 4), np.uint8)
    for h, w, x, y in PINES:
        p = _pine(h, w, pal, rng)
        ph, pw = p.shape[:2]
        y0 = min(y + (34 - h) // 2 + 8, 48 - ph)
        m = p[..., 3] > 0
        cell[y0:y0 + ph, x:x + pw][m] = p[m]
    cell[..., :3] = snap15(cell[..., :3].astype(np.float32))
    return Image.fromarray(cell)

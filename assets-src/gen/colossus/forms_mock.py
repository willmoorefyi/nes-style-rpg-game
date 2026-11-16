"""True-size stage mock of a colossus form master (C3 review aid, 0 calls): the art at its display scale on the staged
rim, an additive glow layer, optional floorFront, the party (battle-characters-ai idle row) and the message window and
bottom strip. Prints field coverage above the horizon, the art's edge contrast and the party band contrast.

  python3 -I assets-src/gen/colossus/forms_mock.py MASTER OUT --place X,Y [--scale 3] [--glow G] [--floor] [--label T]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(ROOT / "assets-src"))
from gen import colossus_review as CR  # noqa: E402

HOR = 370
LUM = np.array([0.299, 0.587, 0.114])


def _place(a: np.ndarray, x0: int, y0: int) -> np.ndarray:
    out = np.zeros((1080, 1920, 4), np.uint8)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    h, w = min(1080 - max(0, y0), a.shape[0] - sy0), min(1920 - max(0, x0), a.shape[1] - sx0)
    if h > 0 and w > 0:
        out[max(0, y0):max(0, y0) + h, max(0, x0):max(0, x0) + w] = a[sy0:sy0 + h, sx0:sx0 + w]
    return out


def _grow(m: np.ndarray, n: int) -> np.ndarray:
    for _ in range(n):
        k = m.copy(); k[1:] |= m[:-1]; k[:-1] |= m[1:]; k[:, 1:] |= m[:, :-1]; k[:, :-1] |= m[:, 1:]; m = k
    return m


def mock(master: Path, out: Path, place: tuple[int, int], scale: int = 3, glow: Path | None = None,
         floor: bool = False, label: str = "") -> dict:
    big = lambda im: np.asarray(im.convert("RGBA").resize((im.width * scale, im.height * scale),  # noqa: E731
                                                          Image.Resampling.NEAREST))
    bg = Image.open(ROOT / "assets/backgrounds/rim.webp").convert("RGBA")
    frame = np.asarray(bg).astype(float)
    body = _place(big(Image.open(master)), *place)
    al = body[..., 3:4] / 255.0
    frame[..., :3] = frame[..., :3] * (1 - al) + body[..., :3] * al
    gl = np.zeros_like(body)
    if glow:
        gl = _place(big(Image.open(glow)), *place)
        gl[body[..., 3] > 0] = 0
        frame[..., :3] = np.minimum(255, frame[..., :3] + gl[..., :3] * (gl[..., 3:4] / 255.0))
    fr = Image.fromarray(frame.astype(np.uint8))
    if floor:
        fl = Image.open(ROOT / "assets/backgrounds/rim_floor.webp").convert("RGBA")
        fr.alpha_composite(fl, (0, 0), ((fl.width - 1920) // 2, 0))
    CR._party(fr)
    d = ImageDraw.Draw(fr)
    for box in ((0, 0, 1919, 119), (0, 780, 1919, 1079)):
        d.rectangle(box, fill=(24, 32, 120, 255), outline=(240, 240, 240, 255), width=6)
    d.text((40, 40), label, fill=(255, 255, 255, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    fr.convert("RGB").save(out)
    rim = np.asarray(bg.convert("RGB")).astype(float) @ LUM
    lum = np.asarray(fr.convert("RGB")).astype(float) @ LUM
    m = body[..., 3] > 0
    rows = np.arange(1080)[:, None]
    field = (rows >= 120) & (rows < 780)
    ring = _grow(m, 6) & ~m & field
    edge = m & _grow(~m, 6) & field
    cov = (m | (gl[..., 3] > 0))[120:HOR]
    res = {"mock": str(out), "coverage_above_horizon": round(float(cov.mean()), 3),
           "art_share_of_field": round(float(m[120:780].mean()), 3),
           "edge_delta": round(float(rim[ring].mean() - lum[edge].mean()), 1) if ring.any() and edge.any() else None,
           "party_band_std": round(float(lum[300:760, 1340:1600].std()), 1),
           "rim_party_band_std": round(float(rim[300:760, 1340:1600].std()), 1)}
    print(res)
    return res


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("master"); ap.add_argument("out")
    ap.add_argument("--place", required=True); ap.add_argument("--scale", type=int, default=3)
    ap.add_argument("--glow"); ap.add_argument("--floor", action="store_true"); ap.add_argument("--label", default="")
    a = ap.parse_args(argv)
    x, y = (int(v) for v in a.place.split(","))
    mock(Path(a.master), Path(a.out), (x, y), a.scale, Path(a.glow) if a.glow else None, a.floor, a.label)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

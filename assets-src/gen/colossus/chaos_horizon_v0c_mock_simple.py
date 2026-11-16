"""V0-c stage mock: pix art at true size on rim + floorFront + party + message window + bottom strip.
usage: mock.py PIX SCALE PX PY OUT"""
import sys
from pathlib import Path
ROOT = Path("/Users/wlmmoor/personal/ff-game")
sys.path.insert(0, str(ROOT / "assets-src"))
import numpy as np
from PIL import Image, ImageDraw
from gen import colossus_review as CR

pix, scale, px, py, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
img = Image.open(pix).convert("RGBA")
frame = Image.open(ROOT / "assets/backgrounds/rim.webp").convert("RGBA")
big = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
layer = Image.new("RGBA", frame.size, (0, 0, 0, 0)); layer.paste(big, (px, py)); frame.alpha_composite(layer)
NOFLOOR = len(sys.argv) > 6
fl = Image.open(ROOT / "assets/backgrounds/rim_floor.webp").convert("RGBA")
if not NOFLOOR: frame.alpha_composite(fl, (0, 0), ((fl.width - 1920) // 2, 0))
CR._party(frame)
d = ImageDraw.Draw(frame)
for box in ((0, 0, 1919, 119), (0, 780, 1919, 1079)):
    d.rectangle(box, fill=(24, 32, 120, 255), outline=(240, 240, 240, 255), width=6)
d.text((40, 40), "Chaos, the Last Horizon, fills the sky!", fill=(255, 255, 255, 255))
frame.convert("RGB").save(out)
# measurements: canvas visible fraction, field coverage above horizon, edge contrast vs floor
cw, ch = big.size
vis = max(0, min(1920, px + cw) - max(0, px)) * max(0, min(780, py + ch) - max(0, py)) / (cw * ch)
L = np.asarray(layer)[..., 3] > 0
band = L[120:370, :]
lum = lambda a: (a[..., :3].astype(float) * [0.299, 0.587, 0.114]).sum(-1)
bg = lum(np.asarray(Image.open(ROOT / "assets/backgrounds/rim.webp").convert("RGB")))
art = lum(np.asarray(layer))
m = L.copy(); m[370:] = False
ring = np.zeros_like(m); k = m.copy()
for _ in range(6):
    k2 = k.copy(); k2[1:] |= k[:-1]; k2[:-1] |= k[1:]; k2[:, 1:] |= k[:, :-1]; k2[:, :-1] |= k[:, 1:]; k = k2
ring = k & ~m
inner = m.copy(); k = ~m
for _ in range(6):
    k2 = k.copy(); k2[1:] |= k[:-1]; k2[:-1] |= k[1:]; k2[:, 1:] |= k[:, :-1]; k2[:, :-1] |= k[:, 1:]; k = k2
edge = m & k
ed = float(bg[ring].mean() - art[edge].mean()) if ring.any() and edge.any() else float("nan")
print(f"mock {out}: art {img.size} x{scale} = {big.size} at ({px},{py}); visible fraction {vis:.1%}; "
      f"field coverage y120-370 {band.mean():.1%} (cols fully covered {band.all(0).mean():.1%}); "
      f"edge_delta (sky ring - art edge, above horizon) {ed:.1f}")

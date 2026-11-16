"""V0-c mocks for the F3 structure route (scratch, 0 calls).
usage: f3_mock.py PIX(900x360) RAW(1800x720) NOBG(1800x720) OUTDIR"""
import sys
from pathlib import Path
ROOT = Path("/Users/wlmmoor/personal/ff-game")
sys.path.insert(0, str(ROOT / "assets-src"))
import numpy as np
from PIL import Image, ImageDraw
from gen import colossus_review as CR
from gen import colossus_layers as CL

pix_p, raw_p, nobg_p, outdir = sys.argv[1:5]
outdir = Path(outdir)
import os
W, H, S, HOR = 900, 520, 3, 370
PLACE = tuple(int(v) for v in os.environ.get("PLACE", "-390,-300").split(","))
NOFLOOR = bool(os.environ.get("NOFLOOR"))
P = CL.BASE_PALETTE

pix = np.asarray(Image.open(pix_p).convert("RGBA"))
canvas = np.zeros((H, W, 4), np.uint8)
canvas[:360] = pix
canvas[360:] = pix[359]                      # the torso continues below (behind floorFront; reached only by the pan)

# glow: the raw render's corona (outside the cut, within 360 render px of the disc), stepped like `colossus.py glow`
raw = np.asarray(Image.open(raw_p).convert("RGB")).astype(float)
cut = np.asarray(Image.open(nobg_p).convert("RGBA"))[..., 3] >= 128
yy, xx = np.mgrid[:raw.shape[0], :raw.shape[1]]
lum = raw @ [0.299, 0.587, 0.114]
region = (~cut) & (np.hypot(xx - 900, yy - 335) < 420)
lum_a = np.asarray(Image.fromarray(np.where(region, lum, 0).astype(np.uint8)).resize((W, 360), Image.Resampling.BOX)).astype(float)
glow = np.zeros((H, W, 4), np.uint8)
for thr, lvl, col in ((55, 64, "ember"), (95, 128, "ember"), (150, 191, "gold"), (205, 255, "white")):
    m = lum_a >= thr
    glow[:360][m] = (*P[col], lvl)
glow[canvas[..., 3] > 0] = 0


def paint(c: np.ndarray) -> np.ndarray:
    """Offline proposal (0 calls): the chest fissure and the four moons, as the core and moon layers."""
    c = c.copy()
    im = Image.fromarray(c, "RGBA"); d = ImageDraw.Draw(im)
    top = 214
    for y in range(top, H):
        w = 1 + (y - top) // 60
        x = 450 + int(2 * np.sin(y * 0.15))
        d.line([(x - w - 1, y), (x + w + 1, y)], fill=(*P["gold"], 255))
        d.line([(x - w, y), (x + w, y)], fill=(*P["white"], 255))
    shades = {"orb_frost": [(33, 82, 99), P["orb_frost"], (115, 198, 214)],
              "ember": [(99, 49, 24), P["ember"], P["gold"]],
              "orb_abyss": [(16, 49, 57), (33, 99, 107), (66, 156, 156)],
              "orb_storm": [(99, 99, 107), P["orb_storm"], P["white"]]}
    for (sx, sy, r), key in zip(((470, 235, 62), (705, 318, 50), (1215, 262, 56), (1590, 200, 48)), shades):
        ax, ay, ar = (sx - PLACE[0]) / S, (sy - PLACE[1]) / S, r / S
        dk, md, lt = shades[key]
        d.ellipse((ax - ar - 1, ay - ar - 1, ax + ar + 1, ay + ar + 1), fill=(*P["void_black"], 255))
        d.ellipse((ax - ar, ay - ar, ax + ar, ay + ar), fill=(*dk, 255))
        d.ellipse((ax - ar, ay - ar, ax + ar * 0.6, ay + ar * 0.6), fill=(*md, 255))
        d.ellipse((ax - ar * 0.6, ay - ar * 0.6, ax - ar * 0.1, ay - ar * 0.1), fill=(*lt, 255))
    return np.asarray(im)


def mock(art: np.ndarray, name: str, label: str) -> None:
    bg = Image.open(ROOT / "assets/backgrounds/rim.webp").convert("RGBA")
    frame = np.asarray(bg).astype(float)
    big = lambda a: np.asarray(Image.fromarray(a, "RGBA").resize((W * S, H * S), Image.Resampling.NEAREST))  # noqa
    def place(a):
        out = np.zeros((1080, 1920, 4), np.uint8)
        x0, y0 = PLACE
        sx0, sy0 = max(0, -x0), max(0, -y0)
        h, w = min(1080 - max(0, y0), a.shape[0] - sy0), min(1920 - max(0, x0), a.shape[1] - sx0)
        out[max(0, y0):max(0, y0) + h, max(0, x0):max(0, x0) + w] = a[sy0:sy0 + h, sx0:sx0 + w]
        return out
    body, gl = place(big(art)), place(big(glow))
    al = body[..., 3:4] / 255.0
    frame[..., :3] = frame[..., :3] * (1 - al) + body[..., :3] * al
    ga = gl[..., 3:4] / 255.0
    frame[..., :3] = np.minimum(255, frame[..., :3] + gl[..., :3] * ga)       # additive (the glow layer only)
    fr = Image.fromarray(frame.astype(np.uint8), "RGBA")
    fl = Image.open(ROOT / "assets/backgrounds/rim_floor.webp").convert("RGBA")
    if not NOFLOOR:
        fr.alpha_composite(fl, (0, 0), ((fl.width - 1920) // 2, 0))
    CR._party(fr)
    d = ImageDraw.Draw(fr)
    for box in ((0, 0, 1919, 119), (0, 780, 1919, 1079)):
        d.rectangle(box, fill=(24, 32, 120, 255), outline=(240, 240, 240, 255), width=6)
    d.text((40, 40), label, fill=(255, 255, 255, 255))
    out = outdir / f"chaos_horizon_v0c_{name}.png"
    fr.convert("RGB").save(out)
    cov = ((body[..., 3] > 0) | (gl[..., 3] > 0))[120:HOR]
    rl = (np.asarray(bg.convert("RGB")).astype(float) @ [0.299, 0.587, 0.114])
    fl_ = np.asarray(fr.convert("RGB")).astype(float) @ [0.299, 0.587, 0.114]
    m = body[..., 3] > 0; m[HOR:] = False
    k = m.copy()
    for _ in range(6):
        k2 = k.copy(); k2[1:] |= k[:-1]; k2[:-1] |= k[1:]; k2[:, 1:] |= k[:, :-1]; k2[:, :-1] |= k[:, 1:]; k = k2
    ring = k & ~m & (np.arange(1080)[:, None] >= 120) & (np.arange(1080)[:, None] < HOR)
    inner = ~m; k = inner.copy()
    for _ in range(6):
        k2 = k.copy(); k2[1:] |= k[:-1]; k2[:-1] |= k[1:]; k2[:, 1:] |= k[:, :-1]; k2[:, :-1] |= k[:, 1:]; k = k2
    edge = m & k & (np.arange(1080)[:, None] >= 120)
    print(f"{out.name}: field above the horizon covered (art or glow) {cov.mean():.1%}, columns fully covered "
          f"{cov.all(0).mean():.1%}; art alone {(body[..., 3] > 0)[120:HOR].mean():.1%}; visible fraction 35.6%; "
          f"edge_delta (rim ring - art edge) {rl[ring].mean() - fl_[edge].mean():.1f}; party band std "
          f"{fl_[300:760, 1340:1600].std():.1f} (rim {rl[300:760, 1340:1600].std():.1f})")


outdir.mkdir(parents=True, exist_ok=True)
TAG = os.environ.get("TAG", "")
if not TAG: mock(canvas, "st_a", "V0-c A: structure render s2+sr4201, remove_bg, pix 900x360 (pitch 2), stepped corona glow")
mock(paint(canvas), "st_b" + TAG, "V0-c B" + TAG + ": offline-painted fissure + moons (proposal, 0 calls)" + (" | no floorFront, place " + str(PLACE) if TAG else ""))
sheet = Image.new("RGBA", (W, H), CR.GREY); sheet.alpha_composite(Image.fromarray(paint(canvas), "RGBA"))
sheet.alpha_composite(Image.fromarray(glow, "RGBA"))
sheet.resize((W * 2, H * 2), Image.Resampling.NEAREST).convert("RGB").save(outdir / "chaos_horizon_v0c_st_art_2x.png")
Image.fromarray(canvas, "RGBA").save(outdir / "chaos_horizon_v0c_st_canvas.png")
print("wrote", outdir / "chaos_horizon_v0c_st_art_2x.png")

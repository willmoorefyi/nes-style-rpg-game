"""F3 "Chaos, the Last Horizon": the composition control image for the structure-guided route (user ruling
2026-11-16, docs/ROSTER_LOG.md "Pass C - C2"; plan docs/CHAOS_FORMS_PLAN.md 3.0). 0 Bedrock calls.

  python3 -I assets-src/gen/colossus/chaos_horizon_control.py [--mock]

Draws, in art px of the F3 canvas (900x520; scale 3 at place (-390, -300) = 2700x1560 screen px, plan 4.2), flat
greyscale shapes on a plain ground:
  - an eclipse disc at top centre with a sky-filling fan of flame-corona streamers (no face: the two star
    points of 3.0 are left to the prompt, as two dots in a disc read as eyes),
  - two mountain-range shoulders whose ridgelines curve down like a planet's limb and run off both canvas sides,
  - a white-hot vertical chest fissure, four moons in front of the chest,
  - the left forearm lying along the horizon off the left edge, and the right arm reaching down to a continental hand
    whose claws grip the arena rim left of the party (the overhang part, drawn in front of floorFront).
No legs, no face. Writes, next to this script:
  chaos_horizon_control.png       1800x1040 (2x the art canvas), the image handed to the structure call
  chaos_horizon_control_art.png   900x520 RGBA art-px silhouette (ground transparent), for the stage mock
  chaos_horizon_control_hand.png  900x520 RGBA: the overhang (hand) only
With --mock: gen/out/colossus/review/chaos_horizon_control_mock.png, the silhouette at true size on the staged rim
(body behind floorFront, hand in front), the party, the message window and the bottom strip, and prints the coverage
of the field above the horizon (y 120..370), the visible fraction and the hand's screen box.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
W, H = 900, 520                      # art canvas (plan 3.0 / colossus.FORMS)
SCALE, PLACE = 3, (-390, -300)       # rest placement: screen = art * 3 + PLACE
K = 2                                # control image = 2x the art canvas
HORIZON_Y = 370                      # rim screen horizon
GROUND, BODY, RIDGE, ARM, HAND, CLAW = 168, 46, 92, 64, 58, 28
DISC, CORONA_A, CORONA_B, FISSURE, MOON, MOON_DARK = 0, 236, 206, 255, 214, 150


def art_y(screen_y: float) -> float:
    return (screen_y - PLACE[1]) / SCALE


def art_x(screen_x: float) -> float:
    return (screen_x - PLACE[0]) / SCALE


def _ridge(sx: float) -> float:
    """The shoulders' top edge in screen y for screen x: two mountain-range shoulders peaking near screen x 380 and
    1540 (y ~185), a saddle under the eclipse, and a planet-limb fall past both screen edges; jagged peaks on top."""
    t = (sx - 960) / 960                                    # -1 .. 1 across the screen
    shoulders = 185 + 120 * (abs(t) - 0.6) ** 2 / 0.36      # lowest-y (highest) at |t| = 0.6
    limb = 0 if abs(t) < 1 else 260 * (abs(t) - 1) ** 1.5   # curving away beyond the screen edges
    saddle = 95 * max(0.0, 1 - abs(t) / 0.32) ** 1.5        # dips under the eclipse
    peaks = 22 * abs(math.sin(sx * 0.031)) + 13 * abs(math.sin(sx * 0.013 + 1.3)) + 7 * abs(math.sin(sx * 0.071))
    return min(shoulders, 330) + limb + saddle - peaks


def draw(k: int = K) -> tuple[Image.Image, Image.Image, Image.Image]:
    """(control L at k x canvas, art RGBA at 1x, hand-only RGBA at 1x). Shapes are given in screen px at the rest
    placement and converted to art px (art = (screen - PLACE) / SCALE)."""
    img = Image.new("L", (W * k, H * k), GROUND)
    alpha = Image.new("L", (W * k, H * k), 0)
    hand_a = Image.new("L", (W * k, H * k), 0)
    d, da, dh = ImageDraw.Draw(img), ImageDraw.Draw(alpha), ImageDraw.Draw(hand_a)
    to = lambda x, y: (art_x(x) * k, art_y(y) * k)          # noqa: E731  screen px -> control px

    def poly(pts, fill, *, hand=False, edge=None):
        p = [to(x, y) for x, y in pts]
        d.polygon(p, fill=fill, outline=edge)
        da.polygon(p, fill=255)
        if hand:
            dh.polygon(p, fill=255)

    def circ(x, y, r, fill):
        (x0, y0), (x1, y1) = to(x - r, y - r), to(x + r, y + r)
        d.ellipse((x0, y0, x1, y1), fill=fill)
        da.ellipse((x0, y0, x1, y1), fill=255)

    ex, ey, er = 960, 205, 150                              # the eclipse (screen px): top cut by the message window
    # corona: a solid halo filling the sky, then flame streamers fanning out from the disc
    circ(ex, ey, 1250, CORONA_B - 40)
    circ(ex, ey, 520, CORONA_B - 10)
    for i in range(29):
        a0 = math.pi * (0.92 + 1.16 * i / 28)
        a1 = a0 + math.pi * 1.16 / 28 * 0.5
        r1 = 560 + 520 * ((i * 5) % 7) / 6
        tip = (a0 + a1) / 2 + 0.06 * math.sin(i * 2.3)
        poly([(ex + (er - 10) * math.cos(a0), ey + (er - 10) * math.sin(a0)),
              (ex + r1 * math.cos(tip), ey + r1 * math.sin(tip)),
              (ex + (er - 10) * math.cos(a1), ey + (er - 10) * math.sin(a1))], CORONA_A if i % 2 else CORONA_B + 14)
    circ(ex, ey, er + 26, 250)                              # the white inner ring
    # the body: under the shoulder ridgelines down to the canvas bottom
    xs = [PLACE[0] + i * 6 for i in range((W * SCALE) // 6 + 1)]
    top = [(x, _ridge(x)) for x in xs]
    poly([(xs[0], PLACE[1] + H * SCALE)] + top + [(xs[-1], PLACE[1] + H * SCALE)], BODY)
    for (x0, y0), (x1, y1) in zip(top, top[1:]):            # the lit ridge rim (light from the upper left)
        poly([(x0, y0), (x1, y1), (x1, y1 + 10), (x0, y0 + 10)], RIDGE)
    for x0, y0, x1, y1 in ((-200, 300, 640, 262), (1290, 262, 2150, 300), (-200, 352, 560, 330), (1400, 322, 2150, 352)):
        poly([(x0, y0), (x1, y1), (x1, y1 + 7), (x0, y0 + 7)], RIDGE)   # tectonic plate seams on the shoulders
    # arms: the left runs down off the left edge; the right reaches down and left to the hand on the rim
    poly([(150, 250), (330, 300), (40, 470), (-260, 420)], ARM, edge=RIDGE)
    poly([(1660, 250), (1820, 300), (1350, 380), (1150, 352)], ARM, edge=RIDGE)
    # the eclipse disc in the shoulders' saddle, and the chest fissure under it
    circ(ex, ey, er, DISC)
    poly([(ex - 10, ey + er + 8), (ex + 10, ey + er + 8), (ex + 40, 1260), (ex - 40, 1260)], FISSURE)
    # the hand (overhang, in front of floorFront): the back of the hand on the rim, four fingers and a thumb
    # hooked down over the edge of the floor, left of the party (x 1380+)
    poly([(1110, 330), (1350, 318), (1365, 392), (1100, 400)], HAND, hand=True, edge=RIDGE)
    for f, (fx, fw, flen) in enumerate(((1112, 50, 84), (1166, 50, 98), (1220, 50, 92), (1274, 50, 80))):
        poly([(fx, 388), (fx + fw, 388), (fx + fw - 6, 388 + flen * 0.55), (fx + fw - 14, 388 + flen),
              (fx + 10, 388 + flen + 4), (fx + 4, 388 + flen * 0.55)], HAND, hand=True, edge=CLAW)
        poly([(fx + 14, 388 + flen - 4), (fx + fw - 14, 388 + flen - 4), (fx + fw / 2, 388 + flen + 16)], CLAW,
             hand=True)                                     # the claw tip
    poly([(1060, 352), (1110, 340), (1112, 420), (1080, 460), (1050, 440)], HAND, hand=True, edge=CLAW)   # thumb
    # four moons in front of the chest, each about the party's size
    for mx, my, r in ((470, 235, 62), (705, 318, 50), (1215, 262, 56), (1590, 200, 48)):
        circ(mx, my, r, MOON)
        poly([(mx + r * 0.2, my - r * 0.95), (mx + r, my), (mx + r * 0.2, my + r * 0.95), (mx + r * 0.55, my)],
             MOON_DARK)
    art = Image.merge("RGBA", (img, img, img, alpha)).resize((W, H), Image.Resampling.BOX)
    art.putalpha(alpha.resize((W, H), Image.Resampling.BOX).point(lambda v: 255 if v >= 128 else 0))
    hand = art.copy()
    hand.putalpha(hand_a.resize((W, H), Image.Resampling.BOX).point(lambda v: 255 if v >= 128 else 0))
    return img, art, hand


def mock(art: Image.Image, hand: Image.Image) -> Path:
    sys.path.insert(0, str(ROOT / "assets-src"))
    from gen import colossus_review as CR
    bg = Image.open(ROOT / "assets" / "backgrounds" / "rim.webp").convert("RGBA")
    frame = bg.copy()
    big = lambda im: im.resize((W * SCALE, H * SCALE), Image.Resampling.NEAREST)   # noqa: E731
    body, front = Image.new("RGBA", frame.size), Image.new("RGBA", frame.size)
    body.paste(big(art), PLACE)
    front.paste(big(hand), PLACE)
    frame.alpha_composite(body)
    fl = Image.open(ROOT / "assets" / "backgrounds" / "rim_floor.webp").convert("RGBA")
    frame.alpha_composite(fl, (0, 0), ((fl.width - 1920) // 2, 0))
    frame.alpha_composite(front)
    CR._party(frame)
    d = ImageDraw.Draw(frame)
    for box in ((0, 0, 1919, 119), (0, 780, 1919, 1079)):
        d.rectangle(box, fill=(24, 32, 120, 255), outline=(240, 240, 240, 255), width=6)
    d.text((40, 40), "Chaos, the Last Horizon, fills the sky! (control silhouette)", fill=(255, 255, 255, 255))
    out = HERE.parent / "out" / "colossus" / "review" / "chaos_horizon_control_mock.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    frame.convert("RGB").save(out)
    op = np.asarray(body)[..., 3] > 0
    band = op[120:HORIZON_Y]
    cw, ch = W * SCALE, H * SCALE
    vis = (min(1920, PLACE[0] + cw) - max(0, PLACE[0])) * (min(780, PLACE[1] + ch) - max(0, PLACE[1])) / (cw * ch)
    ys, xs = np.where(np.asarray(front)[..., 3] > 0)
    lum = lambda a: (a[..., :3].astype(float) * [0.299, 0.587, 0.114]).sum(-1)     # noqa: E731
    fr, b = lum(np.asarray(frame)), lum(np.asarray(bg))
    px0, py0, px1, py1 = 1340, 300, 1600, 760
    print(f"mock {out.relative_to(ROOT)}: field above the horizon (y 120..{HORIZON_Y}) covered {band.mean():.1%} "
          f"(columns fully covered {band.all(0).mean():.1%}); visible fraction {vis:.1%}; hand box x {xs.min()}..{xs.max()} "
          f"y {ys.min()}..{ys.max()}; party band luma std {fr[py0:py1, px0:px1].std():.1f} (rim alone "
          f"{b[py0:py1, px0:px1].std():.1f})")
    return out


def main(argv: list[str]) -> int:
    ctrl, art, hand = draw()
    ctrl.save(HERE / "chaos_horizon_control.png")
    art.save(HERE / "chaos_horizon_control_art.png")
    hand.save(HERE / "chaos_horizon_control_hand.png")
    print(f"wrote control {ctrl.size}, art {art.size}, hand {hand.size} in {HERE.relative_to(ROOT)}")
    if "--mock" in argv:
        mock(art, hand)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

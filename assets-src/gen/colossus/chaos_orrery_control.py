"""F2 "Chaos, the Orrery": the composition control image for the structure-guided call (docs/CHAOS_FORMS_PLAN.md 3.2;
the route that made F3, docs/ROSTER_LOG.md "Pass C - C2/C3"). 0 Bedrock calls.

  python3 -I assets-src/gen/colossus/chaos_orrery_control.py

Flat greyscale shapes on a plain ground, 1320x900 = 3 render px per art px of the 440x300 F2 canvas (scale 3 = 1320x900
screen px): an eclipse head with a crown-corona fan (kin to F3's eclipse, smaller), a broad armoured torso from the
chest to the waist, three black-gold armillary rings around it (the front arcs over the torso, the back arcs behind),
four planets riding the rings, and two clawed gauntlets resting at the lower corners. No legs, no face.
Writes chaos_orrery_control.png next to this script.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
W, H = 1320, 900
GROUND, BODY, PLATE, RING, RING_BACK, DISC, CORONA, CORONA_B, ORB, CLAW = 170, 52, 96, 150, 92, 0, 238, 210, 222, 30


def ring_pts(cx, cy, rx, ry, rot, a0, a1, n=120):
    c, s = math.cos(rot), math.sin(rot)
    out = []
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


def draw() -> Image.Image:
    img = Image.new("L", (W, H), GROUND)
    d = ImageDraw.Draw(img)
    cx, hy, hr = 660, 215, 78
    rings = [(660, 470, 600, 150, math.radians(-12)), (660, 520, 520, 120, math.radians(16)),
             (660, 430, 150, 400, math.radians(8))]
    for r in rings:                                      # the back halves of the rings, behind everything
        d.line(ring_pts(*r, math.pi, 2 * math.pi), fill=RING_BACK, width=26)
    for i in range(19):                                  # the corona crown
        a0 = math.pi * (1.0 + i / 18)
        r1 = hr + 90 + 60 * ((i * 3) % 4) / 3
        tip = a0 + math.pi / 36
        d.polygon([(cx + (hr - 6) * math.cos(a0), hy + (hr - 6) * math.sin(a0)),
                   (cx + r1 * math.cos(tip), hy + r1 * math.sin(tip)),
                   (cx + (hr - 6) * math.cos(a0 + math.pi / 18), hy + (hr - 6) * math.sin(a0 + math.pi / 18))],
                  fill=CORONA if i % 2 else CORONA_B)
    d.ellipse((cx - hr - 12, hy - hr - 12, cx + hr + 12, hy + hr + 12), fill=250)
    # arms down to the gauntlets, torso, shoulder plates
    d.polygon([(470, 360), (380, 420), (210, 760), (330, 800), (520, 470)], fill=BODY, outline=PLATE)
    d.polygon([(850, 360), (940, 420), (1110, 760), (990, 800), (800, 470)], fill=BODY, outline=PLATE)
    d.polygon([(440, 330), (880, 330), (840, 620), (790, 900), (530, 900), (480, 620)], fill=BODY)
    for y in (420, 500, 580, 660, 740, 820):
        d.line([(480, y), (840, y - 10)], fill=PLATE, width=5)
    d.line([(660, 340), (660, 900)], fill=PLATE, width=5)
    d.polygon([(380, 320), (520, 300), (560, 380), (400, 430)], fill=PLATE, outline=CLAW)
    d.polygon([(940, 320), (800, 300), (760, 380), (920, 430)], fill=PLATE, outline=CLAW)
    d.ellipse((cx - hr, hy - hr, cx + hr, hy + hr), fill=DISC)
    for gx, sgn in ((270, -1), (1050, 1)):               # the gauntlets resting at the lower corners
        d.polygon([(gx - 120, 760), (gx + 120, 760), (gx + 140, 860), (gx - 140, 860)], fill=BODY, outline=PLATE)
        for f in range(5):
            fx = gx - 130 + f * 62
            d.polygon([(fx, 850), (fx + 46, 850), (fx + 30, 900), (fx + 12, 900)], fill=CLAW)
    for r in rings:                                      # the front halves, over the torso
        d.line(ring_pts(*r, 0, math.pi), fill=RING, width=26)
        d.line(ring_pts(*r, 0, math.pi), fill=PLATE, width=6)
    for (r, t) in ((rings[0], 0.35), (rings[0], 2.6), (rings[1], 1.2), (rings[2], 1.9)):
        x, y = ring_pts(*r, t, t, 1)[0]
        d.ellipse((x - 40, y - 40, x + 40, y + 40), fill=CLAW)
        d.ellipse((x - 34, y - 34, x + 34, y + 34), fill=ORB)
    return img


if __name__ == "__main__":
    out = HERE / "chaos_orrery_control.png"
    draw().save(out)
    print(f"wrote {out.relative_to(HERE.parent.parent.parent)} {W}x{H}")

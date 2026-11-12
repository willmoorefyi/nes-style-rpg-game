"""Pose guides: plain mannequins drawn from spec.py joints, used as structure-control images.

Tones encode depth: far limbs light grey, body mid grey, near limbs dark grey. The head carries a
face cue (lighter face plane + nose bump on the facing side, darker back of head) so the model
turns the face the right way. All poses of a sheet are drawn on one image so the model renders
one consistent character.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from gen import spec as S

FAR = (165, 165, 165)
BODY = (125, 125, 125)
NEAR = (90, 90, 90)
FACE = (200, 200, 200)
HAIR = (70, 70, 70)
BG = (255, 255, 255)
WEAPON = (60, 60, 60)


class _Pen:
    def __init__(self, d: ImageDraw.ImageDraw, ox: float, oy: float, s: float, mirror: bool = False) -> None:
        self.d, self.ox, self.oy, self.s, self.mirror = d, ox, oy, s, mirror

    def pt(self, p: S.Pt) -> tuple[float, float]:
        x = 32 - p[0] if self.mirror else p[0]
        return x * self.s + self.ox, p[1] * self.s + self.oy

    def cap(self, a: S.Pt, b: S.Pt, r: float, col) -> None:
        (ax, ay), (bx, by) = self.pt(a), self.pt(b)
        rr = r * self.s
        self.d.line([(ax, ay), (bx, by)], fill=col, width=int(rr * 2))
        for x, y in ((ax, ay), (bx, by)):
            self.d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col)

    def disc(self, c: S.Pt, rx: float, col, ry: float | None = None) -> None:
        x, y = self.pt(c)
        ry = rx if ry is None else ry
        self.d.ellipse([x - rx * self.s, y - ry * self.s, x + rx * self.s, y + ry * self.s], fill=col)

    def poly(self, pts: list[S.Pt], col) -> None:
        self.d.polygon([self.pt(p) for p in pts], fill=col)


def _draw(pose: S.Pose, robed: bool, size: tuple[int, int], s: float, ox: float, oy: float) -> Image.Image:
    img = Image.new("RGB", size, BG)
    pen = _Pen(ImageDraw.Draw(img), ox, oy, s)
    p = pose
    if not robed:
        pen.cap(p.hip_f, p.knee_f, 3.0, FAR); pen.cap(p.knee_f, p.foot_f, 2.6, FAR)
        pen.cap((p.foot_f[0] - 1.2, p.foot_f[1]), (p.foot_f[0] + 0.8, p.foot_f[1]), 2.4, FAR)
    pen.cap(p.sh_f, p.el_f, 2.4, FAR); pen.cap(p.el_f, p.hand_f, 2.2, FAR); pen.disc(p.hand_f, 2.8, FAR)
    pen.cap(p.chest, p.hip, 5.6, BODY)
    if robed:
        c = p.chest
        pen.poly([(c[0] - 7, c[1]), (c[0] + 7.5, c[1]), (c[0] + 10, 37.5), (c[0] - 10, 37.5)], BODY)
    else:
        pen.cap(p.hip_n, p.knee_n, 3.2, NEAR); pen.cap(p.knee_n, p.foot_n, 2.8, NEAR)
        pen.cap((p.foot_n[0] - 1.5, p.foot_n[1]), (p.foot_n[0] + 0.5, p.foot_n[1]), 2.5, NEAR)
    hx, hy = p.head
    pen.cap((hx + 0.5, hy + 4), (p.chest[0], p.chest[1] - 2), 2.4, BODY)
    pen.disc((hx, hy), 6.6, HAIR, ry=6.4)
    if p.face == "left":
        pen.disc((hx - 1.6, hy + 1.2), 4.8, FACE, ry=4.6)
        pen.disc((hx - 6.2, hy + 1.8), 1.1, FACE)
        pen.disc((hx - 3.4, hy + 0.6), 0.9, NEAR)
    elif p.face == "front":
        pen.disc((hx, hy + 1.4), 5.0, FACE, ry=4.6)
        pen.disc((hx - 2.2, hy + 0.8), 0.9, NEAR); pen.disc((hx + 2.2, hy + 0.8), 0.9, NEAR)
    if p.weapon:
        hand = p.hand_n if p.weapon_hand == "n" else p.hand_f
        tip = (hand[0] + p.weapon[0], hand[1] + p.weapon[1])
        x0, y0 = pen.pt(hand); x1, y1 = pen.pt(tip)
        pen.d.line([(x0, y0), (x1, y1)], fill=WEAPON, width=max(2, int(1.4 * s)))
    pen.cap(p.sh_n, p.el_n, 2.6, NEAR); pen.cap(p.el_n, p.hand_n, 2.4, NEAR); pen.disc(p.hand_n, 3.0, NEAR)
    return img


def _bbox(img: Image.Image) -> tuple[int, int, int, int]:
    m = np.asarray(img.convert("L")) < 250
    ys, xs = np.where(m)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def placement(geom: S.SheetGeom, poses: dict[str, S.Pose], order: list[str], robed: bool = False) -> tuple[float, float]:
    """Offsets (guide px) that centre the union of all poses horizontally and put the drawn bottom on bottom_row."""
    s = geom.guide_per_unit
    probe = (int(60 * s), int(60 * s))
    x0 = y1 = None
    x1 = -1
    y1 = -1
    x0 = 10 ** 9
    for name in dict.fromkeys(order):
        bx0, _, bx1, by1 = _bbox(_draw(poses[name], robed, probe, s, 14 * s, 4 * s))
        x0, x1, y1 = min(x0, bx0), max(x1, bx1), max(y1, by1)
    span = x1 - x0 + 1
    ox = 14 * s + (geom.cell_px[0] - span) / 2 - x0
    bottom = geom.guide_bottom_px if geom.guide_bottom_px is not None else (geom.bottom_row + 1) * geom.guide_per_native
    oy = 4 * s + bottom - (y1 + 1)
    return ox, oy


def draw_pose(pose: S.Pose, geom: S.SheetGeom, offsets: tuple[float, float], robed: bool = False) -> Image.Image:
    return _draw(pose, robed, geom.cell_px, geom.guide_per_unit, *offsets)


def sheet(poses: dict[str, S.Pose], order: list[str], geom: S.SheetGeom, robed: bool = False) -> Image.Image:
    cols, rows = geom.layout
    cw, ch = geom.cell_px
    out = Image.new("RGB", (cw * cols, ch * rows), BG)
    off = placement(geom, poses, order, robed)
    for i, name in enumerate(order):
        out.paste(draw_pose(poses[name], geom, off, robed), ((i % cols) * cw, (i // cols) * ch))
    return out


def cell_masks(guide: Image.Image, geom: S.SheetGeom) -> list[np.ndarray]:
    g = np.asarray(guide.convert("L")) < 250
    cols, rows = geom.layout
    cw, ch = geom.cell_px
    return [g[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw] for i in range(cols * rows)]

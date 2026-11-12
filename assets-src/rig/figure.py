"""Battle-size (40x40 native) figures in the chunky Pixel Remaster style.

Characters face LEFT in a three-quarter view. A `Look` (from characters.py) says what the
character wears; a `Pose` says where the joints are. `render(look, pose)` draws costume layers
back-to-front with the shape rasteriser in raster.py.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from PIL import Image

import characters as C
from rig.raster import Stage

W, H = 40, 46
OX = 8
OY = 5                       # figures are authored in a 32-wide space, shifted right to leave weapon room
INK = (6, 4, 10)
INKRING = (28, 6, 12)
Pt = tuple[float, float]


@dataclass
class Pose:
    head: Pt = (13.0, 10.0)
    chest: Pt = (15.0, 19.5)
    hip: Pt = (16.0, 28.0)
    sh_n: Pt = (11.5, 18.0)
    el_n: Pt = (7.5, 22.5)
    hand_n: Pt = (5.5, 19.0)
    sh_f: Pt = (19.5, 18.0)
    el_f: Pt = (22.0, 23.0)
    hand_f: Pt = (18.0, 25.0)
    hip_n: Pt = (14.0, 28.5)
    knee_n: Pt = (11.0, 32.5)
    foot_n: Pt = (9.0, 36.5)
    hip_f: Pt = (17.5, 28.5)
    knee_f: Pt = (20.0, 32.5)
    foot_f: Pt = (22.0, 36.5)
    weapon: Pt | None = None      # vector from the near hand to the weapon tip
    weapon_far: bool = False      # hold the weapon in the far hand
    hem: float = 37.5             # robe hem line
    eyes_closed: bool = False
    sway: float = 0.0

    def moved(self) -> "Pose":
        def mv(v):
            return (v[0] + OX, v[1] + OY) if isinstance(v, tuple) else v
        d = {k: mv(v) for k, v in self.__dict__.items()}
        d['hem'] = self.hem + OY
        return Pose(**d)


# ───────────────────────────── poses ─────────────────────────────

READY = Pose()
ATTACK = Pose(head=(10.5, 10.5), chest=(12.5, 19.5), hip=(15.5, 28.5),
              sh_n=(9.0, 18.5), el_n=(5.0, 20.0), hand_n=(1.5, 18.0),
              sh_f=(17.0, 18.0), el_f=(21.5, 20.5), hand_f=(24.0, 16.5),
              hip_n=(13.5, 28.5), knee_n=(7.5, 31.5), foot_n=(4.5, 36.5),
              hip_f=(16.5, 28.5), knee_f=(22.0, 33.0), foot_f=(27.0, 36.5), weapon=(-7.0, -1.5))
CAST = Pose(sh_n=(11.0, 17.5), el_n=(6.5, 13.0), hand_n=(6.0, 7.5),
            sh_f=(19.5, 18.0), el_f=(22.0, 22.0), hand_f=(20.5, 25.0), weapon=(0.0, -9.0))
HURT = Pose(head=(16.5, 10.5), chest=(17.0, 19.5), hip=(16.5, 28.0),
            sh_n=(13.0, 18.0), el_n=(9.5, 15.0), hand_n=(8.5, 10.5),
            sh_f=(21.0, 18.0), el_f=(25.5, 20.0), hand_f=(27.5, 15.5),
            hip_n=(15.0, 28.5), knee_n=(12.5, 32.5), foot_n=(10.5, 36.5),
            hip_f=(18.0, 28.5), knee_f=(22.5, 32.0), foot_f=(25.5, 35.5), eyes_closed=True)
DOWN = Pose(head=(11.0, 22.0), chest=(13.5, 27.0), hip=(18.0, 31.5),
            sh_n=(11.0, 25.5), el_n=(8.0, 29.0), hand_n=(6.0, 32.5),
            sh_f=(17.0, 25.0), el_f=(15.5, 29.5), hand_f=(12.5, 33.0),
            hip_n=(16.0, 32.0), knee_n=(10.0, 34.5), foot_n=(5.5, 37.0),
            hip_f=(19.5, 32.0), knee_f=(24.0, 35.0), foot_f=(28.0, 37.0), hem=38.0, eyes_closed=True)
VICTORY = Pose(sh_n=(11.0, 17.5), el_n=(8.0, 11.5), hand_n=(7.5, 6.0),
               sh_f=(19.5, 18.0), el_f=(23.0, 22.5), hand_f=(20.0, 26.0), weapon=(0.0, -9.0))
CASTER_BASE = dict(head=(13.0, 13.0), chest=(15.0, 21.5), hip=(16.0, 29.0), sh_n=(11.0, 20.5), sh_f=(19.5, 20.5),
                   el_n=(8.0, 25.0), hand_n=(8.5, 22.0), el_f=(21.5, 25.0), hand_f=(18.0, 26.0))


def caster(pose: Pose) -> Pose:
    """Casters stand shorter (robes hide the legs) so tall hats fit the canvas."""
    d = dict(pose.__dict__)
    dy = {"head": 3.0, "chest": 2.0, "sh_n": 2.5, "sh_f": 2.5}
    for k, v in dy.items():
        d[k] = (d[k][0], d[k][1] + v)
    for k in ("el_n", "hand_n", "el_f", "hand_f"):
        d[k] = (d[k][0], d[k][1] + (2.0 if pose is not VICTORY and pose is not CAST else 3.0))
    return Pose(**d)


POSES = {"ready": READY, "attack": ATTACK, "cast": CAST, "hurt": HURT, "down": DOWN, "victory": VICTORY}


# ───────────────────────────── palette ─────────────────────────────

class K:
    """Resolved colour ramps for a Look."""

    def __init__(self, look: C.Look) -> None:
        self.skin = look.skin
        self.hair = C.shade_ramp(*look.hair) if look.hair else None
        self.cloth = C.shade_ramp(*look.cloth)
        self.trim = C.shade_ramp(*look.trim)
        self.pants = C.shade_ramp(*look.pants)
        self.boots = C.shade_ramp(*look.boots)
        self.gear = C.shade_ramp(*look.gear_color)
        self.gear2 = C.shade_ramp(*look.gear_color2)
        self.cape = C.shade_ramp(*look.cape) if look.cape else None
        self.weapon = C.shade_ramp(*look.weapon_color)
        self.steel = C.shade_ramp(20, 20, 22)
        self.gold = C.shade_ramp(27, 22, 6)
        self.wood = C.shade_ramp(15, 9, 5)
        self.dark = C.shade_ramp(6, 4, 7)


# ───────────────────────────── primitives ─────────────────────────────

def limb(st: Stage, a: Pt, b: Pt, r0: float, r1: float, ramp_, sigma: float = 1.1, ring=True):
    return st.paint(st.shape().capsule(a, b, r0, r1), ramp_, sigma=sigma, ring=ring)


def boot(st: Stage, foot: Pt, ramp_, size: float = 1.0, left: bool = True):
    x, y = foot
    st.paint(st.shape().ellipse(x - (0.8 if left else -0.8) * size, y - 0.6, 3.7 * size, 2.5 * size), ramp_, sigma=1.0)


def hand(st: Stage, p: Pt, skin, r: float = 3.0):
    st.paint(st.shape().circle(p[0], p[1], r), skin, sigma=1.1)


def face(st: Stage, hx: float, hy: float, skin, brow, closed: bool = False, eye=(52, 30, 40)):
    """Hand-placed three-quarter face (looking left): one big eye, brow, nose and mouth."""
    x, y = int(round(hx)), int(round(hy))
    white = (252, 248, 244)
    if closed:
        st.stamp(x - 5, y + 1, ["ddd"], {"d": eye})
        st.stamp(x - 5, y - 1, ["bbb"], {"b": brow})
    else:
        st.stamp(x - 5, y - 1, ["bbb"], {"b": brow})
        st.stamp(x - 5, y, ["ddw", "ddw", "ddw"], {"d": eye, "w": white})
        st.stamp(x - 4, y, ["h"], {"h": white})
    st.stamp(x - 7, y + 2, ["n"], {"n": skin[4]})
    st.stamp(x - 5, y + 4, ["mm"], {"m": (150, 58, 58)})


# ───────────────────────────── hair & headgear ─────────────────────────────

def _carve_face(sh, hx, hy, ext=1.8):
    sh.poly([(hx - 9.0, hy - 2.0), (hx - 6.0, hy - 2.4), (hx - 3.6, hy - 3.0), (hx - 0.8, hy - 1.6),
             (hx + ext, hy + 0.4), (hx + ext, hy + 9.0), (hx - 9.0, hy + 9.0)], fill=0)


def hair(st: Stage, look: C.Look, k: K, hx: float, hy: float) -> None:
    if look.hair_style == "bald" or not k.hair:
        return
    sh = st.shape()
    style = look.hair_style
    sh.ellipse(hx + 1.2, hy - 2.4, 7.0, 6.2)
    if style == "spiky":
        for tri in (
            [(hx + 5.5, hy - 5.0), (hx + 10.5, hy - 6.5), (hx + 7.0, hy - 0.5)],
            [(hx + 6.5, hy - 0.5), (hx + 10.8, hy + 1.5), (hx + 6.2, hy + 3.8)],
            [(hx + 2.0, hy - 6.5), (hx + 5.5, hy - 11.0), (hx + 6.0, hy - 5.0)],
            [(hx - 2.5, hy - 6.5), (hx - 2.0, hy - 10.5), (hx + 1.5, hy - 7.0)],
        ):
            sh.poly(tri)
    elif style == "long":
        sh.poly([(hx + 1.0, hy - 2), (hx + 8.0, hy - 1), (hx + 9.5, hy + 9), (hx + 6.0, hy + 12), (hx + 1.0, hy + 8)])
    elif style == "bun":
        sh.circle(hx + 4.8, hy - 8.2, 2.7)
    else:  # short
        sh.poly([(hx + 4.0, hy - 3.0), (hx + 8.5, hy + 1.0), (hx + 7.0, hy + 4.5), (hx + 3.0, hy + 3.5)])
    _carve_face(sh, hx, hy, ext=1.4 if style != "long" else 1.0)
    st.paint(sh, k.hair, sigma=1.3)


def headgear(st: Stage, look: C.Look, k: K, hx: float, hy: float) -> None:
    g, g2, t = k.gear, k.gear2, k.trim
    kind = look.gear
    if kind is None:
        return
    if kind in ("helm", "plume_helm"):
        sh = st.shape().ellipse(hx + 0.8, hy - 1.2, 7.0, 6.6)
        _carve_face(sh, hx, hy + 1.2, ext=-1.0)
        sh.poly([(hx - 9, hy + 3.0), (hx - 1.0, hy + 3.0), (hx - 1.0, hy + 9), (hx - 9, hy + 9)], fill=0)
        st.paint(sh, g, sigma=1.3)
        st.paint(st.shape().poly([(hx + 1.0, hy + 3.0), (hx + 6.5, hy + 3.0), (hx + 6.0, hy + 8.0), (hx + 1.5, hy + 7.0)]), g, sigma=0.9)
        st.paint(st.shape().rect(hx - 7.0, hy - 0.5, hx - 5.0, hy + 4.5), g, sigma=0.6)    # nasal bar
        if kind == "plume_helm":
            st.paint(st.shape().poly([(hx + 0.5, hy - 7.2), (hx + 5.0, hy - 11.5), (hx + 11.5, hy - 9.0), (hx + 12.5, hy - 3.0),
                                      (hx + 9.0, hy - 6.0), (hx + 5.0, hy - 4.8)]), g2, sigma=1.1)
    elif kind in ("bandana", "headband"):
        thick = 2.6 if kind == "bandana" else 1.8
        st.paint(st.shape().poly([(hx - 6.0, hy - 3.4), (hx - 6.0, hy - 3.4 + thick), (hx + 7.5, hy - 2.0 + thick), (hx + 7.5, hy - 2.0)]), g, sigma=0.8)
        st.paint(st.shape().poly([(hx + 6.5, hy - 2.0), (hx + 11.5, hy + 0.5), (hx + 10.5, hy + 2.5), (hx + 6.5, hy + 0.8)]), g, sigma=0.7)
        st.paint(st.shape().poly([(hx + 7.0, hy - 0.5), (hx + 11.0, hy + 4.5), (hx + 9.0, hy + 5.5), (hx + 6.5, hy + 1.5)]), g, sigma=0.7)
    elif kind == "hood":
        sh = st.shape().ellipse(hx + 1.2, hy - 0.4, 8.2, 8.0)
        sh.poly([(hx - 10, hy - 1.5), (hx - 6.4, hy - 1.4), (hx - 3.0, hy - 2.4), (hx - 0.4, hy - 0.8),
                 (hx + 1.0, hy + 1.5), (hx + 1.0, hy + 9.5), (hx - 10, hy + 9.5)], fill=0)
        st.paint(sh, g, sigma=1.5)
        st.paint(st.shape().poly([(hx - 7.0, hy - 1.7), (hx - 4.0, hy - 2.8), (hx - 0.6, hy - 1.0), (hx + 1.2, hy + 1.6),
                                  (hx - 0.2, hy + 1.6), (hx - 2.6, hy - 0.2), (hx - 4.4, hy - 0.8), (hx - 7.0, hy - 0.2)]), t, sigma=0.5, ring=False)
    elif kind == "witch":
        st.paint(st.shape().poly([(hx - 5.5, hy - 4.0), (hx + 8.5, hy - 3.0), (hx + 6.0, hy - 8.5), (hx + 4.0, hy - 12.0),
                                  (hx + 7.5, hy - 14.0), (hx + 0.5, hy - 12.5), (hx - 3.5, hy - 8.0)]), g, sigma=1.2)
        st.paint(st.shape().ellipse(hx + 1.4, hy - 3.4, 11.8, 2.9), g, sigma=1.0)
        st.paint(st.shape().rect(hx - 4.5, hy - 6.4, hx + 6.0, hy - 4.8), t, sigma=0.5)
    elif kind == "feather":
        st.paint(st.shape().ellipse(hx + 1.0, hy - 3.6, 10.5, 2.7, angle=-6), g, sigma=1.0)
        st.paint(st.shape().ellipse(hx + 1.6, hy - 6.2, 5.6, 4.0), g, sigma=1.2)
        st.paint(st.shape().rect(hx - 3.0, hy - 5.4, hx + 6.8, hy - 4.0), t, sigma=0.5)
        st.paint(st.shape().poly([(hx + 5.0, hy - 6.5), (hx + 9.5, hy - 11.5), (hx + 13.0, hy - 12.5), (hx + 11.0, hy - 9.0), (hx + 9.0, hy - 6.0)]), g2, sigma=0.8)
    elif kind == "crown":
        st.paint(st.shape().poly([(hx - 4.0, hy - 5.0), (hx - 4.0, hy - 9.5), (hx - 1.5, hy - 7.0), (hx + 1.0, hy - 10.0),
                                  (hx + 3.5, hy - 7.0), (hx + 6.0, hy - 9.5), (hx + 6.0, hy - 5.0)]), k.gold, sigma=0.9)
    elif kind == "round_hat":
        st.paint(st.shape().ellipse(hx + 1.0, hy - 4.2, 6.2, 4.6), g, sigma=1.3)
        st.paint(st.shape().ellipse(hx + 0.6, hy - 2.2, 8.4, 1.8), g, sigma=0.8)


# ───────────────────────────── body parts ─────────────────────────────

def sleeve_ramp(look: C.Look, k: K):
    return k.skin if look.outfit == "gi" else k.cloth


def arm(st: Stage, look: C.Look, k: K, sh: Pt, el: Pt, hd: Pt, near: bool):
    sleeve = sleeve_ramp(look, k)
    ring = INKRING if look.outfit not in ("gi",) else True
    limb(st, sh, el, 2.8 if near else 2.6, 2.5 if near else 2.4, sleeve, ring=ring)
    limb(st, el, hd, 2.5 if near else 2.4, 2.3 if near else 2.2, sleeve if look.outfit not in ("armor",) else k.steel, ring=ring, sigma=0.9)
    # cuff / gauntlet band near the wrist
    mx, my = el[0] + (hd[0] - el[0]) * 0.62, el[1] + (hd[1] - el[1]) * 0.62
    if look.outfit in ("armor", "gi", "robe", "coat"):
        st.paint(st.shape().circle(mx, my, 2.4), k.trim if look.outfit != "armor" else k.steel, sigma=0.7)
    hand(st, hd, k.skin, 3.1 if near else 2.9)


def leg(st: Stage, look: C.Look, k: K, hip: Pt, knee: Pt, foot: Pt, near: bool):
    pants = k.pants if look.outfit not in ("armor",) else k.cloth
    limb(st, hip, knee, 3.4 if near else 3.2, 2.9 if near else 2.8, pants)
    limb(st, knee, foot, 2.9 if near else 2.8, 2.6 if near else 2.5, pants)
    if look.outfit in ("armor", "gi"):
        st.paint(st.shape().ellipse(foot[0] - 0.3, foot[1] - 3.2, 3.0, 1.1), k.trim if look.outfit == "gi" else k.steel, sigma=0.7)
    boot(st, foot, k.boots)


def torso(st: Stage, look: C.Look, k: K, p: Pose):
    o = look.outfit
    c = p.chest
    if o in ("robe", "dress"):
        sway = p.sway
        top = [(c[0] - 6.8, c[1] - 3.2), (c[0] + 7.0, c[1] - 3.0)]
        hem = p.hem
        pts = [top[0], (c[0] - 7.4, c[1] + 4), (c[0] - 10.5 + sway, hem - 2.0), (c[0] - 9.5 + sway, hem),
               (c[0] + 9.5 + sway, hem), (c[0] + 10.5 + sway, hem - 2.0), (c[0] + 7.6, c[1] + 4), top[1]]
        st.paint(st.shape().poly(pts), k.cloth, sigma=2.0)
        st.paint(st.shape().poly([(c[0] - 9.6 + sway, hem - 1.6), (c[0] + 9.6 + sway, hem - 1.6), (c[0] + 9.5 + sway, hem), (c[0] - 9.5 + sway, hem)]), k.trim, sigma=0.5)
        if look.outfit == "robe":
            # tabard: a narrow panel at the chest widening to the hem, so trim never forms a cross
            st.paint(st.shape().poly([(c[0] - 1.8, c[1] - 3.4), (c[0] + 1.8, c[1] - 3.4), (c[0] + 5.5 + sway, hem - 1.5), (c[0] - 4.8 + sway, hem - 1.5)]),
                     k.trim, sigma=0.7, ring=False)
        else:
            st.paint(st.shape().rect(c[0] - 6.4, c[1] + 3.6, c[0] + 7.2, c[1] + 5.4), k.cloth, sigma=0.6)
        return
    st.paint(st.shape().capsule(c, p.hip, 5.9, 4.7), k.skin if o == "gi" else k.cloth, sigma=1.7)
    if o == "gi":
        st.paint(st.shape().poly([(c[0] - 5.0, c[1] - 4), (c[0] - 1.0, c[1] - 4), (c[0] + 2.5, c[1] + 6.5), (c[0] - 0.5, c[1] + 7)]), k.cloth, sigma=0.7)
        st.paint(st.shape().poly([(c[0] + 6.0, c[1] - 4), (c[0] + 2.0, c[1] - 4), (c[0] + 2.5, c[1] + 6.5), (c[0] + 5.5, c[1] + 7)]), k.cloth, sigma=0.7)
    if o == "coat":
        st.paint(st.shape().rect(c[0] - 0.8, c[1] - 3, c[0] + 1.6, p.hip[1] + 1.0), k.trim, sigma=0.5)
    if o == "armor":
        st.paint(st.shape().ellipse(c[0] - 1.0, c[1] - 0.5, 4.4, 4.6), k.steel if look.cloth != (24, 5, 6) else k.cloth, sigma=1.3)
        st.paint(st.shape().ellipse(p.sh_f[0] - 0.5, p.sh_f[1] - 1.2, 2.6, 2.2), k.steel, sigma=0.9)
    if o == "apron":
        st.paint(st.shape().poly([(c[0] - 3.5, c[1] - 1), (c[0] + 4.0, c[1] - 1), (c[0] + 5.5, p.hip[1] + 5), (c[0] - 5.0, p.hip[1] + 5)]), C.shade_ramp(28, 28, 26), sigma=1.2)
    # belt
    belt = k.trim if o in ("tunic", "gi", "coat") else k.gold
    st.paint(st.shape().rect(c[0] - 4.8, p.hip[1] - 2.2, c[0] + 5.8, p.hip[1] + 0.4), belt, sigma=0.7)
    st.paint(st.shape().rect(c[0] - 1.0, p.hip[1] - 2.6, c[0] + 1.2, p.hip[1] + 0.8), k.steel if o != "gi" else k.trim, sigma=0.5)
    # chest strap
    if o in ("armor", "tunic"):
        strap = st.shape().poly([(c[0] - 5.5, c[1] - 3.6), (c[0] - 3.0, c[1] - 4.4), (c[0] + 6.0, c[1] + 7.0), (c[0] + 3.5, c[1] + 7.8)])
        st.paint(strap, k.dark, sigma=0.6, ring=False)


def weapon(st: Stage, look: C.Look, k: K, hand_pt: Pt, vec: Pt):
    kind = look.weapon
    if kind is None:
        return
    hx, hy = hand_pt
    tx, ty = hx + vec[0], hy + vec[1]
    if kind in ("sword", "rapier"):
        blade = C.shade_ramp(24, 24, 28) if kind == "rapier" else k.steel
        st.paint(st.shape().capsule((hx, hy), (tx, ty), 1.3, 0.8), blade, sigma=0.5, tones=4)
        st.paint(st.shape().capsule((hx + vec[1] * 0.0 - 2.0, hy + 1.0), (hx + 2.0, hy - 1.0), 0.9, 0.9), k.gold, sigma=0.4)
    elif kind == "dagger":
        st.paint(st.shape().capsule((hx, hy), (hx + vec[0] * 0.55, hy + vec[1] * 0.55), 1.2, 0.6), k.steel, sigma=0.5)
    elif kind in ("staff", "rod", "cane"):
        bx, by = hx - vec[0] * 0.4, hy - vec[1] * 0.4
        st.paint(st.shape().capsule((bx, by), (tx, ty), 0.9, 0.9), k.wood, sigma=0.5)
        if kind != "cane":
            st.paint(st.shape().circle(tx, ty - 1.2, 2.2), k.weapon, sigma=0.9, tones=4)
    elif kind == "spear":
        st.paint(st.shape().capsule((hx, hy + 8), (tx, ty), 0.9, 0.9), k.wood, sigma=0.5)
        st.paint(st.shape().poly([(tx - 1.6, ty + 1.5), (tx + 1.6, ty + 1.5), (tx, ty - 4.0)]), k.steel, sigma=0.5)


def shield(st: Stage, k: K, p: Pose):
    c = (p.el_n[0] - 1.2, p.el_n[1] + 0.8)
    st.paint(st.shape().ellipse(c[0], c[1], 3.8, 5.0), k.steel, sigma=1.1)
    st.paint(st.shape().ellipse(c[0], c[1], 2.4, 3.6), k.trim, sigma=0.8)


# ───────────────────────────── render ─────────────────────────────

def render(look: C.Look, pose: Pose, pose_name: str = "ready") -> Image.Image:
    k = K(look)
    robed = look.outfit in ("robe", "dress")
    p = pose.moved()
    st = Stage(W, H, INK)
    hx, hy = p.head
    weapon_hand = p.hand_f if p.weapon_far else p.hand_n

    if k.cape:
        st.paint(st.shape().poly([(p.chest[0] + 2, p.chest[1] - 4), (p.chest[0] + 9, p.chest[1] - 2), (p.hip[0] + 11, p.hip[1] + 8),
                                  (p.hip[0] + 3, p.hip[1] + 8)]), k.cape, sigma=1.6)
    # far side
    if not robed:
        leg(st, look, k, p.hip_f, p.knee_f, p.foot_f, near=False)
    arm(st, look, k, p.sh_f, p.el_f, p.hand_f, near=False)
    torso(st, look, k, p)
    if robed:
        for foot in (p.foot_f, p.foot_n):
            boot(st, (foot[0], min(foot[1], p.hem + 0.5)), k.boots, size=0.9)
    else:
        leg(st, look, k, p.hip_n, p.knee_n, p.foot_n, near=True)
        if look.outfit == "coat":
            c = p.chest
            st.paint(st.shape().poly([(c[0] - 5.2, p.hip[1] - 2.5), (c[0] + 6.4, p.hip[1] - 2.5), (c[0] + 9.2, p.hip[1] + 5.2), (c[0] + 1.0, p.hip[1] + 6.4),
                                      (c[0] - 8.0, p.hip[1] + 5.2)]), k.cloth, sigma=1.5)
            st.paint(st.shape().poly([(c[0] - 0.4, p.hip[1] - 2.5), (c[0] + 1.8, p.hip[1] - 2.5), (c[0] + 2.4, p.hip[1] + 6.2), (c[0] - 0.8, p.hip[1] + 6.2)]), k.trim, sigma=0.5, ring=False)
    # head
    st.paint(st.shape().capsule((hx + 1.5, hy + 4), (p.chest[0] - 0.5, p.chest[1] - 1), 2.6, 3.2), k.skin, sigma=1.0)
    st.paint(st.shape().ellipse(hx, hy, 6.2, 6.0), k.skin, sigma=1.6)
    if look.shadow_face:
        st.paint(st.shape().ellipse(hx - 2.6, hy + 1.8, 4.6, 4.6), C.shade_ramp(4, 4, 9), sigma=0.8, ring=False)
        st.stamp(int(round(hx)) - 6, int(round(hy)), ["yy", "yy"], {"y": (255, 236, 90)})
        st.stamp(int(round(hx)) - 2, int(round(hy)) + 1, ["yy", "yy"], {"y": (255, 236, 90)})
    hair(st, look, k, hx, hy)
    if not look.shadow_face:
        brow = k.hair[1] if k.hair else k.skin[1]
        face(st, hx, hy, k.skin, brow, closed=p.eyes_closed)
        if look.mask:
            st.paint(st.shape().poly([(hx - 7.0, hy + 1.2), (hx + 0.5, hy + 0.4), (hx + 1.5, hy + 6.5), (hx - 3.0, hy + 8.0), (hx - 7.0, hy + 5.0)]), C.shade_ramp(9, 9, 13), sigma=0.8)
        if look.beard:
            b = C.shade_ramp(*look.beard)
            st.paint(st.shape().poly([(hx - 7.0, hy + 2.5), (hx - 1.0, hy + 2.8), (hx + 1.5, hy + 6), (hx - 2.0, hy + 12.5), (hx - 6.5, hy + 8.5)]), b, sigma=1.0)
    headgear(st, look, k, hx, hy)
    # near arm in front
    if look.shield:
        shield(st, k, p)
    arm(st, look, k, p.sh_n, p.el_n, p.hand_n, near=True)
    if p.weapon and look.weapon:
        weapon(st, look, k, weapon_hand, p.weapon)
        hand(st, weapon_hand, k.skin, 2.6)
    return st.finish()


def render_class(look: C.Look, pose_name: str) -> Image.Image:
    pose = POSES[pose_name]
    if look.outfit in ("robe", "dress"):
        pose = caster(pose)
    return render(look, pose, pose_name)

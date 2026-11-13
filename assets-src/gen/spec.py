"""Sprite specification: style rules, output grid, and exact pose positions.

Everything that must stay the same from character to character lives here, so a new
character is only a short costume prompt (see characters.yaml).

Style (from the reference: hand-made bead versions of Pixel Remaster battle sprites)
  - figure ~25 rows tall incl. outline at reference scale; chibi, ~2.5 heads tall
  - head ~40% of height; large fists (3x3) and boots (4 wide)
  - three-quarter view, facing LEFT, one eye clearly visible
  - 1px black outline around the silhouette AND between overlapping parts
  - flat cel shading, 2-3 tones per material, light from the upper left, no dithering, no gradients
  - ~12-16 colours per sprite, high saturation, warm skin, small white accents (buckles, rings)

Coordinates are in "pose units": a 32 x 40 authoring box, x to the right, y down, feet joints on y=36.5
(the drawn boot bottoms reach about y=39.4). Each sheet kind has a SheetGeom that maps pose units to native
pixels and guide pixels; see docs/ART_2X_PLAN.md for the measured numbers.

Display: every pixel-art asset is drawn at ART_SCALE (1 art px = 2 screen px at 1920x1080).
"""
from __future__ import annotations

from dataclasses import dataclass, field

# ───────── output ─────────
ART_SCALE = 2             # 1 art pixel = 2 screen pixels
PALETTE_SIZE = 14         # colours per sprite including the outline colour

# Style lock (Phase 5): the approved knight is the house style. Every other character's requests also send the
# knight's approved sheet of the same type as a style reference (pixel size, proportions, outline, shading).
# The knight's own requests never include these, so its approved cache keys stay valid.
HOUSE_CHARACTER = "knight"
HOUSE_REFS = {"battle": "assets-src/gen/approved/knight/battle.png",
              "field": "assets-src/gen/approved/knight/field.png"}
CONTROL_STRENGTH = 0.75   # Bedrock structure-control only


@dataclass(frozen=True)
class SheetGeom:
    """How one sheet kind maps pose units -> native pixels -> guide pixels.

    grid:        native cell size (w, h)
    cell_px:     guide/raw cell size in pixels (w, h); must be an integer multiple of grid
    layout:      cells per sheet (cols, rows)
    px_per_unit: native pixels per pose unit
    bottom_row:  native row that holds the figure's last opaque pixels (feet / hem)
    """
    name: str
    grid: tuple[int, int]
    cell_px: tuple[int, int]
    layout: tuple[int, int]
    px_per_unit: float
    bottom_row: int
    guide_bottom_px: float | None = None   # pin where the guide's drawn bottom sits (keeps approved guides identical)
    fit_height: int | None = None          # resampled sheets only: frame the crop so the tallest figure is this tall
    trim_width: int | None = None          # centre-crop each frame to this width after cutting (cell margins)
    aspect_override: str | None = None     # Gemini aspect string when the reduced ratio is not one it accepts (21:9)

    @property
    def guide_per_native(self) -> float:
        return self.cell_px[0] / self.grid[0]

    @property
    def guide_per_unit(self) -> float:
        return self.px_per_unit * self.guide_per_native

    @property
    def sheet_px(self) -> tuple[int, int]:
        return self.cell_px[0] * self.layout[0], self.cell_px[1] * self.layout[1]

    @property
    def aspect(self) -> str:
        if self.aspect_override:
            return self.aspect_override
        from math import gcd
        w, h = self.sheet_px
        g = gcd(w, h)
        return f"{w // g}:{h // g}"


# Battle: the native grid matches the pixel grid Gemini draws for a 1536x1024 guide sheet (~6.4 guide px per art px,
# i.e. ~80 art px per 512 px cell). Art is point-sampled 1:1, never rescaled. guide_per_unit stays 12.96, so guides
# (and therefore cache keys) are unchanged from the 64-px plan.
BATTLE_GEOM = SheetGeom("battle", grid=(80, 80), cell_px=(512, 512), layout=(3, 2), px_per_unit=2.025, bottom_row=76,
                        guide_bottom_px=496.0)
# Field (checkpoint B decision): 48x96 art px cells, 2 tiles tall on 48x48-art-px tiles (96 px on screen at 2x).
# guide_per_unit stays 12.59 and the guide bottom is pinned, so the approved field guides are unchanged.
FIELD_GEOM = SheetGeom("field", grid=(48, 96), cell_px=(256, 512), layout=(3, 1), px_per_unit=2.36, bottom_row=93,
                       guide_bottom_px=501.33, fit_height=90)
# Full field sprite in one request: 3x3 (rows down, up, left; columns stand, step-left, step-right). Gemini has no
# 1:2 aspect, so 9:16 is used and each 48x96 cell gets 3 art px of margin per side (cell 54x96, trimmed to 48).
# Same guide px per unit and pinned bottom as FIELD_GEOM, so figures are drawn at the approved density.
FIELD3_GEOM = SheetGeom("field", grid=(54, 96), cell_px=(288, 512), layout=(3, 3), px_per_unit=2.36, bottom_row=93,
                        guide_bottom_px=501.33, fit_height=90, trim_width=48)
# Prompt wording that produced the approved knight; Gemini sets its own pixel size (~72 px figures), so keep
# this text stable to keep cache keys stable.
BATTLE_TARGET_PX = "about 56-60 pixels tall"
FIELD_TARGET_PX = "about 42 pixels tall"

STYLE = (
    "16-bit SNES JRPG {kind} sprite sheet, {n} poses of the same character drawn identically, {layout}, "
    "chibi proportions about 2.5 heads tall, oversized head, large fists, big boots, "
    "crisp pixel art, bold black outlines between every part, flat cel shading with three tones per colour, "
    "limited saturated palette, light from the upper left, plain flat white background"
)
NEGATIVE = (
    "multiple weapons, extra swords, floating objects, props on the ground, duplicate characters, facing right, "
    "blurry, soft shading, gradient, airbrush, photo, 3d render, realistic, text, watermark, frame, border, grid lines, shadow on ground"
)

Pt = tuple[float, float]


@dataclass(frozen=True)
class Pose:
    """Joint positions for one frame. `n` = near (viewer side) limb, `f` = far limb.

    face: 'left' (3/4 facing left), 'front', or 'back'. Drives the guide's face cue.
    weapon: (dx, dy) from the weapon hand to the tip, or None.
    """
    head: Pt
    chest: Pt
    hip: Pt
    sh_n: Pt
    el_n: Pt
    hand_n: Pt
    sh_f: Pt
    el_f: Pt
    hand_f: Pt
    hip_n: Pt
    knee_n: Pt
    foot_n: Pt
    hip_f: Pt
    knee_f: Pt
    foot_f: Pt
    face: str = "left"
    weapon: Pt | None = None
    weapon_hand: str = "n"
    caption: str = ""


def _p(**kw) -> Pose:
    return Pose(**kw)


# ───────── battle poses (facing left toward the enemies) ─────────
BATTLE_POSES: dict[str, Pose] = {
    "ready": _p(head=(13.5, 10.0), chest=(15.5, 19.5), hip=(16.0, 28.0),
                sh_n=(12.0, 18.0), el_n=(8.0, 22.0), hand_n=(6.0, 18.5),
                sh_f=(19.5, 18.0), el_f=(22.0, 22.5), hand_f=(18.5, 24.5),
                hip_n=(14.0, 28.5), knee_n=(11.0, 32.5), foot_n=(9.0, 36.5),
                hip_f=(17.5, 28.5), knee_f=(20.0, 32.5), foot_f=(22.0, 36.5),
                caption="battle stance, knees bent, fists raised"),
    "attack": _p(head=(11.0, 10.5), chest=(13.0, 19.5), hip=(15.5, 28.5),
                 sh_n=(10.0, 18.5), el_n=(6.0, 19.5), hand_n=(2.5, 18.0),
                 sh_f=(17.5, 18.0), el_f=(21.5, 20.5), hand_f=(23.5, 17.0),
                 hip_n=(13.5, 28.5), knee_n=(8.0, 31.5), foot_n=(5.0, 36.5),
                 hip_f=(16.5, 28.5), knee_f=(22.0, 33.0), foot_f=(27.0, 36.5),
                 weapon=(-9.0, -1.0), caption="lunging forward, weapon thrust to the left"),
    "cast": _p(head=(14.0, 10.0), chest=(15.5, 19.5), hip=(16.0, 28.0),
               sh_n=(12.0, 18.0), el_n=(6.0, 15.0), hand_n=(3.5, 9.5),
               sh_f=(19.5, 18.0), el_f=(22.0, 22.5), hand_f=(18.5, 24.5),
               hip_n=(14.0, 28.5), knee_n=(11.5, 32.5), foot_n=(10.0, 36.5),
               hip_f=(17.5, 28.5), knee_f=(20.0, 32.5), foot_f=(22.0, 36.5),
               caption="arm raised up and forward to cast a spell, face clearly visible"),
    "hurt": _p(head=(16.5, 11.0), chest=(17.5, 20.0), hip=(16.5, 28.0),
               sh_n=(14.0, 18.5), el_n=(11.0, 21.5), hand_n=(9.5, 24.5),
               sh_f=(21.0, 18.5), el_f=(24.5, 21.0), hand_f=(26.0, 24.0),
               hip_n=(15.0, 28.5), knee_n=(12.5, 32.5), foot_n=(10.5, 36.5),
               hip_f=(18.0, 28.5), knee_f=(22.5, 32.0), foot_f=(25.5, 35.5),
               caption="recoiling backward from a hit, eyes shut"),
    "down": _p(head=(10.5, 22.0), chest=(14.0, 27.0), hip=(18.5, 31.5),
               sh_n=(11.5, 25.5), el_n=(8.5, 29.0), hand_n=(6.5, 33.0),
               sh_f=(17.0, 25.0), el_f=(15.5, 29.5), hand_f=(13.0, 33.0),
               hip_n=(16.5, 32.0), knee_n=(11.0, 34.5), foot_n=(6.0, 37.0),
               hip_f=(19.5, 32.0), knee_f=(24.0, 35.0), foot_f=(28.0, 37.0),
               caption="collapsed, kneeling low with head bowed"),
    "victory": _p(head=(14.0, 10.0), chest=(15.5, 19.5), hip=(16.0, 28.0),
                  sh_n=(12.0, 18.0), el_n=(7.0, 14.0), hand_n=(5.5, 9.0),
                  sh_f=(19.5, 18.0), el_f=(22.5, 22.0), hand_f=(20.0, 25.5),
                  hip_n=(14.0, 28.5), knee_n=(11.5, 32.5), foot_n=(10.0, 36.5),
                  hip_f=(17.5, 28.5), knee_f=(20.0, 32.5), foot_f=(22.0, 36.5),
                  weapon=(0.5, -6.5), caption="triumphant, weapon raised overhead, face visible"),
}
BATTLE_ORDER = ["ready", "attack", "cast", "hurt", "down", "victory"]
BATTLE_SHEET = BATTLE_GEOM.layout
BATTLE_LAYOUT = ("battle", "every pose in three-quarter side view facing left, face turned left with one eye visible")


def _walk(face: str, phase: int) -> Pose:
    """Field walk frames: phase 0 = stand, 1 = left foot forward, 2 = right foot forward."""
    lift = {0: 0.0, 1: 1.0, 2: -1.0}[phase]
    if face in ("front", "back"):
        return _p(head=(16.0, 10.0), chest=(16.0, 19.5), hip=(16.0, 28.0),
                  sh_n=(11.0, 18.0), el_n=(10.5 + 0.5 * lift, 22.5), hand_n=(10.5 + lift, 26.0),
                  sh_f=(21.0, 18.0), el_f=(21.5 - 0.5 * lift, 22.5), hand_f=(21.5 - lift, 26.0),
                  hip_n=(13.5, 28.5), knee_n=(13.5, 32.5 - max(lift, 0)), foot_n=(13.0, 36.5 - max(lift, 0)),
                  hip_f=(18.5, 28.5), knee_f=(18.5, 32.5 - max(-lift, 0)), foot_f=(19.0, 36.5 - max(-lift, 0)),
                  face=face, caption=f"walking, {'facing the viewer' if face == 'front' else 'seen from behind'}")
    return _p(head=(14.5, 10.0), chest=(16.0, 19.5), hip=(16.0, 28.0),
              sh_n=(15.0, 18.0), el_n=(13.5 - 2 * lift, 22.5), hand_n=(13.0 - 3 * lift, 26.0),
              sh_f=(17.5, 18.0), el_f=(18.5 + 2 * lift, 22.5), hand_f=(19.0 + 3 * lift, 26.0),
              hip_n=(15.0, 28.5), knee_n=(14.0 - 2.0 * lift, 32.5), foot_n=(13.5 - 3.2 * lift, 36.5),
              hip_f=(17.0, 28.5), knee_f=(18.0 + 2.0 * lift, 32.5), foot_f=(18.5 + 3.2 * lift, 36.5),
              face="left", caption="walking, side view facing left")


# ───────── field poses: one sheet per direction, 3 frames each (right = mirrored left) ─────────
# Each direction is generated separately (the model will not draw a back view on a mixed sheet).
# A 3x1 strip of 1:2 cells: stand, step-left, step-right.
FIELD_DIRECTIONS = {
    "down": ("front", "walking toward the viewer, full front view, face and both eyes visible", "side view, back view"),
    "up": ("back", "rear view: walking away from the viewer, seen from directly behind, back of the helmet or hair, "
                   "cape hanging down the back", "face, eyes, mouth, nose, front view, looking at viewer"),
    "left": ("left", "walking in full side profile facing left, one eye visible", "front view, back view, facing right"),
}
FIELD_NEGATIVE = "sword, weapon, scabbard, held object, items on the ground"
FIELD_POSES: dict[str, Pose] = {f"{d}{i}": _walk(face, i) for d, (face, _, _) in FIELD_DIRECTIONS.items() for i in range(3)}
FIELD_SHEET = FIELD_GEOM.layout
FIELD_ORDER = [f"{d}{i}" for d in ("down", "up", "left") for i in range(3)]


def _walk3(face: str, phase: int) -> Pose:
    """Walk frames for the 3x3 sheet: a clearer stride than _walk (which the approved single sheets were drawn from).
    phase 0 = stand, 1 = left foot forward, 2 = right foot forward."""
    if phase == 0:
        return _walk(face, 0)
    s = 1.0 if phase == 1 else -1.0
    if face in ("front", "back"):
        lift_n, lift_f = (2.2, 0.0) if s > 0 else (0.0, 2.2)
        return _p(head=(16.0, 10.3), chest=(16.0, 19.8), hip=(16.0, 28.2),
                  sh_n=(11.0, 18.2), el_n=(10.4, 22.6 - 0.6 * s), hand_n=(10.2, 26.0 - 1.4 * s),
                  sh_f=(21.0, 18.2), el_f=(21.6, 22.6 + 0.6 * s), hand_f=(21.8, 26.0 + 1.4 * s),
                  hip_n=(13.5, 28.6), knee_n=(13.2, 32.6 - lift_n), foot_n=(13.0, 36.5 - lift_n),
                  hip_f=(18.5, 28.6), knee_f=(18.8, 32.6 - lift_f), foot_f=(19.0, 36.5 - lift_f),
                  face=face, caption=f"walking, {'facing the viewer' if face == 'front' else 'seen from behind'}")
    # side view: the forward foot is always the one nearer the left edge
    fwd, back = (11.0, 21.0)
    near_x, far_x = (fwd, back) if s > 0 else (back, fwd)
    return _p(head=(14.5, 10.3), chest=(16.0, 19.8), hip=(16.0, 28.2),
              sh_n=(15.0, 18.2), el_n=(13.5 + 2.2 * s, 22.6), hand_n=(13.0 + 3.2 * s, 26.0),
              sh_f=(17.5, 18.2), el_f=(18.5 - 2.2 * s, 22.6), hand_f=(19.0 - 3.2 * s, 26.0),
              hip_n=(15.2, 28.6), knee_n=((15.2 + near_x) / 2 - 0.3, 32.4), foot_n=(near_x, 36.5),
              hip_f=(16.8, 28.6), knee_f=((16.8 + far_x) / 2 - 0.3, 32.4), foot_f=(far_x, 36.5),
              face="left", caption="walking, side view facing left")


FIELD3_POSES: dict[str, Pose] = {f"{d}{i}": _walk3({"down": "front", "up": "back", "left": "left"}[d], i)
                                 for d in ("down", "up", "left") for i in range(3)}
FIELD_ROWS = {
    "down": "walking toward the viewer, full front view, face and both eyes visible",
    "up": "walking away from the viewer, full back view seen from directly behind: back of the helmet or hair and the "
          "cape, NO face, eyes, nose or mouth visible",
    "left": "walking in full side profile facing left, nose pointing left, one eye visible",
}


def field_order(direction: str) -> list[str]:
    return [f"{direction}0", f"{direction}1", f"{direction}2"]


@dataclass
class CharacterSpec:
    id: str
    prompt: str                       # costume and gear only; style is added automatically
    seed: int = 1234
    robed: bool = False
    weapon: str = "sword"
    extra_negative: str = ""
    palette_size: int = PALETTE_SIZE
    tags: list[str] = field(default_factory=list)


# ───────── monsters (docs/ART_MONSTERS_PLAN.md) ─────────
# One 21:9 request per monster: idle | attack | hurt in one row. The guide is 1680x720 (exactly 21:9; the reduced ratio
# 7:3 is not accepted by Gemini, hence aspect_override). `grid` is the OUTPUT cell per size band; guide cells are not a
# multiple of it because monsters are cut by their own path (monster.py), which measures Gemini's pixel grid.
MONSTER_POSES = ["idle", "attack", "hurt"]
# Per-pose bosses also get a spell-casting stance (not wired into battle yet; the atlas carries it as `cast`).
BOSS_POSES = ["idle", "attack", "cast", "hurt"]
MONSTER_GUIDE_CELL = (560, 720)
MONSTER_EXPECTED_PITCH = 5.33     # guide px per sprite px seen on the character sheets; pilot A measures the real one


@dataclass(frozen=True)
class MonsterBand:
    size: str
    cell: int                      # square output cell (art px)
    height: tuple[int, int]        # accepted figure height (art px)
    foot_row: int                  # last opaque row of grounded monsters


MONSTER_BANDS = {
    "small": MonsterBand("small", 80, (56, 72), 76),
    "large": MonsterBand("large", 128, (96, 120), 122),
    "boss": MonsterBand("boss", 176, (140, 168), 168),
}
MONSTER_GEOMS = {
    b.size: SheetGeom(f"monster_{b.size}", grid=(b.cell, b.cell), cell_px=MONSTER_GUIDE_CELL, layout=(3, 1),
                      px_per_unit=1.0, bottom_row=b.foot_row, aspect_override="21:9")
    for b in MONSTER_BANDS.values()
}
MONSTER_NEGATIVE = (
    "two creatures in one cell, different creatures in different cells, background scenery, floor tiles, shadows on the "
    "ground, magic effects outside the cell, text, frame, border, grid lines, blurry, soft shading, gradient, 3d render"
)

# Bosses can be drawn one pose per request (`per_pose: true` in monsters.yaml): a square 1024 guide gives Gemini room
# for a ~170-190 px figure, so the boss keeps the party's pixel density without enlarging.
MONSTER_POSE_GUIDE = (1024, 1024)
# The output cell is larger than the 3-pose boss cell: single-pose renders come back ~185 px tall at 1:1, and art is
# never shrunk to fit (that drops pixel rows).
BOSS_POSE_GEOM = SheetGeom("boss_pose", grid=(200, 200), cell_px=MONSTER_POSE_GUIDE, layout=(1, 1), px_per_unit=1.0,
                           bottom_row=192)

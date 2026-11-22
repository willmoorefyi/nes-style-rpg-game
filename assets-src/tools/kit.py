"""Tile kits for the map compiler (docs/ART_TILES_PLAN.md).

A kit is a set of named parts (48x48 RGBA tiles, or multi-tile props stored as several named cells) plus
seamless material textures sampled by global pixel position. Every part starts as a code-drawn placeholder
(flat colour, outline, 2-letter label); approved Gemini kit sheets in assets-src/gen/approved/<kit>/*.png override
parts by cell name (their .json lists `cells`, rows of part names or null, and optionally `materials`).
"""
from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

T = 48
ROOT = Path(__file__).resolve().parents[2]
APPROVED = ROOT / "assets-src" / "gen" / "approved"

# material -> (base colour, texture style)
MATERIALS = {
    "grass": ((70, 140, 60), "speckle"),
    "cobble": ((150, 150, 160), "stones"),
    "dirt": ((170, 135, 90), "speckle"),
    "water": ((50, 110, 200), "ripple"),
    "rim": ((120, 120, 130), "stones"),
    "wall_top": ((175, 175, 185), "bricks"),
    "wall_face": ((115, 115, 125), "bricks"),
    "bridge_h": ((150, 110, 70), "planks_h"),
    "bridge_v": ((150, 110, 70), "planks_v"),
    "floor": ((150, 105, 65), "planks_h"),
    "floor_stone": ((130, 130, 140), "stones"),
    "carpet": ((160, 40, 45), "speckle"),
    "rubble": ((110, 110, 115), "stones"),
    "in_wall_top": ((70, 50, 40), "speckle"),
    "in_wall_face": ((200, 180, 150), "bricks"),
    # overworld (approved in the overworld kit; placeholders let offline tests compile wild terrain)
    "forest": ((35, 95, 45), "speckle"),
    "mountain": ((125, 110, 95), "stones"),
    "sand": ((215, 195, 140), "speckle"),
    "ocean": ((35, 80, 170), "ripple"),
    "swamp": ((75, 100, 60), "marsh"),           # W1-D: the `w` fens (was build_map's recoloured-grass fallback)
    # AR-T2: offline placeholders only; compiled maps take the approved AR sheet's taiga / snow (AR_SHEET)
    "taiga": ((40, 80, 60), "speckle"),
    "snow": ((225, 232, 240), "speckle"),
}
# W1-D (QUEST_PLAN 4.3, WORLD_PLAN 4.9): material remap presets, name -> (default base material, hue shift in
# degrees, saturation factor, value factor). remap() expands one into a map's `materials:` entry
# {from, hue, sat, shade}; RECOLORS are part styles (deco / house `style`, roof and wall colours, build_map.RECOLOR).
REMAPS = {
    "cave": ("temple_floor", -170, 1.3, 1.5),     # brown temple stone (the dwarf hall)
    "ice": ("floor_stone", 170, 1.8, 1.1),
    "lava": ("temple_rubble", -180, 2.5, 1.9),    # an orange rubble floor
    "sky": ("castle_face", 190, 3.0, 0.9),         # slate castle
    "coral": ("castle_face", 150, 4.0, 0.95),     # teal castle
    "snow": ("grass", 100, 0.15, 1.55),
    "dune": ("sand", -12, 1.3, 0.92),             # warm
    "pale_dune": ("sand", 0, 0.5, 1.05),
}
RECOLORS = {"elf": (110, 0.5, 0.75),             # green slate roofs on the town kit
            "cold_rock": (180, 0.15, 1.0),         # AR-T2: grey rock (cold ranges' peaks; gen/terrain_cut.COLD_ROCK)
            **{n: REMAPS[n][1:] for n in ("snow", "dune", "pale_dune")}}


def remap(preset: str, base: str | None = None) -> dict:
    """A `materials:` entry for the preset, recolouring `base` (default: the preset's own base material)."""
    src, hue, sat, val = REMAPS[preset]
    return {"from": base or src, "hue": hue, "sat": sat, "shade": val}

ROOF_ROWS = ("ridge", "mid", "eave")
SIGNS = ("weapon", "armor", "item", "white_magic", "black_magic", "inn", "tavern", "shrine")   # last two: M7
# part name -> (colour, label, shape)
_PARTS: dict[str, tuple[tuple[int, int, int], str, str]] = {}
for row in ROOF_ROWS:
    for col in ("l", "m", "r"):
        _PARTS[f"roof_{row}_{col}"] = ((180 - 25 * ROOF_ROWS.index(row), 60, 50), row[0].upper() + col, "tile")
for col in ("l", "plain", "window", "r"):
    _PARTS[f"wall_up_{col}"] = ((225, 215, 190), "U" + col[0], "window" if col == "window" else "tile")
for col in ("l", "plain", "r"):
    _PARTS[f"wall_lo_{col}"] = ((205, 195, 170), "L" + col[0], "tile")
for col in ("l", "plain", "window", "r"):
    _PARTS[f"wall_up2_{col}"] = ((215, 205, 180), "2" + col[0], "window" if col == "window" else "tile")
_PARTS["wall_door_top"] = ((110, 70, 40), "Dt", "door_top")
_PARTS["wall_door_bottom"] = ((110, 70, 40), "Db", "door_bottom")
for s in SIGNS:
    _PARTS[f"sign_{s}"] = ((200, 170, 90), s[:2].upper(), "sign")
for col in ("l", "m", "r"):
    _PARTS[f"counter_{col}"] = ((120, 80, 45), "C" + col, "tile")
_PARTS.update({
    "tree_crown": ((30, 100, 50), "Tc", "crown"),
    "tree_trunk": ((30, 100, 50), "Tt", "trunk"),
    "bush": ((40, 120, 50), "Bu", "blob"),
    "well": ((120, 120, 130), "We", "blob"),
    "fence_h": ((235, 235, 235), "F-", "fence_h"),
    "fence_v": ((235, 235, 235), "F|", "fence_v"),
    "fence_post": ((235, 235, 235), "F+", "post"),
    "flowers": ((220, 90, 150), "", "flowers"),
    "barrel": ((140, 90, 50), "Ba", "blob"),
    "crate": ((160, 120, 70), "Cr", "tile_small"),
    "signpost": ((140, 100, 60), "Sp", "post"),
    "culvert": ((115, 115, 125), "Cu", "arch"),
    "tuft": ((50, 115, 45), "", "tuft"),
    "chimney": ((140, 80, 60), "Ch", "tile_small"),
})
for r in range(2):
    for c in range(2):
        _PARTS[f"fountain_{r}{c}"] = ((150, 160, 190), f"f{r}{c}", "tile")
# T6 paid-art parts (docs/FIX_PLAN_PENINSULA.md T6 §3), placeholders until the sheets are approved:
# overworld/kit_grand (temple_grand, bridge_gap) and castle/kit_stairs_lib (stairwell and the props).
for r in range(2):
    for c in range(2):
        _PARTS[f"temple_grand_{r}_{c}"] = ((70, 75, 95), f"G{r}{c}", "tile")
        _PARTS[f"bridge_gap_{r}_{c}"] = ((150, 110, 70), f"g{r}{c}", "post")
        _PARTS[f"stairwell_{r}_{c}"] = ((200, 190, 170), f"S{r}{c}", "tile")
_PARTS.update({
    "map_table_l": ((110, 75, 45), "Ml", "tile_small"),
    "map_table_r": ((110, 75, 45), "Mr", "tile_small"),
    "gold_heap": ((220, 180, 60), "Gh", "blob"),
    "crown_cushion": ((170, 40, 50), "Cc", "blob"),
    "lectern": ((100, 65, 40), "Le", "tile_small"),
    "globe": ((90, 140, 190), "Gl", "blob"),
})
# R paid-art parts (docs/FIX_PLAN_PENINSULA.md R0-7), placeholders until R5's sheets are approved: the temple
# ruin icons (W1), the stone bridge gap (W8 fallback) and Cornelia's gate arches and sides (M7; the signs: SIGNS).
for r in range(2):
    for c in range(2):
        _PARTS[f"temple_ruin_{r}_{c}"] = ((95, 95, 105), f"R{r}{c}", "tile")
        _PARTS[f"bridge_gap_stone_{r}_{c}"] = ((150, 150, 155), f"s{r}{c}", "post")
        _PARTS[f"gate_arch_2_{r}_{c}"] = ((165, 160, 150), f"a{r}{c}", "tile")
        _PARTS[f"gate_side_{r}_{c}"] = ((150, 145, 135), f"q{r}{c}", "tile")
    for c in range(3):
        _PARTS[f"temple_ruin3_{r}_{c}"] = ((95, 95, 105), f"3{r}{c}", "tile")
        _PARTS[f"gate_arch_3_{r}_{c}"] = ((165, 160, 150), f"A{r}{c}", "tile")
# W1-D (QUEST_PLAN 4.3, WORLD_PLAN 4.9): code-drawn landmark placeholders, drawn whole and cut into cells named
# <name>_icon_<r>_<c> (the overworld icon convention) until an approved sheet supplies those cells; place one as a
# deco with `parts: landmark_parts(name)`. name -> (cells wide, cells high, colour, label, shape)
LANDMARKS = {
    "cave_mouth": (2, 2, (120, 95, 70), "CM", "cave"), "tower": (2, 3, (150, 140, 125), "TW", "tower"),
    "volcano": (3, 2, (110, 70, 55), "VO", "volcano"), "shrine": (2, 2, (190, 185, 170), "SH", "shrine"),
    "dock_post": (1, 1, (130, 95, 60), "DP", "post"), "buried_hull": (3, 2, (125, 85, 50), "BH", "hull"),
    "sky_ring": (2, 2, (170, 200, 235), "SR", "ring"), "ice_floe": (2, 2, (215, 235, 245), "IF", "floe"),
    "waterfall": (2, 3, (90, 150, 215), "WF", "fall"), "tent": (2, 2, (200, 170, 110), "TE", "tent"),
    "windmill": (2, 3, (210, 195, 165), "WM", "windmill"), "dome": (2, 2, (175, 185, 210), "DO", "dome"),
    # LM-INT: Gaia's grass tuft (a 1x1 deco; the `tuft` part stays the compiler's grass speckle)
    "tuft": (1, 1, (50, 115, 45), "", "tuft"),
    # LM4-INT: the town icons (LM4 picks; Melmond and Onrac grew from LM's 2x1), Lufenia's one icon (it replaces the
    # two domes), the unique boats (the buried hull stays only as FIRE's airship hull) and the landmarks
    "town_melmond": (4, 3, (170, 150, 120), "TM", "town"), "town_onrac": (5, 3, (150, 160, 175), "TO", "town"),
    "town_pravoka": (3, 3, (190, 120, 90), "TP", "town"), "town_elfheim": (3, 3, (120, 160, 110), "TE", "town"),
    "town_crescent": (3, 3, (200, 180, 140), "TC", "town"), "town_gaia": (3, 2, (160, 140, 170), "TG", "town"),
    "lufenia": (4, 2, (175, 185, 210), "LU", "dome"),
    "brig": (4, 3, (110, 75, 45), "BR", "hull"), "submarine": (4, 2, (90, 95, 105), "SU", "hull"),
    "fishing_boat": (3, 2, (80, 110, 160), "FB", "hull"),
    "bell_tower": (2, 3, (200, 200, 205), "BT", "tower"), "lighthouse": (2, 3, (235, 235, 230), "LH", "tower"),
    "mirage_tower": (2, 3, (215, 190, 140), "MT", "tower"),
    "standing_stones": (2, 2, (150, 150, 150), "SS", "shrine"), "hermit_hut": (2, 2, (165, 130, 90), "HH", "tent"),
    # LM5-INT: the Western Keep and the Citadel of Trials (both were the shared castle icon)
    "western_keep": (2, 3, (110, 115, 125), "WK", "tower"), "citadel": (3, 3, (225, 220, 205), "CT", "town"),
}
# LM-INT / LM4-INT: the approved Bedrock landmark sheets (assets-src/gen/landmark_cut.py); their cells replace the
# code-drawn landmark placeholders in every kit, not only the overworld kit that holds the files
LANDMARK_SHEETS = (APPROVED / "overworld" / "landmarks_lm", APPROVED / "overworld" / "landmarks_lm4",
                   APPROVED / "overworld" / "landmarks_lm5")
LANDMARK_SHEET = LANDMARK_SHEETS[0]
# AR-T2: the pass-AR ground sheet (assets-src/gen/terrain_cut.py), loaded into every kit like the landmark sheets: its
# names (`ar_<m>`, the new materials, the dungeon floors, `ar_tree_clump`, `conifer_clump`) are used by no other sheet
AR_SHEET = APPROVED / "overworld" / "terrain_ar"


def landmark_parts(name: str) -> list[list[str]]:
    w, h = LANDMARKS[name][:2]
    return [[f"{name}_icon_{r}_{c}" for c in range(w)] for r in range(h)]


_LANDMARK_CELL = {p: (n, r, c) for n in LANDMARKS for r, row in enumerate(landmark_parts(n)) for c, p in enumerate(row)}

PART_NAMES = tuple(_PARTS) + tuple(_LANDMARK_CELL)


def _font():
    return ImageFont.load_default()


def _dark(c, f=0.55):
    return tuple(int(v * f) for v in c)


@lru_cache(maxsize=None)
def placeholder_landmark(name: str) -> Image.Image:
    """The whole landmark (w x h cells), transparent around a flat, outlined shape standing on the bottom row."""
    w, h, col, label, shape = LANDMARKS[name]
    W, H = w * T, h * T
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fill, ink, dark = (*col, 255), (*_dark(col, 0.35), 255), (*_dark(col, 0.3), 255)
    light = (*(min(255, int(v * 1.25) + 30) for v in col), 255)
    B = H - 3                                                  # the ground line
    if shape == "cave":
        d.polygon([(2, B), (W // 5, H * 3 // 10), (W // 2, 4), (W * 4 // 5, H * 3 // 10), (W - 3, B)], fill=fill, outline=ink)
        d.chord([W * 3 // 10, H * 9 // 20, W * 7 // 10, H * 5 // 4], 180, 360, fill=dark)
        d.rectangle([W * 3 // 10, H * 17 // 20, W * 7 // 10, B], fill=dark)
    elif shape == "tower":
        d.rectangle([W * 3 // 10, H // 5, W * 7 // 10, B], fill=fill, outline=ink)
        d.polygon([(W // 5, H // 5 + 2), (W // 2, 2), (W * 4 // 5, H // 5 + 2)], fill=dark, outline=ink)
        for y in (H * 7 // 20, H * 11 // 20):
            d.rectangle([W // 2 - 4, y, W // 2 + 3, y + 9], fill=dark)
        d.chord([W // 2 - 8, B - 22, W // 2 + 7, B + 8], 180, 360, fill=dark)
        d.rectangle([W // 2 - 8, B - 8, W // 2 + 7, B], fill=dark)
    elif shape == "volcano":
        d.polygon([(2, B), (W * 2 // 5, H // 5), (W * 3 // 5, H // 5), (W - 3, B)], fill=fill, outline=ink)
        d.ellipse([W * 2 // 5, H // 5 - 6, W * 3 // 5, H // 5 + 6], fill=(230, 110, 30, 255), outline=ink)
        for x0, x1 in ((W * 9 // 20, W * 2 // 5), (W * 11 // 20, W * 13 // 20)):
            d.line([x0, H // 5 + 4, x1, H * 3 // 5], fill=(230, 110, 30, 255), width=3)
    elif shape == "shrine":
        d.polygon([(6, H * 2 // 5), (W // 2, 6), (W - 7, H * 2 // 5)], fill=dark, outline=ink)
        for x in (W // 6, W // 2 - 5, W * 5 // 6 - 10):
            d.rectangle([x, H * 2 // 5, x + 10, B - 8], fill=fill, outline=ink)
        d.rectangle([4, B - 8, W - 5, B], fill=fill, outline=ink)
    elif shape == "post":
        d.rectangle([W // 2 - 6, 10, W // 2 + 5, B], fill=fill, outline=ink)
        d.rectangle([W // 2 - 8, 18, W // 2 + 7, 22], fill=light, outline=ink)
    elif shape == "hull":
        d.chord([6, H * 7 // 20, W - 7, H * 7 // 5], 180, 360, fill=fill, outline=ink)
        for x in range(W // 5, W * 4 // 5, 18):
            d.line([x, H * 9 // 20, x + 4, H * 7 // 10], fill=ink, width=2)
        d.line([W * 3 // 5, H * 7 // 20 + 4, W * 7 // 10, 8], fill=ink, width=4)       # the broken mast
        d.chord([0, H * 13 // 20, W - 1, H * 3 // 2], 180, 360, fill=(215, 190, 130, 255), outline=(120, 100, 60, 255))
    elif shape == "ring":
        d.ellipse([4, H // 5, W - 5, H * 4 // 5], outline=ink, width=9)
        d.ellipse([6, H // 5 + 2, W - 7, H * 4 // 5 - 2], outline=fill, width=5)
        d.rectangle([W // 2 - 3, H * 4 // 5 - 2, W // 2 + 2, B], fill=ink)
    elif shape == "floe":
        d.polygon([(6, H // 2), (W // 4, H // 4), (W * 3 // 5, H // 5), (W - 6, H * 2 // 5), (W - 10, B - 10),
                   (W // 2, B), (W // 6, B - 6)], fill=fill, outline=(70, 120, 170, 255))
        d.line([W // 4, H // 2, W * 3 // 5, H * 2 // 5], fill=(150, 190, 220, 255), width=2)
    elif shape == "fall":
        d.rectangle([0, 0, W // 4, B], fill=(105, 95, 85, 255), outline=(50, 45, 40, 255))
        d.rectangle([W * 3 // 4, 0, W - 1, B], fill=(105, 95, 85, 255), outline=(50, 45, 40, 255))
        d.rectangle([W // 4, 0, W * 3 // 4, B - 10], fill=fill, outline=ink)
        for x in range(W // 4 + 6, W * 3 // 4, 9):
            d.line([x, 4, x, B - 14], fill=light, width=2)
        d.ellipse([W // 5, B - 20, W * 4 // 5, B], fill=(235, 245, 250, 255), outline=ink)
    elif shape == "tent":
        d.polygon([(4, B), (W // 2, 8), (W - 5, B)], fill=fill, outline=ink)
        d.polygon([(W // 2 - 12, B), (W // 2, B - 34), (W // 2 + 12, B)], fill=dark)
        d.line([W // 2, 2, W // 2, 10], fill=ink, width=3)
    elif shape == "windmill":
        d.polygon([(W // 3, B), (W * 2 // 5, H * 2 // 5), (W * 3 // 5, H * 2 // 5), (W * 2 // 3, B)], fill=fill, outline=ink)
        hub = (W // 2, H * 2 // 5)
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            d.line([hub, (hub[0] + dx * W * 2 // 5, hub[1] + dy * H // 3)], fill=(150, 110, 70, 255), width=6)
        d.ellipse([hub[0] - 5, hub[1] - 5, hub[0] + 5, hub[1] + 5], fill=dark)
        d.rectangle([W // 2 - 5, B - 14, W // 2 + 4, B], fill=dark)
    elif shape == "tuft":
        d.polygon([(8, B), (12, 20), (18, 30), (24, 12), (30, 30), (36, 18), (40, B)], fill=fill, outline=ink)
    elif shape == "town":
        d.rectangle([6, 8, W - 7, B], fill=fill, outline=ink)
        d.rectangle([T // 2 - 7, B - 16, T // 2 + 6, B], fill=dark)
    elif shape == "dome":
        d.chord([4, H // 6, W - 5, H * 7 // 6], 180, 360, fill=fill, outline=ink)
        d.rectangle([4, H * 2 // 3, W - 5, B], fill=light, outline=ink)
        d.chord([W // 2 - 9, B - 24, W // 2 + 8, B + 10], 180, 360, fill=dark)
        d.rectangle([W // 2 - 9, B - 7, W // 2 + 8, B], fill=dark)
    d.text((3, 2), label, fill=(*_dark(col, 0.2), 255), font=_font())
    return im


def placeholder_part(name: str) -> Image.Image:
    if name in _LANDMARK_CELL:
        lm, r, c = _LANDMARK_CELL[name]
        return placeholder_landmark(lm).crop((c * T, r * T, (c + 1) * T, (r + 1) * T))
    col, label, shape = _PARTS[name]
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ink = (*_dark(col, 0.35), 255)
    fill = (*col, 255)
    if shape in ("tile", "window", "door_top", "door_bottom"):
        d.rectangle([0, 0, T - 1, T - 1], fill=fill, outline=ink)
        if shape == "window":
            d.rectangle([14, 12, 33, 33], fill=(90, 150, 200, 255), outline=ink)
        if shape == "door_top":
            d.rectangle([0, 0, T - 1, T - 1], fill=(225, 215, 190, 255), outline=ink)
            d.rectangle([10, 14, 37, T - 1], fill=fill, outline=ink)
        if shape == "door_bottom":
            d.rectangle([0, 0, T - 1, T - 1], fill=(205, 195, 170, 255), outline=ink)
            d.rectangle([10, 0, 37, T - 1], fill=fill, outline=ink)
    elif shape == "sign":
        d.rectangle([8, 12, 39, 35], fill=fill, outline=ink)
    elif shape == "crown":
        d.ellipse([4, 2, 43, 47], fill=fill, outline=ink)
    elif shape == "trunk":
        d.polygon([(4, 0), (43, 0), (24, 30)], fill=fill, outline=ink)
        d.rectangle([20, 28, 27, 44], fill=(100, 70, 40, 255), outline=ink)
    elif shape == "blob":
        d.ellipse([6, 8, 41, 45], fill=fill, outline=ink)
    elif shape == "tile_small":
        d.rectangle([8, 10, 39, 43], fill=fill, outline=ink)
    elif shape == "fence_h":
        d.rectangle([0, 18, T - 1, 22], fill=fill, outline=ink)
        d.rectangle([0, 30, T - 1, 34], fill=fill, outline=ink)
        for x in (4, 22, 40):
            d.rectangle([x, 12, x + 4, 40], fill=fill, outline=ink)
    elif shape == "fence_v":
        d.rectangle([21, 0, 26, T - 1], fill=fill, outline=ink)
    elif shape == "post":
        d.rectangle([19, 10, 28, 42], fill=fill, outline=ink)
    elif shape == "arch":
        d.rectangle([0, 0, T - 1, T - 1], fill=fill, outline=ink)
        d.ellipse([8, 16, 39, 60], fill=(0, 0, 0, 0), outline=ink)
    elif shape == "flowers":
        rng = random.Random(name)
        for _ in range(6):
            x, y = rng.randrange(8, 38), rng.randrange(8, 38)
            d.rectangle([x, y, x + 2, y + 2], fill=fill)
    elif shape == "tuft":
        for x, y in ((18, 28), (22, 24), (26, 28), (30, 26)):
            d.line([x, y, x, y + 5], fill=fill)
    if label:
        d.text((3, 2), label, fill=(*_dark(col, 0.25), 255), font=_font())
    return im


def placeholder_tile(name: str) -> Image.Image:
    """Generic labelled placeholder for a part the kit does not define yet (e.g. a prefab not approved)."""
    im = Image.new("RGBA", (T, T), (190, 170, 150, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, T - 1], outline=(60, 50, 40, 255))
    d.text((3, 2), name[-5:], fill=(40, 30, 20, 255), font=_font())
    return im


def placeholder_material(name: str, size: int = 96) -> np.ndarray:
    """A seamless (wrapping) size x size RGB texture."""
    col, style = MATERIALS[name]
    rng = np.random.default_rng(sum(map(ord, name)))
    base = np.empty((size, size, 3), np.int16)
    base[:] = col
    noise = rng.integers(-8, 9, (size, size, 1))
    img = base + noise
    yy, xx = np.mgrid[0:size, 0:size]
    if style == "stones":
        mortar = ((yy % 12) == 0) | (((xx + 6 * ((yy // 12) % 2)) % 16) == 0)
        img[mortar] = np.array(col) * 0.6
    elif style == "bricks":
        mortar = ((yy % 8) == 0) | (((xx + 8 * ((yy // 8) % 2)) % 16) == 0)
        img[mortar] = np.array(col) * 0.7
    elif style == "ripple":
        wave = ((yy + (np.sin(xx / size * 2 * np.pi * 4) * 2).astype(int)) % 12) == 0
        img[wave] = np.minimum(np.array(col) * 1.4, 255)
    elif style == "planks_h":
        img[(yy % 12) == 0] = np.array(col) * 0.6
    elif style == "planks_v":
        img[(xx % 12) == 0] = np.array(col) * 0.6
    elif style == "speckle":
        dots = rng.random((size, size)) < 0.04
        img[dots] = np.array(col) * 0.75
    elif style == "marsh":                       # dark pools (whole periods across the tile, so it wraps) and reeds
        t = 2 * np.pi / size
        f = np.sin(2 * t * xx + 1.0) * np.cos(3 * t * yy) + 0.6 * np.sin(t * (xx + 2 * yy) + 2.0)
        img[f > 0.95] = (45, 75, 75)
        img[(f > 0.8) & (f <= 0.95)] = np.array(col) * 0.7
        reeds = (rng.random((size, size)) < 0.03) & (f <= 0.8)
        img[reeds] = (95, 120, 55)
    return np.clip(img, 0, 255).astype(np.uint8)


@dataclass
class Kit:
    id: str
    parts: dict[str, Image.Image] = field(default_factory=dict)
    materials: dict[str, np.ndarray] = field(default_factory=dict)
    approved: set[str] = field(default_factory=set)   # part / material names that come from approved art

    def part(self, name: str) -> Image.Image:
        if name not in self.parts:
            raise KeyError(f"kit '{self.id}' has no part '{name}'")
        return self.parts[name]

    def material(self, name: str) -> np.ndarray:
        if name not in self.materials:
            raise KeyError(f"kit '{self.id}' has no material '{name}'")
        return self.materials[name]


def apply_paint(sheet: Image.Image, ops: list[dict], where: str = "sheet") -> Image.Image:
    """Offline art fixes on an approved sheet, applied in order before the cells are cut (no paid art): each op
    copies a rect of the sheet, `{"from": [x, y, w, h], "to": [x, y]}` in the sheet's native px, optionally
    mirrored (`"flip": "h"` or `"v"`), replacing the target pixels (`"mode": "replace"`, default) or composited over
    them (`"mode": "over"`). Kept by approve.py when a sheet is re-approved."""
    if not ops:
        return sheet
    out = sheet.copy()
    for n, op in enumerate(ops):
        try:
            x, y, w, h = (int(v) for v in op["from"])
            tx, ty = (int(v) for v in op["to"])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"{where}: paint {n} needs from: [x, y, w, h] and to: [x, y] ({e})") from e
        if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > sheet.width or y + h > sheet.height:
            raise ValueError(f"{where}: paint {n} source rect {op['from']} is outside the {sheet.size} sheet")
        if tx < 0 or ty < 0 or tx + w > sheet.width or ty + h > sheet.height:
            raise ValueError(f"{where}: paint {n} target {op['to']} (+{w}x{h}) is outside the {sheet.size} sheet")
        patch = out.crop((x, y, x + w, y + h))
        flip = op.get("flip")
        if flip == "h":
            patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        elif flip == "v":
            patch = patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        elif flip is not None:
            raise ValueError(f"{where}: paint {n} flip must be h or v, not {flip!r}")
        mode = op.get("mode", "replace")
        if mode == "replace":
            out.paste(patch, (tx, ty))
        elif mode == "over":
            out.alpha_composite(patch, (tx, ty))
        else:
            raise ValueError(f"{where}: paint {n} mode must be replace or over, not {mode!r}")
    return out


@lru_cache(maxsize=None)
def approved_landmarks(approved_dir: Path = APPROVED) -> dict[str, Image.Image]:
    """The approved landmark cells by part name, from every landmark sheet (a missing sheet adds nothing; a cell
    name in two sheets is an error)."""
    out: dict[str, Image.Image] = {}
    for sheet in LANDMARK_SHEETS:
        meta_path = (approved_dir / sheet.relative_to(APPROVED)).with_suffix(".json")
        if not meta_path.is_file():
            continue
        meta = json.loads(meta_path.read_text())
        img = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
        t = meta.get("tile", T)
        for r, row in enumerate(meta["cells"]):
            for c, n in enumerate(row):
                if n in _LANDMARK_CELL:
                    if n in out:
                        raise ValueError(f"landmark cell {n} is in two sheets ({meta_path.name})")
                    out[n] = img.crop((c * t, r * t, (c + 1) * t, (r + 1) * t))
    return out


@lru_cache(maxsize=None)
def approved_ar(approved_dir: Path = APPROVED) -> tuple[dict[str, np.ndarray], dict[str, Image.Image]]:
    """The AR sheet's (materials, parts); a missing sheet adds nothing. A name an older sheet uses is an error."""
    meta_path = (approved_dir / AR_SHEET.relative_to(APPROVED)).with_suffix(".json")
    if not meta_path.is_file():
        return {}, {}
    meta = json.loads(meta_path.read_text())
    img = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
    t = meta.get("tile", T)
    mats = {n: np.asarray(img.convert("RGB").crop((x, y, x + w, y + h))).copy()
            for n, (x, y, w, h) in meta["materials"].items()}
    parts = {n: img.crop((c * t, r * t, (c + 1) * t, (r + 1) * t))
             for r, row in enumerate(meta["cells"]) for c, n in enumerate(row) if n}
    clash = sorted((set(mats) | set(parts)) & (set(_PARTS) | {m for m in MATERIALS if m not in ("taiga", "snow", "swamp")}))
    if clash:
        raise ValueError(f"{meta_path.name}: names an older sheet uses: {clash}")
    return mats, parts


def load_kit(kit_id: str, approved_dir: Path = APPROVED, placeholders_only: bool = False) -> Kit:
    kit = Kit(kit_id, {n: placeholder_part(n) for n in PART_NAMES}, {n: placeholder_material(n) for n in MATERIALS})
    root = approved_dir / kit_id
    if placeholders_only:
        return kit
    for name, cell in approved_landmarks(approved_dir).items():
        kit.parts[name] = cell
        kit.approved.add(name)
    mats, parts = approved_ar(approved_dir)
    for name, m in mats.items():
        kit.materials[name] = m
        kit.approved.add(name)
    for name, p in parts.items():
        kit.parts[name] = p
        kit.approved.add(name)
    if not root.is_dir():
        return kit
    for meta_path in sorted(root.glob("*.json")):
        if any(meta_path.stem == s.name and root.name == s.parent.name for s in (*LANDMARK_SHEETS, AR_SHEET)):
            continue                                   # loaded above, for every kit
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
        sheet = apply_paint(sheet, meta.get("paint") or [], f"{kit_id}/{meta_path.name}")
        tile = meta.get("tile", T)
        for r, row in enumerate(meta.get("cells", [])):
            for c, name in enumerate(row):
                if not name:
                    continue
                kit.parts[name] = sheet.crop((c * tile, r * tile, (c + 1) * tile, (r + 1) * tile))
                kit.approved.add(name)
        for name, (x, y, w, h) in (meta.get("materials") or {}).items():
            kit.materials[name] = np.asarray(sheet.convert("RGB").crop((x, y, x + w, y + h)))
            kit.approved.add(name)
    return kit


def load_kits(kit_ids: list[str], approved_dir: Path = APPROVED) -> Kit:
    """Several kits merged in order (later kits add to / override earlier ones); approved parts win over placeholders."""
    merged = load_kit(kit_ids[0], approved_dir)
    for kid in kit_ids[1:]:
        k = load_kit(kid, approved_dir)
        for name, part in k.parts.items():
            if name in k.approved or name not in merged.approved:
                merged.parts[name] = part
        for name, mat in k.materials.items():
            if name in k.approved or name not in merged.approved:
                merged.materials[name] = mat
        merged.approved |= k.approved
    merged.id = "+".join(kit_ids)
    return merged


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: python3 -I assets-src/tools/kit.py --selftest")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import kit_selftest  # noqa: E402
    sys.exit(kit_selftest.main())

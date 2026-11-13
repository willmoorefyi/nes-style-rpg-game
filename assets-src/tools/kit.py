"""Tile kits for the map compiler (docs/ART_TILES_PLAN.md).

A kit is a set of named parts (48x48 RGBA tiles, or multi-tile props stored as several named cells) plus
seamless material textures sampled by global pixel position. Every part starts as a code-drawn placeholder
(flat colour, outline, 2-letter label); approved Gemini kit sheets in assets-src/gen/approved/<kit>/*.png override
parts by cell name (their .json lists `cells`, rows of part names or null, and optionally `materials`).
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
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
}

ROOF_ROWS = ("ridge", "mid", "eave")
SIGNS = ("weapon", "armor", "item", "white_magic", "black_magic", "inn")
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

PART_NAMES = tuple(_PARTS)


def _font():
    return ImageFont.load_default()


def _dark(c, f=0.55):
    return tuple(int(v * f) for v in c)


def placeholder_part(name: str) -> Image.Image:
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


def load_kit(kit_id: str, approved_dir: Path = APPROVED, placeholders_only: bool = False) -> Kit:
    kit = Kit(kit_id, {n: placeholder_part(n) for n in PART_NAMES}, {n: placeholder_material(n) for n in MATERIALS})
    root = approved_dir / kit_id
    if placeholders_only or not root.is_dir():
        return kit
    for meta_path in sorted(root.glob("*.json")):
        meta = json.loads(meta_path.read_text())
        sheet = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
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

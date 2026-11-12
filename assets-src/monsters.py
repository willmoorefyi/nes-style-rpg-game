"""Procedural SNES-style monster sprites for the FF1-style RPG.

build(out_root) writes out_root/sprites/monsters/<id>.png (3x nearest-neighbour; native
32px small / 64px large / 96px boss) and a contact sheet in assets-src/preview/.
"""
from pathlib import Path

from PIL import Image, ImageDraw

import monsters_boss as boss
import monsters_large as large
import monsters_small as small

SCALE = 3
HERE = Path(__file__).resolve().parent

_BUILDERS = {
    "goblin": small.goblin,
    "wolf": small.wolf,
    "skeleton": small.skeleton,
    "pirate": small.pirate,
    "ogre": large.ogre,
    "troll": large.troll,
    "mummy": small.mummy,
    "cockatrice": small.cockatrice,
    "vampire": small.vampire,
    "dragon": large.dragon,
    "garland": large.garland,
    "lich": boss.lich,
}


def monster_ids() -> list[str]:
    return list(_BUILDERS)


def build(out_root: Path) -> None:
    out_dir = Path(out_root) / "sprites" / "monsters"
    out_dir.mkdir(parents=True, exist_ok=True)
    preview = HERE / "preview"
    preview.mkdir(exist_ok=True)
    imgs: dict[str, Image.Image] = {}
    for mid, fn in _BUILDERS.items():
        native = fn().image()
        big = native.resize((native.width * SCALE, native.height * SCALE), Image.NEAREST)
        big.save(out_dir / f"{mid}.png")
        imgs[mid] = big
    _contact(imgs, preview / "monsters-contact.png")


def _contact(imgs: dict[str, Image.Image], path: Path) -> None:
    pad, label = 10, 12
    cols = 4
    cw = max(i.width for i in imgs.values()) + pad * 2
    rows = [list(imgs.items())[i:i + cols] for i in range(0, len(imgs), cols)]
    rh = [max(i.height for _, i in r) + label + pad * 2 for r in rows]
    sheet = Image.new("RGBA", (cw * cols, sum(rh)), (52, 70, 60, 255))
    d = ImageDraw.Draw(sheet)
    y = 0
    for r, h in zip(rows, rh):
        for c, (mid, im) in enumerate(r):
            x = c * cw + (cw - im.width) // 2
            sheet.alpha_composite(im, (x, y + pad + (h - label - pad * 2 - im.height)))
            d.text((c * cw + pad, y + h - label - 2), mid, fill=(240, 240, 220, 255))
        y += h
    sheet.save(path)

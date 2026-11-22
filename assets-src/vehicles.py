"""Field vehicles (docs/QUEST_PLAN.md 4.2, docs/WORLD_PLAN.md 5.2 W1-A; art pass VEH-INT): the ship, the airship and
the canoe, facing right (the runtime mirrors them for left).

The approved art lives in assets-src/gen/approved/vehicles/ (`airship.png`, `ship.png`, `canoe.png` and the canoe's
near-side layer `canoe_front.png`, pass LM2, each with its json). A vehicle without an approved file falls back to the
code-drawn 24 px cell below, doubled to the 48 px map-native cell. The ripple strip under the canoe is code-drawn. The
airship's optional end and turn views (`OPTIONAL`, pass AR) follow the side frames when their approved files exist.

Writes assets/sprites/vehicles.png (map-native px: the game draws each native px at TILE_SIZE / 48 with
nearest-neighbour) and assets/sprites/vehicles.json:
  {version: 2, native: 48, frames: {<name>: {x, y, w, h, anchor: [ax, ay], footRow}}, canoe: {cutRow, heroWaist,
   heroDrop}, sources: {<vehicle>: "approved" | "code"}}
Each frame is cropped to its drawn pixels; `anchor` is the point set on the bottom edge of the vehicle's tile (the keel
centre for the ship and the airship, the middle for the canoe; ay 1 = the frame's bottom), `footRow` the frame's last
drawn row (the depth-sort row). `canoe_front` shares the canoe's box. Deterministic: no randomness, fixed order.

Usage: python3 -I assets-src/build_assets.py vehicles
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from pixel import Canvas
from snes_palette import STONE, WATER, WOOD, c15

CELL = 24                       # the code-drawn fallback's cell (drawn doubled)
NATIVE = 48                     # map-native px per tile
APPROVED = Path(__file__).resolve().parent / "gen" / "approved" / "vehicles"
ORDER = ("ship", "airship", "canoe")
# The airship's end and turn views (docs/AIRSHIP_VIEWS_PLAN.md 4.2): approved only, cut by gen/vehicle_view_cut.py; the
# json `anchor` is stated in the cropped frame (the centroid rule) and used as written. A missing one is left out (the
# runtime then shows the side view for that heading).
OPTIONAL = ("airship_back", "airship_front", "airship_back_turn", "airship_front_turn")
GAP = 2
HERO_WAIST = 56                 # the field hero's waist row (48x96 native cell): the canoe cuts it here
KEEL_ROWS = 6                   # the bottom rows whose centroid is the keel centre

SAIL = [c15(24, 24, 26), c15(28, 28, 29), c15(31, 31, 31)]
RED = [c15(16, 4, 4), c15(23, 7, 6), c15(28, 12, 9)]
BRASS = [c15(18, 13, 4), c15(25, 20, 7), c15(30, 26, 12)]
OUTLINE = c15(3, 2, 3)


def ship() -> Canvas:
    """A two-masted sailing ship: a dark hull with a red stripe, two white sails, a pennant."""
    c = Canvas(CELL, CELL)
    c.poly([(2, 14), (21, 14), (19, 19), (5, 19)], WOOD[1])
    c.rect(3, 14, 20, 14, WOOD[3])
    c.rect(4, 16, 19, 16, RED[1])
    c.rect(2, 12, 5, 13, WOOD[2])
    c.rect(2, 12, 5, 12, WOOD[4])
    c.rect(9, 3, 9, 13, WOOD[0])
    c.rect(15, 5, 15, 13, WOOD[0])
    c.poly([(10, 4), (14, 5), (14, 11), (10, 12)], SAIL[1])
    c.rect(10, 4, 10, 12, SAIL[2])
    c.poly([(16, 6), (19, 7), (19, 12), (16, 12)], SAIL[1])
    c.rect(16, 6, 16, 12, SAIL[2])
    c.rect(12, 7, 13, 8, SAIL[0])
    c.rect(10, 2, 12, 2, RED[2])
    c.outline(OUTLINE)
    return c


def airship() -> Canvas:
    """A propeller airship: a brass gondola under a red envelope, a tail fin and a propeller."""
    c = Canvas(CELL, CELL)
    c.ellipse(11.5, 7.5, 9.0, 4.5, RED[1])
    c.ellipse(9.5, 6.0, 5.0, 2.0, RED[2])
    c.rect(4, 10, 19, 10, RED[0])
    c.poly([(1, 4), (4, 6), (4, 9), (1, 11)], RED[0])
    c.rect(7, 12, 7, 14, STONE[1])
    c.rect(16, 12, 16, 14, STONE[1])
    c.rect(6, 15, 17, 18, BRASS[1])
    c.rect(6, 15, 17, 15, BRASS[2])
    c.rect(8, 16, 9, 17, STONE[0])
    c.rect(12, 16, 13, 17, STONE[0])
    c.rect(18, 16, 19, 17, STONE[2])
    c.rect(20, 14, 20, 19, STONE[3])
    c.outline(OUTLINE)
    return c


def canoe() -> Canvas:
    """A low wooden canoe (no paddle: the hero sits in it)."""
    c = Canvas(CELL, CELL)
    c.poly([(1, 16), (22, 16), (19, 20), (4, 20)], WOOD[2])
    c.rect(2, 16, 21, 16, WOOD[4])
    c.rect(5, 18, 18, 18, WOOD[1])
    c.outline(OUTLINE)
    return c


DRAW = {"ship": ship, "airship": airship, "canoe": canoe}


def ripple(w: int) -> Image.Image:
    """A 3-row strip of broken light water lines, drawn under the canoe's hull on the river."""
    c = Canvas(w, 3)
    for x in range(w):
        if x % 7 in (0, 1, 2, 3) and 1 <= x < w - 1:
            c.set(x, 0 if (x // 7) % 2 else 1, WATER[4])
        if x % 5 in (1, 2) and 3 <= x < w - 3:
            c.set(x, 2, WATER[3])
    return c.img


def source(name: str) -> tuple[Image.Image, str]:
    """The vehicle's right-facing art in map-native px: the approved file, else the code-drawn cell doubled."""
    path = APPROVED / f"{name}.png"
    if path.exists():
        return Image.open(path).convert("RGBA"), "approved"
    print(f"vehicles: no approved {path.name}; using the code-drawn {name}")
    img = DRAW[name]().img
    return img.resize((img.width * 2, img.height * 2), Image.Resampling.NEAREST), "code"


def bbox(img: Image.Image) -> tuple[int, int, int, int]:
    box = img.getchannel("A").getbbox()
    if box is None:
        raise ValueError("an empty vehicle image")
    return box


def keel_x(img: Image.Image) -> float:
    """The centroid column of the bottom KEEL_ROWS drawn rows, as a fraction of the width."""
    a = img.getchannel("A").load()
    assert a is not None
    rows = [y for y in range(img.height) if any(a[x, y] for x in range(img.width))][-KEEL_ROWS:]
    xs = [x + 0.5 for y in rows for x in range(img.width) if a[x, y]]
    return round(sum(xs) / len(xs) / img.width, 4)


def front_layer(img: Image.Image) -> tuple[Image.Image, int]:
    """The canoe's near side: the rows from 2 below the gunwale (the top drawn row at mid-hull) down."""
    a = img.getchannel("A").load()
    assert a is not None
    mid = img.width // 2
    gunwale = next(y for y in range(img.height) if a[mid, y])
    cut = gunwale + 2
    out = img.copy()
    out.paste((0, 0, 0, 0), (0, 0, img.width, cut))
    return out, cut


def build(assets: Path) -> None:
    out = assets / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    images: dict[str, Image.Image] = {}
    anchors: dict[str, list[float]] = {}
    sources: dict[str, str] = {}
    canoe_cut = 0
    for name in ORDER:
        img, src = source(name)
        sources[name] = src
        if name == "canoe" and (APPROVED / "canoe_front.png").exists() and src == "approved":
            front = Image.open(APPROVED / "canoe_front.png").convert("RGBA")
            canoe_cut = next(y for y in range(front.height) if front.getchannel("A").crop((0, y, front.width, y + 1)).getbbox())
        elif name == "canoe":
            front, canoe_cut = front_layer(img)
        box = bbox(img)
        images[name] = img.crop(box)
        anchors[name] = [0.5 if name == "canoe" else keel_x(images[name]), 1.0]
        if name == "canoe":
            images["canoe_front"] = front.crop(box)
            anchors["canoe_front"] = anchors["canoe"]
            canoe_cut -= box[1]
            images["canoe_ripple"] = ripple(images["canoe"].width + 6)
            anchors["canoe_ripple"] = [0.5, 1.0]
    for name in OPTIONAL:
        path = APPROVED / f"{name}.png"
        if not path.exists():
            print(f"vehicles: no approved {name}; the airship uses its side view for that heading")
            continue
        img = Image.open(path).convert("RGBA")
        images[name] = img.crop(bbox(img))
        anchors[name] = [float(json.loads(path.with_suffix(".json").read_text())["anchor"][0]), 1.0]
        sources[name] = "approved"
    w = sum(i.width for i in images.values()) + GAP * (len(images) - 1)
    h = max(i.height for i in images.values())
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    frames: dict[str, dict[str, object]] = {}
    x = 0
    for name, img in images.items():
        sheet.paste(img, (x, 0))
        frames[name] = {"x": x, "y": 0, "w": img.width, "h": img.height, "anchor": anchors[name],
                        "footRow": img.height - 1}
        x += img.width + GAP
    ch = images["canoe"].height
    hero_drop = NATIVE * 2 - ch + canoe_cut - HERO_WAIST
    meta = {
        "version": 2,
        "native": NATIVE,
        "frames": frames,
        "canoe": {"cutRow": canoe_cut, "heroWaist": HERO_WAIST, "heroDrop": hero_drop},
        "sources": sources,
    }
    sheet.save(out / "vehicles.png", optimize=False)
    (out / "vehicles.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"vehicles: {len(frames)} frames ({', '.join(f'{k} {v}' for k, v in sources.items())}), sheet {w}x{h} native")

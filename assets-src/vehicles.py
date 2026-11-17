"""Code-drawn field vehicles (docs/QUEST_PLAN.md 4.2, docs/WORLD_PLAN.md 5.2 W1-A): the ship, the airship and the
canoe, one 24x24 native frame each, facing right (the runtime mirrors them for left). No AI images.

Writes assets/sprites/vehicles.png (native size; the game scales it by TILE_SIZE / 24 with nearest-neighbour) and
assets/sprites/vehicles.json ({cell, frames: {type: [x, y]}}). Deterministic: no randomness.

Usage: python3 -I assets-src/build_assets.py vehicles
"""
from __future__ import annotations

import json
from pathlib import Path

from pixel import Canvas
from snes_palette import STONE, WOOD, c15

CELL = 24
ORDER = ("ship", "airship", "canoe")

SAIL = [c15(24, 24, 26), c15(28, 28, 29), c15(31, 31, 31)]
RED = [c15(16, 4, 4), c15(23, 7, 6), c15(28, 12, 9)]
BRASS = [c15(18, 13, 4), c15(25, 20, 7), c15(30, 26, 12)]
OUTLINE = c15(3, 2, 3)


def ship() -> Canvas:
    """A two-masted sailing ship: a dark hull with a red stripe, two white sails, a pennant."""
    c = Canvas(CELL, CELL)
    # hull: a boat shape with a raised stern (left) and a pointed bow (right)
    c.poly([(2, 14), (21, 14), (19, 19), (5, 19)], WOOD[1])
    c.rect(3, 14, 20, 14, WOOD[3])                   # deck edge (lit from the top-left)
    c.rect(4, 16, 19, 16, RED[1])                    # stripe
    c.rect(2, 12, 5, 13, WOOD[2])                    # stern castle
    c.rect(2, 12, 5, 12, WOOD[4])
    # masts
    c.rect(9, 3, 9, 13, WOOD[0])
    c.rect(15, 5, 15, 13, WOOD[0])
    # sails, bellied to the right
    c.poly([(10, 4), (14, 5), (14, 11), (10, 12)], SAIL[1])
    c.rect(10, 4, 10, 12, SAIL[2])
    c.poly([(16, 6), (19, 7), (19, 12), (16, 12)], SAIL[1])
    c.rect(16, 6, 16, 12, SAIL[2])
    c.rect(12, 7, 13, 8, SAIL[0])                    # a shaded fold
    # pennant
    c.rect(10, 2, 12, 2, RED[2])
    c.outline(OUTLINE)
    return c


def airship() -> Canvas:
    """A propeller airship: a brass gondola under a red envelope, a tail fin and a propeller."""
    c = Canvas(CELL, CELL)
    c.ellipse(11.5, 7.5, 9.0, 4.5, RED[1])          # envelope
    c.ellipse(9.5, 6.0, 5.0, 2.0, RED[2])           # highlight (top-left light)
    c.rect(4, 10, 19, 10, RED[0])                    # underside shade
    c.poly([(1, 4), (4, 6), (4, 9), (1, 11)], RED[0])  # tail fin
    c.rect(7, 12, 7, 14, STONE[1])                   # rigging
    c.rect(16, 12, 16, 14, STONE[1])
    c.rect(6, 15, 17, 18, BRASS[1])                  # gondola
    c.rect(6, 15, 17, 15, BRASS[2])
    c.rect(8, 16, 9, 17, STONE[0])                   # portholes
    c.rect(12, 16, 13, 17, STONE[0])
    c.rect(18, 16, 19, 17, STONE[2])                 # propeller hub
    c.rect(20, 14, 20, 19, STONE[3])                 # propeller blade
    c.outline(OUTLINE)
    return c


def canoe() -> Canvas:
    """A low wooden canoe with a paddle (drawn under the hero, so only the hull and the paddle show)."""
    c = Canvas(CELL, CELL)
    c.poly([(1, 16), (22, 16), (19, 20), (4, 20)], WOOD[2])
    c.rect(2, 16, 21, 16, WOOD[4])
    c.rect(5, 18, 18, 18, WOOD[1])
    c.line(17, 11, 21, 21, WOOD[3])                 # paddle shaft
    c.rect(20, 20, 22, 22, WOOD[3])                  # paddle blade
    c.outline(OUTLINE)
    return c


DRAW = {"ship": ship, "airship": airship, "canoe": canoe}


def build(assets: Path) -> None:
    out = assets / "sprites"
    out.mkdir(parents=True, exist_ok=True)
    sheet = Canvas(CELL * len(ORDER), CELL)
    frames: dict[str, list[int]] = {}
    for i, name in enumerate(ORDER):
        sheet.paste(DRAW[name](), i * CELL, 0)
        frames[name] = [i * CELL, 0]
    sheet.img.save(out / "vehicles.png")
    meta = {"cell": [CELL, CELL], "frames": frames}
    (out / "vehicles.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"vehicles: {len(ORDER)} frames, sheet {sheet.w}x{sheet.h} native")

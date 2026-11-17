"""The places of region WIND on the world map (docs/WORLD_PLAN.md 2.2, 4.7): the icons and their doors, the anchor
entrances, the inspect cells and the encounter zones, in world cells.

- Gaia (WND-T's site file `wind/town_gaia_site.py`): its door, gate and icon are read from the site, so a change
  there moves them. The icon is a town roof beside a stilled windmill, the door between them.
- The Mirage Tower (anchor `wnd_mirage`): a tower on the sands' west spit, its door the tower's bottom-right cell and
  a fallen block of its masonry beside the door; the door leads to `mirage-1f` entrance `arrival` (the vestibule,
  WND-D1's chime door is inside it).
- Lufenia (anchor `wnd_lufenia`): two pale domes on the north lip of the mesa, the door under the east dome.

The zones (4.7, 4.0.3): one walking zone per basin (each holds every walkable cell its anchor reaches, and the lake
cells beside them, for the canoe), and one ship zone over every Water cell of the box.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from overworld_zones import row_rects  # noqa: E402
from common import MAPS  # noqa: E402
from stubs import is_stub  # noqa: E402
from wind import town_gaia_site as GAIA  # noqa: E402

# The Mirage's door opens onto `mirage-1f` (WND-D1) only once that map is built: its stub has no chime door between
# `arrival` and `inner`, so a door into it would let the party past the chime (travel rows T6-T7). Until then the
# door is shut (blocked, with an inspect line); the integrator's regeneration at WND-D1's merge opens it.
MIRAGE_OPEN = not is_stub(MAPS / "mirage-1f.yaml")

WALKABLE = frozenset(".,:fs=%w_+-")
LAKE, OCEAN = "≈", "o"
LANDMARK_SIZE = {"windmill": (2, 3), "tower": (2, 3), "dome": (2, 2)}      # kit.LANDMARKS (cells wide, high)

# a rocky knoll behind Gaia's door: the hall's roof row stands on it, so the door has one way out (south)
KNOLL = [(GAIA.DOOR[0] + i, GAIA.DOOR[1] - j) for j in (1, 2) for i in (0, 1)]
MIRAGE_DOOR = (132, 36)                     # 2.2 target (132, 36); the arrival is the sand cell below it
MIRAGE_GATE = (132, 37)
LUFENIA_DOOR = (152, 45)
LUFENIA_GATE = (152, 46)                     # 2.2 target (152, 46)
GAIA_DOOR, GAIA_GATE = tuple(GAIA.DOOR), tuple(GAIA.GATE)


def landmark_parts(name: str) -> list[list[str]]:
    """kit.landmark_parts without importing the kit (the code-drawn placeholder cells until art is approved)."""
    w, h = LANDMARK_SIZE[name]
    return [[f"{name}_icon_{r}_{c}" for c in range(w)] for r in range(h)]


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


# S23 / S26 / S27 rosters (3.2); neighbouring zones differ in species (the W5 rule)
HIGHLANDS = [{"groups": [_g("tyrannosaur", 1)], "weight": 3},
             {"groups": [_g("chimera", 1, 2)], "weight": 3},
             {"groups": [_g("green_dragon", 1)], "weight": 2},
             {"groups": [_g("tyrannosaur", 1), _g("chimera", 1)], "weight": 1}]
MESA = [{"groups": [_g("medusa", 2, 4)], "weight": 3},
        {"groups": [_g("chimera", 1, 2)], "weight": 2},
        {"groups": [_g("green_dragon", 1)], "weight": 2},
        {"groups": [_g("chimera", 1), _g("medusa", 1, 3)], "weight": 2}]
SANDS = [{"groups": [_g("sand_worm", 1, 2)], "weight": 3},
         {"groups": [_g("stone_golem", 1, 2)], "weight": 3},
         {"groups": [_g("chimera", 1, 2)], "weight": 2},
         {"groups": [_g("stone_golem", 1), _g("sand_worm", 1)], "weight": 1}]
SEA = [{"groups": [_g("sahagin_prince", 2, 4)], "weight": 3},
       {"groups": [_g("sea_snake", 1, 2)], "weight": 3},
       {"groups": [_g("white_shark", 1)], "weight": 2},
       {"groups": [_g("deepeyes", 1)], "weight": 1}]
ZONES = [  # (id, habitat name, root entrance cell, table, battle backdrop overrides)
    ("wnd_highlands", "Gaia Highlands", GAIA_GATE, HIGHLANDS, {"terrain": {"forest": "forest"}}),
    ("wnd_mirage_sands", "Mirage Sands", MIRAGE_GATE, SANDS, {"default": "desert", "terrain": {"forest": "forest"}}),
    ("wnd_lufen_moor", "Lufenian Mesa", LUFENIA_GATE, MESA, {"terrain": {"swamp": "marsh", "forest": "forest"}}),
]
INSPECT = [  # (x, y, lines): each on a blocked boulder with a walkable neighbour
    (162, 12, ["A cairn of flat stones in the throat of the pass.",
               "The prayer ribbons tied to it hang dead straight. Nothing has stirred them in a long while."]),
    (141, 38, ["Half a bronze dial juts from the sand, its numbers worn smooth.",
               "Its shadow-pin points at the tower, though the sun is behind you."]),
]


def objects() -> list[dict]:
    dx, dy = GAIA_DOOR
    return [
        # Gaia: a stilled windmill west of the door, a roofed hall over and east of it
        # (collide: alpha, the placeholders' top rows are mostly sky: an open cell there is walked behind)
        {"type": "deco", "name": "gaia", "parts": [["town_icon_0_0", "town_icon_0_1"], ["town_icon_1_0", "town_icon_1_1"]],
         "x": dx, "y": dy - 1, "walk_cells": [[0, 1]], "collide": "alpha"},
        {"type": "deco", "name": "gaia_mill", "parts": landmark_parts("windmill"), "x": dx - 2, "y": dy - 2,
         "collide": "alpha"},
        {"type": "deco", "name": "gaia_mill_east", "parts": landmark_parts("windmill"), "x": 146, "y": 8,
         "collide": "alpha"},
        # the Mirage Tower, with a fallen block of it beside the door
        {"type": "deco", "name": "mirage", "parts": landmark_parts("tower"), "x": MIRAGE_DOOR[0] - 1,
         "y": MIRAGE_DOOR[1] - 2, "walk_cells": [[1, 2]] if MIRAGE_OPEN else []},
        {"type": "deco", "parts": [["boulder"]], "x": MIRAGE_DOOR[0] + 1, "y": MIRAGE_DOOR[1]},
        # Lufenia: two pale domes, the door under the east one
        {"type": "deco", "name": "lufenia_west", "parts": landmark_parts("dome"), "x": LUFENIA_DOOR[0] - 2,
         "y": LUFENIA_DOOR[1] - 1},
        {"type": "deco", "name": "lufenia", "parts": landmark_parts("dome"), "x": LUFENIA_DOOR[0],
         "y": LUFENIA_DOOR[1] - 1, "walk_cells": [[0, 1]]},
        *({"type": "deco", "parts": [["boulder"]], "x": x, "y": y} for x, y, _ in INSPECT),
    ]


def transitions() -> list[dict]:
    return [{"x": GAIA_DOOR[0], "y": GAIA_DOOR[1], "targetMap": GAIA.TOWN, "targetEntrance": "gate"},
            *([{"x": MIRAGE_DOOR[0], "y": MIRAGE_DOOR[1], "targetMap": "mirage-1f", "targetEntrance": "arrival"}]
              if MIRAGE_OPEN else []),
            {"x": LUFENIA_DOOR[0], "y": LUFENIA_DOOR[1], "targetMap": "lufenia", "targetEntrance": "gate"}]


def entrances() -> dict[str, list[int]]:
    return {GAIA.ANCHOR: list(GAIA_GATE), "wnd_mirage": list(MIRAGE_GATE), "wnd_lufenia": list(LUFENIA_GATE)}


def blocked() -> set[tuple[int, int]]:
    """The cells the objects block (named parts outside their walk cells)."""
    out = set()
    for o in objects():
        for j, row in enumerate(o["parts"]):
            for i, name in enumerate(row):
                if name and [i, j] not in o.get("walk_cells", []):
                    out.add((o["x"] + i, o["y"] + j))
    return out


def _flood(g: dict, seed: tuple[int, int], shut: set) -> set[tuple[int, int]]:
    seen, q = {seed}, deque([seed])
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and n in g and g[n] in WALKABLE and n not in shut:
                seen.add(n)
                q.append(n)
    return seen


def seal(g: dict) -> list[str]:
    """Raise Gaia's knoll, then turn walkable pockets that no anchor reaches on foot (a cell boxed in by the tarn's
    shore) into mountain."""
    for c in KNOLL:
        g[c] = "m"
    shut: set = set()
    held = set().union(*(_flood(g, seed, shut) for _, _, seed, _, _ in ZONES))
    loose = sorted((c for c, ch in g.items() if ch in WALKABLE and c not in held and c not in shut),
                   key=lambda c: (c[1], c[0]))
    for c in loose:
        g[c] = "m"
    return [f"sealed the pocket cell {c} with 'm'" for c in loose]


def zones(g: dict) -> tuple[list[dict], dict]:
    """The encounter zones and their battle backdrops. Fails when a walkable cell is in no walking zone. The floods
    run through the objects (an alpha-collided icon's open top row is walked), so their cells are zoned too."""
    shut, out, backdrops, held = set(), [], {}, set()
    for zid, name, seed, table, bg in ZONES:
        cells = _flood(g, seed, shut)
        cells |= {(x + dx, y + dy) for x, y in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if g.get((x + dx, y + dy)) == LAKE}
        if cells & held:
            raise SystemExit(f"world_wind: zone {zid} joins another basin on foot")
        held |= cells
        out.append({"id": zid, "name": name, "rects": row_rects(cells), "encounters": table})
        backdrops[zid] = bg
    loose = sorted(c for c, ch in g.items() if ch in WALKABLE and c not in held and c not in shut)
    if loose:
        raise SystemExit(f"world_wind: {len(loose)} walkable cells in no zone, first {loose[0]}")
    sea = {c for c, ch in g.items() if ch == OCEAN}
    out.append({"id": "wnd_sea", "name": "North Seas", "modes": ["ship"], "rects": row_rects(sea), "encounters": SEA})
    backdrops["wnd_sea"] = {"default": "ocean"}
    return out, backdrops


MIRAGE_SHUT = ["A tall door of pale metal, without handle or keyhole. It does not move, and it gives back no echo."]


def inspect() -> list[dict]:
    shut = [] if MIRAGE_OPEN else [{"x": MIRAGE_DOOR[0], "y": MIRAGE_DOOR[1], "text": list(MIRAGE_SHUT)}]
    return [{"x": x, "y": y, "text": list(t)} for x, y, t in INSPECT] + shut

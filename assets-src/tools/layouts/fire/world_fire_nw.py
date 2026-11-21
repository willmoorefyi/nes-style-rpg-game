"""Region FIRE's content on the NW world (pass NW, NW-R FIRE; docs/NATURAL_WORLD_PLAN.md 3.3, 3.8 `coverage`, 7).

The composer v2 (`world.py`) calls `content(g, meta, b, trans)` after the generator: FIRE's geography is its spec
(`world_specs/fire.py`), its doors the composer's (today's door offsets, `world_specs/today_doors.py`); this module
places what stands on that ground, as today's world has it (`world_fire_data.py`, FIR-O / FIR-T), ported to the new
cells:

- the sites' icons with their doors as `walk_cells`: Crescent Lake's approved `town_crescent` (3x3, the door in its
  left column), Gurgu's `volcano` (3x2, door bottom centre, with the crater's smoke), the Ice Cavern's snow
  `cave_mouth` (2x2, its top row a rock ledge on the Rime Hollow's north wall; NW2: the hollow's floor snow with
  taiga pines), the `buried_hull` (3x2) on its dune with the hatch below it (`fir_hull_hatch`, S17: the levistone
  raises the airship);
- the dressing: the Circle's `standing_stones` on a promontory that bends Crescent Lake into its crescent, the
  hollow's `ice_floe` and four boulders in the ash; the smouldering vents round the volcano (`fir_ash_vents`), never
  on a corridor or by the mouth;
- the zones (same ids and rosters as today, `fire_tables.py`) over every FIRE-owned walkable, canoe and sea cell:
  Crescent's shore (the land walkable from its gate), the cold tip beyond ice_neck (the frost zone; NW2), the south
  lands split between the ash (nearest Gurgu) and the hull desert, the rivers and lakes, the Aldi and the outer
  seas by basin; and their battle backdrops.

Stamps (3.3's `rock` and `icon` kinds, on FIRE-owned cells only, after the generator): the neck's rock (`neck`), the
ledge above the cave mouth and the hollow's pines, the volcano's top row on the cone, the hull's dune, the town's
footprint, the promontory, the Rime Hollow's floor. The composer's `coverage` line (`world_content.coverage`, NW-RINT) proves 3.8's rule
for FIRE: every walkable or canoe cell it owns in one zone of its kind, every sea cell in exactly one ship zone.
"""
from __future__ import annotations

import numpy as np

import kit as K
from world_api import REGIONS
from worldgen import spec as S
from worldgen.gates import BLOCK
from worldgen.geom import disc, flood

from fire import fire_tables as T
from fire.world_fire_nw_zones import REGION, row_rects, zone_cells

TARGETS = {"fir_crescent": "crescent", "fir_volcano": "gurgu-b1", "fir_ice": "ice-cavern-b1"}
LAKE = ((67, 22), 5.0)                   # Crescent Lake (world_specs/fire.py), Cornelia-relative centre and radius
PROMONTORY = ((70.5, 22), 3.2)           # the ring's spur into the lake that makes it a crescent opening west
NECK_BOX, NECK_R = (10, 29, 26, 52), 2   # the neck's box (Cornelia-relative x0, y0, x1, y1); its rock's reach
HOLLOW_MAX = 90                          # NW2: the Rime Hollow's floor is at most this many cells
VENT_BOXES = ((3, -8, 7, -6), (5, -4, 10, -2), (-6, -9, -2, -7))   # (dx0, dy0, dx1, dy1) from Gurgu's entrance
FLOE_TRY = ((-2, 2), (-4, 2), (-5, 1), (-4, 4), (2, 3), (-6, 3))     # the floe's top-left from the Ice Cavern's
BOULDER_TRY = ((5, -3), (8, 1), (-5, 4), (4, 6), (9, -5), (-4, -3), (7, 5))   # from Gurgu's entrance


def _door(trans: list[dict], target: str) -> tuple[int, int]:
    t = next(t for t in trans if t["targetMap"] == target)
    return int(t["x"]), int(t["y"])


def _deco(name: str, x: int, y: int, **kw) -> dict:
    return {"type": "deco", "name": name, "parts": K.landmark_parts(name), "x": int(x), "y": int(y), **kw}


def _box(x: int, y: int, w: int, h: int) -> list[tuple[int, int]]:
    return [(x + i, y + j) for j in range(h) for i in range(w)]


def _free(g, cells, avoid: set) -> bool:
    return all(g[y, x] not in BLOCK and (x, y) not in avoid for x, y in cells)


def _band(meta: dict) -> set:
    """FIRE's corridors (3 cells wide): no vent, floe or boulder on them."""
    out = set()
    for name, cells in meta["corridors"].items():
        if name.startswith("fir_"):
            out |= {(x + dx, y + dy) for x, y in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    return out


def _stamp_icons(g, meta, e, doors) -> dict:
    """The icons' top-left cells, with their footprints stamped (town grass, the cone's rock, the ledge, the dune)."""
    cx, cy = doors["fir_crescent"]
    town = (cx, cy - 1)                  # the door is the icon's left column, middle row (today's)
    for x, y in _box(*town, 3, 3):
        if g[y, x] != "o":
            g[y, x] = "."
    vx, vy = doors["fir_volcano"]
    volcano = (vx - 1, vy - 1)
    for x, y in _box(*volcano, 3, 1):    # the icon's top row on the cone's foot (today: on the mountains)
        g[y, x] = "m"
    ix, iy = doors["fir_ice"]
    cave = (ix - 1, iy - 1)
    for x, y in _box(ix - 1, iy - 1, 3, 1):   # the ledge: the cave mouth cut into rock above the hollow
        g[y, x] = "m"
    g[iy, ix + 1] = "m"                  # ... and beside the door, so the door keeps one way in (warp_leaves)
    _hollow(g, e["fir_ice"], doors["fir_ice"])
    hx, hy = e["fir_desert"]
    hull = (hx - 1, hy - 3)              # the hatch is the cell above the entrance, below the hull's middle
    for x, y in _box(*hull, 3, 2):
        g[y, x] = "s"
    g[hy - 1, hx] = "s"
    return {"town": town, "volcano": volcano, "cave": cave, "hull": hull}


def _hollow(g, at: tuple[int, int], door: tuple[int, int]) -> int:
    """NW2: the Rime Hollow's floor (the walkable cells inside ice_ring, from the cave's entrance) is snow, with
    taiga pines in a sparse pattern; the entrance and the door stay as stamped. A floor over HOLLOW_MAX cells means
    the ring leaked: nothing is painted (the `barriers` line reports the leak). Returns the cells painted."""
    floor = flood(~np.isin(g, BLOCK), [at])
    if floor.sum() > HOLLOW_MAX:
        return 0
    n = 0
    for y, x in np.argwhere(floor):
        if (int(x), int(y)) not in (at, door):
            g[y, x] = "t" if (x * 7 + y * 13) % 5 == 0 else "n"
            n += 1
    return n


def _promontory(g, meta) -> tuple[int, int]:
    """Bend Crescent Lake into a crescent: the ring's spur into its east half (never a route cell). Returns the
    Circle's stones' top-left, on the spur's west tip."""
    routes = {c for cells in meta["routes"].values() for c in cells}
    (px, py), r = S.poly([PROMONTORY[0]])[0], PROMONTORY[1]
    spur = disc(px, py, r) & (g == "≈")
    for y, x in np.argwhere(spur):
        if (x, y) not in routes:
            g[y, x] = "."
    ys, xs = np.nonzero(spur)
    tip = (int(xs.min()), int(round(py)) - 1)
    return tip


def neck(g, meta) -> int:
    """The rock neck between Elfland's east fells and the south lands (W_south carried to the southern sea; NW-4's T2
    finding): every FIRE-owned land or river cell of the neck box within NECK_R (Chebyshev) of an ELF-owned walkable
    or river cell turns rock, so no river at the seam carries an early canoe from Elfland into FIRE and no foot path
    crosses it. A stamp, not a ridge: a ridge's rain shadow moves the biome quantiles of the whole world (2.5's
    locality note) and so every region's chunks. Returns the cells stamped."""
    x0, y0 = S.world(NECK_BOX[:2])
    x1, y1 = S.world(NECK_BOX[2:])
    reg = meta["region"]
    fire, elf = REGIONS.index(REGION), REGIONS.index("elf")
    elfy = (reg == elf) & ~np.isin(g, ["o", "m"])
    near = np.zeros(g.shape, bool)
    for dy in range(-NECK_R, NECK_R + 1):
        for dx in range(-NECK_R, NECK_R + 1):
            near |= np.roll(np.roll(elfy, dy, 0), dx, 1)
    box = np.zeros(g.shape, bool)
    box[y0:y1 + 1, x0:x1 + 1] = True
    hit = box & near & (reg == fire) & ~np.isin(g, ["o", "≈", "m"])
    g[hit] = "m"
    return int(hit.sum())


def objects(g, meta, trans) -> tuple[list[dict], dict]:
    e = {k: tuple(v) for k, v in meta["entrances"].items()}
    doors = {k: _door(trans, t) for k, t in TARGETS.items()}
    at = _stamp_icons(g, meta, e, doors)
    stones = _promontory(g, meta)
    dx = doors["fir_crescent"][0] - at["town"][0]
    out = [_deco("town_crescent", *at["town"], walk_cells=[[dx, 1]], collide="alpha") | {"name": "crescent_icon"},
           _deco("volcano", *at["volcano"], walk_cells=[[1, 1]], collide="alpha"),
           _deco("cave_mouth", *at["cave"], walk_cells=[[1, 1]], style="snow"),
           _deco("buried_hull", *at["hull"], collide="alpha"),
           _deco("standing_stones", *stones, collide="alpha")]
    taken = set(e.values()) | set(doors.values()) | _band(meta) | {(e["fir_desert"][0], e["fir_desert"][1] - 1)}
    for o in out:
        taken |= set(_box(o["x"] - 1, o["y"] - 1, len(o["parts"][0]) + 2, len(o["parts"]) + 2))
    ix, iy = e["fir_ice"]
    floe = next(((ix + a, iy + b) for a, b in FLOE_TRY if _free(g, _box(ix + a, iy + b, 2, 2), taken)), None)
    if floe:
        out.append(_deco("ice_floe", *floe, collide="alpha"))
        taken |= set(_box(floe[0] - 1, floe[1] - 1, 4, 4))
    vx, vy = e["fir_volcano"]
    rocks = 0
    for a, b in BOULDER_TRY:
        c = (vx + a, vy + b)
        if rocks < 4 and _free(g, [c], taken):
            out.append({"type": "deco", "parts": [["boulder"]], "x": c[0], "y": c[1], "collide": "alpha"})
            taken |= set(_box(c[0] - 1, c[1] - 1, 3, 3))
            rocks += 1
    smoke = {"kind": "smoke", "x": at["volcano"][0] + T.SMOKE_AT[0], "y": at["volcano"][1] + T.SMOKE_AT[1],
             "ox": T.SMOKE_AT[2], "oy": T.SMOKE_AT[3]}
    return out, {"smoke": smoke, "taken": taken}


def vents(g, meta, taken: set) -> list[dict]:
    """The ash vents (damage 1 a step): open sand by Gurgu, off the corridors, the icons and the river's sink."""
    vx, vy = meta["entrances"]["fir_volcano"]
    sink = meta["routes"]["R-volcano"][-1]
    near = {(sink[0] + a, sink[1] + b) for a in range(-2, 3) for b in range(-2, 3)}
    near |= {(vx + a, vy + b) for a in range(-2, 3) for b in range(-2, 3)}
    cells = {(vx + a, vy + b) for a0, b0, a1, b1 in VENT_BOXES for b in range(b0, b1 + 1) for a in range(a0, a1 + 1)}
    cells = {(x, y) for x, y in cells if g[y, x] == "s" and (x, y) not in taken | near}
    return [{"id": "fir_ash_vents", "damage": 1, "rects": row_rects(cells)}] if cells else []


def content(g, meta, b, trans) -> dict:
    """FIRE's objects, NPC, ambient, hazards, zones, backdrops and region checks; stamps its footprints in `g`."""
    neck(g, meta)
    objs, extra = objects(g, meta, trans)
    zs = T.zones(zone_cells(g, meta), row_rects)
    hx, hy = meta["entrances"]["fir_desert"]
    return {"objects": objs, "npcs": [T.hull_npc(hx, hy - 1)], "ambient": [extra["smoke"]],
            "hazards": vents(g, meta, extra["taken"]), "encounterZones": zs, "backdrops": T.backdrops(),
            "checks": {"warp_leaves": True}}

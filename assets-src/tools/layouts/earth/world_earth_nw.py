"""Region EARTH's content on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 7 NW-R; pass NW, NW-R EARTH): today's
EARTH content (`world_earth.py`, `earth/world_earth_sites.py`) ported onto the generated ground of
`world_specs/earth.py`.

- the five cave mouths (the dwarf hall, both giant's tunnel mouths, Sarda's cave, the Cavern of Earth): today's 2x2
  `cave_mouth` decos, each with its door as the walk cell (the same column of the mouth as today);
- Melmond: the approved 4x3 `town_melmond` icon (LM4-INT) over its box, the door its walk cell [3, 1] west of the
  gate, the copse in the art's empty top-right cell (OW-2), and the seeded copses, bushes and stones round it
  (`world_dress.scatter`, today's seed);
- the windmill on the rise north-west of Melmond, the rotted shrine in the badlands south-east of the Cavern (its
  south row inspected, today's text), the dwarves' mooring post by the landing; each placed at today's offset from
  its site on the nearest cells that fit;
- the canal patch dressing: the stone-banked water (`art_ground: "~"`) and a culvert arch over each mouth (FX-D, R);
- the zones, same ids and rosters as today (`world_earth_sites.TABLES`, `NAMES`): `ert_isthmus` (the dwarves'
  land, flooded from the hall, and since NW2-E the old south isthmus, flooded from the canal's south bank),
  `ert_sarda_coast` (west of the range, from Sarda's cave), `ert_badlands` (east of the range from BADLANDS_DY rows
  south of Melmond's gate) and `ert_plain`, on foot and by canoe; `ert_aldi` (EARTH's
  Aldi water and the canal cells) and `ert_sea`, by ship. Every walkable or canoe cell EARTH owns is in exactly one
  walking zone, every Water cell in one ship zone (3.3's coverage rule); a cell no flood reaches (an islet) takes
  the zone of the nearest cell that one reaches;
- the backdrop `ert_badlands: cracked_earth`. Today's region map checks (`min_blob`, `warp_leaves`) are
  met on EARTH's own cells by `world_earth_nw_ground.tidy` and the mouths' rock, but not written into
  `regions.earth.checks`: on the NW source they run on the region's raster chunks, which hold other
  regions' cells too (ELF's keep door, owner-line slivers), so they would fail on cells EARTH does not own.

Design note (NW-R EARTH; WORLD 4.0.4's concept kept). A dwarf-held hogback walls the Aldi on the west; its canal
saddle is a grass pass above the old south isthmus. NW2-E (docs/NW2_EDITS_PLAN.md 5): Mount Duergar stands north of
the canal, in the mainland's west lobe at the hogback's north peak; the Duergar range (`duergar_range`) walls the lobe
off from Matoya's mainland, so the hall is reached only by ship, at the landing in the Aldi's north-west corner.
Across a strait lies a broad farm continent whose single range runs from the north sea cliff to the south sea cliff
with no pass and no river across: at least 3 rock cells thick everywhere (the giant's mouths sit 9 cells apart, the
ridge between them 3-4 cells), so Sarda's wet pine coast is reached only through the tunnel map. Melmond sits on the
east shore in the range's rain shadow; south of it the plain dries into sand badlands round the
Cavern's mouth. Topology unchanged: overworld -> dwarf-hall; the east mouth -> giant-tunnel -> the west mouth ->
Sarda's coast -> sage-cave; Melmond and the Cavern's B1 by their doors.
"""
from __future__ import annotations

import numpy as np

import kit
import world_earth_nw_ground as GR
import world_earth_sites as T
from elf import world_nw_road as RD
from world_dress import door_sides, ring_of, scatter
from worldgen.gates import BLOCK
from worldgen.geom import flood

REGION = "earth"
BADLANDS_DY = 9                  # the badlands begin this many rows south of Melmond's gate (today 6 of 14)
# entrance -> the mouth's walk column (today's: the hall, the west mouth and Sarda's door in column 1, the rest 0)
MOUTHS = {"ert_dwarf": 1, "ert_giant": 0, "ert_giant_west": 1, "ert_sarda": 1, "ert_earth_cave": 0}
# QW: Melmond's tracks (points: entrances or offsets from its gate): south from the east gate to the bend below the
# art's south wall, then west under the wall to the giant's east mouth, and south-west to the Cavern's mouth
SIGN_OFF = (-1, 2)                               # QW: the signpost south-west of the gate, above the track
ROAD_CHAINS = (("ert_melmond", (0, 3)), ((0, 3), (-8, 3), "ert_giant"), ((0, 3), "ert_earth_cave"))
WINDMILL_OFF, SHRINE_OFF, POST_OFF = (-7, -9), (5, 5), (-1, 2)   # today's offsets from Melmond, the Cavern, the dock


def _door(ents: dict, doors: dict, e: str) -> tuple[int, int]:
    (x, y), (dx, dy) = ents[e], doors.get(e, (0, -1))
    return (x + dx, y + dy)


def _box(x: int, y: int, w: int, h: int) -> list[tuple[int, int]]:
    return [(x + i, y + j) for j in range(h) for i in range(w)]


def _fit(g: np.ndarray, want: tuple[int, int], w: int, h: int, taken: set, ok, reach: int = 8) -> tuple[int, int]:
    """The top-left cell nearest `want` (then by y, x) whose w x h box and one-cell ring hold no taken cell and whose
    box cells all pass `ok(x, y)`."""
    cands = sorted(((abs(dx) + abs(dy), want[1] + dy, want[0] + dx) for dy in range(-reach, reach + 1)
                    for dx in range(-reach, reach + 1)))
    for _d, y, x in cands:
        box = _box(x, y, w, h)
        if all(ok(cx, cy) for cx, cy in box) and not (set(_box(x - 1, y - 1, w + 2, h + 2)) & taken):
            return (x, y)
    raise ValueError(f"EARTH: no {w}x{h} place near {want}")


def _deco(name: str, x: int, y: int, **kw) -> dict:
    return {"type": "deco", "parts": kit.landmark_parts(name), "x": x, "y": y, **kw}


def objects(g: np.ndarray, ents: dict, doors: dict, docks: dict, taken: set) -> tuple[list[dict], list[dict]]:
    """(objects, inspect cells); the ground under Melmond's icon is set to grass where it is not land."""
    out = []
    for e, col in MOUTHS.items():
        dx, dy = _door(ents, doors, e)
        out.append(_deco("cave_mouth", dx - col, dy - 1, walk_cells=[[col, 1]]))
        # a hillside: rock under the mouth and on the door's outer side, so the door leaves only to its arrival
        out_x = dx + (1 if col else -1)                  # the door's outer side, and the cell above it (one blob)
        rock = _box(dx - col, dy - 1, 2, 1) + [(out_x, dy), (out_x, dy - 1), (dx + (-1 if col else 1), dy)]
        for x, y in rock:
            if (x, y) not in taken:
                g[y, x] = "m"
    out += melmond(g, ents, doors)
    gx, gy = ents["ert_melmond"]
    sx, sy = gx + SIGN_OFF[0], gy + SIGN_OFF[1]          # QW: the signpost by the track, its arrow east to the gate
    out.append({"type": "deco", "parts": [["signpost"]], "x": sx, "y": sy})
    insp = [{"x": sx, "y": sy, "text": list(T.SIGN_TEXT)}]
    taken = taken | {c for o in out for c in _box(o["x"], o["y"], len(o["parts"][0]), len(o["parts"]))}
    grass = lambda x, y: g[y, x] == "."  # noqa: E731
    mx, my = ents["ert_melmond"]
    wx, wy = _fit(g, (mx + WINDMILL_OFF[0], my + WINDMILL_OFF[1]), 2, 3, taken, grass)
    out.append(_deco("windmill", wx, wy, collide="alpha"))
    taken |= set(_box(wx, wy, 2, 3))
    cx, cy = ents["ert_earth_cave"]
    land = lambda x, y: g[y, x] in ".s"  # noqa: E731
    shrine_ok = lambda x, y: land(x, y) and land(x, y + 1)  # noqa: E731   (its south row inspected from below)
    sx, sy = _fit(g, (cx + SHRINE_OFF[0], cy + SHRINE_OFF[1]), 2, 2, taken, shrine_ok)
    out.append(_deco("shrine", sx, sy, collide="alpha"))
    insp += [{"x": sx + i, "y": sy + 1, "text": list(T.SHRINE_TEXT)} for i in (0, 1)]
    ddx, ddy = docks["ert_dwarf"]
    shore = lambda x, y: g[y, x] not in BLOCK and g[y, x] != "=" and any(  # noqa: E731
        g[y + b, x + a] == "o" for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    px, py = _fit(g, (ddx + POST_OFF[0], ddy + POST_OFF[1]), 1, 1, {(ddx, ddy)}, shore, reach=4)
    out.append(_deco("dock_post", px, py, collide="alpha"))
    return out, insp


def melmond(g: np.ndarray, ents: dict, doors: dict) -> list[dict]:
    """Melmond's icon (today's `world_earth_sites.melmond_icon` on the new cells) and its scattered dressing."""
    w, h = kit.LANDMARKS["town_melmond"][:2]
    gate, door = tuple(ents["ert_melmond"]), _door(ents, doors, "ert_melmond")
    col, row = w - 1, 1                                  # the door is the icon's cell [3, 1]
    tx, ty = door[0] - col, door[1] - row
    icon = _box(tx, ty, w, h)
    for x, y in icon:
        if g[y, x] in BLOCK:
            g[y, x] = "."
    parts = [list(r) for r in kit.landmark_parts("town_melmond")]
    parts[row - 1][col] = "tree_clump"
    gx, gy = gate
    taken = set(icon) | {gate, (gx, gy - 1), (gx, gy + 1), (gx + 1, gy), (gx - 1, gy)}
    walk = lambda c: g[c[1], c[0]] == "."  # noqa: E731
    return [{"type": "deco", "name": "melmond", "x": tx, "y": ty, "parts": parts, "walk_cells": [[col, row]],
             "collide": "alpha"},
            *scatter(icon, taken, T.DRESS_SEED, ring_of(icon), walk, door_sides(door, icon, taken), gate)]


def canal(cells: list) -> dict:
    """The canal patch's dressing: stone-banked water and a culvert arch over each mouth, spanning its rows."""
    ys = sorted({y for _x, y in cells})
    xs = sorted({x for x, _y in cells})
    arch = [{"type": "deco", "parts": [["culvert"]] * len(ys), "x": x, "y": ys[0], "collide": "alpha",
             "on_water": True} for x in (xs[0], xs[-1])]
    return {"art_ground": "~", "objects": arch}


def _rects(mask: np.ndarray) -> list[list[int]]:
    """Row runs of a mask, as [x0, y, x1, y] rects (row-major)."""
    out = []
    for y in range(mask.shape[0]):
        xs = np.flatnonzero(mask[y])
        if not len(xs):
            continue
        breaks = np.flatnonzero(np.diff(xs) > 1)
        starts = np.r_[xs[0], xs[breaks + 1]]
        ends = np.r_[xs[breaks], xs[-1]]
        out += [[int(a), y, int(b), y] for a, b in zip(starts, ends)]
    return out


def _nearest(label: np.ndarray, todo: np.ndarray) -> np.ndarray:
    """Each todo cell takes the label of the nearest labelled cell (Manhattan, ties by label order)."""
    pts = np.argwhere(label > 0)
    for y, x in np.argwhere(todo):
        d = np.abs(pts[:, 0] - y) + np.abs(pts[:, 1] - x)
        best = pts[d == d.min()]
        label[y, x] = int(label[best[:, 0], best[:, 1]].min())
    return label


def canal_bank(g: np.ndarray, meta: dict, ok: np.ndarray) -> tuple[int, int]:
    """NW2-E: the canal's south bank, the first `ok` cell below the patch's middle column (the second `ert_isthmus`
    seed: the old south isthmus, walkable from Elfland, keeps the dwarves' roster with the hall north of the canal)."""
    xs = sorted({x for x, _y in meta["canal"]})
    x, y = xs[len(xs) // 2], max(y for _x, y in meta["canal"]) + 1
    while not ok[y, x]:
        y += 1
    return (x, y)


def zones(g: np.ndarray, meta: dict, ents: dict) -> list[dict]:
    mine = meta["region"] == meta["regions"].index(REGION)
    canoe = (~np.isin(g, BLOCK) | np.isin(g, ["r", "≈"])) & mine
    names = ["ert_isthmus", "ert_plain", "ert_badlands", "ert_sarda_coast"]
    lab = np.zeros(g.shape, int)
    lab[flood(canoe, [tuple(ents["ert_dwarf"]), canal_bank(g, meta, canoe)])] = 1
    lab[flood(canoe & (lab == 0), [tuple(ents["ert_sarda"])])] = 4
    plain = flood(canoe & (lab == 0), [tuple(ents["ert_melmond"])])
    south = np.arange(g.shape[0])[:, None] >= ents["ert_melmond"][1] + BADLANDS_DY
    lab[plain & ~south] = 2
    lab[plain & south] = 3
    lab = _nearest(lab, canoe & (lab == 0))
    sea = (g == "o") & mine
    canal = np.zeros(g.shape, bool)
    for x, y in meta["canal"]:
        canal[y, x] = True
    aldi = (flood(g == "o", [tuple(meta["seeds"]["aldi"])]) & sea) | canal
    out = [{"id": z, "name": T.NAMES[z], "rects": _rects(lab == i + 1), "encounters": T.TABLES[z]}
           for i, z in enumerate(names)]
    for z, m in (("ert_aldi", aldi), ("ert_sea", sea & ~aldi)):
        out.append({"id": z, "name": T.NAMES[z], "rects": _rects(m), "encounters": T.TABLES[z], "modes": ["ship"]})
    return out


def content(g: np.ndarray, meta: dict, doors: dict, taken: set) -> dict:
    ents = {e: tuple(c) for e, c in meta["entrances"].items()}
    GR.thicken(g, meta, ents, taken)
    mine = meta["region"] == meta["regions"].index(REGION)
    plain = flood((~np.isin(g, BLOCK) | np.isin(g, ["r", "≈"])) & mine, [ents["ert_melmond"]])
    GR.badlands(g, meta, ents, plain, ents["ert_melmond"][1] + BADLANDS_DY)
    docks = {d["id"]: (d["x"], d["y"]) for d in meta["docks"]}
    objs, insp = objects(g, ents, doors, docks, taken)
    covered = {c for o in objs for c in _box(o["x"], o["y"], len(o["parts"][0]), len(o["parts"]))}
    errors = roads(g, ents, covered)
    GR.tidy(g, meta, taken | covered, docks)
    return {"objects": objs, "inspect": insp, "encounterZones": zones(g, meta, ents), "errors": errors,
            "backdrops": dict(T.BACKDROPS), "patches": {"canal": canal(meta["canal"])},
            "road_islands": [ents["ert_melmond"]]}       # Melmond's tracks are EARTH's own network (its gate cell)


def roads(g: np.ndarray, ents: dict, covered: set) -> list[str]:
    """QW (playtest 2026-11-22): Melmond's door is on its icon's east side while the art's wall gate faces south, so
    a worn dirt track (ELF's wobbling router, round the icon and its dressing) leaves the east gate south past the
    town's south wall to the bend, then forks to the giant's east mouth and to the Cavern's mouth: whoever comes from the tunnel,
    the Cavern or the harbour sees the way in. Returns the routing errors."""
    (gx, gy), out, used = ents["ert_melmond"], [], set()
    for chain in ROAD_CHAINS:
        pts = [ents[p] if isinstance(p, str) else (gx + p[0], gy + p[1]) for p in chain]
        for a, b in zip(pts, pts[1:]):
            path = RD.route(g, covered | (used - {a}), a, b)   # a fork never re-climbs the stem
            if not path:
                out.append(f"earth: Melmond's track {a} -> {b} cannot be routed")
            used |= set(path or [])
    return out

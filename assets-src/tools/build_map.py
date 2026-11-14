"""Map compiler: assets-src/maps/<id>.yaml (ASCII ground + placed objects) -> baked 2x map (docs/ART_TILES_PLAN.md).

  python3 -I assets-src/tools/build_map.py              # compile every source map
  python3 -I assets-src/tools/build_map.py cornelia     # one map
  python3 -I assets-src/tools/build_map.py --selftest   # offline checks
  python3 -I assets-src/tools/build_map.py --check-determinism [ids]       # compile under two hash seeds, compare
  python3 -I assets-src/tools/build_map.py --preview <id> x0 y0 x1 y1 out.png [--grid] [--collision] [--scale f]
  python3 -I assets-src/tools/build_map.py --metrics [ids]                 # terrain metrics (terrain/)
  python3 -I assets-src/tools/map_report.py <id>                           # reachability / chokepoint report

Writes assets/maps/ai/<id>.yaml (runtime MapData with `art` and `entrances`) and the baked chunks
assets/maps/ai/<id>/{below,above}_<row>_<col>.png (16x16 tiles of 48 native px each). The game draws `below` under
the characters and `above` (roof ridges, tree crowns) over them. The build fails on any validation error.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit as K  # noqa: E402
import map_checks as MC  # noqa: E402

T = K.T
CHUNK = 16
ROOT = K.ROOT
SRC = ROOT / "assets-src" / "maps"
OUT = ROOT / "assets" / "maps" / "ai"
LEGACY_MAPS = ROOT / "assets" / "maps"

LEGEND = {".": "grass", ":": "cobble", ",": "dirt", "~": "water", "#": "wall", "=": "bridge", "u": "culvert",
          # interiors (kit materials floor / floor_stone / carpet / in_wall_top / in_wall_face; counters are parts)
          "_": "floor", "-": "floor_stone", "+": "carpet", "W": "in_wall_top", "F": "in_wall_face", "c": "counter",
          # overworld (river: no stone rim; ocean: ragged coast with foam)
          "f": "forest", "m": "mountain", "s": "sand", "r": "river", "o": "ocean",
          # dungeons: outside the walls is void; rubble is a walkable broken floor
          "x": "void", "%": "rubble",
          # a natural lake or tarn (no stone rim, unlike the town canal `~`); a river source for river_check
          "≈": "lake"}
# painted full-cell from a seamless texture (no ragged edge); interior walls and carpets get a dark edge
FULL = ["floor", "floor_stone", "carpet", "rubble", "in_wall_top", "in_wall_face"]
COUNTER = 10                                       # collision value of counters (CollisionMap treats it as a wall)
# painted in this order; each erodes (ragged edge inside its own cells) against the ones before it
# (new materials go at the end: a layer's noise seed depends on its index). Ties between materials are broken by
# this order too (the earlier wins), so no pixel depends on set iteration order (PYTHONHASHSEED).
SOFT = ["grass", "sand", "dirt", "cobble", "forest", "mountain", "river", "ocean", "lake"]
SOFT_WATER = {"river", "ocean", "lake"}            # foam on their edge
ROUNDED = {"sand": 10, "forest": 12, "mountain": 12, "river": 8, "ocean": 16, "lake": 12}   # blur radius (px)
WATERISH = {"water", "bridge", "culvert"}
# TerrainType values (src/types/index.ts)
GRASS, WALL, WATER, ROAD, BRIDGE = 0, 1, 2, 8, 9
TERRAIN = {"grass": GRASS, "cobble": ROAD, "dirt": ROAD, "water": WATER, "wall": WALL, "bridge": BRIDGE, "culvert": WALL,
           "floor": ROAD, "floor_stone": ROAD, "carpet": ROAD, "in_wall_top": WALL, "in_wall_face": WALL,
           "counter": COUNTER, "void": WALL, "rubble": ROAD, "forest": 4, "mountain": 3, "sand": 5, "river": 7, "ocean": WATER,
           "lake": WATER}
BLOCKED = MC.BLOCKED                               # on foot: walls, water, counters, mountains (3), rivers (7)
MAX_INSET = 5            # ragged edge: up to this many px inside the overlay cell
RIM = 5                  # stone rim width inside water cells
# rows of the approved castle_face texture (castle/masonry): two courses of plain ashlar that repeat vertically, and
# the base course; facades lay plain courses up from the base so no carved band repeats
FACE_PLAIN, FACE_BASE = (56, 84), (84, 96)
BANK_R = 34              # px: blur radius that rounds the canal outline
SHADOW = 2               # px of shadow below an overlay edge (stays well under the 4 px budget)
PASSTHROUGH = ("name", "music", "encounterRate", "encounters", "battleBackgrounds", "canSave", "scriptedEncounters",
               "vehicles", "keyItemGates", "noWander", "inspect", "encounterZones", "camp")
ALPHA_MIN = 0.25         # collide: alpha: a footprint cell blocks when this share of its pixels is opaque art
SIDES = ("north", "south", "west", "east")


class MapError(ValueError):
    pass


@dataclass
class Compiled:
    id: str
    width: int
    height: int
    below: np.ndarray            # H x W x 3 uint8
    above: np.ndarray            # H x W x 4 uint8
    collision: np.ndarray        # height x width int
    entrances: dict[str, list[int]]
    transitions: list[dict]
    doc: dict = field(default_factory=dict)
    mat: np.ndarray | None = None                      # height x width ground material names
    owner: dict[tuple[int, int], int] = field(default_factory=dict)   # footprint cell -> object index
    art_share: np.ndarray | None = None                # height x width: share of each cell's pixels drawn by objects
    edge_cells: set[tuple[int, int]] = field(default_factory=set)     # transitions generated by edge_exits


# ───────────────────────────── helpers ─────────────────────────────

def _erode_depth(mask: np.ndarray, cap: int) -> np.ndarray:
    """Per pixel: how many 4-neighbour erosions it survives (0 = outside), capped. Off-map counts as inside."""
    depth = np.zeros(mask.shape, np.int16)
    cur = mask.copy()
    for i in range(1, cap + 1):
        p = np.pad(cur, 1, constant_values=True)
        cur = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        depth[cur] = i
        if not cur.any():
            break
    depth[mask & (depth == 0)] = 0
    return np.where(mask, depth + 1, 0)       # boundary pixels of the mask get 1


def _box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """Separable box blur of radius r (edges clamp)."""
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
        n = a.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(0, n), axis=axis)
        a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a


def _noise(h: int, w: int, seed: int, cell: int = 6, amp: int = MAX_INSET) -> np.ndarray:
    """Smooth value noise in 0..amp, integer, defined on global pixel coordinates (continuous everywhere)."""
    rng = np.random.default_rng(seed)
    gh, gw = h // cell + 2, w // cell + 2
    grid = rng.random((gh, gw))
    yy, xx = np.mgrid[0:h, 0:w]
    fy, fx = yy / cell, xx / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    a, b = grid[y0, x0], grid[y0, x0 + 1]
    c, d = grid[y0 + 1, x0], grid[y0 + 1, x0 + 1]
    v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    return np.rint(v * amp).astype(np.int16)


def _tile(tex: np.ndarray, h: int, w: int) -> np.ndarray:
    th, tw = tex.shape[:2]
    reps = (h // th + 1, w // tw + 1, 1)
    return np.tile(tex, reps)[:h, :w]


def _up(cells: np.ndarray) -> np.ndarray:
    return np.repeat(np.repeat(cells, T, axis=0), T, axis=1)


def _shade(img: np.ndarray, mask: np.ndarray, f: float) -> None:
    img[mask] = (img[mask].astype(np.float32) * f).astype(np.uint8)


def _edge_of(mask: np.ndarray) -> np.ndarray:
    """Pixels of mask with a 4-neighbour outside it (off-map counts as inside)."""
    p = np.pad(mask, 1, constant_values=True)
    return mask & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def _paste(canvas: Image.Image, part: Image.Image, cx: int, cy: int, dx: int = 0, dy: int = 0) -> None:
    px, py = cx * T + dx, cy * T + dy
    if px < 0 or py < 0:                                # off the top / left edge: paste the part's visible rest
        part = part.crop((max(0, -px), max(0, -py), part.width, part.height))
        px, py = max(0, px), max(0, py)
    canvas.alpha_composite(part, (px, py))


# ───────────────────────────── source ─────────────────────────────

def parse_ground(text: str) -> list[list[str]]:
    rows = [r for r in text.rstrip("\n").split("\n")]
    if not rows or any(len(r) != len(rows[0]) for r in rows):
        raise MapError("ground: every row must have the same length")
    grid = []
    for y, r in enumerate(rows):
        row = []
        for x, ch in enumerate(r):
            if ch not in LEGEND:
                raise MapError(f"ground: unknown legend character {ch!r} at ({x}, {y})")
            row.append(LEGEND[ch])
        grid.append(row)
    return grid


def footprint(o: dict) -> list[tuple[int, int]]:
    t, x, y = o["type"], o.get("x"), o.get("y")
    if t in ("house", "prefab"):
        return [(x + i, y + j) for j in range(o["h"]) for i in range(o["w"])]
    if t == "tree":
        return [(x, y - 1), (x, y)]
    if t == "fountain":
        return [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
    if t == "fence":
        (x0, y0), (x1, y1) = o["from"], o["to"]
        if x0 != x1 and y0 != y1:
            raise MapError(f"fence {o['from']}->{o['to']} must be straight")
        return [(xx, yy) for yy in range(min(y0, y1), max(y0, y1) + 1) for xx in range(min(x0, x1), max(x0, x1) + 1)]
    if t == "deco":
        return [(x + i, y + j) for j, row in enumerate(o["parts"]) for i, _ in enumerate(row)]
    if t == "facade":
        cells, yy = [], y
        for b in o["bands"]:
            bx, bw = x + b.get("x", 0), b.get("w", o["w"])
            cells += [(bx + i, yy + j) for j in range(b["rows"]) for i in range(bw)]
            yy += b["rows"]
        return cells
    if t in ("bush", "well", "barrel", "crate", "signpost", "flowers", "bench"):
        return [(x, y)]
    raise MapError(f"unknown object type {t!r}")


# style -> (hue shift in degrees, saturation factor, value factor): recoloured copies of the approved parts, so
# streets can mix roof and wall colours (roof: blue, wall: stone, ...)
RECOLOR = {"blue": (205, 0.75, 0.95), "green": (95, 0.7, 0.9), "teal": (160, 0.6, 0.9), "slate": (215, 0.3, 0.75),
           "brown": (15, 0.75, 0.75), "white": (0, 0.35, 1.08), "stone": (0, 0.15, 0.85), "ochre": (-12, 1.25, 0.97),
           "rose": (-25, 1.1, 1.0), "bright": (0, 1.0, 1.2), "pale_stone": (15, 0.4, 1.5)}   # pale_stone: W8


def _recolor(img: Image.Image, hue: float, sat: float, val: float) -> Image.Image:
    hsv = np.asarray(img.convert("RGB").convert("HSV")).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue * 255 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    rgb = Image.frombytes("HSV", img.size, hsv.astype(np.uint8).tobytes()).convert("RGB")
    out = rgb.convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def styled(kit: K.Kit, name: str, style: str | None) -> Image.Image:
    if name.startswith("wall_up2_") and name not in kit.approved and name.replace("wall_up2_", "wall_up_") in kit.approved:
        name = name.replace("wall_up2_", "wall_up_")          # upper storey: the approved ground-floor upper row
    if style and f"{name}@{style}" in kit.parts:
        return kit.parts[f"{name}@{style}"]
    if style in RECOLOR and name in kit.parts:
        kit.parts[f"{name}@{style}"] = _recolor(kit.part(name), *RECOLOR[style])
        return kit.parts[f"{name}@{style}"]
    return kit.part(name)


# ───────────────────────────── ground hooks ─────────────────────────────

def most_common_soft(near: Counter) -> str:
    """The most common soft material among the counted neighbours; ties go to the earlier material in SOFT."""
    if not near:
        return "grass"
    return min(near, key=lambda m: (-near[m], SOFT.index(m)))


def _terrain_module(src: dict):
    """`terrain: organic` maps paint soft ground and peaks with assets-src/tools/terrain/ (T3b) instead of
    paint_soft / place_peaks below. The module must provide paint_soft(below, mat, kit, seed) and
    place_peaks(canvas, mat, owner, kit, rng)."""
    mode = src.get("terrain")
    if mode in (None, "classic"):
        return None
    if mode != "organic":
        raise MapError(f"terrain: unknown mode {mode!r} (classic or organic)")
    if importlib.util.find_spec("terrain") is None:
        raise MapError("terrain: organic needs assets-src/tools/terrain/")
    import terrain  # noqa: PLC0415
    return terrain


def paint_soft(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Step 1 (classic): soft materials in SOFT order, each eroded (ragged) against the softer ones."""
    H, W = below.shape[:2]
    for i, name in enumerate(SOFT):
        if i > 0 and not np.isin(mat, SOFT[i:]).any():
            continue                                         # no cell of this or any later soft layer
        covered = ~np.isin(mat, SOFT[:i])                    # this layer and everything harder
        if i > 0 and not (mat == name).any():
            continue
        tex = _tile(kit.material("water" if name in ("river", "lake") else name), H, W)
        if i == 0:
            below[:] = tex
            continue
        pm = _up(covered)
        if name in ROUNDED:                                   # wild terrain: rounded, wavy edges (cell mask blurred)
            r = ROUNDED[name]
            soft_mask = _box_blur(_box_blur(pm.astype(np.float32), r), r)
            wave = (_noise(H, W, seed + 31 * i, cell=r, amp=100).astype(np.float32) / 100 - 0.5) * 0.5
            show = soft_mask + wave > 0.5
        else:
            show = pm & (_erode_depth(pm, MAX_INSET + 1) > _noise(H, W, seed + i))
        below[show] = tex[show]
        edge = _edge_of(show)
        shadow = np.zeros_like(show)
        for k in range(1, SHADOW + 1):
            shadow[k:] |= show[:-k]
        if name in SOFT_WATER:                               # light foam line instead of a dark edge
            below[edge] = np.minimum(below[edge].astype(np.int32) + 70, 255).astype(np.uint8)
        else:
            _shade(below, shadow & ~show, 0.8)
            _shade(below, edge, 0.6)


def place_peaks(canvas: Image.Image, mat: np.ndarray, owner: dict, kit: K.Kit, rng: np.random.Generator) -> None:
    """Classic mountains: a peak on every free mountain cell (jittered), so ranges read as ranges."""
    if "peak" not in kit.parts:
        return
    hgt, wid = mat.shape
    for y in range(hgt):
        for x in range(wid):
            if mat[y, x] == "mountain" and (x, y) not in owner:
                _paste(canvas, kit.part("peak"), x, y, int(rng.integers(-4, 5)), int(rng.integers(-6, 3)))


# ───────────────────────────── compile ─────────────────────────────

DOOR_KITS = ("town", "interior")


def door_effect(src: dict) -> dict:
    """CA-2: on a map whose own (first) kit is `town` or `interior`, house and prefab doors (shops, the inn, houses)
    get `effect: door`, the zoom into the door. Facades (the castle gate), stairs, edge exits and explicit transitions
    get none (the plain fade), and so do prefabs on other maps (the overworld's temple)."""
    kits = src.get("kits") or [src.get("kit", "town")]
    return {"effect": "door"} if kits[0] in DOOR_KITS else {}


def compile_map(src: dict, kit: K.Kit, check_interiors: bool = True) -> Compiled:
    mid = src["id"]
    if src.get("materials"):                               # per-map texture aliases, e.g. floor_stone: temple_floor
        import copy
        kit = copy.copy(kit)
        kit.materials = dict(kit.materials)
        for name, alias in src["materials"].items():
            if isinstance(alias, dict):                    # {from: castle_face, shade: 0.4}: a darkened copy
                kit.materials[name] = np.clip(kit.material(alias["from"]).astype(np.float32) * alias.get("shade", 1.0),
                                              0, 255).astype(np.uint8)
            else:
                kit.materials[name] = kit.material(alias)
    grid = parse_ground(src["ground"])
    hgt, wid = len(grid), len(grid[0])
    H, W = hgt * T, wid * T
    seed = sum(map(ord, mid))
    mat = np.array(grid)
    coll = np.vectorize(TERRAIN.get)(mat).astype(np.int16)

    # 1. ground: soft materials, each eroded (ragged) against the softer ones
    below = np.zeros((H, W, 3), np.uint8)
    terrain = _terrain_module(src)
    (terrain.paint_soft if terrain else paint_soft)(below, mat, kit, seed)

    # 2. hard ground: water with a stone rim, bridges, town walls, culverts
    waterish = np.isin(mat, list(WATERISH))
    # canal banks follow a smoothed outline (rounded bends instead of square steps); bridges and culverts stay square
    square = _up(np.isin(mat, ["bridge", "culvert"]))
    pw = (_box_blur(_box_blur(_up(waterish).astype(np.float32), BANK_R), BANK_R) > 0.5) | square
    water = pw
    # water cells left outside the rounded outline show the land beside them (the most common neighbouring material)
    for y in range(hgt):
        for x in range(wid):
            if grid[y][x] not in ("water",):
                continue
            sl = (slice(y * T, (y + 1) * T), slice(x * T, (x + 1) * T))
            out = ~pw[sl]
            if not out.any():
                continue
            near = Counter(grid[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                           if 0 <= y + dy < hgt and 0 <= x + dx < wid and grid[y + dy][x + dx] in SOFT)
            land = most_common_soft(near)
            tex = _tile(kit.material(land), H, W)[sl]
            below[sl][out] = tex[out]
    below[water] = _tile(kit.material("water"), H, W)[water]
    rim = pw & ~square & (_erode_depth(pw, RIM + 1) <= RIM)
    below[rim] = _tile(kit.material("rim"), H, W)[rim]
    _shade(below, _edge_of(rim) & ~_edge_of(pw), 0.55)     # inner line of the rim
    _shade(below, rim & _edge_of(pw), 0.75)
    slits: list[tuple[int, int]] = []
    for y in range(hgt):
        for x in range(wid):
            m = grid[y][x]
            sl = (slice(y * T, (y + 1) * T), slice(x * T, (x + 1) * T))
            if m == "bridge":
                _bridge_cell(below, grid, x, y, kit, H, W)
            elif m == "wall":
                south_wall = y + 1 < hgt and grid[y + 1][x] in ("wall", "culvert")
                below[sl] = _tile(kit.material("wall_top" if south_wall else "wall_face"), H, W)[sl]
                if not south_wall and x % 4 == 2 and "wall_slit" in kit.approved:
                    slits.append((x, y))           # arrow slits every 4th face cell (pasted with the parts below)
    walls = _up(np.isin(mat, ["wall", "culvert"]))
    _shade(below, _edge_of(walls), 0.5)
    void = _up(mat == "void")
    below[void] = (8, 6, 12)
    for name in FULL + ["counter"]:
        cells = mat == name
        if not cells.any():
            continue
        px = _up(cells)
        tex = _tile(kit.material("floor" if name == "counter" else "floor_stone" if name == "rubble" and "rubble" not in kit.materials else name), H, W)
        if name == "in_wall_face":
            tex = _anchored_face(kit.material(name), cells, H, W)
        below[px] = tex[px]
        if name == "carpet" and src.get("carpet_trim"):      # a royal runner: dark edge, then a gold band
            depth = _erode_depth(px, 6)
            gold = np.array(src["carpet_trim"], np.float32)
            band = (depth >= 3) & (depth <= 5)
            below[band] = (below[band].astype(np.float32) * 0.3 + gold * 0.7).astype(np.uint8)
            _shade(below, (depth >= 1) & (depth <= 2), 0.45)
        elif name in ("carpet", "in_wall_top", "in_wall_face"):
            _shade(below, _edge_of(px), 0.55)

    canvas = Image.fromarray(below).convert("RGBA")
    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for (x, y) in slits:
        _paste(canvas, kit.part("wall_slit"), x, y)
    for y in range(hgt):
        for x in range(wid):
            if grid[y][x] == "culvert":
                below_wall = y + 1 < hgt and grid[y + 1][x] in ("wall", "culvert")
                if below_wall:      # the walkway over the arch: wall top across the water
                    canvas.paste(Image.fromarray(_tile(kit.material("wall_top"), H, W)[y * T:(y + 1) * T, x * T:(x + 1) * T]),
                                 (x * T, y * T))
                else:
                    _paste(canvas, kit.part("culvert"), x, y)

    # counters: each horizontal run of 'c' cells is left end, middles, right end (a single cell uses counter_m)
    for y in range(hgt):
        x = 0
        while x < wid:
            if grid[y][x] != "counter":
                x += 1
                continue
            x1 = x
            while x1 + 1 < wid and grid[y][x1 + 1] == "counter":
                x1 += 1
            for xx in range(x, x1 + 1):
                kind = "m" if x == x1 else "l" if xx == x else "r" if xx == x1 else "m"
                _paste(canvas, kit.part(f"counter_{kind}"), xx, y)
            x = x1 + 1

    # 3. objects
    pre_objects = np.asarray(canvas).copy()
    objects = src.get("objects") or []
    owner: dict[tuple[int, int], int] = {}
    problems: list[str] = []
    for n, o in enumerate(objects):
        where = f"object {n} ({o['type']}{' ' + o['name'] if o.get('name') else ''} at {o.get('x')}, {o.get('y')})"
        for (cx, cy) in footprint(o):
            if not (0 <= cx < wid and 0 <= cy < hgt):
                problems.append(f"{where} runs off the map at ({cx}, {cy})")
                break
            if (cx, cy) in owner:
                problems.append(f"{where} overlaps object {owner[(cx, cy)]} at ({cx}, {cy})")
                break
            on_wall = o.get("on_wall") and grid[cy][cx] in ("in_wall_face", "in_wall_top", "wall")
            on_water = o.get("on_water") and grid[cy][cx] in ("water", "river", "ocean")
            if grid[cy][cx] not in SOFT + ["floor", "floor_stone", "carpet", "rubble"] and not on_wall and not on_water:
                problems.append(f"{where} stands on {grid[cy][cx]} at ({cx}, {cy})")
                break
            owner[(cx, cy)] = n
    if problems:
        raise MapError("; ".join(problems))

    entrances = {k: list(v) for k, v in (src.get("entrances") or {}).items()}
    transitions = [dict(t) for t in (src.get("transitions") or [])]
    door_fx = door_effect(src)
    rng = np.random.default_rng(seed)
    for n, o in enumerate(objects):
        t = o["type"]
        x, y = o.get("x"), o.get("y")
        if t == "house":
            w, h = o["w"], o["h"]
            if w < 3 or h < 4:
                raise MapError(f"house {n}: needs w >= 3 and h >= 4")
            door = o.get("door")
            windows = set(o.get("windows") or [])
            if door is not None and not 1 <= door <= w - 2:
                raise MapError(f"house {n}: door column {door} must be a middle column (1..{w - 2})")
            storeys = o.get("storeys", 1)
            wall_rows = 2 + (storeys - 1)                # an upper storey adds one wall row above the ground floor
            if h < wall_rows + 2:
                raise MapError(f"house {n}: {storeys} storeys need h >= {wall_rows + 2}")
            roof_rows = ["ridge"] + ["mid"] * (h - wall_rows - 2) + ["eave"]
            for j, row in enumerate(roof_rows):
                for i in range(w):
                    col = "l" if i == 0 else "r" if i == w - 1 else "m"
                    target = top if row == "ridge" else canvas
                    _paste(target, styled(kit, f"roof_{row}_{col}", o.get("roof")), x + i, y + j)
            for i in range(w):
                if i == 0 or i == w - 1:
                    side = "l" if i == 0 else "r"
                    up, lo = f"wall_up_{side}", f"wall_lo_{side}"
                elif i == door:
                    up, lo = "wall_door_top", "wall_door_bottom"
                elif i in windows:
                    up, lo = "wall_up_window", "wall_lo_plain"
                else:
                    up, lo = "wall_up_plain", "wall_lo_plain"
                _paste(canvas, styled(kit, up, o.get("wall")), x + i, y + h - 2)
                _paste(canvas, styled(kit, lo, o.get("wall")), x + i, y + h - 1)
                if storeys == 2:                         # upstairs: windows over the listed columns and the door
                    side = "l" if i == 0 else "r" if i == w - 1 else None
                    up2 = (f"wall_up2_{side}" if side else
                           "wall_up2_window" if (i in windows or i == door) else "wall_up2_plain")
                    _paste(canvas, styled(kit, up2, o.get("wall")), x + i, y + h - 3)
            if o.get("sign"):
                if door is None:
                    raise MapError(f"house {n}: a sign needs a door column")
                _paste(canvas, kit.part(f"sign_{o['sign']}"), x + door, y + h - 1 - wall_rows)   # on the eave
            if o.get("chimney") is not None:
                _paste(top, kit.part("chimney"), x + o["chimney"], y)
            for j in range(h):
                for i in range(w):
                    coll[y + j, x + i] = WALL
            coll[y, x:x + w] = grid_terrain_row(grid, y, x, w)       # ridge row: walk behind the house
            if door is not None:
                coll[y + h - 1, x + door] = ROAD
                if o.get("name"):
                    entrances[o["name"]] = [x + door, y + h]
                if o.get("enter"):
                    e = o["enter"]
                    transitions.append({"x": x + door, "y": y + h - 1, "targetMap": e["map"],
                                        "targetEntrance": e["entrance"], **door_fx})
                    if check_interiors:
                        _check_interior_entrance(e["map"], e["entrance"])
        elif t == "prefab":
            # a unique building drawn whole (kit cells <prefab>_<row>_<col>): stamped as drawn; the top `ridge_rows`
            # rows are walkable and drawn over characters, the door cell on the bottom row is walkable
            w, h, door, pf = o["w"], o["h"], o.get("door"), o["prefab"]
            ridge = o.get("ridge_rows", 1)
            dx, dy = _offset(o, n)
            names = [[f"{pf}_{j}_{i}" for i in range(w)] for j in range(h)]
            parts = [[kit.parts.get(nm) or K.placeholder_tile(nm) for nm in row] for row in names]
            share = _alpha_share(parts, dx, dy) if _collide_alpha(o, n) else None
            for j in range(h):
                for i in range(w):
                    _paste(top if j < ridge else canvas, parts[j][i], x + i, y + j, dx, dy)
                    if share is None or share[j, i] >= o.get("alpha_min", ALPHA_MIN):
                        coll[y + j, x + i] = WALL
            if ridge:
                coll[y:y + ridge, x:x + w] = [grid_terrain_row(grid, y + j, x, w) for j in range(ridge)]
            if o.get("sign") and door is not None:
                _paste(canvas, kit.part(f"sign_{o['sign']}"), x + door, y + o.get("sign_row", ridge))
            if door is not None:
                coll[y + h - 1, x + door] = ROAD
                if o.get("name"):
                    entrances[o["name"]] = [x + door, y + h]
                if o.get("enter"):
                    e = o["enter"]
                    transitions.append({"x": x + door, "y": y + h - 1, "targetMap": e["map"],
                                        "targetEntrance": e["entrance"], **door_fx})
                    if check_interiors:
                        _check_interior_entrance(e["map"], e["entrance"])
        elif t == "facade":
            _facade(canvas, top, kit, o, coll, grid)
            if o.get("door"):
                dx, dy = o["door"]
                coll[y + dy, x + dx] = ROAD
                if o.get("name"):
                    entrances[o["name"]] = [x + dx, y + dy + 1]
                if o.get("enter"):
                    e = o["enter"]
                    transitions.append({"x": x + dx, "y": y + dy, "targetMap": e["map"], "targetEntrance": e["entrance"]})
                    if check_interiors:
                        _check_interior_entrance(e["map"], e["entrance"])
        elif t == "tree":
            _paste(top, kit.part("tree_crown"), x, y - 1)
            _paste(canvas, kit.part("tree_trunk"), x, y)
            coll[y, x] = WALL
        elif t == "fountain":
            for j in range(2):
                for i in range(2):
                    _paste(canvas, kit.part(f"fountain_{j}{i}"), x + i, y + j)
                    coll[y + j, x + i] = WALL
        elif t == "fence":
            cells = footprint(o)
            horiz = len({c[1] for c in cells}) == 1
            for k, (cx, cy) in enumerate(cells):
                end = k in (0, len(cells) - 1)
                _paste(canvas, kit.part("fence_post" if end and len(cells) > 1 else "fence_h" if horiz else "fence_v"),
                       cx, cy)
                coll[cy, cx] = WALL
        elif t == "deco":
            # any kit parts, e.g. {type: deco, parts: [[bed_top], [bed_bottom]], x, y, block: true, on_wall: false}
            # above_rows: the top rows are drawn over characters and stay walkable (a tall tree's crown, a lamp head);
            # walkable_rows: rows (from 0) that stay walkable but are drawn under characters (stairs)
            # offset: [dx, dy] native px moves every part (an icon centred on a half cell); style recolours the parts;
            # collide: alpha blocks only the footprint cells (null cells included) whose composited art covers at
            # least alpha_min of the cell, instead of every cell with a part
            above_rows = o.get("above_rows", len(o["parts"]) if o.get("above") else 0)
            walk_rows = set(o.get("walkable_rows") or [])
            dx, dy = _offset(o, n)
            style = o.get("style")
            get = (lambda nm: styled(kit, nm, style) if nm in kit.parts else K.placeholder_tile(nm))  # noqa: E731
            parts = (_fit_parts(kit, o["parts"], get) if o.get("fit") else
                     [[get(nm) if nm else None for nm in row] for row in o["parts"]])
            share = _alpha_share(parts, dx, dy) if _collide_alpha(o, n) else None
            for j, row in enumerate(o["parts"]):
                for i, name in enumerate(row):
                    if name:
                        _paste(top if j < above_rows else canvas, parts[j][i], x + i, y + j, dx, dy)
                    elif share is None:
                        continue
                    if j < above_rows and not o.get("above"):
                        continue                         # crown over open ground: walk behind it
                    if j in walk_rows or [i, j] in (o.get("walk_cells") or []):
                        coll[y + j, x + i] = ROAD            # e.g. the foot of a staircase set into a wall face
                        continue
                    if share is not None:
                        if share[j, i] >= o.get("alpha_min", ALPHA_MIN):
                            coll[y + j, x + i] = WALL
                    elif o.get("block", True):
                        coll[y + j, x + i] = WALL
        elif t == "flowers":
            _paste(canvas, kit.part("flowers"), x, y)
        else:
            _paste(canvas, kit.part(t), x, y)
            coll[y, x] = WALL

    drawn = np.any(np.asarray(canvas) != pre_objects, axis=2) | (np.asarray(top)[..., 3] > 0)
    art_share = drawn.reshape(hgt, T, wid, T).mean(axis=(1, 3))

    # grass detail: a tuft on some free grass cells, nudged within the cell (only while the grass is a
    # placeholder or a tuft part is approved: the approved grass texture has its own tufts)
    tufts = "tuft" in kit.approved or "grass" not in kit.approved
    for y in range(hgt if tufts else 0):
        for x in range(wid):
            if grid[y][x] == "grass" and (x, y) not in owner and rng.random() < 0.18:
                _paste(canvas, kit.part("tuft"), x, y, int(rng.integers(-8, 9)), int(rng.integers(-8, 9)))

    # mountains
    (terrain.place_peaks if terrain else place_peaks)(canvas, mat, owner, kit, rng)
    above = np.asarray(top).copy()
    edge_cells = _edge_exits(src, coll, transitions)
    out = Compiled(mid, wid, hgt, np.asarray(canvas.convert("RGB")).copy(), above, coll, entrances, transitions,
                   mat=mat, owner=owner, art_share=art_share, edge_cells=edge_cells)
    validate(src, out)
    return out


def _edge_exits(src: dict, coll: np.ndarray, transitions: list[dict]) -> set[tuple[int, int]]:
    """`edge_exits: {north|south|west|east: {targetMap, targetEntrance}, split: [{side, from, to, targetEntrance,
    targetMap?}]}`: every walkable cell on the map edge becomes a transition (corner cells belong to the north or
    south side; `from`/`to` are inclusive x for north/south, y for west/east). Explicit transitions win."""
    spec = src.get("edge_exits")
    if not spec:
        return set()
    for k in spec:
        if k not in SIDES + ("split",):
            raise MapError(f"edge_exits: unknown key {k!r}")
    hgt, wid = coll.shape
    taken = {(t["x"], t["y"]) for t in transitions}
    made: set[tuple[int, int]] = set()
    for y in range(hgt):
        for x in range(wid):
            if not (x in (0, wid - 1) or y in (0, hgt - 1)) or int(coll[y, x]) in BLOCKED or (x, y) in taken:
                continue
            side = "north" if y == 0 else "south" if y == hgt - 1 else "west" if x == 0 else "east"
            along = x if side in ("north", "south") else y
            target = spec.get(side)
            for s in spec.get("split") or []:
                if not {"side", "from", "to", "targetEntrance"} <= set(s):
                    raise MapError(f"edge_exits: split entry {s} needs side, from, to and targetEntrance")
                if s["side"] == side and s["from"] <= along <= s["to"]:
                    target = {"targetMap": s.get("targetMap", (spec.get(side) or {}).get("targetMap")),
                              "targetEntrance": s["targetEntrance"]}
            if not target:
                continue                                  # the validator reports the uncovered side
            if not target.get("targetMap"):
                raise MapError(f"edge_exits: {side} split at {along} has no targetMap")
            transitions.append({"x": x, "y": y, "targetMap": target["targetMap"],
                                "targetEntrance": target["targetEntrance"]})
            made.add((x, y))
    return made


def _offset(o: dict, n: int) -> tuple[int, int]:
    off = o.get("offset") or [0, 0]
    if len(off) != 2 or not all(isinstance(v, int) for v in off):
        raise MapError(f"object {n}: offset must be [dx, dy] in whole native px")
    return int(off[0]), int(off[1])


def _collide_alpha(o: dict, n: int) -> bool:
    mode = o.get("collide")
    if mode not in (None, "cells", "alpha"):
        raise MapError(f"object {n}: collide must be cells or alpha, not {mode!r}")
    return mode == "alpha"


def _alpha_share(parts: list[list[Image.Image | None]], dx: int, dy: int) -> np.ndarray:
    """Per footprint cell (rows x cols, null cells included): the share of its pixels covered by opaque art once
    every part is composited at its cell plus the offset."""
    h, w = len(parts), max(len(r) for r in parts)
    opaque = np.zeros((h * T, w * T), bool)
    for j, row in enumerate(parts):
        for i, part in enumerate(row):
            if part is None:
                continue
            a = np.asarray(part.getchannel("A")) >= 128
            x0, y0 = i * T + dx, j * T + dy
            sx0, sy0 = max(0, -x0), max(0, -y0)
            tx0, ty0 = max(0, x0), max(0, y0)
            tx1, ty1 = min(w * T, x0 + a.shape[1]), min(h * T, y0 + a.shape[0])
            if tx1 > tx0 and ty1 > ty0:
                opaque[ty0:ty1, tx0:tx1] |= a[sy0:sy0 + ty1 - ty0, sx0:sx0 + tx1 - tx0]
    return opaque.reshape(h, T, w, T).mean(axis=(1, 3))


def _fit_parts(kit: K.Kit, parts: list[list[str]], get=None) -> list[list[Image.Image]]:
    """A multi-cell prop drawn smaller than its cells, enlarged to fill them (bottom-centred, aspect kept)."""
    get = get or (lambda name: kit.parts.get(name) or K.placeholder_tile(name))
    h, w = len(parts), len(parts[0])
    whole = Image.new("RGBA", (w * T, h * T))
    for j, row in enumerate(parts):
        for i, name in enumerate(row):
            if name:
                whole.alpha_composite(get(name), (i * T, j * T))
    box = whole.getchannel("A").point(lambda a: 255 if a >= 128 else 0).getbbox()
    if box:
        obj = whole.crop(box)
        f = min(w * T / obj.width, h * T / obj.height) * 0.96
        big = obj.resize((max(1, round(obj.width * f)), max(1, round(obj.height * f))), Image.Resampling.LANCZOS)
        a = np.asarray(big).copy()
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
        whole = Image.new("RGBA", (w * T, h * T))
        whole.alpha_composite(Image.fromarray(a), ((w * T - big.width) // 2, h * T - big.height))
    return [[whole.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)) for i in range(w)] for j in range(h)]


def _anchored_face(tex: np.ndarray, cells: np.ndarray, H: int, W: int) -> np.ndarray:
    """A wall-face texture laid so that its bottom edge sits on the bottom of each vertical run of face cells (the
    wainscot or base course meets the floor whatever the wall height); it repeats left to right."""
    th = tex.shape[0]
    out = np.zeros((H, W, 3), np.uint8)
    hgt, wid = cells.shape
    cols = _tile(tex, th, W)
    for x in range(wid):
        y = 0
        while y < hgt:
            if not cells[y, x]:
                y += 1
                continue
            y1 = y
            while y1 + 1 < hgt and cells[y1 + 1, x]:
                y1 += 1
            bottom = (y1 + 1) * T
            for py in range(y * T, bottom):
                out[py, x * T:(x + 1) * T] = cols[(th - (bottom - py) % th) % th, x * T:(x + 1) * T]
            y = y1 + 1
    return out


def _facade(canvas: Image.Image, top: Image.Image, kit: K.Kit, o: dict, coll: np.ndarray, grid) -> None:
    """A castle-style building front from bands, top to bottom: roof (slate courses; the first band's `ridge` rows
    are walkable and drawn over characters), wall (a face material, bottom-anchored) and battlement (a parapet with
    merlons). A band may be narrower than the building (`x`, `w` relative), e.g. a central tower rising above the
    roof; cells outside a band stay open ground. Parts (windows, banners, the gate) are stamped at positions
    relative to the building."""
    x0, y0 = o["x"], o["y"]
    W, H = canvas.size
    y = y0
    ridge_rows = 0
    rects = []
    for n, band in enumerate(o["bands"]):
        rows, kind = band["rows"], band["kind"]
        bx, w = x0 + band.get("x", 0), band.get("w", o["w"])
        x_px, y_px, w_px, h_px = bx * T, y * T, w * T, rows * T
        if kind == "roof":
            tex = _tile(kit.material(band.get("material", "slate")), H, W)[y_px:y_px + h_px, x_px:x_px + w_px].copy()
            tex[:4] = (tex[:4].astype(np.float32) * 0.55).astype(np.uint8)          # ridge cap
            tex[4:6] = np.minimum(tex[4:6].astype(np.int32) + 40, 255).astype(np.uint8)
            tex[-8:-3] = (tex[-8:-3].astype(np.float32) * 0.7).astype(np.uint8)     # eave
            tex[-3:] = (tex[-3:].astype(np.float32) * 0.35).astype(np.uint8)
            img = Image.fromarray(tex).convert("RGBA")
            ridge = band.get("ridge", 1) if n == 0 else 0
            if ridge:
                top.alpha_composite(img.crop((0, 0, w_px, ridge * T)), (x_px, y_px))
                canvas.alpha_composite(img.crop((0, ridge * T, w_px, h_px)), (x_px, y_px + ridge * T))
                ridge_rows = ridge
            else:
                canvas.alpha_composite(img, (x_px, y_px))
        elif kind in ("wall", "battlement"):
            face = kit.material(band.get("material", "castle_face"))
            p0, p1 = o.get("plain_rows", FACE_PLAIN)
            b0, b1 = o.get("base_rows", FACE_BASE)
            plain = np.roll(_tile(face[p0:p1], h_px + (p1 - p0), W)[:, x_px:x_px + w_px], 0, axis=0)
            off = (p1 - p0) - h_px % (p1 - p0)                                     # courses end on the base line
            tex = plain[off:off + h_px].copy()
            if kind == "wall":
                base = _tile(face[b0:b1], b1 - b0, W)[:, x_px:x_px + w_px]
                tex[-(b1 - b0):] = base
                tex[-3:] = (tex[-3:].astype(np.float32) * 0.6).astype(np.uint8)    # shadow line at the foot
            else:
                # parapet: merlons of plain ashlar with lit tops; the gaps show the shadowed walkway behind
                walk = (tex.astype(np.float32) * 0.38).astype(np.uint8)
                m_h, m_w = 28, T // 3
                for mx in range(0, w_px, 2 * m_w):
                    g0, g1 = mx + m_w, min(w_px, mx + 2 * m_w)
                    tex[:m_h, g0:g1] = walk[:m_h, g0:g1]
                    tex[:2, mx:g0] = np.minimum(tex[:2, mx:g0].astype(np.int32) + 45, 255)
                    tex[2:m_h, max(mx, g0 - 2):g0] = (tex[2:m_h, max(mx, g0 - 2):g0] * 0.6).astype(np.uint8)
                tex[m_h:m_h + 2] = np.minimum(tex[m_h:m_h + 2].astype(np.int32) + 45, 255)  # coping
                tex[m_h + 2:m_h + 4] = (tex[m_h + 2:m_h + 4].astype(np.float32) * 0.6).astype(np.uint8)
                tex[-2:] = (tex[-2:].astype(np.float32) * 0.7).astype(np.uint8)
            canvas.alpha_composite(Image.fromarray(tex).convert("RGBA"), (x_px, y_px))
        else:
            raise MapError(f"facade: unknown band kind {kind!r}")
        rects.append((bx, y, w, rows, ridge if kind == "roof" and n == 0 else 0))
        y += rows
    for (bx, by, w, rows, ridge) in rects:              # dark side edges, and collision
        a = np.zeros((rows * T, w * T, 4), np.uint8)
        a[:, :2] = a[:, -2:] = (20, 18, 28, 200)
        edge = Image.fromarray(a)
        if ridge:
            top.alpha_composite(edge.crop((0, 0, w * T, ridge * T)), (bx * T, by * T))
        canvas.alpha_composite(edge.crop((0, ridge * T, w * T, rows * T)), (bx * T, (by + ridge) * T))
        coll[by + ridge:by + rows, bx:bx + w] = WALL
    for p in o.get("parts") or []:
        ratio = None
        if p.get("match"):                                  # recolour the part's stone to the wall's stone
            face = kit.material(p["match"]).reshape(-1, 3).astype(np.float32)
            imgs = [np.asarray(kit.parts.get(n) or K.placeholder_tile(n)) for row in p["parts"] for n in row if n]
            px = np.concatenate([a.reshape(-1, 4) for a in imgs])
            px = px[px[:, 3] > 0][:, :3].astype(np.float32)
            stone = px[px.mean(1) > 140]
            face = face[face.mean(1) > 140]
            if len(stone) and len(face):
                ratio = face.mean(0) / stone.mean(0)
        for j, row in enumerate(p["parts"]):
            for i, name in enumerate(row):
                if name:
                    part = kit.parts.get(name) or K.placeholder_tile(name)
                    if ratio is not None:
                        a = np.asarray(part).astype(np.float32)
                        a[..., :3] = np.clip(a[..., :3] * ratio, 0, 255)
                        part = Image.fromarray(a.astype(np.uint8))
                    _paste(canvas, part, x0 + p["x"] + i, y0 + p["y"] + j)


def _bridge_cell(below: np.ndarray, grid, x: int, y: int, kit: K.Kit, H: int, W: int) -> None:
    """One cell of a bridge. A bridge with land (anything but water) to its left or right carries east-west
    traffic and uses bridge_h, else bridge_v. The deck texture's middle band repeats across the whole bridge run, and
    its outer bands (the parapets, a quarter of the texture each) appear only on the run's two outer edges."""
    hgt, wid = len(grid), len(grid[0])
    land = lambda xx, yy: 0 <= xx < wid and 0 <= yy < hgt and grid[yy][xx] not in WATERISH | SOFT_WATER  # noqa: E731
    ew = land(x - 1, y) or land(x + 1, y) or any(
        grid[y][xx] == "bridge" and (land(xx - 1, y) or land(xx + 1, y)) for xx in range(wid))
    tex = kit.material("bridge_h" if ew else "bridge_v")
    if not ew:
        tex = np.transpose(tex, (1, 0, 2))           # work across the run in rows below, then transpose back
    th = tex.shape[0]
    q = th // 4
    deck, top, bot = tex[q:th - q], tex[:q], tex[th - q:]
    # where this cell sits in its run (perpendicular to travel)
    if ew:
        y0 = y
        while y0 - 1 >= 0 and grid[y0 - 1][x] == "bridge":
            y0 -= 1
        y1 = y
        while y1 + 1 < hgt and grid[y1 + 1][x] == "bridge":
            y1 += 1
        span, pos, along = (y1 - y0 + 1) * T, (y - y0) * T, x * T
    else:
        x0 = x
        while x0 - 1 >= 0 and grid[y][x0 - 1] == "bridge":
            x0 -= 1
        x1 = x
        while x1 + 1 < wid and grid[y][x1 + 1] == "bridge":
            x1 += 1
        span, pos, along = (x1 - x0 + 1) * T, (x - x0) * T, y * T
    rows = np.empty((span, T, 3), np.uint8)
    reps = span // deck.shape[0] + 2
    full = np.tile(deck, (reps, 1, 1))
    cols = (np.arange(along, along + T)) % tex.shape[1]
    rows[:] = full[:span][:, cols]
    rows[:q] = top[:, cols]
    rows[span - q:] = bot[:, cols]
    cell = rows[pos:pos + T]
    if not ew:
        cell = np.transpose(cell, (1, 0, 2))
    below[y * T:(y + 1) * T, x * T:(x + 1) * T] = cell


def grid_terrain_row(grid, y, x, w) -> list[int]:
    return [TERRAIN[grid[y][x + i]] for i in range(w)]


def _check_interior_entrance(map_id: str, entrance: str) -> None:
    """The target map (a source map or a legacy map) must define the entrance; every variant that exists must."""
    paths = [q for q in (SRC / f"{map_id}.yaml", LEGACY_MAPS / f"{map_id}.yaml") if q.exists()]
    if not paths:
        raise MapError(f"door leads to unknown map {map_id}")
    for path in paths:
        ents = (yaml.safe_load(path.read_text()) or {}).get("entrances") or {}
        if entrance not in ents:
            raise MapError(f"door leads to {map_id} ({path.name}), which has no entrance {entrance!r}")


# ───────────────────────────── validation ─────────────────────────────

def _walkable(c: Compiled, x: int, y: int) -> bool:
    return 0 <= x < c.width and 0 <= y < c.height and int(c.collision[y, x]) not in BLOCKED


def validate(src: dict, c: Compiled) -> None:
    errors = []
    for npc in src.get("npcs") or []:
        on_counter = 0 <= npc["y"] < c.height and 0 <= npc["x"] < c.width and int(c.collision[npc["y"], npc["x"]]) == COUNTER
        if not _walkable(c, npc["x"], npc["y"]) and not on_counter:
            errors.append(f"NPC {npc['id']} at ({npc['x']}, {npc['y']}) is on a blocked cell")
    for name, (x, y) in c.entrances.items():
        if not _walkable(c, x, y):
            errors.append(f"entrance {name} at ({x}, {y}) is on a blocked cell")
    for t in c.transitions:
        if not _walkable(c, t["x"], t["y"]):
            errors.append(f"transition to {t['targetMap']} at ({t['x']}, {t['y']}) is on a blocked cell")
    if not c.entrances:
        errors.append("map has no entrances")
    else:
        seen = MC.reach(c.collision, [next(iter(c.entrances.values()))])
        for name, pos in c.entrances.items():
            if tuple(pos) not in seen and name not in (src.get("unreachable_ok") or []):
                errors.append(f"entrance {name} at {tuple(pos)} is not reachable from the first entrance")
        on_edge = src.get("edge_exits") and (lambda x, y: x in (0, c.width - 1) or y in (0, c.height - 1))
        for t in c.transitions:
            if (t["x"], t["y"]) not in seen and not (on_edge and on_edge(t["x"], t["y"])):
                errors.append(f"transition at ({t['x']}, {t['y']}) is not reachable on foot")
        errors += MC.run(src, c, seen)       # talkable NPCs, inspect cells, edge exits and the opt-in map checks
    # covering rules: above art only over walkable cells, and the cell south of it must be blocked
    a = c.above[..., 3] > 0
    for y in range(c.height):
        for x in range(c.width):
            if not a[y * T:(y + 1) * T, x * T:(x + 1) * T].any():
                continue
            if not _walkable(c, x, y):
                errors.append(f"above-layer art over blocked cell ({x}, {y})")
            if y + 1 < c.height and _walkable(c, x, y + 1):
                errors.append(f"cell ({x}, {y + 1}) below above-layer art must be blocked")
    if errors:
        raise MapError(f"{c.id}: " + "; ".join(errors))


# ───────────────────────────── output ─────────────────────────────

def chunks(img: np.ndarray, hgt: int, wid: int):
    for r in range(0, hgt, CHUNK):
        for cc in range(0, wid, CHUNK):
            yield r // CHUNK, cc // CHUNK, img[r * T:min(hgt, r + CHUNK) * T, cc * T:min(wid, cc + CHUNK) * T]


def write(src: dict, c: Compiled, out_dir: Path = OUT) -> Path:
    d = out_dir / c.id
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("*.png"):
        old.unlink()
    rel = d.relative_to(ROOT).as_posix() if d.resolve().is_relative_to(ROOT) else d.resolve().as_posix()   # tests
    below, above = [], []
    for r, cc, part in chunks(c.below, c.height, c.width):
        name = f"below_{r}_{cc}.png"
        Image.fromarray(part).save(d / name, optimize=True)
        below.append(f"{rel}/{name}")
    for r, cc, part in chunks(c.above, c.height, c.width):
        if part[..., 3].any():
            name = f"above_{r}_{cc}.png"
            Image.fromarray(part).save(d / name, optimize=True)
            above.append(f"{rel}/{name}")
        else:
            above.append(None)
    doc = {"id": c.id, "width": c.width, "height": c.height, "layers": [], "tilesets": [],
           "art": {"tile": T, "chunk": CHUNK, "below": below, "above": above},
           "entrances": c.entrances,
           "collision": [int(v) for v in c.collision.flatten()],
           "npcs": src.get("npcs") or [], "transitions": c.transitions}
    for k in PASSTHROUGH:
        if k in src:
            doc[k] = src[k]
    path = out_dir / f"{c.id}.yaml"
    header = f"# GENERATED by assets-src/tools/build_map.py from assets-src/maps/{c.id}.yaml - do not edit\n"
    path.write_text(header + yaml.safe_dump(doc, sort_keys=False, default_flow_style=None, width=200))
    return path


def source_ids() -> list[str]:
    return sorted(q.stem for q in SRC.glob("*.yaml"))


def compile_source(src: dict, placeholders: bool = False) -> tuple[Compiled, K.Kit]:
    kit_ids = src.get("kits") or [src.get("kit", "town")]
    kit = K.load_kit(kit_ids[0], placeholders_only=True) if placeholders else K.load_kits(kit_ids)
    return compile_map(src, kit, check_interiors=not placeholders), kit


def hashes(c: Compiled) -> dict[str, str]:
    """SHA-256 of the pixel and collision output (what the determinism check compares)."""
    return {"below": hashlib.sha256(np.ascontiguousarray(c.below).tobytes()).hexdigest(),
            "above": hashlib.sha256(np.ascontiguousarray(c.above).tobytes()).hexdigest(),
            "collision": hashlib.sha256(np.ascontiguousarray(c.collision, dtype=np.int16).tobytes()).hexdigest()}


def hash_run(ids: list[str], src_file: str | None, placeholders: bool, seed: str) -> dict[str, dict[str, str]]:
    """Compile in a subprocess under PYTHONHASHSEED=seed and return {id: hashes}. Runs without -I (which would
    ignore the variable) but with -s, and with an environment holding nothing but the seed."""
    cmd = [sys.executable, "-s", str(Path(__file__).resolve()), "--hash", *ids]
    if src_file:
        cmd += ["--src", src_file]
    if placeholders:
        cmd.append("--placeholders")
    out = subprocess.run(cmd, env={"PYTHONHASHSEED": seed}, cwd=ROOT, capture_output=True, text=True)
    if out.returncode:
        raise MapError(f"--hash under PYTHONHASHSEED={seed} failed: {out.stderr.strip() or out.stdout.strip()}")
    return json.loads(out.stdout)


def check_determinism(ids: list[str] | None = None, seeds: tuple[str, ...] = ("1", "3")) -> bool:
    """Every map compiles to the same below / above / collision under two string-hash seeds."""
    ids = ids or source_ids()
    runs = {s: hash_run(ids, None, False, s) for s in seeds}
    ok = True
    for mid in ids:
        diff = [k for k in ("below", "above", "collision") if len({runs[s][mid][k] for s in seeds}) > 1]
        print(f"{mid}: {'differs in ' + ', '.join(diff) if diff else 'deterministic'}")
        ok &= not diff
    return ok


def stitch(map_id: str, out_dir: Path = OUT) -> tuple[Image.Image, dict]:
    """The compiled map's chunks stitched into one RGBA image (below with above composited over it)."""
    doc = yaml.safe_load((out_dir / f"{map_id}.yaml").read_text())
    art, wid, hgt = doc["art"], doc["width"], doc["height"]
    img = Image.new("RGBA", (wid * T, hgt * T))
    cols = (wid + art["chunk"] - 1) // art["chunk"]
    for layer in ("below", "above"):
        for k, rel in enumerate(art[layer]):
            if rel:
                part = Image.open(ROOT / rel).convert("RGBA")
                img.alpha_composite(part, ((k % cols) * art["chunk"] * T, (k // cols) * art["chunk"] * T))
    return img, doc


def preview(map_id: str, x0: int, y0: int, x1: int, y1: int, out: Path, grid: bool = False,
            collision: bool = False, scale: float = 1.0, out_dir: Path = OUT) -> Path:
    """Crop cells x0..x1, y0..y1 (inclusive) of a compiled map to a PNG; --collision tints blocked cells red and
    transitions cyan, --grid draws cell lines (labelled every 5 cells), --scale resizes (nearest)."""
    from PIL import ImageDraw
    img, doc = stitch(map_id, out_dir)
    wid, hgt = doc["width"], doc["height"]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(wid - 1, x1), min(hgt - 1, y1)
    if x1 < x0 or y1 < y0:
        raise MapError(f"preview: empty crop for a {wid}x{hgt} map")
    if collision:
        over = Image.new("RGBA", img.size)
        d = ImageDraw.Draw(over)
        coll = doc["collision"]
        for y in range(hgt):
            for x in range(wid):
                if coll[y * wid + x] in BLOCKED:
                    d.rectangle([x * T, y * T, (x + 1) * T - 1, (y + 1) * T - 1], fill=(255, 0, 0, 90))
        for t in doc.get("transitions") or []:
            d.rectangle([t["x"] * T, t["y"] * T, (t["x"] + 1) * T - 1, (t["y"] + 1) * T - 1], fill=(0, 255, 255, 110))
        img.alpha_composite(over)
    img = img.crop((x0 * T, y0 * T, (x1 + 1) * T, (y1 + 1) * T))
    if scale != 1.0:
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.NEAREST)
    if grid:
        d = ImageDraw.Draw(img)
        step = T * scale
        for i in range(x1 - x0 + 2):
            d.line([(round(i * step), 0), (round(i * step), img.height)], fill=(255, 255, 255, 140))
        for j in range(y1 - y0 + 2):
            d.line([(0, round(j * step)), (img.width, round(j * step))], fill=(255, 255, 255, 140))
        for i in range(x1 - x0 + 1):
            for j in range(y1 - y0 + 1):
                if (x0 + i) % 5 == 0 and (y0 + j) % 5 == 0:
                    d.text((round(i * step) + 2, round(j * step) + 1), f"{x0 + i},{y0 + j}", fill=(255, 255, 0, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out


def metrics(ids: list[str] | None = None) -> None:
    """Terrain metrics of compiled maps; provided by terrain.metrics(src, compiled) (assets-src/tools/terrain/)."""
    if importlib.util.find_spec("terrain") is None:
        raise MapError("--metrics needs assets-src/tools/terrain/ (terrain blending)")
    import terrain  # noqa: PLC0415
    for mid in ids or source_ids():
        src = yaml.safe_load((SRC / f"{mid}.yaml").read_text())
        c, _ = compile_source(src)
        print(f"{mid}: {terrain.metrics(src, c)}")


def build(ids: list[str] | None = None) -> list[Path]:
    srcs = sorted(SRC.glob("*.yaml")) if not ids else [SRC / f"{i}.yaml" for i in ids]
    written = []
    for p in srcs:
        src = yaml.safe_load(p.read_text())
        c, kit = compile_source(src)
        path = write(src, c)
        placeholder = sorted(set(K.PART_NAMES) - kit.approved)
        print(f"{c.id}: {c.width}x{c.height} -> {path.relative_to(ROOT)} "
              f"({len(kit.approved)} approved parts, {len(placeholder)} placeholders)")
        written.append(path)
    ids_all = source_ids()
    (OUT / "index.yaml").write_text("# GENERATED by assets-src/tools/build_map.py: compiled maps the game prefers under ?art=ai\n"
                                    + yaml.safe_dump(ids_all))
    return written


# ───────────────────────────── self-test ─────────────────────────────

SELFTEST_MAP = {
    "id": "selftest",
    "ground": "\n".join([
        "..........",
        "..:.....~.",
        "..:.,,..~.",
        "..::::==~.",
        "..:.,,..~.",
        "..:.....~.",
        "##########",
    ]),
    "entrances": {"west": [0, 0]},
    "objects": [{"type": "tree", "x": 5, "y": 1}, {"type": "house", "x": 0, "y": 1, "w": 2, "h": 4}],
}


def selftest() -> None:
    kit = K.load_kit("town", placeholders_only=True)
    ok = 0

    def expect_error(src, needle):
        nonlocal ok
        try:
            compile_map(src, kit, check_interiors=False)
        except MapError as e:
            assert needle in str(e), f"expected {needle!r} in: {e}"
            ok += 1
            return
        raise AssertionError(f"expected MapError containing {needle!r}")

    base = {**SELFTEST_MAP, "objects": [{"type": "tree", "x": 5, "y": 1}]}
    c = compile_map(base, kit, check_interiors=False)
    assert c.below.shape == (7 * T, 10 * T, 3) and c.collision.shape == (7, 10)
    # 1-wide path (column 2) and the three-material corner (cobble / dirt / grass at 4..5, 2..4) stay inside their cells
    grass = kit.material("grass")
    g = _tile(grass, *c.below.shape[:2])
    cobble_cells = np.isin(np.array(parse_ground(base["ground"])), ["cobble", "dirt", "water", "bridge", "wall", "culvert"])
    grass_px = ~_up(cobble_cells)
    # grass cells may only differ from the grass texture by the shadow (<= SHADOW px under an edge), tufts and the tree
    diff = np.any(c.below != g, axis=2) & grass_px
    tree = np.zeros_like(diff)
    tree[0:2 * T, 5 * T:6 * T] = True
    stray = diff & ~tree
    # allow tufts (alpha marks) and shadows: everything that differs must be darker or a tuft colour, never cobble
    cob = _tile(kit.material("cobble"), *c.below.shape[:2])
    assert not np.any(np.all(c.below == cob, axis=2) & grass_px & ~tree & (np.abs(c.below.astype(int) - g).sum(2) > 60)), \
        "cobble leaked into a grass cell"
    ok += 1
    # chunk stitching is byte-identical
    parts = {(r, cc): p for r, cc, p in chunks(c.below, c.height, c.width)}
    rows = [np.concatenate([parts[(r, cc)] for cc in range((c.width + CHUNK - 1) // CHUNK)], axis=1)
            for r in range((c.height + CHUNK - 1) // CHUNK)]
    assert np.array_equal(np.concatenate(rows, axis=0), c.below)
    ok += 1
    # collision: wall row, water, bridge walkable, tree trunk blocked, crown walkable
    assert c.collision[6, 0] == WALL and c.collision[1, 8] == WATER and c.collision[3, 6] == BRIDGE
    assert c.collision[1, 5] == WALL and c.collision[0, 5] == GRASS
    ok += 1
    # covering rule holds for the tree; above art exists only on the crown cell
    a = c.above[..., 3] > 0
    assert a[0:T, 5 * T:6 * T].any() and not a[T:, :].any()
    ok += 1
    # failures
    expect_error({**base, "objects": [{"type": "tree", "x": 5, "y": 1}, {"type": "bush", "x": 5, "y": 0}]}, "overlaps")
    expect_error({**base, "ground": base["ground"].replace("..:.....~.", "..:..?..~.", 1)}, "unknown legend")
    expect_error({**base, "npcs": [{"id": "n", "x": 8, "y": 2, "sprite": "villager", "dialog": []}]}, "blocked cell")
    expect_error({**base, "entrances": {"west": [0, 0], "island": [9, 9]}}, "blocked cell")
    pocket = {"id": "pocket", "ground": "..#..\n..#..\n..#..", "entrances": {"west": [0, 0], "east": [4, 0]}}
    expect_error(pocket, "not reachable")
    expect_error({**base, "objects": [{"type": "house", "x": 0, "y": 1, "w": 2, "h": 4}]}, "w >= 3")
    expect_error({**base, "objects": [{"type": "tree", "x": 8, "y": 3}]}, "stands on water")
    # covering rule: a crown above a walkable cell whose south cell is walkable cannot happen with a tree (trunk), so
    # check with a house ridge over open ground: ridge row is walkable, the mid row below is blocked -> passes
    house = {**base, "objects": [{"type": "house", "x": 3, "y": 0, "w": 3, "h": 4, "door": 1}]}
    house["ground"] = "\n".join(["." * 10] * 6 + ["#" * 10])
    house["entrances"] = {"west": [0, 0]}
    hc = compile_map(house, kit, check_interiors=False)
    assert hc.collision[0, 4] == GRASS and hc.collision[1, 4] == WALL and hc.collision[3, 4] == ROAD
    ok += 1
    # CA-2: a house door on a town map zooms (effect: door); the same door on an overworld-kit map fades
    shop = {**house, "objects": [{**house["objects"][0], "enter": {"map": "x", "entrance": "door"}}]}
    assert compile_map(shop, kit, check_interiors=False).transitions[-1].get("effect") == "door"
    world = compile_map({**shop, "kits": ["overworld", "town"]}, kit, check_interiors=False)
    assert "effect" not in world.transitions[-1]
    ok += 1
    import map_selftest  # noqa: PLC0415  (determinism, objects, edge exits, inspect, map checks, report, preview)
    ok += map_selftest.run(sys.modules[__name__])
    if importlib.util.find_spec("terrain"): __import__("terrain").selftest()   # terrain blending (terrain/)
    print(f"build_map selftest: {ok} checks passed")


def main(args: list[str]) -> None:
    flags = {a for a in args if a.startswith("--")}
    if args == ["--selftest"]:
        selftest()
    elif args and args[0] == "--hash":                  # internal: used by the determinism checks
        rest = args[1:]
        src_file = None
        if "--src" in rest:
            i = rest.index("--src")
            src_file = rest[i + 1]
            del rest[i:i + 2]
        placeholders = "--placeholders" in rest
        ids = [a for a in rest if not a.startswith("--")]
        srcs = ({(s := json.loads(Path(src_file).read_text()))["id"]: s} if src_file else
                {mid: yaml.safe_load((SRC / f"{mid}.yaml").read_text()) for mid in ids or source_ids()})
        print(json.dumps({mid: hashes(compile_source(s, placeholders)[0]) for mid, s in srcs.items()}))
    elif args and args[0] == "--check-determinism":
        if not check_determinism(args[1:] or None):
            raise SystemExit("map error: compiled output depends on PYTHONHASHSEED")
    elif args and args[0] == "--preview":
        rest = list(args[1:])
        scale = 1.0
        if "--scale" in rest:
            i = rest.index("--scale")
            scale = float(rest[i + 1])
            del rest[i:i + 2]                       # by index: the value may equal a coordinate
        pos = [a for a in rest if not a.startswith("--")]
        if len(pos) != 6:
            raise SystemExit("usage: --preview <id> x0 y0 x1 y1 out.png [--grid] [--collision] [--scale f]")
        mid, x0, y0, x1, y1, out = pos
        print(preview(mid, int(x0), int(y0), int(x1), int(y1), Path(out), "--grid" in flags, "--collision" in flags,
                      scale))
    elif args and args[0] == "--metrics":
        metrics(args[1:] or None)
    elif flags:
        raise SystemExit(f"unknown option(s) {sorted(flags)}; see the module docstring")
    else:
        build(args or None)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except MapError as e:
        raise SystemExit(f"map error: {e}")

"""Map compiler: assets-src/maps/<id>.yaml (ASCII ground + placed objects) -> baked 2x map (docs/ART_TILES_PLAN.md).

  python3 -I assets-src/tools/build_map.py              # compile every source map
  python3 -I assets-src/tools/build_map.py cornelia     # one map
  python3 -I assets-src/tools/build_map.py --selftest   # offline checks

Writes assets/maps/ai/<id>.yaml (runtime MapData with `art` and `entrances`) and the baked chunks
assets/maps/ai/<id>/{below,above}_<row>_<col>.png (16x16 tiles of 48 native px each). The game draws `below` under
the characters and `above` (roof ridges, tree crowns) over them. The build fails on any validation error.
"""
from __future__ import annotations

import sys
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit as K  # noqa: E402

T = K.T
CHUNK = 16
ROOT = K.ROOT
SRC = ROOT / "assets-src" / "maps"
OUT = ROOT / "assets" / "maps" / "ai"
LEGACY_MAPS = ROOT / "assets" / "maps"

LEGEND = {".": "grass", ":": "cobble", ",": "dirt", "~": "water", "#": "wall", "=": "bridge", "u": "culvert"}
SOFT = ["grass", "dirt", "cobble"]                 # painted in this order; each erodes against the ones before it
WATERISH = {"water", "bridge", "culvert"}
# TerrainType values (src/types/index.ts)
GRASS, WALL, WATER, ROAD, BRIDGE = 0, 1, 2, 8, 9
TERRAIN = {"grass": GRASS, "cobble": ROAD, "dirt": ROAD, "water": WATER, "wall": WALL, "bridge": BRIDGE, "culvert": WALL}
BLOCKED = {WALL, WATER}
MAX_INSET = 5            # ragged edge: up to this many px inside the overlay cell
RIM = 5                  # stone rim width inside water cells
SHADOW = 2               # px of shadow below an overlay edge (stays well under the 4 px budget)
PASSTHROUGH = ("music", "encounterRate", "encounters", "battleBackgrounds", "canSave", "scriptedEncounters",
               "vehicles", "keyItemGates")


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
    canvas.alpha_composite(part, (cx * T + dx, cy * T + dy))


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
    if t == "house":
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
    if t in ("bush", "well", "barrel", "crate", "signpost", "flowers"):
        return [(x, y)]
    raise MapError(f"unknown object type {t!r}")


def styled(kit: K.Kit, name: str, style: str | None) -> Image.Image:
    if style and f"{name}@{style}" in kit.parts:
        return kit.parts[f"{name}@{style}"]
    return kit.part(name)


# ───────────────────────────── compile ─────────────────────────────

def compile_map(src: dict, kit: K.Kit, check_interiors: bool = True) -> Compiled:
    mid = src["id"]
    grid = parse_ground(src["ground"])
    hgt, wid = len(grid), len(grid[0])
    H, W = hgt * T, wid * T
    seed = sum(map(ord, mid))
    mat = np.array(grid)
    coll = np.vectorize(TERRAIN.get)(mat).astype(np.int16)

    # 1. ground: soft materials, each eroded (ragged) against the softer ones
    below = np.zeros((H, W, 3), np.uint8)
    for i, name in enumerate(SOFT):
        covered = ~np.isin(mat, SOFT[:i])                    # this layer and everything harder
        tex = _tile(kit.material(name), H, W)
        if i == 0:
            below[:] = tex
            continue
        pm = _up(covered)
        show = pm & (_erode_depth(pm, MAX_INSET + 1) > _noise(H, W, seed + i))
        below[show] = tex[show]
        edge = _edge_of(show)
        shadow = np.zeros_like(show)
        for k in range(1, SHADOW + 1):
            shadow[k:] |= show[:-k]
        _shade(below, shadow & ~show, 0.8)
        _shade(below, edge, 0.6)

    # 2. hard ground: water with a stone rim, bridges, town walls, culverts
    waterish = np.isin(mat, list(WATERISH))
    pw = _up(waterish)
    water = _up(mat == "water") | _up(mat == "culvert") | _up(mat == "bridge")
    below[water] = _tile(kit.material("water"), H, W)[water]
    rim = _up(mat == "water") & (_erode_depth(pw, RIM + 1) <= RIM)
    below[rim] = _tile(kit.material("rim"), H, W)[rim]
    _shade(below, _edge_of(rim) & ~_edge_of(pw), 0.55)     # inner line of the rim
    _shade(below, _edge_of(_up(mat == "water")) & rim & _edge_of(pw), 0.75)
    for y in range(hgt):
        for x in range(wid):
            m = grid[y][x]
            sl = (slice(y * T, (y + 1) * T), slice(x * T, (x + 1) * T))
            if m == "bridge":
                ns = all(0 <= yy < hgt and grid[yy][x] in WATERISH - {"bridge"} for yy in (y - 1, y + 1))
                tex = kit.material("bridge_h" if ns else "bridge_v")
                below[sl] = _tile(tex, H, W)[sl]
                px = below[sl]
                for dx, dy, side in ((0, -1, "n"), (0, 1, "s"), (-1, 0, "w"), (1, 0, "e")):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < wid and 0 <= yy < hgt and grid[yy][xx] in ("water", "culvert"):
                        band = {"n": (slice(0, 3), slice(None)), "s": (slice(T - 3, T), slice(None)),
                                "w": (slice(None), slice(0, 3)), "e": (slice(None), slice(T - 3, T))}[side]
                        px[band] = (px[band] * 0.55).astype(np.uint8)
            elif m == "wall":
                south_wall = y + 1 < hgt and grid[y + 1][x] in ("wall", "culvert")
                below[sl] = _tile(kit.material("wall_top" if south_wall else "wall_face"), H, W)[sl]
    walls = _up(np.isin(mat, ["wall", "culvert"]))
    _shade(below, _edge_of(walls), 0.5)

    canvas = Image.fromarray(below).convert("RGBA")
    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(hgt):
        for x in range(wid):
            if grid[y][x] == "culvert":
                below_wall = y + 1 < hgt and grid[y + 1][x] in ("wall", "culvert")
                if below_wall:      # the walkway over the arch: wall top across the water
                    canvas.paste(Image.fromarray(_tile(kit.material("wall_top"), H, W)[y * T:(y + 1) * T, x * T:(x + 1) * T]),
                                 (x * T, y * T))
                else:
                    _paste(canvas, kit.part("culvert"), x, y)

    # 3. objects
    objects = src.get("objects") or []
    owner: dict[tuple[int, int], int] = {}
    for n, o in enumerate(objects):
        for (cx, cy) in footprint(o):
            if not (0 <= cx < wid and 0 <= cy < hgt):
                raise MapError(f"object {n} ({o['type']}) runs off the map at ({cx}, {cy})")
            if (cx, cy) in owner:
                raise MapError(f"object {n} ({o['type']}) overlaps object {owner[(cx, cy)]} at ({cx}, {cy})")
            if grid[cy][cx] not in SOFT:
                raise MapError(f"object {n} ({o['type']}) stands on {grid[cy][cx]} at ({cx}, {cy})")
            owner[(cx, cy)] = n

    entrances = {k: list(v) for k, v in (src.get("entrances") or {}).items()}
    transitions = [dict(t) for t in (src.get("transitions") or [])]
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
            roof_rows = ["ridge"] + ["mid"] * (h - 4) + ["eave"]
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
            if o.get("sign"):
                if door is None:
                    raise MapError(f"house {n}: a sign needs a door column")
                _paste(canvas, kit.part(f"sign_{o['sign']}"), x + door, y + h - 3)
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
                                        "targetEntrance": e["entrance"]})
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
        elif t == "flowers":
            _paste(canvas, kit.part("flowers"), x, y)
        else:
            _paste(canvas, kit.part(t), x, y)
            coll[y, x] = WALL

    # grass detail: a tuft on some free grass cells, nudged within the cell
    for y in range(hgt):
        for x in range(wid):
            if grid[y][x] == "grass" and (x, y) not in owner and rng.random() < 0.18:
                _paste(canvas, kit.part("tuft"), x, y, int(rng.integers(-8, 9)), int(rng.integers(-8, 9)))

    above = np.asarray(top).copy()
    out = Compiled(mid, wid, hgt, np.asarray(canvas.convert("RGB")).copy(), above, coll, entrances, transitions)
    validate(src, out)
    return out


def grid_terrain_row(grid, y, x, w) -> list[int]:
    return [TERRAIN[grid[y][x + i]] for i in range(w)]


def _check_interior_entrance(map_id: str, entrance: str) -> None:
    path = LEGACY_MAPS / f"{map_id}.yaml"
    if not path.exists():
        raise MapError(f"door leads to unknown map {map_id}")
    ents = (yaml.safe_load(path.read_text()) or {}).get("entrances") or {}
    if entrance not in ents:
        raise MapError(f"door leads to {map_id}, which has no entrance {entrance!r}")


# ───────────────────────────── validation ─────────────────────────────

def _walkable(c: Compiled, x: int, y: int) -> bool:
    return 0 <= x < c.width and 0 <= y < c.height and int(c.collision[y, x]) not in BLOCKED


def validate(src: dict, c: Compiled) -> None:
    errors = []
    for npc in src.get("npcs") or []:
        if not _walkable(c, npc["x"], npc["y"]):
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
        start = next(iter(c.entrances.values()))
        seen = {tuple(start)}
        q = deque([tuple(start)])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in seen and _walkable(c, *n):
                    seen.add(n)
                    q.append(n)
        for name, pos in c.entrances.items():
            if tuple(pos) not in seen:
                errors.append(f"entrance {name} at {tuple(pos)} is not reachable from the first entrance")
        for t in c.transitions:
            if (t["x"], t["y"]) not in seen:
                errors.append(f"transition at ({t['x']}, {t['y']}) is not reachable on foot")
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
    rel = d.relative_to(ROOT).as_posix()
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


def build(ids: list[str] | None = None) -> list[Path]:
    srcs = sorted(SRC.glob("*.yaml")) if not ids else [SRC / f"{i}.yaml" for i in ids]
    written = []
    for p in srcs:
        src = yaml.safe_load(p.read_text())
        kit = K.load_kit(src.get("kit", "town"))
        c = compile_map(src, kit)
        path = write(src, c)
        placeholder = sorted(set(K.PART_NAMES) - kit.approved)
        print(f"{c.id}: {c.width}x{c.height} -> {path.relative_to(ROOT)} "
              f"({len(kit.approved)} approved parts, {len(placeholder)} placeholders)")
        written.append(path)
    ids_all = sorted(q.stem for q in SRC.glob("*.yaml"))
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
    print(f"build_map selftest: {ok} checks passed")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--selftest"]:
        selftest()
    else:
        try:
            build(args or None)
        except MapError as e:
            raise SystemExit(f"map error: {e}")

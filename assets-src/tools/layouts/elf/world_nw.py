"""Elfland's content on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.5, 7; NW-R ELF), placed on the generated
ground by the composer v2 (`world_source.region_content` calls `content`).

Today's ELF content (`elf/world_sites.py`, ELF-O; `town_elfheim_site.py`, ELF-T), ported to the new geography: every
piece is placed relative to its site's entrance (world-anchors.yaml's targets, `world_specs/elf.py`) and its door
offset (today's, `world_specs/today_doors.py`), never at a fixed cell.

- Elfheim: the approved 3x3 icon `town_elfheim` (LM4-INT) under its gate, the door its top-middle walk cell, hedge
  clumps in the two sky corners (OW-2: the door is entered from its gate only).
- The Western Keep: the approved 2x3 icon `western_keep` (LM5-INT) with its slate watchtower (2x3) to the west, both
  on a rock crag: the keep's top two rows and the tower stand on rock, and a rock column east of the keep takes the
  place of today's moat, so its door (the stair foot) has one way out, south to its arrival.
- The Marsh Cave: the 2x2 cave mouth, its door the bottom-right cell; a dead tree closes the door's east side.
- The waystone (a broken elven pillar, 1x2, with today's inspect text) beside the king's road, about a third of the
  way from Elfheim to the Keep; the dock post on the harbour quay beside `elf_port`; ten dead trees in the fens.
- The king's road (`elf/world_nw_road.py`): routed by A* (2.4 rule 8) from Elfheim's gate to the Keep's arrival and
  from Elfheim's gate to the Marsh Cave's, after the icons are stamped (so it never runs under one); its tips are the
  three entrance cells (`road_check.no_stubs`).

Every stamp lies inside a site's pin (the icons, their crag and door cells); the dead trees, the waystone and the post
only take cells whose 8 neighbours are open (no path is cut). The zones are `elf/world_nw_zones.py`'s.
"""
from __future__ import annotations

import numpy as np

from elf import world_nw_road as RD
from elf import world_nw_zones as Z
from elf import world_sites as OLD
from worldgen import climate as C
from worldgen.gates import BLOCK
from worldgen.geom import components

N8 = [(dx, dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dx, dy) != (0, 0)]
TREES, TREE_R, TREE_GAP = 10, 13, 3          # dead trees: count, within this many cells of the marsh, apart
WAYSTONE_AT = 0.35                           # the waystone's place along the keep road (share of its length)


def _parts(name: str) -> list[list[str]]:
    from kit import landmark_parts  # noqa: PLC0415  (the kit loads the approved sheets lazily)
    return [list(r) for r in landmark_parts(name)]


class Place:
    """The objects, ground stamps and blocked cells of the content, built in order."""

    def __init__(self, g: np.ndarray):
        self.g, self.objs, self.insp, self.blocked = g, [], [], set()

    def stamp(self, cells, ch: str) -> None:
        for x, y in cells:
            self.g[y, x] = ch

    def deco(self, x: int, y: int, parts: list[list], walk: tuple = (), **kw) -> None:
        self.objs.append({"type": "deco", **({"name": kw.pop("name")} if "name" in kw else {}), "x": x, "y": y,
                          **({"style": kw.pop("style")} if "style" in kw else {}), "parts": parts,
                          **({"walk_cells": [list(w) for w in walk]} if walk else {}), **kw})
        self.blocked |= {(x + i, y + j) for j, row in enumerate(parts) for i, p in enumerate(row)
                         if p and (i, j) not in walk}

    def open8(self, x: int, y: int, avoid: set) -> bool:
        """The cell and its 8 neighbours are walkable, free of objects and of `avoid` (placing a 1x1 here cuts no
        path)."""
        return all(self.g[y + dy, x + dx] not in BLOCK and (x + dx, y + dy) not in self.blocked | avoid
                   for dx, dy in N8 + [(0, 0)])


def elfheim(p: Place, gate: tuple[int, int], door: tuple[int, int], sides: tuple) -> None:
    """PT-5: the icon above its door (the bottom-middle cell, where the art's gate is, entered from the gate south of
    it) and its two side doors (the middle row's end cells, entered from the arrivals beside them)."""
    parts = _parts("town_elfheim")
    w, h = len(parts[0]), len(parts)
    x0, y0 = door[0] - w // 2, door[1] - (h - 1)
    parts[0][0] = parts[0][w - 1] = "tree_clump"
    p.stamp([(x0 + i, y0 + j) for j in range(h) for i in range(w)] + list(sides), ".")
    walk = ((door[0] - x0, h - 1), (0, h // 2), (w - 1, h // 2))
    p.deco(x0, y0, parts, walk=walk, name="elfheim", collide="alpha")
    p.stamp([gate], ",")


def keep(p: Place, door: tuple[int, int]) -> None:
    kx, ky = door[0] - (OLD.KEEP_W - 1), door[1] - (OLD.KEEP_H - 1)
    tx, ty = kx - 2, ky - 1
    crag = [(kx + i, ky + j) for i in range(OLD.KEEP_W) for j in range(OLD.KEEP_H - 1)]
    crag += [(tx + i, ty + j) for i in range(2) for j in range(3)]
    crag += [(kx + OLD.KEEP_W, ky + j) for j in range(OLD.KEEP_H)]          # the rock column where the moat was
    p.stamp(crag, "m")
    p.stamp([(kx, ky + OLD.KEEP_H - 1), door, (door[0], door[1] + 1)], ".")
    p.deco(kx, ky, _parts("western_keep"), walk=((door[0] - kx, door[1] - ky),), name="western_keep",
           collide="alpha")
    p.deco(tx, ty, [[f"tower_icon_{r}_{c}" for c in range(2)] for r in range(3)], style="slate", collide="alpha")


def marsh(p: Place, door: tuple[int, int]) -> None:
    mx, my = door[0] - 1, door[1] - 1
    p.stamp([(mx + i, my + j) for i in range(2) for j in range(2)] + [(door[0], door[1] + 1)], ".")
    p.deco(mx, my, [[f"cave_mouth_icon_{r}_{c}" for c in range(2)] for r in range(2)], walk=((1, 1),),
           name="marsh_cave")
    east = (door[0] + 1, door[1])
    p.stamp([east], "w")
    p.deco(*east, [["tree_clump"]], style="slate")


def waystone(p: Place, path: list[tuple[int, int]], road: set) -> None:
    """The pillar on the first open 1x2 beside the road from WAYSTONE_AT of its length on (inspect: its foot)."""
    start = int(len(path) * WAYSTONE_AT)
    for x, y in path[start:] + path[:start]:
        for dx, dy in ((1, 0), (-1, 0), (0, -2), (0, 1)):
            cx, cy = x + dx, y + dy
            box = [(cx, cy), (cx, cy + 1)]
            if all(c not in road and p.g[c[1], c[0]] == "." and p.open8(*c, set()) for c in box):
                p.deco(cx, cy, [["tpillar_broken_top"], ["tpillar_broken_bottom"]], style="pale_stone",
                       collide="alpha")
                p.insp.append({"x": cx, "y": cy + 1, "text": list(OLD.WAYSTONE_TEXT)})
                return
    raise ValueError("elf: no open cell for the waystone beside the king's road")


def dock_post(p: Place, dock: dict, avoid: set) -> None:
    """The post on an open land cell beside the dock's landing (never the landing itself)."""
    x, y = dock["x"], dock["y"]
    land = [(x + dx, y + dy) for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)) if p.g[y + dy, x + dx] not in BLOCK]
    for lx, ly in land:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
            c = (lx + dx, ly + dy)
            if c not in land and c not in avoid and p.g[c[1], c[0]] in ".s," and _safe(p, c, avoid | set(land)):
                p.deco(*c, [["dock_post_icon_0_0"]], collide="alpha")
                return
    raise ValueError("elf: no cell for the dock post by elf_port")


def _safe(p: Place, c: tuple[int, int], keep: set) -> bool:
    """Blocking c leaves every walkable 8-neighbour of it 4-connected to the others around c (a local cut test)."""
    x, y = c
    ring = [(x + dx, y + dy) for dx, dy in ((-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0))]
    ok = [p.g[cy, cx] not in BLOCK and (cx, cy) not in p.blocked for cx, cy in ring]
    runs = sum(1 for i in range(8) if ok[i] and not ok[i - 1])
    return (any(ok) and (runs <= 1 or all(ok))) and c not in keep


def dead_trees(p: Place, marsh_at: tuple[int, int], avoid: set) -> None:
    """TREES slate tree clumps on open swamp cells near the Marsh Cave (seeded order), TREE_GAP apart."""
    mx, my = marsh_at
    cand = [(x, y) for y in range(my - TREE_R, my + TREE_R + 1) for x in range(mx - TREE_R, mx + TREE_R + 1)
            if p.g[y, x] == "w" and (x - mx) ** 2 + (y - my) ** 2 <= TREE_R ** 2]
    order = np.random.default_rng(1991).permutation(len(cand))
    placed: list[tuple[int, int]] = []
    for i in order:
        x, y = cand[int(i)]
        if len(placed) == TREES:
            break
        if max(abs(x - mx), abs(y - my)) <= 2 or any(max(abs(x - a), abs(y - b)) < TREE_GAP for a, b in placed):
            continue
        if p.open8(x, y, avoid):
            p.deco(x, y, [["tree_clump"]], style="slate")
            placed.append((x, y))


def content(g: np.ndarray, meta: dict, doors: dict) -> dict:
    """ELF's objects, inspect cells, zones, backdrops and region checks on the composed ground `g` (stamped in place).
    `doors`: entrance -> door offset."""
    ents = {e: tuple(meta["entrances"][e]) for e in ("elf_elfheim", "elf_keep", "elf_marsh")}
    door = {e: (x + doors[e][0], y + doors[e][1]) for e, (x, y) in ents.items()}
    sides = tuple(tuple(meta["entrances"][e]) for e in ("elf_elfheim_west", "elf_elfheim_east"))
    p = Place(g)
    elfheim(p, ents["elf_elfheim"], door["elf_elfheim"], sides)
    keep(p, door["elf_keep"])
    marsh(p, door["elf_marsh"])
    port = next(d for d in meta["docks"] if d["id"] == "elf_port")
    keep_road = RD.route(p.g, p.blocked, ents["elf_elfheim"], ents["elf_keep"])
    marsh_road = RD.route(p.g, p.blocked, ents["elf_elfheim"], ents["elf_marsh"])
    errors = [f"elf: the king's road to {e} cannot be routed" for e, r in (("elf_keep", keep_road),
                                                                          ("elf_marsh", marsh_road)) if r is None]
    side_roads = [RD.route(p.g, p.blocked, s, ents["elf_elfheim"]) for s in sides]     # PT-5: to the side doors
    errors += [f"elf: no road to Elfheim's side door at {s}" for s, r in zip(sides, side_roads) if r is None]
    road = set(keep_road or []) | set(marsh_road or []) | {c for r in side_roads for c in (r or [])}
    if keep_road:
        waystone(p, keep_road, road)
    dock_post(p, port, road | set(ents.values()))
    dead_trees(p, ents["elf_marsh"], road | set(door.values()))
    tidy(p, meta)
    zones, owner = Z.zones(g, meta)
    # the region's own map checks (map_checks_region on its raster): only warp_leaves, since the raster's shared
    # chunks hold other regions' roads and patches (cut at the raster's edge they would read as stubs and blobs);
    # the roads are proved by the source's world-level road_check (no_stubs), the blobs by `tidy`
    return {"objects": p.objs, "inspect": p.insp, "zones": zones, "backdrops": dict(Z.BACKDROPS),
            "errors": errors + Z.errors(g, meta, zones) + blobs(p, meta),
            "region": {"checks": {"warp_leaves": True}, "land": owner},
            "road_islands": [ents["elf_elfheim"]]}       # the king's road is Elfland's own network (its gate cell)


def _land(p: Place, meta: dict) -> np.ndarray:
    return Z.mine(meta) & (p.g != "o")


def tidy(p: Place, meta: dict) -> None:
    """The road and the stamps may leave patches under 3 cells on ELF's land: they take their neighbours' char (the
    generator's tidy, `climate.tidy_blobs`, on ELF's land only; object cells are kept)."""
    frozen = ~_land(p, meta)
    for x, y in p.blocked:
        frozen[y, x] = True
    p.g[:] = C.tidy_blobs(p.g, frozen)


def blobs(p: Place, meta: dict) -> list[str]:
    """min_blob 3 (today's ELF rule) on ELF's land: mountain, forest, sand and swamp patches, object cells aside."""
    land, out = _land(p, meta), []
    for ch in "mfsw":
        lab, sz = components(p.g == ch)
        for k in range(1, len(sz)):
            if sz[k] >= 3:
                continue
            cells = [(int(x), int(y)) for y, x in np.argwhere(lab == k)]
            if all(land[y, x] for x, y in cells) and not any(c in p.blocked for c in cells):
                out.append(f"elf: a {ch} patch of {len(cells)} cells at {cells[0]} (min_blob 3)")
    return out

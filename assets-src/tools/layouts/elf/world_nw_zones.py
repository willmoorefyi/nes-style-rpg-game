"""Elfland's encounter zones on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8 `coverage`; NW-R ELF).

The zone ids, names, rosters and backdrops are today's (`elf/world_zones.py`, ELF-O), so `bestiary.yaml`'s habitats
and quest.yaml's stage zones hold; only their cells are new, built after the ground from ELF's owner cells
(`meta["region"]`, the owner grid of 3.4) as zone areas:

- `elf_keep_moor` (Keep Moor): ELF's walkable and canoe cells within KEEP_R of the Western Keep's arrival (the arm);
- `elf_fen` (The Fens): ELF's swamp cells within FEN_R of the Marsh Cave, their one-cell ring, and the cells within
  FEN_CORE of the cave (its approach);
- `elf_fields` (Elfland Woods): every other walkable or canoe cell of ELF;
- `elf_aldi` / `elf_sea` (ship): ELF's Water cells of the Aldi (flooded from its seed, every patch off) and the rest
  (the ocean).

Walking zones apply on foot and by canoe (no `modes`), first match wins (the order above); each zone's cells are
written as row rects, so no zone reaches another region's cells. `errors` checks the ship split (every ELF Water cell
in exactly one ship zone); the composer's `coverage` check proves the walking side.
"""
from __future__ import annotations

import numpy as np

from elf import world_zones as TODAY
from worldgen.geom import disc, flood

KEEP_R, FEN_R, FEN_CORE = 15, 14, 4
BACKDROPS = TODAY.BACKDROPS
WALKISH = ("o", "m")                         # not walkable and not canoe: water and rock


def mine(meta: dict) -> np.ndarray:
    return meta["region"] == meta["regions"].index("elf")


def owner_rects(meta: dict, g: np.ndarray) -> list[list[int]]:
    """ELF's land owner cells as row rects (`regions.elf.land`: the owner grid the tests read)."""
    return TODAY.row_rects(_cells(mine(meta) & (g != "o")))


def _cells(mask: np.ndarray) -> set[tuple[int, int]]:
    return {(int(x), int(y)) for y, x in np.argwhere(mask)}


def zones(g: np.ndarray, meta: dict) -> tuple[list[dict], list[list[int]]]:
    """(the five zones, ELF's land owner rects)."""
    own = mine(meta)
    moves = own & ~np.isin(g, WALKISH)
    kx, ky = meta["entrances"]["elf_keep"]
    mx, my = meta["entrances"]["elf_marsh"]
    moor = moves & disc(kx, ky, KEEP_R)
    swamp = own & (g == "w") & disc(mx, my, FEN_R)
    ring = swamp.copy()
    for s, a in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        ring |= np.roll(swamp, s, a)
    fen = moves & ~moor & (ring | disc(mx, my, FEN_CORE))
    fields = moves & ~moor & ~fen
    water = own & (g == "o")
    aldi = water & flood(g == "o", [tuple(meta["seeds"]["aldi"])])
    out = [
        {"id": "elf_keep_moor", "name": "Keep Moor", "rects": TODAY.row_rects(_cells(moor)), "encounters": TODAY.MOOR},
        {"id": "elf_fen", "name": "The Fens", "rects": TODAY.row_rects(_cells(fen)), "encounters": TODAY.FEN},
        {"id": "elf_fields", "name": "Elfland Woods", "rects": TODAY.row_rects(_cells(fields)),
         "encounters": TODAY.FIELDS},
        {"id": "elf_aldi", "name": "Aldi Sea", "modes": ["ship"], "rects": TODAY.row_rects(_cells(aldi)),
         "encounters": TODAY.ALDI},
        {"id": "elf_sea", "name": "Southern Sea", "modes": ["ship"], "rects": TODAY.row_rects(_cells(water & ~aldi)),
         "encounters": TODAY.SEA},
    ]
    return out, owner_rects(meta, g)


def mask(z: dict, shape: tuple[int, int]) -> np.ndarray:
    """A zone's cells from its rects."""
    m = np.zeros(shape, bool)
    for a, b, c, d in z["rects"]:
        m[b:d + 1, a:c + 1] = True
    return m


def errors(g: np.ndarray, meta: dict, zs: list[dict]) -> list[str]:
    """Every ELF Water cell in exactly one ELF ship zone; every zone non-empty."""
    out = [f"elf: zone {z['id']} has no cells" for z in zs if not z["rects"]]
    n = sum(mask(z, g.shape).astype(int) for z in zs if "ship" in (z.get("modes") or []))
    bad = np.argwhere(mine(meta) & (g == "o") & (n != 1))
    if len(bad):
        y, x = bad[0]
        out.append(f"elf: {len(bad)} Water cells not in exactly one ship zone, e.g. {(int(x), int(y))}")
    return out

"""Elfland's encounter zones and battle backgrounds (docs/WORLD_PLAN.md 3.2 S4-S6, 4.0.3, 4.2; ELF-O).

Walking zones, first match wins: `elf_keep_moor` (the arm and its root), `elf_fen` (the fens' cells), `elf_fields`
(the rest of ELF's box). Ship zones split every Water cell of ELF's box (bands included) exactly once: `elf_aldi`
(the Aldi side of the arm and the north coast) and `elf_sea` (the western strait and the southern ocean).
"""
from __future__ import annotations


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


# S4 land, "Elfland Woods": the B3 roster
FIELDS = [{"groups": [_g("ogre", 1, 2)], "weight": 3},
          {"groups": [_g("cobra", 2, 4)], "weight": 3},
          {"groups": [_g("lizard", 1, 3)], "weight": 2},
          {"groups": [_g("tarantula", 2, 3), _g("cobra", 0, 2)], "weight": 2},
          {"groups": [_g("werewolf", 1, 2), _g("cobra", 1, 2)], "weight": 2},
          {"groups": [_g("ogre_chief", 1), _g("ogre", 0, 1)], "weight": 1}]
# "The Fens": oozes and the drowned dead round the Marsh Cave
FEN = [{"groups": [_g("gray_ooze", 1, 2)], "weight": 3},
       {"groups": [_g("green_slime", 2, 4)], "weight": 3},
       {"groups": [_g("crawler", 1, 2), _g("zombie", 0, 2)], "weight": 2},
       {"groups": [_g("zombie", 3, 5)], "weight": 2}]
# "Keep Moor": the false king's sentinels and the moor's ghasts
MOOR = [{"groups": [_g("gargoyle", 2, 3)], "weight": 3},
        {"groups": [_g("ghast", 1, 3)], "weight": 2},
        {"groups": [_g("ogre_chief", 1, 2)], "weight": 2},
        {"groups": [_g("gargoyle", 1, 2), _g("ghast", 1)], "weight": 1}]
ALDI = [{"groups": [_g("sahagin", 3, 5)], "weight": 3},
        {"groups": [_g("shark", 1, 2)], "weight": 2},
        {"groups": [_g("buccaneer", 2, 4)], "weight": 2},
        {"groups": [_g("bigeyes", 1), _g("sahagin", 0, 2)], "weight": 1}]
SEA = [{"groups": [_g("sahagin_chief", 1, 3)], "weight": 3},
       {"groups": [_g("buccaneer", 3, 5)], "weight": 2},
       {"groups": [_g("bigeyes", 1, 2)], "weight": 1}]

BACKDROPS = {"elf_keep_moor": {"default": "grassland", "terrain": {"forest": "forest", "desert": "shoreline"}},
             "elf_fen": {"default": "marsh", "terrain": {"swamp": "swamp"}},
             "elf_fields": {"terrain": {"forest": "forest", "desert": "shoreline", "swamp": "swamp"}},
             "elf_aldi": {"default": "ocean"}, "elf_sea": {"default": "ocean"}}


def row_rects(cells: set[tuple[int, int]]) -> list[list[int]]:
    """Run-length encode cells per row into inclusive [x0, y, x1, y] rects (row-major)."""
    rects: list[list[int]] = []
    for y in sorted({c[1] for c in cells}):
        xs = sorted(c[0] for c in cells if c[1] == y)
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            rects.append([start, y, prev, y])
            if x is not None:
                start = prev = x
    return rects


def zones(fen: set[tuple[int, int]], aldi: set[tuple[int, int]], sea: set[tuple[int, int]]) -> list[dict]:
    return [
        {"id": "elf_keep_moor", "name": "Keep Moor", "rects": [[48, 112, 63, 145]], "encounters": MOOR},
        {"id": "elf_fen", "name": "The Fens", "rects": row_rects(fen), "encounters": FEN},
        {"id": "elf_fields", "name": "Elfland Woods", "rects": [[0, 144, 111, 191]], "encounters": FIELDS},
        {"id": "elf_aldi", "name": "Aldi Sea", "modes": ["ship"], "rects": row_rects(aldi), "encounters": ALDI},
        {"id": "elf_sea", "name": "Southern Sea", "modes": ["ship"], "rects": row_rects(sea), "encounters": SEA},
    ]

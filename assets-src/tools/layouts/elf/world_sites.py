"""Elfland's sites on the world map (docs/WORLD_PLAN.md 2.2, 2.6, 4.2; ELF-O): the Western Keep on the arm, the Marsh
Cave in the fens, Elfheim's icon, gate and harbour (read from ELF-T's `town_elfheim_site.py`), the waystone at the
arm's root, the fens' dead trees and the road that joins them. World cells throughout.
"""
from __future__ import annotations

from elf import town_elfheim_site as SITE

# the keep: a castle icon on the arm's Aldi shore, its door at (KEEP[0] + 1, KEEP[1] + 1), the anchor below it
KEEP = (59, 123)
KEEP_DOOR = (KEEP[0] + 1, KEEP[1] + 1)
KEEP_ARRIVE = (KEEP_DOOR[0], KEEP_DOOR[1] + 1)          # `elf_keep` (target (61, 126))
KEEP_TOWER = (57, 121)                                  # a watchtower (2x3) beside it
MARSH = (52, 160)                                       # the cave mouth (2x2); door (53, 161)
MARSH_DOOR = (MARSH[0] + 1, MARSH[1] + 1)
MARSH_ARRIVE = (MARSH_DOOR[0], MARSH_DOOR[1] + 1)       # `elf_marsh` (target (53, 162))
WAYSTONE = (55, 140)                                    # a broken elven waystone (1x2) at the arm's root
DOCK_POST = (86, 148)
# the road: Elfheim's gate west along the Aldi shore, north up the arm to the keep; a branch south to the fens
ROAD_KEEP = [SITE.GATE, (78, 150), (70, 150), (63, 149), (58, 147), (58, 136), (57, 131), (58, 127), KEEP_ARRIVE]
ROAD_MARSH = [(62, 149), (61, 154), (58, 159), (55, 163), MARSH_ARRIVE]
DEAD_TREES = [(36, 158), (42, 166), (47, 160), (56, 169), (64, 162), (39, 172), (51, 173), (65, 165), (34, 165),
              (54, 161)]   # the last one closes the cave door's east side (warp_leaves)
KEEP_MOAT = [(61, y) for y in range(121, 125)]           # Aldi water beside the keep (its door has one way out)
WAYSTONE_TEXT = ["A waystone, split by frost. Its runes point north along the moor.",
                 "Under the moss: \"The king's road. Let none who serve a false crown pass.\""]


def _line(a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]]:
    """A 4-connected line from a to b (x first, then y, in unit steps)."""
    (x, y), out = a, [a]
    while (x, y) != b:
        if x != b[0] and (abs(b[0] - x) >= abs(b[1] - y) or y == b[1]):
            x += 1 if b[0] > x else -1
        else:
            y += 1 if b[1] > y else -1
        out.append((x, y))
    return out


def road_cells() -> list[tuple[int, int]]:
    cells: list[tuple[int, int]] = []
    for path in (ROAD_KEEP, ROAD_MARSH):
        for a, b in zip(path, path[1:]):
            cells += [c for c in _line(a, b) if c not in cells]
    return cells


def icon_parts() -> tuple[tuple[int, int], list[list[str | None]], list[list[int]]]:
    """Elfheim's icon over the site's ICON cells: the approved Bedrock town icon `town_elfheim` (3x3, LM4-INT; before,
    the walled-town icon's cells ringed by hedge clumps), the door its top-middle walk cell, entered from the gate
    north of it; returns (top-left, parts, walk_cells)."""
    from kit import landmark_parts  # noqa: PLC0415
    xs, ys = [c[0] for c in SITE.ICON], [c[1] for c in SITE.ICON]
    x0, y0, w, h = min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    parts: list[list[str | None]] = [list(r) for r in landmark_parts("town_elfheim")]
    assert (w, h) == (len(parts[0]), len(parts)), "Elfheim's icon: the ICON box is the art's size"
    # the art's top corners are near-empty sky (2-3 % art): a hedge clump stands in each, so the door beside them
    # is entered from its gate only (OW-2)
    parts[0][0] = parts[0][w - 1] = "tree_clump"
    return (x0, y0), parts, [[SITE.DOOR[0] - x0, SITE.DOOR[1] - y0]]


def objects() -> list[dict]:
    (ix, iy), parts, walk = icon_parts()
    objs = [
        {"type": "deco", "name": "western_keep", "x": KEEP[0], "y": KEEP[1], "style": "slate",
         "parts": [["castle_icon_0_0", "castle_icon_0_1"], ["castle_icon_1_0", "castle_icon_1_1"]], "walk_cells": [[1, 1]]},
        {"type": "deco", "x": KEEP_TOWER[0], "y": KEEP_TOWER[1], "style": "slate", "collide": "alpha",
         "parts": [[f"tower_icon_{r}_{c}" for c in range(2)] for r in range(3)]},
        {"type": "deco", "name": "marsh_cave", "x": MARSH[0], "y": MARSH[1],
         "parts": [[f"cave_mouth_icon_{r}_{c}" for c in range(2)] for r in range(2)], "walk_cells": [[1, 1]]},
        {"type": "deco", "name": "elfheim", "x": ix, "y": iy, "parts": parts, "walk_cells": walk, "collide": "alpha"},
        {"type": "deco", "x": WAYSTONE[0], "y": WAYSTONE[1], "style": "pale_stone",
         "parts": [["tpillar_broken_top"], ["tpillar_broken_bottom"]], "collide": "alpha"},
        {"type": "deco", "x": DOCK_POST[0], "y": DOCK_POST[1], "parts": [["dock_post_icon_0_0"]], "collide": "alpha"},
    ]
    objs += [{"type": "deco", "x": x, "y": y, "style": "slate", "parts": [["tree_clump"]]} for x, y in DEAD_TREES]
    return objs


def blocked_cells() -> set[tuple[int, int]]:
    """Cells the objects block (the region's own walk flood needs them)."""
    (ix, iy), parts, walk = icon_parts()
    out = {(ix + i, iy + j) for j, row in enumerate(parts) for i, p in enumerate(row) if p and [i, j] not in walk}
    out |= {(KEEP[0] + i, KEEP[1] + j) for i in range(2) for j in range(2)} - {KEEP_DOOR}
    out |= {(KEEP_TOWER[0] + i, KEEP_TOWER[1] + j) for i in range(2) for j in range(3)}
    out |= {(MARSH[0] + i, MARSH[1] + j) for i in range(2) for j in range(2)} - {MARSH_DOOR}
    out |= {(WAYSTONE[0], WAYSTONE[1] + 1), *DEAD_TREES}
    return out


def transitions() -> list[dict]:
    return [{"x": KEEP_DOOR[0], "y": KEEP_DOOR[1], "targetMap": "western-keep-1f", "targetEntrance": "arrival"},
            {"x": MARSH_DOOR[0], "y": MARSH_DOOR[1], "targetMap": "marsh-cave-b1", "targetEntrance": "arrival"},
            {"x": SITE.DOOR[0], "y": SITE.DOOR[1], "targetMap": SITE.TOWN, "targetEntrance": "gate"}]


def entrances() -> dict[str, list[int]]:
    return {"elf_keep": list(KEEP_ARRIVE), "elf_marsh": list(MARSH_ARRIVE), SITE.ANCHOR: list(SITE.GATE)}


def inspect() -> list[dict]:
    return [{"x": WAYSTONE[0], "y": WAYSTONE[1] + 1, "text": list(WAYSTONE_TEXT)}]


def docks() -> list[dict]:
    return [dict(SITE.DOCK)]


def clear_cells() -> dict[tuple[int, int], str]:
    """Ground under the sites: grass (or the road) where an icon, its door or its arrival stands."""
    out = {c: "." for c in blocked_cells() | {KEEP_DOOR, MARSH_DOOR, SITE.DOOR}}
    out.update({c: "w" for c in DEAD_TREES})            # the dead trees stand in the fen
    out.update({c: "o" for c in KEEP_MOAT})
    out[DOCK_POST] = "s"                                # the post stands on the quay's sand
    # the keep and its tower stand on a crag: the castle icon's top row has too little art to be a wall by itself
    out.update({c: "m" for c in [(KEEP[0], KEEP[1]), (KEEP[0] + 1, KEEP[1])]
                + [(KEEP_TOWER[0] + i, KEEP_TOWER[1] + j) for i in range(2) for j in range(3)]})
    out.update({c: "," for c in road_cells()})
    out[SITE.GATE] = ","
    return out

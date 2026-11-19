"""Scattered dressing round a town icon on the world map (FX-R, P3-R4): copses, bushes and field stones placed by a
seeded generator instead of a stamped 3x3 ring, so a town reads as settled ground, not a grid.

  scatter(box, taken, seed, ring, walkable, solid)
                                              the 1x1 decos for the icon's box (minus the town's own cells) and a
                                              few cells of the ring round it: a mix of kinds, whole-px offsets, gaps

Every piece is its own deco with `collide: alpha` (a stone nudged off its cell blocks only what its art covers), so a
gap or a nudged piece leaves walkable ground; only the `solid` cells (beside a door) block whole. numpy's seeded
generator only (no `random`, no `hash()`), cells in row-major order, so a rerun is byte-identical.
"""
from __future__ import annotations

import numpy as np

Cell = tuple[int, int]
KINDS = ("tree_clump", "boulder", "bush")
NUDGE = 11                       # px: the largest offset of a piece on each axis (a cell is 48 native px)


def _pieces(cells: list[Cell], solid: set[Cell], rng: np.random.Generator, gaps: int) -> list[tuple[Cell, str]]:
    """The cells that get a piece and its kind: `gaps` cells left empty (never a `solid` one), at least one copse
    and one stone."""
    order = [cells[i] for i in rng.permutation(len(cells))]
    free = [c for c in order if c not in solid]
    kept = sorted(set(cells) - set(free[:gaps]), key=lambda c: (c[1], c[0]))
    kinds = [KINDS[int(k)] for k in rng.choice(len(KINDS), size=len(kept), p=(0.45, 0.3, 0.25))]
    if kept and "tree_clump" not in kinds:
        kinds[0] = "tree_clump"
    if len(kept) > 1 and "boulder" not in kinds:
        kinds[-1] = "boulder"
    return list(zip(kept, kinds))


def scatter(box: list[Cell], taken: set[Cell], seed: int, ring: list[Cell], walkable,
            solid: set[Cell] = frozenset(), gate: Cell | None = None) -> list[dict]:
    """Decos for the free cells of an icon's `box` (two or three of them left as gaps) and for about a third of the
    `ring` cells that `walkable(cell)` accepts, each nudged by up to NUDGE px; `taken` cells (the town, its door,
    its gate) get nothing, and `solid` cells (the door's other sides: a door is entered from its gate only) always
    get a piece that blocks the whole cell, a copse or a stone nudged by at most 3 px. With `gate`, a ring piece that
    would wall the gate in (no way out past the ring) or a gap that no path reaches is dropped / filled."""
    rng = np.random.default_rng(seed)
    inner = sorted((c for c in box if c not in taken), key=lambda c: (c[1], c[0]))
    out = dict(_pieces(inner, solid, rng, gaps=int(rng.integers(2, 4))))
    for c in sorted(solid, key=lambda c: (c[1], c[0])):
        if out.get(c) == "bush":
            out[c] = "tree_clump"
    outer = sorted((c for c in ring if c not in taken and walkable(c)), key=lambda c: (c[1], c[0]))
    pick = [c for c in outer if rng.random() < 0.3]
    for c in pick:
        out[c] = KINDS[int(rng.choice(len(KINDS), p=(0.5, 0.35, 0.15)))]
    if not inner and len(pick) > 1:              # LM4-INT: an icon filling its box: the ring holds a copse and a stone
        kinds = [out[c] for c in pick]
        if "tree_clump" not in kinds:
            out[pick[0]] = "tree_clump"
        if "boulder" not in [out[c] for c in pick]:
            out[pick[-1]] = "boulder"
    if gate is not None:
        _keep_open(out, box, ring, walkable, gate, set(pick), taken & set(box))
    decos = []
    for (x, y), kind in sorted(out.items(), key=lambda p: (p[0][1], p[0][0])):
        lim = 3 if (x, y) in solid else NUDGE
        dx, dy = (int(v) for v in rng.integers(-lim, lim + 1, size=2))
        decos.append({"type": "deco", "parts": [[kind]], "x": x, "y": y, "offset": [dx, dy],
                      **({} if (x, y) in solid else {"collide": "alpha"})})
    return decos


def _keep_open(out: dict[Cell, str], box: list[Cell], ring: list[Cell], walkable, gate: Cell,
               ring_pieces: set[Cell], town: set[Cell]) -> None:
    """Counting every piece and the `town` cells as walls: drop ring pieces (nearest the gate first) until the gate
    reaches the cells past the ring, then fill every gap of the box that the gate does not reach."""
    xs, ys = [c[0] for c in box + ring], [c[1] for c in box + ring]
    lo_x, hi_x, lo_y, hi_y = min(xs) - 3, max(xs) + 3, min(ys) - 3, max(ys) + 3     # the ring and 3 cells past it
    area = set(box) | set(ring)

    def reach() -> set[Cell]:
        seen, todo = {gate}, [gate]
        while todo:
            x, y = todo.pop()
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in seen or n in out or n in town or not (lo_x <= n[0] <= hi_x and lo_y <= n[1] <= hi_y):
                    continue
                if n in box or walkable(n):
                    seen.add(n)
                    todo.append(n)
        return seen

    near = sorted(ring_pieces, key=lambda c: (abs(c[0] - gate[0]) + abs(c[1] - gate[1]), c[1], c[0]))
    while not (reach() - area) and near:
        out.pop(near.pop(0), None)
    seen = reach()
    for c in sorted(box, key=lambda c: (c[1], c[0])):
        if c not in out and c not in seen and c not in town:
            out[c] = KINDS[(c[0] + c[1]) % 2]          # a copse or a stone


def ring_of(box: list[Cell], reach: int = 1) -> list[Cell]:
    """The cells within `reach` (Chebyshev) of the box, outside it, row-major."""
    xs, ys = [c[0] for c in box], [c[1] for c in box]
    inside = set(box)
    return [(x, y) for y in range(min(ys) - reach, max(ys) + reach + 1)
            for x in range(min(xs) - reach, max(xs) + reach + 1) if (x, y) not in inside]


def door_sides(door: Cell, box: list[Cell], taken: set[Cell]) -> set[Cell]:
    """The box cells beside the door that are not taken: they must stay blocked (warp_leaves)."""
    x, y = door
    return {c for c in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if c in box and c not in taken}

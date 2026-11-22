"""AR-P2: the AR dungeon props (gen/approved/dungeon/props_ar, cut by gen/prop_cut.py) placed by the dungeon layouts.

place(room, id, x, y) puts prop `id` with its top-left cell at (x, y):
  - a wall prop (torch, chains, cobweb, portcullis, iron door, bar gate) hangs on wall-face cells (`F`; on_wall);
  - a one-row floor prop blocks its cells;
  - a taller floor prop stands with its upper rows on the wall face behind it when they are wall (on_wall, drawn
    with the wall) and otherwise draws them over characters, walkable (above_rows), so only its foot blocks;
  - a lit prop also gets its `flame` ambient entry (tools/ambient_flame.py resolves it at compile time).
The portcullis, iron door and bar gate are dressing only (no flag swaps their art): never on a walkable way.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from gen.prop_spec import FLAME, SPEC  # noqa: E402
from kit_props import prop_parts  # noqa: E402

WALLISH = "WF"


def place(room, pid: str, x: int, y: int, *, lit: bool = True) -> None:
    w, h = SPEC[pid][3]
    g = room.g
    cells = [(x + i, y + j) for j in range(h) for i in range(w)]
    if SPEC[pid][4] == "wall":
        bad = [c for c in cells if g[c] != "F"]
        if bad:
            raise ValueError(f"{room.id}: wall prop {pid} at ({x}, {y}) off the wall face at {bad}")
        room.deco(prop_parts(pid), x, y, on_wall=True)
    else:
        foot = [(x + i, y + h - 1) for i in range(w)]
        if any(g[c] in WALLISH for c in foot):
            raise ValueError(f"{room.id}: floor prop {pid} at ({x}, {y}) has its foot on a wall")
        upper = cells[:-w]
        if not upper:
            room.deco(prop_parts(pid), x, y)
        elif all(g[c] in WALLISH for c in upper):
            room.deco(prop_parts(pid), x, y, on_wall=True)
        elif any(g[c] in WALLISH for c in upper):
            raise ValueError(f"{room.id}: tall prop {pid} at ({x}, {y}) half on a wall")
        else:
            room.deco(prop_parts(pid), x, y, above_rows=h - 1)
    if lit and pid in FLAME:
        room.ambient.append({"kind": "flame", "prop": pid, "x": x, "y": y})


def dress(room, items) -> None:
    """place() each (id, x, y) of `items`."""
    for pid, x, y in items:
        place(room, pid, x, y)

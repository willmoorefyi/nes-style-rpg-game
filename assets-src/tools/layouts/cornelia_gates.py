"""Cornelia's gate dressing (M7), used by layouts/cornelia.py: the turrets on the wall's bends and either side of
every gate, and the town/gates arches over the south gate, the inner gatehouse and the north postern.

Only an arch's drawn opening is walkable. The 3-wide arch (gate_arch_3) is cut into its columns: the centre column
(the opening) is drawn over characters (`passage`: the road runs on south of it), the two jambs stand on the wall
under the characters, and the wall line under them blocks. The 2-wide postern arch (gate_arch_2) has a 26 px opening
on its cell boundary (native x 34-60, centre 47), so it is shifted 23 px west to centre the opening on x 6; x 7 joins
the wall, and a bush closes (7, 2) so nobody stands with their head under the arch's east jamb.
"""
from __future__ import annotations

TURRETS = [(55, 2), (56, 36), (56, 58), (1, 22), (1, 33), (4, 56), (26, 66), (33, 66), (1, 41), (1, 46), (58, 41),
           (58, 46), (58, 21), (58, 26), (27, 30), (32, 30), (4, 0), (8, 0)]
ARCH_3_ROWS = (68, 31)               # the south gate and the inner gatehouse (passage columns cx - 1 .. cx + 1)
POSTERN = (6, 0)
POSTERN_SHIFT = -23                  # native px: the opening's centre 47 -> 24, the middle of x 6


def place(g, deco, obj, turret, cx: int) -> None:
    """Wall up the jamb cells and add the turrets and arches (in that order) through `deco` / `obj`."""
    for y in ARCH_3_ROWS:
        g.rect(cx - 1, y, cx - 1, y + 1, "#")
        g.rect(cx + 1, y, cx + 1, y + 1, "#")
    px, py = POSTERN
    g.rect(px + 1, py, px + 1, py + 1, "#")
    g.set(px + 1, py + 2, ".")
    for (x, y) in TURRETS:
        deco(turret, x, y, on_wall=True)
    for y in ARCH_3_ROWS:
        for i in range(3):
            parts = [[f"gate_arch_3_{j}_{i}"] for j in range(2)]
            if i == 1:
                deco(parts, cx, y, above_rows=2, passage=True)
            else:
                deco(parts, cx - 1 + i, y, on_wall=True)
    deco([[f"gate_arch_2_{j}_{i}" for i in range(2)] for j in range(2)], px, py, offset=[POSTERN_SHIFT, 0],
         above_rows=2, passage=True, on_wall=True)
    obj(type="bush", x=px + 1, y=py + 2)

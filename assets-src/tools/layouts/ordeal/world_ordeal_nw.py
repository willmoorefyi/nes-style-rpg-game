"""Region ORDEAL's content on the NW world (docs/NATURAL_WORLD_PLAN.md 2.3, 3.3, 3.5, 7 NW-R): the icons, the
hermit's slate, the heath's boulders, the zones and their backdrops, placed on the composed ground by
`world_specs/ordeal.py`'s `content` (called by the composer v2). Today's tables are reused unchanged: the zone ids,
names and rosters and the hermit's text (`world_ordeal_data.py`).

Design note (NW-R ORDEAL). The Citadel is a crescent island arc, its bay open to the south-east toward Cardia. The
spine runs along the outer side, so the north arm is a cold rim of rock and snow with a tarn and its streams, and
the broad west arm is a sheltered heath (the `warm` hints) of grass and pine stands: the tableland of the Citadel
of Trials, whose gate is cut into a crag spur of the spine between two broken pillars, with the landing meadow
below it. Cardia is an archipelago of about ten islets south-east of the bay: Bahamut's isle, bitten into a
horseshoe whose bay opens east, with its cave mouth in a notch of rock; the hermit's islet, the northernmost, with
his driftwood hut; four more named islets and the look-only ones between them. A small group lies south of the
arc's west horn. No dock, no land joined to Onrac or Gaia: the airship lands on the meadow and on every islet.
Zones: `ord_heath` on the arc, `ord_isles` on every islet (both on foot and by canoe on the arc's streams),
`ord_sea` on ORDEAL's water. Backdrops: the heath grassland (forest in the stands, grassland on tundra, the ice
floor on snow), the isles the shoreline, the sound the ship's deck.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import world_ordeal_data as D  # noqa: E402
from overworld_zones import row_rects  # noqa: E402
from worldgen.geom import components  # noqa: E402

REGION = "ordeal"
BLOCK = ("o", "m", "r", "≈")                  # on foot
CANOE = ("r", "≈")
MODES = {"ord_heath": ["walking", "canoe"], "ord_isles": ["walking", "canoe"], "ord_sea": ["ship"]}
COLD = {"tundra": "grassland", "snow": "ice_cave"}     # D-NW9: the cold terrains' backdrops (staged ids)
BOULDERS = ((3, 11), (-5, 6), (-6, 3))        # the heath's boulders: offsets from the Citadel's door
HUT = (-1, -2)                                # the hermit's 2x2 hut: its offset from his islet's landing


def _door(meta: dict, e: str) -> tuple[int, int]:
    x, y = meta["entrances"][e]                # every ORDEAL door is one step north of its entrance (today's)
    return (x, y - 1)


class _Ground:
    """Edits of the composed ground on ORDEAL's own land cells only (a stamp never makes land or touches another
    region)."""

    def __init__(self, g: np.ndarray, own: np.ndarray):
        self.g, self.own = g, own

    def put(self, x: int, y: int, ch: str) -> None:
        if not self.own[y, x] or self.g[y, x] == "o":
            raise ValueError(f"ordeal: stamp {ch!r} at {(x, y)} is not ORDEAL land")
        self.g[y, x] = ch


def _citadel(gr: _Ground, meta: dict) -> list[dict]:
    """The 3x3 icon over the door (bottom centre), its top row and the pillars' tops on the crag; the gate's court
    and the path down to the meadow grass."""
    dx, dy = _door(meta, "ord_citadel")
    x0, y0 = dx - 1, dy - 2
    for x in range(x0 - 1, x0 + 4):
        gr.put(x, y0, "m")
        gr.put(x, y0 + 2, ".")
    for x in range(x0, x0 + 3):
        gr.put(x, y0 + 1, ".")
    gr.put(x0 - 1, y0 + 1, "m")
    gr.put(x0 + 3, y0 + 1, "m")
    mx, my = meta["entrances"]["ord_meadow"]
    for y in range(dy + 1, my + 2):
        for x in range(mx - 1, mx + 2):
            gr.put(x, y, ".")
    pillar = [["tpillar_broken_top"], ["tpillar_broken_bottom"]]
    return [D._deco("citadel", x0, y0, walk_cells=[[1, 2]], collide="alpha"),
            {"type": "deco", "parts": pillar, "x": x0 - 1, "y": y0 + 1},
            {"type": "deco", "parts": pillar, "x": x0 + 3, "y": y0 + 1}]


def _cave(gr: _Ground, meta: dict) -> list[dict]:
    """Bahamut's 2x2 cave mouth (its door the bottom right cell) in a notch of rock on his isle."""
    dx, dy = _door(meta, "ord_bahamut")
    cx, cy = dx - 1, dy - 1
    for x in range(cx - 1, cx + 3):
        if gr.g[cy - 1, x] != "o":
            gr.put(x, cy - 1, "m")
    for x in (cx - 1, cx + 2):
        if gr.g[cy, x] != "o":
            gr.put(x, cy, "m")
    for x, y in ((cx, cy), (cx + 1, cy), (cx, cy + 1), (dx, dy), (dx, dy + 1)):
        gr.put(x, y, ".")
    return [D._deco("cave_mouth", cx, cy, walk_cells=[[1, 1]])]


def _hermit(gr: _Ground, meta: dict) -> tuple[list[dict], list[dict]]:
    lx, ly = meta["entrances"]["ord_isle_hermit"]
    hx, hy = lx + HUT[0], ly + HUT[1]
    for j in range(2):
        for i in range(2):
            gr.put(hx + i, hy + j, ".")
    text = D.INSPECT[0]["text"]
    return ([D._deco("hermit_hut", hx, hy, collide="alpha")], [{"x": hx + 1, "y": hy + 1, "text": list(text)}])


def _boulders(g: np.ndarray, own: np.ndarray, meta: dict, taken: set) -> list[dict]:
    """A boulder on the nearest heath grass cell to each offset whose 8 neighbours are all walkable (so none can
    cut a path), away from the doors, the entrances and each other."""
    dx, dy = _door(meta, "ord_citadel")
    ents = [tuple(v) for v in meta["entrances"].values()]
    out = []
    for ox, oy in BOULDERS:
        tx, ty = dx + ox, dy + oy
        best = None
        for r in range(0, 9):
            ring = sorted((abs(i) + abs(j), ty + j, tx + i) for j in range(-r, r + 1) for i in range(-r, r + 1)
                          if max(abs(i), abs(j)) == r)
            for _d, y, x in ring:
                open8 = all(g[y + b, x + a] not in BLOCK for a in (-1, 0, 1) for b in (-1, 0, 1))
                if (g[y, x] == "." and own[y, x] and open8
                        and all(max(abs(x - u), abs(y - v)) > 2 for u, v in [*ents, *taken])):
                    best = (x, y)
                    break
            if best:
                break
        if best:
            taken.add(best)
            out.append({"type": "deco", "parts": [["boulder"]], "x": best[0], "y": best[1], "collide": "alpha"})
    return out


def zones(g: np.ndarray, own: np.ndarray, meta: dict) -> dict[str, set]:
    """zone id -> its cells: ORDEAL's water the sound's; the walkable and canoe cells of the arc (the landmass of
    the Citadel's gate) the heath's, of every other ORDEAL landmass the isles'."""
    lab, _ = components(g != "o")
    cx, cy = meta["entrances"]["ord_citadel"]
    arc = lab[cy, cx]
    out: dict[str, set] = {z: set() for z in D.ZONES}
    for y, x in np.argwhere(own):
        ch = g[y, x]
        if ch == "o":
            out["ord_sea"].add((int(x), int(y)))
        elif ch not in BLOCK or ch in CANOE:
            out["ord_heath" if lab[y, x] == arc else "ord_isles"].add((int(x), int(y)))
    return out


def content(g: np.ndarray, meta: dict) -> dict:
    own = meta["region"] == meta["regions"].index(REGION)
    gr = _Ground(g, own)
    objs = _citadel(gr, meta) + _cave(gr, meta)
    hut, insp = _hermit(gr, meta)
    objs += hut
    taken = {(o["x"] + i, o["y"] + j) for o in objs for j in range(len(o["parts"])) for i in range(len(o["parts"][0]))}
    objs += _boulders(g, own, meta, taken)
    cells = zones(g, own, meta)
    ez = [{"id": z, "name": name, "modes": MODES[z], "rects": row_rects(cells[z]), "encounters": table}
          for z, (name, _m, table, _bg) in D.ZONES.items() if cells[z]]
    bgs = {z: ({**bg, "terrain": {**bg.get("terrain", {}), **COLD}} if z != "ord_sea" else dict(bg))
           for z, (_n, _m, _t, bg) in D.ZONES.items()}
    return {"objects": objs, "inspect": insp, "encounterZones": ez, "battleBackgrounds": {"zones": bgs}}

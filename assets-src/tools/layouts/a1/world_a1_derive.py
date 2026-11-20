"""Derive act 1's pins and stamps, `a1/world_a1_pins.py`, from today's world (docs/NATURAL_WORLD_PLAN.md 3.6.2; NW-3).

  python3 -I assets-src/tools/layouts/a1/world_a1_derive.py           # write a1/world_a1_pins.py
  python3 -I assets-src/tools/layouts/a1/world_a1_derive.py --check   # exit 1 when the committed file is stale

It reads today's 192x192 source `assets-src/maps/overworld.yaml` (written by `world.py`; never changed here) and the
act-1 tables of `overworld_consts.py` (local act-1 cells; today's world cell = local + the act-1 origin (64, 64)),
and writes every act-1 pin **Cornelia-relative**: rel = p_today - (92, 111), so its NW world cell is CORNELIA_NW +
rel (= p_today + A1_DELTA). Nothing is retyped: entrances, transitions, gates, objects, inspect cells, NPCs, the
vehicle, spots, the patch, the dock and the Aldi seed come from the source; the city, the bridge, the tomb, the
stream, the spine and the roads from the consts. The NW-0 design choices (the template box, the kept rects and
discs, the sound's line, the channel's x range) are the parameters below, in today's cells.

The template grid (`TEMPLATE`, the act-1 box without Pravoka's range strip) holds today's outline and its kept cells:
a kept cell is its legend char, `#` is land that the generator regenerates, a space is regenerated sea.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))         # tools (worldgen)
sys.path.insert(0, str(HERE.parent))             # layouts (overworld_consts)
import overworld_consts as C  # noqa: E402
from worldgen.geom import bfs_dist  # noqa: E402
from worldgen.gates import walk  # noqa: E402

SRC = HERE.parents[2] / "maps" / "overworld.yaml"
OUT = HERE / "world_a1_pins.py"
O = (64, 64)                                     # today's act-1 origin (world_api.A1_ORIGIN, v1)
CORNELIA_TODAY = (92, 111)
# NW-0's design parameters, in today's world cells
TPL = (64, 64, 137, 145)                         # the template box (x0, y0, x1, y1): act 1 without the range strip
OBJ_X1 = 141                                     # act-1 content: x 64-141, y 64-145
KEEP_RECTS = {"bridge": (88, 89, 99, 98), "pravoka": (124, 95, 136, 105), "jetty": (91, 114, 94, 122)}
KEEP_DISCS = {"cornelia": ((92, 109), 6.5), "temple": ((79, 102), 4.5), "matoya": ((74, 75), 3.0),
              "tomb": ((114, 107), 4.5)}
BOULDER_R = 1.5
EAST_RIVER_BOX = (100, 99, 118, 122)             # the east river and its tarn, kept with a 2-cell buffer
CHANNEL_X = (132, 137)                           # Pravoka's channel columns, on world_a1_ground.CHANNEL_ROWS
CHANNEL_ROWS = (92, 110)
SOUND_LINE = [(62, 95), (70, 95.5), (80, 95), (88, 94.6), (93, 94.8), (98, 93.5), (103, 92.5), (105, 92)]
ACT1 = ("cornelia", "cornelia_west", "cornelia_east", "cornelia_north", "castle", "north_shore", "temple",
        "a1_matoya", "a1_pravoka")


def w(p):
    """A local act-1 point -> today's world point."""
    return (p[0] + O[0], p[1] + O[1])


def rel(p):
    """Today's world point -> Cornelia-relative (6 decimals, so a fraction reads as written)."""
    f = lambda v: int(v) if float(v).is_integer() else round(float(v), 6)  # noqa: E731
    return (f(p[0] - CORNELIA_TODAY[0]), f(p[1] - CORNELIA_TODAY[1]))


def inbox(x, y, x1=OBJ_X1) -> bool:
    return TPL[0] <= x <= x1 and TPL[1] <= y <= TPL[3]


def chars(doc) -> np.ndarray:
    return np.array([list(r) for r in doc["ground"].rstrip("\n").split("\n")])


def keep_mask(ch: np.ndarray) -> np.ndarray:
    """The cells whose chars are copied (today's cells): NW-0's rects, discs, the stream and the east river."""
    h, wd = ch.shape
    yy, xx = np.mgrid[0:h, 0:wd]
    m = np.zeros((h, wd), bool)
    for x0, y0, x1, y1 in KEEP_RECTS.values():
        m[y0:y1 + 1, x0:x1 + 1] = True
    discs = list(KEEP_DISCS.values()) + [(w(b), BOULDER_R) for b in C.BOULDERS]
    for (cx, cy), r in discs:
        m |= np.hypot(xx - cx, yy - cy) <= r
    stream = [w(p) for p in C.STREAM]
    for (x0, y0), (x1, y1) in zip(stream, stream[1:]):
        for t in np.linspace(0, 1, 20):
            m |= np.hypot(xx - (x0 + (x1 - x0) * t), yy - (y0 + (y1 - y0) * t)) <= 1.5
    x0, y0, x1, y1 = EAST_RIVER_BOX
    river = np.zeros((h, wd), bool)
    river[y0:y1 + 1, x0:x1 + 1] = np.isin(ch[y0:y1 + 1, x0:x1 + 1], ["r", "≈", "="])
    for _ in range(2):
        river = river | np.roll(river, 1, 0) | np.roll(river, -1, 0) | np.roll(river, 1, 1) | np.roll(river, -1, 1)
    return m | river


def template(ch: np.ndarray) -> list[str]:
    keep = keep_mask(ch)
    x0, y0, x1, y1 = TPL
    box = np.zeros(keep.shape, bool)
    box[y0:y1 + 1, x0:x1 + 1] = True
    assert not (keep & ~box).any(), "a kept cell lies outside the template box"
    assert not np.isin(ch[box], ["#", " "]).any(), "today's ground uses a template marker"
    rows = []
    for y in range(y0, y1 + 1):
        rows.append("".join(ch[y, x] if keep[y, x] else ("#" if ch[y, x] != "o" else " ") for x in range(x0, x1 + 1)))
    return rows


def moved(o: dict) -> dict:
    return {**o, "x": rel((o["x"], o["y"]))[0], "y": rel((o["x"], o["y"]))[1]}


def icon(objs: list[dict], pred) -> list:
    """The cells of an object's parts box (the icon footprint), rel."""
    o = next(o for o in objs if pred(o))
    parts = o["parts"]
    return [rel((o["x"] + i, o["y"] + j)) for i in range(max(len(r) for r in parts)) for j in range(len(parts))]


def roads(jetty: list) -> list[list]:
    """Today's road network (`overworld.build`: consts.ROADS, the S road to the jetty, the footbridge road), in local
    cells: the gate roads start on their warp cells, the ring joins them, and the east road runs on over the east
    footbridge into the tomb road (one network, no stub)."""
    head = (jetty[0][0] - O[0], jetty[0][1] - O[1] - 1)          # the S road ends on land above the jetty head
    r = [list(p) for p in C.ROADS]
    east = r[5] + r[6]                                           # (RX - 1, RY) -> the footbridge -> (RX + 2, RY)
    out = r[:5] + [east, [C.S_WARP, C.ARRIVE["cornelia"], head], [(C.CX + 2, C.CY + 5), C.FOOT_ROAD, C.FOOTBRIDGE]]
    return [[p for i, p in enumerate(pts) if i == 0 or tuple(p) != tuple(pts[i - 1])] for pts in out]


def today_walks(ch: np.ndarray, ents: dict, patch: list) -> dict:
    """3.6.3's feel table on today's ground: BFS walks, the bridge patch off (gap rows Water) or on."""
    on, off = ch.copy(), ch.copy()
    for x, y in patch:
        on[y, x] = "="
    for x, y in patch[:4]:
        off[y, x] = "o"
    gate = tuple(patch[4])
    rows = [("south gate -> bridge gate", ents["cornelia"], gate, False),
            ("Cornelia -> Temple door", ents["cornelia"], ents["temple"], False),
            ("bridge -> Pravoka gate", gate, ents["a1_pravoka"], True),
            ("bridge -> Matoya's door", gate, ents["a1_matoya"], True)]
    return {n: int(bfs_dist(walk(on if br else off), [tuple(a)])[b[1], b[0]]) for n, a, b, br in rows}


def derive() -> str:
    doc = yaml.safe_load(SRC.read_text())
    ch = chars(doc)
    ents = {e: tuple(doc["entrances"][e]) for e in ACT1}
    box = lambda o: inbox(o.get("x", -1), o.get("y", -1))  # noqa: E731
    trans = [t for t in doc["transitions"] if box(t)]
    objs = [o for o in doc.get("objects") or [] if box(o)]
    patch = [tuple(c) for c in next(p for p in doc["patches"] if p["id"] == "north_bridge")["cells"]]
    dock = next(d for d in doc["docks"] if d["id"] == "a1_pravoka")
    seed = tuple(doc["world"]["basins"]["aldi"])
    jetty = []
    y = seed[1] - 1
    while ch[y, seed[0]] == "=":
        jetty.insert(0, (seed[0], y))
        y -= 1
    a = {
        "TEMPLATE_AT": rel(TPL[:2]),
        "ENTRANCES": {e: rel(c) for e, c in ents.items()},
        "TRANSITIONS": [moved(t) for t in trans],
        "GATES": [moved(g) for g in doc.get("keyItemGates") or []],
        "OBJECTS": [moved(o) for o in objs],
        "INSPECT": [moved(i) for i in doc.get("inspect") or [] if box(i)],
        "NPCS": [moved(n) for n in doc.get("npcs") or [] if box(n)],
        "VEHICLES": [moved(v) for v in doc.get("vehicles") or [] if box(v)],
        "SPOTS": {k: {"at": rel(v["at"]), "kind": v["kind"]} for k, v in doc["spots"].items() if k.startswith("a1_s_")},
        "BRIDGE_PATCH": [rel(c) for c in patch],
        "BRIDGE_GATE": rel(patch[4]),
        "BRIDGE_FOOT": rel(w(C.BRIDGE_FOOT)),
        "NORTH_SHORE": rel(w(C.NORTH_SHORE)),
        "JETTY": [rel(c) for c in jetty],
        "ALDI_SEED": rel(seed),
        "PRAVOKA_DOCK": rel((dock["x"], dock["y"])),
        "CITY_ICON": icon(objs, lambda o: (o["x"], o["y"]) == w((C.CX, C.CY))),
        "PRAVOKA_ICON": icon(objs, lambda o: o.get("name") == "pravoka"),
        "TEMPLE_ICON": icon(objs, lambda o: o.get("name") == "temple"),
        "PONDS": [rel(w(p)) for p in C.PONDS],
        "FOOTBRIDGE": [rel(w((C.RX, C.RY))), rel(w((C.RX + 1, C.RY)))],
        "CITY_FOOTBRIDGE": rel(w(C.FOOTBRIDGE)),
        "TOMB": rel(w(C.TOMB)),
        "TOMB_END": rel(w(C.TOMB_END)),
        "BOULDERS": [rel(w(b)) for b in C.BOULDERS],
        "CHANNEL": (*rel((CHANNEL_X[0], CHANNEL_ROWS[0])), *rel((CHANNEL_X[1], CHANNEL_ROWS[1]))),
        "SOUND_LINE": [rel(p) for p in SOUND_LINE],
        "SPINE": [rel(w(p)) for p in C.SPINE],
        "ROADS": [[rel(w(p)) for p in r] for r in roads(jetty)],
        "KEEP_RECTS": {k: (*rel(v[:2]), *rel(v[2:])) for k, v in KEEP_RECTS.items()},
        "TODAY_WALKS": today_walks(ch, ents, patch),
    }
    return render(a, template(ch))


HEADER = '''"""GENERATED by assets-src/tools/layouts/a1/world_a1_derive.py from today's world (docs/NATURAL_WORLD_PLAN.md
3.6.2; NW-3). Do not edit: re-run the script (`--check` fails when this file is stale).

Act 1's pins and stamps, every cell **Cornelia-relative** (rel = p_today - (92, 111); its NW world cell is
CORNELIA_NW + rel, `worldgen.spec.world`). `TEMPLATE` is act 1's template grid from `TEMPLATE_AT` (today's outline
and its kept cells): a legend char is a kept cell (copied as is), `#` regenerated land, a space regenerated sea.
`ROADS` are routed (2.4 rule 8) through their points, each gate road starting on its gate's warp cell; `TODAY_WALKS`
is 3.6.3's feel table measured on today's ground.
"""
# flake8: noqa: E501
'''


def render(a: dict, rows: list[str]) -> str:
    out = [HEADER]
    for k, v in a.items():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            out.append(f"{k} = [\n" + "".join(f"    {_lit(o)},\n" for o in v) + "]\n")
        else:
            out.append(f"{k} = {_lit(v)}\n")
    out.append("TEMPLATE = (\n" + "".join(f"    {json.dumps(r, ensure_ascii=False)},\n" for r in rows) + ")\n")
    return "".join(out)


def _lit(v) -> str:
    """A Python literal of plain data (dicts, lists, tuples, strings, numbers, booleans, None) on one line."""
    if isinstance(v, dict):
        return "{" + ", ".join(f"{_lit(k)}: {_lit(x)}" for k, x in v.items()) + "}"
    if isinstance(v, tuple):
        return "(" + ", ".join(_lit(x) for x in v) + ("," if len(v) == 1 else "") + ")"
    if isinstance(v, list):
        return "[" + ", ".join(_lit(x) for x in v) + "]"
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    return repr(v)


def main(argv: list[str]) -> int:
    text = derive()
    if "--check" in argv:
        ok = OUT.exists() and OUT.read_text() == text
        print(f"world_a1_pins: {'OK' if ok else 'STALE (re-run a1/world_a1_derive.py)'}")
        return 0 if ok else 1
    OUT.write_text(text)
    print(OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

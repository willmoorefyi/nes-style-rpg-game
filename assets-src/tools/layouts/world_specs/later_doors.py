"""Doors added after pass W's freeze (`today_doors_data.py` stays pass W's): (entrance, door offset, targetMap,
targetEntrance), the frozen doors whose target moved (pass CD, docs/CARDIA_PLAN.md 3.1, D-CD8b) and those whose
offset moved (PT-5, `REDOOR`). `world_source`'s
`doors()` and `transitions()` read them after the frozen ones."""
from __future__ import annotations

# pass CD: a cave on every named Cardia islet but the hermit's (ruling R1), each a stair into Cardia Deep
DOORS = [("ord_isle_north", (0, -1), "cardia-deep", "north"),
         ("ord_isle_east", (0, -1), "cardia-deep", "east"),
         ("ord_isle_stack", (0, -1), "cardia-deep", "stack"),
         ("ord_isle_west", (0, -1), "cardia-deep", "west"),
         # PT-5 (docs/PLAYTEST_ELFHEIM_PLAN.md): Elfheim's side doors, the icon's middle-row side cells, each entered
         # from its arrival beside the icon (written after the south door: `wayOutSearch` takes the first)
         ("elf_elfheim_west", (1, 0), "elfheim", "west_gate"),
         ("elf_elfheim_east", (-1, 0), "elfheim", "east_gate")]
# PT-5: frozen doors whose offset from their entrance moved. Elfheim's door is the icon's bottom-middle cell, where its
# art draws the gate, north of the arrival (pass W's offset (0, 1) put it on the icon's top, entered from above)
REDOOR = {"elf_elfheim": (0, -1)}
# pass CD: Bahamut's frozen door (pass W: bahamut-cave arrival) now leads to the Sea Gate of Cardia Deep
RETARGET = {"ord_bahamut": ("cardia-deep", "bahamut_gate")}


def doors(off: dict, target: dict) -> tuple[dict, dict]:
    """The frozen (entrance -> door offset, entrance -> door targetMap) with the later doors added and RETARGET
    applied to the second (it feeds prewalk and dock_towns)."""
    off, target = dict(off), dict(target)
    off.update(REDOOR)
    for e, o, m, _te in DOORS:
        off[e], target[e] = o, m
    for e, (m, _te) in RETARGET.items():
        if e in target:
            target[e] = m
    return off, target


def transitions(frozen: list[dict], sites: dict) -> list[dict]:
    """The frozen transitions (each with its `_entrance`) retargeted, then one per DOORS row at its site + offset."""
    out = []
    for t in frozen:
        e = t.get("_entrance")
        if e in RETARGET:
            t = {**t, "targetMap": RETARGET[e][0], "targetEntrance": RETARGET[e][1]}
        if e in REDOOR:
            t = {**t, "x": int(sites[e][0] + REDOOR[e][0]), "y": int(sites[e][1] + REDOOR[e][1])}
        out.append(t)
    for e, (dx, dy), m, te in DOORS:
        out.append({"x": int(sites[e][0] + dx), "y": int(sites[e][1] + dy), "targetMap": m, "targetEntrance": te})
    return out

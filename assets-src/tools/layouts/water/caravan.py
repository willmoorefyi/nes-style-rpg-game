"""The caravan camp (docs/WORLD_PLAN.md 4.6; WAT-O) -> assets-src/maps/caravan-camp.yaml.

  python3 -I assets-src/tools/layouts/water/caravan.py && python3 -I assets-src/tools/build_map.py caravan-camp

One outdoor map, 26x18: a hollow in the dunes walled by wind-cut rock, entered from the tent on the overworld
(`wat_caravan`). Three tents, a cook fire, a spring pool under two trees, and the trader's awning on the east side,
where the bottle is sold (S22: `takeGold` 5000, `giftItem: fairy_bottle`; INT tunes the price by proof (d3)). Five
people: the trader, the caravan master (hints at Gaia), a scout (hints at the waterfall), a drover and the cook.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Grid, write_map  # noqa: E402
from kit import landmark_parts  # noqa: E402

MAP, W, H = "caravan-camp", 26, 18
GAP = (12, 13)                                   # the way out on the bottom row, back to the tent on the dunes
BOTTLE_PRICE = 5000                              # 4.6's default; INT tunes it by proof (d3)
HEADER = """Concept: the caravan's winter camp in a hollow of the dunes, sheltered by wind-cut rock: three tents, a cook
  fire, a spring pool under two trees, and the trader's awning where the glowing bottle is sold.
Distinct: a spring pool with trees inside the rock ring; the trader's awning behind a row of crates; a cook fire
  between the tents.
Topology: one map, no stairs: the gap in the rock ring (south) -> the camp floor; the pool lies west, the awning
  east. No boss.
legend: m wind-cut rock  s sand  . grass  ≈ spring pool"""


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


NPCS = [
    npc("trader", "merchant", 19, 11, [
        {"condition": "WAT_O_BOTTLE_BOUGHT",
         "text": ["Mind how you carry it. Whatever sleeps in there has been asleep a long while."]},
        {"text": ["A bottle stoppered with sea-wax. Shake it and something inside lights up and sulks.",
                  f"I won't haggle: {BOTTLE_PRICE} gil, coin on the crate. Come back when your purse is heavier "
                  "if it isn't."]}],
        tint="#d8b070", takeGold=BOTTLE_PRICE, giftItem="fairy_bottle", giftFlag="WAT_O_BOTTLE_BOUGHT"),
    npc("caravan_master", "old_man", 12, 7, [
        {"condition": "WAT_O_BOTTLE_BOUGHT",
         "text": ["You bought the bottle? Then take it east, to Gaia in the high peaks. Their spring is dry, and "
                  "something in that glass wants water."]},
        {"text": ["We walk the coast from thaw to frost and sell what the sea throws up.",
                  "The best of it is the trader's bottle. Folk in Gaia, beyond the eastern peaks, would weep to see "
                  "it."]}]),
    npc("scout", "thief", 7, 13, [
        "I've walked every mile of this coast but one: the gorge above Onrac. The river fills it wall to wall.",
        "Nobody walks to the waterfall. You'd need a boat light enough to carry."], tint="#a0b8c8"),
    npc("drover", "farmer", 16, 14, [
        "Keep to the packed sand between the dunes. The soft hollows are where the worms wait.",
        "The beasts smell them before we do. When they stamp, we turn back."], wander=True),
    npc("cook", "villager_f", 10, 9, [
        "Fish stew again. The spring by the trees is sweet, mind, the only sweet water for a week's walk."]),
]


def build() -> tuple[Grid, list[dict]]:
    g = Grid(W, H, "m")
    g.rect(2, 2, W - 3, H - 2, "s")
    g.rect(1, 6, 1, 12, "s")
    g.rect(W - 2, 5, W - 2, 10, "s")
    for x in GAP:
        g.set(x, H - 1, "s")
    g.rect(2, 10, 7, 14, ".")                    # the spring meadow ...
    g.rect(3, 11, 5, 12, "≈")                    # ... and its pool
    objs: list[dict] = []
    for tx, ty in ((3, 3), (9, 2), (15, 3)):
        objs.append({"type": "deco", "parts": landmark_parts("tent"), "x": tx, "y": ty, "style": "dune"})
    objs.append({"type": "deco", "parts": [["stall_0_0", "stall_0_1"], ["stall_1_0", "stall_1_1"]], "x": 19, "y": 8})
    objs.append({"type": "deco", "parts": [["brazier"]], "x": 12, "y": 9})
    for x, y in ((17, 10), (17, 11), (21, 11), (22, 7)):
        objs.append({"type": "deco", "parts": [["crate"]], "x": x, "y": y})
    for x, y in ((14, 12), (6, 6), (21, 4)):
        objs.append({"type": "deco", "parts": [["barrel"]], "x": x, "y": y})
    for x, y in ((2, 9), (6, 12)):
        objs.append({"type": "deco", "parts": [["oak_0_0", "oak_0_1"], ["oak_1_0", "oak_1_1"], ["oak_2_0", "oak_2_1"]],
                     "x": x, "y": y - 2, "above_rows": 1})
    return g, objs


def main() -> None:
    g, objs = build()
    doc = {"id": MAP, "name": "Caravan Camp", "kits": ["overworld", "town", "temple"], "music": "town",
           "entrances": {"arrival": [GAP[0], H - 2]}, "objects": objs, "npcs": [dict(n) for n in NPCS],
           "transitions": [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "wat_caravan"} for x in GAP],
           "encounterRate": {"min": 999, "max": 999}, "encounters": [], "canSave": True,
           "no_static_chokepoints": True, "no_unreachable_walkable": True}
    print(write_map(MAP, "GENERATED by assets-src/tools/layouts/water/caravan.py - edit the script, not this file.\n"
                    + HEADER, doc, g.text()))


if __name__ == "__main__":
    main()

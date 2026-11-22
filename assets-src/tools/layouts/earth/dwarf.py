"""The dwarf hall under the Duergar isthmus (docs/WORLD_PLAN.md 4.0.1 `dwarf` row, 4.3; ERT-O) -> assets-src/maps/
dwarf-hall.yaml. One 40x30 cave map: a long hall with three rooms off its north side (Smyth's forge, the drafting room
where Nerrick keeps the canal plans, the store), the way out to the overworld (`ert_dwarf`) at the south.

Nerrick takes the TNT through his cutscene `ert_canal_blast` (CANAL_OPEN); Smyth forges `excalibur` from `adamant`
(`ert_smyth_forge`, S31, optional). Thirteen dwarves talk, nine change their lines on CANAL_OPEN, two are hint NPCs
(`canal`, `Melmond`); the store keeper sells `dwarf_item` across a wall-to-wall counter.

  python3 -I assets-src/tools/layouts/earth/dwarf.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room  # noqa: E402
from kit import remap  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
LEGEND = "legend: W rock  F rock face  - hewn floor  _ plank floor  % rubble  c counter"
CAVE = remap("cave")                                     # the brown temple stone of 4.9 ("cave remap")
MATS = {"floor_stone": CAVE, "rubble": {**remap("cave", "temple_rubble"), "shade": 1.3},
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.35},
        "in_wall_face": {"from": "dwf_wall"}, "floor": {"from": "floor", "shade": 0.8}}
NOTE = ("Concept: the dwarves' hall hewn under the isthmus, a working mine town in one cave: a long hall, the forge, "
        "the drafting room and the store off its north wall.\n"
        "Distinct: the canal plans spread on the drafting table where the foreman keeps watch over them; the store "
        "sells across a wall-to-wall counter cut from the living rock; crates of ore stand along the hall's south "
        "wall, with a heap of sorted ore and a slag pile at either end.\n"
        "Topology: one map, no stairs: overworld (ert_dwarf) -> hall -> forge | drafting room | store; exit south.")
DWARF = "#b08860"                                        # the dwarves' ruddy tint on the human field sheets
OPEN = "CANAL_OPEN"
# S31 (optional, after S27): Smyth's forge trade (cutscene `ert_smyth_forge`): the adamant from the sky castle's 3F
# vault chest (CHEST_WND_D2_ADAMANT) for Excalibur, as soon as the party brings it (user ruling 2026-11-18: the
# classic order, no wind-crystal gate; the adamant is not one of S28's grants, so the seraph may still stand)
SMYTH_TRADE: dict = {"cutscene": {"id": "ert_smyth_forge", "onceFlag": "ERT_O_SWORD_FORGED"}, "requiredItem": "adamant"}


def say(*lines: str) -> list[str]:
    return list(lines)


def when(flag: str, lines: list[str], default: list[str], item: str | None = None, held: list[str] | None = None) -> list:
    d = [{"condition": flag, "text": lines}]
    if item:
        d.append({"condition": f"item:{item}", "text": held})
    return d + [{"text": default}]


def build() -> Path:
    r = Room("dwarf-hall", "Dwarf Hall", 40, 30)
    g = r.g
    g.carve(2, 4, 11, 10)                                # Smyth's forge
    g.carve(14, 4, 25, 9, "_")                           # the drafting room
    g.carve(28, 4, 37, 10)                               # the store
    g.carve(3, 14, 36, 26)                               # the hall
    for x0, y0, x1, y1 in ((6, 11, 7, 13), (19, 10, 20, 13), (32, 11, 33, 13), (19, 27, 20, 29)):
        g.carve(x0, y0, x1, y1)
    g.carve(8, 24, 9, 25, "%")
    g.carve(29, 16, 31, 16, "%")
    g.carve(28, 7, 37, 7, "c")                           # the store counter, wall to wall
    g.faces(2)
    deco, obj = r.deco, r.objects.append
    deco([["dwf_forge_0_0", "dwf_forge_0_1"], ["dwf_forge_1_0", "dwf_forge_1_1"]], 5, 2, on_wall=True)   # the forge
    deco([["weapon_rack"]], 9, 3, on_wall=True)
    deco([["torch"]], 3, 3, on_wall=True)
    deco([["dwf_anvil_0_0"]], 5, 6)                      # Smyth's anvil
    deco([["armor_stand"]], 10, 5)
    obj({"type": "barrel", "x": 2, "y": 9})
    obj({"type": "barrel", "x": 3, "y": 9})
    deco([["map_table_l", "map_table_r"]], 19, 5)        # the canal plans
    deco([["banner"]], 16, 3, on_wall=True)
    deco([["banner"]], 23, 3, on_wall=True)
    deco([["lectern"]], 15, 5)
    deco([["globe"]], 24, 5)
    for x in (29, 31, 34, 36):
        deco([["potion_shelf"]], x, 3, on_wall=True)
    obj({"type": "crate", "x": 28, "y": 5})
    obj({"type": "barrel", "x": 37, "y": 5})
    for x in (12, 26):
        deco([["torch"]], x, 12, on_wall=True)
    for x in (16, 23):
        deco([["dwf_king_0_0"], ["dwf_king_1_0"]], x, 14)   # two dwarf-kings flank the drafting room's door
    for x, y in ((9, 17), (30, 19)):
        deco([["dwf_pillar_0_0"], ["dwf_pillar_1_0"]], x, y, fit=True)   # AR-W2: the granite hall's own art
    for x, y in ((6, 26), (35, 26)):
        obj({"type": "crate", "x": x, "y": y})
    for x in (4, 33):
        deco([["dwf_cart_0_0", "dwf_cart_0_1"], ["dwf_cart_1_0", "dwf_cart_1_1"]], x, 25, collide="alpha")  # ore carts
    deco([["gold_heap"]], 36, 22)                        # a heap of sorted ore
    deco([["skulls"]], 3, 22)                            # the slag of a bad seam
    npc = lambda i, s, x, y, d, **kw: r.npcs.append({"id": i, "sprite": s, "x": x, "y": y, "dialog": d, "tint": DWARF, **kw})  # noqa: E731
    npc("ert_nerrick", "burgher", 21, 7, when(
        OPEN, say("Hear that hiss? That's the sea in my canal! Forty years of chalk, and it's water at last.",
                  "Your ship can run west through the cut now. The strait is beyond, and Melmond past it."),
        say("Nerrick, foreman. Those are the canal plans. Forty years I've redrawn them, and the saddle still stands.",
            "Picks just ring off it. Fire can't crack it. We need something that bursts the rock from inside."),
        "tnt", say("Is that blasting powder? Sealed and dry, too! Give it here before I wake from this dream!")),
        cutscene={"id": "ert_canal_blast", "onceFlag": OPEN}, requiredItem="tnt")
    npc("ert_dwarf_scribe", "old_man", 16, 7, when(
        OPEN, say("I'm inking the plans at last as built, not as hoped. That's a pleasure I never expected."),
        say("Every line on that table has been rubbed out and drawn again. The saddle beat us every time.")))
    smyth = say("Smyth, smith of this hall. My anvil has gone quiet for want of a metal worth hitting.",
                "Bring me ore from a place nearer the stars than the earth, and I'll show you what a dwarf can forge.")
    npc("ert_smyth", "monk", 7, 6, when(
        "ERT_O_SWORD_FORGED", say("Mind the edge. I'll never make a keener thing, and I don't mean to try."), smyth,
        "adamant", say("That ore is singing! Hand it over, and stand well back from the fire."))
        if SMYTH_TRADE else smyth, **SMYTH_TRADE)
    npc("ert_dwarf_bellows", "thief", 4, 8, say("I work the bellows. Smyth says one day I'll strike, too. One day."))
    npc("ert_dwarf_canal_hint", "farmer", 12, 18, when(
        OPEN, say("The canal's open, and the ships of the Aldi can reach the open sea at last."),
        say("Nerrick's canal would join our sea to the ocean, but nothing we have can break the saddle.",
            "They say the elves keep a powder that splits stone. It's locked away in Elfheim's vault.")))
    npc("ert_dwarf_melmond_hint", "burgher", 27, 22, when(
        OPEN, say("West through the canal, then across the strait: that's Melmond. Ask there about the rot.",
                  "The Cavern of Earth lies south-west of the town. Something in it is drinking the land."),
        say("Across the western water is Melmond, farm country. Their fields have gone grey, I hear.",
            "We could sail there in a morning if the canal were cut.")))
    npc("ert_dwarf_miner_a", "farmer", 8, 20, when(
        OPEN, say("Back to honest digging now the saddle's gone. Ore doesn't fight back."),
        say("I've broken six picks on that saddle. Six!")), wander=True)
    npc("ert_dwarf_miner_b", "villager", 25, 18, say("Mind the carts. They roll when you least expect it."), wander=True)
    npc("ert_dwarf_cook", "villager_f", 31, 24, when(
        OPEN, say("Fresh fish from the canal tonight! I'd forgotten what anything but cave mushrooms tastes like."),
        say("Mushroom stew again. Don't make that face; it's good for your beard.")))
    npc("ert_dwarf_child", "villager_f", 15, 23, say("When I'm grown I'll dig a tunnel all the way to the moon."), wander=True)
    npc("ert_dwarf_elder", "old_man", 5, 16, when(
        OPEN, say("I felt the blast in my bones. The mountain sighed, as if it had waited for it too."),
        say("Our people came to this hall when the sea was still young. We have been patient.")))
    npc("ert_dwarf_sentry", "guard", 22, 26, when(
        OPEN, say("The landing will be busy now. I'll be checking every boat."),
        say("You came by the landing cove, or across the downs from the south? Either way, welcome.")))
    npc("ert_dwarf_lookout", "warrior", 35, 16, when(
        OPEN, say("From the ridge I watched the water run through. White foam, then calm. Beautiful."),
        say("I keep watch on the ridge. Nothing moves on the Aldi I don't see.")))
    r.npcs.append({"id": "dwarf-item-keeper", "sprite": "merchant", "x": 33, "y": 6, "tint": DWARF,
                   "dialog": ["Rope, lamps, tonics! Everything a body needs underground."], "shopId": "dwarf_item"})
    staff = [[x, y] for y in range(4, 7) for x in range(28, 38)]
    r.transitions += [{"x": x, "y": 29, "targetMap": "overworld", "targetEntrance": "ert_dwarf"} for x in (19, 20)]
    return r.write(NOTE, {"arrival": [19, 28]}, kits=KITS, mats=MATS, trim=None,
                   quiet={"encounterRate": {"min": 999, "max": 999}, "encounters": []}, script="earth/dwarf.py",
                   legend=LEGEND, music="town", extra={
                       "no_static_chokepoints": True, "no_unreachable_walkable": True, "unreachable_ok": staff,
                       "contrast": [{"a": "W", "b": "-", "min": 0.2}],
                       "exit": {"map": "overworld", "entrance": "ert_dwarf"}})


if __name__ == "__main__":
    print(build())

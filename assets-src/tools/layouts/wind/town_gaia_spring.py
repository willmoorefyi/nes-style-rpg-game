"""Gaia's spring (docs/WORLD_PLAN.md 4.7, S23; WND-T) -> assets-src/maps/gaia-spring.yaml: the high hollow behind the
town's top terrace, reached through the grotto in the spring court's cliff. Written by `town_gaia_interiors.py`.

The fairy (S23): the spring warden by the dry basin has `requiredItem: fairy_bottle` and the cutscene
`wnd_fairy_freed` (onceFlag FAIRY_FREED), which takes the bottle, sets FAIRY_FREED and gives `oxyale` (Melmond's Unne
and the dwarves' Nerrick do the same: an NPC's `takeItem` would take the bottle before the cutscene could check for
it). The cutscene warps the party to the hollow's path behind its fade, so the map reloads with the patch
`wnd_spring_flows` (FAIRY_FREED: the dry basin fills, Water) and the freed fairy (`showIf: FAIRY_FREED`) in place.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from common import Grid, polygon_mask, write_map  # noqa: E402
from town_common import Outdoor  # noqa: E402
from town_gaia_people import BOTTLE, FREED, when  # noqa: E402

W, H = 22, 17
ARRIVAL = (10, 14)                               # from gaia's top terrace (the grotto's passage)
EXIT = [(10, H - 1), (11, H - 1)]                # back down the passage to gaia `spring`
BASIN = (8, 5, 13, 7)                            # the dry basin (inclusive), filled by the patch
AFTER = (10, 11)                                 # where the cutscene leaves the party, facing the basin
FLOWS = "wnd_spring_flows"
NOTE = """Concept: a hollow open to the sky high in the rock behind the town, a dry basin under a carved spring-stone, the
warden keeping watch beside it.
Distinct: a dry basin of pale sand that fills with water when the fairy is freed; the spring-stone, a carved figure
standing at the basin's head; two signposts hung with ribbons beside the basin; snowed pines round the hollow's rim; a narrow
flagged passage down through the rock to the spring court.
Topology: one map, the passage from gaia's spring court (arrival) -> the hollow round the basin; a dead end."""

g = Grid(W, H, "m")
HOLLOW = [(4, 3), (17, 3), (19, 6), (18, 11), (14, 13), (12, 13), (12, 16), (9, 16), (9, 13), (6, 13), (2, 10),
          (2, 6)]
inside = polygon_mask(W, H, HOLLOW)
for y in range(H):
    for x in range(W):
        if inside[y][x]:
            g.set(x, y, ".")
g.rect(10, 12, 11, H - 1, ":")                   # the passage up from the court
g.rect(BASIN[0], BASIN[1], BASIN[2], BASIN[3], "s")   # the dry basin
g.rect(9, 8, 12, 11, ":", only=".")              # the flagged apron in front of it

hollow = Outdoor()
obj, deco = hollow.obj, hollow.deco
STONE = (10, 3)                                  # the spring-stone (statue, 2 cells tall) at the basin's head
deco([["statue_top"], ["statue_bottom"]], STONE[0], STONE[1])
for (x, y) in [(5, 5), (16, 5), (4, 9), (17, 9)]:
    deco([["tree_crown"], ["tree_trunk"]], x, y - 1, above_rows=1, style="snow")
for (x, y) in [(7, 4), (14, 4)]:
    obj(type="signpost", x=x, y=y)               # the ribbon posts
for (x, y) in [(6, 7), (15, 7), (7, 11), (14, 11), (13, 12)]:
    obj(type="flowers", x=x, y=y)
for (x, y) in [(3, 7), (18, 7)]:
    obj(type="bush", x=x, y=y)

INSPECT = [
    {"x": STONE[0], "y": STONE[1] + 1, "text": [
        {"condition": FREED, "text": ["Water wells up at the armoured stone figure's feet and runs singing into the basin."]},
        {"text": ["The spring-stone is a figure in stone armour, its feet worn smooth where the water once welled up.",
                  "The stone is bone dry, and cold to the touch."]}]},
    {"x": 7, "y": 4, "text": [
        {"condition": FREED, "text": ["The ribbons stream out sideways from the post, every one of them pulling."]},
        {"text": ["A post hung with prayer ribbons, one for every family in Gaia. They hang straight down."]}]},
]
PATCH = {"id": FLOWS, "flag": FREED, "ground": "~",
         "cells": [[x, y] for y in range(BASIN[1], BASIN[3] + 1) for x in range(BASIN[0], BASIN[2] + 1)]}
WARDEN = {"id": "wnd_fairy_freed", "onceFlag": FREED}


def npcs() -> list[dict]:
    return [
        {"id": "gaia_spring_warden", "sprite": "white_mage", "x": 8, "y": 9, "requiredItem": "fairy_bottle",
         "cutscene": WARDEN, "tint": "#d8e8c8", "dialog": when(
             (FREED, ["A whole year I sat by a dry stone. Now I'll sit by a wet one and complain about the splashing.",
                      "She gave you her breath of the spring, didn't she? Drink it under the sea and you'll breathe."]),
             (BOTTLE, ["That bottle... the light in it is pressing against the glass towards the basin. It knows "
                       "home.", "Unstop it over the spring, quickly, before it breaks its own heart."]),
             default=["I am the warden of the spring. It ran from that stone for longer than Gaia has stood.",
                      "Its fairy lived in the water. A year ago a trader's caravan came through, all bright glass, "
                      "and she followed the shine.", "The caravan went west, to the desert. If you ever see a bottle "
                      "with a light inside it, bring it here."])},
        {"id": "gaia_fairy", "sprite": "fairy", "x": 12, "y": 9, "showIf": FREED,     # LM5-INT: her own sheet
         "dialog": ["Mm? Oh, it's you. I'm still getting the glass out of my wings.",
                    "Remember: one drink of the Oxyale, and the sea lets you breathe as long as you keep moving. "
                    "Onrac's divers will know where the sunken shrine lies."]},
        {"id": "gaia_spring_novice", "sprite": "villager_f", "x": 13, "y": 10, "dialog": when(
            (FREED, ["I filled the first jug for the town myself. My arms are shaking. It's only water. It's not only "
                     "water."]),
            default=["I sweep the basin every morning so the spring will find it clean. The warden says it's "
                     "manners."])},
    ]


def build() -> Path:
    doc = {
        "id": "gaia-spring",
        "name": "Gaia Spring",
        "kits": ["town", "castle", "overworld"],
        "music": "town",
        "entrances": {"arrival": list(ARRIVAL)},
        "objects": hollow.objects,
        "npcs": npcs(),
        "inspect": INSPECT,
        "transitions": [{"x": x, "y": y, "targetMap": "gaia", "targetEntrance": "spring"} for (x, y) in EXIT],
        "patches": [PATCH],
        "encounterRate": {"min": 999, "max": 999},
        "encounters": [],
        "canSave": True,
        "no_static_chokepoints": True,
        "no_unreachable_walkable": True,
    }
    header = f"""GENERATED by assets-src/tools/layouts/wind/town_gaia_interiors.py - edit the script, not this file.
{NOTE}
ground legend: . moss  : flagstones  s the dry basin (sand; Water after FAIRY_FREED)  m mountain rock"""
    return write_map("gaia-spring", header, doc, g.text())

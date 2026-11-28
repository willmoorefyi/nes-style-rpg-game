"""Elfheim Castle (docs/WORLD_PLAN.md 4.2, stages S8 and S9; ELF-T), original layouts ->
assets-src/maps/elfheim-castle.yaml, elfheim-castle-chamber.yaml, elfheim-vault.yaml.

  python3 -I assets-src/tools/layouts/elf/town_elfheim_rooms.py

  elfheim-castle          the hall on the rise, entered from the town's north gate: the prince's empty throne at its
                          head, the stair up to his chamber in the north-west, the stair down to the vault in the
                          south-east behind a gate of living wood (keyItemGates: mystic_key, permanent, ELF_T_VAULT_OPEN)
  elfheim-castle-chamber  the prince on his bier; with Matoya's herb, talking to him plays `elf_prince_wakes` (takes the
                          herb, gives the Mystic Key, sets PRINCE_AWAKE); then the woken prince stands in his place
  elfheim-vault           the vault: the dwarves' TNT (CHEST_ELF_T_TNT) and two B3 chests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from common import Room as BaseRoom  # noqa: E402
from town_elfheim_people import AWAKE, HERB, talk  # noqa: E402

KITS = ["castle", "interior", "town"]
MATS = {"floor_stone": {"from": "marble", "shade": 0.9}, "in_wall_face": {"from": "castle_wall_in", "shade": 0.9},
        "in_wall_top": {"from": "slate", "shade": 0.5}, "floor": {"from": "floor", "shade": 0.85},
        "carpet": {"from": "carpet", "hue": 120, "sat": 0.7, "shade": 0.85}}      # the green runner
TRIM = [120, 170, 110]                           # leaf green and silver
LEGEND = "legend: W wall top  F wall face  - marble  _ wood floor  + green runner"
QUIET = {"encounterRate": {"min": 999, "max": 999}, "encounters": [], "no_static_chokepoints": True,
         "no_unreachable_walkable": True}
VAULT_FLAG = "ELF_T_VAULT_OPEN"
PRINCE = {"id": "elf_prince_wakes", "onceFlag": AWAKE}


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, extra: dict | None = None):
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=TRIM, quiet=QUIET,
                             script="elf/town_elfheim_rooms.py", legend=LEGEND, extra=extra)


def note(concept: str, distinct: str, topology: str) -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_elf_t_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_ELF_T_{cid.upper()}", "dialog": [f"You found {label}!"]}


def hall() -> Path:
    r = Room("elfheim-castle", "Elfheim Castle", 26, 20)
    g = r.g
    g.carve(3, 4, 22, 16)                        # the great hall
    g.carve(12, 4, 13, 18, "+")                  # the runner from the door to the throne
    g.carve(12, 17, 13, 19)                      # the door passage, out to the rise
    g.faces(2)
    r.stairs_up(4, 2, "elfheim-castle-chamber", "door")          # up to the prince's chamber
    r.stairs_down(20, 14, "elfheim-vault", "door")               # down to the vault, behind the living gate
    r.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 12, 4)
    for x in (8, 17):
        r.wall([["arch_window_top"], ["arch_window_bottom"]], x, 2)
    for x in (10, 15):
        r.wall([["banner"]], x, 2)
    r.wall([["tapestry"]], 20, 2)
    for x, y in ((6, 8), (19, 8), (6, 13), (19, 13)):
        r.pillar(x, y)
    for x, y in ((3, 16), (22, 4), (11, 4), (14, 4)):
        r.deco([["plant"]], x, y)
    r.transitions += [{"x": x, "y": 19, "targetMap": "elfheim", "targetEntrance": "north_gate"} for x in (12, 13)]
    r.npcs += [
        {"id": "elfheim_steward", "sprite": "elf_elder", "x": 10, "y": 6, "dialog": talk(
            ["The throne has stood empty a year. I dust it every morning and do not sit in it.",
             "The prince sleeps upstairs, by the west stair. Visitors may look in. Nobody has woken him."],
            herb=["That herb... Matoya's? Up the west stair, friend, and hold it under his nose. Hurry!"],
            awake=["The prince sat on his throne this morning and fell asleep in it. Only for a nap, he said. "
                   "I nearly fainted."])},
        {"id": "elfheim_hall_guard", "sprite": "elf_guard", "x": 15, "y": 11, "dialog": talk(
            ["The stair in the corner goes down to the vault. The gate is grown shut; only the prince's key opens it."],
            awake=["The prince's key opens the living gate to the vault. If he gave it to you, you may pass."])},
        {"id": "elfheim_lady", "sprite": "elf_woman", "x": 8, "y": 11, "wander": True, "dialog": talk(
            ["We hold court without a prince. It is mostly sighing."],
            awake=["Court is lively again! The prince has already quarrelled with the steward twice."])},
        {"id": "elfheim_court_mage", "sprite": "elf_mage", "x": 17, "y": 7, "dialog": talk(
            ["Astos's gift box held no poison and no blade, only sleep, folded very small.",
             "I can unfold most curses. Not that one. It wants the bitter herb of a human witch."],
            awake=["Matoya's herb, and gone in a breath. I'll write to her. Respectfully."])},
    ]
    gate = {"requiredItem": "mystic_key", "flag": VAULT_FLAG, "permanent": True, "message": [
        {"condition": AWAKE, "text": ["The living gate stirs at the stair but does not open. It wants the prince's key."]},
        {"text": ["A gate of living wood is grown across the stair down. Its lock is a knot shaped like a leaf."]}]}
    keys = [{"x": x, "y": 14, **gate} for x in (20, 21)]
    return r.write(note("the elven castle's hall on the rise: an empty throne, a stair up and a stair down",
                        "the prince's throne left empty at the head of a green runner, potted ferns at its sides; the "
                        "stair down to a vault beneath the hall, sunk in the floor beside the south-east pillar",
                        "the hall -> the chamber (stair up, north-west) and the vault (stair down, south-east, behind "
                        "the Mystic Key gate); the door is the way out"),
                   {"gate": [12, 18], "chamber": [4, 4], "vault": [20, 13]}, extra={"keyItemGates": keys})


def chamber() -> Path:
    r = Room("elfheim-castle-chamber", "The Prince's Chamber", 14, 10)
    g = r.g
    g.carve(1, 3, 12, 8, "_")
    g.carve(6, 3, 9, 6, "+")                     # the bier's carpet
    g.faces(2)
    r.stairs_down(2, 7, "elfheim-castle", "chamber")
    for x in (6, 9):
        r.wall([["torch"]], x, 1)
    r.wall([["window_in"]], 11, 1)
    r.deco([["orb_white"]], 6, 3)
    r.deco([["orb_white"]], 9, 3)
    r.tall("bed", 12, 3)
    r.deco([["plant"]], 1, 3)
    r.deco([["table"]], 12, 8)
    r.npcs += [
        {"id": "elfheim_prince", "sprite": "elf_prince", "x": 7, "y": 4, "hideIf": AWAKE,
         "requiredItem": "herb", "cutscene": PRINCE, "dialog": [
             {"condition": HERB, "text": ["The prince sleeps on his bier. The herb in your pack smells sharp enough to "
                                          "wake a stone. You crush a leaf beneath his nose..."]},
             {"text": ["The prince lies on his bier, breathing slow and deep. Nothing you say reaches him.",
                       "A faint frost of dark elf magic rimes his eyelashes."]}]},
        {"id": "elfheim_prince_awake", "sprite": "elf_prince", "x": 7, "y": 4, "showIf": AWAKE, "dialog": [
            "The key opens the living gate below the hall. Take whatever the vault holds that helps you.",
            "If the dwarves of the strait still want blasting powder, there is a cask of it down there. Astos never "
            "found it; that is something."]},
        {"id": "elfheim_nurse", "sprite": "elf_woman", "x": 10, "y": 6, "dialog": talk(
            ["I turn his pillow, I open the window, I sing. He sleeps on.",
             "The court mage says only a human witch's herb could break it. Matoya's, he means."],
            herb=["Is that the herb? Oh, please, try it. Hold it close to him."],
            awake=["He sent me to bed for the first time in a year. I don't know what to do with a bed."])},
        {"id": "elfheim_chamber_guard", "sprite": "elf_guard", "x": 4, "y": 4, "dialog": talk(
            ["I've stood here since the curse. If he wakes, I want to be the first face he sees."],
            awake=["He saw my face first. He said I needed a shave. Best day of my life."])},
    ]
    return r.write(note("the prince's chamber, his bier between two white orbs under a torchlit wall",
                        "a carpeted bier between two orbs where the prince lies; a nurse's bed in the corner",
                        "one room; the stair down to the hall is the only way in or out"),
                   {"door": [2, 6]})


def vault() -> Path:
    r = Room("elfheim-vault", "Elfheim Vault", 12, 10)
    g = r.g
    g.carve(1, 4, 10, 8, "-")
    g.faces(2)
    r.stairs_up(5, 2, "elfheim-castle", "vault")
    r.deco([["gold_heap"]], 1, 4)
    r.deco([["crown_cushion"]], 10, 4)
    r.objects += [{"type": "barrel", "x": 10, "y": 8}, {"type": "crate", "x": 1, "y": 8}]
    r.wall([["torch"]], 3, 2)
    r.wall([["torch"]], 8, 2)
    r.npcs += [chest("tnt", "tnt", "the TNT", 8, 6), chest("ether_gauntlet", "copper_gauntlet", "a Copper Gauntlet", 2, 6),
               chest("phoenix", "phoenix_down", "a Phoenix Down", 9, 8)]
    return r.write(note("the elven vault under the hall: the old treasury, a few chests left",
                        "a heap of old elven gold no one has counted; a cushion for a crown that went to the war",
                        "one room; the stair up to the hall is the only way in or out"),
                   {"door": [5, 4]})


def build() -> list[Path]:
    return [hall(), chamber(), vault()]


if __name__ == "__main__":
    for p in build():
        print(p)

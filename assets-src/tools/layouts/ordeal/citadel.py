"""The Citadel of Trials (docs/WORLD_PLAN.md 4.5, stage S18; ORD-O), original layouts -> assets-src/maps/citadel-*.yaml.

  python3 -I assets-src/tools/layouts/ordeal/citadel.py && python3 -I assets-src/tools/build_map.py citadel-1f citadel-2f citadel-3f

  citadel-1f  the empty court: a stone steward kneels beside a vacant throne, holding its stone crown out in both hands;
              set the crown back on the throne (cutscene `ord_throne_wakes`, flag ORD_O_THRONE) and the arch to the west
              wing and its stair opens; an east hall with two store nooks; the one-way stair from 3F comes out in the court
  citadel-2f  the start ring round a lattice of six pads (transitions within the map): two lead on into the north hall
              with the stair up, four throw the walker back to the ring; the hall's own pad also returns to the ring
  citadel-3f  the trial hall: the arrival in the east, the guardian (dragon_zombie) far to the west inside a ring of
              statues; its fall gives the ordeal seal (`ord_seal_won`) and opens the stair behind it down to 1F
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["castle", "interior", "temple", "town"]
MATS = {"floor_stone": {"from": "temple_floor", "shade": 0.95, "hue": 20, "sat": 0.6},
        "in_wall_face": {"from": "temple_wall_face", "shade": 0.95, "sat": 0.5},
        "in_wall_top": {"from": "slate", "shade": 0.4}, "rubble": {"from": "temple_rubble", "shade": 0.9}}
TRIM = [150, 170, 200]                        # the pads' cold blue-grey rim
LEGEND = "legend: W wall top  F wall face  - flagstone  + rune pad / runner  % rubble"
NOTE = ("Concept: a citadel cut into a mountain for one purpose, to test whoever climbs it, and long empty of anyone but "
        "its stone steward and its last guardian.\n"
        "Distinct: a stone steward who holds the empty throne's crown, and the arch opens only when the throne is "
        "crowned again; the pad lattice is an open grid seen whole from the ring, its pads set in blind stubs; the "
        "guardian is woken by three mummified keepers who fight beside it; a one-way stair from the trial hall back "
        "down to the court.\n"
        "Topology: 1F -> 2F (one stair; the pad lattice: 2 of 6 pads lead on) -> 3F boss, one-way stair 3F -> 1F.")
ENCOUNTERS = [{"groups": [{"id": "minotaur_zombie", "min": 1, "max": 2}], "weight": 3},
              {"groups": [{"id": "king_mummy", "min": 1, "max": 3}], "weight": 3},
              {"groups": [{"id": "medusa", "min": 1, "max": 2}], "weight": 2},
              {"groups": [{"id": "clay_golem", "min": 1}, {"id": "king_mummy", "min": 0, "max": 1}], "weight": 2},
              {"groups": [{"id": "rakshasa", "min": 1, "max": 2}], "weight": 1}]
QUIET = {"encounterRate": {"min": 18, "max": 30}, "encounters": ENCOUNTERS,
         "battleBackgrounds": {"default": "abandoned_castle"}, "no_static_chokepoints": True,
         "no_unreachable_walkable": True}
EXIT = {"map": "overworld", "entrance": "ord_citadel"}
WON = "ORDEALS_GUARD_DEFEATED"


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, extra: dict | None = None):
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=TRIM, quiet=QUIET,
                             script="ordeal/citadel.py", legend=LEGEND, music="dungeon",
                             extra={"exit": EXIT, **(extra or {})})


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_ORD_O_{cid.upper()}", "dialog": [f"You found {label}!"]}


def pad(room: Room, x: int, y: int, entrance: str) -> None:
    room.g.set(x, y, "+")
    room.transitions.append({"x": x, "y": y, "targetMap": room.id, "targetEntrance": entrance})


# ════════════════════════════ 1F: the empty court ════════════════════════════
f1 = Room("citadel-1f", "Citadel of Trials 1F", 36, 30)
g = f1.g
g.carve(10, 8, 25, 23)                   # the court
g.carve(16, 10, 19, 23, "+")             # the faded runner to the throne
g.carve(16, 24, 19, 27)                  # the gate passage
g.carve(17, 28, 18, 29)                  # the gate, out to the meadow
g.carve(2, 6, 6, 20)                     # the west wing (behind the arch), its stair at the top
g.carve(7, 14, 9, 15)                    # the arch between the court and the west wing (gated)
g.carve(2, 21, 2, 24)                    # the west wing's cistern passage (a dead end)
g.carve(28, 11, 32, 19)                  # the east hall
g.carve(26, 15, 27, 16)                  # court <-> east hall
g.carve(30, 6, 30, 10)                   # the east hall's north store nook (a dead end)
g.carve(33, 18, 33, 22)                  # the east hall's south store nook (a dead end)
g.carve(11, 24, 11, 26)                  # the court's south-west lamp niche (a dead end)
for x, y in [(12, 21), (13, 22), (23, 10), (24, 19)]:
    g.set(x, y, "%")
g.faces(2)
f1.stairs_up(3, 4, "citadel-2f", "arrival")
f1.transitions += [{"x": x, "y": 29, "targetMap": "overworld", "targetEntrance": "ord_citadel"} for x in (17, 18)]
f1.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 17, 8, fit=True)
for x in (12, 22):
    f1.wall([["banner"]], x, 6)
for x in (14, 21):
    f1.wall([["torch"]], x, 6)
for x, y in [(11, 10), (24, 10), (11, 18), (24, 18)]:
    f1.pillar(x, y)
f1.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 6, 13)
f1.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 6, 16)
f1.deco([["urn"]], 29, 12)
f1.deco([["brazier"]], 31, 12)
f1.deco([["skulls"]], 3, 18)
f1.npcs += [
    chest("cistern", "cabin", "a Cabin", 2, 24),
    chest("north_nook", "opal_helm", "an Opal Helm", 30, 6),
    chest("south_nook", "hi_potion", "a Hi-Potion", 33, 22),
    {"id": "stone_steward", "sprite": "king", "tint": "#9c9a94", "x": 19, "y": 9,
     "cutscene": {"id": "ord_throne_wakes", "onceFlag": "ORD_O_THRONE"},
     "dialog": [{"condition": "ORD_O_THRONE",
                 "text": ["The steward's hands are empty now, and turned palm-down toward the arch in the west."]},
                {"text": ["A steward carved from grey stone kneels beside the empty throne, a stone crown held out in "
                          "both hands.",
                          "Words are cut into its sleeve: \"No king came back to wear it. Let the one who climbs set it "
                          "where it belongs.\""]}]},
]
f1.write("Citadel of Trials 1F: the empty court; the crowned throne opens the arch to the west wing and its stair.\n" + NOTE,
         {"arrival": [17, 27], "up": [3, 6], "chute": [21, 21]},
         extra={"keyItemGates": [
             {"x": 7, "y": y, "requiredFlag": "ORD_O_THRONE", "permanent": True,
              "message": "A sheet of grey light fills the arch. Somewhere behind you, the empty throne waits."}
             for y in (14, 15)]})

# ════════════════════════════ 2F: the start ring and the pad lattice ════════════════════════════
f2 = Room("citadel-2f", "Citadel of Trials 2F", 40, 32)
g = f2.g
g.carve(4, 18, 35, 19)                   # the start ring: north side
g.carve(4, 28, 35, 29)                   # south side
g.carve(4, 18, 5, 29)                    # west side
g.carve(34, 18, 35, 29)                  # east side
for y in (22, 25):
    g.carve(6, y, 33, y)                 # the lattice's rows
for x in (10, 16, 22, 28):
    g.carve(x, 20, x, 27)                # and its columns
g.carve(19, 30, 20, 30)                  # under the stairwell down
g.carve(7, 30, 7, 30)                    # the ring's two alcoves (dead ends)
g.carve(32, 30, 32, 30)
g.carve(4, 4, 35, 12)                    # the north hall, beyond the lattice
g.faces(2)
f2.stairs_down(19, 29, "citadel-1f", "up")
f2.stairs_up(19, 2, "citadel-3f", "arrival")
for x, y in [(7, 21), (13, 23), (25, 23), (19, 21)]:
    pad(f2, x, y, "ring")                # four pads, each in a stub off the lattice, throw the walker back
pad(f2, 19, 24, "hall_west")             # two lead on into the north hall
pad(f2, 31, 24, "hall_east")
pad(f2, 19, 11, "ring")                  # the north hall's way back
for x in (8, 31):
    f2.pillar(x, 6)
f2.wall([["banner"]], 13, 2)
f2.wall([["banner"]], 26, 2)
f2.npcs += [
    chest("ring_west", "ether", "an Ether", 7, 30),
    chest("ring_east", "phoenix_down", "a Phoenix Down", 32, 30),
    chest("hall_west", "opal_armlet", "an Opal Armlet", 5, 5),
    chest("hall_east", "hi_potion", "a Hi-Potion", 34, 5),
]
f2.write("Citadel of Trials 2F: the start ring round the pad lattice; two pads lead into the north hall.\n" + NOTE,
         {"arrival": [19, 28], "up": [19, 4], "ring": [21, 28], "hall_west": [6, 10], "hall_east": [33, 10]},
         # the north hall is reached by pad only: a reach root, and no chokepoint check (it floods from the arrival
         # alone; 2F's only static NPCs are the four chests, each at a dead end)
         extra={"no_unreachable_walkable": {"reach_roots": ["hall_west"]}, "no_static_chokepoints": False})

# ════════════════════════════ 3F: the trial hall ════════════════════════════
f3 = Room("citadel-3f", "Citadel of Trials 3F", 34, 22)
g = f3.g
g.carve(2, 5, 30, 16)                    # the trial hall
g.carve(31, 9, 32, 12)                   # the east landing, the stairwell down
g.carve(12, 17, 12, 19)                  # two south niches (dead ends)
g.carve(22, 17, 22, 19)
g.carve(14, 10, 29, 11, "+")             # the processional runner from the landing
g.faces(2)
f3.stairs_down(31, 11, "citadel-2f", "up")
f3.stairs_down(2, 10, "citadel-1f", "chute")
for t in f3.transitions[-2:]:
    t["requiredFlag"] = WON                # the stair behind the dais opens when the guardian falls
for x, y in [(6, 6), (10, 6), (13, 9), (13, 12), (10, 14), (6, 14), (4, 7), (4, 13)]:
    f3.statue(x, y)                      # the ring of statues round the dais (open to the east)
for x in (16, 24):
    f3.pillar(x, 6)
    f3.pillar(x, 14)
f3.wall([["banner"]], 8, 3)
f3.npcs += [
    chest("niche_west", "hi_potion", "a Hi-Potion", 12, 19),
    chest("niche_east", "ether", "an Ether", 22, 19),
    chest("landing", "aegis_shield", "an Aegis Shield", 32, 9),
    # the keeper of the trial, a robed mummy, kneels before the dragon's bones; talking to it starts the fight
    {"id": "trial_guardian", "sprite": "old_man", "tint": "#a89a78", "x": 8, "y": 10, "hideIf": WON,
     "dialog": ["A keeper in rotted robes kneels on the dais. Behind it, bones the size of a ship's ribs lie coiled.",
                "Keeper: Three of us were left to wake it. We have waited a long time for someone worth waking it for."]},
]
f3.write("Citadel of Trials 3F: the trial hall; the guardian waits in the west inside the ring of statues.\n" + NOTE,
         {"arrival": [30, 11], "boss": [11, 10]},
         extra={"canSave": False,
                "scriptedEncounters": [{
                    "x": 8, "y": 10, "npc": "trial_guardian",
                    "enemyIds": ["dragon_zombie", "king_mummy", "king_mummy", "king_mummy"], "flag": WON,
                    "isBoss": True, "postVictoryCutscene": "ord_seal_won",
                    "message": "Two more keepers rise from the statues' shadows. The bones behind them unfold until "
                               "a dragon's skull scrapes the vault, and a voice like wind through ribs says: Climb me."}]})
print("citadel-1f, citadel-2f, citadel-3f written")

"""Pravoka's six homes (docs/WORLD_PLAN.md 4.0.1, 4.1; A1-T), original plans: the lighthouse keeper's house (the
clinic), the warehouse on piles, the netmaker, the chandler, the cooper and the harbourmaster. Each header carries
its design note (Concept / Distinct / Topology). Written by `town_pravoka_rooms.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from interiors_common import STONE_FACE, SLATE_TOP, Place, Town, wood  # noqa: E402

PRAVOKA = Town("pravoka", script="a1/town_pravoka_rooms.py")
BEATEN = "BIKKE_DEFEATED"
ONE_ROOM = "Topology: one room, no stairs: the door on the south wall is the only way in or out. No boss."
TWO_ROOMS = ("Topology: two rooms, no stairs: the door on the south wall into the first room, an open doorway "
             "to the second. No boss.")


def note(concept: str, distinct: str, topology: str = ONE_ROOM) -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\n{topology}"


def chest(r: Place, key: str, item: str, label: str, x: int, y: int) -> None:
    r.npcs.append({"id": f"chest_a1_t_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                   "chestFlag": f"CHEST_A1_T_{key.upper()}", "dialog": [f"You found {label}!"]})


def said(after: list[str], before: list[str]) -> list[dict]:
    return [{"condition": BEATEN, "text": after}, {"text": before}]


def build() -> list[Path]:
    out: list[Path] = []
    # ── the lighthouse keeper's house: a sick-room of cots by the hearth, the great lens on the bench ──
    r = PRAVOKA.house("lighthouse", "Lighthouse Keeper's House", 12, 10, [8])
    g = r.g
    g.carve(1, 3, 10, 8, "-")
    g.carve(1, 4, 3, 8, "_")                          # the cots stand on boards
    g.carve(6, 6, 9, 8, "+")
    r.open_exit("+")
    g.faces(2)
    r.fireplace(5, 1)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 9, 1)
    r.wall([["torch"]], 4, 1)
    r.wall([["potion_shelf"]], 7, 1)
    for y in (4, 6):
        r.tall("bed", 1, y)
    r.one("table", 9, 3)
    r.one("orb_white", 10, 3)                         # the lighthouse lens, taken down for polishing
    r.one("plant", 10, 8)
    r.thing("barrel", 3, 3)                           # lamp oil
    r.thing("barrel", 10, 5)
    r.npc("lighthouse_keeper", "white_mage", 7, 4, [
        "I keep the light, and I keep the hurt. In a harbour town the two jobs come to the same thing.",
        "If one of yours has fallen, I can bring them round: 10 G for each of their levels."],
        action="clinic", clinicPrice=10, tint="#e6dcc8")
    r.npc("keeper_daughter", "villager_f", 3, 7, said(
        ["Father has the lens back up. The light burns from dusk to dawn again.",
         "The fishing boats steer by it. So will your brig."],
        ["The pirates made Father put out the light. Ships that can't see the fjord can't come and fight them.",
         "He keeps the lens polished anyway. Every night."]))
    r.npc("hurt_sailor", "villager", 9, 7, said(
        ["The keeper says I'll sail again by spring. I mean to sail with a light to steer by."],
        ["Asked the Captain to let my boat out. He answered with the flat of his cutlass. I've had kinder answers."]))
    out.append(r.save(note("the lighthouse keeper's house on the shelf, a sick-room as much as a home: the keeper "
                           "tends the hurt of the harbour by the hearth.",
                           "cots along the west wall for the sick; the lighthouse's great lens on the bench by "
                           "the window; lamp-oil barrels at the hearth"),
                      {"floor_stone": "floor_stone", "floor": wood(0.85), "in_wall_face": STONE_FACE},
                      [70, 130, 170]))

    # ── the warehouse on piles: a long store of crates in aisles, the grain hidden at the back ──
    r = PRAVOKA.house("warehouse", "Warehouse", 14, 10, [7])
    g = r.g
    g.carve(1, 3, 12, 8, "_")
    r.open_exit()
    g.faces(2)
    for x in (2, 11):
        r.wall([["window_in"]], x, 1)
    r.wall([["torch"]], 6, 1)
    r.wall([["torch"]], 8, 1)
    for (x, y) in [(1, 3), (2, 3), (1, 4), (4, 3), (4, 4), (4, 5), (9, 3), (9, 4), (9, 5), (12, 3), (12, 4)]:
        r.thing("crate", x, y)
    for (x, y) in [(3, 3), (10, 3), (11, 3), (1, 8), (12, 8), (12, 7)]:
        r.thing("barrel", x, y)
    r.one("table", 6, 3)
    chest(r, "warehouse", "tent", "a Tent", 11, 4)
    r.npc("hennick", "burgher", 7, 4, said(
        ["Hennick, warehouse master. The grain was under the false floor the whole time, and not one pirate found it.",
         "The town eats this winter. Thank you."],
        ["Hennick, warehouse master. Or I was. The pirates keep the key now and count my crates for me.",
         "They never found the false floor. Don't tell them."]))
    r.npc("stowaway", "villager", 2, 7, said(
        ["I hid in a barrel for two days so they wouldn't press me into the crew. Never again. Barrels smell."],
        ["Not so loud! If the pirates see me they'll put me on the brig to scrub the deck."]))
    out.append(r.save(note("a warehouse standing over the harbour on piles: aisles of crates and barrels, the "
                           "town's last grain hidden under a false floor.",
                           "rows of crates that make aisles; a torch-lit tally table in the middle; a stowaway "
                           "crouched behind the barrels"),
                      {"floor": wood(0.75), "in_wall_face": {"from": "in_wall_face", "shade": 0.7},
                       "in_wall_top": SLATE_TOP}))

    # ── the netmaker: nets hung to dry along the walls, a long mending table ──
    r = PRAVOKA.house("netmaker", "Netmaker's House", 10, 8, [5])
    g = r.g
    g.carve(1, 2, 8, 6, "_")
    r.open_exit()
    g.faces(1)
    for x in (1, 2, 4, 7, 8):
        r.wall([["tapestry"]], x, 1)                  # the nets, hung to dry
    r.wall([["window_in"]], 5, 1)
    r.one("table", 3, 4)
    r.one("table", 4, 4)
    r.one("table", 5, 4)
    r.tall("bed", 8, 2)
    r.thing("barrel", 1, 6)
    r.one("plant", 8, 6)
    r.npc("netmaker", "villager_f", 4, 3, said(
        ["Nets mended, every one, and boats to cast them from. My fingers ache in the nicest way."],
        ["I mend nets nobody casts. The boats can't pass the pier. But a net left idle rots, so I mend."]))
    r.npc("old_netmaker", "old_man", 1, 4, [
        "Sixty years I've tied knots. The sea takes nets, and boats, and men, and gives back fish. A fair trade, mostly."])
    out.append(r.save(note("the netmaker's one-room house: nets hung to dry on every wall, a long mending table "
                           "down the middle.",
                           "nets draped over the walls; a mending table of three boards end to end; a bed "
                           "squeezed into the corner"),
                      {"floor": wood(1.05), "in_wall_face": {"from": "in_wall_face", "shade": 0.9}}, [90, 140, 110]))

    # ── the chandler: ship's stores, a front shop and a rope store behind ──
    r = PRAVOKA.house("chandler", "Chandler's House", 11, 9, [3])
    g = r.g
    g.carve(1, 3, 5, 7, "_")                          # the front room
    g.carve(7, 3, 9, 5, "-")                          # the rope store, up a step
    g.carve(6, 4, 6, 4, "_")                          # the doorway between them
    r.open_exit()
    g.faces(2)
    for x in (1, 2):
        r.wall([["potion_shelf"]], x, 1)
    r.wall([["window_in"]], 4, 1)
    r.wall([["banner"]], 8, 1)
    r.one("desk", 1, 5)
    for (x, y) in [(9, 3), (9, 4), (7, 3)]:
        r.thing("barrel", x, y)
    r.thing("crate", 9, 5)
    r.thing("crate", 5, 7)
    chest(r, "chandler", "antidote", "an Antidote", 8, 3)
    r.npc("chandler", "burgher", 2, 4, said(
        ["Rope, pitch, lamp oil, biscuit: whatever a ship needs, I stock. Your brig will want all of it.",
         "Mind the sea west of the peninsula. Fair water, foul fish."],
        ["A chandler with no ships to stock. I sell rope to the pirates, and they pay me in promises."]))
    r.npc("chandler_boy", "villager", 4, 6, [
        "I count the rope. Fifty fathoms, fifty-one, fifty... I lost count again."])
    out.append(r.save(note("the chandler's house: a front room of ship's stores and a store room up a step behind "
                           "it.",
                           "two rooms joined by a side doorway; a store of barrels and crates on a stone floor "
                           "up a step; lamp-oil shelves over the front room's desk", TWO_ROOMS),
                      {"floor": wood(0.9), "floor_stone": "floor_stone",
                       "in_wall_face": {"from": "castle_face", "shade": 0.9}}, [150, 110, 60]))

    # ── the cooper: barrels in every state of making round a workbench ──
    r = PRAVOKA.house("cooper", "Cooper's House", 11, 8, [5])
    g = r.g
    g.carve(1, 2, 9, 6, "-")
    g.carve(1, 2, 3, 3, "_")                          # the family's corner, on boards
    r.open_exit()
    g.faces(1)
    r.fireplace(6, 0)
    r.wall([["window_in"]], 2, 1)
    r.tall("bed", 1, 2)
    for (x, y) in [(9, 2), (9, 3), (8, 2), (9, 6), (1, 6), (2, 6)]:
        r.thing("barrel", x, y)
    r.one("table", 5, 4)
    r.thing("crate", 4, 4)
    chest(r, "cooper", "potion", "a Potion", 9, 5)
    r.npc("cooper", "farmer", 6, 3, said(
        ["Barrels for the brig, barrels for the boats. I'll not sleep this week, and I couldn't be happier."],
        ["The pirates take every barrel I make and break them open for the drink. A cooper's nightmare."]))
    r.npc("cooper_wife", "villager_f", 3, 4, [
        "He talks to the staves while he works. Says it makes them sit tighter. Thirty years, and no leaks."])
    out.append(r.save(note("the cooper's house and workshop in one room: staves, hoops and finished barrels "
                           "round a workbench, the family's bed in a boarded corner.",
                           "an earthen workshop floor with a boarded corner for the bed; barrels stacked by "
                           "the hearth; a workbench in the middle of the room"),
                      {"floor_stone": "dirt", "floor": wood(1.0), "in_wall_face": STONE_FACE}))

    # ── the harbourmaster: the office of charts, and the record room through an arch ──
    r = PRAVOKA.house("harbormaster", "Harbourmaster's House", 12, 10, [3])
    g = r.g
    g.carve(1, 3, 6, 8, "-")                          # the office
    g.carve(8, 3, 10, 6, "_")                         # the record room
    g.carve(7, 5, 7, 6, "-")                          # the arch between them
    g.carve(2, 5, 4, 7, "+")
    r.open_exit("-")
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 5, 1)
    r.wall([["banner"]], 3, 1)
    r.one("map_table_l", 3, 4)
    r.one("map_table_r", 4, 4)
    for x in (8, 9, 10):
        r.tall("bookshelf", x, 3)
    r.one("desk", 10, 6)
    r.one("globe", 1, 3)
    r.one("plant", 6, 8)
    r.npc("harbormaster", "old_man", 5, 4, said(
        ["The harbour books are open again. Your brig is entered as 'ship of the Warriors, dues waived for ever'.",
         "South down the channel lies the Aldi Sea. Every port of the old trade is on it."],
        ["Harbourmaster, of a harbour that sails nowhere. The Captain tore my charts and kept the pieces."]))
    r.npc("harbor_clerk", "mage", 9, 6, said(
        ["Forty ledgers, and I'm writing the first good page in a month."],
        ["I keep two ledgers now: what the pirates took, and what they think they took. The second is shorter."]),
        tint="#b4b4c8")
    out.append(r.save(note("the harbourmaster's house: an office round a chart table, and the record room of "
                           "ledgers through an arch.",
                           "a chart table and a globe in the office; a wall of ledgers in the record room; "
                           "an open archway instead of a door between the rooms", TWO_ROOMS),
                      {"floor_stone": "floor_stone", "floor": wood(0.8), "in_wall_face": STONE_FACE,
                       "in_wall_top": SLATE_TOP}, [60, 80, 140]))
    return out

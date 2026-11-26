"""Pravoka's four rooms behind the doors that led nowhere (PT-3, docs/PLAYTEST_ELFHEIM_PLAN.md): the sail loft, the
boarded cottage, the old warehouse on piles (the storehouse) and the pirates' den. Each header carries its design note
(Concept / Distinct / Topology). Written by `town_pravoka_rooms.py`; the plans share `town_pravoka_homes.py`'s town.
While the pirates hold the town the townsfolk keep indoors; the den's quartermaster leaves with his captain.
"""
from __future__ import annotations

from pathlib import Path

from interiors_common import STONE_FACE, SLATE_TOP, wood
from town_pravoka_homes import BEATEN, ONE_ROOM, PRAVOKA, note, said


def build() -> list[Path]:
    out: list[Path] = []
    # ── the sail loft: canvas hung from the beams, a long cutting table ──
    r = PRAVOKA.house("loft", "Sail Loft", 11, 8, [3])
    g = r.g
    g.carve(1, 2, 9, 6, "_")
    r.open_exit()
    g.faces(1)
    for x in (1, 5, 6, 9):
        r.wall([["tapestry"]], x, 1)                  # the sails, hung to air
    r.wall([["window_in"]], 3, 1)
    r.one("table", 5, 4)
    r.one("table", 6, 4)
    r.one("table", 7, 4)
    r.tall("bed", 9, 2)
    r.thing("crate", 1, 6)
    r.thing("barrel", 9, 6)
    r.npc("sailmaker", "villager_f", 6, 3, said(
        ["New canvas for every boat in the fjord. I'll sew till my thimble wears through, and gladly."],
        ["I sew sails for a brig that isn't ours, behind a door I keep shut. Better than sewing nothing."]))
    out.append(r.save(note("the sail loft: canvas hung from the beams to air, and a long cutting table down the "
                           "middle of the room.",
                           "sails draped over three walls; a cutting table of three boards end to end; the "
                           "sailmaker's cot under the eaves"),
                      {"floor": wood(0.95), "in_wall_face": {"from": "in_wall_face", "shade": 0.95}}, [120, 120, 140]))

    # ── the boarded cottage: a family that boarded up its own windows ──
    r = PRAVOKA.house("cottage", "Boarded Cottage", 10, 8, [3])
    g = r.g
    g.carve(1, 2, 8, 6, "-")
    g.carve(5, 2, 8, 3, "_")                          # the beds' corner, on boards
    r.open_exit("-")
    g.faces(1)
    r.fireplace(1, 0)
    r.wall([["banner"]], 6, 1)
    r.tall("bed", 6, 2)
    r.tall("bed", 8, 2)
    r.one("table", 4, 4)
    r.thing("barrel", 1, 6)
    r.thing("crate", 8, 6)
    r.npc("cottager", "farmer", 3, 4, said(
        ["We pulled the boards off the windows this morning. The light came in like a flood. I'd forgotten the colour."],
        ["We nailed the shutters ourselves. If the pirates think the house is empty, they leave it alone."]))
    r.npc("cottager_boy", "villager", 6, 5, said(
        ["Can I go out now? Really out? To the pier and everything?"],
        ["Mother says I can't go out till the pirates sail. I counted their boots through a crack. Nine pairs."]))
    out.append(r.save(note("a cottage whose family boarded up its own windows to look deserted, and waits by "
                           "the hearth for the pirates to go.",
                           "no window in any wall; two beds on a boarded corner; the hearth the only light"),
                      {"floor_stone": "dirt", "floor": wood(0.8), "in_wall_face": STONE_FACE}, [90, 70, 50]))

    # ── the storehouse on piles: an emptied warehouse, its keeper counting what is left ──
    r = PRAVOKA.house("storehouse", "Old Warehouse", 12, 9, [3])
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["torch"]], 6, 1)
    for (x, y) in [(9, 3), (10, 3), (10, 4), (1, 7)]:
        r.thing("crate", x, y)
    for (x, y) in [(1, 3), (5, 3), (10, 7)]:
        r.thing("barrel", x, y)
    r.one("desk", 7, 5)
    r.npc("storekeeper", "old_man", 6, 5, said(
        ["The pirates left in such a hurry they forgot half of what they took from me. I'm counting it twice."],
        ["They emptied this store in a night. I come in each day and count the empty floor. It keeps me sane."]))
    out.append(r.save(note("the old warehouse over the harbour on piles: a long store stripped bare by the pirates, "
                           "a few crates left in the corners.",
                           "a wide empty plank floor; the last crates and barrels pushed to the walls; the keeper's "
                           "tally desk alone in the middle", ONE_ROOM),
                      {"floor": wood(0.7), "in_wall_face": {"from": "in_wall_face", "shade": 0.7},
                       "in_wall_top": SLATE_TOP}))

    # ── the pirates' den: bunks, a table of loot, the quartermaster ──
    r = PRAVOKA.shop("pravoka-den", "Pirates' Den", 11, 9, [5], "pirates_den")
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    r.open_exit()
    g.faces(2)
    r.wall([["banner"]], 3, 1)
    r.wall([["torch"]], 5, 1)
    r.wall([["banner"]], 7, 1)
    for x in (1, 9):
        r.tall("bed", x, 3)
    r.one("table", 4, 4)
    r.one("table", 5, 4)
    for (x, y) in [(1, 7), (2, 7), (9, 7)]:
        r.thing("barrel", x, y)
    r.thing("crate", 8, 7)
    r.npc("pirate_quartermaster", "guard", 6, 3, [
        "Quartermaster: Every coin in this town passes over this table. The Captain's share, then mine, then the crew's.",
        "The town's share? Ha! That's the table itself."], tint="#8c7a64", hideIf=BEATEN)
    r.npc("den_lad", "villager", 5, 6, [
        "The pirates' den! I always wanted to see inside. It smells of tar and old boots. Brilliant."],
        showIf=BEATEN)
    out.append(r.save(note("the pirates' den: the crew's bunks round a table heaped with the town's coin, the "
                           "quartermaster keeping the tally.",
                           "bunks at both walls; a long table of loot in the middle; the crew's banners over "
                           "the door's wall"),
                      {"floor": wood(0.6), "in_wall_face": STONE_FACE, "in_wall_top": SLATE_TOP}, [110, 40, 40]))
    return out

"""Melmond's five homes (docs/WORLD_PLAN.md 4.0.1, 4.3; ERT-T): Dr. Unne's study, the mill house, the vintner's,
the ploughman's cottage and the healer's house (the clinic, GAP-16) -> assets-src/maps/melmond-house-*.yaml.

Dr. Unne reads the slab (S25): `requiredItem: slab` and the cutscene `ert_unne_lesson` (onceFlag LUFENIAN_LEARNED),
which takes the slab with a `take_item` step and sets the flag (the dwarf hall's Nerrick does the same: an NPC's
`takeItem` would take the slab before the cutscene could check for it). Written by `town_melmond_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SLATE_TOP, STONE_FACE, Town, wood  # noqa: E402
from town_melmond_people import LEARNED, LIT, VAMP, when  # noqa: E402

MEL = Town("melmond", script="earth/town_melmond_interiors.py")
UNNE = {"id": "ert_unne_lesson", "onceFlag": LEARNED}
EARTH = {"floor_stone": {"from": "floor_stone", "sat": 0.6, "shade": 0.85}}


def note(concept: str, distinct: str, topology: str = "one room; the door is the only way in or out") -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def chest(r, key: str, item: str, label: str, x: int, y: int) -> None:
    r.npcs.append({"id": f"ert_t_chest_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                   "chestFlag": f"CHEST_ERT_T_{key.upper()}", "dialog": [f"You found {label}!"]})


def unne(out: list[Path]) -> None:
    """Dr. Unne's study: a long room of shelves round the reading table, a cold hearth, his bedroom behind."""
    r = MEL.house("unne", "Dr. Unne's House", 14, 10, [5])
    g = r.g
    g.carve(1, 3, 9, 8, "_")                          # the study
    g.carve(11, 4, 12, 8, "_")                        # his bedroom, under a lower ceiling
    g.carve(10, 7, 10, 8, "_")                        # the doorway between them
    g.carve(3, 5, 7, 6, "+")                          # the reading rug
    r.open_exit()
    g.faces(2)
    for x in (1, 2, 8, 9):
        r.tall("bookshelf", x, 3)
    r.wall([["tapestry"]], 4, 1)
    r.wall([["window_in"]], 6, 1)
    r.fireplace(11, 2)
    r.deco([["map_table_l", "map_table_r"]], 4, 5)    # the reading table where the slab will lie
    r.one("lectern", 7, 4)
    r.one("globe", 1, 8)
    r.one("desk", 9, 8)
    r.tall("bed", 12, 4)
    r.npc("ert_unne", "dr_unne", 6, 4, [
        {"condition": LEARNED, "text": [
            "Now you can read the sky-folk's letters as well as I can. Lufenia is on a mesa in the far north-east.",
            "No road climbs to it and no ship can reach it. You will have to fly. Ask their elder about the Mirage."]},
        {"condition": "item:slab", "text": [
            "That grey stone in your pack... let me see it. Let me SEE it! My tablet! Out of the sea, after all these "
            "years!"]},
        {"condition": LIT, "text": [
            "The fields are green, and I still can't think of anything but my tablet. It is a scholar's curse.",
            "On it I copied the whole alphabet of the sky-folk, the Lufenians. My ship went down with it near Onrac."]},
        {"text": [
            "I am Unne. For forty years I have studied the speech of the Lufenians, the people who came from the sky.",
            "I copied their whole alphabet onto a stone tablet. The ship that carried it sank off Onrac's coast.",
            "If the sea ever gives it back, bring it to me, and I will teach you to read every word of it."]}],
        requiredItem="slab", cutscene=UNNE)
    r.npc("unne_housekeeper", "villager_f", 3, 8, when(
        (LEARNED, ["He has been writing day and night since you brought the tablet back. He even remembered to eat."]),
        (VAMP, ["The Doctor says the badlands' cold is older than the vampire. He reads too much."]),
        default=["Mind the books. The Doctor knows where each one is, and if you move it, he will know that too."]))
    out.append(r.save(note("a scholar's study: shelves round a reading table and a lectern, a cold hearth in the "
                           "bedroom behind", "a map table set for a tablet that is not there; a bedroom off the "
                           "study's east end through a low doorway", "two rooms joined by an inner doorway; the door "
                           "is the only way in or out"),
                      {"floor": wood(0.75), "in_wall_face": {"from": "castle_face", "shade": 0.7},
                       "in_wall_top": SLATE_TOP}, [120, 90, 60]))


def miller(out: list[Path]) -> None:
    """The mill house: crates and barrels round an idle millstone, the hearth at the back."""
    r = MEL.house("miller", "Mill House", 11, 9, [3])
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(6, 2, 9, 2, "-")                          # the store alcove
    r.open_exit("-")
    g.faces(1)
    r.fireplace(2, 1)
    r.wall([["window_in"]], 4, 2)
    r.one("stone_bench", 7, 4)                        # the hand millstone
    for (x, y) in [(9, 2), (9, 3), (8, 2)]:
        r.thing("barrel", x, y)
    for (x, y) in [(6, 2), (1, 7), (9, 7)]:
        r.thing("crate", x, y)
    r.one("table", 3, 5)
    chest(r, "miller", "hi_potion", "a Hi-Potion", 1, 6)
    r.npc("melmond_miller", "farmer", 5, 4, when(
        (LIT, ["Wheat in the hoppers again! Grind it fine, grind it fast, I keep telling the lad. He grinds it slow."]),
        default=["Hobb, the miller. The sails stopped the year the wheat came up grey.",
                 "What wheat there is crumbles to dust in the stones. I'm a miller of dust."]))
    r.npc("melmond_miller_wife", "villager_f", 4, 6, when(
        (LIT, ["Bake day tomorrow. Real bread! I'll save you a loaf if you're in town."]),
        default=["We're living on last year's flour. I stretch it with bark. Don't tell Hobb."]))
    out.append(r.save(note("a miller's house of crates and barrels round a hand millstone", "a hand millstone "
                           "near the east wall; crates and barrels heaped in an alcove at the back"),
                      {"floor_stone": {"from": "floor_stone", "sat": 0.5, "shade": 0.95},
                       "in_wall_face": {"from": "in_wall_face", "shade": 0.85}}))


def vintner(out: list[Path]) -> None:
    """The vintner's house: a front room, and casks in a cellar room down a step at the side."""
    r = MEL.house("vintner", "Vintner's House", 12, 9, [3])
    g = r.g
    g.carve(1, 3, 6, 7, "_")                          # the front room
    g.carve(8, 2, 10, 7, "-")                         # the cask room
    g.carve(7, 5, 7, 6, "_")
    r.open_exit()
    g.faces(1)
    r.wall([["window_in"]], 3, 2)
    r.wall([["potion_shelf"]], 5, 2)
    for (x, y) in [(8, 2), (10, 2), (10, 3), (10, 4), (8, 7), (10, 7)]:
        r.thing("barrel", x, y)
    r.one("table", 2, 4)
    r.tall("bed", 6, 3)
    r.one("plant", 1, 7)
    chest(r, "vintner", "soft", "a Soft", 9, 2)
    r.npc("melmond_vintner", "burgher", 3, 5, when(
        (LIT, ["Smell that? The vines are budding. This year's pressing will be the best in a lifetime."]),
        default=["The last good vintage is in those casks. I won't sell it. I'm saving it for the day the vines "
                 "come back.", "If they don't, I'll drink it myself, slowly, and complain."]))
    r.npc("melmond_vintner_daughter", "villager_f", 5, 6, when(
        (VAMP, ["Father let me ride to the badlands' edge with the carter. The grey there is thinner, I think."]),
        default=["I'm meant to learn the vines from Father. All I've learned is how to sweep up dead leaves."]))
    out.append(r.save(note("a vintner's house, a front room and a room of casks off its east side", "the last "
                           "casks kept for the vines' return; the cask room on a stone floor beyond an inner "
                           "doorway", "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {"floor": wood(0.9), **EARTH, "in_wall_face": {"from": "in_wall_face", "shade": 0.8}},
                      [140, 50, 70]))


def ploughman(out: list[Path]) -> None:
    """The ploughman's cottage: one long room, two box beds, the family table."""
    r = MEL.house("ploughman", "Ploughman's Cottage", 10, 8, [6])
    g = r.g
    g.carve(1, 2, 8, 6, "-")
    r.open_exit("-")
    g.faces(1)
    r.tall("bed", 1, 2)
    r.tall("bed", 2, 2)
    r.wall([["window_in"]], 4, 1)
    r.wall([["window_in"]], 7, 1)
    r.one("table", 4, 4)
    r.thing("crate", 8, 2)
    r.thing("barrel", 8, 6)
    r.npc("melmond_ploughman", "farmer", 5, 3, when(
        (LIT, ["My plough's back in the furrow! Funny how a man misses blisters."]),
        default=["I've put the plough away in the shed. There's no use dragging it through dust.",
                 "My father ploughed these fields, and his. I'll be the one who stopped."]))
    r.npc("melmond_plough_son", "villager", 3, 5, when(
        (LIT, ["Father let me drive the ox today! It sat down. But still!"]),
        default=["I'm going to be a dwarf when I grow up. They dig, and nothing they dig dies."]))
    r.npc("melmond_plough_gran", "villager_f", 7, 4, when(
        (VAMP, ["So the cold thing in the Cavern is gone. I felt my knees stop aching. That's how I knew."]),
        default=["In my day the soil was black as a crow's wing. You could eat it with a spoon. We didn't, mind."]))
    out.append(r.save(note("a ploughman's long one-room cottage with two beds against the back wall", "two box "
                           "beds side by side in the west corner; the family table alone in the middle of the room"),
                      {**EARTH, "in_wall_face": {"from": "in_wall_face", "shade": 0.75}}))


def healer(out: list[Path]) -> None:
    """The healer's house (the shrine sign): a ward of cots, the clinic at the herb table."""
    r = MEL.house("healer", "Healer's House", 13, 9, [6])
    g = r.g
    g.carve(1, 3, 11, 7, "-")
    g.carve(7, 4, 10, 5, "+")
    r.open_exit("-")
    g.faces(2)
    for x in (7, 9, 11):
        r.tall("bed", x, 3)
    r.wall([["potion_shelf"]], 2, 1)
    r.wall([["potion_shelf"]], 3, 1)
    r.wall([["window_in"]], 5, 1)
    r.one("table", 1, 3)
    r.one("orb_white", 1, 7)
    r.one("plant", 11, 7)
    r.npc("melmond_healer", "white_mage", 3, 4,
          ["The fallen can be brought back, if you come quickly. Lay them here."],
          action="clinic", clinicPrice=20)              # GAP-16: 20 G per level of each fallen member
    r.npc("melmond_patient", "villager", 9, 5, when(
        (LIT, ["My cough is gone! The healer says it was the dust. I say it was the earth getting better."]),
        default=["The grey dust gets in your chest. Half the town coughs. The other half is too tired to."]))
    r.npc("melmond_healer_apprentice", "mage", 5, 6, when(
        (LIT, ["Our herbs come up green now. I didn't know mint was supposed to smell like that!"]),
        default=["We grow our herbs indoors in pots, the soil outside kills them. Even the mint gives up."]))
    out.append(r.save(note("a healer's ward, three cots along the back wall and shelves of salves", "the herb table "
                           "where the healer brings back the fallen; a carpet laid between the cots"),
                      {**EARTH, "in_wall_face": STONE_FACE}, [200, 210, 230]))


def build() -> list[Path]:
    out: list[Path] = []
    for f in (unne, miller, vintner, ploughman, healer):
        f(out)
    return out

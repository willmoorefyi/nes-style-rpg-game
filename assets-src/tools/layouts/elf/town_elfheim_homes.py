"""Elfheim's six homes (docs/WORLD_PLAN.md 4.0.1, 4.2; ELF-T), original plans -> assets-src/maps/elfheim-house-*.yaml.

  python3 -I assets-src/tools/layouts/elf/town_elfheim_rooms.py

The herbalist's drying room, the bowyer's workshop, the scribe's two-room archive, the healer's ward (the clinic,
GAP-16: 20 G per level of each fallen member, 3.6 B3), the bard's music room and the hedge warden's lodge. Every
exit returns to the town's `house_<name>` entrance (`interiors_common.Town`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import Town, wood  # noqa: E402
from town_elfheim_people import ELDER, ELF, talk  # noqa: E402

ELFHEIM = Town("elfheim", script="elf/town_elfheim_rooms.py")
LEAF = {"in_wall_face": {"from": "in_wall_face", "shade": 0.85}, "in_wall_top": {"from": "slate", "shade": 0.6}}
CLINIC_PRICE = 20


def note(concept: str, distinct: str, topology: str = "one room; the door is the only way in or out") -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def build() -> list[Path]:
    out: list[Path] = []
    # the herbalist: a drying room, bundles on the walls, a long table of jars
    r = ELFHEIM.house("herbalist", "Herbalist's House", 12, 9, [4])
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(6, 4, 9, 6, "+")
    r.open_exit()
    g.faces(2)
    for x in (2, 3, 8, 9):
        r.wall([["potion_shelf"]], x, 1)
    r.one("table", 6, 4)
    r.one("table", 7, 4)
    for x, y in ((1, 3), (10, 3), (10, 7), (1, 7)):
        r.one("plant", x, y)
    r.npc("elfheim_herbalist", "vendor_f", 8, 5, talk(
        ["Every jar here was opened for the prince. Dreamless-root, owl's balm, nine kinds of mint. Nothing.",
         "Elves make good medicine for elves. A dark elf's curse wants a human witch's herb."],
        herb=["You have it? Matoya's herb? The smell alone could wake a stone. Take it up to the castle!"],
        awake=["He's awake, and on Matoya's herb, not mine. I'll be humble about it. Eventually."]), tint=ELF)
    r.npc("elfheim_herb_apprentice", "villager", 3, 6, talk(
        ["I chop, I dry, I label. Mistress says in a hundred years I may be allowed to mix."]), tint=ELF)
    out.append(r.save(note("the herbalist's drying room, shelves of jars on every wall and a work table",
                           "four jar shelves along the back wall; a green rug where the herbs are sorted"),
                      {"floor": wood(1.05), **LEAF}, [110, 150, 90]))

    # the bowyer: a long workshop, staves racked along the north wall, a target at the east end
    r = ELFHEIM.house("bowyer", "Bowyer's Workshop", 14, 8, [3])
    g = r.g
    g.carve(1, 3, 12, 6, "_")
    r.open_exit()
    g.faces(2)
    for x in (2, 4, 6):
        r.wall([["weapon_rack"]], x, 1)
    r.one("armor_stand", 12, 3)
    r.one("table", 8, 3)
    r.one("desk", 9, 3)
    r.thing("barrel", 1, 6)
    r.thing("crate", 12, 6)
    r.npc("elfheim_bowyer", "warrior", 9, 5, talk(
        ["Yew from the ring hedge, gut from the Aldi seals. An elven bow will outlive whoever draws it.",
         "I don't sell them. The shop on the high street sells what I can bear to part with."],
        awake=["The prince sent down for his hunting bow. First order in a year. I wept on the string."]), tint=ELF)
    r.npc("elfheim_bowyer_son", "thief", 4, 4, talk(
        ["Father says I'm not ready to string a bow. I've strung forty. He unstrings them when I'm asleep."]),
        tint=ELF, wander=True)
    out.append(r.save(note("a bowyer's long workshop with staves racked along the north wall",
                           "three racks of unstrung staves; an armour stand used as a practice dummy at the east end"),
                      {"floor": wood(0.85), **LEAF}, [140, 110, 70]))

    # the scribe: a front reading room and a back archive through an inner doorway
    r = ELFHEIM.house("scribe", "Scribe's House", 13, 11, [9])
    g = r.g
    g.carve(1, 3, 5, 9, "-")                    # the archive
    g.carve(7, 3, 11, 9, "_")                   # the reading room
    g.carve(6, 6, 6, 7, "-")
    g.carve(8, 4, 10, 5, "+")
    r.open_exit()
    g.faces(2)
    for x in (1, 3):
        r.tall("bookshelf", x, 3)
    r.tall("bookshelf", 5, 3)
    r.one("lectern", 9, 3)
    r.one("desk", 11, 6)
    r.one("plant", 7, 9)
    r.npc("elfheim_scribe", "white_wizard", 9, 6, talk(
        ["I keep the prince's chronicle. The last entry reads: 'Today the prince slept.' So does every entry since.",
         "Astos came as a guest from the west. He brought a gift box. The prince opened it, and slept."],
        astos=["I've written it down: 'Astos, the false king of the Western Keep, is fallen.' It is my best line."],
        awake=["New entries at last! 'Today the prince woke. Today the prince ate. Today the prince complained.'"]),
        tint=ELDER)
    r.npc("elfheim_archive_reader", "black_mage", 3, 7, talk(
        ["The archive says the dwarves of the strait once traded with us for mithril. They paid in powder for "
         "blasting rock. The prince keeps a cask in the vault still."]), tint=ELF)
    out.append(r.save(note("a scribe's reading room and a back archive of tall shelves",
                           "a lectern where the chronicle lies open; the archive reached through an inner doorway",
                           "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {"floor": wood(0.95), "floor_stone": {"from": "floor_stone", "shade": 0.9}, **LEAF},
                      [90, 120, 150]))

    # the healer: the clinic, a ward of cots under a leaf-green ceiling
    r = ELFHEIM.house("healer", "Healer's House", 12, 9, [2])
    g = r.g
    g.carve(1, 3, 10, 7, "-")
    g.carve(5, 4, 10, 6, "+")
    r.open_exit("-")
    g.faces(2)
    for x in (6, 8, 10):
        r.tall("bed", x, 3)
    r.wall([["potion_shelf"]], 2, 1)
    r.one("orb_white", 1, 3)
    r.one("table", 3, 3)
    r.one("plant", 10, 7)
    r.npc("elfheim-healer-keeper", "white_mage", 3, 5,
          ["Bring your fallen here. The wood's own breath can still call them back, for a small offering."],
          action="clinic", clinicPrice=CLINIC_PRICE, tint=ELF)            # GAP-16, B3: 20 G per level
    r.npc("elfheim_ward_patient", "villager", 7, 6, talk(
        ["I tried to cut through the ring hedge on a dare. The hedge cut back."],
        awake=["The healer says I can go home now that the prince is up. I think she just wants the cot."]), tint=ELF)
    out.append(r.save(note("the healer's ward, three cots and a white orb by the hearth wall",
                           "a white orb the healer calls on beside the door; a green rug running between the cots"),
                      {"floor_stone": "marble", **LEAF}, [160, 200, 150]))

    # the bard: a music room round a small stage
    r = ELFHEIM.house("bard", "Bard's House", 11, 10, [5])
    g = r.g
    g.carve(1, 3, 9, 8, "_")
    g.carve(3, 3, 7, 4, "+")                    # the little stage
    r.open_exit()
    g.faces(2)
    r.wall([["tapestry"]], 5, 1)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 8, 1)
    r.one("table", 1, 7)
    r.thing("bench", 3, 6)
    r.thing("bench", 7, 6)
    r.one("plant", 9, 8)
    r.npc("elfheim_bard", "red_wizard", 5, 3, talk(
        ["I haven't played since the curse. A harp in a sleeping town sounds like a lie."],
        awake=["Sit, sit! I'm writing the waking song. It needs a verse about you. What rhymes with 'Matoya'?"]),
        tint=ELF)
    r.npc("elfheim_bard_listener", "villager_f", 8, 7, talk(
        ["I come every evening in case he plays. He never does. I stay for the quiet."],
        awake=["He's playing again! Every evening! I may need to find somewhere quiet."]), tint=ELF)
    r.npc("elfheim_bard_child", "villager", 2, 4, ["A small elf is asleep on the stage, using a lute for a pillow."],
          tint=ELF)
    out.append(r.save(note("a bard's music room with a low carpeted stage under a tapestry",
                           "two benches facing the stage; a tapestry and two windows on the back wall"),
                      {"floor": wood(1.15), **LEAF}, [160, 90, 120]))

    # the warden of the hedges: a lodge with a hearth and the warden's map of the ring
    r = ELFHEIM.house("warden", "Hedge Warden's Lodge", 12, 9, [6])
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(1, 3, 3, 4, "-")                    # the hearthstone
    r.open_exit()
    g.faces(2)
    r.fireplace(2, 1)
    r.one("map_table_l", 6, 3)
    r.one("map_table_r", 7, 3)
    r.wall([["weapon_rack"]], 9, 1)
    r.tall("bed", 10, 5)
    r.thing("barrel", 1, 7)
    r.npc("elfheim_hedge_warden", "knight", 6, 5, talk(
        ["This map shows the ring as it was planted, nine hundred years ago. It's half again as thick now.",
         "Beyond the ring, the woods run south to the fens. Keep to the high ground; the peat swallows boots."],
        awake=["The ring has stopped growing. I'll have the map redrawn. It's been a while."]), tint=ELDER)
    r.npc("elfheim_warden_wife", "villager_f", 3, 6, talk(
        ["He measures the hedges every morning. I measure him every evening. He's getting thinner."],
        awake=["He came home whistling today. I'd forgotten he could."]), tint=ELF)
    out.append(r.save(note("the hedge warden's lodge, a hearth, a bed and the planting map of the ring",
                           "a map table showing the ring of hedges; a stone hearth corner under the chimney"),
                      {"floor": wood(0.8), "floor_stone": {"from": "floor_stone", "shade": 0.8}, **LEAF},
                      [120, 140, 80]))
    return out


if __name__ == "__main__":
    for p in build():
        print(p)

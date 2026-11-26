"""Onrac's six homes (docs/WORLD_PLAN.md 4.0.1, 4.6; WAT-T): the bell-ringer's house, the net-mender's loft, the
smokehouse, the shipwright's shed, the healer's house (the clinic, GAP-16) and the tanner's -> assets-src/maps/
onrac-house-*.yaml. Written by `town_onrac_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SLATE_TOP, STONE_FACE, Town, wood  # noqa: E402
from town_onrac_people import CUBE, FREED, LIT, OXY, when  # noqa: E402

ONR = Town("onrac", script="water/town_onrac_interiors.py")
COLD = {"floor_stone": {"from": "floor_stone", "sat": 0.4, "shade": 0.9}}
TAR = {"floor": wood(0.6)}                       # tarred planks, darker than any act-1 floor


def note(concept: str, distinct: str, topology: str = "one room; the door is the only way in or out") -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def chest(r, key: str, item: str, label: str, x: int, y: int) -> None:
    r.npcs.append({"id": f"wat_t_chest_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                   "chestFlag": f"CHEST_WAT_T_{key.upper()}", "dialog": [f"You found {label}!"]})


def bellringer(out: list[Path]) -> None:
    """The bell-ringer's house: a stone room with the bell rope's old pulley wheel and a log of every tolling."""
    r = ONR.house("bellringer", "Bell-ringer's House", 11, 9, [5])
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(3, 4, 6, 6, "+")
    r.open_exit("-")
    g.faces(2)
    r.fireplace(1, 1)
    r.wall([["window_in"]], 4, 1)
    r.wall([["tapestry"]], 9, 1)
    r.one("lectern", 8, 3)                            # the tolling log
    r.one("table", 4, 5)
    r.tall("bed", 9, 3)
    r.thing("barrel", 1, 7)
    r.npc("onrac_bellringer", "old_man", 6, 4, when(
        (LIT, ["I went up at dusk and the rope was already swinging. Nobody's hand on it but the wind's.",
               "Fifty years I've rung that bell for the drowned. Tonight, I think, they rang it for me."]),
        default=["The bell came up in my father's net, green as weed, the winter the city under the harbour went down.",
                 "We hung it in the tower and I ring it every dusk. One stroke for every street they had down there."]))
    r.npc("onrac_bellringer_girl", "girl", 3, 6, when(
        (LIT, ["Grandad cried, a bit. Then he said it was the cold. It isn't cold any more."]),
        default=["I write every tolling in Grandad's book. Thirty-one thousand and some. My hand aches just saying it."]))
    out.append(r.save(note("a bell-ringer's stone house with the tolling log on a lectern and a rug in the middle of the floor",
                           "a lectern holding the log of every evening's tolling; a tapestry of the drowned city's "
                           "skyline over the bed"),
                      {**COLD, "in_wall_face": {"from": "castle_face", "shade": 0.75}, "in_wall_top": SLATE_TOP},
                      [70, 90, 120]))


def netmender(out: list[Path]) -> None:
    """The net-mender's loft: nets on every wall, a long mending bench, the family's beds at the back."""
    r = ONR.house("netmender", "Net-mender's Loft", 12, 9, [3])
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    r.open_exit()
    g.faces(2)
    for x in (2, 5, 8):
        r.wall([["banner"]], x, 1)                    # nets hung to dry on the back wall
    r.wall([["window_in"]], 10, 1)
    r.one("stone_bench", 4, 4)
    r.one("stone_bench", 5, 4)                        # the long mending bench
    r.tall("bed", 9, 3)
    r.tall("bed", 10, 3)
    r.thing("crate", 1, 3)
    r.thing("barrel", 1, 7)
    chest(r, "netmender", "phoenix_down", "a Phoenix Down", 10, 7)
    r.npc("onrac_netmender", "farmer", 6, 5, when(
        (LIT, ["Not one torn net all week. Whatever was ripping them out past the stacks is gone."]),
        default=["Every net that goes past the sea-stacks comes back slashed, like something was cutting its way out.",
                 "I mend them. The boats take them out. They come back slashed. I'm a very busy woman."]))
    r.npc("onrac_netmender_son", "boy", 3, 6, when(
        (OXY, ["Is it true you'll ride the iron fish? Bring me back a shell from the drowned city! A big one!"]),
        default=["Mum's teaching me the knots. This one's a sheet bend. This one's a mess. I'm on the mess."]))
    out.append(r.save(note("a net-mender's loft of dark planks, nets hung across the back wall over a long bench",
                           "three nets drying on the back wall; a mending bench of two stone seats in the middle of "
                           "the floor"), {**TAR, "in_wall_face": {"from": "in_wall_face", "shade": 0.7}}))


def smoker(out: list[Path]) -> None:
    """The smokehouse: barrels of salt and racks of cod round the smoking hearth, a back store through a doorway."""
    r = ONR.house("smoker", "Smokehouse", 12, 9, [3])
    g = r.g
    g.carve(1, 3, 7, 7, "-")                          # the smoking room
    g.carve(9, 3, 10, 7, "-")                         # the salt store
    g.carve(8, 6, 8, 7, "-")
    r.open_exit("-")
    g.faces(2)
    r.fireplace(3, 1)
    r.wall([["torch"]], 6, 1)
    for (x, y) in [(9, 3), (10, 3), (10, 4), (10, 7)]:
        r.thing("barrel", x, y)
    for (x, y) in [(1, 3), (1, 4), (7, 3)]:
        r.thing("crate", x, y)
    r.one("table", 5, 5)
    r.npc("onrac_smoker", "burgher", 3, 5, when(
        (LIT, ["Fresh cod again, and fat with it! The smoke smells right for the first time in years."]),
        default=["Alder smoke, three days, three nights. That's how Onrac cod gets to the far side of the world.",
                 "The fish are thinner every season. I smoke them anyway. Thin smoked cod is still cod."]))
    r.npc("onrac_smoker_apprentice", "boy", 9, 5, when(
        (LIT, ["The master's whistling. The master never whistles. It's unsettling, honestly."]),
        default=["I count the salt barrels. There are four. I count them again tomorrow. There will be four."]))
    out.append(r.save(note("a smokehouse round a smoking hearth, crates of cod on the floor and salt in a back store",
                           "the hearth set in the back wall for smoking, not for warmth; a salt store through a low "
                           "doorway on the east", "two rooms joined by an inner doorway; the door is the only way in "
                           "or out"), {**COLD, "in_wall_face": {"from": "castle_face", "shade": 0.55}}, [90, 60, 40]))


def shipwright(out: list[Path]) -> None:
    """The shipwright's shed: the submarine's plans on the drawing table, rivets in barrels, the bunk room behind."""
    r = ONR.house("shipwright", "Shipwright's Shed", 14, 10, [7])
    g = r.g
    g.carve(1, 3, 12, 8, "-")
    g.carve(1, 3, 3, 5, "_")                          # the bunk corner
    r.open_exit("-")
    g.faces(2)
    r.wall([["window_in"]], 5, 1)
    r.wall([["window_in"]], 9, 1)
    r.wall([["weapon_rack"]], 11, 1)                  # the tool rack
    r.deco([["map_table_l", "map_table_r"]], 6, 4)    # the submarine's plans
    r.one("desk", 9, 4)
    r.one("globe", 12, 3)
    r.tall("bed", 1, 3)
    for (x, y) in [(11, 7), (12, 7), (12, 8)]:
        r.thing("barrel", x, y)
    r.thing("crate", 1, 8)
    r.npc("onrac_shipwright_daughter", "mage", 7, 6, when(
        (LIT, ["Her hull held at the shrine's depth with not a rivet sprung. I'm putting that in the margin in red."]),
        (FREED, ["You set Gaia's fairy free? Then she gave you oxyale, and you can breathe where my father's iron goes."]),
        default=["These are the plans: an iron hull, sealed twice, ballast tanks, a hatch that opens from inside.",
                 "Down there the water itself is the problem. You need air that lives in water. Father calls it oxyale."]))
    r.npc("onrac_shipwright_hand", "farmer", 4, 7, when(
        (CUBE, ["A humming box from behind the waterfall? Keep it away from the compass, please."]),
        default=["Riveting all morning, caulking all afternoon. At night I dream of rivets. They're caulking me."]))
    out.append(r.save(note("a shipwright's shed of drawings and rivet barrels, a bunk in the corner",
                           "the submarine's plans on a drawing table under the windows; a tool rack hung where other "
                           "houses keep a shelf"), {**COLD, "floor": wood(0.7), "in_wall_face": STONE_FACE}))


def healer(out: list[Path]) -> None:
    """The healer's house (the shrine sign): a row of cots, the stove in the west corner, the clinic at the salve table."""
    r = ONR.house("healer", "Healer's House", 12, 10, [6])
    g = r.g
    g.carve(1, 3, 10, 8, "-")
    g.carve(6, 4, 10, 6, "+")
    r.open_exit("-")
    g.faces(2)
    for x in (6, 8, 10):
        r.tall("bed", x, 3)
    r.fireplace(1, 1)
    r.wall([["potion_shelf"]], 3, 1)
    r.wall([["potion_shelf"]], 4, 1)
    r.one("table", 2, 4)
    r.one("orb_white", 1, 8)
    r.one("plant", 10, 8)
    r.npc("onrac_healer", "healer", 3, 5,
          ["Cold takes the weak and the sea takes the brave. I can call back either, if you're quick. Lay them down."],
          action="clinic", clinicPrice=90)              # GAP-16: 90 G per level of each fallen member (B6)
    r.npc("onrac_frostbitten", "villager", 8, 6, when(
        (LIT, ["My toes have stopped tingling. The healer says it's her salve. I say it's the warm wind."]),
        default=["Fell through the harbour ice chasing a hat. The hat got away. Two of my toes nearly did too."]))
    r.npc("onrac_healer_nurse", "young_woman", 5, 7, when(
        (LIT, ["We let the stove go out this afternoon. Nobody even noticed. Imagine!"]),
        default=["Keep the stove fed, keep the blankets warm, and keep the sailors out of the brandy. That's the job."]))
    out.append(r.save(note("a healer's house: a row of cots along the back wall, the stove in the west corner, salves on shelves by it",
                           "the salve table by the hearth where the fallen are brought back; a carpet laid in front "
                           "of the three cots"), {**COLD, "in_wall_face": STONE_FACE}, [200, 210, 230]))


def tanner(out: list[Path]) -> None:
    """The tanner's: sealskins on frames, the scraping bench, a hearth room for the family behind."""
    r = ONR.house("tanner", "Tanner's House", 11, 9, [2])
    g = r.g
    g.carve(1, 3, 5, 7, "-")                          # the workroom
    g.carve(7, 3, 9, 7, "_")                          # the family's room
    g.carve(6, 4, 6, 5, "_")
    r.open_exit("-")
    g.faces(2)
    r.wall([["banner"]], 2, 1)                        # a sealskin stretched on the wall
    r.wall([["banner"]], 4, 1)
    r.fireplace(7, 1)
    r.one("stone_bench", 3, 4)                        # the scraping bench
    r.tall("bed", 9, 3)
    r.thing("barrel", 1, 7)
    r.thing("crate", 5, 7)
    chest(r, "tanner", "ether", "an Ether", 1, 3)
    r.npc("onrac_tanner", "burgher", 4, 5, when(
        (LIT, ["The seals are back on the stacks. I won't hunt them this year. Seems only fair, after all that."]),
        default=["Sealskin. Waterproof, warm, and smells like a seal forever. You get used to the last part.",
                 "The seals left the stacks when the sea went wrong. I'm working through the last of the store."]))
    r.npc("onrac_tanner_wife", "villager_f", 8, 5, when(
        (LIT, ["He opened the window today. In Onrac! In winter! I nearly called the healer."]),
        default=["Come in by the fire. Don't mind him. Don't mind the smell either, if you can manage it."]))
    out.append(r.save(note("a tanner's house: a workroom of sealskins and a scraping bench, the family's hearth beyond",
                           "sealskins stretched on the workroom wall; the hearth in the family's room, not in the "
                           "workroom", "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {**COLD, "floor": wood(0.75), "in_wall_face": {"from": "in_wall_face", "shade": 0.8}}))


def build() -> list[Path]:
    out: list[Path] = []
    for f in (bellringer, netmender, smoker, shipwright, healer, tanner):
        f(out)
    return out

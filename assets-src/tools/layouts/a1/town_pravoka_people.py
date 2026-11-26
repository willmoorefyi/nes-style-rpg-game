"""Pravoka's outdoor people (docs/WORLD_PLAN.md 4.0.1, 4.1; A1-T): the pirates, Captain Bikke and his fight, and the
townsfolk, whose lines change on BIKKE_DEFEATED. Every line is original. Read by `town_pravoka.py`.

- The pirates are tinted `guard` and `villager` sheets with `hideIf: BIKKE_DEFEATED`. The captain is a tinted
  `warrior` at the brig pier's end. Talking to him starts `pirate` x9 (`isBoss`). The victory plays
  `a1_bikke_yields`, which sets BIKKE_DEFEATED. The ship then waits at the `a1_pravoka` dock (the site file).
- The dockhands are shown only once the pirates are gone (`showIf`), and so is the beaten captain, who has turned
  harbour pilot.
- Two hint NPCs (`*_hint`) name Elfheim and Matoya.
- PT-2 (docs/PLAYTEST_ELFHEIM_PLAN.md): the townsfolk (`folk`, the hint NPCs among them) stay indoors until
  BIKKE_DEFEATED (`showIf`); before it only the pirates walk the streets.
"""
from __future__ import annotations

BEATEN = "BIKKE_DEFEATED"
RED, TAR, SALT = "#c86450", "#8c7a64", "#b4c8dc"     # pirate tints: red sash, tarred coat, sun-bleached
CAPTAIN = (40, 33)
CAPTAIN_AFTER = (26, 36)                             # beaten, he watches his old brig from the high street

CAPTAIN_FIGHT = {
    "x": CAPTAIN[0], "y": CAPTAIN[1], "npc": "bikke", "enemyIds": ["pirate"] * 9, "flag": BEATEN, "isBoss": True,
    "message": "Bikke: All hands! These four think Pravoka is free for the taking. Show them the price!",
    "postVictoryCutscene": "a1_bikke_yields",
}

# the gate and the brig pier: wanderers stay out of the way in
NO_WANDER = [[x, y] for x in range(0, 6) for y in (34, 35)] + [[x, y] for x in range(31, 41) for y in (33, 34)]


def said(after: list[str], before: list[str]) -> list[dict]:
    """A line that changes once the pirates are gone."""
    return [{"condition": BEATEN, "text": after}, {"text": before}]


def pirate(pid: str, sprite: str, tint: str, x: int, y: int, lines: list[str], **kw) -> dict:
    return {"id": pid, "sprite": sprite, "tint": tint, "x": x, "y": y, "hideIf": BEATEN, "dialog": lines, **kw}


def npc(pid: str, sprite: str, x: int, y: int, dialog, **kw) -> dict:
    return {"id": pid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


def folk(pid: str, sprite: str, x: int, y: int, dialog, **kw) -> dict:
    """A townsperson: indoors while the pirates hold the town, out once they are gone (PT-2, presence only)."""
    return npc(pid, sprite, x, y, dialog, showIf=BEATEN, **kw)


def npcs() -> list[dict]:
    return [
        # ── the pirates (gone once the captain is beaten) ──
        pirate("pirate_gate", "guard", RED, 2, 36, [
            "Pirate: Welcome to Pravoka, friends. Captain's town now.",
            "The shops are shut by the Captain's order. The inn and the keeper's sick-room stay open, at a price.",
            "Sleep where you're let, and don't go near the brig. Simple rules."]),
        pirate("pirate_quay_n", "villager", TAR, 29, 18, [
            "Pirate: Those warehouses are the Captain's strongroom now. Every crate in them is ours by right.",
            "By right of being here first with cutlasses, that is."]),
        pirate("pirate_quay_s", "guard", SALT, 30, 30, [
            "Pirate: No boat leaves this fjord without the Captain's leave.",
            "The fishers asked. You can see how far it got them."]),
        pirate("pirate_den_a", "villager", RED, 18, 34, [
            "Pirate: That's our den behind me. Knock if you like. The quartermaster counts your coin before you're in."]),
        pirate("pirate_den_b", "guard", TAR, 21, 35, [
            "Pirate: Nine of us, the Captain counted. Nobody in this town is fool enough to count higher."]),
        pirate("pirate_pier", "villager", SALT, 33, 33, [
            "Pirate: Off the pier, landlubber. The Captain's at the end of it, and he's in a mood.",
            "Mind you, he's always in a mood."]),
        pirate("pirate_inn", "guard", RED, 27, 26, [
            "Pirate: The innkeeper gives us the best beds for nothing. Out of kindness, he says."], wander=True),
        # ── the captain, and the captain after ──
        {"id": "bikke", "sprite": "warrior", "tint": "#a03c3c", "x": CAPTAIN[0], "y": CAPTAIN[1], "hideIf": BEATEN,
         "dialog": ["Bikke: So you're the ones the town has been whispering about. Warriors, they say.",
                    "I took this harbour with eight blades, my own the ninth, and a fast hull. If you want it back, you'll pay in blood."]},
        npc("bikke_after", "warrior", *CAPTAIN_AFTER, [
            "Bikke: The brig is yours, and I keep my word. She's tied at the quay outside the town.",
            "Board her from the land and she'll take you anywhere the sea goes. She won't climb a mountain, mind."],
            tint="#a03c3c", showIf=BEATEN),
        # ── the hint NPCs (4.0.1) ──
        folk("old_sailor_hint", "old_man", 36, 27, said(
            ["Now there's a ship free, you could sail to Elfheim, the elves' city.",
             "South down the channel, then west along the coast. The elves have a prince who will not wake, they say."],
            ["I sailed to Elfheim forty times before these pirates came. I'll not see it again, I think.",
             "South down the channel, west along the coast. A week with a fair wind. If anyone held a ship."])),
        folk("herbwife_hint", "vendor_f", 24, 39, said(
            ["Matoya's broth is the only cure for what ails the deep sleepers. That's what my mother said.",
             "She lives in a cave in the woods, far to the north-west, over the pass. Blind as a stone, poor thing."],
            ["Herbs, dried and fresh! Not much else to sell with the pirates eating everything.",
             "If it's a real cure you want, ask Matoya. She keeps a cave in the north-west woods, over the pass."])),
        # ── the townsfolk ──
        folk("fishwife", "vendor_f", 20, 39, said(
            ["Fresh fish again! The boats went out this morning for the first time in a month."],
            ["Fish? I've three herrings and a sorry crab. The boats can't put out past the pier."]), tint="#a0c0d8"),
        folk("fisher", "villager", 33, 27, said(
            ["Listen to that: oars! The whole fleet's out. Pravoka breathes again."],
            ["The pirates let me fish off the pier. Generous. The fish off the pier are this long."])),
        npc("dockhand_a", "farmer", 30, 22, [
            "Dockhand: Crates back where they belong, and wages paid in coin, not in threats. A good week."],
            showIf=BEATEN),
        npc("dockhand_b", "burgher", 38, 20, [
            "Dockhand: Old Hennick's warehouse is open again. They hid half the town's grain in there."],
            showIf=BEATEN),
        folk("lamplighter", "villager", 15, 28, said(
            ["Every lamp on Lantern Street lit, and nobody to blow them out for a laugh. Lovely."],
            ["I light the lamps at dusk. The pirates blow them out. I light them again. It passes the evening."]),
            wander=True),
        folk("watchman", "guard", 16, 10, said(
            ["Town watch! Er, we were biding our time. Waiting for the right moment. Which you found. Well done."],
            ["The town watch is on duty. Quietly. Out of sight of the quay."])),
        folk("girl", "villager_f", 8, 26, said(
            ["My father works the warehouse again. He brought me a sugared fig!"],
            ["The pirate captain has a cutlass taller than me. I saw it. I'm not scared. Much."]), wander=True),
        folk("old_man", "old_man", 25, 4, said(
            ["Look there: the lighthouse will burn again tonight. Ships will find the fjord."],
            ["From this bench you can see the whole fjord. Not one sail on it. Not since the brig came."])),
    ]

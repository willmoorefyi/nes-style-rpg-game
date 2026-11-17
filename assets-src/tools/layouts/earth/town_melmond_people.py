"""The people of Melmond outdoors (docs/WORLD_PLAN.md 4.0.1, 4.3; ERT-T): every line is written new.

Melmond is reached once the canal is cut (CANAL_OPEN, S10). Its people talk about the rot in the soil, the Cavern of
Earth to the south-west and the giant in the western tunnel (the two hint people, `*_hint`); their lines change when
the vampire falls (VAMPIRE_DEFEATED), when the Earth crystal is lit (EARTH_CRYSTAL_LIT: the fields bloom) and, for
the few who know Dr. Unne, when he reads the sky-folk's tongue again (LUFENIAN_LEARNED). The first matching entry
wins, so the later flag always comes first.
"""
from __future__ import annotations

LIT, VAMP, LEARNED = "EARTH_CRYSTAL_LIT", "VAMPIRE_DEFEATED", "LUFENIAN_LEARNED"
DWARF = "#b08860"                                # the dwarves' ruddy tint (as in the dwarf hall)

BOARDED_TEXT = [
    "The door is nailed shut. A note is tacked to the planks, its ink run by the rain.",
    "\"Gone to my sister's on the isthmus. The ground here won't take a seed. Feed the cat if you see her. - Orla\"",
]
SIGNPOST_TEXT = [
    "The sign reads: \"MELMOND. Harbour road east to the quay.\"",
    "Under it, in fresh chalk: \"Hill lane north: the Doctor, the mill. Field lane south: the Inn, the healer.\"",
]


def when(*pairs: tuple[str, list[str]], default: list[str]) -> list[dict]:
    """A dialog: (flag, lines) pairs in order (the first set flag wins), then the default lines."""
    return [{"condition": f, "text": t} for f, t in pairs] + [{"text": default}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


def outdoor() -> list[dict]:
    """The outdoor people (15; none is a keeper). Coordinates are melmond.yaml cells (town_melmond.py)."""
    return [
        npc("melmond_quay_warden", "guard", 41, 21, when(
            (LIT, ["Ships put in every day now. Every one of them leaves low in the water, full of our grain."]),
            default=["Welcome to Melmond, if you can stand the smell of it. That's the soil, souring.",
                     "You're the first ship through the dwarves' cut. I hope you didn't sail all this way to buy food."])),
        npc("melmond_cavern_hint", "old_man", 24, 19, when(
            (LIT, ["I went down to the Cavern of Earth's mouth this morning. Warm air breathes out of it now, like a "
                   "sleeper's.", "Whatever you did down there, the ground felt it all the way up here."]),
            (VAMP, ["The thing in the Cavern of Earth is dead, they say, but the cold under the badlands is still there.",
                    "Go deeper. Below the crypt, past a seal of stone, there is a frozen hall nobody has come back from."]),
            default=["The rot comes up out of the Cavern of Earth, south-west of here, in the grey badlands.",
                     "Something lives in its upper halls that drinks the warmth out of the ground. A vampire, the old "
                     "folk say."])),
        npc("melmond_giant_hint", "farmer", 9, 21, when(
            (LIT, ["My cousin came over the range through the giant's tunnel last week. Brought turnips. Turnips!"]),
            default=["West of town the range is a wall, with one tunnel through it. A giant lies across the tunnel "
                     "and won't budge.", "He grumbles about his stomach. I'd say a giant that size only eats stones, "
                     "and only the red, shiny kind."])),
        npc("melmond_well_keeper", "villager_f", 26, 18, when(
            (LIT, ["Hear that? Water, down the well again! Sweet, too. I'd almost forgotten the taste."]),
            default=["Thirty fathoms of rope, and the bucket comes up full of grey sand. My grandfather dug this well.",
                     "He said it would never run dry. He also said the moon was a turnip, mind."])),
        npc("melmond_oak_child", "villager", 21, 21, when(
            (LIT, ["The old oak has a leaf! One leaf, right at the top. I'm going to name it."]),
            default=["Mum says the big tree on the green isn't dead, only sleeping. It's been sleeping a long time."]),
            wander=True),
        npc("melmond_fieldhand", "farmer", 13, 29, when(
            (LIT, ["Green from fence to fence! I planted on Monday and by Thursday I could hide in it."]),
            default=["Plough it, seed it, water it, and the shoots come up grey and fall over.",
                     "It isn't the weather. Something is pulling the life out from under the roots."])),
        npc("melmond_vine_dresser", "villager_f", 10, 7, when(
            (LIT, ["The vines are budding along every row. We'll press wine this autumn after all!"]),
            default=["These vines are older than the town. Their bark peels off in your hand now, like paper."])),
        npc("melmond_shore_fisher", "villager", 40, 9, when(
            (LIT, ["The fish are back in the shallows, fat and silly. The sea knew before we did."]),
            default=["Nets come up empty all along this shore. Even the fish keep away from the land now."])),
        npc("melmond_carter", "burgher", 34, 20, when(
            (VAMP, ["A wraith of a thing came screaming out of the badlands two nights back, and none since.",
                    "If you did that, I'll carry your packs to the Cavern for free. Well, for half."]),
            default=["I haul grain to the quay. There's no grain, so I haul my own empty cart up and down.",
                     "Nobody takes the badlands road after dark. Things walk there that cast no shadow."]), wander=True),
        npc("melmond_mill_lad", "thief", 36, 11, when(
            (LIT, ["The sails turned on their own this morning! Master Hobb says the earth's breathing again."]),
            default=["The windmill leans a hand's width further every year. The ground under it is going soft.",
                     "Master Hobb won't let me grind. There's nothing to grind anyway."])),
        npc("melmond_stall_widow", "vendor_f", 26, 23, when(
            (LIT, ["Fresh beans, fresh greens, fresh everything! I'm opening the stall again tomorrow."]),
            default=["I sold vegetables from this stall for thirty years. Now I sell the stall's shade. Nobody's buying."])),
        npc("melmond_doctor_pupil", "mage", 24, 13, when(
            (LEARNED, ["The Doctor reads the sky-folk's script as easily as you read a menu now.",
                       "He says their village is on a mesa in the far north-east, reachable only by air."]),
            default=["I sweep for Doctor Unne, the scholar on the hill lane. He studies tongues nobody speaks.",
                     "He lost his best work at sea, years ago. A stone tablet. He still dreams about it."])),
        npc("melmond_pond_elder", "old_man", 28, 32, when(
            (LIT, ["The pond is filling from the springs again. Give it a season and my grandson can swim in it."]),
            default=["When I was a boy this millpond turned the wheel all summer. Look at it. A puddle with ideas."])),
        npc("melmond_dwarf_trader", "burgher", 42, 18, when(
            (LIT, ["Melmond grain for dwarf iron, a fair trade at last. Nerrick sends his regards."]),
            default=["Nerrick's canal brought me here with a hold full of picks and spades.",
                     "Turns out nobody needs a spade for soil that's turned to dust."]), tint=DWARF),
        npc("melmond_wayfarer", "monk", 27, 30, when(
            (LIT, ["I felt the crystal wake from the road. It was like a held breath let go.",
                   "The earth is whole. Three more lights to go, they say: fire, water and wind."]),
            default=["I came to pray at the earth shrine in the badlands. Its roof has fallen in. Roots have split "
                     "the altar.", "A crystal of earth sleeps somewhere under this land. I would like to see it "
                     "wake before I die."]), wander=True),
    ]

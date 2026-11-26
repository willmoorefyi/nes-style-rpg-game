"""The people of Gaia outdoors (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-T): every line is written new.

Gaia is a town of millers in a mountain bowl, reached only by air (S17's airship). Its wind came down from the spring
at the top of the town, where a small fairy lived; a dune trader's caravan crossed the pass a year ago, the fairy
followed the shine of a glass bottle into the trader's pack, and since then the spring is dry and the sails stand
still. The people speak of the dead calm, the caravan in the western desert (S22, where the bottle is sold), the
sky-folk of Lufenia on the southern mesa and the Mirage Tower in the sands (the two hint people, `*_hint`). Their lines
change when the party carries the bottle (`item:fairy_bottle`) and when the fairy is freed (FAIRY_FREED: the wind
comes back). The first matching entry wins, so the later state always comes first.
"""
from __future__ import annotations

FREED, BOTTLE = "FAIRY_FREED", "item:fairy_bottle"

SIGNPOST_TEXT = [
    "The sign reads: \"GAIA. Four terraces, one way up. Mind the bridges in a gust.\"",
    "Below, in older paint: \"Gate terrace: the Inn, items, arms, armour. Mill terrace: the magic shops. "
    "Loom terrace: the healer. Top: the spring.\"",
]
VANE_TEXT = [
    "A tall post topped with a wooden arrow: the town's weather vane. Its spindle is clean and oiled.",
    "It points at nothing in particular, and it has pointed there for a year.",
]
VANE_FREED = ["The wooden arrow spins on its spindle into the wind, then swings back the other way, as if it "
              "cannot decide where to point first."]
SHUTTERED_TEXT = [
    "The tall house is shuttered. A slate hangs on the door, chalked in a careful hand:",
    "\"Wind-reader's house. No wind to read. Gone down the mountain to look for it. - Ilse\"",
]
WINDLASS_TEXT = [
    "A stone well-head on the lip of the gorge. Its windlass rope runs down to the torrent far below, and a dripping "
    "bucket hangs from it.",
    "Somebody has scratched a tally on the post: one stroke for every bucket hauled since the spring went dry.",
]


def when(*pairs: tuple[str, list[str]], default: list[str]) -> list[dict]:
    """A dialog: (condition, lines) pairs in order (the first that holds wins), then the default lines."""
    return [{"condition": f, "text": t} for f, t in pairs] + [{"text": default}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


def outdoor() -> list[dict]:
    """The outdoor people (19; none is a keeper). Coordinates are gaia.yaml cells (town_gaia.py)."""
    return [
        # ── the gate terrace ──
        npc("gaia_gate_warden", "guard", 16, 43, when(
            (FREED, ["Feel that on your face? That's the bowl breathing again. I'd stopped noticing I was holding my "
                     "own breath."]),
            default=["You came by air? Nobody walks up here. The passes are worse than the drop.",
                     "Welcome to Gaia. Take the switchbacks slowly; the town's built one terrace on the next."])),
        npc("gaia_water_hauler", "young_woman", 35, 40, when(
            (FREED, ["The spring is running down the court's channel again. I'm leaving this bucket on the rope for "
                     "the gorge spirits."]),
            default=["Three hundred feet of rope, and the bucket comes up half spilled. That's our water now.",
                     "When the spring at the top still ran, I never once carried water. I didn't know how heavy it was."])),
        npc("gaia_dune_trader", "burgher", 39, 43, when(
            (FREED, ["The fairy's free? Good. I traded with that caravan for years and never once thought to look in "
                     "their bottles."]),
            (BOTTLE, ["A bottle from the dune caravan, and it's warm? Don't open it down here! Take it up to the spring "
                      "at the top."]),
            default=["The dune caravan came over our pass a year back. Rugs, salt, glassware. They camp in the western "
                     "desert now.", "Since they left, the sails haven't turned once. I've wondered what they carried "
                     "off besides our coin."])),
        npc("gaia_mirage_hint", "old_man", 30, 43, when(
            (FREED, ["With the wind back I can hear the Mirage Tower again on still nights, humming like a glass "
                     "rubbed with a wet finger."]),
            default=["South-west of the bowl, out in the sands, stands the Mirage Tower. Some days you see it, some "
                     "days you don't.", "Its door has no handle and no lock. They say the sky-folk ring it open with "
                     "a chime."])),
        npc("gaia_child", "girl", 22, 43, when(
            (FREED, ["My paper kite flew! It flew right up past the mill terrace and got stuck on the spinner's roof!"]),
            default=["I made a paper kite. Grandad says I'll have to run very fast for it to fly. I ran and ran."]),
            wander=True),
        npc("gaia_sail_mender", "farmer", 4, 40, when(
            (FREED, ["The sails are full and pulling! I've three tears to mend already. Wonderful, wonderful tears."]),
            default=["I mend the canvas on the sails. A sail that never turns never tears.",
                     "I've mended every sail in Gaia twice over, just to keep my hands busy."])),
        # ── the mill terrace ──
        npc("gaia_mill_lad", "boy", 14, 25, when(
            (FREED, ["The millstones are grinding! Master Brann sang. I didn't know he could. He can't, actually."]),
            default=["I'm the windmiller's lad. I oil the gears every morning in case today's the day.",
                     "It's never the day."])),
        npc("gaia_ropewalker", "burgher", 24, 32, when(
            (FREED, ["The footbridges hum when the gusts come through. I'll be out on them all week, tightening "
                     "knots."]),
            default=["Every bridge in town is my family's rope. Hemp from the lowlands, plaited on the walk behind "
                     "our house.", "Mind, they sway less now there's no wind. That's the only good thing about it."])),
        npc("gaia_lufenia_hint", "mage", 33, 32, when(
            (FREED, ["Now the wind is home I mean to fly south to Lufenia myself. If I can find someone who reads "
                     "their tongue."]),
            default=["Due south, on a mesa ringed with cliffs, live the sky-folk of Lufenia. Their speech is like "
                     "nothing on earth.", "A doctor in Melmond spent his life on it, I'm told. Without him their words "
                     "are only music."])),
        npc("gaia_herb_picker", "villager_f", 45, 27, when(
            (FREED, ["The mountain thyme is waking up on the ledges. The wind carries its seed; it was waiting too."]),
            default=["I pick herbs on the ledges. Without the wind the seed doesn't travel, and the ledges are going "
                     "bare."])),
        npc("gaia_old_soldier", "guard", 6, 32, when(
            (FREED, ["I stood watch on that stair forty years. Never once did it feel as good as this breeze."]),
            default=["Nothing has come up the stairs to fight in a year. Not even weather.",
                     "A town that can't hear the wind can't hear what's coming. I keep my sword by the bed."])),
        # ── the loom terrace ──
        npc("gaia_shepherd_boy", "boy", 44, 16, when(
            (FREED, ["Father's taking the flock up to the high grass again tomorrow. The wind keeps the flies off them."]),
            default=["The fold's empty. Father drove the sheep down to the lower bowl; the grass up here went brown "
                     "with no rain."])),
        npc("gaia_honey_seller", "vendor_f", 21, 21, when(
            (FREED, ["The bees are out over the whole bowl! I'll have honey to sell by the next moon."]),
            default=["The bees won't fly in dead air. They sit in the hives and hum, sulking.",
                     "I'd sell you honey, but they've eaten most of it themselves."])),
        npc("gaia_weaver_girl", "girl", 14, 15, when(
            (FREED, ["We hang the wool out to dry in the wind again. It used to take a morning; then it took a week."]),
            default=["The spinner's teaching me the long wheel. You need a dry wind for good wool, she says."])),
        npc("gaia_wind_watcher", "old_woman", 38, 21, when(
            (FREED, ["The fairy's breath is back in the bowl. It goes in at the spring and out over every sail. Listen."]),
            (BOTTLE, ["That bottle hums. Can you feel it? Something inside it knows where it is. Climb to the spring."]),
            default=["We say the wind is the breath of the spring's fairy. A little winged thing, no bigger than your "
                     "thumb.", "When the spring went dry, she was gone. Nobody saw her go."])),
        # ── the spring court ──
        npc("gaia_spring_pilgrim", "pilgrim", 21, 7, when(
            (FREED, ["Water in the channel and wind in the court. I'll go home and tell them the mountain is well."]),
            default=["I walked up from the lowlands to pray at the spring. I found a dry channel and a cold grotto.",
                     "I'll pray anyway. It's a long walk back."])),
        npc("gaia_vane_keeper", "old_man", 19, 5, when(
            (FREED, VANE_FREED + ["Ha! Look at it go. I've oiled that arrow every day for a year for this."]),
            default=["I keep the weather vane. Every morning I oil it, and every morning it points the same way.",
                     "The spring is through the grotto behind the court. The warden sits by it day and night."])),
        npc("gaia_court_child", "boy", 30, 4, when(
            (FREED, ["The channel's full of water! I put a leaf boat in at the top and it got all the way to the end!"]),
            default=["I sail leaf boats down the dry channel. You have to push them. It isn't the same."]),
            wander=True),
        npc("gaia_mill_watcher", "farmer", 41, 7, when(
            (FREED, ["Both high mills are turning! From here you can see every sail in the bowl going round."]),
            default=["From this ledge you can see every windmill in Gaia. I count them each evening. They're all "
                     "still there. All still."])),
    ]

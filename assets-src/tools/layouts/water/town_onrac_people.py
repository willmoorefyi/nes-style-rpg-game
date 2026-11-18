"""The people of Onrac outdoors (docs/WORLD_PLAN.md 4.0.1, 4.6; WAT-T): every line is written new.

Onrac is reached by air once the airship flies (S17, S20). Its people talk about the cold, the drowned city under the
bay and the oxyale chain: the caravan in the western dunes sells a bottle (the caravan hint), a fairy kept in a bottle
breathes the air of the deep (Gaia's spring, the oxyale), and the shipwright's submarine waits in the dry dock for it.
The waterfall hint sends the party up the river by canoe. Lines change when the party holds the oxyale (`item:oxyale`)
and when the Water crystal is lit (WATER_CRYSTAL_LIT: the sea calms and the bell rings by itself). The first matching
entry wins, so the later state always comes first.
"""
from __future__ import annotations

LIT, FREED, OXY, BOTTLE = "WATER_CRYSTAL_LIT", "FAIRY_FREED", "item:oxyale", "item:fairy_bottle"
CUBE = "CUBE_GIVEN"

SIGNPOST_TEXT = [
    "The sign reads: \"ONRAC. Mind the ice on the quay steps.\"",
    "Under it, scratched with a knife: \"Bell Road south to the harbour. Tar Lane east to the dry dock.\"",
]
BELL_TEXT = [
    "A green-black bell hangs in the tower's open arch. Its bronze is crusted with barnacles that no one has scraped.",
    "Letters run round its lip in a script nobody here can read. It came up in a net, the year the city sank.",
]
GATE_MESSAGE = [   # the submarine gate (keyItemGates requiredItem: oxyale), in the shipwright's voice
    {"condition": BOTTLE, "text": [
        "The shipwright calls from the walkway: \"That bottle! Something inside it is knocking to get out.\"",
        "\"Take it to Gaia's spring and open it there. Bring me back the air of the deep, and she sails.\""]},
    {"text": [
        "The shipwright bars the gangway: \"Not without air for the deep, friend. My hull holds, your lungs won't.\"",
        "\"They say the fairies of Gaia's spring breathe a living air, oxyale. Bring me that and we dive.\""]},
]


def when(*pairs: tuple[str, list[str]], default: list[str]) -> list[dict]:
    """A dialog: (condition, lines) pairs in order (the first that holds wins), then the default lines."""
    return [{"condition": c, "text": t} for c, t in pairs] + [{"text": default}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


def outdoor() -> list[dict]:
    """The outdoor people (17; none is a keeper). Coordinates are onrac.yaml cells (town_onrac.py)."""
    return [
        npc("onrac_gate_watch", "guard", 25, 3, when(
            (LIT, ["The wind has turned warm off the sea. First time in my life I've stood this watch without gloves."]),
            default=["Onrac. Come in, warm yourselves. You didn't walk here, I'd wager. Nobody walks here.",
                     "Mind the quay steps. They ice over at noon and stay iced till spring."])),
        npc("onrac_waterfall_hint", "old_man", 21, 19, when(
            (CUBE, ["You've been behind the waterfall! And came back with a box that hums. I'd not keep it near my bed."]),
            default=["North of town the river climbs into the peaks to a great waterfall. There is a cave behind it.",
                     "No path reaches it. Only a canoe, paddled up the gorge against the current, gets you there.",
                     "My grandmother saw a man of iron standing in that cave. She never went back to ask his name."])),
        npc("onrac_caravan_hint", "burgher", 8, 24, when(
            (FREED, ["The caravan's bottle, set free at last? Then the trader sold you the best bargain of his life."]),
            default=["Traders camp in the dunes far to the west. A caravan, with tents round a rock in the sand.",
                     "Their master keeps a bottle he won't name. Something glows in it. He wants a fortune for it.",
                     "Pay it. A caravan man only asks a fortune for a thing that's worth two."])),
        npc("onrac_fairy_lore", "monk", 20, 22, when(
            (LIT, ["The sea gave back its crystal's light. I felt the tide go out of my chest like a held breath."]),
            (OXY, ["You carry the fairy's air. Every drowned soul under the harbour will feel you coming down."]),
            default=["There are fairies who live in springs and breathe a water that is also air. Oxyale, it's called.",
                     "One of them was caught in a bottle long ago and carried off. Gaia's spring has been dry since."])),
        npc("onrac_bell_child", "villager", 25, 21, when(
            (LIT, ["The bell rang by itself last night! Three times! Grandad says that means the city is sleeping."]),
            default=["Grandad rings the sea bell at dusk. He says it's so the drowned people know what time it is."]),
            wander=True),
        npc("onrac_rack_wife", "villager_f", 9, 17, when(
            (LIT, ["The cod are running again, thick as porridge. These racks won't hold the half of them."]),
            default=["Cod on the racks, a frost on the cod. The wind dries it, the cold keeps it. Onrac in a sentence.",
                     "The shoals have thinned every year since the sea went wrong. We dry what we can."]), wander=True),
        npc("onrac_tar_boiler", "farmer", 14, 4, when(
            (LIT, ["The pitch flows in this warm wind. I'll tar every hull in the harbour by the week's end."]),
            default=["Pine tar, boiled thick. Every plank in this town drinks a pot of it a year, or the sea drinks it.",
                     "Don't lean on the pot. I've had two apprentices and both were careless."])),
        npc("onrac_net_lad", "thief", 18, 32, when(
            (LIT, ["My net came up so heavy I thought I'd caught the sunken city. It was only fish! Hundreds!"]),
            default=["We fish the shallows only. Past the sea-stacks the water turns black and the nets come back torn."]),
            wander=True),
        npc("onrac_harbour_master", "guard", 33, 32, when(
            (LIT, ["Ships are putting in from every coast. I've had to learn how to say 'no berth' in four tongues."]),
            default=["Harbour's half empty. The deep water out past the stacks drags ships down and nothing comes back.",
                     "Your airship is the only safe vessel I've logged all year. I've written it under 'birds'."])),
        npc("onrac_ice_trader", "merchant", 8, 32, when(
            (LIT, ["No ice to cut this week! The harbour's soft as soup. I may have to sell fish like everybody else."]),
            default=["I cut ice off the north pools and sell it south. Down there they put it in drinks. Can you imagine?"])),
        npc("onrac_widow", "villager_f", 21, 33, when(
            (LIT, ["The sea is quiet now. I think he can rest. I think I can too."]),
            default=["My husband went out past the stacks after the bell's twin. It's said a second bell lies down there.",
                     "That was nine winters ago. I come here at the turn of the tide. You'd think I'd stop."])),
        npc("onrac_mermaid_tale", "villager_f", 30, 41, when(
            (LIT, ["The singing under the pier has changed. It sounds like they're laughing now."]),
            default=["On still nights you can hear singing under this pier. My mother called them the sea-folk.",
                     "She said they live in the deep shrine's upper halls and know every way through it. Ask them, if "
                     "you ever get down there."])),
        npc("onrac_fisher", "farmer", 13, 39, when(
            (LIT, ["Look at the water! Clear down to the weed. I can see my own lost anchor."]),
            default=["The cold out here gets into your teeth. Bite on something, it helps. I bite my pipe."])),
        npc("onrac_lookout", "old_man", 42, 4, when(
            (LIT, ["From up here the sound was always grey. Now it's blue as a jay. I'd forgotten it could be."]),
            default=["I watch the sea for the town. Mostly I watch weather. Lately the weather watches back.",
                     "There's a dark patch out in the sound that never ices over. That's where the city went down."])),
        npc("onrac_shipwright", "master", 36, 24, when(
            (LIT, ["She came back with barnacles on her barnacles. Best dive a hull of mine ever made."]),
            (OXY, ["That's oxyale in your lungs, I can smell it, like snow and lightning. Board her! The gangway's yours."]),
            default=["The iron fish in the basin is mine. Twelve years riveting. She'll go down to the drowned shrine "
                     "under the harbour.", "But her crew must breathe down there, and no lungs can. Not without oxyale, "
                     "the fairy's air."])),
        npc("onrac_dock_hand", "farmer", 45, 22, when(
            (LIT, ["We're scraping her hull now she's back. The weed on her is a colour I've never seen."]),
            default=["Pump, caulk, pump, caulk. The master keeps the sea-gate shut till she's ready to dive."]), wander=True),
        npc("onrac_sailor", "burgher", 45, 30, when(
            (LIT, ["My ship's fitting out for the south. With the sea calm, I'll be home before the ice."]),
            default=["Stranded. My captain won't sail past the stacks, and I won't swim. So here I sit, eating cod."])),
    ]


# wanderers keep off the gangway and the cells beside the gate's two road cells
NO_WANDER = [[37, 27], [38, 27], [23, 2], [24, 2]]

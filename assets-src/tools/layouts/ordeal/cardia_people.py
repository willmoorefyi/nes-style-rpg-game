"""The people of Cardia Deep (pass CD, docs/CARDIA_PLAN.md 5.5): Bahamut and the six dragon-kin of the old lair (their
ids, trade, flags and lines kept, Ember with AR-N3's), and the villagers (`ord_cd_*`; every line original and dry).
24 named NPCs plus `bahamut_after`: 25 entries. Sprites: the AR-N2 dragon-kin sheets (`dragon_guard`, `dragon_elder`,
`dragon_youth`) and CD-N's four (`bahamut`, `dragon_hatchling`, `dragon_matron`, `dragon_sage`; NEW_SHEET). No NPC
stands in a 2-wide link (`no_static_chokepoints`); only youths wander."""
DONE = "CLASS_UPGRADED"
SEAL = "item:ordeal_seal"
NEW_SHEET = {"ord_cd_hatchling": "dragon_hatchling", "ord_cd_chick": "dragon_hatchling",
             "ord_cd_pearl": "dragon_matron", "ord_cd_baker": "dragon_matron", "ord_cd_eggwarden": "dragon_matron",
             "ord_cd_archivist": "dragon_sage", "ord_cd_sleeper": "dragon_sage",
             "bahamut": "bahamut", "bahamut_after": "bahamut"}


def npc(i, sprite, x, y, before, after=None, **kw):
    d = [{"condition": DONE, "text": after}, {"text": before}] if after else list(before)
    return {"id": i, "sprite": NEW_SHEET.get(i, sprite), "x": x, "y": y, "dialog": d, **kw}


def people() -> list[dict]:
    """The 25 NPC entries, in district order (the Court first)."""
    return [
        # ── Bahamut's Court (Bahamut and the six of the old lair keep their ids, flags and trade) ──
        {"id": "bahamut", "sprite": NEW_SHEET["bahamut"], "x": 54, "y": 7, "hideIf": DONE,
         "requiredItem": "ordeal_seal", "cutscene": {"id": "ord_bahamut_trial", "onceFlag": DONE},
         "action": "classUpgrade", "actionFlag": DONE,
         "dialog": [{"condition": SEAL,
                     "text": ["Bahamut: That seal is cut from the citadel's own door. You climbed it, then. Lay it here."]},
                    {"text": ["Bahamut: Little ones, in my hall, and empty-handed.",
                              "Bahamut: On the plateau to the west stands a citadel that tests whoever climbs it. "
                              "Bring me its seal and I will name you as you deserve."]}]},
        {"id": "bahamut_after", "sprite": NEW_SHEET["bahamut_after"], "x": 54, "y": 7, "showIf": DONE,
         "dialog": ["Bahamut: Your new names fit you. Wear them where the light has gone out of the world."]},
        npc("dragon_ember", "dragon_guard", 46, 15,
            ["I keep the door of this hall. Stare at the horns if you must; every guest does. Mind the claws instead."],
            ["I can smell the change on you from across the hall. You burn hotter now."]),
        npc("dragon_moss", "dragon_elder", 50, 11,
            ["The citadel was built by people who wanted proof of courage they could hold in a hand. Bahamut humours them."],
            ["You held it, and you let it go. That is the part the builders never understood."]),
        npc("ord_cd_herald", "dragon_guard", 60, 11,
            ["Bow or do not; he has outlived every bow. Speak plainly to him. He likes that better."],
            ["The court has not rung with that much talk in a hundred years. You have given the old ones a season of it."]),
        # ── the Roost Galleries (north stair) ──
        npc("dragon_storm", "dragon_guard", 21, 11,
            ["Hatchlings dream of flying through the clouds above the plateau. The old ones dream of quiet."],
            ["Go well. When the four lights are lit again, come and tell us how the sky looks."]),
        npc("ord_cd_roostmaster", "dragon_guard", 30, 12,
            ["Every perch here is worn to the shape of one claw. When a dragon dies, nobody else sits there."],
            ["You smell of the citadel's dust. The young ones will want to hear every stair of it."]),
        npc("ord_cd_flier", "dragon_youth", 16, 13,
            ["The north stair comes up under a ledge on the cold islet. We go out at dawn, before the gulls are awake."],
            wander=True),
        # ── the Wyrmhall (crossroads) ──
        npc("ord_cd_steward", "dragon_elder", 24, 28,
            ["This is the Wyrmhall. Every road under the isles meets here: the roosts to the north, the court beyond the "
             "Processional, the hatchery east, the market south, the grotto and the vaults to the west."],
            ["Walk where you like. A named one is no guest here any longer."]),
        npc("ord_cd_mason", "dragon_youth", 37, 29,
            ["I carve the scales on the walls, one a day. The elders say I may stop when the wall is finished. "
             "It is round."]),
        npc("ord_cd_hint_citadel", "dragon_guard", 31, 33,
            ["The seal Bahamut asks for lies at the top of the Citadel of Trials, on the high plateau west of here. "
             "Fly; nothing walks there."],
            ["The Citadel's guardian has finally been let rest. We felt it in the stone."]),
        # ── the Elders' Sanctum ──
        npc("dragon_frost", "dragon_elder", 5, 24,
            ["The guardian in the citadel was one of us once. It forgot when to stop guarding."],
            ["If you brought down the old guardian, then it can rest. Thank you for that."]),
        npc("ord_cd_archivist", "dragon_elder", 8, 29,
            ["We keep no books. Each elder remembers one century and tells it to the next. I am the year of the first eclipse."],
            ["I will remember you. You are a short story, but a good one."]),
        npc("ord_cd_sleeper", "dragon_elder", 3, 31, ["...He has been asleep since the sea was a hand's breadth lower."]),
        # ── the Hatchery ──
        npc("ord_cd_eggwarden", "dragon_elder", 56, 29,
            ["Mind the channel. The rock under the isles is warm, and the eggs need every bit of it."],
            ["One of the eggs turned toward you when you came in. They know a change when they feel one."]),
        npc("ord_cd_hatchling", "dragon_youth", 63, 30, ["I hatched in the spring! I can almost breathe a spark."],
            wander=True),
        npc("ord_cd_chick", "dragon_youth", 55, 35, ["Shh. My sister is still in her shell. She is slow."]),
        # ── the Ember Market ──
        npc("ord_cd_pearl", "dragon_youth", 23, 42,
            ["Pearls for scales, scales for fish. We trade among ourselves; your gold would only be something to sleep on."]),
        npc("ord_cd_baker", "dragon_elder", 33, 42,
            ["Ember-bread, baked on the vent stones. You would break a tooth. Dragons are not built for crumbs."]),
        npc("ord_cd_gossip", "dragon_youth", 28, 46,
            ["The hermit on the middle isle swears he owes us nothing. He owes us four nets and an anchor."],
            ["Tell Oddo the nets can wait. A named one's friend is a friend of the hall."], wander=True),
        # ── the Tide Grotto and the Hoard Vaults ──
        npc("dragon_tide", "dragon_youth", 9, 45,
            ["We came here when the sea still remembered the sky. Bahamut came first."],
            ["The tide will carry the news of you to every shore. That is how dragons gossip."]),
        npc("dragon_ash", "dragon_youth", 6, 54,
            ["I sleep on the gold. Not for greed. It is warm, and it does not argue."],
            ["Do not touch the gold. Now that you are named, I would have to argue."]),
        npc("ord_cd_counter", "dragon_elder", 9, 55,
            ["Four thousand and six crowns, one silver spoon. I count it each morning. It has never once changed."]),
        # ── the Sea Gate (Bahamut's isle) ──
        npc("ord_cd_gatewarden", "dragon_guard", 45, 44,
            ["You came down the Sea Gate, from the king's own isle. Every islet has its stair, and every stair ends "
             "here, under the one roof."],
            ["Go up any stair you like. Your ship of the air will wait where you left it, mind."]),
        npc("ord_cd_porter", "dragon_youth", 48, 41,
            ["I carry the salt up from the Sea Gate. Nobody asked for salt. I carry it anyway; it is tradition."],
            ["Named ones go up the stair first. Tradition again. I did not make it up."]),
    ]

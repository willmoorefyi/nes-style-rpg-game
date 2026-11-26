"""The people of Elfheim's streets (docs/WORLD_PLAN.md 4.0.1, 4.2; ELF-T): every line is written new.

Elfheim has slept with its prince. The dark elf Astos laid a sleep on him and fled west; since then the hedges have
grown thick, the shops sell to whoever the Aldi winds bring, and every elf watches the castle on the rise. Each
person is a `ConditionalDialog` list, the latest story flag first: PRINCE_AWAKE (S8), then ASTOS_DEFEATED or
`item:crystal_eye` (S6, the eye on its way to Matoya), MARSH_GUARD_DEFEATED (S5, the crown), then the default. The two
hint people (`*_hint`) point at Matoya and the Marsh Cave (4.0.1 keywords).
"""
from __future__ import annotations

AWAKE, ASTOS, MARSH = "PRINCE_AWAKE", "ASTOS_DEFEATED", "MARSH_GUARD_DEFEATED"
EYE, HERB = "item:crystal_eye", "item:herb"


def talk(default: list[str], **later: list[str]) -> list[dict]:
    """A dialog list: `awake`, `herb`, `eye`, `astos`, `marsh` lines (the first that holds wins), then the default."""
    keys = [("awake", AWAKE), ("herb", HERB), ("eye", EYE), ("astos", ASTOS), ("marsh", MARSH)]
    return [{"condition": f, "text": later[k]} for k, f in keys if k in later] + [{"text": default}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, tint: str | None = None, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **({"tint": tint} if tint else {}), **kw}


def outdoor() -> list[dict]:
    """The outdoor people (none is a keeper). Coordinates are elfheim.yaml cells (layouts/elf/town_elfheim.py)."""
    return [
        npc("elfheim_gate_warden", "elf_guard", 23, 45, talk(
            ["A ship out of the Aldi, and humans on it. The hedge let you in, so I will too. Welcome to Elfheim.",
             "Keep to the lanes. The hedges are older than the houses, and they remember who broke a branch."],
            awake=["The prince walks his own halls again. Elfheim's gate is yours for as long as the hedges grow."])),
        npc("elfheim_gate_sentry", "elf_guard", 28, 44, talk(
            ["Nothing on four legs gets through the ring. The hedge closes on wolves like a fist.",
             "On two legs it's harder to tell. Astos came in through this very gate, smiling."],
            awake=["I let Astos through this gate once. I've had a long sleep's worth of nights to be sorry for it."])),
        npc("elfheim_rise_guard_w", "elf_guard", 22, 14, talk(
            ["The castle is open to guests. The prince's chamber is up the stair to the west of the hall.",
             "Speak softly in there. He has slept since the dark elf's visit, and nothing we do will wake him."],
            herb=["You smell of something bitter and green. Is that a witch's herb? Go up to the prince, quickly!"],
            awake=["Did you hear him laugh this morning? The whole rise heard it. I'd forgotten the sound."])),
        npc("elfheim_rise_guard_e", "elf_guard", 29, 14, talk(
            ["Below the hall lies our vault. Its door was sealed with the prince's own key, and the key sleeps with him."],
            awake=["The prince has given you his key? Then the vault under the hall is yours to open. He trusts you."])),
        npc("elfheim_matoya_hint", "elf_elder", 21, 27, talk(
            ["Our healers have tried every leaf in the wood on the prince. A dark elf's sleep doesn't care for leaves.",
             "Only one herb would do it, and only one witch grows it: Matoya, in her cave north of Cornelia's bridge.",
             "But they say Matoya is blind and cross these days. Somebody stole her crystal eye."],
            eye=["That glassy thing in your pack... is that Matoya's crystal eye? Take it back to her cave, north of "
                 "Cornelia. A grateful witch might part with her herb."],
            awake=["Matoya's herb, under his nose, and up he sat. Every healer in Elfheim is sulking. I am delighted."])),
        npc("elfheim_marsh_hint", "elf_woman", 31, 28, talk(
            ["The king of the Western Keep, up the long arm to the north-west, lost his crown in the fens.",
             "Whatever took it crawled into the Marsh Cave, south-west of here past the dead trees. Few who go in climb "
             "out again. Fewer climb out with anything."],
            marsh=["You brought a crown out of the Marsh Cave? Then the king of the Western Keep is waiting for you, up "
                   "the long arm to the north-west."],
            astos=["The king at the keep was Astos all along? The same dark elf who cursed our prince. No wonder he "
                   "wanted that crown so badly."],
            awake=["The fens smell of peat and rot, but I'll go back to the Marsh Cave's edge to gather moss now. "
                   "It's safe enough with the prince awake."])),
        npc("elfheim_gardener", "elf_man", 3, 18, talk(
            ["Sleepwort, wake-me-not, goldenroot... I grew them all for the prince. Not one did anything."],
            awake=["My garden's gone to seed while I wasn't looking. Funny how nothing matters, and then everything "
                   "does."])),
        npc("elfheim_hedge_trimmer", "elf_man", 46, 15, talk(
            ["Every day the ring grows a hand thicker. The hedges are grieving, the old ones say. I just trim them."],
            awake=["The hedges stopped growing the moment the prince woke. Gave my shears a rest at last."]),
            wander=True),
        npc("elfheim_stream_child", "elf_child", 13, 25, talk(
            ["I float bark boats from the spring to the pond. The prince used to race me. He always let me win."],
            awake=["The prince came down to the stream and raced me! He didn't let me win. I think he's better now."]),
            wander=True),
        npc("elfheim_fisher", "elf_elder", 39, 39, talk(
            ["There's one old pike in this pond that's never been caught. I'm in no hurry. Elves live a long time."])),
        npc("elfheim_weaver", "elf_woman", 35, 25, talk(
            ["I wove the prince's coverlet in a single night after the curse. Green and silver, his colours.",
             "When he wakes I'll weave him a cloak for riding. I've started it twice."],
            awake=["He asked for his riding cloak the moment he woke. I'm on the third start, and this one I'll "
                   "finish."]), wander=True),
        npc("elfheim_lamplighter", "elf_man", 28, 41, talk(
            ["I light the street lamps at dusk and put them out at dawn. Some nights I forget which is which."]),
            wander=True),
        npc("elfheim_trader", "merchant", 23, 39, talk(
            ["I'm from Pravoka, would you believe? Came over on a fishing boat before the pirates shut the harbour.",
             "Elfheim's mithril is the best on the Aldi. The elves won't haggle, though. It takes the fun out of it."],
            awake=["The elves are buying again now their prince is up. I'll be rich, or at least less poor."])),
        npc("elfheim_elder", "elf_elder", 11, 39, talk(
            ["When I was young, the castle's lamps burned all night and the hall rang with harps.",
             "Since the curse they burn all night still, but no one plays. We keep a light so he can find his way back."],
            awake=["The harps are back in the hall. I'm too old to dance, but I tap my stick."])),
        npc("elfheim_dwarf_peddler", "dwarf_trader", 44, 35, talk(
            ["Don't stare, lad, dwarves travel too. I'm here for elven rope. The foreman back home has a mad plan.",
             "Nerrick wants to blast a canal through the isthmus and let the sea through. All he lacks is the powder."],
            awake=["Your prince keeps a cask of blasting powder in his vault, they tell me. Nerrick would trade his "
                   "beard for it. Take it to the dwarves' hall, north across the strait."])),
        npc("elfheim_scout", "elf_guard", 10, 9, talk(
            ["I ride the Keep Moor up the long arm. The keep's soldiers wave at me, but their king never comes out."],
            astos=["So the king at the keep was a mask over Astos. I watched that window every day and never saw "
                   "through it."], awake=["The prince wants a report on every road in Elfland. I'm off to ride them."])),
        npc("elfheim_minstrel", "elf_mage", 31, 24, talk(
            ["I made a song about the sleeping prince. It's very sad. Nobody wants to hear it any more."],
            awake=["I made a new song: The Prince Who Woke. It's very short, but it ends well."]), wander=True),
        npc("elfheim_herb_girl", "elf_child", 40, 44, talk(
            ["Mother says a witch could wake the prince. I say a trumpet would. A big one."],
            awake=["A witch's herb! Mother was right. I'm going to be a witch when I grow up."])),
        npc("elfheim_watcher", "elf_woman", 16, 15, talk(
            ["I come every morning to see if a light is lit in the prince's window. Not yet. Not yet."],
            awake=["His window was open this morning, and he waved. I shall come every morning anyway."])),
    ]

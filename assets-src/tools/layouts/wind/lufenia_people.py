"""The people of Lufenia (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-O): every line is written new.

The sky-folk keep the old tongue of their ancestors, the builders of the castle in the sky. Until Dr. Unne teaches
the party to read it (LUFENIAN_LEARNED, S25), every outdoor line is unreadable speech; afterwards it is plain. Each
person here is a `ConditionalDialog` list: the plain lines under LUFENIAN_LEARNED (or a later flag), the old tongue as
the default. The hint people (`*_hint`) point at the Mirage Tower and the warp cube (4.0.1 keywords).
"""
from __future__ import annotations

LEARNED, CHIME = "LUFENIAN_LEARNED", "CHIME_GIVEN"
TINT = "#dfe6f5"                                 # the sky-folk's pale robes over the stock sheets (QUEST 4.2 tint)
OWN = {"luf_citizen_m", "luf_citizen_f", "luf_senator", "boy"}   # AR / PT: sheets drawn in their own colours: no tint

# the old tongue: a few fixed phrases, never real words (one per speaker, so the town sounds like many voices)
TONGUE = [
    "Ae'lun soveth, ira tal'qessen.", "Hru omaine vey, sallatir. Ka'vel?", "Quessa lo, quessa lo! Nai thrim.",
    "Iveth an-sorai, vel tunnemar.", "Osk'ra paleth, marrun ei sedd.", "Tiel vasso? Tiel vasso an'dur.",
    "Vaelin, vaelin... horu sae'qat.", "Emmerai! Lun dosk paravi.", "Sorr tal'iquen, avesh mor.",
    "Ka'thera ulun, si ven doloth.", "Pell'e an-myrr, sathi.", "Uvo... uvo restal ka'nem.",
    "Miradh oss'en, kal vethar ilun.", "Teo, teo! Sarrin an'quel?", "Hesh. Doru lai mennath sor.",
    "Aun'tirel... aun'tirel vasso.",
]


def talk(plain: list[str], n: int, after_chime: list[str] | None = None) -> list[dict]:
    """A Lufenian's dialog: plain speech once learned (and other lines once the chime is given), else the tongue."""
    out = [{"condition": CHIME, "text": after_chime}] if after_chime else []
    return out + [{"condition": LEARNED, "text": plain}, {"text": [TONGUE[n % len(TONGUE)]]}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **({} if sprite in OWN else {"tint": TINT}),
            **kw}


def outdoor() -> list[dict]:
    """The outdoor people (12; none is a keeper). Coordinates are lufenia.yaml cells (layouts/wind/lufenia_town.py)."""
    return [
        npc("lufenia_gatewarden", "guard", 16, 27, talk([
            "You read our letters now? Then the doctor in Melmond kept his word to us.",
            "Be welcome on the mesa, travellers. Few climb up here who are not carried by the wind."], 0)),
        npc("lufenia_mirage_hint", "old_man", 13, 16, talk([
            "North and west of the mesa, out in the sands, stands the Mirage Tower.",
            "Its door has no lock and no handle. It answers to one note only, and our elder keeps the bell that sounds it."], 1,
            ["You carry the chime. Ring it before the Mirage's inner door and the tower will let you climb."])),
        npc("lufenia_cube_hint", "mage", 21, 16, talk([
            "The top of the Mirage is not the end of the road. Our makers rode a beam of light from there to the sky.",
            "To ride it you need a warp cube. The makers built a keeper for theirs, behind a waterfall far to the west."], 2)),
        npc("lufenia_orrery_tender", "luf_senator", 18, 13, talk([
            "This orrery has followed the four lights for six hundred years without one error.",
            "This year the wind light stopped turning. We oil it every morning. It does not help."], 3)),
        npc("lufenia_lens_grinder", "luf_citizen_m", 10, 14, talk([
            "I grind lenses for the sky-glasses. Without them we would not have seen the castle at all.",
            "Some nights it hangs right over the mesa, black against the stars. It used to shine."], 4), wander=True),
        npc("lufenia_weaver", "luf_citizen_f", 24, 14, talk([
            "We dress in white so the wind can find us. It has not come looking for a long time."], 5), wander=True),
        npc("lufenia_child", "boy", 15, 22, talk([
            "Grandmother says our people came down from the sky in a boat made of light.",
            "I want to go back up. Will you take me? No? Then tell me what it looks like."], 6,
            ["You're going up there, aren't you? Bring me back a feather from a sky bird!"])),
        npc("lufenia_archivist", "luf_senator", 8, 17, talk([
            "Every word we write is copied twice, once in stone and once in the stars' order.",
            "When Melmond's doctor came he copied our alphabet onto a stone slab. Was it you who brought it back?"], 7)),
        npc("lufenia_shepherd", "farmer", 27, 16, talk([
            "The mesa goats graze the moor below the domes. They do not like the silence any more than we do."], 8),
            wander=True),
        npc("lufenia_bellwright", "luf_citizen_m", 25, 27, talk([
            "I cast the elder's chime anew every hundred years, from the same bronze.",
            "It must never be rung in town. Here it only hums, as if it remembered the tower."], 9,
            ["So the chime has gone with you. Mind it on the road. I am too old to cast another."])),
        npc("lufenia_watcher", "luf_citizen_m", 11, 25, talk([
            "I keep the tally of falling stars. Last month there were none. None at all.",
            "The sky is waiting for something. Perhaps for you."], 10)),
        npc("lufenia_gardener", "luf_citizen_f", 28, 25, talk([
            "Moon-lilies only open in a breeze. Mine have been shut since spring."], 11), wander=True),
    ]

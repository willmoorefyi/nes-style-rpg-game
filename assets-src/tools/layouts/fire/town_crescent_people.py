"""Crescent Lake's outdoor people (docs/WORLD_PLAN.md 4.0.1, 4.4; FIR-T): scholars, students, pilgrims and boat folk.
Every line is original. Read by `town_crescent.py`.

- Most lines move with the story in three steps: before EARTH_CRYSTAL_LIT the town talks of the rot in the earth that
  the sages are watching; once the earth crystal shines again, of fire under the south and frost in its hollow; once
  the elder has given the canoe (CANOE_GIVEN), of the party's canoe and the rivers it opens.
- Two hint NPCs (`*_hint`): the ferryman at the causeway names the sages, the geologist at the landing names the
  volcano.
"""
from __future__ import annotations

CANOE, LIT = "CANOE_GIVEN", "EARTH_CRYSTAL_LIT"

# the land gate, the causeway head and the landing stage: wanderers stay out of the way in
NO_WANDER = ([[x, y] for x in range(0, 6) for y in (17, 18)] + [[x, y] for x in range(18, 22) for y in range(34, 46)]
             + [[x, y] for x in range(45, 51) for y in (17, 18)])


def said(canoe: list[str], lit: list[str], before: list[str]) -> list[dict]:
    """A line in three steps: after the canoe, after the earth crystal, and before both."""
    return [{"condition": CANOE, "text": canoe}, {"condition": LIT, "text": lit}, {"text": before}]


def npc(pid: str, sprite: str, x: int, y: int, dialog, **kw) -> dict:
    return {"id": pid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


def npcs() -> list[dict]:
    return [
        # ── the hint NPCs (4.0.1) ──
        npc("ferryman_hint", "old_man", 22, 37, said(
            ["The sages gave you their canoe? Then you'll not need my ferry, nor the causeway, nor my advice.",
             "Mind you, I'll give the advice anyway: rivers bite. Paddle with your eyes open."],
            ["The sages have been on their feet all week, they say. Something stirred in their stones.",
             "Walk the causeway south and ask them yourselves. They answer warriors before they answer me."],
            ["Out on the islet sit the sages, twelve of them, in a ring of standing stones.",
             "The causeway starts here. Walk it to the end and you'll find them, if they let themselves be found."]),
            tint="#8ca0b4"),
        npc("geologist_hint", "scholar", 46, 18, said(
            ["A canoe! Take it down the south river and you'll reach the foot of Gurgu, the volcano.",
             "Bring me back a cooled cinder if you can. Bring yourselves back, more to the point."],
            ["The volcano south of the ring has woken: Gurgu, the old fire mountain. I felt it through my boots.",
             "No road crosses the ring. Only the rivers run through it, out of the lake."],
            ["South of the mountain ring stands Gurgu, a volcano that has slept as long as this town has stood.",
             "Lately its smoke leans the wrong way. I write it down. Writing it down is what we do here."])),
        # ── the land gate and the Sea Road ──
        npc("gate_warden", "guard", 4, 18, said(
            ["Off on the water, are you? The town will miss its most interesting visitors in a decade."],
            ["The harbour boats say the earth stopped trembling under Melmond. Your doing? The sages will want you."],
            ["Welcome to Crescent Lake. We've no wall: the terraces and the water keep us, and the scholars keep quiet."]),
            tint="#7890a8"),
        npc("fisher", "sailor", 49, 17, said(
            ["Your canoe went out past the landing this morning. Light as a leaf, that boat. Sages build well."],
            ["The lake's gone warm along the south shore. The fish swim north to get away from it."],
            ["The lake fish taste of iron this year. The sages say it's the earth rotting under the far country."])),
        npc("lens_grinder", "burgher", 32, 22, said(
            ["I ground a new lens for the observatory. Now it can watch you paddle all the way to the ring."],
            ["Hot winds off the south, cold ones off the hollow. My lenses fog both ways."],
            ["Lenses, spectacles, burning glasses. A town of readers is a town of squinters."])),
        # ── the Star Terrace ──
        npc("apprentice", "mage", 30, 8, said(
            ["The master says your canoe's track on the lake is the brightest thing she saw all night. She was joking."],
            ["We turned the big tube south last night. The volcano's glow lit the clouds from beneath."],
            ["The astronomer charts the stars, and I chart the astronomer's moods. Both turn slowly."]), tint="#b4a0c8"),
        npc("pupil_a", "boy", 6, 9, said(
            ["Today's lesson was rivers. I already knew: you just get in a canoe and go!"],
            ["The tutor gave us a test on the four crystals. I got the earth one right!"],
            ["The tutor says the earth is sick. I asked if it needs soup. She said that's not funny."]), wander=True),
        npc("pupil_b", "girl", 18, 9, said(
            ["I'm going to be a sage when I grow up. Then I'll build my own canoe."],
            ["The tutor is cross because nobody can see the volcano from the classroom. We tried."],
            ["Shh. If you're loud on the Star Walk the archivist puts your name in a book."])),
        npc("night_watcher", "old_man", 43, 8, said(
            ["From up here I saw your canoe cross the whole lake. Like a needle through blue cloth."],
            ["Smoke by day in the south, a white mist in the hollow beside it. Two omens. The sages like omens in pairs."],
            ["I count the lights on the lake at night. Fewer every year. The world grows dim at the edges."])),
        # ── the Fountain Court and the Market Terrace ──
        npc("student_a", "townsman", 22, 14, said(
            ["They say the sages kept that canoe forty years for the right hands. Were they yours?"],
            ["Ever since the earth crystal shone again, the sages argue about fire. Loudly. Sages are never loud."],
            ["I came to study the stars. The sages make us study rot instead: rot in the roots, rot in the stone."])),
        npc("student_b", "young_woman", 27, 14, said(
            ["I copied the prophecy out twelve times for my exam. Now I've seen the people in it."],
            ["Fire beneath and frost beside it. I wrote that down from a sage, and now I can't stop thinking it."],
            ["The well water tastes of earth this year. Not good earth. The sour kind."]), wander=True),
        npc("gardener", "townsman", 24, 22, said(
            ["Roses bloom on the terraces again. The canoe has nothing to do with it, but I'm happy anyway."],
            ["My roses perked up the very day the earth crystal shone. I don't ask why. I water."],
            ["Half my roses died this spring. The soil's grey a hand down. I've never seen the like."])),
        npc("pilgrim_a", "pilgrim", 38, 22, said(
            ["I walked here to see the Circle. I've stayed to see what the four of you do next."],
            ["Pilgrims come from every coast to the hostel now. The sages say the world is turning."],
            ["I walked three months to sit by the Circle. They let me sit on the causeway. It's a start."])),
        npc("pilgrim_b", "old_woman", 42, 21, said(
            ["Go well on the water. I'll pray for the rivers to be kind to your canoe."],
            ["I prayed at the stones for the earth, and the earth answered. Now I pray about the fire."],
            ["I pray at the edge of the lake for the earth. The lake doesn't answer, but it listens."])),
        # ── the Lakeside ──
        npc("boat_girl", "girl", 41, 26, said(
            ["Father helped tar your canoe's seams. If it leaks, he says, blame the sages."],
            ["Father's mending every hull in the boathouse. He says the lake folk will travel again soon."],
            ["Father builds boats, but nobody buys. Where would they sail? The rivers run into the ring and stop."])),
        npc("old_scholar", "scholar", 16, 30, said(
            ["A canoe in the right hands opens half a continent. I'd write that down if I weren't so old."],
            ["Fire and frost, the sages say now. I liked it better when the trouble was a long way off."],
            ["Forty years I've sat on this bench thinking about the earth. It has never been this ill."])),
        npc("reader", "mage", 25, 29, said(
            ["I'm reading about canoes. It's the town's favourite subject this week, thanks to you."],
            ["A history of the volcano, two hundred pages. It erupts on page four and never stops."],
            ["A book on the blight of the earth. It's very thorough. It ends badly."]), wander=True),
        npc("child", "boy", 12, 28, said(
            ["Can I sit in your canoe? Just once? I'll be good!"],
            ["The boatwright says one day there'll be boats on every river. Can I have one?"],
            ["I throw stones in the lake to see how far the ripples go. Far! Much farther than me."]), wander=True),
        npc("novice", "mage", 19, 34, said(
            ["The elder rarely gives anything away. He gave you the canoe and smiled. I saw it."],
            ["The Circle sits awake by night now. The novices bring them tea and say nothing. That is the rule."],
            ["The Circle is fasting for the sick earth. The novices fast too. I'm thinking about bread very hard."]),
            tint="#a0b4a0"),
    ]

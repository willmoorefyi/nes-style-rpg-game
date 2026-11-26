"""The Circle of Sages on its lake islet (docs/WORLD_PLAN.md 4.0.1 small sites, 4.4; FIR-T) ->
assets-src/maps/crescent-circle.yaml.

  python3 -I assets-src/tools/layouts/fire/town_crescent_circle.py && python3 -I assets-src/tools/build_map.py crescent-circle

An original layout. Crescent's causeway comes in from the north edge onto a grassy islet. Ten standing stones make an
open ring on the islet's crown, with a gap facing the causeway; an old urn of lake water stands at the centre. Twelve
sages keep their places: eight inside the ring, four at the islet's edges looking out over the water.
- The elder stands just inside the gap. Talking to him plays `fir_sages_canoe` once EARTH_CRYSTAL_LIT is set (its
  `onceFlag` CANOE_GIVEN): the cutscene gives the `canoe` and sets CANOE_GIVEN. Before that, he says the earth must
  heal first.
- Lukahn, opposite the elder, speaks the prophecy in his own words.
- Every sage's line follows the story: before the earth crystal they speak of the rotting earth, after it of fire and
  frost, and after the gift of the rivers the canoe opens.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent.parent))
from common import Grid, write_map  # noqa: E402
from town_common import Outdoor  # noqa: E402
import town_crescent_site as SITE  # noqa: E402

MAP = f"{SITE.TOWN}-circle"
W, H = 27, 21
CENTRE, RX, RY = (13, 11), 10.0, 7.5
CANOE, LIT = "CANOE_GIVEN", "EARTH_CRYSTAL_LIT"
g = Grid(W, H, "~")
site = Outdoor()
obj, deco, oak = site.obj, site.deco, site.oak

# ── the islet, its sandy rim, the causeway from the north edge ──
for y in range(H):
    for x in range(W):
        d = ((x - CENTRE[0]) / RX) ** 2 + ((y - CENTRE[1]) / RY) ** 2
        if d < 0.72:
            g.set(x, y, ".")
        elif d < 1.0:
            g.set(x, y, "s")
g.rect(12, 0, 13, 4, "=", only="~")                   # the causeway's last span
g.rect(12, 4, 13, 7, ",", only=".s")                  # the worn path up to the ring's gap

# ── the ring: ten standing stones with a gap toward the causeway, the urn of lake water at its heart ──
STONES = [(7, 7), (10, 6), (16, 6), (19, 7), (20, 10), (19, 13), (16, 15), (10, 15), (7, 13), (6, 10)]
for (x, y) in STONES:
    deco([["pillar_top"], ["pillar_bottom"]], x, y, above_rows=1)
obj(type="deco", parts=[["urn"]], x=CENTRE[0], y=CENTRE[1])
for (x, y) in [(4, 12), (21, 12)]:
    oak(x, y)
for (x, y) in [(5, 7), (21, 7), (9, 17), (18, 17)]:
    deco([["boulder"]], x, y)
for (x, y) in [(11, 10), (15, 10), (11, 12), (15, 12)]:
    obj(type="flowers", x=x, y=y)
for (x, y) in [(4, 4), (22, 4), (2, 15), (24, 16), (13, 20)]:
    deco([["lilies"]], x, y, on_water=True)


def said(canoe: list[str], lit: list[str], before: list[str]) -> list[dict]:
    return [{"condition": CANOE, "text": canoe}, {"condition": LIT, "text": lit}, {"text": before}]


def sage(pid: str, sprite: str, x: int, y: int, dialog, **kw) -> dict:
    return {"id": pid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw}


ELDER = (13, 8)
NPCS = [
    sage("sage_elder", "sage_star", *ELDER, [
        {"condition": CANOE, "text": [
            "Elder: The canoe is yours, and the rivers with it. One runs to the fire mountain, one to the frozen hollow.",
            "Go to both in whatever order your courage likes. The crystals do not wait on our patience."]},
        {"condition": LIT, "text": [
            "Elder: The earth breathes again. We felt it here, through the stones, the night its crystal woke.",
            "Then you are the ones the Circle has waited for. Hear us, and take what we have kept."]},
        {"text": [
            "Elder: You have come far to stand in our ring. The Circle sees you, and is glad.",
            "But the earth is rotting under the western lands, and while it rots we can give you nothing.",
            "Heal the earth first. Light its crystal. Then come back across the causeway."]}],
        cutscene={"id": "fir_sages_canoe", "requiredFlags": [LIT], "onceFlag": CANOE}, tint="#e8e0c8"),
    sage("sage_lukahn", "scholar", 13, 14, [
        "Lukahn: Long ago I wrote down what the stones told me, and the town has copied it ever since.",
        "\"When the four lights fail, four will walk out of the dark carrying them. Each fallen light they lift will "
        "show them the next.\"",
        "\"And when the last is lifted, the road will turn back on itself, and at its end the one who broke the "
        "lights will be waiting.\"",
        "I never knew what the last part meant. Looking at you, I begin to."], tint="#f0f0ff"),
    sage("sage_west", "old_man", 9, 9, said(
        ["The canoe floats lighter than it did when I last paddled it. Perhaps it knows where it is going."],
        ["The earth is mended. Now the fire under the south swells, as if the land had to breathe out somewhere."],
        ["Put your hand on the stone behind me. Cold, isn't it? It used to be warm. The earth is dying under it."]),
        tint="#c0b8a8"),
    sage("sage_east", "sage_star", 17, 9, said(
        ["Rivers are roads that move. You have the canoe; keep to the middle, where the current is honest."],
        ["Fire and frost lie side by side south of the ring. One crystal sleeps in each, I think. Or one in neither."],
        ["Under the western plain something drinks the earth's strength. We feel it as a chill in the stones."])),
    sage("sage_moss", "sage_earth", 8, 11, said(
        ["I have nothing to add. The elder said it all. That doesn't happen often; enjoy it."],
        ["Last night the urn's water steamed on one side and froze on the other. We did not sleep."],
        ["Moss is dying on the stones. In three hundred years it has never died. I count the patches each dawn."])),
    sage("sage_tide", "pilgrim", 18, 11, said(
        ["When you reach the fire, remember: it was here before the world, and it will be here after. Respect it."],
        ["The lake has warmed by a finger's breadth along its south shore. The fire mountain is stirring."],
        ["The lake's level falls each year, and the fish grow fewer. The land beneath is thirsty and sick."])),
    sage("sage_reed", "sage_earth", 10, 13, said(
        ["The frozen hollow keeps something that was never meant to be found. Go armed, and go warm."],
        ["Frost has a voice in the south. It is not a kind one. Something in the ice is watching."],
        ["The roots of the trees on the western shore have gone soft as rope. The earth has a fever."])),
    sage("sage_ash", "sage_flame", 16, 13, said(
        ["We have given away our oldest boat. I feel lighter. Sages should own less, I always said."],
        ["The fire crystal sleeps in the mountain's heart, under a tyrant made of ash. So the stones say."],
        ["The earth crystal is dimming. The stones are certain. We are only less certain how long it has."])),
    sage("sage_north", "healer", 4, 10, said(
        ["From the islet's edge I watched you push off. The ripples are still reaching the far shore."],
        ["Look south over the water: smoke by day, a pale light by night. Two shrines are waking."],
        ["I watch the western sky. Each evening it is greyer. The earth's colour is leaving it."]), tint="#d8d0e8"),
    sage("sage_south", "old_man", 22, 10, said(
        ["A sage gave me a canoe when I was young. It took me here. Let it take you farther."],
        ["The volcano's grumble crosses the lake at night. The stones hum back at it."],
        ["The earth has been sick before. Never this sick. The stones remember everything, and they are afraid."])),
    sage("sage_shore", "pilgrim", 6, 16, said(
        ["Rivers branch. If one way is shut, paddle another. That is the whole of my wisdom, and it took sixty years."],
        ["Pilgrims cross the causeway every day now, asking about fire. I tell them to ask you."],
        ["We fast for the earth, and the earth goes on rotting. Still, it is something to do with our hands."]),
        tint="#b0a090"),
    sage("sage_lantern", "sage_flame", 20, 16, said(
        ["Paddle well. Come back and tell us what the rivers said. We love a story, here."],
        ["I lit a lamp for the earth when its crystal shone. Now I light two more: one red, one white."],
        ["I keep the lamp at the islet's edge for the earth. While it burns, we have not given up."]),
        tint="#c8b490"),
]

doc = {
    "id": MAP,
    "name": "Circle of Sages",
    "kits": ["town", "castle", "overworld"],
    "music": "town",
    "entrances": {"arrival": [12, 1]},
    "objects": site.objects,
    "npcs": NPCS,
    "edge_exits": {"north": {"targetMap": SITE.TOWN, "targetEntrance": "circle"}},
    "noWander": [[x, y] for x in (12, 13) for y in range(0, 8)],
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "exit": {"map": SITE.TOWN, "entrance": "circle"},
}
HEADER = """GENERATED by assets-src/tools/layouts/fire/town_crescent_circle.py - edit the script, not this file.
Concept: the Circle of Sages on a grassy islet in Crescent Lake: ten standing stones in an open ring, twelve sages at
  their places, the elder by the gap that faces the causeway.
Distinct: a ring of standing stones open toward the causeway with an urn of lake water at its heart; a sandy rim
  round the islet with lilies on the water; four sages posted at the islet's edges looking out over the lake.
Topology: one map, no stairs: the causeway from the north edge (crescent:circle) -> the worn path -> the ring. The
  canoe is the elder's gift (cutscene fir_sages_canoe). No boss.
ground legend: . grass  s sand  , dirt  ~ water  = planks"""
print(write_map(MAP, HEADER, doc, g.text()))

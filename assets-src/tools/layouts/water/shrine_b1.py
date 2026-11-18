"""Sea Shrine B1, the mermaids' grotto (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D) -> assets-src/maps/sea-shrine-b1.yaml.

  python3 -I assets-src/tools/layouts/water/shrine_b1.py && python3 -I assets-src/tools/build_map.py sea-shrine-b1

The top of the shrine, a dome of rock above the tide line where the air is still dry. A green lagoon fills the middle;
a stone shore runs round it, and a plank walk leads out to the elder's rock. The last of the sea folk live here and no
monster comes up this far (no encounters). The stairwell from B2 opens at the south; two sea-cave tunnels end in the
grotto's two chests. The floor is a dead end: everything that matters lies below the nave.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shrine_common import MERMAID, NOTE, Floor, chest, talk  # noqa: E402

W, H = 34, 26


def mermaid(nid: str, x: int, y: int, before: list[str], after: list[str], sprite: str = "villager_f") -> dict:
    return {"id": f"wat_d_{nid}", "sprite": sprite, "tint": MERMAID, "x": x, "y": y, "dialog": talk(before, after)}


def build() -> Floor:
    f = Floor("sea-shrine-b1", "Sea Shrine B1", W, H)
    g = f.g
    g.rect(6, 4, 27, 19, "-")            # the shore round the lagoon
    g.rect(9, 7, 24, 16, "≈")            # the lagoon
    for x0, y0, x1, y1 in ((6, 4, 8, 5), (25, 4, 27, 5), (6, 18, 8, 19), (26, 17, 27, 19)):
        g.rect(x0, y0, x1, y1, "W")      # the dome's rock knuckles
    g.rect(15, 10, 18, 12, "-")          # the elder's rock
    g.rect(16, 7, 16, 9, "_")            # the plank walk out to it
    g.rect(15, 20, 18, 22, "-")          # the stair passage from B2
    g.rect(2, 12, 5, 12, "_")            # the west sea-cave tunnel (a dead end)
    g.rect(28, 7, 31, 7, "_")            # the east sea-cave tunnel (a dead end)
    g.rect(21, 2, 21, 3, "_")            # the drip cleft (a dead end)
    g.faces(2)
    f.stairs_down(16, 21, "sea-shrine-b2", "up")             # back down to the cloister
    for x, y in ((10, 4), (23, 4), (7, 15)):
        f.deco([["plant"]], x, y)
    for x in (12, 19):
        f.deco([["vines"]], x, 3, on_wall=True)
    f.deco([["gold_heap"]], 18, 10)                          # the sea folk's hoard of drowned coins
    f.npcs += [
        chest("b1_west", "ether", "an Ether", 2, 12),
        chest("b1_east", "diamond_helm", "a Diamond Helm", 31, 7),
        mermaid("elder", 16, 11, [
            "Elder Maraleth: You climbed past the brothers and their garden. Then you have come for the king.",
            "He is not cruel. He is sure. When the storm came he chose to sink us all rather than lose one of us, "
            "and the sea folk have lived in his choice ever since.",
            "He wears the sky folk's tablet on his breast. It was given to this shrine to keep, not to him."], [
            "Elder Maraleth: The water is lower in the lagoon this morning. I can see the old steps.",
            "Take the tablet to someone who can read it. We never could; we only kept it."], sprite="princess"),
        mermaid("tide_hint", 10, 17, [
            "Coralie: The halls under the nave are flooded two ways. The long way round is wet; the library way is "
            "dry, but the dead read there.",
            "Either stair at the bottom takes you to the throne. He waits north of where you come up."], [
            "Coralie: I swam down to the throne room. It is only a room now."]),
        mermaid("storm_hint", 25, 12, [
            "Nerissa: When the king strikes, he strikes with the whole tide behind him. Do not trade blows with him "
            "for long.",
            "He was a king of calm water. Lightning was the one thing his sea never learned to swallow."], [
            "Nerissa: The storm in his robes is gone. It was only ever the old storm, the one he ran from."]),
        mermaid("singer", 21, 5, [
            "A young mermaid hums to the lagoon and does not stop for you. The water ripples in time with her."], [
            "The young mermaid is singing louder now, and the lagoon sings back."]),
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": 21, "y": 1, "text": [
        "Fresh water drips from a crack in the dome, one drop at a time, into a shell set there to catch it.",
        "Someone has worn a smooth seat into the rock beside it."]}]
    print(f.write(None, "Sea Shrine B1: the mermaids' grotto, a dry dome over a lagoon; a dead end with no monsters.\n"
                  + NOTE, {"down": [16, 20]}, extra={"inspect": inspect}))


if __name__ == "__main__":
    main()

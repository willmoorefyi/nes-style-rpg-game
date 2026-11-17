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
ELF = "#cfe8c2"                                  # the elves' leaf-pale cast over the stock sheets (QUEST 4.2 tint)
ELDER = "#e4e9d6"


def talk(default: list[str], **later: list[str]) -> list[dict]:
    """A dialog list: `awake`, `herb`, `eye`, `astos`, `marsh` lines (the first that holds wins), then the default."""
    keys = [("awake", AWAKE), ("herb", HERB), ("eye", EYE), ("astos", ASTOS), ("marsh", MARSH)]
    return [{"condition": f, "text": later[k]} for k, f in keys if k in later] + [{"text": default}]


def npc(nid: str, sprite: str, x: int, y: int, dialog: list, tint: str | None = ELF, **kw) -> dict:
    return {"id": nid, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **({"tint": tint} if tint else {}), **kw}


def outdoor() -> list[dict]:
    """The outdoor people (none is a keeper). Coordinates are elfheim.yaml cells (layouts/elf/town_elfheim.py)."""
    return []

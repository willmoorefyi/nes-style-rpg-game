"""The EF smoothing rule (the user's standing rule, 2026-11-24; docs/NEW_MONSTER_GUIDE.md 1.4): every monster sheet
approved on or after pass EF (an approved monster_* / boss_* json dated 2026-11-24 or later, or a Bedrock sheet) has a
gen/monster_scale.yaml entry that smooths it (`smooth: [despur]` and / or a hi-res `tex` > 1, gen/monster_hires.py).
Checked by selftest_hires.py on the real tree; tests/data/efSmoothRule.test.ts runs the same rule.
"""
from __future__ import annotations

EF_START = "2026-11-24"            # the standing rule (user, 2026-11-24): every sheet approved from pass EF on is smoothed


def ef_rule_failures(approved: dict[str, dict[str, dict]], table: dict) -> list[str]:
    """The EF smoothing rule (NEW_MONSTER_GUIDE.md 1.4): {sprite: {sheet json name: json}} of approved/ -> one line per
    sprite with a monster_* / boss_* sheet approved on/after EF_START (or by Bedrock) whose monster_scale.yaml entry
    has neither `smooth: [despur]` nor a hi-res `tex` > 1 (tests/data/efSmoothRule.test.ts runs the same rule)."""
    out = []
    for sid, files in sorted(approved.items()):
        ruled = sorted(f for f, j in files.items() if f.split("_")[0] in ("monster", "boss")
                       and (j.get("backend") == "bedrock" or str(j.get("approved", "")) >= EF_START))
        v = table.get(sid)
        if ruled and not (isinstance(v, dict) and ("despur" in (v.get("smooth") or []) or (v.get("tex") or 1) > 1)):
            out.append(f"{sid} ({', '.join(ruled)}): approved on/after pass EF without a smooth / hi-res entry")
    return out

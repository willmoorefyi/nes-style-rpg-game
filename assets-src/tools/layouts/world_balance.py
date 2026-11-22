"""The world map's step-mean scaling (docs/NATURAL_WORLD_PLAN.md 4.4 lever 1; NW-5): each zone's encounter rate.

The NW world's walks are longer than pass W's and cross other zones: on the curve model's witness (proof (a)'s walk,
`src/progression/questCurve.ts`) the world-map fights went from 1,275 to 1,357 and their xp up most in S10, S14
(the voyage round the north sea to Crescent's dock) and S21-S26 (the north's landings), which put S16 and S21 over
their bands. NW-5 measured both worlds' witnesses per stage and per zone (fights and xp in each zone the stage's walk
crosses, every zone at the map's mean step) and fitted one step-mean factor per zone so each stage's walk earns pass
W's xp again: an iterative proportional fit over the stages, each zone's factor moved by the fight-weighted excess of
the stages that walk it, clamped to [0.67, 2.25] (a sea or plain met at most every 2.25 x 16 = 36 steps on average),
a factor within 10 % of 1 left at 1, and act 1's fields (the map default) untouched. One factor is set by hand:
`fir_desert` 1.4 (the fit left it at 1), because S15's witness crosses the Hull Desert (S17's roster) on the NW world,
and its seeded wipes there were 0.28 per run (`tests/balance/questCurve.test.ts`, bound 0.2). The result: every
stage's curve level within 0.3 of pass W's (bands in NW-5's result, NATURAL_WORLD_PLAN 16).

A zone's rate is the map's (`encounterRate`, act 1's fields: 10-22 steps) times its factor, rounded half up; a zone
not listed keeps the map's. No enemy, table, item, formula or `grind` changes (4.4).

NW2-BAL (docs/NW2_EDITS_PLAN.md 11): NW2's gorges, hikes and voyages put S21 over its band (L29.3, [25, 28]) and
every stage from S17 on about 0.5 over NW's level. Re-fit on both witnesses: `wat_sea` 2.25 (S14's voyage now crosses
the Water sea), `ord_heath` 0.67 -> 1.4 (S18 / S19 walk twice NW's heath), `fir_tundra` 2.0 (S17's return), and
`wnd_mirage_sands` 1.26 -> 2.1, its CAP (S27-S29, S31: the Mirage hike). The rest of the excess is the Cinder and
Rime Gorges' `fir_rivers` canoe fights (capped at 0.75, so not a lever) in S16 and S17: those stages' `grind` went
down by the plan's lever 2 (quest.yaml: S16 2.0 -> 1.5, S17 4.0 -> 3.0). Result: every stage within 0.11 of NW's
level, every band OK (the table in NW2_EDITS_PLAN's NW2-BAL result).

QW2 (docs/NW2_EDITS_PLAN.md, QW2 result; user ruling 2026-11-22): Sarda's cave moved to the south cape, 42 steps from
the giant's west mouth (was 5), so S12 walks the Sarda coast there and S13 back. `ert_sarda_coast` 0.67 -> 2.25 (rate
23-50; the fit had left it at the floor) and S12's `grind` 7.0 -> 5.0 (quest.yaml): every stage within 0.07 of its
level before the move, every band OK, Gaia's price wall OK.
"""
from __future__ import annotations

STEP_FACTOR = {
    "a1_aldi": 0.74, "a1_north_sea": 2.25,
    "elf_aldi": 1.15, "elf_fen": 1.85, "elf_fields": 1.45, "elf_keep_moor": 0.86,
    "ert_aldi": 2.09, "ert_isthmus": 1.36, "ert_plain": 2.25, "ert_sarda_coast": 2.25, "ert_sea": 2.25,
    "fir_aldi": 1.46, "fir_ashlands": 2.25, "fir_desert": 1.4, "fir_lakeshore": 2.25, "fir_rivers": 0.75,
    "fir_sea": 2.25, "fir_tundra": 2.0,
    "ord_heath": 1.4, "ord_isles": 2.25, "ord_sea": 2.25,
    "temple_approach": 0.81,
    "wat_dunes": 0.67, "wat_isles": 2.0, "wat_sea": 2.25, "wat_streams": 2.0,
    "wnd_highlands": 2.25, "wnd_lufen_moor": 1.9, "wnd_mirage_sands": 2.1,
    # WR F-WR (docs/WORLD_WRAP_PLAN.md 8.4): the seam bands at the factor of the early sea whose table they copy
    "wat_seam_w": 2.25, "wnd_seam_n": 2.25,   # fir_sea's; wat_seam_n and ord_seam_n are elf_sea's (none: 1.0)
}

# NW2-BAL (docs/NW2_EDITS_PLAN.md 11, D-NW2-3): the most a factor may be, so the gorges and hikes keep their expected
# fights (`world.py`'s `gorges` and `hikes` lines check the figures): `fir_rivers` keeps E_canoe >= 1.0 on the Cinder
# and Rime Gorges, the hike zones E_hike >= 1.0 at each site's measured d (d / 16; the waterfall's 2.0 counts the
# canoe's rate). `apply` refuses a factor over its cap.
CAP = {
    "fir_rivers": 0.75,
    "wat_isles": 2.0, "wat_streams": 2.0,
    "wnd_lufen_moor": 1.9, "wnd_mirage_sands": 2.1,
}


def apply(doc: dict) -> None:
    """Give every listed zone of the world source its scaled `encounterRate` (in place)."""
    lo, hi = doc["encounterRate"]["min"], doc["encounterRate"]["max"]
    known = {z["id"] for z in doc.get("encounterZones") or []}
    missing = sorted(set(STEP_FACTOR) - known)
    if missing:
        raise SystemExit(f"world_balance: no such zone {missing}")
    over = sorted(z for z, c in CAP.items() if STEP_FACTOR.get(z, 1.0) > c)
    if over:
        raise SystemExit(f"world_balance: factor over its CAP {over}")
    for z in doc.get("encounterZones") or []:
        f = STEP_FACTOR.get(z["id"])
        if f is not None:
            z["encounterRate"] = {"min": int(lo * f + 0.5), "max": int(hi * f + 0.5)}

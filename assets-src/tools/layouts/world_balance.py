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
"""
from __future__ import annotations

STEP_FACTOR = {
    "a1_aldi": 0.74, "a1_north_sea": 2.25,
    "elf_aldi": 1.15, "elf_fen": 1.85, "elf_fields": 1.45, "elf_keep_moor": 0.86,
    "ert_aldi": 2.09, "ert_isthmus": 1.36, "ert_plain": 2.25, "ert_sarda_coast": 0.67, "ert_sea": 2.25,
    "fir_aldi": 1.46, "fir_ashlands": 2.25, "fir_desert": 1.4, "fir_lakeshore": 2.25, "fir_rivers": 0.75,
    "fir_sea": 2.25,
    "ord_heath": 0.67, "ord_isles": 2.25, "ord_sea": 2.25,
    "temple_approach": 0.81,
    "wat_dunes": 0.67, "wat_isles": 2.25, "wat_streams": 2.25,
    "wnd_highlands": 2.25, "wnd_lufen_moor": 2.25, "wnd_mirage_sands": 1.26,
}


def apply(doc: dict) -> None:
    """Give every listed zone of the world source its scaled `encounterRate` (in place)."""
    lo, hi = doc["encounterRate"]["min"], doc["encounterRate"]["max"]
    known = {z["id"] for z in doc.get("encounterZones") or []}
    missing = sorted(set(STEP_FACTOR) - known)
    if missing:
        raise SystemExit(f"world_balance: no such zone {missing}")
    for z in doc.get("encounterZones") or []:
        f = STEP_FACTOR.get(z["id"])
        if f is not None:
            z["encounterRate"] = {"min": int(lo * f + 0.5), "max": int(hi * f + 0.5)}

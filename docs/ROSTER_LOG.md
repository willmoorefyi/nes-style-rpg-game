# Roster run log (pass R)

The roster pass of `docs/ROSTER_PLAN.md`: every enemy of the bestiary spec as distinct art (no palette swaps), fiends
first. `docs/ACT1_LOG.md` stays closed; every pass-R Gemini attempt gets one row here.

**Rules (binding, plan 6 and the orchestrator decisions):**
- at most 300 Gemini attempts in pass R, counted over the ledger after N0 (failed calls count, Bedrock is not used):
  285 for building (`pass R build`), the last 15 only for fix-pass regenerations of sprites with approved art
  (`pass R fix`, opened at the FIX tranche); all enforced by `generate.py::check_budget` from `assets-src/gen/budget.json`
- at most 3 attempts per sheet (1 + 2 retries, pre-approved, D9); `--retry` still required; never a 4th: approve the
  best with recorded nits, or defer the sprite
- one paid request per checkpoint (`--paid --max-paid 1`), self-approve on the binary checklist, commit every checkpoint
- building halts at the first of: every sheet in plan 3.2 approved, or 285 build attempts

**R0 (2026-11-15, tag `roster-r0`):** N0 = **100** Gemini `attempt` events in `assets-src/gen/cache/ledger.jsonl`
(`check_budget` counting: `event == "attempt"` and `backend != "bedrock"`). The ledger has 215 lines: 107 `attempt`
(100 Gemini, 7 Bedrock), 107 `result` and 1 pre-ledger `note`, so a line count overstates it. Pass F closed at
`gemini_end` 100; `pass R build` opened at `gemini_before` 100 with `max_new` 285.

Images used: 1 of 300 (build 1 of 285, fix 0 of 15; ledger guard: 101 Gemini attempts - 100)

## Attempts

| # | Sheet (seed) | n | Measured result | Decision |
|---|---|---|---|---|
| R1 | ashen_queen/boss_idle (1234, key `8e23d14cf040a2850a4db92b`) | 1 | Six arms (3 per side: upper pair raised, one holding the sun disc; middle pair open in blessing; lower pair with the curved bronze blade and the chained censer with smoke), no legs, a charcoal serpent tail with ember-lit underside coiled on the ground, the broken stone altar joined to the coil (one 4-connected piece) on the ground row, a cracked white mask with two burning slits, a gold ray crown. 186 px tall (garland 189, lich 184), lowest row 192, top row 7, x 25-175, no border pixels, binary alpha, 16 colours with the outline ink. Near-frontal with the mask turned slightly right, as the approved garland and lich idles; the same pixel size, outline and top-left light. Nits: the sun disc sits on one upper hand, not between two; the altar column stands mostly behind the coil | **self-approved** (attempt 1 of 3) |

## Deferred sprites

None.

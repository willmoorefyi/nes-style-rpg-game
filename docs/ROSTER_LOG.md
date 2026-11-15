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

Images used: 0 of 300 (build 0 of 285, fix 0 of 15; ledger guard: 100 Gemini attempts - 100)

## Attempts

| # | Sheet (seed) | n | Measured result | Decision |
|---|---|---|---|---|

## Deferred sprites

None.

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

Images used: 5 of 300 (build 5 of 285, fix 0 of 15; ledger guard: 105 Gemini attempts - 100)

## Attempts

| # | Sheet (seed) | n | Measured result | Decision |
|---|---|---|---|---|
| R1 | ashen_queen/boss_idle (1234, key `8e23d14cf040a2850a4db92b`) | 1 | Six arms (3 per side: upper pair raised, one holding the sun disc; middle pair open in blessing; lower pair with the curved bronze blade and the chained censer with smoke), no legs, a charcoal serpent tail with ember-lit underside coiled on the ground, the broken stone altar joined to the coil (one 4-connected piece) on the ground row, a cracked white mask with two burning slits, a gold ray crown. 186 px tall (garland 189, lich 184), lowest row 192, top row 7, x 25-175, no border pixels, binary alpha, 16 colours with the outline ink. Near-frontal with the mask turned slightly right, as the approved garland and lich idles; the same pixel size, outline and top-left light. Nits: the sun disc sits on one upper hand, not between two; the altar column stands mostly behind the coil | **self-approved** (attempt 1 of 3) |
| R2 | ashen_queen/boss_attack (1234, key `dff206cd48da9ec0a2535987`) | 1 | Clean cut: 175 px, lowest row 192, top row 18, x 17-182, no border pixels, binary alpha, 16 colours with the outline ink (4 shared with the idle; garland's poses share 4-5), one piece, `pose_diff` 0.52; six arms, tail, altar joined, mask and crown kept, lunging right. **Fails the design review:** the strike is led by the sun disc in an open hand (reads as a grab, not a melee blow), the bronze blade is in a far-side arm thrown back up-left instead of leading the sweep toward the heroes, and the censer lost its chain and smoke (a small cup in the lower near hand, a prop change against the idle) | **rejected**; retry follows (seed 1235, `--retry`; the `attack` text now names the blade arm and its sweep across to the heroes and keeps the censer on its chain) |
| R3 | ashen_queen/boss_attack (1235, key `f11fb83bb845b81df7f35cfc`, `--retry`) | 1 | **Fails review:** Gemini painted the light-grey guide box as the whole background, so the cut keeps a grey patch inside the coil hole and a dark-speckled fringe; the cell came out 216 x 200 with the sun disc on row 0 (17 border pixels, no headroom), 193 px tall; only **four** arms; the props swapped sides against the idle (blade now in a right hand, censer in a left hand: a prop pop for the rig). The blade does lead the slash toward the heroes | **rejected**; the last allowed attempt follows (seed 1236, `--retry`; the `attack` text now pins each prop to its idle hand, the blade arm crossing in front of the body, and the six-arm count) |
| R4 | ashen_queen/boss_attack (1236, key `c3d017fdc4d86292def35439`, `--retry`, attempt 3 of 3) | 1 | Clean cut: 186 px, lowest row 192, top row 7, x 20-180, no border pixels, binary alpha, 16 colours with the outline ink (5 shared with the idle), one piece, `pose_diff` 0.49 (almost all from the blade). The props stay in their idle hands (disc upper left, blade lower left, censer on its chain lower right). **Fails review:** it is the idle stance with the blade held flat across the waist: no lunge, no lean, so it does not read as an attack; the left-side arms are muddled (the middle-left arm folds into the torso); the censer smoke and the altar top take a mauve tint | **rejected** (no 4th attempt, D9) |
| R5 | ashen_queen/boss_attack: approve R2 (1234, key `dff206cd48da9ec0a2535987`) as best of 3 | 0 | R2 is the only attempt that reads as an attack (a strong lean and lunge to the right over the coil) with six clean arms, the altar joined, and the mask and crown as in the idle; R3 is unusable, R4 static. The `attack` text and seed in `monsters.yaml` are back to the R2 request (the retry wordings are kept as a comment). Recorded nits: the bronze blade is thrown back up-left on the far side instead of leading the blow (the strike reads as an open-handed sunfire grab with the disc forward); the censer is a small cup in the lower near hand without its chain or smoke (the rig needs a carry rule or a hidden swap for it) | **self-approved with nits** (attempt 1 of 3 used; 3 of 3 spent) |
| R6 | ashen_queen/boss_cast (1234, key `3529788f54db918a30395c89`) | 1 | Clean cut: 190 px (lich cast 190), lowest row 192, top row 3, x 18-181, no border pixels, binary alpha, 15 colours with the outline ink (4 shared), one piece, `pose_diff` 0.38 vs idle; six arms spread, small flames in the middle hands, the disc raised in the upper left hand, mask, crown, altar joined. **Fails review:** the props swapped sides against the idle (censer now in the lower left hand, blade in the lower right: a prop pop in `cast_gather` / `cast_rise`), and the tail tip frays into ragged thin black strands | **rejected**; retry follows (seed 1235, `--retry`; the `cast` text now pins each prop to its idle hand and asks for the idle's smooth tapering tail tip) |

## Deferred sprites

None.

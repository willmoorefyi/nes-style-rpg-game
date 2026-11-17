# Chaos fix plan (pass C, C7 fix round), 2026-11-16, rev 3

Branch `roster-int` at 7c86057. Inputs:
- `docs/ROSTER_PLAYTEST.md` "Chaos play test (C6), 2026-11-16" (evidence in `/tmp/c6/`)
- `docs/ROSTER_LOG.md` "Pass C: C5"
- `docs/CHAOS_FORMS_PLAN.md` rev 4: section 18 rules, the 15.1 user rulings, the 15.2-15.3 orchestrator rulings and
  the section 12 fix-round rules
- the code, and `tests/balance/`

**Rev 3 (this revision).**
- It applies user ruling **U-3** (2026-11-16): the pool becomes **20000** (it was 12000 under U-1, and 6000 under
  D-U3), so that party hits stay near today's size at level 40. A new hit-size target is added: the **median party
  hit is >= 500**. The other targets are unchanged.
- The B3-style stats were re-tuned for pool 20000 at level 40 in the same out-of-repo sim. The result is **B3-20k**
  (2.3, 2.5), and it meets every target: median hit 577 / 568. The level cliff was measured again.
- It applies every item of momus's rev-2 review (`/tmp/c7plan/momus_review2.md`, OKAY on conditions). The map is in
  section 13.
- The rev-2 text is kept in `/tmp/c7plan/plan_rev2_backup.md`.

**Rev 2.**
- It answers momus's REJECT of rev 1 (`/tmp/c7plan/momus_review.md`): all 6 must-fix items and all 12 should-fix
  items. The map is in section 13.
- It applies the user rulings of 2026-11-16: **U-1 = B3** (pool 12000, thresholds kept) and **U-2 = level 40** (the
  `chaos_forms` party becomes level 40).
- The balance was measured again for both rulings.
- Nothing is implemented, and 0 Bedrock and 0 Gemini calls are planned (Bedrock stays at 25 of 80).

**How rev 2 and rev 3 were measured.**
- The harness ran out of the repo, in `/tmp/c7plan/sim/`: a copy of `src/` with symlinks to the repo's `node_modules`
  and `assets`, run with `vite-node`. The worktree has no scratch file (`git status`: only this plan is untracked).
- The copy carries the **planned mechanism itself** (section 2.4; the diff is in 2.1). Rev 1 emulated the arrival
  turn and the crack floor instead.
- The unpatched baseline ran from a second copy, `/tmp/c7plan/sim0/`.
- Outputs are in `/tmp/c7plan/sim/c*.out.json` (rev 2, pool 12000), `/tmp/c7plan/sim/d*.out.json` (rev 3, pool 20000)
  and `/tmp/c7plan/sim0/b.out.json`.
- The chain check (C6-7) is `/tmp/c7plan/sim/chain.ts` at 12000 and `chain20.ts` at 20000. Both give the same order.
- As a cross-check, the copy reproduces rev 1's B3 numbers at level 50 exactly (95.0 % win, 12/13/15 rounds, 98.5 %,
  98.7 %).

---

## 0. Success criteria (defined before any fix)

```json
{
  "functional": [
    "Each of the four forms takes at least 2 actions in at least 90 % of won seeded runs of the level-40 chaos_forms party (typical and aggressive policies)",
    "The fight lasts 10-16 rounds in at least 91 % of seeded runs; the median is 10-15 rounds",
    "INVARIANT: in every run that reaches F4, the crack interlude (chaos_crack) plays first, including a single hit from above 0.25 to the 0.15 floor",
    "INVARIANT: the forms change in chain order (chaos -> orrery -> horizon -> core), each once, each with its own interlude, including after a direct HP write below several thresholds",
    "The bestiary lists 'Chaos (Orrery)' and 'Chaos (Horizon)' under 128 Chaos; F4 is the Horizon entry's form page; ?bestiary=chaos_orrery | chaos_horizon | chaos_horizon_core open those stills; mode: seen hides each form until its SEEN flag is set",
    "A battle with a form chain has Run disabled unless its bossConfig says otherwise"
  ],
  "observable": [
    "The median party hit (damage per damaging hero action) is at least 500 at level 40 (U-3)",
    "Damage numbers on the F3/F4 disc have a light outline",
    "F3's and F4's slam moves the disc top by at least 40 px peak to peak, and its line names the slam",
    "Status icons on a colossus are 36 px on a dark plate, inside y 140..760",
    "The F4 target label has a dark plate",
    "The i2 fade dims no window",
    "Numbers of one spawn call do not overlap",
    "enemyAnim=loop moves the colossus",
    "The Chaos bestiary entry stands on the rim, and its phase line names the form change"
  ],
  "pass_fail": [
    "tests/balance/chaos.test.ts green: every statistical bound at least 3 points from its measured value (round counts: at least 2 rounds, D-C7-19), with the measured value in the test name; the invariants asserted exactly and labelled 'invariant'",
    "Every RED test in section 5 was run failing before its fix, with the output in the agent report",
    "npx tsc --noEmit, npm run build and npx vitest run are clean",
    "R28 gate: the 8 files are byte-unchanged since 7c86057 and green",
    "colossus.py budget --check prints OK with Bedrock 25 of 80; no file under assets/sprites changes",
    "Fresh re-tester: no open P0/P1; every C6 finding re-checked with a verdict"
  ]
}
```

---

## 1. Findings: root cause, fix, owner, acceptance, verification

**Owners.**
- **TS-B:** battle logic plus the scene glue. It is the **only owner of `BattleScene.ts`**.
- **TS-BAL:** the balance harness and the Chaos stat data.
- **TS-V:** the battle view. It never edits `BattleScene.ts`.
- **TS-BST:** the bestiary.
- **INT:** the integrator: merges, the gate, docs.
- **TST:** a fresh re-tester.

Root causes were checked against the code at 7c86057. One cause is a hypothesis (H12): its RED test reproduces it
first. **C7-N1 is new.** The rev-2 chain check found it, and it is part of the C6-7 fix.

| # | Sev | Verified root cause | Fix | Owner | Binary acceptance | Verification |
|---|---|---|---|---|---|---|
| C6-1 | P1 | **Data and turn structure.** Chaos acts once per round, and last: agility 18-24 against the party's 45-213 at level 40, with turn keys `agility x (1 + rng)` (`TurnOrder.ts`). A form change gives the new form no turn (`bossForms.ts:83-104`). Every segment falls within about 1 round. Baseline at level 40, pool 6000 (sim0): 4 rounds; no seed in which every form acts twice; F1 acts in 1 %; F3 never acts twice | Section 2: the **arrival turn**, the **gated floor** (C6-2), and the U-3 / U-2 data (pool 20000, B3-20k stats, a level-40 party) | TS-B (mechanism), TS-BAL (data, bounds) | `tests/balance/chaos.test.ts` green with the 2.5 bounds; RED first on 7c86057 | vitest; re-test 9.1 |
| C6-2 | P1 | Only form phases set the floor: `formFloor` / `nextFormPhase` (`bossForms.ts:44-57`). So the floor at F3 is the 0.15 one while the 0.25 crack is still uncrossed. Non-form phases fire only at round start (`ActionResolution.ts:77-100`, called at `BattleStateMachine.ts:279-281`). A hit lands on the 0.15 floor, the form changes at :366, and `applyFormChange` resets `crossedPhases` and `data` (`bossForms.ts:95-96`), so the crack can no longer fire | The **gated phase** rules M1-M3 (2.4) | TS-B | RED 5.1a/d | vitest; the crack invariant in `chaos.test.ts`; re-test |
| C6-3 | P1 | The scene builds the list with `buildEntries` only (`BestiaryScene.ts:105`), and that filters out `formOf` records (`bestiaryModel.ts:52`). `formSubEntries` / `formPages` (`bestiaryForms.ts:40-65`) are used only by `bestiaryForms.test.ts`. The deep link searches the top-level list (`BestiaryScene.ts:121-123`) | Section 3 | TS-BST (code), INT (AGENTS.md) | RED 5.4 | vitest; re-test 9.5 |
| C6-4 | P2 | Every number is drawn with `FLOAT_OUTLINE` 0x101018 and crit 0xff4444 (`BattleSceneTypes.ts:48-49`, used at `floatingNumbers.ts:45`). The outline vanishes on the black disc (`crop_disc_num.png`) | On a colossus target (`colossusAt(sprite) !== null`): outline 0xf8f8f8 at 3 px and crit 0xff6a6a, as new constants `FLOAT_OUTLINE_LIGHT` / `FLOAT_CRIT_ON_DARK` | TS-V | RED 5.5: colossus outline 0xf8f8f8; an atlas enemy keeps 0x101018 | vitest; re-test crop: a ring of >= 2 px with luma >= 0.8 |
| C6-5 | P2 | `SLAM_DIP_PX` 12 / `SLAM_DROP_PX` 8 (`colossusChoreography.ts:33-34`); `slamAt(t)` has one parameter (:85). `formatAnnouncement` has no `slam` case (`battleMessageUtils.ts:14`) | `slamAt(t, limits)` with dip 48 and drop **40**, each clamped per form by the border rule (4.2). F3: dip 48, drop 40, 88 px peak to peak. F4: dip clamped to 5, drop 40, **45** px. A second shake 6 frames after contact. The line "Chaos slams down!" (`${actorName} slams down!`) | TS-V | RED 5.6 (measured as in 4.2); the border and coverage tests green on every slam frame | vitest; re-test `sheet_slam` |
| C6-6 | P2 | Colossus icons use the atlas row: `ICON_PX` 24 (`statusIcons.ts:10`) at `colossusStatusAnchor` (`colossusProxy.ts:44`; drawn at `statusFx.ts:177`) on the corona, with no backing. The blind cloud overlaps the disc top | On a colossus: icons at 3x native (`COLOSSUS_ICON_PX` = 36) on a dark plate (0x101018, alpha 0.75, 4 px padding), so the row is 44 px tall. The `screenAnchors` head clamp (`colossusIndex.ts:174`) uses the 44 px row, so the row stays inside y 140..760 and the label stays >= 124. The blind cloud sits beside the row, outside the `core` box | TS-V | RED 5.7. **Pin updates:** `colossusAnchors.test.ts:44,72` use the colossus row height (44) instead of `ICON_PX`; :58 (label >= 124) stays and must stay green | vitest; re-test crop |
| C6-7 | P3 | `prepareRound` drops the `resolvePendingForms` result (`BattleStateMachine.ts:278`). `BattleScene.executeRound` (:395-414) never queues it | M4 (`roundFormChange`) plus the state path in 2.4 | TS-B | RED 5.1c, 5.3 | vitest; re-test 9.3 |
| **C7-N1** | P3 | **New in rev 2:** `setEnemyHp` sets `max(floor, hp)` (`enemyHp.ts:12`). After a direct write under the floor, the next damage **raises** HP back up to the floor. Chain check at 7c86057 with the planned mechanism and the old `setEnemyHp`: `currentHp = 1`, then a 174 hit gives HP 4800 | M5: `currentHp = floor === null ? hp : max(hp, min(floor, currentHp))`. A write never lifts HP up to a floor; damage from above a floor still stops at it. A heal and a revive (from 0) are unchanged | TS-B | RED 5.1e: after `currentHp = 1`, a hit leaves HP <= 1 | vitest |
| C6-8 | P3 | The label is a plain `BitmapText` in 0xffff00 (`BattleFieldTargeting.ts:150-151`), with no outline | On a colossus, a dark plate (0x101018, alpha 0.75, 3 px padding), built by a helper in `colossusCursor.ts` (47 lines). `BattleFieldTargeting.ts` (240 / 250) gets <= 2 lines | TS-V | RED 5.8 | vitest; re-test crop |
| C6-9 | P3 | `chaos_i1` is a message, a white flash and a fade dissolve. No fire is drawn | D-C7-8: the line becomes "The Sovereign's robe flares and burns away!", plus two orange flashes (`#ff7020`, alpha 0.6, 6 frames each) with a shake (`with: previous`) on the second. Existing steps only | TS-V (data) | `interludes.test` green. **Pin updates:** the `chaos_i1` total in `interludes.test.ts:69` and in the `battle-interludes.yaml:13` comment, from 436 to the measured total (expected 450; it must be <= 480) | vitest; re-test |
| C6-10 | P3 | The fade overlay is drawn into `layers.fx.flash` (`formChangeView.ts:156`). The layer order is `bg < colossus < ui < actors < fx < hud` (`BattleLayers.ts:30-49`), so the fade covers `ui` (the bottom windows) but not `hud` (the message window) | D-C7-9: the fade covers the field rect only (between the message window's bottom and the top of the bottom windows, from the layout constants). The flash stays full screen | TS-V (`formChangeView.ts`; TS-V is its only C7 editor) | RED 5.9: the fade's bounds lie in the field rect and meet no window | vitest; re-test: window luma within 2 % |
| C6-11 | P3 | `ActionNumbers.spawn` (`actionNumbers.ts:41`) places each event's number at its sprite's top, with no collision offset. The slam's targets are adjacent heroes | Inside **one `spawn` call** (= one action's damage events), a later number whose box meets an earlier one moves sideways by its width + 8 px (x+, or x- past the edge). This applies to **every multi-target number** (slam, FIR2 / HEAL on the party, all-enemy spells), not only the slam | TS-V | RED 5.10. Run `floatingNumberPlacement.test` (R28) first. If any of its cases would change, restrict the shift to party targets (D-C7-16) and report; the R28 file is never edited | vitest; re-test `slam_004` |
| C6-12 | P3 | **H12 (hypothesis):** `EnemyAnimPreview.fire` keeps each enemy's loop from its first fire (`enemyAnimPreview.ts:96-101`). The colossus view is built after its art loads, so at frame 0 `colossus(0)` is false and the atlas schedule stays | Fix inside `enemyAnimPreview.ts` only: an enemy whose data has a `colossus` id but no ready view gets **no** loop yet, and the loop is chosen on the first fire after the view is ready. No `BattleScene.ts` change | TS-V | RED 5.11 (`tests/scenes/battle/enemyAnimPreviewColossus.test.ts`). If it does not reproduce: a browser probe and the real cause recorded before any fix | vitest; re-test `sheet_loop` |
| C6-13 | P3 | `bestiary.yaml:24` sets `chaos: evil_temple`. The phase line (`bestiaryModel.ts:191-196`) falls back to "Fight x{hits}" | `rim` for `chaos` and the three form ids. A new template `phaseForm: "becomes the {form}"` with `formTitles` (section 3) | TS-BST | RED 5.4: "At 70% HP becomes the Orrery"; `backgroundFor('chaos')` = `rim` | vitest; re-test |
| C6-14 | P3 | `canRun: bossConfig?.canRun ?? true` (`BattleTrigger.ts:102`). `DebugScenarioLoader.ts:89-90` passes no bossConfig | `canRun: bossConfig?.canRun ?? forms.length === 0` | TS-B | RED 5.2: `['chaos']` gives false; `['goblin']` gives true; an explicit `bossConfig.canRun: true` wins | vitest; re-test |
| C6-12b (momus 12; rev-2 must-fix 1) | P3 | The interlude scenarios start their form at the full pool (`debug-scenarios.yaml:1276-1296`). With pool 20000, reaching i2 takes about 6 rounds and i3 about 9 | A debug-only scenario key **relative to the pool**: `enemyHp: {<index>: <fraction>}`. HP is set to `ceil(fraction x stats.hp)` with `setEnemyHp` after the instances are built. Validated like `enemyStatus`: an unknown index or a fraction outside (0, 1] gives `console.error` and is dropped. Presets, each just above the next floor at **any** pool: `chaos_interlude_1` F1 at 0.705 (floor 0.70); `_2` F2 at 0.405 (floor 0.40); `_3` F3 at 0.155 (the crack plays at the first round start, then the next hit reaches i3); `chaos_final` F3 at 0.26 (one hit to the crack floor). At pool 20000 these are 14100 / 8100 / 3100 / 5200 against floors 14000 / 8000 / 3000 / 5000; at today's 6000 they are 4230 / 2430 / 930 / 1560. So TS-B's F1 work is valid before TS-BAL changes the pool | TS-B (loader, trigger option, BSM config: <= 3 lines) | RED 5.2b: `chaos_interlude_2` starts F2 at `ceil(0.405 x pool)` (asserted with the record's own pool); 1.2 or an unknown index logs an error and is dropped | vitest; re-test 9.4 |

---

## 2. P1-1 model: the Chaos fight on the real state machine

### 2.1 Method

- **Party:** `chaos_forms` with the equipment as it is now (`debug-scenarios.yaml:1260-1263`), at **level 40**
  (U-2): max HP 666 / 420 / 586 / 303 and agility 45 / 213 / 88 / 49 (KNGT / NINJ / MSTR / WWIZ, measured).
- **Engine:** the copy in `/tmp/c7plan/sim/src`, with the planned mechanism applied. Diff against 7c86057:
  - `bossForms.ts`: a gated `nextFormPhase`; `resolvePendingForms(ctx, say, arrival = true)` resolves only when the
    next gated phase is a form phase; the arrival unshift after the re-choose loop.
  - `ActionResolution.ts`: the gated crossing rule.
  - `BattleStateMachine.ts`: `roundFormChange`, and `prepareRound` calls with `arrival = false`.
  - `enemyHp.ts`: M5.
  - `types/index.ts`: `BossPhase.arrivalTurn`.
- **Battle:** `new BattleStateMachine({party, enemies: [chaos], forms: formChain(...), canRun: false}, rng)`.
- **Seeds:** `mulberry32(s * 7919 + 13)` for s = 1..400, per policy.
- **Policies:**
  - **typical:** everyone uses Fight. WWIZ casts LIFE on a fallen member, HEAL when 2 or more are under 55 %, or CUR3
    on the most hurt member under 55 %.
  - **aggressive:** WWIZ heals only under 30 % (this was rev 1's "optimal").
- **Counters:**
  - Actions per form: counted by `data.id` before the action, from enemy actions that were not lost (messages
    matching `/is (asleep|stunned)!/`).
  - Command phases per form.
  - Crack before F4: the line "The horizon groans" was said before the change to `chaos_horizon_core`.
  - KOs.
  - **Party hit:** the median damage of a hero action that damaged Chaos.

### 2.2 Baseline (7c86057, unpatched, pool 6000; `/tmp/c7plan/sim0`)

| Level | Policy | Win | Rounds p10/med/p90 | All forms >= 2 \| win | F1 / F2 / F3 / F4 >= 2 \| win | F4 command phase | Party hit |
|---|---|---|---|---|---|---|---|
| 40 | typical | 100 | 3 / 4 / 5 | 0 | 0 / 50.5 / 0 / 2.3 | 69.8 | 555 |
| 40 | aggressive | 99.8 | 3 / 4 / 5 | 0 | 0 / 50.4 / 0 / 1.0 | 67.7 | 530 |
| 50 | typical | 100 | 3 / 3 / 3 | 0 | 0 / 0 / 0 / 0 | 9.3 | 849 |

### 2.3 Options measured at level 40

#### 2.3.1 Pool 20000 (U-3, current)

"Defense" is written F1 / F2 / F3 / F4, and so is "attack". F2-F4 agility is 160 unless noted, and F1 keeps the
roster rule (22). Each cell is typical / aggressive. "In 10-16" means rounds in 10-16. Outputs are
`/tmp/c7plan/sim/d1.out.json` and `d2.out.json`.

| Option | Win | Rounds med (p10-p90) | In 10-16 | All >= 2 \| win | Party hit | Verdict |
|---|---|---|---|---|---|---|
| Mechanism only, current stats (100/140/120/90, 100/90/120/130) | 19.5 / 16.5 | 10 (8-12) | 67.0 / 63.5 | 100 / 98.5 | 646 / 611 | Chaos too strong for the longer fight |
| Defense as now, attack 60/60/40/50 | 94.3 / 89.0 | 11 (11-12) | 99.5 / 99.8 | 99.2 / 99.4 | 663 / 647 | meets the targets, but the typical win leaves 5.2 points and the aggressive 89.0 is close to the band |
| Defense as now, attack 50/50/35/45 | 98.0 / 97.0 | 11 (11-12) | 99.0 / 99.8 | 99.5 / 99.5 | 652 / 640 | typical win leaves 1.5 points to the 99.5 cap |
| **B3-20k (recommended): F1 100, +20 (160/140/110), attack 50/50/35/45** | **96.5 / 91.8** | **12 (12-14)** | **100 / 100** | **99.5 / 99.5** | **577 / 568** | **meets every target with margin** |
| F1 140, +20, attack 50/50/35/45 | 94.8 / 91.8 | 13 (12-14) | 99.5 / 99.5 | 100 / 100 | 550 / 537 | alternative: more F1 time, smaller hits |
| F1 100, +40, attack 50/50/35/45 | 91.0 / 84.3 | 14 (13-15) | 98.8 / 97.8 | 99.5 / 99.4 | 486 / 482 | hits under 500 |
| F1 180, +0, attack 50/50/35/45 | 96.5 / 94.0 | 13 (12-15) | 99.0 / 99.5 | 100 / 100 | 514 / 508 | hit margin only 14 / 8 |
| B3-20k, pool **21000** (floors 14700 / 8400 / 5250 / 3150, all whole) | 95.0 / 90.5 | 13 (12-14) | 100 / 99.8 | 100 / 100 | 584 / 578 | also meets every target; 20000 kept (the ruled number, round floors) |
| B3-20k, no arrival turn | 99.5 / 100 | 12 (12-13) | 100 / 100 | 57.0 / 60.0 | 532 / 518 | the arrival turn is required (F4 >= 2 only 57.5 %) |
| B3-20k, F2-F4 agility as now | 98.8 / 99.3 | 12 (12-13) | 100 / 100 | 99.5 / 99.5 | 567 / 544 | works, but less threat (KO 77 / 80.5 %) and the win is near the cap |

More B3-20k numbers (typical / aggressive):
- F1 acts >= 1 in won runs: 100 / 100.
- Command phase in won runs: 100 for every form, both policies.
- At least one KO: 87.5 / 93.5.
- Crack before F4: true in every run, every option.
- Chain check at 20000 (`chain20.ts`): i1, i2, F3 arrival, crack, i3, F4 arrival.

**Hit size.** Today's hit at level 40 is ~555 (2.2; 620 with the mechanism and the current stats). B3-20k keeps 577,
so U-3 is met. The rough rule `pool / (rounds x 3)` gives about 555 at 20000 and 12 rounds, which matches.

**Level cliff (B3-20k; report only, not pinned):**

| Level | Win (typ / agg) | Rounds med (p10-p90) | In 10-16 | All >= 2 \| win | Party hit |
|---|---|---|---|---|---|
| 35 | 32.5 / 20.5 | 17 (14-19) | 47.8 / 52.8 | 100 / 100 | 384 / 383 |
| 38 | 83.8 / 76.8 | 14 (13-15) | 99.0 / 98.3 | 100 / 100 | 548 / 539 |
| **40** | **96.5 / 91.8** | **12 (12-14)** | **100 / 100** | **99.5 / 99.5** | **577 / 568** |
| 42 | 99.8 / 99.8 | 10 (9-11) | 63.8 / 63.8 | **30.1 / 30.1** | 610 / 587 |
| 45 | 100 / 100 | 8 (8-9) | 1.3 / 1.8 | **1.3 / 1.3** | 646 / 630 |

Reading the cliff:
- The cliff is steeper above level 40 than it was at pool 12000.
- At 42 and above, **F1** gets only one action in most wins: it falls within its first round, and it has no arrival
  turn. F2-F4 still act twice.
- Below 38 the party mostly loses.
- U-2 fixes the target at level 40. If the real encounter's party lands at 42 or above, F1 needs another look when
  the encounter is placed (K2). Possible fixes then: F1's defense, or an opening action for F1.

**New content is not needed.** B3-20k meets every target with existing knobs only, and no spell is added.

#### 2.3.2 Pool 12000 (rev 2, U-1; superseded by U-3, kept for the record)

B3-40 (F1 220, +40 (180/160/130), attack 60/60/40/50):

| Metric | Typical | Aggressive |
|---|---|---|
| Win | 96.5 % | 94.0 % |
| Rounds med (p10-p90) | 12 (10-13) | 12 (10-13) |
| All forms >= 2 \| win | 100 % | 99.7 % |
| Median party hit | 321 | 312 |

The full rev-2 table and its cliff are in `/tmp/c7plan/plan_rev2_backup.md` 2.3.

### 2.4 The mechanism (TS-B), exact rules

- **M1, gated phase.** A boss phase is **gated** if it has `form` or `interlude`. `nextGatedPhase(enemy)` is the
  uncrossed gated phase with the highest `hpThreshold` (it replaces `nextFormPhase`; `formFloor` uses it).
- **M2, one rounding rule.** For a gated phase, both the floor and the reach use `f = ceil(t x stats.hp)`:
  - The floor: HP never drops below `f` while the phase is uncrossed.
  - The reach: a phase is reached when `hp <= f`.
  - `checkBossPhases` uses the same rule (`hp <= f`) for a non-form gated phase. Phases without an interlude keep
    `hp / pool <= t`, so Garland, the Seraph and R28 are unchanged.
  - RED 5.1d (pool 6001): the crack floor is 1501, HP held at 1501 crosses at the next round start, and the boss can
    then fall. Under the old rule `1501 / 6001 > 0.25` would softlock.
- **M3, the reach respects the gated floor.**
  - `resolvePendingForms` changes the form only when the next gated phase is a **form** phase and is reached.
  - When the next gated phase is a non-form phase (the crack), nothing changes after the action. The crack is crossed
    by `checkBossPhases` at the **next round start** (the existing B5 line `{text, interlude: 'chaos_crack'}`; its
    `hits: 4` applies).
  - Only then is the 0.15 form phase next, and it can resolve after a later action.
  - So in normal play F3 at `ceil(0.30 x pool)` and one 9999 hit leave `ceil(0.25 x pool)` (at 20000: 6000 -> 5000).
    The crack plays at the next round start, and F4 comes after a later hit.
- **M4, round-start change.**
  - `prepareRound` stores its result in a public getter `roundFormChange: FormChangeResult | null`, cleared at the
    next `prepareRound` (<= 3 lines in `BattleStateMachine.ts`).
  - `prepareRound` calls `resolvePendingForms(ctx, say, false)`, so **no arrival** is added (the queue is rebuilt at
    :309 in any case; the flag makes it testable).
- **M5, a write never raises HP to a floor** (C7-N1): `max(hp, min(floor, currentHp))`.
- **M6, the arrival turn.**
  - The data key is `BossPhase.arrivalTurn?: true`. `src/core/mapValidators.ts` (boss-phase keys, :95-102) accepts it
    only together with `form`. `src/types/index.ts` grows from 417 to 419 lines (record it).
  - The three form phases in `enemies.yaml` set it.
  - In `applyFormChange`, after the re-choose loop (:100-102), it does
    `ctx.queue().unshift({combatantId: enemy.id, command: rechoose(enemy, ctx), isEnemy: true})` when all of these
    hold: `arrival` is true, `phase.arrivalTurn` is set, and a hero is alive.
  - The RNG order is fixed: first the re-choice of every queued Chaos command, then the arrival's. The command uses
    `ctx.turn()`.
  - 0 lines in `BattleStateMachine.ts` for this; `bossForms.ts` grows from 131 to about 150.

  **Arrival edge cases (RED 5.1b, each with its expected result):**

  | Case | Expected |
  |---|---|
  | A hero action reaches a form floor and Chaos still has a queued slot | The next executed action is the new form's arrival; its queued slot (re-chosen) also runs later that round, so **2 Chaos actions** that round |
  | Chaos already acted this round | The arrival is its only further action; 2 actions that round in total |
  | Chaos's own action or its end-of-turn poison tick reaches the floor (debug or preset only; Chaos has `protect: status`) | The arrival runs right after, so Chaos acts **twice in a row** (old form, then new form); test with `enemyStatus: poison` and HP 1 above the floor |
  | The change happens at `prepareRound` | No arrival; the round's queue has exactly one Chaos command |
  | No hero alive after the action, or the battle is decided | No arrival is queued (`done` stays true) |
  | Seeded command order | With `rng = mulberry32(1)`, the re-chosen slot draws first and the arrival second (asserted command sequence) |

  The turn list adds the arrival when it is announced (`TurnList.add`); scene test 5.3 walks it through announce and
  result.

- **The round-start interlude state path** (`BattleScene.ts`, TS-B; <= 6 lines in `executeRound`, after the turn-list
  setup and before the round-start lines):

  ```ts
  const fc = this.battle.roundFormChange;
  if (fc && (this.animation.formView.queue({ done: false, messages: [], damageEvents: [], missed: false, formChange: fc }),
      this.animation.formView.start())) {
    this.currentMessageIndex = -1; this.lineInterlude = true; this.uiState = 'message'; return;
  }
  ```

  - The existing `'message'` case runs `formView.update(dt, skip)` (:253-255). At its end it calls `advanceMessage()`,
    which moves the index from -1 to 0. Then it shows the round-start lines if there are any, else it calls
    `startActions()` (state `execution`).
  - No message index is consumed, and `completeAction` (`BattleAnimationController.ts:289-297`) is not touched.
  - `formChangeView.ts` is unchanged by TS-B: the queue is the existing `queue(result)` with a valid `ActionResult`.

- **HP-write semantics (one per use):**
  - **(a) A direct write, `enemy.currentHp = n`.** This is a public field; scripted changes, the C6 `o1` repro and the
    re-tester's `__game` probe use it. With M1-M5, writing 1 at the command phase gives:
    - **i1** at that round's start
    - **i2** after the first action, then the F3 arrival
    - the **crack** at the next round start
    - **i3** after the next action, then the F4 arrival

    Verified in the sim copy at pool 12000 (`chain.ts`) and 20000 (`chain20.ts`). RED 5.1c asserts this chain.
  - **(b) `setEnemyHp(enemy, n)`** clamps at the current floor, so each nudge moves at most one form. RED 5.1c, second
    case.
  - **AGENTS.md** documents both: use (b) to step through the forms one at a time; (a) is a stress case.

### 2.5 B3-20k data (TS-BAL, `enemies.yaml`), and the pinned bounds (`tests/balance/chaos.test.ts`)

| Record | hp | defense | agility | attack | Derived (rosterData 7.1 rule) |
|---|---|---|---|---|---|
| `chaos` (F1) | 6000 -> **20000** | 100 (unchanged) | 22 (rule) | 100 -> **50** | strength 40, vitality 52 (unchanged) |
| `chaos_orrery` (F2) | **20000** | 140 -> **160** | 24 -> **160** | 90 -> **50** | strength 40, vitality 82 |
| `chaos_horizon` (F3) | **20000** | 120 -> **140** | 18 -> **160** | 120 -> **35** | strength 28, vitality 72 |
| `chaos_horizon_core` (F4) | **20000** | 90 -> **110** | 18 -> **160** | 130 -> **45** | strength 36, vitality 57 |

- The thresholds stay 0.70 / 0.40 / 0.15, and the F3 crack stays at 0.25. Every floor is **`ceil(t x pool)`**; at pool
  20000 they are 14000 / 8000 / 5000 (the crack) / 3000.
- The hits, AI and spells are unchanged.
- The form records have no `num`, so the agility rule (`rosterStats.test.ts:41`) does not apply to them. F1 keeps the
  rule, and the tuned-set pin (:58) is unchanged.
- `debug-scenarios.yaml`: the `&chaos_party` anchor (:1259-1263) goes to level 40. That changes every `chaos_*`
  scenario.

**Pin updates (updated, never deleted), all listed once in F2:**
- `rosterData.test.ts:85-86`: the hp becomes 20000, with the comment citing U-3.
- `tests/data/chaosForms.test.ts`, which pins 6000.
- Every scene test that builds the **real** Chaos records with 6000. TS-BAL lists them: candidates are
  `lineInterlude.test`, `formChangeView.test` and `skyDim.test`. Synthetic records (`bossForms.test.ts`,
  `POOL = 6000` by design) stay.
- **TS-BST check:** the bestiary HP line is now 5 digits. TS-BST confirms that the Chaos stats page still fits
  (`bestiaryFit.ts`) at 20000. No bestiary file pins Chaos HP.

**Bounds.**
- Each statistical bound is at least **3 points** from its measured value.
- For a round count, "points" means **rounds**, and the margin is **at least 2 rounds**. This is orchestrator ruling
  **D-C7-19**: the lower median bound (10) is the target itself and cannot move. INT adds the rule to AGENTS.md "Test
  Patterns".
- The measured value goes in the test name.
- Invariants are asserted exactly and labelled "invariant".

| Kind | Bound | Typical (measured) | Aggressive (measured) | Margin |
|---|---|---|---|---|
| bound | each form acts >= 2 times in >= 90 % of wins (the target) | 99.5 | 99.5 | 9.5 / 9.5 |
| bound | rounds in 10-16 in >= 91 % of runs | 100 | 100 | 9 / 9 |
| bound (count) | median rounds in [10, 15] (D-C7-19) | 12 | 12 | 2 rounds below, 3 above |
| bound | win rate in [85, 99.5] % (typical) and [75, 97] % (aggressive) | 96.5 | 91.8 | 3.0 / 5.2 to the caps |
| bound | at least one KO in >= 70 % of runs (the fight threatens) | 87.5 | 93.5 | 17.5 / 23.5 |
| bound | F1 acts >= 1 in >= 97 % of wins (stochastic, not structural) | 100 | 100 | 3 |
| bound | command phase in >= 97 % of wins, every form | 100 | 100 | 3 |
| bound | **median party hit >= 500 (U-3, a user number)** | 577 | 568 | 77 / 68 |
| **invariant** | in every run that reaches F4, the crack line comes before the change to F4 | true | true | exact |
| **invariant** | the forms appear in chain order, each at most once | true | true | exact |

The invariants are also unit-tested in `bossForms.test.ts` (5.1a, 5.1c). In `chaos.test.ts` they are a regression
net, not balance.

**Re-tune and escalation (TS-BAL, F2).**
- **Drift.** If the engine re-measure leaves less than 3 points (2 rounds) to any bound:
  1. Re-tune within the B3-20k knobs: F1 defense 80-140, F2-F4 defense +0 to +40, each attack +-10.
  2. Then try the measured alternatives in 2.3.1 (F1 140; pool 21000; F2-F4 agility as now).
  3. Then **stop and report** to the orchestrator, who reports to the user if a U-ruling is at stake.

  The knob ranges are never widened silently, and a bound never moves past its target.
- **A new pool.** The knob ranges, the 2.3 table and the measured values are specific to pool 20000. If the pool
  changes again before F2, that reopens 2.3: TS-BAL re-measures in an out-of-repo copy and re-derives the knobs, while
  the bounds stay tied to their targets.
- **What stays valid at any pool:**
  - M1-M6 and the state path (every floor, reach and crossing is `ceil(t x stats.hp)`)
  - the fraction presets (C6-12b)
  - the `ceil(t x POOL)` test expectations (5.1)
  - `formValidation.ts:37` (one shared pool, any value)
  - the TS-V and TS-BST work

### 2.6 Harness (committed; no private access, no mocks)

- **`tests/helpers/chaosBattle.ts` (new, <= 150 lines):**
  - The party, read from the `chaos_forms` entry of `debug-scenarios.yaml` and built with the class, equip and learn
    rules as `debugParty.buildMember` does.
  - The two policies.
  - `runChaos(seed, policy, level = 40)`, which returns
    `{win, rounds, acts: Map<formId, n>, cmdPhases, crackBeforeF4, formOrder, kos, heroHits}`.
- **API used:**
  - setup: `new BattleStateMachine({..., forms})`, `startBattle`, `advanceFromIntro`
  - command phase: `state`, `currentCommandActor`, `currentCommandActorId`, `submitCommand`, `getPartyId`
  - execution: `prepareRound`, `currentMessages`, `peekNextAction`, `executeNextAction` (its `messages`,
    `damageEvents`, `formChange`), `actionQueueLength`, `resolveRound`, `isOver`, `outcome`
  - reads: `allEnemies`, `livingEnemies`, `allParty`
- **Lost turns** are excluded by matching `/is (asleep|stunned)!/` on the action's messages, as `runBattle` does.
- **Party check (rev-2 should-fix 8).** The committed harness builds the party from the yaml through
  `debugParty.buildMember`, while the sim built it by hand. So the harness first **asserts the level-40 party**: max HP
  666 / 420 / 586 / 303 and agility 45 / 213 / 88 / 49 (KNGT / NINJ / MSTR / WWIZ, 2.1). It fails loudly on any
  difference before measuring anything.
- **`tests/balance/chaos.test.ts`:** 400 seeds per policy. It reports the level cliff (35, 38, 42, 45) with
  `console.info` and does not pin it.
- **`battlePolicies.runBattle`:** gains an optional `forms` (2 lines).

---

## 3. P1-3 bestiary wiring (TS-BST)

Touch points and line costs. `BestiaryScene.ts` is at 227 / 250; the budget is **<= 16 lines** there, and the logic
lives in `bestiaryForms.ts`.

| Where | Change | Lines |
|---|---|---|
| `bestiaryForms.ts` | `withFormSubEntries(entries, enemies, data, isSeen)` inserts `formSubEntries(root)` after each root, in chain order; `formTitles` read from the data | +25 (file 65 -> 90) |
| `BestiaryScene.ts:105` | build the list with `withFormSubEntries` | 2 |
| `BestiaryScene.ts:191` | `titleCount(entry, topLevelCount, data)`: the total counts top-level entries only (127, not 129); a sub-entry shows its root's place (D-C7-10) | 2 |
| `BestiaryScene.ts:120-140` | the deep link: a sub-entry id opens it; `chaos_horizon_core` opens the Horizon entry and sets `this.page` to F4's first page (today :140 sets 0) | 4 |
| `BestiaryScene.ts:164-167` (Start / page key) | when the page moves between F3's pages and F4's, refresh the preview and the title | 3 |
| `BestiaryScene.ts:195-204` (`showPreview`) | `showPreview(i, page)`: on an F4 page the preview shows `colossus/chaos_horizon_core/preview.png` (it exists) and the stats come from `chaos_horizon_core`; the title reads "128 Chaos (Core)" | 5 |
| `bestiaryInfo.ts` `pageCount` / `pageLines` | the Horizon entry's pages are F3 stats, F3 info, F3 lore, then F4 stats and F4 info (`formPages`) | +12 |
| `src/types/bestiaryData.ts` (template keys :31-34) | `formTitles: Record<string, string>` and the template key `phaseForm` | +3 |
| `assets/data/bestiary.yaml` | `formTitles: {chaos_orrery: Orrery, chaos_horizon: Horizon, chaos_horizon_core: Core}`, `templates.phaseForm: "becomes the {form}"`, and `backgrounds.enemies`: `rim` for all four ids | data |
| `bestiaryModel.ts:191-196` | a form phase writes `phaseForm` | +2 |

- **Seen.** In `mode: seen`, a sub-entry and F4's pages show `???` with no preview until `SEEN:<id>` is set (the flags
  are already set at the swap). `mode: all` shows them all.
- **Fallback D-C7-10b.** If the page path breaks the 16-line budget, or `BestiaryPreview.ts` (230 / 250) would need
  more than 10 lines, F4 becomes a third sub-entry "128 Chaos (Core)" instead. TS-BST reports this; it is not done
  silently.
- **AGENTS.md (INT).** The four deep links and the sub-entry and page model.

---

## 4. Design notes

- **4.1 Numbers and labels.** Only colossus targets change; the proxy test is `colossusAt(sprite) !== null`.
- **4.2 Slam (C6-5).**
  - The limits come from the form's `place` and size in `colossus.json` and the border rule (bottom >= 786, top
    <= 114), minus `BREATH_PX` (4). They are computed in `colossusChoreography.ts` (191 lines), because
    `ColossusView.ts` is at 248 / 250 (+1 line there).
  - F3 (rest y -60, bottom 1020): dip 48 (bottom 972), drop 40 (top -20).
  - F4 (rest y -285, bottom 795): dip clamped to 5 (bottom 790 >= 786), drop 40 (top -245).
  - **Peak to peak** is measured on the slam offset `slamAt` alone, **without** the breathing, as `max - min` over the
    44 frames. The border tests run **with** the breathing at margin 0, as `ColossusView.test.ts:147` does.
  - F3 measures 88 and F4 45 (bound 40, F4's margin 5).
  - The B4 pan limits and the R14 seam tests stay green.
- **4.3 Status row (C6-6).** `COLOSSUS_ICON_PX` = 36 and the plate are drawn in `statusFx` only for a colossus. The
  `screenAnchors` head clamp uses the 44 px row (36 + 2 x 4 padding).
- **4.4 Fade region (C6-10).** The field rect comes from the existing layout constants. No new constants.
- **4.5 i1 (C6-9).** Data only. The total is checked by the validator cap (<= 480) and pinned in `interludes.test`.

---

## 5. Tests, RED first (each RED output goes into the agent report)

| # | File | Case | RED on 7c86057 because | Owner |
|---|---|---|---|---|
| 5.1a | `tests/battle/bossForms.test.ts` (synthetic fixture, **`POOL = 6000`**, the file's existing pool; every expectation written as `Math.ceil(t * POOL)`) | F3 at `ceil(0.30 * POOL)`, then one 9999 hit leaves `ceil(0.25 * POOL)`; the next round start says `{text, interlude: 'chaos_crack'}`; F4 only after a later hit | lands at `ceil(0.15 * POOL)` and becomes F4 | TS-B |
| 5.1b | same (`POOL = 6000`) | the six arrival cases of 2.4 M6 | no arrival exists | TS-B |
| 5.1c | same (`POOL = 6000`; the chain asserts the form ids and interlude ids, never HP literals) | (a) `currentHp = 1` at the command phase gives `roundFormChange` F1 -> F2 (i1), then F2 -> F3 (i2), the crack at the next round start, then F3 -> F4 (i3), each once; (b) `setEnemyHp(e, 1)` moves one form per nudge | the change is dropped; F2 is skipped; HP is lifted to the floor | TS-B |
| 5.1d | same (its own fixture, **`POOL = 6001`**) | pool 6001: the crack floor is 1501, HP 1501 crosses at the round start, and the boss can then fall | n/a (new rule); asserts no softlock | TS-B |
| 5.1e | same (`POOL = 6000`, `ceil(t * POOL)` expectations) | C7-N1: `currentHp = 1`, a hit leaves HP <= 1; at F2, damage from `ceil(0.45 * POOL)` still stops at `ceil(0.40 * POOL)` | HP lifted to the floor | TS-B |
| 5.2 | `tests/systems/battleTriggerForms.test.ts` | `canRun` false for a form chain | true | TS-B |
| 5.2b | `tests/systems/debugScenarioEnemyHp.test.ts` (new) | the fraction presets: each `chaos_interlude_*` / `chaos_final` enemy starts at `ceil(fraction * record.stats.hp)`, asserted with the record's own pool (so the test holds at 6000 in F1 and 20000 after F2); the fraction 1.2, 0 and an unknown index log an error and are dropped | no key | TS-B |
| 5.3 | `tests/scenes/battle/roundFormChange.test.ts` (new) | (a) the round-start interlude plays before the first announcement; no message index is consumed; then the round-start lines, then the actions; an arrival walks through announce and result. (b) **Art not ready** (rev-2 should-fix 5): the colossus tiles for the incoming form are not loaded when `queue` and `start` run in the same frame. Expected: the interlude runs to its end with no stall and no error; at `swap` the existing missing-art path applies (the placeholder box plus one console warning, as for missing atlas art); the real art replaces it when its load resolves, through the guarded `upgradeToArt` (R15). In play the tiles are already loaded at battle start (`ColossusArt`), so this case covers a slow or failed load only. If the existing path does not upgrade a colossus, TS-B records it as a P3 and reports; it is not silently left | the change is dropped | TS-B |
| 5.4 | `tests/scenes/bestiary/bestiaryForms.test.ts` (new cases) + `bestiarySceneForms.test.ts` (new) | list order and title count 127; the deep links incl. the F4 page; seen gating; `phaseForm`; `rim` | not wired | TS-BST |
| 5.5 | `tests/scenes/battle/colossusNumbers.test.ts` (new) | light outline on a colossus; atlas unchanged | dark outline | TS-V |
| 5.6 | `tests/scenes/battle/colossusSlamMotion.test.ts` (new) | peak to peak: F3 >= 40 (88), F4 >= 40 (45); the borders on every frame; "Chaos slams down!" | 20 px; "acts!" | TS-V |
| 5.7 | `tests/scenes/battle/colossusStatusRow.test.ts` (new) + `colossusAnchors.test.ts` (pins :44, :72) | 36 px icons, the plate, the row inside 140..760, the label >= 124, the cloud outside the core box | 24 px, no plate | TS-V |
| 5.8 | `tests/scenes/battle/colossusTargetLabel.test.ts` (new) | a plate on a colossus label | no plate | TS-V |
| 5.9 | `tests/scenes/battle/formChangeView.test.ts` (new case) | the fade's bounds inside the field rect | full screen | TS-V |
| 5.10 | `tests/scenes/battle/spawnOverlap.test.ts` (new) | the slam on KNGT and NINJ, and a FIR2 on the party: no boxes intersect | overlap | TS-V |
| 5.11 | `tests/scenes/battle/enemyAnimPreviewColossus.test.ts` (new) | a late-ready colossus gets `colossusSchedule` (H12) | atlas schedule kept | TS-V |
| 5.12 | `tests/data/interludes.test.ts` | the new i1 line; total <= 480, pinned at the measured value | 436 | TS-V |
| 5.13 | `tests/balance/chaos.test.ts` (new) | the 2.5 bounds and invariants | 4 rounds, 0 % >= 2 (2.2) | TS-BAL |

**Pins that change:**
- 5.7 (`colossusAnchors.test.ts:44,72`)
- 5.12 (`interludes.test.ts:69` and the yaml comment)
- the 2.5 pool pins
- **No R28 file is edited.** If one goes red, the change is wrong: stop and report to INT.

---

## 6. Tranches, ownership, watchdog

At most **4 agents at once** (D-C7-14). Worktrees are branched from `roster-int` at 7c86057.

**File ownership in C7 (no overlap):**
- **TS-B:** `src/battle/*` (bossForms, enemyHp, ActionResolution, BattleStateMachine), `src/scenes/BattleScene.ts`,
  `src/systems/BattleTrigger.ts`, `DebugScenarioLoader.ts`, `src/core/mapValidators.ts`, `src/types/index.ts`, the
  `arrivalTurn` keys in `enemies.yaml`, and the `enemyHp` presets in `debug-scenarios.yaml`.
- **TS-BAL:** the stats in `enemies.yaml` (F2), the `&chaos_party` level, the harness and the pool pins.
- **TS-V:** `src/scenes/battle/**` except `BattleScene.ts` (incl. `formChangeView.ts`, `enemyAnimPreview.ts`,
  `actionNumbers.ts`, `colossus/*`, `fx/*`, `battleMessageUtils.ts`, `BattleSceneTypes.ts`, `BattleFieldTargeting.ts`),
  and `battle-interludes.yaml`.
- **TS-BST:** `src/scenes/bestiary/*`, `src/types/bestiaryData.ts`, `bestiary.yaml`.
- **INT:** AGENTS.md and the docs.
- Both `enemies.yaml` and `debug-scenarios.yaml` are touched by TS-B (F1) and TS-BAL (F2), **in sequence**: TS-BAL
  rebases after TS-B merges.

| Tranche | Agents | Work | Exit gate |
|---|---|---|---|
| F0 | orchestrator | check rev 3 against momus's rev-2 conditions (OKAY on must-fix 1-2) | recorded |
| F1 | TS-B, TS-V, TS-BST, TS-BAL (4) | TS-B: M1-M6, C6-7, C7-N1, C6-14, the `enemyHp` key, 5.1-5.3. TS-V: C6-4/5/6/8/9/10/11/12, 5.5-5.12. TS-BST: section 3, C6-13, 5.4. TS-BAL: `chaosBattle.ts` + `chaos.test.ts` **RED on 7c86057**, reproducing 2.2 at level 40 within 2 points (with the party's level set inside the harness, no data edit) and asserting the 2.1 party stats. The `enemyHp` presets are fractions, so TS-B's F1 work does not depend on the pool, which changes only in F2 | each branch: `tsc`, build and vitest green, apart from TS-BAL's intended RED; RED outputs in the reports |
| F2 | INT, then TS-BAL (1) | INT merges TS-B, TS-V and TS-BST into `roster-int`, in that order. TS-BAL rebases, applies the 2.5 data and the level-40 party, updates the pool pins, re-measures, pins the bounds (2.5 re-tune rules) and turns GREEN | `chaos.test.ts` green with its margins |
| F3 | INT | merge TS-BAL; section 7 gate; docs (section 8) | gate all green |
| F4 | TST (fresh, no plan context) | section 9 | rows in ROSTER_PLAYTEST "Chaos re-test (C8)" |
| F5 (if needed) | <= 4 | a second fix round for any open P0/P1 | after 2 rounds with an open P0/P1, **escalate to the user** (CHAOS_FORMS_PLAN 12) |

**Watchdog (binding).**
- Every long command runs in the background as `<cmd> > /tmp/<agent>/<step>.log 2>&1; echo EXIT=$? >> /tmp/<agent>/<step>.log`.
  The agent waits with Monitor `until grep -q EXIT= /tmp/<agent>/<step>.log; do sleep 2; done`, with a timeout
  <= 240 s, re-armed with a progress line.
- No foreground `sleep`, no self-matching `pgrep` loops, foreground calls under 2 minutes.
- The full vitest run and the build run in the background.
- No bare `git stash`: only `git stash push -m <label> -- <paths>`, or a WIP commit.
- **Commit right after any `lock`.** None is planned.
- No asset build is planned. If one runs, never two `monsters_ai` or `colossus` builds in one worktree.
- **Scratch code never goes in the worktree.** Measurements run from a copy outside the repo (as in `/tmp/c7plan/sim`).
- **Budgets:** 0 Bedrock, 0 Gemini (Bedrock stays at 25 of 80). A call needs written approval from the orchestrator
  first.

**Line ceilings.**

| File | Now | Allowed growth |
|---|---|---|
| `BattleStateMachine.ts` | 562 / 592 | +4 (`roundFormChange`, the `enemyHp` config) |
| `BattleScene.ts` | 533 / 594 | +6 |
| `bossForms.ts` | 131 | <= 160 |
| `BestiaryScene.ts` | 227 / 250 | +16 |
| `BattleFieldTargeting.ts` | 240 / 250 | +2 |
| `ColossusView.ts` | 248 / 250 | +1 |
| `BattleAnimationController.ts` | 303 / 308 | 0 |
| `src/types/index.ts` | 417 | +2 |

INT records the measured counts.

---

## 7. Validation gate (INT, F3)

```bash
npx tsc --noEmit && npm run build && npx vitest run              # background + Monitor each
npx vitest run tests/balance/chaos.test.ts                        # bounds + invariants
git diff --exit-code 7c86057 -- tests/battle/BossPhase.test.ts tests/battle/BossBattle.test.ts \
  tests/scenes/battle/tierHTravel.test.ts tests/scenes/battle/lungeClearance.test.ts tests/scenes/battle/fxBigBoxes.test.ts \
  tests/scenes/battle/floatingNumberPlacement.test.ts tests/scenes/battle/enemyTravel.test.ts \
  tests/scenes/bestiary/bestiaryCentre.test.ts                    # R28 byte-unchanged (paths checked)
git diff --exit-code 7c86057 -- assets/sprites assets-src/gen/approved assets-src/gen/anim   # no art changed
python3 -I assets-src/gen/colossus.py budget --check              # main checkout: OK, Bedrock 25 of 80
python3 -I assets-src/gen/monster_anim.py check --all             # 123 OK lines, unchanged
git status --short | grep -v '^??' ; ls tests/balance             # no scratch file in the tree
```

Browser checks: a dev server bound to 127.0.0.1 on a free port, every URL with `&mute=1`. INT runs:
- `chaos_forms`, played twice with no hooks
- `chaos_final` and `&enemyAnim=loop`
- `chaos_interlude_1..3` (with the `enemyHp` presets; each reaches its interlude in <= 2 rounds)
- the four `?bestiary=` deep links
- the `mode: seen` route
- crops for C6-4, C6-6 and C6-8
- the console: no errors

---

## 8. Documentation (INT)

- **AGENTS.md "Boss Forms":**
  - pool 20000 (U-3). The floors are written as the formula **`ceil(t x pool)` at t = 0.70 / 0.40 / 0.25 (the crack) /
    0.15**, with "14000 / 8000 / 5000 / 3000 at pool 20000" given only as the current example (rev-2 should-fix 7)
  - the gated phases M1-M3 and the one rounding rule
  - the arrival turn (`arrivalTurn`)
  - the round-start change and its interlude
  - M5
  - the two HP-write semantics (2.4)
  - `canRun` false for a form chain
  - the `enemyHp` scenario key: fractions of the pool, and its presets
  - the level-40 `chaos_forms` party
  - the corrected bestiary line (sub-entries, the F4 page, the four deep links)
  - the B3-20k stats ("tuned by tests/balance/chaos.test.ts")
  - the test count
- **AGENTS.md "Test Patterns":**
  - add `chaos.test.ts`
  - the out-of-repo scratch rule
  - **D-C7-19:** a round-count bound keeps a margin of at least 2 rounds, where the 3-point rule cannot apply because
    the bound is the target itself
- **`CHAOS_FORMS_PLAN.md`:**
  - 15.1: add U-1 (pool 12000, overrides D-U3's pool), U-2 (level 40) and U-3 (pool 20000, overrides U-1; median
    hit >= 500).
  - 15.2: the D-C7 rulings.
  - 2.2 item 9 and 15.3 R9: name the arrival turn as an orchestrator re-ruling (D-C7-1).
  - A "C7 results" table.
- **`ROSTER_LOG.md`:** "Pass C: C7".
- **`BESTIARY_PLAN.md`:** sub-entries and the F4 page.
- **`ROSTER_PLAYTEST.md`:** the C8 re-test section (TST).

---

## 9. Fresh re-test (TST, F4)

The tester is a fresh agent. It gets only AGENTS.md, the scenario ids and the URL rules (`&mute=1`), as in
CHAOS_FORMS_PLAN 12.

The pass thresholds match the 2.5 bounds, measured at pool 20000 over won runs: each form >= 2 at 99.5 %, command
phases at 100 %, and 10-16 rounds at 100 %. The chance that a correct fix fails the 3-won-run check is about 1.5 %.

1. **`chaos_forms`:** **3 won** natural runs with no HP hooks (Fight with everyone; WWIZ heals under 55 %).
   - **Replay rule (rev-2 should-fix 4).** The typical win rate is 96.5 %. A lost natural run is noted (the round it was
     lost, the form it reached) and replayed. Loss and Retry themselves are checked in item 2.
   - At most 5 attempts. Two or more losses in 5 attempts are filed as a P2 balance finding (the chance with a correct
     fix is about 1 %).
   - The checks below apply to **each won** run:
   - every form takes >= 2 actions (from the log or turn list)
   - every form gets a command phase (measured 100 % at pool 20000)
   - the fight lasts **10-16 rounds**
   - the crack plays before F3 -> F4
   - one of the three runs is played with confirm mashed
2. **Loss:** start the fight from the field (`r_ow_temple` plus the trigger), lose, then Retry. Retry restarts at F1.
3. **Overkill and HP writes:**
   - a high-damage attempt
   - (a) a direct write `battle.allEnemies[0].currentHp = 1` at the first command. Expected, in order: i1, i2 (with
     the F3 arrival), the crack, i3, each once.
   - (b) the documented nudge through `setEnemyHp`, if the tester can reach it. Expected: one form per nudge.
4. **Interlude scenarios:** `chaos_interlude_1..3` with `&slow=1`. Each reaches its interlude within 2 rounds.
   `chaos_final` reaches the crack within 2 rounds.
5. **Every C6 finding** (C6-4 .. C6-14) with its C6 repro, plus C7-N1 through 3(a): a verdict and a crop or sheet for
   each.
6. **Bestiary:** `mode: seen` before and after a win; the four deep links; the background and the phase line; the
   title count 127.
7. **The section 12 probes:** stuck or input-eating interludes, hidden numbers or cursor, exposed edges, party
   readability, fps >= 55 on the dev machine over the F3 loop, textures released after battle, the final form feeling
   biggest. Plus the 6-battle regression sample from C6.

Findings are rated P0-P3. Pass: no P0/P1.

---

## 10. Decisions

### 10.1 User rulings (2026-11-16, relayed by the coordinator)

| # | Ruling | Effect |
|---|---|---|
| U-1 | B3: pool 12000 (overrides D-U3's 6000); thresholds 0.70 / 0.40 / 0.15 and the crack at 0.25 kept; party hits stay large | **superseded by U-3**. Rev 2's ">= 250" hit bound was the plan's own reading of "large" (rev-2 should-fix 6); it is replaced by U-3's number |
| U-2 | **Level 40** is the target (closer to FF1 end-game); `chaos_forms` goes to level 40 | 2.3 and 2.5; the cliff at 35 / 38 / 42 / 45 is reported |
| **U-3** | **Pool about 20000** (overrides U-1), so that party hits stay near today's ~555 at level 40; targets unchanged, plus **median party hit >= ~500** | pool 20000 (21000 also measured and also fits; 20000 kept); B3-20k data (2.5); the hit bound >= 500 is a user number (measured 577 / 568) |
| (note) | No new spells; boss spells come later | none needed: B3-20k meets every target with existing knobs |
| D-C7-15 | Smaller numbers with R3 | **moot** (U-1, U-3) |

### 10.2 Orchestrator decisions (proposed defaults)

| # | Decision | Proposed |
|---|---|---|
| D-C7-1 | The arrival turn (M6) for F2-F4. It **re-rules 15.3 R9** (F2 / F4 "existing knobs only"; F3's slam the one scoped mechanic) and 2.2 item 9. Both are orchestrator rulings, so no user ruling is needed | yes |
| D-C7-2 | The gated phases (M1-M3) and the one rounding rule (M2) | yes |
| D-C7-3 | B3-20k stats; F2-F4 agility 160 (more threat than "as now", whose typical win sits near the cap) | yes |
| D-C7-4 / 5 | "A form change ends the round" / a per-round damage cap | no (modelled in rev 1: no gain / opaque) |
| D-C7-6 | `canRun` false by default for a form chain | yes |
| D-C7-7 | "Chaos slams down!" | yes |
| D-C7-8 | i1: reword plus two orange flashes (0 art) | yes |
| D-C7-9 | i2 fade: field only | yes |
| D-C7-10 | Bestiary: sub-entries share 128, the title total is 127, F4 is the Horizon entry's page; 10b fallback to a third sub-entry | yes |
| D-C7-11 | Colossus icons 36 px on a 44 px plated row; the head clamp updated; the cloud beside the row | yes |
| D-C7-12 | Colossus numbers: light outline, brighter crit | yes |
| D-C7-13 | Slam: dip 48 / drop 40, the per-form clamp (F4 dip 5) | yes |
| D-C7-14 | 4 agents per tranche (the coordinator's cap; plan 12 said 3) | yes |
| D-C7-16 | The number overlap shift: every multi-number spawn; party targets only if R28 would otherwise change | yes |
| D-C7-17 | M5: a write never raises HP to a floor | yes |
| D-C7-18 | The `enemyHp` debug scenario key, as fractions of the pool (rev-2 must-fix 1), and the presets | yes |
| D-C7-19 | A round-count bound keeps a margin of >= 2 rounds instead of 3 points (the lower median bound is the target itself); written into AGENTS.md "Test Patterns" | yes |

---

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| K1 | The engine differs from the sim copy | The rev-2 sim **is** the planned mechanism (2.1), with the arrival using `ctx.turn()` as planned (rev 1's emulation used turn 1; now moot); TS-BAL re-measures in F2 with the re-tune rules |
| K2 | The level cliff at pool 20000: 32.5 % win at 35; at 42+ F1 acts only once in most wins (30 % / 1 % all >= 2) and fights are 8-10 rounds | U-2 fixed at 40; the cliff is reported each run; when the encounter is placed, re-check (F1's defense or an opening action if the party is 42+) |
| K3 | The gated floor affects another boss | gating needs `interlude` or `form`; the only non-form interlude phase is F3's crack (`enemies.yaml:3372`); the rounding change applies to gated phases only; R28 unchanged |
| K4 | The arrival confuses the turn list or the presented state | `TurnList.add` at announce; 5.3 walks an arrival through announce and result |
| K5 | Line ceilings (`ColossusView` 248, `BattleFieldTargeting` 240, `BestiaryScene` 227) | budgets in section 6; helpers in the named smaller modules |
| K6 | H12 is wrong | RED first; a browser probe before any fix |
| K7 | M5 changes a revive or a heal | revive from 0 and heals give `max(hp, ...) = hp`; 5.1e covers damage above and below a floor |
| K8 | The pool change breaks hidden pins, or the pool changes again | TS-BAL lists every real-data 6000 pin once, before editing (2.5); synthetic tests stay; a new pool reopens 2.3 (2.5 "A new pool") |

---

## 12. TODOs

```markdown
## TODOs
- [ ] F0: orchestrator check of rev 3 against momus's rev-2 conditions (priority: high, effort: 0.25h)
- [ ] F1 TS-B: RED 5.1a-e, 5.2, 5.2b, 5.3; M1-M6; roundFormChange + BattleScene state path; C7-N1; canRun; enemyHp key + presets; arrivalTurn keys + validator (priority: high, effort: 5h)
- [ ] F1 TS-BAL: chaosBattle.ts + chaos.test.ts RED on 7c86057 reproducing 2.2 at level 40 within 2 points; runBattle `forms` option; list the real-data 6000 pins (priority: high, effort: 2h)
- [ ] F1 TS-V: RED 5.5-5.12; numbers, slam motion + text, status row + clamp + pins, target label, i1 + pin, fade region, spawn overlap, H12 (priority: medium, effort: 5h)
- [ ] F1 TS-BST: RED 5.4; sub-entries, title count, F4 page, deep links, seen gating, formTitles, phaseForm, rim (priority: high, effort: 3h)
- [ ] F2 INT: merge TS-B, TS-V, TS-BST in order; tsc/build/vitest green (priority: high, effort: 1h)
- [ ] F2 TS-BAL: B3-20k data + pool 20000 + level-40 party + pool pins (listed once); re-measure; pin the 2.5 bounds and invariants; GREEN (priority: high, effort: 2h)
- [ ] F3 INT: merge TS-BAL; section 7 gate; browser; docs (section 8) (priority: high, effort: 3h)
- [ ] F4 TST: fresh re-test (section 9) (priority: high, effort: 3h)
- [ ] F5 (if needed): second fix round; after 2 rounds with an open P0/P1, escalate to the user
```

---

## 13. Momus rev-1 items: where each is answered

| Momus # | Item | Answered in |
|---|---|---|
| 1 (must) | The reach rule respects the gated floor | 2.4 M3; 5.1a, 5.1c; verified in `chain.ts` |
| 2 (must) | One rounding rule; the pool-6001 case | 2.4 M2; 5.1d |
| 3 (must) | The arrival edge cases, call order, `prepareRound` flag, decided battle, RNG | 2.4 M6 table; M4; 5.1b; K1 |
| 4 (must) | Invariants vs bounds | 2.5 bounds table (kinds); criteria |
| 5 (must) | One HP-write semantics | 2.4 "HP-write semantics"; C7-N1 / M5; 5.1c, 5.1e; 9.3; section 8 |
| 6 (must) | The round-start interlude state path | 2.4 state path (6 lines); 5.3 |
| 7 | The icon clamp and its tests | C6-6 row; 4.3; 5.7 |
| 8 | Re-test thresholds | section 9 item 1 (10-16; F4 command phase not required) |
| 9 | The i1 pin | C6-9 row; 5.12 |
| 10 | Bestiary touch points | section 3 table (16 lines) |
| 11 | `BattleScene.ts` overlap | section 6 ownership; C6-12 fix inside `enemyAnimPreview.ts` |
| 12 | Slow interlude scenarios | C6-12b row (`enemyHp` presets); 7; 9.4 |
| 13 | The overlap scope and file ref | C6-11 row (`ActionNumbers.spawn`, one call); D-C7-16 |
| 14 | Re-tune escalation | 2.5 "Re-tune and escalation" |
| 15 | Harness API and naming | 2.6 |
| 16 | Cite R9 | D-C7-1 |
| 17 | F4 slam margin and how it is measured | C6-5 row; 4.2 (drop 40, F4 45) |
| 18 | Line refs | `BattleTrigger.ts:102`; `mapValidators.ts:95-102`; types 417 -> 419; 5.11 file name; the round-count margin defined in 2.5 |

### 13.1 Momus rev-2 items (OKAY on conditions)

| Momus # | Item | Answered in |
|---|---|---|
| 1 (must) | The `enemyHp` presets depend on the pool | C6-12b row: fractions of the pool, valid at 6000 and 20000; 5.2b; section 6 F1 note |
| 2 (must) | The unit-test numbers assume a pool | 5.1a-e: each fixture's pool named (`POOL = 6000`, 5.1d `POOL = 6001`), every expectation `Math.ceil(t * POOL)` |
| 3 | The 2-round margin | D-C7-19; 2.5 "Bounds"; section 8 AGENTS.md "Test Patterns" |
| 4 | Lost runs in the re-test | 9.1 replay rule (3 won runs, at most 5 attempts, >= 2 losses filed P2) |
| 5 | Art readiness on the round-start path | 5.3 (b) |
| 6 | The hit bound's origin | now a user number: U-3 (>= 500); rev 2's ">= 250" recorded as the plan's own reading (10.1) |
| 7 | Floors as a formula in AGENTS.md | section 8 |
| 8 | The party build differs between the sim and the harness | 2.6 party check (asserts 666 / 420 / 586 / 303 and 45 / 213 / 88 / 49) |
| Pool scaling | The values that break when the pool moves | 2.5 "A new pool" and "What stays valid at any pool"; the pins listed once in F2; the TS-BST 5-digit HP check; re-measured at 20000 (2.3.1) |

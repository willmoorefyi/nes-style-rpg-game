# Chaos forms plan (pass C), 2026-11-16 (rev 4 + momus B1-B8: user ruling "colossus forms are full-resolution painted art", section 18; rev 3 = momus R1-R30 + A1-A8, section 17; rulings in section 15)

**Precedence.** **Section 18 (rev 4) wins over every earlier section** for the colossus forms (F2, F3, F4): their
art, layers, geometry, textures, animation and tests. Then section 17 and the section 15 rulings win over the body
text. The rev-4 changes are also marked in place with "(rev 4: 18.x)".

**Request (user direction, binding, 2026-11-16).** Chaos moves through many forms during the final battle. Its
**final form takes the entire battlefield and looks planet-sized**: far more imposing than any other enemy, like
the Stability experiment renders in `/tmp/stab/compare.png`, which fill the frame. The core render there is kept as
`cosmic_beast_v1` for a different monster and is **not** used here. The current pass-V chaos sprite can be an
initial form: the robed overlord with a flame crown and four orbs (`assets-src/gen/approved/chaos/`, rig
`assets-src/gen/anim/monsters/chaos.yaml`). **No sprite-size, cell, layout-area (`TITAN_AREA` / `ENEMY_AREA`),
lunge-clearance or "fits the enemy field" limit may constrain Chaos's forms**: the runtime is designed around the
art. The arena backdrop is the SD 3.5 "edge of the universe" render being finalised in `/tmp/stab2/`. Image
generation moves to **Stability AI on AWS Bedrock** (us-west-2, `assets-src/gen/bedrock.py`): Core for sprites,
SD 3.5 for mood and backdrops. Text-to-image ignores key colours, so the `remove_bg` model is needed, and it strips
glows.

**User update (binding, 2026-11-16, relayed by the coordinator).**
- **The arena backdrop is accepted as is:** `/tmp/stab2/sd35_v3_raw.png` / `sd35_v3_bg.webp` (SD 3.5, seed 5151;
  source horizon 485, zoom 1.05, screen horizon 370; mock `sd35_v3_battle.png`). This plan only stages and commits it,
  with its own stage entry and `--check` limits. A minor clean-up of the fire spots is optional, not required. It
  costs 0 Bedrock calls.
- **The biggest issue is that Chaos is not yet the world-spanning entity.** The final form is **the centrepiece of
  this plan**: a planet-sized being that dominates the whole battlefield, extends past the screen edges and looms
  behind and over the arena, so the party faces a fraction of something vast. It has no size limits.
- Its design (3.0), rendering (4) and art generation (5) take priority over every secondary item: F2, the bestiary
  and the interlude polish. Where time or budget runs short, secondary items are cut first (D-O13).

**This document is the plan only.** It generates, edits and builds nothing. Every number marked *measured* was read
at `6935e03` (`roster-int`) by reading code and files, without running the game:
- the atlas `assets/sprites/monsters-ai.json`
- `assets/data/enemies.yaml` and `spells.yaml`
- `src/`
- `/tmp/stab/stats.json` and `/tmp/stab2/stats.json`

A number marked *estimate* is a planning value that a named step re-measures. Designs are original. Section 3.5 lists
the existing characters each form must not resemble.

**Terms.**
- **Form**: one enemy record in `enemies.yaml` that Chaos can be during the battle. The forms are F1 `chaos`,
  F2 `chaos_orrery`, F3 `chaos_horizon` and F4 `chaos_horizon_core`; F4 is a data form that reuses F3's art.
- **Pool**: the single HP pool all forms share (mechanism M1, section 2.1).
- **Atlas form**: a form drawn through the monster atlas and `AiEnemyView` (F1 today).
- **Colossus form**: a form drawn by the new `ColossusView` from dedicated layered textures, outside the atlas and
  outside `computeEnemyLayoutAi` (F2, F3, F4).
- **Field**: the visible battlefield, screen x 0-1920, y 120-780. Above it is the message window, (0, 0, 1920, 120)
  in `hud`. Below it is the bottom strip, `STRIP_Y` 780, 300 tall, in `ui` (`BattleSceneTypes.ts`).
- **Screen px**: the 1920x1080 game space. **Art px**: the native pixels of the approved image.
- **Pass C**: this pass. **C-base**: the `roster-int` commit that carries the C1 framework merge (section 10). It is
  the baseline for every "unchanged" check.
- **BR ledger**: the new Bedrock ledger `assets-src/gen/cache/bedrock_ledger.jsonl` (section 6).

**Contents:**
- [0 Success criteria](#0-success-criteria-defined-before-implementation)
- [1 What the code does today](#1-what-the-code-does-today-measured)
- [2 Form mechanics](#2-form-mechanics)
- [3 The forms](#3-the-forms)
- [4 Battlefield-scale runtime](#4-battlefield-scale-runtime-colossusview)
- [5 Art generation](#5-art-generation-stability-on-bedrock)
- [6 Budget](#6-image-budget-and-aws-cost)
- [7 Arena backdrop](#7-arena-backdrop-rim)
- [8 Bestiary](#8-bestiary)
- [9 Tests](#9-tests-red-first)
- [10 Tranches](#10-tranches-ownership-watchdog)
- [11 Validation](#11-validation-commands)
- [12 Play test](#12-adversarial-play-test-and-fix-round)
- [13 Docs](#13-documentation-updates)
- [14 Risks](#14-risks)
- [15 Decisions](#15-decisions)
- [16 TODOs](#16-todos)
- [17 Momus revisions](#17-momus-revisions-rev-2)
- [18 Rev 4: painted colossus art](#18-rev-4-full-resolution-painted-colossus-art-user-ruling-binding)

---

## 0. Success criteria (defined before implementation)

```json
{
  "functional": [
    "One Chaos battle passes through every form in order (F1 -> F2 -> F3 -> F4), each change triggered by a form-bearing bossPhases entry at its HP threshold; a lethal or overkill hit can never skip a form (HP floor, 2.2)",
    "Each form has its own sprite or colossus art, stats (except the shared pool HP), elemental profile, spells, AI and attack style; after a change the next enemy action comes from the new form's AI",
    "Each form change plays a data-driven transformation interlude (battle-interludes.yaml) with messages, flashes, shake, dissolve of the old form and rise of the new one, in <= 8 s of unskipped time (<= 10 s for chaos_i2, the F3 reveal, D-O15); its lines can be advanced with confirm",
    "F3/F4 (the centrepiece, rev 4: 18.4) span the world: the canvas is >= 1.4x the screen width (planned 2700x1080 screen px at display scale 1), extends past the left, right and top screen edges, and at rest and in every idle / attack / cast / hurt / pan frame (rise and dying exempt) its body spans every screen column x 0..1919 (>= 1 pixel with alpha >= 0.5 in y 120..780) and no canvas border with alpha > 0 is visible (column-span and border tests); its visible fraction (canvas intersection with (0, 0, 1920, 780) over the canvas area) is <= 55 % (planned 51.4 %); the great halo ring and the rays stay visible (>= 50 % of the ring arc inside the field and not under the body); the party, the bottom strip windows and the message window all draw over it",
    "Colossus art is full-resolution painted art (rev 4, 18.1): full colour and soft alpha, no pixelization, quantization, palette lock or binary alpha; textures linear-filtered; the body keeps the user-picked render's detail and colour (fidelity test 18.7: PSNR >= 30 dB and mean CIE76 delta E <= 3 against the original inside the body mask) and the glow layer (halo ring, rays, corona) is drawn with additive blend",
    "The rise of F3 includes a reveal pan (2.3 `pan`): the camera travels over the canvas in whole px so the player sees more of the being than one screen holds before it settles",
    "Colossus forms never lunge: their attack, cast, hurt and dying move the art within +-12 px horizontally (shake included; sub-pixel motion allowed for the painted art, rev 4); the pan moves it only within the json-derived limits (18.4)",
    "Phase and buff rules across form changes hold (R4-R7): crossedPhases reset per form, phaseBuffs subtracted on change while spell buffs (e.g. fast) persist, a queued Chaos command is re-chosen by the new form's AI, and a scenario enemyAi override is dropped at the first change",
    "Damage numbers, the target cursor, status icons, spell fx and the hero melee approach point anchor on named colossus anchors inside the field (y 140..760, x 0..1900), never on the box top/centre",
    "The arena backdrop 'rim' (the user-accepted /tmp/stab2 sd35 v3 render, staged with its own stage entry and `--check rim` limits, 0 Bedrock calls) is used by every Chaos form; colossus forms rise from behind its horizon (the floor-front layer covers their base)",
    "The bestiary shows Chaos with one sub-entry per art form (F1, F2, F3; F4 is a page of F3), each preview whole and centred (rev 4: superseded by 18.8 for colossus forms: a pre-composited still at scale 1), unlocked when that form has been seen",
    "No replaced chaos art is lost: anything replaced (none planned; F1 is kept) is archived with retire.py first and indexed in docs/RETIRED_SPRITES.md; cosmic_beast_v1 is untouched"
  ],
  "observable": [
    "docs/ROSTER_LOG.md 'Pass C' table: one row per Bedrock call (model, seed, purpose, verdict) and 'Bedrock calls: U of 80' equal to the BR ledger count; Gemini calls 0 (D-U6: no Gemini fallback); the read-only AWS identity and list-foundation-models outputs recorded (R30)",
    "gen/out/colossus/review/<form>_* outputs (stage mock, layer split, timeline strips, GIFs, and for F3 a side-by-side sheet of the user-picked original vs the final composite, 18.7) and a recorded image-only verdict (SHIP or SHIP WITH NITS) per colossus form, plus one for the staged backdrop",
    "Browser screenshots of /?mute=1&scenario=chaos_forms at every interlude and form, and of /?mute=1&scenario=chaos_final&enemyAnim=loop, with a fresh reviewer's yes to the 4 questions in 11.3",
    "docs/ROSTER_PLAYTEST.md 'Pass C test' rows, and a fix round if any P0/P1/P2 is open"
  ],
  "pass_fail": [
    "BR ledger: pass-C calls <= 80 (D-U5) and each purpose <= its 5.6 cap, checked by `colossus.py budget --check` (exit 0); every logical request logged inside bedrock.invoke before its first try, paid=True required, refused over cap and from any linked worktree (selftest_colossus.py)",
    "Main-checkout Gemini ledger: gem[N_C0:] == 0 (no Gemini fallback, D-U6)",
    "Regression gate (R28), green unchanged at C-base and after C4: BossPhase.test, BossBattle.test, tierHTravel, lungeClearance, fxBigBoxes, floatingNumberPlacement, enemyTravel, bestiaryCentre",
    "Colossus textures use scaleMode 'linear' (rev 4; atlas monsters stay nearest), every texture <= 2048 px a side, total colossus texture memory <= 24 MB (18.6), and all are destroyed on battle end and bestiary exit (texture count before == after, scene test)",
    "The Python build writes exactly the colossus.json shape the TS reader accepts (18.5): a committed fixture built by colossus_build.py passes colossusIndex.ts formProblems with zero problems (contract test on both sides)",
    "npx tsc --noEmit && npm run build && npx vitest run: exit 0",
    "python3 -I assets-src/gen/selftest.py (main checkout), selftest.py --anim and selftest_colossus.py (worktree): ALL PASSED",
    "check --all: the same lines as at C-base (F1's chaos rig and lock untouched; colossus art is not an atlas sheet)",
    "Monster atlas pages byte-identical to C-base (the colossus forms add no atlas sheet); party atlases byte-identical; colossus build identical under PYTHONHASHSEED 0 and 1",
    "Every colossus texture <= 2048x2048; total colossus texture memory <= 24 MB (RGBA, measured by the build, 18.6)",
    "Line ceilings hold: BattleStateMachine.ts <= 592, BattleAnimationController.ts <= 308, SpellExecutor.ts <= 314, BattleScene.ts <= 594, and the 250 limit for BattleDisplayManager.ts (248), BestiaryPreview.ts (247), AiEnemyView.ts (240), BattleFieldTargeting.ts (235), tools/stage_backgrounds.py (249); new files <= 250 (R16)",
    "tests/balance/chaosForms.test.ts: the bounds pinned at C7 hold (each >= 3 points from its measured value)",
    "After the fix round: no open P0/P1 in docs/ROSTER_PLAYTEST.md 'Pass C test'"
  ]
}
```

---

## 1. What the code does today (measured)

These facts are why the forms need new mechanics. Each fact names the plan item that relies on it.

**Boss phases** (`src/types/index.ts:65-75`, `src/battle/ActionResolution.ts:51-89`, `BattleStateMachine.ts:265-268`).
- What a phase is:
  - `BossPhase` has the fields `hpThreshold` (0, 1], `patternId` (required), `message?`, `hits?`, `attack?` and
    `attackAnim?: 'heavy'`.
  - `validateBossPhases` (`src/core/mapValidators.ts:82-100`) ignores unknown keys.
- When a phase is checked:
  - Only in `prepareRound()`, at round start, and only for living enemies.
  - So **a blow that takes HP from above the threshold straight to 0 skips the phase** (plan 2.2: the HP floor).
- What a phase changes:
  - Only hits and attack, kept as buffs. The shared data never changes.
  - The pattern swap never fires in game: `BattleScene` passes no `bossPatterns`, and `dataDrivenAI(ai, spells)`
    (`enemyAiPattern.ts:27`) has no `setPattern`.
  - The phase field `attackAnim` is validated but never read (`AiEnemyView.ts:103,125` read
    `EnemyData.attackAnim`). The validators allow only `'heavy'` (`types/index.ts:111`, `mapValidators.ts:95`).
- Sprite, max HP, elements and spells cannot change mid-battle:
  - `AiEnemyView` takes a snapshot of `e.data` (`BattleDisplayManager.ts:89`).
  - Elements are read from `enemy.data` per spell (`SpellExecutor.ts:198-200`).
  - AI changes only through `setEnemyAI(index, ai)` (`BattleStateMachine.ts:532`).
- How the phase message is shown:
  - It goes to `this.messages`, and `BattleScene.executeRound` shows it before the first announcement
    (`BattleScene.ts:400-404`).
  - There is **no mid-battle cutscene or interlude hook**.
- Enemy HP is written in **5 places**:
  - `SpellExecutor.ts:202` (spell damage), `:279` (`executeReviveSpell`, HP set to 1)
  - `BattleStateMachine.ts:428` (status tick `setHp`), `:486` (physical damage in `executePartyAttack`, `:475-490`)
  - heal `SpellExecutor.ts:154`, which clamps to `data.stats.hp`

  An enemy at 0 HP is dead, and victory is declared in `resolveRound` (`:553`).
- **Chaos data** (`enemies.yaml:3241-3277`):
  - hp 2000, `size: boss`, `attackAnim: heavy`
  - one phase: 0.5, `aggressive`, "Chaos draws on all four Fiends!"
  - `ai: {rate 0.5, actions: [ice2, fast]}`
  - `spells` lists 8 ids, but **6 do not exist in `spells.yaml`** (ice3, lit3, slo2, cur4, fir3, nuke; 34 spells
    exist, *measured*). The plan needs a decision on these (D-O9).
  - Chaos is on no map. The only scripted encounter is Garland (`temple-of-fiends.yaml:2453`). It is reached only
    through the debug scenario `anim_pass_v_chaos`.
- **Line headroom** (*measured* / ceiling):

  | File | Lines | Ceiling |
  |---|---|---|
  | `BattleStateMachine.ts` | 585 | 592 |
  | `BattleAnimationController.ts` | 300 | 308 |
  | `SpellExecutor.ts` | 308 | 314 |
  | `BattleScene.ts` | 515 | 594 |

  | File | Lines | Limit (250) |
  |---|---|---|
  | `BattleDisplayManager.ts` | 248 | 250 |
  | `BestiaryPreview.ts` | 247 | 250 |
  | `AiEnemyView.ts` | 240 | 250 |
  | `BattleFieldTargeting.ts` | 235 | 250 |
  | `assets-src/tools/stage_backgrounds.py` | 249 | 250 |

  AGENTS.md says 473 for `BattleScene.ts`; it is now 515. New logic goes into new modules. The tight files get
  line-neutral hooks or an extraction first; the hook budget is set per file in 2.2 item 8 and 4.5 (R16).

**Rendering** (`src/scenes/battle/`, `src/rendering/`).
- **Draw order** (`BattleLayers.ts:46`): `bg` < `ui` (enemy list, command window, party panel) < `actors` (enemies,
  then party) < `fx` (status < spell < flash < numbers) < `hud` (the message window).
  - **The windows sit under `actors`**, so a screen-filling sprite in `actors` would cover the bottom strip.
  - The screen shake moves only `actors` and `fx`.
  - The backdrop sprite is added to `bg` asynchronously, so anything added to `bg` early ends up under it.
  - This is why plan 4.1 adds a new `colossus` layer between `bg` and `ui`.
- **Layout** (`EnemyLayoutAi.ts`):
  - `ENEMY_AREA` x 80-1340, y 200-745. `TITAN_AREA` x 80-1340, y 140-745. `STAGE_FEET` 360-745.
  - `layoutSizeOf` lays out a scale-3 boss as `titan`.
  - A 1920x1080 box falls to pass 4 and `formationFits` refuses it. **A colossus form bypasses
    `computeEnemyLayoutAi` entirely** (4.2).
  - Chaos F1 today: a 600x600 box, feet y 743, cell top 143, idle figure 187 art px = 561 screen px (*measured*,
    REDESIGN_PLAN 17).
- **Anchors that derive from the box:**
  - Damage numbers start at `sprite.y`, the cell top (`floatingNumbers.ts:40-50`).
  - The target arrow is at `(x+40, y-20)` with an outline of `w+6, h+6` (`BattleFieldTargeting.ts:142-155, 206`).
  - Status icons go 8 px above the topmost opaque row (`fx/statusFx.ts:176-189`).
  - Spell fx use `bodyBox` = 15 %/33 %/70 %/62 % of the bounds (`fx/emitterCore.ts:59-73`), clamped to y >= 124.
  - The slash is `0.45*min(w,h)` (`slashEffect.ts`).
  - Hero melee reach is clamped to 150..900 (`attackChoreography.ts:15-18`).

  On a full-screen box all of these end up under the message window or off-screen. This is why plan 4.4 adds
  anchor overrides.
- **Party and screen:** `PARTY_FEET_Y [425, 530, 635, 740]`, `PARTY_X [1380, 1425, 1470, 1515]`, 160 px cells
  (`BattleDisplayManager.ts:22-23`). The screen is 1920x1080 (`LayoutConstants.ts`).
- **Effect utilities:**
  - `ScreenShake`: 8 frames, 6 px.
  - `ScreenTint`: full screen, in `fx.flash` (`fx/fxRender.ts:66-80`).
  - `FadeOverlay`, `actorTint`, `BattleEffects.elementFlash` (a silhouette copy).
- **Pages:** at most 2048 px per side (build convention, `anim_rules.py:12`), `PAGE_CACHE` 2, and
  `BattleTrigger.ts:91` awaits `art.ensure` before the battle.

**Art pipeline** (`assets-src/gen/`).
- `generate.py:312` refuses Bedrock for monster sheets ("monster sheets are Gemini-only"), and `approve.py:155`
  re-plans every request with `gemini`. **Colossus art therefore gets its own tool, `gen/colossus.py`**, with its own
  ledger and guard (5, 6). F1 stays on the existing path.
- `bedrock.py` has these models: `core`, `sd35`, `ultra`, `structure`, `style_guide`, `remove_bg` and
  `search_replace`.
  - It keeps a content-addressed cache.
  - **It has no ledger, cap or `--paid` gate, and records no cost.**
  - The Gemini guard skips Bedrock entries (`generate.py:426`).
- `pixelize.py` is a library with no command-line interface: `pixelize(...)` and `pixelize_native(...)`, with a
  15-bit snap, block vote and a 1 px outline.
- `retire.py` archives `<id>` as `_vN`. `chaos_v1` already exists, so a chaos redesign would be `--as chaos_v2`.
- **Stability experiment 1** (`/tmp/stab/stats.json`):

  | Model | Subject size after removal | Partial-alpha share |
  |---|---|---|
  | Core | 1931x868 of 2304x960 | 0.321 |
  | SD 3.5 | 655x548 of 1536x640 | 0.302 |
  | Ultra | 361x415 | 0.118 |

  - Ultra drew a small subject.
  - `pix.py` keeps alpha >= 128, so the glow is lost.
  - Core at scale 3 gives 420x189 art px = 1260x567 screen px.
- **Stability experiment 2** (`/tmp/stab2`): sd35 v3, 1344x768, staged at a 1.05 zoom with the horizon at y 370.
  - Every candidate fails `stage_backgrounds.py --check shoreline`, which is a water-oriented profile (sd35 v3 seam
    27.6 vs <= 14).
  - sd35 v3 has the best boss contrast: `edge_delta` 149 (core 39, the HD reference 32).
  - The staged image covers screen y -358..794 only (*measured*, `stats.json` `stage.bottom`).

**Bestiary** (`src/scenes/bestiary/`): one sprite per entry (`sprite || id`), built through `AiEnemyView`, and
centred by `fitShift` on `idleBox`. Entries are unlocked by the `SEEN:<id>` flag at battle start
(`BattleTrigger.ts:80`). There is no multi-form support.

---

## 2. Form mechanics

### 2.1 Mechanism: options and recommendation (D-U2)

| Option | How | Pros | Cons |
|---|---|---|---|
| **M1 (ruled, D-U2): one HP pool, form-bearing `bossPhases`** | A phase gains `form: <enemyId>`. When the pool crosses its `hpThreshold`, the instance's `data` is re-pointed to that form's record. Every form record has the same `stats.hp` (the pool) and `formOf: chaos`. | Follows the user's "HP thresholds via bossPhases". One battle, one bar. The shared data is never mutated: the instance points to another shared record. Existing phases keep working. | Needs the HP floor (2.2) so overkill cannot skip a form. |
| M2: `nextForm` on death, full HP per form | At 0 HP the enemy becomes `nextForm` at full HP. | Classic "it rises again" feel. | Not threshold-driven. A death is not a death (victory and kill-count rules change). Each form needs its own pool tuning. |

**Ruled M1 (D-U2, user).** Pool 6000, and the thresholds are pool fractions: F2 at 0.70, F3 at 0.40, F4 at 0.15
(D-U3, user). F3+F4 together are the longest stretch, 40 % of the pool. The floors are `ceil(threshold * 6000)`,
i.e. 4200, 2400 and 900.

### 2.2 Rules (TS owner, battle logic; RED first, 9.1)

1. **Data.**
   - `BossPhase.form?: string` (an enemy id) and `BossPhase.interlude?: string` (an id in
     `battle-interludes.yaml`).
   - `EnemyData.formOf?: string`, the id of the battle's first form, used by the bestiary and validation.
   - `validateBossPhases` accepts the two keys.
   - The cross-file validation refuses each of these:
     - an unknown `form` or `interlude`
     - a form record whose `stats.hp` differs from its root's
     - a cycle
     - thresholds that are not strictly descending along the chain
     - a form record used in an encounter on its own
   - The 3 form records (`chaos_orrery`, `chaos_horizon`, `chaos_horizon_core`; F1 is the root) carry
     `formOf: chaos` and **no `num`**. From C1 they are filtered out of the top-level bestiary list, and
     the tests that walk every enemy exempt them through an explicit `formOf` filter (R11, 9.1 "pins updated").
   - The inherited and explicit fields per form record are listed in 3.6 (R10).
2. **HP floor.** All 5 enemy HP writes (section 1) go through one new helper, `src/battle/enemyHp.ts`
   `setEnemyHp(enemy, hp)`.
   - While the enemy has an uncrossed form phase, HP is clamped to at least `ceil(threshold * pool)`.
   - A form phase is **reached** when `hp <= ceil(threshold * pool)`: at exactly 4200 HP of 6000, F2 triggers (R5).
     Reaching it marks the phase pending.
   - Revive (`executeReviveSpell`, `:279`) and the status tick (`:428`) go through the same helper.
   - A heal never re-arms a crossed phase (the existing `BossBattle.test.ts:88` rule).
   - A static test allows no other `currentHp =` write on enemies in `src/battle`.
3. **Immediate change.** The form changes right after the action that reached the floor, not at the next round start.
   - **Hook point (R8):** in `executeNextAction`, after `runTurn` and before the `done` check
     (`BattleStateMachine.ts:347-354`). This covers hero actions, Chaos's own actions and the poison tick, and it is
     the path that `executeRound` uses too.
   - **`prepareRound` calls `bossForms.resolvePending` first (R5),** before `checkBossPhases`, as a safety net.
   - **`checkBossPhases` skips phases that have a `form` (R5),** so a form phase is never applied as a plain phase.
   - `src/battle/bossForms.ts` `applyFormChange(enemy, phase)` does all of the following:
     - re-points `enemy.data` to the form record
     - keeps `currentHp`
     - sets **`crossedPhases = new Set()` (R4)**, so the new form's own non-form phases (F3's 0.25 line) can fire
     - **subtracts the old form's phase deltas (R6, ruling):** phase deltas are tracked in a new
       `enemy.phaseBuffs`, separate from spell buffs, and subtracted on the change. Spell buffs such as `fast`
       **persist**.
     - keeps the statuses listed in `form.keepStatus` (default: none; D-O5)
     - rebuilds the AI with `setEnemyAI(index, dataDrivenAI(newData.ai, spells))`
     - **re-chooses a still-queued Chaos command (R7):** the command is replaced in place by
       `newAi.selectAction(...)`, so the turn order is kept. A null AI falls back to the default Fight.
     - **drops a scenario `enemyAi` override at the first form change (R7, ruling):** documented in
       `debug-scenarios.yaml` and AGENTS.md
     - returns a `FormChangeResult {enemyIndex, from, to, interlude, message}`, defined in `bossForms.ts`. It rides
       on `ActionResult.formChange?` (1 field).
   - Remaining queued hero actions in the round still target enemy index 0.
   - **One change per action.** Two thresholds reached by one hit stop at the next floor: F1 at 4300 HP and a 9999
     hit leave 4200 HP and change to F2. F3 needs a later hit that reaches 2400 (R4 test).
4. **Non-form phases** (message, hits, attack) still fire at round start, as today, and also work on form records
   (e.g. F3's 0.25 line, `hits: 4`, which goes into `phaseBuffs` and does not leak to F4, R6). `BossPhase.test.ts` and
   `BossBattle.test.ts` pass **unchanged** (R28).
5. **Victory.** Only the last form at 0 HP is a kill. `resolveRound` is unchanged: no uncrossed form phase remains,
   so HP can reach 0.
6. **Retry and game over.** `battleRetry` restarts the battle from F1 (D-U8, user).
7. **`SEEN:<formId>` (R20).**
   - `formChangeView` emits the EventBus event **`battle:formChange`** `{from, to}` at the interlude's `swap` step.
   - `BattleTrigger` subscribes for the battle's lifetime and sets `SEEN:<to>`.
   - Test: `tests/systems/battleTriggerForms.test.ts` emits the event and expects the flag, then expects the
     subscription removed at battle end.
8. **Line budget (R8, R16).**

   | File | Headroom | Change |
   |---|---|---|
   | `BattleStateMachine.ts` | 7 | hook in `executeNextAction`, at most 5 lines, plus the `prepareRound` call, 1 line. The 2 HP writes become `setEnemyHp` (line-neutral). `ActionResult.formChange?` lives in `src/battle/` types: 1 line. Total at most 7. |
   | `SpellExecutor.ts` | 6 | 2 writes become `setEnemyHp` (line-neutral) |

   - **Required first step of C1 TS-B (A3 ruling):** extract `executePartyAttack` (`:475-490`) into
     `src/battle/physicalHit.ts`, behaviour-neutral (the full battle suite stays green), **before** any hook is added.
     This frees headroom for the form hook and the slam dispatch.
9. **F3's one scoped new mechanic: the slam (R9, ruling).**
   - `EnemyData.slam?: {targets: 2}`: a multi-target physical attack. It is chosen as an AI action
     `{type: 'slam', weight}`, it hits 2 different living heroes, and each hit is rolled with the normal physical
     formula.
   - Data: the type, the validator (`targets` is 2 and only allowed on records with `colossus:`), and a cross-file
     test.
   - **Touch points (A4 ruling):**

     | Where | Change |
     |---|---|
     | `enemyRosterValidation.ts:43` | allow the action type `'slam'` |
     | `enemyAiPattern.ts:18` | the slam weight comes from the non-spell share `1 - rate`, alongside Fight |
     | the `EnemyAiAction` union (`enemyRoster.ts:19`) | add `'slam'` |
     | `BattleCommand` | a slam command (enemy only) |
     | `peekNextAction` | returns `actionType: 'slam'`, so the view picks the slam timeline |
     | events | **two damage events, one per target**, in target order |
     | the pin `tests/data/crossFileValidation.test.ts:452` | updated to allow `'slam'` (not deleted) |

   - Tests: `tests/battle/colossusSlam.test.ts`:
     - 2 distinct targets, with 2 damage events
     - 1 target and 1 event if only 1 hero lives
     - a miss rolls per target
     - the events in order
     - `peekNextAction` reports `'slam'`
     - the weight comes from `1 - rate`
   - Line budget: in `src/battle/slamAttack.ts` (new), dispatched from `physicalHit.ts` (A3).
   - No other new mechanic. F2 and F4 use only the existing knobs: `ai.rate`, spell weights, `hits`, `attack` and
     `elementalProfile`.

### 2.3 Transformation interludes (TS owner, view)

- **Data:** a new `assets/data/battle-interludes.yaml`, loaded by DataLoader with `InterludeRegistry` (the
  `CutsceneRegistry` pattern: drop the script with `console.error` on an unknown step or a bad value). Steps:

  | Step | Fields | Effect |
  |---|---|---|
  | `message` | `text` | a line in the battle message window (skippable on the message timer, `battleTiming.ts`) |
  | `wait` | `frames` | hold |
  | `flash` | `color`, `frames`, `alpha` (0, 1] | `ScreenTint` in `fx.flash` |
  | `shake` | `times` | `ScreenShake.start()` repeated, also on the `colossus` layer (4.1) |
  | `tint` | `color`, `alpha`, `frames` | backdrop multiply tint (in and out) |
  | `fade` | `alpha`, `frames` | `FadeOverlay` to an alpha (0 = clear) |
  | `dissolve` | `frames`, `style: flicker / fade / sink` | the outgoing form's view leaves |
  | `swap` | (none) | the incoming form's view is built (hidden, or at its rise start) |
  | `rise` | `frames`, `from_dy` (art px) | the incoming colossus slides up from behind the horizon in whole art px |
  | `pose` | `name` | the colossus plays `cast` / `attack` / `hurt` / `roar` once (R19) |
  | `variant` | `layer`, `frame` | swaps one colossus layer to a named frame, e.g. `{layer: core, frame: open}` for F4 (R19); no view rebuild |
  | `pan` | `from: [dx, dy]` (art px offset of the canvas from its rest `place`), `frames`, `ease: linear / out` | the reveal pan: the colossus canvas (and its overhang) slides in whole art px from a far offset to rest. `floorFront`, `bg` and the party stay still, so the being is felt to be larger than the screen. Only colossus forms |
  | `music` | `id` | optional track change (`audio-manifest.json` id) |

- *(rev 4: the F3 numbers in the next two bullets are superseded by 18.4: canvas 2700x1080 at place (-527, -210),
  scale 1, pan from (+480, +120) screen px.)*
- **Pan limits (R13).** The allowed offset is derived from `colossus.json` so the canvas still covers the field. For
  the planned F3 (canvas at (-390, -300), 2700x1560 screen px at scale 3), the limits in art px are
  dx in [-128, +128] and dy in [-160, +138].
  - The validator reads the json and refuses an offset outside the limits.
  - **The pan start (A2 ruling):** `from: [0, -60]`. A pan start must have dy in [-70, 0] art px and dx <= 0
    (validator), inside the coverage limits above. The canvas starts raised by 60 art px, with the hand still on
    screen. A test checks that at the first pan frame the hand's box is inside the field (y >= 120). Then the canvas
    settles to rest.
  - At the last pan frame the overhang hand lies exactly on the rim. A test checks the hand's alignment with
    `floorFront` at that frame.
- **Timing and concurrency (R18).**
  - **Unskipped time** is the sum of every step's frames, where a `message` step counts at the `battleTiming.ts`
    message timer value and is not skipped. **A1 ruling:** the validator is pinned to message speed 3,
    `BATTLE_MESSAGE_FRAMES` = 90 frames per message step. A `shake` counts `SHAKE_FRAMES` (8) per shake.
  - Steps are **sequential**. A step with `with: previous` starts on the same frame as the step before it (e.g. a
    `shake` during a `rise`); the total is the longest branch.
  - Each script has one total, within the cap (480 frames; 600 for `chaos_i2`, D-O15).
  - Input: only confirm, and only on `message` steps, where it advances the line. Every other input is ignored.

- **Player:** `src/scenes/battle/formInterlude.ts` is a pure timeline: steps become a frame-indexed list of events,
  so it is testable without PixiJS. `FormInterludePlayer` drives it.
- **When it plays:** `BattleAnimationController` sees `formChange` after presenting the action that caused it and
  waits for the player to end. This hook is at most 6 lines, or it goes in the new
  `src/scenes/battle/formChangeView.ts`.
- **Limits:**
  - At most 480 frames (600 for `chaos_i2`) of unskipped time per interlude (validator, R18 definition).
  - A confirm hold-off of 24 frames applies when the interlude ends.
  - A form change whose art id changes has exactly one `swap`. F3 -> F4 shares the art, so it has **zero** `swap`
    steps and uses `variant` (R19).
- **The three interludes** are written out in section 3.

### 2.4 AI per form

- Each form record has its own data `ai` (`rate`, `actions`), and the form change rebuilds it (2.2 item 3).
- New AI keys are out of scope, except F3's `slam` action (2.2 item 9, R9 ruling).
- A scenario `enemyAi` override applies to F1 only and is dropped at the first form change (R7 ruling).
- **The beam (R9).** It is a named existing single-target black damage spell. TS-B picks the strongest one in
  `spells.yaml` at C1 and records its id here and in ROSTER_LOG. **Picked at C1: `ice`** (power 20; `fire` and `lit`
  are 10).
  - The view plays the beam timeline for any single-target black damage spell cast by a colossus form.
  - The colossus timelines are keyed by the presence of `colossus:` on the record, never by `attackAnim`: the
    validators allow only `'heavy'` there.
- The broken `bossPatterns` wiring (section 1) is **not** fixed in this pass (D-O10). Form records replace the need
  for pattern swaps.

---

## 3. The forms

### 3.0 The centrepiece: the final form, "Chaos, the Last Horizon" (F3 / F4)

**Priority rule.** F3 is designed, generated, rendered and reviewed first (tranche C3 starts with it), and it gets
the largest share of the Bedrock budget (5.6). Nothing else in this plan may cut F3's scale.

**What the player must feel.** The party stands on a sliver of crystal floor at the edge of the universe. In front of
them, rising over the horizon, is something so large that the screen shows only its chest, one shoulder and the hand
it rests on the rim.
- Its head, an eclipse with a sky-filling corona, is cut off by the top of the screen.
- Its other shoulder and arm run off the left edge.
- Its body continues below the horizon into the void.
- The four orbs, which were small beside F1's head, are now moons drifting past its chest, each the size of the whole
  party.

**Design (original; must differ from the 3.5 list).**

| Element | Description | Why it reads as planet-sized |
|---|---|---|
| Shoulders | two shoulders that are **mountain ranges** of black stone with gold seams, their ridgelines curving down like a planet's limb at the canvas edges | the curvature reads as planetary; ridges read as terrain, not armour |
| Crust | black stone with **ember fissures** (lava-like glowing lines) and gold veins in long tectonic plates; thin **nebula cloud bands** cling to the shoulders and drift across the chest | clouds in front of a body = atmosphere = a world |
| Head | **a black sun**: a perfect eclipse disc, the F1 flame crown grown into a **corona** of ember, gold and white streamers that fills the sky above the horizon; two pin-points of white light deep in the disc (F1's eyes, now distant stars) | continuity with F1; no face on a sphere (3.5) |
| Core | a vast **vertical fissure** down the chest, white-hot at the centre, gold at the edges | the target anchor; F4 tears it open |
| Arms | **continental arms**: forearms of layered rock plates, hands of black-gold stone with five claw-ridges. The right hand **grips the arena's far rim**, its fingertips resting on the horizon left of the party; the left arm runs off the left screen edge | the hand on the rim gives the 1:1000 scale cue against the party |
| Moons | the four orbs (frost cyan, ember orange, abyss teal, storm white) as moons with soft halos, orbiting slowly in front of the chest | each moon is the size of the party |
| Palette | void black, gold, ember, white plus the four orb colours (the F1 base palette, 5.3); the nebula haze in the rim backdrop's rose and violet so it sits in the arena's light | one being, one arena |

**Composition on screen at rest.** *(rev 4: superseded by 18.4. The user-picked render has arms outstretched to both
canvas edges and no hand gripping the rim, and the canvas is 2700x1080 at scale 1. The sketch below is the rev-3
intent, kept for history.)*

```
 screen x: 0                          960                         1920
 y 0     +----------------------- message window (hud) -----------------------+
 y 120   |  corona streamers ......  [ eclipse disc, top cut off ] ...... corona |
         |  left shoulder range                 \            right shoulder    |
         |  (runs off left edge)  cloud band     |  core     (runs off right)   |
 y 370   |~~~~~~~~~~~~~~~~~~ horizon ~~~~~~~~~~~~| fissure ~~~~~~~~~~~~~~~~~~~~~|
         |  left forearm on the far floor  moon   right HAND grips rim   PARTY  |
         |  (floorFront covers its base)         (overhang layer)        x1380+ |
 y 780   +----------------------- bottom strip (ui) --------------------------+
```

The canvas extends about 390 screen px past the left edge, 390 past the right and 300 above the top, and its lower
part continues behind `floorFront` and the strip.
- **Visible fraction (R12):** the canvas's intersection with the rect (0, 0, 1920, 780), over the canvas area. For the
  planned canvas, (1920 x 780) / (2700 x 1560) = **35.6 %** (criterion <= 45 %).
- **Size bound:** 1.4x the screen is >= 2688x1512 screen px; the planned 2700x1560 passes. *(rev 4: the height bound
  is replaced by the column-span and border rules of 18.4; width >= 2688 stays.)*

**Scale effects (runtime, 4.3), in priority order:**
1. **Reveal pan** in the F2 -> F3 interlude. The canvas rises from below the horizon (`rise`), then the camera pans
   over it (`pan` from (0, -60) art px to rest over 120 frames, within the R13 limits and the A2 start rule). The pan
   starts with the canvas raised and the hand gripping the rim still on screen; then the view
   travels up the arm to the core and the eclipse as the canvas settles, and the hand lands exactly on the rim at
   rest.
2. **Slow world-breath:** the whole canvas drifts by 1 art px (3 screen px) over a 6 s loop, out of step with the
   corona's 4-step pulse.
3. **Parallax:** the moons move in front at their own speed, and the cloud bands drift 1 art px every 20 frames
   across the shoulders on their own layer.
4. **Overhang:** the gripping hand is drawn in front of `floorFront`'s far rows. It is still under the party, the
   windows and the fx.
5. **Every hit shakes the world:** the slam shakes `colossus` and `actors`, and the backdrop sky does not move, so
   the being reads as near and the stars as far.

**Mechanics:** see 3.3 (F3) and 3.4 (F4).

---

All forms are "Chaos" in the enemy list (D-O12), and the form title appears in the interlude lines. Concepts and
names are as proposed (D-U4, user). The stats are **planning values** (*estimate*), tuned by the balance test (9.1,
C7). Spells use only ids that exist in `spells.yaml` (D-O9).

### 3.1 F1, "Chaos, the Sovereign" (`chaos`, existing art, 0 images)

- **Art:** the pass-V sprite, unchanged: approved sheets, rig, lock, `monster_scale.yaml` 3, titan layout and
  in-place attack.
- **Data changes only:**
  - The pool HP becomes 6000 (D-U3, user).
  - The old 0.5 phase is replaced by `{hpThreshold: 0.70, form: chaos_orrery, interlude: chaos_i1, patternId:
    aggressive}`.
  - New description and lore page.
  - Everything else stays as today.

### 3.2 F2, "Chaos, the Orrery" (`chaos_orrery`, colossus form, new art)

- **Concept:** the Sovereign's void robe burns away, and what was inside stands up: a vast **orrery of black-gold
  armillary rings** rotating around an armoured torso.
  - Where the head was, an **eclipse**: a black disc ringed by the flame crown, now a corona of ember, gold and
    white.
  - The four orbs ride the rings as small planets in the four Fiends' lights (frost cyan, ember orange, abyss teal,
    storm white).
  - Two colossal gold-clawed gauntlets rest on the edge of the crystal floor.
  - It rises from behind the horizon; the floor hides everything below the waist.
- **Scale on screen:** about 2x F1. The visible figure is about 1100-1300 screen px wide and fills the field height
  from the message window to the horizon and below. The top of the corona is cut off under the message window.
- **Mechanic (existing knobs only, R9):**
  - The AI (`ai.rate` 0.7) weights fir2 / ice2 / lit2 equally, plus `fast`. The four planets are flavour; no element
    rotation.
  - It resists fire, ice and lightning (`elementalProfile`).
  - Planned stats: defense 140, magicDefense 220, attack 90, hits 1, agility 24 (the agility is subject to the
    rosterStats rule, R11).
- **Phase within the form:** none.
- **Interlude `chaos_i1` (F1 -> F2), about 6.5 s:**
  1. message "The Sovereign's robe catches fire!"
  2. flash white 6 frames
  3. F1 `dissolve` flicker 24 frames, then fade 30 frames
  4. tint ember 0.35, 30 frames
  5. shake x2
  6. `swap`
  7. F2 `rise` from_dy 180 art px over 90 frames, in 2-art-px steps
  8. `pose` cast
  9. tint out
  10. message "Chaos casts off its shape. The Orrery turns!"

### 3.3 F3, "Chaos, the Last Horizon" (`chaos_horizon`, colossus form, the centrepiece)

- **Design, composition and scale effects:** section 3.0.
- **Mechanic:**
  - **The slam, the one scoped new mechanic (R9 ruling, 2.2 item 9):** `slam: {targets: 2}`, a physical attack on 2
    heroes with hits 3, attack 120. The view plays the colossus slam timeline because the record has `colossus:`, not
    because of `attackAnim`.
  - The beam: the named existing single-target black spell (2.4).
  - The moons cast the -2 spells.
  - Planned stats: defense 120, magicDefense 240, agility 18.
  - No resistances to the four elements; it resists earth (the existing profile key).
- **Phase within the form:** at 0.25 of the pool, message "The horizon groans; its core shows through!", `hits: 4`.
- **Interlude `chaos_i2` (F2 -> F3), about 8 s:**
  1. message "The rings shatter!"
  2. `pose` roar, 60 frames
  3. F2 `dissolve` sink 45 frames (down behind the horizon)
  4. fade 0.6, 20 frames
  5. shake x3 (no sprite), 24 frames
  6. `swap`
  7. F3 `rise` from_dy 300 art px over 120 frames, in 2-art-px steps (the colossus climbs over the horizon while the
     fade clears)
  8. shake x2, `with: previous` (the hand lands on the rim), adds 0 frames
  9. `pan` from (0, -60) art px over 120 frames, ease out: the reveal settles from the raised canvas to rest (A2)
  10. flash white 8 frames
  11. message "Chaos, the Last Horizon, fills the sky!"

  **A1 re-timing:** the 30-frame wait was dropped and the pan trimmed to 120 frames. The computed total is
  2 x 90 (messages) + 60 + 45 + 20 + 24 + 0 + 120 + 0 + 120 + 8 = **577 frames**, within D-O15's cap of 600 (the
  others 480). `tests/data/interludes.test.ts` pins each script's computed total.

### 3.4 F4, "the Core Laid Bare" (`chaos_horizon_core`, data form, F3's art plus one variant layer)

- **Concept:** the chest fissure tears open. The core layer switches to its `open` variant (5.4), the corona darkens,
  and the moons fall into orbit closer in.
- **Art selection (R19):** the record has `colossus: chaos_horizon` plus `colossusVariant: {core: open}`. The view
  is kept, and only the core layer's frame changes.
- **Mechanic (existing knobs only, R9):** a desperate pattern. `ai.rate` is raised, the beam spell weighted up, and
  the slam gets `hits: 4`. Planned stats: defense 90, attack 130.
- **Interlude `chaos_i3` (F3 -> F4), about 3 s, with no `swap`:**
  1. shake x2
  2. flash white 4 frames
  3. `pose` hurt
  4. `variant {layer: core, frame: open}`
  5. message "The core is laid bare! Strike now!"
- **Victory sequence (the last form dying):** the existing dying path cannot be used (it fades a sprite, 30 frames).
  The colossus uses its own `dying` timeline (4.3): the core white-out, the layers sink by 2 art px per frame behind
  the horizon for 90 frames, a white `FadeOverlay` to 1, then the normal victory.

### 3.5 Originality (binding)

None of these may be recreated, and the image-only review checks each one:
- the classic final-fantasy Chaos looks (a horned, winged demon on a throne; a tree-like dark god)
- a planet with a face (a living planet with a face carved on a sphere): **F3 has no face on a sphere; its head is an
  eclipse**
- a world-devourer with a helmeted head
- a ringed planet as a character
- the retired `chaos_v1` four-armed obsidian titan
- `cosmic_beast_v1`, the navy horned beast
- `drowned_sovereign`, `ashen_queen`, `hollow_seraph`

These features continue from F1, so the player reads the same being: void black, gold, the ember-gold-white flame
crown, and the four orbs in the four Fiends' colours.

### 3.6 Fields per form record (R10)

| Field | F1 `chaos` | F2 `chaos_orrery` | F3 `chaos_horizon` | F4 `chaos_horizon_core` |
|---|---|---|---|---|
| `num` | 128 (kept) | none (`formOf`) | none | none |
| `formOf` | (root) | `chaos` | `chaos` | `chaos` |
| `stats.hp` | 6000 | 6000 (equal, validated) | 6000 | 6000 |
| other `stats` | today's | tuned (3.2) | tuned (3.3) | tuned (3.4) |
| `protect` | today's `[status, poison_stone, death, earth, time]` | explicit copy | explicit copy | explicit copy |
| `attackStatus` | `[stun]` | explicit `[]` | explicit `[stun]` | explicit `[stun]` |
| `specials` | today's (bestiary only) | explicit `[]` | explicit `[]` | explicit `[]` |
| `size` | `boss` | `boss` (keeps the `bossTag`, `bestiaryModel.ts:39`) | `boss` | `boss` |
| `xp` / `gold` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `sprite` | `chaos` | none (it has `colossus: chaos_orrery`) | none (`colossus: chaos_horizon`) | none (`colossus: chaos_horizon`, `colossusVariant: {core: open}`) |
| `attack` / `attackAnim` | `melee` / `heavy` | `melee` / unset | `melee` / unset (the slam via `slam`) | same as F3 |
| `elementalProfile`, `ai`, `bossPhases` | 3.1 | 3.2 | 3.3 | 3.4 (no form phase: the last form) |

Nothing is inherited implicitly. Every field is written in the record, and `tests/data/chaosForms.test.ts` checks the
table.

---

## 4. Battlefield-scale runtime (ColossusView)

### 4.1 Layers

`BattleLayers` gains `colossus` between `bg` and `ui`: `bg` < **`colossus`** < `ui` < `actors` < `fx` < `hud`.
- The windows, party, fx and message window draw over the colossus. The party's sprites are in `actors`, above.
- `colossus` holds, bottom to top: the form's art layers, then `floorFront`, then the form's `overhang` layers.
  `floorFront` is the rim backdrop's floor below the horizon, as a cut-out with alpha (7.2). It hides the colossus
  base, so the being stands *behind* the horizon. `overhang` layers are the parts that rest on the rim in front of the
  far floor, such as F3's gripping hand; the layer yaml marks them `over: true`.
- `ScreenShake` moves `actors`, `fx` **and `colossus`**. `floorFront` is inside `colossus` and shakes with it; `bg`
  (the sky) does not.
  - Exposed edges: the colossus canvas over-scans the screen by >= 60 screen px on every side it touches.
  - `floorFront` is staged 1920 wide plus 12 px of bleed each side (7.2).
- `battleLayers.test.ts` is **updated**, not deleted: the order becomes bg, colossus, ui, actors, fx, hud. So is
  `screenShake.test.ts` (shake moves actors, fx, colossus).

### 4.2 Placement (no layout engine)

- An enemy whose data has `colossus: <form id>` is not passed to `computeEnemyLayoutAi`. `AiEnemyView` skips it, so
  no `formationFits` warning is logged.
- `ColossusView` places the canvas with the form's `place: {x, y}` in screen px (the canvas top-left) and its
  `scale` (integer, D-O2), both from `assets/sprites/colossus.json`.
- The data rule is "a colossus form fights alone". `formationFits` already refuses a titan with others; colossus
  formations are checked by the new data test.
- **Planned geometry** (*estimate*, fixed by the C3 measurement):

  | Form | Art canvas (art px) | Scale | Screen canvas | Place (x, y) | Visible extent |
  |---|---|---|---|---|---|
  | F2 | 440 x 300 | 3 | 1320 x 900 | (-60, 60) | x 0-1260, y 120-780 (base hidden by `floorFront` below y about 520) |
  | F3/F4 (rev 4: 18.4 = 2700 x 1080 at scale 1, place (-527, -210)) | 900 x 520 (no upper limit) | 3 | 2700 x 1560 | (-390, -300) | the whole field and past every edge but the bottom (strip); visible fraction 35.6 % (R12) |

  F2 is placed left of the party (party x 1380-1515), like an enemy. F3 is the world: the party stands *in front of*
  its right hand, which grips the rim at about x 900-1300, y 330-470 screen (*estimate*).
- **Scale 3** matches F1 and the 23 rescaled huge sheets (3 screen px per art px; D-O2). **Scale 2** (F3 = 1350 x 780
  art px) is the alternative; validation step V0 (5.2) measures both and the orchestrator picks.
- **No size limit.** The canvas is as large as the approved art. The only technical limit is the 2048 px texture side,
  so a larger layer is split into tiles of <= 2048 by the build: `colossus.json` lists tiles per layer, and
  `ColossusView` places them as one container.

### 4.3 Art layers and animation (light, no rig in-betweens)

- *(rev 4: for the painted forms, 18.3 replaces the layer kinds, the masks, the alpha rule and the limb bake below:
  there are no limb layers, no rotsprite, soft alpha and an additive glow; motion may be sub-pixel.)*
- **Why not the rig:** the monster rig tools are built around cells of 200 to 300 px. `monster_render` caps cells,
  `MAX_PAGE` is 2048, and a 900x520 rig with joint masks is untested and costly. **A layered puppet is used
  instead:** a few hand-masked layers, each with a few baked frames, moved in whole art px.
- **Layer spec** (`assets-src/gen/colossus/<form>.yaml`, written by the rigger), over the approved master image
  `approved/chaos_forms/<form>/master.png`:

  | Kind | Contents | Runtime use |
  |---|---|---|
  | `body` | everything not in another layer | static, breathing bob |
  | `limb` (`arm_l`, `arm_r`, F2 `gauntlet_l/r`) | polygon mask + `pivot` | baked frames `raise`, `slam`, `recoil` (rotsprite, 5.4) |
  | `core` | the eclipse / fissure core | pulse (alpha steps), `open` variant (F4) |
  | `glow` | aura baked offline from the alpha (5.3) | pulse, cast flare |
  | `moon` x4 (F2 planets, F3 moons) | small cut-outs | orbit paths in whole art px, in front of or behind `body` (z per path half) |
  | `eyes` (optional) | eclipse rim highlight | flash on attack |
  | `cloud` (F3) | nebula cloud bands over the shoulders (cut by colour from the master) | parallax drift (3.0) |
  | `corona` (F3) | the eclipse's flame streamers | 4-step pulse, cast flare |
  | `overhang` (F3 hand, `over: true`) | the hand gripping the rim | above `floorFront`; baked `grip` / `lift` / `slam` frames |

  Masks are polygons in art px. Pixels covered by a limb are filled behind it in the `body` layer with an
  inpaint-free fill: the nearest body palette colour, in a `fill:` polygon reviewed in the split review. Layers keep
  **binary alpha**, except `glow`, which has 4 stepped alpha levels (0.25 / 0.5 / 0.75 / 1).
- **Timelines** (`src/scenes/battle/colossus/colossusChoreography.ts`, pure, frame tables like
  `enemyChoreography.ts`):

  | Timeline | Frames | Content |
  |---|---|---|
  | idle | 144 loop | `body` bob 0 / -1 art px (half period 72, like the breathing period); `core` alpha 0.75 -> 1 -> 0.75 in 4 steps; moons orbit 1 art px / 4 frames |
  | attack (slam) | 44 | `arm_r` raise (12) -> hold (8) -> slam (4, contact on frame 24: screen shake + the hit) -> recoil (8) -> back (12) |
  | attack (beam) | 40 | `core` flare (`glow` to 1, 10) -> beam fx from the core anchor to the target (spell fx) -> fade |
  | cast | 40 | `glow` flare, moons speed up x2, backdrop tint in the spell's element colour |
  | hurt | 20 | **per-layer white flash (R15 ruling):** every visible layer sprite gets a white tint-flash filter or a pre-baked white silhouette frame, 2 frames on / 2 off x2. There is no `generateTexture` of the composite. Plus its own shake of +-3 screen px; no recoil travel |
  | roar | 60 | interlude only: all layers +-1 art px jitter, `glow` 1, shake x2 |
  | dying | 150 | core white-out, sink 2 art px / frame, white fade (3.4) |

- **Timelines are keyed by the presence of `colossus:` (R9).** The slam timeline plays for `slam` actions, the beam
  timeline for single-target black damage spells, and the cast timeline for every other spell.
- **Coverage scope (R14):** the coverage rule (field x 0..1920 and y 120..370 covered) holds at rest and in every
  idle, attack, cast, hurt and pan frame. `rise` and `dying` are exempt, because there the being enters or leaves.
- `EnemyPoseController` is not used for colossus forms. `ColossusPoseController` exposes the same calls
  (`attack`, `cast`, `hurt`, `die`, `update(dt)`), so `BattleAnimationController` drives either through one
  interface, `EnemyActorView`, which `AiEnemyView` also implements, behind a thin adapter. The adapter's lines in
  BAC count against BAC's 8-line headroom together with the interlude hook (4.5, R16).
- **Enemy animation preview (R17 ruling):** `enemyAnimPreview.ts` supports colossus forms. The `&enemyAnim=loop`
  and `&enemyAnim=step` rows are kept: loop cycles slam, beam, cast and hurt, and step steps the colossus timeline
  frame by frame with the `enemy: frame / t` label.
- **No lunge:** every attack's travel is 0, so `TRAVEL_HOP`, `lungePx` and `TRAVEL_CLEAR_Y` do not apply. The only
  motion is the shake (6 screen px) plus the hurt shake (3 screen px); the planned total is at most 12 (0 functional).

### 4.4 Anchors (damage numbers, cursor, status, fx, melee)

- `colossus.json` carries per form `anchors` in art px, converted to screen px at runtime:
  - `target`: the cursor point
  - `core`: damage numbers, the default fx centre
  - `head`: head fx and the status icon row
  - `hands: [l, r]`: the slam fx
  - `melee`: where heroes run to; a point at the right arm's nearest part, at x <= 1250 so heroes travel at least 150
    px
  - `feet`: the ground fx line on the floor front
- **Damage numbers:** `floatingNumbers` takes an optional anchor point. For a colossus it is `core`, clamped to
  y 140-740.
- **Target cursor:** the arrow points at `target`. No outline rect is drawn for a colossus; it would be off-screen.
  Instead the cursor is a pulsing bracket around a `targetRect` (art px, in the json) inside the field. The label is
  clamped below y 124.
- **Status icons:** a row at `head`, kept visible (y 140-760). The enemy-list name in the bottom strip also shows the
  status letters it shows today (unchanged).
- **Spell fx:** `emitterCore`'s `bodyBox` gets an override provider. `ColossusView.effectBox()` returns a synthetic
  body box of about 420x360 screen px centred on `core`, so the existing ratios (centre, head, feet, front) land on
  the body. The flame `rise` count cap (x3) stays.
- **Hero melee:** the attack choreography reads `melee` instead of the box's right edge. The slash is drawn at
  `melee` with the length a big box gets today (`0.45 * 360`).
- **The proxy for sprite consumers (R15 ruling).**
  - After `swap`, `ColossusView` puts an **invisible proxy `Container`** at the form's `targetRect` (screen px) in the
    slot where `AiEnemyView`'s sprite was. Code that reads "the enemy sprite" (bounds, x/y) gets the proxy, so its
    box is the target rect, inside the field.
  - The consumers to route, as momus counted them:

    | Consumer | Uses |
    |---|---|
    | `actionNumbers` | 3 |
    | `BattleEffects` | 2. The `elementFlash` Graphics box (`BattleEffects.ts:59-62`) must route to the colossus hurt flash instead of drawing a box over the proxy |
    | `BattleFieldTargeting` | 2 |
    | `statusFx` | 2 |
    | `BattleAnimationController` | 9 |
    | `enemyAnimPreview` | 5 |
    | `BattleDisplayManager` | 11. `upgradeToArt` (`BDM:94`) gets a guard so it never replaces the proxy or the colossus with an atlas sprite |
    | `BattleScene` | 1 |

  - `tests/scenes/battle/formChangeView.test.ts` enumerates these consumers and asserts that each one gets the proxy
    or the colossus path after a swap.

### 4.5 Line ceilings and new modules (R16)

| File | Lines / limit | Plan |
|---|---|---|
| `BattleDisplayManager.ts` | 248 / 250 | line-neutral; the colossus build, proxy and `upgradeToArt` guard live in the new `src/scenes/battle/colossus/colossusSprites.ts`, with a call replacing an existing line where possible; otherwise extract the party-sprite block first |
| `BestiaryPreview.ts` | 247 / 250 | colossus preview in the new `src/scenes/bestiary/bestiaryColossus.ts`; at most a 2-line branch, or extract `setBackground` first |
| `AiEnemyView.ts` | 240 / 250 | the "skip `colossus:` records" filter goes in `boxInputOf` / a helper, at most 3 lines |
| `BattleFieldTargeting.ts` | 235 / 250 | the bracket cursor in the new `colossus/colossusCursor.ts`, at most 4 lines of branching |
| `BattleAnimationController.ts` | 300 / 308 | the `EnemyActorView` adapter (in `colossus/enemyActorView.ts`) plus the interlude hook (`formChangeView.ts`), at most 8 lines together; otherwise extract the enemy-turn presentation first |
| `tools/stage_backgrounds.py` | 249 / 250 | `src_size`, the `rim` profile, the floor cut and `pad_bottom` go into the new `assets-src/tools/stage_rim.py`, which the main tool imports (at most 1 line) |

New files: `colossus/ColossusView.ts`, `colossus/colossusChoreography.ts`, `colossus/ColossusPoseController.ts`,
`colossus/colossusSprites.ts`, `colossus/colossusCursor.ts`, `colossus/enemyActorView.ts`, `formInterlude.ts`,
`formChangeView.ts`, `src/battle/bossForms.ts`, `src/battle/enemyHp.ts`, `src/battle/slamAttack.ts`, and
`src/data/InterludeRegistry.ts`. Each is at most 250 lines.

### 4.6 Memory, loading and files

- **Textures:** dedicated PNGs, not the monster atlas: `assets/sprites/colossus/<form>/<layer>[_<frame>].png`, each
  cropped to its layer's opaque box (+1 px), plus the index `assets/sprites/colossus.json` (layers, frame boxes,
  offsets, pivots, anchors, `place`, `scale`, timelines' frame names).
- *(rev 4: memory, filtering and tiles are in 18.6: linear filtering, about 21.2 MB total.)*
- **Memory estimate** (art-px RGBA, scaled on the GPU like the atlas): F3 is about 900x520x4 = 1.9 MB per full layer.
  Most layers are cropped far smaller, so about 8 layers plus about 12 limb frames come to about 12 MB; F2 is about
  5 MB; total about 17 MB. The criterion is <= 24 MB, measured by the build. If F3's approved canvas is larger, the
  cap rises with an orchestrator ruling, since size is never cut to fit the budget. The F1 atlas page stays as it is.
- **Loading:** `BattleArt.ensureColossus(forms)` is called by `BattleTrigger` together with `ensure`, for every form
  reachable from the formation's root (the `form` chain). This avoids a hitch at a form change.
- **Textures (R27):** every colossus texture uses `scaleMode: 'nearest'`. All of them are destroyed on battle end and
  on bestiary exit. A scene test checks that the texture count is equal before and after. The bestiary loads one form
  at a time.
- **Build stage:** `colossus` in `build_assets.py`. It reads the approved masters and the layer yaml and writes the
  PNGs and the json. It is deterministic (no hash order) and refuses a layer > 2048 or non-binary alpha outside
  `glow`.
  - **With no approved master (C-base, R25):** the stage exits 0 and changes no output file. This is tested at C-base.
  - **Determinism check (R26):** `--out DIR` writes to a scratch dir, run twice with `PYTHONHASHSEED` 0 and 1, then
    `cmp -r` (or the sha256 manifest it writes, compared).

---

## 5. Art generation (Stability on Bedrock)

### 5.1 Tool and guard (framework owner, 0 paid)

New `assets-src/gen/colossus.py`, whose subcommands do not touch `generate.py` monster sheets:
- `gen <form> --model core|sd35|ultra --seed N --paid`: text-to-image (maps to `bedrock.invoke(..., paid=True, purpose=...)`; without `--paid` it only prints the request) at 21:9 (F3) or 16:9 (F2). The prompt comes
  from `gen/colossus/<form>.prompt.md`.
- `nobg <form> <raw>`: `remove_bg`.
- *(rev 4: `pix` is not used for colossus forms; 18.2 adds `upscale`, `glow` (extraction), `despill` and `inpaint`.)*
- `pix <form> <nobg> --scale 2|3 --colors N`: alpha >= 128, drops specks < 0.2 % of the largest blob (the `/tmp/stab`
  `pix.py` rules), fits to the form's canvas by a pitch-aware block vote (`pixelize_native`), a 15-bit snap, the
  chaos palette lock (5.3) and a 1 px outline.
- `glow <form>`: the aura bake.
- `bake <form>`: limb frames.
- `mock <form>`: a stage mock on rim with the party, like `/tmp/stab2/scripts/stage_mock.py`.
- `review <form>`: strips and GIFs in `gen/out/colossus/review/`.
- `approve <form> <pix>`: copies to `approved/chaos_forms/<form>/master.png` plus `meta.json` with the source, seed,
  model, prompt hash and cache keys, and un-ignores the cache files.

- `budget --check`: the pass-C count against the cap and each purpose cap, plus `gem[N_C0:] == 0`. It exits non-zero
  on a breach and is selftested (R24).

`bedrock.py` gains the **BR ledger, cap and gate inside `invoke` itself (R23)**, so no caller can bypass them:
- The new signature is `invoke(model, body, *, paid: bool, purpose: str, model_ids=None)`.
  - A cache hit returns before any check and is not logged.
  - Otherwise it refuses unless `paid` is true.
  - It refuses over the pass cap of 80 (D-U5) or the purpose cap (5.6).
  - It refuses **from any linked worktree**, when `git rev-parse --git-dir` differs from `--git-common-dir`. Paid
    calls only come from the main checkout.
- **One row per logical request,** `{ts, tool, model, purpose, seed, key, pass: "C"}`, is appended **before the first
  try**. The id that served the call (with or without the `us.` prefix) is appended to that row's record after
  success. A failure counts as spent.
- `generate.py`'s existing Bedrock path (character sheets) passes `paid` / `purpose` through.
- The budget lives in `assets-src/gen/budget.json` under a `bedrock` block (`pass: C`, `cap: 80`,
  `per_purpose_caps`). `selftest_passv.py` stays green: the pass-V literals are untouched.
- The BR ledger `assets-src/gen/cache/bedrock_ledger.jsonl` is **tracked in git**.
- `selftest_colossus.py` covers these as RED cases:
  - refused without `paid`
  - refused at the cap and at a purpose cap
  - **under pass C, refused when the call's `purpose` is not in `per_purpose_caps`**, including `generate.py`'s
    character-sheet Bedrock path (A6)
  - refused from a linked worktree
  - one row written before the first try (a mocked client that raises)
  - a cache hit not logged
  - the Gemini guard still skips Bedrock entries
  - `generate.py:312` still refuses Bedrock monster sheets

### 5.2 V0: the validation step (unproven, small, before any production call)

The generator runs V0 with at most **12 Bedrock calls**, all aimed at F3, the centrepiece. The per-row caps are
V0-a 3, V0-e 4, V0-b 2, V0-d 2 and a spare of 1 (R3). It answers five questions, each with a pass rule and an
image-only review by a fresh reviewer:

| # | Question | Calls | Pass rule |
|---|---|---|---|
| V0-a | Can Core / SD 3.5 draw an original F3 (horizon colossus, eclipse head, continental arms) that reads as one being, at 21:9? | core x2 seeds, sd35 x1 | >= 1 render where the reviewer names the 5 planned features (shoulder ranges, eclipse head, chest fissure, two arms, four moons) and none of 3.5's look-alikes |
| V0-e | Can the best V0-a render be **extended past its frame** (outpaint left, right and up) so the canvas reaches >= 2688x1512 screen px at scale 3 with no visible seam or a second head? | `outpaint` up to 4 (model id confirmed read-only with `aws bedrock list-foundation-models --region us-west-2 --by-provider stability --profile bedrock`; added to `bedrock.py MODELS`) | the reviewer finds no seam, duplicate feature or style break at the outpaint borders at 1:1 and in the mock; if it fails, F3 uses the single render at the largest scale that keeps its pixel pitch (5.3a S-A), and the canvas is the render |
| V0-b | Does `remove_bg` keep the arms and moons as pieces, or does it eat them? | `remove_bg` x2 | the planned pieces survive (the render-vs-cut piece comparison of REDESIGN rev 13); glow loss accepted (5.3) |
| V0-c | Does it read as planet-sized at scale 3 and at scale 2 on rim with the party? | 0 (offline `pix` + `mock`) | the reviewer answers yes to "is this the largest, most imposing thing in the game, and is the party still readable?"; the measured edge contrast against the floor is >= 100 (sd35 v3 + the dark F1 measured 149) |
| V0-d | Can a second key be made consistently (F4's open core) from the same master? | `search_replace` x1 ("the chest fissure" -> "a torn-open fissure, white-hot core"), `structure` x1 (master as the structure, "arms raised") | report only: if the core edit keeps the rest of the image identical within the layer masks, F4 uses it; otherwise F4's `open` core is a paint-patch variant of the core layer (0 images). The `structure` result is expected to fail identity (2026-11-13 finding); it is logged, not relied on |

**Gate G-C0** (the orchestrator decides from the V0 report):
- **Continue (Stability):** V0-a, V0-b and V0-c pass. V0-e picks S-B or S-A (D-O14). V0-d picks the F4 variant
  source.
- **Stop and report to the user (D-U6: no Gemini fallback):** if V0-a fails twice, or V0-c fails at both scales.
  There is no Gemini path, no `--backend gemini` and no hybrid. Production generation does not start until the user
  rules.

### 5.3 Consistency and glow strategy

- **One master per form, no multi-pose generation.** Every pose comes from the runtime layers (4.3). This is the main
  answer to the unproven Stability multi-pose consistency. The only second key is F4's core (V0-d), with a
  0-image paint fallback.
- *(rev 4: the palette lock and the stepped glow are dropped for colossus forms; 18.2 and 18.3.)*
- **Palette lock across forms:** `pix` snaps every form to a shared base palette taken from F1's approved sheets
  (void black, gold, ember, white and the four orb colours, as exact 15-bit values) plus up to N free colours per form
  (D-O3: 24 for F3, 20 for F2). `selftest_colossus.py` checks that the base colours are present and no other colours
  are near them (delta E rule).
- **Glow:** `remove_bg` strips soft light. The `glow` layer is rebuilt offline from the cut's alpha:
  - dilate 6 / 12 / 18 art px around the `core`, `corona` and `moon` masks
  - colours from the base palette: ember / gold / white
  - 4 stepped alpha levels
  - additive blend at runtime (PixiJS `blendMode: 'add'` on that layer only)

  The review compares the mock against the raw render's glow.
- **Prompt rules** (from `/tmp/stab` and `/tmp/stab2`):
  - Subject on a flat plain background (key colours are ignored, so ask for "plain flat dark grey background",
    which `remove_bg` separates best; *to be confirmed in V0-b*).
  - Full figure inside the frame, "filling the frame edge to edge horizontally" for F3.
  - No scenery (scenery is the backdrop's job).
  - The F1 continuity words (void black, gold, ember-gold-white flame corona, four orbs: frost cyan, ember orange,
    abyss teal, storm white).
  - Ultra is not used for the subject (it drew a small subject: 361x415 of 1536x640).

### 5.3a F3 generation recipe (the centrepiece; generator)

**Strategies, in order of preference.**
- **S-B (planned): core render, then outpaint.**
  1. One 21:9 Core (or SD 3.5, from V0-a) render of the centre composition: the eclipse, chest fissure, right hand on
     the rim and the near shoulder. Raw 2304x960, *measured* for Core at 21:9.
  2. Outpaint left (the far shoulder and arm), right (the near shoulder's limb) and up (the corona).
  3. Pixelize to the canvas: 900x520 art px at scale 3. The pitch is about 2.6 render px per art px, close to the
     2.6-3.6 pitch the `/tmp/stab` Core render pixelized well at.
- **S-A (fallback): a single render.** One 21:9 render, pixelized at scale 3. Core gives 1931 px of subject width,
  which is about 640 art px = 1920 screen px; this fills the field width with no overscan.
  - To make it run past the edges there are two ways:
    - Show the same 640-wide cut at **scale 4**: 2560x1150 screen px, which passes both side edges by 320 px.
    - Keep it at scale 3 and place it so that one shoulder runs off-screen.
  - The orchestrator picks between the two from the mock. D-O2 allows scale 4 for F3 only under S-A.
  - The "fraction of something vast" effect then relies on the top cut, the floor cut, the off-screen shoulder and the
    pan.
  - The coverage criterion is still met. The "<= 45 % visible" criterion is re-ruled by the orchestrator.
- **S-C (rejected): generate parts separately** (hand, head, shoulders) and assemble them. The identity and lighting
  of separately generated parts do not match (the 2026-11-13 finding).

**Prompt seed (F3, Core; wording may be tuned, the named features stay).**

> 16-bit SNES-era pixel art, a world-sized cosmic colossus rising over the horizon at the edge of the universe, seen
> from the front, filling the frame edge to edge: its two shoulders are vast mountain ranges of black stone with gold
> seams curving away like the rim of a planet, its body a crust of black stone plates veined with glowing ember
> fissures and gold, thin bands of rose and violet nebula cloud drifting across its shoulders and chest; in place of a
> head a perfect black eclipse disc ringed by an enormous corona of ember orange, gold and white flame streamers, two
> tiny white star-points deep in the disc; a vast vertical fissure down the middle of its chest, white-hot at the
> centre and gold at the edges; its right hand, a colossal hand of black-gold stone with five ridged claws, grips the
> near edge of the ground at the bottom right; four small glowing moons in front of its chest, one frost cyan, one
> ember orange, one abyss teal, one storm white; plain flat dark grey background, no ground, no scenery, hard pixel
> edges, flat cel shading, light from the upper left.

The negative prompt:

> face, mouth, nose, human face, helmet, horns, wings, tail, throne, tree, planet with a face, ringed planet, legs,
> feet, weapon, text, watermark, frame, border, scenery, landscape, mountains in the background, sky, stars in the
> background, photorealistic, 3d render, blurry, small subject, cropped head with a face.

**Outpaint seeds (S-B):** left: "the far shoulder range and a continental forearm of black stone plates lying along
the ground, continuing the same crust and cloud bands"; up: "the eclipse corona's flame streamers continuing into
the sky, the same colours".

**Pixel pass:**
- `pix --scale 3 --colors 24` with the base palette lock.
- The canvas is the render's opaque box plus the outpaint.
- The moons are cut by colour into their own layers before pixelizing (V0-b), so `remove_bg` cannot lose them.
- `remove_bg` input size: if the outpainted image exceeds the model's input limit (to confirm in V0-e), the alpha is
  computed on a half-size copy and upsampled nearest. The pixel pass binarizes it anyway.

**Review checklist (image-only, fresh reviewer, at 1:1 art px and in the stage mock):**
- the 5 named features are present
- none of 3.5's look-alikes
- reads as one being
- reads as planet-sized next to the party (mock)
- the hand grip reads
- no seam at the outpaint borders
- the party band readable (contrast rule, 14)
- palette lock

The reviewer answers SHIP / SHIP WITH NITS / ITERATE. Two rejections in a row stop F3 generation until the wording is
fixed offline and the orchestrator agrees.

### 5.4 Layer split and limb bake (rigger, 0 images)

- The rigger writes the layer yaml (masks, pivots, fills, anchors, moon paths).
- *(rev 4: no limb bake for the painted forms; 18.3.)*
- `colossus.py bake` rotates the limb layers with the existing `rotsprite` sampler from `monster_render.py`: angles
  per frame, cap 20 degrees like the rig rotation cap; `raise`, `slam` and `recoil` per limb.
- Checks, reusing `anim_checks` where they apply: binary alpha, palette lock, no detached pixels, an outline on cut
  edges, a seam check where a limb meets the body at its pivot.
- An image-only review per form (SHIP / SHIP WITH NITS / ITERATE), at most 4 iterations per form (the
  NEW_MONSTER_GUIDE limit), and a rejection counts.
- `colossus.py lock <form>` writes `gen/colossus/<form>.lock.json` (hashes of every exported layer frame).
- **Commit right after lock.**

### 5.5 Retire-first

- **F1 is kept,** so nothing is retired in the plan.
- If an approved colossus master is later replaced, the old one is archived first as
  `approved/_retired/chaos_<form>_vN/` (master, `meta.json`, layer yaml, lock, cache keys), in a row of
  `docs/RETIRED_SPRITES.md`.
  - `retire.py` gains `--colossus <form>` for this, with a fixture in `selftest_retire.py`.
  - `colossus.py approve` refuses to overwrite a master without a byte-identical archive copy (the `approve.py` gate
    rule).
- If D-U1 replaces F1's art: `retire.py chaos --as chaos_v2` before the first request (`chaos_v1` already exists).
- `cosmic_beast_v1` is not read, moved or reused.

### 5.6 Per-form call plan (production, after G-C0)

| Purpose | Model | Calls (cap) | Notes |
|---|---|---|---|
| V0 (F3-focused) | core, sd35, remove_bg, search_replace, structure, outpaint | 12 | 5.2 (a 3, e 4, b 2, d 2, spare 1) |
| rim backdrop | none (accepted as is) | 0 | 7.1; the optional fire-spot clean-up is offline paint (0 calls) |
| rim upscale (`rim_upscale`) | upscale_conservative | 2 | 7.3: the user found the staged rim blocky; taken from the reserve (orchestrator, 2026-11-16) |
| **F3 master gen + outpaint** (centrepiece) | core / sd35 + outpaint | 24 | 2 rejections in a row stop generation until the wording is fixed offline and the orchestrator agrees |
| **F3 remove_bg** | remove_bg | 10 | |
| F2 master | core (sd35 if V0 prefers it) | 8 | secondary: cut first if the cap is near (D-O13) |
| F2 remove_bg | remove_bg | 4 | one per kept render |
| F4 core variant | search_replace or masked inpaint | 4 | 0 if paint (V0-d); inpaint (`colossus.py inpaint`, orchestrator ruling 2026-11-16) edits only a hand-drawn mask, and the offline `inpaint_merge` keeps every pixel outside it byte-identical |
| reserve | any, **F3 first** | 16 | orchestrator only (18 until 2 moved to `rim_upscale`) |
| **Total cap** | | **80** | D-U5 (user); V0 + F3 = 46 of 80, plus F3's first call on the 16 reserve |

Under pass C, `bedrock.invoke` refuses any call whose `purpose` is not one of these keys, whatever the caller (A6). These are the `per_purpose_caps` in `budget.json` (purposes `v0`, `f3_gen`, `f3_nobg`, `f2_gen`, `f2_nobg`,
`f4_variant`, `rim_upscale`, `reserve`). The `reserve` purpose needs an orchestrator note in the ledger row's `purpose` field
(`reserve:<reason>`).

---

## 6. Image budget and AWS cost

- **Gemini:** 0 images planned. `N_C0` is the Gemini attempt count in the main-checkout ledger at C1; every pass-C
  Gemini count is `gem[N_C0:]`, which must be 0: there is no Gemini fallback (D-U6, user). The pass-V and V8 counters
  are not touched.
- **Bedrock:** cap 80 calls (D-U5, user), the BR ledger inside `bedrock.invoke`, `paid=True`, one request per review
  checkpoint.
- **AWS cost** (*estimate*, list prices to be confirmed from the AWS Bedrock pricing page for us-west-2 at C1 and
  written into ROSTER_LOG): about $0.04 per Core image, $0.08 per SD 3.5 Large image, $0.14 per Ultra image (not
  used), and about $0.04-0.08 per edit call (remove_bg, search_replace, structure).
  - Expected use is about 35-45 calls, about $2-3.50.
  - Worst case at the cap of 80: **$6.40** at the highest rate actually used ($0.08, SD 3.5; Ultra is not used), or
    $11.20 if every call were billed at the Ultra rate ($0.14).
  - The ledger row stores the model, so ROSTER_LOG can total the real cost.
- **AWS safety:**
  - Only `bedrock-runtime:InvokeModel` with the existing `bedrock` profile; no resource is created, modified or
    deleted.
  - At V0 the generator runs `aws sts get-caller-identity --profile bedrock` and `aws bedrock list-foundation-models
    --region us-west-2 --by-provider stability --profile bedrock`, both read-only. It records both outputs (the role
    ARN and the model ids, including outpaint) in ROSTER_LOG (R30).
  - If the role name matches `Admin` or `Prod` (case-insensitive), the generator stops and asks the user (the global
    production-safety rules).

---

## 7. Arena backdrop (`rim`)

### 7.1 Source (accepted by the user as is)

- The source is `/tmp/stab2/sd35_v3_raw.png` (1344x768, SD 3.5, seed 5151, prompt v3 in `/tmp/stab2/prompt.md`). Its
  staged preview is `/tmp/stab2/sd35_v3_bg.webp`, and the mock is `sd35_v3_battle.png`.
- It is copied to `assets-src/backgrounds/rim-src.png`, with the prompt, seed, model and stage numbers in
  `rim-src.json`.
- **0 Bedrock calls.** The optional fire-spot clean-up is not required. If the orchestrator does it, it is offline
  paint on a copy, recorded in `rim-src.json`, and the raw is kept.
- `/tmp` is volatile, so the copy into the repo is the **first** C2 step. Its sha256 is recorded in ROSTER_LOG.

### 7.2 Staging (`tools/stage_backgrounds.py`, TS/art owner)

- **Source size:** the tool assumes 1536x1024 sources. The rim source is 1344x768.
  - The tool gains a per-source `src_size` (read from the image).
  - The stage entry is `"rim": ("rim-src.png", 485, 1.05, "center", 370)`. Those are the user-accepted values
    (horizon src row 485, zoom 1.05, screen horizon 370; the *measured* scale is 1.5).
  - The staged output must be pixel-identical to `/tmp/stab2/sd35_v3_bg.webp` decoded, or the difference is explained
    in ROSTER_LOG (e.g. a resampler difference) before commit.
  - The staged bottom is 794 (*measured*), which is below `STRIP_Y` 780, so the field is covered.
  - The bestiary panel is checked separately (8).
  - If the bestiary needs more floor: `pad_bottom` mirrors the floor's last 40 rows. This is tested by the `--check`
    coverage rule: no uncovered row in y 0-1080 after padding.
- **Where the code goes (R16):** `stage_backgrounds.py` is at 249/250 lines. `src_size`, the `rim` profile, the floor
  cut and `pad_bottom` go into the new `assets-src/tools/stage_rim.py`, which the main tool imports and dispatches to
  (at most 1 line).
- **New check profile `rim`** in `CHECKS`, replacing the inapplicable `shoreline` water rules:
  - field coverage 100 %
  - the boss contrast `edge_delta` >= 100 with the dark F1 composite (*measured* 149)
  - the party band luma contrast >= 0.8 x the field's
  - seam <= 30 (the sky's rift is a natural vertical feature; *measured* 27.6; D-O6)
  - `--check rim` must pass
- **Outputs:** `assets/backgrounds/rim.webp` (1920x1080, committed; act-1 commit rule extended to rim) and
  **`assets/backgrounds/rim_floor.webp`**.
  - `rim_floor.webp` is the floor below the horizon row with alpha, a hard edge on the horizon line, 1944 wide
    (12 px bleed each side).
  - It is the `floorFront` of 4.1, so it must line up pixel-exact with `rim.webp` (a test diffs the overlap).
- **Use (R21 ruling):** every Chaos debug scenario sets `background: assets/backgrounds/rim.webp`, the existing
  scenario key. This plan makes **no map-placement claim**: Chaos is on no map today, and placing the encounter is out
  of scope. During `chaos_i2` the `tint` / `fade` steps darken the sky.
- **Status-icon probe (R21):** Chaos protects against status, so `chaos_final` uses the scenario preset
  `enemyStatus: {0: [poison, slow]}` (the `anim_pass_v_chaos` pattern) to show the icon row.

### 7.3 Higher-resolution source (`rim_upscale`, user feedback 2026-11-16)

- The staged rim (1344x768 upscaled nearest x1.5) looks blocky next to the 1920x1080 backdrops. The fix is one
  Stability **Conservative Upscale** call on Bedrock (`us.stability.stable-conservative-upscale-v1:0`, us-west-2)
  through `colossus.py upscale` (purpose `rim_upscale`, cap 2, from the reserve):
  `{image, prompt, [negative_prompt], creativity 0.2-0.5, seed, output_format: png}`; the input is checked locally
  first (every side >= 64 px, <= 9,437,184 px, aspect 1:2.5..2.5:1; the 1344x768 source is 1.03 MP).
- `stage_rim.py` takes the larger source unchanged in composition: the horizon row 485 is recorded at 768 px
  (`RIM_SRC_H`) and scales with the source height, the scale comes from the width, and a source larger than the stage
  is downsampled with Lanczos. The staged top -358, bottom 794, horizon y 370 and zoom 1.05 stay; `--check rim` must
  pass. `stage_backgrounds.py rim --file <upscaled.png>` stages it (selftest_colossus_up.py: a 4x fixture gives the
  same geometry).
- The raw 1344x768 `rim-src.png` is kept; the upscaled source and its sidecar are recorded in `rim-src.json`.

---

## 8. Bestiary

- **Model (ruled, D-O7):** the Chaos entry lists its art forms as **sub-entries** in the list: "Chaos",
  "Chaos (Orrery)", "Chaos (Horizon)".
  - The list is ordered by `formOf` and the chain order.
  - Each sub-entry has its own stats, elements, description and lore page.
  - F4 is the second info page of the Horizon entry, using the existing page keys (Left/Right). No new key binding.
  - An unseen form shows "???" with no preview (`mode: seen`); `mode: all` shows them all.
  - **From C1 (R11),** records with `formOf` are filtered out of the top-level list. They appear only as sub-entries
    under their root.
- *(rev 4: the colossus preview is a pre-composited still at fit size, 18.8.)*
- **Preview of a colossus form:** `BestiaryPreview` builds a `ColossusView` at **scale 1** (art px = screen px, an
  integer scale) inside `PREVIEW_INNER` (940x720), in the new `bestiaryColossus.ts` (R16).
  - F2's 440x300 fits whole and is centred on the panel (`fitShift` uses the colossus `visibleBox` from the json
    instead of `idleBox`).
  - **A canvas wider than 940 or taller than 720 art px (R22)** cannot fit at scale 1; F3's planned 900x520 fits, but
    a larger approved F3 may not. Such a canvas shows **the rest-view crop**: the part of the canvas inside the battle's
    `visibleBox` at rest, at scale 1 (a 1/n downscale is never used). If
    even that does not fit at scale 1, the crop is centred on `core` and clipped by the panel's mask.
  - The backdrop is `rim`, centred like D-V8.
  - The preview loop is idle -> attack -> hurt -> cast (the colossus timelines).
- **F1's preview is unchanged.** `bestiaryCentre.test.ts`, `bestiaryReach.test.ts` and `bestiaryCeilings.test.ts`
  pass unchanged.
- **Data:** `bestiary.yaml` habitat for the forms (`rim`), lore pages (ASCII) for the three art forms, and the
  `bossTag` for every form record (`bestiaryModel.ts:39`).

---

## 9. Tests (RED first)

Each test below is written and run failing before its code lands, and the RED output goes into the agent's report.
Existing tests are updated only where this plan changes the pinned behaviour (named below), never deleted.

### 9.1 Battle and data (TS battle owner)

| File (new unless noted) | Cases |
|---|---|
| `tests/battle/bossForms.test.ts` | F1 -> F2 at 0.70: `enemy.data.id` becomes `chaos_orrery`, `currentHp` unchanged, max HP unchanged; **HP exactly 4200 triggers** (R5); the next enemy action is drawn from F2's `ai`; F2's elemental profile is used by the next spell; **`phaseBuffs` of F1 subtracted while `fast` survives F1 -> F2** (R6); **F3's `hits: 4` does not leak to F4** (R6); **overkill**: a 9999 hit on F1 at full HP leaves HP at 4200 and the form changes (no skip); two thresholds reached by one hit (F1 at 4300, a 9999 hit): stops at 4200, one change per action; **F1 -> F2 -> F3 in one battle, F3 by a normal hit, with `crossedPhases` reset so F3's 0.25 line fires** (R4); `checkBossPhases` never applies a form phase as a plain phase (R5); **a still-queued Chaos command is re-chosen by the new AI, turn order kept; a null AI gives Fight** (R7); **a scenario `enemyAi` override is dropped at the first change** (R7); heal after the change does not revert; `formChange` exactly once per form; the last form at 0 HP: victory; the poison tick across a floor changes the form through the `executeNextAction` hook (R8) |
| `tests/battle/colossusSlam.test.ts` | the F3 slam (R9): 2 distinct living targets; 1 if only 1 lives; per-target hit rolls; event order; validator refuses `slam` without `colossus:` and `targets` != 2 |
| `tests/systems/battleTriggerForms.test.ts` | `battle:formChange` sets `SEEN:<to>`; the subscription is removed at battle end (R20) |
| `tests/battle/enemyHp.test.ts` | the 5 write sites route through `setEnemyHp` (behaviour: floors respected for spell damage, physical damage, status tick, revive (HP 1)); no other `currentHp =` write on enemies in `src/battle` (static grep test) |
| `tests/battle/BossPhase.test.ts`, `BossBattle.test.ts` (existing) | **unchanged**, must pass (regression gate R28) |
| **Pins updated (R11), never deleted** | `tests/data/rosterData.test.ts:37-41`, `tests/data/rosterStats.test.ts:41-46` (the agility rule: form records follow it, or the tuned F2/F3/F4 values are pinned with a reason), `tests/scenes/bestiary/bestiaryModel.test.ts:36-44`, `tests/scenes/battle/EnemyLayoutAi.test.ts:200`, `tests/core/schemaValidationFx.test.ts:14`, `tests/data/assetCoverage.test.ts`: each gains an explicit `formOf` filter (records with `formOf` have no `num`) and a case that the filter excludes exactly the 3 form records |
| `tests/core/mapValidators.test.ts` (existing, extended) | `form` and `interlude` accepted; bad types refused |
| `tests/data/chaosForms.test.ts` | chain chaos -> orrery -> horizon -> horizon_core; equal `stats.hp`; strictly descending thresholds; no cycle; every `interlude` exists; form records are in no encounter table or formation on their own; every `ai.actions` spell id exists in `spells.yaml` (all enemies; would have caught nothing missing today because ai uses ice2/fast, but guards new forms); `colossus` forms **with an approved master** have a `colossus.json` entry (A5) |
| `tests/data/interludes.test.ts` | every script validates; the unskipped total (R18 definition at message speed 3, 90 frames per message, A1) <= 480 frames (600 for `chaos_i2`), and **each script's computed total pinned** (`chaos_i2` 577); every `pan` offset within the json-derived limits (R13: F3 dx [-128, +128], dy [-160, +138]) and the A2 start rule (dy in [-70, 0], dx <= 0); exactly one `swap` when the art id changes, **zero for F3 -> F4** (R19); `rise` only after `swap`; `variant` only on a colossus form |
| `tests/scenes/battle/formInterlude.test.ts` | the pure timeline: event frames, the swap frame, `with: previous` concurrency, total duration, confirm advances only `message` steps, every other input ignored, the 24-frame hold-off at the end (R18) |
| `tests/balance/chaosForms.test.ts` | seeded runs (`battlePolicies.ts`) with the `chaos_forms` endgame debug party: win rate, rounds per form (each form >= 3 rounds median), party KO count; bounds pinned at C7 >= 3 points from measured |

### 9.2 View (TS view owner, on fixture textures first, real art at C5)

| File | Cases |
|---|---|
| `tests/scenes/battle/battleLayers.test.ts` (existing, updated) | order bg, colossus, ui, actors, fx, hud |
| `tests/scenes/battle/screenShake.test.ts` (existing, updated) | shake moves actors, fx, colossus; never bg, ui, hud |
| `tests/scenes/battle/ColossusView.test.ts` | *(rev 4: superseded by 18.7)* on the **900x520 art px fixture** (or the size read from the json, R22): placement from the json; integer scale; `scaleMode: 'nearest'`; every frame of idle / attack / cast / hurt / roar / dying at whole screen px; abs(dx) <= 12 over every timeline; coverage of x 0..1920, y 120..370 (R14: at rest and in idle / attack / cast / hurt / pan frames; rise and dying exempt); per-layer white flash on hurt with no `generateTexture` call (R15, spy); no call to `computeEnemyLayoutAi` / `formationFits` for colossus data (spy) |
| `tests/scenes/battle/colossusWorld.test.ts` (the *(rev 4: superseded by 18.4 and 18.7)* centrepiece) | F3 canvas >= 2688x1512 screen px (R12); at rest it passes the left, right and top screen edges; visible fraction (intersection with (0, 0, 1920, 780) / canvas area) <= 45 %; coverage of x 0..1920, y 120..370 = 100 % under the R14 scope; the `overhang` layer is above `floorFront` and below every `ui` / `actors` child; **at the first `pan` frame the hand's box is inside the field (y >= 120)** (A2) and **at the last `pan` frame the hand lies on the rim** (alignment with `floorFront`, R13); layers > 2048 are tiled and the tiles abut with no gap or overlap |
| `tests/scenes/battle/enemyAnimPreviewColossus.test.ts` | `&enemyAnim=loop` and `=step` drive the colossus timelines; the step label shows `enemy: frame / t` (R17) |
| `tests/scenes/battle/colossusTextures.test.ts` | texture count before a colossus battle == after it ends, and the same for a bestiary visit (R27) |
| `tests/scenes/battle/colossusAnchors.test.ts` | damage number origin = `core` clamped to y 140..740; target arrow and bracket inside the field and label y >= 124; status icon row inside y 140..760; `effectBox()` inside the field and all emitter anchors in y 124..1080 (the `fxBigBoxes` rule); melee point x <= 1250 and hero travel >= 150 |
| `tests/scenes/battle/formChangeView.test.ts` | on `formChange`: F1's `AiEnemyView` sprite is removed after `dissolve`, a `ColossusView` and the invisible proxy at `targetRect` exist after `swap` (R15); **each enumerated consumer** (actionNumbers, BattleEffects incl. `elementFlash` routed to the colossus hurt flash, BattleFieldTargeting, statusFx, BattleAnimationController, enemyAnimPreview, BattleDisplayManager with the `upgradeToArt` guard, BattleScene) gets the proxy or the colossus path; `battle:formChange` emitted at `swap` (R20); the enemy list label stays "Chaos"; targeting index 0 still selects the boss; the controller waits for the interlude end |
| `tests/scenes/battle/drawOrder.test.ts` | *(rev 4: superseded by 18.0 (no floorFront for F3))* with F3 active: party sprites, the bottom-strip windows and the message window are above the colossus in the scene graph; `floorFront` above the colossus art |
| `tests/rendering/colossusAssets.test.ts` | `colossus.json` schema; every texture <= 2048; anchors and rects inside the canvas; total RGBA bytes <= 24 MB; every form id in `enemies.yaml` with `colossus:` **and an approved master** has an entry (A5; also `assetCoverage.test.ts`, extended). Forms without an approved master yet show the placeholder box |
| `tests/scenes/bestiary/bestiaryForms.test.ts` | *(rev 4: superseded by 18.8 (the colossus preview is a still))* form records absent from the top-level list (R11); sub-entries in chain order; unseen form hidden under `mode: seen`; colossus preview at scale 1 centred within 1 px of the panel centre (the `bestiaryCentre` rule on `visibleBox`); a fixture canvas wider than 940 art px shows the rest-view crop (R22); F1 entry unchanged |
| **Regression gate (R28)** | unchanged and green at C-base and after C4: `BossPhase.test`, `BossBattle.test`, `tierHTravel`, `lungeClearance`, `fxBigBoxes`, `floatingNumberPlacement`, `enemyTravel`, `bestiaryCentre` |
| `tests/rendering/rimBackdrop.test.ts` | `rim_floor.webp` overlaps `rim.webp` pixel-exact below the horizon; alpha 0 above the horizon row |

### 9.3 Pipeline (framework owner)

*(rev 4: the binary-alpha, glow-level and palette checks below are replaced by the 18.7 checks; the tests are
rewritten, not deleted.)*

`assets-src/gen/selftest_colossus.py` covers:
- the BR ledger guard inside `bedrock.invoke` (5.1, R23)
- `colossus.py budget --check` exiting non-zero on a breach (R24)
- the `colossus` stage with no approved master: exit 0, no output change (R25)
- `pix` and the `colossus` stage deterministic under `PYTHONHASHSEED` 0 and 1 (`--out DIR` or the sha256 manifest,
  R26)
- binary alpha outside `glow`
- the 4 glow levels
- the base palette present
- layer masks covering the master exactly once (body + layers, with no gap and no overlap except declared fills)
- the bake rotation cap
- the lock mismatch reported
- `approve` refusing an overwrite without an archive

The selftest is wired into `selftest.py --anim`. `stage_backgrounds.py --check rim` exits 0.

---

## 10. Tranches, ownership, watchdog

**Ownership.**
- **Framework (FW-C):** `colossus.py`, the BR ledger, the `colossus` build stage, `retire.py --colossus`, the selftests
  and `stage_backgrounds.py`.
- **Generator (GEN):** every Bedrock call, V0, masters and approvals, and the ROSTER_LOG rows.
- **Rigger (RIG):** the layer yaml, bake, checks, review requests and lock.
- **TS battle (TS-B):** 2.2, 2.4, data and the 9.1 tests.
- **TS view (TS-V):** 2.3, 4 and 8, plus the 9.2 tests.
- **Integrator:** the orchestrator's agent. Merges, validation, docs.

At most **4 agents at once**.

| Tranche | Agents (<= 4) | Work | Exit gate |
|---|---|---|---|
| C0 | orchestrator | momus review (done: rev 2, section 17); user rulings recorded (section 15) | **done** |
| C1 (**done**, C-base) | FW-C, TS-B, TS-V (3) | FW-C: 5.1 tool + the BR ledger inside `bedrock.invoke` + `budget --check` + selftests (0 paid); `stage_rim.py` (`src_size`, `rim` profile, floor cut, `pad_bottom`); the `colossus` stage, which is a no-op with no masters (R25). TS-B: 2.1-2.2 (incl. the slam), 2.4, the 3.6 records as stubs (`colossus:` set, art missing: a placeholder box with a console warning, like missing atlas art), the R11 filters and pin updates, 9.1 tests RED -> GREEN. TS-V: the `colossus` layer, `ColossusView` + choreography + anchors + the proxy and consumer routing + the interlude player + `enemyAnimPreview` support on a **synthetic 900x520 art px fixture** in `tests/fixtures/colossus/` (R22), 9.2 tests RED -> GREEN | all three merged into `roster-int` = **C-base**; `tsc`, build, vitest, selftests green; atlas byte-identical; the R28 regression gate green |
| C2 | GEN (+ FW-C on call) | the rim source copied into the repo first; the R30 read-only identity and model list; V0 (<= 12 calls, per-row caps); stage and commit rim (0 calls) | G-C0 report + ruling: continue, or **stop and report to the user** (D-U6) |
| C3 | GEN, RIG (2) | F3 master first (the user's headline), then F2: generate -> nobg -> pix -> mock -> image-only review -> approve; RIG starts each form's layer yaml right after its approval | each master approved, logged, committed |
| C4 | RIG, TS-V, TS-B (3) | RIG: split, glow, bake, review, lock, **commit right after lock**. TS-V: real `colossus.json` wired, bestiary sub-entries. TS-B: interlude scripts, form data final, the `chaos_forms` / `chaos_final` / `chaos_interlude_*` debug scenarios (with `background: assets/backgrounds/rim.webp` and `enemyStatus` presets, R21) | `check --all` == C-base lines; `selftest_colossus` OK; forms locked; the R28 regression gate green |
| C2' (rev 4) | FW-C, TS-V, TS-B (3) | FW-C on `c2-fw2`: `upscale`, `inpaint`, `glow --method diff/lum`, despill; the `colossus.json` shape fix (18.5) and `selftest_colossus_art.py` updates; the rev-4 caps in `budget.json`; `retire.py --colossus` for the v1 masters. TS-V: linear filtering, `blend` / `alpha` from the json, sub-pixel motion, the per-layer hurt flash filter, the rev-4 timelines, the `rise`-ends-at-pan rule, the border, column-span and ring tests on a 2700x1080 fixture, the contract test, the bestiary still. TS-B: interludes on non-form phases, `chaos_crack`, F3 / F4 data (`colossus`, the anchors via the json) | merged into `roster-int`; `tsc` / build / vitest, selftests, `budget --check` green; R28 gate unchanged |
| C3' (rev 4) | GEN, RIG (2) | archive the v1 masters; **F3 first**: upscale -> nobg -> glow -> despill -> mock + side-by-side -> review -> approve -> commit; then F2 from its full-res finish (0-1 calls); then F4 `open` and F3 `crack` via inpaint on the upscaled chest, composited inside the mask (<= 8 calls) | each master approved against its original, logged, committed; calls within the 18.9 caps |
| C4 (rev 4) | RIG, TS-V, TS-B (3) | RIG: layer yaml for the painted forms (body, glow, corona, core frames), the anchors measured, place_y tuned for the ring arc, the build, **lock and commit right after lock**. TS-V / TS-B: wire the real json, the previews, the scenarios | contract and world tests green on the real json; the A5 gate |
| C5 | integrator | build `colossus` stage, section 11 validation, browser checks 11.3 | all pass/fail criteria except play test; **A5 gate: `colossus.json` has entries for all three colossus forms (F2, F3, F4) with approved masters** |
| C6 | 1 fresh play tester | section 12 | rows in ROSTER_PLAYTEST |
| C7 | <= 3 | fix round (plan, momus, fixes, re-test), balance bounds pinned | no open P0/P1 |

**C-base result (integrator, 2026-11-16, `roster-int` at 42543da + this docs commit).** The three C1 merges
(c1-fw 9f21b43, c1-tsb cf738b9, c1-tsv 71703f1) plus the R11 helper fix 42543da. Gate, each long command in the
background with its own Monitor:
- `monsters_ai` rebuilt with PYTHONHASHSEED 0 and 1: 123 sheets on 9 pages (2040x1872, 2008x1728, 2032x1200,
  2048x1536, 2048x2000, 2008x768, 2048x2032, 2048x1152, 2048x1792; all <= 2048), the act-1 sheets on page 0; seed 0
  and seed 1 byte-identical, and every page, `monsters-ai.json` and both party atlases byte-identical to HEAD.
- `colossus` stage (no approved master): exit 0, no file changed (R25); `--out` with seeds 0 and 1 writes nothing.
- `monster_anim.py check --all`: 123 `OK` lines, exit 0. `selftest.py --anim` and `selftest.py`: ALL PASSED.
- `colossus.py budget --check`: OK (Bedrock 0 of 80, Gemini 405, N_C0 405).
- `npx tsc --noEmit` 0; `npm run build` 0; `npx vitest run` 243 files, 4805 tests passed.
- R28 regression gate: the eight files are byte-unchanged since rev 3 (f009ab4) and green.
- 11.2: the BR ledger is tracked; ceilings held (ExplorationScene 601/601, BattleStateMachine 564, BattleScene 519,
  SpellExecutor 309/314, BattleAnimationController 303/308; R16: BattleDisplayManager 231, BestiaryPreview 230,
  AiEnemyView 242, BattleFieldTargeting 240, stage_backgrounds.py 249).

**Branch order.**
- C1 work happens in per-agent worktrees branched from `roster-int`, and is merged into `roster-int`; that merge is
  C-base.
- Generation runs in the main checkout (the authoritative ledgers) on `roster`, fast-forwarded from C-base before
  C2.
- Approvals are committed on `roster` and merged into `roster-int` between checkpoints.
- `roster` is not merged into `roster-int` before C-base.

**Watchdog rules (binding, as pass V rev 15).**
- A 10-minute no-progress watchdog kills agents, so keep foreground calls under 2 minutes.
- Every long command runs in the background as `<cmd> > /tmp/<agent>/<step>.log 2>&1; echo EXIT=$? >> /tmp/<agent>/<step>.log`.
  Wait with Monitor `until grep -q EXIT= /tmp/<agent>/<step>.log; do sleep 2; done` with a **timeout <= 240 s**,
  re-armed with a progress line. Never use a foreground `sleep`.
- **No self-matching `pgrep`** wait loops.
- Never two `monsters_ai` builds or two `colossus` builds in one worktree.
- **No bare `git stash`**; only `git stash push -m <label> -- <paths>` in the agent's own worktree.
- One form per `review` / `check` call.
- **Commit right after `lock`**, before anything else.
- Bedrock calls only from the main checkout by GEN; `invoke` refuses them from a linked worktree (R23).
- **One Bedrock call per checkpoint (R29):** each call runs as its own background command whose log ends with
  `EXIT=`, waited on with Monitor (<= 240 s). There are no loops of calls inside one foreground command.
- The full vitest run, the `monsters_ai` build and the `colossus` build each run in the background with their own
  Monitor (R29).

---

## 11. Validation commands

### 11.1 Commands (integrator; long ones in the background per section 10)

Every command below runs in the background as `<cmd> > /tmp/<agent>/<step>.log 2>&1; echo EXIT=$? >> ...` with
its own Monitor (<= 240 s, re-armed) (R29).

```bash
# budgets (main checkout): pass C <= 80, each purpose <= its cap, gem[N_C0:] == 0
python3 -I assets-src/gen/colossus.py budget --check            # R24
# pipeline
python3 -I assets-src/gen/selftest.py                    # main checkout
python3 -I assets-src/gen/selftest.py --anim              # worktree
python3 -I assets-src/gen/selftest_colossus.py
python3 -I assets-src/gen/monster_anim.py check --all     # == C-base lines
python3 -I assets-src/build_assets.py monsters_ai         # atlas pages byte-identical to C-base (cmp)
# colossus determinism (R26): two scratch builds, then compare
PYTHONHASHSEED=0 python3 -I assets-src/build_assets.py colossus --out /tmp/<agent>/col0
PYTHONHASHSEED=1 python3 -I assets-src/build_assets.py colossus --out /tmp/<agent>/col1
cmp -s /tmp/<agent>/col0/manifest.sha256 /tmp/<agent>/col1/manifest.sha256 && diff -r /tmp/<agent>/col0 /tmp/<agent>/col1
python3 -I assets-src/tools/stage_backgrounds.py --check rim
# TypeScript
npx tsc --noEmit && npm run build && npx vitest run
```

### 11.2 Static checks

- `git diff C-base -- assets-src/gen/approved/chaos assets-src/gen/anim/monsters/chaos*` is empty (F1 untouched).
- `git diff C-base -- assets-src/gen/approved/_retired/cosmic_beast_v1` is empty.
- Line counts of the four ceiling files and the five near-250 files (R16).
- `git ls-files assets-src/gen/cache/bedrock_ledger.jsonl` prints the path: the BR ledger is tracked (R23).

### 11.3 Browser (dev server bound to 127.0.0.1 on a free port; **every URL with `&mute=1`**)

| URL | Check |
|---|---|
| `/?mute=1&scenario=chaos_forms` | play F1 -> F4: screenshot each interlude's swap and end and each form's command phase; numbers, cursor, status icons visible; party and windows over the colossus |
| `/?mute=1&scenario=chaos_final&enemyAnim=loop` | F3 attack / cast / hurt loop; no edge exposed during shake |
| `/?mute=1&scenario=chaos_final&enemyAnim=step` | step frames: whole-px positions (label shows frame / t) |
| `/?mute=1&scenario=chaos_interlude_2&slow=4` | the F2 -> F3 rise frame by frame |
| `/?mute=1&bestiary=chaos_horizon`, `=chaos_orrery`, `=chaos` | previews centred, whole |

A **fresh reviewer**, given only the screenshots, answers four questions:
1. Is the final form the largest, most imposing thing in the game, filling the battlefield and reading as
   planet-sized?
2. Is the party readable in front of it?
3. Are damage numbers, the cursor and status icons visible?
4. Does each form read as the same being changing?

Every answer must be yes.

---

## 12. Adversarial play test and fix round

- The tester is a **fresh agent** with no plan context. It gets only AGENTS.md, the scenario ids and the URL rules
  (`&mute=1`).
- It plays `chaos_forms` at least 3 times: once winning, once losing (Retry), and once with an overkill attempt
  (high-level party) to try to skip a form.
- It plays `chaos_final`, whose `enemyStatus` preset shows the icon row (Chaos protects against status, R21).
- It opens the bestiary in `mode: seen` before and after.
- It rates findings P0-P3 in `docs/ROSTER_PLAYTEST.md` under "Pass C test". Probes:
  - a form skipped or doubled
  - an interlude stuck, or one that eats input
  - a hidden number or cursor
  - an exposed edge
  - the party unreadable
  - frame-rate drops: the dev overlay fps over the F3 loop, >= 55 on the dev machine
  - texture memory, from the PixiJS texture count before and after a battle (all released)
  - the final form failing to feel bigger than anything else
- **Fix round (C7):**
  - Plan the fixes, get a momus review, fix RED-first, then re-test with a fresh tester.
  - After 2 fix rounds with an open P0/P1, escalate to the user (NEW_MONSTER_GUIDE rule).

---

## 13. Documentation updates

- **AGENTS.md:**
  - `BossPhase.form` / `interlude`, `EnemyData.formOf` / `colossus`
  - the `colossus` layer in the draw order
  - the `colossus` build stage row
  - `colossus.py` and the BR ledger in "AI sprite generation"
  - `rim` / `rim_floor` in the backgrounds note
  - the new scenarios, and that a scenario `enemyAi` override is dropped at the first form change (R7)
  - the `slam` action and `colossusVariant`
  - the corrected `BattleScene.ts` line count
- `docs/NEW_MONSTER_GUIDE.md`: a "colossus forms" section. Bedrock is allowed for colossus masters through
  `colossus.py`. The 2026-11-13 rejection still applies to in-betweens.
- `assets-src/gen/README.md`: the new `bedrock.invoke(..., paid=, purpose=)` signature and the BR ledger.
- `docs/RETIRED_SPRITES.md`: the `--colossus` archive rule (no rows planned).
- `docs/ROSTER_LOG.md`: "Pass C" with Bedrock rows and cost.
- `docs/BESTIARY_PLAN.md`: sub-entries.
- `docs/ART_BATTLE_PLAN.md`: the rim profile.
- This plan: measured values filled into a "C results" table (form canvases, scales, coverage, memory, call count,
  cost).

---

## 14. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Stability cannot draw an original, readable horizon colossus (draws scenery, a face on a planet, or a small subject) | medium / high | V0-a with the 3.5 checklist; prompt rules 5.3; Ultra excluded; **no Gemini fallback (D-U6): if V0-a fails twice or V0-c fails at both scales, generation stops and the orchestrator reports to the user** (R2) |
| `remove_bg` eats the moons or the thin arm parts, or merges the corona into the background | medium / medium | V0-b piece comparison; moons cut from the raw by colour and re-added as their own layer; glow rebuilt (5.3) |
| The final form reads as a background, not an enemy | medium / high | per-layer hit flashes and its own shake, the cursor bracket, the core pulse, numbers on the core, the floor-front cut so it stands behind the horizon, edge contrast >= 100; reviewer question 1 |
| Party unreadable over F3's right hand | medium / medium | the right hand's art kept darker and lower-contrast behind the party band (x 1340-1600, y 300-760): a reviewed luma rule in the mock (party band contrast >= 0.8); `place` nudged if needed |
| Outpaint leaves seams, a second head or a style break, so the world-spanning canvas fails (centrepiece risk) | medium / high | V0-e before production; outpaint only the shoulders/corona (low-detail regions); S-A fallback at scale 4 or offset placement still fills the field past the edges |
| The centrepiece is cut for time | low / high | D-O13: F3 is never cut; F2, the bestiary loop, F4's variant and interlude polish go first |
| Pose consistency (multi-pose generation is unproven) | high if tried | avoided: one master per form, the runtime layers; F4 by paint if `search_replace` drifts |
| HP floor, immediate change or phase reset breaks existing boss logic | low / high | `setEnemyHp` single path with a static test; `checkBossPhases` skips form phases; the R28 regression gate unchanged at C-base and after C4 |
| Line ceilings (BSM 7, BAC 8, SpellExecutor 6 lines of headroom; BDM, BestiaryPreview, AiEnemyView, BattleFieldTargeting, stage_backgrounds.py near 250) | high / low | the per-file budget in 2.2 item 8 and 4.5; new modules named in advance; `physicalHit.ts` / `stage_rim.py` extractions decided in advance (R16) |
| Sprite consumers still read the old F1 sprite after the swap (numbers, flashes, cursor drawn at stale coordinates) | medium / medium | the proxy Container at `targetRect`, the enumerated consumer list and its test, the `upgradeToArt` guard (R15) |
| Seam-free shake: exposed canvas edges | low / medium | 60 px over-scan, 12 px floor bleed, test on every R14-scoped timeline frame |
| Texture memory / fps on weak GPUs | low / medium | <= 24 MB, art-px textures with `scaleMode: 'nearest'` scaled on the GPU, destroyed on battle end and bestiary exit with a count test (R27); fps probe in the play test |
| Rim staged bottom at y 794 leaves the bestiary panel or a shake uncovered | medium / low | `pad_bottom` and the coverage check (7.2) |
| Content filter on "end of the world" prompts (`finish_reasons` not SUCCESS) | low / low | it counts as spent; neutral wording ("vast cosmic colossus") |
| Cost overrun | low / low | the BR ledger cap of 80 inside `bedrock.invoke`, per-purpose caps; worst case $6.40 at the SD 3.5 rate, $11.20 at the Ultra rate (Ultra not used) |
| A paid call made from a worktree or a bypassing caller | low / medium | the gate lives inside `invoke` and refuses linked worktrees (R23) |
| AWS credentials are an admin / production role | low / high | read-only identity and model list first, recorded; stop and ask if the role matches Admin or Prod (R30) |
| Chaos's 6 missing spell ids make the forms' AI thinner than intended | certain / low | D-O9: design only with the 34 that exist |
| The retry snapshot restarts the long fight from F1 and annoys | medium / low | D-U8 (user): from F1; the play test reports it |
| (rev 4) Conservative Upscale invents detail or shifts colour away from the picked original | medium / high | low `creativity`; the side-by-side review; the fidelity and new-blob checks (18.7); one retry, then stop and report |
| (rev 4) The 2.5:1 render is at the upscaler's aspect limit, or remove_bg refuses 2.9 MP | medium / low | local checks before any call; pad 4 rows (0 calls); the C7 alpha upscaled offline (0 calls) |
| (rev 4) The additive halo washes out on the light arena sky | medium / high | the sky dim (D-O19); G1 keeps the full light; reviewed in the mock; the ring-arc measure |
| (rev 4) The halo ring's top arc hides under the message window | high / medium | the visible arc is measured and pinned (B2, about >= 20 %); reviewer question 2; showing more ring needs a user ruling (15.1) |
| (rev 4) A soft-alpha fringe (dark sky colour) shows on the light arena | medium / medium | despill (18.2 step 4) and the despill check |
| (rev 4) Inpaint loses identity outside the chest or makes a "laid-on" shape again | medium / medium | composite only inside the mask (byte-identical outside); the cavity review; 2 rejections in a row stop and report |
| (rev 4) Larger textures (about 21 MB) on weak GPUs | low / medium | tiles <= 2048, the glow at half res, F2 released after the swap, the fps probe in the play test |
| (rev 4) The Python / TS json drift returns | low / medium | the committed fixture and the two-sided contract test (18.5) |

---

## 15. Decisions

### 15.1 User rulings (2026-11-16, relayed by the coordinator)

| # | Decision | Ruling |
|---|---|---|
| D-U1 | Keep the pass-V sprite as F1 | **keep** (0 images, nothing retired) |
| D-U2 | Form mechanism | **M1**: one shared pool, form swaps through form-bearing `bossPhases`, plus the HP floor |
| D-U3 | Number of forms and pool | **4 forms (3 with art)**, pool **6000**, thresholds **0.70 / 0.40 / 0.15** |
| D-U4 | Form concepts and names | **as proposed** (F1 the Sovereign, F2 the Orrery, F3 the Last Horizon, F4 the Core Laid Bare) |
| D-U5 | Bedrock cap for pass C | **80 calls** (5.6) |
| D-U6 | Gemini fallback if V0 fails | **no**. If Stability fails validation, stop and report to the user |
| D-U7 | Which rim render is final | **sd35 v3 accepted as is** (`/tmp/stab2/sd35_v3_raw.png`, horizon 485, zoom 1.05, screen horizon 370) |
| D-U8 | Retry after a loss | **restart from F1** |
| D-U9 | F3 composition | **as proposed** (3.0); rev 4: the composition is the user-picked render's (outstretched arms, halo ring, rays), 18.4 |
| D-U10 | Colossus art style (2026-11-16, rev 4) | **full-resolution painted art, not pixel art**: the pixel F3 master is rejected; the look is `out/colossus/chaos_horizon/s2_st_4102_sr_4201_raw.png` (detail, colour, the halo ring and rays kept); the arena backdrop replaces the render's sky; F2 and F4 follow the same rules (section 18) |
| D-U11 | F3 placement (2026-11-16, C3') | **lower F3 a bit** so the halo ring's top arc clears the message window: rest place **(-527, -60)** (was (-527, -210)). Border rules hold (top -60 <= 114, glow only; bottom 1020 >= 786; left -527, right 2173). Visible ring arc **23.6 %** of the circle (pin **>= 20.6 %**); the top-half arc in the field rises from 21 % to 42 %. The ring's very top is cut by the source render (ring top at render y about -15) and the glow's 120 px top feather, so it stays under the window at any place_y <= 0. B4 pan limits at this rest: **dx [-247, +521], dy [-230, +174]**; chaos_i2's pan start (+480, +120) stays inside. TS owner: `src/data/interludeScripts.ts:143-144` (comment), `tests/scenes/battle/colossusContract.test.ts:30`, `colossusWorld.test.ts:27`, `ColossusView.test.ts:51-65,148-153`, `formInterlude.test.ts:97-102` and the fixtures `tests/fixtures/colossus/{colossus.json,contract.json,makeFixture.mjs}` (plus `assets-src/gen/colossus_fixture.py:51`) pin (-527, -210) and dy [-80, +324] |
| D-U12 | F4 retry (2026-11-16, C3') | up to **2 more masked inpaints** (f4_inpaint) with the reworded prompt (a deep jagged cavity split open down the centre of the stone chest, broken edges curling outward, a molten core deep inside, light spilling across the rock; negative face, eyes, mouth, teeth, skull, mask, head, figure); mask the chest band; `inpaint_merge`; review side by side with F3; stop if both fail |

**Note (rev 4, B2).** At the user-picked composition and scale 1, the halo ring's top arc lies under the message
window and its lower half behind the shoulders. The plan pins the visible arc it measures (about 20 %) and does not
move the being to show more ring. **Showing more of the ring would need a user ruling**, for example a smaller upscale
factor, a lower placement that covers more of the party, or a different composition.

### 15.2 Orchestrator rulings (the defaults, ruled 2026-11-16)

| # | Decision | Ruling |
|---|---|---|
| D-O1 | Colossus forms bypass the layout engine; new `colossus` layer between bg and ui | yes |
| D-O2 | Display scale of colossus forms | 3 (like F1); V0-c measures 2 and 3 and may switch to 2 at G-C0; scale 4 for F3 only under S-A |
| D-O3 | Free colours per form on top of the base palette | F3 24, F2 20 |
| D-O4 | Light layered animation (no rig in-betweens) | yes |
| D-O5 | Statuses kept across a form change | none (`keepStatus` empty) |
| D-O6 | Rim seam bound | <= 30 (natural rift) |
| D-O7 | Bestiary form display | sub-entries; F4 as a page of F3 |
| D-O8 | Interlude unskipped cap | 480 frames (R18 definition) |
| D-O9 | The 6 missing chaos spell ids | design the forms only with existing spells; the -3 spells are a separate content task |
| D-O10 | Fix the unwired `bossPatterns` | no (out of scope; noted) |
| D-O11 | Glow blend | additive, `glow` layer only |
| D-O12 | Enemy list label | "Chaos" for every form |
| D-O13 | Cut order if time or budget runs short | F3 is never cut or shrunk. Cut first: F2's art (F2 becomes a data form shown as F1's sprite with a tint, or is dropped and F1 goes to F3 directly), then the bestiary colossus loop (a still image), then F4's core variant (paint), then the interlude polish |
| D-O14 | F3 generation strategy | S-B (render + outpaint) if V0-e passes, else S-A |
| D-O15 | Interlude cap for `chaos_i2` (rise + reveal pan) | 600 frames (others 480) |
| D-O16 (rev 4) | Moons in F3 | none (the picked render has none; the four orbs stay in F1 and F2); the user may ask to add them as a painted layer |
| D-O17 (rev 4) | F3 resolution and display scale | Conservative Upscale to 2700x1080 (1.5x), shown at **scale 1** with linear filtering. 1:1 keeps the painting's detail with no runtime resampling and matches the planned 2700 px canvas width. A small factor lets the upscale invent least. It fits the 24 MB budget (18.6). 2x (3600x1440, about 41 MB, more of the ring off-screen) and a runtime fractional 1.5x of the 1800 render (blurs the detail) are rejected |
| D-O18 (rev 4) | F3 floor front | none (like F2): the torso continues behind the bottom strip |
| D-O19 (rev 4) | Sky dim behind F3 / F4 | `bg` multiply 0.6, reviewed in the mock |
| D-O20 (rev 4) | Glow extraction | G1 "diff" (render minus cut over the sky base), G2 luminance key as the fallback |
| D-O21 (rev 4) | Bestiary preview for colossus forms | a pre-composited still at fit size (18.8) |
| D-O22 (rev 4) | Glow storage | half res, shown at 2x linear (low-frequency light) |
| B2 (rev 4) | Ring criterion | one criterion, pinned from measurement on the approved art with a 3-point margin (about >= 20 % visible arc); ring geometry corrected (centre about render (900, 380), r about 375, band about 50 render px / 75 px at 2700); place_y tuned for party readability only |
| B3 (rev 4) | Glow at half res | a per-frame `texScale` field (`formProblems`, the build, the contract fixture and test) |
| B7 (rev 4) | Budget | `f4_variant` cap 2 (used), 2 freed to `reserve` (31); the reserve only for calls <= $0.08; the true worst case for the remaining calls is $7.60; pinned thresholds may only tighten the floors |
| Superseded (rev 4) | D-O2 (scale 3, nearest), D-O3 (palette colours), D-O14 (outpaint strategy) | replaced by D-O17 and 18.1 for colossus forms; D-O4 (light layered animation) and D-O11 (additive glow) stand |

### 15.3 Orchestrator rulings on momus's open points (2026-11-16)

| Rev | Ruling |
|---|---|
| R6 | Spell buffs persist across a form change. Phase deltas are tracked in `phaseBuffs` and subtracted on the change (2.2 item 3). |
| R7 | A scenario `enemyAi` override is dropped at the first form change, and this is documented (2.2 item 3, 2.4, 13). |
| R9 | F2 and F4 use existing knobs only (`ai.rate`, spell weights, `hits`, `attack`, `elementalProfile`). The beam is a named existing single-target black spell, and the view picks the beam timeline for single-target black damage spells. **F3 may have one scoped new mechanic: the multi-target physical slam (2 heroes)**, with its type, validator, tests and line budget (2.2 item 9). The colossus timelines are keyed by the presence of `colossus:`, not by `attackAnim`. |
| R11 | Records with `formOf` have no `num`. The listed tests exempt them through explicit `formOf` filters (updated, not deleted), and they are filtered from the top-level bestiary list from C1. |
| R15 | An invisible proxy Container sits at `targetRect` after the swap; the white flash is per layer (no `generateTexture` of the composite); `upgradeToArt` is guarded. |
| R17 | `enemyAnimPreview` gains colossus support; the loop / step rows are kept. |
| R21 | Scenarios use `background: assets/backgrounds/<id>.webp` and `enemyStatus` presets; no map-placement claims. |

---

## 16. TODOs

```markdown
## TODOs
- [x] C0: momus review (BLOCKED 2/5 -> OKAY with R1-R14); R1-R30 applied in place (rev 2, section 17); user rulings D-U1..D-U9 and orchestrator rulings D-O1..D-O15, R6/R7/R9/R11/R15/R17/R21 recorded in 15 (2026-11-16)
- [x] C1 FW-C: colossus.py (gen/nobg/pix/glow/bake/mock/review/approve/lock/budget --check); BR ledger + cap + paid/purpose gate + linked-worktree refusal inside bedrock.invoke; generate.py Bedrock path passes paid/purpose; budget.json `bedrock` block (cap 80, per-purpose caps); ledger tracked in git; selftest_colossus.py RED -> GREEN, wired into selftest.py --anim; selftest_passv.py green (high, 1d)
- [x] C1 FW-C: tools/stage_rim.py (src_size, `rim` CHECKS profile, floor-front cut with bleed, pad_bottom), imported by stage_backgrounds.py in <= 1 line (medium, 3h)
- [x] C1 FW-C: `colossus` build stage (no-op exit 0 with no masters, deterministic with --out + sha256 manifest, tiles <= 2048, memory report) + retire.py --colossus (medium, 4h)
- [x] C1 TS-B **first step (A3):** extract executePartyAttack -> src/battle/physicalHit.ts, behaviour-neutral, battle suite green (high, 2h)
- [x] C1 TS-B: enemyHp.ts single write path (5 sites, static test), bossForms.ts (floor at ceil(t*pool), pending, hook in executeNextAction + prepareRound, checkBossPhases skips form phases, crossedPhases reset, phaseBuffs, queued command re-chosen, enemyAi override dropped, FormChangeResult), slamAttack.ts with the A4 touch points (validation :43, aiPattern :18, EnemyAiAction, BattleCommand, peekNextAction 'slam', 2 damage events, crossFileValidation :452 pin), types + validators + cross-file rules, 3.6 records as stubs, R11 formOf filters + pin updates; 9.1 tests RED -> GREEN; ceilings held (high, 1.5d)
- [x] C1 TS-V: BattleLayers `colossus`, shake on colossus, ColossusView + colossusChoreography + ColossusPoseController behind EnemyActorView, anchor overrides (numbers, cursor bracket, status row, effectBox, melee point), proxy Container + consumer routing + upgradeToArt guard, per-layer hurt flash, nearest scaleMode + texture release, enemyAnimPreview support, InterludeRegistry + formInterlude (R18 timing, with: previous) + FormInterludePlayer + variant/pan steps, formChangeView + battle:formChange; 900x520 fixture; 9.2 tests RED -> GREEN; R16 line budgets (high, 2.5d)
- [x] C1 exit -> C-base: merge, tsc/build/vitest, selftests, atlas byte-identical, check --all unchanged, colossus stage no-op, R28 regression gate (high, 1h) — C-base recorded 2026-11-16 on `roster-int` (section 10, "C-base result")
- [ ] C2 GEN (first step): copy /tmp/stab2/sd35_v3_raw.png -> assets-src/backgrounds/rim-src.png (+ rim-src.json, sha256 in ROSTER_LOG) before /tmp can be lost (high, 0.25h)
- [x] C2 FW-C follow-up: `outpaint` in `bedrock.py MODELS`; `colossus.py outpaint / search_replace / structure` (`colossus_edit.py`), selftested RED -> GREEN, 0 paid (medium, 2h)
- [ ] C2 GEN: read-only identity + list-foundation-models recorded (stop on Admin/Prod), prices -> ROSTER_LOG; V0-a..e for F3 (<= 12 calls: a3 e4 b2 d2 spare1), one call per background command; report -> G-C0: continue or stop and report to the user (high, 4h)
- [ ] C2 FW-C/GEN: stage rim (entry 485 / 1.05 / 370, user-accepted, 0 calls); --check rim; rim_floor cut; commit rim.webp + rim_floor.webp (medium, 2h)
- [ ] C3 GEN: **F3 master first** (S-B render + outpaint, <= 24 gen + 10 nobg), stage mock, review, approve, commit (high, 1d)
- [ ] C3 GEN: F2 master (<= 8 gen + 4 nobg), review, approve, commit; cut first under D-O13 (medium, 3h)
- [ ] C2' FW-C (`c2-fw2`): upscale + inpaint + glow (diff/lum) + despill subcommands via bedrock.invoke; rev-4 caps in budget.json; colossus.json shape = the TS contract (frames.base / at / size / frame-relative tiles, targetRect [x,y,w,h], blend, alpha); selftest_colossus_art.py:200-204 + the 18.7 checks; committed contract fixture; retire.py --colossus for the v1 masters (high, 1d)
- [ ] C2' TS-V (+ momus B3/B5/B8): `texScale` per frame in formProblems, BattleMessage.interlude?, the sky-dim reset + skyDim.test, linear textures, blend add + rest alpha from the json (drop colossusChoreography.ts:92's 0.5), sub-pixel motion, per-layer hurt filter, painted timelines (18.3), rise-ends-at-pan, border / column-span / ring tests on a 2700x1080 fixture, colossusContract.test, bestiary still, F2 release after swap (high, 1.5d)
- [ ] C2' TS-B: interludes on non-form phases; chaos_crack (variant core crack) on F3's 0.25 phase; F3/F4 data and anchors from the json; interludes.test totals (medium, 4h)
- [ ] C3' GEN: archive chaos_horizon_v1 / chaos_orrery_v1; **F3 first**: upscale (<= 2) -> nobg (<= 1) -> glow -> despill -> mock + side-by-side -> fresh review vs the picked original -> approve -> commit (high, 1d)
- [ ] C3' GEN: F2 from f2_finish/finish.png at 1320x900 (0-1 calls), glow from o12_metal raw/nobg, review, approve, commit (medium, 4h)
- [ ] C3' GEN/RIG: F4 open + F3 crack via inpaint on the upscaled chest (<= 4 + 4), composite inside the mask, review, approve, commit (high, 1d)
- [ ] C4 RIG (rev 4): painted layer yaml (body, glow, corona, core frames), measured anchors, place_y tuned for the ring arc, build, lock, commit right after lock (high, 1d)
- [ ] C4 RIG: F3 layers/glow/bake, review (<= 4 iter), lock, commit right after lock (high, 1d)
- [ ] C4 RIG: F2 layers/glow/bake, review (<= 4 iter), lock, commit right after lock (high, 1d)
- [ ] C4 RIG/GEN: F4 core variant (search_replace <= 4 or paint), lock (medium, 2h)
- [ ] C4 TS-B: interludes chaos_i1..i3, final form data, scenarios chaos_forms / chaos_final (enemyStatus preset) / chaos_interlude_1..3 with background: assets/backgrounds/rim.webp, bestiary data + lore (medium, 4h)
- [ ] C4 TS-V: real colossus.json wiring, bestiary sub-entries + colossus preview (rest-view crop for > 940 px) (medium, 4h)
- [ ] C5: section 11 validation (each long command background + Monitor), browser checks, fresh screenshot review (4 questions), docs (13), C results table (high, 4h)
- [ ] C6: fresh adversarial play test; 'Pass C test' rows (high, 4h)
- [ ] C7: fix round if needed (plan, momus, fixes, re-test); pin balance bounds (medium, 1-2d)
```

---

## 17. Momus revisions (rev 2)

Momus verdict on rev 1: **BLOCKED (2/5)**, to become **OKAY once R1-R14 are applied**. R15-R30 were applied too. All
were applied in place. The open points were ruled by the orchestrator (15.3), and the user decisions are in 15.1.

| # | Revision | How it was applied |
|---|---|---|
| R1 | The cap is 80, not 40; the 5.6 table sums to 80; cost | 5.6 re-tabled: V0 12, F3 gen + outpaint 24, F3 remove_bg 10, F2 gen 8, F2 remove_bg 4, F4 search_replace 4, reserve 18 (F3 first, orchestrator only) = 80; `per_purpose_caps`; 6: worst $6.40 (no Ultra) / $11.20; criteria, risks and TODOs updated |
| R2 | No Gemini fallback | the fallback and hybrid branches, `--backend gemini` and every "unless D-U6" clause deleted; pass_fail `gem[N_C0:] == 0`; G-C0: V0-a fails twice or V0-c fails at both scales -> stop, report to the user (5.2); risk row updated (14) |
| R3 | V0 = 12 everywhere, per-row caps; record rulings | 5.2 / 5.6 / TODOs: a3 e4 b2 d2 spare1; D-U1..D-U9 and D-O1..D-O15 in 15 |
| R4 | `crossedPhases` reset; F1 -> F2 -> F3 test | 2.2 item 3; 9.1 `bossForms.test.ts` (F3 by a normal hit, F3's 0.25 line fires) |
| R5 | `checkBossPhases` skips form phases; `prepareRound` resolves pending first; the reach rule `hp <= ceil(t*pool)` | 2.2 items 2-3; test "HP exactly 4200 triggers" |
| R6 | Buff handling | ruling 15.3: `phaseBuffs` subtracted, spell buffs persist; tests `fast` survives F1 -> F2, F3 `hits: 4` does not leak to F4 |
| R7 | A queued Chaos command; the `enemyAi` override | 2.2 item 3: re-chosen in place by `newAi.selectAction(...)`, turn order kept, null AI -> Fight; override dropped (ruling); test |
| R8 | Hook point and line count | 2.2 item 3: `executeNextAction` after `runTurn`, before `done` (`BSM:347-354`), covers poison and `executeRound`; 2.2 item 8: hook <= 5 + 1 field + 1 `prepareRound` line <= 7; `FormChangeResult` in `bossForms.ts`; fallback extraction `executePartyAttack` -> `physicalHit.ts` |
| R9 | Mechanics within existing knobs | ruling 15.3; 2.2 item 9 (slam: type, validator, tests, `slamAttack.ts`); 2.4 (beam spell named at C1); 3.2-3.4 rewritten; validators allow only `'heavy'` (`types/index.ts:111`, `mapValidators.ts:95`) noted in 1; timelines keyed by `colossus:` (4.3) |
| R10 | Inherited / explicit fields per form | new 3.6 table: `protect`, `attackStatus`, `specials`, `size: boss` (bossTag), `xp` / `gold`, `sprite` / `colossus`, `num`, tuned stats; no implicit inheritance; data test |
| R11 | `formOf` records in roster tests | ruling 15.3; 2.2 item 1; 8; 9.1 "pins updated" row listing `rosterData.test.ts:37-41`, `rosterStats.test.ts:41-46`, `bestiaryModel.test.ts:36-44`, `EnemyLayoutAi.test.ts:200`, `schemaValidationFx.test.ts:14`, `assetCoverage` |
| R12 | Define "visible"; fix the 1.4x bound | criteria, 3.0, 4.2, 9.2: intersection with (0, 0, 1920, 780) over the canvas area = 35.6 % planned; bound >= 2688x1512 |
| R13 | Pan coverage limits and direction | 2.3: limits from the json, F3 dx [-128, +128], dy [-160, +138] art px; start (+40, -120) so the hand shows first (superseded by A2: `from: [0, -60]`); hand alignment test at the last pan frame; 3.0 and 3.3 interlude updated |
| R14 | Coverage band and scope | y 120..370 in both tests; rest / idle / attack / cast / hurt / pan frames, rise and dying exempt (criteria, 4.3, 9.2) |
| R15 | Sprite consumers after the swap | ruling 15.3; 4.4 proxy + consumer table (actionNumbers 3, BattleEffects 2 incl. `elementFlash` at `BattleEffects.ts:59-62`, BattleFieldTargeting 2, statusFx 2, BAC 9, enemyAnimPreview 5, BDM 11 with the `upgradeToArt` guard at `BDM:94`, BattleScene 1); per-layer flash (4.3); `formChangeView.test` enumerates them |
| R16 | More line ceilings | section 1 table; new 4.5 per-file budget and module names (`colossusSprites.ts`, `colossusCursor.ts`, `enemyActorView.ts`, `bestiaryColossus.ts`, `tools/stage_rim.py`); the BAC adapter counted with the interlude hook |
| R17 | Preview support | ruling 15.3; 4.3; test `enemyAnimPreviewColossus.test.ts` |
| R18 | Interlude timing | 2.3: the unskipped-time definition (message steps at the `battleTiming.ts` timer), sequential steps or `with: previous`, one total per script, input only confirm on message steps; tests |
| R19 | `pose hurt`, `variant`, swap counts | 2.3 step table; interludes test (one swap when the art id changes, zero for F3 -> F4); F4 `colossus: chaos_horizon` + `colossusVariant: {core: open}` (3.4, 3.6) |
| R20 | The SEEN event | 2.2 item 7: `battle:formChange`, emitted by `formChangeView` at `swap`, subscribed by `BattleTrigger`; `battleTriggerForms.test.ts` |
| R21 | Scenario keys, no map claims | ruling 15.3; 7.2; status probe via `enemyStatus: {0: [...]}` in `chaos_final` (12, C4) |
| R22 | Fixture size; the bestiary for big canvases | the 900x520 fixture (C1, 9.2); 8: the rest-view crop of `visibleBox` at an integer scale for a canvas > 940 art px |
| R23 | The guard inside `invoke` | 5.1: `invoke(model, body, *, paid, purpose)`, one row per logical request before the first try, serving id appended, `generate.py` passes `paid` / `purpose`, budget in `assets-src/gen/budget.json` with `selftest_passv` green, the ledger tracked in git, linked worktrees refused; selftest cases |
| R24 | The empty heredoc | `colossus.py budget --check` (selftested) in 11.1 |
| R25 | The colossus stage at C-base | 4.6: exit 0, no output change with no masters; tested at C-base |
| R26 | Determinism method | 4.6 and 11.1: `--out DIR` twice (PYTHONHASHSEED 0 / 1), sha256 manifest + `diff -r` |
| R27 | Texture lifecycle | 4.6: `scaleMode: 'nearest'`, destroyed on battle end and bestiary exit; `colossusTextures.test.ts` |
| R28 | Regression gate | criteria, 9.1 / 9.2, tranches C1 and C4: `BossPhase.test`, `BossBattle.test`, `tierHTravel`, `lungeClearance`, `fxBigBoxes`, `floatingNumberPlacement`, `enemyTravel`, `bestiaryCentre` unchanged |
| R29 | Background + Monitor per command | 10 watchdog rules; 11.1 preface; one Bedrock call per checkpoint with `EXIT=` in its log, no call loops in one foreground command |
| R30 | AWS identity record | 6: read-only `get-caller-identity` and `list-foundation-models` outputs in ROSTER_LOG; stop if the role name matches Admin or Prod |
| Mislabels | (coordinator) | 1: `SpellExecutor:279` is `executeReviveSpell`; the physical block is `executePartyAttack` (`BSM:475-490`); `dataDrivenAI(ai, spells)` at `enemyAiPattern.ts:27` |

### 17.1 Momus re-review of rev 2 (rev 3)

Verdict on rev 2: **APPROVE WITH REVISIONS**. A1-A8 were applied in place with the orchestrator's rulings.

| # | Revision | How it was applied |
|---|---|---|
| A1 | Interlude timing pinned; `chaos_i2` over its cap | ruling: the validator is pinned to message speed 3 (`BATTLE_MESSAGE_FRAMES` 90); `chaos_i2` re-timed (the 30-frame wait dropped, the pan trimmed to 120 frames) = **577 frames**, within the D-O15 cap of 600 (caps kept); each script's computed total pinned in `interludes.test.ts` (2.3, 3.3, 9.1) |
| A2 | The pan start must keep the hand visible | ruling: `from: [0, -60]`; the start rule dy in [-70, 0] art px and dx <= 0 (validator); test: at the first pan frame the hand's box is inside the field (y >= 120) (2.3, 3.0, 3.3, 9.1, 9.2) |
| A3 | Make the extraction certain | ruling: `executePartyAttack` -> `physicalHit.ts` is the **required first step** of C1 TS-B (2.2 item 8, TODOs) |
| A4 | Name the slam touch points | ruling: `enemyRosterValidation.ts:43`, `enemyAiPattern.ts:18` (weight from `1 - rate`, alongside Fight), the `EnemyAiAction` union (`enemyRoster.ts:19`), `BattleCommand`, `peekNextAction` `'slam'`, two damage events, the pin `crossFileValidation.test.ts:452` updated (2.2 item 9, tests, TODOs) |
| A5 | `colossus.json` coverage before the art exists | ruling: the tests require entries only for forms with an approved master; a C5 gate requires all three (9.1, 9.2, 10) |
| A6 | An unknown Bedrock purpose | ruling: under pass C any call whose purpose is not in `per_purpose_caps` is refused, including `generate.py`'s character-sheet path; selftest case (5.1, 5.6) |
| A7 | Two formatting errors | the `music` row moved back into the 2.3 step table; the header restored on the split line-headroom table in section 1 |
| A8 | Test wording | the `enemyHp.test.ts` row says "revive (HP 1)" (9.1) |

### 17.2 Rev 4 (user ruling: painted colossus art) and the RIG findings

| # | Change | Where |
|---|---|---|
| U-1 | The colossus forms are full-resolution painted art; the pixel F3 master is rejected; the picked render is the look | 18.0, 18.1, D-U10 |
| U-2 | `pix`, quantize, palette lock, binary alpha and the 4-level glow are dropped for colossus layers; soft alpha, full colour, linear filtering | 18.1, criteria, 9.3 note |
| U-3 | Conservative Upscale to 2700x1080, shown at scale 1 (D-O17, justified) | 18.2, 15.2 |
| U-4 | A glow layer extracted from the original (G1 diff, G2 luminance), additive | 18.2, 18.3, D-O20 |
| U-5 | The render's sky is not kept (arena backdrop), plus a sky dim | 18.0, 18.3, D-O19 |
| U-6 | Re-review against the picked original, side by side; fidelity checks | 18.7 |
| U-7 | Memory (about 21 MB), tiles, disposal | 18.6 |
| U-8 | F2 from its full-res finish; F4 / crack via masked inpaint | 18.2 |
| RIG-1 | The json shape mismatch; Python matches TS; selftest lines 200-204; contract test | 18.5 |
| RIG-2 | The additive glow, glow rest alpha, the crack variant step | 18.8 |
| RIG-3 | The pan exposed the cut bottom; geometry re-derived | 18.4 |
| RIG-4 | The glow alpha-level rule | moot (18.8) |
| B-1 | The budget re-tabled at 17 of 80 used | 18.9 |
| T-1 | Tranches C2', C3', C4; TODOs; risks | 10, 16, 14 |
| B1 | `sky_base` at a scale above the halo (opening radius >= 1.5x the band half-width, about 60 px at 2700, or a far-field fit); the tautological reconstruction check replaced by glow strength (>= 0.7 x (raw - far-field sky mean) in the annulus and the corona disc where a < 0.05) and a sky-base-clean check (inside vs outside the annulus within 4 luma); glow computed after despill | 18.2, 18.7 |
| B2 | Ring: one measured criterion with a 3-point margin (about >= 20 %); corrected geometry; place_y for party readability only; more ring needs a user ruling | 18.4, 14, 15.1 note, 15.2 |
| B3 | Per-frame `texScale` (the glow at 2) in `formProblems` (`colossusIndex.ts:99-104`), the Python build and the contract fixture / test | 18.5 |
| B4 | The pan-limit formula (border rule minus the motion envelope of every layer moving during the pan); today dy [-80, +324], dx [-247, +521]; pinned in `interludes.test` | 18.4 |
| B5 | The interlude id reaches the view as `BattleMessage.interlude?`, pushed in place of the plain line (no state-machine lines); a phase that names an interlude does not `say` its message | 18.8 row 2c |
| B6 | Stale rows marked "(rev 4: superseded by 18.x)": section 0's bestiary criterion; the 9.2 ColossusView / colossusWorld / drawOrder / bestiaryForms rows; 4.6 "about 21.2 MB" | 0, 4.6, 9.2 |
| B7 | `f4_variant` 2, `reserve` 31 (<= $0.08 calls only), total 80; the true worst case is $7.60 for the remaining calls; thresholds only tighten | 18.9, 18.7, 15.2 |
| B8 | The sky dim resets on victory, defeat, retry and the next battle start; `skyDim.test.ts` | 18.3 |
| (non-binding) | Hurt flash by an additive white copy of the body sprite; peak memory about 21 MB colossus + about 16 MB F1 atlas page | 18.3, 18.6 |

---

## 18. Rev 4: full-resolution painted colossus art (user ruling, binding)

### 18.0 The ruling and what it replaces

**User ruling (2026-11-16, relayed by the coordinator; D-U10).** The colossus forms (F2 Orrery, F3 Last Horizon, F4
Core Laid Bare) are **full-resolution painted art, not pixel art**.

The user **rejected** the approved F3 master `approved/chaos_forms/chaos_horizon/master.png`. To make it, the 1800x720
render was halved to 900x362, quantised to 17 colours and shown at 3x nearest, and `remove_bg` stripped the halo ring
and rays the user liked (*measured*: 18 colours, binary alpha; its glow 5 colours).

**The look** is `assets-src/gen/out/colossus/chaos_horizon/s2_st_4102_sr_4201_raw.png` (main checkout; 1800x720,
94,897 colours, *measured*): the C4 structure render with the C6 face removal. The plan keeps its detail, its colour,
**the great halo ring and the light rays**. Its sky is not kept: the user chose the arena backdrop (18.4).

**Superseded for colossus forms (F1 and every atlas monster are unchanged):**

| Rev-3 rule | Rev 4 |
|---|---|
| `pix`: block vote, 15-bit snap, 1 px outline, `--colors N` (5.1, 5.3a) | not used. The art keeps full 24-bit colour |
| palette lock and base palette (5.3, D-O3) | dropped. Continuity with F1 is reviewed by eye (18.7) |
| binary alpha outside `glow`; 4 stepped glow alpha levels (4.3, 9.3) | soft 8-bit alpha everywhere |
| integer display scale 3, `scaleMode: 'nearest'` (4.2, R27, D-O2) | **display scale 1** at the upscaled size (18.2), `scaleMode: 'linear'` |
| whole-px motion (4.3, 9.2) | sub-pixel motion allowed for colossus layers. Shake stays whole px |
| limb layers and the rotsprite bake (4.3, 5.4) | none for the painted forms. Whole-body motion plus light layers (18.3) |
| outpaint to reach the canvas (S-B, V0-e, D-O14) | moot. The canvas comes from the Conservative Upscale of the picked render |
| the gripping hand, `overhang`, `floorFront` for F3 (3.0, 4.1) | none: the picked render has outstretched arms and no grip; F3 draws no floor front, like F2 (D-O18) |
| the four moons in front of F3 (3.0) | none: the picked render has none; the four orbs live in F1 and F2 (D-O16) |

### 18.1 Art rules for colossus layers

- **Full colour, soft alpha.** Layers are 8-bit RGBA PNGs with straight alpha.
  - No quantization, no despeckle that removes detail, and no outline.
  - Edge **despill** is allowed: un-mix the semi-transparent band against the sky base (18.2 step 4), so no dark-sky
    fringe shows on the light arena.
- **Fidelity to the picked original** is the acceptance (18.7).
  - Offline finishing is limited to the fixes a reviewer names. Each fix is checked against the original side by side.
  - The rev-3 F3 finish (`chaos_horizon_finish.py`: the disc edge, lifted darks, rim light) is **not** carried over by
    default: it was tuned for the pixel master.
- **Textures:** `scaleMode: 'linear'`, no mipmaps (shown at scale 1, or the glow at 2x, 18.6), tiles <= 2048 px a side.

### 18.2 Pipeline per form (generator + framework; tooling on branch `c2-fw2`)

**FW-C on `c2-fw2` adds** three subcommands, all through `bedrock.invoke` with a purpose:
- **`colossus.py upscale <form> <image> --creativity C`:** Stability **Conservative Upscale** (model id confirmed
  read-only with `list-foundation-models`, R30, then added to `bedrock.MODELS`). Purposes `f3_upscale`, `f2_upscale`.
  - Local range checks before any call: the input pixel count and an aspect ratio <= 2.5:1 per the model's documented
    limits. The F3 render is exactly 2.5:1.
  - If the input is refused locally, the tool pads 4 edge-replicated rows top and bottom and crops after. This costs
    0 extra calls.
- **`colossus.py inpaint <form> <image> --mask M --prompt P --seed N`:** Stability **inpaint**
  (`us.stability.stable-image-inpaint-v1:0`, listed at R30). Purpose `f4_inpaint`.
  - The result is **composited back only inside the mask** (feather <= 8 px). Pixels outside the mask are
    byte-identical to the input (selftest).
- **`colossus.py glow <form> --raw R --cut C [--method diff|lum]`:** the glow extraction (step 3 below), offline.

**F3 (the centrepiece):**
1. **Archive first:** `retire.py --colossus chaos_horizon` -> `approved/_retired/chaos_horizon_v1/` (the pixel master,
   its glow, the crack variant, `meta.json`, the lock) and a `docs/RETIRED_SPRITES.md` row. `approve` refuses to
   overwrite without it.
2. **Upscale** the picked raw, with its sky so the cut and the glow share one geometry, to reach about 1:1 display
   (D-O17).
   - The target canvas is **2700x1080**, 1.5x the 1800x720 render.
   - The Conservative Upscale output (model-determined, expected >= 2x) is Lanczos-downscaled offline to exactly
     2700x1080.
   - If the output is narrower than 2700, the generator stops and reports. There is no runtime upscale.
   - `creativity` is low (start 0.2). One retry at a lower value is allowed if the reviewer finds invented features.
3. **Cut and glow.** `remove_bg` runs on the upscaled raw (`f3_nobg`).
   - If the 2.9 MP input is refused locally, the tool Lanczos-upscales the existing C7 cut's alpha instead (0 calls).
   - **Glow** (halo ring, rays, corona), method **G1 "diff"** (default, D-O20):
     `glow = clamp(raw - (a * cut_rgb + (1 - a) * sky_base), 0)`, where `cut_rgb` is the **despilled** cut (step 4
     runs before this step, B1).
   - **`sky_base` at a scale above the halo (B1).** It is the render's sky with the bright features removed: a grey
     opening whose radius is >= 1.5x the ring band's half-width (about 60 px at 2700 wide), then a Gaussian blur with
     sigma 40 px. Or, if the reviewer finds residual ring light, a smooth fit (low-order 2-D polynomial) to far-field
     sky samples outside the ring annulus and the rays. Either way, the halo cannot leak into `sky_base`.
   - The glow is then the light `remove_bg` removed, minus the sky.
   - Method **G2 "lum"** (fallback): `raw * smoothstep(L, t0, t1)` outside the body.
   - Pick by the glow-strength and sky-base checks (18.7) and the side-by-side review.
   - The glow's top rows get a 120 px alpha feather, because the render's top edge cuts the ring (18.4).
4. **Despill** the body's soft edge: `rgb_fg = (rgb - (1 - a) * sky_base) / a`, clamped, for 0 < a < 0.95.
   **Order (B1): sky_base, then despill (step 4), then the glow (step 3).** The numbering is kept for reference.
5. **Mock** on the rim backdrop with the party at the 18.4 placement, plus the **side-by-side sheet**: the original
   raw, and the in-game composite (body + additive glow over a sky_base-coloured plate, and over rim).
6. **Image-only review** by a fresh reviewer against the original (18.7), then approve. **Commit right after.**

**F2:**
- Archive first (`chaos_orrery_v1`).
- The master is re-made from its full-res finish, `out/colossus/chaos_orrery/f2_finish/finish.png`: 1320x900,
  196,112 colours, soft alpha (*measured*). That is already its 1320x900 screen canvas at scale 1, so **no upscale**
  (`f2_upscale` is unused unless the review asks for detail).
- Its glow comes from `o12_metal_raw.png` against `o12_metal_nobg.png` (G1).
- The rev-3 finish's offline edits stay, because they were made at full res before `CL.pix`: the eclipse disc and
  rim, the storm planet, the cleared slabs. Only the final `CL.pix` and despeckle are dropped.
- Review against the approved F2 look for identity, then approve. 0-1 calls (an `f2_nobg` re-cut only if the edges
  fail despill).

**F4 (open core) and F3's crack:**
- Done with `inpaint` on a chest crop of the **upscaled** F3 (about 900x900 screen px around the fissure), with a
  chest mask (the rev-3 `open_mask` / `crack_mask`, upscaled 3x from the 900x362 pixel masks, then smoothed).
- `open`: up to 4 calls. `crack`: up to 4 calls (purpose `f4_inpaint`).
- Each result is composited only inside the mask and stored as a `core` frame patch (18.3).
- Each is reviewed against F3 base: identity outside the mask, and a real cavity with depth and spill light (the
  rev-3 ITERATE reason).
- If 2 inpaint results in a row are rejected, generation stops and the orchestrator reports to the user.

### 18.3 Layers and animation for the painted forms

| Layer | Content | Blend | Rest alpha | Runtime |
|---|---|---|---|---|
| `body` | the despilled cut, full res | normal | 1 | breathing: dy 0 -> -4 px, sinusoidal, 144-frame loop (sub-pixel); the attack dip / slam; per-layer hurt flash |
| `glow` | the G1 / G2 extraction (halo ring + rays + corona), stored at half res and shown at 2x (18.6) | **add** | **1.0** | slow pulse 0.85 <-> 1.0 (288 frames); cast / beam flare to 1.0 plus 10 % scale-free brightening via alpha 1 and the `corona` layer |
| `corona` | the inner ring around the disc, a full-res patch cut from the glow | **add** | 1.0 | faster pulse 0.8 <-> 1.0 (96 frames); beam flare |
| `core` | chest patch frames: `crack` (F3 below 0.25) and `open` (F4); `base` is empty (the body carries it) | normal | 1 | the `variant` step |

- **Slam, whole body (no limb layers):** dip dy -12 px over 12 frames (the wind-up), hold 8, slam +8 px over 4
  frames (contact: screen shake, the 2 damage events, a glow flare), then return over 20. No rotation.
- **Hurt:** a white flash on `body`, 2 frames on / 2 off x2. Preferred (momus, non-binding): an **additive white copy
  of the body sprite** (the same texture, `tint` white, `blendMode: 'add'`, alpha 0.6) rather than a ColorMatrix
  filter, which costs a full-size render target. No
  `generateTexture`. Plus its own shake of +-3 px (whole px).
- **Dying:** a corona and glow flare to 1, the body sinks 2 px per frame and fades, then the white fade (3.4).
- **Sky dim for F3 / F4 (D-O19):** while F3 or F4 is on screen, `bg` gets a multiply tint of 0.6, set at the end of
  `chaos_i2` and reviewed in the mock.
  - **B8:** the dim resets on victory, defeat, retry and the next battle start.
  - Test: `tests/scenes/battle/skyDim.test.ts` covers each of the four, and checks that a new battle's `bg` tint is
    0xffffff. This keeps the user's arena backdrop and gives the additive halo contrast on
  its light sky.

### 18.4 F3 geometry at scale 1 (re-derived for the 2700x1080 canvas; RIG finding 3)

- **Canvas** 2700x1080 screen px (= art px at scale 1). **Place at rest** (-527, -210) (*estimate*, tuned at C3' in
  the place_y range [-210, -60], 18.7).
  - The disc centre, render (898, 340) x 1.5 = canvas (1347, 510), lands on screen (820, 300), left of the party (x
    1380-1515).
  - The arm tips, render x about 10 and 1790, land on screen about -512 and 2158: past both edges.
  - The torso's bottom (canvas row 1080) is at screen 870, behind the bottom strip (`STRIP_Y` 780).
- **Borders (RIG finding 3: the rev-3 pan exposed F3's cut-off bottom edge).**
  - The body has opaque pixels on the canvas's left, right and bottom borders, so those must stay off-screen or
    behind the strip in every frame: left <= -6, right >= 1926, bottom >= 786 (6 px shake margin).
  - The top border is glow only, feathered 120 px (18.2), and is kept at y <= 114 (behind the message window) outside
    `rise` and `dying`.
- **Pan limits (B4).** The formula, per axis, in screen px offset from rest: the border rule (each opaque border
  off-screen by the 6 px shake margin) **minus the motion envelope of every layer that moves during the pan** (the
  body's breathing, up to 4 px; the slam dip does not run in an interlude).

  | Axis | From the borders alone | Minus the envelope (today) |
  |---|---|---|
  | dx | [-247, +521] | [-247, +521] (no layer moves horizontally during the pan) |
  | dy | [-80, +324] | [-80, +324] with the 4 px breathing taken from the shake margin's side |

  - The validator computes these from the json and the choreography tables, so they are not hand-written constants.
  - `interludes.test.ts` pins today's values: **dx in [-247, +521], dy in [-80, +324]**.
  - These replace R13's art-px limits and A2's start rule for F3.
- **`chaos_i2` reveal:**
  - `rise` from_dy 700 over 120 frames, **ending at the pan's start offset**. New validator rule: a `rise` followed by
    a `pan` ends at that pan's `from`, so there is no jump.
  - Then `pan` from **(+480, +120)** to rest over 120 frames, ease out. It sweeps from the left shoulder and arm to the
    eclipse, and the left arm crosses the field.
  - The A1 total (577 frames) is unchanged.
  - Test: at the first pan frame the disc (`core` anchor) is inside the field, and every border rule holds on every
    pan frame.
- **Anchors** (screen px at rest, *estimate*, measured at C4 from the approved art):

  | Anchor | Value |
  |---|---|
  | `core` = `target` | (820, 300) |
  | `head` | (820, 200) |
  | `targetRect` [x, y, w, h] | canvas [1170, 345, 360, 495] = screen x 643-1003, y 135-630 |
  | `hands` (on-screen forearm points; the hands are off-screen) | l (120, 470), r (1260, 420) |
  | `melee` (right forearm) | (1220, 380): hero travel 160 >= 150 |
  | `feet` | (820, 740) |

- **Visible fraction:** (1920 x 780) / (2700 x 1080) = **51.4 %**. The criterion becomes <= 55 % (it was 45 %; the
  canvas height is set by the picked render's 2.5:1 aspect).
- **Halo ring (B2, corrected geometry):**
  - The ring centre is about render (900, 380), radius about 375, band about 50 render px wide. At 2700 wide
    (x 1.5) that is centre canvas (1350, 570), screen (823, 360) at rest, radius about 562, band about 75 px. Its top
    arc above y 120 hides under the message window, and its lower half lies behind the shoulders.
  - **One criterion, pinned from measurement (B2 ruling).** At C4 the visible ring arc (inside the field, not under body
    pixels with alpha >= 0.5) is measured on the approved art at the chosen place_y. The criterion is pinned **3
    points below** the measurement, expected **>= 20 % of the circle**. It is tested on the real json.
  - **place_y is tuned for party readability only** (the 14 rule), in [-210, -60]. It is not tuned for the ring.
  - Showing more of the ring would mean a different scale or composition, which needs a user ruling (15.1 note).
- **Column span:** the arms span every screen column at rest. Tested in idle, attack, cast, hurt and pan frames.
- **F2** (rev 3, measured): canvas 1320x900 at scale 1, place (40, -20), no floor front, party clear by about 110 px.
  The same border rules apply: its cut edges stay off-screen or behind the windows.

### 18.5 Data contract: `colossus.json` (RIG finding 1)

The TS reader (`src/scenes/battle/colossus/colossusIndex.ts`) is the contract. **The Python side changes to match
it.**

- **Shape:**
  - A form is `{canvas: [w, h], scale, place: [x, y], anchors, targetRect: [x, y, w, h], coverBox?, visibleBox?,
    layers}`.
  - A layer is `{name, kind, over?, blend?: 'normal' | 'add', alpha?, frames: {base: F, crack?: F, open?: F, ...}}`.
  - A frame `F` is `{at: [x, y], size: [w, h], tiles: [{file, x, y, w, h}], pivot?}`. **The tile x and y are relative
    to the frame**, and the frame's `at` is on the canvas (art px).
  - Variants are frames, keyed by the variant name.
- **`colossus_build.py`** drops `image`, `variants` and the canvas-relative tile coordinates. It writes `frames.base`
  (plus `crack` / `open`) as above, `blend` and `alpha` per layer, and `targetRect` as [x, y, w, h], refusing w or
  h <= 0 or a rect outside the canvas.
- **TS additions** (`ColossusLayerSpec`): `blend?: 'normal' | 'add'` and `alpha?: number` (rest alpha, default 1).
  `formProblems` validates both.
- **Per-frame `texScale` (B3 ruling).** `ColossusFrameSpec` gains `texScale?: number` (default 1). The frame's PNG
  pixels are `size / texScale` per side, and the sprite is drawn at `texScale`; the glow is `texScale: 2` (half-res
  storage, 18.6). `tiles` stay in **texture** px.
  - `formProblems` (`colossusIndex.ts:99-104`) checks tiles against `ceil(size / texScale)`, so the tile area equals
    the texture frame exactly.
  - `colossus_build.py` writes `texScale` for the glow.
  - The contract fixture gains a `texScale: 2` glow frame, and the contract test checks it.
- **Tests:**
  - **`selftest_colossus_art.py:200-204` updated:** assert `frames["base"]["tiles"]` with frame-relative tiles,
    `targetRect == [x, y, w, h]`, the glow `blend == "add"` and `alpha == 1.0`, and no `image` / `variants` key.
  - **Contract test, both sides:**
    - `colossus_build.py` writes the fixture form into the committed `tests/fixtures/colossus/colossus.json`
      (regenerated by the selftest, which fails if it differs from the committed file).
    - The new `tests/scenes/battle/colossusContract.test.ts` reads it through `formProblems` and expects zero
      problems, a `base` frame per layer, the glow `blend: 'add'`, and the tiles abutting inside their frame.

### 18.6 Textures, memory and disposal

| Form | Layer | Stored size (px) | RGBA MB | Tiles |
|---|---|---|---|---|
| F3 | body (cropped to rows 360-1079) | 2700 x 720 | 7.8 | 2048 + 652 wide |
| F3 | glow (half res, shown at 2x linear) | 1350 x 540 | 2.9 | 1 |
| F3 | corona patch (full res) | about 700 x 700 | 2.0 | 1 |
| F3 / F4 | core `crack`, `open` patches | about 600 x 600 each | 2.9 | 1 each |
| F2 | body (cropped) | about 1320 x 850 | 4.5 | 1 |
| F2 | glow (half res) | 660 x 450 | 1.2 | 1 |
| **Total** | | | **about 21.3** | |

- The criterion is <= 24 MB, measured by the build. A larger approved crop needs an orchestrator ruling; size is
  never cut to fit the budget.
- **Loading:** `BattleArt.ensureColossus` loads all forms of the chain at battle start, so the peak is about 21 MB
  of colossus textures plus the F1 atlas page (about 16 MB, a 2048x2048 RGBA page), about 37 MB.
- **Release:** F2's textures are released right after the F2 -> F3 `swap`, because the chain never returns to F2.
  Everything is destroyed on battle end and bestiary exit (`colossusTextures.test.ts`, R27).
- `rim_floor.webp` stays committed but is not loaded by any colossus form (no floor front, D-O18).

### 18.7 Review and checks (re-review against the user-picked original)

- **Side-by-side review (fresh reviewer, image-only).** The sheet shows the original raw (1800x720), the in-game
  composite at rest (on rim with the party, after the sky dim) and a 1:1 detail crop (disc, ring, a shoulder).
  Questions:
  1. Are the detail and colour kept?
  2. Is the halo ring and its rays present and strong?
  3. Is anything invented by the upscale?
  4. Does it read planet-sized and is the party readable?
  5. Any fringe?

  The verdict is SHIP / SHIP WITH NITS / ITERATE, with at most 4 iterations per form.
- **Offline checks in `selftest_colossus_art.py`.** The thresholds are *estimates*, pinned after the first
  measurement with margin. **B7 ruling: a pinned threshold may only tighten the floors written here, never loosen
  them.**
  - **body fidelity:** the final body, Lanczos-downscaled to 1800x720, against the raw inside `a >= 0.9`: PSNR >= 30 dB
    and mean CIE76 delta E <= 3
  - **glow strength (B1; it replaces the tautological reconstruction check):** inside the measured ring annulus and the
    corona disc, wherever a < 0.05, the mean glow luminance is >= 0.7 x (raw luminance - the far-field sky mean)
  - **sky base clean (B1):** the mean `sky_base` luma just inside the ring annulus and just outside it differ by
    <= 4 luma (0-255), so no halo leaked into the sky base
  - **despill:** the mean luminance of the 0 < a < 0.95 band is >= the interior mean minus 20 %
  - **upscale:** the output size, and no new connected bright blob over 0.1 % of the canvas absent from the
    nearest-upscaled raw
  - **inpaint:** byte-identical outside the mask
  - **tiles:** <= 2048 and abutting; the memory sum is <= 24 MB
  - **determinism:** under `PYTHONHASHSEED` 0 and 1 (R26)
- **TS tests (9.2, updated, not deleted):**
  - `ColossusView.test`: `scaleMode: 'linear'`, finite positions, shake whole px, the glow `blendMode` `'add'` from
    the json, rest alpha from the json (RIG finding 2: today `colossusChoreography.ts:92` hard-codes 0.5)
  - `colossusWorld.test`: canvas width >= 2688; the column span; the border rules on every R14-scoped frame and every
    pan frame; visible fraction <= 55 %; the ring-arc measure on the real json, pinned per B2
  - `interludes.test`: `rise` ends at the next `pan`'s `from`; F3 pan limits from the json; the `chaos_crack` total
    pinned
  - `colossusContract.test` (18.5)

### 18.8 Fixes from the RIG agent's findings

| # | Finding | Fix |
|---|---|---|
| 1 | `colossus_build.py` writes a json shape the TS reader rejects (`frames.base` with `at` / `size` / frame-relative tiles; `targetRect` [x, y, w, h]) | 18.5: Python matches TS; `selftest_colossus_art.py:200-204` updated; contract test |
| 2a | No additive blend on the glow layer in TS | `ColossusView` sets `blendMode = 'add'` from the layer's `blend` |
| 2b | Glow alpha 0.5 at rest | rest alpha from the json (glow 1.0), pulse 0.85-1.0; the constant at `colossusChoreography.ts:92` is removed |
| 2c | No step shows the `crack` variant | non-form phases may name an `interlude` (validator). **B5:** the interlude id reaches the view through the existing message list. `checkBossPhases` pushes a `BattleMessage` with `interlude?: <id>` **in place of** the plain line, adding no state-machine lines. A phase that names an interlude does not `say` its message itself; the interlude shows it as its `message` step. F3's 0.25 phase gets `interlude: chaos_crack`: shake x1, flash white 4, `variant {layer: core, frame: crack}`, then the phase message. There is no `swap`; the total is pinned in `interludes.test`. F4's `colossusVariant: {core: open}` then shows `open` |
| 3 | The pan start exposes F3's cut-off bottom edge (canvas 362 rows, not 520) | 18.4: geometry re-derived for 2700x1080 at scale 1; border rules; new pan limits and start; `rise` ends at the pan start |
| 4 | The glow alpha-level rule fails on the extracted glow | moot: soft alpha is allowed (18.1); the selftest's 4-level check is replaced by the 18.7 checks |

- **Bestiary (replaces 8's colossus preview):** the build writes a pre-composited **still** per colossus form,
  `preview.png`: body + additive glow over the matching crop of `rim.webp` with the sky dim, Lanczos-fit offline into
  940x720 and opaque. `BestiaryPreview` shows it centred at scale 1 (D-O21).

### 18.9 Budget (Bedrock 17 of 80 used, *measured* in ROSTER_LOG; caps re-tabled, sum 80)

| Purpose | Used | Cap (rev 4) | Planned in C3' |
|---|---|---|---|
| `v0` | 9 | 9 (closed) | 0 |
| `f3_gen` | 0 | 12 | 0 (only if the user asks for a re-render) |
| `f3_upscale` (new) | 0 | 6 | 1-2 |
| `f3_nobg` | 0 | 4 | 0-1 |
| `f2_gen` | 0 | 2 | 0 |
| `f2_upscale` (new) | 0 | 2 | 0 |
| `f2_nobg` | 1 | 4 | 0-1 |
| `f4_variant` (search_replace, closed route) | 2 | **2** (closed; 2 freed to `reserve`, B7) | 0 |
| `f4_inpaint` (new: open + crack) | 0 | 8 | 2-8 |
| `reserve` | 5 | **31** | 0 (orchestrator only, F3 first; **only calls costing <= $0.08: no upscale from the reserve**, B7) |
| **Total** | **17** | **80** | **about 3-12, ending at about 20-29 of 80** |

- **Cost** (*estimate*, confirmed from the Bedrock pricing page at the first call and logged): Conservative Upscale
  is about $0.25-0.40 per call, inpaint and remove_bg about $0.04-0.08.
  - The planned C3' spend is about $1-2.
  - **The true worst case for the remaining 63 calls (B7):** the upscales can only come from `f3_upscale` (6) and
    `f2_upscale` (2), at most 8 x $0.40 = $3.20. Every other remaining call (55: `f3_gen` 12, `f3_nobg` 4, `f2_gen` 2,
    `f2_nobg` 3, `f4_inpaint` 8, `reserve` 26) costs <= $0.08, at most $4.40. That totals **$7.60**, about $8.50 with
    the $0.9 already spent.
  - If the confirmed upscale price is p, the worst case is 8p + $4.40.
  - Spent so far: about $0.9.
- `budget.json` gets the new caps in one commit. `selftest_passv` and `budget --check` must stay green, and the A6
  rule (an unknown purpose is refused) covers `f3_upscale`, `f2_upscale` and `f4_inpaint` only once they are listed.

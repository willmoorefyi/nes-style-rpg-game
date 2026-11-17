# Kneel / dazed pose plan (pass K), rev 4 (final)

Status: rev 4, final. Rev 2 answered the momus review of rev 1 and the user rulings R1 and R2, rev 3 the narrow
rejection of rev 2, and rev 4 the last momus fixes (text only). Nothing here is implemented yet; K1 is next.

**Rev 4 changes (final momus fixes):**

| Finding | Resolution |
|---|---|
| r4-1 (P1) | The hero `rise` flag now has a caller. `BattleAnimationController.ts` gets one edit at :148, passing `{rise}` from the new `display.isRising(sprite)` into `advanceAt` and `castAt`: <= +3 lines, so 303 becomes <= 306 of its 308 ceiling. The signature is corrected to `advanceAt(style, t, reach, opts)` (D-K3). |
| r4-2 (P2) | Captures use `?battleStep=1` (time frozen scene-wide, no preview) plus a new dev label `&poseLabel=1` that reuses the preview's `labelText` format without the loop (sections 6, 8, 10). |
| r4-3 (P3) | The hero `castAt` (a 36 px step over frames 0-14) gets the same `rise` option, with E 14 against the effect at 24. The "in place" claim is removed. |
| r4-4 (P3) | New E-table row: heavy with n = 0 (Chaos F1 as a titan): E 24, contact 29. Frame names, the `hold` cue and `holdFrame` run on raw t; only the offsets are remapped. |
| r4-5 (P3) | Today's act-1 peak is corrected to 48.5 MB (page 0 is 15.3 MB), so the delta is +4.1 MB. Every peak figure is labelled an upper bound, with the `recent` pages caveat. |
| r4-6 (P3) | The hero shake is +-2 px for 12 frames and the enemy's +-3 px for 14 frames; "the same as the enemy" is removed. |

**Rev 3 changes (momus review of rev 2):**

| Finding | Resolution |
|---|---|
| r3-1 (P1) | D-K17 now follows the real party action order: step_forward, effect, every result line including the poison line, step_back (16 frames), then completeAction clears the override. The poison damage on an override pose gets a pivot shake summed with the tremble, with no flash. `in` starts after the walk back. `BattleAnimationController` is untouched, and the statusIntegration test is rewritten to match. |
| r3-2 (P2) | Option 1 is chosen (D-K3): the movement is held at 0 for the 6 rise frames, then remapped into the rest of the motion window, which ends at or before contact. This is done in the pure tables (`attackChoreography.ts`, `enemyAttackTables.ts`), so every contact frame stays where it is. |
| r3-3 (P2) | The act-1 pages are pinned in `MonsterPages`: they do not count against `PAGE_CACHE` and are never evicted. Their resident cost is 19.8 MB. The peak is restated as pinned + (h + 2) x 16.4 MB and compared with today. The "never stream" claim and R6 are corrected. |
| r3-4 (P3) | D-K18: a change to `kneel.py`, `kneel_checks.py` or `puppet_kneel.py` re-runs `check --all` plus `puppet_kneel.py check` on every locked class. `puppet_kneel.py` is added to the template-owner files. |
| r3-5 (P3) | New D-K2 row (e): a status-only poison (no damage, so no flash) starts `in` at its impact, with a test. |
| r3-6 (P3) | The pilot and K4 screenshots are deterministic: round-1 commands are scripted to target the control enemy, and mid-attack captures use frame stepping (rev 4: `&battleStep=1&poseLabel=1`, not `enemyAnim=step`). |
| r3-7 (P3) | Section 6: `trembles` flags for `AiEnemyView.update` / `setPosture` and `EnemyPoseController.state`; shake plus tremble summed in pivot.x; an enemy action with no pose (`startEnemyLunge` false, e.g. items) stays kneeling, accepted. |

Budget: **0 paid images**. No Gemini, no Bedrock and no other AI image call anywhere in pass K. Every new frame is a
cut-out re-pose of approved pixels, like the existing in-betweens.

**Rev 2 changes:**

| Finding / ruling | Resolution |
|---|---|
| R1 = no (enemies never kneel at low HP) | enemy low-HP path deleted; enemies kneel from status only (D-K1) |
| R2 = yes (poison kneels, both sides) | new posture `kneel` for poison, new rank, additive tremble (D-K1, D-K16); acting kneelers rise to act on both sides, so the enemy attack / cast / travel tables get the rise (D-K3); poison tick timing (D-K17); tests (section 7); a poisoned goblin attacks in the pilot (section 8) |
| #1 | moot under R1 (enemy low-HP kneel removed) |
| #2 | K2-0 probe round (iron_golem, blue_dragon, hydra, garland) reviewed by the orchestrator before K2; template-fix path (D-K18, section 9) |
| #3 | K4 uses 3 named party scenarios x 2 named enemy formations, each with what its screenshot must show (section 10) |
| #4 | D-K2 rows (a) to (d): battle start / retry already kneeling, the ACTIVE_STEP, revive into weak HP, a hit to weak; partyPose tests for each |
| #5 | one cap for `kneel_in1` / `kneel_in2`: limb parts <= 40 deg; `ROT_CAP` kept unchanged (D-K19) |
| #6 | hero CLI, lock verb and rotsprite renderer all live in `puppet_kneel.py` with its own `__main__`; `puppet.py` is unchanged (0 lines) |
| #7 | page cost restated: which act-1 sheets spill, preloading of act-1 pages, peak resident memory; R4 / R6 rewritten (section 1, D-K13) |
| #8 | per-class hero bands printed; per-class override logged in section 13 (section 4) |
| #9 | one runtime fallback path; `hasKneel` from texture identity (D-K7, D-K15) |
| #10 | K1 commits the atlases; rollout agents never do; only the integrator rebuilds them (section 9) |
| #11 | BattlePartyPanel reference and the HP-roll note; the stale stoneTextures note removed; icons, overlays and the active-hero arrow follow the kneeling head; `drop` renamed `sink`, in-between tweaks allowed; line projections; the 2880 px hero atlas accepted; G10 and G12 concrete; victory rise length |

## 0. Summary

In FF1 a weakened or disabled actor shows a **kneel** pose. This game shows something else: a dazed enemy plays a
small slump (`daze` / `daze_b`), and a dazed hero holds `ready`. Pass K adds one kneel state, with transition-in,
a held kneel with a small breath and transition-out, for **all 123 rigged monster sheets** and **all 12 hero
classes**. The Chaos colossus forms F2 to F4 are exempt.

Who kneels:

- **Heroes:** sleep, stun, poison, or weak HP (25 % or less).
- **Enemies:** sleep, stun or poison.
- **Acting kneelers** (poison, and weak heroes) rise to act and then kneel again.
- **Disabled kneelers** (sleep, stun) never act.

Tranches:

- **K1:** the shared tooling, the TS runtime and a pilot (goblin, wolf, warrior, white_mage).
- **U1:** the user reviews the pilot.
- **K2-0:** the orchestrator reviews the risky-body probes.
- **K2:** the rollout of the bodies the pilot proved.
- **K3-0 / U2:** probes of the new body templates, then a second user review.
- **K3:** the rest of the rollout.
- **K4:** integration and the play test.

The key design choice is D-K4. A kneel is too far from any approved key for the existing in-between rules. So each
sheet gets a **derived `kneel` key**, built from the idle key by joint targets and locked as `kf:kneel`. The
in-betweens between `idle` and `kneel` then follow the normal rules.

## 1. Current state (verified at a97ae69)

| Fact | Where |
|---|---|
| `sleep` and `stun` have `posture: daze`; `stone` is `stone`, `fear` is `tremble`, `frozen` (reserved) is `still`; `poison` has no posture (tint, bubbles, icon) | `assets/data/status-visuals.yaml:23,28,46-51` |
| Posture rank: stone 4 > daze 3 > still 2 > tremble 1, strongest only. A slept, feared actor does **not** tremble today. | `src/scenes/battle/fx/statusRules.ts:15-30` |
| A dazed enemy sways `daze` / `daze_b` every `DAZE_PERIOD` 48 | `enemyChoreography.ts:158-175` |
| **Every one of the 123 sheets has its own `daze` / `daze_b` cells** (pass F recipe: t 0.15 toward `hurt`, legs pinned, head 1 px down). The `FRAME_FALLBACK daze -> hurt_in1` (`:34`) applies only to an old atlas or a held frame; the `LATE_FRAMES` comment (`:18-21`) is stale. | atlas json; `monster_recipes.py:51-54` |
| Why the daze is small: the t 0.25 draft failed 9 of 12 rigs (30 deg cap, bent shins, the bbox band) | `monster_recipes.py:47-50` |
| Enemy pose cursor per enemy; `setPosture` comes from the presented snapshot every frame; contact frames: in-place attack 14, plain cast 11, boss cast 10 (all > 6) | `EnemyPoseController.ts:105-110,211-221`; `enemyChoreography.ts:52-107` |
| Hero pose: hp <= 0 shows `down`; stone or still `ready`; daze `ready` (`hurt` while flashing); then victory, override, hurt, breath | `BattleDisplayManager.ts:172-182` |
| Command input snaps the active hero `ACTIVE_STEP` = 24 px forward (`sprite.x = homeX - 24`); its arrow is placed once at `sprite.y - 20` (the cell top) | `ActiveHeroMarker.ts:5,35,39` |
| Status icons and overlays anchor on `headOf(current texture)`, the first opaque row, read every frame, so they already follow whatever frame is shown | `fx/statusFx.ts:200-208` |
| Poison hurts at the **end** of the actor's turn, after its action, shown with its own line (a hold) | `src/battle/turnTick.ts:1-36` |
| **Party action order:** announce -> `step_forward` (the advance, posed frame by frame) -> `effect` -> `result`, where every result line is shown and its holds are presented, the end-of-turn poison line included -> `step_back` (`RETURN_FRAMES` 16) -> `completeAction`, which is the only place the pose override is cleared. Enemies skip `step_forward` / `step_back`, and their action completes when `enemyStillAttacking()` is false. | `BattleAnimationController.ts:136-192,245-258,293` |
| An enemy action without a pose (`startEnemyLunge()` false, e.g. an item) goes straight to `execute` | `BattleAnimationController.ts:138,273` |
| Movement from frame 0: the heavy attack's travel phase moves and hops from frame 0, and the hero `dash`, `leap` and `classic` styles move from frame 0 (`lunge` steps back from frame 0) | `enemyAttackTables.ts:37-60`; `attackChoreography.ts:46-68` |
| There is no Defend command; dev frame stepping exists: `?battleStep=1` or `?enemyAnim=step` freezes time and `.` advances one frame (scene-wide); `enemyAnim=step` adds the `enemy: frame / t` label | `battleDevClock.ts:5-42`; `enemyAnimPreview.ts:1-12` |
| Battle HP colour: red at `ratio <= 0.25`; the number and bar **roll** over `HP_ROLL_FRAMES` toward the presented HP | `BattlePartyPanel.ts:17,33-34` |
| Hero atlas: 12 rows x 14 columns, 2240x1920 px; all 12 classes have joint files (ready / attack / cast); 5 are `robed` (no leg parts) | `battle-characters-ai.json`; `anim/*.yaml`; `build_assets.py:88-129` |
| The approved hero `down` is a collapsed crouch at 0.63 to 0.77 of `ready` height (warrior 44/68, white_mage 51/66) | measured; section 4 |
| Heroes have no lock files and only `puppet.check` | `puppet.py:441-452` |
| Rigs: biped 49, quadruped 28, floating 14, serpent 8, arthropod 7, bird 5, naga 5, blob 4, rooted 2, swimmer 1 = 123. Mechanical preset (cap 15): iron_golem, soldier, warmech (bipeds) and guardian (quadruped). Cloth: garland, lich, mummy. fx: garland, lich, hollow_seraph. FW-Q partial: astos, black_widow, chimera, crawler. 25 sheets at display scale 3. | rig files; atlas json |
| `lock_match` fails a new unlocked frame and a lock entry with no frame | `anim_rules.py:56-60` |
| Anchors `homeX` are measured over `HOME_FRAMES`, which include `daze` | `monster_atlas.py:39` |
| **Page loading:** `BattleArt.load()` loads the index and **page 0 only**; other pages load on `ensure(formation)` (awaited by `BattleTrigger`) and are held while in use; `MonsterPages` keeps at most `PAGE_CACHE` = 2 **unheld** pages (LRU) | `BattleArt.ts:198-215`; `MonsterPages.ts:13,16-23` |
| Line counts: `EnemyPoseController.ts` 248, `AiEnemyView.ts` 242, `CharacterAtlas.ts` 237, `BattleDisplayManager.ts` 231, `BestiaryPreview.ts` 230, `BattleArt.ts` 228, `statusFx.ts` 214, `enemyChoreography.ts` 180, `ActiveHeroMarker.ts` 81, `BattleAnimationController.ts` 303 / 308 (<= 306 after K1), `BattleScene.ts` 539 / 594; Python `monster_anim.py` 326, `puppet.py` 540 | `wc -l` |
| Test baseline: `npm test`: 258 files, **4962 tests**, all passed (run 2026-11-16) | |

**Measured page cost** (the real `monster_pages.pack_pages`, today's group order, k extra cells per sheet):

| k | pages | act-1 sheets off page 0 | act-1 pages (RGBA MB) | largest page (MB) |
|---|---|---|---|---|
| 0 (today) | 9 | none | page 0: 15.3 | 16.6 |
| 2 (R4: daze retired, +4 kneel -2 daze) | 10 | **vampire, wolf** -> page 1 | 16.3 + 1.3 | 16.4 |
| 4 (this plan) | 12 | **skeleton, troll, vampire, wolf** -> page 1 | 16.4 + 3.4 | 16.4 |

So under this plan the pilot wolf, plus skeleton, troll and vampire, live on page 1. Without a change, a battle
with them would stream page 1 at `ensure`. D-K13 **pins** pages 0 and 1.

**Peak resident monster-atlas memory: upper bounds.** h = the pages held by the current battle that are not pinned;
the LRU keeps 2 unheld, unpinned pages; every page is counted at its maximum (<= 16.4 MB in the plan, <= 16.6 today;
today's page 0 is 15.3). These are upper bounds: `MonsterPages.trim()` also keeps the `recent` pages (those the
latest `ensure` asked for), and those are counted in h here. Actual residency is at most these figures and usually
lower.

- **Plan:** pinned 19.8 + (h + 2) x 16.4 MB.
  - An act-1 battle (h = 0) is **<= 52.6 MB**.
  - A battle on one other page (h = 1) is **<= 69.0 MB**; h = 2 is <= 85.4 MB.
- **Today** (page 0 is not pinned, so it is one of the held or LRU pages):
  - An act-1 battle (page 0 held, 15.3, plus 2 LRU pages x 16.6) is **<= 48.5 MB**.
  - A battle on one other page (1 held plus 2 LRU, x 16.6) is <= 49.8 MB; h = 2 is <= 66.4 MB.
- **Difference (upper bounds):** **+4.1 MB** for an act-1 battle, and +19.2 MB for a battle elsewhere (the pinned
  pages stay resident next to the LRU).

The "all pages" sum (146 MB) is never resident.

## 2. Decisions

R = the user's ruling. Defaults hold until the user rules.

- **D-K1 Triggers (R1, R2 ruled).** These use the presented snapshot.
  - Heroes kneel at posture `daze` (sleep, stun: disabled), posture `kneel` (poison: acting) or weak HP
    `hp > 0 && hp * 4 <= maxHp` (acting).
  - Enemies kneel at posture `daze` or `kneel` only. There is no enemy HP path.
  - An actor is **disabled** if it has a `daze` status, otherwise **acting** if it kneels at all.
- **D-K16 Posture data (R2).** `STATUS_POSTURES` gains `kneel` (`types/fxData.ts`, `schemaValidationFx.ts`), and
  `status-visuals.yaml` gives `poison: {posture: kneel}`, keeping its overlay, tint, pulse, icon and tag.
  - New rank: stone 5 > daze 4 > still 3 > **kneel 2** > tremble 1 > none. So sleep plus poison is a disabled kneel,
    and frozen plus poison holds `ready`.
  - Fear becomes **additive**: a new `trembles(statuses, visuals)` in `statusRules.ts` is true when any status has
    `posture: tremble`, and the tremble offset applies whenever the posture is not stone or daze (a poisoned, feared
    actor kneels and trembles).
- **D-K2 Priority (first match wins).**

  Heroes:

  | # | Condition | Shows |
  |---|---|---|
  | 1 | hp <= 0 | `down` |
  | 2 | stone / still | `ready` (grey for stone); the kneel is cut at once |
  | 3 | disabled kneel (daze) | kneel track; never acts; a hit shakes the kneel (no `hurt`); victory does not lift it |
  | 4 | victory | an acting kneeler rises (`kneel_in2` 3, `kneel_in1` 3 = 6 frames), then `victory` |
  | 5 | action override | an acting kneeler rises inside the first 6 override frames (D-K3) |
  | 6 | `hurt` flash | standing heroes only; a kneeler shakes +-2 px for 12 frames instead |
  | 7 | acting kneel (poison / weak) | kneel track |
  | 8 | otherwise | breathing idle |

  Added rows (momus #4):

  - **(a) Battle start or retry with a kneeler:** the track is created **in hold**. No `in` plays during the intro,
    and a retry restores the snapshot the same way.
  - **(b) Command input:** a kneeler **stays kneeling** and snaps the 24 px `ACTIVE_STEP` forward as today. It does
    not rise and does not slide (the step is a snap, not a motion). The arrow follows the head (D-K20).
  - **(c) Revive:** from `down` into a kneel trigger (revived to weak HP, or still poisoned), go to `kneel` in hold
    directly, with no `ready` frame and no `in` (`down` is already a crouch). Revived above the trigger, play the
    rise (`kneel_in2` 3, `kneel_in1` 3) from `down` to `ready`.
  - **(d) A hit that makes a standing hero weak (or poisons one):** the 24-frame `hurt` flash plays first; `in`
    starts on the frame the flash ends. If the hero is already kneeling, only the shake plays.
  - **(e) A status-only poison** (a spell or effect with no damage, so no `flashHurt`): `in` starts on the frame its
    impact is presented, for heroes and enemies alike. There is no flash and no shake.

  Enemies:

  | # | Condition | Shows |
  |---|---|---|
  | 1 | dying | keeps the kneel frame on screen while it eases and fades; no `hurt` frames |
  | 2 | stone | cut at once |
  | 3 | attack / cast | an acting kneeler rises inside the first 6 frames (D-K3) |
  | 4 | hurt | a kneeler shakes +-3 px for 14 frames on its kneel frame |
  | 5 | kneel (daze or poison) | kneel track |
  | 6 | otherwise | breathing idle |

  The tremble offset is applied per D-K16. Rows (a) and (c) apply to enemies too: an `enemyStatus` preset starts
  in hold; there is no enemy revive.
- **D-K3 Rising to act** (heroes and enemies, the same mechanism). For the first `KNEEL_OUT_FRAMES` = 6 frames of an
  action on an acting kneeler, the frame name is replaced by `kneel_in2` (3), then `kneel_in1` (3).
  - **Movement during the rise: option 1 (hold, then compress) is chosen**, because every table has room for it
    before contact, so contact timing is exactly kept. The knee-slide (option 2) is the fallback only for a table
    that cannot fit.
  - For a rising actor, the table's motion (dx, dy, travel progress k, hop) is held at its frame-0 value for t < 6.
  - The motion window is [0, E), where E is the first segment / phase boundary at or after frame 12, and E must be
    <= the contact frame. Over [6, E) the table is sampled at the remapped time t' = (t - 6) x E / (E - 6). From E
    on, everything is unchanged.
  - Measured E against contact:

    | Table | E | contact |
    |---|---|---|
    | hero `lunge` (segments 9 / 9 / 6) | 18 | 24 |
    | hero `dash` (10 / 5) | 15 | 15 |
    | hero `leap` (6 / 16 / 6) | 22 | 28 |
    | hero `classic` (15) | 15 | 15 |
    | enemy in-place (5 / 6 / 3) | 14 | 14 |
    | enemy melee | wind + N | 14 + N |
    | enemy heavy (N >= 10) | N, or N + the raise-in when N < 12 | N + 29 |
    | enemy heavy, n = 0 (Chaos F1 as a titan: phases 6 / 18 / 3 / 2) | 24 | 29 |
    | hero `castAt` (a 36 px step over frames 0-14) | 14 | 24 (the effect) |

    The enemy boss and plain casts (`enemyChoreography.castAt`) have no motion (dy 0), so nothing is remapped.
  - **Only the offsets are remapped:** dx, dy, k and hop. Frame names, the `hold` cue, `holdFrame`, the `contact`
    cue and every phase boundary run on **raw t**. In the heavy n = 0 row, the telegraph's pulse and cue keep their
    frames.
  - Where it lives:
    - In the pure tables: `advanceAt(style, t, reach, {rise})` and `castAt(t, {rise})` in `attackChoreography.ts`,
      and `travelAttackAt(kind, t, {..., rise})` in `enemyAttackTables.ts` (plus `attackAt` in
      `enemyChoreography.ts`).
    - The frame-name swap is in `partyPose.ts` (override age < 6) and in `EnemyPoseController.raw()`.
  - **Hero caller (the one controller edit):** `advanceAt` and `castAt` are called only from
    `BattleAnimationController.ts:148` (`step_forward`, through `placeActor`). That line gets
    `{rise: this.display.isRising(this.animActorSprite)}` passed into both calls.
    - `BattleDisplayManager.isRising(sprite)` is true when the member's current override began from an acting kneel
      (latched at override start).
    - Budget: <= +3 lines, so the file goes from 303 to **<= 306 of its 308 ceiling**.
    - Nothing else in `BattleAnimationController.ts` changes.
  - The tests assert, for every style and table, that contact frame indices are equal with and without `rise`.
  - If a table cannot meet E - 6 >= 6 and E <= contact, the knee-slide is accepted for it and verified in
    `goblin_rise.gif` (K1) and with garland (K2-0). None is expected.
  - When the action ends (override cleared in `completeAction`, or the enemy mode back to idle) and the trigger still
    holds, `in` starts at once.
  - An enemy action with no pose (`startEnemyLunge()` false, e.g. an item) **stays kneeling**, with no rise. This is
    accepted.
- **D-K17 Poison timing** (real order, `BattleAnimationController.ts:136-192,293`). `turnTick` keeps poison damage at
  the end of the turn.

  **Hero:**

  1. `step_forward` with the rise and the action poses.
  2. `effect`.
  3. `result`: every result line in order. The end-of-turn poison line is one of them; it is presented through its
     hold **while the hero is still at the target holding the override pose**.
  4. `step_back` (16 frames).
  5. `completeAction` clears the override, and `in` (8 frames) starts then.

  The poison damage on an override pose gets the small hero **pivot shake** (+-2 px, 12 frames; the enemy's shake is
  +-3 px for 14 frames). It is summed into `pivot.x` with the tremble (D-K16). There is no `hurt` flash: `partyPose`
  turns a hurt timer into the shake while an override is active. `BattleAnimationController` needs no change for
  this (its only pass-K edit is the D-K3 `rise` argument).

  **Enemy:**

  1. The attack (or cast) table plays.
  2. When its mode returns to idle, `in` starts.
  3. The poison line is presented in `result` and shakes whatever frame is showing: a kneel frame shakes as in the
     hurt row. A poison line that lands while the attack is still playing gets no shake (`playHurt` never
     interrupts an attack, as today).
  4. The action completes when `enemyStillAttacking()` is false.

  **Both sides:**

  - The shake never restarts `in`.
  - A poison KO dies from the frame on screen (a kneel frame, or the override pose for a hero).
  - Poison applied by an action is presented at that action's impact: with damage, row (d); status only, row (e).
  - A cure is presented when its line shows, and the rise plays then.
- **D-K4 Derived kneel key.**
  - Monsters: `kneel` is made from `idle` by body-template joint targets (section 4) plus the rig's
    `kneel: {tweaks, sink, paint}`. It follows the FW-H pattern: paint <= 160 px, locked as `kf:kneel`.
  - Heroes, variant A: re-posed from `ready` (robed: rows below `hip` squashed to sy 0.55 about the foot row).
  - Heroes, variant B: `ready`'s upper body over the approved `down` lower body (needs `battle.down` joints: hip,
    knees, feet, or the hem).
  - **R3** picks A or B at U1, separately for armoured and robed classes.
- **D-K5 Frames.** Four new frames per sheet / class: `kneel_in1` (idle toward kneel, t 0.33), `kneel_in2` (kneel
  toward idle, t 0.33), `kneel` (held), `kneel_b` (the body's `idle_b` operation applied to `kneel`). The rise is
  `kneel_in2`, `kneel_in1`. In-between tweaks `frames.kneel_in1.tweaks` / `frames.kneel_in2.tweaks` are allowed,
  under the existing in-between rules (near-keyframe, D-K19).
- **D-K6 Keep `daze` / `daze_b`.** They stay generated, locked and in the atlas, byte-identical (zero lock churn).
  **R4** (revisit after the restated cost): retiring them means 10 pages instead of 12, but vampire and wolf still
  leave page 0, and 123 x 2 lock entries are removed. Default **keep**.
- **D-K7 Opt-in, one fallback path.** Kneel frames are generated only for a rig or hero file with a `kneel:` block.
  - For a sheet without one, the atlas lists the kneel names aliased along the fallback chain: `kneel -> daze`,
    `kneel_b -> daze_b`, `kneel_in2 -> daze`, `kneel_in1 -> idle`, at 0 extra cells.
  - The runtime **always** runs the kneel track and draws whatever texture each name resolves to. There is no
    separate daze branch: the old `idleFrame` daze sway is removed. An unopted sheet then shows today's daze look
    on the kneel timing.
  - Heroes: an unopted class's kneel columns repeat `ready` in the atlas, and `POSE_FALLBACK` maps the names to
    `ready` for an old atlas.
- **D-K8 Anchors unchanged.** Kneel frames stay out of `HOME_FRAMES`, `RANGED_FRAMES`, `travelTop`, `lungeRight` and
  `idleBox`.
- **D-K9 Floating sink.** Floating and swimmer figures already sit on the 2 px bottom margin, so they droop in place.
  The sink is a runtime offset, `kneelSink` (native px; a new optional atlas field, written only for floating /
  swimmer sheets; template 6 px per 80 px of cell), eased over `in` / `out` and applied by `AiEnemyView`.
- **D-K10 Locks extend only.** Each opted-in rig gains exactly `kf:kneel`, `kneel_in1`, `kneel_in2`, `kneel_b`.
  Heroes get a new `assets-src/gen/anim/<class>.lock.json` holding only those 4. The 14 existing hero atlas columns
  stay byte-identical.
- **D-K11 Mechanical preset.** iron_golem, soldier, warmech and guardian keep their 15 deg cap. Their kneel is a
  power-down squat, with its own band.
- **D-K12 Colossus exempt (R5 default).** chaos_orrery, chaos_horizon and chaos_horizon_core do not kneel; a
  kneeling status shows its icon and overlay only. Chaos F1 (`chaos`, an atlas biped) kneels.
- **D-K13 Atlas growth and preload (R6).**
  - Accept 12 pages (each <= 2048x2048), with the act-1 group on pages 0 and 1.
  - `BattleArt.load()` loads **every page that holds an act-1 sheet** (pages 0 and 1), computed from a new optional
    index field `preload: [0, 1]` written by `monster_atlas.py` from the `act1` group's ids (not hard-coded).
  - **These pages are pinned** in `MonsterPages` (a new `pin(pages)`): they do not count against `PAGE_CACHE` (2),
    and they are never evicted. Their resident cost is 19.8 MB (16.4 + 3.4), from the first `load()` to the end of
    the session.
  - Claim: once `BattleArt.load()` has finished (the first battle awaits it), **act-1 sheets never stream**. Every
    other page still streams at `ensure` as today.
  - Peak resident memory: pinned 19.8 + (h + 2) x 16.4 MB (section 1). That is +2.8 MB against today for an act-1
    battle, and +19.2 MB for a battle elsewhere.
  - **R6** asks the user to accept 12 pages, 19.8 MB pinned for the session, and these peaks.
- **D-K14 U2 (R7 default: hold).** After K3-0, a second user review of one contact sheet.
- **D-K15 Bestiary.** The `daze` step plays kneel in, hold (`dazeHold` 144) and out when
  `textures.kneel !== textures.daze` (texture identity; no json field). Otherwise it plays the same track, whose
  textures alias to daze.
- **D-K18 Template-fix path during the rollout.**
  1. Only the **template owner** (the orchestrator, or one agent it names, working on `mainline` serially) edits the
     shared `kneel_templates.py`, `kneel.py`, `kneel_checks.py` or `puppet_kneel.py`.
  2. A rollout agent that needs a change reports `BLOCKED: <id> template <body>: <what>` and moves on.
  3. Template fixes must be **additive**: a new named variant, e.g. `kneel: {variant: winged}`, or a new key with
     the old default. That way every locked id stays byte-identical.
  4. After a commit to `kneel_templates.py` the owner runs `monster_anim.py check <every locked id of that body>`.
     After a commit to `kneel.py`, `kneel_checks.py` or `puppet_kneel.py` (shared by every body), the owner runs
     `monster_anim.py check --all` (G1) **and** `puppet_kneel.py check <every locked class>`. Either way every line
     must print `: OK` (an unchanged lock hash means unchanged frames), and G2 must pass.
  5. Worktrees rebase on it before using the variant.
  6. If a fix cannot be additive, the affected locked ids are listed, re-reviewed and re-locked, with
     `lockdiff --relock <ids>` showing changes **only** in kneel entries of those ids, logged in section 13.
- **D-K19 Rotation caps.** `ROT_CAP` in `anim_rules.py` is **kept unchanged**. The K-checks add two caps for kneel
  frames only:
  - the derived `kneel` key: limb parts <= 100 deg (mechanical <= 15), other parts <= `ROT_CAP`;
  - `kneel_in1` / `kneel_in2`: limb parts **<= 40 deg** relative to their pixel source, other parts <= `ROT_CAP`.

  Any part turned more than 30 deg is sampled with rotsprite.
- **D-K20 Anchors for icons, overlays and the arrow.** Status icons and overlays already re-read the head every frame
  (`statusFx.ts:206`), so they sit on the kneeling head, and on the sunk sprite for floaters, with no change. The
  active-hero arrow is moved down by the sink, `headOf(current).y - headOf(ready).y` (x scale), in
  `ActiveHeroMarker` (about +4 lines).
- **HP roll note.** The kneel starts at the presented impact (or after the flash, row d), **before** the rolling HP
  number and bar in `BattlePartyPanel` reach red. That is accepted: the panel's red at `ratio <= 0.25`
  (`BattlePartyPanel.ts:34`) uses the same threshold as `isWeak`.

## 3. Frame and timing spec (60 fps frames; pure tables)

| Sequence | Frames (length) |
|---|---|
| in | `kneel_in1` 4, `kneel_in2` 4, then hold (`KNEEL_IN_FRAMES` 8) |
| hold | `kneel` / `kneel_b` alternating every `KNEEL_PERIOD` 48, offset `index * 17` |
| out / rise / victory rise | `kneel_in2` 3, `kneel_in1` 3 (`KNEEL_OUT_FRAMES` 6), then idle / the action / `victory` |
| reversal | a mid-transition flip continues from the frame on screen (time mirrored) |
| hit on a kneeler | hero +-2 px pivot shake 12 frames; enemy dx +-3 shake 14 frames |
| floating `kneelSink` | 0 -> sink over `in` (ease out), held, sink -> 0 over `out` (ease in) |

**TS / Python contract.**

- TS: `MonsterFrame` / `MONSTER_FRAMES` gain the 4 names, `FRAME_SOURCE` maps them to `idle`, and `FRAME_FALLBACK`
  gets the D-K7 chain. `LATE_FRAMES` loses `daze` / `daze_b`, holds the kneel names until K4, then drops them.
- Hero: `BATTLE_POSES` appends the 4 names; `POSE_FALLBACK` maps them to `ready`.
- Python: `monster_recipes` mirrors this (`SEQUENCES["kneel"] = [idle, kneel_in1, kneel_in2, kneel, kneel_b]`,
  `SPAN["kneel"] = (idle, kneel)`); `selftest_kneel.py` checks that both sides match.

## 4. Kneel spec per body (L measured on the rig's idle key; px per 80 px of cell)

Templates live in `gen/kneel_templates.py`, keyed by body, preset and variant. A rig adds
`kneel: {tweaks: {joint: [dx, dy]}, sink: n, paint: [...], variant: name}`, where `sink` is the floaters' runtime
drop and `drop` is not a key. Monsters face right and heroes face left.

| Body | Kneel | Template targets | Band (kneel / idle height) |
|---|---|---|---|
| biped (46) | far knee down, near foot planted, torso low, head bowed, weapon low | hip down 0.8 L_thigh; `foot_n` / `toe_n` pinned, `knee_n` IK (near shin about vertical); `knee_f` on the ground row 0.3 L_thigh behind the hip, `foot_f` / `toe_f` back along the ground; chest +10 deg lean; crown 15 deg down; hands down 0.5 L_thigh; weapon tip <= 30 deg toward the ground; cloth and fx follow their bones | 0.68-0.85 |
| mechanical (iron_golem, soldier, warmech, guardian) | power-down squat | hip down by IK with every bone <= 15 deg; head and arms droop <= 15 deg | 0.85-0.95 |
| quadruped (27) | haunches and forelegs folded, belly low | hip down 0.6 L_hindthigh; chest down 0.6 L_upperfore; elbows and hocks to the ground; forearms forward; neck down 0.5 L_neck; snout 15 deg down; tail tip to the ground; wings folded <= 30 deg (variant `winged`); extra heads follow the neck chain (variant `multihead`) | 0.60-0.85 |
| bird (5, incl. allosaurus, tyrannosaur) | grounded crouch | hip to 0.35 L_leg above the ground; knees forward; feet pinned; wing tips 30 deg down; head 15 deg down; tail down | 0.60-0.85 |
| floating (14) / swimmer (1) | droop and sink | squash sy 0.90 about the bottom; head / eye 2 px down; arms, fins and wings hang 20 deg; `sink` 6 | 0.86-0.95 (frame) |
| serpent (8) | coil compressed | chain joints above the ground lowered by 40 % of their height; head to 2 head radii above the ground; maw 20 deg down | 0.55-0.85 |
| rooted (2) | stalks droop | stalks lowered 40 %; root mass sy 0.94 | 0.80-0.95 |
| naga (5) | slump into the coils | torso 20 deg forward, down 0.3 L_torso; coils sy 0.90; arms hang | 0.65-0.85 |
| arthropod (7) | legs splay | root to 2 px above the ground with tips pinned (IK); head, pincers and stinger 20 deg down | 0.60-0.85 |
| blob (4) | squash | sx 1.12, sy 0.80 about the bottom centre | 0.75-0.85 |

**Hero bands**, from `[max(0.72 H_ready, H_down + 4), 0.88 H_ready]` with the lower bound rounded up and the upper
rounded down (measured px):

| class | ready | down | band | class | ready | down | band |
|---|---|---|---|---|---|---|---|
| black_mage | 74 | 54 | 58-65 | ninja | 73 | 53 | 57-64 |
| black_wizard | 74 | 54 | 58-65 | red_mage | 72 | 55 | 59-63 |
| knight | 72 | 52 | 56-63 | red_wizard | 71 | 51 | 55-62 |
| master | 71 | 45 | 52-62 | thief | 72 | 48 | 52-63 |
| monk | 71 | 52 | 56-62 | warrior | 68 | 44 | 49-59 |
| white_wizard | 65 | 48 | 52-57 | **white_mage** | 66 | 51 | **55-58** (3 px) |

**Per-class override.** `kneel: {band: [lo, hi]}` in `anim/<class>.yaml` is allowed only with a section 13 entry
(class, old band, new band, reason). The lower bound may never drop below `H_down + 2`, so a kneel always stands
above the KO slump. White_mage is the expected first user.

All bands are tuning targets until U1, changed only with a section 13 entry; after U1 they are frozen.

## 5. Pipeline changes (Python)

| File | Change | Limit |
|---|---|---|
| `gen/kneel_templates.py` (new) | section 4 data, with variants | <= 200 lines |
| `gen/kneel.py` (new) | the derived key (opt-in), its paint, the `kneel_in*` / `kneel_b` recipes | <= 250 |
| `gen/kneel_checks.py` (new) | the K-checks (section 7) | <= 200 |
| `gen/monster_recipes.py` | names, `FRAME_SOURCE`, `FALLBACK`, `SEQUENCES`, `SPAN` | +12 |
| `gen/monster_anim.py` | 1 hook in `load_entries`, 1 in `generate` | <= +10 |
| `gen/monster_keys.py` | `kf:kneel` as a derived key (lock, paint) | <= +10 |
| `gen/monster_check.py` | the K-checks for kneel frames (they replace the per-foot x check and F5 there) | <= +10 |
| `gen/monster_atlas.py` | names; `kneelSink`; the `preload` list (D-K13); anchors untouched | <= +12 |
| `gen/puppet_kneel.py` (new) | hero variants A / B, `battle.down` joints, a rotsprite renderer for hero parts (reusing `rig_rotsprite`), hero K-checks, lock read / write, and its own `__main__`: `python3 -I assets-src/gen/puppet_kneel.py {review\|check\|lock} <class ...>` | <= 250 |
| `gen/puppet.py` | **unchanged (0 lines)** | 0 |
| `build_assets.py` | `build_battle_ai` appends the 4 kneel columns from `puppet_kneel.kneel_frames(cid)` (`ready` for unopted classes) | <= +5 |
| `gen/kneel_review.py` (new) | review sheets, GIFs, stage composite, pilot sheet | <= 250 |
| `gen/kneel_tools.py` (new) | `coverage`, `lockdiff --base REV [--relock ids]`, `party-diff --base REV`, `pages --base REV` | <= 200 |
| `gen/selftest_kneel.py` (new) + 1 line in `selftest.py` | section 7 | <= 250 |

## 6. Runtime changes (TS)

| File | Change | Lines after (projection) |
|---|---|---|
| `kneelChoreography.ts` (new, pure) | section 3 tables; `KneelTrack { set(on, clock, {hold?}), frame(clock), rising(age) }`; `isWeak` | <= 150 |
| `partyPose.ts` (new, pure) | `partyPoseOf(input)`: the D-K2 hero table including rows a to d | <= 130 |
| `enemyPoseTypes.ts` (new) | `EnemyState`, `EnemyAnimConfig`, `PoseState`, `DEFAULTS` moved out | about 50 |
| `EnemyPoseController.ts` | KneelTrack per enemy via `setPosture(i, posture, trembles)`; `state()` adds the tremble from that flag (not from the posture, D-K16) on top of the hurt / poison shake, one summed dx; D-K3 rise in `raw()` (calls the tables with `rise`); kneel-again on action end; the daze sway removed | 248 - 50 + 28 = **about 226** |
| `BattleDisplayManager.ts` | delegates to `partyPose.ts` (-11 lines), KneelTrack per member (+12), `maxHp` from `battle.allParty[i].maxHp`; `pivot.x` = -(tremble + shake) / scale, one sum (the existing tremble line is extended, not duplicated) | 231 - 11 + 13 = **about 233** |
| `attackChoreography.ts`, `enemyAttackTables.ts` | the D-K3 `rise` option (hold, then remap to E) | +15 / +12 |
| `enemyChoreography.ts` | names, fallbacks; `idleFrame` loses its daze branch | about 185 |
| `fx/statusRules.ts`, `types/fxData.ts`, `core/schemaValidationFx.ts` | `kneel` posture, rank, `trembles()` | +8 total |
| `AiEnemyView.ts` | `update(dt, sprites, postures, trembles)` passes the `trembles` flags to `setPosture`; applies `kneelSink` through a new pure helper `enemyOffsets.ts` (the sink easing), so the file grows <= 4 lines | **<= 246** |
| `BattleArt.ts` | reads `kneelSink`; `load()` loads the index's `preload` pages and pins them | <= 240 |
| `MonsterPages.ts` | `pin(pages)`: pinned pages are skipped by the LRU count and by eviction | +8 |
| `CharacterAtlas.ts` | the 4 names; `POSE_FALLBACK` | <= 240 |
| `ActiveHeroMarker.ts` | arrow follows the sink (D-K20) | about 85 |
| `kneelPreview.ts` (new, dev) | `?kneel=on` (every actor on both sides kneels), `?kneel=loop` (toggle every 150 frames, staggered 20), `&kneelVariant=A\|B` until U1, and `&poseLabel=1`: a BitmapText at `LABEL_POS` with one line per actor, `<name>: <frame> / <t>`, built by a pure `poseLabelLines()` extracted from `EnemyAnimPreview.labelText` (which then calls it; no loop, no preview instance) | <= 110 |
| `enemyAnimPreview.ts` | `labelText` body moved into the exported pure `poseLabelLines(poses, names)` | about 205 (unchanged) |
| `BattleScene.ts` | ticks `kneelPreview` next to `enemyAnimPreview.tick()` | 539 + 1 <= 594 |
| `BattleAnimationController.ts` | the D-K3 `rise` argument at :148 (the only edit) | 303 + <= 3 = **<= 306 / 308** |
| `BestiaryPreview.ts`, `bestiaryAnim.ts` | D-K15 | <= 235 |
| `status-visuals.yaml` | `poison: posture: kneel`; header comment | |
| `debug-scenarios.yaml` | `kneel_pilot` (K1) and the K4 scenarios (section 10) | |

`src/battle/` is not touched. The new pure modules import nothing from `pixi.js` (a test asserts it).

**The 2880 px hero atlas is accepted:** 18 columns x 160 = 2880 x 1920. That is under the 4096 WebGL texture size
the game already assumes for its 2048 pages, and 22 MB RGBA against 17.2 MB today.

## 7. Checks and tests

**K-checks** (`kneel_checks.py`, binary). They run in `monster_anim.py check`, `review` and the `monsters_ai` build;
the hero versions run in `puppet_kneel.py check` and `battle_ai`.

- **K-ground:** for grounded bodies, the lowest opaque row equals `bottom_row` in all 4 kneel frames, and the bottom
  2 rows hold >= 0.5 x the idle's pixels there. Floating / swimmer: the lowest row equals the idle's.
- **K-height:** the body band (section 4), or the hero class band / override.
- **K-rot:** D-K19.
- **K-fit:** nothing in the 2 px bottom margin or outside the cell.
- **K-anchor:** the per-sheet `homeX`, `idleBox`, `travelTop`, `lungeRight`, `head`, `lungePx` and `opaqueRight`
  are identical to base.
- **K-lock:** D-K10 / D-K18 via `lockdiff`.
- **Unchanged checks that also apply to kneel frames:** binary alpha, palette lock, magenta, detached pixels, seams,
  holes, outline, silhouette continuity along `SEQUENCES["kneel"]`, near-keyframe |u| <= 0.35, whole pixels, F3, F4,
  F7, atlas exactness, determinism. Heroes also check `pieces <= 2` and `ring` within 0.08 of `ready`.

**Python selftests** (`selftest_kneel.py`, on the synthetic rigs of `selftest_rig.py` / `selftest_beasts.py`):

- opt-in only, and old frames byte-identical with and without the block;
- the 4 names are generated;
- the failure cases: K-ground fails a 1 px lift, K-height fails a frame outside its band, K-rot fails a 101 deg key
  and a 41 deg in-between, K-lock fails a changed `daze` hash;
- an additive template variant leaves the locked frames unchanged;
- the Python and TS tables match;
- `kneelSink` is written only for floaters, and the `preload` list equals the act-1 pages;
- heroes: variant A on synthetic robed and unrobed puppets, the 14 old columns identical, and a band override with
  no section 13 entry refused (`puppet_kneel.py check` reads section 13's table).

**TS tests** (Vitest; existing tests are updated to the new spec, never deleted):

- `kneelChoreography.test.ts`:
  - in 8 / out 6 frame by frame; hold period 48 with the per-actor offset; reversal;
  - `set(on, {hold: true})` starts in hold;
  - `isWeak(25,100)` is true, `isWeak(26,100)` false, `isWeak(0,100)` false.
- `partyPose.test.ts`, one case each:
  - the 8 D-K2 rows, and rows (a) start / retry in hold, (b) the step without a rise, (c) a revive into weak (no
    `ready` frame) and above it (the rise), (d) the hurt flash then `in` at frame 24;
  - victory: the rise is 6 frames for weak or poisoned heroes, none for a sleeper;
  - poison plus sleep is disabled; poison plus fear kneels and trembles.
- `EnemyPoseController.test.ts` / `enemyPoseFlow.test.ts`:
  - posture `kneel` or `daze`: `kneel_in1` at t 0-3, `kneel_in2` at 4-7, hold from 8;
  - a poisoned enemy's attack shows `kneel_in2` at 0-2 and `kneel_in1` at 3-5, then the table frame. The contact
    frame is unchanged (14 in place; melee and heavy per their tables); same for the boss and plain casts;
  - `in` restarts when the attack ends;
  - a poison tick is a shake that does not restart `in`; a poison KO dies from the kneel frame; a wake rises;
    stone cuts the kneel.
- `statusRules.test.ts` / `statusVisuals.test.ts`: the rank table, `poison -> kneel`, `trembles`.
- `statusIntegration.test.ts` (rewritten to the real order, D-K17): a poisoned hero acts (turn not lost). During
  `result`, the poison line is presented while the override pose is still held: the pose is unchanged, `pivot.x`
  shakes for 12 frames (summed with a tremble when feared), and there is no `hurt` pose. `in` starts on the first
  frame after `completeAction`, never before `step_back` ends. A poison line for an enemy whose attack has ended
  shakes its kneel frame.
- row (e): a status-only poison (no damage event, so no `flashHurt`) starts `in` on the presented frame, for a hero
  and an enemy.
- the tables (including hero `castAt` and heavy n = 0): for every hero style and enemy table, with `rise`, frame
  names, the `hold` / `contact` cues and `holdFrame` are identical to the run without it (raw t); the offset is the frame-0 value for t < 6, the
  contact frame index is equal to the run without `rise`, and every frame from E on is identical.
- `MonsterPages.test.ts`: pinned pages are never evicted and are not counted in `PAGE_CACHE`; unpinned LRU behaviour
  is unchanged.
- `BattleDisplayManager.test.ts`: FB-7 "sleep holds ready" becomes kneel; `ActiveHeroMarker` arrow sink.
- `poseCues.test.ts`, `assetCoverage.test.ts`, `CharacterAtlas.test.ts`: the frame lists. Kneel frames are own
  rects when opted in, otherwise aliased per D-K7; from K4, own rects for all 123 / 12.
- the bestiary tests (D-K15, texture identity);
- scenario tests: every `kneel_*` scenario resolves; weak members have `hp * 4 <= maxHp`; each K4 formation passes
  `formationFits`;
- an import test: no `pixi.js` in the new pure modules.

## 8. Review tooling and pilot (K1)

**Pilot:**

| Sprite | Risk it covers |
|---|---|
| `goblin` (biped, small, act 1) | a prop dagger carried to `dag_h` under a big re-pose; foot masks; existing daze paint; **poisoned: rises to attack and kneels again** |
| `wolf` (quadruped, act 1, now on page 1) | 4 IK leg chains fold at once, plus tail and head; checks the act-1 page-1 preload |
| `warrior` (armoured, unrobed, shield) | about 90 deg leg rotations; the far-arm shield; `down` close in height |
| `white_mage` (robed, zigzag hem) | the robe squash (A) or the `down` hem (B); a 3 px band |

**Commands and artefacts** (untracked, under `assets-src/gen/out/anim/review/kneel/`):

```bash
python3 -I assets-src/gen/kneel_review.py goblin wolf warrior white_mage
#  prints "<id>: OK" or "<id>: FAIL <check> ..." (heroes per variant: warrior[A], warrior[B], ...)
#  pilot_sheet.png : rows goblin, wolf, warrior A/B, white_mage A/B; columns idle/ready, kneel_in1, kneel_in2, kneel,
#                    kneel_b, plus hurt (monsters) / down (heroes); 4x; ground line; height and band per row
#  <id>[_A|_B]_kneel.gif : in 8f, 2 sway cycles, out 6f, stand 24f (16.7 ms per frame)
#  goblin_rise.gif : kneel -> rise (6f) -> attack table -> kneel_in (8f) -> hold, at game timing
#  pilot_stage.png : all pilots kneeling at game scale on grassland.webp at their battle slots
npm run dev   # Playwright, always with mute=1
#  http://localhost:5173/?mute=1&scenario=kneel_pilot&battleStep=1&poseLabel=1 -> /tmp/kneel/pilot_battle_{1,2,3}.png
#  http://localhost:5173/?mute=1&scenario=kneel_pilot&kneel=loop  -> /tmp/kneel/pilot_loop_{1..4}.png
```

`kneel_pilot`:

- party: `WAR` warrior Lv 10 weak HP; `WHM` white_mage Lv 10 `status: [sleep]`; `WHM2` white_mage Lv 10
  `status: [poison]`; `WAR2` warrior Lv 10 full HP (the control);
- enemies `[goblin, goblin, wolf, wolf]` with `enemyStatus: {0: [sleep], 1: [poison], 2: [stun]}`; wolf 3 is the
  control;
- grassland.

**Deterministic capture.** The driver opens
`http://localhost:5173/?mute=1&scenario=kneel_pilot&battleStep=1&poseLabel=1`. In that mode:

- time is frozen scene-wide, and each `.` advances one frame;
- no `EnemyAnimPreview` is created (`enemyAnim=step` is **not** used: it creates a loop-mode preview that animates
  every enemy);
- the `poseLabel` lists one line per actor, `<name>: <frame> / <t>`, for each enemy and each hero.

The driver scripts round 1: WAR and WAR2 FIGHT wolf 3 (the
control), and WHM2 uses a Potion on WAR2 (no damage, no status), so goblin 0, goblin 1 and wolf 2 keep their
statuses. WHM is asleep and loses its turn. The driver then presses `.` until the label for goblin 1 reads
`atk_mid` (screenshot 2), then until its poison line has shown and the label reads `kneel` (screenshot 3). Enemy
targets stay random; only the frame at the capture is fixed.

Screenshot 1 (the start) shows WAR, WHM, WHM2, goblin 0, goblin 1 and wolf 2 already kneeling (row a), with WAR2
and wolf 3 standing.

Screenshot 2 is taken during goblin 1's attack and shows it standing mid-attack.

Screenshot 3 is taken after its poison line and shows it kneeling again.

**K1 commits.** The K1 agent commits the code, the pilot rigs and locks, **and the rebuilt atlases**
(`monsters-ai*`, `battle-characters-ai*`), so the user sees the pilot in the browser.

**U1 (user gate).** The user gets `pilot_sheet.png`, the GIFs, `pilot_stage.png` and the screenshots, and rules:

1. approve or reject each pilot's look;
2. R3: pick hero variant A or B, for armoured and for robed classes;
3. R4 to R7.

The rulings are recorded in section 13 ("K1-U1: pilot rulings"). No K2 work starts before that commit.

## 9. Rollout (sprite lists from the rig files' `body:`)

| Tranche | Owner | Sprites |
|---|---|---|
| **K1** pilot | 1 agent | goblin, wolf, warrior, white_mage |
| **K2-0** risky-body probes (4) | template owner, serial; **orchestrator review** (the same artefacts as section 8) before K2 | iron_golem (mechanical squat), blue_dragon (winged quadruped, scale 3), hydra (multi-head quadruped, scale 3), garland (per-pose boss, cloth, fx, raise) |
| **K2-A** biped 1 (22) | worktree agent A | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle ghast ghoul gr_imp hill_gigas horned_devil ice_gigas king_mummy lich mindflayer |
| **K2-B** biped 2 (24) | agent B | minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier stone_golem troll vampire vampire_lord warmech weretiger werewolf wight zombie |
| **K2-C** quadruped (25) | agent C | baretta basilisk chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf |
| **K2-D** heroes (10) | agent D | unrobed: knight thief ninja monk master red_mage; robed: black_mage black_wizard red_wizard white_wizard |
| **K3-0** new-body probes (8) | template owner, serial; then **U2** | cockatrice (bird), ghost (floating), shark (swimmer), cobra (serpent), ochu (rooted), water_naga (naga), scorpion (arthropod), green_slime (blob) |
| **K3-A** floating (13) | agent A | air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental hollow_seraph red_piranha shadow specter water_elemental white_shark wraith |
| **K3-B** serpent / rooted / naga (12) | agent B | anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; neochu; ashen_queen earth_medusa medusa spirit_naga |
| **K3-C** bird / arthropod / blob (13) | agent C | allosaurus pyrolisk tyrannosaur wyvern; ankheg black_widow crawler remorazz sea_scorpion tarantula; black_flan gray_ooze ochre_jelly |
| **K4** integration | 1 agent | section 10 |

Totals: 2 + 4 + 22 + 24 + 25 + 8 + 13 + 12 + 13 = **123 sheets**, and 2 + 10 = **12 heroes**.

The K2-0 review checks the variants the risky bodies need: mechanical, `winged`, `multihead`, cloth and fx on a
per-pose boss cell, and scale-3 paint in native px. Its result is recorded in section 13 before the K2 worktrees
start. The K2 agent briefs repeat the known per-sprite risks:

- the remaining mechanical rigs (soldier, warmech, guardian);
- cloth / fx (lich, mummy, hollow_seraph: its halo stays dark, since `brighten` is cast-only);
- the FW-Q partial rigs (the kneel comes from `idle`, so they are unaffected);
- the boss cells (drowned_sovereign, ashen_queen, piscodemon, chaos `raise: false`).

**Parallel protocol:**

1. `git worktree add /tmp/kneel-wt/<tranche> -b kneel-<tranche> mainline`.
2. An agent edits only its own `anim/monsters/<id>.yaml` and `.lock.json`, or `anim/<class>.yaml` and
   `.lock.json`. Shared Python and TS change only in K1, K2-0, K3-0, K4 and template-owner commits (D-K18).
3. Per sprite: `kneel:` block -> `kneel_review.py <id>` -> `monster_anim.py check <id>` shows `<id>: OK` (heroes:
   `puppet_kneel.py check <class>`) -> `lock` -> **commit at once** (`K2-A: <id> kneel rig + lock`). Never
   `git add -A`.
4. **Rollout agents never commit atlases**, or anything under `assets/`.
5. Retry cap: 2 re-tunes per sprite, then `BLOCKED: <id> <check>` (or a template ask, D-K18).
6. Merge order: K2-A, K2-B, K2-C, K2-D (disjoint files), then the **integrator** (the only one who rebuilds and
   commits atlases) runs `build_assets.py monsters_ai battle_ai`, the section 10 gates and commits "K2: atlases".
7. K3 follows the same order: K3-0 -> U2 -> K3-A, K3-B, K3-C -> "K3: atlases".

## 10. Gates and K4

Every tranche merge (and K4) runs these, with the expected results:

| # | Command | Expected |
|---|---|---|
| G1 | `python3 -I assets-src/gen/monster_anim.py check --all \| grep -vc ': OK'` | `0`; `grep -c ': OK'` = `123` |
| G2 | `python3 -I assets-src/gen/kneel_tools.py lockdiff --base 0162f38` | `0 changed, 0 removed`; added = 4 x opted rigs (K4: 492) plus 4 x opted heroes (K4: 48) |
| G3 | `python3 -I assets-src/gen/kneel_tools.py coverage` | the running count; K4: `monsters 123/123, heroes 12/12` |
| G4 | `PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum assets/sprites/monsters-ai* assets/sprites/battle-characters-ai* > /tmp/kneel.sha && PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum -c /tmp/kneel.sha` | every line `OK` |
| G5 | `python3 -I assets-src/gen/kneel_tools.py pages --base 0162f38` | every page <= 2048x2048; <= 12 pages; `preload` = the act-1 pages (<= 2); K-anchor fields identical |
| G6 | `python3 -I assets-src/gen/kneel_tools.py party-diff --base 0162f38` | `12 rows x 14 old columns identical; width 2880` |
| G7 | `git diff --stat 0162f38 -- assets/sprites/characters* assets/sprites/colossus*` | empty |
| G8 | `python3 -I assets-src/gen/selftest.py` | last line `ALL PASSED` |
| G9 | `npm run build` | exit 0 |
| G10 | `npm test` | `Test Files` all passed; `Tests` all passed, **>= 5012** (baseline 4962 + at least 50 new in K1). The K1 count is recorded in section 13 as the floor for every later gate. |
| G11 | `git status --short` | no scratch files |
| G12 | `git diff --stat 0162f38 -- assets-src/gen/cache/ledger.jsonl assets-src/gen/cache/bedrock_ledger.jsonl` and `git diff 0162f38 -U0 -- assets-src src \| grep -cE '^\+.*(gemini\|bedrock\.invoke\|generate\.py)'` | empty, and `0` |

**K4 play test** (`?mute=1` always; 0 console errors; screenshots in `/tmp/kneel/k4_<scenario>_<n>.png`).

Formations, checked by `formationFits` in a scenario test:

- **`kneel_grounded`:** `[goblin, wolf, cockatrice, scorpion, green_slime, soldier, goblin]` (biped, quadruped,
  bird, arthropod, blob, mechanical, plus a status-free control goblin at index 6) with
  `enemyStatus {0: [sleep], 1: [poison], 2: [stun], 3: [poison], 4: [sleep], 5: [stun]}`.
- **`kneel_other`:** `[ghost, cobra, shark, ochu, water_naga, ghost]` (floating, serpent, swimmer, rooted, naga,
  plus a status-free control ghost at index 5) with `{0: [poison], 1: [sleep], 2: [stun], 3: [poison], 4: [sleep]}`.

Scenarios. In every one, member 1 is weak, member 2 poisoned, member 3 asleep and member 4 stunned. Capture works as
in the pilot: `&battleStep=1&poseLabel=1` frame stepping (never `enemyAnim=step`); round-1 commands are scripted so the acting heroes FIGHT the
formation's status-free control enemy (the last index), or use a Potion on a full-HP member. Mid-attack shots step
until the acting enemy's label reads `atk_mid`, and the after-shots until it reads `kneel`.

| Scenario | Party | Formation | Screenshot 1 (start) must show | Screenshot 2 must show |
|---|---|---|---|---|
| `kneel_k4_armour` | warrior knight thief ninja | kneel_grounded | 4 heroes and 6 enemies kneeling, no `in` playing; zzz / stars / bubbles on the kneeling heads | the poisoned wolf mid-attack standing, then (shot 3) kneeling again after its poison line |
| `kneel_k4_light` | monk master red_mage black_mage | kneel_other | 4 heroes and 5 enemies kneeling; floaters (ghost, shark) sunk; icons on the sunk heads | the weak monk attacking standing (the rise), the active arrow at the kneeling head during its command input |
| `kneel_k4_robed` | white_mage black_wizard red_wizard white_wizard | kneel_grounded | 4 robed heroes kneeling, each distinct from `down` | after a CURE on white_mage above 25 % HP: it stands; after victory, weak / poisoned heroes in `victory`, the sleeper and the stunned hero still kneeling |

Also, with no console errors:

- `?scenario=anim_status`, `f_status_combo`, `chaos_forms`, `chaos_final` (a slept colossus: no pose, no error);
- `?bestiary=goblin`;
- an adversarial checklist: stone over a kneel, a wake mid-`in`, a heal across 25 % mid-`out`, a KO from a kneel, a
  revive into weak, a retry with a weak member, poison plus fear.

**Docs to update in K4:**

- AGENTS.md:
  - the "Monster animation" bullets: kneel frames, opt-in, K-checks, `kneel_tools.py`, `puppet_kneel.py`;
  - the battle_ai / monsters_ai pipeline rows (columns, measured pages, `preload`);
  - Key Interfaces: postures `daze` / `kneel`, the hero weak rule, additive fear;
  - the debug keys `?kneel=`;
  - the `kneel_*` scenario family;
- `docs/ENEMY_ANIM_PLAN.md` 3.1 / 3.2 / 5.1 (pointer to this plan);
- `docs/FEEDBACK_PLAN_2026-11-14.md` item 5a (superseded);
- `assets-src/gen/README.md`;
- `docs/PROGRESS.md`;
- the stale `LATE_FRAMES` comment.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Large leg rotations look broken (90 deg thighs) | rotsprite above 30 deg; keyframe paint <= 160 px; hero variant B; the pilot and K2-0 judge this |
| A hero kneel reads as `down` | band lower bound `H_down + 4` (override >= `H_down + 2`); head-up / weapon-held targets; U1 compares side by side |
| The robe squash smears the hem | variant B at U1 |
| Atlas growth (12 pages; act-1 on 2 pages) | act-1 pages pinned (19.8 MB); peak +2.8 MB for act 1, +19.2 MB elsewhere (section 1); R4 retirement as a fallback |
| A risky body breaks after the rollout starts | K2-0 probes; D-K18 additive template variants with re-check; G2 |
| The rise looks rushed inside the wind-up | `KNEEL_OUT_FRAMES` tunable in K1; `goblin_rise.gif` and screenshot 2 at U1 |
| Poison is very common, so kneeling enemies are everywhere | that is the user's ruling R2; poison keeps its tint, so it is distinguishable from sleep |
| File ceilings | the projections in section 6; `puppet.py` untouched |

## 12. Open questions for the user

1. R3: hero variant A or B, for armoured and for robed classes (decided at U1).
2. R4: keep `daze` / `daze_b` (12 pages, wolf, skeleton, troll and vampire on page 1), or retire them (10 pages,
   vampire and wolf still on page 1, 246 lock entries removed)? Default keep.
3. R5: exempt the Chaos colossus forms F2-F4 from the kneel? Default exempt.
4. R6: accept 12 pages with act-1 pages 0 and 1 pinned for the session (19.8 MB), a peak of pinned + (h + 2) x
   16.4 MB (+2.8 MB for an act-1 battle, +19.2 MB for a battle elsewhere), and other pages still streaming? Default
   accept.
5. R7: hold U2 for the new body templates, or orchestrator self-review? Default hold U2.

Ruled: **R1 = no** (enemies never kneel at low HP), **R2 = yes** (poison kneels, both sides).

## 13. Rulings and tuning log

| Date | Item | Ruling / change |
|---|---|---|
| 2026-11-16 | R1 | no: enemies kneel only from status (user) |
| 2026-11-16 | R2 | yes: poison kneels, heroes and enemies; acting kneelers rise to act (user) |
| 2026-11-17 | R3 | variant **A** for all 12 classes; B rejected for its extra hands and weapons (user) |
| 2026-11-17 | U1 / R7 | the user handed the monster pilot and the U2 body review to the orchestrator, with a review agent; max 3 iterations per monster; report limit hits (user) |
| 2026-11-17 | R4 / R5 / R6 | defaults: keep daze, exempt colossus F2-F4, accept pages (orchestrator, user unattended) |
| 2026-11-17 | K1 | merged (eca44a9); atlases rebuilt: 9 pages, preload [0]; 5063 tests (the G10 floor); lockdiff accepts the hero lock names |
| 2026-11-17 | D-K11 / D-K19 amended | kneeling mechanicals use `mech_kneel`: the legs follow the biped limb cap and band (0.68-0.85), the arms, torso and head stay <= 15 deg; the reviewer asked for the knee on the ground (orchestrator) |
| 2026-11-17 | review loop | an independent image reviewer judges every tranche; max 3 iterations per sprite, the best iteration is kept and the 3-iteration hits are reported to the user (user) |

## TODOs

- [ ] K1a kneel templates (biped, quadruped), `kneel.py`, recipes, hooks, K-checks, lock extension (high, 8h)
- [ ] K1b `puppet_kneel.py` (A / B, `down` joints, rotsprite, CLI, locks) for warrior and white_mage (high, 6h)
- [ ] K1c TS: `kneelChoreography`, `partyPose`, `enemyPoseTypes`, the D-K3 rise (tables plus the 1 controller line), `poseLabel`, posture `kneel` / rank / `trembles`, preload, arrow, preview, bestiary (high, 9h)
- [ ] K1d `kneel_review.py`, `kneel_tools.py`, `selftest_kneel.py`, TS tests >= 50 (high, 6h)
- [ ] K1e pilot rigs, locks, `kneel_pilot`, atlases committed, artefacts, G1-G12 (high, 4h)
- [ ] U1 user review; rulings into section 13 (blocking)
- [ ] K2-0 probes iron_golem, blue_dragon, hydra, garland; template variants; orchestrator review (high, 6h)
- [ ] K2-A / B / C / D: 81 sprites and classes in 4 worktrees (medium, about 9h each)
- [ ] K2 integrator: atlases plus G1-G12 (medium, 1h)
- [ ] K3-0: 6 new templates plus 8 probes; U2 (high, 8h)
- [ ] K3-A / B / C: 38 sprites (medium, about 6h each)
- [ ] K3 integrator: atlases plus G1-G12 (medium, 1h)
- [ ] K4: scenarios, play test, adversarial checklist, docs, final gates (high, 6h)

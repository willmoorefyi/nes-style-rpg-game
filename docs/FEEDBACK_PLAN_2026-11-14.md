# Playthrough feedback plan (pass F), 2026-11-14

**Status:** plan only, nothing implemented. Momus review (REVISE, 25 items) folded into the body; the binding decisions are at the end. **Base:** `mainline` at `6d8ef65`. All file:line references are to that commit.

**Input:** the user's playthrough feedback (8 items, below), plus the user's clarification of item 5 (a stunned/afflicted
pose and a visual per status). The verbatim intent of each item opens its section in §3.

**Research sims (throwaway, not committed):** `/tmp/fb-plan/gold.ts` and `/tmp/fb-plan/garland.ts`, run from the
checkout with `npx vite-node /tmp/fb-plan/<file>.ts '<json patch>'`. Both drive the real `BattleStateMachine` through
`tests/helpers/{battlePolicies,balanceData}.ts` with the `garland.test.ts` seed formulas (400 seeds), and patch enemy
data in memory. The numbers in §3.1 and §3.2 come from these runs. The implementer re-measures them on the merged code.

**Rules (as U):**
- Data stays in YAML: gold, Garland, `attack: melee|ranged`, effect and status-visual tables, kits, sandbox levels.
- No `as any`, no `@ts-ignore`, no silent `catch`. The new settings store logs every storage failure. (Aside, not in
  scope: `src/ui/ControlsHint.ts:63,71` already has two `catch { /* noop */ }` blocks against AGENTS.md. Fb may fix
  them in passing because it adds the same storage pattern.)
- Every code fix gets a test that fails on the old code. Data and art fixes get a test or a `--check` that fails on
  the old data.
- **Browser checks** use `http://127.0.0.1:5173/?mute=1&…` and never leave out `mute=1`. They must show 0 console
  errors. Close the page and stop the dev server afterwards. `?mute=1&scenario=<id>` below is short for
  `http://127.0.0.1:5173/?mute=1&scenario=<id>`. Battle scenarios start from **Debug** on the title. With `?scenario=`
  the Debug item still goes straight into that scenario (item 8 keeps this).
- **Art:**
  - Approved sheets are never modified (style lock). New approved files may be added.
  - Paid Gemini use is 26 of 100 (`docs/ACT1_LOG.md`, last line; `assets-src/gen/budget.json` `attempts_before: 69`
    with 95 Gemini attempts in the ledger). Only item 7 asks for paid images (binding decision FB-8): one
    `attack_raise` image each for Garland and the lich, at most one retry each and only after a failed review, so at
    most **4** attempts. The budget ends at **≤ 30 of 100** (§3.7).
  - `budget.json` still allows 3 attempts per sheet, so pass F adds its own ledger check (§7): at most the current
    count + 4 Gemini attempts in total, and at most 2 per new sheet.
  - Bedrock/Stability isn't budgeted, but it was rejected for in-betweens on 2026-11-13. It isn't used.
- **File-size ceilings.** New files must be under 250 lines. The monitored files must not pass their ceilings:

  | File | Ceiling | Now | Pass F pressure |
  |---|---|---|---|
  | `BattleScene.ts` | 594 | 473 | F0 hooks, layers update, `enemyStatus` +14; Fb +20 |
  | `BattleStateMachine.ts` | 592 | 586 | only F0, only to add `spellId?` / `itemId?` to `NextActionInfo` and `ActionResult` (about 4 lines, so ≤ 590). No other tranche touches it |
  | `BattleAnimationController.ts` | 308 | 280 | F0 splits resolve/present (+12), adds the effect phase and cue hand-off (+8), re-exports the timing constants (net −2) and moves `formatAnnouncement` into `battleMessageUtils.ts` (−9, re-exported). Net ≈ 289 |
  | `EnemyPoseController.ts` | < 250 | 177 | F0 split offsets and cues +15; Fc travel and heavy +35 |
  | `assets-src/gen/monster_anim.py` | < 250 | 222 | Ff first moves `RECIPES`, `FRAME_SOURCE`, `SEQUENCES` and `SPAN` into a new `monster_recipes.py` (about −35), then adds the recipes |
  | `SpellExecutor.ts` | 314 | 308 | not touched |
  | `BattleDisplayManager.ts` | < 250 | **243** | F0 first extracts the enemy-list code (`:182-205, 236-242`, about 35 lines) into a new `BattleEnemyList.ts` |
  | `src/core/schemaValidation.ts` | (375, an unlisted exception) | 375 | new validators go in a new `schemaValidationFx.ts`; +2 lines for the call |
  | `assets-src/build_assets.py` | (321, unlisted) | 321 | new stages are registered in at most 3 lines; their code is in new modules |
  | `assets-src/gen/{generate,spec}.py` | (819 / 322, unlisted) | | item 7 is ≤ +6 lines each |

---

## 0. Success criteria (defined before implementation)

```json
{
  "functional": [
    "Battles in the act-1 zones pay enough gold that a party reaching Lv 2 on its first try can buy a 100 G spell, even after one inn stay and one potion",
    "Garland is a real fight at Lv 2 with what the new gold buys, and still winnable; Lv 3 is comfortable",
    "Melee enemies travel to the hero they attack and back; ranged enemies attack in place with a visible projectile or breath",
    "Every spell and battle item shows a visual effect on its targets before its number or result line",
    "Every status shows on enemies and party: an icon, a looping overlay, and, for disabling statuses, a dazed pose (stone grey, no breathing)",
    "Battle text holds long enough to read each step; a message-speed setting (1-5) exists, defaults slower than today, and persists",
    "Garland and the lich telegraph their attack (weapon raised overhead, then the slam)",
    "Debug opens a sandbox (level preset, per-slot class, kit, enemies, background); one press starts the battle, every outcome returns to the sandbox; ?scenario= still goes straight in"
  ],
  "observable": [
    "Sim: median gold in hand when the whole party reaches Lv 2 >= 220 G (old 144 G)",
    "Sim: Garland, sensible Lv 2 with the lv2 kit, wins 55-75 %; Lv 3 >= 85 %; a full-HP Lv 2 mage survives one 2-hit attack >= 90 %",
    "Frame counts per action at message speed 3 within the bands of section 3.6",
    "Screenshots of contact frames, effects and overlays from the f_* scenarios, 0 console errors"
  ],
  "pass_fail": [
    "npm run build and npm test pass; every new test fails on 6d8ef65",
    "No approved PNG changes hash; the ledger grows by at most 4 Gemini attempts (at most 2 per new sheet) and the budget ends at <= 30 of 100",
    "File-size ceilings above hold",
    "Adversarial play test (section 6): no P0 or P1 open"
  ]
}
```

---

## 1. Coverage

| # | Feedback | Tranche | Depends on |
|---|---|---|---|
| 1 | Gold too low by Lv 2 | Fa (balance) | F0 |
| 2 | Garland too easy at Lv 2 | Fa (after 1) | 1 (the new gold sets the kit) |
| 3 | Enemies should approach the party unless ranged | Fc (enemy choreography) | F0; tuned after Fb |
| 4 | No spell effects | Fd (fx engine and spell effects) | F0; tuned after Fb |
| 5 | Enemy statuses are invisible (+ clarification: dazed pose, per-status visuals, party too) | Ff (the `daze` frames) + Fe (overlays, icons, tints) | Fe after Fd and Fc |
| 6 | Battle far too fast | Fb (pacing) | F0 |
| 7 | Garland and the lich need a dramatic overhead attack | Ff (keyframes and rigs) + Fc (timeline) | F0; paid art per binding FB-8 |
| 8 | A richer debug menu | Fg (sandbox) | F0 |

All 8 items are covered, including the item 5 clarification.

---

## 2. Shared contract (F0: one commit on an integration branch before any tranche)

Tests and build pass, and behaviour is unchanged. The existing suite proves it: `BattleScene`, `AiEnemyView`,
`BattleFlash`, `meleeContact` and `enemyPoseFlow` stay green.

**Compatibility rules (so the old tests keep working):**
- `BattleAnimationController.ts` **re-exports** `ROUND_END_FRAMES`, `ANNOUNCE_FRAMES`, `RESULT_FRAMES` and
  `ELEMENT_COLORS` from their new homes.
- Its constructor still takes a `Container` as its first argument. If it isn't already a `BattleLayers` root, the
  layers are built inside it.
- `BattleDisplayManager` keeps **delegating getters and methods** for everything moved to `BattleEnemyList.ts`:
  `enemyListTexts`, `enemyNameToListIndex`, `enemyList`, `updateEnemyList`, `listIndexFor` and
  `updateEnemyListDeadTints`.
- **The only test edits F0 makes**, and owns:
  - **`tests/scenes/battle/meleeContact.test.ts:73`:** the floating-number lookup (`main.children.filter(… OutlinedText)`)
    looks in the numbers layer through a new `tests/helpers/battleLayers.ts` `floatsIn(main)`, which searches the
    whole tree.
  - **`tests/scenes/battle/enemyPoseFlow.test.ts`:** its literal tick counts are rewritten as expressions of the
    timing constants (`ANNOUNCE_FRAMES`, `ATTACK_OUT`, `RESULT_FRAMES`, `ROUND_END_FRAMES`, …), and a `beforeEach`
    pins `setMessageSpeed(5)` (today's timing). Fb can then change values without editing that file.
  - Any other edit that turns out to be unavoidable is listed in the F0 commit message with the reason.

**Contract:**

1. **`src/scenes/battle/battleTiming.ts` (new).**
   - It holds every battle UI hold:
     - `ANNOUNCE_FRAMES`, `RESULT_FRAMES` and `ROUND_END_FRAMES` (from `BattleAnimationController.ts:15-18`);
     - `NOTICE_FRAMES` (`BattleScene.ts:24`);
     - `BATTLE_MESSAGE_FRAMES = 45` (the literal at `BattleScene.ts:386, 395`);
     - `INTRO_FRAMES = 60` (`BattleScene.ts:47`);
     - `ACTION_BEAT_FRAMES = 0` (new).
   - It also exports `holdFrames(base, speed)`. In F0 the multiplier is 1.0 at every speed, so the values stay as
     today. Fb owns the values, the multipliers and `battleTiming.test.ts`.
2. **`src/core/Settings.ts` (new):** `getSettings(): { messageSpeed: 1|2|3|4|5 }` and `setMessageSpeed(n)`.
   - It is stored in `localStorage` under `ff.settings`, **read once and cached**. `setMessageSpeed` writes through.
   - When `localStorage` is absent (Node tests, a private context) it uses the default with **no warning**.
   - A storage exception or an invalid stored value logs `console.warn` once and falls back to the default.
   - The default in F0 is **5**. Fb moves it to 3.
3. **`src/scenes/battle/BattleLayers.ts` (new).** `mainContainer` gets these children, in order:
   - `bg`;
   - `ui`: the enemy and command windows and the party panel, below the sprites as today;
   - `actors`: enemy sprites, then party sprites;
   - `fx`, with sublayers `status`, `spell`, `flash` and `numbers`, in that order;
   - **`hud`**: the message window and the end prompt, above `fx`. A travelling or large enemy can never cover the
     message text.

   Placement:
   - `BattleDisplayManager` adds sprites to `actors`. `BattleEffects` adds flashes to `fx.flash` and floating numbers
     to `fx.numbers`. `BattleScene.createUI` puts the message window in `hud`.
   - `layers.update(dt)` is called once per frame from `BattleScene.update`. It is the hook for the screen shake (Fc)
     and the status and effect followers (Fd, Fe).
   - `AiEnemyView.reorder` keeps working because it reorders inside its sprites' parent.

   The one visible change: a boss's head, if it reached y < 120, used to draw over the message window and now draws
   under it. A new `tests/scenes/battle/battleLayers.test.ts` pins the order and checks that a sprite in `actors`
   whose bounds overlap the message window is drawn below it (`hud` is the last child).
4. **Action data (`BattleStateMachine.ts`, the only edit to that file in pass F, about 4 lines):**
   - `NextActionInfo` and `ActionResult` gain `spellId?` and `itemId?`, set where the spell or item is already known.
   - **Target set** for an effect:
     - `info.targetId` when it is set;
     - for `all`, `all_allies` and party-wide items, the living members of that side **captured at announce time** in
       `peekNextAction` order.
   - **"Landed"** for status effects: `BattleAnimationController` snapshots each target's status set (`getAll()`
     effects) before `resolveAction` and diffs it after. Added statuses are "landed", removed ones "cleansed". The
     diff goes to `fx.play` and `statusFx.sync`, so no message text is parsed.
5. **Action presentation split (in `BattleAnimationController`).** `executeAction` (`:184-200`) becomes:
   - `resolveAction()`: the state machine, store the result, take the status diff;
   - `presentAction()`: floats, slash, panels, messages, turn list, `statusFx.sync(diff)`, and the
     **presented-state update** (below).

   A new phase `'effect'` sits between them and waits `this.fx.play(info, result, ctx)` frames. In F0, `fx` is
   `noopActionFx` (it returns 0), so present runs on the same frame as today.

   **Presented snapshot.** `BattleDisplayManager` keeps `presented: { hp: number; statuses: StatusEffect[] }[]` for
   both sides. It is updated only by `presentAction`, `statusFx.sync` and round resolution. Everything visual reads
   the snapshot, never the live state: the party `down` pose (`poseFor`, `:159-165`), enemy postures, the dying
   trigger (`updateEnemySprites`, `:225-234`), panel HP and enemy-list tints. So a target never goes `down`, dazed or
   fading before the effect's impact.

   Test (`tests/scenes/battle/presentedState.test.ts`, F0): with a stub `fx` whose impact is 18, a lethal FIRE leaves
   the target's sprite idle and opaque (no dying entry) for frames 0–17, and starts the fade at frame 18. The same for
   a KO'd party member's `down` pose.

   **Factories.** `fx` and `statusFx` come from `src/scenes/battle/fx/index.ts` (new: `createActionFx(layers,
   display)` and `createStatusFx(layers, display, battle)`, both no-op in F0). `ActionFx` also has
   **`playCue(id, sprite)`** (no-op in F0) for effects started by animation cues. `BattleScene` calls the factories
   once in `enter()`. Fd and Fe replace the factory bodies only, never `BattleScene`.
6. **Enemy attack target and cues.**
   - `startEnemyLunge` (`BattleAnimationController.ts:235-242`) passes the target sprite:
     `view.playAttack(i, this.targetSprite)`. `AiEnemyView.playAttack(i, target)` (new, forwarding to
     `poses.playAttack(i)`) ignores the target in F0. Fc implements the travel.
   - `EnemyPoseController` gains `onCue?: (i: number, cue: 'hold' | 'contact') => void`. It is raised when an
     attack's held telegraph starts and at contact. `AiEnemyView` forwards it to `ActionFx.playCue('glint' |
     'impact_dust', sprite)` and to the screen shake. In F0 nothing raises `hold`, `contact` is raised, and both cues
     do nothing.
   - **Split offsets:** `EnemyPoseController.state(i)` returns `{ pose, dx, dy, travelDx, travelDy }`. `dx` / `dy` are
     the lunge, recoil and shake part, **scaled** by `scaleFactor` and rounded once (as today). `travelDx` /
     `travelDy` are absolute screen px, **unscaled** (0 in F0). `AiEnemyView` adds both.
   - Each enemy stores its own `contactAt` and `totalFrames` for the current attack. `attackOutDone` and `update`
     read those instead of the global `ATTACK_OUT` / `ATTACK_FRAMES`, which stay exported as the travel-0 values.
7. **Monster frame names.**
   - `MonsterKeyframe` gains `'attack_raise'`.
   - `MonsterFrame` (`enemyChoreography.ts:8-10`) gains `'daze' | 'daze_b'`, which **join `MONSTER_FRAMES`**, and
     `'atk_raise_in' | 'atk_raise_b' | 'atk_swing' | 'atk_swing2'`, which **join `BOSS_FRAMES`** together with
     `'attack_raise'`. That is seven names; `atk_swing2` is item 14's new name for the heavy mid frame, so the existing
     `atk_mid` and its lock hashes stay untouched.
   - Fallbacks: `FRAME_SOURCE` becomes a chain (`FRAME_FALLBACK: Record<MonsterFrame, MonsterFrame>`, resolved until
     an atlas key exists):
     - `daze` → `hurt_in1` → `idle`;
     - `daze_b` → `daze`;
     - `atk_raise_in` → `atk_wind1`;
     - `attack_raise` and `atk_raise_b` → `atk_wind2`;
     - `atk_swing` → `atk_mid`;
     - `atk_swing2` → `atk_mid`.
   - `BattleArt.getMonsterFrames` gains a `hasRaise` flag (like `hasCast`): true when the sheet has its own
     `attack_raise`. `HEAVY_ATTACK` uses the raise frames only when it is set, and the `atk_wind2` coil otherwise
     (§3.7).
   - A new exported `LATE_FRAMES` set (the seven names) is excluded from the per-sheet key requirement in
     `tests/data/assetCoverage.test.ts`. Ff removes the exclusion when its atlas lands.
8. **Data fields and files:**
   - **`EnemyData`** (`src/types/index.ts:88-103`) gains:
     - `attack?: 'melee' | 'ranged'` (missing means melee);
     - `attackEffect?: string` (an effect id, for ranged);
     - `attackAnim?: 'heavy'` (item 7).

     Validation goes in the new `schemaValidationFx.ts`. `enemies.yaml` gets `attack: melee` on every enemy except
     `dragon: {attack: ranged, attackEffect: fire_breath}`, and `attackAnim: heavy` on `garland` and `lich`. These are
     data only; nothing reads them yet.
   - **`BattleSceneConfig`** (`BattleSceneTypes.ts`, in F0's ownership) gains `enemyStatus?: Record<number,
     StatusEffect[]>`.
   - **`assets/data/spell-effects.yaml`** (new; owner Fd): `effects`, `spells: {}`, `items: {}`, `attacks`. F0
     **seeds** `attacks: {fire_breath: fire_breath}` and a minimal `effects.fire_breath` (`kind: cone`, 28 frames,
     impact 16), so the `enemyAttack` data test passes from F0 on. Fd fills in the rest.
   - **`assets/data/status-visuals.yaml`** (new; owner Fe): `statuses: {}`.

     Both files get typed loaders in `DataLoader.ts` and validators that log and drop bad entries (`console.error`).
   - **`assets/data/kits.yaml`** (new; owner Fa after F0): `start` and `full` per class, copied from
     `tests/helpers/balanceData.ts:40-55`, plus `naked`. `balanceData.ts` reads it.
     `tests/data/kitsYaml.test.ts` asserts that **the old keys** (start for the 6 base classes, full for the 4 party
     classes) equal the old literals, so F0 is neutral and Fa can add keys (`lv2`, `arrive`, `full.monk`,
     `full.red_mage`).
   - **`DebugScenario`** gains `enemyStatus?: Record<number, string[]>`. It is passed through
     `BattleTrigger.triggerBattle` → `BattleSceneConfig.enemyStatus`, and applied in `BattleScene.enter` after
     `startBattle`. Unknown statuses log `console.error`.
9. **`src/scenes/battle/actorTint.ts` (new, owner Fe after F0).** One **multiplying** tint per actor sprite.
   - `setTint(sprite, source, rgb | null)` stores one colour per named source (`hero`, `pulse`, `status`, `dead`).
   - `sprite.tint` is the channel-wise product of all sources; with none it is white.
   - `ActiveHeroMarker`'s pulse (`ActiveHeroMarker.ts:64, 71`), the placeholder dead tint
     (`BattleDisplayManager.ts:212-218`), Fc's red heavy-attack pulse and Fe's status tints all go through it. So
     clearing one never wipes another; today `ActiveHeroMarker.hide` resets to white.
   - F0 converts the two existing callers, behaviour-neutral, and adds `actorTint.test.ts`.
10. **Dev clock (new `src/scenes/battle/battleDevClock.ts`, < 80 lines).** The existing `?enemyAnim=step` / `loop` and
    `&slow=N` (`enemyAnimPreview.ts:4-6, 20-25`) become **scene-wide**.
    - `BattleScene.update` passes its `dt` through the dev clock **before** anything else (`BattleScene.ts:168`).
    - In step mode every system pauses and advances one frame per `.` key: enemy poses, party choreography, effects,
      glints, shake, overlays, floating numbers and text holds.
    - `&slow=N` divides `dt` for all of them.
    - A new `?battleStep=1` gives step mode without the enemy loop driver.
    - It is dev only (`import.meta.env.DEV`), and the key listener is removed on exit, as today.
11. **Lazy scenes:** `main.ts` registers `config` and (dev only) `debugSandbox`, each pointing at a stub class in its
    own new file (`src/scenes/ConfigScene.ts`, `src/scenes/debugSandbox/DebugSandboxScene.ts`). The stub logs and
    pops itself. Fb and Fg own those files afterwards.
12. **`assets/data/debug-scenarios.yaml`:** the `f_*` scenarios below. The file is frozen after F0, and later changes
    go through the orchestrator (U revision 25).

   | id | mode | setup | used by |
   |---|---|---|---|
   | `f_gold_start` | field | `overworld`, entrance `cornelia`; WAR / THF / WHM / BLM at Lv 1 with the 400 G kit, 30 G, no items | 1 (E2E gold) |
   | `f_garland_lv2kit` | battle | the `lv2` kit (§3.2) at Lv 2, `{potion: 2}`, 0 G; `[garland]`; `assets/backgrounds/temple.webp` | 2 |
   | `f_garland_lv3kit` | battle | the same at Lv 3 | 2 |
   | `f_pace` | battle | WAR, THF, WHM (`cure`), BLM (`fire`) at Lv 3 with the 400 G kit; `[goblin, goblin, wolf]`; grassland | 6 |
   | `f_melee_rows` | battle | KNGT / NINJ / MSTR / RDWZ at Lv 30, no gear; `[goblin, wolf, skeleton, goblin, wolf, skeleton]` with `enemyAi` fight only; grassland | 3 |
   | `f_melee_large` | battle | the same party; `[ogre, troll, mummy]` | 3 |
   | `f_ranged` | battle | the same party; `[dragon, goblin]`; desert | 3, 4 |
   | `f_heavy_garland` | battle | 4 knights at **Lv 12, no weapons**, `chain_mail` only; `{potion: 9}`; `[garland]` with `enemyAi: {garland: [{type: fight, weight: 1}]}`; temple. Tuned so that **Garland acts at least 4 times in ≥ 95 % of seeds** and the party survives at least 4 of his attacks; F0 checks it with the balance sim helpers (the Lv and gear are adjusted until this holds) | 7 |
   | `f_heavy_lich` | battle | the same party tuned the same way against `[lich]`, fight only; shoreline | 7 |
   | `f_spells_white` | battle | a WHM at Lv 30 knowing every white spell in `spells.yaml`; members with `status: [poison]`, `[silence, blind]` and `hp: 0`; `[mummy, mummy]` (undead, so HARM lands) | 4 |
   | `f_spells_black` | battle | a BLM at Lv 30 knowing every black spell; `[ogre, ogre, troll]` | 4 |
   | `f_items_fx` | battle | items `{potion: 3, hi_potion: 2, ether: 2, antidote: 2, soft: 2, phoenix_down: 2}`; members hurt, poisoned, stoned and KO; `[goblin]` | 4 |
   | `f_status_enemies` | battle | the Lv 30 party; 7 goblins with `enemyStatus` `{0: [sleep], 1: [poison], 2: [stun], 3: [blind], 4: [silence], 5: [fear], 6: [stone]}` | 5 |
   | `f_status_party` | battle | members with `status` `[sleep]`, `[poison, blind]`, `[silence]`, `[fear]`; `[goblin]` with `enemyAi` fight only | 5 |
   | `f_status_combo` | battle | a **Lv 5** BLM (`slep`, `fire`, `hold`) and a Lv 5 WHM (`fear`), plus 2 Lv 5 fighters with no weapons; `[ogre, goblin]` with `enemyStatus {0: [poison]}`. The ogre (120 HP) survives several FIREs, so the overlays, the hurt from `daze` and the effects can be watched before it dies | 5 (overlay + hurt + spell fx + death fade) |
   | `f_enemy_casts` | battle | a Lv 5 party; `[goblin, goblin]` with `enemyAi: {goblin: [{type: magic, spellId: slep, weight: 1}]}` | 5 (party side, inflicted live) |

**F0 tests:**
- `battleLayers.test.ts`: the layer order, and that `hud` covers `actors`;
- `presentedState.test.ts`: the snapshot rule (item 5 above);
- `actorTint.test.ts`: the product of sources, and that clearing one keeps the others;
- `Settings.test.ts`:
  - default 5;
  - no `localStorage`: no warning;
  - a throwing or invalid store: one warning, then the default;
  - read once (a second `getSettings` doesn't touch storage);
  - the round trip;
- `schemaValidationFx.test.ts`: `attack` must be `melee` or `ranged`;
- `kitsYaml.test.ts`: the old keys equal the old literals;
- `DebugScenarioBattle.test.ts`: `enemyStatus` applies, and an unknown status logs;
- `battleDevClock.test.ts`: step mode gives `dt` 0 until `.`, then exactly 1; `slow=4` gives `dt / 4`;
- `enemyPoseFlow.test.ts` and `meleeContact.test.ts`: the compatibility edits above, still green;
- `wc -l` checks: `BattleDisplayManager.ts` < 250, `BattleAnimationController.ts` ≤ 308, `BattleStateMachine.ts`
  ≤ 592.

---

## 3. Items

### 3.1 Item 1: gold from battles is too low

> "After many battles and reaching Lv 2 they still hadn't got the 100 G needed for an extra spell."

**Root cause:**
- The act-1 gold rewards are FF1's own NES values:
  - Goblin (IMP) 6 G (`assets/data/enemies.yaml:16`);
  - Gr.Imp 18 (`:34`);
  - Wolf 6 (`:52`);
  - Gr.Wolf 22 (`:72`);
  - Skeleton (BONE) 3 (`:90`).
- Prices are FF1's too: a level 1 spell is 100 G (`src/systems/SpellPurchase.ts:5`), Potion 60 G
  (`items.yaml:430`), and the inn 30 G (`shops.yaml`, `innPrice: 30`). Starting gold is 400 (`PartyManager.ts:6`).
- The 400 G kit costs 370 (FIX_PLAN U §U1), which leaves **30 G**.
- Gold is the formation's sum (`BattleStateMachine.ts:575-579`), added on victory (`BattleTrigger.ts:91`). An escape
  pays nothing (`:75-80`).
- The fields table (`assets-src/tools/layouts/overworld_zones.py:14-18`) is mostly goblins and wolves. The sim
  measures **21.8 G per fields battle** and **29.5 G per approach battle**.
- XP is generous by comparison: the whole party reaches Lv 2 in a median of **5 battles** (p25 5, p75 6). That is
  about 110 G earned, so the sim party holds a **median of 144 G** at that moment (p10 102 G). Only 67 % of runs hold
  ≥ 130 G (a spell plus one inn).
- A real first-time player also pays for an inn stay and a potion (90 G) or runs from a fight. That puts most players
  under 100 G, which is the feedback.
- FF1 expected grinding here. As a reference point, the FF1 Pixel Remaster later added an optional gil multiplier (×0
  to ×4) for that reason.

**Fix (data only, `enemies.yaml`; decision FB-1):** raise the act-1 gold about 2×. XP stays as it is, so the levelling
pace and every XP-based bound are unchanged.

| Enemy | FF1 / today | New |
|---|---|---|
| goblin | 6 | **12** |
| wolf | 6 | **12** |
| gr_imp | 18 | **30** |
| skeleton | 3 | **10** |
| gr_wolf | 22 | **44** |

Garland's 250 G and every post-act-1 enemy are unchanged. Sim with the new values: 42.3 G per fields battle and
52.4 G per approach battle. At Lv 2 the party holds a median of **252 G**, p10 **174 G**, and 100 % of runs hold
≥ 130 G.

**"Gold in hand" (definition for the test):**
- It is measured at the end of the battle in which the **last** member reaches Lv 2, after that battle's reward and
  inn rule.
- The model **doesn't shop before that moment**: the `fieldPacing` campaign's `shop()` is disabled until Lv 2 for this
  measurement. So the number is what the player can spend.

**Acceptance (the test: 200 seeded campaigns on the `fieldPacing` model, 400 G kit, sensible play, its inn rule).**
Momus re-measured the new values on that model. The research sim's simpler model (6 fields battles then the approach,
inn when someone is down or HP < 45 %, 400 runs) is shown for comparison.

| Case | Bound | Old (research sim) | New, `fieldPacing` model (momus) | New (research sim) |
|---|---|---|---|---|
| median gold in hand at whole-party Lv 2 | **≥ 220 G** | 144 | **246** | 252 |
| p10 of that gold | **≥ 150 G** | 102 | **174** | 174 |
| share of runs with ≥ 190 G at Lv 2 (a 100 G spell after one inn and one potion) | **≥ 75 %** | < 10 % (p75 162) | **80.5 %** | ≈ 82 % |
| median battles to whole-party Lv 2 (XP unchanged) | 4–10 (the existing bound) | 5 | 5 | 5 |

**Tests:**
- **New `tests/balance/economy.test.ts`:** the three gold rows above, on the definition above. They fail on the old
  data (median 144 < 220).
- **`tests/balance/fieldPacing.test.ts:113-118`** ("200–1200 G after 40 battles, ≥ 7 of 8 purchases"):
  - Momus measured a mean final gold of **1184 G** with the new values, only 1.3 % under the old 1200 ceiling. The
    bound becomes **[measured − 25 %, measured + 25 %]**, about **890–1480 G**, rounded outwards and re-measured on
    the merged tree. Record the old mean in the header.
  - The purchase bound `≥ 7 of 8` stays, and a **new purchase-timing assertion** replaces the planned
    `bought === 8`, which would have passed on the old data too. The median battle at which the **4th purchase**
    (the third Cap) is made must be **≤ 9**. Old data, at about 22–30 G per battle, makes it later (about 12); the
    implementer measures both and keeps ≥ 1 battle of margin. If the old value doesn't fail, pick the earliest
    purchase index whose old median fails, and state it.
- **`tests/data/actOneBalance.test.ts`:** pins the five new `goldReward` values.
- Check `grep -rn goldReward tests` for tests that read the real data. Most use their own fixtures.

**Browser (E2E, no state edits):** `?mute=1&scenario=f_gold_start`.
- Fight on the overworld until all four members are Lv 2. Record the battle count, gold, inn stays and potions
  bought.
- Walk into Cornelia and buy one 100 G spell.
- **Pass:** the spell is affordable with no extra grinding beyond reaching Lv 2.

### 3.2 Item 2: Garland is too easy at Lv 2

> "Garland is too easy; he should still be a challenge at Lv 2; maybe more HP."

**Root cause:**
- U1 (decision U-1) tuned Garland to the **400 G kit with no potions**: 340 HP, attack 9, accuracy 15, 2 hits, 3 hits
  at ≤ 25 % HP (`enemies.yaml:221-244`).
- Measured then: sensible Lv 2 wins **96.75 %** and careless Lv 3 92 % (`tests/balance/garland.test.ts`).
- With item 1's gold the party arrives with more (a second spell, potions, caps), so he gets easier still. The sim
  gives sensible Lv 2 with the lv2 kit 95.8 %.
- The mage-survival bound (a full-HP Lv 2 mage survives one 2-hit attack ≥ 90 %) pins **attack ≤ 9 at 2 hits** (U §U1
  table: 95.5 % at 9, 87.4 % at 10). So the knobs left are HP and the phase.

**The new kit (`kits.yaml` `lv2`; what the item-1 gold buys at Lv 2):**
- the 400 G kit, plus **LIT for the Black Mage (100 G)**, plus **2 potions (120 G)**;
- that is 220 G of the median 252 G;
- the sensible policy already casts LIT.

The alternative of SLEP and the sleep policy measures within 3 points of it. A heavier "arrival" kit (lv2 plus 4 caps,
after the temple run) is measured as a reported case.

**Fix (data, `enemies.yaml:221-244`; decision FB-2):**
- `hp: 340 → 400`;
- `bossPhases[0]` becomes `{hpThreshold: 0.5, patternId: aggressive, message: "Garland's attacks grow fiercer!",
  hits: 3}` (from 0.25);
- attack 9, accuracy 15, 2 hits, XP and gold unchanged.

So he hits 3 times for the second half of the fight, which keeps the fight short and tense instead of padding it with
HP. Pure HP was measured too: 480 HP gives Lv 2 64.8 % but a median of 12 rounds (today 8). The phase variant gives 10.

**Sim at 400 HP / phase 0.5 → 3 hits** (400 seeds; old values at 340 / 0.25 in brackets):

| Case | Bound (≥ 3-point margin) | Sim |
|---|---|---|
| sensible Lv 2, lv2 kit (start + LIT + 2 potions) | **55–75 %** | 67.8 % (95.8) |
| sensible Lv 3, lv2 kit | **≥ 85 %** | 95.0 % (100) |
| full-HP Lv 2 W.MAG / B.MAG in cloth survive one 2-hit attack (4000 rolls) | **≥ 90 %** | unchanged, 95.35 / 95.63 % (attack and hits unchanged; the phase only starts at ≤ 50 % HP) |
| sensible Lv 2, 400 G kit, 0 potions (regression catch: "too easy") | **≤ 80 %** | 73.0 % (96.75) |
| temple run (2 battles, no inn), then Garland, Lv 2, lv2 kit | 40–58 % (reported) | 47.8 % (85.8) |
| arrival kit (lv2 + 4 caps), 3 temple battles, Lv 2 | 50–70 % (reported) | 57.5 % |
| sensible Lv 1, 400 G kit | **≤ 15 %** (replaces U's 25–55 %) | 7.3 % (36.3) |
| careless Lv 2 / Lv 3, 400 G kit | ≤ 20 % / 55–75 % | 12.8 / 64.0 % (52.8 / 92.0) |
| careless Lv 1, no gear | ≤ 10 % | 0 % |
| fight length, sensible Lv 2 lv2-kit wins | median ≤ 11 rounds | median 10, p90 12 (8 / 10) |

This **reverses U-1's "Lv 1 about one in three"** (U triage default 1), and must be reported to the user (FB-2). If a
bound below can't be met with a 3-point margin on the merged tree, stop and report; don't loosen a bound.

**Every existing `garland.test.ts` assertion, with its new bound.** "Momus" values were re-measured by the reviewer
at 400 HP / phase 0.5; the rest are the research sim's; all are re-measured on the merged tree.

| # | Assertion (line) | Old bound (old value) | New bound | New value |
|---|---|---|---|---|
| 1 | mage survival, W.MAG / B.MAG (`:64-66`) | ≥ 0.90 (95.35 / 95.63 %) | ≥ 0.90, unchanged | unchanged (attack and hits unchanged) |
| 2 | sensible Lv 2, 400 G kit, 0 potions (`:69-70`) | ≥ 0.70 (96.75 %) | **0.60–0.80** (the upper bound catches "too easy" and fails the old data) | 73.0 % (momus) |
| 3 | sensible Lv 2, full kit, 3 potions (`:69, 71`) | ≥ 0.97 (100 %) | ≥ 0.97, kept (ceiling-limited) | 100 % (momus) |
| 4 | sensible Lv 1, 400 G kit (`:74-77`) | 0.25–0.55 (36.25 %) | **≤ 0.15** (replaces U-1's band) | 7.3 % |
| 5 | sensible Lv 3, full kit, 3 potions (`:80-81`) | ≥ 0.97 (100 %) | ≥ 0.97, kept | 100 % (momus) |
| 6 | Lv 2 full-kit win lasts ≥ 3 rounds in ≥ 90 % of wins (`:84-95`) | ≥ 0.90 (100 %, median 8) | ≥ 0.90, kept; the median is recorded | re-measured (expected 100 %) |
| 7 | careless Lv 1, no gear (`:97-98`) | ≤ 0.10 (0 %) | ≤ 0.10, kept | 0 % |
| 8 | careless Lv 1, 400 G kit (`:101-102`) | ≤ 0.07 (3 %) | **≤ 0.04** | 0.25 % (momus) |
| 9 | careless Lv 2, 400 G kit (`:105-108`) | 0.45–0.60 (52.75 %) | **0.05–0.20** | 12.8 % |
| 10 | careless Lv 3, 400 G kit (`:105, 110-111`) | 0.85–0.97 (92 %) | **0.55–0.75** | 64.0 % |
| 11 | sensible Lv 1, full kit, 0 potions (`:114-115`) | ≥ 0.95 (100 %) | ≥ 0.95, kept (4.25-point margin) | 99.25 % (momus) |
| 12 | temple run, then Garland, Lv 2, 400 G kit, 0 potions: `templeRunWinRate(2, 2, 'start', 0)` (`:118-119`) | ≥ 0.70 (89 %) | **0.55–0.70** | 61.25 % (momus) |
| 13 | temple run, full kit, 3 shared potions, Lv 2 / Lv 3 (`:122-124`) | ≥ 0.95 each (100 %) | ≥ 0.95 each, kept | 100 % (momus) |
| 14 | SLEP every round (`:133-159`): ≤ 5 % of battles with no Garland turn; acted share 0.40 ± 0.05; "always wakes" (`:154`) | as listed (0.402) | lockout ≤ 0.05 kept; acted share **re-centred on the new measurement** ± 0.05; the `:154` "always wakes" rule re-checked at 400 HP | re-measured |

**Why row 12 is 0.55–0.70.** The bare 400 G kit after a temple run (no inn) is U's E2E path, and it is now harder by
design.
- The lower bound 0.55 (6.25 points under 61.25 %) keeps "more likely than not": a careful player who skips the
  shops still wins most tries.
- The upper bound 0.70 (8.75 points over) fails the old data (89 %) and catches a regression back to "too easy".
- The new-kit temple case (40–58 %, below) is the "real challenge" number; this row is its floor without potions.

**New assertions:**

| Case | Bound | Value |
|---|---|---|
| sensible Lv 2, lv2 kit | 0.55–0.75 | 67.8 % |
| sensible Lv 3, lv2 kit | ≥ 0.85 | 95.0 % |
| temple run, Lv 2, lv2 kit | 0.40–0.58 | 47.8 % |
| arrival kit (lv2 + 4 caps), 3 temple battles, Lv 2 | 0.50–0.70 | 57.5 % |
| median rounds of sensible Lv 2 lv2-kit wins | ≤ 11 | 10 |

**Tests:**
- **`tests/balance/garland.test.ts`:**
  - the table above;
  - a new header and describe title;
  - `garlandWinRate` and `templeRunWinRate` take a `KitName` that includes `'lv2'` and `'arrive'`, read from
    `kits.yaml` with their potions.
  - Old data fails rows 2, 4, 9, 10 and 12 and the new lv2-kit row (95.8 % > 75 %).
- **`kits.yaml` (Fa):** `full` gains **monk** and **red_mage** entries (the sandbox and `makeParty` with other
  compositions need them):
  - monk: `wooden_nunchaku`, `leather_armor`, `cap`;
  - red_mage: `rapier`, `leather_armor`, `cap`, with spells `cure` and `fire`.

  Each must equip with no refusal (checked by `makeMember`).
- **`tests/battle/BossPhase.test.ts:3, 32, 37`:** the threshold is read from
  `enemy('garland').bossPhases[0].hpThreshold` (`floor(threshold × hp)`) instead of the literal 0.25.
- **`tests/data/actOneBalance.test.ts:86-95`:** pins 400 HP, the 0.5 phase and the unchanged rest.

**Browser** (sensible play: CURE below half, LIT/FIRE while he is above 12 HP, a potion below 35 % when no CURE is
left, otherwise Fight):
- `?mute=1&scenario=f_garland_lv2kit`: 5 fights; expect about 3 wins, and at least 1 loss in 5. Record HP at the
  phase line and the rounds.
- `?mute=1&scenario=f_garland_lv3kit`: 3 fights, at least 2 wins.
- The sandbox (item 8): Lv 2 with the start kit, 3 fights. Record them.
- The full E2E is §6 probe A1.

### 3.3 Item 3: enemies should approach the party unless they attack at range

> "Party members lunge at enemies; enemies should do the same (approach the party) unless they have ranged attacks
> (e.g. a dragon breathing fire)."

**Root cause:**
- The party's melee advance runs from its place in line to the target's right edge: 150–900 px
  (`attackChoreography.ts:15-16, 32-36`), plus the row rise (U3, `:20-30`).
- The enemy attack is a fixed 31-frame lunge of `L` = **24–40 px** (`enemyChoreography.ts:28-36, 85`;
  `docs/ENEMY_ANIM_PLAN.md` §3.2, D2), toward nothing in particular. `EnemyPoseController.playAttack(i)` takes no
  target (`EnemyPoseController.ts:84-89`), and `startEnemyLunge` never measures one
  (`BattleAnimationController.ts:235-242`).
- D5 (`docs/ENEMY_ANIM_PLAN.md:591-601`, `AiEnemyView.ts:104-107`) raises a lunging enemy among the enemy sprites only.
  Party sprites are added after the enemies (`BattleDisplayManager.ts:62-67, 115-121`), so an enemy that reached a
  hero would be drawn behind it.

**Fix (Fc):**
- **Data (F0):** every enemy has `attack: melee` except `dragon` (`ranged`, `attackEffect: fire_breath`; Fd draws it).
  Decision FB-4 covers the lich: melee by default, since he swings a glaive (`monsters.yaml:144-149`).
- **Travel (new `src/scenes/battle/enemyReach.ts`, pure, < 80 lines):**
  - `travel = clamp(targetBounds.left + ENEMY_REACH_OVERLAP − enemyOpaqueRight, 0, MAX_ENEMY_TRAVEL)`, with
    `ENEMY_REACH_OVERLAP = 24` (as `REACH_OVERLAP`) and `MAX_ENEMY_TRAVEL = 1000`.
  - `enemyOpaqueRight` is the sprite's x plus `opaqueRight × scale`. `opaqueRight` is new per-sheet atlas meta (the
    idle keyframe's rightmost opaque column), written by Ff's build. Until then the sprite bounds' right edge is used.
  - `rise = clamp(targetFeetY − enemyFeetY, −400, 400)`, the U3 rule mirrored. A `floating` sheet keeps its hover
    above the target's feet.
  - Ranged enemies and placeholders: travel 0.
- **Timeline (`enemyChoreography.ts`, a new `MELEE_ATTACK` builder; `ATTACK` stays as the ranged / in-place table):**

  | Seg | Frames | Pose | dx |
  |---|---|---|---|
  | wind | 5 + 6 | `atk_wind1`, `atk_wind2` | 0 → −L/4 (as today) |
  | travel | N = clamp(round(8 + travel/60), 10, 24) | `atk_wind2` / `atk_mid` alternating every 4 frames | −L/4 → travel − L/4, ease-in; hop of 10 px (small), 6 (large) or 3 (boss), × `scaleFactor` |
  | strike | 3 + 2 + 6 | `atk_mid`, `attack`, `attack` held | → travel + 0.75L at the **first `attack` frame (contact = 14 + N)**, then travel + L two frames later |
  | follow | 4 + 5 | `atk_follow`, `atk_recover` | travel + L → travel + 0.58L → travel |
  | return | 16 | `atk_recover` for 5, then `idle` | travel → 0, ease-out, hop 8 (like the party's `returnAt`) |

  - Total 47 + N frames.
  - `dy` follows `rise` in step with the horizontal progress, as `advanceAt` does for the party
    (`attackChoreography.ts:81-85`).
  - Travel is in absolute screen px; only the hops and L scale with `scaleFactor`. `state(i)` returns the two parts
    separately (F0 item 6): `dx`/`dy` are the scaled lunge, hop and recoil, rounded once; `travelDx`/`travelDy` are the
    unscaled travel and rise.
  - Each enemy stores its own `contactAt` (14 + N) and `totalFrames` (47 + N) when `playAttack` starts.
  - `attackOutDone` stays true at contact, and `isAttacking` holds until the return ends, so `round_end` waits
    (`BattleAnimationController.ts:175`).
- **Death or hit while away:** a hit during the enemy's own attack is ignored (existing rule). If it dies away from
  home (only possible through future counters), `dyingAt` holds the current offset instead of easing back across the
  screen.
- **D5′ draw order (supersedes D5 for melee travel; decision FB-5):**
  - While a melee enemy is in its attack sequence it is the **top child of `actors`**, above every enemy and party
    sprite. It stays below all of `fx` (numbers, flashes, overlays, spell effects) and below `hud` (the message
    window). The windows in `ui` sit under the actors as today; the travel never reaches the bottom strip (party
    feet ≤ 740, strip from 780).
  - On idle, `restoreOrder` puts the actors back in their original order (enemies by index, then party). A
    `swapSprite` during travel stays safe because the restore works from index order (as D5).
  - Ranged enemies keep D5 (raised among enemies only).
- **API:** `AiEnemyView.playAttack(i, target)` measures with `enemyReach` and calls `poses.playAttack(i, { travel,
  rise })`. `EnemyPoseController` stores both per enemy. `enemyAnimPreview` passes the first living party sprite.

**Tests:**
- **`tests/scenes/battle/enemyChoreography.test.ts`** (extended):
  - melee with travel 600: contact frame = 14 + N(600); there `travelDx` = 600 and the lunge part = 0.75L; two
    frames later the lunge part is L;
  - dx rises monotonically through the travel apart from the hop;
  - the last frame is dx 0;
  - total 47 + N;
  - the ranged table is unchanged.
  - Old: no travel parameter.
- **New `tests/scenes/battle/enemyTravel.test.ts`:**
  - on real layout boxes (`computeEnemyLayoutAi` for `f_melee_rows`' 6 enemies) and the real `PARTY_X` /
    `PARTY_FEET_Y`, each enemy attacking each hero has, on its contact frame, its opaque right edge within **50 px**
    of the target's left edge + 24 (the 0.75L contact leaves 0.25L, at most 10 px for the lich's L = 40, plus 30 px of
    layout tolerance and margin), and its feet within 30 px of the target's feet;
  - with 9 large enemies at `scaleFactor` 0.5 the same holds;
  - a travelling Garland and lich: on every frame of the attack, the sprite is in `actors` and the message window in
    `hud`, so the message text is drawn over any overlap (the hierarchy is asserted, and the text's bounds are
    checked for at least one frame where they intersect).
  - Old: about 900 px short.
- **`tests/scenes/battle/AiEnemyView.test.ts`** (updated to the new spec, not deleted):
  - during a melee attack the attacker is the last child of the actors parent, above a party sprite, and below a
    child of `fx`;
  - order is restored on idle, also after a swap mid-travel;
  - a ranged attacker stays below party sprites (D5).
- **`tests/scenes/battle/enemyPoseFlow.test.ts`:** the action resolves on frame 14 + N, and `round_end` waits for
  47 + N.
- **New `tests/data/enemyAttack.test.ts`:** every enemy has `attack ∈ {melee, ranged}`, and every ranged one has an
  `attackEffect` defined in `spell-effects.yaml` `attacks`. Old: no field.

**Browser:**
- `?mute=1&scenario=f_melee_rows` with `&enemyAnim=loop`, then a real round. Every enemy hops to its target, strikes
  at the hero's row and returns. Screenshot the contact frames for goblin → party 0 and wolf → party 3.
- `f_melee_large`: an ogre reaches the far hero and draws over it; the floating number draws over the ogre.
- `f_ranged`: the dragon attacks in place and its breath crosses to the target (Fd); the goblin travels.
- `anim_crowd`: nine half-size trolls travel and return without overlapping glitches; record the fps.

### 3.4 Item 4: no spell effects

> "No spell effects; hard to tell what a spell did."

**Root cause:**
- The only spell visual is `BattleEffects.elementFlash` (`BattleEffects.ts:35-51`): an 18-frame, 0.6-alpha tinted copy
  of the target's silhouette.
- It is started only for damage events that carry `spellElement` (`BattleAnimationController.ts:264`). Cure's
  `element: none` maps to white through the `?? 0xffffff` fallback (`:36`).
- Status, buff, debuff, resist, cure-status and revive spells emit no damage event (e.g. `SpellStatus.ts:43-44`
  only applies the status and adds a message). They show **nothing** but a text line.
- Items behave the same way.
- Everything happens on the resolve frame (`executeAction`, `:184-200`), so even where a flash exists it lands at the
  same moment as the number, with no build-up.

**Fix (Fd):**
- **Engine (`src/scenes/battle/fx/`, new, each file < 250 lines):**
  - `ActionFx.ts` implements F0's hook. `play(info, result, ctx)` picks the effect for the action:
    - for a spell, `spells[spellId]`, else `byEffect[spell.effect]` with the element;
    - for an item, `items[itemId]`;
    - for a ranged enemy attack, `attacks[attackEffect]`.
  - It reads `info.spellId` / `info.itemId` (F0 item 4), never message text.
  - It spawns the effect on every sprite of the **target set** (F0 item 4: `targetId`, or the living side captured at
    announce for `all` / `all_allies`), staggered 4 frames for all-target spells, in `fx.spell`.
  - For `inflict_<status>` it uses the status diff: the burst plays on every target, and the overlay attaches only
    where the status **landed**.
  - `playCue(id, sprite)` plays `glint` and `impact_dust` for item 7's cues.
  - It returns the **impact frame**. `presentAction` runs then, so the number, the glow (`elementFlash`, kept as the
    impact flash), the hurt pose and the result line land on the effect's hit.
  - `emitters.ts`: pure, seeded-RNG particle kinds:
    - `rise` (flames, sparkles, bubbles), `fall` (shards), `bolt` (a jagged polyline from the top of the screen),
      `ring` (expanding pixel rings), `orbit` (stars), `burst`, `beam` (a column of light), `cone` (breath),
      `projectile` (a sprite flying from A to B), `chevrons` (arrows up or down);
    - every position is snapped to the 2x pixel grid (2 screen px);
    - **pixel rules:** sprites draw at integer scales only (×2, or ×4 for big bursts); rotation is 0° or 90° only;
      no blur and no `ColorMatrixFilter` or other filters; fades are stepped alpha (0, 0.25, 0.5, 0.75, 1), never
      smooth gradients drawn in code.
  - `fxAtlas.ts`: loads `assets/sprites/battle-fx.{png,json}` (nearest). Missing art falls back to `Graphics`
    rectangles in the same palette colours with one `console.warn`, as missing battle art does today.
- **Art: generated, free (decision FB-6, default).**
  - New `assets-src/fx/` (`glyphs.py`, `build_fx.py`, `selftest.py`), registered as build stage `fx` in
    `build_assets.py` (≤ 3 lines).
  - It draws 8–24 px native glyphs in the **SNES 15-bit palette** (`assets-src/snes_palette.py` ramps, light from the
    top-left, darkest→lightest), 2–4 frames each, and writes `assets/sprites/battle-fx.png` (×2 nearest) and `.json`.
  - The glyphs: flame tongue, ice shard, spark, bolt joint, sparkle (4-point), ring segment, bubble, Z (3 sizes),
    star, skull wisp, sweat drop, ellipsis bubble, ink puff, question mark, feather, chevron, dust puff, glint, plus
    the status icons of §3.5, plus two that used to be loose words:
    - **heat shimmer:** a 2-frame sheet of 1-px wavy vertical lines in the fire ramp's two lightest colours, drawn over
      the flames at 50 % stepped alpha;
    - **glow:** a 3-frame dithered halo (a 50 % checker ring, 2 px thick) in the effect's lightest colour; it replaces
      the "soft glow" wording for `heal`.
  - Deterministic: the same bytes on two runs. Binary alpha, every pixel on the palette.
  - No paid art and no Bedrock.
- **Data (`assets/data/spell-effects.yaml`):** `effects` define each effect: emitter kind, glyph, palette ramp,
  count, frames and impact frame.

  | Effect id | Used by | Look (60 fps) | Frames / impact |
  |---|---|---|---|
  | `fire` / `fire_all` | FIRE, FIR2 | 4–6 flame tongues rising from the feet, red→orange→yellow ramp, the `shimmer` glyph over them | 30 / 18 |
  | `ice` / `ice_all` | ICE, ICE2 | 5 shards falling and converging, a white frost burst at impact | 32 / 20 |
  | `lightning` / `lit_all` | LIT, LIT2 | a 2-flicker bolt from the top edge, a 3-frame screen tint (≤ 2 flashes per cast, no strobing) | 24 / 10 |
  | `holy` | HARM, HRM2 | white rings expanding from the target, sparkles | 30 / 16 |
  | `heal` / `heal_all` | CURE, CURE2, CURE3, HEAL, Potion, Hi-Potion | green-white sparkles rising around the ally, the `glow` halo | 32 / 20 |
  | `revive` | LIFE, Phoenix Down | a beam of light descending, a feather spiral | 44 / 30 |
  | `buff_def` / `buff_evade` / `buff_atk` / `buff_speed` | FOG, RUSE, INVS, TMPR, FAST | rising chevrons (DEF blue, evade cyan, ATK red, speed yellow), plus a small floating `DEF+` / `EVA+` / `ATK+` / `SPD+` label in the numbers layer | 28 / 14 |
  | `debuff_evade` / `debuff_speed` / `debuff_morale` | LOCK, LOK2, SLOW, FEAR | falling purple chevrons (FEAR: skull wisps) | 28 / 14 |
  | `resist_<elem>` | AFIR, AICE, ALIT | a hex shield of the element's colour | 30 / 16 |
  | `inflict_<status>` | SLEP, SLP2, HOLD, CONF, DARK, MUTE | a burst in the status colour; at impact the status overlay (§3.5) attaches if the status landed | 26 / 14 |
  | `cleanse` | LAMP, PURE, AMUT, Antidote, Soft | sparkles in the cured status's colour; the overlay fades at impact | 26 / 14 |
  | `ether` | Ether | blue sparkles | 26 / 14 |
  | `drain` (hook, no spell uses it) | — | particles from the target to the caster | 36 / 24 |
  | `fire_breath` | dragon (`attack: ranged`) | a cone of flame from the sprite's front to the target | 28 / 16 |
  | `glint`, `impact_dust` | item 7 (heavy attack) | a 4-frame star at the weapon top; a dust burst at the target's feet | 8 / 0; 14 / 0 |

  `spells` maps every spell id in `spells.yaml` and `items` every battle-usable consumable to an effect id. A miss or
  an immune target plays the effect and then shows "Miss" or "No effect" at impact, as today.
- **Timing composition:**
  - Party casts: the existing 24-frame `castAt` step-forward (`attackChoreography.ts:108-115`), then the `effect`
    phase until impact, then present, then the results, then `castReturnAt`.
  - Boss casts: the spell resolves at `CAST_OUT` (start of the cast hold) and the effect plays during the hold.
  - Non-boss casts (D4): during the in-place attack frames.
  - The effect's tail (after impact) runs alongside the result line.
  - Effect lengths are **not** scaled by message speed. Only text holds are (§3.6).

**Tests:**
- **New `tests/data/spellEffects.test.ts`:**
  - every spell in `spells.yaml`, every battle consumable in `items.yaml` and every `attackEffect` resolves to an
    effect in `effects`;
  - every effect has `impact < frames` and a glyph present in `battle-fx.json`.
  - Old: no file.
- **New `tests/scenes/battle/actionFx.test.ts`** (fake layers, seeded RNG):
  - FIRE on enemy_0 spawns emitter children in `fx.spell` at frame 0, and the floating number appears at frame
    **impact** (18), not 0;
  - SLEP on 3 enemies stagger-starts at 0 / 4 / 8;
  - all children are removed by the last frame.
  - Old: the number appears on the resolve frame.
- **`enemyPoseFlow.test.ts` / `BattleScene.test.ts`:** a cast's result line shows at step-forward end + impact.
- **`assets-src/fx/selftest.py`** (RED first):
  - fails a glyph with an off-palette pixel, semi-alpha or a 1-px border hit;
  - two builds give equal bytes;
  - `battle-fx.png` dimensions ≤ 4096.

**Browser:** `?mute=1&scenario=f_spells_white`, `f_spells_black` and `f_items_fx`.
- Cast every spell and use every item once. Scene-wide step-mode screenshots (`&battleStep=1`, F0 item 10) of each effect at frame 0, impact and
  tail.
- Every effect reads as its element or kind at 1x, and the number appears at impact.
- `f_ranged`: the breath, then the hit.
- Record the fps with FIR2 on 3 large enemies; it must stay ≥ 55.

### 3.5 Item 5: statuses are invisible (with the user's clarification)

> "If an enemy has an effect, there is no way to tell. Perhaps we need to add a …" Clarified: icons or labels, plus
> (a) a stunned or afflicted **pose** for enemies while a disabling status is active, and (b) a **per-status visual**:
> sleep zZz, poison bubbles, stone grey, frozen blue, and distinct loops for stun, blind, silence, fear and confuse;
> data-driven; on the party where sensible; composing with hurt flashes, death fades and the item 4 effects.

**Root cause:**
- The enemy side shows no status at all:
  - `freezeOf` (`AiEnemyView.ts:12-15`) only stops breathing for sleep, stun and stone (D6,
    `docs/ENEMY_ANIM_PLAN.md:586-590, 810`), and the frozen frame is the plain `idle` (`enemyChoreography.ts:134-137`);
  - the enemy list groups by species with no status (`enemyList.ts:11-23`);
  - the only signal is the one message line "X is affected by sleep!" (`SpellStatus.ts:44`).
- The party side shows a text tag in the panel (`BattlePartyPanel.ts:16-18, 83-84`, at most 2), and nothing on the
  sprite (`BattleDisplayManager.ts:159-165` has no status pose).
- **Data facts:**
  - `StatusEffect` is `poison | stun | sleep | blind | silence | death | stone | fear` (`StatusEffects.ts:1`).
  - There is **no `frozen` and no `confuse`** status. CONF is `effect: status_stun` (`spells.yaml`, the `conf`
    entry). Both are planned as reserved hooks.

**Fix part (a), the dazed pose (Ff art + Fe runtime; supersedes D6's "freeze on the base idle" for sleep and stun):**
- **Two new generated frames per base rig, from one shared recipe:**
  - `daze`: `{src: idle, toward: hurt, t: 0.25, moves: all, pins: feet, dy: 2, tweaks: {head: [1, 2]}}`;
  - `daze_b`: the same with `dy: 3` (a slow sway).

  Both obey the near-keyframe rule (|t| ≤ 0.35). `head` in the recipe is a symbolic joint resolved per body template
  (below).
- **Framework work in Ff (budgeted, about 3 h, before any rig):**
  1. **Split first.** Move `RECIPES`, `FRAME_SOURCE`, `SEQUENCES`, `SPAN` and the frame lists out of
     `monster_anim.py` (`:25-51`) into a new `assets-src/gen/monster_recipes.py`, imported back. `monster_anim.py`
     drops about 35 lines and stays < 250 with the additions. `selftest.py` passes unchanged after the move.
  2. **Shared recipe tweaks.** `generate()` (`monster_anim.py`, the `tweaks = dict(over.get("tweaks") or {})` line in
     the recipe loop) today reads tweaks only from the per-rig override. It merges the recipe's own `tweaks` first,
     then the rig's override (per joint, added).
  3. **The head joint per template.** `head` resolves to `crown` and `neck` for bipeds (rigs: goblin, skeleton,
     pirate, ogre, troll, mummy, vampire, garland, lich). For the quadruped and bird templates (`wolf`, `dragon`,
     `cockatrice` have no `crown`) it resolves to the template's head-chain joints named in the `rig_templates.py`
     docstring. A rig with no resolvable head joint **raises an error naming the rig**; it is never skipped silently.
  4. **Tables:** `SPAN['daze'] = ('idle', 'hurt')`; `SEQUENCES['daze'] = ['idle', 'daze', 'daze_b']`. The
     continuity checks in `anim_rules.py` iterate `SEQUENCES` by prefix, so the new `daze` and `heavy` (§3.7)
     sequences are checked like `attack` and `hurt`; a test asserts both are visited.
  5. **Hold fallback:** a rig that can't pass may declare `holds: [{frame: daze, reason}]`, which aliases `daze` to
     **`hurt_in1`** (an existing in-between that already reads as a flinch), not to `idle`. `daze_b` then aliases to
     `daze`. The TS fallback chain (F0 item 7) matches.
- **No new approved frame and no paid image.** The recipe is shared, so a rig needs no edit unless a check fails;
  then a per-rig `frames.daze` override (tweaks, `t`), at most 2 iterations, then the hold.
- **Cost per monster:** 0 images. About 0.5 h per base rig (build, `monster_anim.py check`, review sheet, image-only
  reviewer, NEW_MONSTER_GUIDE §3.4). That is 12 base rigs (goblin, wolf, skeleton, pirate, ogre, troll, mummy,
  cockatrice, vampire, dragon, garland, lich), about 6 h, plus the 3 h of framework work. Variants (`gr_imp`,
  `gr_wolf`, …) inherit at 0. The atlas grows by 2 cells per sheet; the ≤ 4096 px page check still applies. Existing
  frames and their lock hashes are unchanged: the lock diff shows only the added `daze` / `daze_b` keys.
- **Runtime:**
  - `freezeOf` becomes `postureOf(presentedStatuses)` → `'none' | 'daze' | 'stone' | 'tremble'`. It reads the
    presented snapshot (F0 item 5), not the live tracker.
  - `idleFrame` returns:
    - `daze` / `daze_b`, alternating every 48 frames, for `daze`;
    - `idle` with no breathing for `stone`;
    - the breathing idle for `tremble`.
  - **Tremble without drift:** the ±1 px offset is a pure function of the clock, `[0, 1, 0, −1][floor(clock / 4) % 4]`,
    added to `dx` on top of the base position each frame and never accumulated into it. It averages 0 and is 0 when
    fear ends.
  - A dazed enemy still recoils when hit (the hurt sequence), then returns to `daze`, never `idle`. A stoned enemy
    shows no pose change and no offset when hit (as D6).
  - E1 is unchanged: a lost turn plays no wind-up; the overlay pulses once at its turn message.

**Fix part (b), per-status visuals (Fe; data in `assets/data/status-visuals.yaml`):**

| Status | In data | Enemy posture | Overlay (loop, `fx.status`) | Tint / filter | Icon | Party |
|---|---|---|---|---|---|---|
| sleep | yes | `daze` | "zZz": Z glyphs rising from the head, small→large, every 40 frames, lilac/white ramp | — | Z | overlay; posture: `ready` held, no breathing (FB-7) |
| stun | yes | `daze` | 3 yellow stars orbiting the head, 48-frame period | — | spark | as enemies |
| poison | yes | normal | 2–3 green bubbles rising from the body and popping | a faint green pulse (tint 0xc8ffc8, 6 frames every 60) | drop | same |
| stone | yes | idle, no breathing, no recoil | none | **fixed 5-bit grey mapping** (no filter): a cached grey texture per frame (below) | stone | same; party `ready` frozen |
| blind | yes | normal | 2 dark ink puffs drifting round the head | — | eye-bar | same |
| silence | yes | normal | an "…" speech bubble with a red slash bobbing beside the head | — | mute | same |
| fear | yes | `tremble` | blue sweat drops falling from the head | a pale-blue tint 0xd8e4ff | sweat | same, ±1 px tremble |
| frozen | **reserved** | idle, no breathing | frost crystals at the outline corners | tint 0x9cc8ff | flake | hook only (`reserved: true`; no `StatusEffect` change) |
| confuse | **reserved** (CONF is stun today) | normal | 2 question marks circling | — | ? | hook only |
| death | KO | n/a | n/a | n/a | — | `down` pose and the panel `KO` tag (unchanged) |

- **Anchor:** the head is the sprite's top-centre. For monsters it comes from new per-sheet atlas meta `head: [x, y]`
  (the topmost opaque row's centre in the idle key, written by Ff's build), else the bounds' top-centre. For the
  party it is the bounds' top-centre.
- **Icons:** 12×12 native (24 px) glyphs from the fx atlas, at most 3 per actor, in priority order
  `stone > stun > sleep > fear > silence > blind > poison`. They sit in a row 8 px above the head, and above the
  active-hero marker for the party. The party panel tags stay. The enemy target cursor line shows the tags: "Goblin B
  SLP PSN".
- **Composition rules:**
  - Overlays and icons live in `fx.status`. Draw order inside `fx`: status < spell < flash < numbers.
  - Each frame they follow the sprite's position (lunge, travel, shake, recoil), like `spellFlashes`
    (`BattleEffects.ts:86-90`).
  - Their alpha is `base × sprite.alpha`, so they fade with the death fade (`BattleEffects.ts:66-79`). They hide when
    the sprite is invisible, and are destroyed when the actor's sprite is hidden after death.
  - **Stone grey mapping (recorded here; no `ColorMatrixFilter`, no filters at all).** Each frame texture of a
    stoned actor is swapped for a grey copy, built once per texture and cached in `fx/stoneTextures.ts` (a canvas
    pass).
    - Every opaque pixel's luma (0.299 R + 0.587 G + 0.114 B) maps to one of 8 greys, the 5-bit levels 3, 7, 11, 15,
      19, 23, 27, 31 converted as `snes_palette.c15` does, `(v << 3) | (v >> 2)`: **24, 57, 90, 123, 156, 189, 222,
      255** (R = G = B).
    - The bands are equal: luma 0–31 → 24, 32–63 → 57, …, 224–255 → 255.
    - The outline colour (the darkest band) stays 24, so the silhouette reads.
  - The element glow, a separate sprite copy, takes the coloured texture of the current frame (not the grey one), so
    hits on a stoned enemy still read.
  - **Tints** (poison pulse, fear, reserved frozen) go through F0's multiplying `actorTint` with source `status`. They
    never overwrite the hero pulse or Fc's red heavy-attack pulse, and clearing a status clears only its source.
    `actorTint` is Fe's file in wave 2.
  - Overlays attach and detach in `statusFx.sync()`, called by `presentAction`. So a SLEP's zZz appears at the
    spell's **impact frame**, a wake-up at its result line, and a cure fades the overlay over 12 frames at the
    cleanse impact.
  - Sleeping or stunned enemies never travel, because they lose the turn.

**Tests:**
- **New `tests/scenes/battle/statusFx.test.ts`**, table-driven over `status-visuals.yaml`. For each real status, on a
  fake enemy and a fake party sprite:
  - after apply plus `sync`, an overlay of the listed emitter kind is in `fx.status`, with the icon count and the
    tint (or, for stone, the grey texture) listed; no actor has a `filters` entry;
  - after removal plus `sync`, it fades out by frame 12 and is destroyed;
  - with `sprite.alpha = 0.5` the overlay alpha is ≤ 0.5 × base; with `sprite.visible = false` it is hidden.
  - Old: no overlays.
- **`AiEnemyView.test.ts` / `enemyChoreography.test.ts`** (updated, D6 → postures):
  - sleep and stun show `daze` / `daze_b` (not `idle`), still play hurt when hit, and return to `daze`;
  - stone keeps `idle`, offset 0, no recoil;
  - fear gives dx ∈ {−1, 0, 1}, and after 400 frames of fear the base position equals the start (no drift).
  - Old: `idle`.
- **New `tests/scenes/battle/stoneTextures.test.ts`:** a synthetic texture maps to exactly the 8 recorded greys by
  luma band, transparency is kept, and the cache returns the same texture on a second call.
- **`actorTint.test.ts`** (Fe extends it): poison pulse × hero pulse multiply; clearing poison leaves the hero pulse.
- **`actionFx.test.ts`:** SLEP's overlay attaches at its impact frame, not at resolve.
- **`tests/data/statusVisuals.test.ts`:** every `StatusEffect` except `death` has an entry; `reserved` entries are not
  in `StatusEffect`; every icon and glyph is in `battle-fx.json`.
- **Icons and glyphs:** Fe adds its icons and overlay glyphs to `assets-src/fx/glyphs.py` after Fd merges, and **owns
  the `battle-fx.*` rebuild** from then on (`build_assets.py fx`, twice, no diff the second time; `assets-src/fx/selftest.py`).
- **Art (Ff):**
  - `monster_recipes.py` split: `selftest.py` passes before and after the move with no other change;
  - a rig with no resolvable head joint fails `monster_anim.py check` with the rig's name (synthetic case in
    `selftest.py`);
  - `assetCoverage.test.ts`: every sheet has `daze` and `daze_b` (the `LATE_FRAMES` exclusion removed);
  - `monster_anim.py check --all` passes;
  - `selftest.py` gains a synthetic `daze` render that fails a feet move of 1 px and |t| > 0.35;
  - the style lock is unchanged.

**Browser:**
- `?mute=1&scenario=f_status_enemies`: one screenshot showing all seven: zZz, bubbles, stars, ink, bubble, sweat, and
  grey stone. Step-mode (`&battleStep=1`, which also steps the overlays) frames of `daze` / `daze_b` for goblin, wolf and skeleton.
- `f_status_party`: the four party overlays and the panel tags.
- `f_enemy_casts`: the goblins' SLEP lands on a hero; the zZz appears at the impact frame.
- `f_status_combo`: SLEP the poisoned goblin (zZz + bubbles), FIRE it (flame effect over the overlays, hurt recoil
  from `daze` back to `daze`), then kill it. The overlays fade with the 30-frame death fade and nothing is left
  floating.
- `anim_status`: HOLD → stars.
- 0 console errors in every scenario.

### 3.6 Item 6: battles play far too fast

> "Battle plays far too fast; hard to tell what happened after each move."

**Root cause:**
- Every line is set instantly: `setText(text, true)` (`BattleScene.ts:109, 263`).
- The announcement holds for **30 frames (0.5 s)** and each result line for **25 (0.42 s)**
  (`BattleAnimationController.ts:17-18`).
- The last line of a round holds 20 (`:15`). Round-start, phase and victory lines hold 45 (`BattleScene.ts:386, 395`);
  the intro holds 60 (`:47`). Floating numbers live 48 frames (`floatingNumbers.ts:9`).
- An enemy's result line starts at contact (frame 14), so its whole turn is about 70–86 frames (1.2–1.4 s). A party
  Fight is about 95 frames (1.6 s).
- The next announcement starts on the very frame the previous action completes (`completeAction`, `:251-258`), with
  no beat in which nothing changes.
- There is no setting.

**Fix (Fb; decision FB-3):**
- **A message-speed setting, 1 (slowest) to 5,** as FF's message speed. The default is **3**. It is stored in
  `Settings` (F0), outside the save data, as a global preference.
- It is set from a new **Config** row in the field menu (`FieldMenuScene.ts:21-27`; `ConfigScene`, new, < 120 lines:
  "Message speed 1 2 [3] 4 5", with ←/→ to change it and a live sample line) and from the sandbox (item 8).
- **Hold table** (`battleTiming.ts`): frames at speed 3. Other speeds multiply the text holds only by
  m = [1.6, 1.3, 1.0, 0.75, 0.55] for speeds 1–5.

  | Hold | Today | Speed 3 | Speed 1 | Speed 5 |
  |---|---|---|---|---|
  | announcement (`ANNOUNCE_FRAMES`) | 30 | **45** | 72 | 25 |
  | each result line (`RESULT_FRAMES`) | 25 | **60** | 96 | 33 |
  | beat after an action completes (`ACTION_BEAT_FRAMES`, new: nothing moves, the HP change registers) | 0 | **15** | 24 | 8 |
  | last line of a round (`ROUND_END_FRAMES`) | 20 | **40** | 64 | 22 |
  | round-start, phase and victory lines (`BATTLE_MESSAGE_FRAMES`) | 45 | **90** | 144 | 50 |
  | intro (`INTRO_FRAMES`) | 60 | **75** | 120 | 41 |
  | notice (`NOTICE_FRAMES`) | 30 | **60** | 96 | 33 |
  | floating number life (`FLOAT_FRAMES`) | 48 | **72** | 72 | 48 |

  Animations (lunges, travel, casts, effects, death fades) are never scaled: speed changes reading time, not motion.
  Confirm still skips the current hold at once (existing `confirmSkip`), so speed 3 never slows a player who reads
  fast.
- **HP roll (6b, decision FB-10):** `BattlePartyPanel` rolls the HP number and bar from the old to the new value over
  20 frames (heals up, damage down), so the panel shows what happened after the number fades. This is a party-panel
  change only.
- **Resulting turn lengths at speed 3** (announce → next announce):
  - a party single-target Fight with one result line: 45 + 24 (advance) + 60 + 16 (return) + 15 ≈ **160 frames
    (2.7 s)**, against about 95 today;
  - an enemy melee hit: 45 + (14 + N) + 60 + remaining animation + 15 ≈ **150–175**, against about 80.

**Acceptance (new `tests/scenes/battle/battlePacing.test.ts`; a mocked BattleScene, a fixed RNG, dt = 1):**
- At speed 3, the frames from one action's announcement to the next:
  - party Fight, one result line: **150–175**;
  - enemy melee hit: **140–180**;
  - each extra result line: +60 ± 2.
  - Old: 95 and 80, which fail.
- At speed 5, the party Fight takes **≤ 112 %** of today's 95 frames (≤ 106). The new 8-frame beat is the only
  addition at that speed.
- One confirm press ends the current hold within 1 frame; two presses never skip two lines.
- `Settings` default 3; ConfigScene changes and persists it; an unreadable store warns and uses 3.
- `BattlePartyPanel.test`: after 30 damage the HP text reads intermediate values for 20 frames and the final value
  after.

**Browser:** `?mute=1&scenario=f_pace`.
- Play 3 rounds at speed 3 with `performance.now()` per announcement (`browser_evaluate` on `__game`). Record the
  per-action seconds, which must be within the bands.
- Switch to speed 1 and to speed 5 (Config from a field scenario, e.g. `t5_cornelia_field`, then back) and record
  the same round.
- Readability check: after every action the result line, the number and the HP roll can be read before the next
  announcement.

### 3.7 Item 7: a dramatic overhead attack for Garland (and the lich)

> "Large enemies like Garland need a more dramatic attack: raise the sword above the head before slamming it down;
> likely the same for the lich. Can we add more animation frames?"

**Root cause:**
- The approved boss attack keyframe is the contact itself. Garland's is "a huge diagonal two-handed slash", the
  blade already down (`assets-src/gen/monsters.yaml:116-118`); the lich's is a sweeping glaive arc (`:144-149`).
- The rig can only move each frame ≤ 35 % from its pixel source (near-keyframe rule, ENEMY_ANIM_PLAN §3.1), so the
  wind-ups (`atk_wind1/2`, t −0.20 / −0.35, `monster_anim.py:39-40`) only pull back a little. Garland's rig uses
  `t: −0.05 / 0.0` with tweaks (`anim/monsters/garland.yaml:135-136`).
- A sword raised overhead is a new pose, about t ≈ −1 from `attack`. No legal in-between can reach it, and hand-posing
  it (rotating arm and blade 120°) breaks the 30° rotation cap and tears the cape.
- The timing gives bosses the same 31-frame attack as a goblin (`enemyChoreography.ts:28-36`).

**Fix (two parts; binding decision FB-8):**
- **(a) Free, ships with Fc regardless:** a `HEAVY_ATTACK` timeline for `attackAnim: heavy`.
  - When the sheet has no `attack_raise` (`hasRaise` false, F0 item 7), the raise segments show the existing frames:
    `atk_raise_in` → `atk_wind1`, the hold → **`atk_wind2`** (a long coil), and `atk_swing` / `atk_swing2` →
    `atk_mid`.
  - It adds a **glint** at the sprite's top on the `hold` cue (`ActionFx.playCue('glint')`, Fd), a red pulse during
    the hold (`actorTint` source `pulse`, 0xffb0b0, stepped), an **8-frame screen shake** (6 px, decaying) and
    `impact_dust` on the `contact` cue.
  - Even before the art lands, Garland visibly coils, holds and slams.
- **(b) Art (Ff), the real raise. Both Garland and the lich (binding FB-8):**
  - One new approved keyframe per boss, `attack_raise`, generated with Gemini through the existing per-pose boss
    pipeline. It is sent with the approved `boss_idle` as the identity reference (NEW_MONSTER_GUIDE §1.2), one request
    per review checkpoint (`--paid --max-paid 1`).
  - **Framework (≤ +6 lines each):**
    - `spec.py:281` `BOSS_POSES` gains `"attack_raise"`;
    - `monsters.yaml` gains an `attack_raise:` prompt per boss;
    - `generate.py:251-252` lists it;
    - `approve.py` accepts `boss_attack_raise`;
    - `monster_recipes.py` `KEYFRAMES` gains it as an optional key;
    - `build_assets.py monsters_ai` packs it plus the generated frames below, and writes `hasRaise`.
  - The dry run must report **cached** for every existing pose and **PAID 1** only for `boss_attack_raise`. If an
    existing cache key changes, stop.
  - Prompts (house style and outline as the other poses):
    - garland: "the wind-up of a crushing overhead blow: he rears up to full height, both hands gripping the
      greatsword raised high above his horned helm, the blade angled back over his shoulder, chest open toward the
      heroes, front foot planted forward, cape lifting behind him";
    - lich: "the wind-up of an overhead glaive strike: he rises to full height, both gauntlets lifting the ice glaive
      high above his crowned skull, the blade swept back behind his head, mantle lifting, a short frost trail curling
      off the blade".
  - **Budget (binding):**
    - **1 paid image per boss**: `garland/boss_attack_raise`, then `lich/boss_attack_raise`.
    - **At most 1 retry per boss**, and only after that image **fails** the base-sheet review below. The failure is
      written in `docs/ACT1_LOG.md` before the retry (`--retry`, seed + 1).
    - **At most 4 Gemini attempts in total**, so the budget ends at **≤ 30 of 100**.
    - No further retries without asking the user. If a retry also fails, that boss keeps the free fallback (a) and the
      failure is reported.
    - `budget.json` would allow 3 attempts per sheet, so the §7 ledger check enforces pass F's own caps: at most the
      current Gemini count + 4 in total, at most 2 per new sheet.
  - **Base-sheet review checklist** (NEW_MONSTER_GUIDE §1.4), all of which must hold:
    - the figure height is in the band and the feet are on the band's row;
    - there is headroom for the raised blade (≥ 10 px below the top border);
    - it shares one palette with the other four poses;
    - `pose_diff` is ≥ 15 % against both `idle` and `attack`;
    - it faces right, has binary alpha, and the weapon is whole.
  - **Generated in-betweens** (rig, near-keyframe rule):

    | Frame | Pixel source | Toward | t |
    |---|---|---|---|
    | `atk_raise_in` | idle | attack_raise | 0.35 |
    | `atk_raise_b` | attack_raise | — | body 1 px down (a trembling hold) |
    | `atk_swing` | attack_raise | attack | 0.35 |
    | `atk_swing2` | attack | attack_raise | 0.35 (the heavy mid frame) |

    - `atk_swing2` is a **new name**. The existing `atk_mid` is not re-sourced, so its lock hash and the normal
      attack are unchanged.
    - A new `heavy` sequence `[idle, atk_raise_in, attack_raise, atk_swing, atk_swing2, attack, atk_follow,
      atk_recover, idle]` goes in `monster_recipes.py` `SEQUENCES`, so `anim_rules.py` checks its continuity
      (adjacent IoU, centroid, feet) like the attack sequence.
    - The rigs gain `keyframes.attack_raise.<joints>` (marked with `monster_anim.py mark`).
    - Re-lock: `git diff` of `garland.lock.json` / `lich.lock.json` shows **only added keys** (`attack_raise`'s four
      in-betweens, and `daze` / `daze_b` from item 5). Every existing frame hash is unchanged.
- **`HEAVY_ATTACK` timeline (`enemyChoreography.ts`, Fc), Garland and the lich only:**

  | Seg | Frames | Pose (with `hasRaise`; the fallback in brackets) | dx |
  |---|---|---|---|
  | travel (melee, item 3) | N | `atk_wind1` / `atk_wind2` alternating, hop 3 | travel part 0 → travel |
  | raise | 6 | `atk_raise_in` (`atk_wind1`) | lunge part 0 → −L/6 |
  | hold (the telegraph) | 18 | `attack_raise` / `atk_raise_b` every 4 frames (`atk_wind2`); **`hold` cue** at its first frame (the glint plays 4 frames later); red pulse | −L/4 |
  | swing | 3 + 2 | `atk_swing`, `atk_swing2` (`atk_mid`, `atk_mid`) | → 0.75L |
  | slam | 12 | `attack`; **contact at its first frame = N + 29**, raising the **`contact` cue** (shake 8 frames, `impact_dust`) | 0.75L → L |
  | follow | 6 + 6 | `atk_follow`, `atk_recover` | → 0 (the lunge part) |
  | return | 16 | `idle` | travel part → 0 |

  - The total is N + 69 frames (about 1.5 s at N = 20), stored per enemy as `contactAt` / `totalFrames` (F0 item 6).
  - The boss cast table is unchanged.
  - The screen shake offsets `layers.actors` and `layers.fx` only, never `ui` or `hud`. It runs from
    `layers.update(dt)`, and `screenShake.test` checks that it returns to 0.

**Tests:**
- **`enemyChoreography.test.ts`:**
  - the heavy table: contact at N + 29; the 18-frame hold shows `attack_raise` / `atk_raise_b` with `hasRaise`, and
    `atk_wind2` without; total N + 69;
  - the `hold` and `contact` cues fire exactly once each, on the frames above;
  - with an atlas lacking the frames, the fallback chain resolves with no crash;
  - a non-heavy enemy keeps `MELEE_ATTACK`.
- **`enemyPoseFlow.test.ts`:** Garland's action resolves at N + 29.
- **`tests/scenes/battle/screenShake.test.ts`:** offsets in [−6, 6], decaying to 0 by frame 8; `ui` and `hud` never
  move.
- **Art (Ff):**
  - `assetCoverage.test.ts`: the garland and lich sheets have `attack_raise`, `atk_raise_in`, `atk_raise_b`,
    `atk_swing` and `atk_swing2`, and `hasRaise: true` (or, for a boss whose image failed twice, `hasRaise: false`
    with the fallback aliases, recorded);
  - `monster_anim.py check garland lich` passes, including the `heavy` sequence;
  - `selftest.py`'s style lock is unchanged for every pre-existing `approved/**` file, and the new
    `approved/{garland,lich}/boss_attack_raise.*` are recorded;
  - **the ledger check (§7):** at most 4 new Gemini attempts in total, at most 2 per new sheet, and each one is
    logged in `docs/ACT1_LOG.md`.

**Browser:**
- `?mute=1&scenario=f_heavy_garland&battleStep=1` (scene-wide, so the glint and shake step too): screenshots at the
  raise, the hold (glint), the swing and contact (shake). Then a real round without `battleStep`: the raise reads at
  1x and the slam lands on the hero's row.
- `f_heavy_lich`: the same.
- With the art not yet built (Fc alone), the same scenarios show the coil-hold-slam fallback with no console warning
  beyond the existing missing-frame one.

### 3.8 Item 8: a more sophisticated debug menu

> "Keep going straight into a battle, but with battle 'levels' that scale the party, swap party members (classes), and
> pick enemies per level, to playtest many party/enemy combinations."

**Root cause:** the title's Debug item (`TitleScene.ts:57`, dev only) loads `debug-scenarios.yaml` and runs
`pickScenario` (`TitleScene.ts:91-100`, `DebugScenarioLoader.ts:42-45`). That is the first scenario, or `?scenario=`.
- Varying the party, levels or enemies means editing the YAML (77 scenarios, 948 lines) and reloading.
- A debug battle ends back on the title, or on Game Over after a defeat (`DebugScenarioLoader.ts:71-91`,
  `BattleTrigger.ts:74-86`), so repeating a fight takes several presses.

**Fix (Fg; decision FB-9):**
- **Routing:** with `?scenario=<id>` in the URL, the Debug item does exactly what it does today. Without it, Debug
  opens the new dev-only **`DebugSandboxScene`** (`src/scenes/debugSandbox/`, lazy, `import.meta.env.DEV` only;
  production has no Debug item and no sandbox chunk).
- **Data: `assets/data/debug-sandbox.yaml` (new).**
  - It defines `levels`. Each level has `id`, `name`, `level` (the party's level), `kit` (`kits.yaml` name: `naked`,
    `start`, `lv2`, `full`), `items`, `gold`, `formations` (a list of enemy-id lists), and an optional `background`
    and `enemyAi`.
  - Initial levels:

    | id | Level | Kit | Formations | Background |
    |---|---|---|---|---|
    | `l1_fields` | 1 | start | the `FIELDS` packs | grassland |
    | `l2_approach` | 2 | lv2 | `TEMPLE_APPROACH` | grassland |
    | `l2_temple` | 2 | lv2 | the temple table | temple |
    | `l2_garland`, `l3_garland` | 2, 3 | lv2 | `[garland]` | temple |
    | `l5_east` | 5 | full | `EAST_POCKET` | grassland |
    | `l10_mid` | 10 | full | `[ogre]`, `[troll, troll]`, `[mummy ×2]`, `[cockatrice ×2]` | — |
    | `l20_late` | 20 | full | `[vampire]`, `[dragon]` | — |
    | `l30_lich` | 30 | full | `[lich]`, `[lich, goblin, goblin]` | shoreline |

  - `classes` lists the selectable classes: the 6 base classes, and with a "promoted" toggle the 6 upgraded ones from
    `classes.yaml`.
- **Rows (a `Menu` with ←/→ value cycling; the cursor opens on "Fight!"):**
  1. Level;
  2. Slots 1–4, class;
  3. Kit (the level's default, or naked / start / lv2 / full);
  4. Enemies (the level's formations, plus "Custom": a submenu that adds or removes any `enemies.yaml` id, up to 9);
  5. Background (auto, or any committed `assets/backgrounds/*.webp`);
  6. Message speed (item 6);
  7. **Fight!**
  8. **Title** (back to the title screen; X does the same);
  9. a results line: this session's W / L / escape per configuration, with the last battle's rounds and party HP %.
- **Party scaling** uses the existing class growth: `new Character({ classData, level })`, gear and spells from the
  kit (`slotOf` + `equip`, `learnSpell`, as `DebugScenarioLoader.applyParty`, `:93-137`). That party builder moves to
  a shared `src/systems/debugParty.ts` used by both. A class the kit doesn't list gets `naked` and a `console.warn`.
- **Ending:** the sandbox ends battles through `BattleTrigger.triggerBattle(…, { onEnd })`, a new optional option.
  Victory, escape and defeat all record the result and `switchTo('debugSandbox')`, never Game Over or the title.
- **Persistence:** the last configuration is kept in `localStorage` `ff.debug.sandbox`. Errors are logged. So
  Title → Debug → Z repeats the last fight in **two presses**.
- **Deep link:** `?sandbox=<level>&party=warrior,thief,white_mage,black_mage&enemies=garland` opens the sandbox
  preset and starts at once. Unknown ids log and fall back.

**Tests:**
- **New `tests/scenes/debugSandbox/sandboxModel.test.ts`** (pure model):
  - cycling covers every level and class;
  - a level's kit equips without refusal for every base class (`kits.yaml` must cover monk and red mage in every
    kit);
  - "Custom" caps at 9;
  - parsing the deep link and unknown ids.
- **New `tests/data/debugSandbox.test.ts`:** every level's
  enemy, item, kit and background id exists.
- **`tests/scenes/TitleScene.test.ts`:**
  - Debug without `?scenario=` pushes `debugSandbox`;
  - with `?scenario=r_menus` it runs `pickScenario` as before.
  - Old: always the first scenario.
- **New `tests/systems/debugSandboxBattle.test.ts`:** with a fake BattleTrigger, a defeat ends in
  `switchTo('debugSandbox')` with no `gameover` and the tally L + 1. The same for victory and escape.
- **Dev gate:** `TitleScene.ts:91`'s debug branch (`value === 'debug'`, `:91-100`) is wrapped in
  `if (import.meta.env.DEV)`, so Vite drops its dynamic imports (`DebugScenarioLoader`, the sandbox) from production.
  The item at `:57` is already dev-only.
- **Build check:** after `npm run build`, `grep -rl "debugSandbox\|DebugScenarioLoader" dist/assets/*.js` finds
  nothing. Run the same check on `6d8ef65` first and record the result. If the old build already passes it (Vite
  may drop the chunk), the gate is defence in depth, and `TitleScene.test.ts` covers the routing instead.

**Browser:** `http://127.0.0.1:5173/?mute=1`, then Debug.
- The sandbox opens on "Fight!". Pick `l2_garland`, WAR / THF / WHM / BLM, kit lv2, Fight, lose or win; the sandbox
  returns with the tally.
- Change slot 2 to Monk and the enemies to Custom `[wolf, wolf, gr_wolf]`, then Fight.
- Reload, Debug, Z: the same configuration fights.
- `?mute=1&scenario=f_pace`: Debug goes straight into that battle.
- `?mute=1&sandbox=l3_garland&party=knight,thief,white_mage,black_mage&enemies=garland`: the battle starts at once.

---

## 4. Tranches, ownership and order

| # | Items | Owns (source, data, tests) | Depends on |
|---|---|---|---|
| F0 | the contract (§2) | new `battleTiming.ts`, `Settings.ts`, `BattleLayers.ts`, `BattleEnemyList.ts`, `actorTint.ts`, `battleDevClock.ts`, `fx/index.ts`, `schemaValidationFx.ts`, the stub `ConfigScene.ts` / `DebugSandboxScene.ts`; edits to `BattleStateMachine.ts` (`spellId?` / `itemId?` only, ≤ 592), `BattleSceneTypes.ts` (`enemyStatus`), `BattleAnimationController.ts` (split, effect phase, status diff, cue hand-off, constants out and re-exported, Container constructor kept), `BattleScene.ts` (layers incl. `hud`, factories, `layers.update`, dev clock, `enemyStatus`), `BattleDisplayManager.ts` (extract with delegating getters, layers, presented snapshot), `BattleEffects.ts` (layers), `ActiveHeroMarker.ts` (via `actorTint`), `AiEnemyView.ts` (`playAttack(i, target)` pass-through, split offsets), `EnemyPoseController.ts` (split offsets, per-enemy `contactAt` / `totalFrames`, `onCue`), `enemyChoreography.ts` (frame names, fallback chain, `LATE_FRAMES`), `BattleArt.ts` (`hasRaise`, fallback chain), `enemyAnimPreview.ts` (moved onto the dev clock), `battleMessageUtils.ts` (`formatAnnouncement` moved), `types/index.ts`, `DataLoader.ts`, `schemaValidation.ts` (+2), `main.ts`, `BattleTrigger.ts` / `DebugScenarioLoader.ts` (`enemyStatus`), `enemies.yaml` (the new fields only), the new `spell-effects.yaml` (seeded `fire_breath`) / `status-visuals.yaml` / `kits.yaml`, `debug-scenarios.yaml`, `tests/helpers/balanceData.ts` (reads `kits.yaml`), new `tests/helpers/battleLayers.ts`, `assetCoverage.test.ts` (`LATE_FRAMES`); the compatibility edits to `meleeContact.test.ts:73` and `enemyPoseFlow.test.ts`; the F0 tests (§2) | none; first commit |
| Fa | 1, then 2 | `assets/data/{enemies,kits}.yaml` (gold, Garland, the `lv2` and `arrive` kits); `tests/balance/**`, `tests/data/actOneBalance.test.ts`, `tests/battle/BossPhase.test.ts`, `tests/helpers/{balanceData,battlePolicies}.ts` | F0 |
| Fb | 6 (+ 6b) | `battleTiming.ts` (values, multipliers), `Settings.ts` (default 3), `BattleScene.ts`, `BattleAnimationController.ts`, `BattlePartyPanel.ts`, `floatingNumbers.ts`, `ConfigScene.ts`, `FieldMenuScene.ts`; `ControlsHint.ts` (the two silent catches); tests `battleTiming` (new), `battlePacing`, `Settings`, `BattlePartyPanel`, `FieldMenuScene`, `BattleScene` | F0 |
| Fc | 3, 7 (runtime) | `enemyChoreography.ts`, `EnemyPoseController.ts`, `AiEnemyView.ts`, new `enemyReach.ts`, new `screenShake.ts`, `enemyAnimPreview.ts`, `BattleArt.ts` (meta `opaqueRight`, `head`), `BattleLayers.ts` (the shake offset); tests `enemyChoreography`, `EnemyPoseController`, `enemyPoseFlow`, `AiEnemyView`, `enemyTravel`, `screenShake`, `enemyAttack` | F0; final tuning after Fb merges |
| Fd | 4 | `src/scenes/battle/fx/**` (except the `createStatusFx` body), `BattleEffects.ts`, `assets/data/spell-effects.yaml`, new `assets-src/fx/**`, `build_assets.py` (≤ 3 lines), `assets/sprites/battle-fx.*`; tests `actionFx`, `spellEffects`, `assets-src/fx/selftest.py` | F0; final tuning after Fb |
| Ff | 5a, 7 (art) | `assets-src/gen/**` framework (new `monster_recipes.py`, `monster_anim.py`, `anim_rules.py` (sequence prefix), `rig_templates.py` (head joints), `spec.py`, `generate.py`, `approve.py`, `selftest.py`, `monsters.yaml`), every `anim/monsters/*.yaml` / `*.lock.json`, the new `approved/{garland,lich}/boss_attack_raise.*`, `cache/**`, `ledger.jsonl`, `build_assets.py` `monsters_ai` (line-neutral; `hasRaise`, `opaqueRight`, `head` meta), `assets/sprites/monsters-ai.*`; `assetCoverage.test.ts` (drops `LATE_FRAMES`); `docs/ACT1_LOG.md` entries | F0; the paid requests follow binding FB-8 (garland and lich, ≤ 4 attempts) |
| Fg | 8 | `src/scenes/debugSandbox/**`, new `src/systems/debugParty.ts`, `DebugScenarioLoader.ts`, `BattleTrigger.ts` (`onEnd`), `TitleScene.ts` (routing, the `import.meta.env.DEV` gate), `assets/data/debug-sandbox.yaml`; tests `tests/scenes/debugSandbox/sandboxModel.test.ts`, `tests/data/debugSandbox.test.ts`, `TitleScene`, `debugSandboxBattle`, `DebugScenarioBattle` | F0; Fa merged first (the `lv2` kit) |
| Fe | 5b (+ 5a runtime) | `fx/statusFx.ts`, `fx/statusIcons.ts`, `fx/stoneTextures.ts`, the `createStatusFx` body, `actorTint.ts` (taken over from F0), `assets/data/status-visuals.yaml`, `AiEnemyView.ts` / `enemyChoreography.ts` / `EnemyPoseController.ts` (postures; taken over from Fc after it merges), `BattleDisplayManager.ts` (party posture), `BattleFieldTargeting.ts` (the tags on the target line), `assets-src/fx/glyphs.py` (icons and overlay glyphs) and the **`battle-fx.*` rebuild** (taken over from Fd after it merges); tests `statusFx`, `statusVisuals`, `stoneTextures`, `actorTint`, `AiEnemyView`, `enemyChoreography` | Fc, Fd (merged); Ff for the real `daze` frames (falls back until then) |

**No file is shared within a wave:**
- Wave 1 is Fa, Fb, Fc, Fd, Ff and Fg. `BattleAnimationController.ts` and `BattleScene.ts` are Fb's only. Fc and Fd
  reach the controller through F0's hooks (`playAttack(i, target)`, `createActionFx`).
- `enemies.yaml` is Fa's after F0, and Fc only reads the `attack` fields.
- `build_assets.py` gets one registration from Fd (the new `fx` stage) and none from Ff (the existing stage's packing
  lives in `assets-src/gen/`). If Ff needs a line there, it goes through the orchestrator after Fd's merge.
- `assetCoverage.test.ts` is F0's, then Ff's.
- `debug-scenarios.yaml` is frozen after F0.
- `BattleStateMachine.ts` is edited by F0 only (the 4-line `spellId?` / `itemId?` change).
- `actorTint.ts` is F0's, then Fe's (wave 2). Fb and Fc only call it.
- `assets-src/fx/**` and `battle-fx.*` are Fd's in wave 1, then Fe's.

**Order:**
1. F0.
2. **Wave 1** in parallel worktrees: Fa (1 then 2, serial inside the tranche), Fb, Fc, Fd, Ff, Fg. Ff's paid step
   runs in the **main checkout**, because `refs/` is git-ignored (NEW_MONSTER_GUIDE §0). The rest of Ff can run in a
   worktree.
3. **Merge** Fa → Fb → Fg → Fc → Fd → Ff.
   - Fb lands before Fc and Fd so they **re-tune against the new pacing**: the effect impact frames and the travel
     speeds are checked at speed 3 in the browser after rebasing (the 6-before-3/4 dependency).
   - Fa lands first so Fg's `lv2` kit exists.
4. **Wave 2:** Fe on the merged tree.
5. **Integration:**
   - rebuild the atlases (`build_assets.py monsters_ai fx`), twice, with no diff the second time;
   - re-measure items 1 and 2 on the merged tree and update the test headers;
   - every browser check;
   - the adversarial play test (§6).
6. **Docs** (§9), then a "Result" section in this file.

**Process:** as U. Momus reviews this plan, then each tranche's diff before its commit.

---

## 5. Timing summary (60 fps frames; the tables are the tuning surface)

| Sequence | Today | After pass F (speed 3; animations unscaled) |
|---|---|---|
| party Fight, announce → next announce | ≈ 95 | 150–175 |
| enemy melee hit | ≈ 80 (in place, 24–40 px) | 140–180, with travel N = 10–24 frames, contact at 14 + N, total animation 47 + N |
| enemy ranged hit | ≈ 80 | ≈ 150; contact at 14, then the effect's impact (16 for `fire_breath`) |
| Garland / lich attack | 31-frame animation, contact 14 | N + 69 animation, contact N + 29 (18-frame raised hold, 8-frame shake) |
| party spell | 24 step + resolve | 24 step + impact (10–30 by effect) + results |
| status overlay appears | never | at the inflicting effect's impact frame |
| status overlay leaves | — | fades over 12 frames at the wake / cure line or with the 30-frame death fade |

---

## 6. Final adversarial play test (after integration)

**Setup:** `npm run dev`, then Playwright at `http://127.0.0.1:5173/?mute=1…` (never without `mute=1`). Severity P0
blocks, P1 must be fixed or accepted by the user, P2 is recorded. Evidence goes in `/tmp/fval/` (local). Each probe
records a verdict.

| # | Probe | How | Pass |
|---|---|---|---|
| A1 | **E2E economy and Garland** (no scenario, no state edits) | New Game, WAR / THF / WHM / BLM; buy the 400 G kit with equip-now; fight the fields until all are Lv 2 (record battles, gold, inns, potions); buy one spell and 2 potions; temple run through the 4 chests; Garland, up to 3 attempts (Retry / Return to Field only) | the spell is affordable at Lv 2; Garland feels like a fight (at least one attempt goes past his phase line); he is won within 3 attempts at Lv 2, or within 3 more at Lv 3; record every number |
| A2 | Gold under pressure | the sandbox `l1_fields` ×6 fights, then `f_gold_start` with Run on every second battle | gold matches the table (escapes pay 0) |
| A3 | Garland extremes | the sandbox: Lv 1 start kit ×3 (expect losses), Lv 3 full ×3 (expect wins), careless Fight-only at Lv 2 ×3 | matches the sim bands roughly; no unwinnable or trivial case at Lv 2 |
| A4 | Pacing comfort | `f_pace` at speeds 1, 3, 5; one full round each, timed | speed 3 is readable without pressing anything; speed 5 is about today's; confirm skips one line per press |
| A5 | Travel geometry | `f_melee_rows`, `f_melee_large`, `anim_crowd`; every enemy → every row | the contact lands on the target's row, the attacker draws above the hero and below numbers and flashes, it returns home, no snap |
| A6 | Travel edge cases | the target dies earlier in the round (retarget, B2/B6) while another enemy is about to attack it; the party member is KO'd (no target) | the travel measures the resolved target; no travel to an empty slot; no console error |
| A7 | Ranged | `f_ranged` | the dragon breathes in place; the breath hits the right hero; no travel |
| A8 | Heavy attack | `f_heavy_garland`, `f_heavy_lich`, step mode and real time | raise, hold, glint, slam and shake read; the art has no tears or pops (image-only reviewer, NEW_MONSTER_GUIDE §3.4); the windows don't shake |
| A9 | Every spell and item | `f_spells_white`, `f_spells_black`, `f_items_fx` | each effect reads as its kind at 1x; the number appears at impact; Miss and No effect show at impact; a lethal spell's target stays standing and opaque until impact (presented snapshot), and a KO'd hero drops to `down` only at impact |
| A10 | Every status, both sides | `f_status_enemies`, `f_status_party`, `f_enemy_casts`, `anim_status` | each status's overlay, icon, tint and posture as the §3.5 table; the panel tags agree with the icons |
| A11 | Composition | `f_status_combo`: SLEP + poison, FIRE (effect over the overlays), hurt from `daze`, death fade; also stone + element glow; a feared goblin that does attack travels with its tremble and sweat overlay following it | no overlay left floating after death; draw order status < spell < flash < numbers; no flicker |
| A12 | Daze art | step-mode frames of `daze` / `daze_b` for all 12 base sprites (`anim_bipeds`, `anim_large`, `anim_beasts`, bosses) | the image-only reviewer passes each; feet don't move |
| A13 | Sandbox | every level once; custom enemies with 9 entries; Monk and promoted classes; defeat, victory, escape; reload persistence; deep link | always back to the sandbox, the tally is right, `?scenario=` is still direct |
| A14 | Performance | `anim_crowd` with FIR2 on all, plus 3 statuses each | ≥ 55 fps (record the minimum), no growth in `fx` children after 10 rounds (leak check via `__game`) |
| A15 | Regression sweep | `t4_garland_l2_start`, `anim_goblin`, `anim_boss_garland`, `u_lunge_rows`, `u_cmd_menu`, `r_temple_garland` | the U and enemy-anim behaviours are unchanged apart from the specified changes; 0 console errors |

---

## 7. Validation commands

```bash
npx tsc --noEmit
npm run build                                   # also: grep -r "debugSandbox" dist/assets/*.js  -> no match
npm test
npx vitest run tests/balance tests/data tests/scenes/battle tests/scenes/debugSandbox
python3 -I assets-src/gen/selftest.py           # style lock: no pre-existing approved/** hash changes
python3 -I assets-src/gen/monster_anim.py check --all
python3 -I assets-src/fx/selftest.py
python3 -I assets-src/build_assets.py monsters_ai fx && python3 -I assets-src/build_assets.py monsters_ai fx && git diff --exit-code assets/sprites
git diff --stat assets-src/gen/approved/        # only new boss_attack_raise.* files
wc -l src/scenes/BattleScene.ts src/battle/BattleStateMachine.ts src/scenes/battle/BattleAnimationController.ts \
  src/scenes/battle/BattleDisplayManager.ts src/battle/SpellExecutor.ts      # 594 / 592 / 308 / <250 / 314
git diff --name-only --diff-filter=A 6d8ef65..HEAD | grep -E '\.(ts|py)$' | xargs wc -l   # every new source file < 250
# Paid images (binding FB-8): count Gemini attempts in the ledger before Ff and after it.
#   after - before <= 4 in total, <= 2 for each of boss_attack_raise (garland) and boss_attack_raise (lich),
#   and the ACT1_LOG "Images used" line reads <= 30 of 100 and matches the ledger guard
python3 -I -c "import json; r=[json.loads(l) for l in open('assets-src/gen/cache/ledger.jsonl')]; print(sum('gemini' in json.dumps(x) for x in r))"
```

Browser: every check in §3 and §6, with `?mute=1` and 0 console errors.

---

## 8. Decisions for the orchestrator

Each decision has a recommended default. The orchestrator proceeds on the defaults unless told otherwise. FB-8 is
binding as changed in "Orchestrator decisions"; FB-2 is reported to the user.

1. **FB-1, gold (item 1):**
   - **Default:** raise the act-1 `goldReward` values in `enemies.yaml` about 2× (12 / 12 / 30 / 10 / 44).
   - Alternatives:
     - (b) a global `goldScale` in a new economy YAML, which leaves FF1 values visible in the data;
     - (c) keep FF1 gold and halve level 1 spell prices (50 G), which changes the 400 G kit maths everywhere.
2. **FB-2, Garland (item 2):**
   - **Default:** 400 HP, phase at ≤ 50 % → 3 hits, attack 9 / 2 hits kept (mage survival intact).
   - This reverses U-1's "Lv 1 about one in three" (now ≈ 7 %), and must be reported to the user.
   - Alternatives:
     - (b) 480 HP with the ≤ 25 % phase (Lv 2 64.8 %, but 12-round fights);
     - (c) relax the mage bound to ≥ 85 % and use attack 10.
3. **FB-3, message speed (item 6):**
   - **Default:** speeds 1–5, default 3, the hold table of §3.6, a Config row in the field menu, stored outside saves.
   - Alternative: a fixed slower timing with no setting.
4. **FB-4, who is ranged (item 3):**
   - **Default:** only the dragon is ranged; the lich is melee (glaive). Bosses travel the full distance.
   - Alternative: the lich ranged with a frost bolt; bosses travel half-way.
5. **FB-5, D5′ (item 3):** **default:** a travelling melee enemy draws above party sprites (it is the attacker), below
   all effects and numbers. Alternative: keep D5 (the enemy behind the hero).
6. **FB-6, effect art (items 4 and 5):**
   - **Default:** glyph sheets generated in Python (`assets-src/fx/`, SNES palette), with motion in TypeScript.
   - Alternative: pure `Graphics` drawing in TypeScript, with no build stage (faster, but looser palette discipline).
7. **FB-7, party posture for sleep and stun (item 5):**
   - **Default:** `ready` held with no breathing, plus the overlay. Code only, 0 cost.
   - Alternative: a puppet `daze` pose for the party (0 images, `gen/puppet.py` recipe for 12 classes, about 4 h of
     review).
8. **FB-8, paid art (item 7), binding (see "Orchestrator decisions"):**
   - Both Garland and the lich get one paid `attack_raise` image; the user asked for the lich too.
   - Each may have at most one retry, and only after its first image fails the base-sheet review.
   - At most 4 images in total, so the budget ends at ≤ 30 of 100. No further retries without asking the user.
   - The free coil-hold-slam fallback ships either way, and stays for a boss whose retry also fails.
9. **FB-9, sandbox (item 8):**
   - **Default:** dev only; every outcome returns to the sandbox; the last configuration persists; `?scenario=` stays
     direct; `?sandbox=` deep links.
   - Alternative: the sandbox replaces `?scenario=` (rejected: many plan checks depend on it).
10. **FB-10, HP roll (6b):** in (default) or out.
11. **FB-11, reserved statuses:** `frozen` and `confuse` stay data-only hooks (default). CONF keeps `status_stun`. A
    real confuse or freeze mechanic is a separate pass.

---

## 9. Docs (after integration)

1. **`AGENTS.md`:**
   - `EnemyData.attack` / `attackEffect` / `attackAnim`;
   - `spell-effects.yaml`, `status-visuals.yaml`, `kits.yaml` and `debug-sandbox.yaml` in the data table;
   - the `fx` build stage in the art table;
   - the new monster frames (`daze`, `daze_b`, `attack_raise` and its in-betweens) in the monsters row;
   - the message-speed setting and `battleTiming.ts`;
   - the sandbox and `?sandbox=` in "Debug Menu";
   - the paid budget line after item 7.
2. **`docs/ENEMY_ANIM_PLAN.md`:** a note under the decisions table: D5′ supersedes D5 for melee travel; postures
   supersede D6 (stone unchanged).
3. **`docs/NEW_MONSTER_GUIDE.md`:**
   - the `attack:` field;
   - the `daze` recipe and its review;
   - `attack_raise` for bosses (§1.4 commands, §2.1 frames).
4. **`docs/ACT1_LOG.md`:** an F entry, one row per paid request, and "Images used: N of 100".
5. **This file:** a "Result" section (per item: pass / partial / fail with evidence; the measured tables of §3.1 and
   §3.2; the timing measurements; the play-test verdicts; the final test count and build summary).

---

## 10. TODOs

- [ ] F0: contract commit (timing, settings, layers incl. `hud`, action data and split, presented snapshot, cues and split offsets, frame names and fallbacks, `actorTint`, dev clock, data fields and files, `f_*` scenarios, stubs, extractions, compatibility edits) (priority: high, effort: 8h)
- [ ] Fa: item 1 gold values and `economy.test.ts`; `fieldPacing` re-set (priority: high, effort: 2h)
- [ ] Fa: item 2 `lv2` / `arrive` kits, Garland 400 HP and phase 0.5, `garland.test.ts` / `BossPhase` / `actOneBalance` re-measured (priority: high, effort: 4h)
- [ ] Fb: item 6 hold table, message speed, ConfigScene, `battlePacing.test.ts`; 6b HP roll (priority: high, effort: 4h)
- [ ] Fc: item 3 travel, `MELEE_ATTACK`, D5′, `enemyReach`, tests (priority: high, effort: 5h)
- [ ] Fc: item 7 `HEAVY_ATTACK` timeline, screen shake, the fallback (priority: medium, effort: 3h)
- [ ] Fd: item 4 fx engine, glyph generator and stage, `spell-effects.yaml` for every spell, item and ranged attack, tests (priority: high, effort: 8h)
- [ ] Ff: `monster_recipes.py` split, shared recipe tweaks, head joint per template (error if missing), `SPAN` / `SEQUENCES` / `anim_rules` prefix, the `hurt_in1` hold fallback (priority: medium, effort: 3h)
- [ ] Ff: item 5a `daze` / `daze_b` on 12 rigs, checked and reviewed; atlas (priority: medium, effort: 6h)
- [ ] Ff: item 7 framework for `attack_raise` (`hasRaise`, `atk_swing2`, `heavy` sequence); garland and lich paid requests, 1 each, ≤ 1 retry each after a failed review, ≤ 4 total, budget ≤ 30/100 (binding FB-8); rigs and locks (only added keys); ledger check (priority: medium, effort: 5h)
- [ ] Fg: item 8 sandbox scene, YAML, shared party builder, routing, persistence, deep link, tests (priority: high, effort: 6h)
- [ ] Fe: item 5b overlays, icons, tints, postures, party side, `status-visuals.yaml`, tests (priority: high, effort: 6h)
- [ ] Integration: atlases twice, re-measure items 1 and 2, every browser check, the adversarial play test §6 (priority: high, effort: 5h)
- [ ] Docs §9 and the Result section (priority: medium, effort: 1.5h)

## Orchestrator decisions (binding)

- **FB-1 to FB-7, FB-9 to FB-11:** the recommended defaults stand.
- **FB-8:** both Garland and the lich get one paid `attack_raise` image. The user asked for the lich too ("I bet we would have the same for the lich"). Each image may have at most one retry, and only if the first fails review. Total: at most 4 images, so the budget ends at 30 of 100 or less. No further retries without asking the user.
- **FB-2:** Garland's new numbers are reported to the user at the end.

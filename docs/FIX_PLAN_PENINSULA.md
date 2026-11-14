# Peninsula fix plan

This plan works through the defect list in `docs/PLAYTEST_PENINSULA_2026-11-13.md`, following the triage decisions recorded there. The work comes in tranches, most severe first. Each tranche goes through four steps:
1. The plan is reviewed by momus.
2. The fixes are implemented.
3. The implementation is reviewed by momus.
4. The fixes are validated (`npm run build`, `npm test`, and checks in the browser where the change is visible), then committed.

## Tranches

| # | Theme | Defects |
|---|---|---|
| T1 | Blockers: the act can be started, completed and restarted | NG-1, NG-2 (reset + Retry battle), ST-1, ST-2, plus the same-root or same-flow ST-3, ST-4, ST-5, MS-4 (stale slots) |
| T2 | Major engine and UX bugs | NG-3, NG-4, BA-1, BA-2, MS-1, MS-2, MS-3, MS-4 (feedback), EB-2, CT-2, CT-3, IN-1, IN-2 |
| T3 | Major map work | CT-1 (10 house interiors), CT-6, OW-1, OW-2, OW-4, OW-5, OW-15, OW-11 (tomb) |
| T4 | Balance on the FF1 baseline | NG-5, EB-1, EB-3 … EB-10 |
| T5 | Minors | everything at severity m, following the triage defaults |
| T6 | Polish and the presentation decisions | every p, plus MS-7, BA-8, TF-3, CT-9, OW-8, OW-9 (paid art) |

OW-10 is deferred and stays open.

---

## T1: Blockers

### ST-2 / ST-3 / MS-4: the exploration scene is reused, but its state is not rebuilt

**Root cause.** `ExplorationScene` is created once by a lazy factory and reused for the whole session:
- The constructor subscribes to `battleEnd` and `showDialog`, and `exit()` unsubscribes. After any `switchTo` away and back (Game Over → Title → Continue, Field → Load, debug), nothing listens for `battleEnd`, so the victory screen never closes.
- `savedPosition` is set when a battle starts. It was meant for a battle flow that used `switchTo`; battles now use push/pop, and returning from them goes through `onResume`, not `enter()`. The value is never cleared, so the next `enter()` (after a Load) loads the *current* map at the last battle tile instead of the saved map.
- `KeyItemGateSystem`, `VehicleManager` and `FieldHUD` capture `game.inventory`, `game.gameFlags` and `game.party` by reference, and `Game.restoreState()` replaces those objects.

`LoadScene` and `SaveScene` build their slot lists once, in their constructors, and are cached too. So a newly saved slot shows as "Empty", and `doSave` ignores whether the save succeeded.

**Fix.**
1. `ExplorationScene.enter()` subscribes to both events and `exit()` unsubscribes, using the same bound handlers. `enter()` first calls `off` so it never subscribes twice.
2. Remove `savedPosition` entirely. `enter()` always loads `game.currentMapId` at `game.playerPosition`, or at `pendingEntrance`; the scene already updates these every frame. The "no map" branch is removed: a new game sets `currentMapId` and an entrance (see NG-1).
3. `enter()` rebuilds `keyItemGateSystem` and `vehicleManager` from the *current* `game.inventory` and `game.gameFlags`. `FieldHUD` already takes the party in `update()`; check that the constructor doesn't keep it.
4. `LoadScene` and `SaveScene` rebuild their menu in `enter()`. `SaveScene.doSave` checks the return value of `SaveManager.save` and shows "Saved." or "Could not save." before popping. The full "Saved" UX belongs to T2.

**Tests (new or updated):**
- After `exit()` then `enter()`, emitting `battleEnd` reaches `BattleTrigger.onBattleEnd` exactly once.
- After `restoreState` plus `enter()`, the scene is on the saved map and position, even if a battle happened earlier.
- Load and Save list a slot written after the scene was first created.

### NG-2: New Game reuses the old state; Game Over offers Retry battle

**Root cause.** Nothing resets `Game` state. `PartyManager.add` fails once the party has 4 members, and `PartyCreationScene` ignores that.

**Fix.**
1. Add `Game.resetState()`. It installs a fresh `PartyManager`, `Inventory` and `GameFlags` through `restoreState`, and resets `playTime = 0`, `currentMapId = ''`, `playerPosition`, `pendingEntrance = null` and the retry snapshot.
2. Call it at the start of `PartyCreationScene.beginAdventure()` and in `DebugScenarioLoader.applyParty()`, which today only empties the party. Log an error if `party.add` returns false.
3. **Retry battle.**
   - `BattleTrigger.triggerBattle` stores a snapshot on `Game` (`game.battleRetry`). It holds the JSON of the party, inventory and flags, the map id and position, and the battle arguments (enemy ids, boss config, background, enemy AI).
   - Because it is JSON, it stays independent of later changes.
   - The snapshot is cleared on victory.
4. `GameOverScene` shows a menu. **Retry Battle** appears only when a snapshot exists, followed by **Load Game** and **Title**. The "Press START" hint goes away.
   - Retry restores the snapshot through `restoreState`, sets `game.pendingBattle` to the battle arguments, and calls `switchTo('exploration')`.
   - `ExplorationScene.enter()` loads the map and position, then, if `pendingBattle` is set, clears it and calls `battleTrigger.triggerBattle(...)`. A boss battle runs again without its intro message.
   - Load pushes `loadMenu`. Title calls `switchTo('title')`.

**Tests:**
- `resetState` leaves an empty party, 0 gold, no flags and no items.
- New Game after a party already exists gives a 4-member fresh party with 100 G (T4 changes the amount).
- Losing a battle stores a snapshot. Retry restores the party HP, gold, inventory and flags, and triggers the same enemies with the same boss config.
- GameOver hides Retry when there is no snapshot.

### NG-1: opening cutscene, then the south gate

**Fix.**
- `PartyCreationScene.playOpeningSequence` plays a short opening of about 5 lines over black:
  - the darkness and the prophecy of the four warriors;
  - the warriors arriving at Cornelia, each holding an orb;
  - "Go to the castle; the King awaits."
- It then sets `game.currentMapId = 'cornelia'` and `game.pendingEntrance = 'south_gate'`, calls `switchTo('exploration')`, and fades in.
- The entrance is a named key in the town map; `south_gate` is [30,67].
- Test: after `beginAdventure`, the scene enters `cornelia` at `entrancePosition(..., 'south_gate')`, and a flood fill from there reaches a transition (guarding against a pocket).

### ST-1 / ST-4: the act ends at the King, and the bridge stays closed

**Fix.**
- **`garland_defeated` cutscene:** it keeps PRINCESS_RESCUED and heal_party. It stops setting BRIDGE_BUILT, and its text says "The princess is free. Return her to the King of Cornelia."
- **New cutscene `act1_complete`:**
  - The King orders the bridge rebuilt.
  - Fade out.
  - "Congratulations! You have completed the introduction."
  - "Your journey will continue once the bridge to the north is rebuilt..."
  - `set_flag INTRO_COMPLETE`, then fade in.
  - BRIDGE_BUILT stays unset in act 1, so the north gate keeps its "collapsed bridge" message and nobody can step onto the stub.
- **New optional NPC field `cutscene: {id, requiredFlag?, onceFlag}`.** It is played after the NPC's dialog closes when `requiredFlag` is set and `onceFlag` is not. The King gets `{id: act1_complete, requiredFlag: PRINCESS_RESCUED, onceFlag: INTRO_COMPLETE}`. `ExplorationScene` gets a shared `playCutscene(id)` (dialog through its DialogManager, fades through its overlay, flags and party from `game`). `BattleTrigger` keeps its own post-victory path.
- **Dialog consistency for the bridge:**
  - King: PRINCESS_RESCUED → "I will order the bridge rebuilt at once"; INTRO_COMPLETE → "My builders are hard at work on the bridge".
  - Chancellor and old man: their bridge lines are keyed on INTRO_COMPLETE, saying "builders are at work"; the old man's line no longer depends on BRIDGE_BUILT.
  - `GameFlags.ts`: document INTRO_COMPLETE.
- **Data flow:** maps are recompiled with `build_map.py` after the source edits, because `assets/maps/ai/*.yaml` is generated. `MapNPC` and `NPCData` get the `cutscene` field.
- **Test:** talking to the King with PRINCESS_RESCUED plays `act1_complete` once and sets INTRO_COMPLETE; talking again only shows the dialog.

### ST-5: defeated Garland and the captive princess stay on the map

**Fix.** Add `ExplorationScene.refreshNpcPresence()`. It removes any NPC whose `showIf`/`hideIf` no longer passes, both its sprite and its entries in the collision and interaction lists. It doesn't add NPCs, because none appear mid-map in act 1. It is called after any cutscene and on `onResume` (returning from battle). Test: with GARLAND_DEFEATED and PRINCESS_RESCUED set, both NPCs are gone after `onResume`.

### Validation

- `npm run build` and `npm test` pass.
- Map recompile: `python3 -I assets-src/tools/build_map.py` for the changed maps, plus `assetCoverage`.
- **Browser** (`?mute=1`, 127.0.0.1):
  - New Game → opening → the party at the south gate can walk into town.
  - Lose to Garland (fresh party) → Retry Battle → the fight restarts with a full-HP party.
  - Lose → Title → Continue (load) → win a battle → back to the field.
  - Beat Garland → both NPCs disappear → King → act1_complete once → the north gate is still closed.

### T1 revisions after the momus review (binding)

1. **`enter()` must leave the scene running and visible.**
   - Every `enter()` sets `paused = false` and `container.visible = true`, and calls `finishBattleFlash()`.
   - It also clears `talkingNpc`, `pendingNpcAction`, any active dialog and the fade overlay.
   - Reason: `push` hides and pauses the scene, and only `pop` or `onResume` undo that; a `switchTo` back left the field black and frozen.
   - Test: a real `SceneManager` runs push battle → `switchTo` away → `switchTo('exploration')`, and the scene is unpaused and visible.
2. **Refresh NPCs after the cutscene.** The NPC refresh runs after the post-victory cutscene finishes, not only on `onResume`, because PRINCESS_RESCUED is set inside that cutscene. Both cutscene paths (the post-victory one, now owned by ExplorationScene through a callback, and the NPC cutscene) go through one `playCutscene` helper. Test: use the real `garland_defeated` steps.
3. **Block input during cutscenes.** A `cutsceneRunning` guard makes `update()` return early, so the player can't move, open the menu, trigger encounters or re-talk to the King mid-cutscene.
4. **Retry needs a map.** No retry snapshot is stored when `currentMapId` is empty (for example, debug battles). If `enter()` has no map id, it falls back to Cornelia's `south_gate` (new-game behaviour, also used by the tests). It never fails silently.
5. **Update the tests and mocks.**
   - `createMockGame` gains `currentMapId`, `playerPosition`, `pendingEntrance`, `gameFlags` and `inventory`.
   - The `GameOverScene` tests are rewritten for the menu.
   - The `battleEnd` re-entry test uses a real `EventBus`.
   - `BattleTrigger` tests get a mock party that supports `toJSON`.
6. **Edit the generators, not the generated maps.** `cornelia.yaml` and `cornelia-castle*.yaml` are generated, so the edits go in `assets-src/tools/layouts/cornelia.py` and `castle.py`. Run:

   ```
   python3 -I assets-src/tools/layouts/cornelia.py && python3 -I assets-src/tools/layouts/castle.py && python3 -I assets-src/tools/build_map.py
   ```

   The legacy 1x maps (`assets/maps/*.yaml`, dev `?art=legacy` only) get only the old man's BRIDGE_BUILT line changed to INTRO_COMPLETE.
7. **Wire the NPC `cutscene` field fully.**
   - Add it to `MapNPC`, `NPCData` and the `NPC` class field copy.
   - `pendingNpcAction` is also set for NPCs with a cutscene.
   - `schemaValidation` checks the shape.
   - `crossFileValidation` checks that NPC `cutscene.id` and `postVictoryCutscene` exist in `cutscenes.yaml`.
   - The King's dialog lists INTRO_COMPLETE before PRINCESS_RESCUED, because the first match wins.
8. **Retry snapshot details.**
   - The snapshot deep-copies the battle arguments (`structuredClone`).
   - Retry keeps the current `playTime` and clears `pendingEntrance`.
   - `enter()` places the player, then calls `triggerBattle` without awaiting it, logging any error.
   - Retry restores the HP the party had when the battle started.
   - The types on `Game` use `import type`.
9. **Rebuild the gate and vehicle systems before `loadMap`**, which calls `setGates` and `setSpawns`.
10. **One dialog completion path.** `DialogManager.start(lines, onComplete?)` replaces the three patched-`advance` hacks.
11. **Smaller details.**
    - Exploration starts black after the opening, and `enter()` fades in.
    - The "Saved." line closes on a key press, then the menu pops.
    - Load and Save rebuild their `Menu` and reset the confirm window in `enter()`.
    - `act1_complete` doesn't repeat the King's line; it opens with the fade.
    - The `GameFlags` docs are updated.
    - The flood-fill test reads `assets/maps/ai/cornelia.yaml`.
12. **Validation additions.**
    - Command: `npx vitest run tests/data/assetCoverage.test.ts tests/data/crossFileValidation.test.ts`.
    - Browser:
      - Save → Load lists the new slot.
      - After a battle, Load arrives on the saved map.
      - Game Over → Load Game → the field moves.
      - The princess vanishes after Garland.
      - The player can't move during the `act1_complete` fades.
13. **File size.** The cutscene and NPC-refresh helpers go in `src/scenes/exploration/ExplorationCutscenes.ts`.

### T1 result

**Fixed:**
- NG-1 and NG-2, including Retry Battle and the full reset;
- ST-1, ST-2, ST-3, ST-4 and ST-5;
- MS-4 (the stale slot lists, plus "Saved." / "Could not save.").

**Also fixed on the way:**
- NG-6: the "slot 5/4" header.
- ST-7, in part: level-up messages now queue instead of overwriting each other.

**Reviews:** momus reviewed the plan (REVISE, folded in), then the implementation twice (REVISE, then OKAY).

**Validation:**
- `npm run build` passes, and `npm test` passes (97 files, 1091 tests).
- Browser, `?mute=1`:
  - New Game → opening → south gate, and the player can walk.
  - Losing to Garland → Retry Battle → the same fight, with the HP the party had when it began.
  - Beating Garland → the cutscene plays, Garland and the princess are gone, and BRIDGE_BUILT stays unset.
  - The King → `act1_complete` plays once, the player is frozen during it, and INTRO_COMPLETE is set.
  - Save → a battle elsewhere → Load returns you to the saved map and tile, the field is visible and moves, and the next battle ends.
  - A second New Game in the same session starts clean.
  - The console showed 0 errors.

---

## T2: Major engine and UX bugs

Root causes are from the playtest; the implementer re-verifies each one before changing code. Unless stated otherwise, every fix gets a unit test that fails on the old code.

### Party and battle
- **NG-3: naming and duplicate names.**
  - Add a name-entry step to party creation after each class pick:
    - a letter grid (A–Z, a–z, 0–9, `.`, `-`, space) with Back / End, up to 6 characters;
    - the default name is pre-filled and confirm accepts it.
  - Default names are made unique (`FGHTR`, `FGHTR2`).
  - The battle animation finds the actor's sprite by its party index or character object (`Character` identity; the state machine can carry an actor reference or index), never by `name`. The same goes for enemies with equal display names: match on the instance.
  - Tests:
    - two Warriors named the same: the second one's attack animates the second sprite;
    - the name grid writes a custom name.
- **NG-4: spell charges.**
  - A new `Character` starts with full charges for its level.
  - Learning a spell (magic shop) never leaves its level's charges below what the class has at that level.
  - Test: a new Black Mage that learns FIRE can cast it at once.
- **BA-1: running away.**
  - On a successful escape the battle ends in a new `escaped` result. `executeNextAction` must not overwrite the end state.
  - `BattleEndData` gets `escaped?: boolean`.
  - `BattleTrigger.onBattleEnd`, when escaped: no rewards, no Game Over, clear the retry snapshot, pop back to the field (a boss battle never allows Run).
  - The victory, defeat and escape outcomes are decided in one place.
  - Tests:
    - with a forced-success RNG, the battle ends as escaped and the field resumes;
    - a failed escape continues the battle.
- **BA-2: the battle stalls between rounds.**
  - When the actions resolve, the battle shows each message for a short time (about 1 s at 60 fps, skippable with confirm) and moves on by itself: to the next round's command menu, or to Victory / Game Over.
  - Victory and level-up text still wait for a confirm, because they're reading moments.
  - Remove the empty-box dead state.
  - Test: the battle goes from resolution to command_select with no input after N frames.

### Menus, shops and field magic
- **MS-1: equip slots.** `EquipScene` only lists items whose `slot` matches the slot being edited. `Character.equip` refuses an item whose slot doesn't match (it returns false, and the caller shows a message). Test: chain mail can't go in the shield or helmet slot, and a cap can't go in the body slot.
- **MS-2: shop comparison.** The comparison uses `usableBy`, or the class's equipment rules, the same check `EquipScene` uses (share one helper). Members who can't equip the item show "—" (can't equip) instead of a +/− value. Test included.
- **MS-3: field CURE and Tent.**
  - Field CURE uses the same heal formula as battle CURE (share one function) and doesn't affect fallen allies. It reports "X recovers N HP" or "No effect."
  - With no usable field spells, the field magic screen says so instead of doing nothing.
  - Tent and Cabin don't revive the fallen (revival is Phoenix Down's job, as in FF1).
  - Tests included.
- **MS-4, the rest: "Save greyed out in the streets".** Find why the field menu disables Save on town maps; `canSave` defaults to true. Town and castle maps allow saving; the Temple doesn't. Test the menu's enabled state per map.

### Field
- **EB-2: no encounters on warps.** `EncounterSystem` doesn't count a step, and doesn't trigger a battle, when the step ends on a transition, key-item-gate or scripted-encounter tile. Bumping into a blocked gate isn't a step. Roads and bridges keep encounters (triage decision). Test: walking onto a warp tile at step count 0 never starts a battle.
- **CT-2 / CT-3: NPC movement.**
  - Wandering NPCs check walkability with `WalkingMode`, so no water, walls or counters.
  - They stay within 3 tiles of their spawn tile.
  - They never step onto a transition tile, the tile in front of a transition (the door approach), a key-item gate, an entrance tile, or a scripted-encounter tile.
  - They don't move while the player is within 1 tile (this also removes CT-11's "walks off as you arrive").
  - Tests for each rule.
- **IN-1: shop music.** The six shop and inn interiors get `music: shop` in `assets-src/maps/*.yaml` (if a layout script generates them, edit the script), then recompile.
- **IN-2: small rooms pinned to the top-left.** When a map is smaller than the viewport, `Camera` centres it, giving a negative offset on that axis. The baked renderer and the NPC/player layers must agree. Test: a 10x8 map gives a centred container offset.

### Validation
- `npm run build` and `npm test` pass, plus `npx vitest run tests/data`.
- **Browser** (`?mute=1`, 127.0.0.1):
  - name a character;
  - two same-class members each animate their own sprite;
  - Run escapes;
  - rounds flow without key presses;
  - Equip refuses a wrong-slot item;
  - the shop shows "—" for a mage;
  - field CURE;
  - Save is enabled in town;
  - no encounter on the city gate tiles (30 attempts);
  - NPCs stay near home and off doors;
  - the shop plays shop music;
  - an interior is centred.

### T2 revisions after the momus review (binding)

**T2 is split** into three parts, each reviewed separately:
- **T2a, battle:** the NG-3 sprite identity, BA-1 and BA-2.
- **T2b, menus and party:** the NG-3 name grid, NG-4 and MS-1 to MS-4.
- **T2c, field:** EB-2, CT-2/CT-3, IN-1 and IN-2.

#### T2a, battle
- **NG-3 sprite.**
  - `peekNextAction()` also returns `actorId` (the action's `combatantId`).
  - `findActorSprite(actorId)` maps `party_i` to `partySprites[i]` and `enemy_i` to `enemySprites[i]`.
  - The name-based regexes in `battleMessageUtils.ts` must keep working for names with spaces and `.`; test that.
- **BA-1 outcome.**
  - Add `BattleStateMachine.outcome: 'victory' | 'defeat' | 'escaped' | null` and `isOver`.
  - Escaping clears the action queue and calls `clearBattleState()`.
  - The end state is never overwritten by the `'resolution'` writes at `:273` and `:287-290`.
  - Use `isOver` / `outcome` in `BattleAnimationController.completeAction` and in `BattleScene` at `:477-486`, `:495`, `:508` and `:513-522`.
  - The `escaped` flag goes in the `battleEnd` payload types: `EventBus.ts`, `BattleTrigger` `BattleEndData`, and the ExplorationScene handler.
  - "Escaped!" closes on confirm, like the other end states.
  - Rewrite `tests/integration/battle.test.ts:159-185` with deterministic RNG.
- **BA-2 pacing.**
  - Replace `round_end`'s confirm wait with a timer.
  - Timer constants: `ROUND_END_FRAMES = 20`. The result messages keep 25 frames each and the announce keeps 30; confirm skips any of them.
  - Leave `round_end` only when `dyingEnemies` is empty and no enemy pose is attacking.
  - After `startCommandPhase`, ignore confirm for 10 frames, so mashing doesn't pick commands.
  - Spell and item UI messages ("No spells available.") get their own one-off message path; never set `currentMessageIndex = -1` and replay old messages. This fixes BA-6.
  - Level-up text stays in the field dialog; no change there.
  - Update `tests/scenes/battle/enemyPoseFlow.test.ts`.
  - Test: with no input, resolution reaches `command_select` within the stated frame budget.

#### T2b, menus and party
- **Name grid.**
  - New `src/ui/NameEntryGrid.ts`.
  - `PartyCreationScene` keeps `names[]` alongside `selectedClasses` and pops it in every Back path.
  - The chosen names appear in the slot display and the summary.
  - On the grid, cancel deletes a letter, or goes back to class select when the name is empty.
  - Names are trimmed, and empty means the default; at most 6 characters from `[A-Za-z0-9 .-]`.
- **NG-4.**
  - The constructor fills charges to max.
  - On level-up, current charges rise by however much the max rose.
  - On learn, a spell level is set to max only if this is the first spell known at that level.
  - Keep the current charge table; T4 brings in FF1's per-class numbers.
  - Fix `MagicShopScene` so it doesn't take gold before `learnSpell` succeeds.
  - Tests: a new mage; a Lv1 mage levelled to 5 who then learns a level-2 spell; a full spell level costs no gold.
- **MS-1.** Add a single `slotOf(item) = item.slot ?? (type === 'weapon' ? 'weapon' : 'armor')` helper, plus `Character.canEquipIn(slot, item)`. Use them in `EquipScene` (check before unequipping), in `Character.equip`, and in `DebugScenarioLoader`, which currently never equips weapons or body armour.
- **MS-2.** Use `Character.canEquip` (`usableBy`). Mark members who can't equip the item with `n/a`, because the NES font has no em dash.
- **MS-3.**
  - A shared `healAmount(spell, caster, rng)` built from SpellExecutor's heal and DamageFormula.
  - Field magic gets a message line in `spellWindow`, and fallen members can't cast.
  - "No field spells" is shown instead of returning silently.
  - Target labels refresh, and `all_allies` heals work.
  - CURE on a full-HP target says "No effect." and doesn't use a charge.
  - Tent and Cabin skip fallen members for both HP and charges.
- **MS-4.** `Menu.setItemEnabled(i, enabled)` redraws the item, and `FieldMenuScene` uses it. The test checks the drawn text's fill colour.

#### T2c, field
- **EB-2.**
  - `EncounterSystem.setStepFilter((x, y) => boolean)`, built in `loadMap` from transitions, key-item gates and scripted encounters.
  - A filtered step neither counts down nor triggers; a blocked gate bump isn't a step.
  - Test: the counter fires on the step where `stepsRemaining === 1`, and never on a warp tile.
- **CT-2 / CT-3.**
  - Pure rules in a new `src/scenes/exploration/NpcWander.ts`, with the RNG injected into `NPC`.
  - The spawn tile is stored.
  - The wander radius is 3, measured Manhattan.
  - Forbidden tiles:
    - transition tiles and every walkable 4-neighbour of them;
    - key-item gates;
    - `MapData.entrances` tiles;
    - scripted-encounter tiles;
    - the per-map `noWander` tiles (new optional `MapData.noWander: [x, y][]`);
    - the player's current and target tiles.
  - NPCs don't step while the player is within Manhattan distance 1.
  - `WalkingMode` decides walkability.
  - Cornelia: set `wander: False` for `gardener`, or add `noWander` for the north-postern route (8,17)–(8,25) and (9,17)–(11,25), in `layouts/cornelia.py`. Regenerate and recompile.
- **IN-1.** Add `music: shop` to the six hand-written `assets-src/maps/cornelia-*` interiors and to their legacy copies in `assets/maps/`. While here, battle and victory music: `BattleTrigger` passes `audio` in the battle dependencies, and `onResume` restarts the map track. Verify both.
- **IN-2.** `Camera` centres any axis smaller than the viewport. Test with `(GAME_W - w*TILE_SIZE)/2`, a 10x8 room, and the 16x13 tower (centred on one axis only).

### T2 result

**Fixed:**
- **T2a:** NG-3 (sprite identity), BA-1 and BA-2, plus BA-6.
- **T2b:** NG-3 (the name grid), NG-4 and MS-1 to MS-4, plus MS-6.
- **T2c:** EB-2, CT-2, CT-3, CT-11, IN-1 and IN-2.

**Also fixed:**
- Battle, victory and boss music now play: the audio was never passed in, and music requests now resolve latest-wins.
- The double victory fanfare.
- Debug scenarios now equip weapons and body armour.
- Upgraded classes keep their base class's gear.

**How it was done:** three parallel worktrees, merged on `t2-integration`. Momus reviewed the plan (REVISE, folded in) and the implementation (REVISE: 5 issues, fixed; then OKAY).

**Validation:**
- Build passes; 1210 tests pass.
- Browser, `?mute=1`:
  - the name grid, with unique defaults (FGHTR, FGHTR2);
  - mages start with charges;
  - wanderers stay within 3 tiles over 25 s;
  - Save is enabled in town;
  - the weapon shop is centred, and its comparison shows `n/a` for both mages;
  - a battle round goes back to the command menu with no input;
  - Run escapes to the field, with the retry snapshot cleared and no Game Over;
  - 15 entries through the city gate with the encounter counter at 1 start no battle, while an ordinary road tile does.

**Known, not from T2:**
- The map build is not deterministic: about 466 pixels change in two Cornelia chunks on some runs. Track it in T3.
- `BattleStateMachine.ts` (620 lines) and `BattleScene.ts` (about 570) are over the size guideline.

---

## T3: Major map work

**Defects:** CT-1, CT-6, OW-1, OW-2, OW-4, OW-5, OW-11, OW-15, and map-build determinism.

**Folded in, because they share the work:**
- OW-3, OW-6, OW-7, OW-12, OW-13 and OW-14: the overworld is rebuilt anyway;
- CT-7, which CT-6 covers, and CT-8: both are Cornelia edits;
- **IN-5:** the six shop interiors move into the same generator as the houses.

**Left to T6:** CA-7, the empty castle rooms. It touches `layouts/castle.py` and wants the ST-12 chest fix first.

**Rules for the whole tranche:**
- Edit generators and sources, never `assets/maps/ai/**`.
- Sub-branches commit sources and code. They may also commit compiled output for their own review, but `t3-integration` discards it and rebuilds every map once after the last merge. This avoids binary conflicts.
- No step adds an encounter table or changes one. Zones are T4's job (EB-1).

### Sub-tranches and order

| # | Scope | Owns (files) | Depends on |
|---|---|---|---|
| T3a | Compiler core: determinism, object and collision features, map checks, preview and check CLIs | `assets-src/tools/build_map.py` (objects, validation, CLI), new `assets-src/tools/map_checks.py` | none; **merge first** |
| T3b | Compiler terrain: organic edges, blends, foothills, peak variants (OW-4/OW-5) | new `assets-src/tools/terrain.py`; in `build_map.py`, only the step-1 soft-ground loop and the peaks block, replaced by one call | T3a's determinism fix (rebase) |
| T3c | Overworld layout: OW-15, OW-1/2/3/6/7/12/13/14, the tomb's map data (OW-11) | new `assets-src/tools/layouts/overworld.py`, `assets-src/maps/overworld.yaml` (now generated), `assets-src/gen/approved/overworld/city.json` (`paint` fixes), legacy `assets/maps/overworld.yaml` (entrance aliases only) | T3a for the final compile; T3e for the tomb to work in the game; T3b only for the final look |
| T3d | Cornelia: 10 house interiors (CT-1), edge exits (CT-6/CT-7), dead-end paths (CT-8), shop layouts (IN-5) | `layouts/cornelia.py`, new `layouts/interiors.py`, `layouts/common.py` (`Room` moved here), the six `assets-src/maps/cornelia-*shop*.yaml`, `-inn.yaml` and `-magic.yaml` files (now generated), legacy `assets/maps/cornelia.yaml` (entrance aliases only) | T3a (`edge_exits`); the overworld entrance names below |
| T3e | Runtime "inspect" cells (the tomb's text) | `src/types/index.ts`, `src/core/schemaValidation.ts`, `src/systems/NPCInteraction.ts`, new `src/scenes/exploration/FieldInspect.ts`, a hook in `ExplorationScene.ts` | none; can start at once |

**Order:**
1. T3a and T3e run in parallel.
2. Once T3a merges, T3b, T3c and T3d run in parallel.
3. Integration: merge T3b, then T3c, then T3d; rebuild all maps; validate.

**Fixed contract between T3c and T3d.** Entrance names:
- Overworld arrivals: `cornelia` (south), `cornelia_west`, `cornelia_east` and `cornelia_north`. The legacy name `castle` is kept as an alias of `cornelia_north`.
- Cornelia targets: `south_gate`, `west_gate`, `east_gate` and `castle_gate`.

### T3a: compiler core

1. **Determinism (cause found).**
   - In `compile_map` step 2, a water cell that falls outside the rounded canal outline is painted with the land beside it: `land = max(set(near), key=near.count)`.
   - When two materials tie, the winner depends on set iteration order, which follows the per-process string hash (`PYTHONHASHSEED`).
   - Reproduced: compiling `cornelia` under seeds 1, 2 and 3 gives the same output for 1 and 2, but 932 px change under 3, in cells (28,52) and (33,55). `overworld`, `temple-of-fiends` and `cornelia-castle` don't change.
   - **Fix:** use `Counter(near)` and break ties by `SOFT` order (the earlier material wins). No set iteration may feed pixel output.
   - **Test (selftest):** build a synthetic map with a water cell whose neighbours are 3 grass and 3 cobble. Compile it in subprocesses under `PYTHONHASHSEED` 0 to 7 and require every SHA-256 of `below` to match. On the old code at least one seed differs.
   - **New CLI:** `build_map.py --check-determinism [ids]` compiles each map under two hash seeds and compares hashes of `below`, `above` and `collision`.
2. **Icon and object features.** These go in `compile_map` object handling and `footprint`.
   - `deco` and `prefab` take `offset: [dx, dy]` in native px, applied to every pasted part.
   - `deco` takes `style`, which goes through `styled()`, so a deco can be recoloured.
   - `deco` and `prefab` take `collide: alpha` (with an optional `alpha_min`, default 0.25). A footprint cell blocks only when that share of its pixels is opaque art; `walk_cells` still override. This fixes OW-7, the square footprint corners of a round icon and the empty top row of the temple icon.
   - `null` part entries count in the footprint, so an icon shifted by half a cell can use a 5-wide grid.
3. **Edge exits (CT-6).**
   - Source key: `edge_exits: {north|south|west|east: {targetMap, targetEntrance}, split?: [{side, from, to, targetEntrance}]}`.
   - After collision is final, every walkable edge cell gets a transition. Corner cells go to the north or south side.
   - Explicit `transitions` on edge cells win.
   - **Validator:** with `edge_exits` set, every walkable edge cell is a transition.
4. **Inspect cells (OW-11; the runtime is in T3e).**
   - `inspect: [{x, y, text: [...]}]` is added to `PASSTHROUGH`.
   - **Validator:** the cell is in bounds and has a reachable walkable 4-neighbour.
5. **New `map_checks.py`, called from `validate()`. Each check is opt-in per source.**
   - `sealed_edges: true`: no walkable cell on the map edge (OW-14).
   - `road_check: {materials: [dirt], ends: [[x, y], ...]}` (OW-1/OW-2/CT-8):
     - road cells, counting bridges, form one 4-connected component;
     - a road cell with ≤ 1 road neighbour must touch a transition, a bridge end, a gate or a listed `ends` cell;
     - no road cell lies under a blocked icon footprint cell.
   - `warp_leaves: true` (OW-2): every transition cell has at most one walkable 4-neighbour outside its own icon, so no junction is a warp.
   - `min_blob: {mountain: 3, sand: 3, forest: 3, ocean_inlet: 2}` (OW-12): no terrain component smaller than the minimum, and no 1-cell-wide water inlet.
   - `talkable` (all maps): every NPC has a reachable walkable neighbour, or is reachable across a counter. This ports `untalkable` from `/tmp/playtest/town/reach.py`.
   - `river_check` (OW-6):
     - river cells, plus bridge cells over river, form components that each touch both a source (a lake `~`, or mountain) and the ocean;
     - on each side of a bridge, the river channel uses the same columns (or rows) as the bridge span.
6. **New `map_report.py`, a committed port of `/tmp/playtest/town/{reach,choke}.py`.** For a compiled map, it prints:
   - reachability from every entrance;
   - walkable edge cells that are not exits;
   - single-cell chokepoints when static NPCs block their cells;
   - BFS distances between named points.
7. **`build_map.py --preview <id> x0 y0 x1 y1 out.png [--grid] [--collision]`** stitches the chunks and crops them, with an optional grid and a collision overlay (replaces the `/tmp` stitch and crop scripts).

**Tests:** `--selftest` gets one failing-then-passing case for each of items 1–5. It also asserts that the town and castle maps, which set none of the new keys, compile to the same `below` hashes as before. The two determinism cells are the only allowed difference.

### T3b: terrain blending (OW-4 / OW-5)

- **Scope:** opt-in with `terrain: organic` in a source; only the overworld sets it. Town, castle and temple output must stay byte-identical (selftest hash check).
- **Hook:** new `terrain.paint_soft(below, mat, kit, seed)` replaces the `SOFT` loop. New `terrain.place_peaks(canvas, mat, owner, kit, rng)` replaces the per-cell `peak` paste.
- **Paid art: none needed.** Everything below is derived from the approved `overworld` terrain textures and the `peak`, `tree_clump` and `boulder` parts.

**Techniques:**
1. **Organic outline (coast, sand, river, forest).**
   - Blur the cell mask (r 20 px, twice), then resample it through a two-octave domain warp: value noise with a 96 px cell and 14 px amplitude, plus a 24 px cell and 5 px amplitude. Threshold at 0.5.
   - **Fidelity clamp:** the central 28x28 px of each cell always shows that cell's material. Collision still matches the art.
2. **Blends instead of dark lines.**
   - Grass and sand meet in a 10 px band dithered with a 4x4 Bayer matrix.
   - Forest gets a 1 px canopy rim and a 3 px shadow cast to the south-east (light comes from the top-left). This replaces the tan fringe. `tree_clump` stamps sit about every 40 px along the outline and stick out by at most 14 px.
3. **Water.**
   - A shallow band: ocean pixels within 10 px of land are tinted 35 % toward cyan, dithered.
   - The foam is broken by noise.
   - Ocean meeting grass gets an automatic 6–10 px sand beach on the land side; ocean meeting mountain gets a dark rock rim.
   - The river gets 3 px dithered earth banks.
4. **Foothills.**
   - Walkable grass within one cell of a mountain gets the mountain texture at 25–50 % dithered coverage, fading with distance.
   - Small peaks (0.5–0.6x) and `boulder`s are scattered by Poisson disc.
   - Collision doesn't change; these cells stay grass, so battle backgrounds stay grassland.
5. **Peak variants.**
   - Built at kit load: `peak` × {as drawn, mirrored} × scale {0.6, 0.8, 1.0, 1.25}, resampled with LANCZOS, the alpha thresholded and the colours snapped back to the part's own palette.
   - A snow-cap version: the top 35 % of the opaque rows are lightened toward (232,236,244) behind a dithered line. It is used only at scale ≥ 1.0 and at a distance-to-edge of 2 cells or more.
   - Placement: Poisson disc with a minimum spacing of 30 px × scale, anchored at the bottom inside the mask, drawn in y order, with larger peaks toward the inside of the range.
   - Peaks may overhang a walkable cell by at most 8 px.

**Tests** (selftest metrics on synthetic maps; each fails on the current output):
- On a straight 10-cell coast:
  - the longest straight axis-aligned run of the land/water boundary is ≤ 72 px;
  - ≤ 15 % of boundary pixels lie within 2 px of a cell line;
  - the same holds for the sand/grass, forest/grass and mountain/grass boundaries.
- On a 6x4 mountain block:
  - at least 4 distinct peak variants are used;
  - the standard deviation of the peak anchor positions mod 48 is ≥ 10 px (today the jitter is only ±4 px);
  - ≥ 90 % of the grass cells next to the mountain contain foothill pixels.
- Fidelity: the centre of every cell shows its own material.

**Metrics on real output:** `build_map.py --metrics overworld` prints the same numbers for the real overworld, and the review uses them.

### T3c: overworld layout (OW-15 and the rest)

**The overworld becomes generated.** New `layouts/overworld.py` writes `assets-src/maps/overworld.yaml`, with the same header convention as `cornelia.py`:
- About 72x56 cells, so 5x4 chunks.
- Shapes are drawn with seeded `numpy` noise; there is no unseeded `random` and no `hash()`.
- The source sets `terrain: organic`, `sealed_edges`, `road_check`, `warp_leaves`, `min_blob` and `river_check`.
- `kits: [overworld, town, temple]`, so the tomb can use temple parts.

**Geography.** The layout is original: the idea follows the classic world map, the coastline does not.
- **The peninsula** (Cornelia, the temple and the east pocket) hangs south-west from a larger landmass.
- **A sound** opens to the western ocean north of the peninsula. It narrows eastward and ends at a fjord head. It is not a straight strait (OW-5).
- **The north mainland** wraps across the top. It is ringed by ocean, at least 3 cells, on every map edge (OW-14).
- **The isthmus.** The peninsula's north-east joins the mainland over land, but an unbroken range, 3–6 cells thick, runs from the fjord head south-east to the eastern sea. It is the original "spine" range and seals the land route (OW-15).
- **The north bridge** crosses the sound at its narrowest point. It is drawn as two stubs with a 2-cell gap of open water, and the gate sits on the south stub (ST-1 and OW-9 stay as decided).
- **The east river** rises at a tarn (a `~` lake cell group) in the spine's foothills and flows south-west to the south coast. Its channel is straight through the east bridge (OW-6).
- **The city stream** rises at a spring pond north-east of the city, enters the icon at its north-east corner and leaves at its south-west corner to the coast, where the icon draws its river (OW-13). It crosses no road.
- **The east pocket** lies between the river and the spine, about 60–90 cells. It holds the tomb (OW-11).
- Act-1 distances stay close to today's: south gate to temple door 25–40 steps (today 29); south gate to the bridge foot 18–30 (today 22).

**The city icon (OW-2/OW-3/OW-7).**
- **Placement.**
  - The icon gets `offset: [24, 0]` on a 5x4 grid with a `null` column, so its south arch and the castle sit on the centre of one column.
  - `collide: alpha` sets its collision.
  - Exactly one walkable warp cell per gate: N, W, E and S.
- **The missing side gates.** The drawn W and E notches are on the bottom row, next to the south arch, so three adjacent warps can't be read.
  - **Offline art fix** (no paid art): add a `paint` list in `approved/overworld/city.json`. `K.load_kit` applies these copy-rect fixes after cutting:
    - copy the south arch onto the W and E flanks, at the wall's widest row;
    - fill the bottom notches with neighbouring wall pixels;
    - draw a small postern arch on the north wall below the castle.
  - **Fallback (needs the user's budget):** regenerate the icon with four clear gates (1 Gemini image).

**Warp targets:**

| Warp | Town entrance |
|---|---|
| N | `castle_gate` (closes CT-7: the castle precinct's east gate entrance is now used) |
| W | `west_gate` |
| E | `east_gate` |
| S | `south_gate` |

**Arrivals.** `cornelia`, `cornelia_west`, `cornelia_east` and `cornelia_north` are each the first road cell outside their gate, and never a warp.

**Roads (OW-1).** One readable 1-wide dirt road leaves each gate, with no road under any icon:
- **N:** to the north bridge foot.
- **W:** curves to the temple door. The road ends on the temple's door approach, not 3 cells short.
- **E:** over the east bridge to the tomb clearing.
- **S:** to a 3-cell bridge-deck jetty into the south sea, a future landing.
  - The ship spawn is moved there if that is trivial; OW-10 itself stays deferred.
  - The S road may join the W or E road through one marked junction away from any warp, never at a warp.

**Tidy-ups:**
- No stray single mountain, sand or inlet cells (OW-12; enforced by `min_blob`).
- Keep `boulder` decos only where they don't sit on a road.

**The tomb (OW-11).**
- A clearing at the end of the E road holds a 2x1 sarcophagus (`altar_l`, `altar_r`, `style: stone`, so the candles read less purple), between two `tpillar_broken` columns, with `flowers` and `vines`.
- `inspect` on both sarcophagus cells: `["Here lies Erdrick."]`.
- The road's terminal cell is listed in `road_check.ends`.

**Other data:**
- Keep `keyItemGates` on the south stub.
- Keep `encounters`, `encounterRate`, `battleBackgrounds` and `vehicles` (moved onto cells in bounds).
- `unreachable_ok: [north_shore]`.
- The legacy `assets/maps/overworld.yaml` gets `cornelia_north` as an alias of its existing spot ([8, 12]).

**Tests: new `tests/data/overworldLayout.test.ts`, on the compiled map.** Each test fails on today's map.
1. **Sealed (OW-15).** From `cornelia`, with gates blocked, `north_shore` can't be reached. With the gates open and the 2 gap cells set walkable, it can. With the gates open but the gap left as water, it still can't. This proves the range seals the land.
2. **Edges (OW-14).** No walkable cell on the map edge.
3. **Roads (OW-1/OW-2):**
   - the road and bridge cells form one component;
   - BFS along roads only connects the 4 warp approaches, the temple door, the north bridge foot, the east bridge, the tomb clearing and the jetty;
   - every warp cell has exactly 1 walkable neighbour outside the icon;
   - no road cell sits under a blocked icon cell.
4. **Invisible walls (OW-7).** Every blocked cell has ≥ 25 % art coverage from an icon, a mountain, water or a wall.
5. **River (OW-6).** The east river is one component from the tarn to the ocean.
6. **Tomb (OW-11):**
   - an `inspect` entry whose text contains "Here lies Erdrick" sits next to a cell reachable from `cornelia`;
   - that cell can't be reached when the east bridge is blocked.
7. **Distances.** South gate to the temple door and to the bridge foot are within the ranges above.

**Images to inspect** (`build_map.py --preview overworld …`):
- the whole map at 1/4 scale;
- the city icon with its 4 roads (`--grid --collision`);
- the north bridge;
- the east bridge and the tarn;
- the tomb clearing;
- a spine edge with foothills;
- the south-west coast and the sound's south shore (sand, grass and forest);
- `--metrics overworld`.

### T3d: Cornelia interiors, edges and paths

**Code.**
- Move `Room` from `layouts/castle.py` to `layouts/common.py`. Regenerating the castle must give byte-identical sources; check with `git diff --exit-code assets-src/maps/cornelia-castle*`.
- New `layouts/interiors.py` writes `assets-src/maps/cornelia-house-<name>.yaml` and the six shop and inn maps.

**Common data for every house interior.**
- Kits: `interior`, `town` and `castle`.
- `music: town`, `canSave: true`, no encounters, and a `name` for the HUD.
- Entrance `door` on the cell above the exit gap; the exit gap leads to `targetEntrance: house_<name>`.

**`cornelia.py`.** Each of the 10 houses gets `name: house_<name>` (the compiler emits the entrance one cell south of the door) and `enter: {map: cornelia-house-<name>, entrance: door}`.

**Variety.**
- No two rooms share a size or plan: sizes run from 8x7 to 14x10, with L-shapes, two rooms joined by an inner doorway, and alcoves.
- Material aliases vary per room:
  - wood floor shaded 0.8 to 1.1;
  - `floor_stone` set to `cobble` or `dirt` for the smithy, farm and cellar;
  - `in_wall_face` set to `castle_wall_in` or to a shaded `castle_face`;
  - carpets with different `carpet_trim` colours.

**The 10 houses.** Each has at least one NPC or chest, using the existing NPC sprites and chest NPCs with new `CHEST_HOUSE_*` flags.

| Door | House | Room | Inside |
|---|---|---|---|
| (46,36) | blue, 2 storeys | Scholar's study: bookshelves, desk, tapestry, a reading alcove | `old_man`, lore on the four crystals and the dark orbs |
| (52,37) | green / white | Fisher's cottage: one room, barrels, crates, table, bed | `villager_f`; chest: Potion |
| (50,49) | red / ochre | Farmhouse by the crops: earth floor, crates, sacks (barrels), a hearth (fireplace) | `villager` farmer, wolf warning; chest: Antidote |
| (44,56) | slate / white, 2 storeys | Retired knight's house: `armor_stand`, `weapon_rack`, fireplace, tapestry | `guard`, who remembers Garland's sword style; chest: item chosen with T4 (e.g. `wooden_nunchaku` for EB-8) |
| (50,56) | brown / rose | Weaver's shop-home: carpet runs, tables, plants | `villager_f` |
| (15,36) | green / plaster | Gardener's lodge by the castle gardens: plants, flowers, `crops` racks | `villager`; chest: Tent |
| (14,63) | red / white | Family home: two rooms, two beds and a table | `villager_f` and `old_man` |
| (6,41) | teal / plaster | Apprentice mage's room: orbs, `potion_shelf`, bookshelf | `mage`, spell-charge hint; chest: Ether |
| (46,60) | blue / ochre | Tavern: counter bar, banquet tables, barrels, fireplace | `merchant` barkeep (talked to across the counter) and 2 patrons with rumours, including one that points to the tomb in the east |
| (35,62) | red / stone, 2 storeys | Wayside shrine: a carpet runner, pillars, a statue, torches | `white_mage` priestess with a healing hint |

Chests in these houses will show ST-12 (an opened chest still looks closed) until T5 fixes it. Pulling ST-12 forward into T3d is optional; it is small.

**IN-5 (folded).** The six shop and inn interiors are rebuilt by the same script, each with its own plan:
- the weapon shop with racks along an L counter;
- the armor shop with stands;
- the item shop with shelves behind a short counter;
- the two magic shops with an orb alcove (white, black);
- the inn: a front counter and a back room of beds.

Keep the keeper ids and `shopId`/`action`, `entrances.door`, the return targets and `music: shop`. The keepers stay behind counters, so the across-counter talk still works.

**CT-6 / CT-7.** `doc["edge_exits"]` in `cornelia.py`:

| Edge | Overworld arrival |
|---|---|
| North (includes the north postern, (6–7,0)) | `cornelia_north` |
| West | `cornelia_west` |
| East, y ≤ 30 (the castle precinct and its east gate (61,24–25)) | `cornelia_north` |
| East, y ≥ 31 | `cornelia_east` |
| South | `cornelia` |

- The explicit edge transitions in `doc["transitions"]` are removed, since they are now generated.
- About 208 walkable edge cells become exits. Arrival in town stays at the gates.

**CT-8.** Connect or cap the dead-end paths in `cornelia.py`:
- the north postern track ends at the north-edge exit (now real);
- the garden walk at (4,25) ends at the orchard well (7,22), through a short spur;
- the lane on row 51 ends at a bench and flower garden at (53–54,50–52);
- the dirt path on row 60 ends at the oak garden at (53–54,59–61);
- the stray dirt at (33–35,56) becomes a path from the high street (31,56) to the shrine door approach (35,63), or is removed.

`road_check` for `cornelia` uses `materials: [cobble, dirt]`, with `ends` listing these gardens.

**Legacy.** `assets/maps/cornelia.yaml` gets the 10 `house_*` names as aliases of [7, 14], as with `castle_gate`, so the every-variant transition test passes.

**Tests: new `tests/data/corneliaLayout.test.ts`.** Each test fails on today's output.
1. **CT-1:**
   - each of the 10 door cells is a transition to a `cornelia-house-*` map that has a `door` entrance;
   - every exit of that interior returns to the cell one south of the same door;
   - every interior has at least one NPC or chest;
   - the 10 ground strings are pairwise different, with at least 5 distinct sizes;
   - the six shop grounds are pairwise different (IN-5).
2. **CT-6:** every walkable edge cell of the compiled `cornelia` is a transition to `overworld`, and its target follows the edge table above.
3. **CT-7:** some overworld transition targets `castle_gate`.
4. **Interiors:** every new interior's NPCs are talkable (also enforced in the compiler).

`crossFileValidation`: the new `CHEST_HOUSE_*` items exist, and the chest flags are unique across maps.

**Images to inspect:**
- Cornelia at full size (small);
- crops of each of the 10 doors;
- each interior at 1x, and all 16 interiors side by side to check that they vary;
- the 4 edges with `--collision`.

### T3e: inspect cells (runtime)

- **Types.** `MapData.inspect?: { x: number; y: number; text: string[] | ConditionalDialog[] }[]`. `validateMapData` checks the shape.
- **New `FieldInspect.ts`.** `inspectAt(map, x, y)` returns the lines, resolved with the same condition logic as NPC dialog.
- **`NPCInteractionSystem`.** When confirm faces no NPC and no counter, it asks `FieldInspect`. `ExplorationScene` opens the dialog through its `DialogManager` (a few lines, so the file doesn't grow).
- **Tests:**
  - facing an inspect cell and pressing confirm shows the text;
  - facing away does nothing;
  - an NPC on the same cell wins;
  - schema cases.
- The same mechanism makes the CT-9 signpost text a one-line data change in T6.

### Validation (integration)

**Commands:**
- `python3 -I assets-src/tools/build_map.py --selftest`
- the layout scripts, then `build_map.py`
- `build_map.py --check-determinism`, for every map
- `npm run build`
- `npm test`, plus `npx vitest run tests/data`

**Reachability and chokepoints (`map_report.py`):**
- **Overworld:** the reachable count, the sealed check, and the distances.
- **Cornelia:**
  - every edge cell is an exit;
  - no new chokepoint is plugged by a static NPC;
  - with T2's `noWander` rules, no wanderer can stand on a door approach.
- **Each interior:** no chokepoint is plugged by its static NPCs.

**Images:** the T3b, T3c and T3d lists above, reviewed before the browser pass.

**Browser** (`?mute=1`, 127.0.0.1):
- `knight_field`:
  - enter 4 houses, including the tavern (talk across the counter) and one chest house;
  - open the chest;
  - exit and arrive on the right door cell;
  - visit one shop of each new layout.
- Leave town over the grass ring at the N, W, E and S edges and the precinct's east gate, and check each arrival side on the overworld.
- Enter each of the 4 icon gates, and check the matching town gate.
- `act1_overworld`:
  - follow each road to its end: the temple door, the north bridge (gate message), the east bridge, the tomb (shows "Here lies Erdrick."), and the jetty;
  - try to cross the spine (impossible);
  - check the camera at the map edges;
  - with the counter at 1, step on each warp 10 times and see no battle;
  - check that load time and fps match T1 (120 fps).
- The console shows 0 errors.

### Decisions for the user

1. **Paid art.** None is needed for T3; everything comes from approved kit art plus offline derivation. The budget stays at 18 of 100 Gemini images. Fallbacks, only if a review rejects the derived result:
   - (a) a city icon with four clear gates (1 Gemini);
   - (b) an overworld edge sheet: hills, peak and snow variants, shallow water (1 Gemini, or Bedrock, which costs nothing against the cap but risks a style mismatch);
   - (c) a tomb landmark (1 Gemini or Bedrock).
   
   OW-8 and OW-9 stay in T6, as already decided.
2. **IN-5 folded into T3d; CA-7 left to T6.** Confirm.
3. **Gate mapping.** The overworld N gate leads to the castle precinct (`castle_gate`). The town's north edge and the precinct's east edge come out north of the icon. Confirm, or name another arrival.
4. **ST-12 forward?** Pull the chest-art fix into T3d so the new house chests look opened. This is optional.

### T3 decisions (taken so the work can proceed; reported to the user)

- **Paid art:** none planned, so the count stays at 18 of 100 Gemini images. Fallbacks are used only if a review rejects the derived art.
- **IN-5** is folded into T3d. **CA-7** stays in T6.
- **City gates:** accepted as the plan describes. The side gates are repainted from the existing pixels; the north gate leads to the castle precinct; leaving by the town's north edge or the precinct's east gate comes out north of the icon.
- **ST-12** (opened chests show as opened) moves into T3d, because the new houses add chests.

### T3 revisions after the momus review (binding)

All 15 momus issues apply. Ownership and resolutions:

1. **Determinism checks.** They run the compiler in subprocesses as `[sys.executable, "-s", build_map.py, …]` with `env={"PYTHONHASHSEED": s}` and without `-I`, because `-I` ignores the variable. The reproduction notes are corrected to say they ran without `-I`.
2. **T3d fills Cornelia's sealed NW pocket**, x 0–2, y 0–17, in `cornelia.py`. The T3a edge-exit validator reports a walkable edge cell that can't be reached as its own error.
3. **T3d lists every road end and connection.**
   - It joins the garden walks at (28,25) and (32,25), and connects the postern track to the network.
   - It handles (10,19), (50,19), (27,25), (33,25), (5,54), (16,54) and (23,60).
   - The oak-garden target becomes the real grass cell (53,59), and the stray dirt rect is corrected to x 33–35.
   - The road check uses "every component end touches a gate, door, garden or plaza", which also covers 2-wide dead ends.
4. **No permanent "town unchanged" selftest.** T3a compares town and castle chunks against the parent commit as a one-off review step, outside `--selftest`. T3b's byte-identical claim covers the castle and temple only.
5. **File ownership.**
   - `kit.py`, including the `paint` loader, belongs to T3a. Peak variants live inside `terrain.py` (T3b).
   - T3a owns `build_map.py`'s CLI and `selftest()`. T3b exposes `terrain.selftest()`, which T3a's selftest calls in one line (as a no-op until T3b lands).
   - T3c must not edit `layouts/common.py`, which T3d owns. T3c must not edit `build_map.py` beyond the hooks T3a provides.
6. **`approve.py` keeps `paint` on re-approval**, the same way it keeps `head_from`. `python3 -I assets-src/gen/selftest.py` is added to the validation.
7. **T3c specifies every paint** with source and target rects in native pixels. That includes a gap where the stream passes through the wall, and the N warp cell's row and column in the 5x4 grid.
8. **`collide: alpha`** is measured on the composited alpha of every footprint cell, null cells included (T3a).
9. **New legend character `≈`**: a natural lake or tarn painted by `terrain.py`, with no stone rim. `river_check` accepts it. `~` stays the town canal.
10. **Old saves (T3c).**
    - `safeSpawn` also moves a spawn that isn't in the component reachable from the first entrance, with a test.
    - The generated overworld lists `cornelia` as its first entrance.
11. **The entrance contract.**
    - The overworld keeps `cornelia`, `cornelia_west`, `cornelia_east`, `cornelia_north`, `castle`, `temple` and `north_shore`.
    - The temple prefab keeps `name: temple`, and `cornelia.py` keeps `north_postern`.
    - T3a adds `cornelia_north` at [28,26] to the current `assets-src/maps/overworld.yaml` and to the legacy overworld, so T3c and T3d each build on their own.
12. **Test placement.**
    - Art-coverage checks go in `map_checks.py`, not vitest.
    - The CT-1 house test reads `assets-src/maps/*.yaml`.
    - The CT-7 test goes in `overworldLayout.test.ts`.
    - `crossFileValidation` also reads `assets/maps/ai/`, and the chest names in it are flags.
    - OW-15 test 1 finds the bridge gap as the water cells between the two stubs in the gate column.
13. **ST-12 in T3d, after T3e has merged.**
    - The chest NPC gets an `opened` state: an opened-chest frame, or a dimmed sprite if no frame exists. It is set at map load from its flag and right after it is looted.
    - Chests don't turn to face the player.
    - Files: `NPC.ts`, `ExplorationScene.ts` (the chest branch), the placeholder or atlas frame lookup. Tests are in `tests/entities/NPC.test.ts`.
14. **`act1Flow.test.ts`** gains overworld cases (T3c):
    - from `cornelia`, the temple transition and both gate cells can be reached;
    - the arrival at `temple` is in that same component;
    - `north_shore` can't be reached.
15. **Smaller points.**
    - `Room.write` takes `KITS`, `CASTLE_MATS`, `GOLD` and `QUIET` as parameters.
    - Fix the house names and the `tpillar_broken_top` / `tpillar_broken_bottom` names.
    - Define `ocean_inlet`.
    - Validation runs the layout scripts by name (`layouts/overworld.py`, `cornelia.py`, `interiors.py`, `castle.py`), then checks `git diff --exit-code assets-src/maps`.
    - The T3a brief carries the map-report logic from `/tmp/playtest/town/{reach,choke}.py`.
    - Load time: compiled-map load in the browser is ≤ 1.5 s per map.
    - A static NPC creating a chokepoint in an interior is a compiler error.

**Order:** T3a and T3e run in parallel and merge first. Then T3b, T3c and T3d run in parallel, each branched from `mainline` *after* that merge. Then all maps are rebuilt once on the integration branch.

### T3a result

**Done** (`build_map.py`, new `map_checks.py`, `map_report.py`, `map_selftest.py`; `kit.py`; `gen/approve.py`):
- **Determinism:** the canal-bank tie now uses `Counter` and SOFT order (`most_common_soft`). The reproduction ran without `-I`, which ignores `PYTHONHASHSEED`. `--check-determinism [ids]` compiles every map in subprocesses (`-s`, env holding only the seed) under two seeds; all 13 maps match. The rebuild changes only Cornelia's cells (28,52) and (33,55): 932 px, which now show grass. One-off review against the parent commit: no other town or castle chunk changed.
- **Objects:** `deco`/`prefab` `offset`, `deco` `style`, `collide: alpha` + `alpha_min` measured on the composited footprint alpha (null cells included; `walk_cells` win).
- **Edge exits**, **inspect** (passthrough + validator), the **map checks**, `--preview`, `map_report.py`, the kit **`paint`** loader (kept by `approve.py`), and the `≈` lake legend (`lake`, painted as soft water until `terrain.py` takes over).
- **Entrance contract:** `cornelia_north` is at [28,26] in `assets-src/maps/overworld.yaml`. In the legacy overworld it is at [8,12], the spot all its Cornelia arrivals share, because [28,26] means nothing on that map.

**Hooks for T3b–T3d:**
- `terrain: organic` dispatches to `terrain.paint_soft(below, mat, kit, seed)` and `terrain.place_peaks(canvas, mat, owner, kit, rng)`.
- `--selftest` calls `terrain.selftest()`, and `--metrics [ids]` calls `terrain.metrics(src, compiled)`, once `terrain.py` exists.
- Source keys: `edge_exits` (+`split`), `inspect`, `sealed_edges`, `road_check` (`materials`, `ends`, `cap_width`), `warp_leaves`, `min_blob` (with `ocean_inlet`), `river_check`, `art_coverage`, `no_static_chokepoints`, and `paint` in kit `.json`. Talkable NPCs are checked on every map.

### T3a/T3e review fixes (momus, binding for T3b–T3d)

**Compiler and runtime changes:**
- `road_check` changes:
  - `check_under: true` turns on the "road under a blocked object" check (it is opt-in; towns keep stalls on cobble);
  - a road component made only of bridge cells (a broken span's far stub) is not a stray network;
  - `islands_ok: [[x, y]]` exempts listed islands.
- `warp_leaves` counts every walkable non-warp 4-neighbour, inside its object too, and requires exactly 1.
- An entrance on a transition cell is a compiler error.
- Inspect entries are strict: plain strings, or `{text, condition?}` with no other keys, in both the compiler and the runtime schema.
- `--preview --scale` parsing works by index, and bad `split` entries raise `MapError`.

**T3c layout rules:**
- The city stream is laid as `r` cells under the icon, so `river_check` sees one river.
- With `ocean_inlet: 2`, the fjord head stays at least 2 wide on both axes.

**T3d rules:**
- Every generated interior sets `no_static_chokepoints: true`.
- Join the castle precinct road network at (55,24) (36 cells) and the piece at (39,60) (14 cells).

**`gen/selftest.py`** needs the gitignored `assets-src/gen/refs/`. Run it from the main checkout.

### T3b result

**Done** (new `assets-src/tools/terrain.py`; `build_map.py` untouched, only the T3a hooks are used). It runs only for sources with `terrain: organic`; the castle and the temple compile to their committed chunks (a selftest check).
- **Outline:** each material's cell mask is blurred (r 20 px, twice, at 1/4 resolution) and resampled through a two-octave domain warp; the strongest field wins. The centre 28x28 px of every cell is clamped to its own material, so collision matches the art (unchanged: the overworld's collision is identical to the classic build).
- **Blends:** grass and sand meet in a 10 px Bayer band. Forests get `tree_clump` stamps about every 40 px along the outline (0.8 / 1.0 scale, mirrored; 2-14 px out, only onto open grass or sand), a 1 px canopy rim and a 3 px south-east shadow; the tan fringe is gone.
- **Water:** ocean and lakes have a shallow band (within 10 px of land, 35 % toward cyan, Bayer-dithered) and a foam line broken by noise. Ocean meeting grass grows a 6-10 px beach on the land side, and mountains meeting the sea get a dark rock rim. Rivers and lakes get 3 px dithered earth banks. `≈` lakes use the river water and have no stone rim.
- **Foothills:** grass near a range carries the mountain texture with ordered dithering, plus scattered 0.5 / 0.6 small peaks and hole-filled `boulder`s (Poisson disc). These cells stay grass.
- **Peaks:** the variants are built from `peak` (as drawn or mirrored, at 0.6 / 0.8 / 1.0 / 1.25), with LANCZOS on premultiplied alpha, the alpha thresholded and the colours snapped to the part's own palette. Snow caps (the top 35 % behind a dithered line) appear at scale >= 1.0 and depth >= 2 cells. They are placed by Poisson disc in the mountain outline, anchored at the bottom, with bigger peaks deeper in and drawn in y order; they overhang walkable cells by at most 8 px. Placement is seeded from the map (not the compile `rng`), so `--metrics` can replay it.
- **Metrics** (`terrain.metrics`; `--metrics`): pixels are classified by the nearest kit texture (shading factors and stamped parts count as their material). An edge is "on a cell line" if it runs parallel to one within 2 px, and a material's edge is where it holds 60 %, so a dithered fringe does not count. On the T3c overworld:
  - coast: run 60 px, 13 % on a cell line;
  - sand/grass: run 86 px, 11 %;
  - forest/grass: run 38 px, 11 %;
  - mountain/grass: run 56 px, 14 %;
  - peaks: 12 variants, anchor spread 13.4 px;
  - foothills: 100 %;
  - fidelity: every cell centre is >= 62 % its own material.
  
  The classic painting of the same map gives 50-59 % on cell lines, 1 variant, a 2.5 px spread and 3 % foothills.
- **Selftest** (`terrain.selftest()`, 42 checks, from `build_map.py --selftest`): horizontal and vertical straight coast, sand, forest and mountain boundaries; a 6x4 mountain block (variants, anchor spread, foothills); fidelity; a lake (no rim); determinism, both in-process and under two `PYTHONHASHSEED`s; and the castle and temple chunks. Every boundary and peak case also asserts that the classic painting fails it.

**Deviations from the plan (for review):**
- **Warp.** The coarse octave (96 px, 14 px) is soft-limited to 6.5 px through `tanh(3 n / sqrt(|n| + 0.01))`. The fine octave is 24 px at 2.5 px, and a 6 px / 1 px octave is added. Each component varies half as fast along its own axis.
  - The reason: the 28 px clamp leaves only 10 px either side of a cell line. With the plan's amplitudes the outline either sat on the line (about 25 % of the boundary) or ran into the clamp and was cut off straight; a steep unshaped warp also folded outlines into thin slivers.
  - Corner cells also get a small own-material pull at the clamp edge, so an outline bends around a cell centre instead of being cut straight.
- **Foothill cover** is 40 % at the foot, fading to 10 % at one cell, then to 0 over 12 px past a noisy reach. It is capped at 33 % in a grass cell's centre. Coverage of 50 % to 25 % read as a grey halo around every range.
- **Peak spacing** is 34 px x scale (the plan's minimum is 30), so the mountain texture shows between the peaks.
- **Beach inner edge.** It is steered off cell lines. Where the ocean already cuts deep into a land cell, the beach narrows to a 2.5-4 px strip that follows the coast. So beaches are 6-10 px where the coast recedes and thin where it bulges.
- **Real-map metric:** one sand/grass run is 86 px, on a narrow peninsula tip whose coast hugs the clamped cell centres. That is over the 72 px synthetic target; every other real-map number meets the synthetic targets.

### T3c result

**Done** (new `layouts/overworld.py`, which writes `assets-src/maps/overworld.yaml`; `gen/approved/overworld/city.json` `paint` fixes; legacy `assets/maps/overworld.yaml` entrance aliases only):
- **Geography:** the peninsula hangs south-west from the mainland; the sound narrows east to the strait and ends at a fjord head; the spine runs from the fjord head south-east to the eastern gulf and seals the isthmus; the east river rises at a tarn (`≈`) and runs straight through the east bridge to the south bay; the east pocket holds the tomb.
- **The moat ponds:** `≈` ponds fill the icon's transparent corner cells (north-west, north-east where the stream rises, south-east), so every gate is a doorway with exactly one walkable neighbour (`warp_leaves`). The city stream is laid as `r` cells under the town, from the north-east pond to the south-west corner, and on to the bay; the icon's `paint` list draws the stream through the walls and a culvert arch.
- **The ring road:** one 1-wide dirt ring runs round the city from the W gate, north, east and down to the S road (never across the stream). The N road leaves it for the north bridge foot, the temple road for the temple's door approach, the E road for the east bridge and the tomb, and the S road for a 3-cell jetty (the ship waits off it). `road_check` passes with `check_under`: no road under an icon.
- **The 2-wide bridges:** the east bridge is two `=` cells across the 2-wide east river, with the channel on the span's columns on both sides (`river_check`). The north bridge is two 2-wide stubs with two rows of open water between them; the `BRIDGE_BUILT` key-item gates sit on the south stub.
- **The canoe** (`requiredFlag: EARTH_CAVE_COMPLETE`; OW-10 stays open) was meant for the east river below the bridge, but its search took the first river cell of that row, which is the city stream, (23,34). Fixed in the T3 review fixes.
- **The tomb (OW-11):** a stone sarcophagus between two broken columns, with flowers and vines, at the end of the E road; both cells `inspect` to "Here lies Erdrick.".
- **Checks on:** `terrain: organic`, `sealed_edges`, `road_check`, `warp_leaves`, `min_blob`, `river_check`, `art_coverage`; `unreachable_ok: [north_shore]`; `cornelia` is the first entrance. `safeSpawn` moves a restored spawn that the first entrance cannot reach.
- **Tests:** `tests/data/overworldLayout.test.ts` (sealed land, edges, roads, warps, river, tomb, distances) and the `act1Flow` overworld case.

### T3d result

**Done** (`layouts/common.py` now holds `Room`; new `layouts/interiors.py`; `layouts/cornelia.py`; `castle.py` regenerates byte-identical sources):
- **CT-1:** ten generated homes, `cornelia-house-<name>`: scholar (study with a reading alcove), fisher (one-room cottage), farm (earth floor, hearth, store; L-plan), knight (hall and armoury through an inner door), weaver (rugs and hangings), gardener (L-plan potting lodge), family (living room and bedroom), apprentice (orb niche), tavern ("The Crystal Tankard": bar, banquet tables, hearth; the barkeep is talked to across the bar, a patron points to the tomb past the east bridge) and shrine (runner, pillars, statue). Ten sizes from 9x8 to 14x10; `music: town`, `canSave`, a HUD `name`, `no_static_chokepoints`. Chests: `CHEST_HOUSE_FISHER` (potion), `_FARM` (antidote), `_KNIGHT` (wooden_nunchaku, pending T4), `_GARDENER` (tent), `_APPRENTICE` (ether). The legacy `assets/maps/cornelia.yaml` has the ten `house_*` names as aliases of [7, 14].
- **IN-5:** the six shops and the inn are generated too, each with its own plan (L counter, stands, short counter before shelves, white orb alcove, west black-orb niche, front counter plus a back room of beds); keeper ids, `shopId`, `door`, return targets and `music: shop` kept. Every keeper has a counter cell in front of it.
- **CT-6/CT-7:** the NW pocket (x 0-2, y 0-17) is wall; `edge_exits` makes all 189 walkable edge cells exits (north `cornelia_north`, west `cornelia_west`, east y <= 30 `cornelia_north`, east y >= 31 `cornelia_east`, south `cornelia`); the explicit edge transitions are gone.
- **CT-8:** `road_check` (`cobble`, `dirt`; `check_under` off) passes: the garden walks join the promenade at (28,25) and (32,25), the postern track runs down to the apron, (50,19) crosses a new footbridge to the quiet garden's bench, (4,25) became a spur to the orchard well, the magic-quarter lane moved out from under the white magic shop to x 9-10 and stops at the two doors, the inn lane starts at its door, the stray dirt at (33-35,56) is gone, and a lane passes the shrine door to a path that crosses the river (the bridge moved to row 61, off the tavern's front wall) and ends at a bench and flower garden by the east wall. The lane on row 51 ends at a bench and flowers at (53-54,50-52). The fisher moved to (38,64), off the new path.
- **ST-12:** `NPC.setOpened()` shows the opened frame (column 1 of the chest block; `build_assets.py field_ai` now bakes `chest_open` there, as the legacy atlas already did) or a dimmed sprite, at map load from the flag (`MapLoader`) and right after looting; chests never turn.
- **Tests:** `tests/data/corneliaLayout.test.ts` (CT-1 from the sources, round trips, sizes, IN-5, talkable, CT-6); `crossFileValidation` reads `assets/maps/ai/` too (flag-based key gates allowed), and checks chest flags; ST-12 cases in `tests/entities/NPC.test.ts`.

### T3 integration result

**Done** on `t3-integration` (head `6a9ad95`):
- **Merge order:** T3a and T3e first, then the T3a/T3e review fixes, then T3d, T3c and T3b. The sub-branches' compiled output was discarded and every map rebuilt once after the last merge.
- **The rebuild:** the overworld is the only map whose chunks changed with T3b (the castle and the temple compile to their committed chunks, a selftest check); the T3b numbers above are measured on that build.
- **Checked again** at the start of the review fixes: the overworld recompiles to its committed chunks, and `--selftest` passes (73 compiler checks and 42 terrain checks).

The review of the integrated tranche then found the issues fixed in the next section.

### T3 review fixes result

**Done** (from the review of `t3-integration`):
- **OW-3, one door per gate:** the keep's drawn door is the N warp, (28,44); the cell above it, among the flag tips, is a walkable approach (`walk_cells`). The painted postern arch is gone from `city.json` (the approved PNG is unchanged). `warp_leaves` holds.
- **OW-15, the larger mainland:** the map gained 16 rows of mainland in the north (72x72; the T3c land keeps its shapes because the layout noise keeps its knots for those rows), with a north bay, two ranges, forests and a mere. The compiled mainland has 1218 walkable cells from `north_shore`, the peninsula 937 from `cornelia` (before: 574 and 930). The layout script and the tests check that the mainland is over 1.15 times the peninsula, and that with the mountains open the north shore can be reached from the city (the isthmus exists).
- **OW-5:**
  - The straight-run metric is now the longest boundary stretch whose points all lie within 3 px of their fitted line (any direction, `metrics.STRAIGHT_DEV`), traced along the outline; `RUN_MAX` is 96 px.
  - The old warp's square-wave coarse octave held outlines parallel to cell lines for 200-300 px. The main warp term is now a meander whose knots alternate in sign every 24-48 px (each row with its own phase), pushed off zero so that outlines cross their cell lines steeply.
  - The cell masks lost their macro staircases: a headland and a cove on the sound's south shore, a bulge in the steps up to the fjord head, a ragged top edge for the south-west forest, and a filled gulf head (its straight east shore was the last coast run over 96 px).
  - The beach's inner edge is steered 6-9.5 px off a parallel cell line (was 4.5-9).
- **Organic roads:** roads are drawn along the network's centre line: rounded corners, staircases of alternating turns as smooth diagonals, junction and 2x2-block fills, dead ends to the cell edge, a noisy edge with a dithered fringe and a darker rim. Collision is unchanged (a selftest compares it with the classic painting).
- **Unreachable cells:** rock fills the pocket behind the tomb (the columns now block both cells), and the layout fills any walkable cell that no entrance reaches (the grass hole in the north-east range). New opt-in map check `no_unreachable_walkable` (allow-list: `unreachable_ok` entrance names or `[x, y]` cells), on for the overworld, with a selftest case.
- **The canoe** is on the east river at (45,50): the river cell of its row nearest the bridge column.
- **`safeSpawn`** accepts a cell that any entrance reaches, and moves a spawn off a warp onto a good neighbour (else to the first entrance).
- **Tests:** `homes.length === 10` in the Cornelia house tests; the OW-15 test and the `act1Flow` overworld case now fail on the old map; the key-gate test checks `requiredFlag` against `STORY_FLAGS`; new `safeSpawn` cases.
- **`terrain.py` is now the `terrain/` package:** `base`, `outline`, `water`, `peaks`, `roads`, `metrics` and `selftest`, each under 250 lines, with the same `terrain.*` hooks. The split alone left every map byte-identical.

**Metrics** (`--metrics overworld`, after the fixes; straight run = within 3 px of a line, limit 96 px):

| Boundary | Longest straight run | On a cell line | Integrated build (new metric) |
|---|---|---|---|
| coast | 91 px | 13 % | 303 px, 13 % |
| sand/grass | 73 px | 19 % | 242 px, 11 % |
| forest/grass | 95 px | 12 % | 166 px, 11 % |
| mountain/grass | 91 px | 17 % | 211 px, 14 % |

Peaks: 12 variants, anchor spread 13.1 px; foothills 100 %; fidelity: every wild cell centre is >= 61 % its own material (roads are now left out of fidelity: a diagonal track cuts across its cells by design). The cost of the shorter runs is a higher on-line share for sand/grass and mountain/grass: an outline that may not stay parallel to a cell line for 96 px has to cross it more often. A uniformly random offset inside the 10 px margin would give about 24 %; the classic painting gives 50-59 %. Synthetic straight boundaries (the selftest) stay under 96 px and 15 %.

---

## T6: Polish and the presentation decisions

### OW-9: the broken north bridge (note from the T3 review)

- The art fix (snapped planks, pilings, debris on the two stubs) is paid art, as decided.
- **A future bridge-building cutscene (ST-1) must also change the map.** The gap between the stubs is two rows of open ocean, so setting `BRIDGE_BUILT` alone opens nothing: the key-item gates on the south stub let the party through, but the water stops it one step later. The cutscene needs a built variant of the span: the gap cells as bridge (collision and art), for example a flag-gated overlay or a second compiled variant of the overworld that the map loader picks when the flag is set. The OW-15 test already models this (it opens the gap cells by hand).

---

### T3 final validation (orchestrator, head 8d2cd88)

- **Momus:** OKAY after two revise rounds.
- **Browser, `?mute=1`:**
  - a house interior and its exit;
  - the town's west edge exits onto the overworld beside the west gate;
  - the Erdrick tomb's inspect text;
  - an opened chest shows as opened and adds its item;
  - all 72x72 overworld previews reviewed.
- **Load time (local dev):**
  - overworld 53 ms with the cache disabled, about 20 ms cached;
  - Cornelia 53 ms;
  - houses, castle and temple 16–23 ms;
  - all well under the 1.5 s target.
- **On-cell-line share** is 17–19 % for sand/grass and mountain/grass, against the 15 % synthetic target. Accepted, because the fitted-line metric and the visual review pass.
- **Carried forward:**
  - **T5:** Cornelia's unreachable cells, which predate T3: (53,2), (53,3), (54,3), (35,67) and (36,67). Fill them and turn on `no_unreachable_walkable`.
  - **T6:** split `layouts/overworld.py` (536 lines), `layouts/interiors.py` (509) and `map_checks.py` (435).
  - **Second pass:** the stray-pixel line beside the opened chest in the fisher's cottage, and the HUD's 5-character name truncation.

## T4: Balance on the FF1 baseline

**Defects:**
- NG-4, the charge-table half (T2 kept the old table);
- NG-5;
- EB-1;
- EB-3 to EB-10;
- BA-10: front-slot targeting and the per-member XP line.

EB-11 is context.

**Binding decision** (playtest triage): "Use the original FF1 numbers as the tuning baseline for XP, gold, spell power, status hit rates and starting gold." EB-10 and BA-10 fall under the same baseline: enemy damage varies, formations hold 1 to 9 enemies, and enemies prefer the front slots.

**Approach.**
- Port FF1's (NES, 1987) formulas and act-1 numbers.
- Map the game's enemies onto their FF1 counterparts, and keep the game's own content: names, classes, the Knight-house chest and the art.
- Deviate from FF1 only where the target needs it. There is one such deviation, Garland (§2.1).
- Numbers I'm not sure of are marked **(≈)**, each with the value to use.

**Target.** A fresh party at the level expected for Garland (about L2–L4 after an hour of play in FF1):
- wins most of the time with sensible play;
- loses with careless play.

The scratch simulation in §6 sets the numbers.

---

### 0. Summary of the model

| Area | Today | T4 (FF1) |
|---|---|---|
| Physical damage | `atk − def + rand(1..level)` (enemies use level 1, so there is no variance); one hit; flat 80 % hit; crit 1/32 | Per hit: `rand(A, 2A) − absorb` (min 1). `A = weapon + ⌊STR/2⌋` for party members; for enemies, `A` is their `attack`. Hits per attack: `1 + ⌊hit%/32⌋` for the party, `hits` for enemies. Hit chance: `(168 + hit% − evade) / 200`, with +40 against a sleeping or paralysed target. Crit chance: `crit / 200`; a crit adds one more `rand(A, 2A)` that ignores absorb |
| Party hit% | none | Class base + growth per level + weapon `hit` |
| Party evade | none | `48 + AGI − armour weight`, plus the RUSE and INVS buffs |
| Enemy evade | none | Data field `evade`, plus the LOCK debuff |
| Magic damage | `power × INT / targetINT` (FIRE 300–600) | `rand(E, 2E)`, where `E` is the spell's `power`. Weak: `E × 1.5`. Resistant: damage halved. If the spell connects (`(148 + accuracy − MDef) / 200`), damage doubles. INT is not used (as in FF1). FIRE does 10–20, or 20–40 when it connects |
| Heal | `power × INT / 4` (CURE about 112) | `rand(E, 2E)`. CURE heals 16–32, CUR2 33–66, HEAL 12–24 each |
| Status spells | always hit; last forever | Hit on `(148 + accuracy − MDef) / 200`. A sleeping or paralysed actor loses its turn, then wakes if `rand(0..80) < currentHP` **(≈)**. Damage doesn't wake (FF1) |
| RUSE / INVS / LOCK / FOG / TMPR | values stored, never read | RUSE +80 evade (self), INVS +40 evade, LOCK −20 enemy evade, FOG +8 absorb, TMPR +14 attack, all read by the formulas above |
| Run | `50 + (party AGI − enemy AGI)/2` | Per runner: succeeds if `rand(0 .. level+15) < LUCK`. A Lv1 Thief escapes 88 % of the time, a Lv1 Warrior 29 % |
| Enemy targeting | uniform over the living | Slot weights 4/2/1/1 over the living, in party order (FF1: 50/25/12.5/12.5 %) |
| XP curve | `25·lvl^2.6` (151 XP for Lv2) | FF1 table (40 XP for Lv2, 196 for Lv3, 547 for Lv4, …) |
| Level-up | full heal | +max-HP gain only (FF1) |
| Spell charges | one table for every class | Per-class FF1-style tables in `classes.yaml`. Classes with no spells have no charges |
| Starting gold | 100 | 400 |
| Spell price | 100 × spell level | FF1 by level: 100 / 400 / 1500 / 4000 / 8000 / 20000 / 45000 / 60000 |
| Formations | fixed lists of at most 2 | Groups with min–max counts, at most 9 enemies, regional zones |

---

### 1. Data changes

### 1.1 `enemies.yaml`: act-1 enemies mapped to FF1

New optional fields: `accuracy`, `evade`, `hits` (default 1) and `crit` (out of 200, default 1). `stats.magicDefense` is now used.

| Game id (keep the name) | FF1 counterpart | HP | attack | accuracy | hits | defense | evade | magicDefense | agility | xpReward | goldReward | Elements / family | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `goblin` (Goblin) | IMP | 8 | 4 | 2 | 1 | 4 | 6 | 16 | 6 (was 4) | 6 | 6 | weak fire (game's own; FF1 IMP has none) | was HP 20, 6 XP |
| **new** `gr_imp` (Gr.Imp) | GrIMP | 16 | 8 | 4 (≈) | 1 | 6 | 9 | 23 (≈) | 7 | 18 | 18 | weak fire | sprite `gr_imp`, a palette swap of `goblin` |
| `wolf` (Wolf) | WOLF | 20 | 8 | 5 (≈) | 1 | 0 | 36 (≈) | 28 (≈) | 12 (was 7) | 24 | 6 | weak fire, resist ice, `were` (keep) | was HP 15 |
| **new** `gr_wolf` (Gr.Wolf) | GrWOLF | 72 | 14 | 18 (≈) | 1 | 0 | 36 (≈) | 46 (≈) | 14 | 93 | 22 | `were` | east pocket only (rare); palette swap of `wolf` |
| `skeleton` (Skeleton) | BONE | 10 | 10 | 9 (≈) | 1 | 12 | 12 (≈) | 17 (≈) | 6 | 9 | 3 | weak fire, resist ice, `undead` (HARM works) | was HP 30 |
| `pirate` (Pirate) | PIRATE | 6 | 8 | 2 (≈) | 1 | 0 | 6 (≈) | 15 (≈) | 6 | 40 | 40 | weak lightning (keep) | **removed from the act-1 tables** (FF1: Pravoka); kept for later acts |
| `garland` (Garland) | GARLAND | **240** (FF1 106) | **16** (FF1 15) | 15 (≈) | **2** (FF1 1) | 10 | 12 (≈) | 15 (≈) | 8 | 130 | 250 | **no weakness** (FF1 has none; today's `weakness: lightning` goes) | see §2.1. Keep `bossPhases` (message only; see ST-6 below) |

**Unchanged structure:** `str`, `int`, `vit` and `luck` stay in `stats`, but no formula reads them for enemies. Set `intelligence` to 1.

**Optional:** enemies from later acts (FF1 counterpart, values ≈, so later acts start on the same scale). None of them is in act 1. Do this only if debug scenarios and tests stay green.

| id | FF1 counterpart | HP | attack | defense | XP | gold |
|---|---|---|---|---|---|---|
| `ogre` | OGRE | 100 | 18 | 10 | 195 | 195 |
| `troll` | TROLL | 184 | 24 | 12 | 621 | 621 |
| `mummy` | MUMMY | 80 | 30 | 20 | 300 | 300 |
| `cockatrice` | COCTRICE | 50 | 1 (stone touch) | 4 | 276 | 200 |
| `vampire` | VAMPIRE | 156 | 76 | 24 | 1200 | 2000 |
| `dragon` | RED D (≈) | 248 | 30 | 30 | 1218 | 4000 |
| `lich` | LICH (boss) | 400 | 40 | 40 | 2200 | 3000 |

**Art (no paid images).** Add `variants` to `assets-src/gen/monsters.yaml`:
- under `goblin`: `{id: gr_imp, hue: 25, sat: 1.1}`, a redder imp;
- under `wolf`: `{id: gr_wolf, hue: -20, sat: 0.6}`, a darker, greyer wolf.

Then run `python3 -I assets-src/build_assets.py monsters_ai`. `assetCoverage.test.ts` covers both.

### 1.2 `items.yaml`

New optional fields:
- weapons: `hit` (hit% bonus) and `crit` (out of 200);
- armour: `weight` (the evade penalty).

| id | attack / defense | hit | crit (FF1 index bug, ≈) | weight | price | usableBy changes |
|---|---|---|---|---|---|---|
| `wooden_nunchaku` | 12 | 0 | 1 | – | 10 | – |
| `small_knife` | 5 | 10 | 2 | – | 5 | – |
| `staff` | 6 | 0 | 3 | – | 5 | – |
| `rapier` | 9 | 5 | 4 | – | 10 | – |
| `hammer` | 9 | 0 | 5 | – | 10 | – |
| `short_sword` | **15** (was 10) | 10 | 6 | – | **550** (was 15) | – (leaves Cornelia) |
| `hand_axe` | 16 | 5 | 7 | – | 550 | – |
| `iron_nunchaku` | 16 | 0 | 9 | – | 200 | – |
| `iron_sword`, `mythril_*` and the rest | as now | 10 (≈) | 10–20 (≈) | – | as now | – |
| `cloth` | 1 | – | – | 2 | 10 | all (as now) |
| `robe` | 2 | – | – | 2 | 20 | mages (as now) |
| `leather_armor` (FF1 Wooden Armor) | 4 | – | – | 8 | 50 | **+ monk** (EB-8) |
| `chain_mail` | 15 | – | – | 15 | 80 | – |
| `iron_armor` | 24 | – | – | 23 | 800 | – |
| `mythril_armor` / `mythril_mail` / `dragon_armor` | as now | – | – | 33 / 8 / 10 (≈) | as now | – |
| `wooden_shield` / `iron_shield` / `mythril_shield` | as now | – | – | 0 | as now | – |
| `cap` | 1 | – | – | 1 | 10 | – |
| `iron_helm` / `mythril_helm` | as now | – | – | 3 / 3 (≈) | as now | – |
| `tent` | – | – | – | – | **75** (was 250) | – |
| `cabin` | – | – | – | – | **250** (was 500) | – |
| `potion`, `antidote`, `soft` | – | – | – | – | 60 / 75 / 800 (already FF1) | – |

Body armour (`leather_armor`, `chain_mail`, …) gets an explicit `slot: armor`, so the Monk rule "no body armour" is a clear slot check.

### 1.3 `spells.yaml`

New optional fields:
- `accuracy`, used in the connect and status roll; the default is 24;
- `price`; when it is absent, the per-level table applies.

`power` is now FF1's effectivity. For buff and debuff spells, `power` is the amount.

| id | level | power (was) | accuracy | price | Notes |
|---|---|---|---|---|---|
| `cure` | 1 | 16 (30) | – | 100 | heals 16–32 |
| `harm` | 1 | 20 (20) | 24 | 100 | undead only |
| `fog` | 1 | 8 (0) | – | 100 | +8 absorb |
| `ruse` | 1 | 80 (0) | – | 100 | +80 evade, self |
| `fire` | 1 | 10 (20) | 24 | 100 | 10–20, or 20–40 when it connects |
| `lit` | 1 | 10 (20) | 24 | 100 | |
| `slep` | 1 | 0 | 24 | 100 | all enemies |
| `lock` | 1 | 20 (0) | 64 (≈) | 100 | −20 evade |
| `ice` | 2 | 20 (30) | 24 | 400 | |
| `invs` | 2 | 40 (0) | – | 400 | +40 evade |
| `tmpr` | 2 | 14 (0) | – | 400 | |
| `mute`, `dark`, `slow` | 2 | – | 64 / 24 / 64 (≈) | 400 | |
| `lamp`, `alit` | 2 | – | – | 400 | |
| `cure2` | 3 | 33 (60) | – | 1500 | |
| `heal` | 3 | 12 (20) | – | 1500 | all allies |
| `hrm2` | 3 | 40 | 24 | 1500 | |
| `fir2` / `lit2` | 3 | 30 | 24 | 1500 | |
| `hold` | 3 | – | 64 (≈) | 1500 | |
| `lok2` | 3 | 20 | 64 (≈) | 1500 | |
| `afir` | 3 | – | – | 1500 | |
| `ice2` | 4 | 40 | 24 | 4000 | |
| `slp2`, `conf` | 4 | – | 48 (≈) | 4000 | |
| `fear` | 4 | – | 40 (≈) | 4000 | |
| `pure`, `aice`, `amut`, `fast` | 4 | – | – | 4000 | |
| `cure3` | 5 | 66 (120) | – | 8000 | |
| `life` | 5 | – | – | 8000 | |

### 1.4 `classes.yaml`

New fields:
- `hitPercent: {base, growth}`, used by party attacks;
- `magicDefense: {base, growth}`, used when enemies cast at the party;
- `spellCharges`: step breakpoints `[[level, [l1..l8]], …]`. A value holds until the next breakpoint, and a missing class means no charges.

`baseStats` and `statGrowth` stay as they are: they are the game's own and close to FF1's.

| Class | hitPercent base / growth | magicDefense base / growth (≈) | spellCharges (level: L1, L2, …) |
|---|---|---|---|
| warrior, knight | 10 / 3 | 15 / 3 | warrior: none. Knight: 10: [1]; 15: [2,1]; 20: [3,2,1]; 30: [5,4,3]; 40: [7,6,5]; 50: [9,8,7] (≈) |
| thief, ninja | 5 / 2 | 15 / 2 | thief: none. Ninja: 10: [1]; 15: [2,1]; 20: [3,2,1]; 25: [4,3,2,1]; 30: [5,4,3,2]; 40: [7,6,5,4]; 50: [9,8,7,6] (≈) |
| monk, master | 5 / 3 (≈) | 10 / 4 (≈) | none |
| red_mage, red_wizard | 7 / 2 | 20 / 2 | 1: [2]; 3: [3]; 4: [3,1]; 5: [4,1]; 6: [4,2]; 7: [5,2,1]; 9: [5,3,2]; 10: [6,3,2,1]; 13: [6,4,3,2,1]; 16: [7,5,4,3,2,1]; 20: [8,6,5,4,3,2,1]; 30: [9,8,7,6,5,4,3]; 40: [9,9,9,8,7,6,5]; 50: [9,9,9,9,9,8,7] (≈) |
| white_mage, black_mage, both wizards | 5 / 1 | 20 / 2 | 1: [2]; 2: [3]; 3: [3,1]; 4: [4,2]; 5: [4,2,1]; 6: [5,3,2]; 7: [5,3,2,1]; 8: [6,4,3,2]; 9: [6,4,3,2,1]; 10: [7,5,4,3,2]; 11: [7,5,4,3,2,1]; 13: [8,6,5,4,3,2,1]; 15: [9,7,6,5,4,3,2,1]; 20: [9,9,8,7,6,5,4,3]; 30: [9,9,9,9,8,7,6,5]; 40: [9,9,9,9,9,9,8,7]; 50: [9 × 8] (≈) |

**Certainty.** The exact FF1 MP tables are not certain. The structure is: Lv1 starts with 2 L1 charges; a new spell level opens about every 2 levels for White and Black Mages and every 3 for Red Mages; the cap is 9. That structure is what matters for act 1.

Also delete the unused `usableEquipment` keys, or leave them, since `usableBy` is the rule. Recommendation: leave them (out of scope).

### 1.5 `shops.yaml` (FF1 Coneria lists)

| Shop | Now | T4 |
|---|---|---|
| `cornelia_weapon` | rapier, short_sword, hammer, staff | **wooden_nunchaku, small_knife, staff, rapier, hammer** (EB-8: the Monk can buy a weapon) |
| `cornelia_armor` | leather_armor, chain_mail, wooden_shield, cap | **cloth**, leather_armor, chain_mail, wooden_shield, cap (EB-7: mage body armour) |
| `cornelia_item` | potion, antidote, tent | same (Tent is now 75) |
| `cornelia_white` / `cornelia_black` | cure, harm, fog, ruse / fire, lit, slep, lock | same (already FF1) |
| `cornelia_inn` | 30 | 30 (FF1) |

**What the 400 G start buys (checked):**

| Member | Kit | Cost |
|---|---|---|
| Warrior | rapier, leather armour, wooden shield | 75 |
| Thief | rapier, leather armour | 60 |
| White Mage | hammer, cloth, CURE | 120 |
| Black Mage | knife, cloth, FIRE | 115 |
| **Total** | | **370** |

In the simulation, the rest of the "full" kit costs about 600 G:
- chain mail and four caps;
- LIT, SLEP and RUSE;
- three potions.

The simulated campaign has earned that by about battle 25–40, which is L3.

### 1.6 Formations and zones (map data; T4e)

`EncounterEntry` gains a group form, `{groups: [{id, min, max}], weight}`. The old `enemies: [...]` form keeps working. The total is capped at 9.

**Overworld: map default (Cornelia fields, which includes the north road to the bridge).** FF1 counterpart: the Coneria domain (≈ formations, IMP and WOLF heavy).

| Formation | weight |
|---|---|
| Goblin ×3–5 | 5 |
| Wolf ×1–2 | 3 |
| Goblin ×2–3 + Wolf ×1 | 3 |
| Gr.Imp ×1–2 + Goblin ×1–3 | 2 |
| Wolf ×2–4 | 1 |

**Zone `temple_approach`:** walkable cells closer, by walking distance, to the temple door than to the `cornelia` arrival.

| Formation | weight |
|---|---|
| Gr.Imp ×2–4 | 3 |
| Wolf ×2–4 | 3 |
| Goblin ×4–6 | 2 |
| Gr.Imp ×1–2 + Wolf ×1–2 | 2 |

**Zone `east_pocket`:** the component that the east bridge cuts off; it holds the tomb.

| Formation | weight |
|---|---|
| Wolf ×3–5 | 3 |
| Gr.Imp ×3–5 | 2 |
| Gr.Wolf ×1 + Wolf ×0–2 | 1 |

**Temple of Fiends** (map-level `encounters`). FF1 counterpart: BONE and GrIMP (≈). The FF1 CREEP and MADPONY have no art, so they are left out.

| Formation | weight |
|---|---|
| Skeleton ×2–4 | 4 |
| Skeleton ×1–3 + Gr.Imp ×1–2 | 3 |
| Gr.Imp ×2–4 | 2 |
| Wolf ×2–3 | 1 |
| Skeleton ×4–6 | 1 |

**Rates:** these stay as they are, 15–30 steps on the overworld and 8–15 in the temple. A zone may override the rate, but none does in act 1.

**Pirates** leave every act-1 table, so there are no pirates next to town (EB-1).

The legacy 1x maps (`assets/maps/overworld.yaml` and `temple-of-fiends.yaml`, `?art=legacy`) get the same default and temple tables, with no zones.

### 1.7 Other data

- **`PartyCreationScene.STARTING_GOLD`:** 400 (NG-5).
- **`debug-scenarios.yaml`:** new scenarios for the browser checks:
  - `t4_fields_l1`: the Lv1 400 G kit against Goblin ×5;
  - `t4_garland_l2_start`: Lv2 with the 400 G kit, against Garland;
  - `t4_garland_l3_full`: Lv3 with the full kit, LIT, SLEP, RUSE and 3 potions, against Garland;
  - `t4_temple_six`: Skeleton ×4 + Gr.Imp ×2;
  - `t4_nine`: Goblin ×6 + Wolf ×3.
- **`CHEST_HOUSE_KNIGHT`** stays `wooden_nunchaku` (confirmed; it is now also sold for 10 G, so it is a small gift).

---

### 2. Code changes

`BattleStateMachine.ts` is already 620 lines. The new maths goes into new pure modules, and the state machine only delegates to them, so its size goes down.

### 2.1 T4a: battle maths (`src/battle/`)

**New `src/battle/CombatStats.ts`** (pure, no PixiJS). For a party member:
- `partyAttack(c)` = weapon attack + ⌊STR/2⌋ + the TMPR buff. An unarmed Monk or Master gets ⌊STR/2⌋ + 2×level (≈ FF1).
- `partyHitPercent(c)` = class base + growth×(level−1) + weapon `hit`.
- `partyHits(c)` = 1 + ⌊hit%/32⌋, doubled for an unarmed Monk or Master.
- `partyEvade(c)` = 48 + AGI − Σ armour `weight` + the evade buff.
- `partyAbsorb(c)` = Σ armour defense + FOG. A Monk or Master with no body armour gets max(that, level).
- `partyMagicDefense(c)` = class `magicDefense` base + growth×(level−1).
- `partyCrit(c)` = weapon `crit`, or 0 unarmed.

For an enemy:
- `enemyEvade(e)` = `data.evade` + the LOCK buff;
- `enemyHits`, `enemyCrit` and `enemyAccuracy` read the data, with defaults 1, 1 and 0.

**`DamageFormula.ts`:**
- Replace `calculateDamage` with `physicalAttack({attack, hitPercent, hits, crit}, {evade, absorb, helpless}, rng) → {damage, hitsLanded, critical, hit}`. It runs the per-hit loop from §0.
- Replace `calculateMagicDamage` with `magicDamage({power, accuracy, element}, {magicDefense, weakness, resist, elementalProfile}, rng)`. The weak multiplier is ×1.5 on E and the resist multiplier halves the damage, both from `Elements` through a new `magicElementMultiplier`. `getElementalMultiplier` stays for its current callers.
- Add `statusHits(accuracy, magicDefense, rng)`.
- `healAmount(spell, rng)` = `rand(E, 2E)`. It is still shared by battle and field CURE (MS-3), with no caster INT.

**`BattleStateMachine.ts`:**
- `executePartyAttack` and `executeEnemyAttack` call `physicalAttack` with `CombatStats`. This fixes EB-6 and EB-10. The message shows the number of hits when it is more than 1 ("hits Goblin 2 times for 18!").
- `executeCommand('run')` uses the acting member's `luck` and `level` through a new `BattleCommands.calculateRunChance(luck, level)` (EB-9).
- `tickCombatantStatus`: a sleeping or stunned actor loses its turn. Then it rolls `rand(0..80) < currentHp` and wakes on success ("X wakes up!") (EB-5).
- `finish('victory')`: `result.xpPerMember = xpShare(total, livingParty.length)`, and the line becomes `Victory! {share} XP each, {gold} Gold.` (BA-10). `PartyManager.distributeXp` uses the same `xpShare`.
- The default enemy target and `retargetIfDead` for enemy actions use the weighted `selectTarget`.

**`EnemyAI.selectTarget(targets, rng, weights = FRONT_WEIGHTS [4,2,1,1])`:**
- weighted over the living, in party order;
- used by `BasicAI`, `BossAI` and the state machine's default.

This is BA-10 / EB-10, and it makes `FieldOrderScene` meaningful.

**`SpellExecutor.ts`:**
- `executeDamageSpell` uses `magicDamage`. A `status_*` spell rolls `statusHits` per target and says "X is unaffected." on a miss. A party target uses `partyMagicDefense`.
- `executeHealSpell` uses `healAmount`.
- `executeBuffSpell` and `executeDebuffSpell` take the amount from `spell.power` when it is above 0, and fall back to `BUFF_VALUES` / `DEBUFF_VALUES`. Fix the comment (RUSE is +80).
- LOCK rolls `statusHits` too.

**`StatusEffects.ts`:**
- Add `StatusTracker.isHelpless()` (sleep or stun).
- `onHit()` stays unused: damage doesn't wake, as in FF1. Document that.

**Types** (`src/types/index.ts`):
- `EnemyData`: `accuracy?`, `evade?`, `hits?`, `crit?`.
- `ItemData`: `hit?`, `crit?`, `weight?`.
- `SpellData`: `accuracy?`, `price?`.
- `CharacterClassData`: `hitPercent?`, `magicDefense?`, `spellCharges?`.
- `BattleResult.xpPerMember`.

`schemaValidation.ts` checks the optional numbers when they are present.

**ST-6 interplay (stays in T5).** Garland's `bossPhases.patternId: aggressive` must not add damage when T5 wires it: the pattern is Fight only, plus the message. Otherwise T5 re-runs the §6 simulation and keeps its targets.

### 2.2 T4b: progression and economy

- **New `src/entities/ExperienceTable.ts`:** the FF1 table below; `Character.xpForNextLevel` uses it.
- **`Character.addXp`:** on level-up, `currentHp += maxHp_after − maxHp_before` instead of a full heal (FF1).
- **`Character.stats.attack`** becomes `partyAttack(c)` (from T4a's `CombatStats`, which T4b imports), so Status, Equip and the shop comparison show the battle number. `defense` stays the armour sum plus buffs.

  If T4a is not merged yet, T4b keeps the old `stats` and T4d switches it over.
- **`SpellCharges.ts`:** `maxChargesFor(classData, charLevel, spellLevel)` reads `classData.spellCharges` (step breakpoints) and returns 0 when the class has none. It drops the shared `BREAKPOINTS`. `Character.getMaxCharges` passes `this.classData`; after an upgrade, the new class's table applies.
- **`Character.fromJSON`:** clamp the saved charges to the new maximum, so an old save never holds more than the new table allows.
- **`PartyCreationScene`:** `STARTING_GOLD = 400`.
- **`MagicShopScene.priceOf(spell)`:** `spell.price ?? SPELL_PRICE_BY_LEVEL[spell.level]` (100, 400, 1500, 4000, 8000, 20000, 45000, 60000). Remove `SPELL_PRICE_BASE`. `SpellPurchase` is unchanged.
- **Wizards:** the class upgrade already heals; charges are refilled by the new table on the next rest. No change.

**FF1 experience table** (total XP needed to reach each level). The exact values above Lv30 are uncertain to ±1. FF1 adds a constant 32,799 or 32,800 per level past 30.

| Lv | XP | Lv | XP | Lv | XP | Lv | XP | Lv | XP |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 40 | 12 | 19,735 | 22 | 129,131 | 32 | 399,250 | 42 | 727,245 |
| 3 | 196 | 13 | 25,351 | 23 | 148,008 | 33 | 432,049 | 43 | 760,044 |
| 4 | 547 | 14 | 31,942 | 24 | 168,639 | 34 | 464,849 | 44 | 792,844 |
| 5 | 1,171 | 15 | 39,586 | 25 | 191,103 | 35 | 497,648 | 45 | 825,643 |
| 6 | 2,146 | 16 | 48,361 | 26 | 215,479 | 36 | 530,448 | 46 | 858,443 |
| 7 | 3,550 | 17 | 58,345 | 27 | 241,843 | 37 | 563,247 | 47 | 891,242 |
| 8 | 5,461 | 18 | 69,617 | 28 | 270,275 | 38 | 596,047 | 48 | 924,042 |
| 9 | 7,957 | 19 | 82,253 | 29 | 300,851 | 39 | 628,846 | 49 | 956,841 |
| 10 | 11,116 | 20 | 96,332 | 30 | 333,651 | 40 | 661,646 | 50 | 989,641 |
| 11 | 15,016 | 21 | 111,932 | 31 | 366,450 | 41 | 694,445 | | |

### 2.3 T4c: encounter engine

**Types:**
- `EncounterEntry = {weight} & ({enemies: string[]} | {groups: EncounterGroup[]})`, with `EncounterGroup = {id, min, max?}`.
- `EncounterZone = {id, rects: [x0, y0, x1, y1][], encounters: EncounterEntry[], encounterRate?: EncounterRate}`, with inclusive rects.
- `MapData.encounterZones?: EncounterZone[]`.

**`EncounterTable.selectEnemies()`:**
- For a group entry, it rolls each count in `[min, max]`.
- If the total is 0 (every min is 0), it uses the first group's id once.
- It caps the total at `MAX_FORMATION = 9`, cutting from the end.

**`EncounterSystem`:**
- **`setZones(zones)`:** one `EncounterTable` per zone, sharing the RNG.
- **`handleMove(pos)`:** when the counter fires, the table is the first zone whose rects contain `pos`, or else the map table. After an encounter, the counter is reset with that zone's `encounterRate`, or the map's.
- **`isEmpty`:** the check considers the zones too.
- **`ExplorationScene.loadMap`:** calls `setZones(mapData.encounterZones ?? [])` next to `setEncounters` (one line).

**`schemaValidation.validateMapData`:**
- each entry has exactly one of `enemies` or `groups`;
- 0 ≤ min ≤ max ≤ 9;
- zone rects are 4 integers inside the map bounds.

**Formation fits the screen.** Add a pure helper, `formationFits(sizes)`, in `src/scenes/battle/EnemyLayoutAi.ts`. It reports whether the maximum roll of any formation fits `ENEMY_AREA` at scale 1 or 0.5, without overlap. `crossFileValidation` uses it.

### 2.4 T4d: data and tuning

- All of §1.1 to §1.5 and §1.7: the YAML, the monster variants and the atlas rebuild.
- Commit the balance test (§3, T4d).

### 2.5 T4e: map zones (after T3 merges)

**The hook it needs.** A new source key, `encounterZones`, in:
- `assets-src/tools/build_map.py` `PASSTHROUGH` (T3a's file; one tuple entry);
- a compiler validator: each zone has an `id`, the rects are in bounds, and every zone covers at least one walkable cell. It goes in `validate()`, next to the existing `inspect` check.

**`assets-src/tools/layouts/overworld.py`** (T3c's file) emits:
- `encounters`: the default (fields) table from §1.6;
- `encounterZones`:
  - `temple_approach`: BFS from `TEMPLE_DOOR` and from `ARRIVE["cornelia"]` over `walk_grid(g)`, with the east bridge blocked. The cells strictly closer to the temple form the zone, run-length encoded per row into rects.
  - `east_pocket`: the cells reachable from `TOMB_END` when the east-bridge cells `(RX, RY)` and `(RX+1, RY)` are blocked.

  The order is `east_pocket`, then `temple_approach`. Use the existing `bfs` and `walk_grid` helpers.
- **`assets-src/maps/temple-of-fiends.yaml`:** the temple table from §1.6, in group form.
- **The legacy `assets/maps/overworld.yaml` and `temple-of-fiends.yaml`:** the same tables, no zones.
- **Rebuild:** run `layouts/overworld.py`, then `build_map.py` for `overworld` and `temple-of-fiends`, then `--check-determinism overworld temple-of-fiends`.

---

### 3. Tests (each fails on the current code)

### T4a

| File | Test | Why it fails today |
|---|---|---|
| `tests/battle/DamageFormula.test.ts` (rewritten) | `physicalAttack` with A=19 and absorb 10: rng ≈ 0 gives 9, rng ≈ 0.999 gives 28. With hit% 10 and evade 6, the chance is 172/200: a roll of 0.85 hits and 0.87 misses. hit% 32 gives 2 hits. crit 4 with roll < 0.02 crits and adds a second roll that ignores absorb. A helpless target gets +40 | flat 80 % hit; `atk − def + rand(level)` |
| `tests/battle/BattleStateMachine.test.ts` | Enemy damage varies: the same enemy and target under two RNG streams give different damage (EB-10) | enemies use `level: 1`, so damage is constant |
| `tests/battle/SpellEffects.test.ts` | RUSE: a fixed RNG where Garland hits before RUSE and misses after it. LOCK: a party roll that misses before LOCK and hits after it (EB-6) | evade is never read |
| `tests/battle/MagicDamage.test.ts` (rewritten) | FIRE (power 10) on MDef 16: a miss-connect stays in [10, 20], a connect in [20, 40]. Weak gives [15, 30] / [30, 60]; resistant halves it. A Lv1 Black Mage's FIRE never does more than 60 (EB-4) | 300–600 |
| `tests/scenes/FieldMagic.test.ts` and a new battle CURE case | CURE heals 16–32 in battle and in the field | about 112 |
| `tests/battle/StatusEffects.test.ts`, `SpellExecutor.test.ts` | SLEP misses when the roll is ≥ (148+24−MDef)/200 ("unaffected"). A sleeping Garland (HP 240) loses one turn, then wakes, and acts on the next round. A goblin at 8 HP stays asleep with roll 0.5. Over 15 rounds of SLEP every round, Garland acts at least once (EB-5) | 100 % hit; sleep never ends |
| `tests/battle/BattleCommands.test.ts` | `calculateRunChance(luck 15, level 1)` = 15/17. A Lv1 Thief escapes with roll 0.85; a Lv1 Warrior (luck 5) fails with the same roll (EB-9) | uses the agility average |
| `tests/battle/EnemyAI.test.ts` | Weighted targets: rolls 0.49, 0.6, 0.8 and 0.95 pick slots 0, 1, 2 and 3. With slot 0 dead, the weights are 2/1/1. Over 10,000 rolls, slot 0 is chosen 50 ± 2 % of the time (BA-10) | uniform choice |
| `tests/battle/CombatStats.test.ts` (new) | An unarmed Lv1 Monk (STR 15) has attack 9 and 2 hits, and absorb 1 without armour. With a wooden nunchaku, attack 19 and 1 hit. Evade = 48 + AGI − weight | new module |
| `tests/battle/BattleOutcome.test.ts` | Victory over Goblin ×4 (24 XP) with 4 living members says "6 XP each", and `xpPerMember === 6`; with 3 alive, 8 (BA-10) | the line shows the total |

### T4b

| File | Test | Why it fails today |
|---|---|---|
| `tests/entities/Character.test.ts` | 39 XP is Lv1; 40 is Lv2; 196 is Lv3; 547 is Lv4 (EB-3) | Lv2 needs 151 |
| `tests/entities/Character.test.ts` | Level-up adds the HP gain without a full heal: 10/25 HP at Lv1 becomes 16/31 at Lv2 for a White Mage | heals to full |
| `tests/entities/SpellChargeRules.test.ts` | Black Mage Lv1 → [2], Lv3 → [3,1]; Red Mage Lv3 → [3,0]; Warrior Lv1 → all 0; a saved charge of 5 at Lv1 loads as 2 (NG-4) | one table for every class |
| `tests/scenes/PartyCreationScene.test.ts`, `tests/entities/PartyManager.test.ts` | New game gold is 400 (NG-5) | 100 |
| `tests/scenes/MagicShopScene.test.ts` (new case) | LIT costs 100, ICE 400, FIR2 1500; a spell with an explicit `price` uses it | 100 × level |

### T4c

| File | Test | Why it fails today |
|---|---|---|
| `tests/systems/EncounterTable.test.ts` | `{groups: [{id: goblin, min: 3, max: 5}]}` gives 3–5 goblins and all three counts appear in 300 rolls. A legacy `enemies` entry is unchanged. 6+6 is capped at 9 | no groups |
| `tests/systems/EncounterSystem.test.ts` | With a zone at rect [0,0,4,4] and table Z, a step at (2,2) that fires gives Z; at (9,9) it gives the map table. A zone `encounterRate` resets the counter within its range | no zones |
| `tests/core/schemaValidation.test.ts` | Bad group (min > max, or both `enemies` and `groups`) and out-of-bounds zone rect are rejected | no checks |
| `tests/scenes/battle/EnemyLayoutAi.test.ts` | `formationFits` is true for 9 small and false for 5 large + 6 small | no helper |

### T4d (data)

| File | Test | Why it fails today |
|---|---|---|
| `tests/data/crossFileValidation.test.ts` | Groups' ids exist in `enemies.yaml`; every formation's maximum roll is ≤ 9 and passes `formationFits`. Map zone tables are checked the same way | – |
| `tests/data/actOneBalance.test.ts` (new) | `cornelia_armor` holds a body armour usable by `white_mage` and by `black_mage` (EB-7). `cornelia_weapon` holds a weapon usable by `monk`, and `cornelia_armor` a monk-wearable body armour (EB-8). No act-1 table (overworld, all its zones, the temple) contains `pirate` (EB-1). Every `cornelia_*` item costs ≤ 400 and the FF1 kit for any 4 base classes costs ≤ 400 (NG-5). `garland` has `hits` ≥ 2 and no weakness | no cloth; leather excludes the Monk; pirates on the overworld; no nunchaku |
| `tests/data/assetCoverage.test.ts` | Already covers `gr_imp` and `gr_wolf` once the enemies exist | – |
| `tests/balance/garland.test.ts` (new; seeded `mulberry32`, real `BattleStateMachine`, 400 battles per case, about 2 s) | **Policies** (in `tests/helpers/battlePolicies.ts`):<ul><li>*careless*: Fight only, random target;</li><li>*sensible*: CURE the lowest member below 50 %, LIT/FIRE the biggest enemy, potion below 35 %.</li></ul>**Assertions** (party Warrior / Thief / White Mage / Black Mage):<ul><li>careless at L2 with the 400 G kit wins ≤ 35 %;</li><li>careless at L3 with the 400 G kit wins ≤ 65 %;</li><li>sensible at L2 with the full kit wins ≥ 90 %;</li><li>sensible at L3 with the full kit wins ≥ 97 %;</li><li>in sensible wins, Garland survives ≥ 3 rounds in ≥ 90 % of battles (EB-4: no two-LIT kill);</li><li>with SLEP every turn, Garland acts at least once in every battle (EB-5).</li></ul> | Today: LIT does 105–135 and kills in 2 casts; SLEP locks him for good; the L1 careless start is 0.1 % but the L2 full kit is 96 % with the fight lasting 2 rounds |
| `tests/balance/fieldPacing.test.ts` (new; seeded) | **Campaign:** the 400 G kit; 20 fields battles, then 10 approach, then 10 temple; rest at the inn below 45 % party HP. The whole party reaches Lv2 within 4–10 battles and Lv3 within 15–35. Fewer than 0.2 wipes per run. Gold left after 40 battles is between 200 and 1200 (EB-3) | Lv2 needs about 47 battles today |

### T4e (after T3)

| File | Test | Why it fails today |
|---|---|---|
| `tests/data/overworldLayout.test.ts` (new cases) | The arrival `cornelia` cell is in no zone (fields); the temple door's approach cell is in `temple_approach`; `TOMB_END` is in `east_pocket`; the north bridge foot is in no zone; zones don't overlap; every zone rect cell is in bounds | no zones |
| `tests/systems/actOneEncounters.test.ts` (new; compiled overworld + `EncounterSystem`, seeded, 5,000 fires per point) | Rolls at the city arrival never give Gr.Wolf; rolls at the tomb give Wolf ×3+ in ≥ 40 %; rolls at the temple door give Gr.Imp ≥ 30 %; the mean formation size near town is 2.5–4 (EB-1). The real `temple-of-fiends` table rolls skeletons in ≥ 70 % | one table, at most 2 enemies |

**Existing tests that change on purpose** (update the expected values, not the intent):
- `DamageFormula`, `MagicDamage`, `SpellEffects`, `CharacterBuffs`;
- `Character` (`stats.attack`), `EquipScene`, `BattleCommands`, `EnemyAI`, `BasicAI`, `BossAI`;
- `FieldMagic`, `SpellChargeRules`, `PartyCreationScene`, `PartyManager`;
- `tests/integration/battle.test.ts`, which uses deterministic RNG; its fights may take more rounds.

---

### 4. Simulation targets (and what the scratch simulation found)

**Scratch simulation:** `/tmp/t4sim/`.
- `model.ts` patches the real `BattleStateMachine` and `SpellExecutor` prototypes with the §0 formulas. The turn order, queue, status tick, finish and boss plumbing are the real code; the patches double as a prototype of T4a.
- `garland.test.ts` and `tune.test.ts` are the Garland scans; `field.test.ts` is the campaign and zones; `run.test.ts` is a temple run followed by Garland.
- To run them: `npx vitest run --root /tmp/t4sim <file>` from the repo.

**Policies:**
- *careless*: Fight only, random target, no healing or items;
- *sensible*: CURE below 50 %, LIT/FIRE the biggest enemy, potion below 35 % when no CURE is left, focus the weakest enemy;
- *sleep*: like sensible, plus SLEP when Garland or a pack of 3+ enemies is awake.

**Kits:**
- *start*: the 400 G kit (§1.5);
- *full*: + chain mail, caps, LIT, SLEP, RUSE and 3 potions (about 600 G more).

### 4.1 Garland at FF1's own stats is a pushover

FF1 stats: HP 106, attack 15, 1 hit. Party: Warrior / Thief / White Mage / Black Mage. 2,000 seeds per cell.

| Level | Careless, start kit | Sensible, start kit | Sensible, full kit |
|---|---|---|---|
| L1 | 97 % | 99.9 % | 100 % (2.4 rounds) |
| L2 | 100 % | 100 % | 100 % |

Even careless play wins, so the target needs a Garland that is tougher than FF1's. This is the single planned deviation from FF1. The game's own Garland already had 200 HP.

### 4.2 Chosen: Garland HP 240, attack 16, hits 2

Accuracy 15, defense 10, evade 12, MDef 15, no weakness. 1,500–2,000 seeds per cell; win %.

| Party | Level | Careless, start kit | Sensible, start kit | Sensible, full kit | Sleep, full kit |
|---|---|---|---|---|---|
| Warrior / Thief / White Mage / Black Mage | L1 | 1 | 10 | 70 | 71 |
| | **L2** | **16** | 66 | **98** | 99 |
| | **L3** | **47** | 91 | **100** | 100 |
| | L4 | 89 | 99 | 100 | 100 |
| Warrior / Monk / White Mage / Black Mage | L2 | 39 | 80 | 99 | 100 |
| | L3 | 76 | 98 | 100 | 100 |
| Warrior / Monk / Red Mage / White Mage | L2 | 65 | 80 | 100 | 100 |
| | L3 | 95 | 98 | 100 | 100 |
| Warrior / Thief / Red Mage / Black Mage | L2 | 29 | 74 | 99 | 99 |
| | L3 | 69 | 96 | 100 | 100 |

Battles last 5–8 rounds, against 2 rounds today.

Careless play with the *full* kit wins 76 % at L2 for Warrior / Thief / White Mage / Black Mage. So buying gear helps, and healing and spells decide the fight.

**Rejected variants** (for the record):

| Variant | Why not |
|---|---|
| 200 / 18, 1 hit | careless L2 wins 87 % |
| 260 / 16, 2 hits | sensible L1 full kit wins 63 %; too harsh for early arrivals |
| 240 / 18, 1 hit becoming 2 hits below 50 % | close to the chosen one, but needs ST-6's phase code |

### 4.3 Temple run, then Garland

The temple run is 2–3 temple battles, no inn, potions shared. Party: Warrior / Thief / White Mage / Black Mage.

| Run | Careless, start kit | Sensible, start kit | Sensible, full kit |
|---|---|---|---|
| L2, 2 battles first | 6 % | 35 % | **94 %** |
| L3, 3 battles first | 22 % | 63 % | **99 %** |
| L4, 3 battles first | 70 % | 94 % | 100 % |

### 4.4 Field pacing

400 seeds. Campaign: 20 fields battles, then 10 approach, then 10 temple. The party starts with the 400 G kit, rests at the inn when party HP falls below 45 % or the White Mage has no CURE left and someone is below 50 %, and shops at each inn visit.

- **Levels.** The whole party is Lv2 by battle 5 (median) and Lv3 by battle 22. After 40 battles everyone is Lv3 (Lv4 needs 547 XP, about battle 55).
- **Wipes:** 0.00 per run.
- **Inn visits:** 1.7 per run.
- **Shopping:** 7.9 of the 8 shopping-list items bought, with 611 G left.

| Zone | XP per member per battle | Gold per battle |
|---|---|---|
| Fields | 8.7 | 22 |
| Approach | 14.0 | 35 |
| Temple | 10.1 | 25 |

At 40–60 battles an hour, that matches FF1's "L2–4 after an hour", and the Garland target level (L2–3) arrives when the full kit is affordable.

**Attrition per battle** (fresh party, the 400 G kit, Fight only):

| Zone | L1: HP lost | L1: someone down | L2: HP lost |
|---|---|---|---|
| Fields | 5.7 % | 0.2 % | 3.6 % |
| Approach | 12 % | 1.8 % | 7.8 % |
| East pocket | 25 % | 14 % | 17 % |
| Temple | 23 % | 13.5 % | 12.6 % |

The fields are gentle, as Coneria's are, and the east pocket and the temple are the ones that send a Lv1 party back to the inn.

### 4.5 Targets that T4 must meet

These are checked by `tests/balance/*` and by re-running the scratch simulation on the final data. Party: Warrior / Thief / White Mage / Black Mage.

| Target | Value |
|---|---|
| Garland, careless, 400 G kit | L2 ≤ 35 %; L3 ≤ 65 % |
| Garland, sensible, full kit | L2 ≥ 90 %; L3 ≥ 97 % |
| Garland, sensible, after 2–3 temple battles | L2 ≥ 85 %; L3 ≥ 95 % |
| Garland's fight length, sensible | ≥ 3 rounds in ≥ 90 % of battles |
| SLEP every turn | Garland acts at least once in every battle |
| Lv2 | battles 4–10 |
| Lv3 | battles 15–35 |
| Wipes over 40 battles | < 0.2 per run |
| Fields win rate at Lv1 (fresh, 400 G kit) | ≥ 98 % |
| Temple win rate at Lv1 | 90–99 % (it can hurt) |
| FIRE damage at Lv1 | ≤ 60 against a weak target |
| CURE healing | 16–32 |
| L1 spells | 100 G each |
| Starting kit | ≤ 400 G for every 4-class party |

---

### 5. Browser checks

`npm run dev`, then `http://127.0.0.1:5173/?mute=1&...`.

**New Game:**
- the HUD shows 400 G;
- buy the §1.5 kit: cloth is listed for both mages, nunchaku for the Monk, and the comparison shows `n/a` where it should;
- LIT costs 100.

**First fields battles** (walk out of the south gate):
- groups of 3–5 Goblins appear;
- damage numbers vary between hits;
- some attacks miss;
- multi-hit messages appear later, at higher hit%;
- after about 5 battles, a level-up message shows.

**Victory line:** "N XP each".

**Battle checks** (debug scenarios):
- `scenario=t4_fields_l1`:
  - FIRE does 10–40 to a Goblin and kills it;
  - CURE heals 16–32;
  - SLEP puts most Goblins to sleep, and some wake later;
  - Run with the Thief succeeds about 9 times in 10.
- `scenario=t4_nine` and `scenario=t4_temple_six`: 9 and 6 enemies are laid out with no overlap, every target box is selectable, and there's no stale box after a death.
- `scenario=t4_garland_l2_start`: Fight-only play loses (play it 3 times; at least 2 losses).
- `scenario=t4_garland_l3_full`: sensible play (CURE, LIT, RUSE on the White Mage) wins 3 out of 3. Garland lasts 4 or more rounds and targets the front slot most of the time.

**Party order:** put the White Mage first with the field Order menu; Garland now hits the White Mage most of the time.

**Zones (T4e):**
- On the overworld, Gr.Imps and Wolf packs appear near the temple, and only Goblins and Wolves appear next to town.
- Past the east bridge, Wolf packs and the occasional Gr.Wolf appear.
- No Pirates anywhere in act 1.
- Temple encounters are mostly Skeletons.

**Old save:** load a save from before T4. Charges are clamped, and the level stays the same (XP is kept; the level is recomputed on the next gain). Note this in the result.

**Console:** 0 errors.

---

### 6. Sub-tranches and order

| # | Scope | Owns (files) | Depends on |
|---|---|---|---|
| T4a | Battle maths: §0 formulas, EB-4/5/6/9/10, BA-10 (targeting and the XP line) | `src/battle/*` (new `CombatStats.ts`), `src/battle/DamageFormula.ts`, `SpellExecutor.ts`, `StatusEffects.ts`, `EnemyAI.ts`, `BattleCommands.ts`, `BattleStateMachine.ts`; `EnemyData`/`ItemData`/`SpellData`/class combat fields in `src/types/index.ts`; `schemaValidation` for them; `PartyManager.distributeXp` (`xpShare`); `FieldSpellEffects` (`healAmount` call) | none. Tests use synthetic data, and missing fields default (hit% 0, evade 0, `accuracy` 24, weight 0) |
| T4b | Progression and economy: XP table, level-up HP, per-class charges (NG-4), 400 G (NG-5), spell prices | new `src/entities/ExperienceTable.ts`, `Character.ts`, `SpellCharges.ts`, `PartyCreationScene.ts`, `MagicShopScene.ts`; the `spellCharges` type | none (`stats.attack` switches to `partyAttack` in T4d if T4a merges later) |
| T4c | Encounter engine: groups, zones, the 9 cap, layout fit | `EncounterTable.ts`, `EncounterSystem.ts`, `EncounterEntry`/`EncounterZone`/`MapData.encounterZones` types, `schemaValidation` (maps), the one line in `ExplorationScene.loadMap`, `formationFits` in `EnemyLayoutAi.ts` | none |
| T4d | Data and tuning: §1.1–§1.5 and §1.7, the monster variants and the atlas rebuild, `actOneBalance` and `tests/balance/*`, debug scenarios, re-run the scratch simulation on the real data | `assets/data/{enemies,items,spells,classes,shops,debug-scenarios}.yaml`, `assets-src/gen/monsters.yaml`, `assets/sprites/monsters-ai.*`, `tests/balance/`, `tests/helpers/battlePolicies.ts`, `tests/data/actOneBalance.test.ts` | T4a, T4b and T4c merged |
| T4e | Map zones and act-1 tables | `build_map.py` (`PASSTHROUGH` + zone validator), `layouts/overworld.py`, `assets-src/maps/temple-of-fiends.yaml`, legacy `assets/maps/{overworld,temple-of-fiends}.yaml`, compiled maps, overworld zone tests | **T3 merged to mainline** (T3a's `build_map.py` and T3c's `overworld.py`), plus T4c (runtime) and T4d (enemy ids `gr_imp`/`gr_wolf`) |

**Order:**
1. T4a, T4b and T4c run in parallel worktrees now. None touches a T3 file.
2. Merge T4a, then T4b, then T4c into `t4-integration`. The overlap is `src/types/index.ts` and `schemaValidation.ts`, both additive.
3. T4d on `t4-integration`.
4. After T3 merges to mainline, rebase `t4-integration` and do T4e, then rebuild every map once.
5. Final integration: re-run the scratch simulation and `tests/balance/*` against the real data, plus the browser checks.

**The hook T4e needs from T3:** the `encounterZones` key in `build_map.py PASSTHROUGH`, plus a zone validator in `validate()`. The overworld source is generated, so the zones come from `layouts/overworld.py`, computed from its fixed points (`TEMPLE_DOOR`, `ARRIVE`, `TOMB_END`, `RX`/`RY`) through its `bfs`/`walk_grid` helpers. Nothing in `assets/maps/ai/**` is edited by hand.

**Review steps** (as for T1–T3): momus reviews the plan, the implementation is done, momus reviews it, then validation:
- `npm run build`;
- `npm test`;
- `npx vitest run tests/data tests/balance`;
- `python3 -I assets-src/tools/build_map.py --selftest` and `--check-determinism`, for T4e;
- the browser checks.

---

### 7. Decisions for the user

1. **Garland deviates from FF1:** HP 240, attack 16, 2 hits. FF1's Garland (106 / 15 / 1 hit) loses even to careless play: 97–100 % for careless at L1–L2. The alternative is to keep FF1's Garland and accept an easy boss. Recommendation: deviate.
2. **INT does nothing in spell maths, as in FF1.** The alternative is a small bonus, `E + ⌊INT/10⌋`. Recommendation: FF1.
3. **Damage doesn't wake a sleeping target, as in FF1.** Sleep is limited instead by the HP-based wake roll, so SLEP takes about one turn from Garland per cast, and packs of small enemies stay asleep longer.
4. **Level-up no longer heals fully, as in FF1.** This makes the temple run matter. The alternative is to keep the full heal (it's kind); the simulation targets hold either way, because the Garland runs start fresh.
5. **New enemies Gr.Imp and Gr.Wolf** are palette swaps: free art, no Gemini images. FF1's MADPONY, CRAWL and CREEP are left out, since they would need new art (paid, or Bedrock).
6. **Later-act enemies (ogre … lich)** can be put on the FF1 scale now, as an optional part of T4d. The alternative is to leave them for the act that uses them.

### Decisions (taken by the orchestrator, following the user's "start with the original numbers")

- **Garland keeps FF1's stats** (106 HP, attack 15, one hit). The tougher variant (240 HP, attack 16, two hits) is recorded as a ready alternative for the user. The balance test for him targets the FF1 behaviour, and his boss phase (ST-6, T5) must not add damage.
- **Accept the FF1-faithful rules:**
  - INT has no effect on spell power;
  - damage doesn't wake a sleeping target (sleepers wake by the HP rule);
  - a level-up no longer fully heals.
- **Mad Pony, Crawl and Creep** are left out, since they need new art.
- **Later-act enemies** stay as they are for now; they are moved onto the FF1 scale when those acts are built.

### Revisions after the momus review (binding)

1. **Garland stays at FF1's stats (106 HP, attack 15, one hit),** following the user's instruction. Every Garland target is rewritten to FF1 behaviour:
   - a sensible L2 party wins ≥ 95 %;
   - careless L1 Fight-only play with no gear wins ≤ 60 %;
   - there is no round-count target.

   §1.1, §3, §4.5, §5, §7.1, `garland.test.ts` and the browser check are updated to match. The tougher variant goes in the user report as an option.
2. **`t4-integration` branches from `t3-integration`,** not `mainline`, because T4c and T4d edit files that T3 changed.
3. **Tests that need T4e's data move to T4e:** the "no pirate in an act-1 table" check, and `fieldPacing` reading the real tables. Before that, `fieldPacing` uses inline copies of the §1.6 tables. `crossFileValidation.test.ts` goes in T4d's Owns column, so it handles group entries.
4. **A shared class fixture** with `spellCharges` goes in `tests/helpers/testUtils.ts`. Every inline `CharacterClassData` test that breaks is moved to it, including `src/systems/__tests__/ItemEffects.test.ts`.
5. **T4b owns the `Character.ts` switch to `partyAttack`** and depends on T4a. `CombatStats` imports `Character` as a type only.
6. **Multi-hit message format:** "hits Goblin for 18! (2 hits)". `battleMessageUtils` gets new handling for the "unaffected" and "wakes up" lines, with tests (T4a).
7. **`bonusVsFamily`** is kept as an element/family multiplier, applied after the FF1 damage roll.
8. **Name fixes:**
   - export a pure `spellPrice()`;
   - `MagicShopScene.test.ts` is a new file;
   - `BattleResult` lives in `BattleStateMachine.ts`;
   - the buffs test is `tests/entities/CharacterBuffs.test.ts`;
   - `BattleOutcome.test.ts` is updated.
9. **Items and data shape.**
   - `wooden_armor` stays as a Warrior armour; `leather_armor` stands in for FF1's Wooden Armor.
   - Cap costs 80 G, as in FF1; re-check the full-kit pacing.
   - New fields go under `stats` for enemies and at the top level for items.
10. **Kit cost test:** the starting kit is defined per class, and the test checks parties of four different base classes.
11. **The sim follows the plan.** `battlePolicies.ts` is an exact port of `chooseCommands`. There is one Red Mage charge table (§1.4's); the sim uses `partyMagicDefense`; the sensible policy casts RUSE where §5 expects it.
12. **Every §4.5 "must meet" target gets a `tests/balance/*` assertion,** or is moved out of "must meet".
13. **Spell hit rolls:** every `debuff_*`, `debuff_morale` and `status_*` spell rolls `statusHits`.
14. **Weighted enemy retargeting** uses the original slots: the new `retargetEnemyTarget(slots, alive, rng)`. Party retargeting stays uniform.
15. **Encounter rates:** `EncounterSystem` keeps the map's base rate separate from the zone rate.
16. **Save compatibility:** a pre-T4 save fixture test checks that a Warrior's charges become 0, a mage's charges are clamped, level and XP are kept, and the save version stays 1. `fromJSON` recomputes the level upward from XP.
17. **`temple_approach`:** cells that can't be reached count as infinitely far.

**Order:** T4a and T4c run in parallel. T4b runs after T4a merges (revision 5). Then T4d, then T4e.

### T4d result

- **Data:** §1.1 enemies (FF1 Garland 106 / 15 / 1 hit, no weakness, 130 XP; new `gr_imp`, `gr_wolf`; combat fields under `stats`), §1.2 items (`hit`/`crit`/`weight`, explicit `slot: armor` on body armour, Monk wears leather, Cap 80 G, Short Sword 15 / 550 G, Tent 75, Cabin 250), §1.3 spells (FF1 powers and accuracies; CURE 16), §1.4 `hitPercent`/`magicDefense` on every class, §1.5 Cornelia lists, six `t4_*` debug scenarios (§1.7's five plus `t4_garland_l1_naked` for revision 1's careless check).
- **Art:** palette swaps in `gen/monsters.yaml`; `monster.recolor` gained a `val` (brightness) factor. The plan's `hue: 25` barely changes a green imp, so Gr.Imp uses `hue: -95, sat: 1.1` (red); Gr.Wolf uses `hue: -20, sat: 0.6, val: 0.65` (grey wolves have no hue to shift, so "darker" needs `val`).
- **Tests:** `tests/helpers/battlePolicies.ts` (the sim's `chooseCommands`, plus RUSE on self against a big enemy), `tests/helpers/balanceData.ts` (kits, §1.6 tables inline), `tests/balance/{garland,fieldPacing,zones}.test.ts`, `tests/data/actOneBalance.test.ts`; `crossFileValidation` reads group entries and zones and checks every formation's maximum roll with `formationFits` (and the debug scenarios').
- **Simulation on the real data** (real engine, 2,000 seeds): Garland careless L1 no gear 0.1 %, careless L1 400 G kit 97 %, sensible L1 99.9 %, sensible L2 100 % (both kits), temple run then Garland 100 % at L2 and L3. Fields: Lv1 fight-only wins 100 % (5.7 % HP lost), temple 97.2 %. Campaign (200 runs): Lv2 at battle 5 (median), Lv3 at 22, 0 wipes, 2.0 inn visits, 7.5 of 8 purchases, 353 G left (Cap at 80 G costs 280 G more than the sim assumed). Every target met without tuning; the numbers match §4.1/§4.4 to the decimal.
- **Deviations:** the Red Mage's starting kit has no spell (rapier + cloth), otherwise three mages + Warrior cost 430 G. "SLEP every turn, Garland acts in every battle" cannot hold for a 106-HP Garland: turn order is by agility, so a SLEP that lands before each of his turns (79 %) can hold him through a short fight. The test asserts the FF1 property instead: each landed SLEP costs at most one turn (he always wakes), and over 15 open rounds he acts in ≥ 95 % of battles.

### T4e result

- **Compiler:** `encounterZones` is in `PASSTHROUGH`; `map_checks.encounter_errors` (always on, for `encounters` and every zone) checks the enemies / groups form (`0 <= min <= max`), at most 9 enemies per formation, ids known to `enemies.yaml`, unique zone ids, inclusive rects inside the map, at least one walkable cell per zone, and an optional zone rate. Selftest case 4b. Every map recompiles clean; no chunk PNG changed.
- **Overworld** (`layouts/overworld.py`): the §1.6 fields table as the map default, then `east_pocket` (82 cells, what `TOMB_END` reaches with the east bridge shut; 16 row rects) and `temple_approach` (275 cells, 37 row rects). No pirates.
- **Temple** (source and legacy) and the **legacy overworld:** the §1.6 tables in group form, no zones.
- **Deviation:** `temple_approach` measures "the city" as the nearest of its four gate arrivals, not only `ARRIVE["cornelia"]`. From the south gate the north bridge foot is 21 steps round the walls but 20 from the temple door, so the plan's rule would put the north road in the approach, against §1.6 and the §3 test. Unreachable cells count as infinitely far (revision 17). The temple door's own warp cell is left out (warps are never battle cells).
- **Tests:** `overworldLayout` (zone order, arrival / bridge foot in the fields, door / tomb zoned, in bounds, walkable, disjoint, and both zones recomputed from the compiled collision), `actOneBalance` (no pirate in any act-1 table, compiled or legacy; legacy tables equal the compiled ones), new `tests/systems/actOneEncounters.test.ts` (the §3 rolls on the real `EncounterSystem`), and `balanceData.ZONE_TABLES` now reads the compiled maps (`fieldPacing`, `zones`, `garland` unchanged and passing).

---

## Final phase (after T6): second adversarial pass (requested by the user, 2026-11-14)

1. **Start from New Game** and run a full adversarial playtest of the introduction: Cornelia, the overworld, the Temple of Fiends, Garland, the princess rescue, and returning her to the King. Probe edge cases and anything awkward or unusual to a modern RPG player.
2. **Document** every finding in a new issue file, `docs/PLAYTEST_PENINSULA_2_<date>.md`.
3. **Plan** a fix for each issue; momus validates the plan.
4. **Implement** the fixes, validating each through tests and real gameplay in the browser, and commit tranche by tranche.

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

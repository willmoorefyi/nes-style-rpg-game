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

**Scratch simulation:** `/tmp/t4sim/` (later committed as `docs/sim/t4/`, then removed in the T4 review fixes; the simulation lives in `tests/balance/` now).
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

### T4a result

- **New pure modules** in `src/battle/`: `CombatStats` (party attack / hit% / hits / evade / absorb / magic defence / crit, Monk unarmed, enemy evade / hits / crit / accuracy), `PhysicalAttack` (the state machine's party and enemy attacks), `SpellStatus` (status, debuff and morale rolls) and `StatusTick` (start-of-turn status tick and wake roll). `BattleStateMachine` and `SpellExecutor` delegate to them and got smaller.
- **Formulas (§0):** `physicalAttack` runs the per-hit loop (`(168 + hit% − evade)/200`, +40 against a helpless target, `rand(A, 2A) − absorb` min 1, a crit adds a roll that ignores absorb); `magicDamage` is `rand(E, 2E)` with E × 1.5 on a weakness, half damage on a resistance and double on a connect (`(148 + accuracy − MDef)/200`), no caster INT; `healAmount` is `rand(E, 2E)`, shared by battle and field CURE; `statusHits` for every `status_*`, `debuff_*` and `debuff_morale` spell, with "X is unaffected." on a miss.
- **Sleep and paralysis:** the actor loses the turn, then wakes if `rand(0..80) < currentHp` ("X wakes up!"); damage doesn't wake (`StatusTracker.isHelpless()` added, `onHit()` documented as unused).
- **Buffs:** RUSE / INVS / LOCK / FOG / TMPR take their amount from `spell.power`, and the formulas read them (evade, enemy evade, absorb, attack).
- **Run (EB-9):** `calculateRunChance(luck, level)` = `luck / (level + 16)` for the acting member (15/17 for a Lv1 Thief).
- **Targeting and XP (BA-10, EB-10):** `EnemyAI.selectTarget` weights the living by `FRONT_WEIGHTS` 4/2/1/1 in party order (BasicAI, BossAI and the state machine default); `retargetEnemyTarget` keeps the original slots (revision 14). `finish('victory')` sets `xpPerMember = xpShare(...)` and says "Victory! N XP each, G Gold."; `PartyManager.distributeXp` uses the same share.
- **Messages:** "hits Goblin for 18! (2 hits)" (revision 6); `battleMessageUtils` handles "unaffected" and "wakes up".
- **Types / schema:** the optional enemy (`accuracy`, `evade`, `hits`, `crit`), item (`hit`, `crit`, `weight`), spell (`accuracy`, `price`) and class (`hitPercent`, `magicDefense`, `spellCharges`) fields, checked when present.

### T4b result

- **XP (EB-3):** new `src/entities/ExperienceTable.ts` with the §2.2 FF1 table (`xpToReach`, `levelForXp`, `MAX_LEVEL` 50); `Character.xpForNextLevel` uses it. A level-up adds the max-HP gain to current HP instead of a full heal.
- **Charges (NG-4):** `SpellCharges.maxChargesFor(classData, level, spellLevel)` reads the class's `spellCharges` step breakpoints (0 when the class has none); the shared `BREAKPOINTS` are gone. `classes.yaml` holds the §1.4 tables (Warrior, Thief, Monk and Master have none).
- **`stats.attack`** is `partyAttack(c)` (revision 5), so Status, Equip and the shop show the battle number.
- **Economy:** `PartyCreationScene` starts with 400 G (NG-5); a pure `spellPrice()` in `SpellPurchase.ts` (`spell.price`, or 100 / 400 / 1500 / 4000 / 8000 / 20000 / 45000 / 60000 by level) replaces `SPELL_PRICE_BASE`.
- **Save compatibility (revision 16):** `fromJSON` clamps saved charges to the class table and recomputes the level upward from XP; the save version stays 1 (`tests/systems/SaveCompatT4.test.ts`).
- **Tests:** the shared mage class fixture (`testMageClass`, `TEST_MAGE_CHARGES`) in `tests/helpers/testUtils.ts` (revision 4), including `ItemEffects.test.ts`.

### T4c result

- **Groups:** `EncounterEntry` is `{weight} & ({enemies} | {groups: [{id, min, max?}]})`. `EncounterTable.selectEnemies()` rolls each count in `[min, max]`, uses the first group's id once when every count is 0, and caps the total at `MAX_FORMATION = 9`, cutting from the end.
- **Zones:** `EncounterZone = {id, rects, encounters, encounterRate?}` and `MapData.encounterZones`. `EncounterSystem.setZones` builds one table per zone on the shared RNG. A step uses the first zone whose (inclusive) rects contain it, else the map table, and the counter resets with that zone's rate, else the map's base rate, which is kept separate (revision 15). `ExplorationScene.loadMap` calls `setZones` next to `setEncounters`.
- **Schema:** `src/core/encounterValidation.ts` (called from `validateMapData`): exactly one of `enemies` / `groups`, `0 <= min <= max <= 9`, zone rects of 4 integers inside the map.
- **Layout:** `formationFits(sizes)` in `EnemyLayoutAi.ts` (scale 1 or 0.5, no overlap), used by `crossFileValidation`.

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

### T4 review fixes result

- **Shop comparison (Monk / Master):** the panel compares `partyAttack` with the item equipped against `partyAttack` without it (armour: `partyAbsorb`), through `CombatStats.withEquipped`, a what-if view that leaves the character unchanged (`src/scenes/shopComparison.ts`). The hit count is shown when it changes or is above 1. An unarmed Lv1 Monk sees the Wooden Nunchaku as 9 (2 hits) → 19 (1 hit), +10. A Lv7 Monk's bare hands (33, 2 hits) beat it (31), −2. A Lv6 Monk with no body armour loses 2 absorb with Leather Armor.
- **Martial classes are data:** `unarmedMartial: true` on `monk` and `master` in `classes.yaml`, in `CharacterClassData` and in the schema (a boolean). `CombatStats` no longer lists class ids.
- **`spellCharges` schema:** each row's level is an integer ≥ 1 above the previous row's, a row has at most 8 counts, and each count is an integer from 0 to 9.
- **FF1 element hit rule (implemented):** the spell connect roll's base is 148, 188 against a weakness and 0 against a resistance (`Elements.magicElementMultiplier` returns the `relation`, and `DamageFormula.statusHits` takes it). With accuracy 24 against MDef 16, a resisted spell connects 8/200 of the time instead of 156/200. Status spells have no element, so they are unchanged. The Garland numbers are unchanged (he has no weakness); the field campaign stays inside every bound (351 G left; T4d recorded 353 G).
- **Balance bounds** near the measured values (400 seeds, FF1 Garland): careless Lv1 naked 0.25 % (bound ≤ 5 %), careless Lv1 with the 400 G kit 98.25 % (90–99.5 %), sensible Lv1 with the 400 G kit 100 % (≥ 98 %). Halving Garland's HP fails three cases (naked 18 %, 400 G kit 100 %). SLEP stress: Garland acts in 0.214 of the rounds (bound 0.21 ± 0.04) and is locked out in 2.75 % of the battles (bound ≤ 5 %). Field pacing: 0 wipes in 200 runs (bound ≤ 0.01 per run; §4.5 asks for < 0.2), Lv2 at battle 5 and Lv3 at 22 (median), 351 G left, 7.5 of 8 purchases. The starting-kit cost is `kitCost(START_KIT[c], spellPrice)` over the party (370 G).
- **Encounter wiring:** `actOneEncounters` sets up `EncounterSystem` in `loadMap`'s order, step filter first (`encounterStepFilter(map)`). New cases check that warps, the broken north bridge, the temple entry and Garland's tile never count a step, that the temple-door arrival cell rolls `temple_approach`, and that filtered steps between zone steps don't change the zone's battles.
- **Scratch simulation:** `docs/sim/t4/` is removed from version control (it used `as any` and private access, and did not run as committed). The simulation lives in `tests/balance/` now (`garland`, `fieldPacing`, `zones`, on `tests/helpers/battlePolicies.ts` and `balanceData.ts`). Nothing else under `docs/` holds tests, so `docs/**` left the vitest exclude.
- **Docs:** `DESIGN_DOCUMENT.md` §5 (the per-class charge tables) and §7 (the FF1 XP table, level-up HP) now match the code.

---

### T4 final validation (orchestrator)

- **Momus:** REVISE with 12 items, all fixed (`b1ded5f`). Momus judged the deviations acceptable.
- **Browser, `?mute=1`** (§5):
  - New Game gives 400 G, a fresh party (W, T, WM, BM at 35/25/25/25 HP), and spells at 100 G in the black magic shop;
  - `t4_nine` lays out 9 enemies (6 goblins and 3 wolves), and its rounds read with the new formulas;
  - `t4_temple_six` lays out 6 enemies; dead enemies grey out in the list and leave the field with no stale box;
  - the console shows 0 errors.
- **Tests:** 1852 pass. The balance bounds catch a Garland at half HP.

## T5: Minor defects

**Base:** `t4-integration` at `a675eef`. All file:line references are to that commit.

**Inputs:**
- `docs/PLAYTEST_PENINSULA_2026-11-13.md` (severity `m`, triage default "plain bugs: fix as proposed");
- `docs/FIX_PLAN_PENINSULA.md` (T1–T4 results).

**Scope:**
- every `m` item still open;
- plus the carried items: Cornelia's unreachable cells, ST-6 (no added damage, per the T4 decision) and NG-9.

**Excluded:**
- OW-10 (deferred);
- T6: OW-8, OW-9, MS-7, BA-8, and the polish items.

**Rules (as for T1–T4):**
- Edit generators and sources, never `assets/maps/ai/**`.
- Sub-branches commit sources and code. The integration branch rebuilds every map once, after the last merge.
- Every fix gets a test that fails on the old code.

---

### 1. Status of the 36 `m` items

### Fixed already (14)

| ID | Evidence on `t4-integration` |
|---|---|
| NG-6 | `PartyCreationScene.ts:75-76`: "slot N/4", where N is `currentSlot + 1` (T1) |
| NG-7 | The opening sequence ends "The King awaits in the castle…" (`PartyCreationScene.ts:260`). Covered by the NG-1 decision (T1) |
| ST-7 | `BattleTrigger.ts:97-101` emits one `showDialog` per member. `ExplorationScene.ts:79` `enqueue`s them, and the cutscene dialog uses `enqueue` too (`ExplorationCutscenes.ts:28`). Tested in `Act1Blockers.test.ts:126` (T1) |
| ST-8 | The `act1_complete` cutscene (`cutscenes.yaml:25-38`). Covered by ST-1 (T1) |
| ST-11 | `encounterStepFilter` (`FieldTiles.ts:14-26`, wired at `ExplorationScene.ts:234`): no step counts on warp, gate or scripted tiles. Covered by EB-2 (T2c) |
| ST-12 | `NPC.setOpened` (`NPC.ts:114`) and `MapLoader.ts:57`. `faceToward` returns early for chests (`NPC.ts:124`) (T3d) |
| CT-5 | `ExplorationScene.ts:334`: `playerTiles` includes `player.targetTile` (T2c) |
| CT-7 | The overworld N warp leads to `castle_gate`, and the precinct's east-edge exits are generated by `edge_exits` (T3c/T3d) |
| CT-11 | `NpcWander.ts:7`: NPCs stand still when the player is within distance 1 (T2c) |
| OW-3 | One door per gate, and `warp_leaves` holds (T3 review fixes) |
| OW-6 | `river_check`; the channel is straight through the east bridge (T3c) |
| OW-7 | `collide: alpha` and `art_coverage` (T3a/T3c) |
| OW-11 | The Erdrick tomb with its `inspect` text (T3c/T3e) |
| EB-9 | `BattleCommands.ts:38-40`: `calculateRunChance(luck, level)` (T4a) |

### Open (17) and the carried item (1)

NG-9, ST-6, ST-9, ST-10, CT-4, CT-10, IN-3, IN-6, CA-1, TF-2, BA-3, BA-4, BA-5, BA-7, BA-13, MS-5 and MS-8, plus the carried **CU** (Cornelia's unreachable cells).

Two items are only part-open:
- **IN-3:** the interiors now have names; Cornelia, the overworld and the temple still don't.
- **BA-3:** the repeated "defeated" text is gone (`SpellExecutor.ts:150` filters dead enemies). The charge is still spent and there is still no retarget.

### Excluded (5)

OW-8, OW-9, MS-7 and BA-8 (T6), and OW-10 (deferred).

**Arithmetic:** 14 + 17 + 5 = 36.

---

### 2. Open items

### T5a: battle and items

#### ST-6: Garland's phase change never fires

**Root cause:**
- `BattleStateMachine.ts:497` returns early when `!enemy.aiBehavior`.
- Nothing gives Garland an AI: `BattleTrigger.ts:55-64` passes no `bossPatterns`, and `BattleScene.attachEnemyAi` (`BattleScene.ts:74-80`) attaches one only for debug `enemyAi`.
- So the `bossPhases` entry for Garland (`enemies.yaml:239-242`, `aggressive`, "Garland's attacks grow fiercer!") is dead.

**Fix:**
- `checkBossPhaseTransition` runs for every enemy that has `bossPhases`. The crossed-phase bookkeeping and the message no longer need an AI.
- The pattern swap happens only when the enemy has a `setPattern` AI and `bossPatterns` holds the id. When it has an AI but the id is unknown, `console.warn` once.
- Garland gets no AI and no pattern. Following the T4 decision, his phase is the message only. He keeps the default weighted targeting with no extra RNG draws, so the seeded balance results don't change.

**Tests** (`tests/battle/BossPhase.test.ts`, new):
- Garland at 53/106 HP: the next `executeRound` messages contain "Garland's attacks grow fiercer!" exactly once, and a later round doesn't repeat it. This fails today.
- Under the same seed, 10 rounds with and without `bossPhases` give identical damage events (no added damage).
- `tests/balance/garland.test.ts` passes unchanged.

**Browser:** `?scenario=t4_garland_l2_start&mute=1`. Fight until Garland is below half HP. The line shows once, and his hits stay single and in the same damage range.

#### BA-3: a single-target spell on an enemy that has already died wastes the charge

**Root cause:**
- `SpellExecutor.execute` spends the charge (`SpellExecutor.ts:80`) and announces the cast (`:85`) before resolving the target.
- `opposingTargets` (`:145-151`) then drops the dead target, so nothing happens.
- `retargetIfDead` (`BattleCommands.ts:19-32`) handles `fight` only.

**Fix:**
- In `execute`, before the charge check, a party caster's `single` spell aimed at an enemy (`enemy_*`) retargets uniformly to a living enemy, through `retargetIfDead`, which is extended to `magic`.
- If no enemy is alive, the spell isn't cast and no charge is spent.

**Test** (`tests/battle/SpellExecutor.test.ts`): Goblin A dies before the Black Mage acts. FIRE aimed at A damages B, and the charge drops by exactly 1. Today B is untouched and the charge is lost.

**Browser:** `?scenario=t4_fields_l1&mute=1`. Aim the Warrior and the Black Mage's FIRE at the same Goblin, with the Warrior faster. The FIRE hits another Goblin.

#### BA-4: Tent and Cabin are listed in battle Items, then fail

**Root cause:** `ItemSelectionUI.ts:36-39` lists every consumable. In battle, `executeItemCommand` sends Tent and Cabin to `applyItemEffect`, whose `default` case answers "Cannot use this item" (`ItemEffects.ts:87-88`).

**Fix:**
- `ItemSelectionConfig.isUsable?: (itemId) => boolean` filters the list.
- `BattleScene.showItemUI` passes `id => !ItemEffects.isPartyItem(id)`.
- An inventory with only camp items gives "No items available."

**Test** (`tests/ui/ItemSelectionUI.test.ts`, new):
- {tent, potion} with that filter lists Potion only;
- {tent} alone gives `hasNoItems()`.

**Browser:** in a battle, Item lists Potions but no Tent.

#### BA-5: Phoenix Down can't target fallen allies in battle

**Root cause:**
- `BattleScene.ts:404`: `enterFieldTargeting(true, false, …)` always passes `revive = false`.
- So `BattleFieldTargeting.getFieldTargets` (`:45-47`) lists only living members.

**Fix:**
- New `ItemEffects.isReviveItem(id)`, true for `phoenix_down`, next to `isPartyItem`.
- `showItemUI` passes it as `revive`.

**Test:** a BattleScene with one KO'd member, built as `tests/scenes/battle/enemyPoseFlow.test.ts` builds its scene:
- Item → Phoenix Down → confirm submits an item command whose `targetId` is the KO'd member's id;
- after execution, the member has 1 HP.

**Browser:** `?scenario=t4_garland_l2_start&mute=1`. Let one member fall, then use Phoenix Down from Item. The target list shows only the fallen member, and the member stands up.

#### BA-7: an empty target box stays where a dead enemy was

**Root cause** (confirmed against `/tmp/playtest/browser/55-victory.png`, which shows a faint white rectangle):
- `BattleScene.ts:194-195` calls `updateFieldTargeting()` and then `updateTargetVisuals()` in the same frame.
- On confirm, the first call runs `clearTargetArrow()` and the callback. The second call then re-creates `targetOutline` (`BattleFieldTargeting.ts:126-133`), because it doesn't check that targeting has ended.
- That outline is never removed, so it stays on the field after the target dies.

**Fix:** `BattleFieldTargeting` keeps an `active` flag:
- `enterFieldTargeting` sets it;
- confirm, cancel and the empty-target path clear it;
- `updateTargetVisuals` returns at once when it isn't active.

**Test** (`tests/scenes/battle/BattleFieldTargeting.test.ts`, new): with a mock input, enter targeting, confirm, then call `updateFieldTargeting()` and `updateTargetVisuals()`. `mainContainer` holds no outline `Graphics` (the same child count as before targeting). Today one is left.

**Browser:** `?scenario=t4_fields_l1&mute=1`. Fight a Goblin until it dies, then screenshot the round end and the victory. There is no rectangle where it stood.

#### MS-8: item code doesn't match the data and docs

**Root cause:**
- `ItemEffects.ts:63-68` hard-codes the heals: Potion 30 and Hi-Potion 150, against `items.yaml:390, 397`, which say `hp: 30` and `hp: 120`.
- `heal()` (`:95-100`) reports the full amount even when the heal is capped (the `currentHp` setter clamps at `Character.ts:58`).
- Antidote is always used up (`:72-75`).
- `docs/DESIGN_DOCUMENT.md:246-250` lists Ether at 500 and Tent at 250, but the data says 150 and 75.
- Tent works anywhere (`ItemMenuScene.ts:101-103`). That part is fixed in T5b.

**Fix:**
- The heal amount is `item.stats.hp`, with a `console.error` and no use when it is missing.
- The message reports the HP actually gained.
- Antidote fails with "X is not poisoned." and stays in the inventory.
- The design doc's item table is updated to the data.

**Tests** (`src/systems/__tests__/ItemEffects.test.ts`):
- Hi-Potion heals 120 (today 150).
- A Potion on 20/25 HP reports "recovered 5" (today 30).
- Antidote on an unpoisoned member: `success` is false and the count is unchanged (today it is consumed).

**Browser:** use a Potion on a member 5 HP short of full; the message says 5.

**T5a files:**
- `src/battle/BattleStateMachine.ts`, `src/battle/SpellExecutor.ts`, `src/battle/BattleCommands.ts`;
- `src/scenes/BattleScene.ts`, `src/scenes/battle/BattleFieldTargeting.ts`;
- `src/ui/ItemSelectionUI.ts`, `src/systems/ItemEffects.ts`;
- `docs/DESIGN_DOCUMENT.md`;
- tests: `tests/battle/{BossPhase,SpellExecutor}.test.ts`, `tests/ui/ItemSelectionUI.test.ts`, `tests/scenes/battle/BattleFieldTargeting.test.ts`, one new BattleScene item case, `src/systems/__tests__/ItemEffects.test.ts`.

### T5b: field engine and menus

#### NG-9: very short key taps are dropped

**Root cause:**
- `InputManager` tracks only `currentKeys`/`previousKeys` (`InputManager.ts:23-24, 46-58`).
- A keydown and keyup that both arrive between two ticks add and then delete the key (`:76-87`) before the scene's `update` (`Game.ts:92-93`) runs. So `isJustPressed` and `isPressed` never see it.

**Fix:**
- Add `pressedThisFrame`, filled in `onKeyDown` when `!e.repeat`, and `releasedThisFrame`.
- `isJustPressed` also checks `pressedThisFrame`, and `isPressed` does too, so a short tap still turns the player or takes one step.
- `update()` clears both sets, and `detach()` empties them.

**Test** (`tests/core/InputManager.test.ts`):
- dispatch keydown and keyup for Enter with no `update()` between them: `isJustPressed('confirm')` is true;
- after `update()` it is false;
- a repeat keydown doesn't re-trigger it.

Today the first assertion fails.

**Browser:** on the title, `page.keyboard.down('Enter'); page.keyboard.up('Enter')` in one `evaluate`, with no delay, opens New Game. Do it 5 times out of 5. On the field, a 1-frame tap of ArrowDown turns the player or steps once.

#### BA-13: the battle-start flash leaves frames on the field after a battle

**Root cause:**
- `BattleTrigger` calls `onBattleTriggered` (which runs `battleFlash.start()`, `ExplorationScene.ts:96-99`) and then awaits `loadSpells` before `push('battle')`.
- `onPause` freezes the scene in the middle of the flash.
- `onResume` (`:568-576`) never finishes it, so on return `update()` (`:279-281`) plays the remaining white frames and swallows input.

**Fix:** `onResume` calls `this.battleFlash.finish()`, as `enter()` already does at `:133`.

**Test** (`tests/scenes/ExplorationScene.test.ts`, or `Act1Blockers.test.ts`):
- start a battle through `game.pendingBattle` and `enter()`, then push the battle and pop it;
- after that, no full-screen white `Graphics` is in the scene's container;
- the first `update()` with Down held moves the player.

Today the flash is still active.

**Browser:** win a field battle and step at once. There is no white flash, and the first key press moves the player.

#### IN-6: the inn gives no feedback

**Root cause** (`InnScene.ts`):
- `push` hides the field (`SceneManager.ts:66`), so the Yes/No box sits on black.
- No gold is shown (`:29-46`).
- When the party can't pay, the inn pops silently (`:53-56`).
- Rest doesn't clear status effects (`:57-60`), and there is no fade.

**Fix:**
- `Scene.transparent?: boolean`. When the next scene has it, `SceneManager.push` leaves the previous container visible; pop is unchanged.
- `InnScene` sets `transparent = true` and shows "Gold: N G" under the question.
- With too little gold: "You don't have enough gold." It closes on confirm, or after 90 frames.
- Rest calls `statusTracker.clear()` for living members, then a black overlay fades in over 20 frames, holds "Your party rests…" and fades out.

**Tests:**
- `tests/core/SceneManager.test.ts`: pushing a `transparent` scene keeps the previous container visible.
- `tests/scenes/InnScene.test.ts`:
  - with poor gold, the notice shows, the scene doesn't pop at once, and the gold is unchanged;
  - a poisoned member is cured after resting;
  - the gold text is shown.

All three fail today.

**Browser:** Cornelia inn, `?mute=1`:
- the town stays visible behind the box, and the gold is shown;
- with 0 G you see the "not enough gold" line;
- resting fades and returns.

#### IN-3, the runtime half: the HUD falls back to the raw map id

**Root cause:** `ExplorationScene.ts:272`: `mapData.name ?? mapData.id`.

**Fix:** use `mapData.name ?? ''`, so a map with no name shows no label. The names themselves are added in T5c and T5d.

**Test:** `tests/ui/FieldHUD.test.ts`, or an ExplorationScene case: a map without `name` leaves the label empty.

#### MS-5: shop layout problems

**Root cause** (`ShopScene.ts`):
- The item list is the full width (`:43`), and the detail panel is drawn over it at x 1200 (`:47`). The detail panel's 4 lines per member (`:260-273`), about 568 px, overflow its 584 px window, so the last value is clipped.
- The quantity picker is only "- N +" (`QuantitySelector.ts:30-50`), with no label or total.
- `confirmTransaction` (`:171-186`) gives no result message.
- `buildItemMenu` (`:89-106`) rebuilds the `Menu` at index 0, so the sell cursor resets.

**Fix:**
- When the detail panel is shown, the item window narrows to end before x 1200.
- The comparison becomes one line per member: `NAME  cur->new  +d` (still `n/a` for members who can't equip it).
- `QuantitySelectorUI` takes `unitPrice` and shows `Qty - N +   Total: X G`.
- After a transaction the gold window shows "Bought N Item." or "Sold N Item." until the next input.
- `MenuConfig.initialIndex` (`Menu.ts`) keeps the cursor, clamped to the new list length.

**Tests:**
- `tests/scenes/ShopScene.test.ts`:
  - the item window and the detail window don't intersect;
  - every detail text's bottom is at or above the window's content bottom;
  - after a sale, the cursor is on the same index;
  - the "Sold" line shows.
- `tests/ui/QuantitySelector.test.ts`: incrementing updates the total.

**Browser:** in the weapon shop, the panel doesn't overlap the list, and all 4 members are visible. In the item shop, buy 2 Potions (the total shows, then "Bought 2 Potion."), then sell from the middle of the list (the cursor stays).

#### MS-8, the runtime half: Tent works anywhere

**Root cause:** `ItemMenuScene.ts:101-103` applies Tent and Cabin with no map check.

**Fix:**
- `MapData.camp?: boolean` (types, plus `schemaValidation`).
- `ExplorationScene.canCamp()` returns `currentMapData?.camp ?? false`, the same pattern as `canSave()` at `:599-601`.
- `ItemMenuScene` gets the exploration scene the way `FieldMenuScene.ts:42-45` does, and refuses with "You can't camp here.", keeping the item.
- T5c adds `camp: true` to the overworld (FF1: tents work on the world map only).

**Test** (`tests/scenes/ItemMenuScene.test.ts`): with a town map (no `camp`), Tent isn't consumed and HP is unchanged. On a map with `camp: true`, it heals. The first case fails today.

**Browser:** a Tent in Cornelia is refused; on the overworld it heals.

**T5b files:**
- `src/core/InputManager.ts`, `src/core/SceneManager.ts`;
- `src/scenes/ExplorationScene.ts` (`onResume`, `:272`, `canCamp`; about +6 lines on a file already over the size guideline);
- `src/scenes/InnScene.ts`, `src/scenes/ShopScene.ts`, `src/scenes/ItemMenuScene.ts`;
- `src/ui/QuantitySelector.ts`, `src/ui/Menu.ts`;
- `src/types/index.ts` (`Scene.transparent`, `MapData.camp`), `src/core/schemaValidation.ts`;
- the matching tests.

### T5c: town, castle and world data (Python sources and legacy maps)

#### CU: Cornelia's unreachable cells

**Root cause:** two grass pockets with no way in:
- (53,2), (53,3) and (54,3) lie behind the oak at `(53,3)` and the NE turret at `(55,2)`;
- (35,67) and (36,67) lie between the oak at `(35,64)`, the turret at `(33,66)` and the south wall.

All five are `.` in the ground that `cornelia.py` writes (checked with a BFS on the compiled collision: 2,664 walkable cells, 2,659 reached). `no_unreachable_walkable` is not set (`cornelia.py:291` doc).

**Fix:**
- In `cornelia.py`, after the `:65` pocket fill, add `g.rect(53, 2, 54, 3, "#", only=".")` and `g.rect(35, 67, 36, 67, "#", only=".")`.
- Check with `build_map.py --preview cornelia 50 0 58 6 --grid` and `… 31 62 39 70 --grid`. If bare wall art shows, nudge the oak instead, by one cell, so the cells join the town.
- Set `"no_unreachable_walkable": True` in `doc`.

**Test** (`tests/data/corneliaLayout.test.ts`): every walkable cell of the compiled `cornelia` can be reached from `south_gate`. Today 5 cells can't.

#### CT-4: the castle door guards narrow the 3-wide bridge to (30,19)

**Root cause:** `cornelia.py:250-254` puts the guards at `CX ± 1, 19`, which are (29,19) and (31,19), on top of the bridge. T3d's footbridge already fixed the sealed ledge, so only the narrowing is left.

**Fix:** move them to (28,19) and (32,19), beside the bridge head. A scratch BFS confirms that no cell is cut off.

**Test** (`corneliaLayout.test.ts`): no NPC stands on (29–31,19). Today two do. `map_report.py cornelia` lists no static NPC on the bridge.

#### CT-10: dialog problems

**Root cause:**
- `villager` (`cornelia.py:267-268`) says "…in the first dungeon!".
- `castle_door_guard_e` (`cornelia.py:252-254`) has exactly the lines of `hall_guard_e` (`castle.py:125-127`).
- `garden_maid` (`cornelia.py:285-287`) shares her pre-rescue lines with `castle_maid` (`castle.py:138-140`).

**Fix:** new lines.
- villager: "Buy spells early. Garland is no easy foe!"
- door guard: a gate-duty line; it keeps a rescue variant.
- garden maid: an orchard or roses line; see ST-10 for her rescue line.

**Test** (`tests/data/actOneDialog.test.ts`, new, on the compiled act-1 maps):
- no dialog line contains "dungeon";
- no two NPC ids share the same resolved line list under any flag set, except an explicit allow-list (for example "Long live the King!").

This fails today.

#### ST-9: castle lines assume the party has met the King

**Root cause:** the lines are unconditional:
- `treasury_guard` (`castle.py:146-147`): "The King ordered the storeroom below opened for you";
- `cellar_steward` (`castle.py:307-308`): "…by royal order".

There is no "met the King" flag.

**Fix:** reword them so they hold before the audience:
- guard: "The storeroom below is open to any who would face Garland.";
- steward: "Take what you need. The King would want it so."

(See decision 1.)

**Test** (`actOneDialog.test.ts`): with no flags, neither NPC has a line that matches `/for you|royal order/`.

#### ST-10: dialog keyed to the wrong flag

**Root cause:**
- `tower_sage` (`castle.py:277-283`) keys "So the princess gave you the old lute" on `PRINCESS_RESCUED`.
- The princess's dialog (`castle.py:236-239`) is unconditional, so she keeps offering the lute after `GOT_LUTE`.
- `castle_cook` (`castle.py:136-137`) has no post-rescue line.
- `garden_maid` (`cornelia.py:286`) says the princess "walks in the gardens", but she never appears there.

**Fix:**
- The sage's line is conditioned on `GOT_LUTE`.
- The princess gets a `GOT_LUTE` variant first ("Thank you again. Keep the lute safe.").
- The cook gets a `PRINCESS_RESCUED` line ("The feast is ready! Her Highness is home!").
- The maid's rescue line no longer mentions the gardens.

**Test** (`actOneDialog.test.ts`, using `resolveNPCDialog`):
- with PRINCESS_RESCUED but not GOT_LUTE, the sage doesn't mention the lute;
- with GOT_LUTE, the princess has no "take this lute" line;
- the cook's PRINCESS_RESCUED dialog differs from her default;
- the maid's rescue line doesn't match `/garden/i`.

#### IN-3, the data half: the HUD shows raw map ids

**Root cause:** Cornelia (`cornelia.py:291` doc) and the overworld (`overworld.py:539` doc) have no `name`. Neither do the legacy `assets/maps/*.yaml` maps.

**Fix:**
- `"name": "Cornelia"` and `"name": "World Map"`.
- Legacy names for all nine legacy maps.
- The temple's name goes in T5d, which owns that file.

**Test** (`actOneDialog.test.ts`, or a new `mapNames.test.ts`): every compiled map in `assets/maps/ai/index.yaml`, and every legacy map, has a non-empty `name`. Today Cornelia, the overworld, the temple and all the legacy maps fail.

**Browser:** the HUD reads CORNELIA, WORLD MAP and TEMPLE OF FIENDS.

#### MS-8, the data half: camping

**Fix:**
- Add `camp` to `PASSTHROUGH` (`build_map.py:74-75`).
- Add `"camp": True` to the overworld doc, and `camp: true` to the legacy `assets/maps/overworld.yaml`.

**Test:** the T5b runtime test, plus `actOneDialog`/`mapNames`: only the overworld has `camp`.

**T5c files:**
- `assets-src/tools/layouts/cornelia.py`, `castle.py`, `overworld.py`;
- `assets-src/tools/build_map.py` (one tuple entry);
- legacy `assets/maps/*.yaml` (names, `camp`);
- `tests/data/corneliaLayout.test.ts`, new `tests/data/actOneDialog.test.ts`.

### T5d: castle stairs and the temple's look

#### CA-1: the top cells of every stairwell are walkable

**Root cause:**
- `Room.stairs_down` (`layouts/common.py:98-102`) uses `walkable_rows=[0, 1]`, with the transitions on row `y+1`.
- Every arrival sits directly above a stairwell: 1F `cellar` [39,27] above (39,28); 2F `stairs` [21,23] above (21,24); tower `stairs` [7,8] above (7,9).
- So the player walks across the drawn pit's top row before going down.
- The unkeyed black corner is in the `stairs_down_0_1` part: 2F (22,24), 1F (40,28) and tower (8,9) are all its top-right cell.

**Fix:**
- `walkable_rows=[0]` with the transitions on row `y`, so the first step onto the stairwell goes down and row 1 is solid.
- Add a `paint` entry in `assets-src/gen/approved/castle/furnish.json` that fills the black corner with the part's neighbouring floor pixels. Find the rect with `--preview cornelia-castle 38 26 42 31 --grid`.
- The oblique 3/4 drawing style needs new art (see decision 4).

**Test** (`tests/data/castleStairs.test.ts`, new): for every `stairs_down_*` deco in `assets-src/maps/cornelia-castle*.yaml`, each of its 4 compiled cells is either a transition or not walkable. Today the top row is walkable and not a transition. The compiler's own checks (reachability, entrance not on a transition) must pass.

**Browser:** for 1F → cellar, 2F → 1F and tower → 2F, one step down from the arrival tile descends. There is no black corner.

#### TF-2: the temple's walls and floor share one cracked texture

**Root cause:** `assets-src/maps/temple-of-fiends.yaml:5` maps `in_wall_top` to `temple_wall_top` and `floor_stone` to `temple_floor`. Both cut from `gen/approved/temple/ruins.png`, the two textures read as the same cracked slab.

**Fix:**
- Derive the wall top instead, as the castle cellar does (`castle.py:311-312`): `in_wall_top: {from: temple_wall_top, shade: 0.5}`. If that isn't enough, also lighten the floor (`shade: 1.1`). No paid art.
- Add `name: Temple of Fiends` (IN-3).
- New opt-in map check `contrast: [{a: W, b: "-", min: 0.2}]` in `map_checks.py`: the mean luma of the cell centres differs by at least `min`. It gets a `map_selftest.py` case and is on for the temple.

**Test:** the new check fails on the current temple source and passes after the fix (selftest case). `build_map.py --selftest` passes.

**Browser:** in the temple (`?scenario=act1_temple&mute=1`), the walls read clearly darker than the floor.

**T5d files:**
- `assets-src/tools/layouts/common.py`;
- `assets-src/gen/approved/castle/furnish.json`;
- `assets-src/maps/temple-of-fiends.yaml`;
- `assets-src/tools/map_checks.py`, `map_selftest.py`;
- `tests/data/castleStairs.test.ts`.

---

### 3. Sub-tranches

| # | Items | Owns (files) | Depends on |
|---|---|---|---|
| T5a | ST-6, BA-3, BA-4, BA-5, BA-7, MS-8 (effects and docs) | `src/battle/{BattleStateMachine,SpellExecutor,BattleCommands}.ts`, `src/scenes/BattleScene.ts`, `src/scenes/battle/BattleFieldTargeting.ts`, `src/ui/ItemSelectionUI.ts`, `src/systems/ItemEffects.ts`, `docs/DESIGN_DOCUMENT.md`, their tests | none |
| T5b | NG-9, BA-13, IN-6, IN-3 (HUD fallback), MS-5, MS-8 (camp runtime) | `src/core/{InputManager,SceneManager,schemaValidation}.ts`, `src/scenes/{ExplorationScene,InnScene,ShopScene,ItemMenuScene}.ts`, `src/ui/{QuantitySelector,Menu}.ts`, `src/types/index.ts`, their tests | none (its `camp` test uses synthetic maps) |
| T5c | CU, CT-4, CT-10, ST-9, ST-10, IN-3 (names), MS-8 (`camp` data) | `layouts/{cornelia,castle,overworld}.py`, `build_map.py` (`PASSTHROUGH`), legacy `assets/maps/*.yaml`, `tests/data/{corneliaLayout,actOneDialog}.test.ts` | none |
| T5d | CA-1, TF-2 (+ the temple's name) | `layouts/common.py`, `gen/approved/castle/furnish.json`, `assets-src/maps/temple-of-fiends.yaml`, `map_checks.py`, `map_selftest.py`, `tests/data/castleStairs.test.ts` | none |

**No file is shared between sub-tranches.**
- `ItemMenuScene.ts` (T5b) only calls the existing `ItemEffects.isPartyItem`, which T5a doesn't change.
- T5c and T5d both regenerate `assets-src/maps/cornelia-castle*.yaml` (from `castle.py` and from `common.py`). By the T3 rule, those generated sources and all compiled output are discarded from the branches and rebuilt on the integration branch.

**Order:**
1. All four run in parallel worktrees from `t4-integration`.
2. Merge T5a, T5b, T5c, then T5d into `t5-integration`.
3. Then run the layout scripts by name (`overworld.py`, `cornelia.py`, `interiors.py`, `castle.py`), then `build_map.py` for every map, then `git diff --exit-code assets-src/maps` (a second run must produce no diff).

**Validation:**
- `npm run build`, `npm test`, `npx vitest run tests/data tests/balance`;
- `python3 -I assets-src/tools/build_map.py --selftest` and `--check-determinism`;
- `python3 -I assets-src/gen/selftest.py` (run from the main checkout, because `furnish.json` changes);
- `map_report.py cornelia cornelia-castle cornelia-castle-2f cornelia-castle-tower cornelia-castle-cellar`;
- the browser checks above, at `http://127.0.0.1:5173/?mute=1…`, with 0 console errors.

---

### 4. Decisions for the user

1. **ST-9:** reword the two castle lines (planned), or add a "met the King" flag that the King's first dialog sets and condition the lines on it (a new NPC `setFlag` field: more code for the same result).
2. **IN-6 side note:** the inn revives KO'd members (it sets `currentHp = maxHp` for everyone). FF1's inn doesn't, and T2 made Tent and Cabin skip the fallen for that reason. Keep reviving, or skip the fallen? This isn't in the defect list, so the plan leaves it as it is unless you say otherwise.
3. **MS-8 Tent:** FF1's rule, world map only (planned), covering Tent and Cabin. Dungeons and towns refuse them.
4. **CA-1:** the plan fixes the walkable pit and the black corner. The stairwell's oblique 3/4 drawing style can only change with new art (1 Gemini image); fold it into T6's paid art with OW-8 and OW-9, or accept it.
5. **BA-3:** retarget to another living enemy (planned, as the review proposed, and as Fight does), rather than FF1's "Ineffective" with the charge spent.
6. **MS-5 "no purchase confirmation":** planned as the total in the quantity picker plus a "Bought N X." line, not an extra Yes/No step.

### Decisions (orchestrator defaults, reported to the user)
1. **ST-9:** reword the two castle lines; no new flag.
2. **The inn keeps reviving fallen members.** It's friendlier for modern players and not a listed defect.
3. **Tent and Cabin work on the world map only** (FF1's rule).
4. **CA-1:** fix the walkable top row and the black corner. The oblique stair art needs new paid art, so it moves to T6 with OW-8 and OW-9.
5. **BA-3:** retarget to another living enemy.
6. **MS-5:** show a total in the quantity picker plus a "Bought N X." line; no extra Yes/No step.

### Revisions after the momus review (binding)
All 17 momus issues apply. Resolutions:
1. **Base:** every sub-tranche branches from `mainline` `ae71280` (it has the T4 fixes) and re-checks the line references.
2. **ST-6:** the phase messages from `prepareRound` are shown before the first `announce`, inside the T2 auto-advance pacing. Add a `BattleScene`-level test.
3. **BA-3:** `tests/balance/*` must stay green and unchanged. If a bound moves, re-measure it under the T4 rule and record why. Add a magic retarget case to `BattleCommands.test.ts`.
4. **MS-5:** the one-line comparison keeps `cmp.label` and the hit counts (`hitsSuffix`). Update `tests/scenes/ShopComparison.test.ts` on purpose; this belongs to T5b.
5. **MS-8:** the `hi_potion` fixture in `ItemEffects.test.ts` goes to 120 (or reads `items.yaml`), so the test fails on the old code.
6. **IN-6:** the inn clears status for every member, KO'd members included, and revives them. Test a KO'd member with `death`.
7. **CT-10:**
   - the door guard gets a new rescue line;
   - NPCs with `chestItem` are left out of the duplicate check;
   - the flag sets are {}, {INTRO_COMPLETE}, {INTRO_COMPLETE, PRINCESS_RESCUED} and {…, GOT_LUTE}.
8. **IN-3:** name all 11 legacy maps, or exclude `test-*` explicitly in `mapNames.test.ts`.
9. **CT-4:** `no_static_chokepoints` is the gate check. Cutting the row-19 through-route is accepted, as long as both sides stay connected.
10. **Generated files:** as in T3, sub-branches commit their own regenerated `assets-src/maps/*` and compiled output for review. The integration branch rebuilds everything once, commits, and a second run must give no diff.
11. **TF-2 contrast check:** it compares `c.below` pixel luma (0–1, Rec. 601), sampled at the centre 8x8 px of a wall cell against a floor neighbour. `map_checks.py` is due for a split in T6.
12. **CA-1:** the paint rect is the `stairs_down_0_1` cell's pixel rect from `furnish.json` `cells`, given in sheet pixels.
13. **Debug scenarios:** T5b owns `assets/data/debug-scenarios.yaml` and adds:
    - `t5_battle_items`: a battle with tent, potion and phoenix_down, plus a fallen member;
    - `t5_cornelia_field`: Cornelia, with a tent, a hurt party and 0 G;
    - `t5_castle`: the castle 1F stairs.

    Each check lists its exact URL `?mute=1&scenario=<id>`. The CA-1 check uses `act1_castle` or `t5_castle`.
14. **NG-9 browser check:** dispatch a synthetic keydown and keyup in the same frame through `page.evaluate` and assert that it registers. Drop `releasedThisFrame` unless it feeds `isJustReleased`.
15. **BA-3 browser check:** repeat until the log shows the target die before B.MAG acts. The seeded unit test is the authority.
16. **Minor details:**
    - `ItemMenuScene.test.ts` is a new file;
    - `unitPrice` is an optional trailing parameter;
    - the `InnScene` tests build `InnScene` with `createMockGame()`;
    - BA-13 goes into `BattleFlash.test.ts`, with its browser check on `act1_overworld`.
17. **Docs:** the integration step adds a T5 result section to `docs/FIX_PLAN_PENINSULA.md`, and records `Scene.transparent` and `MapData.camp` in `AGENTS.md`.

---

### T5 result

**Commits:**

| Part | Commit | Scope |
|---|---|---|
| T5a | `bb3a84d` | ST-6, BA-3, BA-4, BA-5, BA-7, MS-8 (effects and docs) |
| T5b | `14b480d` | NG-9, BA-13, IN-6, IN-3 (HUD fallback), MS-5, MS-8 (camp runtime), the `t5_*` scenarios |
| T5c | `7bef182` | the Cornelia unreachable cells, CT-4, CT-10, ST-9, ST-10, IN-3 (names), `camp` data |
| T5d | `32ba358` | CA-1 (walkable row, black corner), TF-2 (contrast check), the temple name |

Integration: the temple-name exemption is removed, and a full layout and map rebuild is clean (`ee0b656`).

**Review fixes (momus):**
- Phoenix Down with nobody fallen now says "No one to revive." (test added).
- `AGENTS.md` now records `Scene.transparent`, `MapData.name` and `MapData.camp`, the debug-scenario `hp`, and the monitored oversize files.

**Validation:**
- 1927 tests pass; `tests/balance/*` is unchanged and green.
- `build_map --selftest` passes 94 checks; `--check-determinism` passes on every map; `gen/selftest` passes.
- Momus ran the changed tests against `mainline` code, and 54 of them fail there.

**Browser checks** (all with `?mute=1`):
- **Title:** a same-frame synthetic Enter tap opens party creation (NG-9).
- **`scenario=t5_battle_items`:**
  - battle items list only potion and phoenix_down (BA-4);
  - Phoenix Down targets the fallen W.MAG, "W.MAG was revived", HP 1, one used (BA-5).

  A queued item that never acts, because the battle ended first, is FF1-normal.
- **`scenario=t5_cornelia_field`:**
  - `canCamp()` is false in Cornelia (MS-8);
  - the inn with 0 G shows "You don't have enough gold." over the visible room, and the HUD shows 0G (IN-6).
- **`scenario=t5_castle`:** the arrival is just above the stair row, and the stair top row is the transition (CA-1).
- **`scenario=act1_temple`:** the name is "Temple of Fiends". The wall tops are darker than the floor but stay textured and distinct from the void (TF-2, momus item 5).
- **Console:** 0 errors.

**Accepted deviations:**
- the House row is removed from the design doc;
- the oak is swapped for a fir at (53,5);
- the treasury guard's second line changed;
- the temple shading is wall 0.35 and floor 1.3;
- the shop gold window is 696 px wide;
- the debug-scenario `hp` field.

**Note:** debug scenario `ai_boss_cast` now logs one expected `console.warn` when the Lich drops below half HP: `bossPhases` with an AI but no known pattern id. This is planned behaviour, not a regression.

## T6: Polish and the presentation decisions

**Base:** `mainline` at `2922e5d` (T5 merged; `t5-integration` = `mainline`). All file:line references are to that commit.

**Inputs:**
- `docs/PLAYTEST_PENINSULA_2026-11-13.md`: every severity `p` item (triage default "fix as proposed in the review"), plus the binding rows for MS-7, BA-8, TF-3, CT-9/UI-2, IN-5/CA-7, OW-8/OW-9;
- `docs/FIX_PLAN_PENINSULA.md`: T1–T5 results, the T6 OW-9 note, the T3 carry (file splits), T5 decision 4 (CA-1 stair art);
- `/tmp/t3/second-pass-notes.md` (the 4 notes that fit T6 are folded in; the rest stay for the final pass);
- `assets-src/gen/README.md`, `docs/ART_ROLLOUT.md`, `docs/ART_TILES_PLAN.md`, `docs/ART_BATTLE_PLAN.md`, `assets-src/tools/stage_backgrounds.py`.

**Rules (as T1–T5):**
- Edit generators and sources, never `assets/maps/ai/**` by hand. Sub-branches commit sources and code; the integration branch rebuilds every map once after the last merge, and a second run must give no diff.
- Every code fix gets a test that fails on the old code.
- Browser checks use `http://127.0.0.1:5173/?mute=1&…` (memory: never without `mute=1`), with 0 console errors. Close the page and stop the dev server afterwards.
- Paid art follows `docs/ART_ROLLOUT.md` "Per-checkpoint procedure": dry run first, exactly one paid request per checkpoint (`--max-paid 1`), review, then approve or retry. At most 2 retries per sheet (the `budget.json` guard enforces 3 attempts). Approved sheets are never modified (style lock): new art is always a new sheet with new part names.

---

### 1. Status of the T6 scope

### 1.1 The 25 `p` items

#### Fixed already (11)

| ID | Evidence on `mainline` |
|---|---|
| CT-8 | T3d: `road_check` on Cornelia (`layouts/cornelia.py:304`, `LANE_ENDS` at `:237`); every lane ends at a gate, door, bridge or garden (`FIX_PLAN` T3d result) |
| IN-5 | T3d: the six shops and the inn each have their own plan (`layouts/interiors.py:368-509`); tested in `tests/data/corneliaLayout.test.ts` |
| OW-12 | T3c: `min_blob {mountain 3, sand 3, forest 3, ocean_inlet 2}` (`layouts/overworld.py:549`) |
| OW-13 | T3c: the city stream is laid as river cells under the icon to the bay (`overworld.py:255-262`); `river_check` |
| OW-14 | T3c: `sealed_edges: true` (`overworld.py:546`), an ocean ring on every edge |
| OW-15 | T3 review fixes: the larger mainland (72x72, mainland > 1.15x peninsula), the spine range seals the isthmus; OW-15 test in `overworldLayout.test.ts` |
| EB-10 | T4a: `PhysicalAttack.resolveEnemyAttack` rolls `rand(A, 2A) − absorb` (`src/battle/PhysicalAttack.ts:27`); `MAX_FORMATION = 9` (`src/systems/EncounterTable.ts:4`) |
| BA-6 | T2a: one-off notices (`BattleScene.ts:23`, `showNotice('No spells available.')` at `:320`), no message replay |
| BA-10 | T4a: "Victory! N XP each" (`BattleStateMachine.ts:571`); party order matters through `FRONT_WEIGHTS` 4/2/1/1 (`src/battle/EnemyAI.ts:7`) |
| BA-11 | T1: Game Over is a menu (Retry Battle / Load Game / Title, `GameOverScene.ts:32-34`); no "Press START" text anywhere in `src/` |
| MS-6 | T2b: `MagicShopScene.confirmPurchase` shows the result after rebuilding the menu (`MagicShopScene.ts:177-178`) |

#### Open (14)

CT-9, IN-4, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, TF-1, TF-3, BA-9, BA-12, UI-1, UI-2.

### 1.2 The other T6 items (all open)

| Item | Source |
|---|---|
| MS-7 field menu redesign | triage (binding) |
| BA-8 bigger battle text, compact party HP panel | triage (binding) |
| OW-8 temple icon (paid) | triage |
| OW-9 broken-bridge stubs (paid); art only, map unchanged | triage + `FIX_PLAN` T6 note |
| CA-1 oblique stair art (paid) | `FIX_PLAN` T5 decision 4 |
| Split `layouts/overworld.py` (594 lines), `layouts/interiors.py` (509), `map_checks.py` (615), `ShopScene.ts` (332; the detail panel) | `FIX_PLAN` T3 final validation; `AGENTS.md:118` |

### 1.3 Second-pass notes folded in

| Note | Folded into |
|---|---|
| The HUD truncates names to 5 characters (`FieldHUD.ts:56`, `slice(0, 5)`; names are up to `NAME_MAX_LENGTH` = 6) | UI-1 |
| The battle enemy list overflows with 9 enemies (one line per lettered instance, `BattleDisplayManager.ts:210-235`) | BA-8 |
| The magic shop shows no spell description and no who-can-learn | MS-7 (descriptions), in T6f |
| The active hero vanishes (`BattleScene.ts:189`, alpha `0.5 + 0.5·sin`, reaches 0) | BA-8 |
| The temple icon is hard to spot at overview scale | OW-8 acceptance |

Left for the final adversarial pass: the staircase roads, the fisher's-cottage stray pixels, the "attacks Goblin A" announcement naming a dead target, and NG-9 (already fixed in T5).

**Count:** 14 open `p` items + MS-7, BA-8, OW-8, OW-9, CA-1 art + 4 splits = **23 open work items** (4 notes folded in, no separate items).

---

### 2. Open items

### Shared contract (T6-0, one commit on `t6-integration` before any branch)

So that no two sub-tranches edit the same file, the shared types and one extraction land first:
- `src/types/index.ts`:
  - `ItemData.description?: string`;
  - `MapTransition.effect?: 'door' | 'fade'` (CA-2);
  - `MapData.battleBackgrounds.zones?: Record<string, { default?: string; terrain?: Record<string, string> }>` (TF-3).
- `src/core/schemaValidation.ts`: the three optional fields (string; enum; record of records of strings).
- Move `ExplorationScene.battleBackground()` (`ExplorationScene.ts:520-530`) into a new pure module `src/scenes/exploration/BattleBackdrop.ts`:
  `battleBackdropId(cfg, pos, terrainAt(x, y) → string | undefined, zoneId: string | null) → string | undefined`, with today's behaviour. `ExplorationScene` passes `TerrainType` names from the collision map and `encounterSystem.zoneAt(x, y)?.id`. Test `tests/scenes/BattleBackdrop.test.ts` pins today's behaviour.
- `assets-src/tools/kit.py` `_PARTS`: placeholder entries for every new part name in §3 (so map tranches compile before the art lands).
- Tests and build pass; no behaviour change.

### T6a: overworld layout and map checks (Python)

#### Split `layouts/overworld.py` (594 lines)
- **Fix:** `overworld.py` keeps the constants, `build()`, `check()`, `objects()` and `main()`. New sibling modules: `overworld_noise.py` (`value_noise`, `fbm`, `signed_distance`, `polyline_distance`, `blob`), `overworld_grid.py` (`fill_unreachable`, `walk_grid`, `bfs`, `clear_rect`, `clear_disc`, `near`, `extend_to_sea`, `components`, `tidy_land`, `tidy_blobs`), `overworld_zones.py` (`_g`, the §1.6 tables, `row_rects`, `encounter_zones`). Constants the helpers need are passed as arguments, or live in `overworld_consts.py`.
- **Test:** each file < 250 lines; `python3 -I assets-src/tools/layouts/overworld.py` regenerates `assets-src/maps/overworld.yaml` byte-identical (`git diff --exit-code assets-src/maps`); `overworldLayout.test.ts` unchanged and green.

#### Split `map_checks.py` (615 lines)
- **Fix:** `map_checks.py` stays the façade that `build_map.py` and `map_selftest.py` import (`run`, `encounter_errors`, `contrast_errors` and every name they use, re-exported). New: `map_graph.py` (`walkable`, `reach`, `distances`, `static_npc_cells`, `talkable`, `articulation_points`, `components`, `edge_cells`), `map_checks_terrain.py` (`road_caps`, `_road_check`, `_min_blob`, `ocean_inlets`, `_river_check`, `_run`, the contrast trio), `map_checks_encounters.py` (`known_enemies`, `table_errors`, `encounter_errors`).
- **Test:** each < 250 lines; `build_map.py --selftest` (94 checks) passes; a full compile leaves `assets/maps/ai/**` byte-identical; `--check-determinism` passes.

#### BA-12: beach battles use the desert background (map half)
- **Root cause:** sand compiles to `TerrainType.Desert`, so the overworld key `sand: desert` never matches and `desert: desert` does (`overworld.py:567-569`).
- **Fix:** `terrain: {forest: forest, desert: shoreline, swamp: swamp, water: ocean, river: river}` (drop the dead `sand` key). TF-3 zone keys: `zones: {temple_approach: {terrain: {forest: dark_forest}}, east_pocket: {default: ruined_forest}}`. The ids are the T6g contract.
- **Test:** `overworldLayout.test.ts`: every `battleBackgrounds` value (default, terrain, zones) names a file in `assets/backgrounds/`, and no key is a `TerrainType` name that doesn't exist (catches `sand`). The runtime half is T6g.
- **Browser:** see T6g.

**T6a owns:** `layouts/overworld*.py`, `map_checks*.py`, `map_graph.py`, `map_selftest.py` (imports only), `tests/data/overworldLayout.test.ts`.

### T6b: Cornelia and the interiors (Python, legacy sprites)

#### Split `layouts/interiors.py` (509 lines)
- **Fix:** `interiors.py` stays the entry point (writes all 17 maps). New: `interiors_common.py` (`wood`, `Place`, `house`, `shop`, `keeper`), `homes_a.py` and `homes_b.py` (five homes each), `shops.py` (the six shops and the inn).
- **Test:** each < 250 lines; the 17 generated sources are byte-identical; `corneliaLayout.test.ts` green.

#### IN-4: "Welcome to the White Magic!"
- **Fix:** `keeper()` takes a greeting; the magic shops say "Welcome to the White Magic Shop! Healing arts, for those with the gift." and "…Black Magic Shop!…". The HUD names become "White Magic Shop" and "Black Magic Shop" in `shops.py` and in the legacy `assets/maps/cornelia-{white,black}-magic.yaml` (names and keeper lines).
- **Test:** `corneliaLayout.test.ts`: every keeper's first line names a shop noun (`Shop|Inn`) and none ends "Magic!".
- **Browser:** `?mute=1&scenario=t5_cornelia_field`, enter the white magic shop, talk to the keeper.

#### CT-9 and UI-2: the signpost, and market vendors become townsfolk
- **Fix (`cornelia.py`):**
  - add `inspect` text for the signpost cell (`CX + 2, 66` = (32,66)): the directions to the castle (north up the high street), the market square, the magic quarter and the inn, checked against the layout's real positions;
  - `market_vendor_w` / `_e` drop the merchant sprite and the "not for adventurers" line, and get market chatter, conditional on `PRINCESS_RESCUED` (prices, the princess, wolves on the roads, the bridge). Sprites `vendor_f` and `farmer`; the `villager` at (34,45) becomes `burgher` (the three new sprites from §3);
  - `assets-src/characters.py` `ROSTER`: legacy `Look`s for `vendor_f`, `farmer` and `burgher`, then `build_assets.py characters`, so `assetCoverage` passes before the 2x art lands (its 2x test accepts legacy art).
- **Test:** `corneliaLayout.test.ts`: the signpost cell has inspect text; no NPC without `shopId` uses `merchant`; the vendors have ≥ 2 dialog variants; `assetCoverage.test.ts` (unchanged) covers the new sprite names.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: face the signpost and press confirm; talk to both vendors; screenshot the market (after §3, the new sprites; before, the legacy look).

**T6b owns:** `layouts/interiors*.py`, `homes_*.py`, `shops.py`, `layouts/cornelia.py`, legacy `assets/maps/cornelia-*.yaml`, `assets-src/characters.py`, `assets/sprites/characters.{png,json}`, `tests/data/{corneliaLayout,actOneDialog}.test.ts`.

### T6c: castle and temple (Python)

#### CA-3: the 1F and 2F stairs don't line up
- 1F leaves at the hall's north end (`castle.py:53`, stairs at (21,7)); 2F arrives at the throne room's south end (`:175`, (21,24)). There is no cheap realignment: 2F's north end is the dais and throne.
- **Options (user decision 1):** (a) accept it as the classic FF1 layout (you climb from the hall and enter the throne room at its foot) and record it as won't-fix; (b) rebuild 2F with a stair landing on its north side (map +4 rows, a north gallery with the stairwell, entered through doors at the gallery ends). This changes the walk to the King and every 2F arrival.
- **Test (b only):** `castleLayout.test.ts`: the 1F stair column and the 2F arrival are within 4 rows of the same relative height. **Browser (b):** `?mute=1&scenario=t5_castle`.

#### CA-4: a barrel half-blocks the treasury doorway
- **Fix:** move the barrels at (32,24) and (32,25) (`castle.py:119-120`) to (32,21) and (32,22).
- **Test (new `tests/data/castleLayout.test.ts`):** for every 2-cell doorway carved between rooms (read from the compiled collision: a 2-wide gap in a wall line), both cells on each side are walkable.
- **Browser:** `?mute=1&scenario=t5_castle`, walk from the hall into the treasury through both doorway cells.

#### CA-5: the King stands beside the throne
- **Fix:** the King moves from (20,8) to the throne's seat cell (21,7); the throne deco (`castle.py:174`) gets `offset: [-24, 0]` so its seat is centred on that cell, and `walk_cells: [[0, 1]]` so the NPC stands on a non-wall cell (the compiler forbids NPCs on blocked cells). The player talks to him from the dais at (21,8). The King has no sitting pose; he stands in front of the throne back, as in FF1 (user decision 7).
- **Test:** `castleLayout.test.ts`: the King's cell is in the throne footprint's bottom row; the cell south of it is walkable; `actOneDialog` and `Act1Blockers` (King cutscenes) green.
- **Browser:** `?mute=1&scenario=act1_castle`: the King is on the throne; talking from the dais works.

#### CA-6: inconsistent floor names
- **Fix:** "Cornelia Castle 1F", "Cornelia Castle 2F", "Cornelia Castle 3F" (the tower) and "Cornelia Castle B1" (`castle.py:35, 158, 266, 291`).
- **Test:** `mapNames.test.ts`: every `cornelia-castle*` name matches `^Cornelia Castle (B1|[1-3]F)$`.
- **Browser:** the HUD label on each floor (`act1_castle`, `t5_castle`).

#### CA-7: give the empty rooms a purpose
- **Fix (`castle.py`):**
  - **1F north gallery** (12–31, 3–5) becomes the library's reading gallery: bookshelves on the north row, two lecterns, a reading bench, and a scholar NPC (two lines of lore). Two rows stay open end to end (`no_static_chokepoints` holds).
  - **Treasury** (32–41, 19–30): two chest NPCs (`CHEST_CORNELIA_TREASURY_1/2`; default loot `cabin` and `phoenix_down`, user decision 6), plus gold heaps and a crown on a cushion as deco (wired in T6h when the art lands).
  - **Cellar:** its three chests already exist and show opened (ST-12, T3d). Add a wine-rack row and a fourth chest behind the barrels (`ether`), so it reads as a store, not an empty room.
  - **2F tower-stair hall** (33–41, 6–14) becomes the guard room: armour stands, a weapon rack, a table, and a guard NPC with a line about the tower. The map table is wired in T6h.
  - **Carpets:** 2F's runner becomes 4 wide with a medallion rug before the dais, so 1F and 2F no longer share one layout.
- **Test:** `castleLayout.test.ts`: the treasury has ≥ 2 chest NPCs whose flags are unique (`crossFileValidation` already checks chest flags); the gallery has ≥ 4 bookshelf decos and a talkable NPC; 1F and 2F carpet (`+`) masks differ; compiler checks pass.
- **Browser:** `?mute=1&scenario=t5_castle`: loot a treasury chest (it shows opened); walk the gallery; `act1_castle` for the guard room.

#### TF-1: black void corners in the temple
- **Root cause:** the ground's `x` (void) cells (`assets-src/maps/temple-of-fiends.yaml:16-37`) draw flat black, in the top corners and beside the entry corridor. The map is larger than the view in both axes, so nothing outside the map ever shows.
- **Fix:** every `x` becomes `W` (the dark wall-top texture, shade 0.35), so the temple sits in solid rock. The `contrast` check (W vs floor) still applies.
- **Test:** new `tests/data/templeLayout.test.ts`: the source ground has no `x`, and the compiled collision is unchanged (wall either way). No new map check, because T6a owns `map_checks.py` in this wave.
- **Browser:** `?mute=1&scenario=act1_temple`: walk to both top corners; no black.

**T6c owns:** `layouts/castle.py`, `assets-src/maps/temple-of-fiends.yaml`, `tests/data/{castleLayout,templeLayout,mapNames}.test.ts` (new / edited).

### T6d: the field menu, the HUD and transitions (runtime)

#### MS-7: field menu redesign (no portraits; show the data)
- **Fix:**
  - `FieldMenuScene` becomes a two-pane screen. Left: the command list (Items, Magic, Equip, Status, Order, Save, Load). Below it: a gold window and a play-time window (`Game.playTime`, `H:MM:SS`), plus the location name.
  - Right: a new `src/ui/PartyPanel.ts`, one row per member: full name (6 chars), class, `Lv N`, HP `cur/max` with a bar, MP as per-level charges `L1 2/2 L2 1/1…` (casters only; others blank), status, and `Next: N` (`xpForNextLevel() − xp`). Fallen members are greyed out.
  - **Config** (`FieldMenuScene.ts:25`) does nothing: remove it (user decision 2; the alternative is a small Config scene with message speed).
  - `StatusScene`: XP to the next level, learned spells with charges, and slot labels Weapon / Body / Shield / Helmet.
- **Test:** `FieldMenuScene.test.ts`: the panel shows each member's name, Lv, HP, Next, and charges for casters; gold and time strings; no Config item. `PartyPanel.test.ts` (new). `StatusScene` test for "Next" and spells.
- **Browser:** New Game from the title (default party, FGHTR / FGHTR2 if duplicated), open the menu; then `?mute=1&scenario=t5_cornelia_field` (hurt party, 0 G). Screenshot.

#### UI-1: the HUD is bare text (and names are cut to 5 characters)
- **Fix (`FieldHUD.ts`):** the map label and the gold sit in small `Window` panels; the bottom HP strip sits in a panel, with fixed columns and full 6-character names (`NAME_MAX_LENGTH`), not `slice(0, 5)`.
- **Test:** `tests/ui/FieldHUD.test.ts` (new): `FGHTR2` is shown in full; the label, gold and HP texts each have a panel behind them; gold stays inside its panel for 99999G.
- **Browser:** `?mute=1&scenario=act1_castle` over the battlements; a New Game party with duplicate classes.

#### CA-2: castle stairs and the castle entrance use the shop-door zoom
- **Root cause:** `ExplorationScene.ts:442` zooms whenever the target map id starts with `cornelia-`.
- **Fix:** `build_map.py` stamps `effect: door` on transitions from `house` and `prefab` objects with `enter` (shop, inn and house doors). Facades (the castle gate), stairs and edge exits get none. A new pure `src/scenes/exploration/TransitionEffect.ts` returns `zoom` for `door` and `fade` otherwise; `ExplorationScene` calls it.
- **Test:** `TransitionEffect.test.ts`; a compiled-map test: every Cornelia house and shop transition has `effect: door`, no `cornelia-castle*` stair transition does, and the castle gate doesn't.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: a shop door zooms; the castle gate and the castle stairs fade.

**T6d owns:** `src/scenes/{FieldMenuScene,StatusScene,ExplorationScene}.ts`, `src/ui/{FieldHUD,PartyPanel}.ts`, `src/scenes/exploration/TransitionEffect.ts`, `assets-src/tools/build_map.py` (transition `effect` only), their tests.

### T6e: battle readability (runtime)

#### BA-8: bigger text, a compact party HP panel, the active hero
- **Fix:**
  - Battle-only sizes in `BattleSceneTypes.ts` (global `FONT_SIZE` unchanged): the message text at 36 (two lines fit the 120 px window, which the stage spec keeps at 0–120), floating damage numbers at 48 with a dark outline (heal green, miss grey).
  - Remove the four 200x165 status boxes at x 1700 (`BattleDisplayManager.ts:104-140`). The bottom strip (y 780–1080) gets: the enemy list (x 0–560), the command window (x 560–900, shown in the command phase) and a compact party panel (x 900–1920): 4 rows of name, HP `cur/max` with a bar and a status tag, at 32 px. The acting member's row is highlighted with a cursor.
  - **Active hero:** no alpha pulse (`BattleScene.ts:189`). Alpha stays 1; the hero steps 24 px forward and pulses its tint between white and pale yellow.
  - **Enemy list (9 enemies):** grouped by species, as FF1 does ("6x Goblin", "3x Wolf", from the base enemy name, not the lettered `displayName`). If there are more than 5 lines, it uses two columns. Dead species grey out, as now.
- **Test:** `tests/scenes/battle/BattleDisplayManager.test.ts`: 9 enemies (6 + 3) give 2 lines inside the window; 6 species give two columns inside the window; the party panel has 4 rows with HP text. `BattleScene.test.ts`: across 200 update frames on a member's turn, that sprite's alpha stays 1. The message and floating text sizes are ≥ 36 / 48.
- **Browser:** `?mute=1&scenario=t4_nine` and `?mute=1&scenario=ai_boss`: screenshots of the command phase and a damage number; the active hero stays visible.

#### BA-9: the lunge stops about 400 px short, and "missed!" shows before the swing
- **Root cause:** a fixed `ATTACK_REACH = 150` (`attackChoreography.ts:15`) whatever the distance; the result text starts when the advance starts.
- **Fix:** `advanceAt(style, t, reach)` takes the reach: the distance from the attacker's home x to the target's right edge plus 24 px, clamped to [150, 900]. `BattleAnimationController` computes it from the target sprite's bounds, and shows the floating number and the result line on the contact frame (`advanceFrames(style)`).
- **Test:** `attackChoreography.test.ts`: the last advance frame's `dx` equals `−reach` for lunge, dash and leap; `BattleAnimationController` test: no result text before the contact frame.
- **Browser:** `?mute=1&scenario=ai_party_base&attack=lunge` (and `dash`, `leap`): the attacker reaches the target; the number appears on contact.

**T6e owns:** `src/scenes/BattleScene.ts`, `src/scenes/battle/{BattleDisplayManager,BattleAnimationController,attackChoreography,BattleSceneTypes}.ts`, their tests.

### T6f: shops, items and descriptions (runtime and data)

#### Split `ShopScene.ts` (332 lines)
- **Fix:** `updateDetailPanel`, `setDetailVisible` and `DETAIL_RECT` (`ShopScene.ts:22, 148-156, 277-327`) move to `src/scenes/shop/ShopDetailPanel.ts`. The detail panel also shows the item's description.
- **Test:** `ShopScene.test.ts` and `ShopComparison.test.ts` green unchanged; each file < 250 lines.

#### MS-7, the description half (and the magic-shop note)
- **Fix:**
  - `assets/data/items.yaml`: a real `description` for all 43 items (what it does, in numbers where useful: "Restores 30 HP to one ally.").
  - A new `src/ui/HelpWindow.ts` (a one-line description bar) used by `ItemMenuScene`, `FieldMagicScene`, `EquipScene` and both shops.
  - `ItemMenuScene`: the target list shows `HP cur/max` and status.
  - `EquipScene`: slot labels Weapon / Body / Shield / Helmet (not `weapon:`), and a live ATK/DEF preview while browsing (reusing `CombatStats.withEquipped` from `shopComparison.ts`).
  - `MagicShopScene`: the selected spell's description, and who can learn it (class initials, greyed when nobody in the party can).
- **Test:** `crossFileValidation` (or a new `tests/data/descriptions.test.ts`): every item has a non-empty description that isn't its name; `ItemMenuScene.test.ts`, `EquipScene.test.ts`, `MagicShopScene.test.ts` cases for each.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: Items (description, target HP); Equip (preview); the white magic shop (description, learners).

**T6f owns:** `src/scenes/{ShopScene,MagicShopScene,ItemMenuScene,EquipScene,FieldMagicScene}.ts`, `src/scenes/shop/ShopDetailPanel.ts`, `src/ui/HelpWindow.ts`, `assets/data/items.yaml`, their tests.

### T6g: battle backgrounds (TF-3, and the runtime half of BA-12)

#### TF-3: the 21 unused hand-made backgrounds
- **Fix (`stage_backgrounds.py`):**
  - Add the 21 unused sources from `~/temp/ffgame-assets/tiles/backgrounds/hd/` to `STAGES`, with a horizon (source row) measured per image: abandoned-castle, chaos, cracked-earth, dark-forest, evil-temple, fire-temple, ice-cave, magic-forest, magma-temple, palace, red-forest, ruined-forest, sky-palace, swamp-cave, throne-kary, throne-kraken, throne-lich, throne-tiamat, tower-of-babel, town, water-temple.
  - Game ids are snake_case of the file stem (`chaos` → `chaos_shrine`).
  - The sources stay out of git; the `.webp` outputs are committed (about 21 × 450 KB ≈ 9–10 MB).
  - Many have a high horizon. `stage()` already refuses a frame that leaves the field or the bottom uncovered; use `zoom` / `horizon_y` where needed.
- **The temple choice:** stage both `evil_temple` and `abandoned_castle`, plus two debug scenarios `t6_bg_evil_temple` and `t6_bg_abandoned_castle` (Garland plus the temple formation, `background:` set).
  - Compare the screenshots: feet of all 4 heroes and Garland on the plain (y 360–770), the horizon in 290–350, sprite contrast against the floor, and a ruin mood.
  - The winner becomes `STAGES["temple"]`, so the temple map (`battleBackgrounds: {default: temple}`) doesn't change. The palace hall it replaces (`temple-of-fiends-hd.png`) is kept as `fiend_hall` for the act-4 return.
  - The orchestrator picks, and reports with both screenshots (user decision 3; swapping later is one line).
- **Test:** `assetCoverage.test.ts`: every `STAGES` id has `assets/backgrounds/<id>.webp` at 1920x1080 (parse the `STAGES` keys from the script, or a small manifest it writes); every map `battleBackgrounds` id (including `zones`) exists.
- **Browser:** the two `t6_bg_*` scenarios; a contact sheet of all 21 staged images with the feet band (y 360/770) and the party column (x 1380–1675) drawn on top, saved to `/tmp/t6/bg/`.

#### BA-12, runtime: the forest edge
- **Fix (`BattleBackdrop.ts`):** zones first (`zones[zoneId]`, `terrain` then `default`), then the map's `terrain`, then `default`. A grass cell with ≥ 2 of its 4 neighbours forest counts as forest (T3b's organic outlines draw forest over grass cells).
- **Test:** `BattleBackdrop.test.ts`: sand → `shoreline`; grass beside 2 forests → `forest`; forest in `temple_approach` → `dark_forest`; `east_pocket` → `ruined_forest`; no config → undefined.
- **Browser:** `?mute=1&scenario=act1_overworld`: walk the beach south of the city until a battle starts (shoreline); then a forest-edge cell.

**T6g owns:** `assets-src/tools/stage_backgrounds.py`, `assets/backgrounds/*.webp`, `src/scenes/exploration/BattleBackdrop.ts`, `assets/data/debug-scenarios.yaml`, `tests/data/assetCoverage.test.ts`, `tests/scenes/BattleBackdrop.test.ts`.

### T6-art: paid art (one sub-tranche, sequential checkpoints)

See §3. **Owns:** `assets-src/gen/{kits.yaml,characters.yaml}`, `assets-src/gen/approved/{overworld/ruins,castle/vault,vendor_f,farmer,burgher}/*`, the matching `assets-src/gen/cache/<key>.{png,json}`, `cache/ledger.jsonl`, `.gitignore` exceptions, `assets/sprites/characters-ai.{png,json}` (`field_ai` stage). It touches no map source.

### T6h: art wiring (after T6-art and wave 1 merge)

#### OW-8: the temple icon
- **Fix (`overworld.py:513`):** `prefab: temple_grand` (the new 2x2 parts `temple_grand_{r}_{c}`), with `collide: alpha` and the door on cell 1 as now. `TEMPLE_DOOR` and the arrival are unchanged.
- **Test:** `overworldLayout.test.ts`: the temple prefab's art covers ≥ 85 % of its 2x2 footprint's width and height (read from `approved/overworld/ruins.json` `prop_px`); `warp_leaves`, `art_coverage` and `act1Flow`'s temple reachability pass.
- **Browser:** `?mute=1&scenario=act1_overworld`: walk to the temple and enter. Plus `build_map.py --preview overworld --scale 0.25`: the temple is readable at overview scale.

#### OW-9: the broken bridge (art only)
- **Fix:** a `BROKEN_BRIDGE` list in `overworld.py`: the 2x2 `bridge_gap` deco on the two gap rows (x 29–30, y 30–31), drawn on water (`on_water`); the cells stay water.
- **Map unchanged:** `BRIDGE_BUILT` stays unset in act 1 and nothing opens. A comment records the `FIX_PLAN` T6 note: the future bridge cutscene needs a built variant of the span (the gap cells become bridge in collision and art, e.g. a flag-gated map variant), and that variant must drop `BROKEN_BRIDGE`.
- **Test:** `overworldLayout.test.ts`: the four gap cells are still water in the compiled collision; the `BRIDGE_BUILT` gates are unchanged; `north_shore` still can't be reached (`act1Flow`).
- **Browser:** `?mute=1&scenario=act1_overworld`: walk to the bridge foot (29,33); both stubs end in splinters, debris lies in the gap, and the gate message is unchanged.

#### CA-1: the stair art
- **Fix (`layouts/common.py` `stairs_down`):** use the new top-down `stairwell_{0,1}_{0,1}` parts. CA-1's walkable-row fix and the transitions are unchanged. The old `stairs_down_*` parts and their `furnish.json` `paint` entry stay; that sheet is not modified.
- **Test:** `castleStairs.test.ts` green; a new case: every `stairs_down` deco uses `stairwell_*`.
- **Browser:** `?mute=1&scenario=t5_castle` and `act1_castle`: the stairwells read top-down, with no black corner, and descend on the first step.

#### CA-7 props and the townsfolk sprites
- **Fix:** `castle.py` places `gold_heap`, `crown_cushion`, `lectern` and `map_table` from `castle/vault`. `cornelia.py` needs nothing: T6b already uses `vendor_f`, `farmer` and `burgher`, which now resolve to 2x art.

**T6h owns:** `layouts/{overworld,common,castle}.py`, `tests/data/{overworldLayout,castleStairs,castleLayout}.test.ts`. It runs alone, after wave 1, so no file is shared.

---

### 3. Paid art (T6-art)

**Budget:** `budget.json`: cap 100 Gemini images; 18 used (ledger: 87 Gemini attempts − `attempts_before` 69); `max_attempts_per_sheet` 3. Bedrock is not counted, but these are Gemini sheets (triage).

**Checkpoint procedure** (each sheet; one paid request per checkpoint):
1. Add the entry (`kits.yaml` / `characters.yaml`).
2. `generate.py <id> --backend gemini --sheets <sheet> --seeds 1234 --dry-run`; check the prompt and the `_input*.png`: exactly 1 paid request.
3. `… --paid` (`--max-paid 1`, the default), then review `out/gemini/<id>/1234/review.png` (raw, 2x in-game, 4x).
4. Before any retry, offline fixes: `--repixelize`, `source` crop boxes, `key_tol`, `paint` ops for kits; `--flip`, `head_from` for field sheets.
5. A retry is a new seed with `--retry --seeds 1235` (then 1236), at most 2 per sheet. A failed attempt counts.
6. On approval: `approve.py <id> <sheet>`; commit the cut sheet, json, cache entry and ledger. Run `python3 -I assets-src/gen/selftest.py` (from the main checkout; it needs `refs/`).
7. Rebuild: `build_assets.py field_ai` for sprites; kit parts take effect at the T6h map compile.

Approval runs under the act-1 unattended rule (self-approve, ≤ 2 retries per sheet); the review screenshots go into the T6 report.

### Checkpoint 1: `overworld/ruins` (OW-8 + OW-9)
- **Spec:** `kind: swatches`, `seed: 1234`, `refs: [overworld/landmarks, overworld/city, temple/relics]`, `aspect: "1:1"`, `guide: [1024, 1024]`, `tile_px: 200`, `gap_px: 24`, `margin_px: 56`, `labels: absolute`, `scale: pitch`.
- **Swatches:**
  - `temple_grand`: at [0,0], 2x2 tiles, `fill: true`, `key_border: true`, `key_tol: 45`, `wrap: prop`, parts `[[temple_grand_0_0, temple_grand_0_1], [temple_grand_1_0, temple_grand_1_1]]`.
    > "a world-map icon of an ancient ruined temple of evil seen from above at a three-quarter angle, filling the whole box: a stepped dark grey-blue stone temple on a broad cracked stone platform, two tall broken columns flanking the front, a crumbling peaked roof with a dark spire, a wide black arched doorway in the middle of the front edge at the bottom, a faint purple glow from the doorway and two small braziers with purple flames, a little green moss and ivy; nothing outside the platform."
  - `bridge_gap`: at [2,0], 2x2 tiles, `key_border: true`, `key_tol: 45`, `wrap: prop`, parts `[[bridge_gap_0_0, bridge_gap_0_1], [bridge_gap_1_0, bridge_gap_1_1]]`.
    > "the gap in a collapsed wooden bridge seen from straight above, on a plain magenta background: along the top edge and along the bottom edge, the snapped ends of brown wooden deck planks (laid top to bottom) stick out with jagged splintered tips and one plank hanging loose; four broken wooden piling stumps stand in the gap; a few loose planks and a coil of rope float in the middle; the middle of the box is empty background (open water will show through)."
- **Specs to meet:** ≤ 32 colours on the 15-bit grid; light from the top left.
  - `temple_grand` `prop_px` ≥ 82x82 of 96x96 native (it was 57x56); the doorway is centred, ≥ 16 native px wide, with ≥ 16 px over the door cell (the right bottom cell).
  - `bridge_gap` plank colours within ΔE 12 of the `bridge_v` deck material, and ≥ 50 % transparent.
- **Approval criteria:**
  - the temple is clearly a dark, sinister ruin, distinct from the city icon, mountains and forest, and readable in `--preview overworld --scale 0.25` (second-pass note);
  - its outline matches the city and castle icons;
  - no grass plate, and the alpha edge is clean (no magenta fringe);
  - the bridge pieces read as snapped and impassable: no continuous deck across the gap;
  - the overworld compile passes `art_coverage`, `warp_leaves` and the reachability checks.

### Checkpoint 2: `castle/vault` (CA-1 + CA-7 props)
- **Spec:** as the existing `castle/furnish` (`kind: swatches`, `seed: 1234`, `refs: [castle/furnish, castle/props, interior/furniture]`, 1:1, 1024 guide, tile 200, gap 24, margin 56, `labels: absolute`, `scale: pitch`).
- **Swatches:**
  - `stairwell`: [0,0], 2x2, `fill: true`, `key_border: true`, parts `stairwell_{0,1}_{0,1}`.
    > "a square stairwell opening in a polished cream marble floor seen from STRAIGHT ABOVE (top-down, not at an angle): pale stone steps descend from the top edge toward the bottom edge, each step a horizontal band, getting darker step by step until the bottom quarter is in deep shadow; a low carved pale stone kerb runs along the left, right and bottom sides; the top edge is open where the first step starts; no side walls visible; it fills the box."
  - `map_table`: [2,0], 2x1, `key_border: true`, `wrap: prop`, parts `[[map_table_l, map_table_r]]`.
    > "a heavy dark wooden war table seen from the front in three-quarter view, with a large parchment map of a coastline spread on top, two candles and a dagger pinning the map, as wide as the box."
  - `gold_heap`: [2,1], 1x1.
    > "a heap of gold coins with a few red and blue gems on a stone floor."
  - `crown_cushion`: [3,1], 1x1.
    > "a golden crown resting on a red velvet cushion on a short carved stone pedestal."
  - `lectern`: [0,2], 1x1.
    > "a carved dark wooden lectern holding a large open book."
  - `globe`: [1,2], 1x1.
    > "a world globe in brass on a wooden stand."
- **Specs to meet:** ≤ 32 colours; `stairwell` fill ≥ 0.95, all 4 cells opaque or cleanly keyed (no black corner, the CA-1 complaint); the top edge's mean luma within 10 % of the `marble` material, so it meets the floor without a seam. Props use `scale: pitch` and stand on the bottom of their boxes.
- **Approval criteria:**
  - the stairwell is plainly top-down (no oblique side walls) and plainly goes down, starting at the top edge;
  - the props match `castle/props` and `castle/furnish` (outline, light, saturation);
  - the stairwell reads in the 1F treasury, on 2F and in the tower (the tower floor is wood: a stone kerb on wood is acceptable).

### Checkpoints 3–5: townsfolk field sprites (CT-9 / UI-2)
- **Spec:** `characters.yaml` NPC entries (`sheets: [field]`, `field_gear: empty hands, arms at the sides`, `seeds: [1234]`); the house-style reference is sent automatically.
  - `vendor_f` (`robed: true`): "stout middle-aged market woman with rosy cheeks, green headscarf, brown knitted shawl over a mustard-yellow dress, white apron, brown shoes".
  - `farmer`: "sun-tanned farmer with a wide straw hat, short brown beard, sleeveless olive tunic over a cream shirt, rolled brown trousers, brown boots".
  - `burgher`: "well-to-do townsman with a neat grey moustache, plum-purple doublet with a white ruff collar, black trousers, short black cape, black cap with a white feather, black shoes".
- **Specs to meet (`ART_ROLLOUT.md` acceptance):**
  - field figure height 82–92 rows, the feet row matching the knight's;
  - an outline and ≤ 14 colours;
  - correct facing (a mirrored side row is allowed with `--flip left`);
  - the walk frames visibly differ;
  - a readable face in every front and side frame;
  - no mannequin parts and no stray props.
- **Approval criteria:**
  - each is distinct in silhouette and hue from `villager`, `villager_f`, `merchant` and `old_man` at 2x (side by side in the review);
  - `python3 -I assets-src/gen/puppet.py review <id>` shows clean walk in-betweens;
  - `build_assets.py field_ai` lists the three ids.

### Image count

| Checkpoint | Sheet | Images (no retry) | Max (2 retries) |
|---|---|---|---|
| 1 | `overworld/kit_ruins` | 1 | 3 |
| 2 | `castle/kit_vault` | 1 | 3 |
| 3 | `vendor_f/field` | 1 | 3 |
| 4 | `farmer/field` | 1 | 3 |
| 5 | `burgher/field` | 1 | 3 |
| **Total** | | **5** | **15** |

- **Expected:** 5–8 images (T3–T5 history: kit sheets mostly first-try; the gap sheet's transparent middle is the likeliest retry).
- **After T6:** 23–26 of 100 used in the expected case, and at most 33.
- **Not budgeted:** a sitting-King frame (user decision 7; it would add 1–3).

---

### 4. Sub-tranches and order

| # | Items | Owns (files) | Depends on |
|---|---|---|---|
| T6-0 | the shared contract | `src/types/index.ts`, `src/core/schemaValidation.ts`, `src/scenes/exploration/BattleBackdrop.ts` (extraction), the `ExplorationScene` call site, `assets-src/tools/kit.py` (`_PARTS`) | none; commit on `t6-integration` first |
| T6a | overworld.py and map_checks splits, BA-12 / TF-3 map keys | §2 T6a | T6-0 |
| T6b | interiors.py split, IN-4, CT-9, UI-2 (data and legacy looks) | §2 T6b | T6-0 |
| T6c | CA-3 (per decision), CA-4, CA-5, CA-6, CA-7 (layout and chests), TF-1 | §2 T6c | T6-0 |
| T6d | MS-7 (menu, panel, Status, Config), UI-1, CA-2 | §2 T6d | T6-0 |
| T6e | BA-8, BA-9, enemy list, active hero | §2 T6e | T6-0 |
| T6f | ShopScene split, MS-7 descriptions, Equip and Items, magic shop | §2 T6f | T6-0 (`ItemData.description`) |
| T6g | TF-3 staging and the temple pick, BA-12 runtime | §2 T6g | T6-0 (`BattleBackdrop.ts`, `zones` type) |
| T6-art | 5 paid checkpoints | §2 T6-art | none (sequential inside) |
| T6h | OW-8, OW-9, CA-1 art, CA-7 props wiring | §2 T6h | T6-art, T6a, T6c merged |

**No file is shared between sub-tranches of a wave.**
- T6d alone edits `ExplorationScene.ts` after T6-0. T6g edits only `BattleBackdrop.ts`.
- T6-0 owns `kit.py`; T6a owns `map_checks*.py`; T6d owns only `build_map.py`'s transition stamping.
- T6b and T6c both regenerate Cornelia/castle `assets-src/maps/*`. By the T3 rule, generated sources and compiled output are rebuilt on the integration branch.
- T6h runs after wave 1 and edits files that T6a and T6c owned (`overworld.py`, `castle.py`), plus `common.py`, which nobody else edits.

**Order:**
1. T6-0 on `t6-integration`.
2. **Wave 1:** T6a–T6g in parallel worktrees from `t6-integration`. T6-art runs at the same time, sequentially through its 5 checkpoints.
3. Merge T6a, T6b, T6c, T6d, T6e, T6f, T6g, then T6-art.
4. **Wave 2:** T6h from the merged head.
5. **Integration:** run the layout scripts by name (`overworld.py`, `cornelia.py`, `interiors.py`, `castle.py`), then `build_map.py` for every map; a second run gives no diff (`git diff --exit-code assets-src/maps assets/maps/ai`). Then `build_assets.py field_ai characters`.

**Validation:**
- `npm run build`, `npm test`, `npx vitest run tests/data tests/balance` (balance unchanged and green);
- `python3 -I assets-src/tools/build_map.py --selftest` and `--check-determinism`;
- `python3 -I assets-src/gen/selftest.py` (main checkout);
- `map_report.py cornelia cornelia-castle cornelia-castle-2f cornelia-castle-tower cornelia-castle-cellar temple-of-fiends overworld`;
- the browser checks above, 0 console errors;
- file sizes: the four split files and their parts are < 250 lines;
- `AGENTS.md`: drop `ShopScene.ts`, `layouts/overworld.py`, `layouts/interiors.py` and `map_checks.py` from the monitored list; record the 21 new background ids, the `effect` transition field, `battleBackgrounds.zones`, `ItemData.description`, and the new sheets;
- a T6 result section in `docs/FIX_PLAN_PENINSULA.md`.

**Process:** as before: momus reviews this plan, then the implementation, before the commit.

---

### 5. Decisions for the user

1. **CA-3 (stair alignment):**
   - (a) accept the classic FF1 layout (you enter the throne room at its foot) and record it as won't-fix. **Recommended.**
   - (b) rebuild 2F with a north stair landing. This changes the approach to the King.
2. **Config** in the field menu does nothing:
   - remove it (**planned**);
   - or build a small Config scene (message speed, battle message speed).
3. **TF-3 temple background:** the orchestrator stages `evil_temple` and `abandoned_castle`, compares them on the stage and picks one, then reports both screenshots. Swapping later is a one-line change. The old palace hall stays as `fiend_hall`.
4. **New townsfolk:** three (`vendor_f`, `farmer`, `burgher`); each extra one costs 1–3 images.
5. **Backgrounds in git:** all 21 staged images are committed (about 9–10 MB), as the triage implies. The alternative is to commit only the act-1 ones and stage the rest when those acts are built.
6. **Treasury loot (CA-7):** a Cabin and a Phoenix Down in the treasury, an Ether in the cellar (**planned**); or name others. This does not affect `tests/balance` (the sims don't open chests).
7. **CA-5:** the King stands on the throne's seat cell. There is no sitting pose (as in FF1). A seated King field sheet would cost 1–3 extra images.

### Decisions (orchestrator defaults, reported to the user)
1. **CA-3:** keep the classic layout where the 1F and 2F stairs don't line up. Recorded as won't-fix with the reason (the throne sits at 2F's north end).
2. **Config:** remove the menu item that does nothing; there are no settings yet.
3. **TF-3:** compare `evil-temple` and `abandoned-castle` on the battle stage, choose one, and keep both screenshots for the user.
4. **Townsfolk:** three new sprites.
5. **Backgrounds in git:** commit only the backgrounds act 1 uses. The rest stay staged locally (gitignored, or not staged).
6. **Castle chest loot:** accept the plan (treasury: Cabin and Phoenix Down; cellar: Ether).
7. **The King** stands on the throne seat; no seated pose.

### Revisions after the momus review (binding)

All 22 momus issues apply. Resolutions:

1. **Backgrounds:** only the act-1 ids are committed: every id referenced by a map's `battleBackgrounds` or a debug scenario, plus the chosen temple background. T6g lists the committed ids. The coverage test covers only referenced ids. T6g writes no `.gitignore` rules; it just doesn't `git add` the other staged files.
2. **Ownership:**
   - `.gitignore` belongs to T6-art (`approve.py`);
   - `BattleFieldTargeting.ts` and its test belong to T6e (party-target highlight = the row in the new party panel);
   - `TextRenderer.ts` (a new `fontSize` option, wrapping by the measured char width) and `NESFont.ts` belong to T6e (outline = offset shadow copies, not stroke);
   - one `SLOT_LABELS` constant goes in T6-0 (`src/ui/labels.ts`).
3. **`overworld.py` split:** the constant and polyline tables (`LAND` … `ROADS`) also move to `overworld_consts.py`, so every file ends under 250 lines.
4. **BA-8 layout:**
   - the message window stays 120 px tall, with font 32 px and line height 36 (2 lines = 72 px, which fits inside the 24 px padding);
   - spell and item lists draw in the left (enemy-list) window at full width, not inside the command window;
   - the party panel is a new `src/scenes/battle/BattlePartyPanel.ts`;
   - `FIELD_TOP` is unchanged.
5. **CA-2:** the door-effect rule applies only to maps whose `kits` include `town` or `interior`. The overworld temple and other prefabs keep the fade (test that the temple transition has no effect). The legacy maps losing the shop zoom is accepted (dev only).
6. **OW-9:** the debris deco has `block: false` and `on_water: true`, and the gap cells stay WATER (test).
7. **T6a's background test** checks only files that exist today; T6g extends the keys and the test.
8. **Paid-art fallbacks:** after three failed attempts at a checkpoint:
   - OW-8 keeps `temple_icon`;
   - OW-9 adds no debris;
   - CA-1 keeps `stairs_down_*`;
   - CA-7 skips the new props;
   - each townsperson keeps the legacy look.

   Each T6h step is conditional on its sheet being approved, and the report flags any fallback used.
9. **T6-art environment and bookkeeping.**
   - T6-art runs in the main checkout (it needs the gitignored refs and `.env`), not in a worktree.
   - Every approval decision is logged in `docs/ACT1_LOG.md`. The ledger guard count is authoritative (18 used), and `ACT1_LOG.md` is corrected to match.
   - Sheet names: `overworld/kit_grand`, `castle/kit_stairs_lib`, `townsfolk_*`, with exact `generate.py` / `approve.py` commands.
   - After approval: `git diff --exit-code` on `assets-src/gen/approved/` excluding the new sheets, then `selftest.py`.
10. **Tests that change:**
    - `FieldMenuSaveEnabled.test.ts` (Save is now 5 down);
    - `tests/ui/FieldHUD.test.ts` (exists; update the child count);
    - `attackChoreography.test.ts` (`ATTACK_REACH`).
11. **CT-9 test:** limited to the `cornelia` map (the tavern barkeep keeps the merchant sprite).
12. **MS-7 layout:**
    - left pane x 24, width 360; party pane x 408, width 1488; row height 168 (4 rows);
    - show only charge levels with max > 0;
    - `Next: —` becomes `MAX` at `MAX_LEVEL`;
    - location from a new `ExplorationScene.getMapName()`;
    - the `HelpWindow` sits at the bottom (y 900, height 156) in Item, Equip and MagicShop, reusing `ItemMenuScene`'s `descWindow` slot.
13. **`temple_grand` door:** centred on the door cell, at least 24 px wide.
14. **CA-7 positions:**
    - in the treasury, chests at (35,24) and (37,24), a gold heap at (36,22), the crown on a table at (38,22), avoiding the stairwell and the existing props;
    - lecterns are placed only in T6c;
    - `globe` is placed in the library;
    - bookshelves use `on_wall` on the gallery's top row.
15. **TF-3:** T6g gives the full 21-entry id table (stem → snake_case, no renames). The chosen temple image is also staged under its own id. Only the new ids are re-encoded.
16. **`map_checks` split:** `_unreachable`, `_touches`, `_cells` and `_is_int` go to `map_checks/util.py`. The façade re-exports everything `map_report.py` and the selftest use.
17. **CA-3:** won't-fix, so the option (b) test and browser lines are dropped.
18. **BA-9:** the clamp covers `classic` too. The target bounds are the `AiEnemyView` sprite's `getBounds()` at 2x.
19. **BA-12:** the browser check reads the backdrop chosen at the player's cell via `browser_evaluate` (beach and forest edge), not a random encounter.
20. **UI-1:** add an inn screenshot with 0 G; the inn box and the HUD panels must not overlap.
21. **Validation** includes `npx vitest run tests/balance`.
22. **Line references** corrected as momus listed.

---

### T6 result

**Commits on `t6-integration`:**

| Part | Commit | What |
|---|---|---|
| T6-0 | `5394f3d` | the shared contract |
| T6a | `e1c0252` | the overworld and map-check splits, BA-12 map keys |
| T6b | `8c2671d`, `00e45b3` | the interiors split, IN-4, CT-9, UI-2 (vendor_f / farmer / burgher) |
| T6c | `0a85b61` | CA-4, CA-5, CA-6, CA-7 (rooms and chests), TF-1; CA-3 won't-fix |
| T6d | `6c56547` | MS-7 field menu and party panel, UI-1 HUD panels, CA-2 door effect |
| T6e | `c3dd16d` | BA-8 battle text, party panel, 9-enemy list, active hero; BA-9 reach and contact-frame miss |
| T6f | `4fcef24` | ShopScene split, item descriptions, help bar, Equip preview, magic-shop learners |
| T6g | `aaa43ab` | 21 staged backgrounds; the temple uses `evil_temple`; zone-aware backdrop lookup |
| T6-art | branch `t6-art` | the paid sheets (budget 25 of 100) |
| T6h | `1424e80` | the art fitted into the maps |

Integration fixes: a seeded defeat-flow test (`9520c50`), and the review fixes below.

**Fallbacks and won't-fix:**
- **OW-8:** keeps `temple_icon`. The `temple_grand` door failed revision 13 on all 3 attempts, and at 0.25 scale the temple at (14,37) still can't be picked out. This stays open for the second pass.
- **CA-3:** won't-fix; the 1F and 2F stairs keep the classic layout.
- **Sheet names:** §2 T6h's `ruins.json` / `vault.json` are really `overworld/grand.json` / `castle/stairs_lib.json`.

**Accepted deviations (momus):**
- the bridge gap is 49 % transparent;
- `vendor_f`'s back-frame shawl flickers;
- the door rule reads only the first kit;
- the reach overlap is 24 px;
- the extra files `shopLists.ts` and `spellLearners.ts`;
- `fiend_hall` is a staging-only entry;
- `evil_temple` is committed both as itself and as `temple`;
- `potion_shelf` stands in for the wine racks;
- the seeded defeat-flow test.

**Carried to the second pass:**
- the bridge debris is brown wood next to pale stone stubs; new stone debris, or wooden stubs, would match;
- the vendor_f flicker;
- OW-8 temple visibility.

**Browser checks** (`?mute=1`; screenshots in `/tmp/t6/`, background comparisons in `/tmp/t6/bg/`):
- **Temple background:** `t6_bg_evil_temple` and `t6_bg_abandoned_castle`. evil_temple is chosen.
- **BA-12 backdrops:** a beach cell at (58,7) gets `shoreline`; a forest-edge cell at (8,11) gets `forest`.
- **CA-2 transitions:** 16 Cornelia doors zoom, and the castle gate fades.
- **Field menu (MS-7):** party panel, gold, time, location and the help bar.
- **Battle:** 9 enemies show as "6x Goblin / 3x Wolf"; the compact HP panel; the active hero stays visible.
- **Castle 1F:** the treasury chest gives a Cabin; the stairwell is top-down.
- **Signpost:** has text.
- **Magic shop:** the description and "Learn: WM RM".
- **Inn at 0 G:** the message box and HUD panels don't overlap.
- **Temple:** the top corners are stone.
- **Console:** 0 errors.

## Final phase (after T6): second adversarial pass (requested by the user, 2026-11-14)

1. **Start from New Game** and run a full adversarial playtest of the introduction: Cornelia, the overworld, the Temple of Fiends, Garland, the princess rescue, and returning her to the King. Probe edge cases and anything awkward or unusual to a modern RPG player.
2. **Document** every finding in a new issue file, `docs/PLAYTEST_PENINSULA_2_<date>.md`.
3. **Plan** a fix for each issue; momus validates the plan.
4. **Implement** the fixes, validating each through tests and real gameplay in the browser, and commit tranche by tranche.

## R: Second-pass remediation

**Base:** `mainline` at `b202acd` (T6 merged, plus the second-playtest doc). All file:line references are to that commit.

**Inputs:**
- `docs/PLAYTEST_PENINSULA_2_2026-11-14.md`: 75 items (2 M, 33 m, 40 p) and its binding "Triage defaults" (B1's tougher Garland with talk-to-fight and a 3-wide trigger; every M and m fixed, cheap p items fixed; paid art only within budget; T2 warps the party to Cornelia Castle after the princess speaks);
- the evidence in `/tmp/playtest2/{browser,town,overworld,systems}/`, including the throwaway tests `reentry-race`, `transition-control`, `battle-edges` and `inventory-cap` (`systems/`) and `enc.test.ts` (`overworld/`);
- research sims for this plan in `/tmp/r-plan/` (Garland, temple, pacing, route encounters, the shoreline composite prototype).

**Rules (as T1–T6):**
- Edit generators and sources, never `assets/maps/ai/**` by hand; the integration branch rebuilds every map once after the last merge, and a second run gives no diff.
- Every code fix gets a test that fails on the old code.
- Browser checks use `http://127.0.0.1:5173/?mute=1&…` (never without `mute=1`), with 0 console errors; close the page and stop the dev server afterwards. Below, `?mute=1&scenario=<id>` is short for `http://127.0.0.1:5173/?mute=1&scenario=<id>`. Battle scenarios start from **Debug** on the title. Until S6 lands, a debug battle softlocks at its end, so reload between tries.
- Paid art follows `docs/ART_ROLLOUT.md` "Per-checkpoint procedure" (dry run, one paid request per checkpoint, at most 2 retries per sheet, approved sheets never modified).
- Files stay under 250 lines (the monitored exceptions must not grow: `ExplorationScene.ts` 601, `BattleScene.ts` 594, `BattleStateMachine.ts` 592; `PartyCreationScene.ts` is 291 and is split in R3).

---

### 1. Coverage

| Items | Sub-tranche |
|---|---|
| S1, S2, S3, S6, I1, I2, I3 (field and menus), M12, T2 (`warp` step), E10 (sprite), W4 (counter), and the runtime halves of T1, B1 (talk), E1 (chests), N2 (`backdrop`) | R1 |
| B1 (stats, phase), B2–B14, I3 (battle SFX) | R2 |
| E1–E9, E10 (cursor), N1, S4, S5, N2 (opening runtime) | R3 |
| T2 (cutscene data), T3–T6, M1–M10, M13, N2 (text), W15 | R4a |
| T1 (data), M11, W1–W14, B1 (map), B9 (rate and table) | R4b |
| W1 (art), W8 / W15 (paid fallbacks), M7 (gates and signs sheet) | R5 |

All 75 items are covered. S4 and S5 move to R3 because both touch `SaveScene.ts`; W15 moves to R4a because R4a already rebuilds `characters-ai` and owns `gen/selftest.py` (M6). Won't-fix or deferred: the temple's size (W13, FF1 parity), new act-1 species (W5), the `river`, `swamp` and `waterfall` backdrops (same flaw as B14; recorded).

---

### 2. Shared contract (R0, one commit on `r-integration` before any branch)

So that no two sub-tranches edit the same file, these land first. Tests and build pass; no behaviour change except where noted.

1. **`src/systems/CutsceneManager.ts` (types only):** export `CutsceneWarp = { map: string; entrance?: string; x?: number; y?: number; facing?: 'up' | 'down' | 'left' | 'right' }`; `CutsceneStep.type` adds `'warp' | 'backdrop'`, with the optional `map`, `entrance`, `x`, `y`, `facing` and `image?: string | null`. A warp needs `map` and either `entrance` or both `x` and `y`. Update the step list in the `cutscenes.yaml` header comment (line 3).
2. **`src/types/index.ts:352`:** `KeyItemGate.message: string | ConditionalDialog[]` (T1); `schemaValidation.ts` accepts either.
3. **`src/types/index.ts:254-262`:** `ScriptedEncounter.npc?: string` ("talking to this NPC on the same map starts the encounter", B1); `validateMapData` (`schemaValidation.ts:176`) checks it is a string naming an `npcs[].id` of that map.
4. **`src/entities/Inventory.ts`:** `static readonly MAX_QUANTITY = 99`, `space(id)`, `canAdd(id, qty = 1)`; `add` returns the number actually added (E1; no caller breaks). Test in `tests/entities/Inventory.test.ts`. R3 owns the file afterwards.
5. **Save summary (S5):** `SaveData.location?: string` (`types/index.ts:370-380`); `SaveManager.save(…, playTime, location?)` writes it (`SAVE_VERSION` stays 1); `SlotSummary` gains `location` (`data.location ?? mapIdLabel(data.currentMap)`, title-casing the `-`-split words and upper-casing `/^\d+f$|^b\d$/`), `members: Array<{ name; classId; level; currentHp }>` and `gold`; `level`, `partyLeader` and `saveDate` stay. Tests: `SaveManager.test.ts` (new fields), `SaveCompatT4.test.ts` (an old save gives `location === 'Cornelia'`).
6. **`src/types/index.ts:62-66` `BossPhase`:** `hits?: number; attack?: number` (overrides applied when the phase is crossed, B1); `validateEnemyData` (`schemaValidation.ts:104-119`) checks `bossPhases` entries (number `hpThreshold` in (0, 1], string `patternId`, optional string `message`, optional numbers `hits`, `attack`).
7. **Map pipeline:** `build_map.py` `RECOLOR` (`:219`) adds `"pale_stone": (10, 0.45, 1.45)` (R4b tunes it) and `"bright": (0, 1.0, 1.2)`. `kit.py` `_PARTS` gets placeholders for `temple_ruin_{0,1}_{0,1}`, `temple_ruin3_{0,1}_{0,1,2}`, `bridge_gap_stone_{0,1}_{0,1}`, `gate_arch_3_{0,1}_{0..2}`, `gate_arch_2_{0,1}_{0,1}`, `gate_side_{0,1}_{0,1}`, `sign_tavern`, `sign_shrine`, so the map tranches compile before the art lands.
8. **`src/core/EventBus.ts` `GameEvents`:** `partyHealed: Record<string, never>` (T2).
9. **`src/ui/Menu.ts`:** `setActive(active: boolean)` and `get isActive`; an inactive menu draws its ▶ grey (0x808080) and skips `update()` (E3). R1 owns the file afterwards (I2).
10. **`src/ui/uiSounds.ts` (new):** `setUiEventBus(bus)` / `uiEventBus()`; nothing calls it yet. R1 wires `Menu` and `Game.init`; R3 wires `NameEntryGrid` (I3).
11. **`src/systems/DebugScenarioLoader.ts`:** `flags?: string[]` (set right after `resetState()`) and `party[].status?: string[]` (applied with `statusTracker.apply`). R1 owns the file afterwards.
12. **`src/systems/ItemEffects.ts:113, 130`:** present tense, "recovers N HP" and "is revived" (B4); update `src/systems/__tests__/ItemEffects.test.ts:103, 106-113` and `tests/scenes/ItemMenuScene.test.ts:91`.
13. **`assets/data/debug-scenarios.yaml`:** every new scenario below, plus the comment at `:236-237` (`t4_garland_l1_naked`: "240 HP Garland: no gear never wins"). `DebugScenarioField.test.ts:47` checks that field spawns are walkable; scenarios whose spawn depends on a map change (`r_garland`, `r_temple_garland`) are re-checked after the integration rebuild. "Start kit", "full kit" and the parties are the existing `t4_*` lines.

| id | mode | map / spawn or entrance | party, items, flags | used by |
|---|---|---|---|---|
| `r_garland` | field | `temple-of-fiends` [11,7] | the four `t4_garland_l3_full` lines at Lv 20, `potion: 3` | T2, B1 |
| `r_temple_garland` | field | `temple-of-fiends` [11,8] | `t4_garland_l2_start` party, `potion: 3` | B1 |
| `r_temple_party` | field | `temple-of-fiends`, entrance `entry` | as above | B9 |
| `r_garland_l2_full` | battle | `background: temple` | `t4_garland_l3_full` at Lv 2, `potion: 3`; `[garland]` | B1 |
| `r_one_potion` | battle | grassland | `t4_fields_l1` party at Lv 2, FGHTR hp 10, THIEF hp 8; `potion: 1`; 2 goblins | B5 |
| `r_same_names` | battle | grassland | warrior, thief, white_mage, black_mage Lv 2, all named ROLF; 3 wolves | B6 |
| `r_temple_pack` | battle | temple | `t4_garland_l2_start` party, `potion: 2`; 4 skeletons | B9 |
| `r_heal_fog` | battle | grassland | FGHTR hp 1, THIEF hp 24, W.MAG with `cure`, `fog`, B.MAG; 3 wolves | B4 |
| `r_mute_dark` | battle | temple | Lv 5; W.MAG `cure`, `mute`; B.MAG `fire`, `dark`; lich (`enemyAi`: ice) + wolf | B8 |
| `r_shoreline_nine` | battle | `shoreline` | `t4_nine` party; 6 goblins, 3 wolves | B14 |
| `r_cap` | field | `cornelia-item-shop`, `door` | FGHTR Lv 3 with a rapier; `potion: 99, antidote: 95, rapier: 99`; 5000 G | E1 |
| `r_cap_chest` | field | `cornelia-house-fisher`, `door` | FGHTR; `potion: 99` | E1 |
| `r_shops` | field | `cornelia-weapon-shop`, `door` | warrior, thief, W.MAG, B.MAG Lv 2 (no Monk); `wooden_shield: 2, rapier: 2, chain_mail: 1, potion: 2`; 2000 G | E2, E3, E5 |
| `r_magic` | field | `cornelia-white-magic`, `door` | W.MAG knows `cure`; R.MAG with three L1 spells; FGHTR; 3000 G | E4 |
| `r_tent` | field | `overworld`, `cornelia` | hurt party (THIEF hp 0); `potion: 3, tent: 2, cabin: 1, phoenix_down: 1, rapier: 1, lute: 1` | E6, E7 |
| `r_menus` | field | `cornelia`, `inn` | warrior Lv 4 (iron sword, chain mail, shield, cap), unarmoured Monk Lv 5, W.MAG with `status: [poison]`, B.MAG | E8, E9, E10, S4, S5 |
| `r_castle_rescued` | field | `cornelia-castle-2f` [21,10] | `act1_castle` party; flags GARLAND_DEFEATED, PRINCESS_RESCUED | T4, T6 |
| `r_castle_after_intro` | field | `cornelia-castle`, `gate` | + GOT_LUTE, INTRO_COMPLETE | T6 |
| `r_castle_1f_gallery` | field | `cornelia-castle` [28,4] | `act1_castle` party | M2 |
| `r_town_rescued` | field | `cornelia`, `castle` | the rescued flags | T5, T6, M1, M7, M9 |
| `r_town_after_intro` | field | `cornelia`, `castle` | all four flags | T5 |
| `r_overworld_after_intro` | field | `overworld`, `cornelia_north` | all four flags | T1 |
| `r_item_shop`, `r_black_magic`, `r_weapon_shop`, `r_inn`, `r_shrine`, `r_house_fisher`, `r_house_farm`, `r_house_knight` | field | each interior, `door` | `act1_castle` party | M3–M10, T6 |
| `r_cellar`, `r_tower` | field | `cornelia-castle-cellar`, `cornelia-castle-tower`, `stairs` | `act1_castle` party | M6, M9, M10, M13 |
| `r_ow_temple`, `r_ow_bridge`, `r_ow_east` | field | `overworld` [15,42], [29,34], [48,46] | warrior Lv 9 (iron sword, chain mail) | W1, W5, W7, W8, W11, W12, W14 |

---
### R1: engine, scenes, input, audio

**Size rule first.** `ExplorationScene.ts` is 601 lines (a monitored exception) and R1 must not grow it. The first R1 commit moves `executeTransition` and `zoomTransition` (`:438-491`) into `src/scenes/exploration/FieldTransition.ts`, and the player construction in `loadMap` (`:247-262`) into `src/scenes/exploration/FieldPlayer.ts` (`createFieldPlayer(game, placeholders, collisionMap, x, y, facing?)`). Existing tests pass unchanged after that commit. This frees about 70 lines for S1/S2, T2 and E10.

#### S1: Load and Continue put you on a stale tile
- **Root cause:**
  - `SceneManager.switchTo` makes the next scene current and adds it to the stage before `await next.enter()` (`SceneManager.ts:55-58`); `push` does the same (`:70-73`).
  - The ticker's `scenes.update()` (`:93-95`, from `Game.ts:92`) therefore runs the reused `ExplorationScene` while `enter()` is still loading (`ExplorationScene.ts:148-155`).
  - `resetForEnter()` (`:129-144`) keeps the previous map's `this.player`, and `update()` writes its tile into `game.playerPosition` (`:340`).
  - `enter()` then trusts the overwritten value in `safeSpawn(map, this.game.playerPosition)` (`:160`).
- **Fix:**
  - `SceneManager` keeps `private transitions = 0`. `switchTo`, `push` and `pop` increment it before their first `await` and decrement it in a `finally`; `update()` returns while it is > 0. No scene is updated until its `enter()` has resolved (only `ExplorationScene.enter` is async today).
  - In the scene: a `private loading` flag, set in `resetForEnter()` and cleared at the end of `enter()` just before `fadeInOnEnter()`; `update()` returns while it is set. `resetForEnter()` also sets `this.player = null`.
- **Test:**
  - `tests/scenes/ExplorationReentry.test.ts` (new): port `/tmp/playtest2/systems/reentry-race.test.ts` case 1, typed with `createMockGame` and a real `EventBus` (no `as any`). Hold `data.loadMap` on a deferred, call `scene.update(1)` once, release; `playerPosition` equals the saved (2,3). Old code gives (7,7).
  - `tests/core/SceneManager.test.ts`: "update is not forwarded while enter() is pending" (a scene whose `enter` awaits a deferred). Old code forwards it.
- **Browser:**
  - `?mute=1&scenario=act1_castle`: Menu > Save > slot 1 on the arrival tile, walk 6 tiles, Menu > Load > slot 1. The hero stands on the saved tile.
  - Reload `http://127.0.0.1:5173/?mute=1`, Title > Continue > slot 1: the same tile. 0 console errors.

#### S2: Input is live while the field loads or a transition runs
- **Root cause:**
  - The cancel check (`ExplorationScene.ts:310-313`) runs before `if (!this.player) return` (`:314`), and nothing gates it during `enter()`.
  - `executeTransition` (`:438-455`) sets no busy state; only the zoom path pauses, and only for the zoom frames (`:459`, `:490`).
  - During `fadeOut(300)` → `loadMap` → `fadeIn(300)`, `update()` keeps calling `player.update()`: the hero walks on the old map, each move emits `playerMove` (so encounters can fire), and cancel still pushes `fieldMenu`.
- **Fix:** the load half is S1's gate plus `loading`. `FieldTransition.run()` sets a `transitioning` flag in a `try/finally` around the whole fade-load-fade and calls `encounterSystem.stop()` / `start()` around it. `update()` returns early while `loading || transitioning || cutsceneRunning`; one `fieldBusy` getter replaces the separate check at `:297`.
- **Test:** `tests/scenes/ExplorationScene.test.ts`, ported from `/tmp/playtest2/systems/transition-control.test.ts`. Stub `requestAnimationFrame` so the fade never finishes; hold up from (5,6) onto the warp at (5,5) for 40 frames: `playerPosition` stays (5,5) (old code reaches (5,3)). Press cancel: `scenes.push('fieldMenu')` is not called (old code calls it). Also port `reentry-race.test.ts` case 2 (cancel during the first `enter()`).
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: hold Up into the inn door and press X repeatedly during the fade; the menu doesn't open and the hero arrives on the inn's `door` tile. Repeat at the overworld city gate with `?mute=1&scenario=act1_overworld`.

#### S3: A double confirm while a lazy scene loads opens it twice
- **Root cause:** `SceneManager.resolve` (`:28-38`) awaits `factory()` and caches only the finished scene (`:36`), so two calls in flight build two instances. During the await the title is still updated, and `TitleScene.onSelect` (`TitleScene.ts:72-88`) has no guard; the Debug entry (`:77-86`) can start two loaders.
- **Fix:** `resolve` caches the pending promise (`private pending = new Map<string, Promise<Scene>>()`, removed on settle, so a rejected load can be retried). S1's `transitions` gate stops the title seeing the second confirm. `TitleScene` gets `private starting = false`, set in `onSelect`, reset in `enter()` and `onResume()`.
- **Test:** `SceneManager.test.ts`: two `switchTo('a')` in flight with a deferred factory call the factory once and `enter` once (old: twice). `tests/scenes/TitleScene.test.ts`: confirm on two consecutive updates → `scenes.switchTo` once (old: twice).
- **Browser:** `http://127.0.0.1:5173/?mute=1`: press Z twice fast on New Game, and in a second run on Debug. Party creation opens once; one battle is pushed (stack depth 1 via `__game.scenes`).

#### S6: Debug battle scenarios softlock at the end of the battle (dev only)
- **Root cause:** `DebugScenarioLoader.applyAndBattle` (`DebugScenarioLoader.ts:68-72`) builds a throwaway `BattleTrigger` and pushes the battle over the title. `BattleScene` emits `battleEnd` (`BattleScene.ts:561`), but only `ExplorationScene` subscribes (`ExplorationScene.ts:141`), and it was never entered, so nothing pops the battle.
- **Fix:** `applyAndBattle` subscribes a one-shot `battleEnd` handler before `triggerBattle`; it unsubscribes itself and calls `trigger.onBattleEnd(data)`. Victory or escape → `pop()` to the title; defeat → `switchTo('gameover')` (`captureBattleSnapshot` returns null without a map, so Game Over offers Load and Title only). `TitleScene.onResume()` resets `starting` and plays the title track (I3).
- **Test:** `tests/systems/DebugScenarioBattle.test.ts` (new; fake game as in `DebugScenarioField.test.ts`, real `EventBus`, `BattleTrigger.prototype.triggerBattle` spied): victory → one `scenes.pop`; a second `battleEnd` → no second pop; defeat → `switchTo('gameover')`. Old code calls nothing.
- **Browser:** `?mute=1&scenario=ai_monsters_small`: Title > Debug, win; back on the title, the menu moves, and Debug starts a second battle. `?mute=1&scenario=t4_garland_l1_naked`: lose → Game Over → Title.

#### I1: Keys stick after the window loses focus
- **Root cause:** `InputManager.attach` (`InputManager.ts:36-39`) listens only to `keydown`/`keyup`. A key held while focus leaves never gets its `keyup`, stays in `currentKeys` (`:85`), and `isPressed` (`:54-58`) keeps the hero walking.
- **Fix:** a private `releaseAll()` clears `currentKeys`, `previousKeys` and `pressedThisFrame`. `attach` adds `window` `blur` and `document` `visibilitychange` (when `document.hidden`) → `releaseAll`; `detach` removes both.
- **Test:** `tests/core/InputManager.test.ts`: keydown `ArrowRight`, dispatch `blur` → `isPressed('right')` false; the same with `visibilitychange` while hidden. Old code returns true.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: Playwright `keyboard.down('ArrowRight')`, then `page.evaluate(() => window.dispatchEvent(new Event('blur')))`: the hero stops within one tile.

#### I2: Menu auto-repeat, cancel closes dialogs, "more" marker
- **Root cause:** `Menu.update` (`Menu.ts:101-118`) moves only on `isJustPressed`, and OS key repeat is ignored on purpose (`InputManager.ts:86`). `DialogBox.update` (`DialogBox.ts:54-67`) reacts only to confirm. There is no "more" glyph, and `DialogManager` (`DialogManager.ts:18-42`) never tells the box that more follows.
- **Fix:**
  - **Menu:** per-direction `holdFrames`; a just-press moves and resets; while `input.isPressed?.(dir)` holds, repeat after `REPEAT_DELAY_FRAMES = 20`, then every `REPEAT_EVERY_FRAMES = 5`. A repeat stops at the list ends; only a fresh press wraps. The parameter type is `Pick<InputManager, 'isJustPressed'> & Partial<Pick<InputManager, 'isPressed'>>`, so mocks without `isPressed` (`tests/ui/Menu.test.ts`, the BattleScene tests) just never repeat.
  - **DialogBox:** cancel acts like confirm (finish the reveal, next page, close). `show(text, more = false)` adds a blinking ▼ `BitmapText` at the bottom right (local, in the style of `battleMessageUtils.ts:147-155`; no import from `scenes/battle`) while the page is revealed and another page follows or `more` is set.
  - **DialogManager:** `start` and `advance` pass `more = dialogIndex < lines.length - 1 || queue.length > 0`.
- **Test:** `tests/ui/Menu.test.ts`: hold down 1 + 20 + 5 frames → `selectedIndex` 2 (old: 1); a held repeat on the last item doesn't wrap. `tests/ui/DialogBox.test.ts`: cancel on a revealed last page calls `onComplete` (old: no); the marker shows on page 1 of 2, not on the last. `tests/systems/DialogManager.test.ts`: `start(['a', 'b'])` → marker on 'a', not on 'b'.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: talk to a multi-line NPC (▼ blinks; X advances and closes). Hold Down in the field menu: the cursor runs after a short delay and stops at Load.

#### I3 (non-battle half): the title track and menu cursor sounds
- **Root cause:**
  - `title` is in `audio-manifest.json` but never played: the only `playMusic` callers are `GameOverScene.ts:22`, `BattleScene.ts:87, 542` and `ExplorationScene.ts:552`; `TitleScene.enter` (`:19-64`) and `onResume` (`:91`) are silent.
  - Cursor sounds come only from a `Menu` given an `eventBus` (`Menu.ts:104-115`). These are built without one: `FieldMenuScene.ts:56`, `FieldOrderScene.ts:36`, `EquipScene.ts:81, 98, 119`, `FieldMagicScene.ts:72, 108, 155`, `ItemMenuScene.ts:60, 77`.
  - `Game.ts:121-128` (`setupAudioEvents`) already subscribes `battleHit`, `battleMiss`, `spellCast`; R2 emits them.
- **Fix:**
  - New `src/ui/uiSounds.ts` (`setUiEventBus(bus)` / `uiEventBus()`); `Menu` and `NameEntryGrid.ts:86-101` use `config.eventBus ?? uiEventBus()`. `Game.init` (not the constructor, so unit tests stay silent) calls `setUiEventBus(this.events)`. One fix in `ui/`, no edits to R3's scenes.
  - `TitleScene.enter` and `onResume` call `game.audio.playMusic('title')` with `.catch` → `console.error`; the same-track check (`AudioManager.ts:77`) makes a resume a no-op.
  - `setupAudioEvents` moves into a pure `src/core/audioEvents.ts` (`wireAudioEvents(events, audio)`, the event→SFX table, plus `partyHealed` for T2).
  - While there: `AudioManager.ts:33, 111, 113` are comment-only catches (AGENTS.md); make them `console.debug`.
- **Test:** `tests/ui/Menu.test.ts`: after `setUiEventBus(bus)`, a Menu without `eventBus` emits `cursorMove` (old: the module doesn't exist). `tests/scenes/TitleScene.test.ts`: `enter()` → `playMusic('title')`. `tests/core/audioEvents.test.ts`: each event plays its SFX id.
- **Browser:** audio stays off (`?mute=1`). In `?mute=1&scenario=t5_cornelia_field`, wrap `__game.audio.playSFX` / `playMusic` with console loggers: the arrows in Items, Magic, Equip and Order log `cursor-move`. In `?mute=1&scenario=ai_monsters_small` (wrap first): Debug → win → the title logs `music title`.

#### T2 (engine half): the `warp` cutscene step and a heal signal
- **Root cause:** `CutsceneStep.type` (`CutsceneManager.ts:6`) cannot change maps. `garland_defeated` (`cutscenes.yaml:6-21`) only fades and narrates, so the party stays in the temple with encounters on (`ExplorationScene.ts:187-202`; host in `ExplorationCutscenes.ts:10-17, 20-37`). `heal_party` (`CutsceneManager.ts:75-80`) is silent. The step switch has no `default` (`:45-81`) and `CutsceneRegistry.init` (`:9-18`) validates nothing, so a misspelt step is skipped silently.
- **Fix:**
  - The step shape is R0-1. `CutsceneDeps` gains `warp?: (w: CutsceneWarp) => Promise<void>` and `onHeal?: () => void`. A `default:` branch logs `Unknown cutscene step`; `CutsceneRegistry.init` logs and drops scripts with unknown types or malformed warps.
  - `ExplorationScene.warpTo(w)` runs under `cutsceneRunning`, behind the fade: `await loadMap(w.map)` (map id, music, encounters and NPCs with current flags), the position from the named entrance or `{x, y}`, `player.setPosition` and a new `PlayerController.face(dir)` (wraps `animation.setDirection`, `SpriteAnimation.ts:68`), then `game.playerPosition`, camera and tilemap.
  - `onHeal` emits `partyHealed`; `audioEvents` maps it to SFX `heal` (synthesised in R4; fallback `spell-cast`). The visible signal is a data line after the heal (R4b's cutscene data).
- **Test:** `tests/systems/CutsceneManager.test.ts`: a warp step calls `deps.warp` in order between the fades; `heal_party` calls `onHeal`; an unknown type logs `console.error` (old code fails all three). `tests/scenes/ExplorationReentry.test.ts`: a script `[set_flag PRINCESS_RESCUED, warp {map: cornelia-castle-2f, entrance: throne_return, facing: up}]` leaves `currentMapId === 'cornelia-castle-2f'` on the entrance (old: still the temple).
- **Browser:** `?mute=1&scenario=r_garland`: talk to Garland and win. The princess's line, the fade, the heal line; the party stands in the throne room facing the King, the HUD says "Cornelia Castle 2F"; talking to the King plays `act1_complete`.

#### E10 (field half): the field sprite keeps the old leader after a reorder
- **Root cause:** the leader's art is chosen only when `loadMap` builds the player (`ExplorationScene.ts:249-256`); `onResume` (`:555-565`) never checks it.
- **Fix:** `FieldPlayer` records `leaderClassId`. On resume, if `game.party.get(0)?.classData.id` differs, rebuild the player with `createFieldPlayer` on the same tile, facing and movement mode, swap the sprite in `worldContainer`, and call `camera.follow` and `npcInteraction.setPlayer` again. (FieldOrderScene's cursor is R3's half.)
- **Test:** `tests/scenes/ExplorationScene.test.ts`: spy `PlaceholderTextures.prototype.getPlayerArt`; enter with leader `warrior`, make the leader `white_mage`, `onPause()` + `onResume()` → the spy is called with `'white_mage'` and the grid position is kept. Old code: not called.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: Menu > Order, swap FGHTR and W.MAG, close: the white mage leads at once.

#### W4 (code half): the encounter counter restarts on every map load
- **Root cause:** `loadMap` calls `encounterSystem.setRate(mapData.encounterRate)` (`ExplorationScene.ts:237`), and `setRate` always calls `resetCounter()` (`EncounterSystem.ts:27-30, 97-103`). Interiors use `{999, 999}` (e.g. `assets/maps/ai/cornelia-inn.yaml:28`), the overworld `{15, 30}`, the temple `{8, 15}`. Each door re-rolls a full countdown, so short trips never meet a fight.
- **Fix:** `setRate(rate)` stores the rate and only clamps the running countdown to the new map's scaled maximum: `stepCounter = min(stepCounter, max(1, round(rate.max / rateMultiplier)))`. Interiors (999) leave it alone. The counter still resets after a battle (`:83`); a new public `restart()` is called from `enter()` so Load, Retry and New Game roll fresh. The data half (rates, routes) is R4b.
- **Test:** `tests/systems/EncounterSystem.test.ts`, "a running countdown survives map loads" (rng → 0): `setRate({15, 30})` → 15; 5 moves → 10; `setRate({999, 999})` → 10; `setRate({8, 15})` → 10; `setRate({2, 5})` → 5. Old code gives 999 at the second step.
- **Browser (smoke):** `?mute=1&scenario=act1_overworld`: walk 10 steps, enter Cornelia and leave, walk on: a battle comes within 20 more steps (3 runs).

#### M12: the HUD party bar covers the hero and the exit near a room's bottom
- **Root cause:** the strip spans y 984–1056 (`FieldHUD.ts:46-47`, `HUD_PANEL_HEIGHT` 72 at `:11`), but the camera centres on the full 1080 px view (`Camera.ts:46-61`) and clamps to the full map (`:75-78`). The inn (12x11) puts its arrival (6,9) on the strip's top edge and the exit row (6,10) fully under it (`cornelia-inn.yaml:13, 25`; `56_inn.png`); in the temple (22 rows) the entry (11,20) is at 888–984 and the exits (11|12, 21) are under it.
- **Fix:** `Camera.setViewInsets({ bottom })`: the usable height is `VIEWPORT_HEIGHT − bottom`; `update` centres in the usable band, `clampAxis(y)` allows `[0, mapH − usable]`, and a shorter map is centred inside it. `FieldHUD` exports `HUD_BOTTOM_BAND = HUD_PANEL_HEIGHT + 2 * SCREEN_MARGIN` (120); `ExplorationScene` sets it in the constructor. The usable 960 px is exactly 10 tiles. Default inset 0, so existing `Camera` tests stay valid.
- **Test:** `tests/rendering/Camera.test.ts`: `setMapBounds(12, 11)`, `setViewInsets({ bottom: 120 })`, target on row 10 → the row's screen bottom ≤ `VIEWPORT_HEIGHT − 120` (old code has no method and draws the row under the band); a room shorter than the band is centred in it. `tests/ui/FieldHUD.test.ts`: the strip top ≥ `GAME_HEIGHT − HUD_BOTTOM_BAND`.
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: enter the inn, stand on (6,9): the hero and the exit mat are above the strip. `?mute=1&scenario=act1_temple` (arrives at (11,20)): the exit row is visible.

#### Cross-tranche runtime pieces that live in R1's files
- **T1 (gate message):** `KeyItemGateSystem.check()` (`KeyItemGateSystem.ts:38-40`) resolves `message` with `resolveNPCDialog(message, f => flags.has(f))` when it is a `ConditionalDialog[]` (R0-2). Test: `tests/systems/KeyItemGateSystem.test.ts`: with INTRO_COMPLETE set the message changes (old: the type doesn't allow it, the string is fixed). Browser: see T1 in R4b.
- **B1 (talk to fight):** in the talk branch (`ExplorationScene.ts:365-378`), if a due scripted encounter (same rule as `getScriptedEncounterAt`, `:493-506`: flag unset, `requiredFlag` met) has `npc === npc.id` (R0-3), set `pendingNpcAction`; `handleNpcPostDialog` (`:414-437`) then calls `triggerScriptedEncounter(enc)`. Test: `tests/scenes/ExplorationScene.test.ts`: talking to an NPC named by a due encounter starts that battle after the dialog closes; once the flag is set it doesn't (old: nothing starts). Browser: see B1 in R4b.
- **E1 (chests and gifts at the cap):** at `ExplorationScene.ts:352-371`, check `inventory.canAdd(item)` (R0-4) before `add`. With no room: "You found <name>, but you can't carry any more.", and neither `chestFlag`/`giftFlag` nor `setOpened()` is set. Test in `ExplorationScene.test.ts` (old: the flag is set and the item lost). Browser: `?mute=1&scenario=r_cap_chest`.
- **N2 (`backdrop` step):** `CutsceneManager` dispatches `backdrop` to an optional `deps.backdrop?(image: string | null)` (R0-1); a host without it logs once and skips. R3's `OpeningSequence.ts` supplies it.

**R1 owns:** `src/core/{SceneManager,InputManager,Game,AudioManager,audioEvents}.ts`; `src/ui/{Menu,DialogBox,FieldHUD,NameEntryGrid,uiSounds}.ts`; `src/rendering/Camera.ts`; `src/entities/PlayerController.ts` (`face()` only); `src/scenes/{ExplorationScene,TitleScene}.ts`, `src/scenes/exploration/{ExplorationCutscenes,FieldTransition,FieldPlayer}.ts`; `src/systems/{DialogManager,CutsceneManager,CutsceneRegistry,EncounterSystem,DebugScenarioLoader,KeyItemGateSystem}.ts`; and the tests `tests/core/{SceneManager,InputManager,audioEvents}`, `tests/ui/{Menu,DialogBox,FieldHUD}`, `tests/rendering/Camera`, `tests/systems/{EncounterSystem,CutsceneManager,CutsceneRegistry,DialogManager,DebugScenarioBattle,KeyItemGateSystem}`, `tests/scenes/{ExplorationReentry,ExplorationScene,TitleScene,Act1Blockers}`.

### R2: battle

The balance numbers below come from throwaway sims that run the real `BattleStateMachine` and `tests/helpers` (`runBattle`, `makeParty`, `rollFormation`) with the `tests/balance/*` seed formulas (400 seeds), with the proposed rules patched in. Browser checks start from **Debug** on the title. Until S6 lands, a debug battle softlocks at its end, so reload between tries.

#### B1: Garland's stats and his "attacks grow fiercer" phase (map half: R4b)
- **Root cause:**
  - `assets/data/enemies.yaml:221-243` is FF1's Garland (hp 106, attack 15, hits 1), per T4 revision 1.
  - The phase (`:239-242`) only prints a message. `BattleStateMachine.checkBossPhaseTransition` (`BattleStateMachine.ts:513-537`) swaps a pattern only for enemies with an AI, and Garland has none.
  - Hits come from the shared data only (`CombatStats.enemyHits(data)`, `CombatStats.ts:113-115`, from `PhysicalAttack.ts:32`), so there is no per-battle override.
- **Fix:**
  - **Data:** hp 240, attack 16, hits 2, no weakness; xp 130 and gold 250 stay.
  - **Phase:** `bossPhases: [{ hpThreshold: 0.25, patternId: aggressive, message: "Garland's attacks grow fiercer!", hits: 3 }]`, so at ≤ 25 % HP (60) he goes from 2 hits to 3.
  - **Where it lives:** `checkBossPhaseTransition` applies the optional `hits` / `attack` of a crossed phase through `enemy.buffs` (hits as the difference from the base). `enemyHits` takes an `EnemyInstance` and adds `buffs.get('hits')`; `enemyAttack` already reads `buffs.get('attack')` (`CombatStats.ts:105-107`). Shared data is never mutated and no RNG draw is added. The type and schema are R0-6.
  - **Why 3 hits at ≤ 25 %:** it beat "attack +2 at ≤ 50 %" and "+3/+4" in the sims: it shows in the log ("(3 hits)") and leaves the most margin on the temple-run case.
- **Test:**
  - `tests/battle/BossPhase.test.ts`: `:37-50` hp 106 → 240 and the threshold HP 53 → 60; `:52-57` 54 → 61; `:59-79` ("identical damage events") becomes "events are identical with and without `bossPhases` until the phase round; after it some Garland lines read '(3 hits)', never before". This fails on the old code (no 3-hit line).
  - `tests/battle/CombatStats.test.ts:124-128`: `enemyHits` takes an instance; a `hits` buff of +1 gives 3.
  - `tests/data/actOneBalance.test.ts:86-93`: 106/15/1 → 240/16/2, phase `hits: 3` at 0.25.
  - `tests/balance/garland.test.ts`: see "Balance bounds" below.
- **Browser:**
  - `?mute=1&scenario=t4_garland_l2_start`: Fight only loses at least 2 of 3 tries.
  - `?mute=1&scenario=r_garland_l2_full`: sensible play (CURE below half, LIT, RUSE) wins at least 2 of 3 in 4+ rounds. "Garland's attacks grow fiercer!" shows once, at ≤ 60 HP, and some later lines read "(3 hits)".
  - `?mute=1&scenario=t4_garland_l3_full`: 3 of 3.

#### B2: a retargeted attack announces the dead target and animates at the wrong enemy
- **Root cause:** `peekNextAction` names the queued `cmd.targetId` even when it is dead (`BattleStateMachine.ts:351-359`). The retarget happens later in `executeCommand`: party at `:442-448` (`retargetIfDead`, `BattleCommands.ts:23-36`), enemies at `:437-439` (`retargetEnemyTarget`, `EnemyAI.ts:136-142`), single-target spells at `SpellExecutor.ts:66-73`. The view finds the sprite by name, falling back to the first living enemy (`BattleAnimationController.ts:216-224`); the reach (`:116`) and the Miss float (`:196`) use it.
- **Fix:** a private `resolveTarget(action)` retargets once and writes the result into the queued command; `peekNextAction` and `executeNextAction` both call it (the second is a no-op). It covers Fight on both sides and a party single-target spell at an enemy; `SpellExecutor`'s copy becomes a guard. `NextActionInfo` gets `targetId`, and `findTargetSprite` uses `findActorSprite(targetId)` (`:62-68`), with no name lookup. Side effect: the retarget draw moves to the peek, which shifts seeded balance numbers by 1–2 points (re-measure; the bounds leave margin).
- **Test:** new `tests/battle/Retarget.test.ts` (from `/tmp/playtest2/systems/battle-edges.test.ts`): 4 Warriors Fight `enemy_0` against 3 Goblins; every peeked `targetName`/`targetId` is alive and matches the "hits X" line. Old: the second attacker announces "Goblin A". `tests/scenes/battle/meleeContact.test.ts`: a peek with `targetId: 'enemy_1'` puts the reach and the Miss on `enemySprites[1]`.
- **Browser:** `?mute=1&scenario=t4_fields_l1`: all four Fight the same goblin; after it dies, the next announcement names a living goblin, and the lunge and number land on it.

#### B3: spells are announced twice, first by id; items say "uses item!"
- **Root cause:** `spellName = cmd.spellId` (`BattleStateMachine.ts:361-363`), formatted at `BattleAnimationController.ts:72`; the first result line repeats "casts FIRE!" (`SpellExecutor.ts:94`, shown at `BattleAnimationController.ts:203`); items announce "uses item!" (`:73`).
- **Fix:** `peekNextAction` sets `spellName` to the spell's `name` and adds `itemName` (from `ItemRegistry`): "X uses Potion!". `executeAction` drops a result line identical to the announcement. The state machine's log keeps "casts FIRE!" (the balance tests and `formatConciseResult` read it).
- **Test:** new `tests/scenes/battle/BattleAnimationController.test.ts`: FIRE gives ["B.MAG casts FIRE!", "Goblin takes N damage!"]; a Potion is "W.MAG uses Potion!". Old: "casts fire!" + "casts FIRE!"; "uses item!".
- **Browser:** `?mute=1&scenario=t4_fields_l1`: FIRE is announced once; a Potion is named.

#### B4: heal and buff messages
- **Root cause:** heals report the raw roll while the HP setter clamps (`SpellExecutor.ts:132, 147-148`; clamp `Character.ts:58`); the fallen-target line uses the target as subject ("<target> has no effect on the fallen!", `:143`); a buff on an ally who fell is filtered out silently (`:213-219`) after the charge is spent (`:89`); items say "recovered N HP" / "was revived" (`ItemEffects.ts:113, 130`).
- **Fix:** the heal line and float report the HP actually restored (after − before); a full-HP target reads "<name>'s HP is full!". A single-ally spell (not a revive) at a fallen ally spends no charge and says "<name> has fallen. No effect!" (checked before `useCharge`). Every battle line is present tense: items "recovers N HP!" / "is revived!" (the `ItemEffects.ts` wording is R0-13; `executeItemCommand`, `BattleStateMachine.ts:494-506`, adds the "!"). `battleMessageUtils.ts:77, 102-104` keeps matching both forms.
- **Test:** `tests/battle/SpellExecutor.test.ts`: CURE on a member 2 below max → "recovers 2 HP!" and event damage 2 (old: 16–32); FOG on an ally at 0 HP leaves charges unchanged with a "has fallen" line (old: charge spent, no line). `battleMessageUtils.test.ts` for the concise forms.
- **Browser:** `?mute=1&scenario=r_heal_fog`: CURE on FGHTR at max − 1 → "recovers 1 HP!"; FOG on FGHTR (hp 1, three wolves) until he falls first → "FGHTR has fallen. No effect!", and the L1 charge is still there.

#### B5: two members can queue the same last item
- **Root cause:** the battle item list counts the inventory only (`BattleScene.ts:380-389`, `ItemSelectionUI.ts:45-47, 91-95`), ignoring commands queued this round; the second use fails at `ItemEffects.ts:64`.
- **Fix:** `BattleStateMachine.reservedItems(itemId)` counts queued item commands (undo pops the command, releasing the reservation). `ItemSelectionUI` takes `quantityOf?: (id) => number`; `BattleScene` passes inventory − reserved; items at 0 are not listed, and an empty list gives the existing "No items available." notice. Also fix the no-target fallback that passes `targetName` as the target id (`BattleScene.ts:389`). Move `showSpellUI` / `showItemUI` (`:302-429`) into `src/scenes/battle/BattleListMenus.ts` (`BattleScene.ts` is 594 lines).
- **Test:** `tests/scenes/BattleScene.test.ts`: with 1 Potion, member 0 queues it and member 1's list doesn't offer it; after undo it is offered again (old: offered). `tests/ui/ItemSelectionUI.test.ts`: `quantityOf` drives the label and the filter.
- **Browser:** `?mute=1&scenario=r_one_potion`: FGHTR > Item > Potion > THIEF; THIEF's Item shows "No items available."; cancel back to FGHTR: the Potion is offered again.

#### B6: enemy attack animations find the hero by name
- **Root cause:** `BattleAnimationController.ts:225` (`allParty.findIndex(c => c.name === info.targetName)`).
- **Fix:** with B2, the sprite comes from `targetId`.
- **Test:** `meleeContact.test.ts`-style: two members named "ROLF"; an attack on `party_1` flashes `partySprites[1]` (old: index 0).
- **Browser:** `?mute=1&scenario=r_same_names`: over a few rounds each wolf hit flashes the hero whose HP row dropped.

#### B7: turn order is a strict agility sort, with RNG in the comparator
- **Root cause:** `TurnOrder.ts:7-15` sorts by agility and breaks ties with `rng() - 0.5` inside `sort` (`:13`); called at `BattleStateMachine.ts:268-272`.
- **Fix (decision R-2):** one key per combatant before sorting, `key = agility × (1 + rng())`: n draws per round and no RNG in the comparator. A Warrior (agility 5) acts before a Goblin (6) about 27 % of the time (today 0 %). Gaps of 2x or more stay fixed, so the "agility 30 goes first" tests hold.
- **Test:** `tests/battle/TurnOrder.test.ts`: `:17-28` becomes "the RNG is called exactly n times per call"; new: over 2,000 seeded calls, agility 5 precedes agility 6 in 20–35 % (old: 0 %). Audit the fixed `seq([...])` RNGs in `BattleStateMachine.test.ts`, `SpellExecutor.test.ts`, `StatusEffects.test.ts` (they now consume n draws first).
- **Browser:** `?mute=1&scenario=t4_fields_l1`: over 5 rounds FGHTR acts before a goblin at least once.

#### B8: blind and silence have no effect
- **Root cause:** `SpellExecutor.ts:81-90` has no silence check (the comment at `:88` predates `Character.statusTracker`, `Character.ts:27`); the physical hit roll reads only helpless (`DamageFormula.ts:59`, `PhysicalAttack.ts:13-23, 27-38`); blind is never read.
- **Fix:** FF1 blind: −40 on the hit roll for a blind attacker, +40 against a blind defender (`blind?: boolean` on `PhysicalAttacker` / `PhysicalDefender`, filled from `status.has('blind')`). Silence: a silenced caster (either side) spends no charge and loses the turn ("<name> is silenced!"); the party Magic command shows a "Silenced." notice via `showNotice` (`BattleScene.ts:262`).
- **Test:** new `tests/battle/BlindSilence.test.ts`: on the hit-roll border, a blind attacker misses where a sighted one hits, and a blind target is hit where a sighted one is missed; a silenced Black Mage's FIRE leaves charges and enemy HP unchanged; a silenced `enemyAi` caster doesn't cast. All fail today.
- **Browser:** `?mute=1&scenario=r_mute_dark`: MUTE on the lich → next turn "silenced", no ice; DARK on the wolf → it misses more (qualitative).

#### B9 (battle half): temple packs and the Thief's escape (tables and rate: R4b)
- **Root cause:**
  - **Escape:** `calculateRunChance = luck / (level + 16)` (`BattleCommands.ts:38-44`, used at `BattleStateMachine.ts:407-416`). Thief luck is 15 + 3 per level (`classes.yaml:33, 40`): 88 % at Lv1 and **100 % from Lv2** (18/18). Hence 8 of 8.
  - **Packs:** skeleton stats match FF1's BONE (`enemies.yaml:75-94`) and stay. A typical temple battle is mild (Lv2, 400 G kit, Fight only: 12.6 % HP lost, someone falls in 3.8 %). The damage is attrition plus the outlier formation `skeleton 4–6` (`assets/maps/ai/temple-of-fiends.yaml:83-85`): 32 % HP at Lv2, and at Lv1 someone falls in 56 % of those battles. At the rate 8–15 (`:68`), eight battles in a row at Lv2 (sensible, no inn) wipe 19 % of runs.
- **Fix (R2):** `calculateRunChance(luck, level, livingEnemies) = max(0, min(0.75, luck / (level + 16)) − 0.05 × (livingEnemies − 1))`, with `RUN_CAP` and `PACK_PENALTY` constants. Thief vs 1: 75 %; Thief vs 3: 65 % at any level (8/8 escapes: 3.2 %); Warrior vs 3: 19 % at Lv1, 23 % at Lv2; W.MAG vs 3 at Lv2: 40 %. Garland stays `canRun: false`. Skeleton stats unchanged. R4b's data targets are in "Balance bounds".
- **Test:** `tests/battle/BattleCommands.test.ts:53-67`: `(15, 1, 1)` 15/17 → 0.75; `(18, 2, 3)` 1 → 0.65; `(6, 2, 3)` 6/18 → 0.233; `(99, 1, 1)` 1 → 0.75; `(0, 1, 1)` 0 → 0. `BattleOutcome.test.ts`: the state machine passes the living-enemy count (a roll of 0.70 fails against 3 enemies, succeeds against 1).
- **Browser:** `?mute=1&scenario=r_temple_pack`: the Thief runs, the others Fight; 8 tries → about 5 escapes, not 8. The 4-skeleton pack costs HP but nobody falls from full.

#### B10: ally targeting is unclear
- **Root cause:** the HP panel lights the active and the targeted member the same way (`lit = i === active || i === targeted`, `BattlePartyPanel.ts:100-108`); the active hero's arrow stays up (`ActiveHeroMarker.ts:38`) beside the white target arrow (`BattleFieldTargeting.ts:94-108`); targeting starts at index 0 (`BattleFieldTargeting.ts:32`).
- **Fix:** while targeting, only the target row has ▶ (blinking, yellow); the active row keeps a blue name tint (`0x88ccff`); `ActiveHeroMarker` hides its arrow and the target arrow turns yellow. `enterFieldTargeting(..., initialId?)`: healing items and heal spells start on the most-hurt living member (lowest HP/max), revives on the first fallen, everything else at 0.
- **Test:** `tests/scenes/battle/BattleFieldTargeting.test.ts`: members at 35/35, 12/25, 25/25, 25/25 → a Potion starts on index 1 (old: 0). New `tests/scenes/battle/BattlePartyPanel.test.ts`: `setActive(0); setTarget(2)` → a cursor on row 2 only (old: both).
- **Browser:** `?mute=1&scenario=t5_battle_items`: FGHTR > Item > Potion: the cursor starts on the most-hurt living member, with one ▶ and one yellow arrow.

#### B11: the melee lunge still stops about 250 px short
- **Root cause (to confirm first):** the reach is `homeX − targetBounds.right + 24` (`BattleAnimationController.ts:116, 229-234`; `attackChoreography.ts:21-25`). In `85_exec_3.png` THIEF attacks Gr.Imp B in the back-middle column (right edge about x 675) and stops about 255 px short, where the front-column goblin's edge would put him. So the reach was measured from another sprite; the leading suspect is the name lookup and first-living fallback in `findTargetSprite` (B2/B6). Not reproduced without the browser.
- **Fix:** land B2/B6 (target by id); then measure to the target's opaque right edge (cell right − (cell width − opaque right) from the monster frame data, `AiEnemyView.ts:39-48`, `monsters-ai.json`), independent of cell padding.
- **Test:** `meleeContact.test.ts` on real layout boxes (`computeEnemyLayoutAi` for 2 Gr.Imp + 2 Goblin, `PARTY_X[1]`), target in a back column: on the contact frame the attacker's opaque left edge is within 40 px of the target's opaque right edge.
- **Browser:** `?mute=1&scenario=t4_fields_l1&attack=classic`, then without `&attack`: attack a back-column enemy; the weapon overlaps it on contact.

#### B12: the turn list is hard to read
- **Root cause:** 16 px text (`FONT_SIZE_SM`, `LayoutConstants.ts:23`) on a 24 px pitch (`BattleAnimationController.ts:84-85, 98-104`); the pending line uses the raw lowercase type ("THIEF: fight", `:99`); the result line "Fight → 19 to Gr.Imp B…" is cut (`:205-210`, `fitTurnLine`).
- **Fix:** 24 px (`FONT_SIZE`) on a 32 px pitch (8 lines fit); one label table for both states (Fight / spell NAME / item name / Run); compact entries without the target: pending `THIEF Fight`, done `THIEF Fight 19` (`19*` kill, `Miss`, `+24`, `Asleep`, `Escaped`, `x3 57`). `fitTurnLine` stays as a guard.
- **Test:** `tests/scenes/battle/turnListFit.test.ts`: font ≥ 24; pending and done share casing; every sample (6-char name, "Gr.Imp B", crit, multi-target) fits the content width at 24 px. Old: 16 px, "fight" vs "Fight".
- **Browser:** `?mute=1&scenario=t4_fields_l1`: a round with Fight, FIRE and a Potion; every line readable, uncut, same casing.

#### B13: the bottom enemy row's feet touch the bottom strip
- **Root cause:** `ENEMY_AREA.y1 = 770` and `STAGE_FEET.max = 770` (`EnemyLayoutAi.ts:29, 31, 73`) against `STRIP_Y = 780` (`BattleSceneTypes.ts:49`); the party's last row is also at 770 (`BattleDisplayManager.ts:18`).
- **Fix:** `STAGE_FEET.max` and `ENEMY_AREA.y1` → 745; `PARTY_FEET_Y` → `[425, 530, 635, 740]`.
- **Test:** `tests/scenes/battle/battleStage.test.ts`: feet ≤ `STRIP_Y − 35` for every composition and the party (old: 770).
- **Browser:** `?mute=1&scenario=ai_monsters_nine` and `?mute=1&scenario=t4_nine`: at least 25 px of ground under the lowest feet, the B.MAG's included.

#### B14: beach battles put the enemies on open sea
- **Root cause:** `stage_backgrounds.py:42` stages `shoreline-hd.png` zoomed 1.12 and right-aligned for the party. The source (`~/temp/ffgame-assets/tiles/backgrounds/hd/shoreline-hd.png`, 1536x1024, local) has land only in its right ~37 %. On the committed `assets/backgrounds/shoreline.webp` the enemy feet band (x 80–1340, y 360–770) is **86 % water**, the party band 7 %. No zoom or alignment can put land under x 80–1340.
- **Fix (free; decision R-5):** an optional composite in `STAGES` for `shoreline`: the source mirrored, zoom 1.6 (over the screen-width scale), pasted at y −560, through a mask over x ≤ 1250, y ≥ 380, feathered 50 px. The result is a rocky cove: rock under the enemies, sea and mountains behind, the party's rocks unchanged. Prototype `/tmp/r-plan/proto_shore.py` (output `/tmp/r-plan/img/proto_1.6_1250_-560.png`): enemy band **15 % water** (the channel), party band 7 %; the mask starting at y 380 (not 330) removes the ghosting. Then `python3 -I assets-src/tools/stage_backgrounds.py shoreline`.
- **Test:** a new `stage_backgrounds.py --check shoreline`: water = b > r + 40 and b > g + 10; enemy band ≤ 15 %, party band ≤ 10 % (old file: 86 %). `assetCoverage.test.ts` (1920x1080) stays green.
- **Browser:** `?mute=1&scenario=r_shoreline_nine`: all nine enemies stand on rock. `?mute=1&scenario=act1_overworld`: walk the beach south of the city until a battle.
- **Note:** `river`, `swamp` and `waterfall` also put the enemies on water (recorded; decision R-5).

#### I3 (battle half): hit and miss SFX never emitted; the cast SFX plays on pick
- **Root cause:** `Game.ts:124-127` subscribes `battleHit`, `battleMiss`, `spellCast` (types `EventBus.ts:13-16`), but nothing emits the first two, and `spellCast` fires when the spell is picked (`BattleScene.ts:329, 348`). Target selection has no cursor sounds (`BattleFieldTargeting.ts:62-90`).
- **Fix:** `BattleAnimationController` gets an `emit(event)` callback from `BattleScene`. In `executeAction` (`:192-214`), on the contact frame: `battleHit` when a Fight dealt damage > 0; `battleMiss` when `result.missed`; `spellCast` when a spell was really cast (not silenced, not out of charges). Delete `BattleScene.ts:329, 348`. `BattleFieldTargeting` emits `cursorMove` / `cursorSelect` / `cursorCancel`.
- **Test:** `meleeContact.test.ts`: a hit emits `battleHit` once on contact, a miss `battleMiss` once. `BattleScene.test.ts` (spy `events.emit`): picking FIRE emits no `spellCast`, executing it exactly one. `BattleFieldTargeting.test.ts`: down emits `cursorMove`. All fail today.
- **Browser:** `?mute=1&scenario=t4_fields_l1` (audio off): wrap `__game.audio.playSFX` with a console logger; one `battle-hit` per damaging hit, `battle-miss` per miss, `spell-cast` at the cast, none at the pick.

**R2 owns:** `src/battle/**`, `src/scenes/BattleScene.ts`, `src/scenes/battle/**` (new `BattleListMenus.ts`), `src/ui/{ItemSelectionUI,SpellSelectionUI}.ts`, `assets/data/enemies.yaml`, `assets-src/tools/stage_backgrounds.py`, `assets/backgrounds/shoreline.webp`, and the tests `tests/battle/**`, `tests/scenes/battle/**`, `tests/scenes/BattleScene.test.ts`, `tests/ui/ItemSelectionUI.test.ts`, `tests/data/actOneBalance.test.ts`, `tests/balance/garland.test.ts`.

### R3: menus, shops, items, Save and Load screens

#### E1: items lost at the 99 cap (shop, unequip, chests)
- **Root cause:** `Inventory.add` (`src/entities/Inventory.ts:9-12`) clamps to 99, drops the rest silently and returns `void`; nothing can ask how much room is left.
  - `ShopScene.onItemSelect` caps the quantity only by gold, `Math.min(99, floor(gold / price))` (`ShopScene.ts:153`); `confirmTransaction` spends the gold and calls `add` (`:182-184`). At 99: "Bought 1 Potion.", nothing added (`/tmp/playtest2/systems/inventory-cap.test.ts`).
  - `EquipScene.onEquipSelect` unequips, then adds the old item (`EquipScene.ts:139-140`): with 99 in the bag, the worn copy disappears.
  - Chest and gift pickups call `add(..., 1)` and then set the flag (`ExplorationScene.ts:356-357, 368-369`): the chest shows opened and the item is gone. (R1's call site; uses R0-4.)
- **Fix:**
  - `Inventory` API (R0-4): `MAX_QUANTITY`, `space(id)`, `canAdd(id, qty = 1)`; `add` returns the number added.
  - `ShopScene`: the buy quantity is `min(99, floor(gold / price), inventory.space(id))`. With no room: "You can't carry any more <name>." on the result line, no quantity picker. The quantity and transaction logic moves into a pure `src/scenes/shop/shopTransaction.ts` (`maxBuyQty`, `buy`, `sell` returning `{ ok, message }`), keeping ShopScene (247 lines) under 250 after E2/E3/E5.
  - `EquipScene.onEquipSelect`: refuse to unequip when `prev` exists and `space(prev.id) < 1` (unless the new item is the same id); the stats window shows "No room for\n<prev name>." like "Can't equip" (`:136`).
- **Test:** `tests/entities/Inventory.test.ts`: at 97 potions, `space` 2, `add('potion', 5)` returns 2, `canAdd('potion', 3)` false (old: TypeError / `undefined`). `tests/scenes/ShopScene.test.ts` (real registries): 99 potions, 500 G, confirm Potion → no picker, gold 500, result "can't carry" (old: picker, gold taken); 95 potions, 600 G → `quantityMax` 4 (old: 10). `tests/scenes/EquipScene.test.ts`: 99 rapiers in the bag, "(Unequip)" leaves the rapier equipped (old: lost).
- **Browser:** `?mute=1&scenario=r_cap`: talk to the keeper, Buy > Potion → "can't carry", gold unchanged, no picker; Antidote (95 held) → the picker stops at 4. Menu > Equip > first member > Weapon > (Unequip) → "No room". Chests (after R1): `?mute=1&scenario=r_cap_chest`, open the chest: "can't carry any more", it stays closed, potions stay 99.

#### E2: shop columns misaligned; "Wooden Shieldx2"
- **Root cause:** buy rows use a fixed `name.padEnd(12)` (`src/scenes/shop/shopLists.ts:13`), so "Wooden Nunchaku" (15) pushes its price 3 columns right; sell rows pad to the longest name with no gap, `` `${name.padEnd(maxLen)}x${qty}` `` (`:23-26`); magic-shop rows have no columns (`MagicShopScene.ts:83`). The font is monospace (`NESFont.ts:21`), so padding is enough.
- **Fix:** `columns(cells)` in `shopLists.ts`; the name width is the longest name + 2. Buy: `Name  price G  Have N` (E5). Sell: `Name  xN  price G`. Magic: `Name  L1  100G`.
- **Test:** `ShopScene.test.ts`: in `cornelia_weapon`'s buy list every `G` is at the same index (old: 20 for Nunchaku, 17 for Knife); the sell list for `{wooden_shield: 2, rapier: 2}` has a row matching `/^Wooden Shield {2,}x2 /`. Update `MagicShopScene.test.ts:45-46` to the new format.
- **Browser:** `?mute=1&scenario=r_shops`: Buy and Sell screenshots; prices and counts in columns.

#### E3: unclear focus (Buy/Sell keeps its ▶; Equip shows three cursors; empty Equip help)
- **Root cause:** `Menu` always draws a white ▶ (`src/ui/Menu.ts:53-55`), with no inactive state. ShopScene keeps `choiceMenu` on screen while the list is active (`ShopScene.ts:88-97`); EquipScene keeps member, slot and item menus with white cursors (`EquipScene.ts:85, 102`; `43_equip_weapons.png`). The Equip help is `''` in the member phase (cleared at `:103`), on an empty slot (`:173-176`) and on "(Unequip)" (`:182-185`).
- **Fix:** with R0-3's `Menu.setActive(false)` (grey ▶, 0x808080), ShopScene and EquipScene grey the parent menu when focus moves down and restore it on the way back. Help text: member phase "Choose whose equipment to change."; empty slot "<Slot>: nothing equipped."; "(Unequip)" "Take off the <item>." or "The slot is already empty.".
- **Test:** `ShopScene.test.ts`: after Buy, `choiceActive` false; after cancel, true. `EquipScene.test.ts`: in the item phase only the item menu is active; the help is non-empty in all three cases. Old: no `isActive`, help `''`.
- **Browser:** `?mute=1&scenario=r_shops`: Buy → the Buy ▶ turns grey. Menu > Equip > member > Weapon: one white cursor, two grey, help text in every phase.

#### E4: the magic shop learning flow
- **Root cause:** after the member, a slot step lists three rows (a known spell or an unlabelled "---", `MagicShopScene.ts:162-191`, `:175`), and its `onSelect` ignores the row and calls `confirmPurchase()` (`:187`). `Character.learnSpell` stores spells in a Map with no slot index (`Character.ts:146-156`), so a slot can't be chosen at all (FF1 fills in order). "Known" is shown only in the member step (`:137-139`). The layout (`:50-69`) differs from ShopScene's.
- **Fix:** remove the slot step (`:157-191`): choosing the member buys the spell. Member rows read `NAME  L1 2/3`, with `(knows)` / `(full)` disabled. Spell rows get a `Known` column when every member who can learn it knows it. A shared `src/scenes/shop/shopLayout.ts` (gold, list and panel rectangles, also used by ShopScene) and a `SpellLearnPanel.ts` (one line per member: can learn / knows / full / n/a) replace `learnText`. The file goes from 236 to about 210 lines.
- **Test:** `MagicShopScene.test.ts`: W.MAG knows CURE → the CURE row shows `Known` and the panel `W.MAG  knows`; choosing a member with room buys with no third step (state back to `spells`, spell known, gold down); a member with 3 L1 spells is `(full)` and disabled; the list rectangle equals ShopScene's. Old: the slot state appears, nothing `Known`.
- **Browser:** `?mute=1&scenario=r_magic`: CURE shows Known; HARM > the full member is disabled; FOG for W.MAG takes two confirms. Screenshot beside `r_shops`.

#### E5: shops give little help (owned count, unusable gear, navy backdrop)
- **Root cause:** buy rows have no owned count (`shopLists.ts:13`); the help bar shows only the description (`ShopScene.ts:239`), with only the panel's grey `n/a` rows (`ShopDetailPanel.ts:71-73`) hinting that nobody can equip it; neither shop sets `transparent`, so `SceneManager.push` hides the field (`SceneManager.ts:66`) and the renderer's navy shows (InnScene sets `transparent = true`, `InnScene.ts:26`).
- **Fix:** a `Have N` column; for weapons and armour that nobody in the party can equip, the help reads "No one in your party can equip this. " + the description; both shop scenes set `readonly transparent = true`.
- **Test:** `ShopScene.test.ts`: 2 potions → the Potion row ends `Have  2`; a Warrior/Thief/W.MAG/B.MAG party on Wooden Nunchaku → "No one in your party" in `helpText`; both shop scenes are `transparent`. All fail on old code.
- **Browser:** `?mute=1&scenario=r_shops`: Buy, highlight Wooden Nunchaku → the warning; the town shows around the windows.

#### E6: the Tent heals silently
- **Root cause:** party items skip every prompt (`ItemMenuScene.ts:113-123`); the result goes into the shared help bar (`:122`), which the next cursor move overwrites (`:91`); `buildItemMenu()` rebuilds with the cursor at 0 (`:51-69`), so when the Tent stack runs out the bar describes another item (`149_tent_used.png`); no party HP is shown.
- **Fix:** a new `src/ui/ConfirmBox.ts` (prompt + Yes/No; SaveScene's overwrite prompt `SaveScene.ts:93-121` moves into it; Load reuses it). Tent and Cabin ask "Rest in the Tent? (HP and charges restored by half)" (wording from the item's real effect). On Yes, the result goes on a separate result line that stays until the next input (ShopScene's pattern, `ShopScene.ts:218-222`), and the always-visible party window (E7) shows the new HP.
- **Test:** `ItemMenuScene.test.ts`: on a camp map, confirming Tent shows the prompt and HP is unchanged (old: healed at once); Yes heals, the result line stays across one cursor move, the party labels show the new HP; No keeps the Tent. Update the existing camp test (`:43`) to press Yes.
- **Browser:** `?mute=1&scenario=r_tent`: Items > Tent: the prompt; Yes: the HP column rises and the message survives a cursor move.

#### E7: Field Item menu rough edges
- **Root cause:** the list is full width (`ItemMenuScene.ts:37`) and the target window is drawn over it at x 1000 (`:39`; `102_pd_target.png`); each rebuild resets the cursor (`:51-69`, called at `:121`, `:138`); only key items are disabled (`:56-57`), so weapons and armour reach "Cannot use this item" (`ItemEffects.ts:63`); the field menu's help promises sorting (`FieldMenuScene.ts:21`).
- **Fix:** two columns, always shown: the list (x 24–1000) and a party window (x 1016–1896) with HP and status; in the target phase the cursor moves into the party window. `buildItemMenu(keepIndex)` as `ShopScene.ts:115-116`. `enabled: item.type === 'consumable'`; a greyed weapon row's help says "Equip it from the Equip menu.". `FieldMenuScene.ts:21` → "Use the items you carry." (R3 owns this one line).
- **Test:** `ItemMenuScene.test.ts`: the list and party rectangles don't intersect; after a potion at row 2 (2+ left), `selectedIndex` stays 2; a `rapier` row is disabled. `FieldMenuScene.test.ts`: no help text contains "sort". Old: overlap, index 0, rapier enabled.
- **Browser:** `?mute=1&scenario=r_tent`: Items > Potion > a hurt member: the cursor stays on Potion, no overlap, Rapier grey.

#### E8: the Status screen is bare
- **Root cause:** one text block (`StatusScene.ts:37-41, 74-89`) fills about 30 % of the screen (`48_status.png`); left/right switch members (`:52-57`) with no hint; ailments are never shown (`partyRowData(char).status`, `PartyPanel.ts:33-35`, is unused here); `DEF` is `char.stats.defense` (`:84`), every slot plus buffs (`Character.ts:77-80`), while battles use `partyAbsorb` (armour only, plus the Monk floor, `CombatStats.ts:80-83`). No weapon has defense in `items.yaml` today, so the visible difference is the unarmoured Monk; it is still the wrong source.
- **Fix:** header (name, class, Lv, ailments, `← 1/4 →`); left (HP, XP, Next, STR, AGI, INT, VIT, LCK); middle, the battle numbers from `CombatStats` (ATK `partyAttack` ×`partyHits`, Hit %, DEF `partyAbsorb`, Evade, M.Def); right, equipment; bottom, spells; footer "←/→ Member   X Back". Pure line builders in `src/scenes/status/statusLines.ts`.
- **Test:** `StatusScene.test.ts`: an unarmoured Lv5 Monk shows `DEF 5` (old: 0); a poisoned member's header has `POISON`; the footer has "←/→"; the windows cover ≥ 80 % of the screen.
- **Browser:** `?mute=1&scenario=r_menus`: Status, left/right across the 4 members; W.MAG shows POISON.

#### E9: Equip reopens with the previous member's stats
- **Root cause:** EquipScene is a cached lazy scene (`SceneManager.ts:36-37`); `enter()` (`EquipScene.ts:68-74`) rebuilds the member menu at index 0 (`:80-87`) but keeps `memberIdx`, and `updateStats()` reads `this.member` (`:76`).
- **Fix:** `this.memberIdx = 0` in `enter()` before `buildMemberMenu()` (as `StatusScene.ts:45`).
- **Test:** `EquipScene.test.ts`: members 0 and 2 differ in ATK; enter, Down twice, `enter()` again → `statsLines` equals member 0's preview (old: member 2's).
- **Browser:** `?mute=1&scenario=r_menus`: Equip, Down twice, back out, Equip again: the first member's stats.

#### E10 (scene half): the Order cursor resets after each pick
- **Root cause:** `FieldOrderScene.buildMenu()` makes a new `Menu` with no `initialIndex` (`FieldOrderScene.ts:36-42`), after the first pick (`:50`), the swap (`:55`) and cancel (`:63`).
- **Fix:** `buildMenu(cursor)`: keep the cursor on the first pick, then on the second pick's row after the swap, and on `firstIdx` after a cancel; a `cursorIndex` getter. (The sprite refresh is R1.)
- **Test:** new `tests/scenes/FieldOrderScene.test.ts`: Down×2, Z → `cursorIndex` 2; Down, Z → swap and 3; in the second phase X → 2. Old: 0.
- **Browser:** `?mute=1&scenario=r_menus`: Order, Down×2, Z: the cursor stays on row 3; pick row 4: it is on row 4.

#### N1: naming and class select
- **Root cause:**
  - `NameEntryGrid.move` (`src/ui/NameEntryGrid.ts:91-97`) clamps the column by index between rows, but "End" (column 1 of the bottom row) is drawn 3 cells wide (`:68, 123`) above "3"; so Up from End lands on "1".
  - The header names the class while naming (`PartyCreationScene.ts:75`), but the slot strip shows names only (`PartyCreationViews.ts:24-32`) and the class-select header (`:76`) doesn't show the classes chosen so far.
  - Back rebuilds the class menu at index 0 after the name grid (`PartyCreationScene.ts:157-162`) and the confirm step (`:176-182`); `buildClassSelect` passes no `initialIndex` (`:102`).
  - The preview is text only (`PartyCreationViews.ts:44-57`).
- **Fix:** map columns between the 13-cell rows and the 2-cell bottom row by x (grid column `c` → bottom `c < 3 ? 0 : 1`; bottom `i` → column `i * 3`). The strip shows `1:ROLF Wa` and the open slot `3:? WM`. Back keeps the class (`buildClassSelect(initialIndex)`). The preview adds the class's `ready` battle pose from `characterAtlas.getBattleFrames(cls.id)`, loaded in `enter()` with `.then(refresh, e => console.error(...))`; text only if no art. **Size:** the file is 291 lines; move `playOpeningSequence` and `cutsceneDialogResolve` (`:253-283`) into `src/scenes/partyCreation/OpeningSequence.ts` and `buildConfirm` / `buildNameEntry` (`:124-166`) into `PartyCreationSteps.ts`; target ≤ 240.
- **Test:** `tests/ui/NameEntryGrid.test.ts` (new): from End, Up → `cursorCell === '3'` (old: '1'); Down from '3' → End. `PartyCreationNaming.test.ts`: pick Black Mage (index 4), cancel the empty grid → `selectedIndex` 4 (old: 0); after naming member 1 the strip shows `1:<name> Wa`.
- **Browser:** `http://127.0.0.1:5173/?mute=1`, New Game: Warrior; on the grid Down (End), Up → "3"; back out: still on Warrior with the sprite preview; finish slot 1: the strip shows the class.

#### S4: the Save list doesn't refresh after saving
- **Root cause:** `SaveScene.doSave` (`SaveScene.ts:123-135`) writes the slot and calls `showResult` without rebuilding the menu, which only `enter()` builds (`:60-65`); "Saved." sits over "Slot 1: Empty" (`52_saved.png`).
- **Fix:** `this.buildMenu()` (cursor on the saved slot) before `showResult`.
- **Test:** `SaveLoadSlots.test.ts`: empty store, save to slot 1; while "Saved." shows, no "Slot 1" Empty label and the new row is present. Old: "Slot 1: Empty".
- **Browser:** `?mute=1&scenario=r_menus`: clear `ff1_save_*` from `localStorage` in devtools, Menu > Save > slot 1: behind "Saved." the row shows the save.

#### S5: Save and Load look the same; terse slots; Load doesn't confirm
- **Root cause:** two identical untitled windows (`SaveScene.ts:23`, `LoadScene.ts:16`), both formatting `Slot N: Lv<leader> H:MM` (`SaveScene.ts:48-53`, `LoadScene.ts:42-46`); `LoadScene.onSelect` restores at once (`LoadScene.ts:62-70`). `SaveData` already has the members, gold, `currentMap` and `saveDate` (`types/index.ts:370-380`; `SaveManager.ts:30-40`), but `SlotSummary` exposes only level, time, leader and date (`SaveManager.ts:11-16, 93-99`), and only the map id is stored (map names live in map YAML, not loaded on the title).
- **Fix:** `src/scenes/save/slotView.ts`, shared: `slotLabel` (`Slot 1  Cornelia Castle 2F  0:12`), `slotDetail` (one line per member `ROLF  Wa  Lv3  HP 35/40`, then gold and `Saved 2026-11-14 14:03` local), `titleWindow`. Titles "Save: choose a slot" / "Load: choose a slot"; a detail window follows the cursor. `doSave` passes `ExplorationScene.getMapName()` (`ExplorationScene.ts:589`) as the location (R0-5). Load asks "Load Slot N? Progress since your last save is lost." through `ConfirmBox`.
- **Test:** `SaveLoadSlots.test.ts`: the titles differ; a slot saved with location "Cornelia" shows `Slot 1  Cornelia` and its detail lists every member and the date; Load + confirm opens the prompt without `switchTo`, Yes calls it. Update the `'Slot 1: Lv'` expectations (`:51`, `:58`).
- **Browser:** `?mute=1&scenario=r_menus`: save to slot 1 (title, location, party); reload `http://127.0.0.1:5173/?mute=1`, Continue: the Load title and detail; Z → prompt; No stays; Yes loads.

#### N2 (runtime half): the opening plays from data
- **Root cause:** `PartyCreationScene.ts:253-261` hardcodes 5 dialog pages on black (game data in TypeScript).
- **Fix:** the extracted `src/scenes/partyCreation/OpeningSequence.ts` (N1) runs `CutsceneRegistry.get('opening')` (R4a's data) through `CutsceneManager`, with `showDialog`, `fadeOut`/`fadeIn` and a `backdrop(image)` dep that shows `assets/backgrounds/<id>.webp` full screen behind the dialog (or clears it for `null`). A missing script logs `console.error` and goes straight to the field.
- **Test:** `PartyCreationNaming.test.ts`: finishing the party plays the registry's `opening` (spy on the registry; old code never reads it); `backdrop` is called with `dark_forest`, then `grassland`, then `null`; neither file contains dialog text literals.
- **Browser:** `http://127.0.0.1:5173/?mute=1`, New Game, name four members: three pages over two backgrounds, then the field fades in. 0 console errors.

**R3 owns:** `src/scenes/{ShopScene,MagicShopScene,ItemMenuScene,EquipScene,StatusScene,FieldOrderScene,SaveScene,LoadScene,PartyCreationScene}.ts`, `src/scenes/FieldMenuScene.ts` (line 21 only), `src/scenes/shop/**` (new `shopTransaction.ts`, `shopLayout.ts`, `SpellLearnPanel.ts`), new `src/scenes/save/slotView.ts`, `src/scenes/status/statusLines.ts`, `src/scenes/partyCreation/{OpeningSequence,PartyCreationSteps}.ts`, `src/scenes/PartyCreationViews.ts`, new `src/ui/ConfirmBox.ts`, `src/ui/NameEntryGrid.ts`, and the tests `tests/entities/Inventory`, `tests/scenes/{ShopScene,MagicShopScene,ItemMenuScene,EquipScene,StatusScene,FieldOrderScene,SaveLoadSlots,PartyCreationNaming,FieldMenuScene}`, `tests/ui/NameEntryGrid`.

### R4a: town, castle and dialog data

T1 and M11 live in `overworld.py`, so they are in R4b. The detailed TN-1..TN-24 text isn't in `/tmp/playtest2/town/`; the items below were mapped from the playtest summaries, `report.txt`, `dialog.txt` and fresh BFS runs.

#### T2 (data half): the rescue is narration only
- **Root cause:** `cutscenes.yaml:6-21`: nobody speaks, the heal is silent, and the party stays in the temple. The King's return already works on flags: his PRINCESS_RESCUED dialog, then `act1_complete` (`requiredFlag: PRINCESS_RESCUED, onceFlag: INTRO_COMPLETE`, `castle.py:253-265`, `ExplorationCutscenes.ts:40-46`); the princess (`castle.py:266`, `showIf PRINCESS_RESCUED`) gives the lute separately.
- **Fix:** rewrite `garland_defeated`. The princess speaks while she is still visible (`captive_princess` has `hideIf PRINCESS_RESCUED`, `temple-of-fiends.yaml:189-194`), and the warp happens while the screen is black:
  1. `dialog` "Garland falls, and the princess is free!"
  2. `dialog` "Princess Liora: Thank you, Warriors of Light! Please, take me home to my father."
  3. `fade_out 600`, `set_flag PRINCESS_RESCUED`, `heal_party`
  4. `dialog` "The party rests on the road home: HP and spell charges are restored, and the fallen are revived."
  5. `{type: warp, map: cornelia-castle-2f, entrance: throne_return, facing: up}`
  6. `fade_in 600`, then `dialog` "Princess Liora is home at last. Speak to the King."
  - `castle.py` adds the 2F entrance `throne_return: [21, 9]`, on the runner just south of the King's new cell (21,8) (M13). If decision R-9 keeps him on the seat (21,7), the entrance is (21,8). The princess at (23,8) is in view either way.
  - Update the step list in the `cutscenes.yaml` header (line 3).
  - Afterwards: confirm → the King's "You have brought my daughter home…" → `act1_complete` (INTRO_COMPLETE) → the princess → the lute.
- **Test:** `tests/data/act1Flow.test.ts`: `garland_defeated` still sets only `PRINCESS_RESCUED`; a dialog naming "Princess" comes before the first `fade_out`; a dialog matching `/restored|revived/` follows `heal_party`; exactly one `warp`, after `set_flag` and before `fade_in`, to `cornelia-castle-2f` and an entrance that exists in the compiled map, is walkable and lies directly below the King's cell. Old: no warp. R1 adapts `Act1Blockers.test.ts`, which loads the real script.
- **Browser:** `?mute=1&scenario=r_garland`: talk to Garland and win: the princess's line, the heal line, a fade, the 2F throne room facing the King; talk to him (ending), then to the princess (lute).

#### T3: directions don't match the map
- **Root cause:** `castle.py:263`: "beyond the forest to the north-west", but the temple road (`overworld_consts.py:69`) runs over open grass from the ring at (22,42) to the door at (15,39). `cornelia.py:307-308`: "The east road leads around the bay", but there is no bay: the road crosses the east river to the tomb at (50,43) below the mountains.
- **Fix:** King: "He holds her in the Temple of Fiends, north-west of the city. Leave by the west gate and follow the road; it ends at the temple door." East gate guard: "The east road crosses the river and ends at an old tomb below the mountains."
- **Test:** `actOneDialog.test.ts`: under all 5 flag states no line matches `/\bbay\b|beyond the forest/i`; every line naming the temple with a compass word uses the direction computed from the compiled overworld (temple entrance relative to `cornelia`: north-west); the east gate guard mentions `river|bridge`.
- **Browser:** `?mute=1&scenario=act1_castle`: talk to the King. `?mute=1&scenario=t5_cornelia_field`: the east gate guard at (56,46).

#### T4: the maid says the princess is "resting"
- **Root cause:** `castle.py:279-280`, while the princess stands in the throne room at (23,8).
- **Fix:** "Her Highness is with the King in the throne room. She talks of nothing but you!"
- **Test:** `actOneDialog`: with PRINCESS_RESCUED, no castle line matches `/resting|in her (room|chamber)|asleep/i`.
- **Browser:** `?mute=1&scenario=r_castle_rescued`: west into the chamber, talk to the maid.

#### T5: a vendor announces the builders before the King orders them
- **Root cause:** `cornelia.py:286-288`: `market_vendor_w`'s PRINCESS_RESCUED entry already mentions "builders out at the north bridge".
- **Fix:** an INTRO_COMPLETE entry first, with the current two lines. The PRINCESS_RESCUED entry becomes "Apples from the royal orchard! Half price today, for the princess is home." / "Now if only someone would mend the north bridge. Trade would come back, you'll see."
- **Test:** `actOneDialog`: replace `FLAG_SETS` (`:19-20`, which includes the impossible state INTRO_COMPLETE alone) with the 5 real states from `/tmp/playtest2/town/dialog.py`; in states without INTRO_COMPLETE no line matches `/builders?/i`.
- **Browser:** `?mute=1&scenario=r_town_rescued`, then `?mute=1&scenario=r_town_after_intro`: the vendor at (24,41).

#### T6: stale, duplicated and wrong lines
- **Root cause and fix** (conditions are single flags; first match wins):
  - **Stale after Garland:**
    - `villager` (`cornelia.py:282-283`): + GARLAND_DEFEATED "You beat Garland! Keep buying spells early. Whatever waits past the bridge won't be easier."
    - `treasury_guard` (`castle.py:164-166`): + GARLAND_DEFEATED "Garland is beaten, but the storeroom below stays open to you." / "Take what you need for the road ahead." (ST-9's no-flag line unchanged.)
    - `patron_soldier` (`homes_b.py:124-128`): keep INTRO_COMPLETE, + PRINCESS_RESCUED "A soldier's pay buys one mug a night, and tonight it's raised to you." / "They say Garland's men scattered when you walked into the temple." The default's first line becomes "A soldier's pay buys one mug a night, and this is it." (removes the near-duplicate of the barracks soldier's "Off duty…").
    - `stair_guard` (`castle.py:138`): + INTRO_COMPLETE "The throne room is up the stairs. His Majesty will always receive the Warriors of Light."
  - **Looted chests**, an entry keyed on the chest flag (after GARLAND_DEFEATED for the farmer and the knight):
    - `fisher_wife` (`homes_a.py:60`): CHEST_HOUSE_FISHER: line 1, then "I'm glad that potion went to someone who'll use it."
    - `farmer` (`:82`): CHEST_HOUSE_FARM: the default's first two lines.
    - `old_knight` (`:116`): CHEST_HOUSE_KNIGHT: the first two lines, then "That helm kept my head on my shoulders for thirty years. May it do the same for you." (matches M10).
    - `royal_gardener` (`homes_b.py:32`): CHEST_HOUSE_GARDENER: line 1, then "Keep that tent dry and it will serve you for years."
    - `apprentice` (`:88`): CHEST_HOUSE_APPRENTICE: line 1, then "You found my ether? Keep it. Charges are worth more out there than in here."
  - **Duplicates:** `throne_guard_e` (`castle.py:278`): "Speak plainly to His Majesty. He has no patience for flattery."; drop `SHARED_OK`.
  - **Weaver** (`homes_a.py:147`): "…That one on the left took two." (both rugs use one red material, `:128-129`).
  - **Shrine** (`homes_b.py:152`): line 1 "Welcome to the wayside shrine. Say a prayer for the princess, if you would."; + PRINCESS_RESCUED "The light brought Her Highness home, and you with it. Bless you."; line 2 kept.
- **Test:** `actOneDialog`: (a) no two NPCs share an opening sentence (up to the first `[.!?]`; fails today on "Off duty." and "Long live the King!"); (b) with every chest flag of a map set, an NPC whose default lines mention `chest` or that chest's item has an entry keyed on the chest flag; (c) villager, treasury_guard and patron_soldier differ between the "start" and "Garland defeated" states, and stair_guard between "start" and "intro complete"; (d) the weaver never says "blue", the priestess never says `/\brest\b/`.
- **Browser:** `?mute=1&scenario=r_house_fisher` (talk, open the chest, talk again); `r_town_rescued` (the villager); `r_castle_rescued` (the treasury guard on 1F via the stairs, the throne guards); `r_castle_after_intro` (the stair guard).

#### M1: the castle door guards cut the castle-front street
- **Root cause:** `cornelia.py:263-269` puts the guards at (28,19) and (32,19), on the one-row apron (`:81`) between the façade and the moat. With static NPCs blocking, (27,19) or (33,19) → (30,19) takes 53 steps.
- **Fix:** guards to the bridge's garden end, (28,22) and (32,22); the urns (`:140-141`) to (27,22) and (33,22). Simulated: 3 steps from either side; 20 from the orchard track (was 36).
- **Test:** `corneliaLayout`: no static NPC on row 19 for x 10–50; with NPCs blocking, (27,19) and (33,19) reach (30,19) in ≤ 3 steps; CT-4 green.
- **Browser:** `?mute=1&scenario=r_town_rescued` (arrives at (30,19)): walk west along the apron and back to the door.

#### M2: the 1F reading gallery is a dead end
- **Root cause:** the gallery (`castle.py:40`, x 12–31) meets the library at x 32, but the shelves at (32,4) and (33,4) (`:105, 108`) wall it off: (31,4) → (33,6) is 58 steps.
- **Fix:** shelves at x 34, 35, 38, 39, 40, 41 (opening (32–33, 4–5); 36–37 stay under the windows). Simulated: 4 steps.
- **Test:** `castleLayout`: in compiled 1F (no NPCs), (31,4) reaches (33,6) in ≤ 4 steps; the gallery test stays green.
- **Browser:** `?mute=1&scenario=r_castle_1f_gallery`: walk east out of the gallery into the library.

#### M3: the Item and Black Magic counters can be walked round
- **Root cause:** item shop counter (3–5,4) (`shops.py:59`): you step up through (2,4) or (6,4) to the keeper at (4,3). Black magic counter (6–9,4) (`:100`): (6,3) is reached through (5,4).
- **Fix:** item `g.carve(1, 4, 7, 4, "c")`; black magic `g.carve(4, 4, 9, 4, "c")` (the shelf at (3,3–4) closes the west end). A new `Place.staff(x0, y0, x1, y1)` in `interiors_common.py` records the cells behind each counter in `unreachable_ok` (needed once M4's check is on): item (2–6, 2–3), black magic (4–8, 3), armor (2–7, 3), weapon (1–4, 3–4), white magic (2–7, 3–4), inn (1–4, 7), tavern (1–4, 3–4).
- **Test:** `corneliaLayout`: for every keeper, no 4-neighbour of the keeper except the counter cell in front is reachable from the door (NPCs blocking). The item and black magic shops fail today.
- **Browser:** `?mute=1&scenario=r_item_shop` and `?mute=1&scenario=r_black_magic`: try both counter ends.

#### M4: visible floor that can't be reached
- **Root cause:** shrine: the benches at (3,6) and (7,6) (`homes_b.py:146-147`) and the pillars seal the aisles at x 1 and 9 (12 cells). Inn: the table at (9,8) (`shops.py:139`), the plant (10,7) and the barrel (10,9) box in (10,8). Interiors don't run `no_unreachable_walkable` (`interiors_common.py:13`).
- **Fix:** benches to y 7; the inn table to (10,8); `CHECKS = {"no_static_chokepoints": True, "no_unreachable_walkable": True}` (M3 lists the staff cells); the same check in `castle.py:27`'s `QUIET` (every castle floor has 0 unreachable cells today).
- **Test:** `corneliaLayout`: every interior source has `no_unreachable_walkable: true`; with no NPCs every walkable cell of every compiled interior is reachable or in `unreachable_ok`, and each listed cell is behind a counter or beside the keeper.
- **Browser:** `?mute=1&scenario=r_shrine` (both aisles); `?mute=1&scenario=r_inn` (step onto the old (9,8)).

#### M5: beds and bookshelves block a cell that looks like floor
- **Root cause:** 35 floor placements of 2-cell `bed_*` / `bookshelf_*` parts are bottom-anchored (bed art 32x58 native px, shelf 41x69, in a 48x96 footprint, `approved/interior/furniture.json` `prop_px`), and every footprint cell blocks. A bed's top cell is about 79 % empty floor.
- **Fix:** `Room.tall(part, x, y)` in `common.py` (and `Place.tall`, `interiors_common.py:45`, calls it) emits `offset: [0, -TOP[part]]` with `TOP = {bed: 38, bookshelf: 27}` (96 − art height, so the art sits against the wall) and `collide: "alpha"` (the compiler's `ALPHA_MIN` 0.25). A bed then blocks one cell; a shelf keeps 2 (its bottom cell 44 % covered). Replace the raw decos at `castle.py:88, 106, 108, 215, 217, 228, 306-307` and every `r.tall("bed"|"bookshelf")`; on-wall gallery shelves are excluded. (Rejected: `fit: true`, which upscales pixel art 1.12–1.44x with LANCZOS.)
- **Test:** `castleLayout` / `corneliaLayout`: every non-`on_wall` bed or bookshelf deco has `collide: alpha` and a negative dy; in the compiled maps the cell below each bed's top cell is walkable. All 35 fail today.
- **Browser:** `?mute=1&scenario=r_inn` (walk along the feet of the beds); `?mute=1&scenario=t5_castle` (barracks, library).

#### M6: a stray pixel column on every chest frame
- **Root cause:** the approved `assets-src/gen/approved/temple/relics.png` has key-fringe pixels (RGB ≈ 190,148,189) in column 1 of `chest_closed` (cell 3,0: 2 px) and `chest_open` (cell 3,1: 19 px); the chest starts at column 5 / 7. `build_assets.py:196-218` crops those cells straight from the PNG, so the kit's `paint` fixes (`kit.py:218`) never reach the field atlas.
- **Fix:** `relics.json` gets `"paint": [{"from": [2,144,1,48], "to": [1,144]}, {"from": [50,144,1,48], "to": [49,144]}]` (a transparent column over the fringe; `approve.py` keeps `paint` on re-approval). The pixels of the approved sheet are untouched (style lock): the fix is a build-time op. `build_assets.py:199-200`: `rimg = K.apply_paint(Image.open(...), rmeta.get("paint") or [], "temple/relics.json")`. Rebuild `build_assets.py field_ai`. No paid art.
- **Test:** `node_modules` has no PNG decoder, so a case in `assets-src/gen/selftest.py`: in `characters-ai.png`, each of the 3 chest frames (`sheets.chest`) is one run of opaque columns with no gap. Fails today.
- **Browser:** `?mute=1&scenario=r_cellar`: the closed chests, then open one; `?mute=1&scenario=t5_castle` for the treasury chests.

#### M7: the city gates are gaps in the wall; no tavern or shrine sign
- **Root cause:** the gate passages are plain cobble cut through the wall (`cornelia.py:111-113`, the postern `:94`); the south gate has a turret on one side only, (33,66) (`:258`); the houses (`:188-196`) set no `sign`; `kit.py:47` `SIGNS` has no tavern or shrine, and `approved/town/signs.json` has no spare board.
- **Fix:**
  - **Free (always):** flank every gate with the existing `TURRET` decos (`on_wall`, 2x3).
  - **Paid (R5, checkpoint 3):** `town/kit_gates`: `gate_arch_3` (3x2: the south gate and the inner gatehouse), `gate_arch_2` (2x2: the postern), `gate_side` (2x2: a lintel over a vertical wall for the W, E and precinct-E gates), `sign_tavern` (a tankard), `sign_shrine` (a white crystal). The arches are decos with `above_rows: 2` (drawn over characters, walkable). `HOUSES` get `sign="tavern"` / `sign="shrine"`.
- **Test:** `corneliaLayout`: every gate passage has a turret on both sides; after the art, the tavern and shrine have signs and every arch deco has `above_rows` equal to its height.
- **Browser:** `?mute=1&scenario=r_town_rescued`: out through the south and west gates.

#### M8: sprite reuse and role mismatches
- **Root cause:** across Cornelia `old_man` is used 9 times, `villager_f` 8, `guard` 18, `mage` 7 (compiled maps). `hall_noble` (`castle.py:139`), `farmer` (`homes_a.py:82`) and `royal_gardener` (`homes_b.py:32`) use `villager`.
- **Fix (free, approved 2x sprites):** hall_noble and the chancellor (`castle.py:272`) → `burgher`; farmer and royal_gardener → `farmer`; the fisher (`cornelia.py:305`) and the cellar steward (`castle.py:345`) → `villager`. `old_man` 9 → 6. New sheets (maid, scholar, off-duty soldier, noble) are 1–3 images each and not budgeted (decision R-11).
- **Test:** `corneliaLayout`: no sprite but `guard` used more than 6 times; the four roles above have those sprites; `assetCoverage` green.
- **Browser:** `?mute=1&scenario=t5_castle` (hall), `?mute=1&scenario=act1_castle` (chancellor), `?mute=1&scenario=r_house_farm`.

#### M9: empty or samey spaces
- **Root cause:** the cellar (22x15) holds only edge barrels and racks (`castle.py:330-335`); the castle lawn, rows 26–28 between the hedges and the inner wall (`cornelia.py:151`), is bare; 7 of 16 interiors resolve to one wall palette (fisher, gardener, tavern, inn and item shop set no wall materials; family and weaver differ only in trim); the weapon shop's vertical counter arm (5,3–5) (`shops.py:18`) renders as loose boxes.
- **Fix:**
  - **Cellar:** a cask row of barrels at (18–19, 7–8) and (19,9); grain crates at (2,10), (3,10), (2,11); armour stands at (14,4), (15,4); a table at (11,8).
  - **Lawn:** walkable `flowers` along row 28 under each hedge run (x 13–16, 23–26, 34–37, 44–47); statues at (21,26) and (39,26).
  - **Palettes** (each a distinct `{from, shade}`): fisher face `in_wall_face` 0.8, top slate 0.6; gardener face `wall_face` 1.1; tavern face `wall_face` 0.75, top 0.7; inn face `castle_face`, trim [170,60,60]; item shop face `castle_wall_in` 1.1, top `wall_top` 0.8; family top slate 0.7; weaver face `in_wall_face` 0.85.
  - **Weapon shop:** the counter becomes `carve(1,5,5,5,"c")`, with armour stands at (5,3), (5,4) closing the corner.
- **Test:** `corneliaLayout`: no two of the 16 interiors share `(in_wall_face, in_wall_top, floor, floor_stone)`; the weapon shop has no counter cell above its counter row. `castleLayout`: the cellar has ≥ 20 props. The compile's reachability checks pass.
- **Browser:** `?mute=1&scenario=r_cellar`; `r_town_rescued` (the gardens); `r_weapon_shop`; `r_item_shop` beside `r_inn` (palettes).

#### M10: chest loot repeats; the knight's gift is a 10 G shop item
- **Root cause:** potion, antidote, tent and ether each appear twice across the house and cellar chests (`homes_a.py:59, 81`, `homes_b.py:31, 87`, `castle.py:337-344`); the knight's chest (`homes_a.py:115`) holds `wooden_nunchaku`, sold for 10 G.
- **Fix:** knight → `iron_helm` ("You found an Iron Helm!", 100 G, not sold in Cornelia). Cellar: potion → `hi_potion`, antidote → `wooden_armor` (the steward's "old armour"), tent → `robe`, ether kept. Flags unchanged.
- **Test:** `castleLayout` / `crossFileValidation`: the 11 Cornelia and castle chests hold ≥ 9 distinct items; the knight's item isn't in any `cornelia_*` shop. Update the cellar test (`castleLayout:110`). Run `tests/balance` (the sims don't open chests, so they are unaffected; recorded).
- **Browser:** `?mute=1&scenario=r_house_knight`, `?mute=1&scenario=r_cellar`.

#### M13: castle art details
- **Root cause:** the treasury guard at (36,23) (`castle.py:164`) stands in front of the `gold_heap` (36,22), which shows on both sides of him (`69_treasury.png`); the King at (21,7) covers the small chair on the throne plinth (`72_throne.png`); the tower is 16 wide (`castle.py:297`) but the view is 20 cells (1920/96), so its brick border stops short of the screen edge.
- **Fix:** the guard to (34,23). The King to (21,8), standing before the throne (as T6 decision 7), so the chair back in row 6 shows; the throne drops `walk_cells` (`:196-197`); he is talked to from (21,9). The tower becomes `Room(..., 20, 13)` with every x shifted +2 (carve 5–14, rug 7–12, stairs (9,9), entrance `stairs [9,8]`, sage (8,5), windows 6/9/13, banner 11, shelves 5/14, desk 11, orb (5,8), plant (14,9)).
- **Test:** `castleLayout`: no NPC directly south of `gold_heap`; CA-5's case rewritten (the King at `throne.y + 2`, `x = throne.x`, and the cell below walkable); every castle map taller than 11 rows is ≥ 20 wide.
- **Browser:** `?mute=1&scenario=t5_castle` (treasury), `?mute=1&scenario=act1_castle` (throne), `?mute=1&scenario=r_tower`.

#### N2: the opening is several pages of text on black (data; runtime in R3)
- **Root cause:** `PartyCreationScene.ts:253-261` hardcodes 5 dialog pages on black: game data in TypeScript, against AGENTS.md.
- **Fix:** the text moves to `cutscenes.yaml` as `opening`, cut to 3 pages over existing staged backgrounds (free):
  1. `fade_out 500`, `{type: backdrop, image: dark_forest}`, `fade_in 800`, then "The world is veiled in darkness. The winds stop, the seas rage, and the earth decays."
  2. "Their only hope is a prophecy: \"When the world is in darkness, four Warriors of Light will come.\""
  3. `fade_out 600`, `backdrop grassland`, `fade_in 800`, then "After a long journey, four young warriors reach the gates of Cornelia, each holding a darkened orb."
  4. `fade_out 600`, `{type: backdrop, image: null}` (it ends black, as the field fade-in expects).
  - The dropped King line is covered by `south_gate_guard`.
  - Runtime: R3's new `partyCreation/OpeningSequence.ts` plays `CutsceneRegistry.get('opening')` with a `backdrop` dep; R1's `CutsceneManager` dispatches the `backdrop` step (R0-1).
- **Test:** `act1Flow`: `opening` has ≤ 3 dialog steps of ≤ 100 characters; every `backdrop` image exists as `assets/backgrounds/<id>.webp`; the last fade is `fade_out`. R3: `PartyCreationScene.ts` and `OpeningSequence.ts` contain no dialog text literals.
- **Browser:** `http://127.0.0.1:5173/?mute=1`, New Game, name the party, watch the opening.

**R4a owns:** `assets-src/tools/layouts/{cornelia,castle,common,interiors,interiors_common,homes_a,homes_b,shops}.py` (and the `assets-src/maps/cornelia*.yaml` they generate, rebuilt on the integration branch); `assets/data/cutscenes.yaml`; M6's `assets-src/gen/approved/temple/relics.json` (`paint` only), W15's `assets-src/gen/approved/vendor_f/field.json` (`head_from` only, specified in R4b), `assets-src/build_assets.py` (the chest loader), `assets/sprites/characters-ai.{png,json}` (rebuilt), the M6 and W15 cases in `assets-src/gen/selftest.py`; and `tests/data/{corneliaLayout,castleLayout,actOneDialog,act1Flow}.test.ts`.

### R4b: overworld and temple data

**Numbers today** (seeded sims, 3000 seeds, a fresh counter per trip): overworld rate `{15, 30}` (`overworld.py:221`), temple `{8, 15}` (`temple-of-fiends.yaml:206`; a long walk measures 11.5 steps per battle, so the live log's "every 5–10 steps" is perception). Battles per trip: S gate → temple 30 steps, 0.94; W or N gate → temple 17 steps, 0.12; temple entry → Garland 14 steps, 0.76; entry → 4 chests → Garland 52 steps, 4.01.

#### T1: the bridge gate message doesn't change after the King's order (data; runtime in R1)
- **Root cause:** one fixed string (`overworld.py:197`), wired as `keyItemGates` at `:219`; `KeyItemGate.message` is a `string` (`src/types/index.ts:352`), and `KeyItemGateSystem.ts:38-40` returns it whatever the flags.
- **Fix:** with R0-2 (`message: string | ConditionalDialog[]`) and R1's resolver: `[{condition: INTRO_COMPLETE, text: ["The King's builders are at work on the bridge, but it isn't finished yet."]}, {text: ["The bridge has collapsed into the sea. Only the King's builders could repair it."]}]` on both gates.
- **Test:** `overworldLayout.test.ts`: both bridge gates carry an INTRO_COMPLETE variant whose text differs from the default.
- **Browser:** `?mute=1&scenario=r_overworld_after_intro`: walk north to the stub at (29,32) and bump it: the "at work" line. Then `?mute=1&scenario=act1_overworld`: the "collapsed" line.

#### M11: the north keep door lands at the far east of the castle grounds
- **Root cause:** `overworld.py:233` maps `N_WARP` (the keep's drawn door, `overworld_consts.py:13`) to Cornelia's `castle_gate` (55,24), the precinct's east gate.
- **Fix:** target the existing entrance `castle` (30,19), in front of the castle door (R4a's M1 clears row 19). Combine with W10's new `N_WARP`.
- **Test:** `overworldLayout`: the transition at `N_WARP` targets `castle`, and Cornelia's `castle` entrance is directly south of its castle-door transition (30,18).
- **Browser:** `?mute=1&scenario=act1_overworld`: walk into the keep door; arrive at (30,19) before the castle door.

#### W1: the temple icon is tiny and dark (OW-8)
- **Root cause:** `overworld.py:180-181` still stamps `prefab: temple_icon`: 48x50 native px in a 96x96 box (`approved/overworld/landmarks.png`, bbox x 22–69, y 46–95), mean luma 60. `kits.yaml:604` keeps `temple_grand` `skip: true` after 3 attempts (ledger keys `0cfb1eeb…`, `bc37fe12…`, `b398fc75…`). The hero's head tile on the arrival (15,39) covers the door cell and hides most of a 48 px icon.
- **Fix A (preferred, 0 images; R5-1):** re-cut the `temple_grand` render already cached under the approved sheet's own key `b398fc75` (seed 1236): an asymmetric temple, about 91x96 native, doorway right of centre, on a lighter stone platform.
  - A new sheet `overworld/grand_temple` in `kits.yaml`, whose request is byte-identical to `grand` (seed 1236, same refs, guide, boxes and texts), so the cache key matches; `bridge_gap` `skip: true`; `temple_grand` cut under new part names `temple_ruin_{0,1}_{0,1}` with a tighter `source` box; the measured doorway columns recorded as `door_px: [x0, x1]`.
  - **Gate:** `generate.py overworld --backend gemini --sheets kit_grand_temple --seeds 1236 --dry-run` must report a cache hit on `b398fc75` and 0 paid requests. If the key differs, stop; no paid call.
  - `approve.py overworld kit_grand_temple`; `grand.{png,json}` untouched (style lock).
- **Map (`overworld.py:180-181`):** a `deco` at (14,37) with `parts: [[temple_ruin_0_0, temple_ruin_0_1, null], [temple_ruin_1_0, temple_ruin_1_1, null]]`, `offset: [72 − door centre, 0]` (about +15), `collide: alpha`, `walk_cells: [[1, 1]]`. The null column owns (16,37–38), so no peak draws over the spill (`terrain/peaks.py` `plan_peaks`). The explicit transition (15,38) → `temple-of-fiends`/`entry` and `entrances.temple: [15, 39]` replace what the prefab created; `TEMPLE_DOOR`, the arrival and the fade are unchanged. If the 0.25-scale preview still fails, add `style: bright` (R0-7). W14 removes the dark speckle around it.
- **Fix B (if A fails review):** the seed-1234 render (`0cfb1eeb…`, cached): symmetric, centred door, 76x96; rebuild its request from `out/gemini/overworld/1234/kit_grand_prompt.txt`, `offset: [24, 0]`, the same dry-run gate.
- **Fix C (no AI):** keep `temple_icon` with `offset: [27, 0]` (W2) and `style: bright`; fixes W2 but not the size. Then R5-2 (paid).
- **Test:** `overworldLayout.test.ts` (replacing `:152-158`): the temple object's parts are `temple_ruin_*` and exist in `approved/overworld/grand_temple.json`, whose `prop_px` is ≥ 82x82 (old `temple_icon` 48x50 fails); `warp_leaves`, `art_coverage` and `act1Flow.test.ts:40-59` pass.
- **Browser:** `?mute=1&scenario=r_ow_temple`: screenshot from the spawn, walk north 2 cells (the icon stays readable behind the hero), enter; 0 console errors. Then `python3 -I assets-src/tools/build_map.py --preview overworld 0 0 72 72 /tmp/r/ow_q.png --scale 0.25`: the temple can be picked out next to the city.

#### W2: the temple's drawn door sits half a cell left of its warp cell (15,38)
- **Root cause:** `temple_icon`'s doorway is centred in its 2x2 box at native x ≈ 45, but the door cell is cell 1, centred at x 72 (`overworld.py:180`, `door: 1`; `overworld_consts.py:20-21`).
- **Fix:** W1's `offset` puts the measured doorway centre on x 72 ± 6 (A about +15; B +24; C +27).
- **Test:** `overworldLayout`: the temple transition is at (deco.x + 1, deco.y + 1), and |(`door_px[0]` + `door_px[1]`) / 2 + offset.x − 72| ≤ 6 (old: no offset, door centre ≈ 45).
- **Browser:** as W1; at the arrival, facing north, the door is centred above the hero.

#### W3: two invisible walls in the temple hall
- **Root cause:** the broken-pillar decos at (9,10) and (14,12) (`temple-of-fiends.yaml:104-115`) block both cells by default, and `tpillar_broken_top` has 0.00 alpha coverage, so the top cells block with nothing drawn.
- **Fix:** `collide: alpha` on both decos; the bottom parts (0.47 coverage ≥ `ALPHA_MIN` 0.25, `build_map.py:76`) still block.
- **Test:** `templeLayout.test.ts`: (9,10) and (14,12) walkable, (9,11) and (14,13) not; `:23` and `:31` 234 → 236 walkable cells.
- **Browser:** `?mute=1&scenario=act1_temple`: (9,9) → (9,10); (14,11) → (14,12).

#### W4 (data half): routes shorter than the minimum encounter rate
- **Root cause:** the overworld minimum 15 (`overworld.py:221`) is above the W/N gate → temple route (16 counted steps), so 88 % of those trips have no fight. (The counter reset on map load is R1's.)
- **Fix:** overworld `encounterRate: {min: 10, max: 22}` (decision R-14). Battles per trip with a fresh counter (R1's persistence only adds): S gate → temple 0.94 → 1.32; W/N gate → temple 0.12 → 0.54 (P ≥ 1 battle 54 %); E gate → tomb 0.38 → 0.86. `fieldPacing` counts battles, not steps, so it doesn't move.
- **Test:** `tests/balance/zones.test.ts`, new `describe('route encounters')`: the real `EncounterSystem` with the step filter, BFS-shortest paths on the compiled maps, 2000 seeds: W gate → temple P(≥ 1 battle) ≥ 0.45 (old 0.12); S gate → temple mean 1.0–1.7 (old 0.94).
- **Browser:** `?mute=1&scenario=act1_overworld`: walk to the temple 3 times (re-open the URL each time); log the battles.

#### W5: little enemy variety by region
- **Root cause:** `overworld_zones.py:14-22`: the fields and the approach share goblin, wolf and gr_imp; `temple-of-fiends.yaml:215` rolls wolves in the temple. The act-1 species with art are goblin, gr_imp, wolf, gr_wolf and skeleton.
- **Fix (data only, no new species):** approach (`overworld_zones.py:19-22`): gr_imp 2–4 (w3), wolf 2–3 (w3), skeleton 1–2 + gr_imp 1–2 (w2; the undead leaking from the temple), gr_imp 1–2 + wolf 1–2 (w2), no goblins. The temple loses its wolves (B9). The fields stay goblin-led; the east pocket keeps gr_wolf.
- **Test:** `zones.test.ts`: the temple has no wolf (old: 1 entry); the approach rolls a skeleton and no goblin; each region's species set differs from its neighbour's. `actOneEncounters.test.ts:64-75` stays green (approach gr_imp ≈ 70 % ≥ 30 %; temple skeletons 80 % ≥ 70 %).
- **Browser:** `?mute=1&scenario=r_ow_temple`: 3 approach battles; one has skeletons, none goblins.

#### W6: the south gate exit is cut off from the west by the city stream
- **Root cause:** `STREAM` (`overworld_consts.py:42`) runs from the city to the bay with no crossing; `RING` (`:65-66`) avoids it on purpose, so the S gate arrival (28,47) → (24,47) takes 24 steps.
- **Fix:** `STREAM = [(CX, CY+3), (CX, CY+7), (CX−2, CY+9), (CX−4, CY+10), (CX−5, CY+12)]` makes column 26 a single river cell for rows 47–49; after the roads (`overworld.py:128`), a footbridge `=` at (26,48) and a road cell at (27,48) joining the S road (`river_check` passes: the run above and below is exactly [26]). S → (24,47) takes 6 steps. Side effect: S gate → temple door drops from 29 to 23 (decision R-13).
- **Test:** `overworldLayout`: new, (24,47) is ≤ 8 steps from `entrances.cornelia` (old 24); `:243-249` temple bound 25–40 → 20–40; `overworld.py:152` `check()` (25, 40) → (20, 40); OW-1 (`:172-189`) still one network.
- **Browser:** `?mute=1&scenario=act1_overworld`: from the S gate walk west over the footbridge.

#### W7: the `temple_approach` zone splits a forest
- **Root cause:** `encounter_zones` (`overworld_zones.py:50-67`) zones by distance only, so the boundary cuts the south-west forest at x 16|17, rows 53–62.
- **Fix:** after the distance rule, each 4-connected forest component with ≥ half its cells in the approach joins it whole, otherwise leaves whole. Grass unchanged.
- **Test:** `overworldLayout.test.ts:293-316`: `want` follows the majority rule; new: no forest component has cells both inside and outside `temple_approach` (old: fails at x 16/17).
- **Browser:** `?mute=1&scenario=r_ow_temple`: read the backdrop at a forest edge with `browser_evaluate` (data change; no visual check).

#### W8: the bridge debris is brown wood next to pale stone stubs
- **Root cause:** `BROKEN_BRIDGE` (`overworld_consts.py:114-115`) draws the approved brown `bridge_gap` parts (mean (130,87,71)); the stubs are the approved `bridge_h` pale stone (deck mean (206,189,167)): ΔE76 = 38.8.
- **Fix (free):** the deco gets `style: pale_stone`, a new `RECOLOR` entry (R0-7). A trial `(0, 0.4, 1.4)` measured ΔE 13.1; tune to ≤ 12 from `(10, 0.45, 1.45)`. The plank shapes stay and read as split slabs (review call). Rejected: re-texturing every overworld bridge in wood. Paid fallback: R5-2's `bridge_gap_stone`.
- **Test:** `overworldLayout.test.ts:139-150`: the debris has `style: 'pale_stone'`; new (`map_selftest.py` or a vitest on the RECOLOR table): the restyled debris mean is within ΔE 12 of the `bridge_h` deck (old 38.8).
- **Browser:** `?mute=1&scenario=r_ow_bridge`: stubs and debris read as one material; the gate message is per T1.

#### W9: the jetty head uses the wrong piece; the pier leads nowhere in act 1
- **Root cause:** `JETTY` starts at shore + 1 (`overworld.py:121-122`), at (28,53), which has land at (27,53), so `_bridge_cell` (`build_map.py:845-847`) picks `bridge_h` for the head. The ship needs `BIKKE_DEFEATED` (`overworld.py:230`).
- **Fix:** (28,53) becomes land (the road end); `JETTY = [(CX+2, shore+2+i) for i in range(3)]` → (28,54)–(28,56), water both sides; the ship cell moves to (28,57) (ocean); an `inspect` at (28,57): "The pier runs out into the bay. No ship calls at Cornelia while pirates rule the seas."
- **Test:** `overworldLayout`: every jetty cell has water at x ± 1 (old (28,53) fails); (28,57) has inspect text; OW-1's jetty target `[ship.x, ship.y − 1]` is in the network.
- **Browser:** `?mute=1&scenario=act1_overworld`: walk to the pier end and confirm facing the sea.

#### W10: the city gates are hard to read
- **Root cause:** the roads stop at the arrivals, outside the icon (`overworld_consts.py:67-75`); the north entry walks over the keep's tower art: `N_APPROACH` (28,43) is a walkable icon cell and `N_WARP` (28,44) is inside the keep (`:13-14`; `overworld.py:178`).
- **Fix (free; a new city icon is not worth 1–3 images):** `N_WARP = (CX+2, CY)` = (28,43), drop `N_APPROACH`, `walk_cells` → `[[2,0], [0,2], [4,2], [2,3]]` (arrival (28,42) unchanged). Each gate road runs one cell further, onto its warp cell (W 26,45; E 30,45; S 28,46; N 28,43), allowed by `road_check` (`map_checks_terrain.py:73` only rejects road under blocked art).
- **Test:** `overworldLayout`: OW-2 (`:191-200`) and OW-3 (`:202-208`) pass; new: every city warp cell is road (old: none); the `castle` warp's y is the city's top row.
- **Browser:** `?mute=1&scenario=act1_overworld`: round the city through all four gates; the north gate warps at the wall's edge.

#### W11: vines hang in mid-air at the tomb
- **Root cause:** `TOMB_OBJECTS` places free-standing `vines` on grass at (53,43) (`overworld_consts.py:105`).
- **Fix:** delete them; W12's chest takes that nook between (52,43) and the range (54,43).
- **Test:** `overworldLayout`: no `vines` part on a cell whose north neighbour is walkable or grass.
- **Browser:** `?mute=1&scenario=r_ow_east`.

#### W12: the hardest area (the east pocket) has no reward
- **Fix:** an overworld chest NPC `{id: chest_tomb, sprite: chest, x: 53, y: 43, chestItem: iron_shield, chestFlag: CHEST_ERDRICK_TOMB, dialog: ["You found an Iron Shield!"]}`. The Iron Shield is not sold in Cornelia (`shops.yaml`), and R4a's knight chest already gives the Iron Helm (M10). The `tests/balance` sims don't open chests.
- **Test:** `overworldLayout`: the pocket has a chest NPC whose cell is in `east_pocket`; `crossFileValidation` checks the item and the unique flag.
- **Browser:** `?mute=1&scenario=r_ow_east`: open the chest; it shows opened.

#### W13: the temple floor shows a hard grid, and the temple is small
- **Root cause:** every walkable cell is one 2x2 `temple_floor` texture (`temple-of-fiends.yaml:12`, ground `:17-39`) repeating every 2 cells; only 7 of 236 cells are `%`.
- **Fix:** a 4-wide `_` aisle from the corridor (x 10–13, rows 7–20) to the altar row, aliased `floor: {from: carpet, shade: 0.55}` (a faded runner), with `contrast: {a: W, b: "_", min: 0.2}`; about 10 more `%` rubble cells in clusters off the main path. Size unchanged (FF1 parity; decision R-15).
- **Test:** `templeLayout`: ≥ 15 % of walkable cells are `_` or `%` (old 3 %); `_` is a connected run from (11,20) to row 7.
- **Browser:** `?mute=1&scenario=act1_temple`: screenshot the hall.

#### W14: black dither speckle around mountain ranges
- **Root cause:** `foothills` (`terrain/peaks.py:14-36`; `terrain/base.py:39-41`, `FOOT_COVER` 0.40) copies single raw mountain-texture pixels onto grass by a Bayer threshold, so the texture's dark crevice pixels land as isolated black dots.
- **Fix:** clamp the foothill texture's luma to ≥ 0.8 of the local grass luma (or median-filter `mtex` 3x3) before the copy, and `FOOT_COVER[0]` 0.40 → 0.30. Only `organic` maps with mountains change (in act 1, the overworld).
- **Test:** `terrain/selftest.py`, new case: on a synthetic grass + mountain strip, ≤ 1 % of foothill pixels are darker than the grass texture's 5th percentile (old: fails).
- **Browser:** `?mute=1&scenario=r_ow_temple`: no black speckle round the temple hills.

#### W15: `vendor_f`'s back-frame shawl flickers (implemented by R4a, which owns `selftest.py` and the `characters-ai` rebuild)
- **Root cause:** in `approved/vendor_f/field.png` the up-row stand frame 0 draws a long brown shawl to the hem, while step frames 1 and 2 show a short one (the json note already records it as accepted in T6).
- **Fix (free):** a review fix in `approved/vendor_f/field.json`: `head_from: {up: [[0, 2, 78]]}` (rows 0–77 from frame 2; the stand keeps its own hem and feet). `head_from` is a sanctioned hand fix (`approve.py:26`; applied in `build_assets.py:184-185`), and the png is untouched. Tune the row count with `python3 -I assets-src/gen/puppet.py review vendor_f`, then `build_assets.py field_ai`. Paid fallback: R5-3.
- **Test:** `assets-src/gen/selftest.py`: in the built `characters-ai` up row of `vendor_f`, the stand frame's brown-shawl pixel count is within 15 % of the step frames' (old: about 2x).
- **Browser:** `?mute=1&scenario=t5_cornelia_field`: walk behind the market woman; no flicker.

#### B1 (map half): talk to Garland to fight, and a trigger that can't be sidestepped
- **Root cause:** Garland (`temple-of-fiends.yaml:183-188`) is a plain dialog NPC at (11,5); the only trigger is (11,6) (`:198-205`). The room (x 3–20, y 3–6) opens through a 4-wide gap at row 7, x 10–13 (`:24`), so (13,7) → (13,6) → (14,6) → (14,4) reaches the princess side without the fight. Talking can't start a battle: post-dialog actions are only `shopId`, `action` (`classUpgrade`) or a due cutscene (`ExplorationScene.ts:374`, `handleNpcPostDialog` `:414-437`), and scripted encounters fire only by cell (`getScriptedEncounterAt` `:493-506`).
- **Fix:** Garland moves to (11,6), standing in the doorway row. The room's whole cut, row 6 x 10–13, becomes Garland plus three trigger cells: `scriptedEncounters` at (10,6), (12,6) and (13,6), each with the same `enemyIds`, `flag: GARLAND_DEFEATED`, `isBoss`, `message` and `postVictoryCutscene` (the engine already handles several entries per flag). The (12,6) entry carries `npc: garland` (R0-3; R1 adds the talk branch). Talking from (11,7) gives his two lines, then the battle message and the battle. Victory sets the flag, which hides him and disarms all three cells.
- **Test:** `templeLayout.test.ts`: BFS from `entrances.entry` on the compiled collision, NPC cells blocked and scripted cells as stops: no room cell (y 3–6) and no princess neighbour is reachable (old: (14,4) is); all scripted cells share one flag; exactly one has `npc: garland`, and Garland's cell neighbours a corridor cell.
- **Browser:** `?mute=1&scenario=r_temple_garland`: (1) face north from (11,7), confirm: dialog, then battle; (2) re-open, walk (12,7) → (12,6): battle; (3) re-open, (13,7) → (13,6): battle. 0 console errors.

#### B9 (data half): the temple rate and table
- **Root cause:** rate `{8, 15}` (`temple-of-fiends.yaml:206`); table (`:208-218`): skeleton 2–4 (w4), skeleton 1–3 + imp 1–2 (w3), imp 2–4 (w2), wolf 2–3 (w1), skeleton 4–6 (w1). Mean formation 3.26; the chest route averages 4 battles.
- **Fix:** rate `{min: 12, max: 22}`; table: skeleton 1–3 (w4), skeleton 1–2 + gr_imp 1–2 (w3), gr_imp 2–3 (w2), skeleton 3–4 (w1), no wolves. This meets R2's targets (no formation above 4 skeletons or 5 enemies; mean ≥ 16 steps per battle). Mirror the table and rate in the legacy `assets/maps/temple-of-fiends.yaml:1203-1206`, which `actOneBalance.test.ts:169-171` pins.

  | Measure | Old | New |
  |---|---|---|
  | Mean formation | 3.26 | 2.54 |
  | Chest route, battles | 4.01 | 2.54 |
  | Direct route, battles | 0.76 | 0.19 |
  | Lv1 fresh win | 97.2 % | 99.8 % |
  | Lv2, 3 fights in a row: wipes / HP left | 1.0 % / 82 % | 0 % / 89 % |
  | Lv1, 4 fights: wipes | 23 % | 2.8 % |

- **Test:** see "Balance bounds". `zones.test.ts`: the chest route (BFS through the 4 chest stands) averages 2–3 battles (old 4.0), the direct route ≤ 0.35 (old 0.76).
- **Browser:** `?mute=1&scenario=r_temple_party`: walk entry → 4 chests → the doorway; log the battle count and pack sizes.

**R4b owns:** `assets-src/tools/layouts/overworld{,_consts,_zones,_grid}.py` (and the regenerated `assets-src/maps/overworld.yaml`); `assets-src/maps/temple-of-fiends.yaml`; the legacy `assets/maps/temple-of-fiends.yaml` (encounters and rate only); `assets-src/tools/terrain/{peaks,selftest}.py`; `tests/data/{overworldLayout,templeLayout}.test.ts`; `tests/balance/{zones,fieldPacing}.test.ts`. R5's sheets are listed in §3.


---

### 3. Paid art (R5)

**Budget:** cap 100 Gemini images; **25 used** (ledger: 94 Gemini attempts − `attempts_before` 69); 3 attempts per sheet. Bedrock is not counted. R5 runs in the main checkout (it needs the gitignored refs and `.env`), dry run first, `--max-paid 1`; every free re-cut and every approval runs `python3 -I assets-src/gen/selftest.py` and `git diff --exit-code assets-src/gen/approved/` excluding the new files; decisions are logged in `docs/ACT1_LOG.md`.

| # | Sheet | Spec | Approval | Images min / expected / max | Fallback |
|---|---|---|---|---|---|
| R5-1 | `overworld/grand_temple` (**free**, W1) | a request byte-identical to `grand` seed 1236 (cache key `b398fc75`); `bridge_gap` `skip`; the temple cut as `temple_ruin_*`; `door_px` recorded | the dry run reports a cache hit and 0 paid requests; prop ≥ 82x82; door centre + offset within 72 ± 6, ≥ 12 native px wide (decision R-12); readable at 0.25 scale; no magenta fringe; `art_coverage` and `warp_leaves` pass | 0 / 0 / 0 | free B (seed 1234, `0cfb1eeb`), then free C, then R5-2 |
| R5-2 | `overworld/kit_temple` (paid; only if R5-1 and B fail, or W8's recolour fails review) | `temple_ruin3`, 3x2, **symmetric with the doorway centred** (the model centred it every time; revision 13 failed only because it asked for an off-centre door), ≥ 24 px wide, on a light stone platform; prefab `w: 3, door: 1` at (14,37) so the door lands on (15,38) with no offset. Plus `bridge_gap_stone` 2x2: snapped pale-stone deck ends and masonry blocks, ≥ 50 % keyed, within ΔE 12 of `bridge_h` | as R5-1, plus T6 checkpoint 1's criteria; the stone pieces match the stubs | 0 / 0 / 3 | W1: free C; W8: keep the recolour |
| R5-3 | `vendor_f/field` retry (paid; only if W15's `head_from` fails review) | `--retry --seeds 1235`; the prompt adds "the shawl ends at the waist in every frame, front and back" | T6 checkpoints 3–5's criteria, plus the same shawl length in all 3 back frames | 0 / 0 / 2 | keep `head_from` |
| R5-4 | `town/kit_gates` (paid, M7; decision R-10) | swatches, refs `town/walls`, `town/signs`: `gate_arch_3` (3x2), `gate_arch_2` (2x2), `gate_side` (2x2 lintel over a vertical wall), `sign_tavern` (a tankard), `sign_shrine` (a white crystal) | outline, light and saturation match `town/walls` and `town/signs`; the arches read as gatehouses over the passage at 2x; keyed cleanly | 1 / 1 / 3 | turret flanking only (free, done anyway); no tavern or shrine sign |

- **Expected:** 1 image (R5-4), because W1, W8 and W15 are free → **26 of 100**. **Worst case:** 8 → 33 of 100.
- **Not budgeted (only on a user decision):** a paid shoreline background (B14, 1–3), a seated King (M13, 1–3), new NPC sheets (M8, 1–3 each).

---

### 4. Balance bounds (B1 and B9)

Sims: the real `BattleStateMachine` and `tests/helpers`, the `tests/balance/*` seed formulas, 400 seeds (encounters 2000–3000). Party Warrior / Thief / White Mage / Black Mage. Expected arrival at Garland: Lv 2–3 (`fieldPacing`: Lv 2 at battle 5, Lv 3 at battle 22, median).

**Garland: 240 HP, attack 16, 2 hits, no weakness; at ≤ 25 % HP 3 hits; B7 jittered order.**

| Case | Today (FF1 Garland) | Target (measured) |
|---|---|---|
| sensible Lv 2, 400 G kit | ≥ 95 % | 50 % |
| sensible Lv 2, full kit + 3 potions | ≥ 95 % | 95 % (≥ 3 rounds in every win, median 5; 34 % party HP lost; 0.8 downs per win) |
| sensible Lv 3, full kit | n/a | 99.5 % (28 % HP lost) |
| careless Lv 1, naked | 0.25 % | 0 % |
| careless Lv 1, 400 G kit | 98.25 % | 1.25 % |
| careless Lv 2 / Lv 3, 400 G kit | n/a | 12 % / 41 % |
| sensible Lv 1, full kit | n/a | 45.5 % |
| temple run then Garland, Lv 2 (2 battles) / Lv 3 (3 battles) | ≥ 85 % / ≥ 95 % | 85.0 % / 95.75 % (97.25 % at Lv 3 with the new temple table) |
| SLEP every round: locked out / share of rounds he acts | ≤ 5 % / 0.21 ± 0.04 | 0 % / 0.468 |

Under the other B7 options: strict agility order gives sensible Lv 2 full 98.25 %, temple Lv 2 92.25 %, SLEP share 0.267; FF1's pure shuffle gives sensible Lv 2 full 94 %, temple Lv 2 79 % / Lv 3 95 %, SLEP share 0.503.

**`tests/balance/garland.test.ts` changes (R2):**
- `:2-5` header and `:41` describe title: 240/16/2, phase ≤ 25 % → 3 hits (triage default B1).
- `:42-45` split: `start/sensible/L2` within 0.35–0.65 (old ≥ 0.95); `full/sensible/L2` ≥ 0.90 (old ≥ 0.95); new `full/sensible/L3` ≥ 0.97.
- `:49-51` naked careless Lv 1 ≤ 0.05 (unchanged).
- `:53-57` careless Lv 1, 400 G kit: 0.90–0.995 → ≤ 0.05.
- New: careless Lv 2 within 0.05–0.35, careless Lv 3 within 0.25–0.65.
- `:59-61` sensible Lv 1: 400 G kit ≥ 0.98 → full kit within 0.30–0.65.
- `:63-66` temple run: Lv 2 ≥ 0.85 → **≥ 0.80**; Lv 3 ≥ 0.95 → **≥ 0.93** (decision R-1).
- New: in sensible Lv 2 full-kit wins, ≥ 3 rounds in ≥ 90 % of battles.
- `:68-72` comment (turn order no longer strictly by agility); `:94` comment 106 → 240 HP; `:98` ≤ 0.05 unchanged; `:99` `0.21 ± 0.04` → **`0.47 ± 0.05`** (0.27 ± 0.04 if B7 keeps agility order).
- Also `tests/battle/BossPhase.test.ts:37-91`, `tests/battle/CombatStats.test.ts:124-128` and `tests/data/actOneBalance.test.ts:86-93` (see B1).

**Temple (B9): rate `{12, 22}`; table skeleton 1–3 (w4), skeleton 1–2 + gr_imp 1–2 (w3), gr_imp 2–3 (w2), skeleton 3–4 (w1), no wolves; escape `min(0.75, luck / (level + 16)) − 0.05 × (enemies − 1)`.**
- Targets: no formation above 4 skeletons or 5 enemies; per battle at Lv 2 (careless, 400 G kit) ≤ 11 % HP lost and ≤ 2 % someone falls (today 12.6 % / 3.8 %); mean ≥ 16 steps per battle; a 5-battle crawl at Lv 2 (sensible, no inn) wipes ≤ 1 % (today 3.4 %).
- Measured with the new table: mean formation 3.26 → 2.54; chest route 4.01 → 2.54 battles; direct route 0.76 → 0.19; Lv 1 fresh win 97.2 → 99.8 %; Lv 2 three fights in a row 1.0 % → 0 % wipes, 82 → 89 % HP left; Lv 1 four fights 23 → 2.8 % wipes. Thief escapes vs 3 enemies: 100 % → 65 % (8 of 8: 3.2 %).
- `tests/balance/zones.test.ts:27-31` ("temple won 90–99 %"; with the new table it would read 0.994 and break the 0.99 ceiling) becomes: Lv 1 fresh win ≥ 97 %; mean formation 2.3–2.8 (old 3.26 fails); Lv 2 sensible 3-fight chain ≤ 1 % wipes and ≥ 85 % HP left (old 1.0 % / 82 % fails). New describes: route encounters (W4), variety (W5), temple routes (B9).
- `tests/balance/fieldPacing.test.ts:60-82`: the simulated campaign also shops at each zone boundary and once after the last battle (the walk home). Without that, `:110` "≥ 7 of 8 purchases" drops to 6.79 under the new tables (fewer inn visits); with it: 8.0 bought, 289 G left, Lv 2 median 5, Lv 3 median 22, 0 wipes, so `:92-110` are unchanged.
- `tests/battle/BattleCommands.test.ts:53-67` (escape values) per B9.
- The B2 draw-order change shifts seeded numbers by 1–2 points: re-measure on the implementation and keep every bound at least 3 points from the measured value.

---

### 5. Sub-tranches and order

| # | Items | Owns (files) | Depends on |
|---|---|---|---|
| R0 | the shared contract (§2) | `CutsceneManager.ts` (types), `src/types/index.ts`, `schemaValidation.ts`, `Inventory.ts` (API), `SaveManager.ts`, `EventBus.ts`, `Menu.ts` (`setActive`), new `uiSounds.ts`, `DebugScenarioLoader.ts` (fields), `ItemEffects.ts` (wording), `build_map.py` (`RECOLOR`), `kit.py` (`_PARTS`), `debug-scenarios.yaml`, the `cutscenes.yaml` header comment, their tests | none; first commit on `r-integration` |
| R1 | engine, scenes, input, audio | "R1 owns" | R0 |
| R2 | battle | "R2 owns" | R0 |
| R3 | menus, shops, items, Save/Load, naming, opening runtime | "R3 owns" | R0 |
| R4a | town, castle, dialog, cutscene data, chest art fix, W15 | "R4a owns" | R0 |
| R4b | overworld, temple, B1 map, B9 data | "R4b owns" | R0 |
| R5 | paid and free art checkpoints | `assets-src/gen/kits.yaml`, `characters.yaml`, the new approved sheets, `cache/`, `ledger.jsonl`, `.gitignore` exceptions | none (sequential inside) |
| R6 | art wiring: W1's `temple_ruin_*` deco (or fallback C), M7's arches and signs, R5-2's `bridge_gap_stone` if used | `layouts/overworld.py`, `layouts/cornelia.py`, `tests/data/{overworldLayout,corneliaLayout}.test.ts` | R5, R4a, R4b merged |

**No file is shared within a wave.**
- `ExplorationScene.ts` is R1's alone; the chest call site (E1), talk-to-fight (B1), the gate message (T1) and the `backdrop` dispatch (N2) are done there by R1 against R0's types.
- `Menu.ts`, `Inventory.ts`, `DebugScenarioLoader.ts` and `ItemEffects.ts` are touched by R0, then by one tranche each.
- `NameEntryGrid.ts` is R3's (N1 and its `uiEventBus()` line); `FieldMenuScene.ts` line 21 is R3's.
- `build_assets.py`, `gen/selftest.py` and the `characters-ai` atlas are R4a's (M6, W15); `stage_backgrounds.py` and `shoreline.webp` are R2's.
- `actOneBalance.test.ts` is R2's; R4b only mirrors the legacy temple map it reads. `act1Flow.test.ts` is R4a's; R4b only relies on it.
- R6 runs alone after wave 1 and edits files R4a and R4b owned.

**Order:**
1. R0 on `r-integration`.
2. **Wave 1:** R1, R2, R3, R4a, R4b in parallel worktrees from `r-integration`; R5 at the same time in the main checkout, R5-1 first (free), the paid checkpoints only per decisions R-10 / R-12.
3. Merge R1 → R2 → R3 → R4a → R4b, then R5.
4. **Wave 2:** R6.
5. **Integration:** run the layout scripts by name (`overworld.py`, `cornelia.py`, `interiors.py`, `castle.py`), then `build_map.py` for every map; a second run gives no diff (`git diff --exit-code assets-src/maps assets/maps/ai`). Then `build_assets.py field_ai characters` and `stage_backgrounds.py shoreline`.

**Validation:**
- `npm run build`, `npm test`, `npx vitest run tests/data tests/balance` (with the new bounds);
- `python3 -I assets-src/tools/build_map.py --selftest` and `--check-determinism`; `python3 -I assets-src/tools/terrain/selftest.py`; `python3 -I assets-src/gen/selftest.py` (main checkout); `stage_backgrounds.py --check shoreline`;
- `map_report.py cornelia cornelia-castle cornelia-castle-2f cornelia-castle-tower cornelia-castle-cellar temple-of-fiends overworld` and the interiors;
- every browser check above, 0 console errors, plus one New Game → rescue → King play-through (the T2 warp, the throne-room arrival, `act1_complete`);
- file sizes: the new modules and every touched scene < 250 lines; the monitored exceptions no longer than today;
- `AGENTS.md`: the `warp` and `backdrop` steps, `ScriptedEncounter.npc`, conditional gate messages, `SaveData.location`, `BossPhase.hits/attack`, the new debug scenarios and sheets, and the updated monitored-file sizes;
- an R result section in this file.

**Process:** as before: momus reviews this plan, then the implementation, before each commit.

---

### 6. Decisions for the user

Each has a recommended default; the orchestrator proceeds on the defaults unless told otherwise.

1. **R-1, Garland's phase and the temple-run bound (B1):** 2 → 3 hits at ≤ 25 % HP (default), or attack +2 at ≤ 50 %. With it, accept a temple-run-then-Garland bound of ≥ 80 % at Lv 2 (measured 85 %) instead of T4's ≥ 85 %. **Default: 3 hits; accept ≥ 80 %.**
2. **R-2, turn order (B7):** (a) agility × (1 + random), modern and balance-neutral (default); (b) FF1's pure shuffle (the temple-run bound drops to ≥ 75 %); (c) keep strict agility order and only fix the tie-break.
3. **R-3, escape (B9):** cap 75 % and −5 % per extra enemy (default), or keep FF1's formula and cut the Thief's luck growth from +3 to +1 per level.
4. **R-4, a heal or buff on an ally who fell this round (B4):** spend no charge (default, as BA-3 does for enemies), or waste it as FF1 does.
5. **R-5, beach backdrop (B14):** the free mirrored-rock composite for `shoreline` now (default; 15 % water under the enemies), or 1–3 paid images. `river`, `swamp` and `waterfall` have the same flaw: recorded for later (default) or fixed now with the same composite.
6. **R-6, T2 arrival:** the 2F throne room facing the King, then the player talks to him to start `act1_complete` (default, FF1-like); or chain straight into the King's scene; or arrive at the 1F gate.
7. **R-7, M12:** the camera keeps rooms above the HUD band (default; exits stay visible), or the HUD fades out when the hero walks under it.
8. **R-8, magic shop slots (E4):** drop the slot step; spells fill in order as in FF1 (default; the slot was never stored), or real slot positions (a `Character` and save-format change).
9. **R-9, the King (M13):** he steps down to (21,8) in front of the throne, so the chair shows (default, free), or a seated frame (1–3 images).
10. **R-10, gates and signs (M7):** one paid `town/kit_gates` sheet within budget (default; 1 expected, 3 max), plus the free turret flanking either way; or free only, with no tavern or shrine signs.
11. **R-11, NPC sprites (M8):** free reassignment of the approved sprites only (default), or 2–4 new NPC sheets (1–3 images each).
12. **R-12, temple icon door (W1):** accept the cached free render's 12–13 px doorway if it is centred within ± 6 px and reads at 2x (default; saves 1–3 images).
13. **R-13, south-gate footbridge (W6):** accept that it shortens the S gate → temple walk from 29 to 23 steps and relax the T3 bound to 20–40 (default).
14. **R-14, overworld rate (W4):** `{10, 22}` (default; about 40 % more field battles per step, still about 1 battle on the short routes).
15. **R-15, loot and scope:** the knight's chest becomes an Iron Helm, the cellar a Hi-Potion, Wooden Armour and a Robe (M10), the east pocket an Iron Shield (W12); the temple keeps its size (W13); no new act-1 species (W5). **Default: as listed.**
16. **R-16, smaller UI choices:** Load always asks for confirmation (S5); Status shows the battle DEF (armour absorb) under "DEF" (E8); inactive menu cursors turn grey rather than hide (E3); a full bag leaves the chest closed (E1); Equip reopens on the first member (E9); cancel advances dialogs like confirm (I2); the shrine is fixed in text only, with no free heal (T6); the opening is shortened text over the `dark_forest` and `grassland` backgrounds (N2). **Default: as listed.**

### R decisions (orchestrator defaults, reported to the user)

| Topic | Decision |
|---|---|
| Temple run, then Garland, at Lv 2 | ≥ 80 % (eased from T4's 85 %) |
| Turn order | agility × a random factor |
| Escape | capped at 75 %, minus 5 % per extra enemy |
| Rescue arrival (T2) | the throne room, facing the King |
| Gate art (M7) | one paid image is allowed |
| Temple icon (W1) | re-cut the cached render, accepting its 12–13 px door; pay only if it fails review |
| South gate (W6) | add the footbridge; the route test's lower bound becomes 20 |
| Overworld encounter rate | `{10, 22}` |
| Chest loot | as the plan proposes |
| King, spell learning, Load | the King stands in front of the throne; spell learning has no slots; Load always confirms |
| Recorded, not fixed | the `river`, `swamp` and `waterfall` backdrops also put enemies on water |

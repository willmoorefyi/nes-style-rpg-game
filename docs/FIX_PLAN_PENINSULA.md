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

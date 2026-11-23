# FF1-Style NES RPG — Project Progress

This document tracks implementation progress across all 18 development phases.

## Phases Completed (1-8)

### Phase 1: Project Scaffolding ✅
Vite + TypeScript + PixiJS setup, game loop, scene manager, asset loader.

**Status:** COMPLETE

### Phase 2: Core Systems Foundation ✅
Input manager, data loader, event bus, entity types.

**Status:** COMPLETE

### Phase 3: Tilemap & Rendering ✅
Tilemap renderer, camera, sprite animation, collision map.

**Status:** COMPLETE (built in parallel with Phase 4)

### Phase 4: UI Framework ✅
NES-style windows, text renderer, menu system, dialog box.

**Status:** COMPLETE (built in parallel with Phase 3)

### Phase 5: First Playable ✅
Player movement, map transitions, NPC interaction, ExplorationScene.

**Status:** COMPLETE (had significant challenges — see below)

### Phase 6: Party & Character Data ✅
Party manager, 6 character classes, equipment slots, status screen.

**Status:** COMPLETE

### Phase 7: Combat Core ✅
Battle state machine, command menu, damage formulas, turn order, enemy AI, BattleScene.

**Status:** COMPLETE

### Phase 8: Random Encounters (Vertical Slice) ✅
Step counter, encounter tables, battle transitions, victory/defeat flow.

**Status:** COMPLETE

---

## Phases Completed (9-13)

### Phase 9: Magic System ✅
Spell charge system (not MP), elemental damage, status effects, spell targeting, magic damage formula.

**Status:** COMPLETE

### Phase 10: Items & Equipment ✅
Field menu, item registry, consumable effects, equip UI, key items.

**Status:** COMPLETE

### Phase 11: Save/Load System ✅
Story flags (GameFlags), game state serialization/deserialization, save slots, localStorage persistence.

**Status:** COMPLETE

### Phase 12: Shops & Economy ✅
Shop scene, magic shop scene, inn scene, quantity selector, buy/sell flow.

**Status:** COMPLETE

### Phase 13: Audio System ✅
AudioManager, Web Audio API, music/SFX playback, EventBus integration.

**Status:** COMPLETE

---

## Phases Completed (14-17)

### Phase 14: Boss Battles & AI ✅
AIBehavior redesign from interface stub to full implementation. BossAI with multi-phase bosses, scripted encounters, cutscene system with CutsceneManager and CutsceneRegistry.

**Status:** COMPLETE

### Phase 15: Vehicles & World ✅
Terrain types, 4 movement modes (walk, ship, canoe, airship), VehicleManager, key item gates via KeyItemGateSystem.

**Status:** COMPLETE

### Phase 16: Class Upgrades ✅
6 upgraded classes (Warrior→Knight, Thief→Ninja, Monk→Master, White Mage→White Wizard, Black Mage→Black Wizard, Red Mage→Red Wizard). ClassUpgradeSystem with NPC-triggered upgrades at story milestones.

**Status:** COMPLETE

### Phase 17: Content Population ✅

**Sub-phases:**
- **17a: Content Tooling** ✅ — Validation script, content templates, content guide
- **17b: Content Maps** ✅ — Overworld, Cornelia, Temple of Fiends, 12 enemies, encounter tables
- **17c: Content Items/Spells** ✅ — 42 items, 34 spells, 18 shops
- **17d: Content Dialog** ✅ — Conditional dialog, story flags, cutscene registry

**Phase 17d deliverables:**
- `ConditionalDialog` type + `resolveNPCDialog()` for flag-based NPC dialog branching
- Story flag constants (`STORY_FLAGS`) in `GameFlags.ts`
- Cornelia NPCs with conditional dialog (guard, old man change after princess rescue)
- Garland pre-battle dialog and post-victory cutscene (`cutscenes.yaml`)
- `CutsceneRegistry` for loading cutscene scripts from YAML
- `requiredFlag` on `MapTransition` for flag-gated map transitions
- `postVictoryCutscene` on `ScriptedEncounter` for post-boss cutscenes
- `showDialog` event on `EventBus` for cutscene dialog integration
- 27 new tests (conditional dialog, NPC dialog validation, cutscene registry)

**Status:** COMPLETE

---

## Phase 18: Polish & Balancing ✅

Stat tuning, bitmap font, performance optimization, accessibility review, and playtest documentation.

**Deliverables:**
- Resolved all `[DEFERRED: PLAYTESTING]` items from design doc
- Stat and damage balancing pass across all tiers
- Boss difficulty tuning (Garland, Lich, Fiends)
- Encounter table balancing (per-area difficulty progression)
- Bitmap font replacement for NES-authentic text rendering
- Performance profiling and optimization
- Accessibility review (keyboard nav, contrast, readability)
- `docs/PLAYTEST_RESULTS.md` — playtesting methodology, progression analysis, class viability, tuning guide

**Status:** COMPLETE

---

## All 18 Phases Complete 🎉

The game is feature-complete with full content, balancing, and documentation. See `docs/PLAYTEST_RESULTS.md` for the balance tuning guide.

---

## Challenges Encountered

### 1. White Screen Bug (Phases 1-5)

After implementing Phases 1-5, the game rendered a blank white/black screen with no visible output or console errors.

**Root cause investigation revealed MULTIPLE compounding issues:**

- **Silent error swallowing:** `ExplorationScene.loadMap()` had a try/catch that silently returned on failure, hiding all asset loading errors with no console output or visual feedback.
- **Missing art assets:** No `tileset.png` or `player.png` existed. The `Texture.WHITE` fallback made everything white-on-white (invisible tiles on invisible background).
- **No placeholder graphics:** The rendering pipeline assumed real art assets would exist, with no programmatic fallback for development.

**Resolution:**
- Created a `PlaceholderTextures` system that generates colored rectangles via PixiJS Graphics→RenderTexture (gray walls, green ground, blue player, orange NPCs).
- Added `window.onerror`/`onunhandledrejection` handlers that render errors visually on the page.
- Removed silent error swallowing across the codebase — errors now surface via `console.error` and on-screen display.
- This required 3 fix commits to fully resolve.

**Lesson:** The class of bug (silent error swallowing + invisible fallback rendering) was more dangerous than any single instance. The fix addressed the pattern, not just the symptom.

### 2. Git Author Attribution

Commits made by subagents were attributed to `Kiro Agent <agent@kiro.dev>` instead of the project owner.

**Resolution:** Used `git filter-branch` to rewrite all commit authors to `Will Moore`, followed by ref cleanup and gc.

### 3. Parallel Phase Implementation

Phases 3 (Tilemap) and 4 (UI Framework) were successfully built in parallel using GitWorktree isolation since they had no shared files.

**Outcome:** This pattern was validated and can be reused for future independent phases (e.g., Phases 9-12).

---

## Post-Phase-18 Improvements

After all 18 phases were complete, additional polish and refactoring work was done:

### FEAR Spell Effect ✅
The `debuff_morale` spell effect is no longer a no-op. FEAR now applies the `fear` status to all living enemies. Feared combatants have a 50% chance to skip their turn. Works symmetrically — both enemies and party members can be affected.

### BattleScene Decomposition ✅
`BattleScene.ts` was reduced from 1,169 lines to ~508 lines by extracting 6 modules into `src/scenes/battle/`:
- `BattleSceneTypes.ts` — shared interfaces
- `BattleLayoutEngine.ts` — pure enemy layout function
- `BattleDisplayManager.ts` — sprite creation and status updates
- `BattleFieldTargeting.ts` — targeting state machine
- `BattleAnimationController.ts` — animation phases with result display
- `battleMessageUtils.ts` — message formatting utilities

### Lazy Scene Loading ✅
`SceneManager.registerLazy()` with factory caching. 10 scenes lazy-loaded via dynamic `import()`. Main bundle reduced from 551KB to 430KB (−22%). Only `TitleScene` is eagerly loaded.

### Battle Result Messages ✅
Turn list entries in the bottom-right command window show concise action+result (e.g., `THIEF: Fight → 11 to Skeleton`, `W.MAG: CURE → 30 HP to FGHTR`). Multi-target spells consolidated. Scrollable when entries exceed visible area. End-of-round confirm-wait with blinking ▼ prompt.

### Dead Combatant Turn-Skip ✅
Defeated enemies and KO'd party members have their queued actions silently skipped. `isNextActorAlive()` check in both the animation layer and state machine (defense-in-depth).

### Early Battle End ✅
Battle ends immediately when all enemies (or all party) are eliminated mid-round. `skipRemainingActions()` clears the queue and transitions state. No more phantom turns after a side is wiped out.

### Status Effect Display ✅
Turn list shows status labels for skipped turns: `Goblin: Asleep`, `THIEF: Stunned`, `Goblin: Afraid`. Poison+sleep combo: `Asleep (5 poison)`. Generic handling via `→` prefix convention.

### Battle Backgrounds ✅
Optional `background` image field in `BattleSceneConfig`. Loaded via PixiJS `Assets.load()` with cover-mode scaling. Falls back to two-tone solid fill. Debug scenario uses `grassland-hd.png`. Assets stored in `assets/backgrounds/`.

### Minor Fixes ✅
- Kill indicator uses `*` instead of `☠` for NES font compatibility.
- `.playwright-mcp/` and `.yolo-sisyphus/` added to `.gitignore`.

### Act 1 Remediation Passes R and U ✅
- **R** (second playtest): R0–R6 on `r-integration` — battle, engine, menus, map and data fixes, 1 paid image (26 of 100). 49 planned browser checks pass. See "R result" in `docs/FIX_PLAN_PENINSULA.md`.
- **U** (third playtest, U1–U22): input hold-offs, Game Over Return to Field, Garland 340 HP / attack 9 against the 400 G kit, turn-list targets, equip-now, and map and opening fixes; no paid art. 23 browser checks pass, 6 partial (U19, M7, W14 open). See "U result".

### Pass NW: the natural world ✅
The boxy 192x192 pass-W world (rectangular region boxes, straight sea lanes, mountain slabs) is replaced by one
generated 256x256 world (`docs/NATURAL_WORLD_PLAN.md`, tranches NW-0 to NW-INT, results in its sections 11-17).
- **Generator** (`assets-src/tools/worldgen/`, preset B, seed 1987): shape, relief, hydrology, climate, stamps, roads
  and finish over the whole map; regions own content, not ground (`world_specs/<region>.py`); act 1 regenerated round
  its pins (`a1/world_a1_pins.py`, Cornelia-relative). `world.py` is the only composer and prints every check.
- **Measured** (pass W in brackets): coast index 34.1 (19.7), straight coast runs of 8+ edges 0 (40, longest 50),
  land 26,847 cells (21,089), mountains 15.5 % of land (28 %); snow 8.5 % and tundra 4.8 % in the far north (new
  terrains: walkable, the airship lands on tundra only; pass NW2 replaced tundra with taiga, below).
- **Game:** spots name every world place (`spots:`, `at: <spot>`); save v4, an older save on the world map or owning a
  ship or airship resets to Cornelia with a one-time notice; the Mode 7 atlas is 3072² at 12 px per cell; per-zone
  step means keep each stage's level within 0.2 of pass W's; the verifier's state cap is 3,000,000.
- **Gates:** `npm run quest -- --strict --mutate` OK (64 gate rows, 105 elements, 2 h 14 min); `--from-reset` OK;
  both determinism checks; the full test suite. NW-INT's browser checkpoints (the opening walk and the bridge, the
  ship round the Aldi, the canal, the canoe to Gurgu, an airship landing on tundra and a refusal on snow, a Mode 7
  flight over the north, a v3 save reset) all pass with no console error; screenshots in `~/temp/ff-game/nw_int/`.

### Pass NW2: edits to the natural world ✅
Five requested edits to the NW world (`docs/NW2_EDITS_PLAN.md`, tranches NW2-0, T, E, F, W, N, S, BAL and INT; the
results at the end of the plan). Every stage's `requires`, `grants`, `after` and `boss` are unchanged.
- **Taiga** replaces tundra (TerrainType 12): walkable at forest's speed, no ship or canoe, no airship landing (the
  airship lands on grass only). It covers 34.5 % of the north's walkable non-snow land (gate >= 30 %).
- **Canoe gorges:** Gurgu is reached only through the Cinder Gorge from Crescent Lake (54 forced canoe steps), and the
  Ice Cavern moved to the tip of Crescent's peninsula, in the walled Rime Hollow, reached from its own new ocean dock
  `fir_ice` and the Rime Gorge (47).
- **Mount Duergar** moved north of the canal into the mainland's west lobe, with its Aldi dock, behind the new
  `duergar_range` (walled off from Matoya on foot and canoe).
- **Dock audit:** every town that needs a dock has one in a basin the ship reaches at its band stage (`dock_towns`).
- **Hikes:** Onrac, the caravan, the waterfall, the Mirage and Lufenia have no landing within 25 steps and one within
  50 (d 26-32 / 31-35).
- **Balance:** four zone factors re-fit under caps, S16 / S17 grind lowered; every stage within 0.11 of NW's level.
- **Saves:** version 5; a v4 save is revalidated on load (a ship off open water moves to a dock in the party's reach,
  an airship on rock moves to a landing, a stranded party resets to Cornelia).
- **Gates (NW2-INT):** the full compile reproduces the committed world byte for byte; both determinism checks; every
  `world.py` line OK; `npm run quest -- --strict` and `--from-reset` OK; `--mutate` OK (68 gate rows, 109 elements, 72 min);
  `npm run build`; `test:fast` 403 files, 9,680 tests. Browser checkpoints in `~/temp/ff-game/nw2/int/`.

### Pass CD: Cardia Deep, the dragon great village ✅

The user's request (2026-11-22): Cardia's islands should work as in classic FF1, each with a way down to the dragons,
all joined into one village with many ways in and out. Brief `docs/DRAGON_CITY_BRIEF.md`, plan and result
`docs/CARDIA_PLAN.md`, concept art `docs/art/cardia/`.
- **World:** a cave mouth on Bahamut's isle and on the north, east, stack and west islets, five doors into one map
  (`world_specs/later_doors.py`); four new airship landings; every `world.py` check OK (exemptions 440 of 600).
- **The village:** `cardia-deep` (72x60): nine districts round the Wyrmhall, Bahamut's Court, five wild warrens with
  the old cave's fights, ward arches, the new `dragon` theme sheet and the drake brazier, 24 named dragon-kin plus
  `bahamut_after`, four new NPC sheets (Bahamut, the hatchling, the matron, the sage). Every stair leads back to its
  own islet. `bahamut-cave` / `bahamut-lair` retired; saves inside them load in the village (`retiredMaps.ts`).
- **Progression:** S19 unchanged but for its maps; the curve within 0.02 of the baseline at every stage.


### Pass AV: airship front and back views (T-2) ✅

The user's feedback (2026-11-22): the airship had no view for flying away from or toward the camera. Plan and result
`docs/AIRSHIP_VIEWS_PLAN.md`, art `docs/art/airship_views/`.
- **Art:** back and front 3/4 views and two turn in-betweens, matched to b_7: PA's pseudo-3D proxies restyled by
  Bedrock style transfer, re-cut offline by `assets-src/gen/vehicle_view_cut.py` with cleanup edits and the centroid
  anchor rule (the ship's visual centre stays put when it turns). No new Bedrock call. Self-approved under the
  integrator's R6 ruling; the user may veto.
- **Runtime:** one pure heading model (`airshipHeading.ts`) with one owner (`FieldVehicleSprites`); up shows the back
  view, down the front, left / right b_7, in the top-down field and in Mode 7 alike (D-M9 superseded). Boarding keeps
  the parked heading; a landed airship keeps its heading. Movement, the field rules and the verifier are unchanged.
- **Gates:** `test:fast` 413 files, 10,025 tests; `quest --strict` OK; browser shots in `~/temp/ff-game/airship_views/int/`.


### Pass WR: the world map wraps (FF1's torus)

The user's request (2026-11-22): "the edge of the world is weird from the airship ... in classic FF you could fly from
north to south and east to west". Plan and result `docs/WORLD_WRAP_PLAN.md`.
- **Runtime:** every mode crosses x 255 | 0 and y 255 | 0 on the world map (`MapData.wrap`, `src/systems/worldWrap.ts`);
  the camera never clamps there; chunks, patches, NPCs, smoke and parked vehicles draw at their image nearest the
  camera (`WrapImages`, the layer sentinels, `vehicleParts`). Mode 7's far atlas repeats; the low atlas is 2048² (POT).
- **World:** the seam stays open ocean (`wrap` and `check_seam` gates); four seam spots and the `wr_*` previews; sea
  zones unchanged (report-only `seam_zones`). Chunks unchanged.
- **Verifier:** routes cross the seam; (c) unchanged at 847,265 states; `WRAP` in (h); (g) planar.
- **Balance:** every stage from S14 on gains up to +0.38 levels (the wrapped witnesses' routes); by the user's ruling
  S21's band is [25, 29] (L29.2) and the plan's fallback seam zones are not used. `quest --strict` OK.

---

## Current Metrics

- **Tests:** 2625 (all passing)
- **Test files:** 159
- **Source files:** 80+ TypeScript files
- **Phases complete:** 18/18

# FF1-Style RPG — Comprehensive Code Audit

**Date:** $(date +%Y-%m-%d)
**Scope:** All 35 source files, 26 test files, 2 data files, 3 config files
**Stack:** PixiJS 8 + TypeScript 5.3 + Vite 5 + Vitest 1.6

---

## 1. Architecture & Code Organization

### Directory Structure
```
src/
├── core/       (7 files) — Game, SceneManager, AssetLoader, DataLoader, EventBus, InputManager
├── battle/     (5 files) — BattleStateMachine, BattleCommands, DamageFormula, EnemyAI, TurnOrder
├── scenes/     (5 files) — Boot, Exploration, Battle, GameOver, Status
├── systems/    (4 files) — EncounterSystem, EncounterTable, MapTransition, NPCInteraction
├── entities/   (4 files) — Character, NPC, PartyManager, PlayerController
├── rendering/  (5 files) — Camera, CollisionMap, PlaceholderTextures, SpriteAnimation, TilemapRenderer
├── ui/         (5 files) — DialogBox, ErrorDisplay, Menu, TextRenderer, Window
├── types/      (1 file)  — All shared interfaces
└── main.ts     (1 file)  — Entry point
```

**Verdict: GOOD.** Clean separation of concerns. Module boundaries are well-defined. Each directory has a clear responsibility.

### Dependency Flow
- `core/` → no game-specific imports (except Game.ts → PartyManager)
- `battle/` → imports from `entities/`, `types/` only (no rendering deps — good)
- `scenes/` → imports from everything (expected — scenes are composition roots)
- `systems/` → imports from `core/`, `entities/`, `types/` (clean)
- `rendering/` → imports from `types/` only (clean)
- `ui/` → imports from `core/` (InputManager only)

### Circular Dependencies: NONE DETECTED
All imports flow downward. No circular references found.

### Scene Manager Pattern
- Clean register/switchTo pattern with async enter/exit lifecycle
- **BUG: `SceneManager.pop()` is called in `StatusScene.ts:39` but does NOT exist on SceneManager.** This will crash at runtime when the user tries to exit the status screen. SceneManager only has `register`, `switchTo`, and `update`.
- No scene stack — only single active scene. This will need refactoring for overlay scenes (status, shops, menus).

---

## 2. Code Quality

### TypeScript Strictness
- `tsconfig.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true` — **excellent**
- **Zero `any` usage in source code** — verified via grep
- No `@ts-ignore` or `@ts-expect-error` anywhere

### Error Handling
Post white-screen fix, error handling is mostly good:
- `main.ts`: Global `window.onerror` + `onunhandledrejection` handlers ✅
- `ExplorationScene.loadMap()`: Catches errors, shows via ErrorDisplay ✅
- `MapTransition.loadMap()`: Catches errors, logs to console ✅
- **REMAINING SILENT CATCH:** `ExplorationScene.loadEnemyData()` line 211 has `catch { /* ignore */ }` — this silently swallows enemy data loading failures. If `enemies.json` fails to load, battles will silently have no enemies.

### Naming Conventions
Consistent throughout: PascalCase classes, camelCase methods/properties, UPPER_CASE constants. No issues.

### Code Duplication
- **`EquipmentSlot` type is defined TWICE:** `src/types/index.ts:108` AND `src/entities/Character.ts:3`. The one in `types/index.ts` is never imported by Character.ts — it uses its own local copy.
- `wrapText()` is duplicated in both `TextRenderer.ts` and `DialogBox.ts` with identical logic. Should be extracted to a shared utility.
- `createMapData()` helper is duplicated across 3 test files.

### Dead Code
- `BootScene` — registered but never switched to (main.ts goes directly to 'exploration')
- `types/index.ts` exports `EquipmentSlot` but nothing imports it (Character.ts has its own)

---

## 3. Data-Driven Design

### Current State
| Data Type | JSON File | Status |
|-----------|-----------|--------|
| Enemies | `assets/data/enemies.json` | ✅ EXISTS (2 enemies: Goblin, Wolf) |
| Maps | `assets/maps/test-town.json` | ✅ EXISTS (minimal 10x10 test map) |
| Classes | `assets/data/classes.json` | ❌ MISSING |
| Items | `assets/data/items.json` | ❌ MISSING |
| Spells | `assets/data/spells.json` | ❌ MISSING |

### Assessment
- **DataLoader is well-designed** — typed loaders for each data type with validation (assertArray, object checks)
- **Design doc promises data-driven design** — the architecture supports it, but 3 of 5 data files don't exist yet
- **No schema validation beyond "is it an array/object"** — DataLoader doesn't validate individual fields. A malformed enemy entry (missing `stats.hp`) would cause runtime crashes, not load-time errors.
- **test-town.json is minimal** — `layers: [[0]]` is a single-element array, `collision: []` is empty, `npcs: []` is empty. This is a skeleton, not a real map.
- **Encounter data IS in JSON** — test-town.json has `encounterRate` and `encounters` fields, which is good.

### Data Loading Pipeline
`Game.data (DataLoader)` → `AssetLoader` → `PixiJS Assets` → JSON fetch
- Robust for happy path
- Missing: retry logic, loading progress, preloading strategy

---

## 4. Test Coverage & Quality

### Coverage Summary
- **173 tests across 26 test files** — all passing
- **Test ratio:** 26 test files / 35 source files = 74% file coverage

### Untested Files (9 files)
| File | Risk Level | Notes |
|------|-----------|-------|
| `battle/BattleCommands.ts` | MEDIUM | `retargetIfDead` and `calculateRunChance` — pure functions, easy to test |
| `scenes/BattleScene.ts` | HIGH | Complex UI+logic integration, 250 lines |
| `scenes/GameOverScene.ts` | LOW | Simple display |
| `scenes/StatusScene.ts` | MEDIUM | Uses non-existent `scenes.pop()` — would crash |
| `scenes/BootScene.ts` | LOW | Empty placeholder |
| `ui/ErrorDisplay.ts` | LOW | Simple display |
| `entities/NPC.ts` | LOW | Simple data class |
| `core/Game.ts` | MEDIUM | Integration root — hard to unit test |
| `types/index.ts` | N/A | Just type definitions |

### Test Anti-Patterns
1. **Private member access via `as unknown as`** — `InputManager.test.ts` accesses `currentKeys` private field 5 times. This couples tests to implementation details. Should use `attach()` + simulated KeyboardEvents instead.
2. **Loose mock typing** — `ExplorationScene.test.ts` creates a mock Game with `as unknown as Game` that only implements a subset of the interface. Changes to Game will silently break these tests.
3. **No integration tests** — all tests are unit-level. No test verifies the full battle flow from encounter trigger → battle → victory → XP distribution → return to exploration.

### Test Quality: GOOD overall
- Deterministic RNG injection throughout battle tests (excellent)
- Edge cases covered (empty arrays, boundary conditions, wrap-around)
- Clean test structure with describe/it blocks

---

## 5. Rendering & Performance

### PlaceholderTextures System
- Generates colored rectangles via `Graphics → RenderTexture` — correct approach
- Caches textures per tile ID — no redundant generation
- Falls back to `Texture.WHITE` if renderer unavailable — safe
- **Player sprite is hand-drawn with Graphics** (blue body + lighter blue head) — charming placeholder

### Tilemap Rendering
- **Sprite pooling** — reuses sprites across frames, hides unused ones. Good for performance.
- **Camera culling** — only renders tiles within viewport bounds. Essential for larger maps.
- **No dirty flag** — `render()` is called every frame even if nothing changed. For a 16x15 tile viewport this is fine, but could be optimized later.

### Performance Concerns
- **TilemapRenderer.render() rebuilds every frame** — acceptable for NES-scale (256x240), but should add dirty checking before Phase 17 (content population with larger maps).
- **Enemy data reloaded from JSON on every battle** — `loadEnemyData()` fetches `enemies.json` each time, though results are cached in `enemyDataCache`. First battle per enemy type has a network round-trip.
- **No texture atlas** — each placeholder tile is a separate RenderTexture. Fine for dev, but real art should use spritesheets.

---

## 6. Battle System

### State Machine Design
```
intro → command_select → execution → resolution → victory/defeat
                ↑                         |
                └─────────────────────────┘ (if battle continues)
```
- Clean state transitions with guard clauses (`if (this._state !== 'X') return`)
- Injectable RNG for deterministic testing — excellent design
- **No state for "fleeing"** — run is handled inline during execution, which works but is less extensible

### Damage Formula
```
damage = attack - defense + random(1, level)
critical = 2x damage (1/32 chance)
minimum damage = 1
```
- FF1-faithful formula
- Hit/evade system with configurable percentages
- **Missing: elemental damage, magic damage formula, status effects** — needed for Phase 9

### Turn Order
- Agility-based with random tiebreaking
- Simple and correct
- **No speed/haste modifiers** — will need extension for magic buffs

### Enemy AI
- Random target selection among living party members
- **Extremely basic** — no priority targeting, no spell usage, no boss patterns
- Adequate for Phase 8, but Phase 15 (Boss Battles) will need a complete AI rewrite

### Extensibility for Phase 9 (Magic)
- `BattleStateMachine.executeCommand()` already has a `cmd.type === 'magic'` branch — currently returns "No spells available"
- `Character` has `spellCharges` array (8 levels) and `getSpellCharges`/`setSpellCharges` methods
- `SpellData` interface exists in types with `targeting: 'single' | 'all' | 'self'`
- **GOOD foundation** — magic system can be added without restructuring the battle flow

---

## 7. UI System

### Menu System
- Cursor-based navigation with wrap-around
- Disabled item support (grayed out, non-selectable)
- `onSelect`/`onCancel` callbacks
- **No scrolling** — if items exceed visible area, they'll overflow. Needs scroll support for spell lists and shop inventories.

### NES-Style Window Chrome
- White outer border → dark inner border → blue background
- 8px content padding on all sides
- Resize support
- **Authentic FF1 look** ✅

### Text Rendering
- Character-by-character reveal with configurable speed
- Word wrapping with configurable width
- `complete()` method for instant reveal on button press
- **No font system** — uses browser monospace. Phase 18 should add a bitmap font for authentic NES look.

### Dialog System
- Pagination with configurable lines per page
- Word wrapping
- Confirm to advance/complete
- `onComplete` callback for dialog flow

### Readiness for Phase 9 (Spell Menus) and Phase 11 (Shops)
- Menu component is reusable but **lacks scrolling** — critical for spell lists (8 levels × multiple spells)
- Window component is solid
- **No "two-column" or "grid" menu layout** — shops typically show item + price side by side
- **No quantity selector** — needed for buy/sell

---

## 8. Readiness for Phases 9-18

### Phase 9: Magic System — READY (minor work needed)
- ✅ SpellData interface exists
- ✅ Character has spell charge tracking
- ✅ Battle state machine has magic command branch
- ⚠️ Need: spell effect execution engine, targeting UI, spell data JSON file
- ⚠️ Need: magic damage formula (separate from physical)

### Phase 10: Items & Equipment — MOSTLY READY
- ✅ ItemData interface exists with type/stats/usableBy
- ✅ Character has equipment slots and canEquip logic
- ❌ No inventory system (no item storage, no item count tracking)
- ❌ No items.json data file
- ⚠️ Need: Inventory class, consumable use in battle

### Phase 11: Shops & Economy — NEEDS WORK
- ✅ PartyManager has gold tracking
- ❌ No shop data structure
- ❌ Menu lacks scrolling and grid layout
- ❌ No quantity selector UI
- ⚠️ Need: ShopScene, buy/sell logic, Inn mechanic

### Phase 12: Save/Load — READY
- ✅ Character.toJSON() and PartyManager.toJSON() exist
- ❌ No deserialization (fromJSON) methods
- ❌ No game state aggregation
- ⚠️ Need: SaveManager, localStorage integration, save slot UI

### Phase 13: Audio — READY (no blockers)
- No audio code exists yet
- Clean event bus can trigger audio on game events
- ⚠️ Need: AudioManager, asset loading for audio files

### Phase 14: Vehicles — NEEDS REFACTORING
- PlayerController is tile-based walking only
- ❌ No movement mode abstraction
- ⚠️ Need: Movement strategy pattern, vehicle sprites, world map

### Phase 15: Boss Battles — NEEDS SIGNIFICANT WORK
- ❌ Enemy AI is random-only, no scripted behavior
- ❌ No multi-phase boss support
- ❌ No cutscene/scripted event system
- ⚠️ Need: AI behavior trees or scripted action sequences

### Phase 16: Class Upgrades — EASY
- ✅ Character class system is data-driven
- ⚠️ Need: upgrade trigger logic, new class data

### Phase 17: Content Population — READY (infrastructure exists)
- ✅ Data loading pipeline supports all content types
- ❌ Only 2 enemies and 1 skeleton map exist
- ⚠️ Need: 30+ enemies, 10+ maps, items, spells, NPCs

### Phase 18: Polish — N/A (depends on all prior phases)

---

## 9. Technical Debt & Risks

### Critical Issues (fix before Phase 9)
1. **`SceneManager.pop()` doesn't exist** — StatusScene calls it, will crash. Need to add scene stack support or change StatusScene to use `switchTo`.
2. **Silent catch in `loadEnemyData()`** — `catch { /* ignore */ }` at ExplorationScene.ts:211. This is the exact pattern that caused the white screen bug. Must add error handling.
3. **Duplicate `EquipmentSlot` type** — defined in both `types/index.ts` and `Character.ts`. Remove one.

### High Priority (fix during Phase 9-10)
4. **No scene stack** — current SceneManager only supports one active scene. Status screen, shop menus, and battle need to overlay on exploration. Need push/pop scene stack.
5. **Menu lacks scrolling** — will block spell selection and shop UIs.
6. **No inventory system** — Character has equipment but no item storage. Needed for Phase 10.
7. **Missing data files** — `classes.json`, `items.json`, `spells.json` don't exist. DataLoader supports them but they need to be created.

### Medium Priority (fix during Phase 11-14)
8. **No schema validation** — DataLoader checks "is array" but not field presence. Malformed data causes runtime crashes.
9. **`wrapText()` duplication** — identical in TextRenderer and DialogBox. Extract to utility.
10. **Test coverage gaps** — BattleScene (250 lines, complex) and BattleCommands (pure functions) are untested.
11. **InputManager tests access private members** — brittle, should use public API.

### Low Priority (Phase 17-18)
12. **No bitmap font** — uses browser monospace, not NES-authentic.
13. **No dirty flag on tilemap rendering** — re-renders every frame.
14. **BootScene is dead code** — registered but never used.

### Patterns That Will Cause Pain at Scale
- **ExplorationScene is a god object** (220+ lines) — handles map loading, player setup, NPC interaction, dialog, transitions, battles, and battle results. Should be decomposed before adding more features.
- **BattleScene is tightly coupled to Game** — takes full Game reference. Should take only what it needs (input, events, scenes).
- **No dependency injection** — Game creates all subsystems in constructor. Makes testing harder as the project grows.
- **Encounter system uses `Math.random()` directly** in `EncounterTable.selectEnemies()` and `EncounterSystem.resetCounter()` — not injectable, not testable deterministically.

---

## Summary Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| Architecture | A- | Clean module boundaries, no circular deps |
| TypeScript Quality | A | Strict mode, zero `any`, good typing |
| Error Handling | B | Mostly fixed, one silent catch remains |
| Data-Driven Design | B- | Infrastructure exists, 3/5 data files missing |
| Test Coverage | B | 173 tests, but 9 files untested including BattleScene |
| Rendering | B+ | Good pooling/culling, placeholder system works |
| Battle System | B+ | Solid foundation, extensible for magic |
| UI System | B | Good basics, needs scrolling for future phases |
| Phase Readiness | B | Phases 9-10 ready, 11+ need refactoring |
| Technical Debt | B- | 3 critical issues, manageable overall |

**Overall: B+** — Solid foundation for an 8-phase project. The architecture is clean and the code quality is high. The main risks are the missing scene stack, the silent catch in enemy loading, and the ExplorationScene god object. Address the 3 critical issues before starting Phase 9.

# FF1-Style NES RPG — Code Audit & Recommendations

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-22 |
| **Scope** | Full codebase audit — 35 source files, 26 test files, 2 data files, 3 config files |
| **Stack** | PixiJS 8 + TypeScript 5.3 + Vite 5 + Vitest 1.6 |
| **Project State** | Phases 1–8 complete (scaffolding through random encounters). Phases 9–18 pending. |
| **Overall Grade** | **B+** |

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Scorecard](#scorecard)
- [Critical Issues (Fix Before Phase 9)](#critical-issues-fix-before-phase-9)
- [Architecture Analysis](#architecture-analysis)
- [Data-Driven Design Assessment](#data-driven-design-assessment)
- [Test Coverage Analysis](#test-coverage-analysis)
- [Battle System Assessment](#battle-system-assessment)
- [UI System Assessment](#ui-system-assessment)
- [Phase Readiness Matrix](#phase-readiness-matrix)
- [Recommended Action Plan](#recommended-action-plan)
- [Risk Summary](#risk-summary)

---

## Executive Summary

The project has a clean architecture with strong TypeScript discipline (strict mode, zero `any` usage, no `@ts-ignore`). Module boundaries are well-defined with zero circular dependencies. 173 tests pass across 26 test files. The codebase is well-positioned for Phase 9 (Magic System) with minor fixes needed first. **Three critical bugs must be addressed before proceeding.**

---

## Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| Architecture | A- | Clean module boundaries, no circular deps |
| TypeScript Quality | A | Strict mode, zero `any`, good typing |
| Error Handling | B | Mostly fixed post-white-screen-bug, one silent catch remains |
| Data-Driven Design | B- | Infrastructure exists, 3/5 data files missing |
| Test Coverage | B | 173 tests, but 9 files untested including BattleScene |
| Rendering | B+ | Good sprite pooling/culling, placeholder system works |
| Battle System | B+ | Solid foundation, extensible for magic |
| UI System | B | Good basics, needs scrolling for future phases |
| Phase Readiness | B | Phases 9–10 ready, 11+ need refactoring |
| Technical Debt | B- | 3 critical issues, manageable overall |

---

## Critical Issues (Fix Before Phase 9)

### 1. SceneManager.pop() Does Not Exist

- **Location:** `src/scenes/StatusScene.ts:39`
- **Problem:** StatusScene calls `this.game.scenes.pop()` but SceneManager only has `register`, `switchTo`, and `update` methods. This will crash at runtime when the user tries to exit the status screen.
- **Fix:** Either add scene stack support (push/pop) to SceneManager — which is needed anyway for overlay scenes — or change StatusScene to use `switchTo('exploration')`.
- **Recommended:** Add scene stack support since it's needed for shops, spell menus, and battle overlays in Phases 9–11.

### 2. Silent Catch in loadEnemyData()

- **Location:** `src/scenes/ExplorationScene.ts:211`
- **Problem:** `catch { /* ignore */ }` silently swallows enemy data loading failures. This is the exact same pattern that caused the white screen bug in Phases 1–5. If `enemies.json` fails to load, battles will silently have no enemies.
- **Fix:** Replace with proper error handling — log the error and show via ErrorDisplay, or at minimum `console.error`.

### 3. Duplicate EquipmentSlot Type

- **Location:** `src/types/index.ts:108` AND `src/entities/Character.ts:3`
- **Problem:** `EquipmentSlot` is defined in both files. Character.ts uses its own local copy and ignores the canonical one in types/. This will cause confusion and potential type mismatches.
- **Fix:** Remove the duplicate from Character.ts and import from `types/index.ts`.

---

## Architecture Analysis

### Directory Structure (Clean)

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

### Dependency Flow

- `core/` → no game-specific imports (except Game.ts → PartyManager) ✅
- `battle/` → imports from `entities/`, `types/` only (no rendering deps) ✅
- `scenes/` → imports from everything (expected — scenes are composition roots) ✅
- `systems/` → imports from `core/`, `entities/`, `types/` ✅
- `rendering/` → imports from `types/` only ✅
- `ui/` → imports from `core/` (InputManager only) ✅
- **Zero circular dependencies detected**

### God Object Warning: ExplorationScene

At 220+ lines, ExplorationScene handles map loading, player setup, NPC interaction, dialog, transitions, battles, and battle results. Recommend decomposing before adding more features:

- Extract `BattleTriggerSystem` (encounter checks, battle transitions)
- Extract `DialogManager` (NPC dialog flow)
- Extract `MapLoader` (map loading, tile setup)

---

## Data-Driven Design Assessment

| Data Type | JSON File | Status |
|-----------|-----------|--------|
| Enemies | `assets/data/enemies.json` | ✅ EXISTS (2 enemies: Goblin, Wolf) |
| Maps | `assets/maps/test-town.json` | ✅ EXISTS (minimal 10×10 test map) |
| Classes | `assets/data/classes.json` | ❌ MISSING |
| Items | `assets/data/items.json` | ❌ MISSING |
| Spells | `assets/data/spells.json` | ❌ MISSING |

The DataLoader infrastructure is solid with typed loaders and basic validation. However:

- **No schema validation beyond type checks** — a malformed enemy entry (missing `stats.hp`) causes runtime crashes, not load-time errors.
- **No retry logic or loading progress** for data fetching.
- Missing data files should be created as part of their respective phases (spells.json in Phase 9, items.json in Phase 10).

---

## Test Coverage Analysis

### Untested Files (9 of 35)

| File | Risk | Recommendation |
|------|------|----------------|
| `scenes/BattleScene.ts` | HIGH | 250 lines of complex UI+logic integration. Add integration tests. |
| `battle/BattleCommands.ts` | MEDIUM | Pure functions (`retargetIfDead`, `calculateRunChance`). Easy to test — add unit tests. |
| `scenes/StatusScene.ts` | MEDIUM | Uses non-existent `scenes.pop()` — would crash. Fix bug first, then test. |
| `core/Game.ts` | MEDIUM | Integration root. Hard to unit test but should have smoke test. |
| `scenes/GameOverScene.ts` | LOW | Simple display scene. |
| `scenes/BootScene.ts` | LOW | Empty placeholder (dead code). |
| `ui/ErrorDisplay.ts` | LOW | Simple display utility. |
| `entities/NPC.ts` | LOW | Simple data class. |
| `types/index.ts` | N/A | Type definitions only. |

### Test Anti-Patterns to Address

1. **Private member access** — `InputManager.test.ts` accesses `currentKeys` via `as unknown as` (5 occurrences). Should use `attach()` + simulated KeyboardEvents.
2. **Loose mock typing** — `ExplorationScene.test.ts` creates mock Game with `as unknown as Game`. Changes to Game interface will silently break tests.
3. **No integration tests** — no test covers the full flow: encounter trigger → battle → victory → XP → return to exploration.
4. **Duplicated test helpers** — `createMapData()` is copy-pasted across 3 test files. Extract to shared test utility.

---

## Battle System Assessment

### State Machine (Clean)

```
intro → command_select → execution → resolution → victory/defeat
             ↑                         |
             └─────────────────────────┘ (if battle continues)
```

- Clean state transitions with guard clauses
- Injectable RNG for deterministic testing — excellent
- FF1-faithful damage formula: `damage = attack - defense + random(1, level)`

### Magic System Readiness (Phase 9)

- ✅ `BattleStateMachine.executeCommand()` has `cmd.type === 'magic'` branch (returns "No spells available")
- ✅ `Character` has `spellCharges` array (8 levels) with getter/setter
- ✅ `SpellData` interface exists in types with `targeting: 'single' | 'all' | 'self'`
- ⚠️ Need: spell effect execution engine, magic damage formula, targeting UI

### Gaps for Future Phases

- **No elemental damage system** — needed for magic and elemental weapons
- **No status effect system** — needed for spells like SLEP, HOLD, BANE
- **Enemy AI is random-only** — no priority targeting, no spell usage, no boss patterns
- **No speed/haste modifiers** in turn order — needed for FAST/SLOW spells

---

## UI System Assessment

### Strengths

- Authentic NES-style window chrome (white border → dark border → blue background)
- Cursor-based menu navigation with wrap-around and disabled item support
- Character-by-character text reveal with skip support
- Dialog pagination

### Gaps

- **No menu scrolling** — items that exceed visible area will overflow. Blocks spell selection (8 levels × multiple spells) and shop inventories.
- **No grid/two-column layout** — shops need item + price side by side.
- **No quantity selector** — needed for buy/sell in shops.
- **No bitmap font** — uses browser monospace. Should add NES-authentic bitmap font in Phase 18.

---

## Phase Readiness Matrix

| Phase | Status | Blockers | Effort to Unblock |
|-------|--------|----------|-------------------|
| 9. Magic System | ✅ READY | Minor: need spell data JSON, magic damage formula | Low |
| 10. Items & Equipment | ⚠️ MOSTLY READY | Need Inventory class, items.json | Low |
| 11. Shops & Economy | ⚠️ NEEDS WORK | Need scene stack, scrolling menus, quantity selector | Medium |
| 12. Save/Load | ✅ READY | Need fromJSON() methods, SaveManager | Low |
| 13. Audio | ✅ READY | No blockers — clean event bus for triggers | Low |
| 14. Vehicles | ⚠️ NEEDS REFACTORING | No movement mode abstraction in PlayerController | Medium |
| 15. Boss Battles | ❌ NEEDS SIGNIFICANT WORK | AI is random-only, no scripted behavior, no multi-phase | High |
| 16. Class Upgrades | ✅ EASY | Just needs upgrade trigger + new class data | Low |
| 17. Content Population | ✅ READY | Infrastructure exists, just needs content | Low (but time-intensive) |
| 18. Polish | N/A | Depends on all prior phases | — |

---

## Recommended Action Plan

### Pre-Phase 9 (Do First — ~1 day)

1. Fix `SceneManager.pop()` crash — add scene stack (push/pop) support
2. Fix silent catch in `ExplorationScene.loadEnemyData()`
3. Fix duplicate `EquipmentSlot` type
4. Add scrolling support to Menu component

### During Phase 9 (Magic System)

5. Create `assets/data/spells.json` with spell definitions from design doc
6. Implement spell effect execution engine
7. Add magic damage formula (separate from physical)
8. Build spell selection UI (leveraging new scrolling menus)
9. Add elemental damage system (needed for both magic and future elemental weapons)

### During Phase 10 (Items)

10. Create `assets/data/items.json`
11. Build Inventory class with item storage and count tracking
12. Add consumable use in battle

### During Phase 11 (Shops)

13. Add grid/two-column menu layout
14. Build quantity selector UI component
15. Implement ShopScene with buy/sell logic
16. Implement Inn rest mechanic

### Ongoing Technical Debt (Address Opportunistically)

17. Decompose ExplorationScene into smaller systems
18. Add schema validation to DataLoader
19. Extract duplicated `wrapText()` to shared utility
20. Extract duplicated `createMapData()` test helper
21. Replace private member access in InputManager tests
22. Add integration tests for battle flow
23. Remove dead BootScene code
24. Make `EncounterTable.selectEnemies()` and `EncounterSystem.resetCounter()` use injectable RNG

---

## Risk Summary

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ExplorationScene becomes unmaintainable | HIGH | HIGH (already 220+ lines) | Decompose before Phase 14 |
| Silent data loading failures | HIGH | MEDIUM | Fix remaining silent catch, add schema validation |
| No integration tests | MEDIUM | MEDIUM | Add battle flow integration test |
| Menu system can't handle complex UIs | MEDIUM | HIGH (shops/spells need it) | Add scrolling before Phase 9 |
| Non-injectable RNG in encounter system | LOW | LOW | Refactor when adding encounter rate tuning |

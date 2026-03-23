# FF1-Style RPG — Remediation Plan v2

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-22 |
| **Revision** | v2 (addresses momus review feedback) |
| **Input** | CODE_AUDIT_RECOMMENDATIONS.md, DESIGN_DOCUMENT.md, PROGRESS.md, momus-review-v1.md |
| **Issues Covered** | 24 of 24 (3 critical, 4 high, 4 medium, 3 low, 4 arch debt, 3 test anti-patterns, 3 missing abstractions) |
| **Work Packages** | 12 |
| **Estimated Total Effort** | ~42-60 hours |

---

## Changelog (v1 → v2)

| ID | Category | Change |
|----|----------|--------|
| M1 | Line numbers | WP-02: Fixed `loadEnemyData` line refs → method at line 202, catch at line 211, `errorDisplay` wired at line 54 |
| M2 | Line numbers | WP-05: Fixed `wrapText` line refs → TextRenderer lines 70-88, DialogBox lines 81-99. Call sites: TextRenderer line 37, DialogBox line 72 |
| M3 | Clarity | WP-05: Added explanation of WHY `wrapText` signature changes (private method reads config internally; shared version needs explicit `maxChars`) |
| M4 | Target | WP-11: Relaxed ExplorationScene target from ≤150 to ≤160 lines |
| M5 | Guidance | WP-11: Enumerated all 6 `this.game.*` call sites in BattleScene with exact line numbers |
| m1 | Feature | WP-01: Added `onPause()`/`onResume()` hooks for pushed scenes; ExplorationScene pauses encounters |
| m2 | Clarity | WP-01: Explicit note that `update()` needs no change — already delegates to `currentScene` |
| m3 | Clarity | WP-03: Noted that no downstream files import EquipmentSlot from Character.ts |
| m4 | Spec | WP-04: Specified scroll wrap-around behavior (wrap with scroll reset) |
| m5 | Validation | WP-06: Added `sprite` field check to EnemyData validator |
| m6 | Spec | WP-07: Specified consumable `stats: {}` convention |
| m7 | Note | WP-08: Added note on ItemData reference semantics for duplicate adds |
| m8 | Decision | WP-08: Decided gold stays in PartyManager (not delegated to Inventory) |
| E1 | Effort | WP-09: Increased from 6-8 hrs to 7-10 hrs |
| E2 | Effort | WP-11: Increased from 8-10 hrs to 10-14 hrs |
| E3 | Effort | Updated total from 37-52 to 42-60 hrs |
| R1 | Risk | Added rollback strategy for WP-11 (sub-PRs) |
| R2 | Risk | Added hidden dependency: WP-09 depends on WP-08 (`createMockGame` needs `inventory`) |
| R3 | Risk | Added full risk table with 5 identified risks |
| G1 | Gap | WP-10: Explicitly called out `main.ts` lines 2 and 19 for BootScene removal |
| G2 | Gap | Added final smoke test verification step |
| G3 | Gap | WP-09: Acknowledged `as unknown as` in sub-fields is incremental improvement, added TODO |

---

## Table of Contents

- [Success Criteria](#success-criteria)
- [Dependency Graph](#dependency-graph)
- [Risk Assessment](#risk-assessment)
- [WP-01 through WP-12](#wp-01-scene-stack--scenemanagerpop)
- [Issue Traceability Matrix](#issue-traceability-matrix)
- [Parallelization Guide](#parallelization-guide)
- [Final Verification](#final-verification)

---

## Success Criteria

```json
{
  "functional": [
    "StatusScene cancel button returns to exploration without crash",
    "SceneManager supports push/pop with a scene stack array",
    "Pushed scenes receive onPause(); popped-to scenes receive onResume()",
    "loadEnemyData() logs errors via console.error and ErrorDisplay on failure",
    "EquipmentSlot is defined in exactly one location (types/index.ts)",
    "Menu scrolls when items exceed visible area with wrap-around",
    "DataLoader validates required fields (including sprite) on all data types",
    "classes.json, items.json, spells.json exist with valid starter data",
    "Inventory class stores items with quantity tracking",
    "All 173 existing tests still pass",
    "BattleScene and BattleCommands have test coverage",
    "InputManager tests use no private member access",
    "EncounterSystem and EncounterTable use injectable RNG",
    "ExplorationScene is under 160 lines after decomposition"
  ],
  "observable": [
    "npm run test passes with 0 failures",
    "No TypeScript errors (npx tsc --noEmit)",
    "No duplicate type definitions across files",
    "No silent catch blocks in codebase (grep verifiable)",
    "No 'as unknown as' in test files for private access"
  ],
  "pass_fail": [
    "game.scenes.pop() resolves without runtime error",
    "BootScene.ts is deleted from src/scenes/",
    "wrapText() exists in exactly one shared location",
    "EncounterTable.selectEnemies() accepts rng parameter",
    "EncounterSystem.resetCounter() uses injected rng"
  ]
}
```

---

## Dependency Graph

```
WP-01 (Scene Stack)          WP-02 (Silent Catch)     WP-03 (Dup Type)
   │                              │                        │
   │                              │                        │
   ▼                              ▼                        ▼
WP-04 (Menu Scroll)         WP-05 (Text Utils)       WP-06 (Schema Valid.)
   │                              │                        │
   │                              │                        ▼
   │                              │                   WP-07 (Data Files)
   │                              │                        │
   ▼                              │                        ▼
WP-08 (Inventory) ──────────────────────────────────► WP-09 (Tests)
                                  │                        ▲
                                  │                        │
                                  └──────────────────► WP-10 (Dead Code)
                                                           │
                                                           ▼
                                                      WP-11 (Decomposition)
                                                           │
                                                           ▼
                                                      WP-12 (Future Abstractions)
```

**Key dependency added in v2:** WP-09 explicitly depends on WP-08 because `createMockGame()` must include the `inventory` field added by WP-08.

**Execution order (critical path):** WP-01 → WP-04 → WP-08 → WP-09 → WP-11
**Parallel tracks:**
- Track A: WP-01 → WP-04 → WP-08
- Track B: WP-02 → WP-05 → WP-10
- Track C: WP-03 → WP-06 → WP-07
- Track D: WP-09 (after WP-01, WP-02, WP-03, WP-08 complete)
- Track E: WP-11 → WP-12 (after WP-09)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WP-11 decomposition breaks ExplorationScene tests mid-refactor | HIGH | MEDIUM | Implement as 4 sub-PRs (11a-11d), each independently revertible. Run tests after each extraction. |
| WP-04 scroll edge cases (empty menu, 1 item, maxVisible > items.length) | MEDIUM | LOW | Add explicit edge case tests for these scenarios |
| WP-09 InputManager test rewrite reveals bugs in attach()/detach() under jsdom | LOW | MEDIUM | If jsdom doesn't support KeyboardEvent dispatch, use a thin adapter |
| WP-01 scene stack + WP-11 BattleScene decoupling may conflict | MEDIUM | MEDIUM | BattleTrigger (WP-11) calls `game.scenes.register` + `switchTo` — verify compatibility with new stack |
| WP-08 adds `inventory` to Game.ts; WP-09 `createMockGame` must include it | HIGH | LOW | Explicit dependency: WP-09 starts after WP-08 merges |

**Rollback strategy for WP-11:** The largest and riskiest WP. Implement as 4 independent sub-PRs:
1. 11a: Extract MapLoader (revertible independently)
2. 11b: Extract DialogManager (revertible independently)
3. 11c: Extract BattleTrigger (revertible independently)
4. 11d: BattleScene decoupling + injectable RNG (revertible independently)

Each sub-PR must leave all tests passing before proceeding to the next.

---

## WP-01: Scene Stack & SceneManager.pop()

**Resolves:** Issue #1 (SceneManager.pop() crash — CRITICAL), Issue #4 (No scene stack — HIGH)
**Complexity:** M (3-5 hours)
**Dependencies:** None (foundational)
**Files to modify:**
- `src/core/SceneManager.ts`
- `src/scenes/StatusScene.ts`
- `src/types/index.ts` (add optional `onPause`/`onResume` to Scene interface)

**Files to create:**
- `tests/core/SceneManager.test.ts`

### Implementation Details

**types/index.ts — Scene interface changes:**

Add optional lifecycle hooks for push/pop:
```typescript
export interface Scene {
  readonly container: Container;
  enter(): Promise<void> | void;
  update(dt: number): void;
  exit(): void;
  onPause?(): void;   // Called when another scene is pushed on top
  onResume?(): void;   // Called when this scene is restored via pop()
}
```

**SceneManager.ts changes:**

1. Add a `private sceneStack: Array<{ name: string; scene: Scene }> = []` field.
2. Add `async push(name: string): Promise<void>` method:
   - Looks up scene by name from the registry (same as `switchTo`).
   - Does NOT call `exit()` on the current scene — it stays in the stack.
   - Calls `currentScene.onPause?.()` to notify it's being pushed over.
   - Hides the current scene's container (`currentScene.container.visible = false`).
   - Pushes `{ name, scene }` onto `sceneStack`.
   - Sets `currentScene` and `currentName` to the new scene.
   - Adds new scene container to stage and calls `enter()`.
3. Add `async pop(): Promise<void>` method:
   - If stack is empty, throw `Error('Scene stack is empty')`.
   - Calls `exit()` on current scene, removes its container from stage.
   - Pops the top entry off `sceneStack`.
   - Restores previous scene: sets `currentScene`/`currentName` from the new stack top.
   - Makes restored scene's container visible again.
   - Calls `restoredScene.onResume?.()` to notify it's active again.
   - Does NOT call `enter()` on the restored scene (it was never exited).
4. Modify `switchTo()` to clear the stack (it's a hard transition, not a push):
   - Before switching, call `exit()` on all stacked scenes and clear the array.
   - This prevents stale scenes lingering in the stack after a full scene change.
5. **No change needed to `update()`** — it already delegates to `this.currentScene`, which push/pop maintain as the top-of-stack scene.

**ExplorationScene — onPause/onResume hooks:**

Implement the optional hooks so encounter system pauses when StatusScene is pushed:
```typescript
onPause(): void {
  this.encounterSystem.stop();
}

onResume(): void {
  this.encounterSystem.start();
}
```

This prevents random encounters from triggering while the status screen is open.

**StatusScene.ts changes:**

- Line 39: `this.game.scenes.pop()` — this now works correctly since `pop()` exists.
- No other changes needed; the call is already correct, it just needs the method to exist.

### Acceptance Criteria

- `SceneManager.push('status')` adds status scene on top of exploration without exiting exploration.
- `SceneManager.pop()` returns to exploration scene, which is still in its previous state.
- `push()` calls `onPause()` on the scene being pushed over.
- `pop()` calls `onResume()` on the scene being restored.
- `SceneManager.switchTo('battle')` clears the stack entirely.
- Calling `pop()` on an empty stack throws a descriptive error.
- StatusScene cancel button (`isJustPressed('cancel')`) returns to exploration without crash.

### Test Requirements

Create `tests/core/SceneManager.test.ts`:
- Test `push()` adds scene to stack, calls `enter()` on new scene, hides previous container.
- Test `push()` calls `onPause()` on the scene being pushed over.
- Test `pop()` calls `exit()` on current, restores previous scene, makes container visible.
- Test `pop()` calls `onResume()` on the restored scene.
- Test `pop()` on empty stack throws.
- Test `switchTo()` clears the stack and calls `exit()` on all stacked scenes.
- Test `update()` only updates the top-of-stack scene.
- Use mock Scene objects (simple `{ container, enter, update, exit, onPause, onResume }` stubs).

---

## WP-02: Silent Catch & Error Handling

**Resolves:** Issue #2 (Silent catch in loadEnemyData — CRITICAL)
**Complexity:** S (1-2 hours)
**Dependencies:** None
**Files to modify:**
- `src/scenes/ExplorationScene.ts` (line 211, `loadEnemyData` method)

### Implementation Details

**ExplorationScene.ts — `loadEnemyData()` method (lines 202-216):**

The method starts at line 202. The silent catch is at line 211.

Current code (line 211):
```typescript
} catch { /* ignore */ }
```

Replace with:
```typescript
} catch (e) {
  console.error(`Failed to load enemy data for '${id}':`, e);
  this.errorDisplay.show(`Failed to load enemy data`);
}
```

This follows the same pattern already established in `loadMap()` (lines 79-84) which correctly logs and displays errors. The `errorDisplay` is already a field on ExplorationScene (line 35), instantiated at line 49, and wired into the UI container at line 54.

### Acceptance Criteria

- No `catch { /* ignore */ }` blocks remain anywhere in the codebase (verify with grep).
- When `enemies.json` fails to load, the error appears in console AND on-screen via ErrorDisplay.
- Battle still triggers but with empty enemy list (existing behavior for graceful degradation).

### Test Requirements

- Add test to `tests/scenes/ExplorationScene.test.ts`: mock `data.loadEnemies` to reject, verify `console.error` is called (spy on `console.error`).
- Verify no silent catch blocks: `grep -r "catch.*{.*}" --include="*.ts" src/` should return zero matches for empty/comment-only catch blocks.

---

## WP-03: Duplicate EquipmentSlot Type

**Resolves:** Issue #3 (Duplicate EquipmentSlot — CRITICAL)
**Complexity:** S (30 min)
**Dependencies:** None
**Files to modify:**
- `src/entities/Character.ts`

### Implementation Details

**Character.ts:**

1. Remove line 3: `export type EquipmentSlot = 'weapon' | 'armor' | 'shield' | 'helmet';`
2. Add to the import on line 1: import `EquipmentSlot` from `'../types/index.js'`.

Current line 1:
```typescript
import type { CharacterClassData, ItemData, StatBlock } from '../types/index.js';
```

Change to:
```typescript
import type { CharacterClassData, ItemData, StatBlock, EquipmentSlot } from '../types/index.js';
```

3. Verify that `CharacterData` interface (which uses `EquipmentSlot` implicitly via the `equipment` Map) still compiles.

**Downstream import check:** Verified — no other files import `EquipmentSlot` from `Character.ts`. Only `Character.ts` itself uses its local copy. The canonical definition in `types/index.ts` (line 108) is the one all other consumers already use.

### Acceptance Criteria

- `EquipmentSlot` is defined in exactly one file: `src/types/index.ts`.
- `npx tsc --noEmit` passes with zero errors.
- All existing tests pass.

### Test Requirements

- No new tests needed — existing Character tests cover equipment functionality.
- Run full test suite to verify no regressions.

---

## WP-04: Menu Scrolling

**Resolves:** Issue #5 (Menu lacks scrolling — HIGH), Issue #24 (No grid/quantity selector for shops — MISSING ABSTRACTION)
**Complexity:** M (4-6 hours)
**Dependencies:** None (but WP-01 scene stack is needed before shops can use this)
**Files to modify:**
- `src/ui/Menu.ts`

**Files to create:**
- `tests/ui/Menu.test.ts` (if not already existing)

### Implementation Details

**Menu.ts — Add scrolling support:**

1. Add config option: `maxVisible?: number;` (default = items.length, no scroll).
2. Add private fields: `scrollOffset = 0`, `maxVisible: number`.
3. Only create `Text` objects for `maxVisible` items (reusable slots).
4. Modify `update()` — adjust cursor movement and scroll offset.
5. Add `private updateVisibleItems(): void` to refresh slot text/style.
6. Add scroll indicators: `▲` when `scrollOffset > 0`, `▼` when `scrollOffset + maxVisible < items.length`.

**Wrap-around behavior (v2 addition):**

- Pressing **up at index 0**: wraps to `items.length - 1` and sets `scrollOffset = Math.max(0, items.length - maxVisible)`.
- Pressing **down at last index**: wraps to 0 and sets `scrollOffset = 0`.
- This matches FF1's menu behavior where cursor wraps around list boundaries.

**Grid/Quantity selector (Issue #24) — stub interface only:**

Add to `src/ui/QuantitySelector.ts` (or inline in Menu.ts):
```typescript
export interface QuantitySelectorConfig {
  min: number;
  max: number;
  initial?: number;
  onConfirm?: (quantity: number) => void;
  onCancel?: () => void;
}
```

Stub interface for Phase 11 (Shops). Implementation deferred.

### Acceptance Criteria

- Menu with 20 items and `maxVisible: 5` shows only 5 items at a time.
- Scrolling up past the top item shifts the visible window up.
- Scrolling down past the bottom item shifts the visible window down.
- Cursor wraps around (top → bottom sets scrollOffset to end; bottom → top resets to 0).
- Existing menus (BattleScene command menu, target menu) work unchanged (no `maxVisible` = no scrolling).

### Test Requirements

Create or extend `tests/ui/Menu.test.ts`:
- Test: menu with 10 items, `maxVisible: 3` — initial state shows items 0-2.
- Test: pressing down 3 times scrolls to show items 1-3.
- Test: pressing up from index 0 wraps to last item and scrolls to end.
- Test: pressing down from last index wraps to 0 and scrolls to start.
- Test: menu without `maxVisible` behaves identically to current (no regression).
- Test: edge cases — empty menu, 1 item, `maxVisible > items.length`.

---

## WP-05: Shared Text Utilities

**Resolves:** Issue #9 (wrapText() duplication in TextRenderer and DialogBox)
**Complexity:** S (1-2 hours)
**Dependencies:** None
**Files to modify:**
- `src/ui/TextRenderer.ts` — remove private `wrapText()` (lines 70-88), import shared version
- `src/ui/DialogBox.ts` — remove private `wrapText()` (lines 81-99), import shared version

**Files to create:**
- `src/ui/textUtils.ts`
- `tests/ui/textUtils.test.ts`

### Implementation Details

**Why the signature changes (v2 addition):** The private `wrapText()` methods in both classes take only `text: string` and compute `maxChars` internally by reading instance state (`this.config.width / this.config.charWidth` in TextRenderer; `this.window.contentWidth / 8` in DialogBox). The shared version cannot access instance state, so it takes `maxChars` as an explicit parameter. Callers must compute and pass it.

**Create `src/ui/textUtils.ts`:**

```typescript
export function wrapText(text: string, maxChars: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (test.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
```

**TextRenderer.ts changes:**

- Remove the private `wrapText(text: string): string` method (lines 70-88).
- Add import: `import { wrapText } from './textUtils.js';`
- Line 37: change `this.wrapText(text)` to `wrapText(text, Math.floor(this.config.width / this.config.charWidth!))`.

**DialogBox.ts changes:**

- Remove the private `wrapText(text: string): string` method (lines 81-99).
- Add import: `import { wrapText } from './textUtils.js';`
- Line 72: change `this.wrapText(text)` to `wrapText(text, Math.floor(this.window.contentWidth / 8))`.

### Acceptance Criteria

- `wrapText` exists in exactly one location: `src/ui/textUtils.ts`.
- `grep -rn "private wrapText" src/` returns zero results.
- TextRenderer and DialogBox both produce identical text wrapping behavior as before.

### Test Requirements

Create `tests/ui/textUtils.test.ts`:
- Test: short text (under maxChars) returns unchanged.
- Test: long line wraps at word boundary.
- Test: preserves explicit `\n` newlines.
- Test: single word longer than maxChars is not broken (stays on its own line).
- Existing TextRenderer and DialogBox tests must still pass.

---

## WP-06: DataLoader Schema Validation

**Resolves:** Issue #8 (No schema validation in DataLoader — MEDIUM)
**Complexity:** M (3-4 hours)
**Dependencies:** None
**Files to modify:**
- `src/core/DataLoader.ts`

**Files to create:**
- `src/core/schemaValidation.ts`
- `tests/core/schemaValidation.test.ts`

### Implementation Details

**Create `src/core/schemaValidation.ts`:**

Lightweight runtime validators for each data type. No external library — just type guard functions.

```typescript
export function validateEnemyData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') { errors.push('Expected object'); return { valid: false, errors }; }
  const d = data as Record<string, unknown>;
  if (typeof d.id !== 'string') errors.push('Missing or invalid "id" (string)');
  if (typeof d.name !== 'string') errors.push('Missing or invalid "name" (string)');
  if (typeof d.sprite !== 'string') errors.push('Missing or invalid "sprite" (string)');
  if (!d.stats || typeof d.stats !== 'object') errors.push('Missing "stats" object');
  else {
    const s = d.stats as Record<string, unknown>;
    for (const field of ['hp', 'strength', 'agility', 'intelligence', 'vitality', 'luck', 'attack', 'defense', 'magicDefense']) {
      if (typeof s[field] !== 'number') errors.push(`Missing or invalid "stats.${field}" (number)`);
    }
  }
  if (typeof d.xpReward !== 'number') errors.push('Missing or invalid "xpReward" (number)');
  if (typeof d.goldReward !== 'number') errors.push('Missing or invalid "goldReward" (number)');
  return { valid: errors.length === 0, errors };
}
```

Create similar validators for: `validateMapData`, `validateItemData`, `validateSpellData`, `validateClassData`. Each checks required fields per the interfaces in `types/index.ts`.

**DataLoader.ts changes:**

In each `load*` method, after the `assertArray` check, iterate entries and validate:

```typescript
async loadEnemies(path: string): Promise<EnemyData[]> {
  const data = await this.assets.load<EnemyData[]>(path);
  this.assertArray(data, 'EnemyData');
  for (let i = 0; i < data.length; i++) {
    const result = validateEnemyData(data[i]);
    if (!result.valid) {
      throw new Error(`Invalid EnemyData at index ${i}: ${result.errors.join(', ')}`);
    }
  }
  return data;
}
```

Same pattern for `loadClasses`, `loadItems`, `loadSpells`. For `loadMap`, validate the single object (not array).

### Acceptance Criteria

- Loading an enemy with missing `stats.hp` throws a descriptive error at load time.
- Loading an enemy with missing `sprite` throws at load time.
- Loading a map with missing `width` throws at load time.
- Valid data files load without errors (no false positives).
- Error messages include the field name and expected type.

### Test Requirements

Create `tests/core/schemaValidation.test.ts`:
- Test each validator with valid data → returns `{ valid: true, errors: [] }`.
- Test each validator with missing required field → returns specific error message.
- Test each validator with wrong type (string where number expected) → returns error.
- Test DataLoader integration: mock asset loader returning invalid data, verify DataLoader throws with descriptive message.

---

## WP-07: Missing Data Files

**Resolves:** Issue #7 (Missing data files — classes.json, items.json, spells.json — HIGH)
**Complexity:** M (3-4 hours)
**Dependencies:** WP-06 (schema validation should exist so new files are validated on load)
**Files to create:**
- `assets/data/classes.json`
- `assets/data/items.json`
- `assets/data/spells.json`

### Implementation Details

**`assets/data/classes.json`** — 6 base classes per DESIGN_DOCUMENT.md §3:

Include all 6 classes: warrior, thief, monk, whiteMage, blackMage, redMage. Stats derived from the design doc's growth rate table (§3). Exact numbers are placeholders marked `[DEFERRED: PLAYTESTING]` — use reasonable starting values. Add a comment-style field `"_note": "PLACEHOLDER — tuning pass required"` in each entry.

**`assets/data/items.json`** — Starter items per DESIGN_DOCUMENT.md §6:

Include the 9 consumables (Potion, Hi-Potion, Ether, Antidote, Soft, Tent, Cabin, House, Phoenix Down) plus 3-4 starter weapons and 2-3 starter armor. Each entry must conform to the `ItemData` interface in `types/index.ts`.

**Consumable stats convention (v2 addition):** Consumables should have `stats: {}` (empty object). The healing/effect is determined by the `type: 'consumable'` field and a future effect system (Phase 9), not by stats. Only weapons and armor populate the `stats` field with `attack`/`defense` values.

**`assets/data/spells.json`** — Starter spells per DESIGN_DOCUMENT.md §5:

Include Level 1 white spells (CURE, HARM, FOG, RUSE) and Level 1 black spells (FIRE, SLEP, LOCK, LIT). Each entry must conform to the `SpellData` interface. The `effect` field uses descriptive IDs like `"heal_single"`, `"damage_fire_single"`, `"buff_defense"`.

### Acceptance Criteria

- All three files parse without errors via `DataLoader.loadClasses()`, `loadItems()`, `loadSpells()`.
- Schema validation (WP-06) passes for every entry.
- Files match the interfaces defined in `types/index.ts`.
- `npx tsc --noEmit` still passes.

### Test Requirements

- Add integration tests in `tests/core/DataLoader.test.ts`: load each real JSON file via DataLoader with a mock AssetLoader that reads from disk, verify the returned arrays have expected lengths and required fields.

---

## WP-08: Inventory System

**Resolves:** Issue #6 (No inventory system — HIGH)
**Complexity:** M (3-5 hours)
**Dependencies:** WP-07 (items.json must exist for inventory to reference items)
**Files to create:**
- `src/entities/Inventory.ts`
- `tests/entities/Inventory.test.ts`

**Files to modify:**
- `src/core/Game.ts` — add `inventory` field

### Implementation Details

**Gold tracking decision (v2 addition):** Gold stays in `PartyManager`. It is a party-level resource (shared across save/load, displayed in party stats), not an inventory item. `PartyManager` already has `gold`, `addGold()`, and serializes it in `toJSON()` (lines 5, 32-33, 43). No delegation to Inventory.

**Create `src/entities/Inventory.ts`:**

```typescript
import type { ItemData } from '../types/index.js';

export interface InventoryEntry {
  item: ItemData;
  quantity: number;
}

export class Inventory {
  private items: Map<string, InventoryEntry> = new Map();
  private maxSlots: number;

  constructor(maxSlots = 99) {
    this.maxSlots = maxSlots;
  }

  add(item: ItemData, quantity = 1): boolean {
    const existing = this.items.get(item.id);
    if (existing) {
      existing.quantity += quantity;
      return true;
    }
    if (this.items.size >= this.maxSlots) return false;
    this.items.set(item.id, { item, quantity });
    return true;
  }

  remove(itemId: string, quantity = 1): boolean {
    const entry = this.items.get(itemId);
    if (!entry || entry.quantity < quantity) return false;
    entry.quantity -= quantity;
    if (entry.quantity <= 0) this.items.delete(itemId);
    return true;
  }

  get(itemId: string): InventoryEntry | null {
    return this.items.get(itemId) ?? null;
  }

  getAll(): InventoryEntry[] { return [...this.items.values()]; }
  has(itemId: string): boolean { return this.items.has(itemId); }
  get size(): number { return this.items.size; }

  toJSON(): object {
    return [...this.items.entries()].map(([id, e]) => ({ id, quantity: e.quantity }));
  }
}
```

**ItemData reference semantics (v2 addition):** The first `ItemData` object stored for a given ID is retained. Subsequent `add()` calls with the same ID only increment quantity. This assumes `ItemData` is immutable and consistent across sources (shop, chest, etc.).

**Game.ts changes:**

Add field: `readonly inventory: Inventory;`
In constructor: `this.inventory = new Inventory();`
Add import: `import { Inventory } from '../entities/Inventory.js';`

### Acceptance Criteria

- `inventory.add(potion, 3)` stores 3 potions.
- `inventory.remove('potion', 1)` decrements to 2.
- `inventory.remove('potion', 5)` returns false (insufficient quantity).
- Adding beyond `maxSlots` unique items returns false.
- `inventory.getAll()` returns all entries for UI display.
- `inventory.toJSON()` produces serializable output for save/load (Phase 12).

### Test Requirements

Create `tests/entities/Inventory.test.ts`:
- Test add single item, verify quantity.
- Test add same item multiple times, verify quantity accumulates.
- Test remove reduces quantity.
- Test remove below zero returns false, doesn't modify.
- Test remove last item deletes entry entirely.
- Test maxSlots limit.
- Test `getAll()` returns correct entries.
- Test `toJSON()` output format.

---

## WP-09: Test Remediation

**Resolves:** Issue #10 (BattleScene/BattleCommands untested — MEDIUM), Issue #11 (InputManager private access — MEDIUM), Issue #19 (Private member access anti-pattern — TEST), Issue #20 (Loose mock typing — TEST), Issue #21 (No integration tests for battle flow — TEST)
**Complexity:** L (7-10 hours) *(v2: increased from 6-8 — 25-30 new tests across 5 files is significant; battle flow integration tests are complex)*
**Dependencies:** WP-01 (SceneManager push/pop), WP-02 (silent catch fixed), WP-03 (duplicate type fixed), **WP-08 (Inventory — `createMockGame` must include `inventory` field)**
**Files to modify:**
- `tests/core/InputManager.test.ts`
- `tests/scenes/ExplorationScene.test.ts`

**Files to create:**
- `tests/battle/BattleCommands.test.ts`
- `tests/scenes/BattleScene.test.ts`
- `tests/integration/battleFlow.test.ts`
- `tests/helpers/testUtils.ts`

### Implementation Details

#### 9a. Fix InputManager tests (Issues #11, #19)

**Problem:** 5 occurrences of `as unknown as { currentKeys: Set<string> }` to access private `currentKeys`.

**Fix:** Use `attach()` + simulated `KeyboardEvent` dispatches instead:
```typescript
// Instead of:
const im = input as unknown as { currentKeys: Set<string> };
im.currentKeys.add('ArrowUp');

// Use:
input.attach();
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
```

#### 9b. Fix ExplorationScene mock typing (Issue #20)

**Problem:** `createMockGame()` returns `as unknown as Game` — changes to Game interface silently break tests.

**Fix:** Create a typed mock factory in `tests/helpers/testUtils.ts`:

```typescript
export function createMockGame(mapData?: MapData): Game {
  const md = mapData ?? createMapData();
  return {
    app: { stage: new Container() } as Game['app'],
    scenes: { register: vi.fn(), switchTo: vi.fn(), push: vi.fn(), pop: vi.fn() } as unknown as Game['scenes'],
    input: { isPressed: vi.fn().mockReturnValue(false), isJustPressed: vi.fn().mockReturnValue(false), attach: vi.fn(), detach: vi.fn(), update: vi.fn() } as unknown as Game['input'],
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as Game['events'],
    data: { loadMap: vi.fn().mockResolvedValue(md) } as unknown as Game['data'],
    party: { all: [], size: 0, distributeXp: vi.fn(), addGold: vi.fn() } as unknown as Game['party'],
    inventory: { add: vi.fn(), remove: vi.fn(), getAll: vi.fn().mockReturnValue([]) } as unknown as Game['inventory'],
  } as Game;
}
```

**Note on `as unknown as` in sub-fields (v2 addition):** This is an incremental improvement — each field is typed as `Game['fieldName']` so adding a new top-level field to Game breaks compilation. However, sub-field casts (`as unknown as Game['scenes']`) still mask missing methods. A full fix would require proper mock classes implementing each interface. TODO: consider mock classes in a future test infrastructure pass.

Also extract `createMapData()` here — it's duplicated across 3 test files.

#### 9c. BattleCommands unit tests (Issue #10)

Create `tests/battle/BattleCommands.test.ts`:
- Test `retargetIfDead()`: target alive → returns same command.
- Test `retargetIfDead()`: target dead, living enemies exist → returns command with new target.
- Test `retargetIfDead()`: target dead, no living enemies → returns original command.
- Test `retargetIfDead()`: non-fight command → returns unchanged.
- Test `calculateRunChance()`: party faster → higher chance (>50).
- Test `calculateRunChance()`: party slower → lower chance (<50).
- Test `calculateRunChance()`: result clamped to [10, 90].

#### 9d. BattleScene integration tests (Issue #10)

Create `tests/scenes/BattleScene.test.ts`:
- Test: scene creates UI elements on `enter()`.
- Test: intro state advances on confirm press.
- Test: command menu appears in command state.
- Test: selecting "Fight" shows target menu.
- Test: selecting target submits command and advances to next actor.

#### 9e. Battle flow integration test (Issue #21)

Create `tests/integration/battleFlow.test.ts`:
- Test victory flow: create BattleStateMachine → startBattle → submit fight commands → executeRound → resolveRound → verify victory with correct XP/gold.
- Test defeat flow: all party members die → verify defeat state.
- Test run flow: submit run command → verify escape (with deterministic RNG).

Uses `BattleStateMachine` directly (not BattleScene) since it's testing game logic, not UI.

### Acceptance Criteria

- Zero occurrences of `as unknown as { currentKeys` in test files.
- `createMapData()` exists in exactly one location (`tests/helpers/testUtils.ts`).
- BattleCommands has ≥7 unit tests covering both functions.
- Battle flow integration test covers victory, defeat, and run scenarios.
- All 173+ existing tests still pass.

### Test Requirements

This WP IS the test work. Expected new test count: ~25-30 new tests.

---

## WP-10: Dead Code & Optimization

**Resolves:** Issue #12 (No bitmap font — LOW), Issue #13 (No dirty flag on tilemap — LOW), Issue #14 (BootScene is dead code — LOW)
**Complexity:** S (2-3 hours)
**Dependencies:** None (but logically done after critical fixes)
**Files to modify:**
- `src/rendering/TilemapRenderer.ts`
- `src/main.ts` — remove BootScene import (line 2) and registration (line 19)

**Files to delete:**
- `src/scenes/BootScene.ts`

### Implementation Details

#### 10a. Remove BootScene dead code (Issue #14)

1. Delete `src/scenes/BootScene.ts`.
2. In `src/main.ts`: remove line 2 (`import { BootScene } from './scenes/BootScene.js';`) and line 19 (`game.scenes.register('boot', new BootScene());`).
3. Verify no other references: `grep -rn "BootScene" src/` should return zero results.

#### 10b. Add dirty flag to TilemapRenderer (Issue #13)

Add bounds-based dirty check (no Camera coupling):
```typescript
private lastBoundsKey = '';

render(): void {
  const bounds = this.camera ? this.camera.getVisibleTileBounds() : { startX: 0, startY: 0, endX: this.mapData.width, endY: this.mapData.height };
  const boundsKey = `${bounds.startX},${bounds.startY},${bounds.endX},${bounds.endY}`;
  if (boundsKey === this.lastBoundsKey) return;
  this.lastBoundsKey = boundsKey;
  // ... rest of existing render logic
}
```

#### 10c. Bitmap font (Issue #12) — DEFER

Add a TODO comment in `TextRenderer.ts`:
```typescript
// TODO Phase 18: Replace browser monospace with NES-authentic bitmap font (BitmapText)
```

### Acceptance Criteria

- `BootScene.ts` does not exist in `src/scenes/`.
- No references to `BootScene` anywhere in `src/` (including `main.ts`).
- TilemapRenderer skips re-rendering when camera bounds haven't changed.
- Bitmap font TODO comment exists in TextRenderer.ts.

### Test Requirements

- Existing TilemapRenderer tests still pass.
- Add test: call `render()` twice with same camera bounds → verify sprite updates only happen once.

---

## WP-11: ExplorationScene Decomposition & DI

**Resolves:** Issue #15 (ExplorationScene god object — ARCH DEBT), Issue #16 (BattleScene coupled to Game — ARCH DEBT), Issue #17 (No dependency injection — ARCH DEBT), Issue #18 (EncounterSystem uses Math.random() — ARCH DEBT)
**Complexity:** L (10-14 hours) *(v2: increased from 8-10 — decomposing a 237-line god object while maintaining all tests is the hardest WP)*
**Dependencies:** WP-09 (tests must exist before refactoring to catch regressions)
**Files to modify:**
- `src/scenes/ExplorationScene.ts` (237 lines → target ≤160 lines)
- `src/scenes/BattleScene.ts` (297 lines)
- `src/systems/EncounterSystem.ts`
- `src/systems/EncounterTable.ts`

**Files to create:**
- `src/systems/BattleTrigger.ts`
- `src/systems/DialogManager.ts`
- `src/systems/MapLoader.ts`

**Rollback strategy:** Implement as 4 independent sub-PRs (11a → 11b → 11c → 11d). Each must leave all tests passing. Any sub-PR can be reverted independently if it causes issues.

### Implementation Details

#### 11a. Decompose ExplorationScene — Extract MapLoader (Issue #15)

**`src/systems/MapLoader.ts`:**
Extracts: map data fetching, tilemap creation, collision map creation, NPC instantiation, encounter rate/table setup from `ExplorationScene.loadMap()` (lines 71-130). ~50 lines moved out.

#### 11b. Decompose ExplorationScene — Extract DialogManager (Issue #15)

**`src/systems/DialogManager.ts`:**
Extracts: `startDialog()` (lines 163-168), `advanceDialog()` (lines 170-178), dialog state fields (`currentDialog`, `dialogIndex`, `inDialog`), and dialog update logic from `update()`. ~25 lines moved out.

#### 11c. Decompose ExplorationScene — Extract BattleTrigger (Issue #15)

**`src/systems/BattleTrigger.ts`:**
Extracts: `triggerBattle()` (lines 180-199), `loadEnemyData()` (lines 202-216), `enemyDataCache` field. ~40 lines moved out.

**After decomposition, ExplorationScene should be ~120-140 lines** — a thin orchestrator that delegates to MapLoader, DialogManager, BattleTrigger, MapTransitionSystem, NPCInteractionSystem, and EncounterSystem. The ≤160 line target (v2: relaxed from ≤150) accounts for new import statements and constructor wiring code.

#### 11d. Reduce BattleScene coupling to Game (Issue #16)

**Problem:** BattleScene takes `Game` as constructor arg and accesses `this.game.*` in 6 locations.

**All `this.game.*` call sites in BattleScene (v2 addition — enumerated):**

| Line | Reference | Replacement |
|------|-----------|-------------|
| 127 | `this.game.input.isJustPressed('confirm')` | `this.input.isJustPressed('confirm')` |
| 134 | `this.commandMenu.update(this.game.input)` | `this.commandMenu.update(this.input)` |
| 138 | `this.targetMenu.update(this.game.input)` | `this.targetMenu.update(this.input)` |
| 143 | `this.game.input.isJustPressed('confirm')` | `this.input.isJustPressed('confirm')` |
| 149 | `this.game.input.isJustPressed('confirm')` | `this.input.isJustPressed('confirm')` |
| 286 | `this.game.events.emit('battleEnd', {...})` | `this.events.emit('battleEnd', {...})` |

**Total: 6 replacements** (5 × `this.game.input`, 1 × `this.game.events`).

**Fix:** Change BattleScene constructor to accept a narrow interface:

```typescript
export interface BattleSceneDeps {
  input: InputManager;
  events: EventBus;
}

export class BattleScene implements Scene {
  private input: InputManager;
  private events: EventBus;
  constructor(deps: BattleSceneDeps, config: BattleSceneConfig) {
    this.input = deps.input;
    this.events = deps.events;
    // ...
  }
}
```

Callers (ExplorationScene/BattleTrigger) pass `{ input: game.input, events: game.events }`.

#### 11e. Injectable RNG in EncounterSystem/EncounterTable (Issue #18)

**EncounterTable.ts** — `Math.random()` at line 14:
Accept `rng` in constructor, replace `Math.random()` with `this.rng()`.

**EncounterSystem.ts** — `Math.random()` at line 51 in `resetCounter()`:
Accept `rng` in constructor (default `Math.random`), pass to EncounterTable.

#### 11f. Dependency Injection pattern (Issue #17)

The changes in 11d and 11e establish the DI pattern. ExplorationScene as a composition root accepting `Game` is acceptable. The key improvement is that extracted systems (MapLoader, DialogManager, BattleTrigger) accept narrow interfaces, not `Game`.

### Acceptance Criteria

- ExplorationScene is ≤160 lines *(v2: relaxed from ≤150)*.
- MapLoader, DialogManager, BattleTrigger each exist as separate files with single responsibilities.
- BattleScene constructor no longer accepts `Game` — accepts `BattleSceneDeps` interface.
- `EncounterTable.selectEnemies()` uses injected RNG (line 14).
- `EncounterSystem.resetCounter()` uses injected RNG (line 51).
- All existing tests pass (refactoring must be behavior-preserving).
- `grep -rn "Math.random" src/systems/Encounter` returns zero results.

### Test Requirements

- Update existing EncounterSystem/EncounterTable tests to pass deterministic RNG.
- Add test: EncounterTable with fixed RNG always selects same enemy group.
- Add test: EncounterSystem with fixed RNG has predictable step counter.
- Existing ExplorationScene tests must pass with updated mock structure.
- BattleScene tests (from WP-09) should use `BattleSceneDeps` interface.

---

## WP-12: Future Phase Abstractions

**Resolves:** Issue #22 (No movement mode abstraction — MISSING), Issue #23 (No AI behavior system — MISSING), Issue #24 (No grid/quantity selector — MISSING, partially addressed in WP-04)
**Complexity:** S (2-3 hours)
**Dependencies:** WP-11 (decomposition provides cleaner extension points)
**Files to create:**
- `src/entities/MovementMode.ts`
- `src/battle/AIBehavior.ts`
- `src/ui/QuantitySelector.ts`

### Implementation Details

These are interface-only stubs — no implementation. They define contracts for future phases.

#### 12a. Movement Mode (Issue #22, Phase 14: Vehicles)

```typescript
export interface MovementMode {
  readonly id: string;
  readonly speed: number;
  readonly canTraverse: (tileType: number) => boolean;
  readonly encounterRateMultiplier: number;  // 0 = no encounters (airship)
  readonly sprite: string;
}
```

#### 12b. AI Behavior (Issue #23, Phase 15: Boss Battles)

```typescript
export interface AIBehavior {
  readonly id: string;
  selectAction(
    self: EnemyInstance, party: Character[], allies: EnemyInstance[],
    turnNumber: number, rng: () => number
  ): BattleCommand;
}
```

#### 12c. Quantity Selector (Issue #24, Phase 11: Shops)

```typescript
export interface QuantitySelectorConfig {
  min: number;
  max: number;
  initial?: number;
  onConfirm?: (quantity: number) => void;
  onCancel?: () => void;
}
```

### Acceptance Criteria

- All three interface files exist and compile (`npx tsc --noEmit`).
- No runtime code — type definitions and documentation only.

### Test Requirements

- No tests needed — interface-only files.
- Verify compilation: `npx tsc --noEmit` passes.

---

## Issue Traceability Matrix

| # | Issue | Severity | WP | Status |
|---|-------|----------|----|--------|
| 1 | SceneManager.pop() crash | CRITICAL | WP-01 | ✅ Done |
| 2 | Silent catch in loadEnemyData() | CRITICAL | WP-02 | ✅ Done |
| 3 | Duplicate EquipmentSlot type | CRITICAL | WP-03 | ✅ Done |
| 4 | No scene stack | HIGH | WP-01 | ✅ Done |
| 5 | Menu lacks scrolling | HIGH | WP-04 | Planned |
| 6 | No inventory system | HIGH | WP-08 | Planned |
| 7 | Missing data files (classes/items/spells) | HIGH | WP-07 | Planned |
| 8 | No schema validation in DataLoader | MEDIUM | WP-06 | Planned |
| 9 | wrapText() duplication | MEDIUM | WP-05 | Planned |
| 10 | BattleScene/BattleCommands untested | MEDIUM | WP-09 | Planned |
| 11 | InputManager tests access private members | MEDIUM | WP-09 | Planned |
| 12 | No bitmap font | LOW | WP-10 | Deferred (Phase 18 TODO) |
| 13 | No dirty flag on tilemap rendering | LOW | WP-10 | Planned |
| 14 | BootScene is dead code | LOW | WP-10 | Planned |
| 15 | ExplorationScene god object | ARCH DEBT | WP-11 | Planned |
| 16 | BattleScene coupled to Game | ARCH DEBT | WP-11 | Planned |
| 17 | No dependency injection | ARCH DEBT | WP-11 | Planned |
| 18 | EncounterSystem uses Math.random() | ARCH DEBT | WP-11 | Planned |
| 19 | Private member access in tests | TEST | WP-09 | Planned |
| 20 | Loose mock typing in tests | TEST | WP-09 | Planned |
| 21 | No integration tests for battle flow | TEST | WP-09 | Planned |
| 22 | No movement mode abstraction | MISSING | WP-12 | Planned (interface only) |
| 23 | No AI behavior system | MISSING | WP-12 | Planned (interface only) |
| 24 | No grid/quantity selector | MISSING | WP-04 + WP-12 | Planned |

**Coverage: 24/24 issues addressed. Zero skipped.**

---

## Parallelization Guide

| Parallel Group | WPs | Rationale |
|----------------|-----|-----------|
| Group 1 (Critical fixes) | WP-01, WP-02, WP-03 | Touch different files: SceneManager vs ExplorationScene vs Character/types |
| Group 2 (Infrastructure) | WP-04, WP-05, WP-06 | Touch different files: Menu vs textUtils vs DataLoader |
| Group 3 (Content + System) | WP-07, WP-08 | WP-07 creates data files, WP-08 creates Inventory — minimal overlap. WP-08 logically depends on WP-07 for test data. |
| Group 4 (Late stage) | WP-10, WP-12 | Touch different files: TilemapRenderer/BootScene vs new interface files |

**Cannot parallelize:**
- WP-09 depends on WP-01, WP-02, WP-03, **and WP-08** being complete.
- WP-11 depends on WP-09 (tests must exist before refactoring).
- WP-12 depends on WP-11 (cleaner extension points after decomposition).

---

## Effort Summary

| WP | Description | Complexity | Est. Hours | Issues Resolved |
|----|-------------|------------|------------|-----------------|
| WP-01 | Scene Stack | M | 3-5 | #1, #4 |
| WP-02 | Silent Catch | S | 1-2 | #2 |
| WP-03 | Duplicate Type | S | 0.5 | #3 |
| WP-04 | Menu Scrolling | M | 4-6 | #5, #24 (partial) |
| WP-05 | Text Utilities | S | 1-2 | #9 |
| WP-06 | Schema Validation | M | 3-4 | #8 |
| WP-07 | Data Files | M | 3-4 | #7 |
| WP-08 | Inventory System | M | 3-5 | #6 |
| WP-09 | Test Remediation | L | **7-10** | #10, #11, #19, #20, #21 |
| WP-10 | Dead Code & Optimization | S | 2-3 | #12, #13, #14 |
| WP-11 | Decomposition & DI | L | **10-14** | #15, #16, #17, #18 |
| WP-12 | Future Abstractions | S | 2-3 | #22, #23, #24 |
| **TOTAL** | | | **40-58 hrs** | **24/24** |

### Recommended Execution Order (Sequential)

1. **WP-01 + WP-02 + WP-03** (parallel, ~5 hrs) — Fix all 3 critical bugs
2. **WP-04 + WP-05 + WP-06** (parallel, ~6 hrs) — Infrastructure improvements
3. **WP-07** (~4 hrs) — Create data files (needs WP-06 validation)
4. **WP-08** (~5 hrs) — Inventory system (needs WP-07 items)
5. **WP-09** (~10 hrs) — Test remediation (needs WP-01/02/03/08 fixes)
6. **WP-10 + WP-12** (parallel, ~3 hrs) — Cleanup and future stubs
7. **WP-11** (~14 hrs) — Major refactoring as 4 sub-PRs (needs WP-09 test safety net)

**Optimal calendar time with parallelization: ~35-40 hours**
**Sequential worst case: ~58 hours**

---

## Final Verification (v2 addition)

After all 12 WPs are complete, perform a smoke test:

1. `npx tsc --noEmit` — zero TypeScript errors
2. `npm run test` — all tests pass (173 existing + ~30 new)
3. `npm run dev` — start the game, walk around, trigger a battle, open status screen, return to exploration — all without crashes
4. `grep -rn "catch { /\*" src/` — zero silent catch blocks
5. `grep -rn "Math.random" src/systems/Encounter` — zero direct Math.random calls
6. `grep -rn "private wrapText" src/` — zero duplicate wrapText methods
7. `wc -l src/scenes/ExplorationScene.ts` — ≤160 lines

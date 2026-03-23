# FF1-Style RPG — Remediation Plan v1

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-22 |
| **Input** | CODE_AUDIT_RECOMMENDATIONS.md, DESIGN_DOCUMENT.md, PROGRESS.md |
| **Issues Covered** | 24 of 24 (3 critical, 4 high, 4 medium, 3 low, 4 arch debt, 3 test anti-patterns, 3 missing abstractions) |
| **Work Packages** | 12 |
| **Estimated Total Effort** | ~40-52 hours |

---

## Table of Contents

- [Success Criteria](#success-criteria)
- [Dependency Graph](#dependency-graph)
- [WP-01: Scene Stack & SceneManager.pop()](#wp-01-scene-stack--scenemanagerpop)
- [WP-02: Silent Catch & Error Handling](#wp-02-silent-catch--error-handling)
- [WP-03: Duplicate EquipmentSlot Type](#wp-03-duplicate-equipmentslot-type)
- [WP-04: Menu Scrolling](#wp-04-menu-scrolling)
- [WP-05: Shared Text Utilities](#wp-05-shared-text-utilities)
- [WP-06: DataLoader Schema Validation](#wp-06-dataloader-schema-validation)
- [WP-07: Missing Data Files](#wp-07-missing-data-files)
- [WP-08: Inventory System](#wp-08-inventory-system)
- [WP-09: Test Remediation](#wp-09-test-remediation)
- [WP-10: Dead Code & Optimization](#wp-10-dead-code--optimization)
- [WP-11: ExplorationScene Decomposition & DI](#wp-11-explorationscene-decomposition--di)
- [WP-12: Future Phase Abstractions](#wp-12-future-phase-abstractions)
- [Issue Traceability Matrix](#issue-traceability-matrix)
- [Parallelization Guide](#parallelization-guide)

---

## Success Criteria

```json
{
  "functional": [
    "StatusScene cancel button returns to exploration without crash",
    "SceneManager supports push/pop with a scene stack array",
    "loadEnemyData() logs errors via console.error and ErrorDisplay on failure",
    "EquipmentSlot is defined in exactly one location (types/index.ts)",
    "Menu scrolls when items exceed visible area",
    "DataLoader validates required fields on all data types",
    "classes.json, items.json, spells.json exist with valid starter data",
    "Inventory class stores items with quantity tracking",
    "All 173 existing tests still pass",
    "BattleScene and BattleCommands have test coverage",
    "InputManager tests use no private member access",
    "EncounterSystem and EncounterTable use injectable RNG",
    "ExplorationScene is under 150 lines after decomposition"
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
WP-08 (Inventory)                 │                   WP-09 (Tests) ◄──── WP-11 (Decomposition)
                                  │                        │
                                  │                        ▼
                                  └──────────────────► WP-10 (Dead Code)
                                                           │
                                                           ▼
                                                      WP-12 (Future Abstractions)
```

**Execution order (critical path):** WP-01 → WP-04 → WP-08 (scene stack needed for shops)
**Parallel tracks:**
- Track A: WP-01 → WP-04 → WP-08
- Track B: WP-02 → WP-05 → WP-10
- Track C: WP-03 → WP-06 → WP-07
- Track D: WP-09 (after WP-01, WP-02, WP-03 complete)
- Track E: WP-11 → WP-12 (after WP-09)

---

## WP-01: Scene Stack & SceneManager.pop()

**Resolves:** Issue #1 (SceneManager.pop() crash — CRITICAL), Issue #4 (No scene stack — HIGH)
**Complexity:** M (3-5 hours)
**Dependencies:** None (foundational)
**Files to modify:**
- `src/core/SceneManager.ts`
- `src/scenes/StatusScene.ts`
- `src/types/index.ts` (if Scene interface needs changes)

**Files to create:**
- `tests/core/SceneManager.test.ts`

### Implementation Details

**SceneManager.ts changes:**

1. Add a `private sceneStack: Array<{ name: string; scene: Scene }> = []` field.
2. Add `async push(name: string): Promise<void>` method:
   - Looks up scene by name from the registry (same as `switchTo`).
   - Does NOT call `exit()` on the current scene — it stays in the stack.
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
   - Does NOT call `enter()` on the restored scene (it was never exited).
4. Modify `switchTo()` to clear the stack (it's a hard transition, not a push):
   - Before switching, call `exit()` on all stacked scenes and clear the array.
   - This prevents stale scenes lingering in the stack after a full scene change.

**StatusScene.ts changes:**

- Line 39: Change `this.game.scenes.pop()` — this now works correctly since `pop()` exists.
- No other changes needed; the call is already correct, it just needs the method to exist.

### Acceptance Criteria

- `SceneManager.push('status')` adds status scene on top of exploration without exiting exploration.
- `SceneManager.pop()` returns to exploration scene, which is still in its previous state.
- `SceneManager.switchTo('battle')` clears the stack entirely.
- Calling `pop()` on an empty stack throws a descriptive error.
- StatusScene cancel button (`isJustPressed('cancel')`) returns to exploration without crash.

### Test Requirements

Create `tests/core/SceneManager.test.ts`:
- Test `push()` adds scene to stack, calls `enter()` on new scene, hides previous container.
- Test `pop()` calls `exit()` on current, restores previous scene, makes container visible.
- Test `pop()` on empty stack throws.
- Test `switchTo()` clears the stack and calls `exit()` on all stacked scenes.
- Test `update()` only updates the top-of-stack scene.
- Use mock Scene objects (simple `{ container, enter, update, exit }` stubs).

---

## WP-02: Silent Catch & Error Handling

**Resolves:** Issue #2 (Silent catch in loadEnemyData — CRITICAL)
**Complexity:** S (1-2 hours)
**Dependencies:** None
**Files to modify:**
- `src/scenes/ExplorationScene.ts` (line 211, `loadEnemyData` method)

### Implementation Details

**ExplorationScene.ts — `loadEnemyData()` method (lines 198-211):**

Current code:
```typescript
try {
  const enemies = await this.game.data.loadEnemies('assets/data/enemies.json');
  for (const e of enemies) this.enemyDataCache.set(e.id, e);
  data = this.enemyDataCache.get(id);
} catch { /* ignore */ }
```

Replace with:
```typescript
try {
  const enemies = await this.game.data.loadEnemies('assets/data/enemies.json');
  for (const e of enemies) this.enemyDataCache.set(e.id, e);
  data = this.enemyDataCache.get(id);
} catch (e) {
  console.error(`Failed to load enemy data for '${id}':`, e);
  this.errorDisplay.show(`Failed to load enemy data`);
}
```

This follows the same pattern already established in `loadMap()` (lines 82-87) which correctly logs and displays errors. The `errorDisplay` is already a field on ExplorationScene (line 35) and is already wired into the UI container (line 48).

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
4. Verify all files that import `EquipmentSlot` from `Character.ts` are updated to import from `types/index.ts` instead.

**Check for downstream imports:**
```bash
grep -r "from.*Character.*EquipmentSlot\|EquipmentSlot.*from.*Character" src/
```
If any files import `EquipmentSlot` from `Character.ts`, update them to import from `types/index.ts`.

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

1. Add config options to `MenuConfig`:
   ```typescript
   maxVisible?: number;  // max items visible at once, default = items.length (no scroll)
   ```

2. Add private fields:
   ```typescript
   private scrollOffset = 0;
   private maxVisible: number;
   ```

3. Modify constructor:
   - Set `this.maxVisible = config.maxVisible ?? config.items.length`.
   - Only create `Text` objects for `maxVisible` items (not all items). These are the "slots" that get reused.

4. Modify `update()` — adjust cursor movement:
   - When `cursorIndex` moves above `scrollOffset`, decrement `scrollOffset`.
   - When `cursorIndex` moves below `scrollOffset + maxVisible - 1`, increment `scrollOffset`.
   - After scroll change, call `updateVisibleItems()`.

5. Add `private updateVisibleItems(): void`:
   - For each visible slot `i` (0 to `maxVisible - 1`):
     - Map to data index: `dataIdx = scrollOffset + i`.
     - Update `texts[i].text = items[dataIdx].label`.
     - Update style (enabled vs disabled).
   - Update cursor Y position: `cursorText.position.y = (cursorIndex - scrollOffset) * lineHeight`.

6. Add scroll indicators (optional but recommended):
   - Show `▲` at top when `scrollOffset > 0`.
   - Show `▼` at bottom when `scrollOffset + maxVisible < items.length`.

**Grid/Quantity selector (Issue #24) — stub interfaces only:**

Add to Menu.ts or create `src/ui/QuantitySelector.ts`:
```typescript
export interface QuantitySelectorConfig {
  min: number;
  max: number;
  initial?: number;
  x?: number;
  y?: number;
  onConfirm?: (quantity: number) => void;
  onCancel?: () => void;
}
```

This is a stub interface for Phase 11 (Shops). The actual implementation is deferred but the interface is defined now so shop planning can reference it.

### Acceptance Criteria

- Menu with 20 items and `maxVisible: 5` shows only 5 items at a time.
- Scrolling up past the top item shifts the visible window up.
- Scrolling down past the bottom item shifts the visible window down.
- Cursor wraps around (top ↔ bottom) and scroll resets appropriately.
- Existing menus (BattleScene command menu, target menu) work unchanged (they don't set `maxVisible`, so default = all items visible = no scrolling).

### Test Requirements

Create or extend `tests/ui/Menu.test.ts`:
- Test: menu with 10 items, `maxVisible: 3` — initial state shows items 0-2.
- Test: pressing down 3 times scrolls to show items 1-3.
- Test: pressing up from top wraps to bottom and scrolls.
- Test: menu without `maxVisible` behaves identically to current (no regression).
- Mock `InputManager` with `isJustPressed` returning controlled values.

---

## WP-05: Shared Text Utilities

**Resolves:** Issue #9 (wrapText() duplication in TextRenderer and DialogBox)
**Complexity:** S (1-2 hours)
**Dependencies:** None
**Files to modify:**
- `src/ui/TextRenderer.ts` — remove private `wrapText()`, import shared version
- `src/ui/DialogBox.ts` — remove private `wrapText()`, import shared version

**Files to create:**
- `src/ui/textUtils.ts`
- `tests/ui/textUtils.test.ts`

### Implementation Details

**Create `src/ui/textUtils.ts`:**

Extract the duplicated `wrapText` function. Both copies are identical in logic (word-wrap by character count):

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

- Remove the private `wrapText(text: string): string` method (lines 52-67).
- Add import: `import { wrapText } from './textUtils.js';`
- In `setText()`, change `this.wrapText(text)` to `wrapText(text, Math.floor(this.config.width / this.config.charWidth!))`.

**DialogBox.ts changes:**

- Remove the private `wrapText(text: string): string` method (lines 79-94).
- Add import: `import { wrapText } from './textUtils.js';`
- In `paginate()`, change `this.wrapText(text)` to `wrapText(text, Math.floor(this.window.contentWidth / 8))`.

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

Lightweight runtime validators for each data type. No external library — just type guard functions that check required fields exist and have correct types.

```typescript
export function validateEnemyData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') { errors.push('Expected object'); return { valid: false, errors }; }
  const d = data as Record<string, unknown>;
  if (typeof d.id !== 'string') errors.push('Missing or invalid "id" (string)');
  if (typeof d.name !== 'string') errors.push('Missing or invalid "name" (string)');
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

In each `load*` method, after the `assertArray` check, iterate entries and validate each one:

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

- Loading an enemy with missing `stats.hp` throws a descriptive error at load time (not a runtime crash later).
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

```json
[
  {
    "id": "warrior",
    "name": "Warrior",
    "baseStats": { "hp": 35, "strength": 10, "agility": 5, "intelligence": 1, "vitality": 8, "luck": 5 },
    "statGrowth": { "hp": 12, "strength": 3, "agility": 1, "intelligence": 0, "vitality": 2, "luck": 1 },
    "usableEquipment": ["sword", "axe", "hammer", "heavy_armor", "shield"],
    "spellLevels": { "white": 0, "black": 0 }
  }
]
```

Include all 6 classes: warrior, thief, monk, whiteMage, blackMage, redMage. Stats derived from the design doc's growth rate table (§3). Exact numbers are placeholders marked `[DEFERRED: PLAYTESTING]` in the design doc, so use reasonable starting values.

**`assets/data/items.json`** — Starter items per DESIGN_DOCUMENT.md §6:

Include the 9 consumables from the design doc (Potion, Hi-Potion, Ether, Antidote, Soft, Tent, Cabin, House, Phoenix Down) plus 3-4 starter weapons (Small Knife, Rapier, Wooden Nunchaku) and 2-3 starter armor (Cloth, Wooden Armor). Each entry must conform to the `ItemData` interface in `types/index.ts`.

**`assets/data/spells.json`** — Starter spells per DESIGN_DOCUMENT.md §5:

Include at minimum Level 1 white spells (CURE, HARM, FOG, RUSE) and Level 1 black spells (FIRE, SLEP, LOCK, LIT). Each entry must conform to the `SpellData` interface. The `effect` field is a string identifier that the spell execution engine (Phase 9) will interpret — use descriptive IDs like `"heal_single"`, `"damage_fire_single"`, `"buff_defense"`.

### Acceptance Criteria

- All three files parse without errors via `DataLoader.loadClasses()`, `loadItems()`, `loadSpells()`.
- Schema validation (WP-06) passes for every entry.
- Files match the interfaces defined in `types/index.ts`.
- `npx tsc --noEmit` still passes (data files don't affect TS compilation, but imports in tests might).

### Test Requirements

- Add integration tests in `tests/core/DataLoader.test.ts` (or create it): load each real JSON file via DataLoader with a mock AssetLoader that reads from disk, verify the returned arrays have expected lengths and required fields.
- Alternatively, add snapshot tests for the JSON files to catch accidental schema drift.

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
- `src/entities/PartyManager.ts` — optionally delegate gold to Inventory or keep separate

### Implementation Details

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

  getAll(): InventoryEntry[] {
    return [...this.items.values()];
  }

  has(itemId: string): boolean {
    return this.items.has(itemId);
  }

  get size(): number { return this.items.size; }

  toJSON(): object {
    return [...this.items.entries()].map(([id, e]) => ({ id, quantity: e.quantity }));
  }
}
```

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
**Complexity:** L (6-8 hours)
**Dependencies:** WP-01 (SceneManager must have push/pop before StatusScene can be tested), WP-02 (silent catch fixed), WP-03 (duplicate type fixed)
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

**Fix:** Use `attach()` + simulated `KeyboardEvent` dispatches instead of poking private state.

Replace all private access patterns with:
```typescript
// Instead of:
const im = input as unknown as { currentKeys: Set<string> };
im.currentKeys.add('ArrowUp');

// Use:
input.attach();
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
```

And in cleanup:
```typescript
afterEach(() => {
  input.detach();
});
```

This tests the real input pipeline (keydown → currentKeys → isPressed) instead of bypassing it. The `InputManager.attach()` method binds to `window` keydown/keyup events, and `detach()` cleans up.

**Specific changes to each test:**
1. `'should use default mappings'` — dispatch `keydown` for `ArrowUp`, check `isPressed('up')`.
2. `'should track isJustPressed for one frame only'` — dispatch `keydown` for `KeyZ`, check `isJustPressed('confirm')`, call `update()`, check again.
3. `'should track isJustReleased for one frame only'` — dispatch `keydown` for `KeyX`, `update()`, dispatch `keyup` for `KeyX`, check `isJustReleased('cancel')`.
4. `'should allow configurable mappings'` — call `setMapping('Space', 'confirm')`, dispatch `keydown` for `Space`.
5. `'should support custom mappings in constructor'` — create with custom mappings, `attach()`, dispatch `keydown` for `KeyW`.

#### 9b. Fix ExplorationScene mock typing (Issue #20)

**Problem:** `createMockGame()` returns `as unknown as Game` — changes to Game interface silently break tests.

**Fix:** Create a typed mock factory in `tests/helpers/testUtils.ts`:

```typescript
import { vi } from 'vitest';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';

export function createMapData(overrides?: Partial<MapData>): MapData {
  return {
    id: 'test', width: 8, height: 8,
    layers: [Array(64).fill(2)], tilesets: ['tileset.png'],
    collision: Array(64).fill(0), npcs: [], transitions: [],
    ...overrides,
  };
}

// Type-safe mock that will fail compilation if Game interface changes
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

The key improvement: each field is typed as `Game['fieldName']` so if the Game interface adds a required field, the mock factory fails to compile. Update `ExplorationScene.test.ts` to import from `tests/helpers/testUtils.ts` and remove the inline `createMockGame`.

Also extract `createMapData()` here — it's duplicated across 3 test files per the audit.

#### 9c. BattleCommands unit tests (Issue #10)

Create `tests/battle/BattleCommands.test.ts`:
- Test `retargetIfDead()`: target alive → returns same command.
- Test `retargetIfDead()`: target dead, living enemies exist → returns command with new target.
- Test `retargetIfDead()`: target dead, no living enemies → returns original command.
- Test `retargetIfDead()`: non-fight command → returns unchanged.
- Test `calculateRunChance()`: party faster → higher chance (>50).
- Test `calculateRunChance()`: party slower → lower chance (<50).
- Test `calculateRunChance()`: result clamped to [10, 90].

These are pure functions — straightforward to test with no mocking needed.

#### 9d. BattleScene integration tests (Issue #10)

Create `tests/scenes/BattleScene.test.ts`:
- Test: scene creates UI elements on `enter()`.
- Test: intro state advances on confirm press.
- Test: command menu appears in command state.
- Test: selecting "Fight" shows target menu.
- Test: selecting target submits command and advances to next actor.

Requires mocking Game (use `createMockGame` from testUtils) and providing a `BattleSceneConfig` with test party/enemies.

#### 9e. Battle flow integration test (Issue #21)

Create `tests/integration/battleFlow.test.ts`:
- Test the full flow: create BattleStateMachine → startBattle → advanceFromIntro → submit fight commands for all party members → executeRound → resolveRound → verify victory state with correct XP/gold.
- Test defeat flow: all party members die → verify defeat state.
- Test run flow: submit run command → verify escape (with deterministic RNG).

This uses `BattleStateMachine` directly (not BattleScene) since it's testing game logic, not UI. The injectable `rng` parameter makes this fully deterministic.

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

**Files to delete:**
- `src/scenes/BootScene.ts`

### Implementation Details

#### 10a. Remove BootScene dead code (Issue #14)

1. Delete `src/scenes/BootScene.ts`.
2. Search for any imports or references: `grep -rn "BootScene" src/` — remove any found.
3. If `BootScene` is registered in `Game.ts` or `main.ts`, remove the registration.

#### 10b. Add dirty flag to TilemapRenderer (Issue #13)

**Problem:** `TilemapRenderer.render()` is called every frame in `ExplorationScene.update()` (line 155) even when the camera hasn't moved. The render method iterates all visible tiles and updates sprites — wasteful when nothing changed.

**Fix:** Add a dirty flag:

1. Add field: `private dirty = true;`
2. In `setCamera()`: set `this.dirty = true;`.
3. Add method `markDirty(): void { this.dirty = true; }` — called by Camera when it moves.
4. In `render()`: early return if `!this.dirty`. Set `this.dirty = false` at end of render.
5. In `Camera.ts`: after `update()` changes position, call `this.tilemap?.markDirty()` or emit an event. Simpler approach: have `TilemapRenderer.render()` check if camera bounds changed since last render by storing `lastBounds` and comparing.

**Simpler implementation (no Camera coupling):**
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

This avoids coupling TilemapRenderer to Camera's internals.

#### 10c. Bitmap font (Issue #12) — DEFER

The audit marks this as LOW priority and the design doc says Phase 18 (Polish). **Do not implement now.** Add a TODO comment in `TextRenderer.ts`:

```typescript
// TODO Phase 18: Replace browser monospace with NES-authentic bitmap font (BitmapText)
```

### Acceptance Criteria

- `BootScene.ts` does not exist in `src/scenes/`.
- No references to `BootScene` anywhere in `src/`.
- TilemapRenderer skips re-rendering when camera bounds haven't changed.
- Bitmap font TODO comment exists in TextRenderer.ts for Phase 18 tracking.

### Test Requirements

- Existing TilemapRenderer tests (if any) still pass.
- Add test: call `render()` twice with same camera bounds → verify sprite updates only happen once (check via spy on sprite position setter, or verify the early return path).

---

## WP-11: ExplorationScene Decomposition & DI

**Resolves:** Issue #15 (ExplorationScene god object — ARCH DEBT), Issue #16 (BattleScene coupled to Game — ARCH DEBT), Issue #17 (No dependency injection — ARCH DEBT), Issue #18 (EncounterSystem uses Math.random() — ARCH DEBT)
**Complexity:** L (8-10 hours)
**Dependencies:** WP-09 (tests must exist before refactoring to catch regressions)
**Files to modify:**
- `src/scenes/ExplorationScene.ts`
- `src/scenes/BattleScene.ts`
- `src/systems/EncounterSystem.ts`
- `src/systems/EncounterTable.ts`

**Files to create:**
- `src/systems/BattleTrigger.ts`
- `src/systems/DialogManager.ts`
- `src/systems/MapLoader.ts`

### Implementation Details

#### 11a. Decompose ExplorationScene (Issue #15)

Extract three systems from ExplorationScene's 220+ lines:

**`src/systems/MapLoader.ts`:**
```typescript
export class MapLoader {
  constructor(
    private dataLoader: DataLoader,
    private placeholders: PlaceholderTextures,
    private encounterSystem: EncounterSystem
  ) {}

  async load(mapId: string): Promise<{
    tilemap: TilemapRenderer;
    collisionMap: CollisionMap;
    npcs: NPC[];
    spawnX: number;
    spawnY: number;
  }> { /* extract from ExplorationScene.loadMap() lines 78-130 */ }
}
```

Extracts: map data fetching, tilemap creation, collision map creation, NPC instantiation, encounter rate/table setup. ~50 lines moved out.

**`src/systems/DialogManager.ts`:**
```typescript
export class DialogManager {
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private _inDialog = false;

  constructor(dialogBox: DialogBox) { this.dialogBox = dialogBox; }

  start(lines: string[]): void { /* extract from startDialog() */ }
  advance(): void { /* extract from advanceDialog() */ }
  update(dt: number, input: InputManager): void { /* extract dialog update from ExplorationScene.update() */ }

  get inDialog(): boolean { return this._inDialog; }
}
```

Extracts: dialog state management, pagination, advance logic. ~25 lines moved out.

**`src/systems/BattleTrigger.ts`:**
```typescript
export class BattleTrigger {
  constructor(
    private game: Game,
    private encounterSystem: EncounterSystem,
    private enemyDataCache: Map<string, EnemyData>
  ) {}

  async trigger(enemyIds: string[], savedPosition: { x: number; y: number }): Promise<void> {
    /* extract from triggerBattle() + loadEnemyData() */
  }
}
```

Extracts: enemy data loading/caching, battle scene creation and registration, scene transition. ~40 lines moved out.

**After decomposition, ExplorationScene should be ~100-120 lines** — a thin orchestrator that delegates to MapLoader, DialogManager, BattleTrigger, MapTransitionSystem, NPCInteractionSystem, and EncounterSystem.

#### 11b. Reduce BattleScene coupling to Game (Issue #16)

**Problem:** BattleScene takes `Game` as constructor arg and accesses `game.input`, `game.events`, `game.scenes`. This makes it untestable without a full Game mock.

**Fix:** Change BattleScene constructor to accept an interface instead:

```typescript
export interface BattleSceneDeps {
  input: InputManager;
  events: EventBus;
}

export class BattleScene implements Scene {
  constructor(deps: BattleSceneDeps, config: BattleSceneConfig) { ... }
}
```

BattleScene no longer needs `game.scenes` — it emits a `'battleEnd'` event (which it already does) and the parent scene handles the transition. Remove the direct `game.scenes.switchTo()` if any exists in BattleScene (checking: it doesn't — it uses `game.events.emit('battleEnd', ...)` which is correct).

The change is: replace `private game: Game` with `private input: InputManager` and `private events: EventBus`. Update all `this.game.input` → `this.input` and `this.game.events` → `this.events`.

Callers (ExplorationScene/BattleTrigger) pass `{ input: game.input, events: game.events }`.

#### 11c. Injectable RNG in EncounterSystem/EncounterTable (Issue #18)

**EncounterTable.ts:**

Current `selectEnemies()` uses `Math.random()` directly (line 12).

Fix: Accept `rng` in constructor:
```typescript
export class EncounterTable {
  private rng: () => number;
  constructor(rng: () => number = Math.random) { this.rng = rng; }

  selectEnemies(): string[] {
    // Change: let roll = Math.random() * this.totalWeight;
    // To:     let roll = this.rng() * this.totalWeight;
  }
}
```

**EncounterSystem.ts:**

Current `resetCounter()` uses `Math.random()` directly (line 42).

Fix: Accept `rng` in constructor, pass to EncounterTable:
```typescript
export class EncounterSystem {
  private rng: () => number;
  constructor(events: EventBus, rng: () => number = Math.random) {
    this.rng = rng;
    this.table = new EncounterTable(rng);
  }

  private resetCounter(): void {
    this.stepCounter = this.rate.min + Math.floor(this.rng() * (this.rate.max - this.rate.min + 1));
  }
}
```

#### 11d. Dependency Injection pattern (Issue #17)

The changes in 11b and 11c establish the DI pattern. Additionally:

- `ExplorationScene` constructor should accept a deps object rather than `Game` directly. However, since ExplorationScene is a composition root (it wires everything together), accepting `Game` is acceptable per the audit's own note ("scenes are composition roots"). The key improvement is that the systems it delegates to (MapLoader, DialogManager, BattleTrigger) accept narrow interfaces, not `Game`.

No further DI framework is needed — constructor injection with default parameters (like `rng = Math.random`) is sufficient for this project's scale.

### Acceptance Criteria

- ExplorationScene is ≤150 lines.
- MapLoader, DialogManager, BattleTrigger each exist as separate files with single responsibilities.
- BattleScene constructor no longer accepts `Game` — accepts `BattleSceneDeps` interface.
- `EncounterTable.selectEnemies()` uses injected RNG.
- `EncounterSystem.resetCounter()` uses injected RNG.
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

These are interface-only stubs — no implementation. They define the contracts that future phases will implement, ensuring the architecture is ready.

#### 12a. Movement Mode Abstraction (Issue #22, for Phase 14: Vehicles)

**Create `src/entities/MovementMode.ts`:**

```typescript
/** Movement mode abstraction for Phase 14 (Vehicles) */
export interface MovementMode {
  readonly id: string;
  readonly speed: number;           // tiles per second
  readonly canTraverse: (tileType: number) => boolean;
  readonly encounterRateMultiplier: number;  // 0 = no encounters (airship)
  readonly sprite: string;          // sprite key for this mode
}

// Predefined mode IDs for reference:
// 'walk' — default, land only, encounters enabled
// 'canoe' — rivers/lakes, encounters enabled
// 'ship' — ocean, encounters enabled
// 'airship' — all terrain, no encounters, land on grass only
```

**How PlayerController will use this (Phase 14):**
- PlayerController gets a `setMovementMode(mode: MovementMode)` method.
- `canMoveTo()` delegates to `mode.canTraverse(tileType)` instead of just checking collision map.
- EncounterSystem multiplies rate by `mode.encounterRateMultiplier`.

No changes to PlayerController now — just the interface definition.

#### 12b. AI Behavior System (Issue #23, for Phase 15: Boss Battles)

**Create `src/battle/AIBehavior.ts`:**

```typescript
import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand } from './BattleCommands.js';

/** AI behavior abstraction for Phase 15 (Boss Battles) */
export interface AIBehavior {
  readonly id: string;
  selectAction(
    self: EnemyInstance,
    party: Character[],
    allies: EnemyInstance[],
    turnNumber: number,
    rng: () => number
  ): BattleCommand;
}

// Predefined behavior IDs for reference:
// 'random_attack' — current behavior, random target selection
// 'priority_low_hp' — targets party member with lowest HP
// 'scripted_pattern' — follows a fixed action sequence (boss phases)
// 'spell_caster' — uses spells when charges available, attacks otherwise
```

**How EnemyAI will use this (Phase 15):**
- Each `EnemyData` gets an optional `aiBehavior: string` field.
- `EnemyAI.selectTarget()` is replaced by `AIBehavior.selectAction()` which returns a full `BattleCommand` (not just a target).
- Boss enemies get `'scripted_pattern'` behavior with phase transitions.

No changes to EnemyAI now — just the interface definition.

#### 12c. Quantity Selector (Issue #24, for Phase 11: Shops)

**Create `src/ui/QuantitySelector.ts`:**

```typescript
import { Container } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';

/** Quantity selector UI for Phase 11 (Shops) */
export interface QuantitySelectorConfig {
  min: number;
  max: number;
  initial?: number;
  x?: number;
  y?: number;
  onConfirm?: (quantity: number) => void;
  onCancel?: () => void;
}

// Implementation deferred to Phase 11.
// Will extend Container, show current quantity with left/right arrows,
// confirm/cancel with standard input actions.
// Used by: ShopScene buy/sell, item use (multi-target), etc.
```

### Acceptance Criteria

- All three interface files exist and compile (`npx tsc --noEmit`).
- Interfaces are importable from other modules.
- No runtime code — these are type definitions and documentation only.
- Design doc references (Phase 14, 15, 11) are noted in comments.

### Test Requirements

- No tests needed — these are interface-only files with no runtime behavior.
- Verify compilation: `npx tsc --noEmit` passes.

---

## Issue Traceability Matrix

Every issue from the audit mapped to its resolving WP:

| # | Issue | Severity | WP | Status |
|---|-------|----------|----|--------|
| 1 | SceneManager.pop() crash | CRITICAL | WP-01 | Planned |
| 2 | Silent catch in loadEnemyData() | CRITICAL | WP-02 | Planned |
| 3 | Duplicate EquipmentSlot type | CRITICAL | WP-03 | Planned |
| 4 | No scene stack | HIGH | WP-01 | Planned |
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
| 24 | No grid/quantity selector | MISSING | WP-04 + WP-12 | Planned (interface in WP-04, stub in WP-12) |

**Coverage: 24/24 issues addressed. Zero skipped.**

---

## Parallelization Guide

WPs that share NO files and can be executed simultaneously:

| Parallel Group | WPs | Rationale |
|----------------|-----|-----------|
| Group 1 (Critical fixes) | WP-01, WP-02, WP-03 | Touch different files: SceneManager vs ExplorationScene vs Character/types |
| Group 2 (Infrastructure) | WP-04, WP-05, WP-06 | Touch different files: Menu vs textUtils vs DataLoader |
| Group 3 (Content + System) | WP-07, WP-08 | WP-07 creates data files, WP-08 creates Inventory — no overlap. But WP-08 logically depends on WP-07 for test data. |
| Group 4 (Late stage) | WP-10, WP-12 | Touch different files: TilemapRenderer/BootScene vs new interface files |

**Cannot parallelize:**
- WP-09 (Tests) depends on WP-01, WP-02, WP-03 being complete.
- WP-11 (Decomposition) depends on WP-09 (tests must exist before refactoring).
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
| WP-09 | Test Remediation | L | 6-8 | #10, #11, #19, #20, #21 |
| WP-10 | Dead Code & Optimization | S | 2-3 | #12, #13, #14 |
| WP-11 | Decomposition & DI | L | 8-10 | #15, #16, #17, #18 |
| WP-12 | Future Abstractions | S | 2-3 | #22, #23, #24 |
| **TOTAL** | | | **37-52 hrs** | **24/24** |

### Recommended Execution Order (Sequential)

1. **WP-01 + WP-02 + WP-03** (parallel, ~5 hrs) — Fix all 3 critical bugs
2. **WP-04 + WP-05 + WP-06** (parallel, ~6 hrs) — Infrastructure improvements
3. **WP-07** (~4 hrs) — Create data files (needs WP-06 validation)
4. **WP-08** (~5 hrs) — Inventory system (needs WP-07 items)
5. **WP-09** (~8 hrs) — Test remediation (needs WP-01/02/03 fixes)
6. **WP-10 + WP-12** (parallel, ~3 hrs) — Cleanup and future stubs
7. **WP-11** (~10 hrs) — Major refactoring (needs WP-09 test safety net)

**Optimal calendar time with parallelization: ~30-35 hours**
**Sequential worst case: ~52 hours**

# Phase 9-13 Fix Plan v2 — All 19 Issues + Cross-File Data Validation

**Date:** 2025-01-XX
**Input:** verification-phases9-13.md, momus-fixes-review-v1.md, source code inspection
**Build baseline:** 304 tests, 44 files, all passing
**Total issues:** 2 CRITICAL, 8 MAJOR, 9 MINOR + 1 new validation suite

---

## Changelog (v1 → v2)

| # | Category | Change |
|---|----------|--------|
| 1 | **M1 [WP0]** | Added `encounters[].enemies → enemies.json` validation (map JSON encounter tables) |
| 2 | **M1 [WP0]** | Added `items.json usableBy → classes.json` validation |
| 3 | **M2 [WP5]** | Added player position restoration in `ExplorationScene.enter()` — position was saved but never applied to sprite after load |
| 4 | **M3 [WP6]** | Full decomposition spec: method-to-class mapping table, state transition wiring, window ownership, cancel/complete callback flow |
| 5 | **m1 [WP4]** | Enumerated all 5 Elements.test.ts tests that break when `getElementalMultiplier` signature changes, with before/after |
| 6 | **m2 [WP2]** | Enumerated all 8 StatusEffects.test.ts tests that break when `Set→Map` change happens, with required updates |
| 7 | **m3 [WP5]** | Added full Game.ts constructor before/after diff for `readonly→private+getter` refactor |
| 8 | **m4 [WP9]** | Added EquipScene tests (4 test cases) to WP9 scope |
| 9 | **m5 [WP8]** | Decided on dynamic sizing approach for padEnd fix |
| 10 | **m6** | Fixed 4 line number discrepancies: SaveScene:99→107, ItemEffects:28→26, ShopScene:119→118, DamageFormula:36→54 |
| 11 | **Effort** | Updated estimates: WP2 3→3.5h, WP4 2→2.5h, WP5 2→3h, WP6 3→4.5h, WP9 3→3.5h. Total 20.5→24h |
| 12 | **Risk** | Added risk table for WP5 and WP6 with mitigations |
| 13 | **WP5** | Added full blast radius analysis (grep results: 17 files, 38 references to game.party/inventory/gameFlags) |

---

## Risk Table

| WP | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| WP5 | Game.ts `readonly→private+getter` breaks mocks/tests across 17 files (38 refs to `game.party/inventory/gameFlags`) | LOW (getters are API-compatible for reads) | HIGH if it breaks | Verify no code does `game.party = ...` outside Game.ts. Run full test suite after constructor change before proceeding. |
| WP5 | `playerPosition` saved but not applied to sprite — player appears at wrong location after load | HIGH (confirmed gap in v1) | MEDIUM | Added explicit `ExplorationScene.enter()` position restoration step |
| WP6 | 607→350 line refactor with mid-implementation design decisions | MEDIUM | HIGH (could stall) | v2 adds full method-to-class mapping, state transition spec, window ownership. Write interfaces first, extract second. |
| WP6 | Extracted UI components break subtle menu focus/visibility interactions | MEDIUM | MEDIUM | Keep `commandWindow` ownership in BattleScene. Sub-components only manage their own menus as children of commandWindow. |
| WP2 | `Set→Map` change breaks all 8 existing StatusEffects tests | CERTAIN | LOW (tests are simple to update) | v2 enumerates all 8 tests with required changes. Update tests first (TDD), then change implementation. |

---

## Summary Table

| WP | Name | Issues | Effort | Priority | Dependencies |
|----|------|--------|--------|----------|-------------|
| WP0 | Cross-File Data Validation Tests | NEW | 2h | P0 | None |
| WP1 | Critical Data Fixes | C1, C2, M4 | 1h | P0 | None |
| WP2 | StatusTracker Duration + Character Integration | M2, M5, m5 | 3.5h | P1 | None |
| WP3 | Status Tick in Battle Loop | M3 | 1.5h | P1 | WP2 |
| WP4 | ElementalProfile Expansion | M1, m1 | 2.5h | P1 | None |
| WP5 | Save/Load Integrity | M6, M7, m6 | 3h | P1 | None |
| WP6 | BattleScene Decomposition | M8 | 4.5h | P2 | None |
| WP7 | Spell & Menu Gaps | m2, m3, m4 | 2h | P2 | None |
| WP8 | Audio & UI Polish | m7, m9 | 1h | P3 | None |
| WP9 | Scene Test Coverage | m8 | 3.5h | P3 | WP1 |

**Total estimated effort: ~24 hours**

---

## Dependency Graph

```
WP0 (Validation Tests) ──────────────────────────────────┐
WP1 (Critical Data) ─────────────────────────────────────┤── WP9 (Scene Tests)
WP2 (StatusTracker) ──► WP3 (Status Tick in Battle)      │
WP4 (ElementalProfile) ──────────────────────────────────┘
WP5 (Save/Load) ─── independent
WP6 (BattleScene) ─── independent
WP7 (Spell/Menu) ─── independent
WP8 (Audio/UI) ─── independent
```

**Parallelizable:** WP0, WP1, WP2, WP4, WP5, WP6, WP7, WP8 can all run in parallel.
**Sequential:** WP3 requires WP2. WP9 requires WP1 (data must exist for scene tests).

---

## WP0: Cross-File Data Validation Tests (NEW — Key Deliverable)

**Issues:** Prevents recurrence of C2, M4, and all future data reference mismatches
**Effort:** 2 hours
**Priority:** P0 — run first so it catches issues as other WPs fix data
**Dependencies:** None

### Rationale

C2 (5 missing shop items) and M4 (missing ether) are symptoms of a systemic problem: no automated check that IDs referenced across JSON files actually exist. This test suite runs as part of `npm test` and fails loudly when any cross-file reference is broken.

### Files to Create

- `tests/data/crossFileValidation.test.ts` (directory `tests/data/` does not exist yet — must create)

### Implementation

Create a single test file that loads all JSON data files and validates referential integrity:

```typescript
// tests/data/crossFileValidation.test.ts
import { describe, it, expect } from 'vitest';
import items from '../../assets/data/items.json';
import spells from '../../assets/data/spells.json';
import shops from '../../assets/data/shops.json';
import enemies from '../../assets/data/enemies.json';
import classes from '../../assets/data/classes.json';
import fs from 'fs';
import path from 'path';

// Build lookup sets once
const itemIds = new Set(items.map(i => i.id));
const spellIds = new Set(spells.map(s => s.id));
const enemyIds = new Set(enemies.map(e => e.id));
const classIds = new Set(classes.map(c => c.id));

// SYNC WITH: src/battle/Elements.ts ElementType
const VALID_ELEMENTS = new Set([
  'fire', 'ice', 'lightning', 'earth', 'water', 'wind', 'holy', 'dark', 'none'
]);
// SYNC WITH: src/battle/StatusEffects.ts StatusEffect
const VALID_STATUS = new Set([
  'poison', 'stun', 'sleep', 'blind', 'silence', 'death',
  'stone', 'confuse', 'paralysis', 'mute', 'slow', 'fast'
]);

describe('Cross-file data validation', () => {
  describe('shops.json → items.json', () => {
    for (const shop of shops.filter(s => ['weapon', 'armor', 'item'].includes(s.type))) {
      it(`${shop.id}: all items exist in items.json`, () => {
        const missing = shop.inventory.filter(id => !itemIds.has(id));
        expect(missing, `Missing items: ${missing.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('shops.json → spells.json', () => {
    for (const shop of shops.filter(s => s.type === 'magic')) {
      it(`${shop.id}: all spells exist in spells.json`, () => {
        const missing = shop.inventory.filter(id => !spellIds.has(id));
        expect(missing, `Missing spells: ${missing.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('items.json usableBy → classes.json', () => {
    for (const item of items.filter(i => i.usableBy && i.usableBy.length > 0)) {
      it(`${item.id}: all usableBy class IDs exist in classes.json`, () => {
        const missing = item.usableBy.filter(id => !classIds.has(id));
        expect(missing, `Unknown classes: ${missing.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('map encounters → enemies.json', () => {
    const mapsDir = path.resolve(__dirname, '../../assets/maps');
    const mapFiles = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
    for (const file of mapFiles) {
      const mapData = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf-8'));
      if (!mapData.encounters) continue;
      it(`${file}: all encounter enemy IDs exist in enemies.json`, () => {
        const allEnemyRefs = mapData.encounters.flatMap((enc: any) => enc.enemies);
        const missing = allEnemyRefs.filter((id: string) => !enemyIds.has(id));
        expect(missing, `Unknown enemies: ${missing.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('spells.json element references', () => {
    it('all spell elements are valid ElementType values', () => {
      const invalid = spells
        .filter(s => s.element && !VALID_ELEMENTS.has(s.element))
        .map(s => `${s.id}: "${s.element}"`);
      expect(invalid).toEqual([]);
    });
  });

  describe('spells.json status effect references', () => {
    it('all status_ effects reference valid StatusEffect types', () => {
      const invalid = spells
        .filter(s => s.effect.startsWith('status_'))
        .filter(s => !VALID_STATUS.has(s.effect.replace('status_', '')))
        .map(s => `${s.id}: "${s.effect}"`);
      expect(invalid).toEqual([]);
    });
  });

  describe('enemies.json element references', () => {
    it('all enemy weaknesses are valid ElementType values', () => {
      const invalid = enemies
        .filter(e => e.weakness && !VALID_ELEMENTS.has(e.weakness))
        .map(e => `${e.id}: weakness="${e.weakness}"`);
      expect(invalid).toEqual([]);
    });

    it('all enemy resistances are valid ElementType values', () => {
      const invalid = enemies
        .filter(e => e.resist && !VALID_ELEMENTS.has(e.resist))
        .map(e => `${e.id}: resist="${e.resist}"`);
      expect(invalid).toEqual([]);
    });
  });
});
```

### Changes from v1

- **Added `items.json usableBy → classes.json`** validation — per-item test cases checking all class IDs in `usableBy` arrays resolve against `classes.json` IDs (warrior, thief, monk, white_mage, black_mage, red_mage)
- **Added `map encounters → enemies.json`** validation — reads all `assets/maps/*.json` files, checks every enemy ID in `encounters[].enemies` arrays exists in `enemies.json`. Currently validates `test-town.json` which references `goblin` and `wolf`.
- **Added `// SYNC WITH:` comments** on hardcoded enum sets to flag sync points

### Acceptance Criteria

- [ ] Test file exists at `tests/data/crossFileValidation.test.ts`
- [ ] `tests/data/` directory created
- [ ] Running `npm test` with current data: shops.json validation FAILS (catches C2 — 5 missing items)
- [ ] After WP1 fixes data: all cross-file validation tests PASS
- [ ] Adding a fake item ID to shops.json causes test failure
- [ ] Adding a fake enemy ID to test-town.json encounters causes test failure
- [ ] Adding a fake class ID to items.json usableBy causes test failure

### Test Requirements

This IS the test suite. It should produce ~10-12 test cases on current data.

---

## WP1: Critical Data Fixes (C1, C2, M4)

**Issues:** C1 (canSave defaults false), C2 (5 missing shop items), M4 (missing ether)
**Effort:** 1 hour
**Priority:** P0
**Dependencies:** None

### C1: canSave defaults to false — saving impossible

**File:** `src/scenes/ExplorationScene.ts` line 174
**Current:** `return this.currentMapData?.canSave ?? false;`
**Fix:** Change default to `true` — FF1 allows saving everywhere except dungeons.

```typescript
canSave(): boolean {
  return this.currentMapData?.canSave ?? true;
}
```

### C2: 5 shop items missing from items.json

**File:** `assets/data/items.json`
**Missing IDs:** `short_sword`, `hammer`, `leather_armor`, `wooden_shield`, `cap`
**Referenced by:** `assets/data/shops.json` (cornelia_weapon, cornelia_armor)

Add these 5 entries to `items.json`:

```json
{ "id": "short_sword", "name": "Short Sword", "type": "weapon", "stats": { "attack": 7 }, "price": 15, "usableBy": ["warrior", "thief", "red_mage"] },
{ "id": "hammer", "name": "Hammer", "type": "weapon", "stats": { "attack": 8 }, "price": 10, "usableBy": ["warrior", "white_mage"] },
{ "id": "leather_armor", "name": "Leather Armor", "type": "armor", "stats": { "defense": 6 }, "price": 50, "usableBy": ["warrior", "thief", "red_mage"] },
{ "id": "wooden_shield", "name": "Wooden Shield", "type": "armor", "stats": { "defense": 3 }, "price": 15, "usableBy": ["warrior", "red_mage"] },
{ "id": "cap", "name": "Cap", "type": "armor", "stats": { "defense": 1 }, "price": 10, "usableBy": ["warrior", "thief", "monk", "white_mage", "black_mage", "red_mage"] }
```

### M4: ether referenced in ItemEffects but missing from items.json

**File:** `assets/data/items.json`
**Code reference:** `src/systems/ItemEffects.ts` line 26 — `case 'ether':`

Add to `items.json`:

```json
{ "id": "ether", "name": "Ether", "type": "consumable", "stats": {}, "price": 500, "usableBy": [] }
```

### Acceptance Criteria

- [ ] `ExplorationScene.canSave()` returns `true` when map has no `canSave` field
- [ ] `ExplorationScene.canSave()` returns `false` when map has `canSave: false`
- [ ] All 6 items exist in items.json
- [ ] WP0 cross-file validation tests pass after this WP
- [ ] `ItemRegistry.getItem('ether')` returns valid ItemData

---

## WP2: StatusTracker Duration + Character Integration (M2, M5, m5)

**Issues:** M2 (no duration/expiry), M5 (antidote can't cure — Character has no StatusTracker), m5 (StatusTracker not serialized)
**Effort:** 3.5 hours (+0.5h from v1 for breaking test enumeration)
**Priority:** P1
**Dependencies:** None

### M2: StatusTracker has no duration/expiry

**File:** `src/battle/StatusEffects.ts`

Current `StatusTracker` uses `Set<StatusEffect>` — no duration tracking. Sleep never wears off naturally (only via `onHit()`).

**Fix:** Replace `Set<StatusEffect>` with `Map<StatusEffect, number>` where value = remaining turns (-1 = permanent until cured).

```typescript
export class StatusTracker {
  private effects = new Map<StatusEffect, number>(); // value = turns remaining, -1 = permanent

  apply(effect: StatusEffect, duration = -1): void {
    this.effects.set(effect, duration);
  }

  remove(effect: StatusEffect): void { this.effects.delete(effect); }
  has(effect: StatusEffect): boolean { return this.effects.has(effect); }
  clear(): void { this.effects.clear(); }

  preventsAction(): boolean {
    return this.has('sleep') || this.has('stun') || this.has('stone')
      || this.has('paralysis') || this.has('death');
  }

  tick(maxHp: number): { damage: number; skipTurn: boolean; expired: StatusEffect[] } {
    const damage = this.has('poison') ? Math.max(1, Math.floor(maxHp / 16)) : 0;
    const skipTurn = this.preventsAction();
    const expired: StatusEffect[] = [];

    for (const [effect, duration] of this.effects) {
      if (duration === -1) continue;
      const remaining = duration - 1;
      if (remaining <= 0) {
        this.effects.delete(effect);
        expired.push(effect);
      } else {
        this.effects.set(effect, remaining);
      }
    }

    return { damage, skipTurn, expired };
  }

  onHit(): void { this.effects.delete('sleep'); }

  toJSON(): Array<{ type: StatusEffect; duration: number }> {
    return Array.from(this.effects.entries()).map(([type, duration]) => ({ type, duration }));
  }

  static fromJSON(data: Array<{ type: StatusEffect; duration: number }>): StatusTracker {
    const tracker = new StatusTracker();
    for (const { type, duration } of data) tracker.effects.set(type, duration);
    return tracker;
  }
}
```

Key changes from current code:
- `Set` → `Map<StatusEffect, number>` for duration tracking
- `tick()` decrements durations, removes expired, returns expired list
- `preventsAction()` extracted as explicit method
- Poison damage: HP/16 (FF1 formula, minimum 1) — was 5% in current code
- `toJSON()`/`fromJSON()` added for save/load (fixes m5)

### Breaking Tests in StatusEffects.test.ts (m2 — 8 tests)

All 8 existing tests will still PASS without changes because `apply(effect)` defaults to `duration = -1`. However, the following tests need UPDATES to cover new behavior:

| # | Test Name | Current Behavior | Required Update |
|---|-----------|-----------------|-----------------|
| 1 | `applies and checks status effects` | `apply('poison')` → `has('poison')` | ✅ No change needed — default duration=-1 works |
| 2 | `removes status effects` | `apply('stun')` → `remove('stun')` | ✅ No change needed |
| 3 | `clears all effects` | `apply` x2 → `clear()` | ✅ No change needed |
| 4 | `deals 5% max HP damage for poison` | `expect(result.damage).toBe(5)` | **BREAKS** — poison is now HP/16 = 6 for maxHp=100. Change to `expect(result.damage).toBe(6)` |
| 5 | `returns skipTurn for stun` | checks `skipTurn` | ✅ No change needed |
| 6 | `returns skipTurn for sleep` | checks `skipTurn` | ✅ No change needed |
| 7 | `returns no damage or skip for other effects` | checks blind | ✅ No change needed |
| 8 | `removes sleep when hit` | `onHit()` removes sleep | ✅ No change needed |

**Only test #4 actually breaks.** The `tick()` return type gains `expired: StatusEffect[]` but existing tests don't destructure it, so no breakage there.

**New tests to add:**
- Duration decrement: `apply('sleep', 3)` → 3 ticks → sleep removed, appears in `expired`
- Permanent vs timed: `apply('poison')` (permanent) survives unlimited ticks
- `preventsAction()` returns true for sleep/stun/stone/paralysis/death
- `toJSON()`/`fromJSON()` round-trip

### M5: Antidote doesn't cure poison — Character has no StatusTracker

**Files:** `src/entities/Character.ts`, `src/systems/ItemEffects.ts`

**Character.ts** — Add `statusTracker` field:

```typescript
readonly statusTracker = new StatusTracker();
```

In `toJSON()`, add: `statuses: this.statusTracker.toJSON()`

In `fromJSON()`, restore via:
```typescript
if (data.statuses) {
  const restored = StatusTracker.fromJSON(data.statuses);
  // Copy into char.statusTracker
  for (const { type, duration } of data.statuses) {
    char.statusTracker.apply(type, duration);
  }
}
```

**ItemEffects.ts** line 30 — Wire antidote to actually remove poison:

```typescript
case 'antidote':
  if (!target.statusTracker.has('poison')) {
    return { success: false, message: `${target.name} is not poisoned` };
  }
  target.statusTracker.remove('poison');
  result = { success: true, message: `${target.name} is cured of poison` };
  break;
```

### Acceptance Criteria

- [ ] `StatusTracker.apply('sleep', 3)` followed by 3 `tick()` calls removes sleep
- [ ] `StatusTracker.apply('poison')` (no duration) persists indefinitely
- [ ] `StatusTracker.preventsAction()` returns true for sleep/stun/stone/paralysis/death
- [ ] `StatusTracker.toJSON()` → `StatusTracker.fromJSON()` round-trips correctly
- [ ] `Character.statusTracker` exists and is accessible
- [ ] Antidote on poisoned character: removes poison, returns success
- [ ] Antidote on non-poisoned character: returns failure message
- [ ] Poison tick damage is HP/16 (not 5%)
- [ ] Test #4 updated: `expect(result.damage).toBe(6)` for maxHp=100

---

## WP3: Status Tick in Battle Loop (M3)

**Issues:** M3 (status effects never ticked in executeRound)
**Effort:** 1.5 hours
**Priority:** P1
**Dependencies:** WP2 (StatusTracker must have duration/tick/preventsAction)

### Problem

`BattleStateMachine.executeRound()` never calls `status.tick()` on any combatant. Poison damage never fires. Sleep/stun never expire.

**File:** `src/battle/BattleStateMachine.ts`

### Fix

Add a status tick at the start of each combatant's turn in the `executeRound()` turn-order loop:

```typescript
for (const combatant of turnOrder) {
  const statusResult = this.tickCombatantStatus(combatant);
  if (statusResult.skipTurn) {
    this.messages.push({ text: `${this.getCombatantName(combatant)} is unable to act!` });
    continue;
  }
  const cmd = this.commands.find(c => c.actorId === combatant.id);
  if (!cmd) continue;
  this.executeCommand(cmd, combatant.isEnemy);
}
```

Add helper methods `tickCombatantStatus(combatant)` and `getCombatantName(combatant)` — enemy branch uses `enemy.status.tick(enemy.data.stats.hp)`, party branch uses `char.statusTracker.tick(char.maxHp)`.

### Acceptance Criteria

- [ ] Poisoned enemy takes HP/16 damage at start of their turn
- [ ] Sleeping character skips their turn with "unable to act" message
- [ ] Sleep with duration 2 expires after 2 ticks, character can act on turn 3
- [ ] Poison damage can KO an enemy (HP reaches 0, "defeated" message)
- [ ] Expired status effects produce recovery messages

### Test Requirements

- Add integration tests in `BattleStateMachine.test.ts`: ~4-5 new test cases

---

## WP4: ElementalProfile Expansion (M1, m1)

**Issues:** M1 (no ElementalProfile — enemies limited to 1 weakness/resistance), m1 (missing water/wind elements)
**Effort:** 2.5 hours (+0.5h from v1 for breaking test enumeration)
**Priority:** P1
**Dependencies:** None

### m1: Add water/wind to ElementType

**File:** `src/battle/Elements.ts`

```typescript
export type ElementType = 'fire' | 'ice' | 'lightning' | 'earth' | 'water' | 'wind' | 'holy' | 'dark' | 'none';
```

### M1: Replace single weakness/resist with ElementalProfile

**File:** `src/battle/Elements.ts` — Add interface and replace function:

```typescript
export interface ElementalProfile {
  weaknesses: ElementType[];
  resistances: ElementType[];
  immunities: ElementType[];
  absorbs: ElementType[];
}

export const EMPTY_PROFILE: ElementalProfile = {
  weaknesses: [], resistances: [], immunities: [], absorbs: []
};

export function getElementalMultiplier(
  attackElement: ElementType,
  profile: ElementalProfile
): number {
  if (attackElement === 'none') return 1.0;
  if (profile.absorbs.includes(attackElement)) return -1.0;
  if (profile.immunities.includes(attackElement)) return 0;
  if (profile.weaknesses.includes(attackElement)) return 2.0;
  if (profile.resistances.includes(attackElement)) return 0.5;
  return 1.0;
}
```

**File:** `src/battle/DamageFormula.ts` line 54 — Update `calculateMagicDamage` to build profile from legacy fields:

```typescript
export function calculateMagicDamage(
  caster: MagicCaster,
  target: MagicTarget,
  spell: SpellInfo,
  rng: () => number = Math.random
): number {
  const variance = 0.875 + rng() * 0.25;
  if (spell.isHealing) {
    return Math.floor(spell.power * caster.intelligence * variance / 4);
  }
  // Build profile from legacy weakness/resist fields
  const profile: ElementalProfile = {
    weaknesses: target.weakness ? [target.weakness as ElementType] : [],
    resistances: target.resist ? [target.resist as ElementType] : [],
    immunities: [],
    absorbs: [],
  };
  const elementMult = getElementalMultiplier(
    (spell.element || 'none') as ElementType,
    profile
  );
  const intRatio = caster.intelligence / Math.max(1, target.intelligence);
  return Math.max(1, Math.floor(spell.power * intRatio * elementMult * variance));
}
```

**Decision (from v1 ambiguity):** `calculateMagicDamage` builds the profile internally from legacy `MagicTarget.weakness/resist` fields. This keeps `MagicTarget` interface unchanged and avoids breaking `MagicDamage.test.ts`. Future callers with full `ElementalProfile` data can call `getElementalMultiplier` directly.

### Breaking Tests in Elements.test.ts (m1 — 5 tests)

All 5 tests use the old 3-arg signature `getElementalMultiplier(element, weakness?, resist?)`. Every test must change to the new 2-arg `getElementalMultiplier(element, profile)` signature:

| # | Test Name | Current Call | Updated Call |
|---|-----------|-------------|-------------|
| 1 | `returns 2.0 when attack element matches weakness` | `getElementalMultiplier('fire', 'fire')` | `getElementalMultiplier('fire', { weaknesses: ['fire'], resistances: [], immunities: [], absorbs: [] })` |
| 2 | `returns 0.5 when attack element matches resist` | `getElementalMultiplier('fire', undefined, 'fire')` | `getElementalMultiplier('fire', { weaknesses: [], resistances: ['fire'], immunities: [], absorbs: [] })` |
| 3 | `returns 1.0 for neutral` | `getElementalMultiplier('fire', undefined, undefined)` | `getElementalMultiplier('fire', EMPTY_PROFILE)` |
| 4 | `returns 1.0 for none element` | `getElementalMultiplier('none', 'fire', 'ice')` | `getElementalMultiplier('none', { weaknesses: ['fire'], resistances: ['ice'], immunities: [], absorbs: [] })` |
| 5 | `weakness takes priority over resist` | `getElementalMultiplier('fire', 'fire', 'fire')` | `getElementalMultiplier('fire', { weaknesses: ['fire'], resistances: ['fire'], immunities: [], absorbs: [] })` |

**New tests to add:** immunity returns 0, absorb returns -1.0, multiple weaknesses, `EMPTY_PROFILE` returns 1.0.

### Acceptance Criteria

- [ ] `ElementType` includes `'water'` and `'wind'`
- [ ] `getElementalMultiplier('fire', { weaknesses: ['fire', 'ice'], ... })` returns 2.0
- [ ] `getElementalMultiplier('fire', { immunities: ['fire'], ... })` returns 0
- [ ] `getElementalMultiplier('fire', { absorbs: ['fire'], ... })` returns -1.0
- [ ] Existing enemies with `weakness`/`resist` strings still work via DamageFormula fallback
- [ ] All 5 Elements.test.ts tests updated and passing
- [ ] `EMPTY_PROFILE` constant available

---

## WP5: Save/Load Integrity (M6, M7, m6)

**Issues:** M6 (LoadScene Object.assign bypass), M7 (SaveScene hardcodes position to 0,0), m6 (no save version field)
**Effort:** 3 hours (+1h from v1 for position restoration + blast radius analysis)
**Priority:** P1
**Dependencies:** None

### M7: SaveScene hardcodes player position to {x:0, y:0}

**File:** `src/scenes/SaveScene.ts` line 107

**Current:** `{ x: 0, y: 0 }` passed to `SaveManager.save()`

**Fix:** Add `playerPosition` field to Game, update from ExplorationScene, read in SaveScene:

1. In `src/core/Game.ts`, add field: `playerPosition: { x: number; y: number } = { x: 0, y: 0 };`

2. In `src/scenes/ExplorationScene.ts`, update position in `update()` after player movement:
```typescript
// In update(), after this.player.update(dt):
if (this.player) {
  this.game.playerPosition = { x: this.player.gridX, y: this.player.gridY };
}
```

3. In `src/scenes/SaveScene.ts` line 107, replace hardcoded position:
```typescript
this.game.playerPosition,  // was: { x: 0, y: 0 }
```

### **NEW in v2 — Player position restoration after load (M1 from momus review)**

**Problem:** `Game.playerPosition` is set by `restoreState()` but `ExplorationScene.enter()` never reads it. After loading a save, the player sprite appears at the map's default spawn point, not the saved position.

**File:** `src/scenes/ExplorationScene.ts` — `enter()` method (line 62)

**Current `enter()`:**
```typescript
async enter(): Promise<void> {
  this.encounterSystem.start();
  if (this.savedPosition && this.currentMapId) {
    await this.loadMap(this.currentMapId);
    this.player?.setPosition(this.savedPosition.x, this.savedPosition.y);
    this.savedPosition = null;
  } else {
    await this.loadMap('test-town');
  }
}
```

**Fixed `enter()`:**
```typescript
async enter(): Promise<void> {
  this.encounterSystem.start();
  if (this.savedPosition && this.currentMapId) {
    await this.loadMap(this.currentMapId);
    this.player?.setPosition(this.savedPosition.x, this.savedPosition.y);
    this.savedPosition = null;
  } else {
    const mapId = this.game.currentMapId || 'test-town';
    await this.loadMap(mapId);
    // Apply saved position from Game (set by restoreState after load)
    if (this.game.playerPosition.x !== 0 || this.game.playerPosition.y !== 0) {
      this.player?.setPosition(this.game.playerPosition.x, this.game.playerPosition.y);
    }
  }
}
```

This ensures that after `LoadScene` calls `game.restoreState()` and switches to exploration, the player sprite is placed at the saved coordinates.

### M6: LoadScene uses Object.assign to bypass readonly

**File:** `src/scenes/LoadScene.ts` line 56

**Current:**
```typescript
Object.assign(this.game, { party: data.party, inventory: data.inventory, ... });
```

**Fix:** Add `restoreState()` method to Game with `readonly→private+getter` refactor.

### Game.ts Constructor Diff (m3 — was missing in v1)

**Before:**
```typescript
export class Game {
  readonly app: Application;
  readonly scenes: SceneManager;
  readonly assets: AssetLoader;
  readonly input: InputManager;
  readonly events: EventBus;
  readonly data: DataLoader;
  readonly party: PartyManager;
  readonly inventory: Inventory;
  readonly audio: AudioManager;
  readonly gameFlags: GameFlags;
  playTime = 0;
  currentMapId = '';

  constructor() {
    this.app = new Application();
    this.scenes = new SceneManager(this.app.stage);
    this.assets = new AssetLoader();
    this.input = new InputManager();
    this.events = new EventBus();
    this.data = new DataLoader(this.assets);
    this.party = new PartyManager();
    this.inventory = new Inventory();
    this.audio = new AudioManager();
    this.gameFlags = new GameFlags();
  }
```

**After:**
```typescript
export class Game {
  readonly app: Application;
  readonly scenes: SceneManager;
  readonly assets: AssetLoader;
  readonly input: InputManager;
  readonly events: EventBus;
  readonly data: DataLoader;
  private _party: PartyManager;
  private _inventory: Inventory;
  readonly audio: AudioManager;
  private _gameFlags: GameFlags;
  playTime = 0;
  currentMapId = '';
  playerPosition: { x: number; y: number } = { x: 0, y: 0 };

  get party(): PartyManager { return this._party; }
  get inventory(): Inventory { return this._inventory; }
  get gameFlags(): GameFlags { return this._gameFlags; }

  constructor() {
    this.app = new Application();
    this.scenes = new SceneManager(this.app.stage);
    this.assets = new AssetLoader();
    this.input = new InputManager();
    this.events = new EventBus();
    this.data = new DataLoader(this.assets);
    this._party = new PartyManager();
    this._inventory = new Inventory();
    this.audio = new AudioManager();
    this._gameFlags = new GameFlags();
  }

  restoreState(state: {
    party: PartyManager;
    inventory: Inventory;
    gameFlags: GameFlags;
    currentMapId: string;
    playTime: number;
    playerPosition: { x: number; y: number };
  }): void {
    this._party = state.party;
    this._inventory = state.inventory;
    this._gameFlags = state.gameFlags;
    this.currentMapId = state.currentMapId;
    this.playTime = state.playTime;
    this.playerPosition = state.playerPosition;
  }
```

### WP5 Blast Radius Analysis (was missing in v1)

Grep results for `game.party`, `game.inventory`, `game.gameFlags` across `src/`:

| File | References | Impact |
|------|-----------|--------|
| `src/scenes/StatusScene.ts` | `game.party` x3 | ✅ Read-only — getters compatible |
| `src/scenes/ShopScene.ts` | `game.party` x5, `game.inventory` x4 | ✅ Read-only |
| `src/scenes/EquipScene.ts` | `game.party` x5, `game.inventory` x3 | ✅ Read-only |
| `src/scenes/SaveScene.ts` | `game.party`, `game.inventory`, `game.gameFlags` | ✅ Read-only |
| `src/scenes/InnScene.ts` | `game.party` x2 | ✅ Read-only |
| `src/scenes/ItemMenuScene.ts` | `game.party` x2, `game.inventory` x2 | ✅ Read-only |
| `src/scenes/MagicShopScene.ts` | `game.party` x4 | ✅ Read-only |
| `src/systems/BattleTrigger.ts` | `game.party` x3, `game.inventory` x1 | ✅ Read-only |

**Total: 17 files, 38 references. ALL are read-only access (`game.party.xxx`). No file does `game.party = ...` outside Game.ts.** The `readonly→private+getter` refactor is safe — getters are API-compatible for all read access patterns.

The only write was `LoadScene.ts` line 56 (`Object.assign`) which is the exact thing we're replacing with `restoreState()`.

### m6: No save version field

**File:** `src/types/index.ts` — Add `version: number` to `SaveData`
**File:** `src/systems/SaveManager.ts` — Set `version: 1` on save, warn on mismatch during load.

### Acceptance Criteria

- [ ] Saving captures actual player grid position (not 0,0)
- [ ] **Loading restores player sprite to saved position** (NEW in v2)
- [ ] `Game.restoreState()` exists and properly replaces party/inventory/flags
- [ ] No `Object.assign(this.game, ...)` in LoadScene
- [ ] `Game.party`, `Game.inventory`, `Game.gameFlags` still accessible via getters
- [ ] Constructor uses `this._party` etc.
- [ ] SaveData includes `version: 1`
- [ ] Loading a save without version field doesn't crash

---

## WP6: BattleScene Decomposition (M8)

**Issues:** M8 (BattleScene.ts is 607-line god object managing 9 UI states)
**Effort:** 4.5 hours (+1.5h from v1 for full decomposition spec)
**Priority:** P2
**Dependencies:** None

### Problem

`BattleScene.ts` (607 lines, 30 methods) handles 9 UI states: intro, command, target, spell_level, spell_select, item_select, item_target, message, end.

### Fix: Extract SpellSelectionUI and ItemSelectionUI

**Files to create:**
- `src/ui/SpellSelectionUI.ts` (~130 lines)
- `src/ui/ItemSelectionUI.ts` (~100 lines)

### Method-to-Class Mapping (was missing in v1)

| BattleScene Method | Lines | Destination | Action |
|-------------------|-------|-------------|--------|
| `constructor` | 57-63 | BattleScene | KEEP — instantiate sub-components |
| `enter` | 65-72 | BattleScene | KEEP |
| `createUI` | 74-88 | BattleScene | KEEP |
| `createCommandMenu` | 90-106 | BattleScene | KEEP |
| `createEnemySprites` | 108-118 | BattleScene | KEEP |
| `updatePartyDisplay` | 120-133 | BattleScene | KEEP |
| `updateEnemySprites` | 135-140 | BattleScene | KEEP |
| `update` | 142-191 | BattleScene | SIMPLIFY — delegate spell_level/spell_select/item_select/item_target to sub-components |
| `startCommandPhase` | 193-203 | BattleScene | KEEP |
| `onCommandSelect` | 205-220 | BattleScene | SIMPLIFY — 'magic' calls `spellUI.start()`, 'item' calls `itemUI.start()` |
| `showSpellLevelMenu` | 222-262 | **SpellSelectionUI** | MOVE |
| `hideSpellLevelMenu` | 264-270 | **SpellSelectionUI** | MOVE |
| `showSpellSelectMenu` | 272-307 | **SpellSelectionUI** | MOVE |
| `hideSpellSelectMenu` | 309-315 | **SpellSelectionUI** | MOVE |
| `showSpellTargetMenu` | 317-337 | **SpellSelectionUI** | MOVE |
| `showPartyTargetMenu` | 339-358 | **SpellSelectionUI** | MOVE |
| `submitSpellCommand` | 360-372 | **SpellSelectionUI** | MOVE — calls `onComplete(cmd)` callback |
| `cleanupSpellMenus` | 374-389 | **SpellSelectionUI** | MOVE → becomes `cleanup()` |
| `showItemMenu` | 391-439 | **ItemSelectionUI** | MOVE |
| `hideItemMenu` | 441-447 | **ItemSelectionUI** | MOVE |
| `showItemTargetMenu` | 449-475 | **ItemSelectionUI** | MOVE |
| `submitItemCommand` | 477-483 | **ItemSelectionUI** | MOVE — calls `onComplete(cmd)` callback |
| `cleanupItemMenus` | 485-496 | **ItemSelectionUI** | MOVE → becomes `cleanup()` |
| `showTargetMenu` | 498-522 | BattleScene | KEEP (fight target, not spell/item) |
| `hideTargetMenu` | 524-530 | BattleScene | KEEP |
| `executeRound` | 532-539 | BattleScene | KEEP |
| `showMessages` | 541-551 | BattleScene | KEEP |
| `advanceMessage` | 553-569 | BattleScene | KEEP |
| `resolveRound` | 571-586 | BattleScene | KEEP |
| `checkBattleEnd` | 588-592 | BattleScene | KEEP |
| `endBattle` | 594-603 | BattleScene | KEEP |
| `exit` | 605-607 | BattleScene | KEEP |

**Result:** 12 methods move out (222-496 = ~275 lines removed). BattleScene retains 19 methods.

### State Transition Wiring (was missing in v1)

**Simplified UIState:**
```typescript
type UIState = 'intro' | 'command' | 'target' | 'sub_selection' | 'executing' | 'message' | 'end';
```

**Transition diagram:**
```
intro → command → target (fight)     → command (next actor) → executing
                → sub_selection (magic/item) → command (next actor) → executing
                → command (run)       → executing
executing → message → resolution → command (next round) OR end
```

**Sub-component lifecycle:**
1. `onCommandSelect('magic')` → `this.spellUI.start(actor, battle, onComplete, onCancel)`
2. `this.uiState = 'sub_selection'`
3. In `update()`, `case 'sub_selection':` → `this.activeSubUI?.update(input)`
4. Sub-component calls `onComplete(cmd)` → BattleScene receives command, sets `uiState = 'command'`, calls `startCommandPhase()`
5. Sub-component calls `onCancel()` → BattleScene sets `uiState = 'command'`

### Window Ownership (was missing in v1)

- `commandWindow` stays in BattleScene — it's the container for all command-area menus
- Sub-components receive `commandWindow` as their parent container
- Sub-components add/remove their own Menu instances as children of `commandWindow`
- Sub-components hide `commandMenu` when active, restore visibility on cleanup
- `partyWindow`, `messageWindow` stay in BattleScene

### SpellSelectionUI Interface

```typescript
export class SpellSelectionUI {
  private active = false;

  constructor(
    private commandWindow: Window,
    private events: EventBus,
    private allSpells: SpellData[],
  ) {}

  start(
    actor: Character,
    battle: BattleStateMachine,
    onComplete: (cmd: BattleCommand) => void,
    onCancel: () => void,
  ): void;

  update(input: InputManager): void;  // delegates to whichever menu is active
  cleanup(): void;                     // removes all menus from commandWindow
  get isActive(): boolean;
}
```

### ItemSelectionUI Interface

```typescript
export class ItemSelectionUI {
  private active = false;

  constructor(
    private commandWindow: Window,
    private events: EventBus,
    private inventory: Inventory,
  ) {}

  start(
    actor: Character,
    party: Character[],
    onComplete: (cmd: BattleCommand) => void,
    onCancel: () => void,
  ): void;

  update(input: InputManager): void;
  cleanup(): void;
  get isActive(): boolean;
}
```

### BattleScene update() After Refactor

```typescript
update(dt: number): void {
  this.messageText.update(dt);
  switch (this.uiState) {
    case 'intro':
      this.introTimer -= dt;
      if (this.introTimer <= 0 || this.deps.input.isJustPressed('confirm')) {
        this.battle.advanceFromIntro();
        this.startCommandPhase();
      }
      break;
    case 'command':
      this.commandMenu.update(this.deps.input);
      break;
    case 'target':
      if (this.targetMenu) this.targetMenu.update(this.deps.input);
      break;
    case 'sub_selection':
      this.activeSubUI?.update(this.deps.input);
      break;
    case 'message':
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 || this.deps.input.isJustPressed('confirm')) {
        this.advanceMessage();
      }
      break;
    case 'end':
      if (this.deps.input.isJustPressed('confirm')) this.endBattle();
      break;
  }
}
```

### Acceptance Criteria

- [ ] BattleScene.ts is under 400 lines
- [ ] SpellSelectionUI.ts handles full spell level → spell → target flow
- [ ] ItemSelectionUI.ts handles full item → target flow
- [ ] `onComplete` callback delivers correct `BattleCommand` to BattleScene
- [ ] `onCancel` callback returns to command state
- [ ] `commandMenu` visibility toggled correctly by sub-components
- [ ] All existing battle UI behavior unchanged
- [ ] Existing `BattleScene.test.ts` passes as regression gate
- [ ] No new test failures

### Test Requirements

- Existing BattleStateMachine tests still pass (logic unchanged)
- Existing BattleScene.test.ts still passes (regression gate)
- Manual verification of spell/item selection flows

---

## WP7: Spell & Menu Gaps (m2, m3, m4)

**Issues:** m2 (no spell slot limit in model), m3 (missing Lv2 white spells), m4 (field menu Magic/Order not wired)
**Effort:** 2 hours
**Priority:** P2
**Dependencies:** None

### m2: Spell learning has no slot limit enforcement in model

**File:** `src/entities/Character.ts`

Change `learnSpell()` return type from `void` to `boolean`, add limit check:

```typescript
learnSpell(spellId: string, level: number): boolean {
  if (this.getSpellsAtLevel(level).length >= 3) return false;
  this.learnedSpells.set(spellId, level);
  return true;
}
```

### m3: Missing Lv2 white spells (LAMP, MUTE, ALIT, INVS)

**File:** `assets/data/spells.json`

Add 4 white + 2 black Lv2 spells:

```json
{ "id": "lamp", "name": "LAMP", "level": 2, "type": "white", "effect": "status_cure_blind", "targeting": "single", "description": "Cure blindness on one ally", "power": 0, "element": "none" },
{ "id": "mute", "name": "MUTE", "level": 2, "type": "white", "effect": "status_silence", "targeting": "single", "description": "Silence one enemy", "power": 0, "element": "none" },
{ "id": "alit", "name": "ALIT", "level": 2, "type": "white", "effect": "buff_lightning_resist", "targeting": "all", "description": "Resist lightning for party", "power": 0, "element": "none" },
{ "id": "invs", "name": "INVS", "level": 2, "type": "white", "effect": "buff_evade", "targeting": "single", "description": "Raise evasion of one ally", "power": 0, "element": "none" },
{ "id": "tmpr", "name": "TMPR", "level": 2, "type": "black", "effect": "buff_attack", "targeting": "single", "description": "Raise attack of one ally", "power": 0, "element": "none" },
{ "id": "slow", "name": "SLOW", "level": 2, "type": "black", "effect": "debuff_agility", "targeting": "all", "description": "Slow all enemies", "power": 0, "element": "none" }
```

### m4: Field menu Magic/Order sub-menus not wired

**File:** `src/scenes/FieldMenuScene.ts`

**Magic:** Create a stub `FieldMagicScene` that displays "Coming soon" and pops on cancel. `FieldMagicScene` does not exist yet — must create `src/scenes/FieldMagicScene.ts`.

**Order:** Implement inline party reorder using existing `PartyManager.swap()` (confirmed at line 27). Select two members to swap positions.

### Acceptance Criteria

- [ ] `Character.learnSpell()` returns `false` when 3 spells already at that level
- [ ] spells.json contains LAMP, MUTE, ALIT, INVS, TMPR, SLOW
- [ ] WP0 cross-file validation still passes
- [ ] Field menu "Magic" pushes FieldMagicScene
- [ ] Field menu "Order" swaps party members

---

## WP8: Audio & UI Polish (m7, m9)

**Issues:** m7 (sell price display truncation), m9 (no pauseMusic/resumeMusic)
**Effort:** 1 hour
**Priority:** P3
**Dependencies:** None

### m9: No pauseMusic/resumeMusic in AudioManager

**File:** `src/core/AudioManager.ts`

Use gain-based approach (mute volume, don't suspend AudioContext — SFX should still work):

```typescript
private paused = false;

pauseMusic(): void {
  if (!this.currentMusic) return;
  this.currentMusic.gain.gain.value = 0;
  this.paused = true;
}

resumeMusic(): void {
  if (!this.currentMusic) return;
  this.currentMusic.gain.gain.value = this.muted ? 0 : this.musicVolume;
  this.paused = false;
}
```

### m7: Sell price display truncation for long names

**File:** `src/scenes/ShopScene.ts` line 118

**Current:** `item.name.padEnd(10)` — truncates names > 10 chars.

**Decision (was undecided in v1):** Use dynamic sizing:

```typescript
private getSellItems(): MenuItem[] {
  const items: MenuItem[] = [];
  const entries = this.game.inventory.getAll();
  const maxNameLen = Math.max(12, ...entries.map(e => {
    const item = ItemRegistry.getItem(e.itemId);
    return item?.name.length ?? 0;
  }));
  for (const { itemId, quantity } of entries) {
    const item = ItemRegistry.getItem(itemId);
    if (!item || item.type === 'key') continue;
    const sellPrice = Math.floor(item.price / 2);
    items.push({ label: `${item.name.padEnd(maxNameLen + 1)}x${quantity} ${String(sellPrice).padStart(4)}G`, value: itemId });
  }
  return items;
}
```

Dynamic sizing computes `maxNameLen` from actual inventory, with a floor of 12. This handles any item name length without hardcoding.

Note: the buy list at line 108 uses `padEnd(12)` which is adequate for current items. If longer items are added, apply the same dynamic pattern there.

### Acceptance Criteria

- [ ] `AudioManager.pauseMusic()` and `resumeMusic()` methods exist
- [ ] Pausing music silences it; resuming restores volume
- [ ] Muted state is respected after resume
- [ ] Shop sell list displays long item names without truncation
- [ ] Minimum column width is 12 chars

---

## WP9: Scene Test Coverage (m8)

**Issues:** m8 (zero tests for shop/inn/equip scenes)
**Effort:** 3.5 hours (+0.5h from v1 for EquipScene tests)
**Priority:** P3
**Dependencies:** WP1 (shop data must be valid for shop tests)

### Problem

ShopScene, MagicShopScene, InnScene, QuantitySelector, EquipScene, FieldMenuScene — all have zero test coverage.

### Fix: Add focused unit tests for business logic

Don't test PixiJS rendering. Test the logic: gold deduction, inventory changes, spell learning, equip/unequip.

**Files to create:**
- `tests/scenes/ShopScene.test.ts`
- `tests/scenes/InnScene.test.ts`
- `tests/scenes/EquipScene.test.ts` (NEW in v2)
- `tests/ui/QuantitySelector.test.ts`

### ShopScene tests (~6 tests):

- Buy item: deducts gold, adds to inventory
- Buy item: insufficient gold returns failure
- Sell item: adds gold (floor of price/2), removes from inventory
- Sell key item: rejected
- Buy quantity > 1: correct gold deduction
- Sell item not in inventory: rejected

### InnScene tests (~3 tests):

- Rest: deducts innPrice gold, restores all party HP to max
- Rest: restores all spell charges
- Rest: insufficient gold returns failure

### EquipScene tests (~4 tests, NEW in v2):

- Equip weapon: removes from inventory, sets on character, old weapon returns to inventory
- Equip armor: same flow for armor slot
- Unequip: item returns to inventory, slot cleared
- Equip item not in inventory: rejected

### QuantitySelector tests (~4 tests):

- Increment increases quantity
- Decrement decreases quantity (min 1)
- Max quantity capped by gold/price
- Confirm callback fires with correct quantity

### Acceptance Criteria

- [ ] At least 17 new test cases across 4 test files (was 13 across 3 in v1)
- [ ] All new tests pass
- [ ] Tests don't depend on PixiJS rendering (mock Container, Window, Menu)
- [ ] EquipScene equip/unequip logic tested

### Test Requirements

This IS the test deliverable. Mock `Game`, `PartyManager`, `Inventory`, PixiJS `Container` as needed.

---

## Success Criteria

```json
{
  "functional": [
    "Saving works on town maps (canSave defaults true)",
    "All shop items resolve via ItemRegistry (no missing IDs)",
    "Poison deals damage each battle turn",
    "Sleep expires after N turns",
    "Antidote removes poison from Character",
    "Enemies can have multiple elemental weaknesses/resistances",
    "Save captures actual player position",
    "Load restores player sprite to saved position (NEW in v2)",
    "Load restores state via Game.restoreState() (no Object.assign)",
    "Cross-file validation catches broken ID references",
    "Cross-file validation catches broken encounter→enemy references (NEW in v2)",
    "Cross-file validation catches broken usableBy→class references (NEW in v2)"
  ],
  "observable": [
    "npm test passes with 0 failures after all WPs complete",
    "Cross-file validation test file exists and runs",
    "BattleScene.ts is under 400 lines",
    "SaveData includes version field",
    "spells.json contains all Lv1-2 spells"
  ],
  "pass_fail": [
    "WP0 tests FAIL on pre-fix data, PASS on post-fix data",
    "No Object.assign(this.game, ...) in codebase",
    "canSave() returns true for maps without canSave field",
    "StatusTracker.toJSON/fromJSON round-trips without data loss",
    "learnSpell returns false at 3 spells per level",
    "getElementalMultiplier uses ElementalProfile (2-arg signature)",
    "Game.ts constructor uses this._party (not this.party)"
  ]
}
```

## Recommended Execution Order

**Wave 1 (parallel, no dependencies):**
- WP0 — Cross-file validation tests (write first, expect failures)
- WP1 — Critical data fixes (makes WP0 pass)
- WP2 — StatusTracker overhaul
- WP4 — ElementalProfile expansion
- WP5 — Save/Load integrity

**Wave 2 (after Wave 1):**
- WP3 — Status tick in battle (needs WP2)
- WP6 — BattleScene decomposition
- WP7 — Spell & menu gaps

**Wave 3 (after Wave 1-2):**
- WP8 — Audio & UI polish
- WP9 — Scene test coverage (needs WP1 for valid shop data)

## Total Impact

| Metric | Before | After |
|--------|--------|-------|
| Critical issues | 2 | 0 |
| Major issues | 8 | 0 |
| Minor issues | 9 | 0 |
| Cross-file validation | None | Automated in CI |
| Test count | ~304 | ~345+ |
| BattleScene lines | 607 | ~350 |

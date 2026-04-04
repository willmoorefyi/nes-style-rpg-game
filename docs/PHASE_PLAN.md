# FF1-Style RPG — Implementation Phases 9-18 (Revised)

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-23 |
| **Input** | momus-phase-review.md, DESIGN_DOCUMENT.md, PROGRESS.md, CODE_AUDIT_RECOMMENDATIONS.md, REMEDIATION_PLAN.md, full codebase inspection |
| **Momus Issues Addressed** | 16 CRITICAL, 25 MAJOR, 22 MINOR — all 63 issues |
| **Phases** | 9-18 (10 phases, Phase 17 split into 4 sub-phases = 13 total work units) |
| **Estimated Total Effort** | 295-440 hours |

---

## Reordering Rationale

Per momus review recommendations:
1. **Save/Load moved to Phase 11** (was 12) — enables playtesting after magic+items are built.
2. **Shops moved to Phase 12** (was 11) — save/load doesn't depend on shops; earlier saves help testing.
3. **Bosses moved to Phase 14** (was 15) — bosses are more immediately testable than vehicles (which need a nonexistent overworld).
4. **Vehicles moved to Phase 15** (was 14) — vehicles need overworld + terrain types; bosses don't.
5. **Phase 17 split into 17a-17d** — content is 2-4x any other phase; sub-phases make it manageable.

---

## Phase Dependency Graph

```
Phase 9: Magic System (elemental dmg, status effects, spell engine)
  │
  ├──► Phase 10: Items & Equipment (consumable effects, field menu, item registry)
  │       │
  │       ├──► Phase 11: Save/Load (serialization, story flags, save UI)  [MOVED EARLIER]
  │       │       │
  │       │       ├──► Phase 12: Shops & Economy (shop data, buy/sell, inn, magic shops)
  │       │       │
  │       │       └──► Phase 14: Boss Battles (AI redesign, scripted triggers, multi-phase)  [SWAPPED]
  │       │               │
  │       │               ├──► Phase 15: Vehicles & World Progression (terrain types, vehicles)  [SWAPPED]
  │       │               │
  │       │               └──► Phase 16: Class Upgrades (upgrade data, trigger, readonly fix)
  │       │
  │       └──► Phase 13: Audio System (AudioManager, music, SFX)  [INDEPENDENT]
  │
  └──► Phase 13: Audio System (can start after Phase 9, parallel with 10-12)

Phase 16 ──► Phase 17a-d: Content Population (maps, enemies, items, dialog)
                │
                └──► Phase 18: Polish & Balancing (playtesting, tuning, art, perf)
```

**Parallelization opportunities:**
- Phase 13 (Audio) is independent — can run parallel with Phases 10-12
- Phase 11 (Save/Load) and Phase 12 (Shops) can overlap if save/load core lands first
- Phase 17a (tooling) can start while Phase 16 finishes

---

## Cross-Cutting Systems — Home Assignments

These 4 systems were identified by momus as unassigned. Each is now explicitly owned:

| System | Assigned To | Rationale |
|--------|-------------|-----------|
| **Elemental Damage** (ElementType, weaknesses, resistances, multipliers) | **Phase 9** sub-task 1 | Foundation for magic, items, bosses, content |
| **Status Effects** (StatusEffect type, application, resolution, immunities) | **Phase 9** sub-task 2 | Foundation for spells, items, boss gimmicks |
| **Story Flags / Progression** (GameFlags class, set/has/toJSON/fromJSON) | **Phase 11** sub-task 1 | Save/Load is primary consumer; needed by 14, 15, 16 |
| **Field Menu** (Items/Magic/Equip/Status/Order/Config from overworld) | **Phase 10** sub-task 1 | Items/Magic/Equip all need it; scene stack ready |

---

## Summary Table

| Phase | Name | Key Deliverables | Effort (hrs) | Momus Issues Resolved |
|-------|------|-----------------|-------------|----------------------|
| 9 | Magic System | Elemental system, status effects, spell engine, magic damage, spell UI | 45-65 | #1,#2,#3,#4,#5,#6,#7 |
| 10 | Items & Equipment | Field menu, item registry, consumable effects, equip UI, key items | 20-30 | #8,#9,#10,#11,#12,#13 |
| 11 | Save/Load System | Story flags, serialization, deserialization, save UI, save slots | 20-30 | #20,#21,#22,#23,#24,#25,#26 |
| 12 | Shops & Economy | Shop data format, 4 shop types, magic shops, inn, quantity selector | 25-35 | #14,#15,#16,#17,#18,#19 |
| 13 | Audio System | AudioManager, asset pipeline, scene-music mapping, SFX | 15-25 | #27,#28,#29,#30,#31 |
| 14 | Boss Battles & Scripted Events | AIBehavior redesign, boss AI, multi-phase, scripted triggers, cutscenes | 35-50 | #38,#39,#40,#41,#42,#43 |
| 15 | Vehicles & World Progression | Terrain types, 3 vehicles, MovementMode impl, key item gates | 25-40 | #32,#33,#34,#35,#36,#37 |
| 16 | Class Upgrades | 6 upgraded classes, readonly fix, upgrade trigger, stat recalc | 10-18 | #44,#45,#46,#47,#48 |
| 17a | Content: Tooling & Pipeline | Tiled integration, cross-ref validation, content templates | 15-20 | #49,#50,#54 |
| 17b | Content: Maps & Encounters | Overworld, towns, dungeons, encounter tables | 35-55 | #49,#53 |
| 17c | Content: Items, Spells & Shops | Full weapon/armor/spell lists, shop inventories, economy | 20-30 | #49 |
| 17d | Content: Dialog & Story | NPC dialog, story events, boss triggers, vehicle acquisition | 25-40 | #51,#52 |
| 18 | Polish & Balancing | Playtesting, stat tuning, bitmap font, perf, deferred items | 30-50 | #55,#56,#57,#58,#59 |
| | **TOTAL** | | **295-440** | **63/63** |

---

## Infrastructure Reference

All phases should leverage existing post-remediation infrastructure:

| Infrastructure | Location | Used By Phases |
|---------------|----------|---------------|
| Scene stack (push/pop/pause/resume) | `SceneManager.ts` | 10, 11, 12, 14 |
| Scrolling Menu (maxVisible, wrap, indicators) | `ui/Menu.ts` | 9, 10, 11, 12 |
| Inventory (ID-based, add/remove/getAll) | `entities/Inventory.ts` | 10, 11, 12 |
| BattleSceneDeps interface | `scenes/battle/BattleSceneTypes.ts` | 9, 14 |
| Schema validation (validateXxxData) | `core/schemaValidation.ts` | 9, 10, 12, 17a |
| Injectable RNG (EncounterRng) | `systems/EncounterSystem.ts` | 9, 14 |
| BattleTrigger (extracted system) | `systems/BattleTrigger.ts` | 14, 15 |
| DialogManager (extracted system) | `systems/DialogManager.ts` | 14, 17d |
| MapLoader (extracted system) | `systems/MapLoader.ts` | 15, 17b |
| MovementMode interface stub | `entities/MovementMode.ts` | 15 |
| AIBehavior interface stub | `battle/AIBehavior.ts` | 14 (REDESIGN NEEDED) |
| QuantitySelector interface stub | `ui/QuantitySelector.ts` | 12 |
| Shared test utilities | `tests/helpers/testUtils.ts` | All |
| EventBus (typed events) | `core/EventBus.ts` | 13, 14 |


---

## Phase 9: Magic System

### Overview

Phase 9 is the most complex remaining phase. It delivers three foundational systems — elemental damage, status effects, and spell execution — plus the spell selection UI and spell learning model. These systems are prerequisites for items (Phase 10), bosses (Phase 14), and all content (Phase 17). The spell charge system already exists on Character; this phase builds the execution and UI layers on top.

The elemental and status systems are defined here because magic is their first consumer, but they are designed as standalone modules reusable by items, enemies, and bosses.

### Prerequisites

- Phases 1-8 complete (battle state machine, character system, data loading)
- Post-remediation: scrolling Menu, BattleSceneDeps, injectable RNG, schema validation
- `spells.yaml` exists with 10 starter spells; `SpellData` interface defined in `types/index.ts`
- `Character.spellCharges` array with get/set; `CharacterClassData.spellLevels` for class access
- `BattleStateMachine.executeCommand()` has `cmd.type === 'magic'` stub returning "No spells available"

### Sub-Tasks

**1. Define ElementType and elemental damage system (4-6 hrs)**
[Resolves momus CRITICAL #1]
- Create `src/battle/Elements.ts`
- Define `ElementType = 'fire' | 'ice' | 'lightning' | 'earth' | 'water' | 'wind' | 'holy' | 'dark' | 'none'`
- Define `ElementalProfile = { weaknesses: ElementType[]; resistances: ElementType[]; immunities: ElementType[]; absorbs: ElementType[] }`
- Define `getElementalMultiplier(element: ElementType, profile: ElementalProfile): number` — returns 2.0 (weak), 0.5 (resist), 0 (immune), -1 (absorb), 1.0 (neutral)
- Add `element?: ElementType` to `SpellData` interface in `types/index.ts`
- Add `element?: ElementType` to `ItemData.stats` for elemental weapons (Flame Sword)
- Add `elementalProfile?: ElementalProfile` to `EnemyData` in `types/index.ts`
- Update `enemies.yaml` entries with default `elementalProfile: { weaknesses: [], resistances: [], immunities: [], absorbs: [] }`
- Update `spells.yaml` entries with `element` field (FIRE→fire, LIT→lightning, ICE→ice, etc.)

**2. Define status effect system (5-8 hrs)**
[Resolves momus CRITICAL #2]
- Create `src/battle/StatusEffects.ts`
- Define `StatusType = 'poison' | 'sleep' | 'stone' | 'mute' | 'blind' | 'confuse' | 'paralysis' | 'death' | 'slow' | 'fast'`
- Define `StatusEffect = { type: StatusType; duration: number; /* -1 = permanent until cured */ }`
- Define `StatusTracker` class: `apply(effect)`, `remove(type)`, `has(type)`, `tick()` (decrement durations, remove expired), `getAll()`, `preventsAction(): boolean` (sleep, stone, paralysis, death), `toJSON()`, `fromJSON()`
- Add `statusTracker: StatusTracker` to `Character` (lazy-initialized)
- Add `statusTracker: StatusTracker` to `EnemyInstance` in `BattleStateMachine.ts`
- Add `statusImmunities?: StatusType[]` to `EnemyData`
- Define status resolution per turn in battle: tick statuses at start of combatant's turn, skip action if `preventsAction()`, apply poison damage (HP/16 per turn)
- Add `statusEffect?: StatusType` to `SpellData` for status-inflicting spells (SLEP→sleep, HOLD→paralysis, etc.)

**3. Implement magic damage formula (2-3 hrs)**
[Resolves momus MAJOR #3]
- Create `calculateMagicDamage()` in `src/battle/DamageFormula.ts`
- Formula: `baseDamage = spellPower + random(1, spellPower/2)`, then `damage = baseDamage * (casterInt / 2) / max(1, targetMagicDef)`, then apply elemental multiplier
- Accept params: `{ spellPower: number; casterIntelligence: number; element: ElementType }`, `{ magicDefense: number; elementalProfile: ElementalProfile }`, `rng`
- Return `DamageResult` (reuse existing interface, add `elementalMultiplier?: number`)

**4. Add spell learning model to Character (3-4 hrs)**
[Resolves momus MAJOR #4]
- Add `private learnedSpells: Map<number, SpellData[]>` to `Character` (key = spell level 1-8, max 3 per level)
- Add `learnSpell(spell: SpellData): boolean` — checks class access (`classData.spellLevels`), checks slot availability (max 3 per level), returns false if can't learn
- Add `getLearnedSpells(level: number): SpellData[]` — returns spells known at that level
- Add `canLearnSpell(spell: SpellData): boolean` — checks class + slot availability
- Add `getAllLearnedSpells(): Map<number, SpellData[]>` for UI display
- Serialize `learnedSpells` in `toJSON()` (as `{ level: number, spellIds: string[] }[]`)
- This is prerequisite for Phase 12 magic shops

**5. Add spellId and itemId to BattleCommand (1 hr)**
[Resolves momus MINOR #7, MAJOR #10]
- In `src/battle/BattleCommands.ts`, add to `BattleCommand`: `spellId?: string; itemId?: string;`
- No other changes needed — these are optional fields consumed by executeCommand

**6. Implement spell execution in BattleStateMachine (6-8 hrs)**
- Replace the `cmd.type === 'magic'` stub in `executeCommand()` with real logic:
  - Look up `SpellData` by `cmd.spellId` from a spell registry (passed via `BattleConfig`)
  - Deduct one charge from caster: `caster.setSpellCharges(spell.level, caster.getSpellCharges(spell.level) - 1)`
  - Route by `spell.effect` prefix: `heal` → restore HP, `damage_*` → magic damage, `buff_*` → stat modification, `status_*` → apply status, `revive` → revive with 1 HP
  - For damage spells: call `calculateMagicDamage()` with spell element and target's elemental profile
  - For status spells: check target's `statusImmunities`, apply via `StatusTracker.apply()`
  - For `targeting: 'all'`: iterate all valid targets
  - Add `spells: SpellData[]` to `BattleConfig` so the state machine has spell data available
- Add status tick at start of each combatant's turn in `executeRound()`

**7. Build spell selection UI in BattleScene (5-7 hrs)**
[Resolves momus MAJOR #5]
- Spell selection flow: command menu "Magic" → spell level menu (show levels with charges) → spell list menu (show spells at that level) → target selection (conditional)
- Create spell level menu: 8 items showing "Lv1: 3/4" format, disabled if 0 charges or no spells learned
- Create spell list menu: show learned spells at selected level, disabled if 0 charges remaining
- For `targeting: 'single'` enemy spells: reuse existing target menu
- For `targeting: 'single'` ally spells (heals): create party target menu (list party members with HP)
- For `targeting: 'all'`: skip target selection, auto-target all enemies/allies
- For `targeting: 'self'`: skip target selection, auto-target caster
- Use scrolling Menu with `maxVisible` for spell lists
- Cancel at any sub-menu returns to previous menu level

**8. Add spell charge restoration API (1 hr)**
[Resolves momus MINOR #6]
- Add `restoreAllCharges()` to `Character`: sets all 8 levels to max charges for current level
- Add `restoreCharges(level: number, amount: number)` for partial restoration (Ether item)
- Max charges per level determined by character level (use charge progression table from design doc §5, or placeholder values with `[DEFERRED: PLAYTESTING]` marker)

**9. Expand spells.yaml with remaining Level 1-2 spells (2-3 hrs)**
- Add missing Level 1 spells: RUSE (white), LOCK (black)
- Add all Level 2 spells: LAMP, MUTE, ALIT, INVS (white), DARK, TMPR, SLOW (black)
- Each entry needs: id, name, level, type, effect, targeting, description, element (if applicable), statusEffect (if applicable)
- Remaining spells (Lv3-8) deferred to Phase 17c
- Update schema validation to check new optional fields

### Acceptance Criteria

- `getElementalMultiplier('fire', { weaknesses: ['fire'], ... })` returns 2.0
- `StatusTracker.apply({ type: 'sleep', duration: 3 })` followed by 3 `tick()` calls removes the status
- `StatusTracker.preventsAction()` returns true when character has sleep/stone/paralysis/death
- Casting FIRE on an enemy with fire weakness deals 2x magic damage
- Casting SLEP on an enemy without sleep immunity applies sleep status
- A sleeping enemy skips their turn in battle
- Spell level menu shows correct charge counts per level
- Selecting a heal spell shows party member targets, not enemy targets
- `Character.learnSpell()` rejects spells beyond class access level
- `Character.learnSpell()` rejects when 3 spells already learned at that level
- `BattleCommand` with `spellId` correctly routes to spell execution
- Spell charges decrement after casting
- `restoreAllCharges()` resets all levels to max

### Test Strategy

- **Unit tests:** `Elements.ts` — multiplier calculations for all profile combinations (8-10 tests)
- **Unit tests:** `StatusEffects.ts` — apply, remove, tick, preventsAction, immunities (10-12 tests)
- **Unit tests:** `calculateMagicDamage()` — base damage, elemental multipliers, edge cases (5-6 tests)
- **Unit tests:** `Character` spell learning — learn, reject, class access, slot limits (6-8 tests)
- **Integration tests:** BattleStateMachine with magic commands — damage spells, heal spells, status spells, charge deduction (8-10 tests)
- **Manual verification:** Play a battle, cast FIRE, verify damage message and charge deduction

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Elemental/status systems too complex for one phase | Implement minimal viable versions: 4 elements (fire/ice/lightning/earth), 4 statuses (poison/sleep/stone/death). Expand in Phase 17c |
| Spell UI adds too many menu layers | Keep menus simple — reuse existing Menu component with different configs. No new UI components needed |
| Magic damage formula unbalanced | Mark all spell power values as `[DEFERRED: PLAYTESTING]`. Use conservative defaults |

### Effort Estimate

**Total: 45-65 hours**

### Files Created/Modified

**Created:**
- `src/battle/Elements.ts` — ElementType, ElementalProfile, getElementalMultiplier
- `src/battle/StatusEffects.ts` — StatusType, StatusEffect, StatusTracker
- `tests/battle/Elements.test.ts`
- `tests/battle/StatusEffects.test.ts`
- `tests/battle/MagicDamage.test.ts`

**Modified:**
- `src/types/index.ts` — add element to SpellData, elementalProfile to EnemyData, statusImmunities to EnemyData, statusEffect to SpellData
- `src/battle/DamageFormula.ts` — add calculateMagicDamage()
- `src/battle/BattleCommands.ts` — add spellId, itemId to BattleCommand
- `src/battle/BattleStateMachine.ts` — spell execution logic, status tick per turn, spells in BattleConfig
- `src/entities/Character.ts` — learnedSpells, learnSpell(), restoreAllCharges(), restoreCharges()
- `src/scenes/BattleScene.ts` — spell level menu, spell list menu, party target menu
- `assets/data/spells.yaml` — add element field, expand to Lv1-2 complete
- `assets/data/enemies.yaml` — add elementalProfile, statusImmunities

---

## Phase 10: Items & Equipment

### Overview

Phase 10 builds the item usage layer on top of the existing Inventory class and Character equipment system. The major deliverables are: the field menu (the overworld menu with Items/Magic/Equip/Status/Order/Config), an item registry for resolving IDs to ItemData, consumable effect execution in battle and field, and the equipment management UI. The field menu is a cross-cutting system that multiple future phases depend on.

### Prerequisites

- Phase 9 complete (elemental system for elemental weapons, status system for status-curing items)
- Existing: `Inventory` class (ID-based, add/remove/getAll), `Character.equip()`/`unequip()`/`canEquip()`, `ItemData` interface, `items.yaml` with 15 items, scrolling Menu, scene stack push/pop

### Sub-Tasks

**1. Build field menu system (5-7 hrs)**
[Resolves momus cross-cutting CRITICAL X4]
- Create `src/scenes/FieldMenuScene.ts` — pushed via scene stack over ExplorationScene
- Menu items: Items, Magic, Equip, Status, Order, Config
- Triggered by pressing Start/Menu key in ExplorationScene (add `isJustPressed('menu')` check)
- Each sub-option pushes another scene or opens a sub-menu
- "Status" → push existing StatusScene
- "Items" → push ItemMenuScene (sub-task 4)
- "Magic" → push FieldMagicScene (show learned spells per character, no casting in field for now — field heal deferred to Phase 12 shops/inn or implemented here if time permits)
- "Equip" → push EquipScene (sub-task 5)
- "Order" → inline party reorder (swap two members)
- "Config" → stub with placeholder text
- Cancel returns to exploration via `scenes.pop()`

**2. Create ItemRegistry for ID→ItemData lookup (2-3 hrs)**
[Resolves momus MAJOR #11]
- Create `src/data/ItemRegistry.ts`
- `class ItemRegistry { private items: Map<string, ItemData>; load(items: ItemData[]): void; get(id: string): ItemData | undefined; getAll(): ItemData[] }`
- Populated at game startup from `items.yaml` via DataLoader
- Add `readonly itemRegistry: ItemRegistry` to `Game.ts`
- This bridges the gap between Inventory (stores IDs) and UI/effects (need ItemData)

**3. Implement consumable effect execution (3-4 hrs)**
[Resolves momus CRITICAL #8]
- Create `src/systems/ItemEffects.ts`
- Define `executeConsumableEffect(item: ItemData, target: Character): string` — returns message
- Route by item properties: `stats.hp > 0` → heal target by that amount; `id === 'antidote'` → remove poison status; `id === 'phoenix_down'` → revive with 1 HP; `id === 'soft'` → remove stone status
- For battle: replace `cmd.type === 'item'` stub in `BattleStateMachine.executeCommand()` — look up item by `cmd.itemId`, call `executeConsumableEffect()`, decrement from inventory
- Add `inventory: Inventory` and `itemRegistry: ItemRegistry` to `BattleConfig`
- Build item selection menu in BattleScene: show consumable items from inventory with quantities, select item → select target → submit command

**4. Build field item usage scene (2-3 hrs)**
[Resolves momus MAJOR #9]
- Create `src/scenes/ItemMenuScene.ts` — pushed from FieldMenuScene
- Show all inventory items with quantities using scrolling Menu
- Select consumable → select party member target → apply effect → show message → return
- Non-consumable items (weapons, armor, key) show "Cannot use" or are disabled
- Tent/Cabin/House: check if on overworld (need a flag on current map), restore HP/charges, consume item

**5. Build equipment management UI (2-3 hrs)**
[Resolves momus MINOR #12]
- Create `src/scenes/EquipScene.ts` — pushed from FieldMenuScene
- Flow: select party member → select equipment slot (weapon/armor/shield/helmet) → show available items filtered by `canEquip()` → equip, return old item to inventory
- Show stat changes preview: "+3 ATK" / "-2 DEF" when hovering over an item
- Unequip option returns item to inventory

**6. Define key item behavior (1 hr)**
[Resolves momus MINOR #13]
- Key items (`type: 'key'`): cannot be used as consumable, cannot be sold (enforced in Phase 12 shops), cannot be dropped
- `Inventory.remove()` for key items: add optional `force` parameter, default behavior prevents removal of key items
- Key item possession checked via `inventory.has(itemId)` for progression gates

**7. Add Inventory.toJSON/fromJSON (1-2 hrs)**
[Resolves momus CRITICAL #21 — partial, completed in Phase 11]
- Add `toJSON(): Array<{ itemId: string; quantity: number }>` to Inventory
- Add `static fromJSON(data: Array<{ itemId: string; quantity: number }>): Inventory`
- This prepares Inventory for save/load in Phase 11

### Acceptance Criteria

- Pressing Menu key on overworld opens field menu with 6 options
- Selecting "Items" shows inventory with quantities; using Potion on a character heals 30 HP
- Selecting "Equip" allows changing equipment; old equipment returns to inventory
- In battle, selecting "Item" shows consumable items; using Potion heals target
- `ItemRegistry.get('potion')` returns the Potion ItemData object
- Key items cannot be used as consumables
- Tent/Cabin/House only usable on overworld maps
- `Inventory.toJSON()` produces serializable output; `fromJSON()` reconstructs correctly

### Test Strategy

- **Unit tests:** ItemRegistry — load, get, getAll (3-4 tests)
- **Unit tests:** ItemEffects — heal, cure status, revive, invalid item (5-6 tests)
- **Unit tests:** Inventory toJSON/fromJSON round-trip (2-3 tests)
- **Integration tests:** BattleStateMachine with item commands — use potion, use antidote (3-4 tests)
- **Manual verification:** Open field menu, use potion, equip weapon, verify stat changes

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Field menu adds many new scenes | Keep scenes minimal — each is a thin wrapper around Menu + effect logic |
| Item effect routing becomes a switch statement mess | Use a simple effect map: `{ 'potion': healEffect, 'antidote': curePoison, ... }` |

### Effort Estimate

**Total: 20-30 hours**

### Files Created/Modified

**Created:**
- `src/scenes/FieldMenuScene.ts`
- `src/scenes/ItemMenuScene.ts`
- `src/scenes/EquipScene.ts`
- `src/data/ItemRegistry.ts`
- `src/systems/ItemEffects.ts`
- `tests/data/ItemRegistry.test.ts`
- `tests/systems/ItemEffects.test.ts`

**Modified:**
- `src/entities/Inventory.ts` — add toJSON(), fromJSON(), key item protection
- `src/battle/BattleStateMachine.ts` — item execution logic, inventory+itemRegistry in BattleConfig
- `src/battle/BattleCommands.ts` — itemId already added in Phase 9
- `src/scenes/BattleScene.ts` — item selection menu
- `src/scenes/ExplorationScene.ts` — add menu key handler to push FieldMenuScene
- `src/core/Game.ts` — add itemRegistry field

---

## Phase 11: Save/Load System

### Overview

Save/Load is moved earlier (was Phase 12) per momus recommendation — it enables playtesting of Phases 9-10 with persistent state. This phase delivers: the story flag/progression system (a cross-cutting dependency for Phases 14-16), complete serialization/deserialization for all game state, the save slot UI, and localStorage persistence. Save is overworld/town only per design doc §8 ("No save points inside dungeons").

### Prerequisites

- Phase 10 complete (Inventory.toJSON/fromJSON, ItemRegistry for resolving saved item IDs)
- Existing: `Character.toJSON()`, `PartyManager.toJSON()`, scene stack, DataLoader
- No `fromJSON()` exists on any class — this phase creates all deserialization

### Sub-Tasks

**1. Implement GameFlags story/progression system (3-4 hrs)**
[Resolves momus cross-cutting CRITICAL X3]
- Create `src/systems/GameFlags.ts`
- `class GameFlags { private flags: Map<string, boolean>; set(flag: string): void; has(flag: string): boolean; clear(flag: string): void; getAll(): string[]; toJSON(): string[]; static fromJSON(data: string[]): GameFlags }`
- Add `readonly flags: GameFlags` to `Game.ts`
- Define initial flag names as constants: `RESCUED_PRINCESS`, `GOT_SHIP`, `GOT_CANOE`, `GOT_AIRSHIP`, `EARTH_CRYSTAL_LIT`, `FIRE_CRYSTAL_LIT`, `WATER_CRYSTAL_LIT`, `WIND_CRYSTAL_LIT`, `CLASS_UPGRADED`
- Flags are checked by: vehicle acquisition (Phase 15), boss triggers (Phase 14), class upgrades (Phase 16), NPC dialog branching (Phase 17d)

**2. Define SaveData interface (2-3 hrs)**
[Resolves momus CRITICAL #22]
- Create `src/systems/SaveManager.ts`
- Define complete `SaveData` interface:
```typescript
interface SaveData {
  version: number;
  timestamp: number;
  playTime: number;
  party: { name: string; classId: string; level: number; xp: number; currentHp: number; equipment: Record<string, string | null>; spellCharges: number[]; learnedSpells: Array<{ level: number; spellIds: string[] }>; statuses: Array<{ type: string; duration: number }> }[];
  gold: number;
  inventory: Array<{ itemId: string; quantity: number }>;
  flags: string[];
  currentMapId: string;
  playerPosition: { x: number; y: number };
  encounterSteps: number;
}
```
- Explicitly NOT saved: scene stack, UI state, battle state (can't save mid-battle in FF1), audio state

**3. Implement Character.fromJSON (2-3 hrs)**
[Resolves momus CRITICAL #20]
- Add `static fromJSON(data: SaveData['party'][0], classRegistry: Map<string, CharacterClassData>, spellRegistry: Map<string, SpellData>): Character`
- Resolve `classId` → `CharacterClassData` from registry
- Reconstruct equipment by resolving item IDs via ItemRegistry
- Restore learnedSpells by resolving spell IDs via spell registry
- Restore statusTracker from saved statuses

**4. Implement PartyManager.fromJSON and Inventory.fromJSON (2 hrs)**
[Resolves momus CRITICAL #20, #21]
- `PartyManager.fromJSON(data, classRegistry, spellRegistry)` — reconstruct members + gold
- `Inventory.fromJSON()` already added in Phase 10 — verify it works with SaveManager

**5. Implement SaveManager save/load logic (3-4 hrs)**
- `SaveManager.save(slot: number, game: Game): void` — serialize all state to `SaveData`, write to `localStorage` key `ff1_save_${slot}`
- `SaveManager.load(slot: number, game: Game): boolean` — read from localStorage, deserialize, reconstruct all game state, return false if slot empty
- `SaveManager.getSlotInfo(slot: number): SaveSlotInfo | null` — return summary for UI (party level, play time, location name, timestamp)
- `SaveManager.deleteSlot(slot: number): void`
- 3 save slots (FF1-standard)
- Wrap localStorage writes in try/catch for quota exceeded errors with user-facing message
[Resolves momus MINOR #25]

**6. Build save/load UI (3-4 hrs)**
[Resolves momus MAJOR #24]
- Create `src/scenes/SaveScene.ts` — pushed from field menu "Config" or dedicated "Save" option
- Show 3 save slots with info: "Slot 1: Lv12 Warrior — Cornelia — 2:34:15" or "Empty"
- Select slot → confirm overwrite → save → show "Saved!" message
- Create `src/scenes/LoadScene.ts` — accessible from title screen
- Show 3 slots, select to load, confirm → reconstruct game state → switch to ExplorationScene
- Add "Save" option to field menu (FieldMenuScene from Phase 10)

**7. Add save restriction: overworld/town only (1 hr)**
[Resolves momus design doc alignment — §8]
- Add `allowSave?: boolean` to `MapData` interface (default true for towns/overworld, false for dungeons)
- SaveScene checks current map's `allowSave` flag; shows "Cannot save here" if false

**8. Track play time (1 hr)**
- Add `playTime: number` to `Game` (seconds elapsed, incremented in game loop)
- Persisted in SaveData, restored on load

### Acceptance Criteria

- `GameFlags.set('RESCUED_PRINCESS')` → `GameFlags.has('RESCUED_PRINCESS')` returns true
- `GameFlags.toJSON()` → `GameFlags.fromJSON()` round-trips correctly
- Saving in slot 1 persists all party state, inventory, gold, flags, map position
- Loading from slot 1 reconstructs exact game state: correct HP, equipment, spells, inventory, position
- Save UI shows 3 slots with summary info
- Saving in a dungeon shows "Cannot save here"
- localStorage quota exceeded shows error message, doesn't crash
- `Character.fromJSON()` correctly resolves classId to class data and reconstructs equipment

### Test Strategy

- **Unit tests:** GameFlags — set, has, clear, toJSON, fromJSON (5-6 tests)
- **Unit tests:** SaveManager — save/load round-trip with mock localStorage (4-5 tests)
- **Unit tests:** Character.fromJSON — reconstruct with equipment, spells, statuses (4-5 tests)
- **Unit tests:** PartyManager.fromJSON — reconstruct party + gold (2-3 tests)
- **Integration tests:** Full save/load cycle — create game state, save, clear, load, verify all state matches (2-3 tests)
- **Manual verification:** Play game, save, refresh browser, load, verify position and state

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| SaveData schema changes break old saves | Include `version` field; add migration logic when version mismatches |
| Class/item/spell registries not available at load time | Load all JSON data files before attempting deserialization |
| localStorage not available (private browsing) | Detect with try/catch on first access; show warning |

### Effort Estimate

**Total: 20-30 hours**

### Files Created/Modified

**Created:**
- `src/systems/GameFlags.ts`
- `src/systems/SaveManager.ts`
- `src/scenes/SaveScene.ts`
- `src/scenes/LoadScene.ts`
- `tests/systems/GameFlags.test.ts`
- `tests/systems/SaveManager.test.ts`

**Modified:**
- `src/core/Game.ts` — add flags, playTime, SaveManager
- `src/entities/Character.ts` — add static fromJSON()
- `src/entities/PartyManager.ts` — add static fromJSON()
- `src/types/index.ts` — add allowSave to MapData
- `src/scenes/FieldMenuScene.ts` — add Save option

---

## Phase 12: Shops & Economy

### Overview

Phase 12 implements the full shop system: 4 distinct shop types (weapon, armor, item, magic), the Inn rest mechanic, and the QuantitySelector UI. Magic shops are fundamentally different from item shops — they sell spells that get assigned to character spell slots, not inventory items. The shop data model is entirely new and must be defined from scratch.

### Prerequisites

- Phase 9 (spell learning model on Character), Phase 10 (Inventory, ItemRegistry, field menu), Phase 11 (save/load for testing persistence)
- Existing: scrolling Menu, scene stack, QuantitySelector interface stub, `ItemData.price`, `PartyManager.gold/addGold()`

### Sub-Tasks

**1. Define shop data format (2-3 hrs)**
[Resolves momus CRITICAL #14]
- Create `src/types/index.ts` additions:
```typescript
interface ShopData {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'item' | 'white_magic' | 'black_magic';
  inventory: string[]; // item IDs or spell IDs
}
```
- Create `assets/data/shops.yaml` with starter shops for Cornelia: weapon shop, armor shop, item shop, white magic shop, black magic shop
- Add schema validation for ShopData
- Shops are associated with maps via NPC interaction: NPC `dialog` field extended to support `"type": "shop"` with `"shopId"` reference, or shops are triggered by a special NPC property

**2. Build base ShopScene (4-5 hrs)**
- Create `src/scenes/ShopScene.ts` — pushed via scene stack when interacting with shop NPC
- Two-column display: item name + price (format labels as fixed-width: `"Iron Sword    175G"`)
[Resolves momus MINOR #19]
- Show player gold at top
- Buy flow: select item → quantity selector → confirm → deduct gold, add to inventory
- Sell flow: show inventory items → select → quantity selector → confirm → add gold, remove from inventory
- Sell price = `Math.floor(item.price / 2)` [Resolves momus MAJOR #17]
- Key items (`type: 'key'`) excluded from sell list [Resolves momus MINOR #13 enforcement]
- Cancel returns to NPC dialog or exploration

**3. Implement QuantitySelector (2-3 hrs)**
[Resolves momus MAJOR #16]
- Implement `src/ui/QuantitySelector.ts` (replace interface stub with real class)
- Renders: `◄ 3 ►` with up/down to change quantity
- Max quantity limited by: gold available / item price (buy), or inventory quantity (sell)
- Confirm/cancel callbacks
- Integrates as a sub-component within ShopScene

**4. Build magic shop flow (3-4 hrs)**
[Resolves momus CRITICAL #15]
- Create `src/scenes/MagicShopScene.ts` or extend ShopScene with magic mode
- Flow: show available spells for sale → select spell → select character (filtered by class access) → select spell slot (max 3 per level) → confirm purchase → deduct gold, call `character.learnSpell()`
- Show which characters can learn each spell (based on `classData.spellLevels`)
- Show "FULL" if character already has 3 spells at that level
- Spells cannot be sold back (permanent purchase, per FF1)

**5. Implement Inn mechanic (2-3 hrs)**
[Resolves momus MAJOR #18]
- Inn is a special shop type or NPC interaction
- Flow: NPC dialog "Welcome to the Inn. Stay for 30G?" → confirm → deduct gold → restore all party HP to max → restore all spell charges via `character.restoreAllCharges()` → show "Your party is rested!" message → return to exploration
- Inn cost defined per-town in shop data or NPC data: `{ type: 'inn', cost: number }`
- Add `InnData` to shop data format or handle as special NPC type

**6. Wire shops to NPC interactions (2-3 hrs)**
- Extend `MapNPC` interface: add optional `shopId?: string` and `innCost?: number`
- When player interacts with shop NPC, DialogManager triggers shop scene push instead of normal dialog
- ShopScene loads shop data from `shops.yaml` by ID, resolves item/spell IDs via registries

**7. Create SpellRegistry (1-2 hrs)**
- Create `src/data/SpellRegistry.ts` — same pattern as ItemRegistry
- `class SpellRegistry { load(spells: SpellData[]): void; get(id: string): SpellData | undefined; getByLevel(level: number): SpellData[]; getByType(type: SpellType): SpellData[] }`
- Add to `Game.ts`; populated at startup from `spells.yaml`
- Used by magic shops and save/load spell deserialization

### Acceptance Criteria

- Weapon shop shows items with prices; buying Iron Sword deducts 175G and adds to inventory
- Selling Iron Sword returns 87G (floor of 175/2)
- Cannot buy if insufficient gold; cannot sell key items
- QuantitySelector allows buying multiple potions at once
- Magic shop shows spells; selecting FIRE shows eligible characters; learning adds to spell slots
- Magic shop shows "FULL" for characters with 3 spells at that level
- Inn deducts gold, restores all HP and spell charges
- Shop data loads from `shops.yaml` with schema validation

### Test Strategy

- **Unit tests:** ShopScene buy/sell logic — gold deduction, inventory changes, sell price (6-8 tests)
- **Unit tests:** QuantitySelector — increment, decrement, max limits, confirm/cancel (4-5 tests)
- **Unit tests:** MagicShopScene — spell learning, class filtering, slot limits (5-6 tests)
- **Unit tests:** SpellRegistry — load, get, getByLevel, getByType (3-4 tests)
- **Integration tests:** Full buy flow — enter shop, buy item, verify gold and inventory (2-3 tests)
- **Manual verification:** Visit each shop type, buy/sell items, learn spells, rest at inn

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Magic shop UI is complex (spell → character → slot) | Break into 3 sequential menu pushes; each is a simple list |
| Shop NPC wiring adds complexity to MapNPC | Keep it minimal: just `shopId` field, resolved at interaction time |

### Effort Estimate

**Total: 25-35 hours**

### Files Created/Modified

**Created:**
- `src/scenes/ShopScene.ts`
- `src/scenes/MagicShopScene.ts`
- `src/data/SpellRegistry.ts`
- `assets/data/shops.yaml`
- `tests/scenes/ShopScene.test.ts`
- `tests/ui/QuantitySelector.test.ts`
- `tests/data/SpellRegistry.test.ts`

**Modified:**
- `src/ui/QuantitySelector.ts` — replace interface with implementation
- `src/types/index.ts` — add ShopData, extend MapNPC with shopId/innCost
- `src/core/Game.ts` — add spellRegistry
- `src/systems/DialogManager.ts` — trigger shop scene on shop NPC interaction
- `src/core/schemaValidation.ts` — add validateShopData

---

## Phase 13: Audio System

### Overview

Phase 13 is a self-contained system with clear boundaries. It delivers an AudioManager using the Web Audio API for music playback and SFX, with scene-based music triggers and EventBus integration. The key architectural decision: use pre-recorded audio files (OGG/MP3), not programmatic synthesis — this is simpler and allows using freely available chiptune tracks. The system integrates with scene lifecycle (pause/resume on push/pop).

This phase can run in parallel with Phases 10-12 since it has no dependencies on game logic systems.

### Prerequisites

- Phase 9 complete (only for battle SFX triggers; AudioManager itself is independent)
- Existing: EventBus with typed events, scene lifecycle (enter/exit/onPause/onResume)

### Sub-Tasks

**1. Create audio asset directory structure (0.5 hr)**
[Resolves momus MINOR #31]
- Create `public/assets/audio/music/` and `public/assets/audio/sfx/`
- Add placeholder `.ogg` files (silent or simple tones) for development
- Define naming convention: `music_overworld.ogg`, `sfx_cursor.ogg`, etc.

**2. Implement AudioManager core (4-5 hrs)**
[Resolves momus MAJOR #28]
- Create `src/core/AudioManager.ts`
- API:
  - `playMusic(trackId: string, loop?: boolean): void` — load and play music track
  - `stopMusic(fadeMs?: number): void` — stop with optional fade-out
  - `pauseMusic(): void` / `resumeMusic(): void` — for scene push/pop
  - `playSFX(sfxId: string): void` — fire-and-forget sound effect
  - `setMusicVolume(v: number): void` / `setSFXVolume(v: number): void` — 0.0 to 1.0
  - `isMusicPlaying(): boolean`
- Internal: single `AudioContext`, `GainNode` for music volume, `GainNode` for SFX volume
- Music uses a single `AudioBufferSourceNode` (only one track at a time)
- SFX uses pooled `AudioBufferSourceNode` instances (multiple simultaneous)
- Cache loaded `AudioBuffer` objects to avoid re-fetching

**3. Handle AudioContext lifecycle (1 hr)**
[Resolves momus MINOR #30]
- Browsers require user interaction before AudioContext can play
- On first user input (keydown or click), call `audioContext.resume()`
- Add one-time event listener in `AudioManager.init()` or `Game.init()`
- Show no audio indicator until context is resumed

**4. Define audio asset pipeline (2-3 hrs)**
[Resolves momus MAJOR #27]
- Decision: pre-recorded OGG files (with MP3 fallback for Safari)
- Create `assets/data/audio-manifest.json`:
```json
{
  "music": {
    "title": "music_title.ogg",
    "overworld": "music_overworld.ogg",
    "town": "music_town.ogg",
    "dungeon": "music_dungeon.ogg",
    "battle": "music_battle.ogg",
    "boss": "music_boss.ogg",
    "victory": "music_victory.ogg",
    "gameover": "music_gameover.ogg",
    "ending": "music_ending.ogg"
  },
  "sfx": {
    "cursor": "sfx_cursor.ogg",
    "confirm": "sfx_confirm.ogg",
    "cancel": "sfx_cancel.ogg",
    "hit": "sfx_hit.ogg",
    "magic": "sfx_magic.ogg",
    "damage": "sfx_damage.ogg",
    "heal": "sfx_heal.ogg",
    "levelup": "sfx_levelup.ogg",
    "item": "sfx_item.ogg",
    "door": "sfx_door.ogg"
  }
}
```
- AudioManager loads manifest at init, resolves track IDs to file paths

**5. Define scene-to-music mapping and triggers (3-4 hrs)**
[Resolves momus MAJOR #29]
- Scene-to-track mapping:
  - ExplorationScene: reads `music?: string` from MapData (per-map music). Default: `'overworld'` for overworld maps, `'town'` for town maps, `'dungeon'` for dungeon maps
  - BattleScene: plays `'battle'` on enter, `'boss'` if boss battle (add `isBoss` to BattleConfig)
  - BattleScene victory: plays `'victory'` fanfare (non-looping)
  - GameOverScene: plays `'gameover'`
  - Title/Boot: plays `'title'`
- Add `music?: string` to `MapData` interface
- Integration approach: scenes call `game.audio.playMusic(trackId)` in `enter()`, `game.audio.stopMusic()` in `exit()`
- Scene stack integration: `onPause()` → `audio.pauseMusic()`, `onResume()` → `audio.resumeMusic()`

**6. Add SFX triggers via EventBus (2-3 hrs)**
- Define audio events in EventBus: `menuCursor`, `menuConfirm`, `menuCancel`, `battleHit`, `battleMagic`, `battleHeal`, `levelUp`
- AudioManager subscribes to EventBus events and plays corresponding SFX
- Menu.ts emits `menuCursor` on cursor move, `menuConfirm` on select, `menuCancel` on cancel
- BattleStateMachine emits `battleHit`, `battleMagic` during execution

**7. Add AudioManager to Game (1 hr)**
- Add `readonly audio: AudioManager` to `Game.ts`
- Initialize in `Game.init()`: `await this.audio.init()`
- Pass to scenes that need it (or access via game reference)

### Acceptance Criteria

- `AudioManager.playMusic('overworld')` plays the overworld track in a loop
- `AudioManager.stopMusic(500)` fades out over 500ms
- `AudioManager.playSFX('confirm')` plays confirm sound immediately
- Entering ExplorationScene starts map-appropriate music
- Entering BattleScene switches to battle music
- Pushing FieldMenuScene pauses music; popping resumes it
- Volume controls work (0.0 = silent, 1.0 = full)
- First user input resumes AudioContext without errors
- Missing audio files log a warning but don't crash

### Test Strategy

- **Unit tests:** AudioManager — mock AudioContext, verify playMusic/stopMusic/playSFX calls (5-6 tests)
- **Unit tests:** Volume control — verify GainNode value changes (2-3 tests)
- **Integration tests:** Scene lifecycle — verify music pause/resume on push/pop (2-3 tests)
- **Manual verification:** Play game, verify music changes between scenes, SFX on menu navigation

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| No audio assets available yet | Use placeholder silent files; real audio in Phase 17d or 18 |
| Web Audio API differences across browsers | Test on Chrome + Firefox; OGG has broad support, add MP3 fallback for Safari |
| AudioContext mock complexity in tests | Create thin AudioContext mock; test logic, not browser API |

### Effort Estimate

**Total: 15-25 hours**

### Files Created/Modified

**Created:**
- `src/core/AudioManager.ts`
- `public/assets/audio/music/` (directory + placeholders)
- `public/assets/audio/sfx/` (directory + placeholders)
- `assets/data/audio-manifest.json`
- `tests/core/AudioManager.test.ts`

**Modified:**
- `src/core/Game.ts` — add audio field
- `src/types/index.ts` — add music field to MapData
- `src/scenes/ExplorationScene.ts` — play map music on enter
- `src/scenes/BattleScene.ts` — play battle/boss music on enter, victory fanfare
- `src/scenes/GameOverScene.ts` — play gameover music
- `src/ui/Menu.ts` — emit SFX events on cursor/confirm/cancel
- `src/core/EventBus.ts` — add audio event types

---

## Phase 14: Boss Battles & Scripted Events

### Overview

Phase 14 delivers the boss battle system: redesigned AI (fixing the AIBehavior interface incompatibility), multi-phase boss mechanics, scripted encounter triggers, the "no running" restriction, and a lightweight cutscene system. This phase is moved before Vehicles (was Phase 15) because bosses are immediately testable with existing maps, while vehicles need a nonexistent overworld.

The AIBehavior interface stub currently takes `Character` but enemies are `EnemyInstance` — this is a known incompatibility (momus CRITICAL #38) that must be fixed first.

### Prerequisites

- Phase 9 (elemental system, status effects — bosses use elemental weaknesses as gimmicks)
- Phase 11 (story flags — boss defeats set progression flags)
- Existing: BattleStateMachine with injectable RNG, BattleTrigger system, BattleSceneDeps, EventBus

### Sub-Tasks

**1. Redesign AIBehavior interface (2-3 hrs)**
[Resolves momus CRITICAL #38]
- Rewrite `src/battle/AIBehavior.ts`:
```typescript
import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand } from './BattleCommands.js';

export interface AIBehavior {
  selectAction(
    self: EnemyInstance,
    party: Character[],
    allies: EnemyInstance[],
    turnNumber: number,
    rng: () => number
  ): BattleCommand;
}
```
- Remove old `AIAction` interface (replace with `BattleCommand` which already has the needed fields)
- Create `src/battle/BasicAI.ts` — implements `AIBehavior` with current random targeting logic (extracted from `EnemyAI.selectTarget`)
- Create `src/battle/BossAI.ts` — implements `AIBehavior` with priority-based action selection

**2. Implement BossAI with behavior patterns (5-7 hrs)**
- `BossAI` constructor takes a `BossPattern` config:
```typescript
interface BossPattern {
  actions: Array<{
    type: CommandType;
    spellId?: string;
    weight: number;
    condition?: (self: EnemyInstance, turnNumber: number) => boolean;
  }>;
}
```
- Action selection: filter actions by condition, weighted random from remaining
- Example patterns: "use FIRE every 3rd turn", "heal when HP < 30%", "use strong attack when only 1 enemy remains"
- Integrate with BattleStateMachine: add optional `aiBehavior?: AIBehavior` to `EnemyInstance`, use it instead of default random targeting when present

**3. Implement multi-phase boss system (4-6 hrs)**
[Resolves momus CRITICAL #39]
- Design: HP-threshold behavior changes (most FF1-faithful)
- Extend `EnemyData` with optional boss fields:
```typescript
interface BossPhase {
  hpThreshold: number; // percentage, e.g. 0.5 = below 50% HP
  pattern: string; // pattern ID referencing a BossPattern
  message?: string; // "Lich's form shifts!"
}
```
- Add `bossPhases?: BossPhase[]` to `EnemyData`
- In `BattleStateMachine.executeRound()`: before enemy action selection, check if any phase threshold crossed since last turn → switch AI pattern, emit phase change message
- Phase transitions are one-way (once crossed, don't revert if healed above threshold)

**4. Implement scripted encounter trigger system (3-4 hrs)**
[Resolves momus CRITICAL #40]
- Add to `MapData`:
```typescript
interface ScriptedEncounter {
  x: number;
  y: number;
  enemyIds: string[];
  flag: string; // story flag set after victory
  requiredFlag?: string; // optional prerequisite flag
  isBoss: boolean;
  message?: string; // pre-battle dialog
}
```
- Add `scriptedEncounters?: ScriptedEncounter[]` to `MapData`
- In ExplorationScene: on player movement, check if new position matches a scripted encounter → check `requiredFlag` (if any) via GameFlags → check `flag` not already set (one-time) → show message dialog → trigger battle via BattleTrigger
- On victory: set the encounter's `flag` in GameFlags

**5. Add "no running" restriction for boss battles (1-2 hrs)**
[Resolves momus MAJOR #42]
- Add `canRun: boolean` to `BattleConfig` (default `true`)
- In `BattleStateMachine.executeCommand()`: if `cmd.type === 'run'` and `!this.canRun`, push message "Cannot escape!" and skip
- In `BattleScene`: if `!canRun`, disable or hide "Run" in command menu (set `enabled: false` on Run MenuItem)
- BattleTrigger sets `canRun: false` for scripted encounters with `isBoss: true`

**6. Implement lightweight cutscene system (5-7 hrs)**
[Resolves momus MAJOR #41]
- Scope down to "scripted dialog sequences with screen effects" (not full camera/NPC movement)
- Create `src/systems/CutsceneManager.ts`
- Cutscene script format:
```typescript
interface CutsceneStep {
  type: 'dialog' | 'fade_out' | 'fade_in' | 'wait' | 'set_flag' | 'heal_party';
  text?: string; // for dialog
  duration?: number; // for fade/wait (ms)
  flag?: string; // for set_flag
}
type CutsceneScript = CutsceneStep[];
```
- `CutsceneManager.play(script: CutsceneScript): Promise<void>` — executes steps sequentially
- Dialog steps use existing DialogManager
- Fade steps use a full-screen Graphics overlay with alpha tween
- Used for: pre-boss dialog, post-boss victory sequences, story events
- Cutscene scripts defined in map data or separate JSON

**7. Wire boss victory to story progression (2-3 hrs)**
- On boss battle victory: BattleTrigger checks if encounter had a `flag` → sets flag via GameFlags
- Optionally trigger a post-victory cutscene script
- EventBus emits `bossDefeated` event with flag name for other systems to react

### Acceptance Criteria

- `AIBehavior.selectAction()` accepts `EnemyInstance` (not `Character`) — compiles without error
- `BasicAI` produces random fight commands targeting living party members
- `BossAI` with pattern "FIRE every 3rd turn" casts FIRE on turns 3, 6, 9...
- Boss at 50% HP switches to aggressive pattern (more frequent attacks)
- Phase change message appears when HP threshold crossed
- Stepping on scripted encounter tile triggers boss battle with pre-battle dialog
- Boss battle has "Run" disabled in command menu
- Attempting to run in boss battle shows "Cannot escape!"
- Defeating boss sets story flag; revisiting tile does not re-trigger battle
- Cutscene with dialog + fade plays correctly

### Test Strategy

- **Unit tests:** BasicAI — random targeting with deterministic RNG (3-4 tests)
- **Unit tests:** BossAI — pattern selection, condition filtering, weighted random (6-8 tests)
- **Unit tests:** Multi-phase — HP threshold detection, pattern switching, one-way transitions (4-5 tests)
- **Unit tests:** CutsceneManager — step execution order, dialog, fade (4-5 tests)
- **Integration tests:** Boss battle flow — scripted trigger → battle → no run → victory → flag set (2-3 tests)
- **Manual verification:** Walk onto boss tile, fight boss, verify phase change, verify flag persistence

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| BossAI patterns too rigid for varied boss designs | Keep pattern system data-driven; complex bosses can use custom AIBehavior implementations |
| Cutscene system scope creep | Strict scope: dialog + fade + wait + flag only. No camera movement, no NPC pathfinding |
| AIBehavior redesign breaks existing enemy AI | BasicAI wraps existing `selectTarget()` logic — no behavior change for normal enemies |

### Effort Estimate

**Total: 35-50 hours**

### Files Created/Modified

**Created:**
- `src/battle/BasicAI.ts`
- `src/battle/BossAI.ts`
- `src/systems/CutsceneManager.ts`
- `tests/battle/BasicAI.test.ts`
- `tests/battle/BossAI.test.ts`
- `tests/systems/CutsceneManager.test.ts`

**Modified:**
- `src/battle/AIBehavior.ts` — complete rewrite (EnemyInstance, not Character)
- `src/battle/BattleStateMachine.ts` — AI integration, multi-phase checks, canRun, status tick
- `src/battle/BattleCommands.ts` — canRun in BattleConfig
- `src/scenes/BattleScene.ts` — disable Run for boss battles, boss music trigger
- `src/scenes/ExplorationScene.ts` — scripted encounter checks on movement
- `src/systems/BattleTrigger.ts` — boss battle config, post-victory flag setting
- `src/types/index.ts` — ScriptedEncounter in MapData, BossPhase in EnemyData

---

## Phase 15: Vehicles & World Progression

### Overview

Phase 15 implements the terrain type system, three vehicles (canoe, ship, airship), and key item gates. This phase is moved after Bosses (was Phase 14) because vehicles require terrain variety that doesn't exist yet — the only map is a 10×10 test town. This phase implements the mechanics with test maps; the real overworld is built in Phase 17b.

The MovementMode interface stub exists but needs terrain-type awareness. The current CollisionMap is binary (walkable/not) and must be extended to support terrain types.

### Prerequisites

- Phase 11 (story flags for vehicle acquisition tracking)
- Phase 14 (boss defeats trigger vehicle acquisition — e.g., defeat Bikke → get Ship)
- Existing: MovementMode interface stub, PlayerController, CollisionMap, MapLoader

### Sub-Tasks

**1. Implement terrain type system (4-6 hrs)**
[Resolves momus CRITICAL #33]
- Define terrain type enum in `src/types/index.ts`:
```typescript
enum TerrainType {
  Grass = 0,
  Wall = 1,
  Water = 2,
  Mountain = 3,
  Forest = 4,
  Desert = 5,
  Swamp = 6,
  River = 7,
  Road = 8,
  Bridge = 9,
}
```
- Extend `CollisionMap`: change from binary `isWalkable(x, y): boolean` to `getTerrainType(x, y): TerrainType` + `isWalkable(x, y, mode: MovementMode): boolean`
- `MapData.collision` array already uses numbers — reinterpret: 0=grass (walkable), 1=wall, 2=water, etc.
- Update existing maps to use new terrain values (test-town: 0 for walkable, 1 for walls)

**2. Implement MovementMode concrete classes (4-5 hrs)**
[Resolves momus MAJOR #34]
- Rewrite `src/entities/MovementMode.ts` — keep interface, add implementations:
- `WalkingMode`: canTraverse grass, forest, desert, swamp, road, bridge. Speed varies by terrain (forest slower, road faster). Normal encounter rate.
- `CanoeMode`: canTraverse river, water (shallow). Faster than walking. Reduced encounter rate.
- `ShipMode`: canTraverse water (deep ocean). Cannot traverse land. No encounters on ship (or reduced).
- `AirshipMode`: canTraverse all terrain (flying). No encounters. Can only land on grass tiles.
- Each implements `MovementMode` interface with `canMove(terrainType)`, `getSpeed(terrainType)`, `getEncounterRate()`

**3. Integrate MovementMode with PlayerController (3-4 hrs)**
- Add `currentMode: MovementMode` to PlayerController (default: WalkingMode)
- Change `canMoveTo()`: call `currentMode.canMove(collisionMap.getTerrainType(x, y))` instead of `collisionMap.isWalkable(x, y)`
- Movement speed: use `currentMode.getSpeed(terrainType)` instead of fixed speed
- Encounter rate: pass `currentMode.getEncounterRate()` to EncounterSystem as multiplier

**4. Implement vehicle boarding/disembarking (3-4 hrs)**
- Vehicle entities placed on map as special objects (not NPCs)
- Add `vehicles?: Array<{ type: 'canoe' | 'ship' | 'airship'; x: number; y: number }>` to MapData
- Board: player stands adjacent to vehicle, presses confirm → switch to vehicle MovementMode, player sprite changes, vehicle sprite hidden
- Disembark: press confirm while in vehicle → check if current tile is valid for walking → switch back to WalkingMode, place vehicle at current position
- Airship special: press confirm to land → check if tile below is grass → land

**5. Implement airship flight mechanics (2-3 hrs)**
[Resolves momus MAJOR #36]
- Airship moves freely over all terrain (ignore collision)
- Different controls: faster movement speed, no tile snapping (or larger tile steps)
- Landing: press confirm → scan current tile → if grass, land (switch to WalkingMode, place airship)
- If not grass, show "Cannot land here"
- Airship visible on overworld as a sprite at its parked location when not in use

**6. Implement key item gate system (2-3 hrs)**
[Resolves momus MAJOR #35]
- Add to MapData:
```typescript
interface KeyItemGate {
  x: number;
  y: number;
  requiredItem: string; // item ID
  flag?: string; // optional story flag to set when opened
  message: string; // "The door opened with the Mystic Key!"
  permanent: boolean; // true = stays open (set flag), false = check each time
}
```
- Add `keyItemGates?: KeyItemGate[]` to MapData
- On player movement to gate tile: check `inventory.has(requiredItem)` → if yes, show message, set flag if permanent, allow passage → if no, show "It's locked" and block movement
- Permanent gates: check flag first (already opened), skip item check

**7. Create test overworld map for vehicle testing (2-3 hrs)**
[Resolves momus CRITICAL #32 — partial; real overworld in Phase 17b]
- Create `assets/maps/test-overworld.yaml` — small (32×32) map with terrain variety: grass, water, mountains, forest, river
- Include vehicle spawn points for canoe and ship
- Include a key item gate
- This is a development/testing map, not the final overworld

**8. Wire vehicle acquisition to story flags (1-2 hrs)**
[Resolves momus MINOR #37]
- Vehicle acquisition is triggered by story events (boss defeats, NPC interactions)
- Phase 14 boss victories set flags; this phase checks flags to spawn vehicles
- Canoe: available after `EARTH_CAVE_COMPLETE` flag
- Ship: available after `BIKKE_DEFEATED` flag
- Airship: available after `TIAMAT_DEFEATED` flag
- Actual flag-setting happens in Phase 17d (content); this phase implements the check mechanism

### Acceptance Criteria

- `CollisionMap.getTerrainType(x, y)` returns correct terrain type from map data
- Walking mode cannot enter water tiles; ship mode cannot enter land tiles
- Boarding ship near water switches to ShipMode; player moves over water
- Disembarking ship on water-adjacent land tile works correctly
- Airship can fly over all terrain; landing only works on grass
- Forest tiles have slower movement speed than road tiles
- Key item gate blocks passage without required item; allows passage with it
- Permanent gates stay open after first use (flag-based)
- Test overworld map loads with terrain variety and vehicle spawns

### Test Strategy

- **Unit tests:** TerrainType + CollisionMap.getTerrainType (3-4 tests)
- **Unit tests:** Each MovementMode — canTraverse for all terrain types (4×8 = ~32 tests, grouped)
- **Unit tests:** Key item gate — with/without item, permanent flag (4-5 tests)
- **Integration tests:** PlayerController with vehicle mode switching (3-4 tests)
- **Manual verification:** Walk around test overworld, board ship, sail, disembark, fly airship, land

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| No real overworld map yet | Test overworld map (32×32) is sufficient for mechanics testing; real overworld in Phase 17b |
| Airship free-movement breaks tile-based assumptions | Keep airship tile-snapped but with larger step size; simpler than true free movement |
| Terrain type changes break existing maps | Existing maps only use 0 (walkable) and 1 (wall) — these map directly to Grass and Wall |

### Effort Estimate

**Total: 25-40 hours**

### Files Created/Modified

**Created:**
- `src/entities/WalkingMode.ts`
- `src/entities/CanoeMode.ts`
- `src/entities/ShipMode.ts`
- `src/entities/AirshipMode.ts`
- `assets/maps/test-overworld.yaml`
- `tests/entities/MovementModes.test.ts`
- `tests/systems/KeyItemGate.test.ts`

**Modified:**
- `src/entities/MovementMode.ts` — update interface with terrain-aware canMove
- `src/rendering/CollisionMap.ts` — getTerrainType(), terrain-aware isWalkable()
- `src/entities/PlayerController.ts` — currentMode, mode-based movement
- `src/systems/EncounterSystem.ts` — encounter rate multiplier from MovementMode
- `src/types/index.ts` — TerrainType enum, vehicles in MapData, KeyItemGate in MapData
- `src/scenes/ExplorationScene.ts` — vehicle boarding/disembarking, key item gate checks

---

## Phase 16: Class Upgrades

### Overview

Phase 16 is the simplest remaining phase mechanically. It delivers: 6 upgraded class definitions in `classes.yaml`, a method to upgrade a character's class (fixing the `readonly classData` constraint), and the upgrade trigger mechanism tied to story flags. Per the design doc §3, all party members upgrade simultaneously at a story milestone (after lighting the Earth Crystal).

### Prerequisites

- Phase 11 (story flags — upgrade triggered by `EARTH_CRYSTAL_LIT` flag)
- Phase 12 (magic shops — upgraded classes gain new spell access levels, purchasable at shops)
- Existing: `Character` with `readonly classData`, `classes.yaml` with 6 base classes

### Sub-Tasks

**1. Add 6 upgraded class entries to classes.yaml (2-3 hrs)**
[Resolves momus MAJOR #45]
- Add: Knight, Ninja, Master, White Wizard, Black Wizard, Red Wizard
- Each with: higher base stats, expanded `usableEquipment`, expanded `spellLevels`
- Per design doc §3:
  - Knight: `spellLevels: { white: 3, black: 0 }`, heavy armor + swords
  - Ninja: `spellLevels: { white: 0, black: 4 }`, all weapons + light armor
  - Master: `spellLevels: { white: 0, black: 0 }`, higher base damage (strength growth)
  - White Wizard: `spellLevels: { white: 8, black: 0 }` (was 7)
  - Black Wizard: `spellLevels: { white: 0, black: 8 }` (was 7)
  - Red Wizard: `spellLevels: { white: 7, black: 7 }` (was 5/5)
- Define upgrade mapping constant:
```typescript
const CLASS_UPGRADES: Record<string, string> = {
  warrior: 'knight', thief: 'ninja', monk: 'master',
  white_mage: 'white_wizard', black_mage: 'black_wizard', red_mage: 'red_wizard'
};
```

**2. Fix Character.classData readonly constraint (2-3 hrs)**
[Resolves momus CRITICAL #44]
- Change `readonly classData` to private backing field with getter:
```typescript
private _classData: CharacterClassData;
get classData(): CharacterClassData { return this._classData; }
```
- Add `upgrade(newClassData: CharacterClassData): void` method:
  - Replace `_classData` with new class data
  - Recalculate maxHp from new class; if `currentHp > newMaxHp`, cap it; if `currentHp < newMaxHp`, heal to full (FF1 heals on upgrade) [Resolves momus MINOR #47]
  - Spell access expansion is automatic — new `spellLevels` enables purchasing higher-level spells at magic shops [Resolves momus MINOR #48]
  - No automatic spell learning — player must visit magic shops to buy newly accessible spells
- Update `toJSON()` to serialize current classId (which may be upgraded)

**3. Implement upgrade trigger mechanism (2-3 hrs)**
[Resolves momus MAJOR #46]
- Create `src/systems/ClassUpgradeSystem.ts`
- `canUpgrade(character: Character, flags: GameFlags): boolean` — checks `flags.has('EARTH_CRYSTAL_LIT')` and character's class has an upgrade available
- `performUpgrade(character: Character, classRegistry: Map<string, CharacterClassData>): boolean` — looks up upgrade class ID, calls `character.upgrade(newClassData)`
- Trigger: specific NPC interaction (e.g., Bahamut in the Dragon Cave)
- NPC checks flag → offers upgrade → player confirms → upgrade all party members → show upgrade messages ("Warrior became Knight!")
- Wire into NPC interaction system: special NPC type `"type": "class_upgrade"` in MapNPC

**4. Add upgrade UI feedback (1-2 hrs)**
- Show upgrade animation/message for each party member
- Display stat changes: "HP: 150 → 180", "Now can use White Magic Lv1-3"
- Use existing DialogManager for sequential messages

### Acceptance Criteria

- `classes.yaml` contains 12 entries (6 base + 6 upgraded)
- `Character.upgrade(knightData)` changes class from Warrior to Knight
- After upgrade: maxHp recalculated, currentHp healed to full
- Knight gains `spellLevels: { white: 3, black: 0 }` — can now buy white magic Lv1-3
- `canUpgrade()` returns false if `EARTH_CRYSTAL_LIT` flag not set
- `canUpgrade()` returns false for already-upgraded characters
- Interacting with upgrade NPC triggers upgrade for all party members
- `toJSON()` serializes upgraded class ID correctly
- `fromJSON()` correctly loads upgraded class data

### Test Strategy

- **Unit tests:** Character.upgrade — stat recalculation, HP handling, classData change (4-5 tests)
- **Unit tests:** ClassUpgradeSystem — canUpgrade with/without flag, already upgraded (3-4 tests)
- **Unit tests:** Upgrade mapping — all 6 base→upgraded pairs (1 parameterized test)
- **Integration tests:** Full upgrade flow — set flag, trigger upgrade, verify all party members upgraded (1-2 tests)
- **Manual verification:** Interact with upgrade NPC, verify class names change, verify new spell access

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Changing `readonly` to getter breaks existing code | Getter returns same type — no API change for consumers. Only internal mutation is new |
| Stat recalculation on upgrade causes HP issues | Heal to full on upgrade (FF1 behavior) — simplest and most player-friendly |

### Effort Estimate

**Total: 10-18 hours**

### Files Created/Modified

**Created:**
- `src/systems/ClassUpgradeSystem.ts`
- `tests/systems/ClassUpgradeSystem.test.ts`

**Modified:**
- `src/entities/Character.ts` — readonly→getter, add upgrade() method
- `assets/data/classes.yaml` — add 6 upgraded class entries
- `src/types/index.ts` — (no changes needed, CharacterClassData already sufficient)
- `src/scenes/ExplorationScene.ts` — handle class_upgrade NPC type

---

## Phase 17a: Content Tooling & Pipeline

### Overview

Before creating content at scale, the tooling must exist. This sub-phase delivers: Tiled map editor integration (export pipeline from Tiled → MapData JSON), cross-reference validation tooling (verify all IDs reference existing entities), and content templates for consistent data entry. Without this tooling, hand-editing 17+ maps in JSON is not viable.

### Prerequisites

- All systems phases (9-16) complete — all data formats finalized
- Existing: MapData format, schema validation in DataLoader

### Sub-Tasks

**1. Set up Tiled → MapData export pipeline (5-7 hrs)**
[Resolves momus CRITICAL #50]
- Install Tiled map editor (free, cross-platform)
- Create a Tiled tileset file (`.tsx`) matching the game's 16×16 tile grid
- Create export script: `scripts/tiled-export.ts` — reads Tiled `.tmj` (JSON) format, converts to `MapData` JSON
- Mapping: Tiled layers → `MapData.layers`, Tiled object layer → NPCs/transitions/encounters/scriptedEncounters/vehicles/keyItemGates
- Tiled custom properties map to MapData fields (e.g., NPC object with `dialog` property)
- Script validates output against schema before writing

**2. Build cross-reference validation tool (3-4 hrs)**
[Resolves momus MINOR #54]
- Create `scripts/validate-content.ts`
- Checks:
  - All enemy IDs in encounter tables exist in `enemies.yaml`
  - All item IDs in shop inventories exist in `items.yaml`
  - All spell IDs in magic shops exist in `spells.yaml`
  - All map transition targets exist as map files
  - All NPC shopIds reference existing shops in `shops.yaml`
  - All class IDs in upgrade mapping exist in `classes.yaml`
- Run as: `npx tsx scripts/validate-content.ts` — exits 0 if valid, 1 with error list
- Add to `npm run validate` script

**3. Create content templates and data entry guides (2-3 hrs)**
- Create `docs/CONTENT_GUIDE.md` — instructions for adding enemies, items, spells, maps, shops
- Create template YAML files: `assets/data/templates/enemy-template.yaml`, `item-template.yaml`, etc.
- Define naming conventions: enemy IDs lowercase_snake, spell IDs lowercase, map IDs kebab-case

**4. Create placeholder tileset for Tiled (2-3 hrs)**
- Create `assets/tilesets/base-tileset.png` — 16×16 tiles for all terrain types (grass, wall, water, mountain, forest, etc.)
- Use colored rectangles (like PlaceholderTextures) — real art in Phase 18
- Create matching Tiled tileset definition

### Acceptance Criteria

- Tiled export script converts a `.tmj` file to valid `MapData` JSON
- Cross-reference validator catches: shop referencing nonexistent item, encounter referencing nonexistent enemy
- Cross-reference validator passes on current valid data
- Content guide documents the process for adding each data type
- Placeholder tileset renders correctly in Tiled and in-game

### Test Strategy

- **Unit tests:** Tiled export script — convert sample Tiled JSON to MapData (3-4 tests)
- **Unit tests:** Cross-reference validator — valid data passes, invalid references caught (4-5 tests)
- **Manual verification:** Create a map in Tiled, export, load in game

### Effort Estimate

**Total: 15-20 hours**

### Files Created/Modified

**Created:**
- `scripts/tiled-export.ts`
- `scripts/validate-content.ts`
- `docs/CONTENT_GUIDE.md`
- `assets/data/templates/` (template files)
- `assets/tilesets/base-tileset.png`
- `assets/tilesets/base-tileset.tsx`

---

## Phase 17b: Content — Maps & Encounters

### Overview

The largest content sub-phase. Delivers: the overworld map, all town maps, all dungeon maps (with multiple floors), and encounter tables for each area. The design doc §2 lists ~17 unique locations. This phase uses the Tiled pipeline from Phase 17a.

### Prerequisites

- Phase 17a (Tiled pipeline, validation tooling, placeholder tileset)
- Phase 15 (terrain types, vehicles — overworld needs water/mountain terrain)

### Sub-Tasks

**1. Create overworld map (8-12 hrs)**
[Resolves momus CRITICAL #32 — full resolution]
- Design 4-continent layout per design doc §2
- Terrain variety: grass, forest, mountain, desert, water, swamp, road
- Town/dungeon entrance markers
- Vehicle spawn points (ship dock, canoe river access, airship landing)
- Size: ~128×128 tiles (or larger, per design needs)
- Encounter table: tier 1-2 enemies on starting continent, scaling by region

**2. Create town maps (6-10 hrs)**
- Per design doc §2: Cornelia, Elfheim, Melmond, Crescent Lake, Onrac (minimum 5 towns)
- Each town: Inn NPC, Item Shop NPC, Weapon/Armor Shop NPC, White/Black Magic Shop NPCs, hint NPCs
- Size: ~20×20 to 32×32 per town
- Map transitions: town entrance ↔ overworld, building entrances ↔ interiors
- No encounters in towns

**3. Create dungeon maps (12-20 hrs)**
- Per design doc §2: Temple of Fiends, Marsh Cave, Earth Cave, Gurgu Volcano, Sea Shrine, Sky Fortress, Temple of Fiends Revisited (minimum 7 dungeons)
- Each dungeon: 2-6 floors with stairs transitions
- Treasure chest locations (items, gold, equipment)
- Boss trigger locations (scripted encounters from Phase 14)
- Encounter tables per floor (increasing difficulty deeper)
- `allowSave: false` on all dungeon maps

**4. Define encounter tables for all areas (4-6 hrs)**
[Resolves momus MINOR #53]
- Overworld: region-based encounter tables (4-6 regions)
- Dungeons: per-floor encounter tables
- Enemy groups: 1-4 enemies per encounter, weighted by difficulty
- Mark all tables as "first pass" — tuning in Phase 18
- Validate all enemy IDs exist via cross-reference tool

**5. Create Matoya's Cave and other special locations (3-5 hrs)**
- Dwarf Cave, Waterfall Cave — smaller dungeons with key items
- Special NPC interactions (Matoya, Dwarf Smith, etc.)
- Key item gate placements

### Acceptance Criteria

- Overworld map loads and renders with terrain variety
- All towns accessible from overworld with correct transitions
- All dungeons have multi-floor navigation via stairs
- Encounter tables reference valid enemies
- Cross-reference validation passes for all maps
- Player can walk from Cornelia to at least 2 other towns
- Dungeons have treasure chests and boss triggers

### Test Strategy

- **Automated:** Cross-reference validation on all map files
- **Manual verification:** Walk through each town, enter each dungeon, verify transitions work
- **Playtest:** Complete early game loop (Cornelia → Temple of Fiends → return)

### Effort Estimate

**Total: 35-55 hours**

---

## Phase 17c: Content — Items, Spells & Shops

### Overview

Expands all item, spell, and shop data to full game scope. Currently: 15 items, 10 spells, 0 shops. Target: ~40 weapons, full armor sets, all 64 spells, shop inventories for every town.

### Prerequisites

- Phase 17b (towns exist to place shops in)
- Phase 9 (spell system), Phase 10 (item system), Phase 12 (shop system)

### Sub-Tasks

**1. Expand weapons to full list (3-5 hrs)**
- Add ~25 more weapons per design doc §6 progression
- Tier by price: starter (5-50G), early (100-500G), mid (1000-5000G), late (10000+G), endgame (found only)
- Include elemental weapons: Flame Sword (fire), Ice Brand (ice), Thor's Hammer (lightning)
- Each weapon: id, name, type, stats.attack, price, usableBy, element (if applicable)

**2. Expand armor to full list (3-5 hrs)**
- Add shields, helmets, gloves in addition to body armor
- ~20 armor pieces across 4 slots
- Include resistance armor: Dragon Armor (fire/ice/lightning resist)
- Add `elementalResistances?: ElementType[]` to armor ItemData

**3. Complete all 64 spells (4-6 hrs)**
- Add remaining Lv3-8 white and black spells per design doc §5 tables
- Each spell: id, name, level, type, effect, targeting, description, element, statusEffect, spellPower
- Add `spellPower: number` to SpellData for damage calculation
- Validate all spells load correctly

**4. Define shop inventories for all towns (3-4 hrs)**
- Create/expand `shops.yaml` with per-town shops
- Cornelia: starter gear + Lv1 spells
- Elfheim: mid-tier gear + Lv2-3 spells
- Progression matches design doc §7 economy pacing
- Validate all shop item/spell IDs exist

**5. Expand consumable items (2-3 hrs)**
- Add: Ether, Soft, Cabin, House (some may already exist)
- Add status-curing items: Eye Drops (cure blind), Echo Screen (cure mute)
- Define consumable effects in ItemEffects system

**6. Add enemy drops to enemy data (2-3 hrs)**
- Add `drops?: Array<{ itemId: string; chance: number }>` to EnemyData
- Define drop tables for all enemies (most have no drops; bosses drop key items or rare equipment)
- Implement drop resolution in BattleStateMachine victory handling

### Acceptance Criteria

- `items.yaml` contains 40+ weapons, 20+ armor, 10+ consumables
- `spells.yaml` contains all 64 spells (32 white + 32 black)
- `shops.yaml` contains shops for every town with appropriate tier progression
- Cross-reference validation passes for all shops
- Economy pacing matches design doc §7 (early game: basic gear affordable, endgame: expensive)

### Test Strategy

- **Automated:** Schema validation on all expanded data files
- **Automated:** Cross-reference validation (shop items exist, spell IDs valid)
- **Manual verification:** Visit each town's shops, verify inventory and prices make sense

### Effort Estimate

**Total: 20-30 hours**

---

## Phase 17d: Content — Dialog & Story

### Overview

The narrative content phase: NPC dialog for all towns, story event scripts, boss encounter triggers with pre/post dialog, vehicle acquisition events, and the overall story progression wiring. This is creative work requiring narrative consistency, not just data entry.

### Prerequisites

- Phase 17b (maps with NPCs placed), Phase 17c (items/spells for story references)
- Phase 14 (cutscene system, scripted encounters), Phase 11 (story flags)

### Sub-Tasks

**1. Write town NPC dialog (8-12 hrs)**
[Resolves momus MAJOR #52]
- Per-town dialog for hint NPCs, flavor NPCs, story NPCs
- Dialog should: advance story understanding, provide gameplay hints, establish tone
- NES style: short, direct, 2-4 lines per NPC
- Some NPCs have flag-conditional dialog (different text before/after story events)
- Create `assets/data/dialog/` directory with per-town dialog files or embed in map data

**2. Write story event cutscene scripts (5-8 hrs)**
- Key story beats per design doc §2:
  - Opening: arrive in Cornelia, learn of kidnapped princess
  - Rescue princess → gain bridge access → wider world
  - Each crystal restoration → cutscene + flag
  - Final boss approach → time loop revelation
- Use CutsceneScript format from Phase 14
- Create `assets/data/cutscenes/` directory

**3. Wire boss encounters with story context (3-5 hrs)**
- Each boss: pre-battle dialog, post-victory cutscene, flag setting
- Fiend bosses: crystal restoration sequence after victory
- Final boss: multi-phase with inter-phase dialog

**4. Wire vehicle acquisition events (2-3 hrs)**
[Resolves momus MINOR #37 — full resolution]
- Canoe: received after Earth Cave completion (NPC gives it, or found in dungeon)
- Ship: received after defeating Bikke (pirate captain in Pravoka)
- Airship: found after defeating Tiamat (or in specific location)
- Each sets appropriate story flag and spawns vehicle on overworld

**5. Implement flag-conditional NPC dialog (2-3 hrs)**
- Extend NPC dialog system: `dialog` field becomes `Array<{ text: string[]; condition?: string }>`
- DialogManager checks conditions against GameFlags, shows first matching dialog
- Example: NPC says "The princess is missing!" before rescue, "Thank you, heroes!" after

**6. Write key item exchange sequences (2-3 hrs)**
- Per design doc §6 key items: Crown → Crystal Eye → Herb → Mystic Key chain
- Each exchange: NPC checks inventory for required item → removes it → gives new item → sets flag
- Dialog for each exchange

### Acceptance Criteria

- Every town NPC has dialog (no empty dialog arrays)
- Story progression works: rescue princess → get bridge → access wider world
- Boss pre-battle dialog plays before boss fight
- Post-boss cutscenes play and set correct flags
- Vehicle acquisition events trigger correctly after prerequisites met
- Flag-conditional dialog shows correct text based on story progress
- Key item exchange chain works end-to-end

### Test Strategy

- **Automated:** Validate all dialog arrays are non-empty
- **Automated:** Validate all flag references in dialog conditions exist in GameFlags constants
- **Manual verification:** Play through story from start, verify dialog makes sense at each stage
- **Playtest:** Complete full story arc, verify all flags set correctly

### Effort Estimate

**Total: 25-40 hours**

### Files Created/Modified (Phase 17a-d combined)

**Created:**
- `scripts/tiled-export.ts`, `scripts/validate-content.ts`
- `docs/CONTENT_GUIDE.md`
- `assets/tilesets/` (tileset files)
- `assets/maps/overworld.yaml` + all town/dungeon maps
- `assets/data/dialog/` (dialog files)
- `assets/data/cutscenes/` (cutscene scripts)
- Expanded: `enemies.yaml`, `items.yaml`, `spells.yaml`, `shops.yaml`

**Modified:**
- `src/types/index.ts` — flag-conditional dialog, enemy drops
- `src/systems/DialogManager.ts` — flag-conditional dialog support
- `src/battle/BattleStateMachine.ts` — enemy drop resolution

---

## Phase 18: Polish & Balancing

### Overview

The final phase transforms the feature-complete game into a polished, balanced experience. It is decomposed into specific deliverables rather than a vague "polish" label. This phase resolves all `[DEFERRED: PLAYTESTING]` items from the design doc and addresses the bitmap font, performance optimization, and accessibility concerns.

### Prerequisites

- All phases 9-17d complete — feature-complete game with full content

### Sub-Tasks

**1. Resolve all DEFERRED: PLAYTESTING items (8-12 hrs)**
[Resolves momus MINOR #57]
- Exact stat growth tables per class (tune `statGrowth` in `classes.yaml`)
- Spell charge progression curve (tune charge-per-level table)
- XP table (tune `XP_THRESHOLDS` in Character.ts for smooth leveling)
- Encounter rate tuning (overworld ~20-30 steps, dungeons ~10-20, per-area variance)
- Economy pacing validation (gold income vs. shop prices at each game stage)

**2. Stat and damage balancing pass (5-8 hrs)**
- Play through early game (Lv 1-10): verify damage feels right, healing is meaningful
- Play through mid game (Lv 10-25): verify resource management matters
- Play through late game (Lv 25+): verify strategic depth
- Adjust: weapon attack values, armor defense values, spell power values, enemy stats
- Validate class viability: no class should be useless (Monk damage, Thief speed utility)

**3. Boss difficulty tuning (3-5 hrs)**
- Each Fiend boss: beatable at expected level range with appropriate preparation
- Final boss: challenging but fair with full party
- Verify boss gimmicks work (elemental weakness, status vulnerability)
- Adjust boss HP, attack, defense, pattern thresholds

**4. Encounter table balancing (2-3 hrs)**
[Resolves momus MINOR #53 — final pass]
- Verify dungeon difficulty progression (deeper floors = harder enemies)
- Verify overworld regional difficulty matches story progression
- Adjust encounter weights for variety

**5. Replace browser monospace with bitmap font (3-5 hrs)**
[Resolves momus MINOR #58]
- Create or source NES-authentic 8×8 bitmap font
- Implement `BitmapText` rendering in TextRenderer (PixiJS BitmapFont API)
- Replace all `Text` instances with `BitmapText`
- Verify all menus, dialog, battle text render correctly with new font

**6. Performance profiling and optimization (3-5 hrs)**
[Resolves momus MINOR #59]
- Profile with Chrome DevTools: identify frame drops, memory leaks
- Target: 60fps on mid-range hardware
- Optimize: TilemapRenderer dirty flag (already exists), sprite pooling, texture atlas
- Verify large maps (overworld 128×128) render smoothly
- Verify battle with many enemies doesn't drop frames

**7. Art asset finalization (5-8 hrs)**
[Resolves momus MAJOR #51 — if applicable]
- Replace PlaceholderTextures with pixel art (if art is being created)
- OR: polish placeholder graphics to be more visually distinct and appealing
- Ensure all sprites follow NES constraints: 16×16 characters, 16×16 to 32×32 enemies, 54-color palette subset
- Create victory pose sprites, attack animation frames

**8. Audio finalization (3-5 hrs)**
- Replace placeholder audio with final chiptune tracks (if available)
- Verify all scene-music mappings are correct
- Verify SFX timing (hit sound on damage, not on attack start)
- Volume balance between music and SFX

**9. Accessibility review (2-3 hrs)**
- Keyboard navigation works for all menus (no mouse-only interactions)
- Text is readable at all supported resolutions
- Color contrast sufficient for all UI elements
- Screen reader considerations (alt text for canvas, ARIA labels)

**10. Playtesting methodology (3-5 hrs)**
[Resolves momus MAJOR #56]
- Complete playthrough timing: target 8-15 hours for full game
- Gold accumulation curve: verify player can afford gear at each stage
- Level progression curve: verify player reaches appropriate level for each area
- Class comparison: verify all 6 classes (and upgrades) are viable
- Spell tier usefulness: verify each spell level has useful spells
- Document findings in `docs/PLAYTEST_RESULTS.md`

### Acceptance Criteria

- Full game playthrough completes in 8-15 hours without softlocks
- No class is unviable (each contributes meaningfully)
- Economy feels balanced (not too rich, not too poor at any stage)
- All bosses beatable at expected level with appropriate strategy
- 60fps maintained on mid-range hardware throughout
- Bitmap font renders correctly in all UI contexts
- All `[DEFERRED: PLAYTESTING]` items resolved with final values

### Test Strategy

- **Automated:** Full test suite passes (all 879+ tests)
- **Automated:** Cross-reference validation passes
- **Automated:** Performance benchmark: render 1000 frames, measure average frame time
- **Manual:** Complete playthrough from start to final boss
- **Manual:** Verify all shop inventories, NPC dialog, boss encounters work correctly

### Effort Estimate

**Total: 30-50 hours**

### Files Created/Modified

**Created:**
- `docs/PLAYTEST_RESULTS.md`
- Bitmap font asset files

**Modified:**
- `assets/data/classes.yaml` — tuned stat growth
- `assets/data/enemies.yaml` — tuned enemy stats
- `assets/data/items.yaml` — tuned prices and stats
- `assets/data/spells.yaml` — tuned spell power
- `src/entities/Character.ts` — tuned XP thresholds
- `src/ui/TextRenderer.ts` — bitmap font implementation
- `src/ui/DialogBox.ts` — bitmap font
- `src/ui/Menu.ts` — bitmap font
- Various scene files — performance optimizations

---

## Momus Issue Traceability Matrix

Every issue from the momus review is mapped to a specific phase and sub-task.

### CRITICAL Issues (16)

| # | Issue | Phase | Sub-Task | Status |
|---|-------|-------|----------|--------|
| 1 | No elemental damage system | 9 | Sub-task 1 | COMPLETE |
| 2 | No status effect system | 9 | Sub-task 2 | COMPLETE |
| 8 | Consumable effect execution undefined | 10 | Sub-task 3 | COMPLETE |
| 14 | No shop data format | 12 | Sub-task 1 | COMPLETE |
| 15 | Magic shops not mentioned | 12 | Sub-task 4 | COMPLETE |
| 20 | No deserialization (fromJSON) | 11 | Sub-tasks 3-4 | COMPLETE |
| 21 | Inventory has no serialization | 10 | Sub-task 7 | COMPLETE |
| 22 | Game state scope not defined | 11 | Sub-task 2 | COMPLETE |
| 32 | No overworld map | 15 (test), 17b (full) | Sub-task 7 / Sub-task 1 | COMPLETE |
| 33 | Terrain type system doesn't exist | 15 | Sub-task 1 | COMPLETE |
| 38 | AIBehavior interface incompatible | 14 | Sub-task 1 | COMPLETE |
| 39 | Multi-phase boss system not defined | 14 | Sub-task 3 | COMPLETE |
| 40 | No scripted encounter trigger system | 14 | Sub-task 4 | COMPLETE |
| 44 | Character.classData is readonly | 16 | Sub-task 2 | COMPLETE |
| 49 | Content scope unquantified | 17a-d | All sub-tasks | COMPLETE |
| 50 | No map editor or content pipeline | 17a | Sub-task 1 | COMPLETE |
| X1 | No acceptance criteria on any phase | ALL | Each phase has criteria | COMPLETE |
| X2 | No sub-task breakdowns | ALL | Each phase has 5-15 sub-tasks | COMPLETE |
| X3 | Story flag system unassigned | 11 | Sub-task 1 | COMPLETE |

### MAJOR Issues (25)

| # | Issue | Phase | Sub-Task |
|---|-------|-------|----------|
| 3 | No magic damage formula | 9 | Sub-task 3 |
| 4 | No spell learning mechanism | 9 | Sub-task 4 |
| 5 | Spell targeting UI not specified | 9 | Sub-task 7 |
| 9 | No field item use | 10 | Sub-task 4 |
| 10 | BattleCommand needs itemId | 9 | Sub-task 5 |
| 11 | Inventory needs ItemData lookup | 10 | Sub-task 2 |
| 16 | QuantitySelector no implementation | 12 | Sub-task 3 |
| 17 | Sell price not specified | 12 | Sub-task 2 |
| 18 | Inn mechanic under-specified | 12 | Sub-task 5 |
| 23 | No story/progression flag system | 11 | Sub-task 1 |
| 24 | Save slot UI not specified | 11 | Sub-task 6 |
| 27 | No audio asset pipeline | 13 | Sub-task 4 |
| 28 | Music state management not specified | 13 | Sub-task 2 |
| 29 | Per-scene trigger mapping not defined | 13 | Sub-task 5 |
| 34 | MovementMode integration not specified | 15 | Sub-task 3 |
| 35 | Key item gate system not defined | 15 | Sub-task 6 |
| 36 | Airship landing restrictions undefined | 15 | Sub-task 5 |
| 41 | Cutscene system is separate major feature | 14 | Sub-task 6 |
| 42 | Boss "no running" restriction | 14 | Sub-task 5 |
| 45 | Upgraded class data doesn't exist | 16 | Sub-task 1 |
| 46 | Upgrade trigger mechanism not defined | 16 | Sub-task 3 |
| 51 | Art assets not addressed | 18 | Sub-task 7 |
| 52 | NPC dialog is creative work | 17d | Sub-task 1 |
| 55 | Phase 18 is catch-all | 18 | Decomposed into 10 sub-tasks |
| 56 | No playtesting methodology | 18 | Sub-task 10 |
| X4 | Field menu system unassigned | 10 | Sub-task 1 |
| X5 | No effort estimates | ALL | Each phase has estimates |
| X6 | No test strategies | ALL | Each phase has test strategy |

### MINOR Issues (22)

| # | Issue | Phase | Sub-Task |
|---|-------|-------|----------|
| 6 | Spell charge restoration not specified | 9 | Sub-task 8 |
| 7 | BattleCommand needs spellId | 9 | Sub-task 5 |
| 12 | Equipment UI flow not specified | 10 | Sub-task 5 |
| 13 | Key item behavior not addressed | 10 | Sub-task 6 |
| 19 | Two-column price display | 12 | Sub-task 2 |
| 25 | localStorage error handling | 11 | Sub-task 5 |
| 26 | Phase ordering — save could move earlier | 11 | DONE (moved to Phase 11) |
| 30 | Web Audio API context lifecycle | 13 | Sub-task 3 |
| 31 | No audio asset directory | 13 | Sub-task 1 |
| 37 | Vehicle acquisition tied to story | 15 | Sub-task 8 / 17d Sub-task 4 |
| 43 | Boss elemental weaknesses depend on Phase 9 | 14 | Prerequisite acknowledged |
| 47 | Stat recalculation on upgrade | 16 | Sub-task 2 |
| 48 | Spell access expansion on upgrade | 16 | Sub-task 2 |
| 53 | Encounter table balancing | 17b | Sub-task 4 / 18 Sub-task 4 |
| 54 | No content validation tooling | 17a | Sub-task 2 |
| 57 | Design doc deferred items not enumerated | 18 | Sub-task 1 |
| 58 | Bitmap font not explicitly included | 18 | Sub-task 5 |
| 59 | Performance optimization not mentioned | 18 | Sub-task 6 |
| X7 | Existing infrastructure unreferenced | ALL | Infrastructure table in header |

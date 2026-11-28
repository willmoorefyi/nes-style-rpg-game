# Agent Instructions — FF1-Style NES RPG

This document provides concrete instructions for AI agents working on this codebase. Read this before making any changes.

---

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript check + production build (tsc && vite build)
npm run test:fast    # Every test but the heavy tier: 425 files, 10,201 tests, about 70 s at TS with the default workers (172 s at NW2-INT with 2) (the agent's handoff check)
npm run test:full    # Everything, both tiers: with a mutation-cache hit about 4 min (224 s at TS, 2 workers); on a miss about 23 min (the suite runs live in its pool) (the integrator's check, once per merge batch)
npm run test:world   # The heavy tier alone (tests/tiers.ts): the real-world mutation suite through its cache (hit: the live audit, about 3 min; miss: the pool, 4 workers) and questGraph
npm test             # = test:full (unchanged meaning: all tests)
```

**Always run `npm run build` and `npm run test:fast` after making changes**, plus the tests of what you touched; both must pass clean before any work is considered complete. After a change to world or quest data (maps, layouts, `quest.yaml`), `src/progression/**` or the field rules, run `npm run quest -- --strict` (every proof, about 2 min). `--mutate`, `--from-reset`, `npm run test:full` and the full determinism check are the integrator's, once per merge batch (TS, `docs/TEST_SPEED_PLAN.md` 7.1); an agent may run `npm run quest -- --strict --mutate` (parallel, about 16 min) when it edits a gate-table row or `nonLoadBearing`, and its result lands in the shared mutation cache. Times: measured at TST on this machine (14 cores) with `--maxWorkers=2`, see "Test tiers" under Testing.

---

## Project Overview

A Final Fantasy I (1987) homage built with PixiJS 8 + TypeScript 5.3 + Vite 5. Turn-based RPG with 4-member party, 6 base classes (upgradeable to 12), spell charge system, tile-based exploration, boss battles, vehicles, and data-driven content in YAML.

**All 18 phases are complete.** See `docs/PHASE_PLAN.md` for detailed plans and `docs/PROGRESS.md` for post-phase-18 improvements (battle decomposition, lazy loading, FEAR spell, battle UX).

---

## Architecture

### Core Design Principles

1. **Decoupled systems** — Battle logic has zero rendering dependencies. `BattleSceneDeps` interface lets the battle engine run without PixiJS.
2. **Injectable RNG** — `EncounterRng` and battle systems accept RNG functions for deterministic testing.
3. **EventBus** — Loose coupling between systems. Audio reacts to game events, not direct calls.
4. **Data-driven content** — All game content (items, spells, enemies, classes, shops, maps) loaded from YAML at runtime via `DataLoader`.
5. **Scene stack** — Push/pop architecture with `onPause()`/`onResume()` lifecycle hooks for layered UI. A scene with `transparent = true` (the inn) leaves the scene below it visible when pushed.
6. **Lazy scene loading** — `SceneManager.registerLazy()` with dynamic `import()` and factory caching. Only `TitleScene` is eagerly loaded; 10 other scenes are lazy-loaded, reducing the main bundle from 551KB to 430KB (−22%).

### Directory Map

```
src/
├── core/           # Engine: Game, SceneManager, AssetLoader, DataLoader, EventBus,
│                   #   InputManager, AudioManager, GameFlags, schemaValidation
├── battle/         # Combat: BattleStateMachine, SpellExecutor, DamageFormula, Elements,
│                   #   StatusEffects, BattleCommands, TurnOrder, EnemyAI, AIBehavior,
│                   #   BasicAI, BossAI
├── scenes/         # All scenes: Exploration, Battle, FieldMenu, Status, Equip, Item,
│                   #   Shop, MagicShop, Inn, Save, Load, GameOver, FieldMagic, FieldOrder
│   └── battle/     # Decomposed battle scene modules:
│                   #   BattleSceneTypes, BattleLayoutEngine, BattleDisplayManager,
│                   #   BattleFieldTargeting, BattleAnimationController, battleMessageUtils
├── systems/        # Game systems: EncounterSystem, EncounterTable, MapLoader,
│                   #   MapTransition, DialogManager, BattleTrigger, SaveManager,
│                   #   NPCInteraction, ItemEffects, KeyItemGateSystem,
│                   #   ClassUpgradeSystem, VehicleManager, CutsceneManager,
│                   #   CutsceneRegistry
├── entities/       # Game objects: Character, Inventory, PartyManager, PlayerController,
│                   #   NPC, MovementMode
├── rendering/      # PixiJS: TilemapRenderer, Camera, SpriteAnimation, CollisionMap,
│                   #   PlaceholderTextures, CharacterAtlas, BattleArt
├── ui/             # UI: Window, Menu (with scrolling), DialogBox, TextRenderer,
│                   #   ErrorDisplay, SpellSelectionUI, ItemSelectionUI, QuantitySelector
├── data/           # Registries: ItemRegistry, SpellRegistry, ClassRegistry, ShopRegistry
├── types/          # Shared TypeScript interfaces (types/index.ts)
└── main.ts         # Entry point
```

### Key Interfaces & Types

All shared types live in `src/types/index.ts`. Key ones:

- `CharacterData` — character stats, class, equipment, spell charges
- `EnemyData` / `EnemyInstance` — enemy definitions and battle instances
- `SpellData` — spell definitions (level, type, effect, targeting, element)
- `ItemData` — items (weapons, armor, consumables, key items)
- `MapData` — tile maps with layers, NPCs, transitions (`effect: door` zooms into shop/house doors, otherwise fade), encounters (`encounters`, `encounterZones`), `inspect` cells, `name` (the HUD label; no label when missing), `camp` (Tent/Cabin allowed; world map only) and `battleBackgrounds` (`default`, `terrain`, and per-encounter-zone `zones`)
- `ItemData.description` — the one-line text shown in the help bar (`src/ui/HelpWindow.ts`) of the item, equip, field-magic and shop screens. Shared UI: `HelpWindow`, the field menu's `PartyPanel` (`src/ui/PartyPanel.ts`) and the battle's `BattlePartyPanel` (`src/scenes/battle/`)
- `ItemData.prompt` — the confirm question before a party item (Tent, Cabin) is used; missing means "Use <name>?"
- `CharacterClassData.abbr` — the short class label (WAR, THF, WHM …) for tight UI; read it through `classLabel()` (`src/data/classLabel.ts`: slot strip, magic shop, save slots), which falls back to the full name
- `CharacterClassData.copyOf` — the classic class a copy class is an exact copy of (every class but the 12 classic ones; `docs/CLASS_BARBARIAN_PLAN.md` 17); the new-game pick screen shows "Plays as: <name>" on the class preview. `validateClassCopies` (`src/core/schemaValidationClasses.ts`, run by `DataLoader.loadClasses`) refuses an unknown, self, copy-of-a-copy, cross-tier or mismatched upgrade copy
- `ScriptedEncounter.npc` — the id of an NPC on the same map; talking to it starts the fight (Garland). `BossPhase.hits` / `attack` override the boss's hits and attack once its `hpThreshold` is crossed
- `KeyItemGate.message` — plain text, or a `ConditionalDialog[]` resolved on the story flags like NPC dialog (the bridge gate's line changes after the King's order)
- `SaveData.location` — the map's display name at save time; `SaveManager.getSaveSlots()` returns `SlotSummary` rows (location, members, gold, play time) for the Save/Load lists, with a label made from the map id for older saves
- `BattleSceneDeps` — decoupled battle scene dependencies
- `BattleCommand` — fight/magic/item/run commands
- `ElementalProfile` — per-enemy elemental weaknesses and resistances
- `EquipmentSlot` — weapon, armor, shield, helmet

### Data Flow

```
YAML files (assets/data/*.yaml, assets/maps/*.yaml)
  → AssetLoader.loadYaml() (fetch + yaml.parse)
    → DataLoader (typed loaders with schema validation)
      → Registries (ItemRegistry, SpellRegistry, ClassRegistry, ShopRegistry)
        → Game systems consume via registry lookups
```

---

## Coding Standards

### TypeScript Rules (Enforced)

- `strict: true` in tsconfig — no implicit any
- **Zero `as any`** in source code. Use proper types or specific type assertions.
- **No `@ts-ignore` or `@ts-expect-error`** — fix the types instead.
- **No silent catches** — every `catch` block must log or handle the error. This project had a critical white-screen bug caused by `catch { /* ignore */ }`. Never repeat this pattern.

### Naming Conventions

- PascalCase: classes, interfaces, types, enums (`BattleStateMachine`, `SpellData`)
- camelCase: methods, properties, local variables (`executeCommand`, `spellCharges`)
- UPPER_CASE: constants (`TILE_SIZE`, `NES_WIDTH`)

### Import Style

- Relative imports with `.js` extension: `import { Character } from '../entities/Character.js'`
- Type-only imports where possible: `import type { SpellData } from '../types/index.js'`

### File Size Guidelines

- Source files should stay under 250 lines. If a file grows beyond this, decompose it.
- Known exceptions being monitored (current lines / ceiling, measured at pass W INT; the TS ceilings are pinned by `tests/data/fileCeilings.test.ts`): `ExplorationScene.ts` 581 / 590 (at WR) (pass W moved its vehicles and NPC actions into `src/scenes/exploration/FieldVehicles.ts` and `FieldNpcActions.ts`), `BattleStateMachine.ts` 566 / 592, `BattleScene.ts` 541 / 594, `src/types/index.ts` 424 / 442, `SpellExecutor.ts` 311 / 314, `BattleAnimationController.ts` 304 / 308, `Character.ts` 270, and the Python `layouts/castle.py` 360 / 360 and `layouts/cornelia.py` 323 / 355. `castle.py` is at its ceiling, so a change there must extract code first or be line-neutral.
- Pass W: every file of `src/progression/`, the field rules (`src/systems/fieldRules*.ts`), `src/types/quest.ts`, `src/core/schemaValidationQuest.ts`, `FieldVehicles.ts`, `FieldNpcActions.ts`, the `layouts/world*.py` files and every `.py` under the region directories (`a1`, `elf`, `earth`, `fire`, `ordeal`, `water`, `wind`, `past`) stay under 250 lines, with no exceptions (`tests/data/questCeilings.test.ts`, which finds new files as they land).
- Also over 250 and not split: `src/core/schemaValidation.ts` (380), and the tools `build_map.py`, `kit.py`, `map_selftest.py` and `stage_backgrounds.py` (255).
- `BattleScene.ts` was decomposed from 1,169 lines to ~508 lines by extracting 6 modules into `src/scenes/battle/`. This is the model for future decomposition.

---

## Data Files (YAML)

All game content is in YAML. **Never hardcode game data in TypeScript.**

### File Locations

| File | Contents |
|------|----------|
| `assets/data/items.yaml` | Weapons, armor, consumables, key items |
| `assets/data/spells.yaml` | White and black magic spells |
| `assets/data/enemies.yaml` | Enemy stats, rewards, elemental profiles |
| `assets/data/classes.yaml` | Character class definitions and stat growth |
| `assets/data/shops.yaml` | Per-town shop inventories |
| `assets/maps/*.yaml` | Tile maps, NPCs, transitions, encounter tables |
| `assets/data/audio-manifest.json` | Audio file paths (JSON, not YAML) |
| `assets/backgrounds/` | Battle background images (optional per encounter) |

### Cross-File Validation

`tests/data/crossFileValidation.test.ts` validates all cross-file ID references at test time:

- Shop item IDs → must exist in items.yaml
- Magic shop spell IDs → must exist in spells.yaml
- Encounter enemy IDs → must exist in enemies.yaml
- Item `usableBy` class IDs → must exist in classes.yaml
- Spell `element` values → must be valid ElementType
- Spell status effects → must be valid StatusEffect

**If you add/rename/remove any ID in a data file, run `npm run test:fast` to catch broken references.** The validation suite will pinpoint exactly which reference is broken.

### YAML Gotchas

When editing YAML data files, watch for these pitfalls:

| Gotcha | Problem | Fix |
|--------|---------|-----|
| Norway problem | `no` parses as `false` | Quote it: `"no"` |
| Boolean coercion | `yes`, `true`, `on` → boolean | Quote strings: `"yes"` |
| Colons in strings | `name: Sword: Fire` breaks | Quote: `name: "Sword: Fire"` |
| Hash in strings | `name: Item #5` breaks | Quote: `name: "Item #5"` |
| Numeric strings | `id: 123` becomes number | Quote: `id: "123"` |

---

## Testing

### Test Structure

```
tests/
├── battle/         # Combat mechanics (damage, turns, AI, elements, status, magic)
├── core/           # Engine systems (scenes, input, events, data loading, audio, flags)
├── data/           # Cross-file data validation
├── entities/       # Characters, inventory, party, player controller
├── helpers/        # Shared test utilities (testUtils.ts with createMockGame)
├── integration/    # End-to-end battle flow tests
├── rendering/      # Camera, collision, tilemaps, sprites, placeholders
├── scenes/         # Scene-specific tests (exploration, battle, shop, equip, inn)
├── systems/        # Encounters, map loading, dialog, save, battle trigger
└── ui/             # Menus, dialogs, text, windows, quantity selector
```

Some tests are co-located with source:
- `src/ui/__tests__/textUtils.test.ts`
- `src/systems/__tests__/ItemEffects.test.ts`
- `src/systems/__tests__/EncounterRng.test.ts`
- `src/data/__tests__/ItemRegistry.test.ts`

### Test Patterns

- **Injectable RNG**: Battle tests pass deterministic RNG functions. Use `() => 0.5` or similar for predictable results.
- **Shared mocks**: `tests/helpers/testUtils.ts` exports `createMockGame()` and `createMapData()`. Use these instead of creating ad-hoc mocks. Their input mocks have `holdOff: vi.fn()`.
- **Balance bounds**: `tests/balance/` (`garland.test.ts`, `zones.test.ts`, `fieldPacing.test.ts`, `chaos.test.ts`) drive the real `BattleStateMachine` over seeded runs (`tests/helpers/battlePolicies.ts`, `balanceData.ts`; Chaos: `tests/helpers/chaosBattle.ts`, 400 seeds per policy, the level-40 `chaos_forms` party asserted first). Each bound sits at least 3 points from its measured value, given in the test name; re-measure after any enemy, item or formula change. **D-C7-19:** a round-count bound keeps a margin of at least 2 rounds instead (the 3-point rule cannot apply when the bound is the target itself, e.g. Chaos's median rounds in [10, 15] at 12). Invariants are asserted exactly and labelled "invariant" in the test name.
- **Scratch code stays out of the repo**: measurement sims, probes and browser scripts run from a copy outside the worktree (e.g. `/tmp/<agent>/sim/`, a copy of `src/` with symlinks to `node_modules` and `assets`, run with `vite-node`); `git status` must show no scratch file before a commit.
- **No private member access**: Don't use `as unknown as` to access private fields. Test through public API.
- **Schema validation tests**: `tests/core/schemaValidation.test.ts` tests the data validators.

### Test tiers (TST)

Two vitest projects (`vitest.workspace.ts`) built from one list, `tests/tiers.ts`:

| Tier | Command | What | Time (2 workers, at TST) |
|------|---------|------|------|
| fast | `npm run test:fast` | every test file not listed in `HEAVY_TESTS` | 2 min (128 s) (368 files) |
| world | `npm run test:world` | the files in `HEAVY_TESTS`: `tests/progression/questMutateWorld.test.ts` (through the mutation cache since TS) and, since NW-5 (the 256x256 world's 1.29 M-state graph, 170 s at collect), `questGraph.test.ts`; forks with an 8 GB heap | TS: a cache hit about 4 min (questMutateWorld's audit 118-134 s, questGraph about 100 s); a miss about 23 min (the live suite 1272-1317 s on 4 workers) |
| full | `npm run test:full` = `npm test` = `vitest run` | both | TS: a hit 224 s, a miss about 23 min (before TS 72-79 min) |

- **Who runs what (TS, `docs/TEST_SPEED_PLAN.md` 7.1).** An agent runs `npm run build`, `npm run test:fast` and the tests of what it touched (`npx vitest run <paths>`) before a handoff; after a change to world or quest data, `src/progression/**` or the field rules also `npm run quest -- --strict` (and for `--stage` work the stage gate); after a world change `world.py`, the compile, `build_map.py --check-determinism --changed overworld` and `mode7_atlas.py --check-determinism overworld`. Not `--mutate`, `--from-reset`, `test:full` or the full determinism check (an agent may run `--mutate` when it edits a gate-table row or `nonLoadBearing`). **The integrator, once per merge batch** (every merge into `mainline` is a batch, a single branch or a hotfix too), on an integration branch `int-<batch>` cut from `mainline`: (1) merge the branches, re-run `world.py` and the layouts, full-compile the world if it changed; (2) `build_map.py --check-determinism --changed --base <batch base> overworld` (it falls back to the full check by itself) and `mode7_atlas.py --check-determinism overworld`, `git diff --exit-code assets assets-src/maps`; (3) `npm run build`, `npm run test:fast`; (4) `npm run quest -- --strict --mutate --jobs 6` (fills the mutation cache) and `npm run quest -- --strict --only c --from-reset`, one after the other (both at once only on an idle machine); (5) `npm run test:full` (never skipped: a hit on step 4's entry, about 10 min; on a miss it runs the suite live); (6) fast-forward `mainline` to `int-<batch>` and record the figures. When a step fails, find the branch from the failure's row, element, map and stage, drop it from the batch (recreate `int-<batch>` without it), send it back and re-run; `mainline` never holds a failing batch. Pass `-- --maxWorkers=2 --minWorkers=1` when other heavy processes share the machine.
- **Why one file is heavy.** Before TST, a full run took 58 min (3507 s with 2 workers), and one file was 57 of them: `questMutate.test.ts` ran the real-world mutation suite (`quest --mutate`) twice, plain at collect time and `--strict` in a test, about 28 min each (69 s of gate-table rows, the rest the generic elements, each re-proving (a), (b) for every stage, (c) and (e) on the 192x192 world). Every other file is small: the next slowest are `questGraph.test.ts` 35 s (the real world's (a)-(c)), `questLate.test.ts` 10 s, `questCurve.test.ts` 8 s, then nothing over 6 s; the region walks (`tests/quest/**`) take 1-4 s each and the balance suites (`chaos.test.ts`, 400 seeds per policy, included) under 1 s each. So the whole-world proofs, the region walks and the balance bounds all stay in the fast tier.
- **What changed.** The mini-world half of the mutation tests stays in `questMutate.test.ts` (fast); the real-world half moved to `questMutateWorld.test.ts` (world). The `--strict` variant reuses the plain variant's mutated checks inside one run (a mutated context is never strict and is built only from the base world, late data, stage and state cap), and since TS also across runs: the **mutation cache** (`questMutateCache.ts`, `<git common dir>/ff-cache/quest-mutate/<fp>.json`, shared by every worktree) keys the raw check outputs by a fingerprint of every file the verifier reads (recorded where read, `questInputs.ts`), its esbuild code closure, the options, Node / yaml / esbuild and a salt. A hit re-derives both variants from the cached raw runs with the current code, checks them against the stored results, and re-runs every light job plus one heavy job picked by the fingerprint live (`QUEST_MUTATE_AUDIT=<n>|all`); a miss runs the suite live and stores it. The raw runs are computed by a pool of `worker_threads` (`questMutatePool.ts`; 4 workers inside vitest, `QUEST_MUTATE_JOBS`), the derivation stays serial (`questMutateSuite.ts`: plan, compute, derive). `QUEST_MUTATE_CACHE=refresh` forces a live run that overwrites, `off` neither reads nor writes. No assertion, bound or seed count changed.
- **The guard.** `tests/timingReporter.ts` (a reporter in `vite.config.ts`) counts each file's collect + setup + run time (vitest's JSON reporter leaves out collect, where top-level `describe` work runs) and fails the run when a `fast` file is over `FAST_FILE_BUDGET_S` (90 s; `TEST_FILE_BUDGET_S=<s>` overrides, `0` turns it off). A new heavy file must be listed in `HEAVY_TESTS` with its reason; `tests/tiers.test.ts` checks the listed files exist. `TEST_TIMINGS=/tmp/<agent>/t.json` writes every file's timings, slowest first, with the tasks' `meta`. The 90 s budget is the fast tier's only (a world-tier budget would fail every honest cache miss); a run that includes `questMutateWorld.test.ts` prints `questMutateWorld: cache hit <fp12> (audit S s)` or `questMutateWorld: cache MISS <fp12> (live run S s on W workers)`, so a miss is visible, never a failure.
- **Pools.** The default `threads` pool with isolation is kept, and no script forces a worker count. `--no-isolate` was measured on the fast tier: 98 s instead of 128 s, but 15 tests in 6 files fail on state shared between files, so it is not used.

### Running Tests

```bash
npm run test:fast                           # The fast tier (before a handoff)
npm test                                    # All tests (= test:full)
npx vitest run tests/battle/               # Just battle tests
npx vitest run tests/data/crossFileValidation.test.ts  # Just data validation
npx vitest --watch                          # Watch mode
```

---

## How to Add Common Things

### New Item

1. Add entry to `assets/data/items.yaml`
2. If sold in a shop, add the item ID to the shop's `inventory` in `assets/data/shops.yaml`
3. Run `npm run test:fast` — cross-file validation will catch any broken references

### New Spell

1. Add entry to `assets/data/spells.yaml` with `id`, `name`, `level`, `type` (white/black), `effect`, `targeting`, `power`, `element`
2. If sold in a magic shop, add the spell ID to the shop's `inventory` in `assets/data/shops.yaml`
3. Run `npm run test:fast`

### New Enemy

1. Add entry to `assets/data/enemies.yaml` with stats, rewards, elemental profile
2. Add the enemy ID to encounter tables in the relevant map YAML (`assets/maps/*.yaml`)
3. Run `npm run test:fast`

### Editing a 2x Map (generated sources)

Most compiled maps come from Python layout scripts, not hand-written YAML. Each script writes its sources into `assets-src/maps/` with a `GENERATED by ...` header; edit the script, never the generated YAML:

| Script (under `assets-src/tools/layouts/`) | Writes |
|--------|--------|
| `world.py` | `overworld.yaml`, the whole 256x256 world (see "The world (pass NW)" below): the region specs `world_specs/<region>.py` (with each region's `content` hook, `world_content.py`) through the generator `tools/worldgen/`, the content and the writer (`world_source.py`), the checks (`world_checks.py`, `worldgen/gates*.py`, `prewalk.py`, `a1/world_a1_checks.py`) and the step-mean scaling (`world_balance.py`); the only writer of the world source. `overworld.py` is a shim that runs it |
| `cornelia.py` | `cornelia.yaml` (the walled royal city, its gates and edge exits) |
| `interiors.py` | the ten house interiors `cornelia-house-<name>.yaml` (scholar, fisher, farm, knight, weaver, gardener, family, apprentice, tavern, shrine) and the six shop and inn maps (`cornelia-weapon-shop`, `-armor-shop`, `-item-shop`, `-white-magic`, `-black-magic`, `-inn`) |
| `castle.py` | `cornelia-castle.yaml`, `-2f`, `-tower`, `-cellar` |
| `cornelia_gates.py` | nothing on its own: the gate dressing `cornelia.py` places (turrets on the wall bends and beside every gate, the `town/gates` arches over the south gate, the inner gatehouse and the north postern) |
| `stubs.py` | the stub maps of canon ids no tranche has built yet (`stubs.py --check all` must print `stubs: 0 left`; since INT none are left) |
| `a1/town_pravoka.py`, `a1/town_pravoka_rooms.py` | A1: `pravoka` and its 6 houses and 6 shop / inn maps (`pravoka-house-*`, `pravoka-*-shop`, `-white-magic`, `-black-magic`, `-inn`); `a1/matoya.py`: `matoya-cave` |
| `elf/town_elfheim.py`, `elf/town_elfheim_rooms.py` | ELF: `elfheim`, its castle (`elfheim-castle`, `-castle-chamber`), the vault, 6 houses and the shops; `elf/keep.py`: `western-keep-1f`, `-2f`; `elf/marsh_b1.py` .. `marsh_b3.py`: `marsh-cave-b1` .. `-b3` |
| `earth/dwarf.py`, `earth/giant.py`, `earth/sage.py` | EARTH: `dwarf-hall` (Nerrick's canal, Smyth's forge for S31), `giant-tunnel`, `sage-cave`; `earth/town_melmond.py`, `earth/town_melmond_interiors.py`: `melmond` and its houses (Dr. Unne's among them) and shops; `earth/cavern_upper.py`, `cavern_lower.py`: `cavern-earth-b1` .. `-b5` |
| `fire/town_crescent.py`, `fire/town_crescent_rooms.py`, `fire/town_crescent_circle.py` | FIRE: `crescent`, its houses and shops, `crescent-circle` (the sages); `fire/gurgu_upper.py`, `gurgu_lower.py`: `gurgu-b1` .. `-b5`; `fire/ice_b1.py` .. `ice_b3.py`: `ice-cavern-b1` .. `-b3` |
| `ordeal/citadel.py`, `ordeal/cardia_deep.py` (+ `cardia_people.py`) | ORDEAL: `citadel-1f` .. `-3f`; `cardia-deep` (pass CD: the dragon great village; `bahamut-cave` / `-lair` retired) |
| `water/town_onrac.py`, `water/town_onrac_interiors.py` | WATER: `onrac`, its houses and shops; `water/caravan.py`: `caravan-camp` (the bottle, 40000 G); `water/waterfall.py`: `waterfall-cave`; `water/shrine_b1.py` .. `shrine_b5.py`: `sea-shrine-b1` .. `-b5` |
| `wind/town_gaia.py`, `wind/town_gaia_interiors.py` | WIND: `gaia`, its houses, shops and `gaia-spring`; `wind/lufenia_town.py`, `lufenia_interiors.py`: `lufenia` and its houses and shops; `wind/mirage_floors.py`: `mirage-1f` .. `-3f`; `wind/sky_lower.py`, `sky_upper.py`: `sky-castle-1f` .. `-5f` |
| `past/past_upper.py`, `past/past_lower.py` | PAST: `past-temple-1` .. `-5` and `past-chaos` (the Chaos door) |

The `*_common.py`, `*_people.py`, `*_homes.py`, `*_shops.py` and `*_site.py` files of a region are libraries of those scripts (a town's `town_<t>_site.py` is its overworld site, pasted by its region's world module). Each generated source names its script in its `GENERATED by ...` header.

`temple-of-fiends.yaml` is still hand-written. Object options added in R and U:
- deco `passage: true` — the deco's above rows may cover a walkable cell (a gate arch over a road); only the arch's drawn opening is walkable, the jambs block.
- deco `style` — a `RECOLOR` entry in `build_map.py`, e.g. `pale_stone` (the bridge debris), `bright`, `brighter` (value x1.5, the temple icon).
- deco `waterline: n` (WL) — a moored boat partly under water: on an `on_water` deco with no above rows, the art below native px row n (from the top of its parts grid) is baked as a 4x4 ordered dither (8 of 16 pixels kept, thinning to 4 of 16 by 24 px down) of the art mixed toward its shape in the water's hue, with a 1 px light ripple on row n; 15-bit colours, binary alpha (`tools/waterline.py`, its selftest also runs in `build_map.py --selftest`). Set on the Onrac submarine (62 of 96: the conning tower and upper hull above), the Onrac fishing boat (84 of 96) and the Pravoka brig (134 of 144); the frigate vehicle is its own sprite.
- patch `art_ground` (FX-R) — the patch overlay is painted as this legend char instead of `ground` (same terrain only), e.g. the canal's stone-banked `~` over Water `o`.
- `layouts/world_dress.py` (FX-R) — `scatter()` dresses a town icon with seeded 1x1 copses, bushes and stones (offsets, gaps, `collide: alpha`; the door's sides stay solid, the gate stays reachable): Melmond, Onrac.
- A peak drawn near a chunk border reaches into the next chunk, so editing mountains in a chunk beside another region's chunk can repaint it. Check the changed chunk files against `world.py --owned-chunks <region>` after a compile.
- **Dungeon props (AR, AR-P2).** 51 Bedrock props of art pass AR (50, plus pass CD's `drake_brazier`, purpose `ar_dragon`, approved 2026-11-22: a prop's `approved` / `purpose` options go to its record only) (user rulings 2026-11-21: AR-P's usable picks, the weak-but-usable chains, bog lantern, fire idol, robot husk, gold skull, 2x2 bookshelf and the ice block, and the re-rolls of the wall torch (a sconce on stone, `torch_ultra_11`) and the cobweb (thick threads, `web_ultra_23_k`)) in `gen/approved/dungeon/props_ar.{png,json}`, re-cut offline from the render cache by `python3 -I assets-src/gen/prop_cut.py` (`--check`: the committed sheet rebuilds; `--native DIR`; the picks, cut options and flame rects are `gen/prop_spec.py`; copy the cache PNGs from the main checkout into a worktree first). Cells `ar_<id>_<r>_<c>`; `tools/kit_props.py` loads them into every kit (code-drawn placeholders while the sheet is missing) and bakes a torch-like prop without its flame's tongue pixels (the runtime draws them). The maps are dressed by one table, `layouts/props_ar_maps.py` (`DRESS`: map id -> (prop, x, y)), which `common.Room.write` applies through `layouts/props_ar.py` `place`: a wall prop (torch, chains, cobweb, portcullis, iron door, bar gate) on two-row wall-face cells (`on_wall`), a tall floor prop with its upper rows on the face behind it (else `above_rows`), and every lit prop also gets its `flame` ambient entry. 316 props on 43 dungeon maps (Cardia Deep's 50 since pass CD; every floor of Marsh Cave, the Western Keep, the Cavern of Earth, the Giant's Tunnel, Gurgu, the Ice Cavern (off the sheet ice and its neighbours only; no stopper changed), the Sea Shrine, the Waterfall Cave, the Sky Castle, the Mirage Tower, the Temple of the Past, the Citadel and Cardia Deep). The portcullis, iron door and bar gate are dressing only (no flag swaps their art; the open portcullis is in the sheet but not placed). Tests: `tests/data/arProps.test.ts`.

After an edit:

```bash
python3 -I assets-src/tools/layouts/world.py              # regenerate the source(s) (the world: world.py; a map: its script)
python3 -I assets-src/tools/build_map.py overworld        # compile (validates; fails on any map-check error; takes the world-compile lock itself)
python3 -I assets-src/tools/build_map.py --preview overworld 20 30 40 45 /tmp/crop.png --grid --collision
```

Re-running every layout script must leave `git diff --exit-code assets-src/maps` clean (the scripts are deterministic), and `build_map.py --check-determinism --changed overworld` must pass (TS-D, `det_changed.py`: only the chunks whose digest differs from the base commit's, `git merge-base HEAD mainline` or `--base REV`, under both seeds at once, plus the working-tree files of those chunks and every other chunk file byte-equal to the base's; it falls back to the full check by itself on a compiler-closure, kit-art, runtime or size change or 120+ painted chunks, and `--full` forces it; `--serial` runs the two seeds in turn). A map without chunk digests takes the plain `--check-determinism <id>`.

### The world (pass NW)

Plans: `docs/NATURAL_WORLD_PLAN.md` (pass NW, rev 3.2; every tranche's result in its sections 11-16) and its edits
`docs/NW2_EDITS_PLAN.md` (pass NW2, rev 3: the gorges, Mount Duergar, the dock audit, the northern hikes, taiga, save
v5; the tranche results and the INT result at its end), on `docs/WORLD_PLAN.md` (pass W: the progression S0-S31, the
gates, the verifier proofs) and `docs/QUEST_PLAN.md`.

- **Size.** The world map `overworld` is 256x256 cells (`layouts/world_api.py`: `WORLD_W`, `WORLD_H`, `CHUNK` 16, so
  256 chunks), one whole-world generator, no region boxes and no act-1 frame (NW-5 removed `A1_ORIGIN`,
  `world.frames`, `shiftA1`, `Game.pendingFrame` and `worldOffsetOf`). Cornelia's south-gate arrival is
  `CORNELIA_NW` (146, 155); every other anchor's target is `CORNELIA_NW + S_STAR x ref` (s* 0.86, the reference offsets
  of `assets/data/world-anchors.yaml`).
- **The wrap (pass WR, `docs/WORLD_WRAP_PLAN.md`; its result at the end).** The world map is a torus, as FF1's: every
  mode steps from x 255 to 0 and y 255 to 0 (and back). `MapData.wrap: true` is written by `world.py`
  (`world_source.py`) and passed through by the compiler; the schema allows it only on a streamed baked map of whole
  chunks, so every other map (and the legacy 64x64 overworld) stays flat. One pure module, `src/systems/worldWrap.ts`
  (`canonCell`, `canonOf`, `cellIndex`, `stepTo`, `stepIndex`, `isStep`, `wrapDelta`, `nearestImage`, `SEAM_MARGIN`),
  does the maths for the game, the field rules and the verifier. Cells are canonical everywhere but in drawing:
  `fieldStep`, `canEnter`, `cellReader` and `modeAfterStep` canonicalise at the top, the lookups (`baseTerrain`,
  `gateAt`, ...) stay strict. The seam is open ocean (D-WR-2): `world.py`'s gated `wrap` line (`worldgen/gates_wrap.py`:
  every edge cell Water, no land within `SEAM_MARGIN` 4 of an edge, the components on foot, by canoe and by ship equal
  with and without the seam, patches off and on) and `seam_zones` (the ship zones on both sides of each seam of one
  `SEA_CLASS`, report-only: a sea cell keeps its zone, Q4 (b)); the compile's `check_seam` (`map_checks_wrap.py`: `wrap`
  needs `sealed_edges`; the seam's 1-px colour step against the interior chunk lines, `seam: x 5.7 (interior max 6.7),
  y 7.3 (7.7)`). The user's ruling (2026-11-22): S21's band is [25, 29] (the wrapped witnesses reach L29.2) and the
  plan's fallback seam zones (F-WR) are not used. Relocation (`worldRevalidate`, `worldReset`, `MapTransition.safeSpawn`) and
  proof (g) stay planar. `build_map.py --preview` reads a wrapped map mod W (`--preview overworld 240 90 272 120 ...`)
  and `--grid` marks the seam in magenta. Seam spots `fir_s_seam_e`, `elf_s_seam_s`, `wat_s_seam_nw` (docks at sea) and
  `wnd_s_seam_landing`; previews `?mute=1&scenario=wr_ship_east | wr_ship_south | wr_air_corner | wr_air_land |
  wr_parked`. Tests: `tests/systems/worldWrap.test.ts`, `tests/entities/playerWrap.test.ts`,
  `tests/rendering/wrapImages.test.ts`, `tests/scenes/wrapField.test.ts`, `tests/scenes/mode7/mode7Wrap.test.ts`,
  `tests/progression/wrapWorld.test.ts`, `tests/data/worldWrap.test.ts`; `python3 -I assets-src/tools/worldgen/selftest_wrap.py`.
- **Act 1** is generated with the rest round its pins: `layouts/a1/world_a1_pins.py` (the source since NW-5; derived
  by NW-3 from pass W's world) holds every act-1 site, door, gate, patch cell, spot, object, inspect cell and road
  point **Cornelia-relative** (world = CORNELIA_NW + rel; pass W's cell + (54, 44)), and `a1/world_a1_checks.py` its
  promises (the bridge the only way off the peninsula, the tomb only over the east footbridge, Pravoka's channel, 2
  key-item gates, the walks within +-10 % of pass W's: 22 / 23 / 59 / 39). Act 1's encounter tables stay in
  `overworld_zones.py` (the fields, the map default) and `a1/world_a1_zones.py`; its zones' cells are
  `a1/world_a1_nw.py`'s.
- **Regions** (`world_api.REGIONS`; prefix): `a1`, `elf`, `ert` (EARTH), `fir`, `ord`, `wat`, `wnd`. A region owns
  content, not ground: its spec `world_specs/<region>.py` (continent polygons, ridges, wall lines, passes, corridors,
  roads, climate hints, islands, pins, spots) and its `content(g, meta, ctx)` hook (objects, inspect, NPCs, zones,
  backdrops; `world_content.py`). Each land cell belongs to its continent's region, each sea cell to the nearest
  land's (`worldgen/owners.py`); the source carries `regions.<r>.raster` (the chunks holding r's cells) and
  `world.py --owned-chunks <r>` lists them. Pass W's door offsets of the regions outside act 1 are frozen in
  `world_specs/today_doors_data.py`. Two seas: the inland `aldi` (docks `a1_pravoka`, `elf_port`, `ert_dwarf`) and the
  `ocean` (`ert_melmond`, `fir_crescent`, `fir_ice`), joined by the `canal` patch (CANAL_OPEN, a saddle across the
  isthmus).
- **The composer.** `python3 -I assets-src/tools/layouts/world.py` (`--metrics`, `--json FILE`, `--check`, `--out
  FILE`, `--owned-chunks <r>`) merges the specs, runs `tools/worldgen/compose.py` (shape, relief, hydro, climate,
  stamps, roads, finish (seal, jogs), owners) at preset B, seed 1987, places the content, resolves the spots, applies
  the step-mean scaling (`world_balance.py`, below) and writes `assets-src/maps/overworld.yaml`. It prints one line per
  check of plan 3.8 and exits 1 on a failure: `world`, `basins` (aldi .., ocean ..; canal joins), `docks`, `walls`
  (W_west, W_isthmus, W_arm, W_south, W_east with their minimal water cuts), `barriers` (`spine`, `western_range`,
  `duergar_range` and `ice_neck` by foot and canoe, `crescent_ring` and `ice_ring` by foot; minimal cuts >= 3),
  `routes` (the pinned canoe rivers; no unpinned river crosses a foot-only ring), `north` (the north continents are
  their own walk+canoe components), `landings` (grass only; every airship-only anchor has one within U 50 steps in its
  mode), `straits`, `prewalk` (S0-S14: every required entrance on foot from the stage's starts), `act1`, `walks`,
  `detours`, `pins`, `coverage` (every walkable / canoe cell in a zone of its owner region; act 1's fields are the map
  default), NW2's `canoe_gates`, `gorges`, `relations`, `duergar_south`, `hikes`, `dock_towns` and `taiga_share`
  (below), then G-NW1 (no straight coast run over 6), G-NW2 (coast index >= 30), G-NW3 (no land-class run over 6 on a
  chunk line), land (in [26,000, 31,800]; 26,948 at NW2-INT, near the floor), the exemptions (cap 600; 440) and the
  jogs. A failure names its rule, region and cells. Selftests: `python3 -I
  assets-src/tools/worldgen/selftest.py` (synthetic specs, locality, determinism, NW-0's gates on the world) and
  `selftest_gates.py` (each check fails on its mutated fixture). Snow `n` and taiga `t` (TerrainType 13 / 12; D-NW9, D-NW2-4):
  walkable (taiga at forest's speed), no ship or canoe, the airship lands on grass only (`fieldRulesVehicles.ts`).
  NW2-T: taiga where `cold > T_TAIGA` (0.25, `worldgen/climate.py`) plus `cold` hints (WATER, WIND); `world.py`'s
  `taiga_share` gates it at >= 30 % of WATER / ORDEAL / WIND walkable non-snow land (`TAIGA_MIN`). Art (AR-T2): the
  AR sheet's `taiga` (lifted out of the near-black) and `snow`, with `conifer_clump` edges (the build_map fallbacks
  and `_speckle` are retired); 1x `tiles_cold.taiga`; battle backdrop `dark_forest`; a `tundra` backdrop key is refused.
  Taiga's share at NW2-INT: 34.5 % (1,903 of 5,514 cells).
- **NW2 geography (`docs/NW2_EDITS_PLAN.md` 4-7; the checks run only over the records the specs declare: `Gorge`,
  `Hike`, `Relation`, the barrier seeds).**
  - **Gorges (D-NW2-2, -3).** Gurgu `fir_volcano` (177, 203) is reached only by canoe from Crescent's dock: Crescent
    Lake, then the **Cinder Gorge** (R-volcano, 51 route cells, walled by the Cinder Wall ridge; 54 forced canoe steps,
    39 pass cells, E_canoe 2.16). The Ice Cavern `fir_ice` moved to the tip of Crescent's peninsula (214, 108), inside
    the foot-only `ice_ring` (the Rime Hollow, snow floor); the ship sails up the western channel to the new ocean dock
    `fir_ice` (205, 119) on the Frost Shore (zone `fir_tundra`), then the canoe climbs the **Rime Gorge** (R-ice, 47
    cells; 47 forced canoe steps, 32 pass cells, E 1.88) to the Rime Tarn. `ice_neck` closes the peninsula south of the
    tip on foot and canoe. `gorges` needs >= 26 forced canoe steps (M), >= 12 pass cells (N) and E_canoe >= 1.0 (the
    canoe's 0.5 rate counted, so `fir_rivers` is capped at 0.75); `canoe_gates`: neither site on foot from any start,
    both by foot+canoe, `fir_ice` not without its dock.
  - **Mount Duergar (R3).** The dwarves `ert_dwarf` moved north of the canal into the mainland's west lobe
    (100, 121); its Aldi dock `ert_dwarf` moved too (106, 121). `duergar_range` (x about 108-114, y 96-117, the north
    coast to the Aldi) walls the lobe off from Matoya on foot and canoe; `duergar_south` proves the lobe and the keep
    apart with the canal patch off. The old south isthmus is empty EARTH land; its cove is closed. S4's and S10's dock
    `nonLoadBearing` entries are gone (both docks are load-bearing); GT-42 proves the range (proof (e)).
  - **Dock audit (R4).** `dock_towns`: each town that needs a dock (no airship by its `bandStage`, its gate not on foot
    from Cornelia) has one in a basin the ship reaches then, its gate within 12 steps: elfheim `elf_port` 9, dwarf
    `ert_dwarf` 7, melmond `ert_melmond` 3, crescent `fir_crescent` 1.
  - **Hikes (R5, D-NW2-1/9/12).** Five northern sites have no landing within K 25 steps (foot+canoe) and one within
    U 50 in their mode (`world-anchors.yaml` `hike:`, read by both sides): Onrac and the caravan share the south-coast
    meadow (`wat_s_onrac_airship` (53, 85), `wat_s_caravan_airship` (52, 85); d 27 / 34 and 26 / 35), the waterfall the
    east downs (`wat_s_waterfall_airship` (85, 55), canoe mode, 26 / 35), the Mirage a north oasis in the sands
    (`wnd_s_mirage_airship` = `wnd_s_sky_airship` (191, 43), 32 / 34), Lufenia the east coast (`wnd_s_lufenia_airship`
    (243, 70), 27 / 31). `worldgen/hikes.py` fills the grass inside the floor (taiga, sand, swamp or forest by climate)
    and stamps the landing meadow; `hikes` checks d and E_hike >= 1.0. Gaia, the Citadel and Bahamut keep their
    landings (the Citadel's meadow is stamped).
- **Compile.** `python3 -I assets-src/tools/build_map.py overworld` (under the world-compile lock, one at a time;
  NW2-INT: 236 s, peak footprint 14.6 GB; AR-T2 (the ecotone painter): 335 s, 15.0 GB) writes the 256 chunks
  (palette-indexed PNGs, `build_map.save_chunk`: 38.8 MB at AR-T2, 43.9 MB of RGB before), the patch overlays and
  the Mode 7 atlas (`mode7.png` 3072x3072 at 12 px per cell, `mode7_low.png` 2048x2048 at 8 since WR, a power of two; the runtime and the dev pilot read `cellPx` from `mode7.json`).
  A map over 192x192 cells is painted in bands of 64 rows (`build_map.BAND_*`, byte-equal by chunk locality). Gates:
  `build_map.py --check-determinism --changed overworld` (TS-D; the full `--check-determinism overworld`, about 7 min
  and 13 GB, is the fallback and the integrator's `--full`), `mode7_atlas.py --check-determinism overworld`, and re-running
  `world.py` leaves `git diff --exit-code assets-src/maps` clean. A source with rasters compiles in **chunk-digest
  mode** (`terrain/region_chunks.py`): `build.chunks` per chunk; `--region r` repaints r's raster plus every chunk
  whose digest differs from the base's (at most `PAINT_LIMIT` 160 painted chunks, ring included). The compiled map's
  `build` also holds `runtime` (Python, Pillow, numpy) and `compiler`, the digest of the **compiler closure**
  (`terrain/closure.py`: every module under `assets-src/` a compile loads, with the lazily imported ones of
  `LAZY_IMPORTS`; a compile that loads a module outside the pre-compile closure fails, so add it there), the runtime
  and the kit art.
- **Terrain painting (AR-T2).** `tools/terrain/` paints the organic ground from the AR sheet (`kit.AR_SHEET`;
  `ecotone.tex_name` prefers `ar_<m>`, then the kit's own, then a fallback such as `beach` -> sand, so placeholder
  kits still compile). The partition is unchanged except the clamped cell core, now a disc of `CORE_R` 9 px
  (`base._core`; the metrics still read the 28 px square). On top: `@b` macro textures by low-frequency noise
  (`ecotone.macro`); water by depth (`water.depth`: shallows -> deep in clustered steps, foam at 2.2 px, a 3 px bank
  shadow under N / W shores; the sea draws `shallows` / `ar_ocean`, rivers and lakes the calm `water_calm_shallow` /
  `water_calm`, handing over to the sea's colours within 2 cells of it); a beach on grass / sand / swamp meeting the
  sea (none on snow); the land ecotones of `bands.py` (dry grass and tufts at the desert, drifts at snow and taiga,
  scree at the mountain foot lifted to the ground's luma (W14), a mud fringe at swamps), 4 px earth banks; cold
  ranges (mountain cells within `bands.COLD` 6 cells of snow or taiga) in `mountain_cold` and `_cold` peak variants
  (`kit.RECOLORS["cold_rock"]`); `conifer_clump` taiga edges, `ar_tree_clump` forest edges; the lit NW rim and the SE
  shadow on mountain and taiga; every px snapped to 15 bits. Band noise is evaluated on each band's bounding box
  (`ecotone.band`), so the painter stays local (the region and chunk-digest selftests pass unchanged). Retunes: the
  selftest's `classify` / `foothill_share` take `organic` (the classic comparison reads the kit's own textures) and
  read every texture the organic painter uses (`metrics.textures`); the W14 dark-px case runs on the scree band (the
  Bayer foothill haze, `sand_band` and the old beach / bank / shallows code are gone); no threshold changed.
- **Progression.** `assets/data/quest.yaml`: the goal CHAOS_DEFEATED, stages S0-S31 (S19 and S31 optional), each with
  `after`, `requires`, `grants`, `boss`, `band`, `kit` (kits.yaml), `maps`, `zones`, `grind`, `walk`, `entry`,
  `milestones` and `nonLoadBearing`, plus the 8 shop `towns` (`opensAfter`, `bandStage`, `kit`).
- **Spots (NW-1, plan 5.2).** World-map places are names, never raw cells: the world source and the compiled map
  carry `spots: {<prefix>_s_<name>: {at: [x, y], kind: land | dock | landing}}` (pins of their regions;
  `map_checks_spots.py` checks the kind). quest.yaml's `entry` and vehicles on `overworld` use `at: <spot>` (the
  schema refuses x / y there) and its `nonLoadBearing` there `ref: <dock | gate | npc | patch id>`
  (`questSpots.resolveQuestPlaces`); scenarios use `spot:` and vehicle `at:`; `set_vehicle` takes `at:`. A new world
  place needs a spot in its region's spec. Tests read places by spot or record (`tests/helpers/worldSpots.ts`:
  `spot(map, name)`, `worldSize(map)`), never by a literal world cell.
- **The step-mean scaling (NW-5, plan 4.4 lever 1).** `layouts/world_balance.py`: one factor per world zone on the
  map's rate (10-22 steps), fitted from the curve model's witnesses of pass W's world and the NW world so each
  stage's walk earns pass W's xp again (factors 0.67-2.25; the method and the table in the file and in plan 16). No
  enemy, table, item or formula changed. NW2-BAL re-fit it on the NW2 world (`wat_sea` 2.25, `ord_heath` 1.4,
  `fir_tundra` 2.0, `wnd_mirage_sands` 2.1) under the `CAP` dict that `apply` asserts (`fir_rivers` 0.75 for E_canoe;
  `wat_isles` 2.0, `wat_streams` 2.0, `wnd_lufen_moor` 1.9, `wnd_mirage_sands` 2.1 for E_hike), and lowered two
  `grind`s (S16 2.0 -> 1.5, S17 4.0 -> 3.0; D-NW2-10: 0.5 steps, never below 1.0); every stage is within 0.11 of
  NW's level. QW2 (user ruling 2026-11-22) moved Sarda's cave to the south cape (door (52, 192), anchor `sarda`
  ref (-109, 44), target (52, 193); 42 steps from the giant's west mouth, was 5) and re-balanced it with
  `ert_sarda_coast` 0.67 -> 2.25 and S12's `grind` 7.0 -> 5.0 (every stage within 0.07 of its level before the
  move; `docs/NW2_EDITS_PLAN.md`, "QW2 result"). Re-fit after a change that moves the witness's walks a lot.
- **The verifier** (`src/progression/`, CLI `scripts/quest-verify.ts`): a state search over flags, key items,
  vehicles and places, firing the field rules the game runs (`src/systems/fieldRules.ts`). Proofs (a) order, (b) no
  skip, (c) no soft-lock, (d) bands (the curve model's whole-party level at each boss in its `band`, up to the top
  level + 1; kits affordable; (d3) every `takeGold` price at most 80 % of the stage's starting gold), (e) early shops,
  (f) price walls (Crescent, Gaia), (g) geography (the anchors of `assets/data/world-anchors.yaml` within the fitted
  scale [0.75, 0.95], distance, bearing and detour bands), (h) the travel matrix (rows T0-T10, T6b, the two basin
  rows; the seeds from the map's `world.basins`; T6's landing is a BFS in the anchor's hike mode, bounded by U; WR:
  `WRAP`, `questWrap.wrapInvariant`, the flat and wrapped labellings of walk, walk+canoe and ship equal, the line ends
  `; WRAP OK` on a wrapped world). WR: every neighbour loop steps through `worldWrap.stepTo` / `stepIndex`, so routes
  cross the seams; (g) stays planar; (d)'s line reports each stage's seam crossings and late-sea cells (`seam: ...`).
  `--mutate` adds the no-skip mutation suite (GT-1 to GT-37 + GT-5b and NW2's GT-40 to GT-43, `questMutateRows.ts`,
  and the generic elements); an uncaught element needs a `nonLoadBearing` entry (GT-43, `ice_neck` opened, is one by
  design).
  `--from-reset` (NW-5, `questReset.ts`) runs proof (c) again from every stage's save-reset state (the party at
  `cornelia` on foot, the vehicles of `worldReset.resetVehicles`) and from 50 seeded mid-stage samples per stage.
- **The curve model** (`questCurve.ts`, `questExplore.ts`): no battles. It walks the witness of (a); each route cell in
  an encounter zone adds `1 / mean steps` fights (the zone's `encounterRate`, else the map's) times the mode's rate and
  the stage's `grind` (1.0-7.0), and the first time the walk enters a map other than the world map it explores it once.
  `tests/balance/questCurve.test.ts` replays its `segments` with seeded battles (each boss in its band, Chaos's door
  in [38, 41], wipes per stage).
- **Commands.** `npm run quest` (assume mode), `npm run quest -- --strict` (every proof), `--mutate` (the mutation
  suite: the integrator's, once per batch; parallel, `--jobs N` (default min(6, cores - 2); `--jobs 1` is the serial
  in-process reference), about 16 min at 6 workers and 11.6 GB; it reads and writes the mutation cache, `--cache
  use|refresh|off`, `--audit N|all`, and prints `mutate: N jobs on W workers, wall S s, cache <hit|stored|miss>
  <fp12>`; one pool per machine (`/tmp/ff-game-quest-mutate.lock`); `QUEST_MUTATE_JOB_LOG=FILE` writes each job's
  wall time and peak heap; agents may run it when they edit a gate row or `nonLoadBearing`; its test,
  `tests/progression/questMutateWorld.test.ts`, is the heavy tier), `--from-reset`, `--stage S11` (from the stage's
  `entry`, with its ancestors' grants), `--only abc`, `--json FILE`, `--maps DIR` (a scratch compile's maps first),
  `--anchors FILE`, `--worst-canoe` (rows T0-T4 again with the canoe). The search stops at `MAX_STATES` = 3,000,000
  (`questSearch.ts`; the state key is compact: flag and item bitsets): the full NW2 graph is 835,121 states (NW's was
  1,348,366; `--stage S30`'s 2,096,640 at NW); `npm run quest -- --strict` takes about 2 min (115 s, 3.0 GB at
  NW2-INT) and runs with an 8 GB heap.
- **Saves (NW-5, plan 5.3, D-NW8; NW2-S).** `SAVE_VERSION` 5 (`NW2_SAVE_VERSION`; `NW_SAVE_VERSION` 4 is the first
  NW world; v1-v5 read, a v5 save loads as saved). A v1-v3 save is reset by the pure `resetSave` of
  `src/systems/worldReset.ts` (`LoadedSave.reset`): on the world map, or owning the ship (`BIKKE_DEFEATED`) or the
  airship (`AIRSHIP_RAISED`) wherever it is (Q4a), it loads at Cornelia's world entrance on foot (`LoadScene` sets
  `game.pendingEntrance = 'cornelia'`); its world-map vehicles become `resetVehicles(flags)` (the ship at the
  `a1_pravoka` dock spot, the airship at `a1_s_airship`); flags, party, items, gold and the rest are kept; the field
  shows "The world has changed. You stand before Cornelia." once. A save that owns neither and is inside another map
  keeps its place. Tests: `tests/systems/saveWorldReset.test.ts` (the 8 cases), `worldReset.test.ts`,
  `tests/progression/resetStates.test.ts`.
- **NW2 saves (NW2-S, `docs/NW2_EDITS_PLAN.md` 12, D-NW2-11: targeted, not a reset).** A v4 save loads as saved,
  marked `revalidate`; `LoadScene` (async; `busy` while it loads) reads the world map and, for a save inside a map,
  its way out (`wayOutSearch`: a BFS over open transitions to a world-map entrance, chains up to 8 maps) and runs the
  pure `revalidateNw2` (`src/systems/worldRevalidate.ts`, host `src/scenes/save/loadRevalidate.ts`): a ship off open
  water moves to an open dock in the party's component (foot, plus canoe with the canoe item), else the nearest; a
  party inside a map whose way out reaches no ship shore, airship or Cornelia gets its ship at that component's dock;
  an airship on rock or water moves to the nearest landing in the component, else `a1_s_airship`; canoe mode off
  River / Lake walks; a cell that admits neither mode, or a stranded component, takes the D-NW8 reset. `--from-reset`
  adds three relocated v4 saves (`questResetNw2.ts`: S10 in `dwarf-hall`, S16 in `ice-cavern-b1`, S6 at the keep).
  Tests: `tests/systems/worldRevalidate.test.ts`, `tests/scenes/loadRevalidate.test.ts`, `resetStates.test.ts`.
- **Cardia Deep (pass CD, `docs/CARDIA_PLAN.md`; brief `docs/DRAGON_CITY_BRIEF.md`).** Cardia works as in classic
  FF1: a cave on Bahamut's isle and on the north, east, stack and west islets (`ordeal/world_ordeal_nw.py` `_mouth`,
  `DOOR_ISLES`; the hermit's islet has none, ruling R1), each a door one step north of its entrance into **one** map,
  `cardia-deep` (72x60, `layouts/ordeal/cardia_deep.py` + `cardia_people.py`): five wild warrens (zone
  `ord_deep_warrens`, the old cave's `CAVE_FIGHTS` at 24-36 on 198 walkable `%` cells) through ward arches into a
  quiet village of nine districts round the Wyrmhall, Bahamut's Court at the top of the Processional; every stair
  leads back to its own islet, and the Sea Gate stair to `ord_bahamut` is the map's first transition (NW2's
  `wayOutSearch` takes the first). The doors come from `world_specs/later_doors.py` (`DOORS`, and `RETARGET` re-points
  pass W's frozen Bahamut door; `today_doors_data.py` stays frozen), the landings are the spots
  `ord_s_{north,east,stack,west}_airship`. `bahamut-cave` and `bahamut-lair` are retired: a save inside one loads at
  `cardia-deep` `bahamut_gate` / `court` (`src/systems/retiredMaps.ts`, applied first in `SaveManager.load`; a v1-v3
  save that owns the airship still takes the D-NW8 reset). S19 is unchanged but for `maps` / `walk`. Airship only (S17
  on). Previews: `?mute=1&scenario=cd_court | cd_isles | cd_warren` (and `w_ar_lair`, `w_ar_ember`). Tests:
  `tests/quest/ordeal/ord_o_sites.test.ts`, `ord_o_world.test.ts`, `tests/systems/retiredMaps.test.ts`.
- **Tests of the world.** Act 1: `tests/quest/a1/` (`a1Pins`, `a1Sites`, `a1Walks`, `nwA1.ts`), the regions
  `tests/quest/<r>/<r>_o_world.test.ts` (FIRE's `fireWorld.test.ts`) on the committed source and its owner grid,
  `tests/data/worldSource.test.ts`, `worldGates.test.ts`, `tests/progression/worldAnchors.test.ts`; NW2's
  `tests/data/canoeGorges.test.ts` (the gorge figures with the canoe's rate) and the hike d / E checks in
  `tests/quest/water/wat_o_world.test.ts` and `tests/quest/wind/wnd_o_world.test.ts`; FX-S's
  `tests/data/northHikes.test.ts` (`world.py`'s `hikes` line: K 25 / U 50 from `world-anchors.yaml`'s `hike:`, the
  five sites' floor and cap) and `tests/data/dockTowns.test.ts` (`dock_towns`, re-derived from quest.yaml, plus plan
  6's other dock sites, `fir_ice` canoe-only through its own dock), both over `tests/helpers/worldGrid.ts` (the
  source's ground with `gates.with_patches`' patches, BFS) and each failing on a mutated world or input. Pass W's world
  source and anchors are frozen in `tests/fixtures/passW/` (never edit them): the act-1 pins and the regions' kept ids
  and rosters are compared with them.
- **Landmark art** below gives pass W's cells for the icons; on the NW world each icon is placed by its door offset.
- **Landmark art (LM-INT, LM4-INT, LM5-INT).** Every `kit.py` LANDMARKS entry has approved Bedrock art, from three
  sheets (`kit.LANDMARK_SHEETS`): `gen/approved/overworld/landmarks_lm.{png,json}` (passes LM / LM2),
  `landmarks_lm4.*` (pass LM4) and `landmarks_lm5.*` (pass LM5: the Western Keep and the Citadel of Trials); cells
  `<name>_icon_<r>_<c>`, 48 px; per landmark the render's cache key, model, seed, pass and the cut and pixelize
  settings. All are re-cut offline from the render cache by `python3 -I assets-src/gen/landmark_cut.py`
  (`SPEC` / `SPEC4` / `SPEC5`; `--check`: every committed sheet rebuilds; `landmark_pix.py` holds the cutter, with LM4-INT's
  `sea_y` (the painted sea round a town's walls) and `drop` (fractional rects cut away, Pravoka's pier), and WL's
  `oval` / `oval_top` (the ground outside an ellipse round a walled town, below a row, is cut away: Melmond's and
  Crescent's renders run their ground off the frame, which left the icons flat-cut; `tests/data/wlArtFixes.test.ts`
  fails on a straight edge over a quarter of a town icon's height)). The renders
  are not tracked: copy `assets-src/gen/cache/<key>.png` from the main checkout into a worktree first.
  `kit.load_kit` puts their cells over the code-drawn placeholders in **every** kit; the placeholders remain only as
  the fallback while a sheet is missing. LM-INT added the 1x1 `tuft` (Gaia's fold; the `tuft` part stays the
  compiler's grass speckle). LM4-INT added the town icons `town_melmond` 4x3 (x 38-41, y 111-113), `town_onrac` 5x3
  (26-30, 36-38), `town_pravoka` 3x3 (130-132, 98-100; user ruling 2026-11-19, WORLD 2.5), `town_elfheim` 3x3,
  `town_crescent` 3x3, `town_gaia` 3x2 (150-152, 12-13) and `lufenia` 4x2 (150-153, 44-45; it replaced the two
  domes), the boats `brig` 4x3 (Pravoka (34, 35)), `fishing_boat` 3x2 and `submarine` 4x2 (Onrac (14, 37), (39, 26)),
  and `bell_tower` (Onrac), `lighthouse` (the world (138, 98) and Pravoka (41, 10)), `mirage_tower`,
  `standing_stones` (the Circle's islet) and `hermit_hut`. A town icon covers its whole ICON box with
  `collide: alpha` and its door as a `walk_cells` cell; where the art's cell beside a door is near-empty sky, a
  `tree_clump` part stands in it (Elfheim's top corners, Melmond's top-right) so the door keeps one way in (OW-2).
  WL dropped the two windmill decos beside Gaia's icon (it draws its own windmill); a `tree_clump` deco
  `gaia_door_west` (149, 13) blocks the door's west side.
  QW (playtest 2026-11-22): Melmond's door is the icon's east cell [3, 1] while its art's wall gate faces south, so
  `earth/world_earth_nw.roads` lays worn dirt tracks (ELF's router `elf/world_nw_road.route`, round the objects;
  `ROAD_CHAINS`): from the east gate (82, 158) south to (82, 161), west under the south wall to the giant's east mouth
  (68, 158), and south-west to the Cavern's mouth (70, 176); a `signpost` deco at (81, 160) points east to the gate
  (inspect: "MELMOND. The way in is the east gate, by the harbour."). The tracks are EARTH's own road network
  (`road_islands`: the gate cell); the door keeps its single way in.
  The generic `town_icon` is no longer placed anywhere, and `buried_hull` is only FIRE's airship hull. Recolours
  kept: tower `slate` (the watchtower beside the Western Keep), tent `dune` (the caravan camp), windmill `stone` (Melmond), cave_mouth
  `snow` (the Ice Cavern); LM4-INT dropped tower `bright` / `stone`, buried_hull `slate`, shrine `pale_stone`, the
  hermit's tent `dune` and Elfheim's `elf` roofs (each item has its own art now). The approved icons leave their top
  rows mostly sky, so tall landmarks use `collide: alpha` (the overworld's `art_coverage` check fails on a blocked
  cell with under 25 % art).
- **Ambient effects (LM-INT).** A map source's `ambient: [{kind: smoke, x, y, ox, oy}]` (cell, art px 0-47 inside it;
  `build_hooks.ambient` checks and copies it, `schemaValidationAmbient.ts` validates it) is drawn by
  `src/scenes/exploration/FieldAmbient.ts` over the map and the characters: `smoke` is the steam billows of the
  Field engine notes ("Ambient smoke"). X  `ambient`).
- **Mode 7 far atlas (M7-1, `docs/MODE7_PLAN.md` 3.1).** Every full and `--region` world compile re-bakes
  `assets/maps/ai/overworld/mode7.png` (3072x3072 RGB, 12 px per cell on the 256-cell world since NW-5: `cellPx = 3072 // width`), `mode7_low.png` (2048x2048, 8 px per cell since WR: `POT_LOW // width`, a power of two that repeats and mips under WebGL1)
  and `mode7.json` (`version`, `cellPx`, `size`, `lowCellPx`, `lowSize`, `inputs` = the sha256 over the 256 chunk
  files in `art.below` order) through `build_hooks.bake_mode7`, called in `build_map.write()` right after
  `bake_patches` (only for `MODE7_MAPS` = `overworld`, so the selftest worlds bake none). The baker,
  `assets-src/tools/mode7_atlas.py`, box-averages the below chunks (4x4, 8x8 at 12 px per cell; integers, round half up), adds no
  border and refuses a world whose 4 edges are not all Water; the patches stay out (the runtime `WorldAtlas`,
  `src/scenes/exploration/mode7/WorldAtlas.ts`, draws them over it while their flags are set, builds the mips when
  `atlasMips` (WebGL2, or a power of two under WebGL1), samples it with `REPEAT` on a wrapped map (clamp-to-edge on a
  flat one; `atlasSize` rejects an NPOT atlas of a wrapped map under WebGL1 into the `failed` path), and frees the
  source image after the compose). Gates: `mode7_atlas.py --check-determinism overworld`
  (two bakes under PYTHONHASHSEED 0 / 1 into temp dirs) and `build_map.py overworld && git diff --exit-code assets
  assets-src/maps`; `tests/data/mode7Atlas.test.ts` fails on a stale atlas. Never hand-merge `mode7*.png`:
  recompile the world at the merge (risk R13). A by-hand bake: `mode7_atlas.py overworld [--maps DIR] [--out DIR]`
  (it takes the world-compile lock when it writes into the map folder).
- **Mode 7 flight view (M7-2, `docs/MODE7_PLAN.md` 4, 7, 8).** On `overworld` in the airship, `FlightView`
  (`src/scenes/exploration/mode7/`, no PixiJS) follows `game.fieldMode` through the states of `mode7Tilt.ts` (`off`,
  `loading` with its `takeoff` / `restore` reason, `tiltIn`, `flying`, `tiltOut`; the tilts since M7-4) and draws
  through the lazily imported `FlightRenderer` (far atlas strips, sky, ship, shadow, landing marker). The profile is
  `mode7Toggle.mode7Enabled`: `?mode7=0` / `?mode7=1`, then the GPU caps (`capsOf(game.app.renderer)`; a mock game has
  none, so older scene tests never load the renderer), then Config's "Airship view" (`Settings.airshipView`, default
  `mode7` since M7-3, D-M8; `?mode7=low` forces the low profile). A missing atlas logs one `console.error` and the
  flight stays top-down. `window.__mode7` reports the state, history, shadowCell, marker, GL string, the resident
  textures (`textures`: atlas, near detail, chunks, recentres, late draws, split row) and the steady-flight p95s (the
  upload frames left out, reported in `heavy`). Rules are unchanged: scene tests
  `tests/scenes/mode7/mode7Parity.test.ts`, `mode7Activation.test.ts` (harness `flightHarness.ts`, which `vi.mock`s
  `FlightRenderer.js`).
- **Mode 7 near detail (M7-3, `docs/MODE7_PLAN.md` 3.2, 3.3).** `NearDetail` draws the flight window (4x4 chunks at
  48 px per cell, 3072²; low 3x3 at 32 px, 1536²) into a render texture: the far atlas square as the underlay, the
  streamed chunks, the set patches; a recentre (the ship kept in the window's middle 16 cells, `flightWindow` in
  `chunkStreaming.ts`) or a patch flag change redraws it, a late chunk (`StreamedChunks.onChunkLoaded`) only its
  square. `GroundStrips` draws the far mesh down to the split (`D_SPLIT` 25, low 16; moved down past any row the
  window does not cover), 8 one-row seam meshes at alpha 1/9..8/9, and the near mesh; `FlightSky` adds the fog sprite
  (haze, alpha 0.6 to 0 over 120 rows under the horizon). While the view shows, `FlightStream` sets the streamer's
  window (`StreamedChunks.setWindow`: the window plus 1 chunk ahead, at most 25 / 16) and cap (`ChunkStreamer.setCap`,
  36 / 16, trimmed least recently wanted first), and the step hold reads the flight window of the target cell
  (D-M11); hiding the view restores the top-down window and the cap of 60. Tests: `tests/rendering/streamWindow.test.ts`,
  `tests/scenes/mode7/nearDetail.test.ts`, `flightStats.test.ts`, and the streamed parity variant.
- **Mode 7 tilt (M7-4, `docs/MODE7_PLAN.md` 4.3).** A take-off and a landing tilt for 42 frames of `dt` (700 ms,
  `TILT_FRAMES`; `t += dt / 42`, the first frame drawn at t 0 in, 1 out): `tiltParams(t, start, tileSize)`
  (`mode7Tilt.ts`, eased in-out) takes theta 90 deg to 18, kappa 0 to 1/600, h `f / tileSize` to 6, `back` 0 to 11.3,
  (cx, cy) from the hero's screen point in the live `Camera` (clamped at the map edges too) to the flight values, and
  the ship from its top-down foot to (960, 750); at t 0 the projection is the top-down camera's mapping, so the switch
  is pixel-identical (browser: 100 % of the field above the HUD band at the meadow and two clamped edges). While a
  tilt plays `FlightView.busy` holds the field (the one behavioural change; a held direction moves on the frame it
  ends), the marker hides, the shadow check holds; at its end `holdOff(TILT_HOLDOFF_FRAMES)` (8). The near mesh's
  square is open on the map's edges and rows wholly off the map are the far atlas's (`rowFits(..., map)`,
  `rowOffMap`), so the near detail draws by a clamped edge too; on a wrapped map (WR) there is no edge: no open side,
  no off-map row, the near window's rect is canonical with its image origin `ix0` / `iy0` nearest the ship (no recentre
  at a seam step), `NearDetail.wrapBoxes` splits its underlay at the seams, billboards stand at their image nearest P
  and the clouds read an odometer; the camera never clamps, so a tilt starts centred. Tests: `tests/scenes/mode7/mode7Tilt.test.ts` (the
  t 0 match corner by corner against a real `Camera`), `mode7TiltScene.test.ts`, the parity tests (each tilt 42 held
  frames, the end state equal).
- **Mode 7 billboards and clouds (M7-5, `docs/MODE7_PLAN.md` 5).** In flight the parked vehicles (the field's
  `vehicle:*` sprites but the airship's) and the map's NPCs (`FlightViewDeps.npcs`) stand up as billboards:
  `propMath.propSources` / `placeProps` (pure) put each field sprite at `cellToScreen` of its ground point, scaled by
  that row's px per cell over `TILE_SIZE` (so at a tilt's t = 0 it is exactly the top-down sprite), cull it beyond
  `PROP_RANGE` 40 cells of P (fading over the last 4) and haze it through the fog; `FlightProps` keeps the sprites and
  `FlightBillboards` sorts them with the airship by depth (nearer than P in front of the hull). `FlightSky.clouds`: the
  4 clouds of `cloudMath.ts` (15-bit, binary alpha, a fixed height over the horizon, drifting and sliding with the
  ship's x), behind the ground. `window.__mode7.textures.props` counts the billboards drawn. Preview:
  `?mute=1&scenario=m7_parked` (the ship at Pravoka's dock, the tomb's chest and the bridge workers). Tests:
  `tests/scenes/mode7/propMath.test.ts`, `cloudMath.test.ts`, `flightBillboards.test.ts`, `mode7Props.test.ts`.
- **Airship views (AV, `docs/AIRSHIP_VIEWS_PLAN.md`; T-2 done).** The airship has a back 3/4 view (flying up / north, away from the camera), a front 3/4 view (down / south, toward it) and two turn in-betweens, besides b_7 (left / right). `src/scenes/exploration/airshipHeading.ts` is the pure model (`boardHeading`, `nextHeading`, `headingFrame`; `TURN_MS` 100: the turn frame shows between the side and an end view that lean the same way; a left / right flip and a back / front swap are instant; the end views lean toward the last side facing, mirrored for left). Its one owner is `FieldVehicleSprites` (`noteHeading()` per frame from the ridden hero; `FieldVehicles.airshipHeading()` / `noteHeading()` forward it): the top-down view and the Mode 7 flight (`FlightBillboards`, `ShipDraw.heading`) draw the same frame, so a tilt's t 0 matches. D-AV10: the heading takes the hero's direction only when it changes or a step starts, so boarding (a confirm on the airship's cell) keeps the parked heading; a landed airship keeps its heading for the session (not saved). The shadow follows the drawn frame (w 0.6 of it, h 8 side / 10 ends). A sheet without the frames shows b_7 for every heading. `window.__mode7.ship` = `{frame, flip, turning, end, side}` (`FlightRenderer.shipPick`). This supersedes D-M9. Previews: `?mute=1&scenario=av_flight` (in flight north of Cornelia), `av_headings` (parked by the south gate; `&mode7=0` for top-down). Tests: `tests/scenes/airshipHeading.test.ts`, `fieldVehicleArt.test.ts`, `mode7/mode7Heading.test.ts`, `flightBillboards.test.ts`, `mode7TiltScene.test.ts`. `fieldStateOf` now lives in `src/scenes/exploration/fieldState.ts`.
- **Mode 7 fallbacks (M7-6, `docs/MODE7_PLAN.md` 7).** Context loss: `FlightRenderer` watches the canvas
  (`watchFlightContext`, `FlightContext.ts`); while the context is lost or the restore runs, `FlightView` hides the
  view and the top-down world shows; on `webglcontextrestored` the atlas reloads its freed source and recomposes
  (`WorldAtlas.restore`, which rejects on a failure) and the near detail redraws its window; a failed restore logs one
  `console.error`, sets `failed` and the airship flies top-down. The frame-time switch (`SlowRule` in `mode7Toggle.ts`,
  fed by `FlightStats`'s steady frames): the p95 of the last 120 steady frames above 20 ms for 120 steady frames in a
  row sets `slow` for the session (`slowThisSession`) with `console.warn`, and the view ends and frees its textures;
  `?mode7=1` / `?mode7=low` keep the view (they still warn), and choosing Mode 7 again in Config clears it. Tests:
  `tests/scenes/mode7/mode7Fallback.test.ts`. Browser check: `WEBGL_lose_context` (`loseContext`, `restoreContext`)
  on `app.renderer.gl`; a slow GPU can be faked from the page with a busy-wait `requestAnimationFrame` callback.
- **Mode 7 teardown (FX-S).** Pixi 8 draws every unbatched mesh without a shader of its own (the ground strips)
  through one shared shader of the mesh pipe, whose bind group destroys itself when the last texture source bound in
  it is destroyed; the next such mesh then throws "Cannot read properties of null (reading '0')" in
  `BindGroup.setResource` every frame (the crash on a scene change or a teleport mid-flight). So
  `FlightRenderer.destroy` (and `Mode7PilotScene.exit`) destroy the meshes, then call `releaseMeshTextures(renderer)`
  (`mode7/meshRelease.ts`: one unbatched `Texture.EMPTY` quad drawn into a 1x1 target), and only then free the atlas
  and the near detail. Any new unbatched mesh over a texture it frees must do the same. Tests:
  `tests/scenes/mode7/mode7Teardown.test.ts` (the real renderer over a stub that binds like `GlMeshAdaptor`),
  `mode7Activation.test.ts` (exit and enter mid-flight).
- **LM5-INT.** A third sheet `landmarks_lm5.*` (SPEC5, pass LM5): `western_keep` 2x3 at (59, 122) (door (60, 124),
  the stair foot at the bottom right; anchor `elf_keep` (60, 125); its top two rows on the watchtower's rock `m`, the
  moat at x 61) and `citadel` 3x3 at (74, 25) (door (75, 27) bottom centre; anchor `ord_citadel` (75, 28); the broken
  pillars at (73, 26) and (77, 26); its top row on the crag, rows 26-27 grass), both `collide: alpha`; the shared
  `castle_icon` is no longer placed on the world map. The keep is re-cut on a solid rock plinth: `landmark_pix`'s
  `solid_y` (below that row the figure is closed and its holes filled, then cut to the `oval` again), with a wide flat
  oval under the stair foot and `apron` 0.3. The NPC field sheets `approved/fairy/field.*` and
  `approved/mermaid/field.*` are LM5 Bedrock control-structure renders re-cut offline by
  `python3 -I assets-src/gen/npc_field_cut.py` (`--check`; LM5's sheetcut, then the post steps: the fairy pixelized
  at 2/3 scale, about 62 of a hero's 90 px, the down row's step_right = its step_left mirrored; the mermaid's back row
  remapped onto the front rows' teal ramp by nearest value); both walk with the default puppet boxes (no
  `gen/anim/<id>.yaml`: that directory is the hero classes', and the kneel tools read every file in it). The gen
  selftests check a `backend: bedrock` (or vehicle) approved json against the BR ledger
  instead of re-planning a Gemini request. Field previews: `?mute=1&scenario=w_lm5_keep | w_lm5_citadel | w_lm5_fairy
  | w_lm5_mermaids`.
- No placeholder NPCs left: the fairy (`sprite: fairy`, Gaia's spring) and the sea-shrine mermaids (`sprite:
  mermaid`, all four on `sea-shrine-b1`, the elder included) have their own sheets, untinted.
- **AR NPC sheets (AR-N, AR-N2; user rulings 2026-11-21).** 11 more field sheets from AR Stability
  control-structure renders (purpose `ar_npc`), re-cut offline by `npc_field_cut.py` (`--check` rebuilds all 13 with
  the fairy and the mermaid; `--only id[,id]`; `--raw DIR` writes each sheet before and after its edits): Lufenia's
  `luf_citizen_m`, `luf_citizen_f` (A's down / up rows, B's side row, one palette) and `luf_senator` (the elder, the
  archivist, the orrery tender), the lair's `dragon_guard` / `dragon_elder` / `dragon_youth` (two each), the Circle's
  `sage_star` (`sage_east`), `sage_earth` (`sage_moss`), `sage_flame` (`sage_ash`), `dr_unne` (`ert_unne`, Melmond)
  and `robot_sentry` (two flavour-only NPCs on `sky-castle-1f` / `-2f`), all untinted, each with a 1x `Look` in
  `characters.py`. **`sage_star`'s side row turns the head but does not walk: never give it `wander`** unless the
  side row is regenerated (`tests/data/arNpcArt.test.ts` checks it). The AR entries live in `gen/npc_field_ar.py`
  (`AR_SPEC`, merged into SPEC) in the `cells` format of `gen/npc_field_edit.py`: per-cell picks with a mirror flag,
  per-row pre-quantize hue shifts, per-render `cut` (`tol` flood tolerance, `holes`: enclosed background areas of
  >= 400 render px cut away), and post edit steps `erase` (rects, re-outlined), `ramp` (recolour the colours that
  pass a hue / sat / value predicate onto a target ramp of the sheet's own colours, `nearest` or `rank`), `fill`
  (see-through holes) and `patch` (15-bit pixels); each step's colour map is logged in the sheet's json `edits`.
  **AR-N3 (user ruling 2026-11-22):** the ancient robot `robot_ancient` is AR-N2's candidate C2: A's down row and
  back strip (green shifted to verdigris) with a true-profile walking side strip (`robot_ancient3_v1_d65_3`, flood tol
  34, holes 40; its orange accents shifted to rusty bronze, hue 32 -> 24, val x0.62); an entry's own `approved` date
  overrides `APPROVED_AR`. Two flavour-only robots (a line each, no action, flag or `wander`): `wnd_ancient_archive`
  on `sky-castle-3f` (30, 19) and `wnd_ancient_stoker` on `sky-castle-4f` (31, 13), both off the required path; the
  sentries stay on 1F / 2F. The lair's dragon-kin lines fit their dragon-kin sprites (no "man's shape"). Previews: `?mute=1&scenario=w_ar_sky3 | w_ar_sky4 | w_ar_ember`.
- **Dwarf NPC sheets (pass DW, user feedback 2026-11-22: "dwarf NPCs needed for dwarf cave").** Eight sheets from
  AR Stability control-structure renders (purpose `ar_dwarf`, 33 of 40 used), in `gen/npc_field_dw.py` (`DW_SPEC`,
  merged into SPEC; the `cells` format): `dwarf_miner` (bronze helmet, teal), `dwarf_smith` (Smyth: bald, apron),
  `dwarf_elder` (white beard, blue robe), `dwarf_guard` (bronze helm, blue), `dwarf_woman` (copper plaits, green
  dress), `dwarf_child` (the woman's cells at 0.75 scale), `dwarf_trader` (green cap, backpack) and `dwarf_nerrick`
  (the canal foreman: wide hat, leather vest). Their guides are approved field sheets squashed to a dwarf's build
  (height x0.76, width x1.12) with a drawn beard hint, so the adults stand 65-73 px (about 3/4 of the hero's 86-90),
  the child 53-55. A cut option `scale` per render (`npc_field_edit`) cuts a 3x1 strip or a large front at the 3x3
  render's height. The flaws are fixed by recorded `ramp` / `erase` steps (helmets and hats matched across facings,
  the back strips' green moved onto the front's colours). Placed untinted (the ruddy `DWARF` tint is gone): all 14
  NPCs of `dwarf-hall` (Nerrick, Smyth, the elder and the scribe, two guards, four miners, the cook, the child, the
  Melmond hint and the store keeper as traders), `melmond_dwarf_trader` (Melmond) and `elfheim_dwarf_peddler`
  (Elfheim). Only the miner and the child `wander`; the smith's and the elder's side / back steps repeat their stand,
  so do not give those `wander`. Test: `tests/data/dwNpcArt.test.ts`. Previews: `?mute=1&scenario=w_dw_hall |
  w_dw_rooms | w_dw_forge`.

### Town themes (AR-W2)

**The reference for any future town art is `docs/TOWN_THEMES.md` with its concept art in `docs/art/town_themes/<town>/`**
(the user-approved theme per town: concept, 15-bit palette, building language, set pieces; Onrac and Gaia the main
concepts, their alternatives not chosen; Crescent's canals; Melmond's siege static; exteriors only so far). The cells
are re-cut offline by `python3 -I assets-src/gen/town_theme_cut.py` (`--check`; data `town_theme_spec.py`) into
`assets-src/gen/approved/town/theme_<town>.{png,json}`, and each town script applies its row of
`assets-src/tools/layouts/town_theme.py` (`roof=` / `wall=` theme styles, the themed inn and house prefabs, the set
pieces, Crescent's canals) before it writes its source. `build_map.styled()` looks up an approved `name@style` first;
`chimney@<roof>` replaces the chimney. Test: `tests/data/townThemes.test.ts`. AR-W3 redid Lufenia (`luf_roman`: a
modular terracotta roof every house width can use, gold-ribbed domed villas, the rotunda inn; `clean` repaints SD3.5's
wall cracks, `town_theme_clean.py`).

**Cardia Deep (pass CD).** The dragon great village under the Cardia isles has its own approved brief,
`docs/DRAGON_CITY_BRIEF.md` (concept, palette, architecture, districts, set pieces, NPC dress), with its concept art in
`docs/art/cardia/` and its implementation plan `docs/CARDIA_PLAN.md`. Its cells are the `dragon` sheet of
`town_theme_spec.py` (`theme_dragon`: `drg_*` set pieces, the `drg_wall` / `drg_floor` materials; cut option
`bg_passes` for a two-tone backdrop) and the `drake_brazier` prop (`props_ar`, purpose `ar_dragon`).

### New Cutscene

Cutscenes are scripts in `assets/data/cutscenes.yaml`, played by `CutsceneManager` (`src/systems/`) through injected `CutsceneDeps`.

- Steps: `dialog` (`text`), `fade_out` / `fade_in` / `wait` (`duration` ms), `set_flag` (`flag`), `heal_party`, `warp` (`map` plus a named `entrance` or `x`/`y`, optional `facing`; put it behind a fade) and `backdrop` (`image`: a staged background id, or `null` to clear; optional `dim` in (0, 1], e.g. the opening's first page at 0.35).
- `CutsceneRegistry` drops (with `console.error`) a script with an unknown step type, a `warp` without a map and place, or a `dim` outside (0, 1].
- A host without the `warp` or `backdrop` dep logs `console.error` and the cutscene goes on.

### Input Hold-offs

`InputManager.holdOff(frames, actions?)` spends the presses so far and makes `isJustPressed` false for `frames` updates (per action; a later call keeps the larger count). `isPressed` is unaffected. It is used at:
- **scene entry:** `Game` builds `SceneManager` with `onSettled` → `holdOff(SCENE_ENTRY_HOLDOFF_FRAMES)` (8), so one confirm press never reaches the next scene;
- **dialog close (field only):** `ExplorationScene`'s `DialogManager` gets `closeHoldOffFrames: DIALOG_CLOSE_HOLDOFF_FRAMES` (24, confirm only), so mashing after a talk doesn't restart it;
- **cutscene end:** field cutscene dialog steps take confirm at once (`holdOff: false`); the 24-frame confirm hold-off comes once when the cutscene ends.
- **controls hint (FX-R, P3-R1):** the first-run hint over the field (`ControlsHint`, until `ff1_controlsSeen` is stored) is dismissed by any key and the key still acts on that frame; it used to swallow the first press of a fresh browser (the airship did not land on the first confirm).

### Field engine notes (FX-C)

- **The wrap (WR):** on a wrapped map `PlayerController` steps to an unwrapped drawn target (-1 or W) and normalises
  tile, sprite and camera at the step's end (one period jump, invisible); `playerMove`, `gridX`, `targetTile` and
  `facingTile` are canonical. The camera never clamps (`Camera.setMapBounds(w, h, wrap)`). Each frame
  `ExplorationScene.update` restores, runs the field (`step`), then `WrapImages.apply` (`src/rendering/wrapImages.ts`)
  shifts every world child to its image nearest the camera by its bounds; the layers take the sentinels
  `WRAP_BELOW_Z` / `WRAP_ABOVE_Z` (D-WR-10). Chunks draw at their images (`chunkStreaming.rectChunks`), patches by
  `nearestImage`. A child that places itself in `onRender` must be skipped: the vehicle parts are
  (`FieldVehicleSprites.vehicleParts`, `setVehicleWrapOffset`; D-WR-9). Dev probe: `window.__field = { cell, mode,
  zone }` (`fieldProbe.ts`).

- **Encounter zone of a step:** `playerMove` fires before `FieldVehicles.afterStep` changes the mode, so `EncounterSystem.setStepModeResolver` (set by the exploration scene to `modeAfterStep` from the step origin) makes the lookup use the mode the step ends in. A canoe step onto a river cell rolls the canoe zone, not the walking zones with a hole. `tests/data/overworldZoneCoverage.test.ts` fails when a walking or canoe cell outside act 1 falls through to the act-1 table (the Water and Wind tarns have canoe zones `wat_streams` / `wnd_tarns`).
- **Flag-driven NPCs:** `ExplorationScene.refreshNpcPresence` follows `showIf` / `hideIf` as flags change (polled each field frame by a cheap signature, plus cutscenes and `onResume`); NPCs leave and arrive (`NpcPresence.ts`, `MapLoader.createNpc`, `MapLoadResult.npcDefs` = the whole NPC list). An NPC never appears on the hero's cell or the one about to be entered.
- **Ambient smoke (SMOKE):** a map's `ambient: [{kind: smoke, x, y, ox, oy}]` (validated by `schemaValidationAmbient.ts`; the volcano's is FIRE's content's, art px (26, 12)) is drawn by `FieldAmbient.ts` as `SmokeColumn`s (`src/scenes/exploration/smoke/`) in the style `VOLCANO_SMOKE` (`smokeStyles.ts`; the user's pick, option e of the SMOKE experiment): 7 white cauliflower billows with a dark outline, lit from the top left, r 10 -> 26 art px, rising 110 art px and spreading at the top on a 5.2 s loop, fading by a Bayer dither (binary alpha, 15-bit colours, whole art px). The shapes are `smokeShapes.ts`, the pure motion `smokeMotion.ts`; the bitmaps are shared `GraphicsContext`s built once per art scale, so a frame allocates nothing. Check it with `?mute=1&scenario=smoke_volcano` (Debug on the title screen).
- **Flame ambient (AR-P2):** `{kind: flame, prop, x, y, style?}` in a map source (the prop's top-left cell; `props_ar.place` writes them) is resolved by the compiler (`tools/ambient_flame.py`, from `build_hooks.ambient`) into `{kind: flame, x, y, ox, oy (the light's centre), style: fire | purple | green | cyan | lamp, glow (radius, art px), foot (the prop's bottom row), mask: {dx, dy, rows, tongue}}` (`schemaValidationAmbient.ts`); a source flame without `prop` takes `style`, `ox`, `oy`, `glow` and draws the glow only. `FieldAmbient.ts` draws each as a `FlameLight` (`src/scenes/exploration/flame/`): the flicker (the mask's flame pixels, ramp levels by brightness, step along the style's 4-colour 15-bit ramp by a per-frame noise per 2-px row; with `tongue` some columns drop their top 1-3 px inside the flame's top quarter; lava and embers only cycle the palette) and the glow (a 1.4:1 floor ellipse of two Bayer 4x4 rings, 8/16 inside 0.55 r and 4/16 out to r, fixed to the floor's art px grid, drawn additively with the style's fixed 15-bit lift, radius breathing +-12 %), 8 frames x 110 ms, each light on its own phase (`lightPhaseMs`). The glow sits under every character (zIndex 0); the flame sorts with the characters at the prop's foot. The frames are shared `GraphicsContext`s per mask, style and art scale (`flameMotion.ts` is pure), so a frame swaps two contexts and allocates nothing. The additive lift lands within 2 of 255 of the 15-bit grid (an add cannot snap). Tests: `tests/scenes/exploration/flame.test.ts`. Previews: `?mute=1&scenario=ar_flames` (Gurgu B3), `ar_marsh`, `ar_keep`, `ar_earth`, `ar_gurgu`, `ar_ice`, `ar_shrine`, `ar_sky`, `ar_mirage`, `ar_past`, `ar_citadel`.
- **Diagnostics** (`src/core/diagnostics.ts`): `?trace=1` (or `localStorage.ff1_trace = '1'`) logs every scene change, error, rejection, page unload and Vite full reload to the console and `window.__trace`; off by default. A lost WebGL context and a halted game loop always show a banner over the page. The dev server ignores `.claude/` (`vite.config.ts`), which stopped agent worktrees from reloading the page.

### Boosts (pass CHT)

Player-side "cheats" in the Pixel Remaster style: field menu > **Cheats** (QF, playtest 2026-11-22: the user looked
for "cheats" and missed the old "Boosts" label; the screen is titled "Cheats (Boosts)", its first rows read "Gold
multiplier" and "XP multiplier"; `src/scenes/BoostsScene.ts`, lazy `boosts`;
up / down move, left / right change and stop at the ends, confirm steps forward and wraps, cancel closes). Rules and
steps live in the pure `src/core/Boosts.ts` (no PixiJS); the values are `Game.boosts`.
- **Options** (defaults x1, Escape Off): Gold and XP multipliers x0 / x0.5 / x1 / x2 / x3 / x4 (the x0.5 steps go beyond
  the user's "x0 to x4"); Encounters Off / x0.5 / x1 / x2; Battle speed x1 / x2 / x4; Walk speed x1 / x2; Escape
  Off / On.
- **Hook points:** gold and XP in `BattleStateMachine.finish` (`BattleConfig.boosts`, `scaleReward` rounds down: x0.5
  of 7 G is 3 G; the victory line shows the boosted numbers, `BattleTrigger.onBattleEnd` grants them); the encounter
  rate in `ExplorationScene` (`EncounterSystem.setRateMultiplier(mode x boost)`; Off rolls no random battle, scripted
  and boss battles still start); battle speed as one time scale on `BattleScene.update`'s `dt` (messages, waits and
  animations); walk speed in `PlayerController.speedBoost` (on foot, ship and canoe; **not the airship**, user ruling
  2026-11-22: it flies at its own `AIRSHIP_SPEED` 3.0 x walking, `src/entities/AirshipMode.ts`, raised from 2.0 by QF;
  measured at QF on the M4 Pro: 15 tiles/s, top-down no placeholder chunk, Mode 7 full 0 late draws and frame p95
  9.8 ms, low 7 late draws as at 2.0, p95 10.1 ms); escape in the Run check of
  `BattleStateMachine.executeCommand` (certain, but `canRun` false still refuses: bosses, the Chaos form chain).
  `BattleTrigger` passes `battleBoosts(game.boosts)` in the scene config.
- **Storage:** per playthrough in the save (v3, `SaveData.boosts`, `parseBoosts`; a v1 / v2 save loads the defaults,
  a malformed value logs and takes its default). A new game (`Game.resetState`) starts from the defaults; a battle
  retry keeps them (`restoreState` without `boosts` leaves them, they cannot change in battle).
- **Indicator:** any value off its default shows `BOOST G x4 ENC Off ...` (`boostSummary`) at the bottom right of the
  field menu's party panel (`PartyPanel.setBoostTag`).
- **Verifier:** the progression verifier and the curve model (`src/progression/`, `questCurve.ts`) assume the default
  rates and never read the boosts; balance tests (`tests/balance/`) run without them. Leave them so.
- **Tests:** `tests/core/Boosts.test.ts`, `tests/battle/boostsBattle.test.ts`, `tests/systems/boostsSave.test.ts`,
  `tests/scenes/BoostsScene.test.ts`, `tests/scenes/boostsField.test.ts`. A game mock that reaches the field menu, the
  field update or a battle trigger needs `boosts: defaultBoosts()` (`createMockGame` has it).

### Game Over

`GameOverScene` offers **Retry Battle** and **Return to Field** (both restore the pre-battle snapshot `game.battleRetry`; Return to Field puts the party where the fight began with no battle queued), then Load Game and Title. With no snapshot only the last two show. `retryAdvice()` (`src/systems/BattleRetry.ts`) calls the party weak when anyone was fallen or under 25 % HP; then a hint shows and the cursor starts on Return to Field.

### Boss Forms and the Chaos Fight (pass C)

Chaos is a four-form fight (`docs/CHAOS_FORMS_PLAN.md`, rulings D-U2/D-U3; C7 fix round `docs/CHAOS_FIX_PLAN.md`):
one shared HP pool (**20000**, user ruling U-3, which overrides D-U3's 6000 and U-1's 12000) with form swaps at
0.70 / 0.40 / 0.15, F1 the Sovereign (`chaos`, the atlas sprite), F2 the Orrery (`chaos_orrery`), F3 the Last Horizon
(`chaos_horizon`) and F4 the Core Laid Bare (`chaos_horizon_core`, F3's art with `colossusVariant: {core: open}`).
- **Data:** `BossPhase.form` (the record to become) and `BossPhase.interlude` (a script id in
  `assets/data/battle-interludes.yaml`; a non-form phase may name one too: F3's 0.25 phase plays `chaos_crack`). Form
  records have `formOf: chaos` and no `num` (the bestiary lists them as sub-entries of Chaos), `colossus: <art id>`
  and, for F3 only, `slam: {targets: 2}` (one physical attack on two heroes; the `slam` AI action). Logic in
  `src/battle/bossForms.ts` (phase buffs removed, the queued Chaos command re-chosen), the single HP write path
  `enemyHp.ts`, and `slamAttack.ts`. A scenario `enemyAi` override is dropped at the first form change. Retry restarts
  at F1 (D-U8).
- **Floors and gated phases (C7, `CHAOS_FIX_PLAN.md` 2.4 M1-M3):** a boss phase is **gated** when it has `form` or
  `interlude`. Every gated phase has one rounding rule: its floor and its reach are both `f = ceil(t x pool)`, at
  t = 0.70 / 0.40 / 0.25 (F3's crack) / 0.15; at pool 20000 that is 14000 / 8000 / 5000 / 3000 (the current example
  only; the formula is the rule). While a gated phase is uncrossed, HP never drops below the floor of the highest one;
  the phase is reached at `hp <= f`. A reached form phase changes the form right after the action; a reached non-form
  gated phase (the crack) is crossed by `checkBossPhases` at the **next round start**, and only then does the 0.15
  floor apply, so the crack always plays before F4. Phases without an interlude keep `hp / pool <= t` (Garland, the
  Seraph unchanged).
- **Arrival turn (M6):** a form phase with `arrivalTurn: true` (only allowed together with `form`; F2-F4 set it) puts
  the new form's action at the front of the queue right after the change (re-chosen queued slots draw the RNG first),
  if a hero lives. So every form acts at once, even when it appears late in a round.
- **Round-start change (M4):** a form reached by a direct HP write is changed by `prepareRound` (no arrival); the
  result is the public getter `BattleStateMachine.roundFormChange` (cleared at the next `prepareRound`), and
  `BattleScene.executeRound` plays its interlude before the round's first announcement.
- **HP writes (M5 and 2.4):** `setEnemyHp` writes `max(hp, min(floor, currentHp))`: damage from above a floor stops
  at it, but a write never lifts HP up to a floor (C7-N1). Two semantics for probes: (a) a direct write
  `enemy.currentHp = n` (stress case: writing 1 at the command phase gives i1 at that round's start, i2 and the F3
  arrival after the first action, the crack at the next round start, then i3 and the F4 arrival, each once); (b)
  `setEnemyHp(enemy, n)` clamps at the current floor, so each nudge moves **one form**. Use (b) to step through the forms.
- **Run:** `canRun` is false for a battle with a form chain unless its `bossConfig.canRun` says otherwise
  (`BattleTrigger`, D-C7-6).
- **Stats (B3-20k, tuned by `tests/balance/chaos.test.ts`):** all four records hp 20000; defense 100 / 160 / 140 / 110,
  agility 22 (roster rule) / 160 / 160 / 160, attack 50 / 50 / 35 / 45 (F1 / F2 / F3 / F4; strength and vitality
  derived by the rosterData rule). Measured at level 40 (typical / aggressive policy): win 96.5 / 91.8 %, median 12
  rounds, every form acts >= 2 times in 99.5 % of wins, median party hit 577 / 568 (U-3 target >= 500). The level cliff
  (35 / 38 / 42 / 45) is reported, not pinned: at 42+ F1 mostly acts once.
- **View:** a colossus form bypasses the layout engine and draws in the `colossus` layer (between `bg` and `ui`,
  `BattleLayers`) through `ColossusView` / `ColossusPoseController` (`src/scenes/battle/colossus/`; timelines in
  `colossusChoreography.ts`: breathing, glow pulse 1 <-> 0.7, slam, beam, cast, hurt flash, dying). An invisible proxy
  at `targetRect` stands in for the enemy sprite (numbers, cursor, status row, fx, melee point). Interludes
  (`formInterlude.ts`: message, flash, shake, tint, fade, dissolve, swap, rise, pose, variant, pan) play at each
  change; while F3 / F4 show, the `bg` is dimmed to 0.6 (reset on victory, defeat, retry and the next battle).
  Textures load at battle start (`ColossusArt`, F2 released after its swap) and are destroyed at battle end.
- **Orrery orbits (EF-E):** F2's four orbs travel its two gold rings. Layer kinds `orb`, `orb_glow` (`<orb>_glow`,
  additive by kind) and `ring_back`; the yaml's `rings` (fitted ellipses: centre, axes, tilt, dir) and `orbits` (ring,
  phase0, period_ms; A 9 s, B 7 s, opposite ways) go into colossus.json (`colossusOrbits.ts`). Draw order: ring_back <
  far orbs (sin t <= 0) < body < near orbs < glow; the orbit clock holds while an interlude poses the form. The art is
  cut offline by `gen/colossus/chaos_orrery_orbs.py` (no model) from `_retired/chaos_orrery_v2`. Tests:
  `tests/scenes/battle/colossusOrbits.test.ts`, `colossusContract.test.ts`.
- **Arena:** `assets/backgrounds/rim.webp` (staged by `tools/stage_rim.py`; `rim_floor.webp` is committed but unused).
- **Scenarios:** `chaos_forms` (F1 -> F4; the `&chaos_party` anchor is a **level-40** party, user ruling U-2:
  KNGT / NINJ / MSTR / WWIZ, max HP 666 / 420 / 586 / 303), `chaos_final` (F3 alone, poison + blind preset for the
  status row; with `&enemyAnim=loop | step`), `chaos_interlude_1..3` (start on the form before interlude N; `&slow=N`).
  The debug key `enemyHp: {<index>: <fraction>}` starts an enemy at `ceil(fraction x stats.hp)`, a fraction of its own
  pool (an unknown index or a fraction outside (0, 1] logs `console.error` and is dropped). Presets, each just above
  the next floor at any pool: `chaos_interlude_1` F1 at 0.705, `_2` F2 at 0.405, `_3` F3 at 0.155 (the crack plays at
  the first round start, then the next hit reaches i3), `chaos_final` F3 at 0.26; each reaches its interlude within 2
  rounds.
- **Bestiary:** the three form records are sub-entries listed right after "128 Chaos", in chain order ("128 Chaos
  (Orrery)", "128 Chaos (Horizon)"), sharing number 128; the title total counts top-level entries only (127). F4 is not an
  entry: it is the Horizon entry's last pages (F3 stats, info, lore, then F4 stats and info, title "128 Chaos (Core)",
  preview `colossus/chaos_horizon_core/preview.png`). In `mode: seen` a sub-entry and the F4 pages show `???` until
  `SEEN:<id>` is set at the swap. All four stand on the `rim` background, and a form phase's line reads "At 70% HP
  becomes the Orrery" (`templates.phaseForm`, `formTitles`). Deep links: `?bestiary=chaos | chaos_orrery |
  chaos_horizon | chaos_horizon_core` (the last opens the Horizon entry on F4's first page).
- **Tests:** `tests/battle/bossForms.test.ts` (synthetic pool 6000 / 6001 by design), `tests/balance/chaos.test.ts`
  (22 tests: the 2.5 bounds for both policies plus two invariants, the crack before F4 and the chain order), and the
  C7 scene tests (`roundFormChange`, `colossusNumbers`, `colossusSlamMotion`, `colossusStatusRow`,
  `colossusTargetLabel`, `spawnOverlap`, `enemyAnimPreviewColossus`, `bestiarySceneForms`). Full suite at C7: 258
  files, 4962 tests.
- **View fixes (C7):** numbers on a colossus use a light outline (`FLOAT_OUTLINE_LIGHT` 0xf8f8f8, crit
  `FLOAT_CRIT_ON_DARK`); the slam dips 48 / drops 40 px (clamped per form by the border rule: F4 dip 5) and says
  "Chaos slams down!"; colossus status icons are 36 px on a dark plated 44 px row; the colossus target label has a dark
  plate; the i2 fade covers the field rect only; numbers of one `spawn` call never overlap; `&enemyAnim=loop` moves a
  colossus whose view became ready late; i1 reads "The Sovereign's robe flares and burns away!" with two orange flashes.

### Shared helpers (U)

- `src/systems/pickupText.ts` — every pickup and gift line, by item id: `foundText`, `receivedText`, `cantCarryText`, `leftBehindText` (articles via `article()`; none for `…Armor` / `…Mail`). Use these, not ad-hoc strings.
- `src/entities/partyTargets.ts` — where a party-target cursor starts: `initialItemTargetIndex` (heal → most hurt living member, revive → first fallen, a status cure → first member with it, else member 1), `mostHurtIndex`, `firstFallenIndex`. Used by the field item and magic menus and battle targeting.

### New Inspect Cell

An inspect cell shows text when the player faces it and presses confirm (a grave, a sign, a statue). No NPC is needed.

1. Add an entry to the map source's `inspect` list (in the layout script for a generated map, e.g. the tomb in act 1's pins, `layouts/a1/world_a1_pins.py`): `{x, y, text: ["Here lies Erdrick."]}`. `text` is a list of strings, or a list of `{text: [...], condition: FLAG}` entries resolved like NPC dialog (first match wins); no other keys are allowed.
2. The cell is usually blocked art (an object); it must be on the map and have a reachable walkable 4-neighbour (the compiler checks both, `map_checks.py`).
3. At runtime `FieldInspect.inspectAt` returns the lines; an NPC or a shop counter in front of the player wins over an inspect cell.
4. Compile the map and add a test (e.g. `tests/data/overworldLayout.test.ts` checks the tomb text and that it is reachable only over the east bridge).

### New Scene

1. Create the scene class in `src/scenes/` implementing the Scene interface (`enter`, `exit`, `update`, `onPause`, `onResume`)
2. Register it in `src/main.ts` via `game.scenes.registerLazy('scene-name', async () => new YourScene(game))` (prefer lazy registration for non-critical scenes)
3. Push it with `game.scenes.push('scene-name')` or switch with `game.scenes.switchTo('scene-name')`
4. Add tests in `tests/scenes/`

### New Battle Mechanic

1. Battle logic lives in `src/battle/` — pure TypeScript, no rendering dependencies
2. The `BattleStateMachine` orchestrates combat flow: intro → command → execution → resolution
3. Damage formulas (both physical and magical) are in `DamageFormula.ts`
4. Elements are in `Elements.ts` with `getElementalMultiplier()`
5. Status effects are in `StatusEffects.ts` with `StatusTracker`
6. Write tests with injectable RNG for deterministic results

### New UI Component

1. UI components live in `src/ui/`
2. `Window` provides NES-style chrome (blue background, white border)
3. `Menu` provides cursor navigation with scrolling, disabled items, wrap-around
4. `TextRenderer` handles character-by-character text reveal
5. `DialogBox` handles paginated NPC dialog

---

## Project Status

All 18 development phases are complete. Post-phase-18 improvements include:

- **FEAR spell** — `debuff_morale` applies fear status (50% turn skip chance)
- **BattleScene decomposition** — 6 modules extracted to `src/scenes/battle/` (1,169→508 lines)
- **Lazy scene loading** — `SceneManager.registerLazy()` with dynamic `import()` (bundle −22%)
- **Battle UX** — concise result messages, dead combatant turn-skip, early battle end, status labels, battle backgrounds
- **NES font fixes** — kill indicator uses `*` instead of `☠` (since U15 the turn list writes `KO` instead: `ACTOR LABEL>TARGET RESULT`, e.g. `B.MAG FIRE>Goblin 30`, fitted by `fitEntry` in `src/scenes/battle/TurnList.ts`)
- **Act 1 playtest remediation** — passes R and U fixed the second and third playtests; plans, decisions and results are in `docs/FIX_PLAN_PENINSULA.md` ("R result", "U result")

See `docs/PROGRESS.md` for full details.

---

## Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/DESIGN_DOCUMENT.md` | Full game design: world, combat formulas, classes, spells, items |
| `docs/PROGRESS.md` | Implementation progress by phase |
| `docs/PHASE_PLAN.md` | Detailed plans for phases 9–18 with sub-tasks and acceptance criteria |
| `docs/CODE_AUDIT_RECOMMENDATIONS.md` | Code audit findings (all resolved) |
| `docs/REMEDIATION_PLAN.md` | Remediation work packages (all completed) |
| `docs/PHASE_13_FIXES.md` | Post-phase-13 fix plan (all completed) |
| `docs/YAML_MIGRATION_PLAN.md` | JSON→YAML migration plan (completed) |

---

## Art & Audio Pipeline

All art and audio are generated from code in `assets-src/` (Python 3 + Pillow + numpy + ffmpeg) and written into `assets/`. Nothing in `assets/sprites/` or `assets/audio/` is hand-edited; change the generator (or approve new AI art) and rebuild. `assets/backgrounds/*.webp` come from the one-time stage remap.

```bash
npm run assets                      # rebuild everything
python3 -I assets-src/build_assets.py terrain characters   # or pick stages: terrain | characters | battle | monsters | backgrounds | audio
```

**Style:** SNES-inspired. Every colour is defined as 5-bit-per-channel values (15-bit, BGR555-style) in `assets-src/snes_palette.py`, light comes from the top-left, and ramps run darkest→lightest. Art is authored at native resolution and upscaled with nearest-neighbour: x3 for the legacy field art (`TILE_SIZE` = 48) and x2 for all AI-generated art (battle characters, monsters, preview field sprites).

| Stage | Source | Output | Notes |
|-------|--------|--------|-------|
| terrain | `tiles.py` | `assets/sprites/terrain.png` | Rows = `TerrainType` order (+ counter), 4 variants per terrain, picked per map cell |
| characters | `characters.py` | `assets/sprites/characters.png`, `characters.json` | Field-size two-tile (16x32) characters: 4 walk rows x 3 frames per block. Keyed by class id and NPC `sprite` name. (A battle-pose row is still generated but unused.) |
| battle_ai | `gen/approved/<class>/battle.png` | `assets/sprites/battle-characters-ai.png`, `.json` | Gemini-generated, approved 2x battle figures (80x80 native): one row per class, columns = ready, attack, cast, hurt, down, victory. Since pass CB also user-rendered class sheets (below); rows are sorted by class id, so a new class shifts the rows; the main file is capped at 4096 px (25 rows): later 80 x 80 classes are listed in `gen/battle_pages.yaml` `overflow` and go on extra pages with the same layout (pass CB A5, `docs/CLASS_BARBARIAN_PLAN.md` 15) |
| (user hero sheets, pass CB) | `gen/user_art/<id>/*.png` + `gen/hero_user.yaml`, imported by `python3 -I assets-src/gen/hero_user.py cut | approve | check [--all]` | `gen/approved/<class>/battle.{png,json}` + `battle_kneel.{png,json}` | `docs/CLASS_BARBARIAN_PLAN.md`: a user render (ChatGPT, the class pack `~/temp/ff-game/class_pack/`) of 7 x N cells of 80x80 (READY, ATTACK, CAST, HURT, DOWN, VICTORY, KNEEL; row = class, base then enhanced), every pose facing left, feet on row 76; the import only checks it (sha256, binary alpha, figures inside their cells, feet row) and maps its <= 16 colours one-to-one onto the house palette (15-bit, darkest PX.OUTLINE; with the recipe's `palette: rows`, plan 11, one such map per class row, applied to that row only; pass CL's `palette: per_row` is the same rule under its first name, `hero_user_grid.ROW_PALETTES`); no pixel moved; `backend: user`, `faces: left`, no `facing_fix`; `check` re-imports byte for byte (selftest dispatch `field_user.user_check`, `selftest_roster.kneel_ok`). First: barbarian / berserker; then legionnaire / centurion (`palette: rows`, plan 11); hunter / ranger (`palette: rows`, plan 11; dotted-string keys, plan 12: a frame may have as many pieces as its source key; plan 13: `keep_specks`); cleric / paladin (`palette: rows`, plan 11; detached sparkle, plans 12-13; drawn kneel contact, plan 14); ronin / samurai (`palette: rows`, plan 11; detached hat / slash streaks, plans 12-13); rune knight / mystic warrior (`fx_colours`, plan 16); scholar / sage (hero ids `scholar_hero` / `sage_hero` beside the NPC sheets; `fx_colours`, plan 16.2); shieldmaiden / valkyrie (the recipe key `airborne: {<class>/<pose>: <row>}` for a key drawn off the ground, the valkyrie's dive, plan 18) |
| (oversize hero sheets, pass CL) | the same importer with a recipe's `cell`, `foot_row`, `body_box`, `palette: per_row` and `prop: {kind: lance, ...}` (`gen/hero_user_grid.py`, `gen/hero_user_lance.py`) | `approved/<class>/battle.*` (grid [160, 144], `body` [72, 64, 80, 80], `prop.lines`) and page 1 of the battle atlas, `assets/sprites/battle-characters-ai-1.png` | `docs/CLASS_LANCE_PLAN.md`: landsknecht / dragoon, 160 x 144 cells whose body sits in the 80 x 80 box (x 72-151, y 64-143, feet on row 140) and whose lance may leave it; the lance is found by its hand-marked line (`prop.lines`) and its colours, out-of-spec lance pixels kept as rendered, a body px outside the box refused; one 16-colour palette per class row. The atlas json gains `pages` and, per oversize sheet, `page`, `cell`, `footRow`, `body`, `grid` [6, 3], `reach`, `top`, `heads` (the 14 main-page classes and the main png are byte-identical); readers go through `gen/battle_atlas.py` / `src/rendering/battleAtlasPages.ts`. In-betweens: `gen/puppet_lance.py` (`RIGID`: a key whole, its upper body bobbed by whole px; a planted lance carried; L1-L8 lance checks, `puppet.py review`); kneel: `gen/kneel_lance.py` (`kneel: {source: user, grip, alias_frames}`). Engine: party sprites are placed by the body box and every hero measure goes through `src/scenes/battle/heroBody.ts` (`tests/scenes/battle/heroBodySites.test.ts` classifies every sprite-geometry read) |
| (a replaced pose, pass CD-K) | the same importer with `row_geometry` (a row's 80 x 80 cells placed in a bigger cell's body box) and `replace: {<class>/<pose>: {file, sha256, height_of, at, native_size, native_sha256}}` (`gen/hero_user_replace.py`) | the class's approved sheets and page 2 of the battle atlas (`battle-characters-ai-2.png`; pages are ordered by cell height, then width) | `docs/CLASS_DARKFIGHTER_PLAN.md`: dark fighter / death knight (ids `dark_fighter_hero` / `death_knight_hero`: the monster sheets own `approved/dark_fighter/` and `approved/death_knight/`). The death knight's ATTACK is a separate upscaled user render (soft alpha, no clean grid) brought to native px at READY's height: each art cell opaque at >= 50 % opaque px, its colour the majority of its px mapped to the row's own 16 source colours. In-betweens `inbetweens: rigid` (+ `rigid_cut: feet`): one key whole, bobbed above the feet row (`puppet_lance.plain_frames`), so a blade is never re-posed |
| (ground sheet, AR-T2) | `gen/approved/overworld/terrain_ar.{png,json}`, re-cut from the render cache by `python3 -I assets-src/gen/terrain_cut.py` (`--check`, `--native DIR`; pixelizer `gen/terrain_pix.py`) | read by the map compiler | Pass AR's ground textures (Stability Image Core, purpose `ar_tiles`; the AR-T picks, user-approved 2026-11-21): 192 px seamless 15-bit tiles (4x4 cells at 48 native) `ar_grass` / `ar_forest` / `ar_mountain` (+ `@b` macro variants), `ar_sand`, `ar_ocean`, `ar_dirt`, `ar_cobble`, and by their own names `beach`, `shallows`, `swamp`, `taiga`, `snow`, `mountain_cold` (grey rock), the calm fresh water `water_calm_shallow` / `water_calm` (rivers and lakes: a rock-free window of the shallows render, its deep step on the ocean's ramp), the dungeon floors `ar_temple_floor`, `ar_temple_rubble` (+ `_cool`, the old temple slate), `ar_cave`, `ar_wood_floor`, `ar_marble`, `ar_lava`, `ar_ice`; parts `ar_tree_clump`, `conifer_clump`. Loaded into every kit (`kit.AR_SHEET`); the organic painter prefers the `ar_` names (`terrain/ecotone.tex_name`), dungeons take the floors through their layout scripts' `materials:`; the copy the cutter needs: the cache files of its `sources` keys |
| (approved kits added in T6) | `gen/approved/overworld/grand` (broken-bridge debris; its `temple_grand` piece is skipped), `castle/stairs_lib` (top-down stairwell, map table, gold heap, crown cushion, lectern, globe), field sheets `vendor_f`, `farmer`, `burgher`; R5 added `overworld/grand_temple` (the temple ruin icon, a free re-cut of `grand`) and `town/gates` (gate arches `gate_arch_3` / `gate_arch_2`, tavern and shrine signs; `gate_side` failed review, so the W and E gates have turrets but no arch) | used by the map compiler and `field_ai` | Paid Gemini budget: 26 of 100 used (`docs/ACT1_LOG.md`; the ledger guard is authoritative) |
| field_ai | `gen/approved/<id>/field.png` | `assets/sprites/characters-ai.png`, `.json` | 2x field sprites (the default field art; dev builds show the old 1x sprites with `?art=legacy`). `gen/field_alias.yaml` (pass CB, **temporary**): a class with no field sheet yet takes its target's block (`barbarian: warrior`, `berserker: knight`, pass CL `landsknecht: warrior`, `dragoon: knight`, pass CD-K `dark_fighter_hero: warrior`, `death_knight_hero: knight`, `legionnaire: warrior`, `centurion: knight`, `hunter: thief`, `ranger: ninja`, `cleric: white_mage`, `paladin: white_wizard`, `ronin: thief`, `samurai: ninja`, `shaman: black_mage`, `druid: black_wizard`, `beastmaster: monk`, `summoner: master`, `warlock: black_mage`, `necromancer: black_wizard`, `rune_knight: red_mage`, `mystic_warrior: red_wizard`, `scholar_hero: red_mage`, `sage_hero: red_wizard`, `arquebusier: thief`, `rifleman: ninja`, `shieldmaiden: warrior`, `valkyrie: knight`, `bard: red_mage`, `virtuoso: red_wizard`, `fencer: thief`, `duelist: ninja`, `apothecary: red_mage`, `plague_doctor: red_wizard`, `tinker: monk`, `machinist: master`, `clockmaker: white_mage`, `chronomancer: white_wizard`, `witch_hunter: monk`, `inquisitor: master`, `diver: warrior`, `abyssal_knight: knight`, `dancer_hero: monk`, `blade_dancer: master`, `aeronaut: thief`, `sky_captain: ninja`; `aliases` in the json, the image unchanged); drop the entry when its field sheet is approved |
| monsters_ai | `gen/approved/<monster>/monster_*.png`, `boss_*.png` + rigs `gen/anim/monsters/<sprite>.yaml` | `assets/sprites/monsters-ai-<n>.png` pages (9 pages after the V8 fix round, measured at V8 W4: 2040x1872, 2008x1728, 2032x1200, 2048x1536, 2048x2000, 2008x768, 2048x2032, 2048x1152, 2048x1792; each <= 2048x2048, act-1 sheets on page 0; page groups in `gen/monster_pages.py`, plus a `titan` group for any `size: titan` sheet, none today), index `monsters-ai.json` (per sheet also `idleBox` [l, t, r, b], FW-A2, and `scale` for the sheets in `gen/monster_scale.yaml`, FW-S: integer display scale 2 or 3; since V4 the rescaled sheets at 3: bigeyes (`size: large`) and the `size: huge` enemies (22, but fire_hydra at 2 since EF-H batch 2: the user's render in the tall frame), the gigas, elementals, dragons, sharks, hydras, ochus, minotaurs and big eyes, `docs/REDESIGN_PLAN.md` 2.4; since V6 also chaos, `size: boss` in the 200 px boss band at scale 3 (D-V6 = C2), which `layoutSizeOf` lays out as the titan class: alone in `TITAN_AREA`, attacking in place) | Idle / attack / hurt (+ boss `cast`) per monster sprite, plus palette-swap variants from `gen/monsters.yaml`, plus the cut-out in-betweens of every rigged sprite (see "Monster animation" below). The build fails on any animation check failure |
| maps | `assets-src/maps/<id>.yaml` + kit parts (`gen/approved/<kit>/*.png`, placeholders from `tools/kit.py`) | `assets/maps/ai/<id>.yaml`, `assets/maps/ai/<id>/{below,above}_r_c.png`, `index.yaml` | Map compiler `tools/build_map.py` (docs/ART_TILES_PLAN.md): ASCII ground + placed objects (houses from roof/wall/door parts, trees, props) baked into 2x chunks; sources with `terrain: organic` (the overworld) get organic coasts, the AR-T2 boundaries (round cell cores, per-pair clustered ecotone bands, water by depth with foam and bank shadow, scree, cold ranges in grey rock, the lit NW rim and SE shadow, `@b` macro textures; every px 15-bit) and peak variants and organic roads from the `tools/terrain/` package (`--metrics` prints its boundary numbers); chunk PNGs are palette-indexed when they have at most 256 colours (`build_map.save_chunk`, the same RGBA decoded); validates reachability, collision and covering, plus the per-source opt-in checks in `tools/map_checks.py` (roads, rivers, sealed edges, warps, blobs, art coverage, NPC chokepoints, unreachable walkable cells). Output must not depend on `PYTHONHASHSEED` (`build_map.py --check-determinism`); `--preview` crops a compiled map, `tools/map_report.py <id>` prints reachability and chokepoints. Most sources are written by `tools/layouts/*.py` (see "Editing a 2x Map"). The game plays these compiled maps by default for every id in `index.yaml` (production always; dev unless `?art=legacy`; unit tests only with `?art=ai`); transitions may target named `entrances` |
| (in battle_ai / field_ai) | `gen/puppet.py` + `gen/anim/<id>.yaml` | extra columns in both 2x atlases | Cut-out in-betweens from the approved pixels (no AI): 8 battle poses per class (`idle_b`, `atk_wind1/2`, `atk_mid`, `atk_follow`, `cast_gather/rise/release`) from hand-marked joints, and 7 walk columns per direction for every field sprite (stand + contact/down/pass per foot, 3 per tile). Check with `python3 -I assets-src/gen/puppet.py review [id]`; a class without a joint file repeats its keyframes. A rig's `fx_colours: [[r, g, b], ...]` (pass CB A6, `docs/CLASS_BARBARIAN_PLAN.md` 16) names its effect colours (glows drawn without ink): `puppet.outline` and `kneel_bridge.reink` leave their edge un-inked. Review fixes that must not touch a style-reference sheet (e.g. the knight's attack face) go in `battle.json` `face_fix` and are applied at build time. Poses that faced right (the heroes stand on the right and must face left) are turned by `battle.json` `facing_fix` (pass HF, `docs/HERO_FACING_PLAN.md`, `gen/puppet_facing.py`; user ruling 2026-11-25): `mirror: figure` reflects the whole figure about its visual centre (the opaque pixels' mean x, clamped into the cell; no jump: every hurt, nine downs, the ninja / black mage / white mage cast), `mirror: head` with a `box`, `exclude` and integer `sum` reflects only the head (ninja and master ready); applied after `face_fix` in `puppet.apply_review_fixes`, so the in-betweens and the kneel bridge follow. A figure-mirrored keyframe keeps its yaml joints on the approved PNG; `load_cfg` mirrors them and swaps n / f (n = screen-left there), and its in-betweens draw with n / f exchanged in the z order. Test: `tests/rendering/heroFacing.test.ts`; selftest `gen/selftest_facing.py`. (Bedrock/Stability in-betweens were tried and rejected on 2026-11-13: no identity lock to a reference image, img2img redraws the whole figure, inpainting comes back grey) |
| (one-time) | `tools/stage_backgrounds.py` | `assets/backgrounds/<id>.webp` | Hand-made backgrounds remapped once onto the battle stage (1920x1080, per-image horizon); referenced by `battleBackgrounds` in map YAML. Not a build stage. `shoreline` is a composite (the party's rocks pasted below the layer's own rock line, colour-matched); `stage_backgrounds.py --check [ID ...] [--image FILE]` measures water in the feet bands, the top enemy row's water and contrast, and the largest straight vertical seam against its `CHECKS` bounds, and exits non-zero on a failure; only the composite `shoreline` has bounds (on a plain image the blue-hue water test and the seam metric measure nothing: the `CHECKS` comment). Only the ids act 1 uses are committed (`temple` = evil-temple, `evil_temple`, `abandoned_castle`, `dark_forest`, `ruined_forest`, plus the original 11); the other staged ids stay local and uncommitted |
| vehicles | `vehicles.py` + `gen/approved/vehicles/{ship,airship,canoe,canoe_front}.png` (LM2) and the airship's optional `airship_{back,front,back_turn,front_turn}.png` (pass AR, `docs/AIRSHIP_VIEWS_PLAN.md`) | `assets/sprites/vehicles.png`, `.json` (version 2; `OPTIONAL_VEHICLE_FRAMES` packed after the required frames when their approved files exist) | Each frame cropped to its drawn box. The ship and b_7 anchor on the keel (the bottom 6 rows' centroid); an optional airship frame uses its json `anchor` as written (the **centroid rule**: its whole-mask x centroid sits D7 = 13.80 native px ahead of the foot point, as b_7's does, so the ship's visual centre stays put when it turns). The four views are re-cut offline from the AR style-transfer renders by `python3 -I assets-src/gen/vehicle_view_cut.py` (`--check`: rebuilds every file and runs the gates: visual centre within 1 px at both facings, the shadow under the hull, sizes within +-3 px, binary alpha, b_7's colours, a closed outline; `--review DIR`; edits and gates in `vehicle_view_edit.py`, sheets in `vehicle_view_review.py`, selftest `selftest_vehicle_view.py`). Self-approved under the integrator's R6 ruling (each json's `review`); the user may veto |
| audio | `audio/` | `assets/audio/{music,sfx}/*.ogg` | Filenames come from `audio-manifest.json` |
| dungeon props (AR) | `gen/prop_cut.py` + `gen/prop_spec.py` (Stability Ultra renders in `gen/cache/`, purpose `ar_props`) | `gen/approved/dungeon/props_ar.{png,json}` (cells `ar_<id>_<r>_<c>`, per prop its cache key, model, seed, pass, cut, place and flame mask) | Used by the map compiler through `tools/kit_props.py` in every kit; placed by `layouts/props_ar_maps.py`; lit props animated by the flame ambient (see "Dungeon props (AR, AR-P2)" and "Flame ambient") |
| colossus | `gen/approved/chaos_forms/<form>/master.png` + layer yaml `gen/colossus/<form>.yaml` | `assets/sprites/colossus/<form>/<layer>[_<frame>].png`, `assets/sprites/colossus.json` | Pass C Chaos colossus forms (`docs/CHAOS_FORMS_PLAN.md` 18; `gen/colossus_build.py`): full-resolution painted art (rev 4, D-U10: no pixelization, soft 8-bit alpha, shown at scale 1 with linear filtering). Three entries: F2 `chaos_orrery` (1320x900, place (40, 25)), F3 `chaos_horizon` (2700x1080, place (-527, -60); layers `body`, `core` with `crack` / `open` frames, `glow` additive at half res, `texScale: 2`) and F4 `chaos_horizon_core` (an art entry reusing F3's tiles at place (-527, -285)). Layers cropped and tiled <= 2048, a pre-composited bestiary `preview.png` per form, memory counted once per tile file (16.9 MB, cap 24); the json shape is the TS contract (`colossusIndex.ts`, `colossusContract.test.ts`); no approved master = writes and prints nothing; `build_assets.py colossus --out DIR` writes a scratch copy + `manifest.sha256` (determinism, PYTHONHASHSEED 0 / 1) |

**AI sprite generation (2x art scale, in progress):** `assets-src/gen/` generates character sprites with Google
Gemini and pixelizes them; see `assets-src/gen/README.md` and `docs/ART_2X_PLAN.md`. Paid image requests go through a
budget guard: one per review checkpoint, `--paid` required, every attempt logged in `assets-src/gen/cache/ledger.jsonl`.
**User-rendered sheets (EF-H, the third approved-sheet source beside Gemini and Bedrock):** a sheet the user renders themselves (dark_wizard, pirate, vampire, vampire_lord, fire_hydra, fire_lizard, black_knight; batch 3: chimera, buccaneer, blue_dragon, dark_fighter, death_knight, dragon_zombie, medusa, earth_medusa, green_dragon, evil_eye, white_dragon, king_mummy, rakshasa; ChatGPT) is the approved design: tracked in `assets-src/gen/user_art/<id>/`, its recipe (file, sha256, poses idle / attack / hurt / kneel, tool, date, refs) in `gen/monster_user.yaml`, imported by `python3 -I assets-src/gen/monster_user.py cut | approve | check <id>` (exactly four 8-connected pieces, s = 1.0 when the idle is in its band, feet anchors aligned, one house palette; the binary alpha is the figure: only exact magenta is keyed, no fringe erosion, `pixelize.foreground(exact_key=True)`; a recipe `reserve` gives small regions their own palette slots within the 16, `gen/monster_user_palette.py`: the pirate's face, cutlass, gold trim and beard, the vampire's pale face and copper trim, the vampire_lord's magic; drawn magenta that is art takes `monster_check.MAGENTA_ART`; review pages in `~/temp/ff-game/ef/user/<id>/`); its `approved/<id>/*.json` say `backend: user`, and the style lock (`selftest.py`, `selftest_roster.kneel_ok`, `_approved_keys`) re-imports the tracked render byte for byte instead of re-planning a request. No AI call. The rig still takes `kneel: {source: ai}`. **Tall frame (EF-H amendment A, `gen/monster_user_frame.py`):** a `size: large` user sheet whose idle is over 120 rows or whose tallest pose is over 121 is cut at s = 1.0 in a 200-row cell with feet row 192 (min width 128; the data size and sheet name stay; its jsons say `frame: tall`); it takes the 200-row cell's size-scaled tolerances, so `monster_user_frame.py tiers <id>` lists the steps that would fail at the large tier for the reviewer (fire_hydra). A recipe `anchor: {kneel: bbox}` places a pose by its box centre (fire_lizard's draped-tail kneel); palette classes `red`, `ember` join the reserve selectors; on a user sheet `foreground(exact_key=True)` skips the reduced-mask blob filter (it trimmed 1-px tips of figures over 200 px wide). Batch 3 (fire_hydra's tall frame for chimera, blue_dragon, green_dragon, white_dragon, dragon_zombie, evil_eye) adds the reserve classes `green`, `taupe`, `cyan`, `crimson`, `glow`, `pale` (amendment B) and `navy` (amendment C). **Floating user sheets (EF-H amendment B, `monster_user_frame.float_rows`):** a recipe `floating: true` (evil_eye) keeps the attack's and the hurt's drawn vertical offsets to the idle (the idle on the feet row, the kneel on the idle's row for the floating K-ground gate; FW-C lifts past the 2 px bottom margin, s = 1.0 only) and writes `floating: true` in its monster json.
Stability-on-Bedrock calls (pass C: the Chaos colossus masters via `gen/colossus.py`, `docs/CHAOS_FORMS_PLAN.md` 5) are gated inside `bedrock.invoke(model, body, *, paid, purpose)`: `paid=True`, a purpose from `budget.json`'s `bedrock.per_purpose_caps`, the pass cap of 80, main checkout only, one row per request in the tracked BR ledger `assets-src/gen/cache/bedrock_ledger.jsonl` before the first try; `colossus.py budget --check` verifies it (and no Gemini call after N_C0). The rim backdrop is staged by `tools/stage_rim.py` (`stage_backgrounds.py rim` / `--check rim`; outputs `rim.webp` and the floor-front cut `rim_floor.webp`). The colossus art pipeline (`colossus.py`; one Bedrock call per background command): `gen` / `structure` / `search_replace` (renders), `nobg` (remove_bg), `upscale --model conservative --form F` (Conservative Upscale, then `upfit` to the form canvas), `inpaint` + offline `inpaint_merge` (masked chest variants, byte-identical outside the mask), and offline `glow` (sky_base, despill, the G1 diff / G2 luminance glow), `mock` (rim mock + side-by-side sheet), `review`, `approve` (archive first: `retire.py --colossus <form>`), `check`, `lock`; `selftest.py --anim` runs the colossus selftests. Run `python3 -I assets-src/gen/selftest.py` after changing the pipeline. Its style lock re-plans every approved Gemini sheet; the pass-KA kneel keys (`approved/<id>/kneel.json`, heroes `battle_kneel.json`) are kneel_ai_gem requests built from untracked guides, so `selftest_roster.kneel_ok` checks them as `kneel_ai.py approve` and `kneel_tools.py coverage` do (sheet fits the id, png beside it, `kneel: {source: ai}` in the rig, a J0 FAIL carries `user_review`, every key a successful KA request in its ledger; FX-S). In a worktree copy `gen/refs` and the untracked `gen/cache` renders from the main checkout first (`/bin/cp -c`, APFS clones), or the Bedrock and character rows fail. Approved sheets live in `assets-src/gen/approved/<id>/`; the `battle_ai` and `field_ai` build stages turn them into `assets/sprites/battle-characters-ai.*` and `characters-ai.*`. Monsters come from `monsters.yaml` (`monsters_ai` stage → `assets/sprites/monsters-ai.*`; bosses are one image per pose, including `cast`).

**Monster animation** (`docs/ENEMY_ANIM_PLAN.md`, fixes in `docs/ENEMY_ANIM_ISSUES.md`): cut-out in-betweens from the approved monster pixels, no AI and no Bedrock (rejected for in-betweens on 2026-11-13). All 123 atlas sheets are rigged and locked (roster pass R and its fix passes, `docs/ROSTER_FIX_PLAN.md`, `docs/ROSTER_FIX_PLAN_2.md`; the last 11, tranche T-K and the swimmers red_piranha / white_shark, since fix pass 2 G6), so `check --all` prints no `no rig` line. Three rigs are partial under FW-Q, one sequence aliased to its keys: black_widow / hurt, crawler / attack, astos / attack (`FWQ_ALLOW`, exactly these; chimera / hurt left at EF-H batch 3, its user render bridges). The atlas is 9 pages.
- **Rigs** live in `assets-src/gen/anim/monsters/<sprite>.yaml`: `body: biped | quadruped | bird` (templates in `rig.py` / `rig_templates.py`, see `gen/README.md`), joints per keyframe, `parts` (kinds include `prop`, `cloth` and `fx`), `masks`, `z`, `frames.<f>` overrides (`tweaks`, `pins`, `dy`, `drop`, `moves`), `holds` (at most 1 per sequence) and `paint` (per-frame pixel patches with a palette colour or `rgb: null`; the approved sheets are never edited). Frames: `idle_b`, `atk_wind1/2`, `atk_mid`, `atk_follow`, `atk_recover`, `hurt_in1/2`, and for bosses `cast_gather/rise/release`. A sprite without a rig gets no in-betweens (the atlas aliases each name to its source keyframe).
- **Per-frame options** (`monster_render.py`): `frames.<f>.scale: {part: s}` (0.25 ≤ s ≤ 1, `kind: fx` parts only; the lich crystal grows in at 0.55 in `cast_rise`) and `frames.<f>.sampler: nearest | rotsprite` (overrides the rig's `sampler`).
- **Commands:** `python3 -I assets-src/gen/monster_anim.py mark <id>` (zoomed keyframes with joints and parts), `check [ids|--all]` (every check plus the lock files; must print only `OK` lines), `review [ids]` (strips, onion sheet, GIFs and `_stage.png` in `gen/out/anim/review/monsters/`, plus the report-only mask overlap and edge-roughness top 10), `lock <id>` (writes `<id>.lock.json` with every frame's hash; only after an image review passes). Review-strip coordinates are 4x frame pixels: native = (px − 2) / 4.
- **Checks** (`anim_checks.py`, `anim_efix.py`, `monster_check.py`; list in `ENEMY_ANIM_PLAN.md` 5.1): binary alpha, palette lock, no magenta fringe, no detached pixels, no seams, silhouette continuity (fx pixels and their outline excluded), outline, feet anchored, no clipping, rotation cap, atlas exactness, locks and determinism, prop carry, holds cap, and the efix gates F3 fx-mask integrity, F4 intra-part crease, F5 foot release only in a rearing hurt, F7 prop attached. The efix gates run in `check`, `review` and the `monsters_ai` build (`efix_gates=True`). The fx parts are an allowlist enforced by `selftest_efix.py` (garland `glow`, lich `trail` and `crystal`, hollow_seraph `halo`, which brightens only at its cast frames via `frames.<f>.brighten`; pass V dropped vampire `slash` with the old vampire rig and re-confirmed the halo on the new seraph rig, so `FX_PENDING` is empty): a new `kind: fx` needs approval.
- **Fix-pass tools** (`docs/ROSTER_FIX_PLAN.md` 3): `paint` on a keyframe (FW-P, `monster_keys.py`: <= 160 px per key, approved palette or null, `kf_paint_cap` only for the allowlisted crocodile/hurt 220, drowned_sovereign/cast 300 and chimera attack 800 / hurt 600, locked as `kf:<key>`), rig `raise: false` (FW-R: no raise frames, the heavy `tip` from `atk_wind2`), rig `key_offset: {key: [dx, dy]}` (FW-O: moves an approved key by whole px with its joints, masks and keyframe paint; locked as `kf:<key>`), rig `hurt_from: idle` (FW-H: a boss with no approved hurt gets its hurt key from the idle, recoil via `key_offset` / keyframe paint, locked as `kf:hurt`; only `HURT_FROM_ALLOW` = hollow_seraph), rig `alias: [hurt | attack]` (FW-Q: a partial rig leaves that sequence's in-betweens aliased to their keys; only `FWQ_ALLOW` sheets; `check` prints `OK (aliased: ...)`), the floating cutter lift (FW-C: `monster.cut` lifts a low floating cell to the 2 px bottom margin, at most `LIFT_MAX` 36), the atlas anchors `travelTop` / `lungeRight` / `homeX` (FW-A, inclusive; ranged sheets add their attack frames to `homeX`), and the measurement tool `gen/fixmeasure.py` (`travel | partc | pieces | fills | colours | diff | select`, plus round 2's `edges | match | poly | switch | rowspan | sweep` in `fixmeasure_edges.py`) that every fix gate runs.
- **Pass V tools** (`docs/REDESIGN_PLAN.md`): `gen/retire.py` archives a sprite before its redesign (`<id>` -> `approved/_retired/<id>_vN/`, `anim/monsters/_retired/`, `gen/retired/monsters_vN.yaml`; `--move-rig`, `--prune`, `--revive <id>_vN --as <new_id>`; index `docs/RETIRED_SPRITES.md`; builds and checks never read `_retired`, `selftest_retire.py`); `approve.py` refuses to overwrite a monster/boss sheet without an archive copy; the titan band (`size: titan`, 300 cell, feet 292, fail-closed cut; `monster.py --titan-probe <raw ...>`); the pass-V budget (50 images, only the redesigned ids and their sheets, `selftest_passv.py`; FW-V8 `sheet_caps` `{"<id>/<sheet>": 3..6}` on the pass, read by both per-sheet rules, other sheets 3; the V8 round halts at 47); the cutter options `cut: {keep_pieces: all_in_cell}` (keep separate floating pieces) `cut: {fit: headroom, top_margin: N}` (shrink a figure that would reach above row N) and, per-pose only, `cut: {match_height: idle, tolerance: 0.10}` (scale an action pose to the approved idle's height +- tolerance: size is normalised, never a rejection reason; all three change no cache key, so a ledgered render re-cuts at 0 images). Pass V redesigned and re-rigged 8 sprites (crazy_horse, piscodemon, black_knight, guardian, vampire, hollow_seraph with four blade wings and no raise, chaos as a two-armed robed overlord, and the red dragon redrawn upright); their old looks are archived as `<id>_v1` (`docs/RETIRED_SPRITES.md`). The V8 fix round (`docs/REDESIGN_FIX_PLAN.md`) regenerated crazy_horse (a skull-headed horse with smoke legs), piscodemon (slanted glowing eyes) and hollow_seraph (hilt-less blade wings of light, its hurt key derived from the idle by `hurt_from: idle`), archived as `<id>_v2`; black_knight got keyframe paint (pointed horns, T visor) and chaos `raise: false`.
- **Hi-res textures and the 2.5 tier (pass EF, `docs/ENEMY_FEEDBACK_PLAN.md` EF-A / EF-B):** a `gen/monster_scale.yaml` entry may be `{scale: S, tex: T, smooth: [despur, edges], crop: true}` (S in 2 / 2.5 / 3; int-ef2: any multiple of 0.05 in [2, 3.5], `monster_hires.valid_scale`; T = S, or T = 1 with an integer S; every product with T exact, `monster_hires.ceil_mul` / `src/rendering/texPx.ts`). After the frames are generated, checked and locked, `gen/monster_hires.py` runs `despur` on the native frames (spurs dropped, notches filled with the outline colour, <= 3 % area, the frame checks again) and a Scale2x-to-8x + nearest upscale to T (no new colour, binary alpha, feet row `ceil((footRow + 1) T) - 1`); `gen/monster_hires_pages.py` packs a group's hi-res sheets onto their own `filter: linear` pages (rects on whole art px, 1-px gutters) and gates the budget (<= `MAX_EXTRA_PAGES` 18 pages over the 12 before EF: EF-A/B's 14, EF-D's chaos page, int-ef2's 2 for the tex-3 dragons and ef-horse's 1 for crazy_horse (30 pages, 20 hi-res, 74.8 MB at ef-horse); preload + the largest formation <= 128 MB of GPU memory, a linear page counted with its mips; int-ef2: 29 pages, 19 hi-res, 74.8 MB at clay_golem + king_mummy). A packed frame sits on a multiple of its sheet's unit (the numerator of T: 2.5 -> 5, 2.8 -> 14, 3.3 -> 33), x along the shelf and y from the shelf top. `crop: true` (iron_golem: 17 frames of 423 px do not fit one 2048 page) cuts the sheet's cell to the union opaque box of its frames plus 1 px, the bottom rows kept; every anchor is measured on the cut frames, `footRow` moves up with it. The sheet's JSON gets `texScale`; anchors stay native. Runtime: `BattleArt` slices at the sheet's `texScale`, `MonsterPages.applyPageFilter` (linear + mipmaps), the layout class `medium` (a small at a tier scale, `isTierScale`: over 2 and not the V4 integer 3, so 2.5, 2.7, 2.8, 3.3; a tier-scale large lays out as `huge`; a sheet at exactly 3 keeps its V4 class and the pass-4 refusal, a tier sheet may take pass 4 through its mipmapped page; pass 3 shrinks every sheet over 2 to screen 2 in its data class). 43 hi-res sheets (the 32 B1, the B2 scale-2 sheets, fire_lizard and crazy_horse (EF-F, `smooth: [despur, edges]`) at tex 2, blue_dragon / green_dragon at tex 3 with `smooth: [despur, edges]`: `edges` = Scale2x on the silhouette only, the inside nearest, after the image review's ITERATE on full Scale2x, which rounded their horn points and blotched the dithered scales); the other scale-3 B2 sheets (shark, hydra, fire_hydra, white_dragon) take A4's fallback, despur at tex 1. int-ef2 (user ruling 2026-11-24, "grow the tougher enemies"): stone_golem 2.8 (idle 294 screen px), iron_golem 3.3 (297, cropped), sea_troll 2.7 (286.2), so clay_golem 292.5 <= stone <= iron and troll 282.5 <= sea_troll; each the smallest 0.05 step that does it (`efSizes.test.ts` pins it). **Standing rule (user, 2026-11-24):** every new or regenerated monster sheet (approved on/after 2026-11-24, or by Bedrock) gets an EF smoothing entry, `smooth: [despur]` plus a Scale2x texture at its scale (`tex` = scale; a review may drop one, never both; `docs/NEW_MONSTER_GUIDE.md` 1.4), enforced by `tests/data/efSmoothRule.test.ts` and `selftest_hires.py` (`monster_smooth_rule.ef_rule_failures`); crazy_horse (EF-F) is the first. Tests: `selftest_hires.py`, `tests/rendering/hiresSheets.test.ts`, `tests/data/efSizes.test.ts`; previews `?mute=1&scenario=ef_sizes | ef_sizes_huge | ef_smooth | ef_smooth_big`.
- **Idle orbit (EF-D, `docs/ENEMY_FEEDBACK_PLAN.md`):** a rig's `orbit` (`gen/monster_orbit.py`; only chaos: its four element orbs circle the flaming head, 16 steps, behind the flame on the far half) adds `idle_o<k>` / `idle_b_o<k>`; the atlas entry gets `idleOrbit: N` and `idleFrame` (`enemyChoreography.ts`, `ORBIT_STEP_FRAMES` 6) plays them in the idle, battle and bestiary alike; attack, cast, hurt and kneel keep the keys' orbs (an accepted pop). Tests: `tests/data/chaosOrbit.test.ts`, `selftest_orbit.py`.
- **Locks:** a changed frame fails `check --all` with `hash differs from the lock file` until it is re-reviewed and re-locked; the build only warns. The monster atlas must not depend on `PYTHONHASHSEED`, and a `monsters_ai` build leaves the party atlases byte-identical.
- **Kneel (passes K and KT; `docs/KNEEL_PLAN.md`, `docs/KNEEL_TWEEN_PLAN.md`):** the battle kneel track (`src/scenes/battle/kneelChoreography.ts`: `kneel_in1` 4, `kneel_in2` 4, a `kneel` / `kneel_b` hold every 48, the rise `kneel_in2` 3, `kneel_in1` 3; preview `&kneel=loop`) plays four atlas cells per sprite. Since KT3 every one of the 123 monster sheets and 12 hero classes uses its **approved AI kneel key** (`approved/<id>/kneel.png`, heroes `approved/<class>/battle_kneel.png`) through `kneel: {source: ai}` in the rig / class file (`kneel_tools.py coverage`: `ai 123` / `ai 12`, derived 0, alias 0). The three other cells are a **one-source bridge** (`gen/kneel_bridge.py`, `kneel_seams.py`, `kneel_source_ai.py`): `kneel_in1` = the idle squashed 35 % toward the key, `kneel_in2` = the key stretched 35 % back toward the idle (whole-row / column seams dropped or doubled, never blended; the head and feet bands kept row for row), `kneel_b` = the key with its upper body 1 px lower. Per-sprite knobs under `kneel.bridge` (`u`, `keep_top`, `keep_bot`, `shear`, `width`, `breath_at`) and `kneel.offset` (whole px on the key; the approved file is never edited). Checks (`kneel_checks.ai_checks`, `bridge_frame`, `bridge_holes`, `order`): K-height is reported, never a gate; the `sequence:kneel` centroid cap of the swap step `kneel_in1 -> kneel_in2` is **0.65 x** the idle-key span (KT2-A ruling; every other step 0.5); the key and its key-drawn frames (`kneel_in2`, `kneel_b`) are exempt from the K-ground **contact share** but must still reach the feet row (KT3 ruling, remorazz). Pass CB adds `kneel: {source: user}` for heroes whose key is the user's own KNEEL column (`hero_user.py`; bridged the same way; coverage `heroes 18/18 (ai 12, user 6, ...)` since pass CD-K, monsters `(ai 123, user 0, ...)`; a lance class bridges its body and carries its lance, `gen/kneel_lance.py`). Tools: `kneel_bridge_review.py --out DIR <ids>` (GIFs, x4 strips, contact sheet), `retire_kneel.py <id>` (archives a derived kneel to `_retired/<id>_kneel_v1`), `kneel_tools.py coverage | lockdiff --base REV --relock <ids> | pages | party_diff`, `puppet_kneel.py check | lock` (heroes). Key flaws are kept as notes (user ruling: no key fixes); the Bedrock pass KA-FIX is closed. Scenarios: `kt_pilot`, `kt_pilot_big`, `kneel_pilot`.
- **Runtime:** frame tables and timing are in `src/scenes/battle/enemyChoreography.ts` (pure, no PixiJS); `EnemyPoseController` plays them (lunge, hurt shake, cast, dying), and an enemy that loses its turn (sleep, stun, stone) does not lunge (`BattleStateMachine.nextActorLosesTurn`). Poison hurts at the end of the actor's turn, after the action (`src/battle/turnTick.ts`), so even lethal poison never costs the turn: the actor acts, then falls; the view presents the poison damage (and a wake) with its own line (`ActionResult.holds`). Previews: `?mute=1&scenario=anim_goblin | anim_goblin_cast | anim_bipeds | anim_beasts | anim_large | anim_boss_garland | anim_boss_lich | anim_crowd | anim_status`, plus `&enemyAnim=loop` (every enemy cycles attack, hurt, cast) or `&enemyAnim=step` (frozen; `.` / `,` step one frame, a label shows `enemy: frame / t`), and `&slow=N`.

**Battles use only the 2x art** (party, monsters with attack/cast/hurt poses, staged backgrounds); the old code-drawn battle art is gone. Missing art shows coloured placeholder boxes with a console warning. Staged backgrounds are screen-ready 1920x1080 images in `assets/backgrounds/<id>.webp`, remapped once from the hand-made sources by `python3 -I assets-src/tools/stage_backgrounds.py` (per-image horizon so every actor's feet land on the battle plain, y 360-770; see `docs/ART_BATTLE_PLAN.md`). Field art is 2x by default (96 px tiles, 20x11 view, compiled maps from `assets/maps/ai/` for the ids in its `index.yaml`); dev builds can still open the old 1x field art with `?art=legacy`. Unit tests keep the legacy 48 px layout unless they pass `?art=ai` (see `isPreviewAi`). Act-1 field previews: `?scenario=act1_castle | act1_overworld | act1_temple | knight_field`. Battle previews: `?scenario=ai_party_base | ai_boss | ai_boss_cast | ai_monsters_nine`. Debug scenarios may give enemies an action pattern with `enemyAi` (e.g. a boss that casts); for a boss with forms (`docs/CHAOS_FORMS_PLAN.md` 2.2) the override applies to the first form only and is dropped at the first form change. Automated browser tests must add `&mute=1` (dev only), which disables audio entirely.

**Adding art for new content**
- New class or NPC sprite name: add a `Look` to `ROSTER` in `characters.py` (keys must match the class id / the `sprite:` value in map YAML), then `npm run assets`.
- New hero class pair (pass CB, `docs/CLASS_BARBARIAN_PLAN.md`; first barbarian -> berserker, a shallow copy of warrior -> knight): the two `classes.yaml` entries, `ClassUpgradeSystem.CLASS_UPGRADES`, the base id in every `usableBy` its model class is in, `kits.yaml` rows, `debug-sandbox.yaml` classes, `DEFAULT_NAMES`; the user's battle sheet through `hero_user.py`; joints in `gen/anim/<class>.yaml` (puppet in-betweens; `tip_f` / part `weapon_f` for a weapon in the far hand, `part_boxes` for wide weapon heads, `alias_frames` to leave an in-between to its key) with `kneel: {source: user}`; `puppet_kneel.py lock <class>`; a `field_alias.yaml` entry until the field sheet exists.
- New enemy: add it to `assets-src/gen/monsters.yaml` (or reuse a sprite / palette-swap `variants`), generate and approve its sheet (`generate.py <id> --backend gemini --sheets monster`, `approve.py <id> monster`), then `build_assets.py monsters_ai`.
- New monster end to end (base frames, rig and in-betweens, review and play test, with the act-1 lessons): `docs/NEW_MONSTER_GUIDE.md`.
- `tests/data/assetCoverage.test.ts` fails if a class, NPC sprite, enemy, or audio-manifest entry has no asset.

**Runtime wiring**
- `CharacterAtlas` (`src/rendering/`) loads the field atlas and the 2x battle atlas once; `BattleArt` loads the monster atlas index and page 0; other pages stream through `MonsterPages` (`BattleTrigger` awaits `battleArt.ensure(formation sprites)` before it pushes the battle; page holds plus an LRU of 2 free pages; docs/ROSTER_PLAN.md 8). Roster contact sheet and distinctness report: `python3 -I assets-src/gen/monster_roster_report.py [--atlas DIR] [--calibrate]`. Both are preloaded in `ExplorationScene.enter()`, and battle falls back to coloured rectangles (with a console warning) if art is missing.
- Characters are two tiles tall: the head tile overhangs the tile above. `PlayerController`/`NPC` lift the sprite by `frameHeight - TILE_SIZE` and set `zIndex` to the feet position; `ExplorationScene.worldContainer.sortableChildren` depth-sorts them.
- Battle uses the 2x `battle-characters-ai` atlas with poses (`ready`, `attack`, `cast`, `hurt`, `down`, `victory`) via `BattleDisplayManager`, and monsters via `AiEnemyView` / `EnemyPoseController` (the `enemyChoreography.ts` frame tables: lunge, cast, hurt shake, dying) laid out by `EnemyLayoutAi` with every actor's feet on the battle plain.

## Debug Menu & Battle Scenarios

The title screen shows a **Debug** option in dev mode (`npm run dev`). It loads pre-configured battle scenarios from `assets/data/debug-scenarios.yaml` for rapid testing.

### How to Add a New Debug Scenario

1. Open `assets/data/debug-scenarios.yaml`
2. Add a new entry with a unique `id`:

```yaml
- id: boss_test
  name: Boss Test
  party:
    - class: warrior        # class ID from classes.yaml
      name: KNIGHT
      level: 10
      hp: 40                # optional: start hurt (0 = fallen)
      equipment: [mythril_sword, iron_armor, iron_shield, iron_helm]
      spells: []
    - class: white_mage
      name: HEALER
      level: 10
      equipment: [staff, robe]
      spells:
        - { id: cure, level: 1 }
        - { id: cure2, level: 3 }
  items:
    potion: 10
    hi_potion: 5
  gold: 1000
  enemies: [garland]        # enemy IDs from enemies.yaml
```

3. Selecting Debug runs the first scenario; pick another with `?scenario=<id>` in the dev URL (e.g. `http://localhost:5173/?scenario=knight_party`). Add `&art=ai` to preview approved AI battle art
4. Class IDs must match `assets/data/classes.yaml`, item IDs must match `assets/data/items.yaml`, spell IDs must match `assets/data/spells.yaml`, enemy IDs must match `assets/data/enemies.yaml`
5. Run `npm run test:fast` to verify cross-file references are valid

Scenario families (see the comments in `assets/data/debug-scenarios.yaml`; field scenarios start on a map, battle ones from **Debug**):
- `r_*` (35, R): Garland and temple balance, battle checks (heal, DARK/MUTE, shoreline), the 99 cap, shops, menus, Tent, and field starts in every act-1 map (castle, town, shops, houses, cellar, tower, overworld spots).
- `u_*` (8, U): the 400 G kit at Garland and in the temple, the Retry trap, a fallen leader, hurt-party item targets, the shop kit, lunge rows, and the command menu.

### Key Files

| File | Purpose |
|------|---------|
| `assets/data/debug-scenarios.yaml` | Scenario definitions |
| `src/systems/DebugScenarioLoader.ts` | Loads YAML, builds party, triggers battle |
| `src/scenes/TitleScene.ts` | Debug menu item (dev mode only) |

---

## Common Pitfalls

1. **Silent error swallowing** — Never write `catch { }` or `catch { /* ignore */ }`. Always log or surface errors. This caused a critical white-screen bug early in development.

2. **Data file mismatches** — If you add an item to a shop but forget to add it to `items.yaml`, the game breaks at runtime. Always run `npm run test:fast` after editing data files.

3. **Scene stack lifecycle** — When pushing a scene, the previous scene's `onPause()` fires (and it is hidden unless the pushed scene is `transparent`). When popping, `onResume()` fires. Forgetting to implement these causes bugs like encounters not pausing during menus.

4. **PixiJS in tests** — Battle logic (`src/battle/`) has zero PixiJS dependencies by design. Keep it that way. Scene tests mock the rendering layer.

5. **YAML type coercion** — YAML silently converts `no` to `false` and `123` to a number. Quote strings that look like booleans or numbers. See the YAML Gotchas table above.

6. **Audio manifest is JSON** — `assets/data/audio-manifest.json` is the one data file that is NOT YAML. It uses a different loading path (`fetch().json()`). Don't convert it.

7. **Readonly Game fields** — `Game.ts` uses private fields with getters for `party`, `inventory`, `gameFlags`. Use `Game.restoreState()` for save/load, not direct assignment.

# Agent Instructions — FF1-Style NES RPG

This document provides concrete instructions for AI agents working on this codebase. Read this before making any changes.

---

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript check + production build (tsc && vite build)
npm test             # Run all tests (9028 tests, 354 files, Vitest; measured at pass W INT; the real-world mutation suite makes a full run take about an hour)
```

**Always run `npm run build` and `npm test` after making changes.** Both must pass clean before any work is considered complete.

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
- Known exceptions being monitored (current lines / ceiling, measured at pass W INT; the TS ceilings are pinned by `tests/data/fileCeilings.test.ts`): `ExplorationScene.ts` 504 / 590 (pass W moved its vehicles and NPC actions into `src/scenes/exploration/FieldVehicles.ts` and `FieldNpcActions.ts`), `BattleStateMachine.ts` 566 / 592, `BattleScene.ts` 541 / 594, `src/types/index.ts` 424 / 442, `SpellExecutor.ts` 311 / 314, `BattleAnimationController.ts` 304 / 308, `Character.ts` 270, and the Python `layouts/castle.py` 360 / 360 and `layouts/cornelia.py` 323 / 355. `layouts/overworld.py` (202) stays under 250: its new data goes in `overworld_consts.py` or `overworld_zones.py`. `castle.py` is at its ceiling, so a change there must extract code first or be line-neutral.
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

**If you add/rename/remove any ID in a data file, run `npm test` to catch broken references.** The validation suite will pinpoint exactly which reference is broken.

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

### Running Tests

```bash
npm test                                    # All tests
npx vitest run tests/battle/               # Just battle tests
npx vitest run tests/data/crossFileValidation.test.ts  # Just data validation
npx vitest --watch                          # Watch mode
```

---

## How to Add Common Things

### New Item

1. Add entry to `assets/data/items.yaml`
2. If sold in a shop, add the item ID to the shop's `inventory` in `assets/data/shops.yaml`
3. Run `npm test` — cross-file validation will catch any broken references

### New Spell

1. Add entry to `assets/data/spells.yaml` with `id`, `name`, `level`, `type` (white/black), `effect`, `targeting`, `power`, `element`
2. If sold in a magic shop, add the spell ID to the shop's `inventory` in `assets/data/shops.yaml`
3. Run `npm test`

### New Enemy

1. Add entry to `assets/data/enemies.yaml` with stats, rewards, elemental profile
2. Add the enemy ID to encounter tables in the relevant map YAML (`assets/maps/*.yaml`)
3. Run `npm test`

### Editing a 2x Map (generated sources)

Most compiled maps come from Python layout scripts, not hand-written YAML. Each script writes its sources into `assets-src/maps/` with a `GENERATED by ...` header; edit the script, never the generated YAML:

| Script (under `assets-src/tools/layouts/`) | Writes |
|--------|--------|
| `world.py` | `overworld.yaml`, the whole 192x192 world (see "The world (pass W)" below). It pastes each region module `world_<r>.py` (`world_a1`, `world_elf`, `world_earth`, `world_fire`, `world_ordeal`, `world_water`, `world_wind`, with their data in `<region>/world_*.py`), fills the edge bands and seams, runs `world_checks.py` and is the only writer of the world source. `overworld.py` is a shim that runs it and keeps the act-1 block (`build()`, `objects()`, the act-1 checks; data in `overworld_consts.py`, `overworld_zones.py`) |
| `cornelia.py` | `cornelia.yaml` (the walled royal city, its gates and edge exits) |
| `interiors.py` | the ten house interiors `cornelia-house-<name>.yaml` (scholar, fisher, farm, knight, weaver, gardener, family, apprentice, tavern, shrine) and the six shop and inn maps (`cornelia-weapon-shop`, `-armor-shop`, `-item-shop`, `-white-magic`, `-black-magic`, `-inn`) |
| `castle.py` | `cornelia-castle.yaml`, `-2f`, `-tower`, `-cellar` |
| `cornelia_gates.py` | nothing on its own: the gate dressing `cornelia.py` places (turrets on the wall bends and beside every gate, the `town/gates` arches over the south gate, the inner gatehouse and the north postern) |
| `stubs.py` | the stub maps of canon ids no tranche has built yet (`stubs.py --check all` must print `stubs: 0 left`; since INT none are left) |
| `a1/town_pravoka.py`, `a1/town_pravoka_rooms.py` | A1: `pravoka` and its 6 houses and 6 shop / inn maps (`pravoka-house-*`, `pravoka-*-shop`, `-white-magic`, `-black-magic`, `-inn`); `a1/matoya.py`: `matoya-cave` |
| `elf/town_elfheim.py`, `elf/town_elfheim_rooms.py` | ELF: `elfheim`, its castle (`elfheim-castle`, `-castle-chamber`), the vault, 6 houses and the shops; `elf/keep.py`: `western-keep-1f`, `-2f`; `elf/marsh_b1.py` .. `marsh_b3.py`: `marsh-cave-b1` .. `-b3` |
| `earth/dwarf.py`, `earth/giant.py`, `earth/sage.py` | EARTH: `dwarf-hall` (Nerrick's canal, Smyth's forge for S31), `giant-tunnel`, `sage-cave`; `earth/town_melmond.py`, `earth/town_melmond_interiors.py`: `melmond` and its houses (Dr. Unne's among them) and shops; `earth/cavern_upper.py`, `cavern_lower.py`: `cavern-earth-b1` .. `-b5` |
| `fire/town_crescent.py`, `fire/town_crescent_rooms.py`, `fire/town_crescent_circle.py` | FIRE: `crescent`, its houses and shops, `crescent-circle` (the sages); `fire/gurgu_upper.py`, `gurgu_lower.py`: `gurgu-b1` .. `-b5`; `fire/ice_b1.py` .. `ice_b3.py`: `ice-cavern-b1` .. `-b3` |
| `ordeal/citadel.py`, `ordeal/bahamut.py` | ORDEAL: `citadel-1f` .. `-3f`; `bahamut-cave`, `bahamut-lair` |
| `water/town_onrac.py`, `water/town_onrac_interiors.py` | WATER: `onrac`, its houses and shops; `water/caravan.py`: `caravan-camp` (the bottle, 40000 G); `water/waterfall.py`: `waterfall-cave`; `water/shrine_b1.py` .. `shrine_b5.py`: `sea-shrine-b1` .. `-b5` |
| `wind/town_gaia.py`, `wind/town_gaia_interiors.py` | WIND: `gaia`, its houses, shops and `gaia-spring`; `wind/lufenia_town.py`, `lufenia_interiors.py`: `lufenia` and its houses and shops; `wind/mirage_floors.py`: `mirage-1f` .. `-3f`; `wind/sky_lower.py`, `sky_upper.py`: `sky-castle-1f` .. `-5f` |
| `past/past_upper.py`, `past/past_lower.py` | PAST: `past-temple-1` .. `-5` and `past-chaos` (the Chaos door) |

The `*_common.py`, `*_people.py`, `*_homes.py`, `*_shops.py` and `*_site.py` files of a region are libraries of those scripts (a town's `town_<t>_site.py` is its overworld site, pasted by its region's world module). Each generated source names its script in its `GENERATED by ...` header.

`temple-of-fiends.yaml` is still hand-written. Object options added in R and U:
- deco `passage: true` — the deco's above rows may cover a walkable cell (a gate arch over a road); only the arch's drawn opening is walkable, the jambs block.
- deco `style` — a `RECOLOR` entry in `build_map.py`, e.g. `pale_stone` (the bridge debris), `bright`, `brighter` (value x1.5, the temple icon).

After an edit:

```bash
python3 -I assets-src/tools/layouts/world.py              # regenerate the source(s) (the world: world.py; a map: its script)
python3 -I assets-src/tools/build_map.py overworld        # compile (validates; fails on any map-check error; takes the world-compile lock itself)
python3 -I assets-src/tools/build_map.py --preview overworld 20 30 40 45 /tmp/crop.png --grid --collision
```

Re-running every layout script must leave `git diff --exit-code assets-src/maps` clean (the scripts are deterministic), and `build_map.py --check-determinism` must pass.

### The world (pass W)

Plans: `docs/WORLD_PLAN.md` (rev 3; every tranche's result is in its Results anchor) on `docs/QUEST_PLAN.md`.

- **Size and origin.** The world map `overworld` is 192x192 cells (`world_api.py`: `WORLD_W`, `WORLD_H`, `CHUNK` 16, so
  144 chunks). The act-1 72x72 block sits at `A1_ORIGIN` (64, 64): an act-1 cell (x, y) is world (x + 64, y + 64), e.g.
  the bridge gate (29, 32) is (93, 96). The core x 64-135, y 64-135 is frozen (`FROZEN_CORE`; WORLD 2.5 lists the
  cells that may change).
- **Regions** (`BOXES`; prefix): A1 (64, 64)-(143, 143) `a1`; ELF (48, 112)-(63, 143) + (0, 144)-(111, 191) `elf`;
  EARTH (0, 64)-(63, 111) + (0, 112)-(47, 143) `ert`; FIRE (144, 64)-(191, 143) + (112, 144)-(191, 191) `fir`; ORDEAL
  (64, 0)-(127, 63) `ord`; WATER (0, 0)-(63, 63) `wat`; WIND (128, 0)-(191, 63) `wnd`. PAST lives under the act-1
  temple (`past-*` maps). The 2 cells either side of a region edge are the composer's. Two seas: the inland `aldi`
  (docks `a1_pravoka`, `elf_port`, `ert_dwarf`) and the `ocean` (`ert_melmond`, `fir_crescent`), joined by the `canal`
  patch (CANAL_OPEN). `world.py --check-bands` prints `bands: OK`, `world.py` then `basins: OK (...)`;
  `world.py --owned-chunks <region>` lists the chunk files a region may change.
- **Progression.** `assets/data/quest.yaml`: the goal CHAOS_DEFEATED, stages S0-S31 (S19 and S31 optional; all built
  since INT), each with `after`, `requires`, `grants`, `boss`, `band`, `kit` (kits.yaml), `maps`, `zones`, `grind`,
  `walk`, `entry`, `milestones` and `nonLoadBearing`, plus the 8 shop `towns` (`opensAfter`, `bandStage`, `kit`). Each
  tranche edits only its own anchor (`# === <TRANCHE> ===`).
- **The verifier** (`src/progression/`, CLI `scripts/quest-verify.ts`): a state search over flags, key items (a stage's
  grants and requirements count as key items; an ordinary chest or gift is an event only when its flag is one
  quest.yaml names), vehicles and places, firing the field rules the game runs (`src/systems/fieldRules.ts`). Proofs:
  - (a) order: the goal is reachable, no stage's grants hold before its `after` stages, every `walk` replays, each
    optional stage is reachable and not required; with `--strict` a pending stage fails;
  - (b) no skip: withholding a stage's grants (or one requirement, or its boss) keeps the later stages out of reach;
    `milestones` must come in order;
  - (c) no soft-lock: every reachable state can still reach the goal (no SOFTLOCK, STRANDED or DEADGATE);
  - (d) bands: the curve model's whole-party level at each boss (or stage end) is in its `band` (up to the top level
    + 1); a stage's kit is affordable; (d3) every `takeGold` price is at most 80 % of the gold at its stage's start
    (the caravan's bottle: 40000);
  - (e) early shops: no town's keeper is talkable before its `opensAfter`;
  - (f) price walls: Crescent and Gaia cost more than 40 % of the gold a party has on arrival, on the rushing curve
    (every `grind` 1.0, no exploring);
  - (g) geography: the anchors of `assets/data/world-anchors.yaml` lie at their targets, within the fitted scale,
    distance, bearing and detour bands of WORLD 6.1;
  - (h) travel matrix: the rows T0-T10 (+ T6b) and the two basin rows of WORLD 6.2; with `--strict` every allowed dock
    and the canal patch must be on the world map.
  `--mutate` adds the no-skip mutation suite: the gate table GT-1 to GT-37 (+ GT-5b, `questMutateRows.ts`) and the
  generic elements (`questMutateGeneric.ts`). An uncaught element needs a `nonLoadBearing` entry `{map, kind, at,
  reason}` in its stage; `element: <label>` narrows it to that one element (required for `kind: quest`) and
  `stage: <id>` to `--stage <id>` runs only. A `pending: ...` reason fails under `--strict`.
- **The curve model** (`questCurve.ts`, `questExplore.ts`): no battles. It walks the witness of (a); each route cell in
  an encounter zone adds `1 / mean steps` fights times the mode's rate and the stage's `grind` (1.0-7.0: the cap is 7,
  `GRIND_RANGE` in `schemaValidationQuest.ts`), and the first time the walk enters a map other than the world map it
  explores it once (every walkable cell of its zones, not times `grind`). Scripted battles are assumed won.
  `tests/balance/questCurve.test.ts` replays its `segments` with seeded battles (QUEST 6.4: each boss in its band,
  Chaos's door in [38, 41], wipes under 0.2 per stage).
- **Commands.** `npm run quest` (assume mode: a pending stage's grants are synthetic), `npm run quest -- --strict
  --mutate` (INT's gate), `--stage S11` (from the stage's `entry`, with its ancestors' grants; the search fires only the
  events of the stage and its ancestors, `outOfScopeEvents`, and the full run covers the other orderings), `--only abc`,
  `--json FILE`. The search stops at `MAX_STATES` = 1,000,000 (`questSearch.ts`). A full `--mutate` run takes well over
  an hour and a few GB: run it in the background.
- **Placeholder art still in the world** (code-drawn `kit.py` LANDMARKS, for a later art pass): `dock_post` "DP"
  (overworld, pravoka, onrac, crescent), `buried_hull` "BH" (the airship hull; reused for Onrac's submarine and bell
  tower), `windmill` "WM" (gaia, melmond, overworld), `tower` "TW", `cave_mouth` "CM", `volcano` "VO", `shrine` "SH",
  `waterfall` "WF", `tent` "TE", `dome` "DO" (Lufenia), `ice_floe` "IF" (the ice cavern), `sky_ring` "SR" (mirage-3f),
  and the `tuft` part in Gaia. The fairy and the mermaids are tinted NPC sheets.

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

1. Add an entry to the map source's `inspect` list (in the layout script for a generated map, e.g. the tomb in `layouts/overworld.py`): `{x, y, text: ["Here lies Erdrick."]}`. `text` is a list of strings, or a list of `{text: [...], condition: FLAG}` entries resolved like NPC dialog (first match wins); no other keys are allowed.
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
| battle_ai | `gen/approved/<class>/battle.png` | `assets/sprites/battle-characters-ai.png`, `.json` | Gemini-generated, approved 2x battle figures (80x80 native): one row per class, columns = ready, attack, cast, hurt, down, victory |
| (approved kits added in T6) | `gen/approved/overworld/grand` (broken-bridge debris; its `temple_grand` piece is skipped), `castle/stairs_lib` (top-down stairwell, map table, gold heap, crown cushion, lectern, globe), field sheets `vendor_f`, `farmer`, `burgher`; R5 added `overworld/grand_temple` (the temple ruin icon, a free re-cut of `grand`) and `town/gates` (gate arches `gate_arch_3` / `gate_arch_2`, tavern and shrine signs; `gate_side` failed review, so the W and E gates have turrets but no arch) | used by the map compiler and `field_ai` | Paid Gemini budget: 26 of 100 used (`docs/ACT1_LOG.md`; the ledger guard is authoritative) |
| field_ai | `gen/approved/<id>/field.png` | `assets/sprites/characters-ai.png`, `.json` | 2x field sprites (the default field art; dev builds show the old 1x sprites with `?art=legacy`) |
| monsters_ai | `gen/approved/<monster>/monster_*.png`, `boss_*.png` + rigs `gen/anim/monsters/<sprite>.yaml` | `assets/sprites/monsters-ai-<n>.png` pages (9 pages after the V8 fix round, measured at V8 W4: 2040x1872, 2008x1728, 2032x1200, 2048x1536, 2048x2000, 2008x768, 2048x2032, 2048x1152, 2048x1792; each <= 2048x2048, act-1 sheets on page 0; page groups in `gen/monster_pages.py`, plus a `titan` group for any `size: titan` sheet, none today), index `monsters-ai.json` (per sheet also `idleBox` [l, t, r, b], FW-A2, and `scale` for the sheets in `gen/monster_scale.yaml`, FW-S: integer display scale 2 or 3; since V4 the 23 rescaled sheets at 3: bigeyes (`size: large`) and the 22 `size: huge` enemies, the gigas, elementals, dragons, sharks, hydras, ochus, minotaurs and big eyes, `docs/REDESIGN_PLAN.md` 2.4; since V6 also chaos, `size: boss` in the 200 px boss band at scale 3 (D-V6 = C2), which `layoutSizeOf` lays out as the titan class: alone in `TITAN_AREA`, attacking in place) | Idle / attack / hurt (+ boss `cast`) per monster sprite, plus palette-swap variants from `gen/monsters.yaml`, plus the cut-out in-betweens of every rigged sprite (see "Monster animation" below). The build fails on any animation check failure |
| maps | `assets-src/maps/<id>.yaml` + kit parts (`gen/approved/<kit>/*.png`, placeholders from `tools/kit.py`) | `assets/maps/ai/<id>.yaml`, `assets/maps/ai/<id>/{below,above}_r_c.png`, `index.yaml` | Map compiler `tools/build_map.py` (docs/ART_TILES_PLAN.md): ASCII ground + placed objects (houses from roof/wall/door parts, trees, props) baked into 2x chunks; sources with `terrain: organic` (the overworld) get organic coasts, blends, foothills and peak variants and organic roads from the `tools/terrain/` package (`--metrics` prints its boundary numbers); validates reachability, collision and covering, plus the per-source opt-in checks in `tools/map_checks.py` (roads, rivers, sealed edges, warps, blobs, art coverage, NPC chokepoints, unreachable walkable cells). Output must not depend on `PYTHONHASHSEED` (`build_map.py --check-determinism`); `--preview` crops a compiled map, `tools/map_report.py <id>` prints reachability and chokepoints. Most sources are written by `tools/layouts/*.py` (see "Editing a 2x Map"). The game plays these compiled maps by default for every id in `index.yaml` (production always; dev unless `?art=legacy`; unit tests only with `?art=ai`); transitions may target named `entrances` |
| (in battle_ai / field_ai) | `gen/puppet.py` + `gen/anim/<id>.yaml` | extra columns in both 2x atlases | Cut-out in-betweens from the approved pixels (no AI): 8 battle poses per class (`idle_b`, `atk_wind1/2`, `atk_mid`, `atk_follow`, `cast_gather/rise/release`) from hand-marked joints, and 7 walk columns per direction for every field sprite (stand + contact/down/pass per foot, 3 per tile). Check with `python3 -I assets-src/gen/puppet.py review [id]`; a class without a joint file repeats its keyframes. Review fixes that must not touch a style-reference sheet (e.g. the knight's attack face) go in `battle.json` `face_fix` and are applied at build time. (Bedrock/Stability in-betweens were tried and rejected on 2026-11-13: no identity lock to a reference image, img2img redraws the whole figure, inpainting comes back grey) |
| (one-time) | `tools/stage_backgrounds.py` | `assets/backgrounds/<id>.webp` | Hand-made backgrounds remapped once onto the battle stage (1920x1080, per-image horizon); referenced by `battleBackgrounds` in map YAML. Not a build stage. `shoreline` is a composite (the party's rocks pasted below the layer's own rock line, colour-matched); `stage_backgrounds.py --check [ID ...] [--image FILE]` measures water in the feet bands, the top enemy row's water and contrast, and the largest straight vertical seam against its `CHECKS` bounds, and exits non-zero on a failure; only the composite `shoreline` has bounds (on a plain image the blue-hue water test and the seam metric measure nothing: the `CHECKS` comment). Only the ids act 1 uses are committed (`temple` = evil-temple, `evil_temple`, `abandoned_castle`, `dark_forest`, `ruined_forest`, plus the original 11); the other staged ids stay local and uncommitted |
| audio | `audio/` | `assets/audio/{music,sfx}/*.ogg` | Filenames come from `audio-manifest.json` |
| colossus | `gen/approved/chaos_forms/<form>/master.png` + layer yaml `gen/colossus/<form>.yaml` | `assets/sprites/colossus/<form>/<layer>[_<frame>].png`, `assets/sprites/colossus.json` | Pass C Chaos colossus forms (`docs/CHAOS_FORMS_PLAN.md` 18; `gen/colossus_build.py`): full-resolution painted art (rev 4, D-U10: no pixelization, soft 8-bit alpha, shown at scale 1 with linear filtering). Three entries: F2 `chaos_orrery` (1320x900, place (40, 25)), F3 `chaos_horizon` (2700x1080, place (-527, -60); layers `body`, `core` with `crack` / `open` frames, `glow` additive at half res, `texScale: 2`) and F4 `chaos_horizon_core` (an art entry reusing F3's tiles at place (-527, -285)). Layers cropped and tiled <= 2048, a pre-composited bestiary `preview.png` per form, memory counted once per tile file (16.9 MB, cap 24); the json shape is the TS contract (`colossusIndex.ts`, `colossusContract.test.ts`); no approved master = writes and prints nothing; `build_assets.py colossus --out DIR` writes a scratch copy + `manifest.sha256` (determinism, PYTHONHASHSEED 0 / 1) |

**AI sprite generation (2x art scale, in progress):** `assets-src/gen/` generates character sprites with Google
Gemini and pixelizes them; see `assets-src/gen/README.md` and `docs/ART_2X_PLAN.md`. Paid image requests go through a
budget guard: one per review checkpoint, `--paid` required, every attempt logged in `assets-src/gen/cache/ledger.jsonl`.
Stability-on-Bedrock calls (pass C: the Chaos colossus masters via `gen/colossus.py`, `docs/CHAOS_FORMS_PLAN.md` 5) are gated inside `bedrock.invoke(model, body, *, paid, purpose)`: `paid=True`, a purpose from `budget.json`'s `bedrock.per_purpose_caps`, the pass cap of 80, main checkout only, one row per request in the tracked BR ledger `assets-src/gen/cache/bedrock_ledger.jsonl` before the first try; `colossus.py budget --check` verifies it (and no Gemini call after N_C0). The rim backdrop is staged by `tools/stage_rim.py` (`stage_backgrounds.py rim` / `--check rim`; outputs `rim.webp` and the floor-front cut `rim_floor.webp`). The colossus art pipeline (`colossus.py`; one Bedrock call per background command): `gen` / `structure` / `search_replace` (renders), `nobg` (remove_bg), `upscale --model conservative --form F` (Conservative Upscale, then `upfit` to the form canvas), `inpaint` + offline `inpaint_merge` (masked chest variants, byte-identical outside the mask), and offline `glow` (sky_base, despill, the G1 diff / G2 luminance glow), `mock` (rim mock + side-by-side sheet), `review`, `approve` (archive first: `retire.py --colossus <form>`), `check`, `lock`; `selftest.py --anim` runs the colossus selftests. Run `python3 -I assets-src/gen/selftest.py` after changing the pipeline. Approved sheets live in `assets-src/gen/approved/<id>/`; the `battle_ai` and `field_ai` build stages turn them into `assets/sprites/battle-characters-ai.*` and `characters-ai.*`. Monsters come from `monsters.yaml` (`monsters_ai` stage → `assets/sprites/monsters-ai.*`; bosses are one image per pose, including `cast`).

**Monster animation** (`docs/ENEMY_ANIM_PLAN.md`, fixes in `docs/ENEMY_ANIM_ISSUES.md`): cut-out in-betweens from the approved monster pixels, no AI and no Bedrock (rejected for in-betweens on 2026-11-13). All 123 atlas sheets are rigged and locked (roster pass R and its fix passes, `docs/ROSTER_FIX_PLAN.md`, `docs/ROSTER_FIX_PLAN_2.md`; the last 11, tranche T-K and the swimmers red_piranha / white_shark, since fix pass 2 G6), so `check --all` prints no `no rig` line. Four rigs are partial under FW-Q, one sequence aliased to its keys: chimera / hurt, black_widow / hurt, crawler / attack, astos / attack (`FWQ_ALLOW`, exactly these). The atlas is 9 pages.
- **Rigs** live in `assets-src/gen/anim/monsters/<sprite>.yaml`: `body: biped | quadruped | bird` (templates in `rig.py` / `rig_templates.py`, see `gen/README.md`), joints per keyframe, `parts` (kinds include `prop`, `cloth` and `fx`), `masks`, `z`, `frames.<f>` overrides (`tweaks`, `pins`, `dy`, `drop`, `moves`), `holds` (at most 1 per sequence) and `paint` (per-frame pixel patches with a palette colour or `rgb: null`; the approved sheets are never edited). Frames: `idle_b`, `atk_wind1/2`, `atk_mid`, `atk_follow`, `atk_recover`, `hurt_in1/2`, and for bosses `cast_gather/rise/release`. A sprite without a rig gets no in-betweens (the atlas aliases each name to its source keyframe).
- **Per-frame options** (`monster_render.py`): `frames.<f>.scale: {part: s}` (0.25 ≤ s ≤ 1, `kind: fx` parts only; the lich crystal grows in at 0.55 in `cast_rise`) and `frames.<f>.sampler: nearest | rotsprite` (overrides the rig's `sampler`).
- **Commands:** `python3 -I assets-src/gen/monster_anim.py mark <id>` (zoomed keyframes with joints and parts), `check [ids|--all]` (every check plus the lock files; must print only `OK` lines), `review [ids]` (strips, onion sheet, GIFs and `_stage.png` in `gen/out/anim/review/monsters/`, plus the report-only mask overlap and edge-roughness top 10), `lock <id>` (writes `<id>.lock.json` with every frame's hash; only after an image review passes). Review-strip coordinates are 4x frame pixels: native = (px − 2) / 4.
- **Checks** (`anim_checks.py`, `anim_efix.py`, `monster_check.py`; list in `ENEMY_ANIM_PLAN.md` 5.1): binary alpha, palette lock, no magenta fringe, no detached pixels, no seams, silhouette continuity (fx pixels and their outline excluded), outline, feet anchored, no clipping, rotation cap, atlas exactness, locks and determinism, prop carry, holds cap, and the efix gates F3 fx-mask integrity, F4 intra-part crease, F5 foot release only in a rearing hurt, F7 prop attached. The efix gates run in `check`, `review` and the `monsters_ai` build (`efix_gates=True`). The fx parts are an allowlist enforced by `selftest_efix.py` (garland `glow`, lich `trail` and `crystal`, hollow_seraph `halo`, which brightens only at its cast frames via `frames.<f>.brighten`; pass V dropped vampire `slash` with the old vampire rig and re-confirmed the halo on the new seraph rig, so `FX_PENDING` is empty): a new `kind: fx` needs approval.
- **Fix-pass tools** (`docs/ROSTER_FIX_PLAN.md` 3): `paint` on a keyframe (FW-P, `monster_keys.py`: <= 160 px per key, approved palette or null, `kf_paint_cap` only for the allowlisted crocodile/hurt 220, drowned_sovereign/cast 300 and chimera attack 800 / hurt 600, locked as `kf:<key>`), rig `raise: false` (FW-R: no raise frames, the heavy `tip` from `atk_wind2`), rig `key_offset: {key: [dx, dy]}` (FW-O: moves an approved key by whole px with its joints, masks and keyframe paint; locked as `kf:<key>`), rig `hurt_from: idle` (FW-H: a boss with no approved hurt gets its hurt key from the idle, recoil via `key_offset` / keyframe paint, locked as `kf:hurt`; only `HURT_FROM_ALLOW` = hollow_seraph), rig `alias: [hurt | attack]` (FW-Q: a partial rig leaves that sequence's in-betweens aliased to their keys; only `FWQ_ALLOW` sheets; `check` prints `OK (aliased: ...)`), the floating cutter lift (FW-C: `monster.cut` lifts a low floating cell to the 2 px bottom margin, at most `LIFT_MAX` 36), the atlas anchors `travelTop` / `lungeRight` / `homeX` (FW-A, inclusive; ranged sheets add their attack frames to `homeX`), and the measurement tool `gen/fixmeasure.py` (`travel | partc | pieces | fills | colours | diff | select`, plus round 2's `edges | match | poly | switch | rowspan | sweep` in `fixmeasure_edges.py`) that every fix gate runs.
- **Pass V tools** (`docs/REDESIGN_PLAN.md`): `gen/retire.py` archives a sprite before its redesign (`<id>` -> `approved/_retired/<id>_vN/`, `anim/monsters/_retired/`, `gen/retired/monsters_vN.yaml`; `--move-rig`, `--prune`, `--revive <id>_vN --as <new_id>`; index `docs/RETIRED_SPRITES.md`; builds and checks never read `_retired`, `selftest_retire.py`); `approve.py` refuses to overwrite a monster/boss sheet without an archive copy; the titan band (`size: titan`, 300 cell, feet 292, fail-closed cut; `monster.py --titan-probe <raw ...>`); the pass-V budget (50 images, only the redesigned ids and their sheets, `selftest_passv.py`; FW-V8 `sheet_caps` `{"<id>/<sheet>": 3..6}` on the pass, read by both per-sheet rules, other sheets 3; the V8 round halts at 47); the cutter options `cut: {keep_pieces: all_in_cell}` (keep separate floating pieces) `cut: {fit: headroom, top_margin: N}` (shrink a figure that would reach above row N) and, per-pose only, `cut: {match_height: idle, tolerance: 0.10}` (scale an action pose to the approved idle's height +- tolerance: size is normalised, never a rejection reason; all three change no cache key, so a ledgered render re-cuts at 0 images). Pass V redesigned and re-rigged 8 sprites (crazy_horse, piscodemon, black_knight, guardian, vampire, hollow_seraph with four blade wings and no raise, chaos as a two-armed robed overlord, and the red dragon redrawn upright); their old looks are archived as `<id>_v1` (`docs/RETIRED_SPRITES.md`). The V8 fix round (`docs/REDESIGN_FIX_PLAN.md`) regenerated crazy_horse (a skull-headed horse with smoke legs), piscodemon (slanted glowing eyes) and hollow_seraph (hilt-less blade wings of light, its hurt key derived from the idle by `hurt_from: idle`), archived as `<id>_v2`; black_knight got keyframe paint (pointed horns, T visor) and chaos `raise: false`.
- **Locks:** a changed frame fails `check --all` with `hash differs from the lock file` until it is re-reviewed and re-locked; the build only warns. The monster atlas must not depend on `PYTHONHASHSEED`, and a `monsters_ai` build leaves the party atlases byte-identical.
- **Kneel (passes K and KT; `docs/KNEEL_PLAN.md`, `docs/KNEEL_TWEEN_PLAN.md`):** the battle kneel track (`src/scenes/battle/kneelChoreography.ts`: `kneel_in1` 4, `kneel_in2` 4, a `kneel` / `kneel_b` hold every 48, the rise `kneel_in2` 3, `kneel_in1` 3; preview `&kneel=loop`) plays four atlas cells per sprite. Since KT3 every one of the 123 monster sheets and 12 hero classes uses its **approved AI kneel key** (`approved/<id>/kneel.png`, heroes `approved/<class>/battle_kneel.png`) through `kneel: {source: ai}` in the rig / class file (`kneel_tools.py coverage`: `ai 123` / `ai 12`, derived 0, alias 0). The three other cells are a **one-source bridge** (`gen/kneel_bridge.py`, `kneel_seams.py`, `kneel_source_ai.py`): `kneel_in1` = the idle squashed 35 % toward the key, `kneel_in2` = the key stretched 35 % back toward the idle (whole-row / column seams dropped or doubled, never blended; the head and feet bands kept row for row), `kneel_b` = the key with its upper body 1 px lower. Per-sprite knobs under `kneel.bridge` (`u`, `keep_top`, `keep_bot`, `shear`, `width`, `breath_at`) and `kneel.offset` (whole px on the key; the approved file is never edited). Checks (`kneel_checks.ai_checks`, `bridge_frame`, `bridge_holes`, `order`): K-height is reported, never a gate; the `sequence:kneel` centroid cap of the swap step `kneel_in1 -> kneel_in2` is **0.65 x** the idle-key span (KT2-A ruling; every other step 0.5); the key and its key-drawn frames (`kneel_in2`, `kneel_b`) are exempt from the K-ground **contact share** but must still reach the feet row (KT3 ruling, remorazz). Tools: `kneel_bridge_review.py --out DIR <ids>` (GIFs, x4 strips, contact sheet), `retire_kneel.py <id>` (archives a derived kneel to `_retired/<id>_kneel_v1`), `kneel_tools.py coverage | lockdiff --base REV --relock <ids> | pages | party_diff`, `puppet_kneel.py check | lock` (heroes). Key flaws are kept as notes (user ruling: no key fixes); the Bedrock pass KA-FIX is closed. Scenarios: `kt_pilot`, `kt_pilot_big`, `kneel_pilot`.
- **Runtime:** frame tables and timing are in `src/scenes/battle/enemyChoreography.ts` (pure, no PixiJS); `EnemyPoseController` plays them (lunge, hurt shake, cast, dying), and an enemy that loses its turn (sleep, stun, stone) does not lunge (`BattleStateMachine.nextActorLosesTurn`). Poison hurts at the end of the actor's turn, after the action (`src/battle/turnTick.ts`), so even lethal poison never costs the turn: the actor acts, then falls; the view presents the poison damage (and a wake) with its own line (`ActionResult.holds`). Previews: `?mute=1&scenario=anim_goblin | anim_goblin_cast | anim_bipeds | anim_beasts | anim_large | anim_boss_garland | anim_boss_lich | anim_crowd | anim_status`, plus `&enemyAnim=loop` (every enemy cycles attack, hurt, cast) or `&enemyAnim=step` (frozen; `.` / `,` step one frame, a label shows `enemy: frame / t`), and `&slow=N`.

**Battles use only the 2x art** (party, monsters with attack/cast/hurt poses, staged backgrounds); the old code-drawn battle art is gone. Missing art shows coloured placeholder boxes with a console warning. Staged backgrounds are screen-ready 1920x1080 images in `assets/backgrounds/<id>.webp`, remapped once from the hand-made sources by `python3 -I assets-src/tools/stage_backgrounds.py` (per-image horizon so every actor's feet land on the battle plain, y 360-770; see `docs/ART_BATTLE_PLAN.md`). Field art is 2x by default (96 px tiles, 20x11 view, compiled maps from `assets/maps/ai/` for the ids in its `index.yaml`); dev builds can still open the old 1x field art with `?art=legacy`. Unit tests keep the legacy 48 px layout unless they pass `?art=ai` (see `isPreviewAi`). Act-1 field previews: `?scenario=act1_castle | act1_overworld | act1_temple | knight_field`. Battle previews: `?scenario=ai_party_base | ai_boss | ai_boss_cast | ai_monsters_nine`. Debug scenarios may give enemies an action pattern with `enemyAi` (e.g. a boss that casts); for a boss with forms (`docs/CHAOS_FORMS_PLAN.md` 2.2) the override applies to the first form only and is dropped at the first form change. Automated browser tests must add `&mute=1` (dev only), which disables audio entirely.

**Adding art for new content**
- New class or NPC sprite name: add a `Look` to `ROSTER` in `characters.py` (keys must match the class id / the `sprite:` value in map YAML), then `npm run assets`.
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
5. Run `npm test` to verify cross-file references are valid

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

2. **Data file mismatches** — If you add an item to a shop but forget to add it to `items.yaml`, the game breaks at runtime. Always run `npm test` after editing data files.

3. **Scene stack lifecycle** — When pushing a scene, the previous scene's `onPause()` fires (and it is hidden unless the pushed scene is `transparent`). When popping, `onResume()` fires. Forgetting to implement these causes bugs like encounters not pausing during menus.

4. **PixiJS in tests** — Battle logic (`src/battle/`) has zero PixiJS dependencies by design. Keep it that way. Scene tests mock the rendering layer.

5. **YAML type coercion** — YAML silently converts `no` to `false` and `123` to a number. Quote strings that look like booleans or numbers. See the YAML Gotchas table above.

6. **Audio manifest is JSON** — `assets/data/audio-manifest.json` is the one data file that is NOT YAML. It uses a different loading path (`fetch().json()`). Don't convert it.

7. **Readonly Game fields** — `Game.ts` uses private fields with getters for `party`, `inventory`, `gameFlags`. Use `Game.restoreState()` for save/load, not direct assignment.

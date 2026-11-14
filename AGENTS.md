# Agent Instructions — FF1-Style NES RPG

This document provides concrete instructions for AI agents working on this codebase. Read this before making any changes.

---

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript check + production build (tsc && vite build)
npm test             # Run all tests (879+ tests, 76+ files, Vitest)
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
- Known exceptions being monitored: `BattleStateMachine.ts`, `BattleScene.ts`, `ExplorationScene.ts`, `BattleAnimationController.ts` (~296), `Character.ts`, and the Python `layouts/castle.py` (~350) and `layouts/cornelia.py` (~345).
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
- **Shared mocks**: `tests/helpers/testUtils.ts` exports `createMockGame()` and `createMapData()`. Use these instead of creating ad-hoc mocks.
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

| Script | Writes |
|--------|--------|
| `assets-src/tools/layouts/overworld.py` | `overworld.yaml` (the act-1 overworld: peninsula, sound, mainland, spine range, roads, tomb) |
| `assets-src/tools/layouts/cornelia.py` | `cornelia.yaml` (the walled royal city, its gates and edge exits) |
| `assets-src/tools/layouts/interiors.py` | the ten house interiors `cornelia-house-<name>.yaml` (scholar, fisher, farm, knight, weaver, gardener, family, apprentice, tavern, shrine) and the six shop and inn maps (`cornelia-weapon-shop`, `-armor-shop`, `-item-shop`, `-white-magic`, `-black-magic`, `-inn`) |
| `assets-src/tools/layouts/castle.py` | `cornelia-castle.yaml`, `-2f`, `-tower`, `-cellar` |

`temple-of-fiends.yaml` is still hand-written. After an edit:

```bash
python3 -I assets-src/tools/layouts/overworld.py          # regenerate the source(s)
python3 -I assets-src/tools/build_map.py overworld        # compile (validates; fails on any map-check error)
python3 -I assets-src/tools/build_map.py --preview overworld 20 30 40 45 /tmp/crop.png --grid --collision
```

Re-running every layout script must leave `git diff --exit-code assets-src/maps` clean (the scripts are deterministic), and `build_map.py --check-determinism` must pass.

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
- **NES font fixes** — kill indicator uses `*` instead of `☠`

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
| (approved kits added in T6) | `gen/approved/overworld/grand` (broken-bridge debris; its `temple_grand` piece is skipped), `castle/stairs_lib` (top-down stairwell, map table, gold heap, crown cushion, lectern, globe), field sheets `vendor_f`, `farmer`, `burgher` | used by the map compiler and `field_ai` | Paid Gemini budget: 25 of 100 used (the ledger guard is authoritative) |
| field_ai | `gen/approved/<id>/field.png` | `assets/sprites/characters-ai.png`, `.json` | 2x field sprites (the default field art; dev builds show the old 1x sprites with `?art=legacy`) |
| monsters_ai | `gen/approved/<monster>/monster_*.png`, `boss_*.png` | `assets/sprites/monsters-ai.png`, `.json` | Idle / attack / hurt (+ boss `cast`) per monster sprite, plus palette-swap variants from `gen/monsters.yaml` |
| maps | `assets-src/maps/<id>.yaml` + kit parts (`gen/approved/<kit>/*.png`, placeholders from `tools/kit.py`) | `assets/maps/ai/<id>.yaml`, `assets/maps/ai/<id>/{below,above}_r_c.png`, `index.yaml` | Map compiler `tools/build_map.py` (docs/ART_TILES_PLAN.md): ASCII ground + placed objects (houses from roof/wall/door parts, trees, props) baked into 2x chunks; sources with `terrain: organic` (the overworld) get organic coasts, blends, foothills and peak variants and organic roads from the `tools/terrain/` package (`--metrics` prints its boundary numbers); validates reachability, collision and covering, plus the per-source opt-in checks in `tools/map_checks.py` (roads, rivers, sealed edges, warps, blobs, art coverage, NPC chokepoints, unreachable walkable cells). Output must not depend on `PYTHONHASHSEED` (`build_map.py --check-determinism`); `--preview` crops a compiled map, `tools/map_report.py <id>` prints reachability and chokepoints. Most sources are written by `tools/layouts/*.py` (see "Editing a 2x Map"). The game plays these compiled maps by default for every id in `index.yaml` (production always; dev unless `?art=legacy`; unit tests only with `?art=ai`); transitions may target named `entrances` |
| (in battle_ai / field_ai) | `gen/puppet.py` + `gen/anim/<id>.yaml` | extra columns in both 2x atlases | Cut-out in-betweens from the approved pixels (no AI): 8 battle poses per class (`idle_b`, `atk_wind1/2`, `atk_mid`, `atk_follow`, `cast_gather/rise/release`) from hand-marked joints, and 7 walk columns per direction for every field sprite (stand + contact/down/pass per foot, 3 per tile). Check with `python3 -I assets-src/gen/puppet.py review [id]`; a class without a joint file repeats its keyframes. Review fixes that must not touch a style-reference sheet (e.g. the knight's attack face) go in `battle.json` `face_fix` and are applied at build time. (Bedrock/Stability in-betweens were tried and rejected on 2026-11-13: no identity lock to a reference image, img2img redraws the whole figure, inpainting comes back grey) |
| (one-time) | `tools/stage_backgrounds.py` | `assets/backgrounds/<id>.webp` | Hand-made backgrounds remapped once onto the battle stage (1920x1080, per-image horizon); referenced by `battleBackgrounds` in map YAML. Not a build stage. Only the ids act 1 uses are committed (`temple` = evil-temple, `evil_temple`, `abandoned_castle`, `dark_forest`, `ruined_forest`, plus the original 11); the other staged ids stay local and uncommitted |
| audio | `audio/` | `assets/audio/{music,sfx}/*.ogg` | Filenames come from `audio-manifest.json` |

**AI sprite generation (2x art scale, in progress):** `assets-src/gen/` generates character sprites with Google
Gemini and pixelizes them; see `assets-src/gen/README.md` and `docs/ART_2X_PLAN.md`. Paid image requests go through a
budget guard: one per review checkpoint, `--paid` required, every attempt logged in `assets-src/gen/cache/ledger.jsonl`.
Run `python3 -I assets-src/gen/selftest.py` after changing the pipeline. Approved sheets live in `assets-src/gen/approved/<id>/`; the `battle_ai` and `field_ai` build stages turn them into `assets/sprites/battle-characters-ai.*` and `characters-ai.*`. Monsters come from `monsters.yaml` (`monsters_ai` stage → `assets/sprites/monsters-ai.*`; bosses are one image per pose, including `cast`).

**Battles use only the 2x art** (party, monsters with attack/cast/hurt poses, staged backgrounds); the old code-drawn battle art is gone. Missing art shows coloured placeholder boxes with a console warning. Staged backgrounds are screen-ready 1920x1080 images in `assets/backgrounds/<id>.webp`, remapped once from the hand-made sources by `python3 -I assets-src/tools/stage_backgrounds.py` (per-image horizon so every actor's feet land on the battle plain, y 360-770; see `docs/ART_BATTLE_PLAN.md`). Field art is 2x by default (96 px tiles, 20x11 view, compiled maps from `assets/maps/ai/` for the ids in its `index.yaml`); dev builds can still open the old 1x field art with `?art=legacy`. Unit tests keep the legacy 48 px layout unless they pass `?art=ai` (see `isPreviewAi`). Act-1 field previews: `?scenario=act1_castle | act1_overworld | act1_temple | knight_field`. Battle previews: `?scenario=ai_party_base | ai_boss | ai_boss_cast | ai_monsters_nine`. Debug scenarios may give enemies an action pattern with `enemyAi` (e.g. a boss that casts). Automated browser tests must add `&mute=1` (dev only), which disables audio entirely.

**Adding art for new content**
- New class or NPC sprite name: add a `Look` to `ROSTER` in `characters.py` (keys must match the class id / the `sprite:` value in map YAML), then `npm run assets`.
- New enemy: add it to `assets-src/gen/monsters.yaml` (or reuse a sprite / palette-swap `variants`), generate and approve its sheet (`generate.py <id> --backend gemini --sheets monster`, `approve.py <id> monster`), then `build_assets.py monsters_ai`.
- `tests/data/assetCoverage.test.ts` fails if a class, NPC sprite, enemy, or audio-manifest entry has no asset.

**Runtime wiring**
- `CharacterAtlas` (`src/rendering/`) loads the field atlas and the 2x battle atlas once; `BattleArt` preloads the monster atlas. Both are preloaded in `ExplorationScene.enter()`, and battle falls back to coloured rectangles (with a console warning) if art is missing.
- Characters are two tiles tall: the head tile overhangs the tile above. `PlayerController`/`NPC` lift the sprite by `frameHeight - TILE_SIZE` and set `zIndex` to the feet position; `ExplorationScene.worldContainer.sortableChildren` depth-sorts them.
- Battle uses the 2x `battle-characters-ai` atlas with poses (`ready`, `attack`, `cast`, `hurt`, `down`, `victory`) via `BattleDisplayManager`, and monsters via `AiEnemyView` / `EnemyPoseController` (lunge, cast, hurt shake) laid out by `EnemyLayoutAi` with every actor's feet on the battle plain.

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

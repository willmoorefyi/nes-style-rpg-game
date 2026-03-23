# YAML Migration Plan v2

## Changelog (v1 → v2)

| # | Momus Ref | Type | Change |
|---|-----------|------|--------|
| 1 | Concern #5 | **Factual fix** | WP6c: DataLoader.test.ts mock DOES need updating — `load` → `loadYaml`. Added WP6c sub-task. |
| 2 | Concern #1 | Advisory | WP1: Strengthened runtime-vs-build-time rationale. Acknowledged Vite plugin alternative and ~30KB cost. Explained why runtime was chosen anyway. |
| 3 | Concern #2 | Advisory | Added **Appendix A: YAML Gotchas for Content Authors** with Norway problem, boolean coercion, colon/hash quoting, multiline syntax. |
| 4 | Concern #6 | Advisory | Updated total effort estimate from ~1.5h to ~2–2.5h. |
| 5 | Concern #4 | Cosmetic | WP6a: Added note to update test description strings referencing `.json` filenames to `.yaml`. |

---

## Success Criteria

```json
{
  "functional": [
    "All 6 data YAML files parse to identical JS objects as current JSON",
    "DataLoader loads YAML files at runtime without errors",
    "All 437 tests pass after migration",
    "Cross-file validation test reads YAML files correctly",
    "Map files load and render identically",
    "Schema validation works unchanged on parsed YAML objects"
  ],
  "observable": [
    "No .json data files remain in assets/data/ (except audio-manifest.json)",
    "No .json map files remain in assets/maps/",
    "npm run build succeeds",
    "npm run test passes all 437 tests"
  ],
  "pass_fail": [
    "JSON.stringify(yamlParsed) === JSON.stringify(originalJson) for every file",
    "Zero test regressions",
    "Zero runtime console errors"
  ]
}
```

---

## Inventory of Files to Migrate

### Data files (assets/data/)
| File | Records | Complexity |
|------|---------|------------|
| items.json | 21 items | Medium — nested stats, usableBy arrays |
| spells.json | 19 spells | Medium — many string fields |
| enemies.json | 2 enemies | Medium — nested stats block |
| classes.json | 6 classes | Medium — nested statGrowth, spellLevels |
| shops.json | 6 shops | Simple — flat with inventory arrays |

### Map files (assets/maps/)
| File | Complexity |
|------|------------|
| test-town.json | Low (placeholder) — small tile arrays, encounters |

### Excluded from migration
| File | Reason |
|------|--------|
| audio-manifest.json | Loaded via `fetch().json()` in Game.ts, not through DataLoader. Simple key-value mapping. Migrate separately or leave as JSON. |

### Code that references .json paths (must update)

**Source files (9 references):**
| File | Line | Reference |
|------|------|-----------|
| src/data/ItemRegistry.ts | 10 | `'assets/data/items.json'` |
| src/data/SpellRegistry.ts | 10 | `'assets/data/spells.json'` |
| src/data/ClassRegistry.ts | 10 | `'assets/data/classes.json'` |
| src/data/ShopRegistry.ts | 10 | `'assets/data/shops.json'` |
| src/systems/BattleTrigger.ts | 56 | `'assets/data/enemies.json'` |
| src/systems/MapLoader.ts | 25 | `` `assets/maps/${mapId}.json` `` |
| src/systems/MapTransition.ts | 28 | `` `assets/maps/${mapId}.json` `` |
| src/core/Game.ts | 62 | `'assets/data/audio-manifest.json'` (KEEP) |

**Test files (4 files):**
| File | Impact |
|------|--------|
| tests/data/crossFileValidation.test.ts | Reads 6 files with `fs.readFileSync` + `JSON.parse` — must switch to YAML parse |
| tests/core/DataLoader.test.ts | Uses mock AssetLoader — mock provides `load()` but WP3 changes DataLoader to call `loadYaml()`. **Mock must be updated (WP6c).** |
| tests/scenes/ExplorationScene.test.ts | Asserts mock called with `'assets/maps/test-town.json'` — update expected string |
| tests/systems/MapLoader.test.ts | Asserts mock called with `'assets/maps/my-map.json'` — update expected string |

---

## WP1: YAML Library Selection & Installation

**Recommendation: `yaml` (npm package, aka `yaml@2.x`)**

| Criteria | `yaml` | `js-yaml` |
|----------|--------|-----------|
| TypeScript types | Built-in | @types/js-yaml needed |
| Bundle size (min+gz) | ~30KB | ~25KB |
| YAML 1.2 spec | Full | Partial (1.1 default) |
| Maintenance | Active | Active |
| API | Modern (parse/stringify) | Similar |

**Key decision: Runtime parsing, not build-time conversion.**

Rationale — build-time conversion via a Vite plugin (e.g., `@modyfi/vite-plugin-yaml` or a custom 10-line plugin) is a viable alternative that would avoid shipping the ~30KB YAML parser to the browser. That approach converts YAML→JSON at build time so the browser never sees YAML. We chose runtime parsing anyway for these reasons:

1. **Simpler pipeline.** No Vite plugin to configure, maintain, or debug. The `yaml` package is a single `import { parse } from 'yaml'` — no build-tool coupling.
2. **True hot reload of YAML in dev.** With runtime parsing, editing a YAML file and refreshing the browser shows changes instantly. A Vite plugin also supports HMR, but only if the plugin is correctly wired — one more thing to get right and keep working across Vite upgrades.
3. **Content author testing without rebuild.** In phases 17a–17d, content authors will hand-edit YAML data files. Runtime parsing means they can test changes by refreshing the browser without waiting for a build step. This is the same workflow they'd have editing JSON today.
4. **~30KB is acceptable for this project.** The game already loads sprite sheets, tile maps, and audio assets totaling several MB. A 30KB parser adds negligible load time. This is not a latency-sensitive web app — it's a retro RPG.

If bundle size becomes a concern later, switching to build-time conversion is a straightforward refactor: add a Vite plugin, remove the `yaml` runtime import, and revert `loadYaml()` to `load()`.

**Files to create/modify:**
- `package.json` — add `yaml` as dependency

**Commands:**
```bash
npm install yaml
```

**Acceptance criteria:**
- `yaml` appears in `dependencies` in package.json
- `import { parse } from 'yaml'` works in both src/ and tests/

**Effort:** 5 minutes

---

## WP2: Data File Conversion (JSON → YAML)

### YAML Style Conventions
- 2-space indentation
- No quotes on simple strings (quote strings containing `:`, `#`, or special YAML chars)
- Section comments with `# ═══ SECTION ═══` for major groupings
- Inline comments for non-obvious values
- Flow-style arrays for short lists (e.g., `usableBy: [warrior, thief]`)
- Block-style for complex nested objects

> ⚠️ See **Appendix A** for YAML gotchas that content authors must know before hand-editing data files in phases 17a–17d.

### Before/After Examples

**classes.json → classes.yaml (simple nested)**

Before (JSON):
```json
{
  "id": "warrior",
  "name": "Warrior",
  "baseStats": { "hp": 35, "strength": 20, "agility": 5, "intelligence": 1, "vitality": 10, "luck": 5 },
  "statGrowth": { "hp": 6, "strength": 3, "agility": 1, "intelligence": 0, "vitality": 2, "luck": 1 },
  "usableEquipment": ["sword", "axe", "hammer", "heavy_armor", "shield"],
  "spellLevels": { "white": 0, "black": 0 }
}
```

After (YAML):
```yaml
# ═══ WARRIOR ═══
- id: warrior
  name: Warrior
  baseStats:
    hp: 35
    strength: 20
    agility: 5
    intelligence: 1
    vitality: 10
    luck: 5
  statGrowth:
    hp: 6
    strength: 3
    agility: 1
    intelligence: 0
    vitality: 2
    luck: 1
  usableEquipment: [sword, axe, hammer, heavy_armor, shield]
  spellLevels: { white: 0, black: 0 }
```

**items.json → items.yaml (medium complexity)**

Before (JSON):
```json
{ "id": "iron_sword", "name": "Iron Sword", "type": "weapon", "stats": { "attack": 14 }, "price": 175, "usableBy": ["warrior", "red_mage"] }
```

After (YAML):
```yaml
# ═══ WEAPONS ═══
- id: iron_sword
  name: Iron Sword
  type: weapon
  stats: { attack: 14 }
  price: 175
  usableBy: [warrior, red_mage]
```

**spells.yaml — with descriptive comments:**
```yaml
# ═══ WHITE MAGIC — LEVEL 1 ═══
- id: cure
  name: CURE
  level: 1
  type: white
  effect: heal
  targeting: single
  description: Restore HP to one ally
  power: 30
  element: none
```

### Conversion approach
Use a Node.js script to automate JSON→YAML conversion with round-trip verification:

```bash
# One-time conversion script (run once, then delete)
node scripts/convert-json-to-yaml.mjs
```

The script will:
1. Read each JSON file
2. Write YAML with `yaml.stringify()` using `{indent: 2, lineWidth: 120}`
3. Re-parse the YAML and deep-compare to original JSON
4. Only delete JSON file after verification passes

**Files to create:**
- `scripts/convert-json-to-yaml.mjs` (temporary conversion script)

**Files to create (output):**
- `assets/data/items.yaml`
- `assets/data/spells.yaml`
- `assets/data/enemies.yaml`
- `assets/data/classes.yaml`
- `assets/data/shops.yaml`
- `assets/maps/test-town.yaml`

**Files to delete (after verification):**
- `assets/data/items.json`
- `assets/data/spells.json`
- `assets/data/enemies.json`
- `assets/data/classes.json`
- `assets/data/shops.json`
- `assets/maps/test-town.json`

**Acceptance criteria:**
- Every YAML file parses to identical JS object as original JSON
- YAML files have section comments for readability
- Flow-style used for short arrays (usableBy, inventory, equipment lists)

**Effort:** 40 minutes

**Dependencies:** WP1

---

## WP3: DataLoader + AssetLoader Refactoring

### Approach: Add YAML loading to AssetLoader

The current flow is:
```
Registry.init() → DataLoader.loadX(path) → AssetLoader.load(path) → PixiJS Assets.load()
```

PixiJS `Assets.load()` auto-detects JSON by extension and parses it. For YAML, we need to:
1. Add a `loadYaml<T>(path)` method to `AssetLoader` that fetches text and parses with `yaml.parse()`
2. Update `DataLoader` methods to call `loadYaml()` instead of `load()`

**Note:** This means data files are no longer loaded through PixiJS's asset pipeline. No code currently uses `Assets.get()` for data files, so this is safe — but it's a behavioral change worth noting.

**Changes to `src/core/AssetLoader.ts`:**
```typescript
import { parse } from 'yaml';

// Add method:
async loadYaml<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  const text = await response.text();
  return parse(text) as T;
}
```

**Changes to `src/core/DataLoader.ts`:**
- Change all `this.assets.load<T>(path)` calls to `this.assets.loadYaml<T>(path)`
- No other changes needed — schema validation operates on parsed JS objects

**Files to modify:**
- `src/core/AssetLoader.ts` — add `loadYaml()` method
- `src/core/DataLoader.ts` — switch from `load()` to `loadYaml()`

**Acceptance criteria:**
- `DataLoader.loadClasses('assets/data/classes.yaml')` returns identical data
- All schema validation still works (it validates JS objects, not JSON text)
- `loadYaml` properly throws on fetch failure or invalid YAML

**Effort:** 15 minutes

**Dependencies:** WP1

---

## WP4: Map File Handling

### Decision: Convert maps to YAML too.

Rationale:
- `test-town.json` is hand-authored, not Tiled-exported (no Tiled dependency detected)
- The map is small (10x10) with minimal tile data (just `[[0]]` placeholder)
- Encounters, NPCs, and transitions benefit greatly from YAML readability
- When real maps are authored in phases 17a-17d, YAML comments will help document encounter zones, NPC placements, etc.

### Large tile array handling
For maps with large tile arrays, use YAML flow-style for tile rows:
```yaml
layers:
  - [0, 0, 1, 1, 0, 0, 1, 1, 0, 0]  # Row 0
  - [0, 1, 1, 1, 1, 1, 1, 1, 1, 0]  # Row 1
```

This keeps tile data compact while still being more readable than a single JSON array.

### test-town.yaml example:
```yaml
id: test-town
width: 10
height: 10
layers:
  - [0]
tilesets: [town]
collision: []

# ═══ NPCs ═══
npcs: []

# ═══ MAP TRANSITIONS ═══
transitions: []

# ═══ RANDOM ENCOUNTERS ═══
encounterRate:
  min: 5
  max: 10
encounters:
  - enemies: [goblin]
    weight: 3
  - enemies: [goblin, goblin]
    weight: 2
  - enemies: [wolf]
    weight: 1
```

**Files to modify:**
- `src/systems/MapLoader.ts` line 25 — change `.json` to `.yaml`
- `src/systems/MapTransition.ts` line 28 — change `.json` to `.yaml`

**Acceptance criteria:**
- Map loads and renders identically
- Encounter system works with YAML-loaded map data

**Effort:** 10 minutes (included in WP2 conversion)

**Dependencies:** WP2, WP3

---

## WP5: Registry Path Updates

All four registries and BattleTrigger have hardcoded `.json` paths.

**Files to modify with exact changes:**

| File | Line | Old | New |
|------|------|-----|-----|
| src/data/ItemRegistry.ts | 10 | `'assets/data/items.json'` | `'assets/data/items.yaml'` |
| src/data/SpellRegistry.ts | 10 | `'assets/data/spells.json'` | `'assets/data/spells.yaml'` |
| src/data/ClassRegistry.ts | 10 | `'assets/data/classes.json'` | `'assets/data/classes.yaml'` |
| src/data/ShopRegistry.ts | 10 | `'assets/data/shops.json'` | `'assets/data/shops.yaml'` |
| src/systems/BattleTrigger.ts | 56 | `'assets/data/enemies.json'` | `'assets/data/enemies.yaml'` |
| src/systems/MapLoader.ts | 25 | `` `assets/maps/${mapId}.json` `` | `` `assets/maps/${mapId}.yaml` `` |
| src/systems/MapTransition.ts | 28 | `` `assets/maps/${mapId}.json` `` | `` `assets/maps/${mapId}.yaml` `` |

**NOT changed:**
- `src/core/Game.ts` line 62 — `audio-manifest.json` stays JSON (loaded via `fetch().json()`, not through DataLoader)

**Acceptance criteria:**
- `grep -rn '\.json' src/ --include='*.ts'` returns only `AssetLoader.ts` (the `.json()` method call) and `Game.ts` (audio-manifest)

**Effort:** 10 minutes

**Dependencies:** WP2, WP3

---

## WP6: Test Updates

### 6a. crossFileValidation.test.ts (CRITICAL)

This test reads data files directly with `fs.readFileSync` + `JSON.parse`. Must switch to YAML.

**Changes:**
```typescript
// Add import
import { parse } from 'yaml';

// Change all 6 file reads from:
JSON.parse(readFileSync(join(dataDir, 'items.json'), 'utf-8'))
// To:
parse(readFileSync(join(dataDir, 'items.yaml'), 'utf-8'))

// Same for: spells, enemies, classes, shops, test-town
```

Specifically, 6 lines change (lines 12-27):
- `items.json` → `items.yaml`, `JSON.parse(...)` → `parse(...)`
- `spells.json` → `spells.yaml`, `JSON.parse(...)` → `parse(...)`
- `enemies.json` → `enemies.yaml`, `JSON.parse(...)` → `parse(...)`
- `classes.json` → `classes.yaml`, `JSON.parse(...)` → `parse(...)`
- `shops.json` → `shops.yaml`, `JSON.parse(...)` → `parse(...)`
- `test-town.json` → `test-town.yaml`, `JSON.parse(...)` → `parse(...)`

**Also update test description strings** that reference `.json` filenames (e.g., `'items.json references valid spell IDs'` → `'items.yaml references valid spell IDs'`). These are cosmetic but will be misleading post-migration if left as `.json`.

### 6b. Test assertion string updates

| File | Change |
|------|--------|
| tests/scenes/ExplorationScene.test.ts:55 | `'assets/maps/test-town.json'` → `'assets/maps/test-town.yaml'` |
| tests/systems/MapLoader.test.ts:50 | `'assets/maps/my-map.json'` → `'assets/maps/my-map.yaml'` |

### 6c. DataLoader.test.ts — UPDATE MOCK (v2 fix)

**v1 said "No changes needed" — this was wrong.** After WP3 changes `DataLoader` to call `this.assets.loadYaml()` instead of `this.assets.load()`, the mock must provide `loadYaml`. The current mock:

```typescript
const mockAssetLoader = (data: unknown): AssetLoader => ({
  load: vi.fn().mockResolvedValue(data),
} as unknown as AssetLoader);
```

Must become:

```typescript
const mockAssetLoader = (data: unknown): AssetLoader => ({
  loadYaml: vi.fn().mockResolvedValue(data),
} as unknown as AssetLoader);
```

This applies to both `mockAssetLoader` definitions in the file (one in each `describe` block). Without this change, every DataLoader test will throw because `this.assets.loadYaml` is `undefined`.

**Acceptance criteria:**
- `npm run test` passes all 437 tests
- Cross-file validation catches the same referential integrity issues as before
- DataLoader tests exercise `loadYaml` mock path

**Effort:** 20 minutes

**Dependencies:** WP1, WP2, WP3

---

## WP7: TypeScript & Vite Config

### tsconfig.json
- `resolveJsonModule: true` can stay — it doesn't affect YAML files and is still needed if any JSON imports remain
- No `.yaml` module declaration needed since we're using `fetch()` + `parse()`, not `import`

### vite.config.ts
- No changes needed. Vite serves `.yaml` files as static assets by default (they'll be fetched via `fetch()`)
- The `yaml` npm package will be bundled by Vite automatically since it's imported in source code

### No new type declarations needed
- YAML files are loaded at runtime via fetch, not imported as modules
- TypeScript types are already applied via generics in `loadYaml<T>()`

**Files to modify:** None

**Effort:** 0 minutes (verification only)

---

## WP8: Migration Safety & Verification

### Round-trip verification (part of WP2 conversion script)
```javascript
// For each file:
const original = JSON.parse(fs.readFileSync('items.json', 'utf-8'));
const yamlText = yaml.stringify(original);
const roundTripped = yaml.parse(yamlText);
assert.deepStrictEqual(roundTripped, original);
```

### Post-migration verification checklist
1. `npm run build` — succeeds
2. `npm run test` — all 437 tests pass
3. `npm run dev` — game loads in browser, data displays correctly
4. Manual spot-check: open each YAML file, verify comments and formatting
5. `grep -rn '\.json' src/ --include='*.ts'` — only audio-manifest and response.json() remain

### Rollback strategy
- Git: all changes are in a single commit. `git revert` restores everything.
- JSON files are deleted only after YAML verification passes.
- If anything breaks mid-migration, `git checkout -- assets/` restores all data files.

**Effort:** 10 minutes

---

## Execution Order

```
WP1 (5 min)  ─── Install yaml package
     │
     ├──► WP2 (40 min) ─── Convert all data files JSON→YAML
     │         │
     │         └──► WP5 (10 min) ─── Update all hardcoded paths in src/
     │
     └──► WP3 (15 min) ─── Add loadYaml to AssetLoader, update DataLoader
              │
              └──► WP4 (included in WP2+WP3) ─── Map file handling
                        │
                        └──► WP6 (20 min) ─── Update tests (including DataLoader mock)
                                   │
                                   └──► WP7 (0 min) ─── Verify config (no changes)
                                              │
                                              └──► WP8 (10 min) ─── Full verification

Total estimated effort: ~2–2.5 hours
```

## TODOs

- [ ] WP1: Install `yaml` package (priority: high, effort: 5m)
- [ ] WP2: Create conversion script and convert all 6 data files + 1 map file (priority: high, effort: 40m)
- [ ] WP3: Add `loadYaml()` to AssetLoader, update DataLoader (priority: high, effort: 15m)
- [ ] WP4: Update MapLoader.ts and MapTransition.ts paths (priority: high, effort: 5m)
- [ ] WP5: Update all 5 registry/system hardcoded paths (priority: high, effort: 10m)
- [ ] WP6a: Update crossFileValidation.test.ts — YAML parse + description strings (priority: high, effort: 10m)
- [ ] WP6b: Update ExplorationScene + MapLoader test assertion strings (priority: high, effort: 5m)
- [ ] WP6c: Update DataLoader.test.ts mock: `load` → `loadYaml` (priority: high, effort: 5m)
- [ ] WP7: Verify tsconfig/vite config — no changes expected (priority: medium, effort: 5m)
- [ ] WP8: Run full verification suite (priority: high, effort: 10m)

---

## Appendix A: YAML Gotchas for Content Authors

> **Read this before hand-editing any `.yaml` data file.** These are common YAML pitfalls that will cause silent data corruption or parse errors.

### 1. The Norway Problem (boolean coercion)

YAML 1.1 infamously parses bare `no`, `yes`, `on`, `off`, `true`, `false` as booleans. We use `yaml@2.x` which defaults to YAML 1.2 (where only `true`/`false` are booleans), but be aware:

```yaml
# SAFE in YAML 1.2 (our parser):
answer: no          # string "no" ✓

# DANGEROUS if someone switches parsers:
answer: no          # could become boolean false
```

**Rule:** Always quote values that are English words for true/false/yes/no/on/off:
```yaml
answer: "no"
toggle: "off"
```

### 2. Bare boolean-like values

Even in YAML 1.2, `true` and `false` are parsed as booleans, not strings:

```yaml
# BAD — these become boolean true/false:
enabled: true       # boolean true (probably intended)
name: true          # boolean true (NOT the string "true"!)

# GOOD — quote when you mean the string:
name: "true"
```

### 3. Colons in strings

A colon followed by a space (`: `) is YAML's key-value separator. Unquoted colons in values break parsing:

```yaml
# BAD — parse error:
description: Restore HP: 30 points

# GOOD — quote the value:
description: "Restore HP: 30 points"
```

### 4. Hash/pound signs in strings

`#` starts a comment in YAML. Unquoted `#` in values truncates the string:

```yaml
# BAD — "Item" (rest is a comment):
name: Item #3

# GOOD:
name: "Item #3"
```

### 5. Multiline strings (for phases 17a–17d)

When adding long descriptions or dialog:

```yaml
# Literal block (preserves newlines):
description: |
  This sword was forged in the
  fires of Mount Gulg.

# Folded block (joins lines with spaces):
description: >
  This sword was forged in the
  fires of Mount Gulg.
  # Result: "This sword was forged in the fires of Mount Gulg."
```

### 6. Numeric string coercion

Bare numbers become integers/floats. If an ID must be a string, quote it:

```yaml
# BAD — becomes integer 1:
id: 001

# GOOD:
id: "001"
```

**Current data is safe** — all existing IDs are alphabetic strings (e.g., `warrior`, `iron_sword`). But future content additions should follow these rules.

### Quick Reference

| Want | Write | Don't Write |
|------|-------|-------------|
| String "no" | `"no"` | `no` |
| String "true" | `"true"` | `true` |
| String with colon | `"HP: 30"` | `HP: 30` |
| String with # | `"Item #3"` | `Item #3` |
| Multiline (keep newlines) | `\|` block | bare text |
| String "001" | `"001"` | `001` |

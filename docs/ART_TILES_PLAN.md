# Map and town tiles at 2x (Phase 7), rev 2.1

Rev 2 answers the first review. The main change: the compiler **bakes each map into images** (a below-characters
layer and an above-characters layer), so the tile kit is used only at build time. This removes the runtime
tileset, the autotile seam and three-material problems, and the decal layer. Rev 2.1 folds in the second review
(see "Rev 2.1 fixes" at the end).

## Goal

Replace the one-tile-per-terrain field art with modular 2x tile kits:
- buildings and stores are assembled from parts (roof, wall, door, window, sign)
- paths and rivers have natural ragged or stone edges in any shape
- roofs and tree crowns hide a character walking behind them

The first deliverable is the **town kit**, proven by rebuilding Cornelia with an original layout. The overworld,
interior and dungeon kits are later plans.

Baseline: `npm run build` exits 0 and `npm test` passes (1018 tests). Branch `snes-asset-pipeline`.

## Ground rules

- **Scale:** tiles are 48x48 native at 2x (96 px on screen), matching the 48x96 field sprites (feet on row 93).
- **Reference:** the Pixel Remaster town image the user linked (outside the repo, `~/temp/ffgame-refs/`) only sets
  which kinds of parts we need. It is never sent to Gemini, and its layout is not copied.
- **Budget:** the sprite budget guard and ledger apply: one paid image per checkpoint, `--paid` required, `--retry`
  only with the user's approval.
- **Inputs:** requests send the approved knight field sheet as the house style, then approved kit sheets once they
  exist. No legacy art is sent.
- **Preview only:** compiled maps are used only under `?art=ai` (`isPreviewAi()`, `TILE_SIZE` 96). Default play keeps
  the legacy `assets/maps/<id>.yaml` and terrain art unchanged. Making 2x the default, and deleting the legacy path,
  is a later plan.

## Parts (town kit)

| Family | Parts |
|---|---|
| Ground materials | grass, cobblestone, dirt, water: seamless textures |
| Edges | ragged cobble/dirt edge onto grass, stone river rim |
| Town wall | walkway top, outer face with arrow slits, inner face, corners, end caps, gate gap, culvert arch |
| Bridge | stone bridge, horizontal and vertical |
| Buildings | roof (ridge / mid / eave rows × left / mid / right), wall upper and lower rows (left, plain, window, door, right) in plaster, timber and stone, a second-storey band, a chimney, and sign boards (weapon, armor, item, white magic, black magic, inn) |
| Props | conifer (trunk + crown), bush, fountain (2x2), well, picket fence (h, v, post), flower bed, barrel, crate, signpost |

## Runtime (step 0)

### Compiled map

`assets/maps/ai/<id>.yaml` has the usual `MapData` fields: `layers: []`, `tilesets: []`, plus collision, NPCs,
transitions and so on. It also adds:

```yaml
art: { chunk: 16, below: [assets/maps/ai/<id>/below_0_0.png, ...], above: [...] }   # 16x16-tile chunks, row-major
entrances: { south_gate: [23, 34], weapon_shop: [6, 9], ... }
```

- **Chunks:**
  - each chunk is 768x768 native px (16 tiles at 48 px); the last row and column are smaller
  - `below` holds the ground, walls, building fronts, trunks and props
  - `above` (with alpha) holds roof ridges and tree crowns, and is absent for chunks with nothing above
- **Validator:** `validateMapData` accepts the optional `art` and `entrances`. `layers` and `tilesets` stay arrays
  (empty for compiled maps).

### Loading

`MapLoader.loadMap(id)` first tries `assets/maps/ai/<id>.yaml` when `isPreviewAi()`. If it doesn't exist (a 404 or a
non-YAML body), it falls back to the legacy file.

### Renderer

`BakedMapRenderer` (new, `src/rendering/`):
- loads each chunk with nearest scaling and draws it at `scale = TILE_SIZE / 48`
- `below` goes in one container at `zIndex = -1`
- `above` goes in another container at `zIndex = mapHeight * TILE_SIZE + 1`, above every possible feet value
  (characters use `zIndex = y + frameHeight`)
- `ExplorationScene.loadMap` adds both containers after `removeChildren()`
- the camera culls by chunk visibility
- `TilemapRenderer` is untouched and keeps drawing legacy maps

### Covering rules (enforced by the compiler)

- An `above` pixel may only lie over walkable cells: roof ridge rows and tree crowns are walkable.
- The cell directly south of any cell with `above` art must be blocked (an eave row or a trunk). So a character's
  head is covered only when they are actually behind the object.

### Entrances

Transitions may give `targetEntrance: <name>` instead of `targetX` and `targetY`. `MapTransition` resolves it from
the target map's `entrances` after loading, and an unknown name is an error.
- **Legacy maps:** `cornelia.yaml` gets an `entrances` block with its current coordinates.
- **Inbound transitions:** the transitions into Cornelia (overworld and the six interiors) switch to
  `targetEntrance`. That works for both the legacy and the compiled Cornelia.
- **Debug:** the `knight_field` scenario spawns at the entrance `south_gate`, not at fixed coordinates.
- **Saves:** a loaded position on a blocked tile, as from a save made on the other variant, falls back to the map's
  first entrance.

## Compiler (`assets-src/tools/build_map.py`, build stage `maps`)

### Source

`assets-src/maps/<id>.yaml`:

```yaml
kit: town
ground: |            # one char per tile; legend: . grass  : cobble  , dirt  ~ water  # town wall  = bridge
  ................
  ..#######:######
entrances: { south_gate: [23, 34] }
objects:
  - { type: house, x: 4, y: 3, w: 6, h: 5, roof: red, wall: plaster, door: 3, windows: [1, 4], sign: weapon,
      enter: { map: cornelia-weapon-shop, entrance: door } }
  - { type: tree, x: 1, y: 9 }
  - { type: fence, from: [10, 6], to: [16, 6] }
npcs: [...]          # passed through unchanged, as are transitions, encounters, music, battleBackgrounds
```

### Steps

1. **Ground, baked per pixel at 48 px per tile:**
   - each cell's material texture is sampled by **global** pixel position, so seamless textures never show a
     tile grid
   - small detail stamps (tufts, flowers) are scattered by a seeded hash
2. **Edges:** an overlay material's boundary is drawn *inside its own cells*, from the full-map cell mask.
   - It is inset 0–6 px with a ragged offset from seeded noise along the global boundary, so it is continuous and
     handles any shape, 1-wide paths and three-material meetings alike.
   - Then a 1 px dark edge, and a soft shadow on the grass side, at most 4 px into the neighbouring cell.
   - Connections: cobble and dirt treat each other, bridges and walls as connected (no edge). Water draws its
     stone rim inside the water cell against anything that isn't water or a bridge.
   - Collision stays per cell, so visuals match collision within 6 px.
3. **Objects** are stamped from **recipes** using kit parts (see the cell table below).
   - A house of width `w ≥ 3` and height `h ≥ 4`: 2 wall rows; `h − 2` roof rows (ridge + `h − 4` mid + eave);
     columns are left edge, `w − 2` middles, right edge.
   - A middle column is `door`, `window` or plain, as listed. A window sits in the upper wall row over plain
     lower wall; a door spans both rows.
   - Signs are composited onto the eave row over the door column.
   - The ridge row goes to `above`; the rest goes to `below`.
4. **Collision:**
   - the source grid is the base: wall and water block, everything else walks
   - objects then override it: house cells block except the ridge row; the door cell is walkable and becomes a
     transition; trunks, the fountain, the well and fences block
   - the compiled `collision` is authoritative
5. **Transitions:** each `enter` emits a transition on the door cell (`targetEntrance`), and the interior map's
   `door` entrance is checked to exist.
6. **The build fails on:**
   - overlapping objects
   - an unknown part name, material or legend character
   - an NPC, entrance or transition on a blocked cell
   - any door not reachable on foot from every entrance
   - a breach of the covering rules
7. **Output:** writes the YAML and the chunks. Output is committed. `--selftest` runs offline checks (below).

## Art generation (`assets-src/gen/`)

### Plumbing

- **`kits.yaml`:** entries `{ id: town, sheets: { <sheet>: { prompt, cells, seed } } }`.
- **`load_character`:** falls back to `kits.yaml` with `kind: kit`.
- **`allowed_sheets`:** returns `kit_<sheet>`.
- **`plan_request` kit branch:** sends the guide, the knight field sheet and the approved kit sheets listed in
  `refs`.
- **Ledger:** keyed `character=<kit>`, `sheet=kit_<sheet>`.
- **`approve.py kit` branch:** writes `approved/<kit>/<sheet>.png` (cut native, 48 px per tile) and `.json` with the
  cache key and the cell table.
- **Build stage `maps`:** reads parts from `approved/<kit>/*.png` by cell name. Where a part isn't approved yet, it
  uses the **placeholder kit** (`assets-src/tools/placeholder_kit.py`: flat colours, outlines, a 2-letter label),
  so step 0 needs no art.
- **Palette:** each sheet is ≤ 32 colours snapped to 15-bit. Consistency across sheets comes from sending approved
  sheets as references. Baked maps don't need one shared palette.

### Geometry (`TILES_GEOM` in `spec.py`, rev 2.1)

- The guide is 1280x1024 (5:4) with 240 guide px per tile.
- The pilot's 5x4 grid (1200x960) is centred, with 40/32 px margins.
- Each cell is outlined light grey; the cell legend goes in the prompt.
- Other sheets reuse 5:4 with grids up to 5x4.

### Cut

1. Detect the drawn pixel pitch.
2. Snap the art's bounding box to the guide grid.
3. Resample to 48 px per tile (`pixelize_native`, ≤ 32 colours).
4. Slice cells by name.

### Pilot A cell table (5 columns × 4 rows)

| Row | c0 | c1 | c2 | c3 | c4 |
|---|---|---|---|---|---|
| 0 ridge | roof_ridge_l | roof_ridge_m | roof_ridge_m | roof_ridge_m | roof_ridge_r |
| 1 eave | roof_eave_l | roof_eave_m | roof_eave_m | roof_eave_m | roof_eave_r |
| 2 wall upper | wall_up_l | wall_up_plain | wall_door_top | wall_up_window | wall_up_r |
| 3 wall lower | wall_lo_l | wall_lo_plain | wall_door_bottom | wall_lo_plain | wall_lo_r |

- The roof is exactly as wide as the walls: no overhang and no front gable (gables are checkpoint E).
- Where a `_m` part appears more than once, the cut keeps the copy with the lowest seam error.

### Metrics (printed by the cut; all must pass before review)

| Metric | Pass |
|---|---|
| Density: detected pitch → native px per tile | 44–52 (target 48) |
| Grid alignment: the roof/wall boundary and the outer edges | within 2 native px of a tile line |
| Door opening height vs the 90 px field sprite | 70–96 native px |
| Seam: a `_m` part tiled 3x | mean colour error across the seam ≤ 1.5x the mean error between neighbouring interior columns |
| Colours | ≤ 32 |

### Checkpoints

| # | Checkpoint | Paid images |
|---|---|---|
| 0 | Runtime, compiler and placeholder kit; placeholder Cornelia (original layout) playable under `?art=ai` | 0 |
| A | **House kit pilot** (the table above): plaster walls, red roof | 1 |
| B | Ground textures: grass, cobble, dirt, water swatches (each made seamless offline, seam metric as above) | 1 |
| C | Town wall, river rim, bridge, culvert | 1 |
| D | Props | 1 |
| E | Second style (timber and stone, two storeys, front gable) and the 6 sign boards | 1 |
| F | Cornelia with the full kit, reviewed in game (muted) | 0 |

The user reviews each checkpoint before the next. If metrics fail, offline fixes come first; a new image needs
the user's approval.

## Step 0 definition of done

**Tests:**
- `tests/rendering/BakedMapRenderer.test.ts`: chunk placement and scale; `above` `zIndex` higher than any feet
  `zIndex`; missing `above` chunks skipped
- `tests/systems/MapLoader.test.ts`: the compiled map is preferred under preview, with legacy fallback; legacy
  maps unchanged
- `tests/systems/MapTransition.test.ts`: `targetEntrance` resolution; an unknown entrance throws
- `tests/data/crossFileValidation.test.ts`: every transition into a map lands on a walkable cell of every variant
  (legacy and compiled); every `targetEntrance` exists; compiled map dimensions match `collision` and the chunk count
- `tests/core/schemaValidation.test.ts`: `art` and `entrances` accepted, bad shapes rejected

**Compiler:** `python3 -I assets-src/tools/build_map.py --selftest` passes:
- a synthetic map with a 1-wide path, a three-material corner and a river compiles
- the edge never crosses into non-overlay cells by more than the 4 px shadow
- there is no seam at any chunk boundary (byte-identical stitching)
- every validation failure case is rejected

**Other:**
- the placeholder Cornelia compiles and validates
- `npm run build` and `npm test` pass
- a muted check (`?mute=1&art=ai&scenario=knight_field`): walk to every door and through the gates; roofs and
  crowns cover the leader when behind them

## Out of scope

- the overworld, interior and dungeon kits
- animated water
- making 2x field art the default
- deleting the legacy terrain art and maps

## Rev 2.1 fixes (second review)

1. **Legacy entrances are walkable cells.** Today's interior returns land on wall cells under the greeter NPCs
   (e.g. (3,2)). The legacy `cornelia.yaml` gets entrances one cell south of each door transition, checked walkable.
   No entrance may sit on a transition cell or an NPC; the cross-file test enforces this.
2. **`MapTransition` becomes a union:** `targetX`/`targetY` **or** `targetEntrance`. `validateMapData` requires
   exactly one form. `ExplorationScene.executeTransition` resolves the entrance from the loaded map's `entrances`
   after `loadMap`. The fallback for a blocked save position goes in both restore branches of `enter()`.
3. **Shared `MapRenderer` interface:** `container`, an optional `aboveContainer`, `setCamera`, `render` and
   `markDirty`. `TilemapRenderer` and `BakedMapRenderer` both implement it, and `MapLoadResult.tilemap` is typed
   with it. `MapLoader` awaits every chunk texture before returning.
4. **`art.above` keeps `null` entries** for empty chunks. The validator checks that both arrays have
   `ceil(w/16) * ceil(h/16)` entries.
5. **Manifest instead of probing:** the compiler writes `assets/maps/ai/index.yaml` listing the compiled ids.
   `MapLoader` reads it once, and under preview loads the compiled file for a listed id. Any error in a listed map
   fails loudly, with no silent fallback.
6. **Doors:**
   - `wall_door_bottom` is walkable and holds the transition; `wall_door_top` blocks.
   - The six interior maps gain `entrances: { door: [4, 4] }`.
   - Each shop house has a fixed `name` (`weapon_shop`, `armor_shop`, `item_shop`, `white_magic`, `black_magic`,
     `inn`); the compiler emits that name as the entrance one cell south of the door.
   - The interiors' return transitions use `targetEntrance: <name>`.
   - A test asserts that legacy and compiled Cornelia define the same entrance names.
7. **Pilot density from measured output.** Gemini draws about 4.7 raw px per native px, and a 5:4 output is about
   1150x920. So the pilot is a **5x4-tile house**:
   - columns: left, window, door, window, right; rows: ridge, eave, wall upper, wall lower
   - the guide is 1280x1024 with 240 guide px per tile (1200x960, margins 40/32), about 216 raw px per tile and
     about 46 native px per tile
   - the cut resamples each detected tile to 48; the density metric passes at 40–56 native px per tile
   - if it misses, the next step (with the user) is a 4x4 grid
   - **Recipes:** houses are `h = 4` (ridge, eave, two wall rows) until checkpoint E adds `roof_mid` rows and two
     storeys. Cell labels go in the prompt text, not on the guide.
8. **Kit plumbing:**
   - `kits.yaml` sheet entries are `{ prompt, cells, seed, refs: [<sheet>, ...] }`
   - each `kit_<sheet>` is registered in `GEN.SHEETS` as a `Sheet` with `TILES_GEOM` and its cell table as `order`
   - `selftest.py` gains kit cases: guide geometry, the cut on a synthetic grid, and reproducing approved keys

**Visual notes:**
- Cobble meeting dirt has no ragged edge, so it shows a straight seam on the tile grid, by design.
- A character on a ridge row has their body covered by the roof and their head showing above it.

## Progress (2026-11-12)

- **Step 0 is done.** It includes:
  - the compiler (`assets-src/tools/build_map.py`, build stage `maps`) and the placeholder kit (`tools/kit.py`)
  - `BakedMapRenderer`, the `MapRenderer` interface and the manifest-based `MapLoader`
  - entrances (`targetEntrance`, plus the safe-spawn fallback)
  - an original Cornelia source in `assets-src/maps/cornelia.yaml`

  Tests: `BakedMapRenderer`, `MapEntrances`, `mapVariants`, schema cases and the compiler `--selftest`. A muted
  browser check under `?art=ai` confirmed the gate spawn, a door round trip (black magic shop) and the roof ridge
  covering the leader.
- **Pilot A (1 paid image), result:**
  - **Passes:** door 90 px, seams, 27 colours.
  - **Fails density:** Gemini drew about 6 raw px per pixel, giving 33 native px per tile, so the cut upscales
    1.45x.
  - **Fails alignment:** 11 px, because the roof overhangs and the right side wall is drawn in 3D.
  - **Copied guide lines:** Gemini copied the grid lines into the walls; the cut's thin-line filter now removes
    them offline.
  - **Status:** waiting for the user's decision.
- **Rev 2.2 (user: option 2, then one more retry):**
  - **Layout:** a 4x4 house on a 1:1 guide (248 px per tile, no guide lines), with `wall_up_plain` derived offline
    from the window cell.
  - **Retry 1:** density was right, but Gemini drew its own black grid.
  - **Retry 2 (prompt rev 2):** the prompt never says grid, tiles or cells, and asks for one continuous picture.
    The result is clean and passes every metric: 48.5 native px per tile, alignment 0.2 px, door 84 px,
    seams ≤ 0.05, 24 colours.
  - **Cut safety nets:** grid-line removal runs only when a drawn vertical line spans 70% or more of the object;
    hairline removal runs only when the guide drew lines. Repeatable parts take the best-repeating 48 px window
    along their row. Pitch is measured on the object.
  - **Status:** waiting for the user's review (not yet approved).

# WR: the world map wraps (plan, rev 2)

## Momus fixes (rev 2, 2026-11-22)

Momus rejected rev 1 (2/5, a targeted revision). Rev 2 folds in the integrator's rulings and every required fix:

- **Q4 is ruled (b): no zone band.** A sea cell keeps its zone. D-WR-5 is now "no re-zone; the curve re-measure is
  the gate". The band, `world_seam.py`, the gating `seam_zones` and rev 1's 1.4 / WR12 claims are removed.
  - `seam_zones` is now a **report-only** line, using the explicit early / late table `SEA_CLASS` (2, 6.1).
  - The expected curve delta is re-stated from the route measurements (8.3).
  - The fallback, if the gate fails, is specified in full: four seam zones owned by the late regions that copy the
    early tables, with their factors, data and region tests (8.4, "F-WR").
- **Fix 1, parked vehicles.** `FieldVehicleSprites.showParked` sets `onRender = placeParked` (line 85), which re-places
  the parts canonically after `WrapImages.apply`. `WrapImages` now **skips every vehicle part**, and `placeParked`
  applies the image itself through a wrap-offset callback (D-WR-9, 5). A test runs the `onRender` callbacks after
  `apply`.
- **Fix 2, zIndex.** On a wrapped map the map layers take sentinel zIndex values (`WRAP_BELOW_Z` -1,000,000,
  `WRAP_ABOVE_Z` 1,000,000), so a shifted image can never sort under the below layer or over the above one (D-WR-10,
  5). Tested in `wrapImages.test.ts`.
- **Fix 3, missing updates.** `nw1_selftest.py:14` (`cell_px(256) == (12, 8)`) and `mode7Atlas.test.ts:37`
  (`lowCellPx` 8, `lowSize` width x 8) move into WR-2. The new files are registered in `fileCeilings.test.ts`
  `NEW_FILES` or in `questCeilings.test.ts` `FILES`. `WorldAtlas.compose` builds mips under WebGL1 when the atlas is a
  power of two, and `worldAtlas.test.ts:98-105` is updated (7.1).
- **Fix 4, the WebGL1 NPOT guard.** `atlasSize` throws, so `WorldAtlas.load` rejects into FlightView's existing
  `failed` path (`FlightView.ts:137-138`). Covered in `worldAtlas.test.ts` and `mode7Activation.test.ts` (7.1).
- **Fix 5, schema against the legacy test map.** The streamed-only rule stays. `wrapField` runs a streamed
  `BakedMapRenderer` through the `Assets.load` spy of `mode7Parity`'s streamed world, moved into
  `tests/helpers/streamedWorld.ts`. `TilemapRenderer` is no longer edited (3, 10).
- **Fix 6, no loader.** With `seam_zones` report-only and the classes an explicit table, no `quest.yaml` loader is
  needed on the Python side. Rev 1's "`world_specs/common` loader" is gone.

The concerns settled:
- relocation in `worldRevalidate`, `worldReset` and `MapTransition.safeSpawn` stays **planar** (D-WR-11);
- `to` is canonicalised once at the top of `fieldStep`, `canEnter` and `cellReader`, with `inBounds` and the lookups
  strict (4);
- the merge order is WR-0, WR-1, then WR-2 (after AV), then WR-3 (after QW). WR-2 adds the `mode7Parity` variant (11);
- B1 and B3 read a real probe, `window.__field` (dev only, 10);
- the seam spots are given as `SpotDef`s (6.3);
- the timing gate is the median of 3 runs each way (8.5);
- the 9 `DIRS` loops are listed (8.1);
- the low profile's compose peak is 39.2 MB (7.1);
- 7.3's underlay sentence is fixed;
- FlightView is budgeted against AV's 249 with a target of 248 or fewer, through an extraction (7.4, 13).

---

Base: `mainline` 08b9a35d, plus the work in flight:
- QF: the airship speed, `AirshipMode.ts`;
- QW: EARTH's sage cave moves, a Melmond entry cue, a world recompile;
- AV (PA's plan, `~/temp/ff-game/airship_views/AIRSHIP_VIEWS_PLAN.md`): the airship's front and back views. **AV lands
  before WR-2.**

Conflicts are in 13.

Request: the user, 2026-11-22: "the edge of the world is weird from the airship, in classic FF I think you could fly
from north to south and east to west (and vice versa). Can we do something similar?" Classic FF1's world is a torus.

Planning only: this document changes no code, data or map. Probes ran from `/tmp/pw/` against the committed compile.

Coordinates:
- A **cell** is `(x, y)` on the 256x256 world (`W = H = 256`).
- **Canonical** means `0 <= x < W` and `0 <= y < H`.
- **Unwrapped** means a value outside that range, used only for drawing (the hero mid-step, a chunk drawn left of
  column 0).
- The **seam** is the pair of edges that meet: x 255 | 0 (E-W) and y 255 | 0 (N-S).
- **Images** are the copies `(x + kW, y + lH)` of a cell.

## 0. Summary and success criteria

1. **Every mode wraps.** The world map `overworld` becomes a torus for walking, canoe, ship and airship (D-WR-1).
   Every other map stays flat.
2. **The wrap is data.** `MapData.wrap: true` is written by `world.py` and passed through by the compiler. One pure
   module, `src/systems/worldWrap.ts`, does the wrap maths for the game, the field rules and the verifier.
3. **Top-down.** The view never clamps on a wrapped map. Chunks, patches, NPCs, vehicles and effects draw at their
   image nearest the camera.
4. **Mode 7.** The far atlas is sampled with `REPEAT`. The low atlas becomes 2048² (8 px per cell, a power of two),
   so it repeats under WebGL1 too. The near window, the billboards, the clouds and the tilt all work across the seam.
5. **The seam stays open ocean** (D-WR-2). Its art is already continuous (1.3).
6. **Progression is unchanged as a set of reachable places.** The wrap joins no component on foot, by canoe or by
   ship (1.2), and the verifier proves it on every run (`WRAP`). Routes only get shorter: up to 16 ship steps between
   docks.
7. **Sea zones are not changed** (D-WR-5). A sea cell keeps its zone. The gate is the curve re-measure (8.3). If it
   fails, the fallback F-WR adds seam zones (8.4).

```json
{
  "functional": [
    "on overworld every mode steps from x 255 to 0, 0 to 255, y 255 to 0 and 0 to 255; the corner takes two such steps",
    "gridX/gridY, game.playerPosition, saves, parked vehicles, playerMove events, zone lookups and canLand only ever see canonical cells",
    "the camera never clamps on a wrapped map; the screen image is continuous across a step that crosses a seam, parked vehicles included",
    "the components on foot, by canoe and by ship are identical with and without the wrap (WRAP in proof (h); world.py's `wrap` line)",
    "proofs (a), (b), (c), (e), (f), (h) give the same results as on the flat world; (c)'s state count is unchanged; (g)'s anchors, distances and bearings are planar and unchanged",
    "every stage stays in its band, wipes stay within the questCurve.test.ts bounds, and every stage's curve level is within ±0.5 of today's",
    "Mode 7 shows the far side past each seam with no clamped band and no near-window recentre caused by the seam; the tilt's t=0 frame matches the top-down camera at a seam and at the corner",
    "flat maps (towns, dungeons, the legacy 64x64 overworld, every test map without wrap) behave exactly as today"
  ],
  "observable": [
    "world.py prints `wrap: OK` and the report-only `seam_zones` line; build_map.py prints the seam-art figures",
    "npm run quest -- --strict: the WRAP line; the curve levels per stage beside today's; each stage's seam crossings and late-sea cells",
    "window.__field (dev): cell, mode, zone; window.__mode7: recentres and the steady p95s",
    "the browser checkpoints B1-B9 in ~/temp/ff-game/world_wrap/int/"
  ],
  "pass_fail": [
    "npm run build OK; npm run test:fast OK (agents); npm run test:full OK (integrator)",
    "python3 -I assets-src/tools/layouts/world.py: every gated line OK; worldgen selftests OK; map_selftest OK; nw1_selftest OK",
    "npm run quest -- --strict OK; --strict --mutate OK (background, WR-INT); --from-reset OK",
    "build_map.py --check-determinism overworld and mode7_atlas.py --check-determinism overworld OK",
    "re-running world.py leaves git diff --exit-code assets-src/maps clean"
  ]
}
```

## 1. Baseline (measured at 08b9a35d on the committed compile; probes in `/tmp/pw/`)

### 1.1 The world's edges

| Item | Today |
|---|---|
| Size | 256x256 cells, 16x16 chunks of 16 cells, `art.tile` 48 |
| Edge cells | all 1,024 are Water (collision 2). `mode7_atlas.edge_errors` refuses anything else; the source has `sealed_edges: true` |
| Land extent | x 7-250, y 8-250. The sea margin is 7 cells west, 5 east, 8 north and 5 south |
| Grass near an edge | east (x >= 244): 19 cells, e.g. (246, 28) and (249, 31); west (x <= 11): 5; north (y <= 11): 0; south (y >= 244): 91 |
| Across the E-W seam | land at x 250 and at x 7 is 13 cells apart, inside one top-down view (20 cells wide) |
| Camera | `Camera.clampAxis` clamps to the map, so near an edge the hero is drawn off centre |
| Mode 7 | both atlases use `clamp-to-edge`. Beyond an edge the ground repeats the edge sea's texels (the "weird" edge). `rowOffMap` and `rowFits(..., map)` treat the map's edges as open sides |
| World-map objects | 4 NPCs (the tomb chest, two bridge workers, the hull hatch) at x 146-194, none wandering; 1 ambient (smoke at (177, 201), zIndex `aboveZIndex + 1`); 2 patches at x 93-100 and 147-148; the ship parked at Pravoka's dock (186, 146) |

### 1.2 Ship water and distances (canal open)

| Item | Flat | Wrapped |
|---|---|---|
| Water (ship) components | 2: 38,555 cells and an enclosed 51 | **the same 2** |
| Pravoka - Crescent dock | 428 steps | 422 |
| Pravoka - `fir_ice` | 376 | 360 |
| Melmond - Crescent | 282 | 276 |
| Melmond - `fir_ice` | 230 | 214 |
| `ert_dwarf` - `fir_ice` | 249 | 233 |
| Pairs within the Aldi, and Crescent - `fir_ice` | 57-182, 62 | unchanged |
| Largest shortening from a dock to any sea cell | — | 184 to 220 steps, to the far open sea only, e.g. (255, 196), (0, 255) |

**Why nothing joins.**
- The border is one ring of Water cells, so every sea that touches an edge is already joined to every other through
  that ring.
- A seam step joins two border cells that were already connected.
- No walkable or canoe cell lies on an edge.
- Docks are the only places a ship can land, and the airship already reaches every cell.

So the wrap changes no component and no reachable place.

### 1.3 Seam art

| Item | Measure |
|---|---|
| The open-ocean texture | it repeats every 192 px horizontally (4 times per 768 px chunk). Chunks (0, 0) and (0, 1) agree to 0.0004 mean abs |
| x seam: chunk (r, 15)'s last px column against chunk (r, 0)'s first | mean abs 5.7 in every chunk row; row 0's interior boundaries are 5.7-6.7 |
| y seam: chunk (15, c)'s last px row against chunk (0, c)'s first | 7.3 in every column; column 0's interior boundaries are 6.5-7.7 |

The seam already looks like an interior chunk boundary. No art change is needed, and a compile check keeps it so
(6.2).

### 1.4 Sea zones along the edges and on the wrapped routes (facts; no change ruled, Q4 (b))

| Edge | Runs (ship zones) |
|---|---|
| x 0 (west), by y | `wat_sea` 0-119, `ert_sea` 120-232, `elf_sea` 233-255 |
| x 255 (east), by y | `wnd_sea` 0-97, `fir_sea` 98-255 |
| y 0 (north), by x | `wat_sea` 0-106, `ord_sea` 107-169, `wnd_sea` 170-255 |
| y 255 (south), by x | `elf_sea` 0-166, `fir_sea` 167-255 |

- **The two classes** (the explicit table `SEA_CLASS`, 2):
  - early: `a1_aldi`, `a1_north_sea`, `elf_aldi`, `elf_sea`, `ert_aldi`, `ert_sea`, `fir_aldi`, `fir_sea` (bigeyes,
    sahagin chief, buccaneer, shark 120 HP);
  - late: `ord_sea`, `wat_sea`, `wnd_sea` (deepeyes 304, sahagin prince, sea snake, white shark 344). These are the
    sea zones of the stage at `quest.yaml:574`.
- **Seam pairs whose classes differ:** E-W at y 98-119 (`wat_sea` | `fir_sea`), and the whole N-S seam (every
  northern late sea against `elf_sea` / `fir_sea`).
- **The wrapped Melmond - Crescent route.** BFS in the verifier's direction order `[0,1], [0,-1], [-1,0], [1,0]`
  gives 276 steps against 282 flat. It crosses at y 101.
  - Late-sea cells rise from 26 (flat: `wat_sea` 9, `ord_sea` 17) to 65 (all `wat_sea`, at y 101-121, x 0-44, none
    of them on the flat route).
  - Early cells fall from 256 to 211 (`a1_north_sea` 112 to 6, `fir_sea` 56 to 125, `ert_sea` 89 to 81).
  - A route of the same length with **no** late cell exists: a weighted search costs 276 with a penalty of 1,000 per
    late cell. So the witness's late cells depend on tie-breaking.
  - The integrator's brief cites "57 of the 65"; my probe gives 65 late cells on the route, all new to it (net +39).
    WR-3 measures the verifier's own witness, which is the authority.
- **The other ocean voyages:**
  - Melmond - `fir_ice`: 214 steps, late 26 to 65 (`wat_sea` 65).
  - Pravoka - Crescent: 422 steps; Pravoka - `fir_ice`: 360. Both share the Melmond leg's crossing.

### 1.5 Anchors (proof (g))

24 anchors are placed. 58 of their 276 pairs differ by more than 128 on an axis (e.g. Melmond - `ice` dx 132, `marsh` -
`waterfall` dy 185), so a wrapped metric would change them. The 31 listed pairs and the 15 detour hops are the
design's flat chart.

### 1.6 Files at or near a line ceiling

Edits to these files must be line-neutral, or extract first.

| File | Lines / ceiling |
|---|---|
| `src/scenes/exploration/mode7/FlightView.ts` | 249 / 250, and **249 after AV** (AV: "-1 +1"). WR-2's budget is **≤ 248** |
| `src/progression/questMutateFind.ts` | 248 / 250 |
| `src/scenes/exploration/FieldVehicles.ts` | 247 / 250 (AV may take it to about 250, with its own extraction) |
| `src/progression/questSearch.ts` | 246 / 250 |
| `assets-src/tools/worldgen/gates.py` | 249 / 250 (WR does not edit it) |
| `src/rendering/StreamedChunks.ts` | 222 / 250 |
| `src/progression/questTravel.ts`, `questProofs.ts` | 222, 229 |
| `src/scenes/ExplorationScene.ts` | 556 / 590 (AGENTS.md still says 504) |
| `src/types/index.ts` | 433 / 442 |
| `src/scenes/exploration/FieldVehicleSprites.ts` | 179 (AV adds to it; it stays under 250) |

## 2. Decisions, constants and glossary

| Id | Decision | Source |
|---|---|---|
| D-WR-1 | **Every mode wraps** (Q1, ruled: the default). The map is a torus, as in FF1. The ship gains only shortcuts (1.2). The canoe and walking never reach an edge. An airship-only wrap would clamp the camera again at a landing near an edge (a jump at (249, 31)), and would show a ship a far side it cannot reach | Q1 |
| D-WR-2 | **The seam stays open ocean** (Q2, ruled: the default). `sealed_edges` stays. A new margin rule: no non-Water cell within `SEAM_MARGIN` = 4 cells of an edge (today's least margin is 5). The generator stays planar | Q2 |
| D-WR-3 | **Canonical cells everywhere except drawing.** The hero's drawn target may be unwrapped during a step. At the step's end the tile, the sprite and the camera normalise together. That is a whole-period jump, invisible because everything draws relative to the camera. No new save version | 4 |
| D-WR-4 | **Proof (g) stays planar** (Q3, ruled: the default). Anchors, distance ratios, bearings and s* are unchanged. Detours use the real (wrapped) path length, which can only shorten. A report-only line gives the wrapped distances | Q3 |
| D-WR-5 | **No zone change at the seam** (Q4, ruled (b)). A sea cell keeps its zone. The gate is the curve re-measure (8.3). The fallback F-WR (8.4) applies only if that gate fails | Q4 |
| D-WR-6 | **The far atlas repeats.** Full: 3072² at 12 px per cell (NPOT, WebGL2 only, which allows NPOT `REPEAT` and mips). Low: **2048² at 8 px per cell** (POT; was 1536² at 6), so `REPEAT` and mips work under WebGL1 too. A wrapped map whose low atlas is NPOT under WebGL1 rejects in `atlasSize` (7.1) | 7.1 |
| D-WR-7 | **The verifier wraps.** `stepTo` / `stepIndex` replace the 9 local direction loops (8.1). Each caller keeps its own direction order | 8 |
| D-WR-8 | **The wrap invariant is checked on both sides:** `wrap` at compose time and `WRAP` in proof (h) | 6, 8 |
| D-WR-9 | **Parked vehicles place their own image.** `WrapImages` skips every part `FieldVehicleSprites` owns. `placeParked` adds `wrapOffset(footX, footY)` (from the scene) to its foot point; it runs on each `onRender` | 5 |
| D-WR-10 | **Layer sentinels on wrapped maps.** The below container's zIndex is `WRAP_BELOW_Z` = -1,000,000 and `aboveZIndex(map)` returns `WRAP_ABOVE_Z` = 1,000,000. Shifted characters lie within about ±50,000, and `FLYING_Z` is 10,000,000, so the order is below < characters < above < smoke (`aboveZIndex + 1`) < flying. Flat maps keep -1 and `(H + 2) x TILE_SIZE` | 5 |
| D-WR-11 | **Relocation stays planar.** `worldRevalidate.ts` (BFS, nearest dock and landing), `worldReset.ts` and `MapTransition.safeSpawn` are not edited. By 1.2 their components are the same either way, and planar "nearest" keeps every save relocation exactly as today. Their tests (`saveWorldReset`, `worldRevalidate`, `loadRevalidate`, `resetStates`) stay unchanged as the check | concern |

Constants:
- `SEAM_MARGIN` 4 (`layouts/world_api.py`; mirrored in `worldWrap.ts` for the data test);
- `POT_LOW` 2048 (`mode7_atlas.py`);
- `WRAP_BELOW_Z`, `WRAP_ABOVE_Z` (`BakedMapRenderer.ts`);
- `SEA_CLASS` (`layouts/world_api.py`): `{early: a1_aldi, a1_north_sea, elf_aldi, elf_sea, ert_aldi, ert_sea,
  fir_aldi, fir_sea; late: ord_sea, wat_sea, wnd_sea}`. A ship zone missing from it prints `UNCLASSED <id>` in the
  report, and `selftest_wrap.py` asserts that every ship zone of the composed world is classed.

## 3. The wrap module (pure; `src/systems/worldWrap.ts`, new, < 120 lines)

```ts
export function wraps(map: Pick<MapData, 'wrap'>): boolean;                 // map.wrap === true
export function mod(v: number, n: number): number;                          // ((v % n) + n) % n, integers
/** Signed shortest b - a on a ring of n, in [-n/2, n/2); with n = 0 (a flat axis) it is b - a. */
export function wrapDelta(a: number, b: number, n: number): number;
/** The canonical cell; null when (x, y) is off a flat map. */
export function canonCell(map: MapLike, x: number, y: number): Cell | null;
/** The canonical cell's index y * W + x; -1 off a flat map (hot path, no allocation). */
export function cellIndex(map: MapLike, x: number, y: number): number;
/** The neighbour (x + dx, y + dy), canonical; null off a flat map. Callers keep their own direction order. */
export function stepTo(map: MapLike, c: Cell, dx: number, dy: number): Cell | null;
export function stepIndex(map: MapLike, x: number, y: number, dx: number, dy: number): number;   // or -1
/** 4-adjacent, across the seam on a wrapped map. */
export function isStep(map: MapLike, from: Cell, to: Cell): boolean;
export function torusManhattan(map: MapLike, a: Cell, b: Cell): number;
export function torusHypot(map: MapLike, a: Cell, b: Cell): number;
/** The image of x nearest `centre` on a period p (0: none): x + p * round((centre - x) / p). */
export function nearestImage(x: number, centre: number, p: number): number;
```

- `MapLike` is `Pick<MapData, 'width' | 'height' | 'wrap'>`.
- On a flat map every function behaves exactly as today's inline code.
- `stepIndex` compares and adds; it never calls `%`.

**Contract.**
- `MapData.wrap?: boolean` in `src/types/index.ts` (+2 lines with its comment; 433 to 435 of 442).
- `schemaValidation.ts` (+3 lines): `wrap` is a boolean. `wrap: true` needs `width % art.chunk === 0`, the same for
  `height`, and a streamed map (`streams(art)`); a violation throws. **Only streamed baked maps may wrap.** The
  legacy `assets/maps/overworld.yaml` (64x64) has no `wrap` key and stays flat. `TilemapRenderer` is not edited.
- The compiler's `PASSTHROUGH` gains `"wrap"`.

## 4. Movement, rules and state

**Canonicalise at the entry points, keep the lookups strict.** `fieldStep`, `canEnter` and `cellReader` canonicalise
their cell arguments once, at the top. `inBounds`, `baseTerrain`, `patchedTerrain`, `gateAt`, `dockFor`,
`staticNpcAt` and `hazardAt` stay strict: a non-canonical cell there is out of bounds, as today, so a missed
canonicalisation shows up as a refused step in tests, not as a silent wrap.

| File | Change |
|---|---|
| `src/systems/fieldRules.ts` (204) | `fieldStep(map, from, to, state)`: first `const t = canonCell(map, to.x, to.y)`; refuse when null, or when `!isStep(map, from, t)` (today's `\|dx\| + \|dy\| !== 1` refuses the seam step); then today's body on `t`. `canEnter(map, cell, …)` canonicalises `cell` first. `cellReader(map, state)` wraps each reader in one local `const k = (c) => canonCell(map, c.x, c.y) ?? c`. `modeAfterStep` gets its cells through `cellReader`. About +5 lines |
| `src/systems/fieldRulesVehicles.ts` | none (`stepMode` reads through the `CellReader`) |
| `src/rendering/CollisionMap.ts` (62) | the runtime reader. `getTerrainType`, `isWalkable` and `isCounter` canonicalise first, then call the strict rules. New: `wrapCell(x, y): {x, y} \| null` and `period: {x, y}` in px (0 on a flat map). The mode's `canMoveAt(x, y, t)` and the streamed `stepHeld` receive canonical cells |
| `src/entities/PlayerController.ts` (199) | `handleInput`: `next = collisionMap.wrapCell(tileX + dx, tileY + dy)`; `canMoveTo(next)` and the NPC set use canonical keys. The **drawn** target stays unwrapped (`targetX = tileX + dx`, which may be -1 or 256), so the sprite slides one tile. At the step's end: `tileX/tileY = canonical(target)`, `targetX/targetY = tileX/tileY`, and the sprite jumps by the period. `playerMove` carries the canonical cell. `stepRate` reads the target's terrain canonically. `targetTile` and `facingTile` return canonical cells. `carry` is kept across the seam. About +8 lines |
| `src/rendering/Camera.ts` (118) | `setMapBounds(w, h, wrap = false)`. With wrap, `clampX` / `clampY` return their input. In `update` with `smooth`, when `\|target - _x\| > period / 2`, `_x` moves by whole periods first. `getVisibleTileBounds` may return unwrapped bounds. About +10 lines |
| `src/systems/NPCInteraction.ts` (64) | across a counter, `dx` / `dy` come from `wrapDelta` and the far cell from `stepTo` (counters are in towns only; this is for correctness) |
| `worldRevalidate.ts`, `worldReset.ts`, `MapTransition.ts` | **not edited** (D-WR-11) |
| `FieldVehicles.ts` (247) | **not edited**: it reads `gridX` / `gridY` and calls `modeAfterStep`, which canonicalises |
| `EncounterSystem.ts` | none: `zoneAt` gets the canonical `playerMove` cell |
| `NpcWander.ts` | none. A data test asserts that a wrapped map has no `wander` NPC |
| Saves, `recordPlayer`, `DebugScenarioLoader` | none: positions are canonical; `SAVE_VERSION` stays 5 |

**Landing.** `canLand(map, {gridX, gridY})` reads canonical cells. The Mode 7 shadow-check cell is canonicalised in
place (7.4).

## 5. Top-down rendering

The rule: each world object draws at the image nearest the camera's centre. The view (20x11 cells, plus a 1-chunk
ring) is far smaller than the world, so each object has exactly one image in view.

| File | Change |
|---|---|
| `src/rendering/chunkStreaming.ts` (178) | `chunkRect(..., wrap)`: no clipping with wrap; the rect may run past either end. `viewSpan(at, view, size, wrap)`: no clamp. `flightWindow(x, y, n, chunk, cols, rows, wrap)`: with wrap, `c0 = mod(floor((x - margin) / chunk), cols)` (a canonical origin) and `c1 = c0 + n - 1` (may be >= cols); likewise the rows. New: `rectChunks(rect, cols, rows): Array<{ i, col, row }>` (canonical `i`, unwrapped `col` / `row`), shared by every consumer. About +20 lines |
| `src/rendering/StreamedChunks.ts` (222) | `update` has no clamps when the map wraps and takes `order` from `rectChunks`. Each frame it moves every wanted slot's sprites (below, above, placeholder) to the unwrapped col / row of its image (≤ 30 writes). `isVisible(i)` tests the image. `dir` uses `wrapDelta`, so the camera's period jump does not flip the look-ahead. `stepHeld` / `viewAt` use the wrapped `flightWindow` / `viewSpan`. `checkReady` iterates `rectChunks`. It stays under 250 by moving `inRect` and the placeholder position maths into `chunkStreaming.ts` |
| `src/rendering/BakedMapRenderer.ts` (165) | it passes `wrap` to the rect helpers. Patch sprites go to `nearestImage(x0 x TILE_SIZE, camCentre, W x TILE_SIZE)` (and in y) each render. **D-WR-10:** with wrap, `container.zIndex = WRAP_BELOW_Z`, and `aboveZIndex(map)` returns `WRAP_ABOVE_Z` (its signature gains `wrap`). `FieldAmbient`'s smoke (`aboveZIndex(map) + 1`) follows by itself |
| new `src/rendering/wrapImages.ts` (< 110 lines) | `WrapImages.apply(world, camera, period, skip: (c) => boolean)`. For each child of the world container not skipped, it takes the centre of the child's bounds in world space, computes `k = round((camCentre - centre) / period)` per axis, shifts `x` and `y` by `k x period`, shifts `zIndex` by `ky x periodY` **only when `\|zIndex\| < 1,000,000`** (layers, smoke and flying parts keep theirs), and records it. `restore()` undoes every record. It uses bounds, not `x`. A flat map (period 0) is a no-op |
| `src/scenes/exploration/FieldVehicleSprites.ts` (179) | **D-WR-9.** New `setWrapOffset(fn: (x, y) => { dx, dy })` (default zero) and `owns(child): boolean` (every part of a parked or ridden view, and `heroMask`). `placeParked` computes the foot point, adds `fn(footX, footY)`, then `place(...)` (z from the shifted foot, consistent with D-WR-10). It runs from `onRender`, so it is always last. The ridden view follows the hero and needs no offset. About +8 lines |
| `src/scenes/ExplorationScene.ts` (556 / 590) | `update(dt)` becomes `{ this.wrapImages.restore(); try { this.step(dt); } finally { this.wrapImages.apply(...); } }`, with today's body as the private `step`. `skip` is the two map containers or `vehicles.sprites.owns(c)`. `loadMap` passes `mapData.wrap` to `camera.setMapBounds` and sets the vehicles' wrap offset (`(x, y) => ({ dx: nearestImage(x, cx, PW) - x, dy: … })` from the live camera). One dev-only line publishes `window.__field` (10). About +9 lines (to about 565) |

- **Corners.** At (0, 0) the view's rect runs from chunk -1 to chunk 1 on both axes. `rectChunks` maps it to chunks
  {15, 0, 1}² and places chunk (15, 15) at unwrapped (-1, -1).
- **The step's end.** In one frame: `player.update` normalises; `camera.update` jumps by -W x TILE_SIZE;
  `tilemap.render` moves the chunks and patches to their new images; `wrapImages.apply` runs (in `finally`). Then
  Pixi renders, and each parked vehicle's `onRender` places its own image. The frame drawn equals the previous frame
  plus one tile of motion (tested in `wrapField`).

## 6. Map data and compile

### 6.1 The source and the compose checks

| File | Change |
|---|---|
| `layouts/world_source.py` (166) | the header gains `"wrap": True` beside `"sealed_edges": True` |
| `layouts/world_api.py` | `SEAM_MARGIN = 4`, `SEA_CLASS` (2) |
| new `worldgen/gates_wrap.py` (< 200) | `wrap_check(g, meta)`, **gated**: (i) every edge cell is Water; (ii) no non-Water cell within `SEAM_MARGIN` of an edge; (iii) the components on foot, foot+canoe and ship (the canal shut and open) are equal with and without wrap neighbours. `seam_report(g, zones)`, **report-only**: the seam stretches whose two zones' `SEA_CLASS` differ, with their lengths, and `UNCLASSED <id>` for a ship zone missing from the table |
| `layouts/world.py` (230) | 2 lines: `wrap` (gated) and `seam_zones` (prints `REPORT`, never fails) |
| new `worldgen/selftest_wrap.py` (< 150) | RED fixtures: land on an edge; land 3 cells from an edge; a ship zone missing from `SEA_CLASS` (the assertion of 2) |

No `quest.yaml` loader is needed (fix 6): the classes are the explicit table.

### 6.2 The compiler

| File | Change |
|---|---|
| `assets-src/tools/build_map.py` | `PASSTHROUGH` gains `"wrap"` (the same line). `write()` calls `HOOKS.check_seam(c.id, src, out_dir)` after `bake_mode7` (+1 line) |
| new `assets-src/tools/map_checks_wrap.py` (< 150) | `check_seam`, for `wrap: true` sources only: `wrap` needs `sealed_edges`. Per chunk row it compares the 1-px column across the E-W seam with that row's interior chunk boundaries; per column it does the same across the N-S seam. It fails when the seam exceeds max(interior) + 1.0 (mean abs, RGB), and prints `seam: x 5.7 (interior max 6.7), y 7.3 (7.7)` |
| `assets-src/tools/build_hooks.py` (183) | the `check_seam` hook (+6 lines) |
| `assets-src/tools/map_selftest.py` | `wrap` without `sealed_edges` is refused; a synthetic wrapped world with a seam stripe fails `check_seam` |
| `assets-src/tools/mode7_atlas.py` (207) | `cell_px(width)` returns `(ATLAS_PX // width, POT_LOW // width)` when `POT_LOW % width == 0` and `SRC_PX % low == 0` (256: **12 and 8**, giving 3072² and 2048²). Otherwise today's half (192: 16 and 8). The box 48 / 8 = 6 is whole |
| `assets-src/tools/nw1_selftest.py:14` | `cell_px(256) == (12, 6)` becomes `(12, 8)`, with the message "3072 // width, and 2048 // width for the POT low atlas" |
| `build_map.py --preview` | on a wrapped map, coordinates outside [0, W) read the chunks mod W (`--preview overworld 240 90 272 120 /tmp/x.png` crosses the east seam); `--grid` marks the seam in magenta |
| `tools/map_report.py` | unchanged (planar; by 1.2 it equals the wrapped result); its help says so |

- **Patch overlays.** The canal (x 93-100) and the north bridge (x 147-148) are far from the seams. The runtime places
  them by `nearestImage` anyway. No compile change.
- **Minimap.** None exists (nothing in `src/`).
- **The preview tools.** Only `--preview` needs a change (above).

### 6.3 Spots and scenarios

The new spots, as `SpotDef(name, base, offset, kind)`. `worldgen/bundle.SpotDef`: the composer resolves each to the
nearest cell of its kind. The cells in brackets are what they resolve to on today's ground. **None is EARTH's** (13).

| Spec file | `SpotDef` | Resolves near |
|---|---|---|
| `world_specs/fire.py` (spots list, :88-95) | `SpotDef("fir_s_seam_e", "fir_desert", (59, -7), "dock")` | (253, 200), sea |
| `world_specs/elf.py` (:57-59) | `SpotDef("elf_s_seam_s", "elf_elfheim", (-32, 57), "dock")` | (100, 253), sea |
| `world_specs/water.py` (:55-56) | `SpotDef("wat_s_seam_nw", "wat_onrac", (-64, -66), "dock")` | (3, 3), sea |
| `world_specs/wind.py` (:113-120) | `SpotDef("wnd_s_seam_landing", "wnd_gaia", (39, -10), "landing")` | (249, 31), grass |

- A `dock`-kind spot at sea follows the precedent of `wnd_s_ship` ("the ship at anchor off WIND").
- `landings` checks `wnd_s_seam_landing`.

`assets/data/debug-scenarios.yaml`, under `# === WR ===`:
- `wr_ship_east`: on the ship at `fir_s_seam_e`, facing east;
- `wr_ship_south`: on the ship at `elf_s_seam_s`, facing south;
- `wr_air_corner`: in flight at `wat_s_seam_nw`;
- `wr_air_land`: in flight at `wat_s_seam_nw`; fly east and south to land at `wnd_s_seam_landing` across the seam;
- `wr_parked`: the ship parked at `fir_s_seam_e`, the party in flight at `wnd_s_seam_landing`.

If the loader refuses a flying start over sea at a `dock` spot, `wr_air_corner` and `wr_air_land` start on the ship
there with the airship parked at `wnd_s_seam_landing`. The WR-3 agent checks this and records which.

## 7. Mode 7

### 7.1 The far atlas (`WorldAtlas.ts`, 184)

- **One rule for mips.** New `atlasMips(size, webgl2) = webgl2 || isPowerOfTwo(size)`.
  - `atlasTextureOptions(size, webgl2, wrap)` uses it: `addressMode: wrap ? 'repeat' : 'clamp-to-edge'`; mips (linear,
    anisotropy) when `atlasMips`; otherwise `autoGenerateMipmaps: false`, as today.
  - **`WorldAtlas.compose`** line 177, `if (this.opts.webgl2) this.rt.source.updateMipmaps();`, becomes
    `if (atlasMips(this.rt.width, this.opts.webgl2)) …`.
  - `WorldAtlasOptions` gains `wrap` (from `map.wrap`).
- **The WebGL1 NPOT guard** (fix 4).
  - `atlasSize(meta, map, profile, webgl2)` gains one check: `map.wrap && !webgl2 && !isPowerOfTwo(size)` throws
    `mode7.json: a wrapped map needs a power-of-two atlas under WebGL1 (<size>)`.
  - `WorldAtlas.load` calls `atlasSize` first, so it rejects. FlightView's existing load handler
    (`FlightView.ts:137-138`) logs `console.error` once and sets `failed`, so the airship flies top-down. No new path.
  - D-WR-6's bake never produces this case. The guard is for a stale or hand-made atlas.
- **Tests** (fix 3, fix 4):
  - `worldAtlas.test.ts:48-50`: the options expectation runs per wrap (flat: clamp, as today; wrapped: repeat).
  - `worldAtlas.test.ts:98-105` ("the low profile without WebGL2 … builds no mips") becomes two cases: on a wrapped
    world whose meta gives `lowSize` 2048, `texture.width` 2048 with `autoGenerateMipmaps` true and `updateMipmaps`
    called; on a flat stub world whose meta gives 1536, no mips, as today.
  - A new case: a wrapped world, low profile, `webgl2: false`, meta `lowSize` 1536 makes `load()` reject with the
    guard's message.
  - `mode7Activation.test.ts`: that rejection leaves `__mode7.failed` true and the flight top-down, as the
    missing-atlas case does today.
  - `tests/data/mode7Atlas.test.ts:37`: `{ …, lowCellPx: 8, lowSize: world.width * 8, … }`, with the title "8 px on
    the POT low atlas".
- **Mips at the seam.** `generateMipmap` does not filter across the edge, but both sides are uniform open sea. B4
  looks for a line.
- **Precision.** `P` is canonical, so the far UVs lie in about [-0.35, 1.35].
- **Memory, low profile.**
  - Atlas render texture: 2048² x 4 x 4/3 = 22.4 MB (was 1536², 9.4 MB, with no mips under WebGL1).
  - **The compose peak is 39.2 MB** (the render texture plus the 16.8 MB source while composing).
  - The low flight total is about 71.6 MB (22.4 + near 9.4 + 16 chunks 37.8 + 2), and 88.4 MB while composing (was
    61.8 / 71.2).
  - Full is unchanged: 175 MB, and 212.7 MB while composing.

### 7.2 The projection and the strips (`mode7Math.ts` 226, `GroundStrips.ts` 129)

- `fillStrips` is unchanged. It writes unwrapped UVs, and `REPEAT` wraps them.
- `MapCells` gains `wrap?: boolean`. With wrap, `rowFits` has no open sides, `rowOffMap` is always false, and
  `nearSplit` follows. `GroundStrips` passes `{ w, h, wrap }`.
- The flat behaviour and its clamped-edge tests are unchanged.
- **No double images.** At the flight values the farthest ground row spans 125 cells and lies 78.5 cells ahead, both
  under W / 2 = 128. A test pins it.
- **AV's new `mode7Math` helper** (7.4) lands in the same file (226 + about 8, still under 250).

### 7.3 The near window (`FlightStream.ts` 88, `NearDetail.ts` 172)

- **The window.**
  - `nearWindow` uses the wrapped `flightWindow`: a canonical `rect`, plus the image origin
    `ix0 = x0 + W x round((px - (x0 + cells / 2)) / W)` (likewise `iy0`).
  - `NearWindow` gains `ix0` / `iy0`, and `FlightRenderer` builds the `NearSquare` from them.
- **No recentre at the seam.** When the hero normalises from 256.0 to 0.0 the rect stays the same (`same()` holds), so
  there is no recentre and no redraw; only `ix0` changes, by W.
- **`NearDetail.draw`.**
  - The window box `[x0, x0 + cells)` may pass W. `wrapBoxes(box, W, H)` (new, in `NearDetail.ts`) splits it into
    at most 4 canonical pieces, each with its unwrapped placement.
  - The underlay draws one far-atlas sub-frame per piece, placed at that piece's unwrapped position; at the corner
    that makes 4 sub-frames.
  - The chunks come from `rectChunks` (canonical `i`, unwrapped square).
  - A patch draws at its image inside the box (`nearestImage` on the box's centre, then `clipBox`).
  - A late chunk `i` draws into its square at `col' = c0 + mod(col - c0, cols)`, and likewise the row.
- `StreamedChunks.setWindow` takes the unwrapped rect, mapped by `rectChunks`. The step hold reads the wrapped
  `flightWindow`.

### 7.4 Billboards, shadow, marker, clouds (rebased on AV)

| File | Change |
|---|---|
| `propMath.ts` (122) | `placeProp(view, src, horizon, fog, wrap?: {w, h})`: the ground point moves to its image nearest P (`gx' = px + wrapDelta(px, gx, w)`); the sprite's offset from it is kept. `PROP_RANGE` 40 < W / 2. Parked vehicles read through `propSources` may carry a top-down image shift (D-WR-9), and `wrapDelta` makes the result independent of it |
| `FlightBillboards.ts` (98, about 108 after AV) | it takes `{ w, h, wrap }` at construction and passes it to `placeProps` (+2 lines). AV's `ShipDraw.heading` and shadow cache are untouched |
| `FlightSky.ts` (108) | a cloud odometer: `place(tMs, px, horizon)` accumulates `cloudPx += wrapDelta(lastPx, px, W)` and feeds `cloudPlace` the odometer, so the clouds never jump by 256 x parallax |
| `FlightRenderer.ts` (154, about 157 after AV) | it passes the map's size and wrap to `GroundStrips`, `FlightBillboards` and `FlightSky`, and builds the `NearSquare` from `ix0` / `iy0` (+4 lines) |
| `FlightView.ts` (249 after AV; budget **≤ 248**) | **extract first:** the marker corners (`corner` and `marker`, today's :215-217) move to `mode7Math.cellMarker(view, here): Pt[]` (−2 lines in FlightView). Then one in-place edit: the mismatch check's `cell` is canonicalised (`canonCell(map, …)` in the same expression). FlightView ends at **247** |
| Shadow, marker | at P and the canonical `here`; during a step `here` is the origin cell, as today |

### 7.5 The tilt at the seam (the t = 0 match)

- On a wrapped map the camera never clamps, so the start anchor is always (960, 480).
- At t = 0 the top-down chunks draw at their images around the camera, and Mode 7 samples the near square at `ix0`
  and the far atlas with `REPEAT`. Both express the same unwrapped frame around P.
- The match is checked at P (255.5, 100.5), (0.5, 100.5), (100.5, 255.5) and the corner (0.5, 0.5).
- `tiltOut` after a crossing starts from the live camera, with the hero canonical (a landing needs the hero idle).

### 7.6 Fog, horizon, streaming, the pilot

- **Fog and horizon:** unchanged.
- **Streaming:** the window size is unchanged (25 / 16 wanted, cap 36 / 16). The canonical rect adds no `setWindow`
  call at the seam.
- **The pilot:** `Mode7PilotScene` stays flat (its `m7_edge` preset documents the old clamp).

## 8. The verifier

### 8.1 The neighbour function (D-WR-7): the 9 loops

Each loop's `{ x: c.x + dx, y: c.y + dy }` plus its bounds test becomes `stepTo(map, c, dx, dy)`, or `stepIndex` in
the hot loops. The edits are line-neutral, and each caller's direction order is kept.

| # | File (lines) | Site |
|---|---|---|
| 1 | `questExits.ts` (89) | :22-23, the land side of an exit (`landSide`) |
| 2 | `questExits.ts` | :82, the cells round a vehicle place |
| 3 | `questMutateFind.ts` (248) | :152-153, a dock's walkable shore |
| 4 | `questMutateFind.ts` | :175-176, the cut search |
| 5 | `questPlaces.ts` (188) | :119-120, the component labelling |
| 6 | `questPlaces.ts` | :171-176, the NPC 4-neighbour and across a counter (`stepTo` twice) |
| 7 | `questRoute.ts` (109) | :80-82, the witness route |
| 8 | `questSearch.ts` (246) | :235-236, the place BFS |
| 9 | `questTravel.ts` (222) | :166-169, the travel BFS |

Also: `questGeo.worldPathLength`'s nearest dock (:131) uses `torusHypot`. Not edited: `questExplore.ts` (it scans
maps) and the runtime relocation files (D-WR-11).

### 8.2 The proofs

| Proof | Effect | Gate |
|---|---|---|
| (a), (b), (c) | Places and components are unchanged (1.2), so the state graph is too | (c)'s state count equals the flat run's (the WR-0 agent records it on the base first; NW-5 gave 1,348,366). `questGraph.test.ts` (heavy) is unchanged |
| (d) | the ship legs are shorter, and may cross the seam into late seas (1.4) | 8.3 |
| (e), (f) | unchanged | the same lines |
| (g) | planar (D-WR-4); detour lengths can only fall | the same 31 pairs and s*; report: `wrapped: <n> pairs shorter across a seam` |
| (h) | the rows are unchanged (1.2) | each row's result is the same. **New `WRAP`:** `wrapInvariant(map)` in a new `src/progression/questWrap.ts` (< 120) compares the flat and wrapped labellings of walk, walk+canoe and ship (the canal and bridge patches shut and open) and fails with `WRAP joins <a> and <b> at (x, y)` |
| `--mutate` | each mutated context uses the same neighbour function | once at WR-INT (background); every row's result unchanged |
| `--from-reset` | reset states are canonical and relocated planar | OK |

### 8.3 The curve gate (Q4 (b)) and the expected delta

**The gate** (WR-3; all three must hold):
1. `npm run quest -- --strict`: every stage in its band;
2. `tests/balance/questCurve.test.ts`: wipes within its bounds;
3. every stage's curve level within ±0.5 of today's (the base `--json` recorded by WR-0).

**The expected delta** (1.4; the WR-3 agent measures the real witness):
- Each wrapped ocean voyage that takes the BFS route (Melmond - Crescent, Melmond - `fir_ice`, and the Pravoka voyages
  through Melmond's leg) gains up to **+39 late-sea cells** (26 to 65, all `wat_sea`) and loses about 45 early cells.
- At the late seas' scaled rate (23-50 steps, mean 36.5, factor 2.25, so about 82 steps per fight) and the early seas'
  (factor 2.25 for `a1_north_sea`, `ert_sea` and `fir_sea`, so the same 82), that is about **+0.48 late fights and
  -0.55 early fights per voyage**.
- Late enemies give much more xp, so the stages whose witnesses sail those legs could gain levels, and the replay's
  wipe count could rise. Those are the stages from the canal (S10) to the Ice Cavern (S16) whose witnesses take the
  ocean.
- This is not obviously within ±0.5, which is why the gate exists.

**The report.** A report-only list in `questReport` gives each stage's seam crossings and late-sea cells on its
witness.

### 8.4 F-WR: the fallback (only if 8.3 fails)

**Trigger:** any of 8.3's three conditions fails, and the failing stage's witness crosses a seam into a late zone
(the report shows it). F-WR is then applied in full, in WR-3, and 8.3 is re-run.

**The zones.** Four new ship zones, each **owned by the late-side region**, each a copy of the early table it meets,
over a band of `SEAM_BAND` = 8 cells on the late side. The bands are all Water: the land starts at y 8, and at x >= 8
for y 98-119.

| Zone id | Owner and module | Cells (taken out of the parent's mask) | Table copied (by import, so it stays in sync) | `world_balance.py` factor |
|---|---|---|---|---|
| `wat_seam_w` | WATER, `water/world_water_nw_zones.py` (beside `wat_sea`, :67) | x 0-7, y 98-119 | `fir_sea`'s, `fire/fire_tables.SEA` | 2.25 (as `fir_sea`) |
| `wat_seam_n` | WATER, the same module | y 0-7, x 0-106 | `elf_sea`'s, `elf/world_zones.SEA` | 1.0 (`elf_sea` has none) |
| `ord_seam_n` | ORDEAL, `ordeal/world_ordeal_nw.py` (beside `ord_sea`) | y 0-7, x 107-169 (x 167-169 meet `fir_sea`; one table for the run: the majority's, `elf_sea`) | `elf_sea`'s | 1.0 |
| `wnd_seam_n` | WIND, `wind/world_nw.py` (beside `wnd_sea`, :154) | y 0-7, x 170-255 | `fir_sea`'s | 2.25 |

- **The mechanics.** Each module removes the band from its own sea mask **before** `row_rects`, so no cell is in two
  zones and no lookup depends on zone order. It emits the seam zone with `modes: ["ship"]`, a name ("Onrac Seas, far
  rim", "Cardia Sound, far rim", "North Seas, far rim") and backdrops `{"default": "ocean"}`.
- **The shared tables.** A new `layouts/sea_tables.py` (< 40 lines) re-exports `EARLY_SOUTH = elf.world_zones.SEA`
  and `EARLY_EAST = fire.fire_tables.SEA`, so the late regions import one module, not each other's.
- **Data.**
  - `assets/data/quest.yaml:574`'s stage `zones` gains `overworld:wat_seam_w, overworld:wat_seam_n,
    overworld:ord_seam_n, overworld:wnd_seam_n`, beside their parents.
  - `world_balance.py` gains the 4 factors.
  - `SEA_CLASS` lists all 4 as early.
  - The `seam_zones` line becomes **gated** (`OK` when every seam pair matches by class).
- **The region tests to update:**
  - `tests/quest/water/wat_o_world.test.ts:244` (the zone id and mode list gains the two), :268-273 (each new zone
    holds only Water `o`; every Water cell in at most one ship zone), :290 (backdrops);
  - `tests/quest/wind/wnd_o_world.test.ts:153` (the list), :155-172 (Water only; the name check);
  - `tests/quest/ordeal/ord_o_world.test.ts:185-199` (the list; Water only);
  - `tests/data/overworldZoneCoverage.test.ts`: unchanged rule; it runs as the check;
  - `tests/data/crossFileValidation.test.ts` and `assetCoverage.test.ts`: automatic (copied enemy ids);
  - `tests/data/worldWrap.test.ts` gains "every seam pair's zones are of one class".
- **Not touched:** the frozen `tests/fixtures/passW/` (the new ids are additions, and the kept-id comparisons are
  over pass W's ids); EARTH's files (`ert_sea` meets `fir_sea`, already matched).
- **Effort:** +4 h in WR-3, and one more world compile.

### 8.5 Performance

- `stepIndex` adds a compare and an add per neighbour, and nothing on a flat map.
- **Gate:** the **median of 3 runs each way** of `npm run quest -- --strict` (base and WR-0, the same machine, nothing
  else heavy running): the wrapped median within +5 % of the base median, with the 8 GB heap unchanged.

## 9. Performance and memory (runtime)

| Item | Cost |
|---|---|
| Chunks wanted per frame | unchanged: 30 top-down, 25 / 16 in flight; caps 60 / 36 / 16 |
| Chunk sprite placement | ≤ 30 position writes per frame |
| `WrapImages` | ≤ about 40 children: one bounds read and up to 3 writes each, under 0.05 ms |
| Parked vehicles | one `wrapOffset` call per parked view per render |
| Mode 7 | `REPEAT` is free. Low profile: the compose peak is 39.2 MB and the flight total about 71.6 MB (7.1). The p95 gates of MODE7_PLAN 9 are unchanged |
| Compile | `check_seam` reads 64 chunk files, under 2 s; `mode7_low.png` is 2048² (about +0.8 MB of PNG) |
| Verifier | ≤ +5 % (8.5) |

## 10. Tests

| Test | What |
|---|---|
| new `tests/systems/worldWrap.test.ts` | `mod`; `wrapDelta` (the tie at W / 2 gives -W / 2; flat gives b - a); `stepTo` / `stepIndex` / `cellIndex` flat and wrapped; `isStep` across both seams, and refused on a flat map; `torusManhattan`; `nearestImage`. A seeded property test: a step then its opposite returns home, over 10,000 cells |
| `tests/systems/fieldRules.test.ts` (+) | `fieldStep` (255, y) to (0, y) and (x, 0) to (x, 255) is OK wrapped and refused flat; `fieldStep` with a non-canonical `to` (256, y) is accepted wrapped; `canEnter` on (-1, y); a `cellReader` lookup at (256, y); the strict lookups (`baseTerrain(-1, y)` is Wall even on a wrapped map); a ship `modeAfterStep` across the seam |
| `tests/rendering/CollisionMap.test.ts` (+) | `getTerrainType` / `isWalkable` / `wrapCell` wrapped; flat unchanged |
| new `tests/entities/playerWrap.test.ts` | east, west, north and south crossings and the corner in two steps: the sprite's x is monotone through the step and jumps by exactly one period at its end; `gridX`, `playerMove`, `targetTile` and `facingTile` canonical; the carry kept; an NPC on (0, y) blocks a step from (255, y) |
| `tests/rendering/Camera.test.ts` (+) | no clamp with wrap; the smooth rebase; flat clamps unchanged |
| `tests/rendering/streamWindow.test.ts` (+) | wrapped `chunkRect` / `viewSpan` / `flightWindow` (x 2: c0 15; x 250: chunks 15, 0, 1); `rectChunks` without duplicates; over a fake source, chunk 15 at -768 px with the camera at x 0; `stepHeld` across the seam; `dir` survives the period jump |
| new `tests/rendering/wrapImages.test.ts` | k from bounds; `restore` returns every child; a `Graphics` at absolute coordinates with x 0 is not shifted; **zIndex (fix 2):** on a wrapped map with `WRAP_BELOW_Z` / `WRAP_ABOVE_Z`, an NPC image shifted by -H x TILE_SIZE still sorts above the below container and under the above one, and the smoke and a `FLYING_Z` part keep their zIndex; a flat map is a no-op |
| new `tests/scenes/exploration/parkedWrap.test.ts` | **fix 1:** a `FieldVehicleSprites` with a parked ship across the seam; `apply`, then the parts' `onRender` callbacks are called (as Pixi does at render); the ship is at its image; `restore` leaves the parts where `placeParked` put them (skipped, so nothing is double-subtracted); the next frame's `apply` plus `onRender` is the same |
| `tests/rendering/bakedStreaming.test.ts` (+) | patch images; the layer sentinels on a wrapped map; flat zIndex unchanged (-1 and `(H + 2) x TILE_SIZE`) |
| new `tests/helpers/streamedWorld.ts` | `mode7Parity`'s `streamedWorld()` and `fakeChunks()` (the `Assets.load` spy), moved here with a `wrap` option; `mode7Parity.test.ts` imports them (fix 5) |
| new `tests/scenes/wrapField.test.ts` | `ExplorationScene` on a **streamed** 192x192 wrapped world (144 chunks, so it streams; `streamedWorld({ wrap: true })`): the ship crosses east and west, the airship the corner; on the frame of the step's end every visible chunk sprite's screen position moves by one tile only; `game.playerPosition` and a save are canonical; `zoneAt` on the far side; a landing on the first grass after a crossing; a parked ship across the seam drawn at its image |
| new `tests/scenes/mode7/mode7Wrap.test.ts` | `fillStrips` across a step end: `frac(u)` equal; `nearWindow` the same rect at P 255.9 and 0.0, with `ix0` moved by W; `rowFits` / `rowOffMap` with wrap; `atlasTextureOptions` repeat; POT mips under WebGL1; `placeProp` of a prop at x 3 seen from P 254, the same with the sprite pre-shifted by -W x TILE_SIZE; the cloud odometer continuous; no double images (7.2); `cellMarker` equals the old inline corners |
| `tests/scenes/mode7/nearDetail.test.ts` (+) | `wrapBoxes` at the corner gives 4 pieces; late chunk 15 drawn into its square of a window at c0 15 |
| `tests/scenes/mode7/mode7Tilt.test.ts` (+) | the t = 0 match against a wrapped `Camera` at the 4 points of 7.5 |
| `tests/scenes/mode7/mode7Parity.test.ts` (+, **added in WR-2**) | through `flightHarness.ts` on `streamedWorld({ wrap: true })`: a 30-step flight across the east seam and the corner; the end state and cells equal to top-down; `recentres` not raised by the seam step |
| `tests/scenes/mode7/worldAtlas.test.ts`, `mode7Activation.test.ts`, `tests/data/mode7Atlas.test.ts:37` | 7.1 (fixes 3, 4) |
| new `tests/progression/wrapWorld.test.ts` | synthetic wrapped maps: a ship route across the seam is shorter; components equal; `wrapInvariant` RED on land at an edge and on a bridge cell at x 0; green on the real world; planar (g) on the real world unchanged |
| new `tests/data/worldWrap.test.ts` | the compiled `overworld` has `wrap: true`; edges Water; margin ≥ `SEAM_MARGIN`; no `wander` NPC; `mode7.json` `lowCellPx` 8 and `lowSize` 2048; the 4 spots exist with their kinds |
| **Ceilings (fix 3)** | `tests/data/fileCeilings.test.ts` `NEW_FILES` (:22) gains `src/systems/worldWrap.ts`, `src/rendering/wrapImages.ts` and `src/scenes/exploration/fieldProbe.ts`. `tests/data/questCeilings.test.ts` `FILES` (:28) gains `assets-src/tools/map_checks_wrap.py` (its region and `worldgen/` scans already find `worldgen/gates_wrap.py`, `selftest_wrap.py` and, under F-WR, `layouts/sea_tables.py`; if a scan misses one, add it to `FILES`). `src/progression/questWrap.ts` is found by the `src/progression/` scan. `mode7Ceilings` covers the mode7 folder |
| Python | `selftest_wrap.py` (3 RED fixtures); `map_selftest.py` (2); `nw1_selftest.py`; `mode7_atlas.py --check-determinism` |

**The field probe** (for B1 and B3). New `src/scenes/exploration/fieldProbe.ts` (< 40 lines): in dev only
(`import.meta.env.DEV`), it sets `window.__field = { cell: {x, y}, mode, zone: encounterSystem.zoneAt(x, y)?.id ?? null }`
each frame. `ExplorationScene` calls it with one line. (`__trace` does not log zones.)

**Browser checks** (WR-INT; `npm run dev`; every URL has `&mute=1`; output in `~/temp/ff-game/world_wrap/int/`):

| # | URL | Check |
|---|---|---|
| B1 | `?mute=1&scenario=wr_ship_east&mode7=0` | sail 6 cells east across x 255 \| 0: no camera jump, no placeholder; `__field.cell.x` goes 253, 254, 255, 0, 1; `__field.zone` is `fir_sea` then `ert_sea`; 3 screenshots |
| B2 | `?mute=1&scenario=wr_air_corner&mode7=0` | fly north-east across the corner: the four chunks round (0, 0) |
| B3 | `?mute=1&scenario=wr_ship_south&mode7=0` | sail south across y 255 \| 0: `__field.cell.y` goes 254, 255, 0; `__field.zone` is `elf_sea` then `wat_sea` (or `wat_seam_n` under F-WR) |
| B4 | `?mute=1&scenario=wr_air_corner` (Mode 7) | fly across all four seams and the corner: no clamped band, no black row, no seam line; `__mode7.textures.recentres` not raised by a seam step; the steady p95s within MODE7_PLAN 9 |
| B5 | `?mute=1&scenario=wr_air_land` | cross the seam, then land at `wnd_s_seam_landing`: the last tilt-out frame matches the top-down frame (≥ 99.5 % of the pixels above the HUD band identical) |
| B6 | `?mute=1&scenario=wr_parked` | the parked ship at `fir_s_seam_e`, seen across the seam: a sprite top-down (`&mode7=0`), a billboard in Mode 7 |
| B7 | `?mute=1&scenario=wr_air_corner&mode7=low` | the low profile across the seam (the 2048 POT atlas repeats) |
| B8 | B4, then a save in flight past the seam, then Load | the same canonical cell and the same view |
| B9 | `?mute=1&scenario=w_s18_start`, `?mute=1&scenario=act1_overworld` | regression away from the seams |

WebGL1 cannot be forced from the page in Chrome. Its options and the guard are unit-tested (7.1). A run with
`--use-angle=swiftshader-webgl` and `webgl2` disabled is report-only.

## 11. Tranches

Rules:
- Each tranche is a branch from `mainline`, mergeable on its own. Agents run `npm run build`, `npm run test:fast` and
  their touched tests.
- The world is never hand-merged: the integrator full-compiles under the lock at each world merge and commits the
  chunks and the atlas. `mode7*.png` is never hand-merged (R13).
- Scratch stays in `/tmp/<agent>/`; review output goes to `~/temp/ff-game/world_wrap/<tranche>/`.
- **Nothing wraps until WR-3**, because no map has `wrap: true` before it.

| Tranche | Owner | Content | Gates | Depends | Effort |
|---|---|---|---|---|---|
| **WR-0 Contract** | runtime agent | 3; 4's `fieldRules` / `CollisionMap`; 8.1's 9 loops and `questGeo`; `questWrap.ts` and `WRAP`; **the base recorded**: `--strict --json`, the (c) state count, and the median of 3 timings | `worldWrap`, `fieldRules`, `CollisionMap`, `wrapWorld` tests; `npm run quest -- --strict --json` identical to the base (timings aside); the median timing within +5 %; test:fast | — | 5 h |
| **WR-1 Top-down** | runtime agent | 4's `PlayerController`, `Camera`, `NPCInteraction`; 5 in full (`chunkStreaming`, `StreamedChunks`, `BakedMapRenderer` with D-WR-10, `wrapImages.ts`, `FieldVehicleSprites` with D-WR-9, the `ExplorationScene` hook, `fieldProbe.ts`); `tests/helpers/streamedWorld.ts` | `playerWrap`, `Camera`, `streamWindow`, `bakedStreaming`, `wrapImages`, `parkedWrap`, `wrapField` tests; every existing scene and rendering test unchanged; test:fast | WR-0; **after AV-1/AV-2** if AV has edited `FieldVehicleSprites` (rebase) | 9 h |
| **WR-2 Mode 7** | Mode 7 agent | 7 in full, **rebased on AV**: FlightView's extraction then its in-place edit (≤ 248, target 247); `mode7_atlas.py` (2048 POT) and a **by-hand atlas re-bake** under the lock (`mode7_atlas.py overworld`; chunks unchanged); `nw1_selftest.py:14`; `mode7Atlas.test.ts:37`; `worldAtlas.test.ts`, `mode7Activation.test.ts`; **the `mode7Parity` wrapped variant** | `mode7Wrap`, `nearDetail`, `mode7Tilt`, `mode7Parity`, `worldAtlas`, `mode7Activation`, `mode7Atlas` tests; `mode7_atlas.py --check-determinism overworld`; `nw1_selftest.py`; test:fast; a scratch probe of `REPEAT` on a copy with `wrap: true` in `/tmp/<agent>/` (report-only) | WR-1, **AV merged** | 9 h |
| **WR-3 World data** | integrator, or a world agent with the integrator's compile | 6 in full: `wrap: True`, the passthrough, `gates_wrap.py` / `selftest_wrap.py`, `SEA_CLASS`, `map_checks_wrap.py`, `--preview`, the 4 `SpotDef`s, the `wr_*` scenarios; the full world compile; **8.3's curve gate**; F-WR if it fails | `world.py` gated lines OK (`wrap`, `landings`, `coverage`, …) and `seam_zones` printed; the seam figures; `worldWrap` data test; `npm run quest -- --strict` (every proof; (c) count equal; WRAP OK); 8.3's three conditions; `--from-reset`; test:fast | WR-2, **QW merged** | 6 h (+4 h with F-WR) |
| **WR-INT** | integrator | determinism (`build_map.py --check-determinism overworld`, `mode7_atlas.py --check-determinism overworld`); `--strict --mutate` once in the background; B1-B9; test:full; docs: AGENTS.md "The world (pass NW)" (the edges and `wrap`, the camera clamp, Mode 7 far atlas "clamp-to-edge" -> repeat, the near detail's open sides, the low atlas 2048 at 8 px, the ExplorationScene ceiling line), `docs/MODE7_PLAN.md` 2.5 / 3.1 superseded lines, PROGRESS, this plan's result section | all of 0 | all | 5 h |

- **Merge order:** AV (its own plan) and WR-0 in either order; then WR-1, then WR-2 (WR-1 before WR-2; AV before
  WR-2); then QW, then WR-3; then WR-INT.
- **Totals:** about 34 h (38 h with F-WR). The critical path WR-0 -> WR-1 -> WR-2 -> WR-3 -> WR-INT is about 34 h,
  plus 2 full compiles (3 with F-WR) and the mutate run.

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| WR1 | A step across the seam double-counts or skips an arrival | one normalisation at the step's end; the entry-point canonicalisation (4) with strict lookups; `playerWrap` and `wrapField` assert one `playerMove` per step, canonical |
| WR2 | The camera's period jump shows for a frame | the fixed order of 5; `apply` in `finally`; the frame test of `wrapField` |
| WR3 | `WrapImages` and an owner disagree on a child's position (the `onRender` case) | vehicles skipped and self-placed (D-WR-9); `parkedWrap` calls `onRender` after `apply`. Any future `onRender` owner in the world container must be skipped the same way (a comment in `wrapImages.ts`) |
| WR4 | A shifted image sorts under the below layer or over the above one | the sentinels (D-WR-10); `wrapImages.test.ts` |
| WR5 | The witness sails into the late seas and a stage leaves its band or the wipes rise (1.4, 8.3) | the curve gate; F-WR fully specified (8.4) |
| WR6 | Mode 7 samples black under WebGL1 | the 2048 POT low atlas; the `atlasSize` guard into `failed`; unit tests |
| WR7 | Mips leave a line at the seam | uniform sea both sides; B4; if visible, `mode7_atlas.py` copies 2 px of the opposite edge into each edge at bake time (bytes only) |
| WR8 | The near window recentres at each seam step | canonical rect plus `ix0`; the parity test counts recentres |
| WR9 | The verifier slows | `stepIndex` without `%`; the median-of-3 gate |
| WR10 | A future edit puts land near an edge | `SEAM_MARGIN`, `wrap` at compose, `check_seam` at compile, `WRAP` in (h) |
| WR11 | WR-2's re-bake and QW's recompile collide under the lock | the lock serialises them; the integrator recompiles at the later merge (R13) |
| WR12 | `FlightView` goes over its ceiling after AV | the extraction of 7.4 first (≤ 248, target 247) |
| WR13 | The walk near the south and east coasts now centres the camera | by design; B9 shows act 1 unchanged |

## 13. Conflicts with the work in flight

| Agent | Their change | Overlap | Resolution |
|---|---|---|---|
| **QF** | the airship speed, `AirshipMode.ts` | none in files. A faster airship crosses chunk lines more often; the seam costs nothing extra | none. WR-2's parity and p95 checks run on QF's speed if it has merged |
| **QW** | EARTH's sage cave, the Melmond cue, a world recompile | the world source and compile. WR-3 edits `world_source.py` (1 line), `world.py` (2), `world_api.py`, and the FIRE, ELF, WATER and WIND spot lists. **Not EARTH's.** F-WR touches WATER, ORDEAL and WIND content, `world_balance.py` (4 entries) and `quest.yaml:574`, never EARTH | **WR-3 after QW merges**: rebase, re-run `world.py`, one integrator compile. If QW's cue falls within `SEAM_MARGIN` (unlikely: Melmond is at x 82), `wrap` names it |
| **AV** (PA's plan) | the airship's front and back views; one heading owner in `FieldVehicleSprites`; `FlightView` -1 +1 (249); `FlightBillboards` +10 (about 108); `FlightRenderer` +3; `FieldVehicles` to about 250 | **the shared files:** `FlightView.ts`, `FlightBillboards.ts`, `FlightRenderer.ts` (WR-2), and `FieldVehicleSprites.ts` (WR-1: `setWrapOffset`, `owns`, `placeParked`) | **AV lands before WR-2.** WR-2 rebases and budgets `FlightView` against 249: extraction first, ≤ 248. WR-1 rebases on AV's `FieldVehicleSprites` if AV merged first, otherwise AV rebases on WR-1; the ridden view's heading is screen- and hero-relative and needs no wrap offset. WR never edits `FieldVehicles.ts` |

## 14. Rulings

| # | Question | Status |
|---|---|---|
| Q1 | Every mode, or only the airship? | **ruled: every mode** (D-WR-1) |
| Q2 | Open ocean at the seam, or continents across it? | **ruled: open ocean** (D-WR-2) |
| Q3 | Proof (g) planar or wrapped? | **ruled: planar** (D-WR-4) |
| Q4 | The seas where late meets early across the seam | **ruled: (b), no band** (D-WR-5); the curve gate of 8.3; F-WR (8.4) if it fails |
| Q5 | A stage pushed out of band | **ruled: re-fit `world_balance.py`'s factors; never move geography.** Under Q4 (b) the first remedy for a seam-caused failure is F-WR; the factor re-fit follows if needed |
| Q6 | A visible cue at the seam? | **ruled: none** |

No question is open.

## 15. TODOs

```markdown
## TODOs
- [x] Measure the edges, margins, ship components and dock distances flat vs wrapped (2026-11-22)
- [x] Measure the seam art and the sea zones along each edge and on the wrapped routes (2026-11-22)
- [x] Count the anchor pairs a wrapped metric would change (2026-11-22)
- [x] Rev 2: the integrator's rulings (Q1-Q6), momus's 6 required fixes and 9 concerns (2026-11-22)
- [ ] Momus re-review of rev 2 (priority: high)
- [ ] WR-0 contract, the 9 loops, WRAP, the base recorded (priority: high, effort: 5h)
- [ ] WR-1 top-down, wrapImages, parked vehicles, layer sentinels, field probe (priority: high, effort: 9h)
- [ ] WR-2 Mode 7 on AV: repeat, POT low atlas re-bake, near window, props, clouds, tilt, parity (priority: high, effort: 9h)
- [ ] WR-3 world data, spots, scenarios, compile, the curve gate (F-WR if it fails) (priority: high, effort: 6-10h)
- [ ] WR-INT determinism, --strict --mutate (background), B1-B9, docs (priority: high, effort: 5h)
```

## Changelog

- **rev 2 (2026-11-22).** Momus's targeted revision and the integrator's rulings; see "Momus fixes" at the top.
  Removed: the zone band, `world_seam.py`, the gating `seam_zones`, the TilemapRenderer wrap, the `quest.yaml` loader,
  and the wrapped relocation in `worldRevalidate` / `MapTransition`. Added:
  - D-WR-9, the parked vehicles placing their own image;
  - D-WR-10, the layer sentinels;
  - D-WR-11, relocation stays planar;
  - F-WR, the fallback seam zones;
  - the field probe;
  - the `SpotDef`s;
  - FlightView's extraction.
- **rev 1 (2026-11-22).** First version.

## Result (WR-0 to WR-INT, 2026-11-22)

**The user's ruling on S21 (2026-11-22):** S21's band is widened to [25, 29] (`assets/data/quest.yaml`), and F-WR is
dropped. The wrapped world keeps every sea zone as it is (Q4 (b)); `seam_zones` stays a report-only line.

Branch `wr`: WR-0 `3e8d4e88`, WR-1 `13fde331`, WR-2 `e1069997`, the merge of mainline after QW2 `71d2fd03`, WR-3
`f456ccb0` (with F-WR), WR-INT `85b95403` (docs), then the ruling's commit (F-WR reverted, S21's band, these figures).

**Built as planned.** Every mode wraps on `overworld`; every other map is flat. Momus's last amendment was taken:
`FieldVehicleSprites`' module exports `vehicleParts` (a WeakSet of the parts it owns) and `setVehicleWrapOffset`;
`ExplorationScene` imports them and `FieldVehicles.ts` is untouched (243 lines). Line counts: `FlightView.ts` 247,
`ExplorationScene.ts` 581 / 590, `PlayerController.ts` 205, `src/types/index.ts` 435 / 442, `questMutateFind.ts` 248.

**Gates (after the ruling).**

| Gate | Figure |
|---|---|
| WR-0 `quest --strict --json` | byte-identical to the base (flat world) |
| WR-0 verifier time, median of 3 | base 122.11 s (120.83 / 122.11 / 124.13), WR-0 122.51 s (124.39 / 122.51 / 122.05): +0.3 % |
| (c) state count | 847,265 base (before and after QW2), 847,265 wrapped: unchanged |
| `test:fast` | WR-0 416 files / 10,069 tests; WR-1 420 / 10,097; WR-2 421 / 10,115; after the ruling: 422 files / 10,133 tests, all passing (195 s); `npm run build` OK |
| `world.py` | every gated line OK; `wrap: OK (edges Water, least land margin 5 >= 4, no component joined ...)`; `seam_zones: REPORT (E-W 98-119 (22): wat_sea \| fir_sea; N-S 0-106 (107): wat_sea \| elf_sea; N-S 107-166 (60): ord_sea \| elf_sea; N-S 167-169 (3): ord_sea \| fir_sea; N-S 170-255 (86): wnd_sea \| fir_sea)`, plan 1.4 exactly |
| compile | 353 s, peak 14.4 GB; `seam: x 5.7 (interior max 6.7), y 7.3 (7.7)`; every chunk byte-identical to the flat compile (the wrap, the spots and the low atlas only) |
| determinism | `build_map.py --check-determinism overworld` OK; `mode7_atlas.py --check-determinism overworld` OK; re-running `world.py` leaves the source unchanged |
| selftests | `build_map.py --selftest` 149 checks; `selftest_wrap.py` 6 cases OK; `nw1_selftest` `cell_px(256) == (12, 8)` |
| `quest --strict` | OK: (a)-(h) all OK, (g) s* 0.852, (h) `WRAP OK`, (d) `S21 L29.2 [25,29]` and `seam: S14 x1 late 65, S22 x2 late 0, S24 x1 late 0, S26 x1 late 0, S21 x1 late 0, S27 x1 late 0` |
| `--from-reset` | OK: (c) from reset over 195 reset states (32 stage entries, 3 NW2 v4 saves, 160 mid-stage samples), 5,206,351 states searched |
| `--strict --mutate` | run once with F-WR: `mutations: OK (68 gate rows; 109 elements, each removal reported)`, 80 min. Not re-run after the revert: no mutation element is a zone (the seam zones had no flag, gate, NPC or patch), so the suite's elements are the same |
| `questCurve.test.ts` | bosses: garland L2.7, pirate L3.6, piscodemon L8.6, astos L10.6, vampire L14.4, lich L17.1, ashen_queen L22.0, evil_eye L24.6 [21,24] (tightest), dragon_zombie L26.4, drowned_sovereign L28.9, hollow_seraph L34.2, lich_2 L35.6; Chaos's door 40.7; wipes S31 0.33 (optional), required at most 0.05 (S14) |

**The curve gate (8.3).** Levels against the post-QW2 base:

| Stage | base | wrapped | (with F-WR, dropped) |
|---|---|---|---|
| S14 | 18.09 | 18.41 (+0.32) | 18.34 |
| S15 ashen_queen | 21.81 | 22.04 | 22.00 |
| S24 drowned_sovereign | 28.64 | 28.90 | 28.87 |
| S25 / S26 | 28.74 / 28.79 | 29.03 / 29.09 | 29.00 / 29.06 |
| **S21** | 28.88 | **29.23**, in [25, 29] by the ruling | 29.20 |
| S30 lich_2 | 35.31 | 35.69 (+0.38) | 35.67 |

- Condition 1 (bands) holds after the ruling; condition 2 (wipes, the Chaos door) holds; condition 3 (within +-0.5)
  holds: the largest delta is +0.38 (S27-S30). Stages S0-S13 are unchanged.
- **Why S21 rose.** S14's witness crosses the west seam at y 101 into 65 `wat_sea` cells (57 with F-WR's band). The
  larger share is not the ocean: the witnesses of S21, S22, S24, S25 and S27 fly across a seam and land elsewhere, and
  walk more `wat_isles` (S21 4.6 -> 8.8 fights, S24 2.4 -> 7.3). S21 is measured at its end, after S24-S26.
- **Why F-WR was dropped.** It moved S21 by only -0.03, and no factor re-fit within the method's caps fixed the band
  (`wat_sea` 3.0 / 4.0: S21 29.13 / 29.09; `wat_isles` at 2.6 / 3.0, over its CAP 2.0: 29.10 / 29.07; every sea at
  3.0: 29.05; S21's `grind` 1.0: 29.13).

**Browser checks** (`~/temp/ff-game/world_wrap/int/`, dev server on 127.0.0.1:5191, `mute=1`; run on the wrapped
compile, before the ruling; the ruling changes no runtime code):
- B1 `wr_ship_east`: x 253, 255, 0, 2 ...; zone `fir_sea` then `ert_sea`; centred camera, no placeholder.
- B2 `wr_air_corner` top-down: (0, 3) -> (255, 3) -> (255, 0) -> (254, 255).
- B3 `wr_ship_south`: y 254, 255, 0, 1; `elf_sea` then `wat_sea`.
- B4 Mode 7: every seam and the corner; the far side's land on the horizon past the north seam; recentres only at
  chunk lines; steady frame p95 10 ms, update p95 0.2-0.5 ms; no console error (one start-up chunk-placeholder warning
  once, not reproduced).
- B5 `wr_air_land`: west across x 0 and south to (249, 31), landed on foot. The t ~ 0.07 tilt-out frame lines up with
  the top-down frame by eye; pixel identity is 49 % (the near texture is 48 px per cell under the 96 px field, and
  the capture is a few frames early). The exact t = 0 match is the unit test (`mode7Tilt.test.ts`, the 4 seam points).
- B6 `wr_parked`: the parked ship 4 cells west across the seam, top-down sprite and Mode 7 billboard (`props` 1).
- B7 `&mode7=low`: atlas 2048, 8 px per cell, 16 chunks; repeats across the corner.
- B8: saved in flight at (247, 247) past the corner (slot 3), loaded: the same cell, flying.
- B9: `w_s18_start`, `act1_overworld`: unchanged, no warning.

**Deviations.**
- `flightWindow` at x 2 gives c0 14 for the 4x4 window (24 cells of margin) and 15 for the 3x3; the plan's "c0 15"
  is the 3x3 figure. The tests pin both.
- `NPCInteraction` takes `setMap(map)` for the counter across the seam (the plan's `wrapDelta` and `stepTo` need the
  map's size).
- The WR-2 scratch REPEAT probe was folded into the browser checks on the real wrapped compile.
- The scenario loader has no facing key: the `wr_*` scenarios start facing down. Flying starts over a dock spot load
  as written (no fallback needed).
- Tests adapted for the wrap: `worldSource` (52 spots), `travelMatrix` (the `; WRAP OK` suffix), `worldSpots`,
  `DebugScenarioField`, `scenarioSpawns` (spawns at sea on the ship or in flight); `questCurve` (the WR figures).

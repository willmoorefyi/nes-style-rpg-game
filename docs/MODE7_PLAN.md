# Mode 7 airship flight view (T-1), rev 3.1

Status: rev 3.1 (momus OKAY on rev 3; 3.1 folds in its last 5 small items: `loading` remembers its reason, row S superseded, M7-3 flips the setting test, `--maps` from `out_dir`, the mid-flight tilt pause). Rev 3: momus re-reviewed rev 2: its 12 items are fixed, and 3 small blocking items remained; rev 3 answers
them. Nothing is implemented. Facts in section 1 were checked at `8622decf`.
Source: `docs/TODO.md` T-1 (the want and the planner brief) and T-2 (the airship's views, on hold).

**Rev 3 changes (momus's re-review of rev 2):**

| # | Item | Resolution |
|---|---|---|
| 1 | Renderer and atlas readiness | `setMap` on the world map starts the lazy `FlightRenderer` import and the atlas load once an airship is raised, parked or ridden there. A new `loading` state flies top-down with `busy` false, then tilts in at the first idle frame once ready. The caps are read from `game.app.renderer` without importing the renderer, and a mock game has none, so `!webgl` gives `off`. The existing flying scene tests stay as they are, and `mode7Activation.test.ts` asserts that (4.3, 7, 8, 9) |
| 2 | No world compile inside vitest | the clean-diff check is a gate command of M7-1 and M7-INT. `mode7Atlas.test.ts` keeps the hash, size and edge checks. Determinism is `mode7_atlas.py --check-determinism`, which bakes into two temp dirs through `--out DIR` (0.1, 3.1, 9, 10) |
| 3 | WebGL1 and NPOT mips | without WebGL2 the profile is `low`, and its atlas uses linear minification with no mips, so a mip filter never samples black. With WebGL2, mips stay on (2.5, 7) |
| S | Suggestions | `ChunkStreamer.setCap` with a trim (the low cap is 16); the `bake_mode7` signature matches its call and takes `is_world`; 700 ms is 42 frames of `dt`; `FlightRenderer` creates and inserts the container, so `FlightView` imports no Pixi; the default and the user's live test move to M7-3, when the near detail exists; `?mode7=1` without WebGL2 gives `low` |

**Rev 2 changes (momus's review of rev 1):**

| # | Item | Resolution |
|---|---|---|
| U | User rulings | north-up with 4-way moves; the 16-bit look (straight horizon, scanline strips, no shader); Mode 7 by default, with Top-down in Config and `?mode7=0`; smooth filtering (mipmaps and fog). D-M2, D-M1, D-M8 and D-M10; Q1, Q2, Q3 and Q7 are closed (13) |
| 1 | `StreamedCollisionMap` holds airship steps too | the hold stays, and in flight it reads the flight window (D-M11, 3.3). The parity test covers it (9) |
| 2 | No vertex alpha in Pixi 8's default mesh shader | the seam fades through 8 one-row meshes, each with its own `alpha`; the fog is a gradient sprite. R5 is now a stated design (2.5, 12) |
| 3 | Tilt geometry | 1080 fixed row quads, with the rows that miss the ground collapsed to zero height; a root that is stable from θ = 90° to 18°; curvature eased through κ = 1/R from 0; `back` and the ship's screen spot eased; the start anchor read from the live `Camera` (480 px, or off centre when it clamps). The t = 0 match is exact by construction, so its test is well defined (2.4, 4.3, 9) |
| 4 | The shadow cell and `playerPosition` | equal only while the hero is idle; mid-step the shadow lies on the segment of the step (0.1, 6) |
| 5 | A tilt freezes a mid-step move and the streaming | a tilt starts only with the hero idle (always true at a take-off or landing confirm), and the hero stays idle through it. `FlightView.update` runs before the dialog and `fieldBusy` returns, and it drives the streaming itself while tilting. The place in `update()` is given (4.3, 8) |
| 6 | Memory | re-derived from the code: the overworld wants 30 chunks (70.8 MB) per frame but may hold up to 60 (141.6 MB), because eviction runs only at the cap. Flight caps the streamer at 36. When the atlas source is freed and how a restore reloads it (3.1, 3.4) |
| 7 | Patches in the near render texture | drawn over the chunks while their flags are set, and redrawn when a flag changes (3.2) |
| 8 | The low end's 2x2 window | the low end gets a 3x3 window at 32 px per cell and `D_SPLIT_LOW` 16 (3.2, 7) |
| 9 | Late chunks | `StreamedChunks.onChunkLoaded(cb)`, called from the streamer's load callback, redraws that chunk into the near render texture (3.2) |
| 10 | Toggle precedence; headless GPU | URL, then caps, then the setting. `?mode7=1` overrides `lowEnd` and the frame-time switch, but not `!webgl` or `failed`. Browser checks run headed Chromium on the GPU and report the GL renderer string (7, 9) |
| 11 | Scene-test injection | the Pixi part lives in `FlightRenderer.ts`, created lazily on the first flight. The parity test `vi.mock`s that module (0 scene lines), following `tests/scenes/AirshipFirstConfirm.test.ts`. `tiltParams` takes `tileSize` as a parameter (8, 9) |
| 12 | Atlas bake | `build_hooks.bake_mode7(...)`, called on 1 line of `build_map.write()` right after `HOOKS.bake_patches` (`:1187`). A full compile and `--region` both rebuild it; `--check-determinism` writes nothing, so a test of its own covers that. The image is 3072², with no added border, because all four world edges are verified sea (3.1, 9) |
| S | Suggestions (**superseded by rev 3** where they differ: the default now turns on in M7-3, and the live test follows M7-3) | the default turns on only with the atlas-missing fallback (now in M7-2); merge owners for the parallel tranches, and M7-2 depends on M7-1; the `?mode7=pilot` lazy debug scene; the pilot verifies render-texture mips, NPOT mips and anisotropy; the p95 window leaves out the take-off, recentre and upload frames; risk R13 (`mode7.png` merges); edge-sea test; M7-7's file and line budget; "git diff fully clean"; MB throughout |

**Naming.** Tranches are `M7-0` to `M7-8` and `M7-INT` (10). Decisions are D-M1 to D-M11 (0.2). Open questions for the
user are Q1-Q10 (13); Q1, Q2, Q3 and Q7 are closed. "WORLD n.m" means `docs/WORLD_PLAN.md` rev 3 section n.m.
1 MB = 10⁶ bytes.

## 0. Summary

While the party flies the airship on the world map, the field draws the world as a ground plane seen from behind and
above the ship. The land curves away to a straight horizon, with a sky band above it, like the airships of the later
16-bit Final Fantasy games. Take-off tilts the top-down view into this one. Landing tilts it back.

It is a view only. The grid, the movement rules, the field rules, the save position and the verifier do not change. The
view reads the hero's position and the game's `fieldMode`, and draws them. The only behavioural change is a 700 ms
input hold while a tilt plays (4.3), like a dialog's hold. That includes the one case where a tilt starts in mid-flight:
a `loading` → `tiltIn` change after a take-off, when the hero is idle between two steps. A held direction then pauses
for 700 ms before the next step. Turning Mode 7 off gives today's top-down flight.

The shape of the design:

- **Rendering:** scanline strips, one quad per screen row, with UVs from a pure TS projection (2.3).
- **Data:** a baked low-resolution world atlas for the distance, plus a near-detail render texture built from the
  streamed chunks (3).
- **Camera:** north up, with the classic 4-way grid moves.
- **Ship art:** the b_7 side view for every heading, as T-2's ruling says (11).
- **Pilot:** a static tilted render of one spot behind `?mode7=pilot` (M7-0).

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "On the world map, while fieldMode is airship and Mode 7 is enabled, the field shows the tilted ground, the sky band and the ship",
    "Confirm on a parked airship tilts the view in; confirm over a landable cell tilts it out and leaves the party on foot on that cell",
    "Confirm over a cell that cannot be landed on shows CANT_LAND, and the view stays in flight",
    "The Config row 'Airship view: Top-down' and ?mode7=0 both fly in today's top-down view",
    "A save made in flight loads straight into Mode 7 at the saved cell, with no tilt",
    "A lost WebGL context, a missing atlas or a slow device falls back to the top-down view with a console message, never a black field"
  ],
  "observable": [
    "Browser screenshots in ~/temp/ff-game/mode7/<tranche>/ at the pilot spot, the coast, the world edge, mid-tilt and after landing",
    "window.__mode7 reports state, frameP95, updateP95, the resident textures, the GL renderer string and shadowCell",
    "On every flight frame with the hero idle, shadowCell equals game.playerPosition; while a step plays, shadowCell lies on the step's origin or target cell"
  ],
  "pass_fail": [
    "npm run build and npm test pass",
    "npm run quest -- --strict passes, and git diff mainline -- src/progression src/systems/fieldRules*.ts assets/data/quest.yaml is empty",
    "The parity test: the same inputs with Mode 7 on and off give the same playerPosition, fieldMode, vehicles, flags, dialog lines and encounter count",
    "Flight frame time p95 <= 16.7 ms and the Mode 7 update p95 <= 2 ms on this machine (Apple M4 Pro), over 600 steady flight frames (9)",
    "The gate commands of M7-1 and M7-INT (10): the world compile leaves git diff fully clean, the atlas included, and mode7_atlas.py --check-determinism passes",
    "The existing scene tests that fly on overworld (AirshipFirstConfirm.test.ts, fieldVehicleArt.test.ts) pass unchanged, never import FlightRenderer and log no error",
    "Every new source file is under 250 lines; ExplorationScene.ts grows by at most 8 lines and stays under its ceiling of 590"
  ]
}
```

### 0.2 Decisions

| # | Decision | Why |
|---|---|---|
| D-M1 | Scanline strips, not a custom fragment shader (2.3). **User ruling 2026-11-19:** the 16-bit look, a straight horizon, no shader for now | One TS function draws the view and picks the landing cell, so the two cannot drift. Pixi's default mesh shader works on WebGL and WebGPU |
| D-M2 | **User ruling 2026-11-19:** north up with 4-way moves. Quarter turns (M7-7) are not scheduled | The grid, `PlayerController` and every rule stay as they are |
| D-M3 | The landing cell stays the hero's grid cell | No rule change. The inverse projection only draws the marker and proves where the shadow is (6) |
| D-M4 | Landmarks and towns stay flattened in the plane (default for Q4) | They are already baked into the chunk PNGs |
| D-M5 | The far atlas is baked offline at 16 px per cell (3.1) | Loading all 144 chunks (340 MB decoded) at take-off is not possible |
| D-M6 | The near detail comes from the streamed chunks, in a 4x4-chunk window (3.2) | It reuses the streamer and the textures it already loads |
| D-M7 | Mode 7 runs only on the world map (`overworld`) | The only streamed map, and the only one where the airship flies in the game |
| D-M8 | **User ruling 2026-11-19:** Mode 7 by default, with Top-down as a Config option and `?mode7=0`. The default turns on in M7-3, once the near detail exists; the atlas-missing fallback lands before that, in M7-2 (7) | The user asked for it |
| D-M9 | The ship uses b_7's side view for every heading (11) | T-2's ruling of 2026-11-19 |
| D-M10 | **User ruling 2026-11-19:** smooth filtering: mipmaps, anisotropy where it exists, and fog | It stops the far shimmer |
| D-M11 | The streamed step hold stays in flight and reads the flight window (3.3) | No movement change: a step still waits at most `MISS_HOLD_FRAMES` per miss, as today |

## 1. Facts (verified on `8622decf`)

- **The world.**
  - `assets/maps/ai/overworld.yaml`: 192x192 cells, `art.tile` 48, `art.chunk` 16.
  - Files: 144 `below_r_c.png` chunks (768x768 RGB, 34.2 MB of PNG in all, the largest 0.53 MB), no `above` layer, and
    two flag patches (`patch_canal.png`, `patch_north_bridge.png`).
  - On screen a cell is `TILE_SIZE` 96 px (the 2x art); in unit tests `TILE_SIZE` is 48.
  - One decoded chunk is 768² x 4 = 2.36 MB, so the whole world decoded would be 340 MB.
  - Every cell of row 0, row 191, column 0 and column 191 is Water (collision 2): all four edges are sea.
- **Streaming** (`src/rendering/StreamedChunks.ts` 178 lines, `chunkStreaming.ts`).
  - Maps of more than 64 chunks stream. Each frame wants the view's chunks, a 1-chunk ring and 1 chunk ahead per axis.
    For the overworld (no above layer) that is at most 6x5 = 30 textures, 70.8 MB.
  - `ChunkStreamer.want` evicts only when a new load needs room (`resident.size >= cap`, `STREAM_TEXTURE_CAP` 60). Chunks
    no longer wanted stay resident until then, so a long walk holds up to 60 chunks, 141.6 MB.
  - A missing chunk holds a step for `MISS_HOLD_FRAMES` 6, then shows a flat terrain-coloured placeholder. Textures load
    through `Assets.load` (worker `createImageBitmap`) with nearest scaling. The streamer's `onLoad` callback runs
    `checkReady` only.
- **The step hold.** `MapLoader.ts:33-41`: `StreamedCollisionMap.isWalkable` refuses a step while
  `baked.stepHeld(x, y)` is true, for every movement mode, the airship included. `stepHeld` checks the chunks of the
  top-down view centred on the target cell.
- **Renderer.**
  - `Game.init` calls `app.init` without a `preference`, so Pixi 8.17.1 uses WebGL. The view is 1920x1080 at
    resolution 1.
  - No source file uses a custom `GlProgram`, `Filter` or `Mesh` today.
  - Pixi 8's default mesh shader takes position and UV only: no per-vertex colour or alpha. A mesh has one texture and
    one `alpha` / `tint`.
  - `diagnostics.watchContext` banners a lost context. Pixi re-creates its GPU resources on restore, but a render
    texture's contents are lost.
- **Camera.**
  - `Camera.ts` moves `worldContainer` by integer px and clamps it to the map (`clampAxis`; the world does not wrap).
  - It centres the target in the band above `HUD_BOTTOM_BAND`. That band is 120 px: `HUD_PANEL_HEIGHT` 72
    (`FONT_SIZE` 24 + 2 x `INSET` 24) plus 2 x `SCREEN_MARGIN` 24.
  - So, away from the map's edges, the hero's cell centre is drawn at screen (960, 480). Near an edge the camera clamps,
    and the hero is drawn off centre.
- **Hero position.** `PlayerController.tileX` / `tileY` (`gridX`, `gridY`) change only when a step ends
  (`PlayerController.ts:100`). `x` / `y` are the interpolated sprite position. Movement reads `input.isPressed` (`:124`),
  which `InputManager.holdOff` does not affect.
- **Vehicles.**
  - `FieldVehicles.ts` (245 lines) owns the modes. `tryBoard` acts on confirm only while `!player.isMoving`, so take-off
    and landing always happen with the hero idle.
  - `confirm()` lands when `canLand` holds and no NPC stands on the cell; otherwise it emits `CANT_LAND`.
  - `FieldVehicleSprites.ts` (178 lines) draws the ridden airship at `FLYING_Z` with a 400 ms lift (`AIRSHIP_LIFT` 10
    native px, `TAKEOFF_MS`) and a shadow ellipse. The airship frame is 147x94 native, drawn at x2. It faces the hero's
    last horizontal direction.
- **Movement.** `AirshipMode`: speed x2 (100 ms per cell, 10 cells/s, and x2 again with the Walk speed boost);
  encounter rate 0. `fieldRules.fieldStep` ignores transitions and scripted encounters while flying.
- **Scene.**
  - `ExplorationScene.ts` is 545 lines, under a ceiling of 590 (`tests/data/fileCeilings.test.ts`); AGENTS.md still says
    504.
  - `update()` returns, in order: `paused` / `loading`, battle flash, end card, an active dialog, then `fieldBusy` (which
    returns before `player.update`, `camera.update` and `tilemap.render`).
- **Settings.** `src/core/Settings.ts` (`ff.settings`, `messageSpeed` only) and `ConfigScene.ts` (97 lines).
- **Tests.** `tests/scenes/AirshipFirstConfirm.test.ts` builds an `ExplorationScene` over `createMockGame` on a 10x10
  `overworld` in the airship and drives `update(1)` with a mocked `input.isJustPressed`.
- **The atlas bake site.**
  - `build_map.write()` (from `:1158`) unlinks every `*.png` in the map's folder on a full compile, writes the chunks,
    then calls `HOOKS.bake_patches(...)` at `:1187`.
  - A `--region` compile calls `write(..., only=..., base=...)` (`:1248`).
  - `--check-determinism` compares hashes printed by subprocesses and writes no file.
  - `build_map.py` is 1566 lines (over 250 and not split); `build_hooks.py` is 172.
- **Scenario.** `w_s18_start` starts in flight over the Citadel meadow (`ord_meadow`), with the ship docked at Crescent.
- **Landmarks.** The world source has 83 `deco` objects. All of them are baked into the below chunks; the compiled map
  keeps no per-object list.

## 2. Rendering approach

### 2.1 Candidates

- **A. A fragment shader on a full-screen quad.**
  - A Pixi 8 `Mesh` with a custom `GlProgram` that ray-casts per pixel, with fog and an arced horizon possible.
  - It needs WGSL as well if the app ever moves to WebGPU.
  - Not taken: user ruling D-M1.
- **B. Per-scanline affine strips (the SNES method).**
  - One `Mesh` of 1080 fixed row quads. TS writes the 4 UVs of each row every frame: the ground line seen on that row.
  - Along a row the ground is exactly affine for a camera with no roll, so the image is exact.
  - Curvature is a function of the row only: the straight-horizon 16-bit look.
- **C. A grid mesh with projected UVs.** It allows an arced horizon, but distorts inside each cell. Rejected.

### 2.2 Comparison

| | A shader | B strips |
|---|---|---|
| Exact image | yes, per pixel | yes, per row |
| Curvature | any, an arced horizon too | per row, a straight horizon (the ruling) |
| Picking the landing cell | the TS inverse must match the GLSL by hand | the same TS function draws and picks |
| Unit tests | the maths only | the whole UV table is plain TS |
| Renderer | WebGL now, WGSL later | the default shader, WebGL and WebGPU |
| Near and far textures | 2 samplers, blended per pixel | 2 meshes split at a row; 8 one-row meshes fade the seam |
| Fog | in the shader | a gradient sprite over the horizon rows |
| CPU per frame | ~0 | 1080 rows of a sqrt and some multiplies, under 0.1 ms; a 34.6 kB UV upload |

### 2.3 Recommendation: B, scanline strips (D-M1)

B gives the ruled look with no custom GPU code. The projection lives in one pure module. That module fills the UV
table, places the billboards and the shadow, and finds the landing marker's cell, so the tests of section 9 cover all of
the drawing.

### 2.4 The projection (pure; `mode7Math.ts`)

**Parameters** (`ViewParams`):

- altitude `h` cells;
- pitch `θ` below horizontal, from 90° (looking straight down) to the flight value;
- focal length `f` px;
- the screen point of the optical axis (`cx`, `cy`);
- curvature `κ = 1/R` per cell, where 0 is flat;
- `back` cells: how far the camera's ground point `C` lies south of the ship's position `P` (the hero's interpolated
  `x / TILE_SIZE`, `y / TILE_SIZE`).

North up: forward is −y (north) and right is +x.

**A ray per row.** For row `y`, let `v = (y + 0.5 − cy) / f`. The ray direction per unit of camera depth has:

- a forward part `a = cos θ − v sin θ`;
- a downward part `b = sin θ + v cos θ`.

It hits the ground `z = −κ d² / 2` (with `d` the forward distance) at camera depth `s`, the near root of
`(κ a² / 2) s² − b s + h = 0`, written in the stable form:

```
s = 2h / (b + sqrt(b² − 2 h κ a²))          d = a s          (cells per px on that row = s / f)
```

- **The root is stable for every pitch.**
  - At θ = 90° it gives `a = −v`, `b = 1` and `s = h / (1 + sqrt(1 − 2hκv²))`. Rows below `cy` map south of the camera,
    so `φ > 90°` needs no special case. Rev 1's `tan φ` form broke here.
  - At `κ = 0` it gives `s = h / b`, so no infinite radius is ever needed.
- **A row misses the ground** when `b ≤ 0` or `b² < 2 h κ a²`. Such a row is sky: its quad is collapsed to zero height
  (both edges at `y`), so it draws nothing, and the sky sprite behind shows through.
- **Row UVs.** The row centre is `C + d · fwd`, and its two ends lie `(cx / f) s` and `((1920 − cx) / f) s` cells to
  either side. The quad's top and bottom edges use `y` and `y + 1`, so the GPU's mip selection sees the true vertical
  gradient. Cells convert to atlas UVs per mesh (3.1, 3.2).
- **Inverse.** `screenToCell(x, y)` uses the same `s`, `d`. Its closed-form inverse `cellToScreen(p)` serves the
  billboards and the shadow.

**Flight values** (computed in a scratch script; the M7-0 presets vary them): `f` 1200, `θ` 18°, `h` 6, `κ` 1/600,
`(cx, cy)` (960, 600), `back` 11.3.

| Screen row | Cells ahead of the camera | px per cell | Half-width (cells) |
|---|---|---|---|
| 390 (the horizon; 36 % of the screen above it is sky) | 78.5 | 15.4 | 62.5 |
| 530 (the near / far split, `D_SPLIT` 25) | 24.9 | 46.7 | 20.6 |
| 668 (`D_SPLIT_LOW` 16) | 16.0 | 70 | 13.7 |
| 820 (the ship's shadow, at `P`) | 11.3 | 95.0 | 10.1 |
| 1080 (the bottom) | 7.3 | 136.9 | 7.0 |

The ship's cell shows at 95 px per cell (96 top-down), so the ship keeps its size.

### 2.5 Filtering, fog, the seam and the edge (D-M10)

- **Filtering.** Magnification is nearest (pixel art). On the far atlas, minification is linear with linear mipmaps,
  plus `maxAnisotropy` 4 where `EXT_texture_filter_anisotropic` exists (Pixi `TextureStyle`). Mips need WebGL2; without it, linear only (3.1). The near render texture
  is nearest, without mips: it is only ever magnified or near 1:1.
- **Fog** is one sprite: a 1x256 gradient texture stretched over the screen width, from the horizon row down 120 rows,
  in the sky's haze colour, alpha 0.6 to 0. It moves with the horizon row during a tilt.
- **The seam.** The far mesh draws every ground row farther than `D_SPLIT − 1` cells. The near mesh draws the rows
  nearer than `D_SPLIT − 1`. Between them are 8 one-row `Mesh`es with the near texture, at `alpha` 1/9 to 8/9, drawn
  over the far mesh (8 extra draw calls). No per-vertex alpha is needed.
- **Off the world.** Both atlases use clamp-to-edge. All four world edges are sea (1), so the ground beyond the map
  repeats sea texels, and the camera never clamps in flight. M7-0 screenshots `m7_edge` to judge the repeat.

## 3. Data: the world's textures

### 3.1 Far atlas (D-M5)

- **The bake.** `build_hooks.py` gains
  `bake_mode7(map_id: str, src: dict, out_dir: Path, is_world: Callable[[dict], bool]) -> Path | None`. It calls the new
  `assets-src/tools/mode7_atlas.py` (under 250 lines; numpy and Pillow, no randomness).
  - It returns `None` unless `is_world(src)`. `build_map.py` passes its own `is_world` in, so `build_hooks.py` never
    imports `build_map` (no circular import).
  - **CLI:** `python3 -I assets-src/tools/mode7_atlas.py overworld [--maps DIR] [--out DIR]`. It reads the chunks from
    `--maps` (default `assets/maps/ai`) and writes to `--out` (default the map's own folder).
  - **`--check-determinism`** bakes twice, under `PYTHONHASHSEED` 0 and 1, into two temp dirs through `--out`. It
    compares the bytes, and exits non-zero on a difference.
  - It stitches the 144 below chunks and box-downsamples them 3x to 16 px per cell. That gives
    `assets/maps/ai/overworld/mode7.png`, 3072x3072 RGB: 192 cells x 16, with no added border, because the edges are
    already sea (2.5).
  - It also writes a low-end `mode7_low.png` at 8 px per cell (1536x1536), and `mode7.json`:
    `{version: 1, cellPx: 16, size: 3072, lowCellPx: 8, lowSize: 1536, inputs: <sha256 over the chunk files in order>}`.
- **The call site.** One line in `build_map.write()`, right after `HOOKS.bake_patches(...)` at `:1187`:
  `HOOKS.bake_mode7(c.id, src, out_dir, is_world)`. The hook passes that `out_dir` to `mode7_atlas.py` as both
  `--maps` and the parent of `--out` (`out_dir / c.id`), so a compile into a scratch `out_dir` bakes from its own
  chunks.
  - It must run there, because a full compile unlinks every `*.png` in the folder, `mode7.png` included.
  - A `--region` compile goes through the same `write()` and re-bakes from all 144 chunk files on disk.
  - `build_map.py --check-determinism` writes no file, so it does not bake. `mode7_atlas.py --check-determinism` is the
    atlas's own gate command (10).
- **The patches** stay out of the bake. At runtime `WorldAtlas` draws the loaded atlas into a mipmapped render texture,
  then draws each patch overlay over it while its flag is set (`CANAL_OPEN`; the north bridge's flag), scaled by 16/48.
  It then calls `source.updateMipmaps()`. It recomposes when either flag changes, by a per-frame signature like
  `refreshNpcPresence`'s.
- **The atlas source texture** (37.7 MB) is freed with `Assets.unload` right after the compose. A context restore
  `Assets.load`s it again (the browser's HTTP cache), recomposes, and frees it again.
- **When it loads** (with the renderer, 4.3): `FlightView.setMap` on `overworld`, when the profile is not `off` and
  `AIRSHIP_RAISED` is set or an airship is parked or ridden there. That happens behind the map's fade-in, not at
  take-off. The decode is off-thread; the upload, the compose and the mip build take about 10-20 ms once.
- **Mips need WebGL2.** `mode7.png` (3072²) and `mode7_low.png` (1536²) are not powers of two, and under WebGL1 a
  mipmap filter on an NPOT texture samples black.
  - Without WebGL2 the profile is always `low` (7), and `WorldAtlas` gives its render texture linear minification with
    no mips (`autoGenerateMipmaps: false`, no `mipmapFilter`).
  - With WebGL2, mips are on in both profiles.
  - No padding to 2048² is needed.

### 3.2 Near detail (D-M6)

- **The render texture.** 64x64 cells (4x4 chunks) at 48 px per cell, 3072² (37.7 MB), nearest, no mips.
  - It is drawn in this order: the far atlas's matching square (scaled up, the underlay); every loaded chunk of the
    window; the patch overlays over their cells while their flags are set.
  - A patch flag change redraws the window.
- **Recentring.** The window moves in whole-chunk steps so that the ship stays in its middle 16 cells. That leaves 24 or
  more cells on each side; the near rows need 20.6 to each side, and from 4 cells behind the ship to 13.6 ahead.
  - A recentre redraws 1 underlay plus at most 16 chunks plus the patches: under 1 ms of GPU time, about every 1.6 s at
    10 cells/s.
- **Late chunks.** `StreamedChunks.onChunkLoaded(cb: (i) => void)` is called from the `onLoad` callback it already
  passes to `ChunkStreamer`. A chunk of the window that arrives after the recentre is drawn into its 16x16-cell square
  then, with the patches over it. Until then that square shows the atlas underlay, never a hole or a flat placeholder.
- **The split.** The near mesh draws the rows nearer than `D_SPLIT` 25 cells, rows 530-1080 at the flight values. That
  is 80 % of the ground rows; there the screen shows 47 to 137 px per cell. Beyond, the 16 px atlas is magnified at
  most 3x, and is about 1:1 at the horizon.
- **The low end** (7): a 3x3 window (48 cells) at 32 px per cell, 1536² (9.4 MB). The ship's margins are then at least
  16 cells, so `D_SPLIT_LOW` is 16: half-width 13.7, at most 4.7 cells ahead of the ship. The far mesh uses
  `mode7_low.png`.

### 3.3 Streaming and the step hold (D-M11)

- **The window override.** `StreamedChunks.setWindow(rect | null, cap)` (about +15 lines) replaces the view rect and
  the cap while flying.
  - `update` then wants the override window plus 1 chunk ahead in the direction of travel: at most 5x5 = 25 chunks
    (low: 4x4 = 16).
  - The cap: `ChunkStreamer.cap` is `readonly` today. It becomes a private field with `setCap(n: number)` (about +10
    lines in `chunkStreaming.ts`). `setCap` evicts the least recently wanted textures until at most `n` are resident;
    each eviction goes through the existing `onEvict` and `unload`.
  - The flight cap is 36 textures (85.0 MB) for `full` and 16 (37.8 MB) for `low`.
  - `setWindow(null, STREAM_TEXTURE_CAP)` restores today's 60 when the flight ends.
- **Who calls `render`.** The scene's own `tilemap.render()` at the end of `update()` keeps driving the streamer in
  flight. During a tilt, when `fieldBusy` returns early, `FlightView.update` calls `tilemap.render()` instead. Exactly
  one call per frame, so `MISS_HOLD_FRAMES` keeps its meaning.
- **The step hold stays.** In flight, `stepHeld(x, y)` checks the window that recentring would choose for the target
  cell, instead of the top-down view's chunks.
  - A step still waits at most `MISS_HOLD_FRAMES` per miss, as today, so there is no movement change.
  - The atlas underlay means nothing is ever shown missing.
- **The rate.** At 10 cells/s the ship crosses a chunk about every 1.6 s and wants 4 or 5 new chunks (about 0.24 MB of
  PNG each, decoded off-thread, about 1 ms each to upload). At the boosted 20 cells/s, a crossing about every 0.8 s.

### 3.4 Memory and frame budget

| GPU memory | Today, top-down | In flight with Mode 7 |
|---|---|---|
| Chunk textures wanted per frame | 30 = 70.8 MB | 25 = 59.0 MB |
| Chunk textures resident at most (eviction only at the cap) | 60 = 141.6 MB | 36 = 85.0 MB (the flight cap) |
| Far atlas render texture, with mips | — | 50.3 MB (low end 12.6 MB) |
| Near render texture | — | 37.7 MB (low end 9.4 MB) |
| Atlas source while composing (freed after) | — | +37.7 MB for about 1 frame (low end +9.4 MB) |
| Sky, fog, clouds, billboards, meshes | — | under 2 MB |
| **Total at most** | **141.6 MB** | **175.0 MB** (212.7 MB while composing); low end: 16 chunks at most, 37.8 MB, so 61.8 MB in all |

If the atlas source stayed resident, flight would hold 212.7 MB. It is freed (3.1). Today's top-down figures are
unchanged.

| Work per frame | Estimate (M4 Pro), measured in M7-0 and M7-3 |
|---|---|
| Row table and UV upload (1080 rows) | under 0.1 ms CPU |
| Billboards and shadow (at most 40 sprites) | under 0.1 ms CPU |
| Far mesh, near mesh, 8 seam rows, sky, fog: a 1920x1080 fill | under 0.5 ms GPU |
| A recentre | under 1 ms GPU, about every 1.6 s |
| A chunk upload | about 1 ms, 4 or 5 per crossing |
| Budget | 16.7 ms at 60 Hz (8.3 ms if the ticker runs at 120 Hz); the Mode 7 update p95 must be <= 2 ms |

## 4. Camera and controls

### 4.1 North up (D-M2, user ruling)

The camera always looks north. Up flies away from it and down toward it; left and right slide the view. FF1's controls
and the grid are unchanged. Quarter turns (M7-7) stay written down as an option, not scheduled.

### 4.2 Speed and altitude

- **Speed** is 10 cells/s, x2 with the Walk speed boost (default for Q6: unchanged). `P` is the hero's interpolated
  position, so the flight is smooth.
- **Altitude** is constant (`h` 6). The existing ridden bob (2 native px over 2.6 s) moves only the ship sprite.
- **The ship** is screen-fixed in flight, with its hull's foot at (960, 750), 70 px above its shadow row of 820. It
  sits above the 120 px HUD band.

### 4.3 Take-off and landing

**Readiness.**

- `FlightView.setMap(map)` on `overworld` reads the profile (7). If the profile is not `off` and `AIRSHIP_RAISED` is
  set, or an airship is parked or ridden on the map, it starts `import('./FlightRenderer.js')` and, once that resolves,
  the atlas load (3.1). It does so behind the map's fade-in.
- `ready` is true once the renderer has been created and the atlas has been composed.
- Everything has normally loaded long before a take-off. The `loading` state covers a take-off, or a load in flight,
  that comes first.

**The states** (`mode7Tilt.ts`, pure):

| State | Drawn | `busy` | Leaves to |
|---|---|---|---|
| `off` | top-down | false | `loading` when flight starts while not `ready`, remembering `reason`: `takeoff` (a confirm on a parked airship) or `restore` (a load or retry in flight); `tiltIn` at a take-off while `ready`; `flying` after a load or retry while `ready` |
| `loading` | top-down: today's flight, the hero moves freely | false | once `ready`: with `reason: takeoff`, `tiltIn` on the first idle frame; with `reason: restore`, `flying` at once, with no tilt (normally still under the 400 ms fade-in), even mid-step, because nothing is held. `off` on a landing, a map change or `failed` |
| `tiltIn` | Mode 7, `t` 0 → 1 | true | `flying` |
| `flying` | Mode 7 | false | `tiltOut` on a landing; `off` on a map change |
| `tiltOut` | Mode 7, `t` 1 → 0 | true | `off` |

`dt` is in 60 Hz frames (`ticker.deltaTime`), so a tilt advances `t` by `dt / 42`: 700 ms is 42 frames.

**The tilt.** `tiltParams(t, start, tileSize)` is a pure function of `t` in [0, 1] (eased in-out). Each parameter goes
from its value at `t = 0` to its flight value at `t = 1`:

| Parameter | At t = 0 | At t = 1 |
|---|---|---|
| `θ` | 90° | 18° |
| `κ` | 0 | 1/600 |
| `f` | 1200 | 1200 |
| `h` | `f / tileSize` (12.5 at 96; 25 in tests at 48) | 6 |
| `back` | 0 | 11.3 |
| `(cx, cy)` | `start.anchor`, the hero's screen point from the live `Camera.worldToScreen(player.x, player.y)`: (960, 480) away from the edges, off centre where `clampAxis` clamps | (960, 600) |
| The ship sprite's foot | `start.ship`, where `FieldVehicleSprites` drew it (the anchor plus `TILE_SIZE / 2`, minus the lift) | (960, 750) |

**The t = 0 match is exact.** At θ = 90° with κ = 0, a pinhole looking straight down at a plane is a uniform scale.
`f / h = tileSize` px per cell, centred on the hero's screen point, is exactly the top-down camera's mapping. The test
(9) asserts that every cell corner in view projects within 0.5 px (the camera's integer rounding) of
`Camera.worldToScreen`, at the map's centre and at all 4 clamped edges. The switch from the top-down view is therefore
invisible, and the view then tilts.

**Take-off.**

- Confirm on a parked airship happens only with the hero idle (`tryBoard`). `FieldVehicles` changes the mode at once.
- On the same frame, `FlightView` sees `fieldMode` become `airship` on the world map. It starts a 700 ms (42-frame)
  tilt-in if `ready` (default for Q10), or else goes to `loading`.
- The 400 ms lift now plays inside the tilt, on the Mode 7 ship sprite (`airshipLift(sinceBoard)`).

**Landing.**

- Confirm over a landable cell (hero idle) changes the mode at once, as today.
- `FlightView` sees `walking` and plays a 700 ms tilt-out (`t` from 1 to 0, with `start` taken again from the
  `Camera`), the ship still drawn.
- At `t = 0` it hides itself and shows the world container, which already holds the hero on foot and the parked
  airship.

**Busy and input.**

- While a tilt plays, `FlightView.busy` is true and `fieldBusy` includes it. Since a tilt starts only with the hero idle
  and `player.update` is not called while busy, the hero stays idle: no step is ever frozen mid-move.
- This 700 ms hold is the one behavioural change (0).
- At the end, `game.input.holdOff(SCENE_ENTRY_HOLDOFF_FRAMES)` stops a held confirm from landing or boarding again at
  once. A held direction (`isPressed`) moves on the next frame, as it does after a dialog.

**Other ways in and out.**

- A load or retry in flight starts in `flying` behind the fade-in, with no tilt. If not yet `ready`, it waits in `loading` (`reason: restore`) and then goes straight to `flying`, never through `tiltIn`.
- A landing during `loading` goes straight to `off`: the flight was top-down, so there is nothing to tilt out.
- A map change, a warp or `fieldMode` leaving `airship` by any other path ends Mode 7 at once, with no tilt.
- A dialog during a tilt (none is expected) does not stop it: `FlightView.update` runs before the dialog return (8).

### 4.4 Input

There is no new key. Cancel opens the field menu as today: the menu scene is not transparent, so it hides the view.

## 5. What shows in the view

| Element | Treatment | Tranche |
|---|---|---|
| Ground, towns, landmarks | Flattened in the plane (D-M4) | M7-0 / M7-3 |
| Sky | A code-drawn vertical gradient (colours from `snes_palette.py`) behind the meshes, with the haze at the horizon | M7-0 |
| Fog | The gradient sprite of 2.5 | M7-3 |
| Clouds | 3 to 5 code-drawn cloud sprites in the sky band, drifting slowly; no ground cloud shadows (default for Q8) | M7-5 |
| The airship | A screen-fixed `VehicleView` hull: b_7, the same bob, facing the last horizontal direction (D-M9) | M7-2 |
| The airship's shadow | An ellipse at `cellToScreen(P)`, scaled by that row's px per cell, alpha 0.3 | M7-2 |
| The landing marker | A thin white outline of the hero's cell while idle and `canLand` holds; nothing otherwise (default for Q9) | M7-4 |
| Parked ship, world-map NPCs | Upright billboards at `cellToScreen`, scaled by their row, depth-sorted, culled beyond 40 cells | M7-5 |
| Volcano smoke (`FieldAmbient`) | Hidden in flight; a billboard in M7-8 | M7-8 |
| Tall landmarks | Optional billboards (Q4) | M7-8 |
| HUD, dialogs | Unchanged, over the view | — |

## 6. Rules (unchanged)

- **The landing cell** is `player.gridX, player.gridY`, as today (D-M3).
  - While the hero is idle, `screenToCell` of the shadow's centre equals that cell.
  - While a step plays, it is the step's origin or target cell (`gridX` changes only when the step ends).
  - A dev build logs `console.error` once on a mismatch.
- **No rule moves.** `canLand`, the NPC check, `CANT_LAND`, encounters (rate 0), transitions ignored in flight,
  `recordPlayer`, the saved `fieldMode` and the step hold's limit all stay as they are. `FieldVehicles.ts`,
  `fieldRules*.ts` and `src/progression/` are not edited.
- **The verifier is unaffected.** It models cells and flags, never the view. The gate is in 0.1.
- **When Mode 7 is active:** the map is `overworld`, `fieldMode` is `airship`, and `mode7Enabled()` is true.

## 7. Fallback

- **The setting.** `Settings.ts` gains `airshipView: 'mode7' | 'topdown'` (default `mode7`; an invalid stored value warns
  and takes the default). `ConfigScene` gains the row "Airship view  Mode 7 / Top-down".
- **One pure gate:** `mode7Enabled(search, settings, caps)` in `mode7Toggle.ts`.
  - `caps` is `{webgl, webgl2, maxTexture, anisotropy, failed, slow}`.
  - The answer is a profile: `off`, `full` or `low`.
- **Reading the caps** needs no renderer import. `capsOf(game.app.renderer)` in `mode7Toggle.ts` duck-types
  `renderer?.gl`:
  - `webgl` means a `gl` object exists;
  - `webgl2` means `gl.getParameter(gl.VERSION)` starts with `WebGL 2`;
  - `maxTexture` is `gl.getParameter(gl.MAX_TEXTURE_SIZE)`;
  - `anisotropy` means `gl.getExtension('EXT_texture_filter_anisotropic')` returned an extension.

  `createMockGame`'s `app` is `{ stage }`, with no renderer, so in every scene test that does not stub one the caps give
  `!webgl`, and the profile is `off`. `off` because of `!webgl` logs nothing: it is the normal state in Node, and the
  game cannot run without WebGL anyway.

  **Precedence:**

  1. **URL.**
     - `?mode7=0` gives `off`, always.
     - `?mode7=1` gives `full`, or `low` if `maxTexture < 4096` or `!webgl2`. It overrides the setting and the
       frame-time switch (`slow`), for tests and measurements. It never overrides `!webgl`, `failed` or
       `maxTexture < 2048`, because the view cannot draw then.
     - `?mode7=pilot` (dev only) opens the pilot scene (10).
  2. **Caps.**
     - `!webgl`, `failed` or `maxTexture < 2048` gives `off`.
     - `slow` (the frame-time switch fired this session) gives `off`.
     - `maxTexture < 4096` or `!webgl2` gives `low`. Without WebGL2, `low`'s atlas has no mips (3.1).
  3. **The setting.** `topdown` gives `off`; otherwise `full`.
- **The frame-time switch.** A steady-flight frame-time p95 above 20 ms over 120 frames sets `slow` for the session
  with `console.warn`. Re-choosing Mode 7 in Config clears it. The frames excluded are those of section 9's p95 window.
  M7-6 reads "over 120 frames" as *staying* above: the p95 of the last 120 steady frames must be above 20 ms on 120
  steady frames in a row, so a hitch of 10 slow frames or fewer never fires it (a rolling p95 alone fired 6 slow
  frames, about 0.25 s, into a slowdown). Under `?mode7=1` (or `?mode7=low`) it still sets `slow` and warns, but the
  view stays on.
- **Context loss.** On `webglcontextlost` the view marks both render textures dirty and shows the world container (the
  diagnostics banner stays until the restore). On `webglcontextrestored`, `WorldAtlas` reloads the source and
  recomposes (3.1), and `NearDetail` redraws its window. If that throws, the view logs `console.error`, sets `failed`,
  and stays top-down.
- **Missing atlas** (this is in M7-2, before the default turns on in M7-3). A `mode7.json` or `mode7.png` that is missing or
  fails to load gives `failed` with `console.error` once, and the flight is top-down. A `mode7.json` whose `inputs` hash
  does not match the chunks is a test failure (9), not a runtime check.
- **Every catch logs** (AGENTS.md).

## 8. Module and file-size plan

The new folder `src/scenes/exploration/mode7/` holds the modules below, each under 250 lines. A new
`tests/data/mode7Ceilings.test.ts` finds every file of the folder as it lands.

| File | Role | Pixi |
|---|---|---|
| `mode7Math.ts` | `ViewParams`, `rowTable`, `screenToCell`, `cellToScreen`, the split rows | no |
| `mode7Tilt.ts` | the states (`off`, `loading`, `tiltIn`, `flying`, `tiltOut`), easing, `tiltParams(t, start, tileSize)`, `busy` | no |
| `mode7Toggle.ts` | `mode7Enabled`, `capsOf`, the URL parse, the frame-time rule and its excluded frames | no |
| `FlightView.ts` | the orchestrator: readiness, activation from the map and `fieldMode`, the state machine, `busy`, `window.__mode7`. It imports only types from `pixi.js`. It loads `FlightRenderer` lazily with `import('./FlightRenderer.js')` from `setMap` (4.3), and passes it the `parent` and `at` it was given | no |
| `FlightRenderer.ts` | creates its own `Container`, inserts it with `parent.addChildAt(container, at)`, and owns the Pixi parts below and the context-loss listeners; `destroy` removes it all | yes |
| `GroundStrips.ts` | the far and near row meshes, the 8 seam meshes, the UV upload | yes |
| `WorldAtlas.ts` | atlas load, patch compose, mips, texture style, free and reload | yes |
| `NearDetail.ts` | the near render texture, the window, recentring, late chunks, patches | yes |
| `FlightSky.ts` | sky gradient, fog sprite, clouds | yes |
| `FlightBillboards.ts` | ship, shadow, marker, parked vehicles and NPCs | yes |
| `Mode7PilotScene.ts` | M7-0's static render (dev only) | yes |

**`ExplorationScene.ts`, +6 lines** (545 to 551, ceiling 590; item 6 edits an existing line):

1. `import { FlightView } from './exploration/mode7/FlightView.js';`
2. a field: `private flight: FlightView;`
3. in the constructor, after `this.container.addChild(this.worldContainer);`:
   `this.flight = new FlightView({ game, world: this.worldContainer, parent: this.container, at: 1, player: () => this.player, tilemap: () => this.tilemap, camera: this.camera });`
   `FlightView` only stores `parent` and `at`. `FlightRenderer`, once loaded, inserts its container at index 1, between
   the world and the UI.
4. in `loadMap`, after `this.vehicles.setMap(mapData);`: `this.flight.setMap(mapData);`
5. in `update`, after `this.fieldHUD.update(this.game.party);` and before `if (this.dialogManager.isActive)`:
   `this.flight.update(dt);`. It runs under dialogs (`CANT_LAND`) and during its own tilt. It reads the hero's position
   from the previous frame's `player.update`; that one-frame lag is invisible, because the ship is screen-fixed and the
   ground and the billboards all use the same `P`.
6. in `fieldBusy`: `|| this.flight.busy` (an edit of the existing line: +0).
7. in `exit`: `this.flight.clear();`

Edits outside the folder:

- `StreamedChunks.ts` (178 lines, about +25): `setWindow`, `onChunkLoaded`, `textureOf(i)`, and the flight case of
  `stepHeld`.
- `chunkStreaming.ts` (154 lines, about +10): `ChunkStreamer.cap` stops being `readonly`, and gains `setCap(n)` with
  its trim (3.3).
- `BakedMapRenderer.ts` (155 lines, about +8): pass-throughs.
- `Settings.ts` and `ConfigScene.ts`: about +25 lines.
- `main.ts`: +3 lines (the pilot scene, registered lazily in dev only).
- `build_hooks.py`: +6 lines.
- `build_map.py`: +1 line.
- `debug-scenarios.yaml`: an `# === M7 ===` anchor.
- AGENTS.md: a "Mode 7 flight view" note, and the corrected `ExplorationScene.ts` count.

## 9. Tests

**Unit, no PixiJS** (`tests/scenes/mode7/`):

- `mode7Math.test.ts`:
  - `cellToScreen(screenToCell(p))` round-trips within 0.01 px over a 50x50 grid of points below the horizon, at
    κ 0, 1/600 and 1/300 and θ 90°, 45° and 18°;
  - at θ = 90° every row hits the ground, and the rows below `cy` map south;
  - `d` decreases strictly from the horizon to the bottom;
  - a missed row is collapsed (zero height);
  - κ = 0 equals `h / b`;
  - the split rows sit at `D_SPLIT` and `D_SPLIT_LOW`;
  - the flight values give 95 ± 2 px per cell at row 820.
- `mode7Tilt.test.ts`:
  - **the t = 0 match:** with `tileSize` 48 and 96, `tiltParams(0, start, tileSize)` projects every cell corner in view
    within 0.5 px of a real `Camera.worldToScreen`, at the map's centre and at its 4 clamped edges;
  - `tiltParams(1)` gives the flight values;
  - the states run in order; `busy` is true only in `tiltIn` and `tiltOut`; a tilt is exactly 42 frames of `dt` 1 (and
    21 frames of `dt` 2);
  - a take-off while not `ready` goes to `loading` with `reason: takeoff` (`busy` false). Once `ready`, it goes to
    `tiltIn` on the first idle frame, never while a step plays;
  - a load or retry in flight while not `ready` goes to `loading` with `reason: restore`. Once `ready`, it goes straight
    to `flying` with no `tiltIn`, at once (under the fade-in when it is still running), even mid-step;
  - a load or retry while `ready` goes straight to `flying`;
  - each case asserts the exact sequence of states;
  - a landing in `loading` goes to `off`, and a map change goes to `off` with no tilt.
- `mode7Toggle.test.ts`:
  - the whole precedence table of 7 (each URL value x each cap x each setting), including `?mode7=1` without WebGL2
    giving `low`;
  - `capsOf(undefined)` and `capsOf({})` giving `!webgl`;
  - `capsOf` over a stub `gl` (VERSION, MAX_TEXTURE_SIZE, the extension);
  - the frame-time rule (120 frames, p95 > 20 ms), with the excluded frames left out.
- `Settings.test.ts`: the `airshipView` default (`topdown` until M7-3, which changes both the default and this test's
  expected value to `mode7`), round trip and invalid value.
- `rowTable.test.ts`: the UV tables of 4 fixed views match a stored snapshot.
- `streamWindow.test.ts`:
  - over a stub `ChunkSource`, `setWindow` wants at most 25 chunks (16 for `low`);
  - `setCap(36)` with 60 resident trims to 36, least recently wanted first, calling `onEvict` and `unload` for each;
    `setCap(16)` trims to 16; `setCap(60)` evicts nothing;
  - `onChunkLoaded` fires once per chunk;
  - the flight `stepHeld` holds while a window chunk is missing and releases after `MISS_HOLD_FRAMES`.

**Scene tests** follow the pattern of `tests/scenes/AirshipFirstConfirm.test.ts`: `createMockGame` on an `overworld`
map, `scene.enter()`, then `scene.update(1)` with mocked input.

- **The stub, for the Mode 7 tests only.**
  - `vi.mock('../../src/scenes/exploration/mode7/FlightRenderer.js')` replaces the Pixi part with a stub that records
    its calls and whose atlas load resolves (or, for the `loading` cases, waits on a deferred promise).
  - The mock game gets `app.renderer = { gl: stubGl }`, where `stubGl` answers VERSION `WebGL 2.0` and
    MAX_TEXTURE_SIZE 16384, so `capsOf` gives `full`.
  - Mode 7 is forced with `vi.stubGlobal('location', { search: '?mode7=1' })`.
  - After `scene.enter()`, the test awaits `vi.dynamicImportSettled()` and a resolved promise, so the renderer and the
    atlas are `ready` before the first input.
  - No scene line exists for tests.
- **Existing tests stay as they are.** `tests/scenes/AirshipFirstConfirm.test.ts` and `fieldVehicleArt.test.ts` fly
  on `overworld` with `createMockGame`, whose `app` has no renderer.
  - There, `capsOf` gives `!webgl`, and the profile is `off`. `FlightView.setMap` therefore never calls
    `import('./FlightRenderer.js')`, never loads the atlas, and logs nothing.
  - Those tests need no edit and must keep passing, unchanged, in every tranche.
- **`mode7Parity.test.ts`** plays the same inputs with Mode 7 on and off:
  1. take-off;
  2. 20 steps;
  3. confirm over a forest (`CANT_LAND`);
  4. 5 steps;
  5. a landing.

  It then asserts equal `playerPosition`, `fieldMode`, `vehicles`, flags, dialog lines and encounter count.
  - With Mode 7 on and `ready`, the state goes `tiltIn` on the take-off frame. The test advances 42 frames (700 ms) of
    `update(1)` through each tilt, and asserts that the hero did not move during them.
  - **The loading variant:** the atlas load is deferred, so the take-off goes to `loading`. The 20 steps play exactly as
    with Mode 7 off (`busy` false). The load is resolved during step 10, and the `tiltIn` starts on the first idle frame
    after it. The end state again equals the Mode 7 off run.
  - **A streamed variant:** a 192x192 stub art map (so `StreamedCollisionMap` is used) with a deferred chunk source,
    where one chunk on the route arrives late. In both modes the step waits at most `MISS_HOLD_FRAMES`, then goes on, and
    the end state is equal.
- **`mode7Activation.test.ts`:**
  - Mode 7 is on only on `overworld` in the airship. It goes off on a map change, with `?mode7=0` and with the setting
    `topdown`. It goes `failed` when the stub's atlas load rejects (one `console.error`).
  - `setMap` starts the import only when `AIRSHIP_RAISED` is set or an airship is parked or ridden on the map.
  - **Unchanged behaviour without a renderer:** a mock game with no `app.renderer` plays take-off, 10 steps and a
    landing.
    - The `FlightRenderer` mock's factory is never called.
    - `console.error` and `console.warn` are never called.
    - `__mode7.state` stays `off`.
    - The end state equals a run with `?mode7=0`.

**Data** (`tests/data/mode7Atlas.test.ts`; it reads files only and runs no Python):

- `mode7.json`'s `inputs` equals the sha256 of the current chunk files (a stale atlas fails);
- `mode7.png` is 3072x3072 and `mode7_low.png` 1536x1536 (read from the PNG headers);
- every cell of the world's 4 edges is Water.

**Gate commands** (run by hand in M7-1 and M7-INT, never inside vitest):

```bash
python3 -I assets-src/tools/mode7_atlas.py --check-determinism overworld   # 2 bakes into temp dirs (--out), same bytes
python3 -I assets-src/tools/build_map.py overworld && git diff --exit-code assets assets-src/maps   # fully clean
```

**Browser checks.**

- **How they run.** Playwright, always `&mute=1&mode7=1`.
  - **The GPU.** They use headed Chromium (`headless: false`) on this machine's GPU, because headless Chromium often
    falls back to SwiftShader. The check logs `window.__mode7.gl` (from `WEBGL_debug_renderer_info`). If it reads
    SwiftShader, the performance step is reported as skipped, and the pixel steps still run (`?mode7=1` overrides the
    `low` and `slow` downgrades).
  - **Files.** Screenshots go to `~/temp/ff-game/mode7/<tranche>/`, never the Desktop. Scratch scripts run from
    `/tmp/<agent>/`.
- **Scenarios:**
  - `w_s18_start`;
  - new `m7_coast`, `m7_edge` (3 cells from the north edge), `m7_land` (grass beside forest) and `m7_parked` (the ship
    and an NPC in view).
- **Steps:**
  1. **Pixel probes:** the top 100 rows are sky; the rows under the horizon are neither black nor the placeholder
     colour; `?mode7=0` shows today's top-down frame.
  2. **A sequence:** take-off at 0, 350 and 700 ms of the tilt, flight, landing; each frame saved and `__mode7.state`
     logged.
  3. **Idle frames:** on every idle frame, `__mode7.shadowCell` equals `game.playerPosition`.
  4. **Performance:** 600 steady flight frames, north then east, reading `frameP95` and `updateP95`.
     - The p95 window leaves out the first 60 frames after `flying` starts, every recentre frame and every frame with a
       chunk or atlas upload.
     - Those frames are reported separately, as a max.
  5. **Context loss:** `WEBGL_lose_context.loseContext()`, then `restoreContext()`. The field comes back in Mode 7, and
     the only console errors are the expected banner's.

**Gates per tranche.**

- Always: `npm run build`, the tranche's tests, then `npm test` (long; run it in the background).
- From M7-2 on: `npm run quest -- --strict` and the browser check as well.
- M7-1 and M7-INT: also the two gate commands above.

## 10. Tranches

Each tranche is a branch from `mainline`, mergeable on its own.

| Tranche | Content | Testable by | Effort |
|---|---|---|---|
| **M7-0 Pilot** | `mode7Math.ts` and its tests; `mode7_atlas.py` (run by hand); `GroundStrips` (far mesh only); `FlightSky`; `Mode7PilotScene`. `?mode7=pilot&scenario=w_s18_start` (dev) registers the pilot scene lazily in `main.ts` and switches to it: a static tilted render at the meadow, with no movement and no ship. Three presets A / B / C (`θ`, `h`, `κ`, horizon row) via `&preset=`. **It verifies:** a render texture's mips regenerate after a draw (`updateMipmaps`); NPOT mips work under WebGL2 at 3072²; `maxAnisotropy` takes effect; a dynamic `aUV` buffer update on a `Mesh`. It measures the frame time and the atlas size | unit tests; 3 screenshots per preset in `~/temp/ff-game/mode7/pilot/`; **the user picks a preset** | 6 h |
| M7-1 Atlas pipeline | `bake_mode7` in `build_hooks.py` and the `build_map.write()` line; `--out`, `--maps` and `--check-determinism` in `mode7_atlas.py`; `mode7_low.png`; `mode7.json`; `mode7Atlas.test.ts`; `WorldAtlas` with the patch compose, the free and the WebGL1 no-mip style | the atlas tests; the two gate commands of 9 | 3 h |
| M7-2 Flight | `FlightView` (with readiness and `loading`), `FlightRenderer`, `mode7Tilt` (states only, instant switch), the ship and shadow, north-up following, `mode7Toggle` with `capsOf`, Settings and Config, the missing-atlas fallback, the 6 scene lines, the parity (with its loading variant) and activation tests. The setting's default stays `topdown` in this tranche: the far atlas alone is blurry near the ship, so Mode 7 shows only with `?mode7=1` or the Config row | parity test; browser sequence | 7 h |
| M7-3 Near detail | `NearDetail`, `setWindow`, `setCap` and `onChunkLoaded`, the flight `stepHeld`, the near and seam meshes, the fog, the low-end profile (cap 16). **The default turns to `mode7` here (D-M8): both `Settings.ts`'s default and `Settings.test.ts`'s expected value** | `streamWindow.test.ts`; the streamed parity variant; probes at 3 spots; frame time; resident <= 36 (low <= 16); **the user's live test** (Q5, Q6) | 6 h |
| M7-4 Tilt and landing | `tiltParams`, the tilts, `busy`, the hold-off, the landing marker, the shadow-cell check | `mode7Tilt.test.ts` (t = 0 match); browser sequence at 0 / 350 / 700 ms | 4 h |
| M7-5 Billboards and clouds | parked vehicles and NPCs, depth sort and culling, clouds | unit projection; `m7_parked` screenshots | 4 h |
| M7-6 Fallbacks | context loss and restore (atlas reload, near redraw), the frame-time switch, the caps | `mode7Toggle.test.ts`; the browser context-loss step | 3 h |
| M7-7 Quarter turns (not scheduled: north-up ruling) | heading `ψ` in 90° steps over 250 ms, a HUD compass. Input remap in a new pure `mode7/headingInput.ts` (under 80 lines), applied through an optional `PlayerController.directionMap` hook (199 lines, at most +5). `ExplorationScene` +0. It needs the back view (11) | unit remap; parity test with turns | 5 h |
| M7-8 Landmark billboards (optional, Q4) | the build exports tall decos as billboard cuts, plus ground-only atlas cells; billboards; the volcano smoke | atlas tests; screenshots | 6 h |
| M7-INT | merges, full suite, build, strict quest, browser check; AGENTS.md, `docs/PROGRESS.md`; T-1 done in `docs/TODO.md` | all gates of 0.1 | 2 h |

**Order and merge owners:**

- M7-0, then M7-1 (M7-1 takes over the `mode7_atlas.py` that M7-0 made), then M7-2 (it needs M7-1's atlas and its
  missing-atlas test).
- The user's live test comes after M7-3, so they first see the near detail, not the blurry atlas alone.
- M7-3 and M7-4 then run in parallel; M7-3 merges first, and M7-4 owns the rebase (both touch `FlightView.ts` and
  `FlightRenderer.ts`).
- M7-5 and M7-6 run in parallel after both; M7-5 merges first, and M7-6 owns the rebase.
- M7-INT owns the last merge, re-runs the world compile so that `mode7.png` matches (R13), and runs every gate.

Core T-1 (M7-0 to M7-6 plus M7-INT) is about 35 h.

## 11. The airship back view (T-2)

**Mode 7 does not need a back view for T-1.** With north up, the ship is seen from behind only while it flies north,
and T-2's ruling applies (b_7's side view for every heading, revisited after live testing). M7-0 to M7-6 ship with b_7.

**When it becomes needed:**

- (a) at the live test after M7-3, if flying north with the side view reads wrong to the user (Q5); T-2 then comes back with
  its planned next try, 3/4 views traced from b_7;
- (b) before M7-7, should it ever be scheduled.

A code-only stopgap can be shown at that live test: squash b_7 horizontally to 60 % over 150 ms while moving north or south. It
is a knob, off by default (default for Q5).

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Flattened 3/4-view landmark art looks squashed at a low pitch | the pilot presets; Q4 and M7-8 |
| R2 | Shimmer or blur near the horizon | mips, anisotropy and fog (D-M10); verified in M7-0 |
| R3 | A visible seam between the meshes | the 8 one-row fade meshes; the atlas underlay; screenshots at 3 spots |
| R4 | A stale atlas after a world recompile | the bake inside `write()`, plus the staleness test |
| R5 | Pixi 8 Mesh details | stated design: `Mesh` and `MeshGeometry` with a static position buffer and a dynamic `aUV` buffer (`buffer.data = f32; buffer.update()`), one texture and one `alpha` per mesh, no vertex colour. The seam uses separate meshes, the fog a sprite. M7-0 proves the dynamic buffer before anything else depends on it |
| R6 | Render textures lost on a context loss | reload and recompose on restore; `failed` falls back to top-down |
| R7 | GPU memory (175.0 MB in flight, 141.6 MB today at most) | the flight cap of 36; the atlas source freed; the low profile (61.8 MB) |
| R8 | The 700 ms input hold feels laggy at take-off or landing | Q10; the time is one constant |
| R9 | `ExplorationScene.ts` ceiling (545 / 590) | +6 lines, listed in 8 |
| R10 | Streaming lags at the boosted 20 cells/s | the underlay and late-chunk redraw; the hold as today; a browser run at the boosted speed |
| R11 | Unit tests touch PixiJS | the Pixi parts sit behind the lazy `FlightRenderer` import, mocked in tests |
| R12 | Headless browser checks run on SwiftShader | headed Chromium; the GL string is logged; the performance step is skipped, not faked |
| R13 | `mode7.png` (binary) conflicts when two branches recompile the world | never hand-merge it: regenerate it at the merge with the world compile; the staleness test catches a miss |

## 13. Open questions for the user

Closed by the rulings of 2026-11-19:

- **Q1 Camera:** north-up, 4-way (D-M2).
- **Q2 Look:** the 16-bit style, a straight horizon, strips (D-M1). Picking the M7-0 preset is a pilot gate, not an open
  question.
- **Q3 Default:** Mode 7, with Top-down in Config and `?mode7=0` (D-M8).
- **Q7 Filtering:** smooth, mipmaps and fog (D-M10).
- **Q4 Landmarks:** flattened; M7-8 not scheduled (user, 2026-11-19).
- **Q6 Speed:** unchanged, 10 cells/s (user: faster flight not wanted in the first version).
- **Q8 Clouds:** sky clouds only, no cloud shadows (user).
- **Q9 Landing marker:** on (user).
- **M7-0 preset:** A, classic (18 deg, h 6, kappa 1/600, horizon row 390), the plan's flight values (user, 2026-11-19).

Still open, each with a proposed default that the plan builds unless you say otherwise:

5. **Q5 Ship art.** Is b_7's side view acceptable while flying north (judge at the live test after M7-3)? Try the squash stopgap? Bring T-2
   back now or later? **Default:** b_7, stopgap off, T-2 revisited after the live test after M7-3.
9. **Q10 Tilt time.** 700 ms each way, or shorter? **Default:** 700 ms.

## TODOs

- [x] Rev 2: the rulings and momus's 12 items (2026-11-19)
- [x] Rev 3: momus re-review, 3 items and the suggestions (2026-11-19)
- [x] Momus review of rev 3: OKAY; rev 3.1 fixed its last item (2026-11-19)
- [x] M7-0 pilot; the user picked preset A (priority: high, effort: 6 h)
- [ ] M7-1 atlas pipeline (priority: high, effort: 3 h)
- [x] M7-2 flight, default still top-down (priority: high, effort: 7 h). Result: `FlightView`, `FlightRenderer`,
  `FlightBillboards` (ship, shadow and the landing marker, which the user ruled on, so it came in early from M7-4),
  `mode7Tilt` (the 5 states with M7-2's instant switch, `TILT_FRAMES` 0; M7-4 sets 42), `mode7Toggle`, the Settings
  row `airshipView` (default `topdown`) and its Config row; `ExplorationScene.ts` +6 lines and 1 edited (545 to 551).
  Tests: `mode7Toggle`, `mode7Tilt`, `mode7Activation`, `mode7Parity` (on / off / no renderer, the loading variant and
  a streamed 192x192 variant with a late chunk). Browser, headed Chromium on ANGLE Metal (Apple M4 Pro), w_s18_start
  `?mode7=1`: 600 steady flight frames, frame p95 10.0 ms, update p95 0.2 ms; artefacts in `~/temp/ff-game/m7_2/`
- [x] M7-3 near detail, default on (priority: high, effort: 6 h). Result: `NearDetail` (4x4 chunks at 48 px, 3072²;
  low 3x3 at 32 px, 1536²; underlay, chunks, patches; recentre / flag change / late chunk redraws), `FlightStream`
  (the window and cap to the streamer), `flightStats` (p95s without the upload frames), the near and 8 seam meshes in
  `GroundStrips` (the split moves down past rows the window does not cover: near the clamped map edges), the fog in
  `FlightSky`; `StreamedChunks.setWindow` / `onChunkLoaded` / `textureOf`, `ChunkStreamer.setCap` (+ `flightWindow`),
  the flight `stepHeld`; `?mode7=low` (an addition, for the low-end review); the default `mode7` (D-M8). Browser
  (headed Chromium, ANGLE Metal, Apple M4 Pro), w_s18_start with the default settings: frame p95 9.9 ms, update p95
  0.5 ms over 600 steady frames (low: 10.0 / 0.3); resident chunks at most 36 (low 16); measured GPU memory 172.9 MB
  (low 59.7 MB) plus the sky, fog and meshes; artefacts in `~/temp/ff-game/m7_3/`. The user's live test is next
- [x] M7-4 tilt and landing (priority: high, effort: 4 h). Result: `tiltParams`, `ease`, `TILT_FRAMES` 42 and
  `TILT_HOLDOFF_FRAMES` 8 in `mode7Tilt.ts` (with `FLIGHT_VIEW` and `SHIP_FOOT_Y`, moved there from `FlightView`); in
  `FlightView` the tilt's start from the live camera, its first frame drawn at t 0 (in) or 1 (out) before any tick,
  the ship from its top-down foot (its lift easing up inside the take-off and down over the landing's last 400 ms),
  the shadow from the cell's bottom edge (the top-down shadow's) to P while the check reads P, no marker while a tilt
  plays, the hold-off at its end, and the tilt frames left out of the steady p95s (they settle again after it). Also:
  a tilt ends within 1e-6 of its end (a ticker's 1000/60 ms steps sum to 42 frames only up to rounding: one frame
  more without it), the fog follows the horizon above the screen (`horizonY`, off screen at t 0), and the near
  mesh's square is open on the map's edges with rows wholly off the map left to the far atlas (`rowFits(..., map)`,
  `rowOffMap`): without it the rows under the HUD band at the south edge (off the map) dropped the whole near mesh,
  so the t 0 frame there was the blurry far atlas. Tests: `mode7Tilt.test.ts` (the t 0 match: every cell corner in
  view within 1e-6 px of `Camera.worldToScreen`, within 0.5 px of the drawn, rounded camera, at 48 and 96 px per cell,
  at the centre, the 4 clamped edges and 2 corners; 42 / 21 frames; the near split through every frame by the edges),
  `mode7TiltScene.test.ts`, the parity tests (each tilt 42 held frames with the hero still, end states equal, the run
  83 frames longer: the 'up' held through the take-off steps on the frame the tilt ends; the loading variant's held
  step waits 41 frames more). Browser (headed Chromium, ANGLE Metal, Apple M4 Pro, w_s18_start, frame-stepped 60 Hz
  captures): the t 0 frame drawn by Mode 7 and by the top-down world is pixel-identical at the meadow, at the west
  edge (x clamped) and over the south edge's field (y clamped; only the off-map band under the HUD differs: sea
  instead of black); each tilt 42 frames; Up held through a take-off moves on frame 43; frame p95 9.1 ms, update p95
  0.4 ms (120 Hz display); the tilt frames' p95 9.1 ms, max 9.3 ms; artefacts in `~/temp/ff-game/m7_4/`
- [x] M7-5 billboards and clouds (priority: medium, effort: 4 h). Result: `propMath.ts` (pure: the billboard sources
  read from the field's own sprites, the parked vehicles labelled `vehicle:*` but the airship and the NPCs; each stood
  at `cellToScreen` of its ground point with the sprite's texture, anchor, flip and tint, scaled by `px per cell /
  TILE_SIZE`, so it lands on the top-down sprite at a tilt's t = 0; culled beyond 40 cells of P or off screen, faded
  over the last 4 cells and through the fog), `FlightProps.ts` (the sprite pool), the depth sort in `FlightBillboards`
  (zIndex = px per cell at the ground point: nearer than P over the airship, farther behind it and its shadow),
  `cloudMath.ts` (4 code-drawn 15-bit clouds lit from the top left, binary alpha, at scales 4 / 3 / 2 / 2 a fixed
  height over the horizon, drifting east and sliding against the ship's sideways motion) drawn by `FlightSky.clouds`
  behind the ground; `FlightView.ts` +0 lines (`deps.npcs`), `FlightRenderer.ts` +3 lines and 1 edited,
  `ExplorationScene.ts` 1 line edited (+0), the `m7_parked` scenario. Tests: `propMath`, `cloudMath`,
  `flightBillboards`, `mode7Props`. Browser (headed Chromium, ANGLE Metal, Apple M4 Pro): frame p95 9.9 ms, update p95
  0.2 ms over 600 steady frames with the billboards in view (w_s18_start 10.0 / 0.2); artefacts in
  `~/temp/ff-game/m7_5/`
- [x] M7-6 fallbacks (priority: high, effort: 3 h). Result: `FlightContext.ts` (new, no PixiJS:
  `watchFlightContext` on the canvas, and `FlightFallback`, the view's `lost` flag and the log lines);
  `FlightRenderer` watches the canvas and on a restore reloads the atlas (`WorldAtlas.restore` now rejects on a
  failure) and invalidates the near detail; `FlightView` hides the view while the context is lost or the restore runs
  (the top-down world shows), and on a failed restore logs one `console.error`, sets `failed` and frees the renderer.
  The frame-time switch: `SlowRule` in `mode7Toggle.ts` (a 120-frame ring with an over-limit count, no sort per
  frame), fed by `FlightStats`'s steady frames (the settle and upload frames left out); a session flag
  (`slowThisSession`, read by `mode7Enabled`'s `slow`), cleared by `ConfigScene` when Mode 7 is chosen again; on a
  switch the renderer is freed unless the URL keeps the view. `needed()` moved to `mode7Toggle.flightMayCome` (the
  250-line ceiling). Tests: `tests/scenes/mode7/mode7Fallback.test.ts` (the rule against `p95` over random sequences,
  the excluded frames, the watcher, the atlas reload, and the field: loss and restore mid-flight, a failed restore,
  the switch with the setting and with `?mode7=1`, Config clearing it). Browser (headed Chromium, ANGLE Metal, Apple
  M4 Pro, w_s18_start): `loseContext` mid-flight shows the banner, the hero flies on (75,17 to 68,17), `restoreContext`
  is back in Mode 7 58 ms later and a further flight north recentres and streams; the only error is the banner's
  "WebGL context lost". A restore with `mode7*.png` answering 404: one `console.error`, `failed`, top-down flight (with
  `?mode7=1` too). A 30 ms busy-wait per frame: the switch fires 3.9 s later (p95 34.7 ms) and the flight goes
  top-down; with `?mode7=1` it warns "the URL keeps the view on" and stays. Precedence: setting Top-down off,
  `?mode7=1` over it full, `?mode7=0` off, `?mode7=1` with a faked MAX_TEXTURE_SIZE 1024 off, 2048 low, a faked WebGL 1
  VERSION low. Artefacts in `~/temp/ff-game/m7_6/`
- [ ] M7-INT (priority: high, effort: 2 h)
- [ ] M7-7 quarter turns (not scheduled)
- [ ] M7-8 landmark billboards (optional, Q4)

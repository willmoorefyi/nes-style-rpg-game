# Mode 7 airship flight view (T-1), rev 1

Status: rev 1, not reviewed (momus next). Nothing is implemented. Facts in section 1 were checked at `af430575`.
Source: `docs/TODO.md` T-1 (the want and the planner brief) and T-2 (the airship's views, on hold).

**Naming.** Tranches are `M7-0` to `M7-8` and `M7-INT` (10). Decisions are D-M1 to D-M9 (0.2). Open questions for the user
are Q1-Q10 (13). "WORLD n.m" means `docs/WORLD_PLAN.md` rev 3 section n.m.

## 0. Summary

While the party flies the airship on the world map, the field draws the world as a ground plane seen from behind and
above the ship. The land curves down to a horizon, with a sky band above it, like the airships of the later 16-bit
Final Fantasy games. Take-off tilts the top-down view into this one. Landing tilts it back.

It is a view only. The grid, the movement, the field rules, the save position and the verifier do not change. The view
reads the hero's position and the game's `fieldMode`, and draws them. Turning it off gives today's top-down flight.

Recommended shape:

- **Rendering:** a scanline-strip mesh (one quad per screen row, UVs from a pure TS projection; 2.3).
- **Data:** a baked low-resolution world atlas for the distance, plus a near-detail render texture built from the chunk
  textures the streamer already holds (3).
- **Camera:** north up with the classic 4-way grid moves (4.1).
- **Ship art:** the b_7 side view for every heading, as T-2's ruling says (11).
- **Pilot:** a static tilted render of one spot behind `?mode7=pilot` (M7-0).

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "On the world map, while fieldMode is airship and Mode 7 is on, the field shows the tilted ground, the sky band and the ship",
    "Confirm on a parked airship tilts the view in; confirm over a landable cell tilts it out and leaves the party on foot on that cell",
    "Confirm over a cell that cannot be landed on shows CANT_LAND, and the view stays in flight",
    "The Config toggle 'Airship view' and ?mode7=0 both fly in today's top-down view",
    "A save made in flight loads straight into Mode 7 at the saved cell",
    "A lost WebGL context, a missing atlas or a slow device falls back to the top-down view with a console message, never a black field"
  ],
  "observable": [
    "Browser screenshots in ~/temp/ff-game/mode7/<tranche>/ at the pilot spot, the coast, the world edge, mid-tilt and after landing",
    "window.__mode7 reports the state, the frame time p95, the resident textures and the cell under the ship",
    "The cell under the ship's shadow (inverse projection) equals game.playerPosition on every flight frame"
  ],
  "pass_fail": [
    "npm run build and npm test pass",
    "npm run quest -- --strict passes, and git diff mainline shows no change under src/progression/, src/systems/fieldRules*.ts or assets/data/quest.yaml",
    "The rules-parity test: the same inputs with Mode 7 on and off give the same playerPosition, fieldMode, vehicles, flags and encounter count",
    "Flight frame time p95 <= 16.7 ms and the Mode 7 update p95 <= 2 ms on this machine (Apple M4 Pro), measured over 600 flight frames",
    "Every new source file is under 250 lines; ExplorationScene.ts grows by at most 8 lines and stays under its ceiling of 590"
  ]
}
```

### 0.2 Decisions

| # | Decision | Why |
|---|---|---|
| D-M1 | Scanline strips, not a custom fragment shader (2.3) | One TS function draws and picks the landing cell, so they cannot drift. The default Pixi mesh shader works on WebGL and WebGPU. Row-only curvature is the SNES look |
| D-M2 | North up and 4-way moves for T-1; quarter turns are an optional tranche (4.1) | The grid, `PlayerController` and every rule stay as they are |
| D-M3 | The landing cell stays the hero's grid cell | No rule change. The inverse projection only draws the marker and proves that the shadow sits on that cell (6) |
| D-M4 | Landmarks and towns stay flattened in the plane for T-1 (5) | They are baked into the chunk PNGs, so this costs nothing. Billboards are M7-8, if the user wants them (Q4) |
| D-M5 | The far atlas is baked offline at 16 px per cell (3.1) | Loading all 144 chunks (340 MB decoded) at take-off is not possible |
| D-M6 | The near detail comes from the streamed chunks (3.2) | A 4x4-chunk window fits under today's `STREAM_TEXTURE_CAP` of 60 |
| D-M7 | Mode 7 runs only on the world map (`overworld`) | The only streamed map, and the only one where the airship flies in the game |
| D-M8 | Mode 7 is on by default, with a Config toggle and `?mode7=0` (7) | The user asked for it (Q3 confirms) |
| D-M9 | The ship uses b_7's side view for every heading (11) | T-2's ruling of 2026-11-19 |

## 1. Facts (verified on `af430575`)

- **The world.** `assets/maps/ai/overworld.yaml`: 192x192 cells, `art.tile` 48, `art.chunk` 16. That gives 144 `below_r_c.png`
  chunks (768x768 RGB, 34.2 MB of PNG, the largest 0.53 MB) and no `above` layer, plus two flag patches
  (`patch_canal.png`, `patch_north_bridge.png`). On screen a cell is `TILE_SIZE` 96 px (the 2x art). One decoded chunk is
  768² x 4 = 2.36 MB; the whole world decoded would be 340 MB.
- **Streaming.** `src/rendering/StreamedChunks.ts` and `chunkStreaming.ts`: maps of more than 64 chunks stream. The view's
  chunks, a 1-chunk ring and 1 chunk ahead per axis stay resident (`STREAM_TEXTURE_CAP` 60 textures), the rest are freed
  least recently used. A missing chunk holds a step for `MISS_HOLD_FRAMES` 6, then shows a flat terrain-coloured
  placeholder. Textures load through `Assets.load` (worker `createImageBitmap`) with nearest scaling.
- **Renderer.** `Game.init` calls `app.init` without a `preference`, so Pixi 8.17.1 uses WebGL. The view is
  1920x1080 (`GAME_WIDTH`, `GAME_HEIGHT`), at resolution 1. No source file uses a custom `GlProgram`, `Filter` or `Mesh`
  today. `diagnostics.watchContext` banners a lost context. Pixi re-creates its resources on restore, but the contents of
  a render texture are lost.
- **Camera.** `src/rendering/Camera.ts` moves `worldContainer` by integer px, clamps to the map (the world does not wrap)
  and keeps `HUD_BOTTOM_BAND` (about 100 px) for the HUD. Row 0 of the world's collision is water, so the edge band is sea.
- **Vehicles.** `FieldVehicles.ts` (245 lines) owns the modes. `confirm()` takes off on a parked airship and lands with
  `canLand` plus no NPC on the cell, or emits `CANT_LAND`. `FieldVehicleSprites.ts` (178) draws the ridden airship at
  `FLYING_Z` over the hero's cell with a 400 ms lift (`AIRSHIP_LIFT` 10 native px, `TAKEOFF_MS`) and a shadow ellipse
  (`vehicleLayout.ts`, `FieldVehicleView.ts`). The airship frame is 147x94 native (drawn at x2). It faces the hero's last
  horizontal direction.
- **Movement.** `AirshipMode`: flies over every terrain, speed x2 (100 ms per cell, so 10 cells/s; x2 more with the Walk
  speed boost), encounter rate 0. `fieldRules.fieldStep` ignores transitions and scripted encounters while flying.
- **Scene.** `ExplorationScene.ts` is 545 lines; its ceiling in `tests/data/fileCeilings.test.ts` is 590. AGENTS.md
  still says 504; M7-INT corrects it.
- **Settings.** `src/core/Settings.ts` (`ff.settings` in `localStorage`, `messageSpeed` only) and `ConfigScene.ts` (97 lines).
- **Scenario.** `w_s18_start`: on the world map in flight over the Citadel meadow (`ord_meadow`), the ship docked at
  Crescent. It is the pilot spot.
- **Landmarks.** The world source has 83 `deco` objects (towns, caves, the volcano, the citadel and others). All of them
  are baked into the below chunks. The compiled map keeps no per-object list.

## 2. Rendering approach

### 2.1 Candidates

- **A. A fragment shader on a full-screen quad.** A Pixi 8 `Mesh` with a custom `Shader` (`GlProgram`, GLSL). Per pixel,
  it casts the camera ray, intersects the curved ground and samples the far atlas or the near detail with fog. It needs
  WGSL as well if the app ever moves to WebGPU.
- **B. Per-scanline affine strips (the SNES method).** One `Mesh` whose geometry is one thin quad per screen row from the
  horizon to the bottom of the screen (about 690 rows). The quad's screen positions are fixed. Each frame, TS computes
  the 4 UVs of every row: the ground line seen on that row, rotated by the heading. Pixi's default textured mesh shader
  draws it. Along a row the ground is exactly affine for a camera with no roll, so the image is exact, not an
  approximation. Curvature is a function of the row: the FF6 look.
- **C. A grid mesh** (for example 64x48 vertices) with projected UVs. This allows curvature in x as well (a horizon that
  arcs), but affine interpolation inside each cell distorts the image. Rejected: it costs as much as B and looks worse.

### 2.2 Comparison

| | A shader | B strips |
|---|---|---|
| Exact image | yes (per pixel) | yes (per row; the planar ground is affine along a row) |
| Curvature | any, an arced horizon too | per row (the FF6 / SNES look) |
| Picking the landing cell | the TS inverse must match the GLSL by hand (drift risk) | the same TS function draws and picks |
| Unit tests | the maths only; the GLSL needs a browser probe | the whole UV table is plain TS |
| Renderer | WebGL now, WGSL later | default shader, WebGL and WebGPU |
| Near / far textures | 2 samplers, blended per pixel | 2 meshes split at a row (the distance depends on the row only) |
| Fog | in the shader | a gradient sprite over the horizon rows, plus a per-row tint on the far mesh |
| CPU per frame | ~0 | ~690 rows x a sqrt and some multiplies, under 0.1 ms; a 25 KB UV upload |
| GPU per frame | 1 full-screen pass | 2 meshes, the same fill |
| New Pixi surface | GlProgram, uniforms, context restore of the program | Mesh, MeshGeometry, buffer update |

### 2.3 Recommendation: B, scanline strips (D-M1)

B gives the requested look (the land curves away row by row) with no custom GPU code. Its main advantage is that the
projection lives in one pure TS module. That module fills the UV table, places the billboards and the shadow, and
picks the landing marker, so the parity tests in 9 cover all of the drawing. A stays the upgrade path if the pilot
shows an artefact B cannot fix, or if the user wants an arced horizon (Q2). The atlas and detail textures of 3 serve
both A and B.

### 2.4 The projection (pure; `mode7Math.ts`)

Camera parameters: altitude `h` cells, pitch `θ` below horizontal, focal `f` px, the screen row of the optical axis
`cy`, planet radius `R` cells (curvature; `R = ∞` is flat), heading `ψ` (0 = north), and the camera's ground point `C`
(the ship's world position minus `back` cells along the heading).

- Row `y` looks down at `φ(y) = θ + atan((y − cy) / f)`.
- **Flat ground:** the distance ahead is `d = h / tan φ`.
- **Curved ground** `z = −d² / 2R`: `d = R (tan φ − sqrt(tan² φ − 2h / R))`, real for `tan φ ≥ sqrt(2h / R)`. That is
  the horizon row. Above it is sky, and the land ends at `sqrt(2hR)` cells.
- **Lateral scale:** with the depth along the optical axis `r = d cos θ + (h + d² / 2R) sin θ`, the ground spans `1 / s`
  px per cell on that row, where `s(y) = r / f` cells per px.
- **Row UVs:** the centre is `C + d · fwd(ψ)` and the left and right ends are `centre ∓ (W / 2) s · right(ψ)`, for the
  top and bottom edges of the row (`y` and `y + 1`), so the GPU's mip selection sees the true vertical gradient.
- **Inverse:** `screenToCell(x, y)` uses the same `d`, `s`, `ψ`. `cellToScreen(cell)` is its closed-form inverse, used
  by the billboards and the shadow.
- **Starting values** (computed in a scratch script; the pilot tunes them, Q2): `f` 1200, `θ` 18°, `h` 6, `R` 600,
  `cy` 600. With these:

  | Screen row | Cells ahead of the camera | px per cell | Half-width (cells) |
  |---|---|---|---|
  | 390 (the horizon; sky above it, 36 % of the screen) | 78.5 | 15.4 | 62.5 |
  | 450 | 37.2 | 31.9 | 30.1 |
  | 530 (the near / far split) | 24.9 | 46.7 | 20.6 |
  | 820 (the ship's shadow) | 11.3 | 95.0 | 10.1 |
  | 1080 (the bottom) | 7.3 | 136.9 | 7.0 |

  The ship's cell shows at 95 px per cell (top-down is 96), so the ship keeps its size. About 690 rows are ground.

### 2.5 Filtering, fog and the edge

- **Magnification is nearest** (pixel art, like today). Minification on the far atlas is linear with linear mipmaps and
  `maxAnisotropy` 4 if the extension exists (Pixi `TextureStyle`). This stops the shimmer near the horizon. The SNES
  look (nearest, shimmering) is a one-line style switch for the pilot (Q7).
- **Fog:** a vertical gradient sprite from the horizon row down about 120 rows, in the sky's haze colour, alpha 0.6 to 0.
- **Near / far seam:** the two meshes overlap by 8 rows, and the near mesh fades out over them (a vertex alpha on the
  row quads).
- **Off the world:** the atlas uses clamp-to-edge with a 1-cell sea border. Beyond the map the ground is sea, so the
  camera never needs to clamp in flight.

## 3. Data: the world's textures

### 3.1 Far atlas (D-M5)

- **The bake.** A new tool `assets-src/tools/mode7_atlas.py` (under 250 lines; `-I`, deterministic) downsamples the 144
  below chunks to 16 px per cell. It writes `assets/maps/ai/overworld/mode7.png` (3072x3072 RGB; about 4 MB, to be
  measured) and `mode7.json` (`{version: 1, cellPx: 16, size: 3072, inputs: <sha256 of the chunk files>}`).
- **When it runs.** `build_hooks.py` calls it after every `overworld` compile (2 lines), so a region tranche that
  recompiles the world gets a fresh atlas.
- **The patches** stay out of the bake. At runtime the atlas is drawn into a render texture once per flight, with each
  patch overlay downscaled on top while its flag is set (`CANAL_OPEN`, the north bridge).
- **Memory.** 3072² x 4 = 37.7 MB, plus a third more for mips: about 50 MB. A low-end variant at 8 px per cell
  (1536², about 12.6 MB with mips) is written too; 7 picks it.
- **When it loads.** On entering the world map once the airship is raised (`AIRSHIP_RAISED`) or parked there, not at
  take-off. The decode is off-thread. The upload and mip build take about 10-20 ms once, behind the map's fade-in.

### 3.2 Near detail (D-M6)

- **The render texture.** It covers a 4x4-chunk window (64x64 cells) at 48 px per cell, 3072² (37.7 MB). It is drawn
  from the streamed chunk sprites (nearest).
- **Recentring.** The window moves in whole-chunk steps when the ship leaves its middle 16 cells, so the ship always has
  24 or more cells to each side. In 2.4's view the detail rows span 4 cells behind the ship to about 14 ahead, and
  about 21 to each side. A recentre redraws the 16 chunks, under 1 ms of GPU time, about every 1.6 s at 10 cells/s.
- **The split.** The near mesh draws the rows at most `D_SPLIT` (25) cells ahead. There the screen shows about 47 px per
  cell (the native 48); beyond, the 16 px atlas is magnified at most 3x and close to 1:1 at the horizon. With the
  starting values these are rows 530 to 1080, 80 % of the ground rows.
- **A missing chunk** in the window is filled from the far atlas (the atlas is drawn first, then the chunks), so flight
  never shows a hole or a flat placeholder.

### 3.3 Streaming

- **The window.** `StreamedChunks.update` takes the 4x4 detail window as its "visible" rect in flight (a small accessor;
  see 8). With its ring and one chunk ahead that is at most 7x7 = 49 chunks, under the cap of 60, so the cap does not
  change.
- **The rate.** At 10 cells/s the ship crosses a chunk about every 1.6 s and needs 4 to 7 new chunks, each about
  0.24 MB of PNG (decoded off-thread, about 1 ms to upload). At the boosted 20 cells/s, a crossing about every 0.8 s.
- **`stepHeld`** keeps its top-down meaning; in flight it is never consulted, because the atlas fallback covers a
  missing chunk.

### 3.4 Memory and frame budget

| Item | GPU memory |
|---|---|
| Far atlas render texture with mips | ~50 MB (low end ~12.6 MB) |
| Near detail render texture | ~37.7 MB |
| Resident chunks in flight (at most 49) | ~116 MB (today's cap allows 60, ~141 MB) |
| Sky, clouds, billboards, meshes | < 2 MB |
| **New with Mode 7** | **~90 MB** (low end ~52 MB) |

| Work per frame | Estimate (M4 Pro), measured in M7-0 and M7-3 |
|---|---|
| Row table and UV upload (690 rows) | < 0.1 ms CPU |
| Billboards and shadow (projection of at most 40 sprites) | < 0.1 ms CPU |
| Two ground meshes and the sky, 1920x1080 fill | < 0.5 ms GPU |
| A detail recentre (16 chunk draws into the render texture) | < 1 ms GPU, about every 1.6 s |
| A chunk upload | about 1 ms, 4 to 7 per crossing |
| Budget | 16.7 ms at 60 Hz (8.3 ms if the ticker runs at 120 Hz); the Mode 7 update p95 must be <= 2 ms |

## 4. Camera and controls

### 4.1 North up or a heading (D-M2)

| Option | Feel | Cost |
|---|---|---|
| **North up, 4-way grid moves** (recommended for T-1) | The camera always looks north and up flies away from it. FF1's controls unchanged | Nothing changes in movement or rules |
| Quarter turns (M7-7, optional) | Left and right turn the view 90° over 250 ms; up flies forward one cell along the heading; down turns about | The input is remapped by the heading before `PlayerController`; still whole cells. It needs the back view (11) |
| Free rotation (FF6) | Smooth turning | Sub-cell positions and a heading break the grid moves. Rejected for this game |

### 4.2 Speed and altitude

- **Speed is unchanged:** 10 cells/s, x2 with the Walk speed boost. The hero's interpolated pixel position drives the
  camera, so the flight is smooth.
- **Perceived speed.** The bottom rows scroll faster than in the top-down view and the horizon slower. If flight feels
  slow, a Mode 7-only speed factor is a view-side option (Q6), but it would change the step timing. The default is
  to leave it at 1.
- **Altitude** is constant in flight (`h` 6). The existing bob (2 native px over 2.6 s) moves the ship sprite only.
- **The ship** is screen-fixed at x 960, its keel about 70 px above its shadow row (820), so it sits above the HUD
  band.

### 4.3 Take-off and landing

- **The tilt** is one pure function `tiltParams(t)` that eases `θ` from 90° (looking straight down) to 18°, with `h`, `f`
  and `cy` set at `t = 0` so that the ground under the ship shows at 96 px per cell centred where the top-down view had
  it. At `t = 0` the Mode 7 frame matches the top-down frame (tested within 1 px at the ship's cell and 2 px at the
  view's edge, 9). The switch is therefore invisible, then the view tilts.
- **Take-off.** Confirm on a parked airship: today's 400 ms lift in the top-down view, then the switch, then a 700 ms
  tilt-in (ease in-out).
- **Landing.** Confirm over a landable cell: `FieldVehicles` changes the mode at once (as today). The view sees
  `fieldMode` become walking and plays a 700 ms tilt-out with the ship still drawn. It then switches back to the
  top-down view, which already shows the hero on foot and the parked airship.
- **Input is held during a tilt.** `FlightView.busy` joins `fieldBusy` (1 line), then `input.holdOff(8)` at the end.
- **A load or a retry in flight** starts straight in the flying state, behind the fade-in.
- **A tilt cut short** by a dialog or a cutscene finishes at once.

### 4.4 Input

There is no new key. The arrows and confirm keep their meaning. Cancel opens the field menu, which hides the view as
today: the menu scene is not transparent.

## 5. What shows in the view

| Element | T-1 treatment | Tranche |
|---|---|---|
| Ground, towns, landmarks | Flattened in the plane (baked into the chunks and the atlas; D-M4) | M7-0 / M7-3 |
| Sky | A code-drawn vertical gradient (palette from `snes_palette.py`, top darker), a haze band at the horizon | M7-0 |
| Clouds | 3 to 5 code-drawn cloud sprites in the sky band drifting with the heading; optional soft cloud shadows on the ground (Q8) | M7-5 |
| The airship | Screen-fixed `VehicleView` hull (the same art and bob, b_7 side view, facing the last horizontal; D-M9) | M7-2 |
| The airship's shadow | An ellipse at `cellToScreen(ship cell)`, scaled by that row's `1/s`, alpha 0.3 | M7-2 |
| The landing marker | A thin outline of the cell under the shadow: white if `canLand`, none otherwise (Q9) | M7-4 |
| Parked ship, NPCs on the world map | Upright billboards at `cellToScreen`, scaled by `1/s` of their row, depth-sorted, culled beyond 40 cells or behind the camera | M7-5 |
| Volcano smoke (`FieldAmbient`) | Hidden in flight in T-1; a billboard in M7-8 | M7-8 |
| Tall landmarks (towers, volcano, citadel, the Mirage) | Optional upright billboards cut from the deco art, with ground-only cells in the atlas under them (Q4) | M7-8 |
| HUD, dialogs | Unchanged, over the view | — |

## 6. Rules (unchanged)

- **The landing cell** is `player.gridX, player.gridY`, as today (D-M3). `screenToCell` of the shadow's centre must
  return that cell; a test pins it, and a mismatch in a dev build logs `console.error` once.
- **No rule moves.** `canLand`, the NPC check, `CANT_LAND`, encounters (the airship's rate is 0), transitions ignored in
  flight, `recordPlayer` (the save position) and `fieldMode` saving all stay as they are. `FieldVehicles.confirm` is not
  touched.
- **The verifier is unaffected.** `src/progression/`, `fieldRules*.ts` and `quest.yaml` are not edited; the gate is in
  0.1. The verifier models cells and flags, never the view.
- **Mode 7 is only a view.** It runs when the map is `overworld`, `fieldMode` is `airship`, and `mode7Enabled()` is true.
  Anything else (a warp in a cutscene, another map) turns it off with no tilt.

## 7. Fallback

- **The setting.** `Settings.ts` gains `airshipView: 'mode7' | 'topdown'` (default `mode7`; an invalid stored value warns
  and takes the default). `ConfigScene` gains the row "Airship view  Mode 7 / Top-down".
- **URL.** `?mode7=0` forces the top-down view and `?mode7=1` forces Mode 7, in dev and production. `?mode7=pilot` (dev
  only) opens the M7-0 static render.
- **One pure gate,** `mode7Enabled(search, settings, caps)`, in `mode7Toggle.ts`. `caps` is `{webgl, maxTexture,
  lowEnd, failed}`.
- **Low end.**
  - A `MAX_TEXTURE_SIZE` under 4096 uses the 1536² atlas and a 2x2-chunk detail window.
  - A flight frame-time p95 above 20 ms over 120 frames switches to the top-down view for the session with
    `console.warn`. The player can turn it back on in Config.
- **Context loss.** On `webglcontextlost` the view marks its render textures dirty and shows the top-down view (still
  black until the restore; the diagnostics banner stays). On restore it rebuilds the atlas and detail render textures.
  If the rebuild throws, it logs `console.error`, sets `failed`, and stays top-down.
- **Missing or failed atlas.** A missing atlas or one that fails to load gives a top-down flight with
  `console.error` once. Every catch logs (AGENTS.md).

## 8. Module and file-size plan

The new folder `src/scenes/exploration/mode7/` holds the modules below. Each stays under 250 lines; a new
`tests/data/mode7Ceilings.test.ts` finds every file of the folder as it lands.

| File | Role | Pixi |
|---|---|---|
| `mode7Math.ts` | camera params, `rowTable`, `screenToCell`, `cellToScreen`, horizon, split row | no |
| `mode7Tilt.ts` | the flight state machine (`off`, `tiltIn`, `flying`, `tiltOut`), easing, `tiltParams(t)` | no |
| `mode7Toggle.ts` | `mode7Enabled`, the URL parse, the low-end and frame-time rule | no |
| `GroundStrips.ts` | the row-quad `Mesh` (near and far), its UV and alpha update from the row table | yes |
| `WorldAtlas.ts` | atlas load, patch composite into the render texture, texture style, restore | yes |
| `NearDetail.ts` | the detail render texture, the window and recentring, the atlas underlay | yes |
| `FlightSky.ts` | sky gradient, haze, clouds | yes |
| `FlightBillboards.ts` | the ship, shadow, marker, parked vehicles and NPCs projected and sorted | yes |
| `FlightView.ts` | the orchestrator: activation, container, per-frame update, `busy`, `window.__mode7` | yes |

Edits outside the folder:

- `ExplorationScene.ts`, at most +8 lines: import, field, construct, `addChild`, the call in `update` and `loadMap`,
  `busy` in `fieldBusy`, `exit`.
- `StreamedChunks.ts` and `BakedMapRenderer.ts`, about +12 lines: `textureOf(i)` and an optional window override.
- `Settings.ts` and `ConfigScene.ts`, about +25 lines.
- `build_hooks.py`, +2 lines.
- `debug-scenarios.yaml`: an `# === M7 ===` anchor.
- AGENTS.md: a short "Mode 7 flight view" note.

`FlightView` gets its dependencies through an interface (game, world container, player getter, tilemap getter,
vehicles art), so the scene tests can pass a headless stub.

## 9. Tests

**Unit, no PixiJS** (`tests/scenes/mode7/`):

- `mode7Math.test.ts`:
  - `cellToScreen(screenToCell(p))` round-trips within 0.01 px over a 50x50 grid of screen points below the horizon,
    at 5 headings and 3 curvatures;
  - the ship's shadow cell equals the camera's ship cell;
  - `d` grows strictly toward the horizon, and nothing is drawn above the horizon row;
  - the flat case (`R = ∞`) matches `h / tan φ`;
  - the split row sits at `D_SPLIT`;
  - at the starting values the px per cell at the shadow row is in [90, 100].
- `mode7Tilt.test.ts`:
  - `tiltParams(0)` maps the cells within 1 px of the top-down camera at the ship and within 2 px at the view's edge;
  - `tiltParams(1)` gives the flight values;
  - the states run in order, `busy` holds only during a tilt, a cut-short tilt finishes, and a load starts in `flying`.
- `mode7Toggle.test.ts`: URL over setting over default; the low-end caps; the frame-time rule (exactly 120 frames,
  p95 > 20 ms); context-loss `failed`.
- `Settings.test.ts`: the `airshipView` default, round trip and invalid value.
- `rowTable.test.ts`: the UV table of 4 fixed views matches a stored snapshot (catches a maths change).

**Scene tests** (headless stub view):

- `tests/scenes/mode7Parity.test.ts` uses scenario-like state on the world map. It plays the same inputs with Mode 7 on
  and off: take-off, 20 steps, confirm over a forest (`CANT_LAND`), 5 steps, landing. Then it asserts equal
  `playerPosition`, `fieldMode`, `vehicles`, flags, the dialog lines and the encounter count. With Mode 7 on, input is
  ignored during the tilt frames only; the test advances past them.
- `FlightView` activation: only on `overworld` in the airship; off on a map change; off with `?mode7=0`.

**Data:** `tests/data/mode7Atlas.test.ts`:

- `mode7.json`'s `inputs` hash equals the hash of the current chunk files (a stale atlas fails);
- the atlas is 3072² and the low-end one 1536²;
- `mode7_atlas.py` run twice gives the same bytes (determinism; `PYTHONHASHSEED` 0 / 1).

**Browser checks** (Playwright, always `&mute=1`). Screenshots go to `~/temp/ff-game/mode7/<tranche>/`, never the
Desktop, and scratch scripts run from `/tmp/<agent>/`. Scenarios:

- `w_s18_start`;
- new `m7_coast` (a coast and the sea), `m7_edge` (3 cells from the world's edge), `m7_land` (over grass beside
  forest) and `m7_parked` (the ship and an NPC in view).

Each check:

1. **Pixel probes:** the top 100 rows are sky (not black, the gradient's hue); the rows under the horizon are not black
   or the placeholder colour; `?mode7=0` gives today's top-down frame.
2. **A sequence:** take-off at 0, 350 and 700 ms of the tilt, flight, then landing. Each frame is saved and
   `window.__mode7.state` logged.
3. **The landing:** `window.__mode7.shadowCell` equals `game.playerPosition`.
4. **Performance:** 600 flight frames flying north then east, reading `window.__mode7.frameP95` and `updateP95`.
5. **Context loss:** `WEBGL_lose_context.loseContext()`, then `restoreContext()`. The field comes back in Mode 7 with no
   console error other than the expected banner.

**Gates per tranche:** `npm run build`, the tranche's tests, then `npm test` (the full suite is long; run it in the
background). For the M7-2 tranche and later, `npm run quest -- --strict` and the browser check as well.

## 10. Tranches

Each tranche is a branch from `mainline`. It is mergeable on its own and stays behind the flag until M7-2 turns it on.

| Tranche | Content | Testable by | Effort |
|---|---|---|---|
| **M7-0 Pilot** | `mode7Math.ts` + tests; `mode7_atlas.py` (run by hand); `GroundStrips` far mesh only; `FlightSky`. `?mode7=pilot&scenario=w_s18_start` replaces the field with a static tilted render at the meadow (no movement, no ship). Three presets A / B / C (`θ`, `h`, `R`, horizon), chosen by `&preset=`. It measures the frame time and the atlas size | unit tests; 3 screenshots per preset in `~/temp/ff-game/mode7/pilot/`; **the user picks a preset (Q2) before M7-2** | 6 h |
| M7-1 Atlas pipeline | the `build_hooks.py` call, the low-end atlas, `mode7.json`, the staleness and determinism tests, the patch composite in `WorldAtlas` | `mode7Atlas.test.ts`; regenerating the world leaves `git diff` clean apart from the atlas | 3 h |
| M7-2 Flight | `FlightView`, `mode7Tilt` (instant switch, no tilt yet), the ship and shadow, following the hero north up, the Settings and Config toggle, `?mode7=0/1`, `mode7Toggle`, the scene integration (at most 8 lines), the parity test. Mode 7 on by default from here | parity test; browser sequence; **the user's first live test** (Q1, Q5, Q6) | 6 h |
| M7-3 Near detail | `NearDetail`, the streaming window override, the near mesh, the split and seam fade, fog | unit split test; browser probes at 3 spots; frame time; resident count <= 49 | 5 h |
| M7-4 Tilt and landing | `tiltParams`, the take-off and landing tilts, `busy` and the hold-off, the landing marker, the shadow-cell check | `mode7Tilt.test.ts`; browser sequence at 0 / 350 / 700 ms | 4 h |
| M7-5 Billboards and clouds | parked vehicles and NPCs as billboards, depth sort and culling, clouds | unit projection of billboards; `m7_parked` screenshots | 4 h |
| M7-6 Fallbacks | context loss and restore, the low-end caps, the frame-time switch, atlas failure | `mode7Toggle.test.ts`; the browser context-loss check; an atlas 404 check | 3 h |
| M7-7 Quarter turns (optional, Q1) | heading `ψ` in 90° steps, the 250 ms turn, input remapped by the heading, the compass on the HUD. It needs the back view decision (11) | unit remap; browser turns; parity test with turns | 5 h |
| M7-8 Landmark billboards (optional, Q4) | the build exports the tall decos as billboard cuts plus ground-only atlas cells; billboards; the volcano smoke | atlas tests; screenshots | 6 h |
| M7-INT | merge order 0, 1, 2, 3, 4, 5, 6 (then 7, 8 if taken); the full suite, build, strict quest, browser check; AGENTS.md (the Mode 7 note, the corrected `ExplorationScene.ts` count), `docs/PROGRESS.md`, T-1 marked done in `docs/TODO.md` | all gates of 0.1 | 2 h |

Core T-1 (M7-0 to M7-6 + INT) is about 33 h; the optional tranches add 11 h. M7-1 runs in parallel with M7-0. M7-3 and
M7-4 run in parallel after M7-2. M7-5 and M7-6 run in parallel after M7-3.

## 11. The airship back view (T-2)

**Mode 7 does not need a back view for T-1.** With north up the ship is shown from behind only while it flies north.
T-2's ruling (b_7's side view for every heading, revisit after live testing) applies. M7-0 to M7-6 ship with b_7,
facing the last horizontal direction as today.

**When it becomes needed:**

- (a) **At the M7-2 live test,** if flying north with the side view reads wrong to the user (Q5). Then T-2 comes back
  with its planned next try: 3/4 views traced from b_7's outline.
- (b) **Before M7-7 merges** (quarter turns). There the ship flies away from the camera nearly all the time, so a back
  view is needed.

A code-only stopgap to show the user at M7-2: while moving north or south, squash b_7 horizontally to about 60 % (an
end-on hint) over 150 ms. This is a knob, off by default.

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Flattened 3/4-view landmark art looks squashed or smeared at a low pitch | the pilot's presets; Q4 and M7-8 billboards |
| R2 | Shimmer or blur near the horizon | mips plus anisotropy plus fog; the SNES nearest look is a switch (Q7) |
| R3 | A visible seam between the near and far meshes | an 8-row cross-fade; the atlas underlay in the detail render texture; screenshots at 3 spots |
| R4 | A stale atlas after a world recompile (pass W tranches recompile often) | the build hook plus the staleness test |
| R5 | Pixi 8 Mesh API details (a dynamic UV buffer, vertex alpha) | the pilot proves them first; the fallback is many 1-row `Sprite`s with a `Texture` frame (slower, same maths) |
| R6 | Render textures lost on a context loss | the rebuild on restore; the top-down fallback |
| R7 | GPU memory on a weaker machine (~90 MB more) | the low-end atlas and window; the frame-time switch; the Config toggle |
| R8 | The landing feels laggy (a 700 ms tilt after the confirm) | a short tilt; the hero is already landed in the rules; Q10 |
| R9 | `ExplorationScene.ts` ceiling (545 / 590) | the integration is capped at 8 lines; everything else lives in the folder |
| R10 | Chunk streaming cannot keep up at the boosted 20 cells/s | the atlas underlay hides a missing chunk; the browser check at the boosted speed |
| R11 | Unit tests touch PixiJS | the maths, tilt and toggle modules import no Pixi; the scene tests use the stub view |
| R12 | Perceived speed feels slow | Q6; it is a view-only knob only if the user wants it |

## 13. Open questions for the user

1. **Q1 Camera.** North up with the classic 4-way moves (recommended), or quarter turns with left and right (M7-7,
   needs a back view)? Free FF6-style rotation is rejected because it breaks the grid.
2. **Q2 Look.** Which pilot preset (pitch, altitude, curvature, horizon height) after M7-0's screenshots? Is the FF6
   look (a straight horizon, the land curving away) enough, or do you want an arced horizon (the shader route A)?
3. **Q3 Default.** Should Mode 7 be on by default, with Top-down in Config? (recommended: on)
4. **Q4 Landmarks.** Are flattened towns and landmarks fine for T-1, or do you want tall ones as upright billboards
   (M7-8)?
5. **Q5 Ship art.** Is b_7's side view acceptable while flying north in Mode 7 (judge at M7-2)? Should I try the squash
   stopgap? Bring T-2 back now or later?
6. **Q6 Speed.** Keep 10 cells/s in flight, or a faster flight in Mode 7 only?
7. **Q7 Filtering.** Smooth distance (mips and fog, recommended) or the crisp shimmering SNES look?
8. **Q8 Clouds.** Are code-drawn clouds in the sky band enough? Do you also want cloud shadows sliding over the land?
9. **Q9 Landing marker.** Show an outline on the cell under the ship when it can land?
10. **Q10 Tilt time.** Is 700 ms for the tilt in and out right, or shorter?

## TODOs

- [ ] Momus review of this plan (priority: high, effort: 1 h)
- [ ] User answers Q1, Q3, Q4, Q7 before M7-0 (priority: high)
- [ ] M7-0 pilot (priority: high, effort: 6 h)
- [ ] User picks a preset (Q2) (priority: high)
- [ ] M7-1 atlas pipeline (priority: high, effort: 3 h)
- [ ] M7-2 flight (priority: high, effort: 6 h)
- [ ] User live test (Q5, Q6) (priority: high)
- [ ] M7-3 near detail (priority: high, effort: 5 h)
- [ ] M7-4 tilt and landing (priority: high, effort: 4 h)
- [ ] M7-5 billboards and clouds (priority: medium, effort: 4 h)
- [ ] M7-6 fallbacks (priority: high, effort: 3 h)
- [ ] M7-7 quarter turns (optional; priority: low, effort: 5 h)
- [ ] M7-8 landmark billboards (optional; priority: low, effort: 6 h)
- [ ] M7-INT (priority: high, effort: 2 h)

# Airship front and back views (T-2), rev 2

Status: **implemented (pass AV, 2026-11-22); the result is in section 12.** Rev 2 by PA (planner); Momus reviewed rev 1
(3 of 5) and rev 2 (OKAY, 4 of 5). This copy fixes D-AV10's wording (momus's implementation note 4). The facts in section 1 were checked at `08b9a35d`.
The art exploration used 18 of the 30 `ar_airship` Bedrock calls; 12 remain for the implementer. No call was made
for rev 2.
Source: the user's feedback of 2026-11-22 ("airship does not have any view for flying 'away' or 'towards' the
camera"); `docs/TODO.md` T-2; `docs/MODE7_PLAN.md` 11 (the back view) and Q5.
The review material is in `~/temp/ff-game/airship_views/` (section 2). The scratch scripts that made it are in
`scripts/` there.

**Rulings closed (integrator, 2026-11-22):** R1-R6 take the defaults of rev 1, now recorded in section 11. Under R6
the implementer self-approves the art and records it in each approved json's `review` field and in the AV-INT report.

**Sequencing:** AV lands **before** the world-wrap pass. After AV, `FlightView.ts` is 248 lines. World wrap rebases
on AV and budgets `FlightView.ts` against 248.

## Momus fixes (rev 1 -> rev 2)

| # | Item | Resolution |
|---|---|---|
| 1 | `vehicleArt()` builds textures only for `VEHICLE_FRAMES`, so the new frames would never load | `vehicleArt()` also builds `OPTIONAL_VEHICLE_FRAMES` that are present in the json (5.1). There is a new test: the real `vehicles.json` gives `art.frames.airship_back` (7) |
| 2 | `keel_x` gives the back 0.179 and the front 0.589 (a stray line under the nose) against b_7's 0.4167: the ship would jump on every turn | An explicit anchor rule for the optional frames: the **centroid rule** (4.1). Every frame's whole-mask x centroid sits `D7` = 13.80 native px ahead of its foot point in the facing direction, exactly as b_7's does. The cutter writes `anchor` into SPEC and the json, and `vehicles.py` uses it. The `patch` step erases the front's stray rows. Gates: the visual-centre gate (N = 1 native px, every frame and its mirror) and the shadow gate (4.3) |
| 3 | `FieldVehicles.ts` is pinned strictly under 250 lines (`questCeilings.test.ts:34`, `:54`) | The `fieldStateOf` extraction is a **required** AV-2 step: it moves to a new `src/scenes/exploration/fieldState.ts`, and `FieldNpcActions.ts:13` imports from there (no re-export). `questCeilings` is in AV-2's gates. Section 8 is corrected |
| 4 | `__mode7.ship` cannot be tested through `flightHarness` (it `vi.mock`s `FlightRenderer`; scene tests have no vehicle sheet) | Route (b). `FlightRenderer` gets a `shipPick` getter (the billboards' last pick). `FlightView` copies it inside `measure()`'s existing `Object.assign(this.report, ...)` on an existing line, so no lines are added. Scene tests assert `stub.last.ship.heading`; the frame and flip pick is tested in `flightBillboards.test.ts` (7) |
| 5 | `FlightBillboards` loader | `constructor(private readonly load = defaultLoad)`, as in `FieldVehicleSprites`. Its test feeds the real json with a fake `TextureSource`, as in `fieldVehicleArt.test.ts`'s `rig()` (5.2, 7) |
| 6 | The tilt t 0 check | It goes in `mode7TiltScene.test.ts`: at the first tilt frame, `stub.last.ship.heading` equals `vehicles.airshipHeading()`. Success criterion 4 is reworded (0.1) |
| 7 | Boarding | One rule (D-AV10): the heading changes only when the hero's direction changes or a step starts. Boarding keeps the parked heading. No turn frame can play during the take-off tilt (input is held and the hero is idle). The first step after the tilt may play one. Tested (7) |
| 8 | `VehicleView` | `frame` returns the current frame. The `drawShadow` cache key becomes (pose, frame name). `VehicleSheetMeta.sources` widens to the optional names. `fieldVehicleArt.test.ts:66` (`toEqual`) and `:111` (the ship keeps its facing on up and down) are named in 7 |
| 9 | Sizes | One set (D-AV3, table): the cutter's canvases and the cropped sheet frames. The width check has a tolerance of +-3 px |
| 10 | One clock | `noteHeading()` takes no arguments. It reads the ridden player and the sprites' injected clock (`now`) |
| O1 | Pixi 8 `onRender` runs on hidden containers too | Corrected (5.3, AR4). `follow()` keeps the heading current in flight. `FlightView` still calls `noteHeading()` at the start of `frame()`, so the frame it draws has this tick's heading, whatever the order of render callbacks |
| O2 | Mid-turn screenshots | The browser polls `__mode7.ship.turning` in `requestAnimationFrame` and takes the shot on the first true frame. No dev URL key (7) |
| O3 | `av_flight` | `entrance: cornelia_north` (146, 150) (6) |
| O4 | Re-render tooling | `proxy3d.py`, `mkinputs2.py` and `gen.py` run from `/tmp/<agent>/` against the main checkout's `gen.bedrock`. The guides' sha256 values are in 2 (4.4) |
| O5 | Cutter tie-break | Palette snap takes the first `argmin` index. The cut reuses `gen.pixelize.flood_bg` and `components` (4.1) |
| O6 | Prompt wording | b_7 has two short **black smokestacks**; rev 1's prompt said "brass funnels". A re-render uses b_7's wording (4.4) |

## 0. Summary

The airship gets two new headings of art, matched to the approved side view b_7 (LM2):

- **back 3/4**: the ship seen from above and behind, flying away;
- **front 3/4**: the ship seen from above and in front, flying toward the viewer.

Each view is drawn with its nose to the right and mirrored for the left, like b_7. Two optional turn frames sit
between the side and an end view. The top-down field and the Mode 7 flight view both pick the frame with one pure
function: up shows the back view, down shows the front view, left and right show the side view. Mode 7 is north-up and
4-way, so up is away from the camera there.

It is a view only. Movement, the field rules, landing (`canLand`, `CANT_LAND`), encounters, the save and the verifier
do not change.

### 0.1 Success criteria

```json
{
  "functional": [
    "Flying the airship up (north) shows the back 3/4 frame, down shows the front 3/4 frame, and left / right show b_7, in both the top-down field and Mode 7",
    "The end views lean toward the last horizontal facing: after flying right, up shows the nose to the upper right; after flying left, the same frame is mirrored",
    "Turning between the side and an end view with the same lean shows the turn frame for TURN_MS (100 ms), then the target frame; every other change is instant",
    "A landed airship keeps the heading it landed with; boarding keeps it until the hero's direction changes or a step starts",
    "Turning keeps the ship's visual centre in place: every frame's mask centroid is within 1 native px of b_7's, measured from the foot point at the same facing",
    "A vehicles sheet without the new frames (an old build) still parses, and the airship shows b_7 for every heading"
  ],
  "observable": [
    "Browser screenshots in ~/temp/ff-game/airship_views/<tranche>/: top-down and Mode 7, each of the 4 headings, mid-turn, and the take-off and landing tilts at t 0 / 0.5 / 1 flying north",
    "window.__mode7.ship reports {frame, flip, turning, end, side}"
  ],
  "pass_fail": [
    "npm run build and npm run test:fast pass, plus the touched tests (questCeilings among them)",
    "python3 -I assets-src/gen/vehicle_view_cut.py --check passes, and build_assets.py vehicles leaves git diff clean after a rebuild",
    "git diff mainline -- src/progression src/systems/fieldRules*.ts assets/data/quest.yaml is empty",
    "mode7TiltScene.test.ts: at the first frame of the take-off and landing tilts, stub.last.ship.heading equals vehicles.airshipHeading() (back heading included), and mode7Tilt.test.ts still passes"
  ]
}
```

### 0.2 Decisions

| # | Decision | Why |
|---|---|---|
| D-AV1 | The end views are **3/4 views**: elevation 25 deg, yaw 30 deg off the stern (back) or the bow (front), turned toward the last horizontal facing. They are not straight end-on views | Straight end-on views read as round balloons (LM3, and again here: `3_mode7_views.png`, bottom row). At 3/4 the hull's side, the sail and the envelope's length show. The Mode 7 camera sees the ship from about 28 deg above (h 6 over `back` 11.3), so 25 deg fits it and the top-down field too |
| D-AV2 | The art comes from a **pseudo-3D proxy of b_7**, a code render, restyled by Bedrock `style_transfer` with b_7's raw render as the style image (`change_strength` 0.6, `composition_fidelity` 0.9, `style_strength` 1.0) | The proxy fixes the geometry: the same envelope, hull, cabin, sail and pipe as b_7, at the chosen angle. The style transfer brings back b_7's rivets, seams and palette. Text prompts, style_guide and control_sketch on hand-drawn outlines (LM3) never got the geometry |
| D-AV3 | Native scale = b_7's scale: one native px is the same world size. Sizes are in the table below | The ship keeps its size when it turns. An end view is narrower because it is foreshortened, not because it is smaller (R3) |
| D-AV4 | One pure heading module, `airshipHeading.ts`. One owner of the heading state: `FieldVehicleSprites` | The tilt's t 0 match needs the field and the flight view to draw the same frame. Today each keeps its own `facing` (`FieldVehicleSprites.facing`, `FlightView.facing`) |
| D-AV5 | The turn frame plays only between the side view and an end view that lean the same way. Left to right flips at once (as today), and up to down swaps at once | A U-turn through the side would be 3 frames (300 ms) for one key press. A flip has no in-between art |
| D-AV6 | A parked airship keeps the heading it landed with, for the session. A map load or save load starts with the side view facing right (as today) | There is no snap at the end of the landing tilt, and nothing is added to the save |
| D-AV7 | The new frames are optional in the sheet contract (`OPTIONAL_VEHICLE_FRAMES`), loaded when present. A missing frame falls back to b_7 | A stale sheet, or a missing approved file, must never blank the ship |
| D-AV8 | The shadow is sized from the drawn frame: w 0.6 of the frame width, h 8 for the side and h 10 for the ends. It is centred on the foot point. The landing marker does not change | The shadow follows the hull's footprint. The marker is the landing cell, not the ship |
| D-AV9 | The approved art is `assets-src/gen/approved/vehicles/airship_{back,front,back_turn,front_turn}.{png,json}`, re-cut offline from the render cache by `vehicle_view_cut.py` (with `--check`). No call is made at build time | This is the repo's pattern (`landmark_cut.py`, `npc_field_cut.py`) |
| D-AV10 | **Boarding and steps.** The heading takes the hero's direction only when it differs from the direction seen last frame, or when a step starts (`isMoving` goes false to true). `ride()` seeds the last-seen direction and the moving flag from the hero, so boarding keeps the parked heading | Boarding is a confirm while standing on the airship's cell (`FieldVehicles.confirm`), so the hero's facing says how they walked onto it, not where the ship points. Taking it would snap the parked ship at the take-off tilt's t 0 |

**Sizes (D-AV3).** The cutter writes a canvas with a 1 px clear margin. `vehicles.py` crops to the drawn box. Checks
allow +-3 px.

| Frame | Render | Cutter canvas | Sheet frame (cropped) |
|---|---|---|---|
| `airship` (b_7, unchanged) | LM2 `airship_ultra_b_7` | 192x96 | 147x94 |
| `airship_back` | `back25y30_st0.6_5` | 89x114 | 87x112 |
| `airship_front` | `front25y30_st0.6_3` | 89x114, then 89x112 after the `patch` | 87x110 |
| `airship_back_turn` | `back30y55_st0.6_7` | 128x104 | 126x102 |
| `airship_front_turn` | `front30y125_st0.6_7` | 128x105 | 126x103 |

## 1. Facts (checked at `08b9a35d`)

- `assets-src/gen/approved/vehicles/airship.png` is 192x96 RGBA, with its drawn box at (23, 1, 170, 95). Its json
  says `mirrored: true` and `faces: right`. The raw render is `assets-src/gen/cache/69e3567ec103ea54407cc0e7.png`
  (1216x832, bow to the left; sha256 `c6f44cebed3f75d3`...).
- `assets-src/vehicles.py` (188 lines): `ORDER = ("ship", "airship", "canoe")`. Each frame is cropped to its drawn
  box, with `anchor = [keel_x, 1.0]` (`keel_x` = the x centroid of the bottom 6 drawn rows) and `footRow = h - 1`.
  The airship frame is 147x94, anchor 0.4167. b_7's whole-mask x centroid is 75.05 px, 13.80 px ahead of its keel
  anchor (61.25 px).
- `src/scenes/exploration/vehicleLayout.ts` (108 lines): `VEHICLE_FRAMES` is the required list checked by
  `parseVehicleMeta`; `VehicleSheetMeta.sources?: Partial<Record<VehicleType, ...>>`; `AIRSHIP_LIFT` 10;
  `airshipShadow(hullW, pose)` (ridden: w = 0.6 hullW, h 8, alpha 0.3); `nativeScale` = TILE_SIZE / 48.
- `src/scenes/exploration/FieldVehicleSprites.ts` (179 lines): `vehicleArt()` (lines 17-26) loops over
  `VEHICLE_FRAMES` only. `facing: Partial<Record<VehicleType, Facing>>` is set in `follow()` from
  `player.direction` when that is left or right. `placeParked` uses it. The constructor takes `(world, now, load)`.
- `src/scenes/exploration/FieldVehicleView.ts` (141 lines): `VehicleView` draws `art.frames[type]`; `get frame()`
  returns `art.frames[type].frame`; `drawShadow` rebuilds only when `shadowPose !== p.pose`; `place()` mirrors by
  `facing`.
- `src/scenes/exploration/mode7/FlightView.ts` (**249 lines**): `private facing` (line 62) is set in `frame()`
  (line 199) and passed as `ship.facing` (line 228). `measure()` has `Object.assign(this.report, {...})` at line
  239. `FlightViewDeps.vehicles: FieldVehicles`.
- `src/scenes/exploration/mode7/FlightBillboards.ts` (98 lines): `ShipDraw {x, footY, facing, tMs, sinceBoard}`.
  `load()` calls `defaultLoad()` directly, with no injection. The shadow ellipse is built once from the hull width.
- `src/scenes/exploration/FieldVehicles.ts` (**247 lines**) owns the private `sprites`. `fieldStateOf` (lines
  239-247, 9 lines with its doc comment) is exported and imported by `FieldNpcActions.ts:13`.
  `tests/data/questCeilings.test.ts` lists `FieldVehicles.ts` and `FieldNpcActions.ts` (line 34) and asserts
  `< 250` (line 54).
- `ExplorationScene.ts` is 556 / 590 lines. This plan adds 0 lines to it.
- `tests/scenes/mode7/flightHarness.ts`: `vi.mock`s `FlightRenderer.js` with a stub that keeps `stub.last` (the last
  `FlightFrame`). Scene tests load no vehicle sheet.
- `tests/scenes/fieldVehicleArt.test.ts`: `rig()` loads the real `vehicles.json` with a fake `TextureSource` (lines
  36-49); line 66 is `expect(META.sources).toEqual({ship, airship, canoe: 'approved'})`; line 111 is "the ridden
  vehicle mirrors by facing and keeps its facing on up and down" (with the ship).
- Mode 7: `SHIP_FOOT_Y` 750, the ship at screen x 960, k = 2 screen px per native px. The FLIGHT view has h 6, theta
  18 deg, f 1200, back 11.3. The camera looks north and does not rotate (D-M2).
- The scenario `m7_parked` (debug-scenarios.yaml line 2963) starts in flight at Pravoka's gate. Scenarios have no
  facing key. The world entrance `cornelia_north` is (146, 150).

## 2. The art outcome (PA's exploration)

Files in `~/temp/ff-game/airship_views/`:

| File | What |
|---|---|
| `1_topdown_headings.png` | Game scale (x2) on the field: side, back 3/4 and front 3/4 facing right, then the same mirrored |
| `2_turn_inbetweens.png` | side -> 55 deg -> back, side -> 125 deg -> front |
| `3_mode7_views.png`, `3a_`, `3b_` | Mode 7 mock-ups (rendered from the real `mode7.png` with the FLIGHT projection): b_7 today, the back pick, the front pick, the mirrored back, and the straight end-on alternatives |
| `4_pipeline.png` | b_7, the pseudo-3D proxy, the Bedrock style transfer, and the native cut x4 |
| `5_all_bedrock_results.png` | all 18 renders |
| `native/`, `raw/`, `proxy/`, `scripts/` | the native cuts (rev 1's centring, before the anchor rule), the raw renders with their request json, the proxy guides, and the scratch code |

**Methods tried** (18 calls, `ar_airship`, pass AR):

| Method | Calls | Result |
|---|---|---|
| `style_transfer` (init = proxy, style = b_7 raw) | 14 | **Best.** It keeps the proxy's geometry and b_7's look: cream gored envelope with rivets, brass nose ring, wooden hull, cabin, curled pipe, sail |
| `control_structure` on the proxy | 2 | A grey background, and new brass bands that are not on b_7. Rejected |
| `sd35` image-to-image (strength 0.55) | 2 | Stays close to the flat proxy, with no added detail. Rejected |

The geometry was tried at yaw 0 / 20 / 30 and elevation 30 / 25. At yaw 0 (end-on) the ship still reads as an egg
over a canoe. At yaw 30 it reads as an airship.

**The picks** (guide sha256 = the first 16 hex of the proxy PNG sent as `init_image`):

| Frame | Render | Cache key | Guide sha256 |
|---|---|---|---|
| `airship_back` | `back25y30_st0.6_5` (seed 5) | `e03e5bc87c625a567d09ace8` | `9726f1102a3fcf84` |
| `airship_front` | `front25y30_st0.6_3` (seed 3) | `efeb5e6230239d65a2999489` | `6506120813c6e59d` |
| `airship_back_turn` (optional) | `back30y55_st0.6_7` | `7bb4c02c37860344add12272` | `9cbe44a0e40dfe5e` |
| `airship_front_turn` (optional) | `front30y125_st0.6_7` | `8a1a3e1e1ae4fb54e81e6f14` | `b410a58a3e11a981` |
| alternatives | `back25y30_st0.6_3` `7d64d68fee432713e9584c01`; `front25y30_st0.6_7` `b4b3ba81e6a0b06ccca5c97f` | | `9726f...` / `65061...` |

**Honest assessment.** For the first time these read as this airship flying away and flying toward the viewer. They
are not end-on balloons. In Mode 7 the back view shows a ship heading into the distance, and the four headings look
like one ship turning. They are good enough to build on, but not yet as crisp as b_7:

- (a) The native cuts are softer than b_7: thinner seams, less cream highlight, a slightly muddy brown hull.
- (b) The back view's sail is small and dark.
- (c) The front pick's envelope has a faint brown band that b_7 does not have.
- (d) The styled renders dropped b_7's two black smokestacks.
- (e) The front has a 1 px plumb line under its nose (2 rows), which the `patch` removes.

My scores, by the LM3 scale: front 4/5, back 3.5/5, turn frames 3.5/5. AV-1 has a cleanup step for (a)-(c) and (e),
and up to 6 more calls if the offline edits do not fix (b).

## 3. Heading model (`src/scenes/exploration/airshipHeading.ts`, new, pure, under 100 lines)

```ts
export type HeadingEnd = 'side' | 'back' | 'front';
export interface AirshipHeading {
  end: HeadingEnd; side: 'left' | 'right';
  turnFrom: HeadingEnd | null; turnAt: number;
  /** D-AV10: the hero's direction and moving flag seen last frame. */
  seenDir: Direction; seenMoving: boolean;
}
export const SIDE_RIGHT: Omit<AirshipHeading, 'seenDir' | 'seenMoving'>;  // {end: 'side', side: 'right', turnFrom: null, turnAt: 0}
export const TURN_MS = 100;
/** Start riding: keep the parked heading, and seed what was seen from the hero (boarding changes nothing). */
export function boardHeading(parked: AirshipHeading | null, dir: Direction, moving: boolean): AirshipHeading;
/** One frame: take `dir` only if it differs from `seenDir`, or a step starts (`moving && !seenMoving`). */
export function nextHeading(h: AirshipHeading, dir: Direction, moving: boolean, nowMs: number): AirshipHeading;
/** The frame to draw and its mirror. `has` says which frames the sheet holds (a missing one falls back). */
export function headingFrame(h: AirshipHeading, nowMs: number, has: (f: string) => boolean):
  { frame: 'airship' | 'airship_back' | 'airship_front' | 'airship_back_turn' | 'airship_front_turn';
    flip: boolean; turning: boolean };
```

The mapping. Mode 7 is north-up, so the same table serves both views.

| Hero direction (taken) | end | side | frame | flip |
|---|---|---|---|---|
| right | side | right | `airship` | no |
| left | side | left | `airship` | yes |
| up | back | kept | `airship_back` | when side = left |
| down | front | kept | `airship_front` | when side = left |

The transitions (D-AV5):

- `end` changes between `side` and `back` (or `front`) with the same `side`. Draw `airship_back_turn` (or
  `_front_turn`) while `nowMs - turnAt < TURN_MS`, then the target.
- `side` flips (left / right), or `end` goes from back to front. The change is instant: `turnFrom` is null.
- A direction already taken changes nothing, and `turnAt` is kept.
- A missing turn frame gives an instant swap. A missing end frame gives `airship` with the heading's flip.

**The tilts.** A take-off starts on a confirm with the hero idle, and the 700 ms tilt holds input. The hero stays
idle, so `nextHeading` takes nothing: **no turn frame can play during the take-off tilt**. The landing tilt is the
same. If the first step after a take-off changes the end, its turn frame plays then.

## 4. Assets: the cutter, the approved files, the sheet

### 4.1 `assets-src/gen/vehicle_view_cut.py` (new, under 230 lines)

```
python3 -I assets-src/gen/vehicle_view_cut.py               # write approved/vehicles/airship_{back,front,back_turn,front_turn}.{png,json}
python3 -I assets-src/gen/vehicle_view_cut.py --check       # rebuild in memory; exit 1 if a committed file differs or a gate fails
python3 -I assets-src/gen/vehicle_view_cut.py --review DIR  # x4 strips, the top-down lineup, the Mode 7 mock-ups
```

- `SPEC`: frame -> {key, width, edits, anchor}. The widths are 89 / 89 / 128 / 128 (canvas; section 0.2 table), and
  the keys are in section 2. Each key must be a `result ok` row of purpose `ar_airship` in
  `cache/bedrock_ledger.jsonl`. A missing cache PNG is an error: the renders are not tracked, so copy them from the
  main checkout into a worktree.
- **The cut**, ported from `~/temp/ff-game/airship_views/scripts/pixtool.py` and `pixmock2.py`:
  1. flood the white background with `gen.pixelize.flood_bg` (tolerance 30);
  2. keep the `gen.pixelize.components` of at least 3 % of the largest, and drop the enclosed near-white pockets
     (min channel > 236, spread < 14) of 150 px or more;
  3. match the colour mean and spread to b_7's opaque pixels, per channel;
  4. premultiplied BOX downsample to `width`;
  5. unsharp mask (1, 72, 2);
  6. snap to b_7's exact colour set, taking the nearest colour (`argmin`, so a tie takes the first palette index;
     the palette is `np.unique` order, which is deterministic);
  7. alpha > 110 -> opaque (binary alpha);
  8. 1 px outline in b_7's darkest colour.
  There is no k-means and no hash order.
- **Cleanup edits** (AV-1; for 2 (a)-(c), (e)). These are offline steps per frame, in the `npc_field_edit.py` style:
  - `patch`: for the front and front turn frames, erase every opaque pixel below the lowest row that has at least 5
    opaque pixels (the plumb line; the front loses its 2 bottom rows). Also small pixel patches (the back's sail edge),
    at most 120 px per frame;
  - `seam_boost`: on the envelope (cream mask), pixels darker than their two neighbours across a seam take b_7's seam
    brown;
  - `highlight`: the top-left 25 % of the envelope's lit side moves one ramp step lighter;
  - `recolor`: the front's envelope band goes from brown to the cream ramp.
  `--check` covers them.
- **The anchor rule (the centroid rule).** `D7` = b_7's whole-mask x centroid minus its keel anchor, in native px,
  measured from the approved `airship.png` at cut time (13.80 today). For each optional frame, after the edits:
  `anchor_x = (centroid_x - D7) / w`, rounded to 4 places, and `anchor_y = 1.0`. A mirrored frame flips about its
  anchor, so its centre sits D7 behind, exactly like b_7 mirrored. This keeps the ship's visual centre still when it
  turns between the side and an end view. The values with today's cuts:

  | Frame | w | Centroid x | Anchor | Shadow span (0.6 w) | Bottom-third mask x |
  |---|---|---|---|---|---|
  | `airship_back` | 87 | 41.63 | 0.3199 | 1.7-53.9 | 0-57 |
  | `airship_front` | 87 | 41.16 | 0.3145 | 1.3-53.5 | 3-85 |
  | `airship_back_turn` | 126 | 62.93 | 0.3899 | 11.3-86.9 | 0-94 |
  | `airship_front_turn` | 126 | 62.91 | 0.3898 | 11.3-86.9 | 6-123 |

  The anchor goes into SPEC (as computed, for review) and into the json (`anchor`). `vehicles.py` reads it.
- The json per frame follows `airship.json`: `vehicle`, `pass: AR`, `view`, `cache_key`, `model`, `seed`,
  `purpose: ar_airship`, `proxy` ({yaw, elevation, guide_sha256}), `cut_settings`, `native_size`, `anchor`, `d7`,
  `faces: right`, `approved` (date), and `review`: "self-approved by the AV-1 implementer under the integrator's R6
  ruling (2026-11-22); review sheet airship_views/av1/; the user may veto (T-2 reopens)".
- **Gates** (in `--check` and the selftest):
  - *visual centre*: for every frame (b_7 included) at both facings, `|(centroid_x - anchor_x * w) - D7| <= 1` native
    px (mirrored: `-D7`);
  - *shadow under the ship*: the anchor lies inside the bottom-third mask's x range with at least 10 px to spare
    on each side, and at least 60 % of the shadow span (anchor +- 0.3 w) lies over that range;
  - *size*: each sheet frame is within +-3 px of the section 0.2 table;
  - the usual: binary alpha, colours a subset of b_7's, the outline closed.
- Selftest `assets-src/gen/selftest_vehicle_view.py`: a synthetic render runs through the cut and the gates (an
  off-centre synthetic anchor must fail the visual-centre gate); `--check` passes on a clean tree; the output is
  equal under PYTHONHASHSEED 0 / 1.

### 4.2 `assets-src/vehicles.py` (+about 22 lines, under 250)

- `OPTIONAL = ("airship_back", "airship_front", "airship_back_turn", "airship_front_turn")`. Each is read only from
  `APPROVED/<name>.png`, with its json, and there is no code-drawn fallback. A missing one prints `vehicles: no
  approved <name>; the airship uses its side view for that heading` and is left out of the sheet.
- The anchor of an optional frame is its json's `anchor` (x, then 1.0), shifted for the crop: the json anchor is
  stated in the cropped frame (the cutter measures after the same crop). `footRow = h - 1`. `sources[name] =
  "approved"`.
- The packing order: `ORDER`, then the optional frames that exist. The sheet grows from about 508 px wide to about
  950 px wide (one row, h 112 instead of 94). The json `version` stays 2: the frames are additive.

### 4.3 `vehicleLayout.ts`

- `OPTIONAL_VEHICLE_FRAMES = ['airship_back', 'airship_front', 'airship_back_turn', 'airship_front_turn'] as const`.
  `parseVehicleMeta` checks an optional frame's shape only when it is present.
- `VehicleSheetMeta.sources?: Partial<Record<VehicleType | OptionalVehicleFrame, 'approved' | 'code'>>`.
- `airshipShadow(hullW, pose, end: HeadingEnd = 'side')`: h 10 when ridden with an end view. Parked stays as today.

### 4.4 Re-render tooling (only if AV-1 spends calls)

- Copy `~/temp/ff-game/airship_views/scripts/` to `/tmp/<agent>/`. `proxy3d.py` (the b_7 proxy) and `mkinputs2.py`
  (the guides; deterministic, numpy and Pillow only) run there. `gen.py` imports the **main checkout's**
  `assets-src/gen/bedrock.py` (its `sys.path` line), so the gate, the cache and the ledger are the main checkout's.
  Run the call from the main checkout's environment, and edit no tracked file there.
- Check the guide's sha256 against section 2 before a call. If it differs, the proxy code changed, and the request
  is a new one.
- Fix the prompt to b_7's wording: "two short black smokestacks on deck" (rev 1 said "brass funnels"). This changes
  the cache key, so it applies only to new renders.
- At most 6 calls in AV-1, leaving at least 6 in the purpose.

## 5. Runtime wiring

### 5.1 Files

| File | Change | Lines after |
|---|---|---|
| `airshipHeading.ts` (new) | section 3 | under 100 |
| `vehicleLayout.ts` | 4.3 | about 122 |
| `FieldVehicleSprites.ts` | `vehicleArt()` also builds each `OPTIONAL_VEHICLE_FRAMES` entry present in `meta.frames` (+3). `facing.airship` becomes `airshipHeading` (ship and canoe keep `facing`). `ride('airship')` calls `boardHeading(parkedHeading, player.direction, player.isMoving)`. `noteHeading()`: no-op unless riding the airship; else `nextHeading(h, ridden.player.direction, ridden.player.isMoving, this.now())`. `follow()` calls `noteHeading()`. `placeParked` and `follow` pass `headingFrame(h, this.now(), (f) => !!this.art?.frames[f])`. Getter `heading(): AirshipHeading` | about 198 |
| `FieldVehicleView.ts` | `place()` takes an optional `frame` (default `type`). When it differs from the current one, `dress()` swaps the texture and anchor. `get frame()` returns the **current** frame's record. `drawShadow` caches on (pose, frame name) and passes `end` | about 156 |
| `fieldState.ts` (new) | `fieldStateOf` moved verbatim from `FieldVehicles.ts` (with its imports) | about 16 |
| `FieldVehicles.ts` | **Required:** remove `fieldStateOf` (-9), import it from `./fieldState.js` (+1 net, merged into the existing import block where possible). Add `airshipHeading()` and `noteHeading()` forwards (+6) | about 245, under 250 |
| `FieldNpcActions.ts` | line 13: `import { fieldStateOf } from './fieldState.js';` (no re-export from `FieldVehicles.ts`) | unchanged count |
| `mode7/FlightView.ts` | Remove `private facing` (line 62, -1). Line 199 becomes `this.deps.vehicles.noteHeading();`. Line 228: `facing: this.facing` becomes `heading: this.deps.vehicles.airshipHeading()` on the same line (95 -> about 114 columns, no new line). Line 239's `Object.assign` takes `ship: this.renderer?.shipPick ?? null` on its existing `gl: ..., samples: s.samples,` line | **248** |
| `mode7/FlightBillboards.ts` | `constructor(private readonly load: () => Promise<[unknown, Texture]> = defaultLoad)`; `load()` uses `this.load()`. `ShipDraw.facing` becomes `ShipDraw.heading`. `draw()` calls `headingFrame`, then `ship.place({frame, facing: flip ? 'left' : 'right', ...})`, and keeps `lastPick = {frame, flip, turning, end, side}`. The flight shadow ellipse is rebuilt when (frame name, end) changes | about 112 |
| `mode7/FlightRenderer.ts` | `get shipPick()` returns the billboards' `lastPick`, or null | +2 |
| `ExplorationScene.ts` | none | 0 |

### 5.2 The flight sheet

`FlightRenderer` creates `new FlightBillboards()` with the default loader. The heading frames come with the same
sheet, through `vehicleArt()` (fix 1), so the flight loads them with no other change.

### 5.3 One owner, two feeders

The heading lives in `FieldVehicleSprites` and changes only through `noteHeading()` (D-AV4, D-AV10). It reads the
ridden player and the sprites' injected clock (fix 10). In Pixi 8 `onRender` also runs for hidden containers, so the
ridden view's `follow()` keeps the heading current while Mode 7 hides the top-down `world`. `FlightView.frame()`
still calls `noteHeading()` first, so the frame it builds carries this tick's heading, whatever the order of render
callbacks. `nextHeading` is idempotent within a frame: a second call sees the same direction and moving flag, and
takes nothing.

### 5.4 Tilts, billboards, shadow, turn timing

- **Take-off and landing tilts.** The heading cannot change during a tilt (3, "The tilts"). At t 0 the flight ship is
  drawn from the same heading as the field's view, so the frame matches. `mode7TiltScene.test.ts` checks it. Landing
  hands over at t 1 to the parked view, which keeps the heading (D-AV6).
- **Billboards.** No change to the sort: the ship stays at `depth + SHIP_Z`. The end frames are about 18 native px
  taller (112 vs 94), so a prop in front of the ship covers more of it, which is correct (ground depth decides).
- **Shadow and marker.** The shadow is centred on the foot point, which the anchor rule puts under the hull (4.1
  gate), with w 0.6 of the frame width and h 8 / 10. The marker stays the cell outline. The `shadowCell` check is
  untouched.
- **Turn timing.** `TURN_MS` 100 counts on the sprites' clock in both views. The walk-speed boost does not change it.
- **Parked in Mode 7.** The parked airship is still not a billboard (`propMath.isParkedPart` excludes
  `vehicle:airship`), so it is unchanged.

## 6. Preview scenarios (`assets/data/debug-scenarios.yaml`)

- `av_headings`: on foot at `entrance: cornelia_north` (146, 150), the airship parked on the meadow beside it at a
  grass spot from `tests/helpers/worldSpots.ts` (or `a1_s_airship`), `AIRSHIP_RAISED` set. Board it and fly 4 ways.
- `av_flight`: `m7_parked`'s party and flags with `fieldMode: airship` at `entrance: cornelia_north` (146, 150), over
  the meadow, so the end views read against grass.
- Top-down checks use `?mode7=0` on the same scenarios. No new scenario keys are needed: the browser presses the keys.

## 7. Tests

| Test | What |
|---|---|
| `tests/scenes/airshipHeading.test.ts` (new) | the mapping table (4 directions x 2 sides); the turn frame shows for [0, 100) ms, then the target; left / right flips and back / front swaps are instant; a direction already taken keeps `turnAt`; D-AV10: `boardHeading` keeps the parked heading for any hero direction, the same direction with no step changes nothing, a step start in it takes it, a changed direction takes it; missing frames fall back (`has` false -> `airship` with the heading's flip) |
| `tests/scenes/fieldVehicleArt.test.ts` | **new** "the real vehicles.json gives `art.frames.airship_back` (and the other three) through `vehicleArt`"; the sheet holds the 4 frames, sizes within +-3 px of 0.2, anchors as in the json; **line 66**: `toEqual` gains the four `airship_*: 'approved'` entries; `parseVehicleMeta` accepts a sheet without them, and `vehicleArt` on it has no `airship_back`; **line 111** stays as it is (the ship keeps its facing on up and down) and gets an airship twin: ride the airship, `face('up')` then `follow()` -> the texture is `airship_back`'s; `face('left')` -> `airship` mirrored; boarding with the hero facing up keeps the parked heading until a step; the parked view after landing keeps the heading; the shadow size follows the frame |
| `tests/scenes/mode7/flightBillboards.test.ts` | built with `new FlightBillboards(() => Promise.resolve([RAW, sheet()]))` (the real json, a fake `TextureSource` as in `rig()`): `draw()` with each heading picks the right frame and flip (`lastPick`), the ship sprite's texture frame and anchor are that frame's, the shadow width follows the frame; `ShipDraw.heading` replaces `facing` |
| `tests/scenes/mode7/mode7Teardown.test.ts` | the hand-built `FlightFrame` uses `heading: SIDE_RIGHT`-based state instead of `facing` |
| `tests/scenes/mode7/mode7Heading.test.ts` (new, `flightHarness`) | in flight, hold up -> `stub.last.ship.heading.end === 'back'`, and it equals `vehicles.airshipHeading()`; then down -> `front` (instant, `turnFrom` null); then right -> `side`, with `turnFrom` 'front' for 100 ms of the injected clock; the ship's foot stays at (960, 750) |
| `tests/scenes/mode7/mode7TiltScene.test.ts` | at the first frame of the take-off tilt and of the landing tilt, `stub.last.ship.heading` equals `vehicles.airshipHeading()`, including a case flying north (back) before landing and a take-off from a parked airship that landed facing down (front) |
| `tests/scenes/mode7/mode7Tilt.test.ts`, `mode7Parity.test.ts` | unchanged; they must still pass |
| `tests/data/questCeilings.test.ts` | unchanged; `FieldVehicles.ts` and `FieldNpcActions.ts` under 250 |
| Python | `vehicle_view_cut.py --check` (with its gates); `selftest_vehicle_view.py`; `build_assets.py vehicles` then `git diff --exit-code assets/sprites/vehicles.*` |

**Browser checks** (headed Chromium, `?mute=1`, screenshots in `~/temp/ff-game/airship_views/<tranche>/`):

1. `av_flight`: fly up, down, left, right, with a shot of each. For mid-turn, poll `window.__mode7.ship.turning` in
   `requestAnimationFrame` after the key press, and take the shot on the first frame where it is true.
2. A take-off and a landing facing up, at t 0 / 0.5 / 1, and the t 0 diff against the top-down frame (M7-4's method,
   `match_*_diffmask.png`).
3. `?mode7=0`: the same 4 headings top-down, and one turn: the ship's visual centre must not jump (overlay two frames).
4. Land facing down: the parked airship shows the front view; walk away and back; board: it stays front until the
   first step.
5. Console: no errors. `__mode7.ship` matches each shot.

## 8. File-size and ceiling notes

- `FieldVehicles.ts` is pinned by `tests/data/questCeilings.test.ts` (listed at line 34, `< 250` at line 54). It is
  247 today; after AV-2 it is about 245, which the required `fieldStateOf` extraction makes possible.
- `FieldNpcActions.ts` (same test) only changes its import path.
- `FlightView.ts` goes from 249 to 248. It is not in a ceiling test, but the 250 guideline applies, and world wrap
  budgets against 248.
- `ExplorationScene.ts` gets +0. All new files are under 250.
- `tests/data/fileCeilings.test.ts` pins none of these files.

## 9. Tranches

| Tranche | Content | Files | Gates | Est. |
|---|---|---|---|---|
| **AV-1 Art** (calls only from the main checkout; the cut runs anywhere with the cache) | port the cutter with the anchor rule and gates; the cleanup edits for 2 (a)-(c), (e); up to 6 calls (4.4) only if the back's sail or the softness can't be fixed offline; write the approved files and json (with `review`, R6); `vehicles.py` optional frames and json anchors; rebuild `vehicles.*`; the review sheet in `airship_views/av1/` | `assets-src/gen/vehicle_view_cut.py`, `selftest_vehicle_view.py`, `approved/vehicles/airship_*.{png,json}`, `assets-src/vehicles.py`, `assets/sprites/vehicles.{png,json}` | `--check` (visual centre, shadow, size); selftest; determinism; rebuild clean | 4 h |
| **AV-2 Heading + field** | `airshipHeading.ts`; `vehicleLayout.ts`; `vehicleArt()` optional frames; `FieldVehicleView` frame swap and shadow key; `FieldVehicleSprites` heading owner and `noteHeading()`; **`fieldState.ts` extraction** and the `FieldNpcActions.ts:13` import; `FieldVehicles` forwards | the files in 5.1 except the mode7 ones | `airshipHeading.test.ts`, `fieldVehicleArt.test.ts`, **`questCeilings.test.ts`**, build, test:fast | 3 h |
| **AV-3 Mode 7** | `FlightView` (248 lines); `FlightBillboards` loader injection, frame and shadow, `lastPick`; `FlightRenderer.shipPick` | `mode7/FlightView.ts`, `FlightBillboards.ts`, `FlightRenderer.ts` | `flightBillboards`, `mode7Heading`, `mode7TiltScene`, `mode7Tilt`, `mode7Teardown`, `mode7Parity` tests; build; test:fast | 2 h |
| **AV-4 Scenarios + browser** | `av_headings`, `av_flight`; the browser checks of 7 | `assets/data/debug-scenarios.yaml` | crossFileValidation; screenshots | 2 h |
| **AV-INT** | merge **before world wrap**; `docs/TODO.md` T-2 closed with a pointer here; AGENTS.md: the vehicles row (the optional frames, the anchor rule, `vehicle_view_cut.py`) and a note under Mode 7; `MODE7_PLAN.md` 11 and D-M9 marked superseded; copy this plan to `docs/AIRSHIP_VIEWS_PLAN.md`; PROGRESS; the report states that the art was self-approved under R6, with the review sheet path | docs | all gates; test:full by the integrator | 1 h |

AV-1 and AV-2 can run in parallel: AV-2 is built and tested against a sheet without the frames first (so the fallback
is exercised), then against AV-1's sheet. AV-3 follows AV-2. AV-4 follows AV-1 and AV-3. The ledger rows the gate
appended in the main checkout (18 so far) go in with AV-1's commit, or the orchestrator's next ledger commit.

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| AR1 | The native cuts look softer than b_7 (2 (a)) | the cleanup edits; R6 lets the implementer approve against the b_7 side-by-side; up to 6 re-render calls |
| AR2 | A 3/4 "up" view reads as "north-east" | it leans toward the last side facing, like a banking turn; the straight end-on alternatives are in `native/` (R1) |
| AR3 | The field and the flight pick different frames at a tilt | one heading owner, two idempotent feeders (5.3); `mode7TiltScene.test.ts` |
| AR4 | The heading goes stale in flight | in Pixi 8 `onRender` still runs for the hidden ridden view, and `FlightView.frame()` also calls `noteHeading()`; `mode7Heading.test.ts` covers flight |
| AR5 | The ship jumps sideways on a turn | the centroid rule and its 1 px gate, in `--check` (4.1); browser check 3 |
| AR6 | Another agent's airship speed change in `AirshipMode.ts` | this plan does not touch `AirshipMode.ts` or movement |
| AR7 | The render cache is missing in a worktree | `--check` fails loudly; copy `cache/<key>.png` for the 4 keys (and the alternatives) from the main checkout |
| AR8 | `FieldVehicles.ts` crosses 250 lines and fails `questCeilings` | the required `fieldStateOf` extraction (about 245 after AV-2); `questCeilings` is in AV-2's gates |
| AR9 | The world-wrap pass edits `FlightView.ts` at the same time | AV merges first; wrap rebases and budgets against 248 |

## 11. Rulings (closed by the integrator, 2026-11-22: the defaults)

1. **R1 End-view angle:** 3/4, leaning toward the last side facing (D-AV1).
2. **R2 Turn frames:** a 100 ms in-between between the side and an end view; `TURN_MS = 0` turns it off.
3. **R3 End-view size:** true scale (D-AV3).
4. **R4 Top-down too:** the new frames in both the top-down field and Mode 7.
5. **R5 Parked heading:** a landed airship keeps its heading; it is not saved (D-AV6).
6. **R6 Approval:** the AV-1 implementer self-approves the picks after cleanup and records this in each json's
   `review` field and in the AV-INT report. The review sheet in `airship_views/av1/` lets the user veto it later
   (T-2 reopens if so).

## 12. Result (pass AV, 2026-11-22)

Implemented on branch `av` in five commits (AV-1 to AV-4, AV-INT). The art is **self-approved by the AV implementer
under the integrator's R6 ruling** (each approved json's `review` field says so); the review sheets are in
`~/temp/ff-game/airship_views/av1/` and, reduced, in `docs/art/airship_views/` (`review_*`, with PA's concept sheets
`concept_*`). The user may veto it; T-2 then reopens.

**Art (AV-1).** No Bedrock call was spent: the cleanup was done offline, so 12 of the 30 `ar_airship` calls remain.
`vehicle_view_cut.py` reproduces PA's native cuts byte for byte, then applies the edits per frame:

| Frame | Render | Edits | Sheet frame | Anchor |
|---|---|---|---|---|
| `airship_back` | `back25y30_st0.6_5` | the sail recoloured two ramp steps lighter (2 (b), 97 px), seam boost (142 px), highlight (452 px) | 87x112 | 0.3199 |
| `airship_front` | `front25y30_st0.6_3` | the envelope's brown band to the cream ramp (2 (c), 273 px), seam boost, highlight, the plumb line erased (2 (e): the 2 bottom rows and a 7 px column) | 87x110 | 0.3143 |
| `airship_back_turn` | `back30y55_st0.6_7` | seam boost, highlight | 126x102 | 0.3899 |
| `airship_front_turn` | `front30y125_st0.6_7` | seam boost, highlight, the plumb line erased (2 rows and 14 px) | 126x102 | 0.3893 |

The seam boost keeps only pixels that continue a seam (two or more seam neighbours), so it adds no lone dots. Every
gate passes (visual centre within 1 px at both facings with D7 = 13.80, the shadow under the hull, sizes within
+-3 px, binary alpha, b_7's colours, a closed outline). Not fixed: (d) the two black smokestacks stay missing, and the
back's sail stays small (lighter now). The edits live in `vehicle_view_edit.py` and the review sheets in
`vehicle_view_review.py` (split out of the cutter to keep each file under 230 lines).

**Runtime (AV-2, AV-3).** As planned (5.1). Line counts: `FieldVehicles.ts` 243, `FlightView.ts` **248**,
`FieldVehicleSprites.ts` 208, `FieldVehicleView.ts` 160, `vehicleLayout.ts` 115, `airshipHeading.ts` 65,
`FlightBillboards.ts` 128, `FlightRenderer.ts` 156, `fieldState.ts` 13; `ExplorationScene.ts` unchanged (556).
`VehicleView` gains `frameName`; the field shadow is keyed on (pose, frame, end). The flight shadow is rebuilt when the
frame or the end changes. `FieldVehicles.airshipHeading()` / `noteHeading()` forward to the sprites.

**Scenarios (AV-4).** `av_headings` starts at `entrance: cornelia` (146, 155) with the airship parked one cell east on
`a1_s_airship` (a scenario spot must be a `land` spot, and `scenarioSpawns.test.ts` pins the spot-spawned list, so an
entrance is used); `av_flight` flies from `entrance: cornelia_north`. `DebugScenarioField.test.ts` lets `av_*`
scenarios hold later story flags, as `w_*` / `m7_*` / `cd_*` do.

**Tests.** New: `tests/scenes/airshipHeading.test.ts`, `tests/scenes/mode7/mode7Heading.test.ts` (asserts
`turnFrom` / `turnAt` only, momus note 1), a new block in `fieldVehicleArt.test.ts` (the four frames through
`vehicleArt`, the old sheet's fallback, the turn frame, D-AV10, and the late sheet load keeping the heading, momus note 2),
`flightBillboards.test.ts` (the real json, each heading's frame, flip, anchor and shadow), and the tilt t 0 heading
case in `mode7TiltScene.test.ts`. The scene tests reach the scene's `FieldVehicles` through a `vi.spyOn` on
`FieldVehicles.prototype.airshipHeading` (its `mock.instances`), not a private field.

**Gates.** `vehicle_view_cut.py --check` OK (4 files rebuild); `selftest_vehicle_view.py` OK; `build_assets.py
vehicles` leaves `git diff` clean; `npm run build` OK; `npm run test:fast -- --maxWorkers=2 --minWorkers=1` 413 files,
10,025 tests, 180 s; `npm run quest -- --strict` OK (unchanged); `git diff mainline -- src/progression
src/systems/fieldRules*.ts assets/data/quest.yaml` empty.

**Browser** (headed Chromium, `?mute=1`, 1280x720, `~/temp/ff-game/airship_views/int/`): Mode 7 `m7_side_right`,
`m7_back_right`, `m7_front_right`, `m7_side_left`, `m7_back_left`, `m7_front_left`, and the mid-turn
`m7_turn_side_to_back` (`__mode7.ship.turning` polled in `requestAnimationFrame`, the ticker stopped on the first true
frame); the landing tilt flying north `land_t1` / `land_t05` / `land_t0_topdown`, the take-off `takeoff_t0` / `_t05` /
`_t1`, and the stepped t 0 match `match_takeoff_topdown` / `match_takeoff_t0` / `match_takeoff_diffmask` (98.97 % of the
field above the HUD identical; the rest is the hero hidden on boarding and the ridden shadow, the ship's back frame
drawn on the same pixels); top-down (`&mode7=0`) `td_side_right`, `td_back_right`, `td_front_right`, `td_side_left`,
`td_back_left`, `td_front_left`, the turn `td_turn_0_side` / `_1_inbetween` / `_2_back` and `td_turn_overlay`; the
parked heading `parked_back_topdown`, `td_landed_front`, `td_parked_front_from_away`, `td_parked_front_back_on_cell`,
`td_boarded_still_front`, `td_first_step_back`. `__mode7.ship` matched each shot; no console error or warning.

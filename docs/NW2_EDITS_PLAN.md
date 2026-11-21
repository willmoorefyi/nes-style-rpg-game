# NW2: edits to the natural world (plan, rev 1)

Base: `mainline` 37cce624 (pass NW closed; `docs/NATURAL_WORLD_PLAN.md`, "NW" below, sections cited as NW x.y).
Requests: the user, 2026-11-20 (R1-R5), and two rulings of 2026-11-21 (the airship no longer lands on tundra; then
tundra is replaced by **taiga**). Planning only: no code, data or map changes in this document's commit.

Renders for this plan (from the committed source `assets-src/maps/overworld.yaml`, scratch script outside the repo):
`~/temp/ff-game/nw2/plan/01_dwarf_canal_matoya.png`, `02_fire_peninsula.png`, `03_peninsula_north.png`,
`04_mainland_west.png`, `05_water.png`, `06_wind.png` (8-11 px per cell, a grid line every 8 cells, entrances red,
docks magenta, landing spots cyan, patch cells orange).

Coordinates: a **world cell** is `(x, y)`. A **rel** point is Cornelia-relative world cells (`worldgen.spec.world`:
world = (146, 155) + rel), the unit the region specs use. A **ref** is classic tiles in `world-anchors.yaml`
(target = (146, 155) + 0.86 x ref).

## 0. Summary and success criteria

The changes:
1. The Ice Cavern moves to the empty north tip of Crescent's peninsula. It sits in a walled frost hollow, reached
   from its own new dock `fir_ice` and then by canoe up a mountain gorge.
2. Gurgu stays where it is. The ring wall south of Crescent Lake thickens into a massif, so the only way to Gurgu is
   a long canoe gorge (R-volcano).
3. Mount Duergar moves north of the canal, into the mainland's west lobe. A new range (`duergar_range`) walls it off
   from Matoya, and its dock `ert_dwarf` moves with it.
4. A dock audit is derived from `quest.yaml` and becomes a compose check.
5. The northern sites get hikes: no landing within K walking steps, a landing within U.
6. Tundra becomes taiga: TerrainType 12, walkable like forest, and no landing.

```json
{
  "functional": [
    "fir_ice is unreachable on foot from every start, reachable by foot+canoe only through the fir_ice dock (S16)",
    "fir_volcano is unreachable on foot from every start and reachable by foot+canoe from fir_crescent's dock (S15)",
    "the least-canoe path to fir_volcano and to fir_ice has >= M=24 bankless canoe steps and >= N=12 pass cells",
    "ert_dwarf lies north of the canal and is reachable only from the relocated ert_dwarf dock (Aldi)",
    "a1_matoya and ert_dwarf are in different foot+canoe components with every patch on (duergar_range)",
    "every needs_dock town (derived from quest.yaml) has a dock in a basin the ship reaches at its bandStage",
    "for wat_onrac, wat_waterfall, wat_caravan, wnd_mirage, wnd_lufenia: no landing within K=18 steps, one within U=36",
    "the airship lands on grass only (taiga 12 and snow 13 refuse); taiga walks like forest; no ship or canoe on it",
    "every stage's requires and grants are unchanged; npm run quest -- --strict --mutate is OK"
  ],
  "observable": [
    "world.py prints OK lines for the new checks: canoe_gates, gorges, relations, dock_towns, hikes",
    "the figures: forced canoe steps, pass cells and expected fights per gorge; hike steps and expected fights per site",
    "the anchor table: dwarf (100, 121) and ice (214, 108) at their new targets; fitted s* in [0.75, 0.95]",
    "the curve model's level per stage beside NW's (37cce624); every band OK",
    "the browser checkpoints and the final overview in ~/temp/ff-game/nw2/int/"
  ],
  "pass_fail": [
    "npm run build OK; npm run test:fast OK (agents); npm run test:full OK (integrator)",
    "python3 -I assets-src/tools/layouts/world.py: every line OK; worldgen selftests OK",
    "npm run quest -- --strict OK; --strict --mutate OK (background, about 2 h 15 min)",
    "build_map.py --check-determinism overworld and mode7_atlas.py --check-determinism overworld OK",
    "re-running world.py leaves git diff --exit-code assets-src/maps clean"
  ]
}
```

## 1. Baseline (measured at 37cce624 on the committed source)

| Item | Today |
|---|---|
| Ice Cavern `fir_ice` | (184, 193), 12 cells from Gurgu (177, 203), both in the south lands behind `crescent_ring` |
| Least-canoe path Crescent's gate to Gurgu | 110 steps, **5** canoe steps, 2 pass cells (the shortest path is 66 steps, 28 canoe) |
| Least-canoe path Crescent's gate to the Ice Cavern | 69 steps, **6** canoe steps, 4 pass cells |
| Least-canoe path Onrac to the waterfall | 37 steps, 3 canoe steps |
| Canal patch | x 93-100, y 140-142; the ship stops at (101, 141) while it is shut |
| Dwarves `ert_dwarf` | (98, 152), south of the canal; dock (104, 152), Aldi, 6 steps; reachable on foot from `elf_port` (72 steps), hence S10's `nonLoadBearing` dock entry and GT-14's `nlb` |
| The mainland's west lobe | x 86-112, y 98-125: walkable from Matoya (128, 120), with no site on it |
| Crescent's peninsula, north tip | x 205-232, y 101-128: grass, two generated tarns and rivers (x 219-224), no site |
| Docks (`DOCKS_ALLOWED`) | `a1_pravoka` (aldi, 2 steps to the gate), `elf_port` (aldi, 10), `ert_dwarf` (aldi, 6), `ert_melmond` (ocean, 4), `fir_crescent` (ocean, 2) |
| Nearest landing (grass) to a north site, foot+canoe steps | Onrac 0, waterfall 4, caravan 0, Mirage 2, Lufenia 0, Gaia 0, Citadel 0, Bahamut 0 |
| Grass cells within 18 steps (walk+canoe) | Onrac 218, waterfall 61, caravan 153, Mirage 17, Lufenia 159 |
| Landing spots | all 13 on grass; none on tundra. `RESET_SPOTS`: `a1_s_pravoka_ship`, `a1_s_airship` (act 1, grass) |
| Tundra | 1,301 cells, all north of y 100; no road cell north of y 100 |
| Step factors at their clamp | `fir_rivers`, `fir_sea`, `fir_ashlands`, `fir_lakeshore`, `wat_isles`, `wat_streams`, `wnd_highlands`, `wnd_lufen_moor`: 2.25 (rate 23-50, a mean of 36.5 steps) |
| Curve-model level margins (NW 16) | S16 evil_eye 24.5 against a cap of 25 (band [21, 24] + 1); S21 28.8 against 29 |
| Files at their line ceiling | `worldgen/gates.py` 249 (no room); `gates_reach.py` 211, `prewalk.py` 178, `questTravel.ts` 212 |

## 2. Rulings, constants and glossary

| Id | Ruling / constant | Where |
|---|---|---|
| D-NW2-1 | **K = 18, U = 36.** K is about 21 classic tiles at s* 0.86, inside the user's 15-30. U = 2K is the sane bound | `world_api.HIKE_K`, `HIKE_U` |
| D-NW2-2 | **N = 12, M = 24.** Each canoe gorge has at least 24 forced canoe steps, at least 12 of them pass cells | `world_api.GORGE_N`, `GORGE_M` |
| D-NW2-3 | **Expected fights.** E_canoe >= 1.25 per one-way gorge trip; E_hike >= 0.75 per one-way hike, at the zones' rates after `world_balance` | `world_api.GORGE_E`, `HIKE_E` |
| D-NW2-4 | **Taiga replaces tundra** (user, 2026-11-21). It keeps TerrainType value 12 (saves and compiled collision unchanged), walks like forest, allows no ship or canoe, and the airship cannot land on it. Snow (13) is unchanged. NW's Q6 (land on tundra) is superseded | 3 |
| D-NW2-5 | **The dwarves move; the canal stays** (user's wording). Anchor `dwarf` ref (-56, -4) becomes (-54, -40); `ice` ref (44, 44) becomes (79, -55). These are user-directed departures from the classic offsets, recorded in the anchors file | 9 |
| D-NW2-7 | **Taiga takes forest's modifiers** (user, 2026-11-21): the same walking speed and encounter-rate modifiers as forest. Today these are a speed of 0.7 on foot and no encounter-rate modifier (none exists per terrain). Where they live is listed in 3 | 3, 11 |
| D-NW2-6 | **Requires and grants are frozen.** No stage's `requires`, `grants`, `after` or `boss` changes. Allowed: `walk` events, `entry` spots' cells, `nonLoadBearing`, and `grind` (balance lever, Q6) | 4.4, 5.4, 11 |

Glossary (used by the checks of 8):
- **Pass cell:** a River or Lake cell with no walkable 4-neighbour and a Mountain cell within 2 cells on both sides
  perpendicular to its route's flow.
- **Forced canoe steps:** the canoe steps on the path from any start to the entrance that minimises canoe steps
  first and total steps second, over foot+canoe cells with every patch on.
- **Hike distance d(site):** the BFS steps from the site's arrival cell to the nearest `canLand` cell. The floor uses
  foot+canoe (the canoe is held from S14, an ancestor of every north stage). The cap uses foot only for Onrac, the
  caravan, Mirage and Lufenia (T6b drops the canoe) and foot+canoe for the waterfall.
- **Landing:** a `canLand` cell: grass only after D-NW2-4, and no transition, gate or static NPC (`fieldRulesVehicles.ts`).
- **needs_dock town:** a `towns:` record where (i) no stage in the `after` closure of its `bandStage` (inclusive)
  grants the airship, and (ii) its gate is not reachable on foot from `cornelia` with the patches open at
  `bandStage`.

## 3. Taiga (D-NW2-4): the terrain change

**Rules.** Walking is allowed; ship and canoe are refused; the airship does not land. Taiga takes **forest's
modifiers** (D-NW2-7). Where those modifiers live, and what each gains:

| Modifier | Where | Forest today | Taiga |
|---|---|---|---|
| Walking speed | `src/entities/WalkingMode.ts` `getSpeedMultiplier` (read by `PlayerController` per target cell) | 0.7 | **0.7** (`terrain === Forest \|\| terrain === Taiga`); `tests/entities/` speed case added |
| Encounter rate per terrain | none: `MovementMode.getEncounterRateMultiplier()` takes no terrain and is 1.0 on foot (`WalkingMode`, `PlayerController.ts:197`); `EncounterSystem` reads zones only | none | none; a test pins "no terrain modifies the rate" so a later forest modifier must name taiga too |
| Curve-model step cost | none: `questCurve.ts` / `questExplore.ts` count route cells by zone (1 / mean step), never by terrain | none | none |
| Generator road cost | `worldgen/roads.py` (A\*: forest 2) | 2 | **2** (tundra was 1.2) |
| Step means (fights per step) | `layouts/world_balance.py` `STEP_FACTOR`, per zone | per zone | per zone; the hikes' taiga lies in the capped hike zones (11) |

**Generation** (`worldgen/climate.py`):
- The `cold > 0.5` band writes taiga `t` where it wrote tundra. It still overrides forest, sand and swamp.
- The band widens: `T_TAIGA` goes from 0.5 to 0.35, a new constant.
- A new hint kind `cold` raises `cold` in a ragged disc. It mirrors `warm` and is cut at 1.5 radii, so its effect
  stays local.
- `Q_FOREST` / `Q_SAND` stay frozen at their NW-RINT floats and are not re-derived. Note in `climate.py`: taiga is
  assigned after the forest and sand thresholds, so the reported forest share falls where taiga overrides forest;
  the thresholds do not move. Re-deriving them would repaint every region (NW 15).
- `roads.py`: taiga costs 2, as forest does (tundra cost 1.2). No road crosses the north today.

**Art** (no Gemini):
- 2x: `build_map.FALLBACK_MATERIALS["taiga"]` is a recolour of `forest` (hue -25 toward blue-green, saturation 0.55,
  value 0.70). It gains an optional fifth field, a deterministic snow speckle: 2-3 px white caps on the lit upper-left
  of the crowns, seeded per cell. Taiga edges get `tree_clump` in the same recolour.
- 1x: `tiles_cold.py` row 12 becomes dark conifers with snow (`tiles.py` maps `"taiga"`).
- Placeholder colour `0x2f4a3a`. It must read apart from forest's: the review measures the mean luminance gap
  against forest at >= 10 %.
- A free Bedrock texture pass is the fallback if the image review fails (Q7).

**Files (every row of NW 2.6's table):**

| File | Change |
|---|---|
| `src/types/index.ts` | `Taiga = 12` (rename `Tundra`; the value is kept) |
| `src/systems/fieldRules.ts` `baseTerrain` / `terrainAllows` | `Taiga` (walk yes, ship and canoe no) |
| `src/systems/fieldRulesVehicles.ts` `airshipTerrainLands` | `t === TerrainType.Grass` only; doc comment |
| `src/entities/AirshipMode.ts`, `WalkingMode.ts` | the comment; `Taiga` speed 0.7, as forest (D-NW2-7) |
| `src/rendering/chunkStreaming.ts` `TERRAIN_COLOURS`, `PlaceholderTextures.ts` | taiga `0x2f4a3a` |
| Mode 7 (`FlightView.ts` marker via `canLand`, `FlightBillboards.ts`) | none beyond `canLand`; the test changes |
| `assets-src/tools/build_map.py` | `LEGEND["t"] = "taiga"` (the char is kept, Q10); `TERRAIN["taiga"]`; `SOFT` / `ROUNDED` renamed in place (same index, so the same seed); `FALLBACK_MATERIALS`; `BLOCKED` unchanged |
| `terrain/base.py` `WILD`, `terrain/metrics.py` `FID_MATS`, `terrain/selftest.py` | rename |
| `worldgen/gates.py` `LANDING` | `["."]` (one-line edit; the file stays at 249) |
| `worldgen/gates_reach.py`, `spots.py`, `stamps.py`, `metrics.py` (`SHARES`), `world_api.py` (`TAIGA`), `world_checks.py` | rename; the landing is grass only |
| `nw2_selftest.py`, `map_selftest.py` | the legend case; "the airship lands on grass, not on taiga or snow" |
| Region backdrop maps (`water/world_water_nw_zones.py` `COLD`, `wind/world_nw.py`, `ordeal/world_ordeal_nw.py` `COLD`, `fire/fire_tables.py`) | key `taiga` -> `dark_forest` (Q8) |
| `src/core/schemaValidation.ts` (terrain names in `battleBackgrounds`) | accepts `taiga`; `tundra` is refused |
| AGENTS.md "The world (pass NW)" | the snow and tundra line becomes: "Snow `n` and taiga `t` (TerrainType 13 / 12, D-NW9, D-NW2-4): walkable (taiga as forest), no ship or canoe, the airship lands on grass only" |

**Migration.** No landing spot or `RESET_SPOTS` entry is on tundra today (1). The north `landings` check (8) proves
it on the new ground. Tests: 13.

## 4. R1 + R2: FIRE (the Ice Cavern moved; both sites canoe-gated through gorges)

**Geography** (indicative cells; the FIRE tranche fixes them inside the bounds):

| Feature | Position | Rule |
|---|---|---|
| Ice Cavern `fir_ice` | target **(214, 108)** (ref (79, -55)), in the **Rime Hollow**, a walled snow floor (inner radius about 4, centre about (215, 110)) | `ice_ring` barrier round the hollow (foot only, like `crescent_ring`; R-ice crosses it) |
| Rime Tarn | a pinned lake in the hollow, about (216, 112), radius 2 | R-ice's source |
| Rime Fells | a mountain massif from the ring south-west to the coast (x 205-224, y 112-127): `Ridge` records and the ring | holds the gorge |
| R-ice (re-pinned) | the tarn's outlet, then a winding valley through the fells to the sea mouth by the dock: **>= 26 route cells, >= 24 forced canoe steps, >= 12 pass cells** | `gorges`, `routes` |
| Dock **`fir_ice`** (new) | a cove on the tip's west coast at about **(206, 124)**, **ocean basin**, at most 6 walking steps from R-ice's mouth | `docks`, `straits` |
| Frost Shore | the walkable strip between the dock and the mouth (8-30 cells, taiga and snow) | zone `fir_tundra` |
| `ice_neck` (new barrier) | a ridge across the peninsula at y about 126-131, coast to coast, joined to the north hills ridge | **foot and foot+canoe** closed (`CANOE_BARRIERS`), so the tip's only way in is its dock |
| Cold | `ClimateHint("cold", rel (68, -44), 16)`; the tip's walkable cells must be >= 60 % taiga and snow | figure, gate 50 % |
| Peninsula polygon | `SOUTHEAST` gains a northern lobe (rel about (58, -50), (66, -56), (76, -52), (82, -44)) so the tip is FIRE's continent; the land added (about +150 cells) also lifts the land count off its band floor | `world` land |
| Gurgu `fir_volcano` | unchanged (177, 203) | |
| Cinder Wall | `crescent_ring` south of the lake thickened into a massif (x about 180-206, y 184-197), with a `Ridge` of width 6 alongside the barrier line | `barriers` |
| R-volcano (re-pinned) | from the lake's south-west shore (about (205, 184)) south-west down a gorge (rel about (59, 29), (54, 35), (45, 41), (40, 43)) to the ash flats near (186, 198), then to its sink by Gurgu: **>= 24 forced canoe steps, >= 12 pass cells** | `gorges`, `routes` |
| Old frost hollow and old R-ice | removed (the hollow is inside the Cinder Wall); the south lands are ash and dunes | `routes` |
| Corridors | `fir_south` becomes (fir_volcano, (37, 48), (46, 49), fir_desert); `fir_ash` is dropped; new `fir_ice_shore` (dock:fir_ice, R-ice's mouth) | prewalk does not cover it (post-canoe); `canoe_gates` does |

**Gorge stamps.** A new `Gorge(route, i0, i1)` record forces Mountain on both banks (1-2 cells) of the route cells
`i0..i1`. It makes the pass cells by construction (`worldgen/stamps.py` already holds the route bank clearings;
the new logic goes in `worldgen/gorges.py`).

**Zones.**
- `fir_tundra` (the Frost Hollow; the id is kept, Q12) moves to the tip's walkable cells.
- R-ice's and R-volcano's cells stay in `fir_rivers`, whose factor is capped at 1.2, so E_canoe = 24 / 19 = 1.26
  (D-NW2-3).
- The old hollow's cells go to `fir_ashlands` or `fir_desert` (`world_fire_nw_zones.py`).
- The floe and the hollow's pines move with the cave (`world_fire_nw.py` `_stamp_icons`, `FLOE_TRY`).

**Files.**
- Spec: `layouts/world_specs/fire.py`.
- Content: `fire/world_fire_nw.py`, `fire/world_fire_nw_zones.py`, `fire/fire_tables.py`.
- Generator: `worldgen/bundle.py` (`Gorge`), new `worldgen/gorges.py`, `worldgen/relief.py` (a carved valley under
  a gorge).
- Contract: `world_api.py` (`fir_ice` dock, barriers).
- Data: `assets/data/world-anchors.yaml` (`ice`), `quest.yaml` (S16's `walk`), `debug-scenarios.yaml` (`w_s16_*`:
  the ship at `fir_s_ice_ship`).

**Progression (unchanged requires and grants).**
- S14 gives the canoe at Crescent.
- S15 (`requires canoe`) runs Crescent's dock -> the lake -> R-volcano -> Gurgu.
- S16 (`requires canoe`, `after [S14]`) gains the walk events `overworld:board:ship` and `overworld:dock:fir_ice`
  before `overworld:warp:ice-cavern-b1`. Its `entry` stays at `fir_s_crescent` with the ship at
  `fir_s_crescent_ship`, so `--stage S16` includes the voyage.
- S17's hull is reached through R-volcano only (it was R-volcano or R-ice): S17 `after [S16]` is unchanged and
  holds the canoe.
- The ship reaches the ocean after CANAL_OPEN (S10, an ancestor).
- New spots: `fir_s_ice_ship` (dock) and `fir_s_ice_shore` (land). No spot is renamed.

## 5. R3: Mount Duergar north of the canal (EARTH + A1)

| Feature | Position | Rule |
|---|---|---|
| Dwarf hall `ert_dwarf` | target **(100, 121)** (ref (-54, -40)), at the north foot of the hogback's north peak (its mouth in the rock, the arrival on the lobe) | `relations`: y <= canal min y - 10 (canal 140: 19 rows today), bearing from the canal centre (96.5, 141) within 45 degrees of north |
| Duergar pocket | the west lobe (x about 86-108, y 98-125, about 300 walkable cells): forest, grass and hill | zone `ert_isthmus` (flood seed: the hall) |
| `duergar_range` (new barrier) | a N-S ridge from the north coast (about (109, 98)) to the Aldi's north-west corner (about (112, 121)), >= 3 rock cells thick, joining the mainland ridge's west end (about (108-112, 108-112)) | **foot and foot+canoe** closed; seeds `a1_matoya` and `ert_dwarf` |
| The pocket's south side | the hogback (W_west, W_isthmus) between the lobe and the canal stays rock; the strip between the hogback's east foot and the Aldi at y 136-139 is closed with rock | `duergar_range` seeds also `ert_dwarf` vs `elf_keep`, with the canal shut (its saddle is walkable then) |
| Dock `ert_dwarf` (moved; the id is kept) | a cove on the Aldi's north-west corner at about **(104, 124)**, **aldi**, <= 6 walking steps from the hall | `docks`, `dock_towns`, `straits` (pravoka-dwarf; dwarf-melmond through the canal) |
| Canal | unchanged (x 93-100, y 140-142), south of the dwarves; its dressing is unchanged | `basins`, `walls` |
| Old dwarf land (the south isthmus, about (93-110, 143-176)) | stays EARTH land walkable from Elfland; its old cove is closed (`Dock` removed, the coast regenerates) | zone `ert_isthmus` by a second flood seed (the canal's south bank) |
| Ownership | EARTH's `ISTHMUS` polygon grows north over the lobe to the range crest (rel about (-58, -57) to (-36, -31)); A1's `EXT_A1` is trimmed east of the crest. Done in one tranche, so the owner line moves once | `owners`; `coverage` |

**Act 1 must stay as it is** (3.6.3 checks; `a1Walks` within ±10 %): the range runs west of x 114, and Matoya's pin,
hill and clearing are untouched. OW-15 (the land beyond the bridge larger than the peninsula) is re-measured: about
300 cells leave `a1_mainland` for `ert_isthmus`.

**Files.**
- Specs: `layouts/world_specs/earth.py` (polygon, `DWARF_DOCK`, corridor `ert_dwarf`, spots, `barrier_seeds`) and
  `layouts/world_specs/a1.py` (`EXT_A1` trim, `duergar_range` barrier line).
- Content: `earth/world_earth_nw.py` (zone seeds, mooring post), `earth/world_earth_nw_ground.py`,
  `a1/world_a1_nw.py` (the `a1_mainland` cells).
- Contract: `world_api.py` (`DockSpec` text, `BARRIERS`, `CANOE_BARRIERS`).
- Data: `world-anchors.yaml` (`dwarf`, detours), `quest.yaml` (S10's `nonLoadBearing` dock entry removed).
- Verifier: `questMutateRows.ts` (GT-14).

**Progression (unchanged requires and grants).**
- S10 (`requires tnt`, `grants CANAL_OPEN`) is reached by ship from Pravoka (aldi). Its dock becomes load-bearing:
  the entry "the dwarf hall is also reachable on foot from Elfland" is removed, and GT-14 expects the goal to fail.
- The dwarf town's `opensAfter [S2]` is now guarded by `duergar_range`: without it, T1 (on foot after the bridge)
  would reach the dwarves, and proof (e) would fail.
- S11 sails from the dwarves' dock south through the canal to Melmond. S31's Smyth is reached by airship: the lobe
  has grass, and it is not a north site.

## 6. R4: dock audit

`needs_dock` (2) derived from `quest.yaml` at 37cce624:

| Town | bandStage | Airship before? | On foot from Cornelia? | needs_dock | Dock, basin, dock-to-gate steps |
|---|---|---|---|---|---|
| pravoka | S2 | no | yes (after S1) | no | `a1_pravoka` (the ship's home), aldi, 2 |
| elfheim | S6 | no | no | **yes** | `elf_port`, aldi, 10 |
| dwarf | S10 | no | no (NW2: by the range) | **yes** | `ert_dwarf`, aldi, 6 (NW2 <= 6) |
| melmond | S11 | no | no | **yes** | `ert_melmond`, ocean (CANAL_OPEN at S10), 4 |
| crescent | S14 | no | no | **yes** | `fir_crescent`, ocean, 2 |
| onrac, gaia, lufenia | S20, S23, S26 | yes (S17) | no | no | none (airship) |

Result: every southern town has its dock today. The same rule, applied to the dock-gated non-town sites:
- `elf_keep` and `elf_marsh`: from `elf_port` on foot (41 and 68 steps);
- `ert_giant` and `ert_earth_cave`: from `ert_melmond` (18 and 34 steps);
- `fir_volcano`: `fir_crescent` plus the canoe;
- `fir_ice`: `fir_ice` plus the canoe (NW2).

The check `dock_towns` (8) asserts this from the data on every compose.

## 7. R5: northern hikes (WATER, WIND)

Mechanism:
- Per-site `Hike(site, landing, fill)` records in the region specs. A new composer pass, `worldgen/hikes.py`, runs
  after the region content and before `spots.resolve`.
- The pass converts every grass cell with d < K + jitter (jitter 0-4 steps from fbm, so the ring is never a clean
  disc) to `fill` by local climate:
  - taiga where `cold > 0.2`;
  - sand inside an `arid` hint;
  - swamp inside a `wet` hint;
  - forest otherwise.
- Cells it never converts: pins, roads, and the site's own door ring (the arrival becomes taiga or sand, so it stays
  walkable).
- It then stamps the landing meadow, a ragged grass disc of radius 1.5 at `landing`.
- Most of the ring comes from the climate (the `cold` hints, `T_TAIGA`); the pass is the guarantee. Its converted-cell
  count is reported per site, a figure and not a gate. The review asks that it be well under the 608 grass cells of 1.
- WIND's `MEADOWS` for `wnd_mirage` and `wnd_lufenia` and WATER's oasis and Onrac meadows (`CARAVAN_LANDING_OFF`,
  the S24 bank) are removed. Gaia's meadow stays.

| Site | Ring | Landing spot (name kept or new), indicative cell | d today -> target (floor foot+canoe; cap mode) | Hike zone (factor cap) |
|---|---|---|---|---|
| Onrac `wat_onrac` | taiga belt (`cold` hint rel (-79, -86), 14) between the spine and R-waterfall | `wat_s_onrac_airship` -> the south coast meadow, about (63, 86) | 0 -> 18-26 on foot | `wat_isles` (<= 1.5) |
| Waterfall `wat_waterfall` | snow and taiga on the spine's flank (already about 80 %) | **new `wat_s_waterfall_airship`**: the east downs across R-waterfall, about (80, 52) (it is also >= 24 canoe steps from Onrac) | 4 -> 19-26 foot+canoe | `wat_isles`, `wat_streams` (<= 1.5) |
| Caravan `wat_caravan` | the dune field (`arid`) plus taiga on its north | `wat_s_caravan_airship` -> the south-west meadow, about (38, 76) | 0 -> about 28 on foot | `wat_dunes` (0.67; <= 1.5) |
| Mirage `wnd_mirage` | the sands; its oasis meadow becomes sand | `wnd_s_mirage_airship` and `wnd_s_sky_airship` -> a north oasis inside the ring, about (190, 46) | 2 -> about 24-27 on foot over sand | `wnd_mirage_sands` (1.26; <= 1.5) |
| Lufenia `wnd_lufenia` | taiga and forest moor (`cold` hint rel (72, -79), 12) | `wnd_s_lufenia_airship` -> the east moor, about (240, 72) | 0 -> about 20-23 on foot | `wnd_lufen_moor` (<= 1.5) |
| Gaia, Citadel, Bahamut | unchanged (Q4) | unchanged | must hold d <= U and the landing rule under D-NW2-4 | |

The caps keep E_hike >= 0.75: a mean rate of 24 steps at factor 1.5 gives 18 / 24 = 0.75.

**Airship-only gates:**
- `north` is unchanged: no dock on WATER, ORDEAL or WIND, each its own foot+canoe component.
- T6 / T6b (10): the four sites are reachable on foot from a landing within U; the waterfall only with the canoe.

**Files.**
- WATER: `layouts/world_specs/water.py`, `water/world_water_nw.py`, `water/world_water_nw_zones.py`.
- WIND: `layouts/world_specs/wind.py`, `wind/world_nw.py`, `wind/world_nw_objects.py`.
- Generator: `worldgen/bundle.py` (`Hike`), new `worldgen/hikes.py`, `layouts/world.py` (one call, one check line).
- Data: `debug-scenarios.yaml` (the `w_s20`-`w_s28` scenarios keep their spot names; their cells move).

## 8. Checks (compose-time, in NW 3.8's style; `world.py` prints one line each)

New checks go into new files, since `gates.py` is at 249 lines: `worldgen/gates_canoe.py` (`canoe_gates`, `gorges`,
`relations`), `worldgen/gates_hike.py` (`hikes`), and `dock_towns` in `prewalk.py` (178 + about 45 lines). Each
gets a failing fixture in `selftest_gates.py` (+5 cases).

| Check | Patches | Rule |
|---|---|---|
| **barriers** (extended) | all on (canal shut for the `ert_dwarf`/`elf_keep` pair) | `duergar_range` and `ice_neck` are closed on foot **and** foot+canoe (`CANOE_BARRIERS`); `ice_ring` on foot only (R-ice crosses it, as `crescent_ring` / R-volcano); each minimal cut >= 3 cells, exported to `world.cuts` |
| **canoe_gates** | all on | for S15 (`fir_volcano`) and S16 (`fir_ice`), from every start (prewalk's starts: the ancestors' map exits, `entry.at`, and every dock of the basins the ship reaches with the ancestors' grants): (i) unreachable on foot; (ii) reachable on foot+canoe; (iii) for `fir_ice`, unreachable on foot+canoe once the `fir_ice` dock is withheld (the separate-dock rule) |
| **gorges** | all on | on the least-canoe path of canoe_gates (ii): forced canoe steps >= M (24), pass cells >= N (12), E_canoe >= 1.25 at the zone rates written by `world_balance`. Prints steps / pass cells / E per site |
| **relations** | off | `fir_ice.y <= fir_crescent.y - 40` and its bearing from Crescent within 30 degrees of north; dist(`fir_ice`, `fir_volcano`) >= 60; `ert_dwarf.y <= min canal y - 10` and its bearing from the canal centre within 45 degrees of north |
| **hikes** | all on | for the five hike sites: K <= d_floor (foot+canoe) and d_cap (the site's mode) <= U; every cell of the cap path is in a walking or canoe zone; E_hike >= 0.75; prints d and E per site. For Gaia, Citadel and Bahamut: d_cap <= U only |
| **landings** (changed) | all on | the landing is **grass** only (taiga and snow refuse). Every `landing` spot is `canLand`; every airship-only anchor has a landing within U **walking** steps (was "8 grid steps", NW T6) |
| **dock_towns** | per stage | for each needs_dock town (2, from `quest.yaml`): a dock in `DOCKS_ALLOWED` whose basin the ship reaches at `bandStage` (aldi if the ship is an ancestor's grant, ocean if CANAL_OPEN is too), with the gate within 12 walking steps of the dock's shore |
| **prewalk** (unchanged range S0-S14) | per stage | now also proves S10's hall from the moved `ert_dwarf` dock; the vacuity selftest is kept |
| **routes** (changed ends) | all on | R-ice is tarn to sea mouth; R-volcano is lake to sink; no route cell is a ford |
| **straits** (+1 lane) | all on but `canal` | `crescent-ice` (`fir_crescent` to `fir_ice`, canal open) >= 3 cells wide |
| **docks** | all on | `fir_ice` is allowed (ocean); no dock left at the old dwarf cove |

**`--worst-canoe` interaction** (NW 4.3; no code change):
- T0-T2 keep their must-not-reach sets with the canoe.
  - T1: `ert_dwarf` (ALDI) holds only because `duergar_range` is canoe-closed.
  - T2 (ship, canal shut): `fir_*` hold, because the ocean, and with it `fir_ice`'s dock, is shut.
- T3-T4 keep the SOUTH exception (`fir_volcano`, `fir_ice`, `fir_desert`). `fir_ice` is now reached through its own
  dock and the canoe, which is the design.

## 9. Anchors and proof (g)

- **New targets.** `dwarf` ref (-54, -40) -> target (100, 121); `ice` ref (79, -55) -> target (214, 108). The
  records get `note: "NW2 (user ruling 2026-11-20): moved from ref (-56, -4)"` and `(44, 44)` respectively. The
  tolerance is ±2 as before.
- **Bands.** The ratios hold by construction: keep-dwarf d_r 64.3 -> 55.3 world cells, actual 55.2;
  dwarf-melmond 40.9 against 41.1 (melmond at its -2 nudge). crescent-ice (now a long pair: d_r 75.8) and
  ice-desert (117) are re-checked for bearing and ratio. s* is re-fitted and must stay in [0.75, 0.95] (today
  0.851).
- **The full table** of 31 pairs is re-computed with 20,000 random ±2 placements, as NW-1 did. At most 0.05 % may
  fail. The table goes in the NW2-0 result.
- **Detours:**
  - `crescent-ice`: mode `canoe+walking` becomes **`ship+canoe+walking`**, factor 2.5 (estimate 1.5).
  - `ice-desert`: `walking` becomes `ship+canoe+walking`, factor 2.5 (estimate 1.6).
  - `dwarf-melmond`: 4.5 tightens to **2.5** (estimate 1.5), via "south through the canal".
  - `pravoka-dwarf` stays ship+walking 2.5.
- **Code.** The new mode is added to the detour BFS (`src/progression/questLateData.ts` reads it; the hop evaluator
  is in `questGeo.ts` or `questLate*.ts`, located by the NW2-0 agent) and to `gates_reach.detours`.
- **The classic relation** is a compose check (`relations`, 8). Proof (g)'s bearings carry it too: crescent-ice is
  bearing-checked at 40 degrees as a long pair.

## 10. Proof (h), basins, docks and the mutation suite

- **Contract** (`world_api.py`):
  - `DOCKS_ALLOWED` gains `"fir_ice": DockSpec("ocean", "fire", "the Rime cove on the peninsula's north tip")`;
    `ert_dwarf`'s text becomes "the dwarves' cove in the Aldi's north-west corner, north of the canal".
  - `BARRIERS` gains `duergar_range`, `ice_neck`, `ice_ring`; `CANOE_BARRIERS` gains `duergar_range` and `ice_neck`.
  - `gates.STRAITS` gains `crescent-ice`. `BASIN_SEEDS` is unchanged.
- **Travel rows** (`questTravelRows.ts`):
  - B2's docks gain `fir_ice`; B1 is unchanged (`ert_dwarf` stays aldi).
  - T6's `landing` means "a landing within U walking steps" (`questTravel.landingNear`: a walking BFS bounded by
    `HIKE_U`, read from the map data or the anchors file, not a literal). T6b is unchanged.
  - The K floor is a geography rule (`hikes`, a TS test), not a reachability proof.
  - No new T row.
- **The mutation rows** (`questMutateRows.ts`):
  - GT-14 (`ert_dwarf` removed) changes from `nlb: entry`, expecting nothing, to expecting `[goal]`.
  - GT-21's find becomes R-volcano's cut from `fir_crescent` plus R-ice's cut from the `fir_ice` dock's shore
    (`canoeCut` takes `dock:fir_ice`).
  - GT-37 (`crescent_ring` opened) expects `skip('S15')` only.
  - New rows:
    - GT-40: `ice_ring` opened, expects `skip('S16')`.
    - GT-41: dock `fir_ice` removed, expects `[goal]`.
    - GT-42: `duergar_range` opened, expects `early('dwarf')` from proof (e).
    - GT-43: `ice_neck` opened, `nlb`: "the tip becomes walkable from Crescent's shore, so the fir_ice dock is
      redundant; S16 still needs the canoe". It expects nothing; it records that the dock's necessity is geometry,
      guarded by `canoe_gates` (iii).
  - GT-38 and GT-39 stay unused (NW 4.5 dropped them).
  - The generic dock elements pick up `fir_ice` themselves (`questMutateGeneric.ts` walks `map.docks`).
- **Proofs (e) and (f)** are re-run at NW2-INT: no town opens early; Crescent's and Gaia's price walls hold.

## 11. Balance (`layouts/world_balance.py`, the curve model)

More forced fights are the point of the change: the gorges, the hikes, and S16's voyage round the peninsula.
- **Rule:** every band OK (d), each stage's level within +0.5 of NW's (37cce624), and (d2) kits and (d3) takeGold
  OK.
- **Levers, in order:**
  1. Re-fit `STEP_FACTOR` with NW-5's iterative fit (the scratch script outside the worktree), clamp
     [0.67, 2.25] as before, plus new **pinned caps**: `fir_rivers` <= 1.2 (E_canoe), and `wat_isles`,
     `wat_streams`, `wat_dunes`, `wnd_mirage_sands`, `wnd_lufen_moor` <= 1.5 (E_hike). A `CAP` dict in
     `world_balance.py` that `apply` asserts.
  2. If a stage is still over: lower its `grind` in 0.5 steps, never below 1.0. The likely stages are S15 (3.0),
     S16 (2.0), S20 (7.0), S21, S22, S24 and S26 (Q6).
  3. No enemy, item, formula or band change.
- **The north stages, re-measured one by one.** The hikes cross taiga, which walks at forest's speed but, like
  forest, adds no rate modifier (D-NW2-7). Its extra fights come only from the longer zone paths, which the curve
  model counts by zone.

  | Stage | Band (cap = top + 1) | NW level (37cce624) | Hike or gorge added |
  |---|---|---|---|
  | S15 Gurgu | [21, 24] | measured in NW2-BAL | the Cinder Gorge |
  | S16 Ice | [21, 24] | 24.5 | the voyage, the Rime Gorge, the shore |
  | S18 Citadel / S19 Bahamut | [24, 27] | measured | none (Q4) |
  | S20 Onrac | [25, 28] | measured | the Onrac hike |
  | S21 waterfall | [25, 28] | 28.8 | the waterfall hike |
  | S22 caravan / S23 Gaia | [25, 28] / [26, 29] | measured | the caravan hike / none |
  | S24 Sea Shrine | [27, 30] | measured | the Onrac hike (entry spot moved) |
  | S25 Melmond / S26 Lufenia | [28, 31] | measured | none / the Lufenia hike |
  | S27 Mirage / S28 sky castle | [29, 32] / [31, 34] | measured / 33.9 | the Mirage hike / the moved sky airship spot |

  The NW2-BAL result fills every "measured" cell for both worlds, NW's and NW2's. A stage over its cap, or more than
  0.5 above NW's level, is fixed by lever 1, then lever 2.
- **Re-measured:**
  - `tests/balance/questCurve.test.ts`: each bound keeps its 3-point margin; wipes under 0.2 per stage (S31's
    optional bound 0.45 stays).
  - `fieldCampaign`, `fieldPacing`, `zones`.
  - The fights per stage, compared with NW's, in the result. Expected the most: S15, S16, S20-S27.

## 12. Spots, saves and Mode 7

- **Spots.** No name changes. Moved cells:
  - `ert_s_dwarf`, `ert_s_dwarf_ship`;
  - `wat_s_onrac_airship`, `wat_s_caravan_airship`;
  - `wnd_s_mirage_airship`, `wnd_s_sky_airship`, `wnd_s_lufenia_airship`.
  - New: `fir_s_ice_ship`, `fir_s_ice_shore`, `wat_s_waterfall_airship`.
  - Every landing spot is on grass and within U of its site (`landings`, `hikes`). `RESET_SPOTS` (act 1, grass) is
    unchanged.
- **Saves: `SAVE_VERSION` 5** (`src/systems/worldReset.ts`, about +35 lines). A v4 save is kept unless one of these
  applies:
  - (a) It is on the overworld and its party cannot reach, on foot (with its flags' patches), Cornelia, its ship's
    shore or its airship's cell. Then it resets as D-NW8: Cornelia, vehicles to `RESET_SPOTS`, the one-time notice.
    An example is a party standing in the old frost hollow, now rock, or in the west lobe, now the dwarves' pocket,
    with no vehicle there.
  - (b) It is inside `dwarf-hall` or `ice-cavern-*` with the ship. Then the ship is relocated to `ert_s_dwarf_ship`
    or `fir_s_ice_ship`, so leaving does not strand the party (`RELOCATE` table).
  - (c) An airship parked on taiga or snow is kept: boarding needs no landing cell.
  - `--from-reset` (`questReset.ts`) adds the relocated states: S10 inside `dwarf-hall`, S16 inside `ice-cavern-b1`.
    Proof (c) runs from each.
- **Mode 7.** The atlas is re-baked by the integrator's full compile. The landing marker follows `canLand`, so it
  refuses taiga. The test changes (13). The browser checkpoint (NW-INT's Onrac landing on tundra at (65, 40))
  becomes: a refusal over taiga at (65, 40), and a landing at the new Onrac meadow.

## 13. Tests

| Test | Change |
|---|---|
| `tests/systems/fieldRulesCold.test.ts`, `fieldRules.test.ts` | `Taiga` 12: walk yes, ship and canoe no, **airship no**; snow unchanged; 14 is Wall |
| `tests/entities/` (the movement-mode tests) | `WalkingMode.getSpeedMultiplier(Taiga)` is 0.7, as forest; no mode's encounter multiplier reads terrain (D-NW2-7) |
| `tests/scenes/mode7/mode7Cold.test.ts` | the marker shows over grass, not over taiga or snow |
| `tests/rendering/PlaceholderTextures.test.ts`, `CollisionMap.test.ts`, `streamWindow` (`dominantColour`) | taiga texture and colour |
| `tests/core/schemaValidation.test.ts`, `tests/scenes/BattleBackdrop.test.ts` | the `taiga` key; `tundra` refused |
| `tests/data/assetCoverage.test.ts` | a sheet row per TerrainType; the taiga backdrop id exists |
| `tests/quest/fire/fireWorld.test.ts`, `fir_d2_ice.test.ts`, `icePaths.ts`, `fir_d1_*`, `hazardPath` | the ice tip, `fir_tundra` on the tip, the gorge figures, the corridors, the dock, the vents off the new route |
| `tests/quest/earth/ert_o_world.test.ts`, `ert_o_walk`, `ert_t_walk` | the hall at its target, the pocket's zone, the dock, the second `ert_isthmus` seed |
| `tests/quest/elf/elf_o_world.test.ts` | the dwarves are no longer on ELF's walk component |
| `tests/quest/a1/a1Pins.test.ts`, `a1Walks.test.ts`, `a1_o_walk`, `tests/data/act1Flow.test.ts` | pins unchanged; walks within ±10 %; OW-15 re-measured; the lobe no longer in `a1_mainland` |
| `tests/quest/water/wat_o_world.test.ts`, `wat_o_sites`, `wat_t_walk` | landing spots moved (still grass); `COLD` key `taiga`; hike distances |
| `tests/quest/wind/wnd_o_world.test.ts`, `wnd_o_lufenia`, `wnd_d1_*`, `wnd_d2_*`, `wnd_t_gaia` | meadows removed or moved; the backdrop key `taiga` |
| `tests/quest/ordeal/ord_o_world.test.ts` | the backdrop key `taiga` |
| `tests/data/worldSource.test.ts`, `worldSpots.test.ts`, `worldGates.test.ts`, `overworldZoneCoverage.test.ts` | the new docks, spots, barriers, cuts |
| `tests/progression/travelMatrix.test.ts`, `macroGeography.test.ts`, `worldAnchors.test.ts`, `questSpots.test.ts`, `questMutate.test.ts`, `miniWorld.ts` + `tests/fixtures/quest/mini.yaml` | B2 docks; anchor targets; GT rows; the fixture's tundra cell becomes taiga |
| `tests/systems/saveWorldReset.test.ts`, `worldReset.test.ts`, `tests/progression/resetStates.test.ts` | v5: cases (a) to (c) of 12, plus a valid v4 kept |
| **new** `tests/data/northHikes.test.ts` | K <= d <= U per site from the compiled source; E_hike from the zones |
| **new** `tests/data/canoeGorges.test.ts` | forced canoe >= M, pass cells >= N, E_canoe per gorge; the Ice Cavern needs `fir_ice` |
| **new** `tests/data/dockTowns.test.ts` | the needs_dock list from `quest.yaml` (elfheim, dwarf, melmond, crescent) and each town's dock |
| `tests/data/questCeilings.test.ts` | finds `gates_canoe.py`, `gates_hike.py`, `hikes.py`, `gorges.py` (each < 250 lines) |
| `tests/fixtures/passW/*` | untouched (pass W's record) |

## 14. Tranches

Rules:
- Each tranche is a branch from `mainline`, mergeable on its own. Agents run `npm run build` and
  `npm run test:fast`, plus `world.py`.
- The world is never hand-merged: each merge re-runs `world.py`, and the integrator full-compiles under the lock
  (one world compile at a time; NW-5's figures: 254 s, 11.2 GB) and commits the chunks.
- An agent previews with `build_map.py --region <r>` over an APFS clone of the committed compile in
  `/tmp/<agent>/nw2-out/`, never inside the worktree.
- Scratch sims stay outside the repo.
- Review output goes to `~/temp/ff-game/nw2/<tranche>/`.
- New checks land in **pending** mode: a site listed in `HIKE_PENDING` / `GORGE_PENDING` / `RELATION_PENDING` is
  reported, not failed. Each region tranche empties its own entries; NW2-INT asserts the lists are empty, as NW's
  "zones pending".

| Tranche | Owner | Content | Gates | Depends | Effort |
|---|---|---|---|---|---|
| **NW2-0 Contract and checks** | integrator | `world_api` constants (K, U, N, M, E), docks, barriers, straits; `bundle`/`spec` (`Hike`, `Gorge`, the `cold` hint); `gates_canoe.py`, `gates_hike.py`, `dock_towns`, with selftests, in pending mode; `landingNear` -> U walking steps; the detour mode `ship+canoe+walking`; GT row edits behind pending; the `world_balance` `CAP` dict (asserted, not yet tight) | `world.py` OK with the pending lists printed; `selftest_gates.py` (+5); `quest --strict` OK on today's world; test:fast | — | 7 h |
| **NW2-T Taiga** | integrator or a runtime agent | 3 in full: runtime rename and rules, Python rename, `T_TAIGA` 0.35, art (2x fallback plus speckle, 1x row), backdrops, schema, tests, AGENTS line | `world.py` OK (`landings` grass only); image review of 4 north crops at 1x (taiga readable against forest); `--region` previews of WATER, WIND, ORDEAL; test:fast | NW2-0 | 8 h |
| **NW2-E Duergar** | EARTH agent (A1 spec edit approved) | 5: the hall, the pocket, `duergar_range`, the dock, the owner line, zones, S10 `nonLoadBearing`, GT-14, GT-42 | `world.py` OK (`barriers`, `prewalk`, `relations` dwarf, `dock_towns`, `act1`, `walks`); `quest --strict --stage S10` and `--stage S11`; image review; test:fast | NW2-T | 7 h |
| **NW2-F Fire** | FIRE agent | 4: the tip, `ice_ring`, `ice_neck`, R-ice, the `fir_ice` dock, the Cinder Wall, R-volcano, corridors, zones, content, S16 `walk`, `w_s16_*`, GT-21, GT-37, GT-40, GT-41, GT-43 | `world.py` OK (`canoe_gates`, `gorges`, `relations` ice, `routes`, `straits`); `quest --strict --stage S15`, `S16`, `S17`; image review of the tip and the Cinder Gorge at 1x; test:fast | NW2-T | 10 h |
| **NW2-W Water hikes** | WATER agent | 7: the Onrac, waterfall and caravan rings, the cold hint, moved and new spots, meadows removed, scenarios | `hikes` OK for 3 sites; `quest --strict --stage S20`-`S24`; image review; test:fast | NW2-T | 5 h |
| **NW2-N Wind hikes** | WIND agent | 7: the Mirage and Lufenia rings, the north oasis, moved spots, `MEADOWS` edits, scenarios | `hikes` OK for 2 sites; `--stage S26`-`S28`; image review; test:fast | NW2-T | 5 h |
| **NW2-S Saves** | integrator | 12: v5, `RELOCATE`, the reset rule, `--from-reset` states, the save tests | the save cases; `quest --strict --only c --from-reset` (background, about 15 min) | NW2-E, NW2-F | 3 h |
| **NW2-BAL Balance** | integrator | 11: re-fit, caps tight, the grind lever, the balance tests re-measured; the fights and levels table | `quest --strict` (d) OK; `tests/balance/*` OK; test:full | NW2-E, F, W, N | 6 h |
| **NW2-INT** | integrator | pending lists asserted empty; full compile and determinism (two full compiles, about 9 min); `quest --strict`; **`--strict --mutate` once, in the background (about 2 h 15 min)**; browser checkpoints with `&mute=1` (the canoe through the Cinder Gorge, the voyage to `fir_ice` and up the Rime Gorge, the dwarves' dock and the range seen from Matoya, the hikes at Onrac and Mirage, a taiga refusal at (65, 40), the Mode 7 marker over taiga); overview beside the classic; this plan's result section; PROGRESS; AGENTS "The world (pass NW)" (docks, barriers, checks, taiga) | all of 0 | all | 6 h |

- **Merge order:** NW2-0, NW2-T, then E, F, W and N in any order (each re-runs `world.py` after rebasing; the
  integrator full-compiles after each merge), then S, BAL and INT.
- **Totals:** about **57 h** of work. Critical path NW2-0 (7) -> T (8) -> F (10) -> BAL (6) -> INT (6, plus the
  mutate run) is about 40 h of wall clock with E, W and N in parallel with F.
- **Full compiles:** about 8 (one per world-changing merge, plus INT's 2 for determinism), each under the lock and
  the 6-worktree rule of NW 3.4.

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| N1 | S16 (24.5 against its cap of 25) and S21 (28.8 against 29) go over band from the new forced fights and the voyage | caps and refit first, then the grind lever (11, Q6); levels reported per stage |
| N2 | A generated river cuts a shorter canoe way through the ring, the neck or the fells | `gorges` measures the least-canoe path over all rivers; `ice_neck` and `duergar_range` are canoe-closed; GT-21, GT-40, GT-41 |
| N3 | The hike pass makes visible clean rings | the climate supplies most of the ring; jitter; the converted-cell count reported; an image review per site |
| N4 | The `cold` hints, `T_TAIGA` or the Duergar ridge's rain shadow repaint far chunks (locality) | hints are cut at 1.5 radii; the thresholds stay frozen; the range is a barrier line plus a ridge west of Matoya; `--region` previews report painted chunks; full compiles are the integrator's anyway |
| N5 | Act 1 changes: the Matoya walk, OW-15, a1Pins | the range stays at x >= 106 and away from Matoya's pins; the act-1 checks run on every compose |
| N6 | v4 saves strand a party (inside the Ice Cavern with the ship at Crescent, or in the west lobe) | v5 relocation and reset (12); `--from-reset` from the relocated states |
| N7 | The tip is too cramped for the hollow, a 26-cell gorge and a shore | the polygon gains a northern lobe (4); if needed, R-ice may enter from the east coast, as long as the dock rules hold |
| N8 | Taiga reads as forest (or as noise) | the luminance gap gate; snow speckle; a free Bedrock fallback (Q7) |
| N9 | Moving two anchor refs weakens the "classic" fit | the `relations` check encodes the classic relations the user asked for; the 31-pair table and its 20,000 placements are re-run |
| N10 | The `--mutate` run grows past 2 h 30 min | 4 new rows of about 30-90 s each; run once, in the background, at INT |
| N11 | The dwarves' pocket loses its only dock to a coast tidy (a jog or inlet fill) | the dock is a pin with `cove=True`; `docks` and `dock_towns` check it on every compose |

## 16. Open questions for the user (each with a recommended default)

| # | Question | Default |
|---|---|---|
| Q1 | Mount Duergar: move the cave north into the mainland's west lobe (as asked; its anchor ref changes), or keep the cave and move the canal south of it (the anchor is kept, the canal opens next to Melmond)? | **move the cave** (D-NW2-5) |
| Q2 | Should the old south isthmus (the dwarves' land today) keep a small landmark (a cairn or an abandoned dock post), or stay empty land? | empty land |
| Q3 | K = 18 and U = 36 steps (about 21-42 classic tiles)? Or longer, e.g. K = 24? | **K 18, U 36** |
| Q4 | Gaia, the Citadel and Bahamut: give them hikes too? | no; they keep today's landings, within U |
| Q5 | The waterfall's canoe leg is only 3 forced canoe steps today. Apply the gorge rule (M, N) to R-waterfall too? | no; report it only |
| Q6 | Balance: may the plan lower a stage's `grind` (by 0.5 steps, never below 1.0) to keep levels in band once the forced fights are added? Or should levels be allowed to rise to the band's top + 1 with no grind change? | **lower grind where needed** |
| Q7 | Taiga's look: a code-drawn recolour of the forest with snow-capped crowns, or a free Bedrock texture pass from the start? | code-drawn; Bedrock only if the image review fails |
| Q8 | Taiga's battle backdrop: `dark_forest` or `forest`? | `dark_forest` |
| Q10 | Keep the legend char `t` for taiga, so the world source rows stay byte-stable? | keep `t` |
| Q11 | v4 saves: the targeted relocation and reset of 12, or reset every overworld v4 save to Cornelia? | targeted |
| Q12 | Keep the zone id `fir_tundra` (the Frost Hollow, quest S16 `zones`), or rename it `fir_taiga`? | keep the id |

Closed by the 2026-11-21 rulings:
- NW's Q6 (the airship lands on tundra) is superseded by D-NW2-4 (taiga, no landing).
- This plan's former Q9 (taiga's speed and encounter rate) is closed by D-NW2-7: forest's modifiers.

The remaining numbers Q10-Q12 are kept as they were, so references stay stable. NW's Q3, Q7 and Q9 are unaffected. NW's Q8 (keep the fight count) is replaced for NW2 by 11's rule (keep
the levels; the forced fights are wanted).

## 17. TODOs

```markdown
## TODOs
- [x] Measure the baseline (forced canoe, hikes, docks, crops) at 37cce624 (2026-11-21)
- [x] Fold in the rulings of 2026-11-21 (taiga; forest's modifiers, D-NW2-7) (2026-11-21)
- [ ] User answers Q1-Q12 (priority: high, effort: 0.5h)
- [ ] NW2-0 contract and checks in pending mode (priority: high, effort: 7h)
- [ ] NW2-T taiga: runtime, Python, art, tests (priority: high, effort: 8h)
- [ ] NW2-E Duergar north of the canal, the range, the dock (priority: high, effort: 7h)
- [ ] NW2-F the ice tip, the Rime and Cinder gorges, the fir_ice dock (priority: high, effort: 10h)
- [ ] NW2-W Onrac, waterfall and caravan hikes (priority: medium, effort: 5h)
- [ ] NW2-N Mirage and Lufenia hikes (priority: medium, effort: 5h)
- [ ] NW2-S save v5 relocation and --from-reset states (priority: medium, effort: 3h)
- [ ] NW2-BAL refit, caps and grind; balance tests (priority: high, effort: 6h)
- [ ] NW2-INT: pending empty, full compile and determinism, --strict, --mutate (background), browser, overview, docs (priority: high, effort: 6h)
```

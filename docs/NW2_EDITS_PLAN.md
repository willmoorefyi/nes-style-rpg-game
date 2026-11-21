# NW2: edits to the natural world (plan, rev 2)

Base: `mainline` 37cce624 (pass NW closed; `docs/NATURAL_WORLD_PLAN.md`, "NW" below, sections cited as NW x.y).
Requests: the user, 2026-11-20 (R1-R5); rulings of 2026-11-21 (tundra is replaced by **taiga**, with forest's
modifiers); the user's answers of 2026-11-21 (Q3, Q4, Q6, Q11). Planning only: no code, data or map changes in this
document's commits.

Rev 2 (2026-11-21):
- the user's answers recorded (K 25, U 50; five hike sites only; the grind lever; the targeted save fix);
- momus's 6 blocking items fixed: E_canoe counts the canoe's 0.5 rate, the gates avoid the failing `--stage` (d),
  the contract and GT rows move into the tranches that build them, per-site landing modes, the mutation rows and
  fixtures, and save v5's host and rules;
- momus's suggestions 7-18 folded in.
See "Changelog" at the end.

Renders for this plan (from the committed source `assets-src/maps/overworld.yaml`, scratch script outside the repo):
`~/temp/ff-game/nw2/plan/01_dwarf_canal_matoya.png`, `02_fire_peninsula.png`, `03_peninsula_north.png`,
`04_mainland_west.png`, `05_water.png`, `06_wind.png` (8-11 px per cell, a grid line every 8 cells, entrances red,
docks magenta, landing spots cyan, patch cells orange).

Coordinates: a **world cell** is `(x, y)`. A **rel** point is Cornelia-relative world cells (`worldgen.spec.world`:
world = (146, 155) + rel), the unit the region specs use. A **ref** is classic tiles in `world-anchors.yaml`
(target = (146, 155) + 0.86 x ref).

## 0. Summary and success criteria

1. The Ice Cavern moves to the empty north tip of Crescent's peninsula. It sits in a walled frost hollow, reached from
   its own new dock `fir_ice` and then by canoe up a mountain gorge.
2. Gurgu stays where it is. The ring wall south of Crescent Lake thickens into a massif, so the only way to Gurgu is
   a long canoe gorge (R-volcano).
3. Mount Duergar moves north of the canal, into the mainland's west lobe. A new range walls it off from Matoya, and
   its dock `ert_dwarf` moves with it.
4. A dock audit is derived from `quest.yaml` and becomes a compose check.
5. Five northern sites get hikes: no landing within K = 25 steps, a landing within U = 50.
6. Tundra becomes taiga: TerrainType 12, walkable with forest's modifiers, and no landing.

```json
{
  "functional": [
    "fir_ice is unreachable on foot from every start, reachable by foot+canoe only through the fir_ice dock (S16)",
    "fir_volcano is unreachable on foot from every start and reachable by foot+canoe from fir_crescent's dock (S15)",
    "each gorge's least-canoe path has >= M=26 forced canoe steps and >= N=12 pass cells, with E_canoe >= 1.0 counting the canoe's 0.5 rate",
    "ert_dwarf lies north of the canal; it is reachable only from the relocated ert_dwarf dock (Aldi), not from Matoya (duergar_range) and not from Elfland (duergar_south)",
    "every needs_dock town (derived from quest.yaml) has a dock in a basin the ship reaches at its bandStage",
    "for wat_onrac, wat_waterfall, wat_caravan, wnd_mirage, wnd_lufenia: no landing within K=25 steps (foot+canoe), one within U=50 in the site's mode; E_hike >= 1.0",
    "the airship lands on grass only (taiga 12 and snow 13 refuse); taiga walks at forest's speed with forest's (absent) rate modifier; no ship or canoe on it",
    "every stage's requires, grants, after and boss are unchanged; npm run quest -- --strict --mutate is OK"
  ],
  "observable": [
    "world.py prints OK lines for canoe_gates, gorges, relations, duergar_south, dock_towns, hikes",
    "the figures: forced canoe steps, pass cells and E_canoe per gorge; d and E_hike per hike site",
    "the anchor table: dwarf (100, 121), ice (214, 108) at their targets; fitted s* in [0.75, 0.95]",
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
| Ice Cavern `fir_ice` | (184, 193), 12 cells from Gurgu (177, 203); both in the south lands behind `crescent_ring` |
| Least-canoe path Crescent's gate to Gurgu | 110 steps, **5** canoe steps, 2 pass cells (the shortest path is 66 steps, 28 canoe) |
| Least-canoe path Crescent's gate to the Ice Cavern | 127 steps, **5** canoe steps (momus's re-measure; rev 1 said 6 / 69) |
| Least-canoe path Onrac to the waterfall | 37 steps, 3 canoe steps |
| Canal patch | x 93-100, y 140-142; the ship stops at (101, 141) while it is shut |
| Dwarves `ert_dwarf` | (98, 152), south of the canal; dock (104, 152), Aldi, 6 steps; reachable on foot from `elf_port` (72 steps), hence S10's `nonLoadBearing` (`ert_dwarf`) and S4's (`elf_port`: "Elfland is also reachable on foot from ert_dwarf") |
| The mainland's west lobe | x 86-112, y 98-125: walkable from Matoya (128, 120), with no site on it |
| Crescent's peninsula, north tip | x 205-232, y 101-128: grass west, forest and two generated tarns and rivers in the east strip (x 219-233), no site |
| Docks | `a1_pravoka` (aldi, 2 steps to the gate), `elf_port` (aldi, 10), `ert_dwarf` (aldi, 6), `ert_melmond` (ocean, 4; the giant's mouth 24, the Cavern of Earth 34), `fir_crescent` (ocean, 2). `wnd_s_ship` is a dock-kind parking spot (the ship at anchor off WIND), not a dock |
| Nearest landing (grass) to a north site, foot+canoe steps | Onrac 0, waterfall 4, caravan 0, Mirage 2, Lufenia 0, Gaia 0, Citadel 0, Bahamut 0 |
| Grass within 25 steps (foot+canoe) of the five hike sites | Onrac 304, waterfall 162, caravan 227, Mirage 17, Lufenia 177 (they overlap) |
| Landing spots | all 13 on grass, none on tundra. `RESET_SPOTS`: `a1_s_pravoka_ship`, `a1_s_airship` (act 1, grass) |
| Tundra | 1,301 cells, all north of y 100; 8 road cells north of y 100 (momus) |
| Canoe encounter rate | `CanoeMode.getEncounterRateMultiplier()` 0.5; the curve model's `MODE_RATE.canoe` 0.5 (`questCurve.ts:31`) |
| Step factors at the upper clamp 2.25 (rate 23-50, mean 36.5) | `fir_rivers`, `fir_sea`, `fir_ashlands`, `fir_lakeshore`, `wat_isles`, `wat_streams`, `wnd_highlands`, `wnd_lufen_moor` |
| Curve levels (NW 16) | S16 evil_eye 24.5, cap 25 (band [21, 24] + 1); S21 28.8, cap 29 |
| `--stage` (d) on today's world | fails at S16, S17, S21, S24-S29 (15 failures, NW 16); the full `--strict` run is OK. **No NW2 gate uses `--stage` (d)** |
| Files at a line ceiling | `worldgen/gates.py` 249; `questMutateFind.ts` 239; `gates_reach.py` 211; `questTravel.ts` 212; `prewalk.py` 178 |

## 2. Decisions, constants and glossary

| Id | Decision | Source |
|---|---|---|
| D-NW2-1 | **K = 25, U = 50** (Q3). A hike's floor is 25 steps, about 29 classic tiles; its cap is 50 | user 2026-11-21 |
| D-NW2-2 | **N = 12, M = 26.** Each gorge has >= 26 forced canoe steps, of which >= 12 are pass cells; its route holds >= 28 cells | 4 |
| D-NW2-3 | **Expected fights count the mode's rate:** E = sum over the path of `MODE_RATE[mode] / mean(zone rate)`. E_canoe >= 1.0 per one-way gorge: 26 x 0.5 / 12.5 = 1.04 with `fir_rivers` at factor <= 0.75 (rate 8-17). E_hike >= 1.0 per one-way hike, at walking rate 1, which bounds each hike zone's factor at d / 16 (8) | momus 1 |
| D-NW2-4 | **Taiga replaces tundra** (user). TerrainType value 12 is kept; ship and canoe are refused; the airship cannot land. Snow is unchanged. NW's Q6 is superseded | user |
| D-NW2-5 | **The dwarves move; the canal stays** (Q1, default accepted). Anchor `dwarf` ref (-56, -4) -> (-54, -40); `ice` ref (44, 44) -> (79, -55) | 9 |
| D-NW2-6 | **Frozen:** every stage's `requires`, `grants`, `after` and `boss`. Allowed: `walk` events, `entry` spot cells, `nonLoadBearing`, and `grind` (Q6) | |
| D-NW2-7 | **Taiga has forest's modifiers** (user): walking speed 0.7, and forest's encounter-rate modifier, which is none today (no terrain modifies the rate) | user |
| D-NW2-8 | **No global widening of the cold band.** `T_TAIGA` stays 0.5, the tundra band's threshold, so the cold belt keeps its shape: the 1,301 old tundra cells become taiga and only their art changes. Taiga spreads only through local `cold` hints at the hike sites (cut at 1.5 radii) and the hike pass. This reconciles locality (risk N4) with the frozen thresholds; widening globally is Q13 | integrator, momus 9 |
| D-NW2-9 | **Hikes only at the five sites** (Q4). Gaia, the Citadel and Bahamut keep today's landings (d <= U) | user |
| D-NW2-10 | **The grind lever** (Q6): after the zone factors are capped and re-fitted, a stage still over may lower its `grind` in 0.5 steps, never below 1.0 | user |
| D-NW2-11 | **Targeted save fix** (Q11), with the rules of 12 | user |
| D-NW2-12 | **One source for the hike bounds:** `assets/data/world-anchors.yaml` gets a top-level `hike: {floor: 25, cap: 50, sites: {wat_onrac: walking, wat_waterfall: canoe, wat_caravan: walking, wnd_mirage: walking, wnd_lufenia: walking}}`. The Python side (`world_specs/common.anchors()`) and the TS side (`questLateData`) both read it. Other airship-only anchors use the cap only, on foot | momus 4, 17 |

The defaults accepted (2026-11-21): Q1 move the cave; Q2 the old isthmus stays empty; Q5 the waterfall's canoe is
reported only; Q7 code-drawn taiga art; Q8 `dark_forest`; Q10 the char `t`; Q12 keep `fir_tundra`.

Glossary:
- **Start:** prewalk's starts of the stage (NW 3.8): the ancestors' map exits on the overworld, `entry.at`, and every
  dock of the basins the ship reaches with the ancestors' grants. **"From every start" means the minimum over the
  starts.**
- **Least-canoe path:** over foot+canoe cells with every patch on, the path that minimises canoe steps first and
  total steps second, taking the minimum over the starts. **Forced canoe steps:** its canoe steps.
- **Pass cell:** a canoe cell on the least-canoe path with no walkable 4-neighbour and a Mountain cell within 2 cells
  on both sides perpendicular to its **flow**. The flow of a path cell is the direction of the path's step into the
  next cell. On a Lake cell, too, the flow is the path's step, so an open lake crossing is never a pass cell: its
  sides are water.
- **Hike distance d(site):** BFS steps from the site's arrival cell to the nearest `canLand` cell.
  - The floor is measured on foot+canoe (the canoe is held from S14, before every north stage).
  - The cap is measured in the site's mode from D-NW2-12: on foot for the four (T6b drops the canoe), foot+canoe for
    the waterfall.
  - Manhattan distance is the design lower bound used to place a landing: Manhattan >= K implies d >= K.
- **Landing:** a `canLand` cell: grass, with no transition, gate or static NPC.
- **needs_dock town:** a `towns:` record where (i) no stage in the `after` closure of its `bandStage` (inclusive)
  grants the airship, and (ii) its gate is not reachable on foot from `cornelia` with the patches open at
  `bandStage`.

## 3. Taiga (D-NW2-4, D-NW2-7, D-NW2-8)

**Forest's modifiers** (D-NW2-7), where they live:

| Modifier | Where | Forest | Taiga |
|---|---|---|---|
| Walking speed | `src/entities/WalkingMode.ts` `getSpeedMultiplier` (`PlayerController` reads it per target cell) | 0.7 | **0.7** |
| Encounter rate per terrain | none: `MovementMode.getEncounterRateMultiplier()` takes no terrain (walking 1.0, canoe 0.5); `EncounterSystem` reads zones | none | none; a test pins "no mode's rate reads terrain" |
| Curve-model step cost | none: `questCurve.ts` / `questExplore.ts` count by zone and mode (`MODE_RATE`), never terrain | none | none |
| Generator road cost | `worldgen/roads.py` (forest 2) | 2 | **2** (tundra was 1.2). The 8 north road cells are re-routed if they cross taiga; `road_check` holds |
| Step means | `layouts/world_balance.py` per zone | per zone | per zone (11) |

**Generation** (`worldgen/climate.py`):
- The `cold > 0.5` band writes `t` meaning taiga; `T_TAIGA` stays 0.5 (D-NW2-8).
- The new hint kind `cold` raises `cold` in a ragged disc, cut at 1.5 radii like `warm`.
- `Q_FOREST` / `Q_SAND` stay frozen. A note in `climate.py`: taiga overrides forest after the thresholds, so the
  forest share reported falls where taiga wins; the thresholds never move.

**Art** (no Gemini):
- 2x: `build_map.FALLBACK_MATERIALS["taiga"]` is a recolour of `forest` (hue -25, saturation 0.55, value 0.70) plus
  an optional fifth field: a deterministic snow speckle on the crowns' lit upper-left. `tree_clump` takes the same
  recolour on taiga edges.
- 1x: `tiles_cold.py` row 12 becomes dark conifers with snow; **rebuild `assets/sprites/terrain.png`** (`npm run
  assets terrain`).
- Placeholder colour `0x2f4a3a`. The review gate: a mean luminance gap of >= 10 % against forest.

**Backdrops.**
- The keys are lowercase `TerrainType` names (`BattleBackdrop.ts:17`), so renaming the enum makes `taiga` resolve by
  itself.
- `schemaValidation.ts` does not check terrain names today. Refusing a `tundra` key is a **new rule** (a key that
  never matches is a silent defect).
- The compiled `assets/maps/ai/overworld.yaml` keeps its `tundra:` keys until the integrator's recompile in NW2-T, so
  the rule and the recompile land together.
- `backdropTerrain`'s forest-edge rule (grass with >= 2 forest 4-neighbours reads `forest`) gains taiga: a grass
  cell with >= 2 taiga neighbours reads `taiga`; ties between the two go to forest.

**Files** (every row of NW 2.6's table, plus momus 8):

| File | Change |
|---|---|
| `src/types/index.ts` | `Taiga = 12` (rename; the value is kept) |
| `src/systems/fieldRules.ts`, `fieldRulesVehicles.ts` | `Taiga`; `airshipTerrainLands`: grass only |
| `src/entities/WalkingMode.ts`, `AirshipMode.ts` | 0.7 for `Forest \|\| Taiga`; comments |
| `src/rendering/chunkStreaming.ts`, `PlaceholderTextures.ts` | taiga `0x2f4a3a` |
| `src/scenes/exploration/BattleBackdrop.ts` | the taiga edge rule |
| `src/core/schemaValidation.ts` | the new rule: `tundra` refused as a `battleBackgrounds` terrain key |
| Mode 7 `FlightView.ts`, `FlightBillboards.ts` | none (they use `canLand`) |
| `assets-src/tools/build_map.py` | `LEGEND["t"] = "taiga"`; `TERRAIN`; `SOFT` / `ROUNDED` renamed in place (same index, so the same seed); `FALLBACK_MATERIALS`; `BLOCKED` unchanged |
| `assets-src/tools/map_checks_spots.py` | `GRASS, TUNDRA = 0, 12` becomes `GRASS = 0`; a `landing` spot is grass only |
| `terrain/base.py` `WILD`, `terrain/metrics.py` `FID_MATS`, `terrain/selftest.py` | rename |
| `worldgen/gates.py` `LANDING` | `["."]` (one line; the file stays at 249) |
| `worldgen/gates_reach.py`, `spots.py`, `stamps.py`, `metrics.py`, `roads.py`, `climate.py`; `layouts/world_api.py` (`TAIGA`), `world_checks.py` | rename; grass-only landing |
| Wording: `world_specs/water.py`, `fire/world_fire_nw_zones.py`, `water/world_water_nw_zones.py`, `wind/world_nw.py`, `ordeal/world_ordeal_nw.py` | "tundra" becomes "taiga"; the backdrop key `taiga` -> `dark_forest` |
| `nw2_selftest.py`, `map_selftest.py` | the legend case; "lands on grass, not on taiga or snow" |
| `tiles.py`, `tiles_cold.py`, `assets/sprites/terrain.png` | row 12 |
| AGENTS.md "The world (pass NW)" | "Snow `n` and taiga `t` (TerrainType 13 / 12; D-NW9, D-NW2-4): walkable (taiga at forest's speed), no ship or canoe, the airship lands on grass only" |

**ORDEAL's and the others' landings.** With D-NW2-8 only the old tundra changes. If `landings` (8) fails for the
Citadel (125, 59), Bahamut (163, 87) or Gaia (212, 43), the **NW2-T agent** owns the fix. It may edit ORDEAL's and
WIND's content modules for this alone: a grass meadow stamp within U of the anchor.

## 4. R1 + R2: FIRE (the Ice Cavern moved; both sites canoe-gated through gorges)

| Feature | Position (indicative; the FIRE tranche fixes them inside the bounds) | Rule |
|---|---|---|
| Ice Cavern `fir_ice` | target **(214, 108)** (ref (79, -55)), in the **Rime Hollow**: a walled snow floor, inner radius about 4, centre about (215, 110) | barrier `ice_ring`, foot only (R-ice crosses it); seeds `fir_ice` and the spot `fir_s_ice_shore` (the seed format gains `spot:` names, `bundle.py`) |
| Rime Tarn | a pinned lake, about (216, 112), radius 2 | R-ice's source |
| Rime Fells | a massif from the ring south-west to the coast (x 205-224, y 112-127) | holds the gorge |
| R-ice (re-pinned) | from the tarn's outlet, winding through the fells to a sea mouth by the dock: **>= 28 route cells, >= 26 forced canoe steps, >= 12 pass cells** | `gorges`, `routes` |
| Dock **`fir_ice`** | a cove on the tip's west coast at about **(206, 124)**, **ocean**; <= 6 walking steps to R-ice's mouth | `docks`, `straits` |
| Frost Shore | the walkable strip from the dock to the mouth (8-30 cells, taiga and snow) | zone `fir_tundra` |
| The east strip (x 223-233, y 101-127) | stays land north of `ice_neck`. The cold hint makes it taiga, in zone `fir_tundra`. Its generated tarns and rivers drain east to the sea, never into the hollow: `routes` gains "no unpinned river crosses a foot-only ring barrier". If R-ice needs the room, the strip may become Fells rock instead | `routes`, `gorges` |
| `ice_neck` (new barrier) | a ridge across the peninsula at y about 126-131, coast to coast, joined to the north hills ridge | **foot and foot+canoe** closed; seeds `fir_crescent` and `fir_ice` |
| Cold | `ClimateHint("cold", rel (68, -44), 16)`; the tip's walkable cells >= 60 % taiga and snow | figure, gate 50 % |
| Peninsula polygon | `SOUTHEAST` gains a northern lobe (rel about (58, -50), (66, -56), (76, -52), (82, -44)), about +150 land cells (and it lifts land off its floor) | `world` |
| Gurgu `fir_volcano` | unchanged at (177, 203) | |
| Cinder Wall | `crescent_ring` south of the lake thickened into a massif (x about 180-206, y 184-197) by a `Ridge` of width 6 alongside the barrier line | `barriers` |
| R-volcano (re-pinned) | the lake's south-west shore (about (205, 184)) -> a gorge south-west (rel about (59, 29), (54, 35), (45, 41), (40, 43)) -> the ash near (186, 198) -> its sink: **>= 26 forced canoe steps, >= 12 pass cells** | `gorges`, `routes` |
| `crescent_ring` seeds | `("fir_crescent", ("fir_volcano", "fir_desert"), False, False)`: **`fir_ice` dropped**, so GT-37's cut cannot open `ice_neck` | `barriers` |
| Old frost hollow and old R-ice | removed (inside the Cinder Wall); the south lands are ash and dunes | |
| Corridors | `fir_south` becomes (fir_volcano, (37, 48), (46, 49), fir_desert); `fir_ash` is dropped; new `fir_ice_shore` (dock:fir_ice, R-ice's mouth) | prewalk does not cover them (they are post-canoe); `canoe_gates` does |

- **Gorge stamps.** `Gorge(route, i0, i1)` (`bundle.py`) forces Mountain on both banks (1-2 cells) of route cells
  `i0..i1`: new `worldgen/gorges.py`, plus the carved valley in `relief.py`.
- **Zones.**
  - `fir_tundra` (the Frost Hollow; the id is kept) moves to the tip.
  - The gorges stay in `fir_rivers`, whose factor is capped at **<= 0.75**.
  - The old hollow's cells go to `fir_ashlands` or `fir_desert`; the floe and the pines move with the cave.
- **Files.**
  - Spec and content: `world_specs/fire.py`, `fire/world_fire_nw.py`, `fire/world_fire_nw_zones.py`,
    `fire/fire_tables.py`.
  - Generator: `worldgen/bundle.py`, `gorges.py`, `relief.py`, `gates_reach.py` (the `routes` rule).
  - The contract entries this tranche owns (14): `layouts/world_api.py` (`fir_ice` dock, the barriers, the
    `crescent-ice` strait), the TS `questLateData.DOCKS_ALLOWED` (`fir_ice: 'ocean'`).
  - Data: `world-anchors.yaml` (`ice`, detours), `quest.yaml` (S16 `walk`), `debug-scenarios.yaml` (`w_s16_*`).
  - Mutation: `questMutateRows.ts` (GT-21, GT-37, GT-40, GT-41, GT-43), `questMutateFind.ts` (`canoeCut` with
    `dock:`), `tests/fixtures/quest/mini.yaml`.
- **Progression.**
  - S15 runs Crescent's dock -> the lake -> R-volcano -> Gurgu.
  - S16's `walk` gains `overworld:board:ship` and `overworld:dock:fir_ice` before `overworld:warp:ice-cavern-b1`. Its
    `entry` stays at `fir_s_crescent` with the ship at `fir_s_crescent_ship`.
  - S17's hull is reached by R-volcano only.
  - The ship reaches the ocean after CANAL_OPEN (S10, an ancestor).
  - New spots: `fir_s_ice_ship` (dock), `fir_s_ice_shore` (land).

## 5. R3: Mount Duergar north of the canal (EARTH + A1)

| Feature | Position | Rule |
|---|---|---|
| Dwarf hall `ert_dwarf` | target **(100, 121)** (ref (-54, -40)), at the north foot of the hogback's north peak | `relations` |
| Duergar pocket | the west lobe, x about 86-108, y 98-125 (about 300 walkable cells) | zone `ert_isthmus` (seed: the hall) |
| `duergar_range` (new barrier) | a N-S ridge from the north coast (about (109, 98)) to the Aldi's north-west corner (about (112, 121)), >= 3 rock cells thick, joining the mainland ridge's west end | **foot and foot+canoe** closed; seeds `("a1_matoya", ("ert_dwarf",), True, False)` |
| South side: **`duergar_south`** (its own check) | the hogback (W_west, W_isthmus) and a rock strip at y 136-139 between the hogback's east foot and the Aldi | the barrier seeds have no canal-shut option, so this is a new check (8): with the **canal patch off** (its saddle walkable) and the bridge on, `ert_dwarf` and `elf_keep` are joined neither on foot nor on foot+canoe |
| Dock `ert_dwarf` (moved; the id is kept) | a cove in the Aldi's north-west corner, about **(104, 124)**, aldi, <= 6 steps from the hall | `docks`, `dock_towns`, `straits` |
| Canal | unchanged, south of the dwarves | |
| Old south isthmus | stays EARTH land walkable from Elfland, empty (Q2). Its cove is closed | zone `ert_isthmus` by a second flood seed (the canal's south bank) |
| Ownership | EARTH's `ISTHMUS` grows north over the lobe to the range crest; A1's `EXT_A1` is trimmed east of it. One tranche moves the owner line once | `owners`, `coverage` |

- **Act 1 is kept:** the range stays at x >= 106, away from Matoya's pins; `a1Walks` within ±10 %; OW-15 is
  re-measured (about 300 cells leave `a1_mainland`).
- **Files.**
  - Specs: `world_specs/earth.py`, `world_specs/a1.py`.
  - Content: `earth/world_earth_nw.py`, `earth/world_earth_nw_ground.py`, `a1/world_a1_nw.py`.
  - Contract: `world_api.py` (`ert_dwarf` text, `duergar_range`); the check `duergar_south` (`gates_canoe.py`).
  - Data: `world-anchors.yaml` (`dwarf`, detours); `quest.yaml`: **S10's and S4's dock `nonLoadBearing` entries are
    removed** (both docks become load-bearing: Elfland is no longer reachable on foot from a dwarves' landing).
  - Mutation: `questMutateRows.ts` (GT-5b's wording, GT-42), `mini.yaml`.
  - Tests: `tests/data/worldSpots.test.ts:84`, whose list drops `S4 dock elf_port` and `S10 dock ert_dwarf`.
- **Mutation, no edit needed for GT-5 and GT-14:** a row with `nlb: 'entry'` counts as caught as soon as its
  mutation fails a proof (`questMutate.ts:72`), so both become caught once their docks are load-bearing. GT-5b's
  wording becomes "the Aldi docks elf_port and ert_dwarf"; it still expects `[goal]`.
- **Progression.**
  - S10 is reached by ship from Pravoka.
  - The dwarf town's `opensAfter [S2]` is now guarded by `duergar_range`; GT-42 proves it.
  - S11 sails south through the canal.
  - S31 (Smyth) is reached by airship onto the lobe's grass: not a hike site.

## 6. R4: dock audit

| Town | bandStage | Airship before? | On foot from Cornelia? | needs_dock | Dock, basin, dock-to-gate steps |
|---|---|---|---|---|---|
| pravoka | S2 | no | yes (after S1) | no | `a1_pravoka`, aldi, 2 |
| elfheim | S6 | no | no | **yes** | `elf_port`, aldi, 10 |
| dwarf | S10 | no | no | **yes** | `ert_dwarf`, aldi, 6 (NW2 <= 6) |
| melmond | S11 | no | no | **yes** | `ert_melmond`, ocean, 4 |
| crescent | S14 | no | no | **yes** | `fir_crescent`, ocean, 2 |
| onrac, gaia, lufenia | S20, S23, S26 | yes | no | no | none (airship) |

Every southern town has its dock today. The non-town dock sites:
- `elf_keep` and `elf_marsh` from `elf_port` (41 and 68 steps);
- `ert_giant` and `ert_earth_cave` from `ert_melmond` (24 and 34);
- `fir_volcano` from `fir_crescent` plus the canoe;
- `fir_ice` from `fir_ice` plus the canoe (NW2).

The check `dock_towns` (8) passes on today's world, so it lands in NW2-0.

## 7. R5: northern hikes (K 25, U 50; WATER, WIND)

**Mechanism.**
- `Hike(site, landing, fill)` records in the region specs. The pass `worldgen/hikes.py` runs after the region content
  and before `spots.resolve`.
- The pass measures by **foot+canoe** (the floor's mode). Every grass cell with d < K + jitter (jitter 0-4 from fbm,
  so the ring is never a clean disc) becomes `fill` by local climate:
  - taiga where `cold > 0.2`;
  - sand in an `arid` hint;
  - swamp in a `wet` hint;
  - forest otherwise.
- The pass leaves pins and roads alone. The arrival cell becomes taiga or sand, so it stays walkable.
- It then stamps the landing meadow, a ragged grass disc of radius 1.5.
- Most of the ring comes from the `cold` hints and the existing sand. The pass's converted-cell count is reported per
  site (a figure; today's ceiling is the 887 grass cells of 1, with overlap).
- Removed: WIND's `MEADOWS` for Mirage and Lufenia, and WATER's oasis and Onrac meadows (`CARAVAN_LANDING_OFF`, the
  S24 bank). Gaia's meadow stays.

**Landings** (re-derived for K 25 / U 50 by BFS on today's ground; d is to the landing cell itself, before the pass
adds taiga. The floor is the minimum over all five sites, so no landing serves one site too close to another):

| Site | Ring | Landing spot -> cell | d floor (foot+canoe, min over the five) | d cap (mode) | Manhattan | Hike zone, factor bound d / 16 |
|---|---|---|---|---|---|---|
| Onrac `wat_onrac` | taiga belt (`cold` hint rel (-79, -86), 16) | `wat_s_onrac_airship` -> the south coast meadow **(53, 85)** | 30 | 34 on foot | 30 | `wat_isles` <= 1.9 |
| Caravan `wat_caravan` | the dunes plus taiga to the north | `wat_s_caravan_airship` -> the same meadow, **(52, 85)** | 35 | 35 on foot | 35 | `wat_dunes` (0.67) |
| Waterfall `wat_waterfall` | snow and taiga on the spine's flank | **new** `wat_s_waterfall_airship` -> the east downs **(84, 55)** | 31 (Onrac's) | 34 foot+canoe (none on foot) | 34 | `wat_isles`, `wat_streams` <= 2.1 |
| Mirage `wnd_mirage` | the sands; the oasis becomes sand | `wnd_s_mirage_airship`, `wnd_s_sky_airship` -> a north oasis inside the ring, **(191, 43)** | 34 | 34 on foot | 34 | `wnd_mirage_sands` <= 2.1 |
| Lufenia `wnd_lufenia` | taiga and forest moor (`cold` hint rel (72, -79), 14) | `wnd_s_lufenia_airship` -> the east coast, **(243, 70)** (one of 12 cells that qualify; the tightest site) | 31 | 31 on foot | 31 | `wnd_lufen_moor` <= 1.9 |
| Gaia, Citadel, Bahamut | unchanged (Q4) | unchanged | | <= U | | |

- E_hike at those d, with every bound met: at least 1.0 one way (for example Onrac 34 / (16 x 1.9) = 1.12).
- The hike zones' factor caps in `world_balance.CAP` are the bounds above, rounded down to 0.05.
- **Airship-only gates.** `north` is unchanged. T6 / T6b (10): the four are reachable on foot from a landing within
  U; the waterfall only with the canoe.
- **Files.**
  - WATER: `world_specs/water.py`, `water/world_water_nw.py`, `water/world_water_nw_zones.py`.
  - WIND: `world_specs/wind.py`, `wind/world_nw.py`, `wind/world_nw_objects.py`.
  - Generator: `worldgen/hikes.py`, `bundle.py`, and `layouts/world.py` (one call, one check line).
  - Data: `debug-scenarios.yaml` (the `w_s20`-`w_s28` scenarios keep their spot names).

## 8. Checks (compose-time, in NW 3.8's style; `world.py` prints one line each)

New code: `worldgen/gates_canoe.py` (`canoe_gates`, `gorges`, `relations`, `duergar_south`), `worldgen/gates_hike.py`
(`hikes`), and `dock_towns` in `prewalk.py` (about +45 lines). Each check gets a failing fixture in
`selftest_gates.py` (+6 cases). **A check runs over the records the specs declare** (`Hike`, `Gorge`, `Relation`,
the barrier seeds). With none declared it prints `OK (none declared)`, so the code can land before the geography (14).

| Check | Patches | Rule |
|---|---|---|
| **barriers** (extended) | all on | `duergar_range`, `ice_neck`: closed on foot and foot+canoe (`CANOE_BARRIERS`); `ice_ring`: foot only; each minimal cut >= 3 cells, exported to `world.cuts` |
| **duergar_south** | canal **off**, bridge on | `ert_dwarf` and `elf_keep` are joined neither on foot nor on foot+canoe |
| **canoe_gates** | all on | for each declared gorge site (`fir_volcano` S15, `fir_ice` S16): over every start (glossary), (i) unreachable on foot; (ii) reachable on foot+canoe; (iii) for `fir_ice`, unreachable on foot+canoe once the `fir_ice` dock is withheld |
| **gorges** | all on | on (ii)'s least-canoe path: forced canoe >= M (26), pass cells >= N (12), **E_canoe = sum of 0.5 / mean(rate) >= 1.0** at the rates `world_balance` wrote (the canoe's `MODE_RATE` counted); prints steps / pass cells / E |
| **relations** | off | `fir_ice.y <= fir_crescent.y - 40`, its bearing from Crescent within 30 degrees of north, dist(`fir_ice`, `fir_volcano`) >= 60; `ert_dwarf.y <= min canal y - 10`, its bearing from the canal centre within 45 degrees of north |
| **hikes** | all on | for each declared hike: d floor >= K (foot+canoe, min over the five sites), d cap <= U in the site's mode (D-NW2-12), every path cell in a zone, E_hike >= 1.0; prints d and E |
| **landings** (changed) | all on | grass only. Every `landing` spot is `canLand`. Every airship-only anchor has a landing within U steps **in its mode** (D-NW2-12; the waterfall foot+canoe, the others on foot; was "8 grid steps") |
| **dock_towns** | per stage | each needs_dock town has a dock whose basin the ship reaches at `bandStage`, its gate within 12 steps of the dock's shore |
| **routes** (changed) | all on | the new ends of R-ice and R-volcano; no ford on a route; **no unpinned river crosses a foot-only ring** (`crescent_ring`, `ice_ring`) |
| **straits** (+1) | all on but `canal` | `crescent-ice` (`fir_crescent` to `fir_ice`) >= 3 cells wide |
| **docks** | all on | `fir_ice` allowed (ocean); no dock at the old dwarf cove |
| **prewalk** | per stage | unchanged range S0-S14; now proves S10's hall from the moved dock |

**`--worst-canoe`** (no code change):
- T1 keeps `ert_dwarf` (ALDI) out of reach because `duergar_range` is canoe-closed.
- T2 (the ship, the canal shut) cannot reach the ocean, so neither `fir_ice` nor its dock.
- T3-T4 keep the SOUTH exception: `fir_ice` is now reached through its own dock and the canoe, by design.

## 9. Anchors and proof (g)

- **Targets.** `dwarf` ref (-54, -40) -> (100, 121); `ice` ref (79, -55) -> (214, 108). Each record gets a note
  (NW2 ruling, the old ref). Tolerance ±2.
- **Bands.** keep-dwarf 55.3 against an actual 55.2; dwarf-melmond 40.9 against 41.1. crescent-ice (a long pair,
  d_r 75.8) and ice-desert (117) are re-checked. s* is re-fitted within [0.75, 0.95] (today 0.851). The full 31-pair
  table is re-run with 20,000 ±2 placements, at most 0.05 % failing, and goes in the NW2-F result.
- **Detours (TS):** the `MODES` table at `src/progression/questGeo.ts:117` gains `'ship+canoe+walking': ['walking',
  'ship', 'canoe']`.
  - `crescent-ice` and `ice-desert` use it, factor 2.5 (estimates 1.5 and 1.6).
  - `dwarf-melmond` tightens from 4.5 to **2.5** (estimate 1.5; via "south through the canal").
- **Detours (Python):** `("fir_ice", "fir_desert")` is **removed** from `gates_reach.DETOURS`, which is a foot-only
  BFS. The TS proof (g) covers the hop in its new mode.
- **Owner:** NW2-F edits `ice` and its two detours; NW2-E edits `dwarf` and `dwarf-melmond`.

## 10. Proof (h), docks and the mutation suite

- **Contract** (each entry lands with the tranche that builds its geography, 14):
  - `DOCKS_ALLOWED` gains `fir_ice` (ocean), in both `world_api.py` and `questLateData.ts:23` (NW2-F).
  - `ert_dwarf`'s place text changes (NW2-E).
  - `BARRIERS` gains `duergar_range` (E), `ice_neck` and `ice_ring` (F); `CANOE_BARRIERS` gains `duergar_range` and
    `ice_neck`.
  - `gates.STRAITS` gains `crescent-ice` (F).
- **Travel rows** (`questTravelRows.ts`):
  - B2's docks gain `fir_ice` (F).
  - T6's `landing` and `questTravel.landingNear` become a BFS **in the anchor's mode** (the `hike.sites` map,
    default walking), bounded by `hike.cap` from `world-anchors.yaml` (D-NW2-12; the one source). This passes on
    today's world, so it lands in NW2-0.
  - T6b is unchanged (no canoe; the waterfall is out of reach).
- **Mutation rows** (`questMutateRows.ts`):
  - GT-21: R-volcano's cut from `fir_crescent` plus R-ice's cut from `dock:fir_ice` (F). `canoeCut` in
    `questMutateFind.ts` (239 lines, ceiling 250) accepts `dock:<id>`, resolved to the dock's walkable shore
    neighbour: at most +8 lines. If that would pass 250, `minimalCut` moves to a new `questMutateCut.ts`.
  - GT-37 expects `skip('S15')` (F).
  - New rows:
    - GT-40: `ice_ring` opened, expects `skip('S16')` (F).
    - GT-41: dock `fir_ice` removed, expects `[goal]` (F).
    - GT-42: `duergar_range`'s minimal cut **between `a1_matoya` and `ert_dwarf`** opened, expects
      `early('dwarf')` from proof (e) (E).
    - GT-43: `ice_neck` opened, `nlb` "the tip becomes walkable from Crescent's shore, so the fir_ice dock is
      redundant; S16 still needs the canoe" (F).
  - GT-5 and GT-14: no edit (5). GT-5b: wording only (E).
  - Each new row's element is added to `tests/fixtures/quest/mini.yaml` (an `ice_ring` cut, an `ice_neck` cut, a
    `duergar_range` cut, the `fir_ice` dock) in the same tranche, so `questMutate.test.ts` finds no MISSING row.
    `byRow('GT-21')` expects its new element count (2 -> 2 or 3, as the fixture's R-ice cut gives).
  - GT-38 and GT-39 stay unused.
- **Proofs (e) and (f)** are re-run at NW2-INT.

## 11. Balance (`layouts/world_balance.py`, the curve model)

- **Rule:** every band OK (d), each stage within +0.5 of NW's level, and (d2) / (d3) OK.
- **Levers, in order** (D-NW2-10):
  1. Re-fit `STEP_FACTOR` (NW-5's iterative fit, scratch outside the worktree), clamp [0.67, 2.25], with the new
     **`CAP` dict** asserted by `apply`: `fir_rivers` <= 0.75 (E_canoe); `wat_isles` 1.9, `wat_streams` 2.1,
     `wnd_mirage_sands` 2.1, `wnd_lufen_moor` 1.9 (E_hike at the measured d, 7). The caps are re-derived from each
     tranche's final d.
  2. A stage still over lowers its `grind` by 0.5 steps, never below 1.0.
  3. **Fallback for a stage already at grind 1.0** (S25, S27, S28): raise the factors of the stage's other walking
     and sea zones toward the 2.25 clamp (fewer fights), never past a `CAP`. If that is not enough, the hike zone's
     cap may rise only while that site's E_hike stays >= 1.0. The `hikes` check enforces this.
  4. No enemy, item, formula or band change.

| Stage | Band (cap) | NW level | grind | Added by NW2 |
|---|---|---|---|---|
| S10 dwarves | [11, 14] | measured | 6.0 | the voyage to the new dock: 91 sea steps against 66 (momus) |
| S11 Cavern of Earth | [13, 16] | measured | 7.0 | the dwarves' dock -> the canal (a shorter sail) |
| S15 Gurgu | [21, 24] | measured | 3.0 | the Cinder Gorge (>= 26 canoe steps at factor <= 0.75) |
| S16 Ice | [21, 24] | 24.5 | 2.0 | the voyage round the peninsula, the Rime Gorge, the shore |
| S17 hull | [22, 25] | measured | 4.0 | the return voyage from `fir_ice` and the Cinder Gorge |
| S18 / S19 | [24, 27] | measured | 2.0 | none |
| S20 Onrac | [25, 28] | measured | 7.0 | the Onrac hike (d 34) |
| S21 waterfall | [25, 28] | 28.8 | 2.0 | the waterfall hike (d 34, partly canoe) |
| S22 caravan / S23 Gaia | [25, 28] / [26, 29] | measured | 2.0 | the caravan hike / none |
| S24 Sea Shrine | [27, 30] | measured | 2.0 | the Onrac hike (entry spot moved) |
| S25 Melmond / S26 Lufenia | [28, 31] | measured | 1.0 / 2.0 | none / the Lufenia hike (d 31) |
| S27 Mirage / S28 sky castle | [29, 32] / [31, 34] | measured / 33.9 | 1.0 / 1.0 | the Mirage hike (d 34) / the moved sky airship spot |
| S31 (optional) | none | measured (wipe bound 0.45) | 1.0 | the airship to the dwarves' lobe |

NW2-BAL fills every "measured" cell for both worlds and reports the fights per stage. `tests/balance/questCurve.test.ts`
keeps its 3-point margins and wipes under 0.2 per stage (S31 0.45). `fieldCampaign`, `fieldPacing` and `zones` are
re-measured.

## 12. Spots, saves (v5) and Mode 7

**Spots.** No renames.
- Moved: `ert_s_dwarf`, `ert_s_dwarf_ship`, `wat_s_onrac_airship`, `wat_s_caravan_airship`, `wnd_s_mirage_airship`,
  `wnd_s_sky_airship`, `wnd_s_lufenia_airship`.
- New: `fir_s_ice_ship`, `fir_s_ice_shore`, `wat_s_waterfall_airship`.
- `RESET_SPOTS` is unchanged.
- `wnd_s_ship` stays a dock-kind spot: a ship at anchor in open Water, not a `DOCKS_ALLOWED` dock.

**Versions.**
- `worldReset.ts` keeps `NW_SAVE_VERSION = 4` (the first NW world) and adds **`NW2_SAVE_VERSION = 5`**.
- `SaveManager.SAVE_VERSION = NW2_SAVE_VERSION`; its accepted list becomes `[1, 2, 3, NW_SAVE_VERSION,
  NW2_SAVE_VERSION]`.
- `isPreNw` (< 4) is unchanged; the new `isPreNw2` is version 4.
- A v1-v3 save takes the D-NW8 reset as today.

**Host.** `SaveManager.load` stays synchronous and `resetSave` stays pure.
- For a v4 save, `LoadScene` (async) loads the `overworld` map and, if the save is inside a map, that map, before it
  switches scene.
- It builds the collision with the save's flags' patches applied, through the same patch code the field uses
  (`fieldRules` / the patch overlay).
- It then calls a new pure function, `revalidateNw2(save, world)` (`src/systems/worldRevalidate.ts`, under 250
  lines).
- The result sets `pendingEntrance` / `pendingNotice` as the reset does today, or rewrites the save's vehicle or party
  cells.

**Rules** (keyed on each parked vehicle and on the party's cell, never on the party's map alone):
1. **Ship.** It is valid on Water inside a basin its flags open (aldi; ocean with CANAL_OPEN). Its **shore** is any
   walkable 4-neighbour of its cell; a ship with no shore is at anchor (like `wnd_s_ship`) and still valid. An invalid
   ship (its cell became land, as at the old dwarf cove (104, 152)) moves to the allowed dock in the party's
   foot-component, if there is one, else to the nearest allowed dock of an open basin. A party in elfheim, the keep
   or the marsh therefore gets its ship at `elf_port`.
2. **The party inside a map:** its component is that of the map's overworld exit entrances. If that component holds
   no ship shore, no airship and not Cornelia, the ship moves to the component's dock: `dwarf-hall` -> `ert_dwarf`,
   `ice-cavern-*` -> `fir_ice`.
3. **Airship.** It is valid on a walkable cell (it may stand on taiga or snow; boarding needs no landing). If its cell
   became rock or water, it moves to the nearest `canLand` cell in the party's foot-component, else to the
   `RESET_SPOTS` airship spot.
4. **Party cell and mode.** In canoe mode on a cell that is no longer River or Lake (an old R-ice cell): walking mode
   if the cell is walkable. On foot on a non-walkable cell (the old frost hollow, now rock): rule 5.
5. **Stranded** (as D-NW8): the party's foot-component, after rules 1-4, holds none of Cornelia's entrance, its
   ship's shore or its airship. Then reset to Cornelia, the vehicles to `RESET_SPOTS`, with the one-time notice.

`--from-reset` (`questReset.ts`) adds the relocated states: S10 inside `dwarf-hall` with the ship at `ert_dwarf`,
S16 inside `ice-cavern-b1` with the ship at `fir_ice`, and S6 at the keep with the ship moved to `elf_port`. Proof
(c) runs from each.

**Mode 7.** The integrator's full compile re-bakes the atlas. The landing marker follows `canLand`, so it refuses
taiga. The browser checkpoint at (65, 40) (NW-INT's tundra landing) becomes a refusal over taiga, plus a landing at
the new Onrac meadow.

## 13. Tests

| Test | Change |
|---|---|
| `tests/systems/fieldRulesCold.test.ts`, `fieldRules.test.ts` | `Taiga` 12: walk yes, ship and canoe no, airship no; snow unchanged; 14 is Wall |
| `tests/entities/` movement modes | `getSpeedMultiplier(Taiga)` 0.7 as forest; no mode's rate reads terrain |
| `tests/scenes/mode7/mode7Cold.test.ts` | the marker over grass, not over taiga or snow |
| `tests/scenes/BattleBackdrop.test.ts` | `taiga` resolves; the taiga edge rule; ties go to forest |
| `tests/core/schemaValidation.test.ts` | the new rule: a `tundra` key is refused |
| `tests/rendering/PlaceholderTextures.test.ts`, `CollisionMap.test.ts`, `streamWindow` | taiga texture and colour |
| `tests/data/assetCoverage.test.ts` | the sheet row; `dark_forest` exists |
| `tests/quest/fire/fireWorld.test.ts`, `fir_d2_ice.test.ts`, `icePaths.ts`, `fir_d1_*`, `hazardPath` | the tip, `fir_tundra` there, gorge figures, corridors, the dock, vents off the new route |
| `tests/quest/earth/ert_o_world.test.ts`, `ert_o_walk`, `ert_t_walk` | the hall, the pocket's zone, the dock, the second `ert_isthmus` seed |
| `tests/quest/elf/elf_o_world.test.ts` | the dwarves are off ELF's foot component |
| `tests/quest/a1/a1Pins`, `a1Walks`, `a1_o_walk`; `tests/data/act1Flow.test.ts` | pins kept; walks within ±10 %; OW-15 |
| `tests/quest/water/*`, `tests/quest/wind/*`, `tests/quest/ordeal/ord_o_world.test.ts` | spots moved; the `taiga` key; hike d |
| `tests/data/worldSource`, `worldSpots` (:84 list), `worldGates`, `overworldZoneCoverage` | docks, spots, barriers, cuts; the `nonLoadBearing` list without S4 and S10 |
| `tests/progression/travelMatrix`, `macroGeography`, `worldAnchors`, `questSpots`, `questMutate` (GT-21 count, GT-40-43), `miniWorld.ts` + `tests/fixtures/quest/mini.yaml` | B2 docks; targets; landing modes; new rows' elements; the fixture's tundra cell becomes taiga |
| `tests/systems/saveWorldReset.test.ts`, `worldReset.test.ts`, new `worldRevalidate.test.ts`, `tests/progression/resetStates.test.ts` | v5: rules 1-5 (the ship at the old dwarf cove with the party in elfheim; inside `ice-cavern-b2` with the ship at Crescent; an airship on new rock; canoe mode on an old R-ice cell; stranded in the lobe); a valid v4 kept; v1-v3 as before |
| new `tests/data/northHikes.test.ts`, `canoeGorges.test.ts`, `dockTowns.test.ts` | 7, 4 (E with the canoe rate), 6 |
| `tests/data/questCeilings.test.ts` | finds `gates_canoe.py`, `gates_hike.py`, `hikes.py`, `gorges.py`, `worldRevalidate.ts` (each < 250 lines) |

## 14. Tranches

Rules:
- Each tranche is a branch from `mainline`, mergeable on its own. Agents run `npm run build`, `npm run test:fast` and
  `world.py`.
- The world is never hand-merged: each merge re-runs `world.py`, and the integrator full-compiles under the lock (one
  world compile at a time; 254 s, 11.2 GB) and commits the chunks.
- Agents preview with `--region` over an APFS clone of the committed compile in `/tmp/<agent>/`.
- Scratch stays outside the repo; review output goes to `~/temp/ff-game/nw2/<tranche>/`.
- **Each contract entry and GT row lands with the tranche that builds its geography** (10). A check runs only over
  declared records (8), so no tranche merges a failing line.

**Verifier gates** (the `--stage` (d) failures of 1 are not gated):
- full: `npm run quest -- --strict --only abceh`;
- per stage: `npm run quest -- --strict --stage S<n> --only abc`;
- (d), (f) and `--mutate` belong to NW2-BAL and NW2-INT.

| Tranche | Owner | Content | Gates | Depends | Effort |
|---|---|---|---|---|---|
| **NW2-0 Checks** | integrator | constants (N, M, the E targets) in `world_api`; `hike:` in `world-anchors.yaml` read by both sides; `Hike`, `Gorge`, `Relation`, the `cold` hint and `spot:` barrier seeds in `bundle`/`spec`; `gates_canoe.py`, `gates_hike.py`, `dock_towns` with selftests (they run over declared records only); `landings` and `landingNear` in the anchor's mode with U; the `ship+canoe+walking` detour mode | `world.py` OK (`OK (none declared)` lines); `selftest_gates.py` (+6); full verifier gate on today's world; test:fast | — | 6 h |
| **NW2-T Taiga** | integrator or a runtime agent | 3 in full; the ORDEAL / Gaia landing fix if needed; the recompile (`tundra:` keys gone) | `world.py` OK; image review of 4 north crops (the luminance gap); full verifier gate; test:fast | NW2-0 | 8 h |
| **NW2-E Duergar** | EARTH agent (A1 spec edit approved) | 5; the `ert_dwarf` contract text, `duergar_range`; `duergar_south`; S4 / S10 `nonLoadBearing` removed; GT-5b wording, GT-42 with its fixture; `worldSpots:84` | `world.py` OK (`barriers`, `duergar_south`, `relations`, `prewalk`, `dock_towns`, `act1`, `walks`); stage gate S4, S6, S10, S11; full gate; test:fast | NW2-T | 7 h |
| **NW2-F Fire** | FIRE agent | 4; `fir_ice` dock (Python and TS), `ice_neck`, `ice_ring`, `crescent-ice` strait, B2 docks; S16 `walk`; GT-21, GT-37, GT-40, GT-41, GT-43 with fixtures, `canoeCut` `dock:`; the 31-pair table | `world.py` OK (`canoe_gates`, `gorges`, `relations`, `routes`, `straits`); stage gate S14-S17; full gate; test:fast | NW2-T | 10 h |
| **NW2-W Water hikes** | WATER agent | 7 for Onrac, caravan, waterfall | `hikes` (3 sites), `landings`; stage gate S20-S24; full gate; test:fast | NW2-T | 5 h |
| **NW2-N Wind hikes** | WIND agent | 7 for Mirage, Lufenia | `hikes` (2 sites), `landings`; stage gate S26-S28; full gate; test:fast | NW2-T | 5 h |
| **NW2-S Saves** | integrator | 12: v5, `worldRevalidate.ts`, the `LoadScene` host, the `--from-reset` states | the save tests; `quest --strict --only c --from-reset` (background, about 15 min) | NW2-E, NW2-F | 4 h |
| **NW2-BAL** | integrator | 11: re-fit, `CAP`, grind, fallback; the levels table | `npm run quest -- --strict` (all proofs, (d) included); `tests/balance/*`; test:full | E, F, W, N | 6 h |
| **NW2-INT** | integrator | full compile and determinism (two compiles, about 9 min); `--strict`; **`--strict --mutate` once, in the background (about 2 h 15 min)**; browser checkpoints with `&mute=1` (Cinder Gorge, the voyage to `fir_ice` and the Rime Gorge, the dwarves' dock and the range from Matoya, the Onrac and Mirage hikes, the taiga refusal at (65, 40), the Mode 7 marker over taiga); overview; result section; PROGRESS; AGENTS | all of 0 | all | 6 h |

- **Merge order:** 0, T, then E, F, W, N in any order (each re-runs `world.py` after rebasing, then the integrator's
  full compile), then S, BAL and INT.
- **Totals:** about 57 h. Critical path 0 -> T -> F -> BAL -> INT is about 36 h of wall clock, plus the mutate run.
  About 8 full compiles.

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| N1 | S16 (24.5 of 25), S21 (28.8 of 29) and the grind-1.0 stages go over band | `CAP` and refit, the grind lever, the grind-1.0 fallback (11) |
| N2 | A generated river gives a shorter canoe way through a ring, the neck or the fells | `gorges` over all rivers; `ice_neck` and `duergar_range` canoe-closed; the `routes` ring rule; GT-21, GT-40, GT-41 |
| N3 | The hike rings look like clean rings (up to about 890 grass cells converted at K 25) | the `cold` hints and sand do most; jitter; the converted count reported; an image review per site |
| N4 | Locality: hints or the Duergar ridge repaint far chunks | D-NW2-8 (no global band change); hints cut at 1.5 radii; frozen thresholds; the range is west of Matoya; full compiles are the integrator's anyway |
| N5 | Act 1 drifts (Matoya walk, OW-15) | the range at x >= 106; act-1 checks on every compose |
| N6 | A v4 save strands a party | v5 rules 1-5 and `--from-reset` from the relocated states |
| N7 | The tip is too tight for the hollow, a 28-cell gorge and a shore | the polygon's northern lobe; the east strip may turn to Fells rock |
| N8 | Lufenia's landing is tight: 12 qualifying cells, d 31 | the hike pass and the `cold` hint add room; the cap is 50 |
| N9 | Taiga reads as forest | the luminance gate; the speckle; Bedrock as the fallback only if the review fails |
| N10 | The `--mutate` run grows | 4 new rows of about 30-90 s each; one run, at INT |
| N11 | A coast tidy erases a dock cove | docks are pins with `cove=True`; `docks` and `dock_towns` on every compose |
| N12 | `fir_rivers` at <= 0.75 makes the lake crossings denser too | it is counted in S15-S17's balance; the lake is the only other FIRE canoe water |

## 16. Questions

All of rev 1's questions are closed:

| # | Question | Status |
|---|---|---|
| Q1 | Move the cave, or move the canal? | default accepted: **move the cave** (D-NW2-5) |
| Q2 | A landmark on the old south isthmus? | default accepted: empty |
| Q3 | K and U | **answered: K 25, U 50** (D-NW2-1) |
| Q4 | Hikes for Gaia, the Citadel, Bahamut? | **answered: no** (D-NW2-9) |
| Q5 | The gorge rule for R-waterfall? | default accepted: report only |
| Q6 | Lower `grind`? | **answered: yes, 0.5 steps, >= 1.0, after capping** (D-NW2-10) |
| Q7 | Taiga's look | default accepted: code-drawn; Bedrock only if the review fails |
| Q8 | Taiga's backdrop | default accepted: `dark_forest` |
| Q9 | Taiga's speed and rate | closed by the ruling: forest's (D-NW2-7) |
| Q10 | The legend char | default accepted: `t` |
| Q11 | Saves | **answered: targeted** (D-NW2-11) |
| Q12 | The zone id `fir_tundra` | default accepted: kept |

New, from rev 2:

| # | Question | Default |
|---|---|---|
| Q13 | Widen the taiga band over the whole north (`T_TAIGA` 0.35), which repaints the cold belt and may move the Citadel's, Bahamut's and Gaia's ground? Or only locally at the hike sites? | **local only** (D-NW2-8) |
| Q14 | Onrac and the caravan share one south-coast meadow, about (52-53, 85), two spots side by side. Is that acceptable, or should each get its own? | shared |

## 17. TODOs

```markdown
## TODOs
- [x] Measure the baseline (forced canoe, hikes, docks, crops) at 37cce624 (2026-11-21)
- [x] Fold in the rulings of 2026-11-21 (taiga; forest's modifiers) (2026-11-21)
- [x] Rev 2: the user's answers Q3, Q4, Q6, Q11; momus's 6 blocking items and suggestions 7-18 (2026-11-21)
- [ ] User answers Q13, Q14 (priority: low, effort: 0.1h)
- [ ] NW2-0 checks over declared records, landing modes, hike bounds in the anchors file (priority: high, effort: 6h)
- [ ] NW2-T taiga: runtime, Python, art, recompile (priority: high, effort: 8h)
- [ ] NW2-E Duergar, the range, duergar_south, the dock, GT-42 (priority: high, effort: 7h)
- [ ] NW2-F the ice tip, the two gorges, fir_ice, GT-21/37/40/41/43 (priority: high, effort: 10h)
- [ ] NW2-W Onrac, caravan, waterfall hikes (priority: medium, effort: 5h)
- [ ] NW2-N Mirage, Lufenia hikes (priority: medium, effort: 5h)
- [ ] NW2-S save v5 and worldRevalidate (priority: medium, effort: 4h)
- [ ] NW2-BAL refit, CAP, grind, the levels table (priority: high, effort: 6h)
- [ ] NW2-INT compile, --strict, --mutate (background), browser, overview, docs (priority: high, effort: 6h)
```

## Changelog

- **rev 2 (2026-11-21).**
  - Decisions: Q3 (K 25 / U 50), Q4, Q6 and Q11 answered; the other defaults accepted. D-NW2-8 (no global taiga
    widening), D-NW2-12 (one source for the hike bounds).
  - Momus 1: E counts `MODE_RATE.canoe` 0.5; M 24 -> 26, the `fir_rivers` cap 1.2 -> 0.75, E_canoe >= 1.0.
  - Momus 2: the gates use `--only abceh` and `--stage --only abc`; the baseline failures are named.
  - Momus 3: the contract entries and GT rows moved into E and F; the checks run over declared records.
  - Momus 4: per-site landing modes in `landings`, `landingNear` and `gates_reach.landings`.
  - Momus 5: fixtures and `byRow('GT-21')`; GT-14 and GT-5 auto-caught; S4's and S10's `nonLoadBearing` removed;
    GT-5b wording; `worldSpots:84`; `canoeCut` `dock:` with its line budget.
  - Momus 6: `NW2_SAVE_VERSION`; the `LoadScene` host and the pure `revalidateNw2`; rules keyed on vehicles; the
    airship on rock; canoe mode on an old R-ice cell.
  - Suggestions 7-18: the baseline corrected; the taiga file list (`map_checks_spots.py`, wording, schema,
    `backdropTerrain`, `terrain.png`); the ORDEAL landing owner; hikes re-derived (shared south meadow, waterfall
    east downs, Mirage (191, 43), Lufenia (243, 70)); `DETOURS` and `MODES`; the `crescent_ring` seeds;
    `duergar_south` and GT-42's pair; the balance table with S10, S11, S17, S31 and the grind-1.0 fallback; the east
    strip; the glossary; the single U source; `wnd_s_ship`.
  - New questions Q13 and Q14.
- **rev 1 (2026-11-21, 180a7a3d).** First draft.

### Integrator rulings on rev 2's new questions (2026-11-21)

- **Q13 (taiga across the whole north): yes, widen it.** The user asked for taiga to be "a common northern land
  feature" (2026-11-21), so the cold band's taiga is widened across the north, not only by local hints. The repaint of
  the northern belt is expected and owned by NW2-T (which also re-checks the Citadel's, Bahamut's and Gaia's landings);
  the frozen forest / sand thresholds stay as they are.
- **Q14 (Onrac and the caravan sharing one meadow): default accepted (shared).**

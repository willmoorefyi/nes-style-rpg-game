# NW2: edits to the natural world (plan, rev 3)

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
Rev 3 (2026-11-21): Q13 is ruled (taiga is common across the north, with a measured target); momus round 2 is fixed
(the canoe-aware stranded rule, multi-floor exits, proof (g) in the full gate, the mini fixture's geography, the
waterfall's bound, the hike figures).
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
| D-NW2-8 | **Taiga is common across the north** (Q13, coordinator ruling 2026-11-21). The target: taiga covers **>= 30 %** of the northern continents' walkable land, the WATER, ORDEAL and WIND land cells that are not mountain, water (ocean, river, lake) or snow. The baseline, approximated by rows 0-95: 1,301 of about 5,322 cells, **24.4 %**. Momus's probe: `T_TAIGA` 0.35 adds only about 302 cells, about 30.1 % on that approximation, so it is borderline. **NW2-T chooses the threshold, plus local `cold` hints, that meets the target with margin; the measure is the owner grid's, not the row approximation.** It reports the share. The later hike pass only adds to it | Q13 ruled; momus R2-1 |
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
- The cold band writes `t` meaning taiga where `cold > T_TAIGA`. The new constant `T_TAIGA` replaces the literal
  0.5 and is **set by NW2-T** to meet D-NW2-8's >= 30 % (0.35 alone is borderline).
- The new hint kind `cold` raises `cold` in a ragged disc, cut at 1.5 radii like `warm`, round the hike sites and
  wherever the share needs it.
- The figure `taiga_share` (in `worldgen/metrics.py`, with a `world.py` line) is taiga over the WATER, ORDEAL and
  WIND walkable non-snow land on the owner grid. The gate is >= 0.30 from NW2-T on.
- `Q_FOREST` / `Q_SAND` **stay frozen**. A note in `climate.py`: taiga overrides forest and grass after the
  thresholds, so the forest share reported falls where taiga wins; the thresholds never move.
- **The repaint.** Moving `T_TAIGA` repaints the whole cold belt, about 40 north chunks plus their rings, past
  `--region`'s 70-chunk limit when combined. That is expected, not a locality breach. NW2-T's preview is a scratch
  full compile under the lock, and the integrator's full compile at NW2-T's merge commits it.
- **Every landing stays valid:**
  - the Citadel's meadow at (125, 59) is **stamped** grass (ORDEAL content);
  - Gaia (212, 43), Bahamut (163, 87) and the waterfall keep a landing within U in their mode;
  - `landings` and `hikes` run on every compose.
- **The §7 distances are re-measured after NW2-T.** NW2-W and NW2-N start from NW2-T's ground and re-derive d, the
  landings and the factor bounds before they place their meadows.

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

**ORDEAL's and the others' landings.** The widened band may turn the ground under the Citadel (125, 59), Bahamut
(163, 87), Gaia (212, 43) or the waterfall's current landing to taiga. The **NW2-T agent** owns the fix and may edit
ORDEAL's, WIND's and WATER's content modules for it alone: a grass meadow stamp within U of the anchor. The
Citadel's is stamped in any case. The five hike sites' final meadows are NW2-W's and NW2-N's.

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

**Landings** (indicative: derived for K 25 / U 50 by BFS on **today's** ground, and **re-measured on NW2-T's ground**
before NW2-W and NW2-N place them, D-NW2-8). d is measured to the landing cell itself. The floor is the minimum over
all five sites, so no landing serves one site too close to another. "Grass that qualifies" counts today's grass
cells meeting the floor and the cap. Where it is 0 or 1, the landing **is** the meadow stamp:

| Site | Ring | Landing spot -> cell | d floor (foot+canoe, min over the five) | d cap (mode): walk + canoe steps | Manhattan | Grass that qualifies today | Factor bound (D-NW2-3, canoe at 0.5) |
|---|---|---|---|---|---|---|---|
| Onrac `wat_onrac` | taiga belt (`cold` hint rel (-79, -86), 16) | `wat_s_onrac_airship` -> the south coast meadow **(53, 85)** | 30 | 34 on foot | 30 | several (forest round them; the meadow is stamped) | `wat_isles` 34 / 16 = 2.1 |
| Caravan `wat_caravan` | the dunes plus taiga to the north | `wat_s_caravan_airship` -> the same meadow, **(52, 85)** | **31** (Onrac's) | 35 on foot | 35 | as Onrac (shared) | `wat_dunes` 2.1 (it stays at 0.67) |
| Waterfall `wat_waterfall` | snow and taiga on the spine's flank | **new** `wat_s_waterfall_airship` -> the east downs **(84, 55)** | 31 (Onrac's) | 34 foot+canoe: 31 walk + 3 canoe (none on foot) | 34 | several (east downs grass) | `wat_isles`, `wat_streams` (31 + 3 x 0.5) / 16 = **2.0** |
| Mirage `wnd_mirage` | the sands; the oasis becomes sand | `wnd_s_mirage_airship`, `wnd_s_sky_airship` -> a north oasis inside the ring, **(191, 43)** | 34 | 34 on foot | 34 | **0** (sand only): the stamp | `wnd_mirage_sands` 34 / 16 = 2.1 |
| Lufenia `wnd_lufenia` | taiga and forest moor (`cold` hint rel (72, -79), 14) | `wnd_s_lufenia_airship` -> the east coast, **(243, 70)** | 31 | 31 on foot | 31 | **1** (momus): the stamp | `wnd_lufen_moor` 31 / 16 = 1.9 |
| Gaia, Citadel, Bahamut | unchanged (Q4) | unchanged (the Citadel's meadow stamped, 3) | | <= U | | | |

- **Zone caps** (`world_balance.CAP`): a zone crossed by several hikes takes the smallest bound, rounded down to 0.05:
  `wat_isles` **2.0** (the waterfall's), `wat_streams` 2.0, `wnd_mirage_sands` 2.1, `wnd_lufen_moor` 1.9.
- **E_hike at the rounded rates:**
  - the waterfall at 2.0 (rate 20-44, mean 32): (31 + 1.5) / 32 = 1.02; at 2.1 it would be 0.97 (momus);
  - Onrac at 2.0: 34 / 32 = 1.06;
  - Mirage at 2.1 (mean 33.5): 1.01;
  - Lufenia at 1.9 (rate 19-42, mean 30.5): 1.02.
- The bounds are re-derived from each tranche's final d, and `hikes` enforces E_hike >= 1.0, never the table.
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
  - GT-38 and GT-39 stay unused.
- **The mini fixture** (`tests/fixtures/quest/mini.yaml`, 48x32, its stand-ins as today: a river crossing is a
  Bridge cell gated by the `canoe` item). It gains the geography that makes each new row **caught**, not "pending:
  town dwarf not built":
  - **The dwarves' pocket (NW2-E).**
    - Carve the land cells x 22-24, rows 1-6, plus (22-24, 7), out of the rock east of M (the mainland, x 12-20),
      with rock column x 21 between them.
    - Cut `duergar_range: [[21, 3]]` in `world.cuts`.
    - Move dock `ert_dwarf` from (22, 13) to (23, 8), aldi, below the pocket.
    - A new room `dwarf-hall` (the 10th) with Nerrick, moved from the overworld (20, 18), and a `keeper` (shopId
      `dwarf_item`). Its entrance is `ert_dwarf` (23, 2), with the transition at (23, 1).
    - A town `{id: dwarf, owner: ERT-O, maps: [dwarf-hall], opensAfter: [S2], bandStage: S10, kit: k_low, status:
      built}`; S10's `maps: [dwarf-hall]`.
    - The S4 and S10 dock `nonLoadBearing` entries go, as in `quest.yaml`.
  - **The Ice Cavern's pocket (NW2-F).**
    - In the FL lands (x 38-46, rows 1-6), rock column x 43, rows 1-6, splits off the hollow: `fir_ice` stays at
      (44, 2) in a hollow of x 44-46, rows 1-3.
    - Row 4 is (44, 4) rock, the R-ice stand-in (45, 4) a Bridge cell gated by `canoe`, and (46, 4) rock.
    - The shore is x 44-45, rows 5-6, with rock at x 46. The dock `fir_ice` is at (45, 7), ocean, with (45, 7)
      carved to Water.
    - Cuts: `ice_ring: [[44, 4]]` (shore to hollow) and `ice_neck: [[43, 5]]` (FL to shore).
    - `fir_desert` moves to (41, 6). The flight stand-in (the AIRSHIP_RAISED transition) moves from (46, 1) to
      (42, 1), and its return target from (45, 2) to (41, 2), so neither lands in the hollow.
    - `crescent_ring`'s ring (x 37) now guards only the volcano and the desert.
  - **`questMutate.test.ts`.**
    - `ids` count 38 -> 42.
    - `byRow('GT-21')`: 2 elements, the cuts (37, 5) and (45, 4).
    - `CAUGHT` changes:

      | Row | Expectation |
      |---|---|
      | `'GT-37'` | `['SKIP S15 ']` (was `['SKIP S15 ', 'SKIP S16 ']`) |
      | `'GT-40'` | `['SKIP S16 ']`: the opened ring walks the shore into the hollow, so S16 holds without S14's canoe |
      | `'GT-41'` | `['ORDER goal ']`: no dock, no hollow, no levistone |
      | `'GT-42'` | `['EARLY dwarf ']`: the opened range walks M into the pocket after S1, so the keeper is talkable before S2 |
      | `'GT-14'` | `['ORDER goal ']` (now caught) |
      | `'GT-5'` | `['ORDER goal ']` (Elfland only by `elf_port`) |

    - GT-43 gets its own `it`: `nonLoadBearing` equals the row's `nlb` text, `caught` false.
  - The fixture's comment block names the two pockets. `miniWorld.ts` is unchanged.
- **Proofs (e) and (f)** are re-run at NW2-INT.

## 11. Balance (`layouts/world_balance.py`, the curve model)

- **Rule:** every band OK (d), each stage within +0.5 of NW's level, and (d2) / (d3) OK.
- **Levers, in order** (D-NW2-10):
  1. Re-fit `STEP_FACTOR` (NW-5's iterative fit, scratch outside the worktree), clamp [0.67, 2.25], with the new
     **`CAP` dict** asserted by `apply`: `fir_rivers` <= 0.75 (E_canoe); `wat_isles` 2.0, `wat_streams` 2.0,
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
- For a v4 save, `LoadScene` (async) loads the `overworld` map before it switches scene. If the save is inside a
  map, it also loads that map's **way out**: a BFS over the interior maps' transitions until one targets an
  overworld entrance. For example `ice-cavern-b2` -> `ice-cavern-b1` -> overworld `fir_ice`, and `dwarf-hall` ->
  `ert_dwarf`. Each map on the chain is loaded once, and the chain is capped at 8 maps; a save with no way out keeps
  today's behaviour.
- It builds the collision with the save's flags' patches applied, through the same patch code the field uses
  (`fieldRules` / the patch overlay).
- It then calls a new pure function, `revalidateNw2(save, world)` (`src/systems/worldRevalidate.ts`, under 250
  lines).
- The result sets `pendingEntrance` / `pendingNotice` as the reset does today, or rewrites the save's vehicle or party
  cells.

**Rules** (keyed on each parked vehicle and on the party's cell, never on the party's map alone).

**The party's component** is the set of cells reachable from the party's cell, or for a save inside a map from its
way-out entrance, with the save's flags' patches applied:
- **on foot and canoe whenever the save holds the canoe** (`canoe` in its items). The Ice Cavern lies inside the
  foot-only `ice_ring`, Gurgu behind `crescent_ring`, and the waterfall's foot component has no grass, so judging a
  canoe-holding save on foot alone would reset valid saves;
- on foot otherwise.

1. **Ship.** It is valid on Water inside a basin its flags open (aldi; ocean with CANAL_OPEN). Its **shore** is any
   walkable 4-neighbour of its cell; a ship with no shore is at anchor (like `wnd_s_ship`) and still valid. An invalid
   ship (its cell became land, as at the old dwarf cove (104, 152)) moves to the allowed dock in the party's
   component, if there is one, else to the nearest allowed dock of an open basin. A party in elfheim, the keep or the
   marsh therefore gets its ship at `elf_port`.
2. **The party inside a map:** its component is its way-out entrance's. If that component holds no ship shore, no
   airship and not Cornelia, the ship moves to the component's dock: `dwarf-hall` -> `ert_dwarf`, `ice-cavern-*` ->
   `fir_ice` (whose component, with the canoe, holds the dock's shore via R-ice).
3. **Airship.** It is valid on a walkable cell (it may stand on taiga or snow; boarding needs no landing). If its cell
   became rock or water, it moves to the nearest `canLand` cell in the party's component, else to the `RESET_SPOTS`
   airship spot.
4. **Party cell and mode.** In canoe mode on a cell that is no longer River or Lake (an old R-ice cell): walking mode
   if the cell is walkable. On a cell that admits neither mode (the old frost hollow, now rock): rule 5.
5. **Stranded** (as D-NW8): the party's component (foot+canoe with the canoe), after rules 1-4, holds none of
   Cornelia's entrance, its ship's shore or its airship. Then reset to Cornelia, the vehicles to `RESET_SPOTS`, with
   the one-time notice.
   - Examples: a canoe-holding save on foot inside the Rime Hollow, with the ship at `fir_ice`, is **kept** (the
     component reaches the shore by R-ice); the same party without the canoe could not have entered.

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
| `tests/systems/saveWorldReset.test.ts`, `worldReset.test.ts`, new `worldRevalidate.test.ts`, `tests/progression/resetStates.test.ts` | v5: rules 1-5 (the ship at the old dwarf cove with the party in elfheim; inside `ice-cavern-b2` with the ship at Crescent, resolved b2 -> b1 -> `fir_ice`, then the ship moved to `fir_ice`; a canoe-holding party in the Rime Hollow kept, not reset; a party at Gurgu's mouth with the canoe kept; an airship on new rock; canoe mode on an old R-ice cell; stranded in the lobe without a vehicle); a valid v4 kept; v1-v3 as before |
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
- full: `npm run quest -- --strict --only abcegh` (proof (g) included: the anchors move in E and F);
- per stage: `npm run quest -- --strict --stage S<n> --only abc`;
- (d), (f) and `--mutate` belong to NW2-BAL and NW2-INT.

| Tranche | Owner | Content | Gates | Depends | Effort |
|---|---|---|---|---|---|
| **NW2-0 Checks** | integrator | constants (N, M, the E targets) in `world_api`; `hike:` in `world-anchors.yaml` read by both sides; `Hike`, `Gorge`, `Relation`, the `cold` hint and `spot:` barrier seeds in `bundle`/`spec`; `gates_canoe.py`, `gates_hike.py`, `dock_towns` with selftests (they run over declared records only); `landings` and `landingNear` in the anchor's mode with U; the `ship+canoe+walking` detour mode | `world.py` OK (`OK (none declared)` lines); `selftest_gates.py` (+6); full verifier gate on today's world; test:fast | — | 6 h |
| **NW2-T Taiga** | integrator or a runtime agent | 3 in full; **`T_TAIGA` and the `cold` hints chosen to meet D-NW2-8's >= 30 %**, with the share reported; the Citadel's meadow stamped; the Gaia / Bahamut / waterfall landing fixes if needed; a scratch full compile for the preview; the recompile at merge (`tundra:` keys gone) | `world.py` OK (`taiga_share` >= 0.30, `landings`); image review of 4 north crops (the luminance gap); full verifier gate; test:fast | NW2-0 | 9 h |
| **NW2-E Duergar** | EARTH agent (A1 spec edit approved) | 5; the `ert_dwarf` contract text, `duergar_range`; `duergar_south`; S4 / S10 `nonLoadBearing` removed; GT-5b wording, GT-42 with its fixture; `worldSpots:84` | `world.py` OK (`barriers`, `duergar_south`, `relations`, `prewalk`, `dock_towns`, `act1`, `walks`); stage gate S4, S6, S10, S11; full gate; test:fast | NW2-T | 7 h |
| **NW2-F Fire** | FIRE agent | 4; `fir_ice` dock (Python and TS), `ice_neck`, `ice_ring`, `crescent-ice` strait, B2 docks; S16 `walk`; GT-21, GT-37, GT-40, GT-41, GT-43 with fixtures, `canoeCut` `dock:`; the 31-pair table | `world.py` OK (`canoe_gates`, `gorges`, `relations`, `routes`, `straits`); stage gate S14-S17; full gate; test:fast | NW2-T | 10 h |
| **NW2-W Water hikes** | WATER agent | 7 for Onrac, caravan, waterfall | `hikes` (3 sites), `landings`; stage gate S20-S24; full gate; test:fast | NW2-T | 5 h |
| **NW2-N Wind hikes** | WIND agent | 7 for Mirage, Lufenia | `hikes` (2 sites), `landings`; stage gate S26-S28; full gate; test:fast | NW2-T | 5 h |
| **NW2-S Saves** | integrator | 12: v5, `worldRevalidate.ts`, the `LoadScene` host, the `--from-reset` states | the save tests; `quest --strict --only c --from-reset` (background, about 15 min) | NW2-E, NW2-F | 4 h |
| **NW2-BAL** | integrator | 11: re-fit, `CAP`, grind, fallback; the levels table | `npm run quest -- --strict` (all proofs, (d) included); `tests/balance/*`; test:full | E, F, W, N | 6 h |
| **NW2-INT** | integrator | full compile and determinism (two compiles, about 9 min); `--strict`; **`--strict --mutate` once, in the background (about 2 h 15 min)**; browser checkpoints with `&mute=1` (Cinder Gorge, the voyage to `fir_ice` and the Rime Gorge, the dwarves' dock and the range from Matoya, the Onrac and Mirage hikes, the taiga refusal at (65, 40), the Mode 7 marker over taiga); overview; result section; PROGRESS; AGENTS | all of 0 | all | 6 h |

- **Merge order:** 0, T, then E, F, W, N in any order (each re-runs `world.py` after rebasing, then the integrator's
  full compile), then S, BAL and INT.
- **Totals:** about 58 h. Critical path 0 -> T -> F -> BAL -> INT is about 36 h of wall clock, plus the mutate run.
  About 8 full compiles.

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| N1 | S16 (24.5 of 25), S21 (28.8 of 29) and the grind-1.0 stages go over band | `CAP` and refit, the grind lever, the grind-1.0 fallback (11) |
| N2 | A generated river gives a shorter canoe way through a ring, the neck or the fells | `gorges` over all rivers; `ice_neck` and `duergar_range` canoe-closed; the `routes` ring rule; GT-21, GT-40, GT-41 |
| N3 | The hike rings look like clean rings (up to about 890 grass cells converted at K 25) | the `cold` hints and sand do most; jitter; the converted count reported; an image review per site |
| N4 | Locality: the taiga band repaints the whole cold belt; hints or the Duergar ridge repaint far chunks | the cold belt's repaint is accepted and done by full compiles (NW2-T's scratch preview, the integrator's at merge), never `--region`; hints are cut at 1.5 radii; `Q_FOREST` / `Q_SAND` stay frozen, so nothing south of the belt moves; the range is west of Matoya |
| N5 | Act 1 drifts (Matoya walk, OW-15) | the range at x >= 106; act-1 checks on every compose |
| N6 | A v4 save strands a party | v5 rules 1-5 and `--from-reset` from the relocated states |
| N7 | The tip is too tight for the hollow, a 28-cell gorge and a shore | the polygon's northern lobe; the east strip may turn to Fells rock |
| N8 | Lufenia has 1 qualifying grass cell today and Mirage 0 (momus): both landings exist only as meadow stamps, at d 31 and 34 | the stamp is the landing by design; `landings` and `hikes` check it on every compose; the cap is 50, so either may move further out if the stamp's cell turns out bad |
| N13 | NW2-T's taiga moves the hike distances that §7 derived on today's ground | NW2-W and NW2-N re-measure on NW2-T's ground before placing (3); the `hikes` check is the authority |
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

Rev 2's new questions, both closed (the integrator's rulings, end of this file):

| # | Question | Status |
|---|---|---|
| Q13 | Widen the taiga band over the whole north? | **ruled: yes, widen.** Taiga is common across the north, with D-NW2-8's >= 30 % target; NW2-T owns the threshold, the repaint and the landings |
| Q14 | Onrac and the caravan share one south-coast meadow? | default accepted: shared |

No question is open.

## 17. TODOs

```markdown
## TODOs
- [x] Measure the baseline (forced canoe, hikes, docks, crops) at 37cce624 (2026-11-21)
- [x] Fold in the rulings of 2026-11-21 (taiga; forest's modifiers) (2026-11-21)
- [x] Rev 2: the user's answers Q3, Q4, Q6, Q11; momus's 6 blocking items and suggestions 7-18 (2026-11-21)
- [x] Q13 and Q14 ruled by the integrator (2026-11-21)
- [x] Rev 3: Q13 folded in (the >= 30 % taiga target); momus round 2 fixed (2026-11-21)
- [ ] NW2-0 checks over declared records, landing modes, hike bounds in the anchors file (priority: high, effort: 6h)
- [ ] NW2-T taiga: runtime, Python, art, T_TAIGA and hints for >= 30 %, landings, recompile (priority: high, effort: 9h)
- [ ] NW2-E Duergar, the range, duergar_south, the dock, GT-42 (priority: high, effort: 7h)
- [ ] NW2-F the ice tip, the two gorges, fir_ice, GT-21/37/40/41/43 (priority: high, effort: 10h)
- [ ] NW2-W Onrac, caravan, waterfall hikes (priority: medium, effort: 5h)
- [ ] NW2-N Mirage, Lufenia hikes (priority: medium, effort: 5h)
- [ ] NW2-S save v5 and worldRevalidate (priority: medium, effort: 4h)
- [ ] NW2-BAL refit, CAP, grind, the levels table (priority: high, effort: 6h)
- [ ] NW2-INT compile, --strict, --mutate (background), browser, overview, docs (priority: high, effort: 6h)
```

## Changelog

- **rev 3 (2026-11-21).**
  - R2-1, Q13: D-NW2-8 now reads "taiga is common across the north". The target is taiga >= 30 % of WATER, ORDEAL
    and WIND walkable non-snow land (baseline about 24.4 %; 0.35 alone is borderline). NW2-T picks `T_TAIGA` and the
    hints, reports `taiga_share`, stamps the Citadel's meadow and keeps Gaia's, Bahamut's and the waterfall's
    landings. §7 is re-measured after NW2-T. `Q_FOREST` / `Q_SAND` stay frozen, and the cold belt's repaint goes
    through full compiles. §3, N4, N13 and the NW2-T row are updated.
  - R2-2: the save component is foot+canoe whenever the save holds the canoe. The way out of a multi-floor map is
    resolved through its transitions (b2 -> b1 -> overworld, capped at 8 maps). The test cases are extended.
  - R2-3: the full gate is `--only abcegh`.
  - R2-4: the mini fixture gains a dwarves' pocket (`duergar_range` cut (21, 3), dock (23, 8), the `dwarf-hall`
    room, the `dwarf` town) and an ice pocket (`ice_neck` (43, 5), `ice_ring` (44, 4), the `fir_ice` dock (45, 7));
    the flight stand-in moves. The `CAUGHT` entries: GT-37, GT-40, GT-41, GT-42, GT-14, GT-5; GT-43 as `nlb`; the
    row count 42; GT-21 at 2.
  - R2-5: the waterfall's bound is 2.0 with the canoe's rate counted, so `wat_isles` and `wat_streams` cap at 2.0;
    E_hike is worked at the rounded rates.
  - R2-6: the caravan's floor is 31 (Onrac's). Lufenia has 1 qualifying grass cell and Mirage 0: both rely on the
    meadow stamp. N8 is corrected.
  - The integrator's Q13 and Q14 rulings are folded into §16; no question is open. NW2-T goes to 9 h.
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

### Momus OKAY (round 3, 2026-11-21): fixture and test notes for NW2-E and NW2-F

Momus returned OKAY with conditions; these are folded in as tranche instructions (no design change):
1. `tests/progression/miniWorld.ts` `MINI_ROWS` B2 lists docks exactly: add `fir_ice` (NW2-F).
2. `tests/progression/travelMatrix.test.ts`: the B1 message at :49 gains `fir_ice`; the T3 RED case at :60
   (`dropGate(37, 5)` expects `TRAVEL T3 reaches fir_ice`) no longer holds once the ice sits behind its canoe cell
   (45, 4): drop it or add a T3 RED case for (45, 4) (NW2-F).
3. `questMutate.test.ts` :93-110 rely on GT-5 / GT-14 being uncaught: drop their two `nonLoadBearing` reason checks and
   move the RED test to another entry row (GT-6 or GT-16) (NW2-E).
4. The mini ice pocket: the `hull` NPC at (46, 6) lands on new rock; move it beside `fir_desert`'s new cell, e.g.
   (42, 6) (NW2-F).
5. §3: `--region`'s limit is `PAINT_LIMIT` 160 (`terrain/region_chunks.py:16`), not 70; the repaint is still by full
   compiles.
6. §12: a save with no way out still runs vehicle rules 1 and 3 (wording only; no map lacks a way out).

### NW2-F result (2026-11-21)

Built on mainline e9376e04, merged with NW2-E and NW2-W (ec1ec36d) before the gates. Placements (world cells; rel =
Cornelia-relative):
- **Ice Cavern** `fir_ice` (214, 108), at its target (ref (79, -55)); the cave icon on the Rime Hollow's north wall
  (ledge row 106, door (214, 107)). `ice_ring` is a circle of radius 6 round rel (69, -44) = (215, 111) (`warped:
  False`); the hollow's floor is snow with taiga pines (FIRE's content, `_hollow`), the floe at (212, 110). The Rime
  Tarn: rel (70, -42), radius 2.
- **R-ice** (47 cells): rel (70, -42) -> (71, -37) -> (76, -34) -> (77, -29) -> (72, -26) -> (66, -27) -> (64, -30) ->
  (62, -32) -> (60, -33), the mouth (206, 122) on the west coast; the gorge stamp walls cells 3 to -9.
- **Dock `fir_ice`** (205, 119), ocean, facing east (`Dock.toward`); spots `fir_s_ice_ship` (205, 119), `fir_s_ice_shore`
  (206, 119). The Frost Shore (x 206-214, y 113-121, taiga) runs from the dock to the mouth: 2 walking steps to the
  first canoe cell.
- **`ice_neck`**: rel (56, -21) .. (87, -24), coast to coast at y about 131-134 (south of the plan's 126-131, for the
  gorge's room); foot and canoe closed; seeds `fir_crescent` -> `spot:fir_s_ice_shore`, `fir_ice`.
- **Cold hint** rel (73, -40), radius 22: the tip's walkable cells 67 % taiga and snow (fireWorld gate 50 %).
- **R-volcano** (51 cells): rel (64, 25) [in the lake] -> (62, 28) -> (58, 31) -> (54, 35) -> (49, 38) -> (45, 41) ->
  (40, 43) -> (37, 45) -> (35, 46), its sink (181, 201) by Gurgu; the gorge stamp walls cells 3 to -6; the Cinder Wall
  ridge rel (61, 28) .. (41, 42) (height 0.9, width 4) beside it. `crescent_ring`'s seeds drop `fir_ice`.
- Corridors: `fir_south` (Gurgu, rel (37, 48), (46, 49), the hull), `fir_ice_shore` (the dock to the mouth); `fir_ash`
  dropped. The old frost hollow is ash and dune.
- `fir_rivers` step factor 2.25 -> **0.75** (rate 8-17), so E_canoe >= 1.0 (D-NW2-3).

Gorge figures (`world.py`'s `gorges` line, least-canoe path over each stage's starts):

| Gorge | Forced canoe steps (M >= 26) | Path steps | Pass cells (N >= 12) | E_canoe (>= 1.0) |
|---|---|---|---|---|
| Cinder Gorge, `fir_volcano` S15 | 54 (25 of them Crescent Lake) | 86 | 39 | 2.16 |
| Rime Gorge, `fir_ice` S16 | 47 | 57 | 32 | 1.88 |

Cuts: `ice_neck` 17, `ice_ring` 6, `crescent_ring` 4. Relations: `fir_ice` 64 rows north of Crescent, bearing 7.1,
102.0 from Gurgu.

The 31-pair table (proof (g) on the source's cells; 20,000 +-2 placements of the 20 non-act-1 anchors at their targets,
act 1 fixed: **0 fail**; s* at the targets 0.848):

| pair | d_ref | s* x d_ref | d_world | r | band | bearing err | max |
|---|---|---|---|---|---|---|---|
| cornelia-pravoka | 57.3 | 48.8 | 40.3 | 0.83 | [0.7, 1.3] | 2.3 | 40 |
| cornelia-matoya | 53.8 | 45.8 | 39.4 | 0.86 | [0.7, 1.3] | 20.8 | 40 |
| cornelia-temple | 41.2 | 35.1 | 15.3 | 0.44 | exempt | 29.3 | 40 |
| pravoka-elfheim | 93.7 | 79.8 | 73.6 | 0.92 | [0.7, 1.3] | 4.1 | 40 |
| elfheim-marsh | 48.8 | 41.6 | 41.6 | 1.00 | [0.7, 1.3] | 0.2 | 40 |
| elfheim-keep | 40.0 | 34.1 | 33.6 | 0.99 | [0.7, 1.3] | 0.3 | 40 |
| keep-dwarf | 64.3 | 54.7 | 55.2 | 1.01 | [0.7, 1.3] | 0.2 | 40 |
| dwarf-melmond | 47.5 | 40.5 | 41.1 | 1.02 | [0.7, 1.3] | 3.7 | 40 |
| melmond-earth_cave | 25.6 | 21.8 | 21.6 | 0.99 | [0.55, 1.6] | 5.0 | 60 |
| melmond-giant | 20.0 | 17.0 | 14.0 | 0.82 | [0.55, 1.6] | 0.0 | 60 |
| melmond-sarda | 32.2 | 27.5 | 25.2 | 0.92 | [0.7, 1.3] | 0.3 | 40 |
| melmond-crescent | 140.9 | 120.0 | 124.8 | 1.04 | [0.7, 1.3] | 0.1 | 40 |
| cornelia-crescent | 70.9 | 60.3 | 62.4 | 1.03 | [0.7, 1.3] | 0.6 | 40 |
| crescent-volcano | 48.2 | 41.0 | 42.4 | 1.04 | [0.7, 1.3] | 1.5 | 40 |
| crescent-ice | 75.8 | 64.5 | 64.5 | 1.00 | [0.7, 1.3] | 1.2 | 40 |
| ice-desert | 117.3 | 99.8 | 101.0 | 1.01 | [0.7, 1.3] | 0.1 | 40 |
| desert-citadel | 193.3 | 164.6 | 166.9 | 1.01 | [0.7, 1.3] | 0.0 | 40 |
| citadel-bahamut | 56.9 | 48.4 | 49.0 | 1.01 | [0.7, 1.3] | 0.1 | 40 |
| desert-onrac | 218.0 | 185.5 | 187.5 | 1.01 | [0.7, 1.3] | 0.1 | 40 |
| onrac-waterfall | 40.2 | 34.2 | 34.1 | 1.00 | [0.7, 1.3] | 0.7 | 40 |
| onrac-caravan | 32.2 | 27.5 | 25.1 | 0.91 | [0.7, 1.3] | 1.1 | 40 |
| caravan-gaia | 192.7 | 164.0 | 165.8 | 1.01 | [0.7, 1.3] | 0.8 | 40 |
| gaia-mirage | 42.5 | 36.2 | 38.9 | 1.07 | [0.7, 1.3] | 2.8 | 40 |
| gaia-lufenia | 41.8 | 35.6 | 35.9 | 1.01 | [0.7, 1.3] | 3.8 | 40 |
| lufenia-melmond | 183.2 | 155.9 | 158.8 | 1.02 | [0.7, 1.3] | 0.5 | 40 |
| cornelia-onrac | 135.9 | 115.7 | 116.8 | 1.01 | [0.7, 1.3] | 0.0 | 40 |
| cornelia-gaia | 150.4 | 128.0 | 130.7 | 1.02 | [0.7, 1.3] | 0.7 | 40 |
| cornelia-marsh | 94.4 | 80.4 | 80.8 | 1.01 | [0.7, 1.3] | 0.1 | 40 |
| cornelia-sarda | 104.0 | 88.5 | 89.0 | 1.01 | [0.7, 1.3] | 0.0 | 40 |
| cornelia-citadel | 118.5 | 100.8 | 102.2 | 1.01 | [0.7, 1.3] | 0.2 | 40 |
| pravoka-matoya | 99.0 | 84.2 | 62.2 | 0.74 | [0.7, 1.3] | 9.6 | 40 |

### NW2-BAL result (2026-11-21)

Built on mainline 0b25c430 (E, F, W, N merged and compiled). Measured with the curve model (proof (d)'s witness walk)
on both worlds: NW at 37cce624 and NW2 at 0b25c430, per stage and per zone. Before: S21 L29.3 over [25, 28] and every
stage from S17 on 0.4-0.6 above NW's level. The excess per stage, in walk xp: S17 +30.9 k (17.1 `fir_rivers` canoe
fights on the Cinder Gorge's return, 26 k), S16 +14.1 k (the Rime Gorge, 12.7 k), S18 / S19 +8.9 k / +6.6 k
(`ord_heath`: twice NW's heath fights), S14 +7.2 k (the voyage now crosses `wat_sea`, 9.8 k), S27-S29 and S31 +3-4 k
each (the Mirage hike's `wnd_mirage_sands`).

Levers (D-NW2-10, in the plan's order):
1. **Re-fit** (`layouts/world_balance.py`; clamp [0.67, 2.25]; the new `CAP` dict, asserted by `apply`: `fir_rivers`
   0.75, `wat_isles` 2.0, `wat_streams` 2.0, `wnd_lufen_moor` 1.9, `wnd_mirage_sands` 2.1):
   - `wat_sea` 1.0 -> **2.25** (rate 23-50; S14's voyage);
   - `ord_heath` 0.67 -> **1.4** (14-31; S18 / S19's fights back to NW's: 68.5 / 13.1 against 67.8 / 13.0);
   - `fir_tundra` 1.0 -> **2.0** (20-44; S17's return over the Frost Shore);
   - `wnd_mirage_sands` 1.26 -> **2.1**, its cap (21-46): the Mirage hike's E_hike 1.66 -> 1.01.
   The capped zones are not levers: `fir_rivers` stays 0.75 and the other walking / sea zones of S16 and S17
   (`fir_sea`, `fir_lakeshore`, `fir_ashlands`) are already at 2.25. With the factors alone S21 stays over (L29.1).
2. **Grind**, 0.5 steps: **S16 2.0 -> 1.5**, **S17 4.0 -> 3.0** (quest.yaml). These are the two stages whose walks
   hold the capped gorge fights; lowering S21's own grind does not help (2.0 -> 1.0 leaves it at L29.08: its walk has
   4.2 fights). Neither S16 1.5 nor S17 3.0 alone brings S21 into its band (L29.02 / L29.00); S17 3.5 with S16 1.5
   does (L28.96), and 3.0 leaves a margin (L28.90, 0.07 from NW).
3. The fallback (S25, S27, S28 at grind 1.0) was not needed: each is within 0.08 of NW after 1 and 2.
4. No enemy, item, formula or band changed.

Levels (curve model, `npm run quest -- --strict`'s (d); the witness order of (a)):

| Stage | Band | grind | NW level | NW2 before | NW2-BAL | vs NW | fights NW / before / NW2-BAL |
|---|---|---|---|---|---|---|---|
| S0 garland | [2, 3] | 2 | 2.71 | 2.71 | 2.71 | +0.00 | 18.7 / 18.7 / 18.7 |
| S1 | [2, 3] | 1 | 2.95 | 2.95 | 2.95 | +0.00 | 0.6 / 0.6 / 0.6 |
| S3 | [2, 6] | 2 | 3.86 | 3.86 | 3.86 | +0.00 | 0 / 0 / 0 |
| S2 pirate | [3, 6] | 2.5 | 3.60 | 3.60 | 3.60 | +0.00 | 10 / 10 / 10 |
| S4 | [5, 9] | 2 | 8.68 | 8.68 | 8.68 | +0.00 | 0 / 0 / 0 |
| S5 piscodemon | [8, 11] | 2 | 8.60 | 8.60 | 8.60 | +0.00 | 90 / 90 / 90 |
| S6 astos | [10, 13] | 4 | 10.56 | 10.56 | 10.56 | +0.00 | 68.7 / 68.7 / 68.7 |
| S7 | [10, 13] | 1 | 10.88 | 10.88 | 10.88 | +0.00 | 15.6 / 15.6 / 15.6 |
| S8 | [10, 13] | 1 | 10.98 | 10.98 | 10.98 | +0.00 | 11.5 / 11.5 / 11.5 |
| S9 | [10, 13] | 1 | 10.98 | 10.98 | 10.98 | +0.00 | 0 / 0 / 0 |
| S10 | [11, 14] | 6 | 11.52 | 11.41 | 11.41 | -0.11 | 24.8 / 51 / 51 |
| S11 vampire | [13, 16] | 7 | 14.45 | 14.41 | 14.41 | -0.04 | 97.8 / 100.4 / 100.4 |
| S12 | [15, 17] | 7 | 15.16 | 15.12 | 15.12 | -0.04 | 21.3 / 21.3 / 21.3 |
| S13 lich | [16, 19] | 4 | 17.06 | 17.03 | 17.03 | -0.03 | 66.2 / 66.2 / 66.2 |
| S14 | [17, 20] | 6 | 18.05 | 18.16 | 18.05 | +0.00 | 54.5 / 59.4 / 57.5 |
| S15 ashen_queen | [21, 24] | 3 | 21.90 | 21.90 | 21.81 | -0.09 | 111.5 / 112.6 / 112.6 |
| S16 evil_eye | [21, 24] | **2 -> 1.5** | 24.49 | 24.64 | 24.43 | -0.06 | 99.1 / 111.1 / 103.3 |
| S17 | [22, 25] | **4 -> 3** | 24.93 | 25.39 | 25.01 | +0.08 | 14 / 39.3 / 28.4 |
| S20 | [25, 28] | 7 | 25.06 | 25.49 | 25.12 | +0.06 | 0 / 0 / 0 |
| S22 | [25, 28] | 2 | 25.06 | 25.49 | 25.12 | +0.06 | 4.2 / 3.4 / 3.4 |
| S18 dragon_zombie | [24, 27] | 2 | 26.17 | 26.65 | 26.23 | +0.06 | 67.8 / 73 / 68.5 |
| S19 | [24, 27] | 2 | 26.46 | 27.01 | 26.52 | +0.06 | 13 / 16.9 / 13.1 |
| S23 | [26, 29] | 2 | 26.63 | 27.16 | 26.69 | +0.06 | 3.3 / 3.3 / 3.3 |
| S24 drowned_sovereign | [27, 30] | 2 | 28.62 | 29.07 | 28.66 | +0.04 | 79.1 / 78.6 / 78.6 |
| S25 | [28, 31] | 1 | 28.72 | 29.16 | 28.76 | +0.04 | 3.8 / 4.5 / 4.5 |
| S26 | [28, 31] | 2 | 28.76 | 29.22 | 28.81 | +0.05 | 3.5 / 5.7 / 5.7 |
| S21 | [25, 28] | 2 | 28.83 | 29.30 **over** | 28.90 | +0.07 | 3.7 / 4.2 / 4.2 |
| S27 | [29, 32] | 1 | 30.31 | 30.80 | 30.39 | +0.08 | 62.1 / 63.1 / 62.5 |
| S31 | none | 1 | 33.01 | 33.52 | 33.10 | +0.09 | 35.7 / 25.8 / 25.1 |
| S28 hollow_seraph | [31, 34] | 1 | 33.89 | 34.42 | 33.97 | +0.08 | 97.4 / 88.1 / 87.5 |
| S29 | [33, 35] | 1 | 33.99 | 34.56 | 34.09 | +0.10 | 7.5 / 8.7 / 8 |
| S30 lich_2 | [34, 41] | 1 | 35.28 | 35.85 | 35.39 | +0.11 | 28.5 / 28.5 / 28.5 |

Every band OK, every stage within 0.11 of NW's level (the largest: S30 +0.11, S10 -0.11). Seeded battles
(`tests/balance/questCurve.test.ts`, 60 seeds): boss medians garland 2.7, pirate 3.6, piscodemon 8.6, astos 10.6,
vampire 14.4, lich 17.0, ashen_queen 21.8, evil_eye 24.4 (the tightest, [21, 24]), dragon_zombie 26.2,
drowned_sovereign 28.6, hollow_seraph 33.9, lich_2 35.3; Chaos's door 40.5; wipes per run at most 0.05 on a required
stage (S28), 0.13 on S31 (its bound 0.45; NW's 0.40: the walk no longer sails the Aldi first). The test names carry
the new figures.

The compiled `assets/maps/ai/overworld.yaml` got the four zones' new `encounterRate` lines (exactly the source's
blocks; the zone rates touch no chunk or Mode 7 input); NW2-INT's full compile rewrites it.

Gates:

| Gate | Result |
|---|---|
| `world.py` | every line OK; `gorges: OK` (E 2.16 / 1.88, unchanged), `hikes: OK` (Mirage E 1.01, the others unchanged) |
| `npm run quest -- --strict` | `quest-verify: OK`: (a)-(h) OK, (c) 835,121 states, (d) every band OK, (f) Crescent 13,207 / 60,240, Gaia 94,194 / 259,240, (g) s* 0.851; 116 s, max RSS 3.7 GB |
| `tests/balance/*` | 16 files, 104 tests OK |
| `npm run test:fast` | 401 files, 9,654 tests OK |
| `npm run build` | OK |
| `npm run test:full` | see below |

# Natural world plan (pass NW), rev 3

Status: rev 3, planning only. Nothing is implemented. Pass NW replaces the world map's geography and its generator,
act 1's overworld included. It keeps the progression of `docs/WORLD_PLAN.md` rev 3 (pass W: stages S0-S31, the
gates, the verifier proofs) and every site, dungeon, town, interior and landmark. The facts in 1 and 5.1 were checked
at `150c0138` (M7-4 merged at `065a6474`); rev 3's at `d1a3ca54`.

**Rev 3 changes** (momus's re-review of rev 2, REJECT, 6 blocking items):

| # | Item | Resolution |
|---|---|---|
| R3-1 | 3.7-3.9 were lost; prewalk was undefined and stopped at S13; fords on canoe routes | 3.7 (reuse), 3.8 (the checks table, every rule the plan cites) and 3.9 (compile cost) are restored. Prewalk's "required entrances" and "starts" are defined from `quest.yaml` `maps`, `after` and `entry`. It runs over **S0-S14**. New rule: a ford never sits on a pinned canoe route; a corridor yields to the route (2.4 rule 4b, 3.8) |
| R3-2 | The save reset | 5.3 is rewritten. The load stays synchronous: it sets `game.pendingEntrance = 'cornelia'` (the `DebugScenarioLoader.ts:110` pattern; `LoadScene.ts:108` no longer clears it on a reset). Vehicles are keyed to milestone flags the runtime holds, with no stage order: `BIKKE_DEFEATED` → the ship at the `a1_pravoka` dock; `AIRSHIP_RAISED` → the airship on `a1_s_airship` by Cornelia; the canoe is an ability. A save owning a ship or airship is reset to Cornelia even inside another map; one owning neither keeps its place. Proof (c) runs from every stage's reset state (`--from-reset`) |
| R3-3 | Spots need runtime and compiler support | 5.2 lists every NW-1 change: `RegionOut.spots`, the composer, `build_hooks.passthrough`, `MapData.spots`, the map and quest schemas, `questEvents.ts:64`, the quest loader, `DebugScenarioLoader` (`spot:`), `VehicleManager` / `FieldVehicles` (`at:`), `ExplorationCutscenes`, `CutsceneRegistry`, and a recompile of today's world. The 3 act-1 scenarios use `spot:`, not `entrance:` |
| R3-4 | The north selftest contradicted the north rule | the river-mouth case is removed (the ship disembarks only at docks, so a river mouth is no canoe start). It is replaced by a river joining a northern island to a southern coast, which the component rule fails (3.2, 3.8) |
| R3-5 | `--region` over a shared base fails `check_base` | an NW chunk-digest mode: `build.chunks` records a digest per chunk of everything its pixels read; `--region r` repaints r's raster plus every chunk whose digest changed; `check_base` then needs only the size and the compiler. Over 70 changed chunks it refuses: run a full compile (the integrator's). Full compiles are budgeted (3.4) |
| R3-6 | `questEntries.test.ts` doesn't exist | marked new and renamed `tests/systems/worldReset.test.ts` (5.3). With the flag-keyed rule there is no stage order to check |
| S | Suggestions | R17's reason is corrected (`worldOffsetOf` only shifts a 72x72 map; it is removed as dead code; `macroGeography.test.ts:105` reads the anchors from spots). `schemaValidationQuest.ts:75-78`: `world.frames` becomes optional, and `world.basins`, `world.cuts` and `spots` are validated. Totals: 13 tranches, 125 h, about 81-88 h of wall clock (7). The inventory adds `tests/data/act1Flow.test.ts` (2 keyItemGates) and `tests/data/actOneBalance.test.ts` (3.6.5) |

**Rev 2 changes** (the user's rulings of 2026-11-20 and momus's review of rev 1, REJECT):

| # | Item | Resolution |
|---|---|---|
| U-Q1 | Act 1: rebuild it too | D-NW3: act 1's overworld is regenerated. There is no frozen mask or core; its sites and features are pins and stamps; the interior maps are unchanged. 3.6 is rewritten as "Act 1 regenerated and re-pinned", with the full list of what it touches |
| U-Q2 | Size | D-NW1: 256x256 (ruling) |
| U-Q4 | Saves | D-NW8: reset to Cornelia. The exact rule is in 5.3 and replaces the snapping migration |
| U-Q6 | Snow and tundra | D-NW9: both are added; the airship lands on tundra, not snow. Every file and test is listed in 2.6 |
| M1 | Rivers as walking walls before S14 | the walking corridors rule (2.4 rule 4b) and the check `prewalk` (3.8): for each stage before S14, every required entrance is walkable from its entry or docks |
| M2 | GT-38 / GT-39 can't be caught | dropped as verifier rows; they are now compose-check selftests (`worldgen/selftest.py`). The real north check: with every patch on, every walk+canoe component that holds a northern cell holds only northern cells (3.8, 4.5) |
| M3, M4 | Act 1 | see U-Q1: how act 1 is regenerated and re-pinned (3.6), and the full list of tests and data it touches (3.6.5, 5.1) |
| M5 | The verifier on the scratch world | D-NW10: NW-1 rewrites `entry` and every parked vehicle to `at: <spot>`, and the `nonLoadBearing` cells to `ref:`, on today's world. One `quest.yaml` then serves both worlds; `--maps DIR` points the verifier at a scratch compile (5.2) |
| M6 | NW-5's gates fail until NW-6 | NW-6 is folded into NW-5: "cutover and balance" (7) |
| M7 | Saves | see U-Q4 (5.3) |
| M8 | `--region` on an owner grid | 3.4: `regions.<r>.raster` from the owner grid, the owner of a shared chunk, the shared compiled base (who builds and refreshes it), the real memory budget |
| M9 | Snow and tundra touch more code | 2.6 lists every file with its test |
| M10 | Define G-NW1 to G-NW3 | 0.1.1: sea is `o` only; lakes, rivers, roads and bridges count as land. G-NW3 defines the material classes (roads are grass-class) and an exemption list of pinned stamps |
| S1 | Stale facts | updated: HEAD `150c0138`, M7-4 merged `065a6474`, `BOXES` has 10 rects, 5 copies of `fbm`, the ocean ring on 4 sides, and `questGeo.A1_ORIGIN` used by `worldOffsetOf` (1.1, 5.1) |
| S2 | Disk | about 70 MB at 256² (41 MB today x 1.78) (2.1) |
| S3 | Memory | G-NW8 records the bake: the NW-0 pilot compile still bakes 4096² at 16 px; NW-1 lands the size-derived `CELL_PX`, so later scratch compiles bake 3072² at 12 px. `pilotGl.ATLAS_CELL_PX` is NW-5's (6.1) |
| S4 | Anchors | the real bands (long [0.70, 1.30], short [0.55, 1.60]); the distance-exempt pairs listed; the full 31-pair table computed in NW-1; walking detours added as a risk (4.2, R15) |
| S5 | Tranche count, ownership | 13 tranches (rev 3 count); the NW integrator is the single owner of `world_api.py` and `worldgen/` constants (7) |
| S6 | Tests and checks | `tests/nw/` reads committed sources only (7); the worst-case matrix run is defined (4.3); the coordinate-inventory grep is Appendix A, a checklist that gates NW-5 |
| M7 order | M7-5 and M7-6 | they start now, in parallel with NW-0 to NW-R; the cutover (NW-5) stays after M7-INT (6.2) |

**The request (user, 2026-11-20).** "Lots of pieces of the map are squared off straight edges, which isn't how a
natural map works. Make the continents appear smooth and natural, as they appear in the real world. Compare the
continents we have built with the original Final Fantasy world and with the natural world, and build a map that has a
coastline and features to match the real world. Honour the classic progression: foot → ship → canoe → airship, with
the northern continents reachable only at the end game. Revise the map for more natural features, increasing the
overall map size and the terrain and coastline variability."

**Standing rules kept.**
- Classic continent orientation, distances and travel gates, with original detail (memory note "world plan
  geography"; WORLD 2.1).
- The classic map is a reference for arrangement and shape language only. No map data is copied; every coastline is
  generated.
- Site positions come from `world-anchors.yaml`'s reference offsets, not from the reference image. Where the two
  differ, the anchors win: e.g. Matoya stays north-west of the Temple. The concept sketch took its positions from the
  image, so its Matoya is superseded.
- No paid art (Gemini); Bedrock is not needed.

**Review images** (`~/temp/ff-game/worldplan/`):

| File | What |
|---|---|
| `now.png` | the current compiled world, 192x192 (`build_map.py --preview overworld 0 0 191 191 ... --scale 0.15`) |
| `ref/ff1_world_map.jpg` | the classic layout (reference only) |
| `concept_256.png`, `concept_256.py` | a scratch concept sketch, 256x256, flat colours, the 16-cell chunk grid, site dots. It is not the pilot: it shows the arrangement, the ridges and the climate logic. Its coasts are too smooth (coast index 22.1, against the gate of 30) and its site dots come from the image, not the anchors |
| `side_by_side.png` | now / classic / concept |

**Naming.**
- Tranches `NW-0` to `NW-INT` (13, section 7).
- Decisions `D-NW1`... (0.2); gates `G-NW1`... (0.1).
- "WORLD n.m" is a section of `docs/WORLD_PLAN.md` rev 3; "M7 n.m" a section of `docs/MODE7_PLAN.md`.
- **The NW integrator** is one named agent for the whole pass. It owns `world_api.py`, `worldgen/` and the composer,
  and merges every NW branch.

## 0. Summary

- **Size.** A **256x256** world (16x16 = 256 chunks, 1.78x today's area) at a classic scale of **s\* ≈ 0.86** cells
  per classic tile (today 0.735), with 15-25 cells of open ocean round the edge.
- **One whole-world generator** (`assets-src/tools/worldgen/`) replaces the seven region boxes, act 1 included.
  - In: hand-placed continent control polygons, ridge lines, wall lines, walking corridors, climate hints and site
    pins.
  - Out: domain-warped fractal coasts, an elevation field, rivers by flow accumulation, and biomes by moisture,
    temperature and elevation.
  - Regions stop painting ground. They own their content only: sites, doors, docks, zones, barriers, dressing.
- **Act 1 is regenerated.** Its sites, the bridge, the spine, the east river and the tomb pocket become pins, stamps
  and spec features, at today's positions relative to Cornelia, so the opening's short walks and shape survive. The
  act-1 frame (`A1_ORIGIN`, `frames.a1`, `shiftA1`, `frame: a1`) is removed.
- **Every travel gate is built into the geography and checked.**
  - The walls and barriers are ridges.
  - The canal is a saddle.
  - Rivers cross the pre-canoe walking corridors only at fords.
  - The northern continents are their own walk+canoe components.
  - The verifier's (g) anchors are re-fitted; the (h) matrix keeps its rows.
- **Mode 7** keeps its atlas size and memory: the far atlas bakes at **12 px per cell** (3072²) and the low atlas at
  6 px (1536²). The runtime reads `cellPx` from `mode7.json`.
- **Built beside today's world.** The new world is a source under `assets-src/maps-nw/`, compiled only to scratch
  folders. It replaces `overworld` in one cutover tranche (NW-5, cutover and balance), after M7-INT. Old saves on the
  world map reset to Cornelia.
- **Effort.** About **125 h** over 13 tranches, about 81-88 h of wall clock. The pilot (NW-0) is an offline image for
  the user to approve before any generator work.

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "The world map is 256x256; the game, the verifier and Mode 7 all run on it",
    "Foot -> ship -> canoe -> airship order holds; the north continents (Onrac, Citadel/Cardia, Gaia/Mirage/Lufenia) are reachable only by airship",
    "Every site, dungeon door, town gate, dock and landmark of pass W exists, with the same entrance names and zone ids",
    "Act 1 plays as before: the castle and city, the bridge (BRIDGE_BUILT), the temple, the tomb over the east bridge, Matoya, Pravoka and the pirates; its walks within +-10 % of today's",
    "A v3 or older save on the world map loads at Cornelia on foot with its flags, party, items and gold; a save owning a ship or airship also resets to Cornelia; vehicles at their milestone spots, with proof (c) from every reset state (5.3)"
  ],
  "observable": [
    "No coast, mountain edge, desert edge or forest edge runs straight along a chunk line",
    "Mountains read as ranges with foothills along ridgelines; rivers run from the high ground to the sea or a lake",
    "Deserts lie in rain shadows or continental interiors; marsh in wet lowlands; snow and tundra in the far north",
    "Bays, capes, peninsulas, offshore islands and at least two archipelagos (Cardia, one more)",
    "The overview reads like the classic arrangement side by side (review image)"
  ],
  "pass_fail": [
    "G-NW1 straight coast (0.1.1): no straight coast run longer than 6 edges outside the exemption list (today 40 runs of 8 or more, longest 50)",
    "G-NW2 coast index (0.1.1): >= G2_MIN (30, or the approved pilot preset's value - 1 if lower; fixed in NW-1)",
    "G-NW3 no box edges (0.1.1): no material-class boundary run longer than 6 edges on a chunk line outside the exemption list",
    "G-NW4 python3 -I assets-src/tools/layouts/world.py prints `world: OK`, `basins: OK (...)`, `barriers: OK (walk, canoe)`, `prewalk: OK (S0-S14)`, `north: OK`",
    "G-NW5 build_map.py --check-determinism and mode7_atlas.py --check-determinism pass; re-running every layout script leaves git diff --exit-code assets-src/maps clean",
    "G-NW6 npm run quest -- --strict --mutate passes, with (g) re-fitted and (h) unchanged in rows",
    "G-NW7 npm run build, npm run test:full and the balance suite pass; the questCurve bosses in band",
    "G-NW8 a full-world compile peaks at <= 26 GB (estimate 20 GB) under the lock, measured with the bake it runs: NW-0 with the 16 px 4096² bake, NW-2 onwards with 12 px 3072²",
    "G-NW9 the user approves the pilot image (NW-0) and the final overview (NW-INT)",
    "G-NW10 Appendix A's coordinate-inventory checklist has every hit resolved before NW-5 merges"
  ]
}
```

#### 0.1.1 Exact definitions of G-NW1 to G-NW3

All three are measured on the world source's `ground` (legend chars), with every patch off, by
`worldgen/metrics.py`. A failure prints the run's cells.

- **Sea** is the legend char `o` (ocean) only. Every other char is land for G-NW1 and G-NW2: lake `≈`, river `r`,
  road `,` / `:`, bridge `=`, swamp, snow and tundra all count as land.
- **A coast edge** is the unit edge between two 4-neighbouring cells of which exactly one is sea. Lake, river and
  road edges are not coast edges.
- **G-NW1 (straight coast).**
  - A straight run is a maximal sequence of coast edges on one grid line, consecutive along it, with the sea on the
    same side.
  - A run fails when it is longer than 6 edges, unless every edge of it touches an exempt cell.
- **G-NW2 (coast index).**
  - The index is (the number of coast edges) / sqrt(the number of land cells).
  - Today 19.7; the classic reference about 36 (measured on the image at 4 px per tile, label boxes included, so an
    upper estimate); the concept sketch 22.1.
  - The gate is G2_MIN: 30, or the user-approved pilot preset's value - 1 if that is lower. NW-1 writes it into
    `world_api.py`.
  - Per-continent values are reported, not gated.
- **G-NW3 (no box edges).**
  - Every char has a material class: sea `o`; inland water `≈ r`; mountain `m`; forest `f`; sand `s`; swamp `w`;
    snow; tundra; and the grass class (`. , : =`, so roads and bridges never make a boundary).
  - A boundary edge is a unit edge between two cells of different classes.
  - A chunk-line run is a maximal sequence of boundary edges that lie on a chunk line (between cells 16k-1 and 16k),
    consecutive along it.
  - A run fails when it is longer than 6 edges, unless every edge of it touches an exempt cell.
- **The exemption list** (`EXEMPT_STAMPS`, built by the composer, printed by `--metrics`):
  - the cells of every pinned stamp of kind `quay`, `dock`, `canal` (the patch cells and their stone quays),
    `bridge` (the north bridge strait, the east footbridge, the fords of 2.4 rule 4b) and `icon` (town and site
    footprints);
  - the one-cell ring round them.
  - Roads need no exemption: they are grass-class.
  - The total is capped at 600 cells (a check), so the list cannot hide a coast.
  - NW-0 places pins off chunk lines where the anchors' ±2 window allows it.

### 0.2 Decisions

| # | Decision | Basis |
|---|---|---|
| D-NW1 | 256x256, s\* ≈ 0.86 | **user ruling 2026-11-20 (Q2)**; the classic world is 256 tiles square; 16x16 chunks; the Mode 7 atlas stays 3072² at 12 px (2.1) |
| D-NW2 | one generator for the whole world; regions own content, not ground | the boxes are the root cause (1.1) |
| D-NW3 | **act 1 is regenerated** like the rest; its sites and features are pins, stamps and spec features at today's positions relative to Cornelia; the interior maps are untouched | **user ruling 2026-11-20 (Q1)** (3.6) |
| D-NW4 | gates by construction plus checks, never by a straight strip | 4.1 |
| D-NW5 | built beside today's world (`assets-src/maps-nw/`), one cutover (NW-5) | `mainline` stays green; region tranches run in parallel |
| D-NW6 | Mode 7 far atlas 12 px per cell, low 6 px | same memory as today (6.1) |
| D-NW7 | coordinates move by spot or entrance name; a literal no name covers is rewritten by the codemod under review; never by hand alone | 5.2 |
| D-NW8 | **saves reset to Cornelia**: a pre-NW save on the world map, or one owning a ship or airship, reloads at Cornelia's world entrance on foot; the vehicles go to milestone spots (`BIKKE_DEFEATED` → `a1_pravoka` dock, `AIRSHIP_RAISED` → `a1_s_airship`) | **user ruling 2026-11-20 (Q4)**; momus R3-2 (5.3) |
| D-NW9 | **snow and tundra** as new terrains; the airship lands on tundra, not on snow | **user ruling 2026-11-20 (Q6)** (2.6) |
| D-NW10 | `quest.yaml`, the scenarios and the cutscene name their overworld places (`at: <spot>`, `ref:`) from NW-1 on, so one file serves both worlds | momus M5 (5.2) |

## 1. Diagnosis

### 1.1 Why the world is boxy (from the code, at `150c0138`)

1. **Rectangular region boxes.** `world_api.BOXES` tiles the world with 10 chunk-aligned rects in 7 regions. Each
   module paints only its rects: `world.compose` pastes `out.ground[:b.h]` into the box, and `UNSET` is the only way
   out.
2. **Edge bands default to ocean.** `EDGE = 2`: the 2 cells each side of every box edge belong to the composer and are
   Water unless a seam fills them. So every region boundary is a straight sea lane at least 4 cells wide. The
   overview shows the cross of lanes at x ≈ 62, x ≈ 142, y ≈ 62 and y ≈ 143.
3. **Masks clip the organic coasts.** `world_coast.organic(poly, amp, seed, mine)` and FIRE's `_mine(band)` keep
   land only inside `mine`, the box minus its bands. A polygon that reaches the box edge is cut straight.
4. **Walls and seams are rects.**
   - `SEAMS` (`seam_s` x 110-113, y 146-165; `seam_se`, `seam_w`) and the A1 range `RANGE = Rect(138, 76, 141, 141)`
     are mountain rectangles, with a ±2 wobble at most.
   - ELF draws its Aldi coast "straight on y 146" (`elf/world_land.py`).
   - FIRE forces `land[146:148, 114:146]`, W_south's cliff rows.
5. **Act 1 is a framed block.** `overworld.build()` forces an ocean ring on all 4 sides of its 72x72 grid
   (`land[:4, :]`, `land[-4:, :]`, `land[:, :4]`, `land[:, -3:]`). The mainland's north and west coasts are therefore
   the block's edges. The Aldi is the square left between the block, the isthmus column and the two wall strips.
6. **Mountains as fill and strips, not ridges.**
   - WIND's land "defaults to mountain" and carves basins out of it.
   - FIRE turns every cell no entrance reaches into rock.
   - EARTH's range is a meandering column band (`RANGE_X`).
   - The result is a mountain share of 28 % of all land, in slabs. There is no elevation, so nothing has foothills,
     watersheds or passes.
7. **Rivers drawn as polylines.** FIRE's rivers are "4-connected river courses" laid as axis steps (the staircase
   rivers out of Crescent Lake). WATER's is a gorge of fixed columns. None flows downhill, because there is no
   elevation.
8. **Biomes as blobs.** Deserts are discs or noisy polygons (the caravan's disc, FIRE's `DUNES`), and forests are
   ellipses. Nothing ties them to water, height or latitude.
9. **Noise at one scale, five copies.**
   - Five copies of `fbm` exist: `overworld_noise.py`, `world_coast.py`, `ordeal/world_ordeal_ground.py`,
     `fire/world_fire_ground.py`, and `elf/world_land.py` (`_fbm`).
   - Each sums cells of about 10, 5 and 2.5: bays a few cells deep, with no continent-scale bends, no fjords and no
     capes.

### 1.2 Measured

| Metric (0.1.1 definitions, the world source) | Today (192²) | Concept sketch (256²) | Target |
|---|---|---|---|
| straight coast runs >= 8 edges | 40 (longest 50: Elfland's Aldi coast, y 145/146) | 7 (longest 12) | none > 6 outside exemptions (G-NW1) |
| of those on or next to a box edge or band | 15 | none (no boxes) | none on a chunk line (G-NW3) |
| coast index | 19.7 | 22.1 | >= G2_MIN (G-NW2) |
| Pravoka's range: rows with rock in x 136-141 | 66 consecutive rows | n/a | a ridge with spurs, no column |
| mountain share of land | 28 % | 23 % | 15-22 %, in ranges |
| land cells | 21,089 | 22,698 | about 36,000-42,000 |

### 1.3 Continent by continent (now / classic / natural)

| Continent | Now | Classic arrangement | Natural-world fix |
|---|---|---|---|
| Cornelia's continent (A1) | a square block. Its mainland's north coast is straight at y ≈ 65; the Aldi is a square bay; Pravoka's range is a 4-cell column x 138-141 for 66 rows | a long east-west mainland wrapping the Aldi's north; Cornelia on a peninsula hanging into the inner sea; Pravoka to the east on the same land | regenerated round its pins: the peninsula keeps its shape language; the mainland runs on to a ragged north coast with capes and a lake district; Pravoka's range becomes a ridge with spurs falling to the outer fjord |
| The Aldi Sea | a rectangle bounded by four straight walls | an irregular inland sea, closed by land on every side, with the canal at its north-west | an irregular basin with coves and two islets; the walls are ridges and headlands (4.1) |
| Duergar isthmus (EARTH) | a straight column x 49-61 | a narrow north-south neck west of the inner sea, joining Elfland | a curved neck with a hogback ridge, the canal saddle, coves on both sides |
| Western continent (Melmond) | a tall rounded oblong; the range a straight-ish band; badlands to the south | a broad west continent: Melmond on its east shore, the Earth Cave in its south, Sarda and the Titan's tunnel in the west | a rain-shadowed east (Melmond's dying plain, the badlands) behind a west-coast range; Sarda's coast a wet strip under the range |
| Elfland (ELF) | a wide oblong whose north coast is straight on y 146; the fens a polygon | the inner sea's south shore: Elfheim in its south-east, the Marsh Cave to the south-west, the Western Keep at the north-west tip | a lobed continent with a long north-west arm (the Keep's cape); the marsh in a wet lowland round a river delta; forests by moisture |
| South-east continent (FIRE) | its west edge is the box edge; the Aldi cliffs are straight rows; staircase rivers; a disc desert | Pravoka's land in the north joins it; Crescent Lake in the south-east; a maze of rivers in the centre; Gurgu to the west, the Ice Cavern, the Lykion desert to the south | a volcanic arc (Crescent's ring as a caldera ridge); rivers from the lake following the slope; the desert in the south-east rain shadow |
| Onrac (WATER, NW) | a square, much of it mountain fill; a straight river | a large north-west continent: the caravan desert to the west, Onrac on the east coast, the waterfall at the head of the river in the north | a cold continent with a central ridge; the river runs downhill from the waterfall to Onrac's bay; the caravan desert in the lee of the ridge; tundra and snow in the north |
| Citadel / Cardia (ORDEAL, N) | a round island; a ring of round islets | an arc of land in the north centre (the Citadel), with the Cardia islands to its south-west | a crescent island arc with a high spine; Cardia an archipelago of 8-12 islets with reefs |
| Gaia / Mirage / Lufenia (WIND, NE) | a square of mountain fill with three carved basins | a big north-east continent: Gaia in the north-east, the Mirage desert in the middle, Lufenia at the end of a long southern tail | the interior desert ringed by ranges; Gaia's bowl in the north-east hills; Lufenia on a long cliffed peninsula |

## 2. Target design

### 2.1 Size (ruling: 256x256)

| Option | Cells, chunks | Area vs today | s\* with margins | Compile peak (11.3 GB x area; W1-C1 measured 11.26 GB for 192²) | Mode 7 far atlas | Verdict |
|---|---|---|---|---|---|---|
| 224² | 196 | 1.36x | about 0.77 | about 15 GB | 14 px, 3136² | too little room |
| **256²** | **256** | **1.78x** | **about 0.86** | **about 20 GB** | **12 px, 3072² (unchanged)** | **ruled** |
| 288² | 324 | 2.25x | about 0.97 | about 25 GB, at the 26 GB limit | 12 px = 3456² | rejected |

Other costs at 256²:
- **Disk:** about **70 MB** of world chunks (41 MB today x 1.78).
- **Time:** a full compile of about 150-340 s; a determinism run of about 5-10 min.
- **`--region`:** the limit stays 10 GB. The largest region plus its ring is about 70 chunks, estimate 7 GB.
- **Runtime:** chunk streaming is view-based (30 wanted, a cap of 60), so the runtime cost does not grow.
- **Walks:** about 1.17x longer per classic distance (0.86 / 0.735), except act 1's (2.2). The balance work in NW-5
  absorbs this (4.4).

### 2.2 Scale, placement and act 1's frame

- **New targets.** `target = CORNELIA_NW + s* x ref_offset`.
  - The reference offsets are `world-anchors.yaml`'s, in classic tiles from Cornelia.
  - `CORNELIA_NW` is about (150, 156); NW-0 fixes it.
  - s\* is fitted (NW-1, 4.2).
- **Act 1 keeps today's relative layout.** Its pins sit at `CORNELIA_NW + (p_today - (92, 111))`. Cornelia to
  Pravoka stays 40 cells, the bridge and the temple stay a short walk away, and Matoya stays north-north-west of the
  Temple as today.
  - Pinned this way, act 1 is about 0.82 of the new scale. That is inside the long-pair band [0.70, 1.30] for every
    act-1 pair except cornelia-temple, which is distance-exempt today and stays so.
  - pravoka-matoya measures 0.73 against a band edge of 0.70: NW-1 computes it in the full table (4.2).
- **No act-1 frame.** The act-1 block, `A1_ORIGIN`, `A1_SIZE`, `FROZEN_CORE`, `FROZEN_EXCEPTIONS`,
  `PRAVOKA_ICON_CELLS` and `world.frames.a1` all go. Act 1's cells are world cells like every other region's (3.6).

### 2.3 Layout sketch (the classic arrangement; original shapes)

```
 x:  0        32        64        96       128       160       192       224      255
  0  ~ ocean ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 32  ~~  [ONRAC  snow/tundra N ]~~~~~~~~~~ [CITADEL arc ] ~~~~~ [GAIA hills    ]  ~~
     ~~  [waterfall, ridge N-S ]~~ Cardia ~~  spine    ~~~~~~~ [MIRAGE desert ]   ~
 64  ~~  [caravan | Onrac coast]~ . : . :  ~~~~~~~~~~~~~~~~~~~ [ranges ring it]   ~
     ~~  [  Sea Shrine bay     ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ [Lufenia tail]~ ~~
 96  ~~~~~~~~~~~~~~ isles ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  [cliffs ]  ~~~~
     ~~~~~~~~~~~~~~~~~~~~~~ [Matoya] [====== MAINLAND ridge ===========]  ~~~~~~~~~~
128  ~~~~~~~~~~~~~~ [I ]~~~ [mainland W  Temple]  [CORNELIA'S CONTINENT  (act 1)]~~~
     ~~ [WEST     ] [S ]   ~~ ALDI SEA ~~ Cornelia pen.    Pravoka | range | fjord ~
160  ~~ [Melmond  ] [T ] ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |range|  [SOUTH-EAST          ]
     ~~ [range|Sarda][H] ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |cliff|  [Ice  lake/rivers    ]
192  ~~ [Earth cave] Keep~~~~~~~~~~~~~~~~~~~~~~~~~~~~ W_south [Gurgu  Crescent ring]
     ~~~~~~~~~~~~ [ELFLAND  arm, forests, Elfheim, fells   ] [   Lykion desert     ]
224  ~~~~~~~~~~~~ [ Marsh delta (fens)                     ] ~~~~~~~~~~~~~~~~~~~~~~
255  ~ ocean ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

| Continent (owner) | Shape language | Ridges (elevation) | Water | Biomes | Gate role |
|---|---|---|---|---|---|
| Cornelia's continent (A1) | an east-west mainland with a ragged north coast; the peninsula hanging south-west into the Aldi (today's outline as the spec polygon) | the spine (barrier `spine`, the bridge its only cut); the mainland ridge; Pravoka's range N-S with spurs | the east river from its tarn (pinned); the city stream and the moat ponds (stamps); new mainland streams | grass and forest; the temple's dark forest; a dry lee strip south of the mainland ridge | the bridge (BRIDGE_BUILT); Pravoka's range = W_east |
| The Aldi | an irregular inland sea with 2 islets and coves | — | ship basin `aldi` | — | closed by W_west, W_isthmus, W_arm, W_south, W_east |
| Duergar isthmus (EARTH) | a curved neck, about 6-12 cells wide | a hogback; a low saddle for the canal | coves on both sides; the dwarves' landing | forest on the Aldi side, grass downs | W_west, W_isthmus; the canal (CANAL_OPEN) |
| Western continent (EARTH) | broad, with a western cape and a south-west bight | the western range from sea cliff to sea cliff (barrier `western_range`) | streams west to Sarda's coast; Melmond's river east | wet pine west of the range; Melmond's plain and the badlands in its rain shadow | the giant's tunnel is the only crossing |
| Elfland (ELF) | lobed; the long north-west arm (the Keep's cape); the south-west delta | low fells in the east (toward W_south) | a river from the fells to the delta; the marsh | forest heartland, the marsh delta, fells | W_arm; `elf_port` |
| South-east (FIRE) | joined to Pravoka's range by a rock neck; a long east coast | a volcanic arc: Gurgu's cone; Crescent's caldera ring (barrier `crescent_ring`) | Crescent Lake in the caldera; R-volcano and R-ice down the outer slope (pinned) | ash near Gurgu, a frost hollow by the ice, the Lykion desert in the south-east lee | W_south; the `fir_crescent` dock on the outer fjord; canoe-only south lands |
| Onrac (WATER) | a big NW continent; the Sea Shrine bay on the east; fjords in the north | a central N-S ridge; the waterfall's head | the waterfall river downhill to Onrac's bay (pinned R-waterfall) | snow and tundra north; the caravan desert in the west lee; cold forest | dockless; airship tundra or grass by each site |
| Citadel / Cardia (ORDEAL) | a crescent island arc; an archipelago of 8-12 islets | a high spine along the arc | — | grass and forest; a cold north rim | dockless; the islets have landable grass |
| Gaia / Mirage / Lufenia (WIND) | a big NE continent with a long southern tail | ranges ring the interior; Gaia's hills NE; Lufenia's cliffed tail | Gaia's spring; the tarns (`wnd_tarns`) | the Mirage desert interior; forests on the outer slopes; snow on the north rim | dockless; Lufenia's mesa cliffed from the Mirage sands |

### 2.4 Natural-geography rules (the generator's contract)

1. **Coasts are fractal.** Each coast is a polygon signed distance with:
   - a domain warp at continent scale (amp 10-16 cells, cells 48 / 24 / 12);
   - fbm at 24-1.5 cells;
   - a coast-only detail term (amp up to 18, faded beyond 14 cells from the coast);
   - a second warp on the high-relief coasts (Onrac, Gaia's north, Pravoka's fjord), which gives fjords.
2. **Islands and archipelagos** are seeded inside hint discs: Cardia, the west and south coasts, and the Aldi
   islets. Each keeps `min_island` 8 cells and a ship strait of at least 3 cells.
3. **Mountains follow ridgelines.**
   - Elevation is a coast-distance term plus ridge polylines with a Gaussian falloff, widths 3-5 cells, modulated by
     ridged noise (spurs, crags, saddles).
   - Mountain where the elevation exceeds `h_m`. The foothills come from the organic renderer (`terrain/peaks.py`).
   - Passes are explicit low points on a ridge.
4. **Rivers flow downhill.**
   - Priority-flood the elevation (pits filled; heap ties broken by (elevation, y, x)), then run D8 flow with a rain
     field. Rivers are the cells whose accumulation exceeds `a_r`; they end in the sea or a lake. Pits deeper than
     `d_l` become lakes.
   - Rivers are made 4-connected (the canoe moves orthogonally) by a diagonal fix-up.
   - **Canoe routes are pinned** (R-volcano, R-ice, R-waterfall, the lake crossings): a pinned route carves its
     valley into the elevation first, so the hydrology follows it.
   - **4b. Walking corridors** (momus M1).
     - Each region spec lists its corridors: polylines, 3 cells wide, between the entrances, docks and spots that a
       stage S0-S14 walks between. S14 is included: the canoe is granted inside Crescent, so the walk from the
       `fir_crescent` dock to Crescent's gate comes before it.
     - Examples: Cornelia → the bridge → Pravoka; the temple road; Elfheim's dock → Elfheim → the Keep → the Marsh
       Cave; the dwarves' landing → the hall; Melmond's dock → Melmond → the Cavern of Earth, the giant's east mouth.
     - An unpinned river may not cross a corridor's cells except at a **ford stamp**: one bridge cell `=` plus a
       grass bank each side, placed where the river meets the corridor's centre line, at most 2 per corridor.
       Otherwise it is rerouted: its accumulation is cut at the corridor and the stream ends in a lake pit before it.
     - **A ford never sits on a pinned canoe route.** A bridge cell is not canoe terrain, so a ford on R-volcano,
       R-ice, R-waterfall or the lake crossings would cut the route. Where a corridor meets a pinned route, the
       corridor is rerouted round it: pinned routes win. If no detour within the corridor's detour band exists, the
       compose fails (`routes`, 3.8).
     - The `prewalk` check (3.8) proves the result.
5. **Climate.**
   - Moisture comes from a westerly sweep per row that refills over the sea, drains slowly over land and fast over
     high ground (rain shadow).
   - A coast and river term and hand **climate hints** are added on top. Arid: the caravan, Mirage, Lykion and
     Melmond's badlands. Wet: the Marsh delta, Sarda's coast.
   - Temperature is latitude (cold from about y 70 north) minus elevation, with a noisy cut-off (no straight snow
     line).
6. **Biomes** come from a table on (moisture, temperature, elevation): ocean; beach sand on low hot coasts; grass;
   forest; swamp (wet lowland by water); sand (desert); mountain; tundra (cold, dry or low); snow (colder, or high in
   the north). Small patches tidy to their neighbours (`min_blob` 3, as today).
7. **Sites shape the ground, not the reverse.** Each site is a pin: its icon cells, door, gate, dock, the landing cell
   and a clearing radius are forced, and the elevation is flattened round it. The FX-R dressing stays.
8. **Roads are routed, not drawn.** A pinned road (`roads` in a region spec: ordered ends, e.g. Cornelia's south gate
   → the bridge foot; the temple road; the tomb road to TOMB_END) is laid after the biomes by A\* on the generated
   ground.
   - Costs: grass 1, sand or forest 2, swamp 4.
   - Mountain, water and river cells are refused except at a bridge or ford stamp.
   - Ties are broken by (y, x).
   - `road_check` (its materials and ends) runs as today.

### 2.5 Variability and determinism

- **Knobs.** Per continent spec: `warp`, `rough` (coast detail amp), `islands` (density), `ridge_scale`, `aridity`
  and a seed. Global: the world seed and three presets (A calm, B classic, C rugged), chosen at the pilot (Q5).
- **Locality.** Each continent's field is computed in its own bounding box plus a 24-cell margin and combined by max;
  the noise is defined on global cells. Editing one continent's spec therefore changes only cells within its
  influence. NW-2 measures this, and a selftest asserts that the cells outside the margin stay byte-equal.
- **Determinism.** Numpy seeded generators only, row-major loops, no `random`, no `hash()`, no set iteration (as
  today). G-NW5 covers the output.
- **Metrics** (`worldgen/metrics.py`, printed by `world.py --metrics`): G-NW1-3 (0.1.1), the mountain share, the
  river length, the island count and the per-biome shares, per continent.

### 2.6 Snow and tundra (D-NW9; every file and its test)

Two new terrains, with no new paid art:

| | Legend | `TerrainType` | Walk | Ship / canoe | Airship lands | Look |
|---|---|---|---|---|---|---|
| tundra | `t` | `Tundra = 12` | yes, speed as grass | no | **yes** | recoloured `grass` (`FALLBACK_MATERIALS`: hue +20, sat 0.45, val 0.95) |
| snow | `n` | `Snow = 13` | yes, speed as grass | no | **no** | recoloured `sand` (sat 0.08, val 1.25) |

Files and tests (NW-2 for the Python side, NW-5 for the runtime side, since the runtime only meets them after the
cutover):

| File | Change | Test |
|---|---|---|
| `src/types/index.ts` (`TerrainType`, 424 / 442 lines) | `Tundra = 12`, `Snow = 13` (+2 lines) | `tsc` |
| `src/systems/fieldRules.ts` `baseTerrain` | accepts 12 and 13 (today every value outside 0-9 and 11 becomes Wall) | `tests/systems/fieldRules.test.ts`: 12 and 13 read back; 14 is Wall |
| `src/systems/fieldRules.ts` `terrainAllows` | walking allows both | same file: walk yes, ship and canoe no |
| `src/systems/fieldRulesVehicles.ts:35` (the landing rule, used by `canLand`) | `t === Grass \|\| t === Tundra` | `fieldRules.test.ts`: canLand on tundra yes, on snow no |
| `src/rendering/CollisionMap.ts` | none (reads `baseTerrain`) | `tests/rendering/CollisionMap.test.ts`: a 12 / 13 cell is not Wall |
| `src/rendering/chunkStreaming.ts` `TERRAIN_COLOURS` | tundra `0x8a9a7a`, snow `0xe8ecf0` (the flat placeholders) | `tests/rendering/streamWindow.test.ts`: `dominantColour` of a snow chunk |
| `src/rendering/PlaceholderTextures.ts` | the legacy 1x placeholder for 12 and 13 | `tests/rendering/PlaceholderTextures.test.ts` (a texture per `TerrainType`) |
| `src/scenes/exploration/BattleBackdrop.ts`, `ExplorationScene.ts` (terrain name lookup) | `'tundra'`, `'snow'` resolve through the map's `battleBackgrounds.terrain` | `tests/scenes/BattleBackdrop.test.ts`: snow → its backdrop id |
| world source `battleBackgrounds.terrain` | `tundra` and `snow` map to staged backdrops chosen by WATER / WIND / ORDEAL in NW-R: an existing staged id or one staged by `stage_backgrounds.py` from the hand-made sources (no paid art) | `tests/data/assetCoverage.test.ts` (the id exists) |
| Mode 7 landing: `src/scenes/exploration/mode7/FlightView.ts:218` (the marker via `canLand`), `FlightBillboards.ts` (the shadow cell) | none beyond `canLand` | `tests/scenes/mode7/mode7Tilt.test.ts`: the marker shows over tundra, not over snow |
| `src/progression/questExplore.ts`, `questMutateFind.ts`, `questMutateOps.ts` | none (they use `terrainAllows` / River / Lake) | the verifier's fixtures gain one tundra and one snow cell (`tests/fixtures/quest/clean.yaml`) |
| `src/entities/WalkingMode.ts` | none (speed 1.0 for both) | — |
| `assets-src/tools/build_map.py` | `LEGEND` `t` / `n`; `TERRAIN` 12 / 13; `SOFT` appended `tundra`, `snow` (at the end: a layer's seed depends on its index); `ROUNDED` 12 / 10; `FALLBACK_MATERIALS`; `BLOCKED` unchanged (both walkable) | `build_map.py --selftest` (a legend case) |
| `assets-src/tools/map_checks*.py` (`MC.BLOCKED`, walkable sets), `layouts/world_geom.py` `WALKABLE` | add `t`, `n` as walkable | `map_selftest.py` |
| `assets-src/tools/terrain/` (`base.TEX`, `outline` partition, `metrics.classify`) | the two materials | `terrain/selftest.py`: a tundra / snow blend case |
| `assets-src/tiles.py` (the legacy 1x atlas, rows in `TerrainType` order plus the counter) | rows 12 and 13, code-drawn (snow speckle, tundra moss) | `tests/data/assetCoverage.test.ts` (a row per `TerrainType`); `npm run assets terrain` |
| `src/core/schemaValidation.ts` (terrain names in `battleBackgrounds`) | accepts `tundra`, `snow` | `tests/core/schemaValidation.test.ts` |

The encounter zones do not depend on the terrain, so the new terrains change no balance.

## 3. Generator architecture

### 3.1 Pipeline

```
continent specs (polygons, ridges, walls, passes, corridors, roads, climate hints, islands)  +  site pins and stamps
  -> shape    land field: warped polygon SDF + fbm + coast detail; islands; forced land/water (pins, walls, Aldi, channels)
  -> relief   elevation: coast distance + ridges (ridged noise) + passes; flatten at pins; carve pinned canoe valleys
  -> hydro    priority flood, D8 flow, accumulation -> rivers (4-connected), lakes; corridor fords / reroutes (2.4 4b)
  -> climate  moisture (westerly sweep, rain shadow, hints), temperature (latitude, elevation)
  -> biomes   table -> legend chars; tidy (min_blob, inlets, ponds)
  -> roads    A* between pinned road ends (2.4 rule 8)
  -> stamps   region stamps (icons, quays, docks, fords, bridge strait, moat ponds), objects, NPCs, inspect, patches
  -> owners   owner grid: each cell -> region (continent membership; sea cells by nearest coast)
  -> checks   3.8 (gates, prewalk, north, metrics, per-region map checks)
  -> source   assets-src/maps-nw/overworld.yaml (at the cutover: assets-src/maps/overworld.yaml)
```

### 3.2 Files (each under 250 lines; `tests/data/questCeilings.test.ts` is extended to `worldgen/` and `world_specs/`)

| File | Content | Est. lines |
|---|---|---|
| `assets-src/tools/worldgen/noise.py` | the one value noise, fbm, ridged noise, domain warp (replaces the 5 copies, which go with their region grounds) | 110 |
| `worldgen/spec.py` | the spec dataclasses (`Continent`, `Ridge`, `WallLine`, `Pass`, `Corridor`, `Road`, `ClimateHint`, `IsleField`, `Pin`, `Stamp`), the reference-to-world transform | 160 |
| `worldgen/shape.py` | the land field and islands; forced masks | 180 |
| `worldgen/relief.py` | elevation, passes, flattening, valley carving | 170 |
| `worldgen/hydro.py` | priority flood, flow, rivers, lakes, 4-connectivity, pinned routes, fords and reroutes | 230 |
| `worldgen/climate.py` | moisture, temperature, the biome table, tidy | 170 |
| `worldgen/roads.py` | the A\* road router | 110 |
| `worldgen/owners.py` | the owner grid, `owned_chunks(r)`, `raster(r)`, the sea split | 130 |
| `worldgen/gates.py` | the wall, barrier, north and route checks (3.8) | 220 |
| `worldgen/prewalk.py` | the `prewalk` check (reads `quest.yaml`) | 120 |
| `worldgen/metrics.py` | 0.1.1 and 2.5 | 160 |
| `worldgen/selftest.py`, `selftest_gates.py` | synthetic specs: a straight-edged polygon ends with no run > 6; a ridge gets foothills; a river reaches the sea; a pinned route connects; a river across a corridor gets a ford; locality; determinism; **the former GT-38 / GT-39**: a river across `western_range` fails `barriers`; a river joining a northern island to a southern coast (a walk+canoe link) fails `north`; a ford on a pinned canoe route fails `routes` | 200 + 160 |
| `layouts/world_specs/<region>.py` (7) | each continent's spec data (owned by its region tranche) | 60-180 each |
| `layouts/a1/world_a1_pins.py`, `world_a1_checks.py` | act 1's pins and stamps, and its promises as world checks (3.6) | 200 + 150 |
| `layouts/world.py` (rewritten) | the composer v2 (3.1 order) | 210 |
| `layouts/world_api.py` (v2) | WORLD 256, `DOCKS_ALLOWED`, `WALLS` as wall-line ids, `BASIN_SEEDS`, `G2_MIN`, `EXEMPT_KINDS`, `RegionOut` v2. `BOXES`, `SEAMS`, `EDGE`, `PLACEHOLDER_WALLS`, `A1_ORIGIN`, `A1_SIZE`, `FROZEN_CORE`, `FROZEN_EXCEPTIONS` and `PRAVOKA_ICON_CELLS` are removed | 190 |

### 3.3 `RegionOut` v2

- **Removed:** `ground` (rows of the box), the band rule, `stub`.
- **Added:**
  - `spec`: the region's continent specs;
  - `pins`: cells and the material each must have, with a clearing radius;
  - `stamps`: small ground overrides inside the region's pins only, of a kind from `EXEMPT_KINDS` (quay, dock,
    canal, bridge, icon) or `pond`, `rock`;
  - `routes`: pinned canoe routes (name, ends, the cells they may use);
  - `corridors` and `roads` (2.4 rules 4b and 8);
  - `spots`: named overworld places for `quest.yaml`, scenarios and cutscenes (5.2).
- **Kept:** objects, NPCs, inspect, transitions, entrances, gates, patches, docks, hazards, zones, vehicles, ambient,
  backgrounds and checks. Barriers are now a ridge or ring id plus two seeds (the composer derives the cells and the
  minimal cut). Walls are referred to by wall-line id.
- **Zones** are built after the ground.
  - A region lists named zone areas: a polygon, or "the region's land of biome X", or "the cells within d of spec
    feature F". `owners.py` intersects them with the region's owner cells and turns them into `row_rects` as today.
  - Zone ids are unchanged, so `bestiary.yaml`'s habitats hold.
  - A walkable or canoe cell of a region left in no zone fails the compose. This is the coverage test's rule, moved
    into the build and now applied to act 1 too.

### 3.4 Ownership, `--region` and the compiled base (momus M8)

- **The owner grid.**
  - Each land cell belongs to the region of its continent spec. A continent may hold two regions, split by a named
    owner line in the spec: A1 and FIRE meet at Pravoka's neck, EARTH and ELF at the isthmus.
  - Each sea cell belongs to the region of the nearest coast cell, ties broken by `REGIONS` order.
- **`regions.<r>.raster`** (written into the source by the composer, read by `build_map.py --region`) is the list of
  the chunk rects that hold at least one owner cell of `r`.
  - Each rect is one chunk (16x16 cells, inclusive), merged row by row into maximal horizontal runs of adjacent
    chunks.
  - `--region r` paints those rects plus a 1-chunk ring and writes their chunks, as W1-C1's multi-rect raster does
    today. Chunk locality (GAP-14) makes the result byte-equal to a full compile.
- **A shared chunk** (owner cells of 2 or more regions) is written by every `--region` run that touches it. That is
  safe, because one world source gives the same bytes from any raster.
  - For bookkeeping (`world.py --owned-chunks`, `build.boxes`, review), a chunk's **owner** is the region with the
    most owner cells in it, ties broken by `REGIONS` order.
  - Before NW-5 no compiled chunk is committed, so a shared chunk can never conflict in git. After NW-5 a compiled
    world is always the integrator's full compile.
- **The chunk-digest mode of `check_base`** (momus R3-5).
  - The problem: today's `terrain/region.py` `check_base` refuses a base when any other region's box digest
    (`build.boxes`) changed. On the owner grid, a coast edit in EARTH changes ELF's raster too (the isthmus), and one
    in A1 changes FIRE's (Pravoka's neck). So every NW-R `--region` would hit "stale base".
  - The NW mode: a source with `regions` from the owner grid records **`build.chunks: {"c,r": digest}`** instead of
    `build.boxes`. Each digest covers everything the chunk's pixels read: its source cells and objects plus a
    1-chunk ring (`RING_PAD`, `OBJ_REACH`), and the compiler digest.
  - `--region r` then paints the union of r's raster and **every chunk whose digest differs from the base's**, each
    with its ring. `check_base` checks only the size and the compiler; a changed neighbour is repainted, not
    refused. GAP-14 locality makes the result byte-equal to a full compile, and `build_map.py --selftest` gains the
    case "an edit in region A changes a chunk of region B: the `--region A` result equals the full compile".
  - Over **70 changed chunks** (the 10 GB `--region` limit) it refuses with "run a full compile"; that is the
    integrator's job.
  - Owner: NW-4 (`terrain/region.py`, about +40 lines; it is at 189 lines).
- **The compiled base.** An NW-R agent compiles over a full scratch compile.
  - The **NW integrator** builds it by a full compile under the lock, into `~/temp/ff-game/worldplan/base/latest/`,
    read-only, with its source hash in `base.txt`.
  - It builds the first one at the end of NW-4, and refreshes it in the merge window after any NW merge whose diff
    changes more than 70 chunk digests.
  - An NW-R agent clones the base (`cp -c`, an APFS clone, about 70 MB) into `/tmp/<agent>/nw-out/` and runs
    `--region <r>` over it. The chunk digests repaint whatever differs from its own branch, so any base with the same
    compiler serves. It never full-compiles.
- **Compile budget** (48 GiB machine; one world compile at a time by the lock):

| Job | Peak (estimate; NW-0 and NW-2 measure) | Who | When |
|---|---|---|---|
| full compile, 256², with the Mode 7 bake | about 20 GB + 1-2 GB for the bake (the 16 px 4096² bake in NW-0; 12 px 3072² after NW-1); limit 26 GB (G-NW8) | NW integrator only (NW-0's agent for its pilot compile) | NW-0, NW-2, NW-4, each base refresh, NW-5, NW-INT |
| `--region <r>` over a base | about 7 GB, limit 10 GB | NW-R agents, NW-3 | any time, under the lock |
| Vitest per worktree (`--maxWorkers=2 --minWorkers=1`) | about 2 GB | every agent | any time |
| dev server | about 0.5 GB | browser checks | NW-INT, M7 |

  - **The rule:** a full compile starts only while at most 6 other worktrees are active, since
    floor((48 - 26 - 4) / 2.5) = 7, with one spare.
  - While M7-5 and M7-6 run, NW-R therefore runs at most 4 agents at once, plus the integrator; with M7-5 and M7-6
    merged, all 6.
  - A `--region` job (10 GB) leaves room for 13 worktrees, so it is never the limit.
  - **Full compiles planned:**

    | Tranche | Full compiles |
    |---|---|
    | NW-0 | 1 (pilot) |
    | NW-1 | 1 (today's world recompiled with spots, 192²: 11.3 GB) |
    | NW-2 | about 3 |
    | NW-4 | 1 (the first base) |
    | base refreshes | at most 6 (one per NW-R merge, only when more than 70 digests changed) |
    | NW-5 | about 3 |
    | NW-INT | 1 |

    That is about 16 full compiles at about 3-6 min each, about 1.5 h of lock time in all, each one under the
    6-worktree rule.

### 3.5 What tranches edit

- A region tranche edits only its `world_specs/<region>.py`, its `world_<region>.py` content module, its site files,
  its zone data and its tests under `tests/nw/<region>/`.
- The generator, the composer, `world_api.py` and the metrics are the **NW integrator's** (NW-1, NW-2, NW-4). A
  region that needs a constant changed asks the integrator.
- Every change regenerates the world source. Merges re-run the layout scripts (QUEST 4.0's rule); the source is never
  hand-merged.

### 3.6 Act 1 regenerated and re-pinned (D-NW3; momus M3, M4)

#### 3.6.1 What stays, what goes

- **Unchanged:** every interior map: Cornelia (`cornelia.yaml` and its houses, shops and inn), the castle (4 maps),
  the Temple of Fiends, Pravoka and its rooms, Matoya's cave. Their exits name overworld entrances, which keep their
  names.
- **Regenerated:** the act-1 overworld ground, its coast and relief, its rivers outside the pinned ones, its forests,
  roads and zones' cells.
- **Retired** (removed at NW-5; kept until then because `mainline` still builds today's world):
  - `overworld.py`'s `build()`, `check()` and `objects()`. The file stays as the shim that runs `world.py`.
  - `overworld_consts.py`, whose 63 local pairs become pins (3.6.2).
  - `overworld_grid.py`, `overworld_noise.py`, `a1/world_a1_ground.py`.
  - The cell logic of `overworld_zones.py` (its encounter tables and `ZONE_BACKDROPS` stay).

#### 3.6.2 The pins and stamps (`layouts/a1/world_a1_pins.py`)

Every pin is written relative to Cornelia's south-gate arrival, from today's world cells: `rel = p_today - (92,
111)`. Its world cell is `CORNELIA_NW + rel`. NW-3 derives the table by script from today's source, so nothing is
retyped.

| Feature | Pin / stamp | Today's source |
|---|---|---|
| Cornelia | the city icon footprint, the gates and their entrances (`cornelia`, `cornelia_west`, `cornelia_east`, `cornelia_north`), the moat ponds and the city stream (`pond` stamps; the stream a pinned river through the town as the icon draws it) | `overworld_consts` (CX, CY, PONDS, STREAM, UNDER_TOWN) |
| the castle | the `castle` entrance and its door cell inside the icon | `overworld_consts`, `world_a1` |
| the jetty and the ship's spawn | the jetty `quay` stamp; the Aldi seed cell (`BASIN_SEEDS.aldi`, the cell below the jetty) | JETTY; `world_api.BASIN_SEEDS` |
| the peninsula | its outline as the A1 spec polygon, from `overworld_consts` LAND, SOUND, GULF, SOUTH_BAY (translated); the coast detail is regenerated | LAND, SOUND, GULF, SOUTH_BAY |
| the spine | a ridge from the strait's east side to the eastern sea; the barrier `spine` (seeds: Cornelia's gate, Pravoka's gate), whose only cut must be the bridge's gap cells | SPINE, SPUR |
| the north bridge | the strait's gap cells (`bridge` stamp, Water until BRIDGE_BUILT), the `north_bridge` patch, the gate cells (today (93, 96), (94, 96)), BRIDGE_WORKERS, GATE_MESSAGE, the north shore (`north_shore`) | BROKEN_BRIDGE, BRIDGE_FOOT, N_STUB, S_STUB |
| the Temple of Fiends | the door and transition (`temple`), its rock and icon, the approach grass and dark forest (`temple_approach`) | TEMPLE_DOOR, TEMPLE_OBJECT, TEMPLE_ROCK, TEMPLE_GRASS |
| the east river and the tomb pocket | the tarn (a lake pin), the east river (a pinned river from the tarn to the south bay), the footbridge (`bridge` stamp), the pocket (`east_pocket`), Erdrick's tomb (inspect TOMB, chest TOMB_CHEST, the road end TOMB_END) | TARN, RIVER, FOOTBRIDGE, TOMB, TOMB_OBJECTS, TOMB_ROCK |
| the roads | the routed roads (2.4 rule 8): Cornelia's south gate → the bridge foot; → the temple; → the footbridge → TOMB_END | ROADS, FOOT_ROAD |
| boulders, beaches, signs | BOULDERS (on grass, as `act1()` checks), the beaches as `sand` pins, PIER_TEXT inspect | BOULDERS, BEACHES, PIER_TEXT |
| Matoya | her hill (`rock` stamp), the door, the clearing, `a1_matoya`; north-north-west of the Temple, as today and per the anchors | `a1/world_a1_ground.py` HILL, MATOYA_DOOR, CLEARING |
| Pravoka | the approved 3x3 icon, the door, the gate (`a1_pravoka`), the quay and dock (`a1_pravoka` dock), the pirates' brig and quay, the lighthouse, the cairn and its pass, the shelf | `a1/town_pravoka_site.py`, `a1/world_a1_sites.py`, `a1/world_a1_ground.py` (SHELF, HEADLAND, PASS, CAIRN) |
| the Aldi channel | Pravoka's channel: at least 6 Water cells between the quay and the range on every channel row, as a `sea` force and a check | CHANNEL_ROWS; `tests/quest/a1/pravokaChannel.test.ts` |
| Pravoka's range | a ridge (W_east) with spurs, from the mainland to FIRE's rock neck | RANGE, SPURS, JOINT |

#### 3.6.3 Act 1's promises as world checks (`layouts/a1/world_a1_checks.py`)

These are ported from `overworld.check()` and the act-1 tests to world cells:

- the bridge is the only way off the peninsula on foot (barrier `spine`, bridge patch off);
- the tomb pocket is reachable on foot only over the east footbridge;
- the temple door is reachable from Cornelia on foot before BRIDGE_BUILT;
- Matoya and Pravoka are reachable on foot after BRIDGE_BUILT;
- Pravoka's channel has at least 6 Water cells per row;
- the world map has exactly 2 key-item gates, the bridge's (`act1Flow.test.ts`);
- beyond the bridge the land walkable from `north_shore` is larger than the peninsula (OW-15, `act1Flow.test.ts`);
- the boulders stand on grass;
- `road_check` ends at TOMB_END.

**The feel (the user's "keep the opening").** The walks are measured by BFS on today's compiled map and on the new
world, and must stay within ±10 % (`tests/nw/a1/a1Walks.test.ts`, then `tests/quest/a1/a1Walks.test.ts`):

| Walk | Today | New |
|---|---|---|
| Cornelia's south gate → the bridge gate | measured in NW-3 | ±10 % |
| Cornelia → the Temple door | measured | ±10 % |
| the bridge → Pravoka's gate | measured | ±10 % |
| the bridge → Matoya's door | measured | ±10 % |

#### 3.6.4 Act 1's zones, balance and pacing

- **Zones.** The act-1 zone ids and tables are unchanged (the fields, `temple_approach`, `east_pocket`, the north
  shore, the sea zones; `overworld_zones.py` tables). Their cells come from zone areas over the new ground (3.3).
  The coverage rule now covers act 1 too.
- **Balance.** `tests/balance/garland.test.ts` drives battles only and needs no change. `fieldPacing.test.ts` and
  `zones.test.ts` read zone tables, unchanged; `fieldCampaign.ts` reads walks. `questCurve.test.ts`'s S0-S3 segments
  use the new witness. All are re-measured in NW-5 (cutover and balance). The ±10 % walk rule keeps the act-1 fight
  counts near today's.

#### 3.6.5 Everything act 1 touches (tests, data, runtime)

| Item | Today | NW |
|---|---|---|
| `A1_ORIGIN`, `A1_SIZE`, `FROZEN_CORE`, `FROZEN_EXCEPTIONS`, `PRAVOKA_ICON_CELLS` (`world_api.py`) | the act-1 frame | removed (NW-1 declares the v2 contract beside v1; NW-5 deletes v1) |
| `world.frames.a1` (the compiled map) | written by `world_a1.py` | not written; `schemaValidationQuest.ts:75-82`: `world.frames` becomes optional and its `a1` shape check is removed (NW-1 makes it optional; NW-5 removes the check) |
| `src/progression/questGeo.ts` `A1_ORIGIN`, `worldOffsetOf` | adds (64, 64) only on a legacy 72x72 world map; [0, 0] on any other | **removed in NW-5 as dead code** (a 256² map already gets [0, 0]); `tests/progression/macroGeography.test.ts:103-106` (the 72x72 branch and the literal Cornelia (92, 111) and Temple (79, 103) cells) reads both from the anchors' entrances |
| `src/systems/MapTransition.ts` `shiftA1`, `Game.pendingFrame` (`Game.ts:59, 173`), the v1 save shift | v1 saves get `frame: 'a1'` | removed; every v1-v3 save on the overworld goes through the reset (5.3) |
| `src/systems/DebugScenarioLoader.ts` `frame: 'a1'` | adds the a1 origin | removed with its 3 users: `r_ow_temple` [15, 42], `r_ow_bridge` [29, 34] and `r_ow_east` [48, 46] become `spot: a1_s_temple_road`, `spot: a1_s_bridge`, `spot: a1_s_east` (the scenario key `spot`, 5.2), spots added in NW-1 on today's world at the cells their frames give |
| `tests/helpers/worldFrame.ts` (`A1_ORIGIN`, `WORLD_SIZE`, `a1At`, `translateA1`) | 4 users | replaced by `tests/helpers/worldSpots.ts` (`spot(map, name)`, `worldSize(map)`) |
| `tests/quest/a1/frozenCore.test.ts`, `act1Overworld.fixture.yaml`, `act1Collision.fixture.json` | the frozen core | **retired**; replaced by `tests/quest/a1/a1Pins.test.ts` (every pin cell's material, every stamp, the promises of 3.6.3) and `a1Walks.test.ts` |
| `tests/data/overworldLayout.test.ts` | the tomb text and the east-bridge reachability on local cells | rewritten by spots: the same assertions |
| `tests/data/overworldZoneCoverage.test.ts` | act 1 exempt, absolute samples | no act-1 exemption; samples by spot |
| `tests/quest/a1/a1_o_sites`, `a1_o_walk`, `a1_t_walk`, `bridgePatch`, `pravokaChannel` | absolute and local cells | by spots and pins (`bridgePatch`'s GAP and GATES come from the patch and the gate records) |
| `tests/quest/a1/a1_t_town.test.ts` | the Pravoka town map | unchanged (an interior) |
| `tests/systems/fieldRules`, `patches`, `scenarioSpawns`, `debugFrame`, `DebugScenarioField`, `saveOriginShift` | `a1At` / `frame` | by spots; `debugFrame` and `saveOriginShift` retired (replaced by `saveWorldReset`, 5.3) |
| `tests/scenes/Act1Blockers`, `ExplorationReentry` | world cells | by spots |
| `tests/data/landmarkArt`, `fxdWorldArt`, `fxrWorldArt` | absolute coast and landmark cells | `landmarkArt` by spots; `fxdWorldArt` and `fxrWorldArt` retired (their coasts are gone; G-NW1-3 replace them) |
| `tests/balance/questCurve`, `fieldCampaign.ts`, `zones` | witnesses, walks | re-measured (NW-5) |
| `tests/progression/macroGeography`, `travelMatrix` | the anchor table, the basin seeds; `macroGeography.test.ts:105` the 72x72 branch and literal cells | new targets; the seeds from the map; line 105 by entrances |
| `tests/data/act1Flow.test.ts` | from the `cornelia` entrance: the temple, both bridge gates (`keyItemGates.length` 2), not the north shore; OW-15 (the land beyond the bridge is larger than the peninsula) | kept as is: it reads entrances, transitions and gates; the new world must keep exactly 2 key-item gates and the OW-15 promise (3.6.3) |
| `tests/data/actOneBalance.test.ts` | the act-1 encounter tables by zone (`east_pocket`, `temple_approach`, the default) | kept: the zone ids and tables are unchanged (3.6.4) |
| the act-1 inspect cells (the tomb, the pier, the cairn, the lighthouse) and objects (the temple icon, the tomb, the boulders, the bridge workers, the brig, the lighthouse) | absolute | pins (3.6.2) |
| `debug-scenarios.yaml` act-1 scenarios (`r_*`, `u_*`) on the overworld | by entrance (all but the 3 above) | unchanged |

### 3.7 Reuse

- `world_coast.organic`'s tidy (inlets, islets, ponds) and `tidy` (min_blob) move into `climate.py`.
- `world_geom` (flood, bbox, `chunk_files`) and `world_checks` (basins, docks, cuts, reachability, ids, anchors) are
  kept, fed by the owner grid instead of the boxes.
- `world_dress.scatter` (FX-R) is kept for every town icon.
- `terrain/` (the organic renderer: coasts, blends, foothills, peaks, roads) is unchanged apart from 2.6. It already
  draws soft coasts from the cell mask: the shape problem is in the mask, not the renderer. `terrain/region.py` gains
  the chunk-digest mode (3.4).
- `map_checks_region.py` runs per region on the owner cells instead of the boxes.
- `overworld_zones.py`'s encounter tables and `ZONE_BACKDROPS` are kept (3.6.4).

### 3.8 Checks (compose-time; `world.py` prints one line each, G-NW4)

Every check runs on the composed world with the stated patches. A failure names the region, the cells and the rule.
`worldgen/gates.py` and `prewalk.py` hold them; the selftests of 3.2 prove each one fails on a bad fixture.

| Check | Patches | Rule |
|---|---|---|
| **basins** | off, then `canal` on | with every patch off, `aldi` and `ocean` are disjoint and each one component; with `canal` on they are one; every dock lies in its basin (with every patch on but `canal`); no Water cell is in neither (WORLD 2.6, kept). Seeds: `world.basins` (written by the composer: the cell below Cornelia's jetty for `aldi`, (2, 2) for `ocean`) |
| **docks** | all on | every dock is in `DOCKS_ALLOWED` and on a Water cell 4-adjacent to a walkable cell; no other dock exists (WORLD 2.6) |
| **walls** | all off | each wall line (W_west, W_isthmus, W_arm, W_south, W_east) is unbroken land at least 3 cells wide along its whole polyline, with no River, Lake or Water cell across it; exported as `world.cuts` for the GT rows |
| **barriers** | all on | `spine` (bridge patch off), `western_range` and `crescent_ring`: the two seeds are not joined **on foot** nor **on foot plus canoe** (River and Lake passable, as the canoe ability allows); the minimal cut is exported (`world.cuts`). For `spine`, the minimal cut with the bridge patch on must be exactly the patch cells |
| **routes** | all on | every pinned canoe route (R-volcano, R-ice, R-waterfall, the lake crossings) connects its two ends by 4-connected River / Lake cells; **no route cell is a bridge or ford `=`**; no unpinned river joins two regions' routes |
| **prewalk** | per stage, below | for each stage S in S0-S14 (the canoe is granted inside Crescent at S14, so its dock-to-gate walk is included): every **required entrance** of S is reachable on foot from one of S's **starts**, with S's **open patches** on |
| **north** | all on | every walk+canoe component (walkable cells plus River and Lake, 4-connected) that holds a cell owned by WATER, ORDEAL or WIND holds only cells owned by those three; and none of them holds a dock |
| **landings** | all on | every airship-only anchor (the 8 north anchors) has a `canLand` cell (grass or tundra, not snow; no transition, gate or NPC) within 8 walking steps (WORLD T6); every vehicle spot of kind `landing` is `canLand` |
| **straits** | all on but `canal` | every ship lane of WORLD 2.6 (Pravoka to Elfheim, Pravoka to the dwarves, the canal onward, the outer seas) is at least 3 Water cells wide along a ship path between its ends |
| **pins** | all off | every pin cell has its material; every stamp lies inside its region's pins; every door's gate cell is walkable and the door has exactly one walkable 4-neighbour (`warp_leaves`); every spot is on a cell of its kind (land walkable, dock Water, landing `canLand`) |
| **act1** | per rule | the promises of 3.6.3 (`world_a1_checks.py`) |
| **coverage** | all on | every walkable or canoe cell (River, Lake) is in a zone of its owner region, act 1 included |
| **detours** | all on | each WORLD 6.1 detour hop on foot (by its anchors) is within its factor (2.5; melmond-sarda 3.0; dwarf-melmond 4.5); the factors are printed (R15) |
| **metrics** | off | G-NW1, G-NW2, G-NW3 (0.1.1) |

**Prewalk's terms** (read from `assets/data/quest.yaml`; stage dependency is the `after` closure, never file order):

- **Open patches of S:** every overworld patch whose flag is in the grants of S's ancestors (the transitive `after`
  closure, S excluded). `BRIDGE_BUILT` opens `north_bridge` from S2 on, `CANAL_OPEN` opens `canal` from the stage
  after the dwarves.
- **Required entrances of S:** every overworld entrance whose cell holds, or is the gate of, an overworld
  transition whose `targetMap` matches one of S's `maps` globs.
- **Starts of S:**
  - S's `entry.at` spot, if S's entry is on `overworld`;
  - every overworld entrance that is the target of an exit or transition of a map in S's or an ancestor's `maps`
    (e.g. `ert_giant_west`, the giant tunnel's west mouth);
  - every dock in `DOCKS_ALLOWED` reachable by ship for S: those of `aldi` if the ship is granted to an ancestor,
    plus those of `ocean` if `CANAL_OPEN` is too.
- A required entrance reached from no start fails with the stage, the entrance and the nearest blocking river or
  ridge cell. The verifier's proof (a) stays the authority; prewalk catches a geography cut before it runs.

### 3.9 Compile cost

- The generator is cheap: the concept sketch runs in under 1 s at 256²; the real one, with the flood, about 2-5 s.
- The compile dominates: about 20 GB and 150-340 s for a full world, under the world-compile lock (3.4). A
  `--region` compile is about 7 GB.
- NW-0 and NW-2 measure both (G-NW8). If the full compile is over 26 GB, the fallback is 4 quadrant compiles in the
  chunk-digest mode under the lock, byte-equal by GAP-14 locality.

## 4. The progression map

### 4.1 Each gate as geography

| Gate (stage) | Today | NW geography | Check |
|---|---|---|---|
| the north bridge (S1) | the act-1 strait | the pinned strait and patch; the spine's only cut (3.6.2) | barrier `spine`; GT rows unchanged |
| the Aldi is landlocked (the ship before the canal) | 4 straight walls and seams | five wall lines as ridges and headlands: W_west (the mainland's west headland to the isthmus' north end), W_isthmus (the hogback), W_arm (Elfland's north coast to the Keep's cape), W_south (Elfland's east fells to the volcanic arc, a mountain neck), W_east (Pravoka's range to the arc). Each is forced land in the shape stage; the ridges make them mountain | walls, basins |
| the canal (CANAL_OPEN) | a patch strip x 48-61, y 88-92 | a low grass saddle across the isthmus (a `Pass` on the hogback), 5-8 cells long; the patch turns it to Water; both ends meet open water | basins (on and off) |
| docks (the ship disembarks only at allowed docks) | `DOCKS_ALLOWED` | the same ids; each dock cell a pin on a natural cove | docks |
| the walks up to the canoe (S0-S14) | hand-drawn ground | the corridors (2.4 rule 4b): rivers cross them only at fords | **prewalk** |
| Melmond's plain ↔ Sarda (the giant's tunnel) | `western_range` column band | a continuous ridge from sea cliff to sea cliff, no pass, no river across | barriers (walk, canoe) |
| Crescent ↔ the south lands (canoe) | `crescent_ring` | a caldera ridge round the lake district; R-volcano and R-ice are pinned rivers through gaps the ridge leaves for them only | barriers, routes |
| the waterfall (canoe) | a straight gorge | a pinned river from the waterfall's head down a valley to Onrac's bay; the ledge cells touch only rock and river | routes |
| the north continents (airship only) | no dock | no dock; mostly cliffed coasts (a spec option makes the coast belt mountain on high-relief shores); each its own walk+canoe component | **north**, landings |
| the airship landing | `canLand` on grass | pinned landing cells (grass or tundra, never snow) by every north site | landings |

The verifier stays the authority. The compose checks catch a geography leak before it runs.

### 4.2 Proof (g): re-fitted

- **The new targets** (NW-1, in `assets-src/maps-nw/world-anchors.yaml` until NW-5): `target = CORNELIA_NW + s* x
  ref_offset` for every anchor outside act 1; act 1's are its pins (2.2). The reference offsets are unchanged.
- **The bands** are today's file values with the scale moved:
  - `tolerance` 2 (±2 per axis);
  - `fit.scale` [0.60, 0.80] → **[0.75, 0.95]**;
  - `longPair` 20 → **23** cells (20 x 0.86 / 0.735);
  - `ratio.long` **[0.70, 1.30]** and `ratio.short` **[0.55, 1.60]**, unchanged;
  - `bearing.long` 40° and `bearing.short` 60°, unchanged;
  - the 15 detour hops with their factors (2.5, melmond-sarda 3.0, dwarf-melmond 4.5), unchanged.
  - The same defaults in `src/progression/questLateData.ts:83-97` read the file (NW-1).
- **Distance-exempt pairs.** Today `distanceExempt: [cornelia, temple]`, which keeps cornelia-temple exempt. With act
  1 pinned at today's relative cells, no other pair needs an exemption at s\* 0.86:
  - cornelia-pravoka about 0.82;
  - cornelia-matoya about 0.85;
  - pravoka-matoya about 0.73, the closest to the 0.70 edge.
  - If NW-1's table puts pravoka-matoya under 0.72, it is added to `distanceExempt` (its bearing still checked) and
    recorded in the NW-1 result.
- **The full table.** NW-1 computes all 31 pairs (distance, ratio, bearing, detour, band) at the targets and at
  20,000 random ±2 placements. At most 0.05 % of placements may fail (today 0.01 %). The table goes in the NW-1
  result.
- Pins are placed at the targets, so the generated world meets (g) by construction. A region tranche may move a pin
  inside the ±2 window only.

### 4.3 Proof (h): the travel matrix

- The rows T0-T10, T6b, B1 and B2 keep their meaning: what each stage can reach with which vehicle. They are already
  written in names. The only raw cells, `BASIN_SEEDS` (`questTravelRows.ts:28`, a copy of `world_api.BASIN_SEEDS`),
  are read from the compiled map's `world.basins` from NW-5 on.
- `--strict` still asks for every allowed dock and the canal patch on the world map.
- **The worst-case run** (new, `--worst-canoe`). Every row T0-T4 is run a second time with the canoe ability added
  and every river and lake passable. In each row:
  - the row's must-not-reach set must still hold, except that in rows T3-T4 (the ship past the canal reaches
    Crescent's shore) `fir_volcano`, `fir_ice` and `fir_desert` may become reachable;
  - the 8 north anchors stay unreachable in every row before T6.
  - It is the generated rivers' worst case: an early canoe finds every river skip.

### 4.4 Curve model, bands and price walls

- Longer walks mean more random encounters. The curve model walks the witness, so every boss's level band (d), the
  kits (d2), the takeGold rule (d3) and the price walls (f) shift.
- **The rule:** the fights per stage stay within ±10 % of today's.
  - Lever 1: the world map's zone step means scale by the route-length ratio per stage. NW-5 measures the ratio from
    both worlds' witnesses before the switch and applies it in the same tranche (momus M6).
  - Lever 2: `grind` stays as it is.
  - No enemy, item or formula changes.
- `tests/balance/questCurve.test.ts` (QUEST 6.4) is re-measured in NW-5; each bound keeps its 3-point margin rule
  (AGENTS "Balance bounds").

### 4.5 The mutation suite

- GT-1 to GT-37 and GT-5b are kept. Their element sets come from the exported wall and barrier cells (`world.cuts`
  names, dock and patch ids, entrance pairs), so they move with the geography.
- **No new GT rows.** The rev 1 rows GT-38 and GT-39 are dropped: a mutation removes a grant or opens a cut, and
  neither can add a river, so they could not be caught. They are compose-check selftests instead (3.2,
  `selftest_gates.py`).
- **The north check** (3.8) is the real guard. With every patch on, every walk+canoe component that holds a cell
  owned by WATER, ORDEAL or WIND holds only such cells.
- The `nonLoadBearing` entries name their element by `ref:` (5.2) instead of `at: [x, y]`.

## 5. Migration

### 5.1 What reads world coordinates

Swept at `150c0138`. The runtime reads the world size from map data (`map.width`, `art.chunk`); `src/` has no
literal 192. Every transition and edge exit into `overworld` (47 + 47 in `assets-src/maps`, 4 in the legacy maps)
uses an entrance name.

| System | Where | What it stores | Count | Moves by |
|---|---|---|---|---|
| world contract | `layouts/world_api.py` | `WORLD_W/H`, `A1_ORIGIN`, `BOXES` (10 rects), `SEAMS`, `PLACEHOLDER_WALLS`, `FROZEN_EXCEPTIONS`, `PRAVOKA_ICON_CELLS`, `BASIN_SEEDS` | — | rewritten (NW-1, NW-5) |
| region ground | `*/world_*_ground.py`, `elf/world_land.py`, `water/world_water_land.py`, `wind/world_ground.py`, `a1/world_a1_ground.py` | absolute cells; noise sampled on the 192 grid | about 470 pairs | replaced by specs (NW-2, NW-3, NW-R); not a transform |
| act 1 local | `overworld.py`, `overworld_consts.py` | local cells | 63 pairs | pins relative to Cornelia (3.6.2) |
| region sites | `*/world_*_sites.py`, `*_data.py`, the 7 `town_*_site.py` | icon, door, gate, dock cells | about 110 pairs | pins at the re-fitted targets; footprints kept (NW-R) |
| progression data | `assets/data/quest.yaml` | 27 `entry: {map: overworld, x, y}`; 33 parked vehicles; 5 `nonLoadBearing` `at` cells | about 65 pairs | `at: <spot>` / `ref:` (NW-1) |
| anchors | `assets/data/world-anchors.yaml` | 24 targets, the fit bands | 24 | re-fitted (4.2) |
| verifier constants | `questLateData.ts:83-97`, `questTravelRows.ts:28`, `questGeo.ts:16-21` (`worldOffsetOf`) | numbers | 3 places | read from data (NW-1); `worldOffsetOf` removed (NW-5) |
| scenarios | `assets/data/debug-scenarios.yaml` | 43 overworld spawns by entrance; 3 `frame: a1` spawns; 38 parked vehicles absolute | 41 | spots (NW-1) |
| cutscenes | `assets/data/cutscenes.yaml:424-428` | `set_vehicle airship overworld (149, 162)` | 1 | `at: fir_s_airship` (NW-1) |
| saves | `src/systems/SaveManager.ts` (`SAVE_VERSION` 3) | `currentMap` + `playerPosition`; `vehicles [{type, map, x, y}]` | — | reset (5.3) |
| runtime frames | `MapTransition.shiftA1`, `DebugScenarioLoader` `frame: a1`, `Game.pendingFrame` | the a1 origin | — | removed (3.6.5) |
| streaming | `src/rendering/chunkStreaming.ts` | view-based caps (60, flight 36 / 16), `STREAM_MIN_CHUNKS` 64 | — | none (snow / tundra colours: 2.6) |
| Mode 7 | `WorldAtlas.atlasSize` (square, `size = width x cellPx`), `mode7Toggle.ts` (`FULL_TEXTURE` 4096, `MIN_TEXTURE` 2048), `pilotGl.ts` (`ATLAS_CELL_PX` 16) | data-driven except the pilot constant | — | re-bake at 12 px (6.1); `ATLAS_CELL_PX` read from `mode7.json` (NW-5) |
| bestiary habitats | `assets/data/bestiary.yaml`, `bestiaryHabitats.ts` | zone ids | — | none (zone ids kept) |
| encounters | `EncounterSystem`, `BattleTrigger` | zone rects in the map | — | none (regenerated) |
| tests, absolute | about 20-30 real files (3.6.5 for act 1; `quest/*/<r>_o_world` copies of the boxes; `fire/northWest`; `progression/macroGeography`, `travelMatrix`; the 192 / 3072 / 1536 literals in 16 files: Mode 7, streaming, frames) | literals | about 400 numbers | by spots; the box-copy tests rewritten against the owner grid in `tests/nw/<r>/` (NW-R) |
| synthetic maps named `overworld` | `fixtures/quest/*.yaml`, `NpcWander`, `EncounterStepFilter`, `BattleBackdrop`, `MapEntrances` | synthetic | — | none |

### 5.2 How they move (D-NW7, D-NW10)

1. **Spots (NW-1, on today's world).** A **spot** is a named overworld place with a kind:
   `spots: {<prefix>_s_<name>: {at: [x, y], kind: land | dock | landing}}` in the world source, written by the
   region modules.
   - NW-1 adds a spot for every raw overworld cell in `quest.yaml`, the scenarios and the cutscene, at today's cell.
     Spots for parked airships stand on their landing cells, spots for ships on their dock cells.
   - It rewrites the data:
     - `entry: {map, at}`;
     - vehicles `{type, at}`;
     - `nonLoadBearing` `{map, kind, ref}`, where `ref` is a dock id, a gate id or a patch id;
     - scenario spawns `spot: <name>`;
     - the cutscene's `set_vehicle` `at:`.
   - `npm run quest -- --strict` must give the same result on today's world, so one `quest.yaml` serves both.
   - **Every change NW-1 makes for spots** (momus R3-3):

     | Layer | File | Change | Test |
     |---|---|---|---|
     | region output | `layouts/world_api.py` (v1, today's) | `RegionOut.spots: dict[str, dict]` | `world.py` run |
     | composer | `layouts/world.py` `source()` | merges the regions' spots into the source's `spots` (ids unique, prefixed: world check 3) | `world.py`; `tests/quest/*/` site tests |
     | region modules | the 7 `world_<r>.py` and `world_a1.py` | today's cells of every quest, scenario and cutscene place as spots | `world.py` |
     | compiler | `assets-src/tools/build_hooks.py` `passthrough` | copies `spots` into the compiled map, as it copies `docks` and `world` | `build_map.py --selftest` (a spots case) |
     | map checks | `map_checks.py` | a spot lies on the map and on a cell of its kind | `map_selftest.py` |
     | types | `src/types/index.ts` `MapData` | `spots?: Record<string, {at: [number, number]; kind: 'land' \| 'dock' \| 'landing'}>` (+1 line; 424 / 442) | `tsc` |
     | map schema | `src/core/schemaValidation.ts` | `spots` shape | `tests/core/schemaValidation.test.ts` |
     | quest schema | `src/core/schemaValidationQuest.ts` | `entry.at`, vehicle `at`, `nonLoadBearing.ref`; refuses `x, y` on `overworld`; `world.frames` optional (today `:75-78` requires it); validates `world.basins` and `world.cuts` | `tests/data/questData.test.ts` |
     | quest entries | `src/progression/questSearch.ts:81-93` (stage entries and their vehicles), `questEvents.ts:152-154` (a pending stage's synthetic vehicle) | resolve `at` through the map's `spots` / docks | `tests/progression/*` and `tests/fixtures/quest/*.yaml` with `at` |
     | quest events | `src/progression/questEvents.ts:64` | `set_vehicle` with `at:` (today it needs `x` and `y`) | `tests/systems/vehicles.test.ts`, `endGame.test.ts` (their `set_vehicle` cases) |
     | scenarios | `src/systems/DebugScenarioLoader.ts` | `spot:` spawns (the field position from `map.spots` after the map loads, as `entrance` resolves today); vehicles with `at` | `tests/systems/scenarioSpawns.test.ts`, `DebugScenarioField.test.ts` |
     | runtime vehicles | `src/systems/VehicleManager.ts`, `src/scenes/exploration/FieldVehicles.ts` | a parked vehicle `{type, map, at}` is resolved to its cell when its map loads; a save always stores cells | `tests/systems/VehicleManager.test.ts`, `fieldTravel.test.ts` |
     | cutscenes | `src/scenes/exploration/ExplorationCutscenes.ts`, `src/systems/CutsceneRegistry.ts` | `set_vehicle` with `at:`; the registry accepts `map` + `at` as a place (and still drops a step with neither) | `tests/systems/CutsceneRegistry.test.ts`, `CutsceneManager.test.ts` |
     | data | `quest.yaml` (27 entries, 33 vehicles, 5 `nonLoadBearing`), `debug-scenarios.yaml` (38 vehicles, 3 spawns), `cutscenes.yaml` (1 step) | rewritten to names | `tests/data/crossFileValidation.test.ts` (every `at` / `spot` names a spot of its map) |
     | compiled world | `assets-src/maps/overworld.yaml`, `assets/maps/ai/overworld.yaml` | today's world recompiled under the lock so the compiled map carries `spots`; the chunk PNGs must come out byte-identical (spots add no art: `build_map.py --check-determinism` and a hash compare) | `tests/data/mode7Atlas.test.ts` (inputs unchanged) |
2. **The verifier on the scratch world.** NW-1 adds `--maps DIR` (the compiled maps folder) and `--anchors FILE` to
   `scripts/quest-verify.ts`. NW-R and NW-5 run `npm run quest -- --strict --maps /tmp/<agent>/nw-out --anchors
   assets-src/maps-nw/world-anchors.yaml` (momus M5, option 2).
3. **In the new world** every spot is a pin of its region. A spot keeps its name, its kind (land, dock, landing) and
   a **reason**; NW-R places it in the right place for its stage (e.g. a stage's entry on the shore it starts from).
4. **Tests** use `spot(map, name)` (`tests/helpers/worldSpots.ts`). A test literal with no spot gets one, or is
   rewritten against a record (a dock, a gate, a patch, a zone). **Appendix A** lists every remaining literal;
   NW-5 does not merge until it is empty or each hit is marked synthetic.

### 5.3 Saves: reset to Cornelia (D-NW8)

- **When.**
  - `SAVE_VERSION` becomes 4. A save of version 1, 2 or 3 is a pre-NW save.
  - `SaveManager.load(slot)` stays synchronous and loads no map and no `quest.yaml`. On a pre-NW save it calls the
    pure function `resetSave(data)` (`src/systems/worldReset.ts`, under 120 lines, no I/O) and returns the result
    with `reset: true` on the `LoadedSave`.
  - `LoadScene` (today `:108` sets `game.pendingEntrance = null`) sets `game.pendingEntrance = 'cornelia'` when
    `reset` is true. This is the pattern `DebugScenarioLoader.ts:110` uses: `ExplorationScene.enter` (`:177`)
    resolves the entrance once the map is loaded.
  - The save on disk is rewritten only when the player saves again.
- **Which saves are moved.** A pre-NW save is moved to Cornelia when either:
  - its `currentMap` is `overworld`; or
  - it owns a ship or an airship (`BIKKE_DEFEATED` or `AIRSHIP_RAISED` set), wherever it is. A party saved in
    Melmond with its ship at Melmond's dock would otherwise walk out to a ship that is now at Pravoka.
  - A pre-NW save that owns neither and is inside another map keeps its `currentMap` and `playerPosition`. Before the
    ship, every map is act 1's, and its exits name overworld entrances that prewalk S0-S2 proves walkable.
- **What a moved save gets:**
  - `currentMap = 'overworld'` and `pendingEntrance = 'cornelia'` (Cornelia's south-gate arrival); `playerPosition`
    is ignored;
  - `mode = 'walking'`, facing south; any boarded vehicle cleared;
  - `location` set to "Cornelia".
- **Vehicles in every pre-NW save** (moved or not): every `vehicles[]` entry with `map: 'overworld'` is removed, and
  `resetVehicles(flags)` is added. It is keyed only to milestone flags the runtime holds, with no stage order:

  | Flag held | Vehicle | Spot (pinned in the new world) | Why there |
  |---|---|---|---|
  | `BIKKE_DEFEATED` (S2's grant, with the ship) | ship | the `a1_pravoka` dock | on the Aldi, walkable from Cornelia over the bridge (BRIDGE_BUILT precedes it); the canal takes it out once `CANAL_OPEN` is held |
  | `AIRSHIP_RAISED` | airship | `a1_s_airship`, a `landing` spot on grass within 12 steps of Cornelia's gate (NW-3 pins it) | everything the airship reaches is reachable from there |
  | `CANOE_GIVEN` | — | the canoe is an ability (item `canoe`), not a parked vehicle | nothing to place |

  - The two spots are constants in `worldReset.ts` (`RESET_SPOTS`), as names; `VehicleManager` resolves them when the
    overworld loads (5.2).
  - `tests/systems/worldReset.test.ts` (**new**) asserts that the flags in `RESET_SPOTS` are exactly the vehicle
    grants' flags in `quest.yaml` (the ship's and the airship's), so a renamed flag fails.
- **Kept:** flags, party, inventory (the canoe item included), gold, play time, `boosts`, and every other field.
- **The notice.** On the first field frame after a reset, one message line: "The world has changed. You stand
  before Cornelia." It shows once, through `DialogManager`.
- **Removed with it:** the v1 `frame: 'a1'` path (`shiftA1`, `Game.pendingFrame`); v1 saves take the reset like v2
  and v3.
- **No soft-lock from a reset (proof (c) from every reset state).**
  - New verifier option `--from-reset` (`src/progression/questReset.ts`, under 120 lines; it imports
    `resetVehicles` from `src/systems/worldReset.ts`, the same code the game runs).
  - For every stage S in S0-S31, the **reset state of S** is S's stage-entry state (the grants of S's `after` closure,
    as `--stage` builds it), with the party at `cornelia` on foot and the vehicles of `resetVehicles(flags)`.
  - From each reset state it runs the search with proof (c): the goal is reachable, and no reachable state is a
    SOFTLOCK, STRANDED or DEADGATE.
  - It runs in NW-5 and NW-INT, in the background with `--strict`.
  - `tests/progression/resetStates.test.ts` (**new**, fast tier) runs the cheap part on the real data: from each
    reset state, the next stage's required entrances (3.8) are reachable with the stage's vehicles.
- **Tests** (`tests/systems/saveWorldReset.test.ts`, **new**):
  1. a v3 save on foot on the world map, no vehicle: Cornelia;
  2. a v3 save in the ship on the Aldi: Cornelia on foot, the ship at the `a1_pravoka` dock;
  3. a v3 save in Melmond with the ship at Melmond's dock: Cornelia, the ship at `a1_pravoka`;
  4. a v3 save with the airship parked in the north: Cornelia, the airship at `a1_s_airship`, the ship at
     `a1_pravoka`;
  5. a v3 save inside the castle before the ship: the same map and position, no vehicle;
  6. a v1 overworld save: Cornelia;
  7. a v4 save: untouched;
  8. in every case, flags, party, items and gold equal before and after.

## 6. Mode 7

### 6.1 The atlas at 256 cells

| Option | Full atlas | Low atlas | GPU (full, with mips) | Fits `mode7Toggle` (`FULL_TEXTURE` 4096) | Downsample |
|---|---|---|---|---|---|
| 16 px (today's constant) | 4096² | 2048² | 89.5 MB (+39 MB); flight about 214 MB, about 281 MB while composing | exactly at the limit; many integrated GPUs fall to `low` | 3x3 |
| **12 px (recommended, Q7)** | **3072²** | **1536² at 6 px** | **50.3 MB, unchanged; flight 175.0 MB as today** | **yes** | **4x4 / 8x8, integral** |

- **The bake (NW-1).** `mode7_atlas.py` derives `CELL_PX = 3072 // W` and `LOW_CELL_PX = CELL_PX // 2`, and refuses a
  non-integral box (`SRC_PX % CELL_PX != 0`).
  - For 192 that gives 16 / 8, byte-identical to today: `mode7Atlas.test.ts` stays green on `mainline`.
  - For 256 it gives 12 / 6.
  - Every scratch compile from NW-2 on bakes 3072²; NW-0's pilot compile, before NW-1, bakes 4096² (G-NW8 records
    both).
  - `mode7.json` already records `cellPx`, and `WorldAtlas.atlasSize` checks `size = width x cellPx`, so neither
    needs a change.
  - `mode7_atlas.py` is not touched by M7-5 or M7-6.
- **`pilotGl.ts` `ATLAS_CELL_PX`** (16, dev pilot only): **NW-5** makes it read `mode7.json`'s `cellPx`.
- **The look.** The far mesh starts at `D_SPLIT` 25 cells, where it was magnified at most 3x; now at most 4x. Beyond
  about 35 cells it is under 2x, and about 1:1 at the horizon. If the user sees the blur line, `D_SPLIT` goes to 28:
  the near window allows it, since 24-cell margins either side of the ship need 20.6. This is a tuning value, owned
  by NW-INT.
- **The tests** that pin 3072 / 1536 / 192 (`worldAtlas`, `nearDetail`, `mode7Math`, `mode7Parity`, `mode7Tilt`,
  `streamWindow`, `bakedStreaming`, `mode7Atlas`) read the sizes from the map and `mode7.json` after NW-5. The pure
  math tests keep their own synthetic 192 maps.

### 6.2 Ordering with the Mode 7 tranches

- **M7-4** has merged (`065a6474`).
- **M7-5** (billboards, clouds) and **M7-6** (fallbacks) start now, in parallel with NW-0 to NW-R. They touch
  `src/scenes/exploration/mode7/` and `chunkStreaming.ts`. Before NW-5, NW touches Python, data, the verifier CLI,
  the schema and `tests/nw/`, so no file is shared.
  - The one overlap is NW-1's `mode7_atlas.py` change, which M7-5 and M7-6 do not touch.
  - If M7-5 or M7-6 needs `mode7_atlas.py`, it tells the NW integrator, and the later merge rebases.
- **M7-INT** merges before NW-5 starts. NW-5 then owns the re-bake, `pilotGl.ATLAS_CELL_PX`, the snow / tundra runtime
  rows of 2.6 (including `chunkStreaming.ts` colours and the landing marker) and the Mode 7 test sizes. If M7-INT
  slips, NW-5 waits.
- **M7-8** (landmark billboards, optional) and **M7-7** (quarter turns, not scheduled) come after NW-INT. M7-8 bakes
  billboard cuts from the world's tall decos, so it should be built on the new world.

## 7. Tranches

- **Branches.** Each tranche is a branch from `mainline`, mergeable on its own. `mainline` plays today's world until
  NW-5.
- **Tests.** Agents run `npm run test:fast`; the NW integrator runs `npm run test:full`. One world compile runs at a
  time (the lock; the budget of 3.4).
- **Review output** goes to `~/temp/ff-game/worldplan/<tranche>/`.
- **`tests/nw/`** holds the new world's tests until NW-5. They read **committed sources only**:
  `assets-src/maps-nw/overworld.yaml` (`ground`, entrances, spots, zones, docks, patches, `regions`), its
  `world-anchors.yaml` and the data files. They never read a compiled chunk or a scratch folder, and they run in the
  fast tier. NW-5 moves them into `tests/` and points the ones that need collision at the compiled map.

| Tranche | Owner | Content | Gates | Depends on | Effort |
|---|---|---|---|---|---|
| **NW-0 Pilot** | a generator agent | Offline only; nothing committed but the result note. A scratch generator in `/tmp/<agent>/nw/` (the concept sketch grown to 3.1's stages, with the flood, hydrology, climate, corridors and gates), act 1 included and pinned by 3.6.2's rule, sites from the anchors. Outputs, for 3 presets (A calm, B classic, C rugged): (1) a flat-colour map at 4 px per cell with sites and the chunk grid; (2) the same beside the classic reference and `now.png`; (3) one full scratch compile of preset B (`build_map.py overworld --src-dir <scratch> --out <scratch>`, under the lock, with today's 16 px bake), a 0.15 overview and four 1x crops (Cornelia's peninsula and the bridge, Onrac's river, the volcanic arc, the isthmus); (4) the 0.1.1 metrics and the act-1 walk table | the user picks a preset and approves the arrangement and act 1's look (G-NW9); measured: generation time, compile peak (G-NW8, 16 px bake) and time | none | 12 h |
| NW-1 Contract and spots | NW integrator | `world_api.py` v2 beside v1 (3.2; `G2_MIN` from the pilot); `worldgen/spec.py`, `noise.py`; spots on today's world and the `at:` / `ref:` rewrite of `quest.yaml`, the scenarios and the cutscene, with the schema (5.2); the verifier's `--maps`, `--anchors`, `--worst-canoe`; `questLateData` / `questTravelRows` read data; the re-fitted `assets-src/maps-nw/world-anchors.yaml` and the 31-pair table (4.2); the size-derived `CELL_PX` (6.1); **every spot change of 5.2** (the table: region output, composer, `passthrough`, map checks, `MapData`, both schemas, the quest entries, `questEvents`, `DebugScenarioLoader` `spot:`, `VehicleManager` / `FieldVehicles` `at`, `ExplorationCutscenes` / `CutsceneRegistry`, the data rewrite) and **today's world recompiled** with spots (chunks byte-identical) | `npm run quest -- --strict` unchanged on today's world; `mode7Atlas.test.ts` unchanged; `test:fast` | NW-0 | 11 h |
| NW-2 Generator | generator agent | `worldgen/` shape, relief, hydro (corridors, fords), climate, roads, owners, metrics, selftests (3.2); the Python side of snow and tundra (2.6); the composer v2 writing `assets-src/maps-nw/overworld.yaml` from the 7 region specs (a first cut from the pilot), with every site and spot as a pin: a complete but rough world | `worldgen/selftest.py` and `selftest_gates.py` OK; G-NW1-3; determinism (G-NW5); a full scratch compile with the 12 px bake (G-NW8) | NW-1 | 16 h |
| NW-3 Act 1 | A1 agent | `a1/world_a1_pins.py` (derived by script from today's source), `world_a1_checks.py`, the A1 spec (peninsula, spine, mainland, Pravoka's range); `tests/nw/a1/` (`a1Pins`, `a1Walks`, the rewritten act-1 tests of 3.6.5 against the source) | 3.6.3's checks; the walks within ±10 %; an image review of act 1 at 1x | NW-2 | 9 h |
| NW-4 Gates | NW integrator | `worldgen/gates.py`, `prewalk.py`: walls, the canal pass, barriers on foot and by canoe, routes, north, landings, straits, prewalk (3.8); `world_checks` on the owner grid; `regions.<r>.raster`, `--owned-chunks`; the first compiled base and the chunk-digest mode of `check_base` with its selftest (3.4) | `world.py` prints the G-NW4 lines; the verifier `--strict --maps` on the base | NW-2 | 11 h |
| NW-R x6 Regions | one agent per region: ELF, EARTH, FIRE, ORDEAL, WATER, WIND | the region's spec tuned (coast, ridges, corridors, climate hints, islands), its pins and spots at the targets and for their stages, its zones (same ids), barriers, backdrops (snow and tundra for WATER, WIND, ORDEAL), dressing; its design note; its `<r>_o_world` test rewritten against the owner grid in `tests/nw/<r>/` | per-region metrics; `--region <r>` over the base and an image review; `npm run quest -- --strict --stage <S> --maps` for its stages; `test:fast` | NW-3, NW-4 | 7 h each, 42 h |
| NW-5 Cutover and balance | NW integrator | (1) `assets-src/maps-nw/` replaces `assets-src/maps/overworld.yaml` and `world-anchors.yaml`; v1 of `world_api` and the retired act-1 files deleted (3.6.1); (2) the full compile and the 12 px bake; (3) the runtime side of snow and tundra (2.6), `pilotGl`; (4) the frame removal (3.6.5), `worldOffsetOf`; (5) save v4, the reset, `--from-reset` and `resetStates.test.ts` (5.3); (6) `tests/nw/` into `tests/`, the act-1 and box-copy tests replaced, Appendix A cleared; (7) **balance** (former NW-6): the step-mean scaling per stage from both worlds' witnesses, then `questCurve`, `fieldCampaign`, `fieldPacing` and `zones` re-measured; (8) AGENTS.md "The world (pass W)" rewritten as "The world (pass NW)" | `npm run build`; `npm run test:full` (balance included); `npm run quest -- --strict`; `--mutate` started in the background; the 8 save cases; `--from-reset` passes for S0-S31; Appendix A empty (G-NW10) | NW-R (all), M7-INT | 19 h |
| NW-INT | NW integrator | the `--strict --mutate` result; browser checkpoints with `&mute=1` (act 1's opening walk, the bridge, the ship round the Aldi, the canal, the canoe to Gurgu, an airship landing on tundra at Onrac, a refusal on snow, a Mode 7 flight over the north); a v3 save reset by hand; the final overview beside the classic; `docs/PROGRESS.md`; STATUS item 3 (organic coastlines) closed | all of 0.1; the user's review of the overview and a play session (G-NW9) | NW-5 | 5 h |

- **Totals.** 13 tranches: NW-0, NW-1, NW-2, NW-3, NW-4, the six NW-R, NW-5 and NW-INT. About **125 h** of work
  (12 + 11 + 16 + 9 + 11 + 6 x 7 + 19 + 5).
- **Critical path:** NW-0 (12) → the user's review → NW-1 (11) → NW-2 (16) → NW-3 and NW-4 in parallel (11) → NW-R
  in parallel (7 if all 6 run at once, which needs M7-5 and M7-6 merged; 14 with at most 4 at a time) → NW-5 (19) →
  NW-INT (5). That is **about 81-88 h** of wall clock, plus the user's two reviews.
- **Merge order:** NW-1, NW-2, then NW-3 and NW-4 in either order (the second rebases), then the NW-R tranches in
  any order (each re-runs `world.py`; the integrator refreshes the base after each), then NW-5 and NW-INT.
- **Owners:** the NW integrator owns NW-1, NW-4, NW-5, NW-INT, every merge and the shared constants.

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The generated rivers or lakes open a canoe skip across a barrier | the barrier check runs by canoe too (3.8); the worst-case matrix run (4.3); the former GT-38 as a selftest |
| R2 | A river cuts a pre-canoe walk (momus M1) | corridors with fords (2.4 rule 4b); `prewalk` (3.8) |
| R3 | A generated coast or strait breaks a sea lane or leaks the Aldi | wall lines are forced land; the straits check (3 cells); basins on every compose |
| R4 | The look is still "generated" (blobby continents, uniform noise) | the pilot with 3 presets and the user's pick; the per-continent knobs; G-NW2 |
| R5 | Act 1 loses its feel when regenerated | its outline is today's polygon; its pins sit at today's relative cells; the walk table within ±10 %; the user reviews act 1 in NW-0 and NW-3 |
| R6 | The full compile at 256² exceeds 26 GB | measured in NW-0 (16 px bake) and NW-2 (12 px); fallback: quadrant `--region` compiles under the lock |
| R7 | Longer walks shift every level band and price wall | the ±10 % fight rule and the step-mean scaling, applied in NW-5 itself; no formula change |
| R8 | The spot rewrite in NW-1 changes today's verifier result | the gate is "unchanged on today's world"; the spots are at today's cells |
| R9 | NW-R agents fight over shared chunks or a stale base | the world source is regenerated, never merged; nothing compiled is committed before NW-5; the base is keyed by the source hash (3.4) |
| R10 | A 12 px far atlas shows a blur line at the split | `D_SPLIT` tuning (6.1); the Mode 7 checkpoint in NW-INT |
| R11 | M7-5 / M7-6 / M7-INT slip and block NW-5 | NW-0 to NW-R do not depend on them; NW-5 waits rather than rebasing over half-merged Mode 7 code |
| R12 | A reset save surprises the player, or soft-locks it | the one-line notice; flags, party, items and gold kept; the vehicles at milestone spots by Cornelia; proof (c) from every stage's reset state (`--from-reset`, 5.3); 8 test cases |
| R13 | (g) fails on pravoka-matoya (0.73 vs 0.70) | the full table in NW-1; an exemption with its bearing still checked, if needed (4.2) |
| R14 | The generator grows past 250 lines per file | the file plan of 3.2; `questCeilings.test.ts` extended |
| R15 | **Walking detours** exceed their bands (2.5 default, melmond-sarda 3.0, dwarf-melmond 4.5) because ridges, rivers and fords lengthen the generated walks | the corridors bound the pre-canoe walks; `world.py --metrics` prints each detour hop's factor at compose time; a region tranche fails its gate when a hop of its region exceeds its band; a corridor may be straightened by moving a ford or a pass, never by widening the band |
| R16 | A natural world loses the classic's "puzzle" feel (the gated rings, the isthmus) | every gate is a named feature in a continent spec (4.1), reviewed by region in NW-R |
| R17 | dead frame code (`worldOffsetOf` shifts only a 72x72 map) lingers and confuses later readers | removed in NW-5 with the frame (3.6.5); `macroGeography.test.ts:105` reads entrances; Appendix A's grep 1 |

## 9. Open questions for the user (each has a default)

| # | Question | Status / default |
|---|---|---|
| Q1 | Act 1: keep its interior or regenerate it? | **closed 2026-11-20: regenerate act 1 too (D-NW3)** |
| Q2 | Size? | **closed 2026-11-20: 256x256 (D-NW1)** |
| Q3 | How close to the classic arrangement: (a) the same continents and relative positions with original coasts (today's rule), or (b) the same plus closer outlines (the Citadel arc, Lufenia's long tail, the river maze of the south-east)? | open; default (a), with the shape language of (b) where a gate needs it |
| Q4 | Old saves? | **closed 2026-11-20: reset to Cornelia (D-NW8, 5.3)** |
| Q5 | Coast roughness preset (from the pilot's A / B / C)? | open; default B |
| Q6 | Snow and tundra; landing on snow? | **closed 2026-11-20: both added; the airship lands on tundra only (D-NW9, 2.6)** |
| Q7 | Mode 7: the 12 px far atlas (same memory, a little softer far away), or 16 px at 4096² (sharper, +39 MB, more machines fall to `low`)? | open; default 12 px |
| Q8 | Balance: keep the fight count per stage (scale the step means), or let the bigger world mean more grinding? | open; default keep the count (±10 %) |
| Q9 | More islands: a second archipelago only for the look, or must every island hold something? | open; default the look only, with airship-landable grass on the larger ones |

## 10. TODOs

```markdown
## TODOs
- [x] Diagnose the boxy world from the code and measure it (1.1, 1.2) (2026-11-20)
- [x] Render now.png, the concept sketch and the side-by-side in ~/temp/ff-game/worldplan/ (2026-11-20)
- [x] Inventory every world-coordinate consumer (5.1, Appendix A) (2026-11-20)
- [x] Rev 2: user rulings Q1, Q2, Q4, Q6; momus M1-M10; suggestions (2026-11-20)
- [x] Rev 3: momus R3-1 to R3-6 and suggestions (2026-11-20)
- [ ] User answers Q3, Q5 (at the pilot), Q7, Q8, Q9 (priority: medium, effort: 0.5h)
- [ ] NW-0 pilot images and the user's pick (priority: high, effort: 12h)
- [ ] NW-1 contract and spots, with today's world recompiled (priority: high, effort: 11h)
- [ ] NW-2 generator (priority: high, effort: 16h)
- [ ] NW-3 act 1 regenerated and re-pinned (priority: high, effort: 9h)
- [ ] NW-4 gates, checks, the chunk-digest `check_base` and the compiled base (priority: high, effort: 11h)
- [ ] NW-R ELF / EARTH / FIRE / ORDEAL / WATER / WIND (priority: medium, effort: 42h)
- [ ] M7-5, M7-6, M7-INT merged before NW-5 (priority: medium, effort: external)
- [ ] NW-5 cutover and balance, the save reset and `--from-reset` (priority: high, effort: 19h)
- [ ] NW-INT and the user's play session (priority: high, effort: 5h)
```

## Appendix A. Coordinate-inventory checklist (gates NW-5, G-NW10)

Run from the repo root on the NW-5 branch before its merge. Each command's output must be empty, or every hit must
be marked in the NW-5 result as synthetic (a test map named `overworld` that is not the world) or as a spot-based
read.

```bash
# 1. the act-1 frame and the old world contract
rg -n "A1_ORIGIN|A1_SIZE|FROZEN_CORE|FROZEN_EXCEPTIONS|PRAVOKA_ICON_CELLS|frames\??\.a1|frame: ?'?a1|shiftA1|pendingFrame|a1At|translateA1|worldOffsetOf" src tests assets assets-src scripts
# 2. the region boxes, bands and seams
rg -n "\bBOXES\b|\bSEAMS\b|PLACEHOLDER_WALLS|\bEDGE\b" assets-src/tools tests
# 3. world size and atlas literals
rg -n "\b192\b|\b3072\b|\b1536\b|WORLD_SIZE" src tests --glob '!**/fixtures/**'
# 4. raw overworld cells in data (the schema refuses them after NW-1; this is the belt and braces)
rg -n -B2 -A2 "map: overworld" assets/data | rg -n "\bx: [0-9]+|\bat: \[[0-9]"
# 5. raw world cells in the world tests
rg -n "\[\s*[0-9]{2,3}\s*,\s*[0-9]{2,3}\s*\]" tests/quest tests/data tests/systems tests/scenes tests/progression tests/balance
# 6. the basin seeds outside the map data
rg -n "BASIN_SEEDS" src assets-src
```

Expected after NW-5:
- 1, 2 and 6: no hits except `BASIN_SEEDS` in `world_api.py` and the composer.
- 3: only the pure math tests' synthetic maps.
- 4: none.
- 5: only synthetic fixtures, each listed in the NW-5 result.

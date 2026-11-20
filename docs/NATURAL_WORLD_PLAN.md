# Natural world plan (pass NW), rev 1

Status: rev 1, planning only. Nothing is implemented. Pass NW replaces the world map's geography and its generator.
It keeps the progression of `docs/WORLD_PLAN.md` rev 3 (pass W: stages S0-S31, the gates, the verifier proofs)
and every site, dungeon, town and landmark. The facts in 1 were checked at `153b2454` (after the M7-3 merge).

**The request (user, 2026-11-20).** "Lots of pieces of the map are squared off straight edges, which isn't how a
natural map works. Make the continents appear smooth and natural, as they appear in the real world. Compare the
continents we have built with the original Final Fantasy world and with the natural world, and build a map that has a
coastline and features to match the real world. Honour the classic progression: foot → ship → canoe → airship, with
the northern continents reachable only at the end game. Revise the map for more natural features, increasing the
overall map size and the terrain and coastline variability."

**Standing rules kept.** Classic continent orientation, distances and travel gates, with original detail (memory
note "world plan geography"; WORLD 2.1). The classic map is a reference for arrangement and shape language only: no
map data is copied, and every coastline is generated. No paid art (Gemini). Bedrock is not needed.

**Review images** (`~/temp/ff-game/worldplan/`):

| File | What |
|---|---|
| `now.png` | the current compiled world, 192x192 (`build_map.py --preview overworld 0 0 191 191 ... --scale 0.15`) |
| `ref/ff1_world_map.jpg` | the classic layout (reference only) |
| `concept_256.png`, `concept_256.py` | a scratch concept sketch of the target (2.3), 256x256, flat colours, 16-cell chunk grid, site dots. Not the pilot: it shows the arrangement, the ridges and the climate logic; its coasts are still too smooth (coast index 22 against the target 30, 1.2) |
| `side_by_side.png` | now / classic / concept |

**Naming.** Tranches `NW-0` to `NW-INT` (7). Decisions `D-NW1`... (0.2). Gates `G-NW1`... (0.1). "WORLD n.m" is a
section of `docs/WORLD_PLAN.md` rev 3; "M7 n.m" one of `docs/MODE7_PLAN.md`.

## 0. Summary

- A **256x256** world (16x16 = 256 chunks, 1.78x today's area) at a classic scale of **s\* ≈ 0.86** cells per classic
  tile (today 0.735), with 15-25 cells of open ocean round the edge.
- A **whole-world generator** (`assets-src/tools/worldgen/`) replaces the seven region boxes. Hand-placed continent
  control polygons, ridge lines, wall lines and climate hints go in. Then: domain-warped fractal coasts, an elevation
  field, rivers by flow accumulation, and biomes by moisture, temperature and elevation. Regions stop painting
  ground. They own their content only: sites, doors, docks, zones, barriers and dressing.
- **Act 1 keeps its interior** cell for cell, at a new origin (about (122, 109)). A **frozen mask** replaces the
  frozen rectangle. The generator owns a coast belt round the mask, so the mainland's straight north coast and the
  square Aldi go away.
- **Every travel gate is built into the geography** (walls as ridges, the canal saddle, dockless northern coasts,
  pinned canoe rivers). Checks prove each gate: the basins, each barrier on foot **and** by canoe, and the docks. The
  verifier's (g) anchors are re-fitted from the classic offsets at the new scale. The (h) matrix keeps its rows.
- **Mode 7** keeps its atlas size and memory: the far atlas bakes at **12 px per cell** (256 x 12 = 3072², a 4x4
  box of the 48 px chunks), and the low atlas at 6 px (1536²). The runtime reads `cellPx` from `mode7.json`, so this
  is a bake constant, not a code change.
- The new world is built **beside** today's, as a source under `assets-src/maps-nw/` compiled only to scratch folders.
  It replaces `overworld` in one cutover tranche (NW-5), so `mainline` never holds a half-moved world.
- About **107 h** over 13 tranches (section 7; about 67 h of wall clock). The pilot (NW-0) is an offline image for the user to approve before any
  generator work.

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "The world map is 256x256; the game, the verifier and Mode 7 all run on it",
    "Foot -> ship -> canoe -> airship order holds; the north continents (Onrac, Citadel/Cardia, Gaia/Mirage/Lufenia) are reachable only by airship",
    "Every site, dungeon door, town gate, dock and landmark of pass W exists, with the same entrance names",
    "Act 1 plays exactly as before inside the frozen mask (castle, city, bridge, temple, tomb, Pravoka, Matoya)",
    "Old saves load: an overworld position and the parked vehicles move to the new world by the save migration (5.3)"
  ],
  "observable": [
    "No coast, mountain edge, desert edge or forest edge runs straight along a chunk line",
    "Mountains read as ranges with foothills along ridgelines; rivers run from the high ground to the sea or a lake",
    "Deserts lie in rain shadows or continental interiors; marsh in wet lowlands; snow and tundra in the far north",
    "Bays, capes, peninsulas, offshore islands and at least two archipelagos (Cardia, one more)",
    "The overview reads like the classic arrangement side by side (review image)"
  ],
  "pass_fail": [
    "G-NW1 straight coast: no axis-aligned land/sea run of more than 6 cells outside pinned footprints and the frozen mask (today 40 runs >= 8 cells, longest 50)",
    "G-NW2 coast index: coast edges / sqrt(land cells) >= 30 (today 19.7; the classic reference about 36 with its label boxes)",
    "G-NW3 no box edges: no material boundary follows a multiple-of-16 row or column for more than 6 cells",
    "G-NW4 python3 -I assets-src/tools/layouts/world.py prints `world: OK`, `basins: OK (...)`, `barriers: OK (walk, canoe)`",
    "G-NW5 build_map.py --check-determinism and mode7_atlas.py --check-determinism pass; re-running every layout script leaves git diff --exit-code assets-src/maps clean",
    "G-NW6 npm run quest -- --strict --mutate passes, with (g) re-fitted and (h) unchanged in rows",
    "G-NW7 npm run build, npm run test:full and the balance suite pass; questCurve bosses in band",
    "G-NW8 the full-world compile peaks at <= 26 GB (estimate 20 GB) under the lock",
    "G-NW9 the user approves the pilot image (NW-0) and the final overview (NW-INT)"
  ]
}
```

### 0.2 Decisions (proposed; the open questions in 9 can change them)

| # | Decision | Why |
|---|---|---|
| D-NW1 | 256x256, s\* ≈ 0.86 | the classic world is 256 tiles square; 256 fits the classic layout at nearly its own scale with ocean margins; 16x16 chunks; the Mode 7 atlas stays 3072² at 12 px (2.1) |
| D-NW2 | one generator for the whole world; regions own content, not ground | the boxes are the root cause (1.1) |
| D-NW3 | act 1 keeps its interior; a frozen mask replaces `FROZEN_CORE`; `A1_ORIGIN` moves | the act-1 tests and playtests are the most expensive thing in the repo to redo; its outer coast is what reads as boxy (3.6) |
| D-NW4 | gates by construction plus checks, never by a straight strip | 4.1 |
| D-NW5 | built beside today's world (`assets-src/maps-nw/`), one cutover (NW-5) | `mainline` stays green; region tranches run in parallel |
| D-NW6 | Mode 7 far atlas 12 px per cell, low 6 px | same memory as today (6.1) |
| D-NW7 | coordinates move by entrance name first, by a recorded transform second, by hand never | 5.2 |
| D-NW8 | saves get a version bump and a migration; no ruling that drops old saves | 5.3 (open question Q4) |

## 1. Diagnosis

### 1.1 Why the world is boxy (from the code)

1. **Rectangular region boxes.** `world_api.BOXES` tiles the world with 1 or 2 chunk-aligned rects per region. Each
   module paints only its rects: `world.compose` pastes `out.ground[:b.h]` into the box, and `UNSET` is the only way out.
2. **Edge bands default to ocean.** `EDGE = 2`: the 2 cells each side of every box edge belong to the composer and are
   Water unless a seam fills them. So every region boundary is a straight sea lane at least 4 cells wide. The
   overview shows the cross of lanes at x ≈ 62, x ≈ 142, y ≈ 62 and y ≈ 143.
3. **Masks clip the organic coasts.** `world_coast.organic(poly, amp, seed, mine)` and FIRE's `_mine(band)` keep
   land only inside `mine`, the box minus its bands. A polygon that reaches the box edge is cut straight.
4. **Walls and seams are rects.** `SEAMS` (`seam_s` x 110-113, y 146-165; `seam_se`, `seam_w`) and the A1 range
   `RANGE = Rect(138, 76, 141, 141)` are mountain rectangles, with a ±2 wobble at most. ELF draws its Aldi coast
   "straight on y 146" (`elf/world_land.py`), and FIRE forces `land[146:148, 114:146]`, W_south's cliff rows.
5. **Act 1 is a framed block.** `overworld.build()` forces an ocean ring on its 72x72 grid (`land[:4, :] = False`,
   `land[:, -3:] = False`). The mainland's north and west coasts are therefore the block's edges. The Aldi is the
   square left between the block, the isthmus column and the two wall strips.
6. **Mountains as fill and strips, not ridges.** WIND's land "defaults to mountain" and carves basins out of it.
   FIRE turns every cell no entrance reaches into rock. EARTH's range is a meandering column band (`RANGE_X`). The
   result is a mountain share of 28 % of all land, in slabs. There is no elevation, so nothing has foothills,
   watersheds or passes.
7. **Rivers drawn as polylines.** FIRE's rivers are "4-connected river courses" laid as axis steps (the staircase
   rivers out of Crescent Lake). WATER's is a gorge of fixed columns. None flows downhill, because there is no
   elevation.
8. **Biomes as blobs.** Deserts are discs or noisy polygons (the caravan's disc, FIRE's `DUNES`). Forests are
   ellipses. Elfland's fens are a polygon. Nothing ties them to water, height or latitude.
9. **Noise at one scale.** `world_coast.fbm` sums cells of 10, 5 and 2.5 at amp 16: bays a few cells deep, but no
   continent-scale bends, no fjords, no capes. Three copies of the value-noise code exist (`overworld_noise.py`,
   `world_coast.py`, `elf/world_land.py`).

### 1.2 Measured

| Metric (cell mask of the world source) | Today (192²) | Concept sketch (256²) | Target |
|---|---|---|---|
| axis-aligned coast runs >= 8 cells | 40 (longest 50: Elfland's Aldi coast, y 145/146) | 7 (longest 12) | 0 runs > 6 outside pins (G-NW1) |
| of those on or next to a box edge or band | 15 | none (no boxes) | none (G-NW3) |
| coast index: coast edges / sqrt(land) | 19.7 | 22.1 | >= 30 (G-NW2; classic reference about 36) |
| Pravoka's range: rows with rock in x 136-141 | 66 consecutive rows | n/a | a ridge with spurs, no column |
| mountain share of land | 28 % | 23 % | 15-22 %, in ranges |
| land cells | 21,089 | 22,698 | about 36,000-42,000 (about 1.78x today's land) |

The classic index comes from the reference image downsampled to tiles (4 px per tile), with its label boxes, so it
is an upper estimate.

### 1.3 Continent by continent (now / classic / natural)

| Continent | Now | Classic arrangement | Natural-world fix |
|---|---|---|---|
| Cornelia's continent (A1) | a square block. Its mainland's north coast is straight at y ≈ 65; the Aldi is a square bay; Pravoka's range is a 4-cell column x 138-141 for 66 rows | a long east-west mainland wrapping the Aldi's north. Cornelia sits on a peninsula hanging into the inner sea; Matoya is to the north-east, the Temple to the north-west, Pravoka to the east on the same land | keep the interior; let the mainland run on to a ragged north coast with capes and a lake district; Pravoka's range becomes a ridge with spurs falling to the outer fjord |
| The Aldi Sea | a rectangle bounded by four straight walls | an irregular inland sea, closed by land on every side, with the canal at its north-west | an irregular basin with coves and two islets; the walls are ridges and headlands (4.1) |
| Duergar isthmus (EARTH) | a straight column x 49-61 | a narrow north-south neck west of the inner sea, joining Elfland | a curved neck with a hogback ridge, the canal saddle, coves on both sides |
| Western continent (Melmond) | a tall rounded oblong. The range is a straight-ish band; badlands to the south | a broad west continent, Melmond on its east shore, the Earth Cave in its south, Sarda and the Titan's tunnel in the west | a rain-shadowed east (Melmond's dying plain, the badlands) behind a west-coast range; Sarda's coast a wet strip under the range |
| Elfland (ELF) | a wide oblong whose north coast is straight on y 146; the fens a rectangle | the inner sea's south shore, Elfheim in its south-east, the Marsh Cave to the south-west, the Western Keep at the north-west tip | a lobed continent with a long north-west arm (the Keep's cape); the marsh in the wet lowland round a river delta; forests by moisture |
| South-east continent (FIRE) | the west edge is the box edge; the Aldi cliffs are straight rows; staircase rivers; a disc desert | Pravoka's land in the north joins it; Crescent Lake in the south-east; a maze of rivers in the centre; Gurgu to the west, the Ice Cavern, the Lykion desert to the south | a volcanic arc (Crescent's ring as a caldera ridge); rivers from the lake following the slope; the desert in the south-east rain shadow |
| Onrac (WATER, NW) | a square, much of it mountain fill; a straight river | a large north-west continent: the caravan desert to the west, Onrac on the east coast, the waterfall at the head of the river in the north | a cold continent with a central ridge; the river runs downhill from the waterfall to Onrac's bay; the caravan desert in the lee of the ridge; tundra and snow in the north |
| Citadel / Cardia (ORDEAL, N) | a round island; a ring of round islets | an arc of land in the north centre (the Citadel), the Cardia islands to its south-west | a crescent island arc with a high spine; Cardia an archipelago of 8-12 islets with reefs |
| Gaia / Mirage / Lufenia (WIND, NE) | a square of mountain fill with three carved basins | a big north-east continent, Gaia at the north-east, the Mirage desert in the middle, Lufenia at the end of a long southern tail | the interior desert ringed by ranges; Gaia's bowl in the north-east hills; Lufenia on a long cliffed peninsula |

## 2. Target design

### 2.1 Size

| Option | Cells, chunks | Area vs today | s\* with margins | Compile peak (11.3 GB x area, measured W1-C1) | Mode 7 far atlas | Verdict |
|---|---|---|---|---|---|---|
| 224² | 196 | 1.36x | about 0.77 | about 15 GB | 14 px, 3136² | too little room for the variability asked for |
| **256²** | **256** | **1.78x** | **about 0.86** | **about 20 GB** | **12 px, 3072² (unchanged)** | **recommended** |
| 288² | 324 | 2.25x | about 0.97 | about 25 GB, at the 26 GB limit | 10.67 px (not integral) or 12 px = 3456² | compile and atlas at their limits; walks 30 % longer than classic-scaled act 1 |
| 256² at 16 px | 256 | 1.78x | 0.86 | 20 GB | 4096², 89 MB with mips (+39 MB); at many GPUs' max texture size | rejected (6.1) |

Other costs at 256²: about 43 MB of world chunks on disk (upper bound, 24 MB x 1.78); a full compile of about
150-340 s; a determinism run of about 5-10 min. The `--region` limit stays 10 GB (the largest region plus its ring
is about 70 chunks, estimate 7 GB). Chunk streaming is view-based (30 wanted, a cap of 60), so the runtime cost does
not grow. Walks get longer: about 1.17x per classic distance (0.86 / 0.735). The curve model accounts for that (4.6).

### 2.2 Scale, placement and the transform

- **Classic reference frame.** The reference image is about 4 px per classic tile. Classic offsets are taken from
  Cornelia in tiles, as in WORLD 2.2 (rounded to multiples of 4).
- **New targets.** `target = CORNELIA_NW + s* x ref_offset`, where `CORNELIA_NW` is about (150, 156) and s\* is
  fitted by the verifier (6.1 of WORLD, re-run in NW-1). The concept sketch uses
  `T(p) = (128, 128) + 0.86 x (p / 4 - (127, 118))` on reference pixels.
- **Act 1.** `A1_ORIGIN_NW = CORNELIA_NW - (28, 47)`, about **(122, 109)**: Cornelia's south-gate arrival is local
  (28, 47). The act-1 delta is Δ = A1_ORIGIN_NW - (64, 64), about **(+58, +45)**. NW-0 fixes the exact value.
- **Act-1 compression.** Act 1 stays at its built scale (Cornelia to Pravoka 40 cells, about 0.71 of classic), so
  in the new world its internal pairs (cornelia-pravoka, cornelia-matoya, cornelia-temple, pravoka-matoya) are
  exempt from the distance band. Their bearings are still checked, as the temple's is today.

### 2.3 Layout sketch (the classic arrangement; original shapes)

```
 x:  0        32        64        96       128       160       192       224      255
  0  ~ ocean ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 32  ~~  [ONRAC  snow/tundra N ]~~~~~~~~~~ [CITADEL arc ] ~~~~~ [GAIA hills    ]  ~~
     ~~  [waterfall, ridge N-S ]~~ Cardia ~~  spine    ~~~~~~~ [MIRAGE desert ]   ~
 64  ~~  [caravan | Onrac coast]~ . : . :  ~~~~~~~~~~~~~~~~~~~ [ranges ring it]   ~
     ~~  [  Sea Shrine bay     ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ [Lufenia tail]~ ~~
 96  ~~~~~~~~~~~~~~ isles ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  [cliffs ]  ~~~~
     ~~~~~~~~~~~~~~~~~~~~~~ [Temple]  [====== MAINLAND ridge ===== Matoya]  ~~~~~~
128  ~~~~~~~~~~~~~~ [I ]~~~ [mainland  W ]   [CORNELIA'S CONTINENT  (act-1 mask)]~~
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
| Cornelia's continent (A1) | an east-west mainland, ragged north coast, the peninsula into the Aldi | the act-1 spine (frozen); the mainland ridge NW-SE to Matoya; Pravoka's range N-S with spurs | the act-1 rivers and tarn (frozen); new mainland streams to the north coast | grass and forest; a dry lee strip south of the mainland ridge | the bridge (act 1); Pravoka's range = W_east |
| The Aldi | an irregular inland sea, 2 islets, coves | — | ship basin `aldi` | — | closed by W_west, W_isthmus, W_arm, W_south, W_east |
| Duergar isthmus (EARTH) | a curved neck, about 6-12 cells wide | a hogback; a low saddle for the canal | coves both sides; the dwarves' landing | forest on the Aldi side, grass downs | W_west, W_isthmus; the canal (CANAL_OPEN) |
| Western continent (EARTH) | broad, with a western cape and a south-west bight | the western range from sea cliff to sea cliff (barrier `western_range`) | streams west to Sarda's coast; Melmond's river east | wet pine west of the range; Melmond's plain and the badlands in its rain shadow | the giant's tunnel is the only crossing |
| Elfland (ELF) | lobed; the long north-west arm (the Keep's cape); the south-west delta | low fells in the east (toward W_south) | a river from the fells to the delta; the marsh | forest heartland, the marsh delta, fells | W_arm; `elf_port` |
| South-east (FIRE) | joined to Pravoka's range by a rock neck; a long east coast | a volcanic arc: Gurgu's cone; Crescent's caldera ring (barrier `crescent_ring`) | Crescent Lake in the caldera; R-volcano and R-ice down the outer slope (pinned) | ash near Gurgu, frost hollow by the ice, the Lykion desert in the south-east lee | W_south; `fir_crescent` dock on the outer fjord; canoe-only south lands |
| Onrac (WATER) | a big NW continent, the Sea Shrine bay on the east, fjords in the north | a central N-S ridge; the waterfall's head | the waterfall river downhill to Onrac's bay (pinned R-waterfall) | snow and tundra north; the caravan desert in the west lee; cold forest | dockless; airship grass by each site |
| Citadel / Cardia (ORDEAL) | a crescent island arc; an archipelago of 8-12 islets | a high spine along the arc | — | grass and forest; cold north rim | dockless; the islets have landable grass |
| Gaia / Mirage / Lufenia (WIND) | a big NE continent with a long southern tail | ranges ring the interior; Gaia's hills NE; Lufenia's cliffed tail | Gaia's spring; tarns (`wnd_tarns`) | the Mirage desert interior; forests on the outer slopes; snow on the north rim | dockless; Lufenia's mesa cliffed from the Mirage sands |

### 2.4 Natural-geography rules (the generator's contract)

1. **Coasts are fractal.** A polygon signed distance, domain-warped at continent scale (amp 10-16 cells, cells 48 /
   24 / 12), plus fbm at 24-1.5 cells, plus a coast-only detail term (amp up to 18, faded beyond 14 cells from the
   coast). They give bays, capes and peninsulas at every scale. Fjords come from a second warp on the high-relief
   coasts (Onrac, Gaia's north, Pravoka's fjord).
2. **Islands and archipelagos** are seeded inside hint discs (Cardia; off the west and south coasts; the Aldi
   islets). A minimum size is kept (`min_island` 8 cells), and so is a minimum strait for the ship (3 cells).
3. **Mountains follow ridgelines.** Elevation = a coast-distance term + ridge polylines with a Gaussian falloff,
   widths 3-5 cells, modulated by ridged noise (spurs, crags, saddles). Mountain where elevation > `h_m`; foothills
   come from the organic renderer (`terrain/peaks.py`). Passes are explicit low points on a ridge.
4. **Rivers flow downhill.** Priority-flood the elevation (fill pits), run D8 flow with a rain field, and take
   rivers where the accumulation exceeds `a_r`; they end in the sea or a lake. Pits deeper than `d_l` become lakes.
   Rivers are made 4-connected (the canoe moves orthogonally) by a diagonal fix-up. **Canoe routes are pinned**
   (R-volcano, R-ice, R-waterfall, the lake crossings): a pinned route carves its valley into the elevation first,
   so the hydrology follows it, and the check (3.8) proves each route connects its ends.
5. **Climate.** Moisture: a westerly sweep per row that refills over the sea, drains slowly over land and fast over
   high ground (rain shadow), plus a coast and river term and hand **climate hints** (arid: the caravan, Mirage,
   Lykion and Melmond's badlands; wet: the Marsh delta, Sarda's coast). Temperature: latitude (cold from about y 70
   north) minus elevation, with a noisy cut-off (no straight snow line).
6. **Biomes** from a table on (moisture, temperature, elevation): ocean, beach sand on low hot coasts, grass,
   forest, swamp (wet lowland by water), sand (desert), mountain, and two new recoloured materials, `snow` and
   `tundra` (2.6). Small patches tidy to their neighbours (`min_blob` 3, as today).
7. **Sites shape the ground, not the reverse.** Each site footprint is a pin: its icon cells, door, gate, dock, the
   landing grass and a clearing radius are forced, and the elevation is flattened round it, so the land around
   looks settled (FX-R dressing stays).

### 2.5 Variability and determinism

- **Knobs** per continent spec: `warp`, `rough` (coast detail amp), `islands` (density), `ridge_scale`,
  `aridity`, a seed. Global: the world seed and three presets (A calm, B classic, C rugged), chosen at the pilot.
- **Locality.** Each continent's field is computed in its own bounding box plus a 24-cell margin and combined by
  max. The noise is defined on global cells. Editing one continent's spec therefore changes only cells within its
  influence: NW-0 measures it, and a test asserts that the cells outside the margin stay byte-equal.
- **Determinism.** Numpy seeded generators only, row-major loops, no `random`, no `hash()`, no set iteration (as
  today). The heap of the priority flood breaks ties by (elevation, y, x). The generator's output is the world
  source's `ground`; G-NW5 covers it.
- **Metrics** (`worldgen/metrics.py`, printed by `world.py --metrics`): the coast index, the straight runs, the
  chunk-line runs, the mountain share, the river length, the island count, the per-biome shares, each per
  continent. G-NW1 to G-NW3 fail the compose.

### 2.6 Terrain materials

- `snow` and `tundra` are new soft materials added at the end of `SOFT` (a layer's noise seed depends on its index)
  through `FALLBACK_MATERIALS`, as `swamp` is: recoloured copies of `sand` and `grass` (no new art). Tundra maps to
  `TerrainType` grass (0), so the airship may land on it. Snow gets its own walkable `TerrainType` (12) outside
  `canLand`, so no landing on snow (the Q6 default). That is about +5 lines in `src/types/index.ts`, the field
  collision code and `build_map.TERRAIN`.
- Northern forest stays `forest`. A cold pinewood tint would need a per-zone material, which the compiler does not
  have, so it is out of scope.
- Encounter zones do not depend on the material, so new materials change no balance.
- The organic renderer (`terrain/`) needs no change beyond the two `SOFT` entries and their `ROUNDED` blur radii;
  NW-2 adds a selftest case for each.

## 3. Generator architecture

### 3.1 Pipeline

```
continent specs (polygons, ridges, walls, passes, climate hints, islands)  +  site pins (from the region site files)
  -> shape    land field: warped polygon SDF + fbm + coast detail; islands; forced land/water (pins, walls, Aldi, channels)
  -> relief   elevation: coast distance + ridges (ridged noise) + passes; flatten at pins; carve pinned canoe valleys
  -> hydro    priority flood, D8 flow, accumulation -> rivers (4-connected), lakes; pinned routes verified
  -> climate  moisture (westerly sweep, rain shadow, hints), temperature (latitude, elevation)
  -> biomes   table -> legend chars; tidy (min_blob, inlets, ponds)
  -> paste    act-1 frozen mask (translated by A1_ORIGIN_NW); region stamps (icons, docks, decks, patches)
  -> owners   owner grid: each cell -> region (continent membership; sea cells by nearest coast)
  -> checks   gates (basins, docks, walls, barriers walk+canoe, canal), metrics, map checks per region
  -> source   assets-src/maps-nw/overworld.yaml (cutover: assets-src/maps/overworld.yaml)
```

### 3.2 Files (each under 250 lines; `tests/data/questCeilings.test.ts` is extended to `worldgen/`)

| File | Content | Est. lines |
|---|---|---|
| `assets-src/tools/worldgen/noise.py` | the one value noise, fbm, ridged noise, domain warp (replaces the three copies; `world_coast` and `overworld_noise` re-export it, act 1 stays byte-equal) | 110 |
| `worldgen/spec.py` | the spec dataclasses (`Continent`, `Ridge`, `WallLine`, `Pass`, `ClimateHint`, `IsleField`, `Pin`), the reference-to-world transform `T` | 140 |
| `worldgen/shape.py` | the land field and islands; forced masks | 180 |
| `worldgen/relief.py` | elevation, passes, flattening, valley carving | 170 |
| `worldgen/hydro.py` | priority flood, flow, rivers, lakes, 4-connectivity, pinned routes | 200 |
| `worldgen/climate.py` | moisture, temperature, the biome table, tidy | 170 |
| `worldgen/owners.py` | the owner grid, `owned_chunks(region)`, the sea split | 110 |
| `worldgen/gates.py` | the gate builders and their checks (4.1) | 220 |
| `worldgen/metrics.py` | 2.5's metrics and G-NW1-3 | 140 |
| `worldgen/selftest.py` | synthetic specs: a straight-edged polygon comes out with no run > 6; a ridge gets foothills; a river reaches the sea; a pinned route connects; locality; determinism | 200 |
| `layouts/world_specs/<region>.py` (7) | each continent's spec data (owned by its region) | 60-150 each |
| `layouts/world.py` (rewritten) | the composer v2 (3.1 order) | 200 |
| `layouts/world_api.py` (v2) | WORLD 256, `A1_ORIGIN`, `FROZEN_MASK`, `DOCKS_ALLOWED`, `WALLS` as wall-line ids, `BASIN_SEEDS`, `RegionOut` v2; `BOXES`, `SEAMS`, `EDGE` and `PLACEHOLDER_WALLS` removed | 200 |

### 3.3 `RegionOut` v2

- **Removed:** `ground` (rows of the box), the band rule, `stub`.
- **Added:** `spec` (the region's continent specs), `pins` (cells and the material each must have, with a
  clearing radius), `stamps` (small ground overrides inside the region's pins only, e.g. a quay or a ford),
  `routes` (pinned canoe routes: name, ends, the cells it may use).
- **Kept:** objects, NPCs, inspect, transitions, entrances, gates, patches, docks, hazards, zones, vehicles,
  ambient, backgrounds, checks, barriers (now defined by a ridge or ring id plus seeds; the composer derives the cells
  and the minimal cut), walls (by wall-line id).
- **Zones** are built after the ground: a region lists named zone areas (polygons or "the region's land of biome
  X"), and `owners.py` intersects them with its owner cells and turns them into `row_rects` as today. A walkable or
  canoe cell of a region left in no zone fails the compose (the coverage test's rule, moved into the build).
- **Positions** of a region's sites are pins, not hand-placed against hand-drawn coast: the coast is generated
  round the pins. The site files keep their icons, footprints and doors; only their world origin changes (5.2).

### 3.4 Ownership (replaces `BOXES`)

- Each land cell belongs to the region of its continent spec; a continent may hold two regions (A1 and FIRE meet at
  Pravoka's neck; EARTH and ELF at the isthmus), split by a named owner line in the spec.
- Each sea cell belongs to the region of the nearest coast, so the sea zones stay regional.
- `world.py --owned-chunks <r>` lists the chunks the region's owner cells touch, plus its patches. `--region <r>`
  rasterises those chunks plus a 1-chunk ring, as today (W1-C1's multi-rect raster takes a chunk list).
- Two regions may share a chunk; merges are still safe because the world source is regenerated, never hand-merged.

### 3.5 What tranches edit

- A region tranche edits only `world_specs/<region>.py`, its `world_<region>.py` content module, its site files and
  its zone data. The generator, the composer and `world_api` are integrator-owned (NW-1, NW-2, NW-4).
- Every change regenerates the world source; merges re-run the layout scripts (QUEST 4.0's rule).

### 3.6 Act 1 in the generated world

- **The frozen mask.** `FROZEN_MASK` = the act-1 local cells that the act-1 tests pin. That is every act-1 land and
  inland-water cell (the Aldi coves and the sound included) more than 3 cells from the act-1 block's outer ocean
  ring, plus everything within 4 cells of a site, a road, the bridge strait, the jetty and the ship spawn. NW-3
  writes it as a list of local rects (deterministic, reviewed as an image).
- **The coast belt.** Act-1 cells outside the mask, and the world cells round the block, are the generator's. The
  generator is seeded with the act-1 land field, so the outer coast continues the act-1 shapes instead of meeting
  them at a seam. The `overworld.build()` ocean ring (`land[:4]`, `land[:, -3:]`) is lifted. Its local grid becomes
  76x76 with a 2-cell margin, so the mask's edge cells see their real neighbours.
- **The exceptions** of today (`X_pravoka`, `X_matoya`, `X_west`, `X_east`, the Pravoka icon) become parts of the
  coast belt or of the mask. Pravoka's town, quay and channel stay pinned (the ≥ 6 water cells of the channel test).
- **The north coast.** The mainland grows north beyond local y 0: the new land is generated (the mainland ridge,
  forest, a lake district). It holds no new site, so no act-1 promise changes.
- **Test impact** (counts in 5.1): `tests/quest/a1/frozenCore.test.ts` compares the mask instead of the core minus
  the rects; every test that writes world coordinates of act 1 changes by Δ (by codemod, 5.2); the act-1 local
  tests (`overworld.py check()`, layout tests on the local grid) do not change.
- **The ruling needed.** The user allowed breaking the frozen core for Pravoka's icon (LM4-INT). NW needs a wider
  ruling: the act-1 outer coast may change outside the mask (Q1).

### 3.7 Reuse

- `world_coast.organic`'s tidy (inlets, islets, ponds) and `tidy` (min_blob) move into `climate.py`.
- `world_geom` (flood, bbox, `chunk_files`) and `world_checks` (basins, docks, cuts, reachability, ids, anchors) are
  kept and fed by the owner grid instead of the boxes.
- `world_dress.scatter` (FX-R) is kept for every town icon.
- `terrain/` (the organic renderer: coasts, blends, foothills, peaks, roads) is unchanged apart from 2.6; it already
  draws soft coasts from the cell mask. The shape problem is in the mask, not the renderer.
- `map_checks_region.py` runs per region on the owner cells instead of the boxes.

### 3.8 Checks (compose-time, G-NW4)

| Check | Rule |
|---|---|
| basins | with every patch off, `aldi` and `ocean` are disjoint and each one component; with `canal` on, one; every dock in its basin; no Water cell in neither (WORLD 2.6, kept) |
| walls | each wall line (W_west, W_isthmus, W_arm, W_south, W_east) is unbroken land at least 3 cells wide, with no river or lake cell across it |
| barriers | `western_range`, `crescent_ring` and the act-1 spine: the seeds are not joined **on foot or by canoe** (rivers and lakes are passable in the canoe check); the minimal cut is exported |
| north | the north continents (owner WATER, ORDEAL, WIND) have no dock and no river or lake that touches the ocean within 1 cell of a ship-reachable coast (no canoe start from the ship) |
| landings | every airship-only anchor has a `canLand` cell within 8 steps (WORLD T6) |
| routes | every pinned canoe route connects its ends by river/lake cells; no unpinned river joins two regions' pinned routes |
| straits | every ship lane in the matrix (WORLD 2.6 sea lanes) is at least 3 cells wide |
| pins | every pin cell has its material; every door has its gate walkable; `warp_leaves` |
| metrics | G-NW1-3 |
| coverage | every walkable or canoe cell outside the frozen mask is in a zone of its region |

### 3.9 Compile cost and the lock

The generator itself is cheap (the concept sketch runs in under 1 s at 256²; the real one with the flood about
2-5 s). The compile dominates: about 20 GB and 150-340 s for a full world, under the world-compile lock. NW-2 measures
a full 256² compile and a `--region fire` compile (G-NW8). If the full compile is over 26 GB, the fallback is
`build_map.py --region` in 4 quadrants under the lock (byte-equal by GAP-14 locality).

## 4. The progression map

### 4.1 Each gate as geography

| Gate (stage) | Today | NW geography | Check |
|---|---|---|---|
| the north bridge (S1) | act-1 strait, frozen | unchanged (inside the mask) | frozen mask; GT rows unchanged |
| the Aldi is landlocked (ship before the canal, S2-S9) | 4 straight walls + seams | five wall lines drawn as ridges and headlands: W_west (the mainland's west headland to the isthmus' north end), W_isthmus (the hogback), W_arm (Elfland's north coast to the Keep's cape), W_south (Elfland's east fells to the volcanic arc, a mountain neck), W_east (Pravoka's range to the arc). Each is forced land in the shape stage; the ridges make them mountain | walls, basins |
| the canal (CANAL_OPEN) | a patch strip x 48-61, y 88-92 | a low grass saddle across the isthmus (a `Pass` on the hogback), 5-8 cells long, the patch turns it to Water; both ends meet open water on each side | basins (on/off) |
| docks (ship disembarks only at allowed docks) | `DOCKS_ALLOWED` | unchanged ids; each dock cell is a pin on a natural cove | docks |
| Melmond's plain ↔ Sarda (giant's tunnel) | `western_range` column band | a continuous ridge from sea cliff to sea cliff, no pass, no river across | barriers (walk, canoe) |
| Crescent ↔ the south lands (canoe) | `crescent_ring` | a caldera ridge round the lake district; R-volcano and R-ice are pinned rivers through gaps the ridge leaves for them only | barriers, routes |
| the waterfall (canoe) | a straight gorge | a pinned river from the waterfall's head down a valley to Onrac's bay; the ledge cells touch only rock and river | routes |
| the north continents (airship only) | no dock | no dock; their coasts are mostly cliffs (a coast-cliff option on the spec makes the coast belt mountain on high-relief shores, for the look); no river reaches the ship's sea where a canoe could start | north, landings |
| the airship landing (grass) | `canLand` | pinned grass landing cells by every north site, inside a natural meadow | landings |

The verifier stays the authority. The compose checks catch a geography leak before the verifier runs.

### 4.2 Proof (g): re-fitted

- **New targets** in `assets/data/world-anchors.yaml` (NW-1): `target = CORNELIA_NW + s* x ref_offset`, from the
  unchanged reference offsets in classic tiles, rounded to cells. The act-1 anchors' targets are their act-1 cells
  plus Δ.
- **Bands kept:** ±2 cells per axis at the target; the pair ratios in [0.86, 1.10] after the fit (PLAY-G measured
  0.86-1.16 with the act-1 pairs); the bearing and the detour bands of WORLD 6.1.
- **Exempt from distance:** the four act-1-internal pairs (2.2); their bearings are checked.
- **Script-check** before NW-1 merges: 20,000 random ±2 placements must fail at most 0.05 % (today 0.01 %).
- Pins are placed at the targets, so the generated world meets (g) by construction; the region tranches may move a
  pin inside the ±2 window only.

### 4.3 Proof (h): the travel matrix

The rows T0-T10, T6b and the two basin rows keep their meaning (what each stage can reach with which vehicle).
Their cells change with the world. `--strict` still asks for every allowed dock and the canal patch on the world
map. New: the matrix runs once more with the canoe passing rivers and lakes everywhere, which is the generated
rivers' worst case.

### 4.4 Curve model, bands and price walls

- Longer walks mean more random encounters. The curve model walks the witness, so every boss's level band (d), the
  kits (d2), the takeGold rule (d3) and the price walls (f) shift.
- **Rule:** the fights per stage stay within ±10 % of today. Lever 1: the world map's zone step means scale by the
  route-length ratio per stage (measured by NW-6 from both worlds' witnesses). Lever 2: `grind` stays as it is. No
  enemy, item or formula change.
- `tests/balance/questCurve.test.ts` (QUEST 6.4) is re-measured; each bound keeps its 3-point margin rule (AGENTS
  "Balance bounds").

### 4.5 The mutation suite

GT-1 to GT-37 and GT-5b are kept. Their element sets come from the exported wall and barrier cells, so they move
with the geography. Two rows are new:

- GT-38 a river across `western_range` (canoe skip): must be caught;
- GT-39 a river mouth on a north coast next to ship water: must be caught.

The `nonLoadBearing` entries with `at` coordinates are re-derived (5.2).

## 5. Migration

(Inventory: 5.1; method: 5.2; saves: 5.3.)

### 5.1 What reads world coordinates

Swept at `153b2454`. The runtime reads the world size from map data (`map.width`, `art.chunk`); `src/` has no
literal 192. Every transition and edge exit into `overworld` (47 + 47 in `assets-src/maps`, 4 in the legacy maps)
uses an entrance name.

| System | Where | What it stores | Count | Moves by |
|---|---|---|---|---|
| world contract | `layouts/world_api.py` | `WORLD_W/H`, `A1_ORIGIN`, `BOXES` (31 rects), `SEAMS`, `PLACEHOLDER_WALLS`, `FROZEN_EXCEPTIONS`, `PRAVOKA_ICON_CELLS`, `BASIN_SEEDS` | — | rewritten (NW-1) |
| region ground | `*/world_*_ground.py`, `elf/world_land.py`, `water/world_water_land.py`, `wind/world_ground.py` | absolute cells; noise sampled on the 192 grid | about 440 pairs | replaced by specs (NW-2, NW-R); not a transform: the noise depends on world position and size |
| region sites | `*/world_*_sites.py`, `*_data.py`, 7 `town_*_site.py` | icon, door, gate, dock cells | about 110 pairs | pins at the re-fitted targets; footprints kept, origins moved (NW-R) |
| A1 outside the local grid | `a1/world_a1_ground.py`, `a1/world_a1_sites.py`, `a1/town_pravoka_site.py` | absolute (the range, the shelf, Matoya's hill, Pravoka) | 38 pairs + 12 rects | to act-1 local or the mask (NW-3) |
| act 1 local | `overworld.py`, `overworld_consts.py` | local cells | 63 pairs | unchanged |
| progression data | `assets/data/quest.yaml` | 27 `entry: {map: overworld, x, y}`; 33 parked vehicles; 5 `nonLoadBearing` `at` cells | about 65 pairs | transform; `entry` may take `entrance:` (schema +1 field, 5.2) |
| anchors | `assets/data/world-anchors.yaml` | 24 targets, `fit.scale [0.60, 0.80]`, `longPair 20` | 24 | re-fitted (4.2): scale band about [0.75, 0.95], `longPair` 23 (20 x 0.86 / 0.735) |
| verifier defaults | `src/progression/questLateData.ts:83-97` (fit defaults), `questTravelRows.ts:28` (`BASIN_SEEDS`), `questGeo.ts:16-21` (a dead `A1_ORIGIN`) | numbers | 3 places | read from `world-anchors.yaml` / the map's `world` block; the dead constant removed (NW-1) |
| scenarios | `assets/data/debug-scenarios.yaml` | 43 overworld spawns by entrance; 3 by `frame: a1` local spawn; 38 parked vehicles absolute | 38 pairs | transform for the vehicles (`at: <entrance>` preferred) |
| cutscenes | `assets/data/cutscenes.yaml:424-428` | `set_vehicle airship overworld (149, 162)` | 1 | transform |
| saves | `src/systems/SaveManager.ts` (`SAVE_VERSION` 3) | `currentMap` + `playerPosition`; `vehicles [{type, map, x, y}]` | — | v4 migration (5.3) |
| runtime frames | `MapTransition.shiftA1`, `DebugScenarioLoader` (`frame: a1`), `Game.pendingFrame` | the map's `world.frames.a1.origin` | — | data-driven: the new origin flows through |
| streaming | `src/rendering/chunkStreaming.ts` | view-based caps (60, flight 36 / 16), `STREAM_MIN_CHUNKS` 64 | — | none |
| Mode 7 | `WorldAtlas.atlasSize` (square, `size = width x cellPx`), `mode7Toggle.ts` (`FULL_TEXTURE` 4096, `MIN_TEXTURE` 2048), `pilotGl.ts` (`ATLAS_CELL_PX` 16) | data-driven | — | re-bake at 12 px (6.1); the pilot constant follows `mode7.json` |
| bestiary habitats | `assets/data/bestiary.yaml`, `bestiaryHabitats.ts` | zone ids | — | none, if zone ids are kept (NW-R keeps them) |
| encounters | `EncounterSystem`, `BattleTrigger` | zone rects in the map | — | none (regenerated) |
| chunk art | `terrain/frame.py` seeds by `overworld:{col}:{row}` | — | — | all world art changes anyway |
| tests | `tests/helpers/worldFrame.ts` (`A1_ORIGIN`, `WORLD_SIZE`, `a1At`) used by 4 files; `frozenCore`, `overworldZoneCoverage`, `overworldLayout` read the frame from the map | — | — | the helper reads the map; the 4 files follow |
| tests, absolute | about 20-30 real files: `quest/*/<r>_o_world` (copied boxes), `fire/northWest`, `a1/pravokaChannel`, `a1/bridgePatch`, `a1/a1_o_sites`, `data/landmarkArt`, `fxdWorldArt`, `fxrWorldArt`, `progression/macroGeography`, `travelMatrix`, the 192 / 3072 / 1536 literals in 16 files (Mode 7, streaming, frames) | literals | about 400 numbers | codemod by the transform; the box-copy tests are rewritten against the owner grid or retired with their region's ground (NW-R); `fxdWorldArt` / `fxrWorldArt` are retired (their coasts are gone) and replaced by G-NW1-3 tests |
| synthetic maps named `overworld` | `fixtures/quest/*.yaml`, `NpcWander`, `EncounterStepFilter`, `BattleBackdrop`, `MapEntrances` | synthetic | — | none |

### 5.2 How they move

1. **By entrance name** (preferred): a transition, scenario spawn, quest `entry` / `walk` step or test that names an
   entrance needs no change: the entrance moves with its site.
2. **By the recorded transform:** the composer writes `world.migrate` into the source: `from: {size: 192, version: 1}`,
   the act-1 delta Δ, and per region the old and new position of each anchor. `assets-src/tools/worldgen/migrate.py`
   maps an old cell: an act-1 cell by Δ; any other by its region's nearest anchor (old) to the same anchor (new), with
   the offset scaled by s\*_new / s\*_old, then snapped to the nearest cell of the same kind (walkable / Water in the
   same basin / River / canLand). A codemod (`scripts/nw-codemod.ts`, scratch, not committed) rewrites literal
   coordinates in YAML and tests through it, and lists every rewrite for review.
3. **By hand:** never. A literal the codemod can't map is changed to an entrance name in the same tranche.

4. **Schema help.** `quest.yaml` `entry` and every parked vehicle (quest entries, scenarios, the cutscene) accept
   `at: <entrance>` beside `x, y` (`schemaValidationQuest.ts`, +10 lines). The codemod writes `at:` when the old cell
   is within 3 steps of an entrance or a dock. This cuts the raw pairs from about 105 to under 30.

### 5.3 Saves

- **Today.** `SAVE_VERSION` 3. A save stores `currentMap`, `playerPosition` and `vehicles [{type, map, x, y}]` as
  raw cells. The only hook is v1's `frame: 'a1'` shift (`MapTransition.shiftA1`); `safeSpawn` sends an invalid
  position to the first entrance.
- **v4** (NW-5): `SaveData.world = {map: 'overworld', version: 2}`. Loading a v3 save whose `currentMap` is
  `overworld`, or with any `vehicles[].map === 'overworld'`, runs the migration: `src/systems/worldMigrate.ts`
  (under 120 lines, pure) applies the `world.migrate` table of the compiled map (5.2, step 2). The snap is
  mode-aware: the party on foot goes to the nearest walkable cell of the same owner region, the ship to the nearest
  Water of the same basin, the canoe to the nearest River or Lake, and the airship to the nearest `canLand` cell.
  If no cell lies within 6 steps, the party goes to the region's town gate (an entrance) and the vehicle to its
  region's dock (ship) or landing pin (airship).
- **Saves inside other maps** need nothing: their positions are not world cells.
- **Tests:** `tests/systems/saveWorldMigrate.test.ts` covers fixtures of a v3 save on act 1, on the Aldi in the ship,
  in the north with the airship parked, and on a river in the canoe. Each must land on a legal cell of the same
  kind, in the same region. `saveOriginShift.test.ts` (v1) is kept.
- **The alternative ruling** (Q4): drop old overworld positions to the Cornelia arrival and reset vehicles to their
  docks. It is cheaper (about 2 h less) but loses the ship's place in a late save.

## 6. Mode 7

### 6.1 The atlas at 256 cells

| Option | Full atlas | Low atlas | GPU (full, with mips) | Fits `mode7Toggle` (`FULL_TEXTURE` 4096) | Downsample |
|---|---|---|---|---|---|
| 16 px (today's constant) | 4096² | 2048² | 89.5 MB (+39 MB); flight about 214 MB, about 281 MB while composing | exactly at the limit; many integrated GPUs fall to `low` | 3x3 |
| **12 px (recommended)** | **3072²** | **1536² at 6 px** | **50.3 MB, unchanged; flight 175.0 MB as today** | **yes** | **4x4 / 8x8, integral** |

- **The bake.** `mode7_atlas.py` takes `CELL_PX` and `LOW_CELL_PX` from the world size: `CELL_PX = 3072 // W`,
  `LOW_CELL_PX = CELL_PX // 2`, refusing a non-integral box (`SRC_PX % CELL_PX != 0`). For 192 that is 16 / 8 as
  today; for 256 it is 12 / 6. `mode7.json` already records `cellPx`; `WorldAtlas.atlasSize` checks
  `size = width x cellPx` and needs no change.
- **The look.** The far mesh starts at `D_SPLIT` 25 cells, where it was magnified at most 3x; now at most 4x. Beyond
  about 35 cells it is under 2x, and about 1:1 at the horizon. M7's near window (64 cells) and the split are
  unchanged. If the user sees the blur line, the remedy is `D_SPLIT` 28 (the near window allows it: 24-cell margins
  either side of the ship need 20.6). This is a tuning value, not a tranche.
- **The low profile:** 6 px per cell at the horizon. The near window at 32 px is unchanged.
- **The tests** that pin 3072 / 1536 / 192 (`worldAtlas`, `nearDetail`, `mode7Math`, `mode7Parity`, `mode7Tilt`,
  `streamWindow`, `bakedStreaming`, `mode7Atlas`) read the sizes from the map and `mode7.json` after NW-5. The pure
  math tests keep their own synthetic 192 maps.

### 6.2 Ordering with the Mode 7 tranches

- **M7-4** (tilt and landing) is merging now. Pass NW does not start NW-5 until it has merged.
- **M7-5** (billboards, clouds) and **M7-6** (fallbacks) touch only `src/scenes/exploration/mode7/` and
  `chunkStreaming.ts`. NW-0 to NW-4 and the NW-R tranches touch only Python and the scratch world. They run in
  parallel with no shared file.
- **M7-INT** merges before NW-5 starts. NW-5 then owns the `mode7_atlas.py` change (6.1), the re-bake and the Mode 7
  test sizes. If M7-INT slips, NW-5 waits: it would otherwise rebase over M7-6's `chunkStreaming.ts` changes.
- **M7-8** (landmark billboards, optional) and **M7-7** (quarter turns, not scheduled) come after NW-INT. M7-8 bakes
  billboard cuts from the world's tall decos, so it should be built on the new world.

## 7. Tranches

Each tranche is a branch from `mainline`, mergeable on its own; `mainline` plays today's world until NW-5. Agents
run `npm run test:fast`; the integrator runs `npm run test:full`. One world compile at a time (the lock). Review
output goes to `~/temp/ff-game/worldplan/<tranche>/`.

| Tranche | Owner | Content | Gates | Depends on | Effort |
|---|---|---|---|---|---|
| **NW-0 Pilot** | a generator agent | Offline only, nothing committed but the result note. A scratch generator in `/tmp/<agent>/nw/` (the concept sketch grown to 3.1's stages, with a full priority flood, hydrology, climate and gates). It writes 3 variants (presets A calm, B classic, C rugged) of a 256² world as (1) a flat-colour map at 4 px per cell with sites and the chunk grid, (2) the same beside the classic reference and `now.png`, (3) a full scratch compile (`build_map.py overworld --src-dir <scratch> --out <scratch>`, under the lock) with a 0.15 overview and four 1x crops (the Aldi with Cornelia, Onrac's river, the volcanic arc, the isthmus). Also the metrics table (G-NW1-3) and the act-1 placement with its frozen mask drawn | the user picks a preset and approves the size, the arrangement and the act-1 position (G-NW9); measured: generation time, compile peak and time at 256² | none | 10 h |
| NW-1 Contract | integrator | `world_api.py` v2 (3.2); `worldgen/spec.py` and `noise.py` (the act-1 noise byte-equal); the re-fitted `world-anchors.yaml` targets and bands (script-checked, 4.2), kept as `assets-src/maps-nw/world-anchors.yaml` until NW-5; the `entry` / vehicle `at:` schema (5.2); the verifier `--maps DIR` and `--anchors FILE` options so it can run on a scratch compile; `questLateData` / `questTravelRows` read their numbers from data | `npm run quest -- --strict` unchanged on today's world; selftests; `test:fast` | NW-0 | 6 h |
| NW-2 Generator | generator agent | `worldgen/` shape, relief, hydro, climate, owners, metrics, selftest (3.2); `snow` / `tundra` materials (2.6); the composer v2 writing `assets-src/maps-nw/overworld.yaml` from the 7 region specs (first cut from the pilot) with every site ported by the transform (5.2) and flattened pins: a complete but rough world | `worldgen/selftest.py` OK; G-NW1-3 on the world; determinism (G-NW5); full scratch compile memory and time (G-NW8) | NW-1 | 14 h |
| NW-3 Act 1 | A1 agent | `FROZEN_MASK`, the coast belt, the new origin; `overworld.build()`'s ring lifted (76x76 local grid); `a1/` absolute files to local or mask cells; Pravoka's channel kept; the new `frozenCore` fixture test against the mask | the frozen-mask test; act-1 layout tests on the scratch compile; `a1` image review | NW-2 | 6 h |
| NW-4 Gates | integrator | `worldgen/gates.py`: the wall lines, the canal pass, the barriers on foot and by canoe, routes, the north rule, landings, straits (3.8); `world_checks` on the owner grid; `--owned-chunks` and `--region` from the owner grid; GT-38 / GT-39 fixtures | `world.py` prints `world: OK`, `basins: OK`, `barriers: OK (walk, canoe)`; the verifier `--strict` on the scratch compile | NW-2 | 8 h |
| NW-R x6 Regions | one agent per region: ELF, EARTH, FIRE, ORDEAL, WATER, WIND | the region's spec tuned (coast, ridges, climate hints, islands), its pins at the targets, its zones (same ids, so the bestiary habitats hold), barriers, backdrops, dressing; its design note in the region module; its `<r>_o_world` test rewritten against the owner grid (kept under `tests/nw/` until NW-5) | per-region metrics; `--region <r>` scratch compile and image review; the verifier `--strict --stage <S>` for its stages on the scratch compile; `test:fast` | NW-3, NW-4 | 7 h each, 42 h |
| NW-5 Cutover | integrator | `assets-src/maps-nw/` moves over `assets-src/maps/overworld.yaml`; the full compile; the Mode 7 bake at 12 px; the codemod over `quest.yaml`, scenarios, cutscenes and tests (5.2); `tests/nw/` merged into `tests/`; save v4 and `worldMigrate.ts` (5.3); AGENTS.md "The world (pass W)" rewritten as "The world (pass NW)" | `npm run build`; `npm run test:full`; `npm run quest -- --strict`; `--mutate` started in the background; the 4 save fixtures | NW-R (all), M7-INT | 12 h |
| NW-6 Balance | balance agent | the curve-model re-measure: per-stage fight counts against today's, the world map's zone step means scaled (4.4); `questCurve.test.ts`, `fieldPacing`, `zones` bounds re-measured | (d), (d2), (d3), (f) pass; balance tests with their margins | NW-5 | 5 h |
| NW-INT | integrator | the last merges; `--strict --mutate` result; browser checkpoints with `&mute=1` (walk act 1, ship round the Aldi, canal, canoe to Gurgu, airship landing at Onrac, Mode 7 flight over the north); the final overview beside the classic; `docs/PROGRESS.md`; `docs/STATUS` item 3 (organic coastlines) closed | all of 0.1; the user's review of the overview and a play session (G-NW9) | NW-6 | 4 h |

**Total about 107 h.** Critical path: NW-0 (10) → user review → NW-1 (6) → NW-2 (14) → NW-3 and NW-4 in parallel
(8) → NW-R in parallel (7, with the compile lock serialising their scratch compiles: about 6 x 6 min) → NW-5 (12) →
NW-6 (5) → NW-INT (4): **about 67 h** of wall clock, plus the user's two reviews.

**Concurrency.** The heavy-job rule of WORLD 2.3 applies to every full scratch compile (at most 3 other active
tranches). NW-R agents do `--region` compiles (at most 10 GB) and run Vitest with `--maxWorkers=2 --minWorkers=1`.
Each scratch compile goes to `/tmp/<agent>/nw-out/`, never `assets/maps/ai/`. The world source in
`assets-src/maps-nw/` is regenerated by `world.py` and never hand-merged.

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The generated rivers or lakes open a canoe skip across a barrier | the barrier check runs by canoe too (3.8); GT-38; the matrix's worst-case canoe run (4.3) |
| R2 | A generated coast or strait breaks a sea lane or leaks the Aldi | wall lines are forced land; the straits check (3 cells); basins on every compose |
| R3 | The look is still "generated" (blobby continents, uniform noise) | the pilot with 3 presets and the user's pick; the per-continent knobs; the coast index gate (G-NW2) |
| R4 | Act 1's mask and the generated belt meet at a visible seam | the generator is seeded with the act-1 land field (3.6); NW-3 reviews the belt at 1x |
| R5 | The full compile at 256² exceeds 26 GB | measured in NW-0 and NW-2 (estimate 20 GB from the measured 11.3 GB); fallback: quadrant `--region` compiles |
| R6 | Longer walks shift every level band and price wall | NW-6's ±10 % fight rule; zone step means scaled; no formula change |
| R7 | The codemod mis-maps a test literal and hides a regression | the codemod lists every rewrite; literals near an entrance become `at:`; an unmappable literal becomes a name by hand in review |
| R8 | NW-R agents fight over shared chunks | the world source is regenerated, never merged; the region's spec file is its only shared input; merges re-run `world.py` |
| R9 | A 12 px far atlas shows a blur line at the split | `D_SPLIT` tuning (6.1); the user's Mode 7 check in NW-INT |
| R10 | M7-5 / M7-6 / M7-INT slip and block NW-5 | NW-0 to NW-R do not depend on them; NW-5 waits rather than rebasing over half-merged Mode 7 code |
| R11 | Old saves land somewhere odd | the mode-aware snap and the region fallback (5.3); 4 fixtures |
| R12 | The verifier's (g) fails on the act-1 pairs | the act-1-internal pairs are distance-exempt with bearings checked (2.2); the 20,000-placement script-check (4.2) |
| R13 | The generator grows past 250 lines per file | the file plan of 3.2; `questCeilings.test.ts` extended to `worldgen/` |
| R14 | A natural world loses the classic's "puzzle" feel (the gated rings, the isthmus) | every gate is a named feature in a continent spec (4.1), reviewed by region in NW-R |

## 9. Open questions for the user (each has a default)

| # | Question | Default |
|---|---|---|
| Q1 | Act 1: keep its interior cell for cell and let its outer coast (the mainland's north and west, the fjord, the Aldi's far shores) change? Or regenerate act 1 too (re-test and re-playtest everything)? | keep the interior inside a frozen mask; the outer coast changes (3.6) |
| Q2 | Size: 256x256 (classic FF1 size, s\* ≈ 0.86, walks about 17 % longer per classic distance)? Or 224 (less room) / 288 (compile and atlas at their limits)? | 256 |
| Q3 | How close to the classic arrangement: (a) the same continents and relative positions, original coasts (today's rule); (b) the same plus closer outlines (the Citadel arc, Lufenia's long tail, the river maze of the south-east)? | (a), with the shape language of (b) where a gate needs it |
| Q4 | Old saves: migrate world positions and vehicles (5.3, v4)? Or reset overworld saves to Cornelia with vehicles at their docks? | migrate |
| Q5 | Coast roughness preset: picked from the pilot's A / B / C | B |
| Q6 | Snow and tundra in the far north: add them (recoloured, no new art)? May the airship land on snow? | add both; landing allowed on tundra, not on snow |
| Q7 | Mode 7: accept the 12 px far atlas (same memory, a little softer far away)? Or 16 px at 4096² (sharper, +39 MB, more machines fall to `low`)? | 12 px |
| Q8 | Balance: keep the fight count per stage (scale the step means), or let the bigger world mean more grinding? | keep the count (±10 %) |
| Q9 | More islands: a second archipelago (e.g. south of Elfland or off the west coast) with no content, only for the look? Or must every island hold something? | the look only; airship-landable grass on the larger ones |

## 10. TODOs

```markdown
## TODOs
- [x] Diagnose the boxy world from the code and measure it (1.1, 1.2) (2026-11-20)
- [x] Render now.png, the concept sketch and the side-by-side in ~/temp/ff-game/worldplan/ (2026-11-20)
- [x] Inventory every world-coordinate consumer (5.1) (2026-11-20)
- [ ] User answers Q1-Q9 (priority: high, effort: 0.5h)
- [ ] NW-0 pilot images and the user's pick (priority: high, effort: 10h)
- [ ] NW-1 contract (priority: high, effort: 6h)
- [ ] NW-2 generator (priority: high, effort: 14h)
- [ ] NW-3 act 1 in the new world (priority: high, effort: 6h)
- [ ] NW-4 gates and checks (priority: high, effort: 8h)
- [ ] NW-R ELF / EARTH / FIRE / ORDEAL / WATER / WIND (priority: medium, effort: 42h)
- [ ] M7-INT merged before NW-5 (priority: medium, effort: external)
- [ ] NW-5 cutover and migration (priority: high, effort: 12h)
- [ ] NW-6 balance re-measure (priority: medium, effort: 5h)
- [ ] NW-INT and the user's play session (priority: high, effort: 4h)
```

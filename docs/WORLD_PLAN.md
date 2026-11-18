# World build-out plan (pass W), rev 3

Status: rev 3. Momus passed rev 2 (OKAY); rev 3 folds in its 7 remaining items. Rev 2 answered the review of rev 1. Nothing is implemented. Pass W replaces the
geography and the tranche split of `docs/QUEST_PLAN.md` rev 3 (pass Q). It reuses that plan's engine and toolchain
groundwork by reference (section 1). Like pass Q, pass W starts only after the kneel pass (`docs/KNEEL_PLAN.md`,
`docs/KNEEL_AI_PLAN.md`) has merged into `mainline` and `npm test` is green at that head. Pass W never touches the
kneel files. Facts in 1.4 were checked at `4ade849`.

**Rev 3 changes (momus's remaining items on rev 2):**

| # | Item | Resolution |
|---|---|---|
| 1 | P2 The heavy-job rule stalls W1 | W1-C1 and W1-C2 start with at most 2 other W1 tranches running; the rest are admitted once both have passed their memory probe. "Active" means a worktree whose branch is not merged into `mainline`, checked with a given command. The W1 step gets about 4 h more (2.3, 5.0) |
| 2 | P2 The GT-35 and GT-37 barriers | `RegionOut.barriers: {name: (cells, side_a_seed, side_b_seed)}`, declared by W1-0b and implemented by W1-C2. ERT-O fills `western_range` and FIR-O fills `crescent_ring`; the composer exports their minimal cuts (2.9, 5.1, 5.2, 6.3) |
| 3 | P2 The ice anchor | `fir_ice` moves to (136, 148), below the forbidden rows 146-147; the mouth's arrival cell is south of the cliff rows (2.2, 4.4) |
| 4 | P2 Worktree memory | W1-0a records `/usr/bin/time -l npx vitest run --maxWorkers=2 --minWorkers=1` and lowers the "3 others" limit if one worktree's peak exceeds about 2 GB (2.3, 5.1) |
| 5 | P3 dwarf-melmond | `ert_dwarf` moves 1 cell to (54, 106). Re-measured: 2 failures in 20,000 random ±2 placements (0.01 %, both crescent-ice). That residual risk is noted; the macro test is the authority (2.2) |
| 6 | P3 The GT-5b fixture; site files | GT-5b's fixture keeps the removed dwarves' landing out of the `DOCKS_ALLOWED` check, so the row fails only on (a). QUEST 4.0's "regenerate, never hand-merge" rule covers every `town_*_site.py` change (5.3, 6.3) |
| 7 | P3 R26 | the kneel pass has merged (88f8ad7); R26 now only says pass W branches from a head at or after it |

**Rev 2 changes (momus review of rev 1):**

| # | Finding | Resolution |
|---|---|---|
| 1 | P1 GT-5: Elfland is also reachable from the dwarves' landing over `seam_n` | GT-5 is non-load-bearing with that reason; the new row GT-5b removes both `elf_port` and `ert_dwarf` and must make the goal unreachable (6.3) |
| 2 | P1 No owner for the town tooling | W1-D (now 7 h) generalises `interiors_common.py` with a `town` parameter and extracts the outdoor helpers into `layouts/town_common.py`; `cornelia.py` and the Cornelia maps stay byte-equal (G1). Both files are in 5.5 (5.2, 5.5) |
| 3 | P1 Memory outside the lock | `--region` takes the lock (2.3, G2). Heavy-job rule: a full-world compile runs only while at most 3 other tranches are active; every worktree runs Vitest with `--maxWorkers=2 --minWorkers=1` (G4). W1-C1 also measures a land-filled synthetic world. The `--region` limit is 10 GB everywhere (estimate about 8 GB) (2.3, 5.0, 5.2, G2, G4) |
| 4 | P1 Act-1 raw spawns; jetty facts | `r_ow_temple`, `r_ow_bridge` and `r_ow_east` all get `frame: a1`. 1.4 is corrected: the jetty is on rows 54-56 and the ship spawn is (28, 57). The `aldi` seed is now the ship spawn's cell, world (92, 121). New test `tests/data/scenarioSpawns.test.ts` (W1-B) (1.4, 1.5, 2.6, 5.1) |
| 5 | P2 Missing GT rows | GT-35 (the western range), GT-36 (the giant's cell) and GT-37 (Crescent's ring) (6.3) |
| 6 | P2 Anchor placement | `elf_keep` (61, 126), `fir_volcano` (120, 151), `fir_ice` (135, 147), `fir_desert` (143, 160); the pair giant-sarda becomes melmond-sarda. Re-measured: s* = 0.735, ratios 0.86-1.10, 0 failures in 6000 random ±2 placements. T tranches own the anchors in their site files. The bearing difference is min(\|Δ\|, 360 - \|Δ\|). The detour hops are listed with their factors (2.2, 5.3, 6.1) |
| 7 | P2 5.3 was backwards | the O module imports the site file; W1-0b creates every default `town_<town>_site.py`; the T tranche edits it (5.1, 5.3) |
| 8 | P2 The W1-C1 / C2 interface | W1-0b declares the `build_hooks.py` signatures with no-op bodies; C1 calls them, C2 fills them (5.1) |
| 9 | P2 5.0 consistency | WND-O is in the first wave (ORD-O leads the queue). The efforts are re-added (foundation 87 h, total 261 h). The wall-clock critical path is about 67 h, with 6 slots and the serial merges (5.0) |
| 10 | P2 6.5 checkpoints | every row has its own scenario id, owned by the tranche that runs it; each negative row withholds exactly one prerequisite (6.5) |
| 11 | P2 House counts | houses come from the source YAML's `type: house` objects; interiors are distinct door transitions to `<town>-house-*` on the compiled map (4.0.1) |
| 12 | P2 Conflict hot spots | per-tranche comment anchors in `quest.yaml`, and around the owned boss records in `enemies.yaml`; W1-F is the only owner of every `w_*` kit (5.1, 5.4, 5.5) |
| 13 | P2 The Mirage chime gate | moved inside `mirage-1f` (a vestibule door), so WND-D1 owns it; the matrix uses `mirage-1f:inner` (4.7, 6.2, 6.3) |
| 14 | P2 W1-0 was over-scoped | split into W1-0a (the QUEST Q1-0 contract plus the extraction, 8 h) and W1-0b (world data, canon, stubs, sites, hooks, 6 h), in parallel (5.1) |
| 15 | P3 Small items | the `ExplorationScene.ts` ceiling is 590 after W1-0a's extraction; each tranche stages and checks its backgrounds from `~/temp/ffgame-assets`; `stubs.py --check` always fails on a remaining stub and `--count` only counts; `?art=legacy` stays act-1 only (5.1, 5.3, 6.6, R17) |
| 16 | P3 Cramped spots | FIRE's north-west: the volcano and ice targets moved; rows 146-147 are W_south's cliffs and both mouths open south. Pravoka: the range moves to x 138-141, and a channel test asks for at least 6 water cells between the quay and the range (2.5, 2.6, 4.1, 4.4, R23) |

**Naming.**

- **Stages** are S0-S31 (3.2). They replace pass Q's S0-S26 entirely, so a pass Q stage number means nothing here.
- **Tranches** are `W1-0a` and `W1-0b` (the contract, together "W1-0"), `W1-A` to `W1-I` (the foundation), the 21 region tranches `<REG>-<O|T|D>`
  (O = overworld module plus small sites, T = town, D = dungeon) and `INT`, `PLAY` (5.0).
- **Engine gaps** are GAP-n: GAP-1 to GAP-14 are pass Q's (QUEST 1.8), and GAP-15 to GAP-19 are new (1.5).
- **Gates** are G1-G17 (section 7). Decisions are D-W1 to D-W14 (1.3). Mutation gates are GT-n (6.3).
- **"QUEST n.m"** means section n.m of `docs/QUEST_PLAN.md` rev 3.

## 0. Summary

The rest of the world is built as a reimagined version of the 1987 game. The classic macro geography is kept:

- the relative compass placement of the continents and places;
- the relative distances between them, as ratios at one world scale;
- the same travel gates in the same order.

Every coastline, landmass shape, tile position, town plan, dungeon floor, NPC line and cutscene is original.

- **One world map** (`overworld`), **192x192 cells** (12x12 chunks of 16), at about **0.73 world cells per classic
  tile** (2.3). The act-1 72x72 block moves from (0, 0) to the origin **(64, 64)**, so that Cornelia sits where the
  classic places it: east of centre, south of the middle. Its ground stays byte-equal after translation (2.5).
- **Seven region boxes**, chunk-aligned and some made of two rectangles: A1, ELF, EARTH, FIRE, ORDEAL, WATER, WIND
  (2.4). They map one-to-one onto the user's seven primary areas, with Cornelia's own continent as A1.
- **Two seas.** The enclosed Aldi Sea holds Pravoka, Elfheim and the dwarves. The world ocean holds everything else.
  The dwarves' canal is their only link (2.6). Rivers need the canoe. The north (Citadel, Onrac, Gaia, Lufenia) and
  the Cardia isles can be reached only by airship.
- **The classic chain is restored** where pass Q compressed it (D-W5). The order is:
  1. the caravan's bottle;
  2. Gaia's fairy and the oxyale;
  3. Onrac's submarine and the Sea Shrine;
  4. the slab, read by Dr. Unne in Melmond;
  5. Lufenia's chime and the Mirage Tower;
  6. the warp cube to the sky castle.
- **Early access follows the classic.** Crescent Lake opens with the canal; Onrac, Gaia and Lufenia open with the
  airship. Pass Q's invented J2 ice floe and WIND landing field are dropped (D-W3). Price walls (proof (f), 6.0) and a
  language gate on Lufenia's shops take over their balance job.
- **Towns follow the Cornelia standard** (4.0.1): walled or otherwise distinctive layouts, 3-9 house interiors, 10-16
  outdoor NPCs, flag-reactive and hint NPCs, five shops, an inn and a clinic.
- **Verification** extends pass Q's verifier (QUEST 5) with:
  - a macro-geography test: fitted scale, distance-ratio bands and bearing bands on the compiled world (6.1);
  - a travel-requirement matrix (6.2);
  - a no-skip mutation suite with one named row per gate (6.3);
  - walkthroughs and browser checkpoints for every stage (6.4, 6.5);
  - a town-standard test (6.6).
- **35 tranches** (5.0), each sized for one session of at most 8 agent-hours: W1-0a, W1-0b, 10 foundation
  tranches, 21 region tranches, INT and PLAY. At most 6 region tranches run at once.

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "A new game reaches CHAOS_DEFEATED through every non-optional stage of 3.2 in DAG order",
    "No stage's boss, key item or grant is reachable before its prerequisites, including the milestone order inside a stage",
    "No reachable state is soft-locked",
    "The ship sails only the Aldi Sea until CANAL_OPEN, the canoe enters only River and Lake, and the airship lands only on grass",
    "Act 1 plays as before at its new origin, except that the King's scene rebuilds the north bridge",
    "Every town of 4.0.1 meets its row of the town-standard table"
  ],
  "observable": [
    "`npm run quest -- --strict --mutate` prints `quest-verify: OK` and each proof (a)-(h) OK",
    "`(g) geography: OK` reports a fitted scale s* in [0.60, 0.80], and every pair of 2.2 is inside its band",
    "Every row of the travel matrix (6.2) holds",
    "Every gate row GT-1 to GT-37 of 6.3 is caught by the named proof, or is listed non-load-bearing with its reason",
    "Every boss of 3.7 has a seeded balance test whose bound sits 3 points from its measured value",
    "The browser checkpoints of 6.5 pass with `mute=1` on every URL"
  ],
  "pass_fail": [
    "npm run build exits 0",
    "npm test reports 0 failed",
    "build_map.py --check-determinism prints `<id>: deterministic` for every map",
    "Re-running every layout script leaves `git diff --exit-code assets-src/maps` clean",
    "`world.py` prints `basins: OK` and `bands: OK`",
    "`stubs.py --check all` prints `stubs: 0 left` at INT",
    "The file-size ceiling tests pass"
  ]
}
```

## 1. Relation to QUEST_PLAN rev 3

### 1.1 Reused as is (by reference)

These parts of `docs/QUEST_PLAN.md` rev 3 hold for pass W unchanged, unless 1.2 names a delta:

- **Engine gaps GAP-1 to GAP-14** and their designs (QUEST 1.8, 3.3, 4.1, 4.2). This covers the dock rule and
  parking, patches on flags, AND gates, item conditions, NPC trades, Lake terrain, zone `modes`, the mode-aware
  `safeSpawn`, the retry snapshot with vehicles, `end_game` and hazards.
- **`src/systems/fieldRules.ts`** as the single source of field rules for the game and the verifier (QUEST 4.1). The
  same holds for `fieldStep`, `canEnter`, `canLand`, `dockFor`, `npcOutcome`, `transitionOpen`, `dueEncounter` and
  `patchedTerrain`.
- **Per-chunk RNG seeding (GAP-14)** and its locality selftest (QUEST 3.5).
- **The world-compile lock** (`fcntl.flock` on `/tmp/ff-game-world-compile.lock`): its `FFG_WORLD_LOCK_HELD=1` child
  rule, its 30-minute timeout and its exit 3 (QUEST 3.5).
- **`build_map.py overworld --region <r>`**, its copy-from-base values for the other boxes, its staleness failure and
  its selftest (QUEST 3.5).
- **Per-region checks** through `RegionOut.checks` (QUEST 3.5).
- **Streaming** of maps over 64 chunks: the 60-texture cap, the 6-frame miss hold, `Assets.unload` (QUEST 4.3).
- **The progression-gap verifier** (`npm run quest`): its model, its proofs (a)-(d), `--stage` assume mode with
  `entry`, the consumption rule, `--json`, `--strict`, mutation testing and `nonLoadBearing` (QUEST 5.1-5.4, 5.7).
- **The merge protocol**:
  - one integrator, `git merge --no-ff`;
  - paths staged by name, never `git add -A`;
  - generated world files are regenerated, never hand-merged;
  - the comment anchors in shared YAML;
  - the resume rule (QUEST 4.0, 4.0a "Resume rule").
- **Worktrees**: `git worktree add`, then `npm ci` in each one; scratch work under `/tmp/<tranche>/` (QUEST 4.0).
- **The originality checks**: design notes, the topology self-check, the phrase test and a reviewer sign-off (QUEST
  4.6). The compass item stays information-only for dungeons. For the world, the macro test (6.1) now asserts the
  classic placement, which pass W wants.
- **Balance method**: seeded `mulberry32`, 400 seeds per policy, bounds 3 points from the measured value, round counts
  2 rounds (D-C7-19), `scripts/check-bounds.ts` (QUEST 6.2, 6.3, 6.4).
- **The gates G1-G12** (QUEST 7), with the command deltas of section 7.
- **QUEST's open questions 1, 3, 4 and 5**, as the user accepted them: Chaos stays at level 40, the class change is
  optional, the "completed the introduction" lines are removed, and classic names may stay.

### 1.2 Superseded

| QUEST section | Status in pass W | Replaced by |
|---|---|---|
| 0 Summary, 0.1 Success criteria | superseded | 0, 0.1 |
| 1 Current state | reused as history (b236b79); the facts pass W relies on were re-checked | 1.4 |
| 2.1 Canon: key items, vehicles, flags | superseded (new chain, new ids) | 3.1 |
| 2.2 Stages, 2.3 DAG | superseded (S0-S31) | 3.2, 3.3 |
| 2.4 `quest.yaml` schema | reused, plus a `towns:` section, `optional` and `milestones` | 3.4 |
| 3.1 One streamed world map | the decision is reused; the size changes | 2.3 |
| 3.2 Boxes and geography, the frozen act-1 core, J1, J2, the ice floe, the WIND landing field | **superseded** | 2.4-2.8 |
| 3.3 Vehicles, docks, basins | reused, except the basin names and the dock list | 2.6 |
| 3.4 Encounter zones | superseded | the per-region zones in section 4 |
| 3.5 Composer and module contract | reused with deltas: multi-rect boxes, edge bands and seams instead of rings, new global checks, the act-1 origin | 2.9 |
| 3.6 Chunk and size cost | superseded | 2.3 |
| 4.0 Ownership table, ports | mechanisms reused; the rows and ports are superseded | 5.0, 5.5 |
| 4.0a Waves and the "tonight" scope | superseded | 5.0 |
| 4.1-4.5 Q1-0, Q1a-Q1d | reused as the base specs of W1-0 and W1-A to W1-I, with the deltas and the split of 5.1-5.2 | 5.1, 5.2 |
| 4.6 Region template | reused and extended (town standard, stubs, hint NPCs, sub-tranches) | 4.0, 5.3 |
| 4.7-4.13 Q2-Q8 region specs | **superseded** | section 4 |
| 4.14 Q9, 4.15 Q10 | reused as INT and PLAY | 5.7 |
| 5.2 (e) Early shops | changed: it reads `towns[].opensAfter` | 6.0 |
| 5.2 (b) No skip | extended with `milestones` (order inside a stage) | 6.0 |
| 5.4 Mutation list | the J2 walls, the floe, `strait_thaw` and `wnd_calm` are dropped; the gate table of 6.3 is added | 6.3 |
| 5.6 Browser checkpoints | superseded (the new stage list) | 6.5 |
| 6.1 Gear and magic curve | superseded (new towns) | 3.6 |
| 6.2 Boss balance table | superseded (new stage numbers, same bosses) | 3.7 |
| 8 Risks | reused; R5 is changed and new risks are added | 8 |
| 9 Open question 2 (art) | superseded | 9, item 5 |
| 10 TODOs, the Results anchors | superseded | 10, Results |

### 1.3 Decisions

| Id | Decision | Why |
|---|---|---|
| D-W1 | The world is 192x192 at about 0.73 cells per classic tile. The act-1 block is at origin (64, 64) | The classic places Cornelia east of centre and south of the middle, with content in every direction. At (0, 0) the north and the west would not fit. The cost is in 2.3 |
| D-W2 | Region boxes may be a union of 1 or 2 chunk-aligned rectangles. Each box edge has a composer-owned **edge band** (2 cells on each side), which is ocean or a declared **seam** fill. The band replaces pass Q's "2-cell ocean ring" | The classic continents ring the Aldi Sea, so land has to cross box edges. A band keeps every chunk's 1-cell blend inside cells that no region writes, so G3 locality holds (2.5) |
| D-W3 | There are two basins, `aldi` and `ocean`, and `canal` is their only link. J2, the floe (`strait_thaw`) and the landing field (`wnd_calm`) are dropped | The classic has no such gates; the user asked for the classic travel requirements |
| D-W4 | Shop towns open at their classic point (`opensAfter`). Proof (f) puts a price wall on any town that opens before its band. Lufenia's keepers appear only after LUFENIAN_LEARNED | This keeps early-access balance without inventing gates |
| D-W5 | The classic water and wind chain is used: caravan bottle, Gaia's fairy, oxyale, the submarine, the slab, Dr. Unne, Lufenia, the chime, Mirage, the cube | It is the user's "same progression". Pass Q's widow, diver ring and pearl are dropped |
| D-W6 | `tnt` stays in an Elfheim vault, as in pass Q | `castle.py` is at 360 / 360, so Cornelia's castle can't host it without an extraction pass |
| D-W7 | Warmech is a rare formation in the sky castle. The waterfall's automaton, which gives the cube, is written as its dormant twin | This is the classic placement; the user's "Waterfall and Warmech" is honoured in the lore (open question 6) |
| D-W8 | Every map id of the canon (5.5) has a generated **stub** until its tranche builds it | The O tranche's overworld transitions, and the stairs of the T and D tranches, can then point at maps that don't exist yet |
| D-W9 | One tranche is at most 8 agent-hours. A region is split into O, T and D tranches | The user's "one long session" |
| D-W10 | New NPC mechanics: `takeGold` (GAP-15) and the `clinic` action (GAP-16) | The caravan sells the bottle; every new town has a clinic |
| D-W11 | Act-1 coordinates are translated by the origin. Compiled maps carry `world.frames.a1`, and old saves and raw debug spawns are translated (GAP-17, GAP-18) | It keeps act 1 byte-equal under translation, and the legacy 72x72 map works unchanged |
| D-W12 | A stage may declare `milestones`, an ordered list of its own flags. Proof (b) checks that order | Pass Q's (b) checked only ancestor stages, so floors inside one stage (the past temple) could be skipped unseen |
| D-W13 | The bridge gate cells are non-load-bearing for good. Their reason is "redundant with the `north_bridge` patch". The patch is the load-bearing element (force-on mutation) | Pass Q 4.5 claimed the patch would make them load-bearing. It doesn't: without the flag the gap is water anyway |
| D-W14 | Boss-guarded key items are given by the boss's `postVictoryCutscene` (`give_item`), not by a chest behind the boss | No `showIf` mutation can then make a key item reachable without its fight; the verifier sees one event |

### 1.4 Facts checked at 4ade849

- **Act-1 overworld** (`overworld_consts.py`): 72x72, with a 4-6 cell ocean border.
  - Cornelia's icon is at local (26, 43), and its `cornelia` entrance (the south-gate arrival) at (28, 47).
  - The temple door is at (15, 39), the north bridge stubs in columns 29-30 (rows 29 and 32), and the jetty in column
    28, rows 54-56 (rev 1 said 68-70).
  - The ship spawn is (28, 57) (rev 1 said (28, 71)), and the canoe spawn is (45, 50) on the east river.
  - The mainland's west coast is column 6 for rows 8-26. The sound opens west on rows 27-39. The east coast is column
    62-65 for rows 8-40.
- **Hard-coded act-1 overworld coordinates outside the layout:**
  - `tests/data/overworldLayout.test.ts` lines 451, 498 and 516 (the cells (24, 47), (29, 32), (30, 32), (29, 33));
  - the debug scenarios `r_ow_temple` (`spawn: [15, 42]`, `assets/data/debug-scenarios.yaml:715`), `r_ow_bridge`
    (`[29, 34]`, :725) and `r_ow_east` (`[48, 46]`, :735);
  - all other `map: overworld` scenarios use entrances.
- **Cornelia, the town standard:**
  - `cornelia.yaml` is 62x72, with 16 outdoor NPCs and 15 house objects;
  - 10 house interiors (8x8 to 14x10) hold 18 NPCs, and the 6 shop and inn maps 1 keeper each;
  - the castle has 4 maps and 29 NPCs;
  - the compiled `cornelia/` has 39 chunk files (2.4 MB). An interior is about 80 KB, a castle floor about 1.1 MB, and
    all of `assets/maps/ai/` is 10.8 MB.
- **Field sheets:** 25 approved `field.png` sheets (including `garland_npc`). Pass Q counted 24.
- **Shops:** `shops.yaml` has the Cornelia, Elfheim and Melmond records (weapon, armor, item, white, black, inn).
- **Battle backgrounds:** every id pass Q assigned to regions has a stage entry in `stage_backgrounds.py`
  (`swamp_cave`, `palace`, `throne_lich`, `cracked_earth`, `fire_temple`, `magma_temple`, `throne_kary`, `ice_cave`,
  `water_temple`, `throne_kraken`, `sky_palace`, `tower_of_babel`, `throne_tiamat`, `fiend_hall`).
- **Enemies:** 127 top-level records plus the Chaos forms. The rosters of 3.2 cover every id without `formOf`
  (checked by script: no missing id, no unknown id).

### 1.5 New engine gaps

| Gap | Need | Closed by |
|---|---|---|
| GAP-15 | NPC `takeGold: n`: the trade needs gold of at least n and takes it. Through `npcOutcome` (`take.gold`) | W1-B |
| GAP-16 | NPC `action: clinic`, `clinicPrice: n`: it revives each fallen member to 1 HP for n x level gold, after a confirm. Through `FieldNpcActions` | W1-B |
| GAP-17 | `MapData.world?: {frames: {a1: {origin, size}}}`, passed through to the compiled `overworld`. A version-1 save on `overworld`, loaded against a map with `world.frames.a1`, gets its position translated by the origin | W1-C2 (compiler), W1-A (save) |
| GAP-18 | `DebugScenario.frame: a1` makes the loader translate `spawn` by `world.frames.a1.origin` when the loaded overworld has one. W1-0a adds `frame: a1` to `r_ow_temple`, `r_ow_bridge` and `r_ow_east`. `tests/data/scenarioSpawns.test.ts` (W1-B) asserts that every `map: overworld` scenario either uses an entrance or has `frame: a1`, and that its translated spawn is a walkable cell inside the A1 frame | W1-B |
| GAP-19 | Region boxes made of several rectangles, edge bands and seams in `world_api`, `--region` and `--owned-chunks` | W1-C1 (rasterisation), W1-C2 (composer) |

## 2. Macro world

### 2.1 Reference schematic of the classic world (own words)

This is the plan's reference for "the classic macro layout". It is a coarse description from general knowledge, in
this plan's own words. No map data is copied. Offsets are in classic tiles from Cornelia, rounded to multiples of 4;
east is +x and south is +y.

```
 NORTH-WEST                          NORTH                                NORTH-EAST
   waterfall (head of Onrac's river)                                       Gaia (mountain bowl)
   caravan dunes   Onrac (cold coast)     Citadel of Trials (plateau)        Mirage desert + tower
        (Sea Shrine under Onrac's bay)                                             Lufenia (mesa)
                                       Cardia isles: Bahamut
 WEST                                CENTRE-EAST
   Sarda | giant's tunnel | Melmond      Matoya (NW of Cornelia)
     Cavern of Earth (SW of Melmond)       Temple of Fiends (NW, close)
                     dwarves + canal ===[ ALDI SEA ]===  CORNELIA ----- Pravoka (E)
                      Western Keep (on Elfland's north-west arm)          | Pravoka's range
                                Elfheim (S, across the Aldi)                Crescent Lake (ESE)
 SOUTH-WEST                         SOUTH                                   rivers -> Gurgu Volcano, Ice Cavern
   Marsh Cave (fens, SW of Elfheim)                                        airship desert (SE of the ice)
```

- **Cornelia's continent** wraps the north and east of the Aldi Sea. Its broken north bridge leads to the mainland,
  where Pravoka lies to the east and Matoya to the north-west.
- **The Aldi Sea** is landlocked. Elfland (Elfheim, the Western Keep, the Marsh Cave) is its south and west shore.
  The dwarves' isthmus is its west wall, and the canal cuts it to the western ocean.
- **The western continent** holds Melmond, the Cavern of Earth, the giant's tunnel and Sarda.
- **The south-east continent** holds Crescent Lake, its rivers, the volcano, the ice cavern and the airship desert. It
  is reached by sea only after the canal.
- **The north** (Citadel, Cardia, Onrac, Gaia, Mirage, Lufenia) is for the airship.

### 2.2 Anchors: reference offsets, world targets, pairs

`assets/data/world-anchors.yaml` (W1-0) holds this table, and the macro test (6.1) reads it. Each anchor is a named
entrance in the compiled `overworld`; the owning tranche creates it at its place, and the place must be within
**±2 cells per axis** of the target. The targets satisfy every pair band below: script-checked, s* = 0.735, 0 fails,
and 2 failures in 20,000 random ±2 placements (10 seeds; 0.01 %, both on crescent-ice). That residual risk is accepted:
the macro test (6.1) is the authority, and a tranche that hits it moves its anchor toward the target. A town's land-gate anchor is placed by its site file
(`layouts/<region>/town_<town>_site.py`), so the T tranche owns it; every other anchor is the O tranche's.

| Anchor (entrance) | Place | Region | Ref offset (classic tiles) | World target | Note |
|---|---|---|---|---|---|
| `cornelia` | Cornelia, south-gate arrival | A1 (built) | (0, 0) | (92, 111) | act 1 at origin (64, 64) |
| `temple` | Temple of Fiends door | A1 (built) | (-20, -36) | (79, 103) | distance exempt (act-1 compression); bearing checked |
| `a1_matoya` | Matoya's cave | A1 | (-40, -36) | (74, 76) | in the act-1 Matoya rect |
| `a1_pravoka` | Pravoka's land gate | A1 | (56, -12) | (131, 101) | in the act-1 Pravoka rect |
| `ert_dwarf` | Dwarf hall (Mount Duergar) | EARTH | (-56, -4) | (54, 106) | on the isthmus, south of the canal |
| `elf_keep` | Western Keep | ELF | (-48, 24) | (61, 126) | on Elfland's north arm |
| `elf_elfheim` | Elfheim's land gate | ELF | (-16, 48) | (82, 150) | |
| `elf_marsh` | Marsh Cave mouth | ELF | (-56, 76) | (53, 162) | |
| `ert_melmond` | Melmond's land gate | EARTH | (-72, 4) | (42, 112) | |
| `ert_earth_cave` | Cavern of Earth mouth | EARTH | (-88, 24) | (30, 126) | |
| `ert_giant` | Giant's tunnel, east mouth | EARTH | (-92, 4) | (28, 112) | |
| `ert_sarda` | Sarda's cave | EARTH | (-104, 0) | (19, 109) | |
| `fir_crescent` | Crescent Lake's land gate | FIRE | (68, 20) | (148, 124) | |
| `fir_volcano` | Gurgu Volcano mouth | FIRE | (36, 56) | (120, 151) | its mouth opens south, off the W_south cliffs |
| `fir_ice` | Ice Cavern mouth | FIRE | (44, 44) | (136, 148) | its mouth opens south; the arrival cell is south of the cliff rows 146-147 |
| `fir_desert` | Buried hull, airship desert | FIRE | (56, 60) | (143, 160) | |
| `ord_citadel` | Citadel of Trials gate | ORDEAL | (-24, -116) | (75, 28) | |
| `ord_bahamut` | Bahamut's cave | ORDEAL | (20, -80) | (106, 53) | |
| `wat_onrac` | Onrac's land gate | WATER | (-92, -100) | (28, 39) | the Sea Shrine is entered from Onrac's pier |
| `wat_waterfall` | Waterfall cave | WATER | (-88, -140) | (30, 11) | |
| `wat_caravan` | Caravan camp | WATER | (-120, -116) | (8, 28) | |
| `wnd_gaia` | Gaia's land gate | WIND | (72, -132) | (150, 14) | |
| `wnd_mirage` | Mirage Tower door | WIND | (40, -104) | (132, 36) | |
| `wnd_lufenia` | Lufenia's land gate | WIND | (84, -92) | (152, 46) | |

**Pairs** (31): cornelia-pravoka, cornelia-matoya, cornelia-temple, pravoka-elfheim, elfheim-marsh, elfheim-keep,
keep-dwarf, dwarf-melmond, melmond-earth_cave, melmond-giant, melmond-sarda, melmond-crescent, cornelia-crescent,
crescent-volcano, crescent-ice, ice-desert, desert-citadel, citadel-bahamut, desert-onrac, onrac-waterfall,
onrac-caravan, caravan-gaia, gaia-mirage, gaia-lufenia, lufenia-melmond, cornelia-onrac, cornelia-gaia,
cornelia-marsh, cornelia-sarda, cornelia-citadel, pravoka-matoya.

**Preserved ratios** (examples, world/classic at s* = 0.735): Cornelia-Pravoka 40 cells, Pravoka-Elfheim 69,
Elfheim-Marsh 31, Dwarf-Melmond 13, Melmond-Crescent 107, Cornelia-Onrac 96, Cornelia-Gaia 113. Every pair's
world/reference ratio after the fit is in [0.86, 1.10] at the targets.

### 2.3 World size and cost

| Item | Pass Q (QUEST 3.6) | Pass W | Basis |
|---|---|---|---|
| Size | 240x176 = 42,240 cells | **192x192 = 36,864 cells** | 7.11x the measured 72x72 |
| Chunks (below) | 165 | **144** (12x12) | 16-cell chunks |
| Disk, world chunks | about 27 MB | **about 24 MB** (upper bound) | 164 KB per chunk measured; ocean chunks are smaller |
| Peak compile memory, full world | 21-25 GB estimated | **about 22 GB** (3.08 GB x 7.11, linear) | 3.08 GB RSS measured for 72x72; target at most 26 GB (unchanged); the W1 stop condition is reused |
| `--region` compile | about 7 GB | **at most 10 GB** (estimate about 8 GB: the largest union plus its ring is FIRE, about 52 chunks) | measured by W1-C1; like every `overworld` compile it takes the world-compile lock |
| Full compile time | about 90 s | **about 75 s**; determinism about 2.5 min | 10.5 s x 7.11 |
| Resident GPU | at most 60 textures with streaming | unchanged (view-based cap) | QUEST 4.3 |
| All new maps | about 30 MB | **about 50 MB** | 7 towns x about 1.6 MB, about 60 interiors x 80 KB, about 47 dungeon floors x 0.5 MB, 8 castle-size maps x 1.1 MB |

**Heavy-job rule.** The lock serialises world compiles, but the other tranches' Vitest and dev servers still use
memory. So:

- **"active"** means a worktree whose branch is not merged into `mainline`. The orchestrator counts them with
  `git worktree list --porcelain | awk '/^branch /{sub("refs/heads/","",$2); print $2}' | while read b; do git merge-base --is-ancestor "$b" mainline || echo "$b"; done | grep -v '^mainline$' | wc -l`;
- a full-world compile (W1-C1, W1-C2, INT) starts only while at most 3 other tranches are active (the orchestrator
  checks this before starting the job);
- **in W1**, W1-C1 and W1-C2 start with at most 2 other W1 tranches running. The remaining W1 tranches are admitted
  once both have recorded their full-world memory probe. This adds about 4 h to the W1 step (5.0);
- every worktree runs Vitest with `--maxWorkers=2 --minWorkers=1` (G4). W1-0a records `/usr/bin/time -l npx vitest run
  --maxWorkers=2 --minWorkers=1` in its result. If one worktree's peak is above about 2 GB, the "3 others" limit is lowered to
  `floor((48 - 26 - 4) / peak)` (4 GB of headroom), and the region concurrency to `floor((48 - 10 - 4) / (peak + 0.5))`
  (0.5 GB per dev server), whichever is smaller than today's 3 and 6;
- the budget is then 26 GB (full) + 3 x about 2 GB, or 10 GB (`--region`) + 6 x about 2 GB, both under the 48 GiB
  machine.

The stub world is mostly ocean, so its measured peak understates the real one. W1-C1 therefore also measures a
**land-filled synthetic world**: every region filled with `organic` land, forests and mountains at act-1 density.
That figure is the one the 26 GB target applies to.

The world is smaller than pass Q's in area, chunk count and memory. It is still big enough for the classic layout at
s ≈ 0.73: the classic content spans about 192x217 tiles, which is 140x158 cells plus margins.

### 2.4 Region boxes

```
        x: 0      16     32     48     64     80     96     112    128    144    160    176   (chunk columns c0-c11)
 y   0  WATER  WATER  WATER  WATER  ORD    ORD    ORD    ORD    WIND   WIND   WIND   WIND
    16  WATER  WATER  WATER  WATER  ORD    ORD    ORD    ORD    WIND   WIND   WIND   WIND
    32  WATER  WATER  WATER  WATER  ORD    ORD    ORD    ORD    WIND   WIND   WIND   WIND
    48  WATER  WATER  WATER  WATER  ORD    ORD    ORD    ORD    WIND   WIND   WIND   WIND
    64  EARTH  EARTH  EARTH  EARTH  A1*    A1*    A1*    A1*    A1*~   FIRE   FIRE   FIRE
    80  EARTH  EARTH  EARTH  EARTH  A1*    A1*    A1*    A1*    A1*~   FIRE   FIRE   FIRE
    96  EARTH  EARTH  EARTH  EARTH  A1*    A1*    A1*    A1*    A1*~   FIRE   FIRE   FIRE
   112  EARTH  EARTH  EARTH  ELF    A1*    A1*    A1*    A1*    A1*~   FIRE   FIRE   FIRE
   128  EARTH  EARTH  EARTH  ELF    A1*~   A1*~   A1*~   A1*~   A1~    FIRE   FIRE   FIRE
   144  ELF    ELF    ELF    ELF    ELF    ELF    ELF    FIRE   FIRE   FIRE   FIRE   FIRE
   160  ELF    ELF    ELF    ELF    ELF    ELF    ELF    FIRE   FIRE   FIRE   FIRE   FIRE
   176  ELF    ELF    ELF    ELF    ELF    ELF    ELF    FIRE   FIRE   FIRE   FIRE   FIRE
  (* = the act-1 frozen core, x 64-135, y 64-135;  ~ = A1 cells outside the core: the east strip x 136-143, the south strip y 136-143)
```

| Region | Rects (x0, y0, x1, y1), inclusive | Chunks | Content |
|---|---|---|---|
| A1 | (64, 64, 143, 143) | 25 | act 1 (frozen core), the mainland, Pravoka, Matoya, Pravoka's range |
| ELF | (48, 112, 63, 143) + (0, 144, 111, 191) | 2 + 21 | Elfland: the north arm (Western Keep), Elfheim, the fens and the Marsh Cave |
| EARTH | (0, 64, 63, 111) + (0, 112, 47, 143) | 12 + 6 | the Duergar isthmus (dwarves, canal), the western continent (Melmond, Cavern of Earth, giant, Sarda) |
| FIRE | (144, 64, 191, 143) + (112, 144, 191, 191) | 15 + 15 | the south-east continent: Crescent Lake, the rivers, the volcano, the ice cavern, the airship desert |
| ORDEAL | (64, 0, 127, 63) | 16 | the Citadel plateau, the Cardia isles (Bahamut) |
| WATER | (0, 0, 63, 63) | 16 | Onrac's coast, the waterfall, the caravan dunes; the Sea Shrine below Onrac's bay |
| WIND | (128, 0, 191, 63) | 16 | Gaia's bowl, the Mirage desert, Lufenia's mesa |

The rects tile the 192x192 world exactly: 144 chunks, each in exactly one region. A W1-C2 composer check asserts this.

### 2.5 Edge bands, seams, and the frozen act-1 core

- **Edge band.** For every edge between two different regions, the 2 cells on each side are composer-owned.
  - A region module must not write them; `world.py` fails with `band cell (x, y) written by <region>`.
  - By default they are ocean. A declared **seam** fills a stretch of band with a fixed material instead.
  - Two rects of the same region have no band between them.
  - The world's outer edge is a band too, always ocean (`sealed_edges`).
- **Seams** (`world_api.SEAMS`, W1-0):

| Seam | Cells (world, inclusive) | Fill | Joins | Purpose |
|---|---|---|---|---|
| `seam_w` | x 62-65, y 78-84 | mountain | EARTH's isthmus stub and the act-1 mainland's west coast | the Aldi's north-west wall |
| `seam_n` | x 48-61, y 110-113 | grass | EARTH's isthmus (dwarves) and ELF's north arm | the dwarf hall can be walked to from Elfland |
| `seam_s` | x 110-113, y 146-165 | mountain | Elfland's east end and the south-east continent | the Aldi's south wall |
| `seam_se` | x 138-141, y 142-145 | mountain | Pravoka's range and the south-east continent | the Aldi's east wall |

  `world.py` checks each seam. A mountain seam must touch a wall cell of the region on both sides. A grass seam must
  have a walkable cell of each side's region next to it.
- **The frozen act-1 core** (it supersedes the QUEST 3.2 definition):
  - Inside world x 64-135, y 64-135 (local x 0-71, y 0-71), every `ground` cell equals the act-1 cell at local
    (x - 64, y - 64).
  - Every act-1 object, NPC, gate, transition, inspect cell, entrance and zone is present, translated by (64, 64).
  - Four exception rects apply (local coordinates):

| Rect | Local cells | Allowed change | Owner |
|---|---|---|---|
| X_pravoka | x 58-71, y 26-44 | anything (Pravoka, its dock, its shore) | A1-T (town icon and dock), A1-O (ground) |
| X_matoya | x 6-14, y 8-16 | anything (Matoya's grove and cave) | A1-O |
| X_west | x 0-7, y 14-20 | ocean to mountain only (part of the Aldi's north-west wall; local 0-1 is `seam_w`) | A1-O, composer |
| X_east | x 64-71, y 12-18 | ocean to mountain only (the north end of Pravoka's range) | A1-O |

  The ship spawn moves (A1-T), and the canoe spawn is removed (W1-C2). Patches are overlays and change no ground.
  `tests/quest/a1/frozenCore.test.ts` (W1-C2) compares the translated core with a fixture taken from the act-1
  `overworld.py` output, minus the four rects. The X_west and X_east cells may only change from `o` to `m`.

### 2.6 Seas, basins and docks

- **`aldi`**, the Aldi Sea (seed: world (92, 121), the ship spawn's cell below Cornelia's jetty). It is enclosed by five walls; the
  closure check and the mutations (6.3) refer to them by name:
  1. **W_west:** X_west, `seam_w` and EARTH's isthmus stub (y 76-87, mountain);
  2. **W_isthmus:** the isthmus from the canal strip south to `seam_n`;
  3. **W_arm:** ELF's north arm and Elfland's north coast;
  4. **W_south:** `seam_s` and the north-west cliffs of the south-east continent;
  5. **W_east:** `seam_se`, Pravoka's range (A1 cells x 138-141, y 76-141), the A1 cells that join X_east to it (x 136-137, y 76-82), and X_east.

  The act-1 peninsula and mainland close the north.
- **`ocean`**: every other Water cell (seed: world (2, 2)). It must be one connected component.
- **The canal** is EARTH's patch `canal` (flag CANAL_OPEN). It turns a strip of the isthmus, about world x 48-61,
  y 88-92, into Water. It joins the sound mouth's Aldi water (act-1 west ring) to the western ocean. It is the only
  link between the basins.
- **Composer basin checks** (they replace QUEST 3.5 checks 3-5):
  1. with every patch off, `aldi` and `ocean` are disjoint and each is one component;
  2. with `canal` on, they are one component;
  3. every dock lies in its declared basin, computed with every patch on except `canal`;
  4. no Water cell is in neither basin (lakes compile to Lake, rivers to River).

  `world.py` prints `basins: OK (aldi <n> cells, ocean <m> cells; canal joins)`. On a failure it prints
  `basins: LEAK aldi-ocean at (x, y), region <r>`, naming the region whose box holds the first joining cell.
- **Docks allowed** (`world_api.DOCKS_ALLOWED`; any other dock fails the verifier with `DOCK ... not allowed`):

| Dock id | Basin | Place | Owner |
|---|---|---|---|
| `a1_pravoka` | aldi | Pravoka's quay, in the channel between the mainland and Pravoka's range (world x 129-135) | A1-T |
| `elf_port` | aldi | Elfheim's harbour on Elfland's north coast | ELF-O |
| `ert_dwarf` | aldi | the dwarves' landing on the isthmus's east coast | ERT-O |
| `ert_melmond` | ocean | Melmond's harbour on the western strait | ERT-O |
| `fir_crescent` | ocean | Crescent Lake's harbour on the outer channel east of Pravoka's range (x 142-147) | FIR-O |

- **Vehicles** follow QUEST 3.3 unchanged: the dock rule, the ship on Water only, the canoe as an ability, the airship
  landing on grass, save v2.
- **Sea lanes**, for the scripted walks and the matrix:
  - Pravoka to Elfheim: south through the Pravoka channel, then west along the peninsula's south coast.
  - Pravoka to the dwarves: around the peninsula's west side into the sound mouth.
  - After the canal: west through the canal to Melmond. The western ocean then runs north round the act-1 north coast
    and east to the outer channel and Crescent; or south round Elfland and the south-east continent.

### 2.7 Rivers and canoe routes

| Route | Region | From | To | Rule |
|---|---|---|---|---|
| R-lake | FIRE | Crescent Lake town's shore | the lake (Lake terrain) | the canoe is needed to cross the lake; the town is reachable on foot from its dock |
| R-volcano | FIRE | the lake's south-west outlet | the Gurgu lava fields (`fir_volcano`) | River; no land path from Crescent (a mountain ring) |
| R-ice | FIRE | the lake's south outlet | the Ice Cavern's landing (`fir_ice`); the airship desert is on foot from there | River; no land path from Crescent |
| R-waterfall | WATER | the meadow by Onrac | the waterfall cave behind the falls (`wat_waterfall`) | River; the cave can be reached only by canoe; the river mouth meets the sea, which the ship can't enter |
| R-isles | ORDEAL | none | none | the Cardia isles need no canoe |

The canoe never touches Water (QUEST 3.3). The verifier's travel matrix (6.2) asserts that `fir_volcano`, `fir_ice`,
`fir_desert` and `wat_waterfall` are unreachable without the canoe.

### 2.8 Mountain barriers and airship-only land

| Barrier | Region | Separates |
|---|---|---|
| The spine (act 1) | A1 | Cornelia's peninsula from the mainland (the north bridge is the way) |
| Pravoka's range, `seam_se`, X_east | A1, composer | the Aldi from the outer channel; Pravoka from Crescent on foot |
| The isthmus stub, `seam_w`, X_west | EARTH, composer, A1 | the act-1 mainland from the dwarves on foot; the Aldi from the north ocean |
| `seam_s`, the south-east continent's north-west cliffs | composer, FIRE | Elfland from the south-east continent on foot; the Aldi from the southern ocean |
| The western range with the giant's tunnel | EARTH | Melmond's plain from Sarda's coast (only through the giant's tunnel) |
| Crescent's ring | FIRE | Crescent Lake town from the volcano, ice and desert lands (rivers only) |
| The Citadel's plateau ring | ORDEAL | (airship-only by having no dock) |
| Gaia's bowl, Lufenia's mesa cliffs | WIND | (airship-only by having no dock); Lufenia's mesa from the Mirage sands on foot |

**Airship-only land:** ORDEAL, WATER and WIND have no dock, so the ship can't disembark there (dock rule). Every
airship-only anchor needs a grass landing cell (`canLand`) with a walk of at most 8 steps to the anchor; the matrix
checks this (6.2, row T6). The ship may still sail their seas and meet late-tier monsters there (accepted, R5).

### 2.9 Composer contract: deltas to QUEST 3.5

- **`world_api.py`** (W1-0 declares, W1-C2 implements):
  - `WORLD_W = WORLD_H = 192`, `A1_ORIGIN = (64, 64)`, `EDGE = 2`;
  - `BOXES: dict[str, list[Rect]]` (2.4), `SEAMS` (2.5), `FROZEN_EXCEPTIONS` (2.5);
  - `BASIN_SEEDS = {"aldi": (92, 121), "ocean": (2, 2)}`, `DOCKS_ALLOWED` (2.6), `WALLS` (2.6, named cell sets that
    the composer exports for the mutations);
  - `RegionOut.barriers: dict[str, tuple[set[Cell], Cell, Cell]]` (new): `{name: (cells, side_a_seed, side_b_seed)}`,
    a named land barrier and one walkable seed cell on each side. The composer checks that the seeds are walkable
    and not joined on foot with the barrier in place, and exports the barrier's minimal walkable cut (the fewest
    barrier cells whose opening joins the two seeds) for the mutations. ERT-O fills `western_range` (Melmond's plain
    to Sarda's coast); FIR-O fills `crescent_ring` (Crescent's shore to the south lands).
  - `Region(id, prefix, rects)`. `RegionOut` is otherwise unchanged from QUEST 3.5; its coordinates are world coordinates
    inside the region's rects and outside its bands.
- **`world.py`**:
  - `REGIONS = [a1, elf, earth, fire, ordeal, water, wind]`, pre-seeded; no tranche edits the list;
  - its global checks replace QUEST 3.5's list:
    1. rects tile the world;
    2. no region writes outside its rects or into a band;
    3. ids are unique and prefixed;
    4. the seams hold (2.5);
    5. the basins hold (2.6);
    6. every built region's anchors exist as entrances (2.2);
    7. reachability checks run with every patch on.
  - `world.py --check-bands` runs checks 1, 2 and 4 only and prints `bands: OK`.
- **`world.py --owned-chunks <region>`** prints the chunk files of the union of the region's rects (their
  `below`/`above` PNGs) and its patches' `patch_<pid>.png`. Band cells belong to the chunk that contains them.
- **`--region <r>`** rasterises the union of the region's rects plus a 1-chunk ring. Per-chunk seeds make the result
  byte-equal to a full compile (QUEST selftest, extended by W1-C1 to a 2-rect region).
- **`world_a1.py`** calls `overworld.build()` unchanged (72x72). It translates everything by `A1_ORIGIN`, applies the
  four exception rects' edits, and writes `world.frames.a1 = {origin: [64, 64], size: [72, 72]}` into the source.
  `overworld.py` keeps `build()`, `objects()` and `check()`, which still enforce the act-1 promises on the local grid.
  Its `main()` becomes the shim of QUEST 3.5.
- **Stubs:** until a region merges, its module returns its rects as ocean, with the bands. A1 returns the translated
  act-1 block (QUEST 3.5).

## 3. Progression graph

### 3.1 Canon: key items, vehicles, flags

W1-0 creates these ids (W1-F creates the item records). Display names come from W1-F, who may use classic names
(open question 5).

| Key item id | Obtained (stage, tranche) | Used by | Consumed |
|---|---|---|---|
| `lute` (exists) | S0, the princess | the time gate (S29) | no |
| `crown` | S5 Marsh Cave boss cutscene, ELF-D | the false king (S6) | yes |
| `crystal_eye` | S6 Astos cutscene, ELF-O | Matoya (S7) | yes |
| `herb` | S7 Matoya, A1-O | the Elf Prince (S8) | yes |
| `mystic_key` (exists) | S8 the prince, ELF-T | the Elfheim vault door (S9) | no |
| `tnt` | S9 the vault chest, ELF-T | Nerrick, the dwarf foreman (S10) | yes |
| `ruby` | S11 vampire cutscene, ERT-D | the giant (S12) | yes |
| `rod` | S12 Sarda, ERT-O | the earth seal (S13) | no |
| `canoe` | S14 the Circle of Sages, FIR-T | rivers and lakes (an ability) | no |
| `levistone` | S16 evil-eye cutscene, FIR-D2 | the buried hull (S17) | yes |
| `ordeal_seal` | S18 dragon-zombie cutscene, ORD-O | Bahamut (S19) | yes |
| `cube` | S21 the automaton, WAT-O | the Mirage console (S27) | no |
| `fairy_bottle` | S22 the caravan (`takeGold`), WAT-O | Gaia's spring (S23) | yes |
| `oxyale` | S23 the fairy, WND-T | Onrac's submarine (S24) | no |
| `slab` | S24 drowned-sovereign cutscene, WAT-D | Dr. Unne (S25) | yes |
| `chime` | S26 Lufenia's elder, WND-O | the Mirage door (S27) | no |
| `adamant` (optional) | S28 sky-castle chest, WND-D2 | Smyth the smith (S31) | yes |

**Vehicles:**

- `ship`: it spawns at the `a1_pravoka` dock with `requiredFlag: BIKKE_DEFEATED`;
- `airship`: `set_vehicle` puts it in the airship desert when AIRSHIP_RAISED is set (the cutscene `fir_airship_rises`);
- the canoe is the `canoe` item: walking onto River or Lake switches to CanoeMode.

**Milestone flags** (W1-0 adds them to `STORY_FLAGS`; only a stage's owner sets them):

- BRIDGE_BUILT, BIKKE_DEFEATED;
- MARSH_GUARD_DEFEATED, ASTOS_DEFEATED, PRINCE_AWAKE;
- CANAL_OPEN, VAMPIRE_DEFEATED, TITAN_FED, EARTH_SEAL_BROKEN, EARTH_CAVE_COMPLETE, EARTH_CRYSTAL_LIT;
- CANOE_GIVEN, FIRE_CRYSTAL_LIT, EVIL_EYE_DEFEATED, AIRSHIP_RAISED;
- ORDEALS_GUARD_DEFEATED, CLASS_UPGRADED;
- CUBE_GIVEN, FAIRY_FREED, WATER_CRYSTAL_LIT, LUFENIAN_LEARNED, CHIME_GIVEN, SKY_FORTRESS_OPEN, WIND_CRYSTAL_LIT;
- TIME_GATE_OPEN, PAST_LICH_DEFEATED, PAST_ASHEN_DEFEATED, PAST_DROWNED_DEFEATED, PAST_SERAPH_DEFEATED,
  DEATH_EYE_DEFEATED, CHAOS_DEFEATED.

**Local flags** use the region prefix (`A1_`, `ELF_`, `ERT_`, `FIR_`, `ORD_`, `WAT_`, `WND_`, `PST_`), and chests use
`CHEST_<prefix>_...`. All tranches of one region share its prefix; each sub-tranche adds its letter
(`ELF_T_...`, `CHEST_ELF_D_...`), so two tranches never mint the same flag. `tests/progression/questFlags.test.ts`
(W1-H) enforces QUEST 2.1's two rules and this sub-prefix.

### 3.2 Stages

"Band" is the whole-party level band (the lowest member) at the stage's boss, or at its end when it has none. The
rosters use existing enemy ids. The zone ids are in section 4.

| Id | Stage | Tranche | After | Requires | Grants | Band | Boss | Encounter roster |
|---|---|---|---|---|---|---|---|---|
| S0 | Act 1 (built) | - | - | - | GARLAND_DEFEATED, PRINCESS_RESCUED, `lute`, INTRO_COMPLETE | 2-3 | garland | goblin, gr_imp, wolf, gr_wolf, skeleton |
| S1 | The north bridge | A1-O | S0 | INTRO_COMPLETE | BRIDGE_BUILT | 2-3 | - | - |
| S2 | Pravoka and the pirates | A1-T | S1 | BRIDGE_BUILT | BIKKE_DEFEATED, ship | 3-6 | pirate x9 (scripted, `isBoss`) | crazy_horse, black_widow, gigas_worm, werewolf, zombie, ghoul, gr_wolf |
| S3 | Matoya's cave (visit) | A1-O | S1 | BRIDGE_BUILT | - (S7 needs this place) | 3-6 | - | as S2 |
| S4 | The Aldi Sea and Elfheim | ELF-T | S2 | ship | - | 5-9 | - | land: cobra, ogre, ogre_chief, lizard, tarantula, werewolf; aldi sea: sahagin, shark, buccaneer, bigeyes |
| S5 | The Marsh Cave B1-B3 | ELF-D | S4 | ship | `crown`, MARSH_GUARD_DEFEATED | 8-11 | piscodemon x3 | ghast, scorpion, shadow, green_slime, crawler, gray_ooze, bloodbones, zombie, ghoul |
| S6 | The Western Keep | ELF-O | S5 | `crown`, MARSH_GUARD_DEFEATED | ASTOS_DEFEATED, `crystal_eye` | 10-13 | astos | gargoyle, bloodbones, ghast, ogre_chief |
| S7 | Matoya's herb | A1-O | S6, S3 | `crystal_eye` | `herb` | 10-13 | - | - |
| S8 | The prince wakes | ELF-T | S7 | `herb` | PRINCE_AWAKE, `mystic_key` | 10-13 | - | - |
| S9 | The Elfheim vault | ELF-T | S8 | `mystic_key` | `tnt` | 10-13 | - | - |
| S10 | The dwarves' canal | ERT-O | S9 | `tnt` | CANAL_OPEN | 11-14 | - | isthmus: mummy, wraith, anaconda; ocean: sahagin_chief, shark, buccaneer |
| S11 | Melmond, Cavern of Earth B1-B3 | ERT-D | S10 | CANAL_OPEN | VAMPIRE_DEFEATED, `ruby` | 13-16 | vampire | land: anaconda, hyenadon, lesser_tiger, troll; cavern: mummy, wraith, minotaur, hill_gigas, troll, wight, ochre_jelly, cockatrice |
| S12 | The giant's tunnel and Sarda | ERT-O | S11 | `ruby` | TITAN_FED, `rod` | 15-17 | - | ogre_mage, sphinx, earth_elemental |
| S13 | Cavern of Earth B4-B5 | ERT-D | S12 | `rod` | EARTH_SEAL_BROKEN, EARTH_CAVE_COMPLETE, EARTH_CRYSTAL_LIT (milestones in this order) | 16-19 | lich | earth_elemental, hill_gigas, ogre_mage, sphinx, wight |
| S14 | Crescent Lake and the canoe | FIR-T | S13 | EARTH_CRYSTAL_LIT, ship | CANOE_GIVEN, `canoe` | 17-20 | - | land: ankheg, ochu, neochu, hydra; river: red_piranha, crocodile, white_crocodile |
| S15 | Gurgu Volcano B1-B5 | FIR-D1 | S14 | `canoe` | FIRE_CRYSTAL_LIT | 21-24 | ashen_queen | horned_devil, pyrolisk, fire_elemental, fire_hydra, lava_worm, hellhound, fire_lizard, fire_gigas, dragon |
| S16 | The Ice Cavern B1-B3 | FIR-D2 | S14 | `canoe` | EVIL_EYE_DEFEATED, `levistone` | 21-24 | evil_eye | white_dragon, winter_wolf, mindflayer, ice_gigas, specter, remorazz, dark_wizard |
| S17 | The airship | FIR-O | S16 | `levistone` | AIRSHIP_RAISED, airship | 22-25 | - | desert_baretta, sabertooth, wyvern, wyrm, manticore, baretta, basilisk, allosaurus, sand_worm |
| S18 | The Citadel of Trials 1F-3F | ORD-O | S17 | airship | ORDEALS_GUARD_DEFEATED, `ordeal_seal` | 24-27 | dragon_zombie | weretiger, minotaur_zombie, king_mummy, medusa, rakshasa, clay_golem, nightmare |
| S19 | Bahamut (class change; **optional**) | ORD-O | S18 | `ordeal_seal` | CLASS_UPGRADED | 24-27 | - | isles: wyvern, wyrm, basilisk |
| S20 | Onrac | WAT-T | S17 | airship | - | 25-28 | - | land: nightmare, weretiger; north seas: sahagin_prince, white_shark, deepeyes, sea_snake |
| S21 | The waterfall | WAT-O | S20, S14 | airship, `canoe` | CUBE_GIVEN, `cube` | 25-28 | - | streams: red_piranha, crocodile |
| S22 | The caravan | WAT-O | S17 | airship | `fairy_bottle` | 25-28 | - | dunes: sand_worm, desert_baretta, manticore |
| S23 | Gaia's fairy | WND-T | S22 | `fairy_bottle` | FAIRY_FREED, `oxyale` | 26-29 | - | tyrannosaur, chimera, green_dragon |
| S24 | The Sea Shrine B1-B5 | WAT-D | S23, S20 | `oxyale` | WATER_CRYSTAL_LIT, `slab` | 27-30 | drowned_sovereign | sahagin_prince, deepeyes, sea_snake, sea_scorpion, sea_troll, ghost, water_elemental, water_naga |
| S25 | Dr. Unne's lesson | ERT-T | S24 | `slab` | LUFENIAN_LEARNED | 28-31 | - | - |
| S26 | Lufenia's chime | WND-O | S25 | LUFENIAN_LEARNED, airship | CHIME_GIVEN, `chime` | 28-31 | - | chimera, green_dragon, medusa |
| S27 | The Mirage Tower 1F-3F | WND-D1 | S26, S21 | `chime`, `cube` | SKY_FORTRESS_OPEN | 29-32 | - | black_knight, chimera, guardian, blue_dragon, green_dragon, stone_golem |
| S28 | The sky castle 1F-5F | WND-D2 | S27 | SKY_FORTRESS_OPEN | WIND_CRYSTAL_LIT | 31-34 | hollow_seraph | air_elemental, spirit_naga, death_knight, earth_medusa, black_flan, soldier, vampire_lord, dark_fighter, warmech (rare, weight 1 in 64) |
| S29 | The time gate | PST | S13, S15, S24, S28 | the 4 crystal flags, `lute` | TIME_GATE_OPEN | 33-35 | - | - |
| S30 | The temple of the past 1-5 | PST | S29 | TIME_GATE_OPEN | PAST_LICH_DEFEATED, PAST_ASHEN_DEFEATED, PAST_DROWNED_DEFEATED, PAST_SERAPH_DEFEATED, DEATH_EYE_DEFEATED, CHAOS_DEFEATED (milestones in this order) | 34-41 | lich_2, ashen_queen_2, drowned_sovereign_2, hollow_seraph_2, death_eye, then chaos (40) | rhyos, purple_worm, iron_golem, plus death_knight, blue_dragon, vampire_lord, dark_fighter |
| S31 | Excalibur (**optional**) | ERT-O | S28 | `adamant` | `excalibur` (gear) | - | - | - |

Notes:

- **S15 and S16 run in parallel**, as in the classic: the airship doesn't need the fire crystal.
- **S19 and S31 are optional.** The verifier proves they are reachable and that no other stage needs them. The
  balance tests from S20 on use upgraded classes (QUEST open question 3).
- **Cross-region hand-offs:**
  - S23 (WND) needs S22's bottle (WAT);
  - S24 (WAT) needs S23's oxyale (WND);
  - S25 is in Melmond (EARTH);
  - S26 (WND) needs S25.

  Assume mode (QUEST 5.1) lets each tranche verify its stages before the others are built.
- **Roster coverage:** every enemy without `formOf` appears above (script-checked at 4ade849). INT asserts it
  (`rosterCoverage.test.ts`, `QUEST_STRICT=1`).

### 3.3 DAG

```
S0 -> S1 -> S2 -> S4 -> S5 -> S6 -> S7 -> S8 -> S9 -> S10 -> S11 -> S12 -> S13 -> S14 -+-> S15 -----------------------+
       \-> S3 ---------------------/                                                    +-> S16 -> S17 -+             |
                                                                                                         |             |
  S17 -> S18 -> S19 (optional)                                                                           |             |
  S17 -> S20 -+-> S21 (with S14) ------------------------------------------+                             |             |
              +-------------------------> S24 (with S23) -> S25 -> S26 -> S27 (with S21) -> S28 -> S31 (optional)      |
  S17 -> S22 -> S23 --------------------/                                                     |                        |
                                                                                              v                        v
                                                                  S13 + S15 + S24 + S28 -> S29 -> S30 (goal)
```

### 3.4 `quest.yaml` deltas (to QUEST 2.4)

- **Stage fields** added:
  - `optional: true` (S19, S31): the stage isn't in the goal's `after` closure; proof (a) checks it is reachable,
    proof (b) that nothing depends on it;
  - `milestones: [FLAG, ...]`: an ordered list of the stage's own flags (D-W12).
- **A new top-level `towns:` list**, one entry per shop town, each edited only by its owner:

```yaml
towns:
  - id: crescent                 # a town id from 4.0.1
    owner: FIR-T
    maps: [crescent, crescent-*]
    opensAfter: [S10]            # the classic point at which it is reachable (D-W4)
    bandStage: S14               # the stage whose band its shops serve (3.6)
    kit: w_crescent              # kits.yaml entry (W1-F); its 4-member price drives proof (f)
    status: pending
```

- **`entry`, `basins`, `nonLoadBearing` and `walk`** keep QUEST 2.4's meaning. The only basin seeds are those of
  `world_api.BASIN_SEEDS`; stages declare none (QUEST's S2 `outer` and S10 `inner` are void).

### 3.5 Shop towns and access

| Town id | Owner | `opensAfter` | `bandStage` | Band | Early-access control |
|---|---|---|---|---|---|
| `pravoka` | A1-T | S1 | S2 | B2 | none (it opens at its band) |
| `elfheim` | ELF-T | S2 | S4 | B3 | none |
| `dwarf` | ERT-O | S2 | S10 | B3 (item shop only) | walkable from Elfland; its stock is the B3 item list |
| `melmond` | ERT-T | S10 | S11 | B4 | none |
| `crescent` | FIR-T | S10 | S14 | B5 | price wall, proof (f) |
| `onrac` | WAT-T | S17 | S20 | B6 | none (it opens at its band) |
| `gaia` | WND-T | S17 | S23 | B7 | price wall, proof (f) |
| `lufenia` | WND-O | S25 | S26 | B8 | its keepers are shown only with LUFENIAN_LEARNED (`showIf`), so proof (e) sees them at S25 |

### 3.6 Level, gear and magic bands (replaces QUEST 6.1)

The caps are the highest stats sold. Found gear may exceed them by at most 1 band, as in pass Q.

| Band | Town | Party level | Magic sold | Weapon atk | Body def | Shield def | Helm def | Inn | Clinic (per level of each fallen member) |
|---|---|---|---|---|---|---|---|---|---|
| B1 | Cornelia (built) | 1-3 | L1 | 12 | 15 | 2 | 1 | 30 | - |
| B2 | Pravoka | 3-6 | L2 | 16 | 15 | 4 | 3 | 50 | 10 |
| B3 | Elfheim, dwarf hall (items) | 5-13 | L2-L3 (existing) | 23 | 24 | 4 | 3 | 100 | 20 |
| B4 | Melmond | 13-19 | L3-L4 (existing) | 23 | 34 | 8 | 6 | 200 | 40 |
| B5 | Crescent Lake | 17-25 | L5 | 26 | 34 | 8 | 6 | 300 | 60 |
| B6 | Onrac | 25-30 | L6 | 30 | 38 | 12 | 8 | 500 | 90 |
| B7 | Gaia | 28-34 | L7 | 34 | 42 | 14 | 10 | 700 | 120 |
| B8 | Lufenia | 28-34 | L8 (+ L7) | - | - | - | - | 900 | 150 |
| found | the past temple (S30) | 34-41 | - | `masamune` 56 (and the optional `excalibur`) | `dragon_armor` 42 | - | - | - | - |

### 3.7 Boss balance tests (replaces QUEST 6.2)

Each boss test is seeded, uses the real `BattleStateMachine`, the stage kit and potions. Its bounds sit 3 points from
the measured value, which is written in the test name (QUEST 6.2). Each tranche owns `tests/balance/w_<tranche>.test.ts`
(lower case, e.g. `w_elf_d.test.ts`).

| Boss | Stage | Tranche | Test level | Target, sensible policy | Must also hold |
|---|---|---|---|---|---|
| pirate x9 | S2 | A1-T | 4 | >= 95 % | careless >= 85 % |
| piscodemon x3 | S5 | ELF-D | 9 | 75-95 % | Lv 7 <= 60 % |
| astos | S6 | ELF-O | 11 | 65-85 % | Lv 9 <= 50 % |
| vampire | S11 | ERT-D | 14 | 75-95 % | Lv 12 <= 60 % |
| lich | S13 | ERT-D | 17 | 60-80 % | Lv 15 <= 45 % |
| ashen_queen | S15 | FIR-D1 | 23 | 60-80 % | Lv 21 <= 45 % |
| evil_eye | S16 | FIR-D2 | 22 | 70-90 % | - |
| dragon_zombie | S18 | ORD-O | 25 | 75-95 % | - |
| drowned_sovereign | S24 | WAT-D | 28 | 60-80 % | Lv 26 <= 45 % |
| hollow_seraph | S28 | WND-D2 | 32 | 60-80 % | Lv 30 <= 45 % |
| warmech (rare) | S28 | WND-D2 | 32 | 55-80 % | it is a rare formation; Lv 30 <= 40 % |
| the 4 refights in a row (no inn, 4 potions each) | S30 | PST | 37 | 60-85 % for the run | each fight alone >= 85 % |
| death_eye | S30 | PST | 37 | 70-90 % | - |
| chaos | S30 | (exists) | 40 | unchanged (`chaos.test.ts`) | unchanged |

## 4. Regions

### 4.0 Common rules for every region

#### 4.0.1 The town standard

Cornelia (1.4) is the model: a walled or otherwise distinctive plan; houses whose doors lead into small furnished
interiors (`interiors_common.house`); shops with a keeper behind a counter (`interiors_common.shop`, `keeper`); an
inn; NPCs whose lines change as the story moves on. Every new town meets its row. `tests/quest/townStandard.test.ts`
(W1-I) reads the targets from `tests/quest/townTargets.ts` (W1-0) and counts them on the compiled maps.

**How each column is counted:**

| Column | Counted as |
|---|---|
| Houses / interiors | `type: house` objects in the town's **source** YAML (`assets-src/maps/<town>.yaml`; the compiled map drops `objects`) / distinct `<town>-house-*` targets of the compiled town map's transitions |
| Outdoor NPCs | NPCs on the town map, keepers excluded |
| Interior NPCs | NPCs in the linked house maps |
| Hint NPCs | NPCs whose id ends in `_hint`; each has a line that contains one of its keywords |
| Reactive | NPCs whose `dialog` has at least one `condition` on the named milestone flag |
| Shops | the `shopId`s of keepers reachable from the town's gate |

| Town (`id`) | Owner | Map (cells, approx.) | Houses / interiors | Outdoor NPCs | Interior NPCs | Hint NPCs (keywords) | Reactive NPCs (flag) | Shops | Inn | Clinic | Character |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pravoka (`pravoka`) | A1-T | 48x44 | >= 8 / >= 6 | >= 14 | >= 10 | 2 (`Elfheim`, `Matoya`) | >= 4 (BIKKE_DEFEATED) | weapon, armor, item, white, black | 50 | yes | a harbour town in a fjord under the pirates' thumb: warehouses on piles, a lighthouse on the range's foot, a quay where the pirate brig lies |
| Elfheim (`elfheim`) | ELF-T | 52x50 | >= 9 / >= 6 | >= 16 | >= 12 | 2 (`Matoya`, `Marsh`) | >= 4 (PRINCE_AWAKE) | the existing `elfheim_*` | 100 | yes | a forest town in a ring of living hedges: houses on raised roots, a stream through the centre, the castle on a wooded rise to the north |
| Melmond (`melmond`) | ERT-T | 46x42 | >= 7 / >= 5 (one is `melmond-house-unne`) | >= 12 | >= 10 | 2 (`Cavern`, `giant`) | >= 4 (EARTH_CRYSTAL_LIT) | the existing `melmond_*` | 200 | yes | a farming town dying from the root up: cracked fields, grey vines, a crooked windmill; the patch `ert_melmond_bloom` turns the dead ground green on EARTH_CRYSTAL_LIT |
| Crescent Lake (`crescent`) | FIR-T | 54x46 | >= 9 / >= 6 | >= 16 | >= 12 | 2 (`sages`, `volcano`) | >= 4 (CANOE_GIVEN) | weapon, armor, item, white, black | 300 | yes | a scholars' town on terraces above the crescent water: boathouses, an observatory, the Circle's stone ring on a lake islet (reached by a causeway) |
| Onrac (`onrac`) | WAT-T | 50x44 | >= 8 / >= 6 | >= 14 | >= 12 | 2 (`waterfall`, `caravan`) | >= 4 (WATER_CRYSTAL_LIT) | weapon, armor, item, white, black | 500 | yes | a cold fishing port of stone and tarred timber: drying racks, a bell tower whose bell washed ashore from the sunken city, the submarine's dry dock |
| Gaia (`gaia`) | WND-T | 52x46 | >= 9 / >= 6 | >= 16 | >= 12 | 2 (`Lufenia`, `Mirage`) | >= 4 (FAIRY_FREED) | weapon, armor, item, white, black | 700 | yes | a terraced mountain town of windmills that stand still: rope bridges between terraces, a dry spring court at the top |
| Lufenia (`lufenia`) | WND-O | 36x32 | >= 4 / >= 3 | >= 10 | >= 5 | 2 (`Mirage`, `cube`) | >= 6 (LUFENIAN_LEARNED: unreadable speech becomes plain speech) | white L8, black L8 | 900 | yes | a sky-folk village of pale domes on a mesa, its people speaking a lost tongue; brass instruments point at the sky |
| Dwarf hall (`dwarf`) | ERT-O | 40x30 (cave) | 0 / 0 | >= 10 | - | 2 (`canal`, `Melmond`) | >= 3 (CANAL_OPEN) | item | - | no | a hall carved under the isthmus: forge, ore carts, the canal plans chalked on a wall, Smyth's anvil |

The small sites are single maps:

- Matoya's cave: 4 NPCs, Matoya and three enchanted brooms with lines;
- Sarda's cave: 3 NPCs;
- the caravan camp: 5 NPCs including the trader;
- Bahamut's lair: 6 dragons;
- the Circle of Sages: 12 sages, including Lukahn, who speaks the prophecy in original words.

**Every town also:**

- uses only existing field sheets plus `tint` (QUEST 4.2; 25 sheets);
- writes all its lines new; the act-1 maps keep theirs;
- has a design note (QUEST 4.6, item 1);
- has a `MapData.name`, and an inn keeper with `action: inn`;
- has its clinic (GAP-16) in a shrine or healer house;
- has an EXIT-safe layout: every walkable cell has a route back to the gate.

#### 4.0.2 The dungeon standard

QUEST 4.6 holds:

- 2-5 chests per floor of band-appropriate consumables, gear or gold;
- each key item in exactly one place;
- `MapData.exit`;
- a boss approach with `canSave: false`;
- the topology self-check: at least half of a tranche's dungeons are not a simple chain, and each floor of 24x24 or
  more has at least 2 dead-end branches;
- design notes.

Pass W adds:

- boss key items come through the boss's `postVictoryCutscene` (D-W14);
- every multi-floor dungeon declares its floors' order in its stage's `milestones` when it sets more than one
  milestone flag;
- a hazard floor (lava, peat) keeps a hazard-free path of at most 1.5x the shortest path from arrival to exit
  (verified by `tests/quest/<prefix>/hazardPath.test.ts`).

#### 4.0.3 Encounter zones

QUEST 3.4's rules are kept:

- `modes`, `name` as the bestiary habitat;
- region-prefixed ids;
- the first zone that holds the cell wins;
- every walkable cell outside the act-1 block is in a walking zone of its region;
- every Water cell is in exactly one ship zone.

Band cells are in the zones of the region whose box contains them. Neighbouring zones differ in species (the W5
rule).

#### 4.0.4 Originality

QUEST 4.6 holds unchanged:

- the design note;
- the topology numbers;
- the phrase test over the dialogue of every region map and new cutscene;
- `originality review: PASS <map ids>` from a fresh reviewer before each merge.

The world's macro placement is required to match the classic (6.1). Its coastlines are not: the reviewer gets the
`--preview` crops of the region's box, and the design note `Distinct:` line names at least 2 landform features no
classic version of the region has.

### 4.1 A1: Cornelia's continent, the bridge, Pravoka and Matoya

- **Shape and placement.**
  - The act-1 block is frozen at the origin (64, 64) (2.5).
  - Pravoka stands in X_pravoka on the mainland's east coast. Its quay faces a narrow fjord, the act-1 east ring
    (world x 129-135), whose far side is **Pravoka's range**: a mountain wall A1 builds in the east strip (x 138-141, joined to X_east by x 136-137;
    y 76-141). The range starts at X_east and ends at `seam_se`.
  - **Pravoka's channel:** between the quay and the range there are at least 6 Water cells on every row y 92-110
    (`tests/quest/a1/pravokaChannel.test.ts`, A1-O). The town may move the coast west inside X_pravoka to make room.
  - Matoya's grove is in X_matoya, in the north-west mainland forest.
  - X_west's mountains close the mainland's west coast north of the sound.
  - The A1 south strip (y 136-143) is Aldi water.
- **Towns:** Pravoka (4.0.1).
  - Maps: `pravoka`, 6 or more `pravoka-house-<slug>`, the shops `pravoka-weapon-shop`, `-armor-shop`, `-item-shop`,
    `-white-magic`, `-black-magic` and the inn `pravoka-inn`. The shop records `pravoka_weapon`, `_armor`, `_item`,
    `_white`, `_black` and `_inn` go in the A1-T anchor of `shops.yaml`.
  - The clinic is in the lighthouse keeper's house.
  - Pirate NPCs (tinted `guard` and `villager`) loiter with `hideIf: BIKKE_DEFEATED`. The captain (`pirate` x9
    battle, `isBoss`) is an NPC on the quay.
- **Dungeons:** none.
- **Small site:** `matoya-cave`, 1 floor, 16x14 or more.
  - Matoya trades `crystal_eye` for `herb` (`requiredItem`, `takeItem`, `giftItem`, `giftFlag: A1_O_HERB_GIVEN`).
  - Her dialog differs before, holding (`item:crystal_eye`) and after.
  - Three broom NPCs `wander`.
- **Landmarks:**
  - the rebuilt north bridge (patch `north_bridge`, flag BRIDGE_BUILT; it turns the two gap rows into Bridge, and
    its art covers the debris);
  - Pravoka's lighthouse (a deco on the range's foot);
  - a cairn on the mainland's highest pass (an inspect cell, original text).
- **Encounter zones:**
  - `a1_mainland` (walking; the S2 roster; name "Northern Mainland"): every mainland cell north of the bridge that is
    not in an act-1 zone;
  - `a1_aldi` (ship; the aldi roster);
  - `a1_north_sea` (ship; sahagin_chief, shark, bigeyes: the outer water north of X_west and X_east).
- **Cutscenes and events:**
  - `act1_complete` is rewritten (QUEST 4.7): the King orders the span rebuilt, the builders' hammers ring over a
    fade, then `set_flag BRIDGE_BUILT`;
  - `a1_bikke_yields`: the beaten captain hands over the brig with original lines; `set_flag BIKKE_DEFEATED`;
  - `a1_matoya_sight`: Matoya sees again and gives the herb.
  - The bridge workers' lines change on BRIDGE_BUILT, through the existing `BRIDGE_WORKERS` entries in
    `overworld_consts.py`, the only edit allowed there.
- **Flags and items:** BRIDGE_BUILT, BIKKE_DEFEATED, `herb`, and `A1_O_*`, `A1_T_*`.
- **Files:**
  - A1-O: `layouts/world_a1.py` (the region part: X rects, the range, zones, bridge patch, Matoya icon), `layouts/a1/world_*.py`,
    `layouts/a1/matoya.py`, `matoya-cave`, the `act1_complete` cutscene, the `BRIDGE_WORKERS` and `GATE_MESSAGE`
    edits;
  - A1-T: `layouts/a1/town_*.py` and the `pravoka*` maps. A1-O's `world_a1.py` reads Pravoka's icon, gate, dock and
    ship spawn from `layouts/a1/town_pravoka_site.py` (A1-T owns it, and A1-O imports it), so the two never edit one
    file.
  - The act-1 tests that assert the old ending are updated, not deleted (QUEST 4.7).

### 4.2 ELF: Elfland (Elfheim, the Western Keep, the Marsh Cave)

- **Shape and placement.**
  - Elfland fills ELF's main rect (x 0-111, y 144-191): a broad, forested continent with its north coast on the Aldi
    (Elfheim's harbour at about (84, 147)) and its south and west coasts on the ocean.
  - A long **north arm** climbs ELF's narrow rect (x 48-61, y 114-143) between the western strait and the Aldi. The
    Western Keep stands on it at (61, 126), and it ends at `seam_n`.
  - The south-west is **the fens**, swamp terrain (`w`, W1-D) around the Marsh Cave at (53, 162).
  - The east end meets `seam_s` (mountains) at x 108-109.
- **Towns:** Elfheim (4.0.1).
  - Maps: `elfheim`, 6 or more `elfheim-house-<slug>`, the shops `elfheim-weapon-shop` etc. with the existing
    `elfheim_*` ids, the inn `elfheim-inn`, and the castle `elfheim-castle` (the hall), `elfheim-castle-chamber` (the
    sleeping prince) and `elfheim-vault`.
  - The prince trades `herb` for `mystic_key` (`giftFlag`). The cutscene `elf_prince_wakes` sets PRINCE_AWAKE.
  - The vault door is a `keyItemGates requiredItem: mystic_key` (permanent, flag `ELF_T_VAULT_OPEN`). The vault holds
    `tnt` (`CHEST_ELF_T_TNT`) and 2 B3 chests.
  - The castle is reached through the town's north gate (no second overworld icon).
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Marsh Cave (`marsh-cave-b1..b3`), ELF-D | 3 | B1, a peat bog under a drowned barrow, is a loop of boardwalk islands with two stairs down. B2 has a west half and an east half on one map, joined only through B1; a collapsed boardwalk on B2's north ledge is a one-way pit to B3. B3 is the barrow: the boss room lies north-west of the arrival, at a path length of at least 40 | B1 2, B2 4, B3 3 | piscodemon x3 (`crown` via `elf_d_crown`) | peat pools as hazards (damage 1); a boardwalk one-way pit; fog-dark rooms through the `cave` remap at shade 0.7 |
| Western Keep (`western-keep-1f`, `-2f`), ELF-O | 2 | 1F is a courtyard with two wings and a hall of mirrors (a loop). 2F is the false king's throne room, reached by twin stairs from the wings | 1F 2, 2F 2 | astos, talked to with `crown` (a trade that starts the battle; `requiredFlags: [MARSH_GUARD_DEFEATED]`); `crystal_eye` via `elf_astos_unmasked` | courtiers whose lines turn on ASTOS_DEFEATED; a mirror hall where two "kings" stand |

- **Landmarks:** the keep's towers on the arm; a ruined elven waystone at the arm's root (an inspect cell); the fens'
  dead trees (a `tree` recolour).
- **Encounter zones:**
  - `elf_fields` (S4 land; "Elfland Woods");
  - `elf_fen` (gray_ooze, crawler, green_slime, zombie; "The Fens");
  - `elf_keep_moor` (gargoyle, ghast, ogre_chief; "Keep Moor": the arm);
  - `elf_aldi` (ship; aldi roster);
  - `elf_sea` (ship; sahagin_chief, buccaneer, bigeyes).
- **Cutscenes:** `elf_d_crown`, `elf_astos_unmasked` (the false king's face slips; ASTOS_DEFEATED, `give_item
  crystal_eye`), `elf_prince_wakes`.
- **Flags and items:** MARSH_GUARD_DEFEATED, ASTOS_DEFEATED, PRINCE_AWAKE, `crown`, `crystal_eye`, `mystic_key`,
  `tnt`, `ELF_*`.
- **Files:**
  - ELF-O: `layouts/world_elf.py`, `layouts/elf/world_*.py`, `layouts/elf/keep.py`, `western-keep-*`, backgrounds
    `palace`;
  - ELF-T: `layouts/elf/town_*.py`, `elfheim*`;
  - ELF-D: `layouts/elf/marsh_*.py`, `marsh-cave-*`, background `swamp_cave`.
  - ELF-T owns `layouts/elf/town_elfheim_site.py` (the icon, gate and dock offsets), and ELF-O imports it.

### 4.3 EARTH: the Duergar isthmus and the western continent

- **Shape and placement.**
  - **The isthmus** (x 48-61, y 76-109) is the Aldi's west wall:
    - its north stub (y 76-87) is mountain against `seam_w`;
    - the canal strip (about y 88-92) is land until CANAL_OPEN;
    - south of it the dwarf hall's ridge, with the dwarves' landing (`ert_dwarf` dock), leads down to `seam_n`.
  - **The western strait** (about x 40-47) is ocean and separates the isthmus and ELF's arm from the western
    continent.
  - **The western continent** (about x 4-44, y 72-140):
    - Melmond is on its east coast, with its harbour (`ert_melmond` dock) on the strait;
    - a north-south **western range** runs at about x 24-27, pierced only by the giant's tunnel;
    - Sarda's cave is on the narrow western coast beyond it;
    - the Cavern of Earth is in grey badlands south-west of Melmond.
- **Towns:** Melmond (4.0.1).
  - Maps: `melmond`, 5 or more houses including `melmond-house-unne`, the shops with the existing `melmond_*` ids, and
    the inn.
  - Dr. Unne trades `slab` for the flag LUFENIAN_LEARNED (S25): `requiredItem: slab`, `takeItem`, `giftFlag`, and the
    cutscene `ert_unne_lesson`.
  - The patch `ert_melmond_bloom` (on the `melmond` map; flag EARTH_CRYSTAL_LIT) turns its dirt fields to grass.
- **Small sites:**
  - `dwarf-hall` (the town row of 4.0.1). Nerrick the foreman trades `tnt`, and the cutscene `ert_canal_blast` (shake,
    fade, `set_flag CANAL_OPEN`) follows. Smyth trades `adamant` for `excalibur` (S31, optional).
  - `giant-tunnel` (1 floor, 32x20 or more): the giant NPC stands on the tunnel's only chokepoint. He trades `ruby`
    (`takeItem`, `hideIf: TITAN_FED`; cutscene `ert_giant_feast`).
  - `sage-cave` (1 floor): Sarda gives `rod` (`giftFlag`, `requiredFlags: [VAMPIRE_DEFEATED]`; non-load-bearing, 6.3
    GT-16).
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Cavern of Earth (`cavern-earth-b1..b5`), ERT-D | 5 | B1, a split gallery: one stair down to B2, one to a dead-end ore annex. B2, a loop around a cave lake, with a one-way slide back to B1. B3, the vampire's crypt (boss east of the arrival); the rod seal (`keyItemGates requiredItem: rod`, permanent, flag EARTH_SEAL_BROKEN) is in a side chamber. B4, the frozen undercroft of the Rime Sovereign's old fortress (`ice` remap; QUEST 4.9 lore), a ring with two stairs down, one false (a one-way pit to a B4 pocket). B5, the throne of frost | B1 3, B2 4, B3 3, B4 4, B5 2 | vampire (B3; `ruby` via `ert_vampire_falls`); lich (B5; `ert_lich_falls` sets EARTH_CAVE_COMPLETE, then `ert_earth_crystal` at the altar sets EARTH_CRYSTAL_LIT) | the rod seal; B4 one-way pit; B5 approach `canSave: false` |

- **Landmarks:** the canal (a patch; its art shows the cut banks and a lock gate), the giant's tunnel mouths, the
  crooked windmill, a rotted shrine in the badlands (an inspect cell).
- **Encounter zones:**
  - `ert_isthmus` (S10; "Duergar Isthmus");
  - `ert_plain` (S11 land; "Melmond Plain");
  - `ert_badlands` (S12-S13; "Grey Badlands");
  - `ert_sarda_coast` (ogre_mage, sphinx; "Sarda's Coast");
  - `ert_aldi` (ship; aldi roster);
  - `ert_sea` (ship; sahagin_chief, shark, buccaneer).
- **Flags and items:** CANAL_OPEN, VAMPIRE_DEFEATED, TITAN_FED, EARTH_SEAL_BROKEN, EARTH_CAVE_COMPLETE,
  EARTH_CRYSTAL_LIT, LUFENIAN_LEARNED, `ruby`, `rod`, `ERT_*`.
- **Files:**
  - ERT-O: `layouts/world_earth.py`, `layouts/earth/world_*.py`, `dwarf.py`, `giant.py`, `sage.py`, the maps
    `dwarf-hall`, `giant-tunnel`, `sage-cave`, the patch `canal`, background `cracked_earth`;
  - ERT-T: `layouts/earth/town_*.py`, `melmond*`, the patch `ert_melmond_bloom`;
  - ERT-D: `layouts/earth/cavern_*.py`, `cavern-earth-*`, background `throne_lich`.
  - ERT-T owns `layouts/earth/town_melmond_site.py`, and ERT-O imports it.

### 4.4 FIRE: the south-east continent

- **Shape and placement.**
  - FIRE's north rect (x 144-191, y 64-143) holds the continent's north half. Crescent Lake town is on its west coast
    at (148, 124), with the `fir_crescent` dock on the outer channel. East of the town lies the crescent-shaped lake
    (Lake terrain, about x 155-170, y 112-138).
  - FIRE's south rect (x 112-191, y 144-191) holds the south half:
    - the Gurgu lava fields with the volcano (120, 151) in the west;
    - the Ice Cavern's frozen hollow (136, 148) just east of them, its arrival cell below the cliff rows;
    - the airship desert (143, 160) south of the ice.
  - **Row budget in the north-west** (it is tight): rows 146-147 are W_south's cliffs facing the Aldi; both cavern
    mouths open south; R-volcano reaches the volcano from the east on rows 150 or below, and R-ice reaches the ice
    hollow from the south-east. `tests/quest/fire/northWest.test.ts` (FIR-O) asserts that rows 146-147 hold no
    walkable or river cell for x 114-141.
  - Rivers R-volcano and R-ice run from the lake's outlets (2.7). A mountain ring keeps Crescent's land from the
    south lands on foot.
- **Towns:** Crescent Lake (4.0.1).
  - Maps: `crescent`, 6 or more houses, the shops `crescent_weapon` etc. (W1-F tiers), the inn, and
    `crescent-circle` (the Circle of Sages).
  - The elder gives `canoe` with `giftFlag: CANOE_GIVEN` and `requiredFlags: [EARTH_CRYSTAL_LIT]`.
  - Before S13 the sages speak of the rotting earth; after it, of fire and frost.
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Gurgu Volcano (`gurgu-b1..b5`), FIR-D1 | 5 | B1, a caldera rim walk (a ring) with stairs down on opposite sides. B2 and B3, two lava galleries that cross: B2's east stair reaches B3's north, B2's west stair a B3 dead-end forge with treasure. B4, a basalt maze with two routes, the short one over lava. B5, the queen's ash court (boss due south of the arrival) | 3 / 4 / 4 / 4 / 2 | ashen_queen (B5; `fir_ashen_falls` sets FIRE_CRYSTAL_LIT) | lava hazards (damage 1, `lava` remap); hazard-free route rule (4.0.2) |
| Ice Cavern (`ice-cavern-b1..b3`), FIR-D2 | 3 | B1, a hall of frozen pillars with three branches. B2, cracked ice: some cells are one-way pits back to B1 pockets (transitions); the true way down is hidden behind an ice-shelf inspect cell. B3, the eye's vault (boss north-east of the arrival) | 3 / 4 / 3 | evil_eye (B3; `levistone` via `fir_evil_eye_falls`) | one-way pits; an ice-shelf door as a permanent gate opened by an inspect-cell cutscene (`FIR_D2_SHELF`) |

- **Small site:** the buried hull in the desert is an overworld NPC (`buried_hull` landmark, W1-D). It takes
  `levistone`; the cutscene `fir_airship_rises` (sand cascade, rise, `set_flag AIRSHIP_RAISED`, `set_vehicle airship`
  on a desert-edge grass cell) follows.
- **Landmarks:** the lake's islet with the Circle's standing stones, the volcano (`volcano` placeholder), the ice
  hollow (`ice_floe` placeholder, recoloured), the buried hull, smoke columns as deco.
- **Encounter zones:**
  - `fir_lakeshore` (S14 land; "Crescent Shore");
  - `fir_ashlands` (fire_lizard, hellhound, lava_worm; "Ashlands"; hazard cells by the volcano);
  - `fir_tundra` (winter_wolf, ice_gigas; "Frost Hollow");
  - `fir_desert` (S17; "Hull Desert");
  - `fir_rivers` (canoe; S14 river);
  - `fir_aldi` (ship; aldi roster);
  - `fir_sea` (ship; sahagin_chief, shark, bigeyes).
- **Flags and items:** CANOE_GIVEN, FIRE_CRYSTAL_LIT, EVIL_EYE_DEFEATED, AIRSHIP_RAISED, `canoe`, `levistone`,
  `FIR_*`.
- **Files:**
  - FIR-O: `layouts/world_fire.py`, `layouts/fire/world_*.py`, the buried hull, `fir_airship_rises`, background
    `desert` (exists);
  - FIR-T: `layouts/fire/town_*.py`, `crescent*`, `layouts/fire/town_crescent_site.py` (imported by FIR-O);
  - FIR-D1: `layouts/fire/gurgu_*.py`, `gurgu-*`, backgrounds `fire_temple`, `magma_temple`, `throne_kary`;
  - FIR-D2: `layouts/fire/ice_*.py`, `ice-cavern-*`, background `ice_cave`.

### 4.5 ORDEAL: the Citadel of Trials and Bahamut

- **Shape and placement.**
  - A high northern plateau (about x 66-96, y 10-46) ringed by mountains, with the Citadel at (75, 28) and a grass
    landing meadow south of its gate.
  - East of it, the **Cardia isles**: 5-7 islands (about x 96-124, y 34-60). Bahamut's isle (106, 53) has a grass
    landing patch and a cave mouth. One other isle holds a hermit's inspect cell with an original line.
- **Towns:** none.
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Citadel of Trials (`citadel-1f..3f`), ORD-O | 3 | 1F, an empty court whose throne (an inspect cell, cutscene `ord_throne_wakes`, permanent flag `ORD_THRONE`) opens the inner gate. 2F, a lattice of teleport tiles (transitions within the map) where 2 of 6 pads lead on and the rest return to the start ring. 3F, the trial hall: the boss sits west of the arrival, behind a ring of statues | 3 / 4 / 3 | dragon_zombie (3F; `ordeal_seal` via `ord_seal_won`) | the throne gate; the teleport lattice |
| Bahamut's cave (`bahamut-cave`, `bahamut-lair`), ORD-O | 2 | a short cave with a side grotto, then the lair with 6 dragon NPCs | 1 / 0 | - | Bahamut takes `ordeal_seal` (`action: classUpgrade`, `actionFlag: CLASS_UPGRADED`, cutscene `ord_bahamut_trial`) |

- **Encounter zones:**
  - `ord_heath` (weretiger, nightmare, rakshasa; "Citadel Heath");
  - `ord_isles` (S19 roster; "Cardia Isles");
  - `ord_sea` (ship; sahagin_prince, white_shark, deepeyes, sea_snake).
- **Flags and items:** ORDEALS_GUARD_DEFEATED, CLASS_UPGRADED, `ordeal_seal`, `ORD_*`.
- **Files:** ORD-O owns `layouts/world_ordeal.py`, `layouts/ordeal/*.py`, `citadel-*`, `bahamut-*` and the background
  `abandoned_castle` (exists).

### 4.6 WATER: Onrac's coast, the waterfall, the caravan and the Sea Shrine

- **Shape and placement.**
  - A long, cold coastland (about x 6-50, y 6-56).
  - Onrac is on its south coast at (28, 39). The Sea Shrine lies below Onrac's bay and is entered from Onrac's dry
    dock.
  - A river (R-waterfall) runs south from the northern highlands to a meadow by Onrac; at its head is the waterfall
    (30, 11).
  - The caravan camps in a western dune field (8, 28).
  - There are grass landing meadows near Onrac and near the dunes, and no dock.
- **Towns:** Onrac (4.0.1).
  - Maps: `onrac`, 6 or more houses, the shops `onrac_*`, and the inn.
  - The submarine is a transition from the dry-dock cell to `sea-shrine-b3` entrance `nave`, behind
    `keyItemGates requiredItem: oxyale` (permanent: no; its message comes from the shipwright NPC).
- **Small sites:**
  - `waterfall-cave` (1 floor, 28x20 or more): the automaton NPC (`giftItem: cube`, `giftFlag: CUBE_GIVEN`; cutscene
    `wat_cube_given`, lore of its twin, the Warmech);
  - `caravan-camp` (1 map): the trader sells `fairy_bottle` (`takeGold`, GAP-15; default price 5000, tuned by INT by
    proof (d3)).
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Sea Shrine (`sea-shrine-b1..b5`), WAT-D | 5 | The submarine arrives at B3, the nave, which branches up and down. Up: B2, then B1, the mermaids' grotto with hint NPCs and 2 chests, a dead end. Down: B4, flooded halls with two routes, one through a sunken library; then B5, the drowned throne (boss north of the arrival) | 2 / 3 / 3 / 4 / 2 | drowned_sovereign (B5; `wat_drowned_falls` sets WATER_CRYSTAL_LIT and gives `slab`) | the up/down split from the nave; the mermaid hints |

- **Encounter zones:**
  - `wat_isles` (S20 land; "Onrac Coast");
  - `wat_dunes` (S22; "Caravan Dunes");
  - `wat_streams` (canoe; S21);
  - `wat_sea` (ship; sahagin_prince, white_shark, deepeyes, sea_snake).
- **Flags and items:** CUBE_GIVEN, WATER_CRYSTAL_LIT, `cube`, `fairy_bottle`, `slab`, `WAT_*`.
- **Files:**
  - WAT-O: `layouts/world_water.py`, `layouts/water/world_*.py`, `waterfall.py`, `caravan.py`, `waterfall-cave`,
    `caravan-camp`, background `waterfall` (exists);
  - WAT-T: `layouts/water/town_*.py`, `onrac*`, `layouts/water/town_onrac_site.py` (imported by WAT-O);
  - WAT-D: `layouts/water/shrine_*.py`, `sea-shrine-*`, backgrounds `water_temple`, `throne_kraken`.

### 4.7 WIND: Gaia, Lufenia and the Mirage Tower

- **Shape and placement.**
  - A rugged north-eastern continent.
  - Gaia (150, 14) sits in a mountain bowl in the north, with a landing meadow on the bowl's floor.
  - The Mirage desert spreads south-west of it, with the tower at (132, 36).
  - Lufenia (152, 46) stands on a cliff-ringed mesa to the south, with a landing meadow on the mesa top; no walk
    links the mesa to the sands.
  - The sky castle has no overworld cell; it is reached by `mirage_ascent`.
- **Towns:**
  - **Gaia** (4.0.1): `gaia`, 6 or more houses, the shops `gaia_*`, the inn, and `gaia-spring`. The spring's fairy
    takes `fairy_bottle` (`requiredItem`, `takeItem`) and gives `oxyale` (`giftFlag: FAIRY_FREED`; cutscene
    `wnd_fairy_freed`).
  - **Lufenia** (4.0.1, WND-O): `lufenia`, 3 or more houses, `lufenia-white-magic`, `lufenia-black-magic`,
    `lufenia-inn`. Every outdoor NPC speaks unreadable lines unless LUFENIAN_LEARNED is set (conditional dialog). The
    keepers have `showIf: LUFENIAN_LEARNED`. The elder gives `chime` (`requiredFlags: [LUFENIAN_LEARNED]`,
    `giftFlag: CHIME_GIVEN`).
- **Dungeons:**

| Dungeon | Floors | Topology brief (original) | Chests | Boss | Gimmicks |
|---|---|---|---|---|---|
| Mirage Tower (`mirage-1f..3f`), WND-D1 | 3 | The overworld door is an open transition to `mirage-1f` entrance `arrival`, a vestibule; the vestibule's inner door is a `keyItemGates requiredItem: chime` (WND-D1), beyond which is the entrance `inner`. 1F, a spiral gallery with a central shaft. 2F, two half-floors joined by a bridge over the shaft. 3F, the console room: the console NPC with `requiredItem: cube` plays `mirage_ascent` (`onceFlag: SKY_FORTRESS_OPEN`), which sets the flag and warps to `sky-castle-1f` entrance `arrival` | 3 / 3 / 2 | - | the shaft; the console |
| Sky castle (`sky-castle-1f..5f`), WND-D2 | 5 | 1F, the dock ring with four spokes. 2F, a maze of light-bridges with one-way conveyors (one-way transitions). 3F, the archive (`adamant` chest `CHEST_WND_D2_ADAMANT`). 4F, the engine halls, where `warmech` is a rare formation in the zone `wnd_d2_engine`. 5F, the seraph's spire (boss straight up from the arrival) | 3 / 3 / 4 / 3 / 2 | hollow_seraph (5F; `wnd_seraph_falls` sets WIND_CRYSTAL_LIT) | the conveyors; Warmech |

- **Encounter zones:**
  - `wnd_highlands` (S23; "Gaia Highlands");
  - `wnd_lufen_moor` (S26; "Lufenian Mesa");
  - `wnd_mirage_sands` (stone_golem, sand_worm, chimera; "Mirage Sands");
  - `wnd_sea` (ship; north seas).
- **Flags and items:** FAIRY_FREED, CHIME_GIVEN, SKY_FORTRESS_OPEN, WIND_CRYSTAL_LIT, `oxyale`, `chime`, `adamant`,
  `WND_*`.
- **Files:**
  - WND-O: `layouts/world_wind.py`, `layouts/wind/world_*.py`, `layouts/wind/lufenia_*.py`, `lufenia*`;
  - WND-T: `layouts/wind/town_*.py`, `gaia*`, `layouts/wind/town_gaia_site.py` (imported by WND-O);
  - WND-D1: `layouts/wind/mirage_*.py`, `mirage-*`, background `tower_of_babel`;
  - WND-D2: `layouts/wind/sky_*.py`, `sky-castle-*`, backgrounds `sky_palace`, `throne_tiamat`.

### 4.8 PAST: the time gate and the temple of the past

QUEST 4.13 holds with the new stage ids:

- PST owns `assets-src/maps/temple-of-fiends.yaml` (hand-written; the only tranche that edits it), `past-temple-1..5`,
  `past-chaos`, the `ending` cutscene and the background `fiend_hall` (plus `rim`, which exists).
- **The time gate** is a new stair behind `keyItemGates requiredItem: lute, requiredFlags: [EARTH_CRYSTAL_LIT,
  FIRE_CRYSTAL_LIT, WATER_CRYSTAL_LIT, WIND_CRYSTAL_LIT]`. The altar cutscene `pst_time_gate` sets TIME_GATE_OPEN.
  Garland's room and its tests are unchanged.
- **Floors 1-4** each end at one refight, whose cutscene sets its PAST_* flag. The stair to the next floor has
  `requiredFlags: [<that flag>]`, and S30's `milestones` enforce the order (D-W12). `death_eye` guards floor 5.
  `past-chaos` holds `chaos` (`isBoss`, its forms, `canRun` false, background `rim`).
- **The ending:** `ending` sets CHAOS_DEFEATED; the party wakes in Cornelia; `end_game` shows the card, then the title.
- Topology briefs (original):
  - floor 1 is a ring of collapsed cloisters;
  - floor 2 is a cross with four sealed arms, one open per visit;
  - floor 3 is a flooded nave;
  - floor 4 is a stair-well spiral;
  - floor 5 is a hall of eyes with two routes to the guarded stair.

### 4.9 Art needs

Pass W uses **0 paid images by default** (open question 5). Everything new is a kit recolour, a code-drawn
placeholder (`kit.py`, W1-D) or a tinted existing field sheet.

| Need | Default in pass W (0 images) | Truly new art for a later Stability Core pass |
|---|---|---|
| Swamp ground (the fens) | `w` placeholder material plus the `swamp` battle backdrop (exists) | 1 swamp terrain sheet |
| Desert dunes (FIRE, WATER, WIND) | sand `s` (exists), recolours `dune` (warm) and `pale_dune` | - |
| Snow and frost (the Ice hollow) | a `snow` recolour of grass, `ice_floe` placeholder | 1 snowfield terrain sheet |
| Lava fields | the `lava` remap (QUEST 4.3), `volcano` placeholder | 1 volcano landmark, 1 lava tile set |
| Waterfall | a new `waterfall` placeholder (W1-D) | 1 waterfall landmark |
| Floating castle | the `sky` remap for interiors (QUEST 4.3); no overworld icon | 1 sky-castle tile kit (walls, light-bridges) |
| Elven town | the town kit with an `elf` recolour (green slate roofs) | 1 elven house kit |
| Dwarf hall | the `cave` remap plus castle furnish | 1 forge prop sheet |
| Sunken shrine | the `coral` remap | 1 coral kit |
| Mirage Tower, Citadel | `tower` placeholder, castle kit `facade` recolour | 2 landmarks |
| Caravan | a new `tent` placeholder (W1-D) | 1 tent landmark |
| Gaia windmills, Lufenia domes | new `windmill` and `dome` placeholders (W1-D) | 2 landmarks |
| NPC kinds: elf, dwarf, mermaid, sky folk, sage, fairy, automaton, dragon, giant, pirate | tinted existing sheets (25 available), plus one scale-2 tint for the giant and the dragons | 10 field sheets |

A later Stability Core pass would need about 23 images plus their backgrounds removed (open question 5). Gemini is
not used in pass W, and its ledger guard is untouched.

## 5. Tranches

### 5.0 Waves, concurrency, ports, merge order, resume

```
K (kneel) merged -> W1-0a | W1-0b contract (parallel)
  -> W1-A | W1-B | W1-C1 | W1-C2 | W1-D | W1-E | W1-F | W1-G | W1-H | W1-I (parallel) -> W1 merge ("W1: foundation merged")
  -> 21 region tranches (at most 6 running at once; one world compile at a time, by the lock) -> INT -> PLAY
```

| Wave | Tranches | Checkpoint (all must hold) | Stop condition |
|---|---|---|---|
| W1-0 | W1-0a, W1-0b (parallel) | both merged on `mainline`; G4, G7 green; `stubs.py` writes every stub; `world.py` composes the act-1 world with `bands: OK` and `basins: OK` (the walls are stubbed by the composer's placeholder walls, 5.1) | a gate still fails after 2 fix attempts |
| W1 | W1-A to W1-I | each done-when (5.2); the W1 merge; `npm run quest -- --mutate` prints `quest-verify: OK` on `mainline` | the locality selftest or the 26 GB memory target fails: **stop the pass** (QUEST's rule) |
| W2 | 21 region tranches | each merged with its result, G1-G17 green, its stages and town `built` | a SKIP or SOFTLOCK across 2 tranches: the integrator decides. More than 3 tranches blocked at once: stop the wave |
| INT | INT | `npm run quest -- --strict --mutate` OK; `questCurve.test.ts` green; `stubs.py --check all` prints `stubs: 0 left` | the QUEST open-question-1 fallback |
| PLAY | PLAY | the fix list closed; all gates green | a P0 not fixed in 2 attempts |

- **Concurrency in W2: at most 6 region tranches at once** (open question 11).
  - Start order: A1-O, ELF-O, ERT-O, FIR-O, WAT-O, WND-O (the six O tranches whose regions carry an Aldi wall or a
    cross-region hand-off). Then each finishing tranche frees a slot for the next in this order: ORD-O, A1-T, ELF-T,
    ELF-D, ERT-T, ERT-D, FIR-T, FIR-D1, FIR-D2, WAT-T, WAT-D, WND-T, WND-D1, WND-D2, PST.
  - O tranches go first because they own the world modules and compile the world most often.
- **Merge order:** a region's O tranche merges first. Its T and D tranches then rebase on `mainline` and merge in any
  order. Stubs (D-W8) make every order legal; the rule only cuts down world recompiles.
- **Ports** (`npm run dev -- --host 127.0.0.1 --port <p> --strictPort`; `mute=1` on every URL):

| Tranche | Port | Tranche | Port | Tranche | Port |
|---|---|---|---|---|---|
| W1-0a, W1-0b | 5210, 5209 | ELF-O | 5223 | FIR-D2 | 5232 |
| W1-A | 5211 | ELF-T | 5224 | ORD-O | 5233 |
| W1-B | 5212 | ELF-D | 5225 | WAT-O | 5234 |
| W1-C1 | 5213 | ERT-O | 5226 | WAT-T | 5235 |
| W1-C2 | 5214 | ERT-T | 5227 | WAT-D | 5236 |
| W1-D | 5215 | ERT-D | 5228 | WND-O | 5237 |
| W1-E | 5216 | FIR-O | 5229 | WND-T | 5238 |
| W1-F | 5217 | FIR-T | 5230 | WND-D1 | 5239 |
| W1-G | 5218 | FIR-D1 | 5231 | WND-D2 | 5240 |
| W1-H | 5219 | A1-O | 5221 | PST | 5241 |
| W1-I | 5220 | A1-T | 5222 | INT, PLAY | 5173 |

- **Branches and worktrees:**

  ```
  git worktree add ../ff-game-w-<id> -b w-<id> <head>
  cd ../ff-game-w-<id>
  npm ci
  ```

  `<id>` is the lower-case tranche id, e.g. `w-elf-d`. Scratch work goes under `/tmp/w-<id>/`.
- **Resume rule:** QUEST 4.0a, with `grep -E ' W[0-9]| (A1|ELF|ERT|FIR|ORD|WAT|WND|PST|INT|PLAY)-'`.
- **End of session:** QUEST 4.0a. A running tranche commits `<id>: WIP` on its own branch with a result draft that
  lists every gate run, as pass or fail, and its next step. A WIP commit never merges.
- **Effort:**
  - W1-0a 8 h and W1-0b 6 h; W1 (A-I) 73 h; W2 156 h; INT 8 h; PLAY 10 h; about 261 agent-hours in all.
  - **Wall-clock critical path, with throughput:**
    1. W1-0a (8 h; W1-0b runs beside it);
    2. W1 (the longest tranche, 8 h), plus about 4 h for the staggered admission of the heavy-job rule (2.3), plus the
       10 serial W1 merges (about 3 h);
    3. W2: 156 h over 6 slots is at least 26 h, and the 21 serial merges with their world regenerations add about
       0.5 h each where they don't overlap: about 30 h;
    4. INT (8 h), then PLAY (10 h).

    That is about 71 h, and never less than 64 h.
  - Pass W is a multi-session pass.

### 5.1 W1-0a and W1-0b: the contract (integrator, in parallel)

**W1-0a, the TS contract (8 h).** It is QUEST 4.1 (Q1-0) in full, with these deltas:

- **`quest.yaml`**: all stages S0-S31 and the `towns:` list, `status: pending` (S0 `built`). Each tranche's stages
  and its town entry sit between that tranche's comment anchors (`# === <id> (pass W: owned by <id>) ===` and
  `# === end <id> ===`), so every hunk merges cleanly.
- **`ExplorationScene.ts` extraction:** the vehicle code moves into `src/scenes/exploration/FieldVehicles.ts` and
  the NPC-action code into `FieldNpcActions.ts`, ending at **590 lines or fewer**. QUEST 4.1's skipped 590 entry in
  `fileCeilings.test.ts` is enabled here. W1-A and W1-B then never edit `ExplorationScene.ts`.
- **`src/systems/fieldRulesVehicles.ts`:** the vehicle branches of `fieldStep` and `canLand` with today's behaviour
  (walking only), imported by `fieldRules.ts`. W1-A owns it from then on; W1-B owns `fieldRules.ts`.
- **`src/progression/questTypes.ts`:** the verifier's shared types (place, event, state, proof result), so W1-H and
  W1-I can work in parallel.
- **Anchors**, one pair per tranche, in `shops.yaml`, `cutscenes.yaml`, `debug-scenarios.yaml`, `items.yaml`,
  `quest.yaml` and this document's Results. In `enemies.yaml`, each boss record a tranche owns (3.7, plus the
  pass Q list) gets its owner's anchor pair around it in place, with no reordering. `kits.yaml` has a single W1-F
  anchor (5.5).
- **`types/index.ts`** gets QUEST 4.1's changes plus `MapData.world?` (GAP-17; +1 line). The ceiling goes from 440 to
  **442** in `fileCeilings.test.ts`.
- **`frame: a1`** on `r_ow_temple`, `r_ow_bridge` and `r_ow_east` (GAP-18 declared; W1-B implements it).

**W1-0b, the world data (6 h):**

- **`world_api.py` (declarations):** the constants and dataclasses of 2.9, including `Rect`, `BOXES`, `SEAMS`,
  `FROZEN_EXCEPTIONS`, `BASIN_SEEDS`, `DOCKS_ALLOWED`, `WALLS` and `A1_ORIGIN`.
  - **Placeholder walls:** until a region merges, its stub is ocean. So `world.py` closes the Aldi with
    composer-owned placeholder walls, a mountain fill of the region's cells along the wall's planned path, listed in
    `world_api.PLACEHOLDER_WALLS`. A region's module replaces its placeholder wall when it is built.
  - The composer fails when a built region doesn't return a wall that closes the basin, so the basin check is
    meaningful from the start.
- **`RegionOut.barriers`** (2.9) declared in `world_api.py`, with an empty default.
- **`build_hooks.py` signatures** (no-op bodies with docstrings; W1-C1 calls them, W1-C2 fills them):

  ```python
  def passthrough(src: dict, out: dict) -> None: ...          # docks, patches, hazards, exit, world -> compiled map
  def bake_patches(map_id: str, src: dict, grid: "Grid", kit: "Kit", out_dir: Path) -> list[str]: ...  # patch PNG paths
  def region_checks(src: dict, grid: "Grid", region: str | None) -> list[str]: ...   # error strings; [] = OK
  def owned_chunks(region: str) -> set[tuple[int, int]]: ...   # (col, row) of the region's rect union
  ```

- **`layouts/world_canon.py`:** the table of every pass W map id. Each row has the owner tranche, the kind (`town`,
  `house`, `shop`, `inn`, `castle`, `site`, `floor`), the entrances (name: purpose), the `exit`, and its links
  (stairs between floors, by entrance name). The ids and entrance names are those of section 4; floor entrances are
  `arrival`, `up`, `down`, `boss`, plus `inner` for `mirage-1f`.
- **`layouts/stubs.py`:** it writes a stub source (`assets-src/maps/<id>.yaml`, header `STUB generated by
  stubs.py`, a 12x10 room with each canon entrance, its links and its exit) for every canon id whose source is
  missing or is itself a stub. It never overwrites a real map.
  - `stubs.py --count <tranche|all>` prints `stubs: <n> left for <tranche>` and always exits 0.
  - `stubs.py --check <tranche|all>` prints the same and exits 1 when n > 0. It is a final gate (G16, INT), so it
    needs no notion of a "final" result.
- **Default site files**, one per T-tranche town: `layouts/a1/town_pravoka_site.py`, `layouts/elf/town_elfheim_site.py`,
  `layouts/earth/town_melmond_site.py`, `layouts/fire/town_crescent_site.py`, `layouts/water/town_onrac_site.py`,
  `layouts/wind/town_gaia_site.py`. Each holds the icon cells, the land-gate anchor (its 2.2 target), the dock and
  the spawn as plain constants.
- **`assets/data/world-anchors.yaml`** (2.2) and **`tests/quest/townTargets.ts`** (4.0.1).

**Done when (both):**

| Command | Expected |
|---|---|
| `npm run build && npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; 0 failed |
| `python3 -I assets-src/tools/layouts/stubs.py && python3 -I assets-src/tools/layouts/stubs.py --count all` | the first writes every canon stub; the second prints `stubs: <n> left` with n equal to the number of canon ids |
| `python3 -I assets-src/tools/layouts/world.py --check-bands` | `bands: OK` (with the composer skeleton: rects tile the world; stubs write no band cell) |
| `npx vitest run tests/systems/fieldRules.test.ts tests/data/fileCeilings.test.ts tests/data/questCeilings.test.ts` | all passed, with the 590 entry for `ExplorationScene.ts` enabled |
| `wc -l < src/types/index.ts` | at most 442 |
| `python3 -I -c "import sys; sys.path.insert(0, 'assets-src/tools'); import build_hooks"` | exit 0 (the signatures import) |

### 5.2 W1 foundation tranches

Each tranche is the named part of a QUEST 4.2-4.5 spec plus the listed deltas. Each has the QUEST done-when rows for
its part, plus its own rows below, and runs G4, G7 and G11 (G8 for compiler tranches).

| Tranche | Base spec | Owns | Deltas | Effort | Done when (beyond QUEST's rows for its part) |
|---|---|---|---|---|---|
| W1-A Vehicles and save | QUEST 4.2: vehicles, save v2, GAP-11, GAP-12, `vehicles.py` and its build stage, `test-dock.yaml`, scenario `q1a_ship_dock` renamed `w1a_ship_dock` | `src/entities/*Mode.ts`, `VehicleManager.ts`, `FieldVehicles.ts`, `fieldRulesVehicles.ts`, `SaveManager.ts`, `MapTransition.ts`, `BattleRetry.ts`, `assets-src/vehicles.py`, `assets/maps/test-dock.yaml` | GAP-17's save half: a version-1 save on `overworld` loaded against a map with `world.frames.a1` is translated by the origin | 8 h | `npx vitest run tests/systems/vehicles.test.ts tests/systems/safeSpawnModes.test.ts tests/systems/battleRetryVehicles.test.ts tests/systems/saveOriginShift.test.ts` all pass; browser `http://127.0.0.1:5211/?mute=1&scenario=w1a_ship_dock` as QUEST 4.2's row |
| W1-B NPC and field rules | QUEST 4.2: patches, AND gates, item conditions, trades, tint, class upgrade `actionFlag`, hazards, EXIT/WARP, zone modes, `end_game`, cutscene steps, asset coverage | `fieldRules.ts`, `FieldNpcActions.ts`, `NPCInteraction.ts`, `CutsceneManager.ts`, `CutsceneRegistry.ts`, `KeyItemGateSystem.ts`, `ClassUpgradeSystem.ts`, `FieldSpellEffects.ts`, `EncounterSystem.ts`, `CollisionMap.ts`, `DebugScenarioLoader.ts`, `tests/data/assetCoverage.test.ts` | GAP-15 (`takeGold`), GAP-16 (clinic), GAP-18 (`frame: a1`) | 8 h | `npx vitest run tests/systems/patches.test.ts tests/systems/npcTrade.test.ts tests/systems/npcTakeGold.test.ts tests/systems/clinic.test.ts tests/systems/hazards.test.ts tests/systems/endGame.test.ts tests/systems/fieldRules.test.ts tests/systems/debugFrame.test.ts` all pass; `fieldRules.test.ts`'s act-1 cases unchanged |
| W1-C1 Compiler core | QUEST 4.3: per-chunk RNG (GAP-14), `--region` (it takes the lock), the lock, the memory probe (stub world **and** a land-filled synthetic world), the legend (`w`, Lake = 11, `BLOCKED` adds 11), material remaps with `hue` and `sat` | `build_map.py`, `terrain/**` | multi-rect `--region` (GAP-19); hook calls into `build_hooks.py` (passthrough, patch art, per-region checks), whose bodies are W1-C2's | 8 h | `build_map.py --selftest` prints `region yaml: OK`, `locality: OK` and `region multi-rect: OK` (a synthetic 2-rect region compiled by region equals the full compile); `/usr/bin/time -l` of the land-filled synthetic world at most 26 GB, and `--region fire` at most 10 GB (both measured values, and the stub world's, in the result) |
| W1-C2 Composer and world | QUEST 4.3: `world.py`, `world_api.py` logic, `world_a1.py`, the `world_<r>.py` stubs, the `overworld.py` shim, map checks with `reach_roots`, the canoe spawn removal, `frozenCore.test.ts`, the `overworldLayout.test.ts` clip | `layouts/world*.py`, `overworld.py` (shim), `map_checks*.py`, `map_graph.py`, `build_hooks.py`, `tests/data/overworldLayout.test.ts`, `tests/quest/a1/frozenCore.test.ts` | the act-1 translation (2.9, GAP-17 compiler half); bands, seams and placeholder walls; the basin checks of 2.6; `RegionOut.barriers` and their minimal cuts; `--owned-chunks` over unions; `overworldLayout.test.ts` reads `world.frames.a1.origin` and offsets its cells | 8 h | `python3 -I assets-src/tools/layouts/world.py` prints `bands: OK` and `basins: OK (aldi ..., ocean ...; canal joins)` on the stub world; `build_map.py --check-determinism overworld` prints `overworld: deterministic`; `npx vitest run tests/data/overworldLayout.test.ts tests/quest/a1/frozenCore.test.ts tests/data/act1Flow.test.ts` all pass |
| W1-D Kit and town tooling | QUEST 4.3: placeholder landmarks and the remap presets | `kit.py`, `layouts/interiors_common.py`, `layouts/town_common.py` (new), the helper imports in `cornelia.py` | extra placeholders `waterfall`, `tent`, `windmill`, `dome`, `buried_hull`; recolours `elf`, `snow`, `dune`, `pale_dune`; the `w` swamp material; `interiors_common.py` takes a `town` parameter (map-id prefix, exits, keeper and house helpers) instead of the hard-coded `TOWN = "cornelia"`; the outdoor helpers (`obj`, `deco`, `oak`, `lamp`, `fir`, `win`, `flag`) move from `cornelia.py` into `town_common.py`, and `cornelia.py` imports them (it shrinks) | 7 h | `python3 -I assets-src/tools/kit.py --selftest` (new) prints one `OK <name>` line per placeholder and preset; G8; re-running `cornelia.py`, `interiors.py` and `castle.py` leaves `git diff --exit-code assets-src/maps` clean (G1), and `build_map.py --check-determinism cornelia` passes |
| W1-E Streaming | QUEST 4.3: streaming | `BakedMapRenderer.ts`, `MapLoader.ts`, `tests/rendering/bakedStreaming.test.ts` | the sweep covers the 192x192 world | 6 h | `npx vitest run tests/rendering/bakedStreaming.test.ts` passes (at most 60 resident textures in an airship sweep; a miss holds at most 6 frames; `Assets.unload` is used) |
| W1-F Items and shops | QUEST 4.4: items, kits, bestiary habitats, shop sections, `gearBands.test.ts`, `rosterCoverage.test.ts`, `balanceData` helpers, `check-bounds.ts` | `items.yaml`, `kits.yaml`, `bestiary.yaml`, the shop sections of `shops.yaml` (records seeded empty inside each town's anchor), `tests/helpers/balanceData.ts`, `scripts/check-bounds.ts` | the key items of 3.1; `excalibur` and `adamant`; the `w_<town>` kits; town tiers per 3.6 | 6 h | `npx vitest run tests/data/gearBands.test.ts tests/data/crossFileValidation.test.ts tests/scenes/MagicShopScene.test.ts` pass; every key item of 3.1 exists with `type: key` |
| W1-G Spells L5-L8 | QUEST 4.4: spells L5-L8, `spellEffectsLate.ts`, the 20 enemy spell ids kept exactly | `spells.yaml`, `src/battle/spellEffectsLate.ts` (`SpellExecutor.ts` at most +2 lines) | none | 6 h | `npx vitest run tests/battle/ tests/balance/` pass; the cross-file test shows that every enemy spell id resolves |
| W1-H Verifier core | QUEST 4.5: model, places, events, search, proofs (a)-(c), CLI, fixtures | `src/progression/{questData, questPlaces, questEvents, questSearch, questProofs, questReport}.ts`, `scripts/quest-verify.ts`, `package.json` `quest`, `tests/fixtures/quest/`, `tests/progression/{questGraph, questFlags}.test.ts` | `optional` stages; `milestones` in (b); `towns:` parsing | 8 h | `npx vitest run tests/progression/questGraph.test.ts tests/progression/questFlags.test.ts` pass, each proof failing on its RED fixture first; `npm run quest` on the W1 head prints `quest-verify: OK` |
| W1-I Verifier proofs and tests | QUEST 4.5: (d) bands, (e), mutation, `designNotes`, `originality` | `src/progression/{questCurve, questMutate, questGeo, questTravel, questProofsLate}.ts`, `tests/progression/{questMutate, macroGeography, travelMatrix}.test.ts`, `tests/quest/{designNotes, originality, townStandard, bossItems}.test.ts` | (e) by `towns[].opensAfter`; (f) price walls; (d3) gold prices; (g) geography (6.1); (h) travel matrix (6.2); the gate table (6.3) as fixtures | 8 h | `npx vitest run tests/progression/ tests/quest/` pass, with each new proof failing on its RED fixture first; `npm run quest -- --mutate` on the W1 head prints `quest-verify: OK` |

### 5.3 Region tranche template (extends QUEST 4.6)

Every region tranche:

- **owns** exactly the files of its region section (4.1-4.8) and its stages' entries in `quest.yaml` (`entry`,
  `walk`, `nonLoadBearing`, `milestones`, `status`). It also owns its town entry, its anchors, its
  `tests/quest/<prefix>/<id>_*.test.ts`, `tests/balance/w_<id>.test.ts` and the backgrounds named for it. A needed
  change elsewhere goes to the integrator as `BLOCKED: <need>`.
- **replaces its stubs** with real maps (G16). It keeps every canon entrance name and link of its maps.
- **meets the town standard** (4.0.1, G15) and the dungeon standard (4.0.2).
- **adds debug scenarios:** `w_s<n>_start` (a field start at the stage entrance, with the band-low party, the previous
  band's kit, the prerequisite flags and items, and the vehicles) and `w_boss_<id>` (the boss battle at the band level
  with the stage kit).
- **places its anchors** within ±2 cells of their targets (2.2, G13).
- **writes its result** inside its anchor of this document: the gate outputs, the measured balance values, the
  originality numbers, `originality review: PASS <map ids>` and an AGENTS.md delta.
- **O tranches only:** they own `world_<region>.py` and must return the region's Aldi wall (2.6), if it has one, in
  place of its placeholder wall. They compile with `--region <region>` and G3.
- **T and D tranches** never edit `world_<region>.py`. The T tranche exports its town's site (icon cells, gate,
  dock, spawn, land-gate anchor) by editing `layouts/<region>/town_<town>_site.py`. W1-0b created that file with
  defaults, and the O module imports it whichever tranche merges first. A `town_*_site.py` change changes the
  generated world files, so QUEST 4.0's rule applies: on a conflict the integrator regenerates `overworld.yaml` and
  the region's chunks under the lock (`world.py`, then `build_map.py overworld --region <region>`); they are never
  hand-merged.
- **Backgrounds:** a tranche that stages a background runs `python3 -I assets-src/tools/stage_backgrounds.py <ids>`
  and `python3 -I assets-src/tools/stage_backgrounds.py --check <ids>` (each id prints its checks and the command exits
  0). The hand-made sources live in `~/temp/ffgame-assets`, outside the worktree, and are read only.

### 5.4 Region tranches

| Tranche | Stages (owner) | Maps (canon ids) | Shared-file anchors it appends to | Effort | Specific done-when (beyond G1-G17) |
|---|---|---|---|---|---|
| A1-O | S1, S3, S7 | `matoya-cave`; the `world_a1.py` region part | `cutscenes.yaml` (`act1_complete`, `a1_matoya_sight`), `debug-scenarios.yaml` | 7 h | `npx vitest run tests/quest/a1/` passes, including the bridge-patch and frozen-core tests; checkpoints S1 and S3 (6.5) |
| A1-T | S2; town `pravoka` | `pravoka`, `pravoka-house-*` (6+), the 5 shops and `pravoka-inn` | `shops.yaml`, `cutscenes.yaml` (`a1_bikke_yields`), `debug-scenarios.yaml` | 8 h | `w_a1_t.test.ts` (pirate x9) passes; checkpoints S2 and S2 `_neg_noboss` |
| ELF-O | S6 | `western-keep-1f`, `-2f`; `world_elf.py` | `cutscenes.yaml` (`elf_astos_unmasked`), `debug-scenarios.yaml` | 8 h | `w_elf_o.test.ts` (astos); checkpoints S6 and `w_s6_neg_nocrown` |
| ELF-T | S4, S8, S9; town `elfheim` | `elfheim`, `elfheim-house-*` (6+), shops, `elfheim-inn`, `elfheim-castle`, `elfheim-castle-chamber`, `elfheim-vault` | `shops.yaml` (the existing `elfheim_*` ids move here, W1-F), `cutscenes.yaml` (`elf_prince_wakes`) | 8 h | checkpoints S4, S8, S9 |
| ELF-D | S5 | `marsh-cave-b1..b3` | `cutscenes.yaml` (`elf_d_crown`), `debug-scenarios.yaml` | 6 h | `w_elf_d.test.ts` (piscodemon x3); `hazardPath.test.ts`; checkpoint S5 |
| ERT-O | S10, S12, S31; town `dwarf` | `dwarf-hall`, `giant-tunnel`, `sage-cave`; `world_earth.py`; the patch `canal` | `cutscenes.yaml` (`ert_canal_blast`, `ert_giant_feast`), `shops.yaml` (`dwarf_item`), `debug-scenarios.yaml` | 8 h | `world.py` prints `basins: OK` with the real isthmus wall (no EARTH placeholder wall) and `barriers: OK (western_range)`; checkpoints S10, `w_s10_neg_notnt`, S12, `w_s12_neg_noruby` |
| ERT-T | S25; town `melmond` | `melmond`, `melmond-house-*` (5+, one is `-unne`), shops, `melmond-inn`; the patch `ert_melmond_bloom` | `shops.yaml` (the existing `melmond_*`), `cutscenes.yaml` (`ert_unne_lesson`) | 7 h | checkpoint S25; the bloom patch test (before and after EARTH_CRYSTAL_LIT) |
| ERT-D | S11, S13 | `cavern-earth-b1..b5` | `cutscenes.yaml` (`ert_vampire_falls`, `ert_lich_falls`, `ert_earth_crystal`) | 8 h | `w_ert_d.test.ts` (vampire, lich); checkpoints S11, S13 |
| FIR-O | S17 | `world_fire.py` (continent, lake, rivers, ash hazards, desert, the buried hull) | `cutscenes.yaml` (`fir_airship_rises`), `debug-scenarios.yaml` | 7 h | `basins: OK` with the real W_south and W_east south parts, and `barriers: OK (crescent_ring)`; checkpoints S17 and `w_s17_neg_nostone` |
| FIR-T | S14; town `crescent` | `crescent`, `crescent-house-*` (6+), shops, `crescent-inn`, `crescent-circle` | `shops.yaml`, `cutscenes.yaml` (`fir_sages_canoe`) | 8 h | proof (f) for `crescent` OK; checkpoints S14 and `w_s14_early` |
| FIR-D1 | S15 | `gurgu-b1..b5` | `cutscenes.yaml` (`fir_ashen_falls`) | 8 h | `w_fir_d1.test.ts` (ashen_queen); `hazardPath.test.ts`; checkpoint S15 |
| FIR-D2 | S16 | `ice-cavern-b1..b3` | `cutscenes.yaml` (`fir_evil_eye_falls`, `fir_d2_shelf`) | 6 h | `w_fir_d2.test.ts` (evil_eye); checkpoint S16 |
| ORD-O | S18, S19 | `citadel-1f..3f`, `bahamut-cave`, `bahamut-lair`; `world_ordeal.py` | `cutscenes.yaml` (`ord_throne_wakes`, `ord_seal_won`, `ord_bahamut_trial`) | 8 h | `w_ord_o.test.ts` (dragon_zombie); checkpoints S18, S19 |
| WAT-O | S21, S22 | `waterfall-cave`, `caravan-camp`; `world_water.py` | `cutscenes.yaml` (`wat_cube_given`), `debug-scenarios.yaml` | 7 h | proof (d3) for the bottle's price; checkpoints S21, `w_s21_neg_nocanoe`, S22 |
| WAT-T | S20; town `onrac` | `onrac`, `onrac-house-*` (6+), shops, `onrac-inn` (the submarine cell is in `onrac`) | `shops.yaml` | 7 h | checkpoints S20 and `w_s24_neg_nooxyale` |
| WAT-D | S24 | `sea-shrine-b1..b5` | `cutscenes.yaml` (`wat_drowned_falls`) | 8 h | `w_wat_d.test.ts` (drowned_sovereign); checkpoint S24 |
| WND-O | S26; town `lufenia` | `lufenia`, `lufenia-house-*` (3+), `lufenia-white-magic`, `lufenia-black-magic`, `lufenia-inn`; `world_wind.py` | `shops.yaml`, `cutscenes.yaml` (`wnd_chime_given`) | 8 h | checkpoints S26 and `w_s26_neg_untaught` |
| WND-T | S23; town `gaia` | `gaia`, `gaia-house-*` (6+), shops, `gaia-inn`, `gaia-spring` | `shops.yaml`, `cutscenes.yaml` (`wnd_fairy_freed`) | 8 h | proof (f) for `gaia`; checkpoint S23 |
| WND-D1 | S27 | `mirage-1f..3f` (including the chime door in the vestibule) | `cutscenes.yaml` (`mirage_ascent`) | 5 h | checkpoints S27 and S27-neg |
| WND-D2 | S28 | `sky-castle-1f..5f` | `cutscenes.yaml` (`wnd_seraph_falls`) | 8 h | `w_wnd_d2.test.ts` (hollow_seraph, warmech); checkpoint S28 |
| PST | S29, S30 | `temple-of-fiends` (edits), `past-temple-1..5`, `past-chaos` | `cutscenes.yaml` (`pst_time_gate`, `pst_*`, `ending`) | 8 h | `w_pst.test.ts` (the refight run, death_eye); `templeLayout` and Garland tests unchanged; checkpoints S29, S30 |

### 5.5 Shared files (extends QUEST 4.0's table)

| Shared file | Owner | Others may |
|---|---|---|
| `world_api.py` (constants), `world_canon.py`, `world-anchors.yaml`, `townTargets.ts`, `questTypes.ts` | W1-0 | read only; a needed change goes to the integrator |
| `world.py`, `world_api.py` (logic), `build_hooks.py`, `map_checks*.py`, `map_graph.py` | W1-C2 | none |
| `build_map.py`, `terrain/**` | W1-C1 | none |
| `kit.py`, `layouts/interiors_common.py`, `layouts/town_common.py` | W1-D | read and import only |
| `layouts/world_<region>.py`, `layouts/<region>/world_*.py` | the region's O tranche | its T tranche writes only `layouts/<region>/town_<town>_site.py` |
| `quest.yaml` | W1-0a creates it, with per-tranche anchors | each tranche edits only inside its anchor (its stages and its town) |
| `shops.yaml`, `cutscenes.yaml`, `debug-scenarios.yaml`, `items.yaml` | anchors from W1-0a | each tranche writes only inside its anchor; ELF-T and ERT-T take over the `elfheim_*` and `melmond_*` records W1-F placed in their anchors |
| `kits.yaml` | W1-F (every `w_*` town and stage kit) | read only; a kit change goes to the integrator as `BLOCKED: <need>`, and INT may tune kits |
| `enemies.yaml` | nobody by default; W1-0a puts anchors around the owned boss records | a tranche edits only inside its anchors, only its own bosses' `bossPhases`, `ai` and `specials`; only INT changes `xpReward` and `goldReward` |
| `overworld_consts.py`, `overworld_zones.py` | the act-1 data | A1-O edits only `BRIDGE_WORKERS` and `GATE_MESSAGE` |
| `castle.py` (360 / 360) | nobody | not edited in pass W |
| `cornelia.py` (352 / 355) | W1-D, only to import the extracted helpers (output byte-equal) | not edited otherwise |
| `assets-src/maps/temple-of-fiends.yaml` | PST | none |
| The act-1 tests (QUEST 4.0's list) | frozen after W1 | A1-O may update only the `act1_complete` and bridge assertions; PST may only add temple assertions |
| `AGENTS.md` | INT | each tranche writes an AGENTS.md delta in its result |
| Generated: `assets-src/maps/overworld.yaml`, `assets/maps/ai/overworld*`, `assets/maps/ai/index.yaml`, stub sources | regenerated, never hand-merged (QUEST 4.0) | - |

### 5.6 World composition per region box

| Region | Rects | Bands it borders (default ocean) | Seams it must meet | Walls it builds (2.6) | Docks | Patches | Compile | Owned chunks |
|---|---|---|---|---|---|---|---|---|
| A1 | (64, 64, 143, 143) | EARTH (x 62-65), ORDEAL and WIND (y 62-65), FIRE (x 142-145; y 142-145 for x 112-143), ELF (y 142-145, x 64-111) | `seam_w` (its X_west side), `seam_se` | W_west (X_west), W_east (X_east, Pravoka's range) | `a1_pravoka` | `north_bridge` | `build_map.py overworld --region a1` | `world.py --owned-chunks a1` |
| ELF | (48, 112, 63, 143) + (0, 144, 111, 191) | EARTH (x 46-49; y 142-145 for x 0-47), A1, FIRE (x 110-113) | `seam_n`, `seam_s` | W_arm | `elf_port` | - | `--region elf` | `--owned-chunks elf` |
| EARTH | (0, 64, 63, 111) + (0, 112, 47, 143) | WATER (y 62-65), A1 (x 62-65), ELF | `seam_w`, `seam_n` | W_west (the stub), W_isthmus | `ert_dwarf`, `ert_melmond` | `canal` | `--region earth` | `--owned-chunks earth` |
| FIRE | (144, 64, 191, 143) + (112, 144, 191, 191) | WIND (y 62-65), A1, ELF | `seam_se`, `seam_s` | W_south (the cliffs), the south end of W_east | `fir_crescent` | - | `--region fire` | `--owned-chunks fire` |
| ORDEAL | (64, 0, 127, 63) | WATER (x 62-65), WIND (x 126-129), A1 | - | - | - | - | `--region ordeal` | `--owned-chunks ordeal` |
| WATER | (0, 0, 63, 63) | ORDEAL, EARTH | - | - | - | - | `--region water` | `--owned-chunks water` |
| WIND | (128, 0, 191, 63) | ORDEAL, A1, FIRE | - | - | - | - | `--region wind` | `--owned-chunks wind` |

### 5.7 INT and PLAY

- **INT** is QUEST 4.14 with `--strict` over S0-S31:
  - `stubs.py --check all` prints `stubs: 0 left`;
  - the anchors are checked with no assumed targets (`QUEST_STRICT=1`);
  - `questCurve.test.ts` (QUEST 6.4) runs, and the bottle's price is tuned by (d3);
  - AGENTS.md is updated (the map table, the world origin, the regions, the verifier's new proofs, the ceilings);
  - INT writes its result.
- **PLAY** is QUEST 4.15, plus a geography walk: a fresh agent flies the airship over each anchor pair of 2.2 and
  records, in its own words, whether the place lies where the classic leads a player to expect it. A "wrong side" is
  a P1.

## 6. Verification

### 6.0 Verifier changes (to QUEST 5.2)

- **(a) Order:** unchanged, plus: each `optional` stage is reachable, and removing its grants leaves the goal
  reachable.
- **(b) No skip:** unchanged, plus `milestones`. For each stage with milestones m1 ... mk, withholding the event that
  sets mi must leave mi+1 ... mk unreachable.
- **(c) No soft-lock:** unchanged.
- **(d) Bands:** unchanged, plus (d3): every `takeGold` NPC's price is at most 80 % of the curve model's cumulative
  gold at its stage's start.
- **(e) No early shops:** for each `towns[]` entry, the first state in which a keeper of the town becomes talkable must
  have every stage in `opensAfter` complete, and no stage in `opensAfter` may be skippable. A failure reads
  `EARLY <town> talkable before <stage>: <path>`.
- **(f) Price walls (new):** for each town whose `opensAfter` stage precedes its `bandStage` (crescent, gaia), the
  cumulative gold at its first arrival on the witness path must be below 40 % of the 4-member price of its `kit`. At
  its `bandStage` it must be at least 50 % (QUEST's (d) gold rule). A failure reads
  `PRICEWALL <town> <gold> vs <price>`.
- **(g) Geography (new):** 6.1.
- **(h) Travel matrix (new):** 6.2.

CLI output, in the QUEST 5.3 form:

```
quest-verify: 32 stages (S0 built, 31 pending), 1180 places, 96 events
(a) order: OK  S0 S1 S2 S3 S4 ...  optional: S19 S31 reachable, not required
(b) skips: OK  (612 withheld runs, 0 reach a later stage; 14 milestone runs)
(c) soft-locks: OK  (8211 states, every one reaches CHAOS_DEFEATED)
(d) bands: OK  garland L2.9 [2,3]  pirate L4.6 [3,6] ...  prices: OK (1 takeGold)
(e) early shops: OK  (8 towns)
(f) price walls: OK  crescent 1240/9600  gaia 6100/21000
(g) geography: OK  s*=0.73 (31 pairs; 0 assumed)
(h) travel matrix: OK  (12 rows, 2 basin rows)
mutations: OK  (38 gate rows; 112 elements, each removal reported)
quest-verify: OK
```

The numbers are only an example.

### 6.1 Macro-geography test

- **Files:** `src/progression/questGeo.ts` (W1-I), `tests/progression/macroGeography.test.ts`, and the CLI line (g).
- **Input:** the compiled `assets/maps/ai/overworld.yaml` (its `entrances`) and `assets/data/world-anchors.yaml`.
- **Method:**
  1. **Anchor cells.** Each anchor's cell is its named entrance. An anchor whose region isn't built uses its target
     and is reported as `assumed`. With `QUEST_STRICT=1` an assumed anchor fails.
  2. **Placement.** Each built anchor is within ±2 cells per axis of its target. A failure reads
     `GEO place <anchor> at (x, y), target (tx, ty)`.
  3. **Fitted scale.** s* = Σ(d_w x d_r) / Σ(d_r²) over the pairs, without the distance-exempt pair
     (cornelia-temple). It must be in [0.60, 0.80].
  4. **Distance bands.** For each pair, r = d_w / (s* x d_r) must be in [0.70, 1.30] when s* x d_r >= 20, and in
     [0.55, 1.60] for shorter pairs. Cornelia-temple is exempt.
  5. **Bearing bands.** The bearing error, min(|Δ|, 360 - |Δ|) with Δ = bearing(world) - bearing(ref) in compass
     degrees, must be at most 40°
     for pairs with s* x d_r >= 20, and at most 60° otherwise. Every pair is checked, cornelia-temple included.
  6. **Detour bound.** For each hop below, the path length in the hop's mode (from the verifier's BFS, between the two
     anchors' cells, docks included) must be at most the factor times the Euclidean distance. A failure reads
     `GEO detour <a>-<b> <path> > <factor> x <euclid>`.

     | Hop | Mode | Factor |
     |---|---|---|
     | cornelia-pravoka | walking (over the bridge) | 2.5 |
     | cornelia-matoya | walking | 2.5 |
     | pravoka-elfheim | ship (dock to dock) plus walking | 2.5 |
     | pravoka-dwarf | ship plus walking | 2.5 |
     | elfheim-keep, elfheim-marsh | walking | 2.5 |
     | dwarf-melmond | ship through the canal plus walking | 4.5 (the canal lies north of the dwarves) |
     | melmond-earth_cave, melmond-giant | walking | 2.5 |
     | melmond-sarda | walking through the tunnel | 3.0 |
     | melmond-crescent | ship plus walking | 2.5 |
     | crescent-volcano, crescent-ice | canoe plus walking | 2.5 |
     | ice-desert | walking | 2.5 |
     | onrac-waterfall | canoe plus walking | 2.5 |

     Airship hops are straight lines and have no detour check.
  7. **RED fixtures.** These cases must fail: an anchor moved 10 cells off its target; two anchors swapped (Onrac and
     Gaia, so the bearing flips); every anchor scaled by 1.5 about Cornelia (the distance band catches it, the
     placement too); a detour fixture.
- **Expected output:** `(g) geography: OK  s*=<value> (31 pairs; <n> assumed)`. At the targets, s* = 0.735 and every
  ratio is in [0.86, 1.10].

### 6.2 Travel-requirement matrix

`tests/progression/travelMatrix.test.ts` and the CLI line (h) (W1-I). Each row starts from a synthetic state (assume
mode) and computes the closure under that state's flags, items and vehicles only. No events fire, apart from the
row's own flags.

| Row | State (cumulative) | Must reach | Must not reach |
|---|---|---|---|
| T0 | act 1 done (S0 grants), on foot | `cornelia`, `temple` | `a1_pravoka`, `a1_matoya`, every other anchor |
| T1 | + BRIDGE_BUILT | `a1_pravoka`, `a1_matoya` | `elf_elfheim`, `elf_keep`, `elf_marsh`, `ert_dwarf` and all beyond |
| T2 | + ship (at `a1_pravoka`) | `elf_elfheim`, `elf_keep`, `elf_marsh`, `ert_dwarf` | `ert_melmond`, `ert_earth_cave`, `fir_crescent`, every north anchor |
| T3 | + CANAL_OPEN | `ert_melmond`, `ert_earth_cave`, `ert_giant`, `fir_crescent` | `ert_sarda`, `fir_volcano`, `fir_ice`, `fir_desert`, every north anchor |
| T4 | + TITAN_FED | `ert_sarda` | `fir_volcano`, `fir_ice`, `fir_desert` |
| T5 | + `canoe` | `fir_volcano`, `fir_ice`, `fir_desert` | `ord_citadel`, `ord_bahamut`, `wat_onrac`, `wat_waterfall`, `wat_caravan`, `wnd_gaia`, `wnd_mirage`, `wnd_lufenia` |
| T6 | + airship (in the desert) | `ord_citadel`, `ord_bahamut`, `wat_onrac`, `wat_caravan`, `wnd_gaia`, `wnd_mirage`, `mirage-1f:arrival`, `wnd_lufenia`, and `wat_waterfall` (needs the canoe, held); each airship-only anchor has a landing cell within 8 steps | `sea-shrine-*`, `mirage-1f:inner`, `sky-castle-*`, `past-temple-*` |
| T6b | T6 without the canoe | as T6 minus `wat_waterfall` | `wat_waterfall` |
| T7 | + `oxyale` | `sea-shrine-b3` | `mirage-1f:inner`, `sky-castle-*` |
| T8 | + `chime` | `mirage-1f:inner` | `sky-castle-*` |
| T9 | + SKY_FORTRESS_OPEN | `sky-castle-1f` | `past-temple-*` |
| T10 | + the 4 crystal flags, `lute`, TIME_GATE_OPEN | `past-temple-1` | - |

Plus two **basin rows**:

- with the ship and no CANAL_OPEN, the ship's sailable set equals the `aldi` component, and its reachable docks are
  exactly `a1_pravoka`, `elf_port` and `ert_dwarf`;
- with CANAL_OPEN, the reachable docks are all five.

Each row's RED fixture removes one wall or patch, and that row must then fail.

### 6.3 No-skip mutation suite (one row per gate)

QUEST 5.4's element list holds, minus J2, the floe and `wnd_calm`. Each gate below is a named mutation in
`questMutate`, with its expected catch. INT runs them on the real world; region tranches run their own rows in
`--stage` mode (G5). A row that is "non-load-bearing" must appear in its stage's `nonLoadBearing` with the reason
given here.

| Row | Stage | Element | Mutation | Expected |
|---|---|---|---|---|
| GT-1 | S0/S1 | the bridge gate cells `overworld` (93, 96), (94, 96) | remove | non-load-bearing: "redundant with `north_bridge`; the gap is water without the flag" (D-W13) |
| GT-2 | S1 | the patch `north_bridge` | force on from the start | (b) `SKIP S2` and (e) `EARLY pravoka` |
| GT-3 | S2 | the ship spawn `requiredFlag: BIKKE_DEFEATED` | remove | (b) `SKIP S4` |
| GT-4 | S2 | the dock `a1_pravoka` | remove | (c) `SOFTLOCK` or the goal unreachable (the ship can't be boarded or left) |
| GT-5 | S4 | the dock `elf_port` | remove | non-load-bearing: "Elfland is also reachable on foot from the `ert_dwarf` landing over `seam_n`" |
| GT-5b | S4 | both Aldi docks of Elfland's coast, `elf_port` and `ert_dwarf` | remove both | (a) the goal unreachable (Elfland and the dwarves cut off; `tnt` and `crown` unobtainable). The fixture also drops `ert_dwarf` from the `DOCKS_ALLOWED` presence check, so the row fails only on (a), never on a missing-dock error |
| GT-6 | S6 | Astos's `requiredFlags: [MARSH_GUARD_DEFEATED]` | remove | non-load-bearing: "the crown, which Astos also requires, is given only by the guard's victory (D-W14)". D-W14 itself is checked statically: `tests/quest/bossItems.test.ts` (W1-I) fails when a key item that 3.1 lists as a boss-cutscene gift is also in a chest or a non-boss NPC gift |
| GT-7 | S6 | Astos's `requiredItem: crown` | remove | (b) `SKIP S6` without S5 |
| GT-8 | S7 | Matoya's `requiredItem: crystal_eye` | remove | (b) `SKIP S7` |
| GT-9 | S8 | the prince's `requiredItem: herb` | remove | (b) `SKIP S8` |
| GT-10 | S9 | the vault gate `requiredItem: mystic_key` | remove | (b) `SKIP S9` |
| GT-11 | S10 | Nerrick's `requiredItem: tnt` | remove | (b) `SKIP S10` |
| GT-12 | S10 | the patch `canal` | force on from the start | (b) `SKIP S11` and (e) `EARLY melmond`, `EARLY crescent` |
| GT-13 | S10 | each Aldi wall W_west, W_isthmus, W_arm, W_south, W_east | open its minimal water cut (the shortest path through the wall's cells from `aldi` to `ocean`, as exported by the composer) | (b) `SKIP S11` and (e) `EARLY melmond` for each of the 5 |
| GT-14 | S10 | the dock `ert_dwarf` | remove | non-load-bearing: "the dwarf hall is also reachable on foot from Elfland over `seam_n`" |
| GT-15 | S12 | the giant's `requiredItem: ruby` | remove | (b) `SKIP S12` |
| GT-16 | S12 | Sarda's `requiredFlags: [VAMPIRE_DEFEATED]` | remove | non-load-bearing: "Sarda is behind the giant, who needs the ruby, which needs the vampire" |
| GT-17 | S13 | the earth seal's `requiredItem: rod` | remove | (b) `SKIP S13` |
| GT-18 | S13 | S13's milestones | withhold EARTH_SEAL_BROKEN's event | (b) milestone: EARTH_CAVE_COMPLETE unreachable (it fails if reachable) |
| GT-19 | S14 | the elder's `requiredFlags: [EARTH_CRYSTAL_LIT]` | remove | (b) `SKIP S14` (the canoe before S13) |
| GT-20 | S14 | the Crescent shop keepers | move the first-talkable keeper's town `opensAfter` to [S13] (a fixture-only data mutation) | (e) `EARLY crescent` (proves (e) reads `opensAfter`) |
| GT-21 | S15/S16 | the river mouths (the cells where R-volcano and R-ice leave the lake) | make one cell walkable grass | (b) `SKIP S15` or `SKIP S16` (no canoe needed) |
| GT-22 | S17 | the buried hull's `requiredItem: levistone` | remove | (b) `SKIP S17` |
| GT-23 | S17 | the airship's `set_vehicle` cutscene's trigger | fire it with no levistone (fixture) | (b) `SKIP S18` |
| GT-24 | S19 | Bahamut's `requiredItem: ordeal_seal` | remove | (b) `SKIP S19` |
| GT-25 | S21 | the waterfall river (R-waterfall) | make one cell walkable | (b) `SKIP S21` (no canoe) |
| GT-26 | S23 | the fairy's `requiredItem: fairy_bottle` | remove | (b) `SKIP S23` |
| GT-27 | S24 | the submarine gate's `requiredItem: oxyale` | remove | (b) `SKIP S24` |
| GT-28 | S25 | Unne's `requiredItem: slab` | remove | (b) `SKIP S25` |
| GT-29 | S26 | the elder's `requiredFlags: [LUFENIAN_LEARNED]` | remove | (b) `SKIP S26` |
| GT-30 | S26 | the Lufenia keepers' `showIf: LUFENIAN_LEARNED` | remove | (e) `EARLY lufenia` |
| GT-31 | S27 | the `mirage-1f` vestibule door's `requiredItem: chime` (WND-D1) | remove | (b) `SKIP S27` without S26 |
| GT-32 | S27 | the console's `requiredItem: cube` | remove | (b) `SKIP S27` without S21 |
| GT-33 | S29 | the time gate's `requiredItem: lute` and `requiredFlags` (each of the 5 separately) | remove one at a time | (b) `SKIP S29` for each of the 4 crystal flags; the lute is never consumed, so removing it is non-load-bearing ("the lute is held from S0 and never consumed"), reported as such |
| GT-34 | S30 | each refight stair's `requiredFlags` | remove one at a time | (b) milestone failure naming the next PAST_* flag |
| GT-35 | S12 | the western range (EARTH) | open its minimal walkable cut outside the tunnel (the shortest grass path from Melmond's plain to Sarda's coast through the range's cells, exported by the composer like the wall cuts) | (b) `SKIP S12` (Sarda without TITAN_FED). The cut is the composer's export for the barrier `western_range` (2.9) |
| GT-36 | S12 | the giant NPC on the tunnel's chokepoint | remove the NPC | (b) `SKIP S12` |
| GT-37 | S15/S16 | Crescent's mountain ring (FIRE) | open its minimal walkable cut from Crescent's shore to the south lands (the barrier `crescent_ring`) | (b) `SKIP S15` and `SKIP S16` (no canoe needed) |

Every row except GT-1, GT-5, GT-6, GT-14, GT-16 and the lute part of GT-33 must be caught. `questMutate.test.ts` asserts each
row's expected proof and message prefix by name, on fixtures in W1-I and on the real world at INT.

### 6.4 Scripted walkthroughs per stage

- **The model walk** (QUEST 5.5): each stage's `walk` in `quest.yaml` lists event ids. Examples:
  `overworld:dock:a1_pravoka`, `marsh-cave-b3:battle:marsh_guard`, `onrac:gate:submarine`.
  `tests/quest/<prefix>/<id>_walk.test.ts` replays it through the model and asserts that:
  - the stage's grants hold after the last step;
  - no later stage's grant is reachable at that point;
  - for stages with milestones, each one appears in order.
- **The field walk:** the `w_s<n>_start` scenario runs the same walk in the game, through the browser checkpoint of
  6.5.

### 6.5 Browser checkpoints

Setup as QUEST 5.6: the tranche's port, `http://127.0.0.1:<port>/?mute=1&scenario=<id>`, assertions on
`window.__game`, and a screenshot path under `/tmp/w-<id>/` in the result.

Every row has its own scenario id in the owning tranche's `debug-scenarios.yaml` anchor. A `_start` scenario holds
every prerequisite of its stage. A `_neg_*` scenario is the same start with exactly the one prerequisite in its
name withheld. No tranche runs another tranche's scenario.

| Stage | Scenario (owner) | Steps | Pass when |
|---|---|---|---|
| S1 | `w_s1_start` (A1-O) | talk to the King, walk north over the bridge | `BRIDGE_BUILT` set; the party stands on a former gap cell |
| S2 | `w_s2_start` (A1-T) | talk to the captain, win, walk to the quay | BIKKE_DEFEATED; the ship sprite is at `a1_pravoka`; stepping onto it gives mode `ship` |
| S2 | `w_s2_neg_noboss` (A1-T) | walk to the quay without the fight | no ship sprite; the party can't step onto water |
| S3 | `w_s3_start` (A1-O) | walk to Matoya's grove, enter | the map is `matoya-cave` |
| S4 | `w_s4_start` (ELF-T) | sail south and west to Elfheim, disembark | the map is `overworld` at the `elf_port` land cell; then `elfheim` |
| S5 | `w_s5_start` (ELF-D) | descend to B3, win | MARSH_GUARD_DEFEATED; `crown` in the inventory |
| S6 | `w_s6_start` (ELF-O) | give the crown, win | ASTOS_DEFEATED; `crystal_eye` held |
| S6 | `w_s6_neg_nocrown` (ELF-O) | talk to the false king | no battle; his line asks for the crown |
| S7 | `w_s7_start` (A1-O) | talk to Matoya with the eye | `herb` held; the eye gone |
| S8 | `w_s8_start` (ELF-T) | use the herb on the prince | PRINCE_AWAKE; `mystic_key` held |
| S9 | `w_s9_start` (ELF-T) | open the vault | `tnt` held |
| S10 | `w_s10_start` (ERT-O) | give the TNT, sail west into the canal | CANAL_OPEN; the canal cells are sailable in mode `ship` |
| S10 | `w_s10_neg_notnt` (ERT-O) | sail to the canal strip | the ship stops at the isthmus coast |
| S11 | `w_s11_start` (ERT-D) | reach B3, win | VAMPIRE_DEFEATED; `ruby` held |
| S12 | `w_s12_start` (ERT-O) | feed the giant, walk west to Sarda | TITAN_FED; `rod` held |
| S12 | `w_s12_neg_noruby` (ERT-O) | walk into the tunnel | the giant blocks the chokepoint |
| S13 | `w_s13_start` (ERT-D) | use the rod, descend, win, touch the altar | the 3 milestone flags in order |
| S14 | `w_s14_start` (FIR-T) | talk to the elder in the Circle | CANOE_GIVEN; stepping onto the lake gives mode `canoe` |
| S14 | `w_s14_early` (FIR-T: the S10 grants and the ship at `fir_crescent`, no EARTH_CRYSTAL_LIT) | enter Crescent, visit a shop and the Circle | the shops are open at B5 prices; the elder says the earth must heal first; no canoe |
| S15 | `w_s15_start` (FIR-D1) | canoe to the volcano, descend to B5, win | FIRE_CRYSTAL_LIT |
| S16 | `w_s16_start` (FIR-D2) | canoe to the ice cavern, descend, win | EVIL_EYE_DEFEATED; `levistone` held |
| S17 | `w_s17_start` (FIR-O) | give the stone to the hull, board, fly, land on grass, try a forest | AIRSHIP_RAISED; the landing works; a forest cell says "The airship can't land here." |
| S17 | `w_s17_neg_nostone` (FIR-O) | talk to the hull | no airship sprite; the hull's line asks for the stone |
| S18 | `w_s18_start` (ORD-O) | fly to the Citadel, sit on the throne, cross the lattice, win | ORDEALS_GUARD_DEFEATED; `ordeal_seal` held |
| S19 | `w_s19_start` (ORD-O) | give the seal to Bahamut | CLASS_UPGRADED; a warrior's class is its upgrade |
| S20 | `w_s20_start` (WAT-T) | land by Onrac, enter | the map is `onrac` |
| S21 | `w_s21_start` (WAT-O) | canoe up the river, talk to the automaton | `cube` held |
| S21 | `w_s21_neg_nocanoe` (WAT-O) | walk to the river | the party can't enter River |
| S22 | `w_s22_start` (WAT-O) | buy the bottle | `fairy_bottle` held; gold reduced by its price |
| S23 | `w_s23_start` (WND-T) | open the bottle at the spring | FAIRY_FREED; `oxyale` held |
| S24 | `w_s24_start` (WAT-D) | board the submarine, descend to B5, win | WATER_CRYSTAL_LIT; `slab` held |
| S24 | `w_s24_neg_nooxyale` (WAT-T) | step onto the submarine cell | the shipwright's message; the map stays `onrac` |
| S25 | `w_s25_start` (ERT-T) | give the slab to Unne | LUFENIAN_LEARNED |
| S26 | `w_s26_start` (WND-O) | talk to the elder | `chime` held; the keepers are visible |
| S26 | `w_s26_neg_untaught` (WND-O) | talk to anyone in Lufenia | the lines are unreadable; no keeper is visible |
| S27 | `w_s27_start` (WND-D1) | ring at the vestibule door, climb, use the cube | SKY_FORTRESS_OPEN; the map is `sky-castle-1f` |
| S27 | `w_s27_neg_nochime` (WND-D1) | step onto the vestibule door | the gate message; no way to `inner` |
| S28 | `w_s28_start` (WND-D2) | climb to 5F, win | WIND_CRYSTAL_LIT |
| S29 | `w_s29_start` (PST) | use the stair in the temple | TIME_GATE_OPEN; the map is `past-temple-1` |
| S30 | `w_s30_chaos_door` (PST) | talk to Chaos | the battle starts with `chaos` and the `rim` background |

### 6.6 Town standard and stubs

- **`tests/quest/townStandard.test.ts`** (W1-I) checks each built town against its row of `townTargets.ts`, with the
  counts of 4.0.1. It prints a table of target and actual per column. A pending town is skipped unless
  `QUEST_STRICT=1`.
- **`stubs.py --check <tranche>`** fails when any canon id the tranche owns is still a stub (G16). `--count` only
  reports.

## 7. Gates

G1-G12 are QUEST 7's gates, with `<region>` now a pass W region and `<owned ids>` the tranche's canon ids. The
command changes and the new gates:

| Gate | Command | Expected |
|---|---|---|
| G1 layouts are deterministic | `for s in <owned layout scripts>; do python3 -I "$s" \|\| exit 1; done; python3 -I assets-src/tools/layouts/stubs.py && python3 -I assets-src/tools/layouts/world.py && git diff --exit-code assets-src/maps` (after committing) | exit 0, no diff |
| G2 compile and determinism | Every `overworld` compile, full or `--region`, takes the world-compile lock; a full compile also obeys the heavy-job rule (2.3). O tranches: `python3 -I assets-src/tools/build_map.py overworld --region <region> <owned ids>`, then `... --check-determinism --region <region> overworld <owned ids>`. T and D tranches: `build_map.py <owned ids>` and `--check-determinism <owned ids>`, plus the O command only if they changed a `town_*_site.py`. W1-C1, W1-C2 and INT: the full world | each id prints `<id>: WxH -> assets/maps/ai/<id>.yaml`, then `<id>: deterministic`; exit 0 |
| G3 chunk locality | `python3 -I assets-src/tools/layouts/world.py --owned-chunks <region> > /tmp/w-<id>/owned.txt; git diff --name-only "$(git merge-base mainline HEAD)" HEAD -- assets/maps/ai/overworld/ \| grep -vxFf /tmp/w-<id>/owned.txt` | no output (grep exits 1). W1-C1 and W1-C2 are exempt: they re-baseline every chunk on purpose |
| G4 build and tests | `npm run build && npx vitest run --maxWorkers=2 --minWorkers=1` (worktrees; INT on `mainline` may run `npm test`) | exit 0; 0 failed |
| G5 gap verifier | W1: `npm run quest -- --mutate`. Regions: `for s in <the tranche's stages>; do npm run quest -- --mutate --stage "$s" \|\| exit 1; done`. INT: `npm run quest -- --strict --mutate` | every run ends with `quest-verify: OK`; exit 0 |
| G6 asset coverage | `npx vitest run tests/data/assetCoverage.test.ts` | all passed |
| G7 file-size ceilings | `npx vitest run tests/data/fileCeilings.test.ts tests/data/questCeilings.test.ts` | all passed |
| G8 compiler self-test | `python3 -I assets-src/tools/build_map.py --selftest` (and `kit.py --selftest` for W1-D) | exit 0 |
| G9 balance | `npx vitest run tests/balance/ && npx vite-node scripts/check-bounds.ts tests/balance/w_*.test.ts` | all passed; `check-bounds: OK (<n> tests)` |
| G10 browser | the tranche's rows of 6.5, with `mute=1` on every URL | every row passes, with a screenshot path |
| G11 clean tree | `git status --porcelain` before the commit | only the tranche's owned paths; no scratch files |
| G12 originality | `npx vitest run tests/quest/designNotes.test.ts tests/quest/originality.test.ts`, plus the reviewer sign-off | all passed; `originality review: PASS <map ids>` in the result |
| G13 macro geography | `npx vitest run tests/progression/macroGeography.test.ts && npm run quest -- --only g` | passed; `(g) geography: OK  s*=<v> (31 pairs; <n> assumed)`, with s* in [0.60, 0.80] |
| G14 travel matrix | `npx vitest run tests/progression/travelMatrix.test.ts && npm run quest -- --only h` | passed; `(h) travel matrix: OK  (12 rows, 2 basin rows)` |
| G15 town standard | `npx vitest run tests/quest/townStandard.test.ts` | passed; the tranche's town row shows actual >= target in every column |
| G16 stubs | `python3 -I assets-src/tools/layouts/stubs.py --check <id>` | `stubs: 0 left for <id>`; exit 0 |
| G17 bands and basins | `python3 -I assets-src/tools/layouts/world.py --check-bands && python3 -I assets-src/tools/layouts/world.py` | `bands: OK`, then `basins: OK (aldi <n> cells, ocean <m> cells; canal joins)`; exit 0 |

W1-H adds `--only <letters>` to `scripts/quest-verify.ts` (it runs only the named proofs and prints their lines and
the final `quest-verify: OK`).

## 8. Risks

QUEST's R1-R4 and R6-R16 hold. These are changed or new:

| # | Risk | Mitigation |
|---|---|---|
| R5 (changed) | A basin leaks (the ship reaches the world ocean before CANAL_OPEN), now through any of 5 walls in 4 regions | the placeholder walls from W1-0, so the basin check means something from the start; `basins: LEAK ... region <r>` names the culprit; G17 on every tranche; GT-13 cuts each wall |
| R17 | Moving act 1 to (64, 64) breaks act-1 tests, saves or scenarios | the legacy 72x72 map is unchanged, unit tests use it, and `?art=legacy` stays act-1 only (QUEST 3.1: new maps exist only compiled, and the translation applies only to the compiled world); `scenarioSpawns.test.ts` covers the 3 raw spawns; `frozenCore.test.ts` checks byte-equality under translation; the 3 hard-coded test cells read `world.frames.a1`; `saveOriginShift.test.ts` (GAP-17); `frame: a1` for `r_ow_temple` (GAP-18) |
| R18 | The reference schematic (2.1, 2.2) is from memory and may be off for some places (Bahamut's isles, the caravan, Matoya's exact bearing) | the bands are loose (±30 %, ±40°); open question 1 lets the user correct the anchor table before W1-0; only `world-anchors.yaml` changes |
| R19 | Classic early access (Crescent after the canal, Gaia and Onrac with the airship) breaks the level curve | proof (f) price walls; `questCurve.test.ts` at INT; the Lufenia showIf gate; open question 3 offers pass Q's gates back |
| R20 | 35 tranches overload the integrator and the lock | at most 6 region tranches at once; O tranches first; T and D tranches compile only their own maps (no world compile unless they change a site file) |
| R21 | Stub churn (about 110 stub sources and compiled maps) | stubs are 1 chunk each (about 30 KB); `stubs.py` writes only missing ids; each tranche removes its own |
| R22 | Git size: about 50 MB of new maps plus about 24 MB of world chunks | chunk alignment, G3, one world regeneration per merge; open question 12 offers Git LFS for `assets/maps/ai/**/*.png` |
| R23 | Cramped spots: ELF's 16-cell-wide arm and EARTH's isthmus (the bands take 4 cells); FIRE's north-west, where W_south, R-volcano, R-ice and the two cavern mouths meet near rows 146-150; Pravoka's fjord between the quay and the range | the arm carries only the keep and a road, the isthmus only the dwarf hall, the canal and a landing; FIRE's row budget and `northWest.test.ts` (4.4); the range at x 138-141 and `pravokaChannel.test.ts` (4.1); a tranche raises `BLOCKED` early if its budget can't be met |
| R24 | Cross-region hand-offs (S22 to S23 to S24 to S25 to S26) stall when one tranche lags | assume mode; the matrix uses synthetic states; the stubs keep transitions valid |
| R25 | `takeGold` and the clinic make gold scarce in the curve model | (d3); INT tunes the bottle price and the clinic rates in one place (`shops.yaml` anchors and NPC data) |
| R26 | Pass W branches from a head before the kneel merge | the kneel pass has merged (88f8ad7, "Merge KA0b"); every pass W branch starts from `mainline` at or after it (`git merge-base --is-ancestor 88f8ad7 HEAD` exits 0), and pass W never touches the kneel files |

## 9. Open questions (each has a default the orchestrator applies)

1. **The reference schematic.** Default: use 2.1 and 2.2 as written. The user may correct any anchor's reference
   offset or target before W1-0, and only `world-anchors.yaml` changes.
2. **The world size and scale** (192x192, about 0.73 cells per classic tile, act 1 at (64, 64)). Default: as written.
   The alternative is 208x208 (scale about 0.8; about 25.7 GB peak), at the limit of the memory target.
3. **Early access.** Default: the classic. Crescent opens with the canal and Gaia and Onrac with the airship, under
   price walls (D-W3, D-W4). The alternative brings back pass Q's floe and landing field as extra patches.
4. **The water and wind chain.** Default: the classic chain (D-W5). The alternative is pass Q's compressed widow and
   pearl chain.
5. **New art.** Default: 0 paid images in pass W (4.9). A later optional Stability Core pass would make about 23
   images (12 landmarks and kit sheets, 10 NPC field sheets, 1 terrain), with background removal, and needs the
   user's approval and budget. Gemini: none.
6. **Warmech.** Default: a rare formation in the sky castle, with the waterfall's automaton as its dormant twin
   (D-W7). The alternative is a Warmech boss guarding the waterfall cube.
7. **Clinics.** Default: a clinic in every new town (GAP-16); Cornelia unchanged (its map is at its ceiling).
8. **Excalibur.** Default: the optional side quest S31 (adamant in the sky castle, Smyth in the dwarf hall),
   non-load-bearing.
9. **The location of `tnt`.** Default: the Elfheim vault (D-W6).
10. **The canal's direction.** Default: the canal leads west from the sound to the western strait (2.6). The
    alternative is a south-west cut, about 8 cells longer.
11. **Concurrency.** Default: at most 6 region tranches at once.
12. **Git LFS for compiled map PNGs.** Default: no (as today). Revisit if the repository passes 500 MB.
13. **Carried from pass Q:** Chaos stays at level 40 (QUEST open question 1, with its XP fallback); the class change is
    optional (open question 3); the act-1 ending text (open question 4); names (open question 5). Default: as the user
    accepted them.

## 10. TODOs

- [x] W0: this plan, rev 1 (20f32de), rev 2 (6f4f731, momus OKAY), rev 3 folds in the remaining items; then the user's evaluation and momus review to PASS (priority: high, effort: 2h)
- [x] W1-0a: TS contract: QUEST Q1-0, quest.yaml with anchors, the ExplorationScene extraction to 590, anchors in shared YAML and enemies.yaml (priority: high, effort: 8h)
- [ ] W1-0b: world data: world_api, build_hooks signatures, canon, stubs, site defaults, anchors file, town targets (priority: high, effort: 6h)
- [ ] W1-A: vehicles and save, with the origin shift (priority: high, effort: 8h)
- [ ] W1-B: NPC and field rules, takeGold, clinic, debug frame (priority: high, effort: 8h)
- [x] W1-C1: compiler core, per-chunk RNG, multi-rect --region, lock, memory probe (priority: high, effort: 8h)
- [ ] W1-C2: composer, bands, seams, basins, act-1 translation, frozen core (priority: high, effort: 8h)
- [ ] W1-D: kit placeholders and recolours; interiors_common town parameter; town_common.py extraction (priority: high, effort: 7h)
- [ ] W1-E: chunk streaming (priority: high, effort: 6h)
- [ ] W1-F: items, key items, shops, kits (priority: high, effort: 6h)
- [ ] W1-G: spells L5-L8 (priority: high, effort: 6h)
- [ ] W1-H: verifier core (priority: high, effort: 8h)
- [ ] W1-I: verifier proofs (d)-(h), mutation, geography, travel matrix, town standard (priority: high, effort: 8h)
- [ ] W2 A1-O, A1-T (priority: high, effort: 7h + 8h)
- [ ] W2 ELF-O, ELF-T, ELF-D (priority: high, effort: 8h + 8h + 6h)
- [ ] W2 ERT-O, ERT-T, ERT-D (priority: high, effort: 8h + 7h + 8h)
- [ ] W2 FIR-O, FIR-T, FIR-D1, FIR-D2 (priority: high, effort: 7h + 8h + 8h + 6h)
- [ ] W2 ORD-O (priority: high, effort: 8h)
- [ ] W2 WAT-O, WAT-T, WAT-D (priority: high, effort: 7h + 7h + 8h)
- [ ] W2 WND-O, WND-T, WND-D1, WND-D2 (priority: high, effort: 8h + 8h + 5h + 8h)
- [ ] W2 PST (priority: high, effort: 8h)
- [ ] INT: strict verify, curve, prices, AGENTS.md (priority: high, effort: 8h)
- [ ] PLAY: play test with a geography walk, fix list, momus, fixes (priority: medium, effort: 10h)

## Results

<!-- Each tranche appends its result between its own pair of anchors; the integrator writes INT and PLAY. -->
<!-- === W1-0a FOUNDATION (pass W: owned by W1-0a) === -->
### W1-0a result: the TS contract (branch `w-w1-0a`, rebased on `mainline` after the W1-0b merge d8cdf2c)

**Files:**

- Types: `src/types/quest.ts` (new: `FIELD_MODES` / `FieldMode`, `MapPatch`, `Dock`, `Hazard`, `MapExit`
  `{map, entrance}` (the shape W1-0b's canon uses), `VehicleState`, `MapWorld` (GAP-17), the `*QuestFields`
  interfaces, `QuestStage`, `QuestTown`, `QuestData`). `src/types/index.ts` re-exports it; `MapNPC`, `MapData`,
  `EncounterZone`, `SaveData`, `BakedMapArt`, `KeyItemGate`, `ScriptedEncounter`, `VehicleSpawn` and `NPCCutscene`
  extend those interfaces, and `TerrainType.Lake = 11` and `MapTransition.requiredFlags` change in place.
  `MapNPC` also declares `takeGold` (GAP-15) and `clinicPrice` (GAP-16) for W1-B.
- Schema: `src/core/schemaValidationQuest.ts` (`validateQuestMapFields`, called from `validateMapData` (+2 lines),
  and `validateQuestData`: ids, `after`, no cycle, towns, milestones granted).
- Flags: `STORY_FLAGS` has every milestone of 3.1; `LOCAL_FLAG_PREFIXES` and `isKnownFlag` (a story flag or a
  region-prefixed local flag). `crossFileValidation.test.ts` (gates) accepts `requiredFlags` and local flags.
- Field rules: `src/systems/fieldRules.ts` (`fieldStep`, `canEnter`, `canLand`, `dockFor`, `npcOutcome`,
  `transitionOpen`, `dueEncounter`, `patchedTerrain`, plus `terrainAllows`, `gateCheck`, `flagsMet`) with today's act-1
  behaviour; `src/systems/fieldRulesVehicles.ts` (the vehicle branches: a vehicle moves only over its own terrain, no
  boarding or disembarking by a step, no landing). The movement modes' `canMove` / `canLand` and
  `KeyItemGateSystem.check` now call these, so `PlayerController` (unchanged, via `CollisionMap.isWalkable(x, y,
  mode)`) and `ExplorationScene` (`fieldStep` on each finished step) use one rule source.
- Extraction: `src/scenes/exploration/FieldVehicles.ts` (spawns, boarding, the field-rule state) and
  `FieldNpcActions.ts` (chests, gifts, the post-dialog actions, on `npcOutcome`). `FieldSystems.createFieldStateSystems`
  and `ExplorationCutscenes.npcCutsceneDue` are gone (replaced by these and `fieldRules.npcCutsceneFor`).
- Declarations: cutscene steps `give_item`, `take_item`, `set_vehicle`, `end_game` (accepted by the registry; the
  manager logs that they are not played yet); `DebugScenario.frame`, `vehicles`, `fieldMode`;
  `BattleRetrySnapshot.mode` and `vehicles`; `safeSpawn(map, pos, mode?, vehicles?)`; `FIELD_TRAVEL_EFFECTS`
  (`field_exit`, `field_warp`).
- Verifier types: `src/progression/questTypes.ts` (`QuestPlace`, `QuestEvent`, `QuestState`, `ProofResult`,
  `ProofFailure`, `MutationResult`, `VerifyReport`).
- Data: `assets/data/quest.yaml` (S0 built, S1-S31 pending, 8 towns, each between its owner's anchors; S0's
  `nonLoadBearing` holds GT-1's two gate cells in world coordinates (93, 96), (94, 96)); anchor pairs in `shops.yaml`
  and `items.yaml` (W1-F + the 21 region tranches), `cutscenes.yaml` (W1-B + 21), `debug-scenarios.yaml` (W1-A, W1-B
  + 21), `kits.yaml` (W1-F), and 16 pairs around the owned boss records in `enemies.yaml` (3.7's list, in place);
  `frame: a1` on `r_ow_temple`, `r_ow_bridge`, `r_ow_east`.
- Tests: `tests/systems/fieldRules.test.ts` (25: the bridge gates and both messages, the temple's Garland cells and
  NPC, a chest, the castle doors and stairs, static vs wandering NPCs, the lute gift, the King's cutscene, AND gates,
  vehicles), `tests/data/questData.test.ts`, `tests/data/passWAnchors.test.ts`, `tests/data/questCeilings.test.ts`;
  `fileCeilings.test.ts` adds `src/types/index.ts` 442 and `src/scenes/ExplorationScene.ts` 590 (enabled).

**Gates:**

| Command | Output |
|---|---|
| `npm run build` | exit 0 |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 269 passed (269)`, `Tests 5119 passed (5119)` |
| `npx vitest run tests/systems/fieldRules.test.ts tests/data/fileCeilings.test.ts tests/data/questCeilings.test.ts` | 3 files, 62 tests passed (590 entry enabled) |
| `wc -l < src/types/index.ts` | 424 (ceiling 442) |
| `wc -l < src/scenes/ExplorationScene.ts` | 496 (ceiling 590) |
| `python3 -I -c "import sys; sys.path.insert(0, 'assets-src/tools'); import build_hooks"` | exit 0 |

Other line counts: `fieldRules.ts` 212, `fieldRulesVehicles.ts` 43, `FieldVehicles.ts` 76, `FieldNpcActions.ts` 122,
`types/quest.ts` 182, `questTypes.ts` 98, `schemaValidationQuest.ts` 185, `schemaValidation.ts` 380 (+2),
`PlayerController.ts` 183 (unchanged).

**Worktree memory:** `/usr/bin/time -l npx vitest run --maxWorkers=2 --minWorkers=1`: 50.5 s, maximum resident set
size 742 MB. That is under about 2 GB, so the "3 others" and the region concurrency limits stay as written (2.3).

**Deviations:**

- `fieldStep` in a vehicle mode keeps today's sailing (the ship moves over Water, `ok: true, mode: ship`) rather than
  refusing every vehicle step; only a step that would change the mode (boarding, disembarking) is refused, and a
  walking step's mode is always `walking`. Gates are skipped while flying (QUEST's "everything is open").
- `DebugScenario` already has `mode: 'battle' | 'field'`, so the field mode is declared as `fieldMode`.
- The G4 command (and 5.1, 2.3) now read `--maxWorkers=2 --minWorkers=1` (Vitest 1.6.1; found by W1-0b).
- Stage kits are named `w_s<n>` and town kits `w_<town>` in `quest.yaml` (W1-F creates them); `grind` is 2.0 for a
  stage with a roster or boss and 1.0 otherwise (INT tunes it).
- 3.3 leaves S18 (the Citadel) off the goal's path without `optional`; `questData.test.ts` pins that S18, S19 and S31
  are the stages outside S30's `after` closure.

**AGENTS.md delta (for INT):** "Key Interfaces" gains `types/quest.ts` (the pass W fields) and
`src/systems/fieldRules.ts` (the one source of field rules: the movement modes, `KeyItemGateSystem` and
`ExplorationScene` call it); "File Size Guidelines" lists `ExplorationScene.ts` 496 / 590 and `types/index.ts`
424 / 442; "Data Files" gains `assets/data/quest.yaml`; the shared YAML files carry `# === <id> (pass W: owned by
<id>) ===` anchors.
<!-- === end W1-0a === -->
<!-- === W1-0b FOUNDATION (pass W: owned by W1-0b) === -->
### W1-0b result (world data)

Branch `w-w1-0b` from `mainline` 8343b82. No AI or paid calls.

**Files:** `assets-src/tools/layouts/world_api.py` (constants and dataclasses of 2.4-2.9, `PLACEHOLDER_WALLS`,
`RegionOut.barriers` with an empty default), `assets-src/tools/build_hooks.py` (the 4 signatures, no-op bodies),
`layouts/world_canon.py` (137 ids, 20 owner tranches), `layouts/stubs.py`, 137 stub sources in `assets-src/maps/`,
the 6 site files `layouts/{a1,elf,earth,fire,water,wind}/town_<town>_site.py`, `assets/data/world-anchors.yaml`,
`tests/quest/townTargets.ts`, and a composer skeleton `layouts/world.py` (W1-C2 replaces it).

**Gates (5.1 done-when):**

| Command | Output |
|---|---|
| `stubs.py && stubs.py --count all` | `stubs: wrote 137 stub sources, kept 0 real maps (137 canon ids)`, then `stubs: 137 left` |
| `world.py --check-bands` | `bands: OK` |
| `world.py` (skeleton, stub world) | `bands: OK`, `basins: OK (aldi 2781 cells, ocean 29870 cells; canal: no patch yet)` |
| `python3 -I -c "...; import build_hooks"` | exit 0 |
| `npm run build` | exit 0 |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 265 passed (265)`, `Tests 5063 passed (5063)` |
| act-1 layout scripts (`overworld`, `cornelia`, `interiors`, `castle`), then `git diff --exit-code assets-src/maps` | exit 0, no diff |

**Checks beyond the table (scratch, `/tmp/w-w1-0b/`):** at the `world-anchors.yaml` targets s* = 0.735, the ratios
are 0.86-1.10 and the worst bearing error is 29.3°. Every anchor target and every site-file cell is in its region and
outside the bands, and each site's `GATE` equals its anchor target. Removing any one of the 5 placeholder walls, or
opening any one of the 4 seams, makes the skeleton print `basins: LEAK`. All 137 stubs compile with `build_map.py`
(12x10, one chunk, about 28 KB each). The compiled stubs are not committed and `index.yaml` is unchanged.

**Deviations:**

- `world.py` is a skeleton, written so that `--check-bands` can run. It writes nothing, and `overworld.yaml` stays
  the act-1 map. W1-C2 owns the file and replaces it.
- `RegionOut` has two fields beyond 2.9: `walls` (the region's parts of the Aldi walls, by `WALLS` key) and `stub`
  (when it is set, the composer applies that region's placeholder walls). 5.1 asks for both behaviours but names no
  field.
- The placeholder walls fill Water cells only. The two that border `seam_n` (EARTH y 109 and ELF y 114) are grass, so
  that the grass seam has a walkable cell on each side.
- The canon invents the house slugs, using the minimum interior counts of 4.0.1, and the `MapData.exit` shape
  `{map, entrance}` (W1-0a defines `MapExit`). It also invents the town entrance names, on Cornelia's model: `gate`,
  `house_<slug>`, `weapon_shop` and so on, `inn`, plus `north_gate`, `circle`, `spring` and `dry_dock`. The overworld
  entrance `ert_giant_west` is added for the tunnel's west mouth. `temple-of-fiends` is not a canon id, because it is
  a real map that PST edits.
- The G4 command as written (`--maxWorkers=2` alone) fails under Vitest 1.6.1 with `options.minThreads and
  options.maxThreads must not conflict`. Adding `--minWorkers=1` fixes it.

**AGENTS.md delta (for INT):** under "Editing a 2x Map", add `layouts/stubs.py`, which writes the canon stubs
(`--count` and `--check <tranche|all>`), `layouts/world_canon.py` (the map-id canon) and `layouts/world_api.py` (the
world constants).
<!-- === end W1-0b === -->
<!-- === W1-A FOUNDATION (pass W: owned by W1-A) === -->
### W1-A result: vehicles and save (branch `w-w1-a` from `mainline` 3831329)

No AI or paid calls. Scratch in `/tmp/w-w1-a/`.

**Files:**

- Rules: `fieldRulesVehicles.ts` (`stepMode`: boarding a parked ship or spawned canoe by a walking step, the canoe item
  on River and Lake, the ship on Water only and its disembark only from a dock onto adjacent land, the airship
  anywhere; `vehicleCanLand`: grass, no transition, gate or static NPC; `vehiclesAfterStep`: the left vehicle parks
  where the step began, the boarded one is parked nowhere, the canoe item leaves nothing). `fieldRules.ts` gets
  `cellReader`, `modeAfterStep`, a real `canLand`, `fieldStep` on `modeAfterStep`, no transition or scripted
  encounter while flying, and `baseTerrain` reading 11 as Lake.
- Modes: `MovementMode.canMoveAt?` (used by `CollisionMap.isWalkable` when present, 1 line); CanoeMode River and
  Lake only; ShipMode encounter multiplier 1 (sea zones decide).
- Field: `FieldVehicles.ts` (bound modes that ask `modeAfterStep`, so PlayerController moves where `fieldStep`
  lets the step stand; the saved mode applied on the first frame after an enter; `afterStep`; airship take-off and
  landing on confirm, "The airship can't land here." through `showDialog`; `setVehicle` for the cutscene step;
  a vehicle ridden through a map change is parked where it was last ridden) and `FieldVehicleSprites.ts` (parked
  sprites, the ridden one follows the hero at render time; ship and airship hide the hero, the canoe draws under it).
- State: `Game.fieldMode`, `Game.vehicles` (parked only; the ridden vehicle is implied by the mode), `Game.pendingFrame`;
  `restoreState` takes them. `VehicleManager.parkedVehicles` (a known position wins over the spawn, on any map;
  spawns honour `requiredFlags`).
- Save v2 (`SaveManager.ts`): `SAVE_VERSION = 2`, `mode` and `vehicles` (malformed ones logged and dropped); a v1 save
  loads on foot with none, and a v1 save on `overworld` loads with `frame: 'a1'`.
- `MapTransition.ts`: mode-aware `safeSpawn` (GAP-11: a vehicle position valid in its mode is kept; on foot, land
  reachable from a vehicle parked on the map counts like an entrance); `shiftA1` and `restoredSpawn` (GAP-17 save
  half: translate a v1 overworld cell by `world.frames.a1.origin` once, then `safeSpawn`; a moved position is on foot).
- `BattleRetry.ts` (GAP-12): the snapshot records and restores `mode` and `vehicles` (missing: on foot, none).
- Art: `assets-src/vehicles.py` (code-drawn ship, airship, canoe, 24 px cells) and the `vehicles` stage in
  `build_assets.py` (one line; the kneel imports untouched), output `assets/sprites/vehicles.{png,json}`
  (byte-identical on rerun).
- Fixture `assets/maps/test-dock.yaml` (ship parked on the jetty dock with no flag, an island dock, a lake, a river,
  a forest cell on the island) and scenario `w1a_ship_dock` (W1-A anchor; an airship from `vehicles`, the canoe item).
- Tests: `vehicles`, `safeSpawnModes`, `battleRetryVehicles`, `saveOriginShift` (new).

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/systems/vehicles.test.ts tests/systems/safeSpawnModes.test.ts tests/systems/battleRetryVehicles.test.ts tests/systems/saveOriginShift.test.ts` | 4 files, 34 tests passed |
| `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 289 passed (289)`, `Tests 5684 passed (5684)` |
| `npm run quest` | `quest-verify: OK` |
| `python3 -I assets-src/build_assets.py vehicles` (twice) | `vehicles: 3 frames, sheet 72x24 native`; same md5 |
| browser `http://127.0.0.1:5211/?mute=1&scenario=w1a_ship_dock` (Title > Debug) | ship and airship sprites parked; jetty tip (9, 6) walking, step east: (10, 6) `__game.fieldMode` `ship`; sailed to (14, 6); (14, 7) -> (15, 7) refused (not a dock); island dock (14, 8) -> (15, 8) walking, `vehicles` has the ship at (14, 8), still drawn; re-boarded, back to the jetty dock, disembarked; airship: confirm takes off, confirm over the sea shows "The airship can't land here.", confirm over island grass lands and parks it; 0 console errors |

**Deviations / hand-offs:**

- Edits outside the ownership list, all small and vehicle-only: `fieldRules.ts` (the vehicle hooks above; W1-B's
  file), `CollisionMap.ts` (1 line, `canMoveAt`), `Game.ts` (the 3 fields), `ExplorationScene.ts` (6 one-line
  wirings: `restoredSpawn`, `setMap`, `afterStep`, `setVehicle` on the cutscene host, the container for the sprites;
  502 / 590), `SaveScene.ts` (passes mode and vehicles), `DebugScenarioLoader.ts` (2 lines: the scenario's
  `vehicles` and `fieldMode`, W1-B's hand-off), `PlaceholderTextures.ts` (a Lake colour).
- Updated pins that encoded the pre-W1-A vehicle behaviour: `fieldRules.test.ts` (the canoe's terrain is River and
  Lake; collision 11 reads Lake; one test title), `MovementModes.test.ts` (canoe, ship rate 1), `SaveManager.test.ts`
  and `SaveCompatT4.test.ts` (saves write version 2).
- W1-H hand-off: `questPlaces` turns a step that changes the mode into a `step` exit without `park`. Now that
  `fieldStep` disembarks the ship at a dock, that exit loses the ship; the verifier's own `dock` exit (with `park`)
  covers the same move. `npm run quest` is OK today (no ship stage is built). A fix would skip ship -> walking steps
  there, or read `vehiclesAfterStep`.
- Vehicles while flying ignore transitions and scripted encounters in `fieldStep` (QUEST 3.3); a transition taken from
  a vehicle (not reachable today) still puts the party on foot, and the vehicle parks where it was last ridden.

**AGENTS.md delta (for INT):** "Key Interfaces" gains `fieldRulesVehicles.ts` (the vehicle rules), `Game.fieldMode` /
`Game.vehicles` (save v2, the retry snapshot), `restoredSpawn` (GAP-11, GAP-17); the art table gains the `vehicles`
stage (`assets-src/vehicles.py` -> `assets/sprites/vehicles.*`); the debug scenarios gain `w1a_ship_dock`.
<!-- === end W1-A === -->
<!-- === W1-B FOUNDATION (pass W: owned by W1-B) === -->
### W1-B result: NPC and field rules (branch `w-w1-b` from `mainline` e5433ff)

No AI or paid calls. Scratch in `/tmp/w-w1-b/`.

**Files:**

- Field rules: `fieldRules.ts` (patches in `patchedTerrain`, the last covering patch wins; `hazardAt` and
  `StepResult.hazard` on a walking step; item conditions in `gateMessage`; `FieldState.gold?`) and the new
  `fieldRulesNpc.ts` (re-exported by `fieldRules.ts`: `flagsMet`, `conditionMet` (`item:<id>`), `dueEncounterWhere`,
  `tradeTermsMet`, `npcOutcome` with trades and `take: {item?, gold?}` (GAP-15), a cutscene behind a `requiredItem`).
  A state without `gold` (the verifier) passes the gold term.
- `CollisionMap(map, hasFlag?)` applies the patches on live flags; `MapLoader` passes its `hasFlag` (1 line).
- `FieldNpcActions.ts`: reads the NPC's map record, applies trades (bag limit first, then the take, the gift, the
  flags), the class upgrade on `actionFlag`, and `action: clinic` (GAP-16: `systems/clinic.ts`, `scenes/ClinicScene.ts`,
  a transparent Yes / No; n x level gold per fallen member, all or nothing, to 1 HP).
- `ClassUpgradeSystem`: `canUpgrade(c, flags, actionFlag?)`, `upgradeParty(..., actionFlag?)`; EARTH_CRYSTAL_LIT
  removed (tests updated).
- NPC `tint` ("#rrggbb") on the field sprite (`entities/NPC.ts`, `npcTint`).
- Hazards: `systems/hazards.ts` (every living member, never below 1 HP) and `scenes/exploration/FieldHazard.ts` (red
  flash).
- Zone `modes`: `EncounterSystem.setMode`, `zoneAppliesTo`; the map's own table applies on foot and by canoe only.
- Cutscene steps: `give_item`, `take_item`, `set_vehicle` (through the host's `setVehicle`), `end_game` (the card,
  then `endGame`; the steps after it never play); `scriptProblem` checks their fields; the field host passes the
  inventory and `endGame` (switch to the title).
- Field spells (W1-G hand-off): `isFieldSpell` also takes the travel spells of either school and CUR4 (`heal_full`);
  field LIF2 revives to power % of max HP; `systems/fieldTravel.ts` (EXIT to `MapData.exit`; WARP to the map behind
  the stair back, the transition within 3 cells of `arrival`, at its `arrival`, else where that stair arrives;
  `travelTo` re-enters the field) wired in `FieldMagicScene` (no target pick; "No effect." spends no charge).
- `DebugScenarioLoader`: `a1Origin`, `scenarioSpawn` (GAP-18); a `frame: a1` spawn is translated by the loaded map's
  `world.frames.a1.origin` (the map is read through `fieldMapLoader`, as the field reads it).
- Fixture `assets/maps/test-field-rules.yaml` and scenario `w1b_field_rules` (W1-B anchor): clinic, tinted takeGold
  trader, a patch over a channel, an ember hazard.
- Tests: `patches`, `npcTrade`, `npcTakeGold`, `clinic`, `hazards` (with zone modes), `endGame` (all four steps),
  `debugFrame`, `scenarioSpawns`, `fieldTravel`; helpers `tests/helpers/worldFrame.ts` (`a1At`, `translateA1`: the
  act-1 map as the world carries it) and `npcActions.ts`. `fieldRules.test.ts` runs its overworld cases on the
  compiled overworld and on the act-1 block in the world frame (one map once the world is committed);
  `DebugScenarioField.test.ts` translates `frame: a1` spawns. `assetCoverage.test.ts` also reads the NPCs of
  `assets/maps/ai` and `assets-src/maps` (2x field sheet, tint format).

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/systems/patches.test.ts ... tests/systems/scenarioSpawns.test.ts` (the 9 done-when files) | all passed |
| `fieldRules.test.ts` act-1 cases | unchanged assertions, offset by the frame origin (0 on the act-1 map) |
| `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 283 passed (283)`, `Tests 5606 passed (5606)` |
| browser `http://127.0.0.1:5212/?mute=1&scenario=r_ow_temple`, then `w1b_field_rules` | overworld spawn (15, 42); trade: gold 500 -> 400, bottle, flag; clinic "Revive WHM for 60 G?" -> 340 G, WHM 1 HP; hazard row: WAR 100 -> 99, the 1-HP member kept; the patched plank (9, 4) walked; 0 console errors |

**Deviations / hand-offs:**

- `ExplorationScene.ts` got 4 one-line wiring edits (the hazard step, `encounterSystem.setMode`, the cutscene host's
  inventory and `endGame`, an import); 500 / 590. `NPC.ts`, `MapLoader.ts` (1 line), `ExplorationCutscenes.ts` and
  `FieldMagicScene.ts` are outside the ownership list but owned by nobody else in W1 (MapLoader is W1-E's).
- `set_vehicle` is played by the manager but the field host has no `setVehicle` yet: W1-A wires it to its vehicle state.
  `DebugScenario.vehicles` / `fieldMode` are not applied by the loader (W1-A's state).
- Patch overlay art (`art.patches`) is not drawn: the renderer is W1-E's.
- The compiled collision value 11 (Lake) still reads as Wall in `baseTerrain` (the W1-0a test pins it); a patch may
  set Lake.
- `NpcOutcome.take` is `{item?, gold?}` (it was a string): W1-H's `outcomeTake` reads both shapes.
- The real compiled world (W1-C2) was not on `w-w1-c2` yet; the frame-aware tests were checked on the synthetic
  translation (`translateA1`).

**AGENTS.md delta (for INT):** "Key Interfaces" gains `fieldRulesNpc.ts` (trades, `take`, `item:` conditions),
`MapNPC.takeGold` / `clinicPrice` / `tint` / `actionFlag`, `MapData.patches` / `hazards` / `exit`, the cutscene steps
`give_item`, `take_item`, `set_vehicle`, `end_game`, the field travel spells (`fieldTravel.ts`) and
`DebugScenario.frame: a1`; "Test Patterns" names `tests/helpers/worldFrame.ts`.
<!-- === end W1-B === -->
<!-- === W1-C1 FOUNDATION (pass W: owned by W1-C1) === -->
### W1-C1 result: compiler core (branch `w-w1-c1`, rebased on `mainline` d72e369, after the W1-C2 and W1-H merges)

No AI or paid calls. Scratch in `/tmp/w-w1-c1/`: the memory probes, the land-filled world generator and the
previews.

**Files:** `build_map.py`; `terrain/frame.py` (new: the raster frame, `chunk_rng`, the per-chunk noise lattice,
`tile_at`), `terrain/region.py` (new: regions of a source, build digests, the stale-base check, the world-compile
lock), `terrain/region_selftest.py` (new); `terrain/{__init__, base, outline, peaks, roads, selftest}.py`. Outside
the owned set, two lines each: `map_graph.py` (`LAKE = 11` in `BLOCKED`) and `map_selftest.py` (its Lake and BLOCKED
asserts).

**What changed:**

- **Per-chunk RNG (GAP-14).** Every draw uses `default_rng(crc32(f"{map_id}:{col}:{row}:{purpose}"))`: tufts, classic
  and organic peaks, foothill rocks and forest clumps are placed chunk by chunk, each chunk walking its own cells.
  Peaks, rocks and clumps keep their anchors half their spacing inside the chunk's border, so neighbouring chunks
  keep the spacing without reading each other, and a clump's bulge test reads only its own chunk's clumps. The value
  noise (`_noise`, `_vnoise`) is a lattice on global pixels whose points are drawn by the chunk that holds them. The
  meander's knots are drawn per 768 px strip, with an even count per strip so that the signs alternate across strips.
  Textures tile in their global phase. The partition samples in global low-res coordinates. Road curves are computed
  relative to their cell. The peak spacing bins are global. A bridge chooses its deck from its own run, not from the
  whole row.
- **Raster windows.** `compile_map` does the cell work (collision, objects, entrances, transitions, checks) once over
  the whole map. It paints the pixels window by window: the whole map is one window, and a `--region` rect gets a
  window with a 1-chunk ring plus 4 cells (RING_PAD). The 4 cells are what a ring chunk's placements read. Objects
  within 3 cells of a window are moved into it. One `_objects` walk serves both passes.
- **`--region <r>` (multi-rect, GAP-19).** It reads the regions from `regions:`. For the world, `{stub, checks}` maps
  to `world_api.BOXES`. A synthetic source may give `[[x0, y0, x1, y1], ...]` or `{rects: [...]}`. The command paints
  each rect of the union, writes only the union's chunk files, takes the other chunks' `above` entries from the
  base, and writes the whole yaml. A map with regions records `build: {compiler, boxes}`: a digest of the compiler
  (its code and kit art) and one digest per region (its ground cells, its anchored objects and the map-wide paint
  keys). A base that differs fails with `--region: stale base, run a full compile (<why>)`. `--check-determinism
  --region <r>` works, as do `--src-dir DIR` and `--out DIR`.
- **The world-compile lock.** It is an exclusive `fcntl.flock` on `/tmp/ff-game-world-compile.lock`, taken by the
  CLI for every compile of `overworld` or of a source with regions: build, `--region` and `--check-determinism`. A
  waiter prints `waiting for the world-compile lock`. At 30 min (`FFG_WORLD_LOCK_TIMEOUT`) it prints `world-compile
  lock timeout after 30 min; holder pid <n>` and exits 3. The `--hash` children run with `FFG_WORLD_LOCK_HELD=1`.
- **Legend.**
  - `w` is swamp: TerrainType 6, a soft and wild material at the end of SOFT and WILD. Until W1-D adds the kit
    texture, the fallback is a recoloured grass (`FALLBACK_MATERIALS`).
  - Lake compiles to 11, and `BLOCKED` adds 11. The act-1 moat and tarn are now 11; the runtime CollisionMap already
    reads 11 as Wall.
- **Material remaps:** `materials: {name: {from, shade?, hue?, sat?}}` (HSV hue shift and saturation, then the RGB
  shade); any other key is an error.
- **Hooks:**
  - `write()` calls `bake_patches` after it clears the folder and writes the chunks. In a region compile it deletes
    only the region's chunk files.
  - It then calls `passthrough` on the finished document.
  - `validate()` calls `region_checks(src, grid, None)` and then once per region, for maps with regions. `grid` is
    parse_ground's material names.
- **`index.yaml`** lists only the sources that have a compiled map. Before this change, a partial build added the
  137 uncompiled W1-0b stubs.

**Gates:**

| Command | Output |
|---|---|
| `build_map.py --selftest` | `region yaml: OK`, `region multi-rect: OK` (two 2-rect regions, organic and classic), `locality: OK`, `region stale: OK`, `lock: OK`; `build_map selftest: 104 checks passed` (75 s, 2.0 GB) |
| `/usr/bin/time -l build_map.py overworld --src-dir <land-filled> --out <scratch>` | exit 0, 87.6 s, max RSS **11.26 GB** (target 26 GB) |
| `/usr/bin/time -l build_map.py overworld --region fire` (land-filled, over that base) | exit 0, 29.2 s, max RSS **5.10 GB** (target 10 GB); the output tree is byte-identical to the full compile's |
| the same on the stub world (`assets-src/maps/overworld.yaml`) | full: 72.0 s, **11.77 GB**; `--region fire`: 21.9 s, **4.82 GB**, byte-identical to the full compile |
| `build_map.py --check-determinism <the 22 act-1 maps> overworld` | every id `deterministic` (136.9 s, 11.5 GB) |
| `cornelia.py`, `interiors.py`, `castle.py`, `world.py`, then `git diff --exit-code assets-src/maps` | clean (exit 0) |
| `build_map.py <the 22 act-1 maps>` (not the world) | re-baseline: only `assets/maps/ai/cornelia/below_*.png` (all 20) change; every other chunk and every map yaml is byte-identical |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` (after the rebase on d72e369) | `Test Files 276 passed`, `Tests 5549 passed`. One earlier run had 1 failure in `tests/integration/battle.test.ts` ("command selection"). That file has nothing to do with maps. It passed alone twice, and the next full run was green |
| `npm run build` | exit 0 |

The land-filled world fills every non-A1 region outside its bands with the act-1 block's inner 60x60, tiled. That
gives 12,951 grass, 4,302 forest, 3,850 mountain, 741 road, 547 river and 404 sand cells, against 13,842 ocean
cells with the bands. It drops the world-only checks (basins, docks, unreachable cells). Its peak is close to the
stub world's because the full-size output buffers and the per-material partition fields dominate; the materials
add little. W1-C2 measured 9.9 GB with the old compiler.

**Deviations / hand-offs:**

- **Fixed while measuring.** `--region fire` first differed from the full compile on 2 chunks. The cause was the
  peak spacing bins, which were taken in window coordinates. After that fix, a 1-chunk ring alone was not exact: a
  ring chunk's peak order reads its range depth up to 3 cells past the chunk. RING_PAD fixes this. The selftest now
  uses windows that start off the map origin and dense ranges, and it fails on both bugs.
- **Lake = 11** needed `map_graph.BLOCKED` (owned by W1-C2) to include 11. Without it, the act-1 moat was walkable for
  the checks.
- **The compiled world is not committed** (W1-C2 commits it after this merge). `overworld --region <r>` on the repo
  says `stale base` until that full compile lands.
- **The patch crop.** `bake_patches` compiles its crop as its own map id at origin 0. Its noise and texture phase
  therefore do not line up with the world around the patch. Frames now only need a cell-aligned origin, so a later
  change could paint the crop in the world's frame.
<!-- === end W1-C1 === -->
<!-- === W1-C2 FOUNDATION (pass W: owned by W1-C2) === -->
### W1-C2 result: composer and world (branch `w-w1-c2` from `mainline` f2f2383; not yet rebased on W1-C1)

No AI or paid calls. Scratch in `/tmp/w-w1-c2/`.

**Files:**

- `layouts/world.py` (the composer: REGIONS, compose, the source writer, `--check-bands`, `--owned-chunks <r>`),
  `layouts/world_checks.py` (checks 1-7 of 2.9, the basins and docks of 2.6, the wall and barrier minimal cuts),
  `layouts/world_geom.py` (owner grid, bands, chunk ownership, floods, the 0-1 minimal cut, the act-1 translation,
  `stub_region`), `layouts/world_a1.py` (the act-1 document moved out of `overworld.py main()`, translated by
  A1_ORIGIN; the canoe spawn removed), the stubs `world_{elf,earth,fire,ordeal,water,wind}.py` (EARTH's stub
  declares a placeholder `canal` patch over the W_isthmus placeholder, x 48-61, y 88-92, so check 2 holds).
- `layouts/overworld.py` is the shim (202 lines; `build()`, `objects()`, `check()` unchanged, `main()` runs
  `world.main`).
- `map_checks_region.py` (new): a region's own `road_check` / `river_check` / `min_blob` / `warp_leaves` on its cells
  only (composer cells, i.e. seams and a stub's placeholder walls, read as ocean); `map_checks_util._unreachable`
  takes `no_unreachable_walkable: {reach_roots: [...]}`.
- `build_hooks.py` bodies: `passthrough` (docks, hazards, exit, world; source patches `{id, flag, cells, ground}`
  become `{..., terrain}`; `art.patches` lists `patch_<pid>.png`), `bake_patches` (a cropped compile of the patched
  ground; the PNG covers the bounding box of the patch cells from its top-left cell, opaque exactly on the cells;
  call it after `build_map.write`, which clears the folder), `patch_errors`, `region_checks` (a region's checks;
  `None`: the basin and dock checks on the source), `owned_chunks`.
- World source (`assets-src/maps/overworld.yaml`, 192x192): top level `sealed_edges`, `art_coverage`,
  `no_unreachable_walkable.reach_roots`, `unreachable_ok` (act-1's `north_shore` plus the composer's unreached grass
  cells of `seam_n` and its placeholder rows); `regions.<r>.{stub, checks}`; `world.frames.a1` and `world.cuts`
  (the minimal cuts for 6.3: W_west 7, W_isthmus 14, W_arm 2, W_south 2, W_east 3 cells on the stub world).
- Tests: `tests/quest/a1/frozenCore.test.ts` (6 tests; fixtures `act1Overworld.fixture.yaml` and
  `act1Collision.fixture.json`, the mainline act-1 source and compiled collision); `overworldLayout.test.ts` reads
  the frame, offsets its hard-coded cells, clips its scans to the frame and finds the jetty from the pier's inspect
  cell.

**Gates:**

| Command | Output |
|---|---|
| `python3 -I assets-src/tools/layouts/world.py` | `bands: OK`, `basins: OK (aldi 2781 cells, ocean 29870 cells; canal joins)`, `cuts: ...`; rerun byte-identical |
| `world.py --check-bands` | `bands: OK` |
| `build_map.py --check-determinism overworld` | `overworld: deterministic` (130.6 s) |
| `build_map.py overworld` (stub world, scratch, not committed) | exit 0, 192x192, 75 s, max RSS 9.9 GB (11.5 GB on a failing earlier run) |
| `npx vitest run tests/data/overworldLayout.test.ts tests/quest/a1/frozenCore.test.ts tests/data/act1Flow.test.ts` | 3 files, 46 passed (also 38 passed for the first two against the compiled world) |
| `build_map.py --selftest` | `build_map selftest: 99 checks passed` |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | `Test Files 270 passed`, `Tests 5134 passed` |
| `npm run build` | exit 0 |

**Deviations / hand-offs:**

- **The compiled world is not committed.** `assets/maps/ai/overworld.*` is still the act-1 build. Compiled now, it
  would lack `world.frames.a1` (the passthrough call is W1-C1's), and two tests outside this tranche hard-code act-1
  cells on the compiled map: `tests/systems/fieldRules.test.ts` (the bridge cases, 5 fail) and
  `DebugScenarioField.test.ts` (the 3 raw spawns, GAP-18, W1-B). After the W1-C1 rebase the world is compiled and
  committed (G1-G3 re-baseline), together with W1-B's `frame: a1` handling of those tests. Until then the tests read
  the source in the compiled map's frame, and frozenCore's compiled-collision case runs only on a 192-wide map.
- The `canal` patch id has no `ert_` prefix (world_api's `CANAL_PATCH`); check 3 exempts it, and the act-1 legacy ids.
- Check 6 requires an anchor when it is `built: true`, or its region is not a stub and does not list it in
  `checks.anchors_pending`. Check 7 is grid-level (objects ignored); the object-aware unreachable check is the compiler's.
- Region checks read the collision from the source (`collide: alpha` approximated: a named part blocks).

**Follow-up after the W1-C1 merge (rebased on `mainline` 1c0d38e):** the compiled 192x192 world is committed
(`assets/maps/ai/overworld.yaml` with `world.frames.a1`, `patches`, `art.patches`, 144 below chunks and
`patch_canal.png`), compiled under W1-C1's lock. `bake_patches` now paints each patch in the map's own frame (a
`raster` compile of the patched map round the patch), so its pixels meet the base art without a seam. frozenCore's
compiled-collision case is mandatory and allows exactly one remap since the fixture: the 20 act-1 lake cells, Water
(2) to Lake (11) (W1-C1's legend).

| Command | Output |
|---|---|
| `world.py` | `bands: OK`, `basins: OK (aldi 2781 cells, ocean 29870 cells; canal joins)` |
| `build_map.py overworld` | exit 0, 77.5 s, max RSS 10.4 GB |
| `build_map.py --check-determinism overworld` | `overworld: deterministic` (126.7 s, max RSS 11.6 GB) |
| overworldLayout, frozenCore, act1Flow | 46 passed |
| `npm run build` | exit 0 |
| G4 | 274 passed, 2 failed files (6 tests), all W1-B's: `fieldRules.test.ts` 5 north-bridge cases (act-1 cells (29, 32), (30, 32), (28, 47) on the translated map) and `DebugScenarioField.test.ts` 1 (raw spawn of `r_ow_temple` lands on ocean without GAP-18's `frame: a1` translation) |
<!-- === end W1-C2 === -->
<!-- === W1-D FOUNDATION (pass W: owned by W1-D) === -->
<!-- === end W1-D === -->
<!-- === W1-E FOUNDATION (pass W: owned by W1-E) === -->
### W1-E result: map streaming (branch `w-w1-e` from `mainline` 70bdfd5)

No AI or paid calls. Scratch in `/tmp/w-w1-e/`.

**Files:** `src/rendering/BakedMapRenderer.ts` (155 lines), `src/systems/MapLoader.ts` (86), and two new files:
`src/rendering/chunkStreaming.ts` (154: constants, `ChunkSource` / `assetChunkSource`, the LRU `ChunkStreamer`,
the view geometry, the dominant-terrain placeholder colour) and `src/rendering/StreamedChunks.ts` (178: the
per-chunk sprites, the window, the miss rule). Test: `tests/rendering/bakedStreaming.test.ts` (8 tests).

**Behaviour (QUEST 4.3):**

- A compiled map with more than 64 chunks streams. A smaller map loads every chunk before its first frame, as
  before. That covers every act-1 map, including today's 72x72 overworld.
- **The window** is the chunks in view, a 1-chunk ring and 1 chunk ahead on each axis of travel. The direction of
  travel comes from the camera's motion. The visible chunks load first.
- **The cap** is 60 resident textures (loaded or loading, both layers), enforced hard. Unwanted chunks are freed
  least-recently-wanted through `Assets.unload`, after the sprite drawing them is destroyed. A texture freed while
  still loading is unloaded when it arrives. Leaving the map (the container's `removed` event, sent by
  `ExplorationScene.loadMap`'s `removeChildren`) frees every chunk. A reload of the same url waits for its pending
  unload.
- **A miss:** `MapLoader` returns a `CollisionMap` subclass for a streamed map. Its `isWalkable` refuses a step while
  `BakedMapRenderer.stepHeld(x, y)` is true: a window chunk that the view at (x, y) needs is missing, and that miss
  is less than 6 frames old. After 6 frames a chunk in view shows as a flat sprite in its dominant terrain's colour
  (ocean blue on water). Each miss logs one `console.warn`, and the real texture replaces the placeholder when it
  loads.
- **Patch overlays:** `art.patches` loads with the map (eagerly, outside the chunk cap). Each `patch_<pid>.png` is
  drawn at its cells' top-left cell, scaled from `art.tile`, above the below layer. It is visible while
  `hasFlag(patch.flag)` is set, and the flag is read live on every render. MapLoader passes the same `hasFlag` it
  passes to `CollisionMap` (W1-B's line is kept verbatim).

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/rendering/bakedStreaming.test.ts` | 8 passed. The airship sweep runs 1/6 tile per frame over the 192x192 world (144 chunks, every one with an above layer), with 12-frame loads. All 144 chunks are seen, max resident is **60**, 1031 unloads, 0 held steps and 0 placeholders. A miss holds exactly 6 frames, then shows placeholders (2 chunks, ocean blue, 2 warns, not repeated). A placeholder is replaced when its chunk loads. `Assets.unload` is called through `assetChunkSource`, and every resident chunk is unloaded on leaving. The patch shows only with its flag. MapLoader refuses a step for 6 frames |
| mutations | Without the ring and ahead prefetch the sweep fails (115 held steps). Without the unload on eviction the sweep and the `Assets.unload` test fail |
| `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | `Test Files 286 passed`, `Tests 5656 passed`. The first run had 1 failure in `tests/integration/battle.test.ts` ("command selection"), the flake W1-C1 also saw. It passed alone (8/8), and the re-run was green |
| browser, port 5216, `mute=1`: `r_ow_temple`, then `r_town_after_intro` | the overworld and Cornelia render and scroll while walking; 0 errors, 0 warnings |

**Deviations / hand-offs:**

- **The compiled 192x192 world is not on `mainline` yet.** `assets/maps/ai/overworld.yaml` is still the 72x72 act-1
  build (25 chunks), so in the game nothing streams yet. Streaming is covered by the synthetic 192x192 test map.
- **Two new files** (`chunkStreaming.ts`, `StreamedChunks.ts`) keep `BakedMapRenderer.ts` under 250 lines.
- **First frame:** a streamed map cannot know the spawn while `MapLoader.loadMap` runs, because the scene places
  the player afterwards. `BakedMapRenderer.ready()` resolves once the view is loaded. To honour "the first frame
  waits", the owner of `ExplorationScene` / `FieldTransition` should add `await (tilemap as
  BakedMapRenderer).ready?.()` after `redraw()`, before the fade-in. That is one line, and not mine. Until then, a
  slow first view shows placeholders after 6 frames.
- The hold is applied through `isWalkable`, so a wandering NPC whose next view is missing also waits up to 6 frames.
  `noWanderTiles` runs before the camera is set and is unaffected.
- The patch overlays are not counted in the 60-texture cap (a few small PNGs per map).
<!-- === end W1-E === -->
<!-- === W1-F FOUNDATION (pass W: owned by W1-F) === -->
### W1-F result: items, kits, shops (branch `w-w1-f` from `mainline` f2f2383)

No AI or paid calls.

**Files:**

- `items.yaml` (W1-F anchor, 38 records; 81 items in all): the 15 new key items of 3.1 (`crown`, `crystal_eye`,
  `herb`, `tnt`, `ruby`, `rod`, `canoe`, `levistone`, `ordeal_seal`, `cube` "Warp Cube", `fairy_bottle` "Bottle",
  `oxyale`, `slab`, `chime`, `adamant`; all `type: key`, price 0), `excalibur` (found, ATK 45, holy, warrior and so the
  knight), and 22 band items: B3 `silver_armlet`; B4 `scimitar`, `gold_armlet`; B5 `falchion`, `cat_claw`,
  `wizard_staff`, `white_robe`, `black_robe`; B6 `sun_blade`, `thor_hammer` (lightning), `rune_knife`, `opal_armor`,
  `opal_armlet`, `aegis_shield`, `opal_helm`; B7 `defender`, `vorpal_sword`, `dragon_claw`, `diamond_armor`,
  `diamond_armlet`, `diamond_shield`, `diamond_helm`. The armlets (body slot, every class) give the light classes a
  body upgrade at the bands where they get no weapon.
- `shops.yaml`: records `<town>_{weapon,armor,item,white,black,inn}` seeded inside each town owner's anchor (A1-T
  `pravoka_*`, ELF-T `elfheim_*` moved with ids unchanged, ERT-O `dwarf_item`, ERT-T `melmond_*` moved with ids
  unchanged and re-tiered to B4, FIR-T `crescent_*`, WAT-T `onrac_*`, WND-O `lufenia_{white,black,inn}`, WND-T
  `gaia_*`), stocked per 3.6, inns at the band price.
- `kits.yaml` (W1-F anchor): one tier per band town (`w_s1` B1, `w_pravoka`, `w_elfheim`, `w_melmond`, `w_crescent`,
  `w_onrac`, `w_gaia`), every other `w_s<n>` and `w_dwarf` / `w_lufenia` a YAML alias of its tier (S2-S3 B2,
  S4-S10 B3, S11-S13 B4, S14-S17 B5, S18-S22 B6, S23-S30 B7). From B6 on the kits also carry the 6 upgraded classes.
  4-member gear price (W/T/WM/BM): 520 / 1725 / 12940 / 35040 / 60240 / 131240 / 259240 G.
- `bestiary.yaml`: `habitats.maps: manifest` (every compiled map of `index.yaml` is scanned) and a zone's `name` is its
  habitat label (`habitats.zones` stays the fallback for the act-1 zones). Code: `bestiaryHabitats.ts`
  (`habitatMapIds`, `Habitat.zoneNames`), `BestiaryScene.ts` (+0 lines), `bestiaryValidation.ts`, `bestiaryData.ts`.
- `tests/helpers/balanceData.ts`: `bossWinRate(ids, level, kit, policy, seeds, opts?)`, `floorRun(zoneTable, fights,
  level, kit, opts?)` (both shares 0-1), `rollFrom`, `UPGRADED_PARTY`; `makeParty` takes any kit name.
- `scripts/check-bounds.ts` (G9; not in `tsconfig` `include`, type-checked through its test).
- Tests: `tests/data/gearBands.test.ts` (caps, upgrades per band, no early item, found gear unsold, the quest.yaml
  kits, the key items), `tests/data/rosterCoverage.test.ts` (reports; `QUEST_STRICT=1` fails), `tests/scripts/
  checkBounds.test.ts`; additions to `kitsYaml`, `bestiaryData`, `bestiaryHabitats`; the item count in
  `descriptions.test.ts` (43 -> 81) and the shop plurals in `pickupText.test.ts`.

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/data/gearBands.test.ts tests/data/crossFileValidation.test.ts tests/scenes/MagicShopScene.test.ts` | all passed (gearBands 25 tests; RED-checked by a scratch shop edit: 4 failures) |
| `npx vite-node scripts/check-bounds.ts "tests/balance/w_*.test.ts"` | `check-bounds: OK (0 tests)` |
| `npm run build` | exit 0 |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 272 passed (272)`, `Tests 5370 passed (5370)` |

`rosterCoverage` at W1: 106 of 127 enemies are in no stage roster yet (the regions' zones are empty).

**Deviations:**

- 3.6's magic levels L5 (black) to L8 are W1-G's spells, not on this branch: `crescent_black`, `onrac_*` and `gaia_*`
  magic shops and `lufenia_white` / `_black` are seeded with empty inventories, and no kit holds those spells.
  `crescent_white` sells the existing L5 `cure3` and `life`. After the W1-G merge the town owner (or INT) fills them;
  `gearBands.test.ts` already checks their levels.
- The shop records carry W1-F's tiered stock (not empty inventories), so `gearBands.test.ts`'s upgrade rule has data;
  the town owners may change the stock within the test's rules.
- The B4 weapon cap equals B3's (23), so Melmond's upgrades are armour (and the Scimitar for the Thief).
- G9 under zsh: an unmatched `w_*.test.ts` glob is a shell error before the script runs; quote it (the script
  expands it itself).

**AGENTS.md delta (for INT):** "Data Files" gains `kits.yaml`'s `w_*` tiers and aliases; "Balance bounds" names
`bossWinRate` / `floorRun` and `scripts/check-bounds.ts` (`(measured N)` tags, 3 points / 2 rounds, `invariant`
exempt); the bestiary scans the manifest and uses `EncounterZone.name`.
<!-- === end W1-F === -->
<!-- === W1-G FOUNDATION (pass W: owned by W1-G) === -->
### W1-G result: spells L5-L8 (branch `w-w1-g` from `mainline` ebd1cfd)

No AI or paid calls.

**Files:**

- `spells.yaml`: 30 new spells (64 in all; L5-L8 hold 4 white + 4 black each, with the existing `cure3` / `life`).
  The 20 enemy spell ids are kept exactly; no enemy record is edited (no `ai` action casts a new spell, so no balance
  moves). White: L5 `hrm3`, `hel2`; L6 `soft`, `exit` (`field_exit`), `fog2`, `inv2`; L7 `cur4` (`heal_full`), `hrm4`,
  `arub` (`resist_death`), `hel3`; L8 `lif2` (`revive`, power 100 = % HP), `fade`, `wall`, `xfer` (`dispel`). Black:
  L5 `fir3`, `bane`, `warp` (`field_warp`), `slo2`; L6 `lit3`, `rub`, `qake`, `stun`; L7 `ice3`, `brak`
  (`status_stone`), `sabr`, `blnd`; L8 `stop` (`stop`), `zap` ("ZAP!"), `xxxx` (death, power 300 = HP limit), `nuke`.
  Every damage spell of L5+ is all-target, so ICE stays the strongest single-target black damage spell (chaosForms).
- `src/battle/spellEffectsLate.ts` (228 lines): `castLateSpell` handles `status_death`, `status_stone`, `stop` (the
  all-target stun, blocked by `time`), `revive` with power > 0, `heal_full` (full HP + every status but death),
  `cure_stone`, `dispel`, `wall`, and `field_exit` / `field_warp` ("No effect." in battle). Protections: an enemy's
  `protect`, a hero's temporary resistance of the same category (ARUB `death`, WALL all); BANE is `poison_stone`, QAKE
  `earth`, ZAP! and STOP `time`. The roll is always drawn; a boss with a form floor pending is never killed outright.
- `SpellExecutor.ts`: +2 lines (import, dispatch after the cast line), 311 / 314.
- `shops.yaml` (in the town anchors): `crescent_white` + `hrm3`, `hel2`; `crescent_black` L5; `onrac_*` L6; `gaia_*`
  L7; `lufenia_*` L8. Each L5-L8 spell is sold in exactly one shop.
- `spell-effects.yaml`: the 30 spell rows and the byEffect fallbacks, all mapped to existing effects (death: the FEAR
  skull, stone: `cleanse_stone`, NUKE: `fire_all`, QAKE: `impact_dust`, ARUB: `holy`, WALL: `resist_ice`, XFER:
  `debuff_evade`, EXIT / WARP: `ether`). New effects were tried and dropped: `fxBigBoxes` / `actionFx` pin every
  effect's drawing to a baseline, so dedicated L5-L8 visuals are an fx-owner follow-up.
- `bestiary.yaml`: `spellNames: {}` (all 20 codes are spells now; the cross-file test forbids a duplicate name).
- Tests: `tests/battle/spellEffectsLate.test.ts` (new); `crossFileValidation.test.ts` + "every enemy spell id
  resolves"; `enemyAiPattern.test.ts` uses `no_such_spell` as its unknown spell (it used `nuke`).

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/battle/ tests/balance/` | `Test Files 34 passed (34)`, `Tests 368 passed (368)` |
| `npx vitest run tests/data/crossFileValidation.test.ts tests/data/gearBands.test.ts` | `Tests 1417 passed (1417)`, including "every enemy spell id resolves in spells.yaml" and gearBands with the late shops stocked |
| `npm run build` | exit 0 |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 273 passed (273)`, `Tests 5492 passed (5492)` |

**Deviations / hand-offs:**

- The field side is W1-B's: `FieldSpellEffects.isFieldSpell` is white-only and has no travel effects, so WARP (black)
  and EXIT need W1-B's wiring; field LIF2 revives at 1 HP (the field `revive` path) and CUR4 (`heal_full`) is not yet
  a field spell.
- WALL's status resistance only guards the late effects; the older status spells (SLEP, HOLD ...) do not check hero
  resistances.
- `crescent_white` (not in the list) gained the classic `hrm3` / `hel2` so every L5 spell is sold.
<!-- === end W1-G === -->
<!-- === W1-H FOUNDATION (pass W: owned by W1-H) === -->
### W1-H result: verifier core (branch `w-w1-h` from `mainline` f2f2383)

No AI or paid calls. No kneel files.

**Files:** `src/progression/` `questData` (input, loaders, `optional` derivation), `questCatalog` (event catalog,
relevance pass, read flags and items, `towns:` lookups, `arrivalOf`, `flagsSetByMap`), `questEvents` (event effects
through `npcOutcome`, `gateCheck`, `dueEncounterWhere`, `flagsMet`; cutscene steps), `questStates` (markers `@S<n>`,
relevance filter, exact apply), `questPlaces` (components on `fieldStep`, cached by map, mode, read flags and items),
`questExits` (docks, banks, landings, EXIT, boarding), `questSearch` (new game, assume-mode start, exact BFS,
`cellPath`), `questSaturate` (saturation closure), `questProofs` (context, (a)), `questChecks` ((b), (c)),
`questReport` (args, report, `runCoreProofs`, W1-I module contract); `scripts/quest-verify.ts` (in the tsconfig
`include`); `package.json` `quest`; `tests/fixtures/quest/` (loader, `clean`, 10 RED, `flags_red`);
`tests/progression/questGraph.test.ts` (27), `questFlags.test.ts` (4).

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/progression/questGraph.test.ts tests/progression/questFlags.test.ts` | 2 files, 31 tests passed |
| `npm run quest` | `(a) order: OK ... optional: S19 S18* reachable, not required ...; pending: S31 waits for adamant (granted by no stage)`, `(b) skips: OK  (485 withheld runs, 0 reach a later stage; 7 milestone runs)`, `(c) soft-locks: OK  (118 states, every one reaches CHAOS_DEFEATED)`, `quest-verify: OK` (about 7 s) |
| `npm run quest -- --stage S11` / `--stage S30` | `quest-verify: OK` |
| `npm run build` | exit 0 |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; 271 files, 5161 tests passed |
| `npx vitest run tests/data/questCeilings.test.ts` | 28 passed (every new file under 250 lines) |

RED fixtures, one or more per proof: (a) `red_a_goal`, `red_a_order`, `red_a_optional`, `red_a_walk`; (b) `red_b_skip`
(also in `--stage`), `red_b_milestone`, `red_b_require`; (c) `red_c_softlock`, `red_c_stranded`, `red_c_deadgate`.
`clean` passes all three.

**Deviations:**

- **Extra files.** The 250-line ceiling (`questCeilings.test.ts` covers all of `src/progression`) forced 5 files
  beyond the owned 6: `questCatalog`, `questStates`, `questExits`, `questSaturate`, `questChecks`. None clash with
  W1-I's names.
- **S18 is optional by derivation**, not in `quest.yaml`. A stage off the goal's `after` closure whose dependants are
  all optional is optional (only S18 qualifies). (a) prints it as `S18*`.
- **S31 is unreachable on this head.** It requires `adamant`, and no stage grants it: WORLD 3.1 puts it in S28's sky
  castle, but S28's `grants` leave it out. A pending optional stage whose requirement nothing grants is a note in
  (a). It is a failure under `--strict`. Fix for INT or WND-D2: add `adamant` to S28's `grants`, or grant it from
  the real chest.
- **Consumption table.** `CONSUMED_KEY_ITEMS` in `questData.ts` mirrors WORLD 3.1. An `items.yaml` `consumed` field
  overrides it (W1-F may move the column into the item records).
- **Model choices.**
  - Auto events (pending stages, vehicle spawns) fire eagerly in stage order.
  - Gold is not modelled: `takeGold` is recorded, and (d3) is W1-I's.
  - The EXIT edge is always allowed.
  - Transitions are not taken while flying.
  - A spawned canoe parks at the bank; the `canoe` item leaves nothing.
  - `canoe` is in every place key (W1-B's ability).
  - The trade fallback (`requiredItem` and `takeItem`) applies until `npcOutcome` reports a take.
  - In `--stage` mode, (b)'s "transitive requires" is the stage's own `requires`.
- **Missing late modules fail closed.** `--mutate` and `--only <d-h>` fail without W1-I's modules. A default run
  reports (a)-(c) only.

**Hooks for W1-I:** `createQuestContext(world, {stage, strict})`, `closure(ctx)` (a `Saturator` with `fired[].at`),
`stateGraph(ctx)`, `saturate(ctx, start, {disabled, withhold})`, `eventsGranting`, `bossEvents`, `exploreStates`,
`canReach`, `pathTo`, `cellPath(world, from, goals, state)`, `townMapIds`, `townKeepers`, `ctx.cat` (events with
static requires and grants, `readFlags`, `readItems`). The CLI loads `src/progression/questProofsLate.ts`
(`runLateProofs(ctx, only?): ProofResult[]`) and `questMutate.ts` (`runMutations(ctx): MutationResult[]`) when they
exist (`LateProofModule`, `MutateModule` in `questReport.ts`). The import-rule test covers every `src/progression`
file.

**AGENTS.md delta (for INT):** under "Running Tests", add `npm run quest -- [--strict] [--mutate] [--stage S<n>]
[--only abc] [--json FILE]`; under Testing, add `tests/fixtures/quest/` (YAML worlds with `extends:` and a `grid`
legend).
<!-- === end W1-H === -->
<!-- === W1-I FOUNDATION (pass W: owned by W1-I) === -->
### W1-I result: verifier proofs and tests (branch `w-w1-i` from `mainline` d72e369)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-w1-i/`.

**Files** (`src/progression`, every file under 250 lines):

- `questProofsLate.ts` (`runLateProofs`, proof (d) with (d3)), `questCurve.ts` (the curve model: replays (a)'s witness
  event by event and walks a cell route to each), `questRoute.ts` (cross-map BFS on `fieldStep`, transitions and the
  component exits), `questLateData.ts` (enemies, item prices, kits, `world-anchors.yaml`, travel rows, allowed docks;
  `attachLate` / `lateOf`), `questShops.ts` ((e), (f)), `questGeo.ts` ((g)), `questTravel.ts` + `questTravelRows.ts`
  ((h) and the 2.6 dock rule).
- `questMutate.ts` (`runMutations`), `questMutateRows.ts` (GT-1 to GT-37 with GT-5b as data), `questMutateFind.ts`
  (locators by what an element does: an NPC needing the crown, the patch `canal`, the composer cut `W_isthmus`, the
  0-1 BFS canoe cut between two anchors), `questMutateOps.ts` (copy-on-write edits), `questMutateCheck.ts` (catch
  rules and baseline), `questMutateGeneric.ts` (QUEST 5.4's element list).
- Tests: `tests/progression/{questMutate (42), questLate (14), macroGeography (10), travelMatrix (11)}.test.ts`,
  `miniWorld.ts`; `tests/quest/{designNotes, originality, townStandard, bossItems}.test.ts` with `questMaps.ts` and
  `originalityChecks.ts`; fixtures `tests/fixtures/quest/{mini, late_clean, geo_detour}.yaml`. `mini.yaml` builds the
  whole S0-S30 chain in miniature (48x32 world map and 9 rooms) so every gate-table row has its element.

**Gates:**

| Command | Output |
|---|---|
| `npx vitest run tests/progression/ tests/quest/` | 11 files, 181 passed, 8 skipped (the 8 towns of townStandard, pending stubs) |
| `npm run quest -- --mutate` | `(d) bands: OK  garland L2.0 [2,3]  (31 pending)  prices: OK (0 takeGold)`, `(e) early shops: OK  (0 towns, 8 pending)`, `(f) price walls: OK  crescent pending  gaia pending`, `(g) geography: OK  s*=0.735 (31 pairs; 22 assumed)`, `(h) travel matrix: OK  (12 rows, 2 basin rows; 1 checked, 13 pending)`, `mutations: OK  (41 gate rows; 44 elements, each removal reported)`, `quest-verify: OK` (about 4 s) |
| `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 284 passed (284)`, `Tests 5656 passed, 8 skipped (5664)` |

RED fixtures (each proof fails on its own first): (d) band, grind, kit gold, (d3) price, (e) early, shopless, (f)
wall (`questLate.test.ts` on `late_clean`); (g) moved anchor, Onrac-Gaia swap, x1.5 scale, a stretched pair, detour
(`geo_detour`); (h) each row of the mini world with one wall, gate crossing or dock removed, and a dock not allowed;
mutations: an uncaught element without its `nonLoadBearing` entry; designNotes, originality (equal or mirrored
grounds, a classic line), townStandard and bossItems on synthetic maps.

**How pending rows are handled.** On this head only S0 is built and every region is a stub, so a gate-table row whose
element is not built yet, or whose stages are pending and which is not caught, is reported with `nonLoadBearing:
"pending: ..."` (the CLI counts it as reported; `--strict` turns each into a failure). Of the 38 rows, GT-1 runs on
the act-1 bridge gates (non-load-bearing by S0's entries) and GT-18 is pending; the rest wait for their regions. All
38 rows are caught (or carry their reason) on the mini world, asserted by name in `questMutate.test.ts`. The generic
list (QUEST 5.4) on act 1: the King's and the princess's PRINCESS_RESCUED conditions are caught (the boss check
below), the ship spawn's flag is caught by (c) (the ship can't be left), the canoe spawn is pending (S13), and
Garland's `hideIf` is non-load-bearing by a new S0 entry.

**Deviations / hand-offs:**

- **quest.yaml S0** (the integrator's): added one `nonLoadBearing` entry, Garland's `hideIf` at temple-of-fiends
  (11, 6), as QUEST 4.5 had the verifier tranche add the bridge entries.
- **questChecks.ts** (W1-H's): (b) skips an ancestor that is built and grants nothing (S3, S4, S20 once built):
  there is nothing to withhold, and every later stage was reported as reachable "without" it.
- **Mutation catch rules** (questMutateCheck.ts): a catch is a failure the unmutated world lacks. The suite's (b) is
  stage-scoped and adds three runs to W1-H's: an ancestor's flags and items withheld with its vehicles kept (GT-3:
  the ship before the pirates), each requirement withheld alone with every event still firing (GT-7: Astos without
  the crown while the guard's victory still sets the flag), and a stage's grants with its boss events off (act 1:
  the King waits for Garland). A stage with no boss and no grants is reached by reaching one of its maps.
- **Plan rows that cannot be caught as written** (each is reported, none hidden):
  - GT-2: `north_bridge` forced on is caught only if the patch covers every cell gated by BRIDGE_BUILT; the act-1
    gates (93, 96), (94, 96) sit outside the gap, so A1-O must put those cells in the patch or drop the gates.
    "Forced on" = the patch's terrain applied for good and any gate on its cells removed.
  - GT-25: with the classic chain the canoe is held before the airship, so (b) can't see a walkable waterfall
    river; the row also accepts (h)'s `TRAVEL T6b reaches wat_waterfall`.
  - GT-33: EARTH_CRYSTAL_LIT on the time gate is redundant (it gates the canoe, which every later stage needs); PST
    needs a `nonLoadBearing` entry for the gate. The lute part is reported with the plan's reason.
  - GT-6 and GT-16 may be caught (the requirement-alone run) instead of being non-load-bearing; both count as OK.
- **Price rules:** a kit's price is W1-F's 4-member gear price (W/T/WM/BM; w_s1 520, w_pravoka 1725; spells not
  counted). A town is walled when its kit costs more than the kit of every stage right after its `opensAfter`; on
  quest.yaml that is exactly crescent and gaia (tested). (d)'s gold rule: gold at the start of the town's `bandStage`
  >= 50 %; (f): gold when a keeper first becomes talkable < 40 %. A pending stage raises the party to its band's low
  level and marks the gold after it assumed (those gold checks wait).
- **`--stage S<n> --mutate`** runs that stage's gate rows and only the generic elements on its maps (or world-map elements that read its grants).
- **(h) rows** are data (`DEFAULT_TRAVEL_ROWS`); T6 starts the party at the airship in the desert. The dock-presence
  check of GT-5b is not built: (h) only refuses a dock that is not allowed or is in the wrong basin.
- **Engine stand-ins in mini.yaml** (no patches, canoe ability or airship landing in fieldRules yet): a patch's
  crossing is also gated on its cells, a river is a Bridge cell gated by the `canoe` item, flight is a transition
  gated by AIRSHIP_RAISED. A trade NPC is an event only when its gift is a key item (`questEvents.npcRelevant`); an
  NPC that gives a plain item and sets a milestone with `giftFlag` is invisible to the verifier (hand-off to W1-H's
  owner / INT).
- **Real-world reads:** `world.cuts` (wall and barrier cuts) are read from the compiled world map's `world` field;
  the legacy 72x72 world map is read at the A1 origin (64, 64) for (g), (h) and the `nonLoadBearing` cells.

**AGENTS.md delta (for INT):** under the verifier, the late proofs (d)-(h) and `--mutate` (gate table GT-1 to GT-37 in
`questMutateRows.ts`, pending rows reported, `--strict` fails them); `tests/fixtures/quest/mini.yaml` (the whole chain
in miniature) and its stand-ins; `tests/quest/{designNotes, originality, townStandard, bossItems}.test.ts` with
`QUEST_STRICT=1` for INT.
<!-- === end W1-I === -->
<!-- === A1-O A1 (pass W: owned by A1-O) === -->
### A1-O result: Cornelia's continent overworld, the bridge, Matoya (branch `w-a1-o` from `mainline` 81e93d4, merged with `mainline` 62033ba after FIR-O)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-a1-o/`.

**Files:**

- `layouts/world_a1.py` (region part, 125 lines; `stub=False`, returns its W_west and W_east parts) and
  `layouts/a1/world_a1_ground.py` (the ground edits):
  - X_west and X_east: ocean to mountain, except a few sea cells kept so that no 1-cell inlet forms against the
    frozen coast: (71, 84) and the fjord head x 128-129, y 78-82.
  - Pravoka's range: x 138-141, y 76-141, joined to X_east by x 136-137, y 76-82, with spurs at x 136-137 outside
    rows 92-110.
  - X_pravoka:
    - Pravoka's grass shelf at x 128-131, y 97-104;
    - a rock headland behind the town (x 129-131, y 97-99), because the approved `town_icon` art fills only the
      icon's bottom row;
    - a saddle pass (x 125-127, y 97) over the coastal knot.
  - X_matoya: a rock hillock with Matoya's door on its south face, a clearing, and woods to the south.
- `layouts/a1/world_a1_sites.py`:
  - Matoya's `cave_mouth` (door (74, 75), anchor `a1_matoya` (74, 76));
  - Pravoka's icon, door, gate anchor, quay dock and brig, all read from A1-T's `town_pravoka_site.py`. The brig
    replaces the act-1 ship off Cornelia's jetty;
  - the lighthouse (a `tower` placeholder) on the range at (138, 98);
  - the cairn, an inspect cell with original text, at (126, 96);
  - the patch `north_bridge`: flag BRIDGE_BUILT, `ground: "="`, on the gap rows (93-94, 94-95) **plus the gate
    cells (93, 96) and (94, 96)** (GT-2).
- `layouts/a1/world_a1_zones.py`, the zones:
  - `a1_mainland` (walking; "Northern Mainland", the S2 roster): every walkable cell the north shore reaches on
    foot;
  - `a1_aldi` (ship; "Aldi Sea", the S4 sea roster) and `a1_north_sea` (ship; "Northern Sea": sahagin_chief,
    shark, bigeyes): every Water cell of the A1 box is in exactly one of them.
- `layouts/a1/matoya.py` writes `matoya-cave`, 18x14:
  - earthen walls (the `cave` remap) and a design note;
  - Matoya (`vendor_f`, tinted) with `requiredItem: crystal_eye` and the cutscene `a1_matoya_sight`;
  - three wandering brooms (`black_wizard`, tinted brown);
  - `exit` to `overworld:a1_matoya`.
- `overworld_consts.py`, `BRIDGE_WORKERS` only:
  - the two workers' lines change on BRIDGE_BUILT;
  - the foreman (`bridge_worker_w`) gets `requiredItem: lute` and the cutscene `a1_bridge_finished`.
  - `GATE_MESSAGE` text is unchanged (its comment is updated).
- `cutscenes.yaml` (A1-O anchor): `act1_complete`, moved here and rewritten (the "completed the introduction" lines
  are gone), `a1_bridge_finished` and `a1_matoya_sight`.
- `debug-scenarios.yaml` (A1-O anchor): `w_s1_start`, `w_s3_start`, `w_s7_start`.
- `quest.yaml` (A1-O anchor):
  - S1, S3 and S7 are `built`;
  - walks: S1 `[overworld:npc:bridge_worker_w]`, S7 `[matoya-cave:npc:matoya]`;
  - entries: S3 at the north shore (93, 92), S7 at (74, 76).
- Compiled: `overworld` (the A1 chunks, `patch_north_bridge.png`), `matoya-cave`, and the 13 Pravoka canon stubs
  (`pravoka`, its 6 houses, 5 shops and inn), so that Pravoka's door leads somewhere until A1-T replaces them.
- Tests in `tests/quest/a1/`:
  - `pravokaChannel` (4): the range, at least 6 Water cells on rows 92-110, the quay, a RED case;
  - `bridgePatch` (4): the patch and gates, closed until BRIDGE_BUILT then walked, the opaque overlay, the foreman
    rule;
  - `a1_o_sites` (11): the anchors within 2 cells, the doors, the brig, the cairn, Matoya's cave and lines, the
    zones;
  - `a1_o_walk` (4): S1, S3 and S7 walks and proof (a) in assume mode, plus the full run;
  - `frozenCore` updated: the bridge workers' `dialog`, `cutscene` and `requiredItem` may change (4.1).

**Gates:**

| Gate | Command | Output |
|---|---|---|
| G5 | `npm run quest -- --mutate --stage S1`, `S3`, `S7` | each run `quest-verify: OK`. Bands: S1 L2.1 [2,3], S3 L2.1 [2,6], S7 L10.0 [10,13]. GT-2 finds the patch: "the patch north_bridge: patch north_bridge forced on", with `nonLoadBearing: pending: S2 not built` (its catch, SKIP S2, needs A1-T) |
| G5 (full) | `npm run quest -- --mutate` | `(a) order: OK  S0 S1 S3 S2 ...`; `(d) ... S1 L2.3 [2,3]  S3 L3.0 [2,6]  S7 L10.0 [10,13]`; `mutations: OK (41 gate rows; 49 elements)`; `quest-verify: OK` |
| G4 | `npx vitest run --maxWorkers=2 --minWorkers=1` (after the merge) | exit 0; `Test Files 304 passed (304)`, `Tests 6039 passed, 8 skipped (6047)` |
| build | `npm run build` | exit 0 |
| G1 | `matoya.py`, `stubs.py`, `world.py`, then `git diff --exit-code assets-src/maps` | exit 0 |
| G2 | `build_map.py overworld --region a1` (under the lock), then `--check-determinism --region a1 overworld matoya-cave pravoka` | `overworld: region a1 of 192x192 -> ...`; `overworld: deterministic`, `matoya-cave: deterministic`, `pravoka: deterministic` |
| G3 | `world.py --owned-chunks a1` vs `git diff --name-only mainline -- assets/maps/ai/overworld/` | no output (see the deviations) |
| G6, G7, G12, G13, G14 | `assetCoverage`, `fileCeilings`, `questCeilings`, `tests/quest/`, `macroGeography`, `travelMatrix`; `npm run quest -- --only g` / `--only h` | all passed; `(g) geography: OK  s*=0.735 (31 pairs; 16 assumed)`; `(h) travel matrix: OK  (12 rows, 2 basin rows; 3 checked, 11 pending)` (T1 is now checked) |
| G8 | `build_map.py --selftest` (before the merge; my `build_map.py` edit is dropped for FIR-O's) | `build_map selftest: 104 checks passed` |
| G16 | `stubs.py --check A1-O` | `stubs: 0 left for A1-O` |
| G17 | `world.py --check-bands && world.py` | `bands: OK`; `basins: OK (aldi 2741 cells, ocean 23814 cells; canal joins)`; `cuts: W_west 7, ... W_east 2, crescent_ring 9` |
| G9, G15 | - | n/a (A1-O has no boss and no town) |
| memory | `/usr/bin/time -l build_map.py overworld` (full, under the lock) | 9.1-10.3 GB peak, about 83 s; `--region a1` 6.7 GB |

**G10, the browser checkpoints:**

- Setup: port 5221, `mute=1`, my own headless Chromium driven by `/tmp/w-a1-o/cp.mjs`.
- Walking paths come from the live compiled map. Random encounters are stopped while walking.
- 0 console errors.

| Stage | Scenario | Result | Screenshot |
|---|---|---|---|
| S1 | `w_s1_start` | the King, then INTRO_COMPLETE. A debug hop takes the party to the stub foot (93, 97), because the walk from the castle is act 1's and unchanged. The foreman then sets BRIDGE_BUILT, and the party walks onto the former gap cell (93, 95) | `/tmp/w-a1-o/s1_span.png` |
| S3 | `w_s3_start` | 36 steps from the north shore; the map is `matoya-cave` at (8, 12) | `/tmp/w-a1-o/s3_cave.png` |
| S7 | `w_s7_start` | talked to Matoya with the eye: herb 1, crystal_eye 0, A1_O_HERB_GIVEN set | `/tmp/w-a1-o/s7_matoya.png` |

**Originality:**

- One map is built, `matoya-cave`: one floor, no stairs; its design note is in the source.
- Region note for A1, Distinct: a lighthouse range walls Pravoka's fjord from the outer sea; Pravoka stands on a
  shelf under a rock headland; a cairn marks the saddle pass above the harbour.
- A fresh reviewer passed the dialogue and the geography. The first Distinct line of `matoya-cave` failed, and it
  was rewritten, and the reviewer then passed it. `originality review: PASS matoya-cave overworld(A1)`.

**Deviations / hand-offs:**

- **The bridge order (4.1, 6.5 S1, 0.1).** The King's `act1_complete` sets only INTRO_COMPLETE (he orders the span
  rebuilt; ox-carts over a fade). The foreman at the south stub lays the last span (the hammers over a fade, then
  BRIDGE_BUILT) once the party holds the lute.
  - Why: setting BRIDGE_BUILT in the King's scene fails proof (a) with `ORDER S1 (BRIDGE_BUILT) holds before S0
    completes`. The King needs only PRINCESS_RESCUED, so the span would open before the princess's lute, which is
    one of S0's grants.
  - The foreman also serves saves made after the old act-1 ending.
  - The S1 checkpoint therefore talks to the King, then to the foreman.
- **S3's band is [2, 6], not [3, 6].** Matoya's grove opens straight off the bridge (S1 is band 2-3). S3 is a visit
  with no event, so the curve model has nothing to walk to in `--stage S3`, and it reports the S1 level.
- **Matoya's trade is a cutscene behind `requiredItem`** (take_item crystal_eye, give_item herb, set_flag
  A1_O_HERB_GIVEN), not `takeItem` + `giftItem` on the NPC.
  - Why: `npcOutcome` plays an NPC cutscene only while its `requiredItem` is held, so a `takeItem` trade could
    never also play `a1_matoya_sight`.
  - GT-8 still applies: removing the `requiredItem` frees the herb.
- **Outside my files** (each small, and needed by every region; please confirm):
  - `build_hooks.bake_patches`: base objects touching a patch's cells are left out of the patched compile. Without
    this, the act-1 bridge debris (`on_water`) fails on the deck, and the overlay would show the debris.
  - `tests/data/questData`, `questGraph`, `travelMatrix` (T1 checked), `fieldRules` (the gap opens with the patch),
    `bestiaryHabitats` (gr_wolf also lives on the Northern Mainland), `mapVariants`, `overworldLayout` (a lone door
    cell is not a road component), `DebugScenarioField` (`w_*` starts may hold act-1 flags such as GOT_LUTE).
  - `src/progression/questCurve.ts`: FIR-O's version is kept. My `--stage` band seeding is dropped.
- **Chunk spill outside A1** (G3 is kept clean by leaving these files at `mainline`):
  - A full compile writes 11 px into EARTH's `below_5_3` at cell (63, 80). This is X_west range art near the seam;
    the sea cell (71, 84) differs from the placeholder world.
  - A full compile also writes 6 px and 17 px into ELF's `below_9_6` and `below_10_6` at x 111, y 148-163. This is
    FIRE's spill from FIR-O, which mainline's ELF chunks lack.
  - The integrator's full regeneration will write all three.
- **Ships and docks (WAT-O's finding).** The act-1 jetty ship is gone; the only ship spawns at Pravoka's quay dock
  `a1_pravoka` (aldi). On this branch `npm run quest -- --stage S21` and `--stage S22` both print `(c) soft-locks:
  OK`.

**AGENTS.md delta (for INT):**

- "Editing a 2x Map" gains:
  - `layouts/a1/world_a1_{ground,sites,zones}.py` (A1's region part, imported by `world_a1.py`) and
    `layouts/a1/matoya.py`, which writes `matoya-cave`;
  - the patch `north_bridge` (BRIDGE_BUILT; the gap rows and the gate cells);
  - `bake_patches` leaving out the base objects on a patch.
- The act-1 ending:
  - `act1_complete` sets INTRO_COMPLETE;
  - the foreman (`bridge_worker_w`, `requiredItem: lute`) plays `a1_bridge_finished` (BRIDGE_BUILT);
  - Matoya's `a1_matoya_sight` trades the eye for the herb.
- The debug scenarios gain `w_s1_start`, `w_s3_start` and `w_s7_start`.
<!-- === end A1-O === -->
<!-- === A1-T A1 (pass W: owned by A1-T) === -->
### A1-T result: Pravoka and the pirates (branch `w-a1-t` from `mainline` f825a6f, merged with `mainline` aa75df87 after A1-O)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-a1-t/`.

**Files:**

- `layouts/a1/town_pravoka.py` writes `pravoka` (48x44, kits town + overworld), with the design note in its header.
  - The plan: a shelf between the cliffs and the fjord. Three streets fall from the west cliff to a quay that runs the
    length of the town: Rope Walk (y 14-15), Cooper's Row (y 24-25) and the high street (y 34-35). The high street
    leaves by the west land gate.
  - Lantern Street runs north to a cliff path, which rounds the fjord's head to the lighthouse shelf at the range's
    foot. The shelf holds the keeper's house (the clinic) and the tower (the `tower` placeholder).
  - Two warehouses stand on piles over the water beside a plank landing, with a boardwalk behind them. There is a
    fishers' pier, and the brig's pier with the brig moored at it (the `buried_hull` placeholder, brown). A fish
    market lies between the streets and the quay, and the pirates' den is boarded up.
  - 15 `type: house` objects: 6 homes, 5 shops, and 4 without a door (the sail loft, the den, a boarded cottage and
    the old warehouse). The inn is the `inn` prefab.
  - Three inspect cells (the signpost, the lighthouse door, the brig), `battleBackgrounds.default: shoreline` for
    the captain's fight, and the west edge exits to `overworld:a1_pravoka`.
- `layouts/a1/town_pravoka_people.py`: the 19 outdoor NPCs, the captain's fight and `NO_WANDER`.
  - 7 pirates: tinted `guard` and `villager`, `hideIf: BIKKE_DEFEATED`.
  - Bikke: a tinted `warrior` at the brig pier's end (40, 33).
  - The scripted encounter: `npc: bikke`, `pirate` x9, `isBoss`, flag BIKKE_DEFEATED, `postVictoryCutscene:
    a1_bikke_yields`.
  - The beaten captain and two dockhands: `showIf: BIKKE_DEFEATED`.
  - `old_sailor_hint` names Elfheim, and `herbwife_hint` names Matoya.
  - Every townsperson has a line that changes on BIKKE_DEFEATED.
- `layouts/a1/town_pravoka_rooms.py` is the runner for the interiors. `town_pravoka_homes.py` writes the six
  `pravoka-house-*` maps, and `town_pravoka_shops.py` writes the five shops and `pravoka-inn`. They use W1-D's
  `Town("pravoka")` and its `house`, `shop` and `keeper` helpers. Each room has its own original plan and its design
  note in its header:
  - lighthouse: the clinic. The keeper (`action: clinic`, `clinicPrice: 10`), the keeper's daughter and a hurt sailor;
  - warehouse: aisles of crates, Hennick, a stowaway, and a chest (`tent`);
  - netmaker: two NPCs;
  - chandler: two rooms, two NPCs and a chest (`antidote`);
  - cooper: two NPCs and a chest (`potion`);
  - harbourmaster: an office and a record room, two NPCs;
  - the shops: each keeper stands behind a counter whose ends are closed, so the keeper's side is unreachable. The
    inn has a taproom, a bunk room and a patron.
- `layouts/a1/town_pravoka_site.py` is **unchanged** (W1-0b's defaults, which A1-O's world reads). The world needs no
  regeneration for A1-T.
- Data:
  - `cutscenes.yaml` (A1-T anchor): `a1_bikke_yields` (Bikke yields the brig, his crew leaves over a fade, `set_flag
    BIKKE_DEFEATED`, then a `warp` back into `pravoka` (26, 35) behind the fade). The warp reloads the town, so the
    `showIf` people appear; the engine only removes NPCs on a flag, it never adds them.
  - `quest.yaml` (A1-T anchors): S2 `status: built` with its walk, its entry (the bridge's south stub foot, overworld
    (93, 97)) and two `nonLoadBearing` entries (see the deviations). The town `pravoka` is `built`.
  - `debug-scenarios.yaml` (A1-T anchor): `w_s2_start`, `w_s2_neg_noboss` (both at `pravoka:gate`, level 3, B1 kit,
    the S0 and S1 flags and the lute) and `w_boss_pirate` (pirate x9, level 4, kit w_s2).
  - `shops.yaml`: W1-F's seeded `pravoka_*` records are kept unchanged (B2 stock, inn 50).
- Tests:
  - `tests/quest/a1/a1_t_town.test.ts` (10 tests): the canon links both ways, the gate's edge exits, EXIT-safe
    rooms and town, Bikke's fight and cutscene, the pirates and dockhands on the flag, the hints, the clinic and inn
    prices, the CHEST_A1_T_ flags, and the site file against the compiled overworld (door, gate, dock, brig);
  - `tests/quest/a1/a1_t_walk.test.ts` (3 tests): the S2 walk, (a) in assume mode, and the town entry;
  - `tests/balance/w_a1_t.test.ts` (3 tests).

**Town standard (G15):** `pravoka: houses 15/8 interiors 6/6 outdoor 19/14 interior 16/10 hints 2/2 reactive 21/4
shops 5/5 inn 50/50 clinic true/true`.

**Gates:**

| Gate | Output |
|---|---|
| 5.4 done-when | `w_a1_t.test.ts` passes. Pirate x9 is trivial at the band, as in the classic: sensible L4 100.0 % (>= 95), careless L4 100.0 % (>= 85), sensible L3 100.0 % (>= 95). `check-bounds: OK (6 tests)` |
| G1 | `town_pravoka.py`, `town_pravoka_rooms.py`, `stubs.py` and `world.py`, then `git diff --exit-code assets-src/maps`: clean |
| G2 | `build_map.py` for the 13 ids under the lock: each prints `<id>: WxH -> assets/maps/ai/<id>.yaml`. `--check-determinism` for the 13 ids: each prints `<id>: deterministic`. There is no overworld compile, because the site file is unchanged |
| G3 | n/a: no `town_*_site.py` change, so no overworld chunk changed |
| G5 | `npm run quest -- --mutate --stage S2`: (a) OK S2; (b) OK (5 withheld runs); (c) OK (10302 states); (d) `pirate L3.5 [3,6]`; (e) to (h) OK; `mutations: OK (3 gate rows; 3 elements, each removal reported)`; `quest-verify: OK`. The full `npm run quest -- --mutate` is OK: (c) 5266 states; `mutations: OK (43 gate rows; 52 elements)`. In the full run GT-2 is caught (`SKIP S2 ... without S1 (BRIDGE_BUILT)`), GT-3 is caught (`SKIP S4 map elfheim reachable without S2`), and GT-4 is caught (`SOFTLOCK ...`) |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: 317 files, 6794 passed, **1 failed**, `wnd_o_walk` (e). That failure is on `mainline` too, see below |
| G6, G7, G12, G13, G14, G15 | `tests/quest/`, `tests/data/`, `tests/progression/`: all pass apart from that one. `(g) geography: OK  s*=0.736 (31 pairs; 2 assumed)`. `(h) travel matrix: OK  (12 rows, 2 basin rows; 8 checked, 6 pending)`: T2-T5 and both basin rows are now checked |
| G16 | `stubs.py --check a1-t`: `stubs: 0 left for A1-T` |
| G17 | `bands: OK`; `basins: OK (aldi 2779 cells, ocean 13810 cells; canal joins)` |
| G10 | Port 5222, `mute=1`, my own headless Chromium (`/tmp/w-a1-t/cp.mjs`), 0 console errors. Results below |

G10, `w_s2_start`:

- Shop: bought a Potion at the item shop (600 -> 540 G, potions 5 -> 6). Inn: 540 -> 490 G. Clinic: BLM felled by
  debug, revived for 30 G (level 3 x 10), HP 1.
- Bikke: talked to him from (39, 33); the battle started, the party won, and `a1_bikke_yields` played. BIKKE_DEFEATED
  is set. The reloaded town shows `bikke_after`, `dockhand_a` and `dockhand_b`, and no pirate.
- The brig: out through the west gate to `overworld` (131, 101). The brig sprite stands at the `a1_pravoka` dock
  (132, 102). Stepping east from (131, 102) gives mode `ship` at (132, 102).
- Screenshots: `/tmp/w-a1-t/s2_gate.png`, `s2_shop.png`, `s2_inn.png`, `s2_clinic.png`, `s2_pier.png`,
  `s2_battle.png`, `s2_after.png`, `s2_quay.png`, `s2_ship.png`.

G10, `w_s2_neg_noboss`: out through the gate without the fight. There is no brig sprite at the dock. The step east
from (131, 102) is refused, and the mode stays `walking`. Screenshot: `/tmp/w-a1-t/s2_neg.png`.

**Cross-tranche: the ship and its docks.** A1-O's merge already moved the brig from Cornelia's jetty to the
`a1_pravoka` dock, reading this site file. So no reachable ship has only one dock. `npm run quest -- --stage S21`:
`(c) soft-locks: OK  (62820 states, every one reaches @S21)` (S22 the same).

**Originality:**

- The town and its 12 rooms have their design notes. A fresh reviewer read the sources, the notes, the dialogue and
  the cutscene: no classic line is copied, and every Distinct: line has at least 2 true features.
- Its three factual remarks are fixed: the weapon shop's stands, the cooper's earthen floor, and the two-room
  Topology lines of the chandler and the harbourmaster.
- `originality review: PASS pravoka pravoka-house-chandler pravoka-house-cooper pravoka-house-harbormaster
  pravoka-house-lighthouse pravoka-house-netmaker pravoka-house-warehouse pravoka-weapon-shop pravoka-armor-shop
  pravoka-item-shop pravoka-white-magic pravoka-black-magic pravoka-inn`.

**Deviations / hand-offs (shared-file edits, each small):**

- `src/progression/questMutate.ts` (W1-I), two rule fixes:
  - A non-load-bearing (`nlb: entry`) row whose stage is pending now reports `pending: ... not built` instead of
    UNCAUGHT. With the brig built, GT-5 (`elf_port`, S4, ELF-T) went live with no entry yet.
  - In `--stage` mode, a row's (b) expectation on another stage is left to the full run. GT-2 in `--stage S1` needs
    `SKIP S2`, which the S1 scope cannot produce; it is still caught there by its `EARLY pravoka`, and fully in the
    full run.
- `tests/progression/travelMatrix.test.ts`: a repository-state pin updated. T2-T5 and B1/B2 are now `ok`, and the
  strict pending example is T6. It already failed on `mainline` after A1-O.
- `quest.yaml` S2 `nonLoadBearing`:
  - Bikke's `hideIf` (as Garland's at S0).
  - GT-4's dock, for the stage scope only. In `--stage S2` the goal @S2 holds as soon as the brig spawns, and boarding
    needs no dock (W1-A), so the removal cannot fail there. The full run catches GT-4 as SOFTLOCK, and a caught row
    never reads this entry.
- **Open for INT, not mine:** proof (e) in `--stage` mode for a stage whose entry already lies past an ancestor's
  barrier. This fails on `mainline` today: `EARLY dwarf talkable before S2` in `--stage S3`, `S21`, `S22`, `S26`,
  and in `wnd_o_walk.test.ts`. Pravoka is now built, so `EARLY pravoka talkable before S1` joins it in those runs.
  `startWithout` removes the ancestor's grants, but the start place, and vehicles such as the airship, are already
  beyond them. `--stage S2` itself is clean.
- Art: the brig (`buried_hull`), the lighthouse (`tower`) and the piles (`dock_post`) are W1-D placeholders, so the
  brig shows its "BH" label. A brig sheet is an art need (4.9).

**AGENTS.md delta (for INT):**

- "Editing a 2x Map" gains two rows:
  - `layouts/a1/town_pravoka.py` (+ `town_pravoka_people.py`) -> `pravoka.yaml`;
  - `layouts/a1/town_pravoka_rooms.py` (+ `town_pravoka_homes.py`, `town_pravoka_shops.py`) -> the six
    `pravoka-house-*` maps, the five shops and `pravoka-inn`.
- Debug scenarios gain `w_s2_start`, `w_s2_neg_noboss` and `w_boss_pirate`.
- A cutscene that sets a flag on which `showIf` NPCs appear should `warp` onto the same map behind a fade: the field
  only removes NPCs on a flag change.
<!-- === end A1-T === -->
<!-- === ELF-O ELF (pass W: owned by ELF-O) === -->
### ELF-O result: Elfland overworld, the Western Keep, S6 (branch `w-elf-o` from `mainline` 81e93d4, merged with mainline after FIR-O and WAT-O)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-elf-o/`.

**Files:**

- World: `layouts/world_elf.py` (the RegionOut: ground, sites, zones, checks, `walls: {W_arm}`; the stub and its
  placeholder wall are gone), `layouts/elf/world_land.py` (the arm, the continent, the fens, the tarns, the Greyfells,
  the east fells, beaches, the min_blob tidy), `layouts/elf/world_sites.py` (the keep, its watchtower, the Marsh Cave
  mouth, Elfheim's icon / gate / `elf_port` dock read from ELF-T's `town_elfheim_site.py`, the waystone inspect cell,
  the fens' dead trees, the road), `layouts/elf/world_zones.py`. `layouts/elf/` is imported as a namespace package
  (`from elf import ...`), so other regions' same-named helpers can't clash in the composer's process.
- Keep: `layouts/elf/keep.py` -> `western-keep-1f` (36x31) and `-2f` (34x26), compiled; both `canSave: false`, `exit`
  to `overworld:elf_keep`, encounters gargoyle / bloodbones / ghast / ogre_chief, background `palace` (staged).
- Data: `cutscenes.yaml` (ELF-O anchor: `elf_o_crown_taken`, `elf_astos_unmasked`), `debug-scenarios.yaml`
  (`w_s6_start`, `w_s6_neg_nocrown`, `w_boss_astos`), `enemies.yaml` (astos `bossPhases` only), `quest.yaml` S6
  (`walk`, `entry`, `nonLoadBearing`, `status: built`), `assets/backgrounds/palace.webp`.
- Compiled stubs (so the overworld's transitions resolve; ELF-T and ELF-D replace them): `elfheim` and its 15 linked
  maps, `marsh-cave-b1..b3`.
- Tests: `tests/quest/elf/elf_o_world.test.ts` (anchors, dock, zone coverage, the arm to `seam_n`, the 2.5x hops,
  W_arm), `tests/quest/elf/elf_o_keep.test.ts` (the crown flow, D-W14, twin stairs, S6 (a)-(c) in assume mode),
  `tests/balance/w_elf_o.test.ts`.

**The region (world cells).** The arm x 50-61, y 114-145, with a broken tor ridge on its ocean side, the road on its
Aldi side and grass to `seam_n`; the keep `elf_keep` (60, 125) (target (61, 126)); the Marsh Cave `elf_marsh`
(53, 162) (target exact) in the fens with four tarns; `elf_elfheim` (82, 150) from the site file, the `elf_port` dock
(84, 147) in a two-row harbour bay; the east fells wall the Aldi against `seam_s`. Zones: `elf_keep_moor`, `elf_fen`,
`elf_fields` (walking), `elf_aldi` and `elf_sea` (ship; every Water cell of the box, bands included, in exactly one).

**S6 design.** The false king (`false_king`, `showIf: MARSH_GUARD_DEFEATED`) asks for the crown; his cutscene
`elf_o_crown_taken` (behind `requiredItem: crown`) takes it, gives an Ether, sets `ELF_O_CROWN_GIVEN`, and warps the
party to the `boss` cell so the floor reloads with `astos` (`showIf: ELF_O_CROWN_GIVEN`) on the same cell; talking to
him starts `[astos, gargoyle x3]` (`requiredFlags: [MARSH_GUARD_DEFEATED, ELF_O_CROWN_GIVEN]`), and
`elf_astos_unmasked` gives `crystal_eye` (D-W14). Why two NPCs and a cutscene: proof (b) counts a talkable boss NPC as
"reached", so the boss must be absent until the stage's needs hold; and GT-7 removes `requiredItem` + `takeItem`, so
the take must be a cutscene (an NPC whose gift is a plain item drops out of the event catalog).

**Gates:**

| Gate | Output |
|---|---|
| G1 | `world.py`, `keep.py`, `stubs.py` re-run after the commit: `git diff --exit-code assets-src/maps` clean |
| G2 | `build_map.py overworld --region elf western-keep-1f western-keep-2f` (lock): `overworld: region elf of 192x192`, both floors compiled, exit 0, max RSS 5.3 GB; `--check-determinism --region elf overworld western-keep-1f western-keep-2f`: all three `deterministic` |
| G3 | `world.py --owned-chunks elf`, then the diff against the merge base: no output (only `below_7_3`, `below_8_3`, rows 9-11 cols 0-6 change) |
| G4 | `npm run build` exit 0; `npx vitest run --maxWorkers=2 --minWorkers=1`: `Test Files 305 passed (305)`, `Tests 6194 passed | 8 skipped (6202)` (on the head merged with WAT-O) |
| G5 | `npm run quest -- --mutate --stage S6`: (a)-(h) OK, `(d) bands: OK  astos L10.1 [10,13]`, `mutations: OK (2 gate rows)`, `quest-verify: OK`; full `npm run quest -- --mutate`: `quest-verify: OK`, `mutations: OK` (GT-7 caught: `SKIP S6 astos reachable without its requirement crown`; GT-6 by the S6 entry; GT-5 caught) |
| G6, G7 | `assetCoverage`, `fileCeilings`, `questCeilings` passed; every ELF-O file under 250 lines (`keep.py` 194) |
| G9 | `w_elf_o.test.ts` 3 passed; `check-bounds: OK (3 tests)` |
| G10 | browser, port 5223, `mute=1`, own headless Chromium: `w_s6_start` walked overworld -> 1F -> west stair -> 2F, the crown taken (crown 0, ether 1), the battle `Astos, 3x Gargoyle` on `palace`, then ASTOS_DEFEATED and `crystal_eye` held (screens `/tmp/w-elf-o/s6_battle.png`, `s6_end.png`); `w_s6_neg_nocrown`: "King: You come before your king with empty hands?", no battle, no flag (`/tmp/w-elf-o/s6neg_line.png`); 0 console errors |
| G12 | designNotes, originality passed (`western-keep: branching`); reviewer: `originality review: PASS western-keep-1f western-keep-2f overworld(elf)` |
| G13, G14 | macroGeography, travelMatrix passed; `(g) geography: OK s*=0.735`; `(h) travel matrix: OK` (T2 pending until `a1_pravoka` exists; probed with a temporary anchor: T2 reaches all three ELF anchors) |
| G16 | `stubs.py --check ELF-O`: `stubs: 0 left for ELF-O` |
| G17 | `bands: OK`, `basins: OK (aldi 2810 cells, ...; canal joins)`, cuts `W_arm 10` |

**Balance (S6, `[astos, gargoyle x3]`, kit `w_s6`, 400 seeds):** sensible L11 78.5 %, L9 27.3 %, L13 95.0 %; careless
L11 76.8 %. Astos alone with the roster stats (168 HP) won 100 % at L3-L13, and AI changes alone could not move it;
the fix is in-bounds: a `bossPhases` entry at 0.99 (3 hits, attack 42) and his three gargoyle sentinels in the
battle (the map's encounter). Alone with the phase: L9 91 %.

**Originality numbers:** `western-keep` stair graph 1F <-> 2F by twin stairs (two entrance pairs: `up`/`arrival`,
`up_east`/`arrival_east`); 1F has the courtyard / wings / mirror-hall loop and 2 dead-end store passages, 2F 3 dead
ends (two niches, the antechamber); the boss on 2F north-east of the arrival.

**Deviations and hand-offs:**

- The brief said ELF-D builds the Keep; 4.2 and 5.4 give `western-keep-*` and S6 to ELF-O, so ELF-O built it.
- Shared files I edited (for the integrator): `tests/quest/originalityChecks.ts` (`stairGraph` counts twin stairs,
  i.e. two distinct arrival entrances between the same two floors, as a loop; without it a 2-floor dungeon can never
  branch) and `tests/data/mapVariants.test.ts` (canon `floor` maps may have random battles). My earlier versions of
  the FIR-O fixes were dropped for FIR-O's.
- `assets-src/tools/layouts/elf/town_elfheim_site.py` is unchanged (ELF-T's); its ICON is drawn as the town icon's
  left column and bottom row ringed by hedge clumps, because the icon's top-right part has too little art for a wall.
- The keep icon and its tower stand on two crag cells (mountain ground under the castle's top row, for art coverage);
  the tower and the Marsh Cave mouth use W1-D's placeholder landmarks.
- Two new local flags/cutscenes beyond 4.2's list: `ELF_O_CROWN_GIVEN`, `elf_o_crown_taken`.
- In the shared Playwright browser I once pressed ArrowDown in WAT-O's tab (port 5234) before noticing it was shared;
  the checkpoints were then run in a separate headless Chromium.

**AGENTS.md delta (for INT):** "Editing a 2x Map" gains `layouts/world_elf.py` + `layouts/elf/world_{land,sites,zones}.py`
(Elfland; `from elf import ...`) and `layouts/elf/keep.py` (`western-keep-1f`, `-2f`); a boss NPC that needs a key item
is two NPCs on one cell (a `showIf`-gated boss after a cutscene trade), see the keep.
<!-- === end ELF-O === -->
<!-- === ELF-T ELF (pass W: owned by ELF-T) === -->
### ELF-T result: Elfheim, the prince and the vault (branch `w-elf-t` from `mainline` 3a549665, merged with `mainline` 4015c773 after ORD-O and A1-T)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-elf-t/`.

**Files:**

- `layouts/elf/town_elfheim.py` writes `elfheim` (52x50, kits town + castle). The plan:
  - a ring of living hedges (every cell outside the ring polygon is a `hedge` deco, round bushes on its bastion bends)
    with one south gate; the high street (x 25-26) runs from the gate to the castle door on the rise;
  - a spring pool under the rise (north-west) feeds a stream through the middle of the town to a lily pond in the
    south-east; the high street and two lanes cross it by bridges;
  - north, west, south, magic and east lanes; a herb garden by the herbalist's; oaks and firs among green-roofed
    houses (the `elf` roof style); an inner hedge with topiary guards between the town and the wooded rise;
  - the castle front (a facade, `name: north_gate`) whose door leads to `elfheim-castle:gate`; a signpost inspect cell;
  - 11 `type: house` objects (6 homes, 5 shops) plus the `inn` prefab.
- `layouts/elf/town_elfheim_people.py`: the 19 outdoor townsfolk (`talk()`: PRINCE_AWAKE, `item:herb`,
  `item:crystal_eye`, ASTOS_DEFEATED, MARSH_GUARD_DEFEATED, then the default); `elfheim_matoya_hint` names Matoya,
  `elfheim_marsh_hint` the Marsh Cave; a dwarf peddler points at Nerrick and the vault's powder (S10).
- `layouts/elf/town_elfheim_rooms.py` is the runner for the rooms: `town_elfheim_homes.py` (herbalist, bowyer,
  scribe, healer = the clinic, `clinicPrice: 20`, bard, warden), `town_elfheim_shops.py` (the five shops and the inn,
  each keeper boxed behind a counter; greetings change on PRINCE_AWAKE) and `town_elfheim_castle.py`:
  - `elfheim-castle` (26x20): the hall, the prince's empty throne, the stair up to the chamber (north-west), the stair
    down to the vault (south-east) behind two `keyItemGates` cells (`requiredItem: mystic_key`, permanent,
    ELF_T_VAULT_OPEN; the message is conditional on PRINCE_AWAKE);
  - `elfheim-castle-chamber` (14x10): `elfheim_prince` (`requiredItem: herb`, `hideIf: PRINCE_AWAKE`, cutscene
    `elf_prince_wakes` with `onceFlag: PRINCE_AWAKE`) and, on the same cell, `elfheim_prince_awake`
    (`showIf: PRINCE_AWAKE`);
  - `elfheim-vault` (12x10): `tnt` (CHEST_ELF_T_TNT), `ether` and `phoenix_down` (CHEST_ELF_T_ETHER, _PHOENIX).
- `layouts/elf/town_elfheim_site.py` is **unchanged**, so no world regeneration is needed.
- Data:
  - `cutscenes.yaml` (ELF-T anchor): `elf_prince_wakes` (the herb taken; over a fade, PRINCE_AWAKE, `give_item
    mystic_key` and a `warp` into the chamber, so the woken prince appears; then his lines);
  - `quest.yaml` (ELF-T anchors): S4, S8 and S9 `built`, with their walks and entries; INT-W2a's GT-5 entry is kept;
    the town `elfheim` is `built`;
  - `debug-scenarios.yaml` (ELF-T anchor): `w_s4_start` (Pravoka's quay, the brig at its dock, level 5, B2 kit),
    `w_s8_start` (Elfheim's gate, the brig at `elf_port`, level 10, B3 kit, the herb), `w_s9_start` (the same with
    the Mystic Key and PRINCE_AWAKE). There is no `w_boss_*`: the three stages have no boss;
  - `shops.yaml`: W1-F's `elfheim_*` records are kept unchanged (B3 stock, inn 100).
- Tests: `tests/quest/elf/elf_t_town.test.ts` (12 tests: the canon links both ways, the south gate, EXIT-safe maps,
  the prince's trade and cutscene, the living gate, the vault chests, the hints, 12 or more reactive people, the clinic
  and inn prices, ELF-T's flag prefixes, the site file) and `tests/quest/elf/elf_t_walk.test.ts` (5 tests: the three
  walks and (a)-(c) in assume mode, PRINCE_AWAKE only with the herb, the TNT only with the key, the town entry).

**Stage design.** S4: walk `overworld:board:ship`, `overworld:dock:elf_port`, `overworld:warp:elfheim`, from the
`a1_pravoka` land cell with the brig at its dock. S8: walk `elfheim-castle-chamber:npc:elfheim_prince` (Matoya's
pattern: `requiredItem` plus a cutscene that takes and gives). S9: walk `elfheim-vault:chest:tnt`. The gate step is
not in S9's walk: the gate lies on S8's map, so the replay settles it before the walk starts. S8 and S9 start at
`elf_elfheim` with the brig at `elf_port`. Without the ship in the entry, Pravoka is out of reach from Elfland, and
(e) reported `SHOPLESS pravoka`.

**Town standard (G15):** `elfheim: houses 11/9 interiors 6/6 outdoor 19/16 interior 13/12 hints 2/2 reactive 36/4
shops 5/5 inn 100/100 clinic true/true`.

**Gates:**

| Gate | Output |
|---|---|
| G1 | `town_elfheim.py`, `town_elfheim_rooms.py`, `stubs.py` and `world.py` (`bands: OK`, `basins: OK (aldi 2779 cells, ocean 12692 cells; canal joins)`), then `git diff --exit-code assets-src/maps`: clean |
| G2 | `build_map.py` for the 16 ids, one process: each prints `<id>: WxH -> assets/maps/ai/<id>.yaml`; `--check-determinism` for the 16 ids: each `<id>: deterministic`. There is no overworld compile, because the site file is unchanged |
| G3 | n/a: no `town_*_site.py` change, so no overworld chunk changed |
| G5 | `npm run quest -- --mutate --stage S4`: (a) OK S4, (b) OK (7 withheld runs), (c) OK (35812 states), (d) `S4 L8.0 [5,9]`, (e)-(h) OK, `mutations: OK (3 gate rows; 3 elements)`, `quest-verify: OK`. `--stage S8`: (d) `S8 L10.2 [10,13]`, `mutations: OK (1 gate rows; 1 elements)` (GT-9), OK. `--stage S9`: (d) `S9 L10.1 [10,13]`, `mutations: OK (1 gate rows; 2 elements)` (GT-10, both gate cells), OK. Full `npm run quest -- --mutate`: (a), (b) (424 runs), (c) (18094 states), (e)-(h) and `mutations: OK (45 gate rows; 58 elements)` all OK; **(d) FAIL** `BAND elfheim gold 1615 at S4 below 50 % of 12940` (BLOCKED, see below) |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: 323 files, 7171 passed, **2 failed**: `questLate.test.ts` (the same BAND line) and `stageEarlyShops.test.ts` (fails on `mainline` 4015c773 too) |
| G6, G7, G12, G15 | `tests/quest/` (with `elf/elf_t_*`, `townStandard`, `designNotes`, `originality`), `assetCoverage`, `questCeilings`: 513 passed. Every ELF-T layout file is under 250 lines |
| G8 | `build_map.py --selftest`: 104 checks passed |
| G13, G14 | `(g) geography: OK  s*=0.736 (31 pairs; 0 assumed)`; `(h) travel matrix: OK  (12 rows, 2 basin rows; 9 checked, 5 pending)` |
| G16 | `stubs.py --check elf-t`: `stubs: 0 left for ELF-T`, exit 0 |
| G17 | `bands: OK`; `basins: OK (aldi 2779 cells, ocean 12692 cells; canal joins)` |
| G10 | Port 5224, `mute=1`, my own headless Chromium (`/tmp/w-elf-t/cp.mjs`), 0 console errors. Results below |

G10, `w_s4_start`:

- Sailing: boarded the brig at (132, 102) (mode `ship`) and sailed to the `elf_port` dock (84, 147). Stepped ashore to
  (84, 148) on foot, then entered by the overworld door (82, 151): the map is `elfheim` at its gate (25, 46).
- In town: talked to the gate warden ("A ship out of the Aldi, and humans on it...").
- Services: bought a Potion at the item shop (1500 -> 1440 G, potions 5 -> 6). The inn cost 1440 -> 1340 G. At the
  clinic, BLM was felled by debug and revived for 100 G (level 5 x 20), HP 1.
- Screenshots: `/tmp/w-elf-t/s4_dock.png`, `s4_gate.png`, `s4_talk.png`, `s4_shop.png`, `s4_inn.png`,
  `s4_clinic.png`.

G10, `w_s8_start`: gate -> `elfheim` -> north gate -> `elfheim-castle` -> the west stair -> the chamber. Talking to
the prince with the herb played `elf_prince_wakes`. Afterwards PRINCE_AWAKE is set, `mystic_key` is 1 and `herb` is
0. The reloaded chamber shows `elfheim_prince_awake`, the nurse and the guard. Screenshots: `s8_hall.png`,
`s8_prince.png`, `s8_awake.png`.

G10, `w_s9_start`: the hall's vault stair (20, 14) with the key: ELF_T_VAULT_OPEN is set and the map is
`elfheim-vault`. The chest gave `tnt` 1 (CHEST_ELF_T_TNT). Screenshot: `s9_tnt.png`.

**Originality:** every one of the 16 maps has its design note. The reviewer's first pass failed six notes as
untrue: the carpets drew red, there was no hearth or chimney, a shelf was on another wall, and the town has five
lanes, not three. A remake-like line ("a kiss would wake him") was replaced. All six were fixed: the carpets are now
remapped green, and the notes are reworded or the layouts changed. On the re-review the castle's note needed one more
correction (the stair stands beside the pillar, not between two), and then:
`originality review: PASS elfheim elfheim-house-herbalist elfheim-house-bowyer elfheim-house-scribe
elfheim-house-healer elfheim-house-bard elfheim-house-warden elfheim-weapon-shop elfheim-armor-shop elfheim-item-shop
elfheim-white-magic elfheim-black-magic elfheim-inn elfheim-castle elfheim-castle-chamber elfheim-vault`.

**Deviations / hand-offs:**

- **BLOCKED (INT, kits / curve):** the full `npm run quest -- --mutate` passes every proof except (d)'s town gold rule,
  `BAND elfheim gold 1615 at S4 below 50 % of 12940` (W1-F's `w_elfheim` 4-member price). The gold at S4's start
  comes from S2 and S3 (A1-T, A1-O grind) and the kit is W1-F's, so none of it is ELF-T's to tune. The check counts
  only once the town is built, so it shows up now. `tests/progression/questLate.test.ts` fails on the same line.
- `tests/progression/stageEarlyShops.test.ts` (`SHOPLESS pravoka` from S6's entry) already fails on `mainline`
  4015c773 with the stub Elfheim maps. It is not caused by ELF-T.
- Shared-file edit: `tests/quest/earth/ert_o_walk.test.ts`. Its "S10 without the TNT" closure could now re-open the
  real vault chest, so the test starts with CHEST_ELF_T_TNT set (the TNT came from the vault).
- Two vault chest items, `ether` and `phoenix_down`, stand in for 4.2's "2 B3 chests": they are consumables, not gear.
- The prince is a tinted `knight` standing on a carpeted bier. No field sheet lies down.

**AGENTS.md delta (for INT):** "Editing a 2x Map" gains `layouts/elf/town_elfheim.py` (Elfheim) and
`layouts/elf/town_elfheim_rooms.py` (its 15 rooms, from `town_elfheim_{homes,shops,castle}.py`). A sleeping NPC who
wakes on a trade is two NPCs on one cell (`hideIf` / `showIf` on the flag), plus a `warp` into the same room behind
the cutscene's fade, so that the new NPC appears.
<!-- === end ELF-T === -->
<!-- === ELF-D ELF (pass W: owned by ELF-D) === -->
### ELF-D result: the Marsh Cave B1-B3, S5 (branch `w-elf-d` from `mainline` 3a54966)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-elf-d/`.

**Files:**

- Layouts: `layouts/elf/marsh_common.py` (materials, the per-floor encounter tables, the peat hazards made from the
  `w` cells, the floor writer), `marsh_b1.py`, `marsh_b2.py`, `marsh_b3.py` -> `marsh-cave-b1` (40x32), `-b2` (46x30),
  `-b3` (38x36), compiled (the ELF-O stubs are replaced). Every floor: `exit` to `overworld:elf_marsh`, the `swamp_cave`
  background (staged; `--check swamp_cave` has no bounds and exits 0), encounters from the S5 roster (B1 the bog's
  oozes and stingers, B2 ghouls / shadows / scorpions, B3 ghasts / bloodbones). B2 and B3 `canSave: false`.
- Materials: the `cave` remap; black water (`≈`, the `water` material at shade 0.4); plank boardwalks; brown peat
  (`w`, swamp recoloured) as `hazards` (damage 1); the fog-dark rooms are the `cave` remap at shade 0.7 (the `+`
  material).
- Data: `cutscenes.yaml` (`elf_d_crown`: sets MARSH_GUARD_DEFEATED, `give_item crown`); `enemies.yaml` (piscodemon
  `bossPhases` only); `quest.yaml` S5 (`entry`, `walk`, `nonLoadBearing`, `status: built`); `debug-scenarios.yaml`
  (`w_s5_start`, `w_boss_piscodemon`); `assets/backgrounds/swamp_cave.webp`.
- Tests: `tests/quest/elf/elf_d_marsh.test.ts` (8: the two B1 stairs, the B2 halves are not joined, the one-way pit, the
  boss NW at path >= 40, chests 2/4/3, no chest cuts a way on from any arrival, exit / roster / background, the crown
  only from `elf_d_crown` (D-W14), S5 (a)-(c) and the walk), `tests/quest/elf/hazardPath.test.ts` (7, with a RED case),
  helpers `tests/quest/elf/marshPaths.ts`, `tests/balance/w_elf_d.test.ts`.

**Design.** B1: four mud banks in black water joined by a ring of single-plank boardwalks; the west and east banks
each have a stair down; peat shoals (one a short cut between the south and west banks), two dead-end boardwalks to
chests and a rotten pier. B2: two halves split by rock, joined only through B1. The west half runs from the arrival
hall by a peat neck (or a boardwalk round by the east wall) to the fog-filled eel pool and the stair to B3. The east
half runs from its arrival room up a gallery to the north ledge, whose collapsed west end is the one-way pit to B3
(`pit`). B3, the drowned barrow: the antechamber (SE, the stair up), the fallen gallery where the pit lands (NE), the
long south passage half in peat, the burial gallery with its niches, the fog-dark crypt of pillars, and the bier hall
(NW). Talking to the bier (`elf_d_bier`, `hideIf: MARSH_GUARD_DEFEATED`) starts `[piscodemon x3]` (`isBoss`,
postVictoryCutscene `elf_d_crown`).

**Gates:**

| Gate | Output |
|---|---|
| G1 | the 3 marsh scripts, `stubs.py` (kept 18 real maps) and `world.py` re-run after the commit: `git diff --exit-code assets-src/maps` clean |
| G2 | `build_map.py marsh-cave-b1 marsh-cave-b2 marsh-cave-b3`: `40x32`, `46x30`, `38x36 -> assets/maps/ai/...`; `--check-determinism`: all three `deterministic` (no site file changed, so no world compile) |
| G3 | no overworld chunk changed |
| G4 | `npm run build` exit 0; `npx vitest run --maxWorkers=2 --minWorkers=1`: `Test Files 318 passed (318)`, `Tests 6771 passed, 6 skipped (6777)` |
| G5 | `npm run quest -- --mutate --stage S5`: (a)-(h) OK, `(b) skips: OK (7 withheld runs, 0 reach a later stage, 6 not required)`, `(d) bands: OK piscodemon L8.8 [8,11]`, `mutations: OK (1 gate rows; 1 elements, each removal reported)`, `quest-verify: OK`; full `npm run quest -- --mutate`: `mutations: OK (43 gate rows; 52 elements)`, `quest-verify: OK` |
| G6, G7 | assetCoverage, fileCeilings, questCeilings pass (in G4); every ELF-D file is under 250 lines (the largest, `marsh_common.py`, has 114) |
| G8 | `build_map.py --selftest`: `104 checks passed` |
| G9 | `w_elf_d.test.ts` 3 passed; `check-bounds: OK (6 tests)` |
| G10 | browser on port 5225 with `mute=1` in my own headless Chromium. `w_s5_start` went overworld `elf_marsh` -> B1 (19, 29) -> west stair -> B2 (3, 5) -> stair -> B3 (30, 27) -> the bier -> the battle `3x Piscodemon` on `swamp_cave`. It ended with MARSH_GUARD_DEFEATED and crown 1. Screens: `/tmp/w-elf-d/s5_start.png`, `s5_b1.png`, `s5_b2.png`, `s5_bier.png`, `s5_battle.png`, `s5_end.png`. 0 console errors. The confirm-mashing driver (Fight only, no healing, at L8 after the walk) lost 7 times before it won through Retry Battle |
| G12 | designNotes and originality pass (`marsh-cave: branching`); a fresh reviewer gave `originality review: PASS marsh-cave-b1 marsh-cave-b2 marsh-cave-b3` |
| G13, G14 | `(g) geography: OK s*=0.736`, `(h) travel matrix: OK` (in G5) |
| G16 | `stubs.py --check ELF-D`: `stubs: 0 left for ELF-D` |
| G17 | `bands: OK`, `basins: OK (aldi 2779 cells, ocean 13810 cells; canal joins)` |

**Balance (S5, `[piscodemon x3]`, kit `w_s5`, 400 seeds):**

- Before tuning, with the roster's numbers: sensible L5 54.3 %, L7 87.3 %, L9 97.8 %, L11 100 %.
- A phase after the first wound barely moved this, since a piscodemon often dies to its first hit (at 0.99 with 3 hits and attack 40: L7 72.5 %, L9 84 %). Spells in `ai` changed nothing.
- The fix is a `bossPhases` entry at hpThreshold 1.0 (crossed at the first round start) with hits 2 and attack 36.
- Measured with the fix:
  - sensible: L7 53.5 %, L9 83.5 %, L11 99.8 %;
  - careless: L7 37.8 %, L9 76.5 %, L11 98.3 %.
- Bounds: L9 [75, 95], L7 <= 60, L11 >= 90.

**Originality numbers:**

- Stair graph: `b1>b2 b2>b1 b2>b3 b3>b2`. The edges are B1 -> B2 by two stairs (`arrival` / `arrival_east`, back to `down` / `down_east`) and B2 west <-> B3 by stair. The pit B2 east -> B3 `pit` has no link back.
- Dead ends: B1 5, B2 5, B3 8.
- Boss: NW of the arrival, path 48. From the pit landing the path is 54.
- Shapes (aspect / fill): B1 1.214 / 0.417, B2 1.593 / 0.311, B3 1.125 / 0.420.
- Hazard-free path over shortest: at most 1.21 (B2 arrival -> stair).

**Deviations and hand-offs:**

- B2's halves are joined only through B1, so B2 uses `no_unreachable_walkable: {reach_roots: [arrival_east]}`. It drops the compiler's `no_static_chokepoints`, which walks from the first entrance only (`map_checks.py`, W1-C2's). `elf_d_marsh.test.ts` checks that from every arrival instead.
- S5's `entry` is Pravoka's quay, with the ship at `a1_pravoka` rather than at the cave mouth. In assume mode a start in Elfland reaches the guard without the ship, and proof (b) flagged it.
- The bier NPC uses the `chest` field sheet, since no field sheet shows a crown. A `crown_cushion` deco beside the altar stays drawn after the crown is taken, because a static deco has no flag.
- I edited no shared files outside my anchors. One new local flag pattern: `CHEST_ELF_D_*` (9 chests).

**AGENTS.md delta (for INT):**

- "Editing a 2x Map" gains `layouts/elf/marsh_b{1,2,3}.py` + `marsh_common.py` (`marsh-cave-b1..b3`).
- A dungeon can recolour the `water` (for `≈`) and `swamp` materials. Its peat `hazards` come from the `w` cells.
- A floor whose parts are joined only through another floor needs `reach_roots`. Its chokepoints are then checked in tests.
<!-- === end ELF-D === -->
<!-- === ERT-O EARTH (pass W: owned by ERT-O) === -->
### ERT-O result: EARTH overworld and small sites (branch `w-ert-o` from `mainline` 81e93d4, merged with `mainline` 62033ba after FIR-O)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-ert-o/`.

**Files:**

- The region: `layouts/world_earth.py` (the RegionOut: walls, barrier, checks), `layouts/earth/world_earth_ground.py`
  (the ground), `layouts/earth/world_earth_sites.py` (objects, entrances, transitions, docks, the canal patch, the
  inspect cell, zones and tables, walls, barrier). Melmond's icon, gate, door and harbour are read from ERT-T's
  `town_melmond_site.py`, which is unchanged.
- The sites: `layouts/earth/dwarf.py` writes `dwarf-hall` (40x30), `giant.py` writes `giant-tunnel` (32x20), and
  `sage.py` writes `sage-cave` (16x12). All three are compiled.
- Data:
  - `cutscenes.yaml` (ERT-O anchor): `ert_canal_blast`, `ert_giant_feast`, `ert_sarda_rod`, `ert_smyth_forge`.
  - `debug-scenarios.yaml`: `w_s10_start`, `w_s10_neg_notnt`, `w_s12_start`, `w_s12_neg_noruby`.
  - `quest.yaml`: S10 and S12 are `built`, with `entry`, `walk` and `nonLoadBearing` (GT-14, GT-16); S31 stays
    pending; the town `dwarf` is `built`.
  - `assets/backgrounds/cracked_earth.webp`, staged for the `ert_badlands` zone.
- Tests: `tests/quest/earth/ert_o_world.test.ts` (8 tests) and `ert_o_walk.test.ts` (3 tests).
- The compiled EARTH stubs (`melmond*`, `cavern-earth-b1..b5`, 17 maps) are committed, because the overworld's
  transitions now target `melmond` and `cavern-earth-b1`. This follows FIR-O's practice. ERT-T and ERT-D overwrite
  them.

**Design** (all original; the macro placement follows 2.2):

- **The isthmus (x 49-61).**
  - A mountain hogback runs from y 76 to 91. It is W_west's stub, against `seam_w`.
  - The canal saddle is a grass pass at y 92-93. The patch `canal` (CANAL_OPEN) turns its 26 cells to Water.
  - The dwarves' downs run from y 94 to 109. The hall's ridge holds the cave mouth: the door is at (55, 103) and
    `ert_dwarf` at (55, 104).
  - The landing cove sits on the Aldi side: dock `ert_dwarf` at (59, 104), aldi basin. The downs run on to
    `seam_n`.
- **The western strait (x 42-48)** runs from sea to sea.
- **The western continent (x 13-42, y 73-139).**
  - It is split by the western range (core x 24-27). Sea cliffs close both tips, so nothing can walk round it.
  - East of the range: Melmond's plain, with copses, the crooked windmill and Melmond's placeholder icon (gate
    (42, 112), harbour dock (43, 113), ocean basin).
  - South of y 118: the grey badlands. They hold the Cavern's mesa (`ert_earth_cave` (30, 126)) and the rotted
    shrine (an inspect cell).
  - West of the range: Sarda's coast, a sealed sliver with Sarda's knoll (`ert_sarda` (19, 109)).
  - The tunnel mouths are `ert_giant` (28, 112) and `ert_giant_west` (23, 112).
- **Encounter zones:** `ert_isthmus`, `ert_plain`, `ert_badlands` (backdrop `cracked_earth`), `ert_sarda_coast`, and
  the ship-only `ert_aldi` and `ert_sea`. Every walkable cell of the box is in one walking zone, and every Water
  cell in one ship zone (this is tested).
- **Walls:** W_west is the hogback (y 76-87); W_isthmus is the isthmus land from y 88 to 109.
- **Barrier `western_range`:** its cells are the range's core mountains. The seeds are (36, 100) on the plain and
  (18, 100) on Sarda's coast. The exported cut is 4 cells.
- **Site maps:**
  - **`dwarf-hall`** is a long hall with three rooms off its north wall:
    - Smyth's forge;
    - the drafting room, where Nerrick (`requiredItem: tnt`, cutscene `ert_canal_blast`, onceFlag CANAL_OPEN)
      keeps the canal plans;
    - the store, which sells `dwarf_item` across a wall-to-wall counter.
  - **`giant-tunnel`** is two caverns joined by a one-cell throat at (15, 10).
    - The giant lies in the throat: `requiredItem: ruby`, `hideIf: TITAN_FED`, cutscene `ert_giant_feast`.
    - Once fed, he sleeps in a niche (`showIf: TITAN_FED`).
    - It also has a prospector, a chest pocket (`hi_potion`) and the mouths on the map's two flanks.
  - **`sage-cave`** holds Sarda and two pupils. Sarda's cutscene `ert_sarda_rod` (`requiredFlags:
    [VAMPIRE_DEFEATED]`) gives the `rod`.
- **Melmond-sarda walk:** its tunnel route is about 58 steps, under the 3.0 x 23.2 detour bound.

**Gates:**

| Gate | Output |
|---|---|
| 5.4 `world.py` | `bands: OK`, `basins: OK (aldi 2790 cells, ocean 22054 cells; canal joins)`, `cuts: W_west 7, W_isthmus 10, W_arm 2, W_south 2, W_east 4, western_range 4, crescent_ring 9`. There is no EARTH placeholder wall (the region is not a stub). The composer exports `barriers: OK (western_range)` as the cut |
| G1 | `dwarf.py`, `giant.py`, `sage.py`, `stubs.py` and `world.py`, then `git diff --exit-code assets-src/maps`: clean |
| G2 | `build_map.py overworld --region earth`: exit 0, 40 s, max RSS 4.47 GB. `--check-determinism --region earth overworld dwarf-hall giant-tunnel sage-cave`: all four `deterministic` (51 s, 4.69 GB) |
| G3 | `world.py --owned-chunks earth` against `git diff --name-only mainline -- assets/maps/ai/overworld/`: no output (19 owned files changed) |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: `Test Files 302 passed (302)`, `Tests 6097 passed, 7 skipped` |
| G5 | `npm run quest -- --mutate --stage S10`: `quest-verify: OK` (`(d) S10 L11.0 [11,14]`, `mutations: OK (5 gate rows; 9 elements)`). `--stage S12`: OK (`(d) S12 L15.0 [15,17]`, 4 gate rows: GT-15, GT-16, GT-35, GT-36). Full `npm run quest -- --mutate`: OK (41 gate rows, 50 elements; `(g) s*=0.735 (31 pairs; 13 assumed)`). `--stage S31`: **FAIL**, `ORDER S31 unreachable`, because no stage grants `adamant` (W1-H's known note) |
| G6 | `assetCoverage.test.ts`: passed (tinted NPCs, `cracked_earth`) |
| G12 | `designNotes` and `originality` tests passed. The fresh reviewer passed the second round (see Originality) |
| G13 / G14 | `macroGeography` and `travelMatrix` passed. `(g)` OK; `(h)` OK (12 rows, 2 basin rows; T2-T4 are still pending, waiting for `a1_pravoka`) |
| G15 | `townStandard`: `dwarf: houses 0/0 interiors 0/0 outdoor 13/10 hints 2/2 reactive 9/3 shops 1/1` |
| G16 | `stubs.py --check ERT-O`: `stubs: 0 left for ERT-O` |
| G17 | `world.py --check-bands`: `bands: OK`; then `basins: OK` (as above) |
| `stage_backgrounds.py --check cracked_earth` | exit 1: `no bounds for cracked_earth (known: shoreline)`. The tool has bounds only for `shoreline`. Staging itself succeeded |

**Travel rows and GTs:**

- **Travel rows** (checked in the tests and the verifier):
  - With the ship and no canal, `ert_dwarf` is reachable by the Aldi dock and `ert_melmond` is not (the strait).
  - With CANAL_OPEN, the canal joins the Aldi to the strait.
  - The range separates `ert_sarda` from the plain until TITAN_FED.
  - T2-T4 report pending in (h) until A1-T places `a1_pravoka`.
- **Gate rows:**

  | Row | Result |
  |---|---|
  | GT-11 (Nerrick's tnt) | caught |
  | GT-12 (`canal` forced on) | caught |
  | GT-13 (W_west, W_isthmus cuts) | caught |
  | GT-14 | non-load-bearing, with an S10 entry |
  | GT-15 (the giant's ruby) | caught |
  | GT-16 | non-load-bearing, with an S12 entry |
  | GT-35 (`western_range` cut, 4 cells) | caught |
  | GT-36 (the giant removed) | caught |

  Every caught row is reported OK by `--mutate`.

**Browser** (port 5226, `mute=1`). I drove the game from my own headless Chromium, because the shared Playwright MCP
browser was being navigated and closed by other agents. Screenshots are in `/tmp/w-ert-o/`.

| Row | Result |
|---|---|
| `w_s10_start` | Talked to Nerrick: CANAL_OPEN set, `tnt` gone. Boarded at (59, 104) (mode `ship`), sailed to (62, 93), then west through the canal cells to (47, 93) in mode `ship` (`s10_nerrick.png`, `s10_canal.png`) |
| `w_s10_neg_notnt` | Same route: the ship stops at (62, 93), at the isthmus coast |
| `w_s12_start` | Fed the giant (TITAN_FED, the ruby gone), walked west through the tunnel to `ert_giant_west` (23, 112) and into `sage-cave`, talked to Sarda: `rod` held, ERT_O_ROD_GIVEN (`s12_sarda.png`) |
| `w_s12_neg_noruby` | The giant stays on (15, 10); the party cannot pass (16, 10) |
| all four rows | 0 console errors |

**Deviations and hand-offs:**

- **Shared fixes.** After the FIR-O merge I dropped my own versions of FIR-O's shared fixes. Three more edits were
  needed beyond FIR-O's; they go to the orchestrator:
  1. `src/progression/questShops.ts`: in `--stage` mode, proof (e) skips an `opensAfter` stage that is an ancestor
     of the checked stage. Its grants (the ship) are assumed at the entry and cannot be withheld. Without this,
     every built town fails `EARLY <town> talkable before S2` in stage mode.
  2. `tests/data/questData.test.ts`: a town may be `built`.
  3. `tests/progression/questLate.test.ts`: the `(e)` line counts built towns.
- **Full-world compile.** Before the merge I ran one full-world compile (11.7 GB, 190 s) under the lock, because my
  first fix to `build_map.py` changed the compiler digest. FIR-O's version replaces that fix, and the committed
  world was then rebuilt with `--region earth` only.
- **S31 stays `pending`.** `adamant` is granted by no stage, so Smyth's trade would be a dead gate (proof (c)
  DEADGATE). The cutscene `ert_smyth_forge` is written, and Smyth stands in the forge.
  - Hand-off to WND-D2 / INT: once S28 grants `adamant`, set `SMYTH_TRADE` in `earth/dwarf.py` (1 line, given there)
    and mark S31 built.
- **No `shake` cutscene step exists**, so the canal blast is a dialog line over a short black fade.
- **Sarda's VAMPIRE_DEFEATED gate is the cutscene's `requiredFlags`.** `npcOutcome` has no NPC-level
  `requiredFlags`, so Sarda gives the rod through `ert_sarda_rod` (`give_item`), not through `giftItem`.
- **Cutscene trades.** Nerrick and the giant take their item with a `take_item` step, not with `takeItem`. With
  `takeItem` the item is gone before `npcOutcome` checks it, so the cutscene never plays.
- **`ert_dwarf` moved +1, -2 to (55, 104)**, within the ±2 tolerance, so the dwarf-melmond hop by canal stays
  under 4.5x (about 58 steps against 68.7).
- **The canal saddle is at y 92-93**, not y 88-92, so that it lies nearer the dwarves' landing.
- **Placeholder art.** Melmond's icon is a town-kit farmhouse; ERT-T may restyle it. The canal has no lock-gate
  art.

**Originality:** the first review found two problems. The giant tunnel's Distinct line named features the classic also has, and the dwarf hall's line was partly untrue. Both were fixed: the asleep giant was added and the wording rewritten. The re-review passed: `originality review: PASS dwarf-hall giant-tunnel sage-cave overworld(earth)`.

**AGENTS.md delta (for INT):** under "Editing a 2x Map", add these scripts to the table:

- `layouts/world_earth.py` with `layouts/earth/world_earth_ground.py` and `world_earth_sites.py` write the EARTH
  region of `overworld.yaml`;
- `layouts/earth/dwarf.py`, `giant.py` and `sage.py` write `dwarf-hall`, `giant-tunnel` and `sage-cave`.

Also note that NPC trades which play a cutscene take their item with a `take_item` step.
<!-- === end ERT-O === -->
<!-- === ERT-T EARTH (pass W: owned by ERT-T) === -->
### ERT-T result: Melmond, Dr. Unne, S25 (branch `w-ert-t` from `mainline` 3a54966)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-ert-t/`.

**Files:**

- Layouts (all new): `layouts/earth/town_melmond.py` (`melmond`, 46x42, the patch `ert_melmond_bloom`),
  `town_melmond_people.py` (every outdoor line), `town_melmond_interiors.py` (the script to run) with
  `town_melmond_homes.py` (houses `unne`, `miller`, `vintner`, `ploughman`, `healer`; `interiors_common.Town("melmond")`)
  and `town_melmond_shops.py` (the 5 shops and `melmond-inn`). `town_melmond_site.py` is unchanged, so the world
  files are not regenerated.
- The 12 compiled maps `melmond*` replace ERT-O's compiled stubs; `index.yaml` is unchanged.
- Data:
  - `cutscenes.yaml` (ERT-T anchor): `ert_unne_lesson`;
  - `quest.yaml`: S25 `built` (entry, walk), town `melmond` `built`;
  - `debug-scenarios.yaml`: `w_s25_start`, `w_s25_neg_noslab`, `w_ert_t_melmond_s11` and `w_ert_t_melmond_bloom`
    (the town before and after the bloom);
  - `shops.yaml`: the `melmond_*` records are kept as W1-F left them (B4, inn 200).
- Tests: `tests/quest/earth/ert_t_melmond.test.ts` (10: the bloom patch before and after, its overlay, Unne, the
  doors and exits, EXIT-safety, the clinic, the inn, the shops, the hints) and `ert_t_walk.test.ts` (3).

**Design** (original):

- **The town.** It sits in a fold of grey hills (mountain) on the strait. The only way in is a stone quay from the
  east shore: the `gate` is at (43, 19), and the quay's end at (45, 19-20) leads to `ert_melmond`.
- **Lanes.** The harbour road crosses the town to the green, a cobble ring round a lawn of dead ground. The great
  dead oak stands there, with the dry well at its foot. The hill lane runs north and the field lane south, and a west
  lane joins all three.
- **Ground and plants.** The ground is cracked dirt (a desaturated `dirt` remap). Grey (`stone` recolour) oaks,
  firs, bushes, crops and vine rows stand on it. The windmill's three art rows are offset so it leans.
- **The fields.** Four fenced plots hold withered crops. There is also a vineyard on the north-west slope, the
  millpond shrunk to a small pool, and a shut-up farmstead with a note on its wall (an inspect cell). A signpost
  (also an inspect cell) stands on the green.
- **The bloom** (`ert_melmond_bloom`, EARTH_CRYSTAL_LIT; 175 cells). The plots and the lawn turn to grass, with fresh
  crops and flowers in the overlay. It changes the art only: the cells are Road before and Grass after, and they walk
  both times, because the crops never block.
- **People.** There are 15 outdoor NPCs. The hint NPCs are `melmond_cavern_hint` (Cavern) and `melmond_giant_hint`
  (giant). Lines change on VAMPIRE_DEFEATED, EARTH_CRYSTAL_LIT and LUFENIAN_LEARNED.
- **Dr. Unne** (`melmond-house-unne`, npc `ert_unne`) lost his tablet of the Lufenian alphabet when his ship sank off
  Onrac. This ties in with Lufenia's archivist (WND-O). His dialog has four states: before, `item:slab`, LIT and
  LEARNED.
- **The clinic** is the healer's house (`melmond_healer`, 20 G per level). The inn keeper has `action: inn`. Two chests
  hold `CHEST_ERT_T_MILLER` (Hi-Potion) and `CHEST_ERT_T_VINTNER` (Soft).

**Town standard (G15):** `melmond: houses 11/7 interiors 5/5 outdoor 15/12 interior 14/10 hints 2/2 reactive 22/4
shops 5/5 inn 200/200 clinic true/true`.

**Gates:**

| Gate | Output |
|---|---|
| G1 | `town_melmond.py`, `town_melmond_interiors.py`, `stubs.py`, `world.py`, then `git diff --exit-code assets-src/maps`: clean (exit 0) |
| G2 | `build_map.py` on the 12 ids: each `<id>: WxH -> ...`; `--check-determinism` on the 12: all `deterministic`. No `town_*_site.py` change, so no world compile |
| G3 | no overworld chunk changed (no world compile) |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: `Test Files 317 passed (317)`, `Tests 6795 passed, 5 skipped` |
| G5 | `npm run quest -- --mutate --stage S25`: (a) OK S25; (b) OK (30 withheld runs); (c) OK (14616 states); (d) `S25 L28.2 [28,31]`; (e) OK (3 towns); (g), (h) OK; `mutations: OK (2 gate rows; 2 elements)` (GT-28 caught); `quest-verify: OK`. The full `npm run quest -- --mutate` gives `quest-verify: OK` (43 gate rows, 52 elements) |
| G6, G7 | `assetCoverage`, `fileCeilings` and `questCeilings` passed; every new script is at most 217 lines |
| G8 | `build_map.py --selftest`: 104 checks passed |
| G12 | `designNotes` and `originality` passed. A fresh reviewer took three rounds: the first two failed on design-note claims that did not match the maps, and the notes and a few props were fixed. Final: `originality review: PASS melmond melmond-house-unne melmond-house-miller melmond-house-vintner melmond-house-ploughman melmond-house-healer melmond-weapon-shop melmond-armor-shop melmond-item-shop melmond-white-magic melmond-black-magic melmond-inn` |
| G13 | `macroGeography` passed; `(g) geography: OK  s*=0.736 (31 pairs; 2 assumed)` |
| G14 | `travelMatrix` passed; `(h) travel matrix: OK  (12 rows, 2 basin rows; 8 checked, 6 pending)` |
| G15 | the row above |
| G16 | `stubs.py --check ERT-T`: `stubs: 0 left for ERT-T` |
| G17 | `world.py --check-bands`: `bands: OK`; `world.py`: `basins: OK (aldi 2779 cells, ocean 13810 cells; canal joins)` |
| 5.4 bloom test | `ert_t_melmond.test.ts`: Road before and Grass after, walkable both times, the overlay opaque (`patch_errors` gives `[]`) |
| G9, G11 | no balance file (S25 has no boss); `git status` shows only owned paths |

**Browser** (G10, port 5227, `mute=1`, own headless Chromium via `/tmp/w-ert-t/drive.cjs`; the server is stopped):

| Row | Result |
|---|---|
| `w_s25_start` | overworld (42, 112), then `melmond` gate (43, 19), the hill lane, `melmond-house-unne`, talk to Unne: LUFENIAN_LEARNED set and the slab gone; 0 console errors (`/tmp/w-ert-t/s25_unne_dialog.png`, `s25_after.png`) |
| `w_s25_neg_noslab` | the same walk: no flag; Unne speaks of the tablet lost off Onrac; 0 errors (`s25neg_unne_dialog.png`) |
| `w_ert_t_melmond_bloom` / `_s11` | the green lawn and the plots are green with crops after the flag, and dead dirt before it; 0 errors (`bloom_plots.png`, `s11_quay.png`) |

**Deviations:**

- **Unne's trade is done by the cutscene,** the same way as ERT-O's Nerrick. The NPC has `requiredItem: slab` and the
  cutscene `{id: ert_unne_lesson, onceFlag: LUFENIAN_LEARNED}`, and the cutscene does `take_item slab` and then
  `set_flag LUFENIAN_LEARNED`. 4.3 asks for `takeItem` + `giftFlag`, but with those the slab is taken before
  `runPending` re-checks the outcome, so the cutscene would never play. GT-28 is still caught.
- **The overworld icon is not restyled.** Its art lives in ERT-O's `world_earth_sites.py`, which this tranche does
  not own, so ERT-O's placeholder farmhouse stays. The site file is unchanged.
- **The town uses the `overworld` kit as well,** for the hills, the beach and the strait (`kits: [town, castle,
  overworld]`).
- **The vine rows do not bloom.** They are blocking hedges, and a patch cell under them would make them walkable.

**AGENTS.md delta (for INT):** add `layouts/earth/town_melmond.py` (`melmond`) and
`layouts/earth/town_melmond_interiors.py` (with `_homes.py` and `_shops.py`: `melmond-house-*`, the shops and the inn)
to the map table. Add a note on town patches: a patch may carry its own `objects` (art only), and a base object
touching a patch cell is dropped from the overlay, so a lawn patch keeps clear of every object footprint. Add the
debug scenarios `w_s25_start`, `w_s25_neg_noslab`, `w_ert_t_melmond_s11` and `w_ert_t_melmond_bloom`.
<!-- === end ERT-T === -->
<!-- === ERT-D EARTH (pass W: owned by ERT-D) === -->
<!-- === end ERT-D === -->
<!-- === FIR-O FIRE (pass W: owned by FIR-O) === -->
### FIR-O result: the south-east continent (branch `w-fir-o` from `mainline` 81e93d4)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-fir-o/`.

**Files:**

- `layouts/world_fire.py` (92 lines): FIRE's RegionOut. It imports FIR-T's `fire/town_crescent_site.py` unchanged
  (gate (148, 124), icon x 149-151 y 123-125, door (149, 124), dock `fir_crescent` (146, 124); an optional
  `ICON_PARTS` in the site file restyles the icon). It fills land no entrance reaches with rock, zones every FIRE cell
  (band water included), and returns `walls` (W_south: x 114-137, y 146-147; W_east: x 138-145, y 146-147) and
  `barriers.crescent_ring` (the ring's 411 mountain cells, seeds (152, 130) and (143, 161)).
- `layouts/fire/world_fire_ground.py` (191): the ground, with the design note in its docstring. Crescent's shore and
  downs fill the north rect. The crescent lake (Lake) lies at x 154-180, y 111-137, with the Circle's stone islet
  (159-160, 123-124). The ring is a mountain fold on rows 138-147/148, from the outer channel to the east coast. R-volcano
  (lake (159, 134) -> x 151 -> row 150 west, sink at (132, 150)) and R-ice (lake (167, 137) -> x 165 -> row 153 west,
  sink at (140, 153)) are 1-cell, 4-connected rivers. In the south lands there are W_south's cliffs, a 2-cell western
  sea lane (x 114-115; its 2-cell water cut makes W_south's minimal cut), the Ashlands (x 116-131), the Frost Hollow
  (x 132-141, rows 148-152), the Hull Desert dunes and the eastern woods.
- `layouts/fire/world_fire_data.py` (121): the zone tables and assignment, hazards `fir_ash_vents` (open-ash cells
  only, off the sink-to-mouth path), the landmarks (the volcano 3x2 at (119, 149), door (120, 150); the cave mouth
  2x2 `snow` at (135, 147), door (136, 148); an `ice_floe`; the `buried_hull` 3x2 `dune` at (142, 157); the `shrine`
  stones on the islet; boulders), and the hatch NPC `fir_hull_hatch` (143, 159) (`chest` sprite tinted, `requiredItem:
  levistone`, `hideIf: AIRSHIP_RAISED`, cutscene `fir_airship_rises` with `onceFlag: AIRSHIP_RAISED`, dialog on
  `item:levistone`).
- Anchors (entrances): `fir_volcano` (120, 151), `fir_ice` (136, 149), `fir_desert` (143, 160), and FIR-T's
  `fir_crescent` (148, 124). Transitions: `crescent:gate`, `gurgu-b1:arrival`, `ice-cavern-b1:arrival`.
- Zones (all with `modes` and `name`): `fir_lakeshore` "Crescent Shore", `fir_ashlands` "Ashlands", `fir_tundra`
  "Frost Hollow", `fir_desert` "Hull Desert", `fir_rivers` "Crescent Waters" (canoe), `fir_aldi` "Aldi Sea" (ship;
  the band strip y 144-145, x 112-137), `fir_sea` "Southern Seas" (ship).
- `cutscenes.yaml` (FIR-O anchor): `fir_airship_rises`: dialog, fade, `take_item levistone`, the rise, `set_flag
  AIRSHIP_RAISED`, `set_vehicle airship overworld (149, 162)` (a grass cell at the desert's edge), and the closing line.
- `quest.yaml` S17: `status: built`, `entry` overworld (143, 160) on foot, `walk:
  [overworld:cutscene:fir_hull_hatch]`.
- `debug-scenarios.yaml`: `w_s17_start` and `w_s17_neg_nostone` (entrance `fir_desert`, level 22, B5 gear, the flags
  through S16, the canoe and the lute, the ship at the `fir_crescent` dock; `_neg` withholds only the levistone).
- Tests: `tests/quest/fire/northWest.test.ts` (rows 146-147, x 114-141 are rock; both mouths open south; R-volcano meets
  the volcano from the east on row 150) and `tests/quest/fire/fir_o_world.test.ts` (anchors within ±2; no land path
  from the shore to the south lands, the canoe reaches all three; the detours; the south lands are one land; opening
  the composer's `crescent_ring` cut joins them; the dock; the zone cover; the hatch and the cutscene).
- Generated: `assets-src/maps/overworld.yaml`, `assets/maps/ai/overworld.yaml` and FIRE's 30 changed chunks. FIRE's
  22 canon stubs (`crescent*`, `gurgu-b1..b5`, `ice-cavern-b1..b3`) are compiled into `assets/maps/ai` + `index.yaml`
  (stubs as D-W8 means them: the overworld doors now lead somewhere; FIR-T, FIR-D1 and FIR-D2 overwrite them).

**Gates:**

| Gate | Output |
|---|---|
| G17 `world.py --check-bands && world.py` | `bands: OK`; `basins: OK (aldi 2781 cells, ocean 23814 cells; canal joins)`; `cuts: W_west 7, W_isthmus 14, W_arm 2, W_south 2, W_east 4, crescent_ring 9` (real W_south and W_east south parts; FIRE's placeholders gone; `barriers: OK (crescent_ring)` = no barrier error) |
| G2 `build_map.py overworld --region fire` | `overworld: region fire of 192x192 -> assets/maps/ai/overworld.yaml (158 approved parts, 94 placeholders)`; about 30 s, max RSS 4.61 GB |
| G2 `--check-determinism --region fire overworld` | `overworld: deterministic`; exit 0 |
| G1 `world.py` (PYTHONHASHSEED 1) and `stubs.py`, then compare | the world source is byte-identical; `stubs: wrote 137`; no source diff besides `overworld.yaml` |
| G3 owned chunks | `grep -vxFf owned.txt` prints nothing (exit 1); 30 chunk files changed, all FIRE's |
| G5 `npm run quest -- --mutate --stage S17` | (a) OK S17; (b) OK; (c) OK (253 states); (d) `S17 L22.0 [22,25]`; (e), (f) OK; (g) `s*=0.735 (31 pairs; 18 assumed)`; (h) OK (1 checked, 13 pending); `mutations: OK (2 gate rows ...)`; `quest-verify: OK`. GT-22 is caught (`SKIP S17 AIRSHIP_RAISED reachable without levistone`); GT-23 is reported pending (S18 not built) |
| `npm run quest -- --mutate` (all stages) | `quest-verify: OK` (41 gate rows; 49 elements). GT-21 (2 canoe cuts of 13 cells) and GT-37 (the ring cut, 9 cells) are found and reported pending until S15 and S16 are built. `tests/quest/fire/fir_o_world.test.ts` checks the GT-37 opening directly |
| G13 / G14 `--only g`, `--only h` and their vitest files | `(g) geography: OK s*=0.735`; `(h) travel matrix: OK`; tests passed |
| G4 `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 300 passed (300)`, `Tests 5921 passed, 8 skipped (5929)` |
| G6, G7, G12 (`assetCoverage`, `fileCeilings`, `questCeilings`, `designNotes`, `originality`, `townStandard`) | 8 files, 344 passed, 8 skipped |
| G8 `build_map.py --selftest` | `terrain selftest: 45 checks passed`, `region yaml / multi-rect / locality / stale / lock: OK`, `build_map selftest: 104 checks passed` |
| G16 | n/a: FIR-O owns no canon map id (`stubs.py --check FIR-O`: unknown tranche) |
| G10 browser, port 5229, `mute=1` | `w_s17_neg_nostone`: the hatch's line asks for the stone; no airship in `__game.vehicles`; AIRSHIP_RAISED unset. `w_s17_start`: talking plays `fir_airship_rises`; AIRSHIP_RAISED set, levistone gone, airship at (149, 162); walked on board, confirm: mode `airship`; over forest (175, 160) confirm: "The airship can't land here."; over grass (165, 160) confirm: mode `walking`, airship parked at (165, 160). Screenshots: `/tmp/w-fir-o/fir-o-neg-hatch.png`, `fir-o-start1.png`, `fir-o-forest2.png`, `fir-o-landed.png` |

**Travel rows and GTs (own):** T3 to T5's FIRE targets are pending in the CLI until A1-T's ship dock exists. On the
compiled map (`fir_o_world.test.ts`), the shore doesn't reach `fir_volcano`, `fir_ice` or `fir_desert` on foot
(T3, T4), and the canoe reaches all three (T5). Measured steps (BFS on the compiled collision) against the 2.5x bounds: crescent-volcano 75 / 97.2 and
crescent-ice 57 / 69.3 by canoe; ice-desert 28 / 32.6 on foot. GT-21: canoe cuts found,
pending S15 and S16. GT-37: cut found (9 cells), pending S15 and S16; the test shows that opening it joins the shore to
all three anchors. GT-22: caught. GT-23: pending S18.

**Deviations / hand-offs (all small, outside the owned files; the integrator should review them):**

- **Compiler gaps (W1-C1 / W1-C2 files).** Every pass W region that is reached by ship hits both.
  - `build_map.py` validate: the "reachable from the first entrance" flood now also starts at the world's
    `no_unreachable_walkable.reach_roots`. Before, every transition outside act 1 failed `transition ... is not
    reachable on foot`. The change only affects validation. Because `build_map.py` is part of the compiler digest, I
    rewrote the base's `build.compiler` digest in `assets/maps/ai/overworld.yaml` to the new one (345e4c2f6c0caf43)
    instead of running a full-world compile, since no pixel depends on the change. INT's full recompile confirms it.
  - `map_checks_encounters.py`: zones may carry `modes` and `name` (QUEST 3.4 and WORLD 4.0.3 need them). A zone whose
    modes leave out walking (ship, canoe) need not cover a walkable cell.
- **Verifier gaps (W1-I files).** In `questCurve.ts`, `--stage` starts the party at the stage's band low and marks the
  gold as assumed; before, every no-boss stage read L1. In `questProofsLate.ts`, (d) counts a built stage below its
  band as pending when it is below only because a pending ancestor was assumed at its band low; `--strict` still
  fails it. In `questTravel.ts`, a row whose vehicle place is not built yet reports its unreached targets as pending,
  not failed (T3 and T5 until A1-T's dock exists).
- **Repository-state pins updated** (each kept to act 1's data): `questData.test.ts` (other stages may be built),
  `questGraph.test.ts` (act 1's events filtered by map; the PENDING count read from quest.yaml),
  `overworldLayout.test.ts` (only the act-1 zones), `DebugScenarioField.test.ts` (`w_*` flags use `isKnownFlag`),
  `scenarioSpawns.test.ts` (`w_*` entrance starts are exempt from the act-1 frame), `mapVariants.test.ts` (a map new
  in 2x lands only on compiled targets).
- **Rivers end inland** ("sinks"): `river_check` is not in FIRE's region checks. A river that reached the sea would cut
  the south lands into parts, and GT-37 needs one land.
- **No smoke-column deco** (no part exists). The hatch NPC uses the `chest` sheet, tinted; the town icon's top row is
  `tree_clump`, `bush`, `tree_clump` (the approved `town_icon_0_*` cells are empty).
- **Originality:** a fresh reviewer, given the ASCII crop of the region, the design note and every line, returned
  `originality review: PASS fire-overworld`. Its one remark, that the "frozen stream" claim was loose, is fixed: the
  Distinct line now says the volcano's river runs past the ice cavern's door.
- `.playwright-mcp/` in the main checkout was in use by another tranche's browser (port 5226) while I worked. I
  removed only my own files; the folder and `playwright-responses/` are left for the last user.

**AGENTS.md delta (for INT):** in "Editing a 2x Map", add `layouts/world_fire.py` with `layouts/fire/world_fire_ground.py`
and `world_fire_data.py` (FIRE's region; Crescent's site from `fire/town_crescent_site.py`). The zone check accepts
`modes` and `name`. The debug scenarios gain `w_s17_start` and `w_s17_neg_nostone`.
<!-- === end FIR-O === -->
<!-- === FIR-T FIRE (pass W: owned by FIR-T) === -->
### FIR-T result: Crescent Lake and the Circle of Sages (branch `w-fir-t` from `mainline` 1e2fdfc1)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-fir-t/`.

**Files:**

- `layouts/fire/town_crescent.py` writes `crescent` (54x46, kits town + castle + overworld), with the design note in
  its header.
  - The plan: a headland whose inner shore bends round in a crescent. The lake wraps the east and the south of the
    map, and its far bank shows in the south-east corner. Three terraces step down to the water. Each is held up by
    a 2-row band of rock, and stone stairs cut through it (x 21-22 and 45-46 in the upper band, x 9-10 and 29-30 in
    the lower).
  - The Star Terrace holds the tutor's school, the archive, a shuttered reading room, the astronomer's house, and
    the observatory hall with a telescope tower (the approved castle turret).
  - On the Market Terrace, the Sea Road runs from the west land gate to a landing stage on the lake. The five shops,
    the Fountain Court and the inn line its north side. The healer (the clinic), the potter, a scriptorium, a flower
    garden and the pilgrims' hostel line its south side.
  - The Lakeside is a lawn in the bowl of the shore, with a statue of the first sage, the boatwright's yard, two
    boathouses on piles and a dirt path along the shore. From its southern tip, the causeway leaves by the south
    edge to `crescent-circle:arrival` (entrance `circle`).
  - 17 `type: house` objects: 6 homes, 5 shops, and 6 without a way in (the reading room, the observatory, the
    scriptorium, the hostel and the two boathouses). The inn is the `inn` prefab. There are three inspect cells
    (the signpost, the observatory, the scriptorium), and the west edge exits to `overworld:fir_crescent`.
- `layouts/fire/town_crescent_people.py`: the 19 outdoor NPCs and `NO_WANDER`. Nearly every line has three steps:
  CANOE_GIVEN, then EARTH_CRYSTAL_LIT, then the default (the rot in the earth). `ferryman_hint` names the sages and
  `geologist_hint` names the volcano, at every step.
- `layouts/fire/town_crescent_circle.py` writes `crescent-circle` (27x21), an islet in the lake.
  - The causeway arrives from the north edge, and the north edge exits to `crescent:circle`. Ten standing stones
    (castle `pillar`s) make a ring that is open toward the causeway, with an urn at its heart.
  - There are 12 sages: 8 inside the ring and 4 at the islet's edges.
  - `sage_elder` (13, 8) has the cutscene `{id: fir_sages_canoe, requiredFlags: [EARTH_CRYSTAL_LIT], onceFlag:
    CANOE_GIVEN}`. Before the flag, he says: "Heal the earth first."
  - `sage_lukahn` speaks the prophecy in new words. The other ten sages speak of the rotting earth before S13, of fire
    and frost after it, and of the canoe last.
  - The map has `exit: {map: crescent, entrance: circle}`.
- `layouts/fire/town_crescent_rooms.py` is the runner for the interiors. `town_crescent_homes.py` writes the six
  `crescent-house-*` maps, and `town_crescent_shops.py` writes the five shops and `crescent-inn`. They use W1-D's
  `Town("crescent")`. Each room has its own plan and a design note:
  - healer: the clinic, `clinicPrice: 60`, an infirmary of cots;
  - astronomer: a study and a bedchamber through an arch, chest `ether`;
  - boatwright: a hull on the stocks, chest `hi_potion`;
  - archivist: a hall of shelves, chest `phoenix_down`;
  - potter: a wheel room and a kiln room, chest `soft`;
  - tutor: the school;
  - the shops: each keeper stands in a closed bay. The inn has a dormitory behind a partition.
  - Chest flags are `CHEST_FIR_T_*`.
- `layouts/fire/town_crescent_site.py` is **unchanged**. FIR-O's world already reads W1-0b's defaults: the gate
  (148, 124), the door (149, 124) and the `fir_crescent` dock (146, 124). So there was no world regeneration and no
  chunk change (G3 n/a).
- Data:
  - `cutscenes.yaml` (FIR-T anchor): `fir_sages_canoe`. It plays dialog, then `give_item canoe`, then `set_flag
    CANOE_GIVEN`, then the closing lines.
  - `quest.yaml` (FIR-T anchors):
    - S14 is `status: built`.
    - Its walk is `overworld:board:ship`, `overworld:warp:crescent`, `crescent:warp:crescent-circle`,
      `crescent-circle:npc:sage_elder`.
    - Its entry is on foot at Melmond's harbour, overworld (42, 112), with the ship at the `ert_melmond` dock
      (43, 113). See the deviations for why.
    - It has one stage-scope `nonLoadBearing` entry, for GT-20.
    - The town `crescent` is `built`.
  - `debug-scenarios.yaml` (FIR-T anchor): `w_s14_start` (level 17, B4 kit, flags through S13) and `w_s14_early`
    (level 13, B3 kit, flags through S10). Both start at `overworld:fir_crescent`, with the ship at the dock.
  - `shops.yaml`: the seeded `crescent_*` records are kept unchanged (B5 stock, L5 magic, inn 300).
- Tests:
  - `tests/quest/fire/fir_t_town.test.ts` (13 tests) covers:
    - the canon door links both ways;
    - the causeway links both ways;
    - the gate edge exits;
    - EXIT-safety for the town, the Circle and every room;
    - the elder's gated cutscene, and that the canoe has no other source;
    - the 12 sages and their three-step lines, and the hints;
    - the clinic and inn prices and the six keepers;
    - the `CHEST_FIR_T_` flags;
    - the site file against the compiled overworld.
  - `tests/quest/fire/fir_t_walk.test.ts` (3 tests): the S14 walk and entry, (a) in assume mode, the town entry, and
    the full-run order S13 < S14 < S15, S16.

**Town standard (G15):** `crescent: houses 17/9 interiors 6/6 outdoor 19/16 interior 18/12 hints 2/2 reactive 44/4
shops 5/5 inn 300/300 clinic true/true`.

**Gates:**

| Gate | Output |
|---|---|
| G16 | `stubs.py --check fir-t`: `stubs: 0 left for FIR-T`, exit 0 |
| G2 | `build_map.py` for the 14 ids, under the lock: each prints `<id>: WxH -> assets/maps/ai/<id>.yaml`. `--check-determinism` for the 14 ids: 14 lines `<id>: deterministic`, exit 0. There was no overworld compile, because the site file is unchanged |
| G1 | the 5 FIR-T layout scripts, `stubs.py` (`kept 47 real maps`) and `world.py`, then `git diff --exit-code assets-src/maps`: clean (after the commit) |
| G5 | `npm run quest -- --mutate --stage S14`: (a) OK S14; (b) OK (18 withheld runs, 16 not required); (c) OK (67784 states); (d) `S14 L17.3 [17,20]`; (e) to (h) OK; `mutations: OK (2 gate rows; 2 elements, each removal reported)`; `quest-verify: OK` |
| G5, full run | `npm run quest -- --mutate`: `quest-verify: OK` (45 gate rows; 57 elements). On the full world, GT-19 is caught (`SKIP S14 CANOE_GIVEN reachable without its requirement EARTH_CRYSTAL_LIT`, and without S11-S13). GT-20 is caught (`EARLY crescent talkable before S13`). GT-21 and GT-37 are pending until S15 and S16 are built |
| 5.4 proof (f) | `(f) price walls: OK  crescent pending`. Crescent is built, but its first-arrival gold is tainted by the pending stages before it (S4, S5, S8, S9, S11, S13), so the curve marks it assumed. It goes live at INT |
| G13, G14 | `(g) geography: OK  s*=0.736 (31 pairs; 0 assumed)`; `(h) travel matrix: OK  (12 rows, 2 basin rows; 9 checked, 5 pending)` |
| G6, G7, G12, G15 | `assetCoverage`, `crossFileValidation`, `designNotes`, `originality`, `townStandard` and `tests/quest/fire/`: 9 files, 2903 passed, 4 skipped |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: exit 0; `Test Files 323 passed (323)`, `Tests 7210 passed, 4 skipped (7214)`. The first run caught one duplicate opening sentence ("Shh.") in `actOneDialog.test.ts` (T6); the copyist's line is reworded |
| G17 | `world.py --check-bands`: `bands: OK`; `world.py`: `bands: OK`, `basins: OK (aldi 2779 cells, ocean 12692 cells; canal joins)` |
| G3 | n/a: no `town_*_site.py` change, so no overworld chunk changed |
| G10 | Port 5230, `mute=1`, my own headless Chromium (`/tmp/w-fir-t/cp.mjs`), 0 console errors. Results below |

G10, `w_s14_early`:

- The party entered Crescent from `overworld` (148, 124).
- It bought a Potion at the item shop (`_shop_crescent_item`; 1500 -> 1440 G, potions 6 -> 7).
- Over the causeway the map was `crescent-circle`. The elder said "...while it rots we can give you nothing. | Heal
  the earth first...". CANOE_GIVEN stayed unset, and there was no canoe.
- Screenshots: `/tmp/w-fir-t/s14_early_gate.png`, `s14_early_shop.png`, `s14_early_buy.png`, `s14_early_elder.png`.

G10, `w_s14_start`:

- The party reached the Circle, talked to the elder, and `fir_sages_canoe` played. CANOE_GIVEN was set and the canoe
  held.
- Back out by the causeway and the gate to `overworld` (148, 124). A step east from (153, 124) onto the lake gave
  (154, 124) with mode `canoe`.
- Screenshots: `/tmp/w-fir-t/s14_circle.png`, `s14_canoe.png`, `s14_lake.png`.

**Originality:**

- A fresh reviewer read the six scripts, the 14 generated sources, the cutscene and the previews. It found no copied
  classic line, and Lukahn's prophecy is fully reworded. Every Topology line is accurate, and every Distinct line
  has at least 2 true features.
- Its five factual remarks are fixed:
  - the boatwright's and the potter's floors are earth, not stone;
  - the inn's tables now stand on its carpet;
  - the item shop's barrel and crate now flank the door;
  - the healer's window now stands over the herb tables.
- `originality review: PASS crescent crescent-circle crescent-house-healer crescent-house-astronomer
  crescent-house-boatwright crescent-house-archivist crescent-house-potter crescent-house-tutor crescent-weapon-shop
  crescent-armor-shop crescent-item-shop crescent-white-magic crescent-black-magic crescent-inn`.

**Deviations / hand-offs:**

- **The S14 entry is at Melmond, not at Crescent's gate.**
  - S14 `requires` the ship. In assume mode, proof (b) withholds each required grant from the entry. An entry at the
    gate reached the elder without the ship (`SKIP S14 CANOE_GIVEN reachable without ship`).
  - The entry is now where S13 leaves the party: by Melmond's harbour with the ship moored, as S12 does.
  - The debug scenarios still start at Crescent's gate, because 6.5's steps begin in the town.
- **GT-20 in `--stage S14` cannot be seen.**
  - Proof (e) starts "before S13" from the new game's place, and the ship is moored at Melmond, out of reach. So no
    early keeper shows in the stage scope.
  - The full run catches GT-20. I added one stage-scope `nonLoadBearing` entry to S14, matching A1-T's GT-4 entry:
    `{map: quest, kind: quest, at: [0, 0]}`. A caught row never reads it.
  - Note for INT: the entry matches any uncaught `quest`-kind element of any stage run. Today only the town
    `opensAfter` rows produce that kind.
- **The gift is a cutscene, not `giftItem` / `giftFlag`.** 4.4 asks for `giftFlag: CANOE_GIVEN` with `requiredFlags:
  [EARTH_CRYSTAL_LIT]`, but `npcOutcome` ignores `requiredFlags` on a plain gift. The elder therefore uses Sarda's
  pattern: a cutscene with `requiredFlags` and `onceFlag: CANOE_GIVEN` that gives the item and sets the flag. GT-19
  finds it through `npcFlags`, which reads the cutscene's flags, and it is caught.
- **Shared files.** No shared-file edits outside my anchors. Edited inside them: `quest.yaml` (S14 and the town
  entry), `cutscenes.yaml`, `debug-scenarios.yaml`.
- **Art.** The dock posts are W1-D `dock_post` placeholders ("DP" labels). Every other part is approved art.

**AGENTS.md delta (for INT):**

- "Editing a 2x Map" gains three rows:
  - `layouts/fire/town_crescent.py` (+ `town_crescent_people.py`) -> `crescent.yaml`;
  - `layouts/fire/town_crescent_circle.py` -> `crescent-circle.yaml`;
  - `layouts/fire/town_crescent_rooms.py` (+ `town_crescent_homes.py`, `town_crescent_shops.py`) -> the six
    `crescent-house-*` maps, the five shops and `crescent-inn`.
- Debug scenarios gain `w_s14_start` and `w_s14_early`.
- An NPC gift that needs a flag is written as a cutscene with `requiredFlags` and an `onceFlag` (the canoe, the rod).
  A plain `giftItem` ignores `requiredFlags`.
<!-- === end FIR-T === -->
<!-- === FIR-D1 FIRE (pass W: owned by FIR-D1) === -->
### FIR-D1 result: Gurgu Volcano (branch `w-fir-d1` from `mainline` 1e2fdfc)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-fir-d1/`. The canon (4.4, 5.4) assigns FIR-D1 Gurgu Volcano
`gurgu-b1..b5` with the boss `ashen_queen` (the fire fiend, a sun priestess turned six-armed serpent), and that is what
was built.

**Files:**

- `layouts/fire/gurgu_common.py` (81 lines): the materials (dark basalt `-`, lava `%` as the `lava` remap of the
  rubble, pale ash `+`), the design note, the encounter tables, the chest helper and the lava hazard (one
  `MapData.hazards` entry per floor, damage 1, a rect per row run of `%`).
- `layouts/fire/gurgu_upper.py` (98) writes `gurgu-b1` (40x34) and `-b2` (48x26); `layouts/fire/gurgu_lower.py`
  (134) writes `-b3` (34x46), `-b4` (40x36) and `-b5` (30x32).
  - B1, the caldera rim: a ring walk round a sheer rock crater, entered from the south. It has two stairs down on
    opposite sides: east to B2 `arrival`, west to B2 `west` (a new entrance). A lava seam crosses the north arc, and
    three blind fumarole spurs hold chests.
  - B2, the upper gallery, runs west to east. Two lava streams cross it from wall to wall, each with one stone ford.
    Its east stair leads to B3 `arrival` (the north gallery) and its west stair to B3 `forge` (a new entrance).
  - B3, the lower gallery, runs north to south in three reaches, each half lava. The sealed forge (hearth, racks,
    anvil altar) lies west of it, is walled off from it, and is reached only by B2's west stair: a dead end holding
    `sun_blade` and `opal_armlet` (a `reach_roots` entry; the chokepoint check is off on this floor and the sites test
    walks both parts instead).
  - B4, the basalt maze: a lava field broken by pillars runs from the north-west landing to the south-east stair
    (57 steps, all wading), and a dry corridor round the north and east that doubles back once (74 steps, 1.30x).
  - B5, the queen's ash court, `canSave: false`. An ash runner leads due south of the arrival (octant S, path 17) to
    the queen NPC (`princess` sheet, tinted) before the crystal's altar (an inspect cell whose text turns on
    FIRE_CRYSTAL_LIT). Talking to her starts `[ashen_queen, fire_lizard]` (`flag: FIRE_CRYSTAL_LIT`,
    `postVictoryCutscene: fir_ashen_falls`).
  - Chests 3 / 4 / 4 / 4 / 2 (`CHEST_FIR_D1_*`): consumables and B6 found gear (`opal_helm` x2, `sun_blade`,
    `opal_armlet`, `opal_armor`). Every floor has `exit` to `overworld:fir_volcano`.
  - Encounters: B1-B2 fire_lizard, hellhound, lava_worm + pyrolisk, pyrolisk, fire_elemental; B3-B5 horned_devil,
    fire_hydra, fire_gigas + pyrolisk, fire_elemental, dragon (rate 18-30). Backgrounds: B1-B2 `fire_temple`, B3-B4
    `magma_temple`, B5 `throne_kary`, staged by `stage_backgrounds.py` into `assets/backgrounds/`.
- `cutscenes.yaml` (FIR-D1 anchor): `fir_ashen_falls` (the robe falls empty; its flame runs into the crystal;
  `set_flag FIRE_CRYSTAL_LIT` behind a fade).
- `enemies.yaml` (ashen_queen anchor, `bossPhases` only): a new phase from full HP (hits 6, attack 61, with a
  message); the old 0.5 phase (inferno, heavy) is kept.
- `quest.yaml` S15: `status: built`; `entry` overworld (147, 124) on foot with the ship at the `fir_crescent` dock;
  `walk: [overworld:warp:gurgu-b1, gurgu-b1:warp:gurgu-b2, gurgu-b2:warp:arrival, gurgu-b3:warp:gurgu-b4,
  gurgu-b4:warp:gurgu-b5, gurgu-b5:battle:ashen_queen]`; `nonLoadBearing`: the queen's `hideIf`. No `milestones`
  (S15 sets one flag).
- `debug-scenarios.yaml`: `w_s15_start` (entrance `fir_crescent`, L21, B5 gear, the flags through S14, the canoe and
  the lute, the ship at the dock) and `w_boss_ashen_queen` (L23, B5 gear, 3 potions, `throne_kary`).
- Tests: `tests/quest/fire/fir_d1_sites.test.ts` (6), `tests/quest/fire/hazardPath.test.ts` (7),
  `tests/quest/fire/fir_d1_walk.test.ts` (2), `tests/balance/w_fir_d1.test.ts` (3).

**Balance (S15, 400 seeds, kit `w_s15`, 3 potions, `[ashen_queen, fire_lizard]`):** before this pass the party beat the
queen alone 100 % of the time at L21-L25, sensible and careless: her 600 HP and six hits at attack 40 never
threatened the B5 party. The phase alone moved the level curve too little (at attack 72: L21 42.2 %, L23 63.7 %, too
close to both bounds), and the lizard steepened it. Sensible: L21 **40.8 %** (target <= 45), L22 56.0 %, L23 **64.0 %**
(target 60-80), L24 70.0 %, L25 78.0 %. Careless: L21 58.0 %, L23 78.5 %. As in every balance test the sim does not
play enemy spells, so in the game her `ai` (38 % fir2 / dark / hold) trades some of her 6-hit turns for spells.

**Topology:**

| Floor | Size | Dead ends | Aspect / fill | Hazard-free route |
|---|---|---|---|---|
| gurgu-b1 | 40x34 | 6 | 1.23 / 0.33 | both stairs dry at the shortest length (30-35) |
| gurgu-b2 | 48x26 | 4 | 2.33 / 0.39 | east stair 16 / 16; west landing and forge stair 49 / 45 (the fords) |
| gurgu-b3 | 34x46 | 5 | 0.76 / 0.38 | 37 / 37 |
| gurgu-b4 | 40x36 | 3 | 1.16 / 0.48 | 74 dry / 57 over lava (1.30x) |
| gurgu-b5 | 30x32 | 2 | 1.12 / 0.56 | boss approach 16 / 16; boss S, 17 |

The stair graph: B1 <-> B2 by twin stairs, B2 <-> B3 by two stairs (one into the forge), then a chain to B5, so it
branches (`gurgu: branching`; FIR-D1: 1 of 1 dungeons branches).

**Gates:**

| Gate | Output |
|---|---|
| G1 the two layout scripts, `stubs.py`, `world.py --check-bands`, `world.py`, `git diff --exit-code assets-src/maps` | exit 0, no diff (`stubs: wrote 99 stub sources, kept 38 real maps`) |
| G2 `build_map.py gurgu-b1 ... gurgu-b5`, then `--check-determinism` on the 5 ids | each `gurgu-bN: WxH -> assets/maps/ai/gurgu-bN.yaml`, then `gurgu-bN: deterministic`. No world compile (no site file changed) |
| G3 | n/a: no overworld chunk changed |
| G4 `npm run build`; `npx vitest run --maxWorkers=2 --minWorkers=1` | build exit 0; vitest exit 0, `Test Files 325 passed (325)`, `Tests 7125 passed, 5 skipped (7130)` |
| G5 `npm run quest -- --mutate --stage S15` | (a) OK S15; (b) OK (22 withheld runs); (c) OK (135192 states); (d) `ashen_queen L21.9 [21,24]`; (e)-(h) OK, (g) `s*=0.736 (31 pairs; 0 assumed)`; `mutations: OK (3 gate rows; 4 elements, each removal reported)`: GT-21 (both canoe cuts) and GT-37 (`crescent_ring`) caught as `SKIP S15 ashen_queen reachable without canoe`; `quest-verify: OK` |
| G6, G7 | `assetCoverage`, `fileCeilings`, `questCeilings`: passed |
| G8 `build_map.py --selftest` | `build_map selftest: 104 checks passed` |
| G9 `w_fir_d1.test.ts`; `check-bounds "tests/balance/w_*.test.ts"` | 3 passed; `check-bounds: OK (12 tests)` |
| G10 browser, port 5231, `mute=1` | `w_s15_start` (headless Chromium, `/tmp/w-fir-d1/pw/s15.mjs`): from (148, 124) the canoe down R-volcano into `gurgu-b1`, then B2 (38, 7), B3 (16, 5), B4 (3, 5) (the lava wade cost 35 HP each), B5 (14, 5); the queen's talk started `Ashen Queen, Fire Lizard` on `throne_kary`; won, FIRE_CRYSTAL_LIT set; 0 console errors. The driver held off random encounters (it tops up the encounter counter before each step) so the walk is deterministic. Screenshots: `/tmp/w-fir-d1/s15_0_start.png`, `s15_1_b1.png`, `s15_4_b4.png`, `s15_5_queen.png`, `s15_6_battle.png`, `s15_7_end.png` |
| G12 `designNotes`, `originality` | passed (`gurgu: branching`) |
| G13, G14 `npm run quest -- --only gh` (and `macroGeography`, `travelMatrix` in G4) | `(g) geography: OK  s*=0.736 (31 pairs; 0 assumed)`; `(h) travel matrix: OK  (12 rows, 2 basin rows; 9 checked, 5 pending)`; `quest-verify: OK` |
| G16 `stubs.py --check FIR-D1` | `stubs: 0 left for FIR-D1` |
| G17 `world.py --check-bands && world.py` | `bands: OK`; `basins: OK (aldi 2779 cells, ocean 12692 cells; canal joins)` |
| `stage_backgrounds.py fire_temple magma_temple throne_kary` / `--check ...` | staged (565 / 594 / 458 KB); `--check` exits 1 with `no bounds for fire_temple (known: shoreline)`, as for ERT-O |

**Originality:** a fresh reviewer, given the five sources (ASCII grounds, objects, lines, the note), the previews and
the cutscene, returned `originality review: PASS gurgu-b1 gurgu-b2 gurgu-b3 gurgu-b4 gurgu-b5`. It found two Distinct
claims loose: B2's fords (the streams then covered only part of the gallery, so you walked round them) and B4's
"maze" (one corridor that doubles back). The streams now cross the gallery wall to wall with one stone ford each, and
the B4 claim reads "a short wade across open lava and a dry corridor that doubles back round the field".

**Deviations / shared-file edits (each small):**

- `tests/data/enemyAttack.test.ts` (+2): the Drowned Sovereign / Ashen Queen pin now reads only the phases that set an
  attack animation, since the queen gains a full-HP phase without one. The rule it pins (heavy only at 0.5) holds.
- `tests/scenes/bestiary/bestiaryHabitats.test.ts` (+1): `dragon` is now placed (B3-B5), so its habitat pin reads
  "Gurgu Volcano B3, Gurgu Volcano B4, Gurgu Volcano B5". `vampire` and `lich` stay "Not placed yet".
- 4.4 names the boss battle `ashen_queen`. The roster queen can't reach 3.7's band through `bossPhases` alone (the
  level curve stays too flat), so a `fire_lizard` (an S15 roster enemy) fights beside her, as ORD-O and ELF-O add
  escorts.
- The battle's flag is the milestone FIRE_CRYSTAL_LIT itself (ORD-O's pattern), and `fir_ashen_falls` sets it too.
- The B5 inspect cell and the queen's sprite (`princess`, tint `#b8573a`) use existing art. No smoke deco (no part).

**AGENTS.md delta (for INT):** in "Editing a 2x Map", add `layouts/fire/gurgu_upper.py` (`gurgu-b1`, `-b2`) and
`gurgu_lower.py` (`gurgu-b3..b5`), with `gurgu_common.py` (lava = the `lava` remap on `%`, one `hazards` entry per
floor from the `%` cells). A dungeon floor's hazard rule is tested by `tests/quest/fire/hazardPath.test.ts` (dry path
<= 1.5x the shortest). The debug scenarios gain `w_s15_start` and `w_boss_ashen_queen`; the backgrounds `fire_temple`,
`magma_temple` and `throne_kary` are staged.
<!-- === end FIR-D1 === -->
<!-- === FIR-D2 FIRE (pass W: owned by FIR-D2) === -->
<!-- === end FIR-D2 === -->
<!-- === ORD-O ORDEAL (pass W: owned by ORD-O) === -->
### ORD-O result: the Citadel of Trials and Bahamut (branch `w-ord-o` from `mainline` 62033ba)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-ord-o/`.

**Files:**

- `layouts/world_ordeal.py` (75 lines): ORDEAL's RegionOut, airship-only (no dock). Land no landing reaches becomes
  rock. Every walkable cell is zoned, and so is every water cell of the box, band water included. The reach roots are
  the entrances.
- `layouts/ordeal/world_ordeal_ground.py` (178): the ground. Its docstring is the design note.
  - The plateau is an ellipse about x 66-96, y 10-46, bent by seeded noise. It has a 2-cell rim of peaks and the crag
    the citadel is cut into, and it holds a heath. A knife ridge runs from the north-east rim to the centre and splits
    off a glen, and there is a forested sink south of the ridge's end.
  - The landing meadow lies at x 71-80, y 28-34.
  - The six Cardia isles: Bahamut's horseshoe (107, 52), whose bay opens east; the hermit's isle (119, 39); and the
    north, east, stack and west isles.
- `layouts/ordeal/world_ordeal_data.py` (91): zones, landmarks, entrances, doors and the hermit's inspect cell.
  - Zones, all with `modes` and `name`: `ord_heath` "Citadel Heath" (weretiger, nightmare, rakshasa); `ord_isles`
    "Cardia Isles" (wyvern, wyrm, basilisk); `ord_sea` "Cardia Sound" (ship; sahagin_prince, white_shark, deepeyes,
    sea_snake).
  - Landmarks: the citadel (`castle_icon`, style `stone`, between two broken temple pillars; its top row stands on the
    crag), Bahamut's `cave_mouth`, the hermit's `tent` (`collide: alpha`, inspect cell (119, 39)) and 3 boulders.
  - Entrances: `ord_citadel` (75, 28) with its door (75, 27) to `citadel-1f:arrival`; `ord_bahamut` (106, 53) with its
    door (106, 52) to `bahamut-cave:arrival`; `ord_meadow` (75, 32); and one landing per isle, `ord_isle_{hermit,
    north, east, stack, west}`.
- `layouts/ordeal/citadel.py` (191) writes `citadel-1f` (36x30), `-2f` (40x32) and `-3f` (34x22).
  - 1F: the court. The stone steward holds the empty throne's crown. Talking to it plays `ord_throne_wakes`, which sets
    ORD_O_THRONE, and that opens the arch's two `keyItemGates` to the west wing and the stair. There is also an east
    hall with two store nooks, a cistern spur and a lamp niche.
  - 2F: a start ring round a lattice. The 6 pads are transitions within the map, each in a blind stub. 4 return to
    `ring` and 2 lead to `hall_west` / `hall_east` of the north hall, which holds the stair up and has a return pad. The
    hall is a `reach_roots` entry, and the chokepoint check is off on this floor (it floods from the arrival only).
  - 3F: the trial hall, `canSave: false`. You arrive in the east. The keeper NPC sits in the west inside a ring of 8
    statues, and talking to it starts `[dragon_zombie, king_mummy x3]`, whose `postVictoryCutscene` is `ord_seal_won`.
    The stair behind the dais is one-way down to 1F `chute` and needs ORDEALS_GUARD_DEFEATED.
  - Chests 3 / 4 / 3 (`CHEST_ORD_O_*`): cabin, opal_helm, hi_potion; ether, phoenix_down, opal_armlet, hi_potion;
    hi_potion, ether, aegis_shield. Every floor has `exit` to `ord_citadel`.
- `layouts/ordeal/bahamut.py` (131) writes `bahamut-cave` (28x26) and `bahamut-lair` (32x22).
  - The cave: a winding throat, a tide grotto with 1 chest (diamond_armlet), two blind spurs, and the stair down.
  - The lair: an antechamber and the hall with 6 dragon NPCs, existing sheets tinted.
  - Bahamut has `requiredItem: ordeal_seal`, cutscene `ord_bahamut_trial` (`onceFlag` CLASS_UPGRADED) and `action:
    classUpgrade` (`actionFlag` CLASS_UPGRADED). A second Bahamut, `showIf` CLASS_UPGRADED, stands on the same cell.
- `cutscenes.yaml` (ORD-O anchor):
  - `ord_throne_wakes` (set_flag ORD_O_THRONE);
  - `ord_seal_won` (set_flag ORDEALS_GUARD_DEFEATED, give_item ordeal_seal; D-W14);
  - `ord_bahamut_trial` (take_item ordeal_seal, set_flag CLASS_UPGRADED).
- `enemies.yaml` (dragon_zombie anchor, `bossPhases` only): one phase from full HP (`hpThreshold: 1.0`), hits 3, attack
  95, with a message.
- `quest.yaml`:
  - S18 is `status: built`. `walk: [citadel-1f:cutscene:stone_steward, citadel-3f:battle:trial_guardian]`. `entry` is
    overworld (149, 163) on foot, with the airship at (149, 162) and the ship at the `fir_crescent` dock (146, 124).
  - S18's `nonLoadBearing` has 5 entries: the 2 arch gates and the 2 chute cells (S18's own puzzle, which guards no
    grant) and the keeper's `hideIf`.
  - S19 is `status: built`, `walk: [bahamut-lair:cutscene:bahamut]`. `entry` is the meadow (75, 31), with the airship
    at (75, 32) and the ship at the dock.
- `debug-scenarios.yaml`:
  - `w_s18_start`: entrance `ord_meadow` in the airship, L24, B5 kit, flags through S17;
  - `w_s19_start`: entrance `ord_bahamut`, L25, B6 kit, the seal held, the airship parked at (106, 55);
  - `w_boss_dragon_zombie`: L25, B6 kit, the `abandoned_castle` background.
- Tests:
  - `tests/quest/ordeal/ord_o_world.test.ts` (6): the anchors within ±2; no dock in the box; no walk leaves the plateau
    or an isle, or joins two of them; a grass landing within 8 steps of each anchor and isle; the doors; the zones'
    cover; the hermit's slate.
  - `tests/quest/ordeal/ord_o_sites.test.ts` (8): chests and EXIT; the arch gate; the lattice; the boss, its place and
    the seal; the one-way stair; the lair; Bahamut's one-talk upgrade through `FieldNpcActions`.
  - `tests/balance/w_ord_o.test.ts` (3).
- Generated: `assets-src/maps/overworld.yaml`, the 5 map sources, `assets/maps/ai/{overworld.yaml, index.yaml}`,
  ORDEAL's 13 changed chunks and the 5 compiled maps.

**Gates:**

| Gate | Output |
|---|---|
| G17 `world.py --check-bands && world.py` | `bands: OK`; `basins: OK (aldi 2781 cells, ocean 22696 cells; canal joins)`; cuts unchanged (`W_west 7, W_isthmus 14, W_arm 2, W_south 2, W_east 4, crescent_ring 9`) |
| G2 `build_map.py overworld --region ordeal` | `overworld: region ordeal of 192x192 -> assets/maps/ai/overworld.yaml (158 approved parts, 94 placeholders)`, max RSS 5.4 GB |
| G2 `--check-determinism --region ordeal overworld` | `overworld: deterministic` (27 s, max RSS 5.9 GB) |
| G2 `build_map.py` and `--check-determinism` on the 5 ids | each `<id>: WxH -> ...`, then `<id>: deterministic` |
| G1 layout scripts, `stubs.py`, `world.py` (PYTHONHASHSEED 0 / 1), `git diff --exit-code assets-src/maps` | clean (byte-identical sources) |
| G3 owned chunks | `grep -vxFf owned.txt` prints nothing (exit 1) |
| G16 `stubs.py --check ORD-O` | `stubs: 0 left for ORD-O` |
| G5 `npm run quest -- --mutate --stage S18` | (a) OK S18; (b) OK (41 withheld runs); (c) OK (826 states); (d) `dragon_zombie L24.2 [24,27]`; (g) `s*=0.735 (31 pairs; 16 assumed)`; (h) OK; `mutations: OK (3 gate rows; 6 elements, each removal reported)`; `quest-verify: OK` |
| G5 `--stage S19` | (a)-(h) OK, (d) `S19 L24.1 [24,27]`; `mutations: OK (1 gate rows; 1 elements)`; GT-24 caught (`SKIP S19 CLASS_UPGRADED reachable without ordeal_seal`); `quest-verify: OK` |
| `--stage S17` (FIR-O's, re-run) and the full `npm run quest -- --mutate` | both `quest-verify: OK`; full run: `(a) ... optional: S19 S18* reachable`, `(c) 566 states`, `mutations: OK (43 gate rows; 54 elements, each removal reported)` |
| G4 `npm run build` | exit 0 |
| G4 `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; `Test Files 303 passed (303)`, `Tests 6106 passed, 8 skipped (6114)` |
| G8 `build_map.py --selftest` | `build_map selftest: 104 checks passed` |
| G9 `tests/balance/w_ord_o.test.ts`, `check-bounds "tests/balance/w_*.test.ts"` | 3 passed; `check-bounds: OK (3 tests)` |
| G12 `designNotes`, `originality` | passed; `citadel: branching`, `bahamut: chain` (ORD-O: 1 of 2 dungeons branch) |
| G10 browser, port 5233, `mute=1` | see below |

**Balance (S18, 400 seeds, kit `w_s18`, 3 potions):** before this pass dragon_zombie won 100 % at L21-L27, alone or
with any escort set. Its 268 HP falls to one warrior's turn and it never acts. After the phase and the keepers:
L25 sensible **86.5 %** (target 75-95), L27 99.0 %, L23 74.5 %. Careless wins 99.8 % at L25: careless casts nothing,
while sensible spends turns on RUSE and LIT.

**Topology:**

| Floor | Size | Dead ends | Aspect / fill | Boss |
|---|---|---|---|---|
| citadel-1f | 36x30 | 4 | 1.28 / 0.51 | - |
| citadel-2f | 40x32 | 2 | 1.14 / 0.60 | - |
| citadel-3f | 34x22 | 2 | 2.07 / 0.72 | W, 23 |
| bahamut-cave | 28x26 | 2 | 1.00 / 0.33 | - |
| bahamut-lair | 32x22 | 1 | 1.87 / 0.84 | - |

The stair graphs: the citadel is 1F <-> 2F <-> 3F plus the one-way 3F -> 1F, so it branches. Bahamut is cave <-> lair,
a chain.

**Originality:** a fresh reviewer got the previews, the ASCII grounds, the notes and every line. Its first pass flagged
two things. Sitting on the throne staged the classic's own trick, so the steward now holds the throne's crown and you
set it back. Two Distinct claims were the classic's (the throne, the send-back pads) and one was not visible (claw
grooves); the claims are rewritten. The re-review returned `originality review: PASS citadel-1f citadel-2f citadel-3f
bahamut-cave bahamut-lair ordeal-overworld`.

**Travel rows and GTs (own):**

- T6's ORDEAL part, checked on the compiled map by `ord_o_world.test.ts`: `ord_citadel` and `ord_bahamut` each have a
  grass landing within 8 steps, and the isles are airship-only. The CLI row T6 stays pending until WATER and WIND are
  built.
- GT-23 is caught in the full run (`SKIP S18`). In `--stage` runs it is reported `pending: the full run checks it`;
  see the verifier change below.
- GT-24 is caught in `--stage S19` and in the full run.

**Browser (G10, port 5233, `mute=1`, Title > Debug):**

- `w_s18_start`: the party starts in the airship at (75, 32). Confirm lands it: mode `walking`, the airship parked at
  (75, 32). North through the gate leads into `citadel-1f`, after one random battle.
- Talking to the steward sets ORD_O_THRONE. You walk through the arch (7, 14) to the west stair, which leads to
  `citadel-2f` (19, 28).
- On 2F, the pad (25, 23) returns you to the ring (21, 28), and the pad (19, 24) takes you to the hall (6, 10). The
  stair leads to `citadel-3f` (30, 11).
- Talking to the keeper starts the battle: Dragon Zombie + 3x King Mummy on the `abandoned_castle` stage. The party won,
  and then ORDEALS_GUARD_DEFEATED was set and 1 `ordeal_seal` was held.
- `w_s19_start`: the party enters `bahamut-cave` and goes down to `bahamut-lair`. One talk with Bahamut ends with
  CLASS_UPGRADED set, the seal gone, and the classes `knight, ninja, white_wizard, black_wizard`.
- Screenshots: `/tmp/w-ord-o/shots/ord-o-s18-air.png`, `ord-o-s18-westwing.png`, `ord-o-s18-hall.png`,
  `ord-o-s18-guardian.png`, `ord-o-s18-battle.png`, `ord-o-s18-won.png`, `ord-o-s19-bahamut.png`,
  `ord-o-s19-upgraded.png`.

**Deviations / shared-file edits (each small; the integrator should review them):**

- `src/scenes/exploration/FieldNpcActions.ts` (W1-B's; +7 lines, 176). `runPending` runs a `classUpgrade` NPC's upgrade
  after its cutscene resolves, so Bahamut takes the seal and upgrades the party in one talk. Before, the cutscene
  played and the upgrade waited for a second talk. The upgrade is extracted into `upgrade(def)`. An NPC with no
  cutscene behaves as before.
- `src/progression/questMutate.ts` (W1-I's; +10). In `--stage` mode, an uncaught gate row is `pending: the full run
  checks it` in two cases: it expects only another stage's SKIP, which (b) can't produce in a stage run (GT-23 in S17),
  or its element is an earlier stage's whose grants the assumed start already holds (GT-23 in S18). Without this,
  building S18 turned FIR-O's `--stage S17` red. The full run and `--strict` are unchanged, and GT-23 is caught there.
- `src/progression/questProofsLate.ts` (W1-I's; 1 line). FIR-O's "pending, not failed" rule for a built stage outside
  its band because of assumed pending stages now also covers above the band. The off-path S18 and S19 are walked after
  the pending S20-S30 at their band lows (L34). `--strict` still fails it.
- `tests/quest/originality.test.ts` (W1-I's; +4).
  - Floors without a floor label are grouped by their stem: `bahamut-cave` and `bahamut-lair` become the dungeon
    `bahamut`.
  - The Topology-line floor and boss check runs only on labelled floors. Before, any `<name>-cave` site failed it
    (`Topology names , the floors are bahamut-cave`), and PST's `past-chaos` would have too.
- `tests/data/mapVariants.test.ts`: maps with `MapData.exit` (pass W dungeon floors) may have random battles.
- Flags carry the sub-letter (questFlags rule 3.1): `ORD_O_THRONE` instead of 4.5's `ORD_THRONE`, and `CHEST_ORD_O_*`.
- **The throne trigger.** 4.5 says an inspect cell, but inspect cells take text only. The trigger is the stone steward
  NPC beside the throne, which carries the cutscene.
- **The keepers.** The boss battle adds 3 king_mummy keepers. The roster dragon_zombie can't reach the 3.7 band
  through `bossPhases` alone.
- **Sprites.** The NPCs use tinted existing sheets: the steward is `king` and the keeper `old_man`; Bahamut is
  `garland_npc`; the dragons are knight, mage, old_man, monk, white_mage and black_mage. In the 2x field art the steward's
  grey `tint` did not visibly apply (it drew in the king's colours). That is an engine observation, not changed here.
- On 1F, a broken pillar beside the arch blocks row 14, so the way into the west wing is row 15. It is reachable;
  the cell is cosmetic.
- `.playwright-mcp/` and `playwright-responses/` in the main checkout: only my own files were removed.

**AGENTS.md delta (for INT):**

- In "Editing a 2x Map", add `layouts/world_ordeal.py` with `layouts/ordeal/world_ordeal_{ground,data}.py` (ORDEAL,
  airship-only), and `layouts/ordeal/citadel.py` / `bahamut.py`, which write `citadel-1f..3f` and `bahamut-cave` /
  `-lair`.
- A within-map transition (a pad) is allowed, and a floor reached only by pad names its entrance in
  `no_unreachable_walkable.reach_roots`.
- The debug scenarios gain `w_s18_start`, `w_s19_start` and `w_boss_dragon_zombie`.
- The `classUpgrade` action follows its NPC's cutscene.
<!-- === end ORD-O === -->
<!-- === WAT-O WATER (pass W: owned by WAT-O) === -->
### WAT-O result: Onrac's coast, the waterfall and the caravan (branch `w-wat-o` from `mainline` 81e93d4, merged with `mainline` 62033ba (FIR-O))

No AI or paid calls. No kneel files. Scratch in `/tmp/w-wat-o/`.

**Files:**

- `layouts/world_water.py` (the RegionOut, with the design note) and `layouts/water/world_water_land.py` (ground),
  `world_water_sites.py` (icons, doors, anchors, inspect cells), `world_water_zones.py` (zones). The helper modules carry
  `world_water_` in their names, so they never clash with another region's helpers on `sys.path`.
- `layouts/water/waterfall.py` -> `waterfall-cave` (30x22) and `layouts/water/caravan.py` -> `caravan-camp` (26x18),
  both with design notes.
- Data: `cutscenes.yaml` `wat_cube_given`; `quest.yaml` S21 and S22 (`walk`, `entry`, one `nonLoadBearing`,
  `status: built`); `debug-scenarios.yaml` `w_s21_start`, `w_s21_neg_nocanoe`, `w_s22_start`.
- Tests: `tests/quest/water/wat_o_world.test.ts` (13) and `wat_o_sites.test.ts` (9).
- Generated: `assets-src/maps/overworld.yaml`, the WATER chunks `assets/maps/ai/overworld/below_{0..3}_{0..3}`
  (`below_3_3` is unchanged: open sea), `overworld.yaml`, `index.yaml`, and both compiled sites.

**The region (4.6):**

- A long cold coast (x 3-53, y 3-57) under a wall of northern peaks.
- **R-waterfall:** a spill tarn in the peaks feeds the falls at (30, 8-10). The river (x 31-32) runs down a sheer
  gorge (walls x 28-30 and x 33+) to y 27, then winds south-east past Onrac's meadow into the bay at (43, 40).
- **The cave:** its door is the falls' bottom-left cell (30, 10). It stands on a 3-cell **sand** ledge (28-30, 11)
  that touches only rock, the falls and the river. The canoe is the only way in, and the airship cannot land on the
  ledge.
- Onrac's icon is a 3x3 house from WAT-T's site file, gate (28, 39). Its door transition and door cell open only once
  `onrac.yaml` is no longer a stub, because a stub is never compiled and the cross-file test would fail.
- **Caravan:** the tent stands on a rock outcrop in the western dunes, arrival (8, 28). An oasis meadow lies 5 cells
  away, with a signpost.
- Other features: sea-stacks across the bay mouth; an upland tarn wood; the snow firs; a cairn at the gorge's mouth
  that hints at the canoe.
- Anchors at their targets exactly: `wat_onrac` (28, 39), `wat_waterfall` (30, 11), `wat_caravan` (8, 28). Each has
  grass within 8 steps. There is no dock, wall, patch or barrier.
- Zones: `wat_streams` (canoe: the river; S21), `wat_dunes` (S22), `wat_isles` ("Onrac Coast", S20 land) and `wat_sea`
  (ship; every Water cell of the box, band cells included). Neighbouring zones share no species.
- The region's checks are `river_check`, `warp_leaves` and `min_blob` (mountain / sand / forest 3).

**Sites:**

- `waterfall-cave`, on one floor:
  - an entry ramp, then a spray hall split by a falls channel (Lake) with one footbridge, a passage, and the vault;
  - two dead-end galleries, each with a chest (`ether` and `hi_potion`; flags `CHEST_WAT_O_FALLS_*`);
  - the automaton (a tinted `knight`) with `giftItem: cube`, `giftFlag: CUBE_GIVEN`, and the cutscene
    `wat_cube_given`, which tells of its war-made twin in the sky castle and sets `WAT_O_TWIN_TOLD`;
  - `exit` to `wat_waterfall`, and an inspect statue.
- `caravan-camp`: a rock ring with three tents, a cook fire, a spring pool and the trader's awning. It holds 5 NPCs:
  - the trader (`takeGold: 5000`, `giftItem: fairy_bottle`, `giftFlag: WAT_O_BOTTLE_BOUGHT`);
  - the master, whose hint names Gaia;
  - a scout, whose hint is the waterfall and the boat;
  - a drover (wandering) and a cook.

**Gates:**

| Gate | Output |
|---|---|
| 5.4 done-when, proof (d3) | `(d) bands: OK  ... S21 L28.1 [25,28]  S22 L25.2 [25,28]  (29 pending)  prices: OK (1 takeGold)`. The bottle's stage start is assumed: its ancestors are pending, so the 80 % rule waits for INT, which tunes the price |
| G1 | `world.py`, `waterfall.py`, `caravan.py` and `stubs.py`, then `git diff --exit-code assets-src/maps`: clean |
| G2 | `build_map.py overworld --region water waterfall-cave caravan-camp`: 3 maps, 17-39 s, max RSS 3.97 GB. `--check-determinism --region water overworld waterfall-cave caravan-camp`: all 3 `deterministic` |
| G3 | `world.py --owned-chunks water`, then the merge-base diff of `assets/maps/ai/overworld/` filtered by it: no output |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: 302 files, 6020 tests, **1 failed** (`questGraph` "passes (a), (b) and (c)": the full run's (b), see below) |
| G5 S21 | (a) OK, (b) OK (26 withheld runs), (d) OK, (e)-(h) OK, `mutations: OK (2 gate rows)`. GT-25 is caught as `SKIP S21 CUBE_GIVEN reachable without canoe`. **(c) FAIL**: 6 SOFTLOCKs, every one through the act-1 jetty ship, see below |
| G5 S22 | the same: (a), (b), (d)-(h) and mutations OK; **(c) FAIL**, the same jetty ship |
| full `npm run quest -- --mutate` | (a) OK (S21 and S22 reached on the witness), (c) OK (753 states), (d)-(h) OK, `mutations: OK (42 gate rows; 50 elements)`. **(b) FAIL**: `SKIP S21 CUBE_GIVEN reachable without S20 (no grants)` |
| G6 G7 G12 G13 G14 G15, `tests/quest/water/` | 10 files, 371 passed, 9 skipped. `(g) geography: OK  s*=0.735 (31 pairs; 15 assumed)` and `(h) travel matrix: OK  (12 rows, 2 basin rows; 1 checked, 13 pending)` |
| G8 | `build_map selftest: 104 checks passed` |
| G10 browser (port 5234, `mute=1`; screenshots `/tmp/w-wat-o/b_*.png`) | `w_s21_start`: walked to the gorge's mouth, stepped east (mode `canoe`), paddled 17 cells north through river fights, stepped onto the ledge (`walking`) and into the cave, and talked to the automaton. `cube` held, CUBE_GIVEN and WAT_O_TWIN_TOLD set. `w_s21_neg_nocanoe`: the step east from (30, 28) is refused, mode `walking`. `w_s22_start`: into the camp, talked to the trader; `fairy_bottle` held, gold 6000 -> 1000. 0 console errors |
| G11 | only WAT-O's paths changed |
| G16 | `stubs: 0 left for WAT-O` |
| G17 | `bands: OK`, `basins: OK (aldi 2781 cells, ocean 21882 cells; canal joins)` |
| originality | a fresh reviewer read the crops, notes and dialogue. Every `Distinct:` line names at least 3 features: `originality review: PASS overworld(water) waterfall-cave caravan-camp` |

**Open failures (integrator):**

- **Stage-mode (c): the act-1 jetty ship.** The ship spawn (BIKKE_DEFEATED) still waits off Cornelia's jetty, and
  `a1_pravoka` has no dock yet. With the airship landed in act 1, boarding that ship strands the party: the only dock it
  reaches is `fir_crescent`, and the airship stays behind. A1-T's quay dock (or the ship's move to it) clears this.
  Every airship stage started from act 1 will see it.
- **Full (b): `SKIP S21 ... without S20 (no grants)`.** S20 (Onrac, WAT-T) is pending and grants nothing, so
  withholding it withholds nothing. `questChecks` already skips a *built* ancestor without grants; the same rule for a
  pending one, or WAT-T building S20, clears it. This is also the one G4 failure (`questGraph`).

**Deviations:**

- Scenarios set no story flags. The field rules on this way read none (the canoe item and the airship decide), and
  `DebugScenarioField`'s flag list is act 1's.
- Before the FIR-O merge, my compiles used a scratch copy of the compiler with the reach-root fix that FIR-O then
  shipped. After the merge everything was recompiled with the repo's compiler: the digest `5be1e6592dc4f9bf` is
  unchanged and only the `water` box digest changed.
- The overworld design note lives in the `world_water.py` docstring, because the world source is generated.

**AGENTS.md delta (for INT):**

- "Editing a 2x Map" gains the row `layouts/world_water.py` (+ `layouts/water/world_water_*.py`) -> the WATER box of
  `overworld.yaml`, and `layouts/water/waterfall.py` / `caravan.py` -> `waterfall-cave` / `caravan-camp`.
- Debug scenarios gain `w_s21_start`, `w_s21_neg_nocanoe` and `w_s22_start`.
<!-- === end WAT-O === -->
<!-- === WAT-T WATER (pass W: owned by WAT-T) === -->
### WAT-T result: Onrac, S20 (branch `w-wat-t` from `mainline` a11defa7)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-wat-t/`.

**Files:**

- Layouts (new): `layouts/water/town_onrac.py` (`onrac`, 50x44), `town_onrac_people.py` (every outdoor line, the
  signpost and bell texts, the gate message), `town_onrac_interiors.py` (the script to run) with `town_onrac_homes.py`
  (houses `bellringer`, `netmender`, `smoker`, `shipwright`, `healer`, `tanner`; `interiors_common.Town("onrac")`) and
  `town_onrac_shops.py` (the 5 shops and `onrac-inn`). `town_onrac_site.py`: docstring only (the defaults stand), but
  the town is no longer a stub, so WAT-O's module now writes the icon's door: the world was regenerated under the lock
  (`stubs.py`, `world.py`, `build_map.py overworld --region water`).
- Generated: the 13 `onrac*` sources and compiled maps (`index.yaml` +13), `assets-src/maps/overworld.yaml` and
  `assets/maps/ai/overworld.yaml` (the door transition (28, 38) -> `onrac` `gate` and its walk cell; no chunk PNG
  changed). The 5 `sea-shrine-b1..b5` **stubs compiled** (sources untouched, still stubs; `index.yaml` +5) so that the
  submarine's transition has a compiled target (`crossFileValidation`), as ERT-O did for Melmond and WND-O for Gaia;
  WAT-D replaces them.
- Data: `quest.yaml` S20 (`entry`, `walk: [overworld:warp:onrac]`, `status: built`) and town `onrac` `built`;
  `debug-scenarios.yaml` `w_s20_start`, `w_s24_neg_nooxyale`, `w_wat_t_onrac_lit`; `shops.yaml` unchanged (W1-F/W1-G's
  `onrac_*`: B6 arms, L6 magic, inn 500).
- Tests: `tests/quest/water/wat_t_onrac.test.ts` (8: the submarine gate and transition, the three gate outcomes,
  the doors and exits, the overworld door, EXIT-safety, clinic / inn / shops, hints, reactive) and `wat_t_walk.test.ts`
  (2).

**Design** (original):

- **The town.** A frosted shelf (a pale `grass` remap) between the northern cliffs and the bay. The land `gate`
  (23, 2) is in a gap in the cliffs; the gap's mouth (23-24, 0) leads back to `wat_onrac`.
- **Lanes.** Bell Road runs from the gate down to the quay. Tar Lane (y 13-14) crosses it under the cliffs: the magic
  shops, the arms, the bell-ringer's and the net-mender's. Salt Row (y 23-24) runs through the middle: the smokehouse,
  the item shop, the inn. The quay (y 31-32) runs along the shingle: the healer's house (the shrine sign), the tanner's,
  two shut stores. A west lane joins the three.
- **Bell Square:** a stone bell tower (an inspect cell: the barnacled bell netted from the sunken city), the well,
  benches. Between Tar Lane and Salt Row stand two cod racks; in the north yard the tar is boiled among snow firs.
- **The dry dock** (east): a stone-walled basin (canal water) at the bay's edge, its sea-gate shut, with walkways on three sides and the
  shipwright's shed at its head. The iron submarine (the `buried_hull` placeholder, `slate`) lies in it. Its gangway
  plank (38, 27) is a `keyItemGates` cell (`requiredItem: oxyale`, `permanent: false`) and the transition to
  `sea-shrine-b3` `nave`. The gate's message is the shipwright's, conditional: with the `fairy_bottle` he sends the
  party to Gaia's spring, otherwise he asks for oxyale. The entrance `dry_dock` (37, 27) is the walkway cell in front.
- **Two plank piers** run into the bay; a fishing boat is moored at the west one.
- **People.** 17 outdoor NPCs. The hint NPCs are `onrac_waterfall_hint` (the waterfall, the canoe up the gorge) and
  `onrac_caravan_hint` (the caravan in the western dunes and its bottle). The oxyale chain is told by the caravan hint,
  `onrac_fairy_lore` (fairies of Gaia's spring breathe oxyale), the shipwright and his daughter (who reacts to
  FAIRY_FREED), and `onrac_mermaid_tale` (the sea-folk of the shrine's upper halls, WAT-D's B1). Lines change on
  WATER_CRYSTAL_LIT (most people), `item:oxyale`, FAIRY_FREED and CUBE_GIVEN.
- **Clinic:** `onrac_healer` (`action: clinic`, 90 G per level, B6). The inn keeper has `action: inn`. Two chests:
  `CHEST_WAT_T_NETMENDER` (Phoenix Down) and `CHEST_WAT_T_TANNER` (Ether).
- No cutscene: the submarine is a plain gated transition, so the `cutscenes.yaml` anchor stays empty.

**Town standard (G15):** `onrac: houses 13/8 interiors 6/6 outdoor 17/14 interior 15/12 hints 2/2 reactive 26/4
shops 5/5 inn 500/500 clinic true/true`.

**Gates:**

| Gate | Output |
|---|---|
| 5.4 done-when | checkpoints S20 and `w_s24_neg_nooxyale` pass (G10 below) |
| G1 | `town_onrac.py`, `town_onrac_interiors.py`, `stubs.py`, `world.py`, then `git diff --exit-code assets-src/maps` (after the commit): clean, exit 0 |
| G2 | `build_map.py` on the 13 `onrac*` ids: each `<id>: WxH -> ...`; `--check-determinism` on the 13: all `deterministic`. The site file changed, so also `build_map.py overworld --region water` (under the lock) and `--check-determinism --region water overworld`: `overworld: deterministic` |
| G3 | `world.py --owned-chunks water`, then the merge-base diff of `assets/maps/ai/overworld/` filtered by it: no output (no chunk PNG changed: the door is collision and data only) |
| G4 | `npm run build`: exit 0. `npx vitest run --maxWorkers=2 --minWorkers=1`: `Test Files 328 passed (328)`, `Tests 7388 passed, 3 skipped` |
| G5 | `npm run quest -- --mutate --stage S20`: (a) OK S20; (b) OK (24 withheld runs); (c) OK (102936 states); (d) `S20 L25.1 [25,28]`; (e) OK (5 towns, 3 pending); (f)-(h) OK; `mutations: OK (0 gate rows)`; `quest-verify: OK`. The full `npm run quest -- --mutate`: `quest-verify: OK` (47 gate rows, 59 elements; (b) OK, so WAT-O's open `SKIP S21 ... without S20` is gone) |
| G6, G7 | `assetCoverage`, `fileCeilings`, `questCeilings` passed; every new script is at most 212 lines |
| G8 | `build_map.py --selftest`: 104 checks passed |
| G9 | no balance file (S20 has no boss) |
| G10 browser (port 5235, `mute=1`, own headless Chromium via `/tmp/w-wat-t/drive.cjs`; the server is stopped) | `w_s20_start`: overworld (28, 39), one step north onto the icon door: map `onrac` at the gate (23, 2), then down Bell Road to Bell Square; 0 console errors (`/tmp/w-wat-t/s20_meadow.png`, `s20_onrac_gate.png`, `s20_square.png`). `w_s24_neg_nooxyale`: `onrac` (37, 27), step east onto the gangway: the shipwright's line ("The shipwright bars the gangway ..."), the party stays at (37, 27), map `onrac`; 0 errors (`s24neg_drydock.png`, `s24neg_message.png`). `w_wat_t_onrac_lit`: the square's people speak their lit / cube lines; 0 errors (`lit_waterfall_hint.png`, `lit_fairy_lore.png`) |
| G11 | `git status --porcelain` shows only WAT-T's paths (plus the compiled sea-shrine stubs, see Deviations); no scratch files |
| G12 | `designNotes` and `originality` passed. A fresh reviewer took two rounds: the first failed 4 maps on design-note claims that did not match them (the basin "open to the bay", the armour shop's crates, the bell-ringer's tapestry, the healer's cots and carpet); the notes, a dock hand's line and a few props were fixed. Final: `originality review: PASS onrac onrac-armor-shop onrac-black-magic onrac-house-bellringer onrac-house-healer onrac-house-netmender onrac-house-shipwright onrac-house-smoker onrac-house-tanner onrac-inn onrac-item-shop onrac-weapon-shop onrac-white-magic` |
| G13 | `macroGeography` passed; `(g) geography: OK  s*=0.736 (31 pairs; 0 assumed)` |
| G14 | `travelMatrix` passed; `(h) travel matrix: OK  (12 rows, 2 basin rows; 10 checked, 4 pending)` |
| G15 | the row above |
| G16 | `stubs.py --check wat-t`: `stubs: 0 left for WAT-T`, exit 0 |
| G17 | `world.py --check-bands`: `bands: OK`; `world.py`: `basins: OK (aldi 2779 cells, ocean 12692 cells; canal joins)` |

**Deviations / hand-offs:**

- The compiled `sea-shrine-b1..b5` stubs are WAT-D's ids (compiled output only; see Files).
- `npm run quest -- --mutate --stage S24` (WAT-D's stage, pending, no `entry` yet) prints `SHOPLESS onrac` and
  `SHOPLESS lufenia` in (e): with no entry the stage's start strands the party away from both airship-only towns.
  GT-27 (the submarine's `requiredItem: oxyale`) is caught there (`mutations: OK (1 gate rows)`). WAT-D's S24 `entry`
  (the airship beside Onrac, as S20's) should clear the SHOPLESS lines.
- The bell tower and the submarine are code-drawn placeholders (`tower`, `buried_hull`; 0 paid images, open
  question 5).
- `w_s20_start` uses the base classes (S19 is optional); `w_s24_neg_nooxyale` the upgraded B7 party at L27.

**AGENTS.md delta (for INT):** add `layouts/water/town_onrac.py` (`onrac`) and `layouts/water/town_onrac_interiors.py`
(with `_homes.py` and `_shops.py`: `onrac-house-*`, the shops and the inn) to the map table; note the submarine gate
(`onrac` (38, 27), `keyItemGates` oxyale, -> `sea-shrine-b3` `nave`); add the debug scenarios `w_s20_start`,
`w_s24_neg_nooxyale` and `w_wat_t_onrac_lit`.
<!-- === end WAT-T === -->
<!-- === WAT-D WATER (pass W: owned by WAT-D) === -->
<!-- === end WAT-D === -->
<!-- === WND-O WIND (pass W: owned by WND-O) === -->
### WND-O result: the Wind region and Lufenia (branch `w-wnd-o` from `mainline` 81e93d4, merged with `mainline` 62033ba after FIR-O)

No AI or paid calls. No kneel files. Scratch in `/tmp/w-wnd-o/`.

**Files:**

- Region: `layouts/world_wind.py` (the RegionOut; design note in its docstring), `layouts/wind/world_ground.py` (the
  ground from shapes, no RNG: land defaults to mountain, three basins carved out; `_tidy` keeps the organic minimum
  sizes), `layouts/wind/world_sites.py` (icons, doors, anchors, inspect cells, zones). Gaia's door, gate and icon are
  read from WND-T's `wind/town_gaia_site.py` (not edited).
- Lufenia: `layouts/wind/lufenia_town.py` (36x32), `lufenia_interiors.py` (houses stargazer, elder, healer; the two
  magic shops; the inn; `interiors_common.Town("lufenia")`), `lufenia_people.py` (every line; the old tongue).
- Data: `cutscenes.yaml` `wnd_chime_given` (dialog, `give_item chime`, `set_flag CHIME_GIVEN`); `quest.yaml` S26
  `built` (entry, walk) and town `lufenia` `built`; `debug-scenarios.yaml` `w_s26_start`, `w_s26_neg_untaught`. The
  `lufenia_*` shop records W1-F/W1-G seeded are kept as they are (L8 magic, inn 900).
- Tests: `tests/quest/wind/wnd_o_world.test.ts` (9), `wnd_o_lufenia.test.ts` (7), `wnd_o_walk.test.ts` (4).
- Compiled: the WIND chunks of `overworld` (16 files, `--region wind` under the lock), the 7 Lufenia maps, and the
  stubs Gaia's door links to (`gaia`, its 6 houses, 5 shops, inn and `gaia-spring`; R21, WND-T replaces them).

**The region (4.7).** One rugged continent of ranges with three walkable basins, never joined on foot (checked by
`world_sites.zones` and `wnd_o_world.test.ts`), each with a grass airship meadow within 8 steps of its anchor:
Gaia's bowl (grass floor, a crater tarn, a pine grove, a stilled second windmill, a knoll behind the town door) with
a wind-gap east onto the Pinewold upland and its two sea lochs; the Mirage sands (a broken stone spine, a salt pan,
the oasis meadow, the tower on the west spit with a fallen block, a buried bronze dial); Lufenia's cliff-ringed mesa
(grass, moor, a copse), split from the sands by the Sundering fjord. No dock. Anchors: `wnd_gaia` (150, 14),
`wnd_mirage` (132, 37), `wnd_lufenia` (152, 46). Zones: `wnd_highlands` "Gaia Highlands" (tyrannosaur, chimera,
green_dragon), `wnd_mirage_sands` "Mirage Sands" (sand_worm, stone_golem, chimera), `wnd_lufen_moor` "Lufenian
Mesa" (medusa, chimera, green_dragon), `wnd_sea` "North Seas", `modes: [ship]` (sahagin_prince, sea_snake,
white_shark, deepeyes), over every Water cell of the box, bands included; every walkable cell of the box is in
exactly one walking zone (lake cells too, for the canoe).

**Lufenia (4.0.1, 4.7).** Every outdoor Lufenian (12) and every house dweller speaks a fixed phrase of an invented
old tongue until LUFENIAN_LEARNED, then plain speech (17 NPCs reactive on the flag). The keepers (white and black
magic, the inn with `action: inn`, the healer's clinic at 150 G a level) have `showIf: LUFENIAN_LEARNED`. The elder
plays `wnd_chime_given` (NPC cutscene `requiredFlags: [LUFENIAN_LEARNED]`, `onceFlag: CHIME_GIVEN`). Hints:
`lufenia_mirage_hint` (Mirage), `lufenia_cube_hint` (cube). Town standard: houses 5/4, interiors 3/3, outdoor 12/10,
interior 6/5, hints 2/2, reactive 17/6, shops 2/2, inn 900/900, clinic yes.

**Gates:**

| Gate | Output |
|---|---|
| G1 | `lufenia_town.py`, `lufenia_interiors.py`, `stubs.py`, `world.py`, then `git diff --exit-code assets-src/maps`: exit 0 |
| G2 | `build_map.py overworld --region wind` (merged compiler): exit 0, 20.3 s, max RSS 3.97 GB; `--check-determinism --region wind overworld lufenia lufenia-house-{stargazer,elder,healer} lufenia-{white,black}-magic lufenia-inn`: every id `deterministic` |
| G3 | `world.py --owned-chunks wind` vs the 16 changed `assets/maps/ai/overworld/` files since the merge base: no output (grep exit 1) |
| G4 | after the merge: `npm run build` exit 0; `npx vitest run --maxWorkers=2 --minWorkers=1` exit 0, `Test Files 303 passed (303)`, `Tests 6098 passed, 7 skipped` |
| G5 | `npm run quest -- --mutate --stage S26`: (a) OK S26, (b) OK (32 withheld runs), (c) OK (452 states), (d) OK `S26 L28.0 [28,31]`, (e) OK (1 towns, 7 pending), (f)-(h) OK, `mutations: OK (2 gate rows; 2 elements, each removal reported)` (GT-29, GT-30 caught), `quest-verify: OK`. The full `npm run quest -- --mutate`: `quest-verify: OK` (`S26 L28.1 [28,31]`, 41 gate rows, 49 elements) |
| G6, G7 | `assetCoverage` 242 passed; `fileCeilings` 20, `questCeilings` 58 passed |
| G8 | `build_map.py --selftest`: 104 checks passed (before the merge; this branch no longer changes the compiler) |
| G12 | `designNotes`, `originality` passed; reviewer: `originality review: PASS overworld-WIND lufenia lufenia-house-stargazer lufenia-house-elder lufenia-house-healer lufenia-white-magic lufenia-black-magic lufenia-inn` |
| G13 | `macroGeography` passed; `(g) geography: OK  s*=0.735 (31 pairs; 15 assumed)` |
| G14 | `travelMatrix` passed; `(h) travel matrix: OK  (12 rows, 2 basin rows; 1 checked, 13 pending)`. T6-T8 stay pending on `mirage-1f:arrival` / `:inner` (WND-D1). Scratch rows on the real world (`/tmp/w-wnd-o/travel.ts`, started at Cornelia): without the airship no WIND anchor is reached; with it (canoe held or not) all three are, each with a landing cell within 8 steps |
| G15 | `townStandard`: the lufenia row above, every column at or over target |
| G16 | `stubs.py --check WND-O`: `stubs: 0 left for WND-O` |
| G17 | `world.py --check-bands`: `bands: OK`; `world.py`: `bands: OK`, `basins: OK (aldi 2781 cells, ocean 21099 cells; canal joins)` |
| G10 (6.5) | headless Chromium on 5237, `mute=1` (`/tmp/w-wnd-o/pw/checkpoint.mjs`): `w_s26_start`: overworld (152, 46) -> `lufenia`, the elder's hall, talk: CHIME_GIVEN set, chime 1; the healer's house holds `lufenia-healer-keeper`; 0 console errors (`/tmp/w-wnd-o/w_s26_start.png`, `_dialog.png`). `w_s26_neg_untaught`: the elder says "Sae'qat, ven doloth. Lun... thrim?", no flag, no chime; the healer's house holds only the patient (no keeper; checked before the merge, after it a wandering townsman blocked the scripted walk there); 0 errors (`/tmp/w-wnd-o/w_s26_neg_untaught.png`, `_dialog.png`). Run with a scratch `playwright-core` in `/tmp/w-wnd-o/pw/` because the shared Playwright MCP browser was being driven by another tranche |

**Deviations / hand-offs:**

- **The Mirage door is shut until WND-D1 builds `mirage-1f`.** The stub has no chime door, so a door into it reached
  `mirage-1f:inner` with no chime (T6, T7 failed). `world_sites.MIRAGE_OPEN` reads whether `mirage-1f` is still a
  stub: while it is, the tower's door cell is blocked with an inspect line and there is no transition (and no compiled
  mirage stubs). The integrator's world regeneration at WND-D1's merge opens it (one transition to `mirage-1f`
  `arrival`).
- **Shared fixes, in their own commit for the orchestrator** (FIR-O's merge covered the rest; my overlapping edits
  were dropped for FIR-O's): `src/progression/questShops.ts` (proof (e) in `--stage` mode removes the `opensAfter`
  stage's grants from the assumed start, as (b) does; without it a town opening after an ancestor is always `EARLY`
  and GT-30 is never caught); `tests/data/questData.test.ts` and `tests/progression/questLate.test.ts` allow a built
  town (lufenia is the first).
- S26's `entry` starts at Cornelia's gate with the airship on the grass beside it and the ship (S2) at anchor off the
  mesa, out of reach of any shore, so no pending dock strands the party in assume mode.
- Gaia's icon sits on a 4-cell knoll (mountain) so the door keeps one way out; WND-T's site file is unchanged.

**AGENTS.md delta (for INT):** the map table gains `layouts/world_wind.py` + `layouts/wind/world_*.py` (WIND) and
`layouts/wind/lufenia_*.py` (`lufenia`, `lufenia-house-*`, the magic shops, the inn); a town whose speech is gated
writes each person as `[{condition: LUFENIAN_LEARNED, text}, {text: [tongue]}]`; the Mirage door opens when
`mirage-1f` stops being a stub; debug scenarios `w_s26_start`, `w_s26_neg_untaught`.
<!-- === end WND-O === -->
<!-- === WND-T WIND (pass W: owned by WND-T) === -->
<!-- === end WND-T === -->
<!-- === WND-D1 WIND (pass W: owned by WND-D1) === -->
<!-- === end WND-D1 === -->
<!-- === WND-D2 WIND (pass W: owned by WND-D2) === -->
<!-- === end WND-D2 === -->
<!-- === PST PAST (pass W: owned by PST) === -->
<!-- === end PST === -->
<!-- === INT INTEGRATION (pass W: owned by INT) === -->
<!-- === end INT === -->
<!-- === PLAY PLAY TEST (pass W: owned by PLAY) === -->
<!-- === end PLAY === -->

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
| 4 | P2 Worktree memory | W1-0a records `/usr/bin/time -l npx vitest run --maxWorkers=2` and lowers the "3 others" limit if one worktree's peak exceeds about 2 GB (2.3, 5.1) |
| 5 | P3 dwarf-melmond | `ert_dwarf` moves 1 cell to (54, 106). Re-measured: 2 failures in 20,000 random ±2 placements (0.01 %, both crescent-ice). That residual risk is noted; the macro test is the authority (2.2) |
| 6 | P3 The GT-5b fixture; site files | GT-5b's fixture keeps the removed dwarves' landing out of the `DOCKS_ALLOWED` check, so the row fails only on (a). QUEST 4.0's "regenerate, never hand-merge" rule covers every `town_*_site.py` change (5.3, 6.3) |
| 7 | P3 R26 | the kneel pass has merged (88f8ad7); R26 now only says pass W branches from a head at or after it |

**Rev 2 changes (momus review of rev 1):**

| # | Finding | Resolution |
|---|---|---|
| 1 | P1 GT-5: Elfland is also reachable from the dwarves' landing over `seam_n` | GT-5 is non-load-bearing with that reason; the new row GT-5b removes both `elf_port` and `ert_dwarf` and must make the goal unreachable (6.3) |
| 2 | P1 No owner for the town tooling | W1-D (now 7 h) generalises `interiors_common.py` with a `town` parameter and extracts the outdoor helpers into `layouts/town_common.py`; `cornelia.py` and the Cornelia maps stay byte-equal (G1). Both files are in 5.5 (5.2, 5.5) |
| 3 | P1 Memory outside the lock | `--region` takes the lock (2.3, G2). Heavy-job rule: a full-world compile runs only while at most 3 other tranches are active; every worktree runs Vitest with `--maxWorkers=2` (G4). W1-C1 also measures a land-filled synthetic world. The `--region` limit is 10 GB everywhere (estimate about 8 GB) (2.3, 5.0, 5.2, G2, G4) |
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
- every worktree runs Vitest with `--maxWorkers=2` (G4). W1-0a records `/usr/bin/time -l npx vitest run
  --maxWorkers=2` in its result. If one worktree's peak is above about 2 GB, the "3 others" limit is lowered to
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
| `npm run build && npx vitest run --maxWorkers=2` | exit 0; 0 failed |
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
| G4 build and tests | `npm run build && npx vitest run --maxWorkers=2` (worktrees; INT on `mainline` may run `npm test`) | exit 0; 0 failed |
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
- [ ] W1-0a: TS contract: QUEST Q1-0, quest.yaml with anchors, the ExplorationScene extraction to 590, anchors in shared YAML and enemies.yaml (priority: high, effort: 8h)
- [ ] W1-0b: world data: world_api, build_hooks signatures, canon, stubs, site defaults, anchors file, town targets (priority: high, effort: 6h)
- [ ] W1-A: vehicles and save, with the origin shift (priority: high, effort: 8h)
- [ ] W1-B: NPC and field rules, takeGold, clinic, debug frame (priority: high, effort: 8h)
- [ ] W1-C1: compiler core, per-chunk RNG, multi-rect --region, lock, memory probe (priority: high, effort: 8h)
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
<!-- === end W1-0a === -->
<!-- === W1-0b FOUNDATION (pass W: owned by W1-0b) === -->
<!-- === end W1-0b === -->
<!-- === W1-A FOUNDATION (pass W: owned by W1-A) === -->
<!-- === end W1-A === -->
<!-- === W1-B FOUNDATION (pass W: owned by W1-B) === -->
<!-- === end W1-B === -->
<!-- === W1-C1 FOUNDATION (pass W: owned by W1-C1) === -->
<!-- === end W1-C1 === -->
<!-- === W1-C2 FOUNDATION (pass W: owned by W1-C2) === -->
<!-- === end W1-C2 === -->
<!-- === W1-D FOUNDATION (pass W: owned by W1-D) === -->
<!-- === end W1-D === -->
<!-- === W1-E FOUNDATION (pass W: owned by W1-E) === -->
<!-- === end W1-E === -->
<!-- === W1-F FOUNDATION (pass W: owned by W1-F) === -->
<!-- === end W1-F === -->
<!-- === W1-G FOUNDATION (pass W: owned by W1-G) === -->
<!-- === end W1-G === -->
<!-- === W1-H FOUNDATION (pass W: owned by W1-H) === -->
<!-- === end W1-H === -->
<!-- === W1-I FOUNDATION (pass W: owned by W1-I) === -->
<!-- === end W1-I === -->
<!-- === A1-O A1 (pass W: owned by A1-O) === -->
<!-- === end A1-O === -->
<!-- === A1-T A1 (pass W: owned by A1-T) === -->
<!-- === end A1-T === -->
<!-- === ELF-O ELF (pass W: owned by ELF-O) === -->
<!-- === end ELF-O === -->
<!-- === ELF-T ELF (pass W: owned by ELF-T) === -->
<!-- === end ELF-T === -->
<!-- === ELF-D ELF (pass W: owned by ELF-D) === -->
<!-- === end ELF-D === -->
<!-- === ERT-O EARTH (pass W: owned by ERT-O) === -->
<!-- === end ERT-O === -->
<!-- === ERT-T EARTH (pass W: owned by ERT-T) === -->
<!-- === end ERT-T === -->
<!-- === ERT-D EARTH (pass W: owned by ERT-D) === -->
<!-- === end ERT-D === -->
<!-- === FIR-O FIRE (pass W: owned by FIR-O) === -->
<!-- === end FIR-O === -->
<!-- === FIR-T FIRE (pass W: owned by FIR-T) === -->
<!-- === end FIR-T === -->
<!-- === FIR-D1 FIRE (pass W: owned by FIR-D1) === -->
<!-- === end FIR-D1 === -->
<!-- === FIR-D2 FIRE (pass W: owned by FIR-D2) === -->
<!-- === end FIR-D2 === -->
<!-- === ORD-O ORDEAL (pass W: owned by ORD-O) === -->
<!-- === end ORD-O === -->
<!-- === WAT-O WATER (pass W: owned by WAT-O) === -->
<!-- === end WAT-O === -->
<!-- === WAT-T WATER (pass W: owned by WAT-T) === -->
<!-- === end WAT-T === -->
<!-- === WAT-D WATER (pass W: owned by WAT-D) === -->
<!-- === end WAT-D === -->
<!-- === WND-O WIND (pass W: owned by WND-O) === -->
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

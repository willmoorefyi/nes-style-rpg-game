# Main quest build-out plan (pass Q), rev 3

Status: rev 3. It answers the second momus review (rev 2 was rejected by a narrow margin), on top of the rev 2
answers to the first review. The user accepted the defaults of open questions 1-5.
Nothing is implemented. Pass Q starts only after the kneel pass (`docs/KNEEL_PLAN.md`) has merged into `mainline`
and `npm test` is green at that head. Every Q branch is created from, or rebased on, that merge (4.0). Q1-0 is the
first step. Facts in section 1 were checked at `b236b79`.

Naming: engine gaps are **GAP-n** (1.8) and tranche gates are **Gn** (section 7). The review's "gaps G11-G13" are
GAP-11 to GAP-13.

**Rev 3 changes (momus review of rev 2):**

| # | Finding | Resolution |
|---|---|---|
| 1 | P1 The fieldRules contract | `fieldStep`, `transitionOpen` and `dueEncounter` are declared too. Q1-0 implements today's act-1 behaviour with no throwing stubs and moves `ExplorationScene` onto it; Q1a only extends it. Q1d therefore runs on real rules in W1 (4.1, 4.2) |
| 2 | P1 Region G5 | G5 for Q2-Q8 is `npm run quest -- --mutate --stage <S>` for each of the tranche's stages. The 2.1 consumption rule also applies to assumed grants. In `--stage` mode, proof (b) removes each assumed grant from the start state in turn (5.1, 5.2, G5) |
| 3 | P1 Originality metric | The floor-count / boss-floor item is dropped, so the classic floor counts may stay. Originality is judged by layout topology: the stair graph, the branch count, the boss-room position, the floor shape, and the design note. The compass item is information only (4.6) |
| 4 | P1 Basins | Membership is computed with every patch on. A new check: FIRE's inner water joins EARTH's only when `strait_thaw` is on. Q1-0 pre-seeds both seeds, `outer` in S2 and `inner` in S10 (3.5, 4.1) |
| 5 | P2 The lock | Only the top-level CLI takes it. `--check-determinism` children skip it through `FFG_WORLD_LOCK_HELD=1`. The wait times out after 30 min, fails loudly and exits 3 (3.5) |
| 6 | P2 `--region` values for the other boxes | `collide: alpha` footprints, `art_coverage` and the `above` nulls outside the rasterised set are copied from the existing compiled `overworld.yaml`, and the job fails if they are stale. The selftest compares the region YAML with the full-compile YAML (3.5, 4.3) |
| 7 | P2 Opening patches in mutation | An opening patch (`canal`, `strait_thaw`, `wnd_calm`, `north_bridge`) is mutated by forcing it on from the start. Proof (e) must fail for `strait_thaw` and for `wnd_calm` when each is forced on (5.4) |
| 8 | P2 An 8 h session | W1 starts with the work that decides the risks: Q1-0, then Q1b's locality selftest and memory probe. At the end of the session every W1 tranche commits its work in progress with a result draft. The tonight scope is narrowed and stated (4.0a) |
| 9 | P2 Q1a's browser fixture | `assets/maps/test-dock.yaml`, a docked variant of `test-overworld.yaml`, plus the scenario `q1a_ship_dock` (4.2) |
| 10 | P3 Small items | Q1b is exempt from G3 (its locality selftest and `frozenCore` cover it). Q1d lists the act-1 bridge gates in S0's `nonLoadBearing`, and Q2 removes them. R8 now names `fieldRules.ts` (4.3, 4.5, 4.7, G3, R8) |

**Rev 2 changes (momus review of rev 1):**

| # | Finding | Resolution |
|---|---|---|
| 1 | P0 One RNG sequence across the whole map, so one edit changes every chunk | Q1b seeds every RNG per chunk from the map id and the chunk's column and row (`build_map.py:303-311, :627`, `terrain/peaks.py`, `terrain/outline.py`). A `--selftest` locality case edits box X and checks byte-equality outside X's chunks; it is a Q1b done-when. Every act-1 chunk changes once, in Q1b, which is accepted (3.5, 3.6, 4.3) |
| 2 | P1 Memory (3.08 GB measured for 72x72; the world would need about 21-25 GB) | Measured figures are in 3.6. A world-compile lock (`/tmp/ff-game-world-compile.lock`, `fcntl.flock`) serialises compiles across worktrees. `build_map.py overworld --region <r>` compiles only the owned chunks plus a 1-chunk ring (about 7 GB). Full-world compiles are for Q1b and the integrator only (3.5, 4.3, G2) |
| 3 | P1 Per-region checks | `RegionOut.checks` (`road_check`, `river_check`, `unreachable_ok`, `min_blob`, `warp_leaves`) runs per region on the box. Q1b proves it on 2 stub regions, each with roads (3.5, 4.3) |
| 4 | P1 Shared field semantics | Q1-0 declares `src/systems/fieldRules.ts` (`canEnter`, `canLand`, `dockFor`, `npcOutcome`, `patchedTerrain`). Q1a implements it, and `ExplorationScene` calls it. Q1d imports only it. Static NPC cells block movement in the model (4.1, 5.1) |
| 5 | P1 Assume-mode start state | Each stage has an `entry` `{map, x, y, mode, vehicles}`. A synthetic grant fires only once its `requires` hold (2.4, 5.1) |
| 6 | P1 Missing gaps | GAP-11 is a mode-aware `safeSpawn`, GAP-12 a `BattleRetrySnapshot` with mode and vehicles, GAP-13 a cutscene step `end_game`. Q1-0 declares them and Q1a owns them (1.8, 4.1, 4.2) |
| 7 | P1 Act-1 tests | Q1b clips `overworldLayout.test.ts` to the 72x72 rect and the ship test to the map's ship spawn. Q1-0 updates `crossFileValidation.test.ts:339`. New ownership row: act-1 tests outside these cases are frozen after Q1 (4.0) |
| 8 | P1 Dev ports, node_modules | Every tranche has its own port (`--host 127.0.0.1 --port 52nn --strictPort`, `mute=1`), and each worktree runs `npm ci` (4.0, 5.6) |
| 9 | P2 Streaming details | The cap comes from the worst case: 60 textures. A miss holds movement for at most 6 frames and then shows a placeholder. Unloading uses `Assets.unload`. Q1b draws the patch overlays and owns `MapLoader.ts` (4.3) |
| 10 | P2 G3 | G3 diffs against `git merge-base mainline HEAD`. `--owned-chunks` prints repo-relative paths, including the region's `patch_*.png` (3.5, G3) |
| 11 | P2 Unattended originality | Each map has a 3-line design note, each tranche a measurable self-check list, a forbidden-phrase test runs over the dialogue, and a reviewer signs off every tranche (4.6, G12) |
| 12 | P2 Early access | New proof (e): a shop town is first reachable only after its stage's `after` set is done. Two new gates enforce it: the J2 ice floe (EARTH_CRYSTAL_LIT) and the WIND landing field (WATER_CRYSTAL_LIT) (3.2, 5.2) |
| 13 | P2 Under-specified content | The `breath_pearl` chain is specified (4.11). The Mirage cutscene is `mirage_ascent` (4.12). "Frozen act-1 core" is defined, and Pravoka and Matoya have fixed rects (3.2, 4.7) |
| 14 | P2 The `types/index.ts` cost | The real changes are listed (about +20 lines, new ceiling 440), and `ExplorationScene.ts` 590 is added to `fileCeilings.test.ts` (4.1) |
| 15 | P2 Hot-spots | `nonLoadBearing` and `basins` are per stage. Q2 may edit `BRIDGE_WORKERS` and `GATE_MESSAGE`; `castle.py` (360 / 360) is not edited. The `build_assets.py` stage lands after the kneel merge, on a rebased branch (2.4, 4.0, 4.7) |
| 16 | P2 A schedule of 169 h and 51 h critical path | Waves, checkpoints, a resume rule, stop conditions, and a "tonight" scope: W0 plus W1, then Q2 if it fits (4.0a) |
| 17 | P2 Done-when commands; G9 | Q1a and Q1b each have a done-when with commands and expected output. G9 adds `scripts/check-bounds.ts` (4.2, 4.3, G9) |
| 18 | P3 Small items | The 20 enemy spell ids are kept exactly (4.4). The field spell ids `exit` and `warp` are fixed (4.1). A mutation accepts any proof failure (5.4). The curve uses the mode multipliers (5.2). `scripts/quest-verify.ts` goes into the tsconfig include (4.5). The 9 music tracks are reused, and the legacy maps are act-1 only (3.1) |

## 0. Summary

The quest is built out from the end of act 1 (Garland, the lute, the broken north bridge) to Chaos, as a
**reimagined** classic four-fiend RPG. It keeps the original order of acts:

- the early regions: the pirate port, the elf kingdom, the marsh cave, Astos's keep and the dwarf canal;
- four elemental fiends: earth, fire, water and wind;
- the temple of the past.

It also keeps the key-item and vehicle gates (ship, canoe, airship), the level and gear bands, and the existing
enemy roster. Geography, layouts, dialogue and event staging are original.

- **One world map** (`overworld`, 240x176) is built by a composer, `layouts/world.py`, from six region modules. Each
  module fills its own box, and every box is aligned to the 16-cell chunk grid. The act-1 72x72 block stays at
  (0, 0) and is unchanged, so every act-1 coordinate and test still holds. The renderer streams chunks.
- **Foundation first (Q1, five steps, four of them in parallel).** These add:
  - vehicles that dock and park, and the canoe as an ability;
  - flag patches that change terrain (the rebuilt bridge, the canal);
  - NPC trades;
  - map-toolchain additions;
  - the item and spell canon;
  - a deterministic **progression-gap verifier**.
- **Seven region tranches (Q2-Q8)** then run in parallel, one agent and one worktree each. Each owns its region
  module, its maps and one anchored section of each shared YAML file.
- **Q9** integrates the tranches and tunes the level curve. **Q10** is the adversarial play test and its fix round.
- **No paid images.** Pass Q uses the approved kits, recolours, code-drawn placeholders, tinted NPC sprites and
  battle backgrounds already staged locally.

### 0.1 Success criteria (defined before implementation)

```json
{
  "functional": [
    "A new game can reach CHAOS_DEFEATED through every stage of section 2 in DAG order",
    "No stage's boss, key item or grant is reachable before its prerequisites",
    "No reachable game state is soft-locked (the goal stays reachable from every reachable state)",
    "Ship, canoe and airship work as section 3.3 specifies, and their positions survive save and load",
    "Act 1 plays as before, except that the King's scene now rebuilds the north bridge"
  ],
  "observable": [
    "`npm run quest -- --strict --mutate` prints `quest-verify: OK`, with each proof (a)-(e) OK",
    "The verifier reports the expected level at every boss, and each one is inside that stage's band",
    "Every enemy without `formOf` appears in an encounter table or a scripted encounter",
    "Every boss in section 6.2 has a seeded balance test whose bounds sit 3 points from the measured value",
    "The browser checkpoints of section 5.6 pass, with `mute=1` on every URL"
  ],
  "pass_fail": [
    "npm run build exits 0",
    "npm test reports 0 failed",
    "build_map.py --check-determinism prints `<id>: deterministic` for every map",
    "Re-running every layout script leaves `git diff --exit-code assets-src/maps` clean",
    "Removing any load-bearing gate makes the verifier report a skip (mutation run)",
    "The file-size ceiling tests pass"
  ]
}
```

## 1. Current state (verified at b236b79)

### 1.1 Maps

- **There are 23 compiled maps** (`assets/maps/ai/index.yaml`):
  - Cornelia (`layouts/cornelia.py`);
  - the castle, with 4 maps: 1F, 2F, tower and cellar (`layouts/castle.py`, 360 / 360 lines);
  - 10 houses and 6 shops / inn (`layouts/interiors.py`);
  - `overworld`;
  - `temple-of-fiends`, which is hand-written (`assets-src/maps/temple-of-fiends.yaml`, 24x22).
- **The act-1 overworld** (`layouts/overworld.py`, 249 lines; data in `overworld_consts.py`, `overworld_zones.py`):
  - its size is 72x72 (`overworld_consts.py:6`, `W, H = 72, 56 + DY`);
  - the north bridge is broken: open water between the stubs (`overworld_consts.py:18`), and the debris is art only
    (`overworld_consts.py:135-141`);
  - the mainland north shore is listed as `unreachable_ok` (`overworld.py:212`).
- **Measured cost:** the overworld compiles in 10.5 s (scratch copy, this machine). Its 25 chunks take 4.1 MB, and
  Cornelia's 39 chunk files take 2.4 MB.
- **The renderer loads every chunk of a map before showing it** (`src/rendering/BakedMapRenderer.ts:12-21`).

### 1.2 Story flags

- `STORY_FLAGS` (`src/core/GameFlags.ts:18-29`): GARLAND_DEFEATED, PRINCESS_RESCUED, INTRO_COMPLETE, BRIDGE_BUILT,
  BIKKE_DEFEATED, EARTH_CAVE_COMPLETE, EARTH_CRYSTAL_LIT, FIRE / WATER / WIND_CRYSTAL_LIT.
- Act 1 sets only these: GARLAND_DEFEATED, PRINCESS_RESCUED (`cutscenes.yaml:40` `garland_defeated`), INTRO_COMPLETE
  (`cutscenes.yaml:64` `act1_complete`), GOT_LUTE (`castle.py:270-274`, the princess's gift) and the `CHEST_*` flags.
- `BRIDGE_BUILT` is never set.

### 1.3 Gates

- **The north bridge:** two `keyItemGates` on the south stub with `requiredFlag: BRIDGE_BUILT` (`overworld.py:221`).
  Their message changes once INTRO_COMPLETE is set.
- **The gate logic** (`src/systems/KeyItemGateSystem.ts:34-55`):
  - a gate takes one `requiredFlag` and/or one `requiredItem`;
  - a `permanent` gate sets its `flag` when it opens;
  - a gate can only block a cell, never open one, so water can't become a bridge.
- `ScriptedEncounter.requiredFlag`, `MapTransition.requiredFlag` and `VehicleSpawn.requiredFlag` take one flag each
  (`src/types/index.ts:252, 288, 371`).

### 1.4 Vehicles: present but incomplete

- **Spawns:** `overworld.py:232-233` puts the ship off the Cornelia jetty (BIKKE_DEFEATED) and the canoe on the east
  river (EARTH_CAVE_COMPLETE).
- **Boarding only:** the player boards by pressing confirm while standing on the vehicle's cell
  (`ExplorationScene.ts:362-368`). That cell is water, which the player cannot walk onto. There is no way to
  disembark, no dock rule, no vehicle sprite and no parked position, and the save holds no vehicle state
  (`types/index.ts:407`).
- **Map changes:** a transition resets the mode to walking (`exploration/FieldTransition.ts:68`).
- **Modes:**
  - the canoe may enter ocean (`CanoeMode.ts:8`: River or Water), because lakes and ocean both compile to Water
    (`build_map.py` `TERRAIN`);
  - the ship has no encounters (`ShipMode.ts:16-17`);
  - the airship lands on grass only (`AirshipMode.ts`).
- **Class upgrade:** it needs EARTH_CRYSTAL_LIT (`ClassUpgradeSystem.ts:21`), and no map has a class-upgrade NPC.

### 1.5 Items, spells and shops

- **`items.yaml`:** 18 weapons, 15 armour pieces, 8 consumables and only 2 key items, `lute` (:484) and
  `mystic_key` (:491).
- **`spells.yaml`:** 34 spells, levels 1-4 complete; level 5 has only `cure3` and `life`. Enemy spell lists use ids
  that are not in `spells.yaml` (for example Chaos's `ice3`, `nuke`).
- **`shops.yaml`:**
  - Cornelia's shops (:4-37) are the only ones used;
  - the Elfheim (:43-77) and Melmond (:82-116) shops exist but no map uses them, and `tests/scenes/MagicShopScene.test.ts`
    references them, so their ids stay.

### 1.6 Encounters

- **The overworld** (`overworld_zones.py:14-28`) has the default `FIELDS` table plus the `temple_approach` and
  `east_pocket` zones. The temple has its own table (`temple-of-fiends.yaml:232`).
- **Bestiary:** `bestiary.yaml:7-8` lists the scanned maps and the zone labels by hand.
- **The roster:** `enemies.yaml` holds 130 records: 127 numbered (1-128 without 51) plus the 3 Chaos form records.
  - Every record has approved art, and the fiends already have original names: Rime Sovereign (`lich`), Ashen Queen,
    Drowned Sovereign, Hollow Seraph, plus their `_2` rematch records.
  - Existing data already fixes some place names: Pravoka, Elfheim, Melmond, Crescent Lake, Onrac, Gaia, Matoya, the
    Elf Prince, the Western Keep, the Marsh Cave, the Cavern of Earth and the "sky fortress" (`enemies.yaml` and the
    `bestiary.yaml` lore).

### 1.7 Level band at the act-1 boss and at Chaos

- **Garland:** a sensible Lv2 party with the lv2 kit wins 55-75 %, and Lv3 wins at least 85 %
  (`tests/balance/garland.test.ts:78, 86`). So the act-1 band is **Lv 2-3**.
- **Chaos** is tuned for **level 40** (`tests/balance/chaos.test.ts:21`, user ruling U-2). At level 35 it wins only
  32.5 % (`docs/CHAOS_FIX_PLAN.md:656`).

### 1.8 Engine gaps pass Q must close

| Gap | Where | Closed by |
|---|---|---|
| GAP-1 No disembark, docks, parking, vehicle sprites or save state | 1.4 | Q1a |
| GAP-2 No terrain change on a flag (bridge, canal) | 1.3 | Q1-0 types, Q1a runtime, Q1b compiler and overlays |
| GAP-3 No AND of flags; no item conditions; no NPC trade; cutscenes can't give or take items | `types/index.ts:193-250`, `cutscenes.yaml:1-6` | Q1-0, Q1a |
| GAP-4 Canoe vs ocean vs lake are not told apart | 1.4 | Q1-0 (`TerrainType.Lake = 11`), Q1b, Q1a |
| GAP-5 A big world loads every chunk | 1.1 | Q1b streaming |
| GAP-6 No sea or river encounters | `ShipMode.ts:17` | Q1a (zone `modes`) |
| GAP-7 Spells L5-L8 and late gear are missing | 1.5 | Q1c |
| GAP-8 Class upgrade is tied to EARTH_CRYSTAL_LIT | 1.4 | Q1a (data-driven `actionFlag`) |
| GAP-9 `ExplorationScene.ts` is at its 601 / 601 ceiling; `types/index.ts` (419) and `schemaValidation.ts` (378) are over 250 | AGENTS.md | Q1-0 / Q1a extract first |
| GAP-10 Asset coverage reads only the legacy maps' NPC sprites | `tests/data/assetCoverage.test.ts:56-59` | Q1a |
| GAP-11 `safeSpawn` checks walkability on foot only, so a save made on a ship or a landed airship would be moved to the first entrance | `MapTransition.ts:51-70` | Q1a (mode-aware: a parked vehicle's cell, or the current mode) |
| GAP-12 `BattleRetrySnapshot` has no mode or vehicles, so a retry after a sea battle would strand the party | `BattleRetry.ts:25-30` | Q1a (adds `mode` and `vehicles`) |
| GAP-13 No cutscene step ends the game | `cutscenes.yaml:1-6` | Q1a (`end_game`: shows the end card, then the title; no save) |
| GAP-14 RNG drawn in one sequence across the whole map | `build_map.py:303-311, :627`, `terrain/peaks.py:142-208`, `terrain/outline.py:168-184` | Q1b (per-chunk seeds) |

## 2. Progression graph

### 2.1 Canon: key items, vehicles and milestone flags

These ids are fixed by this plan, and Q1-0 and Q1c create them. Display names are original unless existing data
fixes them; Q1c picks them.

| Key item id | Obtained (stage, tranche) | Used by | Consumed |
|---|---|---|---|
| `lute` (exists) | S0, the princess | the time gate (S25) | no |
| `crown` | S5 Marsh Cave, Q3 | the false king in the Western Keep (S6) | yes |
| `crystal_eye` | S6 Astos, Q3 | Matoya (S7, Q2) | yes |
| `herb` | S7 Matoya, Q2 | the Elf Prince (S8, Q3) | yes |
| `mystic_key` (exists) | S8 Elf Prince, Q3 | vault doors (S9) | no |
| `tnt` | S9 Elfheim vault, Q3 | the dwarf foreman (S10, Q4) | yes |
| `ruby` | S11 Vampire, Q4 | the giant (S12) | yes |
| `rod` | S12 the sage, Q4 | the earth seal (S13) | no |
| `canoe` | S14 the sages of Crescent Lake, Q5 | rivers and lakes (an ability) | no |
| `sky_stone` | S16 ice cavern, Q5 | the buried airship (S17) | yes |
| `ordeal_seal` | S18 the trial keep, Q6 | the dragon king (S19) | yes |
| `cube` | S20 waterfall grotto, Q6 | the Mirage top (S23, Q7) | no |
| `diver_ring` | S20 waterfall grotto chest, Q6 | the Onrac widow (S20) | yes |
| `breath_pearl` | S20 the Onrac widow, Q6 | the Sea Shrine dive (S21) | no |
| `tide_tablet` | S21 Sea Shrine, Q6 | the sky-folk translator (S22, Q7) | yes |
| `chime` | S22 the sky-folk village, Q7 | the Mirage door (S23) | no |

**Vehicles:**

- `ship`: spawns at the Pravoka dock once BIKKE_DEFEATED is set;
- `airship`: spawns in the FIRE desert once AIRSHIP_RAISED is set;
- the canoe is the `canoe` item: walking onto River or Lake switches the party to `CanoeMode`.

**Milestone flags** (Q1-0 adds them to `STORY_FLAGS`; only the tranche that owns a stage sets that stage's flags):

- BRIDGE_BUILT, BIKKE_DEFEATED;
- MARSH_GUARD_DEFEATED, ASTOS_DEFEATED, PRINCE_AWAKE;
- CANAL_OPEN, VAMPIRE_DEFEATED, TITAN_FED, EARTH_SEAL_BROKEN, EARTH_CAVE_COMPLETE (the Rime Sovereign is
  defeated), EARTH_CRYSTAL_LIT;
- CANOE_GIVEN, FIRE_CRYSTAL_LIT, EVIL_EYE_DEFEATED, AIRSHIP_RAISED;
- ORDEALS_GUARD_DEFEATED, CLASS_UPGRADED, WATER_CRYSTAL_LIT;
- SKY_FORTRESS_OPEN, WIND_CRYSTAL_LIT;
- TIME_GATE_OPEN, PAST_LICH_DEFEATED, PAST_ASHEN_DEFEATED, PAST_DROWNED_DEFEATED, PAST_SERAPH_DEFEATED,
  DEATH_EYE_DEFEATED, CHAOS_DEFEATED.

**Local flags** use the tranche's prefix: `A1_`, `ELF_`, `ERT_`, `FIR_`, `WAT_`, `WND_`, `PST_`, and
`CHEST_<prefix>_...` for chests. `tests/progression/questFlags.test.ts` (Q1d) checks two rules:

- a map of tranche T sets only T's prefix and the milestone flags of T's stages;
- no local flag equals a milestone flag.

### 2.2 Stages (the DAG)

"Band" is the whole-party level band (the lowest member) at the stage's boss, or at its end when it has no boss.
Rosters use existing enemy ids.

| Id | Stage | Tranche | After | Requires | Grants | Band | Boss | Encounter roster |
|---|---|---|---|---|---|---|---|---|
| S0 | Act 1 (built) | - | - | - | GARLAND_DEFEATED, PRINCESS_RESCUED, `lute`, INTRO_COMPLETE | 2-3 | garland | goblin, gr_imp, wolf, gr_wolf, skeleton |
| S1 | The north bridge | Q2 | S0 | INTRO_COMPLETE | BRIDGE_BUILT | 2-3 | - | - |
| S2 | Pravoka and the pirates | Q2 | S1 | BRIDGE_BUILT | BIKKE_DEFEATED, ship | 3-6 | pirate x9 (scripted, `isBoss`) | crazy_horse, black_widow, gigas_worm, werewolf, zombie, ghoul, gr_wolf |
| S3 | Matoya's cave (visit) | Q2 | S1 | BRIDGE_BUILT | - (S7 needs this place) | 3-6 | - | as S2 |
| S4 | Outer Sea and Elfheim | Q3 | S2 | ship | - | 5-9 | - | land: cobra, ogre, ogre_chief, lizard, tarantula, werewolf; sea: sahagin, sahagin_chief, buccaneer, shark, bigeyes |
| S5 | The Marsh Cave (3 floors) | Q3 | S4 | ship | `crown`, MARSH_GUARD_DEFEATED | 8-11 | piscodemon x3 | ghast, scorpion, shadow, green_slime, crawler, gray_ooze, bloodbones, zombie, ghoul |
| S6 | The Western Keep | Q3 | S5 | `crown` | ASTOS_DEFEATED, `crystal_eye` | 10-13 | astos | gargoyle, bloodbones, ghast, ogre_chief |
| S7 | Matoya's herb | Q2 | S6, S3 | `crystal_eye` | `herb` | 10-13 | - | - |
| S8 | The Elf Prince wakes | Q3 | S7 | `herb` | PRINCE_AWAKE, `mystic_key` | 10-13 | - | - |
| S9 | The Elfheim vault | Q3 | S8 | `mystic_key` | `tnt` | 10-13 | - | - |
| S10 | The dwarf canal | Q4 | S9 | `tnt` | CANAL_OPEN | 11-14 | - | mummy, wraith, anaconda |
| S11 | Melmond, Cavern of Earth B1-B3 | Q4 | S10 | CANAL_OPEN | VAMPIRE_DEFEATED, `ruby` | 13-16 | vampire | land: anaconda, hyenadon, lesser_tiger, troll; cavern: mummy, wraith, minotaur, hill_gigas, troll, wight, ochre_jelly, cockatrice |
| S12 | The giant's tunnel and the sage | Q4 | S11 | `ruby` | TITAN_FED, `rod` | 15-17 | - | ogre_mage, sphinx, earth_elemental |
| S13 | Cavern of Earth B4-B5 | Q4 | S12 | `rod` | EARTH_SEAL_BROKEN, EARTH_CAVE_COMPLETE, EARTH_CRYSTAL_LIT | 16-19 | lich | earth_elemental, hill_gigas, ogre_mage, sphinx, wight |
| S14 | Crescent Lake and the canoe | Q5 | S13 | EARTH_CRYSTAL_LIT (this also opens the J2 floe) | CANOE_GIVEN, `canoe` | 17-20 | - | land: ankheg, ochu, neochu, hydra; river (canoe): red_piranha, crocodile, white_crocodile |
| S15 | The sun temple (5 floors) | Q5 | S14 | `canoe` | FIRE_CRYSTAL_LIT | 21-24 | ashen_queen | horned_devil, pyrolisk, fire_elemental, fire_hydra, lava_worm, hellhound, fire_lizard, fire_gigas, dragon |
| S16 | The ice cavern (3 floors) | Q5 | S14 | `canoe` | EVIL_EYE_DEFEATED, `sky_stone` | 21-24 | evil_eye | white_dragon, winter_wolf, mindflayer, ice_gigas, specter, remorazz, dark_wizard |
| S17 | The airship | Q5 | S16 | `sky_stone` | AIRSHIP_RAISED, airship | 22-25 | - | desert_baretta, sabertooth, wyvern, wyrm, manticore, baretta, basilisk, allosaurus, sand_worm |
| S18 | The trial keep (3 floors) | Q6 | S17 | airship | ORDEALS_GUARD_DEFEATED, `ordeal_seal` | 24-27 | dragon_zombie | weretiger, minotaur_zombie, king_mummy, medusa, rakshasa, clay_golem, nightmare |
| S19 | The dragon king (class change) | Q6 | S18 | `ordeal_seal` | CLASS_UPGRADED | 24-27 | - | - |
| S20 | Onrac and the waterfall | Q6 | S17, S14 | airship, `canoe` | `cube`, `breath_pearl` | 25-28 | - | land: nightmare, weretiger; sea: sahagin_prince, white_shark, deepeyes, sea_snake |
| S21 | The Sea Shrine (5 floors) | Q6 | S20 | `breath_pearl` | WATER_CRYSTAL_LIT, `tide_tablet` | 27-30 | drowned_sovereign | sahagin_prince, deepeyes, sea_snake, sea_scorpion, sea_troll, ghost, water_elemental, water_naga |
| S22 | Gaia and the sky-folk village | Q7 | S17, S21 | airship, WATER_CRYSTAL_LIT (opens the WIND landing field), `tide_tablet` | `chime` | 28-31 | - | tyrannosaur, chimera, green_dragon |
| S23 | The Mirage Tower (3 floors) | Q7 | S22, S20 | `chime`, `cube` | SKY_FORTRESS_OPEN | 29-32 | - | black_knight, chimera, guardian, blue_dragon, green_dragon, stone_golem |
| S24 | The sky fortress (5 floors) | Q7 | S23 | SKY_FORTRESS_OPEN | WIND_CRYSTAL_LIT | 31-34 | hollow_seraph | air_elemental, spirit_naga, death_knight, earth_medusa, black_flan, soldier, vampire_lord, dark_fighter, warmech (rare) |
| S25 | The time gate | Q8 | S13, S15, S21, S24 | the 4 crystal flags, `lute` | TIME_GATE_OPEN | 33-35 | - | - |
| S26 | The temple of the past (5 floors) | Q8 | S25 | TIME_GATE_OPEN | the PAST_* flags, DEATH_EYE_DEFEATED, CHAOS_DEFEATED | 34-41 | lich_2, ashen_queen_2, drowned_sovereign_2, hollow_seraph_2, death_eye, then chaos (40) | rhyos, purple_worm, iron_golem, plus death_knight, blue_dragon, vampire_lord, dark_fighter |

Notes:

- **S15 and S16 run in parallel**, as in the classic (the airship does not need the Fire crystal).
- **S19 is optional for the DAG** (the classic makes the class change optional). The balance tests from S20 on assume
  upgraded classes (Open question 3).
- **Roster coverage:** every enemy without `formOf` appears above. Q9 asserts this as a test.

### 2.3 DAG

```
S0 -> S1 -> S2 -> S4 -> S5 -> S6 -> S7 -> S8 -> S9 -> S10 -> S11 -> S12 -> S13 -> S14 -+-> S15 ------------+
       \-> S3 ---------------------/                                                    +-> S16 -> S17 -+   |
                                                                                                         |   |
   S17 -> S18 -> S19 (optional)                                                                          |   |
   S17 + S14 -> S20 -> S21 -> S22 (with S17) -> S23 (with S20) -> S24 ------------------------------+   |   |
                                                                                                    v   v   v
                                                                         S13 + S15 + S21 + S24 -> S25 -> S26 (goal)
```

### 2.4 `assets/data/quest.yaml`: the declared DAG

This is the verifier's input and the tranches' contract. Q1-0 creates it with every stage at `status: pending`, and
each tranche edits only its own stages.

```yaml
goal: CHAOS_DEFEATED
stages:
  - id: S5
    title: The Marsh Cave
    tranche: Q3
    after: [S4]
    requires: {flags: [], items: [], vehicles: [ship]}
    grants: {flags: [MARSH_GUARD_DEFEATED], items: [crown], vehicles: []}
    boss: [piscodemon]          # enemy ids of the stage's isBoss scripted encounter(s); [] if none
    band: [8, 11]
    kit: q_marsh                # kits.yaml entry the party has at the boss (section 6)
    maps: [marsh-cave-*]        # globs of map ids owned by the stage
    zones: [overworld:elf_marsh_fen]
    grind: 2.0                  # expected-fight multiplier for the curve model, 1.0-3.0 (section 5.2 d)
    walk: [overworld:dock:elf_port, overworld:warp:marsh_cave, marsh-cave-b3:battle:crown_guard, marsh-cave-b3:chest:crown]
    entry: {map: overworld, x: 98, y: 40, mode: ship, vehicles: [{type: ship, map: overworld, x: 98, y: 40}]}
    basins: {}                  # basins this stage declares, as name: seed cell; S2 declares outer, S10 declares inner
    nonLoadBearing: []          # this stage's gates that may be removed without a failure: [{map, kind, at, reason}]
    status: pending             # pending | built
```

`entry` is where the tranche's proofs start in assume mode (5.1). The coordinates above are only an example; each
tranche sets its own. Each stage edits only its own `basins` and `nonLoadBearing`, so the file has no shared hot
spot.

## 3. World map design

### 3.1 Decision: one world map, streamed, composed from region modules

| Option | Pro | Con |
|---|---|---|
| **A. One 240x176 map, composed (chosen)** | One sea, so ship and airship routes are continuous. The verifier has one world graph. Act-1 coordinates are kept | Needs chunk streaming (G5). The generated files are shared, so they are regenerated on every merge |
| B. A map per continent, linked by sea-edge warps | No streaming; no shared generated files | Vehicles must cross map edges (new engine work), the world feels cut into pieces, and edge warps are a new source of skips |

With A, agents still work independently. Each one edits only `layouts/world_<region>.py` and its own helpers, and its
box is aligned to the 16-cell chunk grid. Once Q1b seeds the RNGs per chunk (GAP-14), a box's art changes touch
only its own chunk files, and gate G3 checks that.

**Music and legacy art:**

- Pass Q reuses the 9 existing music tracks (`audio-manifest.json`): `overworld`, `town`, `shop`, `dungeon`,
  `battle`, `boss`, `victory`, `gameover`, `title`. It adds none.
- The legacy `assets/maps/overworld.yaml` and `?art=legacy` stay act-1 only (72x72). New maps exist only compiled.
  This follows the `mapVariants.test.ts` rule that maps new in 2x are linked only from compiled maps.

### 3.2 Boxes (cells, inclusive) and geography (original)

| Region | Tranche | x | y | Chunks (col, row) | Content |
|---|---|---|---|---|---|
| A1 Cornelia and the Pravoka coast | Q2 (act-1 core frozen) | 0-79 | 0-79 | c0-4, r0-4 | The act-1 72x72 block at (0, 0) unchanged, plus Pravoka and Matoya on the act-1 mainland |
| ELF The Elfheim reach | Q3 | 80-159 | 0-79 | c5-9, r0-4 | Elfheim and its castle, the Marsh Cave fen, the Western Keep |
| WIND The high north-east | Q7 | 160-239 | 0-79 | c10-14, r0-4 | Gaia, the sky-folk plateau, the Mirage desert and tower, the sky fortress's anchor |
| WATER The south-west isles | Q6 | 0-79 | 80-175 | c0-4, r5-10 | The trial-keep isle, the dragon-king isle, Onrac and its waterfall, the Sea Shrine dive |
| EARTH The gulf lands | Q4 | 80-159 | 80-175 | c5-9, r5-10 | The dwarf mine on the north rim, the canal, the Inner Sea, Melmond, the Cavern of Earth, the giant's tunnel, the sage |
| FIRE The burning south-east | Q5 | 160-239 | 80-175 | c10-14, r5-10 | Crescent Lake, the rivers, the sun temple, the ice cavern, the airship desert |

**Shared rules for every box:**

- **Ocean ring:** cells within 2 of the box edge are ocean. The rings together form the **Outer Sea**, a channel
  4 cells wide between boxes.
- **J1, the canal (EARTH):** a land strip on EARTH's north rim separates the ring from the Inner Sea. The patch
  `canal` (flag CANAL_OPEN) turns the strip's cells to ocean, and nothing else links the two seas.
- **J2, the Inner strait (EARTH and FIRE):** cells x 156-163, y 120-123 are Inner Sea water. The composer fills
  x 156-163, y 116-119 and y 124-127 with mountain, cutting both rings there. EARTH's Inner Sea must reach x 155 and
  FIRE's must reach x 164 on rows 120-123.
- **The J2 ice floe (early-access gate):** the Rime Sovereign's frost chokes the strait. Cells x 159-160,
  y 120-123 are mountain, drawn as ice by the art. The composer-owned patch `strait_thaw` (flag EARTH_CRYSTAL_LIT)
  turns them to ocean. So FIRE, and its B5 shops, can be reached only after S13.
- **Airship-only land:** WATER and WIND have no docks. Their places sit on grass that a ring of mountains or forest
  seals from every coast.
- **The WIND landing field (early-access gate):** WIND has no grass at all until the patch `wnd_calm` (flag
  WATER_CRYSTAL_LIT) turns its storm-scoured sand fields to grass. Until then the airship can't land there, so
  Gaia's B7 shops wait for S21. The lore line is that the seas calm when the water crystal is lit.

**The frozen act-1 core.** Inside x 0-71, y 0-71, after Q1:

- every `ground` cell stays byte-equal, and no act-1 object, NPC, gate, transition or inspect cell is removed or
  moved;
- there are three exceptions:
  1. Q2 may change ground and add objects only inside two rects: Pravoka at x 54-66, y 5-13 (the NE coast of the
     mainland; the `outer` dock goes on its east side) and Matoya at x 6-14, y 8-16 (the NW mainland forest);
  2. patches are overlays and don't change ground;
  3. the ship spawn moves (Q2) and the canoe spawn is removed (Q1b).
- `tests/quest/a1/frozenCore.test.ts` (Q1b) compares the core's `ground` and object lists with a fixture taken at
  Q1b, minus the two rects.

### 3.3 Vehicles, docks, landing, basins

- **Docks** (`MapData.docks: [{x, y, basin}]`) are ocean cells beside a walkable cell, usually the tip of a jetty.
  - The ship can disembark only from a dock, onto the adjacent land cell, and it stays parked on the dock.
  - Walking from land onto the parked ship boards it.
  - The allowed docks are: `outer` in A1 (Pravoka; optionally the Cornelia jetty), ELF (Elfheim port) and EARTH (the
    dwarf mine); `inner` in EARTH (Melmond) and FIRE (Crescent Lake). Any other dock fails the verifier.
- **The ship** sails Water cells only (not Lake or River). With `modes: [ship]` sea zones it has encounters
  (`ShipMode` multiplier 1).
- **The canoe** is an ability. With the `canoe` item, walking onto River or Lake switches to `CanoeMode` (River and
  Lake only), and stepping onto land switches back. There is no spawn, and the act-1 canoe spawn
  (`overworld.py:233`) is removed in Q1b.
- **The airship** flies anywhere and has no encounters. Pressing confirm on the parked airship takes off; pressing
  confirm over a grass cell lands it, if that cell is not a transition, gate or NPC cell. Otherwise it says
  "The airship can't land here." Transitions are ignored while flying.
- **Saving:** SaveData v2 stores `vehicles: [{type, map, x, y}]` and `mode`. A v1 save loads with no vehicles.

### 3.4 Encounter zones per area

- `EncounterZone.modes` is `walking`, `canoe` or `ship`; the default is `[walking, canoe]`.
- `EncounterZone.name` is the bestiary habitat label, which replaces `bestiary.yaml` `habitats.zones`.
- Zone ids carry the region prefix (`elf_`, `ert_`, ...). The first zone that holds the cell wins, as today.
- Every walkable cell outside A1's act-1 block lies in at least one walking zone of its region.
- Every ocean cell lies in exactly one ship zone (Q1d test).

| Region | Walking zones (by stage) | Ship zones | Canoe zones |
|---|---|---|---|
| A1 | `a1_pravoka_coast` (S2 roster) north of the bridge; the act-1 zones unchanged | `a1_sea` (S4 sea roster) | - |
| ELF | `elf_fields` (S4), `elf_fen` (S5 outer), `elf_keep_moor` (S6) | `elf_sea` (S4 sea) | - |
| EARTH | `ert_rim` (S10), `ert_plain` (S11), `ert_badlands` (S12-13) | `ert_outer` (S4 sea), `ert_inner` (sahagin_chief, shark, buccaneer, bigeyes) | - |
| FIRE | `fir_lakeshore` (S14), `fir_ashlands` (S15 outer), `fir_tundra` (S16 outer), `fir_desert` (S17) | `fir_outer` (S4 sea), `fir_inner` (as `ert_inner`) | `fir_rivers` (S14 river roster) |
| WATER | `wat_isles` (S18, S20 land) | `wat_sea` (S20 sea) | `wat_streams` (red_piranha, crocodile) |
| WIND | `wnd_steppe` (S22), `wnd_mirage_sands` (S23) | `wnd_sea` (S20 sea) | - |

A ship can reach the WATER and WIND seas early and meet late-tier monsters there. It cannot land there, so this is a
danger, not a skip (risk R5).

### 3.5 Composer and module contract

- **`layouts/world_api.py`** (Q1b) holds:
  - `BOXES`, `J1` and `J2`;
  - `Region(id, prefix, box)`;
  - `RegionOut`: the `ground` rows (box w x h, legend chars), `objects`, `npcs`, `inspect`, `transitions`,
    `entrances` (names `<prefix>_<place>`), `keyItemGates`, `patches`, `docks`, `hazards`, `encounterZones`,
    `vehicles`, `battleBackgrounds.zones` and `notes`;
  - `checks`: the region's own map-check options (`road_check`, `river_check`, `unreachable_ok`, `min_blob`,
    `warp_leaves`). The composer runs `map_checks` once per region, on the box sub-grid with these options, so one
    region's roads and rivers are checked against its own ends and sources. The world-level options (sealed edges,
    art coverage, the basin checks) still run once on the whole map.
  - All coordinates in a `RegionOut` are world coordinates inside the box.
- **Per-chunk RNG (GAP-14).** Every random draw in the compiler (tufts, peaks, outline noise, jitter) uses
  `np.random.default_rng(crc32(f"{map_id}:{chunk_col}:{chunk_row}:{purpose}"))`, and walks only that chunk's cells
  in row-major order. So a chunk's pixels depend only on its own cells, plus at most 1 cell of neighbouring blend.
  Box edges are 2-cell ocean rings, so that blend never crosses a box. This changes every existing chunk once, in
  Q1b; that one-off churn is accepted, and the act-1 chunk images are re-baselined in that commit.
- **Region compiles.** `build_map.py overworld --region <r>` composes the whole source but rasterises only the
  box's chunks plus a 1-chunk padding ring. It writes only the box's chunk files, plus the full `overworld.yaml`,
  whose collision and lists are cheap. The ring is read, never written. Per-chunk seeding makes the chunks
  byte-equal to a full compile.
  - **Values for the other boxes.** Three compiled values depend on art pixels outside the rasterised set: the
    `collide: alpha` footprints (`ALPHA_MIN`), the `art_coverage` result, and the `above` list (null where a chunk
    is empty). For chunks outside the set they are copied from the existing compiled `assets/maps/ai/overworld.yaml`.
  - **Staleness.** The job fails with `--region: stale base, run a full compile` when the source of any other box,
    or the compiler version recorded in that file, differs from the base.
  - **Selftest.** It compiles a synthetic map in full and by region, and requires the two `overworld.yaml` files to
    be equal.
- **The compile lock.** Only the top-level `build_map.py` CLI takes it, for any `overworld` compile, full or
  `--region`. It is an exclusive `fcntl.flock("/tmp/ff-game-world-compile.lock")`.
  - **Children:** the `--check-determinism` subprocesses run with `FFG_WORLD_LOCK_HELD=1` and skip it, so the check
    can't deadlock on its own lock.
  - **Waiting:** a waiter prints `waiting for the world-compile lock` and polls. After 30 min it fails loudly
    (`world-compile lock timeout after 30 min; holder pid <n>`) and exits 3.
  - **Scope:** only one world compile runs at a time across all worktrees. Full-world compiles and full determinism
    checks are run only by Q1b and the integrator; region tranches use `--region`.
- **`layouts/world.py`** is the only writer of `assets-src/maps/overworld.yaml`. It runs `REGIONS = [a1, elf, wind,
  water, earth, fire]` (pre-seeded; no tranche edits the list) and then the global checks, in this order:
  1. every module stays in its box and every ring is ocean (except J1 and J2);
  2. ids are unique and prefixed;
  3. the Inner Sea is cut off from the Outer Sea with every patch off, and joined to it with `canal` on;
  4. FIRE's inner water joins EARTH's inner water only when `strait_thaw` is on (with it off they are two separate
     components);
  5. basin membership is computed with **every patch on**: each ocean cell belongs to the component of its seed
     (`outer` from S2, `inner` from S10), and every dock lies in its declared basin.
- **`world.py --owned-chunks <region>`** prints the repo-relative paths a region may change: its
  `assets/maps/ai/overworld/{below,above}_<r>_<c>.png` and its `patch_<pid>.png`. The composer-owned patches
  (`strait_thaw`, and the canal's art when it straddles a ring) are listed under the region that declares them:
  EARTH for `canal` and `strait_thaw`, WIND for `wnd_calm`.
- **`overworld.py` becomes a library.** Q1b moves its `main()` document into `world_a1.py`, and `main()` becomes a
  shim that calls `world.main()`. `build()`, `objects()` and `check()` stay and still enforce the act-1 promises.
  The file stays at or under 249 lines.
- **Stubs:** until a region merges, its module returns an ocean box (A1 returns the act-1 block). The verifier
  assumes the grants of `pending` stages (5.1).

### 3.6 Chunk and size cost

| Item | Size | Chunks | Disk (estimate) | Resident GPU |
|---|---|---|---|---|
| World `overworld` | 240x176 | 15x11 = 165 below (above about 10 %) | about 27 MB (at 164 KB per chunk, measured on today's overworld) | at most 60 textures with streaming, about 142 MB in the worst case (768x768 RGBA = 2.36 MB; 4.3); about 390 MB without |
| About 105 new region maps | towns about 40x32 (6 chunks), floors about 32x32 (4), interiors 1 | about 300 | about 30 MB (Cornelia is 2.4 MB for 39 files, the temple 484 KB for 4) | per map, as today (all chunks) |
| World compile | - | - | - | about 90 s (10.5 s x 8.1 area); `--check-determinism` about 3 min |

**Compile memory, measured (`/usr/bin/time -l`, scratch copy, this machine with 48 GiB RAM):**

- The 72x72 overworld peaks at **3.08 GB RSS** (10.6 s).
- A full 240x176 world is 8.1x the area, so it would need about **21-25 GB**, assuming roughly linear growth.
  `--check-determinism` runs two more compiles, one after the other (subprocesses), each at that peak.
- A `--region` compile covers about 56 chunks: a box of 5x6 plus its ring makes 7x8. That is about **7 GB**.
- The lock (3.5) guarantees that at most one world compile is running at any time. Q1b measures the peaks of the
  full and the `--region` compiles and records them in its result. The full-world target is at most 26 GB.

## 4. Tranches

### 4.0 Order, worktrees, merging

```
K (kneel) merged -> Q1-0 contract (serial) -> Q1a | Q1b | Q1c | Q1d (parallel) -> Q1 merge
  -> Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 (parallel, one worktree each) -> Q9 integration and curve -> Q10 play test and fixes
```

- **Kneel first:** Q1-0 branches from the kneel pass's merge commit on `mainline`. Any Q branch made earlier is
  rebased on it before work starts. The kneel pass also touches `assets-src/build_assets.py` (its stage registry);
  Q1a's `vehicles` stage is added after the kneel merge, so the two never conflict.
- **Worktrees:** a tranche's worktree is set up like this, with Q1 tranches branching from the Q1-0 head and
  regions from the Q1 merge head:

  ```
  git worktree add ../ff-game-<t> -b q-<t> <head>
  cd ../ff-game-<t>
  npm ci
  ```

  `npm ci` gives each worktree its own `node_modules`, so Vite caches don't clash. Scratch work goes in
  `/tmp/<tranche>/`.
- **Dev ports:** every tranche runs its own server with `npm run dev -- --host 127.0.0.1 --port <port> --strictPort`,
  and every URL includes `mute=1`. The ports:
  - Q1a 5211, Q1b 5212, Q1c 5213, Q1d 5214;
  - Q2 5202 through Q8 5208;
  - Q9 and Q10 5173.
- **One integrator** (the orchestrator) merges with `git merge --no-ff q-<t>`, in the order the tranches go green.
  It stages paths explicitly and never uses `git add -A`.
- **Generated files are never hand-merged.** These are `assets-src/maps/overworld.yaml`,
  `assets/maps/ai/overworld.yaml`, `assets/maps/ai/overworld/*` and `assets/maps/ai/index.yaml`. On a conflict the
  integrator:
  1. takes either side;
  2. runs `python3 -I assets-src/tools/layouts/world.py && python3 -I assets-src/tools/build_map.py overworld
     --region <merged region>`, plus the merged tranche's ids for `index.yaml` (all under the compile lock);
  3. stages those paths;
  4. runs the section 7 gates, then commits.
- **Shared YAML files get anchors from Q1-0.** Each tranche writes only between its own pair of comment lines, so
  git merges the hunks without conflict:
  - one pair per tranche, `# === Q<n> <REGION> (pass Q: owned by Q<n>) ===` and `# === end Q<n> ===`;
  - in `shops.yaml`, `cutscenes.yaml`, `debug-scenarios.yaml`, `kits.yaml` and `items.yaml`;
  - and in this document's `## Results` section.

| Shared file | Owner | Others may |
|---|---|---|
| `src/core/GameFlags.ts`, `src/types/quest.ts` (new), the `src/types/index.ts` re-export, `src/core/schemaValidationQuest.ts` (new) | Q1-0, then Q1a | read only |
| `src/systems/fieldRules.ts` | Q1-0 declares it; Q1a implements it | Q1d imports it; nobody else edits it |
| `assets/data/quest.yaml` | Q1-0 creates it | edit only their own stages' entries, including their stages' `basins`, `nonLoadBearing` and `entry` |
| The act-1 tests (`tests/data/act1Flow`, `overworldLayout`, `castleLayout`, `castleStairs`, `corneliaLayout`, `templeLayout`, `actOneDialog`, `actOneBalance`, `tests/balance/garland`, `zones`, `fieldPacing`, `economy`) | Q1 may change them only for the stated cases: Q1b clips `overworldLayout` to the 72x72 rect and its ship test to the map's ship spawn; Q1a updates the class-upgrade tests; Q1-0 updates `crossFileValidation.test.ts:339` | **frozen after Q1**. Q2 may update only the `act1_complete` and bridge assertions (4.7); Q8 may only add temple assertions |
| `overworld_consts.py`, `overworld_zones.py` | the act-1 data | Q2 may edit the existing `BRIDGE_WORKERS` and `GATE_MESSAGE` and append new names; nothing else |
| `castle.py` (360 / 360) | nobody | not edited in pass Q; the King's new lines live in the `act1_complete` cutscene data |
| `src/systems/MapLoader.ts` | Q1b (streaming texture loading) | none |
| `items.yaml`, `spells.yaml`, `kits.yaml`, `bestiary.yaml` | Q1c | regions: append inside their own anchor only (a missing item, or their own `q_*` kit) |
| `shops.yaml`, `cutscenes.yaml`, `debug-scenarios.yaml` | anchors from Q1-0 | regions: their own anchor. Q2 may also edit `act1_complete` |
| `enemies.yaml` | nobody by default | a region edits only its own bosses' `bossPhases`, `ai` and `specials`. Only Q9 changes `xpReward` and `goldReward` |
| `build_map.py`, `kit.py`, `terrain/**`, `map_checks*.py`, `world.py`, `world_api.py`, `BakedMapRenderer.ts`, `MapLoader.ts` | Q1b | none; a needed change goes to the integrator as `BLOCKED: <need>` |
| `src/progression/**`, `scripts/quest-verify.ts`, `package.json` | Q1d | none (a bug goes to the integrator) |
| `tests/helpers/**` | Q1c, Q1d | none; a region adds a local helper in `tests/quest/<prefix>/` |
| `src/scenes/ExplorationScene.ts`, `src/scenes/exploration/**`, `src/entities/*Mode.ts`, `src/systems/*` (except `MapLoader.ts`) | Q1a | none |
| `AGENTS.md` | the integrator (Q9) | each tranche writes an "AGENTS.md delta" in its result section |
| `assets/backgrounds/<id>.webp` | the tranche listed in 4.6 per id | - |

### 4.0a Waves, checkpoints, resume and the "tonight" scope

The total effort is about 170 agent-hours; the critical path is about 54 h (4 + 14 + 2 merge + 16 + 8 + 10). Pass Q
is a multi-session pass.

| Wave | Tranches | Checkpoint (all must hold) | Stop condition |
|---|---|---|---|
| W0 | Q1-0 | the Q1-0 commit on `mainline`; G4 and G7 green | a gate still fails after 2 fix attempts: stop and report |
| W1 | Q1a, Q1b, Q1c, Q1d in parallel, then the Q1 merge | each tranche's done-when (4.2-4.5) and gates; the Q1 merge commit `Q1: foundation merged`; on `mainline`, `npm run quest -- --mutate` prints `quest-verify: OK` | the P0 locality selftest or the memory target (3.6) can't be met: **stop the pass**. Any other tranche stuck on one gate after 2 attempts is marked `BLOCKED: <gate>`; the others go on, and the wave stops when its blocked tranche gates the merge |
| W2 | Q2-Q8 in parallel (only one world compile at a time, via the lock) | each region merged with its result section, G1-G12 green, and its stages `built` | a verifier SKIP or SOFTLOCK across two tranches: the integrator decides on the fix. More than 2 regions blocked: stop the wave |
| W3 | Q9 | `npm run quest -- --strict --mutate` OK and `questCurve.test.ts` green | Open question 1's fallback (the XP cap is reached and the median is still below 38): stop and report |
| W4 | Q10 | the fix list closed; all gates green | a P0 that can't be fixed in 2 attempts: stop and report |

- **Resume rule.** A new session does not restart finished work. It reads, in this order:
  1. the `## Results` section;
  2. `git log --oneline mainline | grep -E ' Q[0-9]'`;
  3. `git worktree list`.

  A tranche with a result section is done. A tranche with a branch but no result restarts from the last commit on
  that branch whose gates pass (its result draft lists them). Otherwise it starts fresh in the current wave.
- **W1 order (risk first).** Q1-0 runs first. Q1b then starts with GAP-14 (the per-chunk RNG), the locality
  selftest and the memory probe (`/usr/bin/time -l` on a full world built from stubs), before anything else in
  Q1b. These decide the W1 stop condition. Q1a, Q1c and Q1d start as soon as Q1-0 is merged, in parallel with Q1b.
- **End of session.** When the session is about to end (30 min left), every running W1 tranche commits its work in
  progress on its own branch (`Q1x: WIP`, owned paths only). It also writes a result draft in its anchor that lists
  each gate it has run, as pass or fail, and its next step. A WIP commit never merges to `mainline`.
- **Tonight scope (about 8 h unattended; the work that fits):**
  1. Q1-0, merged to `mainline` with G4 and G7 green (about 4 h);
  2. Q1b's first slice on its branch: the per-chunk RNG, `--selftest` printing `locality: OK`, and the measured peak
     memory of the full world and of a `--region` compile, recorded in its draft (about 4 h). This decides go or
     stop for the pass (the W1 stop condition);
  3. Q1a, Q1c and Q1d started in parallel after step 1, and committed as WIP with result drafts at the end.

  The Q1 merge and every region tranche (Q2 included) are **not** in tonight's scope. They start in the next
  session under the resume rule.

### 4.1 Q1-0 Contract (integrator, serial, effort 4 h: the act-1 `fieldRules` implementation included)

**Owns:**

- `src/types/quest.ts` (new) and the `src/types/index.ts` changes listed below;
- `src/core/schemaValidationQuest.ts`, which `schemaValidation.ts` calls (+2 lines);
- `src/core/GameFlags.ts`;
- `src/systems/fieldRules.ts`: the declarations **and today's act-1 behaviour** (walking terrain, gates with
  `requiredFlag` / `requiredItem`, NPC blocking, `npcPresent`, transitions, scripted encounters), with no throwing
  stubs. `ExplorationScene` and `PlayerController` call it for every step, line-neutral or better;
- `assets/data/quest.yaml`;
- the anchors;
- `assets-src/tools/layouts/world_api.py` (`BOXES`, `J1`, `J2`, the floe and landing-field cells, and the
  dataclasses only);
- `tests/data/questCeilings.test.ts` and the `fileCeilings.test.ts` additions;
- `tests/data/crossFileValidation.test.ts:339` (it accepts `requiredFlags`, and local flags with a region prefix).

**`src/types/index.ts`** (419 lines; new ceiling **440**, added to `fileCeilings.test.ts`). The new interfaces
(`MapPatch`, `Dock`, `Hazard`, `MapExit`, `VehicleState`, `QuestStage`) live in `types/quest.ts`. `index.ts`
changes in place, because an enum or a type alias can't be augmented from another module:

| Change | Lines |
|---|---|
| `export * from './quest.js'` | +1 |
| `enum TerrainType`: the member `Lake = 11` (10 stays the compiler's counter value) | +1 |
| `type MapTransition`: `requiredFlags?: string[]` in its shared object part | +1 |
| `requiredFlags?: string[]` (all must be set) on `KeyItemGate`, `ScriptedEncounter`, `VehicleSpawn`, `NPCCutscene` | +4 |
| `MapNPC`: `requiredItem`, `takeItem`, `tint`, `actionFlag` | +4 |
| `MapData`: `docks`, `patches`, `hazards`, `exit` | +4 |
| `BakedMapArt.patches?` | +1 |
| `EncounterZone`: `modes`, `name` | +2 |
| `SaveData`: `vehicles`, `mode` (and `version` 2 in `SaveManager`) | +2 |
| total | about +20, so at most 440 |

**Other declarations:**

- `ConditionalDialog.condition` may be `item:<id>`.
- **Cutscene steps** (in `CutsceneRegistry`'s accepted list):
  - `give_item {item}`, `take_item {item}`;
  - `set_vehicle {vehicle, map, x, y}`;
  - `end_game {text?}` (GAP-13).
- `DebugScenario.vehicles` and `mode`.
- `BattleRetrySnapshot.mode` and `vehicles` (GAP-12).
- `safeSpawn(map, pos, mode?, vehicles?)` (GAP-11).
- **Field spell ids** (Q1c adds the records): `exit` (effect `field_exit`) and `warp` (effect `field_warp`).
- **`fieldRules.ts`** (pure, no PixiJS; the only place the field rules live):

```ts
export type FieldMode = 'walking' | 'canoe' | 'ship' | 'airship';
export interface FieldState { flags: ReadonlySet<string>; items: ReadonlySet<string>; mode: FieldMode;
  vehicles: readonly VehicleState[] }
export function patchedTerrain(map: MapData, x: number, y: number, flags: ReadonlySet<string>): TerrainType;
/** Terrain after patches; gates (requiredFlag(s), requiredItem); static (non-wander) NPC cells block; the canoe
 *  ability turns walking into canoe on River and Lake; a ship enters only Water; while flying, everything is open. */
export function canEnter(map: MapData, cell: { x: number; y: number }, mode: FieldMode, state: FieldState): boolean;
export function canLand(map: MapData, cell: { x: number; y: number }, state: FieldState): boolean;
export function dockFor(map: MapData, cell: { x: number; y: number }): Dock | null;
export interface NpcOutcome { present: boolean; dialog: string[]; take?: string; give?: string; setFlags: string[];
  cutscene?: string; battle?: string; action?: string }
export function npcOutcome(npc: MapNPC, state: FieldState, encounters: ScriptedEncounter[]): NpcOutcome;
/** Whether a transition can be taken now (requiredFlag / requiredFlags). */
export function transitionOpen(t: MapTransition, state: FieldState): boolean;
/** The scripted encounter due at a cell (flag unset, requiredFlag(s) met), or null. */
export function dueEncounter(map: MapData, cell: { x: number; y: number }, state: FieldState): ScriptedEncounter | null;
export interface StepResult { ok: boolean; mode: FieldMode; setFlags: string[]; message?: string;
  transition?: MapTransition; encounter?: ScriptedEncounter }
/** One step from `from` to the 4-neighbour `to`: canEnter, gate messages, permanent gates' flags, mode changes
 *  (canoe on and off, ship disembark at a dock, boarding a parked vehicle), the transition taken, the encounter due.
 *  The single entry point the game and the verifier share. */
export function fieldStep(map: MapData, from: { x: number; y: number }, to: { x: number; y: number },
  state: FieldState): StepResult;
```

In Q1-0, `fieldStep` covers walking only: the `mode` result is always `walking`, and the vehicle branches return
`ok: false`. `tests/systems/fieldRules.test.ts` (Q1-0) pins the act-1 behaviour: the bridge gates and their
message, the temple's Garland cells, the castle doors, and NPC blocking. Q1a's extensions must keep these tests
unchanged.

**Done when:**

- `npm run build` exits 0 and `npm test` reports 0 failed;
- `questCeilings.test.ts` asserts that every file under `src/progression/`, `src/types/quest.ts`,
  `src/systems/fieldRules.ts`, `assets-src/tools/layouts/world*.py` and the region layout directories has fewer
  than 250 lines, apart from the AGENTS.md exceptions;
- `fileCeilings.test.ts` adds `src/types/index.ts` at 440 and `src/scenes/ExplorationScene.ts` at 590. The second
  entry goes in skipped and is enabled by Q1a; until then the existing AGENTS rule (601) holds;
- `quest.yaml` pre-seeds the basin seeds: `basins: {outer: <seed>}` on S2 and `basins: {inner: <seed>}` on S10
  (the seed cells come from `world_api.BOXES`: `outer` (76, 40) in the A1/ELF channel, `inner` (120, 120) in the
  EARTH gulf). Q4 may move `inner` within its box;
- `npx vitest run tests/systems/fieldRules.test.ts` passes, and so do the existing exploration tests.

### 4.2 Q1a Field engine (TS, effort 14 h)

**Owns:**

- `src/scenes/ExplorationScene.ts`: **extract first** into `src/scenes/exploration/FieldVehicles.ts` and
  `FieldNpcActions.ts`, and end at 590 lines or fewer;
- `src/systems/fieldRules.ts`: it **extends** Q1-0's working implementation with vehicles, patches, docks, landing,
  `requiredFlags`, item conditions and trades. `ExplorationScene`, `PlayerController` movement and `NPCInteraction`
  keep calling it and hold no rule of their own;
- `assets/maps/test-dock.yaml` (new): a docked variant of `test-overworld.yaml`, adding a dock, a parked-ship
  spawn without `requiredFlag`, a grass landing patch and a river, plus the debug scenario `q1a_ship_dock` (field
  mode, `map: test-dock`);
- `src/scenes/exploration/**`, `src/entities/*Mode.ts`;
- `src/systems/{VehicleManager, KeyItemGateSystem, NPCInteraction, CutsceneManager, CutsceneRegistry,
  ClassUpgradeSystem, SaveManager, DebugScenarioLoader, FieldSpellEffects, EncounterSystem, MapTransition,
  BattleRetry}.ts`, `src/rendering/CollisionMap.ts`;
- `assets-src/vehicles.py` (new, code-drawn ship and airship sprites, 0 images) and the `vehicles` stage in
  `build_assets.py` (after the kneel merge);
- `tests/data/assetCoverage.test.ts`.

**Work:**

- **Vehicles:** everything in 3.3, plus the sprites and save v2.
- **Patches:** `patchedTerrain` and `CollisionMap` override a cell's terrain while the patch's flag is set.
- **AND gates:** `requiredFlags` in every gate check.
- **Dialog conditions on items:** `item:<id>` conditions.
- **NPC trade** (`npcOutcome`): if `requiredItem` is held and `giftFlag` is not set, the NPC shows its dialog,
  takes the item when `takeItem` is set, gives `giftItem` and sets `giftFlag`.
- **NPC tint:** a PixiJS `tint` on the NPC sprite.
- **Class upgrade:** `classUpgrade` reads `actionFlag`; the old EARTH_CRYSTAL_LIT rule is removed and its tests
  are updated.
- **Hazards:** each walking step on a hazard cell takes `damage` HP from every living member, but never below 1 HP,
  with a red flash.
- **Field EXIT / WARP:** `field_exit` goes to `MapData.exit`; `field_warp` goes back to the previous floor's
  arrival cell.
- **Zone `modes`.**
- **GAP-11, `safeSpawn`:** a position on a parked vehicle's cell, or one that is valid in the saved mode, is kept.
- **GAP-12, battle retry:** the snapshot restores the mode and the vehicles.
- **GAP-13, `end_game`:** shows `text` (or "The End"), waits for confirm, then switches to the title. It does not
  save.
- **Asset coverage:** the test also reads the compiled maps' NPC sprites. New NPCs must use one of the 24 existing
  field sheets, plus `tint`.

**Tests (RED first):**

- `tests/systems/{vehicles, patches, npcTrade, hazards, fieldRules, safeSpawnModes, battleRetryVehicles,
  endGame}.test.ts`;
- the act-1 tests unchanged, apart from the class-upgrade tests.

**Done when:**

| Command | Expected |
|---|---|
| `npx vitest run tests/systems/vehicles.test.ts tests/systems/patches.test.ts tests/systems/npcTrade.test.ts tests/systems/hazards.test.ts tests/systems/fieldRules.test.ts tests/systems/safeSpawnModes.test.ts tests/systems/battleRetryVehicles.test.ts tests/systems/endGame.test.ts` | every file passed |
| `wc -l < src/scenes/ExplorationScene.ts` | at most 590; the ceiling test entry is enabled |
| `grep -n "isWalkable\|keyItemGateSystem.check" src/scenes/ExplorationScene.ts src/entities/PlayerController.ts` | only calls that go through `fieldRules` (listed in the result) |
| `npm run build && npm test` | exit 0; 0 failed |
| browser, `http://127.0.0.1:5211/?mute=1&scenario=q1a_ship_dock` (the `test-dock` fixture map) | the ship sprite is at the dock; stepping onto it sets `__game` mode `ship`; stepping onto the dock's land cell disembarks the party, and the ship stays parked |

### 4.3 Q1b Map toolchain and streaming (Python and renderer, effort 14 h)

**Owns:**

- `build_map.py`, `kit.py`, `terrain/**`, `map_checks*.py`, `map_graph.py`;
- `layouts/world.py`, `world_api.py` (logic), the `world_<region>.py` stubs, `world_a1.py` (moved from
  `overworld.py main()`), `overworld.py` (the shim);
- `src/rendering/BakedMapRenderer.ts`, `src/systems/MapLoader.ts`;
- `tests/data/overworldLayout.test.ts` (clipped to the act-1 rect x 0-71, y 0-71; the ship test reads the map's
  ship spawn instead of the jetty) and `tests/quest/a1/frozenCore.test.ts`.

**Work:**

- **Per-chunk RNG (GAP-14, 3.5):** every `rng` in `build_map.py` and `terrain/` is seeded per chunk.
- **`--region` and the compile lock** (3.5); `--check-determinism` also accepts `--region`.
- **Per-region checks:** `RegionOut.checks` runs per region (3.5).
- **Legend and terrain:**
  - `w` swamp (TerrainType.Swamp, a soft material, a placeholder texture);
  - Lake compiles to 11;
  - `BLOCKED` adds 11.
- **Passthrough:** `docks`, `patches`, `hazards` and `exit` pass through to the compiled map.
- **Patch art:**
  - each patch's cells and objects are baked into `assets/maps/ai/<id>/patch_<pid>.png`;
  - a check fails if the overlay is not opaque on every patch cell.
- **Patch overlays at runtime:** `BakedMapRenderer` draws each patch's image above the below-layer, while its flag
  is set.
- **Material remaps** take `hue` and `sat` as well as `shade`. Named presets: `cave` (brown temple stone), `ice`,
  `lava` (an orange rubble floor), `sky` (slate castle), `coral` (teal castle).
- **Placeholder landmarks** in `kit.py` (code-drawn, labelled): `cave_mouth`, `tower`, `volcano`, `shrine`,
  `dock_post`, `buried_hull`, `sky_ring`, `ice_floe`.
- **The world composer** and its global checks (3.5), including the `strait_thaw` patch.
- **Map checks:** `no_unreachable_walkable` takes `reach_roots`, so every region names its entrances.
- **The canoe spawn** at `overworld.py:233` is removed.
- **Streaming** applies to maps of more than 64 chunks; a small map loads every chunk, as today.
  - **What stays loaded:** the visible area is at most 3x2 chunks (a view of 20x11 cells, chunks of 16), plus a
    1-chunk ring (5x4), plus 1 chunk ahead in each axis of travel. The diagonal worst case is 6x5 = 30 below
    textures plus at most 30 above textures, so the **cap is 60**.
  - **Unloading:** chunks outside that set are freed least-recently-used, with `Assets.unload(url)`.
  - **A miss:** if a chunk under the next view isn't loaded, movement holds for up to 6 frames. After that the chunk
    is drawn as a flat placeholder in its dominant material's colour (ocean blue on the world map), and the real
    texture replaces it when it loads. Each miss logs once.
  - **First frame:** the first frame waits for the visible set, as today.

Q1b is **exempt from G3**: it re-baselines every chunk on purpose (3.5). Its locality selftest and
`frozenCore.test.ts` cover the same risk.

**Done when:**

| Command | Expected |
|---|---|
| `python3 -I assets-src/tools/build_map.py --selftest` | exit 0; prints `region yaml: OK` (a region compile's `overworld.yaml` equals the full compile's), `locality: OK` (a synthetic 2-box map: editing box X changes only X's chunk files, byte for byte) and `region checks: OK (2 stub regions with roads)` |
| `python3 -I assets-src/tools/layouts/world.py && python3 -I assets-src/tools/build_map.py --check-determinism overworld` | `overworld: deterministic` |
| `/usr/bin/time -l python3 -I assets-src/tools/build_map.py overworld --region elf` | exit 0; maximum resident set at most 10 GB; the output chunks are byte-equal to a full compile's (selftest) |
| `/usr/bin/time -l python3 -I assets-src/tools/build_map.py overworld` | exit 0; maximum resident set at most 26 GB (the measured value goes in the result) |
| two `--region` compiles started at once from two worktrees | the second prints `waiting for the world-compile lock` and finishes after the first |
| `npx vitest run tests/rendering/bakedStreaming.test.ts tests/data/overworldLayout.test.ts tests/quest/a1/frozenCore.test.ts` | all passed (streaming: at most 60 resident textures during a world sweep at airship speed; a miss holds at most 6 frames, then shows the placeholder; unloaded textures go through `Assets.unload`) |
| `npm run build && npm test` | exit 0; 0 failed |

### 4.4 Q1c Data canon (effort 10 h)

**Owns:**

- `items.yaml`: the key items of 2.1 and the gear for every band in 6.1;
- `spells.yaml`:
  - levels 5-8, 30 spells, including `exit` and `warp`;
  - it **keeps exactly** the 20 ids enemy spell lists already use but `spells.yaml` doesn't define: bane, blnd,
    brak, cur4, fir3, fog2, hel2, hel3, ice3, inv2, lit3, nuke, rub, slo2, stop, stun, wall, xfer, xxxx, zap. No
    enemy record is edited;
- `src/battle/spellEffectsLate.ts` (new): the death, stone, all-target stun, full-revive and multi-status-cure
  effects. `SpellExecutor.ts` gets at most 2 dispatch lines and stays within its 314 ceiling;
- `kits.yaml`: a `q_<stage>` kit for every band;
- `bestiary.yaml`: habitats come from the manifest and the zone `name`;
- the `shops.yaml` sections: the Elfheim and Melmond records move into the Q3 and Q4 anchors with their ids
  unchanged;
- `tests/helpers/balanceData.ts`: `bossWinRate(ids, level, kit, policy, seeds)` and `floorRun(zoneTable, fights,
  level, kit)`;
- `scripts/check-bounds.ts` (G9);
- `tests/data/gearBands.test.ts`, `tests/data/rosterCoverage.test.ts` (it reports in Q1, and fails only with
  `QUEST_STRICT=1`, which Q9 sets).

**Done when:**

- `crossFileValidation`, `spellEffects`, `MagicShopScene` and every balance test are green, and a cross-file test
  shows that every enemy spell id resolves;
- `gearBands.test.ts` passes. It checks three things:
  - every shop item is within its town's caps;
  - each band adds at least one upgrade for each base class (exemptions listed in the test);
  - no item stronger than its band appears in an earlier shop.

### 4.5 Q1d Progression-gap verifier (TS, effort 12 h)

**Owns:**

- `src/progression/{questData, questPlaces, questEvents, questSearch, questProofs, questCurve, questMutate,
  questReport}.ts` (pure TS, no PixiJS). For field semantics they import **only** `src/systems/fieldRules.ts`
  (plus the data types and `ExperienceTable`); a test asserts this import rule;
- `scripts/quest-verify.ts`, added by name to the tsconfig `include`, so `tsc` checks it;
- the `"quest": "vite-node scripts/quest-verify.ts"` script in `package.json`;
- `tests/progression/*.test.ts`;
- `tests/fixtures/quest/` (tiny synthetic worlds);
- `tests/quest/{designNotes, originality}.test.ts` (4.6).

**Work:** section 5. **Done when:**

| Command | Expected |
|---|---|
| `npx vitest run tests/progression/` | all passed: each proof (a)-(e) fails on a fixture built to break it (RED first), and passes on a clean fixture |
| `npm run quest -- --mutate` (on the Q1 head: S0 built, the rest pending) | ends with `quest-verify: OK`; exit 0. While the bridge has no patch, the two act-1 bridge gate cells (`overworld` (29, 32) and (30, 32)) block nothing extra: the gap is ocean. Q1d therefore lists them in S0's `nonLoadBearing` with that reason, and Q2 removes the entries when `north_bridge` makes them load-bearing |
| `npm run build` | exit 0 (covers `scripts/quest-verify.ts`) |

### 4.6 Region tranche template (Q2-Q8)

Every region tranche follows this template:

- **Owns:**
  - `layouts/world_<prefix>.py` and its helpers `layouts/<prefix>/*.py`;
  - its generated `assets-src/maps/<map-prefix>*.yaml` and compiled `assets/maps/ai/<map-prefix>*`;
  - its anchors;
  - its stages in `quest.yaml`;
  - `tests/quest/<prefix>/*.test.ts` and `tests/balance/q<n>_<region>.test.ts`;
  - the battle backgrounds listed for it below, staged with `python3 -I assets-src/tools/stage_backgrounds.py <ids>`
    from the local sources (no new code).
- **Towns:** a town map, and with them six shops (or fewer, if listed) and an inn, built with
  `interiors_common.shop`. Shop lists stay within the caps in 6.1.
- **NPCs:** NPCs use existing field sheets, plus `tint`. Every town has at least 8 NPCs with original lines, and at
  least 2 of them hint at the next stage.
- **Chests:** each dungeon floor has 2-5 chests of band-appropriate consumables, gear or gold. Each key item is in
  exactly one place.
- **Dungeons:** each has a `MapData.exit` (for EXIT). A boss floor has a `canSave: false` approach.
- **Bosses:** a `scriptedEncounter` with `isBoss`, `requiredFlags`, a `message` and a `postVictoryCutscene`. The
  cutscene sets the grants and gives items with `give_item`. Its text is original.
- **Gates:** gates, patches and transitions use only the milestone flags of 2.1 and the tranche's own local flags.
- **Debug scenarios:**
  - `q<n>_<stage>_start`: a field start at the stage entrance, with the band-low party, the previous band's kit, the
    prerequisite flags and items, and the vehicles;
  - `q<n>_boss_<id>`: the boss battle at the band level with the stage kit.
- **Originality** must be checkable without a person present. No map copies a classic floor plan, town plan or
  world position, and the dialogue and event staging are written new. Four checks enforce this:
  1. **Design note.** Each map source starts with 3 labelled comment lines: `Concept:`, `Distinct:` (at least 2
     features that no classic version of the place has) and `Topology:` (the stair and boss graph, e.g.
     `B1 -> B2 (2 stairs) -> B3 boss, one-way pit B2 -> B1`). `tests/quest/designNotes.test.ts` (Q1d) fails on a
     region map without all 3.
  2. **Self-check list, by layout topology.** Classic floor counts may stay. The tranche reports these numbers per
     dungeon in its result; `tests/quest/originality.test.ts` computes them from the compiled maps and checks the
     thresholds:
     - **stair graph:** the floors and their links (stairs, one-way pits, teleports) as an edge list. At least half
       of the tranche's dungeons are not a simple chain (some floor has 2 or more links out, or there is a loop or a
       one-way edge);
     - **branch count:** the dead-end side branches per floor, from `map_report.py`'s chokepoint graph. Each floor
       of 24x24 cells or more has at least 2;
     - **boss-room position:** the boss cell's position relative to the floor's arrival, as a compass octant and a
       path length. No two of the tranche's boss floors share both;
     - **floor shape:** the walkable mask's bounding-box aspect ratio and fill ratio. No two floors of a dungeon
       match within 5 %, and no two maps' `ground` grids are equal, or equal after a mirror or transpose;
     - **design note:** present and consistent. The `Topology:` line's floor list and boss floor match the stair
       graph.

     The compass bearing of each place from Cornelia, compared with the classic bearings, is reported **for
     information only**; it has no threshold.
  3. **Phrase test.** `tests/quest/originality.test.ts` greps the dialogue of every region map and of every new
     cutscene for a list of about 20 famous lines and names from the classic script, which Q1d curates in the test.
     The act-1 maps are exempt, since they keep their existing lines.
  4. **Reviewer.** Before each merge, a fresh reviewer agent gets the tranche's `--preview` crops, its design notes
     and its dialogue. It records `originality review: PASS <map ids>` (or its findings) in the result section, and
     the integrator merges only on PASS.
- **Done when:** all the section 7 gates pass. The tranche also appends its `Q<n> result` (gates output, measured
  balance values, AGENTS.md delta) inside its anchor here.

### 4.7 Q2 A1: the bridge, Pravoka and Matoya (stages S1, S2, S3, S7; effort 10 h)

- **Owns:**
  - `layouts/world_a1.py`;
  - in `overworld_consts.py` and `overworld_zones.py`: edits to the existing `BRIDGE_WORKERS` and `GATE_MESSAGE`
    lines, plus new names appended;
  - not `castle.py` (360 / 360): the King's new lines live in the `act1_complete` data;
  - `layouts/pravoka/*.py`, plus the maps `pravoka*` and `matoya-cave`;
  - the `act1_complete` cutscene;
  - backgrounds: none (it reuses the existing ones).
- **Bridge:**
  - `act1_complete` is rewritten: the King orders the span rebuilt, a fade, then `set_flag BRIDGE_BUILT`. The
    "completed the introduction" lines are removed (Open question 4).
  - Patch `north_bridge` turns the two gap rows and the stubs into Bridge, and its built span covers the debris.
  - The workers' lines change on BRIDGE_BUILT.
  - The act-1 tests that assert the old ending are updated, not deleted.
  - Q2 removes the two bridge gate entries from S0's `nonLoadBearing` (4.5); with the patch they become
    load-bearing.
- **Pravoka:**
  - the town sits in the Pravoka rect (x 54-66, y 5-13, the mainland's NE coast; 3.2), with its `outer` dock on the
    rect's east side, in the ocean column x 65-66;
  - it has 6 shops and an inn (band B2, magic L2) and 2 houses;
  - the pirate captain (flag BIKKE_DEFEATED; the existing data names him Bikke, so the name may stay) starts
    `pirate` x9 through `npc`;
  - his `postVictoryCutscene` hands over the ship;
  - the ship spawn moves from the Cornelia jetty to the Pravoka dock.
- **Matoya's cave:** 1 floor. Its icon is in the Matoya rect (x 6-14, y 8-16, the NW mainland forest), and it can
  be reached on foot from the north shore after BRIDGE_BUILT (layout check). Matoya trades `crystal_eye` for `herb` (`requiredItem`, `takeItem`),
  and her dialog differs before and after (`item:crystal_eye`).
- **Zones:** `a1_pravoka_coast` and `a1_sea`.

### 4.8 Q3 ELF: Elfheim, the Marsh Cave and the Western Keep (S4, S5, S6, S8, S9; effort 14 h)

- **Owns:** `world_elf.py`, `layouts/elf/*.py`, the maps `elfheim*`, `marsh-cave-b1..b3` and `western-keep-1f..2f`,
  and the backgrounds `swamp_cave` and `palace`.
- **Elfheim:**
  - the town keeps the existing `elfheim_*` shops and has an inn and 2 houses, with the `outer` dock;
  - the castle has 2 maps: the hall, where the sleeping prince is an NPC that trades `herb` for `mystic_key` and
    sets PRINCE_AWAKE, and the vault behind a `mystic_key` permanent gate, which holds `tnt` and 2 band-B3 chests.
- **Marsh Cave:** 3 floors (it descends). On B3, `crown` sits behind a `piscodemon` x3 boss guard
  (MARSH_GUARD_DEFEATED).
- **Western Keep:** 2 floors. The false king takes `crown` (trade) and starts `astos` (`npc`, `requiredFlags:
  [MARSH_GUARD_DEFEATED]`). The victory gives `crystal_eye` and sets ASTOS_DEFEATED.
- **Zones:** `elf_fields`, `elf_fen`, `elf_keep_moor` and `elf_sea`.

### 4.9 Q4 EARTH: the canal, Melmond and the Cavern of Earth (S10-S13; effort 16 h)

- **Owns:** `world_earth.py`, `layouts/earth/*.py`, the maps `dwarf-mine-1..2`, `melmond*`, `cavern-earth-b1..b5`,
  `giant-tunnel` and `sage-cave`, and the backgrounds `throne_lich` and `cracked_earth`.
- **Dwarf mine:** 2 floors on the north rim, with the `outer` dock. The foreman takes `tnt` and his cutscene sets
  CANAL_OPEN, which opens patch `canal` (J1).
- **Basins and patches:** EARTH declares the basin `inner` in S10 (`quest.yaml`). It owns `canal` and the floe art
  of `strait_thaw` (3.2), whose flag is EARTH_CRYSTAL_LIT.
- **Melmond:** the town is on the Inner Sea, with the `inner` dock. It keeps the existing `melmond_*` shops and has an
  inn and 2 houses. It shows the rotting earth.
- **Cavern of Earth:**
  - B3 holds `vampire`, which gives `ruby`;
  - B4 is behind `keyItemGates requiredItem: rod`, a permanent gate that sets EARTH_SEAL_BROKEN;
  - the lower floors are the frozen undercroft of the Rime Sovereign's ancestral fortress (his lore);
  - on B5, `lich` sets EARTH_CAVE_COMPLETE, and a crystal-altar cutscene sets EARTH_CRYSTAL_LIT.
- **Giant's tunnel:** the giant blocks it and takes `ruby` (TITAN_FED; it hides on `hideIf`).
- **Sage's cave:** the sage gives `rod` once VAMPIRE_DEFEATED is set.
- **Zones:** `ert_rim`, `ert_plain`, `ert_badlands`, `ert_outer` and `ert_inner`.

### 4.10 Q5 FIRE: Crescent Lake, the sun temple, the ice cavern and the airship (S14-S17; effort 16 h)

- **Owns:** `world_fire.py`, `layouts/fire/*.py`, the maps `crescent*`, `sun-temple-1..5` and `ice-cavern-b1..b3`,
  and the backgrounds `fire_temple`, `magma_temple`, `throne_kary` and `ice_cave`.
- **Crescent Lake:**
  - the town has the `inner` dock (it reaches the J2 strait), 6 shops (band B5, magic L5) and an inn;
  - the sages' circle is a separate map whose elder gives `canoe` with CANOE_GIVEN, under
    `requiredFlags: [EARTH_CRYSTAL_LIT]`;
  - its lines refer to the old sun-temple hymns (lore).
- **Rivers:** they lead from the lake to the sun temple and to the ice cavern, and only the canoe can reach either.
- **Sun temple:** 5 floors with lava hazards (damage 1). On floor 5, `ashen_queen` sets FIRE_CRYSTAL_LIT.
- **Ice cavern:** 3 floors with one-way pits (transitions). `evil_eye` guards `sky_stone` (EVIL_EYE_DEFEATED).
- **Desert:** a `buried_hull` NPC takes `sky_stone`. Its cutscene sets AIRSHIP_RAISED and runs
  `set_vehicle airship` on a grass cell.
- **Zones:** `fir_lakeshore`, `fir_ashlands`, `fir_tundra`, `fir_desert`, `fir_outer`, `fir_inner` and
  `fir_rivers`.

### 4.11 Q6 WATER: the trial keep, the dragon king, Onrac and the Sea Shrine (S18-S21; effort 16 h)

- **Owns:** `world_water.py`, `layouts/water/*.py`, the maps `trial-keep-1..3`, `dragon-isle`, `onrac*`,
  `waterfall-grotto` and `sea-shrine-1..5`, and the backgrounds `water_temple` and `throne_kraken` (it also uses
  `waterfall`, which exists).
- **Trial keep:** 3 floors with teleport tiles (transitions). `dragon_zombie` guards `ordeal_seal`
  (ORDEALS_GUARD_DEFEATED).
- **Dragon isle:** the dragon king takes `ordeal_seal`. His cutscene sets CLASS_UPGRADED, and he has
  `action: classUpgrade` with `actionFlag: CLASS_UPGRADED`.
- **Onrac:** the town is on an airship-only isle, with 6 shops (band B6, magic L6), an inn and 2 houses. Its lines
  carry the lore: the bells of the sunken city, and the crowned man on the sea floor.
- **Waterfall grotto:** it is reachable only by canoe. An automaton NPC gives `cube`.
- **The `breath_pearl` chain** (it needs the airship and the canoe):
  1. In Onrac, the widow NPC `onrac-widow` speaks of her husband, a pearl diver lost in the waterfall grotto. Her
     dialog sets WAT_WIDOW_ASKED (through an NPC cutscene `wat_widow_ask` with `onceFlag: WAT_WIDOW_ASKED`).
  2. In the grotto, the chest `CHEST_WAT_DIVER` gives `diver_ring`. The chest NPC has `showIf: WAT_WIDOW_ASKED`, so
     the ring can't be found before the story asks for it.
  3. Back in Onrac, `onrac-widow` trades `diver_ring` for `breath_pearl` (`requiredItem`, `takeItem`,
     `giftFlag: WAT_PEARL_GIVEN`). Her dialog branches on `item:diver_ring` and on WAT_PEARL_GIVEN.
  4. The automaton that gives `cube` stands in a deeper room of the same grotto (`giftFlag: WAT_CUBE_GIVEN`).
- **Sea Shrine:** the dive cell is a shore transition behind `keyItemGates requiredItem: breath_pearl`. On floor 5,
  `drowned_sovereign` sets WATER_CRYSTAL_LIT. A chest on floor 3 holds `tide_tablet`.
- **Zones:** `wat_isles`, `wat_sea` and `wat_streams`.

### 4.12 Q7 WIND: Gaia, the sky-folk village, the Mirage Tower and the sky fortress (S22-S24; effort 16 h)

- **Owns:** `world_wind.py`, `layouts/wind/*.py`, the maps `gaia*`, `highland*`, `mirage-1..3` and
  `sky-fortress-1..5`, and the backgrounds `sky_palace`, `tower_of_babel` and `throne_tiamat`.
- **Gaia:** the town has 6 shops (band B7, magic L7) and an inn, and its windmills stand still (lore).
- **The sky-folk village** (`highland`) is on an airship-only plateau, with 2 shops (magic L8) and an inn. Its
  translator takes `tide_tablet` and gives `chime`.
- **Mirage Tower:** 3 floors. The door is a `chime` gate. On the top floor, an NPC (the tower's sky-anchor
  console) with `requiredItem: cube` plays the cutscene `mirage_ascent` (`onceFlag: SKY_FORTRESS_OPEN`). The
  cutscene sets SKY_FORTRESS_OPEN and warps to `sky-fortress-1` entrance `arrival`. The transition back down is
  gated on SKY_FORTRESS_OPEN.
- **The landing field:** WIND owns the patch `wnd_calm` (flag WATER_CRYSTAL_LIT, 3.2). Its storm-sand cells sit
  around Gaia, the plateau and the Mirage sands.
- **Sky fortress:** 5 floors. `warmech` is a rare formation (weight 1 in 64) in one zone on floor 4. On floor 5,
  `hollow_seraph` sets WIND_CRYSTAL_LIT.
- **Zones:** `wnd_steppe`, `wnd_mirage_sands` and `wnd_sea`.

### 4.13 Q8 PAST: the time gate and the temple of the past (S25, S26; effort 10 h)

- **Owns:** `assets-src/maps/temple-of-fiends.yaml` (the only tranche that edits it; it stays hand-written), the
  maps `past-temple-1..5` and `past-chaos`, the `ending` cutscene, and the background `fiend_hall` (plus `rim`, which
  exists).
- **Time gate:**
  - a new stair in the act-1 temple is behind `keyItemGates requiredItem: lute, requiredFlags: [the 4 crystal
    flags]`;
  - an altar cutscene sets TIME_GATE_OPEN;
  - Garland's room and its tests are unchanged.
- **Past temple:**
  - each of floors 1-4 ends at one refight (`lich_2`, `ashen_queen_2`, `drowned_sovereign_2`, `hollow_seraph_2`),
    which sets its PAST_* flag;
  - `death_eye` guards the stair on floor 5;
  - `past-chaos` holds `chaos` (`isBoss`, the existing forms, `canRun` false, background `rim`).
- **Ending:** the `ending` cutscene sets CHAOS_DEFEATED and closes the loop: the party wakes in Cornelia, then the
  title screen.

### 4.14 Q9 Integration and curve (integrator, effort 8 h)

1. Merge every tranche; set every stage to `built`; run `QUEST_STRICT=1`.
2. Run `npm run quest -- --strict --mutate`.
3. Add `tests/balance/questCurve.test.ts` (6.4).
4. Tune the XP (Open question 1).
5. Update AGENTS.md: the quick reference, the "Editing a 2x Map" table, vehicles, the verifier, the flag prefixes
   and the new ceilings.
6. Write the `Q9 result`.

### 4.15 Q10 Adversarial play test and fixes (effort 10 h)

- **Play test:** fresh agents run the browser checkpoints (5.6), then a scenario-hopping run through every stage,
  then the originality review (4.6).
- **Fixes:** findings go into a fix list with P0-P3 severities. A momus review follows, then the fixes, and then the
  section 7 gates again.

## 5. Progression-gap verifier

### 5.1 Model

**Inputs:**

- the compiled maps (`assets/maps/ai/*.yaml`: collision, transitions, gates, patches, docks, NPCs, chests,
  scripted encounters, vehicles, hazards);
- `cutscenes.yaml`, `items.yaml` (`type: key`) and `quest.yaml`.

**Field semantics come only from `src/systems/fieldRules.ts`** (`canEnter`, `canLand`, `dockFor`, `npcOutcome`,
`patchedTerrain`), the same module the game calls (4.1). The verifier also uses `arrivalFor` for transition
targets.

**NPCs block movement in the model.** A static NPC (no `wander`) that `npcPresent` shows makes its cell
impassable, as it is in the game. A hidden NPC does not block. Wandering NPCs are ignored, since `noWander` keeps
them off single-file routes. An NPC is talkable from a reachable 4-neighbour, or across a counter, as in
`map_graph.talkable`.

**Places:** a place is a 4-connected component of one map under one mode (walking, walking+canoe, ship, air) for the
current patch and gate state. Components are cached by (map, mode, active patches, open gates).

**Edges:**

- transitions, including `requiredFlag(s)`;
- docks (walking to ship, inside one basin);
- landing (air to walking, on grass cells);
- take-off (where the airship is parked);
- EXIT and WARP, which return only to places already visited.

**Events:**

- a chest (gives an item);
- an NPC gift or trade (takes and gives an item, sets a flag);
- an NPC cutscene (its `set_flag`, `give_item`, `take_item` and `set_vehicle` steps);
- a scripted encounter (assumed won; sets its flag; then the `postVictoryCutscene`);
- a permanent gate (sets its flag);
- a vehicle spawn (`requiredFlag(s)`).

Only key items and the flags that something reads count as state (a relevance pass); other chests are ignored.

**State:** (relevant flags, key items held, the ship's dock, the airship's landing place, the player's place).

**Pending stages (assume mode):**

- A pending stage's synthetic grant event fires only once its `after` stages are complete **and** its `requires`
  (flags, items and vehicles) all hold in the current state. Its `grants` are then added. The 2.1 consumption rule
  applies exactly as for real events: an item in `requires` that 2.1 marks as consumed is removed. Its vehicles are
  placed at the `entry`.
- `--stage S<n>` runs the proofs for one tranche's stages. It starts from that stage's `entry`
  (`{map, x, y, mode, vehicles}`). The assumed start state holds the grants of every ancestor stage, after the 2.1
  consumption rule: items consumed by an earlier stage are absent, as they would be in play. This is how a region
  tranche verifies itself before the stages before it are built.
- With `--strict`, a pending stage is an error.

### 5.2 Proofs

- **(a) Order.** The saturation closure from a new game (Cornelia south gate, act-1 flags) reaches the goal. The
  verifier records the first state in which each stage's grants all hold. That order must be a linear extension of
  the `after` DAG, and the declared `walk` of each stage must run step by step from that state.
- **(b) No skip.** For every stage S and every ancestor P of S, the verifier disables the events that give P's
  grants and computes the closure again. Neither S's `boss` encounter nor any of S's grants may be reachable. It
  then does the same for each declared requirement r of S, so each requirement is shown to be necessary. In
  `--stage` mode the ancestors are assumed, not built, so (b) removes **each assumed grant from the start state in
  turn** (one flag, item or vehicle at a time). Each removal must leave S's boss and grants unreachable, unless the
  removed grant is not in the transitive `requires` of S (it is then reported as `not required`, not as an error).
- **(c) No soft-lock.** BFS over states (5.1) covers trades that consume items and one-way transitions. From every
  reachable state, the goal must stay reachable.
  - If it is not, the verifier reports the state and the shortest path into it.
  - It also checks that every place reachable on foot has a route back to the world map or to the goal place.
  - It fails if any read flag is never set, or any gate item is never obtainable (a dead gate).
- **(d) Bands.** The curve model is deterministic, with no battles:
  - `fights_s = grind_s x Σ (path cells in zone z / mean steps per encounter of z)`, over the witness path from (a).
    The mean steps per encounter is `(min + max) / 2` of the zone's or map's `encounterRate`, divided by the
    mode's multiplier from the movement-mode classes: walking 1, canoe 0.5, ship 1, airship 0 (no fights).
  - `xp_s = fights_s x E[formation xp]`, and each member gets a quarter of the party's total.
  - The level comes from `src/entities/ExperienceTable.ts`.
  - The expected level at each boss (or stage end) must be inside the stage's band.
  - The cumulative gold at each town's arrival must be at least 50 % of the cost of 4 members' stage kit.
  - Each `grind` must be in [1.0, 3.0], so a stage can't simply declare its way into its band.
- **(e) No early shops.** For every map with a shop keeper (`shopId`), let T be the stage whose `maps` own it. The
  first state in which a keeper becomes talkable must already have every stage in `after(T)` complete. A town found
  too early gets a gate or a patch: the J2 floe and the WIND landing field (3.2) exist for exactly this. Mutating
  either one must make (e) fail.

### 5.3 CLI and output

```
npm run quest -- [--strict] [--mutate] [--stage S11] [--json /tmp/<agent>/quest.json]
quest-verify: 27 stages (S0 built, 26 pending), 412 places, 38 events
(a) order: OK  S0 S1 S2 S3 S4 ...
(b) skips: OK  (312 withheld runs, 0 reach a later stage)
(c) soft-locks: OK  (4118 states, every one reaches CHAOS_DEFEATED)
(d) bands: OK  garland L2.9 [2,3]  pirate L4.6 [3,6] ...
(e) early shops: OK  (9 shop towns)
mutations: OK  (97 load-bearing gates, each removal reported)
quest-verify: OK
```

These numbers are only an example. Any violation exits 1 with a line such as
`SKIP S6 astos reachable without S5 (crown): <path>`, `SOFTLOCK <state> via <path>`,
`BAND S13 lich L14.2 outside [16,19]` or `DOCK overworld (130,12) basin inner not allowed`.
`tests/progression/questGraph.test.ts` runs the same checks inside `npm test`.

### 5.4 Mutation tests

`--mutate` removes one load-bearing element at a time and re-runs proofs (a)-(e). A mutation is caught when any
proof fails: a SKIP, a SOFTLOCK, an early shop, a band failure, or the goal becoming unreachable (for example, a
removed dock that strands the ship). The elements are:

- a gate cell;
- a transition's `requiredFlag(s)`;
- a patch;
- a dock;
- a vehicle spawn's `requiredFlag(s)`;
- an NPC `showIf`, `hideIf` or `requiredItem` on a gift, trade, boss or cutscene NPC;
- a scripted encounter's `requiredFlag(s)`;
- a basin wall cell (J1 strip, J2 walls, the J2 floe);
- a landing-field patch (`wnd_calm`).

- **Opening patches** (`north_bridge`, `canal`, `strait_thaw`, `wnd_calm`) open terrain, so removing one only
  closes a path. Their mutation instead **forces the patch on from the start**. Forcing `north_bridge` or `canal` on
  must fail (b). Forcing `strait_thaw` on must fail (e) (Crescent Lake's shops become reachable before S13), and so
  must forcing `wnd_calm` on (Gaia's shops before S21). `questMutate.test.ts` asserts both (e) failures by name.

An element that changes nothing must be listed in its stage's `nonLoadBearing` with a reason; otherwise the run
fails.
`tests/progression/questMutate.test.ts` runs the mutations on the fixtures and, from Q9 on, on the real world.

### 5.5 Scripted walk-throughs per region

- **Model walk:** each stage's `walk` in `quest.yaml` is the region's scripted walk-through: event ids such as
  `pravoka:npc:pravoka-captain` and `overworld:dock:a1_pravoka`.
  `tests/quest/<prefix>/walk.test.ts` replays it through the model. It asserts that the stage's grants appear after
  the last step and that no later stage's grant is reachable at that point.
- **Field walk:** the `q<n>_<stage>_start` scenarios are the same walk in the real game (5.6).

### 5.6 Browser play-test checkpoints

- **Setup:** `npm run dev -- --host 127.0.0.1 --port <tranche port> --strictPort` (4.0), then
  `http://127.0.0.1:<port>/?mute=1&scenario=<id>`. Every URL includes `mute=1`.
  Assertions read `window.__game` (dev; `src/main.ts:19`).
- **Per tranche:** at least one checkpoint per stage, each recorded in its result with a screenshot path under
  `/tmp/<tranche>/`. Examples:

| Stage | Scenario | Steps | Pass when |
|---|---|---|---|
| S1 | `q2_bridge_king` | talk to the King, then walk north over the bridge | `__game.gameFlags.has('BRIDGE_BUILT')`, and the party stands on a former gap cell |
| S2 | `q2_pravoka_captain` | talk to the captain, win, walk to the dock | BIKKE_DEFEATED; the ship sprite is at the dock; stepping onto it puts the party on water in mode `ship` |
| S2 (negative) | `q2_pravoka_start` (no BIKKE_DEFEATED) | walk to the dock | no ship sprite; the party cannot step onto water |
| S10 | `q4_dwarf_start` | trade `tnt`, then sail into the canal | CANAL_OPEN; the canal cells are walkable in mode `ship` |
| S14 (negative) | `q4_melmond_ship` (CANAL_OPEN, no EARTH_CRYSTAL_LIT) | sail east to the strait | the floe blocks the ship; Crescent Lake can't be reached |
| S17 | `q5_desert_start` | trade `sky_stone`, board, fly, land on grass, try a forest | AIRSHIP_RAISED; the landing works; on a forest cell the airship says "The airship can't land here." |
| S26 | `q8_chaos_door` | talk to Chaos | the battle starts with enemy `chaos` and the `rim` background |

### 5.7 When it runs

- **After every edit to a `world_*.py` or a region map:** the layout, `build_map.py overworld <ids>`, then
  `npm run quest`.
- **At the end of a tranche:** all of section 7.
- **At integration:** `--strict --mutate`.
- **Always:** `questGraph.test.ts` is part of `npm test`, so every gate runs it.

## 6. Balance

### 6.1 Level, gear and magic curve per region

The caps are the highest stats sold in shops. Found gear may exceed them by at most 1 band.

| Band | Town (stage) | Party level | Magic sold | Weapon atk | Body def | Shield def | Helm def | Inn |
|---|---|---|---|---|---|---|---|---|
| B1 | Cornelia (S0, built) | 1-3 | L1 | 12 | 15 | 2 | 1 | 30 |
| B2 | Pravoka (S2) | 3-6 | L2 | 16 | 15 | 4 | 3 | 50 |
| B3 | Elfheim (S4) | 5-13 | L2-L3 (existing) | 23 | 24 | 4 | 3 | 100 |
| B4 | Melmond (S11) | 13-19 | L3-L4 (existing) | 23 | 34 | 8 | 6 | 200 |
| B5 | Crescent Lake (S14) | 17-25 | L5 | 26 | 34 | 8 | 6 | 300 |
| B6 | Onrac (S20) | 25-30 | L6 | 30 | 38 | 12 | 8 | 500 |
| B7 | Gaia (S22) | 28-34 | L7 | 34 | 42 | 14 | 10 | 700 |
| B8 | the sky-folk village (S22) | 28-34 | L8 (+ L7) | - | - | - | - | 900 |
| found | the past temple (S26) | 34-41 | - | `masamune` 56 | `dragon_armor` 42 | - | - | - |

### 6.2 Boss balance tests

Each boss test is seeded (`mulberry32`, 400 seeds per policy) and uses the real `BattleStateMachine`, with the
`q_*` kit and potions. Each tranche measures its values and then pins each bound 3 points from the measured value,
writing the measured value in the test name (the existing rule). A measured value must fall inside the design
target; otherwise the tranche tunes the boss's `bossPhases` or `ai` (its own records only) or the formation.

| Boss | File | Test level | Target, sensible policy | Must also hold |
|---|---|---|---|---|
| pirate x9 | `q2_a1.test.ts` | 4 | >= 95 % | careless >= 85 % |
| piscodemon x3 | `q3_elf.test.ts` | 9 | 75-95 % | Lv 7 <= 60 % |
| astos | `q3_elf.test.ts` | 11 | 65-85 % | Lv 9 <= 50 % |
| vampire | `q4_earth.test.ts` | 14 | 75-95 % | Lv 12 <= 60 % |
| lich (Rime Sovereign) | `q4_earth.test.ts` | 17 | 60-80 % | Lv 15 <= 45 % |
| evil_eye | `q5_fire.test.ts` | 22 | 70-90 % | - |
| ashen_queen | `q5_fire.test.ts` | 23 | 60-80 % | Lv 21 <= 45 % |
| dragon_zombie | `q6_water.test.ts` | 25 | 75-95 % | - |
| drowned_sovereign | `q6_water.test.ts` | 28 | 60-80 % | Lv 26 <= 45 % |
| hollow_seraph | `q7_wind.test.ts` | 32 | 60-80 % | Lv 30 <= 45 % |
| the 4 refights in a row (no inn, 4 potions each) | `q8_past.test.ts` | 37 | 60-85 % for the run | each fight alone >= 85 % |
| death_eye | `q8_past.test.ts` | 37 | 70-90 % | - |
| chaos | `chaos.test.ts` (exists) | 40 | unchanged | unchanged |

### 6.3 Zone and floor tests (per tranche)

- **Single fights:** at band low, with the previous band's kit, the party wins at least 95 % of single fights in
  every walking zone of the stage.
- **Floor runs:** the party survives a `floorRun` of the expected fights of each dungeon floor (from 5.2 d), with no
  inn and 3 potions, in at least 80 % of runs.
- **Regions differ:** each zone's species set differs from its neighbour's (the existing W5 rule).

### 6.4 Campaign curve (Q9)

`tests/balance/questCurve.test.ts` plays seeded battles along the verifier's witness walk:

- the number of battles per stage comes from 5.2 (d);
- shopping happens at each town up to that town's `q_*` kit;
- there is an inn rule.

It asserts:

- the median whole-party level at each boss is inside the band;
- the median at Chaos's door is in [38, 41];
- wipes stay under 0.2 per stage.

## 7. Gates per tranche

The `<owned ids>` are the tranche's map ids; `<region>` is its `world_api` region id. Q1 tranches run the parts that
apply to them: G3 is for the regions only (Q1b is exempt, 4.3), and G5 runs in assume mode until Q9.

| Gate | Command | Expected |
|---|---|---|
| G1 layouts are deterministic | `for s in <owned layout scripts>; do python3 -I "$s" \|\| exit 1; done; python3 -I assets-src/tools/layouts/world.py && git diff --exit-code assets-src/maps` (after committing) | exit 0, with no diff |
| G2 compile and determinism | regions: `python3 -I assets-src/tools/build_map.py overworld --region <region> <owned ids>` then `python3 -I assets-src/tools/build_map.py --check-determinism --region <region> overworld <owned ids>`. Q1b and the integrator run the full world without `--region`. All of it runs under the compile lock | each id prints `<id>: WxH -> assets/maps/ai/<id>.yaml`, then `<id>: deterministic`; exit 0 |
| G3 chunk locality | `python3 -I assets-src/tools/layouts/world.py --owned-chunks <region> > /tmp/<t>/owned.txt; git diff --name-only "$(git merge-base mainline HEAD)" HEAD -- assets/maps/ai/overworld/ \| grep -vxFf /tmp/<t>/owned.txt` (`--owned-chunks` prints repo-relative paths, including the region's `patch_*.png`) | no output (grep exits 1) |
| G4 build and tests | `npm run build && npm test` | build exits 0; Vitest reports 0 failed |
| G5 gap verifier | Q1: `npm run quest -- --mutate`. Q2-Q8: `for s in <the tranche's stages>; do npm run quest -- --mutate --stage "$s" \|\| exit 1; done` (for example Q4: S10 S11 S12 S13). Q9: `npm run quest -- --strict --mutate` | every run ends with `quest-verify: OK`; exit 0 |
| G6 asset coverage | `npx vitest run tests/data/assetCoverage.test.ts` | all passed |
| G7 file-size ceilings | `npx vitest run tests/data/fileCeilings.test.ts tests/data/questCeilings.test.ts` | all passed |
| G8 compiler self-test (Q1b, or after any compiler change) | `python3 -I assets-src/tools/build_map.py --selftest` | exit 0 |
| G9 balance | `npx vitest run tests/balance/ && npx vite-node scripts/check-bounds.ts tests/balance/q*.test.ts`. Every new test name carries its measured value, as `(measured 82.5)`, and its bound. The script parses both and checks the margin | all passed; then `check-bounds: OK (<n> tests)`: every bound is at least 3 points from its measured value (at least 2 rounds for round counts, D-C7-19), and no new test lacks a `measured` tag |
| G10 browser | the tranche's 5.6 checkpoints, with `mute=1` on every URL | every row passes, with a screenshot path |
| G11 clean tree | `git status --porcelain` before the commit | only the tranche's owned paths; no scratch files |
| G12 originality | `npx vitest run tests/quest/designNotes.test.ts tests/quest/originality.test.ts`, plus the reviewer sign-off (4.6) | all passed; the result has `originality review: PASS <map ids>` and the self-check numbers |

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | `ExplorationScene.ts` (601 / 601), `types/index.ts` and `schemaValidation.ts` grow | Q1a extracts code before adding any. New types go in `types/quest.ts` and new validators in `schemaValidationQuest.ts`. G7 |
| R2 | Streaming pops chunks in at airship speed | prefetch in the direction of travel, a cap of 60 textures, a miss rule (a hold of at most 6 frames, then a placeholder); `bakedStreaming.test.ts`; a Q10 checkpoint |
| R3 | Regenerated chunks bloat git (about 57 MB of new chunk images, plus churn) | boxes aligned to chunks; G3 locality; one regeneration per merge |
| R4 | The generated `overworld` files conflict on every merge | they are never hand-merged; they are regenerated (4.0) |
| R5 | A basin leaks (the ship reaches the Inner Sea before CANAL_OPEN), or late seas are met early | composer basin checks; the verifier's (b); mutation of the J1 and J2 walls. Early late-tier seas are accepted (no landing) |
| R6 | Chaos is tuned for level 40, and the classic curve arrives lower | the curve model (5.2 d) and `questCurve.test.ts`; Open question 1 |
| R7 | Placeholder icons, recoloured caves and tinted NPCs look rough | accepted for pass Q; an optional later art pass (Open question 2) |
| R8 | The verifier drifts from runtime behaviour | the game and the verifier both call `src/systems/fieldRules.ts` (`fieldStep` and friends) and no other field rule; the verifier has its own fixtures, and the browser checkpoints test the same gates in the game |
| R9 | New spell effects (death, stone) shift existing balance | early shops can't sell them; all of `tests/balance/` stays green (G9) |
| R10 | The world compile (about 90 s, x2 for determinism) slows iteration | iterate with plain compiles; run determinism at the gate only |
| R11 | Classic layouts get copied | the design notes, the self-checks, the phrase test, and a reviewer sign-off on every tranche (4.6, G12) |
| R12 | The kneel pass has not landed, or conflicts | Q1-0 starts only from the kneel merge head; pass Q never touches the K files |
| R13 | A consumed item or a one-way pit soft-locks the game | the verifier's (c), plus EXIT on every dungeon |
| R14 | Compile memory: about 21-25 GB for the full world, on a 48 GiB machine | the compile lock; `--region` compiles (about 7 GB); full compiles only by Q1b and the integrator (3.5, 3.6) |
| R15 | Per-chunk seeding regresses the act-1 look or misses an RNG | the one-off re-baseline in Q1b; the locality selftest; G3 on every tranche |
| R16 | Two dev servers or Vite caches clash | per-tranche ports with `--strictPort`; `npm ci` per worktree (4.0) |

## 9. Open questions (each has a default the orchestrator applies)

The user accepted defaults 1-5 as written (rev 2).

1. **Chaos's arrival level.** Default: keep U-2 (level 40) and leave Chaos's stats alone.
   - If `questCurve` puts the median below 38, Q9 scales the `xpReward` of the past-temple roster and the four
     refights by at most 2x, and raises S26's `grind` to at most 3.0.
   - If that is still not enough, Q9 records the gap in its result and stops for the user.
2. **New art.** Default: 0 paid images in pass Q. That means code-drawn landmarks and vehicles, kit recolours and
   tinted NPC sheets. A later optional pass with Stability Core could cover overworld landmarks and about 6 NPC
   kinds (elf, dwarf, sky folk, giant, dragon king, automaton), at 12 Bedrock images or fewer.
3. **The class change.** Default: optional, as in the classic. The balance tests from S20 on use upgraded classes.
4. **The act-1 ending text.** Default: remove the "completed the introduction" lines. The King's scene rebuilds the
   bridge (S1).
5. **Names.** Default:
   - keep the names existing data fixes: Pravoka, Elfheim, Melmond, Crescent Lake, Onrac, Gaia, Matoya, the Elf
     Prince, the Western Keep, the Marsh Cave, the Cavern of Earth, Bikke (the flag), the sky fortress;
   - every other place and character gets an original name. Generic words (crown, rod, cube, chime, canoe) stay.

## 10. TODOs

- [ ] W0: Q1-0 contract: types, schema, flags, `quest.yaml`, anchors, `world_api` boxes, `questCeilings`, the act-1 `fieldRules` (priority: high, effort: 4h)
- [ ] W1: Q1a field engine: vehicles, patches, trades, item conditions, hazards, EXIT/WARP, zone modes, save v2 (priority: high, effort: 14h)
- [ ] W1: Q1b toolchain, with per-chunk RNG, `--region`, the compile lock and per-region checks: legend, Lake, patch art, remaps, placeholder landmarks, composer, streaming (priority: high, effort: 14h)
- [ ] W1: Q1c data canon: key items, band gear, L5-L8 spells, kits, shop sections, bestiary habitats, helpers (priority: high, effort: 10h)
- [ ] W1: Q1d verifier, with proof (e) and the originality tests: model, proofs (a)-(d), CLI, mutation, fixtures (priority: high, effort: 12h)
- [ ] W2: Q2 A1: bridge, Pravoka, pirates, ship, Matoya (priority: high, effort: 10h)
- [ ] W2: Q3 ELF: Elfheim and its castle, Marsh Cave, Western Keep (priority: high, effort: 14h)
- [ ] W2: Q4 EARTH: dwarf mine and canal, Melmond, Cavern of Earth, giant, sage (priority: high, effort: 16h)
- [ ] W2: Q5 FIRE: Crescent Lake and canoe, sun temple, ice cavern, airship (priority: high, effort: 16h)
- [ ] W2: Q6 WATER: trial keep, dragon king, Onrac, waterfall, Sea Shrine (priority: high, effort: 16h)
- [ ] W2: Q7 WIND: Gaia, the sky-folk village, Mirage Tower, sky fortress (priority: high, effort: 16h)
- [ ] W2: Q8 PAST: time gate, past temple, refights, Chaos, ending (priority: high, effort: 10h)
- [ ] W3: Q9 integration: strict verify, quest curve, XP tuning, AGENTS.md (priority: high, effort: 8h)
- [ ] W4: Q10 play test, fix plan, momus review, fixes (priority: medium, effort: 10h)

## Results

<!-- Each tranche appends its result between its own pair of anchors; the integrator writes Q9. -->
<!-- === Q1 FOUNDATION (pass Q: owned by Q1-0..Q1d) === -->
<!-- === end Q1 === -->
<!-- === Q2 A1 (pass Q: owned by Q2) === -->
<!-- === end Q2 === -->
<!-- === Q3 ELF (pass Q: owned by Q3) === -->
<!-- === end Q3 === -->
<!-- === Q4 EARTH (pass Q: owned by Q4) === -->
<!-- === end Q4 === -->
<!-- === Q5 FIRE (pass Q: owned by Q5) === -->
<!-- === end Q5 === -->
<!-- === Q6 WATER (pass Q: owned by Q6) === -->
<!-- === end Q6 === -->
<!-- === Q7 WIND (pass Q: owned by Q7) === -->
<!-- === end Q7 === -->
<!-- === Q8 PAST (pass Q: owned by Q8) === -->
<!-- === end Q8 === -->
<!-- === Q9 INTEGRATION (pass Q: owned by the integrator) === -->
<!-- === end Q9 === -->

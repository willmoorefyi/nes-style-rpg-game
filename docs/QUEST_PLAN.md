# Main quest build-out plan (pass Q), rev 1

Status: rev 1. Nothing is implemented. Pass Q starts only after the kneel pass (`docs/KNEEL_PLAN.md`) has merged
into `mainline` and `npm test` is green at that head. Q1-0 is the first step. Facts in section 1 were checked at `b236b79`.

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
    "`npm run quest -- --strict --mutate` prints `quest-verify: OK`, with each proof (a)-(d) OK",
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
| G1 No disembark, docks, parking, vehicle sprites or save state | 1.4 | Q1a |
| G2 No terrain change on a flag (bridge, canal) | 1.3 | Q1-0 types, Q1a runtime, Q1b compiler |
| G3 No AND of flags; no item conditions; no NPC trade; cutscenes can't give or take items | `types/index.ts:193-250`, `cutscenes.yaml:1-6` | Q1-0, Q1a |
| G4 Canoe vs ocean vs lake are not told apart | 1.4 | Q1-0 (`TerrainType.Lake = 11`), Q1b, Q1a |
| G5 A big world loads every chunk | 1.1 | Q1b streaming |
| G6 No sea or river encounters | `ShipMode.ts:17` | Q1a (zone `modes`) |
| G7 Spells L5-L8 and late gear are missing | 1.5 | Q1c |
| G8 Class upgrade is tied to EARTH_CRYSTAL_LIT | 1.4 | Q1a (data-driven `requiredFlag`) |
| G9 `ExplorationScene.ts` is at its 601 / 601 ceiling; `types/index.ts` (419) and `schemaValidation.ts` (378) are over 250 | AGENTS.md | Q1-0 / Q1a extract first |
| G10 Asset coverage reads only the legacy maps' NPC sprites | `tests/data/assetCoverage.test.ts:56-59` | Q1a |

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
| `breath_pearl` | S20 Onrac chain, Q6 | the Sea Shrine dive (S21) | no |
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
| S14 | Crescent Lake and the canoe | Q5 | S13 | EARTH_CRYSTAL_LIT | CANOE_GIVEN, `canoe` | 17-20 | - | land: ankheg, ochu, neochu, hydra; river (canoe): red_piranha, crocodile, white_crocodile |
| S15 | The sun temple (5 floors) | Q5 | S14 | `canoe` | FIRE_CRYSTAL_LIT | 21-24 | ashen_queen | horned_devil, pyrolisk, fire_elemental, fire_hydra, lava_worm, hellhound, fire_lizard, fire_gigas, dragon |
| S16 | The ice cavern (3 floors) | Q5 | S14 | `canoe` | EVIL_EYE_DEFEATED, `sky_stone` | 21-24 | evil_eye | white_dragon, winter_wolf, mindflayer, ice_gigas, specter, remorazz, dark_wizard |
| S17 | The airship | Q5 | S16 | `sky_stone` | AIRSHIP_RAISED, airship | 22-25 | - | desert_baretta, sabertooth, wyvern, wyrm, manticore, baretta, basilisk, allosaurus, sand_worm |
| S18 | The trial keep (3 floors) | Q6 | S17 | airship | ORDEALS_GUARD_DEFEATED, `ordeal_seal` | 24-27 | dragon_zombie | weretiger, minotaur_zombie, king_mummy, medusa, rakshasa, clay_golem, nightmare |
| S19 | The dragon king (class change) | Q6 | S18 | `ordeal_seal` | CLASS_UPGRADED | 24-27 | - | - |
| S20 | Onrac and the waterfall | Q6 | S17, S14 | airship, `canoe` | `cube`, `breath_pearl` | 25-28 | - | land: nightmare, weretiger; sea: sahagin_prince, white_shark, deepeyes, sea_snake |
| S21 | The Sea Shrine (5 floors) | Q6 | S20 | `breath_pearl` | WATER_CRYSTAL_LIT, `tide_tablet` | 27-30 | drowned_sovereign | sahagin_prince, deepeyes, sea_snake, sea_scorpion, sea_troll, ghost, water_elemental, water_naga |
| S22 | Gaia and the sky-folk village | Q7 | S17, S21 | airship, `tide_tablet` | `chime` | 28-31 | - | tyrannosaur, chimera, green_dragon |
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
    status: pending             # pending | built
basins:                         # ocean basins: a seed cell per basin; docks name their basin
  outer: [76, 40]
  inner: [120, 120]
nonLoadBearing: []              # gates that may be removed without a skip: [{map, kind, at, reason}]
```

## 3. World map design

### 3.1 Decision: one world map, streamed, composed from region modules

| Option | Pro | Con |
|---|---|---|
| **A. One 240x176 map, composed (chosen)** | One sea, so ship and airship routes are continuous. The verifier has one world graph. Act-1 coordinates are kept | Needs chunk streaming (G5). The generated files are shared, so they are regenerated on every merge |
| B. A map per continent, linked by sea-edge warps | No streaming; no shared generated files | Vehicles must cross map edges (new engine work), the world feels cut into pieces, and edge warps are a new source of skips |

With A, agents still work independently. Each one edits only `layouts/world_<region>.py` and its own helpers, and its
box is aligned to the 16-cell chunk grid. A box's art changes therefore only touch its own chunk files, and gate
G3 checks that.

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
- **Airship-only land:** WATER and WIND have no docks. Their places sit on grass that a ring of mountains or forest
  seals from every coast.

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
    `vehicles`, `battleBackgrounds.zones` and `notes`.
  - All coordinates in a `RegionOut` are world coordinates inside the box.
- **`layouts/world.py`** is the only writer of `assets-src/maps/overworld.yaml`. It runs `REGIONS = [a1, elf, wind,
  water, earth, fire]` (pre-seeded; no tranche edits the list) and then the global checks, in this order:
  1. every module stays in its box and every ring is ocean (except J1 and J2);
  2. ids are unique and prefixed;
  3. the Inner Sea is cut off from the Outer Sea with every patch off, and joined to it with `canal` on;
  4. every dock lies in its declared basin.
- **`world.py --owned-chunks <region>`** prints the chunk file names a region may change.
- **`overworld.py` becomes a library.** Q1b moves its `main()` document into `world_a1.py`, and `main()` becomes a
  shim that calls `world.main()`. `build()`, `objects()` and `check()` stay and still enforce the act-1 promises.
  The file stays at or under 249 lines.
- **Stubs:** until a region merges, its module returns an ocean box (A1 returns the act-1 block). The verifier
  assumes the grants of `pending` stages (5.1).

### 3.6 Chunk and size cost

| Item | Size | Chunks | Disk (estimate) | Resident GPU |
|---|---|---|---|---|
| World `overworld` | 240x176 | 15x11 = 165 below (above about 10 %) | about 27 MB (at 164 KB per chunk, measured on today's overworld) | at most 24 textures with streaming, about 57 MB (768x768 RGBA = 2.36 MB); about 390 MB without |
| About 105 new region maps | towns about 40x32 (6 chunks), floors about 32x32 (4), interiors 1 | about 300 | about 30 MB (Cornelia is 2.4 MB for 39 files, the temple 484 KB for 4) | per map, as today (all chunks) |
| World compile | - | - | - | about 90 s (10.5 s x 8.1 area); `--check-determinism` about 3 min |

## 4. Tranches

### 4.0 Order, worktrees, merging

```
K (kneel) merged -> Q1-0 contract (serial) -> Q1a | Q1b | Q1c | Q1d (parallel) -> Q1 merge
  -> Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 (parallel, one worktree each) -> Q9 integration and curve -> Q10 play test and fixes
```

- **Worktrees:** `git worktree add ../ff-game-<t> -b q-<t> mainline`, created at the Q1 merge head. Scratch work
  goes in `/tmp/<tranche>/`.
- **One integrator** (the orchestrator) merges with `git merge --no-ff q-<t>`, in the order the tranches go green.
  It stages paths explicitly and never uses `git add -A`.
- **Generated files are never hand-merged.** These are `assets-src/maps/overworld.yaml`,
  `assets/maps/ai/overworld.yaml`, `assets/maps/ai/overworld/*` and `assets/maps/ai/index.yaml`. On a conflict the
  integrator:
  1. takes either side;
  2. runs `python3 -I assets-src/tools/layouts/world.py && python3 -I assets-src/tools/build_map.py overworld`, plus
     the merged tranche's ids for `index.yaml`;
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
| `assets/data/quest.yaml` | Q1-0 creates it | edit only their own stages' entries |
| `items.yaml`, `spells.yaml`, `kits.yaml`, `bestiary.yaml` | Q1c | regions: append inside their own anchor only (a missing item, or their own `q_*` kit) |
| `shops.yaml`, `cutscenes.yaml`, `debug-scenarios.yaml` | anchors from Q1-0 | regions: their own anchor. Q2 may also edit `act1_complete` |
| `enemies.yaml` | nobody by default | a region edits only its own bosses' `bossPhases`, `ai` and `specials`. Only Q9 changes `xpReward` and `goldReward` |
| `build_map.py`, `kit.py`, `map_checks*.py`, `world.py`, `world_api.py`, `BakedMapRenderer.ts` | Q1b | none; a needed change goes to the integrator as `BLOCKED: <need>` |
| `src/progression/**`, `scripts/quest-verify.ts`, `package.json` | Q1d | none (a bug goes to the integrator) |
| `tests/helpers/**` | Q1c, Q1d | none; a region adds a local helper in `tests/quest/<prefix>/` |
| `src/scenes/ExplorationScene.ts`, `src/scenes/exploration/**`, `src/entities/*Mode.ts`, `src/systems/*` | Q1a | none |
| `AGENTS.md` | the integrator (Q9) | each tranche writes an "AGENTS.md delta" in its result section |
| `assets/backgrounds/<id>.webp` | the tranche listed in 4.6 per id | - |

### 4.1 Q1-0 Contract (integrator, serial, effort 3 h)

**Owns:**

- `src/types/quest.ts`, with `export *` added to `types/index.ts` (+1 line);
- `src/core/schemaValidationQuest.ts`, which `schemaValidation.ts` calls (+2 lines);
- `src/core/GameFlags.ts`;
- `assets/data/quest.yaml`;
- the anchors;
- `assets-src/tools/layouts/world_api.py` (`BOXES`, `J1`, `J2` and the dataclasses only);
- `tests/data/questCeilings.test.ts`.

**Types** (validated, with no behaviour yet):

- `TerrainType.Lake = 11` (10 stays the compiler's counter value);
- `MapPatch {id, flag, cells: [x, y, terrain][]}`, plus `BakedMapArt.patches?: {id, image, x, y, w, h}[]`;
- `Dock {x, y, basin}`;
- `Hazard {rects, damage, flag?}`, plus `MapData.exit?: {map, entrance}`;
- `requiredFlags?: string[]`, where all must be set, on `KeyItemGate`, `MapTransition`, `ScriptedEncounter`,
  `VehicleSpawn` and `NPCCutscene`;
- `ConditionalDialog.condition` may be `item:<id>`;
- `MapNPC.requiredItem`, `takeItem`, `tint`, `actionFlag`;
- the cutscene steps `give_item {item}`, `take_item {item}`, `set_vehicle {vehicle, map, x, y}`;
- `EncounterZone.modes` and `name`;
- `SaveData.version 2`, plus `vehicles` and `mode`;
- `DebugScenario.vehicles` and `mode`.

**Done when:** `npm run build` and `npm test` pass, and `questCeilings.test.ts` asserts that every file under
`src/progression/`, `src/types/quest.ts`, `assets-src/tools/layouts/world*.py` and the region layout directories
has fewer than 250 lines, apart from the AGENTS.md exceptions.

### 4.2 Q1a Field engine (TS, effort 14 h)

**Owns:**

- `src/scenes/ExplorationScene.ts`: **extract first** into `src/scenes/exploration/FieldVehicles.ts` and
  `FieldNpcActions.ts`, and end at 590 lines or fewer;
- `src/scenes/exploration/**`, `src/entities/*Mode.ts`, `src/systems/{VehicleManager, KeyItemGateSystem,
  NPCInteraction, CutsceneManager, CutsceneRegistry, ClassUpgradeSystem, SaveManager, DebugScenarioLoader,
  FieldSpellEffects, EncounterSystem, MapTransition}.ts`, `src/rendering/CollisionMap.ts`;
- `assets-src/vehicles.py` (new, code-drawn ship and airship sprites, 0 images) and the `vehicles` stage in
  `build_assets.py`;
- `tests/data/assetCoverage.test.ts`.

**Work:**

- **Vehicles:** everything in 3.3, plus the sprites and save v2.
- **Patches:** `CollisionMap` overrides a cell's terrain while the patch's flag is set.
- **AND gates:** `requiredFlags` in every gate check.
- **Dialog conditions on items:** `item:<id>` conditions.
- **NPC trade:** if `requiredItem` is held and `giftFlag` is not set, the NPC shows its dialog, takes the item when
  `takeItem` is set, gives `giftItem` and sets `giftFlag`.
- **NPC tint:** a PixiJS `tint` on the NPC sprite.
- **Class upgrade:** `classUpgrade` reads `actionFlag`; the old EARTH_CRYSTAL_LIT rule is removed and its tests
  are updated.
- **Hazards:** each walking step on a hazard cell takes `damage` HP from every living member, but never below 1 HP,
  with a red flash.
- **Field EXIT / WARP:** EXIT goes to `MapData.exit`; WARP goes back to the previous floor's arrival cell.
- **Zone `modes`.**
- **Asset coverage:** the test also reads the compiled maps' NPC sprites. New NPCs must use one of the 24 existing
  field sheets, plus `tint`.

**Tests (RED first):**

- `tests/systems/vehicles*.test.ts`: dock, disembark, board, park, land, save and load;
- `tests/systems/patches.test.ts`, `npcTrade.test.ts`, `hazards.test.ts`;
- the act-1 tests unchanged, apart from the class-upgrade tests.

### 4.3 Q1b Map toolchain and streaming (Python and renderer, effort 14 h)

**Owns:** `build_map.py`, `kit.py`, `map_checks*.py`, `map_graph.py`, `layouts/world.py`, `world_api.py` (logic),
the `world_<region>.py` stubs, `world_a1.py` (moved from `overworld.py main()`), `overworld.py` (shim),
`src/rendering/BakedMapRenderer.ts`, and the act-1 overworld tests where the move changes them (the width and the
canoe spawn).

**Work:**

- **Legend and terrain:**
  - `w` swamp (TerrainType.Swamp, a soft material, a placeholder texture);
  - Lake compiles to 11;
  - `BLOCKED` adds 11.
- **Passthrough:** `docks`, `patches`, `hazards` and `exit` pass through to the compiled map.
- **Patch art:**
  - each patch's cells and objects are baked into `assets/maps/ai/<id>/patch_<pid>.png`;
  - a check fails if the overlay is not opaque on every patch cell.
- **Material remaps** take `hue` and `sat` as well as `shade`. Named presets: `cave` (brown temple stone), `ice`,
  `lava` (an orange rubble floor), `sky` (slate castle), `coral` (teal castle).
- **Placeholder landmarks** in `kit.py` (code-drawn, labelled): `cave_mouth`, `tower`, `volcano`, `shrine`,
  `dock_post`, `buried_hull`, `sky_ring`.
- **The world composer** and its global checks (3.5).
- **Map checks:** `no_unreachable_walkable` takes `reach_roots`, so every region names its entrances.
- **Streaming:** for a map of more than 64 chunks, `BakedMapRenderer` loads the chunks under the view plus a ring of
  1 chunk, prefetches 1 more chunk in the direction of travel, and frees the rest (LRU). At most 24 textures are
  resident. A small map loads every chunk, as today.

**Tests:**

- `build_map.py --selftest` covers the new legend, patches, remaps and docks;
- `tests/rendering/bakedStreaming.test.ts`: a world sweep at airship speed keeps at most 24 resident textures, and
  the cells under the view are loaded before the first frame;
- the act-1 overworld tests pass at the act-1 coordinates.

### 4.4 Q1c Data canon (effort 10 h)

**Owns:**

- `items.yaml`: the key items of 2.1 and the gear for every band in 6.1;
- `spells.yaml`: levels 5-8, 30 spells, with every enemy spell id resolvable;
- `src/battle/spellEffectsLate.ts` (new): the death, stone, all-target stun, full-revive and multi-status-cure
  effects. `SpellExecutor.ts` gets at most 2 dispatch lines and stays within its 314 ceiling;
- `kits.yaml`: a `q_<stage>` kit for every band;
- `bestiary.yaml`: habitats come from the manifest and the zone `name`;
- the `shops.yaml` sections: the Elfheim and Melmond records move into the Q3 and Q4 anchors with their ids
  unchanged;
- `tests/helpers/balanceData.ts`: `bossWinRate(ids, level, kit, policy, seeds)` and `floorRun(zoneTable, fights,
  level, kit)`;
- `tests/data/gearBands.test.ts`, `tests/data/rosterCoverage.test.ts` (it reports in Q1, and fails only with
  `QUEST_STRICT=1`, which Q9 sets).

**Done when:**

- `crossFileValidation`, `spellEffects`, `MagicShopScene` and every balance test are green;
- `gearBands.test.ts` passes. It checks three things:
  - every shop item is within its town's caps;
  - each band adds at least one upgrade for each base class (exemptions listed in the test);
  - no item stronger than its band appears in an earlier shop.

### 4.5 Q1d Progression-gap verifier (TS, effort 12 h)

**Owns:**

- `src/progression/{questData, questPlaces, questEvents, questSearch, questProofs, questCurve, questMutate,
  questReport}.ts` (pure TS, no PixiJS);
- `scripts/quest-verify.ts`;
- the `"quest": "vite-node scripts/quest-verify.ts"` script in `package.json`;
- `tests/progression/*.test.ts`;
- `tests/fixtures/quest/` (tiny synthetic worlds).

**Work:** section 5. **Done when:**

- each proof fails on a fixture built to break it (RED), and passes on a clean fixture;
- on `mainline` (S0 built, the rest pending) `npm run quest -- --mutate` prints `quest-verify: OK`.

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
- **Originality:** no map copies a classic floor plan, town plan or world position, and the dialogue and event
  staging are written new. The Q10 reviewer signs this off per map id.
- **Done when:** all the section 7 gates pass. The tranche also appends its `Q<n> result` (gates output, measured
  balance values, AGENTS.md delta) inside its anchor here.

### 4.7 Q2 A1: the bridge, Pravoka and Matoya (stages S1, S2, S3, S7; effort 10 h)

- **Owns:**
  - `layouts/world_a1.py`;
  - appends (new names only) in `overworld_consts.py` and `overworld_zones.py`;
  - `layouts/pravoka/*.py`, plus the maps `pravoka*` and `matoya-cave`;
  - the `act1_complete` cutscene;
  - backgrounds: none (it reuses the existing ones).
- **Bridge:**
  - `act1_complete` is rewritten: the King orders the span rebuilt, a fade, then `set_flag BRIDGE_BUILT`. The
    "completed the introduction" lines are removed (Open question 4).
  - Patch `north_bridge` turns the two gap rows and the stubs into Bridge, and its built span covers the debris.
  - The workers' lines change on BRIDGE_BUILT.
  - The act-1 tests that assert the old ending are updated, not deleted.
- **Pravoka:**
  - the town sits on the act-1 mainland's east coast, with the `outer` dock;
  - it has 6 shops and an inn (band B2, magic L2) and 2 houses;
  - the pirate captain (flag BIKKE_DEFEATED; the existing data names him Bikke, so the name may stay) starts
    `pirate` x9 through `npc`;
  - his `postVictoryCutscene` hands over the ship;
  - the ship spawn moves from the Cornelia jetty to the Pravoka dock.
- **Matoya's cave:** 1 floor on the mainland. Matoya trades `crystal_eye` for `herb` (`requiredItem`, `takeItem`),
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
- **`breath_pearl`:** an Onrac chain needs the airship and the canoe; Q6 writes it.
- **Sea Shrine:** the dive cell is a shore transition behind `keyItemGates requiredItem: breath_pearl`. On floor 5,
  `drowned_sovereign` sets WATER_CRYSTAL_LIT. A chest on floor 3 holds `tide_tablet`.
- **Zones:** `wat_isles`, `wat_sea` and `wat_streams`.

### 4.12 Q7 WIND: Gaia, the sky-folk village, the Mirage Tower and the sky fortress (S22-S24; effort 16 h)

- **Owns:** `world_wind.py`, `layouts/wind/*.py`, the maps `gaia*`, `highland*`, `mirage-1..3` and
  `sky-fortress-1..5`, and the backgrounds `sky_palace`, `tower_of_babel` and `throne_tiamat`.
- **Gaia:** the town has 6 shops (band B7, magic L7) and an inn, and its windmills stand still (lore).
- **The sky-folk village** (`highland`) is on an airship-only plateau, with 2 shops (magic L8) and an inn. Its
  translator takes `tide_tablet` and gives `chime`.
- **Mirage Tower:** 3 floors. The door is a `chime` gate. On the top floor a `cube` gate leads to the transition to
  `sky-fortress-1`, and the cutscene sets SKY_FORTRESS_OPEN.
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

It reuses the runtime's own semantics: `CollisionMap`, the movement modes, `npcPresent`, `resolveNPCDialog`, the
`KeyItemGateSystem` rules and `arrivalFor`.

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

**Pending stages** (assume mode): when a pending stage's `after` set is complete, the verifier fires one synthetic
event that grants its `grants`. With `--strict`, a pending stage is an error.

### 5.2 Proofs

- **(a) Order.** The saturation closure from a new game (Cornelia south gate, act-1 flags) reaches the goal. The
  verifier records the first state in which each stage's grants all hold. That order must be a linear extension of
  the `after` DAG, and the declared `walk` of each stage must run step by step from that state.
- **(b) No skip.** For every stage S and every ancestor P of S, the verifier disables the events that give P's
  grants and computes the closure again. Neither S's `boss` encounter nor any of S's grants may be reachable. It
  then does the same for each declared requirement r of S, so each requirement is shown to be necessary.
- **(c) No soft-lock.** BFS over states (5.1) covers trades that consume items and one-way transitions. From every
  reachable state, the goal must stay reachable.
  - If it is not, the verifier reports the state and the shortest path into it.
  - It also checks that every place reachable on foot has a route back to the world map or to the goal place.
  - It fails if any read flag is never set, or any gate item is never obtainable (a dead gate).
- **(d) Bands.** The curve model is deterministic, with no battles:
  - `fights_s = grind_s x Σ (path cells in zone z / mean steps per encounter of z)`, over the witness path from (a).
    The mean steps per encounter is `(min + max) / 2` of the zone's or map's `encounterRate`.
  - `xp_s = fights_s x E[formation xp]`, and each member gets a quarter of the party's total.
  - The level comes from `src/entities/ExperienceTable.ts`.
  - The expected level at each boss (or stage end) must be inside the stage's band.
  - The cumulative gold at each town's arrival must be at least 50 % of the cost of 4 members' stage kit.
  - Each `grind` must be in [1.0, 3.0], so a stage can't simply declare its way into its band.

### 5.3 CLI and output

```
npm run quest -- [--strict] [--mutate] [--stage S11] [--json /tmp/<agent>/quest.json]
quest-verify: 27 stages (S0 built, 26 pending), 412 places, 38 events
(a) order: OK  S0 S1 S2 S3 S4 ...
(b) skips: OK  (312 withheld runs, 0 reach a later stage)
(c) soft-locks: OK  (4118 states, every one reaches CHAOS_DEFEATED)
(d) bands: OK  garland L2.9 [2,3]  pirate L4.6 [3,6] ...
mutations: OK  (97 load-bearing gates, each removal reported)
quest-verify: OK
```

These numbers are only an example. Any violation exits 1 with a line such as
`SKIP S6 astos reachable without S5 (crown): <path>`, `SOFTLOCK <state> via <path>`,
`BAND S13 lich L14.2 outside [16,19]` or `DOCK overworld (130,12) basin inner not allowed`.
`tests/progression/questGraph.test.ts` runs the same checks inside `npm test`.

### 5.4 Mutation tests

`--mutate` removes one load-bearing element at a time and re-runs (a) and (b). It must report a SKIP or a
SOFTLOCK each time. The elements are:

- a gate cell;
- a transition's `requiredFlag(s)`;
- a patch;
- a dock;
- a vehicle spawn's `requiredFlag(s)`;
- an NPC `showIf`, `hideIf` or `requiredItem` on a gift, trade, boss or cutscene NPC;
- a scripted encounter's `requiredFlag(s)`;
- a basin wall cell (J1 strip, J2 walls).

An element that changes nothing must be listed in `nonLoadBearing` with a reason; otherwise the run fails.
`tests/progression/questMutate.test.ts` runs the mutations on the fixtures and, from Q9 on, on the real world.

### 5.5 Scripted walk-throughs per region

- **Model walk:** each stage's `walk` in `quest.yaml` is the region's scripted walk-through: event ids such as
  `pravoka:npc:pravoka-captain` and `overworld:dock:a1_pravoka`.
  `tests/quest/<prefix>/walk.test.ts` replays it through the model. It asserts that the stage's grants appear after
  the last step and that no later stage's grant is reachable at that point.
- **Field walk:** the `q<n>_<stage>_start` scenarios are the same walk in the real game (5.6).

### 5.6 Browser play-test checkpoints

- **Setup:** `npm run dev`, then `http://localhost:5173/?mute=1&scenario=<id>`. Every URL includes `mute=1`.
  Assertions read `window.__game` (dev; `src/main.ts:19`).
- **Per tranche:** at least one checkpoint per stage, each recorded in its result with a screenshot path under
  `/tmp/<tranche>/`. Examples:

| Stage | Scenario | Steps | Pass when |
|---|---|---|---|
| S1 | `q2_bridge_king` | talk to the King, then walk north over the bridge | `__game.gameFlags.has('BRIDGE_BUILT')`, and the party stands on a former gap cell |
| S2 | `q2_pravoka_captain` | talk to the captain, win, walk to the dock | BIKKE_DEFEATED; the ship sprite is at the dock; stepping onto it puts the party on water in mode `ship` |
| S2 (negative) | `q2_pravoka_start` (no BIKKE_DEFEATED) | walk to the dock | no ship sprite; the party cannot step onto water |
| S10 | `q4_dwarf_start` | trade `tnt`, then sail into the canal | CANAL_OPEN; the canal cells are walkable in mode `ship` |
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
apply to them: G3 is for Q1b and the regions, and G5 runs in assume mode until Q9.

| Gate | Command | Expected |
|---|---|---|
| G1 layouts are deterministic | `for s in <owned layout scripts>; do python3 -I "$s" \|\| exit 1; done; python3 -I assets-src/tools/layouts/world.py && git diff --exit-code assets-src/maps` (after committing) | exit 0, with no diff |
| G2 compile and determinism | `python3 -I assets-src/tools/build_map.py overworld <owned ids>` then `python3 -I assets-src/tools/build_map.py --check-determinism overworld <owned ids>` | each id prints `<id>: WxH -> assets/maps/ai/<id>.yaml`, then `<id>: deterministic`; exit 0 |
| G3 chunk locality | `python3 -I assets-src/tools/layouts/world.py --owned-chunks <region> > /tmp/<t>/owned.txt; git diff --name-only mainline -- assets/maps/ai/overworld/ \| grep -vxFf /tmp/<t>/owned.txt` | no output |
| G4 build and tests | `npm run build && npm test` | build exits 0; Vitest reports 0 failed |
| G5 gap verifier | `npm run quest -- --mutate` (Q9: `-- --strict --mutate`) | the last line is `quest-verify: OK`; exit 0 |
| G6 asset coverage | `npx vitest run tests/data/assetCoverage.test.ts` | all passed |
| G7 file-size ceilings | `npx vitest run tests/data/fileCeilings.test.ts tests/data/questCeilings.test.ts` | all passed |
| G8 compiler self-test (Q1b, or after any compiler change) | `python3 -I assets-src/tools/build_map.py --selftest` | exit 0 |
| G9 balance | `npx vitest run tests/balance/` | all passed, and every new bound is 3 points from its measured value (the round-count rule D-C7-19 applies) |
| G10 browser | the tranche's 5.6 checkpoints, with `mute=1` on every URL | every row passes, with a screenshot path |
| G11 clean tree | `git status --porcelain` before the commit | only the tranche's owned paths; no scratch files |

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | `ExplorationScene.ts` (601 / 601), `types/index.ts` and `schemaValidation.ts` grow | Q1a extracts code before adding any. New types go in `types/quest.ts` and new validators in `schemaValidationQuest.ts`. G7 |
| R2 | Streaming pops chunks in at airship speed | prefetch in the direction of travel; `bakedStreaming.test.ts`; a Q10 checkpoint |
| R3 | Regenerated chunks bloat git (about 57 MB of new chunk images, plus churn) | boxes aligned to chunks; G3 locality; one regeneration per merge |
| R4 | The generated `overworld` files conflict on every merge | they are never hand-merged; they are regenerated (4.0) |
| R5 | A basin leaks (the ship reaches the Inner Sea before CANAL_OPEN), or late seas are met early | composer basin checks; the verifier's (b); mutation of the J1 and J2 walls. Early late-tier seas are accepted (no landing) |
| R6 | Chaos is tuned for level 40, and the classic curve arrives lower | the curve model (5.2 d) and `questCurve.test.ts`; Open question 1 |
| R7 | Placeholder icons, recoloured caves and tinted NPCs look rough | accepted for pass Q; an optional later art pass (Open question 2) |
| R8 | The verifier drifts from runtime behaviour | it imports the runtime modules, has its own fixtures, and the browser checkpoints test the same gates in the game |
| R9 | New spell effects (death, stone) shift existing balance | early shops can't sell them; all of `tests/balance/` stays green (G9) |
| R10 | The world compile (about 90 s, x2 for determinism) slows iteration | iterate with plain compiles; run determinism at the gate only |
| R11 | Classic layouts get copied | the originality rules (4.6) and Q10's per-map review |
| R12 | The kneel pass has not landed, or conflicts | Q1-0 starts only from the kneel merge head; pass Q never touches the K files |
| R13 | A consumed item or a one-way pit soft-locks the game | the verifier's (c), plus EXIT on every dungeon |

## 9. Open questions (each has a default the orchestrator applies)

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

- [ ] Q1-0 contract: types, schema, flags, `quest.yaml`, anchors, `world_api` boxes, `questCeilings` (priority: high, effort: 3h)
- [ ] Q1a field engine: vehicles, patches, trades, item conditions, hazards, EXIT/WARP, zone modes, save v2 (priority: high, effort: 14h)
- [ ] Q1b toolchain: legend, Lake, patch art, remaps, placeholder landmarks, composer, streaming (priority: high, effort: 14h)
- [ ] Q1c data canon: key items, band gear, L5-L8 spells, kits, shop sections, bestiary habitats, helpers (priority: high, effort: 10h)
- [ ] Q1d verifier: model, proofs (a)-(d), CLI, mutation, fixtures (priority: high, effort: 12h)
- [ ] Q2 A1: bridge, Pravoka, pirates, ship, Matoya (priority: high, effort: 10h)
- [ ] Q3 ELF: Elfheim and its castle, Marsh Cave, Western Keep (priority: high, effort: 14h)
- [ ] Q4 EARTH: dwarf mine and canal, Melmond, Cavern of Earth, giant, sage (priority: high, effort: 16h)
- [ ] Q5 FIRE: Crescent Lake and canoe, sun temple, ice cavern, airship (priority: high, effort: 16h)
- [ ] Q6 WATER: trial keep, dragon king, Onrac, waterfall, Sea Shrine (priority: high, effort: 16h)
- [ ] Q7 WIND: Gaia, the sky-folk village, Mirage Tower, sky fortress (priority: high, effort: 16h)
- [ ] Q8 PAST: time gate, past temple, refights, Chaos, ending (priority: high, effort: 10h)
- [ ] Q9 integration: strict verify, quest curve, XP tuning, AGENTS.md (priority: high, effort: 8h)
- [ ] Q10 play test, fix plan, momus review, fixes (priority: medium, effort: 10h)

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

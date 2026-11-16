# Roster plan (pass R): every enemy as distinct art, 2026-11-15 (rev 2: momus revisions applied)

**Request (user, verbatim intent):** build out the remaining fiends and every enemy in the bestiary spec
(`~/temp/ffgame-assets/Final_Fantasy_I_Complete_Bestiary.md`, 128 NES records incl. 4 fiend rematches) as **distinct
art, no palette swaps** ("vampire" and "vampire lord" are different sprites). Fiends first, then the rest. **Halt when
every enemy is built or when 300 images have been generated, whichever comes first** (the old 100-image cap is
retired). Follow the established process (`docs/NEW_MONSTER_GUIDE.md`) for each one; use Google's image model with the
spec descriptions and common knowledge of each creature. When done, run a full adversarial visual play test of every
enemy, and fix the defects through a detailed, momus-reviewed plan.

**This document is the plan only.** Nothing is generated or implemented by it. Rev 2 folds in the momus review
(REVISE, 20 items) and re-verifies the facts at `feedback` 4fa9e27 (ledger: 100 Gemini attempts; `budget.json` and
`selftest_daze.py` as rewritten by the last boss fix). The binding orchestrator decisions are at the end.

**Terms used throughout:**
- **N0** = the number of Gemini `attempt` events (Bedrock excluded) in `assets-src/gen/cache/ledger.jsonl` at **R0**,
  the moment the roster pass starts (after the feedback fixes are merged and validated). It is 100 at 4fa9e27 and is
  re-counted at R0; every "pass R" count is `gem[N0:]`.
- **R0 commit** = the commit on branch `roster` that starts the pass (it carries FW-0). It is the baseline for every
  "unchanged" check (frame rects, locks, act-1 tests).

**New and changed modules (named up front):**

| Area | File | New / changed |
|---|---|---|
| Budget | `assets-src/gen/budget.json`, `generate.py::check_budget`, `selftest_daze.py::run_ledger`, new `selftest_roster.py` | changed / new (FW-0) |
| Prompts | `assets-src/gen/monster.py` (`prompt`, `pose_prompt`: `idle_negative`, `body:` motion line), `selftest_roster.py` (all approved cache keys unchanged) | changed (FW-9) |
| Templates | `assets-src/gen/rig_templates.py` (`floating`, `serpent`, `naga`, `arthropod`, `blob`), `rig.py` (biped wings, hem pins, arm lists), `monster_recipes.py` (list-valued arm/head sets), `monster_render.py` (`squash` op), `anim_feet.py` (float band), `selftest_efix.py` (fx allowlist) | changed (FW-1..FW-7) |
| Atlas | `assets-src/gen/monster_atlas.py` (page groups), `anim_rules.py` (`MAX_PAGE = 2048`), new `assets-src/gen/monster_roster_report.py` (contact sheet, distinctness) | changed / new (FW-8) |
| Runtime | new `src/rendering/MonsterPages.ts` (page index, `ensure`, LRU, refcounts); `BattleArt.ts`, `BattleTrigger.ts`, `ExplorationScene.ts`, `BestiaryScene.ts`, `BestiaryPreview.ts` (callers) | new / changed (FW-8) |
| AI | `src/battle/BossAI.ts` (targets by `spell.targeting`), `src/scenes/BattleScene.ts::attachEnemyAi` (data `ai`) | changed (FW-D) |
| Data | `src/types/index.ts` (EnemyData fields), `src/core/schemaValidation.ts`, `src/scenes/bestiary/*` (num, description/lore page, immune row), `src/battle/SpellStatus.ts` (`protect`) | changed (FW-D) |
| Logs and plans | `docs/ROSTER_LOG.md`, `docs/ROSTER_PLAYTEST.md`, `docs/ROSTER_FIX_PLAN.md` | new |

**Contents:** [0 Summary](#0-summary) · [1 Success criteria](#1-success-criteria-defined-before-implementation) ·
[2 What exists](#2-what-exists-today-verified-2026-11-15) · [3 Roster](#3-roster) · [4 Boss and fiend
designs](#4-boss-and-fiend-designs-prompts) · [5 Body templates](#5-body-templates-and-in-betweens) · [6 Image
budget](#6-image-budget) · [7 Data](#7-data-enemiesyaml-bestiaryyaml-engine) · [8 Atlas](#8-atlas-pages-memory-and-runtime-streaming)
· [9 Process](#9-process-per-enemy-ownership-and-parallelism) · [10 Tranches](#10-tranches) · [11 Play
test](#11-final-adversarial-visual-play-test--fix-plan--fixes) · [12 Validation](#12-validation-commands) ·
[13 Risks](#13-risks) · [14 Decisions](#14-decisions-for-the-orchestrator) · [15 TODOs](#15-todos) ·
[16 Follow-ups](#16-follow-ups-out-of-scope-for-pass-r)

---

## 0. Summary

| | |
|---|---|
| Spec records | 128 (001-128), of which 4 are fiend rematches (124-127) that reuse their fiend's sprite |
| Distinct sprites needed | **124** (the 4 original fiend slots are filled by the New Fiends: Rime Sovereign = `lich`, Ashen Queen, Drowned Sovereign, Hollow Seraph) |
| Already built (approved art + rig + lock) | **12**: goblin 001, wolf 003, skeleton 005, garland 012, ogre 014, pirate 017, mummy 034, troll 042, cockatrice 045, vampire 046, lich 049 (+124), dragon 066 |
| New sprites | **112** = 105 regular sheets (incl. `gr_imp` and `gr_wolf`, today palette swaps) + 7 per-pose bosses |
| Base images | **137** = 105 (one 3-pose sheet each) + 32 boss poses (3 fiends and Chaos x 5 incl. `attack_raise`; Astos, Warmech, Death Eye x 4) |
| Expected images (with retries) | **about 200** (planning range 175-230, rates from the 100-attempt ledger); worst case if every sheet used 3 attempts: 411 |
| Cap | 300 Gemini attempts in pass R (`gem[N0:]`, ledger-authoritative, failures count): **285 for building** (`pass R build`), **15 reserved for the fix pass** (`pass R fix`, approved ids only), both enforced in code (6.4) |
| New body templates | `floating` (ghosts, eyes, elementals; `swimmer` preset), `serpent` (snakes, worms; `rooted` preset), `naga` (serpent lower + N-arm biped upper), `arthropod`, `blob` (squash-and-stretch); plus biped/quadruped extensions (wings on bipeds, N arms, multi-head necks, mechanical preset) |
| Atlas | ~1,680 frames, ~26 Mpx of cells: **paged atlas, pages <= 2048x2048, about 8-10 pages, streamed per battle and per bestiary entry** |
| Encounter placements | **None new.** Only act 1 exists; every new enemy shows "Not placed yet" in the bestiary |
| Order | G1 fiends -> G2 other bosses and minibosses -> regular batches A-D in bestiary order (which follows the FF1 region order) |

**Key decisions (section 14 has all of them, with defaults):** keep the enemy ids `gr_imp` / `gr_wolf` but give them
new distinct sprites; new records take the spec's NES numbers through fixed conversion rules, the 14 existing entries
keep their tuned numbers; status protections become data (`protect`) shown in the bestiary and enforced by the
status roll; enemy spells come from data and run only where the spell already exists; no cast keyframe for regular
casters in this pass; the budget guard gets a closed pass F and two pass-R entries (build 285, fix 15). Today's open
pass F (`max_new 5`, all 5 used) refuses the first roster image, and `selftest_daze.py` pins the ledger to pass F.

---

## 1. Success criteria (defined before implementation)

```json
{
  "functional": [
    "Every one of the 124 distinct sprites in section 3 has approved Gemini art (3-pose sheet, or every boss pose) unless the 300-image halt fired; then the unbuilt ids are listed in docs/ROSTER_LOG.md",
    "No enemy uses a palette-swap variant: assets-src/gen/monsters.yaml has no `variants:` key",
    "assets/data/enemies.yaml has one entry per spec record whose sprite is built (128 when complete), each with `num` = the spec number; the 4 rematch records use their fiend's sprite",
    "Every built sprite has a rig and a lock and plays every frame of its sequence set (13 frames regular, 17 boss, 22 boss with attack_raise)",
    "The bestiary lists every built enemy in spec order with stats, weak/resist/immune rows, spells, a description, and a lore page for each fiend",
    "Battles and the bestiary load only the atlas pages they need"
  ],
  "observable": [
    "docs/ROSTER_LOG.md: one row per Gemini attempt and an 'Images used: N of 300' line equal to the guard's count",
    "assets-src/gen/out/anim/review/monsters/<id>_* review outputs for every new sprite, and an image-only reviewer verdict SHIP or SHIP WITH NITS in each hand-off",
    "A roster contact sheet (every idle at 1x and 2x, grouped by family) and a distinctness report",
    "docs/ROSTER_PLAYTEST.md (defects with probe id, severity, screenshot) and docs/ROSTER_FIX_PLAN.md with a momus OKAY"
  ],
  "pass_fail": [
    "Ledger: gem[N0:] <= 300 in total, <= 285 before the fix pass opened, fix-pass attempts only for ids with approved/<id>/; no character+sheet above 3 attempts in pass R",
    "Rolling gate (during the pass): check --all prints only '<id>: OK' lines and, for sprites whose sheet is approved but not yet rigged, the 'no rig' line; final gate: only '<id>: OK' lines",
    "python3 -I assets-src/gen/selftest.py prints ALL PASSED (main checkout)",
    "monsters_ai built under PYTHONHASHSEED=0 and =1 gives identical pages and JSON",
    "Every atlas page <= 2048x2048; the party atlases are byte-identical after a monsters_ai build",
    "The 12 existing sprites are byte-equal by (sheet, frame) rect to the R0 commit, across pages (the 12.2 script); only gr_imp and gr_wolf (former variants) change, on purpose",
    "Act 1 unchanged: gr_imp and gr_wolf stay size small on page 0 (<= 2048x2048); actOneBalance, actOneEncounters, act1Flow, EncounterTable, meleeContact, economy and bestiaryHabitats pass without edits to their expectations",
    "An enemy casting CURE (single_ally) never heals a hero (BossAI unit test)",
    "npx tsc --noEmit && npm run build && npm test pass",
    "No map source changes: git diff --exit-code assets-src/tools/layouts assets/maps/temple-of-fiends.yaml",
    "After the fix pass: zero open P0/P1 defects in docs/ROSTER_PLAYTEST.md"
  ]
}
```

---

## 2. What exists today (verified 2026-11-15)

- **Enemies** (`assets/data/enemies.yaml`, 14 entries): goblin, gr_imp, wolf, gr_wolf, skeleton, pirate, ogre, troll,
  mummy, cockatrice, vampire, dragon, garland, lich. `gr_imp` and `gr_wolf` are palette variants (`monsters.yaml`
  `variants`: hue -95 / hue -20, val 0.65). Only goblin, gr_imp, wolf, gr_wolf, skeleton and garland are placed
  (`assets-src/tools/layouts/overworld_zones.py`, `assets/maps/temple-of-fiends.yaml`).
- **Rigs:** 12 base rigs with locks in `assets-src/gen/anim/monsters/` (goblin, wolf, skeleton, pirate, mummy,
  cockatrice, vampire, ogre, troll, dragon, garland, lich). Variants have no rig.
- **Atlas:** `assets/sprites/monsters-ai.png` is 2040x1872, one page (`page: 0`), 200 frames: 13 per regular sheet
  (`idle idle_b atk_wind1 atk_wind2 atk_mid attack atk_follow atk_recover hurt_in1 hurt_in2 hurt daze daze_b`), 22 for
  garland and the lich (+ `cast_gather cast_rise cast cast_release attack_raise atk_raise_in atk_raise_b atk_swing
  atk_swing2`). Shelf width 2048 (`monster_atlas.py`), page cap 4096 (`anim_rules.MAX_PAGE`), every sheet `page: 0`.
  The runtime loads one PNG (`src/rendering/BattleArt.ts`, `MONSTER_ATLAS`; preloaded in `ExplorationScene.enter` and
  `BestiaryScene.load`). Readers of the atlas metadata or textures: `BattleArt.ts`, `CharacterAtlas.ts` (loaded
  together), `AiEnemyView.ts`, `BattleDisplayManager.ts` (246 of its 249-line ceiling), `enemyChoreography.ts`,
  `BestiaryPreview.ts`, `BestiaryScene.ts`, `ExplorationScene.ts`; tests `assetCoverage`, `crossFileValidation`,
  `BattleArt`, `BattleArtRaise`, `CharacterAtlas`, `actionFx`, `activeHeroLateArt`, `AiEnemyView`, `battleLayers`,
  `enemyTravel`, `meleeContact`, `poseCues`, `presentedState`, `statusIntegration`, `BestiaryScene`.
- **Bands** (`spec.py`): small 80 px cell (figure 56-72, feet row 76), large 128 (96-120, 122), boss per-pose 200
  (feet row 192). A regular `--sheets monster` request is **one image with 3 poses** (idle, attack, hurt; 1680x720,
  21:9). Bosses (`per_pose: true`) are **one image per pose**: idle, attack, cast, hurt, and optionally
  `attack_raise` (`spec.BOSS_POSES`).
- **Ledger (4fa9e27):** 100 Gemini `attempt` events (+1 pre-ledger note; 7 Bedrock attempts, not counted). Attempts
  96-100 are pass F: garland `boss_attack_raise` x2 (seeds 1234, 1235), lich `boss_attack_raise` x3 (1234-1236).
  31 monster images so far: 10 regular sprites took 13 images (**1.30 per sheet**); garland 7 images for 5 poses
  (**1.40**), the lich 11 for 5 poses (**2.0** per pose, plus one early 3-pose boss sheet); bosses together 17 images
  for 10 poses (**1.70**).
- **Budget guard** (`generate.py::check_budget`, `budget.json` at 4fa9e27): `attempts_before 69`, `cap 100` (31
  used), `max_attempts_per_sheet 3`, and one open pass `pass F (FB-8)`: `gemini_before 95, max_new 5,
  max_per_sheet 3` (raised by the user on 2026-11-15 for one more lich attempt). **Every pass in `passes` is applied to
  every request:** pass F has 5 of 5 used, so the guard refuses **any** further Gemini image today.
  `selftest_daze.run_ledger` asserts that every attempt after 95 is a garland/lich `boss_attack_raise` (garland <= 2),
  that `len(gem) - 69 <= 95 - 69 + 5 = 31`, and (through `refused()`) that a pass-F sheet's 4th and the pass's 6th
  attempt are refused. All of that must change before pass R (FW-0, 6.4).
- **Engine limits relevant to data:**
  - Elements: `fire ice lightning earth holy dark water wind` (`Elements.ts`); `elementalProfile` supports lists.
  - Statuses: `poison stun sleep blind silence death stone fear` (`StatusEffects.ts`); no status immunity in data
    (BESTIARY_PLAN BS-5 / BS-F3).
  - Enemy actions: only debug `enemyAi` (`BattleScene.attachEnemyAi`) and boss phases; no data-driven AI.
    `BossAI.selectAction` always targets a living **party** member, even for an ally spell (a CURE would aim at a
    hero); `SpellExecutor` honours `single_ally`/`all_allies`/`self` only from the command it receives.
  - Enemy stats the engine reads beyond the combat block: only `agility` (turn order key, `BattleStateMachine.ts:293`);
    strength, intelligence, vitality and luck are display-only for enemies.
  - Enemy spells that exist in `spells.yaml`: e.g. `fire lit ice fir2 lit2 ice2 slep slp2 hold dark slow mute fast
    ruse lock lok2 conf cure cure2 cure3 heal afir`. Missing: `fir3 lit3 ice3 nuke rub xxxx brak bane stop zap xfer
    wall fog2 inv2 hel2 hel3 cur4 stun blnd slo2`.
  - No enemy special abilities (gaze, breath other than the dragon's `fire_breath` attack effect, ink, stinger) and
    no on-hit status from enemy attacks.
  - Families used by gear: `undead giant aquatic dragon` (+ `were`, `magical` labels). The bestiary has no
    `aquatic` label yet.
- **Bestiary** (`assets/data/bestiary.yaml`, `src/scenes/bestiary/`): numbers are the `enemies.yaml` index + 1
  (`bestiaryModel.ts:47`), so they would shift as entries are added; `titleCount` shows `index/total`; the stats panel
  uses all 17 `STAT_LINES`; there is no description or lore text; the "Immune" row shows elemental immunities only;
  "No art yet" exists for a missing sheet. Tests pin `014 Lich` and `013 Garland  13/14`
  (`tests/scenes/bestiary/bestiaryModel.test.ts:30-34`).
- **Process constraints:** `assets-src/gen/refs/` exists only in the main checkout, so paid runs happen there; in a
  worktree only `selftest.py --anim` runs. Approved PNGs are never edited (style lock). No AI in-betweens (Bedrock
  rejected 2026-11-13). The atlas is binary with one integrator. Browser runs always add `?mute=1`.

---

## 3. Roster

### 3.1 Mapping rules

1. **One sprite per spec record**, except the 4 rematch records 124-127, which reuse their fiend's sprite (Rime
   Sovereign `lich`, `ashen_queen`, `drowned_sovereign`, `hollow_seraph`). A rematch is a second `enemies.yaml` entry
   (`lich_2`, ...) with the same `sprite:`; that costs no art. Its display name carries a tag: **"Rime Sovereign II",
   "Ashen Queen II", "Drowned Sovereign II", "Hollow Seraph II"** (ASCII, fits the 17-character value column).
2. **New Fiends replace the originals:** 049/124 Lich -> Rime Sovereign (exists as `lich`), 067/125 Marilith -> Ashen
   Queen, 102/126 Kraken -> Drowned Sovereign, 119/127 Tiamat -> Hollow Seraph. The spec's NES stats and roles stay
   with the record; the look, names and lore come from "New Fiends".
3. **Existing ids stay** (`goblin`, `gr_imp`, `wolf`, `gr_wolf`, ...): they are referenced by maps, the sandbox,
   debug scenarios and 7 test files. Display names change to the spec names (Gr.Imp -> Goblin Guard, Gr.Wolf -> Warg
   Wolf, Dragon -> Red Dragon). `gr_imp` and `gr_wolf` get **new distinct sprites under the same sprite id**; their
   `variants` rows are deleted. Act-1 guard: both stay `size: small` (the former variants were small, `gr_wolf` 110x80
   like `wolf`), stay on atlas page 0 (<= 2048x2048), and the act-1 tests named in section 1 pass unchanged.
4. **New ids** are snake_case modern names (table). Sprite id = enemy id.
5. **Distinct, not recoloured:** every sibling pair (section 3.3) differs in silhouette, prop and posture, not only in
   colour. A regular reviewer check compares each new sheet with its siblings side by side before approval.
6. **Size:** small/large follow the creature's scale (a horse, a giant or a dragon is large; a human-sized foe is
   small). `boss` (per-pose, 200 px) is for the 3 new fiends, Chaos, Astos, Warmech and Death Eye. Vampire stays the
   existing small sprite; Evil Eye, Dragon Zombie and Piscodemon are regular sheets (decision D7).

### 3.2 Roster table (124 sprites; "-" batch = already built)

Body = the rig recipe (section 5). Base imgs = Gemini images without retries. The design brief seeds the prompt
(section 4.3); it is our own description, not a copy of any game's art.

| # | Enemy | Sprite | Size | Body | Batch | Base imgs | Design brief |
|---|---|---|---|---|---|---|---|
| 001 | Goblin | `goblin` | small | biped | - | 0 | existing: hunched green goblin, rusty dagger |
| 002 | Goblin Guard | `gr_imp` | small | biped | A | 1 | stockier red-brown goblin in a dented pot helm and hide armour, small round shield and short spear (was a palette swap) |
| 003 | Wolf | `wolf` | small | quadruped | - | 0 | existing: lean grey wolf |
| 004 | Crazy Horse | `crazy_horse` | large | quadruped | A | 1 | wild-eyed piebald horse, matted mane, broken bridle trailing, rearing to kick |
| 005 | Skeleton | `skeleton` | small | biped | - | 0 | existing: yellowed skeleton, sword and round shield |
| 006 | Black Widow | `black_widow` | small | arthropod | A | 1 | glossy black spider, red hourglass, low wide stance, raised forelegs |
| 007 | Gigas Worm | `gigas_worm` | large | serpent | A | 1 | huge pink-grey segmented earthworm reared up in an S, ringed maw of teeth |
| 008 | Warg Wolf | `gr_wolf` | small | quadruped | A | 1 | bulkier black warg, bristling shoulder mane, scarred muzzle, heavy jaw (was a palette swap) |
| 009 | Werewolf | `werewolf` | small | biped | A | 1 | upright brown wolf-man in torn trousers, clawed hands, digitigrade legs, drooling fangs |
| 010 | Zombie | `zombie` | small | biped | A | 1 | shambling grey-green corpse in rotten peasant rags, one arm limp, slack jaw |
| 011 | Ghoul | `ghoul` | small | biped | A | 1 | crouched hairless grey ghoul, long claws, hollow cheeks, tattered loincloth |
| 012 | Garland | `garland` | boss | biped | - | 0 | existing: horned dark knight, greatsword (boss, with attack_raise) |
| 013 | Cobra | `cobra` | small | serpent | A | 1 | coiled olive cobra with a wide banded hood, fangs bared |
| 014 | Ogre | `ogre` | large | biped | - | 0 | existing: tan ogre, spiked club |
| 015 | Ogre Chief | `ogre_chief` | large | biped | A | 1 | grey-skinned ogre warlord in riveted iron plates and a horned helm, two-handed cleaver, skull belt |
| 016 | Lizard | `lizard` | small | quadruped | A | 1 | stocky green iguana-like lizard with a dorsal crest and dewlap, low sprawl |
| 017 | Pirate | `pirate` | small | biped | - | 0 | existing: tricorn pirate, cutlass |
| 018 | Sahagin | `sahagin` | small | biped | A | 1 | blue-green fish-man with a fin crest, webbed feet, bone trident |
| 019 | Sahagin Chief | `sahagin_chief` | small | biped | A | 1 | teal fish-man in coral-plate armour, red fin crest, barbed spear and shell shield |
| 020 | Buccaneer | `buccaneer` | small | biped | A | 1 | lanky sea raider in a red bandana and striped shirt, boarding axe and hook hand (no tricorn: distinct from the pirate) |
| 021 | Shark | `shark` | large | swimmer | A | 1 | grey shark arched as if leaping, open jaws, no water drawn |
| 022 | Bigeyes | `bigeyes` | small | floating | A | 1 | small floating eyeball with fish fins and a short tail fin, blue iris |
| 023 | Tarantula | `tarantula` | small | arthropod | A | 1 | hairy brown-orange tarantula, thick legs, raised fangs (stouter than the black widow) |
| 024 | Ghast | `ghast` | small | biped | A | 1 | gaunt purple-grey ghoul in a rotting burial shroud, elongated arms, glowing green eyes |
| 025 | Scorpion | `scorpion` | small | arthropod | A | 1 | sand-yellow scorpion, raised pincers, segmented tail arched over the back |
| 026 | Shadow | `shadow` | small | floating | A | 1 | drifting black silhouette of a man, ragged edges dissolving into smoke, two white eyes |
| 027 | Green Slime | `green_slime` | small | blob | A | 1 | translucent green dome of slime with bubbles and a half-dissolved bone inside |
| 028 | Crawler | `crawler` | small | arthropod | A | 1 | pale segmented carrion grub with many short legs and a ring of face feelers |
| 029 | Gray Ooze | `gray_ooze` | small | blob | A | 1 | low spreading grey puddle-blob with two lumpy pseudopods raised |
| 030 | Gargoyle | `gargoyle` | small | biped | A | 1 | crouching grey stone gargoyle, bat wings, horns, cracked stone skin |
| 031 | Bloodbones | `bloodbones` | small | biped | A | 1 | large red-stained skeleton in a rusted breastplate, two notched blades, horned skull |
| 032 | Piscodemon | `piscodemon` | small | biped | G2 | 1 | anglerfish-headed demon with a glowing lure, barbels, scaled armour, webbed claws (no spells) |
| 033 | Astos | `astos` | boss | biped | G2 | 4 | regal dark-elf usurper, ash-grey skin, long white hair, jagged black crown, violet robes over thin armour, sickle staff |
| 034 | Mummy | `mummy` | small | biped | - | 0 | existing: hunched bandaged mummy |
| 035 | Wraith | `wraith` | small | floating | B | 1 | hooded spectral figure with no legs, chains wrapped around the torso, cold blue glow |
| 036 | Anaconda | `anaconda` | large | serpent | B | 1 | thick green-brown constrictor in a raised coil, dark blotches, no hood |
| 037 | Hyenadon | `hyenadon` | small | quadruped | B | 1 | spotted prehistoric hyena-beast, sloped back, huge bone-crushing jaw |
| 038 | Lesser Tiger | `lesser_tiger` | small | quadruped | B | 1 | orange striped tiger, crouched to pounce |
| 039 | Minotaur | `minotaur` | large | biped | B | 1 | brown bull-headed giant, nose ring, leather harness, double-bladed axe |
| 040 | Hill Gigas | `hill_gigas` | large | biped | B | 1 | ruddy hill giant in furs, tree-trunk club, rope belt with a sack |
| 041 | Earth Elemental | `earth_elemental` | large | biped | B | 1 | lumbering giant of packed earth and boulders, moss and roots, glowing amber cracks |
| 042 | Troll | `troll` | large | biped | - | 0 | existing: green troll, mallet |
| 043 | Wight | `wight` | small | biped | B | 1 | armoured undead knight in corroded mail, rusted sword, pale eye lights |
| 044 | Ochre Jelly | `ochre_jelly` | small | blob | B | 1 | stacked lumpy mustard-yellow jelly, glossy, dripping |
| 045 | Cockatrice | `cockatrice` | small | bird | - | 0 | existing: rooster with a snake tail |
| 046 | Vampire | `vampire` | small | biped | - | 0 | existing: pale vampire, black and red cape |
| 047 | Ogre Mage | `ogre_mage` | large | biped | B | 1 | blue-skinned ogre sorcerer in a hooded patchwork robe, single horn, staff with an ice orb |
| 048 | Sphinx | `sphinx` | large | quadruped | B | 1 | tawny lion body, feathered eagle wings, stern human face with a striped headdress |
| 049 | Rime Sovereign | `lich` | boss | biped | - | 0 | existing: frost knight-king, ice glaive (records 049 and 124) |
| 050 | Ankheg | `ankheg` | large | arthropod | B | 1 | armoured rust-brown centipede rearing up, huge mandibles, dripping venom |
| 051 | Piranha | `piranha` | small | swimmer | B | 1 | **cut (user, 2026-11-15):** no sprite, enemy or bestiary entry for now. Was: small silver-green piranha, underbite of needle teeth |
| 052 | Red Piranha | `red_piranha` | small | swimmer | B | 1 | larger blood-red armour-plated piranha, bony head plate, spiny fins. **Approved R288** (fix pass 2: FW-C re-cut of the R282 raw, hurt lifted 8 px, 0 images); in the atlas and `enemies.yaml` (num 52, bestiary `ocean`, not placed) since G4; rigged and locked in G3d ("float2", SHIP WITH NITS), in the atlas since G6 |
| 053 | Crocodile | `crocodile` | large | quadruped | B | 1 | dark green crocodile, open jaws, ridged back, low sprawl |
| 054 | White Crocodile | `white_crocodile` | large | quadruped | B | 1 | pale albino crocodile, pink eyes, barnacle-crusted back, larger |
| 055 | Ochu | `ochu` | large | rooted | B | 1 | carnivorous green plant: bulb with a toothy maw on a root mass, four lashing vine tentacles |
| 056 | Neochu | `neochu` | large | rooted | B | 1 | bigger purple-black thorned ochu, two maws, spiked tentacles, poison sacs |
| 057 | Hydra | `hydra` | large | quadruped | B | 1 | three-headed green hydra on four legs, long necks |
| 058 | Horned Devil | `horned_devil` | small | biped | B | 1 | red-skinned winged devil, ram horns, barbed tail, trident |
| 059 | Pyrolisk | `pyrolisk` | small | bird | B | 1 | small fiery bird-lizard, ember feathers, burning eyes, lizard tail |
| 060 | Fire Elemental | `fire_elemental` | large | floating | B | 1 | living pillar of flame with a molten core and a fierce face in the fire |
| 061 | Fire Hydra | `fire_hydra` | large | quadruped | B | 1 | three-headed crimson hydra with smoking nostrils and magma-cracked scales |
| 062 | Lava Worm | `lava_worm` | large | serpent | B | 1 | black-crusted worm with glowing magma seams, steaming, reared up |
| 063 | Hellhound | `hellhound` | large | quadruped | B | 1 | two-headed black hound with ember-orange manes and burning eyes |
| 064 | Fire Lizard | `fire_lizard` | large | quadruped | B | 1 | frilled orange lizard with heat shimmer and smouldering back plates |
| 065 | Fire Gigas | `fire_gigas` | large | biped | B | 1 | giant with charred skin, molten veins, flaming hair, iron forge hammer |
| 066 | Red Dragon | `dragon` | large | quadruped | - | 0 | existing: red dragon |
| 067 | Ashen Queen | `ashen_queen` | boss | naga | G1 | 5 | six-armed sun priestess, serpentine tail coiled on a ruined altar (see 4.1) |
| 068 | White Dragon | `white_dragon` | large | quadruped | C | 1 | sleek white frost dragon, feathered-crystal wings, icicle beard |
| 069 | Winter Wolf | `winter_wolf` | small | quadruped | C | 1 | white wolf with a frosted blue mane, icy breath at the muzzle |
| 070 | Mindflayer | `mindflayer` | small | biped | C | 1 | robed purple-skinned humanoid with a face of four tentacles and a high collar |
| 071 | Ice Gigas | `ice_gigas` | large | biped | C | 1 | frost-blue giant with an icicle beard, fur mantle, ice-shard axe |
| 072 | Specter | `specter` | small | floating | C | 1 | tall pale-blue robed spirit, long thin hands, faceless hood with two lights |
| 073 | Remorazz | `remorazz` | large | arthropod | C | 1 | segmented insect with heat-glowing back spines and plated head |
| 074 | Dark Wizard | `dark_wizard` | small | biped | C | 1 | hunched wizard in a black star-patterned robe, wide hat, gnarled staff |
| 075 | Evil Eye | `evil_eye` | large | floating | G2 | 1 | large floating eye with a fanged mouth below and four writhing eyestalks |
| 076 | Desert Baretta | `desert_baretta` | large | quadruped | C | 1 | sand-coloured armoured ankylosaur, spiked shell, club tail |
| 077 | Sabertooth | `sabertooth` | large | quadruped | C | 1 | tan sabre-toothed cat, huge fangs, heavy forequarters |
| 078 | Wyvern | `wyvern` | large | bird | C | 1 | green wyvern on two legs, wings, barbed stinger tail |
| 079 | Wyrm | `wyrm` | large | serpent | C | 1 | wingless bronze serpentine drake, horned head, short clawed forelegs |
| 080 | Manticore | `manticore` | large | quadruped | C | 1 | maned lion with bat wings, bearded human-like face, scorpion tail |
| 081 | Baretta | `baretta` | large | quadruped | C | 1 | red-brown armoured burrower, shovel claws, spiked plates (no club tail) |
| 082 | Basilisk | `basilisk` | small | quadruped | C | 1 | low grey-green lizard with six legs, crowned head crest, gleaming eyes |
| 083 | Allosaurus | `allosaurus` | large | bird | C | 1 | olive two-legged predatory dinosaur, small arms, brow horns |
| 084 | Weretiger | `weretiger` | small | biped | C | 1 | upright tiger-man in a leather kilt, curved claws, striped fur |
| 085 | Sand Worm | `sand_worm` | large | serpent | C | 1 | ochre worm bursting from a sand mound, four-part jaw |
| 086 | Minotaur Zombie | `minotaur_zombie` | large | biped | C | 1 | rotting minotaur, exposed ribs, broken horn, rusted cleaver |
| 087 | King Mummy | `king_mummy` | small | biped | C | 1 | regal mummy in gilded wrappings, gold death mask, sceptre, blue headdress |
| 088 | Medusa | `medusa` | small | naga | C | 1 | serpent-tailed woman with snake hair, green scales, bronze armlets |
| 089 | Rakshasa | `rakshasa` | small | biped | C | 1 | tiger-headed sorcerer in rich red and gold robes, backward-jointed hands |
| 090 | Clay Golem | `clay_golem` | large | biped | C | 1 | crude reddish clay giant, lumpy, handprints, a glyph on the brow |
| 091 | Nightmare | `nightmare` | large | quadruped | C | 1 | black horse with a flaming violet mane and smouldering hooves |
| 092 | Dragon Zombie | `dragon_zombie` | large | quadruped | G2 | 1 | rotting dragon, torn wing membranes, exposed bone, ghost-green glow |
| 093 | Sahagin Prince | `sahagin_prince` | small | biped | C | 1 | tall regal fish-man, flowing fin cape, twin coral blades, pearl circlet |
| 094 | White Shark | `white_shark` | large | swimmer | C | 1 | great white shark, scarred, wider and paler than the shark. **Approved with nits R289** (fix pass 2: FW-C re-cut of the R280 raw, attack / hurt lifted 34 / 36 px, 0 images; small level idle vs arched 95-98 px actions); in the atlas and `enemies.yaml` (num 94, bestiary `ocean`, not placed) since G4; rigged and locked in G3d ("float2", SHIP WITH NITS: ships, not deferred), in the atlas since G6 |
| 095 | Deepeyes | `deepeyes` | large | floating | C | 1 | bulbous abyssal eye with dangling luminous tentacles beneath |
| 096 | Sea Snake | `sea_snake` | large | serpent | C | 1 | banded blue and white sea serpent with a paddle tail and fin crest |
| 097 | Sea Scorpion | `sea_scorpion` | small | arthropod | C | 1 | red armoured lobster-scorpion with big crusher claws |
| 098 | Sea Troll | `sea_troll` | large | biped | C | 1 | hunched blue-green troll with kelp hair, barnacles, webbed claws |
| 099 | Ghost | `ghost` | small | floating | C | 1 | wispy white sheet-like spirit with a skull face and grasping hands |
| 100 | Water Elemental | `water_elemental` | large | floating | C | 1 | living wave of blue water rising in a crest with a face and arms |
| 101 | Water Naga | `water_naga` | large | naga | C | 1 | blue-scaled naga with fin ears, coral ornaments, trident |
| 102 | Drowned Sovereign | `drowned_sovereign` | boss | biped | G1 | 5 | crowned king in impossibly flowing robes hiding tentacles (see 4.1) |
| 103 | Tyrannosaur | `tyrannosaur` | large | bird | D | 1 | massive red-brown tyrannosaur, huge head, tiny arms |
| 104 | Black Knight | `black_knight` | small | biped | D | 1 | knight in plain black plate, closed helm, two-handed sword |
| 105 | Chimera | `chimera` | large | quadruped | D | 1 | lion body with goat and dragon heads, bat wings, snake tail |
| 106 | Guardian | `guardian` | large | quadruped | D | 1 | four-legged bronze automaton sentinel, single lens eye, spear arms |
| 107 | Blue Dragon | `blue_dragon` | large | quadruped | D | 1 | long blue dragon with lightning-fork horns and glowing crest |
| 108 | Green Dragon | `green_dragon` | large | quadruped | D | 1 | heavy green dragon, toxic throat sacs, bony frill |
| 109 | Stone Golem | `stone_golem` | large | biped | D | 1 | carved grey stone block giant with runes and a lintel head |
| 110 | Air Elemental | `air_elemental` | large | floating | D | 1 | whirlwind column with a stern face and debris spinning in it |
| 111 | Spirit Naga | `spirit_naga` | large | naga | D | 1 | purple naga sorceress, cobra-hood headdress, jewelled staff |
| 112 | Death Knight | `death_knight` | small | biped | D | 1 | skeletal knight in spiked dark plate, tattered cloak, runed black sword |
| 113 | Earth Medusa | `earth_medusa` | small | naga | D | 1 | stony grey medusa with rock scales and a petrified-snake crown |
| 114 | Black Flan | `black_flan` | small | blob | D | 1 | glossy black pudding blob with a few yellow eyes |
| 115 | Soldier | `soldier` | large | biped | D | 1 | heavy bronze mechanical soldier, riveted plates, blade arm |
| 116 | Vampire Lord | `vampire_lord` | small | biped | D | 1 | tall elder vampire, white hair, bat-wing cape joined to the arms, crown-collar, gaunt (not a recolour) |
| 117 | Dark Fighter | `dark_fighter` | small | biped | D | 1 | warrior-mage in dark half-plate and a hooded tabard, sword and glowing glyph shield |
| 118 | Warmech | `warmech` | boss | biped | G2 | 4 | ancient bipedal war machine, domed sensor head, cannon arm, bronze and teal |
| 119 | Hollow Seraph | `hollow_seraph` | boss | floating | G1 | 5 | empty white armour, broken halo, six mechanical wings (see 4.1) |
| 120 | Rhyos | `rhyos` | large | quadruped | D | 1 | grey stone-hided chimera kin with a basilisk head, ram head and lion head |
| 121 | Death Eye | `death_eye` | boss | floating | G2 | 4 | colossal undead eye bound in grave cloth, bone crown, spectral tendrils |
| 122 | Purple Worm | `purple_worm` | large | serpent | D | 1 | colossal violet armoured worm, many rows of teeth, tail stinger |
| 123 | Iron Golem | `iron_golem` | large | biped | D | 1 | riveted iron golem, furnace chest, chain fists |
| 128 | Chaos | `chaos` | boss | biped | G2 | 5 | original primordial titan (see 4.2) |

**Tallies (new sprites only):** 56 large, 49 small, 7 boss. Bodies: biped 40, quadruped 26 (8 winged, 5 multi-head,
2 mechanical/armoured), floating 12, serpent 8, arthropod 7, naga 5, swimmer 4, blob 4, bird 4 (2 two-legged
dinosaurs), rooted 2. Batches: G1 3, G2 7, A 25, B 27, C 32, D 18.

### 3.3 Sibling groups that must read as different creatures

| Group | How they differ (silhouette / prop / posture / palette) |
|---|---|
| Goblin, Goblin Guard | dagger and vest vs helm, hide armour, shield and spear; the guard stands upright and is stockier |
| Wolf, Warg Wolf, Winter Wolf, Werewolf, Hellhound | lean grey / heavy black maned / white frost mane and breath / upright biped / two-headed fire hound (large) |
| Ogre, Ogre Chief, Ogre Mage | loincloth and club / iron plate, horned helm, cleaver / robed, horn, staff and orb |
| Hill, Fire, Ice Gigas | furs and tree club / molten skin and forge hammer / frost skin, icicle beard, ice axe |
| Skeleton, Bloodbones, Death Knight, Wight | sword and shield / larger, breastplate, twin blades, horned skull / spiked plate and cloak / corroded mail with flesh |
| Zombie, Ghoul, Ghast | upright shambler in rags / crouched clawed / gaunt in a shroud, long arms |
| Shadow, Wraith, Specter, Ghost | smoke silhouette / hooded with chains / tall robed, long hands / sheet with skull face |
| Mummy, King Mummy | hunched bandages / upright, gold mask, headdress, sceptre |
| Vampire, Vampire Lord | slicked hair, closed cape / tall elder, white hair, bat-wing cape joined to the arms, crown collar |
| Sahagin, Chief, Prince | trident, bare / coral armour, spear and shell / tall, fin cape, twin blades, circlet |
| Pirate, Buccaneer | tricorn, coat, cutlass / bandana, striped shirt, axe and hook |
| Shark, White Shark; Piranha, Red Piranha | slim grey / broad scarred white; small silver / larger armour-plated |
| Crocodile, White Crocodile | dark green / pale albino with barnacles, larger |
| Green Slime, Gray Ooze, Ochre Jelly, Black Flan | translucent dome / flat puddle with pseudopods / stacked lumps / glossy black with eyes |
| Clay, Stone, Iron Golem | lumpy handprinted clay / carved blocks and runes / riveted plates and furnace |
| Medusa, Earth Medusa, Water Naga, Spirit Naga | snake hair, bronze / stone scales / fins and trident (large) / hood headdress and staff (large) |
| Gigas, Lava, Sand, Purple Worm | pink segmented / magma seams / bursting from sand / colossal violet with stinger |
| Bigeyes, Deepeyes, Evil Eye, Death Eye | small with fins / bulbous with lights / mouth and eyestalks / bandaged undead boss |
| Hydra, Fire Hydra, Chimera, Rhyos | three green heads / three red smoking heads / lion+goat+dragon with wings / stone-hided three heads |
| Red, White, Blue, Green Dragon, Dragon Zombie | existing / sleek frost / long with lightning horns / heavy with sacs / rotting bone |
| Cockatrice, Pyrolisk, Basilisk | rooster with snake tail / small fire bird-lizard / six-legged crowned lizard |
| Black Widow, Tarantula; Scorpion, Sea Scorpion | glossy black hourglass / hairy brown; sand yellow / red lobster claws |
| Crawler, Ankheg, Remorazz | pale grub with feelers / rearing brown centipede / plated insect with glowing spines |
| Baretta, Desert Baretta | red-brown burrower with shovel claws / sand ankylosaur with club tail |
| Fire, Water, Air, Earth Elemental | flame pillar / wave crest / whirlwind / boulder giant (biped) |

---

## 4. Boss and fiend designs (prompts)

Every boss follows the per-pose pipeline (NEW_MONSTER_GUIDE 1.1-1.4): `size: boss`, `per_pose: true`,
`design_ref: false`, a `prompt` (idle look), an `action_prompt` (the look without the idle-only details), `attack`,
`cast`, `hurt`, optional `attack_raise`, `face`, `extra_negative`. `boss_idle` is generated and approved first; every
later pose sends it as the identity image. The house style refs (`approved/knight/battle.png`) are sent as today.

### 4.1 The New Fiends (G1)

**Ashen Queen (067/125), `ashen_queen`, body `naga` (six arms), size boss, 5 poses, `attackAnim: heavy` from phase 2.**

- `prompt`: a towering six-armed sun priestess transformed by sacred fire. The upper body is a tall, graceful humanoid
  torso of blackened, cracked stone-like skin with molten orange-gold light glowing through the fissures. **Exactly
  six arms, three on each side**: the upper pair raised holding a small radiant sun disc between them, the middle
  pair in open blessing and offering gestures, the lower pair holding a curved ceremonial bronze blade (near side)
  and a smoking censer on a chain (far side). A radiant crown of gold rays frames a cracked white ceremonial mask. No
  legs: below the waist a vast serpentine tail of charcoal scales with ember-lit undersides, coiled around a broken
  stone altar on the ground; **the altar is part of her base, drawn joined to the coil in every pose** (not a
  separate prop or scenery: `MONSTER_NEGATIVE` forbids scenery, and the rig pins it as the ground contact). Palette:
  charcoal, ember orange, white-gold, bronze, ash grey. `body: naga` (FW-9 motion line).
- `attack`: lunging forward on the coiled tail, the three near-side arms striking toward the heroes in one sweep
  (blade leading), the far arms thrown back, tail coil tightening.
- `cast`: rising tall on the tail, all six arms spread in a ritual formation, the sun disc between the upper hands
  blazing white-gold, sparks rising.
- `hurt`: recoiling back over the coil, mask crack flaring brighter, arms flung outward out of rhythm.
- `attack_raise`: all six arms raised high overhead together, blade and disc above the crown, the tail coiled low
  and tight, fitting inside the grey box at the same size as Image 3 (crouched into the coil, not taller).
- `face`: the cracked white mask with two burning slits is readable; no human face shows.
- `extra_negative`: legs, feet, four arms, eight arms, a second blade, a throne, wings.
- Review add-on: **count the arms (6) in every pose**; the altar stays under the coil in every pose (it is the ground
  contact the rig pins).

**Drowned Sovereign (102/126), `drowned_sovereign`, body `biped` robed + reveal parts, size boss, 5 poses,
`attackAnim: heavy` from phase 2.**

- `prompt` (idle, the disguise): an ancient, composed human king, crowned with tarnished gold set with pearls, an
  aged regal face with calm pale eyes and wet grey hair. He wears magnificent ceremonial robes of deep abyssal teal
  and pearl-white with gold embroidery; **the robes are impossibly long and flowing, their hems drifting outward and
  upward as if under water, pooling wide on the ground** and hiding his whole body. One pale hand extends from a wide
  sleeve holding a coral sceptre; the other is hidden. Nothing inhuman is visible.
- `action_prompt`: the same crown, face, pearl-and-teal robes and sceptre as Image 3, with the robes able to part.
- `attack`: the robes part at the front and **three dark teal tentacles with pale suckers lash out toward the
  heroes**; the crown, face and robe outline stay as in Image 3.
- `cast`: the robes open wide like a fan and six tentacles spread in a circular ritual formation behind him, their
  tips glowing a deep abyssal blue; he raises the sceptre.
- `hurt`: knocked back, tentacles **erupt defensively** from under the robe around him, face grimacing, crown askew.
- `attack_raise` (the heavy, most revealing pose): robes thrown fully open, a **mass of tentacles and a glimpse of
  something enormous folded beneath** rising high behind him, sceptre raised; crouched to fit the box.
- `idle_negative` (new field, FW-9; sent **only** with `boss_idle`): tentacles, suckers, fins, fish features. Pose
  requests do not get it, so the tentacles may appear there. `extra_negative` (all poses): a second crown, a throne,
  a fish tail. `body: biped` with the robed motion line.
- Animation consequence (section 5.3): tentacles exist only in the `attack`, `cast`, `hurt` and `attack_raise`
  keyframes. Idle-sourced in-betweens (`atk_wind*`, `atk_recover`, `hurt_in1`, `cast_gather`, `daze*`) show the
  disguise; attack-, cast- and hurt-sourced ones show the creature. That is exactly the lore: "his idle continually
  restores the regal disguise; every action briefly exposes a different portion".

**Hollow Seraph (119/127), `hollow_seraph`, body `floating` + six wings, size boss, `floating: true`, 5 poses,
`attackAnim: heavy`.**

- `prompt`: a hovering hollow suit of elegant white and pale-gold armour with no body inside, the open helm showing
  only darkness, **a fractured golden halo floating above the helm**, and **exactly six articulated mechanical wings**
  (three per side) of overlapping metallic feathers in white steel with brass joints, half spread. Thin hanging
  greaves, no feet on the ground, a faint pale wind spiralling under her. Palette: white steel, pale gold, brass,
  storm grey, a cold white-blue glow.
- `attack`: the six wings sweep forward together, a crescent of cutting wind (pale streaks attached to the wing tips)
  thrown toward the heroes.
- `attack_raise` (compress): all six wings folded tightly around the armour, the halo dim, light leaking at the
  wing seams, the whole figure compact.
- `cast`: wings raised high and spread, the halo crackling with white-blue lightning, gauntlets lifted.
- `hurt`: a jolt, cracks across the breastplate, one wing pair faltering downward, **but the posture stays upright
  and controlled** (composure intact).
- `face`: no face; the empty dark helm opening and the halo are the readable features.
- `extra_negative`: a face, a body or skin inside the armour, feathered bird wings, more or fewer than six wings, a
  sword.
- Review add-on: **count the wings (6)**; the halo is not cut by the cell top (headroom rule).

The **Rime Sovereign** (`lich`) is unchanged: approved, rigged and locked. Only its data name and lore change (D2).

### 4.2 Other bosses and minibosses (G2)

| Sprite | Poses | Look (prompt seed) | attack / cast / hurt notes |
|---|---|---|---|
| `astos` (033) | idle, attack, cast, hurt | regal dark-elf usurper, ash-grey skin, long white hair, pointed ears, a jagged black crown, layered violet and black robes over thin silver armour, a staff ending in a sickle blade | attack: a sweeping sickle slash; cast: free hand raised with a black death sigil (his signature is RUB); hurt: crown slipping, robe flung |
| `warmech` (118) | idle, attack, cast, hurt | an ancient bipedal war machine of bronze and teal plates, reverse-jointed legs, a domed sensor head with one red lens, a cannon arm and a claw arm, exhaust vents | attack: claw smash with a forward stomp; cast (Nuclear): chest core and cannon charging white; hurt: sparks, a leg buckling. `body: biped` mechanical preset |
| `death_eye` (121) | idle, attack, cast, hurt | a colossal undead eye bound in grey grave cloth and a crown of bones, ghostly tendrils below, sickly yellow iris | attack: lunging stare with tendrils lashing; cast: iris flares with a violet time glyph; hurt: eye squeezed half shut. `floating: true` |
| `chaos` (128) | idle, attack, cast, hurt, attack_raise | **original design:** a colossal primordial titan of cracked obsidian, four arms, great tattered wings of shadow-flame, a horned crown, and seams of the four fiends' lights (frost cyan, ember orange, abyss teal, storm white) | attack: two right fists smashing down; cast: all four arms channelling a sphere; raise: both near arms raised overhead. The design must not reproduce any published Chaos art (D13) |
| `piscodemon` (032) | regular sheet (small) | anglerfish-headed demon, glowing lure, barbels, scale armour, webbed claws | no spells (spec) |
| `evil_eye` (075) | regular sheet (large) | floating eye with a fanged mouth and four eyestalks | Magic replays the attack frames in place (no cast key, D6/D7) |
| `dragon_zombie` (092) | regular sheet (large) | rotting dragon, torn wings, exposed ribs, ghost-green glow | quadruped winged recipe (the dragon's) |

`pirate` (017, the Pravoka group) and `vampire` (046) are built; no new art.

### 4.3 Prompt rules for regular monsters

- **Source:** the spec's description (form and battle role) + common folklore of the creature, condensed into the
  `prompt` (look only), `attack` and `hurt` lines, like the act-1 entries. Example (`gr_imp`): prompt "stocky
  red-brown goblin soldier in a dented iron pot helm and patched hide armour, a small round wooden shield on the far
  arm and a short iron-tipped spear"; attack "thrusting the spear forward at the heroes behind the raised shield";
  hurt "knocked back behind the shield, helm tipped over the eyes".
- **Original art only:** no game names, no "in the style of", no reference to published monster art (user rule).
  Classic names in data are fine (memory: personal game).
- **Style lock:** rev 3 prompts (no `prompt_rev`), so each request sends the guide, `approved/knight/battle.png` and
  `approved/ogre/monster_large.png`; old sprites are never sent.
- **Body-specific wording** (FW-9: emitted by `monster.prompt()` / `pose_prompt()` only when the entry sets `body:`, so
  no approved request's key changes; every new sheet of a body type gets the same line):
  - floating / swimmer: "hovering above the ground line, no shadow, no water"; uses `floating: true` (guide without
    a ground line).
  - serpent / rooted / naga: "coiled upright inside the box, the lowest coil resting on the ground line".
  - arthropod: "seen from the side, legs spread, every leg tip on the ground line".
  - blob: "a single soft mass resting on the ground line, a clear dark outline".
  - multi-head / multi-arm: the exact count in words, and the count in the review checklist.
- **Animatable poses:** attack and hurt within ~20-40 % change of idle; no 180-degree flips, no rear-ups taller than
  the box, props attached in every pose, headroom for overshoots (NEW_MONSTER_GUIDE 1.4).
- **Long creatures** (worms, crocodiles, sharks, sea snake) are drawn coiled, arched or three-quarter so they fit the
  square cell; no new band (wolf at 110x80 shows the cut already tolerates a wider figure). The Sand Worm's **sand
  mound is part of its body** (joined, its outline shared), like the Ashen Queen's altar.
- **Required `face:` overrides.** The default face rule ("its face (eyes, mouth or muzzle) is clearly readable",
  `monster.py:57`) would make Gemini paint faces on faceless creatures. These entries must set `face:`:

  | Sprites | `face:` text (summary) |
  |---|---|
  | green_slime, gray_ooze, ochre_jelly | no face, no eyes; the readable detail is the inner bone (slime) / the raised pseudopods (ooze) / the glossy lumps (jelly) |
  | black_flan | only a few small yellow eyes on the glossy surface, no mouth |
  | crawler | no eyes; a ring of short feelers at the front end is readable |
  | gigas_worm, lava_worm, sand_worm, purple_worm | no eyes; the round toothed maw is the readable feature |
  | fire / water / air elemental | a stern face formed from the flame / water / wind itself, no human skin |
  | earth_elemental, clay_golem, stone_golem, iron_golem | a blank head with glowing eye slits (earth: amber cracks; clay: the brow glyph; stone: rune eyes under the lintel; iron: furnace-glow slits) |
  | shadow | two white eye points in the black silhouette, nothing else |
  | wraith, specter | a dark hood opening with two cold lights |
  | ghost | a skull-like face in the wisp |
  | bigeyes, deepeyes, evil_eye, death_eye | the iris and pupil are the face; evil_eye adds the fanged mouth |
  | ochu, neochu | the toothy maw(s), no eyes |
  | black_widow, tarantula, scorpion, sea_scorpion | a small cluster of dark eyes, fangs/mandibles readable |
  | black_knight, death_knight, soldier, guardian, warmech | a closed helm visor / a skull in the helm (death knight) / a lens eye |
  | king_mummy | the gold death mask with two eye holes |

---

## 5. Body templates and in-betweens

### 5.1 What the framework has

- `biped` (`rig.py`), `quadruped` and `bird` (`rig_templates.py`), the 13-frame regular set and 22-frame boss set
  (`monster_recipes.py`), cloth mesh warp, props with carry, fx allowlist, holds, paint, locks and every check.
- **Not supported:** a floating body (no feet to pin, the feet check assumes a ground row), many legs, serpent coils
  as ground contact, more than two arms or necks in the recipes, scaling of non-fx parts (squash), and per-rig idle
  motion beyond the 1 px breath.

### 5.2 Templates and recipes (every recipe keeps the near-keyframe rule, |t| <= 0.35, whole-pixel joints)

| Recipe (sprites) | Template | Ground / pins | `idle_b` | wind1 / wind2 | mid / attack / follow / recover | hurt_in1 / hurt_in2 | daze / daze_b |
|---|---|---|---|---|---|---|---|
| biped (40) | `biped` (existing) | feet | upper body 1 px | arm back behind body, torso dy 1/2, head back | as act 1 | flinch: head 3, fists 3 | shared recipe |
| biped + wings (gargoyle, horned devil, chaos) | `biped` + wing joints `wsh/wel/wtip` (FW-5) | feet | upper body 1 px, wings ride | wings lift <= 10 deg on own roots | attack-sourced frames keep the spread wings | wings fold 15 deg, 4-6 px lower (vampire recipe) | wings droop |
| biped robed / reveal (drowned sovereign; robed casters) | `biped` with hem pins (FW-5) | hem contact points `hem_n/hem_f` as feet | upper body 1 px; robe cloth sway 1 px (FW-6) | robe hem pinned; sceptre arm back | tentacle parts `in: [attack, cast, hurt, attack_raise]` exist only in attack-sourced frames | `hurt_in1` = disguise, `hurt_in2` = tentacles erupting | disguise |
| biped mechanical (soldier, iron golem, warmech; guardian on quadruped) | preset: `sampler: nearest`, rigid parts only, policy rotation <= 15 deg | feet | upper body 1 px | translation-first, no limb bend > 15 deg | as biped | 1 px recoil shake via tweaks | lean 1-2 px, head dip |
| quadruped (26) | `quadruped` (existing) | four paws | spine 1 px | coil back, neck and head one angle | wolf/dragon recipes | rearing releases forepaws only here | shared |
| multi-head (hydra, fire hydra, chimera, rhyos, hellhound) | `quadruped` + `neck2/head2..` chains (FW-5) | four paws | spine 1 px | lead head draws back, others lag 1-2 px | lead head strikes, others follow at t - 0.1 | all heads recoil | every head droops (symbolic `head` = list) |
| bird / biped dinosaur (pyrolisk, wyvern, allosaurus, tyrannosaur) | `bird` (existing); wingless for dinosaurs | two feet | body 1 px | neck/head back, tail counter-swing | peck/bite reach | flinch | shared |
| serpent (cobra, anaconda, worms, wyrm, sea snake) | **`serpent` (FW-2):** `tail_tip t3 t2 t1 body0 neck head` (+ `jaw`) chain | contact joints `c_n`, `c_f` on the bottom coil, pinned in every frame (check 8 applies) | neck + head 1 px down | head and neck draw back and down, coil compresses | strike: chain extends toward the party, follow overshoot <= 1.10 then clamp | chain recoils away | head sinks toward the coil |
| rooted (ochu, neochu) | `serpent` preset: fixed root + K tentacle chains on own roots | the root mass | maw 1 px | lead tentacles pull back | lead tentacles whip, others sway 1-2 px | tentacles recoil, maw closes | tentacles droop |
| naga (medusa, earth medusa, water/spirit naga, ashen queen) | **`naga` (FW-3):** biped upper body + serpent lower; arms as a list `n f n2 f2 n3 f3` | coil contacts pinned (Ashen Queen: the altar) | upper body 1 px | attack arm set back (Ashen Queen: the near-side three) | as biped; per-arm sets accept lists | flinch | shared, `head` = crown + neck |
| floating (ghosts, eyes, elementals, shadow, hollow seraph, death eye) | **`floating` (FW-1):** root `core`, chains for wisps/tails/stalks, wings on own roots | none; a **float-band check** replaces check 8: idle-sourced frames keep the idle lowest row +-1 | whole sprite 1 px (ENEMY_ANIM_PLAN 4.1 row) | drift back 1-3 px, sink 1 px, wisps lag | from attack; follow drift <= 1.10 | tilt <= 10 deg, pushed back 2-3 px | sink 2 / 3 px, tilt 5 deg |
| swimmer (shark, white shark, piranhas) | `floating` preset + body chain | none (float band) | whole sprite 1 px | body S-curve coils (chain t - 0.2/-0.35) | lunge bite, chain straightens | body arches away | belly-up tilt <= 10 deg |
| arthropod (spiders, scorpions, crawler, centipedes, sea scorpion) | **`arthropod` (FW-4):** `body` root (+ `abdomen`, `tail` chains), legs `leg{i}_{n,f}: [coxa, knee, tip]` | every leg tip pinned (per-foot check) | body 1 px | body lowers 1-2 px and shifts back, fangs/pincers/stinger raise | body forward, fangs/pincers/stinger extend; centipedes rear with a body chain | body tips back, legs splay with tips fixed | body sinks to belly |
| blob (slimes, ooze, jelly, flan) | **`blob` (FW-6):** new frame op `squash: {sx, sy}` about the bottom centre, done by duplicating/removing whole interior rows and columns (outline rows kept), area within 0.85-1.15 | the base row | 1 row removed (sag) | squash sy 0.94 / 0.88, sx 1.04 / 1.08 | stretch toward the party (pseudopod from the approved attack), follow overshoot, recover bounce 1.03 | flatten sy 0.90, sx 1.10 / from hurt | sag sy 0.92 + 1 px lean |

Bosses add `cast_gather / cast_rise / cast / cast_release` (all bodies) and, with `attack_raise`, the pass F raise
set. Boss casts need a `cast` key, so they exist only for the 7 per-pose bosses (and the existing two).

### 5.3 Special cases

- **Drowned Sovereign reveal:** the robe-to-tentacle switch happens at the `atk_wind2 -> atk_mid` boundary (the
  troll's prop-swap precedent). If adjacent IoU fails there, use (in order) a settle `t`, coil forward in wind2, or
  one legal hold with a reason. The checks are not relaxed.
- **Ashen Queen arms:** six arm chains in `z` order (far set behind the torso). Recipes move the near-side set as the
  attack set; the far set moves half as far ("independent gestures"). Rotation caps apply per arm.
- **Hollow Seraph wings:** six wing parts on their own roots, unmarked in idle; `idle_b` may add a 1 px wing
  adjustment (FW-6, "constant minute adjustments"); the halo is an fx part (`halo`, allowlist edit) that brightens
  through `scale`/`paint` only at cast frames.
- **fx allowlist additions** (selftest_efix, approval needed): `ashen_queen sunfire`, `hollow_seraph halo` and
  `gust`, `drowned_sovereign abyss` (cast glow), `chaos core`, `warmech core`, `death_eye glyph`, plus any regular
  sheet whose approved attack draws breath (`white_dragon`, `blue_dragon`, `green_dragon`, `fire_hydra`, `chimera`,
  `rhyos`, `hellhound`, `winter_wolf`). Each addition is listed in the rig hand-off.

### 5.4 Framework work items (one owner, serial, RED-first in a selftest, every existing lock unchanged)

| Item | Work | Prototype rig (first sprite) | Effort |
|---|---|---|---|
| FW-0 | Budget guard: closed passes (`gemini_end`), `pass R build` (285) and later `pass R fix` (`only_approved`), `selftest_daze` rewrite, new `selftest_roster.py` (6.4) | - | 2 h |
| FW-1 | `floating` template + float-band check (replaces check 8 for `floating: true`), `swimmer` preset | `shadow`, then `shark` | 1 d |
| FW-2 | `serpent` template with coil contact joints; `rooted` preset (fixed root, K chains) | `cobra`, then `ochu` | 1 d |
| FW-3 | `naga` template; arm lists in recipes (`attack_hand: [n, n2, n3]`) | **`ashen_queen` directly** (the hardest case; G1 art is ready first); `medusa` etc. then reuse it. Batch order unchanged | 1.5 d |
| FW-4 | `arthropod` template (N leg chains, tip pins, tail/abdomen chains) | `black_widow`, then `scorpion` | 1 d |
| FW-5 | biped wings, robe hem pins, multi-head neck lists (`head` symbolic resolves to a list), mechanical preset | `gargoyle` (wings), `hydra` (heads), **`warmech` directly** (mechanical; G2 art is ready before batch D's soldier) | 1 d |
| FW-6 | `squash` frame op (blob); per-rig `idle_b` tweaks (wing flutter, robe sway) with a 1 px cap | `green_slime` | 1 d |
| FW-7 | fx allowlist entries as rigs request them | - | per request |
| FW-8 | Paged atlas build and `MAX_PAGE = 2048` (section 8), `MonsterPages.ts` runtime, `monster_roster_report.py`, `check --all` prints a stable `<id>: no rig` line for approved-but-unrigged sheets; per-sprite frame cache if the build exceeds 2 minutes | - | 1.5 d |
| FW-9 | **Before G1.** `monster.py`: (a) `idle_negative` appended to the negative of `boss_idle` (and the idle-only 3-pose wording) only; (b) a `body:` field selecting one per-body motion line (section 4.3) for 3-pose sheets **and per-pose bosses**; (c) the "base is part of the creature" sentence when `base:` is set (altar, sand mound). **Every addition is emitted only when its field is present**, so no existing prompt string changes. Selftest: recompute the request key of **every approved request** (`approved/*/*.json` cache keys) and assert all are unchanged | - | 3 h |

Every FW item lands with: `selftest.py` ALL PASSED, the rolling gate (`check --all`: only OK and `no rig` lines), `git diff --exit-code
assets-src/gen/anim/monsters/*.lock.json`.

---

## 6. Image budget

### 6.1 Per enemy

| Kind | Requests | Images |
|---|---|---|
| Regular (small/large) | `--sheets monster`: **one request, one image, 3 poses** (idle, attack, hurt) | 1 |
| Boss without raise (Astos, Warmech, Death Eye) | `boss_idle`, then `boss_attack`, `boss_cast`, `boss_hurt`, each with the approved idle as identity | 4 |
| Boss with raise (3 fiends, Chaos) | the 4 above + `boss_attack_raise` | 5 |
| Rematch, renamed or data-only entry | none | 0 |

### 6.2 Expected spend

Retry rates from the current ledger (2.): regular **1.30** images per approved sheet; bosses **1.40** (garland) to
**2.0** (lich) per pose, **1.70** together. New body types (blob, arthropod, multi-head, multi-arm, six wings) are
harder: plan **1.35** per regular sheet, **2.0** per fiend pose, **1.6** per other boss pose.

| Tranche | Sheets / poses | Base | Expected | Cumulative expected |
|---|---|---|---|---|
| G1 fiends | 3 x 5 poses | 15 | 30 | 30 |
| G2 bosses | Astos 4, Warmech 4, Death Eye 4, Chaos 5 | 17 | 27 | 57 |
| G2 minibosses | piscodemon, evil_eye, dragon_zombie | 3 | 4 | 61 |
| A (002-032) | 25 | 25 | 34 | 95 |
| B (035-066) | 27 | 27 | 36 | 131 |
| C (068-101) | 32 | 32 | 43 | 174 |
| D (103-123) | 18 | 18 | 24 | **198** |
| Fix pass | regenerations of approved sheets only | - | 0-15 | <= 300 |

- **Halt rule (binding D12):** building stops at the first of (a) every sheet in section 3.2 approved, (b) **285**
  pass-R attempts (`pass R build` refuses the 286th). The last **15** go only to fix-pass regenerations of sprites
  that already have approved art (`pass R fix`); the overall halt stays at 300. Order G1 -> G2 -> A -> B -> C -> D
  means that if 285 is reached, the fiends, bosses and the earliest regions are done. It is reached only if the
  average exceeds about 2.1 images per sheet.
- **Per sheet:** at most 3 attempts in pass R (1 + 2 retries, binding D9), counted over `gem[N0:]` for build and fix
  together. After 3, approve the best one with recorded nits, or mark the sprite **deferred** (no data entry, listed in
  the log). Never a 4th attempt.
- **What counts:** every Gemini `attempt` event in `gem[N0:]`, including failed calls (the ledger is authoritative).
  Bedrock is not used.

### 6.3 Checkpoint cadence

- **One paid request per review checkpoint** (`--paid --max-paid 1`, default): dry-run, pay, review, approve or
  retry, log, **commit** (9.2). Never batch paid requests.
- **One generator agent** in the main checkout on branch `roster` (refs live there; one writer for the ledger and
  `monsters.yaml`).
- Status report to the orchestrator after each tranche and at 100 / 200 / 250 / 285 images: images used, sheets
  approved, deferred, retries by body type.
- **Pause trigger:** 3 rejected attempts in a row on one body type -> stop that body type, fix the prompt wording
  (FW-9, keys of approved requests unchanged) offline, then continue with other types.

### 6.4 Budget guard change (FW-0, at R0, before the first pass-R image)

At 4fa9e27 the open pass F (5 of 5 used) refuses every new image, and `selftest_daze.run_ledger` fails on the first
non-pass-F attempt. The change (framework owner, RED-first, `N0` re-counted at R0; 100 at 4fa9e27):

```json
{
  "note": "User 2026-11-15 (roster pass R, docs/ROSTER_PLAN.md 6): up to 300 Gemini images for building every enemy; the earlier 100-image cap is retired. 285 for building, the last 15 only for fix-pass regenerations of approved sprites. At most 3 attempts (1 + 2 retries) per sheet. Bedrock is not counted (user, 2026-11-13).",
  "attempts_before": N0,
  "cap": 300,
  "max_attempts_per_sheet": 3,
  "passes": [
    {"name": "pass F (FB-8)", "note": "closed at R0", "gemini_before": 95, "gemini_end": N0, "max_new": 5, "max_per_sheet": 3},
    {"name": "pass R build", "note": "docs/ROSTER_PLAN.md 6.2", "gemini_before": N0, "max_new": 285, "max_per_sheet": 3}
  ]
}
```

At the start of the FIX tranche the framework owner closes `pass R build` (`"gemini_end": N1`, the count then) and
adds:

```json
{"name": "pass R fix", "note": "docs/ROSTER_PLAN.md 11.4", "gemini_before": N1, "max_new": 300 - (N1 - N0), "max_per_sheet": 3, "only_approved": true}
```

**`check_budget` rules after FW-0:**
- A pass with `gemini_end` is closed history: it refuses nothing.
- An open pass counts `attempts[gemini_before:]` and refuses when `len + misses > max_new`, or when a missed request's
  character+sheet already has `max_per_sheet` attempts in it (as today).
- `only_approved: true` refuses a request whose id has no `assets-src/gen/approved/<id>/` directory (message names
  the pass and the id).
- The top-level `cap` (300 over `attempts[attempts_before:]`) and `max_attempts_per_sheet` (3 over the same range)
  stay authoritative over both pass-R entries.

**`selftest_daze.run_ledger` rewrite (against 4fa9e27):**
- Read pass F by name; `new = gem[95:cap["gemini_end"]]`; the existing assertions (<= `max_new` 5, <= 3 per sheet,
  only garland/lich `boss_attack_raise`, garland <= 2) apply to that slice only.
- Replace the computed `end` check with the literal **`len(gem[69:cap["gemini_end"]]) <= 31`** ("the 100-image run
  ended at 31 of 100").
- Replace the `refused()` pass-F assertions (a closed pass cannot refuse) with: a fake ledger `gem[:N0]` plus one
  lich `boss_attack_raise` attempt is **not** refused by pass F (closed pass ignored).

**New `selftest_roster.py` (wired into `selftest.py`, and `--anim`):**
- the 286th `pass R build` attempt is refused (fake ledger `gem[:N0]` + 285 attempts on distinct sheets);
- the 301st pass-R attempt in total is refused (build closed at N1, fix open);
- a 4th attempt at one sheet in pass R is refused, a 3rd is not;
- a closed pass is ignored;
- in `pass R fix`, an id without `approved/<id>/` is refused and an approved id is not.
- the real ledger: `gem[N0:]` <= 300, per sheet <= 3, and every attempt after N1 has an approved id.

**Retries:** pre-approved by the user's instruction, <= 2 per sheet (binding D9); `--retry` is still required on the
command line. **Log:** `docs/ROSTER_LOG.md` (ACT1_LOG stays closed), one row per attempt `| # | <id>/<sheet> (seed) |
n | measured result | decision |` and "Images used: U of 300 (build B of 285, fix F of 15; ledger guard: G Gemini
attempts - N0)".

---

## 7. Data (`enemies.yaml`, `bestiary.yaml`, engine)

### 7.1 Stats: decision D4

- **New records take the spec's NES numbers**, converted by fixed rules, so the bestiary and the spec agree and the
  game keeps one FF1 scale.
- **The 14 existing entries keep their tuned numbers** (garland's FB-2 values, the 2x act-1 gold of FB-1, the lich's
  800 HP, the evade/accuracy/defense tuning below); only names, sprites and the new fields change. Rebalancing
  unplaced enemies waits until they are placed.
- **How well the rules match today's data** (checked against the six act-1 regulars at 4fa9e27): the rules reproduce
  the **goblin exactly**; elsewhere `evade` and `magicDefense` agree **within +-1** where the value was not tuned
  (gr_imp evade 9 vs 10, mdef 23 vs 24; skeleton mdef 17 vs 18; pirate mdef 15 vs 16: the spec's percentages are
  rounded), and `accuracy` matches goblin 2, gr_imp 4, gr_wolf 18 and pirate 2 exactly (wolf 5 vs 4). The tuned
  outliers are **gr_wolf evade 36 vs 54, pirate evade 6 vs 12, skeleton defense 12 vs 0 and accuracy 9 vs 2**; they
  stay as they are (D4).

**Parsing rules** (the spec's tables): strip thousands separators (`1,200` -> 1200, `32,000` -> 32000) and `%`;
`ATK x hits` splits on `x` (`1 x 8` -> attack 1, hits 8); literal 0 and 1 values are kept, never omitted or rounded
up (Chaos EXP 0 and gold 0, Death Eye EXP 1 and gold 1, Desert Baretta gold 1, every rematch gold 1, Sea Snake
crit 0 % -> `crit: 0`); DEF 255 (slimes) and MDEF 100 % (-> 200) are kept. The schema accepts 0 for rewards and crit.

| Spec column | `enemies.yaml` field | Rule |
|---|---|---|
| HP | `stats.hp` | as is |
| ATK x hits | `stats.attack`, `stats.hits` | as is; omit `hits` when 1 |
| DEF | `stats.defense` | as is |
| EVA % | `stats.evade` | round(2 x %) |
| MDEF % | `stats.magicDefense` | round(2 x %) |
| Hit score | `stats.accuracy` | 2 x score - 168 |
| Critical % | `stats.crit` | omit at exactly 1 % (default 1 of 200); 0 % -> 0; else round(2 x %) |
| EXP / Gold | `xpReward` / `goldReward` | as is |

**Secondary stats** (not in the spec). Only `agility` matters for enemies (the turn-order key); the rest are shown in
the bestiary only. One formula for every new entry:
- `agility = 5 + round(EVA % / 3)`, which for a new entry equals `5 + round(evade / 6)` exactly (its `evade` is
  2 x EVA %). From the spec EVA it reproduces goblin 6, gr_imp 7 and gr_wolf 14 exactly, and wolf (11 vs 12),
  skeleton and pirate (7 vs 6) within 1; the range is 5 (EVA 0 %) to 29 (Air Elemental, 72 %).
- `strength = max(1, round(0.8 x attack))`, `vitality = max(1, round(defense / 2) + 2)` (DEF 255 clamps to 99),
  `intelligence = 1 + 3 x (number of spells)` (max 25), `luck = 5`.
- Test (`tests/data/rosterStats.test.ts`): every entry with `num` and no `tuned: true` marker satisfies the agility
  formula; the 14 existing entries carry `tuned: true` and are exempt.

**Rematch records** (124-127): every combat stat = round(first-battle **game** stat x spec rematch / spec first) for
that stat (unchanged when either spec value is 0 or they are equal); rewards, elements, protections, spells and
specials are the spec rematch row's. So `lich_2` HP = 800 x 500 / 400 = **1000**; the new fiends' first battles use
spec numbers, so their rematches equal the spec rematch rows (Ashen Queen II 700, Drowned Sovereign II 900, Hollow
Seraph II 1,100 HP). Test: each rematch's HP >= its first battle's and `sprite` equals it.

### 7.2 New and changed fields (FW-D, the TS/data owner)

| Field | Content | Engine |
|---|---|---|
| `num` | spec number 1-128 | bestiary number and order (`order: data` sorts by `num`, falls back to index) |
| `name` | spec modern name, ASCII; fiends: Rime Sovereign, Ashen Queen, Drowned Sovereign, Hollow Seraph (D2); rematches with " II" | see the fallout list (7.5) for name widths |
| `tuned` | `true` on the 14 existing entries | exempts them from the derived-stat test |
| `elementalProfile` | weaknesses / resistances from the spec (Fire, Ice, Lightning); legacy `weakness`/`resist` kept for one element | existing |
| `statusWeak` | spec "Poison/Stone" or "Status" weaknesses (Red Dragon, Tiamat, Marilith slots) | display now; a status-hit bonus is a follow-up |
| `protect` | `[status, poison_stone, death, earth, time]` from the spec's protection flags | **D5:** one table in `SpellStatus.ts`: `status` -> `sleep stun blind silence fear` **plus the Slow debuff (`debuff_speed` from SLOW/SLO2) and Confuse (CONF)**; `poison_stone` -> `poison stone`; `death` -> `death`. A protected effect misses with the normal miss message (unit tests per category). `earth` and `time` are shown only (no spell yet) |
| `attackStatus` | spec "Can inflict poison / paralysis (stun) / sleep / blindness / petrification / instant death" | display now; on-hit statuses are a follow-up (E-F2) |
| `spells` | spec spell codes, lowercased (`rub slo2 fast fir2 ...`) | bestiary shows names (spec glossary names for codes not in `spells.yaml`) |
| `ai` | `{rate, actions: [{type: magic, spellId, weight}]}` built from `spells` **that exist in `spells.yaml`** + the spec's use rate | `BattleScene.attachEnemyAi` reads `data.ai` when no debug `enemyAi` is given |
| `specials` | spec specials (`gaze`, `cremate`, `ink`, ...) with rate | display now; abilities are follow-up E-F1. Existing `attackEffect: fire_breath` stays on the Red Dragon |
| `family` | FF1-style: undead, giant, aquatic, dragon, were, magical | `aquatic` gets a bestiary label |
| `bossPhases` | fiends and story bosses at 50 % (lore: Rime Sovereign flare, Ashen Queen inferno, Drowned reveal) | existing; `attackAnim` per phase (Drowned, Ashen: heavy only in phase 2) is a small engine change in FW-D |
| `attackAnim: heavy` | bosses with `attack_raise` | existing |
| `size` | from the roster | existing |

**BossAI targeting (FW-D, required by `ai`).** `BossAI.selectAction` today picks a living party member for every
action. It changes to pick by the chosen spell's `targeting`: `single`/`all` -> the party (as today); `single_ally`
-> a living enemy on its own side (the lowest HP fraction first, so healers heal the hurt ally); `all_allies` -> its
own side; `self` -> itself. Unit tests (`tests/battle/BossAI.test.ts`): **an enemy casting CURE never targets a
hero** over 1,000 seeded draws; RUSE (self) targets the caster; FIR2 (all) still hits the party.

Validation: `schemaValidation` accepts the new fields; `crossFileValidation` checks `ai.spellId` in `spells.yaml`,
`protect` values, `num` unique in 1-128, rematch sprites, every `sprite` in the atlas index.

### 7.3 Bestiary

- **Descriptions** (`description` in `enemies.yaml`, like `items.yaml`): one or two in-world lines per enemy, ASCII
  (NES font), written from the spec description and the creature's folklore; mechanics stay in the stats panel.
- **Lore** (`bestiary.yaml` `lore: {id: [pages]}`): the four fiends' stories from "New Fiends", edited to ASCII
  (no em dashes, curly quotes or italics) and split into pages; boss lore for Garland, Astos, Vampire, Chaos (short).
  Rematches show the fiend's lore.
- **UI** (FW-D, files under 250 lines): the stats panel already uses all 17 `STAT_LINES`, so the description does
  **not** go under it. A second panel page, **Info**, toggled by a key (label and help text in `bestiary.yaml`),
  shows the description, then the lore pages (if any) in the same 17-line, 56-column box. The Immune row adds status
  protections; numbers from `num`; 128-entry scrolling is already paged (`listRows: 6`).
- **Backgrounds:** per-enemy entries in `backgrounds.enemies`, mapped by habitat to the committed staged ids only;
  each key lands **in the same commit as its enemy entry** (`bestiaryData.test` requires every override key to be an
  enemy).
- **Habitat:** every new enemy shows "Not placed yet".

### 7.4 Placement, scenarios, coverage

- **No new encounter placements** (only act 1 exists; the rest of the world is legacy). Act-1 tables are unchanged;
  `gr_imp` and `gr_wolf` appear with their new art (small, page 0; section 1 act-1 criterion).
- **Coverage:** `assetCoverage.test.ts` requires an atlas sheet for every enemy. So an `enemies.yaml` entry lands only
  after its sheet is approved and in the atlas (as `anim: false` aliases until its rig is locked). Rematches land with
  their fiend.
- **Sandbox and scenarios:** a sandbox level per batch (`roster_g1`, `roster_g2`, `roster_a` .. `roster_d`) with
  formations of up to 9 small, 4 large, mixed 2 large + 6 small, and each boss alone; `anim_roster_<batch>` debug
  scenarios for `&enemyAnim=loop|step`.

### 7.5 Data, test and UI fallout (each item lands with the change that causes it)

| Item | Where | Change |
|---|---|---|
| Bestiary numbers and title | `tests/scenes/bestiary/bestiaryModel.test.ts:30-34` pins `014 Lich`, `013 Garland  13/14` | expectations follow `num` (`012 Garland`, `049 Rime Sovereign`); updated, not deleted |
| `titleCount` with gaps | `bestiaryModel.ts:54` (`index/total`) | while entries are missing, `index` is the list position and `total` the listed count; the label carries `num` (e.g. `049 Rime Sovereign  15/22`); a test for a gap |
| ASCII test | `bestiaryModel.test.ts:146` uses `titleCount(e, 14, data)` | uses the real entry count |
| Description placement | 17 `STAT_LINES` | the Info page (7.3), not a box under the stats |
| Phase message | `enemies.yaml` lich `"The Lich's form shifts!"` | becomes "The Rime Sovereign's skull fractures!"; `BossBattle.test` / `BossAI.test` use their own fixtures (unchanged) |
| Long names | `turnListFit.test.ts` (340 px command window; `fitEntry` shortens the target first) | add real-data cases for the longest names (`Drowned Sovereign II`, `Minotaur Zombie`, `White Crocodile`); the battle enemy list gets the same width check; `shortName` only if a case fails |
| Background keys | `bestiaryData.test` "every override key is an enemy" | keys land with their enemy |
| Display renames | Gr.Imp -> Goblin Guard, Gr.Wolf -> Warg Wolf, Dragon -> Red Dragon, Lich -> Rime Sovereign | grep tests for the old display names that read real data and update them |
| Variants removed | `assetCoverage` "variants match their base's keys" | the gr_imp/gr_wolf cases become ordinary sheets |
| Atlas JSON shape | the 15 atlas readers in 2. | fixtures gain per-sheet `page` and the page list (section 8) |

---

## 8. Atlas pages, memory and runtime streaming

**Size estimate** (roster tally): 124 sprites, about **1,680 frames**; average cells small ~90x80, large ~136x128,
boss 200x200 -> about **26 Mpx of cells**. At 85 % shelf efficiency that is **7-8 pages of 2048^2** (+ slack for
grouping). All pages resident: ~110 MB of RGBA texture memory, too much to keep loaded.

**Build (FW-8):**
- `anim_rules.MAX_PAGE = 2048`; `page_size` checks every page (today's page 0 is 2040x1872, so it already passes).
- `monster_atlas.py` packs sprites into **page groups in a stable order**: page 0 = today's act-1 sheets (incl. the
  new gr_imp/gr_wolf, so act-1 battles load one page), then G1+G2, then batches A-D. A group spills onto a new page
  when full. Adding a sprite to a later group never moves cells on earlier pages.
- Files: `monsters-ai.json` (index: `pages: [{file, w, h}]`, per sheet `page` and rects) + `monsters-ai-<n>.png`.

**Runtime: new module `src/rendering/MonsterPages.ts`** (all page logic lives here; `BattleDisplayManager.ts` is at
246 of its 249-line ceiling and is not touched):
- `ensure(sprites: string[]): Promise<void>` loads the pages those sprites live on (deduplicated, in-flight loads
  shared); `isReady(sprite): boolean`; `texturesFor(sprite)` for `BattleArt`.
- **Refcounts:** every Texture handed out holds its page; `release` on view destroy / bestiary entry change. The LRU
  (capacity 2 unreferenced pages) **never unloads a page with a live refcount or with Textures held in
  `BestiaryScene`'s `CachedArt`**.
- **Callers:**
  - `BattleTrigger.triggerBattle` **awaits `battleArt.ensure(formation sprites)` before `this.game.scenes.push('battle')`**
    (`BattleTrigger.ts:105`), so battles normally draw art synchronously.
  - `BattleArt` checks `isReady` per sprite; a sprite that is not ready takes the **existing late-art path**
    (placeholder, one warning, swap when the page arrives: A14/A15), so a failed or slow page never blocks a battle.
  - `ExplorationScene.enter` preloads page 0 only; `BestiaryScene` ensures the current entry's page and prefetches the
    neighbour's; `BestiaryPreview` releases on entry change.
  - `AiEnemyView`, `enemyChoreography` and `BattleDisplayManager` keep reading per-sheet metadata through `BattleArt`
    (unchanged API); the JSON loader in `BattleArt` reads the index.
- **Tests:** page selection and dedup; LRU never evicts a referenced or cached page; `triggerBattle` pushes the scene
  only after `ensure` resolves (and still pushes when a page fails, with the warning); late-art when not ready; the
  existing atlas tests (2.) updated to the paged fixture shape.

**Determinism and equality:** both hash seeds give identical pages and JSON; the frame-rect equality script (12.2)
compares by `(sheet, frame)` across pages against the R0 commit. **PNG size:** ~0.7 MB per page -> ~6-7 MB total,
loaded lazily. **Build time:** measure after batch A; if `monsters_ai` exceeds 2 minutes, cache generated frames per
sprite keyed by (rig yaml, approved PNGs, framework version) in git-ignored `out/`.

---

## 9. Process per enemy, ownership and parallelism

### 9.1 Pipeline (NEW_MONSTER_GUIDE, per sprite)

1. **Declare** in `monsters.yaml` (generator): id, size, prompt, attack, hurt (+ boss fields), face, seeds `[1234]`.
2. **Dry run** (0 cost): prompt and inputs read.
3. **Paid request** (one): `generate.py <id> --backend gemini --sheets monster --paid` (bosses: `boss_idle` first,
   then one pose per checkpoint).
4. **Review checklist** (guide 1.4, all binary) **+ roster checks:** anatomy count (arms, wings, heads, legs), the
   sibling side-by-side (3.3), the face rule, facing right, the body-type ground rule (feet row, float band, coil
   contact).
5. **Approve** (`approve.py`, `--flip-frames` if one cell faces left), **log** the row in `ROSTER_LOG.md`, and the
   generator **commits its own outputs** on `roster` (approved files, `cache/<key>.*`, `ledger.jsonl`, the log row; a
   rejected attempt commits the ledger and log only).
6. **Integrate the sheet** (integrator, on `roster-int`): merge `roster`, build the atlas page with `anim: false`,
   add the `enemies.yaml` + `bestiary.yaml` entry (data owner's commit merged in), commit. The enemy is in the game
   and the bestiary now, with keyframes only.
7. **Rig** (rig agent): mark -> calibrate -> iterate (<= 4; a template prototype <= 6) -> `check` -> `review`.
8. **Image-only review** (fresh agent: strips, onion, GIFs, `_stage.png`, the approved sheet, criteria 1-6 of guide
   3.4 + the roster add-ons): SHIP / SHIP WITH NITS / ITERATE.
9. **Lock** after SHIP, restore the local atlas, hand off (checklist of ENEMY_ANIM_PLAN 7 + iteration count + nits).
10. **Integrator** merges the rig branch into `roster-int`, rebuilds the atlas page, runs the rolling gate
   (`check --all`: only OK and `no rig` lines), the browser loop of the batch scenario, commits.

### 9.2 Ownership

| Role | Owns (only) | Count |
|---|---|---|
| Generator | `monsters.yaml`, `approved/<id>/`, `cache/<key>.*`, `ledger.jsonl`, `ROSTER_LOG.md` image rows; **the main checkout on branch `roster`**, committing at every checkpoint | 1, serial |
| Framework owner | `rig*.py`, `monster_*.py`, `anim_*.py`, `spec.py`, `monster.py`, `generate.py`, selftests, `budget.json` | 1, serial |
| TS/data owner | `src/`, `tests/`, `enemies.yaml`, `bestiary.yaml`, `debug-scenarios.yaml`, `debug-sandbox.yaml` | 1 |
| Rig agents | `anim/monsters/<id>.yaml` + `.lock.json` for their sprites | up to 8 in parallel, worktrees, one body type per agent (3-6 sprites) |
| Image-only reviewers | verdicts only | fresh per sprite |
| Integrator | atlas pages and JSON, merges, `check --all`, AGENTS.md / guide updates; **its own worktree on branch `roster-int`** | 1 |
| Adversarial tester | `ROSTER_PLAYTEST.md` | 1-7 fresh agents (section 11) |

- **Branches.** `roster` (generator, main checkout) carries only generator commits plus fast-forwards.
  `roster-int` (integrator worktree) merges `roster`, the framework owner's and TS/data owner's branches, and each
  rig branch, and is the only branch with atlas pages. The generator **fast-forwards `roster` to `roster-int` only
  between checkpoints** (never with an uncommitted attempt), so its ledger stays linear and it picks up FW-9 changes.
  Rig agents branch from `roster-int` **after** the integrator has merged their sprite's approval; they run
  `selftest.py --anim` and restore `assets/sprites/monsters-ai*` before hand-off. Framework and TS/data owners work in
  their own worktrees off `roster-int`.
- A rig needing a framework change files it with the framework owner; nobody else edits framework files.
- Generation runs ahead of rigging: the generator only needs the prompt wording (FW-9), not the templates.

### 9.3 Iteration budget and escalation

4 iterations per new sprite, 6 per template prototype, 3 per fix round; then stop and report (strips, failing
criterion, options: a legal hold, a framework fix, the orchestrator). No paid fallback for rig problems.

---

## 10. Tranches

| Tranche | Scope | Owner / parallelism | Depends on | Effort |
|---|---|---|---|---|
| R0 | After the feedback fixes are merged and validated: count N0, branch `roster` (main checkout) and `roster-int` (integrator worktree) off `feedback`, FW-0 budget guard + selftests (the R0 commit), `ROSTER_LOG.md` | orchestrator + framework owner | - | 0.5 d |
| R1 | FW-9 prompt fields (**must land before G1**: 3 h); FW-D data fields, BossAI targeting, data-driven AI, `protect`, bestiary `num`/Info page/immune; FW-8 paged atlas + `MonsterPages.ts` | framework owner and TS/data owner in parallel | R0 | 3 d |
| G1 | Fiends: 15 poses (idle first per fiend), approvals, data entries (+ rematches) | generator | R0, FW-9 | 1 d gen |
| G2 | Astos, Warmech, Death Eye, Chaos (17 poses); piscodemon, evil_eye, dragon_zombie | generator | G1 | 1 d gen |
| T-proto | Template prototypes FW-1..FW-6 with their first sprites (naga on `ashen_queen`, mechanical on `warmech`, the others on their batch-A/B sprite) | framework owner + 1 rig agent per template | R1; first sprites approved | 5-6 d serial (framework), rigs alongside |
| A-D gen | 102 regular sheets in bestiary order, one checkpoint each | generator | G2 (order), FW-9 | ~4-5 d |
| A-D rigs | 102 regular rigs | up to 8 rig agents, grouped by body type; bipeds/quadrupeds start at once, others after their template | template per body | ~45 agent-days -> ~6-8 d wall |
| Boss rigs | 7 boss rigs (fiends 1.5-2 d each, others 1-1.5 d) | 4 rig agents | FW-1/3/5, G1/G2 | ~10 agent-days |
| INT | Atlas pages, `check --all`, full validation (12), docs (AGENTS.md art table, guide 2.2 templates, `gen/README.md`) | integrator | rolling, final after all rigs | 1 d final |
| PT | Adversarial visual play test (11.1-11.3) | testers | INT | 1-2 d |
| FIX | Close `pass R build`, open `pass R fix` (6.4); fix plan -> momus -> fixes -> re-test (11.4) | framework owner, planner, momus, rig owners | PT | 2-4 d |

Total: roughly 3 weeks wall time with 8 rig agents; the rig queue, not the images, is the critical path.

---

## 11. Final adversarial visual play test -> fix plan -> fixes

### 11.1 Automated pre-pass (no agents)

- `monster_anim.py check --all` (final gate: only OK), `selftest.py`, the build checks of section 12.
- **Roster contact sheet** and **distinctness report** (committed report-only tool `monster_roster_report.py`,
  FW-8): every idle at 1x and 2x grouped by the sibling groups of 3.3. Per pair in a group (and every pair of the same
  body type and size):
  - **silhouette IoU**: alpha masks bottom-aligned, scaled (nearest) to a common 64 px height, centred, best over
    horizontal shifts of +-4 px and a mirror;
  - **interior edge IoU**: the same alignment over pixels where the colour index changes (inner lines: armour seams,
    face, props), which a palette swap keeps and a redesign does not.
  - **Flag "reads as a recolour" (P1 for the reviewers):** silhouette IoU >= **0.85** and edge IoU >= **0.60**.
    **Watch list:** silhouette IoU >= **0.75**. Why these numbers: a palette swap scores 1.0 / 1.0, while two
    different designs of one body type differ in props, head and posture, which costs well over 15 % of the
    silhouette and almost all inner lines; 0.75 leaves a margin for siblings that share a body plan.
  - **Calibration at R1** (on the R0 commit's atlas): goblin vs old gr_imp and wolf vs old gr_wolf must be flagged;
    ogre vs troll, goblin vs pirate, skeleton vs mummy and wolf vs dragon must not. If a distinct existing pair lands
    above a threshold, the threshold becomes that pair's value + 0.02, recorded in the report header.
  - The report decides nothing alone: reviewers judge every flagged and watched pair (R1 in 11.2).
- Per-sprite metrics: colours <= 16, outline present, figure height in band, lowest row on the feet row or float
  band, F6 roughness top list.

### 11.2 Image-only adversarial review (fresh agents, about 20 sprites each, in parallel)

Inputs: contact sheets, strips, onion, GIFs, `_stage.png`, approved sheets. No rigs, no code, no hypotheses. Criteria
per sprite (yes/no + severity): guide 3.4 items 1-6, plus

| # | Probe |
|---|---|
| R1 | Distinct from every sibling (3.3) at 1x battle size; no pair reads as a palette swap |
| R2 | Anatomy matches the brief (arm/wing/head/leg counts; Ashen Queen 6 arms, Hollow Seraph 6 wings, hydras 3 heads) |
| R3 | House style: pixel size, outline, top-left light, palette count, no soft gradients; matches the knight and ogre refs |
| R4 | Scale reads right next to the party and next to its size class (a piranha is not as tall as a troll) |
| R5 | Faces readable per the face rule; facing right in every frame |
| R6 | Feet on the plain (grounded), steady float band (floating), coil/root contact fixed (serpent, naga, rooted) |
| R7 | Body-specific motion: squash keeps the outline (blob), legs stay planted (arthropod), wings and arms stay attached |
| R8 | Fiend identity: Drowned disguise intact in idle frames and tentacles only in action frames; Seraph composure in hurt; Ashen Queen arms in gesture sets |

### 11.3 Browser play test (Playwright, `npm run dev`, every URL with `&mute=1`)

- **Bestiary walk:** all built entries in order, every animation step (attack, hurt, cast, daze), the description
  and lore pages, the immunity row, "Not placed yet"; page loads in the network log (only needed pages).
- **Sandbox battles:** each `roster_*` level, all formations; `&enemyAnim=loop` 3 cycles; `&enemyAnim=step`
  screenshots for suspects; probes A1-A20 (ENEMY_ANIM_PLAN 8) on a sample of each body type and every boss; lethal
  hits mid-lunge, sleep/stun daze, stone, Run, victory.
- **Performance:** `anim_crowd`-style formation mixing three pages: FPS median, no placeholder flash after the
  first battle.
- **Output:** `docs/ROSTER_PLAYTEST.md`: one row per defect `| id | sprite | frame/sequence | probe | severity P0/P1/P2
  | evidence path | suspected cause: base art / rig / framework / runtime / data |`.

### 11.4 Fix plan, momus review, fixes

1. A planner agent writes `docs/ROSTER_FIX_PLAN.md`: defects grouped by cause, a fix per defect (rig change, framework
  change RED-first, runtime change with a test, or base-art regeneration), owner, iteration budget, re-test probe,
  and the binary acceptance check.
2. **Momus** reviews the fix plan; revise until OKAY (max 3 rounds, then escalate to the orchestrator).
3. Fixes: rig-only by default. A base-art regeneration is allowed only if the defect is in the approved pixels, the
  sheet has used fewer than 3 pass-R attempts, and `pass R fix` has room (the guard refuses ids without approved art);
  it restarts that sprite at step 4 of 9.1.
4. Re-review (image-only), re-lock, integrator rebuild, then the tester re-runs every failed probe plus a regression
  sample (one sprite per body type, every boss).
5. Done when no P0/P1 is open; P2s are fixed or recorded as accepted nits.

---

## 12. Validation commands

### 12.1 Commands

```bash
# budget and ledger (pass R): N0 is read from the pass-R entries, never typed
python3 -I - <<'EOF'
import json, os
from collections import Counter
B = json.load(open('assets-src/gen/budget.json'))
build = next(p for p in B['passes'] if p['name'] == 'pass R build')
fix = next((p for p in B['passes'] if p['name'] == 'pass R fix'), None)
L = [json.loads(l) for l in open('assets-src/gen/cache/ledger.jsonl') if l.strip()]
g = [e for e in L if e.get('event') == 'attempt' and e.get('backend') != 'bedrock']
n0 = build['gemini_before']; r = g[n0:]
c = Counter((e['character'], e['sheet']) for e in r)
b = g[n0:build.get('gemini_end', len(g))]
f = g[fix['gemini_before']:] if fix else []
print('pass R', len(r), '<= 300', len(r) <= 300, '| build', len(b), '<= 285', len(b) <= 285,
      '| fix', len(f), 'approved ids only', all(os.path.isdir(f"assets-src/gen/approved/{e['character']}") for e in f),
      '| max per sheet', max(c.values(), default=0), '<= 3')
EOF
grep -c 'variants:' assets-src/gen/monsters.yaml            # 0
# pipeline (main checkout; worktrees: --anim)
python3 -I assets-src/gen/selftest.py
python3 -I assets-src/gen/monster_anim.py check --all          # rolling: only "OK" and "no rig" lines; final: only "OK"
python3 -I assets-src/build_assets.py monsters_ai battle_ai field_ai
git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai* > /tmp/a.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum -c /tmp/a.sha
# no placement changes since R0
git diff --exit-code "$(git rev-parse roster-r0)" -- assets-src/tools/layouts assets/maps/temple-of-fiends.yaml
# TypeScript
npx tsc --noEmit && npm run build && npm test
npx vitest run tests/data/assetCoverage.test.ts tests/data/crossFileValidation.test.ts tests/data/bestiaryData.test.ts \
  tests/data/rosterStats.test.ts tests/data/actOneBalance.test.ts tests/systems/actOneEncounters.test.ts tests/battle/BossAI.test.ts
# browser
#   http://localhost:5173/?mute=1&scenario=anim_roster_a&enemyAnim=loop   (and =step); sandbox levels roster_*
```

`roster-r0` is a tag on the R0 commit (created at R0).

### 12.2 Frame-rect equality across pages (baseline: the R0 commit)

The R0 commit has the single-page atlas (`monsters-ai.png`, every sheet `page: 0`); later commits have the paged
index. The script reads either shape and compares every `(sheet, frame)` cell byte for byte:

```bash
mkdir -p /tmp/r0 && git show roster-r0:assets/sprites/monsters-ai.json > /tmp/r0/monsters-ai.json
git show roster-r0:assets/sprites/monsters-ai.png > /tmp/r0/monsters-ai.png
python3 -I - <<'EOF'
import json, os
from PIL import Image
def cells(d):
    m = json.load(open(os.path.join(d, 'monsters-ai.json')))
    files = [p['file'] for p in m['pages']] if 'pages' in m else ['monsters-ai.png']
    pages = [Image.open(os.path.join(d, os.path.basename(f))).convert('RGBA') for f in files]
    out = {}
    for s, v in m['sheets'].items():
        im = pages[v.get('page', 0)]
        for f, (x, y) in v['frames'].items():
            out[(s, f)] = im.crop((x, y, x + v['cell'][0], y + v['cell'][1])).tobytes()
    return out
a, b = cells('/tmp/r0'), cells('assets/sprites')
# fix pass F5 (ROSTER_FIX_PLAN.md 5): the act-1 sprites whose frames change on purpose
CHANGED_ON_PURPOSE = {'gr_imp', 'gr_wolf', 'lich', 'garland', 'vampire', 'ogre', 'troll'}
bad = {}
for s in sorted({s for s, _ in a} - CHANGED_ON_PURPOSE):
    diff = [f for (t, f) in a if t == s and a[(t, f)] != b.get((t, f))]
    print(s, diff or 'same')
    if diff: bad[s] = diff
raise SystemExit(1 if bad else 0)
EOF
```

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini miscounts limbs (6 arms, 6 wings, 3 heads) or drifts in style over 112 sheets | retries, budget | counts in prompt words and the checklist; fixed style refs; pause trigger per body type (6.3) |
| The 285 build cap fires before batch D | late enemies unbuilt | fiends and bosses first; expected ~200; tranche reports; deferred list in the log |
| Rig throughput (112 rigs, ~4 iterations each) | schedule | up to 8 rig agents by body type; `anim: false` keyframe-only interim so data and the bestiary are never blocked |
| New templates can't pass the existing checks (float band, squash outline, reveal IoU) | holds or stuck rigs | template prototypes first with RED-first selftests; legal holds (<= 1 per sequence); checks are not relaxed without the orchestrator |
| FW-9 prompt changes alter an approved request's cache key | approved art no longer reproduces | additions emitted only when their field is set; selftest recomputes every approved key |
| Framework edits change existing frame bytes | 12 locks churn | every FW item must leave the locks unchanged; otherwise review and re-lock in the same commit |
| Paged atlas and streaming bugs (placeholder flashes, wrong page) | visible pops | preload in BattleTrigger; A14/A15 probes; unit tests for page selection |
| Texture memory on low-end devices | crashes | 2048 pages, LRU of 2 in the bestiary, only formation pages in battle |
| Binary conflicts on the atlas | lost work | one integrator; rig agents restore the atlas |
| Contention on `monsters.yaml`, `enemies.yaml`, `bestiary.yaml` | merge conflicts | single owners (9.2) |
| Spec stat scale vs the game's tuned act-1 values | odd numbers in the bestiary | D4: spec for new, existing kept; rebalance when placed |
| Status protections change act-1 play (skeletons become immune to Sleep) | balance | D5 default enforce; re-run the act-1 sim and `actOneBalance` |
| Copying published designs (Chaos, Mindflayer, Evil Eye) | user rule | original briefs (3.2, 4.2); reviewer probe R3 |
| Work still landing on `feedback` (the last boss fix rewrote `budget.json` and `selftest_daze.py`) | ledger count, conflicts | R0 waits until the feedback fixes are merged and validated; N0 recounted then; FW-0 written against that HEAD |
| Long names overflow the battle enemy list | UI | a width test; `shortName` only where needed |

---

## 14. Decisions for the orchestrator

| # | Decision | Default (recommended) | Alternative |
|---|---|---|---|
| D1 | Rematch records | separate entries `lich_2`, `ashen_queen_2`, `drowned_sovereign_2`, `hollow_seraph_2`, named "<fiend> II", with the fiend's sprite and stats scaled by the spec's rematch/first ratio (7.1; `lich_2` HP 1000) | omit rematches until the final dungeon exists |
| D2 | Fiend names | display "Rime Sovereign", "Ashen Queen", "Drowned Sovereign", "Hollow Seraph"; ids `lich` (kept), new snake_case ids | keep "Lich" as the name |
| D3 | gr_imp / gr_wolf | keep ids, new distinct sprites under the same id, names "Goblin Guard" / "Warg Wolf" | rename ids (touches maps, sandbox, scenarios, 7 test files) |
| D4 | Stats | spec NES numbers by the 7.1 rules for new records; the 14 existing entries keep their tuned numbers | re-base every unplaced entry to the spec |
| D5 | Status protections | `protect` data + bestiary row + enforcement in the status roll; `status` also blocks Slow and Confuse (unit tests; re-run act-1 balance) | display only |
| D6 | Cast keyframe for regular casters (Ogre Mage, Horned Devil, Dark Wizard, Evil Eye, Rakshasa, nagas, Death Knight, Vampire Lord, Dark Fighter, golems; ~13) | none in pass R; Magic replays the attack frames in place (D4 of ENEMY_ANIM_PLAN) | a single-pose `monster_cast` sheet (+13-18 images, framework work), only after every enemy is built |
| D7 | Boss tier | per-pose bosses: 3 fiends + Chaos (5 poses), Astos, Warmech, Death Eye (4); Evil Eye, Dragon Zombie, Piscodemon as regular sheets | Evil Eye per-pose (+3-4 images) |
| D8 | Phase visuals (Rime Sovereign fracture, Ashen inferno, whirling ice) | out of scope; follow-up | a phase-2 keyframe set per fiend (+5 images each) |
| D9 | Approval and retries | self-approve on the binary checklist; <= 2 retries per sheet pre-authorised by the user's instruction (**binding**) | ask the user per retry |
| D10 | Atlas | pages <= 2048^2 in stable groups, streamed | 4096 pages (fewer files, 64 MiB each) |
| D11 | Placement | no new encounters in pass R | - |
| D12 | Halt | **binding:** building stops at 285 (`pass R build`), the last 15 only regenerate approved sprites in the fix pass (`pass R fix`), overall halt 300; finish rigs and data for approved sheets; deferred list | - |
| D13 | Chaos design | the original titan of 4.2 (**binding**) | - |
| D14 | Descriptions | in-world lines written from the spec + folklore; fiend lore from the spec | the spec text verbatim |
| D15 | Budget guard | 6.4: pass F closed at N0; `pass R build` 285; `pass R fix` (300 - used, approved ids only) at FIX; 3 per sheet | - |

---

## 15. TODOs

```markdown
## TODOs
- [ ] R0: confirm the feedback fixes are merged and validated; count N0; tag `roster-r0`; branch `roster` (main checkout) and `roster-int` (integrator worktree) (priority: high, effort: 0.5h)
- [ ] FW-0: budget.json (pass F closed at N0, pass R build 285); check_budget closed passes + only_approved; selftest_daze rewrite; selftest_roster.py (286th build, 301st total, 4th per sheet, closed pass ignored, unapproved id in fix) RED->GREEN (high, 2h)
- [ ] R0: create docs/ROSTER_LOG.md with the run table and "Images used: 0 of 300 (build 0 of 285, fix 0 of 15)" (high, 0.25h)
- [ ] FW-9 (before G1): idle_negative, body: motion line (3-pose and per-pose), base: sentence; selftest: every approved request's cache key unchanged (high, 3h)
- [ ] FW-D: EnemyData fields (num, tuned, description, protect, statusWeak, attackStatus, spells, ai, specials, phase attackAnim), parsing rules, validators, cross-file checks, rosterStats.test (agility formula, rematch HP) (high, 1d)
- [ ] FW-D: BossAI targets by spell.targeting + "CURE never heals a hero" test; data-driven ai in attachEnemyAi (high, 3h)
- [ ] FW-D: protect enforcement (incl. Slow, Confuse) + tests; re-run act-1 balance and report (medium, 2h)
- [ ] FW-D: bestiary num order, titleCount with gaps, Info page (description + lore), immune row, aquatic label; 7.5 fallout (test pins, phase message, turnListFit long names) (high, 1d)
- [ ] FW-8: MAX_PAGE 2048, page groups, MonsterPages.ts (ensure before scenes.push, isReady late-art path, refcounted LRU), reader updates (2.), tests; check --all "no rig" line; monster_roster_report.py with calibration (high, 1.5d)
- [ ] G1: ashen_queen, drowned_sovereign, hollow_seraph: monsters.yaml entries (face, idle_negative, body, base), idle first, 15 checkpoints, approvals, commits, log rows (high, 1d)
- [ ] G1: data entries for the 3 fiends + 4 rematches ("II", ratio rule) + lore; rename lich to Rime Sovereign + phase message (high, 2h)
- [ ] G2: astos, warmech, death_eye, chaos (17 checkpoints); piscodemon, evil_eye, dragon_zombie (high, 1d)
- [ ] FW-1 floating + shadow, shark prototypes (high, 1d)
- [ ] FW-2 serpent/rooted + cobra, ochu prototypes (high, 1d)
- [ ] FW-3 naga + arm lists, prototyped on ashen_queen (high, 1.5d)
- [ ] FW-4 arthropod + black_widow, scorpion prototypes (high, 1d)
- [ ] FW-5 biped wings, hem pins, multi-head, mechanical + gargoyle, hydra, warmech prototypes (high, 1d)
- [ ] FW-6 squash op + idle_b tweaks + green_slime prototype (medium, 1d)
- [ ] Gen A: 25 sheets incl. the act-1 gr_imp/gr_wolf checks (small, page 0, act-1 tests unchanged) (high, 1d)
- [ ] Gen B: 27 sheets (high, 1d)
- [ ] Gen C: 32 sheets (medium, 1.5d)
- [ ] Gen D: 18 sheets (medium, 1d)
- [ ] Rigs A (25), B (27), C (32), D (18): per-sprite checklist, image-only review, lock (high, ~45 agent-days)
- [ ] Boss rigs: 3 fiends + 4 bosses (high, ~10 agent-days)
- [ ] Data: one enemies.yaml + description + background key per approved sheet; sandbox levels and anim_roster scenarios per batch (high, rolling)
- [x] INT: rolling atlas pages and rolling gate; final full validation (section 12 incl. 12.2); docs: AGENTS.md art table, NEW_MONSTER_GUIDE 2.2 templates, gen/README.md (high, 1d) (F5, 2026-11-15: ROSTER_LOG.md "Fix pass result"; 9 keyframe-only sheets left, so `check --all` is the rolling form; fix pass 2 G6 rigged the last 11, so `check --all` is the full form: 123 OK, no `no rig`)
- [ ] PT: contact sheet + distinctness report (calibrated thresholds); image-only adversarial review; browser play test; ROSTER_PLAYTEST.md (high, 1-2d)
- [ ] FIX: close pass R build, open pass R fix; ROSTER_FIX_PLAN.md -> momus OKAY -> fixes -> re-test until no P0/P1 (high, 2-4d)
- [ ] Final report: images used vs 300 (build/fix split), built / deferred sprites, open P2s, act-1 balance changes, follow-ups (high, 1h)
```

---

## 16. Follow-ups (out of scope for pass R)

- **E-F1 enemy special abilities** (gazes, breaths, ink, stinger, trance, earthquake, toxic, nuclear, Chaos's four
  party attacks) as data-driven abilities with effects in `spell-effects.yaml`; a `wind` effect for the Hollow Seraph.
- **E-F2 on-hit statuses** from `attackStatus` (poison, paralysis, sleep, stone, blind, instant death).
- **E-F3 missing spells** (`fir3 lit3 ice3 nuke rub xxxx brak bane stop zap xfer wall fog2 inv2 hel2 hel3 cur4 stun
  blnd slo2`) and the "earth" and "time" protections they need.
- **E-F4 fiend phase visuals** (D8), the Seraph's "unnatural silence" audio cue, phase-2 choreography.
- **E-F5 regular cast keyframes** (D6), status-weakness bonus (`statusWeak`), multi-family enemies.
- **E-F6 town NPC dialogue** that tells the fiends' stories (needs the towns of later acts).
- **E-F7 encounter tables and balance** for every region as maps are built.

## Orchestrator decisions (binding)

- **D9, retries:** the user's instruction pre-approves up to 2 retries per sheet (3 attempts in all), the same as the act-1 run.
- **D12, reserve:** keep 15 images back for the visual fix pass. Generation of new enemies stops at 285 roster images; the last 15 go only to fixes, and the overall halt stays at 300. With the expected total of about 200, this is unlikely to cut any enemy.
- **D13, Chaos:** use the plan's default design.
- **Other decisions:** the plan's defaults stand, including `protect` enforcement. Re-run the act-1 balance suite and report any change.
- **Start condition:** the roster pass starts only after the feedback fixes are merged and validated. Recount the ledger then, before changing the budget.

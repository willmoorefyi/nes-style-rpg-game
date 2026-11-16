# Roster redesign plan (pass V), 2026-11-16 (rev 2: momus APPROVE WITH REVISIONS, 17 revisions applied, section 17)

**Request (user, verbatim intent).** (1) Fix the bestiary centring bug. (2) A new `crazy_horse`: inspired by a
Nightmare from D&D, a bit weaker, much more evil and otherworldly, clearly different from `nightmare`. (3) Many
regular-size enemies should be larger (ogre size): shark, bigeyes, minotaur, ochu, neochu, hydra, the elementals, all
gigas, all dragons, "maybe more", decided with the classic FF1 size classes as the reference; **user ruling: rescale
the existing approved art, no new images**. (4) New sprites for `piscodemon` (a "junior mindflayer", terrifying and hard
to fight), `black_knight` (a terrifying evil knight even at small size) and `guardian` (an evil robot killing
machine). (5) Regenerate `vampire` (pixelated and messy). (6) A new `hollow_seraph`: hollow, disconnected,
modern-robotic, wings as metallic blades of light, a steampunk angel of doom (original design). (7) A new `chaos`: by
far the biggest monster, a cosmic / dimensional overlord presence (original design).

**Binding user additions.** Budget "pass V": up to 50 Gemini images, fresh per-sheet counts, at most 3 per sheet, on top
of the 267 pass-R images. **No replaced sprite is thrown away** (coordinator message, 2026-11-16): every replaced
sprite's approved sheets, rig, lock and cache keys are archived and committed before its first regeneration, kept out
of the build, and indexed for reuse (section 5).

**This document is the plan only.** Nothing is generated, edited or built by it. Every number below was measured at
9fe129c (`roster` == `mainline` == `roster-int`) in the `roster-int` worktree (atlas `assets/sprites/monsters-ai*`,
`enemies.yaml`, `monsters.yaml`, the rigs) and the main checkout (`assets-src/gen/cache/ledger.jsonl`, authoritative),
with throw-away scripts in `/tmp/rv/` (`heights.py`, `center.py`, `vcenter.py`, `tiers.py`). Where a number is a
planning estimate it says so.

**Terms.**
- **N_V0** = the Gemini `attempt` count (Bedrock excluded) in the main-checkout ledger when pass V opens (V1). It is
  **367** at 9fe129c and is re-counted at V1; every pass-V count is `gem[N_V0:]`.
- **V-base** = the `roster-int` commit that carries the V1 framework merge (the G1-style exit check, section 10). It is
  the baseline for every "unchanged" check of this pass (frame rects, locks, act-1 tests).
- **Redesigned ids (7):** `crazy_horse`, `piscodemon`, `black_knight`, `guardian`, `vampire`, `hollow_seraph`, `chaos`.
- **Rescaled ids:** the sheets in section 2.4 whose approved pixels are shown at a larger integer screen scale.
- **Screen px** = the 1920x1080 game space; **art px** = atlas (native) px. Today every monster sheet is drawn at 2
  screen px per art px (`monsters-ai.json` `scale: 2`, `texScale: 1`).

**Contents:** [0 Success criteria](#0-success-criteria-defined-before-implementation) · [1 Bestiary
centring](#1-item-1-bestiary-centring-bug) · [2 Size classes and rescale](#2-item-3-size-classes-and-the-rescale) ·
[3 Regular redesigns](#3-items-2-4-5-regular-redesigns) · [4 Boss redesigns](#4-items-6-7-boss-redesigns) · [5 Retired
sprites](#5-retired-sprites-binding-user-addition) · [6 Image budget](#6-image-budget-pass-v) · [7 Framework
items](#7-framework-items) · [8 Data and TypeScript](#8-data-and-typescript-items) · [9 Process and
ownership](#9-process-per-sprite-ownership-iteration-budget) · [10 Tranches](#10-tranches-ownership-and-parallelism) ·
[11 Validation](#11-validation-commands) · [12 Play test and fix round](#12-adversarial-play-test-and-fix-round) ·
[13 Docs](#13-documentation-updates) · [14 Risks](#14-risks) · [15 Decisions](#15-decisions-for-the-orchestrator-and-the-user)
· [16 TODOs](#16-todos) · [17 Momus revisions](#17-momus-revisions)

---

## 0. Success criteria (defined before implementation)

```json
{
  "functional": [
    "Bestiary: every atlas sheet's idle figure is centred in the preview panel's inner rect (horizontal and vertical), not in the battle's enemy area",
    "Every enemy in assets/data/enemies.yaml has a decided size tier (section 2.3); the rescaled sheets show at 3 screen px per art px with no change to any approved PNG, rig or lock",
    "The 7 redesigned ids have new approved art (or keep the old art if their pass-V attempts are exhausted without an approvable image; then the old art is restored from the archive and the id is escalated)",
    "Every new sprite is rigged and locked (bosses with cast frames), passed a fresh image-only review, and plays in battle and the bestiary",
    "Chaos is the largest monster on screen: its idle figure is >= 1.4x the tallest fiend idle (lich, 184 art px at scale 2 = 368 screen px): 258-278 art px at scale 2 cut at scale 1.0 in grid mode (C1), or >= 172 art px at scale 3 (C2); it fits the enemy area and the bestiary panel",
    "No replaced sprite is lost: approved sheets + json, rig + lock, monsters.yaml entry and cache keys of each redesigned id are archived under a retired id, committed, indexed in docs/RETIRED_SPRITES.md, and ignored by the build and every gate"
  ],
  "observable": [
    "docs/ROSTER_LOG.md 'Pass V' table: one row per Gemini attempt and 'Images used: U of 50' equal to the guard's count",
    "gen/out/anim/review/monsters/<id>_* review outputs and a recorded image-only verdict (SHIP or SHIP WITH NITS) for each new sprite and each rescaled sheet",
    "The roster contact sheet and distinctness report (monster_roster_report.py) with the new sprites; no new flagged sibling pair",
    "docs/ROSTER_PLAYTEST.md 'Pass V test' rows, and a fix round if any P0/P1/P2 is open"
  ],
  "pass_fail": [
    "Main-checkout ledger: gem[N_V0:] <= 50, every pass-V attempt is one of the 7 redesigned ids and one of its only_sheets, no character+sheet above 3 attempts in pass V, at most 2 chaos/boss_idle attempts at the titan band",
    "budget.json equals the literals pinned in selftest_passv.py; the guard refuses an inconsistent budget",
    "At every commit on roster and roster-int, every failing check is on the 9.4 allowed list for the id's state",
    "approve.py refuses to overwrite approved/<id>/<sheet>.png unless a byte-identical copy exists under approved/_retired/<id>_v<n>/ (selftest_retire.py)",
    "python3 -I assets-src/gen/selftest.py (main checkout) and selftest.py --anim (worktree): ALL PASSED",
    "check --all: only '<id>: OK' lines (plus the 4 FWQ_ALLOW 'aliased' notes) at the end of pass V; during pass V 'no rig' only for redesigned ids",
    "Every atlas page <= 2048x2048; party atlases byte-identical; monster atlas identical under PYTHONHASHSEED 0 and 1; every act-1 group sheet on page 0",
    "Frame-rect diff against V-base changes exactly the 7 redesigned sheets (section 11.2); the rescaled sheets differ only in their JSON 'scale' field",
    "Every enemy sprite in every layout pass has an integer screen scale (scale x layout factor is an integer) (unit test)",
    "npx tsc --noEmit && npm run build && npx vitest run: exit 0",
    "After the fix round: no open P0/P1 in docs/ROSTER_PLAYTEST.md 'Pass V test'"
  ]
}
```

---

## 1. Item 1: bestiary centring bug

**Root cause (verified in code).**
- `BestiaryPreview.show` (`src/scenes/bestiary/BestiaryPreview.ts:140-155`) builds the lone enemy through
  `new AiEnemyView([e], this.art).build()`. `AiEnemyView.build` (`src/scenes/battle/AiEnemyView.ts:111-115`) places it
  with `computeEnemyLayoutAi`, whose area is the **battle's** `ENEMY_AREA = {x0: 80, x1: 1340, y0: 200, y1: 745}`
  (`EnemyLayoutAi.ts:34`). A single column is centred at `ENEMY_AREA.x0 + (areaW - w) / 2` (`:82`), i.e. screen x
  **710**.
- The preview window is `PREVIEW_RECT = {x: 24, y: 120, width: 976, height: 756}` (`BestiaryPreview.ts:24`) with an 18 px
  border (`WINDOW_BORDER_OUTER` 6 + `WINDOW_BORDER_INNER` 12), so `PREVIEW_INNER` is x 42-982, y 138-858; its centre
  is **(512, 498)**. The only horizontal correction (`:153-154`, `actors.x = min(0, ...)`) moves a sheet left only when
  its in-place lunge would cross the right border.
- The background is scaled to cover the whole 1920x1080 screen and centred on the screen (`setBackground`, `:208-210`),
  so the panel shows its left half (x 42-982 of 1920): the same root cause for the backdrop.

**Pre-measure (`/tmp/rv/center.py`, `/tmp/rv/vcenter.py`: the layout formulae applied to every atlas sheet's
`homeX`, `opaqueRight`, `lungeRight`, `lungePx` and idle rows).**
- Horizontal: the idle figure's centre sits **+180 to +217 px right** of the panel centre for all 123 sheets (goblin
  +190, ogre +194, chaos +198, ashen_queen +215); `actors.x` is 0 for every sheet except warmech (-7).
- Vertical: the idle figure's centre is **-22 to +47 px** from the panel centre (ochre_jelly, shadow -22; dragon +47,
  white_shark +45, crocodile +36): low wide sheets sit low because the feet line, not the figure, is centred.

**Fix (TS/data owner, RED first).**
1. **FW-A2 (framework, JSON only; rev 9 ruling):** the atlas gains `idleBox: [l, t, r, b]`, the **idle frame's**
   opaque box in art px (inclusive), written by the `monster_atlas.py` FW-A block (`:100-104`). No PNG changes.
   `monsterAnchors` validates it (all four inside the cell, l <= r, t <= b).
2. `BestiaryPreview.show`: after `build()`, set `actors.x` / `actors.y` so that the idle figure's opaque box
   (`idleBox` at the sheet's screen scale) is centred on `PREVIEW_INNER` (whole px), then apply the existing reach clamp
   (`:150-154`) on top: the phantom and the in-place check are computed **after** the shift in the actors' local
   space, so the 12d rule (`bestiaryReach.test.ts`: every frame <= inner right - 8) still holds. A sheet whose clamp
   binds keeps the largest shift that satisfies it (expected: none; computed per sheet in the test below).
   Vertical bound: the feet line stays inside the background's battle plain (y 360-770, `STAGE_FEET` and
   `docs/ART_BATTLE_PLAN.md`); if centring would put it outside, the feet line is clamped (expected: no sheet today;
   the titan, 2.6, is checked explicitly).
3. **Background (D-V8, default yes):** the backdrop is positioned so its horizontal centre maps to the panel centre
   (x 512) instead of the screen centre; vertical placement unchanged (the plain stays at y 360-770).
4. `AiEnemyView`, `computeEnemyLayoutAi` and the battle are **not** changed by this item.

**Acceptance.**
- [ ] RED: new `tests/scenes/bestiary/bestiaryCentre.test.ts`, one case per atlas sheet (the `bestiaryReach` variant
  loop): `|figure centre x - 512| <= 1` and `|figure centre y - 498| <= 1`, where the figure box is `idleBox` at
  the sprite's global position and scale. It fails today with the pre-measured +180..+217 / -22..+47 (pinned in the
  test's comment), passes after the fix.
- [ ] Clamp report: the test prints any sheet whose reach clamp or plain clamp binds; the list is empty, or each entry
  is named in the test with its measured shift (no silent exceptions).
- [ ] `bestiaryReach.test.ts`, `BestiaryScene.test.ts`, `bestiaryCeilings.test.ts` pass unchanged.
- [ ] Background: a unit test checks that the backdrop sprite's centre x is 512 after `show()` with a fake texture.
- [ ] Browser (dev server on 127.0.0.1, a free port, `&mute=1`): `/?mute=1&bestiary=goblin`, `=ogre`, `=dragon`,
  `=chaos`, `=warmech`, `=white_shark`; screenshots show each figure centred; a fresh reviewer answers yes to "the
  enemy is centred in the preview window" for all six.

---

## 2. Item 3: size classes and the rescale

### 2.1 The FF1 reference and what the roster measures

FF1 (NES) draws its battle enemies in fixed graphic classes: **small 32x32** (9 per formation), **large 48x48** (4
per formation, or 2 large + 6 small), **fiend 64x64** (one), and **Chaos** as the single largest graphic. The plan
uses the ratios, not FF1's per-enemy table (it is not reproduced here; where the creature is a giant, dragon,
elemental, hydra, ochu, shark or bull-man it is in FF1's large class, as the user's list):

| Ratio | FF1 | This roster today (idle heights at scale 2, measured) |
|---|---|---|
| large / small | 48 / 32 = **1.5** | ogre 102 / goblin 69 = **1.48** (the ogre is the right "large" size) |
| fiend / small | 64 / 32 = 2.0 | lich 184 / goblin 69 = 2.67 (our fiends are already bigger than FF1's) |
| Chaos / fiend | > 1 (the largest) | chaos 173 / lich 184 = **0.94** (Chaos is *smaller* than a fiend: item 7) |

Measured large-class problem: the large band is 96-120 px (`spec.py:296`), but many large sheets draw a smaller or
lower figure. Size index = sqrt(idle opaque area) / sqrt(ogre's 4968 px):

| Sheet | Cell | Idle WxH (art px) | Area | Index |
|---|---|---|---|---|
| ogre (reference) | 128x128 | 85x102 | 4968 | 1.00 |
| shark | 128x128 | 77x97 | 2755 | 0.74 |
| bigeyes (small) | 90x80 | 80x54 | 2747 | 0.74 |
| dragon | 128x128 | 92x55 | 2848 | 0.76 |
| minotaur | 128x128 | 77x89 | 3211 | 0.80 |
| neochu | 128x128 | 65x92 | 3560 | 0.85 |
| fire_elemental / water_elemental / air_elemental | 128x128 | 59x110 / 70x79 / 73x89 | 3762 / 3753 / 3944 | 0.87 / 0.87 / 0.89 |
| hydra | 128x128 | 86x96 | 3957 | 0.89 |
| hill_gigas | 128x128 | 68x105 | 4247 | 0.92 |
| dragon_zombie | 128x128 | 112x76 | 4442 | 0.95 |
| blue_dragon | 128x128 | 114x96 | 4734 | 0.98 |
| ochu | 128x128 | 92x83 | 4990 | 1.00 |
| white_dragon | 134x128 | 111x96 | 5405 | 1.04 |
| ice_gigas / fire_gigas / earth_elemental | 128x128 | 79x123 / 81x122 / 94x103 | 5559 / 5806 / 5827 | 1.06 / 1.08 / 1.08 |
| green_dragon | 144x128 | 125x98 | 6923 | 1.18 |

So the user's list is not only "under ogre size": ochu, the gigas, earth_elemental and three dragons already match or
exceed the ogre. The intent read here (and to be confirmed, D-V2) is the FF1 hierarchy: giants, dragons, elementals
and big beasts must read **a step above** the ogre-size large monsters, not equal to them.

### 2.2 Rescale method: options and recommendation (D-V1)

Every option keeps the approved PNGs untouched (style lock); they differ in where the enlargement happens.

| Option | What | Blur / stair-steps | Rigs and locks | Atlas | Verdict |
|---|---|---|---|---|---|
| **S1 (recommended)** per-sheet integer **display scale 3** (x1.5 vs today) | The atlas JSON carries `scale: 3` for the rescaled sheets (from a new framework table `gen/monster_scale.yaml`); `BattleArt` uses `entry.scale ?? meta.scale` (`BattleArt.ts:156`). Frames are generated, checked and locked at native size exactly as today; the GPU draws each art px as a 3x3 screen-px block (nearest) | none at the 1920x1080 game resolution (integer ratio); the whole canvas is then resampled to the window like every other sprite | **unchanged** (no re-rig, no re-lock: nothing changes in art space) | PNG pages byte-identical; JSON gains the field | one cost: those sheets' pixels are 3 screen px, the rest 2 (a visible pixel-density step next to the party). D-V1 asks the user to accept it |
| S3 baked post-render upscale | The atlas writer replicates each generated frame x2 (or x3 then shown at 1) after the checks and locks | none | unchanged (locks hash the native frames before the upscale) | **4x (or 9x) the cell area**: about +2 pages for the binding set | same look as S1 at a large memory cost; fallback only if S1 is rejected for a runtime reason |
| S2 art-space x2 with re-rig | Scale approved keys and rig coordinates by 2 at build time (nearest), generate in-betweens at 2x | rotations at 2x create sub-art-pixel steps (mixels) next to 2x2 blocks | **every rescaled rig redone and re-locked** (joints, masks, paint, tweaks x2; caps scale with cell) | 4x area per sheet | x2 is also too big (a 128 cell becomes 512 screen px, boss size); rejected |
| S4 non-integer resample (x1.25 or x1.5 in art space) | Resample the keys, re-rig | **stair-steps** (every second row/column doubled), outline 1-2 px uneven, palette and outline checks re-tuned | all redone | +56-125 % | rejected (the house look breaks) |
| S5 regenerate at a bigger band | new images | - | new rigs | - | ruled out by the user |

**Recommendation: S1.** It is the only option with zero risk to the 123 locked rigs, zero atlas growth, and no
resampling artefact. The "review each for blur / stair-steps" requirement becomes a binary block test (2.7) plus the
image-only review at battle 1x.

**Why scale 3 and not "ogre size exactly":** only integer screen scales avoid stair-steps; 2 is today, 4 doubles the
figure (boss size). Scale 3 gives every listed sheet an index of 1.11-1.77 vs the ogre (2.4).

### 2.3 Size tiers (every enemy)

| Tier | Data `size` | Layout | Display | FF1 analogue | Members |
|---|---|---|---|---|---|
| S | `small` | 3 per column, box = cell x 2 (160 px tall) | scale 2 | small 32 | every 80-px-cell sheet except bigeyes: basilisk black_flan black_knight black_widow bloodbones buccaneer cobra cockatrice crawler dark_fighter dark_wizard death_knight earth_medusa gargoyle ghast ghost ghoul goblin gr_imp gr_wolf gray_ooze green_slime horned_devil hyenadon king_mummy lesser_tiger lizard medusa mindflayer mummy ochre_jelly pirate piscodemon pyrolisk rakshasa red_piranha sahagin sahagin_chief sahagin_prince scorpion sea_scorpion shadow skeleton specter tarantula vampire vampire_lord weretiger werewolf wight winter_wolf wolf wraith zombie (54) |
| L | `large` | 2 per column | scale 2 (bigeyes: **scale 3**, box 270x240) | large 48, ogre-size | the 128-px-cell sheets not in tier H: allosaurus anaconda ankheg baretta chimera clay_golem crazy_horse crocodile desert_baretta fire_lizard gigas_worm guardian hellhound iron_golem lava_worm manticore nightmare ogre ogre_chief ogre_mage purple_worm remorazz rhyos sabertooth sand_worm sea_snake sea_troll soldier sphinx spirit_naga stone_golem troll tyrannosaur water_naga white_crocodile wyrm wyvern, plus **bigeyes** (moves small -> large) |
| H | **`huge`** (new) | **1 per column** (a 384 px box cannot stack two in the 545 px area) | **scale 3** | above FF1 large, below our fiends | binding (user list): shark, minotaur, ochu, neochu, hydra, earth_elemental, fire_elemental, water_elemental, air_elemental, hill_gigas, fire_gigas, ice_gigas, dragon, white_dragon, blue_dragon, green_dragon, dragon_zombie (17). Recommended siblings (D-V3, default yes): white_shark, minotaur_zombie, fire_hydra, deepeyes, evil_eye (5). Optional (D-V4, default no): wyrm, wyvern, tyrannosaur, purple_worm, clay_golem, stone_golem, iron_golem |
| B | `boss` | 1 per column | scale 2, 200 px cells | fiend 64 | ashen_queen, astos, death_eye, drowned_sovereign, hollow_seraph, lich, warmech and their rematches; garland stays `size: large` in data with its 200 px cell (unchanged, it fights alone) |
| T | **`titan`** (new) | alone, own area (4.2) | scale 2, **300 px cell** (D-V6) | Chaos | chaos |

Why the siblings: without them the lesser sibling would outgrow the greater one (shark 231x291 screen vs white_shark
212x114; bigeyes 240x162 vs deepeyes 114x176 and evil_eye 166x196; minotaur 231x267 vs minotaur_zombie 142x228; hydra
258x288 vs fire_hydra 250x164), which breaks `ROSTER_PLAN.md` 3.3.

### 2.4 Exactly which sprites change (rescale only; 0 images)

Default (binding + D-V3): **23 sheets** get `scale: 3`: bigeyes (tier L) + 22 tier-H sheets. `enemies.yaml` `size`
changes: bigeyes `small -> large`; the 22 tier-H enemies `large -> huge` (each listed enemy id equals its sprite id;
no rematch uses these sprites). After the change (screen px, idle, scale 3; ogre 170x204, lich 370x368):

| Sheet | Box (cell x 3) | Idle | | Sheet | Box | Idle |
|---|---|---|---|---|---|---|
| shark | 384x384 | 231x291 | | dragon | 384x384 | 276x165 |
| bigeyes | 270x240 | 240x162 | | white_dragon | 402x384 | 333x288 |
| minotaur | 384x384 | 231x267 | | blue_dragon | 384x384 | 342x288 |
| ochu | 384x384 | 276x249 | | green_dragon | 432x384 | 375x294 |
| neochu | 384x384 | 195x276 | | dragon_zombie | 384x384 | 336x228 |
| hydra | 384x384 | 258x288 | | white_shark | 384x384 | 318x171 |
| earth_elemental | 384x384 | 282x309 | | minotaur_zombie | 384x384 | 213x342 |
| fire_elemental | 384x384 | 177x330 | | fire_hydra | 408x384 | 375x246 |
| water_elemental | 384x384 | 210x237 | | deepeyes | 384x384 | 171x264 |
| air_elemental | 384x384 | 219x267 | | evil_eye | 384x384 | 249x294 |
| hill_gigas | 384x384 | 204x315 | | | | |
| fire_gigas | 384x384 | 243x366 | | | | |
| ice_gigas | 384x384 | 237x369 | | | | |

Note (D-V2): fire_gigas and ice_gigas become as tall as the lich (366 / 369 vs 368). The orchestrator confirms this is
wanted, or excludes them.

**The original approved PNGs of every rescaled sheet stay untouched** (`assets-src/gen/approved/<id>/` and their rigs
and locks are not edited); the rescale is a build-time JSON field read at runtime. They are therefore not archived
under section 5 (nothing is replaced), and `git diff --exit-code assets-src/gen/approved/<rescaled ids>` is a gate.

### 2.5 Layout, lunge, clearance (TS/data owner, with FW-S)

- **Integer screen scale in every layout pass.** Today pass 3 halves every box (`EnemyLayoutAi.ts:72`: f = 0.5); a
  scale-3 sheet at f = 0.5 is 1.5 screen px per art px (stair-steps). New rule: `EnemyBoxInput` carries the sheet's
  `scale`; the passes become (1) full size, (2) opaque packing, (3) scale-3 boxes at f = 2/3 (scale 2), others full,
  (4) every box at screen scale 1 (f = 1/scale). `EnemyBox.scaleFactor` stays per box. Unit test: over every
  real-sheet formation in the tests and 1,000 seeded random formations (1-9 enemies), `scale x scaleFactor` is an
  integer for every box. **Pass 4 for a formation with a scale-3 sheet (rev 11):** five or more tier-H boxes (or
  tier-H mixes that overflow pass 3) are not supported: `formationFits` returns false for any formation that reaches
  pass 4 while it contains a scale-3 sheet, and the data test (below) keeps every authored formation out of that case.
  Formations without a scale-3 sheet keep today's passes exactly (pass 3 is a no-op for them).
- **Classes:** `EnemySizeClass` gains `huge` and `titan`; `CAPACITY {huge: 1, titan: 1}`, `ORDER [titan, boss, huge,
  large, small]`, `TRAVEL_HOP {huge: 4, titan: 0}` (`enemyReach.ts:20`), `PLACEHOLDER {huge: 384, titan: 600}`
  (`AiEnemyView.ts:24`), bestiary `sizes` labels (`bestiaryData.ts:18`, `bestiary.yaml:78`: `huge: Huge, titan:
  Titan`, D-V5), `EnemyData.size` (`types/index.ts:105`), `schemaValidation`. Every `Record<EnemySizeClass, ...>` is
  completed (the compiler enforces it).
- **Full-size capacity:** 3 tier-H boxes side by side (3 x 384 + 2 x 24 = 1200 <= 1260); 432-wide green_dragon x 3
  passes only with opaque packing (3 x 375 + 2 x 16 = 1157). A data test: every formation in `debug-sandbox.yaml` and
  every encounter table that names a tier-H sprite passes `formationFits` (today none is placed in an encounter table;
  act-1 tables are unchanged).
- **Lunge (rev 9):** `lungePx` is screen px at the atlas scale. The per-sheet factor is applied **once**, in
  `BattleArt.getMonsterFrames` (`BattleArt.ts:174-176`: `lungePx: lungePx(entry) x scale / meta.scale`), so
  `AiEnemyView.ts:93` (attack plan), `:121` (`configure`) and `BestiaryPreview.ts:151-153` (phantom and in-place
  check) all read the same value; no other site multiplies it. Unit test: a scale-3 fixture sheet with atlas `lungePx`
  26 gives `MonsterFrames.lungePx` 39, and the three call sites receive 39 (spies).
- **Travel clearance:** `topY = b.y + travelTop x scale` (`AiEnemyView.ts:95`) already uses the per-sheet scale; the
  `TRAVEL_CLEAR_Y` (124) rule holds. `lungeClearance.test.ts` and `enemyTravel.test.ts` gain the tier-H sheets (every
  frame of a travelling attack stays below y 124).
- **Bestiary fit:** the largest tier-H box is 432x384; the panel inner rect is 940x720 (fits); `bestiaryReach` and the
  new `bestiaryCentre` tests run over every sheet including them.
- **Atlas pages:** unchanged by the rescale (JSON only). The redesigns do change cells (rev 16): new cell sizes for
  crazy_horse (group A, page 3), black_knight and guardian (group D, page 8), piscodemon and hollow_seraph (group
  `bosses`, page 1) and vampire (page 0) shift every later cell of their group and may spill a group onto a new page.
  Every page-count assertion (`MonsterPages.test.ts`, AGENTS.md, `ROSTER_LOG.md`) uses the **measured** count after
  the integrator's rebuild, never a planned number; the binding gates stay: every page <= 2048x2048 and every act-1
  group sheet on page 0.
- **Effect anchors (rev 12):** spell and hit effects anchor on the enemy box (e.g. the shard emitter starts at
  `c.y - b.h x (0.9 .. 1.3)`, `fx/emitters.ts:65`); a 384 px tier-H box or the 600 px titan box can push an anchor
  above the screen or under the message window. A unit test computes the centre, head and feet anchors of a titan box
  (in `TITAN_AREA`) and of a tier-H box (in a 3-huge formation) and of every emitter start point over the RNG range,
  and asserts all lie in y 124..1080; an emitter that fails is clamped to y >= 124.

### 2.6 Tests that change because of the rescale (updated, never deleted)

| Test | Today | Change |
|---|---|---|
| `tests/scenes/battle/EnemyLayoutAi.test.ts:120-133` "the play-test crowd lays out at scale factor 1" | crowd `ogre troll dragon crazy_horse gigas_worm ogre_chief shark anaconda minotaur` | dragon, shark and minotaur become tier H, so 9 cannot lay out at factor 1: the case is re-stated as "the crowd lays out with integer scales and no overlap; the 6 tier-L members at factor 1 when the tier-H ones are removed", plus a new case "3 tier-H sheets lay out at factor 1" |
| same, `:134-137` "nine of every large sheet whose home art is <= 118 px wide ... (46 sheets)" | 46 | the count is re-measured over tier-L sheets only and pinned with the measured value in the name |
| `tests/data/rosterData.test.ts:52` sizes in `small large boss` | 3 classes | adds `huge`, `titan`; a new case: every tier-H / T enemy's sheet has the matching atlas `scale` (3 for huge and bigeyes, 2 for the rest) |
| `tests/scenes/battle/__golden__/layout_f1.json` | golden boxes | **formations without a scale-3 sheet stay byte-identical** (a test recomputes the golden from today's inputs and compares bytes; rev 11); only formations that contain a rescaled sprite are regenerated, and the diff names exactly them |
| `src/scenes/bestiary/bestiaryModel.ts:39` `bossTag` | `bossPhases`, `size === 'boss'` or a scripted boss | chaos (`size: titan`) keeps its boss tag through its `bossPhases`; a new pinned case in `bestiaryModel.test.ts` asserts `bossTag(chaos) === true`, and `size === 'titan'` is added to the rule so a titan without phases is still a boss (rev 11) |
| `tests/scenes/battle/lungeClearance.test.ts`, `enemyTravel.test.ts` | boss lists | tier-H cases added; chaos becomes in-place (4.2) |
| `tests/scenes/bestiary/bestiaryReach.test.ts` | passes | must pass unchanged with the new scales |

### 2.7 Acceptance (rescale)

- [ ] FW-S selftest: with `monster_scale.yaml` empty the rebuilt atlas JSON and pages are byte-identical to V-base;
  with the 23 entries, every PNG page is byte-identical and the JSON differs only by `"scale": 3` on those 23 sheets
  (a JSON diff script prints exactly those keys).
- [ ] `git diff --exit-code V-base -- assets-src/gen/approved/ assets-src/gen/anim/monsters/` lists none of the 23.
- [ ] Integer-scale unit test (2.5) and `formationFits` data test pass.
- [ ] **Block test (no blur / stair-steps), browser (rev 10):** for each of the 23 sheets,
  `/?mute=1&sandbox=l30_lich&enemies=<id>&enemyAnim=step` at a 1920x1080 viewport with devicePixelRatio 1. In step
  mode the page reports the sprite's screen x, y and the shown frame (the step label); the test first asserts that x and
  y are integers. A script then takes the screenshot crop of the sprite's box and, for every art pixel of the shown
  frame **whose whole 3x3 screen footprint is opaque** in the atlas (edge pixels next to transparency and pixels under
  UI or the background blend are skipped), checks that all 9 screen pixels equal the expected atlas colour (0
  mismatches). The texture source's `scaleMode` is `nearest` (unit test on `MonsterPages`).
- [ ] A fresh image-only reviewer shown, per sheet, the battle screenshot next to the ogre and the party at 1x answers
  yes to: "reads larger than the ogre", "no blur", "no uneven pixel rows or columns"; and states whether the pixel
  density step is acceptable (recorded for D-V1).
- [ ] `/?mute=1&bestiary=<id>` for every one of the 23: inside the panel, centred (1).

---

## 3. Items 2, 4, 5: regular redesigns

All five are regular 3-pose sheets (one image each, `--sheets monster`), prompt rev 3 (no `prompt_rev`), style refs
as today (`approved/knight/battle.png`, `approved/ogre/monster_large.png`), the ids and `enemies.yaml` ids unchanged,
the body type's FW-9 motion line, and the batch B/C/D wording lessons (`ROSTER_LOG.md`): whole figure centred in its
cell with empty space on both sides; props vertical or held close; no bright violet / pink / magenta (keyed out with
the magenta background, nightmare R222); explicit anatomy counts; faces readable at 1x ("each eye a clear bright spot",
hair or helm "clearly darker than the face"); no free-form glyph / rune / sigil wording on flat surfaces (dark_fighter
R269); no "fierce", "teeth", "bloody" wording (fish safety refusals R156-R160); no rear-up, no leap; effects drawn on
the body, never in open air.

**Review checklist per sheet** (guide 1.4, all binary) **+ pass-V add-ons:** anatomy count; the sibling side-by-side
(table below, at 1x and 4x); the face rule at 1x; `edges_ok` and no slice at the cutter's thirds; `pose_diff` >= 0.15;
the roster report does not flag the new sheet against any sibling (silhouette >= 0.85 and edge >= 0.60 is a flag);
and "this is clearly a different creature from the retired sprite of the same id" (the archive copy, section 5).

### 3.1 Designs and prompt seeds (generator writes them into `monsters.yaml`; wording may be tuned, the named features stay)

| Id (size, body) | Must differ from | Design brief (our own; no copy of any published art) |
|---|---|---|
| `crazy_horse` (large, quadruped) | `nightmare` (glossy black horse, cold blue flame mane, cyan eyes), the retired piebald horse | a gaunt, otherworldly horse from another plane, lesser than a nightmare: ash-grey hide tight over a bony frame, a ridge of short bone spines down neck and back, glowing yellow-green cracks in flanks and neck, a long narrow skull-like head with two burning yellow-green eyes, a smoke mane and tail with small yellow-green embers, thin long legs, dark iron hooves |
| `piscodemon` (small, biped) | `mindflayer` (tall thin lilac humanoid, black robe, tall collar, four tentacles, white eyes), the retired anglerfish demon | a squat, hunched young deep-sea psychic horror: a bulbous ridged octopus-mantle head, two large glowing yellow eyes with slit pupils, exactly six short thick face tentacles, mottled sea-green / slate-blue skin with pale yellow spots, shell plates on shoulders and forearms, a bare ribbed chest, three-fingered webbed claws held close, short bent legs, webbed feet; no robe |
| `black_knight` (small, biped) | `death_knight` (skeletal, spiked plate, cloak, runed sword), `dark_fighter` (half-plate, hooded tabard, crescent shield), the retired plain knight | a towering menacing knight in heavy jagged black plate whose edges and rivets are lit pale steel grey (fixes the D-R6 darkness nit), broad layered pauldrons with short hooked points, a closed great helm with two curled ram horns and a T-shaped visor glowing ember red, a broad notched two-handed greatsword held upright, a hunched threatening stance |
| `guardian` (large, quadruped, mechanical preset) | `warmech` (bronze/teal biped, dome, cannon and claw), `soldier` (bronze biped, blade arm), `iron_golem` (riveted biped, furnace chest), the retired bronze hound | a four-legged hunter-killer war machine built like a stalking predator: a long low body of blackened gunmetal plates with rust streaks, exactly four segmented legs with clawed steel feet, a long angular wedge head with a row of three red sensor eyes, two scythe-blade arms at the shoulders folded forward close beside the head, pistons and cables at the joints |
| `vampire` (small, biped; act-1 sprite, page 0) | `vampire_lord` (tall elder, white hair, bat-wing cape joined to the arms, crown-collar) | the same young noble vampire concept, redrawn clean: large simple shapes, smooth shading, no noise; pale grey-blue skin, a clear pale face with two large bright red eyes and small fangs, slicked black hair clearly darker than the face, a tall stiff black collar, a black cape with a deep red lining kept close around the body, a dark red waistcoat with a white cravat, one clawed hand raised in front of the chest |

**Prompt seeds** (`prompt` / `attack` / `hurt` / `face` / `extra_negative`; `seeds: [1234]`; `body:` as in the table):

- **crazy_horse.** prompt: "a gaunt, otherworldly horse from another plane, seen from the side: an ash-grey hide
  stretched tight over a bony frame, a ridge of short bone spines along the neck and the back, deep cracks across the
  flanks and neck glowing a sickly yellow-green from inside, a long narrow skull-like head with two burning
  yellow-green eyes, a mane and tail of drifting black smoke edged with small yellow-green embers (drawn as part of the
  body, with dark outlines), thin long legs ending in dark iron hooves; the whole horse, tail tip to muzzle, sits in the
  middle of its own cell with empty space on both sides; palette of ash grey, charcoal, bone white and sickly
  yellow-green". attack: "a lunging strike toward the heroes: the head thrust forward and down with the long jaw open,
  the forelegs lifted only a little and striking forward, the hind hooves on the ground, the smoke mane streaming back
  close to the neck; no rearing up; the whole horse well inside the middle cell". hurt: "knocked back, all four hooves
  on the ground, the head tossed up a little, the glowing cracks flaring brighter, one foreleg buckling; no taller than
  its idle height". face: "the narrow skull-like head with two burning yellow-green eyes, each a clear bright spot, is
  readable". extra_negative: "a rider, a saddle, a bridle, white or brown patches, a horn, wings, blue fire, violet,
  purple, pink, magenta, rearing up".
- **piscodemon.** prompt: "a squat, hunched young deep-sea horror with a humanoid body: a large bulbous ridged head
  like an octopus mantle, two large round glowing yellow eyes with black slit pupils, exactly six short thick
  tentacles hanging from the lower face in place of a mouth, mottled sea-green and slate-blue skin with pale yellow
  spots, crusted shell plates on the shoulders and forearms, a bare ribbed chest, two long arms ending in
  three-fingered webbed claws held close in front of the body, short bent legs on webbed feet; centred in its own cell
  with empty space on both sides; palette of sea green, slate blue, pale yellow and bone white". attack: "lunging
  toward the heroes, both clawed hands reaching forward but pulled in close in front of its chest (not stretched to
  the cell edge), the six face tentacles lashing forward, the yellow eyes blazing; exactly six tentacles as in the idle
  cell". hurt: "knocked back, the head thrown back, the six face tentacles curling up, the clawed hands thrown up close
  to the head". face: "the bulbous head with two large bright yellow eyes, each a clear bright spot, and six face
  tentacles is readable at small size". extra_negative: "a robe, a cloak, a collar, a staff, a weapon, a fish head, a
  lure, fins, a mouth, a third eye, violet, purple, lilac, pink, magenta, five tentacles, seven tentacles".
- **black_knight.** prompt: "a towering, menacing knight in heavy jagged black plate armour, the plate edges and
  rivets lit in pale steel grey so every plate reads, broad layered pauldrons with short hooked points, a closed black
  great helm with two curled ram horns and a narrow T-shaped visor glowing ember red from inside, a heavy broad
  two-handed greatsword with a notched edge held in both gauntlets, its blade upright in front of the body and its
  point well below the top of the grey box; a hunched, threatening stance; centred in its own cell with empty space on
  both sides; palette of black steel, pale steel grey, dull bronze trim and ember red". attack: the current black_knight
  attack text (the end of a downward cut, point at knee height ahead of the front foot, well inside the middle cell),
  plus "the visor glowing". hurt: "knocked back, staggering, the horned helm tipped back, the greatsword held upright
  across the chest in both hands". face: "the closed horned great helm with the ember-red T-shaped visor slit, the slit a
  clear bright spot". extra_negative: "a cape, a cloak, a tabard, a shield, a skull, bones, a plume, gold armour, a
  second sword, a face, a crown, violet, purple"; keep the existing `motion:` line.
- **guardian.** prompt: "a four-legged hunter-killer war machine seen from the side, built like a stalking predator: a
  long low armoured body of blackened gunmetal plates with rust streaks and bolts, carried on exactly four segmented
  metal legs with clawed steel feet, all four feet flat on the ground; a long angular wedge-shaped head at the front
  with a horizontal row of three glowing red sensor eyes; two long scythe-blade arms mounted at the shoulders, folded
  forward close beside the head with the blade tips pointing forward and down; exposed pistons and cables at the
  joints; the whole machine sits in the middle of its own cell with empty space on both sides; palette of gunmetal
  grey, black, rust orange, cold steel highlights and red sensor light". attack: "a scything strike toward the heroes:
  the body low and lunging forward on all four planted legs (no leap, no rearing up), both scythe arms swung forward
  and down in front of the head, their tips just above the ground in front of its front feet, the red eyes flaring;
  exactly four legs and two scythe arms, as in the idle cell". hurt: "knocked back on all four legs, the head jerked up,
  the scythe arms flung back close above the body, small sparks drawn on the joints themselves, the red eyes
  flickering". face: "the wedge head with the row of three red sensor eyes, each a clear bright spot". extra_negative:
  "a rider, a pilot, wheels, treads, a cannon, a dome head, bronze plates, teal, more than four legs, a human face,
  sparks in open air, violet, purple"; keep the existing `motion:` line (all four legs on the ground).
- **vampire.** prompt: "a young noble vampire drawn with large clean shapes and few small details, a clear dark outline
  and smooth shading (no noise, no speckled texture): pale grey-blue skin, a clear pale face with two large bright red
  eyes, each a clear bright spot, and two small fangs, slicked-back black hair clearly darker than the face, a tall
  stiff black collar, a black cape with a deep red lining kept close around the body (not flung out), a dark red
  waistcoat with a white cravat, one clawed hand raised in front of the chest; standing upright; centred in its own
  cell with empty space on both sides; palette of black, deep red, pale grey-blue skin and white". attack: "swooping
  forward toward the heroes, the body leaning low, one clawed hand raking forward in front of the chest, pulled in close
  (not stretched to the cell edge), the cape kept close to the body". hurt: "recoiling, twisting away behind the cape
  held close in front of the body, the head turned back". face: as above. extra_negative: "white hair, wings, bat
  wings, a crown, a staff, a coffin, violet, purple, pink, magenta, noise, dithering".

**Data (TS/data owner, after each approval):** `description` rewritten for the five (ASCII, one or two lines,
`rosterData.test` rules); stats unchanged (`ROSTER_PLAN.md` D4) unless D-V11 says otherwise for piscodemon;
`bestiary.yaml` backgrounds unchanged unless the reviewer finds the new art unreadable on it (then a committed staged
id that fits, measured as in fix plan 2 P2-9).

**Act-1 guard (vampire).** `vampire` stays `size` unset (= small) on page 0; the act-1 tests named in
`ROSTER_PLAN.md` section 1 pass without edits to their expectations; it is already in `CHANGED_ON_PURPOSE` (12.2 vs
`roster-r0`). A wider vampire cell moves later page-0 cells (wolf); the content-based frame-rect check is unaffected
(D-V14 accepts the move). `FX_ALLOWED["vampire"] = {"slash"}` (`selftest_efix.py:20`) is kept only if the new rig
declares a `slash` fx part; otherwise the framework owner removes it in the same merge.

**Acceptance (per sheet).**
- [ ] Main-checkout ledger: <= 3 pass-V attempts for `<id>/monster_<size>`.
- [ ] The review checklist above all yes, recorded in the `ROSTER_LOG.md` row; reviewer side-by-side with the listed
  siblings and the archived old sprite.
- [ ] `selftest.py` (main checkout) before approval reports exactly `<id> monster_<size>` in `_approved_keys`, and
  ALL PASSED after the approve commit (the fix plan 1 defect 3 mechanism).
- [ ] Rig: `check <id>` OK, fresh image-only verdict SHIP / SHIP WITH NITS, `lock`; <= 4 iterations.

---

## 4. Items 6, 7: boss redesigns

Both follow the per-pose pipeline (guide 1.1-1.4): `size: boss` / `titan`, `per_pose: true`, `design_ref: false`,
`prompt`, `action_prompt`, poses, `face`, `extra_negative`, a frontal symmetric `motion:` line per pose (the chaos and
hollow_seraph pass-R lessons: limb counts drift in action poses, R26-R31, R56-R58; naming every limb by image side
held them, R65-R67), **one pose per checkpoint, `boss_idle` first and approved before any other pose** (it is the
identity image, "Image 3", sent with every later pose), and the lich / drowned_sovereign identity lesson: every pose
text repeats the named anchors ("exactly as in Image 3 ... at the same pixel size as in Image 3") and the reviewer
rejects identity drift (palette, silhouette anchors, size +-10 %).

### 4.1 Hollow Seraph (`hollow_seraph`, boss, `floating: true`, body floating; also `hollow_seraph_2`)

**Design (original; the user's "blade-of-light wings" reference is used for that one feature only, described in our
own words).** A floating steampunk angel of doom made of **separate pieces that hover apart**: a hollow shell of
blackened steel and polished brass plates (helm-mask, a two-part cuirass, two shoulder plates, two gauntlets, a
segmented plate skirt) with narrow empty gaps between them and nothing inside; a brass clockwork heart of gears glowing
white-gold in the chest gap; a faceless brass helm-mask with one glowing slit; a broken gear-toothed brass halo; **four
wings (two per side), each one long straight blade of pale gold-white light in a brass frame** (D-V9: four, not six;
the six-wing count failed in 7 of 9 pass-R action attempts).

- Must differ from: the retired white-and-gold six-feathered-wing seraph; `warmech` (bronze/teal machine); the lore
  "she has stilled the winds" stays, the description and lore pages (`bestiary.yaml:126-129`) are rewritten to the new
  look by the TS/data owner (ASCII).
- **Disconnected pieces vs the cutter and the checks (rev 13).** Two filters apply. (a) The **cutter**
  `_figure_mask` (`monster.py:316-345`) keeps the main figure and **drops blobs outside its bounding box grown by about
  15 %**, so a piece that floats far from the body is lost silently at the cut. (b) `anim_checks.detached`
  (`MIN_PIECE = 12`) only errors on new small pieces relative to the source key. So the design keeps every separate
  piece inside or touching the main mass: **each wing's brass frame is joined to a shoulder plate** (the wings are not
  separate pieces), the plates hover with gaps of only 1-3 art px inside the figure's outline box, and the halo sits
  close above the helm inside that box. Review rule: every separate plate >= 40 art px, at most 10 pieces per key, the
  same pieces in every key. **Acceptance per pose:** the generator lists the pieces of the raw render (connected
  components of the keyed render at its pixel pitch, >= 40 render px) and of the cut; every planned piece (helm, two
  cuirass halves, two shoulder plates with their wings, two gauntlets, the skirt, the halo, the gear heart if separate)
  present in the render must be present in the cut; **a missing planned piece = reject** (the row records both
  counts).
- **Poses:** idle, attack, cast, hurt (**4**; `attack_raise` not generated, D-V9: the rig keeps `raise: false`, FW-R, as
  today, `heavyGlint.test.ts:88`; decided, D-V9). `only_sheets` refuses a `boss_attack_raise` request.
- **Prompt seeds.** prompt: "the Hollow Seraph, a steampunk angel of doom hovering in the air, built of separate pieces
  that float apart: a hollow shell of blackened steel and polished brass armour plates (a helm-mask, a chest cuirass in
  two halves, two shoulder plates, two gauntlets and a long segmented skirt of plates), each plate a solid riveted shape
  hovering a little apart from the others with narrow empty gaps between them and nothing inside; in the gap at the
  centre of the chest a brass clockwork heart of interlocking gears glows white-gold; the faceless brass helm-mask has
  one narrow horizontal slit glowing cold white; a broken brass halo ring with gear teeth floats above the helm;
  exactly four great wings, two on each side, each wing one long straight blade of pale gold-white light held in a
  brass frame, like a sword blade, each wing's brass frame joined to a shoulder plate, fanned out to the sides, their
  tips well below the top of the grey box; the gaps between the plates are narrow and the whole figure stays compact;
  nothing below
  the skirt (no feet, no wind, no shadow); palette of blackened steel, brass, gold, a cold white glow and pale gold
  light". action_prompt: "the Hollow Seraph, exactly as in Image 3: the same separate hovering plates of blackened steel
  and brass with narrow empty gaps, the glowing clockwork gear heart in the chest gap, the faceless brass helm-mask with
  the glowing slit, the broken gear-toothed halo, exactly four straight blade wings of pale gold-white light in brass
  frames, two on each side". attack: "a cutting strike: the four blade wings swing forward in a wide arc toward the
  heroes on the right, all four separately visible, two on the left side of the image and two on the right side, their
  points toward the heroes, the plates leaning forward; exactly four blade wings, as in Image 3, at exactly the same
  pixel size as in Image 3; no light trails, no effects; the whole figure well below the top of the grey box". cast:
  "a rite of judgement: the four blade wings raised high and spread wide to the sides, both gauntlets lifted, the gear
  heart blazing bright white, the halo glowing; exactly four blade wings, two on each side, all separately visible, as
  in Image 3; no other effects; the whole figure, wing tips and halo included, at the same pixel size as in Image 3 and
  well below the top of the grey box". hurt: "a violent jolt: the floating plates knocked further apart, the cuirass
  halves tilted, the gear heart flickering, the halo knocked askew, the lowest blade wing on each side faltering
  downward; all four blade wings stay visible, two on each side; the posture stays upright and controlled". face: "no
  face; the faceless brass helm-mask with its glowing slit and the gear heart are the readable features".
  extra_negative: "a face, skin, a body or bones inside the armour, feathers, feathered wings, more or fewer than four
  wings, a sword in the hands, white-and-gold armour, a cape, violet, purple, pink, magenta". `motion:` per pose: the
  current seraph line with "all four wings ... two on the left side of the image and two on the right side".
- **Floating:** "the idle shows it at its lowest; in the attack, the cast and the hurt it rises a little" (water
  elemental R241 lesson, the FW-C lift covers the rest).
- **Rig:** FW-1 floating template, the four blades as rigid parts on their own roots (the current seraph recipe),
  `cast_hand`, `raise: false`. fx: the old `halo` entry (`FX_ALLOWED`, `selftest_efix.py:20`) moves to `FX_PENDING`
  when the old rig is retired and is re-confirmed or removed with the new rig; a new fx (e.g. the gear heart glow at
  cast) needs orchestrator approval (D-V18).

### 4.2 Chaos (`chaos`, new size `titan`)

**Design (original; the user's film reference is used only for "a cosmic, dimensional overlord presence"; no named
character's features are recreated).** A colossal overlord from beyond the edge of the world: a vast floor-length robe
of void-black cloth pooling wide on the ground and hiding the legs, its folds speckled with tiny pale star points; a
broad black-and-gold armoured upper body; **exactly two** huge arms in gold-clawed gauntlets (D-V10: the four-arm count
failed in 4 of 6 pass-R action attempts); in place of a head a tall crown of living flame (ember orange, gold, white)
around a dark empty face with two blazing white eyes; **four orbs** in a ring around the burning head in the four
Fiends' lights (frost cyan, ember orange, abyss teal, storm white), which keeps the existing lore ("fed by the four
Fiends").
- Must differ from: the retired four-armed obsidian titan with shadow-flame wings; `drowned_sovereign` (crowned human
  king in teal and pearl robes: chaos has no human face, a void-black robe and a flame head); `ashen_queen` (six arms,
  mask and ray crown, serpent tail: chaos has two arms, a flame head, a robe).
- Body: biped **robed** recipe with hem pins (FW-5, the drowned_sovereign recipe); 5 poses: idle, attack, cast, hurt,
  attack_raise (`attackAnim: heavy` stays).
- **Prompt seeds.** prompt: "Chaos, a colossal overlord from beyond the edge of the world, towering and enormous: a
  vast floor-length robe of dark void-black cloth pools wide on the ground and hides the legs, its deep folds speckled
  with tiny pale points like distant stars; a broad upper body in black-and-gold armour plates; exactly two huge arms
  in black-and-gold gauntlets with long gold claws, held out low at the sides with the palms open; in place of a head,
  a tall crown of living flame in ember orange, gold and white rises from the armoured collar around a dark empty face
  with two blazing white eyes; four orbs of light set in a ring around the burning head, each orb touching the edge of
  the flame crown, one frost cyan, one ember orange, one abyss teal and one storm white; the flame tips well below the
  top of the grey box; palette of void
  black, gold, ember orange, white and the four orb colours". action_prompt: "Chaos, exactly as in Image 3: the same
  pooled void-black star-speckled robe hiding the legs, the black-and-gold armoured upper body, exactly two huge arms
  with gold-clawed gauntlets, the tall crown of living flame around the dark face with two blazing white eyes, and the
  ring of four orbs (frost cyan, ember orange, abyss teal, storm white)". attack: "a crushing blow, seen in the same
  front view as Image 3: the upper body leaning toward the heroes on the right, the arm on the right side of the image
  swung down in front of the body, its huge clawed gauntlet smashing down low toward the heroes, the arm on the left
  side of the image drawn back at the hip; exactly two arms; the robe still pooled on the ground; at the same pixel size
  as in Image 3". cast: "channelling the end of the world, a mirror-symmetric pose: both arms raised high with open
  clawed hands beside the burning head, the flame crown blazing taller and brighter but its tips still well below the
  top of the grey box, the four orbs flaring and spread a little wider; exactly two arms; at the same pixel size as in
  Image 3". hurt: "struck: the upper body arched back, the flame crown guttering and bent back, the four orbs knocked
  out of their ring, both arms flung out wide with the clawed hands splayed open, the robe still pooled on the ground;
  exactly two arms; at the same pixel size as in Image 3". attack_raise: "the wind-up of a crushing blow, a
  mirror-symmetric pose: both arms raised overhead, the two great gauntlets clenched together above the flame crown,
  the upper body sunk lower into the pooled robe so that the whole figure, raised fists included, stays inside the grey
  box at exactly the same pixel size as in Image 3; exactly two arms; the gap between the raised arms and the flames is
  empty background". face: "the dark face with two blazing white eyes inside the flame crown is readable".
  extra_negative: "four arms, six arms, legs, feet, wings, a tail, horns, a second head, a weapon, purple fire, violet,
  pink, magenta, a human face with skin". `base:` the robe hem is part of the body (FW-9 sentence).

**Cell, band and atlas (D-V6).**

| Option | Cell / display | Figure on screen | Framework | Atlas | Verdict |
|---|---|---|---|---|---|
| **C1 (decided, subject to G-T0)** a new **titan band**: 300x300 cell, feet row 292, top row >= 15, so the figure is **258-278 art px** (258 = 1.4 x the lich's 184; 278 = 292 - 15 + 1), scale 2 | 600x600 box, figure 516-556 tall (1.40-1.51x the lich's 368) | FW-T (7) | 22 frames x 300^2 = 1.98 Mpx: a new page group `titan` after D, one page of about 1800x1200 (6 cells per shelf, 4 shelves); planned 9 -> 10 pages, the real count is measured at integration (rev 16); page 2 keeps death_eye and warmech | same pixel density as every other boss (2 screen px per art px; `spec.py:310` "keeps the party's pixel density"); the 1024^2 Gemini render pixelizes to 300 with more detail than to 200 |
| C2 boss band (200) at display scale 3 (FW-S) | 600x600 box, figure about 550 | none | unchanged | chunky 3 px pixels on the final boss next to 2 px party pixels; **the fallback** if G-T0 fails or both C1 idle attempts fail closed |

**Why C1 can fail with today's cutter (momus rev 1, measured by momus; G-T0 re-measures).** The pose guide caps the
size box at `h - 110` = **914** guide px (`monster.py:214`). The cached chaos and lich idles come back at a pixel pitch
of about 5.12 render px per art px, i.e. about 200x199 native; the tallest native figure over the 80 cached boss renders
is 255 px; fine-pitch renders (pitch 3.04-3.42) were block-averaged down to about 192. If a render is too short for
the band, `monster.cut` scales it up with a **non-integer nearest-neighbour factor** (`monster.py:470`, about x1.4 for
a 200-native render into a 278 band): that is option S4's stair-step artefact on the final boss. Hence:
- **FW-T fail-closed:** a titan-band cut whose `info["scale"] != 1.0` or whose cut mode is not `"grid"` (the
  pixel-grid path) **raises** instead of resampling; the attempt is logged as **rejected** (it still counts in the
  ledger). `selftest_titan.py` RED cases: a synthetic 1024^2 render at pitch 5.12 (about 200 native) is refused; one at
  pitch 3.3 with a grid-aligned figure of 270 native cuts at scale 1.0, mode `grid`, lowest row 292.
- **G-T0 (zero cost, framework owner, before chaos's first paid request):** run the titan cut offline on every cached
  boss render in the main checkout (`out/gemini/*/*/boss_*_raw.png`, about 80) into a scratch dir and record, per
  render: detected pitch, cut mode, `info["scale"]`, native figure height. Report how many reach >= 258 native at scale
  1.0 in grid mode (today's estimate from momus: none above 255), and the titan guide's box size in guide px and in art
  px at the observed pitches. The orchestrator **re-confirms D-V6 with these numbers** before any chaos image; if
  rejected, chaos is planned under C2 from the start (no titan band, no FW-T page group).
- **Budget split (orchestrator ruling, rev 1(c)):** under C1, `chaos/boss_idle` gets **at most 2 attempts** at the
  titan band; the **3rd is reserved for the C2 fallback** (boss band 200, shown at scale 3). The other chaos poses
  follow whichever band the approved idle has. G-T0 and the fail-closed rule mean a failed C1 costs at most 2 images.

**Battle layout (TS/data owner).** `ENEMY_AREA` is 545 px tall (y 200-745), a 600 px box does not fit. `size: titan`
uses `TITAN_AREA = {x0: 80, x1: 1340, y0: 140, y1: 745}` (one box, no columns). With feet at y 745 the cell top is
745 - 2 x 293 = **159**; the opaque top (top row >= 15, the review headroom rule) is at >= 189, above the 124
`TRAVEL_CLEAR_Y` (message window 120 + 4). Width 600 of 1260: it dominates the enemy side (and the whole enemy-area
height). Chaos fights alone (data test: no formation pairs a titan with another enemy).
- **Attack:** in place (travel 0; D-V7): the titan's `attackPlan` returns travel 0 like a ranged enemy, the heavy
  table (`attackAnim: heavy`) plays with its own lunge; `TRAVEL_HOP.titan = 0`. Cast: in place as every boss.
- **Overshoot headroom:** `atk_follow` / `cast_release` go 10 % past the key; the approved keys need top row >= 15 and
  no opaque pixel on the 1 px border (guide 1.4), the cast's flame tips included.
- **Bestiary fit:** the panel inner rect is 940x720; the 600x600 box fits with 60 px to spare vertically. Centred by
  item 1, a figure of h art px has its feet at 498 + h (screen): for h <= 272 the feet stay <= 770 and no clamp binds;
  for the C1 maximum h = 278 the feet would be at 776 > 770, so the plain clamp binds: feet at 770 (shift -6 px), top
  at 214 >= 138. The `bestiaryCentre` test computes the real shift from the approved chaos and names chaos with it;
  the measured value is recorded in section 17 (rev 17). Under C2 (h about 183 art px at scale 3 = 549 screen px) the
  feet would be at 772: the same clamp, shift about -2.
- **Tests:** `enemyTravel.test.ts:131` (bosses list includes chaos: now travel 0), `lungeClearance.test.ts:21`,
  `BattleArtPages.test.ts` (fixture only, unchanged), `MonsterPages.test.ts` (the measured page count, rev 16), `heavyGlint.test.ts`
  (chaos raise tip from the new atlas).

**Acceptance (both bosses).**
- [ ] Each pose: <= 3 pass-V attempts; review checklist + limb / wing count + identity vs the approved new idle
  (palette, named anchors, height within +-10 %); approved in order idle -> attack -> cast -> hurt (-> raise).
- [ ] Chaos: idle figure height **258-278 art px** at scale 2 under C1 (or >= 172 art px at scale 3 under C2), cut
  at `info["scale"] == 1.0` in grid mode (C1); the box fits `TITAN_AREA`; every frame's top >= y 124 on screen; the
  bestiary shows it whole.
- [ ] Seraph and chaos: the per-pose piece comparison (render vs cut) shows no missing planned piece; chaos's four
  orbs touch the flame crown or lie inside the figure box (rev 13).
- [ ] Rigs: `check` OK with cast frames (+ the chaos raise set), fresh image-only verdict, `lock`; <= 4 iterations;
  the titan rig is the first rig at 300 px (if it needs a template change, it is filed with the framework owner and the
  iteration count pauses).
- [ ] Data: descriptions and lore rewritten (ASCII), `hollow_seraph_2` keeps `sprite: hollow_seraph`; chaos `size:
  titan`; `rosterData.test` rematch rule still holds.

---

## 5. Retired sprites (binding user addition)

**Rule.** No redesigned sprite is thrown away. Before the **first paid request** for a redesigned id, its current
assets are archived under a retired id `<id>_v1`, committed, kept out of every build and gate, and indexed. A later
redesign of the same id uses `_v2`, and so on.

| What | From | Archive (committed) |
|---|---|---|
| approved sheets + json | `assets-src/gen/approved/<id>/*` | `assets-src/gen/approved/_retired/<id>_v1/*` (byte copies) |
| rig + lock | `assets-src/gen/anim/monsters/<id>.yaml`, `<id>.lock.json` | `assets-src/gen/anim/monsters/_retired/<id>_v1.yaml`, `.lock.json` (copied at archive time; the live rig is removed by the generator in the commit that approves the id's first new sheet, rev 2) |
| monsters.yaml entry | the `<id>` entry | `assets-src/gen/retired/monsters_v1.yaml` (the entry verbatim, `id` kept as `<id>`, a `retired_as: <id>_v1` field; not read by the generator) |
| cache keys / raws | the approved json `cache_key` (already committed, un-ignored in `.gitignore`) | listed in the index; rejected-attempt raws stay where they are (git-ignored, main checkout only) |

**Index `docs/RETIRED_SPRITES.md`:** one row per retired sprite: retired id, original id, sheets (pose files),
source R-rows and cache keys, the reason, the rig iteration / lock state, and **how to revive it as a new enemy** with
the tested tool (rev 8 ruling): `python3 -I assets-src/gen/retire.py --revive <id>_vN --as <new_id>`. A hand copy is
not enough: `load_entries` keys a sheet by `meta["character"]` (`monster_anim.py:52`), not by the directory name, and
the archived `cache_key` was computed for the old id and prompt, so a re-plan under the new id never reproduces it.
`--revive` therefore: copies the archive to `approved/<new_id>/` and rewrites `character` in every json to `<new_id>`
(keeping `cache_key` as provenance and adding `revived_from: <id>_vN`, which `_approved_keys` skips: an approved
json with `revived_from` is checked against the archived key's committed cache file instead of a re-plan); copies the
rig and lock to `anim/monsters/<new_id>.*` with `sprite: <new_id>`; writes a `monsters.yaml` entry from
`retired/monsters_vN.yaml` under the new id with `revived_from`; refuses if `<new_id>` already exists anywhere; and
prints the remaining manual steps (a `monster_pages.py` group entry, `enemies.yaml` and bestiary data). `check
<new_id>` must then print OK with the archived lock (the pixels and rig are unchanged).

**Initial rows (measured at 9fe129c):**

| Retired id | Sheets (cache key, R-row) |
|---|---|
| `crazy_horse_v1` | monster_large (`39b9a7e6c503037dd8dbe059`, R82) |
| `piscodemon_v1` | monster_small (`a6f48aea1aa31985939c381c`, R60) |
| `black_knight_v1` | monster_small (`091ec6a36700c923e32b1d8c`, R246) |
| `guardian_v1` | monster_large (`0683f05fb008f4c9a7c686a8`, R253, best of 3) |
| `vampire_v1` | monster_small (`fdcaf07fd5789e2d402f4f7d`, act 1, `docs/ACT1_LOG.md`) |
| `hollow_seraph_v1` | boss_idle (`d0a454c671a5aa6d6415d916`, R25), boss_attack (`0cede2c0d74f95ac6c94bb20`, R28), boss_cast (`b1755fc7de941893455877e5`, R29/R32), boss_hurt (`ae3a5b995c782c9115f90312`, R37), boss_attack_raise (`d6093d88bccd3a2763233363`, R38/R41; unused by the rig, FW-R) |
| `chaos_v1` | boss_idle (`fb4bd02e837ce1d90e7822d5`, R55), boss_attack (`a53174205b082f2dd9915dd2`, R58/R59), boss_cast (`d1d7f2cf7f40881cd74bd566`, R67), boss_hurt (`b7905062c7067cc80e157701`, R68), boss_attack_raise (`4231dfbf8167a1d0e608b9a8`, R70) |

**FW-RT (framework owner, RED first) — the archive tool and the overwrite gate.**
1. `assets-src/gen/retire.py <id> [--as <id>_vN]`: copies `approved/<id>/*` to `approved/_retired/<id>_vN/`, copies
   the rig and lock to `anim/monsters/_retired/`, writes the monsters.yaml entry to `retired/monsters_vN.yaml`, prints
   the index row; refuses if the target exists with different bytes. `--prune <id> <sheets>` deletes stale pose files
   from `approved/<id>/` **only** when byte-identical copies exist in the archive. `--move-rig <id>` removes the live
   rig and lock (only when byte-identical archive copies exist). **Who runs them and when (rev 2):** the **generator**,
   in the main checkout, in the **same commit** that approves the id's first new sheet: `--move-rig <id>` (otherwise
   `selftest_anim.py:106-127`, which builds the atlas, would run the old rig on the new pixels), and for a boss
   `--prune <id> boss_attack boss_cast boss_hurt boss_attack_raise` in the commit that approves the new `boss_idle`
   (`pad_keyframes`, `monster_anim.py:76`, would otherwise pad the new idle with old poses; with only `boss_idle`
   present the sheet is reported "boss poses incomplete, skipped", `monster_anim.py:55-57`, until its new attack and
   hurt are approved).
2. `approve.py` gate (rev 6), **only for monster sheets and boss poses** (`monster_*`, `boss_*`; party, field and kit
   sheets are untouched by it): before writing `approved/<id>/<sheet>.png` it refuses (exit non-zero, naming the
   archive path) if the file exists, differs from the new bytes, and no byte-identical copy exists under
   `approved/_retired/<id>_v*/`. A byte-identical rewrite (re-approving the same cut) is allowed. Overwriting a sheet
   that was **approved in pass V** needs a new archive first: `retire.py <id> --as <id>_v2` (the v1 archive holds only
   the pre-pass-V art). For the **boss fallback** (5, below), the new poses approved so far are archived as
   `<id>_v2_partial` before the old set is restored.
3. **Exclusion by construction, proven by test (rev 8):** every build and check enumerates one level deep:
   `APPROVED.glob("*/monster_*.json")` and `glob("*/boss_idle.json")` (`monster_anim.py:46, 54`); `RIGS.glob("*.yaml")`
   (`selftest_efix.py:209, 225, 398`, `selftest_fw5.py:100`, `fixmeasure_seq.py:75`); `build_assets.py:95, 170, 175`;
   `selftest_anim.py:96`; `selftest.py:241`; `selftest_keyoffset.py:126`; `puppet.py:526` (party rigs, `anim/*.yaml`);
   `_approved_keys` (`selftest_roster.py:154`, `approved/*/*.json`). `_retired/<id>_v1/` is two levels deep and
   `anim/monsters/_retired/` is a subdirectory. A **static check** in `selftest_retire.py` greps every `assets-src/**/*.py`
   for `rglob(` or a `**` glob pattern over `APPROVED`, `approved`, `RIGS`, `anim/monsters` or `ANIM` and fails on any
   hit, so a future recursive glob cannot pick the archive up unnoticed.

**`selftest_retire.py` (wired into `selftest.py` and `--anim`).**
- A fake approved tree with `approved/_retired/foo_v1/monster_small.{png,json}` and `anim/monsters/_retired/foo_v1.*`:
  the sprite list of `monster_anim.load_entries` (`monster_anim.py:40`), `check --all`'s id list, `monster_atlas` sheets,
  `run_fx_allowlist` / `run_fwq_allowlist` inputs and `_approved_keys` contain no `foo_v1` and no `_retired`.
- `approve.py` over an existing sheet without an archive copy: refused; with a byte-identical copy: allowed; with a
  different-bytes copy: refused.
- The gate's scope and cases (rev 6): a `battle.png` / `field.png` / kit sheet overwrite is not affected; a
  byte-identical rewrite is allowed; overwriting a pass-V-approved sheet without `<id>_v2` is refused and allowed after
  `retire.py <id> --as <id>_v2`; the boss fallback writes `<id>_v2_partial` before the restore.
- `retire.py` twice is idempotent; `--prune` and `--move-rig` without archive copies are refused.
- **Revival (rev 8 ruling):** on a fixture tree, `retire.py foo` then `--revive foo_v1 --as bar` yields
  `approved/bar/` whose json `character` is `bar` with `revived_from: foo_v1`; `load_entries` lists `bar` (and still
  no `foo_v1`); `check bar` against the copied lock is OK; `_approved_keys` accepts `bar` through its committed cache
  file and would reject it after the cache file is removed; a second `--revive ... --as bar` is refused.
- The static recursive-glob check (3).
- The real tree: for each of the 7 ids, once retired, every file of `approved/_retired/<id>_v1/` is git-tracked, and
  each archived json's `cache/<cache_key>.png` and `.json` are **git-tracked** (`git ls-files --error-unmatch`, rev 8),
  so the raw renders survive in git, not only in the main checkout.

**Gate (V3, before each first paid request):** `retire.py <id>` committed on `roster`, the index row written, and
`selftest_retire.py` PASSED. The generator's dry-run log line for the request quotes the archive commit.

**Rescaled sprites are not retired** (2.4): their PNGs, rigs and locks are untouched.

**Fallback if a redesign fails (3 attempts per sheet, no approvable image; rev 7):** the old approved files are
copied back from `_retired/<id>_v1/` (byte-identical) and the rig and lock restored; the `monsters.yaml` entry is
**restored from `retired/monsters_v1.yaml`** (so `_approved_keys` re-plans the restored sheets to their archived keys),
and the new pass-V text moves to `retired/pending_<id>.yaml` for a later attempt; the id is escalated to the user with
the attempts' measured results. For a boss the whole set is restored (no mixing of old and new poses), after the new
poses approved so far are archived as `<id>_v2_partial` (rev 6). **Chaos fallback:** it keeps `size: boss` (data and
approved json), no `titan` page group is created, and TS keeps `titan` support unused (the class stays tested by
fixtures).

---

## 6. Image budget (pass V)

**Ledger at the time of writing (main checkout, authoritative):** 367 Gemini attempts. Pass R used 267 (attempts
[100:367]) of its 300 (`budget.json` top level: `attempts_before 100`, `cap 300`); `pass R fix` opened at 363 with
`max_new 37`, 4 used. The guard applies **every** rule to every request (`generate.py:369-420`): the top-level `cap`
(33 left) and the top-level `max_attempts_per_sheet` 3 over `attempts[100:]` would refuse pass V (e.g. `chaos/boss_attack`
and `guardian/monster_large` already have 3). So FW-V0 must change the top level, not only add a pass.

**FW-V0 (framework owner, RED first, at V1).** `budget.json` becomes:

```json
{
  "note": "User 2026-11-16 (pass V, docs/REDESIGN_PLAN.md 6): up to 50 Gemini images for the 7 redesigned sprites, fresh per-sheet counts, at most 3 attempts per sheet, on top of the 267 pass-R images. Bedrock is not counted (user, 2026-11-13).",
  "attempts_before": 367,
  "cap": 50,
  "max_attempts_per_sheet": 3,
  "history": [{"name": "pass R", "attempts_before": 100, "cap": 300, "gemini_end": N_V0, "max_attempts_per_sheet": 3}],
  "passes": [
    {"name": "pass F (FB-8)", "...": "unchanged, closed"},
    {"name": "pass R build", "...": "unchanged, closed at 363"},
    {"name": "pass R fix", "gemini_before": 363, "max_new": 37, "max_per_sheet": 3, "only_approved": true, "gemini_end": 367},
    {"name": "pass V", "note": "docs/REDESIGN_PLAN.md 6", "gemini_before": 367, "max_new": 50, "max_per_sheet": 3,
     "only_ids": ["crazy_horse", "piscodemon", "black_knight", "guardian", "vampire", "hollow_seraph", "chaos"],
     "only_sheets": {"crazy_horse": ["monster_large"], "piscodemon": ["monster_small"], "black_knight": ["monster_small"],
                     "guardian": ["monster_large"], "vampire": ["monster_small"],
                     "hollow_seraph": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt"],
                     "chaos": ["boss_idle", "boss_attack", "boss_cast", "boss_hurt", "boss_attack_raise"]}}
  ]
}
```

- **Literals (rev 5):** 367 above is N_V0 as measured at 9fe129c; the framework owner re-counts at V1 and writes the
  **literal** count into `attempts_before`, `pass R fix.gemini_end` and `pass V.gemini_before` (never a computed
  value), and records it in `ROSTER_LOG.md` "Pass V".
- `check_budget` changes: (a) new pass fields `only_ids` (refuses a character not listed) and `only_sheets` (refuses a
  sheet not listed for that character, e.g. `hollow_seraph/boss_attack_raise` under D-V9; both messages name the pass
  and the id/sheet); (b) a **consistency guard**: it refuses every paid request, naming the inconsistency, if
  `attempts_before > len(attempts)` or if the closed `pass R fix.gemini_end`, the open `pass V.gemini_before` and the
  top-level `attempts_before` are not all equal; (c) it **never reads `history`** (history is documentation for the
  selftests). Everything else is unchanged: the top level now counts `attempts[N_V0:]` (cap 50, 3 per sheet: **fresh
  counts**), closed passes refuse nothing.
- `--retry` is still required (each sheet has prior ledger attempts); the user's ruling pre-approves up to 2 retries
  per sheet in pass V.
- **Selftests (RED first):** new `selftest_passv.py`: on a fake ledger `gem[:N_V0]` (+ the real per-sheet history),
  the 51st pass-V attempt is refused; a 4th attempt at one sheet in pass V is refused, a 3rd is not; `chaos/boss_attack`
  (3 pass-R attempts) gets its 1st pass-V attempt (fresh counts); `goblin/monster_small` is refused (`only_ids`); the
  real ledger: `gem[N_V0:]` <= 50, every id in `only_ids`, every sheet in `only_sheets`, <= 3 per sheet;
  `hollow_seraph/boss_attack_raise` is refused (`only_sheets`, RED today); the consistency guard refuses a budget with
  `attempts_before` > the ledger length and one whose three boundaries differ. **Pinned literals:** the selftest holds
  `PASS_R = (100, 300)`, `R_FIX = (363, 37)` and the recorded `N_V0`, and asserts that `budget.json` equals them
  field by field; `history` is **append-only**: its entries must equal a pinned prefix (`[{"name": "pass R",
  "attempts_before": 100, "cap": 300, "gemini_end": N_V0, "max_attempts_per_sheet": 3}]`), later passes may only add
  entries after it. **`selftest_roster.py` rewrite**
  (`:52-146`): the real-budget assertions read pass R's bounds from `history["pass R"]` and the closed `pass R build` /
  `pass R fix` entries instead of the top level (`:126-128` today assert `attempts_before == n0` and `cap == 300`), and
  the real-ledger slice becomes `gem[100:N_V0]` (<= 300, <= 3 per sheet, every attempt after 363 approved); the fix
  slice ends at `fix["gemini_end"]` (`:143` today slices to the ledger end, which would count pass-V attempts as fix
  attempts).
  **`selftest_daze.run_ledger` change** (`selftest_daze.py:101-131`): its pass-F slice checks read pass F by name and
  the literal 69 / 31 slice and stay; but its last check runs the **real** guard on `gem[:end]` + one lich
  `boss_attack_raise` and asserts **no** refusal at all (`check("pass F" not in err and not err, ...)`, `:130`). Under
  pass V that request is refused by `only_ids` (lich is not listed), so the check is narrowed to `"pass F" not in err`
  (a closed pass still refuses nothing), and `selftest_passv.py` covers the `only_ids` refusal. RED: today's assertion
  fails against the new `budget.json`; GREEN after the narrowing.

**Per-sheet table** (expected rates: regular **1.6** images per approved sheet, batch C 1.6 / batch D 1.67; boss poses
**2.0**, pass-R chaos 10 images for 5 poses, hollow_seraph 14 for 5 = 2.8, so the plan's simpler four-wing design is
budgeted at 2.0).

| Sheet | Pass-R attempts (main ledger) | Pass V base | Expected | Worst case |
|---|---|---|---|---|
| crazy_horse/monster_large | 1 | 1 | 1.6 | 3 |
| piscodemon/monster_small | 1 | 1 | 1.6 | 3 |
| black_knight/monster_small | 1 | 1 | 1.6 | 3 |
| guardian/monster_large | 3 | 1 | 1.6 | 3 |
| vampire/monster_small | 0 (1 in act 1, before attempt 100) | 1 | 1.6 | 3 |
| hollow_seraph/boss_idle, _attack, _cast, _hurt | 2, 3, 3, 3 | 4 | 8 | 12 |
| (hollow_seraph/boss_attack_raise, only if D-V9 = raise) | 3 | (1) | (2) | (3) |
| chaos/boss_idle, _attack, _cast, _hurt, _attack_raise | 1, 3, 3, 1, 2 | 5 | 10 | 15 |
| **Total** | | **14** (15) | **26** (28) | **42** (45) |

- Worst case 42 (45 with the seraph raise) <= 50, so the per-sheet cap alone keeps the build inside the pass; the
  remainder (>= 5) is the **fix-round reserve**, usable only for the 7 ids and only on sheets with fewer than 3 pass-V
  attempts.
- **Halt rules:** the guard refuses the 51st; the plan stops building at 45 (leaving >= 5 for fixes); 3 rejected
  attempts in a row on one body type pause that type (`ROSTER_PLAN.md` 6.3) until the wording is fixed offline.
- **Log:** `docs/ROSTER_LOG.md` gets a "Pass V" table, one row per attempt `| # | <id>/<sheet> (seed) | n | measured
  result | decision |`, and "Images used: U of 50 (ledger guard: G - N_V0)". The generator commits at every checkpoint.
- 0 images for items 1 and 3 (and for the archive, section 5).

---

## 7. Framework items

One owner, serial, RED first in a selftest, every existing lock unchanged, `selftest.py --anim` ALL PASSED per item.

| Id | Change | Files | RED-first selftest | Effort |
|---|---|---|---|---|
| FW-V0 | Pass V budget (6): literal top level N_V0 / 50 / 3, append-only `history` (never read by the guard), `pass R fix` closed, `pass V` with `only_ids` and `only_sheets`, the consistency guard | `budget.json`, `generate.py::check_budget` | `selftest_passv.py`; `selftest_roster.py` rewrite; `selftest_daze.py:130` narrowed | 2.5 h |
| FW-RT | Archive tool, approve gate, exclusion proof (5) | new `gen/retire.py`, `approve.py`, new `gen/retired/` | `selftest_retire.py` | 3 h |
| FW-S | Per-sheet display scale: `gen/monster_scale.yaml` (`{sprite: 3}`; allowed values 2 and 3; refuses an unknown sprite) -> atlas sheet field `scale`; nothing else changes | `monster_atlas.py` (sheet dict, `:108-114`), new `monster_scale.yaml` | `selftest_pages.py`: empty table -> JSON + pages byte-identical to the fixture; one entry -> only that sheet's JSON gains `"scale": 3`, pages identical; a value of 4 or an unknown id refused | 1.5 h |
| FW-A2 | `idleBox [l, t, r, b]` anchor from the idle frame (1, rev 9) | `monster_atlas.py` FW-A block (`:100-104`), `src/rendering/monsterAnchors.ts` | the anchors selftest gains `idleBox` for a fixture (equal to the idle frame's measured opaque box); no PNG byte changes | 0.5 h |
| FW-T | **Titan band** (4.2, only with D-V6 = C1 re-confirmed at G-T0), **fail-closed**: a titan cut with `info["scale"] != 1.0` or a mode other than `"grid"` raises (the attempt counts as rejected); plus G-T0's offline measuring command `monster.py --titan-probe <raw ...>`: `spec.MONSTER_BANDS["titan"]` and a `TITAN_POSE_GEOM` (grid 300x300, feet row 292, guide 1024^2 with the band box), `monster.cut` / `pose_guide` for it, `approve.py` writes `boss_<pose>` with `size: titan`, `monster_anim` pads titan keys to the 300 cell, the anim checks' cell-relative caps (`6 x cell_h / 80`, `anim_checks.py:165-176`) verified at 300, a `titan` page group after D in `monster_pages.py` whose membership is **any sheet whose approved json has `size: titan`** (taken out of its listed group), so the old chaos (`size: boss`) stays on page 2 until the new titan sheets are integrated and the V1 exit check stays byte-identical | `spec.py`, `monster.py`, `approve.py`, `monster_anim.py`, `monster_pages.py` | `selftest_titan.py`: a synthetic 1024^2 raw cuts to a 300 cell with the lowest row 292; every approved request key unchanged (`_approved_keys`); the page packer puts a 22-frame 300 sheet on its own page <= 2048; a fixture sheet switching to `size: titan` moves no cell of pages 0-1; with no titan sheet the pages are byte-identical | 1 d |
| FW-FX | fx allowlist upkeep (rev 3): **in V1** `("vampire", "slash")` and `("hollow_seraph", "halo")` are added to `FX_PENDING` (`selftest_efix.py:21`; a pending entry tolerates a missing part, `:215`), so retiring their rigs later fails nothing; with each new rig the entry is re-confirmed (kept in `FX_ALLOWED`, removed from `FX_PENDING`) or removed from both; new fx entries only with orchestrator approval (D-V18) | `selftest_efix.py:19-21` | the existing `run_fx_allowlist` | per request |

**V1 exit check (integrator, before any V3 integration or V5 rig branch).** With V1 merged into `roster-int`:
1. `git diff --exit-code 9fe129c -- assets-src/gen/anim/monsters/ assets-src/gen/approved/` (no rig, lock or sheet
   changed).
2. `build_assets.py monsters_ai` (background, about 150 s measured): `git diff --exit-code assets/sprites/monsters-ai-*.png`
   and the JSON differs from 9fe129c only by the `idleBox` fields (`monster_scale.yaml` still empty).
3. `monster_anim.py check --all` (background, about 160 s): 123 lines, only `OK` (+ the 4 FWQ `aliased` notes).
4. `selftest.py --anim` (about 460 s) and, main checkout after the fast-forward, `selftest.py` (about 480 s): ALL PASSED.
The commit that passes is **V-base**.

---

## 8. Data and TypeScript items

TS/data owner, in its own worktree off `roster-int`; files stay under 250 lines (`EnemyLayoutAi.ts` 129, `AiEnemyView.ts`
236, `BestiaryPreview.ts` 239: the centring code goes into a new `src/scenes/bestiary/bestiaryFit.ts` if
`BestiaryPreview.ts` would pass 250).

| Id | Change | Tests (RED first where new) | Effort |
|---|---|---|---|
| TS-1 | Bestiary centring + backdrop (1) | `bestiaryCentre.test.ts` (new), backdrop unit test, existing bestiary tests unchanged | 3 h |
| TS-2 | Per-sheet scale in `BattleArt` (`entry.scale ?? meta.scale`), lunge scaling once in `getMonsterFrames`, `huge` / `titan` classes, integer-scale passes and the pass-4 refusal, `TITAN_AREA`, titan in-place attack, size maps, `bossTag` titan rule, effect-anchor clamp (2.5, 2.6, 4.2) | `EnemyLayoutAi.test.ts` (integer-scale property test, 3-huge case, re-stated crowd case, `layout_f1.json` byte-identity for formations without a scale-3 sheet), the lunge spy test, the effect-anchor test, `AiEnemyView.test.ts` (scale-3 fixture: sprite scale 3, integer position), `enemyTravel` / `lungeClearance` (tier H, titan travel 0), `MonsterPages` (`scaleMode` nearest) | 1 d |
| TS-3 | `enemies.yaml`: `size` for bigeyes (large), the 22 tier-H ids (huge), chaos (titan); descriptions of the 7 redesigned ids (+ `hollow_seraph_2`); `bestiary.yaml`: `sizes` labels, lore pages of hollow_seraph and chaos rewritten (ASCII), backgrounds only if the review asks | `rosterData.test.ts:52` (+ the scale cross-check), `bestiaryData` / `bestiaryModel` tests, `crossFileValidation`, `assetCoverage` | 3 h |
| TS-4 | Sandbox / scenarios: an `anim_pass_v` debug scenario per group (the 5 regulars; the two bosses alone; 3 tier-H; 2 tier-L + 1 tier-H + 3 small); every sandbox formation with a tier-H sprite passes `formationFits` | the data test in 2.5 | 1 h |

Order: TS-1 has no dependency (can merge first). TS-2 needs the FW-S JSON shape (fixtures first, the real atlas after
V-base). TS-3's size lines land in the **same integration commit** as `monster_scale.yaml` (the cross-check test fails
on either alone); descriptions land with each new sheet's integration.

---

## 9. Process per sprite, ownership, iteration budget

### 9.1 Pipeline (per redesigned id; `ROSTER_PLAN.md` 9.1 with the pass-V steps in bold)

1. **Archive** (generator, main checkout, `roster`): `retire.py <id>`, the `docs/RETIRED_SPRITES.md` row, commit.
2. **Declare** the new `monsters.yaml` text (section 3 / 4). `selftest.py` now lists exactly this id's sheets in
   `_approved_keys` (expected until approval).
3. Dry run (0 cost); the paid request (one; `--paid --retry`; bosses `boss_idle` first, then one pose per checkpoint).
4. Review (guide 1.4 + the add-ons of 3 / 4: counts, siblings and the archived old sprite side by side, face at 1x,
   ground / float rule, identity vs the new idle for boss poses).
5. Approve (`approve.py`; the FW-RT gate passes because step 1 ran). **In the same commit as the id's first new
   sheet (rev 2), the generator runs `retire.py --move-rig <id>`**, and for a boss, in the commit approving the new
   `boss_idle`, `retire.py --prune <id> boss_attack boss_cast boss_hurt boss_attack_raise` (the seraph's old raise is
   never regenerated under D-V9; chaos's is regenerated later). The main checkout is then consistent at every commit:
   the id builds with no rig, or is "boss poses incomplete, skipped" until its attack and hurt exist. Log row, commit.
6. **Integrate the sheet** (integrator, `roster-int`): merge `roster` **only when every redesigned id on it is complete**
   (all its sheets approved, or restored from the archive) and only between generator checkpoints (rev 14), so the
   build never mixes old and new poses; data (TS-3 description) and the pinned tests of 9.5 in the same commit;
   rebuild; rolling gate (9.4); commit.
7. Rig (rig agent): mark -> calibrate -> iterate (<= 4) -> `check` -> `review`.
8. Fresh image-only review (strips, onion, GIFs, `_stage.png`, the approved sheet; guide 3.4 criteria 1-6 + the add-ons):
   SHIP / SHIP WITH NITS / ITERATE.
9. Lock, restore the local atlas, hand off (iterations, nits, `fixmeasure.py` numbers if any gate used it).
10. Integrator merges, rebuilds, `check --all`, the browser loop, commits.

**Rescaled sheets** (no new art): FW-S entry + TS-3 size line (one integration commit) -> rebuild -> the block test and
the image-only rescale review (2.7). No rig agent.

### 9.2 Ownership

| Role | Owns (only) | Count |
|---|---|---|
| Generator | `monsters.yaml`, `approved/<id>/` and `approved/_retired/`, `retired/`, `cache/<key>.*`, `ledger.jsonl`, `ROSTER_LOG.md` pass-V rows, `RETIRED_SPRITES.md`; **runs `retire.py` (archive, `--prune`, `--move-rig`, so it may delete the live rig and lock of a redesigned id and stale `approved/<id>/boss_*` files, only through the tool; rev 2)**; the **main checkout on `roster`**, commits at every checkpoint | 1, serial |
| Framework owner | `gen/*.py` (incl. `retire.py`, `generate.py`, `approve.py`, `spec.py`, `monster_*.py`, `anim_*.py`), selftests, `budget.json`, `monster_scale.yaml` (schema; the integrator fills the entries) | 1, serial |
| TS/data owner | `src/`, `tests/`, `enemies.yaml`, `bestiary.yaml`, `debug-scenarios.yaml`, `debug-sandbox.yaml` | 1 |
| Rig agents | `anim/monsters/<id>.yaml` + `.lock.json` of their sprite | <= 4 at a time |
| Image-only reviewers | verdicts only | fresh per sprite / per rescaled batch |
| Integrator | atlas pages and JSON, `monster_scale.yaml` entries, merges, `check --all`, AGENTS.md / guide updates; **this worktree on `roster-int`** | 1 |
| Adversarial tester | `ROSTER_PLAYTEST.md` "Pass V test" | 1-2 fresh |

Branches as `ROSTER_PLAN.md` 9.2: `roster` = generator commits plus fast-forwards to `roster-int` only between
checkpoints; `roster-int` is the only branch with atlas pages. Rig agents restore `assets/sprites/monsters-ai*`
(`git checkout -- 'assets/sprites/monsters-ai*'` and delete untracked pages) before hand-off.

### 9.3 Iteration budget and escalation

4 rig iterations per new sprite (the chaos titan rig included; a framework blocker pauses the count), 3 per fix-round
item; then stop and report (strips, failing criterion, options). No paid fallback for rig problems.

### 9.4 Allowed failures per redesigned-id state (rev 4)

Each redesigned id moves through these states. In each state **only** the listed lines may appear; any other
failure, or a listed line for a different id or sheet, **stops work** and goes to the orchestrator.

| State | Where | Allowed (exactly) | Nothing else |
|---|---|---|---|
| A archived (`retire.py <id>` committed) | main checkout | none: `selftest.py` ALL PASSED, `selftest_retire.py` PASSED | |
| B new text declared in `monsters.yaml` | main checkout | `selftest.py`: the `_approved_keys` check fails listing exactly `<id> <sheet>` for each of the id's approved sheets whose request text changed (regular: `monster_<size>`; boss: every `boss_*` still in `approved/<id>/`) | every other check passes (the `_fields` pins read the archived entry, 9.5) |
| C first new sheet approved (+ `--move-rig`, boss `--prune`) | main checkout | regular: none (ALL PASSED); the atlas build inside `selftest_anim.py` prints the info line `<id>: no rig`. Boss: `_approved_keys` lists exactly the id's poses still to be regenerated; the build prints `monsters_ai: <id> boss poses incomplete, skipped` until attack and hurt are approved | no check failure |
| D integrated without rig | `roster-int` | `check --all` prints `<id>: no rig` (info); vitest: none allowed (the 9.5 tests land in the integration commit) | |
| E rigged and locked | both | none: `check <id>` OK, every selftest and vitest green | |

### 9.5 Tests and selftests pinned to the 7 ids (rev 3)

| Test (line) | Pinned to | Owner | Lands in | Treatment |
|---|---|---|---|---|
| `selftest_roster.py:274-294` `_fields` | the seraph's six-wing wording and its `motion` keys `{hurt, attack_raise}`; chaos's four-arm wording | framework | **V1** | for an id with an archive entry the pass-R pins read `retired/monsters_v1.yaml` (still true of the archived design); new pass-V pins for the live entry: the four-wing / two-arm count words and `motion` keys a subset of the id's `only_sheets` poses |
| `selftest_efix.py:249-284` `run_halo_brighten` | the live hollow_seraph rig and keys | framework | V1 | takes an injectable rig + keys; the test passes the fixture copies from `approved/_retired/hollow_seraph_v1/` and `anim/monsters/_retired/hollow_seraph_v1.*` when present, else the live files (byte-identical until the redesign) |
| `selftest_efix.py:21` `FX_PENDING` | vampire `slash`, seraph `halo` | framework | V1 | both added (FW-FX); removed when the new rigs land |
| `selftest_pages.py:153` `ANCHORS` (chaos `travelTop` 12) and `:241-244` (FW-R chaos raise tip) | the live chaos sheet | framework | V1 | read from the `chaos_v1` archive when present, else live (same bytes); if the titan is integrated before the archive fixture exists, the anchor case moves to `lich` |
| `selftest_pages.py:277-285` | the seraph padded to 200 / 218 | framework | V1 | archive fixture, as above |
| `selftest_fixmeasure.py:150-154` | `switch black_knight attack` need 0.46 | framework | V1 | archive fixture (`black_knight_v1`) |
| `selftest_fw5.py:22` `PROTOTYPES` | the preset prototype rigs | framework | each V5 rig merge | a new rig that is a preset's first user (e.g. guardian on the mechanical preset if listed) is added in the same merge |
| `tests/scenes/battle/heavyGlint.test.ts:88`, `:146-197` | seraph `raise: false` and its atlas cells | TS/data | seraph integration commit | `:88` stays true (D-V9); the cell expectations are re-derived from the new atlas |
| `tests/scenes/battle/lungeClearance.test.ts:21`, `enemyTravel.test.ts:131` | boss lists incl. chaos, seraph | TS/data | TS-2 (titan travel 0, fixtures) and each boss's integration commit | re-measured on the new art |
| `tests/data/assetCoverage.test.ts` | every enemy has a sheet with every frame key | TS/data | each integration commit | passes with `anim: false` aliases; no change expected |
| `tests/data/rosterData.test.ts`, `rosterStats.test.ts` | sizes, descriptions, stats | TS/data | TS-3 and each integration commit | sizes extended; descriptions new; stats unchanged (D-V11) |
| `tests/scenes/bestiary/bestiaryHabitats.test.ts` | habitats / boss tags | TS/data | chaos integration | `bossTag(chaos)` pinned (rev 11) |
| `tests/scenes/battle/__golden__/layout_f1.json` | formations incl. vampire | TS/data | vampire integration commit | only the formations with vampire are regenerated (the byte-identity test of 2.6 covers the rest) |

---

## 10. Tranches, ownership and parallelism

All worktrees branch off `roster-int`. **Concurrency cap: 4 agents at a time.**

**Branch order (rev 14).**
- **V-gen** = the `roster-int` commit with FW-V0 and FW-RT merged and `selftest.py --anim` (worktree) and `selftest.py`
  (main checkout, on a scratch branch) ALL PASSED. The main checkout fast-forwards `roster` to V-gen **before V3 starts**
  (the generator needs the new guard and `retire.py`).
- After that, `roster` has its own generator commits, so `roster-int` -> `roster` updates are **merges** (never a
  force or reset), done by the generator **only between checkpoints** (no uncommitted attempt, ledger linear).
- **V-base must reach `roster` before chaos's first request** (it carries FW-T and the G-T0 tool).
- **No merge of `roster` into `roster-int` before V-base** (the V1 exit check compares against 9fe129c and must see no
  generator change).

**Brief rules (every agent).**
- A **10-minute no-progress watchdog** kills agents: keep each foreground call under 2 minutes. **Long commands
  (rev 15 ruling):** start them with `run_in_background` as `<cmd> > /tmp/<agent>/<step>.log 2>&1; echo EXIT=$? >>
  /tmp/<agent>/<step>.log`, then wait with the **Monitor** tool on an `until grep -q EXIT= /tmp/<agent>/<step>.log;
  do ...; done` condition with a **timeout of at most 240 s**; when it times out, print one progress line (the log's
  last line) and **re-arm** it. Never `sleep`; never poll with a self-matching `pgrep` (below).
- **Never two `monsters_ai` builds in one worktree at the same time** (they write the same `assets/sprites/monsters-ai*`
  files); a second build waits for the first's `EXIT=`.
- Measured durations (`ROSTER_LOG.md` "Fix pass 2", this machine, one agent): `build_assets.py monsters_ai` 148 s;
  `check --all` 156 s; `selftest.py --anim` 459 s; `selftest.py` 481 s; `fixmeasure.py` one sprite 2-6 s. `npx vitest
  run` is **re-measured at V1** and recorded in `ROSTER_LOG.md` "Pass V". With up to 4 agents on the machine, assume
  every duration grows (plan for 2x); the 240 s Monitor re-arm keeps the watchdog fed regardless. All but
  single-sprite commands go to the background.
- **Never a bare `git stash`** (it can swallow another agent's work in a shared checkout); use a named branch or
  `git stash push -m <label> -- <paths>` only in your own worktree.
- **No self-matching `pgrep` loops:** a wait loop like `while pgrep -f "build_assets"; do ...` whose own command line
  contains the pattern never ends. Wait on the background task's notification or its output file instead.
- One sprite per `check` / `review` call; hand off after each sprite.

| Tranche | Scope | Owner / worktree | Depends on | Parallel with | Effort |
|---|---|---|---|---|---|
| V0 | momus review, revisions applied, decisions D-V1..D-V18 recorded | orchestrator | - | - | 0.5 d |
| V1 | FW-V0, FW-RT, FW-S, FW-A2, FW-T (if C1), serial; V1 exit check -> **V-base** | framework owner, `v-fw` | V0 | V2 | 2 d |
| V2 | TS-1 (centring, ships on its own), TS-2 on fixtures | TS/data owner, `v-ts` | V0 | V1 | 1.5 d |
| V3 | Generation (main checkout, `roster`, from V-gen): archive then generate in order **crazy_horse, piscodemon, black_knight, guardian, vampire** (one checkpoint each), then **hollow_seraph** (idle, attack, cast, hurt), then **G-T0** and the D-V6 re-confirm, then **chaos** (idle at most 2 titan attempts, the 3rd reserved for C2; then attack, cast, hurt, raise) | generator (+ framework owner for G-T0) | V-gen; V-base merged into `roster` for chaos | V2, V4, V5 | 1-1.5 d |
| V4 | Rescale integration: `monster_scale.yaml` 23 entries + TS-3 sizes, rebuild, 2.7 acceptance (block test, image-only rescale review in 2 batches of about 12) | integrator + TS/data owner + 1 reviewer | V-base, TS-2 | V3 | 0.5 d |
| V5 | Rigs, two waves of <= 4: **wave 1** crazy_horse, piscodemon, black_knight, guardian; **wave 2** vampire, hollow_seraph, chaos (the titan rig after FW-T and its approval) | rig agents `v-rig-<id>` | each sheet integrated (9.1 step 6) | inside a wave; V3 continues | 3-4 d |
| V6 | Final integration: rebuild, full validation (11), docs (13) | integrator | V3-V5 | - | 0.5 d |
| V7 | Fresh adversarial play test (12) | tester | V6 | - | 0.5 d |
| V8 | Fix round (plan -> momus -> fixes -> re-test), images only from the pass-V remainder | planner, momus, owners | V7 | - | 1-2 d |

Agent count at any moment: V1 + V2 + generator + 1 = 4; during V5 the generator (if still running) counts as one of the 4.

---

## 11. Validation commands

### 11.1 Commands (integrator; long ones in the background)

```bash
# budget and ledger (MAIN checkout): pass V used, ids and per-sheet counts
python3 -I - <<'EOF'
import json, collections
L = [json.loads(l) for l in open('assets-src/gen/cache/ledger.jsonl') if l.strip()]
g = [e for e in L if e.get('event') == 'attempt' and e.get('backend') != 'bedrock']
b = json.load(open('assets-src/gen/budget.json')); n0 = b['attempts_before']
pv = next(p for p in b['passes'] if p['name'] == 'pass V'); v = g[n0:]
ok_sheets = {(c, sh) for c, shs in pv['only_sheets'].items() for sh in shs}
c = collections.Counter((e['character'], e['sheet']) for e in v)
foreign = sorted(k for k in c if k not in ok_sheets)
print('pass V used', len(v), 'of 50; max per sheet', max(c.values(), default=0), '; foreign', foreign)
raise SystemExit(0 if len(v) <= 50 and max(c.values(), default=0) <= 3 and not foreign else 1)
EOF
# archive
python3 -I assets-src/gen/selftest_retire.py
for i in crazy_horse piscodemon black_knight guardian vampire hollow_seraph chaos; do git ls-files --error-unmatch assets-src/gen/approved/_retired/${i}_v1/ >/dev/null && echo "$i archived"; done
# rescale: approved art, rigs and locks of the rescaled sheets untouched
git diff --exit-code V-base -- $(for i in bigeyes shark minotaur ochu neochu hydra earth_elemental fire_elemental water_elemental air_elemental hill_gigas fire_gigas ice_gigas dragon white_dragon blue_dragon green_dragon dragon_zombie white_shark minotaur_zombie fire_hydra deepeyes evil_eye; do echo assets-src/gen/approved/$i assets-src/gen/anim/monsters/$i.yaml assets-src/gen/anim/monsters/$i.lock.json; done)
# pipeline (background)
python3 -I assets-src/gen/selftest.py --anim            # worktree; the main checkout runs the full selftest
python3 -I assets-src/gen/monster_anim.py check --all   # only OK (+ 4 FWQ aliased notes); 'no rig' only for redesigned ids mid-pass
python3 -I assets-src/build_assets.py monsters_ai battle_ai field_ai
git diff --exit-code assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai* > /tmp/v.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum -c /tmp/v.sha
python3 -I -c "import json; m=json.load(open('assets/sprites/monsters-ai.json')); print([(p['w'],p['h']) for p in m['pages']]); assert all(p['w']<=2048 and p['h']<=2048 for p in m['pages']); assert all(m['sheets'][s]['page']==0 for s in ['cockatrice','dragon','garland','goblin','gr_imp','gr_wolf','lich','mummy','ogre','pirate','skeleton','troll','vampire','wolf'])"
python3 -I assets-src/gen/monster_roster_report.py      # no new flagged sibling pair
# TypeScript (background)
npx tsc --noEmit && npm run build && npx vitest run
npx vitest run tests/scenes/bestiary/ tests/scenes/battle/ tests/data/ tests/rendering/
# browser (dev server bound to 127.0.0.1, a free port; every URL with &mute=1)
#   /?mute=1&bestiary=<id>                                  every changed sheet (centring, fit)
#   /?mute=1&bestiary=<id>&battleStep=1                     the 7 redesigned ids, every frame
#   /?mute=1&sandbox=l30_lich&enemies=<id>&enemyAnim=step   the 23 rescaled (block test) and the 7 redesigned
#   /?mute=1&scenario=anim_pass_v_*&enemyAnim=loop          the TS-4 groups
```

### 11.2 Frame-rect diff against V-base (by sheet and frame, content; the guide 3.7 script with `git show V-base:...`)

The changed sheets must be **exactly** `crazy_horse, piscodemon, black_knight, guardian, vampire, hollow_seraph,
chaos` (cell moves on their pages are not changes: the script compares content by `(sheet, frame)`). The 23 rescaled
sheets are `same` (their JSON `scale` field is checked by the FW-S JSON diff instead). The 12.2 check against
`roster-r0` keeps `CHANGED_ON_PURPOSE = {gr_imp, gr_wolf, lich, garland, vampire, ogre, troll}` (vampire is already
there; no new act-1 entry).

---

## 12. Adversarial play test and fix round

A **fresh** tester (no plan context beyond the URLs, the changed-sheet list and the evidence path) checks:
- every redesigned sprite in battle and the bestiary, every frame at 1x and 4x: counts (piscodemon 6 tentacles,
  guardian 4 legs + 2 blades, hollow_seraph 4 blade wings, chaos 2 arms + 4 orbs), the face at 1x, "evil / otherworldly
  / terrifying" read (yes/no with a one-line reason), sibling distinctness (crazy_horse vs nightmare, piscodemon vs
  mindflayer, black_knight vs death_knight / dark_fighter, guardian vs warmech / soldier / iron_golem, vampire vs
  vampire_lord, the new vs the archived sprite);
- the 23 rescaled sheets: larger than the ogre, no blur, no uneven pixel rows (the block-test screenshots), crowd
  layouts with 3 tier-H and mixed formations (no overlap, integer scales), lunges below the message window;
- chaos: dominates the enemy side, never under the message window, attacks in place, the heavy raise and the cast
  read; the bestiary shows it whole;
- the bestiary centring for every changed sheet plus a sample of 10 unchanged ones;
- a regression sample: goblin, wolf, cockatrice, green_slime, cobra, ogre, troll, ashen_queen, lich, garland, astos,
  warmech, death_eye, drowned_sovereign (each in battle and bestiary);
- effects on the big boxes (rev 12): one spell of each kind (single, all, heal), damage numbers and status icons on
  chaos and on one tier-H sheet in a 3-huge formation: every effect, number and icon on screen and below the message
  window;
- performance: `anim_crowd` median FPS >= 110 (G7 measured 120.5) and a 3-tier-H crowd.

Rows go to `docs/ROSTER_PLAYTEST.md` "Pass V test" (probe id, severity P0/P1/P2, screenshot). Done = no P0/P1 open and
every P2 fixed or on a decided nit list. **Fix round (V8):** a fix plan with binary gates (fix plan 2 style), momus,
fixes; images only from the pass-V remainder (>= 5 by the 45 halt; >= 8 if the worst case of 42 holds), only for the 7 ids, <= 3 pass-V attempts per sheet in total. The
three open G7 P2s (astos hurt switch, warmech hurt key, crawler attack tail cut, `ROSTER_PLAYTEST.md` "Re-test (G7)")
are **out of scope** (D-V16).

---

## 13. Documentation updates

- `AGENTS.md`: the monsters_ai row (10 pages under C1; per-sheet `scale`; the titan band), "Monster animation" (pass V
  rigs, FX allowlist changes), size classes (`huge`, `titan`, integer screen scale), the retired-sprites rule and
  `retire.py`, the pass-V budget line.
- `docs/NEW_MONSTER_GUIDE.md`: band table (titan 300 / 292), "retire before regenerate" step in 1.4, the display scale
  rule (only integer screen scales; `monster_scale.yaml`), the pass-V prompt lessons (four-wing / two-arm counts, the
  separate-pieces rule for disconnected designs, otherworldly colour choices without violet).
- `assets-src/gen/README.md`: `retire.py`, `monster_scale.yaml`, FW-T.
- `docs/RETIRED_SPRITES.md` (new, section 5); `docs/ROSTER_LOG.md` "Pass V" (images, archive commits, integration
  notes, measured page sizes); `docs/ROSTER_PLAYTEST.md` "Pass V test".

---

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The 3 px vs 2 px pixel-density step of S1 is disliked | the rescaled monsters look "chunkier" than the party | the rescale review records it; D-V1 lets the user choose S3 (same look, more memory) or a smaller tier-H set before the rest of the pass |
| A layout pass produces a non-integer screen scale | stair-steps on a shrunk crowd | the integer-scale property test over real and random formations |
| Three tier-H sheets plus small enemies in one fight do not fit | half-size art | capacity 1 per column, the 2/3 pass for scale-3 boxes, the `formationFits` data test over every sandbox formation |
| fire_gigas / ice_gigas as tall as the lich | a regular giant reads like a fiend | flagged in D-V2; the orchestrator may exclude them |
| Counts drift in boss action poses (wings, arms) | 3 attempts used without an approvable pose | four wings and two arms (D-V9, D-V10), limbs named by image side, the `motion:` line; best-of-3 with recorded nits, else the archive fallback (5) |
| Separate floating plates of the seraph trip `detached` / pieces checks | rig check failures | pieces exist in the source key (allowed), >= 40 px each, same pieces in every key (review rule) |
| Titan band work (FW-T) is larger than estimated | chaos late | chaos is generated last; C2 is the fallback (no framework work) |
| Gemini renders too coarse for the titan band (momus: no cached boss render above 255 native; the cutter would upscale x1.4 non-integer) | stair-steps on the final boss, or wasted images | FW-T fail-closed (scale 1.0, grid mode), G-T0 offline measurement and the D-V6 re-confirm before any image, at most 2 C1 idle attempts, the 3rd for C2 |
| The main checkout breaks between an approval and its integration (old rig on new pixels, mixed boss poses) | selftest red on `roster`, blocked generator | `--move-rig` and `--prune` in the approval commit (rev 2), the 9.4 allowed-failure table |
| The cutter drops a floating seraph plate or chaos orb outside the figure box | a part silently missing from the approved key | design keeps pieces inside/touching the main mass; per-pose render-vs-cut piece comparison (rev 13) |
| Effects anchored above a tall box leave the screen | spells or numbers drawn under the message window | the effect-anchor unit test and clamp, the play-test probe (rev 12) |
| Old and new boss poses mixed in a build | identity break in battle | integrate a redesigned id only when complete (9.1 step 6), `--prune` with the archive gate, `--move-rig` in the same commit |
| A replaced sprite is lost | the user cannot reuse it | FW-RT archive before the first paid request, the approve gate, `selftest_retire.py`, the index |
| A retired copy leaks into the build | a phantom sheet or a failed gate | one-level globs + `selftest_retire.py` exclusion proof |
| The budget guard's top-level rules refuse pass V | no images | FW-V0 resets the top level with `history`; `selftest_passv.py` proves the fresh counts |
| Safety refusals on "terrifying" designs | failed calls count | no "fierce / teeth / bloody", effects on the body, the fish lessons; a refusal row is logged and the wording fixed before the retry |
| Bright violet in "otherworldly" palettes is keyed out | lost features (nightmare R222) | every prompt names key-safe colours and negates violet / purple / pink / magenta |
| The watchdog kills a long-running agent | lost work | section 10 brief rules |

---

## 15. Decisions (orchestrator, decided 2026-11-16)

| # | Decision | Ruling |
|---|---|---|
| D-V1 | Rescale method | **S1 accepted**: per-sheet integer display scale 3 (3x pixels accepted); S3 stays the fallback; S2 / S4 rejected |
| D-V2 | The tier-H set | **accepted as listed**: the 17 user-named sheets + bigeyes small -> large; "all dragons" = red (`dragon`), white, blue, green, dragon_zombie; fire_gigas / ice_gigas included |
| D-V3 | Sibling additions | **accepted**: white_shark, minotaur_zombie, fire_hydra, deepeyes, evil_eye (23 rescaled sheets in total) |
| D-V4 | Optional additions (wyrm, wyvern, tyrannosaur, purple_worm, golems) | no (default) |
| D-V5 | Data classes `huge` and `titan`, labels "Huge" / "Titan" | yes (default) |
| D-V6 | Chaos cell | **C1, the titan 300 px cell**, subject to the G-T0 re-confirm (4.2); at most 2 C1 `boss_idle` attempts, the 3rd reserved for the C2 fallback (rev 1(c) ruling) |
| D-V7 | Chaos attacks in place | yes (default) |
| D-V8 | Bestiary backdrop centred on the panel | yes (default) |
| D-V9 | Hollow seraph | **four blade wings, no raise pose** (`only_sheets` refuses `boss_attack_raise`; rig `raise: false`) |
| D-V10 | Chaos arms | **two** |
| D-V11 | Piscodemon | **stats unchanged, art only** |
| D-V12 | Descriptions and the two fiend lore pages rewritten (ASCII), reviewed in V6 | yes (default) |
| D-V13 | One `pass V` entry (50, `only_ids`, `only_sheets`, 3 per sheet); build halts at 45 | yes (default) |
| D-V14 | A wider vampire cell may move later page-0 cells | accept (default) |
| D-V15 | Retired ids `<id>_v1` under `approved/_retired/`, `anim/monsters/_retired/`, `retired/` | yes (default) |
| D-V16 | The three open G7 P2s | **stay out of this pass** |
| D-V17 | Families unchanged | unchanged (default) |
| D-V18 | New fx parts only on request with orchestrator approval | request-based (default) |
| Rev 8 ruling | Revival | `retire.py --revive <id>_vN --as <new_id>`, fixture-tested in `selftest_retire.py` |
| Rev 9 ruling | Bestiary centring box | FW-A2 `idleBox [l, t, r, b]` from the idle frame |
| Rev 15 ruling | Long commands | background command writing `EXIT=$?` to a log; Monitor `until grep -q EXIT=` with timeout <= 240 s, re-armed; never two `monsters_ai` builds in one worktree; no self-matching `pgrep` |

**Still open (re-confirm points):** D-V6 after G-T0 (the orchestrator re-confirms C1 with the measured numbers, or
switches chaos to C2 before its first image).

---

## 16. TODOs

```markdown
## TODOs
- [x] V0: momus review (APPROVE WITH REVISIONS); 17 revisions applied (rev 2); D-V1..D-V18 and the rev 1(c)/8/9/15 rulings recorded (2026-11-16)
- [x] V1 FW-V0: budget.json pass V (literal N_V0, append-only history, pass R fix closed, only_ids, only_sheets, consistency guard); selftest_passv.py pins; selftest_roster.py rewrite (fix slice ends at gemini_end); selftest_daze.py:130 narrowed (high, 2.5h)
- [x] V1 FW-RT: retire.py (+ --prune, --move-rig, --revive), approve.py gate (monster_/boss_ only, byte-identical rewrite ok, _v2 / _v2_partial), selftest_retire.py (exclusion proof, static rglob check, revive fixture, git-tracked cache files) (high, 4h)
- [x] V1 pinned selftests (9.5): _fields, run_halo_brighten, FX_PENDING, selftest_pages ANCHORS / raise tip / seraph padding, selftest_fixmeasure black_knight, all on archive-or-live fixtures (high, 2h)
- [x] V1: re-measure npx vitest run; record durations and N_V0 in ROSTER_LOG 'Pass V' (low, 0.5h)
- [x] V1 FW-S: monster_scale.yaml -> atlas sheet `scale`; selftest_pages byte-identity (high, 1.5h)
- [x] V1 FW-A2: atlas idleBox anchor (medium, 0.5h)
- [x] V1 FW-T: titan band 300/292 fail-closed (scale 1.0, grid mode), guide, approve, anim padding, caps at 300, size-keyed `titan` page group, --titan-probe; selftest_titan.py RED cases (high, 1d)
- [ ] V-gen: FW-V0 + FW-RT merged, selftests ALL PASSED; main checkout fast-forwards roster (high, 0.5h)
- [ ] V1 exit check -> V-base (rigs/sheets unchanged, pages byte-identical, check --all 123 OK, selftests) (high, 1h)
- [ ] V2 TS-1: bestiary centring + backdrop; bestiaryCentre.test RED -> GREEN; browser check (high, 3h)
- [ ] V2 TS-2: per-sheet scale, lunge scaling once in getMonsterFrames, huge/titan classes, integer-scale passes + pass-4 refusal, layout_f1 byte-identity, TITAN_AREA, titan in place, bossTag titan, effect-anchor test; tests (high, 1d)
- [ ] V3 archive: retire.py for the 7 ids; docs/RETIRED_SPRITES.md rows; commit before each first paid request (high, 1h)
- [ ] V3 generate crazy_horse, piscodemon, black_knight, guardian, vampire (<= 3 each), log rows, approvals (high, 0.5d)
- [ ] V3 generate hollow_seraph idle -> attack -> cast -> hurt (<= 3 each); --prune old poses with the new idle; piece comparison per pose (high, 0.5d)
- [x] V3 G-T0: offline titan cut over the ~80 cached boss renders; numbers to the orchestrator (0 of 80, section 17); D-V6 re-confirm pending (orchestrator) (high, 1h)
- [ ] V3 generate chaos idle (<= 2 at the titan band, 3rd reserved for C2) -> attack -> cast -> hurt -> raise (<= 3 each); piece comparison per pose (high, 0.5d)
- [x] V4 rescale: monster_scale.yaml 23 entries + TS-3 sizes in one commit; rebuild; block test; image-only rescale review (high, 0.5d; ROSTER_LOG 'Pass V' V4: 22 SHIP / SHIP WITH NITS, dragon ITERATE escalated)
- [ ] V5 wave 1 rigs: crazy_horse, piscodemon, black_knight, guardian (<= 4 iter each) (medium, 2d)
- [ ] V5 wave 2 rigs: vampire, hollow_seraph (cast), chaos (titan, cast + raise) (high, 2d)
- [ ] TS-3 / TS-4: descriptions, lore, size labels, scenarios, formationFits data test (medium, 4h)
- [ ] V6: final integration, section 11 validation, frame-rect diff == the 7 ids, docs (13) (high, 4h)
- [ ] V7: fresh adversarial play test; "Pass V test" rows (high, 4h)
- [ ] V8: fix round if needed (plan, momus, fixes, re-test) (medium, 1-2d)
```

---

## 17. Momus revisions (rev 2)

Momus verdict on rev 1: **APPROVE WITH REVISIONS**, 17 binding revisions (3 critical). All applied in place; the
orchestrator's rulings on the open choices are in section 15.

| # | Revision | How it was applied |
|---|---|---|
| 1 [CRIT] | C1 titan height unreachable through today's cutter (guide box capped at 914 guide px, `monster.py:214`; cached idles at 5.12 px pitch, about 200 native; max native over 80 boss renders 255; fine-pitch renders averaged to about 192; `monster.py:470` non-integer nearest upscale = S4) | 4.2: the measured limits written out; (a) FW-T **fail-closed** (titan cut with `info["scale"] != 1.0` or mode != `grid` raises, counted as rejected) with `selftest_titan.py` RED cases (pitch 5.12 refused, pitch 3.3 / 270 native accepted); (b) **G-T0** zero-cost offline probe over the cached boss renders before chaos's first request, the orchestrator re-confirms D-V6; (c) ruling: at most 2 C1 `boss_idle` attempts, the 3rd reserved for C2 (4.2, 6, 15, 16, success criteria); (d) feet row 292, top >= 15 -> **258-278 art px** (was 260-285); bestiary clamp recomputed (feet 776 -> 770 for h = 278) |
| 2 [CRIT] | The main checkout breaks between approval and integration (`selftest_anim.py:106-127` builds the atlas; old rig on new pixels; `pad_keyframes` mixes poses) | 5 FW-RT step 1 and 9.1 step 5: the **generator** runs `retire.py --move-rig <id>` in the commit approving the id's first new sheet, and for a boss `--prune` of the old `boss_*` poses in the commit approving the new `boss_idle` (the sheet is then "boss poses incomplete, skipped", `monster_anim.py:55-57`); 9.2 gives the generator these rights; the integrator's `--move-rig` removed |
| 3 [CRIT] | List every test pinned to the 7 ids, with owner, landing commit, treatment | new 9.5 table: `selftest_roster.py:274-294` `_fields`, `selftest_efix.py:249-284` (archive fixture), `selftest_efix.py:21` FX_PENDING in V1, `selftest_pages.py:153`, `:241-244`, `:277-285`, `selftest_fixmeasure.py:150-154`, `selftest_fw5.py:22`, and the TS tests (heavyGlint, lungeClearance, enemyTravel, assetCoverage, rosterData, rosterStats, bestiaryHabitats, `layout_f1.json`); FW-FX row updated |
| 4 | Allowed-failure table per redesigned-id state | new 9.4: states A archived, B text declared, C first sheet approved, D integrated without rig, E locked, with the exact allowed lines; anything else stops work; success criteria line added |
| 5 | Budget guard robustness | 6: literal `attempts_before` (367 at writing, re-counted literal at V1); consistency guard (attempts_before > ledger length, or R-fix end / V start / attempts_before unequal -> refuse); the guard never reads `history`; `history` append-only vs a pinned prefix; `selftest_passv.py` pins (100, 300), (363, 37), N_V0 and asserts budget.json equals them; new `only_sheets` refusing `hollow_seraph/boss_attack_raise` (RED test); the `selftest_roster.py` fix slice ends at `fix["gemini_end"]` (`:143`); 11.1 ledger script checks `only_sheets` |
| 6 | Approve gate scope and cases | 5 FW-RT step 2: only `monster_*` / `boss_*`; byte-identical rewrite allowed; overwriting a pass-V-approved sheet needs `retire.py --as <id>_v2`; the boss fallback archives the new poses as `<id>_v2_partial`; each case in `selftest_retire.py` |
| 7 | Fallback restore | 5 fallback: `monsters.yaml` restored from `retired/monsters_v1.yaml`, the new text moved to `retired/pending_<id>.yaml`; chaos fallback keeps `size: boss` and creates no `titan` page group |
| 8 | Revival and exclusion | ruling applied: `retire.py --revive <id>_vN --as <new_id>` (rewrites `character`, adds `revived_from`, `_approved_keys` checks it against the committed cache file) with a fixture selftest; the exclusion list adds `selftest_anim.py:96`, `selftest.py:241`, `selftest_fw5.py:100`, `selftest_keyoffset.py:126`, `puppet.py:526`; a static check refuses `rglob` / `**` over the approved and rig dirs; archived cache files must be git-tracked (`git ls-files`) |
| 9 | Bestiary box and lunge | ruling applied: FW-A2 is `idleBox [l, t, r, b]` from the idle frame (replaces `homeY` everywhere); the per-sheet factor is applied to `lungePx` once in `BattleArt.getMonsterFrames`, read by `AiEnemyView.ts:93`, `:121` and `BestiaryPreview.ts:153`; spy unit test |
| 10 | Block test | 2.7: only art pixels whose whole 3x3 footprint is opaque, compared with the expected atlas colour; integer sprite x, y asserted in step mode |
| 11 | Layout | 2.5 / 2.6: `layout_f1.json` stays byte-identical for formations without a scale-3 sheet (test); pass 4 with a scale-3 sheet (5+ tier-H) -> `formationFits` refuses; `bossTag` pinned for chaos via `bossPhases` and a `size === 'titan'` rule (`bestiaryModel.ts:39`) |
| 12 | Effects on big boxes | 2.5: the effect-anchor unit test (centre / head / feet and emitter starts such as `fx/emitters.ts:65` within y 124..1080, clamp); 12: spell, damage-number and status-icon probes on chaos and one tier-H sheet; TS-2 row |
| 13 | Detached pieces | 4.1: `_figure_mask` (`monster.py:316-345`) drops blobs outside the main bbox (+15 %); seraph prompt: "each wing's brass frame joined to a shoulder plate", narrow gaps, compact; chaos prompt: the orbs touch the flame crown; acceptance: render-vs-cut piece comparison per pose, a missing planned piece = reject (4.2 acceptance, risks) |
| 14 | Branches | 10 "Branch order": V-gen (FW-V0 + FW-RT merged, selftests ALL PASSED) fast-forwarded to `roster` before V3; later `roster-int` -> `roster` updates are merges between checkpoints; V-base reaches `roster` before chaos; no merge of `roster` into `roster-int` before V-base; 9.1 step 6 |
| 15 | Watchdog | ruling applied in 10: background command writing `EXIT=$?` to a log, Monitor `until grep -q EXIT=` with timeout <= 240 s, re-armed with a progress line; never two `monsters_ai` builds in one worktree; no self-matching `pgrep`; vitest re-measured at V1; durations assumed to grow (2x) with 4 agents |
| 16 | Atlas pages | 2.5: new cells for crazy_horse (A), black_knight, guardian (D), piscodemon, hollow_seraph (bosses), vampire (page 0) shift later cells and may spill; every page-count assertion uses the measured count; gates kept (<= 2048, act-1 sheets on page 0); 4.2 and the MonsterPages test row no longer pin 10 |
| 17 | Record titan numbers and the chaos clamp shift | the table below; the measured row is filled at G-T0 and by the `bestiaryCentre` test after the chaos integration |

**Titan numbers (rev 17).**

| Quantity | Planned (this plan) | Measured (filled at G-T0 / integration) |
|---|---|---|
| Titan cell, feet row, top-row floor | 300x300, 292, 15 | 300x300, 292, 15 (FW-T, `spec.TITAN_POSE_GEOM`, `TITAN_TOP_MIN`) |
| Chaos idle height range at scale 2 (C1) | 258-278 art px (516-556 screen px) | G-T0: not reached by any cached render (max cut figure 215 native) |
| Cached boss renders reaching >= 258 native at scale 1.0, grid mode | 0 of about 80 expected (momus: max 255) | **0 of 80** (every ledger boss render in the main-checkout cache; `out/gemini` held only duplicates). 75 grid mode, 5 no grid; 0 accepted by the fail-closed titan cut. Native figure height (the cut's mask) max 215 (hollow_seraph boss_cast, pitch 4.26), then 205, 202, 197, 193; chaos 165-181 (idle 173), lich 149-188 (idle 183), all chaos / lich at pitch 5.12. Pitches: 5.12 x63, 4.26 x6, 4.0 x3, 5.7-5.8 x4, 4.7, 3.42, 3.2, 3.04; the 3 renders finer than 3.5 px had no detectable grid (conf 0.10-0.39) |
| Titan guide box | <= 914 guide px today (`monster.py:214`) | 914 guide px (capped; 278 x 5.33 = 1482 asked); = 178.5 art px at pitch 5.12, 214.6 at 4.26, 228.5 at 4.0, 267-301 at 3.0-3.4. Figures fill about 97 % of the box (chaos idle 173 of 178.5), so at the common pitch 5.12 a 258 figure needs a 1321 px box, larger than the 1024 guide |
| Chaos box on screen, cell top with feet at 745 | 600x600, y 159 | |
| Chaos bestiary plain-clamp shift | -6 px for h = 278 (0 for h <= 272); C2 about -2 px | |
| Atlas page count after pass V | 10 planned under C1 | |

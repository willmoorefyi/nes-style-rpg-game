# Enemy feedback plan (pass EF) — rev 3 (Momus: rev-1 24 findings, rev-2 13 findings addressed)

The user's full enemy pass (2026-11-24). Two parts: changes **without any AI image call** (EF-A to EF-E) and five
**Bedrock regenerations** (EF-F). Review artefacts go in `~/temp/ff-game/ef/<workstream>/`.

## 0. Ground rules

- **No AI image call in EF-A to EF-E** (no Gemini, no Bedrock, no upscale or inpaint model). Only code, numpy / Pillow
  image processing and the existing cached raw renders. If a request cannot be met that way, it is reported, not
  worked around with a model.
- **Style lock kept:** files under `assets-src/gen/approved/` are not edited in place, except where a workstream below
  says so explicitly; such an edit first archives the old file (`retire.py`, `docs/RETIRED_SPRITES.md` row).
- **Locks:** every frame whose bytes change is re-reviewed (independent image-only reviewer, `NEW_MONSTER_GUIDE.md`
  3.4) and re-locked. Post-processing at the atlas stage (EF-A) runs **after** generation, checks and locks, so it
  changes no lock.
- **Measured facts this plan rests on** (2026-11-24): the 47 named sprites are all their own atlas sheets (no palette
  variants); the cached raws (`cache/<key>.png`, 1584x672) of fire_lizard, blue_dragon, green_dragon are themselves
  coarse pixel art (and on the approved fire_lizard sheet 46-61 % of opaque 2x2 blocks are uniform depending on grid
  phase, no single half-res grid), so no hidden detail can be re-cut from them; `cv2` is not installed (numpy, scipy, Pillow are).
- **Rulings this plan overrides, by the user's 2026-11-24 request:** D-V1 S1 (integer display scales only,
  `monster_atlas.py:45` `DISPLAY_SCALES`), the KT3 "no key fixes" kneel ruling (shark daze only), and the orchestrator's
  sibling-size rule only where B1 says so. Each is cited in the code comment that changes.
- **"Spin" is read as the orbs orbiting the head** (they sit round it). If the user meant spinning in place, EF-D/E
  switch to a per-orb surface rotation; this is stated in the hand-off.
- **Gates for every workstream:** `npm run build`, `npm run test:fast`, the touched tests,
  `python3 -I assets-src/gen/selftest.py --anim` (worktree) / full selftest (main checkout, integrator),
  `python3 -I assets-src/gen/monster_anim.py check --all` (only `OK` lines), `build_assets.py monsters_ai` determinism
  under PYTHONHASHSEED 0 / 1. The atlas binaries are committed only by the integrator (`NEW_MONSTER_GUIDE.md` 0).

## EF-A. Hi-res monster textures and fractional display scales (engine + pipeline)

**Goal.** A sheet can be shown at a non-integer size (new intermediate tiers) and/or drawn from a smoothed,
higher-resolution texture, without touching approved PNGs, rigs or locks.

**A1. Data.** `assets-src/gen/monster_scale.yaml` keeps `{sprite: 3}` and also accepts
`{sprite: {scale: S, tex: T, smooth: [despur] }}`:
- `scale` S in {2, 2.5, 3}: screen px per **native** art px (effective size).
- `tex` T in {2, 2.5, 3} with **T = S** (the texture is drawn 1:1 at full size), or **T = 1** with an integer S (a
  `smooth`-only entry at today's texture, drawn with nearest as now); anything else fails the build naming the sprite. `load_scale` returns `{sprite: {scale, tex, smooth}}` (typed), integers still allowed.
- `smooth`: optional native-resolution clean-ups applied before the upscale (A3). Default none.
- A plain integer entry keeps today's meaning exactly (byte-identical atlas for those sheets).

**A2. Upscaler** (`assets-src/gen/monster_hires.py`, new, < 250 lines, pure numpy):
- Scale2x (EPX) on exact RGBA equality, applied until >= 8x, then nearest down-sampling to `round(w*T) x
  round(h*T)` (the RotSprite scaling step). No new colour is ever created (palette lock holds), alpha stays binary,
  colours stay on the 15-bit grid.
- Feet invariant: the lowest opaque texture row of every frame is `ceil((footRow+1)*T) - 1`; a test asserts it.
- Deterministic (no hash-order dependence).

**A3. `smooth: [despur]`** (same module): on each native frame, up to 2 rounds of: drop an opaque px with <= 1 opaque
4-neighbour that is not on the foot row; fill a transparent px with >= 3 opaque 4-neighbours with the sheet's outline
colour (the darkest colour of the idle key's 1-px edge ring). Report per sheet the px dropped / filled; refuse
(build error) if a frame's opaque area changes by more than 3 %. The post-processed **native** frames then run the
existing per-frame checks (binary alpha, palette, pieces/detached px, outline second ring, feet row, clipping:
`monster_check`'s frame-level functions); any failure fails the build naming sprite, frame and check.

**A4. Atlas** (`monster_atlas.py`): after frames are generated and checked, each sheet with a table entry is
post-processed (A3 then A2), packed on pages at texture resolution, and written with per-sheet `scale` (S, may be
2.5) and `texScale` (T). Every anchor (`footRow`, `idleBox`, `head`, `tip`, `travelTop`, `lungeRight`, `homeX`,
`opaqueRight`, `kneelSink`) stays in **native** art px; `lungePx` keeps its meaning (screen px at the atlas scale,
re-scaled by `s / meta.scale` in `BattleArt.ts:191`). The cell is padded on the right/bottom so `cell*T`
is integral; frame positions are chosen so `x*T`, `y*T` are integral (a test checks every rect). Hi-res sheets stay in
their page group (`monster_pages.py`); a group's hi-res sheets pack onto their own pages within it (each <= 2048x2048),
and the act-1 group's extra pages are added to `preload` (D-K13 holds: every act-1 sheet stays preloaded). Every hi-res frame rect has a 1-px transparent gutter on all sides (packer spacing; a test asserts the outer ring of
every hi-res rect on its page is transparent), so bilinear sampling never reads a neighbour frame. A page
whose sheets are all hi-res gets `filter: linear` in the index (drawn 1:1 at whole px it is byte-exact; under a shrink
pass it down-samples smoothly instead of dropping px). **Budget gate** (build report and a data test): extra pages
<= 14 and GPU bytes of (the pinned preload pages, act-1 hi-res pages included) + (the largest real formation's
pages, from the encounter tables) <= 8 pages x 16 MB; over it,
the B2 scale-3 sheets fall back first to `smooth: [despur]` only at T = 1 (today's texture, allowed by A1).

**A5. Runtime.**
- `BattleArt`: `ts = entry.texScale ?? meta.texScale ?? meta.scale`; `artScale = s / ts`; `measureIdle` gets `ts`;
  `MonsterPages` applies a page's `filter` (today `MonsterPages.ts:128` hard-sets `scaleMode = 'nearest'` for every
  page: that line becomes per-page). Hi-res sprites are positioned on whole screen px (rounded once).
  Every other reader resolves the same way: `BestiaryPreview`, `bestiaryFit`, `bestiaryBackdrop`, `bestiaryAnim`,
  `tests/helpers/atlasFrames.ts:45`, and the Python readers `monster_roster_report.py --atlas`, `kneel_tools.py
  pages|party_diff`, the `NEW_MONSTER_GUIDE.md` 3.7 rect script (grep `texScale`, `artScale`, `.scale`, `frames`
  over `src/`, `tests/`, `assets-src/gen/`).
- `EnemyLayoutAi`: `scale` may be 2.5. New layout class **`medium`** (capacity 2 per column, ORDER titan, boss, huge,
  large, medium, small) for a data-`small` sheet at 2 < scale < 3; a data-`large` sheet at 2 < scale < 3 lays out as
  `huge` (capacity 1). Scale-3 sheets keep today's classes (bigeyes stays `large`, capacity 2). Pass 3 shrinks every
  sheet with scale > 2 to screen scale 2 **and lays it out in its data class** (so pass 3 is exactly today's pass 3 for
  every formation); sheets at 2 < S < 3 may also take pass 4 as scale-2 sheets do today (drawn at screen 1; linear pages get mipmaps so the 0.4 ratio does not skip texels), so no formation that fits today can stop fitting; `formationFits`'s refusal of pass 4 stays
  for scale-3 sheets only.
  `layoutSizeOf` keeps the boss/titan rule for scale-3 bosses. `medium` is added everywhere `EnemySizeClass` is keyed:
  `TRAVEL_HOP` (`enemyReach.ts:20`, small's value), `PLACEHOLDER` (`formationCheck.ts:17`), `layoutSizeOfArt`
  (`monsterAnchors.ts:64`), and any `Record<EnemySizeClass, …>` tsc finds.
- Acceptance: the existing formation data tests pass unchanged; a new test reports, per B1 sheet, the pass each of
  its real formations takes and the count reaching pass 4 (for the hand-off).

**A6. Pins to update (each with the ruling cited):** `monster_atlas.py:45` `DISPLAY_SCALES` and its comment;
`selftest_pages.py:103` (the table = exactly the 25 scale-3 sheets: becomes "the integer entries are the 25, the
dict entries are the EF lists"); `tests/data/rosterData.test.ts:65-72` ("every other at 2": the EF entries excepted
by list); `tests/rendering/sheetScale.test.ts` (allow 2.5 with T = S). **A7. Tests.** Unit: upscaler (palette, binary alpha, feet row, determinism, Scale2x on a known 3x3 case), despur
(fixed fixture), table validation (bad S/T), atlas rect integrality, BattleArt per-sheet `texScale`, layout
(`medium` capacity, a 2.5 large as huge, pass 3 on 2.5, a mixed formation), a 1-sheet atlas round trip.

**A8. Acceptance.** Every sheet not in the table is byte-identical by frame rect (`NEW_MONSTER_GUIDE.md` 3.7 script);
browser: `?mute=1&scenario=anim_bipeds` and a new `ef_sizes` scenario (one formation per new tier) at
`&enemyAnim=loop` show crisp, correctly placed sprites (feet on the plain, lunge reaches the party, numbers on the
head); screenshots to `~/temp/ff-game/ef/sizes/`.

## EF-B. Size, smoothing and low-res entries (data on EF-A)

**B1. Bigger** (32: the user's 26 plus six greater siblings): data-`small` sheets at **2.5** (tier `medium`): gr_imp (Goblin Guard), werewolf, ghast, shadow,
gargoyle, bloodbones, piscodemon, mummy, horned_devil, mindflayer, weretiger, king_mummy, medusa, rakshasa,
sahagin_prince, black_knight, earth_medusa, gr_wolf (Warg Wolf); data-`large` sheets at **2.5**: ogre_chief, troll,
sphinx, manticore, clay_golem, tyrannosaur, rhyos, iron_golem. All with `tex: 2.5`, `smooth: [despur]` only where B2 lists them.
Sibling rule (`NEW_MONSTER_GUIDE.md` 1.4: no lesser sibling outgrows its greater one): the greater siblings of B1
sheets that would otherwise be outgrown also go to 2.5 (order from enemies.yaml HP / bestiary number):
death_knight (> black_knight), stone_golem (clay 176 < stone 200 < iron 304 HP), chimera (> manticore), sea_troll
(> troll), winter_wolf (92 HP > gr_wolf 72), ogre_mage (144 > ogre_chief 132): 32 sheets in B1 in all (the A6 lists
and the `rosterData.test.ts` exceptions use this list);
pairs already inside B1 (mummy / king_mummy, medusa / earth_medusa) stay equal. A data test pins every pair; screen
heights reported. These six additions are flagged to the user as beyond the list.

**B2. Smoothing** (15; reviewed after EF-C2 merges for the shark): `smooth: [despur]` and a Scale2x texture at the sheet's current size: black_widow, gr_wolf,
ogre_chief, tarantula, shark, ghast, shadow, anaconda, hyenadon, crocodile, hydra, fire_hydra, lava_worm, hellhound,
white_dragon. Scale-2 sheets get `tex: 2`, scale-3 sheets `tex: 3`; sheets also in B1 take B1's scale with `tex: 2.5`.

**B3. "Low-res" trio.** blue_dragon, green_dragon: `tex: 3` at scale 3 (smoothed edges, same size). fire_lizard:
`tex: 2` with `smooth: [despur]` on the native frames (the block-mode reduction is dropped: only 46-61 % of blocks
are uniform, it would discard detail); a before/after sheet at screen size. **Honest limit, reported to the user:** neither adds detail the raw never had;
real extra detail needs a new render.

**B4. Review.** One before/after contact sheet per sprite at screen size on the grassland background
(`~/temp/ff-game/ef/smooth/`), plus the independent image-only review (criteria: same creature, cleaner outline, no
lost features (eyes, teeth, fangs, claws), no new specks or holes, feet on the line). ITERATE on a sheet: tune
`smooth` for it or drop it, max 2 rounds.

**int-ef2 (user rulings 2026-11-24).** (1) blue_dragon and green_dragon take `tex: 3` with despur after all (the
other four fallback sheets unchanged); B4 round 1 (image review) ITERATE: full Scale2x rounded the horn / crest points
and blotched the dithered scales, so round 2 adds `smooth: [despur, edges]` (Scale2x on the silhouette only); the page cap rises to 17 extra (29 pages, 19 hi-res; GPU preload + largest real
formation 74.8 MB of 128, clay_golem + king_mummy). (2) "Grow the tougher enemies": A1's S may be any multiple of 0.05
in [2, 3.5] (T = S); stone_golem 2.8 (idle 105 art px -> 294 screen px), iron_golem 3.3 (90 -> 297), sea_troll 2.7
(106 -> 286.2), each the smallest step at least as tall as its lesser sibling (clay_golem 292.5, troll 282.5; iron also
>= stone). The packer aligns each sheet's y to its own unit (a group's lcm would be 20790 px); iron_golem's 423-px cells
fit only 16 a page, so its entry has `crop: true` (cell cut to the frames' union box + 1 px, 128x128 -> 100x97, anchors
measured on the cut frames). Layout: a tier scale is any scale over 2 but the V4 integer 3 (`isTierScale`), so a 3.3
large lays out as `huge` and may take pass 4; whole-px feet never round a box's top out of the area; the travel
clearance bound is rounded up to whole px. Every real formation still fits at pass 1.

## EF-C. Ogre club and shark daze

**C1. Ogre idle club.** The idle club ends in a straight edge at x 106 (rows 86-107; columns 107-127 empty): it was
cut at the raw's 528 px cell line, and the raw (`cache/5c00115db9f09bd1af0f7038.png`) holds the whole tip. Fix with
the style lock kept: no PNG edit, no cell change. The approved json records no pixelizer settings, so first
**register**: re-cut the raw's idle region offline with `monster.py`'s cutter (grid [128,128], bottom_row 122) and
the approved palette, and accept the re-cut only if it reproduces columns 0-106 of the approved idle cell exactly, or
at one measured whole-px offset (applied to the tip); else report and stop. Take only the tip px right of x 106, and add them as FW-P keyframe `paint` on `idle`
in `anim/monsters/ogre.yaml` (<= 160 px, else a `kf_paint_cap` allowlist entry `ogre/idle` with the measured count),
outline closed. Extend the `club` mask (`idle` polygon, today ending at x 108) over the tip and move the `tip`/club
joints if the end moves, so every idle-sourced in-between carries the tip. Then `check ogre`, review, lock.
Acceptance: tip whole and outlined in idle and every idle-sourced frame; `fixmeasure.py diff` shows changes only in
the tip area.

**C2. Shark daze background.** The approved kneel key (`approved/shark/kneel.png`, the "dazed" pose) holds a grey
slab below the tail (about 800 px of (107, 123, 140)). Kneel paint already exists (`kneel.paint`, `kneel.py:66`
`AI_KEYS` -> `monster_keys.kneel_paint`, line 191) but is capped at 160 because `kneel_paint` passes no
`kf_paint_cap`. `kneel_paint` relabels patches as `frame: "idle"` (`monster_keys.py:197`) and `paint_keys` looks the cap up by
that frame (`:153`), so add a separate kneel cap path: `kneel_paint` takes the rig's `kf_paint_cap.kneel` and checks
it against a new `KNEEL_PAINT_ALLOW` `{"shark": <measured count>}` (not `KF_PAINT_ALLOW`); a selftest pins that the
shark's idle cap stays 160 and that another sprite's kneel cap stays 160; then `kneel.paint` with `rgb: null` over the slab and outline ink where it
touched the shark. Selftest first (RED). Overrides KT3's "no key fixes" for this key only (user request). Acceptance: no slab px in `kneel`, `kneel_in2`, `kneel_b`; outline
closed; `check shark` OK; review; lock.

## EF-D. Chaos idle orbs (atlas sheet `chaos`, scale 3)

The four element orbs above Chaos's head (white, pale blue, dark blue-teal, orange in `boss_idle`) orbit the head in
the idle animation.
- **Pipeline:** a rig option `orbit` (`gen/anim/monsters/chaos.yaml`): `parts` (the 4 orb masks in the idle key),
  `centre`, `rx`, `ry`, `steps` N (8-16), `behind` (the parts an orb passes behind on the far half: head, flame
  hair). The renderer cuts the orbs out of `idle` and `idle_b` (they sit on transparent background; any px under an
  orb that belonged to the head/hair is restored from the hair mask or painted), then writes `idle_o<k>` and
  `idle_b_o<k>` for k in 0..N-1, each orb at angle `a0_i + 2*pi*k/N` on the ellipse, drawn behind `behind` when
  sin(angle) < 0. Orbs keep their own pixels (no scaling); positions on whole px. New frames pass the palette / alpha /
  piece / clipping checks; continuity checks between orbit frames are exempted only for the orb masks (documented).
- **Runtime:** `enemyChoreography.ts`: a sheet whose atlas entry has `idleOrbit: N` plays `idle_o<k>` / `idle_b_o<k>`
  in its idle (k advances every 6 frames, breath alternation unchanged); without it, unchanged. The step into an
  attack / cast / hurt / kneel sequence uses the baked key orbs (accepted pop, as the keys draw them there).
  `monsters-ai.json` gains `idleOrbit`; old atlases without it are unchanged.
- **Wiring:** the orbit frames join `MonsterFrame` / `MONSTER_FRAMES` (`enemyChoreography.ts:11-16`), the frames
  `BattleArt` slices (`BOSS_FRAMES`, `BattleArt.ts:178`), `monster_recipes` FRAMES / FALLBACK (fallback: `idle` /
  `idle_b`), `HOME_FRAMES` (`monster_atlas.py:41`), and `bestiaryAnim`. The ellipse is constrained inside the idle
  key's current opaque top (y >= 6) and the cell (clipping check), and a test asserts chaos's `travelTop` and layout
  class (titan) are unchanged. Chaos's lock is redone; the bosses group may spill to a new page (pages renumber; the
  atlas is rebuilt whole).
- **Tests:** choreography (frame pick by time, fallback), atlas keys, a pipeline selftest for `orbit`.
- **Acceptance:** `?mute=1&scenario=chaos_forms`: a full orbit visible in idle, orbs pass behind the head, no orb
  duplicated or lost, frame-exact against the page (`NEW_MONSTER_GUIDE.md` 3.5).

## EF-E. Chaos (Orrery) orbs (colossus `chaos_orrery`)

The Orrery's four orbs (white, cyan, orange, teal) ride two gold rings.
- **Feasibility first** (`chaos_orrery.yaml:8` already notes orb layers "would need the art behind them painted"):
  the white orb overlaps the shoulder and the teal one the chest armour. Offline fill, no model: ring segments redrawn
  along the fitted ellipse; armour by mirror-cloning the symmetric opposite side of the breastplate / pauldron
  (scipy-free numpy), seams feathered; background transparent. A before/after crop goes to the user's review folder;
  if the armour fill does not read as the armour (independent image reviewer), **stop and report** (fallback offered:
  orbs spin in place on their current spots, no hole).
- **Art (offline, `colossus_*` tools, no model):** cut each orb into its own layer (`orb_<colour>`, soft alpha kept,
  full-res painted art: no pixelize, memory `chaos-fullres-painted`), its halo cut out of `glow.png` into
  `orb_<colour>_glow` (additive) so it travels with the orb; the baked rings' far-half segments are split from `body`
  into a separate **`ring_back`** layer drawn below the far-half orbs (a mask alone cannot slot an orb between ring and
  armour). New layer kinds (`orb`, `orb_glow` additive, `ring_back`) are added to `LAYER_KINDS`
  (`colossusIndex.ts:16-17`), the blend-by-kind in `colossus_build.py:158`, the contract fixture
  (`tests/fixtures/colossus/contract.json`, `colossusContract.test.ts`) and the draw order: ring_back < far orbs <
  body < near orbs < glow. Fit each ring's ellipse (centre, axes, tilt) from its pixels; store in `gen/colossus/chaos_orrery.yaml`
  as `orbits: {orb_<c>: {ring, phase0, period_ms}}`. Archive first (`retire.py --colossus chaos_orrery`).
- **Runtime:** `ColossusPoseController` / `ColossusView` move each orb along its ellipse (one period 6-10 s, the two
  rings opposite directions), drawn in front of `body` on the near half and behind it on the far half; frozen during
  interludes that pose the form; memory cap (24 MB) still met.
- `preview.png` (bestiary) rebuilt by `build_assets.py colossus`; memory total re-measured.
- **Tests:** contract test for `orbits`; pose-controller unit test (position at t, z switch); `colossus.py check`.
- **Acceptance:** `?mute=1&scenario=chaos_interlude_1` then F2: orbs travel the rings, pass behind the armour, no
  hole where an orb used to be (screenshot at four phases).

## EF-F. Bedrock regenerations (crazy_horse, pirate, vampire, dark_wizard, vampire_lord)

**F0. Model and budget.** `aws bedrock list-foundation-models --by-output-modality IMAGE` and
`list-inference-profiles` (profile `bedrock`, read-only, 2026-11-24) in both regions list only Stability models: no
Nova Canvas or Titan image model is offered to this account (the output is saved to `docs/art/ef/bedrock_models.txt`).
Text-to-image generators: Stable Image Ultra v1.1, Core, SD 3.5 (us-west-2 only, **all three `LEGACY`**, still
invocable; the user is told the chosen model is itself legacy and may be retired), plus the
control / edit services in both regions. Primary: **Ultra** (us-west-2 = `bedrock.py`'s REGION, no code change).
Its image-to-image (`image` + `strength`) is confirmed by the first variation's call (counted); if refused, the route
is the F3 fallback. A new open pass `pass EF` in `budget.json`'s `bedrock` block: `cap` 145 total, `per_purpose_caps`
`ef_sheet` 50 (Ultra: 1 per variation, main route or the fallback's idle; 5 sprites x 5 x 2 at most),
`ef_structure` 75 (the fallback's 3 Control Structure poses per variation, 5 x 5 x 3), `ef_nobg` 20 (`remove_bg`, only
when the key cut fails), `reserve` 0. Per sprite at most 5 variations in all, whichever route. Main checkout only (the gate). **At most 5 variations per image per sprite**;
self-approval after the independent reviewer's SHIP; a sprite with no SHIP after 5 gets a debrief (what was tried, the
renders, why each failed) instead.

**F1. Reference images.** The user gave three Pixel Remaster sprite URLs: crazy horse, pirate and vampire (the
vampire's also for the vampire lord); dark wizard has none. Fetched into `~/temp/ff-game/ef/refs/` and used **only as
mood references for the written prompt** (not sent to a model, not copied): the designs stay original.

**F2. Design briefs** (written into `monsters.yaml` with each new entry):
- crazy_horse: a living, enraged war horse on a rampage (not undead): flared nostrils, wild eyes, bared teeth, wild
  mane, scarred hide, broken bridle; frightening, not skeletal.
- pirate: a menacing, realistic cutthroat: weathered scarred face, cruel grin, cutlass, tattered coat; not cartoon.
- vampire: menacing young noble predator, pale, feral eyes, fangs, high collar, dark cape; not cartoon.
- dark_wizard: a sinister dark sorcerer (from the old evil elf/orc hybrid: gaunt, grey-green skin, pointed ears),
  hooded tattered robes, glowing eyes, a bone or blackened staff, dark aura kept inside the figure.
- vampire_lord: menacing ancient vampire lord, white hair, gaunt, bat-wing cape on the arms, clearly older and grander
  than the vampire.

**F3. Generation route** (new tool `gen/monster_br.py`, a thin layer over `bedrock.invoke` and the existing monster
cutter `monster.py`): one Ultra render per variation holding **all four poses in one image** (idle, attack, hurt,
kneel, left to right, facing right, flat magenta background), so identity is consistent; Ultra's image-to-image input
is the existing layout guide (`monster.guide()`-style grey boxes and ground line, 4 cells) at a strength chosen in the
first variation. If the 4-pose layout fails twice for a sprite, fall back to: idle alone (Ultra), then attack, hurt,
kneel each by Control Structure on a guide drawn from the old approved pose silhouettes (the retired sheet), with the
new idle in the prompt. Background: magenta key cut (the AR `tol` flood); `remove_bg` only when the key cut fails.
Cut to the sheet's size band, <= 16 colours with the shared outline, feet on the feet row (`cut` options:
`match_height`, `fit: headroom` — size is never a rejection reason).
**F4. Approve, rig, kneel, lock.** Archive with the next free id (committed before the first call):
`retire.py crazy_horse --as crazy_horse_v3`, `vampire --as vampire_v2`, `pirate --as pirate_v1`, `dark_wizard --as
dark_wizard_v1`, `vampire_lord --as vampire_lord_v1` (check `approved/_retired/` first). Approval: `approve.py`
hard-codes `backend: gemini` (`approve.py:115`, `:128`) and `generate.py:317` refuses Bedrock monster sheets (pinned
by `selftest_colossus.py:234`), so `monster_br.py approve` writes `approved/<id>/monster_<size>.{png,json}` with `backend: bedrock`, model, seed,
`cache_key` (exactly that field name: `selftest_retire.py:369-371`, `selftest_roster.py:175`) and purpose (the gen selftest's style lock checks a bedrock json against the BR ledger, as for the AR NPC
sheets), and `kneel.json` in the **existing Bedrock kneel shape** that `selftest_roster.kneel_ok` accepts (`arm` other
than `g` plus `br_cache_keys`, `selftest_roster.py:219-221`, no `backend: bedrock`), so `selftest.py:262-280` still
counts 135 kneel keys and `kneel_tools.py coverage` still reports `ai 123`. The approved keys' render cache files
(`cache/<key>.png`, `.json`) are committed (`selftest_retire.py:368-373` requires them tracked for crazy_horse and
vampire; done for all five). Then `retire.py --move-rig <id>`, a new rig (starting from the old rig's structure), the kneel bridge, review
(<= 4 iterations), lock, atlas. Size entries for these five: none (they keep their current class).
**F5. Acceptance.** Per sprite: reviewer SHIP; `check <id>` OK; browser `anim_bipeds` / `anim_beasts` loop and a
real battle; bestiary page renders. Ledger rows match the calls.

## Order, owners, merge

0. The plan is re-reviewed (Momus) until OKAY before any code change; the plan and `docs/art/ef/` are committed.

1. EF-A (one owner; engine + pipeline) then EF-B on it (data + review).
2. In parallel: EF-C (pipeline + two rigs), EF-D (rig + runtime), EF-E (colossus), each in its own worktree. EF-D
   touches `enemyChoreography.ts`, `BattleArt.ts` and `monster_atlas.py` like EF-A: EF-D rebases on EF-A. B4's shark
   review waits for EF-C2.
3. EF-F in the main checkout on branch `ef-br` (the Bedrock gate refuses worktrees), sequential per sprite.
4. Integrator: one batch per AGENTS.md (build, test:fast, `check --all`, selftest, atlas determinism, test:full),
   then a summary for the user with every screenshot path, the fire-lizard limit and any debrief.

## EF-G. Puppet-then-repaint for the four humanoids (rev 3, 2026-11-24; Momus rev-1: 14 findings, rev-2 OKAY with 4 notes, addressed)

EF, EF2 and EF3 gave no shippable pose set: renders keep identity only at low strength, where they barely move the
pose. The user's route: pose the chosen idle with ordinary image editing, then let SD 3.5 Large re-render each image at
low strength. User picks (2026-11-24, `~/temp/ff-game/ef/bedrock3/idle_candidates.png`): pirate **v3** with **v4's
human face** grafted on (v4's two bent swords rule v4 out); vampire **v2** with the blood pool removed; vampire_lord
**v4**; dark_wizard **v4**. Raw keys: the EF3 rows of `assets-src/gen/monster_br3.yaml` (its `pick.idle` stays as
recorded; the EF4 picks live in the new `monster_hr.yaml`). EF3 stays closed.

**G0. Setup.** Merge `mainline` into `ef-br` first (EF-A's `monster_hires.py`, the smoothing rule). The four `monsters.yaml` entries' Gemini fields stay
unchanged until approval (the style lock re-plans the live Gemini `monster_small` records, `selftest.py:274-277`); the
picked designs' briefs and pose texts (e.g. dark_wizard: a horned hood, no hat) go in `monster_hr.yaml` (`brief`,
`attack`, `hurt`, `kneel`), read by the puppet and the prompts, and are written into `monsters.yaml` by the approve step; poses follow those texts and the kneel convention (dazed, on one or both knees, head low).

**G1. Idle masters (no AI).** New `gen/monster_hr_prep.py` (< 250 lines), recipe in `gen/monster_hr.yaml` (per sprite:
source keys, flip, key settings, polygons, landmarks), output `gen/out/hr/<id>/idle_master.png` (untracked; its
sha256 recorded in the yaml, so drift fails clearly):
- **Canvas:** 1024x1024 RGBA, figure scaled (Lanczos) to 880 px tall, feet on row 960, centred, the lunge room kept to
  the right; **facing right** (`flip: true` for dark_wizard v4, which faces left; vampire v2 and vampire_lord v4 (near-frontal, turned slightly left) take `flip: false`, stay three-
  quarter in idle, and their poses turn toward the right).
- **Background:** border-sampled key (per-sprite tolerance and hue, as EF3's `key_thresh` / `hue`), the largest figure
  component kept plus pieces touching it; pirate v3's teal gradient page uses a per-row border sample.
- **Pirate:** v4's face (a polygon on v4's raw) affine-fitted by 4 landmarks (eyes, nose tip, chin) onto v3's face,
  colour-matched (per-channel mean/std toward v4's own face statistics re-lit to v3's skin-neighbour luminance), seam
  feathered 6 px and placed under the hat brim and collar where possible.
- **Vampire v2:** the blood pool removed by a **hand-drawn polygon** recorded in the yaml (its red equals the cape
  lining's, so no colour rule); boots and hem completed by extending their own edge rows downward to the ground row.
- **Wizard v4:** the staff-head glow outside the figure is cut back to <= 12 px from the staff head (the brief keeps
  the aura inside the figure).
- **Gate:** one image-only reviewer on the four masters at full size and at 128 px (pirate: does the face fit, does it
  read with v3's bony hands and neck, is the seam visible; vampire: no blood, believable feet and hem). <= 3 iterations;
  else a debrief (`~/temp/ff-game/ef/bedrock4/<id>/DEBRIEF.md`) and the sprite stops.

**G2. Puppet poses (no AI).** New `gen/monster_hr_puppet.py` (+ `monster_hr_warp.py` if needed; each < 250 lines):
- **Rigid parts** (polygon + pivot on the master): head, torso, near / far upper arm, forearm + hand, and **separate
  props** (the pirate's cutlass, the wizard's staff); legs only where drawn (pirate).
- **Cloth by warp**, not rigid parts: robes, long coats, capes and the lord's **wings** are piecewise-affine warped on a
  triangle mesh (`scipy.spatial.Delaunay` over control points on the cloth outline and its attachment line, so cloth
  bends with the body instead of tearing). The wings are their own warped parts (folded in hurt and kneel, spread in
  attack).
- Per pose (`attack`, `hurt`, `kneel`): part transforms, control-point moves and z-order in the yaml; exposed gaps
  filled from the nearest part's own pixels (dilation fill). Deterministic; sha256 of every posed PNG in the yaml.
  Output `gen/out/hr/<id>/<pose>_posed.png` plus an overlay (parts, pivots, mesh).
- **Gate before any Bedrock call:** the agent's checks (figure inside the canvas with >= 16 px margin, standing feet
  on row 960 +-4, no transparent tear inside the silhouette > 50 px, pose differs from idle by IoU <= 0.8) and one
  image-only reviewer on the posed images + overlays ("does the pose read; anything torn, doubled or floating?").
  <= 3 iterations per pose; else that sprite gets a debrief and no G3 spend.

**G3. Repaint (Bedrock).** New `gen/monster_hr_br.py` (< 250 lines; `monster_br2.py` is full): its own variation rows in
`monster_hr.yaml` (`pass: EF4`, purpose, model `sd35`, seed, strength, prompt, the posed or master PNG's sha256 and
the cache key), building an SD 3.5 Large **image-to-image body from a given PNG** (the master or a posed image,
composited on flat mid-grey), through `bedrock.invoke` (main checkout only).
- **Every idle is repainted too** (same strengths), so all four poses share one rendering; the approved idle is the
  repainted render.
- Strengths {0.30, 0.38, 0.45}, lowest first, then <= 2 more (seed or strength): **<= 5 calls per image**. Stop at the
  first result passing the checklist: same costume, colours and face as the master; the posed silhouette kept (IoU
  with the posed mask >= 0.85); no extra or missing limbs, weapons, wings; the background keyable by G1's key; no
  text or frame.
- **Budget:** pass `pass EF4` becomes the live `budget["bedrock"]` block (`bedrock.py:130-136` reads only it):
  `cap` 80, `per_purpose_caps` `ef4_pose` 80 (4 sprites x 4 images x 5), `reserve` 0; no `remove_bg` purpose (no
  caller). No Gemini. Closed into `bedrock_history` at the end. No headroom: an image that fails its 5 calls ends that
  sprite's EF4 run (debrief).

**G4. Cut, review, hold.** `monster_hr_br.py cut` takes the keyed RGBA repaints (no magenta re-key), cuts the **large**
size (128 px cell, figure 96-120 px, feet row 122) with one palette per sprite quantized from all four together (<= 16
colours, shared outline), and writes review sheets to `~/temp/ff-game/ef/bedrock4/<id>/` (large, small 80-cell
preview, screen x2), plus the prepared `monster_scale.yaml` entry of the smoothing rule (`smooth: [despur]` + hi-res
texture; despur dropped for wispy edges such as the wizard's ragged robe if the before/after shows it eats them).
Review: one fresh image-only reviewer per sprite on idle, attack, hurt, kneel + raws: same character in all four, the
pose reads, clean render (no extra limbs or weapons, no seams), menacing not cartoon -> SHIP / ITERATE (an ITERATE
may spend the image's remaining calls). **Hold before approval** for the user's size decision; record the approve
command: `monster_hr_br.py approve <id>` writes `approved/<id>/monster_large.{png,json}` (backend bedrock, `cache_key`
= the idle repaint's key, `sources` = one entry per pose, each `{pose, cache_key}` of its repaint, `inputs` = `{pose:
{posed_sha256, raw_keys}}` (the EF3 raws and the posed images, not ledgered renders), `recipe: monster_hr.yaml#<id>`;
`selftest_roster.bedrock_keys` reads every `sources[].cache_key`, `selftest_roster.py:178`) and
`kneel.{png,json}` in the existing Bedrock kneel shape, **removes `approved/<id>/monster_small.*`** (archived in
`_retired/<id>_vN`), sets `size: large` and writes the `monster_hr.yaml` brief and pose texts into `monsters.yaml`; `selftest_roster.bedrock_ok` must accept every key.
After the size decision: F4's rig (`retire.py --move-rig`), kneel bridge, review, lock, the smoothing entry, atlas.

**G5. Code and tests.** `selftest_monster_hr.py`, registered in `selftest.py`: prep and puppet byte-deterministic on
a synthetic figure and on the recorded recipes (sha256 match), the yaml schema, the EF4 budget block, every EF4 cache
key reproducible from `monster_hr.yaml`, the approve json shape. Full `selftest.py` passes in the main checkout. Work on
branch `ef-br` (main checkout; the Bedrock gate).

### EF-G amendment A (rev 2, 2026-11-24): dark_wizard re-pose with large moves (user-approved trial; Momus rev-1: 10 findings)

EF4's repaints held identity and rendered cleanly, but the G2 poses moved too little (attack and hurt read as leans).
Trial on **dark_wizard only**, as pass **EF5**.

**A0. Tool changes (named; each module stays < 250 lines; RED-first cases in `selftest_monster_hr.py`).**
- `monster_hr_br.py`: pass and purpose come from each variation row's `pass` tag (`EF4` -> `ef4_pose`, `EF5` ->
  `ef5_pose`; a row without a tag is EF4), not from the module constants (`:30`); the 5-row cap (`:53`) and the
  selftest's row cap (`selftest_monster_hr.py:63`) count **rows per pass per pose** (not `max(n)`); **EF5 rows continue
  the numbering** (dark_wizard attack and hurt n 3-7, kneel n 2-6), so `n` stays unique per pose and `variation()`,
  `record_row`, `pick` and `--var` need no pass key; if `monster_hr_br.py` would pass 250 lines, the approve json moves
  to `monster_hr_review.py` (the user's "up to 5 variations" applies
  to this trial's images; EF4 rows untouched); EF5 rows may carry a `prompt_pose` override (used instead of
  `poses[pose]`, so EF4's keys stay byte-identical); `approve()` writes each `sources[]` entry's own `pass` /
  `purpose` / `arm` (the EF4 idle with EF5 poses); the review directory is per pass (`bedrock4/` for EF4,
  `bedrock5/` for EF5), so EF4's held sheets are never overwritten.
- `monster_hr_puppet.py`: the review/output directory is per pass (`--pass EF5` -> `bedrock5/<id>/posed/`); EF4's G2
  files are left alone.
- `monster_hr_check.py`: per-pose IoU bars (attack, hurt <= 0.70; kneel <= 0.65 for EF5; EF4's 0.80 kept for EF4
  rows) and three new measures reported: the staff's **world angle** from vertical and the chest's world angle
  (composed through `worlds()`, `monster_hr_puppet.py:69-77`; + = forward / toward the right, as EF4's attack chest
  +10 and hurt -12), and the **body height** = the alpha bbox height of the figure **without props** (the staff mask
  excluded).
- `selftest_monster_hr.py`: `_check_recorded` per pass (EF4 rows against `pass EF4` ledger rows, EF5 against EF5);
  `_check_yaml` accepts the per-row pass tags (top-level `pass` stays EF4 as the default); `_check_budget` checks the
  closed EF4 and the EF5 block.
**Supersede, never overwrite (EF4 reproducible):** EF4's dark_wizard recipes become `attack_ef4`, `hurt_ef4`,
`kneel_ef4` with their recorded sha256s; EF4's five pose rows get `input: <pose>_ef4` (the mechanism vampire_lord's
`attack_r2` / `hurt_r2` already use). The new recipes take the plain names.

**A1. Re-pose (no AI)** on the EF4 `idle_master`. Targets (measured by A0's checks, + = forward):
- **attack:** staff world angle >= +50 deg from its idle angle (near horizontal toward the right); chest >= +15 deg;
  IoU with idle <= 0.70.
- **hurt:** chest <= -20 deg (thrown back), staff tilted away (world angle <= its idle angle - 15 deg); IoU <= 0.70;
  `prompt_pose`: "knocked backward, recoiling, head thrown back, the staff tilting away, the free claw flung up".
- **kneel:** body height (props excluded) <= 70 % of the idle's, hem on row 960 +- 4, the head hanging toward the
  planted staff; IoU <= 0.65.
- Reviewer-only (the rig has no forearm, leg or free-arm joints): "arm fully extended", "free arm flung up", "one
  knee down", "hem trailing".
- Gate: G2's checks + the above + one image-only reviewer ("does each pose read clearly at 128 px?"), <= 3
  iterations; on failure a debrief at `~/temp/ff-game/ef/bedrock5/dark_wizard/DEBRIEF.md` and no EF5 spend.

**A0 / A1 result (2026-11-24).** A0: `monster_hr_br.py` takes pass / purpose from each row (`row_pass`), caps rows
per pass per pose, reads a row's `prompt_pose`, and writes per-pass review dirs (`review_dir`); the approve json moved
to `monster_hr_review.approve_json` (each `sources[]` entry with its own pass / purpose / arm). `monster_hr_puppet.py`:
`--pass EF5` (`bedrock5/<id>/posed/`), a pose's `pass` tag, part option `minus` (a hand on the staff leaves the
staff), pose `prefill` (a part's vacated px filled on the master before it moves; the claw's place in the robe, the
hand's on the shaft) and part option `joint: false`. `monster_hr_check.py`: per-pass IoU bars, the staff / chest world
angles and the body height without props, the EF5 targets. Selftests RED-first (`_check_ef5_tools`). EF4's recipes are
`attack_ef4` / `hurt_ef4` / `kneel_ef4` (sha256 unchanged), its rows `input: <pose>_ef4`; a new `hand` part (no px in
EF4 recipes) leaves every EF4 sha256 byte-identical. A1 (no AI): attack staff +77.0 deg from its idle -0.2 (world
76.8), chest +26, IoU 0.51; hurt chest -24, staff -24.2 (-24 from idle), IoU 0.44; kneel body height 537 / 880 =
0.61, hem on row 960, IoU 0.45 (measured values in the puppet's output). Reviewer (image-only, full and 128 px):
iteration 1 ITERATE x3, iteration 2 ITERATE x3, iteration 3 PASS (nits: claw-tip fragments on the shaft in attack, the
kneel's right horn crossing the staff). Sheet: `~/temp/ff-game/ef/bedrock5/dark_wizard/posed/poses_sheet.png`. User follow-up
(2026-11-24): the attack's head no longer pitches with the +26 chest lean; it is counter-rotated to +8 world (new
measure `head_deg`), the eyes on the party; image reviewer PASS (head sits naturally, clean hood join). Held at
A2: no Bedrock call, no EF5 budget block.

**A2. User gate.** The posed inputs (`~/temp/ff-game/ef/bedrock5/dark_wizard/posed/`) are shown to the user; **no
Bedrock call until the user approves them.**

**A3. Repaint.** As G3 (SD 3.5 Large image-to-image, strengths 0.30 / 0.38 / 0.45 then <= 2 more, **<= 5 EF5 calls
per pose**; the EF4 idle repaint is reused). Budget: `pass EF5` becomes the single live `budget["bedrock"]` block
(cap 15, `per_purpose_caps` `{ef5_pose: 15, reserve: 0}`, `gemini_before` = the current count, `reserve_max_usd`,
`note`, as EF4's entry), closed into `bedrock_history` with `used` / `closed` at the end. Then G4 (cut into
`bedrock5/`, review, hold for approval).

### EF-G amendment B (rev 3, 2026-11-25): the other three humanoids by the EF5 method (Momus rev-1: 11 findings; rev-2 OKAY, 4 notes applied)

EF5 proved the method on dark_wizard (re-posed with large measured moves, user-approved poses, SD 3.5 Large at
0.30-0.38: 4 calls for three poses; final review SHIP WITH NITS). User ruling 2026-11-25: use the same method for
pirate, vampire and vampire_lord (and the background-removal step proposed for the pirate), the **attack pose an
upright villain attacking the heroes** (standing tall, the weapon or claw driven at the party toward the right; no deep
lunge or bent-over torso). Pass **EF6**; review dirs `~/temp/ff-game/ef/bedrock6/<id>/`.

**B-budget (first, by the orchestrator session).** Close EF5 into `bedrock_history` (`used` = its ledger count,
`closed` text); open `pass EF6` as the single live `bedrock` block: `cap` 57, `per_purpose_caps` `{ef6_pose: 56,
ef6_nobg: 1, reserve: 0}` (pirate 4 + vampire 4 + lord 3 images x 5 = 55, plus 1 for dark_wizard's hurt nit fix if the
user asks for it), `gemini_before` = the current count, `reserve_max_usd` 0.08, `note` citing the user's 2026-11-25
approval. **All EF6 Bedrock calls (the `nobg` call and every repaint) are made by the orchestrator session**, the
repaints only after each sprite's B2 user gate; sub-agents make none.

**B0. Tool changes** (RED-first; every module < 250 lines; overflow modules named here).
- `monster_hr_check.py`: `IOU_BARS["EF6"]` = attack 0.80 (an upright attack overlaps the idle a lot; its readability
  is reviewer-judged), hurt 0.70, kneel 0.65; `targets()` reads per-sprite targets from `monster_hr.yaml`
  `<id>.puppet.targets.<pose>` = `{chest: [lo, hi], head: [lo, hi], prop: [lo, hi] (optional, world deg from vertical),
  `prop_delta: [lo, hi]` (optional, the prop's world angle minus its idle angle; EF5's `d >= 50` / `d <= -15` become
  `prop_delta` [50, 180] / [-180, -15], exact),
  height_max: f (optional, body height / idle)}`, any key optional, ranges inclusive in degrees (+ = forward); EF5's
  hard-coded targets move into dark_wizard's yaml (byte-identical results). EF6 attack targets: chest [-5, 10], head
  [-5, 10]; hurt: chest [-90, -20]; kneel: height_max 0.70. "Weapon or claw driven at the party" is reviewer-only.
- `monster_hr_br.py`: `status` lists every pass found in the ledger; new command `nobg <id>` (in a new module
  `monster_hr_br_nobg.py`, imported by the CLI) makes one Stability Remove Background request through
  `bedrock.invoke("remove_bg", {"image": B.png_b64(raw.convert("RGB")), "output_format": "png"}, paid=True,
  purpose="ef6_nobg")` (the short model name: `invoke` looks up `MODELS` itself, `bedrock.py:196-201`) (the body of `landmark_cut.py:139`), records the returned cache key as
  `<id>.prep.nobg_key` in `monster_hr.yaml`; a cache hit is free and needs no `--paid`.
- `monster_hr_prep.py` (+ `monster_hr_prep_nobg.py`): `prep.key: remove_bg` takes the body's alpha from the cached
  remove_bg output (`nobg_key`) instead of the colour key, and **then** composites the graft (the graft's own alpha
  from its v4 polygon and v4's page key, union with the body's alpha, the graft drawn on top); the colour-key hand
  polygons (`keep`, `keep_light`, `erase_hue`, `erase_out`) are ignored under `remove_bg`, `restore_out` is kept. The
  beige strip beside the ear (debrief iteration 4) is removed by trimming the graft polygon to v4's face and beard
  (an `erase` polygon on the graft layer) and checked by the G1 reviewer.
- `monster_hr_puppet.py` (+ `monster_hr_puppet_fill.py`): a part option `mirror: {from: <part>, about: [x, y]}` that
  paints a hidden limb from the visible one's own pixels mirrored about a vertical line through the point, drawn under
  the covering parts (the vampire's hidden thigh / knee); skirt front panels as warped parts with the legs.
- `monster_hr_review.py`: `write_monsters_yaml` writes the **picked row's `prompt_pose`** when present (else
  `poses[pose]`); `approve_json` adds `prep.nobg_key` to `inputs.idle.raw_keys`, and `approve` un-ignores it with the
  render cache files.
- The old `selftest_monster_hr.py` checks are **widened** in place where they gate passes (`:66-67` accepts EF6,
  `:125` loops EF4-EF6), and the new cases go in a new `selftest_monster_hr_ef6.py`, registered in `selftest.py`: `_check_yaml` accepts the EF6 tag; `_check_recorded`
  loops EF4, EF5, EF6 and counts only `*_pose` requests against variation rows (the `ef6_nobg` row is checked
  separately: its key = `nobg_key`, cached, successful); the skip-when-missing test includes `nobg_key`; `_check_budget`
  covers EF5 closed and EF6 live / closed; the targets schema; the `mirror` option; the `nobg` body (asserting the model argument `"remove_bg"`, as `selftest_colossus.py:168`).
**Supersede (EF4 and EF5 reproducible).** vampire_lord: the existing pose recipes are renamed `attack` -> `attack_ef4`, `attack_r2` ->
`attack_r2_ef4`, `hurt` -> `hurt_ef4`, `hurt_r2` -> `hurt_r2_ef4`, `kneel` -> `kneel_ef4` (`base_pose` keeps the text
before the first `_`, `monster_hr_check.py:23`), with their five sha256 fields, every keyed EF4 row's `input:` set to its
renamed recipe, the `_ef4` posed PNGs rebuilt and sha256-checked; the new EF6 recipes take the plain names. vampire:
its EF4 rows have no keys (0 calls) and are removed. EF6 rows continue `n`. Every EF6 attack row carries a
`prompt_pose` with the upright wording (EF4's `poses` texts unchanged).

**B1. Prerequisites and re-pose (no AI; sub-agent).** pirate: the G1 master from the remove_bg body + graft (after the
orchestrator's `nobg` call; G1 gate <= 3 iterations). vampire: the skirt and `mirror` fix, then the poses. vampire_lord:
v4 (the user's pick; EF4 master and idle repaint reused); its G4 notes (the face lost at 1x, the "rabbit ear" hair)
are put to the B1 reviewer explicitly. Poses per the B0 targets, gate = the checks + one image-only reviewer at full
size and 128 px (<= 3 iterations; a debrief on failure).
**B2. User gate** per sprite: `bedrock6/<id>/posed/poses_sheet.png` shown to the user; no repaint before approval.
**B3. Repaint** (orchestrator) as A3: 0.30 first, <= 5 EF6 calls per image (pirate and vampire repaint their idle too;
the lord's EF4 idle is reused). Then G4: cut into `bedrock6/`, an independent image-only review, approval held for the
user's size decision. EF6 closed into `bedrock_history` at the end. Full `selftest.py` passes.

**B0 result (2026-11-25).** `monster_hr_check.py`: `IOU_BARS["EF6"]` (attack 0.80, hurt 0.70, kneel 0.65) and
`targets(tg, ...)` reading `<id>.puppet.targets.<recipe>` (`chest` / `head` / `prop` / `prop_delta` ranges inclusive,
`height_max`; flags `t_<key>`); EF5's targets moved into dark_wizard's yaml (its posed sha256s unchanged).
`monster_hr_br.py`: `status` lists every pass of the ledger; `nobg <id>` (`monster_hr_br_nobg.py`: one
`invoke("remove_bg", {image, output_format: png}, purpose="ef6_nobg")` on the prep raw, the key recorded as
`prep.nobg_key` by `monster_hr_yaml.record_prep`). `monster_hr_prep.py` + `monster_hr_prep_nobg.py`: `key: remove_bg`
(the alpha from the cached output, then the graft composited on top with its own alpha, union; `graft.erase` trims the
graft layer; `keep`, `keep_light`, `erase_hue`, `erase_out` ignored, `restore_out` kept; without a cached `nobg_key`
it exits naming the `nobg` command). `monster_hr_puppet.py` + `monster_hr_puppet_fill.py`: part option `mirror`.
`monster_hr_review.py`: the picked row's `prompt_pose` in the monsters.yaml rewrite; `prep.nobg_key` in
`inputs.idle.raw_keys` and un-ignored by `approve`. Selftests: `selftest_monster_hr_ef6.py` (RED first: 8 of 13 cases
failed before the tools), the old file widened (EF6 tag, EF4-EF6 loop on `*_pose` requests, `nobg_key` in the
skip-when-missing). vampire_lord's EF4 recipes are `attack_ef4`, `attack_r2_ef4`, `hurt_ef4`, `hurt_r2_ef4`,
`kneel_ef4` (sha256 reproduced, every keyed EF4 row's `input:` renamed); vampire's keyless EF4 rows removed and its
never-repainted EF4 G2 recipes replaced. pirate: `key: remove_bg` with the graft `erase` trim (v4's beige neck and the
page-tinted hair beside the earring), waiting for the orchestrator's `nobg pirate --paid`.

**B1 result (2026-11-25, no AI; vampire and vampire_lord).** Poses per the B0 targets, every agent check passes.

| sprite | pose | IoU (bar) | chest | head | height / idle |
|---|---|---|---|---|---|
| vampire | attack | 0.783 (0.80) | +3 | +3 | 1.00 |
| vampire | hurt | 0.564 (0.70) | -23 | -29 | 0.96 |
| vampire | kneel | 0.410 (0.65) | +21 | +35 | 0.653 |
| vampire_lord | attack | 0.762 (0.80) | +4 | +4 | 1.00 |
| vampire_lord | hurt | 0.625 (0.70) | -28 | -32 | 0.94 |
| vampire_lord | kneel | 0.434 (0.65) | +18 | +26 | 0.598 |

The image reviewer (fresh each iteration, full size and 128 px):

- **vampire:** ITERATE on all three poses after 3 iterations (the attack minor).
- **vampire_lord:** attack PASS (iteration 2 and 3); hurt and kneel ITERATE after 3 iterations.
- **The lord's G4 notes:** the face and eyes read at 128 px, and no rabbit ears or halo appear.

Both sprites stopped at the gate with debriefs, `~/temp/ff-game/ef/bedrock6/<id>/DEBRIEF.md`; their sheets are
`~/temp/ff-game/ef/bedrock6/<id>/posed/poses_sheet.png`. The EF6 rows are prepared without keys, at 0.30 with the
upright `prompt_pose`:

- vampire: idle, attack, hurt and kneel, each n 1;
- vampire_lord: attack n 5, hurt n 6, kneel n 4;
- pirate: n 1 for each pose.

0 EF6 calls.

**Pirate G1 on the remove_bg body (2026-11-25).** The orchestrator's `nobg pirate --paid` (1 of 1 `ef6_nobg`, key
007b216d...) gave the body's alpha. The master then got three fixes:

- `nobg_erase_out` polygons and `nobg_deteal` (new canvas fixes valid under `key: remove_bg`, mapped by
  `monster_hr_prep_nobg.effective`; `deteal` is in `monster_hr_fix.canvas_fixes`) clear the page-teal leftovers round
  the face;
- the graft feather is 5;
- the graft `erase` trim is rounded.

Three fresh image-only reviewers all said ITERATE. The last one flagged only a straight edge at the right jaw and a
squared lapel block (`~/temp/ff-game/ef/bedrock6/pirate/DEBRIEF.md`). The sprite stops at G1: no B1 poses, master
not recorded.

### EF-H. User-rendered sheets (rev 3, 2026-11-25; Momus OKAY, notes applied)

User ruling 2026-11-25: after our cut-out and posing, the user renders the final sprite sheet in an interactive
image UI (ChatGPT) and supplies it. dark_wizard first: `~/temp/dark_wizard_sprite_sheet.png` (704x144 RGBA, binary
alpha, ~5,900 colours, four poses in one row facing right: idle, attack, hurt, kneel), copied into the repo as
`assets-src/gen/user_art/dark_wizard/sheet_2026-11-25.png` (tracked; sha256 recorded). The EF-G repaint route stops
for dark_wizard; the EF5 set stays in `bedrock5/` as an alternative. pirate, vampire and vampire_lord follow the same
route: we deliver a reference pack per sprite (idle master, a one-row four-pose posed sheet, a suggested prompt) to
`~/temp/ff-game/ef/user_packs/<id>/`; the user's renders come back and are imported by H1. Pass EF6 is closed at its
ledger count (no further Bedrock calls in this route).

**H1. Import tool** (rev 2, Momus rev-1: 9 findings) `gen/monster_user.py` (< 250 lines; RED-first
`selftest_monster_user.py`, registered in `selftest.py`), recipe rows in `gen/monster_user.yaml` (`<id>: {file, sha256,
poses: [idle, attack, hurt, kneel], flip: false, size: large, tool, rendered, author: user, refs: {idle_master_sha256,
poses_reference_sha256}}`; dark_wizard: `tool: ChatGPT (interactive)`, `rendered: 2026-11-25`, `refs: unknown` with a note: its references were the EF4 / EF5 images the user had,
  before the pack route existed):
- **Split:** the row into exactly four 8-connected pieces after dropping specks < 24 px (else refuse).
- **Scale:** `s = min(target_idle, fit_tallest)`, where `target_idle` brings the idle into the large band (96-120) and
  `fit_tallest` keeps the tallest pose clear of the cell's top border with the feet on row 122; **s = 1.0 when the
  idle is already in the band** (dark_wizard: idle 112, tallest hurt 115 -> s = 1.0, no resample). s < 1 re-pixelizes
  as `monster.py:646` does, never nearest; an idle below the band keeps s = 1.0 (or an integer upscale
  if it is under half the band) and its height is reported, never refused (size is not a rejection reason).
- **Placement:** each pose's anchor = the mean x of its opaque px in its bottom 6 rows; every pose is placed with its
  anchor at the same x as the idle's, feet on row 122; the cell width `cw` follows the cutter's widening rule
  (`monster.py:695-702`; the attack is 166 px wide, so cw >= 170); no opaque px on the 1-px border.
- **Colours:** the house quantizer, not median cut: one palette for all four through `PX.sheet_palette(...,
  detail_px=PX.detail_mask(...))` applied with `pixelize_native` (as `monster.py:672-680`): 15-bit snap, the darkest
  entry forced to `PX.OUTLINE` (`pixelize.py:259-280`), <= 16 colours; the review reports max / p99 colour error and
  that the glow green survives; `monster.frame_report` must pass (PX.OUTLINE present, `monster.py:784`).
- **Review:** before/after at 1x and screen x2 to `~/temp/ff-game/ef/user/<id>/`, one fresh image-only reviewer.
- **Approve, rig and lock in ONE commit / batch** (`retire.py:16`: `--move-rig` in the commit that approves the first
  new sheet): `monster_user.py approve <id>`, modelled on `monster_hr_br.approve` (`monster_hr_br.py:168-197`:
  `AP.overwrite_gate` on both sheets, the `_retired` archive check (dark_wizard_v1 is byte-identical to the live
  files), the `monster_small.*` unlink), writes `approved/<id>/monster_large.json` with `backend: user`, `source`,
  `sha256`, `recipe`, `tool`, `rendered`, `author`, `refs`, `approved`, `grid [cw, 128]`, `bottom_row 122`,
  `layout [3, 1]`, `size: large`, `floating: false`, `flip_frames: []`, `poses`, the cut info (scale, anchors, colour
  error), and `kneel.{png,json}` (the 4th pose in the idle's cell size, `kneel_source_ai.py:12`; json `backend: user`,
  `grid`, `bottom_row`, `foot_row`, no `j0`); sets `size: large` and the brief in `monsters.yaml`; adds the smoothing
  rule's entry to `monster_scale.yaml`: **`dark_wizard: {scale: 2, tex: 2, smooth: [despur, edges]}`** (despur
  re-checked on the staff, dropped to `[edges]` if it breaks it), changeable by the user's size decision. Then, in
  the same batch: `retire.py --move-rig dark_wizard`, a new rig with **`kneel: {source: ai}`** (coverage counts
  `kneel.source == "ai"`, `kneel_tools.py:54-58`; a `source: user` would be refused by `kneel_ok`,
  `selftest_roster.py:209`, and counted as derived), the kneel bridge, the guide's review, lock, atlas rebuild, and
  the integrator gates.
- **Selftest / style lock (named):** `selftest.py:263-279`: a `backend: user` `monster_*` json is checked by re-running
  the import from the tracked source (sha256 match, byte-identical sheet) **before** the Gemini re-plan at :275; the
  user `kneel.json` stays in the `KNEEL_SHEETS` branch (:268) through `kneel_ok`, so the `>= 135` pin (:280) holds;
  `selftest_roster.kneel_ok` (:213-223) gains `elif meta.get("backend") == "user"` before the BR-keys path (the same
  re-import check); `selftest_roster._approved_keys` (:240-255) gains a user branch beside the bedrock one, counted as
  `done`. AGENTS.md "AI sprite generation" gets one line on `backend: user` (the third approved-sheet source). The
  2048 cap is checked on the `filter: linear` hi-res page the tex-2 sheet lands on (`monster_hires_pages`,
  `monster_atlas.py:225`) at the rebuild.

#### EF-H result: dark_wizard (2026-11-25, branch `ef-dw`; no AI image call)

- **H1 tool:** `gen/monster_user.py` (241 lines; measures, review pages, json shapes and the re-import check in
  `gen/monster_user_review.py`), recipes `gen/monster_user.yaml`, selftest `selftest_monster_user.py` (registered in
  `selftest.py`; RED first: `kneel_ok` refused the user kneel before its `backend: user` branch). Consumers: the style
  lock in `selftest.py` (a `backend: user` monster json re-imports byte for byte), `selftest_roster.kneel_ok` and
  `_approved_keys` (user branch, counted as done).
- **Import:** 4 pieces (4347 / 6308 / 4332 / 3243 px), heights idle 112 / attack 93 / hurt 115 / kneel 113, so
  s = 1.0 (no resample); anchors (bottom 6 rows) 31.5 / 61.5 / 33.6 / 38.0 aligned to the idle's; cell 170 x 128;
  ~5,900 colours -> 16 (one house palette, PX.OUTLINE, 15-bit); colour error max 70.0, p99 49.7, mean 11.9 (most of it
  the house ink rule: px darker than 40 become the outline); the glow: 250 bright green px, 100 % still green;
  frame_report: feet on 122, edges ok, pose diff 1.14 / 0.82 / 0.70. Fidelity review (fresh, image-only, against the
  user's file): SHIP WITH NITS (the skull's bone tones drift toward the glow's yellow-green, the lightest robe blues
  flatten; both a cost of 16 colours, kept as notes).
- **Approve:** `approved/dark_wizard/monster_large.{png,json}` + `kneel.{png,json}` (`backend: user`), monster_small
  removed (archived as dark_wizard_v1), `retire.py --move-rig dark_wizard`, monsters.yaml and enemies.yaml `size:
  large` with the new brief / description.
- **Rig:** biped, robe as torso with the hip at the hem, staff prop, sleeves riding the torso (arm parts removed);
  every in-between is the source key's upper body leaned rigidly about the hip (wind 1.5 / 3 deg in, mid / follow the
  thrust 4 deg back, hurt_in1 3 deg back, hurt_in2 4 deg forward, daze 2 deg), `kneel: {source: ai}`. Animation review
  (fresh, image-only): SHIP WITH NITS in 1 iteration (the wind-up leans in rather than drawing back; kneel_in1 barely
  squashes, so the drop happens at the swap; the kneel key is drawn without the skull's glow rim). Locked (14 frames).
- **Integrator ruling (open for the user's veto):** the kneel key keeps the staff upright, so it is as tall as the
  idle (113 / 112 px) while the body drops 13 px; the bridge resizes by bbox height and K-order pins the heights, so its
  in1 -> in2 swap step is 13.4 px = 0.88 of the span (cap 0.65 x span = 9.9). `kneel_checks.BRIDGE_SWAP_ALLOW =
  {dark_wizard: 0.9}` raises only that step (selftest RED first). The alternatives: a prop-aware bridge (a framework
  change) or a kneel re-render with the staff lowered.
- **Size (final, user ruling 2026-11-25):** `dark_wizard: {scale: 2, tex: 2, smooth: [despur, edges]}`: large like the
  ogre (a strong enemy), native pixel count, the default scale 2 (idle 224 px with the staff). The kneel bridge's
  one-sprite `BRIDGE_SWAP_ALLOW` (0.9) stays.
- **Integrator gates (ef-dw):** atlas rebuilt and committed (30 pages, 44 hi-res sheets, 18 extra pages of max 18,
  preload + largest formation 74.8 MB); PYTHONHASHSEED 0 / 1 builds byte-identical (31 files); by-rect vs mainline: only
  dark_wizard differs (17 frames of 123 sheets); `monster_anim.py check --all` 123 OK lines only; `selftest.py` ALL
  PASSED (1863 ok); `kneel_tools.py coverage` ai 123 / ai 12; `npm run build` OK; `npm run test:full` 432 files,
  10294 passed (mutation cache MISS, live 1284 s); browser `?mute=1&scenario=ef_user_dark_wizard&enemyAnim=loop`
  (new, beside the ogre) and `w_boss_evil_eye` (two dark wizards), no console warnings, 119 fps.

#### EF-H result: pirate, vampire, vampire_lord (2026-11-25, branch `ef-pv`; no AI image call)

The user's own ChatGPT renders, approved with their sizes (`~/temp/pirate_sprite_sheet_80px.png`,
`vampire_sprite_sheet_90px.png`, `vampire_lord_sprite_sheet.png`), tracked in `gen/user_art/<id>/` with their sha256 and
the sha256s of the reference packs (`~/temp/ff-game/ef/user_packs/<id>/`: idle, poses_reference, prompt) in
`gen/monster_user.yaml`. `ef-br` (the EF6 pirate puppet rows of `monster_hr.yaml`) is merged in.

- **Import fixes (framework, RED first in `selftest_monster_user.py`):** (1) the binary alpha is the figure: the
  import keys onto exact magenta only (`pixelize.foreground(exact_key=True)` through `pixelize_native`); before, the
  magenta-fringe rule ate 80 crimson coat-edge px of the pirate (colour error max 197) and `magenta_bg` keyed out the
  vampire_lord's magic as background (max 348). dark_wizard re-imports byte for byte. (2) Recipe `reserve`
  (`gen/monster_user_palette.py`): a region (sheet boxes x a colour class: skin, steel, bright, gold, grey, magenta)
  is split into `slots` tones and each tone takes PX.reserve_detail's rule (>= 8 px over `max_err`: merge two
  colours, give the slot to the tone), merging by Ward cost and never re-merging a reserved slot; still <= 16
  colours, 15-bit, PX.OUTLINE darkest. (3) `monster_check.MAGENTA_ART = {vampire_lord: ((206, 66, 189),)}`: the
  drawn magic is not key fringe (pinned: exactly the palette's flagged colours, each drawn by the render's magic).
- **Import (s = 1.0, every idle below the large band, heights reported, never refused):** pirate idle 80 / attack 79
  / hurt 77 / kneel 55, cell 128; vampire 90 / 88 / 80 / 62, cell 128; vampire_lord 90 / 89 / 83 / 62, cell 132 (its
  3 px magic fleck dropped as a speck). Colour error before (plain house palette) -> after (mean / p90 / max):
  pirate overall 20.1 / p99 66.3 / 197 -> 20.8 / p99 45.5 / 74; face skin 30.9 / 44.3 / 56.2 -> 25.1 / 36.0 / 50.6;
  cutlass steel 33.3 / 54.9 / 81.1 -> 20.5 / 33.1 / 44.1 (a near-white highlight slot); hat gold 30.8 / - / 71.1 ->
  26.3 / 43.7 / 74.0; beard grey 30.5 / - / 53.0 -> 21.6 / 32.1 / 41.7 (the cost: coat reds 13.1 -> about 20, 4
  red tones). Vampire overall 15.0 / p99 40.1 / 66.4 -> 15.1 / 38.3 / 71.1; pale face 31.2 / 50.6 / 55.4 -> 19.6 /
  35.7 / 45.5; copper trim 31.1 / 45.9 / 66.4 -> 19.7 / 30.8 / 71.1. Vampire_lord overall (after the key fix)
  19.5 / p99 55.7 / 117.7 -> 19.6 / 47.8 / 75.2; magic 84.4 / 102.0 / 117.7 -> 23.1 / 39.8 / 52.1; face 30.1 / 47.4
  / 66.7 -> 19.9 / 37.3 / 47.0; gold trim 34.2 / 50.7 / 64.1 -> 26.1 / 45.0 / 66.1.
- **Fidelity reviews (fresh, image-only):** pirate SHIP WITH NITS at iteration 2 (it1: the beard turned navy, fixed by
  the beard slot; left: the hat gold a little duller, the kneel face darker, the blade's top highlight slightly
  flattened); vampire SHIP WITH NITS at iteration 2 (it1: the copper trim went plum and the face warm, fixed by the
  face and copper slots; left: the darkest cloth shadows ink to the outline colour, the house ink rule); vampire_lord
  SHIP WITH NITS at iteration 1 (the wings' mid-crimson folds merge into near-black, the hair a step lighter, the
  magic slightly pinker).
- **Approve:** `monster_user.py approve`, monster_small removed (archives pirate_v1, vampire_v2, vampire_lord_v1
  byte-identical), `retire.py --move-rig` for each, monsters.yaml / enemies.yaml `size: large` and the user's briefs.
- **Rigs (dark_wizard's recipe, every in-between a rigid lean of its key's upper body about the hip, arm parts
  removed, `kneel: {source: ai}`):** pirate: hip where the legs leave the coat (y 98), wind 3.5 / 7 deg back with the
  upper body 1 / 2 px back, mid / follow the lunge key 2 / 1 deg on; vampire: hip y 105, the attack frames also shift
  the upper body (wind 4 / 8 px back, 1 / 2 px up; mid / follow 5 / 6 px forward: the centroid cap), 1 px cracks
  closed with ink (7 paint px), kneel bridge `{keep_top: 0.1, keep_bot: 0.3}` (the default opened a second hole in
  kneel_in2); vampire_lord: the robe is the torso with the hip at its hem, wings and magic ride the upper body.
  **Integrator ruling (open for the user's veto):** the vampire_lord attack key draws 1.67x the idle's area, so no
  rigid lean lifts the swap step over the keys' IoU + 0.02 (best 0.47 < 0.49); `monster_check.ATTACK_SWAP_IOU =
  {vampire_lord: -0.03}` lowers the margin for its attack only (RED first). Animation reviews (fresh, image-only):
  all three SHIP WITH NITS in 1 iteration (the shared nit: a weak wind-up / a one-frame recover; the pirate's wind
  was deepened after its review). Locked (14 frames each).
- **Size:** `{scale: 2, tex: 2, smooth: [despur, edges]}` for all three (about 160 / 180 / 182 screen px; despur kept,
  the hi-res frames keep the blade and claws whole: `~/temp/ff-game/ef/user/<id>/smooth_hires_x2.png`).
- **Integrator gates (ef-pv):** atlas rebuilt and committed (30 pages, 47 hi-res sheets on 20 hi-res pages, 18 extra
  pages of max 18; preload + largest formation 90.4 MB of 128); PYTHONHASHSEED 0 / 1 builds byte-identical (31 files);
  by-rect vs mainline: only pirate, vampire and vampire_lord differ (17 frames each of 123 sheets);
  `monster_anim.py check --all` 123 OK lines only; `selftest.py` ALL PASSED (1867 ok); `kneel_tools.py coverage` ai
  123 / ai 12; `npm run build` OK; `npm run test:fast` 430 files, 10265 passed; `npm run test:full` 432 files, 10297
  passed, 2 skipped (mutation cache MISS caaa3078077a, live 1299 s on 4 workers); browser
  `?mute=1&scenario=ef_user_pirate_vampire&enemyAnim=loop` (new: pirate, vampire and vampire_lord beside the goblin
  and the ogre), no console warnings or errors (`~/temp/ff-game/ef/user/smoke/`).

#### EF-H follow-up plan: one attacker at a time in the `enemyAnim=loop` preview (2026-11-25, dev preview only)

User concern on the ef-pv smoke shot: with `?enemyAnim=loop` every enemy lunges 20 frames after the last, so five
attackers overlap over the party and the pirate (drawn later) covers the vampire's front leg. Plan: the loop takes
turns (`enemyAnimPreview.turnPlan`): enemy i's whole schedule is offset by the attack slots before it (each slot = its
attack length + PAUSE), and every enemy shares one super-cycle (the larger of the slots' sum and the longest own
cycle), so no two attack windows overlap while hurt / cast still play in place. Step mode uses the same plan. No
battle logic or real-battle drawing changes; a unit test pins disjoint attack windows for mixed lengths.

Result (ef-pv): the scenario stepped frame by frame (`&enemyAnim=step`, 420 frames, every attack of the five
enemies): at most one enemy lunges at a time and the lunging one is the top child of the actors layer in every frame
(A4, read from the scene graph: 0 frames off top); the pirate's, vampire's and vampire_lord's strips show both legs in
every frame and nothing clipped (`~/temp/ff-game/ef/user/smoke2/<id>_attack_frames.png`). The disappearing leg was
the old 20-frame stagger only: two lungers overlapping, the later-drawn pirate over the vampire. No real-battle drawing
changed; the loop now takes turns (`loop_staggered.png`; at most 1 lunger over 12 s, 111 fps).

#### EF-H amendment A: a tall frame for user sheets over the large cell (rev 2, 2026-11-25; fire_hydra first; Momus rev-1: REJECT, 4 blocking findings, 8 notes, applied; rev-2: OKAY, 5 notes applied)

**Why.** The user's fire_hydra render (`~/temp/fire_hydra_sprite_sheet.png`, 864x168, binary alpha, 34 colours, true
1-px detail, USER-APPROVED as is) splits into four pieces of native (split) heights idle 122 / attack 123 / hurt 134 /
kneel 82, widths 207 / 208 / 206 / 201 (feet row 153). The large frame (cell 128, feet row 122) gives a figure rows
2..122, 121 rows, so H1's `scale()` would shrink the sheet to s = 0.903 ("fit tallest") and re-pixelize it: the user's
1-px detail is lost. Target: native s = 1.0 at the default display scale 2 (the placed idle is 120 rows, 240 screen
px, as the house quantizer's outline rule trims edge px; today's scale-3 sheet 243). More user sheets over 120 px are
queued (white_dragon 144, blue_dragon 142, green_dragon 147, evil_eye 147; chimera 120 fits the large frame).

**What the code assumes per size (checked 2026-11-25).**
- *Data size and layout.* `enemies.yaml` `size` picks the layout class (`EnemyLayoutAi` ORDER / CAPACITY: a `huge`
  column holds one enemy; `TRAVEL_HOP[class]`); `layoutSizeOf` changes the class only for a tier scale (fractional over
  2) or a scale-3 `boss` (the titan rule). The box is the cell x the sheet scale; the feet sit on the box bottom
  (`AiEnemyView.ts:155`: y = feetY - (footRow + 1) x scale). Nothing reads the cell height as a class: fire_hydra stays
  data `huge`, so at scale 2 its class stays `huge`. Its real formations (gurgu-b3 / b4 / b5, 1-2 fire_hydra): two
  444 x 400 boxes + 24 gap = 912 x 400, inside ENEMY_AREA 1260 x 545 at pass 1.
- *Sheet loading and atlas.* `monster_anim.load_entries` crops by the json `grid`; `monster_atlas.sheet_meta` writes
  `cell` = the frame size and `footRow` = the json `bottom_row`; `kneelSink` is floaters only. Any cell works.
  `spec.MONSTER_BANDS` is also the Gemini request table (`MONSTER_GEOMS`, `generate.py`): the tall frame stays out.
- *Kneel.* `kneel_source_ai.ai_key` needs the key in the idle's cell size; the K checks read the json `foot_row` and
  the cell border; the bridge resizes by bbox. All per-cell.
- *Size-scaled defaults and tolerances read the cell height* (not the figure): `rig.py:106` part radius / width x
  h / 80; `monster_anim.py:256` the daze recipe's px factor k = int(h / 80 + 0.5) (3 at 200, 2 at 128: the generated,
  locked `daze` / `daze_b` cells sag 1.5x deeper; the game shows them only through `FRAME_FALLBACK` on a sheet without
  kneel cells, so not for fire_hydra); `anim_checks` `new_holes` reach 6h/80, `silhouette` tol 6 (h <= 128) / 10,
  `continuity` centroid floor 6h/80; `anim_efix.crease` ceil(5h/80); `kneel_checks` bridge tol as silhouette. At h 200
  these are the per-pose boss tier (cap 15.0, tol 10, crease 13) instead of the large tier (9.6, 6, 8); relative to
  the figure (about 0.6-0.67 of a 200-row cell against about 0.94 of the large cell) every gate is about 1.6x looser.
- *Atlas page budget.* The atlas has 30 pages, 18 of them extra (hi-res), and `monster_hires_pages.MAX_EXTRA_PAGES =
  18`, so it is at its cap. fire_hydra goes from 17 frames of 136 x 128 at tex 1 (nearest page) to 17 frames of
  444 x 400 texture px at tex 2 (about 3.0 M px, near a full 2048^2 linear page).

**Decisions.**
- **D-A1 the frame.** A user recipe of `size: large` is imported in the **tall frame** when its idle is above the large
  band (`idle > LARGE.height[1]` = 120) or its tallest pose is over `LARGE.foot_row - 1` = 121 rows (the rows a large
  cell gives the figure); both on the native (split) heights, before any quantizing. Tall frame: cell height 200, feet
  row 192 (the per-pose boss cell, `spec.BOSS_POSE_GEOM`: every tool already handles a 200-row cell and the 192 feet
  row), figure band (96, 184) for H1's scale rule (the large band's floor; 8 rows below the top for rig overshoot),
  minimum width 128 (the large cell; `place` widens it by its rule). Selection is automatic and recorded:
  `info["frame"]` is always `large` or `tall`; both approved jsons (`monster_large.json`, `kneel.json`) get
  `frame: tall` only for a tall import (a new optional approved-json key; no reader rejects unknown keys), so the four
  shipped jsons are unchanged. Not a new data size: `monsters.yaml` `size: large` and the sheet name `monster_large`
  stay, `enemies.yaml` `huge` stays, battle behaviour (class, capacity, hop, travel rules) is unchanged.
  New `gen/monster_user_frame.py`: `TALL = MonsterBand("tall", 200, (96, 184), 192)`, `MIN_W = 128`, and
  `frame_of(size: str, heights: list[int]) -> tuple[str, MonsterBand]`: a size other than `large` returns
  `(size, spec.MONSTER_BANDS[size])` unchanged (no tall variant of small); large returns `("tall", TALL)` by the rule
  above, else `("large", MONSTER_BANDS["large"])`.
- **D-A2 tolerances.** A tall sheet takes the tolerances and rig defaults of its 200-row cell, as every per-pose boss
  sheet does (hollow_seraph, idle 138 px in the same cell, is the precedent): no new knob. The rig sets its own part
  radii where the template's x2.5 radius over-grabs. **Made visible, not hidden:** `monster_user_frame.tier_report(sid)`
  (report-only, run by `python3 -I assets-src/gen/monster_user_frame.py tiers <id>`, so `monster_user.py` gains no
  command) recomputes, over exactly the frames, `monster_anim.SEQUENCES` steps and `span_of` pairs that
  `monster_check.check_sprite` feeds `continuity` (with its `continuity_share` and `ATTACK_SWAP_IOU` margin), every sequence step's
  `anim_checks.continuity(prev, next, span, 128, share, margin)` and every generated frame's
  `anim_checks.silhouette(..., cell_h=128, ...)` (the large tier) beside the cell's own result, and writes
  `~/temp/ff-game/ef/user/<id>/tier_report.json` plus a printed summary (steps and frames that pass at 200 but fail at
  128). Consequence: every such step / frame is named to the animation reviewer, who must look at it; a flagged one is
  tuned in the rig; one the rig cannot clear is listed in the result for the user's ruling. The result records the
  report's counts.
- **D-A3 fire_hydra's size and budget.** `monster_scale.yaml` `fire_hydra: {scale: 2, tex: 2, smooth: [despur,
  edges]}` replaces `{scale: 3, tex: 1, smooth: [despur]}` (the EF smoothing rule the user named for this sheet; despur
  re-checked on the spines and horn tips, dropped to `[edges]` if it breaks them). Box 444 x 400 screen px (today
  408 x 384). Budget: the rebuild reports the extra-page delta; `MAX_EXTRA_PAGES` is raised by exactly that delta
  (expected +1, at most +2; beyond that the work stops and is reported) with a comment citing the user's instruction
  (2026-11-25, fire_hydra at the EF smoothing rule), as ef-horse's +1; `MAX_GPU_BYTES` (8 x 16 MB) is not raised: the
  build's worst preload + formation (`check_budget`, which includes the 2-hydra gurgu formations) must stay under it,
  else the work stops and is reported. The queued 142-147 px sheets cost about one linear page each at tex 2 (noted for
  their own batches, not decided here).

**Import measures (prototype, tall frame, s = 1.0).** cw 222, anchors (bottom 6 rows) 95.6 / 90.4 / 92.3 / 102.2
aligned to the idle's (x 100.6); placed opaque rows idle 73-192 (120), attack 71-192 (122), hurt 60-192 (133), kneel
111-192 (82); columns 8-213 / 13-219 / 13-216 / 2-200 (border clear).

**Changes.**
- `gen/monster_user_frame.py` (new, < 150 lines): `TALL`, `MIN_W`, `frame_of`, `tier_report`.
- `monster_user.py` (249 lines, kept <= 250: the `cut` measures dict is built in one line less, nothing else moves; no
  new command): `cut` takes `(name, band) = frame_of(size, heights)`; `place` builds the
  cell `band.cell` rows high and `max(MIN_W, span + 4)` wide, even (for the large frame `MIN_W` = its cell: unchanged);
  `info["frame"] = name`.
- `monster_user_review.metas` and `review`: the band from `info["frame"]` (`grid [cw, band.cell]`, `bottom_row` /
  `foot_row` = its feet row, `frame: tall` when tall), not from `rec["size"]`.
- Docs: one line each in `AGENTS.md` (the monsters_ai row and the V4 text: 21 `huge` sheets at 3, fire_hydra at 2 in
  the tall frame), `gen/README.md` (the `frame: tall` json key) and `docs/NEW_MONSTER_GUIDE.md` (the tall frame and
  its tolerance tier).

**Tests (RED first, `selftest_monster_user.py`; the new import is wrapped `try: from gen import monster_user_frame
except ImportError: check(False, ...)`, since `selftest.py:527` runs the suite unguarded).**
1. `frame_of`: large [122, 123, 134, 82] -> tall; [112, 93, 115, 113] -> large; idle 120 / tallest 121 -> large; idle
   120 / tallest 122 -> tall; idle 121 / tallest 121 -> tall; small [70, 90, 60, 50] -> small with the small band.
2. A synthetic 4-pose row (idle 122, a 134 px pose): `cut` gives four 200-row frames, feet on row 192, s = 1.0,
   `info["frame"] == "tall"`, cw even and >= 128, 1-px border clear; the same row with idle 112 and every pose
   <= 121 px gives 128-row frames on row 122, `info["frame"] == "large"`.
3. `metas` of the tall cut: `grid[1] == 200`, `bottom_row == 192`, kneel `foot_row == 192`, both `frame == "tall"`;
   of a large cut: no `frame` key, `bottom_row == 122`; `approve` in the temp tree writes a 200-row kneel.png.
4. The four shipped user sheets re-import byte for byte (`check`) and their recomputed metas equal the committed jsons
   but for `approved`.
5. fire_hydra (after its recipe lands): `cut` -> tall, s = 1.0, cw 222, `check` byte-identical on both jsons.
6. `tier_report`'s comparison (`compare_step`) on a synthetic pair: the step's frames are the span's keys, 12 px apart
   (share 0.5 x 12 = 6 < 9.6, so the floor decides): passes at 200 (cap 15) and is listed as failing at 128 (cap 9.6).

**Pins that change (fire_hydra leaves the scale-3 set, stays data `huge`; only lists, counts and names move, no
tolerance or rule).**
- `tests/scenes/battle/EnemyLayoutAi.test.ts`: `TIER_H` drops fire_hydra ("the 23 rescaled sheets" -> 22; the 128-144
  px cell test -> 21 fixtures; the scale-3 set); new: fire_hydra `huge` at scale 2, layout class `huge`, box 444 x 400.
- `tests/scenes/battle/tierHTravel.test.ts`: `TIER_H` drops fire_hydra (22 -> 21, header comment); new case:
  fire_hydra alone and in its real 2-hydra formation, every sprite at whole-px positions, `screen[0] == 2`, every
  displayed frame's top >= `TRAVEL_CLEAR_Y`.
- `tests/scenes/bestiary/bestiaryCentre.test.ts`: `TIER_H` drops fire_hydra; new: fire_hydra at scale 2 centred
  within 1 px, `bound == []`, a full loop's right edge <= the inner right - 8.
- `tests/data/rosterData.test.ts:73-89`: the huge-at-3 rule gets a named exception list `EF_H_TALL = ['fire_hydra']`
  (scale 2), test name and comment updated; the count of huge enemies stays 22.
- `tests/data/efSizes.test.ts`: 47 -> 48 hi-res sheets, the comments.
- `assets-src/gen/selftest_pages.py` `run_scale`: fire_hydra moves out of `V4_RESCALED`, `EF_B2` and `EF_FALLBACK`
  into `EF_H`; hires 47 -> 48; the "23 V4 sheets" / "four fallback" messages and docstrings follow.
- Any golden layout case with fire_hydra is re-measured, never hand-edited.

**Then (the usual EF-H batch, one commit).** Recipe `fire_hydra` in `monster_user.yaml` (file
`user_art/fire_hydra/sheet_2026-11-25.png`, its sha256, tool ChatGPT (interactive), rendered 2026-11-25, refs = the
sha256s of `~/temp/ff-game/ef/user_packs2/fire_hydra/` `current_x2.png`, `poses_reference.png`, `prompt.txt`; a
`reserve` for the lava cracks, eyes and horns only if the colour error by region asks for it); review pages and a fresh
image-only fidelity reviewer; `retire.py fire_hydra` (-> `fire_hydra_v1`, the next free id) and `--move-rig`;
`monster_user.py approve fire_hydra`; a new three-head multi-head quadruped rig (`neck<i> / head<i> / snout<i>`,
`lead_heads`, translation-first per the guide) with `kneel: {source: ai}`, the kneel bridge, `tiers`, a fresh
image-only animation reviewer, lock; monsters.yaml brief, enemies.yaml description if it changes; a dev scenario
`ef_user_fire_hydra` (fire_hydra beside other enemies).

**Acceptance.** `selftest.py` ALL PASSED; `monster_anim.py check --all` only OK lines; `kneel_tools.py coverage` ai 123 /
ai 12; atlas rebuilt and committed, PYTHONHASHSEED 0 / 1 byte-identical; **by-rect against int-ef4**: every sheet's
frame pixels equal but fire_hydra's (page indices and rects may move with the repack), the preload page set's sheets
unchanged; budget as D-A3, with the build's printed hi-res report line (extra pages before / after, GPU worst MB and its
formation) recorded in the result; `npm run build`; `npm run test:fast`; browser `?mute=1&scenario=ef_user_fire_hydra&enemyAnim=loop`
with no console warnings, the hydras' feet on the plain (<= 770) and the cursor / damage numbers not floating over
the cell's empty top rows. `test:full` is the user's (combined batch).

#### EF-H amendment A result + batch 2: fire_hydra, fire_lizard, black_knight (2026-11-25, branch `ef-batch2`; no AI call)

- **Amendment A:** Momus rev 1 REJECT (4 blocking: the tierHTravel claim, rosterData, selftest_pages pins, the page
  budget; 8 notes), rev 2 OKAY (5 notes applied). `gen/monster_user_frame.py` (`TALL` 200 / feet 192, `MIN_W` 128,
  `frame_of`, `anchors`, `compare_step`, `tiers`); `monster_user.py` 250 lines; `selftest_monster_user_frame.py` (RED
  first: the import itself failed, then each of `frame_of` / tall cut / metas / tiers; registered from
  `run_monster_user`).
- **Found in review, fixed RED first:** (1) `pixelize.foreground(exact_key=True)` still ran the renders' blob filter on
  a 4x-reduced mask, which for figures over 200 px wide trimmed 247-348 outer px per pose (claw and horn tips; the
  fire_hydra fidelity reviewer's iteration 1); the user alpha is now the figure without it (the four shipped user
  sheets re-import byte for byte). (2) Recipe `anchor: {kneel: bbox}` (fire_lizard: the kneel's bottom rows are its
  draped tail, so the feet anchor pushed the cell to 260 px). (3) Reserve classes `red` (the lizard's crimson frill)
  and `ember` (the knight's visor).
- **Imports (s = 1.0, house palette, reserves):** fire_hydra tall frame, cell 224 x 200 (box 448 x 400 at 2; the
  prototype's 222 / 444 grew 2 px with the kept tips), heights 122 / 123 / 134 / 82, error mean 8.9 / max 30.3
  (before the edge fix 9.5 / 208.9), lava slots (816 px, mean 5.3; the yellow core was 46 off). fire_lizard large,
  224 x 128, heights 94 / 95 / 92 / 62 (outline closed by 1 px), mean 8.3 / max 37.1, frill slots (3108 px, mean 7.5;
  was 28 off); the kneel's belly sits 9 rows over the standing feet line (its tail tip on the ground). black_knight
  large, 128 x 128, heights 96 / 85 / 95 / 72, mean 12.2 / max 61.3 (visor 3 slots, mean 12.3; was grey, 143 off; the
  armour's darkest greys ink to the outline, the house rule).
- **Fidelity reviewers (fresh, image-only):** fire_hydra ITERATE-grade nit in it. 1 (the edge trim) -> SHIP at it. 2;
  fire_lizard SHIP WITH NITS -> SHIP at it. 2; black_knight SHIP WITH NITS (the visor's dark falloff thinner, the
  bronze trim duller, the darkest plate shading inked).
- **Approve / retire:** archives `fire_hydra_v1`, `fire_lizard_v1`, `black_knight_v2` (next free ids; RETIRED_SPRITES
  rows), `--move-rig` each; black_knight `size: large` in monsters.yaml and enemies.yaml (death_knight, 2.5 at 177.5
  px, is now smaller than black_knight's 188 px: a temporary inversion, death_knight is re-rendered later; the
  efSizes scale pin still holds).
- **Rigs (`kneel: {source: ai}`, locked 14 frames each):** fire_hydra three-head quadruped (FW-5 heads 2 / 3, lead 1),
  translation-first: the three heads and necks as one group (wind 4 back 1 up / 7 back 1 down, mid -3, follow +1,
  hurt_in1 -3 / -2, hurt_in2 +3 / +2, daze lifted 2 / 1 against the recipe's x3 slump), 1-7 px pockets inked
  (12 paint entries), bridge `{keep_top: 0.4}`; `tiers`: 16 steps, 9 frames, none passes at 200 but fails at 128
  (the first rig's daze bbox did; tuned). fire_lizard quadruped, head / jaw / frill as one group (wind 4 / 7 back),
  `atk_mid t: 0.0` (the feet lerp), bridge `{keep_bot: 0.3}`. black_knight the pirate's rigid lean (wind 5 / 10 deg),
  4 seam / pocket paints. Animation reviewers: all three SHIP WITH NITS in 2 iterations (it. 1: the weak wind-up,
  deepened; left: wind1 still close to the idle on the hydra, the jaw opens at wind2 on the lizard, 1-px stair steps
  of the knight's 10 deg lean, the kneel_in1 -> in2 pop at the bridge's 0.35 maximum).
- **Size:** `{scale: 2, tex: 2, smooth: [despur, edges]}` for all three (fire_hydra's scale-3 tex-1 entry, fire_lizard's
  tex-2 despur entry and black_knight's 2.5 entry replaced). Pins moved: selftest_pages (V4 22, B1 31, EF_H +3, hires
  48), efSizes (48, B1 31), rosterData (`EF_H_TALL`), EnemyLayoutAi (TIER_H, fire_hydra 448 x 400 huge, the tier-L
  set 20 with black_knight), tierHTravel and bestiaryCentre (fire_hydra's own scale-2 cases).
- **Gates:** atlas rebuilt (48 hi-res sheets on 21 hi-res pages, 31 pages, 19 extra: `MAX_EXTRA_PAGES` 18 -> 19 per
  D-A3; GPU preload + largest formation 89.8 MB of 128, clay_golem + king_mummy); by-rect vs int-ef4: frame pixels
  differ only for fire_hydra, fire_lizard, black_knight (17 frames each), 120 sheets equal (57 on another page),
  preload pages [0, 1, 2] unchanged; `check --all` 123 OK only; `kneel_tools.py coverage` ai 123 / ai 12; `npm run
  build` OK; `npm run test:fast` 430 files, 10269 passed; `selftest.py` ALL PASSED (1926 ok; its PYTHONHASHSEED 0 / 1
  atlas determinism included; `kneel_ai_thresholds.json` / `selftest_kneel_ai.EXCLUDED` drop black_knight, whose
  keyframe-painted hurt is retired); browser `?mute=1&scenario=ef_user_fire_hydra&enemyAnim=loop` (new:
  the three beside a goblin): feet on the plain, no console warnings or errors
  (`~/temp/ff-game/ef/user/smoke_batch2/`). `test:full` left for the combined batch.

#### EF-H amendment B: floating user sheets and six palette classes (rev 2, 2026-11-25; evil_eye first; Momus rev-1: REJECT, 2 blocking findings, 7 notes, applied; rev-2: OKAY, 4 notes applied)

**Why.** (1) The user's evil_eye render (`~/temp/evil_eye_sprite_sheet.png`, 944x184, binary alpha, 42 colours; idle
x55-185 h147 bottom row 167, attack x312-459 h150 bottom 167, hurt x494-625 h134 bottom 171, kneel x767-892 h132 bottom
169) is a floater: today's `approved/evil_eye/monster_large.json` has `floating: true`, its rig is `body: floating`
(`rig_floating.py`, the float band of `anim_feet.float_band`), and the atlas writes `kneelSink` for floaters with a kneel
key (`monster_atlas.py:238-244`). H1 puts every pose's lowest row on the feet row (`monster_user.place`: `ty =
band.foot_row - y1`), so a floater's hover gap, which the render draws per pose (167 / 167 / 171 / 169), would be lost
and the four poses would bob by their own heights. (2) EF-H batch 3 (this branch) added six reserve colour classes
RED first before this rule was stated to the agent; they are listed here for review.

**Decisions.**
- **D-B1 recipe key `floating: true`** (default false). A floating recipe is placed like `monster.cut` places a floating
  Gemini sheet (`monster.py:716-723`): one shared vertical offset `dy_shared = feet_row - idle_bottom` (the idle's
  lowest row on the feet row, as before), and every other pose keeps its vertical offset to the idle **as drawn in the
  render** (its sheet bottom row minus the idle's), for the attack and the hurt only; the **kneel's lowest row goes on
  the idle's** (the floating K-ground gate, `kneel_checks.ground`, needs the key's lowest row equal to the idle's; the
  sink is the runtime's `kneelSink`, as for every floater). A pose that would pass the 2 px bottom margin (`row >
  cell - 3`) is lifted to it (FW-C, at most `monster.LIFT_MAX`, else refused), the lift recorded in `info["lifted"]`;
  a lift that would start the pose above row 2 is refused as in `monster.cut` (`y0 + dy - over < 2`). For evil_eye in
  the tall frame (cell 200, feet 192): idle and attack on 192, hurt 196, kneel 192; no lift. A floating recipe needs
  s = 1.0 (the gaps are sheet rows; any other scale is refused). Only the vertical follows `monster.cut`: the
  horizontal placement is the user path's own, unchanged (re-centred on the anchors; the recipe can name `anchor:
  {<pose>: bbox}`, evil_eye takes bbox for attack, hurt and kneel, the feet anchor being meaningless for a floater).
  The frame choice (`frame_of`) is unchanged (evil_eye: 150 > 121 -> tall).
- **D-B2 jsons.** A floating import writes `floating: true` in `monster_large.json` (today's key, read by
  `monster_atlas.sheet_meta`, `monster_check` (float band), `monster_anim`); `kneel.json` stays as for the others (the
  kneel key on the idle's lowest row, D-B1; the kneel bridge and `kneelSink` read the rig). A non-floating recipe writes
  exactly what it writes today (`floating: false`), so the 14 shipped user sheets re-import byte for byte and their
  recomputed metas equal the committed jsons.
- **D-B3 where the code goes.** `monster_user.py` is at its 250-line ceiling: the per-pose vertical offsets are computed
  in `monster_user_frame.py` (`float_rows(img, cells, s, band, rec) -> list[int] | None`: None for a non-floating
  recipe; the floating, s == 1 and lift checks inside; the pieces' sheet bottoms from `monster_user_palette.origins` +
  the split masks); `cut` gains exactly one line (the call, folded into the `place` call's line budget) and `place`
  takes the rows as an optional argument (`ty = rows[k] - y1` when given), within the 120-character lines; any line
  over the 250 ceiling is paid by folding `cut`'s `regions` assignment into the `info` dict; `monster_user_review.metas`
  reads `rec.get("floating", False)`.
- **D-B4 palette classes (already in, RED first, `selftest_monster_user_frame._selects`).** `green` (olive scales:
  g >= r, g >= 1.4 b, g >= 50; chimera's dragon head), `taupe` (warm greys: r >= g >= b, r - b in [5, 40], r - g <= 25,
  r in [60, 170]; chimera's goat head), `cyan` (g >= 150, b >= 0.7 g, r <= 0.8 g; dark_fighter's shield glyph),
  `crimson` (r >= 30, blue 0.3-0.77 of red (r >= 1.3 b), b >= 1.3 g; death_knight's cloak), `glow` (g >= 180 and 30 over r and b;
  dragon_zombie's eyes), `pale` (every channel >= 120, spread <= 50; medusa's skin). Each is a pure per-px predicate
  used only by a recipe's `reserve` that names it; no shipped recipe changes. `pale` also matches light neutral greys
  and whites, so a recipe using it near teeth or tips names boxes (medusa: whole sheet, no teeth; evil_eye uses
  `bright` with boxes for its tips and teeth).

**Tests (RED first, `selftest_monster_user_frame.py`).**
1. A synthetic 4-pose row whose pieces' bottoms are 40 / 40 / 44 / 42 (sheet rows), recipe `floating: true`, tall
   frame: the four frames' lowest rows are 192 / 192 / 196 / 192 (the kneel on the idle's), `info["frame"] == "tall"`;
   the same row without `floating`: all four on 192; a floating recipe at s != 1 is refused.
2. A floating row whose hurt sits 8 rows below the idle in the tall cell (200: 192 + 8 = 200 > 197): lifted by 3 to
   row 197, `info["lifted"] == {"hurt": 3}`; a lift over `LIFT_MAX` is refused (SystemExit).
3. `metas` of a floating cut: `floating: true` in the monster json and `bottom_row` 192 (the atlas `footRow`); of a
   non-floating cut: `floating: false`.
4. `_shipped` loops over **every** `backend: user` json under `approved/*/monster_*.json` (14 before evil_eye): its
   recipe must exist (a missing one fails, never skips), the recomputed monster and kneel metas equal the committed
   jsons but for `approved`, the expected `frame` is the committed json's (`tall` or absent), and `U.check(meta) is
   None`.

**Then.** Recipe `evil_eye` (`floating: true`, `anchor: {attack: bbox, hurt: bbox, kneel: bbox}`, reserves for the green
iris (`green`) and the pale eyestalk tips and teeth (`bright`, with boxes)), the fidelity review (exactly five eyestalks in every pose), `retire.py`
(evil_eye_v1) and `--move-rig`, approve, a new `body: floating` rig with `kneel: {source: ai}`, the animation review,
lock; `monster_scale.yaml` `evil_eye: {scale: 2, tex: 2, smooth: [despur, edges]}` replacing `3`; data size `huge`
kept; the pins (`V4_RESCALED`, TIER_H lists, rosterData `EF_H_TALL`, efSizes, bestiary / travel cases) as for
fire_hydra in amendment A.

**Acceptance.** As amendment A's, plus: evil_eye's atlas sheet has `floating: true` and a `kneelSink`; the float band
check passes on every generated frame and `kneel_checks` (K-ground) on the key and every bridge frame; in the browser
the eye hovers (no frame's lowest row on the plain).

#### EF-H amendment C: the `navy` palette class (rev 1, 2026-11-25; white_dragon, king_mummy; Momus OKAY, 3 notes applied)

**Why.** The house palette merges the white_dragon's darkest blue shading (the outline-side scale tones (59, 80, 111) /
(47, 66, 96) / (37, 60, 95), 2,455 px) up onto one mid blue (82, 107, 140): errors 46 / 70 / 79, so the white figure's
dark side flattens toward its highlights (the user's point: keep the highlights distinct from the outline-side greys).
The king_mummy's blue headdress stripes ((57, 63, 136) / (84, 82, 123) / (65, 69, 130), 245 px) merge into one
(57, 57, 115): mean error 18.8, max 37.7. None of the amendment-B classes selects deep blues (`steel` needs a channel
>= 120, `grey` a spread <= 24, `cyan` green >= 150).

**Decision.** One more reserve colour class in `gen/monster_user_palette.SELECT`: `navy` = deep blue: blue >= red + 30,
blue >= green + 15, blue <= 140 (the white_dragon's pale blue scales, blue 147-255, the king_mummy's gold and bandage
greys, the outline ink and every non-blue tone stay out). A pure per-px predicate used only by a recipe `reserve` that
names it, as amendment B's six; no shipped recipe changes, so the 15 shipped user sheets re-import byte for byte
(`_shipped`).

**Tests (RED first, `selftest_monster_user_frame._selects`).** `navy` is true for (59, 80, 111), (47, 66, 96),
(37, 60, 95), (57, 63, 136), (84, 82, 123), (36, 38, 77) and false for (107, 149, 184), (120, 162, 195),
(237, 242, 250), (146, 106, 49), (128, 128, 128), (6, 4, 10), (87, 113, 147) (both edges pinned).

**Then.** The class selects every deep blue (white_dragon 4,638 px: the named three plus (80, 101, 133), (67, 92, 124),
(45, 78, 118); king_mummy 492 px), intended: the reserve's k-means splits them into its slots. white_dragon recipe
`reserve: [{name: shade, select: navy, slots: 4, max_err: 12}]`, king_mummy `reserve: [{name: gold, select: skin, slots:
2, max_err: 14}, {name: headdress, select: navy, slots: 2, max_err: 14}]`. Targets: each named white_dragon dark tone's
error <= 14 after the change; the king_mummy headdress blues' mean error under 10; the fidelity reviews as for the
others.

#### EF-H amendments B / C result + batch 3: thirteen user-rendered sheets (2026-11-25, branch `ef-batch3` from `ef-batch2`; no AI call)

chimera, buccaneer, blue_dragon, dark_fighter, death_knight, dragon_zombie, medusa, earth_medusa, green_dragon,
evil_eye, white_dragon, king_mummy, rakshasa: the user's ChatGPT renders (`~/temp/<id>_sprite_sheet.png`), tracked in
`gen/user_art/<id>/` with their sha256 and the reference pack's sha256s (`current_x2`, `poses_reference`, `prompt`,
`prompt_v1`) in `gen/monster_user.yaml`.

- **Amendment B** (Momus rev 1 REJECT, 2 blocking, 7 notes; rev 2 OKAY, 4 notes applied): recipe `floating: true`
  (`monster_user_frame.float_rows`; evil_eye: idle / attack on 192, hurt 196 as drawn, kneel 192; no lift), the six
  palette classes; `_shipped` now re-imports every `backend: user` sheet (18). **Amendment C** (Momus OKAY, 3 notes
  applied): `navy`. RED first in `selftest_monster_user_frame.py` (`_selects`, `_floating`, `_shipped`). Process note:
  amendment B's six classes were written (RED first) before the any-pipeline-change rule reached this branch and were
  reviewed after the fact in B; `navy` and floating were planned and OKAYed first.
- **Imports (s = 1.0; frame, cell; native heights idle / attack / hurt / kneel; colour error mean / max; reserves
  mean / max):** chimera tall 208x200, 120/103/126/92, 12.9 / 31.7, dragon 11.0 / 31.0, goat 11.5 / 27.7 (were 20.8 /
  20.4 with the two heads' hues swapped); buccaneer large 128, 84/82/87/64, 15.2 / 50.4 (no reserve: skin 4.1, stripes
  red 15.9 / white 3.7, axe 4.5); blue_dragon tall 236x200, 142/74/117/48, 9.5 / 79.5 (one 20 px highlight), crest 7.8 /
  28.2 (was 25.5); dark_fighter large, 73/73/69/55, 13.5 / 44.5, crescent 2.4 / 5.1 (was 26.0 / 54.2), the eyes' own
  slot 5.1; death_knight large, 97/96/97/78, 14.2 / 45.6, eyes 2.2 (was 114), skull 7.9, cloak 10.3; dragon_zombie tall
  210x200, 114/124/104/57, 11.6 / 48.7, eyes 7.2 (glow kept 0.94, was 0), bone 9.0; medusa large, 92/81/92/58, 12.6 /
  41.8, eyes 11.5, skin 3.4 (was 25); earth_medusa large, 92/77/86/55, 10.5 / 96.5, eyes 24.8 (the orange px 15.8, was
  138), stone 6.1; green_dragon tall 248x200, 147/124/128/74, 10.1 / 47.5, eyes 2.3 (was 44), belly 4.9; evil_eye tall
  154x200 floating, 147/150/134/132, 9.1 / 38.5, iris 8.0 (was 27-53), tips 4.7; white_dragon tall 238x200,
  144/136/122/52, 9.1 / 18.2, shade 5.8 (was 58.5 / 79.1); king_mummy large, 91/95/87/64, 11.7 / 42.4, gold 7.1,
  headdress 6.8 (was 18.8); rakshasa large, 92/81/89/64, 13.0 / 53.5, orange 5.9 (was 22.3), trim 12.0 (one 12 px gold
  highlight stays 53 off). The darkest shades ink to the outline (the house rule) everywhere.
- **Fidelity reviews (fresh, image-only):** blue_dragon SHIP; the other twelve SHIP WITH NITS in iteration 1. Design
  points confirmed: chimera three heads in every pose; buccaneer distinct from the pirate; dark_fighter's eyes and
  death_knight's skull + red eyes, dragon_zombie's bone white, medusa's and earth_medusa's snake heads visible at 1x;
  green_dragon two wings (no throat sacs: user ruling 2026-11-25, brief and description updated); **evil_eye has four
  eyestalks in every pose of the render** (consistent; the brief said five); king_mummy grander than the mummy. Nits:
  flatter dark folds (house ink), rakshasa's spread claws closed by the outline ring, earth_medusa's hair a step darker.
- **Approve / retire:** `<id>_v1` archives for all thirteen (RETIRED_SPRITES rows), `--move-rig`; buccaneer,
  dark_fighter, death_knight, medusa, earth_medusa, king_mummy, rakshasa `size: large`; chimera leaves FW-Q
  (`FWQ_ALLOW` 4 -> 3) and the kneel calibration's exclusions; the fix-pass fixtures that read chimera, king_mummy and
  earth_medusa (`selftest_fixmeasure`) run on the v1 archives, `selftest_keyoffset` on hydra.
- **Rigs (`kneel: {source: ai}`, locked 14 frames each):** bipeds (buccaneer, dark_fighter, death_knight, king_mummy,
  rakshasa) the pirate's rigid lean / shift about the hip (36 / 2 / 11 / 3 / 0 ink paints); quadrupeds translation-first
  (chimera three heads as one group, blue_dragon split head dip for the 142 -> 74 swing, dragon_zombie, green_dragon,
  white_dragon with the neck at half the head's move); medusa / earth_medusa `body: naga` over a pinned coil; evil_eye
  `body: floating` as one rigid mass. Animation reviews (fresh, image-only): every one SHIP WITH NITS (chimera,
  blue_dragon after one fix each; green_dragon after 4 iterations: belly-crack ink repainted, deeper wind-up, frill
  fragments rejoined). Shared nits: weak wind-ups and one-frame recover snaps (rigid leans cannot blend stances).
  `tiers` (report only; steps that pass at the 200-row cell but not at 128): chimera 3, blue_dragon 2, dragon_zombie 3,
  green_dragon 3, white_dragon 2, evil_eye 0: open for the user's ruling (D-A2).
- **Size:** `{scale: 2, tex: 2, smooth: [despur, edges]}` for all thirteen (despur kept: an image review found no eaten
  tip). Idle screen heights: chimera 244 (manticore 220), buccaneer 170, blue_dragon 288, dark_fighter 148,
  death_knight 196 (black_knight 192: the batch-2 inversion is gone), dragon_zombie 232, medusa 188 = earth_medusa 188,
  green_dragon 294, evil_eye 298, white_dragon 292, king_mummy 182 vs the mummy's 182.5 (equal, the orchestrator's
  ruling; efSizes compares a user render's sibling pair by screen height), rakshasa 186.
- **Budget:** `MAX_EXTRA_PAGES` 19 -> 22 (+3 for thirteen tex-2 sheets; open for the user's veto); 34 pages, 53 hi-res
  sheets on 25 hi-res pages; GPU preload + largest formation 93.0 MB of 128 (green_dragon + black_knight).
- **Gates:** atlas rebuilt and committed (34 pages); `selftest.py` ALL PASSED (1952 ok; its PYTHONHASHSEED 0 / 1 atlas
  determinism included); by-rect vs `ef-batch2`: frame pixels differ only for the thirteen (17 frames each), 110 sheets
  equal (25 on another page), preload pages [0, 1, 2] unchanged; `monster_anim.py check --all` 123 OK lines only;
  `kneel_tools.py coverage` ai 123 / ai 12; `monster_user.py check` byte-identical for all thirteen; `npm run build` OK;
  `npm run test:fast` 430 files, 10282 passed; browser `?mute=1&scenario=ef_user_batch3_beasts | _beasts2 | _fighters |
  _fighters2&enemyAnim=loop` (new; death_knight beside black_knight, king_mummy beside the mummy, evil_eye hovering): no
  console warnings or errors (`~/temp/ff-game/ef/user/smoke_batch3/`). `test:full` is the user's.

## EF-I. Review tool: the dazed GIF shows the kneel track (rev 2, 2026-11-25; user-approved task; Momus rev-1: REJECT, 10 findings, applied; rev-2: OKAY, 3 notes applied)

**Why.** `monster_anim.py review <id>` writes `<id>_daze.{gif,png}` from `monster_review.TIMELINES["daze"]`
(`monster_review.py:22`: idle 24, daze 48, daze_b 48, daze 48, daze_b 48), the hurt_in1-derived slump of ENEMY_ANIM
item 5a. Since pass KT3 the game never shows that for sleep / stun / poison: `EnemyPoseController` (`kneels`: posture
`daze` or `kneel`) runs a `KneelTrack` (`kneelChoreography.ts`) on the AI kneel cells, and `daze` / `daze_b` appear
only through `FRAME_FALLBACK` on a sheet without kneel cells (D-K7: kneel -> daze, kneel_b -> daze_b, kneel_in2 ->
daze, kneel_in1 -> idle). The user reviewed `vampire_lord_daze.gif` and concluded the kneel was unused.

**Change (review output only; no rig, recipe, lock, atlas or runtime change).**
- One Python copy of the runtime track, in `gen/monster_recipes.py` beside `KNEEL_FRAMES`: `KNEEL_IN_FRAMES` 8,
  `KNEEL_OUT_FRAMES` 6, `KNEEL_PERIOD` 48, `KNEEL_PHASE` 17, and the derived `KNEEL_IN` = ((kneel_in1, 4),
  (kneel_in2, 4)), `KNEEL_OUT` = ((kneel_in2, 3), (kneel_in1, 3)) (the splits at `/ 2`, as `KneelTrack.frame`).
  `kneel_review.py` drops its own copy (`:32-34`) and imports these names from `monster_recipes`.
- `TIMELINES["daze"]` becomes the case the GIF shows, an idle enemy put to sleep mid-battle and woken while idle
  (`setPosture` -> `syncKneel` -> `track.set(on, clock)` without `hold`, `EnemyPoseController.ts:55-72`): idle 24,
  `KNEEL_IN`, the hold kneel 48, kneel_b 48, kneel 48, kneel_b 48 (two full periods), `KNEEL_OUT`, idle 24; built from
  the constants (`kneel_timeline()` in `monster_review.py`), never typed. The hold reads the absolute clock
  (`floor((clock + index x 17) / 48) % 2`, `kneelChoreography.ts:94`), so in game the first hold frame (kneel or
  kneel_b) and the first period's length vary per actor and clock; the GIF shows the boundary-aligned case of index 0.
  The runtime cases the GIF does not show are written in the module docstring beside the timeline:
  (a) an enemy asleep at battle start snaps straight into the hold, no `in` (`BattleDisplayManager.ts:196`
  `snapKneel`); (b) a sleeper woken by its own turn plays no `out`: the action cuts the kneel and shows the rise
  kneel_in2 3, kneel_in1 3 inside the attack (`EnemyPoseController.ts:89-92, 203`); (c) a poisoned enemy (posture
  `kneel`) rises to act every turn and goes through `in` again after the action.
- File names stay `<id>_daze.gif` / `<id>_daze.png` (the posture is still `daze` in status-visuals.yaml and the
  user's review vocabulary); the PNG strip shows the unique frames idle, kneel_in1, kneel_in2, kneel, kneel_b.
- Fallback as the runtime: every name goes through the existing `get` = `MA.resolve` over `monster_recipes.FALLBACK`,
  whose four kneel entries `selftest_kneel` (`:155-159`) already pins to TS `FRAME_FALLBACK`.
- **The legacy strip: renamed, PNG only.** `<id>_daze_legacy.png` (idle, daze, daze_b; no GIF). Kept because
  `daze` / `daze_b` are still generated, locked (`check --all`), continuity-checked (`SEQUENCES["daze"]`,
  `monster_recipes.py:44`) and are what an unopted sheet plays, so a re-lock after a rig edit must be able to see them.
  No GIF and a new name, because a GIF with an in-game-looking timeline is what misled the review. No other tool reads
  `TIMELINES` or `_daze.*`.
- The onion strip and `_stage.png` order (`monster_review.py:124-125`) take `SEQUENCES["kneel"]` (idle, kneel_in1,
  kneel_in2, kneel, kneel_b) in place of `SEQUENCES["daze"]`.
- `gen/README.md:199`: the `review` line names `_daze.gif` (the kneel track) and `_daze_legacy.png`.
- Out of scope: a floater's `kneelSink` offset and a kneeler's hit shake (the other review GIFs draw no bob either;
  `kneel_review.py` / `kneel_bridge_review.py` remain the kneel-specific tools).

**Files.** `assets-src/gen/monster_recipes.py` (constants), `monster_review.py` (timeline, legacy strip, onion /
stage order, docstring), `kneel_review.py` (imports), new `selftest_review_daze.py`, `selftest.py` (one line,
registered in `test_monster_anim` right after the pass-KT kneel-bridge line, `:530`, in the same `__import__` style,
so `--anim` runs it), `gen/README.md`. Every touched Python file but `selftest.py` (already 555) stays under 250 lines.

**Tests (RED first).** `selftest_review_daze.run_review_daze(check)`:
1. parses `src/scenes/battle/kneelChoreography.ts` for `KNEEL_IN_FRAMES`, `KNEEL_OUT_FRAMES`, `KNEEL_PERIOD`,
   `KNEEL_PHASE` and checks they equal the Python constants; checks the source still has the `frame()` branches
   `e < KNEEL_IN_FRAMES / 2 ? 'kneel_in1' : 'kneel_in2'`, `e < KNEEL_OUT_FRAMES / 2 ? 'kneel_in2' : 'kneel_in1'` and
   `% 2 === 0 ? 'kneel' : 'kneel_b'` (a TS change fails the selftest);
2. derives the track from the TS numbers alone (idle 24, in1 IN/2, in2 IN/2, kneel P, kneel_b P, kneel P, kneel_b P,
   in2 OUT/2, in1 OUT/2, idle 24) and checks `monster_review.TIMELINES["daze"]` equals it; `kneel_review.KNEEL_IN` /
   `KNEEL_OUT` are the `monster_recipes` tuples (`is`), and `kneel_review.py`'s source has no `KNEEL_PERIOD ... = 48`
   or `KNEEL_IN = ((` assignment (it imports them);
3. `review("goblin", out=tmp)` (goblin: rigged, AI kneel): `goblin_daze.gif` read back has 10 frames, durations
   `10 * (round(n x 1000 / 60) // 10)` per track entry (GIF centiseconds, Pillow truncates), and each frame
   (`.convert("RGB")`) pixel-equal to the frame composed as the tool composes it from the generated cell of that
   track name (so the hold frames are the kneel / kneel_b cells, not daze); `goblin_daze_legacy.png` exists and
   `goblin_daze_legacy.gif` does not; the old daze timeline's frame (daze cell) is not among the GIF's frames;
4. a pure helper `daze_names(have) -> list[str]` (the resolved name per track entry) is pinned to literals: with the
   goblin's full frame set it is the track names unchanged; with `{idle, attack, hurt, hurt_in1, daze, daze_b}` (an
   unopted rigged sheet) it is idle, idle, daze, daze, daze_b, daze, daze_b, daze, idle, idle; with
   `{idle, attack, hurt}` (no rig) every entry is idle; and `review()` really uses it: with `daze_names` patched to
   all-idle, goblin's daze GIF reads back as one frame (Pillow merges identical consecutive frames, so a GIF of an
   unopted sheet has fewer frames than the track; the docstring says so).
Unchanged: `monster_anim.py check --all` output byte-identical to the run before the change; no lock or atlas file in
`git status`.

**Acceptance.** `python3 -I assets-src/gen/selftest.py --anim` ALL PASSED; `check --all` identical; `npm run build`,
`npm run test:fast` pass. The user's vampire_lord sheet (`monster_large`, EF-H) is on `ef-pv`, not on mainline
(mainline has the Roster-D `monster_small`), so the render is goblin and dark_wizard into
`~/temp/ff-game/ef/review_daze/`, with the pass rule: each `_daze.gif` frame, downscaled by 4 and cropped at x = L
(the canvas is w + 2L on (60, 60, 70)), is pixel-equal to its track cell (kneel_in1 / kneel_in2 / kneel / kneel_b,
idle) composited on the same background; the vampire_lord `anim_v2/` render
follows once `ef-pv` and this branch meet.

#### EF-I result (2026-11-25, branch `ef-review-daze`)

- `monster_review.TIMELINES["daze"]` = `kneel_timeline()` (idle 24, kneel_in1 4, kneel_in2 4, kneel / kneel_b 48 x 2,
  kneel_in2 3, kneel_in1 3, idle 24) from the one Python copy in `monster_recipes` (`KNEEL_IN_FRAMES`,
  `KNEEL_OUT_FRAMES`, `KNEEL_PERIOD`, `KNEEL_PHASE`, `KNEEL_IN`, `KNEEL_OUT`; `kneel_review.py` imports them);
  `daze_names` resolves the track along FALLBACK, `gif_frame` composes a GIF frame; `<id>_daze_legacy.png` holds
  idle / daze / daze_b; the onion and stage take `SEQUENCES["kneel"]`.
- `selftest_review_daze.py` RED first (12 of 19 failed before the change), then green; `selftest.py --anim` ALL PASSED;
  `monster_anim.py check --all` output byte-identical (123 OK lines); `npm run build` OK; `npm run test:fast` 430
  files, 10262 tests passed. No lock, atlas or runtime file changed.
- Renders: goblin and dark_wizard in `~/temp/ff-game/ef/review_daze/<id>/`; every `_daze.gif` frame (1/4, cropped at
  x = L) is pixel-equal to its kneel / idle cell on (60, 60, 70). vampire_lord's `anim_v2/` waits for `ef-pv`.

## EF-J. Chaos: the orbs fall when he kneels (rev 2, 2026-11-25; Momus rev-1: 5 blocking findings, 7 notes, addressed; rev-2 OKAY, 2 notes applied)

User request (approved): in Chaos's dazed kneel the four element orbs stay floating by his head (the AI key
`approved/chaos/kneel.png` draws them there and the bridge copies them), which reads wrong while he stays down. In the
kneel **hold** (`kneel` key cell and `kneel_b`) the four orbs rest on the ground beside him; in `kneel_in1` /
`kneel_in2` they are part-way down, so the out (kneel_in2 then kneel_in1, `kneelChoreography.ts`) shows them rising
back. No AI image call; numpy / Pillow only (no scipy: it is not importable here; pieces by `gen.pixelize.components`,
4-connected); attack, cast, hurt, idle and the orbit frames unchanged; no runtime change.

- **Measured facts (2026-11-25, chaos cell 200 x 200, feet row 192).** Idle orbs = EF-D's `orbit.parts` masks
  (white 16 x 16, pale 15 x 15, teal 14 x 15, ember 16 x 16; bottom-centres (72.5, 48), (100, 20), (120.5, 28),
  (127.5, 48)). In the AI key the orbs are smaller and placed differently: white 121 px x 94-106 y 64-77, teal 105 px
  x 137-149 y 59-71, ember 135 px x 136-149 y 83-97 (each its own piece), pale 142 px x 122-136 y 49-62 (it touches
  the flame). Key opaque rows 49-192 (59-192 without the orbs); idle 6-192 (14-192 without). The key's hem spans
  x 28-171 at row 186, 27-173 at 187, 28-174 at 188, 47-154 at 190 (row 192: 4 px, x 82-95); the free ground is
  x 1-26 (left) and 175-198 (right).
- **Cut (where the orbs come from).** Every frame draws each orb with the pixels of **its own bridge source**:
  `kneel_in1` (drawn from the idle) with the idle orbs, `kneel_in2`, `kneel`, `kneel_b` (drawn from the key) with the
  key orbs. Idle masks: EF-D's `orbit.parts` unchanged (`monster_orbit._orb_masks`). Key masks: a new list
  `kneel_orbs.parts` in the key's coordinates: a circle `at` / `r`, optionally `colors` (as EF-D) and `piece: true`
  (the circle is also limited to the 4-connected piece of the key holding the most of the circle's opaque px, so a
  circle never takes a flame px beside a free orb; no rounding of `at` involved):
  white `{at: [100, 70.5], r: 9.5, piece: true}`, pale `{at: [129, 55], r: 8, colors: [[6, 4, 10], [82, 132, 140],
  [41, 41, 49], [24, 0, 33], [231, 239, 222], [148, 140, 132], [24, 24, 33]]}` (the circle's 8th colour, the flame's
  (140, 99, 74), 1 px, is left out), teal `{at: [143, 65], r: 9.5, piece: true}`, ember `{at: [142.5, 90], r: 9.5,
  piece: true}` (measured: 121 / 142 / 105 / 135 px, the free orbs exactly their pieces). The holes:
  `monster_orbit.clean` (EF-D's seal: a cut px 4-next to a kept non-outline px becomes outline ink), 13 px sealed in
  the idle (EF-D's own), 3 px in the key; the clean key and the clean idle are each **one piece** (no orphan outline
  dots, checked).
- **Pipeline (a rig option alongside `orbit`, applied with the kneel bridge).** New module `gen/kneel_orbs.py`
  (< 250 lines; it also holds the new checks, so `kneel_checks.py`, 228 lines, grows by a few lines only) and a
  top-level rig block in `gen/anim/monsters/chaos.yaml`:
  ```yaml
  kneel_orbs:
    fall: [0.3, 0.72]        # share of the way down in kneel_in1 / kneel_in2 (0 < f1 < f2 < 1): an accelerating fall
    rest: {white: 11, pale: 27, teal: 170, ember: 186}   # ground spot: the orb's bottom-centre x; its bottom on the feet row
    shadow: true             # a 1 px contact line in (41, 41, 49), already in chaos's palette (idle, attack, kneel)
    parts: {...}             # the key masks above
  ```
  Validation (`kneel_orbs.cfg`, ValueError naming the rig): needs `orbit` with the same four orb names and
  `kneel: {source: ai}`; `fall` two values strictly increasing in (0, 1); every orb's spot inside the cell clear of its
  1 px border in every frame (the key orbs' hold spots at `ai_key`, the idle orbs' in1 and the key orbs' in2 spots at
  `bridge_frames`). A rig with `kneel_orbs` but no `orbit` raises; a rig with neither is untouched.
  **The raw key.** `kneel_source_ai.raw_key(sid, cfg, kfs)` = today's `ai_key` body (load, offset, paint);
  `ai_key` = `kneel_orbs.rest_key(raw_key(...))` when the block is set (the clean key with the key orbs on their spots),
  else `raw_key` unchanged. `ai_key` runs at `load_entries` (`kneel.add_key`), so `kfs["kneel"]` is the moved key;
  `bridge_frames` therefore never reads `kfs["kneel"]` for the bridge but calls `raw_key` itself, cuts it and the idle,
  runs `kneel_bridge.frames(clean idle, clean raw key, ...)` (the bridge squashes / stretches the body only) and pastes
  the orbs: in1 the idle orbs, in2 / kneel_b the key orbs. An orb moves by whole px, its pixels unchanged (no scaling).
  Position of an orb in a frame: its source bottom-centre B_src (mask bbox x centre, lowest row) moved f of the way to
  the ground spot G = (rest x, 192), f = fall[0] (in1), fall[1] (in2), 1 (kneel, kneel_b); x rounded half up, y
  rounded. Orbs are drawn in front of the body (on the ground they lie in front of the hem's flared tail; mid-fall
  they pass in front of the arms). The shadow: row 192 from the orb's xmin + 2 to xmax - 2 where the orb draws
  nothing. The resulting spots (prototype): in1 bottoms at rows 91 / 72 / 77 / 91 (white / pale / teal / ember), in2
  at 160 / 156 / 158 / 165, the hold at 192 with x spans white 5-17, pale 20-34, teal 164-176, ember 180-193. Bottom
  rows per orb run source -> in1 -> in2 -> 192 strictly downward and x moves monotonically toward its spot, so the out
  plays the same path upward. `kneel_b` (the key's breath) keeps the orbs exactly where `kneel` has them.
  **Frame entries.** The three bridge entries gain `kneel_orbs: {drawn: bool mask of the orb + shadow px, clean: the
  frame before the orbs were pasted, clean_src: the clean source (idle or raw key), orbs: {name: {d, size, bottom}}}`;
  the `kf:kneel` key's same record is rebuilt by `kneel_orbs.key_info(sid, cfg, kfs)` (recomputed from `raw_key`, it
  is not in `gen`).
- **Checks.** Every existing check applies to the four frames: alpha, palette lock, magenta, clipping / K-fit (no px
  below row 192, none on the border), K-ground (lowest opaque row 192; in1 keeps the contact-share rule), K-order
  (heights idle 187, in1 163, in2 150, key 134: monotonic), K-anchor, the bridge frame rules (bridge_holes, area
  0.85-1.15 of the resized source, bbox height within 10 of the lerp: in1 163 vs 168.5, in2 150 vs 152.5,
  outline_kept), `sequence:kneel` with the bridge swap cap 0.65 unchanged (no new allowance). **One named exception:**
  the bridge `detached` rule (pieces <= the source's) cannot hold when an orb is mid-air in in2 but merged with the hem
  in the key, so `monster_check.frame_checks` passes the entry's `kneel_orbs` record to `KC.bridge_frame` (new optional
  argument), which then runs `kneel_orbs.detached(a, rec)` instead of `C.detached(a, S)`: pieces of the frame with the
  drawn orb px removed <= pieces of `clean_src`, plus at most 4 orb pieces, and no new piece under MIN_PIECE (every
  other sprite: the argument is None, unchanged). New `kneel_orbs.frame_checks(name, a, rec)`, called from
  `monster_check.frame_checks`' bridge branch for the three frames and from `KC.ai_checks` for `kf:kneel` (record
  from `key_info`): each orb's drawn px equal its source px translated (pixel-exact); in the hold each orb's lowest row
  is 192 and at most 35 % of its px cover a clean-body px; no two orbs overlap; the frame with the orb and shadow px
  reverted equals `clean`. If an existing check (holes, area, outline, centroid) fails, the spot or fall share is
  tuned, never the check; the figures (area ratios, hole counts, cover shares) are recorded in the result.
- **Known pop (accepted, as EF-D's).** The out ends on `kneel_in1` with the idle orbs 30 % of the way down, then the
  idle shows `idle_o<k>` at the current orbit step, so the orbs finish their rise in one jump of about 30-45 px. The
  in has the same jump in reverse (orbit step -> in1). The reviewer is told.
- **Locks.** Only chaos's `kf:kneel`, `kneel_in1`, `kneel_in2`, `kneel_b` change (re-locked after the image review);
  every other chaos frame and every other sheet is byte-identical (selftest asserts it for chaos; `check --all` for
  the rest). `kneel_tools.py coverage` stays ai 123 / ai 12. The atlas binaries are not committed (integrator).
- **Tests (RED first).** New `gen/selftest_kneel_orbs.py`, run from `selftest.py` (test_monster_anim, also `--anim`).
  Variant entries: each rig variant rebuilds its own `kneel` key with the add_key step itself,
  `kneel_source_ai.ai_key(sid, variant, kfs)` (it reads only `approved/chaos/kneel.png` and the entry's idle; chaos's
  `paint` touches no kneel or idle cell), over the loaded entry, then `MA.generate(sid, variant, ...)`.
  Asserts: only chaos's rig has `kneel_orbs`; RED: the variant without the block has an orb-coloured px above row 100
  in `kneel` / `kneel_b` and no orb on row 192 (the current state; the suite fails before the code exists); with it:
  the four orbs' bottoms on row 192 in kneel / kneel_b, strictly falling bottoms source -> in1 -> in2 -> 192,
  pixel-exact orbs, clean key / idle one piece with no px left inside the cut masks but seal ink, every non-kneel
  chaos frame byte-equal with and without the block, `MC.check_sprite` and the K checks all OK. Mutations, each RED
  at its stage: at `add_key` (ValueError) a rest spot off the cell, orb names not matching `orbit`, `fall` not
  increasing in (0, 1), the block without `kneel: {source: ai}` or without `orbit`; at the checks an orb moved onto
  the body (cover cap), a body px changed (clean-frame rule), a split-off piece under MIN_PIECE (detached). EF-D's
  `selftest_orbit.py` builds its `plain` rig without both `orbit` and `kneel_orbs` (else the new validation raises),
  and its "every other chaos frame equal" check then compares the kneel frames of two rigs that both lack
  `kneel_orbs` (touched file).
- **Acceptance.** Review files in `~/temp/ff-game/ef/chaos_kneel/`: the 4 kneel frames (in1, in2, kneel, kneel_b) at
  x4 in a strip, the in / hold / out GIF at game timing (`kneelChoreography.ts`: in1 4, in2 4, the hold alternating
  kneel / kneel_b every 48, out in2 3, in1 3, then the idle), and a full-size before / after comparison. One fresh
  image-only reviewer (`NEW_MONSTER_GUIDE.md` 3.4; criteria: the orbs clearly fall and rest on the ground beside him,
  read as the same four orbs, no holes where they were, nothing clipped, the rise reads in reverse) -> SHIP, at most 3
  iterations; after a third non-SHIP the work stops and is reported to the user with the reviewer's findings. Gates:
  `selftest.py --anim` (worktree, gen/refs and gen/cache copied from the main checkout with `/bin/cp -c`),
  `monster_anim.py check --all` (only OK), `kneel_tools.py coverage` unchanged, `npm run build`, `npm run test:fast`.
  Browser (Chaos is immune to status, so the dev preview): `?mute=1&scenario=chaos_forms&kneel=on&poseLabel=1`
  (`kneelPreview.ts`; F1 is the atlas sheet) with a built atlas in the worktree, screenshot of Chaos in the hold
  (label `kneel` or `kneel_b`) with the four orbs on the ground; the built atlas is then restored.

### EF-J result (2026-11-25)

- **Tuned values (the plan's "tune the spot, not the check"):** `fall: [0.5, 0.9]` (was 0.3 / 0.72), `rest: {white: 10,
  pale: 26, teal: 172, ember: 187}` (was 11 / 27 / 170 / 186). Why: at 0.72 kneel_in2's opaque area was 1.22 of the
  resized source (the bridge area rule, 0.85-1.15; the key's bbox widens with the orbs on the ground), at 0.85 1.16, at
  0.9 inside; teal at 170 covered 36 % body px (cap 35 %); the reviewer's iteration 1 nit (the fall uneven: in1 barely
  down) moved in1 to 0.5; iteration 3 gave the left pair and the orange orb 1 px more room. Orb bottoms per frame
  (white / pale / teal / ember): source idle 48 / 20 / 28 / 48, in1 120 / 106 / 110 / 120, key 77 / 62 / 71 / 97, in2
  181 / 179 / 180 / 183, hold 192 (x spans 4-16, 19-33, 166-178, 181-194). In kneel_in1 the orbs pass in front of his
  forearms (as designed).
- **One deviation from the plan text:** the `detached` exception counts the body as the **clean bridge frame** (before
  the orbs are pasted), not "the frame minus the drawn orb px": at in1 the orbs are in front of the forearms, and
  removing their px cut the hands off into 3 extra pieces. Rule now: pieces(clean frame) <= pieces(clean source),
  pieces(frame) <= that + 4 orbs, no new piece under MIN_PIECE (the speck mutation stays RED). The selftest's variant
  entry uses `ai_key(sid, variant, kfs)` (the add_key step itself), as rev 2 notes.
- **Review:** one fresh image-only reviewer, 3 iterations: SHIP WITH NITS (uneven fall), SHIP WITH NITS (orbs over the
  forearms in in1; edge spacing), SHIP (left: the inner orbs touch the hem tips, cosmetic). Files:
  `~/temp/ff-game/ef/chaos_kneel/r1..r3/` (strip x4, before / after x2 and 1x, game-timing GIF, slow GIF).
- **Locks:** `chaos.lock.json` only `kf:kneel`, `kneel_b`, `kneel_in1`, `kneel_in2` changed (the other 47 of 51 entries equal).
- **Gates:** `selftest.py --anim` ALL PASSED (worktree, gen/refs, gen/cache and gen/out/hr cloned from the main checkout); `monster_anim.py check --all` 123 OK lines only; `kneel_tools.py coverage` ai 123 / ai 12; `npm run build` OK; `npm run test:fast` passed. Browser `?mute=1&scenario=chaos_forms&kneel=on&poseLabel=1` on a worktree atlas build (only `monsters-ai-5.png` changed, restored, not committed): Chaos in `kneel_b` with the four orbs on the ground, no console warnings.

#### Integrator gates (int-ef4: ef-pv, ef-review-daze, ef-chaos-kneel; 2026-11-25)

Merges: ef-pv fast-forward; ef-review-daze conflict in this file only (both kept); ef-chaos-kneel conflicts in this
file and `monster_check.py` (kept both: EF-J's `kneel_orbs` argument to `bridge_frame` and EF-H's
`MAGENTA_ART` per character). Atlas rebuilt and committed (30 pages, 47 hi-res sheets, preload + largest formation
90.4 MB, max 128); PYTHONHASHSEED 0 / 1 byte-identical (31 files); by-rect vs mainline: chaos 4 kneel frames, pirate,
vampire, vampire_lord 17 each, 119 sheets same; `monster_anim.py check --all` 123 OK lines only; `selftest.py` ALL
PASSED (1909 ok); `kneel_tools.py coverage` ai 123 / ai 12; `npm run build` OK; `npm run test:fast` 430 files, 10266
passed; `test:full` left for the combined batch (user instruction). `review` of vampire_lord, pirate, vampire into
`~/temp/ff-game/ef/user/<id>/anim_v2/`: the daze GIF plays idle, kneel_in1, kneel_in2, kneel / kneel_b x2, out.
Browser (`?mute=1`): `ef_user_pirate_vampire&enemyAnim=loop` one lunger at a time; `chaos_forms&kneel=on` the four
orbs on the ground; no console warnings or errors (`~/temp/ff-game/ef/int4/`).

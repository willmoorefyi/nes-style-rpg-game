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

# Enemy (monster) battle animation plan: cut-out in-betweens for every monster sprite

Status: plan only, nothing implemented (2026-11-14). Branch `r-integration`.
Goal: the party already has extra "enhanced animation" frames (`gen/puppet.py` + `gen/anim/<class>.yaml`: 8 in-betweens per
class). This plan extends the same idea to the monster sprites:
- a 6-pose attack,
- two or more poses between idle and hurt, both into the hurt pose and back out of it,
- cast in-betweens for the bosses,
- a cheap breathing idle frame.

The work is prototyped on the goblin until it looks right. It is then rolled out to every monster and ends with an
adversarial play test for graphical artifacts.

Hard constraints carried over (AGENTS.md, `assets-src/gen/README.md`, memory):
- **Style lock.** Approved sheets under `assets-src/gen/approved/` are never modified. Every new frame is derived at
  build time from approved pixels. Review fixes are build-time patches stored in the rig file, the same way as
  `face_fix` and kit `paint`.
- **No AI by default.** Bedrock/Stability in-betweens were tried and rejected on 2026-11-13 (no identity lock, img2img
  redraws the whole figure, inpainting comes back grey). Gemini spend is 26 of 100 images. The plan needs **0 paid
  images**. The only paid path is a gated fallback (section 9).
- Browser tests always use `&mute=1`.
- Data stays in YAML or data tables, not in hardcoded TypeScript logic.
- No `as any`, no `@ts-ignore`, no silent catches.
- Source files stay under about 250 lines.

---

## 1. What exists today (verified in this worktree)

| Area | State |
|------|-------|
| Approved monster art | `approved/<id>/monster_<size>.png`: 3 cells `idle | attack | hurt`, one row. Sizes: goblin, pirate, skeleton, mummy and vampire 80x80; cockatrice 84x80; wolf 110x80; ogre, troll and dragon 128x128. Bosses garland and lich use one 200x200 file per pose, `boss_{idle,attack,hurt,cast}.png`. All keyframes have binary alpha, at most 16 colours per file, feet exactly on `bottom_row` (76 / 122 / 192), no opaque pixel on the cell border, and **face right** (toward the party). |
| Variants | `gr_imp` (goblin, hue -95) and `gr_wolf` (wolf, hue/sat/val) are recoloured at build time by `monster.recolor()` from the base sprite's frames. They have no art of their own. |
| Build | `build_assets.py::build_monsters_ai` writes one row per sprite into `assets/sprites/monsters-ai.png` at 2x (1600x3008 today). `monsters-ai.json` has `{scale, sheets: {id: {cell, footRow, floating, frames: {idle, attack, hurt[, cast]}: [x, y]}}}`. |
| Party puppet | `gen/puppet.py`: humanoid joint set (16 joints + weapon `tip`), segmentation by nearest bone, rigid re-pose with `np.rint` nearest sampling, seam-only outline repair, `check()` (outline ring, pixel ratio 0.88-1.12, height ±4, at most 2 pieces), `review` contact sheet + GIFs. It assumes 80x80 cells and figures facing **left**. `field_ai` calls `load_cfg(<field id>)` for every field sprite, and `review` globs `anim/*.yaml`. |
| Runtime | `EnemyPoseController` (pure): `attack` = lunge 24 px over 6 frames, hold 8, back 6, shown in the single `attack` texture; `hurt` = 18 frames of ±4 px shake on `hurt`; `cast` = 24 frames, rising 6 px (attack texture when there is no cast frame); `dying` holds `hurt`. `AiEnemyView.update` sets `sprite.texture = f[pose]` and the offset. `BattleArt.getMonsterFrames` slices 4 textures. `BattleAnimationController` resolves the action when `attackOutDone` is true, plays hurt from `reactEnemy` and `freezeDying` on a lethal hit, and `round_end` waits for `isAttacking`. `BattleEffects` element flashes follow the sprite's texture and position. The dying fade lasts 30 frames. |
| Party sequencing (model to copy) | `attackChoreography.ts`: pure frame tables (`advanceAt`, `returnAt`, `castAt`, `castReturnAt`, `idlePose` with period 72 and phase `member*17`), applied by `BattleDisplayManager.setActorPose` / `poseFor`. |
| Tests | `tests/scenes/battle/EnemyPoseController.test.ts` and `enemyPoseFlow.test.ts` assert today's timings. `tests/data/assetCoverage.test.ts` requires exactly `idle, attack, hurt` (+ optional `cast`) in every sheet. **That assertion has to be widened, not deleted.** |
| Review scenarios | `ai_monsters_small`, `ai_monsters_large`, `ai_monsters_nine`, `ai_boss`, `ai_boss_cast` in `assets/data/debug-scenarios.yaml`. |

Quirks in the approved keyframes that the rigs must deal with:
- **Props appear and disappear.**
  - Goblin: the dagger sits at the hip in idle, is in the near hand in attack, and is gone in hurt.
  - Ogre: the club is gone in hurt.
  - Troll: the mallet is drawn in two pieces in attack.
  - Lich: the attack has a drawn frost-arc trail, and the cast has a floating ice crystal.
  - Garland: the cast has a crimson glow in his hand.
- **Big silhouette changes.**
  - Wolf and dragon: the hurt pose rears up almost vertically.
  - Vampire: the cape is closed in idle and spread like wings in attack.
  - Mummy: the attack and hurt frames gain many bandage streamers.
  - Pirate: the hurt pose lifts one leg.
- **Little headroom.** Attack cells run nearly edge to edge: goblin x2-78 of 80, wolf x2-106 of 110, lich x9-190 of
  200. Overshoot frames must not clip, because the cells are not enlarged (enlarging them would move the layout).
- **Bosses have a separate 16-colour palette per pose file.** The palette check therefore uses the union of the
  source files.
- **Cockatrice hurt** has legitimate loose feathers (separate pieces). The fragment check is therefore relative to
  the source keyframe.

---

## 2. Success criteria (defined before any implementation)

```json
{
  "functional": [
    "Every monster sprite in monsters-ai.json has the frames idle, idle_b, atk_wind1, atk_wind2, atk_mid, attack, atk_follow, atk_recover, hurt_in1, hurt_in2, hurt; bosses (sheets with cast) also have cast_gather, cast_rise, cast, cast_release",
    "An enemy Fight plays wind1 -> wind2 -> mid -> attack (contact; action resolves here) -> follow -> recover -> idle with the lunge offset",
    "A hit plays hurt_in1 -> hurt_in2 -> hurt (recoil + shake) -> hurt_in2 -> hurt_in1 -> idle; a lethal hit plays the in-phase then holds hurt while fading",
    "A boss Magic plays gather -> rise -> cast (spell resolves) -> release -> rise -> gather -> idle",
    "Idle enemies alternate idle / idle_b, out of phase per enemy",
    "Palette-swap variants (gr_imp, gr_wolf) carry every frame of their base sprite, recoloured",
    "A sheet without a rig (or an old atlas without the new keys) still plays: each missing frame shows its source keyframe",
    "Approved sheets are byte-identical before and after (style lock); the party atlases are byte-identical (no regression)"
  ],
  "observable": [
    "python3 -I assets-src/gen/monster_anim.py review <id> writes a contact sheet, onion-skin strips, timed GIFs and a check report",
    "?mute=1&scenario=anim_<group>&enemyAnim=loop shows every monster cycling attack/hurt/(cast) in the browser; &enemyAnim=step steps frame by frame",
    "monsters-ai.png stays <= 4096 x 4096"
  ],
  "pass_fail": [
    "monster_anim check: 0 failures for every generated frame (section 5 list, each binary)",
    "npx tsc --noEmit, npm run build, npm test: exit 0",
    "python3 -I assets-src/gen/selftest.py: exit 0 (including the new checker self-tests)",
    "Two builds of monsters_ai under different PYTHONHASHSEED values are byte-identical",
    "git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*",
    "Goblin passes the human/agent visual review (section 5.3) within 6 iterations, else escalated",
    "Adversarial play test (section 8): every P-item has a recorded verdict; no open P0/P1 artifact"
  ]
}
```

---

## 3. Frame set and timing

### 3.1 Frames per monster (names follow the party's `atk_*` / `cast_*` convention)

The in-between names below follow the party puppet's naming, but each frame takes its pixels from a *monster*
keyframe: `idle`, `attack`, `hurt` or `cast`. "Target" is the pose the frame moves toward. Angle interpolation is
described in 4.2.

| Frame | Kind | Pixel source | Target pose (recipe default) | Purpose |
|-------|------|--------------|------------------------------|---------|
| `idle` | approved | - | - | rest |
| `idle_b` | generated | idle | upper body 1 native px down (`puppet.bob` at the waist row); floating sprites: whole sprite 1 px down | breathing |
| `atk_wind1` | generated | idle | idle→attack at t = -0.20 (pull back, away from the party), body 1 px lower | anticipation |
| `atk_wind2` | generated | idle | t = -0.35, body 2 px lower, weapon/head chain pulled back further | coil |
| `atk_mid` | generated | attack | attack posed 45% back toward `atk_wind2` | the pass (no smear) |
| `attack` | approved | - | - | strike / contact |
| `atk_follow` | generated | attack | idle→attack extrapolated to t = 1.10 (overshoot), clamped so nothing touches the cell border | follow-through |
| `atk_recover` | generated | idle | idle→attack at t = 0.30 | settle back |
| `hurt_in1` | generated | idle | idle→hurt at t = 0.35 | flinch starts |
| `hurt_in2` | generated | hurt | hurt posed 35% back toward idle | nearly recoiled |
| `hurt` | approved | - | - | recoil |
| `cast_gather` (boss) | generated | idle | idle→cast at t = 0.25, body 1 px lower | gather |
| `cast_rise` (boss) | generated | cast | cast posed 45% back toward idle | rise |
| `cast` (boss) | approved | - | - | spell stance |
| `cast_release` (boss) | generated | cast | idle→cast extrapolated to t = 1.10, casting arm lifted more | release |

- Monsters get **8 generated frames each** (5 attack, 2 hurt, 1 idle). Bosses get **11**.
- The 6-pose attack is `atk_wind1, atk_wind2, atk_mid, attack, atk_follow, atk_recover`. Only `attack` is approved.
- The hurt return reuses `hurt_in2` and `hurt_in1` in reverse, so there are two distinct poses each way.
- **Near-keyframe principle.** Every generated frame takes its pixels from the keyframe it is closest to in the
  timeline, and moves at most about 35% of the angular distance away from it. This keeps cut-out artifacts small even
  where two keyframes differ hugely (wolf, dragon and lich hurt).
- **Props and fx parts.** A prop or fx part exists only in the frames whose pixel source carries it. Examples: the
  goblin dagger, the lich crystal and frost trail, the Garland glow.
  - The lich trail is an `fx` part dropped from `atk_follow`.
  - The crystal and glow appear at `cast` and stay in `cast_release`. `cast_rise` has none.
  - A prop that vanishes between `hurt_in1` and `hurt_in2` is accepted (a 2-frame recoil). The review marks it.

### 3.2 Runtime timing (60 fps frames; `dt` is in frames as today)

The attack offset `dx` is positive toward the party, the hurt offset is negative (away from the party), and the cast
offset `dy` is negative (up). All offsets are in screen px and multiplied by the layout `scaleFactor` (0.5 when a big
group is shrunk), then rounded.

**Attack: 31 frames (today 20). Contact, and so `attackOutDone`, at t = 14.**

| Pose | Frames | Offset |
|------|--------|--------|
| `atk_wind1` | 5 | dx 0 → -4 (ease out) |
| `atk_wind2` | 6 | dx -4 → -6 |
| `atk_mid` | 3 | dx -6 → 18 (ease in) |
| `attack` | 8 | dx 18 → 24 in 2 frames, then held (**contact at the first `attack` frame**) |
| `atk_follow` | 4 | dx 24 → 14 |
| `atk_recover` | 5 | dx 14 → 0 |

**Hurt: 20 frames (today 18).**

| Pose | Frames | Offset |
|------|--------|--------|
| `hurt_in1` | 2 | dx 0 → -3 |
| `hurt_in2` | 2 | dx -3 → -6 |
| `hurt` | 10 | dx -6, plus a ±3 shake every 2 frames |
| `hurt_in2` | 3 | dx -6 → -3 |
| `hurt_in1` | 3 | dx -3 → 0 |

Hurt rules:
- A new hit during the in-phase or the hold restarts the hold.
- A new hit during the return jumps to `hurt_in2` and then the hold. There is never a snap to idle.
- A hit during the monster's own attack or cast is still ignored (today's rule, kept).

**Dying:** `hurt_in1` 2 frames, `hurt_in2` 2 frames, then `hurt` held with dx -6 and no shake. The 30-frame fade
(`DYING_FRAMES`) runs at the same time, unchanged.

**Boss cast: 30 frames (today 24). The spell resolves at the start of the hold (`CAST_OUT` = 10).**

| Pose | Frames | Offset |
|------|--------|--------|
| `cast_gather` | 6 | dy 0 → -2 |
| `cast_rise` | 4 | dy -2 → -6 |
| `cast` | 10 | dy -6, held |
| `cast_release` | 4 | dy -6 |
| `cast_rise` | 3 | dy -6 → -2 |
| `cast_gather` | 3 | dy -2 → 0 |

**Non-boss cast** (no cast keyframe; it shows the attack texture today): `atk_wind1` 5, `atk_wind2` 6, `attack` 10
(no lunge, dy -6, `CAST_OUT` at its start), `atk_follow` 4, `atk_recover` 5.

**Idle:** `idle` and `idle_b` alternate every 36 frames (period 72), with phase `index*17` as in the party's
`idlePose`. This applies only in idle mode. A rig may turn it off (`breath: false`).

Every number lives in one table in the new `src/scenes/battle/enemyChoreography.ts`. `EnemyPoseController` keeps its
public API and becomes a cursor over that table. The tables are the tuning surface for the play test.

---

## 4. Generation method

### 4.1 Body-type classification (every sprite in `gen/monsters.yaml`)

| Sprite | Cell | Body type | Method | Rig notes |
|--------|------|-----------|--------|-----------|
| goblin (+ gr_imp) | 80 | biped | cut-out (humanoid joints) | near hand dagger in attack; idle dagger at the hip (prop `dagger`, bound to the far hip); none in hurt; the face changes per keyframe (accepted) |
| pirate | 80 | biped + cloth | cut-out; coat tails = cloth on the torso | cutlass in the near hand; hurt lifts one knee |
| skeleton | 80 | biped | cut-out, thin-bone radii | round shield bound to the far forearm; thin limbs, so watch for joint tears |
| mummy | 80 | biped + streamers | cut-out; streamers = cloth (torso colours) moved with their nearest bone | streamers exist only in attack and hurt; frames from idle have none (accepted) |
| vampire | 80 | biped + large cape | cut-out body + **mesh warp** on the cape (chain from neck to hem) | closed cape in idle, spread in attack: wind frames keep it closed, mid/follow keep it spread |
| ogre | 128 | heavy biped | cut-out | club in idle and attack only; an overhead two-handed swing in attack |
| troll | 128 | heavy biped | cut-out | very long arms; the mallet is 2 pieces in attack (`prop_colors` keeps both as weapon) |
| wolf (+ gr_wolf) | 110x80 | quadruped | **chain rig + mesh warp** (spine, neck and tail chains; 4 legs cut-out) | the hurt pose rears up: `hurt_in1` pitches the spine up ≤ 20° about the hind hip, `hurt_in2` pitches the hurt pose down ≤ 20° |
| cockatrice | 84x80 | bird biped | chain rig: neck chain + snake-tail chain (mesh warp), wings cut-out, 2 legs | loose feathers in hurt are legitimate pieces |
| dragon | 128 | winged quadruped | chain rig + mesh warp (spine, neck, tail), wings cut-out about the wing root | hardest: rearing hurt, raised wings in attack; last in the rollout |
| garland | 200 boss | biped + cape, two-handed weapon | cut-out + cape mesh warp; `two_handed: true` (the far hand follows the weapon) | separate palette per pose file; red glow = cast fx |
| lich | 200 boss | biped + mantle, two-handed glaive | cut-out + mantle mesh warp; fx parts `trail` (attack) and `crystal` (cast) | attack and cast reach x9-190: overshoot frames clamped |
| floating (none today) | - | floating | `idle_b` = whole-sprite 1 px bob; every other frame **holds** its keyframe | spec support only |

Variants never get a rig. `build_monsters_ai` already recolours *every frame in the list*, so they inherit the new
frames automatically once those frames are in the list before recolouring.

### 4.2 Shared generator (new code; the party code path is untouched)

`puppet.py`'s segmentation is tied to its global `PARTS`, a left-facing figure and 80x80 cells. Changing it in place
risks the approved party frames, so the monster work goes into new modules that import puppet's neutral helpers
(`_absorb_orphans`, `_grow`, `outline`, `bob`, `_strip`, `_gif`) without changing them:

- `assets-src/gen/rig.py`: the generic rig.
  - **Parts table** per body type, plus overrides from the rig file: name, bone `(j0, j1)`, segmentation radius,
    `parent`, kind ∈ `rigid | chain | cloth | prop | fx`.
  - **Segmentation:** nearest bone, plus `torso_colors` / `prop_colors` / `fx_colors` rules and optional polygon masks
    in the rig file.
  - **Pose solve:** angle-space interpolation between two keyframes' joints, extrapolation for `t < 0` and `t > 1`,
    a root translation lerp, bone lengths kept from the pixel source (generalised `keep_lengths`, any chain), and
    per-frame `tweaks`.
  - **Rendering:**
    - Rigid parts use an inverse affine map with nearest sampling, as in puppet.
    - Chain and cloth parts use a **piecewise-affine mesh warp**: quads along the chain, inverse mapping through the
      deformed triangles, then nearest sampling. This is pure numpy, about 80 lines, with no new dependency.
  - **Optional `sampler: rotsprite`:** Scale2x three times (8x), nearest rotate, then mode-downsample per 8x8 block.
    Every step only copies existing colours, so the palette is preserved by construction. It reduces the staircase
    jaggies of 10-30° rotations. The default is `nearest`, and the goblin iterations A/B-test the two.
  - **Compositing:** back to front with a per-keyframe `z` order, then puppet's `outline()` seam repair, then a final
    `paint` list of build-time pixel patches (style-lock-safe, like `face_fix`).
  - **Facing:** `facing: right` is handled with a forward sign `fwd = +1`. Joints are marked in the approved image's
    own coordinates, with no mirroring.
- `assets-src/gen/anim_checks.py`: the checks in section 5. These are pure functions on numpy arrays, so the selftest
  can feed them defective images.
- `assets-src/gen/monster_anim.py`:
  - recipes (table 3.1, `t` values overridable per frame in the rig);
  - `monster_frames(sprite) -> {name: Image}`, used by the build;
  - CLI `review [ids]`, `check [ids|--all]` and `mark <id>`. `mark` writes 4x/8x zoomed keyframes with a 5 px
    coordinate grid, the current joints and bones, and the segmentation coloured per part. This is the tool for
    marking joints by eye.
- **Rig files:** `assets-src/gen/anim/monsters/<sprite>.yaml`. This is a subdirectory on purpose:
  - `field_ai` would otherwise read a same-named file as a field config;
  - puppet's `review` would otherwise glob it.

  One file per sprite, so the files can be owned in parallel. Schema (draft):

```yaml
sprite: goblin
body: biped                 # biped | quadruped | bird | floating
facing: right
sampler: nearest            # or rotsprite
breath: true
two_handed: false
keyframes:                  # native px on the approved cell; same joint names as the body template
  idle:   {neck: [..], crown: [..], chest: [..], hip: [..], sh_n: [..], ...}
  attack: {...}
  hurt:   {...}
  # cast: {...}             # bosses
parts:                      # optional overrides of the template table
  dagger: {kind: prop, bone: [hip_f, tip], in: [idle]}
colors: {torso: [[r,g,b], ...], prop: [...], fx: [...]}
z: {idle: [...], attack: [...], hurt: [...]}
frames:                     # per-frame recipe overrides
  atk_follow: {t: 1.06}
  hurt_in1: {t: 0.30, tweaks: {crown: [-1, 0]}}
paint: []                   # build-time pixel patches: [{frame, xy: [[x,y],...], rgb: [r,g,b]}]
```

**Fallback without a rig.** `monster_frames` returns `{}`. The build then writes JSON rects for the generated names
that **alias** the source keyframe's rect, so they take no atlas space, and sets `anim: false`. The runtime timeline
still plays: today's look plus the new recoil and lunge timing.

---

## 5. Quality bar and review loop

### 5.1 Automated checks (`anim_checks.py`; each one is binary, run by `monster_anim.py check` and the build)

Every generated frame is compared with its pixel source S (and its target keyframe T where noted).

1. **Binary alpha.** Every alpha is 0 or 255.
2. **Palette lock.** The frame's colours are a subset of the union of the source keyframe files' colours plus
   `OUTLINE`. Variants are checked after recolouring against the recoloured sources.
3. **No magenta / key fringe.** No pixel within RGB distance 90 of `#ff00ff`, and none with R>180, B>180, G<90.
4. **No detached pixels.** The number of connected opaque pieces is at most S's count, and there is no new piece
   under 12 px.
5. **No holes or tears.** Enclosed transparent pixels (not 4-connected to the border) are at most S's count + 2.
   Closing (3x3) adds at most 6 pixels along seams between two part labels.
6. **Silhouette continuity.** Opaque area is 0.85-1.15 of S. Bbox height is within ±4 px of the S→T lerp. Between
   *adjacent frames of the runtime sequence*, mask IoU ≥ 0.55 (feet-aligned) and the centroid moves ≤ 6 native px for
   80 px cells, scaled for larger cells. This last test catches popping.
7. **Outline.** The second-ring ratio is within ±0.08 of S (puppet's metric). At least 97% of silhouette edge pixels
   are dark (max channel < 60), compared with the same ratio in S.
8. **Feet anchored.** For grounded sprites, the lowest opaque row equals `bottom_row` in every frame. Frames sourced
   from a keyframe whose feet span x0-x1 keep their feet within ±2 px of it, except the frames that the recipe moves.
   For floating sprites, the one shared offset is kept.
9. **No clipping.** No opaque pixel in the outer 1 px border of the cell.
10. **Rotation cap.** Rigid parts rotate ≤ 30° from their source (torso ≤ 20°). Chain and cloth segments rotate ≤ 25°
    each.
11. **Atlas grid.** In `monsters-ai.png`, every 2x2 block is uniform (the 2x nearest upscale stayed exact), the image
    is ≤ 4096 in both directions, and the rect of every generated frame lies inside the image.
12. **Determinism.** Building with `PYTHONHASHSEED=0` and `=1` gives identical PNG and JSON bytes.

### 5.2 Review output (`python3 -I assets-src/gen/monster_anim.py review goblin`)

Output goes to `assets-src/gen/out/anim/review/monsters/` (gitignored):

| File | Content |
|------|---------|
| `goblin_rig.png` | keyframes at 4x with joints, bones and part segmentation colours |
| `goblin_attack.png` / `_hurt.png` / `_cast.png` / `_idle.png` | 4x strips in runtime order, keyframes framed in green, generated frames in grey |
| `goblin_onion.png` | each adjacent pair overlaid (previous at 40% in cyan, next opaque), to show popping and drift |
| `goblin_attack.gif` / `_hurt.gif` / `_cast.gif` | at the real runtime timing (section 3.2), at 4x |
| `goblin_stage.png` | each frame at game scale (2x) on a crop of `assets/backgrounds/grassland.webp`, with the battle plain line, for in-context reading |
| `goblin_report.json` | every check per frame, plus `ok` |

Check failures print one line per frame with the exact criterion, e.g.
`goblin atk_wind2: holes 9 > 4 at seam uarm_n/torso (31,44)`.

### 5.3 Goblin prototype loop (the visual bar)

Each iteration:
1. Edit `anim/monsters/goblin.yaml` (joints, radii, `t` values, z order, sampler, paint).
2. Run `monster_anim.py review goblin`. Every check must be green.
3. A visual read of the strips, onion sheet, GIFs and the in-browser loop by the implementer, then a second
   independent reviewer looking at the images only.

Visual pass criteria (all must hold):
- Every frame reads as the same goblin: ears, nose, vest and belt shapes are unchanged, the face is not smeared, and
  there is no doubled outline.
- The motion reads clearly at 1x game speed: anticipation is visible, contact hits, and the recoil reads as a hit.
- There is no limb "rubber band" or stretched pixels, and no pixel crawl on a still part between adjacent frames.
- The dagger does not jump between hands except at a keyframe boundary.
- In the browser, the feet do not slide relative to the plain during wind or recover.

**Iteration cap.** At most **6 iterations** for the goblin. After 6, escalate to the orchestrator with the latest
review images and one of these proposals:
- (a) switch to the rotsprite sampler, or to mesh warp for the arms;
- (b) reduce the amplitude (`t` closer to the keyframe);
- (c) add more build-time `paint` patches;
- (d) the gated paid fallback (section 9).

Other monsters: at most 4 iterations each. After that, a frame that still fails is set to `hold` (it aliases its
source keyframe), logged in the rig file as `holds: [frame, reason]`, and the tranche continues.

---

## 6. Build, runtime and test changes

### 6.1 Build (`assets-src/build_assets.py::build_monsters_ai`)

- After loading each approved entry:
  1. Call `monster_anim.monster_frames(sprite)` and append the generated frames in a fixed order
     (`MONSTER_FRAMES` / `BOSS_FRAMES` constants in `monster_anim.py`).
  2. Run the checks. **The build fails** on any check failure in a frame that is not on a `holds` list.
- Variants are then recoloured from the full frame list (existing loop).
- **Atlas packing.** Today's one-row-per-sprite layout would reach 15 x 200 x 2 = 6000 px wide for the bosses, which
  is too wide for a 4096 texture. It becomes a deterministic shelf packer capped at 2048 native (4096 screen) wide.
  The estimate is about 2.4 M native px², so roughly 2048 x 1900 native, which fits.
- If it ever exceeds 2048 x 2048 native, the build fails with a clear message. The orchestrator then chooses between
  a second page and shipping the atlas at native scale (decision D3).
- **JSON** stays backward compatible:
  `frames: {<name>: [x, y]}` for every name, aliased rects for held or missing frames, and two new keys per sheet:
  `anim: true|false` and `sequence_version: 1`.
- `?art=legacy` and unit tests are unaffected. The monster atlas is AI-only.

### 6.2 Runtime

- **`src/scenes/battle/enemyChoreography.ts`** (new, pure, about 120 lines):
  - `MonsterFrame` union and `MONSTER_FRAMES`, `BOSS_FRAMES`;
  - `FRAME_SOURCE` (fallback keyframe per frame);
  - the timelines of 3.2 as data;
  - `attackAt(t)`, `hurtAt(t)`, `castAt(t, hasCast)`, `dyingAt(t)`, `idleFrame(clock, index, breath)`.
- **`EnemyPoseController`:** same public API, plus `state(i).pose: MonsterFrame`.
  - `ATTACK_OUT` / `CAST_OUT` are derived from the tables, so `attackOutDone` lands exactly on the contact or hold
    frame.
  - Implements the re-hit rules of 3.2.
  - Gets a per-controller idle clock.
  - Receives `hasCast[]` and `scaleFactor[]` from `AiEnemyView`.
- **`BattleArt.getMonsterFrames`:** returns `textures: Record<MonsterFrame, Texture>`. Each texture is sliced from
  `entry.frames[name] ?? entry.frames[FRAME_SOURCE[name]] ?? entry.frames.attack`, so an old atlas still works.
  `MonsterAtlasMeta.frames` is widened. The keys `idle/attack/hurt/cast` stay for current callers until they are
  migrated in the same change.
- **`AiEnemyView.update`:**
  - `sprite.texture = f.textures[st.pose]`;
  - offsets × `box.scaleFactor`, rounded (integer positions, so no sub-pixel sampling);
  - the box `scaleFactor` is kept per enemy.
- **Unchanged:** `BattleAnimationController` (the hooks already exist), the `BattleEffects` element flash (it already
  follows the texture each frame), and the dying fade.
- **Dev-only preview driver** `src/scenes/battle/enemyAnimPreview.ts`, gated by `import.meta.env.DEV`:
  - `?enemyAnim=loop` cycles every enemy (attack, pause, hurt, pause, cast if it has one), staggered 20 frames per
    enemy, with no battle logic;
  - `?enemyAnim=step` freezes time; `.` advances 1 frame, `,` goes back 1, and a corner label shows
    `enemy: frame name / t`;
  - `&slow=N` divides `dt`.

  It is hooked from one line in `BattleScene.update`. That file is a known size exception, so nothing else is added
  there.

### 6.3 Tests (Vitest; existing tests are updated to the new spec, never deleted)

| File | Contents |
|------|----------|
| `tests/scenes/battle/enemyChoreography.test.ts` (new) | Frame-by-frame poses and offsets for attack, hurt, dying, boss cast and non-boss cast. Contact at t = 14 and `CAST_OUT` match the tables. Total lengths. Every frame name used is in `MONSTER_FRAMES`/`BOSS_FRAMES`. Idle breathing phase per index. Offsets scale with `scaleFactor` and are integers. |
| `EnemyPoseController.test.ts` (updated) | Lunge out, hold and back with the new frames. Re-hit during the in-phase, hold and return (no idle frame in between). A hit during attack or cast is ignored. Dying runs the in-phase and then holds `hurt` with dx -6 and no shake. Per-enemy independence. |
| `enemyPoseFlow.test.ts` (updated) | The action resolves on the contact frame (not before). `round_end` waits for the 31-frame attack and the 30-frame cast. A lethal hit fades while `hurt` is held. |
| `tests/rendering/BattleArt.test.ts` (new or extended) | Every `MonsterFrame` returns a texture. A JSON without the new keys falls back to `FRAME_SOURCE`. A boss without `cast` falls back to `attack`. |
| `tests/data/assetCoverage.test.ts` (extended) | Every sheet has every `MONSTER_FRAMES` key, and sheets with `cast` have every `BOSS_FRAMES` key. Every rect is inside the image. The image is ≤ 4096 in both directions. When `anim: true`, generated rects differ from their source rect (real frames, not aliases). Each variant has the same keys and `anim` flag as its base. `footRow < cell[1]`. |
| `tests/scenes/battle/enemyAnimPreview.test.ts` (new) | The loop driver schedules attack, hurt and cast per enemy. Step mode advances exactly 1 frame. |
| `assets-src/gen/selftest.py` (new `test_monster_anim`) | **RED first:** each checker in 5.1 is fed a synthetic sprite with one injected defect (stray pixel, hole, off-palette colour, magenta pixel, feet moved 1 px, semi-alpha, border pixel, 40° rotation) and must fail it. The clean version must pass. Also: a synthetic biped rig renders deterministically (two runs give equal bytes); the mesh warp of an identity mesh equals its input; rotsprite keeps the palette; style lock (hashes of `approved/*/monster_*.png` and `boss_*.png` unchanged by a build); party atlas unchanged (hash `battle-characters-ai.png` before and after `monsters_ai`). |

---

## 7. Rollout (tranches, ownership, per-monster checklist)

Shared files have **one owner each** (the framework owner, T0). Rig agents own only their
`assets-src/gen/anim/monsters/<sprite>.yaml`. **Only the integrator** rebuilds and stages `assets/sprites/monsters-ai.*`,
because binary atlas conflicts cannot be merged. Rig agents run `monster_anim.py review/check <id>` and never commit
the atlas.

| Tranche | Scope | Owner(s) / parallelism | Effort |
|---------|-------|------------------------|--------|
| T0 framework | `rig.py`, `anim_checks.py`, `monster_anim.py`, selftest (RED first), `build_monsters_ai` + packer, `enemyChoreography.ts`, controller/view/BattleArt changes, Vitest, `enemyAnimPreview.ts`, `anim_*` debug scenarios; no rigs yet (every sprite `anim: false`, the game looks like today plus the new timings) | 1 agent, serial | 1.5-2 d |
| T1 goblin prototype | `anim/monsters/goblin.yaml`; gr_imp inherits; loop of 5.3 (≤ 6 iterations); sign-off before T2 | 1 agent + 1 image-only reviewer | 0.5-1 d |
| T2 bipeds | pirate, skeleton | 2 agents in parallel (one file each) | 0.5 d each |
| T3 heavy bipeds | ogre, troll | 2 agents in parallel | 0.5 d each |
| T4 cloth bipeds | vampire, mummy (needs the cape mesh warp proven in T0 selftest) | 2 agents in parallel | 0.75 d each |
| T5a beast templates | `quadruped` and `bird` body templates in `rig.py` (framework owner, serial) | 1 agent | 0.5 d |
| T5b beasts | wolf (+ gr_wolf), cockatrice, then dragon | wolf and cockatrice in parallel; dragon after both (reuses their lessons) | 0.75 d each; dragon 1 d |
| T6 bosses | garland, lich: attack + hurt + cast in-betweens, two-handed weapon, fx parts | 2 agents in parallel (after T2 for the weapon lessons) | 1 d each |
| T7 integration | rebuild the atlas, full validation (section 10), docs (AGENTS.md art table row, `ART_MONSTERS_PLAN.md` "out of scope" line, `gen/README.md`) | integrator | 0.5 d |
| T8 adversarial play test | section 8 | 1 agent (not an implementer) | 0.5-1 d |

**Per-monster checklist** (copy into the hand-off of each rig):
- [ ] Rig file under `anim/monsters/`; joints marked with `monster_anim.py mark <id>` overlays checked by eye.
- [ ] Props, fx and cloth assigned (colour rules or masks); z order per keyframe.
- [ ] `monster_anim.py check <id>`: 0 failures (or each `holds` entry justified).
- [ ] Review strips, onion sheet and GIFs read; visual criteria of 5.3 hold (adapted to the creature).
- [ ] Feet on the plain in `goblin_stage.png`-style output; no clipping in overshoot frames.
- [ ] Variant (if any) rendered and checked after recolour.
- [ ] In-browser `?mute=1&scenario=anim_<group>&enemyAnim=loop` watched for at least 3 cycles; `&enemyAnim=step`
      screenshot of every frame attached to the hand-off.
- [ ] Iteration count recorded (≤ 4, or ≤ 6 for the goblin).

**New debug scenarios** (in `assets/data/debug-scenarios.yaml`, T0). Every scenario loads with
`?mute=1&scenario=<id>`, plus `&enemyAnim=loop` or `&enemyAnim=step`.

| Scenario | Purpose / enemies |
|----------|-------------------|
| `anim_goblin` | goblin, gr_imp |
| `anim_bipeds` | goblin, pirate, skeleton, mummy, vampire, gr_imp (6 small: tests stacking) |
| `anim_large` | ogre, troll, dragon |
| `anim_beasts` | wolf, gr_wolf, cockatrice |
| `anim_boss_garland` | garland, plus `enemyAi` alternating fight and magic |
| `anim_boss_lich` | lich, goblin, goblin |
| `anim_crowd` | 9 small enemies (tests the half-size layout) |

---

## 8. Adversarial play test (T8): graphical artifacts

Run with Playwright on `npm run dev`. Every URL includes `&mute=1`. Evidence is a screenshot per finding (step mode
for exact frames), with a severity: P0 (broken or wrong art), P1 (visible artifact in normal play), P2 (only visible
when stepping).

| # | Probe | How | Expect |
|---|-------|-----|--------|
| A1 | Frame popping | `enemyAnim=step` through each sequence of every sprite | no jump in size or position larger than the motion; no one-frame flash of idle in the middle of hurt or attack |
| A2 | Pixel grid | screenshots at 100%, at a window resized to an odd width, and at browser zoom 125% | no blurred or half-pixel art; integer positions (read `sprite.position` via `window.game` in dev) |
| A3 | Half-size layout | `anim_crowd`, and 9 enemies of mixed sizes | offsets scaled; no lunge overlapping a neighbour badly; no clipped frames |
| A4 | Multi-enemy order | `anim_bipeds` loop | the lunging enemy draws over or under neighbours consistently (zIndex rule decided: the attacker on top during its lunge?); no flicker between neighbours |
| A5 | Damage numbers and flash order | real battle: party hits a goblin; spell with an element on a boss | the number spawns at contact, the element glow follows every in-between texture, the glow never shows the previous frame |
| A6 | Hurt during attack | two enemies; party counter or multi-target spell while one is lunging | the attacker keeps attacking (rule); a hurt enemy next to it recoils independently |
| A7 | Rapid re-hits | multi-hit (monk / FAST-style) on one goblin | no snap back to idle between hits; the sequence restarts at the hold |
| A8 | Death | lethal hit during each phase (in, hold, return, idle_b) | in-phase then a held `hurt`; the fade is smooth; no frame swap after alpha < 0.5; sprite hidden at the end |
| A9 | Death while attacking | enemy killed by a counter in its own attack (if possible) or forced in a debug scenario | no stuck lunge offset; `round_end` does not hang |
| A10 | Bosses | `anim_boss_garland` and `anim_boss_lich`, cast and fight | fx parts appear and disappear only at the planned frames; no cape tearing; feet planted during cast rise/settle (only dy) |
| A11 | Palette variants | `anim_goblin`, `anim_beasts` | gr_imp and gr_wolf match their base frame for frame; no un-recoloured pixels (check outline and eye colours) |
| A12 | Magenta / key fringe | screenshot over a dark and over a light background, zoomed in | no pink edge pixels |
| A13 | Idle breathing | 5 identical goblins idle for 10 s | out of phase, 1 art px only, no shimmer on the feet |
| A14 | Placeholder / missing art | temporarily rename one sheet key in a dev build, or test-only atlas | placeholder box still lunges and recoils; console warning; no crash |
| A15 | Load race | debug battle before the atlas has loaded (`upgradeToArt` path) | an animation in progress continues on the swapped sprite |
| A16 | Pacing | 3-goblin battle, 5 rounds with a stopwatch | the turn time increase over today (about 11 frames per enemy attack) is acceptable to the reviewer; otherwise tune the tables |
| A17 | Victory / escape / game over | win with an enemy mid-recoil; run away | no sprite left frozen on an in-between; scene exits cleanly |
| A18 | Status overlays | enemy asleep / stoned / feared (if shown) | statuses that should freeze the animation do so (decision D6) |
| A19 | Performance | `anim_crowd` with the dev FPS meter | 60 fps; texture memory of the new atlas noted |

Findings go to a play-test report written by the T8 agent (a new `docs/PLAYTEST_ENEMY_ANIM_<date>.md`, at that time,
following the existing PLAYTEST docs). P0/P1 items go back to the rig owner or framework owner, with at most 2 fix
rounds before escalation.

---

## 9. Paid fallback (off by default; gated)

The fallback exists only if the goblin escalation (5.3) cannot reach the bar with (a)-(c), **and** the user approves
it explicitly.
- **Scope:** Gemini, only for single in-between frames of the goblin (at most 2 frames: `atk_wind2` and `hurt_in2`).
  The identity reference is the approved keyframe.
- **Cap:** at most 6 images in total, at most 3 attempts per frame. Through the existing budget guard (`--paid`, ledger
  entry): 26 → ≤ 32 of 100.
- **Acceptance:** the output must pass every check in 5.1 (the palette is snapped to the source palette, then
  checked) and the visual bar.
- If the fallback is approved and works, roll it out only on a second, separate approval. Bedrock/Stability is not
  reused (rejected on 2026-11-13).

---

## 10. Validation commands

```bash
# Python art pipeline
python3 -I assets-src/gen/selftest.py
python3 -I assets-src/gen/monster_anim.py check --all
python3 -I assets-src/gen/monster_anim.py review goblin            # any id(s)
python3 -I assets-src/build_assets.py monsters_ai
PYTHONHASHSEED=0 python3 -I assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai.* > /tmp/a.sha
PYTHONHASHSEED=1 python3 -I assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai.* | diff - /tmp/a.sha
python3 -I assets-src/gen/puppet.py review                          # party in-betweens still OK
python3 -I assets-src/build_assets.py battle_ai field_ai
git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*

# TypeScript
npx tsc --noEmit
npm run build
npm test
npx vitest run tests/scenes/battle/ tests/data/assetCoverage.test.ts tests/rendering/

# Browser (dev): http://localhost:5173/?mute=1&scenario=anim_goblin&enemyAnim=loop   (and &enemyAnim=step)
```

---

## 11. TODOs

- [ ] T0.1 Selftest RED: synthetic defect fixtures + `test_monster_anim` (priority: high, effort: 2h)
- [ ] T0.2 `anim_checks.py` until the selftest is GREEN (priority: high, effort: 3h)
- [ ] T0.3 `rig.py` biped template, segmentation, angle solve, rigid render, outline, paint (priority: high, effort: 5h)
- [ ] T0.4 Mesh warp + rotsprite sampler + their selftests (priority: high, effort: 4h)
- [ ] T0.5 `monster_anim.py` recipes, `monster_frames`, CLI `review`/`check`/`mark` (priority: high, effort: 4h)
- [ ] T0.6 `build_monsters_ai`: generated frames, checks gate, shelf packer, aliased rects, `anim` flag (priority: high, effort: 3h)
- [ ] T0.7 `enemyChoreography.ts` + tests (RED then GREEN) (priority: high, effort: 3h)
- [ ] T0.8 `EnemyPoseController` / `AiEnemyView` / `BattleArt` migration + updated tests (priority: high, effort: 3h)
- [ ] T0.9 `assetCoverage` extension, BattleArt fallback test (priority: high, effort: 1.5h)
- [ ] T0.10 `enemyAnimPreview.ts` + `anim_*` scenarios + test (priority: medium, effort: 2h)
- [ ] T0.11 Full validation (section 10) with every sprite `anim: false` (priority: high, effort: 1h)
- [ ] T1 Goblin rig, ≤ 6 iterations, independent visual sign-off (priority: high, effort: 4-8h)
- [ ] T2 pirate, skeleton rigs (parallel) (priority: medium, effort: 4h each)
- [ ] T3 ogre, troll rigs (parallel) (priority: medium, effort: 4h each)
- [ ] T4 vampire, mummy rigs with cloth warp (parallel) (priority: medium, effort: 6h each)
- [ ] T5a quadruped + bird templates (priority: medium, effort: 4h)
- [ ] T5b wolf, cockatrice (parallel), then dragon (priority: medium, effort: 6h / 6h / 8h)
- [ ] T6 garland, lich incl. cast in-betweens (parallel) (priority: medium, effort: 8h each)
- [ ] T7 Integration rebuild, determinism, docs updates (priority: high, effort: 4h)
- [ ] T8 Adversarial play test + fix rounds (priority: high, effort: 4-8h)

---

## 12. Risks and open decisions for the orchestrator

Risks:
- **R1 Large silhouette changes** (wolf, dragon and lich hurt; vampire cape). Cut-outs beyond about 30° tear.
  Mitigation: the near-keyframe principle, mesh warp, the rotation cap check, `holds`.
- **R2 Thin parts** (skeleton bones, mummy streamers, the troll's split mallet). Segmentation bleeds or tears.
  Mitigation: per-part radii, colour rules, masks, the hole/tear check.
- **R3 Prop pops** (goblin dagger, ogre club, lich fx). Accepted at keyframe boundaries. Flagged in review.
- **R4 Atlas size.** About 2.4 M native px²; bosses alone are 6000 px wide in a single row. Mitigation: the packer and
  the 4096 guard.
- **R5 Pacing.** An enemy attack goes from 20 to 31 frames and a cast from 24 to 30. Battles with many enemies feel
  slower. Mitigation: the tables are data; tune in A16.
- **R6 Shared code.** Touching `puppet.py` could change the approved party frames. Mitigation: new modules only, plus
  a party atlas byte-identical gate.
- **R7 Joint marking by eye is slow and error-prone,** especially on 200 px bosses. Mitigation: the `mark` overlays
  with a grid.
- **R8 Existing tests encode the old timings.** They must be rewritten to the new spec in T0 (not deleted). Reviewers
  should check that the rewritten expectations still test behaviour (contact timing, interruption rules).

Decisions needed:
- **D1 Timing.** Accept the 3.2 tables (attack 31 frames with contact at 14, hurt 20, boss cast 30), or keep today's
  totals (20/18/24) and compress the in-betweens to 2-3 frames each?
- **D2 Lunge distance per size.** Keep 24 px for every size, or scale it (small 24, large 32, boss 40)?
- **D3 Atlas over budget fallback.** Second page, or a native-scale PNG upscaled at runtime (a quarter of the GPU
  memory, a small `AiEnemyView` scale change)? Recommendation: native-scale PNG if needed. It is simpler and saves
  memory.
- **D4 Non-boss cast.** Use the attack in-betweens without a lunge (proposed), or keep today's single attack texture?
- **D5 Draw order.** Should the attacking enemy be raised above its neighbours during its lunge (zIndex), as the party
  attacker effectively is?
- **D6 Status effects.** Should sleep, paralysis or stone freeze the enemy's breathing idle (no status poses exist
  today)?
- **D7 Paid fallback** (section 9). Allowed at all? Default: no.
- **D8 Prop pops.** Is a vanishing prop between `hurt_in1` and `hurt_in2` (goblin dagger, ogre club) acceptable, or
  must the rig keep the prop through both hurt in-betweens (taking it from idle into `hurt_in2`, a composite of two
  sources)?

## Orchestrator decisions

| ID | Decision |
|---|---|
| D1 | Accept the longer sequences. The hit lands on frame 14 and the whole attack takes 31 frames. |
| D2 | Scale the lunge with sprite size: 24 px for small sprites, up to 40 px for large monsters and bosses, linear in the opaque width. |
| D3 | Ship the atlas at native size and scale it at runtime (nearest-neighbour). Every page stays ≤ 4096 px. |
| D4 | A non-boss monster that casts reuses its attack frames without the lunge. |
| D5 | The attacking enemy draws above its neighbours while it lunges, then returns to its own layer. |
| D6 | Sleep, stone and paralysis freeze the breathing idle on the base keyframe. |
| D7 | No paid fallback. If the goblin fails its 6 iterations, escalate to the user. |
| D8 | Carry the prop (dagger, club, mallet) through both hurt in-betweens, fading it out by the approved `hurt` frame. Don't let it vanish all at once. |

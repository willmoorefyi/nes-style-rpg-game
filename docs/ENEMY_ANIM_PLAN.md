# Enemy (monster) battle animation plan: cut-out in-betweens for every monster sprite

Status: plan only, nothing implemented (2026-11-14). Branch `enemy-anim`. Rev 2: the momus review revisions and the
orchestrator decisions (table at the end) are folded into the body.

Goal: the party already has extra "enhanced animation" frames (`gen/puppet.py` + `gen/anim/<class>.yaml`: 8 in-betweens
per class). This plan extends the same idea to the monster sprites:
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
- **No AI generation at all** (D7). Bedrock/Stability in-betweens were tried and rejected on 2026-11-13 (no identity
  lock, img2img redraws the whole figure, inpainting comes back grey). This plan uses **0 paid images**. If a quality
  bar cannot be met without AI, the work stops and **escalates to the user**.
- Browser tests always use `&mute=1`.
- Data stays in YAML or data tables, not in hardcoded TypeScript logic.
- No `as any`, no `@ts-ignore`, no silent catches.
- Source files stay under about 250 lines.

---

## 1. What exists today (verified)

| Area | State |
|------|-------|
| Approved monster art | `approved/<id>/monster_<size>.png`: 3 cells `idle | attack | hurt`, one row. Sizes: goblin, pirate, skeleton, mummy and vampire 80x80; cockatrice 84x80; wolf 110x80; ogre, troll and dragon 128x128. Bosses garland and lich use one 200x200 file per pose, `boss_{idle,attack,hurt,cast}.png`. All keyframes have binary alpha, at most 16 colours per file, feet exactly on `bottom_row` (76 / 122 / 192), no opaque pixel on the cell border, and **face right** (toward the party). |
| Variants | `gr_imp` (goblin, hue -95) and `gr_wolf` (wolf, hue/sat/val) are recoloured at build time by `monster.recolor()` from the base sprite's frames. They have no art of their own. `recolor` leaves `OUTLINE` pixels unchanged. |
| Build | `build_assets.py::build_monsters_ai` writes one row per sprite into `assets/sprites/monsters-ai.png`, pre-scaled 2x (1600x3008 today). `monsters-ai.json` has `{scale, sheets: {id: {cell, footRow, floating, frames: {idle, attack, hurt[, cast]}: [x, y]}}}`. |
| Party puppet | `gen/puppet.py`: humanoid joint set (16 joints + weapon `tip`), segmentation by nearest bone, rigid re-pose with `np.rint` nearest sampling, seam-only outline repair (`outline()` also drops pieces under 12 px), `check()` (outline ring, pixel ratio 0.88-1.12, height ±4, at most 2 pieces), `review` contact sheet + GIFs. `battle_targets` pins knees and feet in the wind-up frames. It assumes 80x80 cells and figures facing **left**. `field_ai` calls `load_cfg(<field id>)` for every field sprite, and `review` globs `anim/*.yaml`. |
| Runtime | `EnemyPoseController` (pure): `attack` = lunge 24 px over 6 frames, hold 8, back 6, shown in the single `attack` texture; `hurt` = 18 frames of ±4 px shake on `hurt`; `cast` = 24 frames, rising 6 px (attack texture when there is no cast frame); `dying` holds `hurt`. `freezeDying` is unconditional (`EnemyPoseController.ts:66-72`), so it can cut off a lunge mid-offset. `AiEnemyView.update` sets `sprite.texture = f[pose]` and the offset. `BattleArt.getMonsterFrames` slices 4 textures. `BattleAnimationController` resolves the action when `attackOutDone` is true (`ATTACK_OUT` = 6), plays hurt from `reactEnemy` and `freezeDying` on a lethal hit, and `round_end` waits for `isAttacking`. Each result line stays for `RESULT_FRAMES` = 25. `BattleEffects.elementFlash` copies `sprite.scale` and follows the sprite's texture and position. The dying fade lasts 30 frames. `BattleDisplayManager.swapSprite` reinserts a rebuilt sprite at `getChildIndex(old)`. There is no counter-attack mechanic. |
| Party sequencing (model to copy) | `attackChoreography.ts`: pure frame tables (`advanceAt`, `returnAt`, `castAt`, `castReturnAt`, `idlePose` with period 72 and phase `member*17`), applied by `BattleDisplayManager.setActorPose` / `poseFor`. |
| Statuses | `StatusEffect` = `poison, stun, sleep, blind, silence, death, stone, fear` (`src/battle/StatusEffects.ts`). The party panel shows the `slep` and `hold` labels. |
| Dev hooks | `window.__game` in dev (`src/main.ts`). |
| Tests | `tests/scenes/battle/EnemyPoseController.test.ts` and `enemyPoseFlow.test.ts` assert today's timings. `tests/data/assetCoverage.test.ts` requires exactly `idle, attack, hurt` (+ optional `cast`) in every sheet, and checks rects against `scale` (`:158-164`). **These tests are updated to the new spec, never deleted.** |
| Review scenarios | `ai_monsters_small`, `ai_monsters_large`, `ai_monsters_nine`, `ai_boss`, `ai_boss_cast` in `assets/data/debug-scenarios.yaml`. |

Quirks in the approved keyframes that the rigs must deal with:
- **Props appear and disappear.**
  - Goblin: the dagger sits at the hip in idle, is in the near hand in attack, and is gone in hurt.
  - Ogre: the club is gone in hurt.
  - Troll: a big club in idle becomes a thin stick drawn in two pieces in attack, and there is no mallet in hurt.
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
- **Cockatrice hurt** has legitimate loose feathers. They are 27-34 px pieces, so they survive `outline()`'s 12 px
  speck filter. The fragment check is therefore relative to the source keyframe.

---

## 2. Success criteria (defined before any implementation)

```json
{
  "functional": [
    "Every monster sprite in monsters-ai.json has the frames idle, idle_b, atk_wind1, atk_wind2, atk_mid, attack, atk_follow, atk_recover, hurt_in1, hurt_in2, hurt; bosses (sheets with cast) also have cast_gather, cast_rise, cast, cast_release",
    "An enemy Fight plays wind1 -> wind2 -> mid -> attack (contact at t=14; action resolves here) -> follow -> recover -> idle, lunging lungePx (24-40 px by size) toward the party, drawn above the other enemy sprites while it lunges",
    "A hit plays hurt_in1 -> hurt_in2 -> hurt (recoil + shake) -> hurt_in2 -> hurt_in1 -> idle; the prop (dagger, club, mallet) is carried through both hurt in-betweens and gone at hurt; a lethal hit plays the in-phase then holds hurt while fading",
    "A boss Magic plays gather -> rise -> cast (spell resolves) -> release -> rise -> gather -> idle; a non-boss Magic plays the attack frames without the lunge",
    "Idle enemies alternate idle / idle_b, out of phase per enemy; sleep, stun and stone freeze them on idle",
    "Palette-swap variants (gr_imp, gr_wolf) carry every frame of their base sprite, recoloured",
    "A sheet without a rig (or an old atlas without the new keys) still plays: each missing frame shows its source keyframe",
    "Approved sheets are byte-identical before and after (style lock); the party atlases are byte-identical (no regression)"
  ],
  "observable": [
    "python3 -I assets-src/gen/monster_anim.py review <id> writes a contact sheet, onion-skin strips, timed GIFs and a check report",
    "?mute=1&scenario=anim_<group>&enemyAnim=loop shows every monster cycling attack/hurt/(cast) in the browser; &enemyAnim=step steps frame by frame",
    "monsters-ai.png is a native-size (texScale 1) atlas, every page <= 4096 x 4096 native px"
  ],
  "pass_fail": [
    "monster_anim check --all: 0 failures for every generated frame (section 5.1 list, each binary) and every frame hash matches its lock file",
    "npx tsc --noEmit, npm run build, npm test: exit 0",
    "python3 -I assets-src/gen/selftest.py: exit 0 (including the new checker self-tests)",
    "Two builds of monsters_ai under different PYTHONHASHSEED values are byte-identical",
    "git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*",
    "At most 1 hold per attack / hurt / cast sequence per sprite",
    "Goblin passes the independent visual review (section 5.3) within 6 iterations, else escalated to the user",
    "Adversarial play test (section 8): every probe has a recorded verdict; no open P0/P1 artifact"
  ]
}
```

---

## 3. Frame set and timing

### 3.1 Frames per monster (names follow the party's `atk_*` / `cast_*` convention)

The in-between names follow the party puppet's naming, but each frame takes its pixels from a *monster* keyframe:
`idle`, `attack`, `hurt` or `cast`. "Target" is the keyframe the frame moves toward. `t` is the solver's position on
the source→target span: angle-space interpolation per bone (4.2), extrapolated for `t < 0` or `t > 1`.

**The near-keyframe rule (one rule, no exceptions):** every generated frame is at most **35%** of the way from its
pixel-source keyframe. That means `|t| ≤ 0.35` measured from the source keyframe, and for overshoot frames
`|t − 1| ≤ 0.35` measured from the approved frame they extend. This keeps cut-out artifacts small even where two
keyframes differ hugely (wolf, dragon and lich hurt).

Solved joints are **snapped to whole native pixels** before rendering, because half-pixel offsets duplicate or drop
columns (as the party's tweaks note). In the wind-up and recover frames, knees and feet are **pinned** to the source
keyframe, the same way `puppet.battle_targets` does it, so the feet do not slide.

| Frame | Kind | Pixel source | Recipe (default `t` from the source) | Joints moved | Purpose |
|-------|------|--------------|--------------------------------------|--------------|---------|
| `idle` | approved | - | - | - | rest |
| `idle_b` | generated | idle | upper body 1 native px down (`puppet.bob` at the waist row); floating sprites: whole sprite 1 px down | everything above the waist (translation only) | breathing |
| `atk_wind1` | generated | idle | toward attack, t = −0.20 (pull back, away from the party); body 1 px lower | crown, neck, chest, the attack arm (sh, el, hand), weapon tip; tail/neck chains for beasts; **knees and feet pinned** | anticipation |
| `atk_wind2` | generated | idle | toward attack, t = −0.35; body 2 px lower | as wind1, weapon or head chain further back; **knees and feet pinned** | coil |
| `atk_mid` | generated | attack | back toward wind2, t = 0.35 (65% attack) | every joint except the planted foot | the pass (no smear) |
| `attack` | approved | - | - | - | strike / contact |
| `atk_follow` | generated | attack | overshoot of idle→attack, t = 1.10, clamped so nothing touches the cell border | crown, chest, the attack arm, weapon tip; feet fixed | follow-through |
| `atk_recover` | generated | idle | toward attack, t = 0.30 | crown, chest, the attack arm, weapon tip; **knees and feet pinned** | settle back |
| `hurt_in1` | generated | idle | toward hurt, t = 0.35 | every joint except the feet; the prop rides its idle bone | flinch starts |
| `hurt_in2` | generated | hurt | back toward idle, t = 0.35; prop composited from idle (see "Props" below) | every joint except the feet; the prop is bound to `carry_to` | nearly recoiled |
| `hurt` | approved | - | - | - | recoil |
| `cast_gather` (boss) | generated | idle | toward cast, t = 0.25; body 1 px lower | both arms, chest, crown; feet pinned | gather |
| `cast_rise` (boss) | generated | cast | back toward idle, t = 0.35 (65% cast) | both arms, chest, crown, cloth chain; feet fixed | rise |
| `cast` (boss) | approved | - | - | - | spell stance |
| `cast_release` (boss) | generated | cast | overshoot of idle→cast, t = 1.10; casting arm 2 px higher | the casting arm, crown, cloth chain | release |

- Monsters get **8 generated frames each** (5 attack, 2 hurt, 1 idle). Bosses get **11**.
- The 6-pose attack is `atk_wind1, atk_wind2, atk_mid, attack, atk_follow, atk_recover`. Only `attack` is approved.
- The hurt return reuses `hurt_in2` and `hurt_in1` in reverse, so there are two distinct poses each way.

**Props (D8).** The props are the goblin dagger, the ogre club and the troll mallet. A prop is carried through both
hurt in-betweens and is gone at the approved `hurt`. The "fade" is **occlusion or truncation, never alpha**:
- In `hurt_in1` (pixel source idle), the prop part is posed with its idle bone as usual.
- In `hurt_in2` (pixel source hurt), the renderer uses a **per-part source**:
  - the prop part's pixels come from the idle keyframe;
  - they are bound to a named joint of the hurt pose (rig key `carry_to: hand_n`);
  - they are drawn behind the torso (`carry_mode: behind`) or cut to their distal half (`carry_mode: truncate`), so
    less of the prop shows.
- Check: in `hurt_in2` the prop's pixel count is greater than 0 and at most 60% of its count in `hurt_in1`.
- The dying sequence uses the same frames.

**Fx parts** (lich trail and crystal, Garland glow) exist only in frames whose pixel source carries them:
- The lich trail is dropped from `atk_follow`.
- The crystal and the glow appear at `cast`, stay in `cast_release`, and are absent from `cast_rise`.

### 3.2 Runtime timing (60 fps frames; `dt` is in frames as today)

**Lunge distance per sprite (D2):**

`L = round(24 + 16 * clamp((w - 55) / (185 - 55), 0, 1))`

`w` is the opaque width of the sprite's idle keyframe, in native px. Examples: goblin w = 55 → 24; wolf w = 93 → 29;
garland w = 168 → 38; lich w = 185 → 40.
- The build computes `L` and emits it per sheet as `lungePx`.
- The runtime falls back to 24 when `lungePx` is missing.

**Offsets.** `dx` is positive toward the party; `dy` is negative (up). All offsets are in screen px at scale factor 1,
then multiplied by the layout `scaleFactor` (0.5 when a big group is shrunk). The **total** offset (recoil + shake, or
lunge) is **rounded once**, after scaling.

**Attack: 31 frames (today 20). Contact, and so `attackOutDone`, at t = 14 (today 6).**

| Pose | Frames | dx |
|------|--------|----|
| `atk_wind1` | 5 | 0 → −L/6 (ease out) |
| `atk_wind2` | 6 | −L/6 → −L/4 |
| `atk_mid` | 3 | −L/4 → 0.75L (ease in) |
| `attack` | 8 | 0.75L → L in 2 frames, then held (**contact at the first `attack` frame**) |
| `atk_follow` | 4 | L → 0.58L |
| `atk_recover` | 5 | 0.58L → 0 |

For L = 24 this gives −4, −6, 18, 24, 14.

**Hurt: 20 frames (today 18).**

| Pose | Frames | dx |
|------|--------|----|
| `hurt_in1` | 2 | 0 → −3 |
| `hurt_in2` | 2 | −3 → −6 |
| `hurt` | 10 | −6, plus a shake of −3 then +3, every 2 frames (E14: −9, −9, −3, −3, …; the first hold frame recoils further, never back toward the party) |
| `hurt_in2` | 3 | −6 → −3 |
| `hurt_in1` | 3 | −3 → 0 |

Re-hit rules:
- A new hit **during the in-phase** lets the in-phase finish, then plays a full 10-frame hold.
- A new hit **during the hold** restarts the hold.
- A new hit **during the return** jumps to `hurt_in2` and then a full hold. There is never a snap to idle.
- A hit during the monster's own attack or cast is ignored (today's rule, kept).

**Dying:** `hurt_in1` 2 frames, `hurt_in2` 2 frames, then `hurt` held at dx −6 with no shake. The 30-frame fade
(`DYING_FRAMES`) runs at the same time, unchanged. `freezeDying` stays unconditional, so death can arrive mid-lunge
or mid-cast. In that case the offset **eases from the current lunge or cast offset to the dying offset** (dx −6,
dy 0) over the 4 in-phase frames, instead of jumping. This is covered by a unit test (old probe A9).
- **E13:** the dying in-phase starts from the pose on screen when the lethal hit lands: during the hold (`hurt`) it
  goes straight to the held `hurt`; during the return, `hurt_in2` starts at `HURT_REHIT_AT` and `hurt_in1` at 0. So a
  dying enemy never steps back to an earlier in-phase pose. A second `freezeDying` on a dying enemy is a no-op.
- **E17:** an enemy whose HP reaches 0 with no damage event (poison, instant death) enters dying when its fade starts
  (`BattleDisplayManager.updateEnemySprites`), so it never fades while still breathing.

**Boss cast: 30 frames (today 24). The spell resolves at the start of the hold (`CAST_OUT` = 10, today 8).** The
sprite stays planted (E15: dy 0 throughout): a frame is one texture, so the whole sprite cannot rise without the
feet leaving the plain. The cast in-betweens carry the motion with their feet pinned.

| Pose | Frames | dy |
|------|--------|----|
| `cast_gather` | 6 | 0 |
| `cast_rise` | 4 | 0 |
| `cast` | 10 | 0, held |
| `cast_release` | 4 | 0 |
| `cast_rise` | 3 | 0 |
| `cast_gather` | 3 | 0 |

**Non-boss cast (D4).** The attack frames play in place, without the lunge and (E15) without a lift:

| Pose | Frames | dy |
|------|--------|----|
| `atk_wind1` | 5 | 0 |
| `atk_wind2` | 6 | 0 |
| `attack` | 10 | 0, held (`CAST_OUT` = 11, at its start) |
| `atk_follow` | 4 | 0 |
| `atk_recover` | 5 | 0 |

**Lost turns (E1):** an enemy whose start-of-turn tick is certain to end its turn (sleep, stun, stone, or a lethal
poison tick; `BattleStateMachine.nextActorLosesTurn`) plays no wind-up, lunge or cast: its turn message shows with it
frozen on `idle`. Blind, silence, confusion and fear (a 50 % roll at execute time, decision O1) still lunge.

**Idle:** `idle` and `idle_b` alternate every 36 frames (period 72), with phase `index*17` as in the party's
`idlePose`. This applies only in idle mode. A rig may turn breathing off (`breath: false`). **Frozen enemies (D6)**
show `idle` with no breathing; see 6.2.

**Pacing effect** (for probe A16):
- An enemy attack now reaches contact 8 frames later than today (t = 6 → 14).
- After contact, the result lines (`RESULT_FRAMES` = 25 each) outlast the remaining 17 attack frames, so the turn
  grows by about **8 frames** per enemy attack.
- A cast resolves 2 frames later (8 → 10).

Every number lives in one table in the new `src/scenes/battle/enemyChoreography.ts`. `EnemyPoseController` keeps its
public API and becomes a cursor over that table. The tables are the tuning surface for the play test.

---

## 4. Generation method

### 4.1 Body-type classification (every sprite in `gen/monsters.yaml`)

| Sprite | Cell | Body type | Method | Rig notes |
|--------|------|-----------|--------|-----------|
| goblin (+ gr_imp) | 80 | biped | cut-out (humanoid joints) | dagger is a prop: hip (far side) in idle, near hand in attack, carried into `hurt_in2` with `carry_to: hand_n`; the face changes per keyframe (accepted) |
| pirate | 80 | biped + cloth | cut-out; coat tails = cloth on the torso | cutlass in the near hand; hurt lifts one knee |
| skeleton | 80 | biped | cut-out, thin-bone radii | round shield bound to the far forearm; thin limbs, so watch for joint tears |
| mummy | 80 | biped + streamers | cut-out; streamers = cloth (torso colours) moved with their nearest bone | streamers exist only in attack and hurt; frames from idle have none (accepted) |
| vampire | 80 | biped + large cape | cut-out body + **mesh warp** on the cape (chain from neck to hem) | closed cape in idle, spread in attack: wind frames keep it closed, mid/follow keep it spread |
| ogre | 128 | heavy biped | cut-out | club in idle and attack only, carried into `hurt_in2`; an overhead two-handed swing in attack |
| troll | 128 | heavy biped | cut-out | very long arms. Prop swap: the big club in idle becomes the thin two-piece stick in attack, at the wind2→mid boundary; `prop_colors` keeps both pieces as weapon. No mallet in hurt, so it is carried into `hurt_in2` |
| wolf (+ gr_wolf) | 110x80 | quadruped | **chain rig + mesh warp** (spine, neck and tail chains; 4 legs cut-out) | the hurt pose rears up: `hurt_in1` pitches the spine up about the hind hip and `hurt_in2` pitches the hurt pose down, both within the 35% rule and the rotation cap |
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
(`_absorb_orphans`, `_grow`, `outline`, `bob`, `_strip`, `_gif`) without changing them.

**`assets-src/gen/rig.py`: the generic rig.**
- **Parts table** per body type, plus overrides from the rig file: name, bone `(j0, j1)`, segmentation radius,
  `parent`, kind ∈ `rigid | chain | cloth | prop | fx`, and an optional per-part `source` keyframe (used for D8
  carrying).
- **Segmentation:** nearest bone, plus `torso_colors` / `prop_colors` / `fx_colors` rules and optional polygon masks
  from the rig file.
- **Pose solve:**
  - angle-space interpolation between two keyframes' joints, extrapolation for `t < 0` and `t > 1`;
  - a root translation lerp;
  - bone lengths kept from the pixel source (generalised `keep_lengths`, any chain);
  - pinned joints, per-frame `tweaks`;
  - then **every joint snapped to a whole pixel**.
- **Rendering:**
  - Rigid parts use an inverse affine map with nearest sampling, as in puppet.
  - Chain and cloth parts use a **piecewise-affine mesh warp**: quads along the chain, inverse mapping through the
    deformed triangles, nearest sampling. This is pure numpy, about 80 lines, with no new dependency.
  - The renderer also returns the **part-label map** of the output (which part drew each pixel), for the seam check.
- **Optional `sampler: rotsprite`:** Scale2x three times (8x), nearest rotate, then **mode-downsample** per 8x8 block.
  - Transparency counts as a colour in the vote.
  - Ties are broken deterministically: the colour of the block's centre sample wins, then the lowest RGBA value.
  - Every step only copies existing colours, so the palette is preserved by construction.
  - The default sampler is `nearest`; the goblin iterations A/B-test the two.
- **Compositing:** back to front with a per-keyframe `z` order, then puppet's `outline()` seam repair, then a final
  `paint` list of build-time pixel patches (style-lock-safe, like `face_fix`).
- **Facing:** `facing: right` is handled with a forward sign `fwd = +1`. Joints are marked in the approved image's own
  coordinates, with no mirroring.

**`assets-src/gen/anim_checks.py`:** the checks in section 5. These are pure functions on numpy arrays, so the
selftest can feed them defective images.

**`assets-src/gen/monster_anim.py`:**
- recipes (table 3.1, `t` values overridable per frame in the rig but validated against the 35% rule);
- `monster_frames(sprite) -> {name: Image}` and `lunge_px(sprite)`, used by the build;
- CLI:
  - `review [ids]` and `check [ids|--all]`;
  - `mark <id>`: 4x/8x zoomed keyframes with a 5 px coordinate grid, the current joints and bones, and the
    segmentation coloured per part (the tool for marking joints by eye);
  - `lock <id>`: writes the frame-hash lock file, see 5.1 check 12.

**Rig files:** `assets-src/gen/anim/monsters/<sprite>.yaml`. This is a subdirectory on purpose:
- `field_ai` would otherwise read a same-named file as a field config;
- puppet's `review` would otherwise glob it.

One file per sprite, plus `<sprite>.lock.json`, so the files can be owned in parallel. Schema (draft):

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
  dagger: {kind: prop, bone: [hip_f, tip], in: [idle, attack], carry_to: hand_n, carry_mode: behind}
colors: {torso: [[r,g,b], ...], prop: [...], fx: [...]}
z: {idle: [...], attack: [...], hurt: [...]}
frames:                     # per-frame recipe overrides (|t| still capped at 0.35 from the pixel source)
  atk_follow: {t: 1.06}
  hurt_in1: {t: 0.30, tweaks: {crown: [-1, 0]}}
holds: []                   # [{frame: atk_follow, reason: "..."}]; at most 1 per attack / hurt / cast sequence
paint: []                   # build-time pixel patches: [{frame, xy: [[x,y],...], rgb: [r,g,b]}]
```

**Fallback without a rig.** `monster_frames` returns `{}`. The build then writes JSON rects for the generated names
that **alias** the source keyframe's rect, so they take no atlas space, and sets `anim: false`. The runtime timeline
still plays: today's look plus the new recoil and lunge timing.

---

## 5. Quality bar and review loop

### 5.1 Automated checks (`anim_checks.py`; each one is binary, run by `monster_anim.py check` and the build)

Every generated frame is compared with its pixel source S (and its target keyframe T where noted). Thresholds that
depend on the art are **relative to the approved keyframes**, so legitimate big pose changes do not fail.

1. **Binary alpha.** Every alpha is 0 or 255.
2. **Palette lock.** The frame's colours are a subset of the union of the source keyframe files' colours plus
   `OUTLINE`.
   - Variants are checked after recolouring, against the recoloured sources.
   - `monster.recolor` leaves `OUTLINE` unchanged, so `OUTLINE` stays in the allowed set as is.
3. **No magenta / key fringe.** No pixel within RGB distance 90 of `#ff00ff`, and none with R>180, B>180, G<90.
4. **No detached pixels.** Opaque pieces are counted with **4-connectivity**. The count must be at most S's count, and
   there must be no new piece under 12 px. (`outline()` already drops pieces under 12 px; the cockatrice feathers are
   27-34 px and survive.)
5. **No seams or tears.**
   - **Seam gaps:** using `rig.render`'s part-label map, a transparent pixel inside the silhouette bbox whose
     8-neighbourhood holds at least 2 different part labels is a seam gap. The limit is 0 by default, at most 2 per
     seam if the rig sets `seam_tolerance: 2`.
   - **New holes:** an enclosed transparent piece (not 4-connected to the border) of **4 px or more** that has no
     counterpart in S fails.
6. **Silhouette continuity (relative).**
   - Opaque area is 0.85-1.15 of S.
   - Bbox height is within ±4 px per 80 px of cell height (±4 small, ±6 large, ±10 boss) of the S→T lerp.
   - For **adjacent frames of the runtime sequence** (feet-aligned): `IoU ≥ min(0.55, IoU(spanning keyframe pair) +
     0.02)`: in-betweens must not pop worse than the approved keyframes themselves (orchestrator decision during T4/T5b;
     the earlier +0.10 was unreachable for pairs overlapping 0.42-0.51 with the legs pinned to different keyframes on
     each side). The centroid moves at most `max(cap, 0.5 × keyframe centroid shift)`, with cap = 6 native px per 80 px
     of cell. The "spanning pair" is the two keyframes whose span the step lies on, e.g. idle→hurt for
     `hurt_in1`→`hurt_in2`.

   Calibration measured on the approved art (minimum IoU of a keyframe pair, and the largest centroid shifts):

   | Sprite | Keyframe-pair IoU (lowest; idle-attack / idle-hurt where two) | Centroid shift (native px) |
   |--------|----------------------------------------------------------------|----------------------------|
   | cockatrice | 0.32 | - |
   | dragon | 0.33 / 0.18 | hurt 31.9 |
   | mummy | 0.42 | - |
   | skeleton | 0.44 / 0.30 | - |
   | wolf | hurt 0.40 | - |
   | garland | - | cast 27.8 |

   With a fixed 0.55 these legitimate keyframe pairs would fail, which is why the threshold is relative (the pair's
   IoU + 0.02, capped at 0.55). T0 recomputes
   this table for all sprites and prints it from `check --all --calibrate`.
7. **Outline.**
   - The second-ring ratio is within ±0.08 of S (puppet's metric).
   - The share of silhouette edge pixels that are dark (max channel < 60) is at least `ratio(S) − 0.01`.
8. **Feet anchored.**
   - For grounded sprites, the lowest opaque row equals `bottom_row` in every frame.
   - Frames with pinned feet keep the foot pixels within ±1 px of S. Other frames keep them within ±2 px of the S→T
     lerp.
   - Judged **per foot** where the rig labels exist: a foot's pixels are the bottom 3 rows drawn by the parts ending on
     that foot joint. A foot lifted (no pixels in the bottom 3 rows) in either keyframe of the span is skipped; a foot
     grounded in its source stays pinned exactly (±1).
   - A pinned frame that releases feet (a rearing hurt: `pins: [foot_n, foot_f]` on a quadruped) is judged on the
     ground contact of the paws it keeps: nothing below the plain, each kept paw keeps its ground row and x extent
     (±1); the released paws may leave the bottom rows.
   - Floating sprites keep their one shared offset.
9. **No clipping.** No opaque pixel in the outer 1 px border of the cell.
10. **Rotation cap and near-keyframe rule.**
    - Rigid parts rotate ≤ 30° from their source (torso ≤ 20°); chain and cloth segments ≤ 25° each.
    - The recipe `t` obeys the 35% rule of 3.1.
    - Every solved joint is a whole pixel.
11. **Atlas exactness.** For every frame, the crop of its rect in the native-size atlas (`texScale` 1) is **byte-equal**
    to the generated frame, or to the recoloured frame for variants. Every page is ≤ 4096 x 4096 native px.
12. **Lock and determinism.**
    - `anim/monsters/<sprite>.lock.json` holds a sha256 per frame. `check --all` fails on any mismatch, so an
      unreviewed change to `rig.py` or a rig cannot slip through silently. `monster_anim.py lock <id>` updates the
      file deliberately, after a review.
    - Building with `PYTHONHASHSEED=0` and `=1` gives identical PNG and JSON bytes.
13. **D8 prop carry.** In `hurt_in2` the prop's pixel count is greater than 0 and at most 60% of its count in
    `hurt_in1`.
14. **Holds cap.** At most 1 `holds` entry per attack / hurt / cast sequence per sprite.

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
`goblin atk_wind2: seam gaps 3 > 0 at uarm_n/torso (31,44)`.

### 5.3 Goblin prototype loop (the visual bar)

**Iteration:** one iteration is **one rig edit** (to `anim/monsters/goblin.yaml`: joints, radii, `t` values, z order,
sampler, paint) **plus one `monster_anim.py review goblin` run**. Every automated check must be green before the
visual read.

**Visual read:** after the implementer's own read of the strips, the onion sheet, the GIFs and the in-browser loop,
an **independent reviewer** gives a verdict. The reviewer is a fresh agent given only:
- the review image paths;
- the approved sheet `approved/goblin/monster_small.png`.

It answers **yes/no per criterion below**. All must be yes.
1. Every frame reads as the same goblin: ears, nose, vest and belt shapes are unchanged, the face is not smeared, and
   there is no doubled outline.
2. The motion reads clearly at 1x game speed: anticipation is visible, contact hits, and the recoil reads as a hit.
3. There is no limb "rubber band" or stretched pixels, and no pixel crawl on a still part between adjacent frames.
4. The dagger only changes hands at a keyframe boundary, and it is carried, then hidden, through the hurt in-betweens
   without popping.
5. The feet do not slide relative to the plain during wind or recover (browser loop).

**Iteration cap.** At most **6 iterations** for the goblin. After 6, **escalate to the user** with the latest review
images, the reviewer's answers and these options:
- (a) switch to the rotsprite sampler, or to mesh warp for the arms;
- (b) reduce the amplitude (`t` closer to the keyframe);
- (c) add more build-time `paint` patches.

There is no paid option (D7).

**Other monsters:** at most 4 iterations each. After that, a frame that still fails may be set to `hold`: it aliases
its source keyframe and is logged in the rig file `holds: [{frame, reason}]` and in the JSON `holds` list. **At most 1
hold per attack / hurt / cast sequence per sprite.** Anything beyond that escalates to the user.

---

## 6. Build, runtime and test changes

### 6.1 Build (`assets-src/build_assets.py::build_monsters_ai`)

- After loading each approved entry:
  1. Call `monster_anim.monster_frames(sprite)` and append the generated frames in a fixed order
     (`MONSTER_FRAMES` / `BOSS_FRAMES` constants in `monster_anim.py`).
  2. Run the checks. **The build fails** on any check failure in a frame that is not on a `holds` list.
- Variants are then recoloured from the full frame list (existing loop).
- **Native-size atlas (D3).** The PNG is written **unscaled** (1 PNG px per art px). This needs a quarter of today's
  texture memory per frame.
- **Atlas packing.** A deterministic shelf packer, ordered by sprite id then frame order, capped at 4096 native px
  wide.
  - The estimate is about 2.4 M native px², roughly 2048 x 1200 at a 2048 cap, so a single page.
  - Every page must be ≤ 4096 x 4096 native px; the build fails beyond that.
  - JSON carries an optional `page` per sheet for future use. It defaults to 0 and the runtime supports only 0 until
    it is needed.
- **JSON (backward compatible):**
  - `scale: 2` stays as today, meaning **screen px per art px**.
  - New `texScale: 1`: **PNG px per art px**. Readers default it to `scale` when it is missing, which is the old
    pre-scaled atlas.
  - Per sheet: `frames: {<name>: [x, y]}` for every name (aliased rects for held or missing frames), plus `anim:
    true|false`, `holds: [<frame>, ...]`, `lungePx: <int>` and `sequence_version: 1`.
- `?art=legacy` and unit tests are unaffected. The monster atlas is AI-only.

### 6.2 Runtime

**`src/scenes/battle/enemyChoreography.ts`** (new, pure, about 140 lines):
- `MonsterFrame` union and `MONSTER_FRAMES`, `BOSS_FRAMES`;
- `FRAME_SOURCE` (fallback keyframe per frame);
- the timelines of 3.2 as data, with dx expressed in fractions of `L`;
- functions: `attackAt(t, L)`, `hurtAt(t)`, `castAt(t, hasCast)`, `dyingAt(t, from)`,
  `idleFrame(clock, index, breath, frozen)` (returns `idle` when frozen), and `lungePx(meta)` (falls back to 24).

**`EnemyPoseController`:** same public API, plus `state(i).pose: MonsterFrame`.
- `ATTACK_OUT` / `CAST_OUT` are derived from the tables, so `attackOutDone` lands exactly on the contact or hold frame.
- Implements the re-hit rules of 3.2 (in-phase finishes, then a full hold; return → `hurt_in2`).
- `freezeDying` stays unconditional. It remembers the current offset, and `dyingAt` eases it to the dying offset over
  the in-phase.
- Gets a per-controller idle clock.
- Receives per enemy `hasCast`, `lungePx` and `scaleFactor`.
- **Final offset:** `Math.round((lunge or recoil + shake) * scaleFactor)`, rounded once.

**`BattleArt`:**
- `MonsterAtlasMeta` gains `texScale?`, and per sheet `lungePx?`, `anim?` and `holds?`.
- `getMonsterFrames` slices rects with **`texScale`** (`x * texScale`, ...), using `texScale ?? scale`.
- It returns `textures: Record<MonsterFrame, Texture>`. Each texture comes from
  `entry.frames[name] ?? entry.frames[FRAME_SOURCE[name]] ?? entry.frames.attack`, so an old atlas still works.
- It also returns `artScale = scale / texScale` (screen px per PNG px) and `lungePx`.
- The keys `idle/attack/hurt/cast` stay for current callers until they are migrated in the same change.
- `tex.source.scaleMode = 'nearest'` is kept.

**`AiEnemyView`:**
- `sprite.scale.set(artScale * box.scaleFactor)`. Today it is `box.scaleFactor` because the PNG is pre-scaled.
  `BattleEffects.elementFlash` copies `sprite.scale`, so the glow stays aligned with no change there.
- Placement keeps using `f.scale` (screen px per art px) as today.
- **`update(dt, sprites, frozen: boolean[])`:**
  - `sprite.texture = f.textures[st.pose]`;
  - integer positions from the rounded offset.
- **Frozen enemies (D6):** `frozen[i]` is true when the enemy has `sleep`, `stun` or `stone`. It is fed from
  `BattleDisplayManager.update` via `battle.allEnemies[i]` statuses.
  - Frozen enemies show `idle` with no breathing.
  - Frozen enemies still **recoil when hit** (hurt sequence), **except stone**: a stoned enemy gets only the existing
    element or slash flash, with no pose change and no offset.
- **Draw order while lunging (D5):**
  - When an enemy enters attack mode, its sprite is moved with `parent.setChildIndex` to the **highest index among the
    enemy sprites only**, i.e. the current maximum child index of any enemy sprite. It is never placed above party
    sprites, flashes, floating numbers or windows.
  - When it returns to idle, enemy sprites are reordered to their original **relative enemy-index order**, inside the
    child-index slots they occupy.
  - Because `BattleDisplayManager.swapSprite` reinserts a rebuilt sprite at `getChildIndex(old)`, a swap during a
    lunge keeps the raised slot, and the restore step (based on enemy-index order, not on remembered indices) still
    puts it back correctly.
  - The reorder lives in `AiEnemyView` (`raise(i)` / `restoreOrder(sprites)`). `BattleDisplayManager` only passes the
    sprite list.

**Unchanged:** `BattleAnimationController` (the hooks already exist), `BattleEffects` (the element flash already
follows the texture each frame), and the dying fade.

**Dev-only preview driver** `src/scenes/battle/enemyAnimPreview.ts`, gated by `import.meta.env.DEV`:
- `?enemyAnim=loop` cycles every enemy (attack, pause, hurt, pause, cast if it has one), staggered 20 frames per
  enemy, with no battle logic.
- `?enemyAnim=step` freezes time:
  - `.` advances 1 frame and `,` goes back 1 (replayed from t = 0);
  - a corner label shows `enemy: frame name / t`;
  - the keys come from a dev-only `keydown` listener on `window`, **removed when the battle scene exits**.
- `&slow=N` divides `dt`.

The driver is hooked from one line in `BattleScene.update`. That file is a known size exception, so nothing else is
added there.

### 6.3 Tests (Vitest; existing tests are updated to the new spec, never deleted)

| File | Contents |
|------|----------|
| `tests/scenes/battle/enemyChoreography.test.ts` (new) | Frame-by-frame poses and offsets for attack (at L = 24 and L = 40), hurt, dying, boss cast and non-boss cast. Contact at t = 14 and `CAST_OUT` match the tables. Total lengths. Every frame name used is in `MONSTER_FRAMES`/`BOSS_FRAMES`. `lungePx` formula at w = 55, 93, 185 and beyond the clamps. Idle breathing phase per index, and `idle` when frozen. At `scaleFactor` 0.5, offsets are integers and rounded once (recoil + shake). |
| `EnemyPoseController.test.ts` (updated) | Lunge out, hold and back with the new frames. A hit during the in-phase finishes it, then a full hold. A re-hit during the hold or the return (no idle frame in between). A hit during attack or cast is ignored. Dying runs the in-phase and holds `hurt` at dx −6 with no shake. **Death mid-lunge** eases from the lunge offset to the dying offset with no jump (old A9). Per-enemy independence. |
| `enemyPoseFlow.test.ts` (updated) | The action resolves on the contact frame (t = 14, not before). `round_end` waits for the 31-frame attack and the 30-frame cast. A lethal hit fades while `hurt` is held. A non-boss magic action plays the attack frames without the lunge. |
| `tests/scenes/battle/AiEnemyView.test.ts` (new) | D5: an attacking enemy's sprite gets the highest child index among the enemy sprites, stays below a party sprite and a flash added later, and enemy-index order comes back on idle, including after a `swapSprite`-style replacement during the lunge. D6: a sleeping or stunned enemy shows `idle` (no `idle_b`) and still plays hurt when hit; a stoned enemy keeps `idle` and offset 0 when hit. `sprite.scale` = `artScale * scaleFactor`. |
| `tests/rendering/BattleArt.test.ts` (new or extended) | Every `MonsterFrame` returns a texture. A JSON without the new keys falls back to `FRAME_SOURCE`. A boss without `cast` falls back to `attack`. Rects are sliced with `texScale`, defaulting to `scale` for an old atlas. |
| `tests/data/assetCoverage.test.ts` (extended) | Every sheet has every `MONSTER_FRAMES` key, and sheets with `cast` have every `BOSS_FRAMES` key. The rect check at `:158-164` uses `texScale ?? scale` instead of `scale`. Every page is ≤ 4096 native px. When `anim: true`, generated rects differ from their source rect, **except the frames on the sheet's `holds` list**. At most 1 hold per sequence. Each variant has the same keys, `anim` flag and `holds` as its base. `lungePx` is within [24, 40]. `footRow < cell[1]`. |
| `tests/scenes/battle/enemyAnimPreview.test.ts` (new) | The loop driver schedules attack, hurt and cast per enemy. Step mode advances exactly 1 frame. The keydown listener is removed on exit. |
| `assets-src/gen/selftest.py` (new `test_monster_anim`) | **RED first.** Each checker in 5.1 is fed a synthetic sprite with one injected defect and must fail it: stray pixel, a new 4 px hole, a seam gap between two labels, an off-palette colour, a magenta pixel, feet moved 1 px, semi-alpha, a border pixel, a 40° rotation, `t` = 0.5, a half-pixel joint, a prop missing from `hurt_in2`, a lock-hash mismatch, an atlas crop off by one pixel. The clean version must pass. Also: a synthetic biped rig renders deterministically (two runs give equal bytes); the mesh warp of an identity mesh equals its input; rotsprite keeps the palette and breaks ties deterministically; style lock (hashes of `approved/*/monster_*.png` and `boss_*.png` unchanged by a build); party atlas unchanged (hash `battle-characters-ai.png` before and after `monsters_ai`). |

---

## 7. Rollout (tranches, ownership, per-monster checklist)

**Ownership rules:**
- **Framework files have one owner, the T0 owner.** That is `rig.py`, `anim_checks.py`, `monster_anim.py`,
  `build_assets.py`, `selftest.py`, every `src/` file, the tests and the debug scenarios. Every later framework edit
  (e.g. T5a templates, or a fix requested by a rig agent) goes **serially through that owner**.
- Rig agents own only their `assets-src/gen/anim/monsters/<sprite>.yaml` and `<sprite>.lock.json`.
- Rig agents **may rebuild the atlas locally** to test in the browser. They **must restore**
  `assets/sprites/monsters-ai.*` (`git checkout -- assets/sprites/monsters-ai.png assets/sprites/monsters-ai.json`)
  before hand-off.
- **Only the integrator** rebuilds and commits the atlas, because binary conflicts cannot be merged.

| Tranche | Scope | Owner(s) / parallelism | Depends on | Effort |
|---------|-------|------------------------|------------|--------|
| T0 framework | Everything in sections 4.2 and 6, with no rigs yet (every sprite `anim: false`, so the game looks like today plus the new timings, lunge sizes, draw order and freeze) | 1 agent, serial | - | 2 d |
| T1 goblin prototype | `goblin.yaml` + lock; gr_imp inherits; loop of 5.3 (≤ 6 iterations); sign-off before T2 | 1 agent + 1 fresh image-only reviewer | T0 | 0.5-1 d |
| T2 bipeds | pirate, skeleton | 2 agents in parallel (one file each) | T1 | 0.5 d each |
| T3 heavy bipeds | ogre, troll | 2 agents in parallel | T1 | 0.5 d each |
| T4 cloth bipeds | vampire, mummy (the cape mesh warp is proven in the T0 selftest) | 2 agents in parallel | T1 | 0.75 d each |
| T5a beast templates | `quadruped` and `bird` body templates in `rig.py` | T0 owner, serial | T0 | 0.5 d |
| T5b beasts | wolf (+ gr_wolf), cockatrice, then dragon | wolf and cockatrice in parallel; dragon after both | T5a | 0.75 d each; dragon 1 d |
| T6 bosses | garland, lich: attack + hurt + cast in-betweens, two-handed weapon, fx parts | 2 agents in parallel | **T2 and T4** (weapon and cloth lessons) | 1 d each |
| T7 integration | rebuild the atlas, `check --all` (locks), full validation (section 9), docs (AGENTS.md art table row, `ART_MONSTERS_PLAN.md` "out of scope" line, `gen/README.md`) | integrator | all rigs | 0.5 d |
| T8 adversarial play test | section 8 | 1 agent (not an implementer) | T7 | 0.5-1 d |

**Per-monster checklist** (copy into the hand-off of each rig):
- [ ] Rig file under `anim/monsters/`; joints marked with `monster_anim.py mark <id>` overlays checked by eye.
- [ ] Props (with `carry_to` / `carry_mode`), fx and cloth assigned (colour rules or masks); z order per keyframe.
- [ ] `monster_anim.py check <id>`: 0 failures; at most 1 justified `holds` entry per sequence.
- [ ] Review strips, onion sheet and GIFs read; the visual criteria of 5.3 hold (adapted to the creature).
- [ ] Feet on the plain in the `_stage.png` output; no clipping in overshoot frames.
- [ ] Variant (if any) rendered and checked after recolour.
- [ ] In-browser `?mute=1&scenario=anim_<group>&enemyAnim=loop` watched for at least 3 cycles; `&enemyAnim=step`
      screenshot of every frame attached to the hand-off.
- [ ] `monster_anim.py lock <id>` run after the final review; local atlas restored.
- [ ] Iteration count recorded (one iteration = one rig edit + one review run; ≤ 4, or ≤ 6 for the goblin).

**New debug scenarios** (in `assets/data/debug-scenarios.yaml`, T0). Every scenario loads with
`?mute=1&scenario=<id>`, plus `&enemyAnim=loop` or `&enemyAnim=step`.

| Scenario | Purpose / enemies |
|----------|-------------------|
| `anim_goblin` | goblin, gr_imp |
| `anim_goblin_cast` | D4: two goblins whose `enemyAi` always chooses magic (non-boss cast reuses the attack frames, no lunge) |
| `anim_bipeds` | goblin, pirate, skeleton, mummy, vampire, gr_imp (6 small: tests stacking and D5 draw order) |
| `anim_large` | ogre, troll, dragon |
| `anim_beasts` | wolf, gr_wolf, cockatrice |
| `anim_boss_garland` | garland, `enemyAi` with fight and magic weighted **1:1** |
| `anim_boss_lich` | lich, goblin, goblin |
| `anim_crowd` | **nine large enemies** (e.g. ogre and troll mixed), which is wider than the area and triggers the half-size layout (`scaleFactor` 0.5) |
| `anim_status` | goblins plus a party whose spells can sleep / stun (for D6 and probe A18) |

---

## 8. Adversarial play test (T8): graphical artifacts

Run with Playwright on `npm run dev`. Every URL includes `&mute=1`. The dev game object is `window.__game`. Evidence
is a screenshot per finding (step mode for exact frames), with a severity: P0 (broken or wrong art), P1 (visible
artifact in normal play), P2 (only visible when stepping).

| # | Probe | How | Expect |
|---|-------|-----|--------|
| A1 | Frame popping | `enemyAnim=step` through each sequence of every sprite | no jump in size or position larger than the motion; no one-frame flash of idle in the middle of hurt or attack |
| A2 | Pixel grid | screenshots at 100%, at a window resized to an odd width, and at browser zoom 125% | no blurred or half-pixel art (nearest scaling of the native atlas); integer positions (read sprite positions through `window.__game` in dev) |
| A3 | Half-size layout | `anim_crowd` (nine large enemies) | offsets scaled and rounded once; shake still visible; no lunge overlapping a neighbour badly; no clipped frames |
| A4 | Draw order (D5) | `anim_bipeds` loop, plus a real battle with a party flash and floating numbers active | the lunging enemy is drawn above the other enemies only, never above party sprites, flashes, numbers or windows; order restored on idle; no flicker between neighbours |
| A5 | Damage numbers and flash order | real battle: party hits a goblin; spell with an element on a boss | the number spawns at contact; the element glow follows every in-between texture at the right scale (`sprite.scale` copied); the glow never shows the previous frame |
| A6 | Hurt next to an attacker | two enemies: while one is lunging, the party hits the other with a multi-target spell (no counter mechanic exists) | the attacker keeps attacking; the hit enemy recoils independently |
| A7 | Rapid re-hits | multi-target spells hitting the same enemy in quick succession, and confirm-mashing through result lines | in-phase finishes, then a full hold; no snap back to idle between hits |
| A8 | Death | lethal hit during each phase (in, hold, return, idle_b) | in-phase then a held `hurt`; the fade is smooth; no frame swap after alpha < 0.5; sprite hidden at the end |
| A9 | Death mid-lunge | covered by the unit test (6.3); in the browser, only a visual spot check in a debug scenario | the offset eases to the dying offset; `round_end` does not hang |
| A10 | Bosses | `anim_boss_garland` (fight and magic 1:1) and `anim_boss_lich`, cast and fight | fx parts appear and disappear only at the planned frames; no cape tearing; feet on the plain line through every cast frame (no lift: dx = dy = 0, E15) |
| A11 | Palette variants | `anim_goblin`, `anim_beasts` | gr_imp and gr_wolf match their base frame for frame; no un-recoloured pixels (outline unchanged by design; check the eye colours) |
| A12 | Magenta / key fringe | screenshot over a dark and over a light background, zoomed in | no pink edge pixels |
| A13 | Idle breathing | 5 identical goblins idle for 10 s | out of phase, 1 art px only, no shimmer on the feet |
| A14 | Placeholder / missing art | test-only atlas without one sheet | placeholder box still lunges and recoils; console warning; no crash |
| A15 | Load race | debug battle before the atlas has loaded (`upgradeToArt` path) | an animation in progress continues on the swapped sprite, and draw order is restored afterwards |
| A16 | Pacing | 3-goblin battle, 5 rounds with a stopwatch | expected: about +8 frames per enemy attack (contact t = 6 → 14; the 25-frame result lines outlast the remaining 17 attack frames) and +2 frames per cast; the reviewer judges whether that is acceptable, otherwise tune the tables |
| A17 | Victory / escape / game over | win with an enemy mid-recoil; run away | no sprite left frozen on an in-between; scene exits cleanly; the step-mode key listener is gone |
| A18 | Status freeze (D6) | `anim_status`: sleep and stun a goblin, and stone one if any source exists (debug scenario `enemyAi` or a test hook); the party-side labels are `slep` and `hold` | sleeping or stunned enemies stop breathing but still recoil when hit; a stoned enemy shows only the flash; breathing resumes when the status ends |
| A19 | Performance | `anim_crowd`, reading `__game.app.ticker.FPS` | 60 fps; texture memory of the native atlas noted |
| A20 | Prop carry (D8) | `anim_goblin`, `anim_large` step mode through hurt | dagger, club and mallet are partly hidden in `hurt_in2` and gone at `hurt`; no alpha fading, no pop |

Findings go to a play-test report written by the T8 agent (a new `docs/PLAYTEST_ENEMY_ANIM_<date>.md`, at that time,
following the existing PLAYTEST docs). P0/P1 items go back to the rig owner or the T0 owner, with at most 2 fix
rounds before escalation to the user.

---

## 9. Validation commands

```bash
# Python art pipeline
python3 -I assets-src/gen/selftest.py
python3 -I assets-src/gen/monster_anim.py check --all              # checks + lock files
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

## 10. TODOs

- [ ] T0.1 Selftest RED: synthetic defect fixtures + `test_monster_anim` (priority: high, effort: 2.5h)
- [ ] T0.2 `anim_checks.py` until the selftest is GREEN, with calibration output (priority: high, effort: 4h)
- [ ] T0.3 `rig.py` biped template, segmentation, angle solve with pins and pixel snap, rigid render, label map, outline, paint, per-part source for D8 carry (priority: high, effort: 6h)
- [ ] T0.4 Mesh warp + rotsprite sampler (deterministic tie-break) + their selftests (priority: high, effort: 4h)
- [ ] T0.5 `monster_anim.py` recipes (35% rule), `monster_frames`, `lunge_px`, CLI `review`/`check`/`mark`/`lock` (priority: high, effort: 4h)
- [ ] T0.6 `build_monsters_ai`: generated frames, checks gate, native shelf packer, `texScale`, aliased rects, `anim`/`holds`/`lungePx` (priority: high, effort: 3h)
- [ ] T0.7 `enemyChoreography.ts` + tests (RED then GREEN): L-relative lunge, re-hit rules, dying ease, non-boss cast, frozen idle, single rounding (priority: high, effort: 3.5h)
- [ ] T0.8 `EnemyPoseController` / `AiEnemyView` / `BattleArt` migration (`texScale`, `artScale` sprite scale) + updated tests (priority: high, effort: 3h)
- [ ] T0.9 D5 draw order (`raise` / `restoreOrder`, swap-safe) + `AiEnemyView.test.ts` (priority: high, effort: 2h)
- [ ] T0.10 D6 freeze: `frozen[]` from `BattleDisplayManager.update` (sleep, stun, stone; stone = flash only) + tests (priority: high, effort: 2h)
- [ ] T0.11 `assetCoverage` extension (`texScale`, holds exemption, lungePx), BattleArt fallback test (priority: high, effort: 1.5h)
- [ ] T0.12 `enemyAnimPreview.ts` (listener removed on exit) + `anim_*` scenarios incl. `anim_goblin_cast`, `anim_status`, `anim_crowd` (9 large) + test (priority: medium, effort: 2.5h)
- [ ] T0.13 Full validation (section 9) with every sprite `anim: false` (priority: high, effort: 1h)
- [ ] T1 Goblin rig, ≤ 6 iterations, fresh-agent yes/no sign-off, lock (priority: high, effort: 4-8h)
- [ ] T2 pirate, skeleton rigs (parallel) (priority: medium, effort: 4h each)
- [ ] T3 ogre, troll rigs (parallel; troll prop swap at wind2→mid) (priority: medium, effort: 4h each)
- [ ] T4 vampire, mummy rigs with cloth warp (parallel) (priority: medium, effort: 6h each)
- [ ] T5a quadruped + bird templates (T0 owner) (priority: medium, effort: 4h)
- [ ] T5b wolf, cockatrice (parallel), then dragon (priority: medium, effort: 6h / 6h / 8h)
- [ ] T6 garland, lich incl. cast in-betweens (parallel; after T2 and T4) (priority: medium, effort: 8h each)
- [ ] T7 Integration rebuild, locks, determinism, docs updates (priority: high, effort: 4h)
- [ ] T8 Adversarial play test + fix rounds (priority: high, effort: 4-8h)

---

## 11. Risks

- **R1 Large silhouette changes** (wolf, dragon and lich hurt; vampire cape). Cut-outs beyond about 30° tear.
  Mitigation: the 35% near-keyframe rule, mesh warp, the rotation cap check, relative continuity thresholds, at most
  1 hold per sequence, escalation to the user.
- **R2 Thin parts** (skeleton bones, mummy streamers, the troll's split stick). Segmentation bleeds or tears.
  Mitigation: per-part radii, colour rules, masks, the label-map seam check.
- **R3 Prop changes.**
  - Goblin dagger, ogre club and troll mallet are carried through hurt by occlusion or truncation (D8).
  - The **troll prop swap**: the big club in idle becomes the thin two-piece stick in attack, at the wind2→mid
    boundary. This is the most visible pop. It is flagged for review and probe A1.
  - Lich and Garland fx appear only at keyframe boundaries.
- **R4 Atlas size.** About 2.4 M native px². Native-size pages with a 4096 guard leave wide headroom.
- **R5 Pacing.** About +8 frames per enemy attack and +2 per cast. Many enemies feel slower. Mitigation: the tables
  are data; tune in A16.
- **R6 Shared code.** Touching `puppet.py` could change the approved party frames. Mitigation: new modules only, the
  party atlas byte-identical gate, and frame-hash locks for monsters.
- **R7 Joint marking by eye is slow and error-prone,** especially on 200 px bosses. Mitigation: the `mark` overlays
  with a grid.
- **R8 Existing tests encode the old timings.** They are rewritten to the new spec in T0 (not deleted). Reviewers check
  that the rewritten expectations still test behaviour (contact timing, interruption rules).
- **R9 Draw-order bugs (D5).** Reordering children can interact with `swapSprite` and with effects added to the same
  container. Mitigation: raise only within the enemy-sprite slots, restore by enemy-index order, unit test, probe A4.

All decisions are made; the table below records them. Anything the plan cannot meet without AI, or beyond the holds
cap, escalates to the user.

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

How the body applies D2, D3, D5, D6 and D8:
- **D2:** the formula and `lungePx` in 3.2.
- **D3:** `scale` / `texScale` and native packing in 6.1-6.2.
- **D5:** enemy-slots-only reordering in 6.2.
- **D6:** "paralysis" is the `stun` status. Sleep, stun and stone freeze breathing; frozen enemies still recoil when
  hit, except stone.
- **D8:** the "fade" is occlusion or truncation of the prop, never alpha (3.1, check 13).

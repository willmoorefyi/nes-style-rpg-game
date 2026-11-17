# Kneel / dazed pose plan (pass K), rev 1

Status: rev 1, written by the planner; next step is the momus review. Nothing here is implemented yet.
Budget: **0 paid images**. No Gemini, no Bedrock and no other AI image call anywhere in pass K. Every new frame is a
cut-out re-pose of approved pixels, like the existing in-betweens.

## 0. Summary

In FF1 a weakened or disabled actor shows a **kneel** pose. This game shows something else: a dazed enemy plays a
small slump (`daze` / `daze_b`), and a dazed hero just holds `ready`. Pass K adds one kneel state, with
transition-in, a held kneel with a small breath and transition-out, for **all 123 rigged monster sheets** and **all
12 hero classes**. The Chaos colossus forms F2 to F4 are exempt (D-K12).

- **K1:** the shared tooling (Python kneel key and in-betweens, hero puppet kneel, checks, review sheets), the TS
  runtime (pose selection, timing, fallbacks, debug keys, scenario) and a **pilot**: goblin and wolf (enemies),
  warrior and white_mage (heroes).
- **U1:** the user reviews the pilot (still sheets, GIFs, an in-battle composite and the browser scenario).
- **K2 / K3:** the rollout in parallel worktrees, batched by body type: K2 covers the bodies the pilot proved
  (biped, quadruped, heroes) and K3 the new body templates, after a probe round.
- **K4:** integration, the atlas build, the play test and the docs.

The key design choice is D-K4. A kneel is too far from any approved keyframe for the existing in-between rules
(the 35 % near-keyframe rule and the 30 deg rotation cap). So each sheet gets a **derived `kneel` key**, built from
the idle key by joint targets and locked as `kf:kneel` (the FW-H precedent). The in-betweens between `idle` and
`kneel` then follow the normal rules.

## 1. Current state (verified at a97ae69)

| Fact | Where |
|---|---|
| `sleep` and `stun` have `posture: daze`; `stone` is `stone`, `fear` is `tremble`, `frozen` (reserved) is `still` | `assets/data/status-visuals.yaml:23,28` |
| Posture rank: stone 4 > daze 3 > still 2 > tremble 1 | `src/scenes/battle/fx/statusRules.ts:15` |
| A dazed enemy sways `daze` / `daze_b` every `DAZE_PERIOD` 48 frames | `src/scenes/battle/enemyChoreography.ts:158-175` |
| **Correction to the brief:** every one of the 123 sheets in `assets/sprites/monsters-ai.json` has its **own** `daze` / `daze_b` cells, generated since pass F by the recipe `monster_recipes.py:51-54` (t 0.15 toward `hurt`, legs pinned, head 1 px down). So today's dazed enemy shows a slight slump, not `hurt_in1`. `FRAME_FALLBACK daze -> hurt_in1` (`enemyChoreography.ts:34`) applies only to an old atlas or a held frame. The `LATE_FRAMES` comment ("no atlas has yet", `:18-21`) is stale. | atlas json; `selftest_daze.py` |
| Why the daze is so small: the plan's t 0.25 draft failed 9 of 12 rigs (arm swings over the 30 deg cap, bent shins, a drop out of the bbox band) | `monster_recipes.py:47-50` |
| Enemy poses: idle / attack / cast / hurt / dying cursor per enemy; `setPosture` comes from the presented snapshot each frame | `EnemyPoseController.ts:105-110,211-221`; `BattleDisplayManager.ts:157` |
| Hero: hp <= 0 shows `down`; stone or still shows `ready`; daze shows `ready` (`hurt` while flashing); then victory, override, hurt and idle breath | `BattleDisplayManager.ts:172-182` |
| Hero atlas: 12 rows x 14 columns (6 approved + 8 puppet in-betweens), 2240x1920 px; every class has `inbetweens: true` | `assets/sprites/battle-characters-ai.json`; `build_assets.py:88-129` |
| **All 12 classes have joint files** (`assets-src/gen/anim/<class>.yaml`, with ready / attack / cast joints). 5 are `robed: true` (black_mage, black_wizard, red_wizard, white_mage, white_wizard), and the puppet skips their leg parts. No class lacks joints. | `anim/*.yaml`; `puppet.py:208-237` |
| The approved hero `down` is a **collapsed crouch**, not a lying pose: 0.63 to 0.77 of the `ready` height (measured: warrior 44/68, white_mage 51/66, master 45/71) | `approved/<class>/battle.png` |
| Heroes have no lock files and no anim checks beyond `puppet.check` (ring, px 0.88-1.12, height +-4, pieces <= 2) | `puppet.py:441-452` |
| Rig bodies (from `anim/monsters/*.yaml`): biped 49, quadruped 28, floating 14, serpent 8, arthropod 7, bird 5, naga 5, blob 4, rooted 2, swimmer 1 = 123 rigs, 123 lock files | section 9 lists |
| Presets and kinds that need care: `preset: mechanical` (rotation cap 15) guardian, iron_golem, soldier, warmech; `kind: cloth` garland, lich, mummy; `kind: fx` garland, lich, hollow_seraph; FW-Q partial rigs astos, black_widow, chimera, crawler | rig files |
| Locks: `lock_match` fails a generated frame with no lock entry (`hash differs`) and a lock entry with no frame (`locked but not generated`). So any **new** generated frame on an unlocked rig makes `check --all` fail. | `anim_rules.py:56-60` |
| Atlas: 9 pages, each <= 2048 a side; every page group starts a new page; a sheet never straddles pages | `monster_pages.py`; atlas json |
| Anchors `homeX` are measured over `HOME_FRAMES`, which include `daze` / `daze_b` | `monster_atlas.py:39` |
| Weak-HP conventions: the panel turns red at `hp / max <= 0.25` (`src/ui/PartyPanel.ts:103`); `retryAdvice` uses `< 0.25` (`BattleRetry.ts:88-96`) | |
| Colossus forms F2-F4 draw through `ColossusView` and have no posture handling | `src/scenes/battle/colossus/` (no `posture`) |
| Line counts (AGENTS ceiling: 250 unless listed): `EnemyPoseController.ts` 248, `AiEnemyView.ts` 242, `BattleDisplayManager.ts` 231, `CharacterAtlas.ts` 237, `BattleArt.ts` 228, `BestiaryPreview.ts` 230, `enemyChoreography.ts` 180, `BattleAnimationController.ts` 303 / 308, `BattleScene.ts` 539 / 594. Python: `monster_anim.py` 326, `rig.py` 337, `puppet.py` 540 (already over; add no lines beyond the hooks) | `wc -l` |

**Measured atlas cost** (the real `monster_pages.pack_pages`, with k extra cells per sheet and today's group order):

| extra cells / sheet | pages | page sizes (act-1 group first) | RGBA bytes if every page is loaded |
|---|---|---|---|
| 0 (today) | 9 | 2040x1872, ... | 114.8 MB |
| 2 | 10 | act-1: 2048x1992 + 1970x160 | 129.8 MB |
| 4 (this plan) | 12 | act-1: 2032x2016 + 2016x416 | 146.3 MB |

With +4 cells the act-1 group **spills onto a second page**. Pass V's "act-1 sheets on page 0" no longer holds
(D-K13).

## 2. Decisions

R = needs the user's ruling (the recommended default is used until the user rules); otherwise planner default,
open to momus.

- **D-K1 Triggers.** Heroes kneel when `hp > 0 && hp * 4 <= maxHp` (weak; the same 25 % as the red panel), or when
  the posture is `daze` (sleep, stun). Enemies kneel when the posture is `daze`. All values come from the presented
  snapshot. **R1:** do enemies also kneel at low HP (FF1 monsters had no poses)? Default **no**. If the ruling is
  yes, enemies use the hero rule and rise to act (D-K3). **R2:** does poison make an actor kneel? Default **no**
  (poison keeps its tint and bubbles).
- **D-K2 Priority, heroes, first match wins:** `down` (hp <= 0) > stone / still (`ready`, grey for stone; the kneel
  is cut at once, with no transition) > **daze kneel** (it never acts; a hit shakes the kneel and never shows
  `hurt`; victory does not lift it) > victory (a weak hero rises, then shows `victory`) > action override (a weak
  hero rises inside the action, D-K3) > `hurt` flash (standing heroes only; a kneeling weak hero shakes instead) >
  **weak kneel** > breathing idle. Fear's tremble is a pivot offset on top of any of these, as today.
  **Enemies:** dying (from a kneel it keeps the current kneel frame while it eases and fades; no `hurt` frames) >
  stone (cut at once) > attack / cast > hurt (a kneeling enemy shakes +-3 px for 14 frames on its kneel frame) >
  daze kneel > tremble > breathing.
- **D-K3 Rising to act.** A weak hero (and an enemy under R1) does not add time. The rise is folded into the action:
  for the first `KNEEL_OUT_FRAMES` (6) after a pose override starts on a kneeling actor, the sprite shows
  `kneel_in2`, then `kneel_in1`, while the override's offsets play as usual. Then the override poses take over. When
  the override clears and the actor is still weak, `kneel_in` plays again. `BattleAnimationController.ts` (at its
  ceiling) is not changed.
- **D-K4 Derived kneel key.** Monsters: `kneel` is a new **derived keyframe** made from `idle` by body-template joint
  targets (section 4) plus per-rig `kneel:` overrides. It follows the FW-H pattern: optional keyframe paint (FW-P,
  <= 160 px) and locked as `kf:kneel`. Heroes: `kneel` is made from `ready` joints (variant A), or from `ready`'s
  upper body over the approved `down` key's lower body (variant B: needs `battle.down` joints for hip, knees and
  feet, or the robe hem). The pilot renders both and **R3 / U1** picks one per hero group (armoured / robed).
- **D-K5 Frames.** Four new frames per sheet / class: `kneel_in1` (from idle toward kneel, t 0.33), `kneel_in2`
  (from kneel toward idle, t 0.33), `kneel` (held), `kneel_b` (the breath: the body's `idle_b` operation applied to
  `kneel`). The rise reuses `kneel_in2` and `kneel_in1` in reverse. No `kneel_out` frame.
- **D-K6 Keep `daze` / `daze_b`.** They stay generated, locked and in the atlas, byte-identical. The runtime stops
  drawing them once a sheet has `kneel` (they remain the fallback for a sheet without one). This is the only option
  with zero lock churn. **R4:** retire them later to save 2 cells per sheet (10 pages instead of 12). Default
  **keep**.
- **D-K7 Opt-in per rig.** Kneel frames are generated only for a rig or hero file with a `kneel:` block, so
  `check --all` stays green while the rollout is in progress. A sheet without the block lists the kneel names in
  the atlas, aliased along the fallback chain (no extra cells). K4's gate requires all 123 + 12.
- **D-K8 Anchors unchanged.** Kneel frames are **not** added to `HOME_FRAMES`, `RANGED_FRAMES`, `travelTop`,
  `lungeRight` or `idleBox`, so every sheet's layout and attack geometry stays byte-identical. A kneel frame must
  still fit inside its cell (the clipping check).
- **D-K9 Floating drop.** Floating and swimmer figures sit on the 2 px bottom margin (the FW-C lift), so they cannot
  sink inside their cell. Their kneel frames droop in place, and the sink is a runtime offset, `kneelDrop` (native
  px, a new optional atlas field, 6 px per 80 px of cell height). It is eased over the in / out frames and applied
  by `AiEnemyView`.
- **D-K10 Locks extend only.** Each opted-in rig's lock gains exactly `kf:kneel`, `kneel_in1`, `kneel_in2` and
  `kneel_b`, and no existing entry changes. Hero kneel frames get a new lock file,
  `assets-src/gen/anim/<class>.lock.json`, with only the 4 kneel hashes; the existing hero in-betweens stay
  unlocked, as today. The 14 existing hero atlas columns must stay byte-identical.
- **D-K11 Mechanical preset.** guardian, iron_golem, soldier and warmech keep their 15 deg cap. Their kneel is a
  "power-down squat": each leg bone moves <= 15 deg, the torso sinks and the head and arms droop. They get their own
  height band (section 4).
- **D-K12 Colossus exempt.** chaos_orrery, chaos_horizon and chaos_horizon_core (full-res painted art outside the
  rig pipeline) do not kneel. A dazed colossus shows its status icon and overlay only, as today. Chaos F1 (`chaos`,
  an atlas biped) kneels like any boss. **R5:** confirm the exemption. Default **exempt**.
- **D-K13 Atlas growth.** Accept up to 12 pages (each <= 2048x2048) and the act-1 group on 2 pages. **R6:** accept
  this, or rule D-K6 retirement. Default **accept**.
- **D-K14 Review gate for new bodies.** After the K3-0 probes (one sprite per new body template), a **second user
  review U2** of one contact sheet. **R7:** hold U2, or let the orchestrator self-review against the U1 bar. Default
  **hold U2**.
- **D-K15 Bestiary.** The bestiary's `daze` step plays kneel in, hold (`dazeHold` 144) and out when the sheet has
  `kneel` (`hasKneel = textures.kneel !== textures.daze`); otherwise it plays today's daze. The label "Dazed" stays.

## 3. Frame and timing spec (60 fps frames; pure tables)

| Sequence | Frames (length) | Notes |
|---|---|---|
| in | `kneel_in1` 4, `kneel_in2` 4, then hold | starts when the presented trigger turns on (`KNEEL_IN_FRAMES` 8) |
| hold | `kneel` / `kneel_b`, alternating every `KNEEL_PERIOD` 48, offset `index * 17` per actor | replaces `DAZE_PERIOD` for kneeling sheets |
| out | `kneel_in2` 3, `kneel_in1` 3, then idle | starts when the trigger turns off (`KNEEL_OUT_FRAMES` 6) |
| reversal | a trigger flip mid-transition continues from the frame on screen (time mirrored), never a jump | unit-tested |
| hit while kneeling | kneel frame held; hero pivot shake +-2 px, 12 frames; enemy dx shake +-3, 14 frames | no `hurt` pose |
| rise to act (D-K3) | first 6 override frames show `kneel_in2` 3, `kneel_in1` 3 | offsets of the override unchanged |
| floating `kneelDrop` | dy 0 -> drop over `in`, held, drop -> 0 over `out` (ease out / in) | D-K9 |

**TS contract.** `MonsterFrame` and `MONSTER_FRAMES` gain `kneel_in1 | kneel_in2 | kneel | kneel_b`. `FRAME_SOURCE`
maps them to `idle`. `FRAME_FALLBACK`: `kneel -> daze`, `kneel_b -> daze_b`, `kneel_in2 -> daze`,
`kneel_in1 -> idle`, so an old atlas shows today's daze. `LATE_FRAMES` drops `daze` / `daze_b` (stale) and holds
the four kneel names until K4, then the kneel names leave it. Hero `BATTLE_POSES` appends the same four names and
`POSE_FALLBACK` maps them to `ready` (today's dazed look). The Python `monster_recipes` (`MONSTER_FRAMES`,
`FRAME_SOURCE`, `FALLBACK`, `SEQUENCES["kneel"] = [idle, kneel_in1, kneel_in2, kneel, kneel_b]`, `SPAN["kneel"] =
(idle, kneel)`) mirrors it, and `selftest_kneel.py` checks that the two tables match.

## 4. Per-body kneel spec (joint targets; lengths L are measured on the rig's own idle key; px are per 80 px of cell)

The targets are data in a new `gen/kneel_templates.py`, keyed by body (and preset). A rig's
`kneel: {tweaks: {joint: [dx, dy]}, drop: n, paint: [...]}` adds to them. The derived key is rendered by the rig
renderer from the `idle` pixels; any part turned more than 30 deg uses the rotsprite sampler (`rig_rotsprite.py`).

Monsters face right and heroes face left; `n` = near, `f` = far.

| Body (count) | Kneel | Joint targets (template) | Height band (kneel / idle opaque height) |
|---|---|---|---|
| biped (46 + 3 mechanical) | far knee down, near foot planted, torso low, head bowed, weapon lowered | hip down 0.8 L_thigh; `foot_n`, `toe_n` pinned, `knee_n` IK (near shin about vertical); `knee_f` on the ground row, 0.3 L_thigh behind the hip, `foot_f` / `toe_f` back along the ground (far shin horizontal); chest +10 deg forward lean; crown 15 deg down about the neck; hands down 0.5 L_thigh; weapon tip <= 30 deg toward the ground; cloth (cape, robe) follows its bone; fx parts follow their bone | 0.68-0.85 |
| mechanical preset (iron_golem, soldier, warmech; quadruped guardian likewise) | power-down squat (D-K11) | hip down by the IK reach with every bone <= 15 deg; head / arms droop <= 15 deg | 0.85-0.95 |
| quadruped (28) | haunches and forelegs folded, belly low, head low | hip down 0.6 L_hindthigh; chest down 0.6 L_upperfore; elbows to the ground, forearms forward along the ground; hocks to the ground; neck down 0.5 L_neck; snout 15 deg down; tail tip to the ground row; wings (dragons) folded, <= 30 deg | 0.60-0.85 |
| bird (5; includes allosaurus and tyrannosaur) | grounded crouch, wings drooped | hip down to 0.35 L_leg above the ground; knees fold forward; feet pinned; wing tips 30 deg down; neck low, head 15 deg down; tail to the ground | 0.60-0.85 |
| floating (14) | droops and sinks (no ground) | squash sy 0.90 about the bottom row; head / eye 2 px down; arms, fins and wings hang 20 deg; `kneelDrop` 6 px (D-K9) | 0.86-0.95 (frame only) |
| swimmer (1) | as floating | as floating, on the `core` root | 0.86-0.95 |
| serpent (8) | coil compressed, head lowered | every chain joint above the ground lowered by 40 % of its height; head to 2 head radii above the ground; maw 20 deg down; ground joints pinned | 0.55-0.85 |
| rooted (2) | stalks droop | lead and stalk joints lowered by 40 %; root mass squash sy 0.94; root pinned | 0.80-0.95 |
| naga (5) | upper body slumps into the coils | torso forward 20 deg, down 0.3 L_torso; coils sy 0.90 about the ground; arms hang | 0.65-0.85 |
| arthropod (7) | legs splay, body on the ground | root down to 2 px above the ground with leg tips pinned (IK splay); head and pincers / stinger 20 deg down | 0.60-0.85 |
| blob (4) | squash | `squash: {sx: 1.12, sy: 0.80}` about the bottom centre (anim_squash) | 0.75-0.85 |
| heroes (12) | one knee down, torso low, head bowed, weapon held low (must not read as the `down` slump) | A: as the biped, from `ready` (robed: rows below `hip` squashed to sy 0.55 about the foot row, upper body moved down by the same amount); B: `ready` upper body over `down`'s lower body (`battle.down` joints) | `[max(0.72 H_ready, H_down + 4), 0.88 H_ready]` |

The bands are first guesses. They may change **only in K1**, logged in section 13; after U1 they are frozen.

## 5. Pipeline changes (Python)

| File | Change | Limit |
|---|---|---|
| `gen/kneel_templates.py` (new) | section 4 data per body / preset | <= 200 lines |
| `gen/kneel.py` (new) | `kneel_key(sprite, rig, keys, meta)` builds the derived key (opt-in `kneel:` block), applies the paint, returns the image and joints; the recipes for `kneel_in1` / `kneel_in2` / `kneel_b` | <= 250 |
| `gen/monster_recipes.py` | the frame names, `FRAME_SOURCE`, `FALLBACK`, `SEQUENCES`, `SPAN` (section 3) | +12 lines |
| `gen/monster_anim.py` | 1 hook in `load_entries` (add the `kneel` key when opted in) and 1 in `generate` (the kneel recipes) | <= +10 lines |
| `gen/monster_keys.py` | `kf:kneel` joins the derived keys for lock and paint (as `kf:hurt` for FW-H) | <= +10 |
| `gen/kneel_checks.py` (new) | K-checks (section 7) | <= 200 |
| `gen/monster_check.py` | call the K-checks for kneel frames; kneel frames skip the per-foot x check and F5 in favour of K-ground | <= +10 |
| `gen/monster_atlas.py` | the new names; `kneelDrop` written for floating / swimmer sheets; anchors untouched (D-K8) | <= +8 |
| `gen/puppet_kneel.py` (new) | hero variants A / B, `battle.down` joint loading, hero K-checks, hero lock read / write | <= 250 |
| `gen/puppet.py` | 1 hook: `battle_inbetweens` also returns the kneel frames for an opted-in class | <= +4 (file is already 540) |
| `build_assets.py` | `all_poses` gains the 4 kneel columns; an unopted class repeats `ready` | <= +3 |
| `gen/kneel_review.py` (new) | review sheets, GIFs, stage composite, pilot sheet (section 8) | <= 250 |
| `gen/kneel_tools.py` (new) | `coverage`, `lockdiff --base REV`, `party-diff --base REV`, `pages` | <= 200 |
| `gen/selftest_kneel.py` (new) + 1 line in `selftest.py` | section 7 | <= 250 |
| `anim/monsters/<id>.yaml`, `anim/<class>.yaml` | `kneel:` block per sprite / class (data only) | rollout |

Commands added: `python3 -I assets-src/gen/kneel_review.py <ids...>`, `python3 -I assets-src/gen/kneel_tools.py
{coverage|lockdiff|party-diff|pages}`, and `python3 -I assets-src/gen/puppet.py lock <class>` (kneel frames only).

## 6. Runtime changes (TS)

| File | Change |
|---|---|
| `src/scenes/battle/kneelChoreography.ts` (new, pure, <= 150 lines) | tables of section 3; `class KneelTrack { set(on, clock); frame(clock): KneelFrame \| null; rising(clock) }`; `isWeak(hp, maxHp)`; the fallback names |
| `src/scenes/battle/partyPose.ts` (new, pure, <= 120) | `partyPoseOf({hp, maxHp, posture, victory, override, overrideAge, hurt, kneel})` returns the pose and the shake: the D-K2 table. `BattleDisplayManager.partyPose` delegates to it, so that file shrinks. |
| `src/scenes/battle/enemyPoseTypes.ts` (new) | `EnemyState`, `EnemyAnimConfig`, `PoseState`, `DEFAULTS` moved out of `EnemyPoseController.ts` (248), which gains a `KneelTrack` per enemy driven by `setPosture` (and `setWeak` under R1) and must end <= 250 |
| `enemyChoreography.ts` | the frame names and fallbacks (section 3); `idleFrame` keeps `daze` only for sheets without kneel |
| `AiEnemyView.ts` (242) | applies `kneelDrop` (<= +5 lines; extract the stone texture swap into `fx/stoneTextures.ts` if it would pass 250) |
| `BattleArt.ts` | reads the optional `kneelDrop` and `hasKneel` per sheet |
| `CharacterAtlas.ts` | the 4 names in `BATTLE_POSES`; `POSE_FALLBACK` -> `ready` |
| `BattleDisplayManager.ts` | per-member `KneelTrack`; `maxHp` from `battle.allParty[i].maxHp`; the rise folded into overrides (D-K3) |
| `src/scenes/battle/kneelPreview.ts` (new, dev only) | `?kneel=on` forces every actor on both sides to kneel; `?kneel=loop` toggles each actor every 150 frames, staggered 20; works with `&slow=N` and `?enemyAnim=step` |
| `BestiaryPreview.ts`, `bestiaryAnim.ts` | D-K15 |
| `assets/data/status-visuals.yaml` | header comment: `daze` is the kneel on both sides |
| `assets/data/debug-scenarios.yaml` | `kneel_pilot` (K1) and `kneel_all` (K4), section 8 |

`src/battle/` is not touched. The new modules import nothing from `pixi.js` (asserted by a test).

## 7. Checks and tests

**K-checks** (`kneel_checks.py`; binary; they run in `monster_anim.py check`, `review` and the `monsters_ai` build,
and the hero versions in `puppet.py review` and `battle_ai`):

- **K-ground** (replaces check 8 for kneel frames on grounded bodies): the lowest opaque row equals `bottom_row` in
  `kneel_in1`, `kneel_in2`, `kneel` and `kneel_b`, and the bottom 2 rows hold >= 0.5 x the idle's count there.
  Floating / swimmer: the lowest row equals the idle's (the drop is runtime).
- **K-height:** kneel opaque height / idle opaque height is inside the body's band (section 4); heroes use their
  formula.
- **K-rot:** the derived key turns limb parts <= 100 deg (mechanical <= 15) and other parts <= `ROT_CAP`;
  `kneel_in1` / `kneel_in2` turn limb parts <= 40 deg relative to their pixel source; every part over 30 deg is
  sampled with rotsprite.
- **K-fit:** no opaque pixel in the cell's 2 px bottom margin below `bottom_row`, none outside the cell (existing
  clipping check).
- **K-anchor:** the atlas json per-sheet fields `homeX`, `idleBox`, `travelTop`, `lungeRight`, `head`, `lungePx`
  and `opaqueRight` are identical to the base revision (`kneel_tools.py pages --base`).
- **K-lock** (D-K10): `kneel_tools.py lockdiff --base <K0 commit>` reports 0 changed or removed entries; the added
  entries are exactly the 4 kneel names per opted-in rig.
- **Existing checks that apply unchanged to kneel frames:** binary alpha, palette lock, no magenta, no detached
  pixels, seams, new holes, outline kept, silhouette continuity along `SEQUENCES["kneel"]` (span idle -> kneel),
  near-keyframe (|u| <= 0.35 for the in-betweens; `kneel` is a key), whole-pixel joints, F3, F4, F7, atlas
  exactness, determinism. The heroes get the same set through `puppet_kneel.check`, plus `pieces <= 2` and
  `ring` within 0.08 of `ready`.

**Python selftests** (`selftest_kneel.py`, on the synthetic biped of `selftest_rig.py` and the beasts of
`selftest_beasts.py`):

- opt-in only: a rig without `kneel:` generates no kneel frames;
- old frames byte-identical with and without the block;
- the 4 names generated;
- K-ground fails a 1 px lifted kneel, K-height fails a frame outside its band, K-rot fails 101 deg, K-lock fails a
  changed `daze` hash;
- the fallback chain, and the Python vs TS tables match;
- heroes: variant A on a synthetic robed and unrobed puppet; the 14 old columns identical.

**TS tests** (Vitest; existing tests are updated to the new spec, never deleted):

- `tests/scenes/battle/kneelChoreography.test.ts`: in 8 / out 6 frame by frame; hold period 48 with the per-actor
  offset; mid-transition reversal; `isWeak(25, 100)` is true, `isWeak(26, 100)` false, `isWeak(0, 100)` false.
- `tests/scenes/battle/partyPose.test.ts`: one case per D-K2 row, including stone cutting a kneel, victory raising
  a weak hero but not a sleeper, the rise inside the first 6 override frames, and a hit on a kneeler showing no
  `hurt`.
- `EnemyPoseController.test.ts` plus `enemyPoseFlow.test.ts`: daze -> `kneel_in1` at t 0-3, `kneel_in2` at 4-7,
  `kneel` / `kneel_b` from 8; wake -> out; dying from a kneel; hurt as a shake.
- `BattleDisplayManager.test.ts` and `statusIntegration.test.ts`: the FB-7 "sleep holds ready" cases become kneel
  cases.
- `poseCues.test.ts`, `assetCoverage.test.ts` and `CharacterAtlas.test.ts`: the frame lists; per sheet the kneel
  frames are their own rects when opted in, otherwise aliased along `FRAME_FALLBACK`; from K4, own rects on all 123
  sheets and all 12 rows.
- the bestiary tests for D-K15;
- a scenario test: `kneel_pilot` resolves, and its weak members have `hp * 4 <= maxHp`;
- an import test: no `pixi.js` in `kneelChoreography.ts` or `partyPose.ts`.

## 8. Review tooling and pilot (K1)

**Pilot:**

| Sprite | Why it is the risk case |
|---|---|
| `goblin` (biped, small, act 1) | the most common act-1 enemy, a clean rig with a `prop` dagger carried to `dag_h` (prop carry under a big re-pose) and foot parts with masks; existing `daze` paint |
| `wolf` (quadruped, small, act 1) | every leg folds at once (4 IK chains, two of them long rotations), plus the tail and the head |
| `warrior` (hero, armoured, unrobed, shield) | real leg parts rotate about 90 deg with the puppet's nearest rigid rotation; the shield on the far arm; `down` is close in height (44 vs 68 px) |
| `white_mage` (hero, robed, staff, zigzag hem) | no leg parts: the robe squash (A) or the `down` hem (B) is the riskiest pixel path; the hem pattern shows any stretch |

**Commands and artefacts** (all under `assets-src/gen/out/anim/review/kneel/`, untracked):

```bash
python3 -I assets-src/gen/kneel_review.py goblin wolf warrior white_mage
#  -> prints one "<id>: OK" or "<id>: FAIL <check> ..." line per pilot (hero ids once per variant: warrior[A], warrior[B], ...)
#  writes pilot_sheet.png       rows goblin, wolf, warrior A, warrior B, white_mage A, white_mage B; columns idle/ready,
#                               kneel_in1, kneel_in2, kneel, kneel_b, plus hurt (monsters) / down (heroes) for contrast;
#                               4x, ground line drawn, height ratio printed per row
#         <id>[_A|_B]_kneel.gif in 8f, hold 2 sway cycles, out 6f, stand 24f (16.7 ms per game frame)
#         pilot_stage.png       all pilots kneeling at game scale on grassland.webp at their battle slots
npm run dev   # then (Playwright; never without mute=1)
#   http://localhost:5173/?mute=1&scenario=kneel_pilot              -> /tmp/kneel/pilot_battle_1.png
#   http://localhost:5173/?mute=1&scenario=kneel_pilot&kneel=loop   -> /tmp/kneel/pilot_battle_loop_{1..4}.png
```

`kneel_pilot` (debug-scenarios.yaml):

- party: `WAR` warrior Lv 10 at weak HP, `WHM` white_mage Lv 10 `status: [sleep]`, `WHM2` white_mage Lv 10 at weak
  HP, `WAR2` warrior Lv 10 at full HP (the control);
- enemies `[goblin, goblin, wolf, wolf]` with `enemyStatus: {0: [sleep], 2: [stun]}`; 1 and 3 are the controls;
- background grassland.

Playing one round shows a weak hero rising to attack and kneeling again, a hit on a kneeler, and a waking enemy
rising. The hero rendering variant is a dev query, `&kneelVariant=A|B`, until U1 decides.

**U1 gate (user):** the user gets `pilot_sheet.png`, the 6 GIFs, `pilot_stage.png` and the browser screenshots,
and rules:

1. approve or reject each pilot's look;
2. pick hero variant A or B, separately for armoured and robed classes (R3);
3. R1, R2, R4-R7.

The rulings and any tuning are written into section 13 of this file (commit "K1-U1: pilot rulings"). No K2 / K3 work
starts before that commit.

## 9. Rollout tranches (sprite lists generated from the rig files' `body:`)

| Tranche | Owner | Sprites |
|---|---|---|
| **K1** pilot | 1 agent, serial | goblin, wolf, warrior, white_mage |
| **K2-A** biped 1 (24) | worktree agent A | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle garland ghast ghoul gr_imp hill_gigas horned_devil ice_gigas iron_golem(mech) king_mummy lich mindflayer |
| **K2-B** biped 2 (24) | agent B | minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier(mech) stone_golem troll vampire vampire_lord warmech(mech) weretiger werewolf wight zombie |
| **K2-C** quadruped (27) | agent C | baretta basilisk blue_dragon chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian(mech) hellhound hydra hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf |
| **K2-D** heroes (10) | agent D | unrobed: knight thief ninja monk master red_mage; robed: black_mage black_wizard red_wizard white_wizard |
| **K3-0** templates and probes (8) | 1 agent, serial, after K2 is merged | cockatrice (bird), ghost (floating), shark (swimmer), cobra (serpent), ochu (rooted), water_naga (naga), scorpion (arthropod), green_slime (blob); then **U2** (D-K14) |
| **K3-A** floating (13) | agent A | air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental hollow_seraph red_piranha shadow specter water_elemental white_shark wraith |
| **K3-B** serpent / rooted / naga (12) | agent B | anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; neochu; ashen_queen earth_medusa medusa spirit_naga |
| **K3-C** bird / arthropod / blob (13) | agent C | allosaurus pyrolisk tyrannosaur wyvern; ankheg black_widow crawler remorazz sea_scorpion tarantula; black_flan gray_ooze ochre_jelly |
| **K4** integration | 1 agent | full build, gates, play test, docs |

Total: 2 + 24 + 24 + 27 + 8 + 13 + 12 + 13 = **123 sheets**; 2 + 10 = **12 heroes**.

The tranches with known extra risk get a per-sprite review note in their agent brief:

- the mechanical rigs (D-K11);
- `kind: cloth` (garland, lich, mummy);
- `kind: fx` (garland, lich, hollow_seraph): the halo stays dark at kneel, since `brighten` applies only to the cast
  frames;
- the FW-Q partial rigs (the kneel comes from `idle`, so it is unaffected);
- the scale-3 sheets (any paint is in native px);
- the boss per-pose cells (drowned_sovereign, ashen_queen, piscodemon, chaos `raise: false`).

**Parallel protocol:**

1. One worktree per agent: `git worktree add /tmp/kneel-wt/<tranche> -b kneel-<tranche> mainline`.
2. An agent edits only its own `anim/monsters/<id>.yaml`, `<id>.lock.json`, or `anim/<class>.yaml` and
   `<class>.lock.json`. Shared Python and TS change only in K1, K3-0 and K4.
3. Per sprite: `kneel:` block -> `kneel_review.py <id>` (self-review against the U1 bar) -> `monster_anim.py check
   <id>` shows `<id>: OK` -> `monster_anim.py lock <id>` (heroes: `puppet.py lock <class>`) -> **commit at once**
   (`K2-A: <id> kneel rig + lock`). No `git add -A`; generated `assets/sprites/*` are never committed by a rollout
   agent.
4. Retry cap: 2 re-tunes per sprite. After that the agent reports `BLOCKED: <id> <check>` and moves on.
5. Merge order: K2-A, K2-B, K2-C, K2-D (no shared files, so no conflicts), then one integrator commit "K2: atlases"
   (`build_assets.py monsters_ai battle_ai`) after the section 10 gates. Then K3-0 -> U2 -> K3-A, K3-B, K3-C in the
   same way -> "K3: atlases".

## 10. Gates (every tranche merge and K4; each command has one expected result)

| # | Command | Expected |
|---|---|---|
| G1 | `python3 -I assets-src/gen/monster_anim.py check --all \| grep -vc ': OK'` | `0` (and `grep -c ': OK'` = `123`) |
| G2 | `python3 -I assets-src/gen/kneel_tools.py lockdiff --base <K0 commit>` | `0 changed, 0 removed, added = 4 x opted rigs` (K4: `492`); heroes `4 x opted classes` (K4: `48`) |
| G3 | `python3 -I assets-src/gen/kneel_tools.py coverage` | the tranche's running count; K4: `monsters 123/123, heroes 12/12` |
| G4 | `PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum assets/sprites/monsters-ai* assets/sprites/battle-characters-ai* > /tmp/kneel.sha && PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum -c /tmp/kneel.sha` | every line `OK` |
| G5 | `python3 -I assets-src/gen/kneel_tools.py pages` | every page <= 2048x2048; pages <= 12; act-1 group <= 2 pages; K-anchor fields identical to base |
| G6 | `python3 -I assets-src/gen/kneel_tools.py party-diff --base <K0 commit>` | `12 rows x 14 old columns identical`; atlas width 18 x 160 = 2880 |
| G7 | `git diff --stat <base> -- assets/sprites/characters* assets/sprites/colossus*` | empty (field and colossus atlases untouched) |
| G8 | `python3 -I assets-src/gen/selftest.py` | last line `ALL PASSED` |
| G9 | `npm run build` | exit 0 |
| G10 | `npm test` | 0 failed; test count >= 4962 + the new tests |
| G11 | `git status --short` | no scratch files (scratch stays under `/tmp`) |
| G12 | grep of the pass's diffs for Gemini / Bedrock calls; `assets-src/gen/cache/ledger.jsonl` and `bedrock_ledger.jsonl` unchanged | no change (0 paid images) |

**K4 acceptance** (beyond G1-G12):

- browser play test (`?mute=1` always) of `kneel_all` (all 12 classes: 6 weak, 6 asleep / stunned, against one
  enemy per body type, slept / stunned);
- `?scenario=anim_status`, `f_status_combo`, `chaos_forms`, `chaos_final` and `?bestiary=goblin`;
- 0 console errors; screenshots in `/tmp/kneel/k4_*.png`;
- an adversarial checklist: stone over a kneel, wake mid-in, a heal across 25 % mid-out, a KO from a kneel, victory
  with a weak member and a sleeper, fear plus weak, and a colossus slept (no pose, no error).

Docs to update in K4:

- AGENTS.md: the Art & Audio "Monster animation" bullets (kneel frames, opt-in, K-checks, `kneel_tools.py`), the
  pipeline table rows battle_ai / monsters_ai (columns, pages and their measured sizes), Key Interfaces (the
  posture `daze` is the kneel; hero weak rule), the debug keys (`?kneel=`), and the scenario families (`kneel_*`);
- `docs/ENEMY_ANIM_PLAN.md` 3.1 / 3.2 / 5.1 (pointer to this plan);
- `docs/FEEDBACK_PLAN_2026-11-14.md` item 5a (superseded by pass K);
- `assets-src/gen/README.md`;
- `docs/PROGRESS.md`;
- the stale `LATE_FRAMES` comment.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Large leg rotations look broken in pixel art (90 deg thighs) | rotsprite sampler for > 30 deg parts; keyframe paint <= 160 px on `kneel` only; hero variant B uses approved folded pixels; the pilot exists to judge this |
| A hero kneel reads like `down` (the KO slump is kneel-height) | K-height lower bound `H_down + 4`; head-up / weapon-held targets; U1 judges warrior and white_mage side by side with `down` |
| The robe squash smears the white_mage's zigzag hem | variant B (the `down` hem) offered at U1 |
| The atlas grows to 12 pages / +31.5 MB if every page loads; act-1 needs 2 pages | measured in section 1; G5 cap; D-K6 / R4 retirement fallback (10 pages) |
| A rollout agent edits a shared file or a lock entry | protocol rule 2; G2 rejects any changed entry |
| A template change made after the pilot changes pilot frames | templates frozen at U1 (K3-0 adds new bodies only); G2 plus pilot locks |
| Mechanical rigs cannot kneel within 15 deg | D-K11 squat band 0.85-0.95 |
| File ceilings (`EnemyPoseController` 248, `AiEnemyView` 242, `puppet.py` 540) | extractions in section 6; a hook-only rule for `puppet.py` / `monster_anim.py` |
| A rise folded into the wind-up looks rushed | `KNEEL_OUT_FRAMES` tunable in K1; U1 browser check |

## 12. Open questions for the user

1. R1: should enemies also kneel at low HP (<= 25 %)? (default no)
2. R2: does poison make an actor kneel? (default no)
3. R3: hero kneel variant A (re-posed `ready`) or B (`ready` upper body over the approved `down` lower body), for
   armoured and for robed classes; decided at U1.
4. R4: keep `daze` / `daze_b` (12 pages) or retire them (10 pages, lock entries removed)? (default keep)
5. R5: is exempting the Chaos colossus forms F2-F4 from the kneel acceptable? (default exempt)
6. R6: is the atlas growth acceptable, with the act-1 group on 2 pages? (default accept)
7. R7: hold a second user review (U2) for the new body templates, or orchestrator self-review? (default hold U2)

## 13. Rulings and tuning log

(empty until U1)

## TODOs

- [ ] K1a `kneel_templates.py` (biped, quadruped), `kneel.py`, recipes, hooks, K-checks, lock extension (high, 8h)
- [ ] K1b `puppet_kneel.py` variants A / B, `battle.down` joints for warrior and white_mage, hero lock (high, 5h)
- [ ] K1c TS: `kneelChoreography.ts`, `partyPose.ts`, `enemyPoseTypes.ts` extraction, frame tables, atlas readers, `kneelPreview.ts`, bestiary (high, 7h)
- [ ] K1d `kneel_review.py`, `kneel_tools.py`, `selftest_kneel.py`, TS tests (high, 5h)
- [ ] K1e pilot rigs and locks for goblin, wolf, warrior, white_mage; `kneel_pilot` scenario; artefacts; G1-G12 (high, 4h)
- [ ] U1 user review; rulings into section 13 (blocking)
- [ ] K2-A / B / C / D rollout, 85 sprites and classes in 4 worktrees (medium, about 10h per agent)
- [ ] K2 integrator atlas commit plus G1-G12 (medium, 1h)
- [ ] K3-0 six new body templates plus 8 probes; U2 (high, 8h)
- [ ] K3-A / B / C rollout, 38 sprites (medium, about 6h per agent)
- [ ] K3 integrator atlas commit plus G1-G12 (medium, 1h)
- [ ] K4 play test, adversarial checklist, docs, final gates (high, 5h)

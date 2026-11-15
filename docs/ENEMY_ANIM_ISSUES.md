# Enemy animation: review and adversarial play-test issues (2026-11-14)

**Tested:** `enemy-anim` at `1692c05`. All 14 monster sheets are animated: 12 rigs plus the palette variants gr_imp and gr_wolf.

Two passes:
- **Review (R):** an independent reviewer judged the review strips against the approved sheets, using images only.
- **Play test (P):** an adversarial browser run of probes A1–A20 plus real battles, covering bipeds, an overworld pack, Garland three ways (with a wipe and Retry), beasts plus Run, cast and status.

Evidence is in `/tmp/animrev/` and `/tmp/t8/` (local, not committed).

**Clean everywhere:**
- palette, pixel grid, magenta fringe, stray pixels;
- feet baselines (except E8);
- draw order (D5), and flash and damage-number ordering;
- re-hits, death mid-lunge, palette variants, late atlas load, pacing;
- victory, Run and Retry;
- FPS: median 120 on a 120 Hz display, 5th percentile ≥ 108;
- no console errors.

**Severity:** M major, m minor, p polish.

**Inherent, not defects:** prop and costume swaps between the approved keyframes, the dragon's and Garland's keyframe scale changes, the ogre's overhead strike, and the speckle in Garland's approved cast. These are listed in the review.

| ID | Sev | Monster / area | Issue | Src |
|---|---|---|---|---|
| E1 | M | runtime | **Sleeping, stunned or stoned enemies play a full lunge on the turn they lose.** `startEnemyLunge` runs before the status check in `executeNextAction`, and D6's freeze makes it obvious. | P1 |
| E2 | M | garland | **The cape tears in `atk_wind1/2`:** it becomes a flat-topped flap with background showing through, and the pommel sits on it. Visible for 11 frames of every attack. | P2 |
| E3 | M | lich | **`atk_follow` keeps a detached piece of the frost trail floating right of the glaive** for 4 frames. | P3, R7 |
| E4 | M | lich | **The cast orb is full size in `cast_rise`, so it pops in and out instead of growing.** `cast_gather` is almost idle: about 97 % of pixels change into rise. | R2 |
| E5 | M | vampire | **`atk_recover` overwrites half the face with hood and hair pixels.** The mouth and jaw are smeared, the collar is broken and the buttons are lost. | R1 |
| E6 | M | dragon | **Both hurt in-betweens are unreadable:** dark leftovers sit behind the horns like a ghost horn, and belly-colour patches are scattered over the hind legs and tail root. The legs can't be read. Stray dark pixels also show in `atk_mid`. | R3, P5 |
| E7 | m | troll | **`atk_follow` reads as two heads,** because the hump keeps its spikes while the head moves. There is also a dark forearm/chest seam, and a stretched arm and jagged armpit in `atk_recover` and `hurt_in1`. | R4, P5 |
| E8 | m | wolf | **A dark T-shaped crease at the neck,** in hurt f0/f4 and attack f5. The front legs lift 2–10 native px in `atk_recover` and `hurt_in1`. Hurt f0 also has a torn haunch edge. | R6, P4 |
| E9 | m | ogre | **In the hurt in-betweens the club floats at the hip with no hand on it,** and the shoulder and back outline is ragged. In `atk_wind2` the forearm is drawn across the belly. | R5, P5 |
| E10 | m | vampire | **`atk_mid`: a dark smear over the forearm, a black blob inside the white crescent,** and one stray red pixel left of the hood. | R8 |
| E11 | p | cockatrice | **In the hurt in-betweens the near wing is squeezed into a thin noisy strip,** and the tail merges into the wing. | R9 |
| E12 | p | pirate | **The wind-up's first frame barely differs from idle,** so most of the motion lands in one step. | R10 |
| E13 | p | runtime | **A lethal hit during the hurt hold or return steps back to `hurt_in1`** before dying, a small backwards pop. | P6 |
| E14 | p | runtime | **The first shake frame moves toward the party** (−5 → −3 → −9 px). | P7 |
| E15 | p | runtime | **Boss and plain casts lift the whole sprite 6 px,** so the feet leave the plain. | P7 |
| E16 | p | runtime | **A missing single monster sheet falls back to the placeholder box without a console warning.** | P8 |
| E17 | p | runtime | **A death with no damage event (poison, instant death) fades while the sprite keeps animating.** Latent: nothing in act 1 can cause it. | P9 |
| E18 | p | dev only | **The step-mode corner label overlaps the battle message.** | P10 |

Recorded, not fixed: the ogre's approved idle club is cut flat at x 106 in the source art.

## Fix plan

Planned against `1692c05`. Every root cause below was reproduced locally: the rig cause by dumping `rig.segment`
and `monster_anim.generate` label maps, and every proposed rig change by an in-memory run of
`monster_check.check_sprite` with the lock check off. Scratch material is in `/tmp/fixplan_*` (local, not committed).

**Constraints:**
- The style lock holds: no approved sheet under `assets-src/gen/approved/` is modified.
- No paid image generation.
- The holds cap stays at 1 per sequence.
- Fixes go into rig files, `paint`, framework code or runtime code only.

### Success criteria (defined before any fix)

```json
{
  "functional": [
    "E1: an enemy that loses its turn (sleep, stun, stone, lethal poison tick) shows no wind-up or lunge",
    "E2-E12: every listed artifact is gone from the named frames, with no new artifact elsewhere in the sprite",
    "E4: the lich orb grows in at least 2 size steps (none -> small -> full) and shrinks the same way",
    "E13-E17: the runtime behaviours described in the table are corrected; E18 label clear of the message window"
  ],
  "observable": [
    "image-only reviewer answers yes to every 5.3 criterion plus the E-item question for each changed monster",
    "browser step-mode screenshots of each E item at the named frames",
    "check --all lists exactly the expected failures after wave 0 and none after wave 1"
  ],
  "pass_fail": [
    "python3 -I assets-src/gen/selftest.py: ALL PASSED (new RED-first fixtures included)",
    "monster_anim.py check --all: 0 failures, every lock matches",
    "party atlases byte-identical; monsters-ai.* identical under PYTHONHASHSEED=0 and 1",
    "npx tsc --noEmit, npm run build, npm test: all green, new vitests included",
    "goblin, skeleton, mummy (and gr_imp) frame hashes unchanged"
  ]
}
```

### 1. Root cause, fix and verification per item

#### E1 (runtime): an enemy that loses its turn still lunges
- **Cause:** `BattleAnimationController.ts:116` calls `startEnemyLunge()` (`:233-240`) as soon as the announce timer ends. The status check only runs later, inside `BattleStateMachine.executeNextAction` (`:339`), through `tickStatus` (`src/battle/StatusTick.ts:26-52`). The skip-turn statuses are sleep, stun and stone (`StatusEffects.ts:36`). A lethal poison tick also ends the turn, with no damage event.
- **Fix:**
  - Add a pure `nextActorLosesTurn(): boolean` to `BattleStateMachine.ts`, next to `isNextActorAlive` (`:306`). It consumes no RNG. It is true when the next actor has sleep, stun or stone, or poison with HP ≤ `floor(maxHp * 0.05)`.
  - At `:116`, an enemy that loses its turn goes straight to `'execute'`, with no lunge. Its turn message plays with the enemy frozen on idle (D6).
  - Blind, silence and confusion still lunge.
  - Fear is a 50% roll at execute time (`StatusTick.ts:47`): see decision O1.
- **Test (RED first):**
  - `enemyPoseFlow.test.ts`: "a sleeping enemy does not wind up or lunge on its lost turn". After `ANNOUNCE_FRAMES`, `isAttacking(0)` is false, the pose is `idle`, and `executeNextAction` runs on the next tick.
  - A `tests/battle/` unit test for `nextActorLosesTurn` covering sleep, stun, stone, lethal poison, non-lethal poison, blind and fear.
  - The shared battle mocks gain `nextActorLosesTurn: vi.fn(() => false)`: `enemyPoseFlow`, `BattleAnimationController`, `meleeContact`, `turnListFit`.
- **Browser:** `?mute=1&scenario=anim_status&enemyAnim=step`, then a real round of `anim_status`: sleep and stun a goblin, and confirm its turn shows no lunge.

#### E2 (garland): the cape tears in `atk_wind1/2`
- **Cause (segmentation, `garland.yaml`):** the idle cape is split over three parts, and they move apart in the wind frames.
  - **`farm_f`** (`:115`): its radius is 11 × 2.5 = 27.5 px, so it claims the cape strip above the pommel (about x 30-50, y 82-112). The `cape_i` idle mask (`:152`) starts at (57, 90)/(52, 92), and its left edge runs (52, 92)→(45, 120), so the left part of that strip is outside it.
  - **`sword`:** its idle mask (`:160`, the first points from [48, 103] to [48, 110]) takes the cape band around the pommel.
  - **`cape_i`:** the rest of the cape.
  - In wind2, `cape_i` is warped 17.6° (`ci_m [-8,2]`, `ci_1 [-14,-14]`, `:136`), the sword turns −7.2° about `hand_f`, and the strip translates with the arm.
  - The result is a flat-topped flap cut along the sword mask's edge, with the pommel band riding on it. Background shows between the flap and the pinned far leg.
  - The wind1 ink stripe at x 55-56, y 123-137 (`:169`) and the 80 px and 43 px ink fills under the lifted blade (`:170`, `:172`) are paint over pixels the cut-out uncovered.
- **Fix (rig only):**
  - Extend `masks.cape_i.idle` over the whole visible cape left of the arm, from the shoulder down (x ≈ 28-58, y 82-188).
  - Trim `masks.sword.idle` so it starts at the pommel and holds no cape pixels.
  - Cap the hem flare so no cape segment turns more than about 10° in wind1/2 (for example `ci_1 [-8,-4]` in wind2).
  - Re-derive or remove the `:169` stripe, and shrink the blade lift (`tip` tweak) until the `:170`/`:172` ink fills are at most a few px.
  - `cape_i` is also used by `atk_recover`, `cast_gather` and `hurt_in1`, so all of them are regenerated and re-reviewed.
  - In-memory note: adding a mid-chain joint alone, without the mask fix, did not remove the flat top. A gather flare of 28° also trips the 25° cloth cap, so keep `cast_gather`'s hem near today's value.
- **Test:** no generic image metric isolates this:
  - A closing-based "new sliver" metric measured 43 px on wind2, against up to 215 px on legitimate frames.
  - An "exposed un-inked edge" metric is 0 everywhere, because `outline()` inks every new edge.
  - Verification is therefore `check garland` green, the mask-overlap report of F3 (no cape pixel inside the `sword` polygon), and the reviewer question "does the cape stay one piece behind the arm in every attack frame?".
- **Browser:** `?mute=1&scenario=anim_boss_garland&enemyAnim=step`, frames `atk_wind1`, `atk_wind2` and `atk_recover`, then `&enemyAnim=loop` for 3 cycles.

#### E3 (lich): a detached piece of the frost trail floats in `atk_follow`
- **Cause (`lich.yaml`):**
  - The `blade` part (`:99`, mask `:124-125`) is not a glaive head. Its polygon covers the lower half of the frost arc.
  - Masks are applied in file order, so `blade` takes over 1409 of the 2465 opaque pixels inside the `trail` fx polygon (`:122-123`).
  - `drop: [trail]` in `atk_follow` (`:158`) therefore removes only the upper arc. The lower arc rides `gh→tr` (tweaked `tr [-8,10]`) as a rigid crescent right of the glaive.
  - It stays 4-connected to the shaft by a few pixels, so check 4 (`detached`) passes. The part contact ratio is 0.65, inside the legitimate range, so a contact metric cannot catch it either.
- **Fix:**
  - Make the whole arc fx: merge the `blade` mask into `trail`, or set `blade: {kind: fx}`, and use `drop: [trail, blade]`.
  - With the arc dropped, two checks fail:
    - **Area:** 0.82 of source. The fx pixels count toward it, so this needs the F1 exemption.
    - **Pieces:** 2 > 1. A 41 px crown-spike piece of `head` at x 142-151, y 47-52 only touched the body through the arc. Fix it with the head mask or a 1-2 px paint bridge.
  - Expected look: the glaive shows a bare shaft end for 4 frames (see decision O5).
- **Test:**
  - The F3 lint (opaque pixels inside an fx mask labelled as another part) fails today on lich `attack` with 1409 px. It is 0 on every other rig, garland `glow` and vampire `slash` included.
  - After the fix, the lint reports 0, and `check lich` is green with F1.
- **Browser:** `?mute=1&scenario=anim_boss_lich&enemyAnim=step`, frames `attack`, `atk_follow` and `atk_recover`.

#### E4 (lich): the cast orb pops in and out instead of growing
- **Cause:**
  - The `crystal` (`:101`) is a cloth warp chain `hand_n→cm→cry`. `mesh_warp` uses the same `width` for the source and destination quads (`rig_render.py:133-134`), so it scales only along the chain.
  - The `cast_rise` tweaks `cm [3,4]` and `cry [4,8]` (`:184`) make the orb 85% tall but 100% wide. To the eye that is full size.
  - The T6 log explains the choice: "cast_rise bbox needs the crystal >= ~85% tall". Check 6 (`anim_checks.silhouette`, `:143-146`) counts the orb in the bbox height.
  - Measured:
    - `cast` is 190 px tall with the orb and 164 px without it, and idle is 184 px.
    - The lerp asks for 187.9 ± 10 at u = 0.35.
    - A 55% orb ends below the body's top in `cast_rise`, which gives a height of about 175: 12.9 px off, so the frame fails.
  - The orb's sequence is therefore none (gather) → 85/100% (rise) → 100% → 100% → 85/100% → none.
  - The second half of the review comment (97% of pixels change from gather to rise) is the switch of pixel source from idle to cast. Idle and cast overlap only 0.377 IoU, and idle has no visible arms, so gather cannot raise one. This half is inherent (decision O4).
- **Fix:**
  - **F2:** a per-frame part `scale`, for example `frames.cast_rise.scale: {crystal: 0.55}`. The part is rendered by the rigid inverse map scaled about its first joint, through the rotsprite sampler (Scale2x×3, then a mode-downsample), so it stays palette-locked and binary-alpha. The composite's `outline()` re-inks the orb's ring.
  - Re-declare the crystal as `kind: fx` and rigid on `[hand_n, cry]`, so it is anchored in the fist and shrinks into it.
  - **F1:** fx-labelled pixels are excluded from the area ratio and the bbox height, in both the frame and its source and target. Measured with the orb excluded: rise 175 against a lerp target of 171 ± 10, which passes. Area without fx: 0.997. Gather→rise IoU only rises as the orb shrinks (0.420 today against 0.397 needed), and rise→cast IoU is 0.727.
  - **Justification for F1:** a growing or vanishing spell effect is the intended motion. The height and area checks guard against the body stretching, and the fx parts are declared per rig (`kind: fx`) and reviewed.
  - Optional: a 0.25 seed orb in `cast_gather`. It is not possible: idle has no `hand_n`, so the seed would float.
  - The resulting sequence is none → 55% → 100% → 100% → 55% → none.
- **Test (RED first):**
  - Selftest F2: scale 1.0 is byte-identical to today's renderer; scale 0.5 keeps the palette ⊆ source and binary alpha, and is deterministic.
  - Selftest F1: a synthetic rig whose fx blob shrinks to 50% passes, while the same shrink on a rigid part fails the height check.
  - `check lich`: the `cast_rise` crystal pixel count is ≤ 40% of `cast` (about 1093 px today). This is a new lich-only assertion in the rig's review report, or a selftest on the real rig.
- **Browser:** `?mute=1&scenario=anim_boss_lich&enemyAnim=step` through the cast, then `&enemyAnim=loop`.

#### E5 (vampire): `atk_recover` smears the face
- **Cause (`vampire.yaml`):**
  - The recover tweaks `crown [5,4]`, `neck [5,4]` and `dy: 1` (`:110`) slide the rigid head by (5, 5). `chest` gets neither a move nor a tweak, and the hood and hair (segmented to `cape`, because `masks.head.idle` at `:126` starts at x 38) move only `cv_0 [3,1]`.
  - In `z.idle` (`:121`), `head` draws over `torso`, which covers the collar and buttons (rows 36-39, x 41-48).
  - `uarm_n` draws over `head`, which overwrites 41 jaw and mouth pixels (x 43-53, y 29-35).
- **Fix:** `crown [2,1]`, `neck [2,1]`, `cv_0 [2,1]`. It passes every check, follow→recover continuity included, and the face, collar and buttons stay intact.
  - A hold is not a fallback: follow→idle IoU 0.52 < 0.53.
- **Test:** no automated metric separates this. The ratio of kept head pixels is 0.962 here, against 0.81-0.90 on legitimate dragon and pirate frames. The reviewer criterion is the face unchanged (5.3 criterion 1).
- **Browser:** `?mute=1&scenario=anim_bipeds&enemyAnim=step`, vampire `atk_follow → atk_recover → idle`.

#### E6 (dragon): unreadable hurt in-betweens and specks in `atk_mid`
- **Ghost horn (`hurt_in2`):**
  - **Cause:** the moves `[back, chest, neck, head, snout]` (`dragon.yaml:156`) turn the neck chain's last segment 12.7° but the rigid head only 2.7°. The neck is a `width: auto` mesh warp (`rig_templates.py:54`), and the hurt segmentation gives it the dark crevice between the horn base, head and `wing_n`. The crevice swings away from the head and reads as a second horn. The paint at `:162` (2 ink pixels) adds to it.
  - **Fix:** grow the hurt `head` mask (`:122`) over the crevice and horn base (about x 74-86, y 36-46). Make the neck and head agree, either by dropping `neck/head/snout` from the `hurt_in2` moves or by giving the head the neck's turn. Then redo or remove the `:162` paint.
- **Belly patches:**
  - **`hurt_in1` cause:** the beige underside between the hind legs (x 57-70, y 100-108) is labelled `body` in idle. The spine pitches −24.8° about the hip with hind legs at 0°. The `body` warp is 29.5 px wide, and `body` draws over `thigh_f`. The `:161` paint inks 10 px into the pocket this opens.
  - **`hurt_in2` cause:** the visible near thigh (x 50-63, y 72-90) is labelled `body`. The tail chain runs between the hind legs, and the tweaks `tail0 [-4,10]` / `tail1 [-4,5]` (`:157`) bend it at the root.
  - **Fix:**
    - Add idle masks that hand the between-legs belly to `thigh_n`/`thigh_f`.
    - Add a hurt `thigh_n` mask.
    - Set an explicit `parts: {body: {width: 16}}` (a rig override of the template's `auto`).
    - Give `tail0` and `tail1` the same translation.
    - Drop the `:161` paint.
- **`atk_mid` specks:** new-ink specks along `wing_f`'s left edge, where `wing_n` (−24.2°) used to cover it while `wing_f` turns +12.2°, plus a dot at (75, 91). Fix: a smaller `wt_n`/`wt_f` spread (`:138`), or a paint clean-up.
- **Also for this owner:** the edge-roughness metric (see F6) ranks dragon `atk_follow` third of all frames (+5.28). Inspect it; it is not in the issue list.
- **Holds:** none today, and none is legal for hurt. Holding `hurt_in1` fails idle→`hurt_in2` continuity (centroid 21.8 > 16), and holding `hurt_in2` fails `hurt_in1`→hurt (24.3 > 16). If 3 iterations do not fix it, escalate (decision O6).
- **Test:** ghost leftovers and belly patches have no binary metric. Far-duplicate sampling is 0 everywhere, and buried-outline is too noisy (10-28 per 1000 px on 40 frames). Verification is the reviewer plus the F6 roughness report.
- **Browser:** `?mute=1&scenario=anim_large&enemyAnim=step`, dragon hurt in and out plus `atk_mid`.

#### E7 (troll): two heads in `atk_follow`, plus a seam and a stretched arm
- **Two heads:**
  - **Cause:** the hump spikes (x 52-68, y 24-44 of the attack keyframe) are segmented into `uarm_f`. The follow tweaks `el_f [4,7]` and `hand_f [10,12]` (`troll.yaml:98-101`) swing `uarm_f` about 21° about `sh_f`, so the hump gets its own rounded outline beside the head.
  - **Fix:** `masks.torso.attack: [[53,24],[69,22],[70,42],[57,45],[51,36]]`.
- **Forearm/chest seam (`atk_follow`):**
  - **Cause:** `sh_n [3,3]` and `el_n [0,7]` drop the near shoulder below the chin. The gap is inked twice, by `outline()` (x 85-94, y 57-60) and by the paint at `:130`.
  - **Fix:** lower the forearm about `el_n` only (`sh_n` stays on the rigid lean, about `[3,2]`), drop the `:130` paint, then re-check for notches.
- **Stretched arm and jagged armpit (`atk_recover`, `hurt_in1`):**
  - **Cause:** a 2-4 px strip of the belly flank (x 78-84, y 46-85) is labelled `uarm_n`/`farm_n` in idle, and it swings forward with the arm (`:104`, `:107`).
  - **Fix:** `masks.torso.idle: [[74,46],[80,46],[82,64],[83,85],[74,85]]`. Stop the polygon at y 85, or the thumb is cut off and the "pieces 2 > 1" check fails.
- All three changes pass the checks in memory.
- **Test:** the reviewer. The broad interior-crease metric does not separate this defect (troll 5 against unflagged garland 24). The stricter F4 crease does not flag the troll either.
- **Browser:** `?mute=1&scenario=anim_large&enemyAnim=step`, troll `atk_follow`, `atk_recover` and `hurt_in1`.

#### E8 (wolf): a T-shaped neck crease, forepaws lifting and a torn haunch
- **Frame names:** "hurt f0/f4" is `hurt_in1`; "attack f5" is `atk_recover` (the strip has duplicates removed).
- **Crease:**
  - **Cause:** the body chain turns −23.5° in `hurt_in1` and −15.1° in `atk_recover`, while the neck chain keeps its angle (moves, `wolf.yaml:105`, `:110`). So the neck warp samples source pixels labelled `body`, which the part mask drops. That leaves a hole inside the neck part.
  - `crack_mask` fills only gaps between two different parts (`rig_render.py:179`, `p != q`), so `outline()` (`:252`) inks the hole as a T (x 69, y 19-22, plus a bar).
  - **Fix:** add an idle `masks.neck` that moves the body/neck boundary away from the withers, or turn the neck with the body through tweaks. As a last resort, paint mane colour over the 5-6 px.
  - The framework alternative, a same-part crack fill, is rejected: it changes 1-4 px in many frames of every rig and would force every lock to be re-reviewed.
- **Forepaws lifting (`atk_recover`):**
  - **Cause:** the frame override `pins: [knee_n, knee_f, foot_n, foot_f]` (`:104`) plus the forelegs in `moves` (`:105`) frees the forepaws, against table 3.1.
  - The check misses it: `monster_anim.py:229-230` builds a contact mask for any pinned frame that releases a foot, and `anim_feet._kept_contact` (`:35-53`) then skips the released paws.
  - **Fix:** drop the `:104` override and take `sh_*/el_*/paw_*/ftoe_*` out of the `:105` moves.
- **Forepaw lift in `hurt_in1`:** 6 px at u = 0.32 toward a pose whose forepaws are about 20 px up. This is the start of the rear (decision O3: accept).
- **Torn haunch (`hurt_in1`):**
  - **Cause:** `thigh_n` turns +20° and `thigh_f` +21.5° against the warped body, and `shin_f` turns −27.9°.
  - **Fix:** take `knee_n`/`knee_f` out of the `:110` moves, or add a haunch mask.
- **Holds:** only `hurt_in2` is a legal hold, and it does not fix the crease frames. Holding `hurt_in1` fails the centroid (6.6 > 6), and holding `atk_recover` fails the IoU (0.47 < 0.51).
- **Test (RED first):**
  - **F4 intra-part crease:** fails today on wolf `hurt_in1` (6) and `atk_recover` (5), and on lich `hurt_in2` (19, which goes to G1).
  - **F5 foot release:** fails today on wolf `atk_recover` (`paw_n` 2 px).
- **Browser:** `?mute=1&scenario=anim_beasts&enemyAnim=step` (wolf and gr_wolf).

#### E9 (ogre): a floating club, a ragged back and a forearm on the belly
- **Floating club:**
  - **Cause:** this is `hurt_in2` only (`hurt_in1`'s club touches `farm_n` along 28 px). `carry_to: club_h` (`ogre.yaml:74`) hangs from the hip at hurt `club_h [72,92]` (`:57`), drawn behind.
  - Carrying the club in the hand is impossible: the hurt hand is raised, so the club would turn about 100°, past the 30° prop cap. A hold is ruled out by D8.
  - **Fix:** hurt `club_h: [74,98]`. The club turns 20° and shows 103 of 341 px (30%), with its lowest row at 118 against the ground at 122, so it reads as dropping behind the shin. All checks are green.
- **Ragged back (`hurt_in2`):**
  - **Cause:** `crown [19,-12]` and `chest [6,-1]` (`:102`) turn the torso about 15° with nearest sampling. Roughness is 10.34 against 5.14 in the source.
  - The IoU margin is thin: 0.552 against 0.55 needed. A smaller lean fails at 0.54, and `sampler: rotsprite` fails the second-ring check.
  - **Fix:** outline paint along the back edge (x ≈ 30-40, y 55-90).
  - **Escalation:** a per-frame `sampler` override (`monster_anim.py:214`). That is a framework change for the wave-0 owner.
- **Forearm across the belly (`atk_wind2`):**
  - **Cause:** the arm swings 28° back (`:84`).
  - **Fix:** `el_n [-9,-4]`, `hand_n [-12,-3]`, `tip [-17,2]`. Checks are green.
- **Test:**
  - F6 roughness (ogre `hurt_in2` +5.21) is in the report.
  - The prop-attached guard (F7) is a regression guard only. It cannot detect E9, because every `hurt_in2` carry touches the hand by 0 px by design.
- **Browser:** `?mute=1&scenario=anim_large&enemyAnim=step`, ogre `hurt_in1`, `hurt_in2` and `atk_wind2`. Also a step through hurt for probe A20.

#### E10 (vampire): `atk_mid` smear, blob and red pixel
- **Smear and black blob:**
  - **Cause:** `el_n` and `hand_n` in `atk_mid.moves` (`vampire.yaml:100`) turn `farm_n` −19.5° and `uarm_n` +17.2° toward wind2. That opens a 10 px hole next to the `slash` fx, and paint entry 3 (`:143`, x 49-52, y 53-56) fills it with ink: that is the blob. The turned forearm is the smear.
  - **Fix:** remove `el_n` and `hand_n` from the moves and delete that paint entry.
- **Stray red pixel (37, 21):** a collar-trim pixel inside the head segmentation that is left isolated when the head rises. Fix: paint it with outline colour.
- The E5 and E10 changes together pass every check. A hold is not a fallback (wind2→attack IoU 0.52 < 0.53).
- **Test:** F6 roughness ranks this frame second (+5.85), and that number goes in the report. A dark-blob metric was rejected: it fires on the approved interior ink lines and also missed this blob.
- **Browser:** `?mute=1&scenario=anim_bipeds&enemyAnim=step`, vampire `atk_mid`.

#### E11 (cockatrice): the near wing squeezed in the hurt in-betweens
- **Cause:** in `hurt_in2.tweaks` (`cockatrice.yaml:144`), `wtip_n [7,4]` against `wsh_n [-2,1]` turns `wing_n` 20.2°. `z.hurt` (`:112`) draws `neck` and `head` over the wing, so most of it ends up under the turned neck (−18.4°): a thin noisy strip, merged with the tail at the root.
  - `hurt_in1` is cut from idle and has no wing joints, so the strip shows only in `hurt_in2` (twice in the hurt sequence).
- **Fix:** `wtip_n [-2,1]` (0°, like `wing_f`), or `[2,3]` (about 10°) if a dip is wanted. Checks are green.
  - `hurt_in2` is a legal hold (fallback).
- **Test:** F6 roughness ranks this frame first (+6.50), in the report.
- **Browser:** `?mute=1&scenario=anim_beasts&enemyAnim=step`.

#### E12 (pirate): the wind-up's first frame barely differs from idle
- **Cause:** `atk_wind1` (`pirate.yaml:72-77`) moves only `crown` and `neck` at t −0.20. Its largest joint move is 4.0 px, against 9.2 in wind2. In joint space wind1 already carries 0.50 of the wind-up (skeleton 0.26, lich 0.37), so the real problem is the small amplitude, not the split.
- **Fix:** wind1 `t: -0.30` with tweaks `crown [-4,0]`, `neck [-2,0]`, `el_n [-2,-2]`, `hand_n [-2,-2]`, `tip [-6,-3]`, `el_f [-2,-1]`, `hand_f [-4,-1]`. This gives a max move of 6.3 px and a share of 0.67, and checks are green.
  - Wind2 has room to go a little deeper (IoU into mid 0.558 against 0.515 needed).
  - A hold makes it worse.
- **Test:** a wind-evenness gate is rejected. A ≥ 0.40 share fails skeleton and lich and passes the pirate, and an amplitude gate flags 6 rigs. This stays a reviewer criterion ("anticipation visible in wind1").
- **Browser:** `?mute=1&scenario=anim_bipeds&enemyAnim=step`, pirate `idle → atk_wind1 → atk_wind2`.

#### E13 (runtime): a lethal hit in the hold or return steps back to `hurt_in1`
- **Cause:** `freezeDying` (`EnemyPoseController.ts:106-115`) always sets `t = 0`, so `dyingAt(0)` returns `hurt_in1` (`enemyChoreography.ts:124-128`).
- **Fix:**
  - Change the signature to `dyingAt(t, from, start = 0)`, which eases with `k = (t - start) / (DYING_IN - start)`.
  - In `freezeDying`, a hit in the hold starts at `DYING_IN` (straight to `hurt`, no shake). A return frame showing `hurt_in2` starts at `HURT_REHIT_AT`; one showing `hurt_in1` starts at 0.
  - A second `freezeDying` on an enemy that is already dying is a no-op (E17 needs this).
- **Test (RED first):** `EnemyPoseController.test.ts`: "a lethal hit during the hold or return never shows an earlier in-phase pose" (from the hold: 30 frames of `hurt`; from the return: poses ⊆ {`hurt_in2`, `hurt`}, with `dx` continuous within 3 px), and "freezeDying twice does not restart".
- **Browser:** `?mute=1&scenario=anim_bipeds`, a real kill during the recoil. Also `anim_goblin&enemyAnim=step`.

#### E14 (runtime): the first shake frame moves toward the party
- **Cause:** `enemyChoreography.ts:98`: `floor(local/2) % 2 === 0 ? +shake : -shake`. That produces −5 → −3 → −9.
- **Fix:** swap the signs (`=== 0 ? -shake : +shake`), giving −9, −9, −3, −3, ….
- **Test:**
  - Update the encoded sequences (`enemyChoreography.test.ts:46` and `:113` at scale 0.5, `EnemyPoseController.test.ts:78`).
  - Add "the first hold frame recoils further than the last in-phase frame".
- **Browser:** `anim_goblin&enemyAnim=step` through the hurt.

#### E15 (runtime): casts lift the whole sprite 6 px
- **Decision: drop the cast `dy` to 0, for boss and plain casts.** The alternative, feet planted with only the upper body rising, cannot be done at runtime, because a frame is one texture.
  - It would have to live in the rigs' `cast_gather`/`cast_rise`.
  - The approved `cast` keyframe, held for 10 frames, cannot rise, so the body would rise in the in-betweens and drop back at the hold.
  - The cast in-betweens already carry the motion with their feet pinned, which is what A10 asks for.
- **Fix:** set `from`/`to` to 0 in all six `BOSS_CAST` rows (`enemyChoreography.ts:46-53`) and all five `PLAIN_CAST` rows (`:55-61`). Lengths and `castOut` are unchanged.
- **Test:**
  - Update `enemyChoreography.test.ts:66`, `:67` and `:76`, and `EnemyPoseController.test.ts:165`.
  - Add "casts never move the sprite (dx = dy = 0 on every frame)".
  - Update §3.2 of ENEMY_ANIM_PLAN.md and the wording of probe A10.
- **Browser:** `anim_boss_garland` and `anim_boss_lich` with `&enemyAnim=loop`, and `anim_goblin_cast&enemyAnim=step`. Feet stay on the plain line.

#### E16 (runtime): a missing single sheet gives no console warning
- **Cause:** `BattleArt.ts:67-68` returns `null` silently when `meta.sheets[sprite]` is missing. Only a whole-atlas failure warns (`:107-108`).
- **Fix:** when the atlas is loaded but the entry is missing, call `console.warn` once per sprite (a private `Set`). There is no warning before the atlas loads, because that is the late-load path (A15).
- **Test (RED first):** `tests/rendering/BattleArt.test.ts`: "warns once when the atlas lacks a sheet", and no warning before `load()`.
- **Browser:** the A14 test-only atlas (as in T8); watch the console.

#### E17 (runtime, latent): a death with no damage event fades while the sprite animates
- **Cause:** the pose changes only in `reactEnemy` (`BattleAnimationController.ts:270-274`), which runs on damage events. The fade starts separately, on HP ≤ 0, in `BattleDisplayManager.updateEnemySprites` (`:225-232`).
- **Fix:** where `dyingEnemies.set(i, 30)` is called, also call `enemyView?.poses.freezeDying(i)`. E13's no-op guard keeps the normal path, which calls `freezeDying` first, from restarting.
- **Test (RED first):** "an enemy whose HP reaches 0 without a damage event enters dying" (poses `hurt_in1` → held `hurt`, never `idle_b`).
- **Browser:** not reachable in act 1. In `anim_status`, set an enemy's HP to 0 through `window.__game` (dev).

#### E18 (dev only): the step label overlaps the battle message
- **Cause:** `enemyAnimPreview.ts:112` places the label at (16, 16). The message window spans y 0 to `BATTLE_MESSAGE_HEIGHT` (120) (`BattleScene.ts:137`, `BattleSceneTypes.ts:40`).
- **Fix:** place it at `(16, BATTLE_MESSAGE_HEIGHT + 8)`.
- **Test:** `enemyAnimPreview.test.ts`: "step label sits below the message window". Use an exported `LABEL_POS` if `BitmapText` can't be built in vitest.
- **Browser:** `?mute=1&scenario=anim_bipeds&enemyAnim=step` during a message.

### 2. Wave 0: framework (one owner, lands first)

The owner is the T0 framework owner (§7 ownership: `rig*.py`, `anim_*.py`, `monster_*.py`, the selftests). Each
item is RED first in a new `assets-src/gen/selftest_efix.py`, called from `test_monster_anim`.

| # | Change | Files | Output effect |
|---|---|---|---|
| F1 | Exclude fx-labelled pixels (`kind: fx`) from check 6's area ratio and bbox height, in the frame (`labels`), its source (`src_labels`) and its target (`toward_labels`). Continuity, IoU and centroid are unchanged. | `anim_checks.silhouette`, `monster_check.frame_checks` | none (check only) |
| F2 | Per-frame part `scale` (`frames.<f>.scale: {part: s}`, 0.25 ≤ s ≤ 1), rendered through the rigid map scaled about the part's first joint, via rotsprite. Default 1.0 takes today's code path unchanged. | `rig_render.rigid` / `rotsprite` / `_rigid_map`, `monster_anim.generate` (`:212-216`) | none unless used |
| F3 | fx-mask integrity lint: opaque pixels inside an fx part's mask polygon that end up labelled as another part fail. For non-fx parts, mask pixels claimed by another part are printed in the review report but don't fail. Today's largest: garland hurt `cape_h` 313 px; lich idle `cape` 154, attack `glaive` 324, hurt `drape` 746, cast `spread` 89. | `monster_check`, `monster_review` | none (check only) |
| F4 | Intra-part crease: new ink (label −2) that is fully inside the silhouette and has the same part label on both sides (left/right, up/down or a diagonal pair) fails when its largest 8-connected piece is ≥ `ceil(5 * cell_h / 80)`. | `anim_checks`, `monster_check.frame_checks` | none (check only) |
| F5 | Foot release only in a rearing hurt: the contact-mask exemption (`monster_anim.py:229-230`) applies only to `hurt_in1`/`hurt_in2`. In every other pinned frame, each foot grounded in its source keeps its lowest row ±1. | `monster_anim`, `anim_feet` | none (check only) |
| F6 | Edge-roughness report: spur and notch pixels per 100 edge px, frame minus source, written to `<id>_report.json` and printed as a top-10 by `review`. Report only, not a gate: the measured gap between flagged and clean frames is too small (garland `atk_mid` +5.02, ogre `hurt_in2` +5.21). | `monster_review`, `anim_checks` | none |
| F7 | Prop-attached guard: in frames without a carry, a prop touches its grip part by ≥ 4 px (measured minimum 15). This is a regression guard; it cannot detect E9. | `anim_checks`, `monster_check` | none (check only) |

**Measured expected-RED on the current rigs.** This list is the wave-0 hand-off:
- F3: lich `attack` (1409 px).
- F4: wolf `hurt_in1` (6) and `atk_recover` (5), lich `hurt_in2` (19).
- F5: wolf `atk_recover` (`paw_n` 2 px).
- F1, F2, F6 and F7 fail nothing.

**Staging:**
- F3-F5 and F7 land in `monster_anim.py check` and `review` at once.
- They join the **build gate** (`build_monsters_ai`) only at integration, after wave 1. Until then, rig agents can still build the atlas locally for browser tests.
- The owner then runs `check --all` and confirms two things:
  - Every lock matches. Wave 0 changes no frame byte, so **no rig needs a re-lock for wave 0**.
  - The only failures are the expected-RED list above.
- On-call: the owner stays available for two escalations, the per-frame `sampler` override (E9) and a per-frame `z` override, if a rig asks. Each lands serially, with the same `check --all` lock proof.

### 3. Wave 1: tranches in parallel (disjoint files)

| Tranche | Items | Owns (only) | Re-lock |
|---|---|---|---|
| R runtime | E1, E13-E18 | `src/scenes/battle/{enemyChoreography,EnemyPoseController,BattleAnimationController,BattleDisplayManager,enemyAnimPreview}.ts`, `src/battle/BattleStateMachine.ts`, `src/rendering/BattleArt.ts`, their tests (incl. the `nextActorLosesTurn` mocks), the §3.2 tables / A10 wording in `docs/ENEMY_ANIM_PLAN.md` | n/a |
| G1 bosses | E2, E3, E4 (+ F4 lich `hurt_in2`) | `garland.yaml/.lock.json`, `lich.yaml/.lock.json` | garland, lich |
| G2 cloth / bird | E5, E10, E11 | `vampire.*`, `cockatrice.*` | vampire, cockatrice |
| G3 beasts | E6, E8 (+ dragon `atk_follow` roughness) | `dragon.*`, `wolf.*` | dragon, wolf (gr_wolf re-checked after recolour) |
| G4 heavy / bipeds | E7, E9, E12 | `troll.*`, `ogre.*`, `pirate.*` | troll, ogre, pirate |

- **Untouched, must stay hash-identical:** goblin (and gr_imp), skeleton, mummy. Their lock entries in `check --all` are the proof.
- **Shared rules from §7 apply:**
  - Rig agents may build the atlas locally, and must run `git checkout -- assets/sprites/monsters-ai.*` before hand-off.
  - Only the integrator rebuilds and commits the atlas.
- **Iteration budget:** at most **3 iterations per rig** (one rig edit plus one `review <id>` run, all checks green before the visual read). After 3, the owner stops and reports the latest strips, the failing criterion and the options:
  - a legal hold, where one exists: cockatrice `hurt_in2`, wolf `hurt_in2`, troll `atk_follow`;
  - a framework escalation to the wave-0 owner;
  - escalation to the orchestrator.
- **Holds:** none of the 12 rigs has a hold today. Before using one, the owner checks that it is legal with `check`, and records the reason in the rig file.

### 4. After the fixes

1. **Image-only review.** The 9 changed monsters are garland, lich, vampire, cockatrice, dragon, wolf, troll, ogre and pirate; gr_wolf is checked after recolour.
   - The reviewer is a fresh agent per monster. It gets only the review strips, onion sheet, GIFs and `_stage.png`, plus the approved sheet.
   - It answers the 5.3 criteria (adapted to the creature) plus the item's own question, and every answer must be yes.
   - Each item's question:
     - **E2:** the cape is one piece behind the arm.
     - **E3:** no piece of the arc in `atk_follow`.
     - **E4:** the orb grows and shrinks in steps.
     - **E5:** face, collar and buttons intact.
     - **E6:** horns and hind legs read in both hurt frames.
     - **E7:** one head; no seam.
     - **E8:** no crease; forepaws planted in `atk_recover`.
     - **E9:** club on the hand or behind the shin, never floating; back edge clean.
     - **E10:** no smear or blob.
     - **E11:** the wing reads.
     - **E12:** anticipation visible in wind1.
2. **Targeted browser re-test** of every E item at the URL given in section 1 (`npm run dev`, Playwright, always `?mute=1`), with one step-mode screenshot per item.
3. **Regression sweep, A1-A20 quick pass.**
   - A full A1 step-through applies only to the changed sprites; the rest get one loop each.
   - A4/A5 (draw order, flash) and A7/A8 (re-hits, death, now with E13 and E17).
   - A10 with E15: feet on the plain through every cast.
   - A16 pacing is unchanged. A18 is extended with the E1 case.
   - A19 FPS on `anim_crowd`; A20 prop carry with the new ogre `club_h`.
4. **Integrator (one agent).**
   - Merges R and G1-G4, and moves F3-F5 and F7 into the build gate.
   - Rebuilds the atlas once and checks determinism, then commits the atlas and locks.
   - Updates `docs/ENEMY_ANIM_PLAN.md` §3.1, which says the crystal "is absent from `cast_rise`" (now 55%), and §5.1 (F1 exemption, F3-F5 and F7).

### 5. Validation commands

```bash
python3 -I assets-src/gen/selftest.py                         # incl. selftest_efix (RED fixtures first)
python3 -I assets-src/gen/monster_anim.py check --all         # 0 failures, every lock matches
python3 -I assets-src/gen/monster_anim.py review garland lich vampire cockatrice dragon wolf troll ogre pirate
shasum assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.* > /tmp/party.sha
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai.* > /tmp/a.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai.* | diff - /tmp/a.sha
shasum -c /tmp/party.sha && git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
npx tsc --noEmit && npm run build && npm test
npx vitest run tests/scenes/battle/ tests/data/assetCoverage.test.ts tests/rendering/ tests/battle/
# Browser: http://localhost:5173/?mute=1&scenario=anim_<group>&enemyAnim=loop | step
```

### 6. TODOs

- [ ] W0.1 Write the RED selftest fixtures for F1-F5 and F7 (priority: high, effort: 2h)
- [ ] W0.2 F1 fx exemption, F3 mask lint, F4 crease, F5 foot release, F7 prop guard until GREEN (priority: high, effort: 3h)
- [ ] W0.3 F2 part `scale` (rigid and rotsprite) with identity and palette selftests (priority: high, effort: 2h)
- [ ] W0.4 F6 roughness in the review report (priority: medium, effort: 1h)
- [ ] W0.5 `check --all`: every lock matches; failures equal the expected-RED list; hand off (priority: high, effort: 0.5h)
- [ ] R.1 E1 `nextActorLosesTurn` and the no-lunge path, with tests (priority: high, effort: 2h)
- [ ] R.2 E13 dying start pose and E17 no-event dying, with tests (priority: medium, effort: 2h)
- [ ] R.3 E14 shake sign and E15 cast dy 0, tests updated (priority: medium, effort: 1h)
- [ ] R.4 E16 warning and E18 label, with tests (priority: low, effort: 1h)
- [ ] G1.1 garland E2 masks, hem cap and paint clean-up, at most 3 iterations, re-lock (priority: high, effort: 3h)
- [ ] G1.2 lich E3 arc as fx, crown piece; E4 fx crystal at scale 0.55; F4 `hurt_in2`; at most 3 iterations, re-lock (priority: high, effort: 3h)
- [ ] G2.1 vampire E5 and E10; cockatrice E11; at most 3 iterations each, re-lock (priority: high, effort: 2h)
- [ ] G3.1 dragon E6 masks, width and tail; `atk_follow` look; at most 3 iterations, re-lock (priority: high, effort: 4h)
- [ ] G3.2 wolf E8 neck mask, pins and haunch; gr_wolf recolour check; re-lock (priority: high, effort: 2.5h)
- [ ] G4.1 troll E7 masks and arm; ogre E9 `club_h`, back paint and wind2 arm; pirate E12 wind1; re-lock (priority: medium, effort: 3h)
- [ ] V.1 Image-only review of the 9 changed monsters (priority: high, effort: 2h)
- [ ] V.2 Browser re-test of each E item plus the A1-A20 sweep (priority: high, effort: 3h)
- [ ] V.3 Integrator: build gate, single atlas rebuild, determinism, docs, validation (priority: high, effort: 1.5h)

### 7. Decisions for the orchestrator

| ID | Question | Recommendation |
|---|---|---|
| O1 | E1, fear: the 50% skip is rolled at execute time. Should the enemy lunge, or should the roll move to announce time? Moving it changes RNG order and the battle-determinism tests. | Keep the lunge for fear in this round; only the always-skip statuses and lethal poison skip it. |
| O2 | F1 exempts fx parts from check 6's area and height. This relaxes a §5.1 check. | Accept. Fx parts are declared per rig and reviewed; only lich trail and crystal, garland glow and vampire slash are affected. |
| O3 | E8: the wolf's forepaws lift 6 px in `hurt_in1`. | Accept as the start of the rear (u 0.32 toward a pose whose forepaws are about 20 px up). |
| O4 | E4: gather→rise changes about 97% of pixels (the idle→cast source switch, IoU 0.377). | Accept as inherent; the smaller orb softens it. |
| O5 | E3: with the arc dropped, the glaive shows a bare shaft end in `atk_follow`. | Accept (plan 3.1 already drops the trail at follow); the reviewer confirms. |
| O6 | E6: no legal hold exists for the dragon's hurt in-betweens. If 3 iterations fail, either allow a continuity exemption for one hold, or keep the best green version. | Decide only if G3 escalates. |

### Orchestrator decisions

| ID | Decision |
|---|---|
| O1 | A feared enemy still lunges this round. Fear's skip is rolled at execute time, and moving the roll would change RNG order. |
| O2 | Accepted: designated spell-effect parts are excluded from the area and height checks. The orb is fx, not body, and the continuity checks still cover the body. |
| O3 | Accepted: the wolf's 6 px forepaw lift in `hurt_in1` is the start of its rear. |
| O4 | Accepted: gather → rise is where the pixel source switches, from idle to cast. |
| O5 | Accepted: once the arc is dropped, the glaive in lich `atk_follow` is a bare shaft. |
| O6 | The dragon's hurt in-betweens get no continuity exemption by default. If its 3 iterations fail, escalate to the user with the best images. |

### Revisions after the momus review (binding)

Momus verdict: REVISE (4 must, 6 should, 8 nits). All are adopted, and they override the fix plan where the two differ.

1. **New checks stay out of the build gate until V.3.** `check_sprite(..., efix_gates: bool = True)` is threaded into `frame_checks`. `monster_anim.py check/review` pass `True`; `monster_atlas.sprite_frames` passes `False` until the integrator flips it in V.3 (one line). `selftest_efix` tests F3–F5 and F7 on synthetic fixtures only, so wave-0 selftest stays ALL PASSED.
2. **E3 uses the merge option only.** Delete lich `blade` (`lich.yaml:99`) and its mask (`:124-125`), add the polygon to `masks.trail.attack`, and drop the `tr` tweaks (`:153`, `:159`). F3 stays "fx-mask pixels labelled as any other part".
3. **The fx scope is enforced.** `selftest_efix` gets an allowlist check: fx parts must be exactly `{garland: {glow}, lich: {trail, crystal}, vampire: {slash}}`. Rule for §3: no new `kind: fx` without orchestrator approval.
4. **The E4 crystal assertion is added by the integrator in V.3**, as a selftest on the real lich: the crystal in `cast_rise` is at most 40 % of its size in `cast`. It is listed in the V.3 pass criteria.
5. **Lich `hurt_in2` crease:** 18 of the 19 px are the flat bottom edge of `masks.head.hurt` (`lich.yaml:137`) at y 112, x 131–149, opened by `neck [4,-3]` (`:174`). Reshape the mask edge onto an existing ink line, or paint the edge. Don't change the tweak, because the height check depends on it.
6. **Locks follow V.1.** A V.1 rejection returns to the tranche owner and counts as one iteration; escalate after 3. Run `lock <id>` only after V.1 passes, then hand the locks to the integrator.
7. **Browser checks for E1, E13 and E17 run in real battles, not step mode.** For E1: `?mute=1&scenario=anim_status`, with no `enemyAnim`. In round 1 the mages cast SLEP and HOLD, the knight and the ninja use Potions, and the goblins live. From round 2 on, watch each goblin's turn: read the pose through `window.__game`, or screenshot the announce and execute frames. E13 and E17 follow the same approach. Step-mode URLs use the full form, e.g. `?mute=1&scenario=anim_goblin&enemyAnim=step`.
8. **The E1 lookahead mirrors the tick.** It uses enemy `data.stats.hp` and party `char.maxHp`, and requires poison damage > 0. If a shared helper is extracted, `src/battle/StatusTick.ts` joins tranche R. Unit test: sleep with 1 turn left still skips, because `skipTurn` is computed before the status expires.
9. **gr_imp stays unchanged.** In V.3, crop its cells by the JSON frame rects and compare the HEAD atlas with the rebuilt one; they must be byte-equal.
10. **F1 excludes the fx's own outline.** It excludes fx-labelled pixels plus any `-2` outline pixels 8-adjacent to fx pixels. The selftest and the check use this same definition.
11. **E4 crystal:** drop the orphaned `cm` tweaks (`:184`, `:189`) and re-derive `cry`.
12. **E7:** re-derive the `atk_follow` hump paint (`troll.yaml:130-131`).
13. **E6:** a rig-level `width: 16` is in cell px (not scaled).
14. **F4:** "fully inside" means all 8 neighbours are opaque.
15. **E1 mocks:** needed only in `turnListFit`, `enemyPoseFlow` and `meleeContact` (3 places).
16. **Expected reds:** the expected-red list is matched by frame, not by message.
17. **E13:** the dying start pose follows the frame on screen: `hurt` → `DYING_IN`, `hurt_in2` → `HURT_REHIT_AT`, `hurt_in1` → 0.
18. **Wave-0 changes during the wave:** an on-call wave-0 fix lands on `enemy-anim`; the requesting worktree merges it, and the other tranches pick it up at integration. E16's test-only atlas is built by copying the JSON and deleting one sheet entry in a temp dir (no repo change).

## Result

Integrated on `enemy-anim` (V.3). Commits after `1692c05`: plan (`bcb3c6a`, `d76f38c`), wave 0 (`00ef35e`), wave 1
(`87c56f5` R, `5aaacd5` G2, `2ada78f` G4, `14747cd` G3, `67fcc0f` G1), V.1 follow-ups (`17026b8`, `09382c6`,
`671c005`), zero-nit paint and locks (`08253dc`), integration and atlas (`f17c83b`). The style lock held: no file
under `assets-src/gen/approved/` changed, and no image was generated (paid or Bedrock).

### Per item

| ID | Done |
|---|---|
| E1 | `BattleStateMachine.nextActorLosesTurn()` (sleep, stun, stone, lethal poison; no RNG). An enemy that loses its turn goes straight to execute, frozen on idle. Fear still lunges (O1). |
| E2 | Garland: `cape_i` mask covers the whole cape and the sword mask starts at the pommel. Cape and blade ride the body in wind / recover, so there is no flap and no blade-lift fill. Seam and pinhole paint. |
| E3 | Lich: the frost arc is one fx `trail` (the `blade` part merged into it, revision 2). The head mask is clear of the arc, and the pale remnant at the hidden shaft end is cleared, leaving a bare shaft (O5). |
| E4 | Lich: the crystal is fx, rigid in the fist, at `frames.cast_rise.scale: {crystal: 0.55}` (332 of 1093 px in `cast_rise`, 30 %). `cast_gather` is deeper. The real-lich selftest (revision 4) asserts ≤ 40 %. |
| E5 | Vampire `atk_recover`: the head slide is cut to crown / neck / `cv_0` [2, 1], so face, collar and buttons stay intact. |
| E6 | Dragon: in `hurt_in2` the neck and head keep the hurt angle (no ghost horn). Hurt `thigh_n` and `thigh_f` masks, the idle belly band moved to the body, a hip lift without spine tweaks in `hurt_in1` (t 0.32), longer `hurt_in2` hind legs, body `width: 16`. `atk_mid` / `atk_follow` use rotsprite with a smaller `wt_f` spread (roughness +5.28 → +0.30). V.1 follow-up: the far hind leg is repainted as the hurt key's leg, and the specks are removed. |
| E7 | Troll: the hump rides with the head in `atk_follow` (head mask), so there is one head. The belly flank is kept off the near arm, and the follow forearm is lowered about the elbow only. V.1 follow-up: the hump notch is closed, and the `hurt_in2` mallet sits behind the loincloth. |
| E8 | Wolf: the idle neck mask is redrawn (no crease, F4), the `atk_recover` forepaws are planted (F5), and the `hurt_in1` hocks are pinned (haunch). The 6 px forepaw lift in `hurt_in1` is accepted (O3). gr_wolf is re-checked after the recolour. |
| E9 | Ogre: the hurt club lies behind the near shin (`club_h`), with the head ends past the shin erased. The `hurt_in2` back edge and shoulder blade are evened out by paint, and the `atk_wind2` arm runs along the side. |
| E10 | Vampire `atk_mid`: `el_n` / `hand_n` stay on the attack pose (no smear), the ink-blob paint is removed, and the stray collar pixel is inked. V.1 follow-up: the collar spike is joined to the head. |
| E11 | Cockatrice `hurt_in2`: the near wing is not turned (`wtip_n` [-2, 1]). |
| E12 | Pirate: wind1 anticipation (t −0.30, sword arm drawn back and up, head back) and a deeper wind2. |
| E13 | The dying start pose follows the frame on screen: `hurt` → `DYING_IN`, `hurt_in2` → `HURT_REHIT_AT`, `hurt_in1` → 0. |
| E14 | The shake signs are swapped, so the first hold frame recoils away from the party (−9, −9, −3, −3, …). |
| E15 | Every `BOSS_CAST` and `PLAIN_CAST` row has dy 0, so the feet stay on the plain; the motion is in the pinned cast in-betweens. |
| E16 | `BattleArt` warns once per sprite when the loaded atlas lacks its sheet (no warning before the atlas loads). |
| E17 | Where the fade starts (`dyingEnemies.set`), the enemy also enters `freezeDying`, so a death with no damage event holds `hurt` instead of animating. |
| E18 | The step label sits at `(16, BATTLE_MESSAGE_HEIGHT + 8)`, below the message window. |

Framework (wave 0): F1-F7 as planned, and `monster_render.py` / `rig_rotsprite.py` were split out. In V.3, F3-F5 and
F7 joined the build gate (`monster_atlas.sprite_frames` now passes `efix_gates=True`).

### V.1 image review

- **Round 1:** cockatrice, wolf and pirate SHIP, and were locked (`17026b8`). The other six returned to their owners.
- **Round 2 (follow-ups):**
  - vampire, garland and lich got outline fixes (`09382c6`);
  - dragon, ogre and troll got rig and paint fixes (`671c005`).
- **Final zero-nit list:** 11 px of paint (`08253dc`). Each pixel was verified by a HEAD-vs-new per-frame diff (only the
  listed pixels changed) and by zoomed crops.
  - ogre `hurt_in1` (77, 83) and (79, 86), `hurt_in2` (58, 39) and (71, 70): 1 px background holes closed with ink.
    The `hurt_in1` holes are at the club hand / hip. The coordinates reported for `hurt_in1` had no hole; they belong
    to `hurt_in2`.
  - vampire `atk_follow` (42, 34): a hole in the hair, closed with ink. `atk_recover` (37, 36) and (39, 38): stray
    red → lapel colour.
  - garland `atk_mid` (125, 159) and (126, 160): leg fill. `atk_follow` (131, 137): ink.
- **Then locked:** dragon, ogre, troll, vampire, garland and lich.
- **Browser re-test (V.2):** not recorded here.

### Locks

All 12 rigs are locked (goblin, skeleton and mummy since before this round). `monster_anim.py check --all`: 12 × OK,
and no lock line.

### V.3 validation

| Command / check | Result |
|---|---|
| `python3 -I assets-src/gen/selftest.py` | ALL PASSED. The new lich crystal check was RED first: with the scale at 1.0 in memory, 1093 / 1093 px. |
| `monster_anim.py check --all` with the gates on in the build | all OK |
| `build_assets.py monsters_ai battle_ai field_ai` | OK. Party atlases byte-identical (`git diff --exit-code`); `monsters-ai.json` unchanged. |
| Monster atlas rebuilt with `PYTHONHASHSEED=1 python3 -s` | `cmp`-identical PNG and JSON |
| gr_imp, goblin, skeleton, mummy cells (cropped by the JSON rects, HEAD atlas vs rebuilt) | byte-equal (revision 9) |
| `npx tsc --noEmit -p .`, `npm run build` | clean |
| `npx vitest run` | 163 files, 2718 tests passed |

### Remaining accepted nits

- **Decisions:** O1 (a feared enemy lunges), O3 (wolf forepaw lift in `hurt_in1`), O4 (gather → rise source switch)
  and O5 (bare glaive shaft in lich `atk_follow`).
- **Source art:** the ogre's approved idle club is cut flat at x 106.
- **Edge notches copied from the approved keyframes, not holes:**
  - vampire `atk_follow` (70, 53), (65, 55), (67, 55), (58, 60), the same pixels as in the attack key;
  - vampire `atk_recover` (61, 46), from idle (62, 46);
  - garland `atk_follow` (133, 116), on the silhouette edge.
- **Report only:**
  - edge roughness top values: vampire `atk_mid` +5.36, garland `atk_mid` +4.52, ogre `atk_mid` +3.65;
  - mask overlap: garland hurt `cape_h` 313 px (sword 310), idle `cape_i` 12 px.

### V.2 browser re-test (2026-11-14)

All 18 E items pass in the browser. E1, E13 and E17 were tested in real battles.

The A1–A20 regression sweep passes, except:
- A6: not applicable (no multi-target damage spell).
- A9: covered by a unit test only.

Real battles also pass:
- an overworld Gr.Imp pack;
- Garland via `r_temple_garland`;
- Retry Battle after a wipe.

754 stepped frames match the atlas cells exactly, so there is no blur, bleeding, half-pixel offset or wrong frame. `anim_crowd` runs at a median of 120 fps, with a 1st percentile of 97. The only console output is the expected E16 warning.

One new polish item is accepted, not fixed: the ogre's club and the troll's mallet show only a few pixels in `hurt_in2`. The prop-carry check passes, and the big pose change in that step hides the switch.

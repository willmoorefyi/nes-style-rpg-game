# Hero battle facing fix (pass HF)

In battle the heroes stand on the right and must face left, toward the enemies. Several approved hero battle poses
(Gemini sheets, `assets-src/gen/approved/<class>/battle.png`, 3x2 cells of 80x80 native px) face right. This pass
turns them with a recorded, build-time transform. No AI image call of any kind; no approved PNG is edited.

## 1. Scope (user rulings, 2026-11-25)

| Rule | Classes | Pose(s) | Transform |
|------|---------|---------|-----------|
| R1 | black_mage, master, red_mage, red_wizard, knight, thief, warrior, ninja, white_mage (9) | down | whole figure |
| R2 | all 12 | hurt | whole figure |
| R3 | ninja, black_mage, white_mage | cast (+ cast_rise / cast_release, which are cut from it) | whole figure |
| R4 | ninja | ready (+ idle_b, atk_wind1, atk_wind2, cast_gather, which are cut from it) | head only |
| R5 | master | ready (+ the same four), see 1.1 for attack | head only |

Untouched: monk / black_wizard / white_wizard down, every victory, every kneel key, every other cell.

### 1.1 Verified per frame (native cells, 8x zoom, `/tmp/hero-facing/`)

- **ninja.** ready faces right (bandana tails trail left, face on the right of the hood). idle_b, atk_wind1,
  atk_wind2 and cast_gather are cut from ready by `puppet.py` (`SOURCE`), so they inherit its head: all four face
  right. atk_mid and atk_follow are cut from the attack key, whose head already faces left: no change needed. So
  R4 = one head flip on the **ready** cell; the four in-betweens follow through the puppet.
- **master.** ready faces right (the face's features on the right, the shaded back of the skull on the left), so do
  idle_b, atk_wind1/2, cast_gather. Unlike the ninja, master's **attack key** head also faces right, and atk_mid /
  atk_follow are cut from it; to fix those two (named in R4 / R5) the attack key's head is flipped as well. This goes
  one cell beyond the letter of R5 ("the attack key already faces left" holds for the ninja only) and is reported to
  the user as a decision (one json entry to drop). master's **cast** head also faces right; cast is not in R5, so it
  stays: cast_gather (from ready) will face left and cast_rise / cast / cast_release right. Reported, not changed.
- The n/f joint convention: the yaml headers define n = near (viewer-side) limb, f = far limb, and `Z_BACK_ARM` /
  `Z_FRONT_ARM` draw the n limbs in front of the torso. In all 36 keyframes of `gen/anim/<class>.yaml` the n shoulder
  and hip also lie left of the f ones (`sh_n.x < sh_f.x`, `hip_n.x < hip_f.x`), and `battle_targets` lerps ready and
  cast joints label by label. A horizontal mirror keeps depth but swaps sides, so a mirrored keyframe cannot satisfy
  both meanings with one labelling; section 5.1 settles it.
- The ninja and master kneel keys (`battle_kneel.png`) already face left, so the bridge from a flipped ready head
  stays consistent with the key.

## 2. Data: `battle.json` `facing_fix`

A list next to the existing `face_fix`, applied after it, in the one function every reader of hero battle cells
already goes through. Each entry:

```json
{"pose": "hurt", "mirror": "figure", "note": "..."}
{"pose": "ready", "mirror": "head", "box": [x0, y0, x1, y1], "exclude": [[x0, y0, x1, y1]], "sum": 82, "note": "..."}
```

- `mirror: figure` — every pixel of the cell moves to x' = (xmin + xmax) - x, xmin / xmax = the opaque bounding box
  of the cell (after `face_fix`). Rows are untouched.
- `mirror: head` — the head mask M = opaque pixels with x0 <= x < x1, y0 <= y < y1, minus the `exclude` rects
  (half-open). M is erased, then each pixel of M is written at x' = sum - x on the same row, over whatever is there
  (the head is in front). `sum` is an integer, so the reflection is exact (no resampling, no half pixels).
- A pose may carry at most one entry; unknown keys, a pose not in `poses`, a `mirror` other than `figure` / `head`, a
  `figure` entry with `box` / `exclude` / `sum`, a `head` entry without a 4-int `box` or with a non-integer `sum`, or
  a reflected pixel outside columns 1..78 raise `ValueError` at build time (fail closed).

Entries (27 at first, 26 after section 11): 24 figure entries (9 x down, 12 x hurt, 3 x cast) and 3 head entries (master attack dropped in 11): ninja ready `box [8, 2, 56, 28]`,
`exclude [[18, 25, 31, 28]]` (the near fist's top), `sum 84` (82 before review 1); master ready `box [28, 5, 54, 25]`, `sum 82`; master
attack `box [33, 8, 60, 27]`, `sum 91`. The boxes stop at the row above the collar / neck, measured on the cells.

### 2.0 Expected changed atlas cells (exact set; any other changed cell fails step 7.4)

| Class | Cells (atlas pose names) |
|-------|--------------------------|
| black_mage, white_mage | cast, hurt, down, cast_rise, cast_release |
| ninja | ready, cast, hurt, down, idle_b, atk_wind1, atk_wind2, cast_gather, cast_rise, cast_release, and at most kneel_in1, kneel_in2, kneel_b |
| master | ready, attack, hurt, down, idle_b, atk_wind1, atk_wind2, atk_mid, atk_follow, cast_gather, and at most kneel_in1, kneel_in2, kneel_b |
| knight, red_mage, red_wizard, thief, warrior | hurt, down |
| monk, black_wizard, white_wizard | hurt |

The `kneel` column (the AI key) is byte-equal for every class; the kneel bridge cells of the ten classes whose ready
is unchanged are byte-equal.

### 2.1 Code (`assets-src/gen/puppet.py`, single entry point)

- New `apply_facing_fix(sheet, meta, gw, gh, cols, poses)` and `apply_review_fixes(...)` = `apply_face_fix` then
  `apply_facing_fix`. `battle_sheet_frames` and `build_assets.build_battle_ai` call `apply_review_fixes` (today both
  call `apply_face_fix`; `build_battle_ai` also gets its in-betweens and kneel frames from `battle_sheet_frames`, so
  everything downstream sees the same turned cells). All other readers (`kneel_ai_data`, `kneel_ai_calib`,
  `kneel_bridge_review`, `puppet_kneel`) already use `battle_sheet_frames`.
- New `facing_masks(cid) -> {pose: bool[h, w]}`: the reflected head mask (M mapped to x') of each `head` entry,
  keyed by source pose (ready / attack only), used by the segmentation (5.2). `render` segments each source pose once
  (`labels[src]`), so it looks the mask up by that source pose.
- One shared helper `figure_sum(cell)` (the reflection's S, section 3; on the cell after `face_fix`) is used by both
  the pixel mirror and the joint mirror (5.1), so they cannot drift. `load_cfg` therefore reads
  `approved/<id>/battle.json` and the cell through the same `battle_sheet_frames` path (without the facing fix).
- The dead duplicate `apply_face_fix` in `build_assets.py` (lines 69-86, unused) is left alone and gets no
  `facing_fix` support.

## 3. Anchor and feet (no jump)

The runtime draws every hero cell at one fixed top-left per party slot (`src/scenes/battle/partySprites.ts`:
`PARTY_X[i]`, `PARTY_FEET_Y[i] - (footRow + 1) * scale`); there is no per-pose anchor. So "the hero must not jump"
means the turned figure must occupy the same place in its cell:

- figure mirror (**revised after image review 1**, see 10): x' = S - x with S = 2 x the opaque pixels' mean x,
  rounded half up (integer arithmetic), so the figure's visual centre (its pixel mass) stays within half a pixel;
  rows do not move, so the feet row (`bottom_row` 76, `footRow`) and the top row stay. S is clamped to
  [xmax + 1, xmin + 78] so the reflected figure stays in columns 1..78 (fail closed otherwise); only then does the
  centre move, by the least amount (4 cells, see 10). The first version reflected about the bbox centre, which keeps
  the bbox but moved a figure with a long staff or a sprawled body by up to 12 px (review 1: white_mage cast and hurt).
- head mirror: rows outside [y0, y1) are byte-identical; `sum` is picked so the head sits over the same shoulders
  (ninja: hood 29..52 / chin 32..54 -> 84 (82 at first; review 1 found its chin flap 3 px past the collar where the
  fist moves away in atk_wind2 / cast_gather, 84 halves it and keeps the hood over the collar 29..55); master ready: head 30..51, chin row 24
  32..50 -> 82 maps that row onto itself; master attack: head 35..56, rows 19 / 26 -> 91). The feet and the body do
  not move.

Test (5): for every `figure` entry the atlas cell equals the approved cell reflected with `figure_sum` (exact),
the rows are equal, the figure stays in columns 1..78 and its mean x moves by at most 0.5 px unless S was clamped; for every `head` entry the atlas cell is byte-equal to the approved cell on every row outside
[y0 - 1, y1 + 1) (the box rows plus the outline-closure margin), so the whole body below, feet row included, is
identical.

## 4. Head mask quality (R4 / R5)

- Seam-free: the mask stops on the last head row above the collar, so the body rows are untouched; the head's own
  1 px outline travels with it. After the write, the outline closure of `puppet.outline` runs **restricted to the box
  rows +- 1**: a light pixel (max channel >= 60) left on the silhouette edge gets an `OUTLINE` (6, 4, 10) pixel
  outside it, which closes any edge that the old head used to cover. Specks: no component under 12 px may be created
  (checked, not silently deleted).
- Palette unchanged: only existing pixels move, plus `OUTLINE`, which every hero sheet already uses; checked
  (colours of the result subset of the cell's colours + OUTLINE).
- Binary alpha: pixels are copied whole (alpha 0 / 255 only); checked.
- Pieces: the number of 4-connected opaque components does not grow; checked.
- The checks of this section raise at build time (`apply_facing_fix`), so a bad box can never reach the atlas.

## 5. Joints and in-betweens

### 5.1 Figure mirror of a keyframe (cast of ninja, black_mage, white_mage)

`anim/<class>.yaml` keeps its joints on the approved PNG (so the file still describes the reference sheet). In
`puppet.load_cfg`, for a keyframe (ready / attack / cast) with a `figure` entry:

1. every joint (and `tip`) maps to x' = S - x with that cell's `figure_sum`;
2. the n / f labels swap (`sh, el, hand, hip, knee, foot`, and `weapon_hand` n <-> f) so that `n` stays the
   screen-left limb, as in every other keyframe (1.1); otherwise `cast_rise` (a lerp of ready and cast joints label by
   label) would cross the arms and legs;
3. depth: after the swap, the physically near limb of the mirrored pixels is labelled f. So for an in-between whose
   pixel source is a mirrored keyframe (`cast_rise`, `cast_release`; every part comes from cast), `battle_inbetweens`
   draws with the z list chosen by `front_far_arm.cast` with n and f exchanged (`uarm_n` <-> `uarm_f`, ...), so the
   limb in front of the torso in the approved cast stays in front. The convention, stated once in `puppet.py`'s
   docstring and in the three caster yaml headers: "n / f = near / far on an unmirrored keyframe; on a `facing_fix`
   figure-mirrored keyframe the labels follow the screen side (n = screen-left) and the draw order is swapped".
   Check: in the review strips of cast_rise / cast_release no far-limb pixel lies over the torso where it did not in
   the mirrored cast key.
4. `cast_hand` (white_mage: `n`) swaps with the labels (to `f`) in `load_cfg` when cast is mirrored.
5. `segment`'s cape rule (`cape_behind`, bluish pixels right of `hip.x + 5`) now sees the mirrored cast, whose back
   is on the right as in every other keyframe, so it applies as intended; re-checked in the review.

Hurt and down are not keyframes and carry no joints.

### 5.2 Head mirror of a keyframe (ninja ready, master ready / attack)

The joints stay as marked: the head part is rigid, its rotation in an in-between is `angle(target) - angle(source)`
of the neck -> crown bone, and the target is built from the same yaml joints, so the head poses exactly as before,
now with the flipped pixels. The bandana tails move to the far side of the head, where nearest-bone segmentation could
hand some of them to `uarm_f`; so `segment()` gets an optional head mask: every pixel of the reflected mask
(`facing_masks`) is labelled `head`, like `torso_colors` does for the torso. Only cells with a `head` entry are
affected.

### 5.3 Retuning

The cast-sourced `tweaks` of ninja / black_mage / white_mage (`cast_rise`, `cast_release`; `cast_gather` is cut
from ready and keeps its tweaks) were tuned against the right-facing cast and are keyed by joint label, so after the
swap they would act on the other limb. They are translated, not guessed (scratch measurement; the values go into the
yaml with a `# pass HF` comment):
- (revised after image review 1) every joint's new target is the pre-HF frame's target mirrored with the cast's S and
  n / f swapped, `mirror_joints(T_old, S)`; the new tweak is that minus the untweaked new target. So each cast-cut
  frame keeps its old relation to the cast key, mirrored, and the rendered frame is the pre-HF frame reflected with S
  (checked pixel for pixel: 0 differing px in all six frames). The first rule (only the explicit pins re-measured,
  the other tweaks moved to the swapped label) missed the implicit pins (joints where ready and cast agreed, e.g.
  the ninja's hips) and let review 1 find a boot below the feet line and a broken staff.
Then `puppet.py review` (strips + GIFs) decides.

## 6. Kneel bridge and locks

- The kneel key (`battle_kneel.png`) is untouched. `kneel_in1` / `kneel_in2` / `kneel_b` are built from the ready
  cell and the key (`kneel_source_ai.hero_frames` -> `kneel_bridge.frames`), and `ready` comes from
  `battle_sheet_frames`, so ninja's and master's flipped heads flow into the bridge with no new code. Their kneel
  frames may change; no other class's ready changes, so their kneel frames are byte-identical.
- `python3 -I assets-src/gen/puppet_kneel.py check` must print OK for all 12 (it re-derives the frames; the K-checks
  ring / pieces / palette / ground still apply). Ninja and master are re-locked with `puppet_kneel.py lock ninja
  master` only after the image review (8) passes; the other ten lock files must not change (`git diff`).
- `old_columns` (atlas columns = approved + in-betweens) holds after the rebuild because both read the same function.
- `kneel_tools.py coverage` must still print ai 123 / ai 12.

## 7. Implementation order

1. `puppet.py`: `apply_facing_fix`, `apply_review_fixes`, `facing_masks`, the joint mirror + n/f swap in `load_cfg`,
   the head-mask override in `segment` / `render` / `battle_inbetweens`; `build_assets.py` calls `apply_review_fixes`.
   `puppet.py` is 540 lines today; the new code goes in a new module `gen/puppet_facing.py` (< 250 lines) with thin
   calls from `puppet.py`.
2. `facing_fix` entries in the 12 `battle.json` files.
3. `puppet.py review` for all 12; translate and retune 5.3.
4. `build_assets.py battle_ai`, before any `puppet_kneel.py check` / `lock` and before `gen/selftest.py` (both
   compare the committed atlas with the frames through `old_columns`, so they fail until the atlas is rebuilt). Diff
   the atlas against the pre-pass copy: the changed cells must be exactly the set of 2.0, every other cell
   byte-equal.
4b. `puppet_kneel.py check` (all 12 OK), the image review (8), then `puppet_kneel.py lock ninja master` if their
   bridge frames changed; the other ten lock files unchanged.
5. Tests: `tests/rendering/heroFacing.test.ts` (section 3's test, reading the approved PNGs, the battle.json entries
   and the atlas); a Python selftest of the transform (synthetic cell: rows and centre kept, exact reflection, clamp, a bad box raises,
   palette / alpha / speck checks, joint mirror + swap) wired into `gen/selftest.py`. Touched tests also run:
   `tests/scenes/battle/meleeContact.test.ts` (reads hero attack-frame bounds; master's attack cell changes),
   `tests/rendering/CharacterAtlas.test.ts`, `tests/rendering/kneelAtlas.test.ts`, `tests/data/assetCoverage.test.ts`.
6. Docs: AGENTS.md (the battle_ai / puppet rows), `gen/README.md`, this plan's result section.

## 8. Review and gates

- Image review by a fresh reviewer given only before / after sheets (all 18 cells per class, plus the attack and cast
  GIFs of ninja / master / black_mage / white_mage, master's cast GIF included), at most 3 iterations; output in `~/temp/ff-game/hero_facing/after/`.
- Gates: `python3 -I assets-src/gen/selftest.py` all passed; `puppet.py review` all OK; `puppet_kneel.py check` all
  OK; `kneel_tools.py coverage` ai 123 / ai 12; `build_assets.py battle_ai` under PYTHONHASHSEED 0 and 1 gives
  byte-equal `battle-characters-ai.{png,json}`; the monster atlas files (`assets/sprites/monsters-ai*`) sha256 equal
  before and after; `npm run build`; `npm run test:fast`; the touched tests; a muted browser smoke
  (`?mute=1&scenario=ai_party_base`, plus `&kneel=loop`) with screenshots in `~/temp/ff-game/hero_facing/after/`.
- Not run: `npm run test:full`, `quest --mutate` (the integrator's).

## 9. Risks

- A weapon or shield changes hands in a mirrored pose (e.g. the knight's hurt shield, the casters' staff). Mirroring
  is what the user asked for; any such pose is listed in the report for the user's decision, not altered further.
- Lighting: a mirrored figure is lit from the top right instead of the top left (the style rule). Accepted by the
  ruling; noted.
- Master attack head (1.1) is a judgement beyond the letter of R5; one entry, easy to drop.

## 10. Result

Done on branch `hero-facing` (from fc793e05), 2026-11-25. No AI image call; no approved PNG changed (only the 12
`battle.json` files gained `facing_fix`).

**Changed cells (exactly the table of 2.0; `celldiff`: every other cell of the atlas byte-equal).** 27 entries:

| Class | Whole-figure mirror | Head mirror | Derived (follow automatically) |
|-------|--------------------|-------------|--------------------------------|
| black_mage | cast, hurt, down | - | cast_rise, cast_release |
| white_mage | cast, hurt, down | - | cast_rise, cast_release |
| ninja | cast, hurt, down | ready (sum 84) | idle_b, atk_wind1, atk_wind2, cast_gather, cast_rise, cast_release, kneel_in1, kneel_in2 |
| master | hurt, down | ready (sum 82), attack (sum 91) | idle_b, atk_wind1, atk_wind2, cast_gather, atk_mid, atk_follow, kneel_in1, kneel_in2 |
| knight, red_mage, red_wizard, thief, warrior | hurt, down | - | - |
| monk, black_wizard, white_wizard | hurt | - | - |

kneel_b and the kneel key are byte-equal for every class; ninja's and master's kneel locks were re-locked
(`puppet_kneel.py lock ninja master`: kneel_in1 / kneel_in2 hashes), the other ten lock files are unchanged.

**Changes after image review 1 (ITERATE: D1-D5).**
- The figure mirror's axis moved from the bbox centre to the visual centre (S = 2 x mean x, section 3). The bbox
  axis moved white_mage's cast body about 6 px and its hurt about 12 px (D4, H5). Measured shifts of the mean x now:
  at most 0.8 px for 20 of the 24 figure mirrors; the clamp (staying in columns 1..78) leaves knight down -5.0,
  red_mage down -5.9, thief down -5.7 and white_wizard hurt -4.7 px (bbox axis: -9 to -11), each toward ready.
- The cast-cut tweaks became the exact mirror of the pre-HF frames (5.3 revised). This fixes the white_mage staff
  and sleeve (D1, D2) and the ninja boot below the feet line (D3). All six cast_rise / cast_release frames are the
  pre-HF frames reflected with S, 0 px different.
- The ninja head sum went 82 -> 84, which halves the hood's chin flap past the collar in atk_wind2 / cast_gather
  (D5). Review 2 still sees a 2 px spur in atk_wind2 (before HF: a 1 px bump there). It is minor and left as is.

**Reviews.** Momus: REJECT (4 blocking) -> fixed -> OKAY. Image review (fresh reviewer, before / after sheets and
GIFs only): round 1 ITERATE (D1-D5), round 2 PASS (`~/temp/ff-game/hero_facing/after/review_{1,2}.txt`).

**Gates.** `gen/selftest.py` ALL PASSED. `puppet.py review` 12 / 12 battle OK. `puppet_kneel.py check` 12 / 12 OK.
`kneel_tools.py coverage` monsters ai 123, heroes ai 12. `build_assets.py battle_ai` gives byte-equal
`battle-characters-ai.{png,json}` under PYTHONHASHSEED 0 and 1; its json is unchanged. The monster atlas
(`assets/sprites/monsters-ai*`, 35 files) is sha256-equal. `npm run build` passes, and so does `npm run test:fast`
(431 files, 10,367 tests, 224 s with 2 workers; the touched atlas tests 5 files, 415 tests). The new `tests/rendering/heroFacing.test.ts` has 85 tests. Browser smoke (`?mute=1`, `t5_battle_items`
with `&kneel=loop` and the fallen white mage's down pose; `ai_party_mixed` with the ninja's ready): screenshots in
`~/temp/ff-game/hero_facing/after/`.

**For the user.**
- Master's attack key head was also turned (1.1). It faced right like the ready, and atk_mid / atk_follow are cut
  from it. To keep only the letter of R5, drop that one entry.
- Master's cast key head still faces right (not in scope). Its cast_gather (cut from ready) now faces left, so the
  head turns between cast_gather and cast_rise. Turning it would take one more head entry.
- Ninja victory still faces right (not in scope).
- The mirrored cells are lit from the top right, against the house style's top left. This shows most on master's
  head against his body.
- Weapons and shields change hands in every whole-figure mirror. The reviewers say they read naturally, and the white
  mage's staff now stays in the same hand through the cast.

## 11. Follow-up rulings (coordinator, on the user's behalf, 2026-11-25) and what review found

The open decisions of 10 were ruled: (1) keep master's attack-key head mirror; (2) add a head mirror for master's
cast key so his head faces left through the whole cast; (3) add a head mirror for the ninja's victory key (head and
bandana; the body and the raised arm as drawn). Lighting and weapon hands accepted. Same `facing_fix` mechanism.

Tried (boxes measured on the cells): master cast `box [29, 2, 56, 22]`, `sum 82`; ninja victory `box [8, 4, 52, 29]`,
`exclude [[30, 28, 52, 29]]`, `sum 80`. The fresh image review (round 3, `~/temp/ff-game/hero_facing/after/round3/
review_3.txt`) returned ITERATE:
- **master cast / cast_rise / cast_release now faced RIGHT.** The approved cast head already faces left (features left
  of the skull centre, ear and shaded back of the skull on the right). A second, blind reviewer given only the three
  unlabelled raw heads (`round3/master_heads_raw_ABC.png`) read ready = right (medium-high), **attack = left (high)**
  and cast = left (high). So 1.1's call that master's attack head faced right was wrong; the user's original remark
  ("the attack key itself already faces left") holds for master too, and ruling (1) rested on that error.
- **ninja victory**: the head faced left, but the mirrored bandana tails ran across the raised forearm (drawn in front
  of it), cutting the fist and kunai off visually, plus a 1-2 px gap at the hood / shoulder.

Outcome (committed): the master cast entry is not added, and **the master attack head entry is removed** (attack,
atk_mid and atk_follow are the approved / pre-HF frames again, facing left), so master's head faces left in every
attack and cast frame. The ninja victory entry is not added: a clean result needs the reflected head drawn *behind*
the raised arm (write only onto transparent or old-head pixels), which is a small new `facing_fix` option (code), and
the coordinator asked to stop before any code. 26 `facing_fix` entries in total. Changed cells against the first HF
commit: master attack, atk_mid, atk_follow (back to the pre-HF pixels); nothing else; no lock changed.

Round 4 (fresh reviewer, master's attack and cast sequences): PASS. Every frame faces left, the facing is
consistent, and there are no seams. Gates after section 11: `gen/selftest.py` ALL PASSED; `puppet.py review` 12 / 12;
`puppet_kneel.py check` 12 / 12; `kneel_tools.py coverage` ai 123 / ai 12. battle_ai is byte-equal under
PYTHONHASHSEED 0 / 1. The monster atlas is byte-equal (35 files). `npm run build` passes. `npm run test:fast`:
431 files, 10,367 tests. The touched tests: 5 files, 415 tests.

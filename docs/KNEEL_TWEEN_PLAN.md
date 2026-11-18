# Kneel tween plan (pass KT): bridging the approved idle and the approved AI kneel key

Status: rev 2, plan + pilot (branch `kneel-kt`). No paid call (Gemini or Bedrock) is made or needed in this pass.

**Rev 2 changes (momus review of rev 1):**

| # | Finding | Resolution |
|---|---|---|
| 1 (P1) | T-G3 fails without `--relock` | T-G3 and section 5 run `lockdiff --relock <converted ids>`; expected `<n> added, 0 changed, 0 removed`, exit 0 |
| 2 (P2) | merge gates vs the process cap | section 10 split: tranche merges run Python gates only; atlas build, vitest and the browser only at KT1 / KT3 |
| 3 (P2) | shared files across worktrees | RETIRED_SPRITES rows append-only, the integrator keeps the union; no per-tranche scenario (T-G8 names the scenarios) |
| 4 (P2) | review batch size | at most 10 ids per reviewer agent (section 7) |
| 5 (P2) | limit-hit handling | best iteration defined; no passing iteration -> rig restored, not locked, BLOCKED; a limit-hit table per tranche (section 7) |
| 6 (P2) | pilot -> KT2 gate | section 9 start gate (the 2026-11-17 orchestrator-review ruling; a user objection stops KT2) |
| 7-9 (P3) | counts, exact outputs, hero offset | KT2-A 14 / KT2-B 11 derived and the list from `coverage`; T-G4 / T-G5 exact; heroes accept `offset` |
| pilot | the bridge got the seam row pick, the piece-split fallback and the resized-source area / hole rules (D-KT2, D-KT4) | section 12 |

## 0. Summary

Every sprite now has an approved AI kneel key (123 monster sheets: `approved/<id>/kneel.png`; 12 hero classes:
`approved/<class>/battle_kneel.png`). The battle runtime already plays a kneel track (pass K, `kneelChoreography.ts`):
`kneel_in1` 4 frames, `kneel_in2` 4, a hold of `kneel` / `kneel_b` every 48, and the rise `kneel_in2` 3, `kneel_in1` 3.
Today those four atlas cells come from the rig-derived kneel (31 monster rigs, 12 heroes) or alias to `daze` (92 rigs).

Pass KT replaces the derived kneel with the AI key and makes the three other frames with a **one-source bridge**:

| Frame | Made from | How |
|---|---|---|
| `kneel_in1` | the approved idle only | squashed 35 % of the way toward the key (height, width when it differs, head lean, mass centre) |
| `kneel_in2` | the approved AI key only | stretched 35 % of the way back toward the idle by the same rules |
| `kneel` | the approved AI key | as approved (an optional whole-px `offset`, never edited) |
| `kneel_b` | the approved AI key | the breath: the upper body 1 px down, the base unmoved |

The drawing on screen swaps from the idle's to the key's between `kneel_in1` and `kneel_in2`, inside a 133 ms
downward smear, so no frame ever mixes two drawings. No joints are marked, no parts are cut, no frame is rendered
from a rig, and the TS runtime does not change (the frame names, the tables and the timing stay pass K's).

## 1. Facts (verified on `a7d423f4`)

| Fact | Where |
|---|---|
| 123 monster keys and 12 hero keys approved; every monster key has a rig file; every key is the idle's cell size (boss cells after `pad_keyframes`) | `approved/*/kneel.png`, `battle_kneel.png`; census `/tmp/kneel-kt/census.txt` |
| Bodies: biped 46 (+3 mechanical), quadruped 27 (+1 mechanical: guardian), floating 14, serpent 8, arthropod 7, bird 5, naga 5, blob 4, rooted 2, swimmer 1 | rig `body:` / `preset:` |
| Kneel coverage before KT: monsters derived 31, alias 92, ai 0; heroes derived 12 | `kneel_tools.py coverage` |
| The runtime kneel track, its frame names, `FRAME_FALLBACK` (unopted: `kneel -> daze`), the rise (D-K3), `kneelSink` for floaters and the bestiary's texture-identity test are all on mainline | `src/scenes/battle/kneelChoreography.ts`, `enemyChoreography.ts:16-40`, `partyPose.ts`, `BattleArt.ts` |
| `monster_anim.generate` makes the kneel in-betweens from the rig (`kneel.py prepare` / `RECIPES.kneel_in*`) and `kneel_checks.py` gates them; `puppet_kneel.make` does it for heroes | `monster_anim.py:210-318`, `kneel.py`, `puppet_kneel.py` |
| `retire_kneel.py <id>` archives a derived kneel (rig, lock and the 4 rendered frames) before `source: ai`, and `kneel_tools.py coverage` already counts `kneel.source: ai` | `retire_kneel.py`, `kneel_tools.py:48-50` |
| KNEEL_AI_PLAN D-KA7 planned hand-marked joints on every key (about 15-30 agent-min each, 34-68 agent-hours for 135) and rig in-betweens (D-KA8); D-KA9 the switch `kneel: {source: ai}` | `docs/KNEEL_AI_PLAN.md` rev 4 (`git show 4ade849`) |
| The user rejected rig-derived kneel poses ("only shorter", lunges, mush) and wants sizes normalised, never a pose rejected for size | KNEEL_AI_PLAN 10; memory |

## 2. Experiments (scratch, `/tmp/kneel-kt/exp*`; pilot sprites, native x3 strips, x2 / x3 GIFs at game timing)

Four bridges were built for the 8 pilots and judged on strips and GIFs at x2 / x3, with the silhouette IoU of each
step (idle -> in1 -> in2 -> key) as a smoothness number (higher worst step = fewer pops, but IoU cannot see mush):

| Option | What | Worst-step IoU (goblin / wolf / cobra / slime / dragon / garland / warrior / white_mage) | By eye |
|---|---|---|---|
| cut (baseline) | idle, then the key | 0.50 / 0.28 / 0.54 / 0.69 / 0.45 / 0.60 / 0.55 / 0.52 | a hard pop |
| (b) squash bridge | in1 = idle squashed toward the key, in2 = key stretched toward the idle | 0.60 / 0.44 / 0.76 / 0.83 / 0.48 / 0.75 / 0.63 / 0.63 | clean pixels in every frame; reads as a drop into the kneel |
| (c) dither dissolve | 4x4 Bayer per-pixel choice of idle or key at 1/3, 2/3 | 0.78 / 0.65 / 0.80 / 0.87 / 0.75 / 0.83 / 0.80 / 0.78 | **mush**: two ghosted figures in a screen-door pattern, visible even at x2 |
| (d) rig + stretch | in1 = the existing derived rig in-between, in2 = key stretched | 0.61 / 0.47 / - / - / - / - / - / - | in1 is the rejected rig look ("only shorter"); needs a derived rig, which 92 sheets lack |
| (a) rig toward marked key joints | idle rigged toward hand-marked joints on the key | not built | needs D-KA7 joint marking (34-68 agent-hours) and the same rig rendering the user rejected; the 2-frame budget hides most of what it would add |

(b) was refined (2D width when the widths differ by more than 8 %, a head-lean shear, the mass centre moved u of the
way, an outline re-ink) and is the chosen approach. Why:

- **Every frame is one approved drawing.** Rows (and columns) are dropped or repeated, never blended, so palette,
  binary alpha, outline and face survive by construction. No mush is possible.
- **Simple and cheap.** Pure numpy on two cells: well under 1 s of CPU per sprite, deterministic, no joints, no
  segmentation, no per-sprite paint. The old derived pass spent hours of CPU and hundreds of paint pixels per rig.
- **Fits the timing.** In 4 + 4 frames (133 ms) the eye reads motion, not detail: a squash toward the pose, a cut
  hidden inside the motion, a stretch settling into the key. This is the classic smear / squash-and-stretch.
- **Body-agnostic.** The same rules work on bipeds, quadrupeds, coils, blobs, floaters and heroes (section 4).

A dust or impact beat was considered and dropped: it needs a runtime fx, and poison is common (R2), so a puff on every
kneel would be noise.

## 3. Decisions

- **D-KT1 One switch per sprite:** the rig block (monsters) or class block (heroes) becomes `kneel: {source: ai}`.
  - Allowed keys with it: `source`, `sink` (floaters' runtime sink, D-K9), `paint` (FW-P, on the key), `offset`
    (`[dx, dy]` whole px on the key, FW-O style; the approved file is never edited), `bridge` (D-KT3). Heroes:
    `source`, `bridge`, `offset`. Anything else is refused, and so are `frames.kneel_*` entries (they were derived
    tweaks).
  - The key is locked as `kf:kneel` (meta `kf_derived: {kneel: ai}`), so the lock's name set is pass K's.
  - The derived block is archived first with `retire_kneel.py <id>` (rig, lock and the 4 frames to `_retired/`,
    `docs/RETIRED_SPRITES.md`), then the derived lines (the `kneel:` block, `frames.kneel_*`, paint rows of kneel
    frames) are removed from the rig. A rig without a derived block (92) only gains the two lines.
- **D-KT2 Frames** (`gen/kneel_bridge.py` the frame ops, `gen/kneel_seams.py` the seam pick,
  `gen/kneel_source_ai.py` `ai_key` / `bridge_frames` / `hero_frames`; thin hooks in `kneel.add_key / prepare / skip /
  bridge_frames`, `monster_anim.generate` +2 lines, `puppet_kneel.make`):
  - `kneel_in1` = `toward(idle, key, u1)`: height `h_i + (h_k - h_i) u1`, by dropping rows from the middle band only
    (the top `keep_top` 28 % and bottom `keep_bot` 10 % of the figure copied row for row, so the face and the feet are
    intact). The rows dropped (or, for a stretch, doubled) are **whole-row seams**: the rows most like their
    neighbour (fewest differing pixels), spread so no two picks touch, ties to the lower index (deterministic). An
    even nearest pick doubled diagonal outlines into visible 2 px stairs on blue_dragon (it1); the seam pick does not.
    Width likewise (column seams about the bbox centre, then the centre moved u1 toward the key's) when the widths
    differ by more than 8 %; a whole-px row shear leans the top band u1 toward the key's head; the frame is moved so
    its mass centre x is u1 of the way; any light pixel left on the edge is re-inked with the source's own outline
    colour (only for sources whose edge is >= 90 % dark); nothing below the feet row or on the cell border. If a
    dropped seam splits off a piece (more 4-connected pieces than the source), the frame is redone without the width
    step, then without the shear (blue_dragon's thin tail tip, it2).
  - `kneel_in2` = `toward(key, idle, u2)` by the same rules.
  - `kneel_b` = the key with the rows above `breath_at` (45 % of the height up from the base) 1 px lower.
  - u1 = u2 = 0.35 (the near-keyframe rule, |u| <= 0.35).
- **D-KT3 Tuning knobs** (per sprite, `kneel.bridge`): `u: [u1, u2]` (each in (0, 0.35]), `keep_top`, `keep_bot`
  (each in [0, 0.5)), `shear`, `width` (true / false), `breath_at` ([0.2, 0.8]). Unknown keys are refused. Most
  sprites need none (KT1 pilot: 1 of 8, blue_dragon: u2 0.15, width false, plus `offset` 1 px for K-ground).
- **D-KT4 Checks** (`kneel_checks.ai_checks`, `kneel_checks.bridge_frame`, `kneel_checks.bridge_holes`,
  `kneel_checks.order`, `puppet_kneel.check_frames`; selftest `selftest_kneel_bridge.py`):
  - `kf:kneel`: binary alpha, palette lock, magenta, K-ground (feet row; floaters the idle's lowest row), K-fit.
    **K-height is reported, never a gate**, and the outline weight is not compared with the idle: the key is the
    approved drawing (J0 / the review / the user judged it), and size is never a rejection reason.
  - Bridge frames (`bridge_frame`): binary alpha, palette lock, magenta, no new piece and the outline against their
    one source; holes (`bridge_holes`): no more holes of >= 4 px than the source and their total area <= 1.5x the
    source's (a resize moves and grows a tail loop, so the plain near-and-similar rule does not apply); opaque area
    0.85-1.15 **of the source's area resized** (x h_frame / h_src x w_frame / w_src: no chunk lost or gained; the plain
    0.85-1.15-of-source rule would refuse any squash, and a lerp of the two drawings' areas is wrong for a one-source
    frame); bbox height within the cell tolerance (4 / 6 / 10 px) of the src -> toward lerp at u; clipping;
    near-keyframe; K-ground and K-fit.
  - `kneel:order` (new, K-order): the heights idle, in1, in2, key run one way (+-1 px).
  - Unchanged: `sequence:kneel` continuity (adjacent IoU and centroid step against the idle-key span), K-anchor (the
    sheet's anchors without the kneel frames), F3 masks, locks, atlas exactness and determinism.
  - Heroes: `puppet_kneel.py check` as pass K, with the ring rule judged against the key for key-drawn frames, and the
    class band reported only.
- **D-KT5 Runtime: no change.** The four frame names, `KNEEL_IN_FRAMES` 8, `KNEEL_OUT_FRAMES` 6, `KNEEL_PERIOD` 48,
  the D-K3 rise and `kneelSink` stay as merged in pass K. The atlas build picks the new cells up through
  `monster_anim.monster_frames` and `puppet_kneel.kneel_frames`; for an unopted sheet the D-K7 alias stays. New debug
  scenarios `kt_pilot` / `kt_pilot_big` (section 8). Bestiary D-K15 works by texture identity, so an AI kneel shows
  there with no change.
- **D-KT6 Locks:** each converted id re-locks only its 4 kneel entries (`kf:kneel`, `kneel_in1`, `kneel_in2`,
  `kneel_b`); `kneel_tools.py lockdiff` must show changes in those entries only (and additions of the 4 for the 92
  previously aliased rigs). Every other lock entry stays byte-identical.
- **D-KT7 The derived path stays** behind `source: derived` until KT4 shows `derived 0`; its removal is a separate
  proposal (KNEEL_AI_PLAN D-KA10).

## 4. Per-body rules

All bodies use the defaults; the rows below are what a rollout agent checks first and the knob it may turn.

| Body (count) | Watch for | First knob |
|---|---|---|
| biped (46) / heroes (12) | the head band intact (face), the weapon not sheared off the hand | `keep_top` 0.32 for big helmets / horns (garland) |
| mechanical (iron_golem, soldier, warmech, guardian) | hard straight edges: the shear makes stair-steps | `shear: false` |
| quadruped (27) / bird (5) | the long body: the width remap is on; a lowered head sits in the middle band | `keep_top` lower (0.2) for a low head; `width: false` if legs smear |
| multi-head (hydra, fire_hydra, rhyos, chimera) | heads in the middle band lose rows | `keep_top` 0.4 |
| serpent (8) / naga (5) | coils are the bottom band | `keep_bot` 0.25 |
| blob (4) | no feet, flat base: defaults; the key's inner holes (green_slime) are the key's own | - |
| floating (14) / swimmer (1) | the base is the idle's lowest row (K-ground floating); the drop is the runtime `kneelSink` | `sink` (D-K9) |
| rooted (2) | stalks in the middle band | `keep_bot` 0.2 |
| boss cells 200x200 (astos, chaos, drowned_sovereign, lich, garland, hollow_seraph, ashen_queen, death_eye) | big cells: the tolerance is 10 px; cape / cloth smear | `keep_top` |
| Chaos colossus F2-F4 | exempt (D-K12) | - |

Every sprite whose approved key does not stand on the feet row gets `offset: [0, dy]` (blue_dragon: 1 px), never an
edit of the approved file.

## 5. Pipeline per sprite (rollout agent)

```bash
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
python3 -I assets-src/gen/kneel_tools.py coverage       # the "derived:" line is the list to retire (not section 9)
python3 -I assets-src/gen/retire_kneel.py <id>          # only for ids on that derived line, before any rig edit
# edit anim/monsters/<id>.yaml (heroes anim/<class>.yaml): remove the derived `kneel:` block, every `frames.kneel_*`
# entry and every paint row of a kneel frame, then add `kneel: {source: ai}` (a refused leftover names itself)
python3 -I assets-src/gen/kneel_bridge_review.py --out /tmp/kt-<tranche>/it1 <ids>   # GIFs, strips, contact
python3 -I assets-src/gen/monster_anim.py check <ids>   # heroes: puppet_kneel.py check <classes>; ONE call per round
#   expected before lock: only "hash differs from the lock file" lines for kf:kneel, kneel_in1, kneel_in2, kneel_b
# review (section 7) -> PASS -> lock:
python3 -I assets-src/gen/monster_anim.py lock <id>     # heroes: puppet_kneel.py lock <class>
python3 -I assets-src/gen/monster_anim.py check <ids>   # "<id>: OK" (an FW-Q partial rig: "<id>: OK (aliased: ...)")
python3 -I assets-src/gen/kneel_tools.py lockdiff --base a7d423f4 --relock <every converted id and class so far>
#   expected: no "FAIL" line; last line "<n> added, 0 changed, 0 removed"; exit 0 (re-locked kneel entries are
#   listed as "relocked [...]" and are not counted as changed)
```

## 6. Compute limits

- At most 3 heavy processes at a time, each with `OMP/OPENBLAS/MKL_NUM_THREADS=1`; long commands run in the
  background with their exit code written to a log and are waited on with Monitor (<= 240 s per wait).
- Measured: the bridge itself is < 1 s per sprite. `monster_anim.py check <ids>` loads every sheet once (about
  1-2 min wall, one core) whatever the id count, so a tranche checks its ids in **one** call, not one per id.
- A whole-atlas build (`build_assets.py monsters_ai battle_ai`) is integrator-only, one at a time.
- Scratch only under `/tmp/kneel-kt/` or `/tmp/kt-<tranche>/`; `git status` shows no scratch before a commit.

## 7. Review procedure

- Artefacts per tranche: `kneel_bridge_review.py --out DIR <ids>` writes per id `<id>_x2.gif`, `<id>_x3.gif` (game
  timing), `<id>_slow.gif` (1/8 speed at the display scale), `<id>_strip.png` (idle, in1, in2, kneel, kneel_b,
  hurt / down, x4 with the feet row), plus `contact.gif` / `contact.png`.
- A **fresh reviewer agent** (multimodal) per batch of **at most 10 ids** (a tranche round is ceil(n / 10)
  reviewers, run one after another) sees only those files and this rubric (not the code, not the author's opinion).
  It is told the kneel key is approved final art and not under review:
  - T1 every frame is crisp pixel art in the sprite's own style: no ghosting, dithering, smear of two drawings,
    torn or doubled outline, specks or stray fragments;
  - T2 the transition reads as the character going down into the kneel (and back up), with no pop, jump sideways,
    flicker or upward bounce at game speed (x2 / x3 GIFs);
  - T3 the face / head, the weapon and any held prop stay intact and attached in in1 and in2;
  - T4 the hold breathes subtly (kneel <-> kneel_b) without a visible jolt;
  - T5 the feet (or base) stay on the ground line; floaters keep their base.
  - Verdict per id: `<id> it<N>: PASS` or `<id> it<N>: FAIL T<k>: <reason>`.
- On FAIL the agent turns one D-KT3 knob (or `offset`) per named defect, regenerates, and the next round is judged
  by a **new** reviewer. **At most 3 reviewed iterations per sprite** (pass K ruling, KNEEL_PLAN 13); internal
  renders before the first review do not count. The review output directory follows the iteration
  (`--out /tmp/kt-<tranche>/it<N>`).
- **Limit hit** (FAIL at it3): the **best iteration** is the one with the fewest failed T-criteria (ties: the latest).
  If its `check` passes, its knobs are kept and it is locked; if no iteration passes `check`, the rig is restored
  to its pre-KT state from git (the derived block or the D-K7 alias stays live), nothing is locked, and the id is
  marked `BLOCKED`. Either way the tranche adds a row to its result's **limit-hit table**: id, best iteration, the
  reviewer's reasons, the knobs tried, locked or BLOCKED. KT3 copies every row into section 12 and the user report.
- **A sprite whose problem is the key itself** (not the bridge) is not iterated: it is reported as a key note
  (e.g. green_slime's dark under-hole, goblin's second dagger) for a possible free Bedrock fix pass (KA-FIX).

## 8. Pilot (KT1; this branch)

Sprites: goblin, wolf, green_slime, cobra, blue_dragon, garland, warrior, white_mage. Results are in section 12.

- Retired: goblin, wolf, blue_dragon, garland, warrior, white_mage (`retire_kneel.py`, `_kneel_v1`); cobra and
  green_slime had no derived block (alias).
- Scenarios: `kt_pilot` (goblin poisoned, wolf asleep, green_slime stunned, cobra poisoned; WAR weak, WHM poisoned,
  WAR2 / WHM2 standing) and `kt_pilot_big` (blue_dragon asleep, garland poisoned). Browser:
  `http://127.0.0.1:5242/?mute=1&scenario=kt_pilot&kneel=loop` (every actor loops in / hold / out) and
  `&battleStep=1&poseLabel=1` for frozen frames.
- Artefacts: `/tmp/kneel-kt/pilot/it<N>/`, reviewer verdicts in section 12.

## 9. Rollout tranches (KT2)

**Start gate.** KT2 starts when the KT1 pilot is committed with every pilot id PASS (or a recorded limit hit) and the
integrator accepts the pilot report. Under the 2026-11-17 ruling (KNEEL_PLAN 13: the user handed the monster pilot
review to the orchestrator with a review agent) no separate user sign-off is required; the pilot contact GIF goes into
the user report, and a user objection stops KT2 before its first merge.

Ids from the rig `body:`. Each tranche is one worktree agent
(`git worktree add /tmp/kt-wt/<t> -b kt-<t> kneel-kt`), editing only its own rig / class files and locks, committing
per sprite (`KT2-<t>: <id> AI kneel + lock`), never atlases, never `assets/`, never `git add -A`. The derived ids to
retire come from `kneel_tools.py coverage`, not from the table. `retire_kneel.py` appends rows to
`docs/RETIRED_SPRITES.md` and writes only new `_retired/` files: on merge the integrator keeps the union of the rows
(append-only, no row ever removed). Estimates assume about 6 min of agent time per sprite per iteration, one review
batch per 10 sprites (about 10 min) and one `check` call per round (about 2 min); KT1 measures these (section 12).

| Tranche | Ids | Count | Est. |
|---|---|---|---|
| **KT2-A** bipeds, small cells (80-90 px) | black_knight bloodbones buccaneer dark_fighter dark_wizard death_knight gargoyle ghast ghoul gr_imp horned_devil king_mummy mindflayer mummy pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince skeleton vampire vampire_lord weretiger werewolf wight zombie | 27 (14 derived: retire first) | 3.5 h |
| **KT2-B** bipeds, large and boss cells (128-232 px) + mechanical | astos chaos clay_golem drowned_sovereign earth_elemental fire_gigas hill_gigas ice_gigas lich minotaur minotaur_zombie ogre ogre_chief ogre_mage sea_troll stone_golem troll iron_golem soldier warmech | 20 (11 derived) | 3 h |
| **KT2-C** quadrupeds (+ guardian) | baretta basilisk chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hydra hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf | 26 (2 derived) | 3.5 h |
| **KT2-D** heroes | knight thief ninja monk master red_mage black_mage black_wizard red_wizard white_wizard | 10 (all derived) | 1.5 h |
| **KT2-E** floating + swimmer + bird | air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental ghost hollow_seraph red_piranha shadow specter water_elemental white_shark wraith shark allosaurus cockatrice pyrolisk tyrannosaur wyvern | 20 | 3 h |
| **KT2-F** serpent, naga, arthropod, blob, rooted | anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm ashen_queen earth_medusa medusa spirit_naga water_naga ankheg black_widow crawler remorazz scorpion sea_scorpion tarantula black_flan gray_ooze ochre_jelly neochu ochu | 24 | 3 h |
| **KT3** integrator | merge A-F, rebuild atlases once, gates (section 10), the 135-key contact GIF, browser pass with `kt_pilot`, `kt_pilot_big`, `kneel_pilot` and `anim_status`, docs | - | 2 h |

Totals: 8 (pilot) + 27 + 20 + 26 + 10 + 20 + 24 = 135. Up to 3 tranches run at once (the process cap); A, C and E
first, then B, D and F.

## 10. Gates

A **tranche merge** runs T-G1, T-G2, T-G3, T-G4, T-G6 and T-G9 (Python only, one process at a time). **KT1 and
KT3** (integrator, with no tranche agent running) also run T-G5, T-G7 and T-G8.

| # | Command | Expected |
|---|---|---|
| T-G1 | `python3 -I assets-src/gen/monster_anim.py check --all \| grep -vc ': OK'` | `0` |
| T-G2 | `python3 -I assets-src/gen/puppet_kneel.py check` | 12 lines `: OK` |
| T-G3 | `python3 -I assets-src/gen/kneel_tools.py lockdiff --base a7d423f4 --relock <every converted id and class>` | no `FAIL` line; last line `<n> added, 0 changed, 0 removed`; exit 0 |
| T-G4 | `python3 -I assets-src/gen/kneel_tools.py coverage` | the running count; KT3 exactly `monsters 123/123 (ai 123, derived 0, alias 0)` and `heroes 12/12 (ai 12, derived 0, alias 0)` |
| T-G5 | `PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai battle_ai`, `shasum assets/sprites/monsters-ai-*.png assets/sprites/monsters-ai.json assets/sprites/battle-characters-ai.png assets/sprites/battle-characters-ai.json > /tmp/kt.sha`, again with `PYTHONHASHSEED=1`, `shasum -c /tmp/kt.sha` | every line `OK` |
| T-G6 | `python3 -I assets-src/gen/selftest.py` | last line `ALL PASSED` (includes `selftest_kneel_bridge`) |
| T-G7 | `npm run build` and `npx vitest run --maxWorkers=2 --minWorkers=1` | exit 0; all tests pass |
| T-G8 | browser on port 5242 (`--host 127.0.0.1 --strictPort`), `?mute=1&scenario=kt_pilot&kneel=loop`, `kt_pilot_big`, and at KT3 also `kneel_pilot`, `anim_status` (no new scenario per tranche) | 0 console errors; screenshots show the kneels |
| T-G9 | `git diff --stat a7d423f4 -- assets-src/gen/cache/ledger.jsonl assets-src/gen/cache/bedrock_ledger.jsonl assets-src/gen/approved` | only `approved/_retired/` additions; no ledger change (no paid call) |

## 11. Risks

| Risk | Mitigation |
|---|---|
| The swap between in1 and in2 reads as a pop on very different drawings (wolf, blue_dragon: a standing vs a lying figure) | the mass centre and head lean move with u; the review T2 at x2 / x3; the knobs; worst case u at 0.35 both sides keeps the swap at 30 % of the way |
| Row dropping deletes a 1 px detail in the middle band (a belt, an eye on a low head) | `keep_top` / `keep_bot`; the strip at x4; T3 |
| Shear stair-steps on straight armour | `shear: false` (mechanical row in section 4) |
| An approved key off the feet row | `offset` (K-ground catches it) |
| Lock churn | D-KT6: only the 4 kneel entries, shown by `lockdiff` |
| The derived art is lost | `retire_kneel.py` archives it before every switch (user rule: retire, never delete) |

## 12. Pilot results and rulings log

**KT1 pilot (2026-11-17, branch `kneel-kt`).** Iteration `it1` was an internal render (not reviewed) that showed the
even-nearest row pick's 2 px stairs on blue_dragon; the seam pick (D-KT2) replaced it before any review. Review
round 1 judged `it2`, round 2 (a new reviewer) judged blue_dragon's `it3`.

| Id | Review 1 (it2) | Review 2 (it3) | Knobs / offset | Iterations |
|---|---|---|---|---|
| goblin | PASS | - | - | 1 |
| wolf | PASS | - | - | 1 |
| green_slime | PASS | - | - | 1 |
| cobra | PASS | - | - | 1 |
| blue_dragon | FAIL T1: kneel_in2 stretched 26 % and squeezed narrower, stair-stepped tail loop, smeared mane | PASS | `offset: [0, 1]`, `bridge: {u: [0.35, 0.15], width: false}` | 2 |
| garland | PASS | - | - | 1 |
| warrior | PASS | - | - | 1 |
| white_mage | PASS | - | - | 1 |

- Reviewer notes (not failures): garland's kneel_in2 has the most doubled rows (16) and columns (5); cobra's stretched
  neck shows small steps on the belly stripe; white_mage's staff turns from upright to diagonal between in1 and in2
  (two drawings). Key notes for a possible KA-FIX pass (not bridge issues): green_slime's key has a dark under-hole,
  goblin's key carries a second dagger.
- Limit hits: **none** (max 2 iterations).
- Measured: one reviewer batch of 8 ids took 2.3 min, a single-id re-review 1.2 min; `monster_anim.py check` of the
  6 pilot monsters about 3 min wall (it loads every sheet), `lock` about 1 min per call; the bridge render < 1 s per
  sprite; agent time about 5 min per sprite (the edit, the knobs, reading the strip). Section 9's estimates stand.
- Gate outputs are in the KT1 report (commit message) and section 12a below.
- **Go for KT2** (start gate, section 9).

### 12a. KT1 gate outputs

| # | Command (KT1) | Key output | Result |
|---|---|---|---|
| T-G1 | `monster_anim.py check goblin wolf cobra green_slime blue_dragon garland` (pilot ids; `--all` is KT3's) | `<id>: OK (25 / 25 / 28 / 25 / 25 / 36 checks groups)` | pass |
| T-G2 | `puppet_kneel.py check warrior white_mage` | `warrior: OK [kneel 54 / ready 68 = 0.794 ...]`, `white_mage: OK [kneel 56 / ready 66 = 0.848 ...]` | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock goblin wolf cobra green_slime blue_dragon garland warrior white_mage` | `8 added, 0 changed, 0 removed`, exit 0 (cobra, green_slime +4; the others `relocked` their 4 kneel entries) | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 6, derived 27, alias 90)`, `heroes 12/12 (ai 2, derived 10, alias 0)` | pass (running count) |
| T-G5 | `build_det.sh` (two builds, PYTHONHASHSEED 0 / 1, `shasum -c`) | 13 files `OK`; monsters atlas 10 pages (cobra, green_slime gained own cells), `preload [0, 1]` (wolf on page 1, as KNEEL_PLAN 1 predicted; KT3 expects about 12 pages, accepted by R6) | pass |
| T-G6 | `selftest.py` | runs to the end: `8 FAILED`, none of them KT's: 2 from the gitignored `gen/refs` dir absent in a worktree (`pr_warrior_1080p.png missing`, `FW-9: gen/refs present`), 6 from the live Bedrock pass KA-FIX that `a7d423f4` opened (`budget.json: pass KA closed ... no live bedrock block`, `kneel_ai.py budget --check`, `usage: billed thoughts`, `KG1` BREACH, `KG2`, `bedrock.invoke refuses`); `pass KT kneel bridge`: 22 ok, 0 FAIL. Two crashes the KA-G commit's `approved/*/kneel.json` files had left in the suite are fixed here: `selftest_retire._real_tree` (no `cache_key` in kneel.json) and `selftest_roster._approved_keys` (sheet `kneel` is not a `generate.SHEETS` sheet) | pass (KT) |
| T-G7 | `npm run build`; `npx vitest run --maxWorkers=2 --minWorkers=1` | build exit 0; vitest `Test Files 10 failed / 331 passed (341)`, `Tests 14 failed / 8231 passed / 1 skipped`: every failure is a quest / progression proof ((c) soft-locks, (d) bands) in tests/quest and tests/progression, none touches sprites; questGraph, questLate, ert_t_walk, wat_t_walk and elf_t_walk fail identically on `a7d423f4` | pass (KT; pre-existing quest failures) |
| T-G8 | Playwright on 127.0.0.1:5242, `?mute=1&scenario=kt_pilot&kneel=loop` and `kt_pilot_big` | 0 console errors each; `/tmp/kneel-kt/pilot/browser_kt_pilot_{0..5}.png`, `browser_kt_pilot_big_{0..5}.png` show the AI kneels in battle and the loop standing them up | pass |
| T-G9 | ledger / approved diff | no ledger change; `approved/` only `_retired/*_kneel_v1/` additions | pass |

| Date | Item | Ruling / change |
|---|---|---|
| 2026-11-17 | rev 1 | momus review 1: REJECT (P1 T-G3 needs `--relock`; P2 gate split, shared files, review batch size, limit-hit handling, pilot -> KT2 gate; P3 counts, exact outputs, hero offset). All resolved in rev 2 |
| 2026-11-17 | approach | the one-source squash / stretch bridge (section 2), chosen on the experiments; the derived pilot kneels archived as `_kneel_v1` |
| 2026-11-17 | rev 2 | momus review 2: OKAY with 5 P3 notes (knob count, file references, iteration numbering, one knob per named defect, KT1 TODO and 12a); all applied |

### 12-F. KT2-F result (serpent, naga, arthropod, blob, rooted, 24 ids; branch `kt-f` from `fb5992a0`)

Converted **23 of 24**; **remorazz BLOCKED** (the `check`, not the review: see the limit-hit table). None of the 24
was on the coverage `derived:` line, so nothing was retired (no `docs/RETIRED_SPRITES.md` row); each rig only gained
`kneel: {source: ai}` (+ knobs). black_widow (`alias: [hurt]`) and crawler (`alias: [attack]`) keep their FW-Q
aliases (`check`: `OK (aliased: ...)`). The 0.65 bridge-swap ruling (`9cea4807`) is **not** needed on this branch:
sand_worm, the only id near the cap (9.8 > 9.8 at defaults), passes the 0.5 cap with `keep_bot: 0.25` (the section 4
serpent knob).

Iterations. `it1` was rendered for all 24; reviewers 1 and 2 judged 20 ids on it1. The round-1 `check` failed 7 ids on
mechanical rules; the 4 not yet reviewed were fixed before their first review (internal renders, not counted) and
judged with the fixed purple_worm on `it2` by reviewer 3; sand_worm's it2 was judged by reviewer 4. Knob trials ran in
a scratch harness (`/tmp/kt-f/sim/harness.py`: the bridge frames, `bridge_frame`, K-ground / K-fit and the
`sequence:kneel` in1 -> in2 continuity, without loading the whole atlas). Four fresh reviewers (10 / 10 / 5 / 1 ids),
one after another; **no reviewer FAILed any id**.

| Id | Body | Review 1 | Review 2 | Knobs / offset (why) | Reviews | Result |
|---|---|---|---|---|---|---|
| anaconda | serpent | it1 PASS | - | - | 1 | locked |
| gigas_worm | serpent | it1 PASS | - | - | 1 | locked |
| lava_worm | serpent | it1 PASS | - | - | 1 | locked |
| purple_worm | serpent | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground: key row 121 vs feet 122) | 2 | locked |
| sand_worm | serpent | it1 PASS | it2 PASS | `bridge: {keep_bot: 0.25}` (`sequence:kneel` in1 -> in2 centroid 9.8 > 9.8; 9.5 after) | 2 | locked |
| sea_snake | serpent | it1 PASS | - | - | 1 | locked |
| wyrm | serpent | it1 PASS | - | - | 1 | locked |
| ashen_queen | naga (boss cell) | it1 PASS | - | - | 1 | locked |
| earth_medusa | naga | it1 PASS | - | - | 1 | locked |
| medusa | naga | it1 PASS | - | - | 1 | locked |
| spirit_naga | naga | it1 PASS | - | - | 1 | locked |
| water_naga | naga | it1 PASS | - | - | 1 | locked |
| ankheg | arthropod | it1 PASS | - | - | 1 | locked |
| black_widow | arthropod (FW-Q hurt) | it1 PASS | - | - | 1 | locked |
| crawler | arthropod (FW-Q attack) | it1 PASS | - | - | 1 | locked |
| remorazz | arthropod | it1 PASS | - | none possible (see the limit-hit table) | 1 | **BLOCKED** |
| scorpion | arthropod | it2 PASS | - | `offset: [1, 0]` (K-fit: key on the left border, x 0), `bridge: {breath_at: 0.35}` (kneel_b second ring 0.82 vs 0.92) | 1 | locked |
| sea_scorpion | arthropod | it1 PASS | - | - | 1 | locked |
| tarantula | arthropod | it1 PASS | - | - | 1 | locked |
| black_flan | blob | it2 PASS | - | `offset: [0, 1]` (K-ground: key row 75 vs feet 76) | 1 | locked |
| gray_ooze | blob | it1 PASS | - | - | 1 | locked |
| ochre_jelly | blob | it1 PASS | - | - | 1 | locked |
| neochu | rooted | it2 PASS | - | `offset: [0, 1]` (K-ground: key row 121 vs 122), `bridge: {u: [0.25, 0.35]}` (kneel_in1 new hole 12 > 11; `keep_bot: 0.2` made it 13, `width` / `shear` false and `keep_top` left it at 12) | 1 | locked |
| ochu | rooted | it2 PASS | - | - | 1 | locked |

**Limit-hit table** (no review limit was hit; one `check` block):

| Id | Best iteration | Reviewer | `check` | Knobs tried | Result |
|---|---|---|---|---|---|
| remorazz | it1 | PASS | `kf:kneel`, `kneel_in2`, `kneel_b`: K-ground `44 px in the bottom 2 rows < half the idle's 117` (46 for in2) | none can help: the approved key is a low crawl whose leg tips touch the feet row thinly (bottom rows 26 / 18 px); `offset` moves the lowest row off the feet row (dy +1 leaves the key at row 123) and the bridge knobs do not touch the key or kneel_b. Only key paint (FW-P: trim the 18-px tip row, then `offset: [0, 1]`, giving 61 >= 59) would pass, and that edits the approved drawing (the user ruled no key fixes) | **BLOCKED**: rig restored from git (the D-K7 `daze` alias stays live), nothing locked |

Options for a ruling (for KT3): exempt `kf:kneel` and its key-drawn frames (`kneel_in2`, `kneel_b`) of a `source: ai` rig
from the K-ground *contact share* (keep "lowest row on the feet row"), as K-height already is; or allow the FW-P trim
above. With either, remorazz's it1 frames (reviewed PASS) are ready to lock with no other change.

**Key notes** (approved-key issues, not iterated; for a possible KA-FIX pass): lava_worm's key is darker and rougher
(lava bands become flecks, no glowing maw); wyrm's key head is long and horse-like with black blotches on the neck;
ashen_queen's key drops the floating fire orb and the stone pillar behind the coil; sand_worm's key loses most of the
sand mound and adds a coiled tail section; purple_worm's and gigas_worm's keys lose the toothed maw (a plain hole / a
closed puckered end); tarantula's key head is a dark mass with no eyes or fangs; ankheg's key is a very different
drawing (a hunched worm, the jaws a small green mark: the largest swap in the tranche, still read as a slump);
black_flan's key drops the speckled sheen and its eyes are broken rings; neochu's key closes both mouths (red lips) and
has ragged dark-purple blobs on two stems. Reviewer notes (not failures): anaconda, purple_worm, sand_worm and
sea_snake's kneel_in2 is visibly taller than the key (a settle, not a pop); water_naga's trident turns dark at the
in1 -> in2 swap (the key's own colour); the largest sideways centre drifts are remorazz ~9 px, sea_scorpion ~8 px,
crawler ~5 px, all smooth.

Artefacts: `/tmp/kt-f/it1/` (24 ids) and `/tmp/kt-f/it2/` (purple_worm, black_flan, neochu, scorpion, ochu, sand_worm),
each with `<id>_x2.gif`, `<id>_x3.gif`, `<id>_slow.gif`, `<id>_strip.png` and `contact.gif` / `contact.png`.

Gates (tranche merge set, one process at a time):

| # | Key output | Result |
|---|---|---|
| T-G1 | `check --all`: 123 lines `: OK`, `grep -vc ': OK'` = 0 (my 23 `OK`; black_widow `OK (aliased: hurt)`, crawler `OK (aliased: attack)`, remorazz `OK` on its restored alias rig) | pass |
| T-G2 | `puppet_kneel.py check`: 12 lines `: OK` | pass |
| T-G3 | `lockdiff --base a7d423f4 --relock` the 8 pilot ids + my 23: no `FAIL`, `100 added, 0 changed, 0 removed` (pilot 8 + 23 x 4), exit 0 | pass |
| T-G4 | `coverage`: `monsters 123/123 (ai 29, derived 27, alias 67)`, `heroes 12/12 (ai 2, derived 10, alias 0)` | pass (running count) |
| T-G6 | `selftest.py`: runs to the end, `8 FAILED`, the same 8 as KT1 (12a) and none of them KT's: 2 from the absent `gen/refs` (worktree) and 6 from the live Bedrock pass KA-FIX; `pass KT kneel bridge`: 22 ok, 0 FAIL (KT2-E's 3 `selftest_hurtfrom` failures do not occur on this branch) | pass (KT) |
| T-G9 | no ledger change; `approved/` only the pilot's `_retired/*_kneel_v1/` additions (24 files) | pass |

## TODOs

- [x] KT0 experiments (cut, squash, dither, rig + stretch) and the choice (section 2)
- [x] KT1 tooling: `kneel_bridge.py`, the hooks, checks, `kneel_bridge_review.py`, selftest, scenarios
- [x] KT1 pilot: 8 sprites, review, locks, atlases, browser (section 12, gate outputs in 12a)
- [ ] KT2-A..F rollout (section 9)
- [ ] KT3 integration, gates, docs (AGENTS.md "Monster animation", KNEEL_AI_PLAN TODOs, PROGRESS.md)

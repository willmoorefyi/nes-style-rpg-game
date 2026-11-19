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
| 2026-11-18 | bridge swap continuity (integrator, KT2-A) | the `sequence:kneel` centroid cap of the bridge pair step kneel_in1 -> kneel_in2 (a `source: ai` rig) is 0.65 x the idle-key span; every other step and the derived path keep 0.5 (`kneel_checks.BRIDGE_SWAP_SHARE` / `continuity_share`, `anim_checks.continuity(share=)`, selftest rows). Reason: the step is the deliberate swap between two drawings inside the 133 ms drop, the reviewers passed all four blocked sprites, the user approved the pilot look. Key notes need no key fixes (user ruling) |
| 2026-11-18 | K-ground contact share (integrator, KT3; remorazz) | the approved AI key (`kf:kneel`) and the frames drawn from it (`kneel_in2`, `kneel_b`) are exempt from the K-ground *contact share* (half the idle's pixels in the bottom 2 rows), as K-height already is; their lowest opaque row must still be the feet row, and `kneel_in1` (drawn from the idle) keeps the full rule (`kneel_checks.ground(contact=)`, `KEY_DRAWN`, a selftest row in `selftest_kneel_bridge`). Reason: the key is approved as drawn; remorazz's crawl touches the ground with thin leg tips |
| 2026-11-18 | KT2-C / KT2-F blocked ids (integrator, KT3) | chimera (it1 defaults: swap step 11.2 under the 0.65 cap 12.9), dragon_zombie (its best iteration `bridge: {keep_top: 0.49, keep_bot: 0.0, width: false}`: 12.4 under 13.4, no in1 hole) and remorazz (it1 defaults, under the contact-share ruling) re-applied, checked and locked; none BLOCKED |
| 2026-11-18 | key notes (integrator, KT3) | every key note of KT1 and KT2-A..F stays a note (user ruling: no key fixes needed) |
| 2026-11-18 | selftest fixtures (integrator, KT3) | `selftest_hurtfrom._cfg` drops death_eye's `kneel` block (KT2-E); `selftest_keyoffset` drops chimera's; `selftest_kneel_ai_io._unread` strips the kneel block from a rig (no rig is unopted any more); the KA-G usage-gate test starts from a fresh pass (`usage_recounted: false`; the real pass has recorded `true`) |
| 2026-11-18 | Bedrock pass KA-FIX (integrator, KT3) | closed into `bedrock_history` at 2 of 60 (the 2 ledger rows of 2026-11-17): with no key fixes it is unused. `kneel_ai_budget.CLOSED` and the KG1 / KG2 selftests read it as a closed pass; no live `bedrock` block remains, so `bedrock.invoke` refuses every call again |

### 12b. KT2-A result (bipeds, small cells; branch `kt-a` from `fb5992a0`)

27 ids: **27 locked** on `source: ai`. Round 1 locked 23 and BLOCKED 4 on the bridge-swap continuity cap; the
integrator ruling of 2026-11-18 (cap 0.65 x span for that step, rulings log above) unblocked them, and their it1 frames
(reviewed PASS, byte-identical re-render) were locked. Retired first, exactly the
14 KT2-A ids on the `derived:` line: mummy pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince skeleton
vampire vampire_lord weretiger werewolf wight zombie (`_kneel_v1`, 14 rows appended to `docs/RETIRED_SPRITES.md`).
Review: three new reviewers for it1 (10 / 10 / 7 ids), one new reviewer for it2 (4 ids). Artefacts:
`/tmp/kt-a/it1/` (27 ids, `contact.gif`), `/tmp/kt-a/it2/` (4 ids), `/tmp/kt-a/final/` (the 23 round-1 locks,
`contact.gif` / `contact.png`), `/tmp/kt-a/it1b/` (the 4 unblocked, re-rendered; strips byte-identical to it1).

| Id | Review 1 (it1) | Review 2 (it2) | Knobs / offset | Iterations | Result |
|---|---|---|---|---|---|
| black_knight | PASS | - | - (0.65 swap cap, ruling) | 1 | locked (was BLOCKED) |
| bloodbones | PASS | - | - (0.65 swap cap, ruling) | 1 | locked (was BLOCKED) |
| buccaneer | PASS | - | - | 1 | locked |
| dark_fighter | PASS | - | - | 1 | locked |
| dark_wizard | PASS | PASS | `offset: [-1, 0]` (K-fit: the key touched the right border, x 79) | 2 | locked |
| death_knight | PASS | - | - (0.65 swap cap, ruling) | 1 | locked (was BLOCKED) |
| gargoyle | PASS | - | - | 1 | locked |
| ghast | PASS | - | - | 1 | locked |
| ghoul | PASS | - | - | 1 | locked |
| gr_imp | PASS | - | - | 1 | locked |
| horned_devil | PASS | - | - (0.65 swap cap, ruling) | 1 | locked (was BLOCKED) |
| king_mummy | PASS | PASS | `bridge: {width: false}` (check: a new hole in kneel_in1) | 2 | locked |
| mindflayer | PASS | - | - | 1 | locked |
| mummy | PASS | - | - | 1 | locked |
| pirate | PASS | - | - | 1 | locked |
| piscodemon | PASS | - | - | 1 | locked |
| rakshasa | PASS | - | - | 1 | locked |
| sahagin | PASS | - | - | 1 | locked |
| sahagin_chief | PASS | PASS | `offset: [-1, 0]` (K-fit: the key touched the right border, x 81) | 2 | locked |
| sahagin_prince | PASS | - | - | 1 | locked |
| skeleton | PASS | - | - | 1 | locked |
| vampire | PASS | - | - | 1 | locked |
| vampire_lord | PASS | - | - | 1 | locked |
| weretiger | PASS | - | - | 1 | locked |
| werewolf | PASS | - | - | 1 | locked |
| wight | PASS | - | - | 1 | locked |
| zombie | FAIL T1: kneel_in2's rear foot squeezed to a 1-2 px hooked sliver, outline broken | PASS | `bridge: {width: false}` (also check: kneel_in2 area 1.19, second ring 0.82) | 2 | locked |

**Limit-hit / BLOCKED table.** No sprite reached it3. Four sprites PASS the review but no allowed knob passes
`check`: `sequence:kneel` continuity, `kneel_in1->kneel_in2: centroid moves > cap` (cap = max(6 x cell_h / 80,
0.5 x the idle-key centroid span), `anim_checks.continuity`). Per section 7 they are restored from git (they had no
derived block: the D-K7 `daze` alias stays live), nothing is locked, and they are BLOCKED. **Resolved** by the
2026-11-18 integrator ruling (the swap step's cap 0.65 x span; caps below at 0.5 / 0.65): all four locked at it1 defaults.

| Id | Best iteration | Reviewer | `check` at default | Knobs tried (`/tmp/kt-a/probe.py`, `grid.py`) | Best reached | Result |
|---|---|---|---|---|---|---|
| black_knight | it1 | PASS | centroid 9.7 > 8.2 (0.65 cap 10.7) | keep_top {0, 0.15, 0.28, 0.4, 0.45, 0.49} x keep_bot {0, 0.1, 0.25, 0.4, 0.49}, each with width / shear on and off | 9.5 > 8.2 | BLOCKED -> locked (ruling) |
| bloodbones | it1 | PASS | 6.7 > 6.3 (0.65 cap 8.2) | the same grid | 6.6 > 6.3 | BLOCKED -> locked (ruling) |
| death_knight | it1 | PASS | 8.7 > 7.0 (0.65 cap 9.1) | the same grid | 8.2 > 7.0 | BLOCKED -> locked (ruling) |
| horned_devil | it1 | PASS | 8.2 > 7.4 (0.65 cap 9.6) | the same grid | 7.6 > 7.4 | BLOCKED -> locked (ruling) |

Why no knob can fix it (for KT3 / a ruling): the gap is vertical. These keys put their mass much lower than the idle
(centroid y: black_knight idle 36.7 -> key 52.7, in1 39.7, in2 49.4), while `u` caps at 0.35 and row seams move the
centroid by only part of the height change, so the in1 -> in2 step is about 0.6 of the span against a 0.5 cap. `u` > 0.35
is outside D-KT3, and an `offset` that widens the span would be a sideways jump (T2). Options for a ruling: judge a
`bridge` pair (the designed drawing swap) with a looser continuity cap (e.g. 0.65 of the span), or allow `u` up to
0.45 for these ids. With either, the it1 frames (reviewed PASS) are ready to lock.

**Key notes** (approved-key issues, not iterated; the user ruled no key fixes are needed, so these stay notes):
black_knight's key loses the red visor
and its horns point another way; bloodbones's key is much darker and its skull is in side profile; dark_fighter's
shield is almost black with no rim detail; gr_imp's spear has no tip and the face is mostly hidden (kneel_in2 inherits
both); buccaneer's axe head reads as a grey patch by the knee; horned_devil's trident head is a black blob; king_mummy's
crook is a broken ring like a flail, and the pose is a deep crouch with the back knee up; mummy's and zombie's keys read
as a stride or lunge (no knee down); pirate's tricorn reads as a cap; sahagin_prince's blades are mostly hidden;
werewolf's key is a running crouch with the rear foot above the ground line (kneel_in2 / kneel_b inherit it; K-ground
passes); vampire's face is a hollow skull mask; weretiger's key loses the loincloth; vampire_lord's key is a stooped
hunch; sahagin_chief's shield is edge-on.

Reviewer notes (not failures): gr_imp kneel_in2 has a 1-2 px kink in the stretched spear shaft; death_knight kneel_in1
widens the blade slightly; dark_wizard's staff leans about 8 px in kneel_in1; held props swap from upright (in1) to
lowered (in2) on horned_devil, sahagin, sahagin_chief, pirate, king_mummy, sahagin_prince (by design).

Measured: a review batch of 10 took 1.2-1.5 min, of 4 about 0.9 min; `monster_anim.py check` of the 27 about 2 min,
`lock` of 19 about 2 min; a single-id probe (`monster_check.check_sprite` without the lock) 0.6-1.4 s.

**KT2-A gate outputs** (tranche merge set; T-G5 / T-G7 / T-G8 are KT3's):

| # | Command | Key output | Result |
|---|---|---|---|
| per-id | `monster_anim.py check <27 ids>` (one call, after the ruling) | 27 lines `<id>: OK (25-28 checks groups)` | pass |
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `0` (123 `: OK` lines) | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock` the 8 pilot ids + all 27 KT2-A ids | no `FAIL`; `60 added, 0 changed, 0 removed`; exit 0 (pilot cobra / green_slime 8 + the 13 KT2-A ex-alias ids 52; the 14 ex-derived `relocked` their 4 kneel entries). With only the KT2-A ids it exits 1 on the 6 pilot ids' kneel entries (the base predates KT1): the pilot ids must stay in `--relock` | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 33, derived 13, alias 77)`, `heroes 12/12 (ai 2, derived 10, alias 0)`; all 27 KT2-A ids on `ai:` | pass (running count) |
| T-G6 | `selftest.py` (after the ruling) | runs to the end: `8 FAILED`, the same 8 as KT1 (12a), none of them KT's: `gen/refs` absent in a worktree (2) and the live Bedrock pass KA-FIX (6); `pass KT kneel bridge`: 24 ok (22 + the 2 swap-cap rows), 0 FAIL | pass (KT) |
| T-G9 | `git diff --stat a7d423f4 -- <ledgers> assets-src/gen/approved` | 80 files, all `approved/_retired/*_kneel_v1/` (pilot 24 + KT2-A 56); no ledger change | pass |

### 12c. KT2-B result (bipeds, large and boss cells + mechanical; branch `kt-b` from `fb5992a0`)

20 ids: **20 locked** on `source: ai`, none BLOCKED, none pending. Retired first, exactly the 11 KT2-B ids on the
`derived:` line: iron_golem minotaur minotaur_zombie ogre ogre_chief ogre_mage sea_troll soldier stone_golem troll
warmech (`_kneel_v1`, 11 rows appended to `docs/RETIRED_SPRITES.md`, one per sprite commit). The other 9 (astos chaos
clay_golem drowned_sovereign earth_elemental fire_gigas hill_gigas ice_gigas lich) were on the D-K7 alias and only gained
`kneel: {source: ai}`. The integrator ruling commit (KT2-A `9cea4807`: the `kneel_in1 -> kneel_in2` bridge-swap
centroid cap 0.65 x span) is cherry-picked first on this branch; fire_gigas needed it (`centroid moves 13.6 > 12.6` at
0.5; passes at 0.65). warmech uses its approved try-2 key (`approved/warmech/kneel.json` `try: 2`); astos keeps its FW-Q
alias (`OK (aliased: attack)`); chaos's atlas sheet got the kneel (the colossus forms are exempt, D-K12).

Pre-review renders (not counted, section 7), from the first `check`: ogre and troll `offset: [0, 1]` (K-ground: the key
stands on row 121, feet row 122); ice_gigas `bridge: {breath_at: 0.5}` (kneel_b opened a new 4 px hole); iron_golem
`bridge: {shear: false, width: false}` (the mechanical row of section 4; kneel_in1's second ring 0.59 vs 0.70: `shear:
false` alone did not fix it, the width seams also thinned the plates). Review: two new reviewers for it1 (10 / 10 ids),
all PASS. Artefacts: `/tmp/kt-b/it1/` (20 ids, reviewed), `/tmp/kt-b/final/` (the 20 locked, `contact.gif` /
`contact.png`), per id `<id>_x2.gif`, `_x3.gif`, `_slow.gif`, `_strip.png`.

| Id | Review 1 (it1) | Knobs / offset | Iterations | Result |
|---|---|---|---|---|
| astos | PASS | - | 1 | locked (`OK (aliased: attack)`) |
| chaos | PASS | - | 1 | locked |
| clay_golem | PASS | - | 1 | locked |
| drowned_sovereign | PASS | - | 1 | locked |
| earth_elemental | PASS | - | 1 | locked |
| fire_gigas | PASS | - (needs the 0.65 swap cap ruling) | 1 | locked |
| hill_gigas | PASS | - | 1 | locked |
| ice_gigas | PASS | `bridge: {breath_at: 0.5}` | 1 | locked |
| lich | PASS | - | 1 | locked |
| minotaur | PASS | - | 1 | locked |
| minotaur_zombie | PASS | - | 1 | locked |
| ogre | PASS | `offset: [0, 1]` | 1 | locked |
| ogre_chief | PASS | - | 1 | locked |
| ogre_mage | PASS | - | 1 | locked |
| sea_troll | PASS | - | 1 | locked |
| stone_golem | PASS | - | 1 | locked |
| troll | PASS | `offset: [0, 1]` | 1 | locked |
| iron_golem | PASS | `bridge: {shear: false, width: false}` | 1 | locked |
| soldier | PASS | - | 1 | locked |
| warmech | PASS | - | 1 | locked |

**Limit-hit table:** none (every id passed at it1; no id reached it2).

**Key notes** (approved-key issues, not iterated, for a possible KA-FIX pass): lich's key has a solid black diagonal bar
below the glaive blade toward the lower right (kneel_in2 inherits it); clay_golem's forehead rune turns from "R" into a
"?"-like mark; earth_elemental's key is a different build (slim, segmented, one arm a raised stone slab), so the
in1 -> in2 swap reads close to a morph; iron_golem's key is shaded near-black against the light-grey idle (a visible
colour jump at the swap); warmech's key loses the grille glow, hunches, and points the cannon at the ground; troll's
one club becomes two props (a long stick and an upright mallet); minotaur_zombie's open ribcage is a dark barred slot
and the cleaver is redrawn larger; ogre_chief's horns are much smaller and the face darker.

Reviewer notes (not failures): the largest drawing swaps at in1 -> in2 are chaos (outstretched to hunched arms, about
22 % less area), earth_elemental, minotaur_zombie and warmech; props swap from raised to lowered by design on
drowned_sovereign (sceptre) and fire_gigas (hammer); every id's top steps down evenly with no upward bounce, and kneel_b
is a 1 px breath.

Measured: a review batch of 10 took 1.6-2.1 min; `monster_anim.py check` of the 20 about 2-3 min; `lock` about 1 min per
id (20 in about 20 min, one process); the bridge render < 1 s per sprite.

**KT2-B gate outputs** (tranche merge set; T-G5 / T-G7 / T-G8 are KT3's):

| # | Command | Key output | Result |
|---|---|---|---|
| per-id | `monster_anim.py check <20 ids>` (one call) | 20 lines `<id>: OK (25-36 checks groups)`, astos `OK (aliased: attack; 25 checks groups)` | pass |
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `0` (123 `: OK` lines) | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock` the 8 pilot ids + the 20 KT2-B ids | no `FAIL`; `44 added, 0 changed, 0 removed`; exit 0 (pilot cobra / green_slime 8 + the 9 KT2-B ex-alias ids 36; the 11 ex-derived and 6 pilot ids `relocked` their 4 kneel entries) | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 26, derived 16, alias 81)`, `heroes 12/12 (ai 2, derived 10, alias 0)`; no KT2-B id left on `derived:` or the alias | pass (running count, this branch only) |
| T-G6 | `selftest.py` | runs to the end: `8 FAILED`, the same 8 as KT1 (12a), none of them KT's: `gen/refs` absent in a worktree (2) and the live Bedrock pass KA-FIX (6); `pass KT kneel bridge`: 24 ok (22 + the 2 swap-cap ruling rows), 0 FAIL | pass (KT) |
| T-G9 | `git diff --stat a7d423f4 -- <ledgers> assets-src/gen/approved` | 68 files, all `approved/_retired/*_kneel_v1/` (pilot 24 + KT2-B 44); no ledger change | pass |

### 12-KT2-C. Tranche C result (quadrupeds + guardian, branch `kt-c` from `fb5992a0`)

Converted 24 of 26; **chimera and dragon_zombie BLOCKED** (the check, not the review: see the limit-hit table).
Retired first (the coverage `derived:` line): green_dragon, hydra (`_kneel_v1`, two rows appended to
`docs/RETIRED_SPRITES.md`). dragon and fire_lizard use their try-2 keys (the approved `kneel.png`).

Iterations. `it1` was rendered for all 26 and reviewed for 20 ids (reviewers 1 and 2, before the round-1 `check` had
come back); it is counted as review 1 for those 20. The round-1 `check` then failed 15 ids on mechanical rules
(K-ground, K-fit, a new hole, an outline ring, the `sequence:kneel` in1 -> in2 centroid step / IoU), fixed with one
offset or knob set per failure and re-rendered as `it2`; the 10 changed ids already reviewed got review 2 (reviewer 3),
and the 6 ids not yet reviewed got their first review on `it2` (reviewer 4). Four fresh reviewers, at most 10 ids
each, one after another; no reviewer FAILed any id.

| Id | Review 1 | Review 2 | Knobs / offset (why) | Reviews |
|---|---|---|---|---|
| baretta | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground) | 2 |
| basilisk | it1 PASS | - | - | 1 |
| crazy_horse | it1 PASS | - | - | 1 |
| crocodile | it1 PASS | - | - | 1 |
| desert_baretta | it1 PASS | it2 PASS | `bridge: {keep_top: 0.49, keep_bot: 0.0}` (centroid 10.1 > 9.6) | 2 |
| dragon | it1 PASS | - | - | 1 |
| fire_hydra | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground) | 2 |
| fire_lizard | it1 PASS | - | - | 1 |
| gr_wolf | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground) | 2 |
| green_dragon | it1 PASS | it2 PASS | `bridge: {shear: false}` (kneel_in1 second ring 0.58 vs 0.67) | 2 |
| guardian | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground) | 2 |
| hellhound | it1 PASS | it2 PASS | `offset: [1, 0]` (K-fit: key on the left border) | 2 |
| hydra | it1 PASS | it2 PASS | `offset: [1, 1]` (K-ground; in1 -> in2 IoU 0.43 < 0.44) | 2 |
| hyenadon | it1 PASS | - | - | 1 |
| lesser_tiger | it1 PASS | it2 PASS | `bridge: {shear: false}` (new 4 px hole in kneel_in1) | 2 |
| lizard | it1 PASS | - | - | 1 |
| manticore | it1 PASS | - | - | 1 |
| nightmare | it1 PASS | it2 PASS | `offset: [0, 1]` (K-ground) | 2 |
| rhyos | it2 PASS | - | `offset: [0, 1]` (K-ground) | 1 |
| sabertooth | it2 PASS | - | `offset: [0, 1]`, `bridge: {width: false}` (centroid 11.0 > 10.9 after the offset) | 1 |
| sphinx | it2 PASS | - | `bridge: {keep_top: 0.45, keep_bot: 0.0, width: false}` (centroid 10.0 > 9.6) | 1 |
| white_crocodile | it2 PASS | - | `bridge: {keep_top: 0.49, keep_bot: 0.0}` (centroid 10.1 > 9.6) | 1 |
| white_dragon | it2 PASS | - | - | 1 |
| winter_wolf | it2 PASS | - | - | 1 |
| chimera | it1 PASS | - | none passes `check` (below) | 1, BLOCKED |
| dragon_zombie | it1 PASS | - | none passes `check` (below) | 1, BLOCKED |

**Limit-hit table** (BLOCKED: no iteration passes `check`; rig restored from `fb5992a0`, the D-K7 alias stays live,
nothing locked; restored `check`: `chimera: OK (aliased: hurt; 18 checks groups)`, `dragon_zombie: OK (18 checks groups)`):

| Id | Best iteration | Reason | Knobs tried (scratch harness on the real `check_sprite`) | Result |
|---|---|---|---|---|
| chimera | it1 (review PASS) | `sequence:kneel` kneel_in1 -> kneel_in2 centroid moves 11.2 > 9.9: the key's mass sits much lower than the idle's (span dy 19.7 px), and with u at its 0.35 cap the in1 / in2 centroids only travel about 25 % / 10 % of it | `keep_top` 0 / 0.49, `keep_bot` 0, `width` / `shear` false and combinations, `offset` dx -2 / +2 / +4 (best 10.5) | BLOCKED |
| dragon_zombie | it1 (review PASS) | the same, 14.2 > 10.3 (span dy 19.8), plus a new hole in kneel_in1 at defaults | the same set (best 12.4, `keep_top: 0.49, keep_bot: 0, width: false`) | BLOCKED |

Both need either a looser continuity cap for one-source bridge frames (the swap step) or u above 0.35 for in2: a tool
or rule change, outside a tranche's rig-only scope; proposed for KT3.

**Key notes** (the approved key, not the bridge; for a possible KA-FIX pass): baretta and fire_hydra keys stood 1 px
above the feet row (fixed by `offset`); dragon_zombie's key is much darker than the idle (near-black against pale
bone), so the in1 -> in2 swap flashes; gr_wolf's key loses the grey fur and the red eye (a near-black blob); guardian's
key has no red eyes (they switch off at the swap); manticore's key draws the tail with orange rings (idle: black
segments); desert_baretta, fire_lizard, white_crocodile keys are much smaller than the idle (the kneel reads partly as
shrinking); white_dragon's raised wings make the silhouette top rise slightly during the kneel.

**Reviewer notes** (not failures): green_dragon kneel_in2 1 px row-doubling roughness at the eye and jaw; desert_baretta
in2 (about 1.25x) doubles a few shell pixels; lizard in2 crest slightly heavier; hyenadon in2 head a little tight;
hydra / chimera heads re-arrange at the swap (by design).

Gate outputs (tranche merge set, one process at a time):

| # | Command | Key output | Result |
|---|---|---|---|
| per-id | `monster_anim.py check <26 ids>` after the locks | 26 lines `<id>: OK` (24 converted 25 / 26 groups; chimera `OK (aliased: hurt)`, dragon_zombie `OK`), exit 0 | pass |
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `1`: the only other line is the log's own `exit 0` (123 sheets `: OK`) | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` (heroes untouched) | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock <the 8 KT1 ids> <the 24 KT2-C ids>` | no `FAIL`; `96 added, 0 changed, 0 removed`; exit 0 (22 aliased ids + cobra / green_slime +4 each; green_dragon, hydra and the pilot `relocked` their 4 kneel entries). With only the 24 KT2-C ids after `--relock`, the 6 KT1-relocked pilot ids show `FAIL` (their KT1 relocks are not named), as expected | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 30, derived 25, alias 68)`, `heroes 12/12 (ai 2, derived 10, alias 0)` | pass (running count) |
| T-G6 | `selftest.py` | runs to the end: `8 FAILED`, exactly KT1's 8 (12a: 2 from the gitignored `gen/refs` absent in a worktree, 6 from the live Bedrock pass KA-FIX budget state), none KT's; `pass KT kneel bridge`: 22 ok, 0 FAIL | pass (KT; the pre-existing 8) |
| T-G9 | `git diff --stat a7d423f4 -- ...ledger.jsonl ...bedrock_ledger.jsonl ...approved` | 32 files, all `approved/_retired/*_kneel_v1/` (the 6 KT1 + green_dragon, hydra); no ledger change | pass |

Review artefacts: `/tmp/kt-c/it1/` and `/tmp/kt-c/it2/` (`<id>_x2.gif`, `_x3.gif`, `_slow.gif`, `_strip.png`), the
final contact sheet `/tmp/kt-c/final/contact.gif` / `contact.png` (24 converted ids, in sync). Measured: a reviewer
batch of 6-10 ids 2.0-2.6 min; `check` of the 26 ids about 3 min; `lock` about 1 min per id; agent time well under
the 3.5 h estimate (most ids needed no knob; the check-driven knobs were found with a scratch harness in
`/tmp/kt-c/sim/` that runs the real `check_sprite` on in-memory rig variants).
### 12-D. KT2-D result (heroes; branch `kt-d` from `fb5992a0`, 2026-11-18)

All 10 classes were on the coverage `derived:` line and were retired first (`retire_kneel.py`, `<class>_kneel_v1`, 10
rows appended to `docs/RETIRED_SPRITES.md`); each class file lost its pass-K block (comments, `kneel:` with its
labels / paint) and gained `kneel: {source: ai}`. No knob and no `offset` was needed. One review round (a fresh
reviewer, one batch of 10, artefacts `/tmp/kt-d/it1/`), one commit per class (`KT2-D: <class> AI kneel + lock`).

| Class | Review 1 (it1) | Knobs / offset | Iterations | Heights idle / in1 / in2 / kneel |
|---|---|---|---|---|
| knight | PASS | - | 1 | 72 / 67 / 64 / 59 |
| thief | PASS | - | 1 | 72 / 68 / 66 / 62 |
| ninja | PASS | - | 1 | 73 / 72 / 70 / 69 |
| monk | PASS | - | 1 | 71 / 67 / 63 / 59 |
| master | PASS | - | 1 | 71 / 66 / 62 / 57 |
| red_mage | PASS | - | 1 | 72 / 68 / 66 / 62 |
| black_mage | PASS | - | 1 | 74 / 70 / 67 / 63 |
| black_wizard | PASS | - | 1 | 74 / 69 / 66 / 61 |
| red_wizard | PASS | - | 1 | 71 / 67 / 64 / 60 |
| white_wizard | PASS | - | 1 | 65 / 62 / 58 / 55 |

- Limit hits: **none** (max 1 iteration). Bridge-pair ruling (kt-a): not hit.
- Reviewer notes (not failures): white_wizard's kneel_in1 squashes the round staff head into a lopsided crescent
  with a 1-2 px ragged edge (70 ms, invisible at x2), and its staff turns from upright to diagonal at the swap;
  knight's open helmet becomes the key's lowered dark helmet at the swap; black_wizard / red_wizard's raised arm
  appears at the swap (reads as part of going down).
- Key notes (KA-FIX candidates, not iterated): thief's key has three detached specks (3 px near the hanging hand's
  fingertips, native about (31-32, 52-54); 1 px each at (48, 61) and (47, 72)), carried into kneel_in2 / kneel_b.
- Artefacts: `/tmp/kt-d/it1/<class>_{x2,x3,slow}.gif`, `<class>_strip.png`, `contact.gif` / `contact.png`.

| # | Command (KT2-D) | Key output | Result |
|---|---|---|---|
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `0` (123 lines `: OK`; no monster touched by this tranche) | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` (e.g. `knight: OK [kneel 59 / ready 72 = 0.819, ...]`) | pass |
| T-G3 | `lockdiff --base a7d423f4 --relock` the 8 pilot ids + the 10 classes | no `FAIL`; the 10 classes `relocked ['kneel', 'kneel_b', 'kneel_in1', 'kneel_in2']`; `8 added, 0 changed, 0 removed`; exit 0 | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 6, derived 27, alias 90)` (unchanged here), `heroes 12/12 (ai 12, derived 0, alias 0)` | pass |
| T-G6 | `selftest.py` | runs to the end: `8 FAILED`, none KT's: 2 from the absent gitignored `gen/refs` (`pr_warrior_1080p.png missing`, `FW-9`), 6 from the live KA-FIX Bedrock block (`budget.json ... no live bedrock block`, `kneel_ai.py budget --check`, `usage: billed thoughts`, `KG1`, `KG2`, `bedrock.invoke refuses`); `pass KT kneel bridge`: 22 ok, 0 FAIL; the 3 `selftest_hurtfrom` failures seen elsewhere did not occur | pass (KT) |
| T-G9 | ledger / approved diff vs `a7d423f4` | only `approved/_retired/*_kneel_v1/` additions (64 files); no ledger change | pass |

### 12-E. KT2-E result (floating + swimmer + bird, 20 ids; branch `kt-e` from `fb5992a0`)

Retired: none (`kneel_tools.py coverage` listed none of the 20 on its `derived:` line; every rig was a D-K7 alias and
gained only `kneel: {source: ai}` plus its knobs). An internal render before the first review (not counted) cleared the
`check` findings: K-ground 1 px on fire_elemental / ghost / wraith / pyrolisk (`offset`), pyrolisk's key on the right
cell border (`offset` dx -1), the outline ring of bigeyes in2 / allosaurus in1 / pyrolisk in1, and cockatrice in2's area
(1.19) and centroid step. Review round 1 = 2 reviewers (10 + 10 ids, `it1`), round 2 = 1 reviewer (7 ids, `it2`),
round 3 = 1 reviewer (allosaurus, `it3`); each a fresh multimodal agent with the section 7 rubric only.

| Id | it1 | it2 | it3 | Knobs / offset (locked) | Iterations |
|---|---|---|---|---|---|
| air_elemental | PASS | - | - | - | 1 |
| bigeyes | FAIL T2: the ball shrinks to ~60 % width in one cut at in1 -> in2 and jumps left (size pop) | PASS | - | `bridge: {u: [0.35, 0.15]}` (it1 had `width: false` for the in2 outline ring; width back on) | 2 |
| death_eye | PASS | - | - | - | 1 |
| deepeyes | PASS | - | - | - | 1 |
| evil_eye | PASS | - | - | - | 1 |
| fire_elemental | PASS | - | - | `offset: [0, 1]` | 1 |
| ghost | FAIL T1: in2's column stretch doubled the left outline into a 2 px band, a black wedge by the arm | PASS | - | `offset: [0, 1]`, `bridge: {width: false}` | 2 |
| hollow_seraph | FAIL T1: in2 1.4x the key's width (emblem, pauldrons, wings blocky, halo flattened); T2: in2's head ~8 px right | PASS | - | `bridge: {shear: false, u: [0.35, 0.2]}`; fx halo, `hurt_from: idle` and its paint untouched | 2 |
| red_piranha | PASS | - | - | - | 1 |
| shadow | PASS | - | - | - | 1 |
| specter | PASS | - | - | - | 1 |
| water_elemental | PASS | - | - | - | 1 |
| white_shark | PASS | - | - | - | 1 |
| wraith | PASS | - | - | `offset: [0, 1]` | 1 |
| shark | PASS | - | - | - | 1 |
| allosaurus | FAIL T3: in2 stretched ~1.4x, the face drawn into a horse-like snout | FAIL T2: in2 still a bloated mound (+46 % area over in1): a puff-up then deflate | FAIL T1, T2, T3 (keep_top 0.45: row streaks, bloat, tall head) | **limit hit**, it2 locked: `bridge: {keep_top: 0.35, keep_bot: 0.35, u: [0.35, 0.25]}` | 3 |
| cockatrice | FAIL T5: the feet skitter (in1 +3 px, in2 back -4) | PASS | - | `bridge: {width: false, shear: false}` | 2 |
| pyrolisk | FAIL T5: the front foot forward, back, forward (81 -> 84 -> 81 -> 85) | PASS | - | `offset: [-1, 1]`, `bridge: {keep_top: 0.2, u: [0.2, 0.2]}` (front foot 81 -> 83 -> 84 -> 85) | 2 |
| tyrannosaur | PASS | - | - | - | 1 |
| wyvern | FAIL T5: the feet jiggle (in1 +3 px, in2 back -4) | PASS | - | `bridge: {shear: false}` | 2 |

**Limit-hit table (KT2-E)**

| Id | Best iteration | Reviewer reasons | Knobs tried | Result |
|---|---|---|---|---|
| allosaurus | it2 (1 failed criterion; tie with it1, the latest wins) | it1 T3 face stretched into a snout; it2 T2 in2 bloats (+46 % area) then deflates; it3 T1 / T2 / T3 row streaks, bloat, tall head | pre-review: `keep_top` / `keep_bot` 0.35 (in1 outline ring); it2 `u2` 0.25; it3 `keep_top` 0.45; probed and refused by `check`: `u2` 0.1-0.2 at every band (in1 -> in2 centroid step 14.7-20.6 > 14.3) and `width` / `shear` off | **locked** at it2 (`check` OK). Cause: the standing idle (87 px) vs the flat lying key (40 px); any in2 that the continuity gate allows is a 52-56 px stretch of a lying body. A fix needs a different in2 recipe (e.g. stretch only the hip rows) or a KA-FIX key that is less flat |

- **Key notes** (the approved key, not the bridge; for a possible KA-FIX pass): shark's key has a flat grey smear /
  water column under the body and tail; wyvern's key (and its idle) carries a 1-2 px detached speck, and the key's belly
  under the chest is dark and noisy; bigeyes' key is a different, smaller design (tentacles below a small ball, the fins
  gone) than its idle; ghost's and bigeyes' keys sit ~7 px sideways of the idle base.
- Reviewer notes (not failures): evil_eye's in2 is almost the key (idle and key nearly the same size); shadow's in1 is
  almost the idle; white_shark is the most abrupt pass (nearly all of the swim -> curl change at the swap, widths still
  step 106 -> 89 -> 75 -> 58); red_piranha's in2 sits 2-3 px right of the key (not visible at speed); hollow_seraph's
  floating gauntlets and blades are separate pieces in the approved idle and stay so in in1.
- Measured: a reviewer batch of 10 ids took 3.7-3.8 min, 7 ids 2.2 min, 1 id 0.8 min; `check` of the 20 ids about
  2.5 min wall; `lock` about 1 min per call (one call for many ids); the knob probing used a scratch harness
  (`/tmp/kt-e/probe.py`: `check_sprite` without the lock on a variant block, plus the feet-row extents per frame).
- Review artefacts: `/tmp/kt-e/it1/` (20 ids), `/tmp/kt-e/it2/` (bigeyes ghost hollow_seraph allosaurus cockatrice
  pyrolisk wyvern), `/tmp/kt-e/it3/` (allosaurus); per id `<id>_x2.gif`, `<id>_x3.gif`, `<id>_slow.gif`,
  `<id>_strip.png`, plus `contact.gif` / `contact.png` per directory (`/tmp/kt-e/it1/contact.gif` shows all 20).

**KT2-E gate outputs**

| # | Command | Key output | Result |
|---|---|---|---|
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `0` (123 lines `<id>: OK`, exit 0) | pass |
| T-G1 (ids) | `monster_anim.py check <the 20 ids>` (one call) | 20 lines `<id>: OK (25 checks groups)` (death_eye 30, hollow_seraph 31), exit 0 | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` (heroes unchanged by KT2-E), exit 0 | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock <the 8 pilot ids and classes + the 20 KT2-E ids>` | no `FAIL`; `88 added, 0 changed, 0 removed` (8 pilot + 20 x 4); exit 0 | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 26, derived 27, alias 70)`, `heroes 12/12 (ai 2, derived 10, alias 0)` | pass (running count) |
| T-G6 | `selftest.py` | runs to the end: `12 FAILED`. 8 are KT1's known ones (gen/refs absent in a worktree: `pr_warrior_1080p.png missing`, `FW-9`; the live KA-FIX Bedrock block: `budget.json ... no live bedrock block`, `kneel_ai.py budget --check`, `usage: billed thoughts`, `KG1`, `KG2`, `bedrock.invoke refuses`). `FW-P / FW-O: kf: lock entries exactly ...` was a race (the run read the rigs while the it2 ids were being locked); re-run alone it passes. **3 are KT2-E's and need an integrator fix outside the tranche's files:** `hurt_from: ...` (3 lines, `rig hollow_seraph: kneel source ai but no approved kneel.png`): `selftest_hurtfrom._cfg` builds its fixture from death_eye's rig (`SRC`), which now has `kneel: {source: ai}`, and its `_tree` copies only `boss_*.png`. Fix: `cfg.pop("kneel", None)` in `_cfg` (verified in a scratch monkeypatch run: `run_kf_paint` + `run_hurt_from` 0 FAILED; as is 3 FAILED); `pass KT kneel bridge`: all ok | pass (KT bridge); 3 fixture failures for the integrator |
| T-G9 | ledger / approved diff against `a7d423f4` | no ledger change; `approved/` only the pilot's `_retired/*_kneel_v1/` additions (KT2-E adds none) | pass |

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

### 12-KT3. KT3 result (integrator; branch `kt3` from `mainline` 0e4007e1, 2026-11-18)

Merged `kt-a`, `kt-b`, `kt-c`, `kt-d`, `kt-e`, `kt-f` one at a time (`--no-ff`). Conflicts only in
`docs/RETIRED_SPRITES.md` (union of the rows: 43 `_kneel_v1` rows = the 6 KT1 + 14 A + 11 B + 2 C + 10 D, none removed)
and this plan (the tranche sections kept, ordered 12b, 12c, 12-KT2-C, 12-D, 12-E, 12-F after the rulings log; the TODO
lines joined). The duplicate `9cea4807` merged cleanly (identical content). No atlas was merged by hand (the tranches
touched none).

Fixes and rulings (rows in the rulings log above): the K-ground contact-share exemption for AI-key-drawn frames
(remorazz); chimera (it1 defaults), dragon_zombie (its best iteration `bridge: {keep_top: 0.49, keep_bot: 0.0, width:
false}`, judged by the integrator on the strip: the same drop as the reviewed it1 with a narrower in2, no new hole) and
remorazz (it1 defaults) re-applied, checked (`OK`, 25 checks groups each) and locked; the selftest fixtures for
all-converted rigs; the unused Bedrock pass KA-FIX closed at 2 / 60. Every key note stays a note (user ruling).

**Still BLOCKED: none.** Limit hits carried from the tranches: allosaurus (KT2-E, locked at it2; table in 12-E).

**Atlases** (built once, `build_assets.py monsters_ai battle_ai`): monsters 12 pages (KNEEL_PLAN's prediction; R6
accepted), 2032x2016, 2016x416, 2020x1800, 2048x1656, 2048x1856, 2048x1952, 2048x1664, 2048x2000, 2048x1952, 2048x256,
2048x1952, 2048x384 (each <= 2048x2048), `preload [0, 1]` (no page-group change needed); every one of the 123 sheets has
its own 4 kneel cells and the K-anchor fields are identical to `a7d423f4` (`kneel_tools.py pages`). The party atlas
changes only in the 48 kneel cells (12 classes x 4; `party-diff`: its FAIL lines are exactly those kneel cells, expected
after the switch; no other column differs).

| # | Command (KT3) | Key output | Result |
|---|---|---|---|
| T-G1 | `monster_anim.py check --all \| grep -vc ': OK'` | `1`: the only other line is the log's own `exit 0`; 123 lines `<id>: OK` (chimera, black_widow, crawler, astos `OK (aliased: ...)` as before) | pass |
| T-G2 | `puppet_kneel.py check` | 12 lines `: OK` (e.g. `knight: OK [kneel 59 / ready 72 = 0.819, ...]`), exit 0 | pass |
| T-G3 | `kneel_tools.py lockdiff --base a7d423f4 --relock <all 123 monster ids and 12 classes>` | no `FAIL`; 43 ids `relocked` their 4 kneel entries (31 monsters, 12 heroes); `368 added, 0 changed, 0 removed` (92 aliased rigs x 4); exit 0 | pass |
| T-G4 | `kneel_tools.py coverage` | `monsters 123/123 (ai 123, derived 0, alias 0)`, `heroes 12/12 (ai 12, derived 0, alias 0)` | pass |
| T-G5 | two builds, PYTHONHASHSEED 0 / 1, `shasum -c` | 15 lines `OK` (12 pages, `monsters-ai.json`, `battle-characters-ai.png` / `.json`) | pass |
| T-G6 | `selftest.py` | runs to the end, `2 FAILED`, both worktree-only (the gitignored `gen/refs`: `pr_warrior_1080p.png missing`, `FW-9`); the 6 KA-FIX budget failures of 12a are gone (pass closed; the usage-gate test starts from a fresh pass); `pass KT kneel bridge`: 25 ok, 0 FAIL | pass |
| T-G7 | `npm run build`; `npx vitest run --maxWorkers=2 --minWorkers=1` | build exit 0; vitest: 351 of 353 files passed (8971 tests, 0 failed, includes `assetCoverage` 271 and every kneel test); the run was stopped after 25 idle min on the last two files: `bestiaryProduction` passes alone (3 tests, 0.8 s), `tests/progression/questMutate` (the world mutation suite) does not finish alone in 15 min. KT3 changes no file under `src/` or `tests/` against mainline, so that file is the world pass's | pass (KT); questMutate reported to INT |
| T-G8 | Playwright on 127.0.0.1:5243 (`--strictPort`; 5173 is the INT agent's), `?mute=1&scenario=kt_pilot&kneel=loop`, `kt_pilot_big&kneel=loop`, `kneel_pilot`, `anim_status` | 0 console errors each; `/tmp/kt3/browser/browser_<scenario>_{title,0..5}.png` show the AI kneels in battle | pass |
| T-G9 | ledger / approved diff against `a7d423f4` | no ledger change; `approved/` only `_retired/*_kneel_v1/` additions (172 files) | pass |

Contact GIFs (all 135 sprites at game display scale: monsters at their atlas scale 2 / 3, heroes 2; idle -> kneel_in1
-> kneel_in2 -> hold -> rise, game timing): `/tmp/kt3/contact_all.gif` (copied to `~/temp/ff-game/kneel_tween_all.gif`) and
per group `/tmp/kt3/contact_{pilot,A_small_bipeds,B_large_bipeds,C_quadrupeds,D_heroes,E_floaters_birds,F_serpents_bugs_blobs}.gif`.

## TODOs

- [x] KT0 experiments (cut, squash, dither, rig + stretch) and the choice (section 2)
- [x] KT1 tooling: `kneel_bridge.py`, the hooks, checks, `kneel_bridge_review.py`, selftest, scenarios
- [x] KT1 pilot: 8 sprites, review, locks, atlases, browser (section 12, gate outputs in 12a)
- [x] KT2-A..F rollout (section 9): A 27 / 27, B 20 / 20, C 24 / 26, D 10 / 10, E 20 / 20 (allosaurus limit hit, locked at
  it2), F 23 / 24; chimera, dragon_zombie, remorazz unblocked and locked by KT3 (section 12-KT3)
- [x] KT3 integration, gates, docs (AGENTS.md "Monster animation", section 12-KT3)
- [ ] KT4 (proposal): remove the derived kneel path (`source: derived`, D-KT7 / KNEEL_AI_PLAN D-KA10) now that coverage
  shows `derived 0`; KNEEL_AI_PLAN TODOs and PROGRESS.md are left to that pass

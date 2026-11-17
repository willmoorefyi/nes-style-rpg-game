# AI kneel keyframe plan (pass KA), rev 5: Gemini nano-banana-2.1, pilot and batch

Status: rev 5, a plan only. No paid or AI call was made to write it.

**User ruling (2026-11-17):**

1. Generate the 10 pilot kneeling sprites with the Gemini image model `gemini-nano-banana-2.1`, using interactive
   calls.
2. Generate the remaining images with the same model through the Gemini Batch API.

**Why the plan changed.**

- The Stability probe KA1-P made 54 calls; its sheets are in `assets-src/gen/out/kneel_ai/review/probe_sheet.png`
  and `probe_raw_sheet.png`. The user judged the results "vastly different than the reference images":
  - Style Transfer ignored the pose.
  - Sketch -> Style Transfer came out realistic, with scenery.
  - Style Guide changed the design.
- The research brief `/tmp/sprite_repose_research.md` (sections 0, 2 and 4) explains why. Each Stability service
  conditions on either a style or a structure, and none takes "this exact character" as an input. Gemini editing with
  reference images (up to 4 character references, and a pose reference image for complex poses) is the recommended
  route.

## Rev 5 changes

| Item | Rev 4 | Rev 5 |
|---|---|---|
| Model | Stability arms (a) to (d) on Bedrock | `gemini-nano-banana-2.1`, one image per request (section 2) |
| Probe and stages | KA1-P (Stability), stages 1 and 2 | **closed**: pass KA ended at 54 of 91 Bedrock requests and moves to `bedrock_history` (section 5) |
| Pilot | 6 sprites, Stability | **KA-G1**: 10 sprites, interactive, at most 3 tries each (section 3) |
| Rollout | Stability stage 2 | **KA-G2**: 125 sprites through the Batch API, in at most 3 rounds plus the Q3 reserve (section 4) |
| Budget | Bedrock pass KA | a new **Gemini pass `KA-G`** in `budget.json`, with pilot, batch and reserve caps, enforced by the existing Gemini guard, which also counts batch rows (section 5) |
| Kept | | everything in the table below |

**Kept from rev 4.** Each item is implemented in KA0b (`88f8ad7`) and specified in rev 4 (`git show
4ade849:docs/KNEEL_AI_PLAN.md`).

| Kept item | Rev 4 section | Code |
|---|---|---|
| Pose-only guides G-sil / G-skel, the 1024x1024 canvas, the guide window `{x0, y0, w, h, k}` in the guide json, and the key colour `{bg}` | D-KA1 / D-KA2 | `kneel_ai_guide.py` |
| The cut: key-colour flood mask; one uniform canvas scale (the <= 8 % width shrink, the <= 2 px height correction); one `pixelize(grid=(w, h), palette=ndarray)`; the outline peel; the foot rows; the window re-centred on the figure base, failing when the figure touches the window edge (U0 momus P2); the >= 99 % round-trip selftest | D-KA6 | `kneel_ai_cut.py` |
| J0 gates (joint-free, before approval) and J1 gates (after marking, before lock); calibrated thresholds with the hurt-key exclusions | section 6 | `kneel_ai_gates.py`, `kneel_ai_j1.py`, `kneel_ai_calib.py`, `kneel_ai_thresholds.json` |
| `weapons` / `heads` lists per sprite (also used for the prompt counts) | r3-3 | `kneel_ai_bodies.py`, `kneel_ai.yaml` |
| Hand-marked joints on the key; in-betweens through the rig (`source: ai`); `kf:kneel` lock; `retire_kneel.py` (derived and `--key`) | D-KA5, D-KA7 to D-KA10, section 5 | `kneel.py`, `kneel_ai_joints.py`, `retire_kneel.py` |
| Review agent R1 (with counts), R2, R2b, R3, R4, R5; at most 3 tries | section 6 | |
| U0 rulings Q2 (review points), Q3 (iii: one reserve try, then the daze alias), Q4 (archive tags) | section 13 | |
| Prompt body texts, including the compact wording and `{not_bg}` | 5b | `kneel_ai.yaml` |

## 1. Verified facts (free, read-only calls; 2026-11-17)

| Fact | Source |
|---|---|
| The account lists `gemini-nano-banana-2.1` with `generateContent` and `batchGenerateContent` | `client.models.list()` (coordinator) |
| `google-genai` 3.2.0 is installed and has `client.batches`; no batch jobs exist | `client.batches.list()` (coordinator) |
| A typical request (pose guide + approved sheet + prompt) counts **541 input tokens** | `client.models.count_tokens` (coordinator) |
| Prices at 1K: output $0.0336 per image standard, **$0.0168 batch**; input $1.50/M standard, $0.75/M batch | Google AI Studio pricing page |
| Batch API: JSONL input through the File API (<= 2 GB) or inline (< 20 MB); 50 % price; target 24 h; a job **expires after 48 h**; creation is **not idempotent**; check `batchStats.failedRequestCount`; results are a JSONL of `GenerateContentResponse` with `inline_data` images | aistudio.google.com/docs/batch-api |
| Gemini guard: `gemini.py` (`DEFAULT_MODEL` = `gemini-3.1-flash-lite-image`; `cache_key` hashes model, prompt, aspect and seed; config `response_modalities=["IMAGE"]`, `ImageConfig(aspect_ratio)`, `seed`); `generate.check_budget` counts `event == "attempt"` rows with `backend != "bedrock"`, the top-level `cap` from `attempts_before`, and `max_attempts_per_sheet` per (character, sheet) | `gemini.py:19-107`; `generate.py:379-460` |
| `generate.budget_consistency` requires `attempts_before` == pass V `gemini_before` == pass R fix `gemini_end` (367) while a `pass V` entry exists. `selftest_passv.py:57` and `selftest_colossus.py:143` pin `attempts_before` 367 / cap 50 | `generate.py:384-411` |
| Gemini ledger: **405** attempts (pass V used 38 of 50) | `cache/ledger.jsonl` |
| BR ledger pass KA: **54** `ka_probe` requests; `ka_pilot` 0 | `cache/bedrock_ledger.jsonl` |
| The research brief says `gemini-3.1-flash-lite-image` is "not optimized for multiple reference inputs", so the kneel path must pass the model explicitly | brief 0.3 |

## 2. Request design (one sprite, one try, one image)

**Contents**, in this order (`types.Part` list):

1. **Image 1, the identity reference:** the approved idle cell (heroes: `ready`), upscaled nearest-neighbour by the
   guide's k and placed on the guide's 1024x1024 `{bg}` canvas at the guide window.
2. **Image 2, the second reference:** the approved hurt cell, placed the same way (the "weakened" look). Dropped per
   sprite with `kneel_ai.yaml sprites.<id>.refs: [idle]` when the reviewer names it as a cause; default on.
3. **Image 3, the pose reference:** G-sil (the flat grey kneel silhouette from the template joints) on the same canvas
   and window. The scale is therefore known: k.
4. **Text:**

   "Image 1 and image 2 show one character. Redraw **this exact character** in the pose of the grey silhouette in image
   3: {pose text}. Keep exactly the same design, colours, face, armour, clothing, {weapon phrase} and proportions as
   image 1, with {heads phrase}. Same 16-bit pixel-art style, same palette, bold outline, light from the upper left.
   Side view {facing}. Full body, centred on the silhouette, the same size as the silhouette. Plain flat {bg}
   background, no ground, no shadow, no text."

   - `{pose text}` is the rev-4 5b body text, kept per body. For example, biped: "kneeling on one knee, the far knee
     on the ground, torso bent forward, head bowed low"; quadruped: "lying down in a compact pose, forelegs tucked
     under the chest, head lowered to the ground"; blob: "slumped and flattened, sagging, eyes looking down";
     floating: "sagging lower in the air, head and eyes turned down".
   - `{weapon phrase}` / `{heads phrase}` come from the `weapons` / `heads` lists (for example "holding exactly 1
     dagger", "exactly 3 heads").
   - The rev-4 negative list becomes a trailing sentence: "Do not add: {negatives}". Gemini has no negative-prompt
     field.
   - `{not_bg}` is kept, and the key colour itself is never named as something to avoid.

**Config:**

```python
types.GenerateContentConfig(response_modalities=["IMAGE"],
                            image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K"), seed=seed)
```

- **Model:** `gemini-nano-banana-2.1`, always passed explicitly. `DEFAULT_MODEL` stays as it is for the other sheets.
- **Cache key:** `gemini.cache_key` gains `image_size`, but only when it is set, so every existing key is unchanged
  (selftest).
- **Seed and variation policy:** try N uses seed 1234 + N - 1. The seed is a hint (Gemini may not reproduce an image
  exactly); the cache stores the image, so it is the record. Tries 2-3 also change the prompt, but only through
  `kneel_ai.yaml sprites.<id>.extra` / `avoid` lines that quote the reviewer's or a gate's reason (for example "the
  dagger must stay in the near hand"). No sweeps, no multi-turn editing, and no model escalation (Q-G3).
- **Output size:** a 1:1 1K image is expected to be 1024x1024. A different 1:1 size is scaled uniformly to 1024
  (Lanczos) before the cut, and recorded. A non-square output is a J0 `size` fail.
- **Scale:** the cut uses the guide window (known k) first. If the figure's bounding-box height differs from the
  silhouette's by more than 10 %, the cut uses rev-4 arm (d)'s path (one uniform scale from the figure height and the
  band midpoint, re-centred on the base), and the key is **flagged** for J1 A-scale.
- **Arm id:** `g`, in `kneel_ai.py` `ARMS`, with the outputs at `out/kneel_ai/<id>/raw_g_<try>.png` / `key_g_<try>.png`.

## 3. KA-G1 pilot (interactive, standard price)

| Sprite | Why |
|---|---|
| goblin, wolf, warrior, white_mage, cobra, green_slime | the K1 / KA1-P set, for a direct comparison with the derived kneels and the Stability probe |
| blue_dragon | winged quadruped at display scale 3 |
| ghost | floater (the foot-row rule, the runtime sink) |
| scorpion | arthropod (legs, pincers, stinger; the compact wording) |
| iron_golem | mechanical (plating; derived on mainline with `mech_kneel`) |

- **Calls:** `python3 -I assets-src/gen/kneel_ai.py gen <id> --arm g --try N --paid`, one call per command, run in the
  background and waited on with Monitor, from the main checkout only.
- **Tries:** at most 3 per sprite, so at most **30 images**. If Q3 (iii) applies, a sprite may take 1 more from
  `ka_g_reserve`.
- **After each try:** cut -> J0 -> review agent (R1 counts, R2, R2b, R3, R5) -> approve on PASS. The rig agent then
  hand-marks the joints -> J1 -> `check` -> `lock`.
- **Pilot sheet for the user** (`out/kneel_ai/review/pilot_g_sheet.png`). One row per sprite, at native x4, with the
  J0 / J1 values and tries used. Columns:
  - idle / ready;
  - **old derived kneel** (mainline; cobra, green_slime, ghost and scorpion from the `archive/kneel-k3-0` tag);
  - the Stability probe's best (the 5 probe sprites);
  - Gemini raw;
  - **Gemini key**;
  - kneel_in1, kneel_in2, kneel_b;
  - hurt / down.
- **Also for the user:** `<id>_side.gif` (old vs Gemini kneel sequence) and the
  `?mute=1&scenario=ka_pilot&battleStep=1&poseLabel=1` screenshots.
- **The user approves the pilot before any batch.** That ruling goes into section 9. Pass: the user approves >= 7 of
  10 and approves the KA-G2 budget (Q-G2); otherwise rev 6.

## 4. KA-G2 batch rollout (125 = 135 - 10)

**Sprites:** 115 monsters and 10 heroes.

| Group | Sprites |
|---|---|
| biped (47) | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle garland ghast ghoul gr_imp hill_gigas horned_devil ice_gigas king_mummy lich mindflayer minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier stone_golem troll vampire vampire_lord warmech weretiger werewolf wight zombie |
| quadruped (26) | baretta basilisk chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hydra hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf |
| heroes (10) | knight thief ninja monk master red_mage black_mage black_wizard red_wizard white_wizard |
| other bodies (42) | bird: allosaurus cockatrice pyrolisk tyrannosaur wyvern; floating: air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental hollow_seraph red_piranha shadow specter water_elemental white_shark wraith; swimmer: shark; serpent: anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; naga: ashen_queen earth_medusa medusa spirit_naga water_naga; arthropod: ankheg black_widow crawler remorazz sea_scorpion tarantula; blob: black_flan gray_ooze ochre_jelly; rooted: neochu ochu |

**Rounds** (one batch job per round):

| Round | Requests | Seed / prompt |
|---|---|---|
| 1 | all 125 | seed 1234, the pilot-proven prompt per body |
| 2 | the round-1 failures (J0, review, J1, or a failed / missing batch response) | seed 1235, the revised `extra` / `avoid` lines per sprite |
| 3 | the remaining failures | seed 1236, revised again |
| reserve (Q3 iii) | the remaining failures, 1 each | seed 1237; after that, the daze alias (F2) |

- **J1 needs marked joints**, so a round's J1 results come from the rig agents before the next round is prepared. A
  round is prepared only when every sprite of the previous round is PASS-locked, FAIL with a reason, or missing.
- **Rig work** (joints, `check`, `lock`) runs in at most 2 worktrees by the groups above: biped, quadruped, heroes,
  other bodies. Bedrock is never used, and the batch tool runs only in the main checkout.
- **Limits:** at most 3 Python processes, each with `OMP/OPENBLAS/MKL_NUM_THREADS=1`. The integrator alone rebuilds
  atlases.

## 5. Budget, ledger and the guard

**Stability pass KA: closed.** The `bedrock` block {pass KA, 54 of 91 used} moves into `bedrock_history` with
`closed: "2026-11-17, 54 of 91, rev 5"`. With no live `bedrock` block, `bedrock.invoke` refuses every call
(fail-closed, as it already does). `colossus.py budget --check` and `kneel_ai.py budget --check` read both closed
passes from history.

**Gemini pass `KA-G`** (`budget.json`):

- Pass V closes with `gemini_end: 405`.
- The top level becomes `attempts_before: 405`, `cap: 540`, `max_attempts_per_sheet: 4`.
- The `passes` entry:

  ```json
  {"name": "pass KA-G", "gemini_before": 405, "model": "gemini-nano-banana-2.1",
   "only_sheet_names": ["kneel", "battle_kneel"],
   "purpose_caps": {"ka_g_pilot": 30, "ka_g_batch": 375, "ka_g_reserve": 135}}
  ```

| Purpose | Scope | Cap | Unit price | Worst case |
|---|---|---|---|---|
| `ka_g_pilot` | 10 sprites x 3 tries, interactive | 30 | $0.0336 + 541 x $1.50/M = $0.0344 | **$1.03** |
| `ka_g_batch` | 125 x 3 rounds, batch | 375 | $0.0168 + 541 x $0.75/M = $0.0172 | **$6.45** |
| `ka_g_reserve` | the Q3 (iii) try: 10 interactive + 125 batch | 135 | as above | **$2.49** ($0.34 + $2.15) |
| **pass KA-G** | | **540** | | **$9.97** |

- **Expected:** pilot about 18 images, batch about 125 + 60 + 25 = 210, reserve about 15, so about 245 images, about
  $4.50.
- **The guard** (`generate.check_budget`, shared by `kneel_ai.py gen --arm g` and `gemini_batch.py submit`):
  - `budget_consistency` is generalised to "the last closed pass's `gemini_end` == the open pass's `gemini_before` ==
    `attempts_before`". It still enforces 367 for the history, and `selftest_passv.py:57` / `selftest_colossus.py:143`
    are re-pinned to pass V closed at 405.
  - New: `only_sheet_names` refuses any other sheet in pass KA-G; `purpose_caps` counts the attempt rows of the pass
    per `purpose`; per sheet the limit is 4, but the 4th must carry `ka_g_reserve`.
  - **Batch rows count:** every request is an `event: attempt` row with `backend: gemini_batch` (not `bedrock`), so the
    run cap and the per-sheet counts include them with no other change.
- **Ledger rows** (`cache/ledger.jsonl`, tracked):
  - `attempt` {ts, backend `gemini` | `gemini_batch`, model, character, sheet, seed, key = the cache key, req =
    `<sprite>:<try>`, pass `KA-G`, purpose, round, est_usd}, written **before** the call or the batch create;
  - `batch_submit` {round, n, jsonl sha256, display_name}, written before create;
  - `batch_created` {round, job} after create;
  - `result` {key, ok, error?} per response.

## 6. New tooling (0 paid calls to build)

| File | Change | Limit |
|---|---|---|
| `gen/gemini_batch.py` (new) | `prepare --round R [--dry-run]`: one JSONL line per request, `{"key": "<sprite>:<try>", "request": {contents with the 3 images as inline_data base64 + text, generation_config as section 2}}`. The images are embedded, so no per-image File API upload can expire; only the JSONL file is uploaded. Then validation: unique keys, 3 images + 1 text part, model, config, est cost. `submit --round R [--paid]`: the guard check; refuses a round with a recorded `batch_submit` unless `--recover` (which **lists** `client.batches` for the display name `ka-g-r<R>-<sha8>` and records a found job instead of creating one, since create is not idempotent); writes the rows, uploads, creates. `poll --round R`: one line `<job> <state> ok=<n> failed=<batchStats.failedRequestCount>`. `fetch --round R`: download the results JSONL, decode `inline_data`, write the cache PNG and `out/kneel_ai/<id>/raw_g_<try>.png`, `result` rows, then cut + J0 per sprite | <= 250 |
| `gen/kneel_ai.py` | arm `g` (`gen --arm g --try N`); `budget --check` prints the closed Bedrock passes and pass KA-G | +<= 30 |
| `gen/kneel_ai_req.py` | the section 2 Gemini contents and config (shared by `gen` and `gemini_batch.prepare`) | +<= 60 |
| `gen/gemini.py` | `image_size` argument (cache key changed only when it is set); explicit model | +<= 8 |
| `gen/generate.py` | `budget_consistency` generalised; `only_sheet_names`, `purpose_caps` and the reserve-only 4th try in `check_budget` | +<= 25 |
| `gen/budget.json` | pass V closed at 405; pass KA-G; pass KA (Bedrock) into `bedrock_history` | data |
| `gen/selftest_passv.py`, `gen/selftest_colossus.py` | re-pinned: pass V closed at 405; pass C and pass KA in history | +<= 10 |
| `gen/selftest_gemini_batch.py` (new) + 1 line in `selftest.py` | a fake client (files, batches create / get / list, a results file with one failed line); rows before create; resubmit refused; `--recover` finds the job without creating; a cap refusal (the 541st image; a 5th try; a 4th without the reserve purpose; a non-kneel sheet); partial failure routed to the next round; `EXPIRED` routed with partial results kept; JSONL schema; an unchanged cache key without `image_size` | <= 250 |

## 7. Gates

The rev-4 merge gates G1-G16 still apply (`git show 4ade849:docs/KNEEL_AI_PLAN.md`, section 9), except that **G12
changes** (the Gemini ledger now grows). The KA-G gates come in addition.

```bash
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
# KG1 budget (after every call, round and merge). Expect these lines, then exit 0:
#   "closed pass C 25/80, closed pass KA 54/91"
#   "OK pass KA-G pilot <p>/30, batch <b>/375, reserve <r>/135, total <t>/540, est $<x.xx>"
python3 -I assets-src/gen/kneel_ai.py budget --check
# KG2 no Bedrock since the probe: empty
git diff --stat 8beaa50 -- assets-src/gen/cache/bedrock_ledger.jsonl
# KG3 dry-run JSONL validation before every submit. Expect:
#   "OK round <R>: <n> requests, <n> unique keys, 3 images + 1 text each, model gemini-nano-banana-2.1, 1:1 1K,
#    est $<x.xx>; 0 sent"
python3 -I assets-src/gen/gemini_batch.py prepare --round 1 --dry-run
# KG4 after fetch. Expect "fetched <ok> ok, <f> failed (failedRequestCount <f>), missing 0", with ok + f = n
python3 -I assets-src/gen/gemini_batch.py fetch --round 1
# KG5 selftests: last line "ALL PASSED" (includes selftest_gemini_batch, selftest_passv, selftest_colossus)
python3 -I assets-src/gen/selftest.py
# KG6 the guard refuses a 2nd submit of a round. Expect "refused: round 1 already submitted (job <name>); use --recover"
python3 -I assets-src/gen/gemini_batch.py submit --round 1 --paid
# KG7 coverage at the end. Expect "monsters ai A, derived 0, alias F (= 123)" and "heroes ai A, derived 0, alias F (= 12)"
python3 -I assets-src/gen/kneel_tools.py coverage
```

Per sprite, as in rev 4: J0 `PASS` before `approve`; J1 `PASS` and `monster_anim.py check <id>` -> `<id>: OK` (heroes:
`puppet_kneel.py check <class>`) before `lock`.

## 8. Risks

| Risk | Mitigation / measure |
|---|---|
| **Identity drift** (Gemini redesigns the character) | 2 references of the approved art; an explicit keep list and counts; the palette snap; J0 A-pal / A-hist / A-adj; J1 A-prop / A-headdup; R1 counts; the pilot gate (>= 7 of 10) before any batch |
| **Batch delay or expiry** (target 24 h, expires at 48 h) | poll with Monitor; at `EXPIRED`, keep the partial results and send the rest to the next round (the requests were counted when submitted, so the caps hold) |
| **Partial batch failures** | `failedRequestCount` and per-line errors go to `result` rows; missing or failed keys go to the next round; KG4 requires ok + failed = n |
| **Non-idempotent create** (duplicate job and cost) | rows before create; a 2nd submit refused (KG6); `--recover` lists the jobs by display name before any re-create |
| **Cost tracking** (batch billing lags) | `est_usd` per row; KG1 after every step; the purpose caps; the run cap of 540 |
| **Image size or aspect** | `aspect_ratio` 1:1 and `image_size` 1K; a non-square output is a J0 `size` fail; a scale off by > 10 % takes the measured path and the J1 A-scale flag |
| **Background key colour** (Gemini paints a gradient, a near-key colour or a halo) | `{bg}` in the text, `{not_bg}` avoid line; the flood mask with `tol` 40; A-grey and A-pieces; white-key sprites as in rev 4 |
| **SynthID watermark** (invisible) | removed by the pixelize down-sample and the palette snap; nothing to do |
| **The pilot misses** | rev 6 before any batch spend; the research brief's runner-up (PixelLab, a new account) needs a user ruling |

## 9. Open questions (each with its default)

1. **Q-G1 Pilot cap:** 30 interactive images plus up to 10 reserve, $1.37 at worst? Default: **yes** (the
   2026-11-17 ruling directs the pilot).
2. **Q-G2 Batch budget:** asked at the pilot review. It is 375 batch images plus 125 reserve, $8.60 at worst (pass
   KA-G total 540, $9.97). Default: **approve after the pilot**.
3. **Q-G3 Model escalation:** retry a failing sprite on `gemini-3-pro-image` ($0.134 + thinking), as the research
   brief suggests? Default: **no**; stay on `gemini-nano-banana-2.1` as ruled.

## 10. Rulings log

| Date | Item | Ruling |
|---|---|---|
| 2026-11-17 | U0 (Q1-Q4, prices) | as in rev 4 (`4ade849`); Q2, Q3 (iii) and Q4 stay in force |
| 2026-11-17 | KA1-P | the Stability probe (54 calls) was rejected by the user: "vastly different than the reference images" |
| 2026-11-17 | rev 5 | Gemini `gemini-nano-banana-2.1`: 10 pilot sprites interactive, the rest through the Batch API (user) |

## TODOs

- [ ] KA-G0 tooling: `gemini_batch.py`, arm `g`, `gemini.py` `image_size`, the guard changes, budget.json pass KA-G and the history moves, selftests; KG1, KG3 (on a pilot sprite) and KG5 green; 0 calls (high, 6h)
- [ ] KA-G1 pilot: 10 sprites x <= 3 tries, interactive; J0, review, approve, marking, J1, lock; pilot sheet, GIFs, screenshots (high, 8h)
- [ ] U1-G: user review of the pilot and the Q-G2 budget (blocking)
- [ ] KA-G2 round 1 (125), fetch, J0 / review / approve, rig work by group (medium, about 2 days including the batch wait)
- [ ] KA-G2 rounds 2-3 and the reserve, then the alias for the rest (medium, 1 day)
- [ ] KA4: the rev-4 play test, the 135-key contact sheet for the user, docs, final gates (high, 6h)

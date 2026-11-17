# AI kneel keyframe plan (pass KA), rev 7: Gemini nano-banana-2.1, pilot and batch

Status: rev 7, a plan only. It answers the momus review of rev 6 (OKAY once items 1 and 2 are fixed). No paid or AI call was made to write it.

**Rev 7 changes (momus review of rev 6):**

| # | Finding | Resolution |
|---|---|---|
| n1 (P1) | Cutting at the measured pitch p made A-scale fail by construction, since the guide fixes the figure's size at k | **The cut stays at k.** Size comes only from the figure against the silhouette (the 10 % height check and its arm-(d) path). The pitch only **aligns** the window's phase to Gemini's grid. \|p - k\| / k is reported as an R3 note and in the pilot distribution. A cut at p happens only when the figure itself is off by about k / p, which is the arm-(d) path's case (section 2) |
| n2 (P2) | With `void_ok` false, an expired sprite lost a try, and its reserve try was refused | Option 1: `ka_g_expiry` rows are **excluded** from the per-sheet count and from the "4th try must be `ka_g_reserve`" rule; they count only against the purpose cap and the run cap. New selftest walk: expired -> re-send -> round 2 -> round 3 -> reserve, all accepted (section 5) |
| n3 (P3) | A cancelled duplicate may already have billed requests | At cancel, the duplicate's processed count is written as that many `attempt` rows with purpose `ka_g_expiry` and `reason: duplicate` |
| n4 (P3) | Tranche T fallback | Only the **round-1b** sprites of a failing body get the revised prompt. The T sprites are not re-sent in round 1; they move on to round 2 like any other failure |
| n5 (P3) | `max_paid` | `gemini_batch.py submit` passes `max_paid` = n for the round, capped by the purpose's remaining budget (refused if n exceeds it). Round 1b needs >= 115 |

**Rev 6 changes (momus review of rev 5):**

| # | Finding | Resolution |
|---|---|---|
| m1 (P1) | KG6 carried `--paid` | **No gate is a paid command.** New `gemini_batch.py submit --round R --check`: it never calls create, and prints the refusal line or `would submit <n>`. KG6 uses `--check`. `selftest_gemini_batch.py` proves the duplicate-submit refusal with the fake client |
| m2 (P2) | Expired jobs return no results | At `JOB_STATE_EXPIRED`, or `FAILED` with 0 responses, `fetch` appends a `void` row per key. The guard leaves voided attempts out **only after** a one-time billing check (`void_ok: true`, section 10). Until then the voided rows count, and an expiry allowance of 1 round (`ka_g_expiry` 125) exists. The selftest case is now "EXPIRED, 0 responses -> void rows, keys re-queued" |
| m3 (P2) | `--recover` was too narrow | `--recover` lists **every** job named `ka-g-r<R>-*`. It refuses to create while any is PENDING, RUNNING or SUCCEEDED, and cancels any duplicate beyond the earliest with `client.batches.cancel` (a `batch_cancel` row). When none is found it prints `NOT FOUND`; only an explicit `--recreate` writes a new `batch_submit` row and creates (section 6) |
| m4 (P2) | `check_budget` would crash on pass KA-G (`cap["max_new"]`, `cap["max_per_sheet"]`, `generate.py:459-462`) | Pass KA-G carries `max_new` and `max_per_sheet: 4`. The `KneelRequest` adapter has `.cached`, `.character`, `.sheet.name`. Every try after the first, including every round-2 / round-3 / reserve batch line, passes `retry=True` to the `generate.py:474-479` check, authorised by the user's pass approvals (section 5) |
| m5 (P2) | Gemini does not keep the pixel grid | J0 measures `pixelize.detect_pitch` on every raw image and reports it. If the pitch differs from k by more than 15 % (confidence >= 0.5), the cut runs at the measured pitch and the key is flagged for J1 A-scale. The pilot reports the distribution (section 2) |
| m6 (P2) | Pilot coverage | ghost moves out of the pilot and scorpion into the tranche. Garland (per-pose boss) and rhyos (multi-head, the R271 duplication failure) come in. Batch round 1 now starts with a **10-sprite tranche** of untested bodies (about $0.18) before the other 115. FW-T does not apply to Chaos (section 4) |
| m7 (P3) | Token count | 1026 input tokens for the rev-5 shape (3 images at 1024 + prompt): $0.0015 per interactive image, $0.0008 per batch image. Totals updated: about **$10.20** worst case, $12.40 with the expiry allowance. `usage_metadata` is recorded on the first pilot call; thinking tokens, if billed, stop the pilot for a recount |
| m8 (P3) | The hurt reference may pull the pose | Try 1 sends `[idle, pose]`. The hurt is added only on a retry where the reviewer flags identity (R1) |
| m9 (P3) | Q3 wording | With one arm, the Q3 (iii) reserve try is **seed 1237 on the same model and request**, with the try-3 prompt lines |
| m10 (P3) | JSONL size | About 5 MB per full round: inside both the 20 MB inline and the 2 GB File API limits. Flood `tol` 40 stays |

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
| A request in the section 2 shape (3 images at 1024 + the prompt) counts **1026 input tokens** (rev 5 cited 541 for a 2-image shape) | `client.models.count_tokens` (momus, rev-5 review) |
| `check_budget` reads `cap["gemini_before"]`, `cap["max_new"]` and `cap["max_per_sheet"]` for every open pass, and refuses a request for a (character, sheet) with prior attempt rows unless `retry=True` | `generate.py:459-462`, `:474-479` |
| `pixelize.detect_pitch(rgb, lo=3.0, hi=14.0)` returns (pitch, phase_x, phase_y, confidence); below about 0.5 the render has no usable grid | `pixelize.py:21-25` |
| Chaos F1 is `size: boss` in the 200 px boss band at scale 3 (D-V6 = C2); there is no `size: titan` sheet, so the FW-T fail-closed titan cut (`info["scale"] != 1.0` raises) does not apply. The kneel key goes through `kneel_ai_cut.py`, not `monster.cut`, in any case | AGENTS.md (monsters_ai row); `docs/REDESIGN_PLAN.md:550-559` |
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
2. **Image 2, the pose reference:** G-sil (the flat grey kneel silhouette from the template joints) on the same canvas
   and window. The scale is therefore known: k.
3. **Optional image 3, the hurt cell:** placed the same way, but **not on try 1**, since it may pull the pose toward
   `hurt`. It is added (`kneel_ai.yaml sprites.<id>.refs: [idle, hurt]`) only on a retry where the reviewer flags
   identity (R1). The text then reads "Image 1 and image 3 show one character" and refers to image 2 for the pose.
4. **Text:**

   "Image 1 shows one character. Redraw **this exact character** in the pose of the grey silhouette in image
   2: {pose text}. Keep exactly the same design, colours, face, armour, clothing, {weapon phrase} and proportions as
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
- **Pixel grid (J0, reported for every raw):** `pixelize.detect_pitch(raw)` gives (pitch, confidence). Gemini does
  not reliably keep the grid.
  - **The cut always runs at k** (the window is w x k by h x k), because the guide fixes the figure's size at k. A cut
    at p would make A-scale fail by construction.
  - If confidence >= 0.5, the measured phase (phase_x, phase_y) **only aligns** the window to Gemini's grid: the
    window origin moves by at most k / 2 px to the nearest grid line, so each block covers whole Gemini pixels. The
    window's size does not change.
  - \|p - k\| / k is reported for every raw, as an R3 note on the review sheet and in the pilot's distribution
    (`pilot_numbers.txt`). It never fails J0 by itself.
  - If confidence < 0.5 (no grid), there is no alignment, and `no grid` is reported.
  - A cut at p happens only through the arm-(d) path below: when the figure's height against the silhouette is off by
    more than 10 %, and that ratio is close to k / p (within 5 %), the uniform scale is s = k / p, and the key is
    flagged for J1 A-scale.
- **Scale:** the cut uses the guide window (known k) first. If the figure's bounding-box height differs from the
  silhouette's by more than 10 %, the cut uses rev-4 arm (d)'s path (one uniform scale from the figure height and the
  band midpoint, re-centred on the base), and the key is **flagged** for J1 A-scale.
- **Usage:** the first pilot call records `resp.usage_metadata` (prompt, candidates and thoughts token counts) in its
  `result` row. If `thoughts_token_count` > 0 or the prompt count is above 1100, the pilot stops and section 5 is
  recounted before the next call.
- **Arm id:** `g`, in `kneel_ai.py` `ARMS`, with the outputs at `out/kneel_ai/<id>/raw_g_<try>.png` / `key_g_<try>.png`.

## 3. KA-G1 pilot (interactive, standard price)

| Sprite | Why |
|---|---|
| goblin, wolf, warrior, white_mage, cobra, green_slime | the K1 / KA1-P set, for a direct comparison with the derived kneels and the Stability probe |
| blue_dragon | winged quadruped at display scale 3 |
| iron_golem | mechanical (plating; derived on mainline with `mech_kneel`) |
| garland | boss with per-pose cells (cape cloth, `glow` fx); act-1 |
| rhyos | multi-head quadruped: the known AI duplication failure (ACT1_LOG R271-R274: a 4th head); A-headdup and R1 counts |

- **Calls:** `python3 -I assets-src/gen/kneel_ai.py gen <id> --arm g --try N --paid`, one call per command, run in the
  background and waited on with Monitor, from the main checkout only.
- **Tries:** at most 3 per sprite, so at most **30 images**. If Q3 (iii) applies, a sprite may take 1 more from
  `ka_g_reserve`.
- **After each try:** cut -> J0 -> review agent (R1 counts, R2, R2b, R3, R5) -> approve on PASS. The rig agent then
  hand-marks the joints -> J1 -> `check` -> `lock`.
- **Pilot sheet for the user** (`out/kneel_ai/review/pilot_g_sheet.png`). One row per sprite, at native x4, with the
  J0 / J1 values and tries used. Columns:
  - idle / ready;
  - **old derived kneel** (mainline; cobra and green_slime from the `archive/kneel-k3-0` tag);
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

**Sprites:** 115 monsters and 10 heroes: every sprite outside the pilot.

| Group | Sprites |
|---|---|
| biped (46) | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle ghast ghoul gr_imp hill_gigas horned_devil ice_gigas king_mummy lich mindflayer minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier stone_golem troll vampire vampire_lord warmech weretiger werewolf wight zombie |
| quadruped (25) | baretta basilisk chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hydra hyenadon lesser_tiger lizard manticore nightmare sabertooth sphinx white_crocodile white_dragon winter_wolf |
| heroes (10) | knight thief ninja monk master red_mage black_mage black_wizard red_wizard white_wizard |
| other bodies (44) | bird: allosaurus cockatrice pyrolisk tyrannosaur wyvern; floating: air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental ghost hollow_seraph red_piranha shadow specter water_elemental white_shark wraith; swimmer: shark; serpent: anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; naga: ashen_queen earth_medusa medusa spirit_naga water_naga; arthropod: ankheg black_widow crawler remorazz scorpion sea_scorpion tarantula; blob: black_flan gray_ooze ochre_jelly; rooted: neochu ochu |

**Tranche T (round 1a, before the full set; 10 batch images, about $0.18).** These are the bodies the pilot does
not cover: water_naga (naga), cockatrice (bird), ochu (rooted), shark (swimmer), chaos (Chaos F1: `size: boss`,
200 px band, display scale 3; FW-T does not apply, section 1), hydra (multi-head quadruped), ghost (floater: the foot
row and the runtime sink), scorpion (arthropod), hollow_seraph (per-pose boss, blade wings, `hurt_from: idle`) and
black_mage (robed hero with a hat). Tranche T is a batch job of its own (`gemini_batch.py prepare --round 1a`). Round 1b
(the other 115) is prepared only after T is fetched and its J0 + review results are recorded. If fewer than 6 of 10
pass, the per-body prompts of the failing bodies are revised (still round 1, so seed 1234), and that is recorded in
section 10 before 1b. The revised prompt reaches **only the round-1b sprites** of those bodies. The T sprites are
**not** re-sent in round 1; their failures go to round 2 (seed 1235) like any other.

**Rounds** (one batch job per round; round 1 is 1a + 1b):

| Round | Requests | Seed / prompt |
|---|---|---|
| 1 (1a + 1b) | tranche T (10), then the other 115 | seed 1234, the pilot-proven prompt per body; refs `[idle, pose]` |
| 2 | the round-1 failures (J0, review, J1, or a failed / missing batch response) | seed 1235, the revised `extra` / `avoid` lines per sprite |
| 3 | the remaining failures | seed 1236, revised again |
| reserve (Q3 iii) | the remaining failures, 1 each | seed 1237 on the **same model and request** with the try-3 prompt lines (there is one arm, so no "fallback arm"); after that, the daze alias (F2) |

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
- The top level becomes `attempts_before: 405`, `cap: 665`, `max_attempts_per_sheet: 4` (665 = 540 + the expiry allowance; it drops to 540 when `void_ok` is set).
- The `passes` entry:

  ```json
  {"name": "pass KA-G", "gemini_before": 405, "model": "gemini-nano-banana-2.1",
   "max_new": 665, "max_per_sheet": 4, "only_sheet_names": ["kneel", "battle_kneel"], "void_ok": false,
   "purpose_caps": {"ka_g_pilot": 30, "ka_g_batch": 375, "ka_g_reserve": 135, "ka_g_expiry": 125}}
  ```

| Purpose | Scope | Cap | Unit price | Worst case |
|---|---|---|---|---|
| `ka_g_pilot` | 10 sprites x 3 tries, interactive | 30 | $0.0336 + 1026 x $1.50/M = $0.0351 | **$1.05** |
| `ka_g_batch` | 125 x 3 rounds (round 1 = tranche T + 115), batch | 375 | $0.0168 + 1026 x $0.75/M = $0.0176 | **$6.59** |
| `ka_g_reserve` | the Q3 (iii) try: 10 interactive + 125 batch | 135 | as above | **$2.55** ($0.35 + $2.20) |
| `ka_g_expiry` | 1 round re-sent after an expired job, used only while `void_ok` is false | 125 | batch | **$2.20** |
| **pass KA-G** | | **540** (665 with the expiry allowance) | | **$10.19** ($12.39 with it) |

- **Expected:** pilot about 18 images, batch about 125 + 60 + 25 = 210, reserve about 15, so about 245 images, about
  $4.60.
- **Thinking tokens:** if the first pilot call's `usage_metadata` shows billed thoughts tokens, these figures are
  recounted and shown to the user before the next call (section 2).
- **The guard** (`generate.check_budget`, shared by `kneel_ai.py gen --arm g` and `gemini_batch.py submit`):
  - `budget_consistency` is generalised to "the last closed pass's `gemini_end` == the open pass's `gemini_before` ==
    `attempts_before`". It still enforces 367 for the history, and `selftest_passv.py:57` / `selftest_colossus.py:143`
    are re-pinned to pass V closed at 405.
  - New: `only_sheet_names` refuses any other sheet in pass KA-G; `purpose_caps` counts the attempt rows of the pass
    per `purpose`; per sheet the limit is 4, but the 4th must carry `ka_g_reserve`.
  - **Expiry rows and the per-sheet count (n2):** `attempt` rows with purpose `ka_g_expiry` (the re-send of an expired
    job's keys, and the `reason: duplicate` rows of n3) are **excluded** from the per-sheet count and from the
    "4th must be `ka_g_reserve`" rule. They count only against `ka_g_expiry` (125), `max_new` and the run cap. So an
    expired sprite keeps its 3 tries and its reserve try. `max_per_sheet` stays 4.
  - **`max_paid` (n5):** `submit` passes `max_paid` = n, the round's request count, which must be <= the purpose's
    remaining cap (refused otherwise). Round 1b needs >= 115 remaining in `ka_g_batch`.
  - **Batch rows count:** every request is an `event: attempt` row with `backend: gemini_batch` (not `bedrock`), so the
    run cap and the per-sheet counts include them with no other change.
  - **No crash on the pass loop:** `check_budget` reads `cap["gemini_before"]`, `cap["max_new"]` and
    `cap["max_per_sheet"]` of every open pass (`generate.py:459-462`). Pass KA-G carries all three (405 / 665 / 4),
    and a selftest runs `check_budget` against the real budget.json with a fake request.
  - **Request adapter:** `kneel_ai_req.KneelRequest`, a frozen dataclass with `.character` (the sprite or class id),
    `.sheet` = `SimpleNamespace(name="kneel" | "battle_kneel")`, `.seed`, `.key` (the cache key), `.purpose`, and
    `.cached` (the property `gemini.is_cached(key)`). These are the only attributes `check_budget` reads.
  - **Retry:** `check_budget(..., retry=True)` for every try > 1, which means every round-2 / round-3 / reserve batch
    line and pilot tries 2-3 (the `generate.py:474-479` check refuses a sheet with prior attempts otherwise). The
    authorisation is the user's approval of the pass (the 2026-11-17 pilot ruling, then Q-G2), recorded in section 10.
    Try 1 is `retry=False`, so a duplicate try 1 is refused.
  - **Voided attempts:** an `attempt` row whose key has a later `void` row is left out of every count **only when the
    pass has `void_ok: true`**. That flag is set only after the one-time check of section 10 shows that expired
    requests are not billed. Until then a void row changes no count, and the re-send of an expired round is paid
    from `ka_g_expiry`.
- **Ledger rows** (`cache/ledger.jsonl`, tracked):
  - `attempt` {ts, backend `gemini` | `gemini_batch`, model, character, sheet, seed, key = the cache key, req =
    `<sprite>:<try>`, pass `KA-G`, purpose, round, est_usd}, written **before** the call or the batch create;
  - `batch_submit` {round, n, jsonl sha256, display_name}, written before create;
  - `batch_created` {round, job} after create;
  - `result` {key, ok, error?, usage?} per response;
  - `void` {key, req, job, reason: expired | failed_no_response | not_created} per key of a job that returned
    nothing (`JOB_STATE_EXPIRED`, or `JOB_STATE_FAILED` with 0 responses), or of a `batch_submit` that `--recover`
    finds NOT FOUND;
  - `batch_cancel` {round, job, processed} for a duplicate job cancelled by `--recover`. Its processed count (from the
    job's `batchStats` at cancel) is written as that many `attempt` rows with purpose `ka_g_expiry` and `reason:
    duplicate` (keys from the duplicate's JSONL, in order), so any billed request is counted.

## 6. New tooling (0 paid calls to build)

| File | Change | Limit |
|---|---|---|
| `gen/gemini_batch.py` (new) | `prepare --round R [--dry-run]` (R = 1a, 1b, 2, 3, reserve): one JSONL line per request, `{"key": "<sprite>:<try>", "request": {contents with the 2-3 images as inline_data base64 + text, generation_config as section 2}}`. The images are embedded (about 5 MB per full round: inside the 20 MB inline and 2 GB File API limits), so no per-image upload can expire; only the JSONL is uploaded. Validation: unique keys, the image and text parts, model, config, est cost. `submit --round R --check`: **never calls create**; it runs the guard and the duplicate rules and prints the refusal line or `would submit <n> requests, est $<x.xx>`. `submit --round R --paid`: the same checks, then the rows, the upload and the create, with display name `ka-g-r<R>-<sha8>`. It refuses a round with a recorded `batch_submit` unless `--recover`. `--recover` lists **every** job whose display name starts with `ka-g-r<R>-`. If any is PENDING, RUNNING or SUCCEEDED, it records the earliest as the round's job, cancels the others with `client.batches.cancel` (a `batch_cancel` row each) and never creates. If none is found, it prints `NOT FOUND round <R>`, writes `void` rows (`not_created`) and exits 1. Only an explicit `--recreate` then writes a new `batch_submit` row and creates. `poll --round R`: one line `<job> <state> ok=<n> failed=<batchStats.failedRequestCount>`. `fetch --round R`: download the results JSONL, decode `inline_data`, write the cache PNG, `raw_g_<try>.png` and the `result` rows, then cut + J0 (with the pitch) per sprite. At `JOB_STATE_EXPIRED`, or `FAILED` with 0 responses, it writes one `void` row per key and queues those keys for the next send | <= 250 (`gemini_batch_jobs.py` for the job / recover helpers if it goes over) |
| `gen/kneel_ai.py` | arm `g` (`gen --arm g --try N`); `budget --check` prints the closed Bedrock passes and pass KA-G | +<= 30 |
| `gen/kneel_ai_req.py` | the section 2 Gemini contents and config (shared by `gen` and `gemini_batch.prepare`) | +<= 60 |
| `gen/gemini.py` | `image_size` argument (cache key changed only when it is set); explicit model | +<= 8 |
| `gen/generate.py` | `budget_consistency` generalised; `only_sheet_names`, `purpose_caps` and the reserve-only 4th try in `check_budget` | +<= 25 |
| `gen/budget.json` | pass V closed at 405; pass KA-G; pass KA (Bedrock) into `bedrock_history` | data |
| `gen/selftest_passv.py`, `gen/selftest_colossus.py` | re-pinned: pass V closed at 405; pass C and pass KA in history | +<= 10 |
| `gen/selftest_gemini_batch.py` (new) + 1 line in `selftest.py` | a fake client (files, batches create / get / list / cancel, a results file with one failed line). The cases: rows before create; **a 2nd `submit --paid` of a round is refused without calling create** (the fake counts create calls: 0), and `--check` prints the same refusal; `--recover` with 1 SUCCEEDED job records it with 0 creates; with 2 active jobs it cancels the later one; with none it prints `NOT FOUND` and exits 1; `--recreate` writes a new `batch_submit`; the cap refusals (the 666th image, a 5th try, a 4th without `ka_g_reserve`, a non-kneel sheet, try 2 without `retry`); `check_budget` on the real budget.json does not raise KeyError; a partial failure routed to the next round; **`EXPIRED` with 0 responses writes void rows and re-queues every key**, and the counts are unchanged with `void_ok: false` and reduced with `true`; **the n2 walk**: a sprite whose round-1 job expired is re-sent (`ka_g_expiry`), then fails rounds 2 and 3, then takes its reserve try, and every step is accepted (the per-sheet count reads 1, 2, 3, then the reserve 4th); a cancelled duplicate with processed 3 writes 3 `reason: duplicate` rows; `submit` refuses when n exceeds the purpose's remaining cap; the JSONL schema; an unchanged cache key without `image_size` | <= 250 |

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
# No gate below is a paid command.
# KG3 dry-run JSONL validation before every submit. Expect:
#   "OK round <R>: <n> requests, <n> unique keys, 3 images + 1 text each, model gemini-nano-banana-2.1, 1:1 1K,
#    est $<x.xx>; 0 sent"
python3 -I assets-src/gen/gemini_batch.py prepare --round 1 --dry-run
# KG4 after fetch. Expect "fetched <ok> ok, <f> failed (failedRequestCount <f>), missing 0", with ok + f = n
python3 -I assets-src/gen/gemini_batch.py fetch --round 1
# KG5 selftests: last line "ALL PASSED" (includes selftest_gemini_batch, selftest_passv, selftest_colossus)
python3 -I assets-src/gen/selftest.py
# KG6 (never paid; --check never calls create) after round 1a is submitted.
#   Expect "refused: round 1a already submitted (job <name>, state <STATE>); use --recover"
python3 -I assets-src/gen/gemini_batch.py submit --round 1a --check
# KG8 before every paid submit. Expect "would submit <n> requests, est $<x.xx>" and exit 0
python3 -I assets-src/gen/gemini_batch.py submit --round <R> --check
# KG7 coverage at the end. Expect "monsters ai A, derived 0, alias F (= 123)" and "heroes ai A, derived 0, alias F (= 12)"
python3 -I assets-src/gen/kneel_tools.py coverage
```

Per sprite, as in rev 4: J0 `PASS` before `approve`; J1 `PASS` and `monster_anim.py check <id>` -> `<id>: OK` (heroes:
`puppet_kneel.py check <class>`) before `lock`.

## 8. Risks

| Risk | Mitigation / measure |
|---|---|
| **Identity drift** (Gemini redesigns the character) | 2 references of the approved art; an explicit keep list and counts; the palette snap; J0 A-pal / A-hist / A-adj; J1 A-prop / A-headdup; R1 counts; the pilot gate (>= 7 of 10) before any batch |
| **Batch delay or expiry** (target 24 h, expires at 48 h) | poll with Monitor. An expired job returns no results: `void` rows per key, and every key is re-sent once from `ka_g_expiry` (counted until `void_ok`, section 10). A second expiry of the same keys stops KA-G for a user ruling |
| **Partial batch failures** | `failedRequestCount` and per-line errors go to `result` rows; missing or failed keys go to the next round; KG4 requires ok + failed = n |
| **Non-idempotent create** (duplicate job and cost) | rows before create; a 2nd submit refused, proven by the selftest with the fake client and checked by KG6 `--check`; `--recover` lists every `ka-g-r<R>-*` job, refuses to create while one is active, cancels duplicates, and needs `--recreate` after NOT FOUND |
| **Pixel grid lost** | `detect_pitch` in J0 aligns the window's phase only; the cut stays at k; \|p - k\| / k is an R3 note and in the pilot distribution; a cut at p only on the arm-(d) path |
| **The hurt reference pulls the pose** | not sent on try 1 (m8) |
| **Cost tracking** (batch billing lags) | `est_usd` per row; KG1 after every step; the purpose caps; the run cap of 540 |
| **Image size or aspect** | `aspect_ratio` 1:1 and `image_size` 1K; a non-square output is a J0 `size` fail; a scale off by > 10 % takes the measured path and the J1 A-scale flag |
| **Background key colour** (Gemini paints a gradient, a near-key colour or a halo) | `{bg}` in the text, `{not_bg}` avoid line; the flood mask with `tol` 40; A-grey and A-pieces; white-key sprites as in rev 4 |
| **SynthID watermark** (invisible) | removed by the pixelize down-sample and the palette snap; nothing to do |
| **The pilot misses** | rev 6 before any batch spend; the research brief's runner-up (PixelLab, a new account) needs a user ruling |

## 9. Open questions (each with its default)

1. **Q-G1 Pilot cap:** 30 interactive images plus up to 10 reserve, $1.40 at worst? Default: **yes** (the
   2026-11-17 ruling directs the pilot).
2. **Q-G2 Batch budget:** asked at the pilot review. It is 375 batch images plus 125 reserve, $8.79 at worst, plus the
   expiry allowance of 125 ($2.20), which applies only until the billing check (section 10) clears it. The pass KA-G
   total is 540 images, $10.19 ($12.39 with the allowance). Default: **approve after the pilot**.
3. **Q-G3 Model escalation:** retry a failing sprite on `gemini-3-pro-image` ($0.134 + thinking), as the research
   brief suggests? Default: **no**; stay on `gemini-nano-banana-2.1` as ruled.

## 10. Rulings log

| Date | Item | Ruling |
|---|---|---|
| 2026-11-17 | U0 (Q1-Q4, prices) | as in rev 4 (`4ade849`); Q2, Q3 (iii) and Q4 stay in force |
| 2026-11-17 | KA1-P | the Stability probe (54 calls) was rejected by the user: "vastly different than the reference images" |
| 2026-11-17 | rev 5 | Gemini `gemini-nano-banana-2.1`: 10 pilot sprites interactive, the rest through the Batch API (user) |
| 2026-11-17 | rev 6 | momus review of rev 5 resolved (table at the top). Pilot: ghost out, garland and rhyos in; tranche T in round 1a |
| 2026-11-17 | rev 7 | momus review of rev 6 resolved (n1-n5); momus: OKAY with n1 and n2 fixed |
| (open) | expired-batch billing | **one-time check, before relying on void rows:** read the Batch API docs and billing FAQ, and, after the first fetched job, the Cloud billing report. If expired requests are documented or observed as not billed, set `void_ok: true` and lower `cap` / `max_new` to 540 (`ka_g_expiry` 0); record the source here. Otherwise keep the allowance |
| (open) | retry authorisation | tries 2-3 and the reserve try use `retry=True` under the user's pass approval: the pilot (2026-11-17 ruling) and the batch (Q-G2 at the pilot review) |

## TODOs

- [ ] KA-G0 tooling: `gemini_batch.py`, arm `g`, `gemini.py` `image_size`, the guard changes, budget.json pass KA-G and the history moves, selftests; KG1, KG3 (on a pilot sprite) and KG5 green; 0 calls (high, 6h)
- [ ] KA-G0b expired-batch billing check (docs and FAQ; the billing report after the first job); `void_ok` decision logged (low, 0.5h)
- [ ] KA-G1 pilot: 10 sprites x <= 3 tries, interactive; J0, review, approve, marking, J1, lock; pilot sheet, GIFs, screenshots (high, 8h)
- [ ] U1-G: user review of the pilot and the Q-G2 budget (blocking)
- [ ] KA-G2 round 1a (tranche T, 10), fetch, J0 / review; then round 1b (115), fetch, J0 / review / approve, rig work by group (medium, about 2 days including the batch wait)
- [ ] KA-G2 rounds 2-3 and the reserve, then the alias for the rest (medium, 1 day)
- [ ] KA4: the rev-4 play test, the 135-key contact sheet for the user, docs, final gates (high, 6h)

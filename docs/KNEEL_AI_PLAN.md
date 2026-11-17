# AI kneel keyframe plan (pass KA), rev 4

Status: rev 4, a plan only. It answers the text-only momus rejection of rev 3; the direction is unchanged. Nothing is
implemented. No paid or AI call was made to write it; the Bedrock facts in section 1 come from read-only listing calls.

**User directive (2026-11-17):** "Use an AI image generation model to build the 'kneeling' frame for each sprite, and
then use the rigging to let the sprites move between the two. The current approach of using rigging to move the
sprites wastes a ton of compute and doesn't produce good results. Use one or more of the Stability AI models to
transform each sprite into a 'kneeling, head down' pose."

**Rev 4 changes (momus review of rev 3; text fixes):**

| # | Finding | Resolution |
|---|---|---|
| r4-1 (P1) | The cut window was undefined: `pixelize` block-averages its whole input into `grid` (`pixelize.py:187-188`), so a non-square cell scaled unevenly, and steps 2 and 4 read as two scalings | `kneel_ai_guide.py` writes the guide window `{x0, y0, k*w, k*h}` into the guide json. Measurement, the width shrink and a <= 2 px height correction are one uniform scale on the full canvas. Then the window is cropped and `pixelize` is called once at `grid=(w, h)`, with no earlier resample. Arm (d) gets a k_d*w x k_d*h window on its figure base after its scale s. A **round-trip selftest** (idle x k -> guide placement -> cut, >= 99 % equal pixels) runs at 80x80, 110x80, 218x128 and hero cells (D-KA6) |
| r4-2 (P1) | The head-colour region is not a head (cobra 73 px against a 23 px head part; rhyos 84 against 77) | A-scale moves to **J1**, measured on the marked head part (its bone, or the `part:label` mask polygon for a sub-part head). J0 keeps only a loose figure-area ratio (A-area), calibrated on idle-vs-hurt pairs and reported against the band. Arm (d) is scaled from figure height and the band midpoint and flagged for J1 A-scale |
| r4-3 (P2) | K-height with a fixed k: white_mage's 3 px band (55-58) would fail every time | One uniform correction of up to 2 px inside the tolerance before K-height (D-KA6.4). The KNEEL_PLAN 4 per-class band override (section 13 entry) stays the route for a band that is systematically too narrow |
| r4-4 (P3) | Calibration included non-approved hurts; the pixelize outline ring doubles an AI outline | Calibration excludes chimera and black_widow (FW-Q aliases), hollow_seraph (FW-H `hurt_from`) and any painted or offset `kf:hurt`; the list is pinned. A one-pass outline peel (D-KA6.6); A-outline also checks the thickness against the idle; K-height allows 1 px for any ring left; a doubled-ring fixture |

**Rev 3 changes (momus review of rev 2):**

| # | Finding | Resolution |
|---|---|---|
| r3-1 (P1) | The joint-based gates ran before any joints existed | The gates are split into two groups (section 6). **Group J0 (joint-free, before approval):** A-pal, A-grey, A-hist, A-adj, A-outline, A-pieces, A-base, A-scale, A-width, K-ground, K-height, plus the R1 counts. **Group J1 (after marking, before lock):** A-prop, A-headdup, A-head. A J1 failure archives the key and sends the sprite to its next try. The probe shows J0 only |
| r3-2 (P1) | The `monster.cut` call was wrong: `cell` is the output height and minimum width; the cutter widens itself (`monster.py:702`); the standing band scales kneels up (`:601`) and `match` stair-steps them back | **`monster.cut` is not used for the kneel key.** Cut: a key-colour flood mask at full resolution, then `pixelize.pixelize(cell, mask, grid=(idle w, idle h), palette=<ndarray>, bottom_row=<foot row>)` at the known k (D-KA6). A selftest pins the output size to the idle's `grid` for 80x80, 110x80, 218x128 and the hero 80x80 |
| r3-3 (P1) | Prop and head parts are not defined per rig: 10 rigs have `kind: prop`, 56 have weapon-named parts, and goblin has both `weapon` and a `dagger` prop; rhyos has lizard, ram_n and ram_f plus a lion head | Explicit `kneel_ai.yaml` entries `sprites.<id>.{weapons: [parts], heads: [parts]}`, written at KA0b by `kneel_ai.py bodies --write` and reviewed. A selftest checks that every rig with a `kind: prop` part or a weapon-named part has a `weapons` entry, and that every rig has a `heads` entry (`[]` only with a `heads_none:` reason). The prompt counts use these lists |
| r3-4 (P1) | "Never widen" would visibly shrink full-width idles (quadrupeds: median 85 % of the cell width, up to 97 %; arthropods 85-92 %) | The quadruped and arthropod prompts ask for a compact pose. **A-scale:** the reference part (the head-colour region) is within +-10 % of the idle's height. **A-width:** at most an 8 % shrink to fit; more is a FAIL and a retry with the compact wording, then the Q3 ruling. The width-limited ids are listed at U1-KA |
| r3-5 (P2) | Every key was forced to the band midpoint | Arms (a), (b) and (c) have a known k: downscale by k, with the band as a check only. Arm (d) is scaled so its head-colour region matches the idle's height (D-KA6) |
| r3-6 (P2) | Arm (b) confounded seed and setting | (b) uses `change_strength` 0.85 with both seeds. New arm **(b2)**, seed 1234 only: `style_strength` 0.6, to show the effect of `style_strength` (D-KA4). The probe has 55 calls |
| r3-7 (P2) | The 15 agent-min per sprite was unmeasured (hurt keys average 18.5 joints and 2.4 mask polygons) | Marking minutes per sprite are logged; the **median** is reported at the pilot. **Stop rule:** a pilot median above 30 min stops KA for a rev before stage 2. The agent-hours (about 34 h marking + about 19 h review) enter the comparison with pass K (section 7) |
| r3-8 (P2) | The A-prop IoU and the 0.15 outside share were guesses | Both are calibrated on the approved hurt keys (their marked joints), like T_hist / T_adj: T_prop_iou = 5th percentile, T_outside = 95th percentile; the same for heads |
| r3-9 (P3) | Reserve sizing; the price check | The reserve is **20 x c**. The price confirmation of every used model is part of the KA0b hard stop |
| r3-10 (P3) | Request settings | `style_strength` 1.0 is unverified; (b2) shows it. `style_preset: pixel-art` on Control Sketch (c1) and Style Guide (d). `aspect_ratio` is dropped from Style Guide |
| r3-11 (P3) | Gates and prompts | G1b skips an empty `$IDS`, and the new G1h runs heroes through `puppet_kneel.py check`. Floaters: the foot row is the idle's lowest opaque row. White-key sprites: `{bg}` drives the style suffix, the negative and the cut mask. Q1 notes that arm (a) spends 10 of the 55 probe calls (about $0.80) on the rejected baseline |

**Rev 2 changes (momus review of rev 1):**

| # | Finding | Resolution |
|---|---|---|
| 1 (P0) | Every arm started from the rejected derived pose; A-agree rewarded keeping it | The guide carries **pose only**: a flat silhouette or a thick-limbed skeleton drawn from template joints, never warped pixels (D-KA1). Identity comes from the approved idle as a **reference image** plus the offline palette lock. A-agree is now report-only. New review item **R2b** ("visibly not the derived kneel, side by side") and a reported silhouette IoU against the derived key (section 6) |
| 2 (P0) | The probe could not tell the techniques apart | New arms: (a) a derived-guide img2img **baseline control only**, (b) Style Transfer from the silhouette, (c) Sketch or Structure from the skeleton, then Style Transfer, (d) Style Guide. 2 seeds per arm on 5 sprites = **50 calls**. The **user** picks from `probe_sheet.png`; the machine scores are shown, not decisive (section 3) |
| 3 (P1) | "img2img <= 0.55 keeps identity" was unsupported | Labelled a **hypothesis**. The 2026-11-13 test at 0.35 / 0.55 was rejected, and arm (a) exists only to measure it |
| 4 (P1) | F1 made the rejected derived kneel an end state | Q3 asks the user: keep derived, alias to daze, or regenerate. The default is regenerate once, then alias (not F1). A derived kneel stays live only until its AI key lands (D-KA14) |
| 5 (P1) | Colour counts cannot catch duplicated weapons or heads | A-prop / A-headdup: prop and head part IoU after the joints, plus a cap on prop and head colour pixels outside the fitted parts. R1 states counts (weapons, hands, heads, key / idle). Fixtures: rhyos 4 heads (ACT1_LOG R271 / R274) and extra hands and weapons (the KNEEL_PLAN 13 R3 variant-B failure) |
| 6 (P1) | A +-4 px / +-10 deg fit fails once the pose really changes | Joints are **hand-marked** from `monster_anim.py mark` as the hurt keys were, about 15 min per sprite. The fit is only a first guess, with an IoU floor below which a part is hand-marked. Fit time is measured on goblin at KA0b (D-KA7) |
| 7 (P1) | Moving budget.json to pass KA breaks `selftest_colossus.py:135-141` (`_pinned`) and `selftest_colossus_up.py:59` | Both are added to the file table; they read pass C from `bedrock_history` |
| 8 (P2) | The cut pipeline was mis-specified | The exact call is `monster.cut(raw, band, n_cells=1, cell=<idle w>, foot_row=<idle bottom_row>, match=(ref, tol))`, then a palette snap with `palette` as an `ndarray`. A full-resolution pre-scale keeps `match` (nearest, stair-steps, `monster.py:570-576`) from firing. Width rule: the cell is never widened; a too-wide figure is shrunk at full resolution, with 0 page impact (D-KA6) |
| 9 (P2) | Floaters sank twice | No sink in the guide. The floater key's lowest row = the idle's lowest row; the runtime `kneelSink` (D-K9) is the only drop (D-KA6) |
| 10 (P2) | R4 (the GIF) cannot be scored at the probe | The probe scores R1, R2, R2b, R3 and R5. R4 is scored from the pilot on |
| 11 (P2) | G3 contradicted itself | `coverage` prints `monsters ai A, derived D, alias F (= 123)` and `heroes ai A, derived D, alias F (= 12)` |
| 12 (P2) | Gate compute was missing | Batch merges check only the changed ids; `check --all` runs once at KA4. Totals in section 7 |
| 13 (P2) | `approve.py overwrite_gate` (:50-55) covers only `monster_*` / `boss_*` | One approve path: `kneel_ai.py approve` calls `approve.py`, whose gate is extended to `kneel` and `battle_kneel` |
| 14 (P3) | The variant palette lock includes the key itself | Noted (`monster_atlas.py:154-161` builds `allowed` from every key and checks only non-keys). The allowed set now leaves out `kneel`, and the recoloured kneel key is checked |
| 15 (P3) | Branch list incomplete | All 11 kneel branches are listed. Only the 3 unmerged ones get tags (section 5) |
| 16 (P3) | `\|` in table commands | The gate commands are in a code block |
| 17 (P3) | The prompt background was fixed | The prompt says `{bg}` = the guide's key colour, magenta or white |
| 18 (P3) | Images per probe sprite; Style Transfer price | At most 10 images per probe sprite. Every model's price is confirmed before KA1-P, a hard stop in the KA0b exit criteria |

## 0. Summary

Pass K (docs/KNEEL_PLAN.md) derives the `kneel` key by warping the idle, and the user rejected that look. Pass KA
replaces it with an **AI-made, approved `kneel` keyframe** for every sprite: 123 monster sheets and 12 hero classes.
The Chaos colossus forms F2-F4 are exempt (D-K12); Chaos F1 is included.

- **The model poses the figure.** The guide carries only the pose: a flat silhouette or a thick-limbed skeleton,
  drawn from the kneel template's joint targets.
- **Identity** comes from the approved idle, sent as the reference image, and from the offline lock to the approved
  palette.
- **After approval:** the existing in-between machinery makes `kneel_in1` and `kneel_in2` between `idle` and the
  approved key, like `idle -> hurt`. Joints on the key are hand-marked. `kneel_b` is a 1 px breath.
- **What stays the same:** the frame names, the TS runtime (`src/` untouched), the timing and the atlas cell count.
- **Order:**
  1. KA0b: tooling and price confirmation, 0 calls.
  2. KA1-P: a 5-arm probe, 55 calls, and **the user picks the arm**.
  3. KA1: a pilot of 6 sprites, then **U1-KA**, the user's review.
  4. KA2 / KA3: rollout batches.
  5. KA4: integration.
- **Budget**, in two stages, both for the user to approve:
  - Stage 1 (probe and pilot): <= 91 requests, about $7.28 at worst.
  - Stage 2 (rollout): sized by the picked arm. At 1 call per try it is <= 407 requests (about $33); at 2 calls per
    try, <= 814 (about $65).
  - 0 Gemini.

## 1. Verified facts (2026-11-17, mainline 24c4236)

| Fact | Evidence |
|---|---|
| Stability on Bedrock, us-west-2, ON_DEMAND: `stability.sd3-5-large-v1:0`, `stability.stable-image-core-v1:1`, `stability.stable-image-ultra-v1:1` | `aws bedrock list-foundation-models --profile bedrock --region us-west-2 --by-provider stability` (read-only) |
| Inference profiles (us-west-2 and us-east-1, all ACTIVE), each `us.stability.` + `stable-image-control-structure-v1:0`, `stable-image-control-sketch-v1:0`, `stable-image-style-guide-v1:0`, `stable-style-transfer-v1:0`, `stable-image-inpaint-v1:0`, `stable-image-erase-object-v1:0`, `stable-image-search-replace-v1:0`, `stable-image-search-recolor-v1:0`, `stable-image-remove-background-v1:0`, `stable-outpaint-v1:0`, plus the conservative / creative / fast upscalers | `aws bedrock list-inference-profiles --profile bedrock --region us-west-2` (read-only) |
| `bedrock.py MODELS` lacks `style_transfer`, `control_sketch`, `search_recolor` and `erase_object`; `COST_USD` has no estimate for them | `assets-src/gen/bedrock.py:39-58` |
| The `bedrock` profile is the Admin role, allowed for image `InvokeModel` and read-only listing only | `aws sts get-caller-identity --profile bedrock`; ROSTER_LOG pass C ruling 2026-11-16 |
| The gate inside `bedrock.invoke` refuses an uncached call without `paid=True`, from a linked worktree, for a purpose outside `per_purpose_caps`, or past a cap. It writes a ledger row before the first try | `bedrock.py:126-170` |
| BR ledger: 25 pass-C requests of 80 | `cache/bedrock_ledger.jsonl` |
| Tests that pin pass C: `selftest_colossus._pinned` (pass, cap, caps, gemini_before, reserve_max_usd) and `selftest_colossus_up.py:59` (`rim_upscale` cap) | `selftest_colossus.py:135-141`; `selftest_colossus_up.py:55-60` |
| **The 2026-11-13 test that was rejected:** 7 attempts on the **knight**, all on whole multi-pose sheets: `structure` x2, `sd35` img2img x3 (0.35 and 0.55), `inpaint` x2. The images are no longer cached | `cache/ledger.jsonl` (7 `backend: bedrock` rows) |
| Pass C edits: `structure` ignored most of the layout and went 3D (C3, C5, C17). `search_replace` is local when it matches (C6, C9), but sometimes rebuilds the figure or bleaches it grey (C10, C14, C15) | ROSTER_LOG C3-C17 |
| Core takes text only, so it cannot hold an approved identity. It stays the direction for new sprites | Stability API (no `image` parameter) |
| Known AI duplication failures: rhyos generated with 4 heads (R271, R273) and a 4th head popping into action cells (R272); hero variant B rejected for extra hands and weapons | `docs/ACT1_LOG.md:446-449`; KNEEL_PLAN 13 (R3) |
| Kneel coverage: `monsters 31/123, heroes 12/12` | `python3 -I assets-src/gen/kneel_tools.py coverage` |
| **Kneel branches**, commits ahead of mainline: `kneel-k1-hero` 0, `kneel-k1-py` 0, `kneel-k1-ts` 0, `kneel-k2-0` 0, `kneel-k2-0b` 0, `kneel-k2-b` 0, `kneel-k2-d` 0, `kneel-k2-e` 0; **unmerged:** `kneel-k2-a` 11 (22 rigs, 4 locked), `kneel-k2-c` 18 (20 rigs, 0 locked), `kneel-k3-0` 3 (8 rigs locked, plus 9 shared files: `kneel_bodies`, `kneel_cut`, `kneel_post`, `kneel_warp`, template and check changes) | `git rev-list --count mainline..<b>` |
| Templates on mainline: biped, quadruped, mechanical. The other bodies are only on `kneel-k3-0` | `kneel_templates.py:71` |
| Rig bodies: biped 49, quadruped 28, floating 14, serpent 8, arthropod 7, bird 5, naga 5, blob 4, rooted 2, swimmer 1 (= 123). Mechanical: iron_golem, soldier, warmech (bipeds), guardian (quadruped) | `body:` in `anim/monsters/*.yaml` |
| Monster cells are not square: 80 high, 80-122 wide; 128 high, 128-218 wide | `grid` in `approved/*/monster_*.json` |
| `monster.cut(raw, band, floating, colors, seed, n_cells=3, cell=None, foot_row=None, haze, split, keep_pieces, top_margin, match=None)` does not fit the kneel key: `cell` is the output height and the minimum width; it widens the cell itself (`cw = max(c, width + 4)`, `:702`); the standing band scales a short figure up (`f = lo / tallest`, `:601`); `match` scales nearest-neighbour after pixelizing (stair-steps, `:570-576`); it has no palette argument. `pixelize.pixelize(cell, guide_mask, grid, ..., bottom_row, palette: np.ndarray \| None)` does | `monster.py:558-702`; `pixelize.py:164-167` |
| Prop and head parts: 10 rigs have a `kind: prop` part; 56 have a weapon-named part (`weapon`, `sword`, `axe`, ...); goblin has both `weapon` (`remove: true`) and a `dagger` prop. Head parts have no common name (rhyos: `lizard`, `ram_n`, `ram_f` and a lion head inside `body`) | `grep` over `anim/monsters/*.yaml`; `rhyos.yaml` parts |
| Quadruped idles fill a median 85 % of their cell width (up to 97 %); arthropods 85-92 % | momus measurement of rev 2, to be re-measured by `kneel_ai.py bodies` at KA0b |
| `approve.overwrite_gate` returns early unless the sheet name starts with `monster_` or `boss_` | `approve.py:50-55` |
| Variant palette lock: `allowed` is built from every key's recoloured pixels, and only non-keys are checked. `monsters.yaml` has 0 `variants` today | `monster_atlas.py:154-161` |
| `lockdiff --relock <ids>` accepts changed kneel entries of the listed ids (`KNEEL_LOCK` = `kf:kneel`, `kneel_in1`, `kneel_in2`, `kneel_b`; heroes: the 4 frame names) | `kneel_tools.py:27-73` |
| Cost of one check: `monster_anim.py check goblin` and `check wolf` each take 83 s of CPU (1 thread). So `check --all` is about 123 x 83 s = **2.8 CPU-h** | `/usr/bin/time -p` with `OMP/OPENBLAS/MKL_NUM_THREADS=1` |
| Pass K time spent: K1 was committed at 00:43 and K2-C iteration 2 at 09:43 on 2026-11-17, so about 9 h of wall clock for 43 of 135 locked, plus the CPU hours of parameter search the user reported | `git log` |

## 2. Answering the 2026-11-13 failures

| Failure | What was asked then | Technique in KA | Check |
|---|---|---|---|
| **No identity lock to a reference** | A new pose from edges or text alone | The approved idle is passed as a **reference image**: `style_image` in Style Transfer, `image` in Style Guide. The palette is snapped offline to the approved palette, so no new colour can survive | A-pal, A-hist, A-adj, A-prop, A-headdup; R1 with counts |
| **img2img redraws the whole figure** | Img2img asked to change the pose | Img2img is no longer a candidate technique; it is only control arm (a). In the candidate arms the model is **meant** to draw the figure anew: the pose comes from a pose-only guide, and identity is judged against the reference and checks, not by pixel agreement with a guide | A-agree is report-only; R1 |
| **Inpainting comes back grey** | A masked edit of a whole sheet (cause not recorded) | Not used. No arm sends alpha; every input is opaque on a flat key | A-grey <= 3 % (it also catches a grey silhouette left unpainted in arm (b)) |

**Hypothesis H1** (it was rev 1's primary, and is now unproven): img2img at <= 0.55 from a derived guide keeps
identity. The only test of it, on 2026-11-13, was rejected, and in any case the derived pose is the look the user
rejected. Arm (a) measures H1 as a baseline and **cannot be picked** for the rollout.

## 3. Technique and probe (D-KA1 to D-KA4)

- **D-KA1 Pose guides** (`kneel_ai_guide.py`; 0 calls, no per-sprite tuning, no source pixels). They are built from
  the kneel joint targets: `kneel_templates.targets` on the idle joints for biped, quadruped and mechanical, and for
  the other bodies the idle joints mapped by the KNEEL_PLAN 4 band op (for example blob sx 1.12, sy 0.80; serpent rows
  above the ground at sy 0.60). Two forms are drawn:
  - **G-sil:** every rig part drawn as a filled capsule along its bone, at the rig part's `radius`, scaled by the
    idle's measured limb thickness. The head is a disc, a prop is a 2-native-px bar along its bone, and everything is
    one flat mid-grey (`#808080`) on the key.
  - **G-skel:** the same capsules as a black outline on the key, for Sketch or Structure.

  The derived kneel's pixels are never used, except by the control arm (a).
  - Canvas: upscale by k = floor(1024 / max(cell w, h)), nearest neighbour, centred on a 1024x1024 flat key with the
    ground row at its upscaled row.
  - Key: `#FF00FF`, or `#FFFFFF` when the sprite's palette has a colour within dE76 30 of magenta.
  - Floaters and swimmers get **no sink** in the guide (D-KA6).
- **D-KA2 Reference image:** the approved idle (heroes: `ready`), upscaled by the same k onto the same key.
- **D-KA3 Prompt:** section 5b. `{bg}` names the key colour ("plain flat magenta background" or "... white ...").
- **D-KA4 Arms** (request bodies follow the Stability API names; `selftest_kneel_ai.py` pins the body keys):

| Arm | Calls per image | Request |
|---|---|---|
| **(a) control** | 1 | sd35 `mode: image-to-image`, `image` = the **derived** kneel (mainline; cobra and green_slime rendered read-only from the `kneel-k3-0` tag), `strength` 0.40. Baseline only, never pickable |
| **(b)** | 1 | `style_transfer`: `init_image` = G-sil, `style_image` = reference, `change_strength` 0.85 (both seeds), `style_strength` 1.0, `composition_fidelity` 0.5, prompt + negative |
| **(b2)** | 1 | as (b), but `style_strength` 0.6; seed 1234 only. It shows the effect of `style_strength`, since 1.0 is unverified |
| **(c) hybrid** | 2 | (c1) `control_sketch` on G-skel, `control_strength` 0.7, `style_preset: pixel-art`, prompt + negative; then (c2) `style_transfer` with `init_image` = c1's output, `style_image` = reference, `change_strength` 0.4, `composition_fidelity` 0.9. If KA0b finds Sketch unpriced or failing, Structure replaces it, recorded |
| **(d)** | 1 | `style_guide`: `image` = reference, `fidelity` 0.7, `style_preset: pixel-art`, prompt = subject + pose text (no pose image) + negative; no `aspect_ratio` |

All other parameters are left at the API defaults. Each arm keeps one setting for both seeds, so seed and setting are
never confounded.

**KA1-P probe (purpose `ka_probe`, 55 calls).**

- **Sprites:** goblin (biped with a prop), wolf (quadruped), white_mage (robed hero), cobra (serpent) and
  green_slime (blob).
- **Calls:** 2 seeds (1234, 1235) x (a 1 + b 1 + c 2 + d 1), plus (b2) x 1 = **11 calls per sprite at most**, x 5 = 55.
  Arm (a), the rejected baseline, spends 10 of them (about $0.80).
- **Machine score:** for each output, after D-KA6, the **J0** checks of section 6 (no joints exist at the probe), plus
  the review agent's R1 (with counts), R2, R2b, R3 and R5. R4 is not scored: there is no in-between yet.
- **`probe_sheet.png` goes to the user before any pick.** Rows are the sprites; the columns are idle, derived kneel,
  G-sil, then (a), (b), (c), (d) x 2 seeds, and (b2), at native x4. The J0 and review verdicts, the A-area and
  A-width values and the IoU against the derived kneel are printed under each image.
- **Pick rule:**
  1. The **user** names the primary arm and the fallback arm from (b), (b2), (c) and (d), and may fix the per-arm
     settings (for example (b) with (b2)'s `style_strength`).
  2. The orchestrator's proposal on the sheet is the arm with the most sprites at "all J0 checks plus R1 / R2 / R2b /
     R3 / R5 pass" on at least one seed, with a tie going to the fewer calls per image. It is advice only.
  3. If the user picks no arm, or no arm passes on >= 3 of 5 sprites and the user does not override, KA stops and
     goes to a new rev. No pilot calls are made.
- **Try schedule after the pick** (deterministic, never a sweep):
  - try 1: the primary arm, seed 1234;
  - try 2: the primary arm, seed 1235, with the one setting the user fixed for retries (default: +0.1
    `change_strength` for a pose fail, -0.1 for an identity fail; the compact wording of section 5b for an A-width
    fail);
  - try 3: the fallback arm, seed 1236.

  A prompt changes only through `gen/kneel_ai.yaml` `sprites.<id>.{extra, negative_extra}`, and only for a reason the
  reviewer or a J0 / J1 check named. Scale is never a reason to retry: the known k or the reference part fixes it
  (D-KA6). A-width and K-height failures are **pose** failures (the figure is not compact or not low enough).

## 4. Asset model and code changes

- **D-KA5 The AI kneel is an approved key** (generate -> cut -> J0 gates -> review -> approve -> marking -> J1 gates
  -> lock).
  - **A J1 failure** (A-prop, A-headdup, A-head) archives the key with `retire_kneel.py --key <id>` to
    `approved/_retired/<id>_kneel_try<N>/`, which also satisfies the overwrite gate, and sends the sprite to its next
    try. After try 3, the Q3 ruling applies.
  - Monsters and bosses: `approved/<id>/kneel.png` + `kneel.json`, one cell of the idle's exact `grid` (w, h). The
    name is outside the `monster_*` and `boss_*` loaders, so the approved file alone changes nothing.
  - Heroes: `approved/<class>/battle_kneel.png` + `.json`, one 80x80 cell facing left.
  - The json records: arm, model ids, seeds, settings, guide hash, BR cache keys, try, `approved` date.
  - **One approve path:** `kneel_ai.py approve` calls `approve.py`. Its `overwrite_gate` now also gates `kneel` and
    `battle_kneel`: an overwrite needs identical bytes or an archive copy.
- **D-KA6 Cut** (`kneel_ai_cut.py`, offline). **`monster.cut` is not used**: it widens cells (`:702`), applies the
  standing band (`:601`) and stair-steps through `match` (`:570-576`).
  1. **Mask:** flood the key colour from the border at full resolution with `pixelize.flood_bg(rgb, tol)` (`tol` 40).
     The key is `{bg}`, so white-key sprites flood white. Keep the largest component, plus pieces inside its bounding
     box (the `_figure_mask` rule), and `keep_pieces: all_in_cell` sprites keep every piece.
  2. **The cut window, one scaling only.** `pixelize` block-averages its whole input into `grid`
     (`pixelize.py:187-188`: `by, bx = h / gh, w / gw`). So the input must be **exactly k*w x k*h** for an even scale:
     a full 1024x1024 canvas into a 110x80 grid would scale 1024/110 across and 1024/80 down.
     - Arms (a), (b), (b2), (c): `kneel_ai_guide.py` writes the guide window `{x0, y0, w: k*w, h: k*h, k}` (the
       cell's place on the canvas, ground row included) into the guide json. The cut reads it from there.
     - Arm (d), which has no guide: measure the raw figure height H on the full canvas. Then s = (band midpoint x idle
       height x k_d) / H, with k_d = floor(1024 / max(w, h)): one uniform Lanczos scale of the whole canvas by s. The
       window is k_d*w x k_d*h, placed with its foot row on the figure's base row and its centre x on the base
       centroid. These keys are **flagged** for the J1 A-scale check (section 6).
  3. **Width rule (on the full canvas, before the crop):** measure the figure's width on the canvas. If it is more
     than (w - 2) x k, shrink the whole canvas uniformly about the base centre by at most **8 %**, at full resolution.
     Over 8 % is an **A-width FAIL**: the pose is too wide, so the sprite retries with the compact wording. The cell is
     never widened, so atlas rects, anchors and pages stay as they are (page impact 0). Every shrunk id is listed as
     `width-limited` with its shrink % and shown at U1-KA.
  4. **Height correction (inside the tolerance only):** if the figure height on the canvas puts the native height up
     to **2 px** outside the band (heroes: the class band, for example white_mage's 3 px band of 55-58), shrink or grow
     the canvas uniformly about the base by that amount, once. More than 2 px outside is a K-height pose fail. A
     per-class band override (KNEEL_PLAN 4, logged in section 13) stays the route for a band that is systematically
     too narrow.
  5. **Crop the window, then pixelize once:** `pixelize.pixelize(window, mask_window, grid=(w, h),
     palette=<ndarray>, bottom_row=<foot row>)`, with **no earlier resample** (steps 2-4 are at most one combined
     uniform canvas scale, done before the crop). The ndarray is N x 3 uint8 from `monster_keys.approved_palette`
     (heroes: `battle.png`'s colours), so every pixel is an approved colour.
  6. **Outline peel:** `pixelize` adds a 1 px outline ring (`pixelize.py:216-221`), so an AI output that already has a
     black outline ends up 2 px thick and up to 2 px taller. Where the outer boundary pixel and the pixel inside it
     are both the outline colour, and the idle's outline at that boundary is 1 px, the outer pixel is removed (one
     pass). A-outline then checks the thickness (section 6).
  7. **Placement (the foot row):**
     - grounded: the foot row is the idle's `bottom_row`, and the base centroid x sits on the idle's;
     - floaters and swimmers: the foot row is **the idle's lowest opaque row**, and the figure centroid x sits on the
       idle's. The guide has no sink; the only drop is the runtime `kneelSink` (D-K9).
  8. **Round-trip selftest** (replaces the size-only test). For idle cells of 80x80, 110x80, 218x128 and the hero
     80x80 (ready): upscale the idle by k with nearest neighbour, place it on the canvas the way the guide is placed,
     run steps 1-7 with the guide window, and require **>= 99 %** of the cell's pixels (colour and alpha) to equal the
     idle's. The output size is the idle's `grid`. The floater foot row is pinned the same way.
- **D-KA7 Joints on the key: hand-marked** (as the approved hurt keys were).
  1. First guess (`kneel_ai_joints.py`): the template targets, then a one-pass per-part fit (dx, dy in [-4, 4];
     dtheta in {-10, -5, 0, 5, 10}).
  2. **IoU floor:** a part whose fitted alpha IoU is < 0.60 has its guess dropped, and the joints are marked by
     hand. If the mean IoU is < 0.75, the whole key is marked by hand.
  3. The rig agent marks from `python3 -I assets-src/gen/monster_anim.py mark <id>` (heroes: `puppet_kneel.py review
     <class>`). It writes `keyframes.kneel` and any `masks.<part>.kneel` polygons, re-renders `mark`, and repeats
     until every joint sits on its part.
  - **Time (unmeasured estimate):** about 15 agent-min per sprite (about 34 agent-hours for 135, about 17 h of wall
    clock with 2 rig agents), plus <= 30 s of CPU for the fit. Approved hurt keys average 18.5 joints and 2.4 mask
    polygons, and kneels should need more.
    - KA0b measures the fit on goblin; above 30 s the search is narrowed, recorded in section 13.
    - The pilot logs marking minutes per sprite and reports the **median**. **Stop rule:** a pilot median over **30
      min** stops KA for a rev before stage 2.
- **D-KA8 In-betweens** (existing machinery and rules):
  - `kneel_in1` is idle toward kneel at t 0.33; `kneel_in2` is kneel toward idle at t 0.33; `kneel_b` is the breath op
    on the key.
  - The rules are D-K5 and D-K19: |u| <= 0.35, and limb parts <= 40 deg against their source. `frames.kneel_in*.tweaks`
    are allowed.
- **D-KA9 One switch per sprite:** the rig block `kneel: {source: ai, sink?, paint?}`.
  - `source: derived`, the default for existing blocks, keeps today's path byte-identical.
  - With `source: ai`, the derived-only keys are refused.
  - FW-P `paint` is allowed (<= 160 px, approved palette or null).
  - The key is locked as **`kf:kneel`**, so the lock's name set is unchanged.
- **D-KA10 Derived path: frozen behind the switch.** It is not removed while any sprite has `source: derived` (G15).
  Removal is proposed at KA4 if `derived 0`.

| File | Change | Limit |
|---|---|---|
| `gen/bedrock.py` | MODELS + `style_transfer`, `control_sketch`, `search_recolor`, `erase_object`; `COST_USD` for every used model from the pricing page (KA0b) | +8 |
| `gen/budget.json` | `bedrock` -> pass `KA` stage 1 (after Q1); pass C moved to `bedrock_history` (doc only) | data |
| `gen/colossus.py` budget check | reads pass C from `bedrock_history` when the live pass is not C | +<= 10 |
| `gen/selftest_colossus.py` `_pinned` (:135-141) | the pass-C pins read `bedrock_history[pass == "C"]` | +<= 6 |
| `gen/selftest_colossus_up.py` (:59) | `rim_upscale` read from pass C in `bedrock_history` | +<= 3 |
| `gen/kneel_ai.py` (new) | CLI: `guide`, `gen <id> --arm A --seed N [--paid]` (one call, or 2 for (c), per command), `cut`, `gate`, `joints`, `review`, `approve`, `converted [--check-archive]`, `bodies`, `calibrate`, `budget --check` | <= 250 |
| `gen/kneel_ai_guide.py` (new) | D-KA1 / D-KA2; writes the guide json with the window `{x0, y0, w, h, k}` (D-KA6.2) | <= 200 |
| `gen/kneel_ai_cut.py` (new) | D-KA6 | <= 150 |
| `gen/kneel_ai_gates.py` (new) | section 6 A-checks | <= 220 |
| `gen/kneel_ai_joints.py` (new) | D-KA7 first guess and IoU | <= 150 |
| `gen/kneel_ai.yaml`, `gen/kneel_ai_thresholds.json` (new) | prompts, arm settings, overrides, and per sprite `sprites.<id>.{weapons: [parts], heads: [parts], heads_none?: reason}` (written by `kneel_ai.py bodies --write` at KA0b, then reviewed; for example `rhyos: {heads: [lizard, ram_n, ram_f, body:lion]}`, where `part:label` marks a head drawn inside a larger part, located by a mask polygon); calibrated thresholds | data |
| `gen/kneel.py` | `source: ai` (load the key, `keyframes.kneel` from the rig, validation) | 233 -> <= 250 |
| `gen/monster_keys.py` | `kf:kneel` lock and paint for an approved key | +<= 8 |
| `gen/puppet_kneel_ai.py` (new) + `puppet_kneel.py` dispatch | heroes with `source: ai` (`battle_kneel.png`, `battle.kneel` joints, `_tween`, `bob`) | <= 150; +<= 4 |
| `gen/approve.py` | `kneel` / `battle_kneel` sheets; `overwrite_gate` covers them | +<= 10 |
| `gen/monster_atlas.py` | variant lock: `allowed` leaves out `kneel`, and the recoloured kneel key is checked (finding 14) | +<= 4 |
| `gen/retire_kneel.py` (new) | section 5 | <= 120 |
| `gen/kneel_review.py` | probe sheet, compare sheet, side-by-side GIF | +<= 40 |
| `gen/kneel_tools.py` | `coverage` in the G3 format | +<= 8 |
| `gen/selftest_kneel_ai.py` (new) + 1 line in `selftest.py` | fake `invoke`; an approved key without `source: ai` changes nothing; `source: derived` byte-identical; request-body keys; the guides use no source pixels; failure fixtures (section 6); the cut round trip (D-KA6.8), the width rule, the <= 2 px height correction and the outline peel; the calibration exclusion list; the floater foot row; every rig with a `kind: prop` or weapon-named part (`weapon\|sword\|axe\|club\|spear\|staff\|dagger\|blade\|mace\|hammer\|scythe\|trident\|whip\|bow\|rod`) has a `weapons` entry, and every rig has a `heads` entry (`[]` only with `heads_none`); retire_kneel (`<id>` and `--key`) | <= 250 |
| `assets/data/debug-scenarios.yaml` | `ka_pilot` | data |
| `src/` (TS) | **none** | 0 |

## 5. Existing derived kneels and branches

| Group | Recommendation | How |
|---|---|---|
| Merged: 31 monsters + 12 heroes | **Live only until the sprite's AI key lands.** The end state of a sprite whose AI kneel fails is the user's Q3 ruling | On approval, the rig agent runs `retire_kneel.py <id>`. It archives the rig and lock to `anim/monsters/_retired/<id>_kneel_v1.{yaml,lock.json}` (heroes: `anim/_retired/<class>_kneel_v1.*`) and byte copies of the 4 derived frames to `approved/_retired/<id>_kneel_v1/`, indexes them in `docs/RETIRED_SPRITES.md`, and refuses if a target exists with different bytes. Then the agent sets `source: ai` and re-locks |
| `kneel-k2-a`, `kneel-k2-c`, `kneel-k3-0` (unmerged) | **Do not merge; tag** `archive/kneel-k2-a`, `archive/kneel-k2-c`, `archive/kneel-k3-0` (Q4) | Branches and worktrees stay untouched. `kneel-k3-0` is read once from a detached temporary worktree (`/tmp/ka1/k3-0`) for arm (a)'s cobra and green_slime guides and the "old" columns |
| `kneel-k1-hero`, `-k1-py`, `-k1-ts`, `-k2-0`, `-k2-0b`, `-k2-b`, `-k2-d`, `-k2-e` | merged (0 ahead): no tag, no action | |

**Locks:** D-K18 step 6 applies.

- A converted id changes exactly its 4 kneel hashes; the names stay the same.
- An id that is new to kneeling gains 4 entries.
- G2 runs `lockdiff --relock $(kneel_ai.py converted)`.

### 5b. Prompts (`gen/kneel_ai.yaml`)

`{subject}` is the `monsters.yaml` `prompt` (heroes: the `characters.yaml` `prompt` + `battle_gear`). `{facing}` is
"facing right" for monsters and "facing left" for heroes; `{opposite}` is the other side. `{bg}` is "magenta" or
"white", following the guide key. One value drives the guide key, the reference canvas, the prompt and the cut mask.

- **Style suffix:** "16-bit SNES JRPG battle sprite of exactly this character, crisp pixel art, bold black outline
  between every part, flat cel shading with three tones per colour, the same limited palette as the reference, light
  from the upper left, {facing}, whole figure in frame, plain flat {bg} background".
- **Negative:** "standing upright, attacking, jumping, lying dead, knocked out, extra limbs, extra heads, extra hands,
  extra weapons, duplicate weapon, missing weapon, second character, different character, new colours, gradient, soft
  shading, blur, anti-aliasing, 3d render, photo, text, watermark, ground, floor, shadow on ground, scenery, cropped,
  {opposite}, {not_bg}".
  - `{not_bg}` is "{other} background, background gradient", where `{other}` is the colour that is not the key (white
    for a magenta key, magenta for a white key).
  - For a white key it also adds "white outline glow, white halo". The negative never names the key colour itself.
- **Counts in the prompt:** "holding exactly {n_weapons} {weapon}" and "exactly {n_heads} head(s)". They come from
  `kneel_ai.yaml` `sprites.<id>.weapons` / `heads` (r3-3), not from part-name guessing. With 0 weapons the phrase is
  "empty-handed".

| Body (count) | Pose text: "{subject}, ..." | Extra negative |
|---|---|---|
| biped (46, without the 3 mechanical bipeds) | kneeling on one knee, the far knee on the ground, the near foot planted, torso bent forward, head bowed low looking at the ground, arms hanging, the weapon held low with its tip toward the ground, exhausted | sitting, both knees up |
| mechanical (iron_golem, soldier, warmech, guardian) | a heavy machine powered down, kneeling on one knee, armoured torso slumped forward, head lowered, arms hanging heavily, the same plating and joints | broken apart, sparks, smoke |
| robed (5 hero classes; monster rigs with a `cloth` part or a robe in their prompt, `kneel_ai.py bodies`) | kneeling on one knee, the robe pooled on the ground around the legs, torso bent forward, head or hood bowed low, hands resting on the knee, staff or rod held low | legs showing through the robe |
| quadruped (27, without guardian) | lying down on its belly in a compact pose, forelegs tucked under the chest, hind legs folded under the body, head lowered to the ground in front of the chest, tail curled along the body, wings folded tight (if any), exhausted | standing on four legs, on its back, stretched out, legs extended forward, tail stretched out behind |
| bird (5) | crouching low on the ground, legs folded, wings drooping to the ground, neck bent and head lowered, beak near the ground | flying, spread wings |
| floating (12; red_piranha and white_shark use swimmer) | sagging lower in the air, the body drooping, head and eyes turned down, arms, tendrils or fins hanging limp | touching the ground |
| swimmer (shark, red_piranha, white_shark) | listing nose-down and sinking, fins hanging limp, tail drooping | upside down |
| serpent (8) | coiled low and flat on the ground, the coils pressed down, head lowered to rest on the coils, mouth closed | rearing up, striking |
| naga (5) | slumped forward onto its coiled tail, upper body bent low, head bowed, arms hanging | rearing up |
| arthropod (7) | body lowered onto the ground in a compact pose, legs bent and drawn in close under the body, head, pincers and stinger drooping down and tucked in | on its back, legs splayed wide, legs stretched out |
| blob (4) | slumped and flattened into a wide low mound, sagging, eyes looking down | splitting into pieces |
| rooted (2) | wilting, stalks and vines drooping toward the ground, head bowed, the root mass slightly sagged | uprooted |

- **Seeds:** 1234 / 1235 / 1236.
- **Aspect:** 1:1 (1024x1024). The framing comes from the guide canvas, or for (d) from the reference's canvas.
- **Compact wording** (the try-2 change after an A-width fail, other bodies): "{subject}, ..., in a compact pose, limbs
  drawn in close to the body, nothing stretched out", plus "stretched out, sprawling" in the negative.

## 6. Identity and quality gates (in order; all binary unless marked "report")

The automated checks come in two groups, by whether they need joints.

**Group J0: joint-free, before approval** (`kneel_ai.py gate <id> --try N`, < 10 s; on the cut key unless marked
"raw"). This is the only group shown at the probe.

| Check | Rule |
|---|---|
| A-alpha | binary alpha |
| A-pal (raw) | raw figure, block-averaged to native: mean dE76 to the nearest approved colour <= T_pal_mean (default 12), p95 <= T_pal_p95 (default 25) |
| A-grey (raw) | <= 3 % of figure pixels with chroma C* < 6 and farther than dE 10 from every approved neutral |
| A-hist | L1 between the kneel and idle colour-area histograms <= T_hist |
| A-adj | Jaccard of the 4-adjacent colour-pair sets >= T_adj |
| A-outline | after the D-KA6.6 peel: boundary share in the outline colour >= the idle's - 0.08, **and** outline thickness (the median run of outline-colour pixels inward from the boundary, along 4-neighbour normals) <= the idle's median |
| A-pieces | components <= the idle's (`keep_pieces` sprites <= +1); no detached pixels |
| A-base | base (or, for floaters, figure) centroid x within +-0.10 x idle width |
| A-area (loose) | the figure's opaque pixel count / the idle's is in [T_area_lo, T_area_hi] (calibrated, below). It catches a grossly mis-scaled or fragmented key only. The value is also **reported** against the band's area expectation (band midpoint x idle area) |
| A-width | the D-KA6 shrink <= 8 % |
| K-ground, K-fit | existing (floaters: the lowest row = the idle's lowest opaque row) |
| K-height | the body band (heroes: the class band), after the D-KA6.4 correction (<= 2 px) and the D-KA6.6 peel; any ring the peel left is allowed for with +1 px. A FAIL is a pose fail |
| R1 counts | from the review agent (below): weapons, hands, heads and eyes, key / idle |
| A-agree (report) | guide-colour agreement, kept for the record only |
| IoU-derived (report) | silhouette IoU against the derived kneel (mainline, or the untuned template derive), as evidence for R2b; no threshold |

**Group J1: after marking (D-KA7), before lock.** A failure archives the key and sends the sprite to its next try
(D-KA5).

| Check | Rule |
|---|---|
| A-prop | for each `weapons` part: alpha IoU (the idle part's pixels posed on the marked bone vs the key) >= T_prop_iou; pixels of that part's colours outside the fitted part, dilated by 2 px, <= T_outside x the idle part's pixel count (catches a 2nd weapon) |
| A-headdup | the same for each `heads` part, with T_head_iou and T_head_outside (catches an extra head, as on rhyos) |
| A-head | the marked crown or head joint is lower than the idle's by >= 0.15 x idle height |
| A-scale | the **marked head part** (its bone from the joints; for a sub-part head such as rhyos `body:lion`, the `masks.<part>.kneel` polygon) is within **+-10 %** of the idle's head part in its larger dimension. This replaces rev 3's head-colour region, which tracks the pose rather than the scale (it measured 73 px against a 23 px head part on cobra, and 84 against 77 on rhyos). Arm (d) keys are flagged for it (D-KA6.2). Rigs with `heads_none` use their largest `weapons` or body part named in `kneel_ai.yaml` `scale_part` |

**Calibration** (`kneel_ai.py calibrate`, KA0b, offline):

- **Excluded from every calibration:** hurt keys that are not approved art. These are the FW-Q aliased hurts
  (chimera, black_widow) and the FW-H derived hurt (hollow_seraph, `hurt_from: idle`), plus any id whose
  `kf:hurt` comes from keyframe paint or an offset. `calibrate` prints the excluded list, and a selftest pins it.
- T_hist and T_adj: the 95th / 5th percentile over the remaining approved idle-vs-hurt pairs (heroes: ready vs
  hurt).
- T_area_lo / T_area_hi: the 1st / 99th percentile of hurt area / idle area over the same pairs, widened by the
  band's ratio (x band lo, x band hi), since a kneel is lower than a hurt.
- T_prop_iou / T_head_iou: the 5th percentile of the same measures on the approved **hurt keys**, posed by their
  marked hurt joints. T_outside / T_head_outside: the 95th percentile there.
- T_pal: the hero `battle_raw.png` -> `battle.png` pairs.
- The values are pinned in `kneel_ai_thresholds.json` and section 13 before any paid call, and may only tighten after
  KA1-P.
- **Failure fixtures** (selftest, offline, must FAIL):
  - rhyos idle with a 4th head (a ram head pasted at +20 px), marked with its idle joints: A-headdup (J1), and R1's
    count in the reviewer dry run;
  - a warrior `ready` with a second sword and hand pasted (the R3 variant-B failure): A-prop (J1);
  - a wolf stretched to 112 % of its cell width: A-width;
  - a goblin scaled to 125 % about its feet, marked with its scaled joints: A-scale (J1);
  - a goblin with a doubled outer outline ring: A-outline thickness;
  - goblin with a foreign colour and a grey fill: A-pal / A-grey;
  - a 2 px lift: K-ground.

  The same sprites unmodified must pass.

**Independent review agent** (spawned fresh per sprite; it sees only the review PNG, the GIF where one exists, and the
rubric):

| Item | Must hold |
|---|---|
| R1 | the same character. Write the counts as `weapons k/n, hands k/n, heads k/n, eyes k/n` (key / idle); any count above the idle's fails. Also the face, colours and costume |
| R2 | reads as kneeling with the head down at x1 and x4; distinct from `hurt` (monsters) or `down` (heroes) |
| R2b | **visibly not the derived kneel**, judged side by side with it (the derived or untuned derive column) |
| R3 | house style: crisp pixels, outline, light from the top left, no AI smear |
| R4 | the in-between GIF has no pops, tearing or sideways jump (from the pilot on; not at the probe) |
| R5 | no artefacts: fragments, specks, extra limbs |

- **Verdict:** `<id> try N: PASS` or `<id> try N: FAIL R<k>: <reason>`.
- At most 3 tries per sprite, then D-KA14.

**Animation and lock gates:** J1 passes, then `python3 -I assets-src/gen/monster_anim.py check <id>` -> `<id>: OK`
(heroes: `python3 -I assets-src/gen/puppet_kneel.py check <class>` -> `<class>: OK`), then `lock`, then commit. At most 3 offline rig iterations; they
never trigger a new image.

**D-KA14 After 3 failed tries:** the Q3 ruling applies.

## 7. Budget, cost and compute (user approval: Q1)

**Stage 1 (approve now), at most 91 requests:**

| Purpose | Scope | Cap |
|---|---|---|
| `ka_probe` | 5 sprites x 11 (arm (a) = 10 of them, about $0.80, on the rejected baseline) | 55 |
| `ka_pilot` | 6 sprites x 3 tries x 2 calls (the worst case, if hybrid (c) is picked) | 36 |

**Stage 2 (asked at U1-KA, sized by the picked arm's calls per try, c):**

| Purpose | Scope | Cap |
|---|---|---|
| `ka_bodyprobe` | 6 | 18 c |
| `ka_monsters` | 113 | 339 c |
| `ka_heroes` | 10 | 30 c |
| `reserve:<reason>` | a 4th try, only if Q3 = regenerate | 20 c |

That is 407 c: **407 at c = 1, 814 at c = 2**.

- **Price** (estimates, `bedrock.COST_USD` / CHAOS_FORMS_PLAN 5.6): sd35 $0.08; structure and inpaint about $0.07.
  Style Transfer, Style Guide and Control Sketch have **no estimate on record**.
  - **KA0b exit criterion (hard stop, with the thresholds and the selftests):** the price of every model a probe arm
    uses (sd35, style_transfer, control_sketch or structure, style_guide) is read from the Bedrock pricing page for
    us-west-2, written into `COST_USD`, and recorded in section 13 **before KA1-P**. Without it, `kneel_ai.py gen`
    refuses (an arm whose model has no `COST_USD` entry is refused).
  - The figures below assume <= $0.08 per call. If a used model costs more than $0.10, the budget goes back to the
    user.
- **Worst case:** stage 1 91 x $0.08 = **$7.28**. Stage 2 is $32.56 (c = 1) or $65.12 (c = 2).
- **Expected:** stage 1 about 75 requests. Stage 2 at 1.7 tries is about 219 c requests (about $18 at c = 1, $35 at
  c = 2). The 1.7 is an assumption that the pilot measures; caps may then be lowered without the user, never raised.
- **Gemini: 0.** `cache/ledger.jsonl` is unchanged (G12).
- **Budget block** (`budget.json` `bedrock`):
  - `{pass: "KA", cap: 91, per_purpose_caps: {ka_probe: 55, ka_pilot: 36}, gemini_before: <N at KA0b>,
    reserve_max_usd: 0.08}`. Stage 2 raises `cap` and adds its purposes after its own approval.
  - Pass C (25 / 80) moves to `bedrock_history`, which the two colossus selftests and `colossus.py budget --check`
    read.
  - The gate refuses every `ka_*` purpose until the block exists.
- **Ledger:** one BR ledger row per request (tracked), and a `docs/ROSTER_LOG.md` "Pass KA" row per request (id,
  arm, seed, key, cost, A-checks, verdict). `kneel_ai.py budget --check` prints `OK pass KA <used>/<cap>`.
- **CPU (1 thread):**

  | Item | Count | CPU |
  |---|---|---|
  | per sprite: cut + gates <= 10 s per try; fit <= 30 s; `check <id>` 83 s, about 2 per sprite (one before and one after the rig fix) plus 1 at lock | | about 4.5 min per sprite (135 x 4.5 = about 10 CPU-h) |
  | batch merges: `check <changed ids>` only, 83 s each | 123 | about 2.8 CPU-h in total |
  | KA4: one `check --all` | 1 | 2.8 CPU-h |
  | **total** | | **about 16 CPU-h** |

  There is no parameter search anywhere. A sprite over 10 CPU-min is reported.
- **Agent time (estimates; the pilot measures them):** marking about 34 agent-hours (15 min x 135; stop rule at a
  pilot median over 30 min), plus review about 19 agent-hours (about 5 min per try x 1.7 tries x 135). That is about
  **53 agent-hours**, about 27 h of wall clock with 2 rig agents and a serial generator.
- **Pass K for comparison:** about 9 h of wall clock for 43 of 135 locked, so about 28 h at that pace for all 135,
  plus the reported CPU hours of parameter search per batch. Pass KA is not expected to be faster in agent-hours. Its
  gain is that no CPU goes to parameter search and that the pose comes from the model, not from warping.

## 8. Pilot (KA1)

**Sprites:** goblin, wolf, warrior, white_mage (the K1 set) plus green_slime and cobra. The 5 probe sprites start
with their best probe output of the picked arm as try 1; warrior starts at try 1.

**Artefacts for the user** (untracked, `assets-src/gen/out/kneel_ai/review/`):

| File | Content |
|---|---|
| `probe_sheet.png` | section 3, delivered **before** the pick |
| `<id>_compare.png` | idle / ready, the **old derived kneel**, the AI raw (x4 of native), the **AI key**, kneel_in1, kneel_in2, kneel_b, hurt / down; x4, ground line, height and band, A-checks, IoU-derived |
| `<id>_side.gif` | the old and AI sequences side by side: in 8 f, 2 sway cycles (period 48), out 6 f, stand 24 f, 16.7 ms per frame |
| `goblin_rise_ai.gif` | kneel -> rise 6 f -> attack -> kneel_in 8 f -> hold |
| `pilot_stage_ai.png` | all 6 kneeling at game scale on `grassland.webp` |
| `pilot_numbers.txt` | calls, tries, J0 / J1 values, the `width-limited` ids with their shrink %, CPU seconds, joint-marking minutes per sprite and their **median** (stop rule: over 30 min) |
| browser | `http://localhost:5173/?mute=1&scenario=ka_pilot&battleStep=1&poseLabel=1` -> `/tmp/ka1/pilot_battle_{1,2,3}.png`, the KNEEL_PLAN 8 scripted capture. `ka_pilot` = the `kneel_pilot` party; enemies `[goblin, wolf, cobra, green_slime]`, `enemyStatus {0: [poison], 1: [sleep], 2: [stun]}`, green_slime the control; a test checks `formationFits` |

- **KA1 commits:** tooling, 6 keys, rigs, locks, archives and the rebuilt atlases.
- **U1-KA:** the user rules on each sprite and on the stage-2 budget. No rollout before that is recorded. Pass: the
  user approves >= 4 of 6; otherwise rev 3.

## 9. Rollout

| Batch | Sprites |
|---|---|
| KA2-1 biped A (24) | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle garland ghast ghoul gr_imp hill_gigas horned_devil ice_gigas iron_golem king_mummy lich mindflayer |
| KA2-2 biped B (24) | minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier stone_golem troll vampire vampire_lord warmech weretiger werewolf wight zombie |
| KA2-3 quadruped (27) | baretta basilisk blue_dragon chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hydra hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf |
| KA2-4 heroes (10) | knight thief ninja monk master red_mage; robed: black_mage black_wizard red_wizard white_wizard |
| KA3-0 body probes (6) | cockatrice ghost shark water_naga scorpion ochu (KA3-1/2/3 start only when >= 4 of 6 pass R1-R5) |
| KA3-1 floating (13) | air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental hollow_seraph red_piranha shadow specter water_elemental white_shark wraith |
| KA3-2 serpent / rooted / naga (12) | anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; neochu; ashen_queen earth_medusa medusa spirit_naga |
| KA3-3 bird / arthropod / blob (13) | allosaurus pyrolisk tyrannosaur wyvern; ankheg black_widow crawler remorazz sea_scorpion tarantula; black_flan gray_ooze ochre_jelly |

Totals: monsters 4 + 24 + 24 + 27 + 6 + 13 + 12 + 13 = **123**; heroes 2 + 10 = **12**.

**Roles and limits:**

- **Generator:** one process, main checkout only. It makes every Bedrock call, serially, as a background command
  waited on with Monitor. Then cut, gate, review sheet and review agent; on PASS, `kneel_ai.py approve`, committed on
  mainline with only `approved/<id>/kneel.*` and the ROSTER_LOG row.
- **Rig agents:** at most 2, in worktrees (`git worktree add /tmp/ka-wt/<batch> -b ka-<batch> mainline`). Each rebases
  for new keys, runs `retire_kneel.py` where needed, hand-marks joints, then `check`, `lock`, and a commit per sprite.
  They never call Bedrock and never commit `assets/`.
- **Limits:** at most **3 Python processes** at once, each with `OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
  MKL_NUM_THREADS=1`. The review agent only views images.
- Never `git add -A`. Scratch work goes to `/tmp/ka*/` only.
- **Integrator:** the only role that rebuilds and commits atlases. Per batch it merges, runs
  `python3 -s assets-src/build_assets.py monsters_ai battle_ai` and the gates below, and commits `KA2: atlases
  (<batches>)`.

**Gates.** `IDS` = the batch's changed sprite ids (from the merge diff). Every batch merge runs G1b, G1h and G2-G16; KA4
runs G1, G1h (all 12 classes) and G2-G16.

```bash
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
# G1  (KA4 only, about 2.8 CPU-h): expect "0", and 123 OK lines
python3 -I assets-src/gen/monster_anim.py check --all | grep -vc ': OK'
# G1b (batch merges; IDS = changed monster ids, HEROES = changed hero classes): expect "0" each
if [ -n "$IDS" ]; then python3 -I assets-src/gen/monster_anim.py check $IDS | grep -vc ': OK'; else echo 0; fi
# G1h: heroes go through puppet_kneel.py
if [ -n "$HEROES" ]; then python3 -I assets-src/gen/puppet_kneel.py check $HEROES | grep -vc ': OK'; else echo 0; fi
# G2: last line "<n> added, 0 changed, 0 removed", no FAIL line, exit 0
python3 -I assets-src/gen/kneel_tools.py lockdiff --base 24c4236 --relock $(python3 -I assets-src/gen/kneel_ai.py converted)
# G3: "monsters ai A, derived D, alias F (= 123)" and "heroes ai A, derived D, alias F (= 12)", A + D + F as printed;
#     at KA4, D = 0 unless Q3 = keep-derived for a listed id
python3 -I assets-src/gen/kneel_tools.py coverage
# G4: every line "OK"
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum assets/sprites/monsters-ai* assets/sprites/battle-characters-ai* > /tmp/ka.sha && PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum -c /tmp/ka.sha
# G5: every page <= 2048x2048, <= 12 pages, preload <= 2, anchor fields identical
python3 -I assets-src/gen/kneel_tools.py pages --base 24c4236
# G6: "12 rows x 14 old columns identical; width 2880"
python3 -I assets-src/gen/kneel_tools.py party-diff --base 24c4236
# G7: empty (TS runtime unchanged)
git diff --stat 24c4236 -- src assets/sprites/characters* assets/sprites/colossus*
# G8: last line "ALL PASSED"
python3 -I assets-src/gen/selftest.py
# G9: exit 0
npm run build
# G10: all passed; tests >= 5063 (the K1 floor) and >= the KA0b count in section 13
npm test
# G11: no scratch files
git status --short
# G12: empty, then "OK pass KA <used>/<cap>"
git diff --stat 24c4236 -- assets-src/gen/cache/ledger.jsonl
python3 -I assets-src/gen/kneel_ai.py budget --check
# G13: empty (approved art only gains kneel files and archives)
git diff --name-status 24c4236 -- assets-src/gen/approved | grep -vE '^A\s.*/(kneel|battle_kneel)\.(png|json)$|^A\s.*/_retired/'
# G14: "OK" (every converted id that had a derived kneel at 24c4236 has its _kneel_v1 archive)
python3 -I assets-src/gen/kneel_ai.py converted --check-archive
# G15: empty (D-KA10 freeze)
git diff --stat 24c4236 -- assets-src/gen/kneel_templates.py assets-src/gen/kneel_variants.py assets-src/gen/kneel_ops.py
# G16: "OK" (pass C history intact)
python3 -I assets-src/gen/colossus.py budget --check
```

**KA4:**

- The KNEEL_PLAN 10 K4 play test is reused (`kneel_k4_armour`, `kneel_k4_light`, `kneel_k4_robed`, the adversarial
  checklist, `?mute=1`, 0 console errors), with screenshots in `/tmp/ka4/`.
- The user gets `ka4_sheet.png`: all 135 keys at x2, with alias and derived sprites marked.
- Docs: AGENTS.md (the AI kneel key, `kneel_ai.py`, the pass KA budget, the 2026-11-13 note qualified to "in-betweens"),
  `assets-src/gen/README.md`, `docs/NEW_MONSTER_GUIDE.md`, `docs/PROGRESS.md`, and a superseded note in KNEEL_PLAN
  D-K4.

## 10. Risks

| Risk | Mitigation / measure |
|---|---|
| **Identity drift** (the model draws the figure anew) | the reference image; the palette snap; A-pal / A-hist / A-adj / A-prop / A-headdup; R1 counts; the user sees every arm at the probe |
| **The output copies the derived pose** | pose-only guides; R2b; IoU-derived reported; arm (a) cannot be picked |
| **No arm keeps identity** | the stop rule at KA1-P (rev 3, no pilot spend) |
| **No identity after 3 tries** | the Q3 ruling (D-KA14); every case reported as `LIMIT: <id> 3 tries: <last FAIL>` |
| **Weapon or head duplicated or missing** | prompt counts from the rig; A-prop / A-headdup with the rhyos and variant-B fixtures; R1 counts |
| **Palette breaks** | the snap makes a foreign colour impossible; A-pal rejects a raw too far off |
| **Unpainted grey silhouette (arm b)** | A-grey; `change_strength` 0.8 / 0.9 at the probe |
| **Variants** | the recoloured kneel key is now palette-checked (finding 14) |
| **Size / width / anchor** | one uniform canvas scale, then one pixelize of the guide window (round-trip selftest); the compact wording; A-area (J0) and A-scale +-10 % on the marked head (J1); A-width <= 8 % shrink (the cell never widened, page impact 0), the width-limited list shown at U1-KA; A-base; floater y rule; K-anchor and G5 |
| **Atlas pages** | the cell count and sizes are unchanged, so the KNEEL_PLAN 1 projection holds (<= 12 pages); G5 |
| **Hand-marking time** | the estimate of 15 agent-min per sprite is unmeasured; the pilot reports the median; stop rule over 30 min |
| **A J1 failure after approval** | the key is archived (`retire_kneel.py --key`), and the sprite retries; it costs a try, not a gap in the game (the derived kneel or the alias stays live meanwhile) |
| **API error or content filter** | counted as spent; the next seed |
| **Cost** | staged approval; caps in the gate; `budget --check` after each call |

## 11. Open questions for the user

1. **Q1 Budget stage 1:** approve 91 Bedrock requests (the 55-call probe plus the pilot; about $7.28 at worst, at
   <= $0.08 per call once confirmed), with pass C closed into history at 25 of 80, and 0 Gemini? Stage 2 is asked at
   U1-KA, sized by the picked arm (407 or 814 requests). Arm (a) spends 10 of the 55 probe calls (about $0.80) on the rejected baseline, to
   measure H1; drop it to save that. Default: **approve 91, with arm (a)**.
2. **Q2 Review:** you pick the arm at the probe and review at U1-KA and the KA4 sheet; the rest goes to the
   orchestrator plus the independent review agent, with every limit hit reported? Default: **yes**.
3. **Q3 After 3 failed tries,** choose one: (i) keep the derived kneel (only for the 43 that have one), (ii) alias to
   daze (no new frames, today's look on kneel timing), or (iii) regenerate once from the reserve with the fallback
   arm, then (ii). Recommended: **(iii)**.
4. **Q4 Branches:** tag the unmerged `kneel-k2-a`, `kneel-k2-c` and `kneel-k3-0` as `archive/`, unmerged, with
   nothing deleted? Default: **yes**.

## 12. Acceptance criteria

```json
{
  "functional": [
    "every monster sheet (123) and hero class (12) shows a kneel made from an approved AI key, or is listed under the Q3 ruling",
    "kneel_in1 / kneel_in2 / kneel_b come from the existing in-between machinery between idle (ready) and the approved key",
    "the TS runtime and the frame names are unchanged"
  ],
  "observable": [
    "the user picks the arm from probe_sheet.png",
    "U1-KA: the user approves >= 4 of 6 from <id>_compare.png and <id>_side.gif",
    "the KA4 contact sheet of 135 keys"
  ],
  "pass_fail": [
    "G1 / G1b and G2-G16 as in section 9",
    "kneel_ai.py budget --check prints OK pass KA <used>/<cap>",
    "every approved key passes J0 and R1, R2, R2b, R3, R5 before approve, and J1 and R4 before lock",
    "the selftest failure fixtures (rhyos 4th head, second weapon, grey fill, foreign colour, 2 px lift) fail their checks"
  ]
}
```

## 13. Rulings and tuning log

| Date | Item | Ruling / change |
|---|---|---|
| 2026-11-17 | directive | an AI kneel key per sprite via Stability, with the rig doing the in-betweens (user) |
| 2026-11-17 | rev 2 | momus rejection of rev 1 resolved (table at the top) |
| 2026-11-17 | rev 3 | the narrow momus rejection of rev 2 resolved (table at the top) |
| 2026-11-17 | rev 4 | the cut window, A-scale on the marked head, the height correction, calibration exclusions and the outline peel (table at the top) |
| 2026-11-17 | KA0b prices (hard stop) | **SD3.5 Large confirmed: $0.08 per image, us-west-2** (and us-east-1), read-only from the AWS Price List API: `aws pricing get-products --service-code AmazonBedrockFoundationModels --region us-east-1 --profile bedrock`, product "Stable Diffusion 3.5 Large v1.0 (Amazon Bedrock Edition)", usage type `USW2-MP:USW2_Created_image-Units`, "AWS Marketplace software usage\|us-west-2\|Output image, SD3.5 Large". Same source: Stable Image Core $0.04, Ultra $0.14. The image services (Style Transfer $0.08; Style Guide, Control Sketch, Control Structure, Inpaint $0.07) are not in the Price List API; their prices are the user's pricing-page reading (rulings below). `bedrock.COST_USD` gains `style_transfer` 0.08, `control_sketch` 0.07, `control_structure` 0.07; `bedrock.PRICE_CONFIRMED` lists the confirmed models and `kneel_ai.py gen` refuses any arm whose model is outside it or above $0.10 |
| 2026-11-17 | KA0b thresholds | `kneel_ai.py calibrate --write` -> `kneel_ai_thresholds.json`: T_hist 0.3282, T_adj 0.6411, T_area_lo 0.4145, T_area_hi 1.2965, T_prop_iou 0.0366, T_prop_outside 0.1519, T_head_iou 0.3763, T_head_outside 0.1294, T_dup_match 0.5, T_pal_mean 11.99, T_pal_p95 21.44. Excluded (pinned): ashen_queen (key_offset), black_knight, cobra, crocodile, king_mummy (keyframe paint), black_widow, chimera (FW-Q), hollow_seraph (FW-H). 127 pairs; 11 with a per-pose palette (colour-set Jaccard < 0.5: astos chaos death_eye drowned_sovereign garland knight lich warmech warrior white_mage white_wizard) are left out of T_hist / T_adj only |
| 2026-11-17 | KA0b D-KA7 fit time | goblin, the derived kneel (mainline) as the stand-in key: **0.08 s CPU** (0.08 s wall, 1 thread) for the one-pass fit (13 parts x 405 placements); mean fit 0.59, so the whole key goes to hand marking (the derived legs are IK-solved past +-4 px / +-10 deg). Far under the 30 s budget: no narrowing |
| 2026-11-17 | KA0b deviations | (1) A-prop / A-headdup also slide the idle part over the key as a template (`kneel_ai_j1.peaks`): an extra peak >= T_dup_match fails. The colour "outside" rule alone cannot see rhyos' 4th head or the warrior's 2nd sword (their colours are shared with the body: no colour is >= 60 % owned by the part). (2) Heroes' `ready` keys are empty-handed (only white_mage / white_wizard hold a staff), so the R3 fixture is "A-prop weapon@attack": the attack key's weapon as the template. (3) Cut: `pixelize(bottom_row=None)`, then the lowest solid row goes on the foot row and the ring below it is dropped (aligning inside pixelize put the ring on the foot row); flat k x k blocks keep their colour (`restore_uniform`, crisp input only: pixelize's speckle filter erased 1-px details, 95.7 % round trip -> 99.55 %); the peel removes an outer ink pixel whose inward ink run exceeds the idle's outline thickness t (t = 1 is the plan's rule; cobra's idle has t = 2); a figure touching the 1024 canvas edge also fails. (4) T_area_hi is the unscaled 99th percentile (x band hi would narrow it); T_pal_p95 is the 95th percentile of the 72 hero cells' p95 (white_wizard's hurt cell reaches 96), the magenta fringe left out. (5) The fit score is a local colour agreement (an alpha IoU against the whole key is dominated by the other parts). (6) The robed pose text is for bipeds only (specter / wraith stay floating); garland and lich (plate + cape) are not robed. (7) colossus.py reads pass C through `bedrock.pass_view`. (7b) The re-centred window snaps < k/2 canvas px onto the input's own pixel grid when the input is crisp (>= 60 % of colour edges on one phase mod k; AI output is never moved); without it the derived stand-in fell 5 canvas px off-grid and failed A-grey / A-hist / A-adj / A-outline. (7c) File sizes: all new files < 250 lines, but `kneel_ai_cut.py` (204), `kneel_ai_guide.py` (225), `approve.py` (+27) exceed the plan's own soft limits; the extra modules are `kneel_ai_data`, `_req`, `_j1`, `_calib`, `_bodies`, `_review` and `selftest_kneel_ai_{io,cut,fix}`. (8) Not in KA0b (left for KA1 with the first approved key): `source: ai` in kneel.py / monster_keys / puppet_kneel_ai.py, the monster_atlas variant lock, `ka_pilot` |

## TODOs

- [ ] U0 user answers Q1-Q4 (Q1 blocks KA1-P; KA0b may start)
- [ ] KA0b `bedrock.py` models; **confirmed prices for every used model (hard stop before KA1-P)**; `budget.json` stage 1; `bedrock_history`; the 2 colossus selftests and the budget check (high, 2h)
- [ ] KA0b `kneel_ai.py`, `_guide`, `_cut`, `_gates`, `_joints`, `kneel_ai.yaml` (high, 9h)
- [ ] KA0b `source: ai` in `kneel.py` / `monster_keys.py` / `monster_anim`; `puppet_kneel_ai.py`; `approve.py` gate; `monster_atlas.py` variant lock; `retire_kneel.py` (high, 6h)
- [ ] KA0b `selftest_kneel_ai.py` with the failure fixtures; `calibrate` -> thresholds (incl. T_prop_iou / T_outside) pinned; `bodies --write` -> weapons / heads entries reviewed; fit time on goblin; G1b-G16 green with byte-identical atlases (high, 4h)
- [ ] KA1-P probe, 55 calls; `probe_sheet.png` to the user; the user's arm pick recorded (high, 3h)
- [ ] KA1 pilot of 6 sprites; artefacts; `ka_pilot`; atlases committed (high, 8h)
- [ ] U1-KA user review and the stage-2 budget (blocking)
- [ ] KA2-1 / 2-2 / 2-3 / 2-4 (75 monsters + 10 heroes), integrator per batch (medium, about 7h each, including hand marks)
- [ ] KA3-0 body probes, then KA3-1 / 3-2 / 3-3 (38 monsters) (medium, about 5h each)
- [ ] KA4 play test, contact sheet, docs, `check --all`, branch tags (high, 6h)

## User rulings (2026-11-17, U0)

| Q | Ruling |
|---|---|
| Q1 | Stage 1 approved: at most 91 requests, arm (a) kept. The Chaos-forms pass C is closed at 25 of 80 into `bedrock_history`. |
| Q2 | The user reviews the probe sheet (and picks the arm), the pilot, and the final 135-kneel sheet. The orchestrator and review agent handle the rest and report every sprite that hits the limit. |
| Q3 | (iii): after 3 failed tries, one more try from the reserve with the fallback arm, then the daze alias (F2). |
| Q4 | `kneel-k2-a`, `kneel-k2-c` and `kneel-k3-0` are tagged under `archive/`, never merged, nothing deleted. |
| Prices | Checked on the AWS Bedrock pricing page (us-west-2/us-east): Style Transfer $0.08; Style Guide, Control Sketch, Control Structure and Inpaint $0.07. SD3.5 Large is not listed there (it is billed via Marketplace) and is still to be confirmed at KA0b. |
| Momus rev-4 P2 | Fold into KA0b: re-centre the cut window on the figure's base before the crop, fail on "figure touches the window edge", and add the +15 % offset case to the round-trip selftest. |

# AI kneel keyframe plan (pass KA), rev 1

Status: rev 1, a plan only. Nothing here is implemented. No paid or AI call was made to write it; the Bedrock facts
in section 1 come from read-only listing calls.

**User directive (2026-11-17):** "Use an AI image generation model to build the 'kneeling' frame for each sprite, and
then use the rigging to let the sprites move between the two. The current approach of using rigging to move the
sprites wastes a ton of compute and doesn't produce good results. Use one or more of the Stability AI models to
transform each sprite into a 'kneeling, head down' pose."

## 0. Summary

Pass K (docs/KNEEL_PLAN.md) derives the `kneel` key from the idle by moving the rig's joints, then tunes each sprite
by hand. Pass KA replaces that derived key with an **AI-made, approved `kneel` keyframe** for every sprite: 123
monster sheets and 12 hero classes. The Chaos colossus forms F2-F4 are exempt (D-K12); Chaos F1 is included.

- **Primary technique:** SD3.5 Large image-to-image (`stability.sd3-5-large-v1:0`). Its init image is a **pose guide**:
  the sprite's own approved pixels already in the kneel pose, with the rig making that pose once at template defaults
  and no tuning. The model only repairs the pose. Its output is then cut and pixelized back onto the approved palette.
- **Fallback technique:** Stability **Style Transfer** (`us.stability.stable-style-transfer-v1:0`). It takes the same
  guide as `init_image` and the approved idle as `style_image`.
- **After approval:** the existing in-between machinery makes `kneel_in1` and `kneel_in2` between `idle` and the
  approved key, the same way it makes `idle -> hurt`. `kneel_b` is a 1 px breath of the key.
- **What stays the same:** the frame names, the TS runtime (`src/` untouched), the timing tables and the atlas cell
  count (4 cells per sheet).
- **Order:** KA0b tooling (0 calls) -> KA1-P technique probe (26 calls) -> KA1 pilot of 6 sprites -> **U1-KA user
  review** -> KA2 / KA3 rollout batches -> KA4 integration.
- **Budget:** 450 Bedrock requests at most, about $36 at worst; about 255 requests (about $20) expected. 0 Gemini.
  This waits for **user approval (Q1)**.

## 1. Verified facts (2026-11-17, mainline 24c4236)

| Fact | Evidence |
|---|---|
| Stability on Bedrock, us-west-2, ON_DEMAND: `stability.sd3-5-large-v1:0`, `stability.stable-image-core-v1:1`, `stability.stable-image-ultra-v1:1` | `aws bedrock list-foundation-models --profile bedrock --region us-west-2 --by-provider stability` (read-only) |
| Inference profiles (us-west-2 and us-east-1, all ACTIVE): `us.stability.` + `stable-image-control-structure-v1:0`, `stable-image-control-sketch-v1:0`, `stable-image-style-guide-v1:0`, `stable-style-transfer-v1:0`, `stable-image-inpaint-v1:0`, `stable-image-erase-object-v1:0`, `stable-image-search-replace-v1:0`, `stable-image-search-recolor-v1:0`, `stable-image-remove-background-v1:0`, `stable-outpaint-v1:0`, and the conservative / creative / fast upscalers | `aws bedrock list-inference-profiles --profile bedrock --region us-west-2` (read-only) |
| `bedrock.py MODELS` lacks `style_transfer`, `control_sketch`, `search_recolor` and `erase_object`; its `COST_USD` has no estimate for them | `assets-src/gen/bedrock.py:39-58` |
| The `bedrock` profile is the Admin role. The user allows it for image `InvokeModel` and read-only listing only | `aws sts get-caller-identity --profile bedrock`; ROSTER_LOG pass C ruling 2026-11-16 |
| The gate inside `bedrock.invoke` refuses an uncached call that lacks `paid=True`, comes from a linked worktree, has a purpose outside `per_purpose_caps`, or would pass a cap. It writes a ledger row before the first try | `bedrock.py:126-170` |
| BR ledger: 25 pass-C requests of the 80-request cap (search_replace 7, structure 6, upscale 4, inpaint 4, remove_bg 2, core 1, sd35 1) | `cache/bedrock_ledger.jsonl` |
| **The 2026-11-13 test that was rejected:** 7 Bedrock attempts, all on the **knight**, all on whole multi-pose sheets: `structure` x2 (`anim_battle`, `anim_walk_left`), `sd35` img2img x3 (strength 0.35 and 0.55), `inpaint` x2. The cached images are gone | `cache/ledger.jsonl` (7 `backend: bedrock` rows); `cache/<key>.png` missing |
| Pass C data on edits: `structure` ignored most of the layout and went to a 3D look (C3, C5, C17). `search_replace` is local and leaves the rest identical when it matches (C6, C9), but sometimes rebuilds the whole figure (C10, C15) or bleaches it grey (C14) | ROSTER_LOG C3-C17 |
| Stable Image Core takes text only (no init or control image), so it cannot hold an approved identity. It stays the direction for **new** sprites, not for edits of approved ones | Stability API (Core has no `image` parameter) |
| Kneel coverage on mainline: `monsters 31/123, heroes 12/12` | `python3 -I assets-src/gen/kneel_tools.py coverage` |
| Unmerged branches: `kneel-k2-a` (22 rigs, 4 locked), `kneel-k2-c` (20 rigs, 0 locked), `kneel-k3-0` (8 rigs locked, plus 9 shared files: `kneel_bodies`, `kneel_cut`, `kneel_post`, `kneel_warp`, template and check changes). **`kneel-k2-e` is merged**: it is at 24c4236, 0 commits ahead | `git rev-list --count mainline..<b>`; `git diff --name-only mainline...<b>` |
| The bird, floating, serpent, naga, arthropod, blob, rooted and swimmer kneel templates exist **only on `kneel-k3-0`**. Mainline has biped, quadruped and mechanical | `kneel_templates.py:71`; `git show kneel-k3-0:assets-src/gen/kneel_bodies.py` |
| Rig bodies: biped 49, quadruped 28, floating 14, serpent 8, arthropod 7, bird 5, naga 5, blob 4, rooted 2, swimmer 1 (= 123). Mechanical: iron_golem, soldier, warmech, guardian | `body:` in `anim/monsters/*.yaml` |
| `monsters.yaml` has **0 `variants`** today. The atlas recolours every frame of a variant and palette-locks it | `monster_atlas.py:154-161` |
| Approved monster keys: grid sheets `approved/<id>/monster_*.png` (idle, attack, hurt), per-pose bosses `boss_<pose>.png`. Hero keys: `approved/<class>/battle.png` (3x2 cells of 80x80) | `monster_anim.load_entries`; `battle.json` |
| `lockdiff --relock <ids>` already accepts changed kneel entries of the listed ids (`KNEEL_LOCK` = `kf:kneel`, `kneel_in1`, `kneel_in2`, `kneel_b`; for heroes, the 4 frame names) | `kneel_tools.py:27-73` |
| Cost of one check today: `monster_anim.py check goblin` takes 83 s of CPU (wolf the same), with 1 thread | `/usr/bin/time -p`, `OMP/OPENBLAS/MKL_NUM_THREADS=1` |
| Pass K time spent: K1 committed at 00:43-00:48, and K2-C iteration 2 at 09:43 on 2026-11-17. That is about 9 h of wall clock for 43 of 135 sprites locked (32 %), plus the CPU hours of parameter search per batch that the user reported | `git log --date=format:%m-%d_%H:%M` |

## 2. Answering the 2026-11-13 failures

| Failure in 2026-11-13 | What was asked then | Technique in KA | Acceptance check (section 6) |
|---|---|---|---|
| **No identity lock to a reference image** | A new pose from edges plus text (`structure`), so the model drew its own character | (a) The init image **is** the sprite's approved pixels, re-posed. (b) The fallback passes the approved idle as `style_image`. (c) The palette is locked offline: every output pixel snaps to the approved sheet's colours (`pixelize.pixelize(..., palette=approved)`). | A-pal, A-hist, A-adj, A-feat; review R1 |
| **img2img redraws the whole figure** | A **pose change** from the idle by img2img, which needs high strength (0.55 redrew everything) | The pose change happens **before** the model sees the image (the guide). Strength stays at 0.35-0.55 (default 0.40) and only repairs seams and anatomy. | A-agree >= 0.50 (the output keeps the guide's colours) |
| **Inpainting comes back grey** | A masked edit of a whole sheet. The cause was not recorded; the plan assumes transparent or empty masked pixels and a large mask | Only probe arm D uses it: an opaque flat key background (no alpha is ever sent), a mask over the lower body only (grown 8 px), the guide's pixels left under the mask, and a prompt that describes only the masked part | A-grey <= 3 % |

Rejected for the kneel:

- **Style Guide:** it has no pose input, so it keeps the style but not the pose or the identity.
- **Control Sketch:** it has the same identity gap as Structure, and Structure already covers it in the probe.
- **Search and Replace / Recolor:** the pass-C results show unpredictable reach. Recolouring is done offline by the
  palette lock, at no cost.
- **Core:** it takes text only.
- **Ultra:** $0.14 and not needed. It may be an arm only after a user ruling.

## 3. Technique (D-KA1 to D-KA4)

- **D-KA1 Pose guide (0 calls, no tuning).** For each sprite, `kneel_ai_guide.py` renders one RGB image:
  - Sprites with a **locked derived kneel on mainline** (31 monsters, 12 heroes) use that kneel key as their guide.
  - Other biped, quadruped and mechanical sprites use `kneel.derive` at the template defaults, with no rig `kneel:`
    block and no tweaks or paint.
  - The other bodies use one whole-image guide op about the bottom row, with factors from the band midpoints in
    KNEEL_PLAN 4:
    - blob: sx 1.12, sy 0.80;
    - floating and swimmer: sy 0.90, then 6 px per 80 px of cell down;
    - serpent: the rows above the ground at sy 0.60;
    - rooted: sy 0.88;
    - naga: the upper body sheared 20 deg forward and sy 0.85;
    - arthropod: sy 0.75;
    - bird: sy 0.72.

    The bow of the head is left to the prompt.
  - The guide is upscaled with nearest neighbour by k = floor(1024 / max(cell w, h)) (80 px cell -> 12, 128 -> 8, 200
    -> 5, 300 -> 3). It is centred on a 1024x1024 flat `#FF00FF` key (the cutter's magenta key), with the ground row
    at its upscaled row. Sprites with a colour within dE76 30 of magenta use flat white instead.
  - The guide op itself is never tuned per sprite.
- **D-KA2 Primary call (one image per try):**

  `bedrock.invoke("sd35", {prompt, negative_prompt, mode: "image-to-image", image: guide, strength, seed,
  output_format: "png"}, paid=True, purpose=<batch purpose>)`

  - strength: 0.40 by default; per-body defaults are pinned after KA1-P.
  - Why identity holds: the model starts from the sprite's own colours, face, costume and weapon, already in place. At
    strength <= 0.55 it keeps colour layout and small features, and only resolves the joints. The palette lock then
    removes any colour drift.
- **D-KA3 Fallback call:**

  `bedrock.invoke("style_transfer", {init_image: guide, style_image: approved idle (same k, same key), prompt,
  negative_prompt, style_strength: 1.0, composition_fidelity: 0.9, change_strength: 0.45, seed, output_format:
  "png"}, ...)`

  - Why identity holds: the approved idle is an **explicit reference image**, and the guide fixes the composition.
    The 2026-11-13 test had neither.
- **D-KA4 Try schedule** (deterministic; never a sweep):

  | Try | Call | Seed | Strength / change |
  |---|---|---|---|
  | 1 | primary | 1234 | body default |
  | 2 | primary | 1235 | +0.10 if the reviewer's reason is pose or anatomy; -0.05 if it is identity; otherwise unchanged |
  | 3 | fallback | 1236 | D-KA3 values |

  - A prompt may change between tries only through `gen/kneel_ai.yaml` `sprites.<id>.{extra, negative_extra}`, and
    only for a reason the reviewer named.
  - **Size is never a reason to retry.** The cutter normalises it (D-KA6).
  - Request bodies follow the Stability API parameter names. `selftest_kneel_ai.py` pins each body's keys, and the
    first call of each model validates them.

**KA1-P technique probe (26 calls, purpose `ka_probe`).** The probe runs on the 6 pilot sprites (section 8).

| Arm | Call |
|---|---|
| A1 | sd35 i2i, strength 0.40 |
| A2 | sd35 i2i, strength 0.55 |
| B | style transfer (D-KA3) |
| C | Control Structure, `control_strength` 0.70, guide as `image` |
| D | inpaint of the lower body only (goblin and wolf), as in section 2 |

That is 6 x 4 + 2 = 26 calls, all with seed 1234.

- **Pick rule:** an arm's score is the number of sprites whose output passes every A-check (section 6) **and**
  review items R1-R5. The primary is the highest score; a tie goes to the cheaper arm, then to the higher A-agree
  median. The second-best arm of a different model becomes the fallback.
- If the scores reverse D-KA2 and D-KA3, the probe result replaces them. That ruling is recorded in section 13.
- **Stop rule:** if no arm scores >= 3 of 6, KA stops. The probe sheet goes to the user, and no pilot calls are made.

## 4. Asset model and code changes

- **D-KA5 The AI kneel is an approved key.** Like every other key, it goes through generate -> cut / pixelize ->
  gates -> review -> `approve`.
  - Monsters and bosses: `approved/<id>/kneel.png` + `kneel.json` (one cell, the idle's cell size, `bottom_row` = the
    idle's). The name is outside the `monster_*` and `boss_*` globs, so an approved file alone changes nothing.
  - Heroes: `approved/<class>/battle_kneel.png` + `.json` (one 80x80 cell, facing left).
  - The json records: model, arm, seed, try, strength, guide hash, BR cache key, and `approved` date.
  - Existing approved files are never modified. `approve.py` refuses to overwrite a kneel without an archive copy
    (the existing rule).
- **D-KA6 Cut** (`kneel_ai.py cut`, offline):
  - Down-sample by the known k with `pixelize.pixelize(cell, mask, grid=cell, palette=approved_palette,
    bottom_row=idle bottom_row)`. `approved_palette` comes from `monster_keys.approved_palette`; heroes use
    `battle.png`'s colours.
  - Normalise the size with monster.py's `match_height` scaling. The reference is the band midpoint x idle height,
    with the band as the tolerance (KNEEL_PLAN 4, heroes per class).
  - Align x so that the base centroid (or the figure centroid for floaters) sits on the idle's. A key that is too
    tall, too short or off-centre is fixed here, never rejected.
- **D-KA7 Joints on the key** (`kneel_ai_joints.py`, offline, at most 10 s of CPU per sprite):
  1. First guess: the guide's joints. These are the template targets for biped, quadruped and mechanical, the derived
     kneel's joints where one exists, and the guide op's affine applied to the idle joints for the other bodies.
  2. A bounded fit, one pass: each part's idle pixels, posed at the guess, are searched over dx, dy in [-4, 4] and
     dtheta in {-10, -5, 0, 5, 10} deg for the best alpha IoU against the key. That is 405 small renders per part,
     with no iteration. The result goes to `keyframes.kneel` in the rig (heroes: `battle.kneel` in `anim/<class>.yaml`).
  3. Correction: the rig agent views `python3 -I assets-src/gen/monster_anim.py mark <id>` (heroes: `puppet_kneel.py
     review <class>`) and moves at most the joints that are off. Part `masks.<part>.kneel` polygons are added where
     segmentation needs them, as for `hurt`.
- **D-KA8 In-betweens** (existing machinery, unchanged rules):
  - `kneel_in1` is idle toward kneel at t 0.33 (idle pixels). `kneel_in2` is kneel toward idle at t 0.33 (key pixels).
    `kneel_b` is the breath op on the key (1-2 px). The rules are D-K5 and D-K19: near-keyframe |u| <= 0.35, and limb
    parts <= 40 deg against their source.
  - `frames.kneel_in*.tweaks` are allowed. `kneelSink` (floaters, D-K9) still comes from the block's `sink`.
- **D-KA9 One switch per sprite.** The rig block `kneel: {source: ai, sink?, paint?}` loads the approved key. `source:
  derived`, the default for existing blocks, keeps today's code path byte-identical.
  - With `source: ai`, the derived-only keys (`tweaks`, `variant`, `turn`, `pins`, `aim`, `samplers`, `z`, `erase`,
    `glow`, `prop_cap`) are refused.
  - `paint` stays allowed: FW-P keyframe paint, <= 160 px, approved palette or null.
  - The approved key is locked as **`kf:kneel`**, so the lock's name set does not change; only the 4 hashes do.
- **D-KA10 Derived path: kept behind the switch and frozen** (the recommendation). It is not removed.
  - The guides (D-KA1) and fallback F1 (D-KA14) still need `kneel.derive`, and every locked derived kneel must stay
    reproducible.
  - From KA0b on, no commit may change `kneel_templates.py`, `kneel_variants.py`, `kneel_ops.py` or the
    `source: derived` branch of `kneel.py`. Enforced by G15.
  - The K3-0 `post` / `warp` / `cut` ops and the new-body templates are **not merged** (section 5).
  - Removal is proposed at KA4 only if `kneel_tools.py coverage` reports `derived 0`.

| File | Change | Limit |
|---|---|---|
| `gen/bedrock.py` | MODELS + `style_transfer`, `control_sketch`, `search_recolor`, `erase_object` (the section 1 ids); `COST_USD` for them, from the pricing page (KA0b) | +8 |
| `gen/budget.json` | `bedrock` block -> pass `KA` (section 7, after Q1); pass C moved into a new `bedrock_history` list (doc only) | data |
| `gen/colossus.py` budget check | reads pass C's caps from `bedrock_history` once the live pass is not C | +<= 10 |
| `gen/kneel_ai.py` (new) | CLI: `guide`, `gen` (one call per command), `cut`, `gate`, `joints`, `review`, `approve`, `converted [--check-archive]`, `bodies`, `calibrate`, `budget --check` | <= 250 |
| `gen/kneel_ai_guide.py` (new) | D-KA1 | <= 200 |
| `gen/kneel_ai_gates.py` (new) | the A-checks (section 6) | <= 200 |
| `gen/kneel_ai_joints.py` (new) | D-KA7 | <= 200 |
| `gen/kneel_ai.yaml` (new) | prompts per body (section 5b), per-body strength, per-sprite overrides; read only by `kneel_ai.py` | data |
| `gen/kneel_ai_thresholds.json` (new) | calibrated thresholds (section 6), committed at KA0b | data |
| `gen/kneel.py` | `source: ai`: `add_key` loads the approved key; `prepare` takes `keyframes.kneel` from the rig; key validation | 233 -> <= 250 |
| `gen/monster_keys.py` | `kf:kneel` lock and FW-P paint for an approved kneel key | +<= 8 |
| `gen/puppet_kneel_ai.py` (new) | heroes with `source: ai`: the key from `battle_kneel.png`, `battle.kneel` joints, the in-betweens through `puppet_kneel_render._tween` (ready <-> kneel at t 0.33), `kneel_b` via `puppet.bob`; `puppet_kneel.kneel_frames` dispatches to it | <= 150; `puppet_kneel.py` +<= 4 |
| `gen/approve.py` | `kneel` (monster / boss) and `battle_kneel` (hero) sheets | +<= 10 |
| `gen/retire_kneel.py` (new) | `retire_kneel.py <id>` (section 5) | <= 120 |
| `gen/kneel_review.py` | the `--ai` columns: old derived, AI raw, AI key; side-by-side GIF | +<= 30 |
| `gen/kneel_tools.py` | `coverage` adds `ai N, derived N, alias N` | +<= 6 |
| `gen/selftest_kneel_ai.py` (new) + 1 line in `selftest.py` | fake `invoke`; an approved key without `source: ai` changes nothing; `source: derived` byte-identical; request-body keys; A-check failure cases (a 2-weapon fixture, a grey fill, a 2 px lift, a foreign colour); retire_kneel archive and refusal | <= 250 |
| `assets/data/debug-scenarios.yaml` | `ka_pilot` (section 8) | data |
| `src/` (TS) | **none** | 0 |

## 5. What happens to the existing derived kneels

| Group | Recommendation | How |
|---|---|---|
| **Merged on mainline:** 31 monsters + 12 heroes (24c4236) | **Keep live until replaced, one sprite at a time.** The game always has a kneel. A sprite whose AI kneel fails 3 tries keeps its derived kneel (F1) | When an AI key is approved, the rig agent runs `retire_kneel.py <id>`. It archives the rig and lock as `anim/monsters/_retired/<id>_kneel_v1.{yaml,lock.json}` (heroes: `anim/_retired/<class>_kneel_v1.*`) and byte copies of the 4 derived frames as `approved/_retired/<id>_kneel_v1/{kneel,kneel_in1,kneel_in2,kneel_b}.png`, then indexes them in `docs/RETIRED_SPRITES.md`. It refuses when a target exists with different bytes. Then the agent switches the block to `source: ai` and re-locks. Builds never read `_retired` (one-level globs) |
| **`kneel-k2-a`** (22 rigs, 4 locked), **`kneel-k2-c`** (20, 0 locked) | **Do not merge; keep as tags** | `git tag archive/kneel-k2-a kneel-k2-a` (and the same for k2-c). Branches and worktrees stay untouched; nothing is deleted. Their sprites get AI kneels. A 3-try failure there falls to F2 |
| **`kneel-k3-0`** (8 locked, 9 shared files) | **Do not merge; keep as a tag** (`archive/kneel-k3-0`) | Its 8 locked kneels depend on the 9 shared files, which would need a D-K18 re-check of every locked id. They are rendered once, read-only, from a temporary detached worktree (`/tmp/ka1/k3-0`, removed afterwards) as the "old" column for cobra and green_slime in the pilot |
| `kneel-k2-e` | already merged (0 ahead) | nothing |

**Locks.** Lock files only gain entries. D-K18 step 6 is the relock path:

- A converted id changes exactly its 4 kneel hashes. Its names stay the same, because the AI key is `kf:kneel`.
- An id that is new to kneeling gains the 4 entries.
- The gate is G2: `lockdiff --base 24c4236 --relock $(kneel_ai.py converted)` must print `0 changed, 0 removed`.
- An unconverted locked id stays byte-identical, which G1 shows as `<id>: OK` against its unchanged lock.

### 5b. Prompts (in `gen/kneel_ai.yaml`; the same text for every try unless overridden)

`{subject}` is the sprite's `monsters.yaml` `prompt` (heroes: `characters.yaml` `prompt` + `battle_gear`). `{facing}`
is "facing right" for monsters and "facing left" for heroes; `{opposite}` is the other side.

**Style suffix (all bodies):** "16-bit SNES JRPG battle sprite of the same character, crisp pixel art, bold black
outline between every part, flat cel shading with three tones per colour, the same limited palette, light from the
upper left, {facing}, whole figure in frame, plain flat magenta background".

**Negative (all bodies):** "standing upright, attacking, jumping, lying dead, knocked out, extra limbs, extra
weapons, duplicate weapon, missing weapon, second character, different character, new colours, gradient, soft
shading, blur, anti-aliasing, 3d render, photo, text, watermark, ground, floor, shadow on ground, scenery, cropped,
{opposite}".

| Body (count) | Pose text: "{subject}, ..." | Extra negative |
|---|---|---|
| biped (46, without the 3 mechanical bipeds) | kneeling on one knee, the far knee on the ground, the near foot planted, torso bent forward, head bowed low looking at the ground, arms hanging, the weapon held low with its tip toward the ground, exhausted | sitting, both knees up |
| mechanical (iron_golem, soldier, warmech, guardian) | a heavy machine powered down, kneeling on one knee, armoured torso slumped forward, head lowered, arms hanging heavily, the same plating and joints | broken apart, sparks, smoke |
| robed (5 hero classes; monster rigs with a `cloth` part or a robe in their prompt, listed by `kneel_ai.py bodies`) | kneeling on one knee, the robe pooled on the ground around the legs, torso bent forward, head or hood bowed low, hands resting on the knee, staff or rod held low | legs showing through the robe |
| quadruped (27, without guardian) | lying down on its belly with the legs folded under the body, head lowered to the ground between the forepaws, tail lying flat on the ground, wings folded (if any), exhausted | standing on four legs, on its back |
| bird (5) | crouching low on the ground, legs folded, wings drooping to the ground, neck bent and head lowered, beak near the ground | flying, spread wings |
| floating (14; red_piranha and white_shark use swimmer) | sagging lower in the air, the body drooping, head and eyes turned down, arms, tendrils or fins hanging limp | touching the ground, standing |
| swimmer (shark, red_piranha, white_shark) | listing nose-down and sinking, fins hanging limp, tail drooping | upside down, belly up |
| serpent (8) | coiled low and flat on the ground, the coils pressed down, head lowered to rest on the coils, mouth closed | rearing up, striking |
| naga (5) | slumped forward onto its coiled tail, upper body bent low, head bowed, arms hanging | rearing up |
| arthropod (7) | legs splayed flat, body lowered onto the ground, head, pincers and stinger drooping down | legs in the air, on its back |
| blob (4) | slumped and flattened into a wide low mound, sagging, eyes looking down | splashing, splitting into pieces |
| rooted (2) | wilting, stalks and vines drooping toward the ground, head bowed, the root mass slightly sagged | uprooted |

- **Seeds:** 1234 / 1235 / 1236 (D-KA4).
- **Aspect:** 1:1, the 1024x1024 guide canvas. The figure sits at the idle cell's scale and the ground line at the
  idle's row, so framing comes from the guide, not from words.

## 6. Identity and quality gates (in order; all binary)

**Automated A-checks** (`kneel_ai.py gate <id> --try N`, < 10 s; on the cut key unless marked "raw"):

| Check | Rule |
|---|---|
| A-alpha | binary alpha (existing `binary_alpha`) |
| A-pal (raw) | figure pixels of the raw output, block-averaged to native: mean dE76 to the nearest approved colour <= T_pal_mean (default 12), p95 <= T_pal_p95 (default 25) |
| A-grey (raw) | <= 3 % of figure pixels have chroma C* < 6 and are farther than dE 10 from every approved neutral colour |
| A-hist | L1 distance between the kneel's and the idle's colour-area histograms <= T_hist |
| A-adj | Jaccard of the sets of 4-adjacent colour pairs, kneel vs idle, >= T_adj |
| A-feat | for each feature colour (idle area < 4 %, not the outline colour): component count <= idle + 1 (no duplicated weapon or eye); total feature area >= 0.40 x the idle's (nothing dropped) |
| A-outline | share of boundary pixels in the outline colour >= the idle's - 0.08 |
| A-pieces | 8-connected components <= the idle's (`keep_pieces: all_in_cell` sprites: <= idle + 1); no detached pixels (existing) |
| A-agree | share of pixels with the same colour as the guide, over the guide and output overlap, >= 0.50 (A1 / A2 / B arms) |
| A-base | base centroid x within +-0.10 x idle width of the idle's |
| A-head | after D-KA7, the crown / head joint is lower than the idle's by >= 0.15 x the idle height (bodies with a head joint) |
| K-ground, K-height, K-fit | existing `kneel_checks` (body band, or hero class band) |

- **T_hist and T_adj:** `kneel_ai.py calibrate` (KA0b, offline) measures the approved **idle vs hurt** pairs of all
  123 sheets and the hero ready vs hurt pairs. T_hist is their 95th percentile and T_adj their 5th percentile; the
  hurt pairs are approved, so their identity counts as correct.
- **T_pal:** taken from the hero `battle_raw.png` -> `battle.png` pairs (the raw-to-approved error of approved art).
- **Pinning:** the values are written to `kneel_ai_thresholds.json` and recorded in section 13 before any paid call.
  After KA1-P they may only tighten. The defaults above are placeholders.

**Independent review agent** (a multimodal agent spawned fresh for each sprite):

- **Inputs:** only `review/<id>_try<N>.png` (idle, guide, raw at native x4, key at x4, hurt / down, ground line) and
  `<id>_ai.gif`, plus this rubric. It never sees the generator's notes.
- **Rubric** (all must pass):
  - R1: the same character (face, colours, costume, weapon count and hand).
  - R2: the pose reads as kneeling with the head down at x1 and x4, and is distinct from `hurt` (monsters) or `down`
    (heroes).
  - R3: the house style (crisp pixels, outline, light from the top left, no AI smear).
  - R4: the in-between GIF moves without pops, tearing or a sideways jump.
  - R5: no artefacts (extra limbs, fragments, specks).
- **Verdict:** one line, `<id> try N: PASS` or `<id> try N: FAIL R<k>: <reason>`. A FAIL triggers the next D-KA4 try.
  At most **3 tries per sprite**, then D-KA14.

**Animation and lock gates:** after joints and in-betweens, `python3 -I assets-src/gen/monster_anim.py check <id>`
must print `<id>: OK` (heroes: `puppet_kneel.py check <class>` -> `<class>: OK`). Only then `lock`, then commit. At
most 3 rig iterations per sprite, all offline. They never trigger a new image.

**User review:** U1-KA (pilot, section 8) and one final contact sheet at KA4. Between them, the orchestrator and the
review agent judge, as in KNEEL_PLAN 13 (R7 hand-off), and every 3-try limit hit is reported.

## 7. Budget and cost (user approval required: Q1)

Images per try: 1 (cut, gates, joints and in-betweens are offline). Tries per sprite: at most 3.

| Purpose | Scope | Cap (= sprites x 3) |
|---|---|---|
| `ka_probe` | KA1-P: 6 sprites x 4 arms + 2 inpaint | 26 |
| `ka_pilot` | KA1: 6 sprites | 18 |
| `ka_bodyprobe` | KA3-0: 6 new-body probes | 18 |
| `ka_monsters` | KA2-1/2/3, KA3-1/2/3: 113 monsters | 339 |
| `ka_heroes` | KA2-4: 10 classes | 30 |
| `reserve:<reason>` | orchestrator only; calls <= $0.08 (B7 rule kept) | 19 |
| **pass KA cap** | | **450** |

- **Cost per image** (estimates from `bedrock.COST_USD` and CHAOS_FORMS_PLAN 5.6):
  - SD3.5 Large $0.08;
  - Structure and Inpaint about $0.07;
  - Style Transfer: no estimate on record, so the plan assumes <= $0.08.
- **Confirming prices:** KA0b reads the Bedrock pricing page for us-west-2, writes each used model into `COST_USD`
  and records it in section 13. If any used model costs more than $0.10, the budget goes back to the user before
  KA1-P.
- **Worst case:** 450 x $0.08 = **$36.00**.
- **Expected:** about 255 requests (26 probe + about 1.7 tries x 135 sprites + body probes), about **$20**. The 1.7 is
  an assumption; KA1-P measures the first-try pass rate, and caps may then be lowered without the user, never raised.
- **Gemini: 0.** `cache/ledger.jsonl` is unchanged (G12).
- **Budget block** (`budget.json` `bedrock`): `{pass: "KA", cap: 450, per_purpose_caps: {...as above}, gemini_before:
  <N at KA0b>, reserve_max_usd: 0.08}`.
  - Pass C (25 of 80 used) moves to `bedrock_history`.
  - Until this block exists, the gate refuses every `ka_*` purpose, so no KA call can happen before Q1.
- **Ledger:** one BR ledger row per logical request (existing, tracked), with tool `kneel_ai.py`, purpose, seed and
  key. Each call also gets a row in `docs/ROSTER_LOG.md` "Pass KA": id, try, arm, seed, key, cost, A-check result,
  verdict. `kneel_ai.py budget --check` prints `OK pass KA <used>/450` and fails on any purpose over its cap or any
  Gemini attempt after `gemini_before`.
- **Compute against pass K:**
  - Pass K made 0 paid images but spent about 9 h of wall clock for 43 of 135 sprites, plus the reported CPU hours of
    parameter search per batch.
  - Pass KA has **no parameter search**: one fixed guide, a fixed try schedule and one joint-fit pass.
  - Per sprite and try: one remote call (about 10-20 s, no local CPU), cut and gates < 10 s, joints <= 10 s, and one
    `check <id>` (83 s measured), so about **2 min of CPU**. The lock adds one more check.
  - Ceiling: <= 3 tries x 2 min + 1.5 min, about **7.5 CPU-min per sprite worst case**. It is logged per sprite
    (`/usr/bin/time -p`), and a sprite over 10 CPU-min is reported.

## 8. Pilot (KA1)

**Sprites:**

| Sprite | Why |
|---|---|
| goblin, wolf, warrior, white_mage | the K1 set, for a direct comparison |
| green_slime (blob) | the hardest non-humanoid |
| cobra (serpent) | the hardest non-humanoid |

All 6 run the probe (KA1-P), then the full pipeline with the chosen arm. The probe image of the chosen arm counts as
try 1.

**Artefacts for the user** (untracked, under `assets-src/gen/out/kneel_ai/review/`):

| File | Content |
|---|---|
| `probe_sheet.png` | rows = the 6 sprites; columns idle, guide, A1, A2, B, C, D (where run), each cut to native at x4, with the A-check values under each |
| `<id>_compare.png` | idle / ready, **old derived kneel** (mainline; cobra and green_slime from the `kneel-k3-0` tag), AI raw (x4 of native), **AI kneel key**, kneel_in1, kneel_in2, kneel_b, hurt / down; x4, ground line, height and band, A-check values |
| `<id>_side.gif` | the old and AI kneel sequences side by side: in 8 f, 2 sway cycles (period 48), out 6 f, stand 24 f, 16.7 ms per frame |
| `goblin_rise_ai.gif` | kneel -> rise (6 f) -> attack table -> kneel_in (8 f) -> hold, at game timing |
| `pilot_stage_ai.png` | all 6 kneeling at game scale on `grassland.webp` at their battle slots |
| `pilot_numbers.txt` | per sprite: calls used, the chosen try, every A-check value, CPU seconds |
| browser | `npm run dev`, then `http://localhost:5173/?mute=1&scenario=ka_pilot&battleStep=1&poseLabel=1` -> `/tmp/ka1/pilot_battle_{1,2,3}.png`, the scripted capture of KNEEL_PLAN 8 |

The `ka_pilot` scenario is the `kneel_pilot` party with the enemies `[goblin, wolf, cobra, green_slime]` and
`enemyStatus {0: [poison], 1: [sleep], 2: [stun]}`. Green_slime is the status-free control. A scenario test checks
`formationFits`.

- **KA1 commits:** the tooling, the 6 approved keys, the rigs, locks and archives, and the rebuilt atlases, so the
  user sees the pilot in the browser (as K1 did).
- **U1-KA:** the user rules on each sprite (approve or reject) and on proceeding. The rulings go into section 13. No
  KA2 work starts before that commit.
- **Pass:** the user approves >= 4 of 6. Otherwise the plan is revised (rev 2) before any rollout spend.

## 9. Rollout

| Batch | Sprites | Purpose |
|---|---|---|
| KA2-1 biped A (24) | astos black_knight bloodbones buccaneer chaos clay_golem dark_fighter dark_wizard death_knight drowned_sovereign earth_elemental fire_gigas gargoyle garland ghast ghoul gr_imp hill_gigas horned_devil ice_gigas iron_golem king_mummy lich mindflayer | ka_monsters |
| KA2-2 biped B (24) | minotaur minotaur_zombie mummy ogre ogre_chief ogre_mage pirate piscodemon rakshasa sahagin sahagin_chief sahagin_prince sea_troll skeleton soldier stone_golem troll vampire vampire_lord warmech weretiger werewolf wight zombie | ka_monsters |
| KA2-3 quadruped (27) | baretta basilisk blue_dragon chimera crazy_horse crocodile desert_baretta dragon dragon_zombie fire_hydra fire_lizard gr_wolf green_dragon guardian hellhound hydra hyenadon lesser_tiger lizard manticore nightmare rhyos sabertooth sphinx white_crocodile white_dragon winter_wolf | ka_monsters |
| KA2-4 heroes (10) | knight thief ninja monk master red_mage; robed: black_mage black_wizard red_wizard white_wizard | ka_heroes |
| KA3-0 body probes (6), orchestrator and review agent | cockatrice (bird), ghost (floating), shark (swimmer), water_naga (naga), scorpion (arthropod), ochu (rooted) | ka_bodyprobe |
| KA3-1 floating (13) | air_elemental bigeyes death_eye deepeyes evil_eye fire_elemental hollow_seraph red_piranha shadow specter water_elemental white_shark wraith | ka_monsters |
| KA3-2 serpent / rooted / naga (12) | anaconda gigas_worm lava_worm purple_worm sand_worm sea_snake wyrm; neochu; ashen_queen earth_medusa medusa spirit_naga | ka_monsters |
| KA3-3 bird / arthropod / blob (13) | allosaurus pyrolisk tyrannosaur wyvern; ankheg black_widow crawler remorazz sea_scorpion tarantula; black_flan gray_ooze ochre_jelly | ka_monsters |

Totals:

- Monsters: 4 (pilot) + 24 + 24 + 27 + 6 + 13 + 12 + 13 = **123**.
- Heroes: 2 (pilot) + 10 = **12**.

KA3-1/2/3 start only after KA3-0 passes, meaning >= 4 of 6 pass R1-R5; the result goes into section 13.

**Roles and machine limits:**

- **Generator:** one process, **main checkout only**. It makes every Bedrock call, one at a time, as a background
  command waited on with Monitor. It runs cut, gate and review sheets right after each call, and runs `approve` on a
  review PASS. It then commits `KA2-1: <id> kneel key approved (try N)` on mainline, with only the `approved/<id>/kneel.*`
  files and the ROSTER_LOG row.
- **Rig agents:** at most 2, in worktrees (`git worktree add /tmp/ka-wt/<batch> -b ka-<batch> mainline`). Each rebases
  on mainline for new keys, then runs `retire_kneel.py` (converted ids), `joints`, mark review, `check`, `lock`, and
  commits per sprite (`KA2-1: <id> AI kneel rig + lock`). Rig agents never call Bedrock (the gate refuses worktrees
  anyway) and never commit anything under `assets/`.
- **Limits:** at most **3 Python processes** at once (generator + 2 rig agents), each with `OMP_NUM_THREADS=1
  OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1`. The review agent views PNGs and runs no Python.
- **Never** `git add -A`. Scratch code goes to `/tmp/ka*/` only. G11 applies.
- **Integrator:** the only role that rebuilds and commits atlases. Per batch it merges the rig branches (disjoint
  files), runs `python3 -s assets-src/build_assets.py monsters_ai battle_ai` and gates G1-G16, and commits `KA2: atlases
  (<batches>)`.

**Gates** (every batch merge and KA4; command -> expected):

| # | Command | Expected |
|---|---|---|
| G1 | `python3 -I assets-src/gen/monster_anim.py check --all \| grep -vc ': OK'` | `0`, and `grep -c ': OK'` = `123` |
| G2 | `python3 -I assets-src/gen/kneel_tools.py lockdiff --base 24c4236 --relock $(python3 -I assets-src/gen/kneel_ai.py converted)` | last line `<n> added, 0 changed, 0 removed`; no `FAIL` line; exit 0 |
| G3 | `python3 -I assets-src/gen/kneel_tools.py coverage` | the running count; KA4: `monsters 123/123, heroes 12/12` with `alias` = the D-KA14 F2 count |
| G4 | `PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum assets/sprites/monsters-ai* assets/sprites/battle-characters-ai* > /tmp/ka.sha && PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai battle_ai && shasum -c /tmp/ka.sha` | every line `OK` |
| G5 | `python3 -I assets-src/gen/kneel_tools.py pages --base 24c4236` | every page <= 2048x2048; <= 12 pages; `preload` <= 2; anchor fields identical |
| G6 | `python3 -I assets-src/gen/kneel_tools.py party-diff --base 24c4236` | `12 rows x 14 old columns identical; width 2880` |
| G7 | `git diff --stat 24c4236 -- src assets/sprites/characters* assets/sprites/colossus*` | empty (TS runtime unchanged) |
| G8 | `python3 -I assets-src/gen/selftest.py` | last line `ALL PASSED` |
| G9 | `npm run build` | exit 0 |
| G10 | `npm test` | all passed; tests >= 5063 (the K1 floor) and >= the KA0b count (section 13) |
| G11 | `git status --short` | no scratch files |
| G12 | `git diff --stat 24c4236 -- assets-src/gen/cache/ledger.jsonl` and `python3 -I assets-src/gen/kneel_ai.py budget --check` | empty, and `OK pass KA <used>/450` |
| G13 | `git diff --name-status 24c4236 -- assets-src/gen/approved \| grep -vE '^A\s.*/(kneel\|battle_kneel)\.(png\|json)$\|^A\s.*/_retired/'` | empty (approved art only gains files) |
| G14 | `python3 -I assets-src/gen/kneel_ai.py converted --check-archive` | `OK`: every converted id that had a derived kneel at 24c4236 has its `_kneel_v1` archive |
| G15 | `git diff --stat 24c4236 -- assets-src/gen/kneel_templates.py assets-src/gen/kneel_variants.py assets-src/gen/kneel_ops.py` | empty (D-KA10 freeze) |
| G16 | `python3 -I assets-src/gen/colossus.py budget --check` | `OK` (pass C history intact) |

**KA4 integration:**

- The K4 play test of KNEEL_PLAN 10 is reused as is (`kneel_k4_armour`, `kneel_k4_light`, `kneel_k4_robed`, the
  adversarial checklist, `?mute=1`, 0 console errors), with screenshots in `/tmp/ka4/`.
- The final user contact sheet `ka4_sheet.png` shows all 135 kneel keys at x2, with F1 / F2 sprites marked.
- Docs: the AGENTS.md "Monster animation" and pipeline rows (AI kneel key, `kneel_ai.py`, pass KA budget, the
  2026-11-13 note qualified to "in-betweens", since a key is not an in-between), `assets-src/gen/README.md`,
  `docs/NEW_MONSTER_GUIDE.md` (a new monster gets its kneel key with its other keys), `docs/PROGRESS.md`, and a
  "superseded by KNEEL_AI_PLAN for D-K4" note in KNEEL_PLAN.

## 10. Risks

| Risk | Mitigation / measure |
|---|---|
| **Identity drift** (face, costume, colours) | the init is the approved pixels; palette lock; A-pal / A-hist / A-adj / A-agree; R1 |
| **No identity after 3 tries** | **D-KA14:** F1 keeps the locked derived kneel where mainline has one (43 ids); otherwise F2 is the D-K7 alias chain (`kneel -> daze`, heroes `ready`): no new frames, today's look on kneel timing. Each case is reported as `LIMIT: <id> 3 tries: <last FAIL line>`. A 4th try only comes from `reserve` by orchestrator note |
| **Palette breaks** (new colours) | offline snap to the approved palette, so new colours are impossible; A-pal catches a raw too far off to snap well |
| **Weapon duplicated or missing** | negative prompt; A-feat component and area bounds; R1 |
| **Guide anatomy too broken for strength <= 0.55** | try 2 raises strength by 0.10; try 3 is Style Transfer (more change, reference-anchored); KA1-P measures it per body |
| **Palette-swap variants** (none today; `monsters.yaml` shares sheets) | the atlas recolours the kneel key and in-betweens like every frame, and its variant palette lock (`monster_atlas.py:154-161`) fails a missing mapping |
| **Size and anchor changes** | the cutter normalises height into the band and x onto the base centroid (D-KA6); A-base; K-anchor and G5 unchanged (kneel frames stay out of `HOME_FRAMES`, D-K8) |
| **Atlas page budget** | the cell count is unchanged (4 kneel cells per sheet, cut to the idle cell), so the KNEEL_PLAN 1 projection holds (<= 12 pages, act-1 on pages 0-1, pinned); G5 |
| **In-between breaks on an AI key** (segmentation, a 40 deg cap) | D-KA7 joints plus `masks.<part>.kneel`; 3 offline rig iterations; then D-KA14 |
| **Content filter or API error** | counted as spent (gate rule); the try moves to the next seed; a model with 2 consecutive errors is reported |
| **Cost overrun** | the gate's pass and purpose caps cannot be bypassed; `budget --check` after each call |

## 11. Open questions for the user (each with its default)

1. **Q1 Budget:** approve Bedrock pass KA at **450 requests** (worst case about $36, expected about 255 requests,
   about $20), with the per-purpose caps of section 7, pass C closed into history at 25 of 80, and 0 Gemini?
   Default: **approve 450**.
2. **Q2 Review:** user review at the pilot (U1-KA) and at the KA4 contact sheet only; the rest by the orchestrator
   plus the independent review agent, with every limit hit reported? Default: **yes**.
3. **Q3 Fallback after 3 failed tries:** F1 (keep the derived kneel) where one exists, else F2 (daze alias); no 4th
   try except from the reserve? Default: **yes**.
4. **Q4 Branches:** freeze `kneel-k2-a`, `kneel-k2-c` and `kneel-k3-0` as `archive/` tags, unmerged, with nothing
   deleted? Default: **yes**.

## 12. Acceptance criteria for pass KA

```json
{
  "functional": [
    "every one of the 123 monster sheets and 12 hero classes shows a kneel made from an approved AI key, or is listed as F1 / F2 under D-KA14",
    "kneel_in1 / kneel_in2 / kneel_b come from the existing in-between machinery between idle (ready) and the approved key",
    "the TS runtime and the frame names are unchanged"
  ],
  "observable": [
    "U1-KA: the user approves >= 4 of 6 pilot sprites from <id>_compare.png and <id>_side.gif",
    "KA4 contact sheet of 135 keys with F1 / F2 marked",
    "ROSTER_LOG 'Pass KA' has one row per Bedrock request"
  ],
  "pass_fail": [
    "G1-G16 as tabled in section 9 at every merge and at KA4",
    "kneel_ai.py budget --check prints OK pass KA <used>/450, and used <= 450",
    "every approved key passes all A-checks and R1-R5 before approve",
    "git diff --stat 24c4236 -- src is empty"
  ]
}
```

## 13. Rulings and tuning log

| Date | Item | Ruling / change |
|---|---|---|
| 2026-11-17 | directive | AI kneel key per sprite via Stability, with the rig doing the in-betweens (user) |

## TODOs

- [ ] U0 user answers Q1-Q4 (blocking for KA1-P; KA0b may start)
- [ ] KA0b `bedrock.py` models and confirmed prices; `budget.json` pass KA after Q1; colossus budget-check history read (high, 1h)
- [ ] KA0b `kneel_ai.py`, `kneel_ai_guide.py`, `kneel_ai_gates.py`, `kneel_ai_joints.py`, `kneel_ai.yaml` (high, 8h)
- [ ] KA0b `source: ai` in `kneel.py` / `monster_keys.py` / `monster_anim`; `puppet_kneel_ai.py`; `approve.py`; `retire_kneel.py` (high, 6h)
- [ ] KA0b `selftest_kneel_ai.py`; `calibrate` -> thresholds pinned in section 13; guides for all 135 rendered; G1-G16 green with byte-identical atlases (high, 4h)
- [ ] KA1-P probe, 26 calls; arm picked by the section 3 rule, recorded (high, 2h)
- [ ] KA1 pilot of 6 sprites; artefacts; `ka_pilot`; atlases committed (high, 6h)
- [ ] U1-KA user review; rulings in section 13 (blocking)
- [ ] KA2-1 / 2-2 / 2-3 / 2-4: 75 monsters + 10 heroes, integrator per batch (medium, about 5h each)
- [ ] KA3-0 body probes (6), review; then KA3-1 / 3-2 / 3-3 (38 monsters) (medium, about 4h each)
- [ ] KA4 play test, contact sheet, docs, final gates, branch tags (high, 4h)

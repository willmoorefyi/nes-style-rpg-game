# New monster creation guide

How to add an enemy end to end: Gemini base frames, rigged in-betweens and validation. It sums up the lessons of the
act-1 rollout (12 rigs, tranches T1-T6, fixes E1-E18). Background: `docs/ART_MONSTERS_PLAN.md` (base art),
`docs/ENEMY_ANIM_PLAN.md` (in-betweens, checks, probes) and `docs/ENEMY_ANIM_ISSUES.md` (defects and their root causes).

**Contents:** [0 Gotchas](#0-gotchas-read-first) · [1 Base frames](#1-base-frames-gemini) · [2 Animation
frames](#2-animation-frames-rig) · [3 Validation](#3-validation) · [4 Troubleshooting](#4-troubleshooting-symptom--cause--fix)

## 0. Gotchas (read first)

- **Secrets:** Gemini uses `GEMINI_API_KEY` from the git-ignored `.env`. Never print it, `cat` the file or commit it.
- **`python3 -I` ignores `PYTHONHASHSEED`** (`-I` implies `-E`). Use `python3 -I` for normal runs. To build with a
  *given* hash seed (the determinism check), use `PYTHONHASHSEED=n python3 -s ...`.
- **`assets-src/gen/refs/` is git-ignored and exists only in the main checkout**, so paid runs belong there. In a
  worktree the full `selftest.py` fails `size reference ... missing`: run `selftest.py --anim` (monster pipeline only)
  there, and the full selftest in the main checkout.
- **Style lock:** files under `assets-src/gen/approved/` are never edited after approval. Fixes go in the rig
  (masks, tweaks, `paint`), never in the PNG.
- **No AI for in-betweens.** Bedrock/Stability was tried and rejected on 2026-11-13: no identity lock, img2img
  redraws the figure, inpainting comes back grey. Bedrock is not counted against the Gemini cap, but don't use it here.
- **The atlas is binary, with one owner.** Build it locally to test in the browser, then restore it before committing a
  rig (`git checkout -- 'assets/sprites/monsters-ai*'`, then delete any new untracked `monsters-ai-<n>.png`); one
  integrator commits it. The atlas is paged (ROSTER_PLAN 8): `monsters-ai.json` lists `pages` and each sheet's `page`.
- **Browser runs always add `?mute=1`.**

## 1. Base frames (Gemini)

### 1.1 Declare the monster in `assets-src/gen/monsters.yaml`

```yaml
- id: hobgoblin            # = the enemy's `sprite` in assets/data/enemies.yaml
  size: small              # small (80 px cell, figure 56-72, feet row 76) | large (128, 96-120, 122) | boss
  prompt: >-               # the look only; keep it to the design
    stocky orange hobgoblin with ..., holding a spiked mace
  attack: lunging forward and swinging the mace down at the heroes
  hurt: knocked back, flinching, mace arm thrown back
  face: optional readability rule (skulls, wrappings)
  seeds: [1234]            # tried in order; put the approved seed first
  variants:                # palette swaps: no images, recoloured at build time, outline unchanged
    - {id: hob_chief, hue: -40, sat: 1.1}         # or {id, map: {"#rrggbb": "#rrggbb"}}, or val:
```

- **Bosses** add `size: boss`, `per_pose: true`, `design_ref: false`, `action_prompt` and `cast`: one request per pose,
  200x200 cell, feet on row 192. Optional: `extra_negative`, `haze: true` (mist keyed out), `sheet_seeds: {boss_attack:
  1235}` (redraw one pose, other cache keys unchanged). `floating: true` = one shared offset, no ground line.
- **Separate floating pieces** (any sheet): `cut: {keep_pieces: all_in_cell}` keeps every piece inside the figure's
  own cell (the default keeps only the largest blob and blobs near its box; specks under 24 native px, thin guide lines
  and pieces touching the cell border are still dropped); no cache key changes (`selftest_pieces.py`).
- **Headroom** (any sheet, combinable with `keep_pieces`): `cut: {fit: headroom, top_margin: N}` (N 1-32) shrinks a
  figure that would reach above row N, nearest-neighbour, to fit rows N..feet row (feet stay on the feet row); a figure
  already clear of row N is cut unchanged; no cache key changes, so a ledgered attempt re-cuts at 0 images with
  `generate.py --repixelize out/gemini/<id>/<seed> --sheets <sheet>`, which says whether `approve.py` can approve it
  (`selftest_headroom.py`).
- **Size is normalised, never a rejection reason** (user ruling 2026-11-16): a pose too big or too small is resized in
  the pipeline, not rejected or regenerated. Per-pose sprites: `cut: {match_height: idle, tolerance: 0.10}` (or an
  integer px reference; combinable with `keep_pieces` and `fit: headroom`) scales an action pose whose figure is
  outside the approved boss_idle's height +- tolerance, nearest-neighbour, to the nearer band edge (feet on the feet
  row, every piece kept, capped by the headroom rows); a pose inside the band and the idle are cut unchanged; a
  non-integer nearest scale stair-steps diagonals (an upscale doubles single rows, worse than a shrink); no cache key
  changes, re-cut at 0 images with `--repixelize` (R328: 183 -> 150 px against the 138 px idle; `selftest_match.py`).
- **Titan** (`size: titan`, FW-T, chaos only): per-pose, 300x300 cell, feet row 292, figure 258-278 art px (top row
  >= 15). The cut is fail-closed: a render that would need a rescale (`info["scale"] != 1.0`) or has no detectable pixel
  grid (mode not `grid`) raises, and the attempt counts as rejected. Check cached renders offline first:
  `python3 -I assets-src/gen/monster.py --titan-probe <raw.png ...>`.
- **Display scale** (FW-S): only integer screen scales. A sheet listed in `assets-src/gen/monster_scale.yaml`
  (`{sprite: 3}`, values 2 or 3) gets that `scale` in the atlas JSON; pixels, rigs and locks are unchanged.
- New entries get prompt rev 3 (omit `prompt_rev`). **Reuse first:** a `variant` costs 0 images and inherits every rig
  frame; a new enemy on an existing `sprite:` costs nothing.

### 1.2 Templates and reference images (what a request sends)

| Input | Source | Notes |
|---|---|---|
| Layout guide | `monster.guide()` / `pose_guide()` in `gen/monster.py` | Per cell: a light-grey size box at the band height, the ground line and a facing arrow (right, toward the party). The guide is 1680x720 (21:9) for 3-pose sheets and 1024² for a boss pose. |
| House style | `approved/knight/battle.png` (`spec.HOUSE_REFS["battle"]`) | Pixel size, outline and shading; the costume is not copied. |
| Monster style | `approved/ogre/monster_large.png` (`spec.MONSTER_STYLE_REF`) | Rev 3+ only; old sprites are never sent. |
| Identity (boss) | the approved `approved/<id>/boss_idle.png` | Sent with attack, cast and hurt, so **approve `boss_idle` first**. |
| Prompt | `monster.prompt()` / `pose_prompt()`, plus your `prompt`/`attack`/`hurt`/`cast`/`face` | `MONSTER_NEGATIVE` in `spec.py`. |

`refs/style_reference.jpg` and `kits.yaml` belong to the party and map-tile pipelines. Monsters don't use them.

### 1.3 Budget guard and ledger

- `--backend gemini` is required (monster sheets are Gemini-only); uncached requests need `--paid`; at most
  `--max-paid` (default 1) per run: **one request per review checkpoint**.
- Every attempt is logged in `assets-src/gen/cache/ledger.jsonl` *before* the call; failures count as spent. A second
  attempt at the same id+sheet needs `--retry`, which needs **user approval**.
- `assets-src/gen/budget.json` is the run cap (pass V since 2026-11-16: 50 images after `attempts_before` 367,
  `max_attempts_per_sheet: 3`, the open pass's `only_ids` / `only_sheets`; `history` is documentation, never read). The
  guard refuses everything when the budget is inconsistent. Only the user can raise it (`selftest_passv.py` pins it).
- **Redesigning an approved sprite:** archive it first, `python3 -I assets-src/gen/retire.py <id>` (committed before
  the first paid request; `docs/RETIRED_SPRITES.md`). `approve.py` refuses to overwrite a `monster_*` / `boss_*` sheet
  without a byte-identical archive copy. In the commit that approves the first new sheet run `retire.py --move-rig
  <id>` (and for a boss's new idle `retire.py --prune <id> boss_attack boss_cast boss_hurt boss_attack_raise`).

### 1.4 Generate, review, approve

```bash
python3 -I assets-src/gen/generate.py hobgoblin --backend gemini --sheets monster --dry-run   # 0 cost: PAID/cached + inputs
python3 -I assets-src/gen/generate.py hobgoblin --backend gemini --sheets monster --paid      # the one paid call
python3 -I assets-src/gen/generate.py --repixelize assets-src/gen/out/gemini/hobgoblin/1234   # offline re-cut
# FW-C: a floating cell drawn lower than the idle is lifted to the 2 px bottom margin (info['lifted']; at most monster.LIFT_MAX = 36 px, else the cut is refused)
python3 -I assets-src/gen/approve.py hobgoblin monster [--flip-frames row:1] [--note "..."]   # mirror one wrong-facing cell
# bosses: --sheets monster means boss_idle only; then boss_attack, boss_cast, boss_hurt, one checkpoint each
python3 -I assets-src/gen/generate.py lich --backend gemini --sheets boss_attack --paid
python3 -I assets-src/gen/approve.py lich boss_attack
```

Output: `assets-src/gen/out/gemini/<id>/<seed>/` (`*_guide`, `*_raw`, the cut sheet, `review.png`, `frame_report`:
heights, bottoms, colours, outline, pose_diff, `flat_edges` / `edges_ok`). **The 3-pose cutter splits at the figure gaps**
(`monster.split_cells`, since roster batch C): a piece that crosses a third line of the raw moves whole into the cell
holding most of it (that cell widens; `frame_report` lists it under `split`), so a reach is no longer sliced flat; with
nothing crossing, the cut is the old fixed thirds byte for byte, and two figures fused across a line keep the thirds.
`flat_edges` flags a straight run of 3+ edge pixels with no outline ink (a slice). Approved sheets were cut with the
thirds (`cut(..., split="thirds")`) and are never re-cut. `approve.py` writes `approved/<id>/monster_<size>.{png,json}` or
`boss_<pose>.*` and un-ignores the raw render; commit those, their `cache/<key>.{png,json}` and `ledger.jsonl`.

**Base-sheet review checklist.** All must hold before you approve. A wrong base sheet makes every in-between harder.
- [ ] Binary alpha. At most 16 colours per file, with the shared outline colour present in every frame.
- [ ] The figure height is in the band (±10 %). The lowest opaque row is exactly the band's feet row in every frame.
- [ ] No opaque pixel on the 1 px border, and **headroom** for overshoots (`atk_follow`, `cast_release` go 10 % past
      the key): edge-to-edge attacks (goblin x2-78 of 80, lich x9-190 of 200) forced clamps and settles.
- [ ] `edges_ok` (no limb, weapon, snout or tail sliced flat; compare the raw if `flat_edges` names a run).
- [ ] Every frame faces right; attack and hurt each differ from idle by ≥ 15 % (`pose_diff`).
- [ ] Props drawn whole and attached. A prop that appears or vanishes between keys costs carry rules (D8) or a pop.
- [ ] No grey guide box, no stray props or sparks outside the figure, a readable face; bosses: the four pose files
      read as one palette (the checks allow the union of their colours, the eye does not).
- [ ] Animatable: huge idle→attack/hurt changes (rear-up, 180° weapon flip, cape into wings) cap the in-betweens.

**Log it** in the current run's table of `docs/ACT1_LOG.md` (`| # | <id>/<sheet> (seed) | 1 | measured result |
decision |`, plus "Images used: N of 100"). Self-approve only if the user authorised it for the run.

**Pass V lessons (redesigns, 2026-11-16; `docs/ROSTER_LOG.md` "Pass V").**
- **Retire before you regenerate.** `retire.py <id>` and its commit come before the first paid request; `--move-rig`
  (and a boss's `--prune`) go in the commit that approves the first new sheet, so no old rig ever runs on new pixels.
  Add the `docs/RETIRED_SPRITES.md` row from the line `retire.py` prints. The archive is never built or checked; a
  retired look comes back only through `retire.py --revive <id>_vN --as <new_id>`.
- **Re-cut before you re-buy.** `cut:` options change no cache key, so a ledgered render that failed on headroom or on
  dropped pieces is re-cut at 0 images (`generate.py --repixelize ...`). `fit: headroom` rescued hollow_seraph (R309
  -> R313, `top_margin: 10`) and the red dragon (R312 -> R320, `top_margin: 4`) after both sheets were at 3 of 3.
- **`keep_pieces: all_in_cell` for designs made of separate pieces** (the seraph's hovering plates and blade wings):
  the default `_figure_mask` keeps the largest blob and blobs near its box and silently drops the rest (R298 lost its
  wings). Ask in the prompt for each piece to touch or nearly touch the main mass, then compare render and cut piece by
  piece before approving.
- **Counts:** name every limb, wing or orb with its count and image side ("exactly two arms", "four blade wings, two
  per side", each orb by colour); raised-arm poses still add or hide orbs (chaos raise: best of 3).
- **Small bright features are lost in the 10-16 colour cut** (eyes, visor slits, orb colours): draw them large, and
  plan rig `paint` fixes; very dark designs collapse to black: ask for dark grey with bright edges.
- **Size tiers come from the display scale, not the cell:** a sheet in `monster_scale.yaml` at 3 must read larger than
  the ogre (204 screen px) and its lesser siblings; a low, wide pose cannot (the old red dragon, 165 px at scale 3, was
  redrawn upright). A boss sheet at scale 3 (chaos, D-V6 = C2) is laid out as the titan class: alone, in
  `TITAN_AREA`, attacking in place (`layoutSizeOf`, `EnemyLayoutAi.ts`).

### 1.5 Wire it into the game

1. Add `assets/data/enemies.yaml` with `sprite: <id>` (or a variant id), stats and rewards.
2. Encounters live in the map *source* (overworld: `assets-src/tools/layouts/overworld_zones.py`; hand-written
   `temple-of-fiends.yaml`); regenerate and compile per AGENTS.md "Editing a 2x Map".
3. Build the atlas with `python3 -I assets-src/build_assets.py monsters_ai`. A sheet without a rig gets `anim: false`
   and aliased frames: it plays with today's look and the new timing.
4. Run `npx vitest run tests/data/assetCoverage.test.ts tests/data/crossFileValidation.test.ts`. Every enemy needs
   an atlas sheet with every frame key, and variants must match their base's keys, `anim` flag and holds.
5. Add a browser scenario: put the id in an `anim_*` entry of `assets/data/debug-scenarios.yaml`, or add one.

## 2. Animation frames (rig)

### 2.1 Frame set and timing (`ENEMY_ANIM_PLAN.md` §3, `src/scenes/battle/enemyChoreography.ts`)

| Frame | Pixel source → toward | Default `t` | Runtime (60 fps) |
|---|---|---|---|
| `idle_b` | idle, everything above `breath_joint` (hip) 1 px down | - | idle/idle_b alternate every 36 frames |
| `atk_wind1` / `atk_wind2` | idle → attack, knees and feet pinned, dy 1 / 2 | −0.20 / −0.35 | 5 / 6 |
| `atk_mid` | attack → wind2, `planted` foot pinned | 0.35 | 3 |
| `attack` (key) | - | - | 8 (contact at t = 14: the action resolves) |
| `atk_follow` | attack, overshoot of idle→attack, feet pinned | 1.10 | 4 |
| `atk_recover` | idle → attack, knees and feet pinned | 0.30 | 5 (31 total) |
| `hurt_in1` / `hurt_in2` | idle → hurt / hurt → idle (prop carried), feet pinned | 0.35 / 0.35 | 2, 2, hurt 10, 3, 3 |
| `cast_gather` / `cast_rise` / `cast_release` | idle → cast / cast → idle / cast overshoot, cast fist +2 px | 0.25 / 0.35 / 1.10 | 6, 4, cast 10, 4, 3, 3 |

- **Near-keyframe rule:** `|t| ≤ 0.35` from the pixel source (`|t − 1| ≤ 0.35` for overshoots); joints snap to whole
  pixels. Cast in-betweens need a `cast` key; a non-boss Magic replays the attack frames in place. Lunge 24-40 px.

### 2.2 Body templates

`body: biped` (`rig.py`; joints `crown neck chest hip sh_/el_/hand_{n,f} hip_/knee_/foot_{n,f} tip`), `quadruped` and
`bird` (`rig_templates.py`: its docstring is the joint reference; see `gen/README.md`). `_n` is near, `_f` is far, and
coordinates are the approved image's own, facing right. `naga` (`rig_naga.py`, FW-3) and `floating` / `swimmer`
(`rig_floating.py`, FW-1: root `core`, no feet; the **float band** replaces check 8: the lowest row stays within ±1 of
the source's, lerped toward the target, plus the frame's `dy`; frames take a whole-body `dx` like `dy`; idle_b moves
the whole sprite). A boss sheet's cell is the widest keyframe's: narrower poses are padded centred
(`monster_anim.pad_keyframes`), so rig coordinates are in the padded cell. `two_handed` and `prop_colors`
from the plan draft are **not implemented**: rigs do these with tweaks and masks.

Roster templates (FW-2/4/6; full API in `gen/README.md` "Roster templates" and each module's docstring):

- **`blob`** (`rig_blob.py`, FW-6: slimes, oozes, jellies, flans). Joints `base` (ground, pinned in every frame; mark
  it at the top of the planted band, rows at or below it never slide), `mid`, `top`; optional pods/arms
  `sh_/el_/hand_{n,f}` from `mid` (`uarm_*`, `farm_*`). The body is `kind: shear` (rows slide sideways, never
  resampled). Frames take `squash: {sx, sy} | auto | null` (whole rows/columns removed or duplicated about the bottom
  centre; caps 0.80-1.25, area 0.85-1.15). `idle_b` sags one row. Recipe: the wind-up squashes; when the attack key
  leans far (green_slime: 10 px centroid) coil forward (`atk_wind1/2.t` 0.10 / 0.25) and settle the follow (`t` 0.80);
  a fist at the cell edge: `atk_mid: {t: 0.10, moves: [mid, top]}` (gray_ooze).
- **`serpent`** (`rig_serpent.py`, FW-2: cobra, anaconda, worms, wyrm, sea snake). Ground joints `c_f` (root), `c_n`
  (the coil's ground contacts, judged per foot), `body0` (where the body leaves the coil), `t1` (where the tail leaves
  it): pinned in every frame. Chains `body0 → body1 → neck` and `t1 → t2 → t3 → tail_tip`, `head` rigid `head →
  snout` (+ `jaw`), `coil` rigid. A tail raised only in the attack: `parts: {tail: {in: [attack]}}`. Wind: translate
  the upper body by tweaks (cobra); a big attack arch: `atk_mid: {t: 0.20, moves: [neck, head, snout]}`.
- **`rooted`** (same module: ochu, neochu). Ground `root`, `maw` and each tentacle root `k<i>_0`; chains `tent<i>`
  (`k<i>_0..k<i>_3`, i = 1..6); `lead: [1, 2]` = the tentacles that whip, the rest sway at half the motion.
  **Whole-figure translate** (`translate: true`, rooted only; any other body is an error): when the approved attack
  key draws the whole plant shifted (ochu: ~10 px left, raw idle-attack IoU 0.525 < 0.545), a frame's `dx` / `dy`
  move the whole figure, root, maw and tentacle roots included, as one rigid unit (the pixels are the untranslated
  frame shifted exactly; a frame `dy` replaces the recipe's body dy, so `dy: 0` still zeroes it). A target frame's
  shift is taken off before the pose lerp (atk_mid toward a moved atk_wind2 keeps its pose). Check 8 (the root band,
  the lowest row) and the hole check judge the frame moved back by its shift, as the float band adds `dy`. Without
  `translate` frame dx / dy never move the ground joints (neochu). Ochu: `atk_wind1/2` dx -3 / -6 (the pull-back
  meets the attack key's mass), `atk_recover` dx -5, `hurt_in1/2` dx -2 / -1, every frame `moves: []` (moving
  `k1_1` / `k2_1` creased the thick vines); the strike lives in the keyframe switch.
- **`arthropod`** (`rig_arthropod.py`, FW-4: spiders, scorpions, crawler, centipedes). Root `body`; `head`, `fang`;
  abdomen `abd → abd_end`; tail `tl0..tl3 → sting`; claws `sh_/el_/hand_{n,f}`; legs `coxa<i>_<s> → knee<i>_<s> →
  tip<i>_<s>` (i = 1..4, one `leg<i>_<s>` chain each, IK). Every tip is a pinned foot. Keep the legs out of `moves`
  (the body moves, the IK bends the knees), mask the abdomen, ink small leg pockets. A rear-up hurt key does not
  bridge (scorpion, black_widow): regenerate a ground-level hurt or escalate.
- **Any body:** `frames.idle_b.tweaks` (≤ 1 px per component) for wing flutter or robe sway.

FW-5 options (`rig.py` `OPT_PARTS` / `_fw5`; a part exists only when the rig marks all its joints in some keyframe,
so a rig that marks none is byte-identical):

- **Biped wings** (gargoyle, horned devil, chaos): `wsh_<s> → wel_<s> → wtip_<s>` from `chest` (s = n, f) give
  `uwing_<s>`, `fwing_<s>`, drawn behind the whole body (mask them per keyframe). The wing joints join the wind,
  follow and cast sets, so they interpolate toward the attack / cast wings; `hurt_in1` folds them with `moves` and
  tweaks (gargoyle: `moves: [crown, chest, wsh_f, wel_f, wtip_f]`).
- **Extra biped arm pairs** (chaos): `sh_/el_/hand_{n2,f2,n3,f3}` give `uarm_*`, `farm_*`; near pairs are drawn in
  front of the torso before the `n` arm, far pairs behind. Every marked arm joins the cast set; `attack_hand: [n, n2]`,
  `half_hand: [f, f2]`, `cast_hand: [n, f]` take lists, as on the naga.
- **Multi-head quadruped** (hydra, fire_hydra; chimera, rhyos, hellhound): `neck<i> → head<i> → snout<i>` (+ `jaw<i>`
  as a rig part), i = 2..5, give a `neck<i>` chain `[chest, neck<i>, head<i>]` and a `head<i>` rigid part, drawn
  behind head 1. The symbolic `head` (the daze slump) becomes every head. Heads not in `lead_heads` (default `[1]`,
  the template head) lag at half the recipe's t in `atk_wind1` / `atk_wind2` only (`monster_anim.LAG_FRAMES`); they
  strike and recoil with the lead. Every recipe set moves every head.
- **`preset: mechanical`** (warmech; soldier, iron golem): only `rigid` / `torso` / `prop` / `fx` parts and sampler
  `nearest` (rig and every frame; otherwise an error naming the rig), and every bone turns at most 15° (check 10).
  Translation-first in-betweens (`moves: []` with `dx` / `dy`).
- **Recipe notes from the prototypes.** Intertwined necks tear when they turn: translate heads and necks by tweaks
  (`moves: []`; fire_hydra). A head that swaps sides between the keys (hydra) or a 40 px stride (warmech) cannot be
  bridged under the continuity and 15° rules: regenerate the key or escalate. Small pockets and 1 px cracks between
  big rigid parts: `paint` (chaos, fire_hydra).

### 2.3 Rig file `assets-src/gen/anim/monsters/<sprite>.yaml`

One file per base sprite, plus `<sprite>.lock.json`. Variants never get a rig. The keys the code reads:

| Key | Meaning |
|---|---|
| `sprite`, `body`, `facing: right`, `breath`, `breath_joint` | header |
| `sampler: nearest \| rotsprite` | rigid-part sampler (default `nearest`) |
| `planted: foot_n` (or a list) | `atk_mid`'s pinned foot (biped default `foot_f`) |
| `weapon_hand`, `attack_hand`, `cast_hand: n \| f` | which arm the recipes move |
| `keyframes.<idle\|attack\|hurt\|cast>.<joint>: [x, y]` | whole native pixels; extra joints may be added freely |
| `parts.<p>: {bone \| chain, radius, kind, in, width, remove, carry_to, carry_mode}` | `bone`/`chain` is a list or a per-keyframe dict. `kind`: `rigid` `torso` `chain` `cloth` `prop` `fx`. `in`: the keyframes the part exists in. `width: auto \| n` is the warp half-width in cell px. `remove: true` drops a template part. A **pixel-less anchor** is `radius: 0.01` |
| `masks.<part>.<keyframe>: [[x, y], ...]` | polygon, **applied in file order, so later masks win**. These decide most results |
| `colors.<part or kind>: [[r, g, b], ...]` | colour-based segmentation |
| `z.<keyframe>: [parts back→front]` | draw order per pixel-source keyframe |
| `frames.<f>: {t, moves, pins, dy, tweaks, drop, scale, sampler}` | `moves: []` = no interpolation (tweaks only). `tweaks.<joint>: [dx, dy]`. `drop: [part]` hides a part. `scale: {fxpart: 0.25-1}` is fx only. `sampler` is per frame |
| `holds: [{frame, reason}]` | alias a frame to its source; at most 1 per sequence |
| `paint: [{frame, xy: [[x, y], ...], rgb: [r, g, b] \| null}]` | native pixels after compositing; `null` = transparent |
| `paint` with `frame: idle \| attack \| hurt \| cast \| attack_raise` | FW-P keyframe paint: applied to the key in `load_entries` after `pad_keyframes` (padded-cell xy), so every frame cut from it follows; at most 160 px per key (`kf_paint_cap: {key: n}` only for the approved crocodile/hurt <= 220, drowned_sovereign/cast <= 300 (a remap), chimera/attack <= 800 and chimera/hurt <= 600), approved-palette colours or `null`, locked as `kf:<key>` |
| `key_offset: {key: [dx, dy]}` | FW-O: move an approved key by whole px (<= 12, nothing may leave the cell; before keyframe paint, also with `--raw`); its joints, `masks.*.<key>` and keyframe paint are written in the unmoved art and translated with it; in-between paint is not moved (re-derive it); locked as `kf:<key>` (ashen_queen coil, N-4) |
| `hurt_from: idle` | FW-H: a per-pose boss with no approved `boss_hurt` gets its hurt key from the padded idle key (only `HURT_FROM_ALLOW` = hollow_seraph, orchestrator ruling after R329 / R330); give `keyframes.hurt` joints, make the recoil with `key_offset` / keyframe `paint` on `hurt`; the hurt in-betweens and daze are generated, the derived key is locked as `kf:hurt`; refused with an approved hurt (`selftest_hurtfrom.py`) |
| `alias: [hurt]` or `[attack]` | FW-Q partial rig: that sequence's in-betweens are not generated and resolve to their source keys (as keyframe-only); daze and the rest stay generated; `check` prints `OK (aliased: <seq>; ...)`; only `FWQ_ALLOW` sheets (`monster_anim.py`, pinned in `selftest_efix.py`), one per rig |
| `raise: false` | FW-R: drop the approved `attack_raise` key (cell kept): no raise frames, `hasRaise: false`, the heavy glint `tip` from `atk_wind2` (hollow_seraph, D-F1) |
| `seam_tolerance: 2` | allow 2 seam px (an approved notch only) |

- **fx parts are an allowlist** (`selftest_efix.py`: garland `glow`, lich `trail`/`crystal`, vampire `slash`,
  hollow_seraph `halo`); a new `kind: fx` needs approval and an allowlist edit.
- **`frames.<f>.brighten: {fxpart: n}`** (FW-7, kind fx only, n = 1..3): every non-outline pixel of the part steps n
  colours up its own ramp (the part's colours in the approved keyframes, warm and cool hues ramped apart, by
  luminance), so the palette lock holds. hollow_seraph: `cast_gather: {brighten: {halo: 1}}`, `cast_release:
  {brighten: {halo: 2}}`. A frame without the key is byte-identical.
- **Props (D8).** A prop rides its idle bone in `hurt_in1`. In `hurt_in2` the renderer takes its idle pixels and
  binds them to `carry_to`, a joint marked in idle and hurt whose parent bone sets the turn. `carry_mode: behind`
  draws it first; `truncate` keeps its distal half. It must show more than 0 and at most 60 % of the `hurt_in1`
  pixels, and is gone at `hurt`.

A minimal real example, trimmed from `goblin.yaml` (`...` marks the elided joints):

```yaml
sprite: goblin
body: biped
facing: right
sampler: nearest
breath: true
planted: foot_n
keyframes:
  idle:   {crown: [45, 9], neck: [45, 31], chest: [44, 38], hip: [44, 52], sh_n: [51, 36], el_n: [53, 46], hand_n: [62, 39], dag: [17, 59], dag_h: [42, 57], ...}
  attack: {crown: [52, 10], neck: [48, 32], hand_n: [70, 42], tip: [77, 40], ...}
  hurt:   {crown: [47, 10], hand_f: [10, 23], dag_h: [42, 57], ...}
parts:
  weapon: {remove: true}
  dagger:
    kind: prop
    bone: {idle: [hip_f, dag], attack: [hand_n, tip], hurt: [hip, dag_h]}
    radius: 2.0
    in: [idle, attack]
    carry_to: dag_h
    carry_mode: behind
  ft_n: {bone: [foot_n, toe_n], radius: 4.0}
frames:
  atk_wind2:                   # striking arm pulled back behind the body, head and torso lean back
    tweaks: {crown: [-2, 0], neck: [-1, 0], chest: [-1, 0], sh_n: [-3, -1], el_n: [-4, -1], hand_n: [-6, -1]}
  atk_recover:                 # idle fist and forearm kept (only the upper arm reaches forward)
    t: 0.22
    moves: [crown, chest, sh_n, el_n]
z:
  idle: [uarm_f, farm_f, thigh_f, shin_f, uarm_n, farm_n, torso, thigh_n, shin_n, head, dagger, ft_n, ft_f]
masks:
  dagger: {idle: [[13, 60], [16, 62], [21, 61], [28, 53], [28, 48], [25, 47]]}
holds: []
paint:                         # 1 px joint crack closed with outline ink
  - {frame: atk_mid, xy: [[48, 47]], rgb: [6, 4, 10]}
```

### 2.4 Commands and loop

```bash
python3 -I assets-src/gen/monster_anim.py mark hobgoblin    # also works without a rig: 4x/8x keyframes, 5 px grid
python3 -I assets-src/gen/monster_anim.py check hobgoblin   # every check; "<id>: OK (N checks groups)" or one line per failure
python3 -I assets-src/gen/monster_anim.py review hobgoblin  # images + report in assets-src/gen/out/anim/review/monsters/
python3 -I assets-src/gen/monster_anim.py lock hobgoblin    # writes <id>.lock.json; runs NO checks, so only after review passes
python3 -I assets-src/gen/monster_anim.py check --all --calibrate   # keyframe-pair IoU / centroid per sprite
```

1. **Mark** joints off the grid crops (`<id>_mark.png`); re-run after every joint or mask edit and check the part
   colours by eye. **Most act-1 defects (E2, E3, E5-E9) were part-labelling mistakes**: a cape strip or hump owned by
   an arm, belly owned by a thigh, a jaw owned by a foreleg, a trail owned by the blade.
2. **Measure what the keyframes allow** (`check --calibrate`) before tuning: adjacent IoU ≥ min(0.55, pair IoU + 0.02),
   centroid ≤ max(6 px per 80 px cell, half the keyframe shift), bbox height within ±4/6/10 of the S→T lerp. That
   shows early when defaults can't pass (garland, dragon: winds at `t` 0 / −0.05, motion in tweaks).
3. **One iteration** = one rig edit + one `review`. Check-only sweeps in between are free (act-1 owners used `/tmp`
   scripts calling `monster_anim.generate` + `monster_check.check_sprite`).
4. **Paint coordinates:** strips are 4x with a 2 px frame and 4 px gaps: within a cell, native = (px − 2) / 4.

### 2.5 Recipes that worked (from the 12 act-1 rigs)

- **Wind-up must visibly coil:** striking arm back behind the body (`z.idle` puts the near arm behind the torso),
  torso 1-2 px down (`dy`), head back, knees and feet pinned; wind1 about half of wind2, same direction. Translate
  the whole weapon arm (`sh`/`el`/`hand`/`tip` tweaks) rather than rotating the forearm: crisp fist, under the 30°
  cap (E12). If a lean-back loses IoU, coil forward (vampire pounce, lich hunch).
- **Recover reuses the idle fist and forearm** (`moves: [crown, chest, sh_n, el_n]`, or translate the fist): no mud.
- **hurt_in1 needs a visible flinch:** head back 3, fists up 3, torso 1 px.
- **No head or torso rotation in idle-sourced frames**: translate, so faces, coat details and thin bones survive.
- **Two-handed weapons:** rotate the whole upper body (head, chest, both arms, weapon) as one rigid piece, with the
  same rotation about the hip written as tweaks under `moves: []` (ogre `atk_mid`, garland about the sword tip).
- **When arms swing far** (keyframe arms 90-170° apart), set `moves: []` and hand-set the rotations under the 30° cap
  (torso 20°, chain/cloth 25° per segment).
- **atk_mid legs:** pin knees and feet at the attack pose and shift them by tweak ~1/3 toward idle; never rotate
  shins. Feet get own parts `ft_n`/`ft_f: [foot, toe]` with bottom-row masks.
- **Follow** may be a settle (`t` 0.72-0.80) when an overshoot can't reach follow→recover IoU (pirate, skeleton, ogre).
- **Cloth:** mesh warp (`kind: cloth`, `width: auto`) only for narrow cloth (closed cape, streamers). Use
  per-keyframe cloth parts with keyframe-specific joint names (`cape`/`wing`/`drape`, garland `cape_i/_a/_h/_c`), so
  "all" moves never interpolate a closed cape into spread wings. Pin the hem (`cv_2`, `cv_3`) in wind, recover and
  hurt_in1. A spread cloth sits on its own parentless root (it must not ride the neck lift); fold it, don't drop it
  (vampire wing 15° down, 4/6 px lower). Streamers hang from pixel-less anchor parts on their own roots.
- **fx, props and wings exist only in the keyframes that have them.** Leave wing joints unmarked in idle, so
  idle-sourced frames keep the folded wing and attack-sourced frames the raised one. Every wing move is an explicit
  tweak of ≤ 10-30°, from its own root joints. Grow fx with `scale`, and remove them with `drop` (lich trail in
  `atk_follow`).
- **Beasts:** mark the toes; release forepaws only in a rearing `hurt_in1`/`hurt_in2` (`pins: [foot_n, foot_f]`);
  keep neck and head on one angle (`moves: [back, chest]`); leave a coiled tail out of `moves`; the ground clamp stops
  feet dropping, so lower hips and knees with the body.
- **Prop carry:** put `carry_to` (a child of `hip`) where the prop reads as dropped behind a shin or the loincloth.
  A prop carried in a raised hand passes the 30° cap only if the hand barely turns (ogre `club_h`). A prop may hide
  almost fully in `hurt_in2`: the pose change at that step hides the switch.
- **Measure before and after a fix** with `python3 -I assets-src/gen/fixmeasure.py` (`travel`, `partc`, `pieces`,
  `fills`, `colours`, `diff`; `select` turns colour / box / component / hole selectors into `paint` xy lists with the
  4-neighbour mode colour; `--raw` = the approved keys without keyframe paint; boxes are `X0 Y0 X1 Y1`, end exclusive;
  round 2 adds `edges` (spurs, inner ink, edge gaps, bare ink; `--vs KEY --shift dx,dy`), `match`, `poly`, `switch`
  (continuity pairs of a sequence, or the key-switch pre-check without a rig), `rowspan` and `sweep`).
- **Paint** only for 1-3 px cracks, holes and strays, in a colour of the surrounding approved palette; `rgb: null`
  reopens an approved gap. **Re-derive every patch after any rig or framework change** (stale ones became specks and
  blobs: E7, E10).
- **Feet:** `_stage.png` shows each frame at 2x on `grassland.webp` with the plain line. Staged backgrounds
  (`tools/stage_backgrounds.py`) put every actor's feet on y 360-770, so feet on `bottom_row` land right; don't touch them.
- **Variants inherit** every frame (recoloured); check them in the browser (`anim_goblin`, `anim_beasts`): CLI ids
  are base sprites only.
- **Holds:** ≤ 1 per sequence, proven legal by `check` (continuity still passes), with a `reason`. Act 1 shipped none.
- **Hard sheets (T-K, fix pass 2: warmech, hydra, scorpion, black_knight, horned_devil, water_elemental, the
  swimmers ...):** when the keys are too far apart for rotations under the cap, make every in-between a
  **translation-only** copy of its source key (`moves: []`, the upper body / heads / necks as one group, feet pinned)
  and bridge the key switch with the shift; measure it first with `fixmeasure.py switch <id> <seq> --rig <rig>`.
- **Pin every leg tip, including the undrawn ones** (a leg hidden behind the body in one key still has a tip joint):
  an unpinned tip lets the ground clamp or a group move drag a leg off the plain.
- **One sequence that cannot bridge** (continuity below the need in 3 iterations): alias it per key with FW-Q
  (`alias: [hurt]` or `[attack]`, an `FWQ_ALLOW` entry approved by the orchestrator) and keep the other sequences
  rigged; G6 shipped chimera / hurt, black_widow / hurt, crawler / attack and astos / attack.

## 3. Validation

### 3.1 Automated checks (`anim_checks.py`, `anim_rules.py`, `anim_efix.py`, `anim_feet.py`, `monster_check.py`)

| Check | Catches | Typical message |
|---|---|---|
| 1-3 alpha, palette, magenta | semi-alpha; colours outside the union of the source files plus OUTLINE; key fringe | `semi-alpha 3 px at (x, y)`, `off-palette colours [...]`, `magenta / key fringe` |
| 4 pieces | new 4-connected pieces, or new ones under 12 px | `pieces 2 > source 1` |
| 5 seams, holes | transparent px between 2 part labels; new enclosed hole ≥ 4 px | `seam gaps 3 > 0 at (31, 44)`, `new hole 9 px at (...)` |
| 6 silhouette (F1) | area 0.85-1.15 of the source; bbox height vs lerp ±4/6/10. **fx pixels and their own outline are excluded** | `opaque area 0.82 of source`, `bbox height 72 vs lerp 67.7 (+-4)` |
| 6 continuity | adjacent IoU ≥ min(0.55, pair IoU + 0.02); centroid cap | `atk_wind2->atk_mid: adjacent IoU 0.43 < 0.44`, `centroid moves 7.0 > 6.0` |
| 7 outline | second ring ±0.08; dark-edge share | `second ring 0.30 vs source 0.21 (+-0.08)` |
| 8 feet | lowest row = `bottom_row`; pinned feet ±1, per foot | `lowest opaque row 79 != 76`, `foot foot_f x ... (+-2)` |
| 9 clipping | an opaque px on the 1 px border | `opaque pixel on the cell border at (79, 40)` |
| 10 rules | rotation cap 30/20/25°; 35 % rule; whole-pixel joints | `rotation cap: farm_f -32.5 deg > 30.0`, `t +0.50 is more than 0.35 ...` |
| 12 lock | frame bytes ≠ lock | `atk_mid: hash differs from the lock file`, `no lock file` |
| 13-14 carry, holds | prop in `hurt_in2` 0 or > 60 %; > 1 hold per sequence | `prop in hurt_in2 59 px > 60% of hurt_in1 71 px` |
| F3 fx mask | fx-mask pixels labelled as another part | `fx mask trail: 1409 opaque px labelled as other parts (blade 1306)` |
| F4 crease | new ink inside one part, piece ≥ ceil(5·h/80) | `intra-part crease 6 px >= 5 at (68, 19) in neck` |
| F5 foot release | feet freed outside `hurt_in1/2` | `foot paw_n released outside a rearing hurt: lowest row 74 vs source 76 (+-1)` |
| F7 prop attached | prop touches its grip < 4 px | `prop club touches its grip farm_n by 2 px < 4` |
| F6 roughness, mask overlap | report only (`review` top 10, `<id>_report.json`) | `mask garland hurt cape_h: 313 px ...` |

The "efix" gates (F3-F5, F7) run in `check`, `review` and, since V.3, the `monsters_ai` build. The build fails on
any failure in an unheld frame, and only warns on a lock mismatch. `check --all` fails on locks.

### 3.2 Review outputs (`gen/out/anim/review/monsters/`)

`<id>_mark.png` (segmentation, joints); `_attack/_hurt/_cast/_idle.png` (4x strips in runtime order, keys framed
green); `_onion.png` (previous frame in cyan under the next: pops, drift); `_attack/_hurt/_cast.gif` (real timing);
`_stage.png` (2x on grassland, plain line); `_report.json` (checks, `mask_overlap`, `roughness`). Read strips at 4x,
zoom suspects to 8-12x.

### 3.3 Iteration budget and escalation

4 iterations per new monster (goblin prototype: 6), 3 per fix round; then stop and report the strips, the failing
criterion and the options (a legal hold, a framework fix, the user). No paid fallback. Framework edits (`rig*.py`,
`anim_*.py`, `monster_*.py`, selftests) go through one owner, RED-first in a selftest, with every lock unchanged.

### 3.4 Independent image-only reviewer

Spawn a fresh agent once every check is green. Give it **only** the review image paths (strips, onion, GIFs,
`_stage.png`), the approved sheet (`approved/<id>/monster_<size>.png` or `boss_*.png`) and the criteria below: no rig,
no code, no hypothesis. It answers yes/no per criterion and returns **SHIP / SHIP WITH NITS / ITERATE**.

1. Same creature in every frame: no smeared face, no doubled outline, details unchanged.
2. The motion reads at 1x: visible anticipation in wind1, contact hits, and the recoil reads as a hit.
3. No rubber-band limbs, stretched pixels or pixel crawl on still parts.
4. Props, fx and cloth change only at keyframe boundaries; carried props are hidden, not popped; cloth stays one piece.
5. Feet don't slide during wind or recover (onion, `_stage.png`), and nothing clips.
6. Any creature- or fix-specific question (e.g. "one head, no seam").

A rejection counts as an iteration. **Run `lock <id>` only after SHIP** (SHIP WITH NITS: fix the cheap nits, or record
them). Re-review and re-lock whenever a framework change alters frame bytes: `check --all` shows which.

### 3.5 Browser checks (`npm run dev`, Playwright, always `&mute=1`)

- `http://localhost:5173/?mute=1&scenario=anim_bipeds&enemyAnim=loop`, at least 3 cycles (also `anim_goblin`,
  `anim_goblin_cast`, `anim_large`, `anim_beasts`, `anim_boss_garland`, `anim_boss_lich`, `anim_crowd`, `anim_status`).
- `&enemyAnim=step`: `.` / `,` step 1 frame forward / back; a label shows `enemy: frame / t`; screenshot every frame.
  `&slow=N` slows the loop.
- **Status and death behaviour only shows in real battles** (no `enemyAnim`): sleep or stun in `anim_status`, lethal
  hits during the hold or return, and HP set to 0 through `window.__game` (dev only).
- **Pixel-exact frames:** in step mode crop the sprite from a screenshot, reduce by the screen scale (nearest) and
  compare with its rect on its page `monsters-ai-<page>.png` (V.2: 754 frames exact; no blur, half-pixel offset or wrong frame).
- **FPS:** read `__game.app.ticker.FPS` on `anim_crowd` (V.2: median 120 on a 120 Hz display).

### 3.6 Adversarial play-test probes (`ENEMY_ANIM_PLAN.md` §8; record a verdict per probe, severity P0/P1/P2)

| # | Probe | # | Probe |
|---|---|---|---|
| A1 | step every sequence: no pops, no one-frame idle flash | A11 | variants match their base frame for frame |
| A2 | pixel grid at odd widths and 125 % zoom; integer positions | A12 | no magenta fringe on dark and light backgrounds |
| A3 | `anim_crowd` half-size: offsets rounded once, no clipping | A13 | 5 idle copies breathe out of phase, 1 px, feet still |
| A4 | the lunging enemy draws above enemies only, order restored | A14 | a missing sheet: placeholder still animates, one warning |
| A5 | numbers at contact; the element flash follows each frame | A15 | late atlas load: animation continues, order restored |
| A6 | a hurt enemy next to an attacker recoils independently | A16 | pacing: about +8 frames per attack, +2 per cast |
| A7 | rapid re-hits: in-phase, then a full hold, no snap to idle | A17 | victory, Run, game over: nothing frozen mid-frame |
| A8 | death in every phase: held `hurt`, smooth fade | A18 | sleep/stun freeze breathing but recoil; stone flashes only; lost turns don't lunge |
| A9 | death mid-lunge eases (unit test plus a spot check) | A19 | `anim_crowd` at 60 fps |
| A10 | bosses: fx at the planned frames, no cape tear, feet planted in casts | A20 | props partly hidden in `hurt_in2`, gone at `hurt`, no alpha |

P0/P1 findings go back to the rig owner. After 2 fix rounds, escalate.

### 3.7 Final integration checklist (integrator, main checkout)

```bash
python3 -I assets-src/gen/selftest.py                        # ALL PASSED (worktree: --anim only)
python3 -I assets-src/gen/monster_anim.py check --all        # only "<id>: OK" lines (rolling: also "<id>: no rig")
python3 -I assets-src/build_assets.py monsters_ai battle_ai field_ai
git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai.* > /tmp/a.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum -c /tmp/a.sha
npx tsc --noEmit && npm run build && npm test
```

- [ ] Unchanged sprites are byte-equal **by frame rect** across pages (the packer moves cells, so a whole-PNG diff
  can't tell); this reads both the paged index and the R0 single-page shape (`docs/ROSTER_PLAN.md` 12.2):

```bash
mkdir -p /tmp/head && git show HEAD:assets/sprites/monsters-ai.json > /tmp/head/monsters-ai.json
for f in $(python3 -I -c "import json; m = json.load(open('/tmp/head/monsters-ai.json')); print(*[p['file'] for p in m.get('pages', [{'file': 'monsters-ai.png'}])])"); do
  git show "HEAD:assets/sprites/$f" > "/tmp/head/$f"; done
python3 -I - <<'EOF'
import json, os
from PIL import Image
def cells(d):
    m = json.load(open(os.path.join(d, "monsters-ai.json")))
    pages = [Image.open(os.path.join(d, p["file"])).convert("RGBA") for p in m.get("pages", [{"file": "monsters-ai.png"}])]
    return {(s, f): pages[v.get("page", 0)].crop((x, y, x + v["cell"][0], y + v["cell"][1])).tobytes()
            for s, v in m["sheets"].items() for f, (x, y) in v["frames"].items()}
a, b = cells("/tmp/head"), cells("assets/sprites")
for s in sorted({s for s, _ in a}):
    print(s, [f for (t, f) in a if t == s and a[(t, f)] != b.get((t, f))] or "same")
EOF
```

- [ ] Locks committed with their rigs; reviewer verdict, iteration count and accepted nits in the hand-off.
- [ ] `docs/ACT1_LOG.md` has the image rows; AGENTS.md / `gen/README.md` updated if pipeline behaviour changed.
- [ ] `git status` shows no `.env`, `out/`, scratch `cache/` entries or `/tmp` tools.

## 3.8 Colossus forms (a painted, battlefield-scale boss; pass C, `docs/CHAOS_FORMS_PLAN.md` 18)

A colossus form is a boss larger than the battlefield (Chaos F2 Orrery, F3 Last Horizon, F4 Core Laid Bare). It is
**not** an atlas sheet and gets **no rig in-betweens**: it is full-resolution painted art at display scale 1 with soft
alpha, linear filtering and light layered animation (breathing, glow / corona pulse, slam dip, hurt flash, dying).

- **Art: Stability on Bedrock, only through `gen/colossus.py`.** Bedrock is allowed for colossus masters and their
  edits (`gen`, `nobg`, `upscale` (Conservative), `inpaint` + `inpaint_merge` for chest variants, `structure`,
  `search_replace`). The 2026-11-13 rejection still applies to in-betweens. Every call goes through
  `bedrock.invoke(..., paid=True, purpose=P)`: P must be in `budget.json` `bedrock.per_purpose_caps`, the pass cap is
  80, main checkout only, one row per request in the tracked `cache/bedrock_ledger.jsonl`. One call per background
  command; check with `colossus.py budget --check`.
- **Finish offline:** `colossus.py glow` (sky_base, despill, then the G1 diff / G2 luminance glow, with the 18.7
  checks), `mock` (rim backdrop, party, side-by-side with the picked original), then a fresh image-only review against
  the original (SHIP / SHIP WITH NITS / ITERATE, <= 4 iterations) and `approve` (archive first with
  `retire.py --colossus <form>`; `approve` refuses to overwrite without it).
- **Layers and place:** `gen/colossus/<form>.yaml` names the layers (`body` normal, `glow` and `corona` additive,
  `core` variant frames such as `crack` / `open`), the rest `place`, anchors (core / target, head, hands, melee, feet)
  and `targetRect`. Opaque canvas borders must stay off-screen or behind the windows in every frame (left <= -6, right
  >= 1926, bottom >= 786; only feathered glow may sit under the message window). A data form (F4) reuses another
  form's art with its own place and `colossusVariant`.
- **Build:** `build_assets.py colossus` writes `assets/sprites/colossus/<art>/...` tiles (<= 2048), `preview.png` (the
  bestiary still) and `colossus.json`, the contract `src/scenes/battle/colossus/colossusIndex.ts` reads
  (`tests/scenes/battle/colossusContract.test.ts`). It must be deterministic (`--out DIR` under PYTHONHASHSEED 0 / 1);
  the memory total is <= 24 MB. Then `colossus.py check <form>` and `lock <form>`; commit right after the lock.
- **Data:** the form records carry `formOf: <base>` (no `num`; filtered from the bestiary list, shown as sub-entries),
  `colossus: <art id>`, optional `colossusVariant`, `slam` (F3 only). The base boss's `bossPhases` name the next form
  (`form`) and its `interlude` (`assets/data/battle-interludes.yaml`; cap 480 frames, `chaos_i2` 600).
- **Browser:** `?mute=1&scenario=chaos_forms` (F1 -> F4), `chaos_final` (F3 with the status row; `&enemyAnim=loop`),
  `chaos_interlude_1..3`, `&bestiary=<form id>`. Check numbers, cursor, status icons and the windows over the art.

## 4. Troubleshooting (symptom → cause → fix)

| Symptom | Cause | Fix |
|---|---|---|
| wind1 barely differs from idle (E12) | the default `t` moves the head and arm only 1-4 px | tweaks: arm back behind the body, torso `dy` 1-2, head back; wind1 = half of wind2 |
| `rotation cap: farm_f 45 deg` | keyframe limbs 90-170° apart; 35 % of that is over 30° | take the limb out of `moves`, or `moves: []` with hand-set rotations; re-mark so the forearm follows its upper arm |
| two-handed grip splits, fist leaves the club (ogre) | each arm rotates about its own shoulder | rotate the upper body as one rigid piece (the same pivot for every upper joint) |
| recover fist is muddy | the forearm is interpolated and resampled | `moves: [crown, chest, sh_n, el_n]`, or translate the fist |
| `lowest opaque row 79 != 76`, feet sink (goblin `atk_mid`) | shins rotate the whole foot | foot parts `[foot, toe]` with foot masks; pin the legs at attack and shift them by tweak |
| `feet x ... vs lerp` in `atk_mid` | the planted legs sit at the attack position | shift the pinned knee and foot about 1/3 toward idle |
| prop split in two, a loose blade below the hip; an ear strand or sleeve pixels ride the wrong limb | nearest-bone segmentation gave them to the wrong part | a polygon mask per keyframe (whole prop, head with ear, sleeve as arm); re-mark joints on the real limb |
| club floats with no hand in `hurt_in2` (E9) | the `carry_to` spot was in open air | move `carry_to` behind a shin or the loincloth (`behind`); keep 0 < px ≤ 60 % |
| a second head in `atk_follow` (troll E7) | the hump spikes were labelled as the far arm | mask the hump onto `head` for that keyframe |
| stretched arm, jagged armpit (E7) | a belly-flank strip was labelled as the arm | a torso mask over the flank (stop above the thumb, or `pieces 2 > 1`) |
| face, collar or buttons overwritten in recover (E5) | a big head slide pulls the arm and torso layers over the face | keep head translations at 1-2 px; extend the head mask over the hood and hair |
| cape becomes a flat flap with background behind it (E2) | the cape is split over the arm, sword and cape masks, which move apart | one cape mask from shoulder to hem; start the weapon mask at the pommel; cloth turn ≤ about 10° |
| a wide cape or wing loses pixels, shreds the coat; hem below the plain | the warp maps only its band; torso rotation; hem not pinned | rigid per-keyframe parts on own roots; cloth only for narrow cloth; no torso rotation; pin the hem joints |
| streamer tips fused, 39 px hole (mummy) | every streamer joined to the chest, so the crack fill bridged them | own root joints, hung from pixel-less anchor parts |
| an approved gap is inked shut, `new hole` with no motion; `seam gaps 1` at a notch open in idle | crack fill and outline repair between joined parts | unjoin the parts (own roots) or mask the gap edge onto one part; `paint rgb: null` / 1 px ink; `seam_tolerance: 2` |
| a detached frost-trail piece in follow (E3) | an earlier mask (`blade`) took fx pixels, so `drop` missed them | merge into one fx mask; F3 must read 0 |
| the orb pops in and out (E4) | the warp chain scales only along its length | an fx part rigid in the fist plus `frames.cast_rise.scale: {crystal: 0.55}` |
| a ghost horn (dragon E6) | the neck warp turned 12.7° while the rigid head turned 2.7° | keep the neck and head on the hurt angle (`moves: [back, chest]`) |
| belly-colour patches on the legs | the belly band was split between body and thigh; a wide `auto` warp | a `masks.body` band, hurt thigh masks, `parts.body.width: 16` |
| T-shaped crease, `intra-part crease` (wolf E8) | the neck warp sampled body-labelled pixels, leaving a hole in the part | a neck mask that moves the boundary off the withers |
| forepaws lift in recover (F5); or a rear-up won't rise | a `pins` override plus forelegs in `moves`; or default hurt pins hold the forepaws | default pins and forelegs out of `moves` (add the shoulders); `pins: [foot_n, foot_f]` only in `hurt_in1`/`hurt_in2` |
| hind legs squashed, a doubled waist (dragon `hurt_in2`) | the ground clamp keeps feet at the source ground | drop the hips and knees with the body; feet stay |
| a wing squeezed or shredded when turned (E11); a loose feather swings with it | the turn put it under the neck; nearest spurs; the feather segmented into the wing | 0-10° turns, `sampler: rotsprite` for that frame, wing on own roots; feathers as own parts `in: [hurt]` |
| tail fails the 25° chain cap | the keyframe coils differ hugely | take the tail out of `moves`; it rides the body |
| `adjacent IoU` fails around mid or follow | the idle/attack pair overlaps less than 0.5 | follow as a settle (`t` 0.72-0.80); coil forward in wind2; keep the fx overlap in mid |
| `bbox height vs lerp` in wind | the attack is much shorter or taller than idle | wind `t` 0 / −0.05 / −0.25; put the motion in tweaks under `moves: []` |
| thin bones tear (skeleton) | ribcage or torso rotation | keep the torso angle; translate |
| a weapon flip of about 180° can't wind back | a pull-back can't reach wind2→mid IoU | start the swing in wind2 (`t: +0.30` toward attack) |
| a paint pixel became an isolated speck or blob | a rig change moved the pixels under the patch | re-derive the patches; delete stale ones; diff the frame |
| high F6 roughness (ragged back) | rotated rigid parts with nearest sampling | `frames.<f>.sampler: rotsprite`; if the second ring fails, outline paint |
| `hash differs from the lock file` after a framework edit | frame bytes changed | review the frame diffs, re-run the image review, then `lock` |

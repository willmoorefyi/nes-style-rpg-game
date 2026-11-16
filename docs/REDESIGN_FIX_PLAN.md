# Pass V fix round (V8) plan, 2026-11-16 (rev 2: momus APPROVE WITH REVISIONS, 12 binding revisions applied, section 8; user and orchestrator decisions recorded, section 5)

**Scope.** Every defect of `docs/ROSTER_PLAYTEST.md` "Pass V play test (V7), 2026-11-16" (evidence `/tmp/vpt4/`,
local): P1-1 and P2-1 .. P2-8. The three open G7 P2s stay out of scope (D-V16). The rules of `docs/REDESIGN_PLAN.md`
(rev 2) apply unchanged unless a section below says otherwise: the retire-first rule (5), the pass-V budget and guard
(6), the 9.1 pipeline, the 9.4 allowed-failure states, the 10 brief rules, the 11 validation commands.

**This document is the plan only.** Nothing was generated, edited or built for it. Every number was measured at
`roster-int` a7c7dd6 (approved sheets, rigs, `monsters.yaml`, the TS sources) and in the main checkout's ledger
(`/Users/wlmmoor/personal/ff-game/assets-src/gen/cache/ledger.jsonl`, authoritative) with throw-away scripts; where a
number is an estimate it says so.

**Contents:** [0 Success criteria](#0-success-criteria) · [1 Budget](#1-budget-measured) · [2 Findings, root causes and
fixes](#2-findings-root-causes-and-fixes) · [3 Tranches](#3-tranches) · [4 Validation and re-test](#4-validation-and-re-test)
· [5 Decisions](#5-decisions) · [6 Risks](#6-risks) · [7 TODOs](#7-todos) · [8 Momus revisions](#8-momus-revisions-rev-2)

---

## 0. Success criteria

```json
{
  "functional": [
    "crazy_horse reads as an otherworldly, non-ordinary horse in its idle and attack keys (not only in hurt): glowing cracks and burning eyes visible at 1x, plus at least one non-equine feature (smoke/void legs or hooves, a split or bare skull, a tall spine ridge) in every key",
    "piscodemon reads as menacing at 1x (no round pale 'sad' eye), black_knight's horns read as horns (pointed, not round ears) and its visor glow reads at 1x in idle, attack and hurt",
    "hollow_seraph is regenerated as a full set (D-U1 = b): its wings read as blades of light, not cream swords with hilts (no cross-guards / pommels), and its body reads hollow; on the rev-6 failure exit, at least the cross-guard erase (route a) holds",
    "chaos's heavy attack shows no identity or proportion pop (arm thickness and head height consistent with idle across the whole heavy sequence)",
    "On chaos (and every scale-3 box) the damage number never overlaps a status icon; FIR2-type effects on a huge box are sized and placed on the visible body",
    "A sandbox formation that formationFits refuses is not started: console.warn naming the ids, startSandboxBattle returns false, no battle is pushed; AiEnemyView.build warns once if any battle lays out a refused formation (D-O7, rev 9)",
    "The bestiary Weak / Resist values never run into the next label for any enemy in enemies.yaml"
  ],
  "observable": [
    "docs/ROSTER_LOG.md 'Pass V fix round (V8)' rows, one per Gemini attempt and per 0-image fix, 'Images used: U of 50' equal to the guard's count",
    "A fresh image-only verdict (SHIP / SHIP WITH NITS) per changed sprite; fixmeasure numbers for every paint fix",
    "docs/ROSTER_PLAYTEST.md 'Pass V re-test (V8)' rows for every P1-1 .. P2-8 item, each FIXED / ACCEPTED-NIT / OPEN"
  ],
  "pass_fail": [
    "Main-checkout ledger: gem[367:] <= 47 (the V8 halt; guard cap 50), every attempt one of the 8 pass-V ids and its only_sheets, no character+sheet above 3 in pass V except the user-approved sheet_caps (hollow_seraph boss_idle 6, boss_attack 6, boss_cast 5, boss_hurt 4; crazy_horse monster_large 5), which are in budget.json and pinned by selftest_passv.py",
    "Every regenerated sprite archived first (retire.py <id> --as <id>_v2 committed on roster, docs/RETIRED_SPRITES.md row) before its first V8 paid request; selftest_retire.py PASSED; git ls-files lists approved/_retired/<id>_v2/ and anim/monsters/_retired/<id>_v2.yaml and .lock.json for every regenerated id (crazy_horse, piscodemon, hollow_seraph; black_knight only if its fallback image runs)",
    "Every FW-P paint within KF_PAINT_CAP 160 px per key and the sprite's approved palette, or an entry in KF_PAINT_ALLOW recorded with the orchestrator ruling (D-O3)",
    "monster_anim.py check --all: 123 'OK' lines (+ the 4 FWQ aliased notes), nothing else",
    "Frame-rect diff vs a7c7dd6 changes exactly the sheets this plan names (section 4.2)",
    "python3 -I assets-src/gen/selftest.py (main checkout) and selftest.py --anim (worktree): ALL PASSED",
    "npx tsc --noEmit && npm run build && npx vitest run: exit 0; every new test RED before its fix",
    "Re-test: P1-1 FIXED; every P2 FIXED or on the decided nit list (section 5)"
  ]
}
```

---

## 1. Budget (measured)

Ledger (main checkout, 2026-11-16, Gemini attempts, Bedrock excluded): **395**; `budget.json` `attempts_before` 367,
so **pass V used 28 of 50; remainder 22**. Both per-sheet rules of `check_budget` (`generate.py:418-439`, top level
`max_attempts_per_sheet` 3 over `attempts[367:]` and the pass-V entry's `max_per_sheet` 3) count the same slice.

| Sheet | Pass-V attempts | Left (rule 3) | Relevant finding |
|---|---|---|---|
| crazy_horse/monster_large | 1 (R290) | **2** | P1-1 |
| piscodemon/monster_small | 1 (R291) | **2** | P2-1 |
| black_knight/monster_small | 2 (R292, R293) | **1** | P2-2 |
| guardian/monster_large | 2 | 1 | none (MET) |
| vampire/monster_small | 1 | 2 | none (MET) |
| hollow_seraph/boss_idle | 3 (R297, R298, R309; approved as the R313 re-cut) | **0** | P2-3 |
| hollow_seraph/boss_attack | 3 (R314-R316) | **0** | P2-3 |
| hollow_seraph/boss_cast | 2 (R317, R318) | 1 | P2-3 |
| hollow_seraph/boss_hurt | 1 (R319) | 2 | P2-3 |
| chaos/boss_idle | 1 | 1 (by the rev 1(c) policy the 3rd was the C2 reserve; C2 is now the live band) | none |
| chaos/boss_attack | 1 | 2 | none |
| chaos/boss_cast | 2 | 1 | none |
| chaos/boss_hurt | 2 | 1 | none |
| chaos/boss_attack_raise | 3 (R305-R307) | **0** | P2-4 |
| dragon/monster_large | 3 | 0 | none (MET) |

**Rulings (2026-11-16):** the user chose **D-U1 = (b)** (regenerate the full hollow_seraph set) and **D-U2 = (b)** (up to
2 more crazy_horse attempts, used only after its regular 2 fail review). The orchestrator ruled the per-sheet caps
(rev 5), written into `budget.json` as a generic `sheet_caps` map on the pass-V entry:

| Sheet | Pass-V used | V8 cap (`sheet_caps`; default 3) | V8 attempts allowed |
|---|---|---|---|
| hollow_seraph/boss_idle | 3 | 6 | 3 |
| hollow_seraph/boss_attack | 3 | 6 | 3 |
| hollow_seraph/boss_cast | 2 | 5 | 3 |
| hollow_seraph/boss_hurt | 1 | 4 | 3 |
| crazy_horse/monster_large | 1 | 5 | 2 regular + 2 more under D-U2 (only after the regular 2 fail review) |
| piscodemon/monster_small | 1 | 3 | 2 |
| black_knight/monster_small | 2 | 3 | 1 (only if the F3 paint fails review) |

**What this plan spends:**

| Item | Expected | Worst |
|---|---|---|
| hollow_seraph full set (F4, D-U1 b): idle, attack, cast, hurt | 8 | 12 |
| crazy_horse/monster_large (F1): regular | 1.6 | 2 |
| crazy_horse/monster_large (F1): D-U2 extra | 0.4 | 2 |
| piscodemon/monster_small (F2, regenerated directly) | 1.6 | 2 |
| black_knight/monster_small (F3 fallback image) | 0.3 | 1 |
| everything else (P2-4 .. P2-8) | 0 | 0 |
| **Total V8** | **about 12** | **19** |

**Exact worst case: 12 + 2 + 2 + 2 + 1 = 19 images; 28 + 19 = 47 = the V8 halt** (3 below the guard's cap of 50;
3 images stay unused for any re-test finding, and a re-test image needs a new orchestrator ruling). Expected total
about 28 + 12 = 40.

**FW-V8 (framework owner, RED first, before any V8 paid request):** `sheet_caps: {"<id>/<sheet>": n}` on the `pass V`
entry. **Both** per-sheet rules of `check_budget` read it (the top-level `max_attempts_per_sheet` loop at
`generate.py:419-423` and the pass loop at `:435-439`: the limit for a request is `sheet_caps.get(f"{id}/{sheet}",
default)`); `budget_consistency` accepts it (every key names an `only_ids` id and one of its `only_sheets`, every
value an integer in 3..6, else it refuses every paid request naming the bad entry); `history` is not touched.
`selftest_passv.py` pins the literal map and tests, RED first: the 4th `hollow_seraph/boss_idle` attempt allowed, the
7th refused; the 4th `crazy_horse/monster_large` allowed, the 6th refused; the 4th `piscodemon/monster_small` still
refused; a cap of 7, an unknown sheet or a non-listed id refused by the consistency guard; the real ledger within the
caps.

Halt rules: the guard refuses the 51st image; **this round stops generating at 47 used**; 2 rejected attempts in a row
on one sheet stop that sheet until the wording is fixed offline and the orchestrator agrees (the crazy_horse D-U2
extra starts only after its regular 2 fail). Every `--retry` log row cites the user's pass-V approval (2026-11-16,
`REDESIGN_PLAN.md` 6) and, for an over-3 attempt, the D-U1 / D-U2 ruling.

---

## 2. Findings, root causes and fixes

Owners as `REDESIGN_PLAN.md` 9.2: **G** generator (main checkout, `roster`), **FW** framework owner, **TS** TS/data
owner, **R** rig agent (`v8-rig-<id>` worktree off `roster-int`), **IR** fresh image-only reviewer, **I** integrator
(`roster-int`), **T** fresh re-tester.

### 2.0 Common generator procedures (rev 2, rev 4, rev 11)

**G-0 (generator, main checkout, before any retire or request; rev 2).** `roster` (4b54fc5) lacks the V5/V6 seraph,
chaos and dragon rigs and the V6 `RETIRED_SPRITES.md` rows. On `roster`, with no uncommitted attempt:
`git merge --ff-only roster-int` (it is a fast-forward: `roster-int` contains `roster`; if `--ff-only` refuses, stop
and report, never force). Then, for every id to be retired in V8 (crazy_horse, piscodemon, hollow_seraph; black_knight
only before its fallback image), `cmp` each `approved/<id>/*` and `anim/monsters/<id>.{yaml,lock.json}` against
`git show roster-int:<path>`: all identical, else stop. This and every retire commit happen **before** any agent forks
from `roster-int` for W3.

**G-R (retire, rev 2).** `python3 -I assets-src/gen/retire.py <id> --as <id>_v2` (archives the pass-V approved
sheets, rig, lock and `monsters.yaml` entry as `approved/_retired/<id>_v2/`, `anim/monsters/_retired/<id>_v2.*`,
`retired/monsters_v2.yaml`), the `docs/RETIRED_SPRITES.md` row, commit; `selftest_retire.py` PASSED; `git ls-files
--error-unmatch` on the archive paths.

**G-S (seeds, rev 11).** After the retire and before every paid request, the generator sets `sheet_seeds: {<sheet>:
N}` in the id's `monsters.yaml` entry (a seed not yet used for that sheet in the ledger) and records N in the log row.

**G-X (restore after a failed regeneration, rev 4).** Copy `approved/_retired/<id>_v2/*` -> `approved/<id>/`,
`anim/monsters/_retired/<id>_v2.{yaml,lock.json}` -> `anim/monsters/<id>.{yaml,lock.json}`, and the entry from
`retired/monsters_v2.yaml` back into `monsters.yaml` **without** its `retired_as` field; the new V8 text moves to
`retired/pending_<id>.yaml`; `cmp` every restored file against the archive; `monster_anim.py check <id>` OK;
`selftest.py` ALL PASSED (state A/E). **A boss whose new idle was approved before the set failed:** first archive the
new poses approved so far as `hollow_seraph_v3_partial` (`retire.py hollow_seraph --as hollow_seraph_v3_partial`),
then restore v2 as above (no mixing of old and new poses).

### F1. P1-1 crazy_horse: an ordinary grey horse in idle / attack / daze

**Root cause (verified).**
1. **Prompt:** only the hurt text asks for a bright glow ("the glowing cracks flaring brighter", `monsters.yaml`
   crazy_horse `hurt`); the idle `prompt` says "cracks ... glowing a sickly yellow-green from inside" with no
   strength. The R290 raw (`cache/8bc875977bdf6a8fbe2280ad.png`, viewed) already has thin dim olive cracks in idle and
   attack and blazing cracks only in hurt: the generation, not the cut, made the idle plain.
2. **Colour cut:** the approved sheet's bright crack colours (214, 231, 90) and (173, 189, 99) cover **2 + 0 px in the
   idle, 3 + 5 px in the attack, 139 + 219 px in the hurt** (per-cell census of
   `approved/crazy_horse/monster_large.png`); the idle's cracks are 23 px of (132, 148, 74) and 32 px of (99, 99, 57):
   olive lines at 1x. The eye is 2 bright px.
3. **Silhouette:** the brief and prompt describe a horse anatomy throughout (thin legs, iron hooves, a skull-*like*
   head); nothing non-equine is asked for, so the silhouette is a plain gaunt horse (`z/on_horse.png`).
4. **Cutter:** the raw's small floating embers on the mane are separate pieces outside the body and are dropped by
   `_figure_mask` (R290 nit), removing the second "otherworldly" cue.

**Fix (regeneration; G, then R, IR, I).**
1. **Retire first (G):** after G-0, G-R with `crazy_horse --as crazy_horse_v2` (the R290 sheet, the pass-V rig and
   lock, the pass-V entry). The approve gate then allows the overwrite.
2. **New text (G, offline, before any request):** keep the archived design's palette and identity cues (ash grey,
   bone spines, yellow-green glow; distinct from `nightmare`: no black hide, no blue flame) and change these:
   - every pose text (`prompt`, `attack`, `hurt`) names the glow **at full strength**: "wide jagged cracks across the
     neck, flanks and legs blazing bright yellow-green light from inside, as bright in this pose as the eyes";
   - non-equine features, each described on the body (never in open air): "the head a bare horse skull of bone with
     empty sockets holding two large burning yellow-green eyes, each a clear bright spot"; "the lower legs dissolve
     into thick curling black smoke instead of hooves, the smoke touching the ground"; "a tall ridge of long bone
     spines along the neck and the back" (taller than R290's small nubs); "the ribs showing through the hide";
   - embers drawn **on** the smoke mane and tail ("small bright yellow-green embers inside the smoke, not floating
     free"), per the lesson that floating pieces are cut;
   - extra_negative adds: "dim cracks, faint cracks, a normal horse head, hooves, a plain horse, floating sparks".
   - `body: quadruped` and the motion line stay (no leap, no rear-up).
3. **Dry run (0 cost), then the paid request** (G-S seed, e.g. `sheet_seeds: {monster_large: 1235}`, then 1236)
   `generate.py crazy_horse --backend gemini --sheets monster_large --paid --retry`, in the background with Monitor
   (rev 12). **2 regular attempts**; if both fail review, **2 more under D-U2** (cap 5), with the wording fixed
   offline after the 2nd failure.
4. **Review checklist (IR-style, recorded in the log row):** the 3.1 add-ons of `REDESIGN_PLAN.md` plus **binary
   pass-V8 gates per key** measured on the cut (fixmeasure `colours`):
   - G1a bright glow (L >= 0.55 and S >= 0.40, the (214, 231, 90) / (173, 189, 99) family or the new cut's
     equivalent) **>= 60 px in idle and >= 60 px in attack** (R290: 2 and 8);
   - G1b each eye >= 4 bright px in idle and attack;
   - G1c at least one non-equine feature visible at 1x in all 3 keys (named in the row: skull, smoke legs, spines);
   - G1d sibling check: not mistakable for `nightmare` at 1x (roster report silhouette < 0.85 or edge < 0.60, plus
     side by side), and different from both archives `crazy_horse_v1` and `crazy_horse_v2`;
   - the usual: band height, feet row, no border pixels, binary alpha, `edges_ok`, `pose_diff` >= 0.15.
5. **Approve** (`approve.py`), **in the same commit** `retire.py --move-rig crazy_horse` (state C), log row, commit.
6. **Re-rig (R):** a fresh rig on the quadruped template (the R290 rig is archived as `crazy_horse_v2`; its joints do
   not fit new art). Smoke legs: if the feet are smoke columns, the `feet anchored` check needs ground-contact pixels
   per foot: the rig names the smoke base as the foot. <= 4 iterations; `check crazy_horse` OK; `review`.
7. **Fresh image-only review (IR):** strips, onion, GIFs, `_stage.png` and the approved sheet, with the question "does
   it read as an otherworldly, evil horse in idle and attack at 1x, not an ordinary horse?" plus guide 3.4 criteria
   1-6: SHIP / SHIP WITH NITS required. Lock, restore the atlas, hand off.
8. **Integrate (I):** merge, `enemies.yaml` description adjusted to the new look (TS, ASCII), rebuild, `check --all`,
   commit.

**Fallback if all 4 attempts fail review (G, then R):** keep the best of R290 and the new attempts (best of 5 with
nits; if R290, G-X restore from `crazy_horse_v2`) and apply an **FW-P paint** on the idle and attack keys
within the rules: recolour the existing crack pixels (132, 148, 74) / (99, 99, 57) to the palette's bright
(214, 231, 90) / (173, 189, 99) (measured 55 px idle, 85 px attack), grow each eye to 4-6 px, total **<= 160 px per
key**, approved palette only (both colours are in the hurt key). This fixes the glow (G1a needs >= 60: reachable only
with extra crack pixels inside the cap) but **not** the silhouette (G1c); the P1 then stays PARTLY and is reported to the
user (D-U2 is spent).

**Acceptance (binary).** G1a-G1d all yes on the approved keys; `check crazy_horse` OK; IR verdict SHIP / SHIP WITH
NITS; ledger crazy_horse/monster_large pass-V attempts <= 5 (the 4th and 5th only after 2 failed V8 reviews);
`crazy_horse_v2` archived and git-tracked before the first V8 request; re-test row P1-1 FIXED.

### F2. P2-1 piscodemon: not terrifying

**Root cause (verified).** The approved sheet has **no yellow at all** (10-11 colours per key; the eye is the pale
cream (222, 214, 189), which is also the shell-plate colour, 77-81 px per key): the R291 raw's yellow eyes were
merged into the cream plates by the colour cut (R291 log nit). A round pale eye with a small dark pupil reads as sad
(`z/z_pisc_face.png`). The soft teal ramp ((115, 165, 148), (90, 132, 132), (49, 74, 82)) has low contrast and no
accent colour. Tentacles: drawn in side view as 4-5 overlapping strands (the prompt's "exactly six" is not countable
side-on).

**Fix (orchestrator ruling D-O2 modified: regenerate directly; G, then R, IR, I).**
- (a) **Regenerate (2 attempts, the sheet's remainder):** G-0, G-R `piscodemon --as piscodemon_v2`, G-S seeds, then
  the R291 text with: "two narrow slanted eyes glowing bright yellow-orange with black slit pupils, each a large bright spot, under a
  heavy brow ridge"; "deep shadows on the head, darker sea green and near-black slate"; "the tentacles drawn spread
  apart, three on each side of the face, each tentacle separately visible"; the shell plates "dark grey-green", so the
  eyes are the only light accent; extra_negative adds "round eyes, pale eyes, white eyes, big cute eyes, pastel
  colours". Gates: G2a eye colour is a yellow/orange hue (H 30-65, S >= 0.5) and not used elsewhere on the body;
  G2b >= 5 tentacle tips separately visible at 4x; G2c IR answers "menacing" at 1x; plus the 3.1 checklist. Then
  re-rig, IR, lock, integrate as F1 steps 5-8.
  Approve in the same commit as `retire.py --move-rig piscodemon`; re-rig (biped, <= 4 iterations), IR, lock,
  integrate (F1 steps 5-8).
- (b) **Fallback only if both attempts fail review:** G-X restore of R291 from `piscodemon_v2` (byte-identical, `cmp`),
  then an FW-P paint on the restored rig: the palette has no yellow, so the eye cannot turn yellow; the paint reshapes
  each eye into a narrow slit (outline ink (6, 4, 10) over the top half of the cream eye, a dark lid) in all three keys
  (estimated 20-30 px per key, <= 160). Improves the "sad" read, not the colour.

**Acceptance.** Route (a): G2a-G2c, the 3.1 checklist, `check piscodemon` OK, IR SHIP / SHIP WITH NITS, locked,
`piscodemon_v2` git-tracked. Route (b): R291 byte-identical to the archive, paint within FW-P, IR "menacing at 1x"
recorded (if no: P2-1 stays a recorded nit, reported). Re-test P2-1 FIXED or the recorded nit.

### F3. P2-2 black_knight: round horns read as ears, visor glow tiny

**Root cause (verified).** (1) The horns are drawn as closed curls (R293 raw "two large pale ash-grey curled ram
horns") whose cut is a round grey disc of (173, 173, 173) / (140, 148, 148) on each side of the helm
(`z/z_bk.png`): no tip, so at 1x two round blobs = ears. (2) The visor glow is **5 px in the idle ((148, 24, 82) x2 +
(74, 0, 66) x3), 0 px in the attack, 4 px in the hurt** (census of `approved/black_knight/monster_small.png`): the
colour cut kept too few of the raw's orange visor pixels (R293 nit).

**Fix (0 images, R: FW-P keyframe paint on the existing rig, then lock).**
- Visor: paint a T-shaped slit in idle, attack and hurt with the palette's (148, 24, 82) core and (74, 0, 66) rim:
  a 5-6 px horizontal bar + a 2-3 px vertical bar (about 12-16 px per key, measured on the key with `fixmeasure.py
  colours` / `pieces`).
- Horns: break each round curl into a hooked point: erase (`rgb: null`) or outline-ink the inner curl and extend the
  lower end into a 3-4 px point that hooks forward/down, with the horn's own (173, 173, 173) / (140, 148, 148) / outline
  ink (estimated 25-40 px per horn, 50-80 px per key).
- Total <= **100 px per key** (cap 160), approved palette only; in-betweens follow from the painted keys (the rig's
  existing frame-paint entries, if any touch the helm, are re-derived).
- **Image fallback (D-O2, rev 3 hygiene):** if IR rejects the paint, the `v8-rig-black_knight` branch is
  **abandoned** (not merged; the rig on `roster-int` stays the unpainted a7c7dd6 rig), so `black_knight_v2` archives
  the unpainted rig and lock (G-0 `cmp` against `roster-int` first). Then G-R `black_knight --as black_knight_v2`,
  G-S seed, the last pass-V attempt (1 left) with "two long horns curving back and then forward to sharp points, each
  ending in a clear point, not curled into a circle", "a wide T-shaped visor slit glowing bright orange-red" named in
  every pose; gates G3a-G3c on the cut; approve + `--move-rig`; re-rig, IR, lock.
- **Terminal outcome of the single attempt:** if it is rejected, G-X restores R293 from `black_knight_v2`; the rig
  agent re-applies the best painted rig (the abandoned branch's commit, cherry-picked) as the final rig; P2-2 is
  recorded as a nit and reported to the user as a D-U2-style question (accept, or an exception for one more image).
  No other image.

**Acceptance.** G3a each horn has a visible point (a tip of <= 2 px width) at 1x in all 3 keys; G3b visor glow >= 10
px in idle, attack and hurt; G3c IR answers "horns, not ears" and "the visor glow reads at 1x"; paint within FW-P
(cap, palette; `check black_knight` OK, re-locked as `kf:idle`, `kf:attack`, `kf:hurt`); re-test P2-2 FIXED.

### F4. P2-3 hollow_seraph: blades read as cream swords with hilts; body not hollow

**Root cause (verified).** (1) The approved prompt itself asks for it: "each wing one long straight blade ... held in a
brass frame, **like a sword blade**" (`REDESIGN_PLAN.md` 4.1 prompt seed); Gemini drew swords with cross-guards and
pommels (R313 nit "the blades have cross-guards and read a little like floating swords"). (2) The blade fill is two
warm creams, (247, 247, 222) / (247, 239, 214) and (231, 214, 165) / (231, 214, 173): **2,368 px in the idle, 2,017 in
the attack, 2,316 in the cast, 1,987 in the hurt**; the palette (42 colours over the 4 keys) has no blue, steel or
glow colour beyond these creams and the greys (74, 74, 74) / (90, 90, 90) / (99, 99, 99). (3) "Hollow": every plate is
drawn solid (blackened steel (41, 49, 49) with brass trim); the gaps are between plates, nothing is seen *through* a
plate, so at 1x it reads as a disconnected but solid armour.

**Route chosen: (b), the user's D-U1 ruling (2026-11-16): regenerate the full set** (G, FW, then R, IR, I).
1. **FW-V8 first** (section 1): `sheet_caps` boss_idle 6, boss_attack 6, boss_cast 5, boss_hurt 4, pinned RED-first.
2. **G-0, then G-R** `hollow_seraph --as hollow_seraph_v2` (all 4 poses, the R313 idle json with its `cut` options,
   the pass-V rig and lock, the entry).
3. **New text (offline):** the D-V9 four-wing and no-raise rules unchanged; "each wing a long tapering blade of cold
   white-blue light, glowing, with no hilt, no cross-guard and no handle, set into a brass wing frame of three thin
   struts joined to the shoulder plate"; "the armour plates are thin hollow shells: through the gaps and through open
   holes in the plates the background is seen; nothing inside"; extra_negative adds "a sword, a hilt, a cross-guard, a
   pommel, a handle, solid armour". Key-safe colours "cold white and pale steel blue" (no violet). The same `cut:
   {keep_pieces: all_in_cell, fit: headroom, top_margin: 10}` (R313); the R316-R319 small-change wording for the
   action poses (the wings stay in their idle places, the identity anchors named).
4. **Boss pipeline:** G-S seed per pose; `boss_idle` first (<= 3 V8 attempts) and approved, in the same commit
   `--move-rig hollow_seraph` and `--prune hollow_seraph boss_attack boss_cast boss_hurt` (state C); then attack,
   cast, hurt (<= 3 each), one pose per checkpoint, the rev-13 piece comparison per pose (render vs cut, a missing
   planned piece = reject), the four-wing count, identity vs the new idle (+-10 % height).
5. **Re-rig (R):** FW-1 floating, `raise: false`, `cast_hand`, the `halo` fx re-confirmed in `FX_ALLOWED`
   (`run_halo_brighten` on the new rig); a blade glow fx only with an orchestrator D-V18 approval; <= 4 iterations;
   `check`, `review`, IR, lock, commit; integrate.

**Failure exit (rev 6).** If any pose reaches its cap without an approvable image: (1) if a new idle was approved,
G-X with the `hollow_seraph_v3_partial` archive first, then restore v2 (no mixing of old and new poses); (2) then
**route (a)** on the restored set: the FW-P cross-guard and pommel erase (`rgb: null`, outline ink closing each blade
base), measured per key by the rig agent with `fixmeasure.py pieces` / `colours` (estimate 15-30 px per blade, 60-120
px per key). **If the erase needs > 160 px in any key, stop for an orchestrator `KF_PAINT_ALLOW` ruling** (D-O3); the
blade recolour over the cap (about 700-1,000 px per key, the sprite's own greys + cream) only under that ruling.
"Hollow" and "metallic light" are then a recorded nit.

**Why not paint or the remaining images alone (kept for the record).** Within the rules boss_idle and boss_attack had
0 attempts left, and a new cast or hurt must match the idle's identity, so it cannot change the blade look; the
palette has no cold or blue colour; see-through holes by paint would need hundreds of px per key and change the
outline topology (`pieces` / `detached`, the "same pieces in every key" rule).

**Acceptance.** Route (b): G4a no cross-guard / pommel in any frame (IR at 4x); G4b IR "wings, not swords" at 1x;
G4c IR "the body reads hollow at 1x"; four blade wings in every frame; the per-pose piece comparison; `check
hollow_seraph` OK, `run_halo_brighten` passes, locked; ledger within `sheet_caps`; `hollow_seraph_v2` git-tracked.
Failure exit: G4a, G4b; paint within FW-P (or the D-O3 entry in `KF_PAINT_ALLOW` citing this plan); `fixmeasure
pieces` shows every blade still joined to its frame (no new piece); `check` OK; re-locked.

### F5. P2-4 chaos heavy-attack raise: arms double in thickness, head drops into the chest

**Root cause (verified).** Not a rig defect: the **approved `boss_attack_raise` key (R306, best of 3)** is drawn that
way. Its prompt asked for "the upper body sunk lower into the pooled robe so that the whole figure, raised fists
included, stays inside the grey box" (`REDESIGN_PLAN.md` 4.2), and R308 recorded "the arms very bulky, the flame head
a little smaller". The raise frames come from the rig's `attack_raise` keyframe in `anim/monsters/chaos.yaml` (key
`attack_raise:` at `:83`, its parts at `:112`, mask at `:120`; `atk_raise_in` at `:197` is drawn from the idle and
`atk_swing` at `:203` breaks the raise toward the attack); `enemyChoreography.ts:27-28` is only the frame-name to
source-key fallback table used when a sheet has no in-betweens. Hence the pop at `atk_raise_in -> attack_raise`
(`strips/chaos.png` row 4, viewed: the head sits between the raised forearms, about 40 art px lower).
The sheet has **0** attempts left. FW-P cannot move 40 px of head within 160 px; FW-O `key_offset` moves the whole
key (robe and hem included, max 12 px).

**Fix (0 images; R + FW-R; orchestrator-decidable, D-O4).** Set `raise: false` in `anim/monsters/chaos.yaml` (FW-R,
as the seraph): the raise key is dropped after padding (no cell moves), the sheet has no raise frames
(`hasRaise: false`), the heavy table plays wind1 -> wind2 -> mid -> attack with the glint `tip` from `atk_wind2`
(`monster_atlas.sheet_meta`). Remove the 4 `frame: attack_raise` paint entries (147 px) and the `attack_raise` joints,
masks and `z` entry. The approved PNG stays (unused, like the seraph's old raise).
- Tests: no TS test pins chaos's raise by name (grep at a7c7dd6: `heavyGlint.test.ts` pins only the seraph's
  `raise: false`; `enemyTravel.test.ts:132` and `lungeClearance.test.ts:120` pin chaos's travel, unchanged); the
  atlas-wide tests (`glintVisible`, `BattleArtRaise`, `enemyAttackTables`, `assetCoverage`, `atlasFrames` helper) run
  over the real atlas and must stay green with `hasRaise: false` (the seraph path). A new pinned case in
  `heavyGlint.test.ts`: "chaos: raise off (V8 F5), tip from atk_wind2". `selftest_pages.py:274` `CHAOS_TIP` reads the
  `chaos_v1` archive (unchanged; verified by the `--anim` run).
- Alternative (rejected): re-rig the raise frames from the idle key (arms rotated up by joints): a large titan-size
  arm rig with occlusion of the head; 4 iterations at risk, no better identity.
- Alternative (user): a raise image needs a user exception (sheet at 3/3); not proposed.

**Acceptance (rev 10).** (1) `monsters-ai.json` `sheets.chaos.hasRaise == false`; (2) the chaos sheet has no frame of its
own named in the raise set (`attack_raise`, `atk_raise_in`, `atk_raise_b`, `atk_swing`, `atk_swing2`; aliased as for
the seraph); (3) `python3 -I assets-src/gen/fixmeasure_edges.py rowspan chaos idle atk_wind1 atk_wind2 atk_mid attack
atk_follow atk_recover` on the head mask: every frame's head-top row within 12 native px of the idle's; (4) IR on the
loop GIF: "a heavy blow wind-up is visible": yes; (5) `check chaos` OK, re-locked, committed right after the lock;
(6) **gate for the chaos rig agent:** `selftest.py --anim` ALL PASSED before hand-off (it runs
`selftest_pages.py:315-322`, the FW-R `raise_off` / `CHAOS_TIP` check, which must still pass from the `chaos_v1`
archive); (7) the new `heavyGlint.test.ts` case green.

F6-F9 are TS-only (owner TS, worktree `v8-ts` off `roster-int`, one RED-first commit each). Line counts at a7c7dd6
are given for every file a fix touches (limit 250; `DebugSandboxScene.ts` 243 is tight: no net growth there;
`AiEnemyView.ts` 239 may grow to at most 241 lines, rev 9 ruling).

### F6. P2-5 poison drop and top orb inside the damage number on chaos

**Root cause (verified in code).** No rule separates numbers from status icons.
- The damage number spawns at the **cell top**, centred on the cell: `floatingNumbers.ts:35` `text.position.set(
  Math.round(sprite.x + sprite.width / 2 - approxWidth / 2), Math.round(sprite.y))` (37 lines), then rises 1 px per
  frame for 72 frames (`BattleEffects.ts:71`), unclamped.
- The status icon row sits above the frame's **head** (topmost opaque row, atlas `head`): `fx/statusFx.ts:176`
  `iconDraws(a.icons, anchor.head.x, anchor.head.y - ICON_LIFT)`; 24 px icons, row y head - 32 .. head - 8.
- Layer order `fx.status < fx.spell < fx.flash < fx.numbers` (`BattleLayers.ts:4-14`): the number is drawn over.
- Chaos (scale 3, head [100, 6], sprite top 164): icon row y 150-174 centred on x = cell centre; the number y 164-212
  centred on the same x (dx = 0), so the drop lands between "6" and "4" and the top orb (art rows 6-20 = y 182-224)
  under the digits. Not chaos-only: over the 123 atlas sheets, 67 overlap a 2-3 digit number at spawn (goblin 8 px,
  ogre fully inside the band); chaos is the worst because dx = 0. The only existing avoidance rule is for the target
  label (`BattleFieldTargeting.ts:151-165`, `enemyIconRowTop`).

**Fix (D-O5, rev 7: scoped and consistent).** In `createFloatingNumber` (`floatingNumbers.ts`):
- **Scope:** only for an enemy that shows >= 1 status icon at spawn (the same test as the target label,
  `BattleFieldTargeting.ts:157`); otherwise the number is **byte-identical to today** (position, rise). Party numbers
  unchanged.
- **Rule:** row bottom = head.y - `ICON_LIFT` (head from `statusFx.anchorOf`, i.e. `headOf(stoneTextures.coloured(
  texture))`, the same anchor the icons use); spawn y = max(cell top, row bottom + 4 + `RISE_MIN`), `RISE_MIN` = 24;
  the rise stops at y = row bottom + 4 (the number's top never re-enters the row), then the number holds and fades on
  its normal timer. It is never placed above the row (for chaos that would be 150 - 48 = 102, under the message
  window).
- **x:** the cell-centre x is kept unless a test shows an overlap at the new y; if it must move, it is clamped inside
  the cell and a 3-huge formation case shows no number overlapping a neighbour's box.

**Tests (RED first).** New `tests/scenes/battle/floatingNumberPlacement.test.ts` (next to the target-label case in
`statusIntegration.test.ts:172-189`): chaos, ogre and goblin from the real atlas with a poison icon: the number's box
over its whole float never intersects the icon row box and stays at y >= 124 (RED today for chaos and ogre); goblin
and ogre **without** an icon: position and rise byte-identical to today; a party number unchanged.

**Acceptance.** The tests green; re-test: poisoned chaos (`scenario=anim_pass_v_chaos`, Fight) digits and drop apart
(screenshot); a no-status fight on goblin, ogre and dragon looks as before (W5).

### F7. P2-6 FIR2 flames tiny at chaos's robe hem

**Root cause (verified in code).** `fir2 -> fire_all = {kind: rise, frames: 30, impact: 18, glyph: flame, count: 6,
scale: 2}` (`spell-effects.yaml:19, 82`). The rise emitter (`fx/emitters.ts:15-52`, 182 lines) starts every particle at
`anchor(b, 'feet')` = body box y + 0.92 h (`emitterCore.ts:63`), where the body box is the cell shrunk to
x + 0.15 w, y + 0.33 h, 0.7 w x 0.62 h (`fx/ActionFx.ts:146-149`): for chaos y about 660-704 (low on the robe). Only
positions and distances scale with the box: the count is fixed at 6 and the flame glyph (12 x 18 native) at glyph
scale 1 or 2 (capped by `FxDraw` and `fxDefs.ts:44`), i.e. at most 24 x 36 screen px on a 552 x 561 figure. On the
tier-H boxes the impact `elementFlash` (`BattleEffects.ts:48-65`, an orange silhouette copy at alpha 0.75 in
`fx.flash`, above `fx.spell`) covers the remaining flames, hence "the red tint instead". `rise` does not call the pass-V
`clampTop` (`emitterCore.ts:76-80`). The pass-V test `tests/scenes/battle/fxBigBoxes.test.ts` builds its box from the
full layout box (line 24), bypassing `ActionFx.box()`, and checks only y bounds, never size or coverage.

**Fix (D-O6, rev 8).** In the `rise` kind: count = `(e.count ?? 5) * clamp(round(b.h / 240), 1, 3)` (chaos body h
372 -> 2 x 6 = 12; boxes with b.h <= 300 keep their count), start rows spread over the lower **two thirds** of the body
box for b.h > 300 (else unchanged), glyph scale 2 for every particle when b.h > 300; `clampTop` applied to `rise`
like `fall`. No new glyph scale 3 (the `fxDefs` cap stays). Element flash unchanged (it is the hit read on tier-H).

**Tests (RED first).** `fxBigBoxes.test.ts` gains cases built through `ActionFx.box()`:
- for every effect kind: on boxes with b.h <= 300, every point y >= screen top + 124, and the draw lists are
  **byte-identical** to today for a fixed RNG on goblin, ogre, one tier-H sheet and a party HEAL target;
- chaos: at t = impact - 1, >= 10 flame draws whose centres lie inside the body box; every point y >= 124.

**Acceptance.** Tests green; re-test screenshot of BWIZ FIR2 on chaos: flames visible over the robe and body.

### F8. P2-7 sandbox with 6-9 huge enemies silently shrinks them

**Root cause (verified in code).** `formationFits` (`EnemyLayoutAi.ts:155-175`, refusing pass 4 with a scale-3 sheet
at `:160`) is **never called in `src/`** (grep: only its definition and doc comments); `layout()` (`:103-141`) falls
through the passes silently and `computeEnemyLayoutAi` drops the pass. The sandbox path (`sandboxModel.ts`
`parseDeepLink:189-210`, `addCustom:110-114`, cap 9; `sandboxBattle.ts startSandboxBattle:44-63`) only drops unknown
ids. Six tier-H fit at pass 3 (scale 2, by design, 6 x 192 + 5 x 16 = 1232 <= 1260); nine reach pass 4 (scale 1),
which the plan (2.5, rev 11) calls unsupported. The data test cannot see it either: `crossFileValidation.test.ts`'s
`enemyBox` (`:94-101`) uses the global atlas scale 2 and passes no per-sheet `scale` / `ox0` / `ox1`, so the `:160`
refusal is never exercised on real data.

**Fix (D-O7, rev 9 ruling: narrowed to the sandbox plus the AiEnemyView warning).** A new helper
`src/scenes/battle/formationCheck.ts` builds the real `EnemyBoxInput`s from the atlas (the same inputs as
`AiEnemyView.build`) and returns `formationFits`. `startSandboxBattle` (`sandboxBattle.ts:44-63`) calls it before
`triggerBattle`: a refused formation logs `console.warn('sandbox: formation does not fit at an integer scale >= 2:
<ids>')`, **returns false and pushes no battle**. `AiEnemyView.build` calls the helper and logs the same warning once
if any battle lays out a refused formation (`AiEnemyView.ts` <= 241 lines). Debug scenarios and encounter tables are
not changed (they are covered by the data test). The 6-tier-H case keeps running at screen scale 2: by design (plan
2.5, pass 3), recorded on the D-O10 nit list. `crossFileValidation`'s `enemyBox` (`:94-101`) is made scale-aware
(per-sheet `scale`, `ox0` / `ox1`, `layoutSizeOf`); **if it then refuses an authored formation, stop and report to the
orchestrator; never relax the test.**

**Tests (RED first).** `tests/systems/debugSandboxBattle.test.ts`: the 9-tier-H deep link: `console.warn` (spy) naming
the ids, `startSandboxBattle` returns false, no battle pushed; 6 tier-H and the 3-huge / mixed formations start.
`AiEnemyView.test.ts`: the warning fires once for a refused fixture formation, never for a fitting one.
`crossFileValidation`: the scale-aware `enemyBox` keeps every authored formation passing.

**Acceptance.** Tests green; re-test: the 9-tier-H URL is refused with the warning; `anim_pass_v_huge`,
`anim_pass_v_mixed` run.

### F9. P2-8 bestiary "Weak" text runs into "Resist" (pre-existing)

**Root cause (verified in code).** `bestiaryModel.ts:171` (198 lines) allows a short value of exactly
`COLUMN_CHARS - LABEL_CHARS` = 28 - 11 = 17 characters with no trailing gap; `cell()` (`:116`) pads the label to 11 and
clips to 28. The panel puts the right column at `contentX + COLUMN_CHARS * CHAR_WIDTH` (`BestiaryStatsPanel.ts:25`,
46 lines) with `CHAR_WIDTH` 14 (`LayoutConstants.ts:28`; never re-measured), while the 24 px monospace glyph is about
14.4 px: 28 glyphs end at about 403 px, past the column at 392. Over the 127 enemies the only Weak value over 16 is the
dragon's "Ice, Poison/Stone" (17); the longest Resist is 15 ("Fire, Ice, Bolt").

**Fix (D-O8).** `:171` threshold to `COLUMN_CHARS - LABEL_CHARS - 1` (16: a value of 17 wraps full width), and the
right column x from the measured glyph width (`glyphWidth(FONT_SIZE)`, `battleMessageUtils.ts:184`; 28 x 14.4 = 403,
56 glyphs = 806 <= the 824 px content width).

**Tests.** `bestiaryModel.test.ts`: the dragon Weak case (`:93`) re-stated (by design, commented: it wraps); the
budget test (`:151-160`) requires a trailing space when a right cell is set (`<= COLUMN_CHARS - 1`), RED today for the
dragon; a panel test: the right column x >= 28 x the measured glyph width; a test over **every** enemy in
`enemies.yaml`: the page fits the 17-line budget and no `warnKey` warning is logged. Acceptance: green; re-test
`bestiary=dragon` screenshot without overlap.

---

## 3. Tranches

Concurrency cap **4 agents**. Brief rules for every agent (`REDESIGN_PLAN.md` 10, binding; rev 12):
- Long commands run with `run_in_background` as `<cmd> > /tmp/<agent>/<step>.log 2>&1; echo EXIT=$? >>
  /tmp/<agent>/<step>.log`; wait with **Monitor** on `until grep -q EXIT= /tmp/<agent>/<step>.log; do ...; done`,
  **timeout <= 240 s**, re-armed with one progress line. Never `sleep`; keep foreground calls under 2 minutes. This
  includes **every paid `generate.py` call, every `monsters_ai` build and every `check --all`**.
- **No self-matching `pgrep`** wait loops. **Never a bare `git stash`** (shared stash stack): a WIP commit on your own
  branch, or `git stash push -u -m "<unique-tag>" -- <paths>` in your own worktree with apply-by-SHA.
- Never two `monsters_ai` builds in one worktree at once. One sprite per `check` / `review` call.
- **Commit right after `lock`** (rig agents): the lock and the rig in one commit on the rig branch, before the
  atlas restore and the hand-off.
- **Retire first:** no paid request for a sprite until G-0 and G-R (`retire.py <id> --as <id>_v2`) are committed on
  `roster` and its `RETIRED_SPRITES.md` row written. The `roster` fast-forward and every retire commit happen before
  any agent forks from `roster-int` for W3.
- **IR agents** get file paths only (strips, onion, GIFs, `_stage.png`, the approved sheet, the sibling and archive
  sheets) and run no builds and no checks.
- Browser checks: dev server on 127.0.0.1, a free port, every URL with `&mute=1`; stop the server afterwards.

| Tranche | Scope | Agents (count) | Depends on | Effort |
|---|---|---|---|---|
| W0 | done: momus APPROVE WITH REVISIONS, rev 2 applied; D-U1 = b, D-U2 = b (user); D-O1..D-O10 (orchestrator) | orchestrator | - | done |
| W1 | **TS fixes** F6-F9 (RED first, one commit each) in `v8-ts` | TS (1) | W0 | 3-4 h |
| W1 | **0-image rig fixes:** `v8-rig-chaos` (F5 `raise: false`), `v8-rig-black_knight` (F3 paint) | R (2) | W0 | 2-3 h each |
| W1 | **FW-V8** (`sheet_caps` in `budget.json` + `check_budget` + `budget_consistency`, `selftest_passv.py` RED first) | FW (1) | W0 | 1.5 h |
| W2 | **Generation** in the main checkout (`roster`), serial: G-0 (ff-only to `roster-int`, `cmp`); then crazy_horse (G-R v2, <= 2 + 2 under D-U2), piscodemon (G-R v2, <= 2; unconditional), hollow_seraph (FW-V8 merged and fast-forwarded first; G-R v2; idle -> attack -> cast -> hurt, <= 3 each); black_knight only if F3 fails IR (abandon its rig branch, G-R v2, 1 image) | G (1) | W0; FW-V8 for the seraph and for crazy_horse's D-U2 extra; the F3 IR verdict for black_knight | 1-1.5 d |
| W3 | **Re-rigs** of every regenerated sprite (crazy_horse, piscodemon, hollow_seraph; black_knight if regenerated), each after its sheet is integrated (9.1 step 6); the piscodemon slit-eye paint only on its fallback; the seraph cross-guard erase only on its failure exit | R (<= 3 with G running) | W2 sheet integrated | 0.5-1 d each |
| W1-W3 | **Fresh image-only reviews**, one per changed sprite, after each rig's `review` | IR (fresh each) | the rig | 20 min each |
| W4 | **Integration**: merge each rig / TS branch when complete, rebuild, `check --all`, section 4 validation, docs | I (1) | W1-W3 | 0.5 d |
| W5 | **Fresh re-test** of the changed items (section 4.3) | T (1, fresh) | W4 | 2-3 h |

Agent count: W1 = TS + 2 R + FW = 4, so the generator starts W2 when FW-V8 is merged and fast-forwarded (the FW
slot frees and the guard then knows the caps). During W2/W3: G + at most 3 of {R, IR, I, TS}. IR agents count
against the cap while running.

Integration order (I): TS branch (independent), chaos, black_knight (paint), then each regenerated sprite (crazy_horse,
piscodemon, hollow_seraph; black_knight if regenerated) after its re-rig. A regenerated id is merged from `roster`
only when its sheet set is complete (state C/D, `--move-rig` done; the seraph also `--prune`d), so old sheet + new rig
never meet (9.4 states apply).

---

## 4. Validation and re-test

### 4.1 Per fix (owner, before hand-off)

- Rig fixes: `monster_anim.py check <id>` OK (only `OK`), `review <id>`, fixmeasure numbers for the gate (F3 visor and
  horn px; F4 cross-guard px and `pieces`; F5 `rowspan` head rows), `lock <id>`, commit; the chaos rig agent also
  `selftest.py --anim` ALL PASSED.
- Generation: the dry run, the paid request (background), the log row in `ROSTER_LOG.md` "Pass V fix round (V8)"
  (`| # | <id>/<sheet> (seed N) | n | measured result | decision |`, citing the user's pass-V approval and, over 3,
  D-U1 / D-U2), `Images used: U of 50 (ledger guard: G - 367; V8 halt 47)`; main-checkout `selftest.py` in the 9.4
  state of the id.
- TS: the new test RED, then GREEN; `npx tsc --noEmit`; the files touched stay under 250 lines (`AiEnemyView.ts` <= 241).

### 4.2 Integration (I, background)

The `REDESIGN_PLAN.md` 11.1 commands, plus:
- budget script (11.1) with the V8 slice: pass V <= 47, per sheet <= 3 or its `sheet_caps` entry, every id / sheet in
  `only_sheets`;
- `selftest_retire.py`; `git ls-files --error-unmatch assets-src/gen/approved/_retired/<id>_v2/
  assets-src/gen/anim/monsters/_retired/<id>_v2.yaml assets-src/gen/anim/monsters/_retired/<id>_v2.lock.json` for
  crazy_horse, piscodemon, hollow_seraph (and black_knight if its fallback image ran);
- frame-rect diff vs a7c7dd6 by `(sheet, frame)` content: changed exactly = {chaos (raise frames gone, `hasRaise`
  false), black_knight, crazy_horse, piscodemon, hollow_seraph} (on a failure exit the restored sprite is changed only
  by its fallback paint, or `same` if none); every other sheet `same`;
- `check --all` 123 `OK` + 4 FWQ notes; `selftest.py --anim` and main-checkout `selftest.py` ALL PASSED; party atlases
  byte-identical; `PYTHONHASHSEED` 0/1 identical; pages <= 2048 and the act-1 sheets on page 0 (the measured page
  count recorded);
- `npx tsc --noEmit && npm run build && npx vitest run` exit 0.

### 4.3 Fresh re-test (T)

A fresh tester with only the URLs, the changed-item list and the evidence path `/tmp/v8rt/`; rows in
`docs/ROSTER_PLAYTEST.md` "Pass V re-test (V8)":
- crazy_horse: `/?mute=1&bestiary=crazy_horse&battleStep=1`, `scenario=anim_pass_v_regulars`: every frame at 1x and 4x;
  "otherworldly / evil, not an ordinary horse, in idle and attack" yes/no; vs `nightmare` and both archives.
- piscodemon, black_knight: bestiary + `anim_pass_v_regulars`: "menacing at 1x", "horns not ears", "visor reads";
  piscodemon vs `mindflayer` and both archives.
- hollow_seraph: `bestiary=hollow_seraph&battleStep=1`, `scenario=anim_pass_v_seraph`: "wings not swords", "reads
  hollow"; four wings in every frame; lunge top >= 124.
- chaos: `bestiary=chaos&battleStep=1`, `scenario=anim_pass_v_chaos`: the heavy sequence has no head drop or arm
  doubling; the telegraph reads; Fight on poisoned chaos: number and status icon apart (screenshot); BWIZ FIR2:
  flames visible on the body.
- a no-status fight on goblin, ogre and dragon: damage numbers as before (rev 7).
- sandbox `sandbox=l30_lich&enemies=<9 tier-H>`: refused with the console warning, no battle; a 3-huge and the mixed
  formation still run.
- bestiary `bestiary=dragon` and the longest Weak / Resist rows: no overlap.
- regression: the 15-sheet sample of V7 D (byte-identical, bestiary centred), `anim_crowd` FPS >= 110.
Done = P1-1 FIXED, every P2 FIXED or on the decided nit list, no new P0/P1.

---

## 5. Decisions

### 5.1 Orchestrator (ruled 2026-11-16)

| # | Decision | Ruling |
|---|---|---|
| D-O1 | crazy_horse: regenerate (retire v2 first) rather than paint | **regenerate**; paint only as the fallback |
| D-O2 (modified) | piscodemon: **regenerated directly** (<= 2, retire v2 first); the slit-eye paint only if both fail (R291 restored byte-identical first). black_knight: paint first, the last image only if IR rejects the paint | **as stated** |
| D-O3 | hollow_seraph: a `KF_PAINT_ALLOW` cap above 160 | only on the F4 failure exit, if the cross-guard erase needs > 160 px in a key or fails IR; then a measured ruling |
| D-O4 | chaos: `raise: false` (FW-R), the R306 raise key unused | **yes** |
| D-O5 | P2-5: with >= 1 status icon, the enemy number spawns below the icon row (rev 7 rule); otherwise unchanged | **yes** (F6) |
| D-O6 | P2-6: `rise` count `(e.count ?? 5) * clamp(round(b.h / 240), 1, 3)`, start band and glyph scale for b.h > 300, `clampTop` | **yes** (F7) |
| D-O7 | P2-7 (rev 9 ruling): sandbox refusal = `console.warn` naming the ids + `return false` + no battle pushed; `AiEnemyView.build` warns once (<= 241 lines); scenarios / tables via the scale-aware data test | **yes** (F8) |
| D-O8 | P2-8: fix the pre-existing bestiary label overlap in this round | **yes** |
| D-O9 | V8 halt at 47 of 50 (the exact worst case, section 1) | **yes** |
| D-O10 | Nit list (not fixed): chaos robe folds / stars at 1x, guardian attack eye splash at 4x, 3x vs 2x pixel density (D-V1), **6 tier-H shown at screen scale 2 (by design, plan 2.5 pass 3)** | **accepted as nits** |
| Rev 5 ruling | `sheet_caps: {hollow_seraph/boss_idle: 6, hollow_seraph/boss_attack: 6, hollow_seraph/boss_cast: 5, hollow_seraph/boss_hurt: 4, crazy_horse/monster_large: 5}`, generic, read by both per-sheet rules, accepted by `budget_consistency`, pinned RED-first in `selftest_passv.py`; crazy_horse's extra 2 only after its regular 2 fail | FW-V8 (section 1) |

### 5.2 User (answered 2026-11-16)

| # | Question | Answer |
|---|---|---|
| D-U1 | hollow_seraph P2-3 with boss_idle / boss_attack at 3/3 | **(b) regenerate the full set**, archive `hollow_seraph_v2` first (F4; up to 12 images) |
| D-U2 | crazy_horse if both remaining attempts fail review | **(b) up to 2 more attempts** (cap 5) |

Open for the user only on a terminal failure: black_knight's single fallback image rejected (F3), or the seraph
failure exit needing images (F4); both are reported, not pre-decided.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Smoke legs on crazy_horse fail `feet anchored` or the quadruped template | the rig names the smoke base as the foot; the motion line keeps the feet on the ground; a framework blocker pauses the count (9.3) |
| The new crazy_horse glow cuts to olive again in the colour cut | "as bright as the eyes" in every pose text; G1a measured before approval; the paint fallback |
| A regenerated sprite drifts toward `nightmare` (dark horse + glow) | ash grey and bone named, "black hide, blue fire" in the negative, G1d roster report + side by side |
| Paint on black_knight horns breaks the outline check or `pieces` | horn edits keep the outline ink ring closed; `check` runs on the painted keys (`kf:` locks) |
| `raise: false` on chaos weakens the heavy telegraph | the IR loop question; the heavy glint still plays from `atk_wind2` (the seraph precedent) |
| Seraph images drift in identity (wing counts, R314-R317) or blades in "light" come back as swords again | the R316-R319 small-change wording; idle approved before any other pose; per-pose piece check; G4a/G4b gate before approval |
| A failed seraph set after a new idle mixes poses | G-X: archive `hollow_seraph_v3_partial`, restore v2 whole |
| The cross-guard erase splits a blade from its frame (failure exit) | keep the contact pixels; `fixmeasure.py pieces` before `check`; no new piece allowed |
| `roster` is behind `roster-int` (4b54fc5) and retires an old rig | G-0: `git merge --ff-only roster-int` and `cmp` against `roster-int` before every retire |
| The scale-aware data test refuses an authored formation | stop and report; never relax the test |
| Agents killed by the watchdog | the brief rules (background + Monitor <= 240 s for paid calls, builds and `check --all`; no self-matching `pgrep`) |

---

## 7. TODOs

```markdown
## TODOs
- [x] W0 momus review (APPROVE WITH REVISIONS); 12 revisions applied as rev 2 (2026-11-16)
- [x] W0 rulings: D-U1 = b, D-U2 = b (user); D-O1..D-O10, D-O2 modified, rev 5 / rev 9 (orchestrator) (2026-11-16)
- [ ] W1 FW FW-V8 sheet_caps (both per-sheet rules, budget_consistency), selftest_passv.py RED -> GREEN (high, 1.5h)
- [ ] W1 TS F6 numbers vs status icons (scoped rule), RED test, fix (medium, 1h)
- [ ] W1 TS F7 rise emitter on big boxes, byte-identity cases, RED test, fix (medium, 1h)
- [ ] W1 TS F8 sandbox refusal (warn + return false + no battle) and AiEnemyView warning; scale-aware enemyBox (medium, 1.5h)
- [ ] W1 TS F9 bestiary Weak / Resist threshold and glyph-width column; every-enemy 17-line test (low, 1h)
- [ ] W1 R chaos raise: false, paint / joints / mask removed, rowspan gate, heavyGlint case, selftest --anim, IR, lock, commit (high, 2h)
- [ ] W1 R black_knight horn + visor paint (<= 160 px/key), check, IR, lock, commit (high, 2h)
- [ ] W2 G G-0: roster ff-only to roster-int, cmp every to-be-retired file (high, 0.25h)
- [ ] W2 G crazy_horse: G-R v2, new text, G-S seeds, <= 2 attempts (+2 under D-U2), gates G1a-G1d, approve + --move-rig (high, 2h)
- [ ] W2 G piscodemon: G-R v2, new text, G-S seeds, <= 2 attempts, gates G2a-G2c, approve + --move-rig (high, 1.5h)
- [ ] W2 G hollow_seraph (after FW-V8): G-R v2, new text, idle -> attack -> cast -> hurt (<= 3 each), --move-rig + --prune with the idle (high, 1d)
- [ ] W2 G (conditional) black_knight fallback image: abandon the rig branch, G-R v2, 1 attempt (medium, 1h)
- [ ] W3 R re-rig crazy_horse, piscodemon, hollow_seraph (and black_knight if regenerated): check, review, IR, lock, commit (high, 0.5-1d each)
- [ ] W3 R (conditional) piscodemon slit-eye paint on R291 / seraph cross-guard erase on the failure exit (medium, 2-3h)
- [ ] W4 I integration, section 4.2 validation, ROSTER_LOG / RETIRED_SPRITES / AGENTS.md updates (high, 4h)
- [ ] W5 T fresh re-test, 'Pass V re-test (V8)' rows (high, 3h)
```

---

## 8. Momus revisions (rev 2)

Momus verdict on rev 1: **APPROVE WITH REVISIONS**, 12 binding revisions. All applied in place.

| # | Revision | How it was applied |
|---|---|---|
| 1 | Modified D-O2 everywhere (piscodemon regenerated directly) | F2 rewritten: regenerate first (G-R v2, <= 2); the slit-eye paint only after both fail, on R291 restored byte-identical; W2 "piscodemon paint" row deleted, the generator row unconditional; TODOs, 5.1 row, integration order, 4.2 diff set updated |
| 2 | `roster` fast-forward and `cmp` before retiring | 2.0 G-0 (`git merge --ff-only roster-int` on `roster`, `cmp` of `approved/<id>/*` and the rig + lock vs `roster-int`); pass_fail: `git ls-files` of `approved/_retired/<id>_v2/` and `anim/monsters/_retired/<id>_v2.*` per regenerated id; 4.2 |
| 3 | black_knight fallback hygiene and terminal outcome | F3: abandon `v8-rig-black_knight` on an IR reject, so `black_knight_v2` archives the unpainted a7c7dd6 rig; a rejected single attempt -> restore R293, re-apply the best painted rig, P2-2 nit + a user question |
| 4 | Restore procedure | 2.0 G-X (files, rig, entry without `retired_as`, `cmp`, `check` OK); a failed seraph set after idle approval archives `hollow_seraph_v3_partial` first |
| 5 | Budget arithmetic (ruling: `sheet_caps`) | section 1: the caps table, FW-V8 (both per-sheet rules, `budget_consistency`, `selftest_passv.py` RED cases), exact worst 12 + 2 + 2 + 2 + 1 = 19, 28 + 19 = 47 = the halt; expected about 40 |
| 6 | D-U1 sequencing and failure exit | W1 = TS + 2 R (+ FW-V8); F4 route (b) with its failure exit (partial archive, restore v2, route (a) erase; > 160 px in any key -> stop for a `KF_PAINT_ALLOW` ruling); risk row on blade/frame splitting with `fixmeasure pieces` before `check` |
| 7 | F6 rule consistent and scoped | F6: only with >= 1 icon at spawn (`BattleFieldTargeting.ts:157`), else byte-identical; spawn y = max(cell top, row bottom + 4 + `RISE_MIN` 24), rise stops at row bottom + 4, head via `statusFx.anchorOf`; x kept unless a test shows overlap (then clamped, 3-huge no-overlap case); tests and the W5 no-status fight |
| 8 | F7 formula and acceptance | F7: `(e.count ?? 5) * clamp(round(b.h / 240), 1, 3)`; every kind on b.h <= 300 byte-identical draw lists for a fixed RNG (goblin, ogre, one tier-H, party HEAL), points y >= top + 124; chaos >= 10 flame draws inside the body box at impact - 1 |
| 9 | F8 (ruling: warn + return false + no battle; AiEnemyView <= 241) | F8 narrowed to the sandbox plus the `AiEnemyView` warning; criterion and D-O7 restated; the 6-tier-H-at-scale-2 half on the D-O10 nit list; "stop and report" if the scale-aware `enemyBox` refuses an authored formation |
| 10 | F5 acceptance and wording | F5: `hasRaise == false`, no raise-set frame of its own, `fixmeasure_edges.py rowspan chaos idle atk_wind1 atk_wind2 atk_mid attack atk_follow atk_recover` head rows within 12 px; the root-cause sentence names the rig's `attack_raise` keyframe in `chaos.yaml`; `selftest.py --anim` gate (`selftest_pages.py:315-322`) before hand-off |
| 11 | Seeds | 2.0 G-S: `sheet_seeds: {<sheet>: N}` set after the retire for every paid request, N in the log row |
| 12 | Watchdog | section 3 brief rules: paid `generate.py`, `monsters_ai` builds and `check --all` in the background with Monitor (<= 240 s); IR agents get file paths only and run nothing; the `roster` fast-forward and retire commits before any W3 fork |
| - | Citation fixes and concerns | `startSandboxBattle` `sandboxBattle.ts:44-63`; `glyphWidth` `battleMessageUtils.ts:184`; every `--retry` row cites the pass-V user approval (section 1, 4.1); totals stated against the 47 halt; F9 every-enemy 17-line budget and no `warnKey` warning test |

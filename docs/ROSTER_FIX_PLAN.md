# Roster fix plan (pass R, plan 11.4), 2026-11-15 (rev 2: momus revisions applied)

Input: `docs/ROSTER_PLAYTEST.md` at 95b31e2 (7 P1, P2 groups 8-13). Evidence: `/tmp/vpt/` (local). Rules:
`docs/ROSTER_PLAN.md` 6.4 (`pass R fix`: 15 images, `only_approved`, at most 3 pass-R attempts per sheet), 9.2
(ownership), 9.3 (3 iterations per fix round), 11.4; `docs/NEW_MONSTER_GUIDE.md` 2-3. Momus: APPROVE WITH REVISIONS;
the 18 binding revisions are applied (section 12). The orchestrator's decisions are in section 10.

Every root cause below was checked against the code, the rig or the approved PNG at 95b31e2. File:line references are
to that commit. "Approved pixels" means the defect is in `assets-src/gen/approved/<id>/*.png` itself, so no in-between
rig edit can fix it without either a regeneration or the keyframe paint (FW-P, approved: D-F6).

**Measurement conventions (used by every gate):** coordinates are native art px in the sprite's (padded) cell. The
opaque extents `homeX`, `lungeRight` and `opaqueRight` are **inclusive** column indices (`int(xs.max())`, as at
`monster_atlas.py:57`). A "fill component" is a 4-connected component of opaque pixels **with the outline ink (6, 4, 10)
excluded**. A "piece" is a 4-connected component of all opaque pixels. A frame name resolves through
`monster_recipes.FALLBACK` / `MA.resolve`, so keyframe-only sheets (aliased frames) measure too. Every gate runs through
the committed tool `assets-src/gen/fixmeasure.py` (FW-M, section 3), not through `/tmp` scripts.

---

## 0. Success criteria (defined before any fix)

```json
{
  "functional": [
    "No enemy art is drawn under the top message window (y < 124) on any displayed frame of a travelling attack, a hurt, or a death during travel, for every sheet in the atlas, in every layout the tests build",
    "Every formation of up to 9 large enemies whose home art (plus, for `attack: ranged` sheets, the attack frames) is <= 118 art px wide lays out at scale factor 1; every layout that fits at scale 1 today is unchanged",
    "Every P1 art defect (3-7) is gone from every frame that plays, judged by a fresh image-only reviewer and by its fixmeasure gate",
    "Every P2 item is fixed (with its own binary check) or on the accepted-nit list (D-F4, decided)"
  ],
  "observable": [
    "lungeClearance.test.ts: 0 violations over every sheet x layout x hero row x frame (per-frame opaque tops read from the atlas PNG)",
    "EnemyLayoutAi tests: the play-test crowd at scale factor 1, no opaque overlap; golden f=1 layouts reproduced",
    "fixmeasure.py numbers inside their bounds for ice_gigas, ogre, troll, ashen_queen, crocodile, garland, ochu, death_eye, drowned_sovereign",
    "check --all: only OK lines and 'no rig' lines (the 7 keyframe-only sheets)",
    "Frame-rect diff against HEAD changes only the sprites listed in section 5"
  ],
  "pass_fail": [
    "npx tsc --noEmit, npm run build, npx vitest run: exit 0",
    "python3 -I assets-src/gen/selftest.py --anim (worktree) / selftest.py (main checkout): ALL PASSED",
    "Party atlases byte-identical (git diff --exit-code); monster atlas identical for PYTHONHASHSEED 0 and 1",
    "pass R fix images used <= 5 (planned 1), each on an approved id, no sheet over 3 pass-R attempts (main-checkout ledger)",
    "Re-test (section 7): no P0/P1 open"
  ]
}
```

---

## 1. P1 defects

### Defect 1 (P1, runtime): a lunging boss rises under the top message window

**Root cause (verified).**
- `src/scenes/battle/enemyReach.ts:33-36`: `rise = targetFeetY - feetY`, clamped only to +-400 (`MAX_ENEMY_RISE`).
  Nothing bounds the top of the art.
- The message window covers y 0-120: `src/scenes/BattleScene.ts:166-168` with `BATTLE_MESSAGE_HEIGHT = 120`
  (`src/scenes/battle/BattleSceneTypes.ts:43`). Hero 0's feet are at y 425 (`BattleDisplayManager.ts:22`).
- A lone boss lays out at feet y 673 (`EnemyLayoutAi.ts:64-77`), so its sprite top sits at 673 - 193 x 2 = 287.
  Attacking hero 0 gives rise -248.
- The highest opaque rows over the travel frames (FW-A list, section 3) and where each lands at full rise
  (287 + 2 x row - 248):

  | Sheet | Highest row | Frame | Top at full rise |
  |---|---|---|---|
  | garland | 2 | `hurt_in1` | 43 |
  | hollow_seraph | 4 | `attack` | 47 |
  | warmech | 5 | `atk_mid` | 49 |
  | ashen_queen | 6 | `atk_recover` | 51 |
  | lich | 9 | `idle` | 57 |
  | astos | 9 | `atk_wind1` | 57 |
  | chaos | 12 | `attack_raise` | 63 |
  | drowned_sovereign | 20 | `attack_raise` | 79 |
  | death_eye | 42 | `idle` | 123 |

  Every one of these is under the 124 line; death_eye misses by a single pixel.
- A death during travel holds the travel offset (`EnemyPoseController.ts:146-156`, `s.held`) and draws `hurt` there.
  That is the "also clips top window in battle" of defect 3.
- `tests/scenes/battle/enemyTravel.test.ts:125-146` asserts that garland's and lich's art **does** overlap the message
  text (`overlaps > 0`). That was the pass-F decision. D-F3 (decided) inverts it.

**Fix (TS/data owner; FW-A from the framework owner).** The changes stay out of `EnemyPoseController.ts` (248 lines).
`AiEnemyView.ts` (234) gets at most +6 lines.
1. FW-A writes `travelTop` (section 3) into the atlas. TS reads it in a new `src/rendering/monsterAnchors.ts`
   (`BattleArt.ts` is at 234 lines) into `MonsterFrames.travelTop`, falling back to 0 (the cell top, conservative).
2. `enemyReach.ts`: `ReachInput.topY` (the screen y of the travel frames' highest row at home) and
   `TRAVEL_CLEAR_Y = BATTLE_MESSAGE_HEIGHT + 4` (124). While `travel > 0`,
   `rise = max(rise, TRAVEL_CLEAR_Y - topY + margin)`.
   - `margin` starts at 0. Hops ride on `k < 1` (`enemyAttackTables.ts:23,27`), and once a clamp has made `|rise|`
     small, a hop can climb above the line: the melee return hop is 8 px at 1x, and it rises above the clamp when
     `|rise| < hop x pi x m / 2`.
   - If the frame test below finds any violation, set `margin = hopPx x scaleFactor + 8` (the largest of the hop and
     the return hop) and re-run.
3. `AiEnemyView.ts:92-93`: pass `topY = b.y + travelTop * scale`.

**Acceptance (binary).**
- [ ] New `tests/scenes/battle/lungeClearance.test.ts`, written RED first.
  - **It must fail today** on garland, hollow_seraph, warmech, ashen_queen, lich, astos, chaos, drowned_sovereign
    **and death_eye** (123 < 124).
  - **It must not trust FW-A.** For each displayed frame it reads that frame's own opaque top from the atlas PNG,
    with `opaqueBounds` over the frame rect of `st.pose` (as `enemyTravel.test.ts:34-40` does for idle), cached per
    (sheet, frame).
  - **Scenarios.** For every sheet: (a) alone; (b) with two goblins, staggered. Attack each hero 0-3 and step every
    frame. A second run on hero 0 calls `freezeDying` at each attack frame t and runs the dying out.
  - **Pass:** `sprite.y + frameTop(st.pose) * scale >= 124` on every frame, with 0 violations.
- [ ] Contact still lands. For each of the 9 boss sheets on hero 0, at `contactAt`:
  - the opaque right edge is within 50 px of `targetLeft + 24` (as at `enemyTravel.test.ts:96`);
  - the vertical centre of the boss's opaque box lies inside the hero box's span [hero top, hero feet];
  - the boss's feet are at most 100 px below the hero's feet (lich today after the clamp: 490 vs 425).
  - This replaces the vacuous "≥ 80 % of the hero's height" assertion.
- [ ] `enemyTravel.test.ts:125-146` is rewritten for all 9 boss sheets:
  - the sprite stays in `actors` and `hud` stays last;
  - each frame's opaque box comes from that frame's own rect, not the idle `opaque(id)`;
  - `overlaps === 0`.
  Lines 88-123 pass unchanged.
- [ ] The test stubs carry the new fields. `enemyTravel.test.ts:42-52` and every other hand-built `MonsterFrames`
  (`grep -rln 'opaqueRight:' tests`: `enemyTravel.test.ts`, `tests/scenes/bestiary/BestiaryScene.test.ts`) get
  `travelTop`, `homeX` and `lungeRight` from the atlas JSON.
- [ ] Browser check (dev server on 127.0.0.1, `&mute=1`).
  - URL: `/?mute=1&sandbox=l30_lich&enemies=<id>&enemyAnim=step` for chaos, hollow_seraph, warmech,
    drowned_sovereign, garland, lich and death_eye.
  - Step through a whole attack on hero 0. At each step, read through `window.__game` (the `/tmp/vpt/b_test.js`
    harness, adapted) the frame's opaque top: the sprite's texture frame, cropped from the page image. Pass: the top
    is >= 120 on every step.
  - Screenshot the 3 highest frames. A fresh reviewer is asked whether any part of the enemy is cut by the top
    window. Pass: no.

### Defect 2 (P1, layout): 8-9 large enemies fall to half size

**Root cause (verified).**
- `EnemyLayoutAi.ts:39-51` sizes each column from the cell (`boxes[i].w`, the full 2x cell). Lines 59-62 switch
  everything to `f = 0.5` when the columns overflow the 1260 px area. `AiEnemyView.ts:109-113` passes the cell size.
- 9 large enemies make 5 columns: 5 x 256 + 4 x 24 = 1376 > 1260. The ogres then draw at 1 screen px per art px.
- The cells carry 10-24 art px of empty margin. Inclusive home widths: ogre 104, troll 99, minotaur 84.

**Fix (TS/data owner; FW-A).**
1. FW-A writes `homeX: [l, r]` (inclusive) over the home frames. For `attack: ranged` sheets (today: dragon only),
   the attack frames `atk_wind1 atk_wind2 atk_mid attack atk_follow atk_recover` are included as well (the ruling on
   revision 16; measured below).
2. `EnemyLayoutAi.ts`: `EnemyBoxInput` gets optional `ox0`, `ox1` (the opaque extent in box px; defaults 0 and w).
   `computeEnemyLayoutAi` tries three passes and keeps the first that fits:

   | Pass | Packing | Scale | Notes |
   |---|---|---|---|
   | 1 | cell | 1 | today's code, unchanged |
   | 2 | opaque: column width = max `ox1 - ox0 + 1`, gap 16 px, each cell centre placed so its opaque extent is centred in the column | 1 | only when pass 1 overflows |
   | 3 | cell | 0.5 | today's fallback |

   `formationFits` tests containment and overlap on the opaque rects.
3. `AiEnemyView.ts:109-113` passes `ox0 = homeX[0] * scale` and `ox1 = homeX[1] * scale`.

**Dragon (revision 16 ruling, measured).**
- With its attack frames in `homeX`, dragon spans [4, 118], 115 px (home only: [18, 110], 93 px).
- The play-test crowd's column widths become 104 / 115 / 89 / 105 / 84. That is 2 x 497 + 4 x 16 = 1058 <= 1260, so
  the crowd still lays out at full scale. 9 x dragon also fits: 5 x 230 + 64 = 1214.
- **Choice:** include the ranged attack frames in `homeX`. The in-place breath can then never overlap a neighbour's
  home art, and no exception has to be accepted.

**Acceptance.**
- [ ] `tests/scenes/battle/EnemyLayoutAi.test.ts`, RED first, with `homeX` read from the real atlas:
  - The play-test crowd `ogre,troll,dragon,crazy_horse,gigas_worm,ogre_chief,shark,anaconda,minotaur`: scaleFactor 1
    for all 9; every opaque rect inside `ENEMY_AREA`; no two opaque rects overlap. The dragon's rect includes its
    attack extent.
  - **The set S is computed from the atlas:** sheets whose enemy has `size: large` and whose home width is <= 118, at
    any cell width. The test asserts `S.length === 27` (today's count; it changes only with an atlas change, which
    then updates the constant) and that 9 copies of each sheet in S get f = 1. The widest sheet in S is 117
    (dragon_zombie): 5 x 234 + 64 = 1234.
  - 9 x fire_lizard (207) and 9 x white_crocodile (169) still get f = 0.5.
  - **Golden file.** `tests/scenes/battle/__golden__/layout_f1.json` is written once from 95b31e2's function for every
    `anim_*` scenario formation and the 26 sandbox formations that fit at f = 1. It stores the **inputs**
    (`size, w, h, ox0, ox1` per box) beside the outputs, so a later atlas change cannot move it. The new function
    reproduces every output exactly.
- [ ] `enemyTravel.test.ts:104-114` is renamed "nine trolls at scale factor 1 land on every hero row" and uses the
  extended stub. A new case "nine white_crocodiles at 0.5" keeps the 0.5 path covered. `meleeContact.test.ts` and
  `battleStage.test.ts` pass unchanged.
- [ ] Browser: `/?mute=1&sandbox=l30_lich&enemies=ogre,troll,dragon,crazy_horse,gigas_worm,ogre_chief,shark,anaconda,minotaur`.
  - Every enemy reports `scaleFactor === 1` through `__game`.
  - The screenshot shows no overlapping idle art.
  - The dragon's breath, in `&enemyAnim=loop`, does not overlap a neighbour's idle art.
  - 3 loop cycles produce no console errors.

### Defect 3 (P1, art): lich hurt keyframe changes identity

**Root cause (verified).**
- The defect is in the approved pixels: `approved/lich/boss_hurt.png` puts the skull on the right shoulder, a spiked
  helm at top centre, and drops the ice crown.
- The prompt asks for it: `monsters.yaml:175-178` says "one arm thrown up across his face".
- `hurt_in2` and `hurt` come from that key (`lich.yaml:49`, `:196`).
- The clipping part of this defect is defect 1.

**Fix: regenerate `lich/boss_hurt`** (D-F2, decided; 0 of 3 pass-R attempts used, per the main-checkout ledger).
- (a) Generator, `monsters.yaml`: edit **only** the lich `hurt:` text (`:175-178`) and add `sheet_seeds.boss_hurt`
  with a new seed (1235). New hurt wording: "staggered back by a heavy blow, torso bent away from the heroes, the
  skull head with its ice crown stays upright on the neck and in full view, one head only, the free arm thrown out
  to the side (never across the face), knees buckling, the glaive in the same hand dipping toward the ground, cracks
  and small ice shards bursting from the chest armour".
- (b) Before approval, `python3 -I assets-src/gen/selftest.py` (main checkout) reports exactly one bad entry in
  `_approved_keys`: `lich boss_hurt`. The other four lich keys must not be listed. After the approve commit, it passes.
- (c) Commands (main checkout, branch `roster`, one checkpoint each):
  ```bash
  python3 -I assets-src/gen/generate.py lich --backend gemini --sheets boss_hurt --dry-run
  python3 -I assets-src/gen/generate.py lich --backend gemini --sheets boss_hurt --paid --retry
  python3 -I assets-src/gen/approve.py lich boss_hurt --note "pass R fix: defect 3 (one skull, crown kept)"
  ```
  Review against the guide 1.4 checklist plus "one skull, crown present". Add a `ROSTER_LOG.md` row in a "Fix pass"
  table and commit. At most 1 retry (seed 1236).
- (d) **Cell check.** Boss poses are padded to a common cell (`pad_keyframes`, `monster_anim.py:64`). After the
  approval, the lich cell must stay 200x200 with the same `bottom_row`, and the atlas bytes of `idle`, `attack`,
  `cast`, `attack_raise` and every frame sourced only from them must be unchanged (frame-rect diff). If the new hurt
  widens the cell, all frames move: stop, and escalate a full re-rig (11.4.3 step 4) to the orchestrator.
- Boss rig agent: re-mark `keyframes.hurt` and the hurt masks and z (`lich.yaml:49-`, `:133`, `:142-162`), re-derive
  the `hurt_in2` paint (`:243`), then `check`, `review`, image-only review, `lock`. Iteration budget: 3.

**Acceptance.**
- [ ] Main-checkout ledger: at most 2 new `lich/boss_hurt` attempts in `pass R fix`.
- [ ] The cell check (d) holds.
- [ ] A fresh reviewer, shown the new `boss_hurt.png` beside `boss_idle.png` plus the `_hurt` strip and GIF, answers
  yes to both: one skull head with the ice crown in hurt_in1, hurt_in2 and hurt; same armour, cape and glaive.
- [ ] `check lich`: OK. lich_2 shares the sheet.
- [ ] The bestiary hurt steps of lich and lich_2 (`/?mute=1&bestiary=lich&battleStep=1`) are judged by the reviewer.
- [ ] If both attempts fail review: stop, keep the old hurt, escalate. The defect stays an open P1; there is no 3rd
  attempt without the orchestrator.

### Defect 4 (P1, art): crocodile hurt tail torn, forked, with holes

**Root cause (verified, revision 3).**
- The approved hurt cell (`approved/crocodile/monster_large.png`, the third 144 px cell) draws the tail tip as a main
  curl plus a separate shard (zoom: `/tmp/rfp/croc_hurt_tail.png`).
- Every hurt frame is a single piece, so the pieces count cannot see the defect. The defect lives in the fill
  components, measured on the approved hurt with the box x 0-40, y 40-90:

  | Fill component | Size | Box | Role |
  |---|---|---|---|
  | main tail | 467 px | x 9-34, y 51-87 | |
  | shard | 121 px | x 16-36, y 42-58 | cut off by a 1 px ink seam; 6 seam pixels touch both |
  | ring | 21 px | x 32-36, y 61-69 | orphan |
  | (unclassified) | 79 px | x 3-13, y 78-89 | |
  | (unclassified) | 35 px | x 28-39, y 83-89 | |

  F3c classifies the last two: tail, or the leg and rump at the box edge.
- Enclosed holes: hurt has 19 + 13 px; hurt_in2 has only 1 px.
- The tail is a `chain` kept out of every `moves` set (`crocodile.yaml:7`, `:101`), so `hurt_in2` (`:146`) carries
  the key's pixels unchanged. In-between `paint` cannot reach a keyframe (`monster_anim.py:248-251`).

**Fix (0 images planned; beasts rig agent, after FW-P).** Ruling: re-attach the shard by filling the bridge.
1. Measure first, with `fixmeasure.py fills crocodile hurt --box 0 40 40 90`.
2. Recolour the ink seam pixels between the shard and the main curl to the adjacent tail fill colour, so the shard
   joins the curl. The fill colour is the 4-neighbour mode of the fill pixels. Today that is 6 seam pixels, plus the
   seam along their run.
3. Recolour the seam that isolates the 21 px ring the same way.
4. Close the 19 and 13 px enclosed holes with the surrounding tail ramp colours (4-neighbour mode).
5. Patch size rule: the planned patch is about 40-70 px, which is <= 160 (the FW-P cap). Only if the measured patch
   exceeds 160 does the approved per-sprite cap of **<= 220 for `crocodile/hurt`** apply. Record the measured size in
   the hand-off.
6. Re-derive the `hurt_in2` paint (`crocodile.yaml:167`).
7. Fallback, only with the orchestrator's go after 3 iterations: regenerate `crocodile/monster_large`. It would be the
   sheet's last attempt (2 of 3 used) and needs a full re-rig.

**Acceptance.**
- [ ] `fixmeasure.py fills crocodile hurt hurt_in1 hurt_in2 --box 0 40 40 90 --min 10`, RED today (hurt: 467 + 121 +
  21 + any tail parts that F3c's classification adds). After the fix, every **tail** fill component of size >= 10 in
  the box has merged into one, in each of the three frames. The leg and rump components named in F3c's
  classification are excluded by an explicit `--exclude` box list recorded in the rig comment.
- [ ] `fixmeasure.py pieces crocodile hurt hurt_in2 --holes 2`: no enclosed transparent hole >= 2 px in the box.
- [ ] The keyframe patch on `hurt` is <= 160 px (or <= 220 under the ruling) and uses only colours from the
  crocodile's approved palette (FW-P enforces both).
- [ ] The reviewer answers yes to both: the tail is one piece with a single tip in hurt_in1, hurt_in2 and hurt; it is
  the same creature.
- [ ] `check crocodile`: OK, and the lock includes `kf:hurt`.

### Defect 5 (P1, rig/art): hollow seraph loses 3 wings in the raise; flat cyan block behind the helm

**Root cause (verified).**
- The defect is in the approved pixels: `approved/hollow_seraph/boss_attack_raise.png` is a turned three-quarter
  pose with the left three wings only, plus a flat pale-cyan panel behind the helm.
- `atk_raise_in`, `atk_raise_b`, `atk_swing` and `atk_swing2` derive from it (`hollow_seraph.yaml:62`, `:164-169`);
  the raise body mask is the whole cell (`:89`).
- The heavy attack's 18-frame telegraph shows this pose (`enemyAttackTables.ts:58-61`).
- It cannot be regenerated: 3 of 3 pass-R attempts are used, so the guard refuses.

**Fix (0 images): FW-R `raise: false` (D-F1, decided).**
- **What FW-R does.**
  - `MA.load_entries` (`monster_anim.py:55-56`) leaves `attack_raise` out of the sprite's pose list. The key is gone
    before `generate`; otherwise `monster_anim.py:182-184` raises the "no keyframes.attack_raise joints" error.
  - The sheet then has `hasRaise: false` and no raise frames, and the heavy attack coils in `atk_wind1`/`atk_wind2`
    (`enemyAttackTables.ts:57-61`).
  - The approved PNG stays on disk, untouched.
- **Glint regression (revision 9).** That no-raise heavy path has never run, because all 6 heavy enemies have
  `hasRaise` today. Without `tip`, `glintTip` returns undefined (`glintPoint.ts:96`), and ActionFx then puts the
  glint on the sprite box: the old forearm bug. So for `raise: false`, FW-R also writes `tip` from the topmost opaque
  pixel of the `atk_wind2` frame. That frame is the held telegraph pose without a raise (`enemyAttackTables.ts:59`).
- **Seraph rig agent:** set `raise: false`; remove the `attack_raise` joints, masks (`:89`, `:107`, `:113`) and the
  raise-sequence frames (`:164-169`); re-lock. The lock loses `attack_raise` (if listed), `atk_raise_in`,
  `atk_raise_b`, `atk_swing` and `atk_swing2`.
- If the cyan block shows in any frame that still plays: FW-P recolour (not null; see revision 1) and ink.

**Acceptance.**
- [ ] The atlas sheet `hollow_seraph` has `hasRaise: false`, none of `attack_raise atk_raise_in atk_raise_b atk_swing
  atk_swing2`, and a `tip` that lies on an opaque pixel of `atk_wind2`. `assetCoverage.test.ts:209-218` passes
  unchanged.
- [ ] `tests/scenes/battle/heavyGlint.test.ts`.
  - `:53` ("sheets without a raise keep no tip") becomes: sheets without a raise keep no tip **unless their rig has
    `raise: false`**, in which case the tip is on `atk_wind2`'s opaque art.
  - New case: the seraph's heavy `hold` cue places the glint on an opaque pixel of the frame shown, at screen
    y >= 124.
- [ ] Unit: the seraph's heavy attack (`travelAttackAt`, `hasRaise: false`) plays only `atk_wind1 atk_wind2 atk_mid
  attack atk_follow atk_recover idle`.
- [ ] The reviewer, on the `_attack` strip and GIF, answers yes to all three: six wings in every frame; no flat block
  behind the helm; the telegraph reads as a wind-up.
- [ ] `check hollow_seraph`: OK. `selftest_efix` (the FW-7 halo test) passes.

### Defect 6 (P1, rig): the ice gigas axe pops across between hurt_in1 and hurt_in2

**Root cause (verified).**
- The approved idle holds the axe on the right shoulder; the approved hurt holds it raised over the left.
- `fixmeasure.py partc ice_gigas axe idle hurt_in1 hurt_in2 hurt`: centroids (85.8, 34.0) → (82.7, 31.0) →
  (21.9, 33.7) → (25.9, 33.7). Steps are 4.3, **60.9**, 4.0; the idle-to-hurt traverse is **59.9 px**.
- `ice_gigas.yaml:105-110`: `hurt_in1` and `hurt_in2` are `moves: []` translations of 3-4 px.
- The bone turns about 145°. Under the 30° prop cap a full bridge is impossible, so the swing must be split and
  partly hidden.

**Fix (bipeds rig agent; 0 images planned).**
- `hurt_in1`: lift the axe arm (`sh_n`/`el_n`/`hand_n`/`tip`) up and toward the head by translation, and turn the axe
  bone <= 30° toward vertical.
- `hurt_in2`: the mirror of it from the hurt side.
- If the face would be covered, draw the axe behind the head in those two frames (`z`).
- Re-derive the hurt paint.
- Iteration budget: 3. Fallback (orchestrator): regenerate `ice_gigas/monster_large` (attempt 2 of 3) with "hurt: the
  axe stays on the right shoulder", which means a full re-rig; or record a nit.

**Acceptance.**
- [ ] The largest consecutive step in `fixmeasure.py partc ice_gigas axe idle hurt_in1 hurt_in2 hurt` is <= 32 px
  (today 60.9). Each in-between's axe centroid x lies strictly between the two keys' x values.
- [ ] `check ice_gigas`: OK (rotation cap, continuity, F7 prop attached).
- [ ] The reviewer answers yes to both: the axe swings up and over with no jump; the face is not smeared.

### Defect 7 (P1, art/rig): Garland's cast hip hole; a blade-smear sliver in atk_swing2

**Root cause (verified, revisions 1 and 2).**
- **The hip "hole" is a painted lavender panel, not transparency.** In `approved/garland/boss_cast.png`, colour
  (189, 181, 198) forms a 107 px fill component at x 77-85, y 85-104 with **0 transparent neighbours**. With 13 more
  pixels of that colour, the box x 55-90, y 80-115 holds 120 px of it.
- The colour occurs **677 times** across the cast key (the sword's highlights among them). No selector may use the
  colour alone outside the box.
- `cast_rise` already has an 11 px enclosed transparent hole at (63, 106) inside the box.
- `cast_rise` and `cast_release` derive from the cast key (`garland.yaml:166-167`).
- Setting the panel to transparent would raise cast's enclosed transparent area from 11 to 118 px. That fails the
  hole gate, so the panel is **recoloured**.
- **The sliver is the rig's smear.** `garland.yaml:276-286` paints a smear crescent behind the blade tip in
  `atk_swing2` (rationale at `:182-184`). The frame is already one 4-connected piece, so a pieces check passes today.
  The real defect: the smear fill (colours (181, 181, 173) and (148, 156, 140)) is a **separate 305 px fill
  component** (x 184-196, y 138-184) that touches the blade only through outline ink. At 1x it reads as a loose
  sliver.

**Fix (0 images planned; bosses rig agent, after FW-P).**
- **Cast key.** FW-P recolours every (189, 181, 198) pixel **inside the box x 55-90, y 80-115** (120 px) to its
  4-neighbour mode among the neighbouring cape and armour ramp colours. The committed selector helper converts it to
  an xy list. Fill the existing 11 px hole at (63, 106) in `cast_rise` with in-between paint in the flanking colours.
  Re-derive the other `cast_rise` patches (`:242-247`).
- **Smear.** Redraw the crescent so its fill is 4-connected with the blade's fill component, with no outline between
  them along at least 3 px of the blade edge, while keeping swing→swing2 IoU >= the checked bound (`:184`: 0.414). If
  continuity fails, shorten the smear to start at the blade tip.
- Fallback (orchestrator): regenerate `garland/boss_cast` (0 of 3 used).

**Acceptance.**
- [ ] `fixmeasure.py colours garland cast cast_rise cast_release --box 55 80 90 115 --rgb 189,181,198`: 0 in every
  frame (RED today: 120 in cast).
- [ ] `fixmeasure.py pieces garland cast cast_rise cast_release --box 55 80 90 115 --holes 4`: no enclosed
  transparent hole >= 4 px (RED today: cast_rise 11 px at (63, 106)).
- [ ] `fixmeasure.py fills garland atk_swing2 --join 181,181,173 148,156,140 --to-part sword`: every smear fill pixel
  lies in the same fill component as the blade (RED today: a separate 305 px component).
- [ ] The reviewer answers yes to both: no pale panel at the hip in any cast frame; no loose blade piece in the heavy
  swing.
- [ ] `check garland`: OK. `tests/balance/garland.test.ts`, `glintVisible.test.ts` and `heavyGlint.test.ts` pass.

---

## 2. P2 groups (8-13)

| # | Item | Root cause (verified) | Fix / disposition | Owner | Binary check |
|---|---|---|---|---|---|
| 8a | minotaur 88 px tall | approved art. The band is 96-120 with -10 % = 86.4, so 88 passes; 3 of 3 attempts used | **accepted nit** (D-F4) | - | in the nit table (section 10) |
| 8b | dragon 54 px tall | approved act-1 sprite: a long, low ranged quadruped | **accepted nit** (D-F4) | - | section 10 |
| 8c | dragon attack 1-3 px from the cell edge (also ankheg, crawler, gigas_worm, lesser_tiger) | approved headroom. Check 9 (border pixel) passes | **accepted nit**: the cell edge is invisible in battle; the bestiary panel is fixed in 12d | - | `check --all` OK; the 12d test |
| 8d | dragon's in-place breath overlaps neighbours | `homeX` was home-only | fixed by the defect 2 choice (ranged attack frames in `homeX`) | TS/data + FW-A | the defect 2 dragon assertion |
| 9a | gigas_worm vs lava_worm silhouette IoU 0.81 | above the 0.75 watch line, below the 0.85 flag | a fresh R1 reviewer compares them at 1x side by side and on their backgrounds. "Distinct" → accepted (D-F4). "Reads as a recolour" → escalate (an image would be outside this plan's cap) | reviewer | verdict recorded |
| 9b | gr_wolf very dark on the shore background | approved palette | **accepted nit** (D-F4) | - | section 10 |
| 10a | vampire idle face unreadable | approved idle (act-1, 0 pass-R attempts) | FW-P on `idle`: 2 eye pixels in the sprite's own red or gold, plus <= 6 px of face light; in-betweens follow | faces rig agent | `fixmeasure.py colours` lists the <= 8 painted px; the reviewer says the eyes read at 1x (yes); `check vampire` OK |
| 10b | cobra head reads as a hood blob | approved keys; the hood is the design | FW-P: a 1-2 px eye per keyframe in the sprite's palette | faces rig agent | the reviewer says the head and eye read (yes); `check cobra` OK |
| 11a | drowned_sovereign cast tentacle tips saturated royal blue | approved `boss_cast` colours (revision 15). No other drowned key has them | FW-P recolour on `cast`, by an exact colour map (see the paragraph below the table) | bosses rig agent | `fixmeasure.py colours drowned_sovereign cast cast_gather cast_rise cast_release --rgb 33,33,165 41,41,115 41,49,107` = 0 in every frame; `check` OK; the reviewer says the tips read as the same sea-teal flesh (yes) |
| 11b | robe hems curl like tentacles | **to diagnose first**: are the curls in the approved idle, or do they come from the rig (the skirt is rigid on the hem points, `drowned_sovereign.yaml:120`)? `fixmeasure.py diff drowned_sovereign idle idle_b atk_wind1 --part skirt` shows whether the skirt pixels change | from the rig: fix the skirt mask or pins. In the approved idle: the R8 reviewer decides; "disguise intact" → accepted (D-F4) | bosses rig agent | R8 verdict: robe, not tentacles, in idle frames (yes) |
| 12a | ochu stray light/pink tendril-tip pixels and a light outline segment (revision 4) | all 13 frames are one piece and every generated frame's edge is outline ink, so pieces checks find nothing. Measured in the approved **attack** key: near-white **(231, 214, 222)** at the k2 tip, 10 px at (122,77) (123,77) (122,78) (123,78) (124,80) (124,89) (124,90) (124,91) (122,93) (123,93); a light **(173, 165, 123)** vertical strip at x 121, y 37-42 (6 px) on the k1 vine's outer edge. `atk_mid` and `atk_follow` inherit them (attack-sourced, `ochu.yaml:33-34`). In the idle, (231, 214, 222) at (69, 64-65) is a tooth highlight and stays | FW-P on `attack`: recolour those 16 px to their 4-neighbour mode among the vine ramp colours | beasts rig agent | `fixmeasure.py colours ochu attack atk_mid atk_follow --rgb 231,214,222 --box 120 75 126 95` = 0 and `--rgb 173,165,123 --box 120 36 122 43` = 0; the reviewer says there are no light specks at the tendril tips or along the vine edge (yes); `check` OK |
| 12b | fire_elemental rose patch at the elbow (atk_mid) | the rig paints it: `fire_elemental.yaml:88` uses (206, 16, 74) on (41-47, 61-62) | repaint those pixels with the flanking flame ramp colours (156, 33, 33) and (181, 41, 24) by 4-neighbour mode | floating rig agent | `fixmeasure.py colours fire_elemental atk_mid --rgb 206,16,74 --box 40 60 50 63` = 0; the reviewer says yes |
| 12c | death_eye pupil fragments in daze (revision 5) | `daze` is not a whole-sprite shift: it is idle toward hurt at t = 0.15 (`monster_recipes.py:51-53`) with per-part translation, then `dy` 2 / 3 (`death_eye.yaml:28-29`). The pupil and iris parts drift apart from the ball and leave fragments. (Daze vs idle shifted 2 px differs in 3611 px, so a plain diff cannot diagnose it.) | re-diagnose with part labels (`fixmeasure.py partc death_eye <pupil part> idle daze daze_b` against the body part); fix with daze/daze_b tweaks that move the pupil with the ball, or with paint | floating rig agent | `fixmeasure.py fills death_eye idle daze daze_b --rgb <pupil colours>`: the pupil fill is one component in daze and daze_b, as in idle; the reviewer says yes |
| 12d | death_eye art touches the bestiary panel border in a lunge; 18 cells cross it (revision 17) | `BestiaryPreview.ts:143` fixes the phantom's x at `PREVIEW_INNER.right - 48 - 24 - 0.25 x lungePx`, while the travel is computed from the **idle** `opaqueRight` (`AiEnemyView.ts:92`). death_eye's attack reaches 179 against its idle edge of 146 | FW-A `lungeRight` (inclusive); the phantom moves left by `max(0, lungeRight - opaqueRight) x scale`. With both inclusive this equals the momus form `lungeRight_excl - (opaqueRight + 1)`. earth_elemental, dark_wizard and bloodbones have negative differences, so they don't move | TS/data owner | new `tests/scenes/bestiary/bestiaryReach.test.ts`: for every sheet, over a full bestiary attack loop, the art's right edge (per-frame opaque, from the PNG) is <= `PREVIEW_INNER.right - 8`. Must pass unchanged: `bestiaryAnim.test.ts`, `bestiaryCeilings.test.ts`, `BestiaryScene.test.ts` (stub extended per defect 1), `bestiaryModel`, `bestiaryHabitats`, `bestiaryProduction` |
| 12e | evil_eye cone tail only in the attack | approved attack key (`evil_eye.yaml:4`, "change only at keyframe boundaries") | **accepted nit** (D-F4; guide 3.4 criterion 4) | - | section 10 |
| 12f | ogre / troll club or arm pop at atk_recover → idle | `ogre.yaml:95-97` and `troll.yaml:104-106` push the club arm 26 px forward in recover, then idle snaps back. Recover-to-idle steps: ogre club 18.1, troll `farm_n` 17.3 (follow→recover is the keyframe switch) | lower the recover tweaks while follow→recover continuity still passes | bipeds rig agent | `fixmeasure.py partc ogre club attack atk_follow atk_recover idle`: recover→idle <= 10; troll `farm_n` the same; `check` OK |
| 12g | ashen_queen tail curls separately in hurt (revision 14) | `ashen_queen.yaml:190-196`: hurt_in2 keeps the tail "in its hurt lash". `:193-194` records that moving the tail toward idle "closed a 2000 px loop", so a plain "ride the body" can fail | the tail rides the hip by translation in hurt_in1 and hurt_in2 (`moves` excludes it, tweaks equal to the hip's), keeping the loop open; 3 iterations, then an **accepted nit** (pre-agreed fallback) | bosses rig agent | the tail-centroid step hurt_in1→hurt_in2 (`fixmeasure.py partc ashen_queen tail hurt_in1 hurt_in2`) is within 3 px of the hip's step over the same frames; `check` OK (no new hole); the reviewer says yes |
| 13 | sabertooth and fire_lizard look flat | approved style | **accepted nit** (D-F4) | - | section 10 |

**11a colour map (revision 15).** Exact counts in `boss_cast`, 297 px across 16 tips:

| From | Pixels | To |
|---|---|---|
| (33, 33, 165) | 165 | (41, 99, 99), the tentacle highlight teal |
| (41, 41, 115) | 100 | (24, 66, 74) |
| (41, 49, 107) | 32 | (24, 66, 74) |

**This is over the 160 px FW-P cap**: (33, 33, 165) alone is 165 px. It needs a ruling (see "Not applied" in
section 12). Proposed: a per-sprite cap of <= 300 for `drowned_sovereign/cast` (it is a pure colour remap: no shape
change). Fallback: move 11a to the accepted-nit list.

---

## 3. Framework items (one owner, serial, RED-first in a selftest, every existing lock unchanged)

**One insertion point (revision 10).**
- Keyframes reach the atlas through `sprite_frames` → `{**kfs, ...}` (`monster_atlas.py:48`, `:91`, `:120`) and
  reach the checks through `monster_review.py:102`.
- FW-R and FW-P therefore both act inside `MA.load_entries`. FW-R drops `attack_raise` from the pose list at
  `:55-56`. FW-P paints the keys **after** `pad_keyframes`, so its coordinates are in the padded cell.
- That way build, `check`, `review`, `lock` and `fixmeasure` all see the same keys.
- "Approved palette" means the union of the opaque RGB colours over the sprite's approved keys, as
  `monster_atlas.py:83` computes it.

| Id | Change | Files | RED-first selftest | Effort |
|---|---|---|---|---|
| FW-M | Commit the measurement tool `assets-src/gen/fixmeasure.py` (revision 11) | new `fixmeasure.py` (see the subcommand list below) | `selftest_fixmeasure.py` (wired into `selftest.py --anim`) reproduces the numbers this plan quotes, so the RED states are pinned: ice_gigas axe steps 4.3 / 60.9 / 4.0; garland cast 120 lavender px in the box and the 305 px smear component; crocodile hurt components 467 / 121 / 21; drowned cast 165 / 100 / 32 | 4 h |
| FW-A | Atlas anchors for every sheet, metadata only. `travelTop`: the min opaque row over `atk_wind1 atk_wind2 atk_mid attack atk_follow atk_recover atk_raise_in attack_raise atk_raise_b atk_swing atk_swing2 idle hurt_in1 hurt_in2 hurt`. `lungeRight`: the max opaque column (inclusive) over the 11 attack/raise frames of that list. `homeX: [min, max]` (inclusive) over `idle idle_b hurt_in1 hurt_in2 hurt daze daze_b`, plus the 6 attack frames for `attack: ranged` sheets. Frames resolve through `MA.resolve` | `monster_atlas.py` (`anchors`) | `selftest_pages.py` with **explicit constants** (from the atlas at 95b31e2): garland travelTop 2 (hurt_in1), lich 9 (idle), death_eye 42 (idle), chaos 12, warmech 5; ogre homeX [10, 113], lungeRight 125; troll homeX [24, 122]; dragon homeX [4, 118] (ranged); death_eye lungeRight 179; earth_elemental lungeRight 109 < opaqueRight 110. Every frame rect and byte unchanged | 2 h |
| FW-P | Keyframe paint (D-F6, approved). A rig `paint` entry whose `frame` is a keyframe (`idle attack hurt cast attack_raise`) is applied in `load_entries` after `pad_keyframes`. Entries are xy lists; `fixmeasure.py select` turns colour+box and component selectors into xy for the rig. Limits: 160 px per keyframe by default; a rig may set `kf_paint_cap: {hurt: 220}` only where the orchestrator approved it (crocodile/hurt <= 220; drowned_sovereign/cast <= 300, colour remap only). Colours must come from the approved palette, or null. Locks gain `kf:<name>` hashes only for painted keys. The palette, pieces and outline checks run on painted keys | `monster_anim.py` (`load_entries`), `monster_check.py`, the lock writer | `selftest_efix.py`: a fake key patch changes that key's atlas cell and every frame sourced from it; a 161 px patch without a cap and an off-palette colour are refused; a cap not in the allowlist (crocodile/hurt 220) is refused; a rig without keyframe paint is byte-identical; all 77 lock files unchanged | 4 h |
| FW-R | Rig key `raise: false` (D-F1). `load_entries` skips the approved `attack_raise` (`:55-56`), so `has_raise` (`:182-184`) is false and there are no raise frames. The atlas writes `tip` from `atk_wind2`'s topmost opaque pixel (the centre of its top row, like `tip()` at `monster_atlas.py:60-66`). The approved file stays | `monster_anim.py`, `monster_atlas.py` | `selftest_pages.py`: a fake rig with `raise: false` gives `hasRaise: false`, none of the 5 raise frames, and a `tip` on an opaque `atk_wind2` pixel; every other sheet is unchanged | 1.5 h |
| FW-F | Open `pass R fix` (6.4), following the F4 sequence | `budget.json` (main-checkout ledger) | `selftest_roster.py`: an unapproved id is refused, a 4th attempt per sheet is refused | 0.5 h |

`fixmeasure.py` subcommands:

| Subcommand | Output |
|---|---|
| `travel <sheet>` | the FW-A anchors |
| `partc <sprite> <part> <frames...>` | part-label centroids and steps |
| `pieces` | pieces, `--small N`, `--holes N` enclosed transparent holes, `--box` |
| `fills` | fill components (ink excluded), `--box`, `--min`, `--exclude`, `--rgb`, `--join <rgb...> --to-part <p>` |
| `colours` | the count of `--rgb` colours in a `--box` |
| `diff` | per-part pixel changes between frames |
| `select` | colour/box/component selectors → xy lists for `paint` |

Generated frames come from `MA.generate`, keys from `MA.load_entries`, and names resolve through `MA.resolve`.

Documentation: guide 2.3 and 2.5 (FW-P, FW-R, `fixmeasure.py`) and AGENTS.md "Monster animation" get one line each.

---

## 4. Tranches, ownership and parallelism

- All worktrees branch off `roster-int`.
- Only the integrator merges, builds the atlas pages and commits them.
- Rig agents restore `assets/sprites/monsters-ai*` before hand-off.
- Iteration budget: 3 per sprite per fix round; then stop and report.

| Tranche | Scope | Owner / worktree | Depends on | Parallel with | Effort |
|---|---|---|---|---|---|
| F1 | FW-M, FW-A, FW-P, FW-R, serial | framework owner, `fix-fw` | - | F2 | 1.5 d |
| F2 | R-1 (defect 1), R-2 (defect 2), R-3 (12d): code with fallbacks; tests RED → GREEN against a locally rebuilt FW-A atlas; test stubs extended | TS/data owner, `fix-ts` | FW-A merged before the final GREEN | F1 | 1 d |
| F3a | **Bosses:** garland (7), hollow_seraph (5), drowned_sovereign (11a, 11b), ashen_queen (12g) | rig agent "bosses", `fix-rig-boss` | F1 merged | F3b-d | 1.5 d |
| F3b | **Bipeds:** ice_gigas (6), ogre, troll (12f) | rig agent "bipeds", `fix-rig-biped` | F1 | F3a, c, d | 1 d |
| F3c | **Beasts / floating / rooted:** crocodile (4; measure the patch first), ochu (12a), fire_elemental (12b), death_eye (12c) | rig agent "beasts", `fix-rig-beast` | F1 | F3a, b, d | 1 d |
| F3d | **Faces:** vampire (10a), cobra (10b); the 9a R1 reviewer verdict | rig agent "faces", `fix-rig-face`; fresh reviewer | F1 | F3a-c | 0.5 d |
| F4 | **Images, last**, in the order below (revision 13) | orchestrator, framework owner, generator (main checkout, `roster`), integrator, rig agent "bosses" | the build run stopped; F1 | F3 (other sprites) | 0.5 d + 0.5 d rig |
| F5 | Integrate: merge F1-F4, rebuild the atlas, full validation (section 6); docs (guide, AGENTS.md, the `ROSTER_LOG.md` fix rows) | integrator (this worktree) | F1-F4 | - | 0.5 d |
| F6 | Re-test (section 7) | fresh adversarial tester | F5 | - | 0.5 d |
| T-K | Keyframe-only sheets (section 8; D-F5: a separate, later tranche) | rig agents | F6 | - | 2-3 d |

**F4 order (revision 13; the main-checkout ledger is authoritative, and the build run is still active there).**
1. The orchestrator confirms that the main checkout's build run has stopped and that no attempt is uncommitted. At
   the time of rev 2 it had not stopped: 359 Gemini attempts, 259 in pass R.
2. N1 is counted from **`/Users/wlmmoor/personal/ff-game/assets-src/gen/cache/ledger.jsonl`**. The roster-int copy is
   stale (293 at rev 2).
3. FW-F is committed in `fix-fw` (`pass R build` gets `gemini_end: N1`, and `pass R fix` opens with
   `max_new = 300 - (N1 - N0)`, `max_per_sheet: 3`, `only_approved: true`). The integrator merges it into
   `roster-int`. The generator fast-forwards `roster` to `roster-int` between checkpoints only.
4. Per-sheet pass-R attempts are recounted for the section 5 sheets from the main ledger at that moment (failed and
   403 attempts count). Rev-2 counts: lich/boss_hurt 0, crocodile 2, garland/boss_cast 0, ice_gigas 1,
   hollow_seraph/boss_attack_raise 3. Any change updates the section 5 table before a request.
5. The generator regenerates `lich/boss_hurt` (defect 3 (a)-(c)) and commits on `roster`; the integrator merges
   `roster` into `roster-int`.
6. Only then does the bosses rig agent branch `fix-rig-lich` off `roster-int` and re-rig the lich hurt (defect 3 (d)
   and the rig step).

---

## 5. Image budget (`pass R fix`, 15 at most; this plan caps itself at 5)

| Sheet | Defect | pass-R attempts used (main ledger, rev 2) | Planned | Worst case | Condition |
|---|---|---|---|---|---|
| lich/boss_hurt | 3 | 0 | 1 | 2 | 1 retry, only after a failed review |
| crocodile/monster_large | 4 | 2 | 0 | 1 (its last) | FW-P fails 3 iterations + orchestrator go |
| garland/boss_cast | 7 | 0 | 0 | 1 | FW-P fails + orchestrator go |
| ice_gigas/monster_large | 6 | 1 | 0 | 1 | the rig can't reach <= 32 px + orchestrator go |
| hollow_seraph/boss_attack_raise | 5 | 3 | 0 | 0 | the guard refuses; FW-R only |
| **Total** | | | **1** | **5** | at least 10 of 15 stay unspent |

**Sprites whose frames change.** The frame-rect diff against HEAD must list exactly these: lich, garland, crocodile,
hollow_seraph (raise frames removed), ice_gigas, ogre, troll, drowned_sovereign, ashen_queen (or not, if 12g ends as
a nit), ochu, fire_elemental, death_eye, vampire, cobra. The act-1 sprites among them (lich, garland, vampire, ogre,
troll) go into the `CHANGED_ON_PURPOSE` set of the 12.2 check against `roster-r0`.

---

## 6. Verification commands (F5, integrator)

```bash
# measurement gates (committed tool; FW-M)
python3 -I assets-src/gen/fixmeasure.py partc ice_gigas axe idle hurt_in1 hurt_in2 hurt        # max step <= 32
python3 -I assets-src/gen/fixmeasure.py partc ogre club attack atk_follow atk_recover idle      # recover->idle <= 10
python3 -I assets-src/gen/fixmeasure.py partc troll farm_n attack atk_follow atk_recover idle   # recover->idle <= 10
python3 -I assets-src/gen/fixmeasure.py partc ashen_queen tail hurt_in1 hurt_in2                # vs the hip step, +-3
python3 -I assets-src/gen/fixmeasure.py fills crocodile hurt hurt_in1 hurt_in2 --box 0 40 40 90 --min 10
python3 -I assets-src/gen/fixmeasure.py colours garland cast cast_rise cast_release --box 55 80 90 115 --rgb 189,181,198
python3 -I assets-src/gen/fixmeasure.py pieces garland cast cast_rise cast_release --box 55 80 90 115 --holes 4
python3 -I assets-src/gen/fixmeasure.py fills garland atk_swing2 --join 181,181,173 148,156,140 --to-part sword
python3 -I assets-src/gen/fixmeasure.py colours ochu attack atk_mid atk_follow --rgb 231,214,222 --box 120 75 126 95
python3 -I assets-src/gen/fixmeasure.py colours drowned_sovereign cast cast_gather cast_rise cast_release --rgb 33,33,165 41,41,115 41,49,107
# pipeline
python3 -I assets-src/gen/selftest.py --anim            # worktree; the main checkout runs the full selftest
python3 -I assets-src/gen/monster_anim.py check --all   # only "OK" and "no rig" (astos black_widow crawler horned_devil hydra scorpion warmech)
python3 -I assets-src/build_assets.py monsters_ai battle_ai field_ai
git diff --exit-code assets-src/gen/approved assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
#   approved/: only lich/boss_hurt.{png,json}, which arrive in their own approval commit (merged from roster)
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai* > /tmp/a.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum -c /tmp/a.sha
# frame-rect diff against HEAD (guide 3.7 script): the changed sheets == the section 5 list exactly
# ledger (ROSTER_PLAN 12.1 script, run in the MAIN checkout): pass R <= 300, fix attempts on approved ids only,
#   max per sheet <= 3, fix count <= 5
# TypeScript
npx tsc --noEmit && npm run build && npx vitest run
npx vitest run tests/scenes/battle/lungeClearance.test.ts tests/scenes/battle/enemyTravel.test.ts \
  tests/scenes/battle/EnemyLayoutAi.test.ts tests/scenes/battle/heavyGlint.test.ts tests/scenes/bestiary/ \
  tests/data/assetCoverage.test.ts tests/balance/garland.test.ts
# browser (dev server: npx vite --host 127.0.0.1 --port <free>; every URL with &mute=1)
#   /?mute=1&sandbox=l30_lich&enemies=chaos&enemyAnim=step   (and hollow_seraph, warmech, drowned_sovereign, garland, lich, death_eye)
#   /?mute=1&sandbox=l30_lich&enemies=ogre,troll,dragon,crazy_horse,gigas_worm,ogre_chief,shark,anaconda,minotaur
#   /?mute=1&bestiary=<id>&battleStep=1   for every sprite in the section 5 list, plus death_eye's lunge
```

---

## 7. Re-test (F6)

A **fresh** adversarial tester gets the play-test rows, the URLs and the new evidence paths, and nothing else (no
rigs, no code, no hypotheses). It re-checks only:
- **Every P1 row (1-7)** with its repro URL, plus these probes:
  - A1: step every sequence;
  - A8/A9: a death mid-lunge for every boss, watching the top window;
  - A10: bosses.
- **Every P2 row marked "fix"** in section 2, and the accepted nits listed for confirmation only.
- **A regression sample (11.4.4):**
  - one sprite per body type: goblin, wolf, cockatrice, green_slime, cobra, ochu, black_widow, shark, ashen_queen;
  - every boss: garland, lich, lich_2, astos, warmech, death_eye, chaos, the 3 fiends and their rematches;
  - each in battle and in the bestiary.
- **Performance:** `anim_crowd` FPS median >= 110, and a 9-large crowd at scale 1.

The tester writes "Re-test (F6)" rows into `docs/ROSTER_PLAYTEST.md`. Done means no P0/P1 is open and every P2 is
fixed or on the decided nit list. A P1 still open after 2 fix rounds is escalated.

---

## 8. Keyframe-only sheets (separate tranche T-K; D-F5, decided)

astos, black_widow, crawler, horned_devil, hydra, scorpion and warmech were known before the play test
(`ROSTER_PLAYTEST.md:10`), and none is in the defect table. They are **out of scope for F1-F6**. Path, after F6, at
0 images:
1. **A translation-only rig for each,** the `death_eye.yaml` / `evil_eye.yaml` recipe: `moves: []`, with frame
   `dx`/`dy` placed where adjacent silhouettes overlap most. It gives `idle_b`, the winds, recover, the hurt
   in-betweens and, for astos and warmech, `daze`/`daze_b`.
   - It sidesteps the documented blockers: the hydra's head swapping sides, warmech's 40 px stride, and the
     scorpion's and black_widow's rear-up hurts (guide 2.2).
   - Note from revision 5: on these bodies `daze` is a partial lerp toward hurt, not a pure shift, so check it like
     12c.
2. **Acceptance per sheet:** `check` OK, a fresh reviewer gives SHIP, then `lock`. `check --all` then prints only
   OK lines (the final gate of 11.1).
3. **Images:** none planned. A regeneration is possible only on sheets with attempts left (black_widow 1 of 3 used;
   hydra, crawler and horned_devil 2 of 3; scorpion, warmech/boss_attack and astos/boss_attack 3 of 3), and needs the
   orchestrator's go plus room in `pass R fix`.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The rise clamp keeps a boss's feet above the hero's feet line | the strike looks lower | contact assertions (box centre in the hero's span, feet gap <= 100); reviewer at the contact frame |
| A hop climbs above the clamp line when the clamped rise is small | a 1-8 px clip | the frame-by-frame test with per-frame tops; the hop margin fallback |
| Opaque packing shifts a layout that fits today | bestiary and test pins move | pass 1 unchanged; a golden file with its stored inputs |
| FW-P paints approved keyframes | an act-1 look changes silently | the 160 px cap (approved exceptions only), palette-only, `kf:` lock hashes, the frame-rect diff limited to the section 5 list |
| FW-R opens the no-raise heavy path, which has never run | the glint lands on the sprite box | FW-R writes `tip` from `atk_wind2`; the heavyGlint case for the seraph |
| The lich hurt regeneration widens the padded cell | every lich frame moves | the defect 3 (d) cell check; escalate a full re-rig |
| The lich hurt regeneration fails twice | the P1 stays open | stop at 2 and escalate |
| The build run in the main checkout is still active | the fix images are blocked | F4 last, in its 6-step order; F1-F3 don't need it |
| A rig fix breaks continuity or a rotation cap (the ice_gigas 145° swing, the ashen_queen tail loop) | the iterations run out | 3 per sprite, then the fallback listed per defect |
| Act-1 sprites get re-locked (lich, garland, vampire, ogre, troll) | the act-1 baseline drifts | 12.2 `CHANGED_ON_PURPOSE` limited to these; the act-1 balance and garland tests in F5 |
| Files near 250 lines (`BattleArt.ts` 234, `AiEnemyView.ts` 234, `EnemyPoseController.ts` 248) | the file-size rule | anchors in `monsterAnchors.ts`; nothing in the pose controller; AiEnemyView gets at most +6 lines |

---

## 10. Decisions (orchestrator, decided 2026-11-15)

| # | Decision | Ruling |
|---|---|---|
| D-F1 | Hollow seraph raise | **Decided:** disable it with FW-R `raise: false`. The heavy attack coils in atk_wind2 and the `tip` comes from atk_wind2 |
| D-F2 | Lich hurt | **Decided:** regenerate `lich/boss_hurt` (1 image, at most 1 retry) |
| D-F3 | `enemyTravel.test.ts:125-146` | **Decided:** invert it to "never overlaps" for all 9 boss sheets, with per-frame opaque boxes |
| D-F4 | The accepted-nit list | **Decided, accepted as proposed:** 8a minotaur height; 8b dragon height; 8c cell-edge headroom (dragon, ankheg, crawler, gigas_worm, lesser_tiger); 9b gr_wolf on the shore; 12e evil_eye attack fin; 13 sabertooth and fire_lizard style; 9a and 11b if their reviewers clear them; 12g after 3 failed iterations. 0 images |
| D-F5 | Keyframe-only sheets | **Decided:** a separate later tranche T-K after F6 |
| D-F6 | FW-P keyframe paint | **Decided:** approved (PNG untouched, <= 160 px per key, palette-only, locked) |
| Rev 3 ruling | Crocodile shard | Re-attach the shard by filling the bridge. A per-sprite cap of <= 220 applies to `crocodile/hurt` only if the measured patch is > 160 |
| Rev 16 ruling | Dragon in-place overlap | Measured: with its attack frames in `homeX` the crowd stays at full scale (1058 <= 1260). **Chosen:** include the ranged attack frames; tested in defect 2 |
| Rev 15 ruling | drowned_sovereign/cast | `kf_paint_cap: {cast: 300}` approved for the 297 px colour remap (recolour only, no shape change; every patched pixel was opaque and stays opaque) |
| Rev 13 ruling | Ledger | The main-checkout ledger is authoritative; the build run is still active there |

---

## 11. TODOs

```markdown
## TODOs
- [x] F0: momus review (APPROVE WITH REVISIONS; 18 revisions applied, rev 2) (2026-11-15)
- [x] F0: orchestrator decisions D-F1..D-F6 recorded (2026-11-15)
- [x] F0: drowned_sovereign/cast FW-P cap ruled: <= 300 px, colour remap only (2026-11-15)
- [x] F1 FW-M: fixmeasure.py + selftest_fixmeasure (pins the RED numbers) (priority: high, effort: 4h)
- [x] F1 FW-A: travelTop / lungeRight / homeX (inclusive; ranged attack frames) + selftest_pages constants (high, 2h)
- [x] F1 FW-P: keyframe paint in load_entries after pad_keyframes; cap 160 + approved exceptions; palette; kf: locks; selftest_efix (high, 4h)
- [x] F1 FW-R: raise: false in load_entries; tip from atk_wind2; selftest_pages (high, 1.5h)
- [x] F2 R-1: travelTop clamp (+ hop margin if needed); lungeClearance.test.ts with per-frame PNG tops incl. death_eye; contact assertions; enemyTravel 125-146 inverted; stubs extended; browser check of 7 bosses (high, 5h)
- [x] F2 R-2: three-pass layout; tests (crowd, computed set S == 27, 0.5 cases, golden with inputs, dragon); enemyTravel 104-114; browser check (high, 4h)
- [x] F2 R-3: phantom shift max(0, lungeRight - opaqueRight) x scale; bestiaryReach.test.ts; bestiary tests unchanged (medium, 2h)
- [x] F2: src/rendering/monsterAnchors.ts (medium, 1h)
- [x] F3a garland: cast recolour (120 px in the box), cast_rise 11 px hole, smear joined to the blade fill; review, lock (high, 3 iter)
- [x] F3a hollow_seraph: raise: false, rig cleanup, heavyGlint :53 + new case; review, lock (high, 3 iter)
- [x] F3a drowned_sovereign: 11a colour map (after the cap ruling); 11b diagnosis + R8 (medium)
- [x] F3a ashen_queen: the tail rides the hip by translation; within 3 px; or a nit after 3 iterations (medium) (tail step 4.0 vs hip 2.6; the coil-base registration in the approved hurt/attack keys escalated, not a rig fix)
- [x] F3b ice_gigas: axe swing split, max step <= 32 px; review, lock (high, 3 iter) (after R287: full re-rig, max step 11.9)
- [x] F3b ogre, troll: recover->idle <= 10 px; review, lock (medium) (ogre 3.6, troll 9.0; ogre missing downswing an accepted nit)
- [x] F3c crocodile: measure the patch; bridge fill + ring + holes (<= 160, else <= 220); review, lock (high, 3 iter) (FW-P 158 px)
- [x] F3c ochu (16 px recolour in attack), fire_elemental (paint line 88), death_eye (pupil re-diagnosis) (medium) (ochu motion an accepted nit)
- [x] F3d vampire, cobra eye paint; 9a worm-pair R1 verdict (low)
- [x] F4.1-4.3: build run stopped (orchestrator); N1 from the main ledger; FW-F committed and merged (high, 0.5h) (N1 = 363)
- [x] F4.4-4.5: recount section-5 sheets; lich boss_hurt regen (<= 2), approve, log, commit; integrator merges roster (high, 1h) (R284 rejected, R285 approved)
- [x] F4.6: lich hurt re-rig after the cell check, review, lock (high, 3 iter)
- [x] F5: integrate, rebuild the atlas, section 6 validation, frame-rect diff == section 5 list, docs (high, 4h) (2026-11-15; ROSTER_LOG.md "Fix pass result")
- [ ] F6: fresh adversarial re-test + regression sample; rows in ROSTER_PLAYTEST.md (high, 4h)
- [ ] T-K (after F6): translation-only rigs for the 7 keyframe-only sheets (medium, 2-3d) (now 9: + black_knight, water_elemental)
```

---

## 12. Momus revisions (rev 2)

| # | Revision | How it was applied |
|---|---|---|
| 1 | Garland hip: recolour, not null | Defect 7: the root cause now says "painted panel, 107 px fill component at x 77-85, y 85-104, 0 transparent neighbours". The fix is a 4-neighbour-mode recolour of all 120 lavender px in the box; the cast_rise 11 px hole at (63, 106) is closed; a note says the colour occurs 677 times, so selectors are box-limited. Gates: `colours` = 0 and `pieces --holes 4` |
| 2 | Garland sliver: real cause and a RED check | Defect 7: the smear fill is a separate 305 px fill component touching the blade only through ink. New RED gate `fills --join 181,181,173 148,156,140 --to-part sword`. The fix joins the smear fill to the blade fill |
| 3 | Crocodile: fill-component gate; cap ruling | Defect 4: the pieces and holes claims are corrected (each frame is one piece; hurt has holes of 19 + 13 px, hurt_in2 has 1). The gate is "tail fill components >= 10 px in the box merge to one". Measured: the shard is 121 px behind a 1 px ink seam (6 bridge px), the ring 21 px. The bridge-fill plan is about 40-70 px; the 220 cap applies only if the measurement exceeds 160 (ruling). Two further components (79, 35 px at the box's bottom edge) are to be classified in F3c with an explicit exclude list |
| 4 | Ochu: enumerate strays by colour and coords | 12a: measured in the approved attack key: (231, 214, 222) × 10 px at the listed coords and (173, 165, 123) × 6 px at x 121, y 37-42; inherited by atk_mid and atk_follow; the idle tooth highlight is excluded. Gate: 0 px of each in its box, plus the reviewer |
| 5 | death_eye 12c re-diagnosis | 12c: daze is idle toward hurt at t 0.15 (`monster_recipes.py:51-53`) with per-part translation; the rig lines are `death_eye.yaml:28-29`; the unusable shift-diff is dropped. Part-label diagnosis; gate: the pupil fill is one component in daze and daze_b; the reviewer. Also noted in section 8 |
| 6 | FW-A references, conventions | The conventions paragraph (inclusive extents, fill components, `MA.resolve`). FW-A selftest constants re-measured with the full travel list: garland 2 (hurt_in1), lich 9 (idle), death_eye 42 (idle), chaos 12, warmech 5; ogre homeX [10, 113] (inclusive), lungeRight 125. `/tmp/rfp/meas.py` was fixed to the same lists and conventions; it is superseded by FW-M |
| 7 | lungeClearance measures per-frame tops; death_eye RED | Defect 1: per-frame `opaqueBounds` from the PNG, cached; death_eye added to the RED list (123 < 124); its browser check includes death_eye |
| 8 | Update MonsterFrames stubs; per-frame boxes in the rewritten test | Defect 1 acceptance: extend `enemyTravel.test.ts:42-52` and `BestiaryScene.test.ts` (the `grep 'opaqueRight:'` set); the 125-146 rewrite uses per-frame boxes; defect 2's troll case relies on the extended stub |
| 9 | FW-R glint regression | Defect 5 and FW-R: `tip` from atk_wind2's topmost opaque pixel; heavyGlint `:53` updated and a new seraph case (on art, y >= 124); the risk table's "already used" claim removed; the lock also loses attack_raise and atk_raise_in |
| 10 | One insertion point | Section 3 preamble: both FW-R (`load_entries :55-56`, before `generate` and `:182-184`) and FW-P (after `pad_keyframes`) act in `MA.load_entries`, so build, check, review, lock and measure see the same keys; "approved palette" = `monster_atlas.py:83` union; xy lists produced by `fixmeasure.py select` |
| 11 | Commit the measurement scripts | FW-M: `assets-src/gen/fixmeasure.py` with travel, partc, pieces, fills (ink excluded), colours, diff and select, plus `selftest_fixmeasure.py` pinning the RED numbers; every gate in sections 1, 2 and 6 now calls it |
| 12 | Lich regeneration details | Defect 3 (a)-(d): only `hurt:` (`:175-178`) and `sheet_seeds.boss_hurt`; the expected `_approved_keys` output (exactly `lich boss_hurt` before approval, all pass after); the padded-cell check with escalation; the exact commands. The root cause also notes the prompt's "arm thrown up across his face" |
| 13 | F4 sequencing | Section 4 "F4 order", 6 steps; the main-checkout ledger path named as authoritative (rev-2 counts: 359 Gemini, 259 pass R, build still active); recount before any request |
| 14 | ashen_queen tail loop | 12g: acknowledges `:193-194` (the 2000 px loop); gate: the tail-centroid step within 3 px of the hip step; fallback accepted nit after 3 iterations (also in D-F4) |
| 15 | drowned RGB values | 11a: (33, 33, 165) 165 px, (41, 41, 115) 100 px, (41, 49, 107) 32 px in boss_cast; replacements named. 165 > 160, so a cap ruling is requested (see below) |
| 16 | Defect 2 tests; dragon | The golden file stores inputs; set S computed from the atlas (size large, home width <= 118, any cell) with `S.length === 27` asserted; dragon measured and the ranged-attack `homeX` chosen (crowd 1058 <= 1260) and tested |
| 17 | 12d bestiary | 12d: the phantom x formula from `BestiaryPreview.ts:143`; shift by `max(0, lungeRight - opaqueRight) x scale` (inclusive both, equal to momus's form); negative cases named; the list of bestiary tests that must pass unchanged |
| 18 | ice_gigas traverse 59.9 | Defect 6: 59.9 px; the <= 32 bound kept |
| Concerns | hop margin; vacuous contact check; file sizes | Defect 1: a hop margin fallback; the contact assertion replaced (box centre in the hero's span, feet gap <= 100); R-1/R-2 kept out of `EnemyPoseController.ts`, AiEnemyView at most +6 lines (risk table) |

**Not applied as written / needs a ruling:**
- **Revision 15 (drowned_sovereign/cast cap).** Momus asked to confirm that the recolour is <= 160 px. It is not:
  297 px in all, 165 px for (33, 33, 165) alone. Proposed: a per-sprite FW-P cap of <= 300 for `drowned_sovereign/cast`
  (a pure colour remap). Fallback: 11a moves to the accepted nits.
- **Revision 3 (crocodile).** Momus quoted 467 + 121 + 21 and a 70 px orphan ring. My outline-excluded 4-connected
  count in x 0-40, y 40-90 gives 467 / 121 / 79 / 35 / 21 / 9: the ring is 21 px, and there are two extra components
  at the box's lower edge. The gate is therefore stated on the tail components, with an explicit exclude list to be
  set when F3c classifies those two. The bridge-fill estimate (about 40-70 px) is below 160, so the 220 cap is not
  expected to be needed. F3c's measurement decides.

# Roster fix plan, round 2 (pass R fix, plan 11.4), 2026-11-15 (rev 2: momus revisions applied)

Round 2 after `docs/ROSTER_FIX_PLAN.md` (rev 2, F1-F6 executed). Inputs: `docs/ROSTER_PLAYTEST.md` "Re-test (F6),
2026-11-15" (evidence `/tmp/vpt2/`), `docs/ROSTER_LOG.md` (Batch C/D results, "Fix pass result", "Swimmers",
"Deferred sprites"), the rig commit messages on `roster-int` (b6b1346), and the rig agents' drafts
`/tmp/rigb/black_knight.draft.yaml` and `/tmp/water_elemental_iter4.yaml`. Momus: APPROVE WITH REVISIONS; the 22
binding revisions are applied (section 14). The orchestrator's decisions are in section 12.

Rules carried over from plan 1 without change: `docs/ROSTER_PLAN.md` 6.4 (`pass R fix`: `only_approved`, at most 3
pass-R attempts per sheet), 9.2 (worktree ownership: only the integrator merges, builds the atlas pages and commits
them; rig agents restore `assets/sprites/monsters-ai*` before hand-off), 9.3 (**3 iterations per sprite per fix
round**; round 2 is a new round), the plan-1 measurement conventions (inclusive extents, fill components without the
outline ink (6, 4, 10), frames resolved through `MA.resolve`, every gate through the committed `fixmeasure.py`), FW-P
(keyframe paint after `pad_keyframes`: <= 160 px per key, approved palette or null, `kf:` lock hashes, a
`kf_paint_cap` only from `KF_PAINT_ALLOW`), FW-R (`raise: false`), and the review/lock process (`check`, `review`, a
fresh image-only reviewer, then `lock`).

Every number below was measured at b6b1346 in this worktree (approved PNGs, `fixmeasure.py`, or the throw-away
scripts in `/tmp/rfp2/`: `edges.py`, `allgaps.py`, `tk.py`, `swim.py`). Numbers marked "pre-measure" come from those
scripts; FW-M2 turns them into committed subcommands, and every gate re-takes and pins its RED number with FW-M2
before the fix starts.

**Image ledger at the time of writing** (main checkout `/Users/wlmmoor/personal/ff-game/assets-src/gen/cache/ledger.jsonl`,
authoritative): 367 Gemini attempts; pass R 267 of 300 (263 build + 4 fix); `pass R fix` opened at N1 = 363 with
`max_new` 37, so **33 fix images remain**. This round plans **0** images, worst case **0** (D-R1 = B with fallback D,
D-R7 = no).

---

## 0. Success criteria (defined before any fix)

```json
{
  "functional": [
    "The chimera shows exactly three heads (lion, goat, one dragon) in every frame that plays (D-R1 = B); if B fails 3 iterations, mitigation D is applied and the item is escalated to the user",
    "Every F6 P2 (section 2) and every new nit (section 3) is fixed with its own binary gate or is on the decided accepted-nit list (D-R6)",
    "Every T-K sheet (section 5) is rigged and locked, or partially rigged under FW-Q with one aliased sequence from the allowlist, or left keyframe-only (D-R4 fallback)",
    "astos and warmech get their own daze / daze_b frames (D-R5)",
    "red_piranha is re-cut offline from its existing raw with no clipped cell (FW-C); white_shark is re-cut if the measured lift fits (rev 14 ruling), else stays deferred with the measured lift",
    "Dark Fighter casts CUR3 (cure3) through an ai block with rate 0.5, and no enemy spell code duplicates a spells.yaml spell under another spelling"
  ],
  "observable": [
    "fixmeasure numbers inside their bounds for every gate in sections 1-7 (section 9 lists the commands)",
    "check --all: only OK lines (with 'aliased: <seq>' notes only for allowlisted FW-Q entries) and 'no rig' only for sheets left keyframe-only",
    "Frame-rect diff against b6b1346 changes only the sheets listed in section 9",
    "Fresh image-only reviewer verdicts recorded per sprite (SHIP or SHIP WITH NITS, and the item-specific yes/no questions)"
  ],
  "pass_fail": [
    "npx tsc --noEmit, npm run build, npx vitest run: exit 0",
    "python3 -I assets-src/gen/selftest.py --anim (worktree) and selftest.py (main checkout): ALL PASSED",
    "Party atlases byte-identical; monster atlas identical for PYTHONHASHSEED 0 and 1; every page <= 2048",
    "pass R fix images used in this round: 0 (main-checkout ledger: no new attempt row)",
    "G1 exit check (section 8) passes before any rig tranche starts",
    "Re-test (section 10): no P0/P1 open"
  ]
}
```

---

## 1. P1: chimera grows a second dragon head in the action keys

**Root cause (verified).**
- The defect is in the approved pixels: `approved/chimera/monster_large.png` (R250, best of 3, seed 1236, cells
  168x128) draws lion, goat and one dragon head in idle, and **a second, open-jawed dragon head in front of the lion's
  mane** in attack and hurt. The rig records it as a known nit (`chimera.yaml:9-10`) and gives it its own joints and
  part: `h4`/`s4` in the attack (`:57-58`) and hurt (`:92-93`) keyframes, the anchor `a4` (`:119`), the part
  `dragon2` (`:122`, `in: [attack, hurt]`), its `z` entries (`:128-129`), its masks (`:146-148`) and the `h4`/`s4`
  tweaks (`:170`, `:174`, `:186`).
- Frames that show it (`fixmeasure.py partc chimera dragon2 idle attack atk_mid atk_follow hurt_in2 hurt`): idle
  0 px; attack, atk_mid, atk_follow 758 px; hurt_in2 239 px; hurt 265 px. So 5 of the 12 non-daze frames show 4 heads.
- Size (pre-measure, the rig's `dragon2` polygons):

  | Key | `dragon2` label px | Opaque px in the `dragon2` polygon | green fill | outline ink | green px inside the lion-head polygon |
  |---|---|---|---|---|---|
  | attack | 758 | 1002 | 360 | 335 | 8 |
  | hurt | 265 | 874 | 337 | 316 | 248 |

  In the attack the head lies almost entirely outside the lion: the erase is mostly a null into empty space plus a
  new outline. In the hurt about 248 green px lie over the mane; they need a mane fill, not a null.
- Fill components do not separate it (`fixmeasure.py fills chimera attack hurt --box 106 52 168 92 --min 10`: one
  1191 / 1037 px component joins it to the lion), so the selection is geometric (the rig's polygons), not a component.
- The dragon greens are (66, 82, 49), (99, 132, 74) and (148, 156, 90). The box x 120-167, y 54-91 holds 369 of them in
  the attack, 9 of which belong to the upper dragon (`dragon` part): every colour gate excludes the `dragon` mask.
- A regeneration is not available: chimera/monster_large has 3 of 3 pass-R attempts (main ledger), and D-R1 rules
  out an exception.

**Decision D-R1 = B (orchestrator):** erase the extra head with keyframe paint; FW-P caps `chimera/attack <= 800`,
`chimera/hurt <= 600` (FW-PA). Fallback after 3 failed iterations: **D** (rig-only `drop` of `dragon2` in atk_mid,
atk_follow and hurt_in2, keys unchanged) as the interim, and escalate to the user. **0 images in every case.**

**Fix (rig agent "beasts2", after FW-M2 and FW-PA are merged).**
1. Selection, per key, written as an xy list by `fixmeasure.py select` (FW-M2 adds `--poly` and `--not-mask`):
   - **E** (erase to null) = every opaque pixel inside the key's `dragon2` polygon that is **not** inside the lion
     `head` mask and not inside the `dragon` mask of that key.
   - **F** (hurt only, mane fill) = every dragon-green pixel inside the hurt's `head` mask that is inside the
     `dragon2` polygon (about 248 px).
   - Record |E| and |F| in the rig comment. Attack: |E| is expected about 758, which with the re-ink leaves about 40 px
     under the 800 cap. Hurt: |E| + |F| + re-ink must be <= 600. Stop and report if a count exceeds its cap.
2. Attack: null E; then re-ink the new silhouette edge: every kept fill pixel (outside E) that now 4-touches a
   nulled pixel becomes (6, 4, 10). The re-ink pixels are therefore outside E by construction.
3. Hurt: null E and re-ink as in step 2; recolour F ring by ring from the outside in to the 4-neighbour mode of the
   surrounding **mane** pixels (the lion's own ramp; the crocodile recipe of plan 1).
4. Rig: remove `h4`/`s4` (`:57-58`, `:92-93`), `a4` (`:119`), `dragon2` (`:122`), its `z` entries (`:128-129`), its masks
   (`:146-148`) and the `h4`/`s4` tweaks (`:170`, `:174`, `:186`); `check`, `review`, image-only review, `lock` (the lock
   gains `kf:attack`, `kf:hurt`). Iteration budget: 3.
5. Fallback D (only after 3 failed iterations, orchestrator informed): revert steps 1-3, keep the rig's `dragon2`,
   add `drop: [dragon2]` to atk_mid, atk_follow and hurt_in2, `check`, review, `lock`, and escalate the remaining 2
   frames (attack, hurt keys) to the user.

**Acceptance (B).**
- [ ] Geometric gate (the RED numbers pinned in `selftest_fixmeasure.py` first): FW-M2 `fixmeasure.py poly chimera
  attack atk_mid atk_follow --poly dragon2@attack --not-mask head dragon` = **0 opaque px** and `... hurt hurt_in2
  --poly dragon2@hurt --not-mask head dragon` = 0 (RED: |E| per frame).
- [ ] Colour gate (secondary): `fixmeasure.py colours chimera <frame> --rgb 66,82,49 99,132,74 148,156,90 --box 120
  54 168 92 --not-mask dragon` = 0 for attack, atk_mid, atk_follow; the same with `--box 106 54 160 88` for hurt and
  hurt_in2, which also covers F (RED: 360 / 337 in the attack / hurt minus the dragon-part pixels; pinned at RED).
- [ ] The upper dragon is untouched: `fixmeasure.py partc chimera dragon attack atk_mid atk_follow hurt_in2 hurt`
  within +-10 % of its own b6b1346 count per frame (attack 794, atk_mid 794, atk_follow 795, hurt_in2 671, hurt 673).
- [ ] Holes: `fixmeasure.py pieces chimera attack hurt --holes 2` lists exactly the b6b1346 holes, no new one (attack
  161 px at (116, 52) and 14 px at (76, 46); hurt 98 px at (112, 51) and 17 px at (78, 43); recorded in the rig
  comment).
- [ ] Clean outline: FW-M2 `fixmeasure.py edges chimera attack hurt atk_mid atk_follow hurt_in2 --box 100 50 168 95
  --vs idle`: edge gaps 0; spurs and bare ink <= the idle's in the same box.
- [ ] FW-P accepts the patches (allowlisted caps, palette only); `check chimera` OK; the lock has `kf:attack`, `kf:hurt`.
- [ ] A fresh reviewer shown idle, attack and hurt at 1x and 4x answers yes to all three: exactly three heads (lion,
  goat, dragon) in every frame; the mane in the hurt reads as mane (no smear or flat patch); no outline breaks.

**Acceptance (fallback D).** `partc chimera dragon2 atk_mid atk_follow hurt_in2` = 0 px; `check chimera` OK; the
escalation is written to `ROSTER_LOG.md` "Fix pass 2" with the attack/hurt counts.

---

## 2. F6 P2 items

"Key" = the defect is in an approved keyframe (FW-P on that key; <= 160 px unless allowlisted). "Rig" = the defect is
in a generated in-between (rig `paint`, `tweaks`, `moves`; no cap). The FW-M2 `edges` metric (section 4) counts, per
frame and box: **spurs** (opaque pixels with <= 1 opaque 4-neighbour), **inner ink** (outline-ink pixels with 4 opaque
4-neighbours), **edge gaps** (silhouette-edge pixels that are not outline ink) and **bare ink** (ink pixels with no
fill 4-neighbour: a run of pure outline sticking out, e.g. a spike or a strand's tip). Pre-measure, whole frame, as
(spurs, inner ink, edge gaps) and the difference to the source key:

| Sprite | Source key | Defective frames (pre-measure) |
|---|---|---|
| basilisk | idle (4, 74, 0) | atk_wind1 (4, 119, 3) d=(+0, +45, +3); atk_wind2 (3, 130, 8) d=(-1, +56, +8) |
| sand_worm | hurt (3, 482, 0) | hurt_in2 (3, 528, 0) d=(+0, +46, +0) |
| sea_troll | idle (13, 318, 0) | atk_wind1 (21, 352, 29); atk_wind2 (19, 381, 44); hurt_in1 (25, 341, 38) |
| stone_golem | idle (18, 671, 0) | atk_wind1 (21, 651, 6); atk_wind2 (22, 645, 8); hurt_in1 (23, 648, 13) |
| air_elemental | hurt (11, 66, 0) | hurt_in2 (12, 81, 0) d=(+1, +15, +0) |
| ice_gigas | idle (9, 232, 0) | atk_wind1 (9, 259, 8); atk_wind2 (9, 243, 9); atk_recover (10, 240, 5) |
| earth_medusa | idle (spurs 1, edge gaps 0) | hurt_in1 spurs 6, edge gaps 4 (momus measure) |

Edge gaps are 0 in every one of these source keys and > 0 in the flagged frames; a fold or crease shows as extra inner
ink (sand_worm +46, air_elemental +15). Inner ink also changes with the pose, so it is gated only inside a box set at
RED. Roster-wide, edge gaps are common (section 4), so they are a per-item gate against the source key, not a new
global check.

| # | Item | Root cause (verified) | Fix / disposition | Owner | Binary check |
|---|---|---|---|---|---|
| P2-1 | basilisk dark notch at the foreleg/chest join, atk_wind1/2 | **Rig.** The rig's own nits (86cc20e: "under-jaw ink in atk_wind1/2, a neck notch ... in atk_wind2"); +45 / +56 inner ink, 3 / 8 edge gaps vs idle | in-between `paint` on atk_wind1/2: fill the notch's inner ink (pixels the idle does not have at the shifted position) with the 4-neighbour mode of the chest/leg fill; ink the edge gaps | rig "beasts2" | `fixmeasure.py edges basilisk atk_wind1 atk_wind2 --box <notch box, recorded in the rig comment at RED> --vs idle --shift <frame dx,dy>`: edge gaps 0 and inner ink <= idle's; `check` OK; reviewer: no notch at the join (yes) |
| P2-2 | sand_worm fold/crease at mid-body, hurt_in2 | **Rig.** `sand_worm.yaml` (27 lines, serpent template) lets two body arcs overlap in hurt_in2; +46 inner ink vs the hurt key | lower `hurt_in2`'s `t` or translate the arc (`moves: []`, the sea_snake recipe) so the arcs do not overlap; if continuity then fails, paint the crease ink with the flanking fill | rig "misc2" | `edges sand_worm hurt_in2 --vs hurt`: inner ink <= hurt's + 4; `check` OK; reviewer: one continuous body, no fold (yes) |
| P2-3 | king_mummy gold crook staff turns black in hurt_in2 / hurt | **Key.** In the approved hurt the shaft below the hand is drawn **entirely in outline ink**: box x 49-52, y 34-47 holds 56 px of (6, 4, 10) and no fill; above the hand, rows y 20-27 hold 28 ink + 1 px of the gate colours (+2 px of (189, 156, 57)). The idle shaft is ink around a 1 px gold core ((156, 115, 41); (222, 198, 99) where lit) | FW-P on `hurt`: recolour the 1 px core column of the shaft (about 22-28 px, y 20-27 and 34-47) to (156, 115, 41), with (222, 198, 99) on the lit side; the outline stays. hurt_in2 inherits it | rig "bipeds2" | `fixmeasure.py colours king_mummy hurt hurt_in2 --rgb 156,115,41 222,198,99 --box 49 20 53 48`: RED **7 (hurt) / 5 (hurt_in2)** pinned; GREEN >= RED + 18 in each, and every row y 34-47 of the box has >= 1 gate-colour px; patch <= 160; `check` OK; reviewer: the staff stays gold in every frame (yes) |
| P2-4 | clay_golem forehead rune changes glyph | **Key.** The approved attack draws a different glyph from idle and hurt ("R"). Pale rune + eye px in the head: idle 77 (x 68-85, y 13-28), attack 72 (x 76-93, y 25-39), hurt 70; colours (255, 239, 198) and (231, 165, 132) | FW-P on `attack`: redraw the rune as the idle's glyph at the attack head's offset (the idle rune pixels translated by the head joint difference); the old glyph pixels go to the head's clay ramp by 4-neighbour mode. Expected <= 40 px | rig "bipeds2" | FW-M2 `fixmeasure.py match clay_golem idle attack --box <idle rune box> --to <attack rune box> --rgb 255,239,198 231,165,132`: 0 differing px (boxes recorded at RED); patch <= 160; `check` OK; reviewer: the same rune in every frame (yes) |
| P2-5 | sea_troll knee spurs, broken finger outlines (atk_wind1/2, hurt_in1) | **Rig.** Part moves open silhouette edges without ink: edge gaps 29 / 44 / 38, spurs +8 / +6 / +12 vs idle | in-between `paint`: ink every edge gap (6, 4, 10), null or fill each spur (null if its only neighbour is ink, else the neighbour fill); if a frame needs more than ~40 px, first reduce the knee/hand tweaks | rig "bipeds2" | `edges sea_troll atk_wind1 atk_wind2 hurt_in1 --vs idle`: edge gaps 0 and spurs <= 13 (the idle) in each; `check` OK; reviewer: clean knees and fingers (yes) |
| P2-6 | stone_golem knee/leg seam spurs (atk_wind1/2, hurt_in1); a dark spike at the far shoulder in wind1/wind2/hurt_in1 (rig agent's nit); a chest rune differs in hurt_in1 | **Rig** for the seams and the spike: edge gaps 6 / 8 / 13, spurs +3 / +4 / +5. The spike is attached outline ink, so a pieces check cannot see it (`pieces --small 3` passes today). **Key** for the runes: the approved idle, attack and hurt draw different chest glyphs; hurt_in1 shows idle runes on moved blocks | seams: as P2-5. Spike: null its bare-ink run and re-ink the shoulder edge. Runes: **accepted nit** (D-R6) | rig "bipeds2" | `edges stone_golem atk_wind1 atk_wind2 hurt_in1 --vs idle`: edge gaps 0, spurs <= 18; **spike gate:** `edges stone_golem atk_wind1 atk_wind2 hurt_in1 --box <far-shoulder box, recorded at RED> --vs idle --shift <dx,dy>`: bare ink <= the idle's in the shifted box (RED > idle's, pinned); `check` OK; reviewer: no spike, no spurs (yes) |
| P2-7 | air_elemental 1 px dark crease line diagonally across the body, hurt_in2 | **Rig.** An arm part's outline drawn over the torso: +15 inner ink vs the hurt key | `z` for hurt_in2 (arm behind the torso) or `moves` without the arm; else `paint` the crease pixels with the flanking fill | rig "misc2" | `edges air_elemental hurt_in2 --vs hurt`: inner ink <= hurt's + 2; `check` OK; reviewer: no line across the body (yes) |
| P2-8 | earth_medusa outlined pale rectangle on the chest (idle and every idle-derived frame) | **Key.** The approved idle draws an ink-outlined pale block at x 35-40, y 31-36 with its fill at x 36-39, y 32-35; the box x 35-40, y 31-36 holds 19 ink px (`fixmeasure.py colours earth_medusa idle --rgb 6,4,10 --box 35 31 41 37`), the fill box none | FW-P on `idle`: the selection is the rectangle's ink lines that lie **inside the silhouette** (not on the silhouette edge); recolour them and the flat pale fill to the 4-neighbour mode of the surrounding torso ramp | rig "misc2" | idle: `colours earth_medusa idle --rgb 6,4,10 --box 35 31 41 37` <= the number of those 19 ink px that are on the silhouette edge (pinned at RED; RED 19); idle_b and atk_wind1: FW-M2 `colours ... --vs idle --shift <frame dx,dy>` gives the same count in their own shifted box; patch <= 160; `check` OK; reviewer: no box on the chest (yes) |
| P2-8c | earth_medusa ragged fragments at the left arm, hurt_in1 | **Rig.** spurs 6 vs idle 1, edge gaps 4 vs 0 | in-between `paint` (as P2-5) or reduce the arm's hurt_in1 tweak | rig "misc2" | `edges earth_medusa hurt_in1 --vs idle`: edge gaps 0, spurs <= 1; reviewer: the arm reads whole (yes) |
| P2-8b | earth_medusa reads as a grey recolour of medusa (silhouette IoU 0.83, edge 0.37) | **Design / approved art**: same body, poses and cell; the roster report does not flag it (needs silhouette >= 0.85 and edge >= 0.60) | **accepted nit** (D-R6; D-R7 = no regeneration) | - | D-R6 recorded |
| P2-9 | water_elemental: attack/hurt keys ~25 % larger than idle (size pop); idle 79 px under the large band (96-120); low contrast on its bestiary background | **Key** (approved sizes): heights idle 79, attack 94, hurt 85; opaque area 3753 / 4982 / 4496 px. The rig cannot scale (`frames.<f>.scale` is `kind: fx` only); 3 of 3 attempts used. **Background:** `bestiary.yaml:27` `backgrounds.enemies.water_elemental: waterfall`; pre-measure (the sprite's colours vs the stage's centre region x 600-1400, y 300-800): 19.6 % of the waterfall's pixels lie within 30 RGB of a sprite colour, `shoreline` 0.1 %, `river` 6.1 %, `ocean` 2.2 % | size pop and height: **accepted nit** (D-R6; the T-K in-betweens carry the switch, section 5). Background: change the key to **`shoreline`** (committed in `assets/backgrounds/`; a water creature at the sea's edge, as sea_troll and sea_scorpion) | TS/data owner | `bestiary.yaml` reads `water_elemental: shoreline`; `npx vitest run tests/scenes/bestiary/` passes; the reviewer answers yes to "the water elemental reads against its bestiary background" at 1x |
| P2-10 | black_knight very dark (8 colours, mean luminance 31 of 255), low contrast on the temple back wall | **Key** (approved palette): (6, 4, 10), (33, 41, 41), (49, 49, 57), (66, 66, 74), (74, 74, 82), (90, 90, 99), (107, 107, 115), (165, 165, 173) | **accepted nit** (D-R6; D-R6b = no ramp-shift exception), like vampire_lord's darkness in F6 | - | D-R6 recorded |

---

## 3. New nits from F6 and the rig hand-offs

| # | Item | Root cause | Fix / disposition | Owner | Binary check |
|---|---|---|---|---|---|
| N-1a | crocodile filled curl reads as a dark lump: 18 px of (33, 0, 33) inside it in hurt and hurt_in2 (`fixmeasure.py colours crocodile hurt hurt_in2 --rgb 33,0,33 --box 0 40 40 90`: 18 / 18) | **Key** paint from plan 1 (FW-P 158 px) left the darkest ramp colour inside the curl | FW-P on `hurt`: recolour the 18 px to the tail's mid ramp (4-neighbour mode among the tail fills). The key's patch then exceeds 160, so the rig sets `kf_paint_cap: {hurt: 220}`, the plan-1 allowlisted cap (rev 3 ruling, already in `KF_PAINT_ALLOW`) | rig "beasts2" | `colours ... --rgb 33,0,33` = 0 in hurt and hurt_in2; total `hurt` patch <= 220; the plan-1 fills gate still gives 1 tail component; reviewer: the curl reads as tail (yes) |
| N-1b | crocodile tail tip: a 1-2 px strand ending in a bare 4x2 ink block (rows y 38-39, x 17-20; the strand runs x 17-27, y 38-46) | **Key** (the approved tip, kept by plan 1's fill) | FW-P on `hurt`: replace the bare ink block with a 2 px tapered fill tip and ink it; thicken the strand rows to >= 2 px fill where it is 1 px; inside the same 220 cap (158 + 18 + this <= 220) | rig "beasts2" | FW-M2 `edges crocodile hurt hurt_in2 --box 15 36 30 47`: bare ink 0 (RED: 5, pinned) and spurs 0; total patch <= 220; reviewer: the tail ends in one clean tip (yes). If it does not pass in 3 iterations, the tip strand goes to the accepted-nit list **by name** (D-R6) |
| N-2 | ice_gigas 1 px loincloth strand at the knee in atk_wind1/2 and atk_recover | **Rig**: edge gaps 8 / 9 / 5 vs idle 0 (the hip shift opens the hem; `ice_gigas.yaml:137` already inks some) | in-between `paint`: null the strand pixels (spurs, bare ink) and ink the gaps | rig "bipeds2" | `edges ice_gigas atk_wind1 atk_wind2 atk_recover --vs idle`: edge gaps 0, spurs <= 9; plan-1 axe gate still max step <= 32; `check` OK |
| N-3 | garland atk_swing2 smear reads as a V hook on the blade | **Rig** paint (`garland.yaml:276-286`), constrained by the swing -> swing2 IoU bound 0.414 (`:184`; 0.4142 at 400 px) | **accepted nit** (D-R6) | - | D-R6 recorded |
| N-4 | ashen_queen coil base / altar sits ~8 px (hurt) and ~3 px (attack, cast) left of idle (rows >= 170 span x 20-157 / 25-162 vs idle 28-165; f372ec8) | **Key registration** in the approved hurt, attack and cast (the coil should stay planted) | **FW-O** (section 4): `key_offset: {hurt: [8, 0], attack: [3, 0], cast: [3, 0]}` (cast per the rev-13 ruling), then re-check and re-derive the in-between paint on frames sourced from those keys (`ashen_queen.yaml:257-`) | framework owner (FW-O), then rig "misc2" | FW-M2 `fixmeasure.py rowspan ashen_queen idle attack hurt cast --rows 170 199`: every left edge equal to idle's (28) +-1; `check ashen_queen` OK; frame-rect diff changes only ashen_queen; reviewer: the coil base does not slide between idle, attack, cast and hurt (yes) |
| N-5 | sea_snake faint doubled outline at the neck (atk_recover, hurt_in1), purple_worm plate notch (hurt_in1), sand_worm 1 px bud-edge nicks (wind1/2), guardian dark px under the spear tips (hurt_in2) | **Rig** nits recorded at SHIP WITH NITS (56978fe, 22e9541, 586037b; F6 B table) | **accepted nit** (D-R6), unless the G7 tester flags one; then the P2-5 recipe in a later round | - | D-R6 recorded |

---

## 4. Framework items (one owner, serial, RED-first in a selftest, every existing lock unchanged)

`fixmeasure.py` is 277 lines today (over the 250 guideline, a known exception); every new subcommand goes into a new
`assets-src/gen/fixmeasure_edges.py`, and `fixmeasure.py` only dispatches to it (+ <= 10 lines).

| Id | Change | Files | RED-first selftest | Effort |
|---|---|---|---|---|
| FW-M2 | New `fixmeasure.py` subcommands. `edges <sprite> <frames> [--box] [--vs KEY [--shift dx,dy]]`: spurs, inner ink, edge gaps, bare ink (section 2) and the difference to KEY in the shifted box. `match <sprite> <A> <B> --box BA --to BB --rgb ...`: the two colour masks compared, differing px. `poly <sprite> <frames> --poly <part>@<key> [--not-mask <part> ...]`: opaque px inside a rig mask polygon minus other masks. `switch <sprite> <seq> [--rig FILE]`: for every adjacent pair of the sequence, the adjacent IoU and centroid step against the continuity need `min(0.55, IoU(span) + 0.02)` and cap `max(6 x cell_h / 80, 0.5 x span distance)` (`anim_checks.py:165-176`, pairs as at `monster_check.py:121-125`); without `--rig` it searches the best key-switch translation (T-K pre-check). `rowspan <sprite> <frames> --rows Y0 Y1`: opaque x extent of those rows. `colours` and `select` gain `--vs/--shift`, `--poly`, `--not-mask` | `fixmeasure_edges.py` (new), `fixmeasure.py` (dispatch) | `selftest_fixmeasure.py` pins the pre-measure numbers of sections 1-5: chimera dragon part 794 / 671 (attack / hurt), sea_troll edge gaps 29 / 44 / 38, basilisk 3 / 8, ice_gigas 8 / 9 / 5, sand_worm inner ink +46, crocodile tip bare ink 5, king_mummy 7 / 5, earth_medusa 19; `switch black_knight attack` need 0.46; existing subcommand outputs unchanged | 4 h |
| FW-O | **Keyframe offset**: a rig `key_offset: {<key>: [dx, dy]}`. Hook: in `MK.apply` (`monster_keys.py:103-`) **after `drop_raise` (`:106`) and before `paint_keys` (`:109`)**, so keyframe paint coordinates are in the offset cell. It shifts the padded key's pixels (integer px, transparent fill, no content change) and translates, for that key, the keyframe joints, every `masks.*.<key>` polygon, and the keyframe paint xy; in-between `paint` on frames sourced from that key is **not** moved automatically (the rig agent re-derives it; for ashen_queen `:257-`). `--raw` (`fixmeasure.py`, `paint=False`) still applies the offset (it only skips the paint), so RED/GREEN compare the same registration. Refused if an opaque pixel would leave the cell or |dx|, |dy| > 12. The lock writer adds `kf:<key>` for every offset key | `monster_keys.py`, `monster_anim.py` (joints/masks), the lock writer | `selftest_efix.py`: an offset key moves every frame sourced from it by exactly (dx, dy) when the rig joints are offset too; an offset that clips is refused; a rig without `key_offset` is byte-identical; `--raw` sees the offset; all locks unchanged | 3 h |
| FW-Q | **Per-sequence alias (partial rig)**: a rig `alias: [hurt]` or `alias: [attack]` leaves that sequence's in-betweens out of `generate` (only `hurt_in1`/`hurt_in2`, or only `atk_wind1 atk_wind2 atk_mid atk_follow atk_recover`), so they resolve to their source keys as on a keyframe-only sheet; `idle_b`, `daze`/`daze_b` and the other sequences are still generated and checked. Key-to-key pairs are already skipped by continuity (`monster_check.py:122`). `check` prints `OK (aliased: hurt)`. At most one aliased sequence per rig, from `FWQ_ALLOW` in `selftest_efix.py`: **pre-allowlisted in G1** with the 6 expected entries scorpion/hurt, black_widow/hurt, crawler/attack, hydra/attack, black_knight/hurt, astos/attack (rev-20 ruling); **G6 removes every unused entry** | `monster_anim.py` (`generated_names`), `monster_check.py` (report line), `monster_atlas.py` (aliases) | `selftest_pages.py`: a fake rig with `alias: [hurt]` has no `hurt_in1`/`hurt_in2` frames of its own (the atlas aliases them to idle/hurt) while its `daze` frames are generated; its other frames are byte-identical to the same rig without the alias; an entry not in `FWQ_ALLOW` and a second alias are refused | 2 h |
| FW-C | **Floating cutter clamp** for the swimmers (section 6) | `monster.py` (`cut`) | `selftest_cut.py` (section 6) | 2 h |
| FW-PA | FW-P allowlist for D-R1: `KF_PAINT_ALLOW` (`monster_keys.py:23`) gains `("chimera", "attack"): 800` and `("chimera", "hurt"): 600` | `monster_keys.py:23`, `selftest_efix.py:356-361` | the equality assertion (`:360-361`) lists the four entries; new refusal cases `("chimera", {"attack": 801})` and `("chimera", {"hurt": 601})`, plus `("chimera", {"idle": 200})` | 0.5 h |

**FW-M2 roster sweep (report-only, not a gate).** Pre-measure over all 112 locked rigs (`/tmp/rfp2/allgaps.txt`,
whole frames): 106 sprites have at least one frame with edge gaps, and 46 approved **keys** have some too (dragon
attack 29, ogre idle 19, piscodemon and nightmare attack 16): a lit rim pixel without ink is legitimate art. Top
in-betweens: chaos daze 66 / daze_b 64 / hurt_in1 57 / cast_gather 52, ogre_mage hurt_in2 47, sea_troll atk_wind2 44,
dragon_zombie atk_follow 40, sea_troll hurt_in1 38, ogre_chief hurt_in1 34; chaos passed both play tests. The
framework owner commits the top-20 list to `ROSTER_LOG.md` "Fix pass 2"; the G7 tester looks at the top 10 at 4x. A
frame the tester flags goes to D-R6 or to a later round (not this one).

---

## 5. T-K tranche: rigs for the 9 keyframe-only sheets

**Why plan 1's "translation-only sidesteps the blockers" does not hold for grounded sheets (measured).** Every adjacent
pair of a sequence with a generated frame is checked (`monster_check.py:121-125`): adjacent IoU >= `min(0.55,
IoU(span keys) + 0.02)` and centroid step <= `max(6 x cell_h / 80, 0.5 x the span keys' centroid distance)`
(`anim_checks.py:165-176`). A translation only trades overlap against the centroid step, and grounded sheets cannot
move far vertically. death_eye and evil_eye pass because they float.

**Pre-measure translation tables** (`/tmp/rfp2/tk.py`: approved alpha masks, keys padded to a common centred cell;
the best key-switch offset **d** = the attack (or hurt / cast) key's shift relative to the idle, dx -30..30, dy -3..3
grounded and -12..12 floating, within the centroid cap; then idle-sourced frames shift by `-round(d/2)` and key-sourced
frames by `d - round(d/2)`, so each switch sees exactly d). Each cell gives the frame's (dx, dy); "pair" lists the
weakest adjacent pair as IoU / centroid step against need / cap. Before iterating, the rig agent confirms its table
with `fixmeasure.py switch <sheet> <seq> --rig <draft>` (FW-M2); these numbers are not gates.

| Sheet | Seq | d | atk_wind1 | atk_wind2 | atk_mid | atk_follow | atk_recover | hurt_in1 | hurt_in2 | Weakest pair (IoU/step vs need/cap) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| warmech (200; attack cell 232) | attack | (-24, 0) | (6, 0) | (12, 0) | (-12, 0) | (-12, 0) | (12, 0) | | | wind2->mid 0.463 / 18.8 vs 0.33 / 19.1 (momus; (-25, 1) fails at 19.3; +8 fails) | pass, 0.3 px step margin |
| warmech | hurt | (-16, 0) | | | | | | (8, 0) | (-8, 0) | in1->in2 0.584 / 9.6 vs 0.44 / 15.0 | pass |
| warmech | cast | (0, 0) | | | | | | | | gather->rise 0.79 / 6.2 vs 0.55 / 15.0 | pass (no shift) |
| water_elemental (floating) | attack | (11, 5) | (-3, -1) | (-6, -2) | (5, 3) | (5, 3) | (-6, -2) | | | wind2->mid 0.66 / 9.2 vs 0.50 / 9.6 | pass |
| water_elemental | hurt | (2, 3) | | | | | | (-1, -2) | (1, 1) | in1->in2 0.62 / 6.5 vs 0.55 / 9.6 | pass |
| horned_devil | attack | (-5, 3) | (1, -1) | (2, -2) | (-3, 1) | (-3, 1) | (2, -2) | | | wind2->mid 0.45 / 5.0 vs 0.43 / 6.0 | pass, thin |
| horned_devil | hurt | (-6, 1) | | | | | | (3, 0) | (-3, 1) | in1->in2 0.45 / 5.8 vs 0.41 / 6.0 | pass, thin |
| black_knight | attack | (4, -1) | (-1, 0) | (-2, 0) | (2, -1) | (2, -1) | (-2, 0) | | | wind2->mid and follow->recover 0.588 / 5.7 vs 0.46 / 6.0 | pass, **0.3 px step margin** |
| black_knight | hurt | (1, 0) | | | | | | (0, 0) | (1, 0) | in1->in2 0.51 / 3.5 vs 0.52 / 6.0 | **fail by 0.01** |
| scorpion | attack | (3, -2) | (-1, 1) | (-2, 1) | (1, -1) | (1, -1) | (-2, 1) | | | wind2->mid 0.66 / 1.3 vs 0.55 / 6.0 | pass |
| scorpion | hurt | (-3, 2) | | | | | | (2, -1) | (-1, 1) | in1->in2 0.31 / 5.9 vs 0.31 / 6.0 | at the bound (rear-up) |
| hydra | attack | (-3, 2) | (1, 0) | (2, -1) | (-1, 1) | (-1, 1) | (2, -1) | | | wind2->mid 0.548 / 5.4 vs 0.55 / 9.6 | **fail by 0.002** (head swap) |
| hydra | hurt | (-5, 1) | | | | | | (2, 0) | (-3, 1) | in1->in2 0.75 / 1.5 vs 0.55 / 9.6 | pass |
| black_widow | attack | (7, 3) | (-2, -1) | (-4, -2) | (3, 1) | (3, 1) | (-4, -2) | | | recover->idle 0.51 / 4.5, wind2->mid 0.53 / 5.0 vs 0.43 / 6.0 | pass |
| black_widow | hurt | - | | | | | | | | centroid jump (-7, -14) vs cap 7.9: no translation | **fail** (rear-up) |
| crawler | attack | - | | | | | | | | centroid jump (3, 10) vs cap 6.0 | **fail** |
| crawler | hurt | (-2, -3) | | | | | | (1, 2) | (-1, -1) | in1->in2 0.54 / 5.5 vs 0.53 / 6.0 | pass, thin |
| astos (200) | attack | - | | | | | | | | centroid jump (-9, 27) vs cap 15.0 | **fail** |
| astos | hurt | (3, 0) | | | | | | (-2, 0) | (1, 0) | in1->in2 0.47 / 9.3 vs 0.49 / 15.0 | **fail** |
| astos | cast | (-1, 0) | (cast_gather (0, 0), cast_rise (-1, 0), cast_release (-1, 0)) | | | | | | | gather->rise 0.50 / 12.8 vs 0.52 / 15.0 | **fail** |

**Approach per sheet** (rig agents; 3 iterations each; each sheet `check`, `review`, fresh image-only reviewer, `lock`):

| Sheet | Approach | Daze | If it does not pass in 3 iterations |
|---|---|---|---|
| warmech | `preset: mechanical`, translation-first (`moves: []`, the table's dx/dy; every bone <= 15°); `d` must stay (-24, 0): the 0.3 px step margin leaves no room for dy | **D-R5, rev-11 ruling: the default recipe slump** (`daze`/`daze_b` from `monster_recipes.py:51-53`, legs pinned); own frames | FW-Q is not pre-allowlisted for warmech: escalate |
| water_elemental | from `/tmp/water_elemental_iter4.yaml`, but every frame a pure translation by the table (`moves: []`), including hurt_in1/2 (the draft's `moves: [crown, neck]` there is the remaining crease source, 434e02b) and daze (the draft's pure sinks) | draft's sinks | escalate (not allowlisted) |
| horned_devil | biped with FW-5 wings; the table's translations; partial `moves` only for the wings (gargoyle recipe), each step checked with `switch --rig` because the margins are 0.02-0.04 | recipe | escalate (not allowlisted) |
| black_knight | **attack translation-only by the table**: `atk_follow` = attack dx +2 (dy -1), `atk_recover` = idle dx -2, winds -1 / -2; tune dy only if `switch` shows a gain (0.3 px step margin). This replaces the draft's `t: 0.78` part-moving follow that failed follow -> recover (dbef031). Hurt: 0.01 short; try a 1-2 px torso tweak lerp, else FW-Q `alias: [hurt]` | the draft's slump (`moves: [crown, neck, chest]`) | FW-Q alias hurt (allowlisted) |
| scorpion | arthropod template; attack by the table; hurt at the bound: try `t` lerps of the abdomen/tail, else FW-Q `alias: [hurt]` | recipe | FW-Q alias hurt (allowlisted) |
| hydra | multi-head quadruped (FW-5), heads translated as a group (fire_hydra recipe); hurt by the table; attack 0.002 short: `drop` the side-swapping head in the idle-sourced winds (it appears at the switch), else FW-Q `alias: [attack]` | recipe | FW-Q alias attack (allowlisted) |
| black_widow | arthropod; attack by the table; hurt: FW-Q `alias: [hurt]` from the start (guide 2.2: a rear-up hurt does not bridge) | recipe | keyframe-only (D-R4 fallback) |
| crawler | arthropod; hurt by the table; attack: FW-Q `alias: [attack]` from the start | recipe | keyframe-only |
| astos | boss biped; all three switches fail by translation, so a joint rig (lerped `moves`) for hurt and cast; attack: FW-Q `alias: [attack]` | **D-R5, rev-11 ruling: the default recipe slump**; own frames | keyframe-only (`no rig`), escalated with the measured numbers |

**T-K acceptance (per sheet).**
- [ ] `fixmeasure.py switch <sheet> <seq> --rig <rig>` output for every sequence is recorded in the rig comment (the
  pre-measure table above is replaced by the real numbers).
- [ ] `check <sheet>`: `OK`, or `OK (aliased: <seq>)` only for an `FWQ_ALLOW` entry.
- [ ] astos and warmech: the atlas has `daze` and `daze_b` frames of their own (not aliases of idle); `check` OK
  (continuity over the daze sequence, span idle/hurt); the reviewer answers yes to "the daze reads as a stunned slump
  and the legs stay planted".
- [ ] Fresh image-only reviewer: SHIP or SHIP WITH NITS per sheet; then `lock`.
- [ ] `check --all` prints only `OK` lines (with the aliased notes) and `no rig` only for sheets left keyframe-only.

---

## 6. Deferred swimmers: white_shark and red_piranha (0 images, framework re-cut)

**Root cause (verified in code).** `monster.cut` (`monster.py:439-541`) aligns a floating sheet with one shared offset:
`dy_shared = foot - iy1` (`:522`, the idle's lowest row onto the foot row) and `dy = dy_shared if floating` for every
cell (`:529`). A floating action cell drawn lower than the idle lands below the cell and is clipped (`:532-537`,
`info["clipped"]`): white_shark R278-R280 ("every action cell is drawn lower than the idle") and red_piranha R282 ("its
hurt is sliced on the bottom row").

**Raws (rev 15).** They exist in the main checkout's out dirs and are byte-identical to the cache entries:
red_piranha `assets-src/gen/out/gemini/red_piranha/1236/monster_small_raw.png` (R282, key `19a3bccfa97e214bd940ce6a`),
white_shark `assets-src/gen/out/gemini/white_shark/{1234,1235,1236}/monster_large_raw.png` (R278-R280; R280 = seed 1236,
key `38351be46753975f50cd80dd`). The existing `generate.py --repixelize OUT_DIR` path (`:662-691`) is used unchanged;
**no `--from-cache`** (dropped).

**Pre-measure (today's cutter, `/tmp/rfp2/swim.py`).**

| Sheet | Cell / foot row | Native heights (idle, attack, hurt) | Scale | Clipped today | Lift needed (attack, hurt) | Lifted rows |
|---|---|---|---|---|---|---|
| red_piranha (R282) | 80 / 76 | 51 / 51 / 50 (momus: 51 / 52 / 51) | 1.0 | hurt | 0 / 7-8 | hurt about y 27-77: inside the cell |
| white_shark (R280) | 128 / 122 | 46 / 79 / 81 → about 57 / 94 / 96 rows (momus: 57 / 95 / 98) | 1.185 | attack, hurt | 33-34 / 34-36 | attack about y 31-125, hurt about y 28-125: **inside the 128 px cell** with >= 28 px headroom |

**FW-C (framework owner).**
1. `cut(..., floating=True)`: after `dy_shared`, for each cell k compute `ov_k = (y1_k + dy_shared) - (c - 3)` (the
   2 px bottom margin); if `ov_k > 0`, use `dy_k = dy_shared - ov_k` for that cell only. `info["lifted"] = {pose:
   ov_k}`. Cells with `ov_k <= 0` are unchanged. A lift over `LIFT_MAX` refuses the cut with an error naming the pose,
   and so does a lifted cell whose top row would be < 2.
2. **`LIFT_MAX` (rev-14 ruling).** Default 24. In G1 the FW-C owner re-cuts white_shark R280 into a scratch copy of its
   out dir and measures the exact need and the lifted rows. If every lifted figure lies entirely inside the 128 px cell
   (top >= 2, bottom <= 125, as pre-measured), `LIFT_MAX` = that need rounded up to the next multiple of 4 (about 36),
   with a comment: "white_shark R280: the action cells are drawn 34-36 px lower than the idle; lifted, they fit the
   large cell". The float band (check 8) is a rig check, so it is decided in G3d: if white_shark's rig cannot pass
   check 8 in 3 iterations, white_shark is deferred again and `LIFT_MAX` returns to 24 (red_piranha needs only 7-8).
   If the figure does not fit, `LIFT_MAX` stays 24, white_shark stays deferred with the measured lift, and only
   red_piranha is re-cut.
3. Only new cuts use it: approved sheets are never re-cut, and `approve.py` copies the cut from `out/`.
4. **Re-plan check before approval:** `approve.py` re-plans the request from the current `monsters.yaml` text to find
   the cache key; only the last attempt per sheet matches it (R282; R280). R278/R279 are not used.

**Selftest (`selftest_cut.py`, RED first).**
- A synthetic floating 3-cell raw for a 128 px cell with foot row 122, whose attack figure is drawn 10 px lower than
  the idle: today `info["clipped"] == ["attack"]` (RED); after FW-C `clipped == []`, **`info["lifted"] == {"attack":
  7}`** (132 - 125), and the idle and hurt cells are byte-identical to today's output.
- A floating raw with no low cell, and a non-floating raw: byte-identical to today, no `lifted`.
- A lift of `LIFT_MAX + 1`: refused, the message names the pose.
- PYTHONHASHSEED 0 and 1 give the same bytes.

**Then (main checkout, generator, after FW-C is fast-forwarded to `roster`; 0 images):**
```bash
python3 -I assets-src/gen/generate.py --repixelize assets-src/gen/out/gemini/red_piranha/1236
python3 -I assets-src/gen/generate.py --repixelize assets-src/gen/out/gemini/white_shark/1236   # only if LIFT_MAX allows it
```
Review each against guide 1.4 (no slice, no idle copy as the attack, one fish). If approved: `approve.py <id> <sheet>
--note "pass R fix 2: FW-C re-cut of R28x, 0 images"`; commit on `roster`; the integrator merges.

**Data and atlas (rev 19; TS/data owner, after the integrator's rebuild in G4).**
- `enemies.yaml` entries: `red_piranha` num 52, `white_shark` num 94 (ROSTER_PLAN rows 052, 094), with `name`,
  `description`, `stats` (hp, strength, agility, intelligence, vitality, luck, attack, defense, magicDefense, accuracy,
  evade), `xpReward`, `goldReward`, `protect`, `weakness`, `resist` from the ROSTER_PLAN spec rows as for every other
  roster entry; `sprite: <id>`, `size: small` / `large`, `family: aquatic`, `attack: melee`.
- `bestiary.yaml` `backgrounds.enemies`: both `ocean` (as shark, bigeyes).
- Placement: none (no act-1 encounter table lists them; they appear in the bestiary and sandbox only), unless the
  ROSTER_PLAN placement table names a zone, which then applies.
- `monster_pages.py` already lists both mid-group (`:29`, `:35`), so the cells after them move on their pages: the
  integrator records the page count and page sizes after the rebuild (today 9 pages), and updates AGENTS.md ("121
  atlas sheets ... 9 pages") and the frame-rect diff expectation.
- Rigs: rig agent "float2" from the shark / bigeyes rigs (3 iterations); the float band (check 8) decides white_shark
  (step 2).

**Acceptance.** `selftest_cut.py` RED -> GREEN; red_piranha's re-cut has `clipped == []`; white_shark is re-cut with
`clipped == []` **or** deferred with its measured lift recorded in `ROSTER_LOG.md` "Fix pass 2"; the reviewer's yes/no is
recorded; `check red_piranha` (and `white_shark` if re-cut) OK; `assetCoverage.test.ts` passes; the main-checkout ledger
shows no new attempt row for either id.

---

## 7. Data follow-ups (TS/data owner)

**Root cause (verified).**
- `assets/data/enemies.yaml:2860` Dark Fighter `spells: [wall, xfer, hel3, fog2, inv2, cur4, hel2, cur3]`; none is a
  `spells.yaml` id. Only `cur3` has an equivalent: `cure3` (`spells.yaml:151`, name `CUR3`, `single_ally`, power 66).
- `bestiary.yaml:104-106` lists `cur3: CUR3` under "spec spell codes that spells.yaml does not have yet", which is no
  longer true.
- An enemy only casts through an `ai:` block (`enemies.yaml:330` pattern), and `dataAiPattern` keeps only spells the
  battle knows (`src/battle/enemyAiPattern.ts:8-12`). Dark Fighter has no `ai:`, so she only fights.
- Enemies with spell codes but no `ai:` block: dark_wizard, death_knight, dark_fighter, lich_2, ashen_queen_2.
  Unmapped codes on enemies that do have one: astos rub, slo2; evil_eye xxxx, brak, rub; death_eye stop, zap, xfer,
  brak, rub; hollow_seraph_2 bane; chaos ice3, lit3, slo2, cur4, fir3, nuke.

**Fix (decided: D-R8 rate 0.5).**
1. Rename `cur3` to `cure3` in Dark Fighter's `spells`; drop `cur3` from `bestiary.yaml` `spellNames`.
2. Add `ai: {rate: 0.5, actions: [{type: magic, spellId: cure3, weight: 1}]}` with the comment "rate 0.5: the median
   of the spell-casting roster entries of similar tier (ogre_mage, horned_devil, death_eye, hollow_seraph_2, chaos);
   no spec value is recorded for this entry". `enemies.yaml` rates today: 0.25 x2, 0.38 x3, 0.5 x5, 0.63 x1, 0.75 x5.
3. Behaviour (verified in `BossAI.ts:25-27`): a `single_ally` spell aims at the living ally with the lowest HP
   fraction, itself included. So she casts CUR3 on her **most hurt ally** even when she is at full HP (and on herself
   when she is the most hurt). The description ("She heals herself") stays true when she fights alone.
4. Death Knight, lich_2, ashen_queen_2 and **dark_wizard (no ai block either)**: no change; none of their codes exists,
   and mapping `blnd` to `dark` or `nuke` to another spell would change the design. They stay Fight-only until the
   spells exist (a content task outside this plan).
5. New test in `tests/data/crossFileValidation.test.ts`, **name-based**: every enemy `spells` code is a `spells.yaml`
   id or a `bestiary.yaml` `spellNames` key, and no `spellNames` value (display name) equals the `name` of a
   `spells.yaml` spell (RED today: `cur3: CUR3` vs `cure3` named `CUR3`; Dark Fighter's `cur3` fails the first
   clause only after step 1 drops it from `spellNames`, so the test is written to fail on the duplicate first).
6. `tests/balance/`: no bound includes Dark Fighter (checked by grep in G2); none is re-measured.

**Acceptance.** The new test RED -> GREEN; `npx vitest run tests/data/ tests/battle/`; a unit test: with a hurt ally
and the RNG forcing a spell, Dark Fighter's `dataDrivenAI` picks `cure3` aimed at the most hurt living ally; with
herself the most hurt, at herself.

---

## 8. Tranches, ownership and parallelism

All worktrees branch off `roster-int`. Concurrency cap: **4 agents at a time**.

**Brief rules (every agent; a 10-minute no-progress watchdog has been killing agents).**
- Keep each foreground tool call under 2 minutes. Long commands run **only** with `run_in_background`, and the agent
  polls the output with a short read at least every 5 minutes, printing one progress line each time. Never `sleep`.
- One sprite per `check` / `review` call; hand off after each sprite.
- Expected durations (measured or estimated; G1 records the real values in `ROSTER_LOG.md` "Fix pass 2"):
  `fixmeasure.py` one sprite 3 s (measured: `partc chimera`, 2.9 s); `monster_anim.py check <one sprite>` under 1 min;
  `check --all` **8-12 min**; `selftest.py --anim` about 5-10 min (estimate); `build_assets.py monsters_ai` about
  5-10 min (estimate); `npx vitest run` about 3-6 min (estimate; 220 files, 4154 tests). All of these except the
  single-sprite commands go to the background.

| Tranche | Scope | Owner / worktree | Depends on | Parallel with | Effort |
|---|---|---|---|---|---|
| G0 | momus review (done: APPROVE WITH REVISIONS), revisions applied (rev 2), decisions recorded | orchestrator | - | - | done |
| G1 | FW-M2, FW-PA, FW-O, FW-Q (with the 6 pre-allowlisted entries), FW-C, serial; the FW-M2 sweep into `ROSTER_LOG.md`; the white_shark LIFT_MAX measurement; **G1 exit check** (below) | framework owner, `fix2-fw` | G0 | G2 | 2 d |
| G2 | section 7 data; P2-9 bestiary background | TS/data owner, `fix2-ts` | G0 | G1 | 0.5 d |
| G3a | **bipeds2**: king_mummy (P2-3), clay_golem (P2-4), sea_troll (P2-5), stone_golem (P2-6), ice_gigas (N-2) | rig agent, `fix2-rig-biped` | G1 merged | G3b, G3c, G3d | 1.5 d |
| G3b | **beasts2**: chimera (section 1), basilisk (P2-1), crocodile (N-1a, N-1b) | rig agent, `fix2-rig-beast` | G1 merged | G3a, c, d | 1.5 d |
| G3c | **misc2**: sand_worm (P2-2), air_elemental (P2-7), earth_medusa (P2-8, P2-8c), ashen_queen (N-4) | rig agent, `fix2-rig-misc` | G1 merged (FW-O) | G3a, b, d | 1 d |
| G3d | **swimmers** (section 6): re-cut and review (main checkout, generator, 0 images); after the integrator's G4 rebuild: data entries (G2 owner) and rigs ("float2") | generator; rig agent "float2" | FW-C merged and fast-forwarded to `roster` | G3a-c (the 4th slot) | 1 d |
| G4 | integrate G1-G3 (swimmer data after the rebuild), rebuild the atlas, section 9 validation, docs | integrator (this worktree) | G1-G3 | - | 0.5 d |
| G5 | **T-K** (section 5), three waves of at most 4: **wave 1** warmech, water_elemental, horned_devil, black_knight; **wave 2** scorpion, hydra, black_widow, crawler; **wave 3** astos | rig agents, `tk-<sheet>` | G4 | inside each wave | 2-3 d |
| G6 | integrate T-K, rebuild, validation; remove unused `FWQ_ALLOW` entries | integrator | G5 | - | 0.5 d |
| G7 | re-test (section 10) | fresh adversarial tester | G6 | - | 0.5 d |

**G1 exit check (rev 22; integrator, before any G3 or G5 branch is cut).** With G1 merged into `roster-int`:
1. No rig file changed: `git diff --exit-code b6b1346 -- assets-src/gen/anim/monsters/` (yaml and lock files).
2. `python3 -I assets-src/build_assets.py monsters_ai` (background), then `shasum assets/sprites/monsters-ai*` equals
   the b6b1346 committed files (`git diff --exit-code assets/sprites/monsters-ai*`): the framework changes no pixel.
3. `monster_anim.py check --all` (background): 112 `OK` and 9 `no rig`, nothing else.
4. `selftest.py --anim` ALL PASSED.

---

## 9. Image budget (`pass R fix`: 33 remaining; this round 0)

| Sheet | Item | pass-R attempts used (main ledger) | Planned | Worst case | Note |
|---|---|---|---|---|---|
| chimera/monster_large | P1 | 3 | 0 | 0 | D-R1 = B, fallback D |
| earth_medusa/monster_small | P2-8b | 2 | 0 | 0 | D-R7 = no |
| water_elemental/monster_large | P2-9 | 3 | 0 | 0 | accepted nit |
| black_knight/monster_small | P2-10, T-K | 1 | 0 | 0 | no image proposed |
| astos/boss_attack, warmech/boss_attack, scorpion | T-K | 3 each | 0 | 0 | guard refuses |
| black_widow 1, crawler 2, horned_devil 2, hydra 2 | T-K | as listed | 0 | 0 | FW-Q covers the failing sequence |
| white_shark, red_piranha | section 6 | 3 each | 0 | 0 | FW-C re-cut of the existing raws |
| **Total** | | | **0** | **0** | all 33 stay unspent |

**Sheets whose frames change** (frame-rect diff against b6b1346 must list exactly these):
- G3: chimera, basilisk, crocodile, king_mummy, clay_golem, sea_troll, stone_golem, ice_gigas, sand_worm,
  air_elemental, earth_medusa, ashen_queen.
- G3d: red_piranha (new), white_shark (new, if re-cut); their insertion moves the following cells on their pages
  (`monster_pages.py:29`, `:35`), so the frame-rect diff compares by sheet and frame name, not by page position.
- G5: every T-K sheet that was rigged (frames become in-betweens instead of aliases).
- Conditional (N-5, only if the G7 tester flags one and a later round fixes it): sea_snake, purple_worm, guardian.
- No act-1 sprite is in the list, so `CHANGED_ON_PURPOSE` (12.2 against `roster-r0`) does not grow.

**Verification commands (G4 / G6, integrator; long ones in the background).**
```bash
# section 1-3 gates (committed tool; FW-M2 subcommands)
python3 -I assets-src/gen/fixmeasure.py poly chimera attack atk_mid atk_follow --poly dragon2@attack --not-mask head dragon   # 0
python3 -I assets-src/gen/fixmeasure.py poly chimera hurt hurt_in2 --poly dragon2@hurt --not-mask head dragon                # 0
python3 -I assets-src/gen/fixmeasure.py colours chimera attack atk_mid atk_follow --rgb 66,82,49 99,132,74 148,156,90 --box 120 54 168 92 --not-mask dragon
python3 -I assets-src/gen/fixmeasure.py colours chimera hurt hurt_in2 --rgb 66,82,49 99,132,74 148,156,90 --box 106 54 160 88 --not-mask dragon
python3 -I assets-src/gen/fixmeasure.py partc chimera dragon attack atk_mid atk_follow hurt_in2 hurt   # 794 794 795 671 673 +-10 %
python3 -I assets-src/gen/fixmeasure.py pieces chimera attack hurt --holes 2                          # the b6b1346 holes only
python3 -I assets-src/gen/fixmeasure.py edges chimera attack hurt atk_mid atk_follow hurt_in2 --box 100 50 168 95 --vs idle
python3 -I assets-src/gen/fixmeasure.py edges basilisk atk_wind1 atk_wind2 --vs idle --box <rig comment>
python3 -I assets-src/gen/fixmeasure.py edges sea_troll atk_wind1 atk_wind2 hurt_in1 --vs idle
python3 -I assets-src/gen/fixmeasure.py edges stone_golem atk_wind1 atk_wind2 hurt_in1 --vs idle
python3 -I assets-src/gen/fixmeasure.py edges stone_golem atk_wind1 atk_wind2 hurt_in1 --vs idle --box <shoulder box, rig comment>
python3 -I assets-src/gen/fixmeasure.py edges ice_gigas atk_wind1 atk_wind2 atk_recover --vs idle
python3 -I assets-src/gen/fixmeasure.py edges sand_worm hurt_in2 --vs hurt
python3 -I assets-src/gen/fixmeasure.py edges air_elemental hurt_in2 --vs hurt
python3 -I assets-src/gen/fixmeasure.py edges earth_medusa hurt_in1 --vs idle
python3 -I assets-src/gen/fixmeasure.py edges crocodile hurt hurt_in2 --box 15 36 30 47                # bare ink 0, spurs 0
python3 -I assets-src/gen/fixmeasure.py colours crocodile hurt hurt_in2 --rgb 33,0,33 --box 0 40 40 90  # 0
python3 -I assets-src/gen/fixmeasure.py fills crocodile hurt hurt_in1 hurt_in2 --box 0 40 40 90 --min 10 --exclude 0 76 15 90 26 82 40 90
python3 -I assets-src/gen/fixmeasure.py colours king_mummy hurt hurt_in2 --rgb 156,115,41 222,198,99 --box 49 20 53 48   # >= 25 / 23
python3 -I assets-src/gen/fixmeasure.py match clay_golem idle attack --box <idle rune> --to <attack rune> --rgb 255,239,198 231,165,132
python3 -I assets-src/gen/fixmeasure.py colours earth_medusa idle --rgb 6,4,10 --box 35 31 41 37
python3 -I assets-src/gen/fixmeasure.py rowspan ashen_queen idle attack hurt cast --rows 170 199
python3 -I assets-src/gen/fixmeasure.py partc ice_gigas axe idle hurt_in1 hurt_in2 hurt          # plan-1 gate still <= 32
# T-K (G6)
for s in astos black_knight black_widow crawler horned_devil hydra scorpion warmech water_elemental; do
  for q in attack hurt; do python3 -I assets-src/gen/fixmeasure.py switch $s $q --rig assets-src/gen/anim/monsters/$s.yaml; done; done
python3 -I assets-src/gen/fixmeasure.py switch astos cast --rig assets-src/gen/anim/monsters/astos.yaml
# pipeline (background)
python3 -I assets-src/gen/selftest.py --anim            # worktree; the main checkout runs the full selftest
python3 -I assets-src/gen/monster_anim.py check --all   # OK lines (aliased notes for FWQ_ALLOW entries), 'no rig' only for keyframe-only sheets
python3 -I assets-src/build_assets.py monsters_ai battle_ai field_ai
git diff --exit-code assets/sprites/battle-characters-ai.* assets/sprites/characters-ai.*
PYTHONHASHSEED=0 python3 -s assets-src/build_assets.py monsters_ai && shasum assets/sprites/monsters-ai* > /tmp/a2.sha
PYTHONHASHSEED=1 python3 -s assets-src/build_assets.py monsters_ai && shasum -c /tmp/a2.sha
# frame-rect diff against b6b1346 by sheet and frame name (guide 3.7 script): the changed sheets == the list above
# ledger (ROSTER_PLAN 12.1 script, MAIN checkout): pass R still 267 (no new attempt row)
# TypeScript (background)
npx tsc --noEmit && npm run build && npx vitest run
npx vitest run tests/data/ tests/scenes/battle/ tests/scenes/bestiary/ tests/balance/
# browser (dev server on 127.0.0.1, a free port, every URL with &mute=1)
#   /?mute=1&bestiary=<id>&battleStep=1   for every sheet in the changed list
#   /?mute=1&sandbox=l30_lich&enemies=chimera,basilisk,sea_troll,stone_golem,clay_golem,king_mummy,earth_medusa,sand_worm,air_elemental&enemyAnim=loop
```

---

## 10. Re-test (G7)

A **fresh** adversarial tester gets the F6 rows, the URLs and the new evidence paths, nothing else. It re-checks:
- the P1 (chimera) with `?mute=1&bestiary=chimera&battleStep=1`, every frame at 1x and 4x: the head count;
- every P2 and new nit marked "fix" (sections 2-3), and the D-R6 nits for confirmation only;
- every T-K sheet in battle and in the bestiary (step every sequence; astos and warmech daze under sleep);
- red_piranha (and white_shark if re-cut): battle on the shoreline background, bestiary;
- **Dark Fighter** in a real fight with a second enemy that the party has hurt: she casts CUR3 on the most hurt living
  ally (herself when she is the most hurt), also when she is at full HP; the battle log names CUR3;
- the FW-M2 sweep's top 10 frames at 4x (findings go to D-R6 or a later round);
- a regression sample: one sprite per body type (goblin, wolf, cockatrice, green_slime, cobra, ochu, shark,
  ashen_queen) and every boss (garland, lich, lich_2, astos, warmech, death_eye, chaos, the 3 fiends and rematches);
- performance (not measured in F6): `anim_crowd` FPS median >= 110, and the 9-large crowd at full size.

The tester writes "Re-test (G7)" rows into `docs/ROSTER_PLAYTEST.md`. Done = no P0/P1 open, every P2 fixed or on the
decided nit list. The chimera P1 is in its second fix round: if it is still open after G7, it goes to the user with
the measured result (plan 1 section 7 rule).

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Chimera B: the hurt mane fill (about 248 px) is invented art | a smear or flat patch where the head was | polygon selection, mane ramp only, ring-by-ring 4-neighbour fill, the edges and holes gates, the reviewer's mane question; fallback D and escalation |
| Chimera attack erase near its cap (about 758 + re-ink vs 800) | FW-P refuses the patch | measure |E| first and stop before painting if it exceeds the cap |
| A key repaint or offset (FW-P, FW-O) changes the look of a shipped sheet | silent drift | `kf:` lock hashes; the frame-rect diff limited to the section 9 list; no act-1 sprite touched |
| FW-O leaves in-between paint on the old coordinates | pixels painted in the wrong place | FW-O moves keyframe paint only; the rig agent re-derives in-between paint (`ashen_queen.yaml:257-`); `check` (pieces, palette) and the reviewer |
| FW-Q lets hard key switches ship as "OK" | a pop the user thought was fixed | one aliased sequence per rig, from the allowlist, printed on the `check` line, unused entries removed in G6, listed in the re-test |
| T-K margins of 0.002-0.04 IoU or 0.3 px centroid (warmech, black_knight, horned_devil, hydra, scorpion) | a sheet passes `check` but pops visibly, or fails on a 1 px change | `switch --rig` before every iteration; the reviewer judges each switch at 1x; FW-Q as the honest fallback |
| FW-C lifts a floating attack and changes how high the fish sits | the lunge reads as a hop | LIFT_MAX from the measured need only; the float band (check 8) in G3d; the reviewer |
| The swimmers' insertion moves later cells on their pages | a false "changed" alarm in the frame-rect diff | the diff compares by sheet and frame name; page count recorded |
| The watchdog kills a long-running agent | lost work | the brief rules in section 8 |
| `fixmeasure.py` grows | the file-size rule | new code in `fixmeasure_edges.py` |

---

## 12. Decisions (orchestrator, decided 2026-11-15)

| # | Decision | Ruling |
|---|---|---|
| **D-R1** | Chimera P1 | **B**: erase the extra head with keyframe paint, caps `chimera/attack <= 800`, `chimera/hurt <= 600` (FW-PA). If B fails 3 iterations: **D** (drop `dragon2` in atk_mid, atk_follow, hurt_in2) as the interim, and escalate to the user. **0 images**; option A (a 4th image) is not used |
| D-R2 | FW-O keyframe offset (ashen_queen) | **yes**, including `cast: [3, 0]` (rev-13 ruling) |
| D-R3 | FW-C cutter clamp and the offline re-cut | **yes**; white_shark only if the lifted figure fits the large cell (rev-14 ruling); existing raws path, no `--from-cache` (rev-15 ruling) |
| D-R4 | FW-Q per-sequence alias | **yes**; the 6 expected entries pre-allowlisted in G1, unused ones removed in G6 (rev-20 ruling); a sheet that still fails stays keyframe-only |
| D-R5 | astos and warmech daze | **yes**, the default recipe slump, own frames, `check` OK, reviewer yes/no (rev-11 ruling) |
| D-R6 | Accepted-nit list for this round | **accepted as proposed**: stone_golem chest runes, earth_medusa vs medusa similarity, water_elemental size pop and small idle, black_knight darkness, garland smear hook, the N-5 rig nits (sea_snake, purple_worm, sand_worm bud nicks, guardian), plus the **crocodile tip strand by name** if N-1b fails its 3 iterations |
| D-R6b | black_knight ramp-shift exception | **no** |
| D-R7 | earth_medusa regeneration | **no** |
| D-R8 | Dark Fighter `ai.rate` | **0.5** (derived from ogre_mage, horned_devil, death_eye, hollow_seraph_2, chaos); note that dark_wizard has no ai block either and stays Fight-only |
| D-R9 | red_piranha and white_shark in `enemies.yaml` and the bestiary | **yes** (after the re-cut is approved and the integrator's rebuild) |
| Rev 17 ruling | water_elemental bestiary background | the committed id that best fits: **`shoreline`** (measured contrast, section 2 P2-9) |
| Rev 21 ruling | concurrency | G5 split into waves of at most 4; long commands only via `run_in_background` with a poll at least every 5 min |

---

## 13. TODOs

```markdown
## TODOs
- [x] G0: momus review (APPROVE WITH REVISIONS; 22 revisions applied, rev 2) (2026-11-15)
- [x] G0: orchestrator decisions D-R1..D-R9 and the rev 11/13/14/15/17/20/21 rulings recorded (2026-11-15)
- [ ] G1 FW-M2: edges / match / poly / switch / rowspan (+ --vs/--shift/--not-mask) in fixmeasure_edges.py; selftest pins (high, 4h)
- [ ] G1 FW-M2 sweep: top-20 edge-gap frames and the measured command durations into ROSTER_LOG "Fix pass 2" (medium, 0.5h)
- [ ] G1 FW-PA: KF_PAINT_ALLOW chimera attack 800 / hurt 600; selftest_efix equality + 801/601 refusals (high, 0.5h)
- [ ] G1 FW-O: key_offset in MK.apply after drop_raise, before paint_keys; joints/masks/kf paint translated; --raw applies it; kf: locks (medium, 3h)
- [ ] G1 FW-Q: per-sequence alias (hurt or attack in-betweens only); FWQ_ALLOW with the 6 entries; selftest_pages (medium, 2h)
- [ ] G1 FW-C: floating clamp, LIFT_MAX from the white_shark measurement (or 24); selftest_cut lifted == {attack: 7} (high, 2h)
- [ ] G1 exit check: no rig changed, rebuild byte-identical to b6b1346, check --all 112 OK + 9 no rig, selftest --anim (high, 1h)
- [ ] G2: Dark Fighter cur3 -> cure3, ai rate 0.5, spellNames cleanup, name-based cross-file test RED -> GREEN, AI unit test (high, 2h)
- [ ] G2: water_elemental bestiary background -> shoreline (low, 0.5h)
- [ ] G3a: king_mummy staff, clay_golem rune, sea_troll seams, stone_golem seams + spike, ice_gigas strand (medium, 3 iter each)
- [ ] G3b: chimera erase (B; fallback D + escalate), basilisk notch, crocodile 18 px + tip strand (high, 3 iter each)
- [ ] G3c: sand_worm fold, air_elemental crease, earth_medusa rectangle + arm, ashen_queen key_offset re-check (medium, 3 iter each)
- [ ] G3d: red_piranha (and white_shark if it fits) re-cut, review, approve; after G4 rebuild: data entries, rigs (medium, 1d)
- [ ] G4: integrate, rebuild, section 9 validation, frame-rect diff == section 9 list, page count, AGENTS.md, docs (high, 4h)
- [ ] G5 wave 1: warmech (+ daze), water_elemental, horned_devil, black_knight (medium, 3 iter each)
- [ ] G5 wave 2: scorpion, hydra, black_widow, crawler (medium, 3 iter each)
- [ ] G5 wave 3: astos (+ daze) (medium, 3 iter)
- [ ] G6: integrate T-K, rebuild, validation, remove unused FWQ_ALLOW entries (high, 4h)
- [ ] G7: fresh adversarial re-test + regression sample + sweep top 10 + FPS; rows in ROSTER_PLAYTEST.md (high, 4h)
```

---

## 14. Momus revisions (rev 2)

| # | Revision | How it was applied |
|---|---|---|
| 1 | chimera rig line refs | Section 1: `dragon2` masks `:146-148`, `z` `:128-129`, `h4`/`s4` joints `:57-58` and `:92-93` (verified in the rig), plus `a4` `:119`, `dragon2` `:122` and the tweaks `:170`, `:174`, `:186`, in the root cause and fix step 4 |
| 2 | chimera selection and gate | Selection E = opaque px in the `dragon2` polygon minus the `head` and `dragon` masks (F = the hurt's greens inside the head mask, mane fill); primary gate FW-M2 `poly ... --not-mask head dragon` = 0; the greens (66, 82, 49), (99, 132, 74), (148, 156, 90) as the secondary gate with `--not-mask dragon` (the 369 px in box 120 54 168 92 include 9 of the upper dragon); attack erase about 758 + re-ink, about 40 px under 800, with a stop rule |
| 3 | upper-dragon gate | `partc chimera dragon` per frame within +-10 % of its own b6b1346 count (794, 794, 795, 671, 673) |
| 4 | holes gate | `pieces --holes 2` lists exactly the b6b1346 holes (attack 161 @ (116, 52), 14 @ (76, 46); hurt 98 @ (112, 51), 17 @ (78, 43)), recorded in the rig comment |
| 5 | no fallback A | Section 1 and D-R1: B, then D (drop in atk_mid, atk_follow, hurt_in2) and escalation; option A removed from the fix path; worst case 0 images (sections 0, 9) |
| 6 | earth_medusa rectangle location | P2-8: x 35-40, y 31-36, fill x 36-39, y 32-35; 19 ink px in box 35 31 41 37 (measured); selection = its ink lines inside the silhouette; idle gate in that box; idle_b and atk_wind1 through `--vs idle --shift` |
| 7 | earth_medusa hurt_in1 arm | New row P2-8c: spurs 6 vs 1, edge gaps 4 vs 0; gate `edges --vs idle` gaps 0, spurs <= 1, plus the reviewer |
| 8 | crocodile tip strand | New row N-1b with a gate (`edges ... --box 15 36 30 47`: bare ink 0 from RED 5, spurs 0) inside the 220 cap; named in D-R6 if it fails |
| 9 | black_knight sign | Section 5: the attack key at (+4, -1) relative to idle (IoU 0.588, centroid 5.7 / 6.0); `atk_follow` attack dx +2, `atk_recover` idle dx -2, tune dy; the 0.3 px margin noted |
| 10 | per-frame T-K tables | Section 5: one row per sheet and sequence with every frame's (dx, dy), the key-switch offset d and the weakest pair against need and cap; warmech at (-24, 0) (0.463, 18.8 / 19.1; (-25, 1) and +8 fail), hurt (-16, 0) (0.584, 9.6 / 15.0); every table confirmed by `fixmeasure.py switch --rig` before iterating |
| 11 | daze recipe | Rev-11 ruling: astos and warmech use the default recipe slump (legs pinned), own frames, `check` OK, reviewer yes/no; "as in 12c" removed |
| 12 | FW-PA concrete edits | FW-PA: `KF_PAINT_ALLOW` at `monster_keys.py:23`; the equality at `selftest_efix.py:360-361`; refusal cases 801 / 601 (and chimera idle) |
| 13 | FW-O hook and scope | FW-O: in `MK.apply` after `drop_raise` (`:106`) and before `paint_keys` (`:109`); `--raw` applies the offset; keyframe joints, `masks.*.<key>` polygons and keyframe paint translated; in-between paint re-derived by the rig agent (`ashen_queen.yaml:257-`); `cast: [3, 0]` added (ruling) and cast in the `rowspan` gate; the lock writer adds `kf:<key>` |
| 14 | FW-C pre-measure | Section 6 table: red_piranha lift 0 / 7-8 (heights 51 / 51 / 50; momus 51 / 52 / 51); white_shark 33-34 / 34-36 (46 / 79 / 81 native, scale 1.185); LIFT_MAX per the ruling (measured fit, next multiple of 4, comment; else white_shark deferred); acceptance "red_piranha clipped == []; white_shark re-cut or deferred with the measured lift"; the selftest's exact expected value `lifted == {"attack": 7}` |
| 15 | raws exist | Section 6: the out-dir raws are used with the existing `--repixelize`; `--from-cache` dropped |
| 16 | king_mummy RED | P2-3: RED 7 (hurt) / 5 (hurt_in2) in box 49 20 53 48 pinned; rows y 20-27 hold 28 ink + 1 gate-colour px |
| 17 | water_elemental key and target | P2-9: `backgrounds.enemies.water_elemental: waterfall` (`bestiary.yaml:27`) -> `shoreline` (committed; measured contrast) |
| 18 | D-R8 and Dark Fighter behaviour | Section 7: rate 0.5 and its derivation; only `cur3` has an equivalent; she casts CUR3 at the most hurt ally even at full HP (G7 probe adjusted); the cross-file test is name-based (display name vs `spells.yaml` `name`) |
| 19 | swimmer data fields | Section 6 "Data and atlas": num 52 / 94, stats and reward fields from the ROSTER_PLAN spec rows, sprite, size, family, attack, bestiary background `ocean`, placement none; entries land after the integrator's rebuild (G4); `monster_pages.py:29`, `:35` list both mid-group, so later cells move: page count recorded, AGENTS.md updated, the frame-rect diff by name |
| 20 | FW-Q scope | FW-Q: only `hurt_in1`/`hurt_in2` or the five attack in-betweens are aliased; daze and the other sequences stay generated; the 6 entries pre-allowlisted in G1, G6 removes unused ones (ruling) |
| 21 | concurrency and durations | Section 8: G5 in waves of 4 / 4 / 1; long commands only via `run_in_background` with a poll at least every 5 min; durations listed (`check --all` 8-12 min; estimates for `selftest --anim`, the build and `vitest`, recorded for real in G1) |
| 22 | G1 exit check | Section 8: no rig changed (`git diff --exit-code` on the rig and lock files), rebuild byte-identical to b6b1346, `check --all` 112 OK + 9 no rig, `selftest --anim` |
| Non-blocking | fixmeasure size; P2-6 spike gate; sweep findings; N-5 sheets | New subcommands in `fixmeasure_edges.py`; P2-6 gets a bare-ink gate in the shoulder box (the pieces gate passes today and is dropped); sweep findings go to D-R6 or a later round; N-5's sea_snake, purple_worm and guardian are listed as conditional changed sheets |

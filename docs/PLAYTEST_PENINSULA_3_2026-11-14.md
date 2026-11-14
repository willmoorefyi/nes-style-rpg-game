# Peninsula (act 1): third adversarial playtest, 2026-11-14

**Status:** remediated by pass U (`r-integration` `9e8bbca`). Results, open items (U19, M7, W14) and follow-ups: "U result" in `docs/FIX_PLAN_PENINSULA.md`.

**Tested:** `r-integration` `3f65301`-merge (all of tranche R: R0–R6 plus the review fixes), in a real browser.

**Method:**
- Every "Browser:" check in the R plan, scenario by scenario.
- One full play from New Game, with no debug scenario: shop, save, temple, Garland, rescue, King, INTRO_COMPLETE, save/load and Game Over → Retry.
- The tester played as an adversarial modern-RPG player.
- Evidence is in `/tmp/rval/` (local, not committed). Console: 0 errors and 0 warnings over 164 messages.

**R result:**
- 49 planned browser checks pass.
- Partial: B11 and B14.
- Marginal: W1, which is legible but small.
- Not run (run in U validation): M7, M9, M11, W7, W10, W14, W15, `r_temple_party`.
- B8's DARK "the wolf is unaffected" is a resist roll on an all-enemy spell, which is FF1 behaviour and not a defect.

**Severity:**
- **B:** blocker
- **M:** major
- **m:** minor
- **p:** polish

**Totals:** 0 B, 1 M, 11 m, 10 p = 22.

| ID | Sev | Issue | Repro / evidence |
|---|---|---|---|
| U1 | M | **Early act 1 is harsher than a modern player expects.** <ul><li>A Lv1–2 party in shop gear loses members to ordinary temple and approach packs (4 Skeletons, 3–4 Gr.Imps).</li><li>Garland's 2-hit attack (35–47) one-shots the Thief and both mages at Lv2.</li><li>The tester lost to Garland 3 times at Lv1–2 with a 400 G kit.</li><li>The balance test says only 51 % for "sensible Lv2, 400 G kit". The ≥ 80 % bound assumes a full kit and 3 potions, which a first-time player doesn't have.</li></ul> | Part 2 run; `tests/balance/garland.test.ts` |
| U2 | m | **A confirm press leaks into the next scene.** Pressing Z twice within about 20 ms at the title opens party creation and picks Warrior. | `s3_newgame.png` |
| U3 | m | **The melee lunge moves only sideways.** The attacker stays on its own row, so the weapon meets the middle-row enemy when the target is in the top row (B11 follow-up). | `b11c_2.png` |
| U4 | m | **Retry Battle can trap you.** It restores the doomed pre-battle party (KO'd and 1-HP members) with no hint to heal or load instead. | Garland loss 2 |
| U5 | m | **After a battle the field leads with a fallen member.** The sprite is the KO'd FGHTR. | `p2_stuck.png` |
| U6 | m | **The Load confirm defaults to Yes,** even though "Progress since your last save is lost". | `s1_load_prompt.png` |
| U7 | m | **The name grid's X is a backspace, and mashing X leaves party creation for the Title.** A part-typed name ("FGHT") survives into the next New Game. | `n1_x2.png` |
| U8 | m | **Field item targeting starts on member 1,** while battle starts on the most hurt. | `m_e6.png` |
| U9 | m | **Three wordings for one event,** in odd windows. <ul><li>The chest says "You found a Potion!" in its data but shows "Found Potion!". The full-bag line is "You found Potion, but you can't carry…".</li><li>The shop's "can't carry" shows in the gold window.</li><li>Equip's "No room for Rapier." shows in the stats window.</li></ul> | `m_e1b.png`, `e1_unequip_result.png` |
| U10 | m | **The shoreline backdrop's top enemy row stands in a haze of water and rock,** and the composite seam shows (B14 follow-up). | `b13_r_shoreline_nine.png` |
| U11 | m | **Buying gear offers no "equip now",** so kitting out 4 members takes many menu trips. "weight 8" in the help text isn't explained. | Part 2 shopping |
| U12 | m | **Mashing confirm after the ending talks to the King again** at once. Dialog close has no cooldown. | Part 2 ending |
| U13 | p | **In battle, Magic always asks for the spell level** ("Lv1 (2)"), even with only one level learned. | |
| U14 | p | **THIEF's Item command isn't greyed** when the bag has no battle items. | `m_b5.png` |
| U15 | p | **The turn list never names targets, and its `*` kill marker is unexplained.** | `m_b12.png` |
| U16 | p | **The opening's "The world is veiled in darkness" plays over a bright, sunny forest.** | `m_n2.png` |
| U17 | p | **The bridge says "builders are at work", but none are drawn.** | `t1_after.png` |
| U18 | p | **The hero can stand on the throne dais** between the King and the princess. | `m_t2d.png` |
| U19 | p | **The temple icon is small and dark against the mountains, and the hero covers its door on the warp tile** (W1 follow-up). | `m_w1.png` |
| U20 | p | **The field menu cursor remembers its last row.** With wrap-around this opened the wrong screen several times. | Part 2 |
| U21 | p | **The `river` battle backdrop (forest river) puts enemies in the water.** Act 1 can't reach river terrain on foot. | `s6_title_after.png` |
| U22 | p | **The name-entry ▼ "more" marker is tiny.** | `i2_marker1.png` |

## Triage defaults (orchestrator)

1. **U1:** keep Garland as the "real check", but tune it to the kit a first-time player actually has: the 400 G shop kit, no grinding beyond the temple run.
   - **Garland's numbers** (attack, HP, hits) are set so that:
     - sensible Lv2 with the 400 G kit wins **≥ 70 %**;
     - sensible Lv1 with the 400 G kit wins **25–55 %**;
     - careless Lv1 with no gear wins **≤ 10 %**;
     - a full-HP Lv2 W.MAG or B.MAG in cloth survives one 2-hit attack in **≥ 90 %** of rolls.
   - **The temple table** loses its 4-skeleton top end.
   - **The temple run then Garland,** sensible play at Lv2 with the 400 G kit, wins **≥ 70 %**.
   - This moves Garland partway back toward FF1, and it is reported to the user.
2. **U20 and U21 are won't-fix, with reasons:**
   - U20: modern RPGs remember the menu cursor, and holding a direction already stops at the ends.
   - U21: no act-1 terrain shows the `river` backdrop. It stays on the "recorded" list.
3. **U19:** the temple art is fixed at its approved size. Brighten it one more step only if a 0.25-scale preview shows it below the city's luma. Standing on the warp tile hides the door by design, because the warp happens on arrival.
4. **U17:** two worker NPCs are drawn at the bridge from INTRO_COMPLETE on, using existing sprites. There is no new art.
</content>
</invoke>

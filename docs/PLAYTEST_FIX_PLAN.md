# Playtest fix plan (pass W, PLAY)

Consolidates `docs/PLAYTEST_FIXLIST_PLAY1.md` (S0-S10), `PLAY2.md` (S11-S22), `PLAY3.md` (S23-S31) and the geography walk
(PLAY-G, below). No P0 or P1 was reproduced in any segment. Written 2026-11-18 on mainline after the Excalibur merge
(Smyth forges as soon as the adamant is brought; PLAY-3 tested the old gated behaviour, so its S31 notes are obsolete).

## Geography walk (PLAY-G; the report was lost with `/tmp`, this is its summary)

Every location sits where a classic player expects; every travel requirement matches; fitted scale 0.736, all 31 pair
ratios within 0.86-1.16, largest bearing error 21 degrees (act-1-frozen Matoya). Findings:
- G-1 (P2, looks): landmasses read as rectangles from the air (the Crescent continent with straight coasts; the two southern deserts are sand rectangles split by a straight column at x 132; Pravoka's range is a ruler-straight strip x 136-141, y 76-145; the western and north-western continents have straight coasts).
- G-2 (P3): the canal is a perfect 2-row rectangle (x 49-61, y 92-93); same as P1-1-10.
- G-3 (P3): bearing drifts of 12-19 degrees (Marsh Cave from Elfheim WSW not SW; Ice Cavern from Crescent SSW not SW; Lufenia from Gaia S not SSE). Within bands; leave.
- G-4 (P3): placeholder landmark art visible from the air (known list in AGENTS.md).

## Tranches

### FX-A: act-1 and Elfheim text and test data (data and dialogue only)
- P1-1-02 (P2): the King (21,8) and chancellor (18,10) in `cornelia-castle-2f` still say the builders are at work after BRIDGE_BUILT; give them post-bridge lines.
- P1-1-03 (P2): pirate count (nine and a Captain vs nine pirates and no captain): make the lines match the fight.
- P1-1-06 (P3) and P3-07 (PLAY-3): gift lines read "... Received the Herb." / "Received the Mystic Key." glued to speech, and Smyth's Excalibur has no pickup line: use the shared pickup text consistently.
- P1-1-07 (P2): before the Marsh Cave the Western Keep 2F throne is empty while the 1F courtiers say the king sits there: make the 1F lines conditional on MARSH_GUARD_DEFEATED (or seat the king).
- P1-1-08 (P2): `w_s5_start`, `w_s6_start`, `w_s6_neg_nocrown`, `w_s10_start`, `w_s10_neg_notnt`, `w_s12_*` miss GOT_LUTE and/or the `lute`.
- P1-1-11 (P3): the herb-crushing line is said twice (`elf_prince_wakes`).
- P3-10 (PLAY-2): the Warp Cube pickup line plays before the lines that say the cube leaves the automaton's hands.
- P3-06 (PLAY-3): the ending is a single dialog line; the plan says `end_game` shows the card: add a fade and card.

### FX-B: balance and economy (investigate first; report before big changes)
- P1-1-04 (P2): the pirate fight is won by pressing Fight alone at level 3; P1-1-05 (P2): Iron Sword 175 G (attack 14) is almost as good as the Short Sword and Hand Axe at 550 G.
- P1-1-09 (P2): the piscodemon x3 fight is a coin flip for a Fight-only level-8 party and nothing in the cave hints at magic and potions. Add an in-cave hint NPC or a signpost; keep the fight's win rate bounds.
- P1-1-12, P2-02 and P3-02: gold balloons (the Western Keep pays 1,200 to 7,061 G in one visit; dungeons add 12-72k G per pass; the Mirage Tower about 5,000 G a fight). Compare our per-enemy gold and the shop prices with FF1's, enemy by enemy and zone by zone (INT-W2c's `xp_compare.md` method). If we match FF1, leave it as designed and say so; if we are well above, lower gold rewards or raise prices so the 40,000 G bottle and Crescent's gear matter. Report numbers to the integrator before changing more than a handful of records.
- P3-04 (PLAY-3): the five past-temple fights (four refights and Death Eye) are soft at L34 for a Fight-mashing party; P3-03: Warmech wins 3 of 3 without a KO. Tune toward the plan's win-rate bounds (WORLD 3.7), keeping the seeded balance tests within the 3-point rule.

### FX-C: engine and encounters (src/)
- P2-01 (PLAY-2): the step that switches between land and canoe looks up the encounter before `FieldVehicles.afterStep` changes the mode, and river cells are gaps in the walking zones, so the act-1 goblin/wolf table fires (8-HP goblins at level 21-24, seen at (131,150) and (150,148)). Also canoe-reachable lake cells with no canoe zone ((29-33,4-6), (155-157,10), (20-22,20-21)) always roll the act-1 table. Fix the lookup order and add zones for the gap cells; add tests.
- P3-03 (PLAY-2): NPCs that appear on a flag (the sleeping giant after TITAN_FED, `bahamut_after`) are drawn only after the map is re-entered: refresh NPC visibility when a flag changes.
- P1-1-01 and P3-07 (PLAY-2): the game dropped to the Title or a black screen on its own 5 times in early runs (one with a real page reload), never in about 30 later traced runs. Investigate with the scene-change trace; if it cannot be reproduced, close it as a probable dev-server reload during machine sleep, and keep the trace behind a debug flag.
- P3-06 (PLAY-2): a 30 ms direction tap does not turn the hero, so tap-then-confirm does nothing. Probably a bot-timing artefact: check the input hold-off logic and close or fix.
- P3-01 (PLAY-3, unconfirmed): one boarding of the submarine did nothing on a single tap; same check.

### FX-D: world art (organic coastlines and canal)
- G-1: reshape the rectangular coasts, deserts and ranges with the organic terrain tools act 1 uses (`tools/terrain/`), keeping every landmark, anchor, travel route, dock and basin cut (proofs (g) and (h), `world.py --check-bands` and `basins: OK`, the frozen core) intact. One world compile at a time.
- P1-1-10 and G-2: make the canal read as a dug cut with banks and a lock gate at the ends (WORLD 4.3).
- P3-04 (PLAY-2): the niche chest in `ice-cavern-b3` (38,8) sits on a flat pure-white tile.
- P3-13 (PLAY-2): Melmond's and Onrac's overworld icons read as single houses, not towns.

### FX-E: hints and UX (dialogue and signage)
- P2-09 (PLAY-2): at the caravan, talking to the trader is the purchase (41,000 G drops to 1,000 G with no confirmation and no "paid" line): add a yes/no prompt and a "paid" line. Check how other shops confirm, and keep the verifier's `takeGold` modelling intact.
- P3-12 (PLAY-2): nothing in the Citadel says which 2F pads lead on (2 of 6 do): add one hint line.
- P3-05 (PLAY-3): `past-temple-2`'s two east chests are reachable only from floor 1's second stair and nothing points there: add a hint.
- Sky castle 2F: no sign says which belt leads where: add one hint.
- P3-11 (PLAY-2): the step onto the river without a canoe is silently refused: add a short line.

## Deferred (need the user)
- Placeholder art (DP, BH, WM, TW, CM, VO, SH, WF, TE, DO, IF, SR, the tuft part, the fairy and mermaid sprites): a paid art pass.
- The cheats menu (XP and gold boost).
- The Melmond pond elder, the Crescent wanderers and the Earth Cave annex chests (2,26), (6,28) were not reached by a playtest bot; a manual look.

## Process
Each tranche works in its own worktree off mainline, adds tests for each fix, and runs: `npm run quest -- --mutate` (the
strict run before the final merge), `npx vitest run --maxWorkers=2 --minWorkers=1`, `npm run build`, region determinism,
and a browser re-check of the cited repro. World compiles are one at a time under the lock. Merge order: FX-A, FX-E, FX-C,
FX-B, FX-D (the world art last, because it touches the most generated files).

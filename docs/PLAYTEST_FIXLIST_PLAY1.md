# PLAY-1 fix list (pass W, stages S0-S10)

Playtester PLAY-1, branch `w-play1` from mainline 64be8290. Dev server port 5244, `mute=1` on every URL, own headless Playwright
(keyboard input like a player), scripts under /tmp/w-play1/. After a reboot wiped /tmp, everything was re-run from scratch for
S5-S10; S1-S4 and S7 were run before the reboot. Screenshots are under /tmp/w-play1/shots/ (the earlier ones were lost in the wipe).
Simulated parts (said where they matter): between-fight healing in the S5/S6/S10 walks (a player would use Cure, potions or an inn),
random battles fought by pressing Fight (confirm) only, no suppression of encounters except in one boss-only retry run.

## Findings

Severity: P0 blocks progress or crashes, P1 serious/wrong-side/unfair, P2 noticeable, P3 polish. No P0 or P1 was reproduced.

| id | sev | stage | where | steps to reproduce | expected | happened | screenshot |
|---|---|---|---|---|---|---|---|
| P1-1-01 | P2 (unconfirmed; P0 if it recurs) | S4, S5, S8 | `elfheim`, `marsh-cave-b*` | Early runs (before the reboot): `w_s4_start`, sail to Elfheim, talk to NPCs; `w_s8_start` Elfheim; `w_s5_start` Marsh Cave B1/B2 | the game stays in the exploration scene | Three times the game ended on the title screen by itself (one with a real page reload). No console error. After adding scene-switch and page-reload tracing, about 15 further browser runs over the same maps (S4-S10) had no drop; the only `switchTo` logged was `gameover` after a lost boss fight. So not reproduced. Possibly caused by several agents' dev servers and the machine sleeping. Re-check on a quiet machine | /tmp/w-play1/shots/s4_elfheim_after.png (lost in wipe) |
| P1-1-02 | P2 | S1 | `cornelia-castle-2f`, King (21,8), chancellor (18,10) | `w_s1_start`; talk to the King (bridge order plays), then to the foreman (`overworld`, (92,97)), return and talk to King and chancellor | after BRIDGE_BUILT their lines move on | They still say "My builders are hard at work on the bridge" / "The King's builders are at work on the bridge to the north". Only the bridge workers' lines change | - |
| P1-1-03 | P2 | S2 | `pravoka` `pirate_den_b` (21,35), `bikke` (40,33); battle `pirate` x9 | `w_s2_start`, talk to both, fight | counts agree | `pirate_den_b`: "Nine of us, and the Captain makes ten"; Bikke: "nine blades"; the battle has 9 pirates and no captain | s2_battle_mid.png |
| P1-1-04 | P2 | S2 | battle vs the nine pirates | `w_s2_start` (L3 kit, 600 G), talk to Bikke, press Fight every turn | a band 3-6 boss that takes some play | Won at once by mashing Fight, party left at 60/61, 27/41, 31/37, 28/37; gold 600 to 960. Trivial for the band | s2_battle_mid.png |
| P1-1-05 | P2 | S2 | `pravoka_weapon` shop | open the weapon shop | price follows power | Iron Sword 175 G (attack 14, crit 10) is almost as good as Short Sword 550 G (15) and Hand Axe 550 G (16); the 550 G items are never worth buying over it | - |
| P1-1-06 | P3 | S7, S8 | `matoya-cave` Matoya (9,5) cutscene `a1_matoya_sight`; `elfheim-castle-chamber` prince | `w_s7_start`, talk to Matoya; `w_s8_start`, use the herb on the prince | gifts use the shared pickup line as their own message | Both end with "... Received the Herb." / "... Received the Mystic Key." glued onto the last speech line instead of the standard pickup message | - |
| P1-1-07 | P2 | S6 | `western-keep-2f`, `false_king` (14,7) has `showIf: MARSH_GUARD_DEFEATED`; 1F `courtier_vell`, `gate_warden` | `w_s6_neg_nocrown`, delete the flag MARSH_GUARD_DEFEATED in the console (test harness), enter the keep: 1F lines, then 2F | the throne is occupied, as the 1F lines say | **Confirmed.** Before the Marsh Cave is cleared the 2F throne room has no king: 1F says "The king has not left his chair" and "He will see no one who comes without [the crown]", but 2F holds only a mirror, a page and two chests. A player who walks to the keep first finds an empty throne and no pointer | s6pre_2f.png |
| P1-1-08 | P2 | test data | `assets/data/debug-scenarios.yaml`: `w_s5_start`, `w_s6_start`, `w_s6_neg_nocrown`, `w_s10_start`, `w_s10_neg_notnt`, `w_s12_*` flags/items | start any of them | every prerequisite of the stage (S0 grant: GOT_LUTE flag and `lute`), as in `w_s4_start`, `w_s8_start`, `w_s9_start` | They lack `GOT_LUTE` and the `lute` item (S5 and S6 also omit the lute item; S10 has `lute` but no GOT_LUTE). Not a gameplay bug, but those scenarios do not hold every earlier grant | - |
| P1-1-09 | P2 | S5 | `marsh-cave-b3` bier (7,4), piscodemon x3 | `w_s5_start`, walk B1, B2, B3 pressing Fight on every battle, take the crown | a boss fight a band-low (L8) party can win with sensible play | With Fight only the party lost 2 of 3 tries (the first at about half HP, the second after a full heal; a third try with full HP won first time). The wipe goes to the game-over screen with no warning. The plan's own G10 note records 7 losses before a win. If the intended play is magic and potions, nothing in the cave tells the player so (no healing spot, B2/B3 not saveable) | s5_boss.png |
| P1-1-10 | P2 | S10 | `overworld` canal cells (49..61, 92..93) | `w_s10_start`, give TNT to Nerrick, board the ship at (59,104), sail to (61,92), then west | the canal reads as a dug cut with banks and a lock gate (WORLD 4.3 landmarks) | Plain flat blue 2-cell-high rectangle with hard vertical seams where it meets the sea at both ends; no banks or lock gate. Sailing works (CANAL_OPEN, ship reached (44,98) in the ocean) | s10sail_55_92.png |
| P1-1-11 | P3 | S8 | `elfheim-castle-chamber`, `elfheim_prince` (7,4), cutscene `elf_prince_wakes` | `w_s8_start`, use the herb | one description of the crushed herb | The NPC page 1 says "You crush a leaf beneath his nose..." and the cutscene's next line repeats "You crush a leaf of Matoya's herb under the prince's nose" | - |
| P1-1-12 | P3 | S5-S6 economy | gold income vs Elfheim prices | `w_s6_start` (1200 G), walk 1F and 2F, fight Astos | gold of the same order as the shop prices | 1200 G becomes 7061 G within one keep visit (about 4 battles and Astos). Elfheim's whole stock (mythril sword 4000, great axe 4500, mythril mail 3500) is then affordable at once; Marsh Cave alone gives about 2,000 to 3,400 G | - |

## Checked and fine

- **S1** (`w_s1_start`): King's `act1_complete` cutscene (fade, INTRO_COMPLETE), foreman `a1_bridge_finished` with the lute, BRIDGE_BUILT set; party stood on the former gap cell (93,94) and walked on to (93,90). Art of the rebuilt span is good (s1_on_gap.png). 0 console errors.
- **S2** (`w_s2_start`): the 7 pirate NPCs and Bikke, `a1_bikke_yields`; BIKKE_DEFEATED; pirates removed, dockhands back; the brig drawn at the dock (132,102); stepping onto it gives mode `ship`. Town hint NPCs (old sailor, herb wife) point to Elfheim and Matoya clearly.
- **S2 negative** (`w_s2_neg_noboss`): no ship; the party could not step onto water.
- **S3** (`w_s3_start`): walked from `north_shore` through the woods to (74,75) and entered `matoya-cave`; Matoya and the three brooms talk, with fitting lines.
- **S4** (`w_s4_start`): boarded the brig, sailed 98 steps with 5 sea battles to `elf_port` (84,147), landed at (84,148), entered `elfheim`.
- **S5** (`w_s5_start`): B1 (chests, Fenwarden hint), west stair to B2 (3,5), stair to B3 (30,27), three chests, bier starts the 3x piscodemon fight, win gives `crown` and MARSH_GUARD_DEFEATED (one winning try). B2 east half (`arrival_east`): its two chests (Ether (37,14), Power Staff (26,25)) are reachable and the east half drops into B3 at (30,7) through the pit; the west-half chests (niche, alcove) are not reachable from the east, as designed.
- **S6** (`w_s6_start`): 1F chests and talk; 2F false king takes the crown (`elf_o_crown_taken`), Astos and three gargoyles fight (palace background, art fine), win gives ASTOS_DEFEATED and `crystal_eye`; the crown is removed.
- **S6 negative** (`w_s6_neg_nocrown`): no battle; the king's line asks for the crown.
- **S7** (`w_s7_start`): Matoya takes `crystal_eye`, gives `herb`; her after-line and the broom lines change.
- **S8** (`w_s8_start`): Elfheim hint NPCs, steward/nurse lines react to the herb, using the herb sets PRINCE_AWAKE and gives `mystic_key`; the herb is consumed; NPC lines change after.
- **S9** (`w_s9_start`): the vault gate opens with the key (ELF_T_VAULT_OPEN), three chests, `tnt` held.
- **S10** (`w_s10_start`): Nerrick takes the TNT (`ert_canal_blast`), CANAL_OPEN, the ship sails 61,92 to 49,92 to the ocean at 44,98.
- **S10 negative** (`w_s10_neg_notnt`): the ship stops at (62,92) at the isthmus coast; no path west.
- No console errors or warnings (other than GPU driver messages) in any run. Battles loaded without a visible hitch. The canal, bridge, Matoya and Elfheim hint text all let a player work out the next step from in-game lines.

## Originality spot-check (QUEST 4.6)

Story beats and names follow the classic order on purpose (the project allows classic names). Wording, rooms and NPC lines are original. Closest to the classic: Matoya's dancing brooms and "the herb for the prince", the nine pirates, Astos and the crown, and the dwarf TNT. None is a copy of the classic text. Nothing to change.

## Not run

Shop price checks by buying were not done (prices read from data). The three title-screen drops (P1-1-01) could not be reproduced.

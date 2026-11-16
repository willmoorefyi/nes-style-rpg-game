# Roster adversarial visual play test (pass R, plan section 11), 2026-11-15

Scope: all 88 `enemies.yaml` entries (84 sheets) on `roster-int` at 5e2dd77, bestiary and 26 sandbox formations.
Evidence (local, not committed): `/tmp/vpt/` (`best/<id>_screen.jpg`, `best/<id>_fNNN.png`, `z_*.png`, `bt/`, `strips/`, `atlas_check.txt`, `groups_*.png`, iou output).
No console errors, no missing art, no text overflow in 88 bestiary entries and 26 battles. FPS median 120 (p2 ~106) incl. 9-crowds.

## OK (65)
goblin, gr_imp, wolf, skeleton, pirate, mummy, werewolf, zombie, ghoul, lizard, sahagin, sahagin_chief, buccaneer, bigeyes, tarantula, ghast, shadow, green_slime, gray_ooze, gargoyle, bloodbones, piscodemon, wraith, anaconda, hyenadon, hill_gigas, earth_elemental, wight, ochre_jelly, ogre_mage, sphinx, white_crocodile, neochu, pyrolisk, fire_hydra, hellhound, fire_gigas, white_dragon, winter_wolf, mindflayer, specter, remorazz, dark_wizard, desert_baretta, wyvern, wyrm, manticore, dragon_zombie, ashen_queen_2, drowned_sovereign_2, hollow_seraph_2, shark, ogre_chief, crazy_horse, cockatrice, plus the keyframe-only sheets.

Keyframe-only (no in-betweens, known): astos, black_widow, crawler, horned_devil, hydra, scorpion, warmech (astos and warmech also lack daze).
Intentional: cockatrice/slime hurt feathers and droplets; ogre_chief helm flying off in hurt.

## Defects

| # | Sev | Kind | Enemy | Defect | Repro (`http://127.0.0.1:<port>/?mute=1&...`) | Evidence |
|---|---|---|---|---|---|---|
| 1 | P1 | runtime | chaos, hollow_seraph, warmech, drowned_sovereign, garland, lich | A boss (200 px cell) lunging at the top hero rises to y≈100-118 and its fists/wings clip under the top message window | `sandbox=l30_lich&enemies=chaos&enemyAnim=loop` | z_b15.png, z_b9.png, bt/B5_*, B6_*, B7_* |
| 2 | P1 | layout | ogre, troll (large crowds) | 8-9 large enemies fall to scale 1: ogres/trolls smaller than scale-2 goblins | `sandbox=l30_lich&enemies=ogre,troll,dragon,crazy_horse,gigas_worm,ogre_chief,shark,anaconda,minotaur` | bt/L1_full.png |
| 3 | P1 | art | lich, lich_2 | Hurt keyframe changes identity: skull to right shoulder (two heads), spiked helm top centre, crown gone; also clips top window in battle | `bestiary=lich&battleStep=1` | z_lich.png |
| 4 | P1 | art | crocodile | Hurt / hurt_in2 tail torn, forked, holes | `bestiary=crocodile&battleStep=1` | z_croc_hurtseq.png |
| 5 | P1 | rig/art | hollow_seraph | attack_raise, atk_raise_b, atk_swing: right-side wings vanish (~3 of 6 show); flat pale-cyan block behind the helm | `bestiary=hollow_seraph&battleStep=1` | z_sera.png |
| 6 | P1 | rig | ice_gigas | Axe pops 23 px from right shoulder to left between hurt_in1 and hurt_in2 | `bestiary=ice_gigas&battleStep=1` | strips/ice_gigas.png |
| 7 | P1 | art/rig | garland | cast_rise, cast_release, cast: white/lavender crescent hole on left hip; atk_swing2: detached white blade sliver near right cell edge | `bestiary=garland&battleStep=1` | z_gar.png |
| 8 | P2 | scale | minotaur, dragon | minotaur 88 px, dragon 54 px tall vs other large enemies; dragon attack 1-3 px from cell edge | - | groups |
| 9 | P2 | distinctness | gigas_worm vs lava_worm; gr_wolf | Worm silhouettes IoU 0.81 (roster max); gr_wolf very dark on shore background | - | iou output, bt/st1_29_crop.jpg |
| 10 | P2 | art | vampire, cobra | Vampire idle face unreadable (dark band, flat pale face); cobra idle head reads as a hood blob | - | z_vamp.png, strips/cobra.png |
| 11 | P2 | art | drowned_sovereign | Robe hems curl like tentacles; cast tentacle tips saturated royal blue (off-style) | - | bt/B5_* |
| 12 | P2 | small | various | ochu stray light/pink tendril-tip pixels + light outline segment; fire_elemental rose patch at elbow (atk_mid); death_eye pupil fragments in daze and art touches bestiary panel border in lunge; evil_eye cone tail only in attack; ogre/troll club/arm pop in atk_recover; ashen_queen tail curls separately in hurt; ankheg, crawler, dragon, gigas_worm, lesser_tiger attack within 1-3 px of cell edge; 18 sheets' cell bounds cross the bestiary panel right edge in lunge (only death_eye's art touches) | - | z_ochu.png, strips, atlas_check.txt |
| 13 | P2 | style | sabertooth, fire_lizard | Flatter / less detailed than the roster | - | groups |

## Cross-roster
- Atlas checks clean (no partial alpha, magenta, off-palette, specks, spill, overlapping rects, stray page pixels; outline coverage ~100 %, ogre 0.97).
- Only silhouette pair above the 0.75 watch line: gigas_worm/lava_worm 0.81; none at 0.85.
- Multi-limb reads correct: ashen_queen 6 arms, both hydras 3 heads, chaos 4 arms.
- Status: sleep Z + daze verified on ogre, cockatrice, gr_wolf, hydra; immune green slime shows "unaffected". Stone and poison on enemies not testable from the party (no infliction source).
- Draw order: the lunging enemy draws on top; melee contact vs the warrior correct.

## Re-test (F6), 2026-11-15

Scope: `roster-int` at 3e50493 (121 sheets, 9 pages). Fresh tester, own dev server and headless Chromium (Playwright script), every URL with `mute=1`.
Evidence (local, not committed): `/tmp/vpt2/` (`strips/<id>.png` every atlas frame at 2-3x, `z_*.png` zooms, `sib_*.png` sibling sheets, `bt/A_<boss>/` and `bt/M_<boss>/` boss lunges (step loop and real fights), `bt/B1..B5/` mixed formations, `bt/L1_0000.jpg` 9-large crowd, `best/<id>_*.jpg` bestiary, `p_*.json` / `m_*.json` / `best_*.json` per-frame sprite bounds, `keycmp.txt`, `check_all.txt`, `roster_report.txt`, scripts `keycmp.py`, `regress.py`, `ana.py`, `anab.py`, `js/*.js`).

Automated pre-pass:
- `monster_anim.py check --all`: 112 `OK`, 9 `no rig` (astos, black_knight, black_widow, crawler, horned_devil, hydra, scorpion, warmech, water_elemental). Nothing else.
- `monster_roster_report.py`: no "reads as a recolour" flag (silhouette >= 0.85 and edge >= 0.60). Watch list: green_slime/black_flan 0.88/0.26, medusa/earth_medusa 0.83/0.37, gigas_worm/purple_worm 0.83/0.49, gigas_worm/lava_worm 0.82/0.53, clay_golem/stone_golem 0.80/0.40, stone_golem/iron_golem 0.78/0.42, lava_worm/purple_worm 0.76/0.43, plus same-body pairs at 0.75-0.80 (golems vs ogres/trolls). Judged at 2x side by side (`sib_*.png`): all distinct except medusa/earth_medusa (B table).
- Atlas vs old atlas (`regress.py`, 5e2dd77 vs 3e50493): 70 of the 84 old sheets are byte-identical in every frame. Only the 14 targeted sheets changed (ashen_queen, cobra, crocodile, death_eye, drowned_sovereign, fire_elemental, garland, hollow_seraph, ice_gigas, lich, ochu, ogre, troll, vampire), and in each only the frames the fix plan names. 37 new sheets.
- Keyframes vs approved PNGs (`keycmp.py`, every sheet, idle/attack/hurt/cast/raise): pixel-identical except the intended FW-P paints: cobra 1-3 px, vampire idle 8, ochu attack 23, crocodile hurt +144 px (tail fill), garland cast 120, drowned_sovereign cast 297. hollow_seraph and warmech sit in wider cells (218 / 232) and are identical at their offset.
- No console errors or warnings (other than the GPU ReadPixels notice) in 46 bestiary entries, 9 step-loop boss runs, 7 real boss fights and 7 formations.

### A. Fixed items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Boss lunge vs the top message window (bottom y 120) | **FIXED** | Highest opaque pixel over a full loop (`sandbox=l30_lich&enemies=<boss>&enemyAnim=step`, 300 frames): chaos 124, hollow_seraph 121, warmech 124, drowned_sovereign 148, garland 128, lich/lich_2 124, death_eye 137, ashen_queen 124. Real fights at `sandbox=l2_temple&enemies=<boss>` with heroes dying under the lunge (WAR fell, WHM fell): chaos 137, hollow_seraph 121, garland 168, lich 126, others lower. `p_*.json`, `m_*.json`, `mm_chaos.jpg` |
| 2 | 8-9 large enemies drop to scale 1 | **FIXED** | the play-test formation (ogre, troll, dragon, crazy_horse, gigas_worm, ogre_chief, shark, anaconda, minotaur): every sprite at scale 2 and no overlap at rest. `bt/L1_0000.jpg`, `p_L1.json` |
| 3 | lich / lich_2 hurt identity (lich_2 uses the lich sprite) | **FIXED** | hurt_in1, hurt_in2, hurt: one skull, centred, crown kept. In battle the hurt stays below the window. `z_lich_idle.png`, `strips/lich.png` |
| 4 | crocodile hurt tail | **FIXED** | no holes, forks or tears in hurt_in2 or hurt. Nit: the filled curl is a dark lump with a 1-2 px tip strand and a few (33,0,33) inner pixels; at 1x it reads as a tail. `z_crocodile_idle.png`, `z_crocodile_hurt_in2.png` |
| 5 | hollow_seraph raise frames, wings, cyan block | **FIXED** | the raise frames are gone (`hasRaise: false`). The heavy attack is telegraphed: a red tint over atk_wind2 (t 24-30) and a glint at the wing tip (t 30-36), then the lunge reaches the warrior. 6 wings in every frame, no flat cyan block. `m_seraph.jpg`, `strips/hollow_seraph.png` |
| 6 | ice_gigas (new sheet + rig) axe continuity | **FIXED** | the axe stays on the right shoulder from idle through hurt_in1, hurt_in2 and hurt. Nit: a 1 px loincloth strand hangs at the knee in atk_wind1/2 and atk_recover. `strips/ice_gigas.png`, `z_ice_gigas_atk_wind2.png` |
| 7 | garland cast hip hole, atk_swing2 sliver | **FIXED** | no hole in cast_rise, cast_release or cast. The atk_swing2 smear is now attached to the blade tip, ends 2 px inside the cell, and no part of it is detached. Nit: it reads as a V hook on the blade. `z_garland_cast_rise.png`, `z_garland_atk_swing.png` |
| 8 | minotaur / dragon scale | accepted nit (unchanged) | - |
| 9 | gigas_worm vs lava_worm (and the new purple_worm, sand_worm) | distinct (accepted) | different colour, lava seams, maw and coil at 2x. `sib_0.png` |
| 10 | vampire face, cobra head | **FIXED** | vampire: a magenta eye on a pale profile reads at 2x. Cobra: mouth and fangs read, and the head no longer reads as a hood blob. `z_vampire_idle.png`, `z_cobra_idle.png` |
| 11a | drowned_sovereign cast tentacle colour | **FIXED** | 0 px of (33,33,165), (41,41,115) and (41,49,107) in cast, cast_gather, cast_rise and cast_release. The tips read as sea-teal flesh. `strips/drowned_sovereign.png` |
| 11b | drowned robe hems | accepted (R8) | the idle hem curls are robe flourishes: no tentacles in idle frames, and tentacles only in action frames |
| 12a | ochu tendril-tip specks | **FIXED** | 0 px of the two colours in attack, atk_mid and atk_follow. `z_ochu_attack.png` |
| 12b | fire_elemental elbow rose patch | **FIXED** | no rose patch at the elbow; 3 rose px left in the box are flame-tip accents also in the attack key. `z_fire_elemental_atk_wind2.png` |
| 12c | death_eye pupil in daze | **FIXED** | one pupil in daze and daze_b. `z_death_eye_idle.png` |
| 12d | art crossing the bestiary panel edge in a lunge | **FIXED** | 46 entries over a full bestiary attack: the art's right edge is at most 970 against the panel's inner right edge of 982 (12 px margin). `best_all.json` |
| 12f | ogre / troll recover pop | **FIXED** | the club in atk_recover is within a few px of idle. `z_ogre_attack.png`, `z_troll_attack.png` |
| 12g | ashen_queen tail in hurt | accepted nit | the tail still lashes on its own in hurt_in1/2, but it stays attached and no hole is open |

Performance and anim_crowd were not re-measured (out of time); none of the 70 unchanged sheets changed.

### B. Batch C/D (37 enemies), first test

Method: every frame in `strips/<id>.png` and zooms, the bestiary page (full attack loop, edge check), 5 mixed 9-enemy step loops (B1 shoreline sea, B2 temple undead/knights, B3 grassland beasts, B4 and B5 plain-backdrop dragons, worms and golems; 440 frames each, highest opaque y and lunge reach recorded). Every enemy stays below the window (highest pixel 188 or lower), every lunge reaches the front hero, no text overflow, and every caption is right.

| Enemy | Verdict | Finding | Evidence |
|---|---|---|---|
| baretta | OK | distinct from desert_baretta (spined anteater vs ankylosaur) | strips/baretta.png, sib_1.png |
| basilisk | P2 | a dark notch at the foreleg/chest join in atk_wind1/2 (1x: barely visible) | z_basilisk_idle.png |
| allosaurus | OK | distinct from tyrannosaur | strips/allosaurus.png |
| weretiger | OK | - | strips/weretiger.png |
| sand_worm | P2 | hurt_in2: two body arcs overlap in a fold or crease at mid-body | z_sand_worm_hurt_in1.png |
| minotaur_zombie | OK | cleaver changes hands in the hurt key (base art), reads fine | strips/minotaur_zombie.png |
| king_mummy | P2 | the gold crook staff turns black in hurt_in2/hurt (approved hurt key): prop identity | strips/king_mummy.png |
| medusa | OK | - | strips/medusa.png |
| rakshasa | OK | - | strips/rakshasa.png |
| clay_golem | P2 | the forehead rune changes glyph between idle ("R") and atk_mid/attack/atk_follow | strips/clay_golem.png |
| nightmare | OK | - | strips/nightmare.png |
| sahagin_prince | OK | distinct from sahagin / sahagin_chief | sib_0.png |
| deepeyes | OK | - | strips/deepeyes.png |
| sea_snake | OK | a red patch at the tail coil in hurt (base art) | strips/sea_snake.png |
| sea_scorpion | OK | distinct from scorpion | sib_3.png |
| sea_troll | P2 | jagged outline spurs at the knee join and broken finger outlines in atk_wind1, atk_wind2 and hurt_in1 | z_sea_troll_atk_wind2.png |
| ghost | OK | the small wisp beside the hurt key is part of the approved art | strips/ghost.png |
| water_elemental | P2 | keyframe-only (by design). The attack and hurt keys are ~25 % larger than the idle (size pop at the key switch). Idle 79 px, under the large band (96-120). Low contrast on its waterfall bestiary background | strips/water_elemental.png, best/water_elemental_f40.jpg |
| water_naga | OK | - | strips/water_naga.png |
| tyrannosaur | OK | - | strips/tyrannosaur.png |
| black_knight | P2 | keyframe-only (by design). 8 colours, near-black, low contrast against the temple's back wall | m_B2.jpg |
| chimera | **P1** | anatomy changes between keys: idle has 3 heads (lion, goat, one dragon); attack, atk_mid, atk_follow, hurt_in2 and hurt have 4 (a second open-jawed dragon head out front). Approved base art | z_chimera_idle.png, `?mute=1&bestiary=chimera&battleStep=1` |
| guardian | OK | a few dark pixels under the spear tips at the ground in hurt_in2 (1x invisible) | strips/guardian.png |
| blue_dragon | OK | - | z_blue_dragon_attack.png |
| green_dragon | OK | - | z_green_dragon_atk_wind2.png |
| stone_golem | P2 | the same knee/leg seam spurs as sea_troll in atk_wind1/2 and hurt_in1; a chest rune differs in hurt_in1 | z_stone_golem_atk_wind1.png |
| air_elemental | P2 | hurt_in2: a 1 px dark crease line runs diagonally across the body (an arm part's outline) | z_air_elemental_hurt_in2.png |
| spirit_naga | OK | - | strips/spirit_naga.png |
| death_knight | OK | - | strips/death_knight.png |
| earth_medusa | P2 | in idle and every idle-derived frame, an outlined pale rectangle sits on the chest (approved art); ragged fragments at the left arm in hurt_in1; at 2x it reads as a grey recolour of medusa (same pose, silhouette IoU 0.83) | z_earth_medusa_idle.png, sib_0.png |
| black_flan | OK | silhouette 0.88 vs green_slime (blobs) but black with 3 yellow eyes, distinct | sib_0.png |
| soldier | OK | - | strips/soldier.png |
| vampire_lord | OK | very dark (8 colours) but face and red eyes read on the temple background | z_vampire_lord_idle.png, m_B2.jpg |
| dark_fighter | OK | - | strips/dark_fighter.png |
| rhyos | OK | 4 heads in every frame (consistent) | strips/rhyos.png |
| purple_worm | OK | - | strips/purple_worm.png |
| iron_golem | OK | - | strips/iron_golem.png |

Counts: 26 OK, 1 P1 (chimera), 10 P2, 0 P0.

### C. Regression sample and quadruped `body: {width: 16}`

- **Sample (15 previously-OK sheets):** goblin, wolf, cockatrice, green_slime, shark, ashen_queen, manticore, hellhound, white_dragon, dragon_zombie, mindflayer, sphinx, wyvern, pirate, specter.
  - All are byte-identical to the first test's atlas in every frame (ashen_queen only in the planned hurt_in1/2).
  - In battle (B formations, L1 crowd) and in the bestiary: no new clipping or layout change; the bestiary right edge is within its margin.
  - The bosses (A1) lunge to the target hero and stay below the window.
- **`body: {width: 16}` pixel drop:** the rigs that use it are white_crocodile, dragon, white_dragon, fire_lizard, blue_dragon, sphinx, green_dragon, desert_baretta, chimera, manticore, crocodile, rhyos and dragon_zombie. wolf and hellhound use the template width.
  - Atlas idle, attack and hurt cells are pixel-identical to the approved PNG cells for all of them, so the keyframes drop nothing.
  - In-betweens: no key pixel is more than 4 px from any pixel of idle_b, for every one of these sheets.
  - The idle_b area loss is 1.4-2.4 %, the same range as rigs without the override (goblin 1.1 %, hellhound 2.1 %, wolf 3.2 %). This is breathing compression, not dropped body pixels.
  - Pixels that land far away only appear in hurt and attack in-betweens, where the parts really move.
  - **No silent pixel drop found** (`lost.py`, `inb.py`).

### Status

- No P0. One new P1 (chimera head count, base art). Every P1 from the first test is FIXED.
- P2s: 10 new in batch C/D; the first test's P2s are fixed or on the nit list. The new nits are the crocodile tail lump, the ice_gigas knee strand and the garland smear hook.

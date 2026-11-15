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

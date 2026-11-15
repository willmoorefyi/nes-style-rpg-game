# Act 1 run log

The unattended run the user asked for on 2026-11-12. The goal is to complete Cornelia, Cornelia Castle, the
overworld peninsula and the Temple of Fiends, with art, maps and the castle story, and to make 2x the default.

**Rules:**
- at most 100 more paid images (`assets-src/gen/budget.json`, enforced in `check_budget`)
- self-approve when the metrics pass and the preview looks right
- at most 2 retries per sheet

## Decisions

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 1 | town/kit_inn (E1) | 1 | two-storey timber inn, stamped whole as a prefab; door 62 px | approved by the user |
| 2 | town/kit_signs (E2) | 1 | 6 sign boards with icons, well, chimney; Gemini drew the bottom row low, so source rects were added | self-approved |
| 3 | interior/kit_rooms | 1 | wood and stone floors, carpet and back wall good; the wall top came back as a framed panel, so it is derived from the floor, darkened; carpet borders cropped | self-approved |
| 4 | interior/kit_furniture | 1 | counter, plant, bookshelf, bed, racks, shelves, armour stand, window, orbs, table; source rects fixed (props outside boxes, counter caught the next row) | self-approved |
| 5 | castle/kit_hall | 1 | castle keep: slate roof, stone walls, arched window, studded double door; the roof overhangs and the door is wider than a tile, so it is a prefab (castle_hall) | self-approved |
| 6 | castle/kit_props | 1 | tower, throne on dais, pillar, knight statue, banner, torch; Gemini left two grey guide boxes and painted plaster behind the banner and torch, so source rects and border keying were added; drawn at about 3 px per pixel, so props come out large (3-tile tower, 2x2 throne) | self-approved |
| 7 | king/field | 1 | white-bearded king, crown, red ermine robe; the side row faced right, so it is flipped | self-approved |
| 8 | princess/field | 1 | blonde princess, tiara, pink gown; the side row faced right, so it is flipped | self-approved |
| 9 | villager_f/field | 1 | woman villager (maid) in a red dress and apron; flipped | self-approved |
| 10 | overworld/kit_terrain | 1 | forest canopy, rocky mountain, sand, ocean; Gemini filled the gaps between squares, so explicit sources were used; seams ≤ 1.12 | self-approved |
| 11 | overworld/kit_landmarks | 1 | town, castle and temple icons, peak, tree clump, boulder; drawn on grey panels in its own layout, so sources and border keying were used | self-approved |
| 12 | temple/kit_ruins | 1 | cracked temple floor, rubble, wall face, wall top; the wall top was framed, so it is cropped; the floor seam is 2.6 (a regular slab grid), accepted | self-approved |
| 13 | temple/kit_relics | 1 | pillar, broken pillar, fiend statue, purple brazier, rune altar, fallen column, chests (closed and open), vines, skulls; on grey panels, so sources and blend-line keying were used | self-approved |

**Pipeline lesson:** a sheet used as a reference by other requests (e.g. castle/props) must not be re-cut after
approval, because its PNG is part of their cache keys. The castle props keep the original keying (`key_mode: v1`).
| 14 | garland_npc/field | 1 | horned dark knight with a red cape (front and back good); the side row drew the house knight, so row_from left: down (he never walks) | self-approved |

## Result (2026-11-13)

Act 1 is complete in 2x art, and it is the default. All of these are compiled maps under `assets/maps/ai/`:
- **Cornelia:** the town, its six shops and the inn
- **Cornelia Castle:** the grounds and the throne room, with the King, the Princess (after her rescue), the chancellor, guards, soldiers and a maid
- **The overworld:** an original peninsula with Cornelia, the castle, forests, mountains, the river with its east bridge, beaches, and the north bridge gated on BRIDGE_BUILT
- **The Temple of Fiends:** an original layout with the four chests, Garland guarding the sanctum (his encounter tile in front of him) and the captive Princess

**Story wiring** (all NPC dialogs and flags live in data):
- The King's dialog depends on PRINCESS_RESCUED.
- The Princess appears in the castle once PRINCESS_RESCUED is set and gives the lute once (GOT_LUTE); her captive copy in the temple disappears at the same point.
- Garland disappears once GARLAND_DEFEATED is set.
- The existing `garland_defeated` cutscene sets PRINCESS_RESCUED and BRIDGE_BUILT, which opens the north bridge.

**Checked:**
- muted browser checks: the King's dialog, the Princess with the lute gift, entering the castle from the overworld icon, and the Garland battle trigger
- `npm run build` and `npm test` (1041 tests), `selftest.py`, `build_map.py --selftest`

**Images used:** 16 of the 100-image cap. Logged in `cache/ledger.jsonl`; decisions are listed above.

**Known gaps:**
- The castle keep is a single prefab, so the castle is modest.
- The overworld icons are small next to characters.
- Garland's side-view frames reuse his front view.
- The interior keepers stand on the counter, as in the legacy maps.
- The production build still doesn't copy `assets/` into `dist/` (a pre-existing issue).

## Cornelia rebuild (2026-11-13)

The user asked for a more interesting Cornelia and a castle you are inside: the town and castle in one walled
city, a river through the town, bent walls, several exits, and a castle with several floors.

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 15 | town/kit_market | 1 | oak, market stall, street lamp, bench, hedge, cabbage bed, lily pads; grey panels again, so sources and border keying | self-approved |
| 16 | castle/kit_masonry | 1 | keep wall (ashlar with a string course), slate, marble checker, inner wall with a red wainscot; drawn in its own layout, so sources, `keep_aspect` and (marble) `seam_fix: false` with whole squares | self-approved |
| 17 | castle/kit_facade | 1 | grand gate with portcullis, arched window, blue royal banner, urn, topiary, stone bench | self-approved |
| 18 | castle/kit_furnish | 1 | stairs up, stairwell down, banquet table, fireplace, lion tapestry, writing desk | self-approved |

**Result:**
- **Cornelia** (`assets-src/tools/layouts/cornelia.py`, 62x72): one bent outer wall with turrets wraps the castle precinct and the town.
  - The river enters under the north wall, fills the moat, winds through the town (rounded banks) and leaves under the south wall.
  - Five bridges; a chevron inner wall with a gatehouse; formal castle gardens.
  - Market square, magic quarter with a lily pond, varied houses (recoloured roofs and walls, two storeys).
  - Gates: south, west, east, the castle precinct's east gate and a north postern.
- **The castle exterior** is a `facade` object: a keep with a central tower, wings, end towers and gate turrets.
- **The castle interior** (`assets-src/tools/layouts/castle.py`):
  - 1F: grand hall, gallery, barracks, banquet hall, library, treasury
  - 2F: throne room, the princess's chamber, the King's study, chapel, tower stair
  - 3F: the sage's lookout
  - B1: the cellar, with three chests
- **Overworld:** the castle icon now sits behind the town icon as one walled city. Walk onto its towers to enter the castle precinct.

**Images used:** 20 of the 100-image cap.

## Follow-up fixes (2026-11-13)

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 19 | overworld/kit_city | 1 | one 4x4 walled-city icon: castle in the north, red-roofed town and river in the south; gates S, lower W, lower E, castle N | self-approved |

**Re-cuts (no new images):**
- `fill: true` enlarges small props to fill their cells: the market stall, both staircases and the chests.
- The compiler's `fit: true` enlarges the throne and pillars. The castle props sheet is a style reference for other sheets, so it is not re-cut.
- The grand gate is recoloured to the castle wall stone (`match`).

**Overworld:** the city icon has walkable gate cells (north, west, south, east) that lead to the matching city gates.

**North bridge:** its middle has collapsed into the sea until the repair is implemented. The key-item gate now sends the player back; before, it only showed its message and let the player through.

**Battle:** party melee attacks follow `attackChoreography.ts`. Styles are lunge (the default), dash, leap and classic, chosen with `?attack=`. Each hit draws a slash effect.

**Images used:** 18 of the 100-image cap (the ledger guard count, which is authoritative; this line said 21 until the T6 correction).

## T6 paid art (2026-11-14)

Branch `t6-art`. One paid Gemini request per checkpoint, `--paid`, at most 2 retries per sheet (`docs/FIX_PLAN_PENINSULA.md` T6 §3 and revisions 8, 9, 13).

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 19 | overworld/kit_grand (seed 1234) | 1 | the temple door is in the middle of the icon (between the two bottom cells), and the icon is 73 px wide (it must be at least 82); the bridge gap is good but its planks are too dark and red (ΔE ≈ 17 from the deck) | rejected |
| 20 | overworld/kit_grand (seed 1235, retry 1) | 1 | the temple is asymmetric and 91x92 px, but the door is 13 px wide and centred at x≈61 (the door cell's centre is 72); the bridge gap has painted water in the middle, so it isn't transparent | rejected |
| 21 | overworld/kit_grand (seed 1236, retry 2) | 1 | the temple door is again narrow (≈11 px) and left of the door cell; the bridge gap is clean on magenta, its planks within ΔE ≈ 5–7 of the deck, 49 % transparent, with a faint dark-red outline | **approved for `bridge_gap` only** (OW-9). `temple_grand` gets `skip: true` and **OW-8 falls back to `temple_icon`** (revision 8) |
| 22 | castle/kit_stairs_lib | 1 | the stairwell is top-down, descends from the top edge and has kerbs left, right and bottom. Map table, gold heap, crown on cushion, lectern, globe. Gemini used its own layout, so every piece has a source rect. The stairwell is cropped square and filled to 96x96 (all four corners opaque, top-edge luma +7 % of the marble). The gold heap's grey floor patch is keyed out | self-approved |
| 23 | vendor_f/field | 1 | heights 86–92, 14 colours, outlined, faces readable. Side frames 1–2 were drawn facing right (`flip_frames left:1,2`). The back stand frame draws the shawl long (brown), so the colour flickers a little when walking up | self-approved |
| 24 | farmer/field | 1 | heights 84–92, 13 colours; the side row was drawn facing right (`--flip left`) | self-approved |
| 25 | burgher/field | 1 | heights 85–90, 14 colours; the side row was drawn facing right (`--flip left`) | self-approved |

- The three townsfolk are distinct from `villager`, `villager_f`, `merchant` and `old_man` at 2x. Their walk in-betweens are clean (checked with `puppet.walk_row` and `review_walk`).
- `build_assets.py field_ai` lists all three.
- After each approval, `git diff --exit-code assets-src/gen/approved/` was clean apart from the new sheets, and `selftest.py` passed.
- **Fallback used:** OW-8 keeps `temple_icon`, so T6h must not place `temple_grand`. The rejected temple of seed 1235 stays in the local cache (key `bc37fe12f510c3914a1a2d6a`). The user could still accept it later if the door rule were relaxed.
- **T6h note:** the approved sheets are `approved/overworld/grand.json` and `approved/castle/stairs_lib.json`, not `ruins.json` / `vault.json` as §2 says.

**Images used:** 25 of the 100-image cap (ledger guard: 87 + 7 = 94 Gemini attempts − `attempts_before` 69).

## R5 art (2026-11-14)

Branch `r-art`, in the main checkout. `docs/FIX_PLAN_PENINSULA.md` §R 3 (paid art), decisions R-10 and R-12, momus revisions 15 and 16. Revision 15 calls the gates step R5-1 and the W1 re-cut R5-4; the §3 table numbers them the other way around. These entries use the sheet names. Every paid request is made with `--paid` and `--max-paid 1`, after a dry run.

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 26 | overworld/kit_grand_temple (W1, free re-cut) | 0 | The request is byte-identical to `grand` seed 1236, and the dry run reported a cache hit on `b398fc75dc4521f0a2e9f762` with 0 paid requests. The temple is cut as `temple_ruin_{0,1}_{0,1}` with `fill_ratio: 1.0`; at the default 0.96 the doorway came out 11 px. The prop is 91x96 native (≥ 82x82). The doorway's dark columns are x 53–64 (12 px, `door_px: [53, 65]`, centre 59), so the map offset is +13 and the door lands on 72 ± 0. `bridge_gap` is skipped. There is no pink or magenta fringe: 48 edge pixels are a dark violet ink (57, 0, 66; luma ≈ 25), fewer than the approved `grand` bridge gap has. It is still readable as a temple with a black door at 0.25 scale on its own; mean luma is 62 (the old icon's was 60) | **self-approved** (decision R-12) |
| 27 | town/kit_gates (M7, paid, decision R-10) | 1 | The dry run showed 1 paid request; it was made with `--paid --max-paid 1` and is attempt 1 of the 1 allowed. Gemini ignored the box layout and drew to the page edges, so every piece has a source rect. `gate_arch_3` is 144x96 (its source is trimmed to 3:2, which also drops the bottom row's magenta blend) and `gate_arch_2` is 96x96. Both are a pale slab walkway over the grey coursed wall face with a light voussoir arch, matching `town/walls` in outline, light and saturation. Their arch openings are keyed transparent down to the bottom edge, so the road shows through. Composited over the south gate at 2x, `gate_arch_3` reads as a gatehouse. `sign_tavern` (a tankard, 40x40) and `sign_shrine` (a white crystal, 38x40) use the same plum outline and wooden board as `town/signs`, sized to the 39–40 px boards. **`gate_side` failed review:** it came back as a front-view arch on a pink backdrop with a window, not a lintel over a north-south wall. `paint` (a build-time op; the png is untouched) makes 17 magenta-blend edge pixels transparent: the shrine hook gap, the sign corners and the `gate_arch_2` inner rim | **self-approved without `gate_side`**. **Fallback for `gate_side`:** the W, E and precinct-E gates keep turret flanking only. No retry, because only one paid image is allowed for M7 |

- After each approval, `git diff --exit-code assets-src/gen/approved/` was clean apart from the new sheets (`overworld/grand_temple.*`, `town/gates.*`), and `selftest.py` passed. The Cornelia compile is byte-identical, since nothing is wired yet.
- **For R6:**
  - W1: the parts are `temple_ruin_{0,1}_{0,1}` in `approved/overworld/grand_temple.json` (`metrics.prop_px.temple_ruin` = [91, 96], `metrics.door_px.temple_ruin` = [53, 65]), so the deco offset is [13, 0].
  - The 0.25-scale map preview, `art_coverage` and `warp_leaves` checks belong to R6 with the wiring. The icon's mean luma is 62, so `style: bright` may still be needed.
  - M7: the parts are `gate_arch_3_{0,1}_{0..2}`, `gate_arch_2_{0,1}_{0,1}`, `sign_tavern` and `sign_shrine` in `approved/town/gates.json`. `kit.py` `SIGNS` still needs `tavern` and `shrine`.
  - The arch's walkway band is about 38 of 96 px, against the wall's 48 + 48. It reads as a raised gatehouse.
- `generate.py`'s `kit_preview` crashes for the overworld and town kits (it compiles the castle map without the castle kit). This is after the sheet and report are written, so the review images above were built by hand.

**Images used:** 26 of the 100-image cap (ledger guard: 95 Gemini attempts − `attempts_before` 69).

## Pass F art, tranche Ff (2026-11-14)

Branch `feedback`, worktree. `docs/FEEDBACK_PLAN_2026-11-14.md` §3.7 (item 7) and binding decision FB-8: one paid `boss_attack_raise` image each for Garland and the lich, at most one retry each and only after a failed review, at most 4 Gemini attempts in total (the `passes` cap in `budget.json`, enforced by `check_budget`). Each request was made with `--paid --max-paid 1` after a dry run that showed every existing pose cached and only `boss_attack_raise` PAID. The prompts add one fit clause to the plan's wording (a deep crouch, same pixel size as the approved idle), because both idles already fill the 200 px cell height, so a blade raised above an upright figure could not fit without shrinking the sprite.

| # | Sheet | Images | Result | Decision |
|---|---|---|---|---|
| 28 | garland/boss_attack_raise (seed 1234, key `eeccce6b59e52b7e824a5705`) | 1 | Crouched two-handed overhead raise, greatsword above the helm and swept back over the shoulder, cape behind, facing right. 176 px tall (band 140-168 +10 %), lowest row 192, top row 17 (headroom 17 px), x 22-178, no border pixels, binary alpha, 15 colours with the outline ink. 6 of 15 colours shared with the four approved poses (each approved pose shares 4-5 with the others; the eye reads one palette, the cape a little browner like the approved attack). `pose_diff` 0.63 vs idle, 0.98 vs attack; the sword is whole | **self-approved** (attempt 1 of 2 allowed) |
| 29 | lich/boss_attack_raise (seed 1234, key `9b23f8bd8299a6527f831956`) | 1 | Crouched overhead raise, both gauntlets lifting the glaive over the icicle crown, blade swept back up-left, facing right; 180 px, lowest row 192, top row 13, no border pixels, binary alpha, 16 colours with the outline ink, `pose_diff` 0.67 vs idle and 0.71 vs attack. **Fails review:** the guide's grey ground line is painted across both boots (two light-grey bars with outline, about 12 and 8 px long, at the boot soles), and the raw shows part of the guide box behind the figure. A keyframe is shown as approved, so rig paint cannot hide it, and the style lock forbids editing the PNG | **rejected**; the one allowed retry follows (seed 1235, `--retry`) |
| 30 | lich/boss_attack_raise (seed 1235, key `01447ea32ceac64855ace8f8`, `--retry`) | 1 | No guide line or box; the frost-trail arcs of the raw are keyed out (no strays). Crouched overhead raise, both gauntlets over the icicle crown, glaive blade swept back up-left, mantle flung back, facing right. 182 px (band 140-168 +10 %), lowest row 192, top row 11 (headroom 11 px), x 27-172, no border pixels, binary alpha, 14 colours with the outline ink, 6 shared with the approved poses (as each approved pose shares 4-5). `pose_diff` 0.84 vs idle, 1.01 vs attack. Nit: the blade reads broader and paler than the idle's curved rune glaive (closer to the approved attack's smeared blade) | **self-approved** (attempt 2 of 2 allowed; no further retries) |
| 28r | garland/boss_attack_raise #28, independent image review (2026-11-15) | 0 | **Fails the image review (ITERATE):** the helm shrinks to a ~12 px dome seen from behind (idle ~20 px with both horns, the visor slit and red eyes), the torso is a back view that flips to the front-facing attack within one frame, the sword is ~85 px long against ~105 in idle and too thin, the pauldrons are undersized | the one allowed retry follows (seed 1235, `--retry`; the prompt now asks for the idle's three-quarter front view, the full-size helm and pauldrons, and the idle's sword length and width) |
| 30r | lich/boss_attack_raise #30, independent image review (2026-11-15) | 0 | **Fails the image review (ITERATE):** the blade became a broad flat cleaver without the cyan rune inlay and no spearhead, the weapon is ~60 % of the idle glaive's length, the skull face is muddy and the crown spikes are small. **The free fix cannot work:** the approved `attack_raise` key is itself shown for the 18-frame hold (only the PNG, which the style lock forbids editing), and a rig cannot bring the idle glaive's pixels into raise-sourced frames (the renderer carries a prop's idle pixels only in `hurt_in2`, `monster_anim.generate`), so a free fix would need a framework change and would still leave the key frame wrong | the user lifted the 100-image cap (2026-11-15) and allowed ONE more paid lich attempt; `budget.json` pass F cap raised to 5 in total, 3 per sheet (garland stays at 2 by decision). Retry follows (seed 1236, `--retry`; the prompt asks for the idle's slim curved glaive with the rune inlay and spearhead at full length, no frost trail, a crisp skull and a tall icicle crown) |
| 31 | garland/boss_attack_raise (seed 1235, key `f98cf659f26ded791c9fb262`, `--retry`) | 1 | Three-quarter front view like the idle and attack: the full horned helm with both ivory horns, the visor slit and red eyes toward the viewer, large gold-trimmed pauldrons, the greatsword as long and broad as the idle's, raised two-handed up and forward over the helm (not back over the shoulder), cape behind, deep crouch. 188 px tall (the idle is 189, the cast 187), lowest row 192, x 30-170, no border pixels, binary alpha, 16 colours with the outline ink, 9 shared with the four approved poses (#28 shared 6). `pose_diff` 0.55 vs idle, 0.95 vs attack; the sword is whole. **Deviation:** headroom 5 px (the checklist asks ≥ 10; the idle has 4). It is accepted because no heavy frame overshoots the raise upward (`atk_raise_b` bobs down, `atk_swing` turns the blade down), and the clipping check passes | **self-approved** over #28 (clearly better on every review point; attempt 2 of 2, no further garland retries) |
| 32 | lich/boss_attack_raise (seed 1236, key `0584887494033aec0cbf7eed`, `--retry`, user-approved 3rd attempt) | 1 | The idle's glaive at full length (the haft spans x 11-188 diagonally, blade up-left behind the crown, the butt spike down-right), the slim curved ice blade with its spearhead, no frost trail; a crisp cracked skull with cyan eye lights and toothed jaw, the icicle crown; mantle flung back; deep crouch, facing right. 171 px (band 140-168 +10 %), lowest row 192, top row 22 (headroom 22 px), no border pixels, binary alpha, 16 colours with the outline ink, 11 shared with the approved poses (#30 shared 6). `pose_diff` 0.67 vs idle, 0.62 vs attack. Nit: the raw's thin cyan rune line did not survive the 16-colour cut (the blade reads pale ice) | **self-approved** over #30 (clearly better: weapon shape and length, face, crown; attempt 3 of 3, no further retries) |

- Each approval: `git diff --stat assets-src/gen/approved/` shows only the new `boss_attack_raise.*` files; the dry runs showed every existing boss pose cached (no cache key changed).
- Rigs re-marked for #31 / #32 (`keyframes.attack_raise`, the head / cape / weapon masks); `atk_swing` and `atk_swing2` re-tuned and the old patches re-derived; `monster_anim.py check garland lich` prints only lock lines (the new frames are not locked).

**Images used:** 31 of the 100-image cap (ledger guard: 100 Gemini attempts − `attempts_before` 69; pass F's own cap in `budget.json` `passes`, raised by the user on 2026-11-15 to 5 in total and 3 per sheet: 5 of 5, garland 2, lich 3). The user lifted the 100-image cap the same day; a new 300-image budget applies to later work.

## Pass R, tranche G1 art (2026-11-15)

Branch `roster`, main checkout. `docs/ROSTER_PLAN.md` 4.1 (designs), 6 (budget) and 9 (process), binding decisions D9
(at most 2 retries per sheet, self-approved on the binary checklist) and D12 (`pass R build` 285). The authoritative
pass-R log is `docs/ROSTER_LOG.md`; the same rows are mirrored here per the generator brief. Every paid request is
made with `--paid --max-paid 1` after a dry run.

| # | Sheet (seed) | Images | Result | Decision |
|---|---|---|---|---|
| R1 | ashen_queen/boss_idle (1234, key `8e23d14cf040a2850a4db92b`) | 1 | Six arms (3 per side: upper pair raised, one holding the sun disc; middle pair open in blessing; lower pair with the curved bronze blade and the chained censer with smoke), no legs, a charcoal serpent tail with ember-lit underside coiled on the ground, the broken stone altar joined to the coil (one 4-connected piece) on the ground row, a cracked white mask with two burning slits, a gold ray crown. 186 px tall (garland 189, lich 184), lowest row 192, top row 7, x 25-175, no border pixels, binary alpha, 16 colours with the outline ink. Near-frontal with the mask turned slightly right, as the approved garland and lich idles; the same pixel size, outline and top-left light. Nits: the sun disc sits on one upper hand, not between two; the altar column stands mostly behind the coil | **self-approved** (attempt 1 of 3) |
| R2 | ashen_queen/boss_attack (1234, key `dff206cd48da9ec0a2535987`) | 1 | Clean cut: 175 px, lowest row 192, top row 18, x 17-182, no border pixels, binary alpha, 16 colours with the outline ink (4 shared with the idle; garland's poses share 4-5), one piece, `pose_diff` 0.52; six arms, tail, altar joined, mask and crown kept, lunging right. **Fails the design review:** the strike is led by the sun disc in an open hand (reads as a grab, not a melee blow), the bronze blade is in a far-side arm thrown back up-left instead of leading the sweep toward the heroes, and the censer lost its chain and smoke (a small cup in the lower near hand, a prop change against the idle) | **rejected**; retry follows (seed 1235, `--retry`; the `attack` text now names the blade arm and its sweep across to the heroes and keeps the censer on its chain) |
| R3 | ashen_queen/boss_attack (1235, key `f11fb83bb845b81df7f35cfc`, `--retry`) | 1 | **Fails review:** Gemini painted the light-grey guide box as the whole background, so the cut keeps a grey patch inside the coil hole and a dark-speckled fringe; the cell came out 216 x 200 with the sun disc on row 0 (17 border pixels, no headroom), 193 px tall; only **four** arms; the props swapped sides against the idle (blade now in a right hand, censer in a left hand: a prop pop for the rig). The blade does lead the slash toward the heroes | **rejected**; the last allowed attempt follows (seed 1236, `--retry`; the `attack` text now pins each prop to its idle hand, the blade arm crossing in front of the body, and the six-arm count) |
| R4 | ashen_queen/boss_attack (1236, key `c3d017fdc4d86292def35439`, `--retry`, attempt 3 of 3) | 1 | Clean cut: 186 px, lowest row 192, top row 7, x 20-180, no border pixels, binary alpha, 16 colours with the outline ink (5 shared with the idle), one piece, `pose_diff` 0.49 (almost all from the blade). The props stay in their idle hands (disc upper left, blade lower left, censer on its chain lower right). **Fails review:** it is the idle stance with the blade held flat across the waist: no lunge, no lean, so it does not read as an attack; the left-side arms are muddled (the middle-left arm folds into the torso); the censer smoke and the altar top take a mauve tint | **rejected** (no 4th attempt, D9) |
| R5 | ashen_queen/boss_attack: approve R2 (1234, key `dff206cd48da9ec0a2535987`) as best of 3 | 0 | R2 is the only attempt that reads as an attack (a strong lean and lunge to the right over the coil) with six clean arms, the altar joined, and the mask and crown as in the idle; R3 is unusable, R4 static. The `attack` text and seed in `monsters.yaml` are back to the R2 request (the retry wordings are kept as a comment). Recorded nits: the bronze blade is thrown back up-left on the far side instead of leading the blow (the strike reads as an open-handed sunfire grab with the disc forward); the censer is a small cup in the lower near hand without its chain or smoke (the rig needs a carry rule or a hidden swap for it) | **self-approved with nits** (attempt 1 of 3 used; 3 of 3 spent) |
| R6 | ashen_queen/boss_cast (1234, key `3529788f54db918a30395c89`) | 1 | Clean cut: 190 px (lich cast 190), lowest row 192, top row 3, x 18-181, no border pixels, binary alpha, 15 colours with the outline ink (4 shared), one piece, `pose_diff` 0.38 vs idle; six arms spread, small flames in the middle hands, the disc raised in the upper left hand, mask, crown, altar joined. **Fails review:** the props swapped sides against the idle (censer now in the lower left hand, blade in the lower right: a prop pop in `cast_gather` / `cast_rise`), and the tail tip frays into ragged thin black strands | **rejected**; retry follows (seed 1235, `--retry`; the `cast` text now pins each prop to its idle hand and asks for the idle's smooth tapering tail tip) |
| R7 | ashen_queen/boss_cast (1235, key `083914478e09012536186ea3`, `--retry`) | 1 | **Fails review:** an enclosed magenta key hole inside the lowest coil and a magenta fringe along the outline, only **five** arms, a muddy brown re-palette (2 of 14 colours shared with the approved poses), 3 pieces (28 + 8 px strays), the tail tip frayed again and the altar flattened into rubble. Props did stay in their idle hands. 182 px, lowest row 192, `pose_diff` 0.60 | **rejected**; the last allowed attempt follows (seed 1236, `--retry`; back to the plan's `cast` wording plus one short prop sentence) |
| R8 | ashen_queen/boss_cast (1236, key `f354d64f3415665db6f31a36`, `--retry`, attempt 3 of 3) | 1 | Clean cut: 186 px, lowest row 192, top row 7, x 22-177, no border pixels, binary alpha, 14 colours with the outline ink (6 shared with the approved poses, the best of the three), one piece; six arms, every prop in its idle hand (disc upper left, blade lower left, censer on its chain lower right), mask, crown, altar joined, smooth tail tip. Nits: barely distinct from the idle (`pose_diff` 0.24, the checklist floor is 0.15; the silhouette moves 1-2 px, the disc arm a little higher), no sparks or blaze, the censer smoke and the altar top take a mauve tint. Chosen over R6 (more distinct, but the props mirrored across the body: a blade/censer pop in every cast in-between, plus a frayed tail) and R7 (unusable) | **self-approved with nits** (best of 3; the rig must sell the rite with a rise in `cast_gather`/`cast_release`, the plan's runtime cast glow helps) |
| R9 | ashen_queen/boss_hurt (1234, key `a95f9add588aaf798365f843`) | 1 | Clean cut: 186 px, lowest row 192, top row 7, x 26-173, no border pixels, binary alpha, 16 colours with the outline ink (6 shared), one piece, `pose_diff` 0.20 vs idle; head and mask thrown back, crown turned. **Fails review: only five arms** (two on the right side; the censer moved to the middle right hand) | **rejected**; retry follows (seed 1235, `--retry`; the `hurt` text now names all three arms on each side) |
| R10 | ashen_queen/boss_hurt (1235, key `56c009356b8317d20a8bab50`, `--retry`) | 1 | Clean cut: 186 px, lowest row 192, top row 7, x 17-183, no border pixels, binary alpha, 15 colours with the outline ink (5 shared), one piece, `pose_diff` 0.56 vs idle; **six arms** (three per side), every prop in its idle hand, the mask and crown thrown back, the arms out of rhythm, the censer swinging on its chain. **Fails review (key fringe):** 48 px of unoutlined pale pink (222, 165, 181) streaks under and beside the censer smoke, a magenta-blend residue that a keyframe cannot paint over; the tail tip forks into a spur; the censer is small under a large smoke plume | **rejected** but kept as the fallback; the last allowed attempt follows (seed 1236, `--retry`; same arm wording, the smoke kept small) |
| R11 | ashen_queen/boss_hurt (1236, key `c805d2b8f1e281f9fa9396f5`, `--retry`, attempt 3 of 3) | 1 | The cleanest cut of the three: 186 px, lowest row 192, top row 7, x 17-183, no border pixels, binary alpha, 16 colours with the outline ink (6 shared), one piece, six arms, every prop in its idle hand, a thin smoke wisp, a smooth tail tip, `pose_diff` 0.49 (arms spread). **Fails review:** it does not read as a hurt: upright, the mask frontal, no recoil, no lean back, no flaring crack (the spread arms read as a cast or a taunt) | **rejected** (no 4th attempt, D9) |
| R12 | ashen_queen/boss_hurt: approve R10 (1235, key `56c009356b8317d20a8bab50`) as best of 3 | 0 | R10 is the only attempt with six arms that reads as a hit (head and crown thrown back, arms out of rhythm, the censer swinging on its chain). `hurt` text and seed in `monsters.yaml` back to the R10 request. Recorded nits: 48 px of unoutlined pale pink (222, 165, 181) streaks under and beside the censer smoke (magenta-blend residue; at 2x they read as an ember flick, and the approved key cannot be painted); the tail tip forks into a short spur; a large smoke plume over a small censer | **self-approved with nits** (best of 3) |
| R13 | ashen_queen/boss_attack_raise (1234, key `71f1e2a38ac638d4ec561fc6`) | 1 | 186 px, lowest row 192, top row 7, no border pixels, binary alpha, 15 colours (3 shared), one piece, six arms, props in their idle hands. **Fails review:** the light-grey guide box is painted behind the head (a grey disc) and inside the coil hole, a white speckle fringe runs along the outline, and no arm is raised overhead (an idle stance, `pose_diff` 0.29 vs idle) | **rejected**; retry follows (seed 1235, `--retry`; the text now asks for every hand above the crown) |
| R14 | ashen_queen/boss_attack_raise (1235, key `ec7e2da21a66dacb6250fbed`, `--retry`) | 1 | Clean cut (186 px, lowest row 192, top row 7, no border pixels, binary alpha, 16 colours, 8 shared, one piece) but **fails review:** a near copy of the idle (`pose_diff` 0.08 vs idle, under the 0.15 floor): no arm overhead, the blade arm only lifted to the shoulder, the left-side arms muddled | **rejected**. **Pause trigger (plan 6.3):** R9-R11 and R13-R14 are rejected naga attempts in a row, so the naga body type stops here; the last `attack_raise` attempt waits for an offline wording fix, and generation continues with `drowned_sovereign` |
| R15 | drowned_sovereign/boss_idle (1234, key `78124850d181c85a756bc559`) | 1 | The disguise holds: **no tentacles**, suckers or fins; a three-quarter view facing right, a tarnished gold crown with pearls, an aged pale face with wet grey hair, pearl-white and abyssal-teal robes with gold embroidery, the hems pooling wide and curling upward on both sides (cloth with an outline and pearl edging), the coral sceptre in the right hand. 162 px (band 140-168), lowest row 192, top row 31 (headroom 31), x 15-184, no border pixels, binary alpha, 16 colours with the outline ink, one piece. Nits: the brocade cuts to a busy, noisy texture (busier than garland's crisp plate; reads as embroidery at 2x); the eyes are tiny; both hands show (the prompt hid one) | **self-approved** (attempt 1 of 3) |
| R16 | drowned_sovereign/boss_attack (1234, key `88ac2126a86eb4c22c79bc57`) | 1 | The pose is right: the robes part and four dark teal tentacles with pale suckers lash far toward the heroes, the sceptre arm thrust forward, crown, face and robe outline as in the idle; 170 px, lowest row 192, x 6-194, no border pixels, binary alpha, 16 colours, one piece, `pose_diff` 0.92. **Fails review:** the guide's ground line is painted under the hem as a pink (255, 198, 247) bar with a stem, 162 px on rows 180-192 (x 7-144), the lich #29 defect; the approved key cannot be painted | **rejected**; retry follows (seed 1235, `--retry`, same wording: the defect is the guide line, not the pose) |
| R17 | drowned_sovereign/boss_attack (1235, key `f37f04d2d51e17eedde34b78`, `--retry`) | 1 | Clean cut: 150 px, lowest row 192, top row 43, x 17-183, no border pixels, binary alpha, 16 colours, one piece, `pose_diff` 0.52; six or seven tentacles with pale suckers spill from the robe front toward the heroes, the sceptre thrust forward, the crown and face kept. **Fails review (identity drift):** the teal outer robe with wide sleeves is gone (a mostly pearl-white gown with one teal front panel), the hems no longer pool wide, and the figure is smaller than the idle (150 vs 162 px): the robes are a named anchor of the design | **rejected** but kept as the fallback; the last allowed attempt follows (seed 1236, `--retry`; the `attack` text adds the robe anchor) |
| R18 | drowned_sovereign/boss_attack (1236, key `42532d476c42f0a2577a0b08`, `--retry`, attempt 3 of 3) | 1 | The robes part at the front and **three** dark teal tentacles with pale suckers lash far toward the heroes; the crown, the aged face and the robes as in the idle (abyssal-teal outer robe with wide sleeves over the pearl inner robe, hems pooling wide), the sceptre arm thrust forward. 161 px (idle 162), lowest row 192, top row 32, x 6-194, no border pixels, no guide colours, binary alpha, 15 colours with the outline ink, one piece, `pose_diff` 0.50. Nit: the coral sceptre reads brown (the idle's coral red is not in this file's 15 colours) | **self-approved** (attempt 3 of 3, over R16 and R17) |

**Images used (pass R):** 16 of 300 (build 16 of 285; ledger guard: 116 Gemini attempts − N0 100).

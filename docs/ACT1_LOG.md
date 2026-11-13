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

**Images used:** 21 of the 100-image cap.

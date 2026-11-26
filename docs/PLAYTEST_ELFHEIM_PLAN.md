# Playtest fixes: the world's bridges, Pravoka, Elfheim (pass PT)

Branch `playtest-world` (from `fc793e05`). Six findings of the user's playtest (2026-11-25), each investigated on the
committed world source and compiled maps before a fix. Previews (`build_map.py --preview ... --grid --collision`) are
in `~/temp/ff-game/playtest/world/` (`before_*.png`, `after_*.png`).

Scope rules: maps come from their layout scripts (no generated YAML is edited by hand); no new art of any kind (only
kit parts that exist); the NPC edits in Pravoka and Elfheim are presence only (`showIf` / `hideIf`) so the sprite
reassignment branch merges cleanly; new rooms' new NPCs live in a new file.

## Findings and root causes

| # | Finding | Evidence | Root cause |
|---|---------|----------|------------|
| PT-1a | "bridge to nowhere in front of Matoya's cave" | `before_matoya.png`: the bridge `=` (131-132, 122) runs east-west from the forest (130, 122) into the river (133, 122) | `worldgen/hydro.fords` turns every river cell of a crossing that lies **on the corridor's centre line** into `=`. Corridor `a1_matoya` runs diagonally down the river's bend, so its line cells are cells along the stream, not across it |
| PT-1b | "another bridge to nowhere east of the bridge off the Cornelia spot" | `before_northbridge.png`: corridor `a1_pravoka` gets three fords east of the north bridge: (157, 133) over the river's mouth (sea below it), (159, 133) from grass into the rock (160, 133), (162, 132-133) from the forest into the rock (162, 134) | the same rule: the line runs along the second river (159-163, 132-137), so its fords lie along the stream and end in mountains. That river never needed a crossing: its north bank (row 131) is open grass to the east |
| PT-2 | Pravoka: "people are out and about and the shops are open before the pirate fight" | `town_pravoka_people.py`: only the 7 pirates, Bikke and the two dockhands / `bikke_after` have a flag condition; the 8 townsfolk (fishwife, fisher, lamplighter, watchman, girl, old_man, old_sailor_hint, herbwife_hint) stand outside on every flag. The 5 shop doors are always open | no presence rule for the townsfolk; no gate on the shop doors. Flag: `BIKKE_DEFEATED` (quest.yaml S2's grant) |
| PT-3 | "multiple houses in Pravoka have doors that lead nowhere" | `before_pravoka.png`, `before_pravoka_deadDoors.png`: `sail_loft` (door (10, 33)), `boarded_cottage` (10, 39) and `old_warehouse` (39, 18) are `house` objects with a drawn door and no `enter`; the pirates' den (`pra_tavern` prefab, AR-W2 swap with `door: None`) draws a door at (20, 33) with no cell behind it | the town script made them "shut" houses (no transition), but the house prefabs and the den's art still draw a door |
| PT-4 | "no obvious port in Pravoka" | `before_pravoka_dock.png`: the dock `a1_pravoka` (186, 146) is a plain Water cell beside the arrival; nothing marks it. The ship disembarks **only** from a dock cell (`fieldRulesVehicles.ts`), so a player sailing back has to guess the one cell | no dressing at the dock (Elfheim's and the dwarves' docks have a `dock_post`; Pravoka's has none) |
| PT-5 | Elfheim: "enter from the top on the overworld, appear on the bottom"; "add a side entry on both sides" | `before_elfheim_world.png`: the icon (131-133, 197-199) takes its door on the **top**-middle cell (132, 197), entered from the anchor cell north of it, while the art's gate is at the bottom and the town's only gate is in its south hedge; `before_elfheim_town.png`: one gate (x 25-26, y 49) | pass W's frozen door offset for `elf_elfheim` is (0, +1) (door south of the arrival cell), and NW placed the icon below that door; the town has a single gate |

## Fixes

### PT-1 (bridges): a ford is a real crossing (generator)

`hydro.fords` keeps choosing which crossings get a ford (the `max_fords` shortest), but the ford of a crossing is now
`hydro.crossing(grid, comp, line)`: a straight horizontal or vertical run of at most 3 of the crossing's river cells
whose cells beyond both ends are walkable land (not `o m r ≈ =`). Ranked: both flanks of every cell river (across the
stream, not over its mouth) first, then the shortest, then nearest the corridor line, then (y, x, axis). A crossing
with no such run gets no ford and keeps its river (the corridor walks round it; `prewalk` and `walks` prove the
walks still hold). Result on the world (measured): 6 cells change: Matoya's ford moves to (132, 122) (north-south
across the east-west stream, forest on both banks); the a1_pravoka corridor keeps one ford, (157, 132), across the
first river just above its mouth; (159, 133) and (162, 132-133) go back to river (that river is not crossed). Every
`world.py` check line stays OK (prewalk, act1, walks, detours, ...). No other region has a ford. This is a
generator fix, not a spec edit, so a future corridor cannot lay a bridge along a stream again.

### PT-2 (Pravoka under the pirates)

- Presence (`town_pravoka_people.py`): the 8 outdoor townsfolk get `showIf: BIKKE_DEFEATED`; the pirates and Bikke
  keep `hideIf`, the dockhands and `bikke_after` keep `showIf`. No dialog, sprite, tint or position changes. Before
  the fight the streets hold only the pirates; the townsfolk are indoors (the six existing homes already hold
  their residents, and PT-3's rooms add the hiding families).
- Shops: each of the 5 shop doors (weapon (19, 13), white magic (5, 23), black magic (10, 23), item (19, 23), armor
  (5, 33)) gets a non-permanent `keyItemGate` with `requiredFlag: BIKKE_DEFEATED` on its door cell (the existing
  mechanism: a gate blocks the step before the transition fires, `fieldRules.fieldStep`), message "The shutters are
  barred. A notice is nailed across them: CLOSED BY ORDER OF CAPTAIN BIKKE." The gate ids are `pravoka_shut_<shop>`.
  The inn and the clinic stay open (the pirates' own lines have them serving the crew, and the party needs a bed
  before nine pirates).
- Balance: stage S2's kit `w_s2` is today an alias of the Pravoka tier (`w_t2`): the band model assumed the party
  shops in Pravoka before Bikke. With the shops shut it fights with Cornelia's gear, so `w_s2` becomes Cornelia's
  `w_s1` kit (an alias). `tests/balance/w_a1_t.test.ts` re-measures Bikke with it (its bounds: Lv4 sensible >= 95 %,
  careless >= 85 %, Lv3 >= 95 %; the measured numbers in the test names are updated). If a bound fails, stop and
  report (no enemy change in this pass). Measured before the plan (400 seeds, `w_s1`): Lv4 sensible 100 %, careless
  100 %, Lv3 sensible 100 %, careless 100 %. `kits.yaml`'s W1-F owns the `w_*` kits: the change is flagged to the
  integrator in the handoff, and the header comment ("stage kits as aliases of the tier their band shops at") gets a
  note that S2 shops at Cornelia since PT-2. `tests/balance/questCurve.test.ts` (S2 replayed in its kit) is run too.
- Verifier: quest.yaml's `towns.pravoka.opensAfter` stays `[S1]` (the inn and the clinic are keepers and open after
  S1). The 5 gates are new generic mutation elements ("gate removed" lets a shop open early, which no proof
  measures), so S2 gets 5 `nonLoadBearing` entries in the full form `{map: pravoka, kind: gate, at: [x, y], reason: ...}` (one per
  door cell above; reason "shop shutters of the pirate
  occupation; the inn and clinic open after S1"), and the agent runs `npm run quest -- --strict --mutate` (allowed:
  nonLoadBearing edited).
- Known wrinkles for the user: the pirate at the gate still says "Pay at the shops, sleep at the inn", and the den's
  pirate "The door's nailed shut" while the den now opens (dialog lines; left alone under the presence-only rule); the herbwife's pre-fight Matoya hint is no longer heard (she is
  indoors until the fight; after it her line still names Matoya, and Matoya's herb is needed only at S7, after the
  ship).

### PT-3 (doors that lead nowhere): every drawn door is a room

Four new interiors from the existing interior kit (`interiors_common`), in a new file `a1/town_pravoka_homes2.py`
(`town_pravoka_homes.py` is 222 lines), written by `town_pravoka_rooms.py`. Single-word slugs, so one slug gives both
the map id and the entrance (`Town.house(slug)`: map `pravoka-house-<slug>`, exits to `house_<slug>`; `home(slug)`:
object `house_<slug>`, whose door entrance `build_map` names after the object):
- `loft` (was `sail_loft`): map `pravoka-house-loft`, entrance `house_loft`; sails on the walls, a cutting table, the
  sailmaker.
- `cottage` (was `boarded_cottage`): `pravoka-house-cottage` / `house_cottage`; a family that boarded its own windows.
- `storehouse` (was `old_warehouse`, on piles, `on_water`): `pravoka-house-storehouse` / `house_storehouse`; an
  emptied store, its keeper counting what is left.
- the den keeps its object name `pirates_den` (the AR-W2 swap key in `town_theme.TOWNS["pravoka"]["swaps"]`), so its
  entrance is `pirates_den`; its room is built with `PRAVOKA.shop("pravoka-den", ..., back="pirates_den")`; map
  `pravoka-den`. The crew's bunks and loot; one pirate quartermaster with `hideIf: BIKKE_DEFEATED`, a fisher's lad
  with `showIf` after.
One or two new NPCs per room, no chests (no economy change). `home()` becomes `obj(**{**HOUSE, **kw}, ...)` so a row
may override `windows` (the loft keeps `[1]`, the cottage `[]`, the storehouse `[1, 3]`); storeys 1 for all three (as
today). The den gets `door=3` and `enter` (the column its art draws the door at): its swap tuple gets door 3 and
`town_theme.apply` sets `o["door"] = door` for a swap with a door (a no-op for the two other swaps, whose door is 2 as
the house's). Each room's exit returns to the cell in front of its door. The canon (`world_canon.py`, read-only to
tranches) is not edited: `a1_t_town`'s `rooms` (12 canon maps) stays, and the new door test reads the town source's
objects and the compiled transitions, not the canon.

### PT-4 (Pravoka's port)

In act 1's pins (`a1/world_a1_pins.py`, Cornelia-relative): a 2-cell plank quay `=` on the shore cells west of the
dock, rel (39, -9) and (39, -8) (world (185, 146), (185, 147); TEMPLATE chars, which the composer keeps as they are),
so the arrival walks onto planks beside the berth; and two mooring posts (`dock_post_icon_0_0`, `on_water`, `block:
false`, so the ship still sails) on the Water cells north and south of the berth, rel (40, -10) and (40, -8). The
channel (rel x 40-45) and the dock cell stay Water (act1's `channel_min_water`, `pins`); the quay is a pier (one end
on land at (185, 145), the other at the sea (185, 148)), not a bridge. `a1Pins.test.ts`'s "every act-1 object is
today's" exempts the two posts by name (`name: pravoka_mooring`), as it exempts the lighthouse. The after-preview
checks the organic painter draws a deck there.

### PT-5 (Elfheim's entries)

World (ELF content + the door tables):
- The south door: the frozen door offset (0, +1) of `elf_elfheim` is overridden to (0, -1) by a new `REDOOR` table in
  `world_specs/later_doors.py` (applied in `doors()` and `transitions()`; `today_doors_data.py` stays frozen). The
  site file `elf/town_elfheim_site.py` (pass W's cells, read by `elf_t_town.test.ts` for the door's offset from the
  gate; `world_sites.py` reads it only for functions no longer called on the NW world) gets the same change: `DOOR =
  (82, 149)`, `ICON` rows 147-149, and `WEST_DOOR` (81, 148) / `EAST_DOOR` (83, 148). The
  arrival cell `elf_elfheim` (132, 196, the anchor's target: proof (g) unchanged) is now **south** of the icon; the
  icon moves up to (131-133, 193-195) with its door the bottom-middle cell (132, 195), where the art's gate is.
  `elf/world_nw.elfheim` builds the icon from the door (bottom-middle walk cell); the top corners keep their hedge
  clumps.
- Side doors: two new entrances `elf_elfheim_west` / `elf_elfheim_east` (the cells beside the icon's middle row,
  (130, 194) / (134, 194)). `common.sites(extra=)` takes Cornelia-relative points, so `elf.spec()` adds them after
  `sites("elf")` from the anchor's cell: `elf_elfheim` + (-2, -2) / (+2, -2) and two `DOORS` rows
  in `later_doors.py`: the icon's middle-row side cells (131, 194) / (133, 194) are walk cells whose transitions lead to
  `elfheim:west_gate` / `east_gate`. Each door has one way in (its arrival cell; the other 3 neighbours are icon art).
  `world_nw.content` stamps both arrival cells grass and, after the icon, routes a short road from each to
  `elf_elfheim` (`RD.route`), so the side doors read as ways in and the `road_check` has no stub. The overworld
  transitions keep `elf_elfheim`'s first (`wayOutSearch` takes the first; `worldRevalidate.test.ts`), the side ones
  are appended. `elf/world_nw.py` stays under 250 lines (a helper file if needed). Figures recorded after the
  regen: `dock_towns` elfheim (9 today, limit 12) and the Elfheim-keep / -marsh walk ratios of `elf_o_world`.
- The icon art has no gate drawn on its sides (no new art in this pass): the roads lead into the side cells.

Town (`elf/town_elfheim.py`): two new 2-wide gates through the hedge ring on the north lane's row (dirt `,`; the
hedge fill skips roads): west, x 0-5 on rows 23 and 24 (row 23 joins the lane at x 4, row 24 the west lane at x 6);
east, x 46-51 on rows 23 and 24 plus (44, 24) and (45, 24) (row 23 joins the lane's end at x 45, row 24 meets it at
x 44); transitions on the edge columns
(x 0 / x 51, y 23-24) to `overworld:elf_elfheim_west` / `_east`; entrances `west_gate` (2, 23) and `east_gate` (49,
23). The south gate is unchanged. The NOTE / docstring / signpost lines that say "a single south gate" are updated.

## Tests (each fails before its fix)

- `tests/data/worldBridges.test.ts` (new): on the committed world source with the patches on (`worldGrid.ts`), every
  `=` component is a straight span whose cells beyond both ends are walkable (a crossing), or a pier: one end walkable
  land, the other open Water `o` (Cornelia's jetty, Pravoka's quay). Fails today on (131-132, 122), (159, 133),
  (162, 132-133). Plus a mutated-input case (a bridge pointing into a mountain fails).
- `python3 -I assets-src/tools/worldgen/selftest.py`: a new `case_ford_bend` (a corridor down a river's bend gets its
  ford across the stream, never along it); `case_fords` unchanged.
- `tests/quest/a1/a1_t_town.test.ts` (extended): every drawn house door (every `house` / door-bearing prefab object of
  the source) has a transition, every transition target map and entrance exists, each room leads back to the
  entrance in front of its door (the canon-link test, generalised to all doors); before BIKKE_DEFEATED no townsfolk
  NPC is present outdoors and every shop door is gated (stepping on it is refused with the notice), after it the
  townsfolk are present and the gates open; the inn and clinic are reachable before. The hint test is changed to
  "after the fight" for presence.
- `tests/quest/a1/a1Pins.test.ts` or a new case: the dock `a1_pravoka` has a quay `=` cell next to it and mooring posts.
- Elfheim (new cases in `tests/quest/elf/` town / world tests): the overworld door into `elfheim:gate` is the icon's
  bottom-middle cell and the arrival `elf_elfheim` is the cell south of it; the west / east doors lead to
  `west_gate` / `east_gate`, the town's west / east edge transitions lead back to `elf_elfheim_west` / `_east`, and
  each arrival is the walkable cell beside its door (in and back out to the same door).
- Existing tests changed (each with the PT reason in a comment; no fixture is edited):
  - `tests/data/landmarkArt.test.ts` (town icons keep pass W's `walk_cells`): Elfheim is exempted from the pass-W
    comparison (PT-5) and checked instead to have exactly its three walk cells, the bottom-middle one the door into
    `elfheim:gate`, the middle-row sides into `west_gate` / `east_gate`; `door(o)` is compared with `into('elfheim')`
    as sets (the transitions are written south, west, east).
  - `tests/quest/elf/elf_o_world.test.ts` (one walk cell per icon): Elfheim's walk cells are its three doors, each
    with exactly one walkable neighbour (its arrival).
  - `tests/quest/elf/elf_t_town.test.ts`: the overworld transitions are the south pair to `elf_elfheim` plus the west
    / east pairs to `elf_elfheim_west` / `_east`; the site-file test reads the updated `DOOR`.
  - `tests/quest/a1/a1Pins.test.ts`: the mooring posts exempted by name.
  - `tests/quest/a1/a1_t_town.test.ts`: the hint test's presence part becomes "after the fight".
  - `tests/balance/w_a1_t.test.ts`: kit and measured values in the names.
- Scenarios (`debug-scenarios.yaml`): `pt_pravoka_pre`, `pt_pravoka_post` (spot in Pravoka; flags without / with
  BIKKE_DEFEATED), `pt_pravoka_dock` (the ship at the dock), `pt_elfheim_west`, `pt_elfheim_east`.

## Gates before handoff

1. Regenerate: `world.py`, `a1/town_pravoka.py`, `a1/town_pravoka_rooms.py`, `elf/town_elfheim.py`; re-run each:
   `git diff --exit-code assets-src/maps` clean the second time.
2. Compile `build_map.py overworld` (lock, alone), `pravoka`, the four new rooms, `elfheim`; then
   `build_map.py --check-determinism --changed overworld`, the plain `build_map.py --check-determinism <id>` for
   `pravoka`, `elfheim` and each new room, `mode7_atlas.py --check-determinism overworld`,
   `git diff --exit-code assets assets-src/maps` after a recompile.
3. `python3 -I assets-src/tools/worldgen/selftest.py`, `selftest_gates.py`.
4. `npm run quest -- --strict`, then `npm run quest -- --strict --mutate` (nonLoadBearing edited).
5. `npm run build`, `npm run test:fast`, the touched tests (`npx vitest run` on the files above, `w_a1_t`).
6. Browser (`?mute=1`, field scenarios): Pravoka before / after, the dock, Elfheim's three doors in and out;
   screenshots to `~/temp/ff-game/playtest/world/`.

## Result (2026-11-25)

Momus: REJECT (5 blocking: the four existing tests, the Elfheim site file, the den's link, the room / entrance names,
the `nonLoadBearing` form), then OKAY on the revision above.

- PT-1: the world ground changes in 6 cells for the fords (Matoya's (132, 122), across the stream; a1_pravoka's one
  ford (157, 132); (159, 133) and (162, 132-133) back to river). `world.py`: every check OK (prewalk S0-S14, act1,
  walks, detours, dock_towns elfheim 9, ...); worldgen selftest 10 / 10 (new `ford_bend`), gate selftest 23 / 23.
- PT-2: 8 townsfolk `showIf: BIKKE_DEFEATED`; 5 shop door gates `pravoka_shut_*`; `w_s2` = Cornelia's kit (Bikke 100 %
  at Lv3 / Lv4, both policies).
- PT-3: rooms `pravoka-house-loft`, `-cottage`, `-storehouse`, `pravoka-den`; 16 doors, each with its room and back.
- PT-4: quay `=` at (185, 146-147), mooring posts at (186, 145) / (186, 147).
- PT-5: Elfheim's icon at (131-133, 193-195), doors (132, 195) / (131, 194) / (133, 194); arrivals (132, 196) /
  (130, 194) / (134, 194); town gates west (x 0) and east (x 51) on rows 23-24.
- Gates: re-running the scripts is stable; `build_map.py overworld` 350 s; `--check-determinism --changed overworld`
  deterministic (46 changed chunks, 84 painted with the ring); `mode7_atlas.py --check-determinism` deterministic;
  plain determinism for pravoka, elfheim and the 4 rooms; `quest --strict` OK (866,403 states); `quest --strict
  --mutate` OK (68 gate rows, 114 elements; 117 jobs on 6 workers, wall 949 s, cache stored c5a728cc9c2c);
  `npm run build` OK; `npm run test:fast` 431 files, 10,339 tests passed (71 s).

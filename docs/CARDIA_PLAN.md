# CD: Cardia Deep, the dragon great village under the Cardia isles (plan, rev 2)

Base: `mainline` 8b676cd8. It includes AR-N3 (merged at 8678de55: Ember's dragon-kin lines and the ancient robots),
FX-S (merged) and CD-P's 20 Bedrock ledger rows (committed: e35d9715, f1a8431c). Request: the user, 2026-11-22
(verbatim in the brief). The brief is `DRAGON_CITY_BRIEF.md`. Planning only: CD-P edited no tracked file and made no
Bedrock call after rev 1.

**Rulings (integrator, 2026-11-22):** R1, R2 and R3 take the defaults: no door on the hermit's islet, no shop or inn,
and the four new NPC sheets. The `world_canon.py` edit is signed off and is CD-M's.

## Changelog: momus fixes (rev 1 -> rev 2)

| # | Momus | Fix (section) |
|---|---|---|
| 1 | v4 lair save resets to Cornelia (`wayOutSearch` takes the first open overworld transition; the draft's first was the north stair) | `bahamut_gate`'s stair is the **first** transition in `cardia-deep` (draft reordered and re-run). A source assertion and a test pin it. The save test asserts `reset: false`, the airship kept and `currentMap` `cardia-deep` (5.2, 8, 9) |
| 2 | Canon edit and merge order | the `world_canon.py` edit is in CD-M. Merge order: CD-M before, or in the same batch as, CD-W. CD-W alone points five transitions at a missing map (5.6, 10) |
| 3 | Ember's line; base | HEAD's merged lines are ported (draft updated). The "wait for AR-N3" step is gone; the base is 8b676cd8 (header, 5.1) |
| 4 | `w_ar_ember`; every reference | both lair scenarios retargeted; the full grep table with each reference's handling (5.7) |
| 5 | Pinned tests | `designNotes` 137 -> 136 and the NOTE text; `worldSource` spots 44 -> 48; `townThemes` sheets 9 -> 10; `arProps` exemption, `LIT`, `DUNGEONS` and per-prop approval; `ord_o_world` selects Bahamut's mouth by cell (5.1, 6.1, 9) |
| 6 | `_mouth` raises | it appends to the content hook's `errors` (3.2) |
| 7 | `doors()` and `RETARGET` | `RETARGET` also rewrites `doors()`' entrance -> targetMap dict (prewalk, dock_towns) (3.1) |
| 8 | Section 0's save line | v4-v5 saves load in `cardia-deep`; a v1-v3 save that owns the airship takes the D-NW8 reset to Cornelia, as before (0, 8) |
| 9 | Witness claim | removed. CD-Q reports which door the witness takes, and the xp gate holds either way (4.3, 5.2) |
| 10 | No `arrival` entrance | intended: WARP does nothing in `cardia-deep` (it is no floor of a chain), EXIT works (to `ord_bahamut`) (4.2) |
| 11 | `SITE_TARGETS` | cosmetic, not a gate: 24 NPCs plus the chest (9) |
| 12 | The brief's "plan 5.4" | fixed to 5.3 (warren floors) and 5.4 (steam) |
| 13 | Contrast check | adds `W` against `%` (5.3) |
| 14 | Exemptions | CD-W reports the exemptions figure against the cap of 600 (3.4) |
| 15 | Bahamut's height | `npc_field_cut.py` cuts fixed 48 x 96 cells (`GW, GH, FOOT = 48, 96, 93`), so Bahamut is capped at the cell (the hero's height). CD-N checks this first (6.2) |
| 16 | "a claw that was a finger" | the `ord_bahamut_trial` line is rewritten for the dragon-kin (5.5) |

Deliverables of CD-P (all in `~/temp/ff-game/cardia/`):
- the brief and this plan;
- `concept/`, the four concept boards and one not chosen;
- `raw/`, the 20 renders with their prompts and keys;
- `cut/`, the candidate cells at native size and x2;
- `candidates_cells.png`;
- `mock_cardia_deep_labelled.png` and `mock_cardia_deep_small.png`: a real in-memory compile of the draft layout
  with the candidate cells;
- `mock_court_crop.png` and `mock_hatchery_crop.png`;
- `mock_island_entrances.png`: the compiled world crop with the planned mouths, doors and landings;
- `draft/`: `cardia_deep.py`, `cardia_people.py`, the generated `cardia-deep.draft.yaml`, and the scratch tools
  `cdgen.py`, `cdcut.py`, `cdcut2.py`, `cdmock.py`.

**The draft compiles and passes every interior map check.** The real compiler,
`build_map.py cardia-deep --src-dir /tmp/cd-p/maps_ph --out /tmp/cd-p/out_ph`, with placeholder parts, took 2.4 s;
the themed in-memory compile ran with `check_interiors=True`.

## 0. Summary and success criteria

1. Cardia's isles behave as in classic FF1: there is a cave on the islands, and each one leads down to the dragons.
   **Five world doors** go into **one** map, `cardia-deep`: the existing door on Bahamut's isle (retargeted), plus
   new doors on the north, east, stack and west islets. The hermit's islet keeps only his hut (ruling R1).
2. `cardia-deep` (72 x 60 cells, 20 chunks, not streamed) is a single interconnected dragon village. It has nine
   districts and five short wild warrens, one per stair. Each world door is paired with a stair back up to **the
   same islet**.
3. The village absorbs `bahamut-cave` and `bahamut-lair`, and both ids are retired. Bahamut, his trade, the cutscene
   `ord_bahamut_trial`, `CLASS_UPGRADED` and the grotto chest `CHEST_ORD_O_GROTTO` keep their ids and behaviour. A
   v4-v5 save inside a retired map loads at the matching place in the city. A v1-v3 save there that owns the airship
   takes the D-NW8 reset to Cornelia, as it does today.
4. Progression is unchanged. The isles stay airship-only (S17 on). S19's `requires`, `grants`, `after` and `optional`
   are frozen. Its xp is held within +-15 % by giving the warrens the old cave's encounter table and rate on a
   matching walkable cell count.

```json
{
  "functional": [
    "overworld has exactly five transitions into cardia-deep, at ord_bahamut, ord_isle_north, ord_isle_east, ord_isle_stack, ord_isle_west (each one step north of its entrance)",
    "for each, cardia-deep has an entrance of the paired name and a stair whose transitions target overworld at that same islet entrance",
    "every cardia-deep entrance reaches every other on foot (one connected walk graph, no gate, no flag)",
    "every Cardia islet with a door is still its own landmass, airship-only, with a grass landing spot ord_s_<isle>_airship within 8 steps",
    "Bahamut's trade (requiredItem ordeal_seal, cutscene ord_bahamut_trial, onceFlag and actionFlag CLASS_UPGRADED, classUpgrade) is byte-identical to the old lair's",
    "the warrens' walkable cells total 150-204 (bahamut-cave had 177) with the old CAVE_FIGHTS table at rate 24-36; the village proper rolls no encounter",
    "a v4-v5 save whose currentMap is bahamut-cave or bahamut-lair loads in cardia-deep at entrance bahamut_gate or court (reset false, its airship kept); a v1-v3 save there that owns the airship takes the D-NW8 reset to Cornelia, as before",
    "S19 requires/grants/after/optional unchanged; npm run quest -- --strict and --strict --mutate OK"
  ],
  "observable": [
    "world.py prints every check OK (landings, north, coverage, pins, G-NW1-3, land)",
    "the curve model's S19 level and the following stages' levels beside the baseline (CD-0)",
    "the field previews ?mute=1&scenario=cd_court | cd_isles | cd_warren and the review sheets in ~/temp/ff-game/cardia/int/"
  ],
  "pass_fail": [
    "npm run build OK; npm run test:fast OK; the touched tests OK",
    "python3 -I assets-src/tools/layouts/world.py: every line OK",
    "build_map.py --check-determinism overworld cardia-deep and mode7_atlas.py --check-determinism overworld OK",
    "re-running every touched layout script leaves git diff --exit-code assets-src/maps clean",
    "stubs.py --check all prints stubs: 0 left; world_canon.check() is empty",
    "npm run quest -- --strict OK; --strict --mutate OK (background)"
  ]
}
```

## 1. Baseline (measured at b956f2ba on the committed source; Cardia's world, maps and quest data are unchanged at 8b676cd8)

| Item | Today |
|---|---|
| Cardia's land | Bahamut's isle x 159-166, y 82-90 (58 cells: forest, a rock notch, grass); named islets as components: north (148-153, 57-61), hermit (150-156, 68-74), east (163-168, 72-77), stack (152-157, 78-83), west (144-149, 86-90); look-only (138-145, 66-73), (142-149, 75-81), (134-139, 84-88); another ORDEAL-owned islet (167-170, 58-61) |
| Entrances (world) | `ord_bahamut` (163, 86); `ord_isle_north` (151, 59), `_hermit` (152, 70), `_east` (165, 74), `_stack` (154, 80), `_west` (146, 88). The islets' entrances are reach roots only today: no transition, no icon |
| Note | `world_specs/ordeal.py`'s docstring says the hermit's islet is the northernmost. It is not: the north islet (y 59) is. Fix the docstring in CD-W |
| Doors (world) | one into Cardia: (163, 85) -> `bahamut-cave` `arrival`, from the frozen `today_doors_data.py` |
| Landing spots | `ord_s_bahamut_airship` (163, 87) only; `ord_o_world.test.ts` checks a grass landing within 8 steps of every islet |
| Reachability | the airship only: no dock, no walk or canoe link (`ord_o_world` "is airship-only"). The airship comes at S17 (`AIRSHIP_RAISED`), so Cardia is open from S17 |
| `bahamut-cave` | 28 x 26; 177 walkable cells, encounter rate 24-36, `CAVE_FIGHTS` (wyrm / basilisk / wyvern); chest `chest_grotto` diamond armlet, `CHEST_ORD_O_GROTTO` |
| `bahamut-lair` | 32 x 22, no encounters; Bahamut, `bahamut_after`, the six dragons (`dragon_ember` ... `dragon_storm`), on AR-N2's sheets |
| S19 | `maps: [bahamut-cave, bahamut-lair]`, `zones: [overworld:ord_isles]`, `grind: 2.0`, `walk: ["bahamut-lair:cutscene:bahamut"]`, `entry` at `ord_s_citadel` with the airship, `nonLoadBearing: []`, optional |
| Mutation elements of S19 | Bahamut's `hideIf`, `requiredItem` and cutscene flag (GT-24 `item ... ordeal_seal`); no flagged transition anywhere in Cardia |
| **CD-0 measures** (measured by CD at 8b676cd8, `npm run quest -- --strict --json`) | curve levels (proof (d)): S17 L25.0, dragon_zombie L26.2, **S19 L26.5**, S20 L25.1, S21 L28.8, S22 L25.1, S23 L26.6, drowned_sovereign L28.6, S25 L28.7, S26 L28.8, S27 L30.3, hollow_seraph L33.9, S29 L34.0, lich_2 L35.3; (c) 835,121 states; `world.py`: every check OK, land 26,948 in [26,000, 31,800], exempt 440 (cap 600) |

## 2. Decisions

| Id | Decision |
|---|---|
| D-CD1 | **One map**, `cardia-deep`, 72 x 60 (4,320 cells; 5 x 4 = 20 chunks, under `STREAM_MIN_CHUNKS` 64, so it is never streamed; Cornelia is 62 x 72 with 20 chunks). It compiles in about 2.4 s. A split into several maps was rejected: the user asked for one village, and a split would add seams, map loads and more retired-save cases. |
| D-CD2 | **Five doors**: `ord_bahamut` (retargeted), `ord_isle_north`, `ord_isle_east`, `ord_isle_stack` and `ord_isle_west`. The hermit's islet gets none (R1): his 2 x 2 hut sits exactly where a mouth would go (the entrance minus (1, 2)), and his slate is the surface's one human voice. The look-only islets stay look-only. |
| D-CD3 | **Airship only**, as today. No dock and no ship landing are added. The ship can sail the Cardia Sound but cannot disembark without a dock. |
| D-CD4 | **Retire** `bahamut-cave` and `bahamut-lair`: the layout script, the sources, the compiled maps, the `index.yaml` rows and the canon rows. A pure relocation rule moves saves (section 8). Their ids are kept in `RETIRED_MAPS` only. |
| D-CD5 | **Safe village, wild warrens.** The map-level rate is quiet (999). One encounter zone, `ord_deep_warrens`, covers the five warrens with the old `CAVE_FIGHTS` at rate 24-36 and the backdrop `cave`. Its walkable cells number 150-204 (177 +- 15 %), so the curve model's one exploration of the map costs what the old cave's did. |
| D-CD6 | **Frozen**: S19's `requires`, `grants`, `after` and `optional`; Bahamut's trade fields; `ord_bahamut_trial`'s steps and flags (its text is not: 5.5); `CHEST_ORD_O_GROTTO`; every other stage. Allowed: S19's `maps`, `walk` and `milestones` (none are added). |
| D-CD7 | **No player shop and no inn** (R2). The Ember Market is flavour: "your gold would only be something to sleep on". This leaves the town proofs (e) and (f) and `towns:` untouched. |
| D-CD8 | **One liquid per map.** The compiler paints every `~`, river and lake cell with the `water` material (`build_map.py:317`). So Cardia Deep's liquid is sea water (the Grotto pool, the Hatchery's warm spring channel), not lava. The pool's grass rim is remapped (`materials.grass`), as verified in the mock. |
| D-CD8b | **Later doors module.** `world_specs/today_doors_data.py` stays pass W's frozen data. New and retargeted doors go in a new `world_specs/later_doors.py`, which `world_source.doors()` and `.transitions()` read after the frozen ones. |
| D-CD9 | **Names.** The map is `cardia-deep` and its HUD name is "Cardia Deep". Entrances: `bahamut_gate`, `north`, `east`, `stack`, `west` (one per world door) and `court` (before the dais: the relocation target and the debug start). |

## 3. World (tranche CD-W)

### 3.1 Doors and transitions

Create `assets-src/tools/layouts/world_specs/later_doors.py` (under 60 lines):

```python
"""Doors added after pass W's freeze (today_doors_data.py stays pass W's): (entrance, door offset, targetMap,
targetEntrance), and the frozen doors whose target moved (pass CD, docs/CARDIA_PLAN.md 3.1)."""
DOORS = [("ord_isle_north", (0, -1), "cardia-deep", "north"),
         ("ord_isle_east", (0, -1), "cardia-deep", "east"),
         ("ord_isle_stack", (0, -1), "cardia-deep", "stack"),
         ("ord_isle_west", (0, -1), "cardia-deep", "west")]
RETARGET = {"ord_bahamut": ("cardia-deep", "bahamut_gate")}
```

Make these edits in `world_source.py`:
- `doors()` adds `{e: (off, target)}` for each row of `DOORS`, and applies `RETARGET` to **both** of its dicts. The
  second dict (entrance -> targetMap) feeds `prewalk` and `dock_towns`, so `ord_bahamut` must map to `cardia-deep`
  there too.
- `transitions(sites)` applies `RETARGET` to the frozen rows (`targetMap` and `targetEntrance`; the cell is
  unchanged), then appends one transition per `DOORS` row at `sites[e] + off`. Each new transition has `x`, `y`,
  `targetMap` and `targetEntrance`, in `DOORS` order.

`stamps.sites` already clears every site's door cell `(x, y - 1)` to grass and exempts it, so the generator needs no
change. Check that `blocked` in `world.build` (the transitions, gates and entrances) now holds the four new door
cells, so no spot resolves onto them. It does, because it is built from `trans`.

### 3.2 Cave mouths (ORDEAL's content, `ordeal/world_ordeal_nw.py`)

- Generalise `_cave(gr, meta)` into `_mouth(gr, meta, e)` with today's body, and call it for
  `("ord_bahamut", *DOOR_ISLES)`, where `DOOR_ISLES = ("ord_isle_north", "ord_isle_east", "ord_isle_stack",
  "ord_isle_west")`.
- Each call puts a 2 x 2 `cave_mouth` at (door x - 1, door y - 1) with `walk_cells [[1, 1]]`, a rock ring on the
  islet's own land (water cells are skipped, as today), and the door's east cell as rock.
- CD-P simulated the stamp on today's ground (`mock_island_entrances.png`). Every islet keeps its walk links and
  6-13 grass landings within 8 steps: north 13, east 6, stack 6, west 9. The mouth's top row lands on the islet's
  north shore: on north (150-151, 57), east (164-165, 72; forest to grass), stack (153-154, 78) and west (145-146, 86).
- `_hermit` is unchanged.
- **Rock on tiny islets.** `_mouth` returns an error string, and `content()` appends it to the dict's `errors`
  list (`world_content.CONTENT_LISTS`; the errors join the `pins` check, so `world.py` prints `pins: FAIL` and exits
  1). It never raises. The error fires when the islet's walk component after the stamp has fewer than 12 cells, or
  when no grass cell within 8 steps is left outside the mouth. Message: `ordeal: <entrance> mouth leaves <n> walk
  cells / no landing within 8`.
- **Fallback, if the generator's islets ever shrink:** raise that islet's `ISLE_R` from 2.8 to 3.4, like the
  hermit's. Re-check the land figure (26,948 at NW2-INT; the floor is 26,000) and G-NW1-3.
- Fix the module docstring and `ordeal.py`'s: Cardia has a cave on every named islet but the hermit's, and the
  north islet is the northernmost.

### 3.3 Spots

In `world_specs/ordeal.py`, add these to `spots`, after `ord_s_bahamut_airship`:

```python
SpotDef("ord_s_north_airship", "ord_isle_north", (0, 1), "landing"),
SpotDef("ord_s_east_airship", "ord_isle_east", (0, 1), "landing"),
SpotDef("ord_s_stack_airship", "ord_isle_stack", (0, 1), "landing"),
SpotDef("ord_s_west_airship", "ord_isle_west", (0, 1), "landing"),
```

Today's targets (151, 60), (165, 75), (154, 81) and (146, 89) are all grass. The resolver takes the nearest landing
within 6 cells that is not under an object and not on a transition, gate or entrance.

### 3.4 Checks to watch (`world.py` prints one line each)

- `pins`: the spots and `_mouth`'s errors.
- `landings`: grass only; the `north` anchors `ord_citadel` and `ord_bahamut` still each have a landing.
- `north`: the islets stay separate walk+canoe components. **The underground link is a map transition, not a
  world-map walk, so no world check sees it.**
- `coverage`: the new mouth cells are walkable and owned by ORDEAL. `zones()` runs after the stamps in `content`,
  so they fall into `ord_isles`.
- G-NW3: the stack islet's rows 77-81 cross the chunk line y 80. Its class run is at most 6 cells (the islet is 6
  wide), so it stays under the gate, but check the line.
- `land`: unchanged (the stamps change classes, not land).
- G-NW1 and G-NW2: unchanged (no coast moves).
- `exempt`: CD-W reports the exemptions figure against the cap of 600 (440 at NW2-INT). The four new door cells add
  at most 4 (`stamps.sites` already exempts each site's door cell, so the expected change is 0).

### 3.5 Compile

- Iterate with `python3 -I assets-src/tools/layouts/world.py`, then
  `python3 -I assets-src/tools/build_map.py overworld --region ordeal`.
- Check that the changed chunk files are a subset of `world.py --owned-chunks ordeal` plus any digest-changed
  neighbours (peaks reach across chunk lines).
- At the tranche end, run the full compile: `build_map.py overworld`, under the world-compile lock, one at a time,
  about 335 s and 15 GB.
- Then run `build_map.py --check-determinism overworld` and `mode7_atlas.py --check-determinism overworld`.
  `tests/data/mode7Atlas.test.ts` must pass (never hand-merge `mode7*.png`; risk R13).

## 4. Quest, verifier and mutation (tranche CD-Q)

### 4.1 `assets/data/quest.yaml`, S19

```yaml
    maps: [cardia-deep]
    zones: [overworld:ord_isles]
    # fly from the citadel's meadow to Bahamut's isle (or any Cardia islet with a cave); down its stair, through the
    # warren into Cardia Deep; lay the seal before Bahamut in his Court
    walk: ["cardia-deep:cutscene:bahamut"]
```

Leave `entry` (`ord_s_citadel` with the airship and ship spots), `grind` 2.0, `band`, `kit`, `requires`, `grants`,
`after`, `boss: []` and `optional: true` as they are. `nonLoadBearing` stays `[]`:
- The new transitions carry no flag, so they are not generic mutation elements (`questMutateGeneric.ts`: only a
  transition's `requiredFlag(s)` is mutated).
- Bahamut's `hideIf`, `requiredItem` and cutscene move map but keep their meaning, so GT-24 still catches them.
- Five doors to one map add no skip: every islet needs the airship already.

### 4.2 The verifier

- No code change is expected. The catalog builds `cardia-deep:cutscene:bahamut` from the NPC id `bahamut` and its
  cutscene, as it did for the lair.
- **No `arrival` entrance, by design.** `cardia-deep` is a site, not a floor of a chain. WARP does nothing there (no
  floor below), and EXIT works (to `ord_bahamut`). The canon row lists `bahamut_gate` first as the walking way in.
- `questExits` / `exit`: `cardia-deep.exit = {map: overworld, entrance: ord_bahamut}` (the EXIT spell). A party that
  leaves by another islet's stair, or by EXIT, while the airship is parked elsewhere is not stranded: every islet's
  stair leads back into the city, and the city reaches every stair. Proof (c) proves this; `--from-reset` samples it.
- The state count grows only by the new place cells (five doors, one map), against `MAX_STATES` 3,000,000 and
  835,121 at NW2. Report the figure.
- `questTravelRows.AIRSHIP_ONLY`: unchanged (`ord_bahamut` stays; the islets are not anchors).
- `world-anchors.yaml`: unchanged (the `bahamut` anchor is still `ord_bahamut`).

### 4.3 Gates (in the background)

- `npm run quest -- --strict` (about 2 min, an 8 GB heap).
- `npm run quest -- --strict --mutate` (heavy; run it with `run_in_background`, never in the foreground).
- `npm run quest -- --strict --from-reset`.
- **Report which door the witness of (a) takes for S19** (from `--json`: S19's segments, the overworld transition
  into `cardia-deep`). The witness starts at `ord_s_citadel`, and the north islet is nearer the meadow than Bahamut's
  isle, so it may well enter by `north`. Either way is fine:
  - the gate below does not depend on the door, because the curve model explores `cardia-deep` once on first entry
    (every warren cell, whichever door), and each warren's walk to the village is 6-18 warren steps;
  - report the door and the S19 segment's fight count beside CD-0's.
- Compare the curve model's levels with CD-0's. S19's end level must be within 0.11 of the baseline (NW2-BAL's
  tolerance), and S20-S30 must be unchanged to 0.11. If S19 moves more, trim or extend the warrens toward 177
  walkable cells (D-CD5). Never change `grind` for this.

## 5. The city map (tranche CD-M)

### 5.1 Files

Create:
- `assets-src/tools/layouts/ordeal/cardia_deep.py` (the layout, under 250 lines; it ports `draft/cardia_deep.py`);
- `ordeal/cardia_people.py` (the NPCs, under 250 lines; it ports `draft/cardia_people.py`);
- the generated `assets-src/maps/cardia-deep.yaml`, compiled to `assets/maps/ai/cardia-deep.yaml` and
  `assets/maps/ai/cardia-deep/`.

Delete (`git rm`):
- `ordeal/bahamut.py`;
- `assets-src/maps/bahamut-cave.yaml` and `bahamut-lair.yaml`;
- `assets/maps/ai/bahamut-cave*` and `bahamut-lair*`;
- the two `assets/maps/ai/index.yaml` rows (the compiler rewrites the index; check it).

**Ember (AR-N3, merged at 8678de55).** Port the lines from HEAD's `ordeal/bahamut.py`. The draft has them:
- "I keep the door of this hall. Stare at the horns if you must; every guest does. Mind the claws instead."
- after `CLASS_UPGRADED`: "I can smell the change on you from across the hall. You burn hotter now."

Every other lair line is ported verbatim from HEAD (diff the six `dragon(...)` calls against `cardia_people.py`
before deleting `bahamut.py`).

**The design note** (`designNotes.test.ts`: `Concept:`, `Distinct:` with at least 2 features, `Topology:`, in that
order, in the header; written as `NOTE`, modelled on `bahamut.py`'s `NOTE_CAVE`, already in the draft):

```
Concept: one dragon-kin city carved in the basalt under the whole Cardia archipelago, every islet's cave a stair down
into it, every road meeting in the Wyrmhall below Bahamut's Court.
Distinct: five island stairs that all end under one roof, each through a short wild warren of roosting wyverns and a
wing-shaped ward arch; a hatchery of ember nests beside a steaming spring channel; a sea grotto pool under the west
islet; a court where the eldest receives the party before a throne carved as a seated dragon.
Topology: one map, no floors: overworld (ord_bahamut, ord_isle_north, ord_isle_east, ord_isle_stack, ord_isle_west)
-> five warrens -> Wyrmhall -> Court | Roost | Sanctum | Hatchery | Market | Gate hall | Grotto -> Hoard; every stair
leads back to its own islet; no boss.
```

(Each label is one line in the header: `Room.write` writes each line of the header as a `# ` comment.)

### 5.2 Layout (the draft, measured)

The ASCII grid below is what the draft prints (`W` wall top, `F` face, `-` floor, `+` dais cloth, `~` water, `=`
bridge):

```
            x 0         1         2         3         4         5         6         7
              012345678901234567890123456789012345678901234567890123456789012345678901
   y  4       WWFFFFFFWWWWFFFFFFFFFFFFFFFFFFFFFFFWWWWWWWFFFFFFFFFFFFFFFFFFFFFFFFFFWWWW
      6       WW------WWWW-----------------------WWWWWWW--------++++++++++--------WWWW   north warren | Roost | Court (dais)
     13       WWWW-------------------------------WWWWWWW--------------------------WWWW
     17       WWWWWWWWWWWWWWWWWWWWWW--WWWWWWWWWWWWWWWWWW--------------------------WWWW
     19       WWWWWWWWWWWWWWWWWWWWWW--WWWWWWWWWWWWWWWWWWWW---WWWWWWWWWWWWWWWWWWWWWWWWW   the Processional (x 44-46)
     23       WW---------WWW---------------------------------WWWWW------~~-------WWWWW   Sanctum | Wyrmhall | Hatchery
     28       WW--------------------------------------------------------~~-------WWWWW
     30       WW---------WWW---------------------------------WWWWW------==-------WWWWW   the bridge
     39       WW---------------WWW-------------------WWW---------WWWWW--WWWWFFFFFFWWWW   Grotto | Market | Gate hall | east warren
     41       WW----~~~~~~~----WWW-------------------FFF---------WWWWW--FFFF------WWWW
     52       WW---------FFF------WWWWWWW--------FFF--WWWWWWWW----------WWWWWWWWWWWWWWWW  Hoard+west | stack | Sea Gate warrens
```

The full grid is in `draft/cardia-deep.draft.yaml`. The districts, as inclusive carve rects:

| District | Rect | Links |
|---|---|---|
| Court | (42, 6)-(67, 17); dais `+` (50, 6)-(59, 9) | the Processional (44, 18)-(46, 22) to the Wyrmhall |
| Roost | (12, 6)-(34, 15) | (22, 16)-(23, 22) to the Wyrmhall; the north warren joins its west side at (10-11, 13-14) |
| Wyrmhall | (14, 23)-(46, 34) | to the Sanctum (11, 27)-(13, 28); the Hatchery (47, 28)-(51, 29); the Market (29, 35)-(30, 38); the Gate hall (44, 35)-(45, 38); the Grotto (14, 35)-(15, 36) |
| Sanctum | (2, 21)-(10, 32) | |
| Hatchery | (52, 24)-(66, 37); channel `~` (58-59, 24-37) with the bridge `=` (58-59, 30-31) | the east warren tunnel reaches its south at (56-57, 38) |
| Market | (20, 39)-(38, 48) | (39, 43)-(41, 44) to the Gate hall; the stack warren tunnel reaches its south at (36-37, 49) |
| Gate hall | (42, 39)-(50, 47) | the Sea Gate warren tunnel reaches its south at (46-47, 48) |
| Grotto | (2, 37)-(16, 46); pool `~` (6, 40)-(12, 43) | (5, 47)-(6, 50) to the Hoard |
| Hoard | (2, 51)-(10, 57) | the west warren tunnel joins at (11-12, 53-54) |

The warrens (zone `ord_deep_warrens`) are chamber rects plus 2-wide tunnels (`Grid.line`). They are built **in this
order**, so the stairs' transitions are written in it too:

| # | Entrance | Chamber | Tunnel | Stair (`stairs_up`, face rows) | Arrival |
|---|---|---|---|---|---|
| 1 | `bahamut_gate` | (50, 52)-(55, 55) | (48, 53) -> (46, 53) -> (46, 48) | (52, 50) -> `ord_bahamut` | (52, 52) |
| 2 | `north` | (2, 6)-(7, 8) | (4, 9) -> (4, 13) -> (10, 13) | (4, 4) -> `ord_isle_north` | (4, 6) |
| 3 | `east` | (62, 42)-(67, 44) | (60, 43) -> (56, 43) -> (56, 38) | (64, 40) -> `ord_isle_east` | (64, 42) |
| 4 | `stack` | (27, 53)-(32, 56) | (33, 54) -> (36, 54) -> (36, 49) | (29, 51) -> `ord_isle_stack` | (29, 53) |
| 5 | `west` | (14, 52)-(19, 55) | (12, 53) -> (11, 53) | (16, 50) -> `ord_isle_west` | (16, 52) |

The rev 2 draft (re-run) totals **198** walkable warren cells, inside [150, 204]. The zone's `rects` are each warren's
bounding box: [46, 48, 55, 55], [2, 6, 11, 14], [56, 38, 67, 44], [27, 49, 37, 56], [11, 52, 19, 55].

**Transition order (momus 1).** NW2's `wayOutSearch` (`worldRevalidate.ts:62`) returns the first open transition
that targets the overworld, in the map's `transitions` order. `bahamut_gate`'s two stair cells must therefore come
first, so that a v4 save relocated from the lair leaves by `ord_bahamut`, where its airship is parked
(`ord_s_bahamut_airship`). Under rev 1's order it left by the north islet, landed in a component with no airship,
and was reset to Cornelia.
- The re-run draft writes (52, 51) and (53, 51) -> `ord_bahamut` as transitions 0 and 1.
- `cardia_deep.py` asserts it before `write`:
  `assert r.transitions[0]["targetEntrance"] == "ord_bahamut"`.
- `ord_o_sites.test.ts` pins it (section 9).
- A v4 save could only have entered the lair by Bahamut's isle, so its airship is there.

`court` is at (54, 11), a clear floor cell three rows below Bahamut.

**Design rules.**
- Every warren is a dead end except through its arch into the village. Every district is reached from the Wyrmhall
  without crossing a warren, except the Hoard: the west warren opens into it, and it also links to the Grotto.
- The Sea Gate (Bahamut's isle) is the ceremonial way. Its route to the Court is Sea Gate warren -> Gate hall ->
  Wyrmhall -> Processional -> Court, about 70 steps, of which 14-18 are warren steps. Which door the verifier's
  witness takes is not assumed (4.3).
- No district is more than 3 links from any stair.

### 5.3 Map keys

The draft's `Room.write`:
- `kits ["castle", "interior", "temple", "town"]`, `music: town`, `canSave: True`;
- quiet `encounterRate {min: 999, max: 999}` and `encounters: []`;
- `encounterZones: [{id: ord_deep_warrens, name: "Cardia Warrens", rects: ..., encounterRate: {min: 24, max: 36},
  encounters: CAVE_FIGHTS}]`, with `CAVE_FIGHTS` copied verbatim from `bahamut.py`;
- `battleBackgrounds: {default: cave}`;
- `exit: {map: overworld, entrance: ord_bahamut}`;
- `no_static_chokepoints: True`, `no_unreachable_walkable: True`;
- add `contrast: [{a: W, b: "-", min: 0.2}, {a: W, b: "%", min: 0.2}]`: the dwarf hall's rule for the village floor,
  plus the warrens' rubble floor.

Materials:
- **village:** `in_wall_face {from: drg_wall}`, `floor_stone {from: drg_floor}`, `in_wall_top {from: slate, shade: 0.3}`,
  `grass {from: slate, shade: 0.45}` (the pool and channel rims), `carpet` for the dais `+` (the lair's crimson:
  `carpet_trim` [200, 160, 70] stays), and `water` from the AR calm sea (`water_calm` / `ar_ocean`; pick the teal
  that reads best in the review);
- **warrens:** `rubble` `%` (it compiles to ROAD, `build_map.py:85`: walkable, no hazard), mapped to `{from: ar_temple_rubble_cool, shade: 0.85, hue: 12, sat: 0.8}` (today's
  cave floor). Draw the warren floors with `%` instead of `-` (walkable rubble, no hazard) so they keep the cave
  look. The compiler's terrain for `%` is walkable. Confirm the curve model counts it as walkable for
  `explorationTables` (it reads `terrainAllows('walking', ...)`).

### 5.4 Set pieces and props (positions from the draft; nudge only by the map checks)

- `drg_throne` 3x3 at (53, 4), `on_wall`, `collide: alpha`.
- `drg_statue_big` 2x2 at (47, 7) and (62, 7).
- `drg_pillar` 1x2 at (44, 12), (49, 12), (60, 12) and (65, 12) (the Court), and at (18, 25), (26, 25), (34, 25),
  (42, 25), (18, 31), (26, 31), (34, 31) and (42, 31) (the Wyrmhall's two rows), all `fit: True`.
- `drg_statue` 1x2 at (28, 24) and (32, 24).
- `drake_brazier` (props_ar) at (16, 28) and (44, 28).
- `drg_nest` 2x2 at (53, 26), (62, 26), (53, 33) and (62, 33).
- `drg_pillar_slim` (or `drg_perch`, if a re-roll is approved) at (14, 8), (19, 8), (24, 8) and (29, 8).
- `gold_heap` at (4, 53), (8, 53) and (6, 56).
- `drg_arch` 4x3 over each warren mouth: the opening on the 2 walkable cells, the jambs on wall cells,
  `passage: true`. The mouths are north (10-11, 13-14) from the west, east (56-57, 38), stack (36-37, 49), Sea Gate
  (46-47, 48) and west (11-12, 53-54). Where a mouth runs east-west (north, west), set the arch on the district
  side's wall face only if a 2-row face exists. Otherwise put two `drg_statue` as gate-posts instead and record that
  in the layout's NOTE.
- The props are dressed by `layouts/props_ar_maps.py` `DRESS["cardia-deep"]` (each one gets its `flame` ambient):
  - a `wall_torch` every 6 to 10 face cells in the village, and one at each warren stair;
  - `brazier_tall` x 2 and `sun_brazier` x 2 flanking the dais;
  - `magma_mound` beside each nest;
  - `lava_vent` x 2 in the Hatchery;
  - `mushrooms_glow` x 3 and `candelabra` x 1 in the Sanctum;
  - `coral_pink` x 2, `kelp` x 2 and `clam_altar` x 1 in the Grotto;
  - `bone_pile` x 1 in each warren (the wyverns' meals, as the old west spur had).

  Total: about 45 props.
- Steam over the Hatchery channel: two `ambient: {kind: smoke}` entries at the channel's ends, if `VOLCANO_SMOKE`
  reads as steam at map scale. If it does not, leave them out (smoke has one style today; a "steam" style is a
  later, optional pass).
- The chest `chest_grotto`: diamond armlet, `CHEST_ORD_O_GROTTO`, at (15, 45) in the Grotto. Same id, item and flag.

### 5.5 NPCs (`ordeal/cardia_people.py`; the draft has all of them: 24 named NPCs plus `bahamut_after`, 25 entries, with their lines)

| District | NPCs (sprite) | Reactive on `CLASS_UPGRADED` |
|---|---|---|
| Court | `bahamut` / `bahamut_after` (unchanged trade, at (54, 7)), `dragon_ember` (guard, (46, 15); AR-N3's lines), `dragon_moss` (elder, (50, 11)), `ord_cd_herald` (guard, (60, 11)) | all |
| Roost | `dragon_storm` (guard), `ord_cd_roostmaster` (guard), `ord_cd_flier` (youth, `wander`) | 2 |
| Wyrmhall | `ord_cd_steward` (elder; names every road), `ord_cd_mason` (youth), `ord_cd_hint_citadel` (guard; the hint: "the Citadel of Trials, on the high plateau west of here. Fly") | 2 |
| Sanctum | `dragon_frost`, `ord_cd_archivist`, `ord_cd_sleeper` (elders) | 2 |
| Hatchery | `ord_cd_eggwarden` (elder), `ord_cd_hatchling` (youth, `wander`), `ord_cd_chick` (youth) | 1 |
| Market | `ord_cd_pearl`, `ord_cd_gossip` (youths; the gossip about Oddo, `wander`), `ord_cd_baker` (elder) | 1 |
| Grotto and Hoard | `dragon_tide`, `dragon_ash` (youths), `ord_cd_counter` (elder) | 2 |
| Sea Gate | `ord_cd_gatewarden` (guard; "every islet has its stair, and every stair ends here") | 1 |

- The six dragons and Bahamut keep their ids, sprites and lines (Ember with AR-N3's). In all: 24 named NPCs plus `bahamut_after`, 25 entries (and the grotto chest).
- New ids use the prefix `ord_cd_`. Every line is original and dry in tone.
- No NPC stands in a 2-wide link, so the map check `no_static_chokepoints` passes (as it does on the draft).
- `wander` is only for youths (whose side rows walk; `sage_star`'s no-wander rule does not apply to these sheets).
- After CD-N, `cardia_people.NEW_SHEET` moves:
  - the hatchlings to `dragon_hatchling`;
  - the pearl trader, the baker and the egg-warden to `dragon_matron`;
  - the archivist and the sleeper to `dragon_sage`;
  - Bahamut to `bahamut` (with no `tint`).

**The trial cutscene (momus 16).** In `assets/data/cutscenes.yaml`, `ord_bahamut_trial`'s first dialog step changes
from "... Bahamut turns it over once with a claw that was a finger a moment ago." to:

> "You lay the seal on the crimson cloth. Bahamut turns it over once with one gold-scaled claw, and the hall goes still."

The other steps are unchanged. The cloth is crimson to match the dais (D-CD8, the brief). `ord_o_sites.test.ts`
asserts only the `take_item` and `set_flag` steps, so no test changes.

### 5.6 Canon, stubs, debug scenarios

- **`world_canon.py`.** Replace `floors(["bahamut-cave", "bahamut-lair"], ...)` with:

  ```python
  room("cardia-deep", "ORD-O", "site", "Cardia Deep",
       (("bahamut_gate", "the Sea Gate, from Bahamut's isle"), ("north", "the north islet's stair"),
        ("east", "the east islet's stair"), ("stack", "the stack islet's stair"), ("west", "the west islet's stair"),
        ("court", "before Bahamut's dais (retired-save relocation, debug start)")),
       ("overworld", "ord_bahamut"),
       (("north", "overworld", "ord_isle_north"), ("east", "overworld", "ord_isle_east"),
        ("stack", "overworld", "ord_isle_stack"), ("west", "overworld", "ord_isle_west")))
  ```

  **CD-M makes this edit** (integrator sign-off, 2026-11-22), in the same commit that deletes the `bahamut-*`
  sources. Otherwise `stubs.py` would write stubs for the two retired ids, and `stubs.py --check all` would fail.
  Then:
  - `world_canon.check()` must be empty;
  - `stubs.py --check all` must print `stubs: 0 left`;
  - the canon goes from 137 rows to 136 (two rows out, one in; `designNotes.test.ts:35`).
- **`assets/data/debug-scenarios.yaml`.**
  - `w_s19_start` stays (the overworld at `ord_bahamut`, the seal held).
  - `w_ar_lair` (line 2831, `bahamut-lair` spawn [19, 12]) becomes map `cardia-deep`, spawn [54, 12] (before the
    dais, below `court`). Keep its id, so AR-N2's notes still find it; its name becomes "AR - the dragon-kin of
    Cardia Deep's court".
  - `w_ar_ember` (line 2881, `bahamut-lair` spawn [12, 9], one cell below Ember) becomes map `cardia-deep`, spawn
    [46, 16], one cell below Ember at (46, 15). Keep its id; its name says "Bahamut's court".
  - Add `cd_court`: map `cardia-deep`, entrance `court`, the seal held (the S19 party of `w_s19_start`).
  - Add `cd_isles`: the overworld at `ord_isle_east`, with the airship at `ord_s_east_airship`.
  - Add `cd_warren`: map `cardia-deep`, entrance `north`.

### 5.7 Every `bahamut-cave` / `bahamut-lair` reference (grep at 8b676cd8, excluding `.claude/`, `node_modules`, caches)

| Reference | Handling |
|---|---|
| `assets-src/tools/layouts/ordeal/bahamut.py` | `git rm` (CD-M), after porting every line to `cardia_people.py` |
| `assets-src/maps/bahamut-cave.yaml`, `bahamut-lair.yaml` | `git rm` (CD-M) |
| `assets/maps/ai/bahamut-cave.yaml`, `bahamut-lair.yaml`, `assets/maps/ai/bahamut-cave/`, `bahamut-lair/` | `git rm` (CD-M) |
| `assets/maps/ai/index.yaml` (rows 2-3) | the two rows removed, `cardia-deep` added (the compiler writes the index; verify) |
| `assets-src/tools/layouts/world_canon.py:125` | replaced by the `cardia-deep` row (CD-M, 5.6) |
| `assets-src/tools/layouts/world_specs/today_doors_data.py:51` | **unchanged** (frozen pass W data); `later_doors.RETARGET` re-points it (CD-W, 3.1) |
| `assets-src/maps/overworld.yaml`, `assets/maps/ai/overworld.yaml` | regenerated by `world.py` and the world compile (CD-W) |
| `assets/data/quest.yaml:510, 514` | S19 `maps`, `walk` (CD-Q, 4.1) |
| `assets/data/debug-scenarios.yaml:2831` (`w_ar_lair`), `:2881` (`w_ar_ember`) | retargeted (5.6) |
| `tests/quest/ordeal/ord_o_sites.test.ts:22, 102` | rewritten for `cardia-deep` (9) |
| `tests/quest/ordeal/ord_o_world.test.ts:82` | `['ord_bahamut', 'cardia-deep']`, entrance `bahamut_gate` (9) |
| `tests/quest/townTargets.ts:105` | `SITE_TARGETS` row (9) |
| `tests/quest/originality.test.ts:91` | `cardia-deep` is a `site`, not a `floor`, so it leaves the dungeon list. ORD-O's dungeons go from 2 to 1, which satisfies the rule `branching * 2 >= total` (measured at 8b676cd8: `citadel: branching`, `bahamut: chain`; so ORD-O goes from 1 of 2 to 1 of 1). Reword the stem comment to "floors without a floor label are grouped by their stem" (it loses its example) |
| `tests/data/arNpcArt.test.ts:74, 108` | `npcs('cardia-deep')` (9) |
| `AGENTS.md:275` | the map table row: `ordeal/citadel.py`, `ordeal/cardia_deep.py` (+ `cardia_people.py`) -> `citadel-1f` .. `-3f`; `cardia-deep` (CD-INT) |
| `docs/WORLD_PLAN.md:1045, 1369, 3944, 3958, 3974, 4023-4024, 4033, 4054, 4074, 4077, 4094` | **history, unchanged.** CD-INT adds one line under its ORD-O section: "Superseded by pass CD (docs/CARDIA_PLAN.md): both maps retired into `cardia-deep`" |
| `docs/PLAYTEST_FIXLIST_PLAY2.md:36`, `docs/PLAYTEST_RECHECK_PLAY_R.md:28` | **history, unchanged** (P3-03's `bahamut_after` behaviour still holds in `cardia-deep`; `NpcPresenceRefresh.test.ts` covers it) |
| `tests/fixtures/passW/overworld.yaml` | **never edited** (a frozen fixture) |
| `src/scenes/exploration/NpcPresence.ts:6`, `tests/scenes/NpcPresenceRefresh.test.ts:11` | they name `bahamut_after`, not a map: unchanged |
| `src/systems/retiredMaps.ts` (new) | the only live mention after CD: `RETIRED_MAPS` (8) |

CD-INT re-runs the grep. Only the history docs, the frozen fixture, `today_doors_data.py`, `retiredMaps.ts` and its
test, and the `RETARGET` comment may still match.

## 6. Art kit (tranches CD-A, CD-N)

### 6.1 CD-A: the theme sheet and the prop

**`assets-src/gen/town_theme_spec.py`.** Add a `"dragon"` entry, which `town_theme_cut.py` cuts to
`gen/approved/town/theme_dragon.{png,json}`:

```python
"dragon": dict(
    theme=None,
    sprites=[("drg_statue", "cd_statue", "406fde010f96f10ccad24bc5", (1, 2), {}, {}),
             ("drg_statue_big", "cd_statue", "406fde010f96f10ccad24bc5", (2, 2), {}, {}),
             ("drg_pillar", "cd_pillar2", "bf254f96c4f08a8651765a6b", (1, 2), {"bg_passes": 3, "tol": 30}, {}),
             ("drg_pillar_slim", "cd_pillar", "46e7d9fa06a1e9a195c64379", (1, 2), {}, {}),
             ("drg_arch", "cd_arch", "f29546b1e85d175ef327ebc8", (4, 3), {}, {}),
             ("drg_throne", "cd_throne", "169697a8d235f6e3b16a161b", (3, 3), {}, {}),
             ("drg_nest", "cd_nest", "5657a4ea62e661844244c20c", (2, 2), {}, {})],
    mats=[("drg_wall", "cd_wall2", "7767886d3ca35f122b3870c5", "swatch", {"box": (0, 0.10, 1, 1)}),
          ("drg_floor", "cd_floor", "9041d0627c867ff07729afbc", "swatch", {"box": (0, 0, 1, 1)})]),
```

- `bg_passes` is a new sprite cut option in `town_theme_pix.py`, about 10 lines. It runs `flood_bg` and whitens
  the result N times before the cutout, for a two-tone backdrop. `cdcut2.py` `whiten` is the reference.
- `--check` must rebuild the sheet exactly.
- `tests/data/townThemes.test.ts`:
  - **line 36:** `expect(sheets.length).toBe(9)` becomes `toBe(10)` (eight towns, the dwarf hall, the dragon city);
    the comment reads "a sheet per themed town plus the dwarf hall and Cardia Deep";
  - add a block: the dragon sheet's cells exist, every key is BR-ledgered (the existing loop covers it), and
    `cardia-deep`'s source uses only approved `drg_*` cells.

**`gen/prop_spec.py` / `prop_cut.py`.** Add the lit prop:

```python
"drake_brazier": ("cd_brazier", "7f2af0029275bb8d1f48d5a1", 0, (1, 2), "floor", {}),
```

with the FLAME entry `"drake_brazier": ("fire", [0, 0, 1, 0.4], True, 40)`.
- The render is a single figure, not AR-P's 2x2 variant grid. Check that `prop_cut` takes object 0 as the largest
  component; if not, add a `single: True` option.
- Rebuild `props_ar.{png,json}` with `--check`.
- **Approval date and purpose (momus 5).** `prop_cut.APPROVED` is one global date ("2026-11-21"), written into every
  prop's json record. Add a per-prop override:
  - `SPEC` options may carry `{"approved": "<date>", "purpose": "ar_dragon"}`;
  - `prop_cut` writes `p["approved"] = opts.get("approved", APPROVED)` and `p["purpose"] = opts.get("purpose",
    "ar_props")`;
  - `drake_brazier`'s options are `{"approved": "<CD-A's approval date>", "purpose": "ar_dragon"}`, the date the
    review approves it (expected 2026-11-22 or later).

  Every other prop is unchanged, so `--check` rebuilds them byte for byte; only the new prop's record carries the
  new keys.
- **`tests/data/arProps.test.ts`** (lines 22-62):
  - add `const LATER: Record<string, {purpose: string; approved: string}> = { drake_brazier: { purpose: 'ar_dragon',
    approved: '<date>' } }`, with the comment "pass CD (docs/CARDIA_PLAN.md 6.1): props approved after the
    2026-11-21 rulings";
  - the first test's set becomes `[...STRONG, ...WEAK, ...Object.keys(REROLLED), ...Object.keys(LATER)]`;
  - in its loop, `purpose` and `approved` are `LATER[id]`'s when `id in LATER`, else `ar_props` and `2026-11-21`.
    `pass` stays `AR` for all, since `ar_dragon` is a pass AR purpose;
  - add `drake_brazier` to `LIT`;
  - add `cardia-deep` to `DUNGEONS`, so its props sit on fitting cells and every lit one compiles with its flame.
    The wall props list in the second test is unchanged: `drake_brazier` is a floor prop.

**Re-rolls**, from the main checkout, purpose `ar_dragon`, at most 6 calls:
- `drg_hoard`: Ultra, "a wide low mound of spilled gold ... on a plain pure white background, no floor, no wall, no
  chest";
- `drg_perch` (optional);
- one more `drg_floor`, only if the review says the hexes read too busy at 2x.

**Concept art.** Commit `concept/*.png` to `docs/art/cardia/` (the integrator's instruction) (PNG8 where large, as AR-W did), and
`DRAGON_CITY_BRIEF.md` to `docs/`. Add section 11 to `docs/TOWN_THEMES.md` as a pointer.

### 6.2 CD-N: the NPC sheets (ruling R3)

- **Four sheets:** `bahamut`, `dragon_hatchling`, `dragon_matron` and `dragon_sage`, by AR-N2's method:
  - control-structure renders, purpose `ar_dragon`, at most 5 per sheet, at most 20 in all;
  - recut offline with `npc_field_cut.py` (entries in `gen/npc_field_ar.py` `AR_SPEC`);
  - one 1x `Look` each in `characters.py`.
- **Height (momus 15).** `npc_field_cut.py` cuts every sheet into fixed 48 x 96 cells (`GW, GH, FOOT = 48, 96, 93`),
  and the field atlas reads one cell size per sheet. So the brief's "Bahamut up to 1.25x the hero" does not fit
  today's cutter.
  - **Before any CD-N call**, confirm this (read `npc_field_cut.py` and `CharacterAtlas.ts`'s `cell`).
  - **Default:** Bahamut is capped at the cell, the hero's height (a figure of about 90 px, feet on row 93). His
    size shows in the throne and the dais instead.
  - A taller cell is a separate change to the cutter and the atlas, out of scope for pass CD.
- **Review:** `~/temp/ff-game/cardia/npcs/`, judged against the three AR-N2 sheets for scale and palette.
- **Fallback:** if a sheet fails review after 5 calls, its NPCs keep their AR-N2 sheets, and Bahamut keeps the
  tinted `garland_npc`. Report this; it does not block.
- **Tests:** `tests/data/arNpcArt.test.ts` (sheets present, untinted, `Look`s) and
  `tests/data/assetCoverage.test.ts`.

### 6.3 Budget (pass AR, `ar_dragon` cap 60)

| Use | Calls |
|---|---|
| CD-P (spent) | 20: 7 boards, 13 cells (rows in `bedrock_ledger.jsonl`, `tool: cdgen.py`) |
| CD-A re-rolls | at most 6 |
| CD-N | at most 20 |
| Reserve | 14 |

Never call Gemini. Use the `bedrock` profile only for InvokeModel. Make paid calls only from the main checkout; copy
the cache PNGs into a worktree before running `--check` there.

## 7. Battle and encounters

- **Warrens:** `ord_deep_warrens`, `CAVE_FIGHTS` (wyrm 1 w2, basilisk 1-2 w3, wyvern 1-2 w2), rate 24-36, backdrop
  `cave`, the same as the old cave.
- **Village:** no encounters.
- **World:** `ord_isles` is unchanged. No balance file changes, and no enemy, item or formula changes.
- `tests/balance/*`: none of the bounds read Cardia. `questCurve.test.ts` replays S19's segments; re-measure, but
  expect no change beyond +-0.11 levels (D-CD5).

## 8. Saves (tranche CD-S)

- New file `src/systems/retiredMaps.ts`, pure, under 60 lines:
  - `RETIRED_MAPS: Record<string, {map: string; entrance: string; location: string}> = {'bahamut-cave': {map:
    'cardia-deep', entrance: 'bahamut_gate', location: 'Cardia Deep'}, 'bahamut-lair': {map: 'cardia-deep',
    entrance: 'court', location: 'Cardia Deep'}}`;
  - `relocateRetired(data: SaveData): {data: SaveData; entrance: string | null}`, which, when `currentMap` is a key,
    returns `currentMap` = the new map, `mode: 'walking'`, the new `location` and its entrance. `playerPosition` is
    left alone; the entrance overrides it on load.
- `SaveManager.load` applies it **before** `isPreNw` / `isPreNw2`, so before `resetSave`:
  - `LoadedSave` gets `entrance: string | null`;
  - the v1-v3 reset and the v4 `revalidate` then run on the relocated data. A v4 save's `wayOutSearch` starts in
    `cardia-deep`, whose stairs reach the Cardia islets, and its airship check is unchanged.
- `LoadScene.start`: `this.game.pendingEntrance = data.reset ? RESET_ENTRANCE : data.entrance ?? null`.
  `ExplorationScene` already places the party at a pending entrance of the current map.
- No `SAVE_VERSION` bump. The rule is keyed on retired ids, which no new save can hold.
- Vehicles are kept as saved: the airship stays at its Cardia landing, and the party can walk to any stair.
- **Tests**, in a new `tests/systems/retiredMaps.test.ts`:
  - a v5 save in each retired map loads at its entrance;
  - **a v4 save in `bahamut-lair`, with its airship at `ord_s_bahamut_airship`**, relocates and is then revalidated
    through the real `revalidateNw2`. Use the compiled `cardia-deep` and `overworld` (or mocks that keep the
    transition order of 5.2). The result must have `reset: false`, the airship kept at its cell, and `currentMap`
    `cardia-deep` (momus 1). Also add the same case to `tests/scenes/loadRevalidate.test.ts` through `LoadScene`;
  - `wayOutSync('cardia-deep', ...)` returns `ord_bahamut` (the first stair; it pins 5.2's order);
  - a v3 save in `bahamut-cave` that owns the airship takes the reset (Cornelia), as before;
  - a save in `cardia-deep` is untouched;
  - `RETIRED_MAPS` targets exist in the compiled map's `entrances`.

## 9. Tests (tranche CD-T, with each tranche's own)

| File | Change |
|---|---|
| `tests/quest/ordeal/ord_o_world.test.ts` | the door test: `ord_bahamut` -> `cardia-deep` `bahamut_gate`; new: the four islet doors one step north of their entrances, each with a `cave_mouth` at (x - 1, y - 2) `walk_cells [[1, 1]]`; the four new landing spots are grass and `landing`; the islets are still separate airship-only masses (the existing test, unchanged); ORDEAL has 5 `cave_mouth`s |
| `tests/quest/ordeal/ord_o_sites.test.ts` | rewritten for `cardia-deep`: 1 chest (`CHEST_ORD_O_GROTTO`); `exit` `ord_bahamut`; Bahamut's trade (the same `toMatchObject`); the six dragons present by id; **pairing**: for each overworld transition into `cardia-deep`, the target entrance exists and a stair within 2 cells of it targets the same overworld entrance; **one village**: every entrance reaches every other on foot (the file's own `walk`, transitions not stepped on); the warren zone's walkable cells are in [150, 204]; no village cell outside the zone rects rolls an encounter (the map rate is 999); the Field actions block is unchanged |
| `tests/quest/townTargets.ts` | `SITE_TARGETS`: `{map: 'cardia-deep', owner: 'ORD-O', npcs: 24, note: 'the dragon great village: Bahamut, the six of the old lair and the villagers'}`. This is **cosmetic, not a gate**: the 24 named NPCs (25 entries with `bahamut_after`), plus the grotto chest |
| `tests/quest/originality.test.ts` | the stem comment reworded (5.7). No assertion changes: ORD-O keeps 1 branching dungeon of 1 |
| `tests/quest/designNotes.test.ts:35` | **pinned:** `'the canon lists every pass W map id (137)'` -> 136, `toBe(137)` -> `toBe(136)`. `cardia-deep`'s header carries the NOTE of 5.1 (Concept, Distinct with 4 features, Topology, in order), so the built-maps test passes |
| `tests/data/worldSource.test.ts:104` | **pinned:** spots `toHaveLength(44)` -> `48`; the comment adds "CD-W: + ord_s_{north,east,stack,west}_airship" |
| `tests/quest/ordeal/ord_o_world.test.ts:141` | **pinned:** `nw.objects.find((o) => o.name === 'cave_mouth' && inRaster('ordeal', ...))` would now pick whichever mouth is first. Select Bahamut's by its cell: `find((o) => o.name === 'cave_mouth' && o.x === bx - 1 && o.y === by - 2)`; then assert ORDEAL's `cave_mouth`s are exactly the five at (e.x - 1, e.y - 2) for `ord_bahamut` and the four `DOOR_ISLES` |
| `tests/quest/ordeal/ord_o_sites.test.ts` (addition) | `cardia-deep`'s first two transitions target `overworld` `ord_bahamut` (5.2) |
| `tests/data/arNpcArt.test.ts` | lines 74 and 108: `npcs('bahamut-lair')` -> `npcs('cardia-deep')` (the six `dragon_*` keep their sprites; the "no man's shape" check stays and still passes with HEAD's Ember lines); plus the CD-N sheets |
| `tests/data/townThemes.test.ts`, `arProps.test.ts` | see 6.1 |
| `tests/systems/retiredMaps.test.ts` | new (section 8) |
| `tests/scenes/NpcPresenceRefresh.test.ts`, `src/scenes/exploration/NpcPresence.ts` | comments only (`bahamut_after` still exists) |
| `tests/fixtures/quest/mini.yaml`, `tests/fixtures/passW/*` | **never edited** (frozen fixtures) |
| `tests/progression/*` | none expected; re-run `questGraph` and `resetStates` |

Run `npm run build`, `npm run test:fast` and the touched files. The integrator runs `npm run test:full` once.

## 10. Tranches

| Tranche | Owner files | Depends on | Gate |
|---|---|---|---|
| **CD-0** | none (measure) | | baseline table 1 filled (curve levels, world lines) |
| **CD-A** | `gen/town_theme_spec.py`, `town_theme_pix.py` (`bg_passes`), `gen/prop_spec.py` (+ `prop_cut.py` if needed), `gen/approved/town/theme_dragon.*`, `gen/approved/dungeon/props_ar.*`, docs (brief, concept art, `TOWN_THEMES.md` section 11), tests in 6.1 | | `town_theme_cut.py --check`, `prop_cut.py --check`, `gen/selftest.py`, the two tests |
| **CD-N** | `gen/npc_field_ar.py`, `characters.py`, `gen/approved/{bahamut,dragon_hatchling,dragon_matron,dragon_sage}/`, sprite atlases | | `npc_field_cut.py --check`, `arNpcArt`, `assetCoverage`; review sheets |
| **CD-M** | `ordeal/cardia_deep.py`, `ordeal/cardia_people.py`, `props_ar_maps.py` (`DRESS`), map sources and compiled maps, the `bahamut*` deletions, `world_canon.py` (signed off), `debug-scenarios.yaml`, `cutscenes.yaml` (`ord_bahamut_trial`'s first line), `designNotes` / `originality` / `arNpcArt` / `townTargets` / `ord_o_sites` edits | CD-A (else placeholders) | `build_map.py cardia-deep`, `--check-determinism cardia-deep`, `stubs.py --check all` (`stubs: 0 left`), `world_canon.check()` empty, its tests |
| **CD-W** | `world_specs/later_doors.py`, `world_source.py`, `world_specs/ordeal.py`, `ordeal/world_ordeal_nw.py` | entrance names (D-CD9) | `world.py` all OK; the full world compile and the two determinism gates; `ord_o_world` |
| **CD-Q** | `quest.yaml` S19 | CD-M, CD-W | `quest --strict`, `--from-reset`, `--strict --mutate` (background); curve vs CD-0 |
| **CD-S** | `retiredMaps.ts`, `SaveManager.ts`, `LoadScene.ts`, the tests | CD-M (entrance names) | `retiredMaps.test.ts`, `saveWorldReset`, `loadRevalidate` |
| **CD-INT** | `AGENTS.md` (the map table row, a "Cardia Deep (pass CD)" note under the world section, the dungeon props count), the `WORLD_PLAN.md` superseded line (5.7), this plan's result section, the final grep (5.7) | all | build, test:fast, test:full (integrator), browser checkpoints (`?mute=1&scenario=cd_court`, `cd_isles`, `cd_warren`; screenshots to `~/temp/ff-game/cardia/int/`) |

CD-W and CD-M touch disjoint files and can run in parallel worktrees. **Only one world compile at a time** (the
lock); CD-W owns it.

**Merge order (momus 2; final: CD-M and CD-W land in one batch, on one branch `cd`).** CD-M merges **before CD-W, or in the same merge batch**, and never after it.
- CD-W alone would leave five overworld transitions pointing at `cardia-deep`, a map that does not exist (the
  compiler's warp checks, the verifier and the tests fail).
- CD-M alone is not safe either: it deletes `bahamut-cave`, while the old world door still targets it until CD-W
  retargets the door. So **CD-M and CD-W land in one batch**, CD-M's commits first, and the integrator runs the gates
  once on the batch.
- If they must land separately, CD-M keeps `bahamut-cave` as a one-cell stub that warps to `cardia-deep`
  `bahamut_gate` until CD-W lands. This is not recommended.
- CD-Q (quest.yaml) and CD-S (saves) land in the same batch, or right after it. S19's `maps` and `walk` name
  `cardia-deep` and the relocation targets its entrances.
- CD-A and CD-N may land any time before; CD-M uses placeholders until CD-A's sheet exists.

Batch order: CD-A, CD-N (any time) -> [CD-M, CD-W, CD-Q, CD-S] as one batch -> CD-INT.

Line ceilings:
- `world_ordeal_nw.py`: 168 lines, plus about 10.
- `world_source.py`: check its length; if it would pass 250, put the later-doors merge in `later_doors.py` as
  functions.
- `ordeal.py`: 91 lines.
- The new layout files: under 250 each (`questCeilings.test.ts` covers `.py` files under the region directories,
  which includes `ordeal/`).

## 11. Gates and costs

| Gate | Cost |
|---|---|
| `python3 -I assets-src/tools/layouts/world.py` | about 1-2 min |
| `build_map.py overworld --region ordeal` (iteration) | under the lock; a few minutes |
| `build_map.py overworld` (final; also re-bakes `mode7*.png`) | about 335 s, about 15 GB, under the lock |
| `build_map.py --check-determinism overworld`, `mode7_atlas.py --check-determinism overworld` | about 2 x the compile |
| `build_map.py cardia-deep`, `--check-determinism cardia-deep` | seconds |
| `npm run quest -- --strict` | about 2 min, 3 GB |
| `npm run quest -- --strict --mutate` | heavy (hours); background only |
| `npm run test:fast` | about 2 min |

Re-running `world.py` and `ordeal/cardia_deep.py` must leave `git diff --exit-code assets-src/maps` clean.

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| K1 | Lines lost when `bahamut.py` is deleted | AR-N3 merged (8678de55). Diff the six `dragon(...)` calls and Bahamut's lines at HEAD against `cardia_people.py` before the `git rm` |
| K2 | A mouth stamp shrinks a tiny islet below a landing or splits it | `_mouth` fails loudly (3.2); the fallback is `ISLE_R` 3.4 for that islet; CD-P's simulation shows 6-13 landings |
| K3 | G-NW3 on chunk line y 80 (the stack islet) | the run is at most 6 cells; check the line; if it fails, stamp the mouth's rock ring one cell shorter on that row |
| K4 | S19's xp moves (the warren count, `%` walkability in the curve model) | D-CD5's band [150, 204]; compare with CD-0; adjust cells, never `grind` |
| K5 | A save in a retired map white-screens | `relocateRetired` runs first in `SaveManager.load`; tests cover v3 / v4 / v5 |
| K6 | One liquid per map (lava impossible beside the pool) | D-CD8: sea water only; the Hatchery's warmth comes from props and flames |
| K7 | The rim remap `grass` is also used by any `.` cell in the map | the map has no `.` cells; a source check in the layout asserts it |
| K8 | A party leaves by a stair far from its parked airship | not a soft-lock: proof (c) and `--from-reset`; the gate warden's line says so |
| K9 | The mode7 atlas goes stale | the full compile at the tranche end; never hand-merge `mode7*.png` |
| K10 | NPC count (24 + chest) and `no_static_chokepoints` | the draft passes; keep NPCs out of the 2-wide links |
| K11 | Canon is integrator-owned | signed off by the integrator (2026-11-22): CD-M makes the canon edit (5.6) |
| K12 | The floor material reads busy or too violet at 2x | the CD-A review; one re-roll is budgeted, or lower its `shade` / `sat` in the map's materials |
| K13 | `drg_arch` cannot sit on an east-west mouth | the statue gate-post fallback (5.4) |

## 13. Rulings

The defaults let the implementer proceed without an answer; the user can overrule any of them later at small cost.

| Id | Question | Default |
|---|---|---|
| R1 | A door on the hermit's islet too? | **No** (ruled 2026-11-22: the default). Oddo's hut keeps it a surface place; it would need a second site on the islet, since the hut sits where the mouth goes |
| R2 | A shop or inn in the village? | **No** (ruled 2026-11-22: the default). The market is flavour ("your gold would only be something to sleep on"). If wanted later: an item shop with Crescent's list plus a `towns:` record (proofs (e) and (f)) |
| R3 | Four new dragon-kin sheets (Bahamut, hatchling, matron, sage) at at most 20 calls? | **Yes** (ruled 2026-11-22), with the fallbacks and the height cap in 6.2 |

## 14. Bedrock calls made by CD-P

There were 20 calls, all Stable Image Ultra text-to-image, through `gen/bedrock.invoke(..., paid=True,
purpose='ar_dragon')`, from the main checkout, with seeds 201-207 and 211-223. There were no Gemini calls and no
failures. The keys are in the brief's section 8 and in `raw/<id>.json`. `ar_dragon` has used 20 of 60, and pass AR
276 of 450.

## 15. CD result (branch `cd` from `mainline` 8b676cd8)

All tranches landed on the one branch, in the plan's order: CD-A, CD-N, CD-M, CD-W, CD-Q, CD-S, a CD-M follow-up and
CD-INT (one commit each). CD-M and CD-W form one batch: CD-M alone points the frozen overworld door at a deleted map.

**What was built**
- **World (CD-W).** Five doors into `cardia-deep`: Bahamut's frozen door re-pointed (`later_doors.RETARGET`) and four
  new islet doors (`later_doors.DOORS`), each one step north of its entrance under a `cave_mouth` in a notch of rock
  (`_mouth`, ORDEAL's content). The hermit's islet has no door (R1). Landing spots `ord_s_{north,east,stack,west}_airship`.
  `world.py`: every line OK; land 26,948 (unchanged); **exemptions 440, cap 600** (unchanged: `stamps.sites` already
  exempts the door cells); G-NW1 6, G-NW2 33.9, G-NW3 6; spots 44 -> 48; ORDEAL coverage 6,117 -> 6,108 (the mouths' rock).
  The full compile (367 s) changed only four ORDEAL-owned chunks (`below_3_9`, `4_9`, `4_10`, `5_9`) and the Mode 7 atlas.
- **The village (CD-M).** As section 5, with these choices:
  - the theme sheet `theme_dragon` (CD-A) gives every set piece; `drg_perch` (re-roll `cd_perch2`) stands in the Roost
    and `drg_hoard` (re-roll `cd_hoard5`, 2x1) in the Hoard Vaults beside one `gold_heap`;
  - the ward arches stand over the three north-south mouths (east, stack, Sea Gate), jambs `on_wall`, the opening
    `passage`; the two side mouths (north, west) have two `drg_statue` gate-posts each (K13's fallback, in the NOTE);
  - 50 AR props (`DRESS`), the two `drake_brazier`s among them;
  - 24 named NPCs plus `bahamut_after` (25 entries): the draft's 23 named and `ord_cd_porter` (the Sea Gate hall);
  - floor `drg_floor` at shade 0.9; rubble shade 1.2 (0.85 failed the `W` / `%` contrast rule, 0.134 < 0.2);
    water `water_calm`; no Hatchery steam (the one smoke style, `VOLCANO_SMOKE`, reads as volcanic billows, not
    steam: left out as 5.4 allows).
- **Deviation: the map's encounter rate.** 5.3 said the map rate is a quiet 999. `EncounterSystem` counts down on the
  map's rate until the first fight (a zone's `encounterRate` only resets the counter after a battle in that zone), so
  at 999 the warrens would almost never fight. The map rate is the warrens' 24-36 and the map has no table, so a
  village step never counts (a step where no table applies is skipped). Browser: a basilisk after 25 warren steps;
  90 Wyrmhall steps without a battle. The curve model reads the zone's rate, so the proofs are not affected.
- **NPC sheets (CD-N).** `bahamut` (a golden dragon-king, blue under-armour; at the hero's height), `dragon_sage`
  (white-scaled; the renders kept the guide's green in every try, so every row's green is hue-shifted to pale white),
  `dragon_matron` (amber, rust dress, cream apron) and `dragon_hatchling` (coral pink, cut at 0.7 scale, 64 px). New
  cut options: `edge` (a dark frame on a render's border) and `scale` in `npc_field_edit`; every older sheet
  rebuilds byte for byte. No fallback was needed.
- **Saves (CD-S).** `retiredMaps.ts` as section 8; `LoadedSave.entrance`.
- **Witness (4.3).** The witness of (a) enters by the **east islet's stair** ((165, 74) -> `east`), 12.72 S19 fights
  (13.13 at CD-0 through `bahamut-cave`).

**Gates**

| Gate | Result |
|---|---|
| `world.py` | every line OK; land 26,948; exemptions 440 / 600 |
| `build_map.py overworld` | OK, 367 s |
| `build_map.py --check-determinism overworld` | deterministic (633 s) |
| `mode7_atlas.py --check-determinism overworld` | deterministic |
| `build_map.py cardia-deep`, `--check-determinism cardia-deep` | OK, deterministic |
| re-run `world.py`, `cardia_deep.py`, `citadel.py`: `git diff --exit-code assets-src/maps` | clean |
| `stubs.py --check all`; `world_canon.check()` | `stubs: 0 left`; `[]` (canon 136 rows) |
| `town_theme_cut.py --check`, `prop_cut.py --check`, `npc_field_cut.py --check` | every sheet rebuilds |
| `gen/selftest.py` | the approved-key, kit and theme checks pass (`theme_dragon`, `props_ar`, the four NPC sheets); three failures are mainline's (`stage_backgrounds.py` 255 lines, the KA budget block, `kneel_ai budget --check`), and the KA-G Gemini batch selftest hangs on a pipe here (stopped) |
| `npm run quest -- --strict` | OK: 847,265 states (835,121 at CD-0), 891 places |
| `npm run quest -- --strict --from-reset` | OK: 195 reset states (32 stage entries, 3 NW2 v4 saves, 160 mid-stage samples), 5,205,220 states searched |
| `npm run quest -- --strict --mutate` | OK: 68 gate rows, 109 elements, each removal reported (76 min) |
| `npm run build` | OK |
| `npm run test:fast` (2 workers) | OK: 411 files, 9,998 tests |

**Curve (proof (d), CD-0 -> CD; the curve model's fractional levels)**: S17 24.96 / 24.96, S18 boss 26.18 / 26.18,
**S19 26.47 / 26.46**, S20 25.07 / 25.07, S21 28.84 / 28.85, S22 25.07 / 25.07, S23 26.64 / 26.65, S24 boss 28.60 /
28.61, S25 28.70 / 28.71, S26 28.75 / 28.77, S27 30.32 / 30.33, S28 boss 33.87 / 33.89, S29 33.99 / 34.00, S30 boss
35.28 / 35.29: every stage within 0.02 (the tolerance is 0.11).

**Bedrock.** 21 `ar_dragon` calls, no failure and no Gemini: CD-A 4 re-rolls (`cd_hoard3` with a dragon on it,
`cd_hoard4` with a chest, `cd_hoard5` used; `cd_perch2` used) and CD-N 17 (Bahamut 5, the sage 5, the matron 5, the
hatchling 2). `ar_dragon` 41 of 60, pass AR 297 of 450. Scripts and review sheets: `~/temp/ff-game/cardia/impl/`
(`scripts/`, `npcs/`); browser checkpoints in `~/temp/ff-game/cardia/impl/int/`.

**Browser** (`?mute=1`, dev server on 127.0.0.1:5191): each islet's landing and mouth, the way in through each, the
nine districts, Bahamut's trade and class change (WAR / THF / WHM / BLM -> KNIGHT / NINJA / W.WIZ / B.WIZ,
`CLASS_UPGRADED`), a warren battle, the way out by each stair to its own islet (all five), and a v4 save made inside
`bahamut-lair` (airship at `ord_s_bahamut_airship`) loading at `cardia-deep` `court` with the airship kept. No console
error from the game.

**Open.** The integrator's `test:full`. `docs/TOWN_THEMES.md` and the brief name `docs/art/cardia/` (the integrator's
path) instead of the plan's `docs/art/town_themes/cardia/`.

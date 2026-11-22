# Cardia Deep: the dragon great village (creative brief, pass CD)

Status: **proposal, rev 2 (CD-P, 2026-11-22; momus fixes 12 and 15, rulings R1-R3 at their defaults)**, for momus review and then the implementer. It follows the method and format
of `docs/TOWN_THEMES.md`; the dwarf hall (section 6 there) is the closest model. The implementer commits this file as
`docs/DRAGON_CITY_BRIEF.md`, with the concept art in `docs/art/cardia/`, and adds a pointer to it as
section 11 of `docs/TOWN_THEMES.md`.

The user's request (2026-11-22): the Cardia islands should work as they did in classic Final Fantasy, where each
island had a way down to the dragons. The user wants all of it joined into **one** great dragon village.

Every name, line and design here is original.

## 1. Concept

The Cardia isles look like a scatter of grassy rocks in the sound. Under them lies **Cardia Deep**, which the
dragon-kin call the **Wyrmhold**: one city carved out of the black basalt beneath the whole archipelago. Each islet
hides a stair down. Every stair comes out in a short wild tunnel, the **warrens**, where the unthinking wyverns and
wyrms roost, and each tunnel ends at a **ward arch** cut like two folded wings. Through the arch the village begins.
All the roads meet in the **Wyrmhall**, and from there the **Processional** climbs to **Bahamut's Court**.

- **The dragon-kin.** These are dragons who live in shapes near a person's size: horned, scaled and tailed, in
  robes, armour or harness (the AR-N2 sheets `dragon_guard` red, `dragon_elder` jade, `dragon_youth` teal). They are
  not disguised humans (AR-N3's ruling: "no man's shape"). They are old, patient and dry-humoured. They do not use
  gold; they sleep on it.
- **Bahamut's court.** Bahamut is the eldest. He receives visitors at the far end of the Court, on a dais of crimson
  cloth before a throne carved as a seated dragon with spread wings. Six named dragon-kin of the old lair (Ember,
  Tide, Moss, Ash, Frost and Storm) keep their ids and lines and are spread across the districts where their lines
  belong.
- **The trial and the class change.** The Citadel of Trials (S18) gives the ordeal seal. Bahamut takes it in
  `ord_bahamut_trial` and names the party anew (`classUpgrade` on `CLASS_UPGRADED`). Nothing about this flow
  changes; only the room it happens in does. The village reacts: about half the villagers have a second line on
  `CLASS_UPGRADED`, so a named party is greeted as one of the hall.
- **Lore threads** (all in dialogue, no new flags): the Citadel's guardian was one of the kin once (Frost); the
  dragons gossip by the tide (Tide); Oddo the hermit, on the middle islet, "owes them nothing" (his slate) and owes
  them four nets and an anchor (a market gossip); Bahamut came first, when the sea was lower (the Sanctum).
- **The trial's first line** fits the dragon-kin (no "finger"): "You lay the seal on the crimson cloth. Bahamut turns
  it over once with one gold-scaled claw, and the hall goes still."


## 2. Palette (15-bit, 0-31 per channel, ramps darkest to lightest, light from the top left)

Write the colours as `snes_palette.c15` triples. The cut pass snaps every pixel to 15 bits.

| Ramp | Triples | Where |
|---|---|---|
| basalt | (2,2,4) (4,4,7) (7,7,10) (11,11,14) (15,15,18) | wall tops, wall faces, pillars, statues |
| obsidian scale | (6,5,10) (9,8,14) (13,12,18) (17,16,22) | the hex-scale floor (cool, slightly violet) |
| ember | (20,5,2) (27,11,3) (31,19,6) (31,27,14) | braziers, nests, vents, warm seams in the floor |
| dragon gold | (17,12,3) (24,18,6) (30,25,11) (31,30,20) | the frieze band, horns, the throne trim, the hoard |
| court crimson | (12,2,3) (19,4,5) (26,8,7) | the dais cloth, banners, the guards' harness |
| elder jade | (3,10,7) (6,16,10) (11,22,14) | the Sanctum's moss and lamps, the elders' robes |
| tide teal | (2,8,11) (3,14,17) (8,21,22) (17,28,27) | the grotto water, coral, the youths |
| pearl / bone | (22,21,18) (27,26,23) (30,30,28) | eggs, pearls, bones |

Rules: basalt and obsidian take most of every screen. Each district has **one** accent: the Court crimson and gold,
the Hatchery ember, the Grotto teal, the Sanctum jade and the Roost pale daylight. The Wyrmhall mixes them all, since
it is the crossroads. Ember is the only light colour in the warrens.

## 3. Architecture language (buildable on the 48 px interior part grid)

The village is an interior map (`common.Room`, kits `castle`, `interior`, `temple`, `town`). It has no house parts.
Its identity comes from materials, set-piece decos and props, as in the dwarf hall.

- **Walls:** the 2-row wall face is a material, **`drg_wall`**: black basalt carved in rows of large overlapping
  dragon scales like roof tiles, with a thin dull-gold band (render `cd_wall2`). The wall top `in_wall_top` is the
  near-black slate (`slate` at shade 0.3, as the lair uses today).
- **Floors:** **`drg_floor`**: obsidian flagstones cut as interlocking hexagonal scales, with amber light in a few
  seams (render `cd_floor`). It replaces `floor_stone` in the village. The warrens keep the rough
  `ar_temple_rubble_cool` cave floor, drawn as walkable rubble `%` (the plan, section 5.3), so the change of floor at
  a ward arch tells the player they have entered the city. The floor changes on the arch row.
- **Wing arches:** **`drg_arch`** (4x3): two basalt wings meet over a 2-wide opening, with a dragon-head keystone
  and two crimson banners. There is one at every warren mouth and one at the Processional. It is placed as a deco
  with `passage: true` over the opening (jambs on wall cells).
- **Pillars:** **`drg_pillar`** (1x2), a square basalt shaft with a dragon coiled on its capital and a gold band
  (render `cd_pillar2`). The slim round `drg_pillar_slim` (render `cd_pillar`) is for the Roost. Both are placed with
  `fit: True`, like `dwf_pillar`.
- **Statues:** **`drg_statue`** (1x2) and **`drg_statue_big`** (2x2), both a seated winged dragon on a plinth with
  gold eyes and horns. They flank the dais, the Wyrmhall's north door and the Sanctum.
- **Light:** every light is a prop with a `flame` ambient (AR-P2). The new **`drake_brazier`** (1x2) is an iron
  bowl on three dragon claws (render `cd_brazier`), added to `props_ar` with a FLAME entry so it flickers and
  glows. The existing AR props fill out the rest: `wall_torch` on wall faces, `brazier_tall` and `sun_brazier` in
  the Court, `lava_vent` and `magma_mound` in the Hatchery, `mushrooms_glow` in the Sanctum (jade glow) and
  `candelabra` in the Sanctum's reading niche.
- **Water:** one liquid per map (the compiler reads every `~` cell as the `water` material). Cardia Deep's liquid is
  **sea water**: the Tide Grotto's pool, and the Hatchery's warm spring channel with its stone bridge `=`. The
  channel is steaming geothermal water, not lava (a `smoke` ambient at low size; see the plan, section 5.4). The
  pool's rim is remapped off grass (`materials.grass: {from: slate, shade: 0.45}`; tested in the CD-P mock).
- **Hoards:** gold heaps (`gold_heap`, then the themed `drg_hoard` when a clean render exists) lie in the Hoard
  Vaults and in alcoves of the Court. The CD-P hoard render could not be cut from its background, so it needs one
  re-roll.

## 4. Districts

The village's layout follows the islands above it. North is north and the Sea Gate lies under Bahamut's isle. The
mock is `~/temp/ff-game/cardia/mock_cardia_deep_labelled.png`, and the plan's section 5 has the cells.

| District | Under | Accent | What is there |
|---|---|---|---|
| **Bahamut's Court** | between the north islet and the east islet | crimson, gold | the throne (3x3) on the north wall, the crimson dais (`+`), two big statues, four pillars, braziers; Bahamut, Moss, Ember (the court door), the herald |
| **Roost Galleries** | the north islet | pale daylight, slate | claw-worn perches in a row, `drg_pillar_slim`; Storm, the roost-master, a young flier. The north stair's warren opens here |
| **Wyrmhall** | the hermit's islet (no stair of its own) | all | eight pillars in two rows, two statues at the north door, two drake braziers; the steward (who names every road), the mason, the Citadel hint |
| **Elders' Sanctum** | the sound west of the hermit | jade | moss, glow mushrooms, a candelabra; Frost, the archivist, an elder who has been asleep for centuries |
| **Hatchery** | the east islet | ember | four egg nests (`drg_nest`), the warm spring channel and its bridge, vents; the egg-warden and two hatchlings. The east stair's warren opens at its south |
| **Ember Market** | the stack islet | ember, teal | stone stalls (counters), baskets; the pearl trader, the baker, the gossip. A flavour market: the kin trade among themselves (ruling R2). The stack stair's warren opens at its south |
| **Sea Gate hall** | Bahamut's isle | crimson | the hall behind the main stair; the gate warden. The Sea Gate warren (today's cave throat) opens here |
| **Tide Grotto** | the west islet | teal | the sea pool under the island, coral, kelp, the clam altar; Tide; the grotto's old chest `CHEST_ORD_O_GROTTO` (diamond armlet) |
| **Hoard Vaults** | the west islet | gold | gold heaps; Ash asleep on the gold, the hoard-counter. The west stair's warren opens here |

## 5. Signature set pieces

1. **The Throne of Bahamut** (`drg_throne` 3x3, set into the Court's north wall face, `on_wall`, `collide: alpha`):
   a seated dragon with spread wings above stepped basalt and a crimson runner. Bahamut stands on the top step of
   the dais in front of it.
2. **The ward arches** (`drg_arch`): the threshold between the wild warrens and the city, at every one of the five
   warren mouths.
3. **The egg nests** (`drg_nest` 2x2, ember-lit with a `magma_mound` glow beside each): rings of embers, each with
   three speckled eggs.
4. **The island stairs**: each warren starts at a stair up to daylight (today's `stairs_up` parts; a themed rough
   stair is optional), beside its arrival.
5. **The cave mouths on the islets** (world map): the existing `cave_mouth` landmark in a notch of rock on each of
   the four islets with a door. One mouth per islet keeps the classic Cardia read: a cave on every island.

## 6. Lighting

- Village: warm and dim. Braziers and torches every 6 to 10 cells along the walls (`props_ar_maps.DRESS`), so no
  floor cell is more than about 8 cells from a light. The Court is the brightest room: four braziers and the two
  `sun_brazier`s flanking the dais.
- Warrens: one wall torch at the stair and nothing else, so the arch's braziers read as "the city".
- Flame styles: `fire` everywhere except the Sanctum, where the mushrooms and lamps give `green` (jade).

## 7. NPC roles and dress

- **Guards** (`dragon_guard`, red, a crimson-and-gold harness): Ember (court door), Storm (roost), the herald, the
  roost-master, the gate warden, the Citadel hint.
- **Elders** (`dragon_elder`, jade robes): Moss (court), Frost (sanctum), the steward, the archivist, the
  egg-warden, the baker and the hoard-counter until the new sheets land.
- **Youths** (`dragon_youth`, teal): Tide, Ash, the flier, the mason, the pearl trader, the gossip and two
  hatchlings until the new sheets land.
- **New sheets (tranche CD-N, ruling R3):** `bahamut` (gold-white scales, a crown of horns, a crimson mantle; replaces
  the tinted `garland_npc`), `dragon_hatchling` (small and round, with stub wings), `dragon_matron` (amber scales, an
  apron and a basket: market and hatchery) and `dragon_sage` (white-scaled, very old, a staff: the Sanctum). Make
  them with AR-N's control-structure method and the 1x `Look`s.
- **Size:** everyone, Bahamut included, stays within the field cell, at the hero's height. `npc_field_cut.py` cuts
  fixed 48 x 96 cells (the plan, 6.2). He is the eldest, not a giant; his size shows in the throne and the dais.

## 8. Concept art (CD-P, Stable Image Ultra, purpose `ar_dragon`)

| File | Render (cache key) | Use |
|---|---|---|
| `concept_cd_hall2.png` | `cd_board_hall2` (7537e49248bf304a645b1d5b) | **main**: Bahamut's Court, crimson, black and gold |
| `concept_cd_roost2.png` | `cd_board_roost2` (9cc266933ba87817e384a4df) | the Hatchery: ember nests, the spring channel |
| `concept_cd_grotto.png` | `cd_board_grotto` (1457d762c813906563201d45) | the Tide Grotto: teal pool, market stalls, the hoard door |
| `concept_cd_cutaway2.png` | `cd_board_cutaway2` (8fcbefd6f786f9136892c1f3) | the island read: a glowing cave mouth on every rise |
| `concept_cd_hall_not_chosen.png` | `cd_board_hall` (5b846e859eaddb1ff64725ec) | not chosen: a generic grey dungeon |

The candidate cells (cut and pixelized, `~/temp/ff-game/cardia/candidates_cells.png`):

| Cell | Render (key) | Cut | Verdict |
|---|---|---|---|
| `drg_wall` | `cd_wall2` (7767886d3ca35f122b3870c5) | swatch 96 px, box (0, 0.10, 1, 1) | **use** (`cd_wall`, plain blocks, is not chosen) |
| `drg_floor` | `cd_floor` (9041d0627c867ff07729afbc) | swatch 96 px, whole frame | **use**; tune down to shade about 0.8 if the mock reads busy |
| `drg_statue`, `drg_statue_big` | `cd_statue` (406fde010f96f10ccad24bc5) | sprite 1x2 / 2x2 | **use** |
| `drg_pillar` | `cd_pillar2` (bf254f96c4f08a8651765a6b) | sprite 1x2; the grey-over-white background needs repeated border floods (`cdcut2.py` `whiten`, 3 passes, tol 30) | **use** |
| `drg_pillar_slim` | `cd_pillar` (46e7d9fa06a1e9a195c64379) | sprite 1x2 | use in the Roost |
| `drg_arch` | `cd_arch` (f29546b1e85d175ef327ebc8) | sprite 4x3 | **use** |
| `drg_throne` | `cd_throne` (169697a8d235f6e3b16a161b) | sprite 3x3 | **use** |
| `drg_nest` | `cd_nest` (5657a4ea62e661844244c20c) | sprite 2x2 | **use** |
| `drake_brazier` | `cd_brazier` (7f2af0029275bb8d1f48d5a1) | prop, 1x2, FLAME fire [0, 0, 1, 0.4] | **use** |
| `drg_perch` | `cd_perch` (065fe58b186ada11a3beeebe) | sprite 1x2 | weak (it reads as a cross): re-roll once or drop |
| `drg_hoard` | `cd_hoard`, `cd_hoard2` | not cuttable (a vignette and a black backdrop) | **re-roll** (prompt: "on a plain pure white background, no floor, no wall") |

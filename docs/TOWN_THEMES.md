# Town themes (art pass AR: streams AR-W, AR-W2)

**This brief and the concept art in `docs/art/town_themes/<town>/` are the reference for any future town art**
(exteriors, interiors, NPC dress, new set pieces): match each town's concept, palette and building language below.

Status: **approved and integrated (AR-W2, 2026-11-21).** The user's rulings of 2026-11-21:
1. All the town themes are approved. For Onrac and Gaia the **main concepts**: Onrac the whitewashed coral-stone
   tidal pilgrim harbour, Gaia the turf-roof fieldstone wind town. Their alternatives (`concept_onr_alt`, a town in
   the columns of a drowned civilisation; `concept_gai_alt`, a cliffside aerie with sail roofs) were **not chosen**;
   the boards are kept as `docs/art/town_themes/<town>/concept_*_alt_not_chosen.png`.
2. Crescent's terrace rock bands become **canals** and their stairs **bridges** (the north-south stone deck).
3. Melmond's siege look is **permanent for now**: no flag-driven change after the vampire falls.
4. Re-rendered (AR-W2, 12 Bedrock calls): the Cornelia market hall on the grid, better Pravoka house parts, the
   Crescent north-south bridge deck and Venetian funnel chimneys, the Gaia kite tower, the dwarf mine cart and a
   cleaner Lufenia marble (section 10, `docs/art/town_themes/reroll_comparison.png`).
5. **Exteriors only for now**: the shop and house interiors keep their art (the dwarf hall is the one interior
   themed, as its own town).

Concept art: `docs/art/town_themes/<town>/concept_<id>_board.png` (Stable Image Ultra concept boards, one per town,
PNG8 where large) and `docs/art/town_themes/reroll_comparison.png` (AR-W2's re-renders against the pieces they
replace, the picks marked). The renders themselves stay in the untracked cache (`assets-src/gen/cache/<key>.png`,
keys in `assets-src/gen/town_theme_spec.py` and in each sheet's `sources`); AR-W's raw cut folders and mocks are
not committed (`~/temp/ff-game/ar/towns/`).

## 0. What was there before AR-W2, and how a theme plugs in

**Inventory (before AR-W2).** Every town (Cornelia, Pravoka, Elfheim, Melmond, Crescent, Onrac, Gaia, Lufenia) is built from the
same Gemini cottage kit (`gen/approved/town/house.json`: `roof_{ridge,eave}_{l,m,r}`, `wall_up_{l,window,plain,r}`,
`wall_lo_{l,plain,r}`, `wall_door_{top,bottom}`), recoloured by `build_map.RECOLOR` hue shifts (`roof="red"`,
`wall="plaster"` and so on). Each town also uses the one Cornelia half-timber `inn` prefab (4x5), the same signs, the
same chimney, oaks, lamps, stalls, crops, wells, benches and fences. All houses are 5 wide; 1-storey houses are 5x4,
2-storey houses 5x5 (door column 2, windows 1 and 3). The town differences today are only ground recolours (Melmond
and Onrac `sat 0.45`), a few landmark decos (Pravoka's brig and lighthouse, Onrac's submarine and bell tower,
Gaia's windmills, Lufenia's domes) and the layout. The dwarf hall is an interior (`temple`, `castle`, `interior`,
`town` kits) with the temple stone recoloured brown and generic statues, pillars and a fireplace. So today there is
no town identity in the buildings at all, which is what the user saw.

**The plug-in point (no new compiler concept needed).** `build_map.styled(kit, name, style)` returns
`kit.parts[f"{name}@{style}"]` when that cell exists, before any recolour. A kit sheet whose cells are named
`roof_ridge_l@cre_venice`, `wall_up_window@cre_venice` and so on gives a house with `roof="cre_venice"`,
`wall="cre_venice"` its own art. The house assembly, the collision, the doors and the signs stay as they are. A new
JSON in `gen/approved/town/` loads for every map that lists the `town` kit, which every town does.
- **Wall tints:** each theme ships 1-2 pre-tinted wall sets (`@cre_venice_ochre` and so on). Only the pixels near the
  wall's own colour are tinted, so windows, doors and trims keep their colours. A street mixes them through the
  existing `wall=` field (roof stays the theme).
- **Themed inns** are prefabs `inn_<theme>` (4x5, the same footprint, door and sign row as `inn`): change only
  `prefab:` in the town script.
- **Whole-house prefabs** (`pra_house_a5` / `pra_house_a4`) are for renders too good to waste that drifted off the
  part grid. They have the same footprint as a 5x5 or 5x4 house (ridge row walkable, door cell, `sign`, `enter`).
- **Set pieces** are `deco` objects with `collide: alpha` (cells `<name>_<r>_<c>`), or `on_water` for boats.
- **Mocks (AR-W):** every mock was a real in-memory compile of the town's source with the themed kit (`_tools/mock.py`,
  `build_map.compile_map`). **All nine themed mocks pass the compiler's map checks** (reachability, doors, collision).

**Method (reusable).** House modules were made with **SD3.5 image-to-image** from a flat colour guide drawn exactly on
the 48 px part grid (`_tools/guides.py`: roof rows, eave band, corner posts, windows at columns 1 to 3, door at
column 2), at strength 0.76. The render keeps the grid and a white background, so the cut is a fixed crop with no
hand alignment. Control-structure (tried once, `cre_house`) ignored the white background and the row heights. At
strength 0.82 the render drifts off the grid (`pra_house2`). Stability will not paint boarded windows from a guide,
so Melmond's boarded window cells are taken from its inn render. Set pieces and props are Stable Image Ultra
sprites on white, cut by `landmark_pix.cutout` / `pix` (15-bit k-means, binary alpha, selective outline). Prop
sheets are split into separate figures first (`cut.split`).

## 1. Cornelia: a classic medieval village

- **Concept:** the royal seat's market village. Half-timbered, flower-boxed, warm, the "home" palette the rest of the
  world is measured against.
- **Palette (15-bit):**
  - oak beam (6,4,3) (10,7,4) (15,10,6)
  - lime plaster (26,24,19) (29,27,22) (31,30,26)
  - red clay tile (14,5,4) (20,8,5) (25,12,7) (28,17,10)
  - thatch (17,13,6) (23,18,8) (28,24,12)
  - fieldstone (12,12,12) (17,17,16) (22,21,19)
  - geranium (27,7,8); leaf (8,16,6)
- **Building language:**
  - roof: steep red clay tile, ridge cap, thatch as a variant;
  - walls: cream lime plaster in an oak frame with diagonal braces on the gable corners, a fieldstone plinth;
  - windows: small leaded casements with geranium flower boxes;
  - doors: oak planks with iron straps;
  - chimneys: stone (today's brick chimney is fine).
- **Set pieces:**
  - a timber market hall on oak posts;
  - a hooded stone well;
  - a hay cart;
  - a parish notice board.
- **Street props:** fences, sheaves, a smithy anvil.
- **Ground:** worn cobble lanes, grass greens.
- **Interior accents:** exposed beams, hearth, rush mats.
- **NPC dress:** russet, green and undyed wool; aprons and coifs.
- **Candidates:** `cor_house` (modules @cor_timber; tints `_ochre`, `_rose`), `cor_inn` (stone ground floor,
  timber upper), `cor_props` (well, hay cart, shed, notice board), `cor_hall` / `cor_hall2`.
- **Approved (AR-W2):** cor_house (+ tints), cor_inn, cor_props (well, hay cart, notice board) and the re-rendered
  market hall `cor_hall4` (SD3.5 i2i on a 4x4 grid guide, 0.74). Rejected: `cor_hall2` (isometric), `cor_hall`
  (cropped), `cor_hall3` (the weaker of the two re-renders).

## 2. Pravoka: a port city of pirates and traders

- **Concept:** a salt-stained, tar-black harbour where the honest traders' striped awnings meet the pirates' den.
- **Palette:**
  - tar timber (5,4,4) (8,6,5) (12,9,7)
  - driftwood (18,16,13) (23,21,17) (27,26,22)
  - slate shingle (7,9,12) (10,13,17) (14,18,22)
  - sea-green paint (5,14,13) (8,19,17) (12,24,21)
  - awning red / cream (23,6,6) (28,10,8) / (30,28,22)
  - brass (17,12,4) (24,19,7) (30,26,12)
  - rope (20,16,9) (25,21,12)
- **Building language:**
  - roof: weathered slate-blue shingle, rope along the eave;
  - walls: tarred ship planks over a grey stone ground floor;
  - windows: brass portholes;
  - doors: sea-green with iron bands;
  - details: ship lanterns, a ship's wheel over the inn door.
- **Set pieces:**
  - **the pirate tavern**: a galleon's stern built into a tarred house, a skull and crossed cutlasses sign, a black
    flag, in place of `pirates_den` (5x4 prefab);
  - the traders' striped spice stalls;
  - a dockside crane with a cargo net;
  - cargo piles.
- **Ground:** wet cobble, plank quays (exists).
- **Interior accents:** nets, hammocks, sea chests.
- **NPC dress:** sashes, bandanas, long coats; traders in bright silk.
- **Candidates:** `pra_house` (modules @pra_tar: on the grid but flat), `pra_house2` (much richer but drifted off the
  grid, used whole as prefabs `pra_house_a5` / `a4`), `pra_house3` (rejected: muddy), `pra_inn` (ship's wheel,
  portholes, awning), `pra_tavern`, `pra_stalls`.
- **Approved (AR-W2):** pra_tavern (the pirates' den, 5x4 prefab), pra_inn, pra_house2 as whole-house prefabs
  (`pra_house_a5` / `pra_house_a4`), pra_stalls (the stall and the cargo pile), and the re-rendered modules
  `pra_house4` (a richer i2i guide: vertical planks, a stone ground floor, brass rings; 0.74). Its windows drifted
  half a cell off the grid, so the cutter takes them by explicit crops (`crops`, `plain_band` in the spec).
  Rejected: `pra_house` (flat), `pra_house3` (muddy), `pra_house5` (square windows, weaker).

## 3. Elfheim: the elf city

- **Concept:** moonstone houses under swept verdigris roofs, glowing glass, the forest grown into the town. It
  matches the world icon's teal spires.
- **Palette:**
  - moonstone (22,23,24) (26,27,27) (30,30,29)
  - verdigris (4,12,11) (7,17,15) (11,22,19) (17,27,23)
  - silver (17,18,21) (24,25,28)
  - violet glass (14,9,22) (20,15,28)
  - leaf (5,13,6) (9,19,8)
  - lantern glow (28,30,22)
- **Building language:**
  - roof: a swept, bell-curved copper roof with leaf shingles and upturned eaves, a silver finial;
  - walls: pale moonstone with ivy at the corners;
  - windows: pointed leaf-arch stained glass;
  - doors: round-topped moon doors.
- **Set pieces:**
  - a great silver tree whose roots hold a shrine, with a spiral stair and lantern flowers;
  - a moon-gate arch;
  - an elven crystal shrine;
  - lily-lamp posts;
  - a reflecting pool.
- **Ground:** white stone paths, moss.
- **Interior accents:** living-wood shelves, crystal lamps.
- **NPC dress:** greens and silver, long sleeves, circlets.
- **Candidates:** `elf_house` (modules @elf_moon; tints `_jade`, `_lilac`), `elf_inn` (glowing amber door), `elf_tree`,
  `elf_props` (lamp, pool), `elf_props2` (moon gate, crystal shrine). Note: `elf_board` came back with dark blue
  roofs, which is the mood but not the palette; the house and inn renders carry the intended verdigris.
- **Approved:** all except the board's palette (elf_house, elf_inn, elf_tree, lamp, pool, moon gate; the crystal
  shrine did not split out of `elf_props2`). AR-W2 re-made the jade and lilac wall tints as flat tints (`abs`): the
  relative recolour blotched the near-white moonstone.

## 4. Melmond: the village under the vampire's siege

- **Concept:** a farming village holding out: every window boarded, garlic over the doors, barricades in the lanes,
  fresh graves, braziers burning all night.
- **Palette:**
  - ash timber (9,8,8) (13,12,11) (17,16,14)
  - rotten shingle (6,6,7) (9,8,10) (12,11,13)
  - dusk bruise (8,5,11) (12,8,15)
  - blood-rust (16,5,4) (21,8,5)
  - garlic (28,27,23)
  - candle and brazier (30,22,8) (31,28,14)
  - dead grass (14,13,8) (18,17,10)
  - Keep today's ground desaturation.
- **Building language:**
  - roof: sagging dark shingle with gaps;
  - walls: cracked grey plaster and timber;
  - windows: **boarded with crossed planks**;
  - doors: X-nailed, a painted holy sun, a garlic braid;
  - details: a lantern by the door; no flower boxes.
- **Set pieces:**
  - lane barricades (an overturned cart, crates, sharpened stakes);
  - a graveyard plot (a cross, a headstone, a fresh mound);
  - watch braziers;
  - a coffin cart.
- **Interior accents:** shuttered windows, holy candles, stakes by the door.
- **NPC dress:** drab wool, hoods, a few with pitchforks and stakes.
- **Candidates:** `mel_house` (no boards: rejected), `mel_house2` (modules @mel_siege, the boarded window cells
  patched in from `mel_inn`; tints `_ash`, `_rot`), `mel_inn`, `mel_barricade`, `mel_props`.
- **Approved:** mel_house2 + the boarded-window patch, mel_inn, mel_barricade (cut with `pocket` so the white seen
  between its stakes is gone), mel_props (cross, headstone, brazier). Static: the dressing stays after the vampire
  falls (ruling 3).

## 5. Crescent Lake: a canal city like Venice

- **Concept:** the scholars' terraces become a canal city. **The two rock bands between the terraces become canals
  and their stairs become bridges.** This is a ground-only change that keeps every path and passes the map checks
  in the mock. Rose, ochre and sienna palazzi, gothic windows, gondolas.
- **Palette:**
  - rose stucco (22,13,12) (25,16,15) (28,20,18)
  - ochre (24,18,9) (28,22,12)
  - terracotta (18,8,5) (24,12,7) (28,16,9)
  - Istrian stone (24,24,22) (29,29,27)
  - canal green (4,11,10) (6,15,13) (9,19,16) (14,24,20)
  - gondola black and red (3,3,4) (22,4,6)
  - pole blue and white (7,11,22) (30,30,30)
- **Building language:**
  - roof: low terracotta behind a white cornice;
  - walls: stucco with white stone trim and worn patches;
  - windows: pointed ogee windows with white balconettes;
  - doors: an arched water door;
  - chimneys: Venetian funnel chimneys (still to make; the mock keeps the brick one).
- **Set pieces:**
  - canals with stone quays;
  - footbridges;
  - gondolas with striped mooring poles;
  - a lion wellhead;
  - a campanile (the existing tower deco can stand in).
- **Ground:** canal water (the town's water material, ideally a greener canal remap), stone quay edges.
- **Interior accents:** terrazzo floors, Murano lamps.
- **NPC dress:** sages' robes, masks optional.
- **Candidates:** `cre_house` (control-structure test: rejected), `cre_house_i` (strength 0.6: too flat),
  `cre_house_i2` (modules @cre_venice; tints `_ochre`, `_sienna`), `cre_inn`, `cre_bridge` (isometric: rejected),
  `cre_bridge2` (a straight stone bridge for a north-south canal), `cre_gondola`.
- **Approved (AR-W2):** cre_house_i2 (+ tints), cre_inn, cre_gondola (gondolas, wellhead), the canals (ruling 2),
  the re-rendered stone deck `cre_bridge3` (i2i on a 2x4 deck guide, 0.7; the material `cre_bridge_v`, which
  Crescent's source maps onto `bridge_v`) and the funnel chimney from `cre_chimney` (Ultra; `chimney@cre_venice`).
  Rejected: `cre_house` (control-structure), `cre_house_i` (flat), `cre_bridge` (isometric), `cre_bridge2`.

## 6. The Cave of the Dwarves (`dwarf-hall`): the dwarves' grand hall

- **Concept:** a hall hewn and carved, not a brown cave: dark granite courses under a gold rune band, bronze-capped
  pillars, kings in stone, forge light.
- **Palette:**
  - granite (3,3,4) (6,6,7) (9,9,10) (13,13,14)
  - bronze (12,7,3) (18,11,5) (24,16,8)
  - gold inlay (27,21,6) (31,28,13)
  - forge (24,8,2) (30,15,3) (31,25,10)
  - lapis rune (4,7,18) (8,13,25)
- **Building language** (an interior, so no house parts):
  - the wall face is a granite block material (`dwf_wall_face_96.png`, seamless 96 px);
  - a separate rune frieze swatch (`dwf_rune_band_96.png`) for the top course;
  - floors keep the hewn stone, cooled toward grey.
- **Set pieces:**
  - dwarf-king statues;
  - square bronze-banded pillars;
  - Smyth's forge (a 2x2 forge in the fireplace slot);
  - an anvil;
  - a hanging brazier;
  - mine carts on rails (not obtained yet).
- **NPC dress:** leather aprons, braided beards, bronze helms. Since pass DW the dwarves wear their own field sheets
  (`dwarf_*`, `gen/npc_field_dw.py`), untinted; the ruddy `DWARF` tint on human sheets is gone.
- **Candidates:** `dwf_wall`, `dwf_statue`, `dwf_props` (pillar, forge, slim pillar, anvil), `dwf_props2` (coal, a
  chain brazier, a stand brazier; weak, and no mine cart).
- **Approved (AR-W2):** the wall (material `dwf_wall`, the hall's `in_wall_face`), the king statue, pillar, forge
  and anvil, and the re-rendered mine cart `dwf_cart` (Ultra). Their cells have their own names (`dwf_king_*`,
  `dwf_pillar_*`, `dwf_forge_*`, `dwf_anvil_*`, `dwf_cart_*`), so the generic statue, pillar and fireplace of
  every other map are unchanged. The rune band swatch was not used.

## 7. Lufenia: a techno-futuristic Roman town

- **Concept:** marble Rome after its own machine age: domed villas, gilded ribs, cyan light running in the stone.
  It matches the world icon's domes.
- **Palette:**
  - marble (25,25,24) (28,28,27) (31,31,30)
  - marble shadow (18,19,22)
  - gold (20,15,5) (27,22,9) (31,28,16)
  - cyan light (4,20,25) (10,28,30) (22,31,31)
  - imperial blue (4,6,16) (7,10,22)
  - laurel (10,17,8)
- **Building language:**
  - roof (AR-W3): red terracotta Roman tile roofs with a gilded ridge on the modular houses (they repeat across any
    width), terracotta or white domes with bold gold ribs and a cyan-orb finial on the villas and the inn (two cells
    tall);
  - walls (AR-W3): smooth white stucco with fluted pilasters and gilded capitals, a gold plinth (no veins or cracks
    at 2x);
  - windows: narrow arched blue glass;
  - doors: brass sliding doors under a lit lintel.
- **Set pieces:**
  - the forum fountain with an obelisk wrapped in light rings;
  - mechanical legionary statues;
  - light-pylon lamps;
  - an aqueduct carrying an energy channel;
  - today's dome decos stay.
- **Ground:** marble paving with cyan inlay (a material remap of cobble plus a line overlay; to do).
- **Interior accents:** holo-lecterns (the existing lectern and globe fit).
- **NPC dress:** white tunics with gold trim, cyan visors.
- **Candidates:** `luf_house` (modules @luf_marble; tint `_azure`), `luf_inn` (a small domed rotunda, a good
  signature building), `luf_forum`, `luf_props` (pylon), `luf_props2` (legionary, aqueduct).
- **Approved (AR-W2), replaced by AR-W3:** the marble `luf_house3` modules and villa, the flat cornice roof
  `luf_marble_flat` of the elder's hall and the rotunda `luf_inn2`. The user's ruling (2026-11-22): Lufenia "definitely
  needs another try (one house doesn't even have a roof)". The roofless house was the 8-wide elder's hall: a dome
  cannot repeat across a width, so AR-W2 gave it `luf_marble_flat`, whose ridge and mid cells are empty and whose eave
  keeps only its bottom 8 px (the cornice), so the hall showed a bare wall top on the grass. The villas' domes were
  blank grey and the inn's marble was cracked.
- **Approved (AR-W3, theme `luf_roman`):** board `docs/art/town_themes/lufenia/concept_luf3_board.png` (guide,
  render, cut; the elder's hall before and after). Four SD3.5 image-to-image renders of flat colour guides on the part
  grid (scratch guides drawn with the gold ribs, pediments and tile courses in colour, strength 0.55-0.6, the walls
  worded "smooth white stucco" because "marble" keeps bringing cracks back):
  - `luf3_modular2` -> the house modules `@luf_roman` (tint `luf_roman_azure`): a terracotta imbrex roof with a gilded
    ridge whose middle cells repeat, so every `house` of any width has a real roof. The elder's hall (8x5, 2 storeys)
    uses them, with the dome cap `luf_cupola` (2x1 deco on the cell row behind its ridge: the terracotta villa's dome
    at half scale, `derived` in the spec, the module's own colours only);
  - `luf3_villa_t2` / `luf3_villa_m2` -> whole-house prefabs `luf_villa_t5/_t4` and `luf_villa_m5/_m4`: a terracotta
    and a white dome with gold ribs on a drum, a pedimented porch over the door; the four 5x4 houses alternate them
    (stargazer and black magic white, healer and white magic terracotta);
  - `luf3_rotunda2` -> `inn_luf_roman`: the rotunda inn under a white gold-ribbed dome, a ring of columns.
  - Every one of them is cut with `clean` (`gen/town_theme_clean.py`): the hairline cracks SD3.5 still paints on pale
    walls are repainted with the wall colour round them (thin pale-grey lines only; straight runs and colours kept).
  - Kept: the forum fountain, pylons, legionaries and aqueduct (AR-W2), the observatory domes, and AR-N2's
    `luf_citizen_m`, `luf_citizen_f` and `luf_senator`. Bedrock: 16 `ar_towns` calls (6 at strength 0.7, which
    still cracked, 10 at 0.55-0.6); the raw renders and the scratch guides are in `~/temp/ff-game/ar/towns/lufenia2/`.
  - The tech accents came through thinner than hoped (the cyan orb finials, the drum's light band and the door
    lintels; the cornice strip is mostly lost at 48 px). The ground is still the shared cobble.

## 8. Onrac: a tidal pilgrim harbour (APPROVED: the main concept)

- **Concept:** whitewashed coral-stone pilgrim houses on stilts, shell-carved sea-glass windows,
  teal lanterns, shrines facing the drowned temple.
- **Palette:**
  - whitewash (26,27,27) (30,30,29)
  - coral (26,20,18) (29,24,21)
  - sea glass (8,20,19) (13,26,23) (20,30,27)
  - teal lantern (3,15,17) (6,21,22)
  - stilt wood (7,5,4) (11,8,6)
  - tidal sand (19,17,12) (23,21,15); wet sand (14,13,10)
- **Building language:**
  - roof: sea-green rounded tile;
  - walls: whitewash over coral stone;
  - windows: scallop-shell sea-glass;
  - doors: teal arched doors;
  - details: a stilt plinth.
- **Set pieces:**
  - pilgrim shrines;
  - net racks;
  - shell piles;
  - wave-crest lantern posts;
  - the existing bell tower, submarine and boats.
- **Candidates:** `onr_house` (modules @onr_coral; tints `_pink`, `_sea`), `onr_inn` (on stilts over sand),
  `onr_props`, and two concepts: `onr_board` (the tidal harbour) and `onr_alt` (the **alternative**: a town in the
  columns of a drowned civilisation).
- **Approved:** the house (tints `_pink`, `_sea` as flat tints), the inn and the props (net rack, shells, lantern).
  The alternative `onr_alt` was not chosen (ruling 1).

## 9. Gaia: a highland wind town of weather-watchers (APPROVED: the main concept)

- **Concept:** fieldstone and turf-roof houses on terraces, prayer-flag lines, kite towers, a
  storm-glass observatory.
- **Palette:**
  - fieldstone (12,12,12) (17,16,15) (22,21,19)
  - turf (6,12,4) (9,17,6) (13,21,8)
  - shutter blue (6,10,20) (9,15,25)
  - flags: red (26,6,6), yellow (29,25,6), green (8,20,8), blue (6,10,26), white (30,30,30)
  - brass vane (24,19,7)
  - heather (17,10,18)
- **Building language:**
  - roof: thick turf roofs with wildflowers along the ridge;
  - walls: deep-set fieldstone;
  - windows: blue shutters;
  - doors: arched plank doors;
  - details: wind chimes at the eave.
- **Set pieces:**
  - a prayer-flag pole and lines;
  - a kite tower;
  - a storm-glass observatory;
  - a small wind shrine;
  - Gaia's windmills (they exist).
- **Candidates:** `gai_house` (modules @gai_turf; tints `_slate`, `_sand`), `gai_inn` (turf full of flowers),
  `gai_props`, and two concepts: `gai_board` and `gai_alt` (the **alternative**: a cliffside aerie with rope bridges
  and sail roofs).
- **Approved (AR-W2):** the house, the inn, the props (prayer-flag pole, storm glass, wind shrine) and the
  re-rendered kite tower `gai_kite2` (Ultra: a turf-roofed timber lattice tower on fieldstone; it flies a pennant,
  not kites, the closer of two tries: `gai_kite` was a bare mast). The alternative `gai_alt` was not chosen.

## 10. Integration (AR-W2, as built)

**Re-renders.** 12 Bedrock calls (purpose `ar_towns`, pass AR; 66 of the stream's 80 used), no Gemini:
`pra_house4`, `pra_house5`, `cor_hall3`, `cor_hall4`, `cre_bridge3`, `luf_house2`, `luf_inn2`, `luf_house3` (SD3.5
image-to-image on grid guides), `cre_chimney`, `gai_kite`, `gai_kite2`, `dwf_cart` (Ultra). Picks in sections 1-9 and
on `docs/art/town_themes/reroll_comparison.png`.

**The cutter.** `assets-src/gen/town_theme_cut.py` (functions `town_theme_pix.py`, data `town_theme_spec.py`) re-cuts
every approved cell offline from the render cache into `assets-src/gen/approved/town/theme_<town>.{png,json}` (one
per themed town and `theme_dwarf`): `<part>@<style>` module cells for the theme and its tints, prefab and deco cells `<name>_<r>_<c>`, `chimney@cre_venice`, and the materials `cre_bridge_v`, `dwf_wall`
(AR-W3: a module or grid cut may take `clean` (`town_theme_clean.py`, the crack repaint), and `derived` cells shrink a
piece of a grid cut, Lufenia's dome cap `luf_cupola`). Each json's `sources` lists every render's cache key, model, seed, pass, strength and cut settings. `--check`
rebuilds every committed sheet exactly; the gen selftests check each key against the BR ledger and the cache (the
`backend: bedrock` rule of the landmark sheets). Copy the renders from the main checkout's cache into a worktree first.

**The compiler** (`build_map.py`): `styled()` looks up an approved `name@style` before the upper-storey to ground-floor
swap (a themed upper storey keeps its own windows); a house's chimney is `chimney@<roof>` when that cell is approved
(never a recolour), else the shared chimney.

**The towns.** Each town script calls `town_theme.apply(doc, town, g)` (`assets-src/tools/layouts/town_theme.py`, the
per-town table) before it writes its source: every house takes `roof=<theme>` and a wall style from its old wall
colour (plaster / white the theme, ochre tint 1, rose / stone tint 2), the inn `inn_<theme>` (same 4x5 footprint, door
column 2, sign row), named houses whole-house prefabs of the same footprint (Pravoka: the pirates' den -> the tavern,
the harbourmaster's and the cooper's houses; Lufenia: the four domed villas, `luf_villa_t4` / `luf_villa_m4`), and the set pieces are `collide: alpha`
decos (gondolas `on_water`) placed off every NPC, door and street, each checked by the compiler's map checks.
Crescent's rows 10-11 and 24-25 (x 2..44) become canals and their stairs bridges, the east road stays (its source maps
`bridge_v` to `cre_bridge_v`). Cornelia's market hall stands on the square in place of one stall and a flower bed.
The dwarf hall (`earth/dwarf.py`) takes the granite wall face, the dwarf-king statues, pillars, forge, anvil and two
ore carts. Doors, names, signs, transitions, NPCs, paths and the act-1 walks are unchanged. The world map's town
icons are not part of this pass.

**Tests.** `tests/data/townThemes.test.ts` (every theme style, prefab and deco a town uses has approved cells; every
render BR-ledgered; Crescent's deck and chimney; the dwarf hall's own cells), `tests/quest/townStandard.test.ts` counts
a themed whole-house prefab as a house.

**Adding to a theme.** Render through `gen/bedrock.invoke(..., purpose=...)` from the main checkout, add the render to
the town's entry in `town_theme_spec.py`, run `town_theme_cut.py`, use the cells from the town's row in
`town_theme.py`, recompile the town, and update this brief and its concept art.

## 11. Cardia Deep: the dragon great village (pass CD)

A separate brief, in this document's format: `docs/DRAGON_CITY_BRIEF.md` (the user's request of 2026-11-22: every
Cardia islet's cave leads down into one interconnected dragon village). Concept art: `docs/art/cardia/`
(`concept_cd_hall2.png` the main board; the not-chosen board kept). The cells are cut by `town_theme_cut.py` into
`approved/town/theme_dragon.{png,json}` (the throne, statues, pillars, the wing arch, nests, the hoard, the perch, and
the `drg_wall` / `drg_floor` materials); the drake brazier is a lit AR prop (`prop_spec.py`). The plan and its result:
`docs/CARDIA_PLAN.md`.

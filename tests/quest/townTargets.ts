/**
 * The town standard of pass W (docs/WORLD_PLAN.md 4.0.1): one row per town, read by `townStandard.test.ts` (W1-I),
 * which counts each column on the compiled maps (G15). Owned by W1-0b; read only for every tranche (a change goes to
 * the integrator).
 *
 * How the columns are counted (4.0.1):
 * - houses: `type: house` objects in the town's source YAML (`assets-src/maps/<map>.yaml`);
 * - interiors: distinct `<town>-house-*` targets of the compiled town map's transitions;
 * - outdoorNpcs: NPCs on the town map, keepers excluded; interiorNpcs: NPCs in the linked house maps;
 * - hints: NPCs whose id ends in `_hint`, each with a line that contains one of the keywords;
 * - reactive: NPCs whose `dialog` has at least one `condition` on the flag;
 * - shops: the `shopId`s of keepers reachable from the town's gate; inn: the inn price (an `action: inn` keeper).
 */
export interface TownTarget {
  /** The town id of `quest.yaml`'s `towns:` list. */
  id: string;
  owner: string;
  /** The town's map id (its compiled map and its source). */
  map: string;
  /** Approximate map size in cells, [w, h]. */
  size: readonly [number, number];
  houses: number;
  interiors: number;
  /** House maps that must be among the interiors. */
  requiredInteriors?: readonly string[];
  outdoorNpcs: number;
  /** null: the town has no house interiors to count. */
  interiorNpcs: number | null;
  hints: { count: number; keywords: readonly string[] };
  reactive: { min: number; flag: string };
  shops: readonly string[];
  /** The inn price in gold, or null for no inn. */
  inn: number | null;
  clinic: boolean;
  character: string;
}

const five = (town: string): string[] => ['weapon', 'armor', 'item', 'white', 'black'].map((s) => `${town}_${s}`);

export const TOWN_TARGETS: readonly TownTarget[] = [
  {
    id: 'pravoka', owner: 'A1-T', map: 'pravoka', size: [48, 44], houses: 8, interiors: 6, outdoorNpcs: 14,
    interiorNpcs: 10, hints: { count: 2, keywords: ['Elfheim', 'Matoya'] },
    reactive: { min: 4, flag: 'BIKKE_DEFEATED' }, shops: five('pravoka'), inn: 50, clinic: true,
    character: "a harbour town in a fjord under the pirates' thumb: warehouses on piles, a lighthouse on the range's "
      + 'foot, a quay where the pirate brig lies',
  },
  {
    id: 'elfheim', owner: 'ELF-T', map: 'elfheim', size: [52, 50], houses: 9, interiors: 6, outdoorNpcs: 16,
    interiorNpcs: 12, hints: { count: 2, keywords: ['Matoya', 'Marsh'] },
    reactive: { min: 4, flag: 'PRINCE_AWAKE' }, shops: five('elfheim'), inn: 100, clinic: true,
    character: 'a forest town in a ring of living hedges: houses on raised roots, a stream through the centre, the '
      + 'castle on a wooded rise to the north',
  },
  {
    id: 'melmond', owner: 'ERT-T', map: 'melmond', size: [46, 42], houses: 7, interiors: 5,
    requiredInteriors: ['melmond-house-unne'], outdoorNpcs: 12, interiorNpcs: 10,
    hints: { count: 2, keywords: ['Cavern', 'giant'] }, reactive: { min: 4, flag: 'EARTH_CRYSTAL_LIT' },
    shops: five('melmond'), inn: 200, clinic: true,
    character: 'a farming town dying from the root up: cracked fields, grey vines, a crooked windmill; the patch '
      + '`ert_melmond_bloom` turns the dead ground green on EARTH_CRYSTAL_LIT',
  },
  {
    id: 'crescent', owner: 'FIR-T', map: 'crescent', size: [54, 46], houses: 9, interiors: 6, outdoorNpcs: 16,
    interiorNpcs: 12, hints: { count: 2, keywords: ['sages', 'volcano'] },
    reactive: { min: 4, flag: 'CANOE_GIVEN' }, shops: five('crescent'), inn: 300, clinic: true,
    character: "a scholars' town on terraces above the crescent water: boathouses, an observatory, the Circle's "
      + 'stone ring on a lake islet (reached by a causeway)',
  },
  {
    id: 'onrac', owner: 'WAT-T', map: 'onrac', size: [50, 44], houses: 8, interiors: 6, outdoorNpcs: 14,
    interiorNpcs: 12, hints: { count: 2, keywords: ['waterfall', 'caravan'] },
    reactive: { min: 4, flag: 'WATER_CRYSTAL_LIT' }, shops: five('onrac'), inn: 500, clinic: true,
    character: 'a cold fishing port of stone and tarred timber: drying racks, a bell tower whose bell washed ashore '
      + "from the sunken city, the submarine's dry dock",
  },
  {
    id: 'gaia', owner: 'WND-T', map: 'gaia', size: [52, 46], houses: 9, interiors: 6, outdoorNpcs: 16,
    interiorNpcs: 12, hints: { count: 2, keywords: ['Lufenia', 'Mirage'] },
    reactive: { min: 4, flag: 'FAIRY_FREED' }, shops: five('gaia'), inn: 700, clinic: true,
    character: 'a terraced mountain town of windmills that stand still: rope bridges between terraces, a dry spring '
      + 'court at the top',
  },
  {
    id: 'lufenia', owner: 'WND-O', map: 'lufenia', size: [36, 32], houses: 4, interiors: 3, outdoorNpcs: 10,
    interiorNpcs: 5, hints: { count: 2, keywords: ['Mirage', 'cube'] },
    reactive: { min: 6, flag: 'LUFENIAN_LEARNED' }, shops: ['lufenia_white', 'lufenia_black'], inn: 900,
    clinic: true,
    character: 'a sky-folk village of pale domes on a mesa, its people speaking a lost tongue; brass instruments '
      + 'point at the sky (unreadable speech becomes plain speech on LUFENIAN_LEARNED)',
  },
  {
    id: 'dwarf', owner: 'ERT-O', map: 'dwarf-hall', size: [40, 30], houses: 0, interiors: 0, outdoorNpcs: 10,
    interiorNpcs: null, hints: { count: 2, keywords: ['canal', 'Melmond'] },
    reactive: { min: 3, flag: 'CANAL_OPEN' }, shops: ['dwarf_item'], inn: null, clinic: false,
    character: "a hall carved under the isthmus: forge, ore carts, the canal plans chalked on a wall, Smyth's anvil",
  },
];

/** The small sites of 4.0.1: single maps with an NPC count (at least). */
export const SITE_TARGETS: readonly { map: string; owner: string; npcs: number; note: string }[] = [
  { map: 'matoya-cave', owner: 'A1-O', npcs: 4, note: 'Matoya and three enchanted brooms with lines' },
  { map: 'sage-cave', owner: 'ERT-O', npcs: 3, note: "Sarda's cave" },
  { map: 'caravan-camp', owner: 'WAT-O', npcs: 5, note: 'including the trader' },
  { map: 'bahamut-lair', owner: 'ORD-O', npcs: 6, note: '6 dragons' },
  { map: 'crescent-circle', owner: 'FIR-T', npcs: 12, note: 'the Circle of Sages, Lukahn included' },
];

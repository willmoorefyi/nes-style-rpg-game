/**
 * The travel-requirement matrix of docs/WORLD_PLAN.md 6.2 as data: each row's state (cumulative over `from`), what it
 * must and must not reach, and the two basin rows. A target is an overworld entrance (an anchor), `<map>` or a map
 * glob, or `<map>:<entrance>`. A vehicle is parked at an anchor's dock or entrance cell (`at`).
 */
export interface TravelRow {
  id: string;
  /** The row this one adds to. */
  from?: string;
  flags?: string[];
  items?: string[];
  vehicles?: Array<{ type: 'ship' | 'airship' | 'canoe'; at: string }>;
  /** Taken out of the inherited state (T6b: the canoe). */
  drop?: { items?: string[]; vehicles?: string[] };
  reach: string[];
  notReach: string[];
  /** Every airship-only anchor reached needs a landing cell within 8 steps (T6). */
  landing?: boolean;
  /** A basin row: the docks the ship (parked at `vehicles`) can reach, exactly. */
  docks?: string[];
  /** A basin row: the basin seeds the ship's water must hold, and must not hold. */
  basins?: { holds: string[]; lacks: string[] };
}

/** WORLD 2.6 `BASIN_SEEDS`. */
export const BASIN_SEEDS: Readonly<Record<string, [number, number]>> = { aldi: [92, 121], ocean: [2, 2] };

/** Anchors the airship alone reaches (ORDEAL, WATER, WIND have no dock; 2.8). */
export const AIRSHIP_ONLY = ['ord_citadel', 'ord_bahamut', 'wat_onrac', 'wat_waterfall', 'wat_caravan', 'wnd_gaia',
  'wnd_mirage', 'wnd_lufenia'];

const A1 = ['a1_pravoka', 'a1_matoya'];
const ALDI = ['elf_elfheim', 'elf_keep', 'elf_marsh', 'ert_dwarf'];
const WEST = ['ert_melmond', 'ert_earth_cave', 'ert_giant', 'fir_crescent'];
const SOUTH = ['fir_volcano', 'fir_ice', 'fir_desert'];
const NORTH = AIRSHIP_ONLY;
const PRAVOKA_SHIP = [{ type: 'ship' as const, at: 'a1_pravoka' }];

export const DEFAULT_TRAVEL_ROWS: TravelRow[] = [
  { id: 'T0', flags: ['GARLAND_DEFEATED', 'PRINCESS_RESCUED', 'INTRO_COMPLETE'], items: ['lute'],
    reach: ['cornelia', 'temple'], notReach: [...A1, ...ALDI, ...WEST, 'ert_sarda', ...SOUTH, ...NORTH] },
  { id: 'T1', from: 'T0', flags: ['BRIDGE_BUILT'], reach: A1, notReach: [...ALDI, ...WEST, 'ert_sarda', ...SOUTH, ...NORTH] },
  { id: 'T2', from: 'T1', vehicles: PRAVOKA_SHIP, reach: ALDI, notReach: [...WEST, 'ert_sarda', ...SOUTH, ...NORTH] },
  { id: 'T3', from: 'T2', flags: ['CANAL_OPEN'], reach: WEST, notReach: ['ert_sarda', ...SOUTH, ...NORTH] },
  { id: 'T4', from: 'T3', flags: ['TITAN_FED'], reach: ['ert_sarda'], notReach: SOUTH },
  { id: 'T5', from: 'T4', items: ['canoe'], reach: SOUTH, notReach: NORTH },
  { id: 'T6', from: 'T5', flags: ['AIRSHIP_RAISED'], vehicles: [{ type: 'airship', at: 'fir_desert' }], landing: true,
    reach: [...NORTH, 'mirage-1f:arrival'], notReach: ['sea-shrine-*', 'mirage-1f:inner', 'sky-castle-*', 'past-temple-*'] },
  { id: 'T6b', from: 'T6', drop: { items: ['canoe'] }, landing: true, reach: NORTH.filter((a) => a !== 'wat_waterfall'),
    notReach: ['wat_waterfall'] },
  { id: 'T7', from: 'T6', items: ['oxyale'], reach: ['sea-shrine-b3'], notReach: ['mirage-1f:inner', 'sky-castle-*'] },
  { id: 'T8', from: 'T7', items: ['chime'], reach: ['mirage-1f:inner'], notReach: ['sky-castle-*'] },
  { id: 'T9', from: 'T8', flags: ['SKY_FORTRESS_OPEN'], reach: ['sky-castle-1f'], notReach: ['past-temple-*'] },
  { id: 'T10', from: 'T9', items: ['lute'],
    flags: ['EARTH_CRYSTAL_LIT', 'FIRE_CRYSTAL_LIT', 'WATER_CRYSTAL_LIT', 'WIND_CRYSTAL_LIT', 'TIME_GATE_OPEN'],
    reach: ['past-temple-1'], notReach: [] },
  { id: 'B1', from: 'T2', reach: [], notReach: [], docks: ['a1_pravoka', 'elf_port', 'ert_dwarf'],
    basins: { holds: ['aldi'], lacks: ['ocean'] } },
  { id: 'B2', from: 'T3', reach: [], notReach: [],
    docks: ['a1_pravoka', 'elf_port', 'ert_dwarf', 'ert_melmond', 'fir_crescent'], basins: { holds: ['aldi', 'ocean'], lacks: [] } },
];

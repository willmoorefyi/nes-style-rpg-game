/**
 * The gate table of docs/WORLD_PLAN.md 6.3 (GT-1 to GT-37, with GT-5b; NW2's GT-40 to GT-43) as named mutations: the element (found by
 * questMutateFind.ts), the change, and the expected catch (proof and message prefix). A row whose `nlb` is set is
 * non-load-bearing: it needs an entry in its stage's `nonLoadBearing` (`entry`) or carries the plan's reason itself.
 */
import { TerrainType } from '../types/index.js';
import type { ProofId } from './questTypes.js';
import type { QuestContext } from './questProofs.js';
import type { MutElement } from './questMutateOps.js';
import { flagsOf } from './questMutateOps.js';
import {
  canoeCut, cellFlagNeeds, cutOpen, docks, flagNeeds, gatesRemoved, grantsAny, itemNeeds, keeperShowIf, npcRemoved, patchOn,
  spawnNeeds, townOpensAfter, vehicleTrigger,
} from './questMutateFind.js';

export interface Expect {
  proof: ProofId;
  /** A failure message prefix, e.g. `SKIP S4 ` or `EARLY pravoka `. */
  prefix: string;
}

export interface GateRow {
  row: string;
  /** The stages the row belongs to (a row of a pending stage that is not caught is pending). */
  stages: string[];
  element: string;
  mutation: string;
  find: (ctx: QuestContext) => MutElement[];
  expect: Expect[];
  /** Any one expectation is enough (GT-4, GT-21). */
  anyOf?: boolean;
  /** Non-load-bearing: `entry` needs the stage's `nonLoadBearing` entry; other text is the plan's own reason. */
  nlb?: string;
  /** GT-18: a probe, not a mutation; it passes when the later milestone stays unreachable. */
  probe?: { stage: string };
}

const skip = (...s: string[]): Expect[] => s.map((id) => ({ proof: 'b', prefix: `SKIP ${id} ` }));
const early = (...t: string[]): Expect[] => t.map((id) => ({ proof: 'e', prefix: `EARLY ${id} ` }));
const goal: Expect = { proof: 'a', prefix: 'ORDER goal ' };
const CRYSTALS = ['EARTH_CRYSTAL_LIT', 'FIRE_CRYSTAL_LIT', 'WATER_CRYSTAL_LIT', 'WIND_CRYSTAL_LIT'];
const PAST = ['PAST_LICH_DEFEATED', 'PAST_ASHEN_DEFEATED', 'PAST_DROWNED_DEFEATED', 'PAST_SERAPH_DEFEATED',
  'DEATH_EYE_DEFEATED'];
const WALLS = ['W_west', 'W_isthmus', 'W_arm', 'W_south', 'W_east'];

const item = (row: string, stage: string, what: string, it: string, next: string): GateRow => ({
  row, stages: [stage], element: `${what}'s requiredItem: ${it}`, mutation: 'remove', find: (c) => itemNeeds(c, it),
  expect: skip(next),
});
const grantNeeds = (ids: string[]) => (c: QuestContext, f: string): MutElement[] => flagNeeds(c, f, (e) => grantsAny(e, ids));

export const GATE_ROWS: GateRow[] = [
  { row: 'GT-1', stages: ['S0', 'S1'], element: 'the bridge gate cells', mutation: 'remove', nlb: 'entry', expect: [],
    find: (c) => gatesRemoved(c, (g) => !g.permanent && flagsOf(g).includes('BRIDGE_BUILT')) },
  { row: 'GT-2', stages: ['S1'], element: 'the patch north_bridge', mutation: 'force on from the start',
    find: (c) => patchOn(c, 'north_bridge'), expect: [...skip('S2'), ...early('pravoka')] },
  { row: 'GT-3', stages: ['S2', 'S4'], element: 'the ship spawn requiredFlag: BIKKE_DEFEATED', mutation: 'remove',
    find: (c) => spawnNeeds(c, 'ship', 'BIKKE_DEFEATED'), expect: skip('S4') },
  { row: 'GT-4', stages: ['S2'], element: 'the dock a1_pravoka', mutation: 'remove', find: (c) => docks(c, ['a1_pravoka']),
    expect: [{ proof: 'c', prefix: 'SOFTLOCK ' }, goal], anyOf: true },
  { row: 'GT-5', stages: ['S4'], element: 'the dock elf_port', mutation: 'remove', nlb: 'entry', expect: [],
    find: (c) => docks(c, ['elf_port']) },
  { row: 'GT-5b', stages: ['S4', 'S10'], element: 'both Aldi docks of Elfland\'s coast, elf_port and ert_dwarf',
    mutation: 'remove both', find: (c) => docks(c, ['elf_port', 'ert_dwarf']), expect: [goal] },
  { row: 'GT-6', stages: ['S6'], element: 'Astos\'s requiredFlags: [MARSH_GUARD_DEFEATED]', mutation: 'remove', nlb: 'entry',
    expect: [], find: (c) => grantNeeds(['ASTOS_DEFEATED'])(c, 'MARSH_GUARD_DEFEATED') },
  item('GT-7', 'S6', 'Astos', 'crown', 'S6'),
  item('GT-8', 'S7', 'Matoya', 'crystal_eye', 'S7'),
  item('GT-9', 'S8', 'the prince', 'herb', 'S8'),
  item('GT-10', 'S9', 'the vault gate', 'mystic_key', 'S9'),
  item('GT-11', 'S10', 'Nerrick', 'tnt', 'S10'),
  { row: 'GT-12', stages: ['S10'], element: 'the patch canal', mutation: 'force on from the start',
    find: (c) => patchOn(c, 'canal'), expect: [...skip('S11'), ...early('melmond', 'crescent')] },
  { row: 'GT-13', stages: ['S10'], element: 'each Aldi wall W_west, W_isthmus, W_arm, W_south, W_east',
    mutation: 'open its minimal water cut', find: (c) => WALLS.flatMap((w) => cutOpen(c, w, TerrainType.Water)),
    expect: [...skip('S11'), ...early('melmond')] },
  { row: 'GT-14', stages: ['S10'], element: 'the dock ert_dwarf', mutation: 'remove', nlb: 'entry', expect: [],
    find: (c) => docks(c, ['ert_dwarf']) },
  item('GT-15', 'S12', 'the giant', 'ruby', 'S12'),
  { row: 'GT-16', stages: ['S12'], element: 'Sarda\'s requiredFlags: [VAMPIRE_DEFEATED]', mutation: 'remove', nlb: 'entry',
    expect: [], find: (c) => grantNeeds(['rod'])(c, 'VAMPIRE_DEFEATED') },
  item('GT-17', 'S13', 'the earth seal', 'rod', 'S13'),
  { row: 'GT-18', stages: ['S13'], element: 'S13\'s milestones', mutation: 'withhold EARTH_SEAL_BROKEN\'s event',
    find: () => [], expect: [], probe: { stage: 'S13' } },
  { row: 'GT-19', stages: ['S14'], element: 'the elder\'s requiredFlags: [EARTH_CRYSTAL_LIT]', mutation: 'remove',
    find: (c) => grantNeeds(['canoe', 'CANOE_GIVEN'])(c, 'EARTH_CRYSTAL_LIT'), expect: skip('S14') },
  { row: 'GT-20', stages: ['S14'], element: 'the Crescent shop keepers', mutation: 'move crescent\'s opensAfter to [S13]',
    find: (c) => townOpensAfter(c, 'crescent', ['S13']), expect: [{ proof: 'e', prefix: 'EARLY crescent talkable before S13' }] },
  { row: 'GT-21', stages: ['S15', 'S16'], element: 'the river mouths of R-volcano and R-ice', mutation: 'make the cut walkable grass',
    find: (c) => [...canoeCut(c, 'fir_crescent', 'fir_volcano'), ...canoeCut(c, 'dock:fir_ice', 'fir_ice')],
    expect: skip('S15', 'S16'), anyOf: true },
  item('GT-22', 'S17', 'the buried hull', 'levistone', 'S17'),
  { row: 'GT-23', stages: ['S17', 'S18'], element: 'the airship\'s set_vehicle cutscene\'s trigger', mutation: 'fire it with no levistone',
    find: (c) => vehicleTrigger(c, 'airship', 'AIRSHIP_RAISED'), expect: skip('S18') },
  item('GT-24', 'S19', 'Bahamut', 'ordeal_seal', 'S19'),
  { row: 'GT-25', stages: ['S21'], element: 'the waterfall river (R-waterfall)', mutation: 'make the cut walkable',
    find: (c) => canoeCut(c, 'wat_onrac', 'wat_waterfall'), anyOf: true,
    expect: [...skip('S21'), { proof: 'h', prefix: 'TRAVEL T6b reaches wat_waterfall' }] },
  item('GT-26', 'S23', 'the fairy', 'fairy_bottle', 'S23'),
  item('GT-27', 'S24', 'the submarine gate', 'oxyale', 'S24'),
  item('GT-28', 'S25', 'Unne', 'slab', 'S25'),
  { row: 'GT-29', stages: ['S26'], element: 'the elder\'s requiredFlags: [LUFENIAN_LEARNED]', mutation: 'remove',
    find: (c) => grantNeeds(['chime', 'CHIME_GIVEN'])(c, 'LUFENIAN_LEARNED'), expect: skip('S26') },
  { row: 'GT-30', stages: ['S26'], element: 'the Lufenia keepers\' showIf: LUFENIAN_LEARNED', mutation: 'remove',
    find: (c) => keeperShowIf(c, 'lufenia', 'LUFENIAN_LEARNED'), expect: early('lufenia') },
  item('GT-31', 'S27', 'the mirage-1f vestibule door', 'chime', 'S27'),
  item('GT-32', 'S27', 'the console', 'cube', 'S27'),
  { row: 'GT-33', stages: ['S29'], element: 'the time gate\'s requiredFlags', mutation: 'remove one at a time',
    find: (c) => CRYSTALS.flatMap((f) => [...cellFlagNeeds(c, ['*'], (fl) => CRYSTALS.every((x) => fl.includes(x)), f),
      ...flagNeeds(c, f, (e) => e.grants.flags.includes('TIME_GATE_OPEN'))]), expect: skip('S29') },
  { row: 'GT-33', stages: ['S29'], element: 'the time gate\'s requiredItem: lute', mutation: 'remove',
    nlb: 'the lute is held from S0 and never consumed', expect: [], find: (c) => itemNeeds(c, 'lute') },
  { row: 'GT-34', stages: ['S30'], element: 'each refight stair\'s requiredFlags', mutation: 'remove one at a time',
    find: (c) => PAST.flatMap((f) => cellFlagNeeds(c, ['past-temple-*', 'past-chaos'], () => true, f)),
    expect: [{ proof: 'b', prefix: 'MILESTONE S30 ' }] },
  { row: 'GT-35', stages: ['S12'], element: 'the western range (EARTH)', mutation: 'open its minimal walkable cut',
    find: (c) => cutOpen(c, 'western_range', TerrainType.Grass), expect: skip('S12') },
  { row: 'GT-36', stages: ['S12'], element: 'the giant NPC on the tunnel\'s chokepoint', mutation: 'remove the NPC',
    find: (c) => npcRemoved(c, 'ruby'), expect: skip('S12') },
  { row: 'GT-37', stages: ['S15'], element: 'Crescent\'s mountain ring (FIRE)', mutation: 'open its minimal walkable cut',
    find: (c) => cutOpen(c, 'crescent_ring', TerrainType.Grass), expect: skip('S15') },
  // NW2 (docs/NW2_EDITS_PLAN.md 10): the Ice Cavern's tip; GT-38, GT-39 stay unused, GT-42 is the dwarves' (NW2-E)
  { row: 'GT-40', stages: ['S16'], element: 'the Rime Hollow\'s wall ice_ring (FIRE)', mutation: 'open its minimal walkable cut',
    find: (c) => cutOpen(c, 'ice_ring', TerrainType.Grass), expect: skip('S16') },
  { row: 'GT-41', stages: ['S16'], element: 'the dock fir_ice', mutation: 'remove', find: (c) => docks(c, ['fir_ice']),
    expect: [goal] },
  { row: 'GT-43', stages: ['S16'], element: 'the ridge ice_neck (FIRE)', mutation: 'open its minimal walkable cut',
    find: (c) => cutOpen(c, 'ice_neck', TerrainType.Grass), expect: [],
    nlb: 'the tip becomes walkable from Crescent\'s shore, so the fir_ice dock is redundant; S16 still needs the canoe' },
];

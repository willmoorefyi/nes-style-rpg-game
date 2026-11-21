/**
 * The mini world (tests/fixtures/quest/mini.yaml) as a proof context, with its late data: its own travel rows (the
 * flight stand-in starts the party at the north arrival) and two kits for the price rules. Shared by
 * questMutate.test.ts and travelMatrix.test.ts.
 */
import { createQuestContext, type QuestContext } from '../../src/progression/questProofs.js';
import { attachLate, buildLateData, type LateInput } from '../../src/progression/questLateData.js';
import type { TravelRow } from '../../src/progression/questTravelRows.js';
import { loadFixture } from '../fixtures/quest/loadFixture.js';

export const MINI_ROWS: TravelRow[] = [
  { id: 'T0', reach: ['cornelia'], notReach: ['a1_pravoka', 'elf_elfheim', 'ert_melmond', 'fir_crescent'] },
  { id: 'T1', from: 'T0', flags: ['BRIDGE_BUILT'], reach: ['a1_pravoka', 'a1_matoya'], notReach: ['elf_elfheim'] },
  { id: 'T2', from: 'T1', vehicles: [{ type: 'ship', at: 'a1_pravoka' }], reach: ['elf_elfheim'],
    notReach: ['ert_melmond', 'fir_crescent'] },
  { id: 'T3', from: 'T2', flags: ['CANAL_OPEN'], reach: ['ert_melmond', 'fir_crescent'], notReach: ['fir_volcano', 'fir_ice'] },
  { id: 'T5', from: 'T3', items: ['canoe'], reach: ['fir_volcano', 'fir_ice', 'fir_desert'], notReach: ['wat_onrac'] },
  { id: 'T6b', start: 'n_arrival', flags: ['AIRSHIP_RAISED'], reach: ['wat_onrac'], notReach: ['wat_waterfall'] },
  { id: 'B1', from: 'T2', reach: [], notReach: [], docks: ['a1_pravoka', 'elf_port', 'ert_dwarf'] },
  { id: 'B2', from: 'T3', reach: [], notReach: [],
    docks: ['a1_pravoka', 'elf_port', 'ert_dwarf', 'ert_melmond', 'fir_crescent', 'fir_ice'] },
];

export const MINI_LATE: LateInput = {
  enemies: [{ id: 'goblin', xpReward: 6, goldReward: 12 }],
  items: [{ id: 'sword', price: 100 }, { id: 'great_sword', price: 4000 }],
  kits: {
    k_low: { warrior: { gear: ['sword'], spells: [] } },
    k_high: { warrior: { gear: ['great_sword'], spells: [] } },
  },
  travelRows: MINI_ROWS,
};

export function miniContext(stage?: string, name = 'mini'): QuestContext {
  return attachLate(createQuestContext(loadFixture(name), { stage }), buildLateData(MINI_LATE));
}

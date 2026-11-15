/**
 * F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 8): the balance kits moved from tests/helpers/balanceData.ts into
 * assets/data/kits.yaml. The old keys must equal the old literals, so the move is neutral; later tranches may add keys.
 */
import { describe, it, expect } from 'vitest';
import { FULL_KIT, KITS, START_KIT, makeMember } from '../helpers/balanceData.js';

/** The literals balanceData.ts held before F0. */
const OLD_START = {
  warrior: { gear: ['rapier', 'leather_armor', 'wooden_shield'], spells: [] },
  thief: { gear: ['rapier', 'leather_armor'], spells: [] },
  monk: { gear: ['wooden_nunchaku', 'cloth'], spells: [] },
  white_mage: { gear: ['hammer', 'cloth'], spells: ['cure'] },
  black_mage: { gear: ['small_knife', 'cloth'], spells: ['fire'] },
  red_mage: { gear: ['rapier', 'cloth'], spells: [] },
};
const OLD_FULL = {
  warrior: { gear: ['rapier', 'chain_mail', 'wooden_shield', 'cap'], spells: [] },
  thief: { gear: ['rapier', 'leather_armor', 'cap'], spells: [] },
  white_mage: { gear: ['hammer', 'cloth', 'cap'], spells: ['cure', 'ruse'] },
  black_mage: { gear: ['small_knife', 'cloth', 'cap'], spells: ['fire', 'lit', 'slep'] },
};
const BASE = ['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage'];

describe('kits.yaml', () => {
  it('start: the 6 base classes equal the old literals', () => {
    for (const cls of BASE) expect(START_KIT[cls], cls).toEqual(OLD_START[cls as keyof typeof OLD_START]);
  });

  it('full: the 4 party classes equal the old literals', () => {
    for (const cls of Object.keys(OLD_FULL)) expect(FULL_KIT[cls], cls).toEqual(OLD_FULL[cls as keyof typeof OLD_FULL]);
  });

  it('naked: every base class, no gear and no spells', () => {
    for (const cls of BASE) expect(KITS.naked[cls], cls).toEqual({ gear: [], spells: [] });
  });

  it('every kit entry equips on its class with no refusal', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      for (const [cls, k] of Object.entries(kit)) expect(() => makeMember(cls, 1, k), `${name}.${cls}`).not.toThrow();
    }
  });
});

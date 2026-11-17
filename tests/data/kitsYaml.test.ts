/**
 * F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 8): the balance kits moved from tests/helpers/balanceData.ts into
 * assets/data/kits.yaml. The old keys must equal the old literals, so the move is neutral; later tranches may add keys.
 */
import { describe, it, expect } from 'vitest';
import { FULL_KIT, KITS, START_KIT, UPGRADED_PARTY, ZONE_TABLES, bossWinRate, floorRun, makeMember, makeParty } from '../helpers/balanceData.js';

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

describe('pass W balance helpers (QUEST_PLAN 4.4: bossWinRate, floorRun)', () => {
  it('bossWinRate: a share in [0, 1], seeded (the same call gives the same value), stronger kits win more', () => {
    const a = bossWinRate(['garland'], 2, 'naked', 'sensible', 30);
    expect(a).toBe(bossWinRate(['garland'], 2, 'naked', 'sensible', 30));
    expect(bossWinRate(['garland'], 3, 'w_s1', 'sensible', 30)).toBeGreaterThan(a);
    expect(bossWinRate(['goblin', 'goblin'], 30, 'w_s20', 'careless', 10, { comp: UPGRADED_PARTY })).toBe(1);
  });

  it('floorRun: the survival share of a run of fights with shared potions, fewer with more fights', () => {
    const one = floorRun(ZONE_TABLES.temple, 1, 1, 'naked', { seeds: 40 });
    const many = floorRun(ZONE_TABLES.temple, 8, 1, 'naked', { seeds: 40 });
    expect(one).toBeGreaterThanOrEqual(many);
    expect(floorRun(ZONE_TABLES.temple, 3, 20, 'w_s11', { seeds: 10 })).toBe(1);
  });

  it('the upgraded party equips the late kits', () => {
    expect(makeParty(30, 'w_s28', true, UPGRADED_PARTY).map((c) => c.getEquipped('weapon')?.id))
      .toEqual(['defender', 'vorpal_sword', 'thor_hammer', 'rune_knife']);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { StatusEffect } from '../../src/battle/StatusEffects.js';
import { ITEMS } from '../helpers/balanceData.js';
import {
  mostHurtIndex, firstFallenIndex, initialTargetIndex, itemTargetKind, initialItemTargetIndex,
  type TargetMember,
} from '../../src/entities/partyTargets.js';

const member = (currentHp: number, maxHp = 30, statuses: StatusEffect[] = []): TargetMember => ({
  currentHp, maxHp, statusTracker: { has: (e: StatusEffect) => statuses.includes(e) },
});

describe('partyTargets (U8)', () => {
  beforeAll(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => ITEMS } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  it('mostHurtIndex picks the living member with the lowest HP / max', () => {
    expect(mostHurtIndex([member(30), member(10, 40), member(5, 10), member(0)])).toBe(1);
    expect(mostHurtIndex([member(20), member(20)])).toBe(0);
    expect(mostHurtIndex([member(0), member(0)])).toBe(-1);
    expect(mostHurtIndex([])).toBe(-1);
  });

  it('firstFallenIndex finds HP 0 or death, or -1', () => {
    expect(firstFallenIndex([member(30), member(0), member(0)])).toBe(1);
    expect(firstFallenIndex([member(30), member(5, 30, ['death'])])).toBe(1);
    expect(firstFallenIndex([member(30), member(30)])).toBe(-1);
  });

  it('initialTargetIndex follows the kind, and falls back to 0', () => {
    const party = [member(30), member(8), member(0), member(25, 30, ['poison'])];
    expect(initialTargetIndex(party, 'heal')).toBe(1);
    expect(initialTargetIndex(party, 'revive')).toBe(2);
    expect(initialTargetIndex(party, 'cure_status', 'poison')).toBe(3);
    expect(initialTargetIndex(party, 'cure_status', 'stone')).toBe(0);
    expect(initialTargetIndex(party, 'cure_status')).toBe(0);
    expect(initialTargetIndex(party, 'other')).toBe(0);
    expect(initialTargetIndex([member(30)], 'revive')).toBe(0);
  });

  it('maps items to kinds (revision 10)', () => {
    expect(itemTargetKind('potion')).toEqual({ kind: 'heal' });
    expect(itemTargetKind('hi_potion')).toEqual({ kind: 'heal' });
    expect(itemTargetKind('phoenix_down')).toEqual({ kind: 'revive' });
    expect(itemTargetKind('antidote')).toEqual({ kind: 'cure_status', status: 'poison' });
    expect(itemTargetKind('soft')).toEqual({ kind: 'cure_status', status: 'stone' });
    expect(itemTargetKind('ether')).toEqual({ kind: 'other' });
    expect(itemTargetKind('unknown_item')).toEqual({ kind: 'other' });
  });

  it('initialItemTargetIndex combines both', () => {
    const party = [member(30), member(8), member(0, 30), member(20, 30, ['stone'])];
    expect(initialItemTargetIndex(party, 'potion')).toBe(1);
    expect(initialItemTargetIndex(party, 'phoenix_down')).toBe(2);
    expect(initialItemTargetIndex(party, 'soft')).toBe(3);
    expect(initialItemTargetIndex(party, 'ether')).toBe(0);
  });
});

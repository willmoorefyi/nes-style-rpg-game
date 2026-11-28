/** Pass EQ (docs/EQUIP_FF1_PLAN.md 8): the item and shop fields the pass adds are validated. */
import { describe, it, expect } from 'vitest';
import { validateItemData } from '../../src/core/schemaValidation.js';

const gear = (extra: Record<string, unknown>) => ({ id: 'x', name: 'X', type: 'armor', stats: { defense: 1 }, price: 1,
  usableBy: ['warrior'], ...extra });

describe('EQ: item slot validation (T1)', () => {
  it('accepts the five slots', () => {
    for (const slot of ['weapon', 'armor', 'shield', 'helmet', 'hands']) expect(() => validateItemData(gear({ slot }))).not.toThrow();
  });

  it('rejects an unknown slot', () => {
    expect(() => validateItemData(gear({ slot: 'feet' }))).toThrow(/ItemData.slot/);
  });
});

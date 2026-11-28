import { describe, it, expect } from 'vitest';
import { SLOT_LABELS } from '../../src/ui/labels.js';

describe('SLOT_LABELS', () => {
  it('names every equipment slot', () => {
    expect(SLOT_LABELS).toEqual({ weapon: 'Weapon', armor: 'Body', shield: 'Shield', helmet: 'Helmet', hands: 'Hands' });
  });
});

import { describe, it, expect } from 'vitest';
import { getElementalMultiplier } from '../../src/battle/Elements.js';

describe('Elements', () => {
  describe('getElementalMultiplier', () => {
    it('returns 2.0 when attack element matches weakness', () => {
      expect(getElementalMultiplier('fire', 'fire')).toBe(2.0);
      expect(getElementalMultiplier('ice', 'ice')).toBe(2.0);
    });

    it('returns 0.5 when attack element matches resist', () => {
      expect(getElementalMultiplier('fire', undefined, 'fire')).toBe(0.5);
      expect(getElementalMultiplier('ice', undefined, 'ice')).toBe(0.5);
    });

    it('returns 1.0 for neutral (no weakness/resist)', () => {
      expect(getElementalMultiplier('fire', undefined, undefined)).toBe(1.0);
      expect(getElementalMultiplier('lightning', 'ice', 'earth')).toBe(1.0);
    });

    it('returns 1.0 for none element', () => {
      expect(getElementalMultiplier('none', 'fire', 'ice')).toBe(1.0);
    });

    it('weakness takes priority over resist when both match', () => {
      // If somehow both match (shouldn't happen), weakness is checked first
      expect(getElementalMultiplier('fire', 'fire', 'fire')).toBe(2.0);
    });
  });
});

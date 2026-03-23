import { describe, it, expect } from 'vitest';
import { getElementalMultiplier, type ElementalProfile } from '../../src/battle/Elements.js';

describe('Elements', () => {
  describe('getElementalMultiplier - legacy', () => {
    it('returns 2.0 when attack element matches weakness', () => {
      expect(getElementalMultiplier('fire', { weakness: 'fire' })).toBe(2.0);
      expect(getElementalMultiplier('ice', { weakness: 'ice' })).toBe(2.0);
    });

    it('returns 0.5 when attack element matches resist', () => {
      expect(getElementalMultiplier('fire', { resist: 'fire' })).toBe(0.5);
      expect(getElementalMultiplier('ice', { resist: 'ice' })).toBe(0.5);
    });

    it('returns 1.0 for neutral (no weakness/resist)', () => {
      expect(getElementalMultiplier('fire', {})).toBe(1.0);
      expect(getElementalMultiplier('lightning', { weakness: 'ice', resist: 'earth' })).toBe(1.0);
    });

    it('returns 1.0 for none element', () => {
      expect(getElementalMultiplier('none', { weakness: 'fire', resist: 'ice' })).toBe(1.0);
    });

    it('weakness takes priority over resist when both match', () => {
      expect(getElementalMultiplier('fire', { weakness: 'fire', resist: 'fire' })).toBe(2.0);
    });
  });

  describe('getElementalMultiplier - ElementalProfile', () => {
    const emptyProfile: ElementalProfile = { weaknesses: [], resistances: [], immunities: [], absorbs: [] };

    it('returns 2.0 for weakness', () => {
      const profile: ElementalProfile = { ...emptyProfile, weaknesses: ['fire', 'ice'] };
      expect(getElementalMultiplier('fire', profile)).toBe(2.0);
      expect(getElementalMultiplier('ice', profile)).toBe(2.0);
    });

    it('returns 0.5 for resistance', () => {
      const profile: ElementalProfile = { ...emptyProfile, resistances: ['lightning'] };
      expect(getElementalMultiplier('lightning', profile)).toBe(0.5);
    });

    it('returns 0.0 for immunity', () => {
      const profile: ElementalProfile = { ...emptyProfile, immunities: ['holy'] };
      expect(getElementalMultiplier('holy', profile)).toBe(0.0);
    });

    it('returns -1.0 for absorb', () => {
      const profile: ElementalProfile = { ...emptyProfile, absorbs: ['dark'] };
      expect(getElementalMultiplier('dark', profile)).toBe(-1.0);
    });

    it('absorb takes priority over all others', () => {
      const profile: ElementalProfile = { weaknesses: ['fire'], resistances: ['fire'], immunities: ['fire'], absorbs: ['fire'] };
      expect(getElementalMultiplier('fire', profile)).toBe(-1.0);
    });

    it('immunity takes priority over weakness/resistance', () => {
      const profile: ElementalProfile = { weaknesses: ['ice'], resistances: ['ice'], immunities: ['ice'], absorbs: [] };
      expect(getElementalMultiplier('ice', profile)).toBe(0.0);
    });

    it('weakness takes priority over resistance', () => {
      const profile: ElementalProfile = { weaknesses: ['earth'], resistances: ['earth'], immunities: [], absorbs: [] };
      expect(getElementalMultiplier('earth', profile)).toBe(2.0);
    });

    it('returns 1.0 for none element', () => {
      const profile: ElementalProfile = { weaknesses: ['fire'], resistances: [], immunities: [], absorbs: [] };
      expect(getElementalMultiplier('none', profile)).toBe(1.0);
    });

    it('supports water and wind elements', () => {
      const profile: ElementalProfile = { weaknesses: ['water'], resistances: ['wind'], immunities: [], absorbs: [] };
      expect(getElementalMultiplier('water', profile)).toBe(2.0);
      expect(getElementalMultiplier('wind', profile)).toBe(0.5);
    });
  });
});

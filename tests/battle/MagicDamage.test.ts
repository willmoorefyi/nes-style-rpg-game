import { describe, it, expect } from 'vitest';
import { calculateMagicDamage } from '../../src/battle/DamageFormula.js';

describe('calculateMagicDamage', () => {
  const fixedRng = () => 0.5; // Middle of variance range

  it('calculates damage based on power and intelligence ratio', () => {
    const damage = calculateMagicDamage(
      { intelligence: 10 },
      { intelligence: 5 },
      { power: 20, element: 'fire' },
      fixedRng
    );
    // power * (10/5) * 1.0 * 1.0 = 40, with variance ~40
    expect(damage).toBeGreaterThan(30);
    expect(damage).toBeLessThan(50);
  });

  it('applies elemental weakness multiplier (2x)', () => {
    const damage = calculateMagicDamage(
      { intelligence: 10 },
      { intelligence: 10, weakness: 'fire' },
      { power: 20, element: 'fire' },
      fixedRng
    );
    // power * 1.0 * 2.0 * variance = ~40
    expect(damage).toBeGreaterThan(35);
  });

  it('applies elemental resist multiplier (0.5x)', () => {
    const damage = calculateMagicDamage(
      { intelligence: 10 },
      { intelligence: 10, resist: 'fire' },
      { power: 20, element: 'fire' },
      fixedRng
    );
    // power * 1.0 * 0.5 * variance = ~10
    expect(damage).toBeLessThan(15);
  });

  it('calculates healing without target defense', () => {
    const heal = calculateMagicDamage(
      { intelligence: 10 },
      { intelligence: 100 }, // Target int shouldn't matter for healing
      { power: 30, isHealing: true },
      fixedRng
    );
    // power * casterInt * variance / 4 = 30 * 10 * 1.0 / 4 = 75
    expect(heal).toBeGreaterThan(60);
    expect(heal).toBeLessThan(90);
  });

  it('returns at least 1 damage', () => {
    const damage = calculateMagicDamage(
      { intelligence: 1 },
      { intelligence: 100, resist: 'fire' },
      { power: 1, element: 'fire' },
      () => 0 // Minimum variance
    );
    expect(damage).toBeGreaterThanOrEqual(1);
  });
});

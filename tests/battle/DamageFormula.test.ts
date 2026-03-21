import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../src/battle/DamageFormula.js';

describe('DamageFormula', () => {
  it('should calculate normal damage', () => {
    const rng = () => 0.5; // Always hit, no crit
    const result = calculateDamage(
      { attack: 20, level: 5 },
      { defense: 10 },
      rng
    );
    expect(result.hit).toBe(true);
    expect(result.critical).toBe(false);
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it('should enforce minimum damage of 1', () => {
    const rng = () => 0.5;
    const result = calculateDamage(
      { attack: 5, level: 1 },
      { defense: 100 },
      rng
    );
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(1);
  });

  it('should handle critical hits (double damage)', () => {
    let callCount = 0;
    const rng = () => {
      callCount++;
      if (callCount === 1) return 0.5; // Hit check
      if (callCount === 2) return 0; // Crit check (< 1/32)
      return 0.5; // Variance
    };
    const result = calculateDamage(
      { attack: 20, level: 5 },
      { defense: 10 },
      rng
    );
    expect(result.critical).toBe(true);
    expect(result.damage).toBeGreaterThan(10);
  });

  it('should miss based on hit/evade chance', () => {
    const rng = () => 0.99; // Miss
    const result = calculateDamage(
      { attack: 20, level: 5, hitPercent: 50 },
      { defense: 10, evadePercent: 10 },
      rng
    );
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
  });

  it('should include level-based variance', () => {
    const results = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const rng = () => i / 10;
      const result = calculateDamage(
        { attack: 20, level: 10 },
        { defense: 10 },
        rng
      );
      if (result.hit) results.add(result.damage);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

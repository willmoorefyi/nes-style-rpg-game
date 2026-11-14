import { describe, it, expect } from 'vitest';
import { magicDamage } from '../../src/battle/DamageFormula.js';
import { magicElementMultiplier } from '../../src/battle/Elements.js';
import { mulberry32 } from '../helpers/testUtils.js';

/** Connect roll first, then the damage roll. */
function rolls(connect: number, dmg: number): () => number {
  let i = 0;
  return () => (i++ === 0 ? connect : dmg);
}

const FIRE = { power: 10, accuracy: 24, element: 'fire' };
// 148 + 24 − 16 = 156/200: a 0.9 roll misses the connect, a 0 roll connects
const MISS = 0.9;
const CONNECT = 0;

describe('magicDamage (FF1)', () => {
  it('FIRE (power 10) on MDef 16 does 10–20 without a connect and 20–40 with one', () => {
    const t = { magicDefense: 16 };
    expect(magicDamage(FIRE, t, rolls(MISS, 0))).toEqual({ damage: 10, connected: false });
    expect(magicDamage(FIRE, t, rolls(MISS, 0.999))).toEqual({ damage: 20, connected: false });
    expect(magicDamage(FIRE, t, rolls(CONNECT, 0))).toEqual({ damage: 20, connected: true });
    expect(magicDamage(FIRE, t, rolls(CONNECT, 0.999))).toEqual({ damage: 40, connected: true });
  });

  it('a weakness raises E by half: [15, 30], or [30, 60] when it connects', () => {
    const t = { magicDefense: 16, weakness: 'fire' };
    expect(magicDamage(FIRE, t, rolls(MISS, 0)).damage).toBe(15);
    expect(magicDamage(FIRE, t, rolls(MISS, 0.999)).damage).toBe(30);
    expect(magicDamage(FIRE, t, rolls(CONNECT, 0)).damage).toBe(30);
    expect(magicDamage(FIRE, t, rolls(CONNECT, 0.999)).damage).toBe(60);
  });

  it('a resistance halves the damage', () => {
    const t = { magicDefense: 16, resist: 'fire' };
    expect(magicDamage(FIRE, t, rolls(MISS, 0)).damage).toBe(5);
    expect(magicDamage(FIRE, t, rolls(CONNECT, 0.999)).damage).toBe(20);
  });

  it('reads an elemental profile (weakness, immunity)', () => {
    const profile = { weaknesses: ['fire' as const], resistances: [], immunities: ['ice' as const], absorbs: [] };
    expect(magicDamage(FIRE, { magicDefense: 0, elementalProfile: profile }, rolls(MISS, 0)).damage).toBe(15);
    expect(magicDamage({ ...FIRE, element: 'ice' }, { magicDefense: 0, elementalProfile: profile }, rolls(MISS, 0)).damage).toBe(0);
  });

  it('a Lv1 Black Mage’s FIRE never does more than 60, even on a weak target (EB-4)', () => {
    const rng = mulberry32(7);
    let max = 0;
    for (let i = 0; i < 5000; i++) max = Math.max(max, magicDamage(FIRE, { magicDefense: 0, weakness: 'fire' }, rng).damage);
    expect(max).toBeLessThanOrEqual(60);
    expect(max).toBeGreaterThan(40);
  });

  it('missing accuracy defaults to 24', () => {
    // 148 + 24 − 16 = 156 → 0.775 connects, 0.785 does not
    expect(magicDamage({ power: 10 }, { magicDefense: 16 }, rolls(0.775, 0)).connected).toBe(true);
    expect(magicDamage({ power: 10 }, { magicDefense: 16 }, rolls(0.785, 0)).connected).toBe(false);
  });
});

describe('magicElementMultiplier', () => {
  it('weakness ×1.5 on E, resistance ×0.5 on damage, none ×1', () => {
    expect(magicElementMultiplier('fire', { weakness: 'fire' })).toEqual({ effectivity: 1.5, damage: 1 });
    expect(magicElementMultiplier('fire', { resist: 'fire' })).toEqual({ effectivity: 1, damage: 0.5 });
    expect(magicElementMultiplier('none', { weakness: 'fire' })).toEqual({ effectivity: 1, damage: 1 });
  });
});

import { describe, it, expect } from 'vitest';
import { physicalAttack, statusHits, healAmount, randInt } from '../../src/battle/DamageFormula.js';

/** Plays back `rolls` in order, then repeats the last one. */
function seq(...rolls: number[]): () => number {
  let i = 0;
  return () => rolls[Math.min(i++, rolls.length - 1)];
}

describe('physicalAttack (FF1)', () => {
  const sure = { hitPercent: 40, hits: 1, crit: 0 };

  it('each hit does rand(A, 2A) − absorb: A=19, absorb 10 gives 9 at the low roll and 28 at the high one', () => {
    const low = physicalAttack({ attack: 19, ...sure }, { evade: 0, absorb: 10 }, () => 0);
    expect(low).toEqual({ damage: 9, hitsLanded: 1, critical: false, hit: true });
    const high = physicalAttack({ attack: 19, ...sure }, { evade: 0, absorb: 10 }, () => 0.999);
    expect(high.damage).toBe(28);
  });

  it('a hit always does at least 1', () => {
    expect(physicalAttack({ attack: 5, ...sure }, { evade: 0, absorb: 100 }, () => 0).damage).toBe(1);
  });

  it('hits on (168 + hit% − evade) / 200: hit% 10 vs evade 6 is 172/200, so 0.85 hits and 0.87 misses', () => {
    const atk = { attack: 10, hitPercent: 10, hits: 1, crit: 0 };
    expect(physicalAttack(atk, { evade: 6, absorb: 0 }, seq(0.85, 0.5)).hit).toBe(true);
    const miss = physicalAttack(atk, { evade: 6, absorb: 0 }, seq(0.87, 0.5));
    expect(miss).toEqual({ damage: 0, hitsLanded: 0, critical: false, hit: false });
  });

  it('a helpless (asleep / paralysed) target is 40 easier to hit', () => {
    const atk = { attack: 10, hitPercent: 0, hits: 1, crit: 0 };
    // chance 168 − 60 = 108 → a 0.6 roll (120) misses; helpless 148 → hits
    expect(physicalAttack(atk, { evade: 60, absorb: 0 }, seq(0.6, 0.5)).hit).toBe(false);
    expect(physicalAttack(atk, { evade: 60, absorb: 0, helpless: true }, seq(0.6, 0.5)).hit).toBe(true);
  });

  it('several hits roll separately and add up', () => {
    // hit, dmg 0 → 10; hit, dmg 0 → 10
    const r = physicalAttack({ attack: 10, hitPercent: 40, hits: 2, crit: 0 }, { evade: 0, absorb: 0 }, () => 0);
    expect(r).toEqual({ damage: 20, hitsLanded: 2, critical: false, hit: true });
    // first hit misses (0.99 × 200 = 198 ≥ 172), second lands
    const one = physicalAttack({ attack: 10, hitPercent: 4, hits: 2, crit: 0 }, { evade: 0, absorb: 0 }, seq(0.99, 0, 0, 0));
    expect(one.hitsLanded).toBe(1);
  });

  it('crit 4 crits on a roll below 0.02 and adds a second rand(A, 2A) that ignores absorb', () => {
    const atk = { attack: 19, hitPercent: 40, hits: 1, crit: 4 };
    // hit 0 → dmg roll 0 (19 − 10 = 9) → crit roll 0.019 → +rand(19, 38) at 0.019 = 19
    const crit = physicalAttack(atk, { evade: 0, absorb: 10 }, seq(0, 0, 0.019, 0.019));
    expect(crit).toEqual({ damage: 28, hitsLanded: 1, critical: true, hit: true });
    const plain = physicalAttack(atk, { evade: 0, absorb: 10 }, seq(0, 0, 0.021));
    expect(plain).toEqual({ damage: 9, hitsLanded: 1, critical: false, hit: true });
  });
});

describe('statusHits / healAmount / randInt', () => {
  it('statusHits lands on (148 + accuracy − magic defence) / 200', () => {
    // 148 + 24 − 16 = 156 → 0.775 (155) lands, 0.785 (157) misses
    expect(statusHits(24, 16, () => 0.775)).toBe(true);
    expect(statusHits(24, 16, () => 0.785)).toBe(false);
  });

  it('healAmount is rand(E, 2E) with no caster stat', () => {
    expect(healAmount({ power: 16 }, () => 0)).toBe(16);
    expect(healAmount({ power: 16 }, () => 0.999)).toBe(32);
  });

  it('randInt covers [lo, hi] inclusive', () => {
    expect(randInt(() => 0, 3, 6)).toBe(3);
    expect(randInt(() => 0.999, 3, 6)).toBe(6);
  });
});

/** Pass CHT: the pure boost rules (src/core/Boosts.ts). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BOOST_ROWS, DEFAULT_BOOSTS, battleBoosts, boostSummary, defaultBoosts, isDefaultBoosts, parseBoosts, scaleReward,
  stepBoost,
} from '../../src/core/Boosts.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('scaleReward: gold and XP multipliers', () => {
  it('x0 gives nothing, x1 the base, x4 four times', () => {
    expect(scaleReward(37, 0)).toBe(0);
    expect(scaleReward(37, 1)).toBe(37);
    expect(scaleReward(37, 4)).toBe(148);
    expect(scaleReward(0, 4)).toBe(0);
  });

  it('x0.5 rounds an odd amount down (7 G -> 3 G, 1 XP -> 0)', () => {
    expect(scaleReward(7, 0.5)).toBe(3);
    expect(scaleReward(8, 0.5)).toBe(4);
    expect(scaleReward(1, 0.5)).toBe(0);
  });

  it('x2 / x3 are exact', () => {
    expect(scaleReward(25, 2)).toBe(50);
    expect(scaleReward(25, 3)).toBe(75);
  });
});

describe('the six rows and their steps', () => {
  it('the rows are gold, XP, encounters, battle speed, walk speed and escape, with the spec steps', () => {
    expect(BOOST_ROWS.map((r) => r.key)).toEqual(['gold', 'xp', 'encounters', 'battleSpeed', 'walkSpeed', 'alwaysEscape']);
    expect(BOOST_ROWS.map((r) => r.steps.map((v) => r.format(v)).join(' '))).toEqual([
      'x0 x0.5 x1 x2 x3 x4', 'x0 x0.5 x1 x2 x3 x4', 'Off x0.5 x1 x2', 'x1 x2 x4', 'x1 x2', 'Off On',
    ]);
    for (const r of BOOST_ROWS) expect(r.help.length).toBeGreaterThan(0);
  });

  it('the defaults are x1 everywhere and escape Off', () => {
    expect(DEFAULT_BOOSTS).toEqual({ gold: 1, xp: 1, encounters: 1, battleSpeed: 1, walkSpeed: 1, alwaysEscape: false });
    expect(isDefaultBoosts(defaultBoosts())).toBe(true);
    expect(Object.isFrozen(DEFAULT_BOOSTS)).toBe(true);
  });

  it('a step moves one value and clamps at both ends (no wrap); the input is not changed', () => {
    const b = defaultBoosts();
    expect(stepBoost(b, 'gold', 1).gold).toBe(2);
    expect(stepBoost(b, 'gold', -1).gold).toBe(0.5);
    expect(b.gold).toBe(1);
    let g = b;
    for (let i = 0; i < 10; i++) g = stepBoost(g, 'gold', 1);
    expect(g.gold).toBe(4);
    for (let i = 0; i < 10; i++) g = stepBoost(g, 'gold', -1);
    expect(g.gold).toBe(0);
    expect(stepBoost(b, 'encounters', -1).encounters).toBe(0.5);
    expect(stepBoost(stepBoost(b, 'encounters', -1), 'encounters', -1).encounters).toBe(0);
    expect(stepBoost(b, 'alwaysEscape', 1).alwaysEscape).toBe(true);
    expect(stepBoost(b, 'alwaysEscape', -1).alwaysEscape).toBe(false);
    expect(stepBoost(stepBoost(b, 'battleSpeed', 1), 'battleSpeed', 1).battleSpeed).toBe(4);
  });
});

describe('the indicator and the battle view', () => {
  it('boostSummary is empty at the defaults and names every changed value', () => {
    expect(boostSummary(defaultBoosts())).toBe('');
    const b = { ...defaultBoosts(), gold: 4 as const, xp: 0 as const, encounters: 0 as const, battleSpeed: 4 as const,
      walkSpeed: 2 as const, alwaysEscape: true };
    expect(boostSummary(b)).toBe('G x4 XP x0 ENC Off BTL x4 WALK x2 RUN On');
    expect(isDefaultBoosts(b)).toBe(false);
  });

  it('battleBoosts carries the rewards, the escape and the speed', () => {
    expect(battleBoosts({ ...defaultBoosts(), gold: 2, xp: 0.5, alwaysEscape: true, battleSpeed: 4 }))
      .toEqual({ gold: 2, xp: 0.5, alwaysEscape: true, speed: 4 });
  });
});

describe('parseBoosts: the save-file form', () => {
  it('missing (a save before v3) is the defaults, silently', () => {
    const err = vi.spyOn(console, 'error');
    expect(parseBoosts(undefined)).toEqual(DEFAULT_BOOSTS);
    expect(err).not.toHaveBeenCalled();
  });

  it('keeps valid values and fills missing keys with the defaults', () => {
    expect(parseBoosts({ gold: 0.5, alwaysEscape: true })).toEqual({ ...DEFAULT_BOOSTS, gold: 0.5, alwaysEscape: true });
  });

  it('a malformed value or object is logged and replaced by the default', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseBoosts({ gold: 5, xp: '2', encounters: 2 })).toEqual({ ...DEFAULT_BOOSTS, encounters: 2 });
    expect(err).toHaveBeenCalledTimes(2);
    expect(parseBoosts('fast')).toEqual(DEFAULT_BOOSTS);
    expect(err).toHaveBeenCalledTimes(3);
  });
});

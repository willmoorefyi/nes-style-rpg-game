/**
 * scripts/check-bounds.ts (G9, docs/QUEST_PLAN.md 7; W1-F): the name parser and the 3-point / 2-round margins.
 */
import { describe, it, expect } from 'vitest';
import { checkFiles, checkName, expand, testNames } from '../../scripts/check-bounds.js';

describe('check-bounds', () => {
  it('a range 3+ points from its measured value passes; closer fails', () => {
    expect(checkName('piscodemon x3 at Lv 9 wins 75-95 % (measured 82.5)')).toEqual([]);
    expect(checkName('wins 75-95 % (measured 93)')).toEqual(['bound <= 95 is 2 points from measured 93 (needs 3)']);
    expect(checkName('wins 60 to 80 % (measured 61)')).toEqual(['bound >= 60 is 1 points from measured 61 (needs 3)']);
  });

  it('>= and <= bounds each pair with the measured tag after them', () => {
    expect(checkName('sensible >= 95 % (measured 99.5); careless >= 85 % (measured 90.25)')).toEqual([]);
    expect(checkName('Lv 7 <= 60 % (measured 58)')).toEqual(['bound <= 60 is 2 points from measured 58 (needs 3)']);
    expect(checkName('at least 85 % (measured 87)')).toHaveLength(1);
  });

  it('a round count needs a 2-round margin (D-C7-19), the bracket form included', () => {
    expect(checkName('median rounds in [10, 15] (measured 12)')).toEqual([]);
    expect(checkName('median <= 9 rounds (measured 8)')).toEqual(['bound <= 9 is 1 rounds from measured 8 (needs 2)']);
    expect(checkName('wins in <= 14 rounds (measured 12)')).toEqual([]);
  });

  it('a name with no measured tag, or a tag with no bound, fails; an invariant is exempt', () => {
    expect(checkName('wins 75-95 %')).toEqual(['no (measured N) tag']);
    expect(checkName('wins (measured 80)')).toEqual(['no bound next to its measured value']);
    expect(checkName('>= 50 % (measured 80); rounds (measured 9)')).toEqual(['measured 9 has no bound']);
    expect(checkName('invariant: the crack plays before F4')).toEqual([]);
  });

  it('reads it / test / it.each names from a source file', () => {
    const src = [
      "it('a >= 1 % (measured 5)', () => {});",
      'test("b <= 9 % (measured 2)", () => {});',
      "it.each([[1, 2], [3, (4)]])('c %s >= 1 % (measured 9)', () => {});",
      "describe('not a test', () => {});",
    ].join('\n');
    expect(testNames(src)).toEqual(['a >= 1 % (measured 5)', 'b <= 9 % (measured 2)', 'c %s >= 1 % (measured 9)']);
  });

  it('an unmatched glob reads no file (G9 before any w_* test exists)', () => {
    expect(expand('tests/balance/zz_none_*.test.ts')).toEqual([]);
    expect(checkFiles(['tests/balance/zz_none_*.test.ts'])).toEqual({ problems: [], tests: 0 });
    expect(expand('tests/balance/garland*.test.ts')).toEqual(['tests/balance/garland.test.ts']);
  });
});

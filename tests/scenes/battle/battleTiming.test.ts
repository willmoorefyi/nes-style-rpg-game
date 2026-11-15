/** Pass F item 6 (docs/FEEDBACK_PLAN_2026-11-14.md §3.6): the hold table at the five message speeds. */
import { describe, it, expect } from 'vitest';
import {
  ACTION_BEAT_FRAMES, ANNOUNCE_FRAMES, BATTLE_MESSAGE_FRAMES, INTRO_FRAMES, NOTICE_FRAMES, RESULT_FRAMES, ROUND_END_FRAMES,
  SPEED_MULTIPLIER, ConfirmSkip, SKIP_GUARD_FRAMES, holdFrames,
} from '../../../src/scenes/battle/battleTiming.js';
import { FLOAT_FRAMES, floatFrames } from '../../../src/scenes/battle/floatingNumbers.js';
import type { MessageSpeed } from '../../../src/core/Settings.js';

/** The plan's table: [speed 3, speed 1, speed 5] per hold (old values: 30, 25, 0, 20, 45, 60, 30). */
const TABLE: [string, number, [number, number, number]][] = [
  ['announce', ANNOUNCE_FRAMES, [45, 72, 25]],
  ['result line', RESULT_FRAMES, [60, 96, 33]],
  ['action beat', ACTION_BEAT_FRAMES, [15, 24, 8]],
  ['round end', ROUND_END_FRAMES, [40, 64, 22]],
  ['battle message', BATTLE_MESSAGE_FRAMES, [90, 144, 50]],
  ['intro', INTRO_FRAMES, [75, 120, 41]],
  ['notice', NOTICE_FRAMES, [60, 96, 33]],
];

describe('battleTiming: the hold table', () => {
  it('the multipliers are 1.6, 1.3, 1.0, 0.75, 0.55 for speeds 1-5', () => {
    expect(SPEED_MULTIPLIER).toEqual({ 1: 1.6, 2: 1.3, 3: 1.0, 4: 0.75, 5: 0.55 });
  });

  for (const [name, base, [s3, s1, s5]] of TABLE) {
    it(`${name}: ${s3} at speed 3, ${s1} at speed 1, ${s5} at speed 5`, () => {
      expect(holdFrames(base, 3)).toBe(s3);
      expect(holdFrames(base, 1)).toBe(s1);
      expect(holdFrames(base, 5)).toBe(s5);
    });
  }

  it('every hold shrinks from speed 1 to speed 5', () => {
    for (const [name, base] of TABLE) {
      const v = ([1, 2, 3, 4, 5] as MessageSpeed[]).map((s) => holdFrames(base, s));
      for (let i = 1; i < v.length; i++) expect(v[i], name).toBeLessThan(v[i - 1]);
    }
  });

  it('floating numbers live 72 frames at speeds 1-3 and 48 at speed 5 (old 48 everywhere)', () => {
    expect(FLOAT_FRAMES).toBe(72);
    expect([1, 2, 3, 4, 5].map((s) => floatFrames(s as MessageSpeed))).toEqual([72, 72, 72, 54, 48]);
  });
});

describe('ConfirmSkip: one hold per press', () => {
  it('a press skips at once; a second press inside the guard is ignored; after the guard it skips again', () => {
    const g = new ConfirmSkip();
    expect(g.take(true, 1)).toBe(true);
    expect(g.take(true, 1)).toBe(false);
    for (let i = 0; i < SKIP_GUARD_FRAMES - 1; i++) expect(g.take(false, 1)).toBe(false);
    expect(g.take(true, 1)).toBe(true);
  });

  it('no press never skips', () => {
    const g = new ConfirmSkip();
    for (let i = 0; i < 50; i++) expect(g.take(false, 1)).toBe(false);
  });
});

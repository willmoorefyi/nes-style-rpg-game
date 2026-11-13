import { describe, it, expect } from 'vitest';
import { ATTACK_STYLES, ATTACK_REACH, advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackStyle } from '../../../src/scenes/battle/attackChoreography.js';

describe('attack choreography', () => {
  it('every style starts in line and ends at contact in the strike pose', () => {
    for (const style of ATTACK_STYLES) {
      const end = advanceAt(style, advanceFrames(style));
      expect(end.pose).toBe('attack');
      expect(end.dy).toBeCloseTo(0);
      expect(end.dx).toBeLessThan(-100);
      expect(Math.abs(advanceAt(style, 0).dx)).toBeLessThan(1);
    }
    expect(advanceAt('lunge', advanceFrames('lunge')).dx).toBeCloseTo(-ATTACK_REACH);
  });

  it('the lunge winds up (weapon raised, drawn back) before it runs in', () => {
    const windup = advanceAt('lunge', 6);
    expect(windup.pose).toBe('victory');
    expect(windup.dx).toBeGreaterThan(0);
    expect(advanceAt('lunge', 13).pose).toBe('ready');
  });

  it('the return lands back in line in the ready pose', () => {
    const from = advanceAt('lunge', advanceFrames('lunge'));
    const end = returnAt(from, RETURN_FRAMES, 'lunge');
    expect(end.dx).toBeCloseTo(0);
    expect(end.dy).toBeCloseTo(0);
    expect(end.pose).toBe('ready');
  });

  it('reads ?attack= and falls back to the default', () => {
    expect(parseAttackStyle('?attack=leap')).toBe('leap');
    expect(parseAttackStyle('?attack=nope')).toBe('lunge');
    expect(parseAttackStyle('')).toBe('lunge');
  });
});

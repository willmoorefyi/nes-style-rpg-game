import { describe, it, expect } from 'vitest';
import { ATTACK_STYLES, ATTACK_REACH, advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackStyle, castAt, castReturnAt,
  CAST_FRAMES, idlePose, IDLE_PERIOD, parseAttackOverride, pickAttackStyle, RANDOM_ATTACK_STYLES } from '../../../src/scenes/battle/attackChoreography.js';

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

  it('the lunge draws back, coils, springs and strikes, in that order', () => {
    const windup = advanceAt('lunge', 2);
    expect(windup.pose).toBe('atk_wind1');
    expect(advanceAt('lunge', 6).pose).toBe('atk_wind2');
    expect(advanceAt('lunge', 6).dx).toBeGreaterThan(0);
    expect(advanceAt('lunge', 15).pose).toBe('atk_mid');
    const order = Array.from({ length: advanceFrames('lunge') + 1 }, (_, t) => advanceAt('lunge', t).pose)
      .filter((p, i, a) => i === 0 || a[i - 1] !== p);
    expect(order).toEqual(['atk_wind1', 'atk_wind2', 'atk_mid', 'attack']);
  });

  it('the return follows through before settling into the ready pose', () => {
    const from = advanceAt('lunge', advanceFrames('lunge'));
    expect(returnAt(from, 2, 'lunge').pose).toBe('atk_follow');
  });

  it('a spell gathers, raises the hand, holds the cast, then releases on the way back', () => {
    expect(castAt(0).pose).toBe('cast_gather');
    expect(castAt(10).pose).toBe('cast_rise');
    expect(castAt(CAST_FRAMES).pose).toBe('cast');
    expect(castAt(CAST_FRAMES).dx).toBeLessThan(0);
    const from = castAt(CAST_FRAMES);
    expect(castReturnAt(from, 1).pose).toBe('cast_release');
    expect(castReturnAt(from, 1).dx).toBeCloseTo(from.dx);
    const end = castReturnAt(from, RETURN_FRAMES);
    expect(end.pose).toBe('ready');
    expect(end.dx).toBeCloseTo(0);
  });

  it('the idle breathes, with members out of step', () => {
    expect(idlePose(0, 0)).toBe('ready');
    expect(idlePose(IDLE_PERIOD / 2, 0)).toBe('idle_b');
    expect(idlePose(IDLE_PERIOD, 0)).toBe('ready');
    expect([0, 1, 2, 3].map(i => idlePose(20, i))).toContain('idle_b');
  });

  it('the return lands back in line in the ready pose', () => {
    const from = advanceAt('lunge', advanceFrames('lunge'));
    const end = returnAt(from, RETURN_FRAMES, 'lunge');
    expect(end.dx).toBeCloseTo(0);
    expect(end.dy).toBeCloseTo(0);
    expect(end.pose).toBe('ready');
  });

  it('draws lunge, dash or leap at random; ?attack= overrides', () => {
    expect(pickAttackStyle(() => 0)).toBe('lunge');
    expect(pickAttackStyle(() => 0.5)).toBe('dash');
    expect(pickAttackStyle(() => 0.999)).toBe('leap');
    expect(RANDOM_ATTACK_STYLES).not.toContain('classic');
    expect(parseAttackOverride('?attack=dash')).toBe('dash');
    expect(parseAttackOverride('?attack=nope')).toBeNull();
    expect(parseAttackOverride('')).toBeNull();
  });

  it('reads ?attack= and falls back to the default', () => {
    expect(parseAttackStyle('?attack=leap')).toBe('leap');
    expect(parseAttackStyle('?attack=nope')).toBe('lunge');
    expect(parseAttackStyle('')).toBe('lunge');
  });
});

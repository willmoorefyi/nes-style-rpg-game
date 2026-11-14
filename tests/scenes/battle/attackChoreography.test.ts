import { describe, it, expect } from 'vitest';
import { ATTACK_STYLES, MIN_ATTACK_REACH, MAX_ATTACK_REACH, REACH_OVERLAP, attackReach, advanceAt, advanceFrames, returnAt, RETURN_FRAMES, parseAttackStyle, castAt, castReturnAt,
  CAST_FRAMES, idlePose, IDLE_PERIOD, parseAttackOverride, pickAttackStyle, RANDOM_ATTACK_STYLES, attackRise,
  MAX_ATTACK_RISE } from '../../../src/scenes/battle/attackChoreography.js';

describe('attack choreography', () => {
  it('every style starts in line and ends at contact in the strike pose', () => {
    for (const style of ATTACK_STYLES) {
      const end = advanceAt(style, advanceFrames(style));
      expect(end.pose).toBe('attack');
      expect(end.dy).toBeCloseTo(0);
      expect(end.dx).toBeLessThan(-100);
      expect(Math.abs(advanceAt(style, 0).dx)).toBeLessThan(1);
    }
    expect(advanceAt('lunge', advanceFrames('lunge')).dx).toBeCloseTo(-MIN_ATTACK_REACH);
  });

  it('BA-9: every style, classic included, ends at dx = -reach on its contact frame', () => {
    for (const reach of [MIN_ATTACK_REACH, 420, 644, MAX_ATTACK_REACH]) {
      for (const style of ATTACK_STYLES) {
        const contact = advanceAt(style, advanceFrames(style), reach);
        expect(contact.dx, `${style} ${reach}`).toBeCloseTo(-reach);
        expect(advanceAt(style, advanceFrames(style) + 5, reach).dx).toBeCloseTo(-reach);
      }
    }
  });

  it('BA-9: the reach runs from the attacker\'s home x to the target\'s right edge, clamped to [150, 900]', () => {
    expect(attackReach(1380, 760)).toBe(1380 - 760 + REACH_OVERLAP);
    expect(attackReach(1380, 1300)).toBe(MIN_ATTACK_REACH);
    expect(attackReach(1515, 200)).toBe(MAX_ATTACK_REACH);
    expect(attackReach(1380, Number.NaN)).toBe(MIN_ATTACK_REACH);
    expect([MIN_ATTACK_REACH, MAX_ATTACK_REACH]).toEqual([150, 900]);
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

describe('U3: the melee advance also moves to the target\'s row', () => {
  it('for every style the contact frame lands at (-dx, rise), up or down', () => {
    for (const rise of [-315, -120, 0, 90]) {
      for (const style of ATTACK_STYLES) {
        const end = advanceAt(style, advanceFrames(style), { dx: 644, dy: rise });
        expect(end.dx, `${style} ${rise}`).toBeCloseTo(-644);
        expect(end.dy, `${style} ${rise}`).toBeCloseTo(rise); // old: 0, the attacker's own row
        expect(end.pose).toBe('attack');
      }
    }
  });

  it('the vertical move follows the horizontal progress: monotonic, from 0 to the rise (the hop rides on top)', () => {
    for (const style of ATTACK_STYLES) {
      let prev = 0;
      for (let t = 0; t <= advanceFrames(style); t++) {
        const extra = advanceAt(style, t, { dx: 500, dy: -300 }).dy - advanceAt(style, t, 500).dy;
        expect(extra, `${style} t=${t}`).toBeLessThanOrEqual(prev + 1e-9);
        expect(extra).toBeGreaterThanOrEqual(-300 - 1e-9);
        prev = extra;
      }
      expect(prev, style).toBeCloseTo(-300);
      expect(advanceAt(style, 0, { dx: 500, dy: -300 }).dy).toBeCloseTo(advanceAt(style, 0, 500).dy);
    }
  });

  it('the return brings both axes back to the line', () => {
    for (const style of ATTACK_STYLES) {
      const from = advanceAt(style, advanceFrames(style), { dx: 500, dy: -280 });
      const end = returnAt(from, RETURN_FRAMES, style);
      expect(end.dx, style).toBeCloseTo(0);
      expect(end.dy, style).toBeCloseTo(0);
      expect(returnAt(from, 0, style).dy, style).toBeCloseTo(-280);
    }
  });

  it('the rise is the feet-row difference, clamped to +-MAX_ATTACK_RISE (>= 385: party feet 740 to enemy feet 360)', () => {
    expect(MAX_ATTACK_RISE).toBeGreaterThanOrEqual(385);
    expect(attackRise(740, 360)).toBe(-380);
    expect(attackRise(425, 470)).toBe(45);
    expect(attackRise(1000, 0)).toBe(-MAX_ATTACK_RISE);
    expect(attackRise(0, 1000)).toBe(MAX_ATTACK_RISE);
    expect(attackRise(500, Number.NaN)).toBe(0);
  });
});

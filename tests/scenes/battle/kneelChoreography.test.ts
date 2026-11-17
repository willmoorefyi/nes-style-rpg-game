/** Pass K (docs/KNEEL_PLAN.md 3, D-K1, D-K3): the kneel tables and the KneelTrack, frame by frame. */
import { describe, it, expect } from 'vitest';
import {
  ENEMY_SHAKE, HERO_SHAKE, KNEEL_FRAMES, KNEEL_IN_FRAMES, KNEEL_OUT_FRAMES, KNEEL_PERIOD, KneelTrack, isKneelFrame, isWeak,
  kneelShake, riseEnd, riseFrame, riseTime,
} from '../../../src/scenes/battle/kneelChoreography.js';

/** The track's frame at clocks from..from+n-1. */
const frames = (t: KneelTrack, from: number, n: number) => Array.from({ length: n }, (_, k) => t.frame(from + k));

describe('kneelChoreography (KNEEL_PLAN 3)', () => {
  it('the section 3 numbers: in 8 (4 + 4), out 6 (3 + 3), hold period 48; the 4 frame names', () => {
    expect([KNEEL_IN_FRAMES, KNEEL_OUT_FRAMES, KNEEL_PERIOD]).toEqual([8, 6, 48]);
    expect([...KNEEL_FRAMES]).toEqual(['kneel_in1', 'kneel_in2', 'kneel', 'kneel_b']);
    expect(['kneel', 'kneel_in2', 'idle', 'daze'].map(isKneelFrame)).toEqual([true, true, false, false]);
  });

  it('in: kneel_in1 at t 0-3, kneel_in2 at 4-7, the hold from 8', () => {
    const t = new KneelTrack(0);
    t.set(true, 100);
    expect(frames(t, 100, 9)).toEqual([...Array(4).fill('kneel_in1'), ...Array(4).fill('kneel_in2'), 'kneel']);
    expect(t.on).toBe(true);
  });

  it('out: kneel_in2 at 0-2, kneel_in1 at 3-5, standing (null) from 6', () => {
    const t = new KneelTrack(0);
    t.set(true, 0, { hold: true });
    t.set(false, 50);
    expect(frames(t, 50, 7)).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', null]);
    expect(t.on).toBe(false);
  });

  it('hold: kneel / kneel_b every 48 frames, out of phase by index * 17', () => {
    const a = new KneelTrack(0);
    const b = new KneelTrack(1);
    a.set(true, 0, { hold: true });
    b.set(true, 0, { hold: true });
    expect([0, 47, 48, 95, 96].map((c) => a.frame(c))).toEqual(['kneel', 'kneel', 'kneel_b', 'kneel_b', 'kneel']);
    expect([30, 31].map((c) => b.frame(c))).toEqual(['kneel', 'kneel_b']);    // 31 + 17 = 48
  });

  it('set(on, clock, {hold: true}) starts in the hold (no in); off with hold cuts at once', () => {
    const t = new KneelTrack(0);
    t.set(true, 10, { hold: true });
    expect(t.frame(10)).toMatch(/^kneel(_b)?$/);
    t.set(false, 20, { hold: true });
    expect(t.frame(20)).toBeNull();
  });

  it('a repeat set is a no-op (the per-frame posture sync never restarts in)', () => {
    const t = new KneelTrack(0);
    t.set(true, 0);
    t.set(true, 3);
    expect(t.frame(4)).toBe('kneel_in2');
    t.set(false, 20);
    t.set(false, 22);
    expect(t.frame(23)).toBe('kneel_in1');
  });

  it('reversal mid-in continues from the frame on screen (time mirrored), and back', () => {
    const t = new KneelTrack(0);
    t.set(true, 0);
    expect(t.frame(2)).toBe('kneel_in1');
    t.set(false, 2);                                      // 2 of 8 into in = 4.5 of 6 into out
    expect(t.frame(2)).toBe('kneel_in1');
    expect(frames(t, 3, 3)).toEqual(['kneel_in1', null, null]);
    const u = new KneelTrack(0);
    u.set(true, 0);
    u.set(false, 6);                                      // kneel_in2 on screen: out at 1.5, also kneel_in2
    expect(u.frame(6)).toBe('kneel_in2');
    u.set(true, 7);                                       // mid-out back to in: kneel_in2 again
    expect(u.frame(7)).toBe('kneel_in2');
  });

  it('amount: 0 standing, eased out over in to 1, held, eased in over out back to 0 (the floaters sink)', () => {
    const t = new KneelTrack(0);
    expect(t.amount(0)).toBe(0);
    t.set(true, 0);
    expect(t.amount(4)).toBeCloseTo(0.75);
    expect(t.amount(8)).toBe(1);
    t.set(false, 20);
    expect(t.amount(23)).toBeCloseTo(0.75);
    expect(t.amount(26)).toBe(0);
  });

  it('isWeak: 25 % or less of max HP and still standing', () => {
    expect(isWeak(25, 100)).toBe(true);
    expect(isWeak(26, 100)).toBe(false);
    expect(isWeak(0, 100)).toBe(false);
    expect(isWeak(1, 4)).toBe(true);
  });

  it('riseFrame: kneel_in2 for 3 frames, kneel_in1 for 3, then null (the action frame)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(riseFrame)).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', null, null]);
  });

  it('riseTime: held at 0 for t < 6, compressed into [6, E), unchanged from E; riseEnd is the first boundary at or after 12', () => {
    expect([0, 5.9, 6, 12, 18, 30].map((t) => riseTime(t, 18))).toEqual([0, 0, 0, 9, 18, 30]);
    expect([riseEnd([9, 9, 6]), riseEnd([10, 5]), riseEnd([6, 16, 6]), riseEnd([15]), riseEnd([0, 6, 18, 3])]).toEqual([18, 15, 22, 15, 24]);
  });

  it('the hit shake: hero +-2 px for 12 frames, enemy +-3 px for 14 (away first, every 2 frames), then 0', () => {
    expect(Array.from({ length: 13 }, (_, k) => kneelShake(k, HERO_SHAKE))).toEqual([-2, -2, 2, 2, -2, -2, 2, 2, -2, -2, 2, 2, 0]);
    expect(kneelShake(13, ENEMY_SHAKE)).toBe(-3);
    expect(kneelShake(14, ENEMY_SHAKE)).toBe(0);
    expect(kneelShake(-1, ENEMY_SHAKE)).toBe(0);
  });
});

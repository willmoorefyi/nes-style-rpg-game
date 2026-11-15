/**
 * Pass F items 3 and 7 (docs/FEEDBACK_PLAN_2026-11-14.md §3.3, §3.7): the travelling MELEE_ATTACK and the HEAVY_ATTACK
 * tables, their cues and the frame fallback. Old code: no travel parameter, every attack the 31-frame in-place lunge.
 */
import { describe, it, expect } from 'vitest';
import { ATTACK_CONTACT, ATTACK_FRAMES, attackAt, resolveFrame, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { HEAVY_HOLD_FRAMES, attackTable, travelAttackAt, travelFrames, type AttackKind } from '../../../src/scenes/battle/enemyAttackTables.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';

const L = 24;
const opts = (travel: number, hasRaise = false, hop = 10) => ({ lunge: L, travel, hop, hasRaise });
const seq = (kind: AttackKind, travel: number, hasRaise = false) =>
  Array.from({ length: attackTable(kind, travel).total }, (_, t) => travelAttackAt(kind, t, opts(travel, hasRaise)));

describe('MELEE_ATTACK (item 3)', () => {
  const N = travelFrames(600);

  it('N = clamp(round(8 + travel / 60), 10, 24); contact at 14 + N, total 47 + N', () => {
    expect([0, 60, 600, 960, 2000].map(travelFrames)).toEqual([10, 10, 18, 24, 24]);
    expect(attackTable('melee', 600)).toEqual({ n: N, contactAt: 14 + N, holdAt: null, total: 47 + N });
  });

  it('at contact the travel is complete and the lunge part is 0.75 L; two frames later it is L', () => {
    const c = travelAttackAt('melee', 14 + N, opts(600));
    expect(c.frame).toBe('attack');
    expect(c.k).toBe(1);
    expect(c.dx).toBeCloseTo(0.75 * L);
    expect(travelAttackAt('melee', 14 + N - 1, opts(600)).frame).toBe('atk_mid');
    expect(travelAttackAt('melee', 16 + N, opts(600)).dx).toBeCloseTo(L);
  });

  it('through the travel the total dx (travel x k + lunge) rises monotonically, with hops above the line; poses alternate', () => {
    const fs = seq('melee', 600).slice(11, 11 + N);
    const dx = fs.map((f) => 600 * f.k + f.dx);
    for (let k = 1; k < dx.length; k++) expect(dx[k]).toBeGreaterThanOrEqual(dx[k - 1]);
    expect(fs.every((f) => f.dy <= 0)).toBe(true);
    expect(Math.min(...fs.map((f) => f.dy))).toBeLessThanOrEqual(-9);
    expect(new Set(fs.map((f) => f.frame))).toEqual(new Set(['atk_wind2', 'atk_mid']));
  });

  it('the return eases home: the last frame has no offset and the attack ends idle', () => {
    const fs = seq('melee', 600);
    const last = fs[fs.length - 1];
    expect(last.frame).toBe('idle');
    expect(600 * last.k + last.dx).toBe(0);
    expect(last.dy).toBeCloseTo(0);
    expect(travelAttackAt('melee', 47 + N, opts(600))).toEqual({ frame: 'idle', dx: 0, dy: 0, k: 0 });
  });

  it('the in-place table (ranged, no target) is the old 31-frame ATTACK, unchanged', () => {
    expect(attackTable('inplace', 0)).toEqual({ n: 0, contactAt: ATTACK_CONTACT, holdAt: null, total: ATTACK_FRAMES });
    for (let t = 0; t < ATTACK_FRAMES; t++) expect(travelAttackAt('inplace', t, opts(0))).toEqual({ ...attackAt(t, L), k: 0 });
  });
});

describe('HEAVY_ATTACK (item 7)', () => {
  const N = travelFrames(500);

  it('contact at N + 29, the hold at N + 6 for 18 frames, total N + 69', () => {
    expect(attackTable('heavy', 500)).toEqual({ n: N, contactAt: N + 29, holdAt: N + 6, total: N + 69 });
    expect(attackTable('heavy', 0)).toEqual({ n: 0, contactAt: 29, holdAt: 6, total: 69 });
    expect(travelAttackAt('heavy', N + 29, opts(500)).frame).toBe('attack');
    expect(travelAttackAt('heavy', N + 28, opts(500)).frame).not.toBe('attack');
  });

  it('the 18-frame hold shows attack_raise / atk_raise_b with hasRaise, the atk_wind2 coil without', () => {
    const hold = (raise: boolean) => seq('heavy', 500, raise).slice(N + 6, N + 6 + HEAVY_HOLD_FRAMES).map((f) => f.frame);
    expect(new Set(hold(true))).toEqual(new Set(['attack_raise', 'atk_raise_b']));
    expect(hold(true).slice(0, 8)).toEqual(['attack_raise', 'attack_raise', 'attack_raise', 'attack_raise', 'atk_raise_b',
      'atk_raise_b', 'atk_raise_b', 'atk_raise_b']);
    expect(new Set(hold(false))).toEqual(new Set(['atk_wind2']));
    expect(seq('heavy', 500, false)[N + 6 - 1].frame).toBe('atk_wind1');
    expect(seq('heavy', 500, true)[N + 6 - 1].frame).toBe('atk_raise_in');
    expect(seq('heavy', 500, true).slice(N + 24, N + 29).map((f) => f.frame)).toEqual(['atk_swing', 'atk_swing', 'atk_swing', 'atk_swing2', 'atk_swing2']);
    expect(new Set(seq('heavy', 500, false).slice(N + 24, N + 29).map((f) => f.frame))).toEqual(new Set(['atk_mid']));
  });

  it('the lunge part: -L/6 after the raise, -L/4 at the end of the hold, 0.75 L at contact, L in the slam, 0 at the end', () => {
    expect(travelAttackAt('heavy', N + 6, opts(500)).dx).toBeCloseTo(-L / 6);
    expect(travelAttackAt('heavy', N + 6 + HEAVY_HOLD_FRAMES - 1, opts(500)).dx).toBeCloseTo(-L / 4, 0);
    expect(travelAttackAt('heavy', N + 29, opts(500)).dx).toBeCloseTo(0.75 * L);
    expect(travelAttackAt('heavy', N + 33, opts(500)).dx).toBeCloseTo(L);
    expect(travelAttackAt('heavy', N + 53, opts(500))).toMatchObject({ frame: 'idle', dx: 0 });
  });

  it('the hold and contact cues fire exactly once each, on their frames; a non-heavy enemy keeps MELEE_ATTACK', () => {
    const c = new EnemyPoseController(2);
    c.configure(0, { heavy: true, hopPx: 3 });
    const cues: [number, string, number][] = [];
    c.onCue = (i, cue) => cues.push([i, cue, c.debug(i).t]);
    c.playAttack(0, { travel: 500, rise: -100 });
    c.playAttack(1, { travel: 500, rise: -100 });
    for (let f = 0; f < N + 80; f++) c.update(1);
    expect(cues).toEqual([[0, 'hold', N + 6], [1, 'contact', 14 + N], [0, 'contact', N + 29]]);
    c.playAttack(1, { travel: 500, rise: 0 });
    expect(c.attackTiming(1)).toEqual({ contactAt: 14 + N, totalFrames: 47 + N });
    expect(c.attackKind(1)).toBe('melee');
  });

  it('an atlas without the raise frames resolves every heavy frame along the fallback chain', () => {
    const rigged = new Set<MonsterFrame>(['idle', 'attack', 'hurt', 'atk_wind1', 'atk_wind2', 'atk_mid', 'atk_follow', 'atk_recover']);
    for (const f of seq('heavy', 500, true)) expect(resolveFrame(f.frame, (x) => rigged.has(x))).not.toBeNull();
    const old = new Set<MonsterFrame>(['idle', 'attack', 'hurt']);
    for (const f of seq('heavy', 500, true)) expect(resolveFrame(f.frame, (x) => old.has(x))).not.toBeNull();
  });
});

describe('EnemyPoseController with a travel', () => {
  it('state() splits the scaled lunge from the unscaled travel; rise follows the travel progress', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { scaleFactor: 0.5, lungePx: 40 });
    c.playAttack(0, { travel: 600, rise: 200 });
    const N = travelFrames(600);
    c.update(14 + N);
    expect(c.state(0)).toEqual({ pose: 'attack', dx: 15, dy: 0, travelDx: 600, travelDy: 200 });
    expect(c.attackOutDone(0)).toBe(true);
    c.update(33);
    expect(c.isAttacking(0)).toBe(false);
    expect(c.state(0)).toMatchObject({ dx: 0, dy: 0 });
    expect('travelDx' in c.state(0)).toBe(false);
  });

  it('a death away from home holds the travel offset (no ease back across the screen)', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0, { travel: 600, rise: -120 });
    c.update(14 + travelFrames(600) + 3);
    const at = c.state(0);
    c.freezeDying(0);
    for (let k = 0; k < 40; k++) {
      expect(c.state(0)).toMatchObject({ travelDx: at.travelDx, travelDy: at.travelDy });
      c.update(1);
    }
    expect(c.state(0).pose).toBe('hurt');
  });
});

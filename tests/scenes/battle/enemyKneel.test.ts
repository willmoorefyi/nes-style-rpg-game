/** Pass K (docs/KNEEL_PLAN.md D-K2 enemy rows, D-K3, D-K9, D-K16, D-K17): the kneel in EnemyPoseController. */
import { describe, it, expect } from 'vitest';
import { ATTACK_OUT, EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';
import { attackTable } from '../../../src/scenes/battle/enemyAttackTables.js';
import { CAST_FRAMES, PLAIN_CAST_FRAMES, castOut } from '../../../src/scenes/battle/enemyChoreography.js';

/** Pose names over the next n frames (the posture set each frame, as AiEnemyView does). */
function seq(c: EnemyPoseController, n: number, posture: Parameters<EnemyPoseController['setPosture']>[1] = 'kneel'): string[] {
  return Array.from({ length: n }, () => { c.setPosture(0, posture); c.update(1); return c.state(0).pose; });
}

/** A kneeler in its hold. */
function kneeling(posture: 'kneel' | 'daze' = 'kneel', cfg: Parameters<EnemyPoseController['configure']>[1] = {}): EnemyPoseController {
  const c = new EnemyPoseController(1);
  c.configure(0, cfg);
  c.setPosture(0, posture);
  c.snapKneel();
  return c;
}

/** The frame index where the action resolves (attackOutDone turns true), with the posture held. */
function contactOf(c: EnemyPoseController): number {
  for (let t = 0; t < 200; t++) { if (c.attackOutDone(0)) return t; c.setPosture(0, 'kneel'); c.update(1); }
  return -1;
}

describe('EnemyPoseController: the kneel (KNEEL_PLAN D-K2)', () => {
  it('posture kneel or daze: kneel_in1 at t 0-3, kneel_in2 at 4-7, the hold from 8', () => {
    for (const p of ['kneel', 'daze'] as const) {
      const c = new EnemyPoseController(1);
      c.setPosture(0, p);
      const seen = [c.state(0).pose, ...seq(c, 8, p)];
      expect(seen.slice(0, 8)).toEqual([...Array(4).fill('kneel_in1'), ...Array(4).fill('kneel_in2')]);
      expect(seen[8]).toMatch(/^kneel(_b)?$/);
    }
  });

  it('snapKneel (row a): an enemyStatus preset starts in the hold', () => {
    const c = kneeling('daze');
    expect(c.state(0).pose).toMatch(/^kneel(_b)?$/);
  });

  it('D-K3: a poisoned enemy attack shows kneel_in2 at 0-2, kneel_in1 at 3-5, then the table frame; contact unchanged (14 in place)', () => {
    const c = kneeling();
    c.playAttack(0);
    const seen = [c.state(0).pose, ...seq(c, 7)];
    expect(seen).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', 'atk_wind2', 'atk_wind2']);
    const d = kneeling();
    d.playAttack(0);
    expect(contactOf(d)).toBe(ATTACK_OUT);
    expect(ATTACK_OUT).toBe(14);
  });

  it('D-K3: the melee and heavy contacts are those of their tables (14 + N, N + 29), rising or not', () => {
    for (const heavy of [false, true]) {
      const c = kneeling('kneel', { heavy });
      c.playAttack(0, { travel: 600, rise: 0 });
      expect(contactOf(c)).toBe(attackTable(heavy ? 'heavy' : 'melee', 600).contactAt);
    }
  });

  it('D-K3: the boss and plain casts rise the same way; the spell still resolves at castOut', () => {
    for (const hasCast of [true, false]) {
      const c = kneeling('kneel', { hasCast });
      c.playCast(0);
      expect([c.state(0).pose, ...seq(c, 5)]).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1']);
      const d = kneeling('kneel', { hasCast });
      d.playCast(0);
      expect(contactOf(d)).toBe(castOut(hasCast));
    }
    expect([CAST_FRAMES, PLAIN_CAST_FRAMES].every((n) => n > 6)).toBe(true);
  });

  it('D-K3: in restarts the frame the attack ends (the trigger still holds)', () => {
    const c = kneeling();
    c.playAttack(0);
    const seen = seq(c, attackTable('inplace', 0).total + 2);
    const back = seen.indexOf('kneel_in1', 7);
    expect(back).toBe(attackTable('inplace', 0).total - 1);
    expect(c.isAttacking(0)).toBe(false);
  });

  it('a standing enemy does not rise (the table frames from frame 0)', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0);
    expect(c.state(0).pose).toBe('atk_wind1');
  });

  it('D-K17: a poison tick on a kneeler is a +-3 px shake for 14 frames that does not restart in', () => {
    const c = new EnemyPoseController(1);
    c.setPosture(0, 'kneel');
    seq(c, 3);                                            // mid-in
    c.playHurt(0);
    const poses: string[] = [];
    const dx: number[] = [];
    for (let t = 0; t < 16; t++) { c.setPosture(0, 'kneel'); c.update(1); poses.push(c.state(0).pose); dx.push(c.state(0).dx); }
    expect(poses.slice(0, 4)).toEqual(Array(4).fill('kneel_in2'));    // in continues on its own clock
    expect(poses[4]).toMatch(/^kneel(_b)?$/);
    expect(dx.filter((d) => d !== 0)).toHaveLength(14);
    expect(dx.every((d) => d === 0 || Math.abs(d) === 3)).toBe(true);
    expect(poses.some((p) => p.startsWith('hurt'))).toBe(false);
  });

  it('a poison line that lands while the attack plays gets no shake (playHurt never interrupts an attack)', () => {
    const c = kneeling();
    c.playAttack(0);
    seq(c, 8);
    c.playHurt(0);
    c.update(1);
    expect(c.state(0).pose).not.toMatch(/^kneel|^hurt/);
  });

  it('a poison KO dies from the kneel frame (no hurt frames), keeping its sink', () => {
    const c = kneeling();
    const before = c.state(0).pose;
    c.freezeDying(0);
    for (let t = 0; t < 30; t++) { c.update(1); expect(c.state(0).pose).toBe(before); }
    expect(c.kneelAmount(0)).toBe(1);
  });

  it('a wake rises (kneel_in2 3, kneel_in1 3, then idle); stone cuts the kneel at once', () => {
    const c = kneeling('daze');
    const seen = seq(c, 7, 'none');
    expect(seen.slice(0, 5)).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1']);
    expect(seen[6]).toMatch(/^idle/);
    const s = kneeling();
    s.setPosture(0, 'stone');
    expect(s.state(0).pose).toBe('idle');
    expect(s.kneeling(0)).toBe(false);
  });

  it('D-K16: fear trembles additively on a kneel (poison + fear), never on a daze (sleep + fear) or stone', () => {
    const c = kneeling();
    const dx = new Set<number>();
    for (let t = 0; t < 40; t++) { c.setPosture(0, 'kneel', true); c.update(1); dx.add(c.state(0).dx); }
    expect([...dx].sort()).toEqual([-1, 0, 1]);
    expect(c.state(0).pose).toMatch(/^kneel/);
    const z = kneeling('daze');
    for (let t = 0; t < 40; t++) { z.setPosture(0, 'daze', true); z.update(1); expect(z.state(0).dx).toBe(0); }
  });

  it('D-K9: kneelAmount eases 0 -> 1 over in, is 1 in the hold, eases off over the 6 rise frames', () => {
    const c = new EnemyPoseController(1);
    expect(c.kneelAmount(0)).toBe(0);
    c.setPosture(0, 'kneel');
    seq(c, 4);
    expect(c.kneelAmount(0)).toBeCloseTo(0.75);
    seq(c, 10);
    expect(c.kneelAmount(0)).toBe(1);
    c.playAttack(0);
    expect(c.kneelAmount(0)).toBe(1);
    seq(c, 3);
    expect(c.kneelAmount(0)).toBeCloseTo(0.75);
    seq(c, 3);
    expect(c.kneelAmount(0)).toBe(0);
  });
});

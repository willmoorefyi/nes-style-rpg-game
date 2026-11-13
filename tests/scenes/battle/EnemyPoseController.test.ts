import { describe, it, expect } from 'vitest';
import {
  EnemyPoseController, ATTACK_OUT, ATTACK_HOLD, ATTACK_FRAMES, LUNGE_PX, SHAKE_FRAMES, SHAKE_PX,
  CAST_FRAMES, CAST_EDGE, CAST_RISE, CAST_OUT,
} from '../../../src/scenes/battle/EnemyPoseController.js';

function run(c: EnemyPoseController, frames: number): void {
  for (let i = 0; i < frames; i++) c.update(1);
}

describe('EnemyPoseController', () => {
  it('starts idle with no offset', () => {
    const c = new EnemyPoseController(2);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    expect(c.attackOutDone(0)).toBe(true);
  });

  it('attack: lunges out, holds, comes back, then idles', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0);
    expect(c.state(0).pose).toBe('attack');
    expect(c.state(0).dx).toBe(0);
    expect(c.attackOutDone(0)).toBe(false);
    run(c, ATTACK_OUT / 2);
    expect(c.state(0).dx).toBe(LUNGE_PX / 2);
    run(c, ATTACK_OUT / 2);
    expect(c.attackOutDone(0)).toBe(true);
    expect(c.state(0).dx).toBe(LUNGE_PX);
    run(c, ATTACK_HOLD);
    expect(c.state(0)).toMatchObject({ pose: 'attack', dx: LUNGE_PX });
    run(c, ATTACK_FRAMES - ATTACK_OUT - ATTACK_HOLD - 1);
    expect(c.state(0).pose).toBe('attack');
    expect(c.state(0).dx).toBeLessThan(LUNGE_PX);
    expect(c.isAttacking(0)).toBe(true);
    run(c, 1);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    expect(c.isAttacking(0)).toBe(false);
  });

  it('hurt: shakes for SHAKE_FRAMES then idles; a new hit restarts it', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    expect(c.state(0)).toEqual({ pose: 'hurt', dx: SHAKE_PX, dy: 0 });
    run(c, 2);
    expect(c.state(0).dx).toBe(-SHAKE_PX);
    run(c, SHAKE_FRAMES - 4);
    c.playHurt(0);
    run(c, SHAKE_FRAMES - 1);
    expect(c.state(0).pose).toBe('hurt');
    run(c, 1);
    expect(c.state(0).pose).toBe('idle');
  });

  it('a hit never interrupts an attack in progress', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0);
    run(c, 3);
    c.playHurt(0);
    expect(c.state(0).pose).toBe('attack');
  });

  it('dying holds the hurt pose without shaking and ignores later poses and time', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    c.freezeDying(0);
    run(c, 100);
    c.playAttack(0);
    c.playHurt(0);
    expect(c.state(0)).toEqual({ pose: 'hurt', dx: 0, dy: 0 });
  });

  it('poses are per enemy', () => {
    const c = new EnemyPoseController(3);
    c.playAttack(1);
    c.playHurt(2);
    expect([c.state(0).pose, c.state(1).pose, c.state(2).pose]).toEqual(['idle', 'attack', 'hurt']);
  });

  it('cast: rises without lunging, holds, settles, then idles; the action resolves after CAST_OUT', () => {
    const c = new EnemyPoseController(1);
    c.playCast(0);
    expect(c.state(0)).toEqual({ pose: 'cast', dx: 0, dy: -0 });
    expect(c.attackOutDone(0)).toBe(false);
    run(c, CAST_EDGE);
    expect(c.state(0)).toEqual({ pose: 'cast', dx: 0, dy: -CAST_RISE });
    run(c, CAST_OUT - CAST_EDGE);
    expect(c.attackOutDone(0)).toBe(true);
    expect(c.isAttacking(0)).toBe(true);
    c.playHurt(0);                       // a hit never interrupts a cast
    expect(c.state(0).pose).toBe('cast');
    run(c, CAST_FRAMES - CAST_OUT - 1);
    expect(c.isAttacking(0)).toBe(true);
    run(c, 1);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    c.playHurt(0);                       // after the cast, hits land normally
    expect(c.state(0).pose).toBe('hurt');
  });
});

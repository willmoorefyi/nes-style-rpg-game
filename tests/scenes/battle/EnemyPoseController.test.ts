import { describe, it, expect } from 'vitest';
import {
  EnemyPoseController, ATTACK_OUT, ATTACK_FRAMES, LUNGE_PX, HURT_FRAMES, CAST_FRAMES, CAST_OUT, PLAIN_CAST_FRAMES,
} from '../../../src/scenes/battle/EnemyPoseController.js';
import { HURT_HOLD_END, HURT_HOLD_START, DYING_DX } from '../../../src/scenes/battle/enemyChoreography.js';

function run(c: EnemyPoseController, frames: number): void {
  for (let i = 0; i < frames; i++) c.update(1);
}

/** Pose names for every frame of the next `n` frames (sampled before each update). */
function poses(c: EnemyPoseController, i: number, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) { out.push(c.state(i).pose); c.update(1); }
  return out;
}

describe('EnemyPoseController (ENEMY_ANIM_PLAN 3.2)', () => {
  it('starts idle with no offset', () => {
    const c = new EnemyPoseController(2);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    expect(c.attackOutDone(0)).toBe(true);
  });

  it('attack: winds up away from the party, lunges to contact on frame 14, follows through, recovers, idles', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0);
    expect(c.state(0)).toEqual({ pose: 'atk_wind1', dx: 0, dy: 0 });
    run(c, 5);
    expect(c.state(0)).toMatchObject({ pose: 'atk_wind2', dx: -4 });
    run(c, 6);
    expect(c.state(0)).toMatchObject({ pose: 'atk_mid', dx: -6 });
    expect(c.attackOutDone(0)).toBe(false);
    run(c, ATTACK_OUT - 11 - 1);
    expect(c.attackOutDone(0)).toBe(false);          // not before contact
    run(c, 1);
    expect(ATTACK_OUT).toBe(14);
    expect(c.attackOutDone(0)).toBe(true);
    expect(c.state(0)).toMatchObject({ pose: 'attack', dx: 18 });
    run(c, 2);
    expect(c.state(0)).toMatchObject({ pose: 'attack', dx: LUNGE_PX });
    run(c, 6);
    expect(c.state(0)).toMatchObject({ pose: 'atk_follow', dx: LUNGE_PX });
    run(c, 4);
    expect(c.state(0)).toMatchObject({ pose: 'atk_recover', dx: 14 });
    expect(c.isAttacking(0)).toBe(true);
    run(c, ATTACK_FRAMES - 26 - 1);
    expect(c.isAttacking(0)).toBe(true);
    run(c, 1);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    expect(c.isAttacking(0)).toBe(false);
  });

  it('the lunge scales with the sprite (lungePx) and the layout factor, rounded once to whole px', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { lungePx: 40, scaleFactor: 0.5 });
    c.playAttack(0);
    run(c, 16);
    expect(c.state(0).dx).toBe(20);
    run(c, 10);                                      // atk_recover start: 0.58 * 40 * 0.5 = 11.6
    expect(c.state(0).dx).toBe(12);
  });

  it('hurt: in1, in2, held hurt with shake, then back out through in2 and in1 (two poses each way), then idle', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    const seq = poses(c, 0, HURT_FRAMES);
    expect(seq).toEqual([...Array(2).fill('hurt_in1'), ...Array(2).fill('hurt_in2'), ...Array(10).fill('hurt'),
      ...Array(3).fill('hurt_in2'), ...Array(3).fill('hurt_in1')]);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
  });

  it('hurt hold recoils by -6 with a -+3 shake every 2 frames (E14: away from the party first)', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    run(c, HURT_HOLD_START);
    const dx = Array.from({ length: 4 }, () => { const v = c.state(0).dx; c.update(1); return v; });
    expect(dx).toEqual([-9, -9, -3, -3]);
  });

  it('a re-hit during the in-phase lets it finish, then a full 10-frame hold', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    run(c, 3);
    c.playHurt(0);
    expect(c.state(0).pose).toBe('hurt_in2');
    run(c, 1);
    expect(poses(c, 0, 10)).toEqual(Array(10).fill('hurt'));
    expect(c.state(0).pose).toBe('hurt_in2');
  });

  it('a re-hit during the hold restarts the hold', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    run(c, HURT_HOLD_START + 8);
    c.playHurt(0);
    expect(poses(c, 0, 10)).toEqual(Array(10).fill('hurt'));
  });

  it('a re-hit during the return jumps to hurt_in2 and then a full hold, never an idle frame in between', () => {
    const c = new EnemyPoseController(1);
    c.playHurt(0);
    run(c, HURT_HOLD_END + 4);
    expect(c.state(0).pose).toBe('hurt_in1');        // late in the return
    c.playHurt(0);
    const seq = poses(c, 0, 12);
    expect(seq).toEqual([...Array(2).fill('hurt_in2'), ...Array(10).fill('hurt')]);
    expect(seq).not.toContain('idle');
  });

  it('a hit never interrupts an attack or a cast in progress', () => {
    const c = new EnemyPoseController(2);
    c.playAttack(0);
    c.playCast(1);
    run(c, 3);
    c.playHurt(0);
    c.playHurt(1);
    expect(c.state(0).pose).toBe('atk_wind1');
    expect(c.isAttacking(1)).toBe(true);
  });

  it('dying runs the in-phase, then holds hurt at dx -6 with no shake, ignoring later poses', () => {
    const c = new EnemyPoseController(1);
    c.freezeDying(0);
    expect(poses(c, 0, 4)).toEqual(['hurt_in1', 'hurt_in1', 'hurt_in2', 'hurt_in2']);
    run(c, 100);
    c.playAttack(0);
    c.playHurt(0);
    expect(c.state(0)).toEqual({ pose: 'hurt', dx: DYING_DX, dy: 0 });
  });

  it('death mid-lunge eases from the lunge offset to the dying offset with no jump (old probe A9)', () => {
    const c = new EnemyPoseController(1);
    c.playAttack(0);
    run(c, 18);
    const at = c.state(0).dx;
    expect(at).toBe(LUNGE_PX);
    c.freezeDying(0);
    const dx: number[] = [];
    for (let k = 0; k < 6; k++) { dx.push(c.state(0).dx); c.update(1); }
    expect(dx[0]).toBe(at);
    for (let k = 1; k < dx.length; k++) expect(Math.abs(dx[k] - dx[k - 1])).toBeLessThanOrEqual(8);
    expect(dx.slice(4)).toEqual([DYING_DX, DYING_DX]);
    expect(c.isAttacking(0)).toBe(false);            // round_end does not hang on a dead attacker
  });

  it('E13: a lethal hit during the hold or return never shows an earlier in-phase pose', () => {
    const order = ['hurt_in1', 'hurt_in2', 'hurt'];
    // from the hold: 30 frames of `hurt`, no shake
    const hold = new EnemyPoseController(1);
    hold.playHurt(0);
    run(hold, HURT_HOLD_START + 3);
    hold.freezeDying(0);
    expect(poses(hold, 0, 30)).toEqual(Array(30).fill('hurt'));
    expect(hold.state(0)).toEqual({ pose: 'hurt', dx: DYING_DX, dy: 0 });
    // from the return: each start frame keeps its pose or moves on (in1 -> in2 -> hurt), dx continuous within 3 px
    for (let t = HURT_HOLD_END; t < HURT_FRAMES; t++) {
      const c = new EnemyPoseController(1);
      c.playHurt(0);
      run(c, t);
      const before = c.state(0);
      c.freezeDying(0);
      const seq: { pose: string; dx: number }[] = [before];
      for (let k = 0; k < 30; k++) { seq.push(c.state(0)); c.update(1); }
      for (let k = 1; k < seq.length; k++) {
        expect(order.indexOf(seq[k].pose), `t ${t} k ${k}`).toBeGreaterThanOrEqual(order.indexOf(seq[k - 1].pose));
        expect(Math.abs(seq[k].dx - seq[k - 1].dx), `t ${t} k ${k}`).toBeLessThanOrEqual(3);
      }
      if (before.pose === 'hurt_in2') expect(new Set(seq.map((s) => s.pose))).toEqual(new Set(['hurt_in2', 'hurt']));
    }
  });

  it('E13 / E17: freezeDying twice does not restart', () => {
    const c = new EnemyPoseController(1);
    c.freezeDying(0);
    run(c, 3);
    const at = c.state(0);
    expect(at.pose).toBe('hurt_in2');
    c.freezeDying(0);
    expect(c.state(0)).toEqual(at);
    run(c, 1);
    expect(c.state(0).pose).toBe('hurt');
  });

  it('poses are per enemy', () => {
    const c = new EnemyPoseController(3);
    c.playAttack(1);
    c.playHurt(2);
    expect([c.state(0).pose, c.state(1).pose, c.state(2).pose]).toEqual(['idle', 'atk_wind1', 'hurt_in1']);
  });

  it('boss cast: gather, rise, held cast (the spell resolves at CAST_OUT), release, settle; no lunge', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { hasCast: true });
    c.playCast(0);
    expect(c.state(0)).toEqual({ pose: 'cast_gather', dx: 0, dy: 0 });
    expect(c.attackOutDone(0)).toBe(false);
    run(c, CAST_OUT - 1);
    expect(c.attackOutDone(0)).toBe(false);
    run(c, 1);
    expect(CAST_OUT).toBe(10);
    expect(c.attackOutDone(0)).toBe(true);
    expect(c.state(0)).toEqual({ pose: 'cast', dx: 0, dy: 0 });   // E15: planted
    c.playHurt(0);                                   // a hit never interrupts a cast
    expect(c.state(0).pose).toBe('cast');
    run(c, CAST_FRAMES - CAST_OUT - 1);
    expect(c.isAttacking(0)).toBe(true);
    run(c, 1);
    expect(c.state(0)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
    c.playHurt(0);                                   // after the cast, hits land normally
    expect(c.state(0).pose).toBe('hurt_in1');
  });

  it('non-boss cast (D4): attack frames with no lunge, resolving at the start of the held attack frame', () => {
    const c = new EnemyPoseController(1);
    c.playCast(0);
    const seen = new Set<string>();
    let resolved = -1;
    for (let t = 0; t < PLAIN_CAST_FRAMES; t++) {
      const st = c.state(0);
      seen.add(st.pose);
      expect(st.dx).toBe(0);
      if (resolved < 0 && c.attackOutDone(0)) resolved = t;
      c.update(1);
    }
    expect([...seen]).toEqual(['atk_wind1', 'atk_wind2', 'attack', 'atk_follow', 'atk_recover']);
    expect(resolved).toBe(11);
    expect(c.state(0).pose).toBe('idle');
  });

  it('idle breathes out of phase per enemy; dazed enemies sway daze / daze_b; stone ignores hits', () => {
    const c = new EnemyPoseController(2);
    run(c, 20);                                      // phase index * 17: enemy 1 is 17 frames ahead
    expect([c.state(0).pose, c.state(1).pose]).toEqual(['idle', 'idle_b']);
    run(c, 16);
    expect(c.state(0).pose).toBe('idle_b');
    c.setPosture(0, 'daze');
    expect(['daze', 'daze_b']).toContain(c.state(0).pose);
    c.playHurt(0);
    expect(c.state(0).pose).toBe('hurt_in1');        // asleep / stunned enemies still recoil
    c.setPosture(1, 'stone');
    c.playHurt(1);
    expect(c.state(1)).toEqual({ pose: 'idle', dx: 0, dy: 0 });
  });
});

import { describe, it, expect } from 'vitest';
import {
  ATTACK_CONTACT, ATTACK_FRAMES, BOSS_FRAMES, CAST_FRAMES, DYING_DX, DYING_IN, FRAME_SOURCE, HURT_FRAMES, HURT_HOLD_START,
  HURT_REHIT_AT, MONSTER_FRAMES, ORBIT_FRAMES, ORBIT_MAX, ORBIT_STEP_FRAMES, resolveFrame,
  PLAIN_CAST_FRAMES, attackAt, castAt, castOut, dyingAt, hurtAt, idleFrame, lungePx, trembleDx, type FrameAt, type MonsterFrame,
} from '../../../src/scenes/battle/enemyChoreography.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';

const frames = (fn: (t: number) => FrameAt, n: number): FrameAt[] => Array.from({ length: n }, (_, t) => fn(t));
const names = (fs: FrameAt[]): MonsterFrame[] => fs.map((f) => f.frame);
const runs = (fs: FrameAt[]): [MonsterFrame, number][] => {
  const out: [MonsterFrame, number][] = [];
  for (const f of fs) {
    if (out.length && out[out.length - 1][0] === f.frame) out[out.length - 1][1]++; else out.push([f.frame, 1]);
  }
  return out;
};
/** D2 formula (the build emits it per sheet as lungePx). */
const lungeFor = (w: number): number => Math.round(24 + 16 * Math.min(1, Math.max(0, (w - 55) / 130)));

describe('enemyChoreography (ENEMY_ANIM_PLAN 3.2)', () => {
  it('attack: 31 frames in six poses, contact on frame 14', () => {
    expect(ATTACK_FRAMES).toBe(31);
    expect(ATTACK_CONTACT).toBe(14);
    expect(runs(frames((t) => attackAt(t, 24), ATTACK_FRAMES))).toEqual([['atk_wind1', 5], ['atk_wind2', 6], ['atk_mid', 3],
      ['attack', 8], ['atk_follow', 4], ['atk_recover', 5]]);
    expect(attackAt(ATTACK_CONTACT, 24).frame).toBe('attack');
    expect(attackAt(ATTACK_CONTACT - 1, 24).frame).toBe('atk_mid');
  });

  it.each([[24, [-4, -6, 18, 24, 13.92]], [40, [-40 / 6, -10, 30, 40, 23.2]]])('attack offsets at L = %i', (L, [w1, w2, mid, hit, fo]) => {
    expect(attackAt(0, L).dx).toBe(0);
    expect(attackAt(5, L).dx).toBeCloseTo(w1);
    expect(attackAt(11, L).dx).toBeCloseTo(w2);
    expect(attackAt(14, L).dx).toBeCloseTo(mid);
    expect(attackAt(16, L).dx).toBeCloseTo(hit);
    expect(attackAt(21, L).dx).toBeCloseTo(hit);
    expect(attackAt(26, L).dx).toBeCloseTo(fo);
    expect(attackAt(ATTACK_FRAMES, L).dx).toBe(0);
    expect(frames((t) => attackAt(t, L), ATTACK_FRAMES).every((f) => f.dy === 0)).toBe(true);
  });

  it('hurt: 20 frames, two poses into and out of the recoil; -6 hold with a -+3 shake every 2 frames (E14: away first)', () => {
    expect(HURT_FRAMES).toBe(20);
    const fs = frames(hurtAt, HURT_FRAMES);
    expect(runs(fs)).toEqual([['hurt_in1', 2], ['hurt_in2', 2], ['hurt', 10], ['hurt_in2', 3], ['hurt_in1', 3]]);
    expect(fs.slice(4, 14).map((f) => f.dx)).toEqual([-9, -9, -3, -3, -9, -9, -3, -3, -9, -9]);
    expect(fs[2].dx).toBeCloseTo(-3);
    expect(hurtAt(HURT_FRAMES).dx).toBe(0);
  });

  it('dying: the in-phase, then hurt held at dx -6 with no shake; eases from the current offset', () => {
    expect(names(frames((t) => dyingAt(t, { dx: 0, dy: 0 }), 4))).toEqual(['hurt_in1', 'hurt_in1', 'hurt_in2', 'hurt_in2']);
    expect(dyingAt(2, { dx: 0, dy: 0 }).dx).toBeCloseTo(-3);
    for (const t of [4, 10, 29, 200]) expect(dyingAt(t, { dx: 30, dy: -6 })).toEqual({ frame: 'hurt', dx: DYING_DX, dy: 0 });
    const eased = frames((t) => dyingAt(t, { dx: 24, dy: 0 }), 5).map((f) => f.dx);
    expect(eased[0]).toBe(24);
    for (let k = 1; k < eased.length; k++) expect(eased[k]).toBeLessThan(eased[k - 1]);
  });

  it('boss cast: 30 frames, resolves at the start of the hold (10); planted (E15)', () => {
    expect(CAST_FRAMES).toBe(30);
    expect(castOut(true)).toBe(10);
    const fs = frames((t) => castAt(t, true), CAST_FRAMES);
    expect(runs(fs)).toEqual([['cast_gather', 6], ['cast_rise', 4], ['cast', 10], ['cast_release', 4], ['cast_rise', 3],
      ['cast_gather', 3]]);
    expect(fs[6].dy).toBe(0);
    expect(fs[10].dy).toBe(0);
  });

  it('non-boss cast (D4): the attack frames without mid, no lunge, resolving at 11', () => {
    expect(PLAIN_CAST_FRAMES).toBe(30);
    expect(castOut(false)).toBe(11);
    const fs = frames((t) => castAt(t, false), PLAIN_CAST_FRAMES);
    expect(runs(fs)).toEqual([['atk_wind1', 5], ['atk_wind2', 6], ['attack', 10], ['atk_follow', 4], ['atk_recover', 5]]);
    expect(fs[11].dy).toBe(0);
  });

  it('E15: casts never move the sprite (dx = dy = 0 on every frame, boss and plain), so the feet stay on the plain', () => {
    for (const hasCast of [true, false]) {
      for (const f of frames((t) => castAt(t, hasCast), 35)) expect(f, `${hasCast} ${f.frame}`).toMatchObject({ dx: 0, dy: 0 });
    }
  });

  it('E14: the first hold frame recoils further (away from the party) than the last in-phase frame', () => {
    const fs = frames(hurtAt, HURT_FRAMES);
    const lastIn = fs[HURT_HOLD_START - 1].dx;
    expect(fs[HURT_HOLD_START].dx).toBeLessThan(lastIn);
    // monotone away from the party into the hold: never a step back toward it before the first shake swing
    for (let t = 1; t <= HURT_HOLD_START; t++) expect(fs[t].dx).toBeLessThanOrEqual(fs[t - 1].dx);
  });

  it('E13: dyingAt with a start never shows an earlier in-phase pose and eases from the start', () => {
    for (let t = DYING_IN; t < DYING_IN + 30; t++) expect(dyingAt(t, { dx: -9, dy: 0 }, DYING_IN).frame).toBe('hurt');
    const ret = frames((t) => dyingAt(t + HURT_REHIT_AT, { dx: -5, dy: 0 }, HURT_REHIT_AT), 30);
    expect(new Set(names(ret))).toEqual(new Set(['hurt_in2', 'hurt']));
    expect(ret[0].dx).toBe(-5);
    for (let k = 1; k < ret.length; k++) expect(Math.abs(ret[k].dx - ret[k - 1].dx)).toBeLessThanOrEqual(3);
  });

  it('every frame name used is in MONSTER_FRAMES / BOSS_FRAMES, with a keyframe source', () => {
    const used = new Set<MonsterFrame>([...names(frames((t) => attackAt(t, 24), 40)), ...names(frames(hurtAt, 25)),
      ...names(frames((t) => castAt(t, false), 35)), ...names(frames((t) => dyingAt(t, { dx: 0, dy: 0 }), 10)), 'idle', 'idle_b']);
    for (const n of used) expect(MONSTER_FRAMES, n).toContain(n);
    for (const n of names(frames((t) => castAt(t, true), 35))) expect(BOSS_FRAMES, n).toContain(n);
    for (const n of BOSS_FRAMES) expect(['idle', 'attack', 'hurt', 'cast']).toContain(FRAME_SOURCE[n]);
    // F0 (pass F): + daze, daze_b for every sheet; + attack_raise and its four in-betweens for bosses; pass K: + 4 kneel;
    // EF-D: + the 2 x ORBIT_MAX orbit frames (own rects on an orbit sheet only)
    expect(MONSTER_FRAMES).toHaveLength(17 + 2 * ORBIT_MAX);
    expect(BOSS_FRAMES).toHaveLength(26 + 2 * ORBIT_MAX);
    for (const n of ORBIT_FRAMES) expect(MONSTER_FRAMES).toContain(n);
  });

  it('EF-D orbit: idle_o<k> / idle_b_o<k>, k one step every 6 frames over N steps, the breath unchanged', () => {
    expect(ORBIT_STEP_FRAMES).toBe(6);
    expect(ORBIT_FRAMES).toHaveLength(32);
    expect([0, 5, 6, 12, 90, 95, 96].map((c) => idleFrame(c, 0, true, 'none', 16)))
      .toEqual(['idle_o0', 'idle_o0', 'idle_o1', 'idle_o2', 'idle_o15', 'idle_o15', 'idle_o0']);
    expect(idleFrame(36, 0, true, 'none', 16)).toBe('idle_b_o6');
    expect(idleFrame(48, 0, true, 'none', 8)).toBe('idle_b_o0');
    expect(idleFrame(40, 0, false, 'none', 16)).toBe('idle_o6');           // no breath: the orbit still turns
    expect(idleFrame(40, 0, true, 'tremble', 16)).toBe('idle_b_o6');
    for (const p of ['stone', 'still'] as const) expect(idleFrame(40, 0, true, p, 16)).toBe('idle');
    expect(idleFrame(40, 0, true, 'none', 0)).toBe('idle_b');            // no orbit: unchanged
    // every orbit frame is cut from the idle; an atlas without them falls back to idle / idle_b
    for (const n of ORBIT_FRAMES) expect(FRAME_SOURCE[n]).toBe('idle');
    const has = (f: MonsterFrame): boolean => f === 'idle' || f === 'idle_b';
    expect(resolveFrame('idle_o3', has)).toBe('idle');
    expect(resolveFrame('idle_b_o3', has)).toBe('idle_b');
    expect(resolveFrame('idle_b_o3', (f) => f === 'idle')).toBe('idle');
  });

  it('EF-D orbit: the pose controller plays the orbit in idle (configured from the atlas), not in an attack', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { orbit: 16 });
    const seen: string[] = [];
    for (let t = 0; t < 96; t++) { seen.push(c.state(0).pose); c.update(1); }
    expect(new Set(seen).size).toBe(16);            // idle_o0-5, idle_b_o6-11 (frames 36-71), idle_o12-15
    expect(seen.every((p) => /^idle(_b)?_o\d+$/.test(p))).toBe(true);
    c.playAttack(0);
    expect(c.state(0).pose).toBe('atk_wind1');
    const plain = new EnemyPoseController(1);
    expect(plain.state(0).pose).toBe('idle');
  });

  it('lungePx: the D2 formula at w = 55, 93, 185 and beyond the clamps; 24 when the atlas has none', () => {
    expect([lungeFor(55), lungeFor(93), lungeFor(168), lungeFor(185), lungeFor(30), lungeFor(300)]).toEqual([24, 29, 38, 40, 24, 40]);
    expect(lungePx({ lungePx: 31 })).toBe(31);
    expect(lungePx({})).toBe(24);
    expect(lungePx(null)).toBe(24);
  });

  it('idle breathing: period 72, phase index * 17; idle when frozen or when the rig turns breathing off', () => {
    expect([0, 35, 36, 71, 72].map((c) => idleFrame(c, 0, true, 'none'))).toEqual(['idle', 'idle', 'idle_b', 'idle_b', 'idle']);
    expect(idleFrame(19, 1, true, 'none')).toBe('idle_b');
    expect(idleFrame(18, 1, true, 'none')).toBe('idle');
    expect(idleFrame(40, 0, true, 'stone')).toBe('idle');
    expect(idleFrame(40, 0, true, 'still')).toBe('idle');
    expect(idleFrame(40, 0, false, 'none')).toBe('idle');
    // pass K (D-K7): the daze sway is gone from the idle (a kneeler shows its KneelTrack); fear breathes as normal
    expect([0, 36].map((c) => idleFrame(c, 0, true, 'daze'))).toEqual(['idle', 'idle_b']);
    expect(idleFrame(36, 0, true, 'tremble')).toBe('idle_b');
    expect([0, 4, 8, 12, 16].map(trembleDx)).toEqual([0, 1, 0, -1, 0]);
  });

  it('at scaleFactor 0.5 every offset is an integer, rounded once from recoil + shake', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { scaleFactor: 0.5 });
    c.playHurt(0);
    const dx: number[] = [];
    for (let t = 0; t < HURT_FRAMES; t++) { dx.push(c.state(0).dx); c.update(1); }
    for (const v of dx) expect(Number.isInteger(v)).toBe(true);
    // the hold is round((-6 -+ 3) * 0.5): -4.5 -> -4, then -1.5 -> -1
    expect(dx.slice(4, 8)).toEqual([-4, -4, -1, -1]);
  });
});

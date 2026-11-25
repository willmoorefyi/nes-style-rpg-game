import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EnemyAnimPreview, LABEL_POS, PAUSE, parseEnemyAnim, schedule, turnPlan } from '../../../src/scenes/battle/enemyAnimPreview.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { ATTACK_FRAMES, CAST_FRAMES, EnemyPoseController, HURT_FRAMES } from '../../../src/scenes/battle/EnemyPoseController.js';

function target(count: number, boss = (_i: number) => false) {
  const poses = new EnemyPoseController(count);
  for (let i = 0; i < count; i++) poses.configure(i, { hasCast: boss(i) });
  return { poses, count, hasCast: boss, name: (i: number) => `E${i}` };
}

class Keys {
  listeners = new Set<(e: { key: string }) => void>();
  addEventListener(_t: 'keydown', fn: (e: { key: string }) => void) { this.listeners.add(fn); }
  removeEventListener(_t: 'keydown', fn: (e: { key: string }) => void) { this.listeners.delete(fn); }
  press(key: string) { for (const fn of this.listeners) fn({ key }); }
}

describe('enemy animation preview (dev ?enemyAnim=)', () => {
  it('parses loop / step and slow', () => {
    expect(parseEnemyAnim('?mute=1&enemyAnim=loop')).toEqual({ mode: 'loop', slow: 1 });
    expect(parseEnemyAnim('?enemyAnim=step&slow=4')).toEqual({ mode: 'step', slow: 4 });
    expect(parseEnemyAnim('?enemyAnim=bogus')).toBeNull();
    expect(parseEnemyAnim('')).toBeNull();
  });

  it('loop schedules attack, hurt and (bosses only) cast per enemy, the enemies taking turns to attack', () => {
    expect(schedule(false).events.map((e) => e[0])).toEqual(['attack', 'hurt']);
    expect(schedule(true).events).toEqual([['attack', 0], ['hurt', ATTACK_FRAMES + PAUSE],
      ['cast', ATTACK_FRAMES + PAUSE + HURT_FRAMES + PAUSE]]);
    expect(schedule(true).cycle).toBe(ATTACK_FRAMES + HURT_FRAMES + CAST_FRAMES + 3 * PAUSE);
    const t = target(2, (i) => i === 1);
    const p = new EnemyAnimPreview('loop', 1, t);
    const tick = (n: number) => { for (let k = 0; k < n; k++) { const d = p.frameDt(1); t.poses.update(d); } };
    tick(1);
    expect(t.poses.isLunging(0)).toBe(true);
    expect(t.poses.isLunging(1)).toBe(false);
    tick(ATTACK_FRAMES + PAUSE - 1);
    expect(t.poses.isLunging(1)).toBe(false);           // enemy 1 waits for enemy 0's attack and the pause
    tick(1);
    expect(t.poses.state(0).pose).toBe('hurt_in1');     // enemy 0's hurt (in place) plays during enemy 1's turn
    expect(t.poses.isLunging(0)).toBe(false);
    expect(t.poses.isLunging(1)).toBe(true);
    tick(ATTACK_FRAMES + PAUSE + HURT_FRAMES + PAUSE);
    expect(t.poses.isAttacking(1)).toBe(true);           // the boss casts
    expect(t.poses.state(1).pose).toMatch(/^cast_/);
  });

  it('EF-H follow-up: only one enemy lunges at a time, for mixed attack lengths, over two full cycles', () => {
    const plan = turnPlan([{ cycle: 120, attack: 65 }, { cycle: 90, attack: 31 }, { cycle: 200, attack: 47 }]);
    expect(plan.offsets).toEqual([0, 65 + PAUSE, 65 + 31 + 2 * PAUSE]);
    expect(plan.cycle).toBe(Math.max(65 + 31 + 47 + 3 * PAUSE, 200));
    const t = target(5);
    const travel = [600, 0, 300, 0, 450];                // melee travellers and in-place attackers mixed
    const play = (poses: EnemyPoseController, i: number) => (travel[i] ? poses.playAttack(i, { travel: travel[i], rise: 0 })
      : poses.playAttack(i));
    const lens = travel.map((_, i) => {                  // each attack's real length, as the view's attackLength reports
      const q = new EnemyPoseController(5);
      play(q, i);
      let n = 0;
      while (q.isAttacking(i)) { q.update(1); n++; }
      return n;
    });
    expect(new Set(lens).size).toBeGreaterThan(1);
    const p = new EnemyAnimPreview('loop', 1, { ...t, attack: (i: number) => play(t.poses, i), attackFrames: (i: number) => lens[i] });
    let most = 0;
    let seen = new Set<number>();
    for (let f = 0; f < 2 * (lens.reduce((a, b) => a + b, 0) + 5 * PAUSE) + 400; f++) {
      t.poses.update(p.frameDt(1));
      const lunging = [0, 1, 2, 3, 4].filter((i) => t.poses.isLunging(i));
      most = Math.max(most, lunging.length);
      seen = new Set([...seen, ...lunging]);
    }
    expect(most).toBe(1);
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('pass F item 3: the loop starts the view\'s attack (the travel) and spaces the hurt after its longer length', () => {
    const t = target(1);
    const attack = vi.fn((i: number) => t.poses.playAttack(i, { travel: 600, rise: 0 }));
    const len = 47 + 18;
    const p = new EnemyAnimPreview('loop', 1, { ...t, attack, attackFrames: () => len });
    expect(schedule(false, len).events).toEqual([['attack', 0], ['hurt', len + PAUSE]]);
    const tick = (n: number) => { for (let k = 0; k < n; k++) t.poses.update(p.frameDt(1)); };
    tick(1);
    expect(attack).toHaveBeenCalledWith(0);
    expect(t.poses.attackKind(0)).toBe('melee');
    tick(len + PAUSE);
    expect(t.poses.state(0).pose).toBe('hurt_in1');
  });

  it('slow=N divides dt', () => {
    const p = new EnemyAnimPreview('loop', 4, target(1));
    expect(p.frameDt(1)).toBe(0.25);
  });

  it('step freezes time and advances exactly one frame per key, back one with comma (replayed from 0)', () => {
    const keys = new Keys();
    const t = target(1);
    const p = new EnemyAnimPreview('step', 1, t, keys);
    expect(p.frameDt(1)).toBe(0);
    expect(t.poses.debug(0)).toEqual({ mode: 'attack', t: 0 });
    keys.press('.');
    expect(p.time).toBe(1);
    expect(t.poses.debug(0)).toEqual({ mode: 'attack', t: 1 });
    for (let k = 0; k < 13; k++) keys.press('.');
    expect(t.poses.state(0).pose).toBe('attack');
    keys.press(',');
    expect(p.time).toBe(13);
    expect(t.poses.state(0).pose).toBe('atk_mid');
    expect(p.labelText()).toBe('E0: atk_mid / 13');
  });

  it('E18: the step label sits below the message window (y 0 to BATTLE_MESSAGE_HEIGHT)', () => {
    expect(LABEL_POS.y).toBeGreaterThanOrEqual(BATTLE_MESSAGE_HEIGHT);
    const parent = new Container();
    const p = new EnemyAnimPreview('step', 1, target(1), new Keys());
    p.showLabel(parent);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].position).toMatchObject({ x: LABEL_POS.x, y: LABEL_POS.y });
    p.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('the keydown listener is removed on exit', () => {
    const keys = new Keys();
    const p = new EnemyAnimPreview('step', 1, target(1), keys);
    expect(keys.listeners.size).toBe(1);
    const spy = vi.spyOn(keys, 'removeEventListener');
    p.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(keys.listeners.size).toBe(0);
  });
});

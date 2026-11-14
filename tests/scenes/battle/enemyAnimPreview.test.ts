import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EnemyAnimPreview, LABEL_POS, PAUSE, STAGGER, parseEnemyAnim, schedule } from '../../../src/scenes/battle/enemyAnimPreview.js';
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

  it('loop schedules attack, hurt and (bosses only) cast per enemy, staggered 20 frames', () => {
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
    tick(STAGGER);
    expect(t.poses.isLunging(1)).toBe(true);
    tick(ATTACK_FRAMES + PAUSE - STAGGER);
    expect(t.poses.state(0).pose).toBe('hurt_in1');   // the hurt started one frame ago
    tick(HURT_FRAMES + PAUSE + STAGGER);
    expect(t.poses.isAttacking(1)).toBe(true);         // the boss casts
    expect(t.poses.state(1).pose).toMatch(/^cast_/);
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

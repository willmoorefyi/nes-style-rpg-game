/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 10): the dev-only scene-wide battle clock. */
import { describe, it, expect } from 'vitest';
import { BattleDevClock, parseDevClock } from '../../../src/scenes/battle/battleDevClock.js';

class Keys {
  listeners = new Set<(e: { key: string }) => void>();
  addEventListener(_t: 'keydown', fn: (e: { key: string }) => void) { this.listeners.add(fn); }
  removeEventListener(_t: 'keydown', fn: (e: { key: string }) => void) { this.listeners.delete(fn); }
  press(key: string) { for (const fn of this.listeners) fn({ key }); }
}

describe('battle dev clock', () => {
  it('parses ?battleStep=1, ?enemyAnim=step and &slow=N; nothing else gives a clock', () => {
    expect(parseDevClock('?mute=1&battleStep=1')).toEqual({ step: true, slow: 1 });
    expect(parseDevClock('?enemyAnim=step&slow=4')).toEqual({ step: true, slow: 4 });
    expect(parseDevClock('?enemyAnim=loop&slow=4')).toEqual({ step: false, slow: 4 });
    expect(parseDevClock('?enemyAnim=loop')).toBeNull();
    expect(parseDevClock('?battleStep=0&slow=0.5')).toBeNull();
    expect(parseDevClock('')).toBeNull();
  });

  it('step mode gives dt 0 until `.`, then exactly 1 per press', () => {
    const keys = new Keys();
    const clock = new BattleDevClock({ step: true, slow: 1 }, keys);
    expect(clock.stepping).toBe(true);
    expect(clock.frameDt(1)).toBe(0);
    expect(clock.frameDt(2.5)).toBe(0);
    keys.press('.');
    expect(clock.frameDt(1)).toBe(1);
    expect(clock.frameDt(1)).toBe(0);
    keys.press('.');
    keys.press('.');
    expect([clock.frameDt(1), clock.frameDt(1), clock.frameDt(1)]).toEqual([1, 1, 0]);
    keys.press('x');
    expect(clock.frameDt(1)).toBe(0);
  });

  it('slow=4 gives dt / 4', () => {
    const clock = new BattleDevClock({ step: false, slow: 4 });
    expect(clock.stepping).toBe(false);
    expect(clock.frameDt(1)).toBe(0.25);
    expect(clock.frameDt(2)).toBe(0.5);
  });

  it('dispose removes the key listener', () => {
    const keys = new Keys();
    const clock = new BattleDevClock({ step: true, slow: 1 }, keys);
    expect(keys.listeners.size).toBe(1);
    clock.dispose();
    expect(keys.listeners.size).toBe(0);
  });
});

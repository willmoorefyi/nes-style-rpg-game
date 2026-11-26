/**
 * Pass PT (docs/PLAYTEST_ART_PLAN.md 4.3, 6.4; the playtest of 2026-11-25: "the ship has no 'down' or 'up' poses"):
 * the airship's heading model drives the ship too: up shows its back view, down its front view, left / right the side
 * view (mirrored for left), with no turn frame; a sheet without the end views shows the side view for every heading.
 */
import { describe, it, expect } from 'vitest';
import {
  SIDE_RIGHT, TURN_MS, headingFrame, nextHeading, type AirshipHeading,
} from '../../src/scenes/exploration/airshipHeading.js';
import type { Direction } from '../../src/rendering/SpriteAnimation.js';

const SHIP = new Set(['ship', 'ship_back', 'ship_front']);
const has = (f: string): boolean => SHIP.has(f);
const start = (side: 'left' | 'right' = 'right'): AirshipHeading => ({ ...SIDE_RIGHT, side, seenDir: side, seenMoving: false });
const take = (h: AirshipHeading, dir: Direction, t = 0): AirshipHeading => nextHeading(h, dir, false, t);

describe('ship heading (pass PT)', () => {
  for (const side of ['left', 'right'] as const) {
    it(`leaning ${side}: up the back view, down the front view, the side view on left / right`, () => {
      const base = start(side);
      expect(headingFrame(take(base, 'up'), 0, has, 'ship')).toEqual({ frame: 'ship_back', flip: side === 'left', turning: false });
      expect(headingFrame(take(base, 'down'), 0, has, 'ship')).toEqual({ frame: 'ship_front', flip: side === 'left', turning: false });
      const up = take(base, 'up');
      expect(headingFrame(take(up, 'right', 1), 1, has, 'ship')).toEqual({ frame: 'ship', flip: false, turning: false });
      expect(headingFrame(take(up, 'left', 1), 1, has, 'ship')).toEqual({ frame: 'ship', flip: true, turning: false });
    });
  }

  it('has no turn frame: a side -> end change is instant (no ship_*_turn is ever asked for)', () => {
    const asked: string[] = [];
    const h = take(start('right'), 'up', 500);
    const pick = headingFrame(h, 500, (f) => { asked.push(f); return has(f); }, 'ship');
    expect(pick).toEqual({ frame: 'ship_back', flip: false, turning: false });
    expect(asked).toContain('ship_back_turn');                    // looked for, absent: falls through at once
    expect(headingFrame(h, 500 + TURN_MS - 1, has, 'ship').frame).toBe('ship_back');
  });

  it('a sheet without the end views shows the side view for every heading', () => {
    const none = (f: string): boolean => f === 'ship';
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      expect(headingFrame(take(start('right'), d), 0, none, 'ship').frame, d).toBe('ship');
    }
  });

  it('the airship keeps its own frames (the default base)', () => {
    const all = (): boolean => true;
    expect(headingFrame(take(start('right'), 'up'), TURN_MS, all).frame).toBe('airship_back');
  });
});

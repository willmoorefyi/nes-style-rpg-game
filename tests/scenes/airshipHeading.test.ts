/**
 * The airship's heading model (docs/AIRSHIP_VIEWS_PLAN.md 3): the direction -> frame table, the turn in-between, the
 * instant flips and swaps, D-AV10's boarding rule, and the fallback for a sheet without the new frames.
 */
import { describe, it, expect } from 'vitest';
import {
  SIDE_RIGHT, TURN_MS, boardHeading, headingFrame, nextHeading, type AirshipHeading,
} from '../../src/scenes/exploration/airshipHeading.js';
import type { Direction } from '../../src/rendering/SpriteAnimation.js';

const ALL = (): boolean => true;
const NONE = (): boolean => false;
const start = (side: 'left' | 'right' = 'right', dir: Direction = side): AirshipHeading =>
  ({ ...SIDE_RIGHT, side, seenDir: dir, seenMoving: false });
/** Take `dir` at `t` and long after the turn: the settled frame. */
const settled = (h: AirshipHeading, dir: Direction, t = 0) => {
  const n = nextHeading(h, dir, false, t);
  return { h: n, ...headingFrame(n, t + TURN_MS, ALL) };
};

describe('airship heading: the mapping (4 directions x 2 sides)', () => {
  for (const side of ['left', 'right'] as const) {
    it(`leaning ${side}`, () => {
      const base = start(side, side);
      expect(settled(base, 'up')).toMatchObject({ frame: 'airship_back', flip: side === 'left', turning: false });
      expect(settled(base, 'down')).toMatchObject({ frame: 'airship_front', flip: side === 'left' });
      const fromUp = settled(base, 'up').h;
      expect(settled(fromUp, 'right')).toMatchObject({ frame: 'airship', flip: false });
      expect(settled(fromUp, 'left')).toMatchObject({ frame: 'airship', flip: true });
    });
  }
});

describe('airship heading: transitions (D-AV5)', () => {
  it('side -> back with the same lean shows the turn frame for [0, TURN_MS), then the target', () => {
    const h = nextHeading(start('right', 'right'), 'up', false, 500);
    expect(h).toMatchObject({ end: 'back', side: 'right', turnFrom: 'side', turnAt: 500 });
    expect(headingFrame(h, 500, ALL)).toEqual({ frame: 'airship_back_turn', flip: false, turning: true });
    expect(headingFrame(h, 500 + TURN_MS - 1, ALL).frame).toBe('airship_back_turn');
    expect(headingFrame(h, 500 + TURN_MS, ALL)).toEqual({ frame: 'airship_back', flip: false, turning: false });
    const back = nextHeading(h, 'right', false, 1000);              // back -> side: the same turn frame
    expect(back).toMatchObject({ end: 'side', turnFrom: 'back', turnAt: 1000 });
    expect(headingFrame(back, 1050, ALL).frame).toBe('airship_back_turn');
    expect(headingFrame(back, 1100, ALL).frame).toBe('airship');
    const front = nextHeading(start('left', 'left'), 'down', false, 0);
    expect(headingFrame(front, 10, ALL)).toEqual({ frame: 'airship_front_turn', flip: true, turning: true });
  });

  it('left / right flips and back / front swaps are instant', () => {
    const flip = nextHeading(start('right', 'right'), 'left', false, 10);
    expect(flip).toMatchObject({ end: 'side', side: 'left', turnFrom: null });
    expect(headingFrame(flip, 10, ALL)).toEqual({ frame: 'airship', flip: true, turning: false });
    const up = settled(start(), 'up').h;
    const down = nextHeading(up, 'down', false, 50);
    expect(down.turnFrom).toBeNull();
    expect(headingFrame(down, 50, ALL).frame).toBe('airship_front');
    const leanFlip = nextHeading(down, 'left', false, 60);          // front leaning right -> side left: a flip
    expect(leanFlip.turnFrom).toBeNull();
  });

  it('a direction already taken changes nothing and keeps turnAt', () => {
    const h = nextHeading(start(), 'up', false, 100);
    expect(nextHeading(h, 'up', false, 150)).toBe(h);
    const moving = nextHeading(h, 'up', true, 160);                 // a step starts: taken again, but nothing new
    expect(moving).toMatchObject({ end: 'back', turnAt: 100, seenMoving: true });
  });
});

describe('airship heading: boarding and steps (D-AV10)', () => {
  it('boardHeading keeps the parked heading for any hero direction', () => {
    const parked = settled(start('left', 'left'), 'down').h;
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      const b = boardHeading(parked, d, false);
      expect(b).toMatchObject({ end: 'front', side: 'left', seenDir: d, seenMoving: false });
    }
    expect(boardHeading(null, 'up', false)).toMatchObject({ end: 'side', side: 'right', turnFrom: null });
  });

  it('the same direction with no step changes nothing; a step start in it takes it; a changed direction takes it', () => {
    const b = boardHeading(null, 'up', false);
    const idle = nextHeading(b, 'up', false, 10);
    expect(idle).toBe(b);
    const stepping = nextHeading(b, 'up', true, 20);
    expect(stepping).toMatchObject({ end: 'back', turnFrom: 'side', turnAt: 20 });
    expect(nextHeading(boardHeading(null, 'up', false), 'down', false, 30).end).toBe('front');
  });
});

describe('airship heading: missing frames fall back', () => {
  it('no end or turn frames: b_7 with the heading\'s flip', () => {
    const h = nextHeading(start('left', 'left'), 'up', false, 0);
    expect(headingFrame(h, 0, NONE)).toEqual({ frame: 'airship', flip: true, turning: false });
    expect(headingFrame(h, TURN_MS, NONE)).toEqual({ frame: 'airship', flip: true, turning: false });
  });

  it('no turn frames: an instant swap', () => {
    const h = nextHeading(start(), 'up', false, 0);
    expect(headingFrame(h, 0, (f) => !f.endsWith('_turn'))).toEqual({ frame: 'airship_back', flip: false, turning: false });
  });
});

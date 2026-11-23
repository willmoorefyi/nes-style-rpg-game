/** WR (docs/WORLD_WRAP_PLAN.md 3, 10): the pure wrap maths, flat and wrapped. */
import { describe, it, expect } from 'vitest';
import {
  canonCell, canonOf, cellIndex, isStep, mod, nearestImage, stepIndex, stepTo, torusHypot, torusManhattan, wrapDelta,
  wraps,
} from '../../src/systems/worldWrap.js';

const flat = { width: 16, height: 12 };
const torus = { width: 16, height: 12, wrap: true };

describe('worldWrap: arithmetic', () => {
  it('mod is always in [0, n)', () => {
    expect([mod(-1, 16), mod(16, 16), mod(-17, 16), mod(5, 16), mod(0, 16)]).toEqual([15, 0, 15, 5, 0]);
  });

  it('wrapDelta is the signed shortest difference, the tie at n / 2 giving -n / 2; flat gives b - a', () => {
    expect(wrapDelta(255, 0, 256)).toBe(1);
    expect(wrapDelta(0, 255, 256)).toBe(-1);
    expect(wrapDelta(0, 128, 256)).toBe(-128);
    expect(wrapDelta(10, 20, 256)).toBe(10);
    expect(wrapDelta(255, 0, 0)).toBe(-255);
  });

  it('nearestImage picks the period copy nearest the centre (0: none)', () => {
    expect(nearestImage(3, 254, 256)).toBe(259);
    expect(nearestImage(250, 2, 256)).toBe(-6);
    expect(nearestImage(100, 110, 256)).toBe(100);
    expect(nearestImage(250, 2, 0)).toBe(250);
  });

  it('wraps reads the flag', () => {
    expect(wraps(torus)).toBe(true);
    expect(wraps({})).toBe(false);
    expect(wraps({ wrap: false })).toBe(false);
  });
});

describe('worldWrap: cells', () => {
  it('canonCell / canonOf: wrapped cells fold, flat ones off the map are null', () => {
    expect(canonCell(torus, -1, 12)).toEqual({ x: 15, y: 0 });
    expect(canonCell(flat, -1, 3)).toBeNull();
    expect(canonCell(flat, 3, 4)).toEqual({ x: 3, y: 4 });
    const c = { x: 2, y: 3 };
    expect(canonOf(torus, c)).toBe(c);
    expect(canonOf(torus, { x: 16, y: -1 })).toEqual({ x: 0, y: 11 });
    expect(canonOf(flat, { x: 16, y: 0 })).toBeNull();
  });

  it('cellIndex, stepTo and stepIndex agree, flat and wrapped', () => {
    expect(cellIndex(torus, 16, 0)).toBe(0);
    expect(cellIndex(flat, 16, 0)).toBe(-1);
    expect(stepTo(torus, { x: 15, y: 5 }, 1, 0)).toEqual({ x: 0, y: 5 });
    expect(stepTo(flat, { x: 15, y: 5 }, 1, 0)).toBeNull();
    expect(stepIndex(torus, 15, 5, 1, 0)).toBe(5 * 16);
    expect(stepIndex(torus, 0, 0, 0, -1)).toBe(11 * 16);
    expect(stepIndex(flat, 0, 0, 0, -1)).toBe(-1);
    expect(stepIndex(flat, 3, 4, 1, 0)).toBe(4 * 16 + 4);
  });

  it('isStep crosses both seams wrapped and refuses them flat', () => {
    expect(isStep(torus, { x: 15, y: 3 }, { x: 0, y: 3 })).toBe(true);
    expect(isStep(torus, { x: 4, y: 0 }, { x: 4, y: 11 })).toBe(true);
    expect(isStep(torus, { x: 15, y: 0 }, { x: 0, y: 11 })).toBe(false);
    expect(isStep(flat, { x: 15, y: 3 }, { x: 0, y: 3 })).toBe(false);
    expect(isStep(flat, { x: 4, y: 3 }, { x: 5, y: 3 })).toBe(true);
  });

  it('torusManhattan and torusHypot take the short way round; flat is planar', () => {
    expect(torusManhattan(torus, { x: 0, y: 0 }, { x: 15, y: 11 })).toBe(2);
    expect(torusManhattan(flat, { x: 0, y: 0 }, { x: 15, y: 11 })).toBe(26);
    expect(torusHypot(torus, { x: 1, y: 0 }, { x: 14, y: 0 })).toBe(3);
  });

  it('a step then its opposite returns home, over 10,000 seeded cells', () => {
    let s = 1987;
    const rnd = (n: number): number => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (let i = 0; i < 10_000; i++) {
      const c = { x: rnd(16), y: rnd(12) };
      const [dx, dy] = dirs[rnd(4)];
      const n = stepTo(torus, c, dx, dy)!;
      expect(isStep(torus, c, n)).toBe(true);
      expect(stepTo(torus, n, -dx, -dy)).toEqual(c);
      expect(stepIndex(torus, c.x, c.y, dx, dy)).toBe(n.y * 16 + n.x);
    }
  });
});

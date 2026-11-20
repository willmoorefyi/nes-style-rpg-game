/** The Mode 7 projection (docs/MODE7_PLAN.md 2.4, 9): pure maths, no PixiJS. */
import { describe, expect, it } from 'vitest';
import {
  D_SPLIT, D_SPLIT_LOW, FLIGHT, SCREEN_H, SCREEN_W, cellToScreen, cyForHorizon, depthAt, fillStrips, forwardAt,
  horizonRow, rowTable, screenToCell, splitRow, type ViewParams,
} from '../../../src/scenes/exploration/mode7/mode7Math.js';

const deg = (d: number): number => (d * Math.PI) / 180;
const at = (over: Partial<ViewParams>): ViewParams => ({ ...FLIGHT, px: 75.5, py: 32.5, ...over });

describe('mode7Math', () => {
  for (const kappa of [0, 1 / 600, 1 / 300]) {
    for (const theta of [90, 45, 18]) {
      it(`cellToScreen(screenToCell(p)) round-trips within 0.01 px (kappa ${kappa.toFixed(4)}, theta ${theta})`, () => {
        const p = at({ kappa, theta: deg(theta), back: theta === 90 ? 0 : FLIGHT.back });
        const top = horizonRow(p) + 1;
        let checked = 0;
        for (let i = 0; i < 50; i++) {
          for (let j = 0; j < 50; j++) {
            const sx = (i + 0.5) * (SCREEN_W / 50);
            const sy = top + (j + 0.5) * ((SCREEN_H - top) / 50);
            const cell = screenToCell(p, sx, sy);
            if (!cell) continue;
            const back = cellToScreen(p, cell.x, cell.y);
            expect(back).not.toBeNull();
            expect(Math.abs((back?.x ?? 0) - sx)).toBeLessThan(0.01);
            expect(Math.abs((back?.y ?? 0) - sy)).toBeLessThan(0.01);
            checked++;
          }
        }
        expect(checked).toBe(2500);
      });
    }
  }

  it('at theta 90 every row hits the ground, and the rows below cy map south of C', () => {
    for (const kappa of [0, 1 / 600]) {
      const p = at({ theta: deg(90), kappa, back: 0, h: 12.5 });
      const t = rowTable(p);
      expect(t.firstRow).toBe(0);
      for (let e = 0; e <= SCREEN_H; e++) expect(Number.isNaN(t.s[e])).toBe(false);
      for (let y = Math.ceil(p.cy) + 1; y < SCREEN_H; y++) {
        expect(screenToCell(p, 960, y + 0.5)?.y ?? 0).toBeGreaterThan(p.py + p.back);
      }
    }
  });

  it('the forward distance d decreases strictly from the horizon to the bottom', () => {
    const p = at({});
    const t = rowTable(p);
    for (let e = t.firstRow + 1; e <= SCREEN_H; e++) expect(t.d[e]).toBeLessThan(t.d[e - 1]);
  });

  it('a row that misses the ground is collapsed to zero height, and a ground row is one px tall', () => {
    const p = at({});
    const t = rowTable(p);
    const pos = new Float32Array(SCREEN_H * 8);
    const uv = new Float32Array(SCREEN_H * 8);
    fillStrips(p, t, 0, SCREEN_H, 192, 192, pos, uv);
    const height = (r: number): number => pos[r * 8 + 5] - pos[r * 8 + 1];
    expect(t.firstRow).toBe(390);
    expect(height(100)).toBe(0);
    expect(height(t.firstRow - 1)).toBe(0);
    expect(uv.subarray(100 * 8, 101 * 8).every((v) => v === 0)).toBe(true);
    expect(height(t.firstRow)).toBe(1);
    expect(height(SCREEN_H - 1)).toBe(1);
    // the strip's ends lie (cx / f) s and ((1920 - cx) / f) s cells either side of P
    const r = 820;
    expect(uv[r * 8] * 192).toBeCloseTo(p.px - (p.cx * t.s[r]) / p.f, 4);
    expect(uv[r * 8 + 2] * 192).toBeCloseTo(p.px + ((SCREEN_W - p.cx) * t.s[r]) / p.f, 4);
    expect(uv[r * 8 + 1] * 192).toBeCloseTo(p.py + p.back - t.d[r], 4);
  });

  it('with kappa 0 the depth is h / b', () => {
    const p = at({ kappa: 0 });
    for (const y of [300.5, 500.5, 820.5, 1079.5]) {
      const v = (y - p.cy) / p.f;
      expect(depthAt(p, y)).toBeCloseTo(p.h / (Math.sin(p.theta) + v * Math.cos(p.theta)), 10);
    }
  });

  it('the split rows sit at D_SPLIT and D_SPLIT_LOW (rows 530 and 668 at the flight values)', () => {
    const p = at({});
    const far = splitRow(p, D_SPLIT);
    const low = splitRow(p, D_SPLIT_LOW);
    expect(Math.abs(far - 530)).toBeLessThanOrEqual(2);
    expect(Math.abs(low - 668)).toBeLessThanOrEqual(2);
    expect(forwardAt(p, far + 0.5, depthAt(p, far + 0.5))).toBeLessThan(D_SPLIT);
    expect(forwardAt(p, far - 0.5, depthAt(p, far - 0.5))).toBeGreaterThanOrEqual(D_SPLIT);
  });

  it('the flight values give 95 +- 2 px per cell at row 820, where the ship stands', () => {
    const p = at({});
    expect(Math.abs(p.f / depthAt(p, 820.5) - 95)).toBeLessThanOrEqual(2);
    const ship = cellToScreen(p, p.px, p.py);
    expect(Math.abs((ship?.y ?? 0) - 820)).toBeLessThanOrEqual(2);
    expect(ship?.x).toBeCloseTo(960, 6);
  });

  it('cyForHorizon puts the first ground row exactly on the asked row', () => {
    for (const row of [300, 390, 450]) {
      const p = at({});
      expect(horizonRow({ ...p, cy: cyForHorizon(p, row) })).toBe(row);
    }
  });
});

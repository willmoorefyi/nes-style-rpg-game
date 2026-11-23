/**
 * WR (docs/WORLD_WRAP_PLAN.md 7, 10): Mode 7 on a wrapped world, pure parts. The strips' UVs are continuous across a
 * step's end (REPEAT wraps them); the near window keeps its rect when the hero normalises (only its image origin
 * moves by W); a wrapped map has no open side and no off-map row; billboards and clouds read across the seam; the
 * farthest ground row is narrower than half the world (no double images); `cellMarker` is the old inline corners.
 */
import { describe, expect, it } from 'vitest';
import {
  FLIGHT, cellMarker, cellToScreen, fillStrips, rowFits, rowOffMap, rowTable, SCREEN_H, SCREEN_W,
} from '../../../src/scenes/exploration/mode7/mode7Math.js';
import { NEAR_FULL, NEAR_LOW, nearWindow } from '../../../src/scenes/exploration/mode7/FlightStream.js';
import { FLIGHT_VIEW } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { placeProp, type PropSource } from '../../../src/scenes/exploration/mode7/propMath.js';
import { CLOUDS, cloudPlace } from '../../../src/scenes/exploration/mode7/cloudMath.js';
import { wrapDelta } from '../../../src/systems/worldWrap.js';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';

const W = 256;
const map = { width: W, height: W, wrap: true, art: { tile: 48, chunk: 16, below: [], above: [] } };
const frac = (v: number): number => v - Math.floor(v);

describe('WR: Mode 7 across the seam', () => {
  it('fillStrips: the far UVs before and after a step end differ by whole periods (REPEAT draws the same ground)', () => {
    const at = (px: number): Float32Array => {
      const v = { ...FLIGHT_VIEW, px, py: 100.5 };
      const uvs = new Float32Array(SCREEN_H * 8);
      fillStrips(v, rowTable(v), 0, SCREEN_H, W, W, new Float32Array(SCREEN_H * 8), uvs);
      return uvs;
    };
    const a = at(256.5);   // the drawn step's end, unwrapped
    const b = at(0.5);     // normalised
    let checked = 0;
    for (let i = 0; i < a.length; i += 2) {
      if (a[i] === 0 && b[i] === 0) continue;
      expect(a[i] - b[i]).toBeCloseTo(1, 4);
      expect(frac(a[i] + 10)).toBeCloseTo(frac(b[i] + 10), 4);
      expect(a[i + 1]).toBeCloseTo(b[i + 1], 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('nearWindow: the same canonical rect at the unwrapped P 256.2 and the normalised 0.2, the image origin moved by W', () => {
    expect(nearWindow(map, NEAR_FULL, 255.9, 100.5).rect).toEqual(nearWindow(map, NEAR_FULL, 0.0, 100.5).rect);
    for (const prof of [NEAR_FULL, NEAR_LOW]) {
      const before = nearWindow(map, prof, 256.2, 100.5);
      const after = nearWindow(map, prof, 256.2 - W, 100.5);
      expect(after.rect).toEqual(before.rect);
      expect(after.ix0).toBe(before.ix0 - W);
      expect([before.x0, after.x0]).toEqual([before.rect.c0 * 16, after.rect.c0 * 16]);
      // P lies inside the image square both times, at least the margin from its edges
      for (const [w, px] of [[before, 256.2], [after, 0.2]] as const) {
        expect(px - w.ix0).toBeGreaterThanOrEqual(((prof.n - 1) * 16) / 2 - 1);
        expect(w.ix0 + w.cells - px).toBeGreaterThanOrEqual(((prof.n - 1) * 16) / 2);
      }
    }
  });

  it('rowFits has no open sides and rowOffMap is never true on a wrapped map', () => {
    const v = { ...FLIGHT_VIEW, px: 0.5, py: 0.5 };
    const t = rowTable(v);
    const flat = { w: W, h: W };
    const torus = { w: W, h: W, wrap: true };
    const r = SCREEN_H - 1;
    // the near square ending at the map's west edge: open on a flat map, closed on the torus
    expect(rowFits(v, t, r, 0, 0, 64, SCREEN_W, flat)).toBe(true);
    expect(rowFits(v, t, r, 0, 0, 64, SCREEN_W, torus)).toBe(false);
    expect(rowFits(v, t, r, -32, -32, 64, SCREEN_W, torus)).toBe(true);
    const north = { ...FLIGHT_VIEW, px: 100.5, py: 0.5 };
    const tn = rowTable(north);
    const offRow = tn.firstRow + 1;   // the far rows look past y 0
    expect(rowOffMap(north, tn, offRow, flat)).toBe(true);
    expect(rowOffMap(north, tn, offRow, torus)).toBe(false);
  });

  it('placeProp: a prop at x 3 seen from P 254 stands at its image; a sprite pre-shifted by -W tiles gives the same', () => {
    const view = { ...FLIGHT_VIEW, px: 254.5, py: 100.5 };
    const sprite = (x: number) => ({ texture: { frame: { width: 48, height: 48 } }, anchor: { x: 0.5, y: 1 },
      scale: { x: 1, y: 1 }, x, y: 95 * TILE_SIZE, tint: 0xffffff, visible: true });
    const src = (x: number): PropSource => ({ sprite: sprite(x) as unknown as PropSource['sprite'], gx: x / TILE_SIZE, gy: 95 });
    const wrap = { w: W, h: W };
    const at = placeProp(view, src(3.5 * TILE_SIZE), -Infinity, undefined, wrap)!;
    const shifted = placeProp(view, src((3.5 + W) * TILE_SIZE), -Infinity, undefined, wrap)!;
    expect(at).not.toBeNull();
    expect(at.x).toBeCloseTo(shifted.x, 6);
    expect(at.dist).toBeCloseTo(Math.hypot(5, 5.5), 6);
    expect(placeProp(view, src(3.5 * TILE_SIZE))).toBeNull();   // flat: 251 cells away, culled
    const ground = cellToScreen(view, 259.5, 95)!;
    expect(at.x).toBeCloseTo(ground.x, 6);
  });

  it('the cloud odometer: a seam step moves the clouds by one cell of parallax, not by W', () => {
    let odo = 0;
    let last = 255.8;
    odo = last;
    const xs: number[] = [];
    for (const px of [255.8, 255.9, 0.0, 0.1]) {
      odo += wrapDelta(last, px, W);
      last = px;
      xs.push(cloudPlace(CLOUDS[0], 0, odo, 500).x);
    }
    for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i] - xs[i - 1])).toBeLessThanOrEqual(CLOUDS[0].parallax);
  });

  it('no double images: the farthest ground row spans under W / 2 and lies under W / 2 ahead', () => {
    const v = { ...FLIGHT, px: 0, py: 0 };
    const t = rowTable(v);
    const r = t.firstRow;
    const s = Math.max(t.s[r], t.s[r + 1]);
    const span = (SCREEN_W * s) / v.f;
    const ahead = Math.max(t.d[r], t.d[r + 1]) - v.back;
    expect(span).toBeLessThan(W / 2);
    expect(ahead).toBeLessThan(W / 2);
    expect(span).toBeGreaterThan(100);
  });

  it('cellMarker gives the four corners as the inline code did', () => {
    const view = { ...FLIGHT_VIEW, px: 100.5, py: 100.5 };
    const here = { x: 100, y: 100 };
    const corner = (x: number, y: number) => { const p = cellToScreen(view, x, y); return { x: p?.x ?? 0, y: p?.y ?? 0 }; };
    expect(cellMarker(view, here)).toEqual([corner(100, 100), corner(101, 100), corner(101, 101), corner(100, 101)]);
  });
});

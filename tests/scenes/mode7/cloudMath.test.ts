/**
 * M7-5's clouds (docs/MODE7_PLAN.md 5; Q8: sky clouds only): 3 to 5 code-drawn bitmaps in 15-bit colours with binary
 * alpha, lit from the top left, sitting in the sky band over the horizon (so they ride down with it during a tilt and
 * none shows looking straight down), drifting slowly and sliding against the ship's sideways motion.
 */
import { describe, expect, it } from 'vitest';
import {
  CLOUDS, CLOUD_TONES, cloudInside, cloudPlace, cloudTexels, cloudTone,
} from '../../../src/scenes/exploration/mode7/cloudMath.js';
import { FLIGHT_VIEW } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { SCREEN_W, horizonRow } from '../../../src/scenes/exploration/mode7/mode7Math.js';

const e5 = (v: number): number => (v << 3) | (v >> 2);
const HORIZON = horizonRow(FLIGHT_VIEW);

describe('M7-5: the clouds', () => {
  it('there are 3 to 5, each fully inside the sky band at the flight horizon', () => {
    expect(CLOUDS.length).toBeGreaterThanOrEqual(3);
    expect(CLOUDS.length).toBeLessThanOrEqual(5);
    expect(HORIZON).toBe(390);
    for (const c of CLOUDS) {
      const at = cloudPlace(c, 0, 0, HORIZON);
      expect(at.visible).toBe(true);
      expect(at.y - c.h * c.scale).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThan(HORIZON);
      expect(Number.isInteger(c.scale)).toBe(true);
    }
  });

  it('the lower (farther) a cloud, the smaller and the slower', () => {
    const byHeight = [...CLOUDS].sort((a, b) => b.above - a.above);
    for (let i = 1; i < byHeight.length; i++) {
      expect(byHeight[i].scale).toBeLessThanOrEqual(byHeight[i - 1].scale);
      expect(byHeight[i].speed).toBeLessThan(byHeight[i - 1].speed);
      expect(byHeight[i].parallax).toBeLessThan(byHeight[i - 1].parallax);
    }
  });

  it('every texel is transparent or an opaque 15-bit tone of the ramp', () => {
    const tones = new Set(CLOUD_TONES.map((t) => `${e5(t[0])},${e5(t[1])},${e5(t[2])}`));
    for (const c of CLOUDS) {
      const px = cloudTexels(c);
      let opaque = 0;
      for (let i = 0; i < px.length; i += 4) {
        expect([0, 255]).toContain(px[i + 3]);
        if (px[i + 3] === 0) { expect([px[i], px[i + 1], px[i + 2]]).toEqual([0, 0, 0]); continue; }
        opaque++;
        expect(tones.has(`${px[i]},${px[i + 1]},${px[i + 2]}`)).toBe(true);
      }
      expect(opaque).toBeGreaterThan(c.w * c.h * 0.3);
    }
  });

  it('lit from the top left: the top rim is the light tone, the base row the darkest', () => {
    for (const c of CLOUDS) {
      for (let x = 0; x < c.w; x++) {
        const top = Array.from({ length: c.h }, (_, y) => y).find((y) => cloudInside(c, x, y));
        if (top !== undefined && top < c.base) expect(cloudTone(c, x, top)).toBe(0);
        if (cloudInside(c, x, c.base)) expect(cloudTone(c, x, c.base)).toBe(3);
      }
      // the shading is not all rim: a body exists
      let body = 0;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (cloudInside(c, x, y) && cloudTone(c, x, y) === 1) body++;
      expect(body).toBeGreaterThan(0);
    }
  });

  it('drifts east over time, slides west as the ship flies east, and wraps over the screen', () => {
    const c = CLOUDS[0];
    const w = c.w * c.scale;
    const a = cloudPlace(c, 0, 0, HORIZON);
    expect(cloudPlace(c, 1000, 0, HORIZON).x - a.x).toBe(Math.round(c.speed));
    expect(cloudPlace(c, 0, 10, HORIZON).x).toBe(a.x - 10 * c.parallax);
    for (let t = 0; t < 600_000; t += 7_919) {
      const p = cloudPlace(c, t, t / 97, HORIZON);
      expect(p.x).toBeGreaterThanOrEqual(-w);
      expect(p.x).toBeLessThanOrEqual(SCREEN_W);
    }
  });

  it('rides the horizon: none shows looking straight down, and they come down with it', () => {
    for (const c of CLOUDS) {
      expect(cloudPlace(c, 0, 0, -Infinity).visible).toBe(false);
      expect(cloudPlace(c, 0, 0, c.above - 5).visible).toBe(false);   // still above the screen's top
      expect(cloudPlace(c, 0, 0, 300).y).toBe(300 - c.above);
    }
  });
});

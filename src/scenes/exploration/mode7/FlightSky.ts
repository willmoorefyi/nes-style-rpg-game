/**
 * The Mode 7 sky (docs/MODE7_PLAN.md 5): a code-drawn vertical gradient behind the ground meshes, from the zenith
 * blue down to the haze at the horizon. Every band is one 15-bit colour (5 bits per channel, as `snes_palette.py`
 * defines colours), so the gradient steps like a SNES HDMA sky. The fog (2.5) and the clouds come in later tranches.
 */
import { Graphics } from 'pixi.js';
import { SCREEN_W } from './mode7Math.js';

type C15 = readonly [number, number, number];

/** The zenith and the horizon haze, 5-bit channels (the light end of `snes_palette.WATER`, paler toward the haze). */
export const SKY_ZENITH: C15 = [6, 14, 27];
export const SKY_HAZE: C15 = [24, 28, 31];

/** A 5-bit channel triple as 0xRRGGBB, expanded like `snes_palette.c15`. */
export function rgb15(c: C15): number {
  const e = (v: number): number => (v << 3) | (v >> 2);
  return (e(c[0]) << 16) | (e(c[1]) << 8) | e(c[2]);
}

/** The sky bands from row 0 to `horizon`: each run of rows that rounds to one 15-bit colour. */
export function skyBands(horizon: number): { y: number; h: number; color: number }[] {
  const bands: { y: number; h: number; color: number }[] = [];
  const rows = Math.max(1, Math.ceil(horizon));
  for (let y = 0; y < rows; y++) {
    const t = rows === 1 ? 1 : (y / (rows - 1)) ** 1.6;   // most of the change near the horizon
    const mix = (i: 0 | 1 | 2): number => Math.round(SKY_ZENITH[i] + (SKY_HAZE[i] - SKY_ZENITH[i]) * t);
    const color = rgb15([mix(0), mix(1), mix(2)]);
    const last = bands[bands.length - 1];
    if (last && last.color === color) last.h++; else bands.push({ y, h: 1, color });
  }
  return bands;
}

export class FlightSky {
  readonly view = new Graphics();

  /** Draw the sky down to `horizon` (plus `overlap` rows under the ground, so no gap shows at the seam). */
  draw(horizon: number, overlap = 8, width = SCREEN_W): void {
    const g = this.view.clear();
    const bands = skyBands(horizon);
    bands.forEach((b, i) => {
      const extra = i === bands.length - 1 ? overlap : 0;
      g.rect(0, b.y, width, b.h + extra).fill(b.color);
    });
  }

  destroy(): void {
    this.view.destroy();
  }
}

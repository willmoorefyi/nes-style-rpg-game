/**
 * The Mode 7 sky's clouds (docs/MODE7_PLAN.md 5, M7-5; Q8: sky clouds only, no ground shadows), pure: no PixiJS. Each
 * cloud is a code-drawn bitmap at native resolution (a few round lobes on a flat base, lit from the top left, every
 * colour a 15-bit one, binary alpha), shown at a whole-number scale with nearest filtering, like the field's art. They
 * sit in the sky band at a fixed height above the horizon, so they ride down with it during a tilt and hide behind
 * the ground; they drift slowly east, and slide a little against the ship's sideways motion: the lower (farther) a
 * cloud, the smaller and the slower.
 */
import { SCREEN_W } from './mode7Math.js';

type C15 = readonly [number, number, number];

/** The cloud ramp, 5-bit channels: the lit rim, the body, the shaded underside and the base row. */
export const CLOUD_TONES: readonly C15[] = [[31, 31, 31], [27, 29, 31], [21, 24, 30], [17, 21, 28]];

export interface CloudSpec {
  /** Native size, px. */
  w: number;
  h: number;
  /** Round lobes (centre x, centre y, radius; native px); the cloud is their union above `base`. */
  lobes: ReadonlyArray<readonly [number, number, number]>;
  /** The last native row (the flat base). */
  base: number;
  /** The whole-number draw scale. */
  scale: number;
  /** Its base sits `above` screen px over the horizon. */
  above: number;
  /** Screen x at t 0 with the ship at x 0, the drift (px/s) and the slide (screen px per cell the ship moves). */
  x0: number;
  speed: number;
  parallax: number;
}

/** Four clouds (3 to 5, section 5): two high and near, two low and far. */
export const CLOUDS: readonly CloudSpec[] = [
  { w: 64, h: 24, base: 21, lobes: [[13, 16, 7], [25, 11, 10], [39, 11, 9], [51, 15, 7]], scale: 4, above: 240,
    x0: 180, speed: 6, parallax: 3 },
  { w: 48, h: 18, base: 16, lobes: [[11, 12, 6], [22, 8, 8], [35, 11, 7]], scale: 3, above: 170, x0: 1260,
    speed: 4.5, parallax: 2 },
  { w: 56, h: 16, base: 14, lobes: [[10, 10, 5], [21, 7, 7], [33, 8, 6], [45, 11, 5]], scale: 2, above: 80, x0: 720,
    speed: 3, parallax: 1 },
  { w: 40, h: 14, base: 12, lobes: [[10, 9, 5], [20, 6, 6], [30, 9, 5]], scale: 2, above: 46, x0: 1640,
    speed: 2, parallax: 0.6 },
];

/** Whether native pixel (x, y) is inside the cloud. */
export function cloudInside(c: CloudSpec, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= c.w || y > c.base) return false;
  return c.lobes.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
}

/** The tone index of an inside pixel: 0 the lit top-left rim, 3 the base row, 2 the shaded lower-right rim, else 1. */
export function cloudTone(c: CloudSpec, x: number, y: number): number {
  if (y === c.base) return 3;
  if (!cloudInside(c, x - 1, y - 1) || !cloudInside(c, x, y - 2)) return 0;
  if (!cloudInside(c, x + 1, y + 2) || y >= c.base - 2) return 2;
  return 1;
}

/** A 5-bit channel as 8 bits, as `snes_palette.c15` expands it. */
const e5 = (v: number): number => (v << 3) | (v >> 2);

/** The cloud's RGBA texels (binary alpha, so premultiplied and straight agree). */
export function cloudTexels(c: CloudSpec): Uint8Array {
  const out = new Uint8Array(c.w * c.h * 4);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!cloudInside(c, x, y)) continue;
      const t = CLOUD_TONES[cloudTone(c, x, y)];
      out.set([e5(t[0]), e5(t[1]), e5(t[2]), 255], (y * c.w + x) * 4);
    }
  }
  return out;
}

/**
 * Where a cloud's bottom-left corner is drawn (screen px), with the ship at `px` cells and the horizon at screen y
 * `horizon` (`-Infinity` looking straight down: no cloud shows). x wraps over the screen width plus the cloud's.
 */
export function cloudPlace(c: CloudSpec, tMs: number, px: number, horizon: number,
  width = SCREEN_W): { x: number; y: number; visible: boolean } {
  const w = c.w * c.scale;
  const span = width + w;
  const raw = c.x0 + (c.speed * tMs) / 1000 - px * c.parallax;
  const x = (((raw % span) + span) % span) - w;
  const y = horizon - c.above;
  return { x: Math.round(x), y: Math.round(y), visible: Number.isFinite(y) && y > 0 };
}

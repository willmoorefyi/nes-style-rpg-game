/**
 * The pure motion of the volcano smoke (smokeStyles.ts) at time ms, written into preallocated state (no allocation
 * per frame). Puffs are evenly staggered over the loop; each rises (slowing), grows, drifts and fades by dither levels.
 */
import type { SmokeStyle } from './smokeStyles.js';

/** Per-puff variation (fixed, so the loop repeats exactly). */
const JITTER = [0.13, 0.71, 0.42, 0.88, 0.27, 0.56, 0.05, 0.93, 0.35, 0.64, 0.19, 0.8];
export const DITHER_LEVELS = 4;

export interface PuffState {
  /** Art px from the source to the puff's centre (whole px). */
  dx: number;
  dy: number;
  /** Radius in art px, r0..r1. */
  r: number;
  /** 0 solid .. 3 sparse; DITHER_LEVELS: hidden. */
  level: number;
  /** Life fraction 0..1 (the newest puff draws in front). */
  u: number;
}

export function createPuffs(style: SmokeStyle): PuffState[] {
  return Array.from({ length: style.puffs }, () => ({ dx: 0, dy: 0, r: style.r0, level: 0, u: 0 }));
}

const frac = (v: number): number => ((v % 1) + 1) % 1;

/** The dither level of a life fraction: a one-step fade-in at the crater, a fade-out from `fadeStart`. */
export function fadeLevel(u: number, fadeStart: number): number {
  if (u < 0.03) return 1;
  if (u < fadeStart) return 0;
  return Math.min(DITHER_LEVELS, 1 + Math.floor(((u - fadeStart) / (1 - fadeStart)) * DITHER_LEVELS));
}

/** Fill `out` (from createPuffs) with the puffs of `style` at `ms`. */
export function smokeState(style: SmokeStyle, ms: number, out: PuffState[]): PuffState[] {
  const t = ms / style.periodMs;
  out.forEach((p, i) => {
    const j = JITTER[i % JITTER.length];
    const u = frac(t + i / style.puffs);
    const risen = style.rise * (1 - (1 - u) ** style.riseEase);
    const r = Math.min(style.r1, Math.round(style.r0 + (style.r1 - style.r0) * u ** style.grow * (0.75 + 0.5 * j)));
    const side = (i % 2 ? 1 : -1) * (0.5 + j);
    p.u = u;
    p.r = r;
    p.dx = Math.round(style.lean * risen + style.wind * u * u + style.wobble * Math.sin(u * Math.PI * 2 + i * 1.9)
      + style.spread * side * u);
    p.dy = -Math.round(risen) - r + 2;                     // the puff's bottom stays near the crater as it grows
    p.level = fadeLevel(u, style.fadeStart);
  });
  return out;
}

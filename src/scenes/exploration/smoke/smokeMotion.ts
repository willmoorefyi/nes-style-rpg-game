/**
 * SMOKE experiment: the pure motion of a smoke option (smokeStyles.ts) at time ms, written into preallocated state
 * (no allocation per frame). Puffs are evenly staggered over the loop; each rises (slowing), grows, leans with the
 * wind and fades by dither levels. The glow flares now and then; embers spit up from the crater.
 */
import type { SmokeStyle } from './smokeStyles.js';

/** Per-puff variation (fixed, so the loop repeats exactly). */
const JITTER = [0.13, 0.71, 0.42, 0.88, 0.27, 0.56, 0.05, 0.93, 0.35, 0.64, 0.19, 0.8];
export const DITHER_LEVELS = 4;
export const GLOW_PERIOD_MS = 1800;
export const EMBER_LIFE = 0.45;

export interface PuffState {
  /** Art px from the source to the puff's centre (whole px). */
  dx: number;
  dy: number;
  /** Radius in art px, r0..r1. */
  r: number;
  /** 0 solid .. 3 sparse; DITHER_LEVELS: hidden. */
  level: number;
  /** Index into the style's palettes; -1: the warm (lava-lit) palette. */
  palette: number;
  /** Life fraction 0..1 (the newest puff draws in front). */
  u: number;
}

export interface GlowState {
  /** 0 hidden, 1 small, 2 mid, 3 flare. */
  size: number;
}

export interface EmberState {
  dx: number;
  dy: number;
  visible: boolean;
  /** 0 yellow, 1 orange. */
  hot: number;
}

export interface SmokeFrame {
  puffs: PuffState[];
  glow: GlowState;
  embers: EmberState[];
}

export function createSmokeFrame(style: SmokeStyle): SmokeFrame {
  return {
    puffs: Array.from({ length: style.puffs }, () => ({ dx: 0, dy: 0, r: style.r0, level: 0, palette: 0, u: 0 })),
    glow: { size: 0 },
    embers: Array.from({ length: style.embers }, () => ({ dx: 0, dy: 0, visible: false, hot: 0 })),
  };
}

const frac = (v: number): number => ((v % 1) + 1) % 1;

/** The dither level of a life fraction: a one-step fade-in at the crater, a fade-out from `fadeStart`. */
export function fadeLevel(u: number, fadeStart: number): number {
  if (u < 0.03) return 1;
  if (u < fadeStart) return 0;
  return Math.min(DITHER_LEVELS, 1 + Math.floor(((u - fadeStart) / (1 - fadeStart)) * DITHER_LEVELS));
}

/** Fill `out` with the state of `style` at `ms`. */
export function smokeState(style: SmokeStyle, ms: number, out: SmokeFrame): SmokeFrame {
  const t = ms / style.periodMs;
  out.puffs.forEach((p, i) => {
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
    p.palette = style.warm && u < (style.warmUntil ?? 0) ? -1 : i % style.palettes.length;
  });
  if (style.glow) {
    const g = frac(ms / GLOW_PERIOD_MS);
    const cycle = Math.floor(ms / GLOW_PERIOD_MS) % 3;      // every third cycle flares
    out.glow.size = g < 0.1 ? (cycle === 0 ? 3 : 2) : g < 0.25 ? 2 : g < 0.6 ? 1 : (Math.floor(ms / 120) % 4 ? 1 : 0);
  } else {
    out.glow.size = 0;
  }
  out.embers.forEach((e, i) => {
    const u = frac(ms / (GLOW_PERIOD_MS * 1.3) + i / out.embers.length + JITTER[i] * 0.3);
    e.visible = u < EMBER_LIFE;
    const v = u / EMBER_LIFE;
    e.dx = Math.round((JITTER[(i + 3) % JITTER.length] - 0.5) * 16 * v);
    e.dy = -Math.round(4 + 30 * v - 12 * v * v);
    e.hot = v < 0.5 ? 0 : 1;
  });
  return out;
}

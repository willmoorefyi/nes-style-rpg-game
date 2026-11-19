/**
 * SMOKE experiment: the volcano smoke options, picked in dev builds with `?smoke=a..f` (no switch: today's puffs,
 * FieldAmbient.ts). Every option is pixel art at the field art scale: 15-bit palette colours, whole art px, binary
 * alpha with a dithered fade. The motion is the pure `smokeState` (smokeMotion.ts).
 */
import { CLUSTER, DISC, rgb15, type Lobe } from './smokeShapes.js';

/** Outline, shade, body, highlight. */
export type SmokePalette = readonly [number, number, number, number];

export const PALETTES = {
  charcoal: [rgb15(2, 2, 2), rgb15(6, 5, 5), rgb15(10, 9, 9), rgb15(20, 19, 18)],
  warm: [rgb15(5, 3, 3), rgb15(17, 15, 14), rgb15(24, 23, 21), rgb15(30, 29, 27)],
  lavaLit: [rgb15(9, 3, 2), rgb15(21, 10, 4), rgb15(27, 17, 9), rgb15(31, 25, 16)],
  ash: [rgb15(2, 2, 2), rgb15(8, 7, 6), rgb15(12, 11, 10), rgb15(21, 20, 18)],
  steam: [rgb15(5, 5, 7), rgb15(20, 20, 22), rgb15(27, 27, 28), rgb15(31, 31, 31)],
} satisfies Record<string, SmokePalette>;

/** The crater glow and its embers: dark red, orange, yellow, white-hot. */
export const GLOW_PALETTE = [rgb15(14, 2, 1), rgb15(29, 11, 2), rgb15(31, 23, 6), rgb15(31, 30, 21)] as const;

export interface SmokeStyle {
  id: string;
  label: string;
  periodMs: number;
  puffs: number;
  lobes: readonly Lobe[];
  outline: boolean;
  /** Each puff's palette: puff i uses palettes[i % length]. */
  palettes: readonly SmokePalette[];
  /** A lava-lit palette for the puffs still low (life u < warmUntil). */
  warm?: SmokePalette;
  warmUntil?: number;
  /** Art px risen over a life, and the deceleration (1: steady; larger: slows near the top). */
  rise: number;
  riseEase: number;
  /** Radius at birth and at the end of life (art px), and the growth curve exponent (< 1: fast early growth). */
  r0: number;
  r1: number;
  grow: number;
  /** dx = lean x risen + wind x u^2 + wobble x sin + spread x (per-puff side) x u. */
  lean: number;
  wind: number;
  wobble: number;
  spread: number;
  /** Life fraction where the dithered fade starts. */
  fadeStart: number;
  /** The crater glow (an occasional flare) and the number of embers (0: none). */
  glow: boolean;
  embers: number;
}

const BASE = {
  outline: true, riseEase: 1.6, grow: 0.8, lean: 0, wind: 0, wobble: 3, spread: 0, fadeStart: 0.6,
  glow: false, embers: 0,
} as const;

export const SMOKE_STYLES: readonly SmokeStyle[] = [
  { ...BASE, id: 'a', label: 'charcoal discs', periodMs: 3200, puffs: 12, lobes: DISC, palettes: [PALETTES.charcoal],
    rise: 110, riseEase: 1.3, r0: 6, r1: 13, lean: 0.15 },
  { ...BASE, id: 'b', label: 'warm billows', periodMs: 4000, puffs: 10, lobes: CLUSTER, palettes: [PALETTES.warm],
    rise: 120, riseEase: 1.4, r0: 7, r1: 20, grow: 0.7, lean: 0.18, wind: 12, fadeStart: 0.55 },
  { ...BASE, id: 'c', label: 'lava-lit plume', periodMs: 3600, puffs: 10, lobes: CLUSTER, palettes: [PALETTES.warm],
    warm: PALETTES.lavaLit, warmUntil: 0.22, rise: 120, riseEase: 1.4, r0: 6, r1: 18, grow: 0.75, lean: 0.12,
    wind: 10, glow: true, embers: 5 },
  { ...BASE, id: 'd', label: 'ash column', periodMs: 2400, puffs: 16, lobes: CLUSTER, palettes: [PALETTES.ash],
    rise: 130, riseEase: 1.1, r0: 6, r1: 16, grow: 0.9, lean: 0.05, wind: 34, wobble: 2, spread: 10, fadeStart: 0.65 },
  { ...BASE, id: 'e', label: 'towering steam billows', periodMs: 5200, puffs: 7, lobes: CLUSTER,
    palettes: [PALETTES.steam], rise: 110, riseEase: 2, r0: 10, r1: 26, grow: 0.6, wobble: 1, spread: 12,
    fadeStart: 0.62 },
  { ...BASE, id: 'f', label: 'ash and steam, glow', periodMs: 3200, puffs: 12, lobes: CLUSTER,
    palettes: [PALETTES.ash, PALETTES.steam], rise: 120, riseEase: 1.3, r0: 6, r1: 17, lean: 0.16, wind: 10,
    glow: true },
];

/** The option `?smoke=<id>` asks for in a dev build, or null (today's puffs). */
export function smokeStyleFromSearch(search: string): SmokeStyle | null {
  const id = new URLSearchParams(search).get('smoke');
  if (!id) return null;
  const style = SMOKE_STYLES.find((s) => s.id === id);
  if (!style) console.error(`smoke: unknown option ${id} (one of ${SMOKE_STYLES.map((s) => s.id).join(', ')})`);
  return style ?? null;
}

/** The dev switch at runtime: production and tests (no `location`) always get today's puffs. */
export function devSmokeStyle(): SmokeStyle | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  return smokeStyleFromSearch(location.search);
}

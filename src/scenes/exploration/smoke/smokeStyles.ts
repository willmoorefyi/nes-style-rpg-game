/**
 * The volcano's smoke (SMOKE, user pick: option e of the experiment, "towering steam billows"): 7 big white
 * cauliflower clouds with a dark outline, lit from the top left, growing to 52 art px across, slowing as they rise and
 * spreading apart at the top, on a 5.2 s loop. Pixel art at the field art scale: 15-bit palette colours, whole art px,
 * binary alpha with a dithered fade. The motion is the pure `smokeState` (smokeMotion.ts).
 */
import { CLUSTER, rgb15, type Lobe } from './smokeShapes.js';

/** Outline, shade, body, highlight. */
export type SmokePalette = readonly [number, number, number, number];

export const STEAM_PALETTE: SmokePalette = [rgb15(5, 5, 7), rgb15(20, 20, 22), rgb15(27, 27, 28), rgb15(31, 31, 31)];

export interface SmokeStyle {
  periodMs: number;
  puffs: number;
  lobes: readonly Lobe[];
  palette: SmokePalette;
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
}

export const VOLCANO_SMOKE: SmokeStyle = {
  periodMs: 5200, puffs: 7, lobes: CLUSTER, palette: STEAM_PALETTE, rise: 110, riseEase: 2, r0: 10, r1: 26,
  grow: 0.6, lean: 0, wind: 0, wobble: 1, spread: 12, fadeStart: 0.62,
};

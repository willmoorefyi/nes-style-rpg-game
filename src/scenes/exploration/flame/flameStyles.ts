/**
 * The light styles of the dungeon props (AR-P2, the AR-P proposal the user approved): a 4-colour flame ramp, darkest
 * to lightest, and the glow's lift, a fixed 15-bit step added to the floor under it. All 15-bit colours.
 */
import type { FlameStyleId } from '../../../types/ambient.js';
import { rgb15 } from '../smoke/smokeShapes.js';

export type FlameRamp = readonly [number, number, number, number];

export interface FlameStyle {
  ramp: FlameRamp;
  /** The glow's lift: 5-bit steps per channel, drawn additively as (step x 8) per channel. */
  lift: readonly [number, number, number];
}

export const FLAME_STYLE: Record<FlameStyleId, FlameStyle> = {
  fire: { ramp: [rgb15(21, 4, 1), rgb15(29, 12, 2), rgb15(31, 22, 5), rgb15(31, 30, 21)], lift: [5, 3, 0] },
  purple: { ramp: [rgb15(12, 3, 17), rgb15(19, 7, 27), rgb15(25, 15, 31), rgb15(30, 26, 31)], lift: [3, 1, 5] },
  green: { ramp: [rgb15(3, 15, 5), rgb15(8, 24, 8), rgb15(17, 30, 12), rgb15(27, 31, 22)], lift: [1, 4, 1] },
  cyan: { ramp: [rgb15(2, 13, 20), rgb15(4, 21, 27), rgb15(13, 28, 31), rgb15(26, 31, 31)], lift: [0, 3, 5] },
  lamp: { ramp: [rgb15(20, 15, 3), rgb15(27, 22, 6), rgb15(31, 28, 12), rgb15(31, 31, 25)], lift: [4, 4, 0] },
};

/** The lift as the 24-bit colour the additive glow draws. */
export function liftColour(style: FlameStyle): number {
  const [r, g, b] = style.lift;
  return ((r * 8) << 16) | ((g * 8) << 8) | (b * 8);
}

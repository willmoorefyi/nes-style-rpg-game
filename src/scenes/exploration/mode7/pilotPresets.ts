/**
 * The M7-0 pilot's three looks (docs/MODE7_PLAN.md 10, `&preset=a | b | c`): pure, no PixiJS. Each preset fixes the
 * pitch, the altitude, the curvature and the horizon row; `cy` is fitted so the first ground row is that row, and
 * `back` so the ship's position P lies on the shadow row 820 (4.2). Every altitude was chosen so P shows at about 95 px
 * per cell, the ship's top-down size (96).
 */
import { FLIGHT, cyForHorizon, depthAt, forwardAt, type ViewParams } from './mode7Math.js';

export interface PilotPreset {
  id: 'a' | 'b' | 'c';
  name: string;
  thetaDeg: number;
  h: number;
  kappa: number;
  horizon: number;
}

/** The ship's shadow row (4.2): P is drawn here. */
export const SHADOW_ROW = 820;

export const PILOT_PRESETS: readonly PilotPreset[] = [
  // the plan's flight values (2.4): 36 % sky, the horizon 78 cells out
  { id: 'a', name: 'A classic', thetaDeg: 18, h: 6, kappa: 1 / 600, horizon: 390 },
  // flatter and more curved: 42 % sky, a nearer horizon (66 cells) that drops away sooner
  { id: 'b', name: 'B vista', thetaDeg: 13, h: 5.6, kappa: 1 / 450, horizon: 450 },
  // steeper and flatter: 28 % sky, more readable ground, the horizon 99 cells out
  { id: 'c', name: 'C high', thetaDeg: 28, h: 6.4, kappa: 1 / 900, horizon: 300 },
];

/** The preset named by `?preset=` (case-insensitive); A when missing or unknown. */
export function pickPreset(search: string): PilotPreset {
  const id = (new URLSearchParams(search).get('preset') ?? 'a').toLowerCase();
  return PILOT_PRESETS.find((p) => p.id === id) ?? PILOT_PRESETS[0];
}

/** The view of a preset with the ship at world cell point (px, py). */
export function presetView(preset: PilotPreset, px: number, py: number): ViewParams {
  const base: ViewParams = { ...FLIGHT, theta: (preset.thetaDeg * Math.PI) / 180, h: preset.h, kappa: preset.kappa, px, py };
  const cy = cyForHorizon(base, preset.horizon);
  const fitted = { ...base, cy };
  const s = depthAt(fitted, SHADOW_ROW + 0.5);
  return { ...fitted, back: forwardAt(fitted, SHADOW_ROW + 0.5, s) };
}

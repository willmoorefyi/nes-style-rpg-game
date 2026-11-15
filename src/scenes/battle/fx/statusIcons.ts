/**
 * The status icons above an actor (docs/FEEDBACK_PLAN_2026-11-14.md §3.5): 12x12 native glyphs of the fx atlas (24 px
 * at its x2), at most 3 in priority order, in one row: centred 8 px above an enemy's head, and behind a hero's head
 * (statusFx). Pure (no PixiJS).
 */
import type { FxDraw } from './emitterCore.js';

/** Native icon size and the gap between icons (screen px at the atlas's x2). */
export const ICON_NATIVE = 12;
export const ICON_PX = ICON_NATIVE * 2;
export const ICON_GAP = 4;
/** Screen px between the head and the bottom of the icon row. */
export const ICON_LIFT = 8;

/** Icon draws (key `<icon>.icon`) centred on `cx`, with the row's bottom edge at `bottom`. */
export function iconDraws(icons: readonly string[], cx: number, bottom: number, alpha = 1): FxDraw[] {
  const width = icons.length * ICON_PX + (icons.length - 1) * ICON_GAP;
  const left = cx - width / 2;
  return icons.map((icon, k) => ({
    key: `${icon}.icon`, frame: 0, scale: 1 as const, alpha, flipX: false,
    x: Math.round(left + k * (ICON_PX + ICON_GAP) + ICON_PX / 2), y: Math.round(bottom - ICON_PX / 2),
  }));
}

/**
 * The status icons above an actor (docs/FEEDBACK_PLAN_2026-11-14.md §3.5): 12x12 native glyphs of the fx atlas (24 px
 * at its x2), at most 3 in priority order, in one row: centred 8 px above an enemy's head, and behind a hero's head
 * (statusFx); on a colossus 36 px on a dark plate (`colossusRow`). Pure (no PixiJS).
 */
import { snap2, type FxDraw } from './emitterCore.js';

/** Native icon size and the gap between icons (screen px at the atlas's x2). */
export const ICON_NATIVE = 12;
export const ICON_PX = ICON_NATIVE * 2;
export const ICON_GAP = 4;
/** Screen px between the head and the bottom of the icon row. */
export const ICON_LIFT = 8;

/** The top of an enemy's icon row (screen px) for a head at `headY`: the row's bottom is ICON_LIFT above the head. */
export const enemyIconRowTop = (headY: number): number => headY - ICON_LIFT - ICON_PX;

/** C6-6 (D-C7-11): on a colossus the icons draw at 3x native on a dark plate, so the row is 44 px tall. */
export const COLOSSUS_ICON_PX = ICON_NATIVE * 3;
export const COLOSSUS_PLATE = { color: 0x101018, alpha: 0.75, pad: 4 } as const;
export const COLOSSUS_ROW_PX = COLOSSUS_ICON_PX + 2 * COLOSSUS_PLATE.pad;
/** The top of a colossus's plated row for a head at `headY` (its bottom ICON_LIFT above the head). */
export const colossusRowTop = (headY: number): number => headY - ICON_LIFT - COLOSSUS_ROW_PX;

/** A colossus's icon row: the icons (36 px, scale 1.5 of the atlas's x2) and their plate, the row's bottom ICON_LIFT
 *  above `headY`, centred on `cx`; whole even px, so the plate frames the icons with exactly its padding. */
export function colossusRow(icons: readonly string[], cx: number, headY: number): { draws: FxDraw[]; plate: { x: number; y: number; w: number; h: number } } {
  const { pad } = COLOSSUS_PLATE;
  const width = icons.length * COLOSSUS_ICON_PX + (icons.length - 1) * ICON_GAP;
  const left = snap2(cx - width / 2);
  const top = snap2(headY - ICON_LIFT - pad - COLOSSUS_ICON_PX);
  const draws = icons.map((icon, k): FxDraw => ({
    key: `${icon}.icon`, frame: 0, scale: 1.5, alpha: 1, flipX: false,
    x: left + k * (COLOSSUS_ICON_PX + ICON_GAP) + COLOSSUS_ICON_PX / 2, y: top + COLOSSUS_ICON_PX / 2,
  }));
  return { draws, plate: { x: left - pad, y: top - pad, w: width + 2 * pad, h: COLOSSUS_ROW_PX } };
}

/** Icon draws (key `<icon>.icon`) centred on `cx`, with the row's bottom edge at `bottom`. */
export function iconDraws(icons: readonly string[], cx: number, bottom: number, alpha = 1): FxDraw[] {
  const width = icons.length * ICON_PX + (icons.length - 1) * ICON_GAP;
  const left = cx - width / 2;
  return icons.map((icon, k) => ({
    key: `${icon}.icon`, frame: 0, scale: 1 as const, alpha, flipX: false,
    x: Math.round(left + k * (ICON_PX + ICON_GAP) + ICON_PX / 2), y: Math.round(bottom - ICON_PX / 2),
  }));
}

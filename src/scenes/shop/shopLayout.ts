import { GAME_WIDTH, SCREEN_MARGIN } from '../../core/LayoutConstants.js';

/** A window's rectangle on screen (for layout tests). */
export interface ShopRect { x: number; y: number; width: number; height: number }

/** The right-hand panel (equipment comparison, or who can learn a spell); the list narrows to end before it. */
export const DETAIL_RECT: ShopRect = { x: 1200, y: SCREEN_MARGIN + 116, width: 696, height: 584 };
/** Top left: Buy / Sell / Exit (the magic shop shows its name here). */
export const CHOICE_RECT: ShopRect = { x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 300, height: 240 };
/** Top right, as wide as the panel below it: the gold only (the result line is on the help bar, U9). */
export const GOLD_RECT: ShopRect = { x: DETAIL_RECT.x, y: SCREEN_MARGIN, width: DETAIL_RECT.width, height: 100 };

const LIST_Y = 288;
/** Ends at y 876, above the help bar (y 900). */
const LIST_HEIGHT = 588;
const PANEL_GAP = 16;

/** The item or spell list: full width, or ending before the right-hand panel while it is shown. */
export function listRect(withPanel: boolean): ShopRect {
  const width = withPanel ? DETAIL_RECT.x - PANEL_GAP - SCREEN_MARGIN : GAME_WIDTH - 2 * SCREEN_MARGIN;
  return { x: SCREEN_MARGIN, y: LIST_Y, width, height: LIST_HEIGHT };
}

/** Rows of cells as aligned columns: each column as wide as its longest cell, two spaces between (E2). */
export function columns(rows: string[][], align: Array<'left' | 'right'> = []): string[] {
  const widths: number[] = [];
  for (const row of rows) row.forEach((cell, i) => { widths[i] = Math.max(widths[i] ?? 0, cell.length); });
  return rows.map((row) => row
    .map((cell, i) => (align[i] === 'right' ? cell.padStart(widths[i]) : cell.padEnd(widths[i])))
    .join('  ')
    .trimEnd());
}

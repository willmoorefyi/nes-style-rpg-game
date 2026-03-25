/**
 * Central layout constants for the HD (1920×1080) rendering engine.
 * All UI, rendering, and scene files should import from here — no hardcoded pixel values.
 *
 * Scale philosophy: 3× the original NES values for visual density (16→48 tiles, 8→24 font),
 * with a wider viewport showing more of the world (40×23 tiles vs 16×15).
 */

// ═══ SCREEN ═══
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// ═══ TILES ═══
export const TILE_SIZE = 48;

// ═══ FONT ═══
export const FONT_SIZE = 24;
export const FONT_SIZE_SM = 16;
export const FONT_SIZE_LG = 32;

// Character width — set at runtime by installNESFont() after measuring the bitmap font.
// Default assumes ~14px for system monospace at 24px. Overwritten by actual measurement.
export let CHAR_WIDTH = 14;

/** Called by installNESFont() after font is installed to set the measured character width. */
export function setCHAR_WIDTH(w: number): void {
  CHAR_WIDTH = w;
}

// ═══ TEXT ═══
export const LINE_HEIGHT = 30;
export const MENU_LINE_HEIGHT = 36;

// ═══ WINDOW CHROME ═══
export const WINDOW_PADDING = 24;
export const WINDOW_BORDER_OUTER = 6;
export const WINDOW_BORDER_INNER = 12;

// ═══ LAYOUT ═══
export const SCREEN_MARGIN = 24;

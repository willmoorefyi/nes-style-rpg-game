/**
 * Re-test B: the heavy attack's glint played at the raised weapon's tip (atlas `tip`), which for Garland and the lich
 * lies under the top message window, so it was never seen. The glint now plays at the tip when it is clear of the
 * window, else at the highest point of the weapon below the window: the first pixel at or below the clear row
 * reached by walking the opaque pixels from the tip (8-connected, so the walk follows the blade, then the shaft).
 * Pure apart from `glintTip`'s pixel read (none outside a browser: the tip's y is then clamped).
 */
import type { Container, Texture } from 'pixi.js';
import { BATTLE_MESSAGE_HEIGHT } from './BattleSceneTypes.js';
import { readPixels, type Pixels } from './fx/texturePixels.js';

/** Half the glint on screen (its 11-px glyph at the fx atlas's x2), and the gap kept under the message window. */
export const GLINT_HALF = 11;
const GLINT_GAP = 2;
/** The lowest screen y the glint's centre may take: its box stays below the message window's bottom edge. */
export const GLINT_MIN_Y = BATTLE_MESSAGE_HEIGHT + GLINT_HALF + GLINT_GAP;

const opaque = (px: Pixels, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < px.w && y < px.h && px.data[(y * px.w + x) * 4 + 3] > 0;

/** Most px a blade moves sideways from one row to the next while it is followed. */
const TRACK_REACH = 6;
/** A run wider than this is no longer the blade (a guard, a hand): the walk keeps to its predicted line through it. */
const BLADE_WIDTH = 12;

/**
 * From `tip` (art px), the weapon's first point at or below `minRow`. The blade is followed row by row (the opaque run
 * nearest the line so far, its middle while it is blade-thin); when the blade ends above the row (the lich's glaive
 * blade hangs off its shaft), a breadth-first walk over opaque pixels from the tip finds the row (the shaft). The tip
 * itself when it is at or below the row; null when nothing reaches it.
 */
export function walkToRow(px: Pixels, tip: readonly [number, number], minRow: number): [number, number] | null {
  if (tip[1] >= minRow) return [tip[0], tip[1]];
  return followBlade(px, tip, minRow) ?? flood(px, tip, minRow);
}

function followBlade(px: Pixels, [tx, ty]: readonly [number, number], minRow: number): [number, number] | null {
  let x = tx;
  let slope = 0;
  for (let y = ty; y <= minRow && y < px.h; y++) {
    const pred = x + slope;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let s = 0; s < px.w; s++) {
      if (!opaque(px, s, y)) continue;
      let e = s;
      while (opaque(px, e + 1, y)) e++;
      const d = pred < s ? s - pred : pred > e ? pred - e : 0;
      if (d < bestD) { bestD = d; best = [s, e]; }
      s = e;
    }
    if (!best || bestD > TRACK_REACH) return null;
    const nx = best[1] - best[0] <= BLADE_WIDTH ? (best[0] + best[1]) / 2 : Math.min(Math.max(pred, best[0]), best[1]);
    if (y - ty >= 3) slope = 0.7 * slope + 0.3 * (nx - x);
    x = nx;
    if (y === minRow) return [Math.round(x), y];
  }
  return null;
}

function flood(px: Pixels, [tx, ty]: readonly [number, number], minRow: number): [number, number] | null {
  const seen = new Uint8Array(px.w * px.h);
  let ring: [number, number][] = [];
  for (let dx = 0; dx <= 2 && ring.length === 0; dx++) {
    for (const x of [tx - dx, tx + dx]) if (opaque(px, x, ty)) ring.push([x, ty]);
  }
  for (const [x, y] of ring) seen[y * px.w + x] = 1;
  while (ring.length > 0) {
    const hits = ring.filter(([, y]) => y >= minRow).map(([x]) => x).sort((a, b) => a - b);
    if (hits.length > 0) return [hits[Math.floor((hits.length - 1) / 2)], minRow];
    const next: [number, number][] = [];
    for (const [x, y] of ring) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!opaque(px, nx, ny) || seen[ny * px.w + nx]) continue;
          seen[ny * px.w + nx] = 1;
          next.push([nx, ny]);
        }
      }
    }
    ring = next;
  }
  return null;
}

/** What `glintTip` reads of a monster's frames. */
export interface GlintFrames { tip?: [number, number]; cell: [number, number]; textures: Partial<Record<string, Texture>> }

/**
 * The glint's point on enemy `sprite` in art px of its cell: the tip, or the highest weapon point clear of the
 * message window (`walkToRow` over the raise frame's pixels; the tip's y clamped when they cannot be read).
 */
export function glintTip(f: GlintFrames, sprite: Container, read: (t: Texture) => Pixels | null = readPixels): [number, number] | undefined {
  if (!f.tip) return undefined;
  const b = sprite.getLocalBounds();
  if (b.height <= 0) return f.tip;
  const minRow = Math.ceil(((sprite.toLocal({ x: 0, y: GLINT_MIN_Y }).y - b.y) / b.height) * f.cell[1]);
  const tex = f.textures.attack_raise;
  const px = tex ? read(tex) : null;
  return (px && walkToRow(px, f.tip, minRow)) ?? [f.tip[0], Math.max(f.tip[1], minRow)];
}

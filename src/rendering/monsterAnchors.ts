/**
 * Monster atlas anchors beyond the idle reach (docs/ROSTER_FIX_PLAN.md FW-A, R-1 to R-3), read from a sheet's
 * `monsters-ai.json` entry. All are art px in the cell, inclusive column / row indices:
 * - `travelTop`: the highest opaque row over the travel frames (winds, strike, raise and swing frames, idle, hurt);
 *   the travel's rise keeps it under the message window. Missing: 0, the cell top (conservative).
 * - `lungeRight`: the furthest opaque column over the attack and raise frames; the bestiary's phantom target moves
 *   left by its overshoot past the idle edge. Missing: no overshoot.
 * - `homeX`: the opaque extent [left, right] over the home frames (idle, breath, hurt, daze; plus the attack frames
 *   for a ranged sheet, whose in-place breath must not reach a neighbour); the layout packs by it when cells overflow.
 *   Missing: the whole cell.
 * - `idleBox`: the idle frame's opaque box [left, top, right, bottom] (FW-A2, docs/REDESIGN_PLAN.md 1); the bestiary
 *   centres it in the preview panel. Missing: measured from the atlas image in a browser, else no centring.
 */
import { layoutSizeOf, type EnemyBoxInput, type EnemySizeClass } from '../scenes/battle/EnemyLayoutAi.js';

/** The anchor fields of an atlas sheet entry (monster_atlas.py) and of MonsterFrames (optional, so hand-built test
 *  frames may leave them out). */
export interface MonsterAnchors {
  travelTop?: number;
  lungeRight?: number;
  homeX?: [number, number];
  idleBox?: [number, number, number, number];
}

const isIndex = (v: unknown, size: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < size;

/** The valid anchors of a sheet entry; a missing or out-of-cell value is left out (its fallback applies). */
export function monsterAnchors(entry: MonsterAnchors & { cell: [number, number] }): MonsterAnchors {
  const [w, h] = entry.cell;
  const out: MonsterAnchors = {};
  if (isIndex(entry.travelTop, h)) out.travelTop = entry.travelTop;
  if (isIndex(entry.lungeRight, w)) out.lungeRight = entry.lungeRight;
  const hx = entry.homeX;
  if (Array.isArray(hx) && isIndex(hx[0], w) && isIndex(hx[1], w) && hx[0] <= hx[1]) out.homeX = [hx[0], hx[1]];
  const ib = entry.idleBox;
  if (Array.isArray(ib) && ib.length === 4 && isIndex(ib[0], w) && isIndex(ib[2], w) && isIndex(ib[1], h) && isIndex(ib[3], h)
    && ib[0] <= ib[2] && ib[1] <= ib[3]) out.idleBox = [ib[0], ib[1], ib[2], ib[3]];
  return out;
}

/** The art the anchor helpers read: cell, screen scale, idle edge and the anchors. */
type AnchoredFrames = MonsterAnchors & { cell: [number, number]; scale: number; opaqueRight?: number };

/** The travel frames' highest row, art px from the cell top (0 when unknown). */
export const travelTopOf = (f: AnchoredFrames): number => f.travelTop ?? 0;

/** How far (art px, >= 0) the attack frames reach right of the idle edge (`opaqueRight`; both inclusive). */
export function lungeOvershoot(f: AnchoredFrames): number {
  return f.lungeRight === undefined ? 0 : Math.max(0, f.lungeRight - (f.opaqueRight ?? f.cell[0]));
}

/** The layout box of a sprite with art: its cell at the art's screen scale, with the home art's opaque extent (`ox0`
 *  inclusive, `ox1` exclusive, box px) when the atlas has it. `dataSize` (EF-A5): the enemy's data class when `size`
 *  is its 2.5 tier class (`medium` / `huge`), laid out from pass 3 on. */
export function enemyBoxInput(size: EnemySizeClass, f: AnchoredFrames, dataSize?: EnemySizeClass): EnemyBoxInput {
  const box: EnemyBoxInput = { size, w: f.cell[0] * f.scale, h: f.cell[1] * f.scale, scale: f.scale };
  if (dataSize && dataSize !== size && f.scale > 2 && f.scale < 3) box.dataSize = dataSize;
  if (f.homeX) { box.ox0 = f.homeX[0] * f.scale; box.ox1 = (f.homeX[1] + 1) * f.scale; }
  // a scale-3 boss is fitted by its art, not its cell (EnemyBoxInput.oy0; hollow_seraph, V8 N-1)
  if (size === 'boss' && f.scale === 3 && f.travelTop !== undefined) box.oy0 = f.travelTop * f.scale;
  return box;
}

/** The layout class of an enemy (layoutSizeOf) with its art's height: the travel frames' top to the cell bottom, screen
 *  px (unknown without art or `travelTop`, so a scale-3 boss then stays the titan class). */
export function layoutSizeOfArt(size: EnemySizeClass | undefined, f: AnchoredFrames | null | undefined): EnemySizeClass {
  return layoutSizeOf(size, f?.scale, f && f.travelTop !== undefined ? (f.cell[1] - f.travelTop) * f.scale : undefined);
}

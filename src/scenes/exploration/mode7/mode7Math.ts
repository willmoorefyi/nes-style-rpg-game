/**
 * The Mode 7 projection (docs/MODE7_PLAN.md 2.4): pure maths, no PixiJS. One function draws the view (the row table
 * and the strip UVs), and the same rays give `screenToCell` and its closed-form inverse `cellToScreen`.
 *
 * Coordinates: world cells (a cell (i, j) spans [i, i + 1) x [j, j + 1)), north up (forward is -y, right is +x).
 * Screen px, with a continuous screen y: row r's top edge is y = r and its centre y = r + 0.5.
 */

/** The screen the strips cover. */
export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
/** The near / far split distances (cells ahead of the camera; 3.2). */
export const D_SPLIT = 25;
export const D_SPLIT_LOW = 16;

export interface ViewParams {
  /** Altitude above the ground, in cells. */
  h: number;
  /** Pitch below horizontal, radians: PI / 2 looks straight down. */
  theta: number;
  /** Focal length, px. */
  f: number;
  /** The screen point of the optical axis. */
  cx: number;
  cy: number;
  /** Curvature 1/R per cell; 0 is flat. */
  kappa: number;
  /** How far the camera's ground point C lies south of the ship's position P, cells. */
  back: number;
  /** The ship's position P, cells (the hero's interpolated x / TILE_SIZE, y / TILE_SIZE). */
  px: number;
  py: number;
}

/** The flight values of 2.4 (P at the origin; set `px`, `py` per frame). */
export const FLIGHT: ViewParams = {
  h: 6, theta: (18 * Math.PI) / 180, f: 1200, cx: 960, cy: 600, kappa: 1 / 600, back: 11.3, px: 0, py: 0,
};

/** Camera depth `s` of the ground hit of the ray through continuous screen row `sy`, or NaN when it misses. */
export function depthAt(p: ViewParams, sy: number): number {
  const v = (sy - p.cy) / p.f;
  const c = Math.cos(p.theta);
  const sn = Math.sin(p.theta);
  const a = c - v * sn;
  const b = sn + v * c;
  const disc = b * b - 2 * p.h * p.kappa * a * a;
  if (b <= 0 || disc < 0) return NaN;
  return (2 * p.h) / (b + Math.sqrt(disc));
}

/** Forward ground distance from C of the ray through `sy` at depth `s` (`d = a s`). */
export function forwardAt(p: ViewParams, sy: number, s: number): number {
  const v = (sy - p.cy) / p.f;
  return (Math.cos(p.theta) - v * Math.sin(p.theta)) * s;
}

/** The screen point (continuous px) of world cell point (x, y), with the px per cell there; null behind the camera. */
export function cellToScreen(p: ViewParams, x: number, y: number): { x: number; y: number; scale: number } | null {
  const d = p.py + p.back - y;
  const l = x - p.px;
  const drop = p.h + (p.kappa * d * d) / 2;
  const c = Math.cos(p.theta);
  const sn = Math.sin(p.theta);
  const z = d * c + drop * sn;
  if (z <= 1e-9) return null;
  return { x: p.cx + (p.f * l) / z, y: p.cy + (p.f * (drop * c - d * sn)) / z, scale: p.f / z };
}

/** The world cell point seen at screen point (sx, sy) (continuous px), or null for sky. */
export function screenToCell(p: ViewParams, sx: number, sy: number): { x: number; y: number } | null {
  const s = depthAt(p, sy);
  if (Number.isNaN(s)) return null;
  return { x: p.px + ((sx - p.cx) * s) / p.f, y: p.py + p.back - forwardAt(p, sy, s) };
}

/** Per row edge e (0..rows, at screen y = e): the depth `s` (NaN = sky) and the forward distance `d` from C. */
export interface RowTable {
  s: Float64Array;
  d: Float64Array;
  /** The first row whose top edge hits the ground (rows above it are sky); `rows` when none does. */
  firstRow: number;
}

export function rowTable(p: ViewParams, rows = SCREEN_H): RowTable {
  const s = new Float64Array(rows + 1);
  const d = new Float64Array(rows + 1);
  let firstRow = rows;
  for (let e = 0; e <= rows; e++) {
    s[e] = depthAt(p, e);
    d[e] = Number.isNaN(s[e]) ? NaN : forwardAt(p, e, s[e]);
    if (e < rows && firstRow === rows && !Number.isNaN(s[e])) firstRow = e;
  }
  // a row hits only when both of its edges do (fillStrips); firstRow is only where the sky ends
  return { s, d, firstRow };
}

/** The first row (from the top) whose centre lies nearer than `dist` cells ahead of C. */
export function splitRow(p: ViewParams, dist: number, rows = SCREEN_H): number {
  for (let r = 0; r < rows; r++) {
    const s = depthAt(p, r + 0.5);
    if (!Number.isNaN(s) && forwardAt(p, r + 0.5, s) < dist) return r;
  }
  return rows;
}

/** The horizon row: the first row that hits the ground. */
export function horizonRow(p: ViewParams, rows = SCREEN_H): number {
  return rowTable(p, rows).firstRow;
}

/** The `cy` that puts the horizon (the first ground row) at `row`, all other parameters kept. */
export function cyForHorizon(p: ViewParams, row: number): number {
  let lo = -4 * p.f;
  let hi = 4 * p.f;   // a larger cy moves the horizon down
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Number.isNaN(depthAt({ ...p, cy: mid }, row))) hi = mid; else lo = mid;
  }
  return lo;
}

/**
 * Fill one strip mesh's buffers for rows [from, to): 4 vertices per row (top-left, top-right, bottom-right,
 * bottom-left), positions in screen px, UVs = (cells - (ox, oy)) / (mapW, mapH): the whole map, or the near window's
 * square from its origin. A row that misses the ground is collapsed to zero height at its top edge (it draws
 * nothing). `positions` and `uvs` hold (to - from) x 8 floats.
 */
export function fillStrips(p: ViewParams, table: RowTable, from: number, to: number, mapW: number, mapH: number,
  positions: Float32Array, uvs: Float32Array, width = SCREEN_W, ox = 0, oy = 0): void {
  for (let r = from; r < to; r++) {
    const o = (r - from) * 8;
    const sTop = table.s[r];
    const sBot = table.s[r + 1];
    const hit = !Number.isNaN(sTop) && !Number.isNaN(sBot);
    const yBot = hit ? r + 1 : r;
    positions[o] = 0; positions[o + 1] = r;
    positions[o + 2] = width; positions[o + 3] = r;
    positions[o + 4] = width; positions[o + 5] = yBot;
    positions[o + 6] = 0; positions[o + 7] = yBot;
    if (!hit) { uvs.fill(0, o, o + 8); continue; }
    const top = p.py + p.back - table.d[r] - oy;
    const bot = p.py + p.back - table.d[r + 1] - oy;
    const lt = p.px - (p.cx * sTop) / p.f - ox;
    const rt = p.px + ((width - p.cx) * sTop) / p.f - ox;
    const lb = p.px - (p.cx * sBot) / p.f - ox;
    const rb = p.px + ((width - p.cx) * sBot) / p.f - ox;
    uvs[o] = lt / mapW; uvs[o + 1] = top / mapH;
    uvs[o + 2] = rt / mapW; uvs[o + 3] = top / mapH;
    uvs[o + 4] = rb / mapW; uvs[o + 5] = bot / mapH;
    uvs[o + 6] = lb / mapW; uvs[o + 7] = bot / mapH;
  }
}

/** Collapse rows [from, to) of a strip buffer that starts at row `base` to zero height (they draw nothing). */
export function collapseRows(positions: Float32Array, from: number, to: number, base = 0): void {
  for (let r = Math.max(from, base); r < to; r++) {
    const o = (r - base) * 8;
    positions[o + 5] = positions[o + 1];
    positions[o + 7] = positions[o + 1];
  }
}

/** Whether row r hits the ground and its whole span lies inside the cell square [x0, x0 + cells) x [y0, y0 + cells). */
export function rowFits(p: ViewParams, table: RowTable, r: number, x0: number, y0: number, cells: number,
  width = SCREEN_W): boolean {
  const sTop = table.s[r];
  const sBot = table.s[r + 1];
  if (Number.isNaN(sTop) || Number.isNaN(sBot)) return false;
  const s = Math.max(sTop, sBot);   // the wider edge
  const left = p.px - (p.cx * s) / p.f;
  const right = p.px + ((width - p.cx) * s) / p.f;
  const far = p.py + p.back - Math.max(table.d[r], table.d[r + 1]);
  const near = p.py + p.back - Math.min(table.d[r], table.d[r + 1]);
  return left >= x0 && right <= x0 + cells && far >= y0 && near <= y0 + cells;
}

/**
 * The near mesh's first row (3.2): the first row nearer than `dist` cells ahead of C, moved down past any row whose
 * span leaves the window (so the near texture is never sampled outside its square); `rows` when no row qualifies.
 */
export function nearSplit(p: ViewParams, table: RowTable, dist: number, x0: number, y0: number, cells: number,
  rows = SCREEN_H, width = SCREEN_W): number {
  const from = splitRow(p, dist, rows);
  for (let r = rows - 1; r >= from; r--) if (!rowFits(p, table, r, x0, y0, cells, width)) return r + 1;
  return from;
}

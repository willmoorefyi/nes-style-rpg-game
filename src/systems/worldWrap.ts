/**
 * The world wrap (pass WR, docs/WORLD_WRAP_PLAN.md 3): a map with `wrap: true` is a torus, as FF1's world is. This
 * pure module does the wrap maths for the game, the field rules and the verifier. On a flat map every function behaves
 * exactly as the inline code it replaced (bounds tests, plain differences).
 *
 * Cells are canonical (0 <= x < width, 0 <= y < height) everywhere except drawing: an unwrapped value (the hero
 * mid-step, a chunk drawn left of column 0) is only ever a draw position.
 */
import type { MapData } from '../types/index.js';

export type MapLike = Pick<MapData, 'width' | 'height' | 'wrap'>;
export interface Cell { x: number; y: number }

/** The least distance a wrapped world keeps between any non-Water cell and an edge (layouts/world_api.SEAM_MARGIN). */
export const SEAM_MARGIN = 4;

export function wraps(map: Pick<MapData, 'wrap'>): boolean {
  return map.wrap === true;
}

/** ((v % n) + n) % n, for integers (and whole-valued floats). */
export function mod(v: number, n: number): number {
  return ((v % n) + n) % n;
}

/** The signed shortest b - a on a ring of n, in [-n/2, n/2); with n = 0 (a flat axis) it is b - a. */
export function wrapDelta(a: number, b: number, n: number): number {
  const d = b - a;
  if (n <= 0) return d;
  const h = n / 2;
  return mod(d + h, n) - h;
}

/** The canonical cell; null when (x, y) is off a flat map. */
export function canonCell(map: MapLike, x: number, y: number): Cell | null {
  if (map.wrap === true) return { x: mod(x, map.width), y: mod(y, map.height) };
  return x >= 0 && x < map.width && y >= 0 && y < map.height ? { x, y } : null;
}

/** `canonCell` of a cell object, returning the same object when it is already canonical (hot paths). */
export function canonOf<C extends Cell>(map: MapLike, c: C): C | Cell | null {
  if (c.x >= 0 && c.x < map.width && c.y >= 0 && c.y < map.height) return c;
  return canonCell(map, c.x, c.y);
}

/** The canonical cell's index y * W + x; -1 off a flat map (hot path, no allocation). */
export function cellIndex(map: MapLike, x: number, y: number): number {
  const w = map.width;
  const h = map.height;
  if (map.wrap === true) return mod(y, h) * w + mod(x, w);
  return x >= 0 && x < w && y >= 0 && y < h ? y * w + x : -1;
}

/** The neighbour (x + dx, y + dy), canonical; null off a flat map. Callers keep their own direction order. */
export function stepTo(map: MapLike, c: Cell, dx: number, dy: number): Cell | null {
  return canonCell(map, c.x + dx, c.y + dy);
}

/** The index of the neighbour (x + dx, y + dy) of a canonical cell (|dx|, |dy| <= 1), or -1 off a flat map. It compares
 *  and adds; it never calls `%`. */
export function stepIndex(map: MapLike, x: number, y: number, dx: number, dy: number): number {
  const w = map.width;
  const h = map.height;
  let nx = x + dx;
  let ny = y + dy;
  if (map.wrap === true) {
    if (nx < 0) nx += w; else if (nx >= w) nx -= w;
    if (ny < 0) ny += h; else if (ny >= h) ny -= h;
  } else if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
    return -1;
  }
  return ny * w + nx;
}

/** 4-adjacent, across the seam on a wrapped map. */
export function isStep(map: MapLike, from: Cell, to: Cell): boolean {
  if (map.wrap !== true) return Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1;
  const dx = Math.abs(wrapDelta(from.x, to.x, map.width));
  const dy = Math.abs(wrapDelta(from.y, to.y, map.height));
  return dx + dy === 1;
}

function axisDeltas(map: MapLike, a: Cell, b: Cell): [number, number] {
  const wrap = map.wrap === true;
  return [wrapDelta(a.x, b.x, wrap ? map.width : 0), wrapDelta(a.y, b.y, wrap ? map.height : 0)];
}

export function torusManhattan(map: MapLike, a: Cell, b: Cell): number {
  const [dx, dy] = axisDeltas(map, a, b);
  return Math.abs(dx) + Math.abs(dy);
}

export function torusHypot(map: MapLike, a: Cell, b: Cell): number {
  const [dx, dy] = axisDeltas(map, a, b);
  return Math.hypot(dx, dy);
}

/** The image of x nearest `centre` on a period p (0: none): x + p * round((centre - x) / p). */
export function nearestImage(x: number, centre: number, p: number): number {
  if (p <= 0) return x;
  return x + p * Math.round((centre - x) / p);
}

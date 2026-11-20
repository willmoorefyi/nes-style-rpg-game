/**
 * Shared reads for the NW act-1 tests (docs/NATURAL_WORLD_PLAN.md 3.6, 7; NW-3). Committed sources only: today's world
 * source `assets-src/maps/overworld.yaml` and the NW world source `assets-src/maps-nw/overworld.yaml`, both as legend
 * chars. Act 1's pins keep today's cells relative to Cornelia: an act-1 cell p of today's world is p + DELTA on the
 * NW world (CORNELIA_NW (146, 155) = today's (92, 111) + (54, 44)).
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type XY = [number, number];
interface Patch { id: string; flag: string; ground: string; cells: XY[] }
export interface Src {
  ground: string;
  entrances: Record<string, XY>;
  transitions: { x: number; y: number; targetMap: string; targetEntrance?: string }[];
  keyItemGates?: { id?: string; x: number; y: number; requiredFlag: string }[];
  objects?: { type: string; name?: string; x: number; y: number }[];
  inspect?: { x: number; y: number; text: unknown }[];
  npcs?: { id: string; x: number; y: number; [k: string]: unknown }[];
  vehicles?: { type: string; x: number; y: number; requiredFlag?: string }[];
  patches: Patch[];
  docks: { id: string; x: number; y: number; basin: string }[];
  spots: Record<string, { at: XY; kind: string }>;
  road_check?: { materials: string[]; ends: XY[]; no_stubs?: boolean };
  world: { basins: Record<string, XY> };
  /** NW-R: a region's land on the owner grid as row rects (`regions.<r>.land`, written by the regions that place
   * content) */
  regions?: Record<string, { land?: [number, number, number, number][] }>;
}

export const DELTA: XY = [54, 44];
export const CORNELIA_NW: XY = [146, 155];
/** Act 1's entrances (today's names, kept on the NW world). */
export const ACT1 = ['cornelia', 'cornelia_west', 'cornelia_east', 'cornelia_north', 'castle', 'north_shore', 'temple',
  'a1_matoya', 'a1_pravoka'];
/** today's act-1 content box (`a1/world_a1_derive.py`: x 64-141, y 64-145). */
export const inAct1 = ([x, y]: XY): boolean => x >= 64 && x <= 141 && y >= 64 && y <= 145;
export const pin = ([x, y]: XY): XY => [x + DELTA[0], y + DELTA[1]];

const read = (path: string): Src => parse(readFileSync(path, 'utf-8')) as Src;
export const today = read('assets-src/maps/overworld.yaml');
export const nw = read('assets-src/maps-nw/overworld.yaml');
export const grid = (s: Src): string[][] => s.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);

const BLOCK = new Set(['o', 'm', 'r', '≈']);
export const walkable = (c: string): boolean => !BLOCK.has(c);

/** The ground with the bridge patch on (its cells `=`) or with its gap rows (the first 4 cells) open Water. */
export function withBridge(s: Src, on: boolean): string[][] {
  const g = grid(s);
  const p = s.patches.find((q) => q.id === 'north_bridge')!;
  p.cells.forEach(([x, y], i) => { if (on) g[y][x] = '='; else if (i < 4) g[y][x] = 'o'; });
  return g;
}

/** BFS steps on foot from `from` (Infinity when unreachable), 4-connected. */
export function steps(g: string[][], from: XY, ok: (c: string) => boolean = walkable): number[][] {
  const h = g.length, w = g[0].length;
  const d = g.map((r) => r.map(() => Infinity));
  d[from[1]][from[0]] = 0;
  const q: XY[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || d[ny][nx] !== Infinity || !ok(g[ny][nx])) continue;
      d[ny][nx] = d[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

export const reach = (g: string[][], a: XY, b: XY): boolean => steps(g, a)[b[1]][b[0]] !== Infinity;
export const size = (g: string[][], a: XY): number => steps(g, a).flat().filter((v) => v !== Infinity).length;
export const key = ([x, y]: XY): string => `${x},${y}`;

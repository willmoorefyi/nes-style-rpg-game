/**
 * The committed world source (`assets-src/maps/overworld.yaml`) as a ground grid, with the masks and the walks the
 * composer's checks use (`assets-src/tools/worldgen/gates.py`: `with_patches`, `walk`, `canoe`, `LANDING`; `geom.bfs_dist`),
 * for the NW2 tests that re-derive a `world.py` check line in TypeScript (`northHikes`, `dockTowns`). Places are read
 * by name through `worldSpots.ts`, never as literal cells.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';

export type XY = { x: number; y: number };

/** The parts of the world source these tests read (a source patch names its legend `ground`, not a terrain). */
export interface WorldSource extends Pick<MapData, 'id' | 'spots' | 'entrances' | 'docks' | 'keyItemGates'> {
  ground: string;
  patches: { id: string; flag: string; ground: string; cells: [number, number][] }[];
  transitions: { x: number; y: number; targetMap: string }[];
  world: { basins: Record<string, [number, number]> };
}

export function loadWorldSource(path = 'assets-src/maps/overworld.yaml'): WorldSource {
  return parse(readFileSync(path, 'utf-8')) as WorldSource;
}

/** On foot: Water, mountain, river and lake block (`gates.BLOCK`); the canoe adds river and lake. */
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const RIVER = new Set(['r', '≈']);
/** The airship lands on grass only (`gates.LANDING`). */
export const LANDING = '.';

export class WorldGrid {
  readonly w: number;
  readonly h: number;
  readonly cells: string[][];

  constructor(rows: string[][]) {
    this.cells = rows;
    this.h = rows.length;
    this.w = rows[0]?.length ?? 0;
  }

  /** The source's ground with the patches as `gates.with_patches` sets them: the bridge on (its ground) or its gap
   *  open (its first 4 cells Water), the canal on (Water) or off (the saddle's own ground). */
  static of(src: WorldSource, opts: { bridge?: boolean; canal?: boolean } = {}): WorldGrid {
    const rows = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
    const grid = new WorldGrid(rows);
    for (const p of src.patches ?? []) {
      const on = p.id === 'canal' ? opts.canal ?? true : opts.bridge ?? true;
      if (on) for (const [x, y] of p.cells) rows[y][x] = p.ground;
      else if (p.id !== 'canal') for (const [x, y] of p.cells.slice(0, 4)) rows[y][x] = 'o';
    }
    return grid;
  }

  at(x: number, y: number): string { return this.cells[y]?.[x] ?? 'o'; }
  set(c: XY, ch: string): void { this.cells[c.y][c.x] = ch; }
  walk = (x: number, y: number): boolean => !BLOCK.has(this.at(x, y));
  canoe = (x: number, y: number): boolean => this.walk(x, y) || RIVER.has(this.at(x, y));
  water = (x: number, y: number): boolean => this.at(x, y) === 'o';

  /** BFS steps from `from` over `pass` (4-connected), -1 where unreached (`geom.bfs_dist`). */
  dist(from: XY[], pass: (x: number, y: number) => boolean): Int32Array {
    const d = new Int32Array(this.w * this.h).fill(-1);
    let q: XY[] = [];
    for (const c of from) {
      if (c.x < 0 || c.y < 0 || c.x >= this.w || c.y >= this.h || !pass(c.x, c.y) || d[c.y * this.w + c.x] >= 0) continue;
      d[c.y * this.w + c.x] = 0;
      q.push(c);
    }
    for (let n = 1; q.length; n++) {
      const next: XY[] = [];
      for (const { x, y } of q) {
        for (const [dx, dy] of D4) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || d[ny * this.w + nx] >= 0 || !pass(nx, ny)) continue;
          d[ny * this.w + nx] = n;
          next.push({ x: nx, y: ny });
        }
      }
      q = next;
    }
    return d;
  }

  steps(d: Int32Array, c: XY): number { return d[c.y * this.w + c.x]; }
}

export const D4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A cell's 4-neighbours (a dock's shore cells, `prewalk.ship_docks` starts). */
export function around(c: XY): XY[] {
  return D4.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
}

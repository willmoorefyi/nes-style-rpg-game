/**
 * NW-4 (docs/NATURAL_WORLD_PLAN.md 3.4, 3.8, 4.5): what the composer v2 writes for the gates and for `--region`,
 * read from the committed source `assets-src/maps/overworld.yaml` (as every NW world test, moved from `tests/nw/` at NW-5).
 * - `regions.<r>.raster`: chunk-aligned rects per region whose union is every chunk of the 256x256 world;
 * - `world.cuts`: the walls' and barriers' minimal cuts. Each one, and only it, opens its gate: a wall's cut set to
 *   Water joins the Aldi to the ocean (every patch off), a barrier's set to grass joins its seeds on foot; the spine's
 *   cut lies in the north bridge's patch cells. The mutation rows GT-13 / GT-35 open these cuts (`cutOpen`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Src {
  ground: string;
  entrances: Record<string, XY>;
  patches: { id: string; cells: XY[] }[];
  regions: Record<string, { raster: [number, number, number, number][] }>;
  world: { basins: Record<string, XY>; cuts: Record<string, XY[]> };
}

const src = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Src;
const N = 256;
const C = 16;
const ground = (): string[][] => src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const WALK_BLOCK = new Set(['o', 'm', 'r', '≈']);
const E = src.entrances;

function flood(g: string[][], from: XY, pass: (c: string) => boolean): Set<number> {
  const seen = new Set<number>([from[1] * N + from[0]]);
  const q: XY[] = [from];
  while (q.length) {
    const [x, y] = q.pop() as XY;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(ny * N + nx) || !pass(g[ny][nx])) continue;
      seen.add(ny * N + nx);
      q.push([nx, ny]);
    }
  }
  return seen;
}

const seas = (g: string[][]): boolean => flood(g, src.world.basins.aldi, (c) => c === 'o').has(2 * N + 2);
const walks = (g: string[][], a: XY, b: XY): boolean => flood(g, a, (c) => !WALK_BLOCK.has(c)).has(b[1] * N + b[0]);
const set = (g: string[][], cells: XY[], ch: string): string[][] => {
  for (const [x, y] of cells) g[y][x] = ch;
  return g;
};
const bridge = src.patches.find((p) => p.id === 'north_bridge')?.cells ?? [];

describe('the NW world gates (NW-4)', () => {
  it('each region has a chunk-aligned raster; together they hold every chunk', () => {
    expect(Object.keys(src.regions).sort()).toEqual(['a1', 'earth', 'elf', 'fire', 'ordeal', 'water', 'wind']);
    const seen = new Set<string>();
    for (const [r, { raster }] of Object.entries(src.regions)) {
      expect(raster.length, r).toBeGreaterThan(0);
      for (const [x0, y0, x1, y1] of raster) {
        expect([x0 % C, y0 % C, (x1 + 1) % C, (y1 + 1) % C], r).toEqual([0, 0, 0, 0]);
        expect(y1 - y0 + 1, r).toBe(C);
        for (let x = x0; x <= x1; x += C) seen.add(`${x / C},${y0 / C}`);
      }
    }
    expect(seen.size).toBe((N / C) * (N / C));
  });

  it('the cuts: 5 walls, the spine, western_range and crescent_ring', () => {
    expect(Object.keys(src.world.cuts).sort()).toEqual(
      ['W_arm', 'W_east', 'W_isthmus', 'W_south', 'W_west', 'crescent_ring', 'spine', 'western_range']);
    for (const cells of Object.values(src.world.cuts)) expect(cells.length).toBeGreaterThan(0);
  });

  it('with every patch off the Aldi and the ocean are apart; each wall cut opened to Water joins them', () => {
    expect(seas(ground())).toBe(false);
    for (const w of ['W_west', 'W_isthmus', 'W_arm', 'W_south', 'W_east']) {
      expect(seas(set(ground(), src.world.cuts[w], 'o')), w).toBe(true);
    }
  });

  it('each barrier cut opened to grass joins its seeds on foot; the spine cut lies in the bridge patch', () => {
    const on = (): string[][] => set(ground(), bridge, '=');
    expect(walks(ground(), E.cornelia, E.a1_pravoka)).toBe(false);
    expect(walks(on(), E.cornelia, E.a1_pravoka)).toBe(true);
    expect(walks(set(ground(), src.world.cuts.spine, '.'), E.cornelia, E.a1_pravoka)).toBe(true);
    const inBridge = new Set(bridge.map(([x, y]) => y * N + x));
    expect(src.world.cuts.spine.every(([x, y]) => inBridge.has(y * N + x))).toBe(true);
    expect(walks(on(), E.ert_melmond, E.ert_sarda)).toBe(false);
    expect(walks(set(on(), src.world.cuts.western_range, '.'), E.ert_melmond, E.ert_sarda)).toBe(true);
    const south = [E.fir_volcano, E.fir_ice, E.fir_desert];
    expect(south.some((s) => walks(on(), E.fir_crescent, s))).toBe(false);
    const opened = set(on(), src.world.cuts.crescent_ring, '.');
    expect(south.some((s) => walks(opened, E.fir_crescent, s))).toBe(true);
  });
});

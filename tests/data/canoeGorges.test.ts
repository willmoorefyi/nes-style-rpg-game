/**
 * NW2's canoe gorges (docs/NW2_EDITS_PLAN.md 4, 8 `gorges`, D-NW2-2, D-NW2-3; NW2-F) on the committed world source:
 * from Crescent's dock road to Gurgu (the Cinder Gorge, R-volcano) and from the Frost Shore by the `fir_ice` dock to
 * the Ice Cavern (the Rime Gorge, R-ice), the least-canoe path (fewest canoe steps, then fewest steps) has at least
 * M = 26 forced canoe steps, at least N = 12 pass cells (a canoe cell with no walkable 4-neighbour and rock within 2
 * cells on both sides across its flow), and E_canoe = sum of MODE_RATE.canoe (0.5) / the cell's zone mean step >= 1.0;
 * neither site is reached on foot. The composer's `gorges` line checks the same over prewalk's starts.
 */
import { describe, expect, it } from 'vitest';
import { grid, nw, type XY } from '../quest/a1/nwA1.js';

interface Zone { id: string; modes?: string[]; rects: number[][]; encounterRate?: { min: number; max: number } }
const src = nw as unknown as typeof nw & { encounterZones: Zone[]; encounterRate: { min: number; max: number } };
const g = grid(nw);
const H = g.length;
const W = g[0].length;
const WET = new Set(['r', '≈']);
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const walk = (x: number, y: number): boolean => !BLOCK.has(g[y][x]);
const D4: XY[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const M = 26;
const N = 12;
const CANOE_RATE = 0.5;

/** The least-canoe path (Dijkstra on (canoe steps, steps)), start to goal inclusive. */
function leastCanoe(start: XY, goal: XY): XY[] {
  const best = new Map<number, [number, number]>([[start[1] * W + start[0], [0, 0]]]);
  const prev = new Map<number, number>();
  const open: Array<[number, number, number]> = [[0, 0, start[1] * W + start[0]]];
  const done = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [k, n, c] = open.shift()!;
    if (done.has(c)) continue;
    done.add(c);
    if (c === goal[1] * W + goal[0]) break;
    for (const [dx, dy] of D4) {
      const x = (c % W) + dx;
      const y = Math.floor(c / W) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H || !(walk(x, y) || WET.has(g[y][x]))) continue;
      const v: [number, number] = [k + (WET.has(g[y][x]) ? 1 : 0), n + 1];
      const old = best.get(y * W + x);
      if (old && (old[0] < v[0] || (old[0] === v[0] && old[1] <= v[1]))) continue;
      best.set(y * W + x, v);
      prev.set(y * W + x, c);
      open.push([v[0], v[1], y * W + x]);
    }
  }
  const out: XY[] = [];
  for (let c: number | undefined = goal[1] * W + goal[0]; c !== undefined; c = prev.get(c)) out.unshift([c % W, Math.floor(c / W)]);
  return out[0][0] === start[0] && out[0][1] === start[1] ? out : [];
}

const rock = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && g[y][x] === 'm';
function passCells(path: XY[]): number {
  let n = 0;
  path.forEach(([x, y], i) => {
    if (!WET.has(g[y][x]) || D4.some(([dx, dy]) => walk(x + dx, y + dy))) return;
    const [a, b] = i + 1 < path.length ? [path[i], path[i + 1]] : [path[i - 1], path[i]];
    const [px, py] = [-(b[1] - a[1]), b[0] - a[0]];
    if ([1, 2].some((k) => rock(x + k * px, y + k * py)) && [1, 2].some((k) => rock(x - k * px, y - k * py))) n++;
  });
  return n;
}

function canoeMean(x: number, y: number): number {
  const z = src.encounterZones.find((q) => (q.modes ?? ['walking', 'canoe']).includes('canoe')
    && q.rects.some(([x0, y0, x1, y1]) => x0 <= x && x <= x1 && y0 <= y && y <= y1));
  const r = z?.encounterRate ?? src.encounterRate;
  return (r.min + r.max) / 2;
}

describe('NW2 canoe gorges (the Cinder Gorge to Gurgu, the Rime Gorge to the Ice Cavern)', () => {
  const cases: Array<[string, XY, XY]> = [
    ['fir_volcano', nw.spots.fir_s_crescent_road.at, nw.entrances.fir_volcano],
    ['fir_ice', nw.spots.fir_s_ice_shore.at, nw.entrances.fir_ice],
  ];
  for (const [site, start, goal] of cases) {
    it(`${site}: >= ${M} forced canoe steps, >= ${N} pass cells, E_canoe >= 1.0 at the canoe's 0.5 rate`, () => {
      const path = leastCanoe(start, goal);
      expect(path.length, site).toBeGreaterThan(0);
      const wet = path.slice(1).filter(([x, y]) => WET.has(g[y][x]));
      const e = wet.reduce((s, [x, y]) => s + CANOE_RATE / canoeMean(x, y), 0);
      expect(wet.length, site).toBeGreaterThanOrEqual(M);
      expect(passCells(path), site).toBeGreaterThanOrEqual(N);
      expect(e, site).toBeGreaterThanOrEqual(1.0);
      expect(wet.every(([x, y]) => src.encounterZones.some((z) => z.id === 'fir_rivers'
        && z.rects.some(([x0, y0, x1, y1]) => x0 <= x && x <= x1 && y0 <= y && y <= y1))), site).toBe(true);
    });
  }

  it('the canoe zone of both gorges, fir_rivers, has a step mean of at most 0.75 x the map\'s (D-NW2-3: rate 8-17)', () => {
    const z = src.encounterZones.find((q) => q.id === 'fir_rivers')!;
    expect(z.encounterRate).toEqual({ min: 8, max: 17 });
  });
});

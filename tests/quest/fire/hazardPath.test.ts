/**
 * The hazard-free route rule (docs/WORLD_PLAN.md 4.0.2; FIR-D1): on every Gurgu Volcano floor with lava, from each
 * way in (the arrival, and B2's west landing) to each way on (the stairs down, and on B5 the boss approach), the
 * shortest path that never steps on a hazard cell is at most 1.5x the shortest path. On B4 the short way is the one
 * over the lava (4.4), so there the dry way is strictly longer. Paths are 4-connected walking steps on the compiled
 * collision, round the static NPCs (chests), never through a transition.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { baseTerrain, hazardAt, terrainAllows } from '../../../src/systems/fieldRules.js';
import type { MapData } from '../../../src/types/index.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const FLOORS = [1, 2, 3, 4, 5].map((i) => map(`gurgu-b${i}`));

/** Walking steps from `from` to every cell (dry: no hazard cell entered). */
function steps(m: MapData, from: [number, number], dry: boolean): Map<string, number> {
  const npc = new Set(m.npcs.map((n) => `${n.x},${n.y}`));
  const trans = new Set(m.transitions.map((t) => `${t.x},${t.y}`));
  const d = new Map([[`${from[0]},${from[1]}`, 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (d.has(k) || nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || npc.has(k)) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      if (dry && hazardAt(m, { x: nx, y: ny })) continue;
      d.set(k, d.get(`${x},${y}`)! + 1);
      if (!trans.has(k)) q.push([nx, ny]);
    }
  }
  return d;
}

/** The nearest cell of `cells` in `d`, or Infinity. */
const near = (d: Map<string, number>, cells: string[]): number => Math.min(...cells.map((c) => d.get(c) ?? Infinity));

function routes(m: MapData): Array<{ from: string; to: string; cells: string[] }> {
  const k = Number(m.id.slice(-1));
  const ins = ['arrival', ...(m.id === 'gurgu-b2' ? ['west'] : [])];
  const outs: Array<{ to: string; cells: string[] }> = [];
  const down = m.transitions.filter((t) => t.targetMap === `gurgu-b${k + 1}`);
  for (const e of new Set(down.map((t) => t.targetEntrance!))) {
    outs.push({ to: `gurgu-b${k + 1}:${e}`, cells: down.filter((t) => t.targetEntrance === e).map((t) => `${t.x},${t.y}`) });
  }
  if (m.entrances?.boss) outs.push({ to: 'boss', cells: [m.entrances.boss.join(',')] });
  return ins.flatMap((from) => outs.map((o) => ({ from, ...o })));
}

describe('FIR-D1: Gurgu Volcano keeps a hazard-free route (WORLD 4.0.2)', () => {
  it('every floor has one hazard, its lava (damage 1), on walkable cells', () => {
    for (const m of FLOORS) {
      expect(m.hazards?.length, m.id).toBe(1);
      const h = m.hazards![0];
      expect(h.damage).toBe(1);
      for (const [x0, y0, x1, y1] of h.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        expect(terrainAllows('walking', baseTerrain(m, x, y)), `${m.id} ${x},${y}`).toBe(true);
      }
    }
  });

  for (const m of FLOORS) {
    it(`${m.id}: each way on has a dry path at most 1.5x the shortest`, () => {
      const rs = routes(m);
      expect(rs.length, m.id).toBeGreaterThan(0);
      for (const r of rs) {
        const from = m.entrances![r.from];
        const all = near(steps(m, from, false), r.cells);
        const dry = near(steps(m, from, true), r.cells);
        expect(all, `${m.id} ${r.from} -> ${r.to}`).toBeLessThan(Infinity);
        expect(dry, `${m.id} ${r.from} -> ${r.to}: dry ${dry} vs ${all}`).toBeLessThanOrEqual(1.5 * all);
      }
    });
  }

  it('gurgu-b4: the short way crosses the lava, the dry way is longer (measured 74 vs 57 steps)', () => {
    const m = FLOORS[3];
    const cells = m.transitions.filter((t) => t.targetMap === 'gurgu-b5').map((t) => `${t.x},${t.y}`);
    const all = near(steps(m, m.entrances!.arrival, false), cells);
    const dry = near(steps(m, m.entrances!.arrival, true), cells);
    expect(dry).toBeGreaterThan(all + 10);
  });
});

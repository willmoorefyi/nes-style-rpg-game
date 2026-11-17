/**
 * Region ORDEAL on the compiled world (docs/WORLD_PLAN.md 2.2, 2.8, 4.5, 6.2 T6; ORD-O): the anchors at their
 * targets, airship-only land (no dock, no land path from any other region), a grass landing cell within 8 steps of
 * each anchor, the six isles, the zones and their cover, the hermit's slate and the doors into the citadel and the
 * cave.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType } from '../../../src/types/index.js';

interface Zone { id: string; rects: number[][]; modes?: string[]; name?: string }
interface Compiled {
  width: number; height: number; collision: number[];
  entrances: Record<string, [number, number]>;
  encounterZones: Zone[];
  docks: Array<{ id: string; x: number; y: number }>;
  transitions: Array<{ x: number; y: number; targetMap: string; targetEntrance?: string }>;
  inspect: Array<{ x: number; y: number; text: unknown[] }>;
  npcs: Array<{ id: string; x: number; y: number }>;
}
const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as Compiled;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; target: [number, number]; region: string }> }).anchors;
const W = world.width;
const coll = (x: number, y: number): number => world.collision[y * W + x];
const WALK = new Set<number>([TerrainType.Grass, TerrainType.Forest, TerrainType.Desert, TerrainType.Swamp, TerrainType.Road, TerrainType.Bridge]);
const inOrdeal = (x: number, y: number): boolean => x >= 64 && x <= 127 && y >= 0 && y <= 63;
const ISLES = ['ord_bahamut', 'ord_isle_hermit', 'ord_isle_north', 'ord_isle_east', 'ord_isle_stack', 'ord_isle_west'];

/** Steps from `from` to every walkable cell, 4-connected. */
function bfs(from: [number, number]): Map<string, number> {
  const dist = new Map<string, number>([[`${from[0]},${from[1]}`, 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= W || ny >= world.height || dist.has(k) || !WALK.has(coll(nx, ny))) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      q.push([nx, ny]);
    }
  }
  return dist;
}
const cells = (z: Zone): string[] => z.rects.flatMap(([x0, y0, x1, y1]) => {
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(`${x},${y}`);
  return out;
});

describe('ORDEAL on the world (ORD-O)', () => {
  it('both ORDEAL anchors are entrances within 2 cells of their 2.2 targets', () => {
    const own = anchors.filter((a) => a.region === 'ordeal');
    expect(own.map((a) => a.entrance).sort()).toEqual(['ord_bahamut', 'ord_citadel']);
    for (const a of own) {
      const e = world.entrances[a.entrance];
      expect(e, a.entrance).toBeDefined();
      expect(Math.max(Math.abs(e[0] - a.target[0]), Math.abs(e[1] - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
  });

  it('is airship-only: no dock in the box, and no walk from the plateau or an isle leaves it or joins another', () => {
    expect(world.docks.filter((d) => inOrdeal(d.x, d.y))).toEqual([]);
    const reach = ['ord_citadel', ...ISLES].map((e) => bfs(world.entrances[e]));
    for (const r of reach) for (const k of r.keys()) expect(inOrdeal(...(k.split(',').map(Number) as [number, number])), k).toBe(true);
    for (let i = 0; i < reach.length; i++) for (let j = i + 1; j < reach.length; j++) {
      expect([...reach[i].keys()].some((k) => reach[j].has(k)), `${i} meets ${j}`).toBe(false);
    }
  });

  it('every anchor and isle has a grass landing cell within 8 steps (T6), the citadel\'s on its meadow', () => {
    const blocked = new Set([...world.transitions, ...world.npcs].map((t) => `${t.x},${t.y}`));
    for (const e of ['ord_citadel', ...ISLES]) {
      const near = [...bfs(world.entrances[e])].filter(([k, d]) => {
        const [x, y] = k.split(',').map(Number);
        return d <= 8 && coll(x, y) === TerrainType.Grass && !blocked.has(k);
      });
      expect(near.length, e).toBeGreaterThan(0);
    }
    const [cx, cy] = world.entrances.ord_citadel;
    for (let y = cy + 1; y <= cy + 5; y++) expect(coll(cx, y), `meadow (${cx}, ${y})`).toBe(TerrainType.Grass);
  });

  it('the doors lead into the citadel and the cave, one step north of each anchor', () => {
    for (const [e, map] of [['ord_citadel', 'citadel-1f'], ['ord_bahamut', 'bahamut-cave']] as const) {
      const [x, y] = world.entrances[e];
      expect(world.transitions.find((t) => t.x === x && t.y === y - 1), e).toMatchObject({ targetMap: map, targetEntrance: 'arrival' });
    }
  });

  it('zones: the heath on the plateau, the isles, the sound on every water cell; each cell in one zone', () => {
    const zones = world.encounterZones.filter((z) => z.id.startsWith('ord_'));
    expect(zones.map((z) => [z.id, z.name, z.modes])).toEqual([
      ['ord_heath', 'Citadel Heath', ['walking']], ['ord_isles', 'Cardia Isles', ['walking']], ['ord_sea', 'Cardia Sound', ['ship']]]);
    const of = new Map<string, string[]>();
    for (const z of zones) for (const k of cells(z)) of.set(k, [...(of.get(k) ?? []), z.id]);
    const plateau = bfs(world.entrances.ord_citadel);
    for (let y = 0; y <= 63; y++) for (let x = 64; x <= 127; x++) {
      const k = `${x},${y}`; const t = coll(x, y);
      if (t === TerrainType.Water) expect(of.get(k), k).toEqual(['ord_sea']);
      else if (WALK.has(t)) expect(of.get(k), k).toEqual([plateau.has(k) ? 'ord_heath' : 'ord_isles']);
    }
  });

  it('the hermit\'s slate is an inspect cell reached on foot from its isle', () => {
    const slate = world.inspect.filter((c) => inOrdeal(c.x, c.y));
    expect(slate).toHaveLength(1);
    const isle = bfs(world.entrances.ord_isle_hermit);
    const { x, y } = slate[0];
    expect([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => isle.has(`${a},${b}`))).toBe(true);
    expect(JSON.stringify(slate[0].text)).toContain('Oddo');
  });
});

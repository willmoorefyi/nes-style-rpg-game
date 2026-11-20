/**
 * Region FIRE on the compiled world (docs/WORLD_PLAN.md 2.2, 2.7, 2.8, 4.4, 6.1; FIR-O): the anchors at their
 * targets, the ring and the rivers (no land path from Crescent's shore to the south lands; the canoe joins them,
 * within the detour factors), the ice-desert walk, the zones, the dock and the buried hull's hatch (S17).
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
  docks: Array<{ id: string; x: number; y: number; basin: string }>;
  npcs: Array<Record<string, unknown> & { id: string; x: number; y: number }>;
  world: { cuts: Record<string, Array<[number, number]>> };
}
const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as Compiled;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; target: [number, number]; region: string }> }).anchors;
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const W = world.width;
const coll = (x: number, y: number): number => world.collision[y * W + x];
const WALK = new Set<number>([TerrainType.Grass, TerrainType.Forest, TerrainType.Desert, TerrainType.Swamp, TerrainType.Road, TerrainType.Bridge]);
const CANOE = new Set<number>([TerrainType.River, TerrainType.Lake]);
const inFire = (x: number, y: number): boolean => (x >= 144 && y >= 64 && y <= 143) || (x >= 112 && y >= 144);

/** Steps from `from` to every cell, walking (and paddling, with the canoe), 4-connected. */
function bfs(from: [number, number], canoe: boolean, open: Set<string> = new Set()): Map<string, number> {
  const dist = new Map<string, number>([[`${from[0]},${from[1]}`, 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= W || ny >= world.height || dist.has(k)) continue;
      const t = coll(nx, ny);
      if (!(WALK.has(t) || open.has(k) || (canoe && CANOE.has(t)))) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      q.push([nx, ny]);
    }
  }
  return dist;
}
const key = (a: string): string => world.entrances[a].join(',');
const euclid = (a: string, b: string): number => Math.hypot(world.entrances[a][0] - world.entrances[b][0], world.entrances[a][1] - world.entrances[b][1]);
const SOUTH = ['fir_volcano', 'fir_ice', 'fir_desert'];

describe('FIRE on the world (FIR-O)', () => {
  it('every FIRE anchor is an entrance within 2 cells of its 2.2 target', () => {
    for (const a of anchors.filter((x) => x.region === 'fire')) {
      const e = world.entrances[a.entrance];
      expect(e, a.entrance).toBeDefined();
      expect(Math.max(Math.abs(e[0] - a.target[0]), Math.abs(e[1] - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
  });

  it('on foot Crescent\'s shore reaches none of the south lands; by canoe it reaches all three', () => {
    const walk = bfs(world.entrances.fir_crescent, false);
    const paddle = bfs(world.entrances.fir_crescent, true);
    for (const a of SOUTH) {
      expect(walk.has(key(a)), a).toBe(false);
      expect(paddle.has(key(a)), a).toBe(true);
    }
  });

  it('the detour factors of 6.1: crescent-volcano and crescent-ice by canoe, ice-desert on foot, at most 2.5x', () => {
    const paddle = bfs(world.entrances.fir_crescent, true);
    for (const a of ['fir_volcano', 'fir_ice']) expect(paddle.get(key(a))!, a).toBeLessThanOrEqual(2.5 * euclid('fir_crescent', a));
    expect(bfs(world.entrances.fir_ice, false).get(key('fir_desert'))!).toBeLessThanOrEqual(2.5 * euclid('fir_ice', 'fir_desert'));
  });

  it('the south lands are one land on foot (volcano, ice, desert)', () => {
    const walk = bfs(world.entrances.fir_ice, false);
    for (const a of SOUTH) expect(walk.has(key(a)), a).toBe(true);
  });

  it('opening the composer\'s crescent_ring cut joins the shore and the south lands on foot (GT-37)', () => {
    const cut = world.world.cuts.crescent_ring;
    expect(cut.length).toBeGreaterThan(0);
    const walk = bfs(world.entrances.fir_crescent, false, new Set(cut.map(([x, y]) => `${x},${y}`)));
    for (const a of SOUTH) expect(walk.has(key(a)), a).toBe(true);
  });

  it('the fir_crescent dock is ocean, with land next to it on the way to the gate', () => {
    const d = world.docks.find((x) => x.id === 'fir_crescent')!;
    expect(d.basin).toBe('ocean');
    expect(coll(d.x, d.y)).toBe(TerrainType.Water);
    expect(bfs([d.x + 1, d.y], false).has(key('fir_crescent'))).toBe(true);
  });

  it('every FIRE walkable cell is in a walking zone, every water cell in one ship zone, rivers in the canoe zone', () => {
    const fire = world.encounterZones.filter((z) => z.id.startsWith('fir_'));
    const holds = (x: number, y: number): Zone[] =>
      fire.filter((z) => z.rects.some(([x0, y0, x1, y1]) => x0 <= x && x <= x1 && y0 <= y && y <= y1));
    const bad: string[] = [];
    for (let y = 64; y < world.height; y++) for (let x = 112; x < W; x++) {
      if (!inFire(x, y)) continue;
      const t = coll(x, y);
      const zs = holds(x, y);
      if (WALK.has(t) && !zs.some((z) => z.modes?.includes('walking'))) bad.push(`walk (${x}, ${y})`);
      if (t === TerrainType.Water && zs.filter((z) => z.modes?.includes('ship')).length !== 1) bad.push(`water (${x}, ${y})`);
      if (CANOE.has(t) && !zs.some((z) => z.id === 'fir_rivers')) bad.push(`river (${x}, ${y})`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    for (const z of fire) expect(z.name, z.id).toBeTruthy();
  });

  it('the hatch takes the levistone and raises the airship onto grass (S17)', () => {
    const n = world.npcs.find((x) => x.id === 'fir_hull_hatch')!;
    expect([n.x, n.y + 1]).toEqual(world.entrances.fir_desert);
    expect(n.requiredItem).toBe('levistone');
    expect(n.hideIf).toBe('AIRSHIP_RAISED');
    expect(n.cutscene).toEqual({ id: 'fir_airship_rises', onceFlag: 'AIRSHIP_RAISED' });
    const steps = cutscenes.find((c) => c.id === 'fir_airship_rises')!.steps;
    expect(steps.filter((s) => s.type === 'take_item').map((s) => s.item)).toEqual(['levistone']);
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['AIRSHIP_RAISED']);
    const v = steps.find((s) => s.type === 'set_vehicle')!;
    expect(v).toMatchObject({ vehicle: 'airship', map: 'overworld', at: 'fir_s_airship' });    // NW-1: a spot
    const spot = (world as Compiled & { spots: Record<string, { at: [number, number]; kind: string }> }).spots.fir_s_airship;
    expect(spot).toEqual({ at: [149, 162], kind: 'landing' });
    const [x, y] = spot.at;
    expect(coll(x, y)).toBe(TerrainType.Grass);
    expect(bfs(world.entrances.fir_desert, false).has(`${x},${y}`)).toBe(true);
  });
});

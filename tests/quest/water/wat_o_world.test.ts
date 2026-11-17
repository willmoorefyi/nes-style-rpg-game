/**
 * Region WATER on the compiled world map (docs/WORLD_PLAN.md 2.2, 2.7, 2.8, 4.0.3, 4.6; WAT-O): the three anchors
 * at their targets, a grass landing within 8 steps of each, the cave behind the falls reached by canoe only (its
 * ledge joins no other land on foot and holds no grass for the airship), the river R-waterfall meeting the sea,
 * the doors, no dock, and the encounter zones (every walkable cell of the box in a walking zone, every Water cell
 * in exactly one ship zone once the compiler takes zone modes).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { FieldMode, MapData } from '../../../src/types/index.js';
import { TerrainType } from '../../../src/types/index.js';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';

const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  tolerance: number; anchors: Array<{ entrance: string; region: string; target: [number, number] }>;
}).anchors.filter((a) => a.region === 'water');
const BOX = { x0: 0, y0: 0, x1: 63, y1: 63 };
const inBox = (x: number, y: number): boolean => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1;
const key = (x: number, y: number): string => `${x},${y}`;
const t = (x: number, y: number): TerrainType => baseTerrain(world, x, y);
const ent = (name: string): [number, number] => world.entrances![name] as [number, number];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const doors = new Set(world.transitions.map((tr) => key(tr.x, tr.y)));

/** The cells a party reaches from `from` in the given modes (the canoe: River and Lake), stopping at doors. */
function reach(from: [number, number], modes: FieldMode[]): Set<string> {
  const seen = new Set([key(...from)]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (doors.has(key(x, y))) continue;
    for (const [dx, dy] of DIRS) {
      const [nx, ny] = [x + dx, y + dy];
      if (seen.has(key(nx, ny)) || !modes.some((m) => terrainAllows(m, t(nx, ny)))) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('WAT-O: the anchors and the airship landings', () => {
  it('the world is the 192x192 map and holds the three WATER anchors', () => {
    expect([world.width, world.height]).toEqual([192, 192]);
    expect(anchors.map((a) => a.entrance).sort()).toEqual(['wat_caravan', 'wat_onrac', 'wat_waterfall']);
  });

  for (const a of anchors) {
    it(`${a.entrance} is within 2 cells of its target ${a.target.join(', ')} and has grass within 8 steps`, () => {
      const [x, y] = ent(a.entrance);
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1]))).toBeLessThanOrEqual(2);
      expect(terrainAllows('walking', t(x, y))).toBe(true);
      let near = false;
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 8 && t(x + dx, y + dy) === TerrainType.Grass && !doors.has(key(x + dx, y + dy))) near = true;
      }
      expect(near).toBe(true);
    });
  }

  it('WATER has no dock (2.8: airship-only)', () => {
    expect((world.docks ?? []).filter((d) => inBox(d.x, d.y))).toEqual([]);
  });
});

describe('WAT-O: R-waterfall and the cave behind the falls (2.7)', () => {
  const ledge = reach(ent('wat_waterfall'), ['walking']);

  it('the ledge is a pocket of 3 cells that holds no grass: the airship cannot land on it', () => {
    const cells = [...ledge].filter((c) => !doors.has(c));
    expect(cells.length).toBe(3);
    for (const c of cells) expect(t(...(c.split(',').map(Number) as [number, number]))).not.toBe(TerrainType.Grass);
  });

  it('on foot the ledge joins nothing but the cave door; Onrac does not reach it without the canoe', () => {
    const doorsHit = [...ledge].filter((c) => doors.has(c));
    expect(doorsHit).toEqual(['30,10']);
    expect(world.transitions.find((tr) => tr.x === 30 && tr.y === 10)).toMatchObject({ targetMap: 'waterfall-cave', targetEntrance: 'arrival' });
    expect(reach(ent('wat_onrac'), ['walking']).has(key(...ent('wat_waterfall')))).toBe(false);
  });

  it('by canoe from Onrac\'s meadow the river reaches the ledge', () => {
    expect(reach(ent('wat_onrac'), ['walking', 'canoe']).has(key(...ent('wat_waterfall')))).toBe(true);
  });

  it('the river meets the sea at its mouth, so the ship cannot sail up it (River is not Water)', () => {
    const river: Array<[number, number]> = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (t(x, y) === TerrainType.River) river.push([x, y]);
    expect(river.length).toBeGreaterThan(30);
    expect(river.some(([x, y]) => DIRS.some(([dx, dy]) => t(x + dx, y + dy) === TerrainType.Water))).toBe(true);
  });

  it('the doors lead to the waterfall cave, the caravan camp and (once built) Onrac', () => {
    // Onrac's door opens once WAT-T's town map is built (a stub is never compiled)
    const onrac = !readFileSync('assets-src/maps/onrac.yaml', 'utf-8').split('\n', 1)[0].includes('STUB generated by stubs.py');
    const mine = world.transitions.filter((tr) => inBox(tr.x, tr.y)).map((tr) => `${tr.targetMap}:${tr.targetEntrance}`).sort();
    expect(mine).toEqual(['caravan-camp:arrival', ...(onrac ? ['onrac:gate'] : []), 'waterfall-cave:arrival']);
  });
});

describe('WAT-O: the encounter zones (4.0.3)', () => {
  const zones = (world.encounterZones ?? []).filter((z) => z.id.startsWith('wat_'));
  const holds = (z: (typeof zones)[number], x: number, y: number): boolean =>
    z.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const applies = (z: (typeof zones)[number], m: FieldMode): boolean => (z.modes ?? ['walking', 'canoe']).includes(m);

  it('every walkable cell of the box is in a walking zone of WATER, every River cell in a canoe zone', () => {
    const missing: string[] = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const tt = t(x, y);
      if (terrainAllows('walking', tt) && !zones.some((z) => applies(z, 'walking') && holds(z, x, y))) missing.push(key(x, y));
      if (tt === TerrainType.River && !zones.some((z) => applies(z, 'canoe') && holds(z, x, y))) missing.push(`river ${key(x, y)}`);
    }
    expect(missing).toEqual([]);
  });

  it('neighbouring zones share no species', () => {
    const species = (z: (typeof zones)[number]): Set<string> =>
      new Set(z.encounters.flatMap((e) => [...(e.enemies ?? []), ...(e.groups ?? []).map((g) => g.id)]));
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
      const a = species(zones[i]);
      expect([...species(zones[j])].filter((s) => a.has(s)), `${zones[i].id} / ${zones[j].id}`).toEqual([]);
    }
  });

  // BLOCKED (WAT-O result): the compiler refuses zone `modes` / `name` and a water-only zone, so `wat_sea` is
  // written only once map_checks_encounters.py takes them (world_water_zones.zone_keys_accepted)
  const shipZones = zones.filter((z) => z.modes?.includes('ship'));
  it.skipIf(shipZones.length === 0)('every Water cell of the box is in exactly one ship zone', () => {
    const bad: string[] = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (t(x, y) !== TerrainType.Water) continue;
      const n = (world.encounterZones ?? []).filter((z) => (z.modes ?? []).includes('ship') && holds(z, x, y)).length;
      if (n !== 1) bad.push(`${key(x, y)} in ${n}`);
    }
    expect(bad).toEqual([]);
  });
});

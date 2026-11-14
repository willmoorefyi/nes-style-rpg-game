import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

// CT-1 / CT-6 / IN-5: Cornelia's houses, edge exits and shop layouts. The house checks read the map sources
// (assets-src/maps, written by layouts/cornelia.py and layouts/interiors.py); the walking checks read the compiled maps.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Obj { type: string; name?: string; x: number; y: number; w?: number; h?: number; door?: number;
  enter?: { map: string; entrance: string } }
interface Source { id: string; ground: string; music?: string; canSave?: boolean; no_static_chokepoints?: boolean;
  objects?: Obj[]; npcs?: Array<{ id: string; sprite: string; x: number; y: number; chestItem?: string }>;
  entrances?: Record<string, [number, number]>;
  transitions?: Array<{ x: number; y: number; targetMap: string; targetEntrance?: string }> }
const sources = new Map(readdirSync(join(root, 'assets-src/maps')).filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(root, 'assets-src/maps', f), 'utf-8')) as Source).map((s) => [s.id, s] as const));
const compiled = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;

const DOORS: Array<[number, number]> = [[46, 36], [52, 37], [50, 49], [44, 56], [50, 56], [15, 36], [14, 63], [6, 41],
  [46, 60], [35, 62]];
const SHOPS = ['weapon-shop', 'armor-shop', 'item-shop', 'white-magic', 'black-magic', 'inn'].map((s) => `cornelia-${s}`);
const town = sources.get('cornelia')!;
// houses, and prefabs (the inn): the door is on the bottom row, `door` columns in
const houseDoors = (town.objects ?? []).filter((o) => (o.type === 'house' || o.type === 'prefab') && o.enter)
  .map((o) => ({ o, door: [o.x + o.door!, o.y + o.h! - 1] as [number, number] }));
const homes = houseDoors.filter(({ o }) => o.enter!.map.startsWith('cornelia-house-'));
const groundSize = (g: string) => { const rows = g.trimEnd().split('\n'); return `${rows[0].length}x${rows.length}`; };

const walk = new WalkingMode();
/** Cells reachable on foot from the map's first entrance, never entering an NPC cell. */
function reachable(m: MapData): Set<string> {
  const col = new CollisionMap(m);
  const npcs = new Set(m.npcs.map((n) => `${n.x},${n.y}`));
  const [sx, sy] = Object.values(m.entrances ?? {})[0];
  const seen = new Set([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(k) || npcs.has(k)) continue;
      if (!col.isWalkable(nx, ny, walk)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe('Cornelia houses (CT-1)', () => {
  it('the ten house doors each lead to their own cornelia-house-* interior with a door entrance', () => {
    expect(homes.map(({ door }) => door).sort()).toEqual([...DOORS].sort());
    expect(new Set(homes.map(({ o }) => o.enter!.map)).size).toBe(10);
    const map = compiled('cornelia');
    for (const { o, door: [x, y] } of homes) {
      const t = map.transitions.find((tr) => tr.x === x && tr.y === y);
      expect(t?.targetMap, `door (${x},${y})`).toBe(o.enter!.map);
      expect(t?.targetEntrance).toBe('door');
      expect(sources.get(o.enter!.map)?.entrances?.door, o.enter!.map).toBeDefined();
    }
  });

  it('every exit of an interior returns to the cell just south of the door it was entered by', () => {
    expect(homes.length).toBe(10);
    const map = compiled('cornelia');
    for (const { o, door: [x, y] } of [...homes, ...houseDoors.filter(({ o: s }) => SHOPS.includes(s.enter!.map))]) {
      const inner = sources.get(o.enter!.map)!;
      const exits = (inner.transitions ?? []).filter((t) => t.targetMap === 'cornelia');
      expect(exits.length, inner.id).toBeGreaterThan(0);
      expect(inner.transitions!.length, `${inner.id} has only exits to town`).toBe(exits.length);
      for (const t of exits) {
        expect(t.targetEntrance, inner.id).toBe(o.name);
        expect(map.entrances?.[t.targetEntrance!], `${inner.id} -> ${t.targetEntrance}`).toEqual([x, y + 1]);
      }
      // the arrival inside is the cell above an exit gap
      const [dx, dy] = inner.entrances!.door;
      expect(exits.some((t) => t.x === dx && t.y === dy + 1), `${inner.id} door entrance`).toBe(true);
    }
  });

  it('every interior has someone to talk to or a chest; homes play the town music, shops the shop music', () => {
    expect(homes.length).toBe(10);
    for (const { o } of homes) {
      const s = sources.get(o.enter!.map)!;
      expect((s.npcs ?? []).length, s.id).toBeGreaterThan(0);
      expect(s.music, s.id).toBe('town');
      expect(s.canSave, s.id).toBe(true);
    }
    for (const id of SHOPS) expect(sources.get(id)!.music, id).toBe('shop');
  });

  it('the ten homes have ten different plans in at least five sizes', () => {
    const grounds = homes.map(({ o }) => sources.get(o.enter!.map)!.ground);
    expect(new Set(grounds).size).toBe(10);
    expect(new Set(grounds.map(groundSize)).size).toBeGreaterThanOrEqual(5);
  });

  it('the six shops have six different plans (IN-5)', () => {
    expect(new Set(SHOPS.map((id) => sources.get(id)!.ground)).size).toBe(6);
  });

  it('every interior NPC can be talked to: from a reachable cell beside it, or across a counter', () => {
    expect(homes.length).toBe(10);
    for (const id of [...homes.map(({ o }) => o.enter!.map), ...SHOPS]) {
      const m = compiled(id);
      const col = new CollisionMap(m);
      const seen = reachable(m);
      expect(sources.get(id)!.no_static_chokepoints, `${id} checks static chokepoints`).toBe(true);
      for (const n of m.npcs) {
        const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${n.x + dx},${n.y + dy}`)
          || (col.isCounter(n.x + dx, n.y + dy) && seen.has(`${n.x + 2 * dx},${n.y + 2 * dy}`)));
        expect(ok, `${id} ${n.id}`).toBe(true);
      }
      // the keepers stand behind their counters
      for (const n of m.npcs.filter((k) => k.shopId)) {
        expect(col.isCounter(n.x, n.y + 1), `${id} ${n.id} has a counter in front`).toBe(true);
      }
    }
  });
});

describe('Cornelia edges (CT-6)', () => {
  const map = compiled('cornelia');
  const col = new CollisionMap(map);
  const expected = (x: number, y: number): string => {
    if (y === 0) return 'cornelia_north';
    if (y === map.height - 1) return 'cornelia';
    if (x === 0) return 'cornelia_west';
    return y <= 30 ? 'cornelia_north' : 'cornelia_east';
  };

  it('every walkable edge cell is an exit to the overworld, on the side the edge faces', () => {
    let n = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!(x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) || !col.isWalkable(x, y, walk)) continue;
        const t = map.transitions.find((tr) => tr.x === x && tr.y === y);
        expect(t?.targetMap, `(${x},${y})`).toBe('overworld');
        expect(t?.targetEntrance, `(${x},${y})`).toBe(expected(x, y));
        n++;
      }
    }
    expect(n).toBeGreaterThan(150);
  });

  it('every walkable cell can be reached from the south gate (CU), and the compiler checks it', () => {
    expect(Object.keys(map.entrances ?? {})[0]).toBe('south_gate');
    expect((town as Source & { no_unreachable_walkable?: boolean }).no_unreachable_walkable).toBe(true);
    const seen = reachable({ ...map, npcs: [] });
    const lost: string[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) if (col.isWalkable(x, y, walk) && !seen.has(`${x},${y}`)) lost.push(`${x},${y}`);
    }
    expect(lost).toEqual([]);
    expect(seen.size).toBeGreaterThan(2600);
  });

  it('no NPC stands on the 3-wide bridge head at the castle door (CT-4)', () => {
    const onBridge = map.npcs.filter((n) => n.y === 19 && n.x >= 29 && n.x <= 31).map((n) => n.id);
    expect(onBridge).toEqual([]);
    for (const id of ['castle_door_guard_w', 'castle_door_guard_e']) expect(map.npcs.some((n) => n.id === id), id).toBe(true);
  });

  it('every edge exit can be reached from the south gate, and arrivals stay at the gates', () => {
    const seen = reachable({ ...map, npcs: [] });
    for (const t of map.transitions.filter((tr) => tr.targetMap === 'overworld')) {
      expect(seen.has(`${t.x},${t.y}`), `(${t.x},${t.y})`).toBe(true);
    }
    for (const name of ['south_gate', 'west_gate', 'east_gate', 'castle_gate', 'north_postern']) {
      expect(map.entrances?.[name], name).toBeDefined();
    }
  });
});

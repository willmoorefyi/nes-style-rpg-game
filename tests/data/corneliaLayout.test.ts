import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { resolveNPCDialog, type ConditionalDialog, type MapData } from '../../src/types/index.js';
import { inspectAt } from '../../src/scenes/exploration/FieldInspect.js';

// CT-1 / CT-6 / IN-5: Cornelia's houses, edge exits and shop layouts. The house checks read the map sources
// (assets-src/maps, written by layouts/cornelia.py and layouts/interiors.py); the walking checks read the compiled maps.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Obj { type: string; name?: string; x: number; y: number; w?: number; h?: number; door?: number;
  enter?: { map: string; entrance: string } }
interface Source { id: string; name?: string; ground: string; music?: string; canSave?: boolean;
  no_static_chokepoints?: boolean; objects?: Obj[];
  npcs?: Array<{ id: string; sprite: string; x: number; y: number; chestItem?: string; shopId?: string;
    dialog: string[] | ConditionalDialog[] }>;
  inspect?: Array<{ x: number; y: number; text: string[] | ConditionalDialog[] }>;
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

describe('Cornelia shopkeepers (IN-4)', () => {
  const legacy = (id: string) => parse(readFileSync(join(root, 'assets/maps', `${id}.yaml`), 'utf-8')) as MapData;
  const keepers = (npcs: Array<{ id: string; shopId?: string; dialog: string[] | ConditionalDialog[] }>) =>
    npcs.filter((n) => n.shopId).map((n) => ({ id: n.id, first: resolveNPCDialog(n.dialog, () => false)[0] ?? '' }));

  it('every keeper greets you with the name of a shop or the inn, never "...Magic!"', () => {
    for (const id of SHOPS) {
      for (const [where, npcs] of [['source', sources.get(id)!.npcs ?? []], ['legacy', legacy(id).npcs]] as const) {
        const ks = keepers(npcs);
        expect(ks.length, `${where} ${id}`).toBe(1);
        for (const k of ks) {
          expect(k.first, `${where} ${id} ${k.id}`).toMatch(/\b(Shop|Inn)\b/);
          expect(k.first, `${where} ${id} ${k.id}`).not.toMatch(/Magic!$/);
        }
      }
    }
  });

  it('the magic shops are called "White Magic Shop" and "Black Magic Shop" on the HUD', () => {
    for (const [id, name] of [['cornelia-white-magic', 'White Magic Shop'], ['cornelia-black-magic', 'Black Magic Shop']]) {
      expect(sources.get(id)!.name, id).toBe(name);
      expect(compiled(id).name, id).toBe(name);
      expect(legacy(id).name, `legacy ${id}`).toBe(name);
    }
  });
});

describe('Cornelia signpost and townsfolk (CT-9 / UI-2)', () => {
  const SIGNPOST: [number, number] = [32, 66];

  it('the signpost by the south gate can be read: directions to the castle, market, magic shops and inn', () => {
    const [x, y] = SIGNPOST;
    expect((town.objects ?? []).some((o) => o.type === 'signpost' && o.x === x && o.y === y)).toBe(true);
    const lines = inspectAt(compiled('cornelia'), x, y, () => false);
    expect(lines).not.toBeNull();
    const text = lines!.join(' ');
    for (const place of [/castle/i, /market/i, /magic/i, /\binn\b/i, /north/i]) expect(text).toMatch(place);
  });

  it('on the Cornelia map, no NPC without a shop uses the merchant sprite', () => {
    const offenders = (town.npcs ?? []).filter((n) => n.sprite === 'merchant' && !n.shopId);
    expect(offenders.map((n) => n.id)).toEqual([]);
    expect(compiled('cornelia').npcs.filter((n) => n.sprite === 'merchant' && !n.shopId).map((n) => n.id)).toEqual([]);
  });

  it('the market vendors are townsfolk with chatter that changes once the princess is rescued', () => {
    const npcs = compiled('cornelia').npcs;
    const sprites: Record<string, string> = { market_vendor_w: 'vendor_f', market_vendor_e: 'farmer', villager: 'burgher' };
    for (const [id, sprite] of Object.entries(sprites)) expect(npcs.find((n) => n.id === id)?.sprite, id).toBe(sprite);
    for (const id of ['market_vendor_w', 'market_vendor_e']) {
      const n = npcs.find((v) => v.id === id)!;
      expect(n.dialog.length, id).toBeGreaterThanOrEqual(2);
      const before = resolveNPCDialog(n.dialog, () => false);
      const after = resolveNPCDialog(n.dialog, (f) => f === 'PRINCESS_RESCUED');
      expect(before.length, id).toBeGreaterThan(0);
      expect(after, id).not.toEqual(before);
      expect(before.join(' '), id).not.toMatch(/not for adventurers/i);
    }
  });
});

// ── R4a: the town and interior second pass ──
const INTERIORS = [...homes.map(({ o }) => o.enter!.map), ...SHOPS];
interface Placed { type: string; parts?: string[][]; x: number; y: number; on_wall?: boolean; collide?: string;
  offset?: number[] }
const placed = (id: string) => (sources.get(id)!.objects ?? []) as unknown as Placed[];
/** Steps on the compiled collision with every NPC cell blocked, from (sx, sy) to (tx, ty). */
function stepsBetween(m: MapData, [sx, sy]: [number, number], [tx, ty]: [number, number]): number {
  const col = new CollisionMap(m);
  const npcs = new Set(m.npcs.map((n) => `${n.x},${n.y}`));
  const dist = new Map([[`${sx},${sy}`, 0]]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === tx && y === ty) return dist.get(`${x},${y}`)!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (dist.has(k) || npcs.has(k) || !col.isWalkable(nx, ny, walk)) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      queue.push([nx, ny]);
    }
  }
  return Infinity;
}

describe('Cornelia second pass (R4a)', () => {
  it('the castle apron stays open: no static NPC on row 19, and the door is 3 steps from either side (M1)', () => {
    const map = compiled('cornelia');
    expect(map.npcs.filter((n) => !n.wander && n.y === 19 && n.x >= 10 && n.x <= 50).map((n) => n.id)).toEqual([]);
    for (const from of [[27, 19], [33, 19]] as Array<[number, number]>) {
      expect(stepsBetween(map, from, [30, 19]), `(${from})`).toBeLessThanOrEqual(3);
    }
  });

  it('a keeper can only be reached across the counter in front of them (M3)', () => {
    for (const id of [...SHOPS, 'cornelia-house-tavern']) {
      const m = compiled(id);
      const col = new CollisionMap(m);
      const seen = reachable(m);
      for (const k of m.npcs.filter((n) => n.shopId || n.id === 'barkeep')) {
        expect(col.isCounter(k.x, k.y + 1), `${id} ${k.id}`).toBe(true);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) {
          expect(seen.has(`${k.x + dx},${k.y + dy}`), `${id}: (${k.x + dx}, ${k.y + dy}) beside ${k.id}`).toBe(false);
        }
      }
    }
  });

  it('every interior checks for unreachable floor, and only the staff side of a counter is out of reach (M4)', () => {
    expect(INTERIORS.length).toBe(16);
    for (const id of INTERIORS) {
      const src = sources.get(id)! as Source & { no_unreachable_walkable?: boolean; unreachable_ok?: Array<[number, number]> };
      expect(src.no_unreachable_walkable, id).toBe(true);
      const m = compiled(id);
      const col = new CollisionMap(m);
      const seen = reachable({ ...m, npcs: [] });
      const ok = new Set((src.unreachable_ok ?? []).map(([x, y]) => `${x},${y}`));
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          if (col.isWalkable(x, y, walk) && !seen.has(`${x},${y}`)) expect(ok.has(`${x},${y}`), `${id} (${x}, ${y})`).toBe(true);
        }
      }
      const keepers = m.npcs.filter((n) => n.shopId || n.id === 'barkeep');
      for (const [x, y] of src.unreachable_ok ?? []) {
        const behind = Array.from({ length: m.height - y - 1 }, (_, i) => y + 1 + i).some((cy) => col.isCounter(x, cy));
        const beside = keepers.some((k) => Math.abs(k.x - x) + Math.abs(k.y - y) <= 1);
        expect(behind || beside, `${id} (${x}, ${y}) is behind a counter`).toBe(true);
      }
    }
  });

  it('beds and bookshelves on the floor stand against the wall and block only their art (M5)', () => {
    let n = 0;
    for (const id of INTERIORS) {
      const col = new CollisionMap(compiled(id));
      for (const o of placed(id)) {
        const top = o.parts?.[0]?.[0];
        if (o.on_wall || (top !== 'bed_top' && top !== 'bookshelf_top')) continue;
        n++;
        expect(o.collide, `${id} ${top} (${o.x}, ${o.y})`).toBe('alpha');
        expect(o.offset?.[1] ?? 0, `${id} ${top} (${o.x}, ${o.y})`).toBeLessThan(0);
        if (top === 'bed_top') expect(col.isWalkable(o.x, o.y + 1, walk), `${id} below the bed (${o.x}, ${o.y})`).toBe(true);
      }
    }
    expect(n).toBe(19);                    // + 16 in the castle (castleLayout): the 35 of M5
  });

  it('every gate passage has a turret on both sides (M7)', () => {
    const turrets = placed('cornelia').filter((o) => o.parts?.[0]?.[0] === 'tower_0_0')
      .map((o) => ({ x0: o.x, x1: o.x + 1, y0: o.y, y1: o.y + 2 }));
    const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 <= b1 && b0 <= a1;
    // [x0, x1, y0, y1, the passage runs north-south (flanked west and east) or west-east (flanked north and south)]
    const gates: Array<[string, number, number, number, number, 'ns' | 'we']> = [
      ['south', 29, 31, 66, 71, 'ns'], ['inner', 29, 31, 31, 32, 'ns'], ['postern', 6, 7, 0, 1, 'ns'],
      ['west', 0, 3, 44, 45, 'we'], ['east', 56, 61, 44, 45, 'we'], ['precinct east', 56, 61, 24, 25, 'we']];
    for (const [name, x0, x1, y0, y1, dir] of gates) {
      const sides = dir === 'ns'
        ? [turrets.some((t) => t.x1 >= x0 - 3 && t.x1 < x0 && overlaps(t.y0, t.y1, y0 - 2, y1 + 2)),
          turrets.some((t) => t.x0 > x1 && t.x0 <= x1 + 3 && overlaps(t.y0, t.y1, y0 - 2, y1 + 2))]
        : [turrets.some((t) => t.y1 >= y0 - 3 && t.y1 < y0 && overlaps(t.x0, t.x1, x0, x1)),
          turrets.some((t) => t.y0 > y1 && t.y0 <= y1 + 3 && overlaps(t.x0, t.x1, x0, x1))];
      expect(sides, `${name} gate`).toEqual([true, true]);
    }
  });

  it('the south gate, the inner gatehouse and the postern have arches over the passage, drawn over characters (M7)', () => {
    type Arch = Placed & { above_rows?: number; passage?: boolean };
    const arches = (placed('cornelia') as Arch[]).filter((o) => o.parts?.[0]?.[0]?.startsWith('gate_arch_'));
    const sheet = JSON.parse(readFileSync(join(root, 'assets-src/gen/approved/town/gates.json'), 'utf-8')) as
      { cells: Array<Array<string | null>> };
    for (const p of arches.flatMap((a) => a.parts!.flat())) expect(sheet.cells.flat(), `${p} is approved art`).toContain(p);
    const col = new CollisionMap(compiled('cornelia'));
    const at = (x: number, y: number) => arches.find((o) => o.x === x && o.y === y);
    // the 3-wide arches are cut into columns: the opening (centre) is drawn over characters and is the only walkable
    // cell of the wall line; the jambs stand on the wall, drawn under characters, and block
    for (const [name, y] of [['south', 68], ['inner', 31]] as const) {
      const [west, mid, east] = [29, 30, 31].map((x) => at(x, y));
      expect(mid?.parts, name).toEqual([['gate_arch_3_0_1'], ['gate_arch_3_1_1']]);
      expect([west?.parts, east?.parts], name).toEqual([[['gate_arch_3_0_0'], ['gate_arch_3_1_0']],
        [['gate_arch_3_0_2'], ['gate_arch_3_1_2']]]);
      expect(mid!.above_rows, `${name}: the opening is drawn over characters`).toBe(2);
      expect(mid!.passage).toBe(true);
      expect([west!.above_rows ?? 0, east!.above_rows ?? 0, west!.on_wall, east!.on_wall]).toEqual([0, 0, true, true]);
      for (const j of [0, 1]) {
        expect(col.isWalkable(30, y + j, walk), `${name}: the opening (30, ${y + j})`).toBe(true);
        for (const x of [28, 29, 31, 32]) expect(col.isWalkable(x, y + j, walk), `${name}: wall (${x}, ${y + j})`).toBe(false);
      }
      expect([col.isWalkable(30, y - 1, walk), col.isWalkable(30, y + 2, walk)], `${name}: the road runs on`).toEqual([true, true]);
    }
    // the postern's 2-wide arch has a half-cell opening on its cell boundary: shifted 23 px west it lies over x 6,
    // the only walkable cell of the wall line; (7, 2) is closed so no head sits under the east jamb
    const postern = at(6, 0)!;
    expect(postern.parts).toEqual([['gate_arch_2_0_0', 'gate_arch_2_0_1'], ['gate_arch_2_1_0', 'gate_arch_2_1_1']]);
    expect([postern.above_rows, postern.passage, postern.offset]).toEqual([2, true, [-23, 0]]);
    for (const j of [0, 1]) {
      expect(col.isWalkable(6, j, walk), `postern opening (6, ${j})`).toBe(true);
      for (const x of [5, 7]) expect(col.isWalkable(x, j, walk), `postern wall (${x}, ${j})`).toBe(false);
    }
    expect([col.isWalkable(6, 2, walk), col.isWalkable(7, 2, walk)]).toEqual([true, false]);
    expect(arches.length).toBe(7);
  });

  it('the tavern and the shrine hang their signs (M7)', () => {
    const signs = new Map((town.objects ?? []).filter((o) => o.type === 'house')
      .map((o) => [o.name, (o as Obj & { sign?: string }).sign] as const));
    expect(signs.get('house_tavern')).toBe('tavern');
    expect(signs.get('house_shrine')).toBe('shrine');
    const sheet = JSON.parse(readFileSync(join(root, 'assets-src/gen/approved/town/gates.json'), 'utf-8')) as
      { cells: Array<Array<string | null>> };
    expect(sheet.cells.flat()).toEqual(expect.arrayContaining(['sign_tavern', 'sign_shrine']));
    // the other homes stay unsigned
    expect([...signs].filter(([n, s]) => s && n !== 'house_tavern' && n !== 'house_shrine' && n?.startsWith('house_')))
      .toEqual([]);
  });

  it('no NPC sprite is overused, and the roles have fitting sprites (M8)', () => {
    const cornelia = (parse(readFileSync(join(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[])
      .filter((id) => id.startsWith('cornelia')).map(compiled);
    const count = new Map<string, number>();
    for (const m of cornelia) for (const n of m.npcs) if (n.sprite !== 'chest') count.set(n.sprite, (count.get(n.sprite) ?? 0) + 1);
    // R4a reading of the caps: guard per map (the castle guards keep their uniforms), the others over all of Cornelia
    for (const m of cornelia) expect(m.npcs.filter((n) => n.sprite === 'guard').length, `${m.id} guards`).toBeLessThanOrEqual(6);
    const caps: Record<string, number> = { old_man: 6, villager_f: 8, mage: 7 };
    for (const [sprite, cap] of Object.entries(caps)) expect(count.get(sprite) ?? 0, sprite).toBeLessThanOrEqual(cap);
    const sprite = (id: string) => cornelia.flatMap((m) => m.npcs).find((n) => n.id === id)?.sprite;
    expect([sprite('hall_noble'), sprite('chancellor')]).toEqual(['burgher', 'burgher']);
    expect([sprite('farmer'), sprite('royal_gardener')]).toEqual(['farmer', 'farmer']);
    expect([sprite('fisher'), sprite('cellar_steward')]).toEqual(['villager', 'villager']);
  });

  it('no two interiors share a palette, and the weapon shop counter is one straight run (M9)', () => {
    const key = (id: string) => {
      const m = (sources.get(id) as Source & { materials?: Record<string, unknown> }).materials ?? {};
      return JSON.stringify(['in_wall_face', 'in_wall_top', 'floor', 'floor_stone'].map((k) => m[k] ?? null));
    };
    const keys = INTERIORS.map(key);
    expect(new Set(keys).size, INTERIORS.map((id, i) => `${id} ${keys[i]}`).join('\n')).toBe(16);
    const rowsW = sources.get('cornelia-weapon-shop')!.ground.trimEnd().split('\n');
    expect(rowsW.flatMap((r, y) => (r.includes('c') ? [y] : []))).toEqual([5]);
  });

  it("the knight's gift is an Iron Helm, which no Cornelia shop sells (M10)", () => {
    const knight = compiled('cornelia-house-knight').npcs.find((n) => n.chestItem)!;
    expect(knight.chestItem).toBe('iron_helm');
    const shops = parse(readFileSync(join(root, 'assets/data/shops.yaml'), 'utf-8')) as Array<{ id: string; inventory?: string[] }>;
    for (const s of shops.filter((sh) => sh.id.startsWith('cornelia_'))) expect(s.inventory ?? [], s.id).not.toContain('iron_helm');
  });
});

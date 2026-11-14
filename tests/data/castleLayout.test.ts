import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

// T6c: Cornelia Castle (assets-src/tools/layouts/castle.py). The checks read the map sources (assets-src/maps) for
// the ground characters and the placed objects, and the compiled maps (assets/maps/ai) for collision and NPCs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Deco { type: string; parts?: Array<Array<string | null>>; x: number; y: number; offset?: number[] }
interface Source { id: string; ground: string; objects?: Deco[] }
const source = (id: string) => parse(readFileSync(join(root, 'assets-src/maps', `${id}.yaml`), 'utf-8')) as Source;
const compiled = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;
const rows = (s: Source) => s.ground.replace(/\n$/, '').split('\n');
const walk = new WalkingMode();
const FLOORS = ['cornelia-castle', 'cornelia-castle-2f', 'cornelia-castle-tower', 'cornelia-castle-cellar'];

/** Every 2-cell doorway through a wall line: a run of cells, two wide, flanked on both sides by wall ground (W/F)
 *  in the source. Returns the cells on either end of the run, which must be open floor. */
function doorwaySides(id: string): Array<{ door: string; sides: Array<[number, number]> }> {
  const src = rows(source(id));
  const map = compiled(id);
  const col = new CollisionMap(map);
  const warps = new Set(map.transitions.map((t) => `${t.x},${t.y}`));
  const wall = (x: number, y: number) => 'WF'.includes(src[y]?.[x] ?? 'W');
  const open = (x: number, y: number) => col.isWalkable(x, y, walk) && !warps.has(`${x},${y}`);
  const out: Array<{ door: string; sides: Array<[number, number]> }> = [];
  const h = map.height, w = map.width;
  // through a vertical wall: cells (x, y) and (x, y + 1), wall at (x, y - 1) and (x, y + 2); the run goes along x
  for (let y = 1; y + 2 < h; y++) {
    let x = 0;
    while (x < w) {
      const gap = (cx: number) => open(cx, y) && open(cx, y + 1) && wall(cx, y - 1) && wall(cx, y + 2);
      if (!gap(x)) { x++; continue; }
      const x0 = x;
      while (x < w && gap(x)) x++;
      if (x0 > 0 && x < w) out.push({ door: `${id} (${x0}-${x - 1}, ${y}-${y + 1})`,
        sides: [[x0 - 1, y], [x0 - 1, y + 1], [x, y], [x, y + 1]] });
    }
  }
  // through a horizontal wall: cells (x, y) and (x + 1, y), wall at (x - 1, y) and (x + 2, y); the run goes along y
  for (let x = 1; x + 2 < w; x++) {
    let y = 0;
    while (y < h) {
      const gap = (cy: number) => open(x, cy) && open(x + 1, cy) && wall(x - 1, cy) && wall(x + 2, cy);
      if (!gap(y)) { y++; continue; }
      const y0 = y;
      while (y < h && gap(y)) y++;
      if (y0 > 0 && y < h) out.push({ door: `${id} (${x}-${x + 1}, ${y0}-${y - 1})`,
        sides: [[x, y0 - 1], [x + 1, y0 - 1], [x, y], [x + 1, y]] });
    }
  }
  return out;
}

describe('castle doorways (CA-4)', () => {
  it('finds the 1F doorways, the treasury one included', () => {
    const doors = doorwaySides('cornelia-castle').map((d) => d.door);
    expect(doors).toContain('cornelia-castle (30-31, 25-26)');
    expect(doors.length).toBeGreaterThanOrEqual(6);
  });

  it('both cells on each side of every doorway are walkable', () => {
    for (const id of FLOORS) {
      const col = new CollisionMap(compiled(id));
      for (const { door, sides } of doorwaySides(id)) {
        for (const [x, y] of sides) expect(col.isWalkable(x, y, walk), `${door}: (${x}, ${y}) is blocked`).toBe(true);
      }
    }
  });
});

describe('the King before his throne (CA-5, reversed by M13)', () => {
  const src = source('cornelia-castle-2f');
  const map = compiled('cornelia-castle-2f');
  const throne = (src.objects ?? []).find((o) => (o.parts ?? []).flat().includes('throne_0_0'))!;
  const king = map.npcs!.find((n) => n.id === 'king')!;

  it('the King stands on the dais just in front of the throne, so the chair shows above him', () => {
    expect(throne).toBeDefined();
    expect(throne.offset).toEqual([-24, 0]);
    expect((throne as Deco & { walk_cells?: unknown }).walk_cells).toBeUndefined();
    expect(king.y).toBe(throne.y + 2);
    expect(king.x).toBe(throne.x);
  });

  it('the cell below him is walkable (he is talked to from there)', () => {
    expect(new CollisionMap(map).isWalkable(king.x, king.y + 1, walk)).toBe(true);
  });
});

/** Steps from (sx, sy) to (tx, ty) on the compiled collision (NPC cells blocked when `npcs`), or Infinity. */
function steps(m: MapData, [sx, sy]: [number, number], [tx, ty]: [number, number], npcs = false): number {
  const col = new CollisionMap(m);
  const block = new Set(npcs ? m.npcs.map((n) => `${n.x},${n.y}`) : []);
  const dist = new Map([[`${sx},${sy}`, 0]]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const d = dist.get(`${x},${y}`)!;
    if (x === tx && y === ty) return d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (dist.has(k) || block.has(k) || !col.isWalkable(nx, ny, walk)) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return Infinity;
}

describe('castle second pass (R4a)', () => {
  it('the 1F reading gallery opens into the library (M2)', () => {
    expect(steps(compiled('cornelia-castle'), [31, 4], [33, 6])).toBeLessThanOrEqual(4);
  });

  it('every castle floor checks that no walkable cell is out of reach (M4)', () => {
    for (const id of FLOORS) {
      expect((source(id) as Source & { no_unreachable_walkable?: boolean }).no_unreachable_walkable, id).toBe(true);
    }
  });

  it('beds and bookshelves on the floor stand against the wall and block only their art (M5)', () => {
    let beds = 0;
    for (const id of FLOORS) {
      const col = new CollisionMap(compiled(id));
      for (const o of (source(id).objects ?? []) as Array<Deco & { on_wall?: boolean; collide?: string }>) {
        const top = o.parts?.[0]?.[0];
        if (o.on_wall || (top !== 'bed_top' && top !== 'bookshelf_top')) continue;
        expect(o.collide, `${id} ${top} (${o.x}, ${o.y})`).toBe('alpha');
        expect(o.offset?.[1] ?? 0, `${id} ${top} (${o.x}, ${o.y})`).toBeLessThan(0);
        if (top === 'bed_top') {
          beds++;
          expect(col.isWalkable(o.x, o.y + 1, walk), `${id} below the bed at (${o.x}, ${o.y})`).toBe(true);
        }
      }
    }
    expect(beds).toBe(4);
  });

  it('the cellar is stocked: casks, grain, armour stands and a table (M9)', () => {
    const objs = source('cornelia-castle-cellar').objects ?? [];
    expect(objs.filter((o) => o.type !== 'deco' || !(o as { on_wall?: boolean }).on_wall).length).toBeGreaterThanOrEqual(20);
  });

  it('the cellar chests hold new loot, and no chest item repeats much across Cornelia (M10)', () => {
    const cellar = compiled('cornelia-castle-cellar').npcs!.filter((n) => n.chestItem).map((n) => n.chestItem).sort();
    expect(cellar).toEqual(['ether', 'hi_potion', 'robe', 'wooden_armor']);
    const ids = parse(readFileSync(join(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
    const chests = ids.filter((id) => id.startsWith('cornelia')).flatMap((id) => compiled(id).npcs.filter((n) => n.chestItem));
    expect(chests.length).toBe(11);
    expect(new Set(chests.map((c) => c.chestItem)).size).toBeGreaterThanOrEqual(9);
  });

  it('no NPC stands directly south of the gold heap (M13)', () => {
    const f1 = compiled('cornelia-castle');
    const heaps = (source('cornelia-castle').objects ?? []).filter((o) => (o.parts ?? []).flat().includes('gold_heap'));
    expect(heaps.length).toBe(1);
    for (const h of heaps) expect(f1.npcs.filter((n) => n.x === h.x && n.y === h.y + 1).map((n) => n.id)).toEqual([]);
  });

  it('every castle floor taller than the view is at least as wide as it (M13: 20 cells)', () => {
    for (const id of FLOORS) {
      const m = compiled(id);
      if (m.height > 11) expect(m.width, id).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('the castle rooms have a purpose (CA-7)', () => {
  const f1 = compiled('cornelia-castle');
  const inRect = (p: { x: number; y: number }, x0: number, y0: number, x1: number, y1: number) =>
    p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;

  it('the treasury has at least two chests with their own flags', () => {
    const chests = f1.npcs!.filter((n) => n.chestItem && inRect(n, 32, 19, 41, 30));
    expect(chests.length).toBeGreaterThanOrEqual(2);
    const flags = chests.map((n) => n.chestFlag);
    expect(new Set(flags).size).toBe(flags.length);
    expect(chests.map((n) => n.chestItem).sort()).toEqual(['cabin', 'phoenix_down']);
  });

  it('the cellar has a fourth chest (an Ether, kept by M10)', () => {
    const chests = compiled('cornelia-castle-cellar').npcs!.filter((n) => n.chestItem);
    expect(chests.length).toBe(4);
    expect(chests.map((n) => n.chestItem)).toContain('ether');
  });

  it('the 1F gallery has bookshelves, lecterns and a talkable NPC, and two rows open end to end', () => {
    const objs = source('cornelia-castle').objects ?? [];
    const has = (o: Deco, part: string) => (o.parts ?? []).flat().includes(part);
    const shelves = objs.filter((o) => has(o, 'bookshelf_bottom') && inRect({ x: o.x, y: o.y + 1 }, 12, 3, 31, 5));
    expect(shelves.length).toBeGreaterThanOrEqual(4);
    expect(objs.filter((o) => has(o, 'lectern') && inRect(o, 12, 3, 31, 5)).length).toBe(2);
    const col = new CollisionMap(f1);
    const npc = f1.npcs!.find((n) => inRect(n, 12, 3, 31, 5) && !n.wander);
    expect(npc, 'a static NPC in the gallery').toBeDefined();
    const talk = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => col.isWalkable(npc!.x + dx, npc!.y + dy, walk));
    expect(talk).toBe(true);
    const openRows = [3, 4, 5].filter((y) => Array.from({ length: 20 }, (_, i) => 12 + i)
      .every((x) => col.isWalkable(x, y, walk) && !f1.npcs!.some((n) => !n.wander && n.x === x && n.y === y)));
    expect(openRows.length).toBeGreaterThanOrEqual(2);
  });

  it('the 2F guard room has armour stands, a weapon rack, the war-map table and a guard', () => {
    const objs = source('cornelia-castle-2f').objects ?? [];
    const count = (part: string) => objs.filter((o) => (o.parts ?? []).flat().includes(part)
      && inRect(o, 33, 4, 41, 14)).length;
    expect(count('armor_stand')).toBeGreaterThanOrEqual(2);
    expect(count('weapon_rack')).toBeGreaterThanOrEqual(1);
    expect(count('map_table_l')).toBe(1);                                // CA-7 (T6h): the war-map table
    expect(objs.find((o) => (o.parts ?? []).flat().includes('map_table_l'))?.parts).toEqual([['map_table_l', 'map_table_r']]);
    expect(count('table')).toBe(0);
    const guard = compiled('cornelia-castle-2f').npcs!.find((n) => n.sprite === 'guard' && inRect(n, 33, 6, 41, 14));
    expect(guard?.dialog.flatMap((d) => (typeof d === 'string' ? [d] : d.text)).join(' ')).toMatch(/tower/);
  });

  it('the treasury has the gold heap at (36, 22) and the crown on its cushion at (38, 22) (T6h)', () => {
    const objs = source('cornelia-castle').objects ?? [];
    const at = (part: string) => objs.filter((o) => (o.parts ?? []).flat().includes(part)).map((o) => [o.x, o.y]);
    expect(at('gold_heap')).toEqual([[36, 22]]);
    expect(at('crown_cushion')).toEqual([[38, 22]]);
    expect(at('globe')).toEqual([[38, 12]]);                              // in the library
    const col = new CollisionMap(f1);
    for (const [x, y] of [[36, 22], [38, 22]]) expect(col.isWalkable(x, y, walk), `(${x}, ${y}) is solid`).toBe(false);
    // the chests in front stay reachable from the treasury floor
    for (const c of f1.npcs!.filter((n) => n.chestItem && inRect(n, 32, 19, 41, 30))) {
      expect([[0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => col.isWalkable(c.x + dx, c.y + dy, walk)), c.id).toBe(true);
    }
  });

  it('every CA-7 prop placed in the castle is cut from the approved castle/stairs_lib sheet (no placeholder)', () => {
    const approved = JSON.parse(readFileSync(join(root, 'assets-src/gen/approved/castle/stairs_lib.json'), 'utf-8')) as
      { cells: Array<Array<string | null>> };
    const cut = new Set(approved.cells.flat().filter((p): p is string => p !== null));
    const props = ['map_table_l', 'map_table_r', 'gold_heap', 'crown_cushion', 'lectern', 'globe'];
    for (const p of props) expect(cut.has(p), p).toBe(true);
    const placed = FLOORS.flatMap((id) => (source(id).objects ?? []).flatMap((o) => (o.parts ?? []).flat()))
      .filter((p): p is string => p !== null && props.includes(p));
    expect(new Set(placed)).toEqual(new Set(props));
  });

  it('1F and 2F no longer share one carpet layout: the throne room runner is 4 wide, with a medallion', () => {
    const run = (id: string, y: number) => {
      const r = rows(source(id))[y];
      let x0 = 21, x1 = 21;
      while (r[x0 - 1] === '+') x0--;
      while (r[x1 + 1] === '+') x1++;
      return r[21] === '+' ? x1 - x0 + 1 : 0;
    };
    expect(run('cornelia-castle', 20)).toBe(2);
    expect(run('cornelia-castle-2f', 19)).toBe(4);
    expect(run('cornelia-castle-2f', 15)).toBeGreaterThanOrEqual(8);
    expect(run('cornelia-castle-2f', 15)).toBeLessThan(20);           // not a cross runner
    const mask = (id: string) => rows(source(id)).slice(9, 26).map((r) => r.slice(12, 32).replace(/[^+]/g, '.'));
    expect(mask('cornelia-castle-2f')).not.toEqual(mask('cornelia-castle'));
  });
});

describe('U18: the throne dais (2F)', () => {
  const map = compiled('cornelia-castle-2f');
  const col = new CollisionMap(map);
  const npc = (id: string) => map.npcs.find((n) => n.id === id)!;
  const king = npc('king');
  const princess = npc('princess');
  /** Reachable cells from throne_return with the King and the (rescued) princess standing. */
  function reachable(): Set<string> {
    const blocked = new Set([`${king.x},${king.y}`, `${princess.x},${princess.y}`]);
    const [sx, sy] = map.entrances!.throne_return as [number, number];
    const seen = new Set([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || blocked.has(k) || !col.isWalkable(nx, ny, walk)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    return seen;
  }

  it('the princess stands beside her father, talked to from the cell south of her', () => {
    expect([king.x, king.y]).toEqual([21, 8]);
    expect([princess.x, princess.y]).toEqual([22, 8]);
    expect(princess.showIf).toBe('PRINCESS_RESCUED');
    expect(reachable().has(`${princess.x},${princess.y + 1}`)).toBe(true);
    expect(map.entrances!.throne_return).toEqual([21, 9]);
  });

  it('no reachable cell touches both royals or lies between them, and the dais behind them is closed', () => {
    const seen = reachable();
    const touches = (x: number, y: number, n: { x: number; y: number }) => Math.abs(x - n.x) + Math.abs(y - n.y) === 1;
    for (const k of seen) {
      const [x, y] = k.split(',').map(Number);
      expect(touches(x, y, king) && touches(x, y, princess), `(${k}) touches both`).toBe(false);
      if (y === 8) expect(x > Math.min(king.x, princess.x) && x < Math.max(king.x, princess.x), `(${k})`).toBe(false);
    }
    for (let x = 19; x <= 24; x++) {
      for (const y of [6, 7, 8]) {
        if (y === 8 && (x === king.x || x === princess.x)) continue;
        expect(seen.has(`${x},${y}`), `dais cell (${x}, ${y})`).toBe(false);
      }
    }
  });
});

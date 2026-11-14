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

describe('the King on his throne (CA-5)', () => {
  const src = source('cornelia-castle-2f');
  const map = compiled('cornelia-castle-2f');
  const throne = (src.objects ?? []).find((o) => (o.parts ?? []).flat().includes('throne_0_0'))!;
  const king = map.npcs!.find((n) => n.id === 'king')!;

  it("the King's cell is in the bottom row of the throne's footprint", () => {
    expect(throne).toBeDefined();
    const bottom = throne.y + throne.parts!.length - 1;
    expect(king.y).toBe(bottom);
    expect(king.x).toBeGreaterThanOrEqual(throne.x);
    expect(king.x).toBeLessThan(throne.x + throne.parts![0].length);
  });

  it('the throne is centred on his cell, and the dais below him is walkable', () => {
    expect(throne.offset).toEqual([-24, 0]);
    expect(king.x).toBe(throne.x);
    expect(new CollisionMap(map).isWalkable(king.x, king.y + 1, walk)).toBe(true);
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

  it('the cellar has a fourth chest (an Ether)', () => {
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

  it('the 2F guard room has armour stands, a weapon rack, a table and a guard', () => {
    const objs = source('cornelia-castle-2f').objects ?? [];
    const count = (part: string) => objs.filter((o) => (o.parts ?? []).flat().includes(part)
      && inRect(o, 33, 4, 41, 14)).length;
    expect(count('armor_stand')).toBeGreaterThanOrEqual(2);
    expect(count('weapon_rack')).toBeGreaterThanOrEqual(1);
    expect(count('table')).toBeGreaterThanOrEqual(1);
    const guard = compiled('cornelia-castle-2f').npcs!.find((n) => n.sprite === 'guard' && inRect(n, 33, 6, 41, 14));
    expect(guard?.dialog.flatMap((d) => (typeof d === 'string' ? [d] : d.text)).join(' ')).toMatch(/tower/);
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

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

// TF-1: the temple's void cells (`x`) drew flat black in the corners and beside the entry corridor. They are now
// solid rock (`W`, the dark wall top), which blocks exactly as the void did.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = parse(readFileSync(join(root, 'assets-src/maps/temple-of-fiends.yaml'), 'utf-8')) as {
  ground: string; objects: Array<{ parts: string[][]; x: number; y: number; collide?: string }>;
};
const map = parse(readFileSync(join(root, 'assets/maps/ai/temple-of-fiends.yaml'), 'utf-8')) as MapData;
const ground = src.ground.replace(/\n$/, '').split('\n');

describe('Temple of Fiends ground (TF-1)', () => {
  it('has no void cells', () => {
    expect(ground.filter((r) => r.includes('x'))).toEqual([]);
  });

  it('every wall cell blocks, and 236 cells are walkable (W3: the broken pillars\' empty tops no longer block)', () => {
    const col = new CollisionMap(map);
    const walk = new WalkingMode();
    expect(ground.length).toBe(map.height);
    let open = 0;
    ground.forEach((r, y) => [...r].forEach((ch, x) => {
      const ok = col.isWalkable(x, y, walk);
      if ('WFx'.includes(ch)) expect(ok, `(${x}, ${y}) is a wall`).toBe(false);
      if (ok) open++;
    }));
    expect(open).toBe(236);
  });
});

type Cell = [number, number];
const key = (x: number, y: number) => `${x},${y}`;
const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

describe('Temple of Fiends second pass (R4b)', () => {
  const col = new CollisionMap(map);
  const walk = new WalkingMode();

  it('W3: the broken pillars block only at their bases', () => {
    for (const [x, y] of [[9, 10], [14, 12]] as Cell[]) {
      expect(col.isWalkable(x, y, walk), `top (${x},${y})`).toBe(true);
      expect(col.isWalkable(x, y + 1, walk), `base (${x},${y + 1})`).toBe(false);
    }
  });

  it('W13: a 4-wide causeway runs from the entry corridor to the altar, and rubble breaks up the floor', () => {
    let floor = 0, marked = 0;
    ground.forEach((r) => [...r].forEach((c) => { if ('-_%'.includes(c)) floor++; if ('_%'.includes(c)) marked++; }));
    expect(marked / floor).toBeGreaterThanOrEqual(0.15);
    const seen = new Set([key(11, 20)]);
    const queue: Cell[] = [[11, 20]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (ground[ny]?.[nx] === '_' && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); queue.push([nx, ny]); }
      }
    }
    expect(ground[20][11]).toBe('_');
    expect([...seen].some((k) => k.endsWith(',7')), 'the causeway reaches row 7').toBe(true);
    expect([...seen].some((k) => k.endsWith(',3')), 'and the altar row').toBe(true);
  });

  it('B1: Garland and three trigger cells close the room\'s doorway row; talking to him starts the battle', () => {
    const npcs = map.npcs ?? [];
    const garland = npcs.find((n) => n.id === 'garland')!;
    const princess = npcs.find((n) => n.id === 'captive_princess')!;
    const enc = map.scriptedEncounters ?? [];
    expect(new Set(enc.map((e) => e.flag))).toEqual(new Set(['GARLAND_DEFEATED']));
    expect(enc.filter((e) => e.npc === 'garland').length).toBe(1);
    expect(enc.every((e) => e.isBoss && e.enemyIds.join() === 'garland' && e.postVictoryCutscene === 'garland_defeated')).toBe(true);
    expect(col.isWalkable(garland.x, garland.y + 1, walk), 'Garland faces the corridor').toBe(true);
    // BFS from the entry: NPC cells block, scripted cells are stops (stepping on one starts the battle)
    const blocked = new Set(npcs.map((n) => key(n.x, n.y)));
    const stops = new Set(enc.map((e) => key(e.x, e.y)));
    const [ex, ey] = map.entrances!.entry as Cell;
    const seen = new Set([key(ex, ey)]);
    const queue: Cell[] = [[ex, ey]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (stops.has(key(x, y))) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (seen.has(k) || blocked.has(k) || !col.isWalkable(nx, ny, walk)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    const room = [...seen].filter((k) => { const y = Number(k.split(',')[1]); return y >= 3 && y <= 6 && !stops.has(k); });
    expect(room, 'room cells reached without a fight').toEqual([]);
    const nearPrincess = DIRS.map(([dx, dy]) => key(princess.x + dx, princess.y + dy));
    expect(nearPrincess.filter((k) => seen.has(k))).toEqual([]);
  });
});

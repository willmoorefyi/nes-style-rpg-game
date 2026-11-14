import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

// CA-1: a castle stairwell (`Room.stairs_down` in assets-src/tools/layouts/common.py) is a 2x2 pit in the floor.
// The player must never walk across the drawn pit: each of its cells either leads down (a transition) or is solid.
// The checks read the map sources (assets-src/maps, written by layouts/castle.py) and the compiled maps.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Deco { type: string; parts?: Array<Array<string | null>>; x: number; y: number }
interface Source { id: string; objects?: Deco[] }
const castleSources = readdirSync(join(root, 'assets-src/maps'))
  .filter((f) => f.startsWith('cornelia-castle') && f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(root, 'assets-src/maps', f), 'utf-8')) as Source);
const compiled = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;
const isStairwell = (o: Deco) => o.type === 'deco' && (o.parts ?? []).flat().some((p) => p?.startsWith('stairs_down_'));
const stairwells = castleSources.flatMap((s) => (s.objects ?? []).filter(isStairwell).map((o) => ({ id: s.id, o })));
const walk = new WalkingMode();

describe('castle stairwells (CA-1)', () => {
  it('the 1F, 2F and tower each have one stairwell', () => {
    expect(stairwells.map(({ id }) => id).sort())
      .toEqual(['cornelia-castle', 'cornelia-castle-2f', 'cornelia-castle-tower']);
  });

  it('every stairwell cell is a transition or not walkable', () => {
    for (const { id, o } of stairwells) {
      const map = compiled(id);
      const col = new CollisionMap(map);
      o.parts!.forEach((row, j) => row.forEach((_, i) => {
        const x = o.x + i, y = o.y + j;
        const warp = map.transitions.some((t) => t.x === x && t.y === y);
        expect(warp || !col.isWalkable(x, y, walk), `${id} (${x}, ${y}) is a walkable cell of the pit`).toBe(true);
      }));
    }
  });

  it('the first step onto a stairwell, from the arrival tile above it, goes down', () => {
    for (const { id, o } of stairwells) {
      const map = compiled(id);
      const col = new CollisionMap(map);
      const top = map.transitions.filter((t) => t.y === o.y && t.x >= o.x && t.x <= o.x + 1);
      expect(top.map((t) => t.x).sort(), `${id}: both top cells lead down`).toEqual([o.x, o.x + 1]);
      expect(new Set(top.map((t) => `${t.targetMap}:${t.targetEntrance}`)).size).toBe(1);
      // the lower row is solid, and an arrival tile sits directly above the stairwell
      expect(col.isWalkable(o.x, o.y + 1, walk) || col.isWalkable(o.x + 1, o.y + 1, walk)).toBe(false);
      const above = Object.values(map.entrances ?? {}).some(([x, y]) => y === o.y - 1 && (x === o.x || x === o.x + 1));
      expect(above, `${id}: an entrance right above the stairwell`).toBe(true);
    }
  });
});

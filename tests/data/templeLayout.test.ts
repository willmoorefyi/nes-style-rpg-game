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
const src = parse(readFileSync(join(root, 'assets-src/maps/temple-of-fiends.yaml'), 'utf-8')) as { ground: string };
const map = parse(readFileSync(join(root, 'assets/maps/ai/temple-of-fiends.yaml'), 'utf-8')) as MapData;
const ground = src.ground.replace(/\n$/, '').split('\n');

describe('Temple of Fiends ground (TF-1)', () => {
  it('has no void cells', () => {
    expect(ground.filter((r) => r.includes('x'))).toEqual([]);
  });

  it('the compiled collision is unchanged: every wall cell blocks, and the same 234 cells are walkable', () => {
    const col = new CollisionMap(map);
    const walk = new WalkingMode();
    expect(ground.length).toBe(map.height);
    let open = 0;
    ground.forEach((r, y) => [...r].forEach((ch, x) => {
      const ok = col.isWalkable(x, y, walk);
      if ('WFx'.includes(ch)) expect(ok, `(${x}, ${y}) is a wall`).toBe(false);
      if (ok) open++;
    }));
    expect(open).toBe(234);
  });
});

/**
 * WL: three art and map fixes. The town icons show their whole walls (no flat cut where the render's ground ran off
 * its frame: Melmond, Crescent), the moored boats sit partly under water (deco `waterline`, baked by
 * assets-src/tools/waterline.py; its pixel test is `python3 -I assets-src/tools/waterline.py`, also run by
 * `build_map.py --selftest`), and Gaia's world icon stands without the two windmill decos beside it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng } from '../helpers/pngAlpha.js';

type Obj = { type: string; name?: string; x: number; y: number; parts: (string | null)[][]; on_water?: boolean;
  waterline?: number; above?: boolean; above_rows?: number; collide?: string };
const objs = (m: string) => (parse(readFileSync(`assets-src/maps/${m}.yaml`, 'utf-8')) as { objects: Obj[] }).objects;
const uses = (os: Obj[], lm: string) => os.filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith(`${lm}_icon_`)));

describe('WL: the town icons show their whole walls', () => {
  const sheet = JSON.parse(readFileSync('assets-src/gen/approved/overworld/landmarks_lm4.json', 'utf-8')) as {
    landmarks: Record<string, { at: [number, number]; cells: [number, number] }> };
  const png = readRgbaPng('assets-src/gen/approved/overworld/landmarks_lm4.png');
  const opaque = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3] > 0;
  const longestRun = (cells: boolean[]) => cells.reduce<[number, number]>(([best, cur], b) =>
    [Math.max(best, b ? cur + 1 : 0), b ? cur + 1 : 0], [0, 0])[0];

  for (const name of ['town_melmond', 'town_onrac', 'town_pravoka', 'town_elfheim', 'town_crescent', 'town_gaia',
    'lufenia']) {
    it(`${name}: no straight vertical edge over a quarter of the figure's height (a flat cut)`, () => {
      const { at: [r0, c0], cells: [w, h] } = sheet.landmarks[name];
      const X0 = c0 * 48, Y0 = r0 * 48, W = w * 48, H = h * 48;
      const cols: number[] = [], rows: number[] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (opaque(X0 + x, Y0 + y)) { cols.push(x); rows.push(y); }
      const left = Math.min(...cols), right = Math.max(...cols);
      const figH = Math.max(...rows) - Math.min(...rows) + 1;
      for (const edge of [left, left + 1, right - 1, right]) {
        const run = longestRun(Array.from({ length: H }, (_, y) => opaque(X0 + edge, Y0 + y)));
        expect(run / figH, `${name} column ${edge}`).toBeLessThan(0.25);
      }
    });
  }
});

describe('WL: the moored boats sit partly under water', () => {
  const BOATS: [string, string, number, number][] = [   // map, landmark, cells high, waterline (art px from the top)
    ['onrac', 'submarine', 2, 62], ['onrac', 'fishing_boat', 2, 84], ['pravoka', 'brig', 3, 134]];
  for (const [map, lm, rows, line] of BOATS) {
    it(`${map}: the ${lm} has waterline ${line}, on water, no above rows`, () => {
      const found = uses(objs(map), lm);
      expect(found).toHaveLength(1);
      const o = found[0];
      expect(o.parts).toHaveLength(rows);
      expect(o.waterline).toBe(line);
      expect(Number.isInteger(o.waterline) && o.waterline! >= 1 && o.waterline! < rows * 48).toBe(true);
      expect(o.on_water).toBe(true);
      expect(o.above ?? false).toBe(false);
      expect(o.above_rows ?? 0).toBe(0);
    });
  }

  it('the submarine is mostly under water: its line is in the upper hull, above the middle of the art', () => {
    const sub = uses(objs('onrac'), 'submarine')[0];
    expect(sub.waterline!).toBeLessThan(sub.parts.length * 48 * 0.7);
  });
});

describe('WL: Gaia on the world map', () => {
  const world = objs('overworld');
  const map = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as { width: number; collision: number[] };
  const BLOCKED = new Set([1, 2, 3, 7, 10, 11]);
  const walkable = (x: number, y: number) => !BLOCKED.has(map.collision[y * map.width + x]);
  const gaia = uses(world, 'town_gaia')[0];
  const door: [number, number] = [gaia.x, gaia.y + 1];

  it('no windmill deco stands beside Gaia\'s icon (the icon draws its own)', () => {
    const near = uses(world, 'windmill').filter((o) => Math.abs(o.x - door[0]) <= 8 && Math.abs(o.y - door[1]) <= 8);
    expect(near).toEqual([]);
  });

  it('a tree clump blocks the door\'s west side: the door is entered from its gate only', () => {
    const west = world.find((o) => o.name === 'gaia_door_west')!;
    expect([west.x, west.y, west.parts]).toEqual([door[0] - 1, door[1], [['tree_clump']]]);
    expect(walkable(...door)).toBe(true);
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => walkable(door[0] + dx, door[1] + dy));
    expect(open).toEqual([[0, 1]]);
  });
});

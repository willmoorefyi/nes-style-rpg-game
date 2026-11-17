/**
 * WND-O: region WIND on the compiled world map (docs/WORLD_PLAN.md 2.2, 2.8, 4.0.3, 4.7): the three anchors at their
 * targets, the three walkable basins (Gaia's bowl with the Pinewold, the Mirage sands, Lufenia's mesa) never joined
 * on foot, an airship meadow within 8 steps of each anchor, no dock, and the encounter zones (every walkable cell of
 * the box in one walking zone, every Water cell in the ship zone `wnd_sea`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { canLand } from '../../../src/systems/fieldRules.js';
import type { MapData } from '../../../src/types/index.js';

const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  tolerance: number; anchors: Array<{ entrance: string; region: string; target: [number, number] }>;
}).anchors.filter((a) => a.region === 'wind');
const BOX = { x0: 128, y0: 0, x1: 191, y1: 63 };
const BLOCKED = new Set([1, 2, 3, 7, 10, 11]);
const WATER = 2;
const at = (x: number, y: number): number => world.collision[y * world.width + x];
const walkable = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < world.width && y < world.height && !BLOCKED.has(at(x, y));
const key = (x: number, y: number): string => `${x},${y}`;

function flood(x0: number, y0: number): Map<string, number> {
  const dist = new Map([[key(x0, y0), 0]]);
  const q: Array<[number, number]> = [[x0, y0]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, ny] = [x + dx, y + dy];
      if (walkable(nx, ny) && !dist.has(key(nx, ny))) {
        dist.set(key(nx, ny), dist.get(key(x, y))! + 1);
        q.push([nx, ny]);
      }
    }
  }
  return dist;
}

const zoneHas = (id: string, x: number, y: number): boolean => (world.encounterZones ?? []).find((z) => z.id === id)!
  .rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
const cell = (e: string): [number, number] => world.entrances![e] as [number, number];
const flying = { flags: new Set<string>(), items: new Set<string>(), mode: 'airship' as const, vehicles: [] };

describe('WND-O world: region WIND', () => {
  it('the world is the 192x192 composed map', () => {
    expect([world.width, world.height]).toEqual([192, 192]);
  });

  it('wnd_gaia, wnd_mirage and wnd_lufenia stand within 2 cells of their targets', () => {
    expect(anchors.map((a) => a.entrance).sort()).toEqual(['wnd_gaia', 'wnd_lufenia', 'wnd_mirage']);
    for (const a of anchors) {
      const [x, y] = cell(a.entrance);
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
  });

  it('each door leads where the canon says, one step north of its anchor', () => {
    const doors = Object.fromEntries((world.transitions ?? []).filter((t) => t.x >= BOX.x0 && t.y <= BOX.y1)
      .map((t) => [t.targetMap, [t.x, t.y, (t as { targetEntrance?: string }).targetEntrance]]));
    expect(doors).toEqual({ gaia: [150, 13, 'gate'], 'mirage-1f': [132, 36, 'arrival'], lufenia: [152, 45, 'gate'] });
  });

  it('each door is a doorway: exactly one walkable non-warp neighbour, its anchor (OW-2\'s rule)', () => {
    for (const [e, [x, y]] of [['wnd_gaia', [150, 13]], ['wnd_mirage', [132, 36]], ['wnd_lufenia', [152, 45]]] as const) {
      const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => walkable(a, b));
      expect(out, e).toEqual([cell(e)]);
    }
  });

  it('the three basins are not joined on foot (2.8: Lufenia\'s mesa is cut off from the sands)', () => {
    const [g, m, l] = ['wnd_gaia', 'wnd_mirage', 'wnd_lufenia'].map((e) => flood(...cell(e)));
    for (const [a, b] of [[g, m], [g, l], [m, l]]) for (const k of a.keys()) expect(b.has(k)).toBe(false);
    expect(g.has(key(...cell('cornelia')))).toBe(false);
  });

  it('every anchor has an airship landing cell (grass, no warp) within 8 steps (2.8, T6)', () => {
    for (const e of ['wnd_gaia', 'wnd_mirage', 'wnd_lufenia']) {
      const near = [...flood(...cell(e))].filter(([, d]) => d <= 8).map(([k]) => k.split(',').map(Number));
      expect(near.some(([x, y]) => canLand(world, { x, y }, flying)), e).toBe(true);
    }
  });

  it('WIND has no dock (airship-only, 2.8)', () => {
    expect((world.docks ?? []).filter((d) => d.x >= BOX.x0 && d.y <= BOX.y1)).toEqual([]);
  });

  it('every walkable cell of the box is in exactly one walking zone; every Water cell in wnd_sea (4.0.3)', () => {
    const walking = ['wnd_highlands', 'wnd_mirage_sands', 'wnd_lufen_moor'];
    const zones = (world.encounterZones ?? []).filter((z) => z.id.startsWith('wnd_'));
    expect(zones.map((z) => [z.id, (z as { name?: string }).name])).toEqual([['wnd_highlands', 'Gaia Highlands'],
      ['wnd_mirage_sands', 'Mirage Sands'], ['wnd_lufen_moor', 'Lufenian Mesa'], ['wnd_sea', 'North Seas']]);
    expect((zones[3] as { modes?: string[] }).modes).toEqual(['ship']);
    for (let y = BOX.y0; y <= BOX.y1; y++) {
      for (let x = BOX.x0; x <= BOX.x1; x++) {
        if (walkable(x, y)) expect(walking.filter((z) => zoneHas(z, x, y)), key(x, y)).toHaveLength(1);
        if (at(x, y) === WATER) expect(zoneHas('wnd_sea', x, y), key(x, y)).toBe(true);
      }
    }
  });

  it('each walking zone is one basin: its anchor\'s component', () => {
    for (const [z, e] of [['wnd_highlands', 'wnd_gaia'], ['wnd_mirage_sands', 'wnd_mirage'], ['wnd_lufen_moor', 'wnd_lufenia']]) {
      for (const k of flood(...cell(e)).keys()) expect(zoneHas(z, ...(k.split(',').map(Number) as [number, number])), `${z} ${k}`).toBe(true);
    }
  });
});

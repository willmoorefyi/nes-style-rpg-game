/**
 * The frozen act-1 core (docs/WORLD_PLAN.md 2.5, D-W11; W1-C2): the world source (assets-src/maps/overworld.yaml,
 * written by layouts/world.py) holds the act-1 overworld translated by `world.frames.a1.origin`, byte for byte.
 * The fixtures are the act-1 `overworld.py` output and its compiled collision at mainline f2f2383, before the move.
 * Outside the four exception rects every ground cell, and every act-1 object, NPC, gate, transition, inspect cell,
 * entrance and zone is unchanged under the translation; in X_west and X_east a cell may only turn from ocean to
 * mountain. The ship spawn may move (A1-T); the canoe spawn is gone (QUEST 3.3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

type Rect = [number, number, number, number];
type Doc = Record<string, unknown> & {
  ground: string; entrances: Record<string, [number, number]>;
  vehicles?: Array<{ type: string; x: number; y: number }>;
  world?: { frames: { a1: { origin: [number, number]; size: [number, number] } } };
};
const act1 = parse(readFileSync(join(here, 'act1Overworld.fixture.yaml'), 'utf-8')) as Doc;
const act1Coll = JSON.parse(readFileSync(join(here, 'act1Collision.fixture.json'), 'utf-8')) as
  { width: number; height: number; collision: string };
const world = parse(readFileSync(join(root, 'assets-src/maps/overworld.yaml'), 'utf-8')) as Doc;
const compiled = parse(readFileSync(join(root, 'assets/maps/ai/overworld.yaml'), 'utf-8')) as
  { width: number; height: number; collision: number[]; world?: Doc['world'] };

const rows = (d: Doc) => d.ground.trimEnd().split('\n');
const [OX, OY] = world.world!.frames.a1.origin;
/** 2.5's exception rects, local act-1 cells (x0, y0, x1, y1 inclusive); `oToM`: only ocean to mountain. */
const EXCEPTIONS: Array<{ id: string; rect: Rect; oToM: boolean }> = [
  { id: 'X_pravoka', rect: [58, 26, 71, 44], oToM: false },
  { id: 'X_matoya', rect: [6, 8, 14, 16], oToM: false },
  { id: 'X_west', rect: [0, 14, 7, 20], oToM: true },
  { id: 'X_east', rect: [64, 12, 71, 18], oToM: true },
];
const exceptionAt = (x: number, y: number) =>
  EXCEPTIONS.find(({ rect: [x0, y0, x1, y1] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

/** A source value moved by the origin: every `x` / `y` key, and the `rects` of zones. */
function shift(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shift);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => {
      if ((k === 'x' || k === 'y') && typeof val === 'number') return [k, val + (k === 'x' ? OX : OY)];
      if (k === 'rects') return [k, (val as Rect[]).map(([a, b, c, d]) => [a + OX, b + OY, c + OX, d + OY])];
      return [k, shift(val)];
    }));
  }
  return v;
}
const listOf = (d: Doc, key: string) => (d[key] ?? []) as unknown[];

describe('the frozen act-1 core (WORLD_PLAN 2.5)', () => {
  it('the world is 192x192 with the act-1 frame at (64, 64), 72x72', () => {
    expect(world.world!.frames.a1).toEqual({ origin: [64, 64], size: [72, 72] });
    expect(rows(world).length).toBe(192);
    for (const r of rows(world)) expect(r.length).toBe(192);
    expect(rows(act1).length).toBe(72);
  });

  it('every core ground cell equals the act-1 cell, except in the four rects (X_west, X_east: o -> m only)', () => {
    const a = rows(act1), w = rows(world);
    const changed: string[] = [];
    for (let y = 0; y < 72; y++) {
      for (let x = 0; x < 72; x++) {
        const was = a[y][x], now = w[y + OY][x + OX], ex = exceptionAt(x, y);
        if (was === now || (ex && !ex.oToM) || (ex?.oToM && was === 'o' && now === 'm')) continue;
        changed.push(`(${x}, ${y}) ${was} -> ${now}`);
      }
    }
    expect(changed).toEqual([]);
  });

  it('every act-1 object, NPC, gate, transition, inspect cell and zone is present, translated', () => {
    // WORLD_PLAN 4.1 (A1-O): the only act-1 edits allowed are the bridge workers' lines (BRIDGE_WORKERS: their dialog
    // and the foreman's cutscene) and the gate's message (GATE_MESSAGE); everything else about them stays
    const loose = (key: string, item: unknown): unknown => {
      const o = item as Record<string, unknown>;
      if (key === 'npcs' && String(o.id).startsWith('bridge_worker_')) {
        const { dialog: _d, cutscene: _c, requiredItem: _r, ...rest } = o;
        return rest;
      }
      if (key === 'keyItemGates' && o.requiredFlag === 'BRIDGE_BUILT') {
        // NW-1: the world's bridge gates are named (`id`, quest.yaml's nonLoadBearing `ref`)
        const { message: _m, id: _id, ...rest } = o;
        return rest;
      }
      return item;
    };
    for (const key of ['objects', 'npcs', 'keyItemGates', 'transitions', 'inspect', 'encounterZones']) {
      const now = listOf(world, key).map((i) => loose(key, i));
      for (const item of listOf(act1, key)) expect(now, key).toContainEqual(loose(key, shift(item)));
    }
    const zones = (world.battleBackgrounds as { zones: Record<string, unknown> }).zones;
    expect(zones).toMatchObject((act1.battleBackgrounds as { zones: Record<string, unknown> }).zones);
  });

  it('every act-1 entrance is present, translated, and cornelia stays the first', () => {
    expect(Object.keys(world.entrances)[0]).toBe('cornelia');
    for (const [name, [x, y]] of Object.entries(act1.entrances)) expect(world.entrances[name], name).toEqual([x + OX, y + OY]);
  });

  it('LM4-INT (user ruling 2026-11-19): Pravoka\'s icon grew to exactly 3x3 at x 130-132, y 98-100, inside X_pravoka', () => {
    type Deco = { name?: string; x: number; y: number; parts: (string | null)[][]; walk_cells?: [number, number][] };
    const icon = (listOf(world, 'objects') as Deco[]).find((o) => o.name === 'pravoka')!;
    const cells: string[] = [];
    icon.parts.forEach((row, j) => row.forEach((_, i) => cells.push(`${icon.x + i},${icon.y + j}`)));
    const want: string[] = [];
    for (let y = 98; y <= 100; y++) for (let x = 130; x <= 132; x++) want.push(`${x},${y}`);
    expect(cells).toEqual(want);
    for (const c of cells) {
      const [x, y] = c.split(',').map(Number);
      expect(exceptionAt(x - OX, y - OY)?.id, c).toBe('X_pravoka');
    }
    expect(icon.walk_cells!.map(([i, j]) => [icon.x + i, icon.y + j])).toEqual([[131, 100]]);
    expect(world.entrances.a1_pravoka).toEqual([131, 101]);
  });

  it('the ship spawn may move; the canoe spawn is removed (the canoe is an ability)', () => {
    expect(act1.vehicles!.map((v) => v.type)).toEqual(['ship', 'canoe']);
    expect((world.vehicles ?? []).filter((v) => v.type === 'canoe')).toEqual([]);
    expect((world.vehicles ?? []).filter((v) => v.type === 'ship')).toHaveLength(1);
  });

  it('the compiled world keeps the act-1 collision under the translation (Lake: Water -> Lake, W1-C1)', () => {
    expect([compiled.width, compiled.height]).toEqual([192, 192]);
    expect(compiled.world?.frames.a1).toEqual(world.world!.frames.a1);
    const a = rows(act1);
    const changed: string[] = [];
    for (let y = 0; y < act1Coll.height; y++) {
      for (let x = 0; x < act1Coll.width; x++) {
        const was = act1Coll.collision.charCodeAt(y * act1Coll.width + x) - 48;
        const now = compiled.collision[(y + OY) * compiled.width + x + OX];
        const ex = exceptionAt(x, y);
        // the one planned remap since the fixture: a lake cell (≈) compiles to TerrainType.Lake (11), not Water (2)
        const lake = a[y][x] === '≈' && was === 2 && now === 11;
        if (was === now || lake || (ex && !ex.oToM) || (ex?.oToM && was === 2 && now === 3)) continue;
        changed.push(`(${x}, ${y}) ${was} -> ${now}`);
      }
    }
    expect(changed).toEqual([]);
  });
});

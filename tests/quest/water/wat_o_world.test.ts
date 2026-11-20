/**
 * Region WATER on the NW world source (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 4.1, 7 NW-R; WAT-O's
 * `tests/quest/water/wat_o_world.test.ts` rewritten against the owner grid). Committed sources only: the NW world
 * source `assets-src/maps/overworld.yaml` and its anchors. WATER's cells are read from its owner-grid raster
 * (`regions.water.raster`, chunk rects) and Onrac's land: the walk + canoe component of Onrac's gate (the north's
 * one landmass, which it shares with ORDEAL and WIND, 3.8 `north`) within REACH cells of a WATER anchor, where the
 * owner grid gives every cell to WATER (the composer's `coverage` check proves the zones on the owner grid itself).
 *
 * The three anchors at their targets with a grass landing within 8 steps; no dock (airship-only); the cave behind
 * the falls reached by canoe only (the ledge holds no grass and joins nothing on foot but its door); R-waterfall to
 * the sea; the doors, icons, inspect cells and sea-stacks; the four zones with today's ids, every walkable or canoe
 * cell of the continent in one, every Water cell in at most one ship zone; the snow and tundra backdrops.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Zone { id: string; modes?: string[]; rects: [number, number, number, number][]; encounters: { groups?: { id: string }[] }[] }
interface Src {
  ground: string;
  entrances: Record<string, XY>;
  transitions: { x: number; y: number; targetMap: string; targetEntrance?: string }[];
  objects: { type: string; name?: string; x: number; y: number; parts: string[][]; walk_cells?: XY[] }[];
  inspect: { x: number; y: number; text: string[] }[];
  docks: { id: string; x: number; y: number }[];
  spots: Record<string, { at: XY; kind: string }>;
  encounterZones: Zone[];
  battleBackgrounds: { zones: Record<string, { default?: string; terrain?: Record<string, string> }> };
  regions: Record<string, { raster: [number, number, number, number][]; checks?: Record<string, unknown> }>;
}

const src = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Src;
const anchorFile = parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  tolerance: number; anchors: { entrance: string; region: string; target: XY }[];
};
const anchors = anchorFile.anchors.filter((a) => a.region === 'water');
const g = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = g.length;
const at = ([x, y]: XY): string => g[y]?.[x] ?? 'o';
const key = ([x, y]: XY): string => `${x},${y}`;
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const walkable = (c: string): boolean => !BLOCK.has(c);
const canoe = (c: string): boolean => c === 'r' || c === '≈';
const DIRS: XY[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const doors = new Set(src.transitions.map((t) => key([t.x, t.y])));
const E = (name: string): XY => src.entrances[name];
const raster = src.regions.water.raster;
const inRaster = ([x, y]: XY): boolean => raster.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

/** Cells reached from `from` by 4-steps onto cells `ok` accepts, stopping at doors (as the field does). */
function reach(from: XY, ok: (c: string) => boolean): Set<string> {
  const seen = new Set([key(from)]);
  const q: XY[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (i > 0 && doors.has(key([x, y]))) continue;
    for (const [dx, dy] of DIRS) {
      const n: XY = [x + dx, y + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || seen.has(key(n)) || !ok(at(n))) continue;
      seen.add(key(n));
      q.push(n);
    }
  }
  return seen;
}
const cellsOf = (s: Set<string>): XY[] => [...s].map((k) => k.split(',').map(Number) as XY);
/** The north's landmass: the walk + canoe component of Onrac's gate (no doors stop it). */
const north = (() => {
  const seen = new Set([key(E('wat_onrac'))]);
  const q: XY[] = [E('wat_onrac')];
  for (let i = 0; i < q.length; i++) for (const [dx, dy] of DIRS) {
    const n: XY = [q[i][0] + dx, q[i][1] + dy];
    if (!seen.has(key(n)) && at(n) !== 'o') { seen.add(key(n)); q.push(n); }
  }
  return seen;
})();
const REACH = 16;
const nearWater = ([x, y]: XY): boolean =>
  ['wat_onrac', 'wat_waterfall', 'wat_caravan'].some((e) => Math.max(Math.abs(x - E(e)[0]), Math.abs(y - E(e)[1])) <= REACH);
/** Onrac's land: the north's landmass near WATER's anchors (WATER's own cells on the owner grid). */
const continent = new Set([...north].filter((k) => nearWater(k.split(',').map(Number) as XY)));

describe('NW-R WATER: the anchors, the landings and no dock', () => {
  it('the NW world is 256 x 256 and holds the three WATER anchors', () => {
    expect([g.length, g[0].length]).toEqual([256, 256]);
    expect(anchors.map((a) => a.entrance).sort()).toEqual(['wat_caravan', 'wat_onrac', 'wat_waterfall']);
  });

  for (const a of anchors) {
    it(`${a.entrance} is within ${anchorFile.tolerance} of its target ${a.target.join(', ')}, on WATER's land, with grass within 8 steps`, () => {
      const [x, y] = E(a.entrance);
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1]))).toBeLessThanOrEqual(anchorFile.tolerance);
      expect(walkable(at([x, y]))).toBe(true);
      expect(inRaster([x, y]) && continent.has(key([x, y]))).toBe(true);
      let near = false;
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 8 && at([x + dx, y + dy]) === '.' && !doors.has(key([x + dx, y + dy]))) near = true;
      }
      expect(near).toBe(true);
    });
  }

  it("the airship's landing spots are grass (the runtime lands on grass until NW-5's tundra row)", () => {
    expect(src.spots.wat_s_onrac.at).toEqual(E('wat_onrac'));
    for (const s of ['wat_s_onrac_airship', 'wat_s_caravan_airship']) {
      expect(src.spots[s].kind).toBe('landing');
      expect(at(src.spots[s].at), s).toBe('.');
      expect(continent.has(key(src.spots[s].at))).toBe(true);
    }
  });

  it('WATER has no dock; its landmass holds no dock and only the north\'s entrances (2.8, 3.8 north)', () => {
    expect(src.docks.filter((d) => d.id.startsWith('wat') || north.has(key([d.x, d.y])))).toEqual([]);
    for (const d of src.docks) for (const [dx, dy] of DIRS) expect(north.has(key([d.x + dx, d.y + dy]))).toBe(false);
    const on = Object.entries(src.entrances).filter(([, c]) => north.has(key(c))).map(([e]) => e.split('_')[0]);
    // only the north's (NW-RINT: since NW-R ORDEAL parted the Citadel's crescent from Onrac, WATER's component
    // may hold WATER's entrances alone)
    expect([...new Set(on)].every((p) => ['ord', 'wat', 'wnd'].includes(p)) && on.includes('wat')).toBe(true);
    const mine = Object.entries(src.entrances).filter(([, c]) => continent.has(key(c))).map(([e]) => e).sort();
    expect(mine).toEqual(['wat_caravan', 'wat_onrac', 'wat_waterfall']);
  });
});

describe('NW-R WATER: R-waterfall and the cave behind the falls (4.1; NW-4 ledge kept)', () => {
  const ledge = reach(E('wat_waterfall'), walkable);
  const door = src.transitions.find((t) => t.targetMap === 'waterfall-cave')!;

  it('on foot the ledge is a pocket of at most 3 cells, none grass, whose only door is the cave', () => {
    const cells = cellsOf(ledge);
    expect(cells.length).toBeLessThanOrEqual(3);
    for (const c of cells) expect(at(c)).not.toBe('.');
    expect(cells.filter((c) => doors.has(key(c))).map(key)).toEqual([key([door.x, door.y])]);
    expect(door.targetEntrance).toBe('arrival');
  });

  it("Onrac does not reach the ledge on foot; by canoe it does", () => {
    expect(reach(E('wat_onrac'), walkable).has(key(E('wat_waterfall')))).toBe(false);
    expect(reach(E('wat_onrac'), (c) => walkable(c) || canoe(c)).has(key(E('wat_waterfall')))).toBe(true);
  });

  it('the river meets the sea, so the ship cannot sail up it (River is not Water)', () => {
    const river = cellsOf(reach(E('wat_waterfall'), (c) => c === 'r' || c === 's')).filter((c) => at(c) === 'r');
    expect(river.length).toBeGreaterThan(30);
    expect(river.some(([x, y]) => DIRS.some(([dx, dy]) => at([x + dx, y + dy]) === 'o'))).toBe(true);
  });
});

describe('NW-R WATER: the doors, icons, inspect cells and sea-stacks', () => {
  const mine = src.transitions.filter((t) => continent.has(key([t.x, t.y])));

  it('the doors lead to Onrac, the waterfall cave and the caravan camp, each one step north of its entrance', () => {
    expect(mine.map((t) => `${t.targetMap}:${t.targetEntrance}`).sort())
      .toEqual(['caravan-camp:arrival', 'onrac:gate', 'waterfall-cave:arrival']);
    const of = { onrac: 'wat_onrac', 'waterfall-cave': 'wat_waterfall', 'caravan-camp': 'wat_caravan' } as Record<string, string>;
    for (const t of mine) expect([t.x, t.y + 1]).toEqual(E(of[t.targetMap]));
  });

  it("each door is its icon's walk cell: Onrac's 5x3 town icon, the 2x3 falls, the 2x2 tent", () => {
    const icon = (name: string) => src.objects.find((o) => o.name === name)!;
    for (const [name, map, w, h] of [['onrac', 'onrac', 5, 3], ['waterfall', 'waterfall-cave', 2, 3], ['caravan', 'caravan-camp', 2, 2]] as const) {
      const o = icon(name);
      const t = mine.find((tr) => tr.targetMap === map)!;
      expect([o.parts[0].length, o.parts.length], name).toEqual([w, h]);
      expect(o.walk_cells, name).toEqual([[t.x - o.x, t.y - o.y]]);
    }
    const falls = icon('waterfall');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      if ([i, j].join() !== falls.walk_cells![0].join()) expect(at([falls.x + i, falls.y + j])).toBe('m');
    }
  });

  it('the cairn stands on the bank of R-waterfall and the post by the camp, each with a walkable neighbour', () => {
    expect(src.inspect.filter((i) => continent.has(key([i.x, i.y])))).toHaveLength(2);
    for (const i of src.inspect.filter((q) => continent.has(key([q.x, q.y])))) {
      expect(DIRS.some(([dx, dy]) => walkable(at([i.x + dx, i.y + dy])) && !doors.has(key([i.x + dx, i.y + dy])))).toBe(true);
    }
    const cairn = src.inspect.find((i) => i.text[0].startsWith('A cairn'))!;
    expect(DIRS.some(([dx, dy]) => at([cairn.x + dx, cairn.y + dy]) === 'r')).toBe(true);
    const post = src.inspect.find((i) => i.text[0].startsWith('Words burned'))!;
    const [cx, cy] = E('wat_caravan');
    expect(Math.abs(post.x - cx) + Math.abs(post.y - cy)).toBeLessThanOrEqual(6);
  });

  it("at least three 2x2 basalt sea-stacks stand in WATER's sea off Onrac, each ringed by water", () => {
    const [gx, gy] = E('wat_onrac');
    let n = 0;
    for (let y = gy; y < gy + 30; y++) for (let x = gx - 10; x < gx + 20; x++) {
      const box = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]): XY => [x + i, y + j]);
      if (!box.every((c) => at(c) === 'm')) continue;
      const ring: XY[] = [];
      for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) if (i < 0 || i > 1 || j < 0 || j > 1) ring.push([x + i, y + j]);
      if (ring.every((c) => at(c) === 'o') && inRaster([x, y])) n++;
    }
    expect(n).toBeGreaterThanOrEqual(3);
  });
});

describe('NW-R WATER: the encounter zones on the owner grid (3.3, 3.8 coverage)', () => {
  const zones = src.encounterZones.filter((z) => z.id.startsWith('wat_'));
  const holds = (z: Zone, [x, y]: XY): boolean => z.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const applies = (z: Zone, m: string): boolean => (z.modes ?? ['walking', 'canoe']).includes(m);

  it("WATER's zones keep today's ids, order and modes, and lie inside WATER's raster", () => {
    expect(zones.map((z) => `${z.id}:${(z.modes ?? []).join('+')}`)).toEqual(['wat_streams:canoe', 'wat_dunes:', 'wat_isles:', 'wat_sea:ship']);
    for (const z of zones) for (const [x0, y0, x1, y1] of z.rects) expect(inRaster([x0, y0]) && inRaster([x1, y1]), z.id).toBe(true);
  });

  it("every walkable cell of Onrac's continent is in a walking zone of WATER, every River and Lake cell in a canoe zone", () => {
    const missing: string[] = [];
    for (const c of cellsOf(continent)) {
      if (walkable(at(c)) && !zones.some((z) => applies(z, 'walking') && holds(z, c))) missing.push(key(c));
      if (canoe(at(c)) && !zones.some((z) => applies(z, 'canoe') && holds(z, c))) missing.push(`canoe ${key(c)}`);
    }
    expect(missing).toEqual([]);
  });

  it('the caravan camp is in the dunes, Onrac and the ledge in the coast zone; the dunes hold sand', () => {
    const first = (c: XY, m: string): string | undefined => zones.find((z) => applies(z, m) && holds(z, c))?.id;
    expect(first(E('wat_caravan'), 'walking')).toBe('wat_dunes');
    expect(first(E('wat_onrac'), 'walking')).toBe('wat_isles');
    expect(first(E('wat_waterfall'), 'walking')).toBe('wat_isles');
    expect(first(E('wat_waterfall'), 'canoe')).toBe('wat_streams');
    const dunes = zones.find((z) => z.id === 'wat_dunes')!;
    const sand = dunes.rects.flatMap(([x0, y, x1]) => [...Array(x1 - x0 + 1).keys()].map((i): XY => [x0 + i, y])).filter((c) => at(c) === 's');
    expect(sand.length).toBeGreaterThan(20);
  });

  it('every Water cell is in at most one ship zone, and wat_sea holds only Water', () => {
    const ship = src.encounterZones.filter((z) => (z.modes ?? []).includes('ship'));
    const count = new Map<string, number>();
    for (const z of ship) for (const [x0, y0, x1, y1] of z.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      count.set(key([x, y]), (count.get(key([x, y])) ?? 0) + 1);
      if (z.id === 'wat_sea') expect(at([x, y])).toBe('o');
    }
    expect([...count.values()].filter((v) => v > 1)).toEqual([]);
  });

  it('neighbouring zones share no species', () => {
    const species = (z: Zone): Set<string> => new Set(z.encounters.flatMap((e) => (e.groups ?? []).map((q) => q.id)));
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
      const a = species(zones[i]);
      expect([...species(zones[j])].filter((s) => a.has(s)), `${zones[i].id} / ${zones[j].id}`).toEqual([]);
    }
  });

  it('the backdrops: today\'s per zone, and snow and tundra on the coast zone (D-NW9), all staged ids', () => {
    const b = src.battleBackgrounds.zones;
    expect(b.wat_streams.default).toBe('waterfall');
    expect(b.wat_dunes.default).toBe('desert');
    expect(b.wat_sea.default).toBe('ocean');
    expect(b.wat_isles.terrain).toMatchObject({ forest: 'forest', snow: 'ice_cave', tundra: 'shoreline' });
    const ids = Object.values(b).flatMap((t) => [t.default, ...Object.values(t.terrain ?? {})]).filter((v): v is string => !!v);
    for (const id of ids) expect(existsSync(`assets/backgrounds/${id}.webp`), id).toBe(true);
  });

  it("WATER's map checks run on its raster (warp_leaves: every door leaves by one cell)", () => {
    expect(src.regions.water.checks).toEqual({ warp_leaves: true });
  });
});

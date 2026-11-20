/**
 * NW-R WIND (docs/NATURAL_WORLD_PLAN.md 2.3, 3.3, 3.8, 5.2): region WIND on the NW world source
 * `assets-src/maps-nw/overworld.yaml` (committed source only; pass W's `tests/quest/wind/wnd_o_world.test.ts` keeps
 * testing today's compiled world until NW-5). The three anchors within 2 cells of `maps-nw/world-anchors.yaml`'s
 * targets with their doors one step north; each door a doorway (OW-2); the three parts (Gaia's arm with the Pinewold,
 * the Mirage sands, Lufenia's mesa) never joined on foot and joined to no other region's entrance; the sands closed by
 * their mountain ring; an airship meadow within 8 steps of each door; no dock; pass W's zone ids, names and modes,
 * the zones closed on foot and by canoe (3.8 `coverage`: no walkable or canoe cell beside WIND's land left out); the
 * backdrops, snow and tundra included (D-NW9); the cairn and the dial.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Obj { type: string; name?: string; x: number; y: number; parts?: (string | null)[][]; walk_cells?: XY[] }
interface Zone { id: string; name: string; modes?: string[]; rects: [number, number, number, number][] }
const src = parse(readFileSync('assets-src/maps-nw/overworld.yaml', 'utf-8')) as {
  ground: string; entrances: Record<string, XY>; objects: Obj[]; inspect: { x: number; y: number; text: string[] }[];
  transitions: { x: number; y: number; targetMap: string; targetEntrance?: string }[];
  docks: { id: string; x: number; y: number }[]; spots: Record<string, { at: XY; kind: string }>;
  encounterZones: Zone[]; battleBackgrounds: { zones: Record<string, { default?: string; terrain?: Record<string, string> }> };
};
const anchors = (parse(readFileSync('assets-src/maps-nw/world-anchors.yaml', 'utf-8')) as {
  tolerance: number; anchors: { entrance: string; region: string; target: XY }[];
});
const g = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = g.length;
const E = src.entrances;
const PARTS = [['wnd_highlands', 'wnd_gaia'], ['wnd_mirage_sands', 'wnd_mirage'], ['wnd_lufen_moor', 'wnd_lufenia']];
const key = (x: number, y: number): number => y * N + x;
const at = (k: number): XY => [k % N, Math.floor(k / N)];
const walk = (x: number, y: number): boolean => !['o', 'm', 'r', '≈'].includes(g[y]?.[x] ?? 'o');
const wet = (x: number, y: number): boolean => ['r', '≈'].includes(g[y]?.[x] ?? 'o');
const NB: XY[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** The objects' blocked cells: a named part blocks unless it is one of its walk cells (map_checks_region's rule). */
const blocked = new Set<number>();
for (const o of src.objects) {
  (o.parts ?? [["object"]]).forEach((row, j) => row.forEach((p, i) => {
    if (p && !(o.walk_cells ?? []).some(([a, b]) => a === i && b === j)) blocked.add(key(o.x + i, o.y + j));
  }));
}

function flood(from: XY, ok: (x: number, y: number) => boolean): Map<number, number> {
  const d = new Map([[key(...from), 0]]);
  const q: XY[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of NB) {
      const n = key(x + dx, y + dy);
      if (ok(x + dx, y + dy) && !d.has(n)) { d.set(n, d.get(key(x, y))! + 1); q.push([x + dx, y + dy]); }
    }
  }
  return d;
}
const zone = (id: string): Zone => src.encounterZones.find((z) => z.id === id)!;
const cells = (z: Zone): Set<number> => {
  const s = new Set<number>();
  for (const [x0, y0, x1, y1] of z.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.add(key(x, y));
  return s;
};
const door = (e: string): XY => [E[e][0], E[e][1] - 1];

describe('NW-R WIND: region WIND on the NW world source', () => {
  it('wnd_gaia, wnd_mirage and wnd_lufenia stand within 2 cells of their targets, on walkable ground', () => {
    const mine = anchors.anchors.filter((a) => a.region === 'wind');
    expect(mine.map((a) => a.entrance).sort()).toEqual(['wnd_gaia', 'wnd_lufenia', 'wnd_mirage']);
    for (const a of mine) {
      const [x, y] = E[a.entrance];
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(anchors.tolerance);
      expect(walk(x, y), a.entrance).toBe(true);
    }
  });

  it('each door leads where the canon says, one step north of its anchor, under its approved icon', () => {
    const want: Record<string, [string, string, string]> = { wnd_gaia: ['gaia', 'gate', 'gaia'],
      wnd_mirage: ['mirage-1f', 'arrival', 'mirage'], wnd_lufenia: ['lufenia', 'gate', 'lufenia'] };
    for (const [e, [map, entrance, icon]] of Object.entries(want)) {
      const [x, y] = door(e);
      expect(src.transitions.filter((t) => t.x === x && t.y === y), e).toEqual([{ x, y, targetMap: map, targetEntrance: entrance }]);
      const o = src.objects.find((b) => b.name === icon)!;
      expect(o.walk_cells!.map(([i, j]) => [o.x + i, o.y + j]), e).toEqual([[x, y]]);
    }
    expect(src.objects.find((o) => o.name === 'gaia')!.parts![0][0]).toBe('town_gaia_icon_0_0');
    expect(src.objects.find((o) => o.name === 'mirage')!.parts!).toHaveLength(3);
    expect(src.objects.find((o) => o.name === 'lufenia')!.parts![0]).toHaveLength(4);
  });

  it("each door is a doorway: exactly one walkable neighbour, its anchor (OW-2's rule)", () => {
    for (const [, e] of PARTS) {
      const [x, y] = door(e);
      const out = NB.map(([dx, dy]): XY => [x + dx, y + dy]).filter(([a, b]) => walk(a, b) && !blocked.has(key(a, b)));
      expect(out, e).toEqual([E[e]]);
    }
  });

  it('the three parts never join on foot, and none reaches another region\'s entrance', () => {
    const floods = PARTS.map(([, e]) => flood(E[e], walk));
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) for (const k of floods[i].keys()) expect(floods[j].has(k), `${PARTS[i][1]} ${at(k)}`).toBe(false);
      for (const [name, [x, y]] of Object.entries(E)) {
        if (!name.startsWith('wnd_')) expect(floods[i].has(key(x, y)), `${PARTS[i][1]} reaches ${name}`).toBe(false);
      }
    }
  });

  it('the Mirage sands: a sand floor closed by its mountain ring (no sea beside it), with its oasis meadow', () => {
    const part = [...flood(E.wnd_mirage, walk).keys()].map(at);
    const sand = part.filter(([x, y]) => g[y][x] === 's').length;
    expect(sand / part.length).toBeGreaterThan(0.85);
    expect(part.some(([x, y]) => g[y][x] === '.')).toBe(true);
    for (const [x, y] of part) for (const [dx, dy] of NB) expect(g[y + dy][x + dx], `${x},${y}`).not.toBe('o');
  });

  it('every door has an airship landing (grass, no warp) within 8 steps; the landing spots are grass (D-NW9)', () => {
    const warps = new Set([...src.transitions.map((t) => key(t.x, t.y)), ...Object.values(E).map(([x, y]) => key(x, y))]);
    for (const [, e] of PARTS) {
      const near = [...flood(E[e], (x, y) => walk(x, y) && !blocked.has(key(x, y)))].filter(([, d]) => d <= 8);
      expect(near.some(([k]) => g[at(k)[1]][at(k)[0]] === '.' && !warps.has(k)), e).toBe(true);
    }
    for (const s of ['wnd_s_gaia_airship', 'wnd_s_sky_airship', 'wnd_s_mirage_airship', 'wnd_s_lufenia_airship']) {
      const { at: [x, y], kind } = src.spots[s];
      expect([kind, g[y][x]], s).toEqual(['landing', '.']);
    }
    expect(src.spots.wnd_s_gaia.at).toEqual(E.wnd_gaia);
    const [sx, sy] = src.spots.wnd_s_ship.at;
    expect([src.spots.wnd_s_ship.kind, g[sy][sx]]).toEqual(['dock', 'o']);
  });

  it("WIND has no dock (airship only, WORLD 2.8): no dock id of WIND's, none beside its land", () => {
    const land = new Set(PARTS.flatMap(([z]) => [...cells(zone(z))]));
    expect(src.docks.filter((d) => d.id.startsWith('wnd') || NB.some(([dx, dy]) => land.has(key(d.x + dx, d.y + dy))))).toEqual([]);
  });

  it("pass W's zones, ids, names and modes; the walking zones hold their parts and are closed on foot and by canoe", () => {
    const zs = src.encounterZones.filter((z) => z.id.startsWith('wnd_'));
    expect(zs.map((z) => [z.id, z.name, z.modes])).toEqual([['wnd_highlands', 'Gaia Highlands', undefined],
      ['wnd_mirage_sands', 'Mirage Sands', undefined], ['wnd_lufen_moor', 'Lufenian Mesa', undefined],
      ['wnd_tarns', 'Highland Tarns', ['canoe']], ['wnd_sea', 'North Seas', ['ship']]]);
    const own = new Map<number, string>();
    for (const z of zs.filter((x) => x.id !== 'wnd_sea')) {
      for (const k of cells(z)) { expect(own.get(k), `${z.id} ${at(k)}`).toBeUndefined(); own.set(k, z.id); }
    }
    for (const [z, e] of PARTS) for (const k of flood(E[e], walk).keys()) expect(own.get(k), `${z} ${at(k)}`).toBe(z);
    for (const [k, z] of own) {
      const [x, y] = at(k);
      expect(walk(x, y) || wet(x, y), `${z} ${x},${y}`).toBe(true);
      if (z === 'wnd_tarns') expect(wet(x, y)).toBe(true);
      for (const [dx, dy] of NB) {
        if (walk(x + dx, y + dy) || wet(x + dx, y + dy)) expect(own.has(key(x + dx, y + dy)), `${z} ${x + dx},${y + dy}`).toBe(true);
      }
    }
    for (const k of cells(zone('wnd_sea'))) expect(g[at(k)[1]][at(k)[0]]).toBe('o');
  });

  it('every WIND zone has a staged backdrop; the walking zones map snow and tundra (D-NW9)', () => {
    const bg = src.battleBackgrounds.zones;
    for (const z of ['wnd_highlands', 'wnd_mirage_sands', 'wnd_lufen_moor', 'wnd_tarns', 'wnd_sea']) {
      const ids = [bg[z].default, ...Object.values(bg[z].terrain ?? {})];
      for (const id of ids) expect(existsSync(`assets/backgrounds/${id}.webp`), `${z} ${id}`).toBe(true);
    }
    for (const [z] of PARTS) expect(Object.keys(bg[z].terrain!)).toEqual(expect.arrayContaining(['snow', 'tundra']));
    expect(bg.wnd_mirage_sands.default).toBe('desert');
  });

  it('the cairn in the neck of Gaia\'s arm and the dial in the sands: inspect boulders read from their part', () => {
    for (const [word, z] of [['cairn', 'wnd_highlands'], ['dial', 'wnd_mirage_sands']]) {
      const i = src.inspect.find((c) => c.text.join(' ').includes(word))!;
      expect(blocked.has(key(i.x, i.y)), word).toBe(true);
      const part = cells(zone(z));
      expect(NB.some(([dx, dy]) => part.has(key(i.x + dx, i.y + dy)) && walk(i.x + dx, i.y + dy)), word).toBe(true);
    }
  });
});

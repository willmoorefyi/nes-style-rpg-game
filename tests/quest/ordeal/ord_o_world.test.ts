/**
 * NW-R ORDEAL (docs/NATURAL_WORLD_PLAN.md 2.3, 3.3, 3.8, 4.1, 7): today's `tests/quest/ordeal/ord_o_world.test.ts`
 * rewritten against the NW world source `assets-src/maps/overworld.yaml` and its owner grid (each region's
 * `regions.<r>.raster` chunks; committed sources only). The two anchors at their NW targets with their doors one
 * step north; airship-only land (no dock, no walk or canoe path joins the arc, an islet or another region); a grass
 * landing within 8 steps of the Citadel and of every islet, the meadow below the gate; the crescent's cold north rim;
 * the icons (the Citadel between its pillars on the crag, Bahamut's cave mouth, the hermit's hut and slate); the
 * zones with today's ids and rosters covering every walkable and canoe cell of ORDEAL's land (3.8 `coverage`) and
 * ORDEAL's water; the backdrops, snow and taiga included (D-NW9, NW2).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Zone { id: string; name: string; modes: string[]; rects: number[][]; encounters: unknown[] }
interface Obj { type: string; name?: string; parts: (string | null)[][]; x: number; y: number;
  walk_cells?: number[][]; collide?: string }
interface Src {
  ground: string;
  entrances: Record<string, XY>;
  transitions: { x: number; y: number; targetMap: string; targetEntrance?: string }[];
  objects: Obj[];
  inspect: { x: number; y: number; text: unknown[] }[];
  npcs: { x: number; y: number }[];
  docks: { id: string; x: number; y: number }[];
  spots: Record<string, { at: XY; kind: string }>;
  encounterZones?: Zone[];
  battleBackgrounds?: { zones: Record<string, { default: string; terrain?: Record<string, string> }> };
  regions: Record<string, { raster: number[][] }>;
}

const read = (p: string): Src => parse(readFileSync(p, 'utf-8')) as Src;
const nw = read('assets-src/maps/overworld.yaml');
const today = read('tests/fixtures/passW/overworld.yaml');
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; target: XY; region: string }> }).anchors;
const g = nw.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = g.length;
const E = nw.entrances;
const ISLES = ['ord_bahamut', 'ord_isle_hermit', 'ord_isle_north', 'ord_isle_east', 'ord_isle_stack', 'ord_isle_west'];
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const CANOE = new Set(['r', '≈']);
const walkable = (c: string): boolean => !BLOCK.has(c);
const key = (x: number, y: number): string => `${x},${y}`;
const inRaster = (r: string, x: number, y: number): boolean =>
  nw.regions[r].raster.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
const zones = (nw.encounterZones ?? []).filter((z) => z.id.startsWith('ord_'));
const zoneOf = new Map<string, string[]>();
for (const z of zones) {
  for (const [x0, y0, x1, y1] of z.rects) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) zoneOf.set(key(x, y), [...(zoneOf.get(key(x, y)) ?? []), z.id]);
  }
}

/** Steps from `from` over the cells `ok` passes, 4-connected. */
function bfs(from: XY, ok: (c: string) => boolean = walkable): Map<string, number> {
  const dist = new Map<string, number>([[key(...from), 0]]);
  const q: XY[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || dist.has(key(nx, ny)) || !ok(g[ny][nx])) continue;
      dist.set(key(nx, ny), dist.get(key(x, y))! + 1);
      q.push([nx, ny]);
    }
  }
  return dist;
}
const land = (c: string): boolean => c !== 'o';
const cellsOf = (m: Map<string, number>): XY[] => [...m.keys()].map((k) => k.split(',').map(Number) as XY);

describe('ORDEAL on the NW world (NW-R)', () => {
  it('both anchors are entrances within 2 cells of their NW targets, their doors one step north', () => {
    const own = anchors.filter((a) => a.region === 'ordeal');
    expect(own.map((a) => a.entrance).sort()).toEqual(['ord_bahamut', 'ord_citadel']);
    for (const a of own) {
      const [x, y] = E[a.entrance];
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
    for (const [e, map] of [['ord_citadel', 'citadel-1f'], ['ord_bahamut', 'bahamut-cave']] as const) {
      const [x, y] = E[e];
      expect(nw.transitions.find((t) => t.x === x && t.y === y - 1), e).toMatchObject({ targetMap: map, targetEntrance: 'arrival' });
      expect(walkable(g[y][x]) && walkable(g[y - 1][x]), e).toBe(true);
    }
  });

  it('is airship-only: the arc and each islet are their own land, on ORDEAL\'s raster, with no dock', () => {
    const masses = ['ord_citadel', ...ISLES].map((e) => bfs(E[e], land));
    const others = Object.entries(E).filter(([e]) => !e.startsWith('ord_'));
    for (const [i, m] of masses.entries()) {
      for (const [x, y] of cellsOf(m)) expect(inRaster('ordeal', x, y), key(x, y)).toBe(true);
      for (const [e, [x, y]] of others) expect(m.has(key(x, y)), `${i} holds ${e}`).toBe(false);
      for (const d of nw.docks) {
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.has(key(d.x + dx, d.y + dy)));
        expect(near, `${i} by dock ${d.id}`).toBe(false);
      }
      for (let j = i + 1; j < masses.length; j++) {
        expect(cellsOf(masses[j]).some(([x, y]) => m.has(key(x, y))), `${i} meets ${j}`).toBe(false);
      }
    }
  });

  it('a grass landing within 8 steps of the Citadel and of every islet; the meadow below the gate is grass', () => {
    const taken = new Set([...nw.transitions, ...nw.npcs].map((t) => key(t.x, t.y)));
    for (const e of ['ord_citadel', ...ISLES]) {
      const near = [...bfs(E[e])].filter(([k, d]) => {
        const [x, y] = k.split(',').map(Number);
        return d <= 8 && g[y][x] === '.' && !taken.has(k);
      });
      expect(near.length, e).toBeGreaterThan(0);
    }
    const [cx, cy] = E.ord_citadel;
    const [, my] = E.ord_meadow;
    for (let y = cy; y <= my; y++) expect(g[y][cx], `meadow (${cx}, ${y})`).toBe('.');
    for (const s of ['ord_s_citadel_airship', 'ord_s_bahamut_airship']) {
      const [x, y] = nw.spots[s].at;
      expect([nw.spots[s].kind, g[y][x]], s).toEqual(['landing', '.']);
    }
  });

  it('the crescent has a cold north rim (snow and rock) and a heath of grass round the gate', () => {
    const arc = cellsOf(bfs(E.ord_citadel, land));
    const [cx, cy] = E.ord_citadel;
    const north = arc.filter(([, y]) => y < cy - 10).map(([x, y]) => g[y][x]);
    const heath = arc.filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 8).map(([x, y]) => g[y][x]);
    expect(north.filter((c) => c === 'n' || c === 'm').length / north.length).toBeGreaterThan(0.4);
    expect(heath.filter((c) => c === '.' || c === 'f').length / heath.length).toBeGreaterThan(0.5);
  });

  it('the icons: the Citadel over its door on the crag between two pillars, the cave mouth, the hermit\'s hut', () => {
    const [cx, cy] = E.ord_citadel;
    const cit = nw.objects.find((o) => o.name === 'citadel')!;
    expect([cit.x, cit.y, cit.parts.length, cit.parts[0].length, cit.walk_cells, cit.collide])
      .toEqual([cx - 1, cy - 3, 3, 3, [[1, 2]], 'alpha']);
    for (let x = cit.x - 1; x <= cit.x + 3; x++) expect(g[cit.y][x], `crag (${x}, ${cit.y})`).toBe('m');
    const pillars = nw.objects.filter((o) => o.parts?.[0]?.[0] === 'tpillar_broken_top' && inRaster('ordeal', o.x, o.y));
    expect(pillars.map((o) => [o.x, o.y])).toEqual([[cit.x - 1, cit.y + 1], [cit.x + 3, cit.y + 1]]);
    const [bx, by] = E.ord_bahamut;
    const cave = nw.objects.find((o) => o.name === 'cave_mouth' && inRaster('ordeal', o.x, o.y))!;   // ORDEAL's
    expect([cave.x, cave.y, cave.walk_cells]).toEqual([bx - 1, by - 2, [[1, 1]]]);
    const hut = nw.objects.find((o) => o.name === 'hermit_hut')!;
    expect(bfs(E.ord_isle_hermit, land).has(key(hut.x, hut.y)), 'the hut stands on the hermit\'s islet').toBe(true);
    const boulders = nw.objects.filter((o) => o.parts?.[0]?.[0] === 'boulder' && inRaster('ordeal', o.x, o.y));
    expect(boulders).toHaveLength(3);
    for (const b of boulders) expect(g[b.y][b.x], key(b.x, b.y)).toBe('.');
  });

  it('the hermit\'s slate is the one inspect cell of ORDEAL, next to a cell walked from his islet', () => {
    const masses = ['ord_citadel', ...ISLES].map((e) => bfs(E[e], land));
    const slate = nw.inspect.filter((c) => masses.some((m) => m.has(key(c.x, c.y))));
    expect(slate).toHaveLength(1);
    const isle = bfs(E.ord_isle_hermit);
    const { x, y } = slate[0];
    expect([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => isle.has(key(a, b)))).toBe(true);
    expect(JSON.stringify(slate[0].text)).toContain('Oddo');
  });

  it('zones: today\'s ids, names and rosters; the heath on foot and by canoe, the isles too, the sound by ship', () => {
    expect(zones.map((z) => [z.id, z.name, z.modes])).toEqual([
      ['ord_heath', 'Citadel Heath', ['walking', 'canoe']], ['ord_isles', 'Cardia Isles', ['walking', 'canoe']],
      ['ord_sea', 'Cardia Sound', ['ship']]]);
    const was = new Map(((today as unknown as { encounterZones: Zone[] }).encounterZones).map((z) => [z.id, z.encounters]));
    for (const z of zones) expect(z.encounters, z.id).toEqual(was.get(z.id));
  });

  it('coverage (3.8): every walkable and canoe cell of ORDEAL\'s land is in one ORDEAL zone, the heath\'s on the arc', () => {
    const arc = bfs(E.ord_citadel, land);
    const holes: string[] = [];
    const seen = new Set<string>();
    for (const [k, ids] of zoneOf) {
      const [x, y] = k.split(',').map(Number);
      expect(ids.length, k).toBe(1);
      expect(inRaster('ordeal', x, y), k).toBe(true);
      const c = g[y][x];
      if (ids[0] === 'ord_sea') expect(c, k).toBe('o');
      else {
        expect(walkable(c) || CANOE.has(c), k).toBe(true);
        expect(arc.has(k), `${k} ${ids[0]}`).toBe(ids[0] === 'ord_heath');
        if (!seen.has(k)) {
          for (const [cx, cy] of cellsOf(bfs([x, y], land))) {
            seen.add(key(cx, cy));
            const cc = g[cy][cx];
            if ((walkable(cc) || CANOE.has(cc)) && !zoneOf.has(key(cx, cy))) holes.push(key(cx, cy));
          }
        }
      }
    }
    expect(holes.slice(0, 10), `${holes.length} cells`).toEqual([]);
    for (const e of ['ord_citadel', ...ISLES]) expect(zoneOf.has(key(...E[e])), e).toBe(true);
  });

  it('backdrops: the heath grassland (forest, taiga, snow), the isles the shoreline, the sound the deck; staged ids', () => {
    const bg = nw.battleBackgrounds!.zones;
    expect(bg.ord_heath).toEqual({ default: 'grassland', terrain: { forest: 'forest', taiga: 'dark_forest', snow: 'ice_cave' } });
    expect(bg.ord_isles).toEqual({ default: 'shoreline', terrain: { forest: 'forest', taiga: 'dark_forest', snow: 'ice_cave' } });
    expect(bg.ord_sea).toEqual({ default: 'ocean' });
    for (const z of ['ord_heath', 'ord_isles', 'ord_sea']) {
      for (const id of [bg[z].default, ...Object.values(bg[z].terrain ?? {})]) {
        expect(existsSync(`assets/backgrounds/${id}.webp`), id).toBe(true);
      }
    }
  });
});

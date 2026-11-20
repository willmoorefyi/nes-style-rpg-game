/**
 * NW-R EARTH (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 7): region EARTH on the NW world source (committed sources only:
 * `assets-src/maps-nw/overworld.yaml` and its `world-anchors.yaml`). Today's `tests/quest/earth/ert_o_world` keeps
 * testing today's compiled world until NW-5. The anchors sit within 2 cells of their targets; the canal patch alone
 * joins the Aldi to the ocean; the dwarves' landing is an Aldi dock and Melmond's harbour an ocean one; the western
 * range parts Melmond's plain from Sarda's coast on foot and by canoe, at least 3 cells thick (its exported cut 3,
 * the ridge between the giant's mouths 3 or more); every door leads to its map; the cave mouths, Melmond's icon,
 * the windmill, the shrine and the mooring post are placed; and the zones, by EARTH's raster chunks of the owner grid
 * (`regions.earth.raster`), cover every walkable or canoe cell of EARTH's two landmasses once and every Water cell
 * of its raster that no other region claims.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
type Rect = [number, number, number, number];
interface Src {
  ground: string; entrances: Record<string, XY>;
  transitions: Array<{ x: number; y: number; targetMap: string; targetEntrance?: string }>;
  objects: Array<{ name?: string; x: number; y: number; parts?: string[][]; walk_cells?: number[][] }>;
  inspect: Array<{ x: number; y: number; text: string[] }>;
  patches: Array<{ id: string; flag: string; ground: string; cells: XY[]; art_ground?: string; objects?: unknown[] }>;
  docks: Array<{ id: string; x: number; y: number; basin: string }>;
  encounterZones?: Array<{ id: string; rects: Rect[]; modes?: string[]; encounters: unknown[] }>;
  battleBackgrounds?: { zones?: Record<string, { default?: string }> };
  regions: Record<string, { raster: Rect[]; checks?: Record<string, unknown> }>;
  world: { basins: Record<string, XY>; cuts?: Record<string, XY[]> };
}
const nw = parse(readFileSync('assets-src/maps-nw/overworld.yaml', 'utf-8')) as Src;
const today = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Src;
const anchors = (parse(readFileSync('assets-src/maps-nw/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; region: string; target: XY }> }).anchors;
const g = nw.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = g.length;
const E = nw.entrances;
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const walk = (c: string) => !BLOCK.has(c);
const canoe = (c: string) => walk(c) || c === 'r' || c === '≈';
const key = ([x, y]: XY) => `${x},${y}`;

function flood(seeds: XY[], ok: (x: number, y: number) => boolean): Set<string> {
  const seen = new Set<string>();
  const q: XY[] = [];
  for (const s of seeds) if (ok(...s)) { seen.add(key(s)); q.push(s); }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(`${nx},${ny}`) || !ok(nx, ny)) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const inRects = (rs: Rect[], x: number, y: number) => rs.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
const raster = (r: string) => nw.regions[r].raster;
const others = Object.keys(nw.regions).filter((r) => r !== 'earth');
/** A cell in a chunk of EARTH's raster that no other region's raster holds. */
const earthOnly = (x: number, y: number) => inRects(raster('earth'), x, y) && !others.some((r) => inRects(raster(r), x, y));

describe('NW-R EARTH on the NW world', () => {
  it('every EARTH anchor is a walkable entrance within 2 cells of its target; the west mouth lies west of the range', () => {
    const earth = anchors.filter((a) => a.region === 'earth');
    expect(earth.map((a) => a.entrance).sort()).toEqual(['ert_dwarf', 'ert_earth_cave', 'ert_giant', 'ert_melmond', 'ert_sarda']);
    for (const a of earth) {
      const [x, y] = E[a.entrance];
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
      expect(walk(g[y][x]), a.entrance).toBe(true);
    }
    expect(E.ert_giant_west[0]).toBeLessThan(E.ert_giant[0]);
  });

  it('the canal patch (CANAL_OPEN) alone joins the Aldi to the ocean; it is grass until then and stone-banked', () => {
    const canal = nw.patches.find((p) => p.id === 'canal')!;
    expect(canal).toMatchObject({ flag: 'CANAL_OPEN', ground: 'o', art_ground: '~' });
    expect(canal.objects).toHaveLength(2);
    const open = new Set(canal.cells.map(key));
    for (const [x, y] of canal.cells) expect(g[y][x]).toBe('.');
    const wet = (cells: Set<string>) => (x: number, y: number) => g[y][x] === 'o' || cells.has(`${x},${y}`);
    expect(flood([nw.world.basins.aldi], wet(new Set())).has(key(nw.world.basins.ocean))).toBe(false);
    expect(flood([nw.world.basins.aldi], wet(open)).has(key(nw.world.basins.ocean))).toBe(true);
  });

  it("the dwarves' landing is an Aldi dock by the hall, Melmond's harbour an ocean dock by its gate", () => {
    const docks = Object.fromEntries(nw.docks.map((d) => [d.id, d]));
    expect(docks.ert_dwarf.basin).toBe('aldi');
    expect(docks.ert_melmond.basin).toBe('ocean');
    const aldi = flood([nw.world.basins.aldi], (x, y) => g[y][x] === 'o');
    for (const d of [docks.ert_dwarf, docks.ert_melmond]) expect(g[d.y][d.x]).toBe('o');
    expect(aldi.has(key([docks.ert_dwarf.x, docks.ert_dwarf.y]))).toBe(true);
    expect(aldi.has(key([docks.ert_melmond.x, docks.ert_melmond.y]))).toBe(false);
    const nextTo = (d: { x: number; y: number }, seen: Set<string>) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => seen.has(`${d.x + a},${d.y + b}`));
    const hall = flood([E.ert_dwarf], (x, y) => walk(g[y][x]));
    expect(nextTo(docks.ert_dwarf, hall)).toBe(true);
    expect(nextTo(docks.ert_melmond, flood([E.ert_melmond], (x, y) => walk(g[y][x])))).toBe(true);
    expect(hall.has(key(E.ert_melmond))).toBe(false);          // the strait parts them on foot
  });

  it("the western range parts Melmond's plain from Sarda's coast on foot and by canoe; its cut is 3 cells (GT-35)", () => {
    for (const ok of [walk, canoe]) {
      const plain = flood([E.ert_giant], (x, y) => ok(g[y][x]));
      for (const e of ['ert_melmond', 'ert_earth_cave']) expect(plain.has(key(E[e])), e).toBe(true);
      for (const e of ['ert_sarda', 'ert_giant_west']) expect(plain.has(key(E[e])), e).toBe(false);
    }
    const cut = nw.world.cuts!.western_range;
    expect(cut.length).toBeGreaterThanOrEqual(3);
    const opened = new Set(cut.map(key));
    expect(flood([E.ert_giant], (x, y) => walk(g[y][x]) || opened.has(`${x},${y}`)).has(key(E.ert_sarda))).toBe(true);
  });

  it("the ridge between the giant's two mouths is at least 3 rock cells thick on every row round them", () => {
    const [wx, y0] = E.ert_giant_west;
    const [ex] = E.ert_giant;
    for (let y = y0 - 6; y <= y0 + 6; y++) {
      const row = g[y].slice(wx, ex + 1).join('');
      const longest = Math.max(...(row.match(/m+/g) ?? ['']).map((s) => s.length));
      expect(longest, `row ${y}: ${row}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('the tunnel mouths, the hall, the sage cave, Melmond and the Cavern lead to their maps, each beside its entrance', () => {
    for (const [m, e, ent] of [['dwarf-hall', 'arrival', 'ert_dwarf'], ['giant-tunnel', 'arrival', 'ert_giant'],
      ['giant-tunnel', 'west', 'ert_giant_west'], ['sage-cave', 'arrival', 'ert_sarda'], ['melmond', 'gate', 'ert_melmond'],
      ['cavern-earth-b1', 'arrival', 'ert_earth_cave']]) {
      const t = nw.transitions.filter((x) => x.targetMap === m && x.targetEntrance === e);
      expect(t, `${m}:${e}`).toHaveLength(1);
      expect(Math.abs(t[0].x - E[ent][0]) + Math.abs(t[0].y - E[ent][1]), ent).toBe(1);
    }
  });

  it("today's EARTH landmarks are placed: five cave mouths over their doors, Melmond's icon, the windmill, the shrine, the post", () => {
    const doors = nw.transitions.filter((t) => ['dwarf-hall', 'giant-tunnel', 'sage-cave', 'cavern-earth-b1'].includes(t.targetMap));
    const mouths = nw.objects.filter((o) => o.parts?.[0]?.[0] === 'cave_mouth_icon_0_0');
    for (const d of doors) {
      expect(mouths.some((o) => o.walk_cells && o.x + o.walk_cells[0][0] === d.x && o.y + o.walk_cells[0][1] === d.y),
        `${d.targetMap} ${d.x},${d.y}`).toBe(true);
    }
    const mel = nw.objects.find((o) => o.name === 'melmond')!;
    const door = nw.transitions.find((t) => t.targetMap === 'melmond')!;
    expect([mel.x + mel.walk_cells![0][0], mel.y + mel.walk_cells![0][1]]).toEqual([door.x, door.y]);
    expect(mel.parts!.length).toBe(3);
    for (const name of ['windmill_icon_0_0', 'shrine_icon_0_0', 'dock_post_icon_0_0']) {
      expect(nw.objects.filter((o) => o.parts?.[0]?.[0] === name), name).toHaveLength(1);
    }
    const shrine = nw.objects.find((o) => o.parts?.[0]?.[0] === 'shrine_icon_0_0')!;
    const text = today.inspect.find((i) => i.text[0].startsWith('A shrine to the earth'))!.text;
    expect(nw.inspect.filter((i) => i.y === shrine.y + 1 && i.x >= shrine.x && i.x <= shrine.x + 1)
      .map((i) => i.text)).toEqual([text, text]);
  });

  it('every cave door leaves only to its arrival on the ground (warp_leaves: rock under and beside its mouth)', () => {
    for (const [m, ent] of [['dwarf-hall', 'ert_dwarf'], ['giant-tunnel', 'ert_giant'], ['giant-tunnel', 'ert_giant_west'],
      ['sage-cave', 'ert_sarda'], ['cavern-earth-b1', 'ert_earth_cave']]) {
      const d = nw.transitions.find((t) => t.targetMap === m && Math.abs(t.x - E[ent][0]) + Math.abs(t.y - E[ent][1]) === 1)!;
      const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [d.x + a, d.y + b] as XY).filter(([x, y]) => walk(g[y][x]));
      expect(out, ent).toEqual([E[ent]]);
    }
  });

  it("the zones keep today's ids and rosters; the badlands keep their backdrop", () => {
    const zones = (nw.encounterZones ?? []).filter((z) => z.id.startsWith('ert_'));
    const was = (today.encounterZones ?? []).filter((z) => z.id.startsWith('ert_'));
    expect(zones.map((z) => z.id)).toEqual(was.map((z) => z.id));
    for (const z of zones) {
      const t = was.find((w) => w.id === z.id)!;
      expect(z.encounters, z.id).toEqual(t.encounters);
      expect(z.modes, z.id).toEqual(t.modes);
    }
    expect(nw.battleBackgrounds?.zones?.ert_badlands).toEqual({ default: 'cracked_earth' });
  });

  it('every walkable or canoe cell of the western continent and of the isthmus is in one EARTH walking zone; every Water cell only EARTH holds in one ship zone', () => {
    const zones = (nw.encounterZones ?? []).filter((z) => z.id.startsWith('ert_'));
    const count = new Map<string, number>();
    for (const z of zones) for (const [x0, y0, x1, y1] of z.rects) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = `${z.modes?.includes('ship') ? 'S' : 'W'}${x},${y}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    for (const k of count.keys()) {
      const [x, y] = k.slice(1).split(',').map(Number);
      expect(inRects(raster('earth'), x, y), `${k} outside EARTH's raster`).toBe(true);
    }
    const west = flood([E.ert_melmond, E.ert_sarda, E.ert_giant_west], (x, y) => canoe(g[y][x]));
    const isthmus = flood([E.ert_dwarf], (x, y) => canoe(g[y][x]) && earthOnly(x, y));
    for (const c of [...west, ...isthmus]) expect(count.get(`W${c}`), `land ${c}`).toBe(1);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x] === 'o' && earthOnly(x, y)) expect(count.get(`S${x},${y}`), `water ${x},${y}`).toBe(1);
    }
  });
});

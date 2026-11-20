/**
 * Region FIRE on the NW world source (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 4.1, 4.3, 7; NW-R FIRE): today's
 * `tests/quest/fire/fir_o_world.test.ts` rewritten against the committed NW source and its owner grid
 * (`regions.fire.raster`). The anchors at their targets; the ring (no foot path from Crescent's shore to the south
 * lands, the canoe joins them, within the detour factors; its cut opens it); the south lands one land on foot; the
 * neck (NW-4's T2 finding: no river at Elfland's east edge carries an early canoe from the Aldi's shores into FIRE);
 * the dock; the zones over every FIRE cell; the icons, doors, smoke and vents; the hatch and the airship (S17).
 * Committed sources only: legend chars, no compiled collision (objects ignored).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { grid, key, nw, steps, withBridge, type XY } from '../a1/nwA1.js';

interface Zone { id: string; name: string; modes: string[]; rects: number[][] }
interface Obj { type: string; name?: string; x: number; y: number; parts: (string | null)[][]; walk_cells?: number[][] }
interface FireSrc {
  encounterZones: Zone[];
  battleBackgrounds: { zones: Record<string, unknown> };
  hazards: { id: string; damage: number; rects: number[][] }[];
  ambient: { kind: string; x: number; y: number; ox: number; oy: number }[];
  objects: Obj[];
  regions: Record<string, { raster: number[][]; checks?: Record<string, unknown> }>;
  world: { cuts: Record<string, XY[]> };
}
const src = nw as unknown as Omit<typeof nw, 'objects' | 'world'> & FireSrc;
const g = grid(nw);
const E = nw.entrances;
const anchors = (parse(readFileSync('assets-src/maps-nw/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; target: XY; region: string }> }).anchors;
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const today = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as { encounterZones: Zone[] };

const BLOCK = new Set(['o', 'm', 'r', '≈']);
const CANOE = new Set(['r', '≈']);
const foot = (c: string): boolean => !BLOCK.has(c);
const paddle = (c: string): boolean => foot(c) || CANOE.has(c);
const SOUTH = ['fir_volcano', 'fir_ice', 'fir_desert'];
const dist = (d: number[][], [x, y]: XY): number => d[y][x];
const euclid = (a: string, b: string): number => Math.hypot(E[a][0] - E[b][0], E[a][1] - E[b][1]);
const raster = src.regions.fire.raster;
const inFire = ([x, y]: XY): boolean => raster.some(([x0, y0, x1, y1]) => x0 <= x && x <= x1 && y0 <= y && y <= y1);
const fire = src.encounterZones.filter((z) => z.id.startsWith('fir_'));
const holds = ([x, y]: XY): Zone[] =>
  fire.filter((z) => z.rects.some(([x0, y0, x1, y1]) => x0 <= x && x <= x1 && y0 <= y && y <= y1));
const cellsOf = (d: number[][]): XY[] =>
  d.flatMap((row, y) => row.flatMap((v, x) => (v !== Infinity ? [[x, y] as XY] : [])));

describe('FIRE on the NW world (NW-R FIRE; fir_o_world)', () => {
  it('every FIRE anchor is an entrance within 2 cells of its NW target, on foot ground', () => {
    const mine = anchors.filter((a) => a.region === 'fire');
    expect(mine.map((a) => a.entrance).sort()).toEqual(['fir_crescent', 'fir_desert', 'fir_ice', 'fir_volcano']);
    for (const a of mine) {
      const [x, y] = E[a.entrance];
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
      expect(foot(g[y][x]), a.entrance).toBe(true);
      expect(inFire([x, y]), a.entrance).toBe(true);
    }
  });

  it("on foot Crescent's shore reaches none of the south lands; by canoe it reaches all three", () => {
    const walk = steps(g, E.fir_crescent, foot);
    const boat = steps(g, E.fir_crescent, paddle);
    for (const a of SOUTH) {
      expect(dist(walk, E[a]), a).toBe(Infinity);
      expect(dist(boat, E[a]), a).toBeLessThan(Infinity);
    }
  });

  it('the detour factors (WORLD 6.1): crescent-volcano and crescent-ice by canoe, ice-desert on foot, at most 2.5x', () => {
    const boat = steps(g, E.fir_crescent, paddle);
    for (const a of ['fir_volcano', 'fir_ice']) expect(dist(boat, E[a]), a).toBeLessThanOrEqual(2.5 * euclid('fir_crescent', a));
    expect(dist(steps(g, E.fir_ice, foot), E.fir_desert)).toBeLessThanOrEqual(2.5 * euclid('fir_ice', 'fir_desert'));
  });

  it('the south lands are one land on foot (volcano, ice, desert)', () => {
    const walk = steps(g, E.fir_ice, foot);
    for (const a of SOUTH) expect(dist(walk, E[a]), a).toBeLessThan(Infinity);
  });

  it("opening the composer's crescent_ring cut joins the shore and the south lands on foot (GT-37)", () => {
    const cut = new Set(src.world.cuts.crescent_ring.map(key));
    expect(cut.size).toBeGreaterThan(0);
    const open = g.map((row, y) => row.map((c, x) => (cut.has(key([x, y])) ? '.' : c)));
    const walk = steps(open, E.fir_crescent, foot);
    for (const a of SOUTH) expect(dist(walk, E[a]), a).toBeLessThan(Infinity);
  });

  it("the neck (NW-4's T2 row): from the Aldi's shores an early canoe reaches no FIRE site, bridge built, canal shut", () => {
    const h = withBridge(nw, true);
    const starts: XY[] = Object.entries(E).filter(([e]) => /^(elf_|ert_)/.test(e) || ['cornelia', 'a1_pravoka'].includes(e))
      .map(([, c]) => c);
    for (const d of nw.docks.filter((q) => q.basin === 'aldi')) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (foot(h[d.y + dy][d.x + dx])) starts.push([d.x + dx, d.y + dy]);
    }
    const reached = new Set<string>();
    for (const s of starts) for (const c of cellsOf(steps(h, s, paddle))) reached.add(key(c));
    for (const a of ['fir_crescent', ...SOUTH]) expect(reached.has(key(E[a])), a).toBe(false);
  });

  it('the fir_crescent dock is ocean Water, with land beside it on the way to the gate', () => {
    const d = nw.docks.find((x) => x.id === 'fir_crescent')!;
    expect(d.basin).toBe('ocean');
    expect(g[d.y][d.x]).toBe('o');
    expect(dist(steps(g, [d.x + 1, d.y], foot), E.fir_crescent)).toBeLessThanOrEqual(3);
  });

  it("FIRE's zones keep today's ids, names and rosters, and every one has its backdrop as today", () => {
    const old = new Map(today.encounterZones.filter((z) => z.id.startsWith('fir_')).map((z) => [z.id, z]));
    expect(fire.map((z) => z.id).sort()).toEqual([...old.keys()].sort());
    for (const z of fire) {
      expect(z.name, z.id).toBe(old.get(z.id)!.name);
      expect(z.modes, z.id).toEqual(old.get(z.id)!.modes);
      expect((z as unknown as { encounters: unknown }).encounters, z.id).toEqual((old.get(z.id) as unknown as { encounters: unknown }).encounters);
    }
    expect(Object.keys(src.battleBackgrounds.zones).filter((k) => k.startsWith('fir_')).sort())   // FIRE's (NW-RINT)
      .toEqual(['fir_aldi', 'fir_ashlands', 'fir_desert', 'fir_rivers', 'fir_sea', 'fir_tundra']);
  });

  it("FIRE's land walkable from its sites lies in its raster, each cell in one walking zone; its rivers and lakes in fir_rivers", () => {
    const bad: string[] = [];
    const land = [E.fir_crescent, ...SOUTH.map((a) => E[a])].flatMap((s) => cellsOf(steps(g, s, foot)));
    for (const c of land) {
      const walking = holds(c).filter((z) => z.modes.includes('walking'));
      if (!inFire(c) || walking.length !== 1) bad.push(`walk ${key(c)}`);
    }
    for (const c of cellsOf(steps(g, E.fir_crescent, paddle))) {
      if (CANOE.has(g[c[1]][c[0]]) && !holds(c).some((z) => z.id === 'fir_rivers')) bad.push(`river ${key(c)}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(holds(E.fir_volcano).map((z) => z.id)).toEqual(['fir_ashlands']);
    expect(holds(E.fir_ice).map((z) => z.id)).toEqual(['fir_tundra']);
    expect(holds(E.fir_desert).map((z) => z.id)).toEqual(['fir_desert']);
    expect(holds(E.fir_crescent).map((z) => z.id)).toEqual(['fir_lakeshore']);
  });

  it('every FIRE zone cell is in its raster and on its mode\'s ground; no cell is in two FIRE ship zones', () => {
    const bad: string[] = [];
    const ship = new Map<string, number>();
    for (const z of fire) {
      for (const [x0, y0, x1, y1] of z.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const c = g[y][x];
        if (!inFire([x, y])) bad.push(`${z.id} ${x},${y} outside`);
        if (z.modes.includes('ship') && c !== 'o') bad.push(`${z.id} ${x},${y} ${c}`);
        if (z.modes.includes('canoe') && !CANOE.has(c)) bad.push(`${z.id} ${x},${y} ${c}`);
        if (z.modes.includes('walking') && !foot(c)) bad.push(`${z.id} ${x},${y} ${c}`);
        if (z.modes.includes('ship')) ship.set(`${x},${y}`, (ship.get(`${x},${y}`) ?? 0) + 1);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect([...ship.values()].every((n) => n === 1)).toBe(true);
    const d = nw.docks.find((x) => x.id === 'fir_crescent')!;
    expect(holds([d.x, d.y]).map((z) => z.id)).toEqual(['fir_sea']);
  });

  it("the icons stand on their doors: Crescent's town, Gurgu's volcano (with its smoke), the Ice Cavern's mouth", () => {
    const icon = (name: string): Obj => src.objects.find((o) => o.name === name)!;
    for (const [name, map] of [['crescent_icon', 'crescent'], ['volcano', 'gurgu-b1'], ['cave_mouth', 'ice-cavern-b1']]) {
      const o = icon(name);
      const t = nw.transitions.find((x) => x.targetMap === map)!;
      expect(o.walk_cells, name).toHaveLength(1);
      const [i, j] = o.walk_cells![0];
      expect([o.x + i, o.y + j], name).toEqual([t.x, t.y]);
    }
    const v = icon('volcano');
    expect(src.ambient).toContainEqual({ kind: 'smoke', x: v.x + 1, y: v.y, ox: 26, oy: 12 });
    const cave = icon('cave_mouth');
    expect([g[cave.y][cave.x], g[cave.y][cave.x + 1]]).toEqual(['m', 'm']);     // cut into a rock ledge
    expect(src.objects.filter((o) => o.name === 'standing_stones')).toHaveLength(1);
    expect(src.regions.fire.checks).toEqual({ warp_leaves: true });
  });

  it('the ash vents lie on sand by Gurgu, never on its mouth or the river sink beside it', () => {
    const vents = src.hazards.find((h) => h.id === 'fir_ash_vents')!;
    expect(vents.damage).toBe(1);
    const [vx, vy] = E.fir_volcano;
    for (const [x0, y, x1] of vents.rects) for (let x = x0; x <= x1; x++) {
      expect(g[y][x]).toBe('s');
      expect(Math.max(Math.abs(x - vx), Math.abs(y - vy))).toBeGreaterThan(2);
      expect(Math.hypot(x - vx, y - vy)).toBeLessThanOrEqual(14);
    }
  });

  it('the hatch takes the levistone and raises the airship onto grass the hatch can walk to (S17)', () => {
    const n = nw.npcs!.find((x) => x.id === 'fir_hull_hatch')!;
    expect([n.x, n.y + 1]).toEqual(E.fir_desert);
    expect(n.requiredItem).toBe('levistone');
    expect(n.hideIf).toBe('AIRSHIP_RAISED');
    expect(n.cutscene).toEqual({ id: 'fir_airship_rises', onceFlag: 'AIRSHIP_RAISED' });
    const hull = src.objects.find((o) => o.name === 'buried_hull')!;
    expect([hull.x + 1, hull.y + 2]).toEqual([n.x, n.y]);
    const steps_ = cutscenes.find((c) => c.id === 'fir_airship_rises')!.steps;
    expect(steps_.find((s) => s.type === 'set_vehicle')).toMatchObject({ vehicle: 'airship', map: 'overworld', at: 'fir_s_airship' });
    const spot = nw.spots.fir_s_airship;
    expect(spot.kind).toBe('landing');
    expect(g[spot.at[1]][spot.at[0]]).toBe('.');
    expect(dist(steps(g, E.fir_desert, foot), spot.at)).toBeLessThanOrEqual(12);
    expect(dist(steps(g, E.fir_desert, foot), nw.spots.fir_s_hull.at)).toBeLessThanOrEqual(12);
  });
});

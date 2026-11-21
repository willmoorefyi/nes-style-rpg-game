/**
 * Region FIRE on the NW world source (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 4.1, 4.3, 7; NW-R FIRE): today's
 * `tests/quest/fire/fir_o_world.test.ts` rewritten against the committed NW source and its owner grid
 * (`regions.fire.raster`). The anchors at their targets; the ring (no foot path from Crescent's shore to the south
 * lands, the canoe joins them, within the detour factors; its cut opens it); the south lands one land on foot; the
 * neck (NW-4's T2 finding: no river at Elfland's east edge carries an early canoe from the Aldi's shores into FIRE);
 * NW2 (docs/NW2_EDITS_PLAN.md 4): the Ice Cavern on the cold tip beyond ice_neck, reached from its own dock `fir_ice`
 * and then only by canoe up R-ice into the Rime Hollow (ice_ring), the cuts of both opening them, the tip mostly
 * taiga and snow; the docks; the zones over every FIRE cell; the icons, doors, smoke and vents; the hatch and the
 * airship (S17).
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
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; target: XY; region: string }> }).anchors;
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const today = parse(readFileSync('tests/fixtures/passW/overworld.yaml', 'utf-8')) as { encounterZones: Zone[] };

const BLOCK = new Set(['o', 'm', 'r', '≈']);
const CANOE = new Set(['r', '≈']);
const foot = (c: string): boolean => !BLOCK.has(c);
const paddle = (c: string): boolean => foot(c) || CANOE.has(c);
const SOUTH = ['fir_volcano', 'fir_desert'];
const SHORE = nw.spots.fir_s_ice_shore.at;            // NW2: the Frost Shore by the fir_ice dock
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

  it("on foot Crescent's shore reaches none of the south lands; by canoe it reaches both, never the tip (ice_neck)", () => {
    const walk = steps(g, E.fir_crescent, foot);
    const boat = steps(g, E.fir_crescent, paddle);
    for (const a of SOUTH) {
      expect(dist(walk, E[a]), a).toBe(Infinity);
      expect(dist(boat, E[a]), a).toBeLessThan(Infinity);
    }
    expect(dist(boat, SHORE)).toBe(Infinity);
    expect(dist(boat, E.fir_ice)).toBe(Infinity);
  });

  it('NW2: from the fir_ice dock the Rime Hollow is reached only by canoe up R-ice (ice_ring), and the tip only from that dock', () => {
    expect(dist(steps(g, SHORE, foot), E.fir_ice)).toBe(Infinity);
    expect(dist(steps(g, SHORE, paddle), E.fir_ice)).toBeLessThanOrEqual(70);   // the Rime Gorge winds (57 steps at NW2-F)
    const boat = steps(g, SHORE, paddle);
    for (const a of ['fir_crescent', ...SOUTH]) expect(dist(boat, E[a]), a).toBe(Infinity);
  });

  it("NW2: the Ice Cavern lies north of Crescent (>= 40 rows, within 30 degrees of north) and >= 60 cells from Gurgu", () => {
    const [ix, iy] = E.fir_ice;
    const [cx, cy] = E.fir_crescent;
    expect(iy).toBeLessThanOrEqual(cy - 40);
    expect(Math.abs(Math.atan2(ix - cx, cy - iy) * 180 / Math.PI)).toBeLessThanOrEqual(30);
    expect(euclid('fir_ice', 'fir_volcano')).toBeGreaterThanOrEqual(60);
  });

  it('the detour factor (WORLD 6.1): crescent-volcano by canoe at most 2.5x (crescent-ice and ice-desert go by ship: proof (g))', () => {
    const boat = steps(g, E.fir_crescent, paddle);
    expect(dist(boat, E.fir_volcano)).toBeLessThanOrEqual(2.5 * euclid('fir_crescent', 'fir_volcano'));
  });

  it('the south lands are one land on foot (volcano, desert)', () => {
    const walk = steps(g, E.fir_volcano, foot);
    for (const a of SOUTH) expect(dist(walk, E[a]), a).toBeLessThan(Infinity);
  });

  it("opening the composer's crescent_ring cut joins the shore and the south lands on foot, not the tip (GT-37)", () => {
    const cut = new Set(src.world.cuts.crescent_ring.map(key));
    expect(cut.size).toBeGreaterThan(0);
    const open = g.map((row, y) => row.map((c, x) => (cut.has(key([x, y])) ? '.' : c)));
    const walk = steps(open, E.fir_crescent, foot);
    for (const a of SOUTH) expect(dist(walk, E[a]), a).toBeLessThan(Infinity);
    expect(dist(walk, E.fir_ice)).toBe(Infinity);
  });

  it('NW2: opening ice_ring walks the Frost Shore into the hollow (GT-40); opening ice_neck walks Crescent\'s shore to the Frost Shore, not the cave (GT-43)', () => {
    const opened = (name: string): string[][] => {
      const cut = new Set(src.world.cuts[name].map(key));
      expect(cut.size, name).toBeGreaterThanOrEqual(3);
      return g.map((row, y) => row.map((c, x) => (cut.has(key([x, y])) ? '.' : c)));
    };
    expect(dist(steps(opened('ice_ring'), SHORE, foot), E.fir_ice)).toBeLessThan(Infinity);
    const neck = steps(opened('ice_neck'), E.fir_crescent, foot);
    expect(dist(neck, SHORE)).toBeLessThan(Infinity);
    expect(dist(neck, E.fir_ice)).toBe(Infinity);
  });

  it('NW2: the tip beyond ice_neck is taiga and snow (>= 50 % of its walkable cells; the hollow\'s floor snow)', () => {
    const tip = cellsOf(steps(g, SHORE, paddle)).filter(([x, y]) => foot(g[y][x]));
    const hollow = cellsOf(steps(g, E.fir_ice, foot));
    const cold = [...tip, ...hollow].filter(([x, y]) => g[y][x] === 't' || g[y][x] === 'n');
    expect(cold.length / (tip.length + hollow.length)).toBeGreaterThanOrEqual(0.5);
    expect(hollow.filter(([x, y]) => g[y][x] === 'n').length).toBeGreaterThan(hollow.length / 2);
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
    for (const a of ['fir_crescent', ...SOUTH, 'fir_ice']) expect(reached.has(key(E[a])), a).toBe(false);
  });

  it('NW2: the fir_ice dock is ocean Water on the tip, its shore at most 6 steps from R-ice\'s mouth', () => {
    const d = nw.docks.find((x) => x.id === 'fir_ice')!;
    expect(d.basin).toBe('ocean');
    expect(g[d.y][d.x]).toBe('o');
    expect(nw.spots.fir_s_ice_ship.at).toEqual([d.x, d.y]);
    expect(Math.abs(SHORE[0] - d.x) + Math.abs(SHORE[1] - d.y)).toBe(1);
    const walk = steps(g, SHORE, foot);
    const bank = cellsOf(walk).filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy][x + dx] === 'r'));
    expect(Math.min(...bank.map((c) => dist(walk, c)))).toBeLessThanOrEqual(6);
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
    const land = [E.fir_crescent, E.fir_ice, SHORE, ...SOUTH.map((a) => E[a])].flatMap((s) => cellsOf(steps(g, s, foot)));
    for (const c of land) {
      const walking = holds(c).filter((z) => z.modes.includes('walking'));
      if (!inFire(c) || walking.length !== 1) bad.push(`walk ${key(c)}`);
    }
    for (const c of [E.fir_crescent, SHORE].flatMap((s) => cellsOf(steps(g, s, paddle)))) {
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
    for (const id of ['fir_crescent', 'fir_ice']) {
      const d = nw.docks.find((x) => x.id === id)!;
      expect(holds([d.x, d.y]).map((z) => z.id), id).toEqual(['fir_sea']);
    }
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

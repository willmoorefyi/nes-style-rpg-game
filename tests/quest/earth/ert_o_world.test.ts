/**
 * ERT-O (docs/WORLD_PLAN.md 2.2, 2.6, 2.8, 4.3, 6.3 GT-35 / GT-36): region EARTH on the compiled world and its three
 * site maps. The anchors sit within 2 cells of their targets; the canal patch is the only Water link between the
 * Aldi and the western strait; the dwarves' landing is an Aldi dock and Melmond's harbour an ocean one; the western
 * range parts Melmond's plain from Sarda's coast on foot (the composer exports its 4-cell cut); in the giant's
 * tunnel the giant's cell is the only way west, and the dwarf hall's foreman takes the TNT through his cutscene.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Compiled {
  width: number; height: number; collision: number[]; entrances: Record<string, XY>;
  transitions: Array<{ x: number; y: number; targetMap: string; targetEntrance?: string }>;
  docks?: Array<{ id: string; x: number; y: number; basin: string }>;
  patches?: Array<{ id: string; flag: string; cells: XY[]; terrain: number }>;
  npcs: Array<{ id: string; x: number; y: number; requiredItem?: string; hideIf?: string; wander?: boolean;
    cutscene?: { id: string; requiredFlags?: string[]; onceFlag: string }; shopId?: string }>;
  encounterZones?: Array<{ id: string; rects: number[][]; modes?: string[]; name?: string }>;
  world?: { cuts?: Record<string, XY[]> };
}
const load = (id: string): Compiled => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as Compiled;
const world = load('overworld');
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as
  { anchors: Array<{ entrance: string; region: string; target: XY }> }).anchors;

const BLOCKED = new Set([1, 2, 3, 7, 10, 11]);
const WATER = 2;
const at = (m: Compiled, x: number, y: number): number => m.collision[y * m.width + x];

/** 4-connected flood over cells that pass `ok`, from `seeds`. */
function flood(m: Compiled, seeds: XY[], ok: (x: number, y: number) => boolean): Set<string> {
  const seen = new Set<string>();
  const q: XY[] = [];
  for (const s of seeds) if (ok(...s)) { seen.add(`${s[0]},${s[1]}`); q.push(s); }
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(`${nx},${ny}`) || !ok(nx, ny)) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const walkable = (m: Compiled, extra: Set<string> = new Set()) =>
  (x: number, y: number): boolean => !BLOCKED.has(at(m, x, y)) && !extra.has(`${x},${y}`);

describe('ERT-O: EARTH on the world map', () => {
  it('every EARTH anchor is an entrance within 2 cells of its target (2.2)', () => {
    const earth = anchors.filter((a) => a.region === 'earth');
    expect(earth.map((a) => a.entrance).sort()).toEqual(['ert_dwarf', 'ert_earth_cave', 'ert_giant', 'ert_melmond', 'ert_sarda']);
    for (const a of earth) {
      const e = world.entrances[a.entrance];
      expect(e, a.entrance).toBeDefined();
      expect(Math.max(Math.abs(e[0] - a.target[0]), Math.abs(e[1] - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
    expect(world.entrances.ert_giant_west).toEqual([23, 112]);
  });

  it('the canal patch (CANAL_OPEN) alone joins the Aldi to the western strait (2.6)', () => {
    const canal = world.patches!.find((p) => p.id === 'canal')!;
    expect(canal.flag).toBe('CANAL_OPEN');
    expect(canal.terrain).toBe(WATER);
    const aldi: XY = [92, 121];
    const strait: XY = [45, 92];
    const wet = (cells: Set<string>) => (x: number, y: number) => at(world, x, y) === WATER || cells.has(`${x},${y}`);
    expect(flood(world, [aldi], wet(new Set())).has(`${strait[0]},${strait[1]}`)).toBe(false);
    const open = new Set(canal.cells.map(([x, y]) => `${x},${y}`));
    expect(flood(world, [aldi], wet(open)).has(`${strait[0]},${strait[1]}`)).toBe(true);
    for (const [x, y] of canal.cells) expect(at(world, x, y), `saddle cell ${x},${y}`).not.toBe(WATER);
  });

  it('the dwarves\' landing is an Aldi dock by the hall, Melmond\'s harbour an ocean dock by its gate', () => {
    const docks = Object.fromEntries((world.docks ?? []).map((d) => [d.id, d]));
    expect(docks.ert_dwarf).toMatchObject({ x: 59, y: 104, basin: 'aldi' });
    expect(docks.ert_melmond).toMatchObject({ x: 43, y: 113, basin: 'ocean' });
    expect(at(world, 59, 104)).toBe(WATER);
    const hall = flood(world, [world.entrances.ert_dwarf], walkable(world));
    expect(hall.has('58,104')).toBe(true);                       // the landing's land cell
    expect(hall.has(`${world.entrances.ert_melmond.join(',')}`)).toBe(false);   // the strait parts them on foot
  });

  it('the western range parts Melmond\'s plain from Sarda\'s coast; its exported cut crosses it (GT-35)', () => {
    const plain = flood(world, [world.entrances.ert_giant], walkable(world));
    expect(plain.has(world.entrances.ert_melmond.join(','))).toBe(true);
    expect(plain.has(world.entrances.ert_earth_cave.join(','))).toBe(true);
    expect(plain.has(world.entrances.ert_sarda.join(','))).toBe(false);
    expect(plain.has(world.entrances.ert_giant_west.join(','))).toBe(false);
    const cut = world.world!.cuts!.western_range;
    expect(cut.length).toBe(3);   // FX-R (P3-R3): the meandering range is 3 cells at its narrowest (4 before)
    const opened = new Set(cut.map(([x, y]) => `${x},${y}`));
    const open = (x: number, y: number) => !BLOCKED.has(at(world, x, y)) || opened.has(`${x},${y}`);
    expect(flood(world, [world.entrances.ert_giant], open).has(world.entrances.ert_sarda.join(','))).toBe(true);
  });

  it('the tunnel mouths, the hall, the sage cave, Melmond and the Cavern lead to their maps', () => {
    const to = (m: string, e: string) => world.transitions.filter((t) => t.targetMap === m && t.targetEntrance === e);
    for (const [m, e] of [['dwarf-hall', 'arrival'], ['giant-tunnel', 'arrival'], ['giant-tunnel', 'west'],
      ['sage-cave', 'arrival'], ['melmond', 'gate'], ['cavern-earth-b1', 'arrival']]) expect(to(m, e), `${m}:${e}`).toHaveLength(1);
  });

  it('every walkable EARTH cell is in one walking zone and every Water cell of the box in one ship zone (4.0.3)', () => {
    const zones = (world.encounterZones ?? []).filter((z) => z.id.startsWith('ert_'));
    expect(zones.map((z) => z.id)).toEqual(['ert_isthmus', 'ert_plain', 'ert_badlands', 'ert_sarda_coast', 'ert_aldi', 'ert_sea']);
    const count = new Map<string, number>();
    for (const z of zones) for (const [x0, y0, x1, y1] of z.rects) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = `${z.modes?.includes('ship') ? 'S' : 'W'}${x},${y}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    const inEarth = (x: number, y: number) => (x <= 63 && y >= 64 && y <= 111) || (x <= 47 && y >= 112 && y <= 143);
    for (let y = 64; y <= 143; y++) for (let x = 0; x <= 63; x++) {
      if (!inEarth(x, y)) continue;
      const c = at(world, x, y);
      if (c === WATER) expect(count.get(`S${x},${y}`), `water ${x},${y}`).toBe(1);
      else if (!BLOCKED.has(c)) expect(count.get(`W${x},${y}`), `land ${x},${y}`).toBe(1);
    }
  });
});

describe('ERT-O: the site maps', () => {
  it('the giant lies on the tunnel\'s only way west; once he is gone the way is open (GT-36)', () => {
    const t = load('giant-tunnel');
    const giant = t.npcs.find((n) => n.id === 'ert_giant')!;
    expect(giant).toMatchObject({ requiredItem: 'ruby', hideIf: 'TITAN_FED', cutscene: { id: 'ert_giant_feast', onceFlag: 'TITAN_FED' } });
    expect(giant.wander).toBeUndefined();
    const west = t.entrances.west.join(',');
    expect(flood(t, [t.entrances.arrival], walkable(t, new Set([`${giant.x},${giant.y}`]))).has(west)).toBe(false);
    expect(flood(t, [t.entrances.arrival], walkable(t)).has(west)).toBe(true);
  });

  it('Nerrick needs the TNT for the blast; Sarda\'s rod waits for the vampire; Smyth forges from adamant', () => {
    const hall = load('dwarf-hall');
    expect(hall.npcs.find((n) => n.id === 'ert_nerrick')).toMatchObject(
      { requiredItem: 'tnt', cutscene: { id: 'ert_canal_blast', onceFlag: 'CANAL_OPEN' } });
    // S31: switched on by INT; W-S31 (the classic order): he forges as soon as the adamant comes, no flag gate
    const smyth = hall.npcs.find((n) => n.id === 'ert_smyth')!;
    expect(smyth).toMatchObject({ requiredItem: 'adamant' });
    expect(smyth.cutscene).toEqual({ id: 'ert_smyth_forge', onceFlag: 'ERT_O_SWORD_FORGED' });
    expect(hall.npcs.find((n) => n.shopId)?.shopId).toBe('dwarf_item');
    const sage = load('sage-cave');
    expect(sage.npcs).toHaveLength(3);
    expect(sage.npcs.find((n) => n.id === 'ert_sarda')?.cutscene).toEqual(
      { id: 'ert_sarda_rod', requiredFlags: ['VAMPIRE_DEFEATED'], onceFlag: 'ERT_O_ROD_GIVEN' });
    const cut = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, string>> }>;
    const steps = (id: string) => cut.find((c) => c.id === id)!.steps;
    expect(steps('ert_canal_blast')).toEqual(expect.arrayContaining([{ type: 'take_item', item: 'tnt' }, { type: 'set_flag', flag: 'CANAL_OPEN' }]));
    expect(steps('ert_giant_feast')).toEqual(expect.arrayContaining([{ type: 'take_item', item: 'ruby' }, { type: 'set_flag', flag: 'TITAN_FED' }]));
    expect(steps('ert_sarda_rod')).toEqual(expect.arrayContaining([{ type: 'give_item', item: 'rod' }]));
    expect(steps('ert_smyth_forge')).toEqual(expect.arrayContaining([{ type: 'give_item', item: 'excalibur', announce: true }]));
  });
});

/**
 * Gaia (docs/WORLD_PLAN.md 4.0.1, 4.7, 5.4; WND-T): the compiled town, its rooms and the spring. The spring warden
 * plays `wnd_fairy_freed` with the fairy bottle (S23, GT-26): the cutscene takes the bottle, sets FAIRY_FREED and
 * gives the Oxyale; the patch `wnd_spring_flows` fills the dry basin (Water) once the fairy is freed, and the freed
 * fairy appears. Every door leads to its room and back to the cell in front of it; every walkable cell has a way back
 * to the gate; the four terraces are joined only by the rock stairs and the gorge footbridges; the clinic, the inn
 * keeper and the five shops are in place.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType, npcPresent, type MapData, type MapNPC } from '../../../src/types/index.js';
import { baseTerrain, npcOutcome, patchedTerrain, terrainAllows, type FieldState } from '../../../src/systems/fieldRules.js';
import { validateMapData } from '../../../src/core/schemaValidation.js';

const load = (id: string): MapData => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8'))) as MapData;
const town = load('gaia');
const spring = load('gaia-spring');
const FREED = 'FAIRY_FREED';
const state = (flags: string[] = [], items: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] });
const HOUSES = ['windmiller', 'ropemaker', 'spinner', 'healer', 'beekeeper', 'shepherd'];
const SHOPS = ['weapon-shop', 'armor-shop', 'item-shop', 'white-magic', 'black-magic', 'inn'];
type Step = { type: string; flag?: string; item?: string; map?: string; x?: number; y?: number };
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Step[] }>;

/** The walkable cells reached from (x, y) on foot, with the map's base terrain (or patched by `flags`). */
function reach(map: MapData, from: [number, number], flags: string[] = []): Set<string> {
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height
    && terrainAllows('walking', patchedTerrain(map, x, y, new Set(flags)));
  const seen = new Set([`${from[0]},${from[1]}`]);
  const queue = [from];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && open(x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
    }
  }
  return seen;
}

describe('Gaia: the spring and the fairy (S23, GT-26)', () => {
  const warden = spring.npcs.find((n) => n.id === 'gaia_spring_warden')! as MapNPC;
  const fairy = spring.npcs.find((n) => n.id === 'gaia_fairy')! as MapNPC;

  it('the warden needs the bottle; the cutscene plays once, takes it, sets FAIRY_FREED and gives the Oxyale', () => {
    expect(warden.requiredItem).toBe('fairy_bottle');
    expect(warden.cutscene).toEqual({ id: 'wnd_fairy_freed', onceFlag: FREED });
    const steps = cutscenes.find((c) => c.id === 'wnd_fairy_freed')!.steps;
    expect(steps.filter((s) => s.type === 'take_item').map((s) => s.item)).toEqual(['fairy_bottle']);
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual([FREED]);
    expect(steps.filter((s) => s.type === 'give_item').map((s) => s.item)).toEqual(['oxyale']);
    const at = (t: string): number => steps.findIndex((s) => s.type === t);
    expect(at('take_item')).toBeLessThan(at('set_flag'));
    const warp = steps.find((s) => s.type === 'warp')!;
    expect(warp.map).toBe('gaia-spring');
    expect(terrainAllows('walking', patchedTerrain(spring, warp.x!, warp.y!, new Set([FREED])))).toBe(true);
  });

  it('without the bottle: no cutscene, the warden tells of the caravan; with it: the release; after: the Oxyale', () => {
    const none = npcOutcome(warden, state(), []);
    expect(none.cutscene).toBeUndefined();
    expect(none.dialog.join(' ')).toMatch(/caravan/);
    const held = npcOutcome(warden, state([], ['fairy_bottle']), []);
    expect(held.cutscene).toBe('wnd_fairy_freed');
    expect(held.dialog.join(' ')).toMatch(/bottle/);
    const after = npcOutcome(warden, state([FREED], ['oxyale']), []);
    expect(after.cutscene).toBeUndefined();
    expect(after.dialog.join(' ')).toMatch(/breath/);
  });

  it('the freed fairy appears only once FAIRY_FREED is set', () => {
    expect(fairy.showIf).toBe(FREED);
    expect(npcPresent(fairy, () => false)).toBe(false);
    expect(npcPresent(fairy, (f) => f === FREED)).toBe(true);
  });

  it('the patch wnd_spring_flows: the dry basin is sand before the flag and Water after; the hollow stays connected', () => {
    const patch = (spring.patches ?? []).find((p) => p.id === 'wnd_spring_flows')!;
    expect(patch.flag).toBe(FREED);
    expect(patch.terrain).toBe(TerrainType.Water);
    for (const [x, y] of patch.cells) {
      expect(terrainAllows('walking', baseTerrain(spring, x, y)), `(${x}, ${y}) before`).toBe(true);
      expect(patchedTerrain(spring, x, y, new Set([FREED])), `(${x}, ${y}) after`).toBe(TerrainType.Water);
    }
    const arrival = spring.entrances!.arrival as [number, number];
    const before = reach(spring, arrival);
    const after = reach(spring, arrival, [FREED]);
    const cells = new Set(patch.cells.map(([x, y]) => `${x},${y}`));
    expect([...before].filter((c) => !cells.has(c) && !after.has(c))).toEqual([]);
    for (const n of spring.npcs) expect(after.has(`${n.x},${n.y + 1}`) || after.has(`${n.x + 1},${n.y}`), n.id).toBe(true);
  });

  it('the spring leads back to the court (gaia `spring`), and the court\'s grotto leads into the spring', () => {
    const back = spring.transitions.filter((t) => t.targetMap === 'gaia');
    expect(back.length).toBe(2);
    expect(back.every((t) => t.targetEntrance === 'spring')).toBe(true);
    const into = town.transitions.find((t) => t.targetMap === 'gaia-spring')!;
    expect(into.targetEntrance).toBe('arrival');
    expect(town.entrances?.spring).toEqual([into.x, into.y + 1]);
  });
});

describe('Gaia: doors, exits, the climb, keepers', () => {
  it('the gate road leads back to the overworld at wnd_gaia; the gate entrance is on it', () => {
    const out = town.transitions.filter((t) => t.targetMap === 'overworld');
    expect(out.length).toBe(2);
    expect(out.every((t) => t.targetEntrance === 'wnd_gaia' && t.y === town.height - 1)).toBe(true);
    expect(town.entrances?.gate).toEqual([17, 43]);
  });

  it('every house, shop and the inn: a door into it, and its exit back to the cell in front of that door', () => {
    for (const id of [...HOUSES.map((h) => `gaia-house-${h}`), ...SHOPS.map((s) => `gaia-${s}`)]) {
      const door = town.transitions.find((t) => t.targetMap === id)!;
      expect(door, id).toBeDefined();
      const room = load(id);
      expect(room.entrances?.[door.targetEntrance!], `${id} ${door.targetEntrance}`).toBeDefined();
      const back = room.transitions.filter((t) => t.targetMap === 'gaia');
      expect(back.length, id).toBeGreaterThan(0);
      for (const t of back) expect(town.entrances?.[t.targetEntrance!], `${id} -> ${t.targetEntrance}`).toEqual([door.x, door.y + 1]);
    }
  });

  it('EXIT-safe: every walkable cell of the town has a way back to the gate', () => {
    const seen = reach(town, town.entrances!.gate as [number, number]);
    const lost: string[] = [];
    for (let y = 0; y < town.height; y++) {
      for (let x = 0; x < town.width; x++) {
        if (terrainAllows('walking', baseTerrain(town, x, y)) && !seen.has(`${x},${y}`)) lost.push(`${x},${y}`);
      }
    }
    expect(lost).toEqual([]);
  });

  it('the climb: the gorge splits each terrace, and only its footbridges cross it', () => {
    const bridges: string[] = [];
    for (let y = 0; y < town.height; y++) {
      for (let x = 0; x < town.width; x++) if (baseTerrain(town, x, y) === TerrainType.Bridge) bridges.push(`${x},${y}`);
    }
    expect(bridges.length).toBeGreaterThanOrEqual(8);
    const rows = new Set(bridges.map((b) => Number(b.split(',')[1])));
    expect([...rows].sort((a, b) => a - b)).toEqual([8, 9, 19, 20, 30, 31, 41, 42]);
    // without the bridges, the court (the spring entrance) cannot be reached from the gate
    const noBridge = { ...town, collision: town.collision.map((c) => (c === TerrainType.Bridge ? TerrainType.Wall : c)) };
    const seen = reach(noBridge as MapData, town.entrances!.gate as [number, number]);
    const [sx, sy] = town.entrances!.spring;
    expect(seen.has(`${sx},${sy}`)).toBe(false);
  });

  it('the clinic is in the healer\'s house (120 G a level); the inn keeper has action inn; the five shops sell gaia_*', () => {
    const healer = load('gaia-house-healer').npcs.find((n) => n.action === 'clinic');
    expect(healer?.id).toBe('gaia_healer');
    expect(healer?.clinicPrice).toBe(120);
    const keeper = load('gaia-inn').npcs.find((n) => n.shopId === 'gaia_inn');
    expect(keeper?.action).toBe('inn');
    for (const [room, shop] of [['weapon-shop', 'weapon'], ['armor-shop', 'armor'], ['item-shop', 'item'],
      ['white-magic', 'white'], ['black-magic', 'black']]) {
      expect(load(`gaia-${room}`).npcs.some((n) => n.shopId === `gaia_${shop}`), room).toBe(true);
    }
  });

  it('the two hint people name Lufenia and the Mirage; the people react to FAIRY_FREED; the HUD name is Gaia', () => {
    const lines = (id: string): string => JSON.stringify(town.npcs.find((n) => n.id === id)!.dialog);
    expect(lines('gaia_lufenia_hint')).toMatch(/Lufenia/);
    expect(lines('gaia_mirage_hint')).toMatch(/Mirage/);
    const reactive = town.npcs.filter((n) => (n.dialog as Array<{ condition?: string }>).some((d) => d.condition === FREED));
    expect(reactive.length).toBeGreaterThanOrEqual(16);
    expect(town.name).toBe('Gaia');
  });

  it('WND-T\'s flags and chests use the WND_T prefix', () => {
    const chests = HOUSES.flatMap((h) => load(`gaia-house-${h}`).npcs).filter((n) => n.chestFlag);
    expect(chests.length).toBeGreaterThanOrEqual(2);
    for (const c of chests) expect(c.chestFlag).toMatch(/^CHEST_WND_T_/);
  });
});

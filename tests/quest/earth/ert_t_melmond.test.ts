/**
 * Melmond (docs/WORLD_PLAN.md 4.0.1, 4.3, 5.4; ERT-T): the compiled town and its interiors. The bloom patch
 * `ert_melmond_bloom` (flag EARTH_CRYSTAL_LIT) turns the plots and the green's lawn from dead dirt to grass, art only
 * (every cell walks before and after) with an opaque overlay; Dr. Unne reads the slab (S25) through `ert_unne_lesson`,
 * which takes the slab and sets LUFENIAN_LEARNED; every door leads to its interior and back to the cell in front of
 * it; every walkable cell has a way back to the quay (the gate); the clinic and the inn keeper are in place.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType, type MapData, type MapNPC } from '../../../src/types/index.js';
import { baseTerrain, npcOutcome, patchedTerrain, terrainAllows, type FieldState } from '../../../src/systems/fieldRules.js';
import { validateMapData } from '../../../src/core/schemaValidation.js';

const load = (id: string): MapData => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8'))) as MapData;
const town = load('melmond');
const LIT = 'EARTH_CRYSTAL_LIT';
const state = (flags: string[] = [], items: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] });
const HOUSES = ['unne', 'miller', 'vintner', 'ploughman', 'healer'];
const SHOPS = ['weapon-shop', 'armor-shop', 'item-shop', 'white-magic', 'black-magic', 'inn'];
type Step = { type: string; flag?: string; item?: string };
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Step[] }>;

describe('Melmond: the bloom patch (EARTH_CRYSTAL_LIT)', () => {
  const patch = (town.patches ?? []).find((p) => p.id === 'ert_melmond_bloom')!;

  it('is on the town map: flag EARTH_CRYSTAL_LIT, grass on more than 150 cells', () => {
    expect(patch).toBeDefined();
    expect(patch.flag).toBe(LIT);
    expect(patch.terrain).toBe(TerrainType.Grass);
    expect(patch.cells.length).toBeGreaterThan(150);
  });

  it('before the flag the cells are dead dirt (road), after it grass; every cell walks both times', () => {
    for (const [x, y] of patch.cells) {
      expect(baseTerrain(town, x, y), `(${x}, ${y}) before`).toBe(TerrainType.Road);
      expect(patchedTerrain(town, x, y, new Set()), `(${x}, ${y}) no flag`).toBe(TerrainType.Road);
      expect(patchedTerrain(town, x, y, new Set([LIT])), `(${x}, ${y}) after`).toBe(TerrainType.Grass);
      expect(terrainAllows('walking', patchedTerrain(town, x, y, new Set())), `(${x}, ${y}) walk before`).toBe(true);
      expect(terrainAllows('walking', patchedTerrain(town, x, y, new Set([LIT]))), `(${x}, ${y}) walk after`).toBe(true);
    }
  });

  it('its overlay exists and is opaque on every patch cell', () => {
    const file = town.art?.patches?.ert_melmond_bloom;
    expect(file).toBeDefined();
    expect(existsSync(`assets/maps/ai/melmond/patch_ert_melmond_bloom.png`)).toBe(true);
    const code = 'import sys; sys.path.insert(0, "assets-src/tools"); import yaml, build_hooks as H; '
      + 'src = yaml.safe_load(open("assets-src/maps/melmond.yaml")); print(H.patch_errors(src, "assets/maps/ai"))';
    expect(execFileSync('python3', ['-I', '-c', code], { encoding: 'utf-8' }).trim()).toBe('[]');
  });
});

describe('Melmond: Dr. Unne and the slab (S25, GT-28)', () => {
  const house = load('melmond-house-unne');
  const unne = house.npcs.find((n) => n.id === 'ert_unne')! as MapNPC;

  it('needs the slab; his cutscene plays once, takes the slab and sets LUFENIAN_LEARNED', () => {
    expect(unne.requiredItem).toBe('slab');
    expect(unne.cutscene).toEqual({ id: 'ert_unne_lesson', onceFlag: 'LUFENIAN_LEARNED' });
    const steps = cutscenes.find((c) => c.id === 'ert_unne_lesson')!.steps;
    expect(steps.filter((s) => s.type === 'take_item').map((s) => s.item)).toEqual(['slab']);
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['LUFENIAN_LEARNED']);
    expect(steps.findIndex((s) => s.type === 'take_item')).toBeLessThan(steps.findIndex((s) => s.type === 'set_flag'));
  });

  it('without the slab: no cutscene, he tells of the tablet; with it: the lesson; after it: the way to Lufenia', () => {
    const none = npcOutcome(unne, state([LIT]), []);
    expect(none.cutscene).toBeUndefined();
    expect(none.dialog.join(' ')).toMatch(/tablet/);
    const held = npcOutcome(unne, state([LIT], ['slab']), []);
    expect(held.cutscene).toBe('ert_unne_lesson');
    expect(held.dialog.join(' ')).toMatch(/My tablet/);
    const after = npcOutcome(unne, state([LIT, 'LUFENIAN_LEARNED']), []);
    expect(after.cutscene).toBeUndefined();
    expect(after.dialog.join(' ')).toMatch(/Lufenia/);
  });
});

describe('Melmond: doors, exits, keepers', () => {
  it('the quay leads back to the overworld at ert_melmond; the gate entrance is on the quay', () => {
    const out = town.transitions.filter((t) => t.targetMap === 'overworld');
    expect(out.length).toBe(2);
    expect(out.every((t) => t.targetEntrance === 'ert_melmond')).toBe(true);
    expect(town.entrances?.gate).toEqual([43, 19]);
  });

  it('every house, shop and the inn: a door into it, and its exit back to the cell in front of that door', () => {
    for (const id of [...HOUSES.map((h) => `melmond-house-${h}`), ...SHOPS.map((s) => `melmond-${s}`)]) {
      const door = town.transitions.find((t) => t.targetMap === id)!;
      expect(door, id).toBeDefined();
      const room = load(id);
      expect(room.entrances?.[door.targetEntrance!], `${id} ${door.targetEntrance}`).toBeDefined();
      const back = room.transitions.filter((t) => t.targetMap === 'melmond');
      expect(back.length, id).toBeGreaterThan(0);
      for (const t of back) expect(town.entrances?.[t.targetEntrance!], `${id} -> ${t.targetEntrance}`).toEqual([door.x, door.y + 1]);
    }
  });

  it('EXIT-safe: every walkable cell of the town has a way back to the quay', () => {
    const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < town.width && y < town.height
      && terrainAllows('walking', baseTerrain(town, x, y));
    const [gx, gy] = town.entrances!.gate;
    const seen = new Set([`${gx},${gy}`]);
    const queue = [[gx, gy]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && open(x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
      }
    }
    const lost: string[] = [];
    for (let y = 0; y < town.height; y++) for (let x = 0; x < town.width; x++) if (open(x, y) && !seen.has(`${x},${y}`)) lost.push(`${x},${y}`);
    expect(lost).toEqual([]);
  });

  it('the clinic is in the healer\'s house; the inn keeper has action inn and sells melmond_inn', () => {
    const healer = load('melmond-house-healer').npcs.find((n) => n.action === 'clinic');
    expect(healer?.id).toBe('melmond_healer');
    const keeper = load('melmond-inn').npcs.find((n) => n.shopId === 'melmond_inn');
    expect(keeper?.action).toBe('inn');
    for (const [room, shop] of [['weapon-shop', 'weapon'], ['armor-shop', 'armor'], ['item-shop', 'item'],
      ['white-magic', 'white'], ['black-magic', 'black']]) {
      expect(load(`melmond-${room}`).npcs.some((n) => n.shopId === `melmond_${shop}`), room).toBe(true);
    }
  });

  it('the two hint people name the Cavern and the giant; the HUD name is Melmond', () => {
    const lines = (id: string): string => JSON.stringify(town.npcs.find((n) => n.id === id)!.dialog);
    expect(lines('melmond_cavern_hint')).toMatch(/Cavern of Earth/);
    expect(lines('melmond_giant_hint')).toMatch(/giant/);
    expect(town.name).toBe('Melmond');
  });
});

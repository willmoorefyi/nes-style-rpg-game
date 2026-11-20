/**
 * Onrac (docs/WORLD_PLAN.md 4.0.1, 4.6, 5.4; WAT-T): the compiled town and its interiors. The submarine's gangway in
 * the dry dock is an oxyale gate (`keyItemGates` requiredItem oxyale, not permanent) whose message is the
 * shipwright's, on a transition to `sea-shrine-b3` entrance `nave` (the canon link; WAT-D builds the shrine); the
 * town's own entrance `dry_dock` is the walkway cell in front of it. Every door leads to its interior and back to the
 * cell in front of it; every walkable cell has a way back to the cliff gate; the clinic, the inn and the five shops
 * are in place; the two hint people name the waterfall and the caravan; the overworld icon's door leads in.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { baseTerrain, fieldStep, gateAt, terrainAllows, type FieldState } from '../../../src/systems/fieldRules.js';
import { validateMapData } from '../../../src/core/schemaValidation.js';

const load = (id: string): MapData => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8'))) as MapData;
const town = load('onrac');
const state = (items: string[] = [], flags: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] });
const HOUSES = ['bellringer', 'netmender', 'smoker', 'shipwright', 'healer', 'tanner'];
const SHOPS = ['weapon-shop', 'armor-shop', 'item-shop', 'white-magic', 'black-magic', 'inn'];

describe('Onrac: the submarine gate (S24 entry, GT-27)', () => {
  const [dx, dy] = town.entrances!.dry_dock;
  const sub = town.transitions.find((t) => t.targetMap === 'sea-shrine-b3')!;

  it('the gangway is an oxyale gate on the transition to sea-shrine-b3 nave, beside the dry_dock entrance', () => {
    expect(sub).toBeDefined();
    expect(sub.targetEntrance).toBe('nave');
    expect(Math.abs(sub.x - dx) + Math.abs(sub.y - dy)).toBe(1);
    const gate = gateAt(town, { x: sub.x, y: sub.y })!;
    expect(gate.requiredItem).toBe('oxyale');
    expect(gate.permanent).toBe(false);
  });

  it('without the oxyale the step is refused with the shipwright\'s line; with it the party boards', () => {
    const from = { x: dx, y: dy };
    const to = { x: sub.x, y: sub.y };
    const no = fieldStep(town, from, to, state());
    expect(no.ok).toBe(false);
    expect(no.message).toMatch(/shipwright/);
    expect(no.message).toMatch(/oxyale/);
    const bottle = fieldStep(town, from, to, state(['fairy_bottle']));
    expect(bottle.ok).toBe(false);
    expect(bottle.message).toMatch(/Gaia's spring/);
    const yes = fieldStep(town, from, to, state(['oxyale']));
    expect(yes.ok).toBe(true);
    expect(yes.transition?.targetMap).toBe('sea-shrine-b3');
  });
});

describe('Onrac: doors, exits, keepers', () => {
  it('the cliff gate leads back to the overworld at wat_onrac; the overworld icon\'s door leads to the gate', () => {
    const out = town.transitions.filter((t) => t.targetMap === 'overworld');
    expect(out.length).toBe(2);
    expect(out.every((t) => t.targetEntrance === 'wat_onrac')).toBe(true);
    const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
    const door = world.transitions.find((t) => t.targetMap === 'onrac')!;
    const [gx, gy] = world.entrances!.wat_onrac;            // the door is the icon's cell just above the gate
    expect(door).toMatchObject({ x: gx, y: gy - 1, targetEntrance: 'gate' });
    expect(town.entrances?.gate).toBeDefined();
  });

  it('every house, shop and the inn: a door into it, and its exit back to the cell in front of that door', () => {
    for (const id of [...HOUSES.map((h) => `onrac-house-${h}`), ...SHOPS.map((s) => `onrac-${s}`)]) {
      const door = town.transitions.find((t) => t.targetMap === id)!;
      expect(door, id).toBeDefined();
      const room = load(id);
      expect(room.entrances?.[door.targetEntrance!], `${id} ${door.targetEntrance}`).toBeDefined();
      const back = room.transitions.filter((t) => t.targetMap === 'onrac');
      expect(back.length, id).toBeGreaterThan(0);
      for (const t of back) expect(town.entrances?.[t.targetEntrance!], `${id} -> ${t.targetEntrance}`).toEqual([door.x, door.y + 1]);
    }
  });

  it('EXIT-safe: every walkable cell of the town has a way back to the cliff gate', () => {
    const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < town.width && y < town.height
      && terrainAllows('walking', baseTerrain(town, x, y));
    const [gx, gy] = town.entrances!.gate;
    const seen = new Set([`${gx},${gy}`]);
    const queue = [[gx, gy]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + ddx},${y + ddy}`;
        if (!seen.has(k) && open(x + ddx, y + ddy)) { seen.add(k); queue.push([x + ddx, y + ddy]); }
      }
    }
    const lost: string[] = [];
    for (let y = 0; y < town.height; y++) for (let x = 0; x < town.width; x++) if (open(x, y) && !seen.has(`${x},${y}`)) lost.push(`${x},${y}`);
    expect(lost).toEqual([]);
  });

  it('the clinic is in the healer\'s house at 90 G a level; the inn keeper has action inn; the five shops', () => {
    const healer = load('onrac-house-healer').npcs.find((n) => n.action === 'clinic');
    expect(healer?.id).toBe('onrac_healer');
    expect(healer?.clinicPrice).toBe(90);
    const keeper = load('onrac-inn').npcs.find((n) => n.shopId === 'onrac_inn');
    expect(keeper?.action).toBe('inn');
    for (const [room, shop] of [['weapon-shop', 'weapon'], ['armor-shop', 'armor'], ['item-shop', 'item'],
      ['white-magic', 'white'], ['black-magic', 'black']]) {
      expect(load(`onrac-${room}`).npcs.some((n) => n.shopId === `onrac_${shop}`), room).toBe(true);
    }
  });

  it('the hint people name the waterfall and the caravan; the shipwright speaks of oxyale; the HUD name is Onrac', () => {
    const lines = (id: string): string => JSON.stringify(town.npcs.find((n) => n.id === id)!.dialog);
    expect(lines('onrac_waterfall_hint')).toMatch(/waterfall/);
    expect(lines('onrac_waterfall_hint')).toMatch(/canoe/);
    expect(lines('onrac_caravan_hint')).toMatch(/caravan/);
    expect(lines('onrac_shipwright')).toMatch(/oxyale/);
    expect(lines('onrac_fairy_lore')).toMatch(/Gaia's spring/);
    expect(town.name).toBe('Onrac');
  });

  it('at least 4 outdoor people react to WATER_CRYSTAL_LIT', () => {
    const lit = town.npcs.filter((n) => JSON.stringify(n.dialog).includes('"WATER_CRYSTAL_LIT"'));
    expect(lit.length).toBeGreaterThanOrEqual(4);
  });
});

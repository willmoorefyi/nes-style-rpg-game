/**
 * Pins today's act-1 field behaviour in the shared field rules (docs/QUEST_PLAN.md 4.1, docs/WORLD_PLAN.md 5.1):
 * the north bridge gates and their message, the temple's Garland cells, the castle doors, NPC blocking, chests,
 * gifts and the King's cutscene, on the compiled act-1 maps. W1-A and W1-B extend fieldRules.ts; these cases must
 * stay unchanged.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData, MapNPC } from '../../src/types/index.js';
import { TerrainType } from '../../src/types/index.js';
import {
  canEnter, canLand, dockFor, dueEncounter, fieldStep, npcOutcome, patchedTerrain, terrainAllows, transitionOpen,
  type FieldMode, type FieldState,
} from '../../src/systems/fieldRules.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { createMapData } from '../helpers/testUtils.js';
import { entrance, gate, patchCells, spot } from '../helpers/worldSpots.js';

const load = (id: string): MapData => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')));

// NW-5: the act-1 cases on the compiled world, by name (its spots, entrances, gates and patches), so they hold on any
// world the composer writes (docs/NATURAL_WORLD_PLAN.md 3.6.5)
const overworlds: [string, MapData][] = [['the compiled world', load('overworld')]];

const state = (flags: string[] = [], items: string[] = [], mode: FieldMode = 'walking'): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode, vehicles: [] });

const npc = (map: MapData, id: string): MapNPC => {
  const found = map.npcs.find((n) => n.id === id);
  if (!found) throw new Error(`no npc ${id} on ${map.id}`);
  return found;
};

// NW-5 (D-NW9), NW2: taiga and snow, where the TerrainType has them, are walkable
const COLD = ['Taiga', 'Snow'].map((n) => (TerrainType as unknown as Record<string, number | undefined>)[n])
  .filter((v): v is TerrainType => v !== undefined);

describe('fieldRules: terrain per mode (today\'s WalkingMode, ShipMode, CanoeMode, AirshipMode)', () => {
  const all = Object.values(TerrainType).filter((v): v is TerrainType => typeof v === 'number');
  it.each([
    ['walking', [TerrainType.Grass, TerrainType.Forest, TerrainType.Desert, TerrainType.Swamp, TerrainType.Road, TerrainType.Bridge,
      ...COLD]],
    ['ship', [TerrainType.Water]],
    ['canoe', [TerrainType.River, TerrainType.Lake]], // W1-A: the canoe never touches Water (QUEST 3.3)
    ['airship', all],
  ] as [FieldMode, TerrainType[]][])('%s may stand on exactly its terrain', (mode, allowed) => {
    for (const t of all) expect(terrainAllows(mode, t), `${mode} on ${TerrainType[t]}`).toBe(allowed.includes(t));
  });

  it('reads the compiled terrain; outside the map and unknown values are Wall, 11 is Lake; no patches in act 1', () => {
    const map = createMapData({ width: 4, height: 1, collision: [0, 10, 11, 14] });
    expect(patchedTerrain(map, 0, 0, new Set())).toBe(TerrainType.Grass);
    expect(patchedTerrain(map, 1, 0, new Set())).toBe(TerrainType.Wall);
    expect(patchedTerrain(map, 2, 0, new Set())).toBe(TerrainType.Lake); // W1-A: the canoe's lakes
    expect(patchedTerrain(map, 3, 0, new Set())).toBe(TerrainType.Wall);
    expect(patchedTerrain(map, -1, 0, new Set())).toBe(TerrainType.Wall);
  });

  it.each(overworlds)('has no landing on Cornelia\'s arrival and no dock on land (%s)', (_name, ow) => {
    expect(canLand(ow, entrance(ow, 'cornelia'), state([], [], 'airship'))).toBe(false);
    expect(dockFor(ow, entrance(ow, 'cornelia'))).toBeNull();
    expect(dockFor(ow, spot(ow, 'a1_s_pravoka_ship'))?.id).toBe('a1_pravoka');
  });
});

describe.each(overworlds)('fieldRules: the north bridge (%s)', (_name, ow) => {
  const gates = [gate(ow, 'a1_bridge_gate_w'), gate(ow, 'a1_bridge_gate_e')];
  const gap = patchCells(ow, 'north_bridge');
  // the walkable cell beside a gate on the side away from the gap (the south stub), and the gap cell beside it
  const off = (g: { x: number; y: number }, sign: number): { x: number; y: number } => {
    const n = gap.find((c) => Math.abs(c.x - g.x) + Math.abs(c.y - g.y) === 1)!;
    return { x: g.x + sign * (n.x - g.x), y: g.y + sign * (n.y - g.y) };
  };
  const south = (i: number): { x: number; y: number } => off(gates[i], -1);
  const north = (i: number): { x: number; y: number } => off(gates[i], 1);
  const before = 'The bridge has collapsed into the sea. Only the King\'s builders could repair it.';
  const after = 'The King\'s builders are at work on the bridge, but it isn\'t finished yet.';

  it.each([[0], [1]])('bridge gate %i is shut without BRIDGE_BUILT, with the act-1 message', (i) => {
    const step = fieldStep(ow, south(i), gates[i], state());
    expect(step).toEqual({ ok: false, mode: 'walking', setFlags: [], message: before });
    expect(canEnter(ow, gates[i], 'walking', state())).toBe(false);
  });

  it('after the King\'s order (INTRO_COMPLETE) the message changes and the gate stays shut', () => {
    const step = fieldStep(ow, south(0), gates[0], state(['INTRO_COMPLETE']));
    expect(step.ok).toBe(false);
    expect(step.message).toBe(after);
  });

  it('BRIDGE_BUILT opens the gate cells (not permanent: no flag is set)', () => {
    const step = fieldStep(ow, south(0), gates[0], state(['BRIDGE_BUILT']));
    expect(step).toEqual({ ok: true, mode: 'walking', setFlags: [] });
    expect(canEnter(ow, gates[0], 'walking', state(['BRIDGE_BUILT']))).toBe(true);
  });

  it('the gap north of the stubs is water until the north_bridge patch (BRIDGE_BUILT, A1-O) lays the span', () => {
    expect(canEnter(ow, north(0), 'walking', state(['INTRO_COMPLETE']))).toBe(false);
    expect(canEnter(ow, north(0), 'walking', state(['BRIDGE_BUILT']))).toBe(true);
  });

  it('a step must be to a 4-neighbour; land, sea and the temple door', () => {
    const c = entrance(ow, 'cornelia');
    const sea = spot(ow, 'a1_s_pravoka_ship');
    expect(fieldStep(ow, c, { x: c.x + 2, y: c.y }, state()).ok).toBe(false);
    expect(canEnter(ow, c, 'walking', state())).toBe(true);
    expect(canEnter(ow, sea, 'walking', state())).toBe(false);
    expect(canEnter(ow, sea, 'ship', state([], [], 'ship'))).toBe(true);
    const door = ow.transitions.find((t) => t.targetMap === 'temple-of-fiends');
    expect(door).toBeDefined();
    if (!door) return;
    expect(transitionOpen(door, state())).toBe(true);
  });
});

describe('fieldRules: the temple\'s Garland cells', () => {
  const temple = load('temple-of-fiends');

  it.each([[10], [13]])('stepping onto (%i, 6) starts Garland until GARLAND_DEFEATED', (x) => {
    const from = { x, y: 7 };
    const step = fieldStep(temple, from, { x, y: 6 }, state());
    expect(step.ok).toBe(true);
    expect(step.encounter?.enemyIds).toEqual(['garland']);
    expect(step.encounter?.isBoss).toBe(true);
    expect(dueEncounter(temple, { x, y: 6 }, state(['GARLAND_DEFEATED']))).toBeNull();
    expect(fieldStep(temple, from, { x, y: 6 }, state(['GARLAND_DEFEATED'])).encounter).toBeUndefined();
  });

  it('Garland blocks his cell and talking to him starts the fight; he is gone once defeated', () => {
    const g = npc(temple, 'garland');
    expect(canEnter(temple, { x: g.x, y: g.y }, 'walking', state())).toBe(false);
    const talk = npcOutcome(g, state(), temple.scriptedEncounters ?? []);
    expect(talk.present).toBe(true);
    expect(talk.battle).toBe('GARLAND_DEFEATED');
    expect(talk.dialog[0]).toBe('Garland: You dare follow me here?');
    expect(npcOutcome(g, state(['GARLAND_DEFEATED']), temple.scriptedEncounters ?? []).present).toBe(false);
    expect(canEnter(temple, { x: g.x, y: g.y }, 'walking', state(['GARLAND_DEFEATED']))).toBe(true);
  });

  it('a chest gives its item once', () => {
    const chest = npc(temple, 'chest_rapier');
    const first = npcOutcome(chest, state(), []);
    expect(first.give).toBe('rapier');
    expect(first.setFlags).toEqual([chest.chestFlag]);
    expect(first.dialog).toEqual(['You found a Rapier!']);
    const again = npcOutcome(chest, state([chest.chestFlag ?? '']), []);
    expect(again.give).toBeUndefined();
    expect(again.dialog).toEqual(['Already opened.']);
  });
});

describe('fieldRules: the castle', () => {
  const castle = load('cornelia-castle');
  const floor2 = load('cornelia-castle-2f');

  it.each([[21], [22]])('the front door at (%i, 33) leads to Cornelia\'s castle entrance', (x) => {
    const step = fieldStep(castle, { x, y: 32 }, { x, y: 33 }, state());
    expect(step.ok).toBe(true);
    expect(step.transition).toMatchObject({ targetMap: 'cornelia', targetEntrance: 'castle' });
  });

  it('the stairs at (21, 8) lead up', () => {
    const step = fieldStep(castle, { x: 21, y: 9 }, { x: 21, y: 8 }, state());
    expect(step.transition).toMatchObject({ targetMap: 'cornelia-castle-2f', targetEntrance: 'stairs' });
  });

  it('a static NPC blocks its cell; a wanderer does not (the game tracks where it is)', () => {
    const king = npc(floor2, 'king');
    expect(canEnter(floor2, { x: king.x, y: king.y }, 'walking', state())).toBe(false);
    const maid = npc(floor2, 'princess_maid');
    expect(maid.wander).toBe(true);
    expect(canEnter(floor2, { x: maid.x, y: maid.y }, 'walking', state())).toBe(true);
  });

  it('the princess appears with PRINCESS_RESCUED and gives the lute once', () => {
    const p = npc(floor2, 'princess');
    expect(npcOutcome(p, state(), []).present).toBe(false);
    const gift = npcOutcome(p, state(['PRINCESS_RESCUED']), []);
    expect(gift).toMatchObject({ present: true, give: 'lute', setFlags: ['GOT_LUTE'] });
    const later = npcOutcome(p, state(['PRINCESS_RESCUED', 'GOT_LUTE']), []);
    expect(later.give).toBeUndefined();
    expect(later.dialog).toEqual(['Thank you again. Keep the lute safe.']);
  });

  it('the King plays act1_complete once, after the rescue', () => {
    const king = npc(floor2, 'king');
    expect(npcOutcome(king, state(), []).cutscene).toBeUndefined();
    expect(npcOutcome(king, state(['PRINCESS_RESCUED']), []).cutscene).toBe('act1_complete');
    expect(npcOutcome(king, state(['PRINCESS_RESCUED', 'INTRO_COMPLETE']), []).cutscene).toBeUndefined();
  });
});

describe('fieldRules: gates, transitions and encounters on synthetic maps', () => {
  it('an item gate opens with the item; a permanent gate sets its flag and stays open', () => {
    const map = createMapData({
      keyItemGates: [{ x: 1, y: 0, requiredItem: 'mystic_key', flag: 'DOOR_OPEN', message: 'Locked.', permanent: true }],
    });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state())).toMatchObject({ ok: false, message: 'Locked.' });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state([], ['mystic_key']))).toMatchObject({ ok: true, setFlags: ['DOOR_OPEN'] });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state(['DOOR_OPEN']))).toMatchObject({ ok: true, setFlags: [] });
  });

  it('requiredFlags are an AND, on gates, transitions and encounters', () => {
    const map = createMapData({
      transitions: [{ x: 1, y: 0, targetMap: 'b', targetX: 0, targetY: 0, requiredFlags: ['A', 'B'] }],
      scriptedEncounters: [{ x: 1, y: 0, enemyIds: ['goblin'], flag: 'WON', isBoss: false, requiredFlags: ['A'] }],
    });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state(['A'])).transition).toBeUndefined();
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state(['A'])).encounter?.flag).toBe('WON');
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state(['A', 'B'])).transition?.targetMap).toBe('b');
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state()).encounter).toBeUndefined();
  });

  it('a vehicle moves only over its own terrain; off a dock the ship cannot land, the sea refuses a walker (W1-A)', () => {
    const map = createMapData({ width: 3, height: 1, collision: [TerrainType.Grass, TerrainType.Water, TerrainType.Water] });
    expect(fieldStep(map, { x: 1, y: 0 }, { x: 2, y: 0 }, state([], [], 'ship'))).toEqual({ ok: true, mode: 'ship', setFlags: [] });
    expect(fieldStep(map, { x: 1, y: 0 }, { x: 0, y: 0 }, state([], [], 'ship')).ok).toBe(false);
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state()).ok).toBe(false);
    expect(fieldStep(map, { x: 1, y: 0 }, { x: 0, y: 0 }, state([], [], 'airship'))).toEqual({ ok: true, mode: 'airship', setFlags: [] });
  });
});

// WR (docs/WORLD_WRAP_PLAN.md 4, 10): a wrapped map steps across both seams; a flat one refuses them
describe('fieldRules: the wrap', () => {
  const W = TerrainType.Water;
  const G = TerrainType.Grass;
  // 4x3: a water ring with grass at (1, 1) and (2, 1)
  const cells = [W, W, W, W, W, G, G, W, W, W, W, W];
  const torus = createMapData({ width: 4, height: 3, collision: cells, wrap: true });
  const flat = createMapData({ width: 4, height: 3, collision: cells });
  const ship = state([], [], 'ship');

  it('fieldStep (3, y) to (0, y) and (x, 0) to (x, 2) is OK wrapped and refused flat', () => {
    expect(fieldStep(torus, { x: 3, y: 0 }, { x: 0, y: 0 }, ship).ok).toBe(true);
    expect(fieldStep(torus, { x: 1, y: 0 }, { x: 1, y: 2 }, ship).ok).toBe(true);
    expect(fieldStep(flat, { x: 3, y: 0 }, { x: 0, y: 0 }, ship).ok).toBe(false);
    expect(fieldStep(flat, { x: 1, y: 0 }, { x: 1, y: 2 }, ship).ok).toBe(false);
  });

  it('fieldStep with a non-canonical target is accepted wrapped, refused flat', () => {
    expect(fieldStep(torus, { x: 3, y: 0 }, { x: 4, y: 0 }, ship)).toEqual({ ok: true, mode: 'ship', setFlags: [] });
    expect(fieldStep(torus, { x: 0, y: 0 }, { x: 0, y: -1 }, ship).ok).toBe(true);
    expect(fieldStep(flat, { x: 3, y: 0 }, { x: 4, y: 0 }, ship).ok).toBe(false);
    expect(fieldStep(torus, { x: 3, y: 0 }, { x: 5, y: 0 }, ship).ok).toBe(false);
  });

  it('canEnter on (-1, y) reads (W - 1, y) wrapped; the strict lookups stay strict', () => {
    expect(canEnter(torus, { x: -1, y: 1 }, 'ship', ship)).toBe(true);
    expect(canEnter(flat, { x: -1, y: 1 }, 'ship', ship)).toBe(false);
    expect(patchedTerrain(torus, -1, 1, new Set())).toBe(TerrainType.Wall);
  });

  it('a walker never crosses: the grass stays its own component; a ship mode change across the seam is read canonically', () => {
    const map = createMapData({ width: 4, height: 1, collision: [G, W, W, W], wrap: true,
      docks: [{ id: 'd', x: 3, y: 0, basin: 'b' }] });
    // the ship at (3, 0) disembarks onto the grass at (0, 0) across the seam (a dock on the canonical cell)
    expect(fieldStep(map, { x: 3, y: 0 }, { x: 4, y: 0 }, ship)).toMatchObject({ ok: true, mode: 'walking' });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: -1, y: 0 }, state()).ok).toBe(false);
  });
});

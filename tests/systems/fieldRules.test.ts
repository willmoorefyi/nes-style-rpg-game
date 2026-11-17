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
import { a1At, translateA1 } from '../helpers/worldFrame.js';

const load = (id: string): MapData => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')));

// W1-B (GAP-17): the compiled overworld is the act-1 map or the 192x192 world with `world.frames.a1`; the act-1 cases
// run on it and on the act-1 block translated into the world frame (the same map when it already is the world)
const compiledOverworld = load('overworld');
const translated = translateA1(compiledOverworld);
const overworlds: [string, MapData][] = translated === compiledOverworld
  ? [['the compiled world', compiledOverworld]]
  : [['the act-1 overworld', compiledOverworld], ['the act-1 block in the world frame', translated]];

const state = (flags: string[] = [], items: string[] = [], mode: FieldMode = 'walking'): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode, vehicles: [] });

const npc = (map: MapData, id: string): MapNPC => {
  const found = map.npcs.find((n) => n.id === id);
  if (!found) throw new Error(`no npc ${id} on ${map.id}`);
  return found;
};

describe('fieldRules: terrain per mode (today\'s WalkingMode, ShipMode, CanoeMode, AirshipMode)', () => {
  const all = Object.values(TerrainType).filter((v): v is TerrainType => typeof v === 'number');
  it.each([
    ['walking', [TerrainType.Grass, TerrainType.Forest, TerrainType.Desert, TerrainType.Swamp, TerrainType.Road, TerrainType.Bridge]],
    ['ship', [TerrainType.Water]],
    ['canoe', [TerrainType.River, TerrainType.Lake]], // W1-A: the canoe never touches Water (QUEST 3.3)
    ['airship', all],
  ] as [FieldMode, TerrainType[]][])('%s may stand on exactly its terrain', (mode, allowed) => {
    for (const t of all) expect(terrainAllows(mode, t), `${mode} on ${TerrainType[t]}`).toBe(allowed.includes(t));
  });

  it('reads the compiled terrain; outside the map and unknown values are Wall, 11 is Lake; no patches in act 1', () => {
    const map = createMapData({ width: 4, height: 1, collision: [0, 10, 11, 12] });
    expect(patchedTerrain(map, 0, 0, new Set())).toBe(TerrainType.Grass);
    expect(patchedTerrain(map, 1, 0, new Set())).toBe(TerrainType.Wall);
    expect(patchedTerrain(map, 2, 0, new Set())).toBe(TerrainType.Lake); // W1-A: the canoe's lakes
    expect(patchedTerrain(map, 3, 0, new Set())).toBe(TerrainType.Wall);
    expect(patchedTerrain(map, -1, 0, new Set())).toBe(TerrainType.Wall);
  });

  it.each(overworlds)('has no landing and no docks in act 1 (%s)', (_name, ow) => {
    expect(canLand(ow, a1At(ow, 28, 47), state([], [], 'airship'))).toBe(false);
    expect(dockFor(ow, a1At(ow, 28, 57))).toBeNull();
  });
});

describe.each(overworlds)('fieldRules: the north bridge (%s)', (_name, ow) => {
  const at = (x: number, y: number): { x: number; y: number } => a1At(ow, x, y);
  const before = 'The bridge has collapsed into the sea. Only the King\'s builders could repair it.';
  const after = 'The King\'s builders are at work on the bridge, but it isn\'t finished yet.';

  it.each([[29], [30]])('the gate at (%i, 32) is shut without BRIDGE_BUILT, with the act-1 message', (x) => {
    const step = fieldStep(ow, at(x, 33), at(x, 32), state());
    expect(step).toEqual({ ok: false, mode: 'walking', setFlags: [], message: before });
    expect(canEnter(ow, at(x, 32), 'walking', state())).toBe(false);
  });

  it('after the King\'s order (INTRO_COMPLETE) the message changes and the gate stays shut', () => {
    const step = fieldStep(ow, at(29, 33), at(29, 32), state(['INTRO_COMPLETE']));
    expect(step.ok).toBe(false);
    expect(step.message).toBe(after);
  });

  it('BRIDGE_BUILT opens the gate cells (not permanent: no flag is set)', () => {
    const step = fieldStep(ow, at(29, 33), at(29, 32), state(['BRIDGE_BUILT']));
    expect(step).toEqual({ ok: true, mode: 'walking', setFlags: [] });
    expect(canEnter(ow, at(29, 32), 'walking', state(['BRIDGE_BUILT']))).toBe(true);
  });

  it('the gap north of the stubs is water until the north_bridge patch (BRIDGE_BUILT, A1-O) lays the span', () => {
    expect(canEnter(ow, at(29, 31), 'walking', state(['INTRO_COMPLETE']))).toBe(false);
    // the legacy 72x72 map has no patch; the compiled world carries north_bridge
    expect(canEnter(ow, at(29, 31), 'walking', state(['BRIDGE_BUILT']))).toBe((ow.patches ?? []).some((p) => p.id === 'north_bridge'));
  });

  it('a step must be to a 4-neighbour; land, sea and the temple door', () => {
    expect(fieldStep(ow, at(28, 47), at(30, 47), state()).ok).toBe(false);
    expect(canEnter(ow, at(28, 47), 'walking', state())).toBe(true);
    expect(canEnter(ow, at(0, 0), 'walking', state())).toBe(false);
    expect(canEnter(ow, at(0, 0), 'ship', state([], [], 'ship'))).toBe(true);
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

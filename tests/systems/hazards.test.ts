/**
 * Hazards (docs/QUEST_PLAN.md 4.2, W1-B): each walking step onto a hazard cell takes `damage` HP from every living
 * member, never below 1 HP (fieldStep reports it; systems/hazards.ts applies it). Zone `modes` (GAP-6) are here too:
 * the encounter tables a sea zone or a land zone apply to.
 */
import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { TerrainType, type EncounterZone, type MapData } from '../../src/types/index.js';
import { fieldStep, hazardAt, type FieldState } from '../../src/systems/fieldRules.js';
import { applyHazard } from '../../src/systems/hazards.js';
import { hazardStep } from '../../src/scenes/exploration/FieldHazard.js';
import { EncounterSystem, zoneAppliesTo } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { createMapData } from '../helpers/testUtils.js';
import { member } from '../helpers/npcActions.js';

const state = (mode: FieldState['mode'] = 'walking'): FieldState => ({ flags: new Set(), items: new Set(), mode, vehicles: [] });

const lava = (): MapData => createMapData({
  width: 4, height: 2,
  collision: [0, 0, 0, 0, 2, 2, 2, 2],
  hazards: [{ id: 'lava', rects: [[1, 0, 2, 0]], damage: 3 }],
});

describe('hazards: the field step', () => {
  it('a walking step onto a hazard cell reports its damage; off it, nothing (rects inclusive)', () => {
    const map = lava();
    expect(hazardAt(map, { x: 2, y: 0 })?.id).toBe('lava');
    expect(hazardAt(map, { x: 3, y: 0 })).toBeNull();
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state())).toEqual({ ok: true, mode: 'walking', setFlags: [], hazard: 3 });
    expect(fieldStep(map, { x: 2, y: 0 }, { x: 3, y: 0 }, state())).toEqual({ ok: true, mode: 'walking', setFlags: [] });
  });

  it('a refused step or a vehicle step takes nothing', () => {
    const map = createMapData({ width: 2, height: 1, collision: [TerrainType.Water, TerrainType.Water],
      hazards: [{ id: 'reef', rects: [[0, 0, 1, 0]], damage: 5 }] });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state()).hazard).toBeUndefined();
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state('ship'))).toEqual({ ok: true, mode: 'ship', setFlags: [] });
  });
});

describe('hazards: the party', () => {
  it('every living member loses the damage, never below 1 HP; the fallen are untouched', () => {
    const party = [member('A', 5), member('B', 5, 2), member('C', 5, 0), member('D', 5, 1)];
    const full = party[0].currentHp;
    expect(applyHazard(party, 3)).toBe(2);
    expect(party.map((c) => c.currentHp)).toEqual([full - 3, 1, 0, 1]);
  });

  it('the field step flashes red over the field (removed at once without animation frames)', () => {
    const parent = new Container();
    const add = vi.spyOn(parent, 'addChild');
    hazardStep(parent, [member('A', 5)], 1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(parent.children).toHaveLength(0);
    hazardStep(parent, [member('A', 5, 1)], 1); // nobody can lose HP: no flash
    expect(add).toHaveBeenCalledTimes(1);
  });
});

describe('zone modes (GAP-6)', () => {
  const sea: EncounterZone = { id: 'sea', rects: [[0, 0, 3, 3]], modes: ['ship'], encounters: [{ enemies: ['shark'], weight: 1 }] };
  const shore: EncounterZone = { id: 'shore', rects: [[0, 0, 3, 3]], encounters: [{ enemies: ['goblin'], weight: 1 }] };

  it('a zone without modes is walking and canoe; a sea zone is the ship\'s', () => {
    expect(zoneAppliesTo(shore, 'walking')).toBe(true);
    expect(zoneAppliesTo(shore, 'canoe')).toBe(true);
    expect(zoneAppliesTo(shore, 'ship')).toBe(false);
    expect(zoneAppliesTo(sea, 'ship')).toBe(true);
    expect(zoneAppliesTo(sea, 'walking')).toBe(false);
  });

  it('the encounter system picks the zone of the party\'s mode; the map table is not the ship\'s', () => {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    const met: string[][] = [];
    sys.setOnEncounter((e) => met.push(e));
    sys.setRate({ min: 1, max: 1 });
    sys.setEncounters([{ enemies: ['imp'], weight: 1 }]);
    sys.setZones([sea, shore]);
    sys.start();
    events.emit('playerMove', { x: 1, y: 1 });
    expect(sys.zoneAt(1, 1)?.id).toBe('shore');
    sys.setMode('ship');
    expect(sys.zoneAt(1, 1)?.id).toBe('sea');
    events.emit('playerMove', { x: 1, y: 1 });
    events.emit('playerMove', { x: 9, y: 9 }); // outside every zone: the map table, not for the ship
    expect(met.map((e) => e[0])).toEqual(['goblin', 'shark']);
  });
});

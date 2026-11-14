import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { EncounterZone } from '../../src/types/index.js';

describe('EncounterSystem', () => {
  let events: EventBus;
  let system: EncounterSystem;

  beforeEach(() => {
    events = new EventBus();
    system = new EncounterSystem(events);
  });

  it('initializes with default rate', () => {
    expect(system.stepsRemaining).toBeGreaterThanOrEqual(20);
    expect(system.stepsRemaining).toBeLessThanOrEqual(30);
  });

  it('setRate changes step range', () => {
    const rng = () => 0;
    const sys = new EncounterSystem(events, rng);
    sys.setRate({ min: 5, max: 10 });
    expect(sys.stepsRemaining).toBe(5);
  });

  it('decrements counter on playerMove', () => {
    system.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    system.start();
    const initial = system.stepsRemaining;
    events.emit('playerMove', { x: 1, y: 1 });
    expect(system.stepsRemaining).toBe(initial - 1);
    system.stop();
  });

  it('triggers encounter when counter reaches 0', () => {
    const rng = () => 0;
    const sys = new EncounterSystem(events, rng);
    sys.setRate({ min: 2, max: 2 });
    sys.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    const callback = vi.fn();
    sys.setOnEncounter(callback);
    sys.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(callback).not.toHaveBeenCalled();
    events.emit('playerMove', { x: 2, y: 1 });
    expect(callback).toHaveBeenCalledWith(['goblin']);

    sys.stop();
  });

  it('resets counter after encounter', () => {
    const rng = () => 0;
    const sys = new EncounterSystem(events, rng);
    sys.setRate({ min: 1, max: 1 });
    sys.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    sys.setOnEncounter(() => {});
    sys.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(sys.stepsRemaining).toBe(1);

    sys.stop();
  });

  it('does not trigger when no encounters set', () => {
    const rng = () => 0;
    const sys = new EncounterSystem(events, rng);
    sys.setRate({ min: 1, max: 1 });
    const callback = vi.fn();
    sys.setOnEncounter(callback);
    sys.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(callback).not.toHaveBeenCalled();

    sys.stop();
  });

  it('stop removes listener', () => {
    system.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    system.start();
    system.stop();
    const initial = system.stepsRemaining;
    events.emit('playerMove', { x: 1, y: 1 });
    expect(system.stepsRemaining).toBe(initial);
  });
});

describe('EncounterSystem zones (T4c)', () => {
  const zone: EncounterZone = { id: 'z', rects: [[0, 0, 4, 4]], encounters: [{ enemies: ['zone_enemy'], weight: 1 }] };

  function makeSystem(rng: () => number, zones: EncounterZone[]) {
    const events = new EventBus();
    const sys = new EncounterSystem(events, rng);
    sys.setRate({ min: 1, max: 1 });
    sys.setEncounters([{ enemies: ['map_enemy'], weight: 1 }]);
    sys.setZones(zones);
    const callback = vi.fn();
    sys.setOnEncounter(callback);
    sys.start();
    return { events, sys, callback };
  }

  it('uses the zone table inside the zone and the map table outside', () => {
    const { events, callback } = makeSystem(() => 0, [zone]);
    events.emit('playerMove', { x: 2, y: 2 });
    expect(callback).toHaveBeenLastCalledWith(['zone_enemy']);
    events.emit('playerMove', { x: 9, y: 9 });
    expect(callback).toHaveBeenLastCalledWith(['map_enemy']);
  });

  it('treats rects as inclusive and picks the first zone that contains the cell', () => {
    const second: EncounterZone = { id: 'z2', rects: [[4, 4, 6, 6]], encounters: [{ enemies: ['second'], weight: 1 }] };
    const { events, sys, callback } = makeSystem(() => 0, [zone, second]);
    expect(sys.zoneAt(4, 4)?.id).toBe('z');
    expect(sys.zoneAt(5, 6)?.id).toBe('z2');
    expect(sys.zoneAt(5, 7)).toBeNull();
    events.emit('playerMove', { x: 6, y: 6 });
    expect(callback).toHaveBeenLastCalledWith(['second']);
  });

  it('resets the counter with the zone rate after a battle in the zone, and keeps the map base rate', () => {
    const rated: EncounterZone = { ...zone, encounterRate: { min: 40, max: 50 } };
    const { events, sys, callback } = makeSystem(seeded(3), [rated]);
    events.emit('playerMove', { x: 2, y: 2 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(sys.stepsRemaining).toBeGreaterThanOrEqual(40);
    expect(sys.stepsRemaining).toBeLessThanOrEqual(50);
    // walk out and count down: the next reset uses the map's own rate (1-1), not the zone's
    while (callback.mock.calls.length < 2) events.emit('playerMove', { x: 9, y: 9 });
    expect(callback).toHaveBeenLastCalledWith(['map_enemy']);
    expect(sys.stepsRemaining).toBe(1);
  });

  it('counts steps in a zone with a table even when the map has none', () => {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    sys.setRate({ min: 1, max: 1 });
    sys.setEncounters([]);
    sys.setZones([zone]);
    const callback = vi.fn();
    sys.setOnEncounter(callback);
    sys.start();
    events.emit('playerMove', { x: 9, y: 9 });
    expect(callback).not.toHaveBeenCalled();
    events.emit('playerMove', { x: 1, y: 1 });
    expect(callback).toHaveBeenCalledWith(['zone_enemy']);
  });

  it('setZones([]) drops the last map zones', () => {
    const { events, sys, callback } = makeSystem(() => 0, [zone]);
    sys.setZones([]);
    events.emit('playerMove', { x: 2, y: 2 });
    expect(callback).toHaveBeenLastCalledWith(['map_enemy']);
  });

  it('rolls group formations from a zone table', () => {
    const groups: EncounterZone = { id: 'g', rects: [[0, 0, 4, 4]],
      encounters: [{ groups: [{ id: 'wolf', min: 3, max: 3 }], weight: 1 }] };
    const { events, callback } = makeSystem(() => 0, [groups]);
    events.emit('playerMove', { x: 0, y: 0 });
    expect(callback).toHaveBeenCalledWith(['wolf', 'wolf', 'wolf']);
  });
});

describe('W4: the countdown is not restarted by map loads', () => {
  it('a running countdown survives map loads and is only clamped to a smaller map maximum', () => {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    sys.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    sys.start();
    sys.setRate({ min: 15, max: 30 });                   // the first map: a fresh roll
    expect(sys.stepsRemaining).toBe(15);
    for (let i = 0; i < 5; i++) events.emit('playerMove', { x: 1, y: 1 });
    expect(sys.stepsRemaining).toBe(10);
    sys.setRate({ min: 999, max: 999 });                 // an interior
    expect(sys.stepsRemaining).toBe(10);
    sys.setRate({ min: 8, max: 15 });                    // the temple
    expect(sys.stepsRemaining).toBe(10);
    sys.setRate({ min: 2, max: 5 });
    expect(sys.stepsRemaining).toBe(5);
    sys.stop();
  });

  it('restart() rolls a fresh countdown on the current rate (new game, load, retry)', () => {
    const sys = new EncounterSystem(new EventBus(), () => 0);
    sys.setRate({ min: 15, max: 30 });
    sys.setRate({ min: 4, max: 6 });
    expect(sys.stepsRemaining).toBe(6);
    sys.restart();
    expect(sys.stepsRemaining).toBe(4);
  });

  it('the clamp uses the movement mode multiplier', () => {
    const sys = new EncounterSystem(new EventBus(), () => 0);
    sys.setRate({ min: 30, max: 30 });
    sys.setRateMultiplier(2);
    sys.setRate({ min: 10, max: 10 });
    expect(sys.stepsRemaining).toBe(5);
  });
});

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';

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

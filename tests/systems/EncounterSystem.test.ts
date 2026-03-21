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
    vi.spyOn(Math, 'random').mockReturnValue(0);
    system.setRate({ min: 5, max: 10 });
    expect(system.stepsRemaining).toBe(5);
    vi.restoreAllMocks();
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
    vi.spyOn(Math, 'random').mockReturnValue(0);
    system.setRate({ min: 2, max: 2 });
    system.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    const callback = vi.fn();
    system.setOnEncounter(callback);
    system.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(callback).not.toHaveBeenCalled();
    events.emit('playerMove', { x: 2, y: 1 });
    expect(callback).toHaveBeenCalledWith(['goblin']);

    system.stop();
    vi.restoreAllMocks();
  });

  it('resets counter after encounter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    system.setRate({ min: 1, max: 1 });
    system.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    system.setOnEncounter(() => {});
    system.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(system.stepsRemaining).toBe(1);

    system.stop();
    vi.restoreAllMocks();
  });

  it('does not trigger when no encounters set', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    system.setRate({ min: 1, max: 1 });
    const callback = vi.fn();
    system.setOnEncounter(callback);
    system.start();

    events.emit('playerMove', { x: 1, y: 1 });
    expect(callback).not.toHaveBeenCalled();

    system.stop();
    vi.restoreAllMocks();
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

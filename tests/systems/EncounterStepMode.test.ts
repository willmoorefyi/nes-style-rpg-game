import { describe, it, expect, vi } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { EncounterZone } from '../../src/types/index.js';

// P2-01: playerMove fires before the scene applies the step's mode change.
describe('EncounterSystem step mode (P2-01)', () => {
  const walkZone: EncounterZone = { id: 'walk', modes: ['walking'], rects: [[0, 0, 4, 4]], encounters: [{ enemies: ['walker'], weight: 1 }] };
  const canoeZone: EncounterZone = { id: 'canoe', modes: ['canoe'], rects: [[0, 0, 9, 9]], encounters: [{ enemies: ['paddler'], weight: 1 }] };

  function make() {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    sys.setRate({ min: 1, max: 1 });
    sys.setEncounters([{ enemies: ['goblin'], weight: 1 }]);
    sys.setZones([walkZone, canoeZone]);
    const callback = vi.fn();
    sys.setOnEncounter(callback);
    sys.start();
    return { events, sys, callback };
  }

  it('looks the cell up in the mode the step ends in, not the mode it began in', () => {
    const { events, sys, callback } = make();
    sys.setMode('walking'); // the scene's frame-start mode: the step boards the canoe
    sys.setStepModeResolver(() => 'canoe');
    events.emit('playerMove', { x: 7, y: 7 });
    expect(callback).toHaveBeenLastCalledWith(['paddler']);
    expect(sys.zoneAt(7, 7)?.id).toBe('canoe');
  });

  it('without the fix the river cell would roll the map table (goblin)', () => {
    const { events, sys, callback } = make();
    sys.setMode('walking'); // no resolver: the old behaviour, a hole in the walking zones
    events.emit('playerMove', { x: 7, y: 7 });
    expect(callback).toHaveBeenLastCalledWith(['goblin']);
    void sys;
  });

  it('keeps the current mode when the resolver has no answer', () => {
    const { events, sys, callback } = make();
    sys.setMode('canoe');
    sys.setStepModeResolver(() => null);
    events.emit('playerMove', { x: 7, y: 7 });
    expect(callback).toHaveBeenLastCalledWith(['paddler']);
  });

  it('a step off the water uses the walking zone', () => {
    const { events, sys, callback } = make();
    sys.setMode('canoe');
    sys.setStepModeResolver(() => 'walking');
    events.emit('playerMove', { x: 2, y: 2 });
    expect(callback).toHaveBeenLastCalledWith(['walker']);
  });
});

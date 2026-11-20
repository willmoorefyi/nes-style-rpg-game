import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flightField, flightMap, resetStub, stub } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * NW-5 (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9): in flight the landing marker (FlightView, through `canLand`) shows
 * over tundra and not over snow. The field: the flight harness's grass map with tundra at x 6, y 15-20 (the airship
 * parked at (6, 20)) and snow at x 6, y 10-14.
 */
describe('Mode 7 landing marker on cold ground', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('shows over tundra, not over snow', async () => {
    const map = flightMap();
    for (let y = 15; y <= 20; y++) map.collision[y * map.width + 6] = 12;
    for (let y = 10; y <= 14; y++) map.collision[y * map.width + 6] = 13;
    const f = await flightField({ mode7: 'on', map });
    await f.idle(1);
    await f.confirm();                                 // take off from tundra
    await f.idle(1);
    while (f.report().busy === true) await f.frame();
    await f.idle(1);
    expect(f.report().state).toBe('flying');
    expect(f.report().marker).toBe(true);
    expect(stub.last?.marker).toHaveLength(4);
    await f.steps('up', 6);                            // (6, 14): snow
    await f.idle(1);
    expect(f.game.playerPosition).toEqual({ x: 6, y: 14 });
    expect(f.report().marker).toBe(false);
    expect(stub.last?.marker).toBeNull();
  });
});

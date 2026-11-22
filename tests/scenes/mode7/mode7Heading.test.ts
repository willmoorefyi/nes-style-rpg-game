import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldVehicles } from '../../../src/scenes/exploration/FieldVehicles.js';
import { SHIP_FOOT_Y } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { flightField, flightMap, resetStub, stub } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * The airship's heading in flight (docs/AIRSHIP_VIEWS_PLAN.md 5.3, 7): the flight frame carries the field's heading
 * (one owner, FieldVehicleSprites), kept current while the top-down world is hidden. The 100 ms turn timing is the
 * sprites' clock's (airshipHeading.test.ts, fieldVehicleArt.test.ts); here only turnFrom / turnAt are asserted.
 */
describe('AIRSHIP_VIEWS: the heading in Mode 7', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('north shows the back view, south the front (instant), east the side with a turn from the front', async () => {
    const spy = vi.spyOn(FieldVehicles.prototype, 'airshipHeading');
    const f = await flightField({ mode7: 'on', map: flightMap({ width: 60, height: 60 }), start: { x: 30, y: 30 },
      fieldMode: 'airship', vehicles: [] });
    await f.idle(2);
    expect(f.report().state).toBe('flying');
    const vehicles = spy.mock.instances[0] as unknown as FieldVehicles;   // the spied method's this (vitest types it as the return)
    const heading = () => stub.last!.ship.heading;
    expect(heading()).toMatchObject({ end: 'side', side: 'right' });
    await f.step('up');
    expect(heading()).toMatchObject({ end: 'back', side: 'right', turnFrom: 'side' });
    expect(heading()).toEqual(vehicles.airshipHeading());
    await f.step('down');
    expect(heading()).toMatchObject({ end: 'front', side: 'right', turnFrom: null });
    expect(heading()).toEqual(vehicles.airshipHeading());
    const before = heading().turnAt;
    await f.step('right');
    expect(heading()).toMatchObject({ end: 'side', side: 'right', turnFrom: 'front' });
    expect(heading().turnAt).toBeGreaterThanOrEqual(before);
    expect(heading()).toEqual(vehicles.airshipHeading());
    await f.step('left');
    expect(heading()).toMatchObject({ end: 'side', side: 'left', turnFrom: null });
    expect([stub.last!.ship.x, stub.last!.ship.footY]).toEqual([960, SHIP_FOOT_Y]);   // the ship's foot stays put
  });
});

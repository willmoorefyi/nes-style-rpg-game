import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';
import { AIRSHIP_LIFT, nativeScale } from '../../../src/scenes/exploration/vehicleLayout.js';
import { FLIGHT_VIEW, SHIP_FOOT_Y, TILT_HOLDOFF_FRAMES, tiltParams, type TiltStart } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { flightField, flightMap, resetStub, stub } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * M7-4 in the field (docs/MODE7_PLAN.md 4.3): the tilt starts from the live camera (centred, or clamped at a map edge),
 * its first frame is t = 0 (the top-down mapping), the hero stays idle and the shadow on its cell through it, no
 * landing marker shows while it plays, and the input hold-off comes once when it ends. Landing tilts back to the same
 * spot, the ship easing down onto its cell.
 */
type Run = Awaited<ReturnType<typeof flightField>>;
const LIFT = AIRSHIP_LIFT * nativeScale(TILE_SIZE);
const world = (f: Run) => f.scene.container.children[0];
const tiltHoldOffs = (f: Run): number => f.game.input.holdOff.mock.calls
  .filter((c: unknown[]) => c[0] === TILT_HOLDOFF_FRAMES && c.length === 1).length;

/** Frames of the tilt from the one that began it: the view, the ship and the report of each. */
async function tilt(f: Run) {
  const seen: Array<{ t: number; theta: number; state: string; cell: unknown; marker: unknown; ship: number[];
    since: number; pos: string }> = [];
  const record = (): void => {
    const r = f.report();
    const l = stub.last!;
    seen.push({ t: r.t as number, theta: l.view.theta, state: r.state as string, cell: r.shadowCell, marker: l.marker,
      ship: [l.ship.x, l.ship.footY], since: l.ship.sinceBoard, pos: `${f.game.playerPosition.x},${f.game.playerPosition.y}` });
  };
  record();
  while (f.report().busy === true) { await f.frame(); if (f.report().busy === true) record(); }
  return seen;
}

describe('M7-4: the tilt in the field', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const cases: Array<[string, { x: number; y: number }, { x: number; y: number }]> = [
    ['centred', { x: 30, y: 30 }, { x: 960, y: 480 }],
    // the camera clamps at the north-west corner: the hero's cell centre (1.5 cells) is where the top-down view drew it
    ['clamped at the north-west corner', { x: 1, y: 1 }, { x: 1.5 * TILE_SIZE, y: 1.5 * TILE_SIZE }],
  ];

  for (const [name, start, anchor] of cases) {
    it(`take-off ${name}: t 0 at the camera's spot, 42 held frames, then the flight view and one hold-off`, async () => {
      const f = await flightField({ mode7: 'on', map: flightMap({ width: 60, height: 60 }), start });
      await f.idle(1);
      await f.confirm();
      const before = tiltHoldOffs(f);
      await f.frame();                                   // the take-off frame: the tilt's first point
      expect(f.report().state).toBe('tiltIn');
      expect(world(f).visible).toBe(false);
      const s = f.report().tiltStart as TiltStart;
      expect(s.anchor).toEqual(anchor);
      // where the world container drew the hero (the camera rounds to whole px): within 0.5 px
      const p = f.scene.container.children[0];
      expect(Math.abs((start.x + 0.5) * TILE_SIZE + p.x - anchor.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs((start.y + 0.5) * TILE_SIZE + p.y - anchor.y)).toBeLessThanOrEqual(0.5);
      const v = stub.last!.view;
      expect({ ...v, px: 0, py: 0 }).toEqual(tiltParams(0, s, TILE_SIZE).view);
      expect([v.px, v.py]).toEqual([start.x + 0.5, start.y + 0.5]);
      // the ship stands where FieldVehicleSprites drew it (its foot on the cell's bottom edge), its shadow there too
      expect(stub.last!.ship.x).toBe(anchor.x);
      expect(stub.last!.ship.footY).toBeCloseTo(anchor.y + TILE_SIZE / 2 - LIFT, 9);
      expect(stub.last!.shadow.x).toBeCloseTo(anchor.x, 9);
      expect(stub.last!.shadow.y).toBeCloseTo(anchor.y + TILE_SIZE / 2, 9);
      expect(stub.last!.shadow.scale).toBeCloseTo(TILE_SIZE, 9);
      const seen = await tilt(f);
      expect(seen).toHaveLength(42);                     // t 0, 1/42 .. 41/42; the 43rd update is the flight view
      seen.forEach((x, i) => {
        expect(x.t).toBeCloseTo(i / 42, 9);
        if (i > 0) expect(x.theta).toBeLessThan(seen[i - 1].theta);
        expect(x.state).toBe('tiltIn');
        expect(x.pos).toBe(`${start.x},${start.y}`);    // the hero stays idle
        expect(x.cell).toEqual(start);                   // the shadow check holds through the tilt
        expect(x.marker).toBeNull();                     // no landing marker while it plays
      });
      expect(f.report().state).toBe('flying');
      expect(tiltHoldOffs(f) - before).toBe(1);
      expect({ ...stub.last!.view, px: 0, py: 0 }).toEqual(FLIGHT_VIEW);
      expect(stub.last!.ship.x).toBe(960);
      expect(stub.last!.ship.footY).toBe(SHIP_FOOT_Y);
      expect(stub.last!.marker).toHaveLength(4);         // the flight: the marker shows over grass
    });
  }

  it('landing tilts back to the camera\'s spot, the ship easing down onto its cell; then the world, one hold-off', async () => {
    const start = { x: 1, y: 1 };
    const f = await flightField({ mode7: 'on', map: flightMap({ width: 60, height: 60 }), start, fieldMode: 'airship',
      vehicles: [] });
    await f.idle(2);
    expect(f.report().state).toBe('flying');             // a load in flight: no tilt
    await f.confirm();                                   // land on grass at (1, 1)
    expect(f.game.fieldMode).toBe('walking');
    const before = tiltHoldOffs(f);
    await f.frame();
    expect(f.report().state).toBe('tiltOut');
    const s = f.report().tiltStart as TiltStart;
    expect(s.anchor).toEqual({ x: 1.5 * TILE_SIZE, y: 1.5 * TILE_SIZE });
    const seen = await tilt(f);
    expect(seen).toHaveLength(42);                       // t 1, 41/42 .. 1/42
    seen.forEach((x, i) => {
      expect(x.t).toBeCloseTo(1 - i / 42, 9);
      expect(x.pos).toBe('1,1');
      expect(x.cell).toEqual(start);
      expect(x.marker).toBeNull();
    });
    expect(seen[0].ship).toEqual([960, SHIP_FOOT_Y]);
    expect(seen[0].since).toBeCloseTo(700, 6);           // full lift until the last 400 ms
    const last = seen[seen.length - 1];
    expect(last.since).toBeCloseTo(700 / 42, 6);
    const e = tiltParams(1 / 42, s, TILE_SIZE).ship;
    expect(last.ship[0]).toBeCloseTo(e.x, 9);
    expect(last.ship[1]).toBeCloseTo(e.y - LIFT, 9);
    expect(Math.abs(last.ship[1] - (s.ship.y - LIFT))).toBeLessThan(1);
    expect(f.report().state).toBe('off');
    expect(world(f).visible).toBe(true);
    expect(stub.visible).toBe(false);
    expect(tiltHoldOffs(f) - before).toBe(1);
    expect(f.report().history).toEqual(['off', 'flying', 'tiltOut', 'off']);
  });
});

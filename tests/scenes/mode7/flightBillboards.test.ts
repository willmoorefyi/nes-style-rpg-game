/**
 * M7-5's billboard sprites (docs/MODE7_PLAN.md 5): `FlightProps` keeps one sprite per field sprite in view (the
 * field's texture, tint and flip, scaled by its row), hides a culled one and drops one whose field sprite is gone;
 * `FlightBillboards` sorts them with the airship and its shadow by depth: nearer than P in front of the ship, farther
 * behind it and its shadow.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';
import { FlightProps } from '../../../src/scenes/exploration/mode7/FlightProps.js';
import { FlightBillboards } from '../../../src/scenes/exploration/mode7/FlightBillboards.js';
import { FLIGHT_VIEW } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { cellToScreen, type ViewParams } from '../../../src/scenes/exploration/mode7/mode7Math.js';
import type { PropSource } from '../../../src/scenes/exploration/mode7/propMath.js';
import { readFileSync } from 'node:fs';
import { TextureSource } from 'pixi.js';
import {
  SIDE_RIGHT, TURN_MS, nextHeading, type AirshipHeading,
} from '../../../src/scenes/exploration/airshipHeading.js';
import { airshipShadow, nativeScale, parseVehicleMeta } from '../../../src/scenes/exploration/vehicleLayout.js';

const RIGHT: AirshipHeading = { ...SIDE_RIGHT, seenDir: 'right', seenMoving: false };
const RAW = JSON.parse(readFileSync('assets/sprites/vehicles.json', 'utf-8')) as unknown;
const META = parseVehicleMeta(RAW);
/** The real sheet json with a fake texture source of the png's size (as fieldVehicleArt.test.ts's rig). */
function sheet(): Texture {
  const b = readFileSync('assets/sprites/vehicles.png');
  return new Texture({ source: new TextureSource({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) }) });
}

const TS = TILE_SIZE;
const view: ViewParams = { ...FLIGHT_VIEW, px: 60.5, py: 60.5 };

function hull(cx: number, cy: number, flip = false): PropSource {
  const s = new Sprite(Texture.WHITE);
  s.label = 'vehicle:ship';
  s.anchor.set(0.5, 1);
  s.scale.set((flip ? -2 : 2) * TS, 1.5 * TS);
  s.tint = 0x8a5a2b;
  s.position.set((cx + 0.5) * TS, (cy + 1) * TS);
  return { sprite: s, gx: cx + 0.5, gy: cy + 1 };
}

describe('M7-5: FlightProps', () => {
  it('draws each source with its texture, tint and flip, scaled by its row; hides the culled, drops the gone', () => {
    const into = new Container();
    const props = new FlightProps(into);
    const near = hull(62, 63, true);
    const far = hull(60, 10);   // 50 cells north: culled
    props.draw(view, [near, far]);
    expect(props.drawn).toBe(1);
    expect(into.children.length).toBe(1);
    const s = into.children[0] as Sprite;
    const g = cellToScreen(view, near.gx, near.gy)!;
    const m = g.scale / TS;
    expect(s.tint).toBe(0x8a5a2b);
    expect(s.scale.x).toBeCloseTo(-2 * TS * m, 6);
    expect(s.scale.y).toBeCloseTo(1.5 * TS * m, 6);
    expect(s.x).toBeCloseTo(g.x, 6);
    expect(s.y).toBeCloseTo(g.y, 6);
    expect(s.zIndex).toBeCloseTo(g.scale, 9);
    // the ship flies on north: the hull falls out of range (hidden, kept), then is boarded (gone: dropped)
    props.draw({ ...view, py: 20.5 }, [near, far]);
    expect(props.drawn).toBe(1);   // now the far one is in range
    expect(s.visible).toBe(false);
    expect(into.children.length).toBe(2);
    props.draw({ ...view, py: 20.5 }, [far]);
    expect(into.children.length).toBe(1);
    expect(s.destroyed).toBe(true);
    props.clear();
    expect(into.children[0].visible).toBe(false);
  });
});

describe('M7-5: FlightBillboards depth order', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a hull south of P draws over the airship, one north of P under its shadow', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});   // no vehicle sheet in node: the placeholder hull
    const b = new FlightBillboards();
    await b.load();
    const behind = hull(60, 55);
    const front = hull(60, 61);
    const shadowAt = cellToScreen(view, view.px, view.py)!;
    b.draw({ view, props: [front, behind], marker: null, shadow: shadowAt,
      ship: { x: 960, footY: 750, heading: RIGHT, tMs: 0, sinceBoard: 1000 } });
    const kids = b.container.children;
    const sorted = [...kids].sort((x, y) => x.zIndex - y.zIndex);
    const ship = sorted.findIndex((c) => c.label === 'vehicle:airship');
    expect(ship).toBeGreaterThanOrEqual(0);
    const props = sorted.map((c, i) => (c.label === 'mode7:prop' ? i : -1)).filter((i) => i >= 0);
    expect(props.length).toBe(2);
    expect(sorted[props[0]].zIndex).toBeLessThan(sorted[ship].zIndex);
    expect(sorted[props[1]].zIndex).toBeGreaterThan(sorted[ship].zIndex);
    // the shadow (a Graphics without a label) sorts between the farther hull and the ship
    const shadow = kids[1];
    expect(shadow.zIndex).toBeGreaterThan(sorted[props[0]].zIndex);
    expect(shadow.zIndex).toBeLessThan(sorted[ship].zIndex);
    b.destroy();
  });
});

describe('AIRSHIP_VIEWS: the flight ship is drawn by its heading', () => {
  const at = (h: AirshipHeading, dir: 'up' | 'down' | 'left' | 'right', t: number) => nextHeading(h, dir, false, t);
  const frameOf = (b: FlightBillboards, heading: AirshipHeading, tMs: number) => {
    const shadow = cellToScreen(view, view.px, view.py)!;
    b.draw({ view, marker: null, shadow, ship: { x: 960, footY: 750, heading, tMs, sinceBoard: 1000 } });
    const ship = b.container.children.find((c) => c.label === 'vehicle:airship') as Sprite;
    return { pick: b.lastPick!, ship };
  };

  it('each heading picks its frame and flip; the sprite shows that frame\'s box and anchor; the shadow follows it', async () => {
    const b = new FlightBillboards(() => Promise.resolve<[unknown, Texture]>([RAW, sheet()]));
    await b.load();
    const k = nativeScale(TS);
    const cases: Array<[AirshipHeading, string, boolean]> = [
      [RIGHT, 'airship', false],
      [at(RIGHT, 'left', 0), 'airship', true],
      [at(RIGHT, 'up', 0), 'airship_back', false],
      [at(at(RIGHT, 'left', 0), 'up', 0), 'airship_back', true],
      [at(RIGHT, 'down', 0), 'airship_front', false],
    ];
    for (const [h, frame, flip] of cases) {
      const { pick, ship } = frameOf(b, h, TURN_MS);
      expect(pick, frame).toMatchObject({ frame, flip, turning: false, end: h.end, side: h.side });
      const f = META.frames[frame];
      expect(ship.texture.frame.x, frame).toBe(f.x);
      expect(ship.anchor.x, frame).toBeCloseTo(f.anchor[0]);
      expect(ship.scale.x < 0, frame).toBe(flip);
      const s = airshipShadow(f.w, 'ridden', h.end);
      const g = b.container.children[1];                           // added after the marker: the shadow
      expect(g.getLocalBounds().width, frame).toBeCloseTo(s.w * k, 0);
    }
    const turning = frameOf(b, at(RIGHT, 'up', 1000), 1000 + TURN_MS / 2).pick;
    expect(turning).toMatchObject({ frame: 'airship_back_turn', turning: true, end: 'back' });
    b.destroy();
  });
});

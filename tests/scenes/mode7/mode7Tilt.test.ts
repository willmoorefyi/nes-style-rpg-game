import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { Camera } from '../../../src/rendering/Camera.js';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';
import { SCENE_ENTRY_HOLDOFF_FRAMES } from '../../../src/core/Game.js';
import { HUD_BOTTOM_BAND } from '../../../src/ui/FieldHUD.js';
import { AIRSHIP_LIFT, nativeScale } from '../../../src/scenes/exploration/vehicleLayout.js';
import { D_SPLIT, cellToScreen, horizonY, nearSplit, rowFits, rowOffMap, rowTable, screenToCell, splitRow,
} from '../../../src/scenes/exploration/mode7/mode7Math.js';
import { NEAR_FULL, nearWindow } from '../../../src/scenes/exploration/mode7/FlightStream.js';
import {
  FLIGHT_VIEW, SHIP_FOOT_Y, TILT_FRAMES, TILT_HOLDOFF_FRAMES, TILT_MS, TiltMachine, ease, tiltParams,
  type TiltStart,
} from '../../../src/scenes/exploration/mode7/mode7Tilt.js';

/**
 * M7-4: the take-off and landing tilt (docs/MODE7_PLAN.md 4.3, 9). The states run in order, `busy` only while a tilt
 * plays, a tilt is 42 frames of dt 1 (21 of dt 2); `tiltParams` eases the view from the top-down camera's mapping
 * (t = 0, matched corner by corner against a real `Camera`, centred and clamped at the 4 edges) to the flight view.
 */
describe('M7-4: TiltMachine', () => {
  it('a tilt is 42 frames (700 ms at 60 Hz); the end hold-off is the scene-entry hold-off', () => {
    expect(TILT_FRAMES).toBe(42);
    expect(TILT_MS).toBeCloseTo(700);
    expect(TILT_HOLDOFF_FRAMES).toBe(SCENE_ENTRY_HOLDOFF_FRAMES);
  });

  it('a tilt is exactly 42 frames of dt 1 and 21 of dt 2, busy only while tilting; t runs 0 -> 1 and back', () => {
    for (const dt of [1, 2]) {
      const m = new TiltMachine();
      m.start('takeoff', true, true);
      expect(m.t).toBe(0);
      let n = 0;
      let last = -1;
      while (m.state === 'tiltIn') {
        expect(m.busy).toBe(true);
        expect(m.drawn).toBe(true);
        expect(m.t).toBeGreaterThan(last);
        last = m.t;
        m.tick(dt, true, true);
        n++;
      }
      expect(n).toBe(42 / dt);
      expect(m.state).toBe('flying');
      expect(m.t).toBe(1);
      expect(m.busy).toBe(false);
      m.tick(dt, true, true);
      expect(m.state).toBe('flying');
      m.land();
      expect(m.t).toBe(1);
      n = 0;
      while (m.state === 'tiltOut') { expect(m.busy).toBe(true); m.tick(dt, true, true); n++; }
      expect(n).toBe(42 / dt);
      expect(m.t).toBe(0);
      expect(m.busy).toBe(false);
      expect(m.history).toEqual(['off', 'tiltIn', 'flying', 'tiltOut', 'off']);
    }
  });

  it('a ticker\'s dt that sums to 42 only up to rounding (1000/60 ms steps) still ends the tilt on frame 42', () => {
    // as Pixi derives it: deltaMS / (1000 / 60) from a clock advanced by 1000 / 60 each frame
    let clock = 10000.3;
    const dts: number[] = [];
    for (let i = 0; i < 84; i++) { const next = clock + 1000 / 60; dts.push((next - clock) / (1000 / 60)); clock = next; }
    expect(dts.reduce((a, b) => a + b, 0)).not.toBe(84);
    const m = new TiltMachine();
    m.start('takeoff', true, true);
    let n = 0;
    while (m.state === 'tiltIn') m.tick(dts[n++], true, true);
    expect(n).toBe(42);
    m.land();
    n = 0;
    while (m.state === 'tiltOut') m.tick(dts[42 + n++], true, true);
    expect(n).toBe(42);
  });

  it('an instant switch (0 frames, M7-2) still enters every state', () => {
    const m = new TiltMachine(0);
    m.start('takeoff', true, true);
    expect(m.state).toBe('flying');
    m.land();
    expect(m.history).toEqual(['off', 'tiltIn', 'flying', 'tiltOut', 'off']);
  });

  it('a take-off while not ready waits in loading (takeoff, not busy), then tilts in on the first idle frame', () => {
    const m = new TiltMachine();
    m.start('takeoff', false, true);
    expect(m.state).toBe('loading');
    expect(m.reason).toBe('takeoff');
    expect(m.busy).toBe(false);
    expect(m.drawn).toBe(false);
    m.tick(1, false, true);
    m.tick(1, true, false);           // ready mid-step: no tilt yet
    expect(m.state).toBe('loading');
    m.tick(1, true, true);            // the first idle frame: the tilt begins at t 0
    expect(m.state).toBe('tiltIn');
    expect(m.t).toBe(0);
    expect(m.busy).toBe(true);
    for (let i = 0; i < 42; i++) m.tick(1, true, false);
    expect(m.state).toBe('flying');
    expect(m.history).toEqual(['off', 'loading', 'tiltIn', 'flying']);
  });

  it('a load or retry in flight while not ready: loading (restore), then flying at once, even mid-step, no tiltIn', () => {
    const m = new TiltMachine();
    m.start('restore', false, true);
    expect(m.reason).toBe('restore');
    m.tick(1, true, false);
    expect(m.state).toBe('flying');
    expect(m.reason).toBeNull();
    expect(m.busy).toBe(false);
    expect(m.history).toEqual(['off', 'loading', 'flying']);
  });

  it('a load or retry while ready goes straight to flying, never busy', () => {
    const m = new TiltMachine();
    m.start('restore', true, false);
    expect(m.busy).toBe(false);
    expect(m.history).toEqual(['off', 'flying']);
  });

  it('a landing in loading goes to off; a map change goes to off with no tilt, also mid-tilt', () => {
    const a = new TiltMachine();
    a.start('takeoff', false);
    a.land();
    expect(a.history).toEqual(['off', 'loading', 'off']);
    const b = new TiltMachine();
    b.start('restore', true);
    b.end();
    expect(b.history).toEqual(['off', 'flying', 'off']);
    b.end();
    expect(b.history).toEqual(['off', 'flying', 'off']);
    const c = new TiltMachine();
    c.start('takeoff', true, true);
    c.tick(1, true, true);
    c.end();
    expect(c.busy).toBe(false);
    expect(c.history).toEqual(['off', 'tiltIn', 'off']);
  });

  it('a take-off with the hero mid-step while ready waits for the idle frame (no tilt over a moving hero)', () => {
    const m = new TiltMachine();
    m.start('takeoff', true, false);
    expect(m.state).toBe('loading');
    m.tick(1, true, true);
    expect(m.state).toBe('tiltIn');
    expect(m.history).toEqual(['off', 'loading', 'tiltIn']);
  });
});

describe('M7-4: tiltParams', () => {
  const start: TiltStart = { anchor: { x: 960, y: 480 }, ship: { x: 960, y: 528 } };

  it('eases in and out: 0, 1/2 and 1 at the ends and the middle, symmetric, monotone', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    for (let i = 0; i < 42; i++) {
      const t = i / 42;
      expect(ease(t + 1 / 42)).toBeGreaterThan(ease(t));
      expect(ease(t) + ease(1 - t)).toBeCloseTo(1);
    }
  });

  it('t = 0 is the top-down camera: theta 90 deg, kappa 0, h = f / tileSize, back 0, the anchor and the ship foot', () => {
    for (const ts of [48, 96]) {
      const p = tiltParams(0, start, ts);
      expect(p.view.theta).toBe(Math.PI / 2);
      expect(p.view.kappa).toBe(0);
      expect(p.view.h).toBe(1200 / ts);
      expect(p.view.f).toBe(1200);
      expect(p.view.back).toBe(0);
      expect([p.view.cx, p.view.cy]).toEqual([960, 480]);
      expect(p.ship).toEqual({ x: 960, y: 528 });
      expect(p.shadowSouth).toBe(0.5);
    }
    expect(tiltParams(0, start, 96).view.h).toBe(12.5);
    expect(tiltParams(0, start, 48).view.h).toBe(25);
  });

  it('t = 1 is the flight view (preset A), the ship at (960, 750) once lifted, the shadow on P', () => {
    for (const ts of [48, 96]) {
      const p = tiltParams(1, start, ts);
      expect(p.view).toEqual(FLIGHT_VIEW);
      expect(p.view.theta).toBeCloseTo((18 * Math.PI) / 180);
      expect(p.view.kappa).toBeCloseTo(1 / 600);
      expect(p.view.h).toBe(6);
      expect(p.view.cx).toBe(960);
      expect(Math.abs(p.view.cy - 600)).toBeLessThan(1);
      expect(p.view.back).toBeCloseTo(11.3, 1);
      expect(p.ship).toEqual({ x: 960, y: SHIP_FOOT_Y + AIRSHIP_LIFT * nativeScale(ts) });
      expect(p.shadowSouth).toBe(0);
    }
  });

  it('through every frame of the tilt the ship\'s cell is on screen and the shadow check round-trips to it', () => {
    let prevHorizon = -Infinity;
    for (let i = 0; i <= 42; i++) {
      const v = { ...tiltParams(i / 42, start, 96).view, px: 50.5, py: 60.5 };
      const at = cellToScreen(v, v.px, v.py);
      expect(at).not.toBeNull();
      expect(at!.x).toBeCloseTo(960);
      expect(at!.y).toBeGreaterThanOrEqual(480 - 1e-9);
      expect(at!.y).toBeLessThanOrEqual(821);
      const back = screenToCell(v, at!.x, at!.y)!;
      expect([Math.floor(back.x), Math.floor(back.y)]).toEqual([50, 60]);
      // the horizon only comes down the screen (the fog follows it), from -Infinity to row 390
      const hy = horizonY(v);
      expect(hy).toBeGreaterThanOrEqual(prevHorizon);
      prevHorizon = hy;
    }
    expect(horizonY(tiltParams(0, start, 96).view)).toBe(-Infinity);
    expect(Math.ceil(horizonY(FLIGHT_VIEW))).toBe(rowTable(FLIGHT_VIEW).firstRow);
    expect(rowTable(FLIGHT_VIEW).firstRow).toBe(390);
  });
});

describe('M7-4: the t = 0 match against a real Camera', () => {
  const MAP = 192;

  /** Every cell corner in view of the camera centred (or clamped) on the hero at cell (gx, gy): its top-down screen
   *  point and the tilt's t = 0 projection, at `ts` px per cell. Returns the largest difference, px. */
  function worst(ts: number, gx: number, gy: number): { err: number; drawnErr: number; corners: number;
    anchor: { x: number; y: number } } {
    const world = new Container();
    const cam = new Camera(world);
    cam.setMapBounds((MAP * ts) / TILE_SIZE, (MAP * ts) / TILE_SIZE);   // the camera's map px at `ts` per cell
    cam.setViewInsets({ bottom: HUD_BOTTOM_BAND });
    const hero = { x: (gx + 0.5) * ts, y: (gy + 0.5) * ts };   // the hero's position: its cell centre
    cam.follow(hero);
    cam.update();
    const anchor = cam.worldToScreen(hero.x, hero.y);
    const start: TiltStart = { anchor, ship: { x: anchor.x, y: anchor.y + ts / 2 } };
    const view = { ...tiltParams(0, start, ts).view, px: hero.x / ts, py: hero.y / ts };
    let err = 0;
    let drawnErr = 0;
    let corners = 0;
    for (let j = 0; j <= MAP; j++) {
      for (let i = 0; i <= MAP; i++) {
        const top = cam.worldToScreen(i * ts, j * ts);
        if (top.x < 0 || top.x > 1920 || top.y < 0 || top.y > 1080) continue;
        const m7 = cellToScreen(view, i, j);
        expect(m7).not.toBeNull();
        err = Math.max(err, Math.abs(m7!.x - top.x), Math.abs(m7!.y - top.y));
        // where the world container really draws it (the camera rounds its offset to whole px)
        drawnErr = Math.max(drawnErr, Math.abs(m7!.x - (i * ts + world.x)), Math.abs(m7!.y - (j * ts + world.y)));
        expect(m7!.scale).toBeCloseTo(ts, 9);
        corners++;
      }
    }
    return { err, drawnErr, corners, anchor };
  }

  const spots: Array<[string, number, number]> = [
    ['the centre', 96, 96],
    ['the west edge', 2, 96], ['the east edge', 189, 96], ['the north edge', 96, 1], ['the south edge', 96, 190],
    ['the north-west corner', 0, 0], ['the south-east corner', 191, 191],
  ];

  for (const ts of [48, 96]) {
    for (const [name, gx, gy] of spots) {
      it(`at ${ts} px per cell, ${name}: every cell corner in view within 0.5 px of Camera.worldToScreen`, () => {
        const r = worst(ts, gx, gy);
        expect(r.corners).toBeGreaterThan(ts === 96 ? 150 : 700);
        expect(r.err).toBeLessThan(1e-6);       // exact by construction
        expect(r.drawnErr).toBeLessThanOrEqual(0.5);
        const centred = name === 'the centre';
        expect(r.anchor.x === 960 && r.anchor.y === (1080 - HUD_BOTTOM_BAND) / 2).toBe(centred);
      });
    }
  }
});

describe('M7-4: the near detail through a tilt by the clamped edges', () => {
  const world = { width: 192, height: 192, art: { tile: 48, chunk: 16, below: [], above: [] } };
  const map = { w: 192, h: 192 };

  for (const [name, gx, gy] of [['the centre', 96, 96], ['the south edge', 150, 189], ['the west edge', 2, 23],
    ['the south-east corner', 191, 191], ['the north-west corner', 0, 0]] as Array<[string, number, number]>) {
    it(`${name}: at every frame the near mesh draws every row nearer than D_SPLIT (none held back)`, () => {
      const world0 = new Container();
      const cam = new Camera(world0);
      cam.setMapBounds((192 * 96) / TILE_SIZE, (192 * 96) / TILE_SIZE);
      cam.setViewInsets({ bottom: HUD_BOTTOM_BAND });
      const hero = { x: (gx + 0.5) * 96, y: (gy + 0.5) * 96 };
      cam.follow(hero);
      cam.update();
      const anchor = cam.worldToScreen(hero.x, hero.y);
      for (let i = 0; i <= 42; i++) {
        const v = { ...tiltParams(i / 42, { anchor, ship: anchor }, 96).view, px: gx + 0.5, py: gy + 0.5 };
        const table = rowTable(v);
        const w = nearWindow(world, NEAR_FULL, v.px, v.py);
        expect(nearSplit(v, table, D_SPLIT, w.x0, w.y0, w.cells, 1080, 1920, map)).toBe(splitRow(v, D_SPLIT));
        // without the map the rows south of it (under the HUD band) held the whole near mesh back
        if (i === 0 && gy >= 189) expect(nearSplit(v, table, D_SPLIT, w.x0, w.y0, w.cells)).toBe(1080);
        if (i === 0) {
          // at t 0 every row is the near mesh's, except those wholly off the map (the far atlas's): the HUD band's
          let off = 0;
          for (let r = 0; r < 1080; r++) {
            if (rowOffMap(v, table, r, map)) off++;
            else expect(rowFits(v, table, r, w.x0, w.y0, w.cells, 1920, map)).toBe(true);
          }
          expect(off).toBe(gy >= 189 ? HUD_BOTTOM_BAND : 0);
        }
      }
      expect(splitRow({ ...tiltParams(0, { anchor, ship: anchor }, 96).view, px: gx + 0.5, py: gy + 0.5 }, D_SPLIT))
        .toBe(0);
    });
  }
});

// WR (docs/WORLD_WRAP_PLAN.md 7.5): on a wrapped map the camera never clamps, so the tilt starts centred, and t = 0
// matches the top-down camera across each seam and at the corner (the cells past a seam at their unwrapped images)
describe('WR: the t = 0 match at the seams of a wrapped world', () => {
  const W = 256;
  const ts = 96;
  for (const [name, px, py] of [['the east seam', 255.5, 100.5], ['the west seam', 0.5, 100.5],
    ['the south seam', 100.5, 255.5], ['the corner', 0.5, 0.5]] as Array<[string, number, number]>) {
    it(`${name}: centred, every cell corner in view exact, and the near mesh holds no row back`, () => {
      const world = new Container();
      const cam = new Camera(world);
      cam.setMapBounds((W * ts) / TILE_SIZE, (W * ts) / TILE_SIZE, true);
      cam.setViewInsets({ bottom: HUD_BOTTOM_BAND });
      const hero = { x: px * ts, y: py * ts };
      cam.follow(hero);
      cam.update();
      const anchor = cam.worldToScreen(hero.x, hero.y);
      expect(anchor).toEqual({ x: 960, y: (1080 - HUD_BOTTOM_BAND) / 2 });
      const view = { ...tiltParams(0, { anchor, ship: { x: anchor.x, y: anchor.y + ts / 2 } }, ts).view, px, py };
      let corners = 0;
      for (let j = Math.floor(py) - 8; j <= Math.floor(py) + 8; j++) {
        for (let i = Math.floor(px) - 12; i <= Math.floor(px) + 12; i++) {
          const top = cam.worldToScreen(i * ts, j * ts);
          if (top.x < 0 || top.x > 1920 || top.y < 0 || top.y > 1080) continue;
          const m7 = cellToScreen(view, i, j)!;
          expect(Math.abs(m7.x - top.x) + Math.abs(m7.y - top.y)).toBeLessThan(1e-6);
          corners++;
        }
      }
      expect(corners).toBeGreaterThan(150);
      const map = { width: W, height: W, wrap: true, art: { tile: 48, chunk: 16, below: [], above: [] } };
      for (let i = 0; i <= 42; i += 6) {
        const v = { ...tiltParams(i / 42, { anchor, ship: anchor }, ts).view, px, py };
        const w = nearWindow(map, NEAR_FULL, px, py);
        expect(nearSplit(v, rowTable(v), D_SPLIT, w.ix0, w.iy0, w.cells, 1080, 1920, { w: W, h: W, wrap: true }))
          .toBe(splitRow(v, D_SPLIT));
      }
    });
  }
});

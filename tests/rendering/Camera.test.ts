import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { Camera, TILE_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '../../src/rendering/Camera.js';

describe('Camera', () => {
  let container: Container;
  let camera: Camera;

  beforeEach(() => {
    container = new Container();
    camera = new Camera(container);
    camera.setMapBounds(50, 30); // 2400x1440 map
  });

  it('initializes at origin', () => {
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  it('sets position and updates container transform', () => {
    camera.setPosition(50, 30);
    expect(camera.x).toBe(50);
    expect(camera.y).toBe(30);
    expect(container.x).toBe(-50);
    expect(container.y).toBe(-30);
  });

  it('clamps position to map bounds', () => {
    camera.setPosition(-10, -10);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);

    // Map is 2400x1440, viewport is 1920x1080, max scroll is 480x360
    camera.setPosition(500, 400);
    expect(camera.x).toBe(480);
    expect(camera.y).toBe(360);
  });

  it('follows target and centers it', () => {
    const target = { x: 1200, y: 720 };
    camera.follow(target);
    camera.update();

    // Target at center means camera at target - viewport/2
    // 1200 - 960 = 240, 720 - 540 = 180
    expect(camera.x).toBe(240);
    expect(camera.y).toBe(180);
  });

  it('clamps when following target near edge', () => {
    const target = { x: 50, y: 50 };
    camera.follow(target);
    camera.update();

    // Would be negative, clamps to 0
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  it('stops following when stopFollowing called', () => {
    const target = { x: 1200, y: 720 };
    camera.follow(target);
    camera.update();
    const prevX = camera.x;

    camera.stopFollowing();
    target.x = 1400;
    camera.update();

    expect(camera.x).toBe(prevX);
  });

  it('converts world to screen coordinates', () => {
    camera.setPosition(50, 30);
    const screen = camera.worldToScreen(100, 80);
    expect(screen.x).toBe(50);
    expect(screen.y).toBe(50);
  });

  it('converts screen to world coordinates', () => {
    camera.setPosition(50, 30);
    const world = camera.screenToWorld(50, 50);
    expect(world.x).toBe(100);
    expect(world.y).toBe(80);
  });

  it('calculates visible tile bounds', () => {
    camera.setPosition(96, 48);
    const bounds = camera.getVisibleTileBounds();

    expect(bounds.startX).toBe(2);  // floor(96/48)
    expect(bounds.startY).toBe(1);  // floor(48/48)
    expect(bounds.endX).toBe(42);   // ceil((96+1920)/48)
    expect(bounds.endY).toBe(24);   // ceil((48+1080)/48) = ceil(1128/48) = ceil(23.5)
  });

  it('applies smooth scrolling when enabled', () => {
    camera.smooth = true;
    camera.smoothSpeed = 0.5;
    const target = { x: 1200, y: 720 };
    camera.follow(target);

    camera.update();
    // Target camera pos is (240, 180), smooth moves halfway from 0
    expect(camera.x).toBe(120);
    expect(camera.y).toBe(90);

    camera.update();
    expect(camera.x).toBe(180);
    expect(camera.y).toBe(135);
  });
});

describe('Camera on maps smaller than the viewport (IN-2)', () => {
  it('centres a 10x8 room on both axes', () => {
    const container = new Container();
    const camera = new Camera(container);
    camera.setMapBounds(10, 8);
    camera.follow({ x: 5 * TILE_SIZE, y: 4 * TILE_SIZE });
    camera.update();
    expect(container.x).toBe((VIEWPORT_WIDTH - 10 * TILE_SIZE) / 2);
    expect(container.y).toBe((VIEWPORT_HEIGHT - 8 * TILE_SIZE) / 2);
    // the room stays centred wherever the hero walks inside it
    camera.follow({ x: 0, y: 0 });
    camera.update();
    expect(container.x).toBe((VIEWPORT_WIDTH - 10 * TILE_SIZE) / 2);
    camera.setPosition(9999, 9999);
    expect(container.y).toBe((VIEWPORT_HEIGHT - 8 * TILE_SIZE) / 2);
  });

  it('centres the 16x13 tower on each axis that is smaller than the viewport', () => {
    const container = new Container();
    const camera = new Camera(container);
    camera.setMapBounds(16, 13);
    camera.follow({ x: 8 * TILE_SIZE, y: 12 * TILE_SIZE });
    camera.update();
    const w = 16 * TILE_SIZE;
    const h = 13 * TILE_SIZE;
    const followY = Math.max(0, Math.min(12 * TILE_SIZE - VIEWPORT_HEIGHT / 2, h - VIEWPORT_HEIGHT));
    // (+ 0 folds -0 into 0) at 48 px tiles both axes are short; at 96 px only the width is
    expect(container.x + 0).toBe(w < VIEWPORT_WIDTH ? (VIEWPORT_WIDTH - w) / 2 : 0);
    expect(container.y + 0).toBe(h < VIEWPORT_HEIGHT ? (VIEWPORT_HEIGHT - h) / 2 : -followY);
  });

  it('centres only the short axis of a wide, low map', () => {
    const container = new Container();
    const camera = new Camera(container);
    const wide = Math.ceil(VIEWPORT_WIDTH / TILE_SIZE) + 10;
    camera.setMapBounds(wide, 4);
    camera.follow({ x: wide * TILE_SIZE, y: 0 });
    camera.update();
    expect(camera.x).toBe(wide * TILE_SIZE - VIEWPORT_WIDTH);   // scrolls and clamps as before
    expect(container.y).toBe((VIEWPORT_HEIGHT - 4 * TILE_SIZE) / 2);
  });
});

describe('M12: setViewInsets keeps rooms above the bottom HUD band', () => {
  const BAND = 120;
  const usable = VIEWPORT_HEIGHT - BAND;
  /** Rows that nearly fill the screen but not the band above the HUD (22 at 48 px tiles, 11 at 96 px). */
  const rows = Math.floor(VIEWPORT_HEIGHT / TILE_SIZE);

  it('the bottom row of a tall room ends above the band when the hero stands on it', () => {
    const camera = new Camera(new Container());
    camera.setMapBounds(12, rows);
    camera.setViewInsets({ bottom: BAND });
    camera.follow({ x: 6 * TILE_SIZE + TILE_SIZE / 2, y: (rows - 1) * TILE_SIZE + TILE_SIZE / 2 });
    camera.update();
    expect(camera.worldToScreen(0, rows * TILE_SIZE).y).toBeLessThanOrEqual(usable);
    expect(camera.worldToScreen(0, 0).y).toBeLessThanOrEqual(0);   // the top is clamped, no gap above
  });

  it('a room shorter than the band is centred inside it', () => {
    const camera = new Camera(new Container());
    camera.setMapBounds(12, 5);
    camera.setViewInsets({ bottom: BAND });
    camera.follow({ x: 0, y: 0 });
    camera.update();
    const top = camera.worldToScreen(0, 0).y;
    const bottom = camera.worldToScreen(0, 5 * TILE_SIZE).y;
    expect((top + bottom) / 2).toBeCloseTo(usable / 2);
  });

  it('without insets the full view is used (default)', () => {
    const camera = new Camera(new Container());
    camera.setMapBounds(12, 5);
    camera.follow({ x: 0, y: 0 });
    camera.update();
    const top = camera.worldToScreen(0, 0).y;
    expect(top).toBeCloseTo((VIEWPORT_HEIGHT - 5 * TILE_SIZE) / 2);
  });
});

// WR (docs/WORLD_WRAP_PLAN.md 4): a wrapped map never clamps; the smooth camera rebases by whole periods
describe('Camera on a wrapped map', () => {
  it('never clamps and reports the period; flat clamps are unchanged', () => {
    const camera = new Camera(new Container());
    camera.setMapBounds(50, 30, true);
    camera.setPosition(-500, -400);
    expect([camera.x, camera.y]).toEqual([-500, -400]);
    expect(camera.period).toEqual({ x: 50 * TILE_SIZE, y: 30 * TILE_SIZE });
    camera.setMapBounds(50, 30);
    camera.setPosition(-500, -400);
    expect([camera.x, camera.y]).toEqual([0, 0]);
    expect(camera.period).toEqual({ x: 0, y: 0 });
  });

  it('a target that jumps by a period moves the smooth camera by the period, not across the map', () => {
    const camera = new Camera(new Container());
    camera.setMapBounds(50, 30, true);
    camera.smooth = true;
    const target = { x: 49.5 * TILE_SIZE, y: 10 * TILE_SIZE };
    camera.follow(target);
    for (let i = 0; i < 200; i++) camera.update();
    const before = camera.x;
    target.x += TILE_SIZE - 50 * TILE_SIZE;   // a step east across the seam, normalised
    camera.update();
    expect(camera.x - (before - 50 * TILE_SIZE)).toBeGreaterThan(0);
    expect(camera.x - (before - 50 * TILE_SIZE)).toBeLessThan(TILE_SIZE);
    expect(camera.x + VIEWPORT_WIDTH / 2).toBeLessThan(target.x);
  });
});

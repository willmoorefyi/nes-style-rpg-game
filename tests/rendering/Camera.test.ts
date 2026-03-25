import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { Camera } from '../../src/rendering/Camera.js';

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

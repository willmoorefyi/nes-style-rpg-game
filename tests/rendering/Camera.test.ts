import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { Camera } from '../../src/rendering/Camera.js';

describe('Camera', () => {
  let container: Container;
  let camera: Camera;

  beforeEach(() => {
    container = new Container();
    camera = new Camera(container);
    camera.setMapBounds(20, 20); // 320x320 map
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

    // Map is 320x320, viewport is 256x240, max scroll is 64x80
    camera.setPosition(100, 100);
    expect(camera.x).toBe(64);
    expect(camera.y).toBe(80);
  });

  it('follows target and centers it', () => {
    const target = { x: 160, y: 160 };
    camera.follow(target);
    camera.update();

    // Target at center means camera at target - viewport/2
    // 160 - 128 = 32, 160 - 120 = 40
    expect(camera.x).toBe(32);
    expect(camera.y).toBe(40);
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
    const target = { x: 160, y: 160 };
    camera.follow(target);
    camera.update();
    const prevX = camera.x;

    camera.stopFollowing();
    target.x = 200;
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
    camera.setPosition(32, 16);
    const bounds = camera.getVisibleTileBounds();

    expect(bounds.startX).toBe(2);
    expect(bounds.startY).toBe(1);
    expect(bounds.endX).toBe(18); // ceil((32+256)/16)
    expect(bounds.endY).toBe(16); // ceil((16+240)/16)
  });

  it('applies smooth scrolling when enabled', () => {
    camera.smooth = true;
    camera.smoothSpeed = 0.5;
    const target = { x: 160, y: 160 };
    camera.follow(target);

    camera.update();
    // Should move halfway toward target position (32, 40)
    expect(camera.x).toBe(16);
    expect(camera.y).toBe(20);

    camera.update();
    expect(camera.x).toBe(24);
    expect(camera.y).toBe(30);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Texture } from 'pixi.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { MapData } from '../../src/types/index.js';

function createMapData(width: number, height: number, blocked: number[] = []): MapData {
  const collision = Array(width * height).fill(0);
  for (const idx of blocked) collision[idx] = 1;
  return {
    id: 'test',
    width,
    height,
    layers: [collision.map(() => 1)],
    tilesets: ['test.png'],
    collision,
    npcs: [],
    transitions: [],
  };
}

describe('PlayerController', () => {
  let input: InputManager;
  let events: EventBus;
  let collisionMap: CollisionMap;
  let player: PlayerController;

  beforeEach(() => {
    input = new InputManager();
    events = new EventBus();
    collisionMap = new CollisionMap(createMapData(8, 8));
    player = new PlayerController({
      startX: 3,
      startY: 3,
      texture: Texture.WHITE,
      collisionMap,
      input,
      events,
      moveSpeed: 100,
    });
  });

  it('starts at specified position', () => {
    expect(player.gridX).toBe(3);
    expect(player.gridY).toBe(3);
  });

  it('changes facing direction on input', () => {
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'up');
    player.update(1);
    expect(player.direction).toBe('up');
  });

  it('moves when direction is walkable', () => {
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'right');
    player.update(1);
    expect(player.isMoving).toBe(true);
  });

  it('does not move into blocked tile', () => {
    const blockedMap = new CollisionMap(createMapData(8, 8, [3 * 8 + 4])); // block (4,3)
    const p = new PlayerController({
      startX: 3,
      startY: 3,
      texture: Texture.WHITE,
      collisionMap: blockedMap,
      input,
      events,
    });
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'right');
    p.update(1);
    expect(p.isMoving).toBe(false);
    expect(p.direction).toBe('right');
  });

  it('emits playerMove event on move complete', () => {
    const handler = vi.fn();
    events.on('playerMove', handler);
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'down');
    player.update(1); // start moving
    vi.spyOn(input, 'isPressed').mockReturnValue(false);
    // Complete the move
    for (let i = 0; i < 20; i++) player.update(1);
    expect(handler).toHaveBeenCalled();
  });

  it('interpolates position during movement', () => {
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'down');
    player.update(1);
    const initialY = player.y;
    player.update(1);
    expect(player.y).toBeGreaterThan(initialY);
  });

  it('blocks movement into NPC positions', () => {
    player.setNPCPositions([{ x: 4, y: 3 }]);
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'right');
    player.update(1);
    expect(player.isMoving).toBe(false);
  });

  it('returns correct facing tile', () => {
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'left');
    player.update(1);
    vi.spyOn(input, 'isPressed').mockReturnValue(false);
    for (let i = 0; i < 20; i++) player.update(1);
    expect(player.facingTile).toEqual({ x: 1, y: 3 });
  });
});

describe('PlayerController - two-tile character art', () => {
  it('lifts a tall frame so the feet stay on the tile and sorts by the feet', () => {
    const player = new PlayerController({
      startX: 2,
      startY: 4,
      texture: { source: { width: 288, height: 480 }, width: 288, height: 480 } as unknown as Texture,
      animation: { frameWidth: 48, frameHeight: 96, frameCount: 3, walkSequence: [1, 0, 2, 0] },
      collisionMap: new CollisionMap(createMapData(8, 8)),
      input: new InputManager(),
      events: new EventBus(),
    });
    expect(player.animation.sprite.y).toBe(4 * 48 - 48);
    expect(player.animation.sprite.zIndex).toBe(4 * 48 - 48 + 96);
    // Camera follow target stays centred on the tile, not on the taller sprite
    expect(player.y).toBe(4 * 48 + 24);
    expect(player.x).toBe(2 * 48 + 24);
  });
});

describe('PlayerController - display scale', () => {
  it('scales the sprite and keeps the feet on the tile', () => {
    const player = new PlayerController({
      startX: 2, startY: 4,
      texture: { source: { width: 288, height: 480 }, width: 288, height: 480 } as unknown as Texture,
      animation: { frameWidth: 48, frameHeight: 96, frameCount: 3 },
      displayScale: 2,
      collisionMap: new CollisionMap(createMapData(8, 8)),
      input: new InputManager(),
      events: new EventBus(),
    });
    expect(player.animation.sprite.scale.x).toBe(2);
    expect(player.animation.sprite.y).toBe(4 * 48 + 48 - 192);
    expect(player.y).toBe(4 * 48 + 24);
  });
});

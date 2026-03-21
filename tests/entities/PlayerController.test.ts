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

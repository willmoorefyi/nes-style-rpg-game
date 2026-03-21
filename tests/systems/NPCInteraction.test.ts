import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Texture } from 'pixi.js';
import { NPCInteractionSystem } from '../../src/systems/NPCInteraction.js';
import { NPC } from '../../src/entities/NPC.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { MapData } from '../../src/types/index.js';

function createMapData(): MapData {
  return {
    id: 'test',
    width: 8,
    height: 8,
    layers: [Array(64).fill(1)],
    tilesets: ['test.png'],
    collision: Array(64).fill(0),
    npcs: [],
    transitions: [],
  };
}

describe('NPCInteractionSystem', () => {
  let system: NPCInteractionSystem;
  let input: InputManager;
  let player: PlayerController;
  let npc: NPC;

  beforeEach(() => {
    system = new NPCInteractionSystem();
    input = new InputManager();
    const events = new EventBus();
    const collisionMap = new CollisionMap(createMapData());
    player = new PlayerController({
      startX: 3,
      startY: 3,
      texture: Texture.WHITE,
      collisionMap,
      input,
      events,
    });
    npc = new NPC(
      { id: 'npc1', x: 3, y: 2, sprite: 'npc.png', dialog: ['Hello!'] },
      Texture.WHITE
    );
    player.setNPCPositions([{ x: npc.tileX, y: npc.tileY }]);
    system.setPlayer(player);
    system.setInput(input);
    system.setNPCs([npc]);
  });

  it('returns NPC at position', () => {
    expect(system.getNPCAt(3, 2)).toBe(npc);
    expect(system.getNPCAt(0, 0)).toBeNull();
  });

  it('returns null when not pressing confirm', () => {
    vi.spyOn(input, 'isJustPressed').mockReturnValue(false);
    expect(system.checkInteraction()).toBeNull();
  });

  it('returns null when player is moving', () => {
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'down');
    player.update(1); // start moving down (away from NPC)
    vi.spyOn(input, 'isJustPressed').mockImplementation((a) => a === 'confirm');
    expect(system.checkInteraction()).toBeNull();
  });

  it('returns NPC when facing and pressing confirm', () => {
    // Face up (toward NPC at 3,2)
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'up');
    player.update(0.01); // just change direction, minimal progress
    vi.spyOn(input, 'isPressed').mockReturnValue(false);
    // Complete any movement
    for (let i = 0; i < 30; i++) player.update(1);
    vi.spyOn(input, 'isJustPressed').mockImplementation((a) => a === 'confirm');
    expect(system.checkInteraction()).toBe(npc);
  });

  it('returns null when not facing NPC', () => {
    // Face down (away from NPC)
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'down');
    player.update(0.01);
    vi.spyOn(input, 'isPressed').mockReturnValue(false);
    for (let i = 0; i < 30; i++) player.update(1);
    vi.spyOn(input, 'isJustPressed').mockImplementation((a) => a === 'confirm');
    expect(system.checkInteraction()).toBeNull();
  });
});

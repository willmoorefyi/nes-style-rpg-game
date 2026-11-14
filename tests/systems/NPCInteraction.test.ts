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

describe('NPCInteractionSystem across a counter', () => {
  it('talks to the NPC behind a counter tile the player faces', async () => {
    const { NPCInteractionSystem } = await import('../../src/systems/NPCInteraction.js');
    const sys = new NPCInteractionSystem();
    const keeper = { tileX: 4, tileY: 3 } as unknown as import('../../src/entities/NPC.js').NPC;
    sys.setNPCs([keeper]);
    sys.setPlayer({ isMoving: false, gridX: 4, gridY: 5, facingTile: { x: 4, y: 4 } } as unknown as import('../../src/entities/PlayerController.js').PlayerController);
    sys.setInput({ isJustPressed: () => true } as unknown as import('../../src/core/InputManager.js').InputManager);
    expect(sys.checkInteraction()).toBeNull();                 // no counter: nothing within reach
    sys.setCounterCheck((x, y) => x === 4 && y === 4);
    expect(sys.checkInteraction()).toBe(keeper);               // counter between them: talk across it
  });
});

describe('NPCInteractionSystem inspect cells (T3e)', () => {
  type Npc = import('../../src/entities/NPC.js').NPC;
  type Player = import('../../src/entities/PlayerController.js').PlayerController;
  type Input = import('../../src/core/InputManager.js').InputManager;
  const tomb = (x: number, y: number) => (x === 4 && y === 4 ? ['Here lies Erdrick.'] : null);
  const make = (facing: { x: number; y: number }, npcs: Npc[] = [], confirm = true) => {
    const sys = new NPCInteractionSystem();
    sys.setNPCs(npcs);
    sys.setPlayer({ isMoving: false, gridX: 4, gridY: 5, facingTile: facing } as unknown as Player);
    sys.setInput({ isJustPressed: (a: string) => confirm && a === 'confirm' } as unknown as Input);
    sys.setInspectCheck(tomb);
    return sys;
  };

  it('facing an inspect cell and pressing confirm gives its lines', () => {
    expect(make({ x: 4, y: 4 }).interact()).toEqual({ kind: 'inspect', lines: ['Here lies Erdrick.'] });
  });

  it('facing away, or not pressing confirm, does nothing', () => {
    expect(make({ x: 4, y: 6 }).interact()).toBeNull();
    expect(make({ x: 4, y: 4 }, [], false).interact()).toBeNull();
  });

  it('an NPC on the same cell wins, and checkInteraction never returns inspect text', () => {
    const npc = { tileX: 4, tileY: 4 } as unknown as Npc;
    expect(make({ x: 4, y: 4 }, [npc]).interact()).toEqual({ kind: 'npc', npc });
    expect(make({ x: 4, y: 4 }).checkInteraction()).toBeNull();
  });

  it('an NPC across a counter wins over an inspect cell on the counter', () => {
    const keeper = { tileX: 4, tileY: 3 } as unknown as Npc;
    const sys = make({ x: 4, y: 4 }, [keeper]);
    sys.setCounterCheck((x, y) => x === 4 && y === 4);
    expect(sys.interact()).toEqual({ kind: 'npc', npc: keeper });
    sys.setNPCs([]);
    expect(sys.interact()).toEqual({ kind: 'inspect', lines: ['Here lies Erdrick.'] });
  });
});

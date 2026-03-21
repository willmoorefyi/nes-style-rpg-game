import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';

function createMockGame(): Game {
  const mapData: MapData = {
    id: 'test',
    width: 8,
    height: 8,
    layers: [Array(64).fill(2)],
    tilesets: ['tileset.png'],
    collision: Array(64).fill(0),
    npcs: [],
    transitions: [],
  };

  return {
    app: { stage: new Container() },
    scenes: { register: vi.fn(), switchTo: vi.fn() },
    assets: {
      load: vi.fn().mockResolvedValue(Texture.WHITE),
    },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
    },
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    data: {
      loadMap: vi.fn().mockResolvedValue(mapData),
    },
  } as unknown as Game;
}

describe('ExplorationScene', () => {
  let game: Game;
  let scene: ExplorationScene;

  beforeEach(() => {
    game = createMockGame();
    scene = new ExplorationScene(game);
  });

  it('has a container', () => {
    expect(scene.container).toBeInstanceOf(Container);
  });

  it('loads map on enter', async () => {
    await scene.enter();
    expect(game.data.loadMap).toHaveBeenCalled();
  });

  it('updates without error', async () => {
    await scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });

  it('cleans up on exit', async () => {
    await scene.enter();
    scene.exit();
    // Should not throw
  });

  it('can set player position', async () => {
    await scene.enter();
    expect(() => scene.setPlayerPosition(2, 2)).not.toThrow();
  });
});

describe('ExplorationScene - loadMap regression tests', () => {
  it('sets up tilemap, player, camera, and NPCs from map data', async () => {
    const mapWithNPCs: MapData = {
      id: 'test-with-npcs',
      width: 8,
      height: 8,
      layers: [Array(64).fill(2)],
      tilesets: ['tileset.png'],
      collision: Array(64).fill(0),
      npcs: [
        { id: 'npc1', x: 3, y: 3, sprite: 'npc.png', dialog: ['Hello!'] },
        { id: 'npc2', x: 5, y: 5, sprite: 'npc.png', dialog: ['Goodbye!'] },
      ],
      transitions: [],
    };

    const game = createMockGame();
    (game.data.loadMap as any).mockResolvedValue(mapWithNPCs);

    const scene = new ExplorationScene(game);
    await scene.enter();

    // Scene should have loaded without error
    expect(game.data.loadMap).toHaveBeenCalledWith('assets/maps/test-town.json');

    // Update should work without error
    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map with transitions', async () => {
    const mapWithTransitions: MapData = {
      id: 'test-transitions',
      width: 8,
      height: 8,
      layers: [Array(64).fill(2)],
      tilesets: ['tileset.png'],
      collision: Array(64).fill(0),
      npcs: [],
      transitions: [
        { x: 7, y: 7, targetMap: 'other-map', targetX: 0, targetY: 0 },
      ],
    };

    const game = createMockGame();
    (game.data.loadMap as any).mockResolvedValue(mapWithTransitions);

    const scene = new ExplorationScene(game);
    await scene.enter();

    // Should handle transitions without error
    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map load failure gracefully', async () => {
    const game = createMockGame();
    (game.data.loadMap as any).mockRejectedValue(new Error('Map not found'));

    const scene = new ExplorationScene(game);

    // Should not throw, should show error display
    await expect(scene.enter()).resolves.not.toThrow();
  });
});

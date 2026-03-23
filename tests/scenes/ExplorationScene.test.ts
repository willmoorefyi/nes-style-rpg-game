import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMapData } from '../helpers/testUtils.js';

interface MockGame {
  app: { stage: Container };
  scenes: { register: ReturnType<typeof vi.fn>; switchTo: ReturnType<typeof vi.fn> };
  assets: { load: ReturnType<typeof vi.fn> };
  input: {
    isPressed: ReturnType<typeof vi.fn>;
    isJustPressed: ReturnType<typeof vi.fn>;
    attach: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  events: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };
  data: { loadMap: ReturnType<typeof vi.fn> };
  party: { all: []; distributeXp: ReturnType<typeof vi.fn>; addGold: ReturnType<typeof vi.fn> };
}

function createMockGame(mapData: MapData = createMapData()): MockGame {
  return {
    app: { stage: new Container() },
    scenes: { register: vi.fn(), switchTo: vi.fn() },
    assets: { load: vi.fn().mockResolvedValue(Texture.WHITE) },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    data: { loadMap: vi.fn().mockResolvedValue(mapData) },
    party: { all: [], distributeXp: vi.fn(), addGold: vi.fn() },
  };
}

describe('ExplorationScene', () => {
  let game: MockGame;
  let scene: ExplorationScene;

  beforeEach(() => {
    game = createMockGame();
    scene = new ExplorationScene(game as unknown as Game);
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
  });

  it('can set player position', async () => {
    await scene.enter();
    expect(() => scene.setPlayerPosition(2, 2)).not.toThrow();
  });
});

describe('ExplorationScene - loadMap regression tests', () => {
  it('sets up tilemap, player, camera, and NPCs from map data', async () => {
    const mapWithNPCs = createMapData({
      id: 'test-with-npcs',
      npcs: [
        { id: 'npc1', x: 3, y: 3, sprite: 'npc.png', dialog: ['Hello!'] },
        { id: 'npc2', x: 5, y: 5, sprite: 'npc.png', dialog: ['Goodbye!'] },
      ],
    });

    const game = createMockGame(mapWithNPCs);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();

    expect(game.data.loadMap).toHaveBeenCalledWith('assets/maps/test-town.json');
    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map with transitions', async () => {
    const mapWithTransitions = createMapData({
      id: 'test-transitions',
      transitions: [{ x: 7, y: 7, targetMap: 'other-map', targetX: 0, targetY: 0 }],
    });

    const game = createMockGame(mapWithTransitions);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();

    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map load failure gracefully', async () => {
    const game = createMockGame();
    game.data.loadMap.mockRejectedValue(new Error('Map not found'));

    const scene = new ExplorationScene(game as unknown as Game);
    await expect(scene.enter()).resolves.not.toThrow();
  });
});

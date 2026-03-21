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

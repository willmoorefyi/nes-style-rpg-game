import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData, type MockGame } from '../helpers/testUtils.js';

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

    expect(game.data.loadMap).toHaveBeenCalledWith('assets/maps/cornelia.yaml');
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

describe('ExplorationScene - tile redraw while scrolling', () => {
  it('draws the tiles around the player after the camera moves away from the map origin', async () => {
    const big = createMapData({ id: 'big', width: 120, height: 80 });
    const game = createMockGame(big);
    (game as unknown as { currentMapId: string }).currentMapId = 'big';
    (game as unknown as { playerPosition: { x: number; y: number } }).playerPosition = { x: 100, y: 70 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const input = game.input as unknown as { isJustPressed: { mockImplementation(f: (a: string) => boolean): void } };
    input.isJustPressed.mockImplementation((a: string) => a === 'confirm');   // dismiss the controls hint
    scene.update(16);
    input.isJustPressed.mockImplementation(() => false);
    scene.update(16);

    const xs: number[] = [];
    const walk = (c: Container) => {
      for (const child of c.children) {
        if (child.visible && child.constructor.name === 'Sprite') xs.push(child.x);
        if ('children' in child) walk(child as Container);
      }
    };
    walk(scene.container);
    // a screenful of tiles near the player (x ~ 100 tiles in) must be drawn, not only the first screen at the origin
    expect(xs.filter((x) => x > 90 * 48).length).toBeGreaterThan(20);
  });
});

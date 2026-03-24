import { describe, it, expect, beforeEach } from 'vitest';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame } from '../helpers/testUtils.js';
import type { MockGame } from '../helpers/testUtils.js';

describe('ExplorationScene - C5 Battle flash', () => {
  let game: MockGame;
  let scene: ExplorationScene;

  beforeEach(() => {
    game = createMockGame();
    scene = new ExplorationScene(game as unknown as Game);
  });

  it('constructs without error with battle flash support', () => {
    expect(scene).toBeDefined();
    expect(scene.container).toBeDefined();
  });

  it('loads and updates without error', async () => {
    await scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });
});

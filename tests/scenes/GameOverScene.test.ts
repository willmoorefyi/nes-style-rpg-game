import { describe, it, expect, vi } from 'vitest';
import { GameOverScene } from '../../src/scenes/GameOverScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockAudio } from '../helpers/testUtils.js';

function createMockGameForGameOver() {
  return {
    scenes: { switchTo: vi.fn() },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
    },
    audio: createMockAudio(),
  };
}

describe('GameOverScene', () => {
  it('switches to title on confirm press instead of reloading', () => {
    const game = createMockGameForGameOver();
    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();

    // Simulate pressing confirm (Enter/Z/Space)
    game.input.isJustPressed.mockImplementation((action: string) => action === 'confirm');
    scene.update(1);

    expect(game.scenes.switchTo).toHaveBeenCalledWith('title');
  });

  it('does not switch scene when no key pressed', () => {
    const game = createMockGameForGameOver();
    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();
    scene.update(1);
    expect(game.scenes.switchTo).not.toHaveBeenCalled();
  });
});

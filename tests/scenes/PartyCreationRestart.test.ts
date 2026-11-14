import { describe, it, expect, vi } from 'vitest';
import { Graphics, type Container } from 'pixi.js';
import { PartyCreationScene } from '../../src/scenes/PartyCreationScene.js';
import type { Game } from '../../src/core/Game.js';

describe('PartyCreationScene restart (NG-2)', () => {
  it('a second New Game in one session is not covered by the black overlay the opening left behind', () => {
    const game = {
      input: { isJustPressed: vi.fn(() => false), isPressed: vi.fn(() => false) },
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      scenes: { switchTo: vi.fn() },
    };
    const scene = new PartyCreationScene(game as unknown as Game);
    scene.enter();
    // the opening's layer is kept on top: backdrop, then the full-screen fade Graphics, then the dialog box
    const layer = () => scene.container.children[scene.container.children.length - 1] as Container;
    const overlay = () => layer().children[1] as Graphics;
    overlay().alpha = 1;            // the opening sequence ends on black
    scene.exit();
    scene.enter();                  // Game Over > Title > New Game
    expect(overlay()).toBeInstanceOf(Graphics);
    expect(overlay().alpha).toBe(0);
  });
});

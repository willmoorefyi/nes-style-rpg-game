import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

export class GameOverScene implements Scene {
  readonly container = new Container();
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.game.audio.playMusic('gameover', false);
    
    const win = new Window({ x: (GAME_WIDTH - 600) / 2, y: (GAME_HEIGHT - 400) / 2, width: 600, height: 400 });
    this.container.addChild(win);

    const text = new BitmapText({ text: 'GAME OVER', style: { fontFamily: NES_FONT, fontSize: 48, fill: 0xffffff } });
    text.anchor.set(0.5);
    text.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    this.container.addChild(text);

    const hint = new BitmapText({ text: 'Press START', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xaaaaaa } });
    hint.anchor.set(0.5);
    hint.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    this.container.addChild(hint);
  }

  update(_dt: number): void {
    if (this.game.input.isJustPressed('confirm')) {
      this.game.scenes.switchTo('title');
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}

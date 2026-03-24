import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { WIDTH, HEIGHT } from '../core/Game.js';
import { NES_FONT } from '../ui/NESFont.js';

export class GameOverScene implements Scene {
  readonly container = new Container();
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.game.audio.playMusic('gameover', false);
    
    const win = new Window({ x: 64, y: 80, width: 128, height: 80 });
    this.container.addChild(win);

    const text = new BitmapText({ text: 'GAME OVER', style: { fontFamily: NES_FONT, fontSize: 16, fill: 0xffffff } });
    text.anchor.set(0.5);
    text.position.set(WIDTH / 2, HEIGHT / 2 - 10);
    this.container.addChild(text);

    const hint = new BitmapText({ text: 'Press START', style: { fontFamily: NES_FONT, fontSize: 8, fill: 0xaaaaaa } });
    hint.anchor.set(0.5);
    hint.position.set(WIDTH / 2, HEIGHT / 2 + 20);
    this.container.addChild(hint);
  }

  update(_dt: number): void {
    if (this.game.input.isJustPressed('start')) {
      this.game.scenes.switchTo('title');
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}
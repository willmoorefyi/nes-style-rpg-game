import { Container, Text, TextStyle } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { WIDTH, HEIGHT } from '../core/Game.js';

export class GameOverScene implements Scene {
  readonly container = new Container();
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    const win = new Window({ x: 64, y: 80, width: 128, height: 80 });
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
    const text = new Text({ text: 'GAME OVER', style });
    text.anchor.set(0.5);
    text.position.set(WIDTH / 2, HEIGHT / 2 - 10);
    this.container.addChild(text);

    const hint = new Text({ text: 'Press START', style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xaaaaaa }) });
    hint.anchor.set(0.5);
    hint.position.set(WIDTH / 2, HEIGHT / 2 + 20);
    this.container.addChild(hint);
  }

  update(_dt: number): void {
    if (this.game.input.isJustPressed('start')) {
      window.location.reload();
    }
  }

  exit(): void {
    this.container.removeChildren();
  }
}

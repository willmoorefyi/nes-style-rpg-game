import { Container, Text, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT } from '../core/Game.js';

export class ErrorDisplay {
  readonly container = new Container();
  private bg: Graphics;
  private text: Text;

  constructor() {
    this.bg = new Graphics();
    this.text = new Text({ text: '', style: { fill: 0xff4444, fontSize: 12, wordWrap: true, wordWrapWidth: WIDTH - 20 } });
    this.text.x = 10;
    this.text.y = HEIGHT / 2 - 20;
    this.container.addChild(this.bg, this.text);
    this.container.visible = false;
  }

  show(message: string): void {
    this.text.text = message;
    this.bg.clear().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x000000, alpha: 0.8 });
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }
}

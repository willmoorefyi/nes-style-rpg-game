import { Container, Text, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE_LG } from '../core/LayoutConstants.js';

export class ErrorDisplay {
  readonly container = new Container();
  private bg: Graphics;
  private text: Text;

  constructor() {
    this.bg = new Graphics();
    this.text = new Text({ text: '', style: { fill: 0xff4444, fontSize: FONT_SIZE_LG, wordWrap: true, wordWrapWidth: GAME_WIDTH - 60 } });
    this.text.x = 30;
    this.text.y = GAME_HEIGHT / 2 - 60;
    this.container.addChild(this.bg, this.text);
    this.container.visible = false;
  }

  show(message: string): void {
    this.text.text = message;
    this.bg.clear().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.8 });
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }
}

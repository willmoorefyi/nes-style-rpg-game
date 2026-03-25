import { Container, Graphics, BitmapText } from 'pixi.js';
import { NES_FONT } from './NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

const STORAGE_KEY = 'ff1_controlsSeen';
const AUTO_DISMISS_MS = 5000;
const FRAME_RATE = 60;

export class ControlsHint {
  readonly container = new Container();
  private timer: number;
  private dismissed = false;

  constructor() {
    this.timer = AUTO_DISMISS_MS / (1000 / FRAME_RATE);

    if (ControlsHint.hasBeenSeen()) {
      this.dismissed = true;
      this.container.visible = false;
      return;
    }

    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.7 });
    this.container.addChild(bg);

    const lines = [
      'Arrow Keys: Move',
      'Z / Enter: Confirm',
      'X / Esc: Cancel / Menu',
    ];
    lines.forEach((line, i) => {
      const text = new BitmapText({
        text: line,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
      });
      text.anchor.set(0.5, 0);
      text.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60 + i * 48);
      this.container.addChild(text);
    });
  }

  update(input: { isJustPressed(action: string): boolean }): void {
    if (this.dismissed) return;

    this.timer -= 1;
    const anyKey = input.isJustPressed('confirm') ||
      input.isJustPressed('cancel') ||
      input.isJustPressed('start') ||
      input.isJustPressed('up') ||
      input.isJustPressed('down') ||
      input.isJustPressed('left') ||
      input.isJustPressed('right');

    if (anyKey || this.timer <= 0) {
      this.dismiss();
    }
  }

  private dismiss(): void {
    this.dismissed = true;
    this.container.visible = false;
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
  }

  get isDismissed(): boolean {
    return this.dismissed;
  }

  static hasBeenSeen(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  }
}

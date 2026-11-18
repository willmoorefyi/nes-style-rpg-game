import { Container } from 'pixi.js';
import { OutlinedText } from '../../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, FONT_SIZE_LG } from '../../core/LayoutConstants.js';
import type { InputManager } from '../../core/InputManager.js';

/** The ending card (GAP-13, PLAY-3 P3-06): lines centred on the black the cutscene faded to; confirm closes it. */
export class EndCard {
  readonly container = new Container();
  private waiting: (() => void) | null = null;

  constructor() {
    this.container.visible = false;
  }

  /** True while the card is up and waiting for confirm. */
  get active(): boolean { return this.waiting !== null; }

  /**
   * Show `text` (lines split on \n; the last line is the large title) over whatever black the scene holds, and
   * resolve once confirm is pressed.
   */
  show(text: string): Promise<void> {
    this.container.removeChildren();
    const lines = text.split('\n');
    const lh = FONT_SIZE_LG + 24;
    let y = Math.round(GAME_HEIGHT / 2 - (lines.length * lh) / 2);
    lines.forEach((line, i) => {
      const last = i === lines.length - 1;
      const t = new OutlinedText({ text: line, fontSize: last ? FONT_SIZE_LG : FONT_SIZE, fill: last ? 0xffffff : 0xc8c8d8 });
      t.position.set(Math.round((GAME_WIDTH - t.main.width) / 2), y);
      this.container.addChild(t);
      y += last ? lh : lh - 8;
    });
    this.container.visible = true;
    return new Promise<void>((resolve) => { this.waiting = resolve; });
  }

  /** Confirm ends the card. */
  update(input: InputManager): void {
    if (this.waiting && input.isJustPressed('confirm')) {
      const done = this.waiting;
      this.waiting = null;
      this.container.visible = false;
      done();
    }
  }
}

import { Window } from './Window.js';
import { TextRenderer } from './TextRenderer.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../core/LayoutConstants.js';

/** The help bar's rectangle: the bottom of the screen (y 900, height 156) in every menu that shows one. */
export const HELP_RECT = { x: SCREEN_MARGIN, y: 900, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 156 } as const;

/**
 * A one-line description bar (MS-7): what the highlighted item or spell does. Item, Equip, Magic and both shops
 * put it at `HELP_RECT`.
 */
export class HelpWindow extends Window {
  private readonly line: TextRenderer;

  constructor(rect: { x: number; y: number; width: number; height: number } = HELP_RECT) {
    super({ ...rect });
    this.line = new TextRenderer({ width: this.contentWidth });
    this.line.position.set(this.contentX, this.contentY);
    this.addChild(this.line);
  }

  /** Show `text` at once ('' clears the bar). */
  setText(text: string): void {
    this.line.setText(text, true);
  }

  /** The text shown now. */
  get text(): string {
    return this.line.text;
  }
}

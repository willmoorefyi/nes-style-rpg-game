import { BitmapText, Container } from 'pixi.js';
import { wrapText } from './textUtils.js';
import { Window } from './Window.js';
import { TextRenderer } from './TextRenderer.js';
import { NES_FONT } from './NESFont.js';
import type { InputManager } from '../core/InputManager.js';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_WIDTH, WINDOW_PADDING, FONT_SIZE } from '../core/LayoutConstants.js';

/** Frames the "more" marker stays on, then off (I2). */
const MORE_BLINK_FRAMES = 30;

export interface DialogBoxConfig {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  linesPerPage?: number;
  revealSpeed?: number;
  onComplete?: () => void;
}

export class DialogBox extends Container {
  private window: Window;
  private textRenderer: TextRenderer;
  private pages: string[] = [];
  private pageIndex = 0;
  private linesPerPage: number;
  private onComplete?: () => void;
  /** Another text follows this one (the dialog manager has more lines or a queued dialog). */
  private more = false;
  /** Blinking ▼ at the bottom right while a revealed page has another page or text after it. */
  private moreMarker: BitmapText;
  private blinkFrames = 0;

  constructor(config: DialogBoxConfig = {}) {
    super();
    const x = config.x ?? WINDOW_PADDING;
    const y = config.y ?? (GAME_HEIGHT - 168);
    const width = config.width ?? (GAME_WIDTH - WINDOW_PADDING * 2);
    const height = config.height ?? 144;
    this.linesPerPage = config.linesPerPage ?? 4;
    this.onComplete = config.onComplete;

    this.window = new Window({ x: 0, y: 0, width, height });
    this.addChild(this.window);
    this.position.set(x, y);

    this.textRenderer = new TextRenderer({
      width: this.window.contentWidth,
      revealSpeed: config.revealSpeed ?? 1,
    });
    this.textRenderer.position.set(this.window.contentX, this.window.contentY);
    this.addChild(this.textRenderer);

    this.moreMarker = new BitmapText({ text: '▼', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.moreMarker.position.set(
      this.window.contentX + this.window.contentWidth - FONT_SIZE,
      this.window.contentY + this.window.contentHeight - FONT_SIZE,
    );
    this.moreMarker.visible = false;
    this.addChild(this.moreMarker);
  }

  /** Show `text`; `more` marks that another text follows it (the ▼ shows on its last page too). */
  show(text: string, more = false): void {
    this.visible = true;
    this.more = more;
    this.pages = this.paginate(text);
    this.pageIndex = 0;
    this.showCurrentPage();
  }

  /** Another text now follows the one showing (a dialog was queued behind it). */
  setMore(more: boolean): void {
    this.more = more;
  }

  /** Confirm or cancel: finish the reveal, then turn the page, then close (I2). */
  update(dt: number, input: InputManager): void {
    this.textRenderer.update(dt);
    if (input.isJustPressed('confirm') || input.isJustPressed('cancel')) {
      if (!this.textRenderer.isComplete()) {
        this.textRenderer.complete();
      } else if (this.pageIndex < this.pages.length - 1) {
        this.pageIndex++;
        this.showCurrentPage();
      } else {
        this.visible = false;
        this.moreMarker.visible = false;
        this.onComplete?.();
        return;
      }
    }
    this.updateMoreMarker();
  }

  private showCurrentPage(): void {
    this.textRenderer.setText(this.pages[this.pageIndex]);
    this.blinkFrames = 0;
    this.updateMoreMarker();
  }

  private updateMoreMarker(): void {
    const follows = this.pageIndex < this.pages.length - 1 || this.more;
    const shown = follows && this.textRenderer.isComplete();
    if (!shown) {
      this.moreMarker.visible = false;
      return;
    }
    this.moreMarker.visible = Math.floor(this.blinkFrames / MORE_BLINK_FRAMES) % 2 === 0;
    this.blinkFrames++;
  }

  private paginate(text: string): string[] {
    const maxChars = Math.floor(this.window.contentWidth / CHAR_WIDTH);
    const wrapped = wrapText(text, maxChars);
    const lines = wrapped.split('\n');
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += this.linesPerPage) {
      pages.push(lines.slice(i, i + this.linesPerPage).join('\n'));
    }
    return pages.length ? pages : [''];
  }

  get isVisible(): boolean { return this.visible; }
  get currentPage(): number { return this.pageIndex; }
  get totalPages(): number { return this.pages.length; }
  /** The ▼ "more" marker is lit this frame. */
  get moreShown(): boolean { return this.moreMarker.visible; }
}

import { Container } from 'pixi.js';
import { wrapText } from './textUtils.js';
import { Window } from './Window.js';
import { TextRenderer } from './TextRenderer.js';
import type { InputManager } from '../core/InputManager.js';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_WIDTH, WINDOW_PADDING } from '../core/LayoutConstants.js';

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
  }

  show(text: string): void {
    this.visible = true;
    this.pages = this.paginate(text);
    this.pageIndex = 0;
    this.showCurrentPage();
  }

  update(dt: number, input: InputManager): void {
    this.textRenderer.update(dt);
    if (input.isJustPressed('confirm')) {
      if (!this.textRenderer.isComplete()) {
        this.textRenderer.complete();
      } else if (this.pageIndex < this.pages.length - 1) {
        this.pageIndex++;
        this.showCurrentPage();
      } else {
        this.visible = false;
        this.onComplete?.();
      }
    }
  }

  private showCurrentPage(): void {
    this.textRenderer.setText(this.pages[this.pageIndex]);
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
}

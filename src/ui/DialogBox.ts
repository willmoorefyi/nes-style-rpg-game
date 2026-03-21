import { Container } from 'pixi.js';
import { Window } from './Window.js';
import { TextRenderer } from './TextRenderer.js';
import type { InputManager } from '../core/InputManager.js';

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
    const x = config.x ?? 8;
    const y = config.y ?? 176;
    const width = config.width ?? 240;
    const height = config.height ?? 56;
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
    const wrapped = this.wrapText(text);
    const lines = wrapped.split('\n');
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += this.linesPerPage) {
      pages.push(lines.slice(i, i + this.linesPerPage).join('\n'));
    }
    return pages.length ? pages : [''];
  }

  private wrapText(text: string): string {
    const maxChars = Math.floor(this.window.contentWidth / 8);
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > maxChars && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines.join('\n');
  }

  get isVisible(): boolean { return this.visible; }
  get currentPage(): number { return this.pageIndex; }
  get totalPages(): number { return this.pages.length; }
}

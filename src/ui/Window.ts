import { Container, Graphics } from 'pixi.js';
import { WINDOW_PADDING, WINDOW_BORDER_OUTER, WINDOW_BORDER_INNER } from '../core/LayoutConstants.js';

export interface WindowConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Window extends Container {
  private bg: Graphics;
  private config: WindowConfig;

  constructor(config: WindowConfig) {
    super();
    this.config = config;
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.position.set(config.x, config.y);
    this.draw();
  }

  private draw(): void {
    const { width, height } = this.config;
    this.bg.clear();
    // White outer border
    this.bg.rect(0, 0, width, height);
    this.bg.fill(0xffffff);
    // Dark inner border
    this.bg.rect(WINDOW_BORDER_OUTER, WINDOW_BORDER_OUTER, width - WINDOW_BORDER_OUTER * 2, height - WINDOW_BORDER_OUTER * 2);
    this.bg.fill(0x000080);
    // Blue background
    this.bg.rect(WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER, WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER, width - (WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER) * 2, height - (WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER) * 2);
    this.bg.fill(0x00008b);
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.draw();
  }

  get contentX(): number { return WINDOW_PADDING; }
  get contentY(): number { return WINDOW_PADDING; }
  get contentWidth(): number { return this.config.width - WINDOW_PADDING * 2; }
  get contentHeight(): number { return this.config.height - WINDOW_PADDING * 2; }
}

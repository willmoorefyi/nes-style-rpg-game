import { Container, Graphics } from 'pixi.js';

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
    this.bg.rect(2, 2, width - 4, height - 4);
    this.bg.fill(0x000080);
    // Blue background
    this.bg.rect(4, 4, width - 8, height - 8);
    this.bg.fill(0x00008b);
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.draw();
  }

  get contentX(): number { return 8; }
  get contentY(): number { return 8; }
  get contentWidth(): number { return this.config.width - 16; }
  get contentHeight(): number { return this.config.height - 16; }
}

import { Container, Text } from 'pixi.js';
import type { Scene } from '../types/index.js';

export class BootScene implements Scene {
  readonly container = new Container();
  private text: Text;

  constructor() {
    this.text = new Text({ text: 'Loading...', style: { fill: 0xffffff, fontSize: 16 } });
    this.text.anchor.set(0.5);
    this.text.position.set(128, 120);
    this.container.addChild(this.text);
  }

  enter(): void {
    // Assets would be loaded here in later phases
  }

  update(_dt: number): void {
    // Animation or progress updates
  }

  exit(): void {
    // Cleanup
  }
}
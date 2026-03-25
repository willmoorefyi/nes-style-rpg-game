import { Container, BitmapText } from 'pixi.js';
import { wrapText } from './textUtils.js';
import { NES_FONT } from './NESFont.js';
import { CHAR_WIDTH, LINE_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

export interface TextRendererConfig {
  width: number;
  lineHeight?: number;
  charWidth?: number;
  revealSpeed?: number; // chars per frame, 0 = instant
  style?: { fill?: number };
}

export class TextRenderer extends Container {
  private config: TextRendererConfig;
  private textObj: BitmapText;
  private fullText = '';
  private revealedCount = 0;
  private revealAccum = 0;

  constructor(config: TextRendererConfig) {
    super();
    this.config = {
      lineHeight: LINE_HEIGHT,
      charWidth: CHAR_WIDTH,
      revealSpeed: 0,
      ...config,
    };
    this.textObj = new BitmapText({
      text: '',
      style: {
        fontFamily: NES_FONT,
        fontSize: FONT_SIZE,
        fill: config.style?.fill ?? 0xffffff,
      },
    });
    this.addChild(this.textObj);
  }

  setText(text: string, instant = false): void {
    const maxChars = Math.floor(this.config.width / this.config.charWidth!);
    this.fullText = wrapText(text, maxChars);
    if (instant || this.config.revealSpeed === 0) {
      this.revealedCount = this.fullText.length;
      this.textObj.text = this.fullText;
    } else {
      this.revealedCount = 0;
      this.revealAccum = 0;
      this.textObj.text = '';
    }
  }

  update(dt: number): void {
    if (this.revealedCount >= this.fullText.length) return;
    const speed = this.config.revealSpeed!;
    if (speed <= 0) return;
    this.revealAccum += speed * dt;
    const chars = Math.floor(this.revealAccum);
    if (chars > 0) {
      this.revealAccum -= chars;
      this.revealedCount = Math.min(this.revealedCount + chars, this.fullText.length);
      this.textObj.text = this.fullText.slice(0, this.revealedCount);
    }
  }

  isComplete(): boolean {
    return this.revealedCount >= this.fullText.length;
  }

  complete(): void {
    this.revealedCount = this.fullText.length;
    this.textObj.text = this.fullText;
  }

  get lineCount(): number {
    return this.fullText.split('\n').length;
  }
}

import { Container } from 'pixi.js';
import { wrapText } from './textUtils.js';
import { OutlinedText } from './NESFont.js';
import { CHAR_WIDTH, LINE_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

export interface TextRendererConfig {
  width: number;
  lineHeight?: number;
  /** Wrap width per character; defaults to the measured CHAR_WIDTH scaled to `fontSize`. */
  charWidth?: number;
  /** Glyph size in px (default FONT_SIZE). */
  fontSize?: number;
  revealSpeed?: number; // chars per frame, 0 = instant
  /** `outline`: a dark edge drawn as offset shadow copies (OutlinedText). */
  style?: { fill?: number; outline?: number };
}

export class TextRenderer extends Container {
  private config: TextRendererConfig;
  private textObj: OutlinedText;
  private fullText = '';
  /** The whole current text (wrapped), whether or not it has finished revealing. */
  get text(): string { return this.fullText; }
  private revealedCount = 0;
  private revealAccum = 0;

  constructor(config: TextRendererConfig) {
    super();
    const fontSize = config.fontSize ?? FONT_SIZE;
    this.config = {
      lineHeight: LINE_HEIGHT,
      charWidth: (CHAR_WIDTH * fontSize) / FONT_SIZE,
      revealSpeed: 0,
      ...config,
      fontSize,
    };
    this.textObj = new OutlinedText({
      fontSize,
      fill: config.style?.fill ?? 0xffffff,
      outline: config.style?.outline,
      // only an explicit line height changes the spacing; the default keeps the font's own
      lineHeight: config.lineHeight,
    });
    this.addChild(this.textObj);
  }

  /** The glyph size in px. */
  get fontSize(): number { return this.config.fontSize!; }
  get lineHeight(): number { return this.config.lineHeight!; }
  /** Characters per wrapped line. */
  get maxChars(): number { return Math.floor(this.config.width / this.config.charWidth!); }

  setText(text: string, instant = false): void {
    this.fullText = wrapText(text, this.maxChars);
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

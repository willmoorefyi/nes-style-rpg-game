import { Container, Text, TextStyle } from 'pixi.js';
import { wrapText } from './textUtils.js';

export interface TextRendererConfig {
  width: number;
  lineHeight?: number;
  charWidth?: number;
  revealSpeed?: number; // chars per frame, 0 = instant
  style?: Partial<TextStyle>;
}

export class TextRenderer extends Container {
  private config: TextRendererConfig;
  private textObj: Text;
  private fullText = '';
  private revealedCount = 0;
  private revealAccum = 0;

  constructor(config: TextRendererConfig) {
    super();
    this.config = {
      lineHeight: 10,
      charWidth: 8,
      revealSpeed: 0,
      ...config,
    };
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 8,
      fill: 0xffffff,
      ...config.style,
    });
    this.textObj = new Text({ text: '', style });
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

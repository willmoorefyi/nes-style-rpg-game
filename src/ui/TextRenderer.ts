import { Container, Text, TextStyle } from 'pixi.js';

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
    this.fullText = this.wrapText(text);
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

  private wrapText(text: string): string {
    const maxChars = Math.floor(this.config.width / this.config.charWidth!);
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

  get lineCount(): number {
    return this.fullText.split('\n').length;
  }
}

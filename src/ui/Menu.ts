import { Container, Text, TextStyle } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';

export interface MenuItem {
  label: string;
  value: string;
  enabled?: boolean;
}

export interface MenuConfig {
  items: MenuItem[];
  x?: number;
  y?: number;
  lineHeight?: number;
  cursor?: string;
  onSelect?: (item: MenuItem, index: number) => void;
  onCancel?: () => void;
}

export class Menu extends Container {
  private items: MenuItem[];
  private cursorIndex = 0;
  private texts: Text[] = [];
  private cursorText: Text;
  private lineHeight: number;
  private cursorChar: string;
  private onSelect?: (item: MenuItem, index: number) => void;
  private onCancel?: () => void;

  constructor(config: MenuConfig) {
    super();
    this.items = config.items;
    this.lineHeight = config.lineHeight ?? 12;
    this.cursorChar = config.cursor ?? '▶';
    this.onSelect = config.onSelect;
    this.onCancel = config.onCancel;
    this.position.set(config.x ?? 0, config.y ?? 0);

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xffffff });
    const disabledStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0x808080 });

    this.cursorText = new Text({ text: this.cursorChar, style });
    this.cursorText.position.set(0, 0);
    this.addChild(this.cursorText);

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const t = new Text({
        text: item.label,
        style: item.enabled === false ? disabledStyle : style,
      });
      t.position.set(12, i * this.lineHeight);
      this.texts.push(t);
      this.addChild(t);
    }
    this.updateCursor();
  }

  update(input: InputManager): void {
    if (input.isJustPressed('up')) {
      this.cursorIndex = (this.cursorIndex - 1 + this.items.length) % this.items.length;
      this.updateCursor();
    } else if (input.isJustPressed('down')) {
      this.cursorIndex = (this.cursorIndex + 1) % this.items.length;
      this.updateCursor();
    } else if (input.isJustPressed('confirm')) {
      const item = this.items[this.cursorIndex];
      if (item.enabled !== false) {
        this.onSelect?.(item, this.cursorIndex);
      }
    } else if (input.isJustPressed('cancel')) {
      this.onCancel?.();
    }
  }

  private updateCursor(): void {
    this.cursorText.position.y = this.cursorIndex * this.lineHeight;
  }

  get selectedIndex(): number { return this.cursorIndex; }
  get selectedItem(): MenuItem { return this.items[this.cursorIndex]; }

  setIndex(index: number): void {
    this.cursorIndex = Math.max(0, Math.min(index, this.items.length - 1));
    this.updateCursor();
  }
}

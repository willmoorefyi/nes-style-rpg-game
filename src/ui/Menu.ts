import { Container, BitmapText } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import { NES_FONT } from './NESFont.js';
import { uiEventBus } from './uiSounds.js';
import { MENU_LINE_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

/** Frames a direction is held before the cursor repeats, and frames between repeats (I2). */
export const REPEAT_DELAY_FRAMES = 20;
export const REPEAT_EVERY_FRAMES = 5;

/** What a menu reads: just-presses, plus held keys for auto-repeat when the input has them (mocks may not). */
export type MenuInput = Pick<InputManager, 'isJustPressed'> & Partial<Pick<InputManager, 'isPressed'>>;

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
  maxVisible?: number;
  /** Start with the cursor here (clamped to the list), e.g. to keep a shop's place after a sale. */
  initialIndex?: number;
  onSelect?: (item: MenuItem, index: number) => void;
  onCancel?: () => void;
  eventBus?: EventBus;
}

export class Menu extends Container {
  private items: MenuItem[];
  private cursorIndex = 0;
  private scrollOffset = 0;
  private texts: BitmapText[] = [];
  private cursorText: BitmapText;
  private lineHeight: number;
  private cursorChar: string;
  private maxVisible: number;
  private upIndicator?: BitmapText;
  private downIndicator?: BitmapText;
  private onSelect?: (item: MenuItem, index: number) => void;
  private onCancel?: () => void;
  private eventBus?: EventBus;
  private active = true;
  /** Frames each direction has been held since its last press (auto-repeat, I2). */
  private holdFrames = { up: 0, down: 0 };

  constructor(config: MenuConfig) {
    super();
    this.items = config.items;
    this.lineHeight = config.lineHeight ?? MENU_LINE_HEIGHT;
    this.cursorChar = config.cursor ?? '▶';
    this.maxVisible = config.maxVisible ?? this.items.length;
    this.onSelect = config.onSelect;
    this.onCancel = config.onCancel;
    this.eventBus = config.eventBus;
    this.position.set(config.x ?? 0, config.y ?? 0);

    this.cursorText = new BitmapText({ text: this.cursorChar, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.cursorText.position.set(0, 0);
    this.addChild(this.cursorText);

    if (this.items.length > this.maxVisible) {
      this.upIndicator = new BitmapText({ text: '▲', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      this.upIndicator.position.set(MENU_LINE_HEIGHT + 40, -this.lineHeight);
      this.upIndicator.visible = false;
      this.addChild(this.upIndicator);

      this.downIndicator = new BitmapText({ text: '▼', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      this.downIndicator.position.set(MENU_LINE_HEIGHT + 40, this.maxVisible * this.lineHeight);
      this.downIndicator.visible = false;
      this.addChild(this.downIndicator);
    }

    if (config.initialIndex !== undefined && this.items.length > 0) {
      this.setIndex(config.initialIndex);
    } else {
      this.renderItems();
    }
  }

  private renderItems(): void {
    for (const t of this.texts) this.removeChild(t);
    this.texts = [];

    const visibleCount = Math.min(this.maxVisible, this.items.length);
    for (let i = 0; i < visibleCount; i++) {
      const itemIndex = this.scrollOffset + i;
      const item = this.items[itemIndex];
      const t = new BitmapText({
        text: item.label,
        style: {
          fontFamily: NES_FONT,
          fontSize: FONT_SIZE,
          fill: item.enabled === false ? 0x808080 : 0xffffff,
        },
      });
      t.position.set(MENU_LINE_HEIGHT, i * this.lineHeight);
      this.texts.push(t);
      this.addChild(t);
    }

    this.updateCursor();
    this.updateIndicators();
  }

  /** An inactive menu (focus moved to another one, E3) draws its cursor grey and ignores input. */
  setActive(active: boolean): void {
    this.active = active;
    this.cursorText.tint = active ? 0xffffff : 0x808080;
  }

  get isActive(): boolean { return this.active; }

  update(input: MenuInput): void {
    if (!this.active) {
      this.holdFrames = { up: 0, down: 0 };
      return;
    }
    if (input.isJustPressed('up')) {
      this.step(-1, true);
    } else if (input.isJustPressed('down')) {
      this.step(1, true);
    } else if (input.isJustPressed('confirm')) {
      const item = this.items[this.cursorIndex];
      if (item.enabled !== false) {
        this.bus?.emit('cursorSelect', {});
        this.onSelect?.(item, this.cursorIndex);
      }
    } else if (input.isJustPressed('cancel')) {
      this.bus?.emit('cursorCancel', {});
      this.onCancel?.();
    } else {
      this.repeatHeld(input);
    }
  }

  /** The menu's own bus, else the shared UI bus (set by Game.init; unset in unit tests) (I3). */
  private get bus(): EventBus | undefined {
    return this.eventBus ?? uiEventBus();
  }

  /** Move one row; a fresh press wraps around the list ends, a held repeat stops at them. */
  private step(delta: number, fresh: boolean): void {
    if (fresh) this.holdFrames = { up: 0, down: 0 };
    const next = this.cursorIndex + delta;
    if (!fresh && (next < 0 || next >= this.items.length)) return;
    this.moveCursor(delta);
    this.bus?.emit('cursorMove', {});
  }

  /** While a direction stays held: a move after REPEAT_DELAY_FRAMES + REPEAT_EVERY_FRAMES, then every REPEAT_EVERY_FRAMES (I2). */
  private repeatHeld(input: MenuInput): void {
    for (const [dir, delta] of [['up', -1], ['down', 1]] as const) {
      if (!input.isPressed?.(dir)) {
        this.holdFrames[dir] = 0;
        continue;
      }
      const held = ++this.holdFrames[dir];
      if (held > REPEAT_DELAY_FRAMES && (held - REPEAT_DELAY_FRAMES) % REPEAT_EVERY_FRAMES === 0) {
        this.step(delta, false);
        return;
      }
    }
  }

  private moveCursor(delta: number): void {
    const newIndex = (this.cursorIndex + delta + this.items.length) % this.items.length;
    const wrapped = (delta === 1 && newIndex === 0) || (delta === -1 && newIndex === this.items.length - 1);
    
    this.cursorIndex = newIndex;

    if (wrapped) {
      this.scrollOffset = delta === 1 ? 0 : Math.max(0, this.items.length - this.maxVisible);
    } else if (this.cursorIndex < this.scrollOffset) {
      this.scrollOffset = this.cursorIndex;
    } else if (this.cursorIndex >= this.scrollOffset + this.maxVisible) {
      this.scrollOffset = this.cursorIndex - this.maxVisible + 1;
    }

    this.renderItems();
  }

  private updateCursor(): void {
    const visualIndex = this.cursorIndex - this.scrollOffset;
    this.cursorText.position.y = visualIndex * this.lineHeight;
  }

  private updateIndicators(): void {
    if (this.upIndicator) this.upIndicator.visible = this.scrollOffset > 0;
    if (this.downIndicator) this.downIndicator.visible = this.scrollOffset + this.maxVisible < this.items.length;
  }

  /** Enable or disable item `index` and redraw it (grey when disabled). */
  setItemEnabled(index: number, enabled: boolean): void {
    const item = this.items[index];
    if (!item) return;
    item.enabled = enabled;
    this.renderItems();
  }

  get selectedIndex(): number { return this.cursorIndex; }
  get selectedItem(): MenuItem { return this.items[this.cursorIndex]; }

  setIndex(index: number): void {
    this.cursorIndex = Math.max(0, Math.min(index, this.items.length - 1));
    if (this.cursorIndex < this.scrollOffset) {
      this.scrollOffset = this.cursorIndex;
    } else if (this.cursorIndex >= this.scrollOffset + this.maxVisible) {
      this.scrollOffset = this.cursorIndex - this.maxVisible + 1;
    }
    this.renderItems();
  }
}

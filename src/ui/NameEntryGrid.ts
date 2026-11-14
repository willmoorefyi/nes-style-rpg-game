import { Container, BitmapText } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import { NES_FONT } from './NESFont.js';
import { uiEventBus } from './uiSounds.js';
import { FONT_SIZE } from '../core/LayoutConstants.js';

export const NAME_MAX_LENGTH = 6;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.- ';
const ALLOWED = new Set(LETTERS);
const COLUMNS = 13;
const CELL_W = 96;
const CELL_H = 56;
const BACK = 'Back';
const END = 'End';
/** Back and End are each drawn three letter cells wide. */
const WIDE_CELLS = 3;

/** Trim, keep only `[A-Za-z0-9 .-]`, cap at 6 characters; an empty name means `fallback`. */
export function normalizeName(raw: string, fallback: string): string {
  const clean = [...raw.trim()].filter((c) => ALLOWED.has(c)).join('').slice(0, NAME_MAX_LENGTH).trim();
  return clean || fallback;
}

/** `base`, or `base2`, `base3`... so two members of one class never share a default name. */
export function uniqueDefaultName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, NAME_MAX_LENGTH - String(n).length)}${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

export interface NameEntryGridConfig {
  /** Pre-filled name; End (where the cursor starts) accepts it. */
  defaultName: string;
  onDone: (name: string) => void;
  /** Cancel (or Back) with an empty name: leave the grid. */
  onExit: () => void;
  eventBus?: EventBus;
  x?: number;
  y?: number;
}

/** FF-style letter grid: A-Z, a-z, 0-9, `.`, `-`, space, then Back / End. */
export class NameEntryGrid extends Container {
  private readonly rows: string[][];
  private row: number;
  private col: number;
  private entered: string;
  /** True until the player edits: the first letter typed replaces the pre-filled default. */
  private pristine = true;
  private readonly config: NameEntryGridConfig;
  private readonly nameText: BitmapText;
  private readonly cursorText: BitmapText;

  constructor(config: NameEntryGridConfig) {
    super();
    this.config = config;
    this.entered = config.defaultName;
    this.position.set(config.x ?? 0, config.y ?? 0);
    const chars = [...LETTERS];
    this.rows = [];
    for (let i = 0; i < chars.length; i += COLUMNS) this.rows.push(chars.slice(i, i + COLUMNS));
    this.rows.push([BACK, END]);
    this.row = this.rows.length - 1;
    this.col = 1;

    this.nameText = this.text('', 0, 0);
    this.rows.forEach((cells, r) => cells.forEach((cell, c) => {
      this.text(cell === ' ' ? 'SP' : cell, 36 + c * (cell.length > 1 ? CELL_W * WIDE_CELLS : CELL_W), 80 + r * CELL_H);
    }));
    this.cursorText = this.text('▶', 0, 0);
    this.redraw();
  }

  /** The name as currently entered (before trimming / defaulting). */
  get value(): string { return this.entered; }
  /** Label of the cell under the cursor (`'A'`, `' '`, `'Back'`, `'End'`). */
  get cursorCell(): string { return this.rows[this.row][this.col]; }

  update(input: InputManager): void {
    if (input.isJustPressed('up')) this.move(-1, 0);
    else if (input.isJustPressed('down')) this.move(1, 0);
    else if (input.isJustPressed('left')) this.move(0, -1);
    else if (input.isJustPressed('right')) this.move(0, 1);
    else if (input.isJustPressed('confirm')) this.press(this.cursorCell);
    else if (input.isJustPressed('cancel')) {
      this.bus?.emit('cursorCancel', {});
      this.backspace();
    }
  }

  /** The config's bus, else the game's UI bus (cursor sounds, I3). */
  private get bus(): EventBus | undefined { return this.config.eventBus ?? uiEventBus(); }

  private move(dRow: number, dCol: number): void {
    const n = this.rows.length;
    const bottom = n - 1;
    if (dRow !== 0) {
      const from = this.row;
      this.row = (this.row + dRow + n) % n;
      // columns map by x between the letter rows and the wide Back / End row (N1): End sits over '3'
      if (from === bottom && this.row !== bottom) this.col = this.col * WIDE_CELLS;
      else if (from !== bottom && this.row === bottom) this.col = this.col < WIDE_CELLS ? 0 : 1;
    }
    const len = this.rows[this.row].length;
    this.col = dCol !== 0 ? (this.col + dCol + len) % len : Math.min(this.col, len - 1);
    this.bus?.emit('cursorMove', {});
    this.redraw();
  }

  private press(cell: string): void {
    this.bus?.emit('cursorSelect', {});
    if (cell === END) {
      this.config.onDone(normalizeName(this.entered, this.config.defaultName));
      return;
    }
    if (cell === BACK) { this.backspace(); return; }
    if (this.pristine) { this.entered = ''; this.pristine = false; }
    if (this.entered.length < NAME_MAX_LENGTH) this.entered += cell;
    this.redraw();
  }

  /** Delete a letter, or leave the grid when the name is already empty. */
  private backspace(): void {
    if (this.entered.length === 0) { this.config.onExit(); return; }
    this.pristine = false;
    this.entered = this.entered.slice(0, -1);
    this.redraw();
  }

  private redraw(): void {
    this.nameText.text = `Name: ${this.entered.padEnd(NAME_MAX_LENGTH, '_')}`;
    const wide = this.row === this.rows.length - 1;
    this.cursorText.position.set(this.col * (wide ? CELL_W * WIDE_CELLS : CELL_W), 80 + this.row * CELL_H);
  }

  private text(label: string, x: number, y: number): BitmapText {
    const t = new BitmapText({ text: label, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    t.position.set(x, y);
    this.addChild(t);
    return t;
  }
}

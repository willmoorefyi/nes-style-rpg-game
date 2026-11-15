/**
 * The bestiary's stats window (docs/BESTIARY_PLAN.md 3.3): the model's lines in two text columns of 28 characters; a
 * full-width line (no right part) is drawn by the left column alone.
 */
import { BitmapText, Container } from 'pixi.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { CHAR_WIDTH, FONT_SIZE, LINE_HEIGHT } from '../../core/LayoutConstants.js';
import { COLUMN_CHARS, type StatLine } from './bestiaryModel.js';

/** The stats window (screen px). 872 wide: two 28-character columns (56 x ~14.5 px) fit inside the padding. */
export const STATS_RECT = { x: 1024, y: 300, width: 872, height: 576 } as const;

export class BestiaryStatsPanel {
  readonly window = new Window({ ...STATS_RECT });
  private readonly left: BitmapText;
  private readonly right: BitmapText;

  constructor(parent: Container) {
    const text = (): BitmapText => new BitmapText({ text: '',
      style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff, lineHeight: LINE_HEIGHT } });
    this.left = text();
    this.right = text();
    this.left.position.set(this.window.contentX, this.window.contentY);
    this.right.position.set(this.window.contentX + COLUMN_CHARS * CHAR_WIDTH, this.window.contentY);
    this.window.addChild(this.left, this.right);
    parent.addChild(this.window);
  }

  setLines(lines: readonly StatLine[]): void {
    this.left.text = lines.map((l) => l.left).join('\n');
    this.right.text = lines.map((l) => l.right ?? '').join('\n');
  }

  /** The lines shown now, each as "left|right" (tests). */
  get shown(): string[] {
    const r = this.right.text.split('\n');
    return this.left.text.split('\n').map((l, i) => (r[i] ? `${l}|${r[i]}` : l));
  }

  /** One message instead of the stats (no bestiary data). */
  setMessage(text: string): void {
    this.left.text = text;
    this.right.text = '';
  }
}

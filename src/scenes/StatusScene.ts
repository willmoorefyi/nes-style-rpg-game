import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import {
  STATUS_FOOTER, baseLines, battleLines, equipmentLines, headerLine, spellLines,
} from './status/statusLines.js';
import { SCREEN_MARGIN } from '../core/LayoutConstants.js';

export { spellLines } from './status/statusLines.js';

/** A window's rectangle on screen (for layout tests). */
export interface StatusRect { x: number; y: number; width: number; height: number }

const FULL = 1920 - 2 * SCREEN_MARGIN;
const COLUMN_Y = 136;
const COLUMN_H = 480;
/** The screen's windows (E8): header, three columns (base stats, battle numbers, equipment), spells, footer. */
export const STATUS_RECTS = {
  header: { x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: FULL, height: 96 },
  base: { x: SCREEN_MARGIN, y: COLUMN_Y, width: 560, height: COLUMN_H },
  battle: { x: 600, y: COLUMN_Y, width: 600, height: COLUMN_H },
  equipment: { x: 1216, y: COLUMN_Y, width: 1896 - 1216, height: COLUMN_H },
  spells: { x: SCREEN_MARGIN, y: 632, width: FULL, height: 312 },
  footer: { x: SCREEN_MARGIN, y: 960, width: FULL, height: 96 },
} as const satisfies Record<string, StatusRect>;

type Part = keyof typeof STATUS_RECTS;

export class StatusScene implements Scene {
  readonly container = new Container();
  private readonly texts = {} as Record<Part, TextRenderer>;
  private memberIndex = 0;

  constructor(private readonly game: Game) {
    for (const part of Object.keys(STATUS_RECTS) as Part[]) {
      const win = new Window({ ...STATUS_RECTS[part] });
      const text = new TextRenderer({ width: win.contentWidth });
      text.position.set(win.contentX, win.contentY);
      win.addChild(text);
      this.texts[part] = text;
      this.container.addChild(win);
    }
    this.texts.footer.setText(STATUS_FOOTER, true);
  }

  /** Each window's text, for tests. */
  get sections(): Record<Part, string> {
    const out = {} as Record<Part, string>;
    for (const part of Object.keys(this.texts) as Part[]) out[part] = this.texts[part].text;
    return out;
  }

  enter(): void {
    this.memberIndex = 0;
    this.render();
  }

  update(_dt: number): void {
    const input = this.game.input;
    const party = this.game.party;
    if (input.isJustPressed('left')) {
      this.memberIndex = (this.memberIndex - 1 + party.size) % party.size;
      this.render();
    } else if (input.isJustPressed('right')) {
      this.memberIndex = (this.memberIndex + 1) % party.size;
      this.render();
    } else if (input.isJustPressed('cancel')) {
      this.game.scenes.pop();
    }
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}

  private render(): void {
    const char = this.game.party.get(this.memberIndex);
    const set = (part: Part, lines: string[]): void => this.texts[part].setText(lines.join('\n'), true);
    if (!char) {
      set('header', ['No party members']);
      for (const part of ['base', 'battle', 'equipment', 'spells'] as const) set(part, []);
      return;
    }
    set('header', [headerLine(char, this.memberIndex, this.game.party.size)]);
    set('base', baseLines(char));
    set('battle', ['Battle', '', ...battleLines(char)]);
    set('equipment', ['Equipment', '', ...equipmentLines(char)]);
    const spells = spellLines(char);
    set('spells', spells.length > 0 ? spells : ['No magic.']);
  }
}

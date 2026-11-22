import { BitmapText, Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { Menu } from '../ui/Menu.js';
import { NES_FONT } from '../ui/NESFont.js';
import { uiEventBus } from '../ui/uiSounds.js';
import { FONT_SIZE, MENU_LINE_HEIGHT, SCREEN_MARGIN, WINDOW_PADDING } from '../core/LayoutConstants.js';
import { BOOST_ROWS, DEFAULT_BOOSTS, isDefaultBoosts, stepBoost, type BoostRow, type Boosts } from '../core/Boosts.js';

/** The Boosts window: left of the screen, the six rows below a title line. */
export const BOOSTS_PANE = { x: SCREEN_MARGIN, width: 900 };
/** Where the value column starts, from the window's content edge (past the cursor and the longest label). */
const VALUE_X = 480;
/** The left / right arrows around a value. */
const VALUE_TEXT = (s: string): string => `< ${s} >`;
const WHITE = 0xffffff;
const CHANGED = 0xf8d878;

/** The step after `row`'s current value, wrapping past the last (confirm cycles a row). */
function cycle(b: Readonly<Boosts>, row: BoostRow): Boosts {
  const at = row.steps.indexOf(b[row.key]);
  return at >= row.steps.length - 1 ? { ...b, [row.key]: row.steps[0] } as Boosts : stepBoost(b, row.key, 1);
}

/**
 * Boosts (pass CHT, src/core/Boosts.ts): gold, experience, encounters, battle speed, walk speed and the sure escape.
 * Up / down move between the rows, left / right change the highlighted value (the ends stop), confirm steps it
 * forward and wraps, cancel closes. A change applies at once to `game.boosts` (saved with the game); a value off its
 * default is drawn yellow. Opened from the field menu.
 */
export class BoostsScene implements Scene {
  readonly container = new Container();
  private readonly menu: Menu;
  private readonly values: BitmapText[] = [];
  private readonly status: BitmapText;
  private readonly help: HelpWindow;
  private closing = false;
  private shownIndex = -1;

  constructor(private readonly game: Game) {
    const text = (parent: Container, x: number, y: number, s = ''): BitmapText => {
      const t = new BitmapText({ text: s, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: WHITE } });
      t.position.set(x, y);
      parent.addChild(t);
      return t;
    };
    const height = (BOOST_ROWS.length + 2) * MENU_LINE_HEIGHT + 2 * WINDOW_PADDING;
    const win = new Window({ x: BOOSTS_PANE.x, y: SCREEN_MARGIN, width: BOOSTS_PANE.width, height });
    text(win, win.contentX, win.contentY, 'Cheats (Boosts)');
    const top = win.contentY + MENU_LINE_HEIGHT;
    this.menu = new Menu({
      items: BOOST_ROWS.map((r) => ({ label: r.label, value: r.key })),
      x: win.contentX, y: top,
      onSelect: (_item, i) => this.apply(cycle(this.game.boosts, BOOST_ROWS[i])),
      onCancel: () => this.close(),
    });
    win.addChild(this.menu);
    BOOST_ROWS.forEach((_r, i) => this.values.push(text(win, win.contentX + VALUE_X, top + i * MENU_LINE_HEIGHT)));
    this.status = text(win, win.contentX, top + BOOST_ROWS.length * MENU_LINE_HEIGHT);
    this.container.addChild(win);
    this.help = new HelpWindow();
    this.container.addChild(this.help);
  }

  enter(): void {
    this.closing = false;
    this.menu.setIndex(0);
    this.shownIndex = -1;
    this.redraw();
  }

  update(_dt: number): void {
    if (this.closing) return;
    const input = this.game.input;
    const dir = input.isJustPressed('right') ? 1 : input.isJustPressed('left') ? -1 : 0;
    if (dir !== 0) {
      const next = stepBoost(this.game.boosts, BOOST_ROWS[this.menu.selectedIndex].key, dir);
      this.apply(next);
      return;
    }
    this.menu.update(input);
    this.showHelp();
  }

  /** The value column as drawn now (tests). */
  get valueLines(): string[] { return this.values.map((t) => t.text); }
  get selectedKey(): string { return BOOST_ROWS[this.menu.selectedIndex].key; }
  get helpLine(): string { return this.help.text; }
  get statusLine(): string { return this.status.text; }

  /** Take `next` as the game's boosts (a change makes the cursor sound; a step past an end changes nothing). */
  private apply(next: Boosts): void {
    const row = BOOST_ROWS[this.menu.selectedIndex];
    if (next[row.key] === this.game.boosts[row.key]) return;
    this.game.boosts = next;
    uiEventBus()?.emit('cursorMove', {});
    this.redraw();
  }

  private close(): void {
    this.closing = true;
    this.game.scenes.pop().catch((e) => console.error('BoostsScene: pop failed', e));
  }

  private redraw(): void {
    const b = this.game.boosts;
    BOOST_ROWS.forEach((row, i) => {
      this.values[i].text = VALUE_TEXT(row.format(b[row.key]));
      this.values[i].tint = b[row.key] === DEFAULT_BOOSTS[row.key] ? WHITE : CHANGED;
    });
    this.status.text = isDefaultBoosts(b) ? 'All at normal.' : 'Cheats on: shown in the party panel.';
    this.shownIndex = -1;
    this.showHelp();
  }

  private showHelp(): void {
    if (this.menu.selectedIndex === this.shownIndex) return;
    this.shownIndex = this.menu.selectedIndex;
    this.help.setText(`${BOOST_ROWS[this.shownIndex].help} Left/Right to change.`);
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}
}

import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { NES_FONT } from '../ui/NESFont.js';
import { restoreBattleSnapshot, retryAdvice } from '../systems/BattleRetry.js';
import { wrapText } from '../ui/textUtils.js';
import { GAME_WIDTH, GAME_HEIGHT, MENU_LINE_HEIGHT, FONT_SIZE, CHAR_WIDTH } from '../core/LayoutConstants.js';

/** Shown when the party was already hurt as the lost battle began (U4). */
export const WEAK_RETRY_HINT = 'Your party was hurt when this battle began. Return to the field to heal first.';

const WIN_W = 600;
const WIN_H = 460;

/**
 * Game Over: Retry Battle or Return to Field (both from where the battle started, when possible), Load Game, or
 * back to the title. A party that was already weak is pointed at Return to Field (U4).
 */
export class GameOverScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private menu: Menu | null = null;
  private hint: BitmapText | null = null;
  private items: MenuItem[] = [];

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.container.removeChildren();
    this.game.audio.playMusic('gameover', false);
    const left = (GAME_WIDTH - WIN_W) / 2;
    const top = (GAME_HEIGHT - WIN_H) / 2;

    const win = new Window({ x: left, y: top, width: WIN_W, height: WIN_H });
    this.container.addChild(win);

    const text = new BitmapText({ text: 'GAME OVER', style: { fontFamily: NES_FONT, fontSize: 48, fill: 0xffffff } });
    text.anchor.set(0.5);
    text.position.set(GAME_WIDTH / 2, top + 90);
    this.container.addChild(text);

    const snap = this.game.battleRetry;
    const weak = snap !== null && retryAdvice(snap) === 'weak';
    this.hint = null;
    if (weak) {
      this.hint = new BitmapText({
        text: wrapText(WEAK_RETRY_HINT, Math.floor((WIN_W - 60) / CHAR_WIDTH)),
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff, align: 'center' },
      });
      this.hint.anchor.set(0.5, 0);
      this.hint.position.set(GAME_WIDTH / 2, top + 130);
      this.container.addChild(this.hint);
    }

    const items: MenuItem[] = [];
    this.items = items;
    if (snap) items.push({ label: 'Retry Battle', value: 'retry' }, { label: 'Return to Field', value: 'field' });
    items.push({ label: 'Load Game', value: 'load' }, { label: 'Title', value: 'title' });
    this.menu = new Menu({
      items,
      x: left + 150,
      y: top + (weak ? 250 : 190),
      lineHeight: MENU_LINE_HEIGHT,
      initialIndex: weak ? 1 : 0,
      onSelect: (item) => this.onSelect(item.value),
      eventBus: this.game.events,
    });
    this.container.addChild(this.menu);
  }

  update(_dt: number): void {
    this.menu?.update(this.game.input);
  }

  /** The menu's labels, in order (for tests). */
  get choices(): string[] {
    return this.items.map((i) => i.label);
  }

  get selectedIndex(): number {
    return this.menu?.selectedIndex ?? -1;
  }

  /** The weak-party hint, or null when none shows. */
  get hintText(): string | null {
    return this.hint?.text ?? null;
  }

  private onSelect(value: string): void {
    const snap = this.game.battleRetry;
    if ((value === 'retry' || value === 'field') && snap) {
      const battle = restoreBattleSnapshot(this.game, snap);
      // Return to Field: the same state, standing where the fight began, with no battle queued
      this.game.pendingBattle = value === 'retry' ? battle : null;
      this.game.scenes.switchTo('exploration');
    } else if (value === 'load') {
      this.game.scenes.push('loadMenu');
    } else {
      this.game.battleRetry = null;
      this.game.scenes.switchTo('title');
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
    this.menu = null;
    this.hint = null;
  }
}

import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { NES_FONT } from '../ui/NESFont.js';
import { restoreBattleSnapshot } from '../systems/BattleRetry.js';
import { GAME_WIDTH, GAME_HEIGHT, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

/** Game Over: Retry Battle (from where it started, when possible), Load Game, or back to the title. */
export class GameOverScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private menu: Menu | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.container.removeChildren();
    this.game.audio.playMusic('gameover', false);

    const win = new Window({ x: (GAME_WIDTH - 600) / 2, y: (GAME_HEIGHT - 460) / 2, width: 600, height: 460 });
    this.container.addChild(win);

    const text = new BitmapText({ text: 'GAME OVER', style: { fontFamily: NES_FONT, fontSize: 48, fill: 0xffffff } });
    text.anchor.set(0.5);
    text.position.set(GAME_WIDTH / 2, (GAME_HEIGHT - 460) / 2 + 90);
    this.container.addChild(text);

    const items: MenuItem[] = [];
    if (this.game.battleRetry) items.push({ label: 'Retry Battle', value: 'retry' });
    items.push({ label: 'Load Game', value: 'load' }, { label: 'Title', value: 'title' });
    this.menu = new Menu({
      items,
      x: (GAME_WIDTH - 600) / 2 + 170,
      y: (GAME_HEIGHT - 460) / 2 + 190,
      lineHeight: MENU_LINE_HEIGHT,
      onSelect: (item) => this.onSelect(item.value),
      eventBus: this.game.events,
    });
    this.container.addChild(this.menu);
  }

  update(_dt: number): void {
    this.menu?.update(this.game.input);
  }

  private onSelect(value: string): void {
    if (value === 'retry' && this.game.battleRetry) {
      const battle = restoreBattleSnapshot(this.game, this.game.battleRetry);
      this.game.pendingBattle = battle;
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
  }
}

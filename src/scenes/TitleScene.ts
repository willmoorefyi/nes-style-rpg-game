import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SaveManager } from '../systems/SaveManager.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

export class TitleScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private menu!: Menu;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.container.removeChildren();

    // Black background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    // Title text
    const title = new BitmapText({
      text: 'FINAL FANTASY',
      style: { fontFamily: NES_FONT, fontSize: 48, fill: 0xffffff },
    });
    title.anchor.set(0.5);
    title.position.set(GAME_WIDTH / 2, 300);
    this.container.addChild(title);

    // Subtitle
    const subtitle = new BitmapText({
      text: 'Warriors of Light',
      style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xaaaaaa },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(GAME_WIDTH / 2, 400);
    this.container.addChild(subtitle);

    // Menu window
    const hasSaves = SaveManager.getSaveSlots().some((s) => s !== null);
    const menuWindow = new Window({ x: 760, y: 550, width: 400, height: 200 });
    this.menu = new Menu({
      items: [
        { label: 'New Game', value: 'new' },
        { label: 'Continue', value: 'continue', enabled: hasSaves },
      ],
      x: menuWindow.contentX,
      y: menuWindow.contentY,
      lineHeight: 48,
      onSelect: (item) => this.onSelect(item.value),
      eventBus: this.game.events,
    });
    menuWindow.addChild(this.menu);
    this.container.addChild(menuWindow);
  }

  update(_dt: number): void {
    if (this.menu) {
      this.menu.update(this.game.input);
    }
  }

  private onSelect(value: string): void {
    if (value === 'new') {
      this.game.scenes.switchTo('partyCreation');
    } else if (value === 'continue') {
      this.game.scenes.push('loadMenu');
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}

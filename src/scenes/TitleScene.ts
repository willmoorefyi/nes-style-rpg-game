import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { WIDTH, HEIGHT } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SaveManager } from '../systems/SaveManager.js';
import { NES_FONT } from '../ui/NESFont.js';

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
    bg.rect(0, 0, WIDTH, HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    // Title text
    const title = new BitmapText({
      text: 'FINAL FANTASY',
      style: { fontFamily: NES_FONT, fontSize: 16, fill: 0xffffff },
    });
    title.anchor.set(0.5);
    title.position.set(WIDTH / 2, 60);
    this.container.addChild(title);

    // Subtitle
    const subtitle = new BitmapText({
      text: 'Warriors of Light',
      style: { fontFamily: NES_FONT, fontSize: 8, fill: 0xaaaaaa },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(WIDTH / 2, 85);
    this.container.addChild(subtitle);

    // Menu window
    const hasSaves = SaveManager.getSaveSlots().some((s) => s !== null);
    const menuWindow = new Window({ x: 80, y: 140, width: 96, height: 52 });
    this.menu = new Menu({
      items: [
        { label: 'New Game', value: 'new' },
        { label: 'Continue', value: 'continue', enabled: hasSaves },
      ],
      x: menuWindow.contentX,
      y: menuWindow.contentY,
      lineHeight: 16,
      onSelect: (item) => this.onSelect(item.value),
      eventBus: this.game.events,
    });
    menuWindow.addChild(this.menu);
    this.container.addChild(menuWindow);
  }

  update(_dt: number): void {
    this.menu.update(this.game.input);
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

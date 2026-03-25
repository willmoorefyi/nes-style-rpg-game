import { Container, BitmapText } from 'pixi.js';
import type { Scene, ShopData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE } from '../core/LayoutConstants.js';

type InnState = 'confirm' | 'resting';

export class InnScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private price: number;
  private state: InnState = 'confirm';
  private window: Window;
  private menu?: Menu;
  private messageText?: BitmapText;
  private restTimer = 0;

  constructor(game: Game, shopData: ShopData) {
    this.game = game;
    this.price = shopData.innPrice ?? 100;
    this.window = new Window({ x: (GAME_WIDTH - 600) / 2, y: (GAME_HEIGHT - 300) / 2, width: 600, height: 300 });
    this.container.addChild(this.window);
    this.showConfirm();
  }

  private showConfirm(): void {
    const label = new BitmapText({ text: `Stay for ${this.price} G?`, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    label.position.set(this.window.contentX, this.window.contentY);
    this.window.addChild(label);

    this.menu = new Menu({
      items: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
      x: this.window.contentX,
      y: this.window.contentY + 60,
      onSelect: (item) => this.onSelect(item.value),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.window.addChild(this.menu);
  }

  private onSelect(value: string): void {
    if (value === 'no') {
      this.game.scenes.pop();
      return;
    }
    if (!this.game.party.spendGold(this.price)) {
      this.game.scenes.pop();
      return;
    }
    for (const member of this.game.party.all) {
      member.currentHp = member.maxHp;
      member.restoreAllCharges();
    }
    this.showRestMessage();
  }

  private showRestMessage(): void {
    this.state = 'resting';
    if (this.menu) {
      this.window.removeChild(this.menu);
      this.menu = undefined;
    }
    while (this.window.children.length > 1) {
      this.window.removeChildAt(1);
    }
    this.messageText = new BitmapText({ text: 'Your party rests...', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.messageText.position.set(this.window.contentX, this.window.contentY + 48);
    this.window.addChild(this.messageText);
    this.restTimer = 0;
  }

  enter(): void {}

  update(dt: number): void {
    if (this.state === 'confirm' && this.menu) {
      this.menu.update(this.game.input);
    } else if (this.state === 'resting') {
      this.restTimer += dt;
      if (this.restTimer > 90 || this.game.input.isJustPressed('confirm')) {
        this.game.scenes.pop();
      }
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}

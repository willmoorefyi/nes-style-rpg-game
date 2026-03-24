import { Container, Text, TextStyle } from 'pixi.js';
import type { Scene, ShopData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';

type InnState = 'confirm' | 'resting';

export class InnScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private price: number;
  private state: InnState = 'confirm';
  private window: Window;
  private menu?: Menu;
  private messageText?: Text;
  private restTimer = 0;
  private style = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xffffff });

  constructor(game: Game, shopData: ShopData) {
    this.game = game;
    this.price = shopData.innPrice ?? 100;
    this.window = new Window({ x: 48, y: 80, width: 160, height: 64 });
    this.container.addChild(this.window);
    this.showConfirm();
  }

  private showConfirm(): void {
    const label = new Text({ text: `Stay for ${this.price} G?`, style: this.style });
    label.position.set(this.window.contentX, this.window.contentY);
    this.window.addChild(label);

    this.menu = new Menu({
      items: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
      x: this.window.contentX,
      y: this.window.contentY + 20,
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
    this.messageText = new Text({ text: 'Your party rests...', style: this.style });
    this.messageText.position.set(this.window.contentX, this.window.contentY + 16);
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

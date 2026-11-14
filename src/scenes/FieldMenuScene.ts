import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import type { ExplorationScene } from './ExplorationScene.js';
import { SCREEN_MARGIN } from '../core/LayoutConstants.js';

export class FieldMenuScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu: Menu;
  private saveIndex: number;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 300, height: 500 });
    const items: MenuItem[] = [
      { label: 'Items', value: 'items' },
      { label: 'Magic', value: 'magic' },
      { label: 'Equip', value: 'equip' },
      { label: 'Status', value: 'status' },
      { label: 'Order', value: 'order' },
      { label: 'Config', value: 'config' },
      { label: 'Save', value: 'save' },
      { label: 'Load', value: 'load' },
    ];
    this.saveIndex = items.findIndex((i) => i.value === 'save');
    this.menu = new Menu({
      items,
      x: this.window.contentX,
      y: this.window.contentY,
      onSelect: (item) => this.onSelect(item),
      onCancel: () => this.game.scenes.pop(),
    });
    this.window.addChild(this.menu);
    this.container.addChild(this.window);
  }

  enter(): void {
    // C7: Evaluate canSave on enter, not constructor
    const exploration = this.game.scenes.get<ExplorationScene>('exploration');
    // redraws the item, so Save is only grey where the map forbids saving
    this.menu.setItemEnabled(this.saveIndex, exploration?.canSave() ?? false);
  }

  update(_dt: number): void {
    this.menu.update(this.game.input);
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  private onSelect(item: MenuItem): void {
    switch (item.value) {
      case 'items':
        this.game.scenes.push('itemMenu');
        break;
      case 'equip':
        this.game.scenes.push('equip');
        break;
      case 'status':
        this.game.scenes.push('status');
        break;
      case 'magic':
        this.game.scenes.push('fieldMagic');
        break;
      case 'order':
        this.game.scenes.push('fieldOrder');
        break;
      case 'save':
        this.game.scenes.push('saveMenu');
        break;
      case 'load':
        this.game.scenes.push('loadMenu');
        break;
    }
  }
}

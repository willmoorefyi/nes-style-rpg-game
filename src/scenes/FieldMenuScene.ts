import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import type { ExplorationScene } from './ExplorationScene.js';

export class FieldMenuScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu: Menu;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: 8, y: 8, width: 80, height: 88 });
    const exploration = game.scenes.get<ExplorationScene>('exploration');
    const canSave = exploration?.canSave() ?? false;
    const items: MenuItem[] = [
      { label: 'Items', value: 'items' },
      { label: 'Magic', value: 'magic' },
      { label: 'Equip', value: 'equip' },
      { label: 'Status', value: 'status' },
      { label: 'Order', value: 'order' },
      { label: 'Config', value: 'config' },
      { label: 'Save', value: 'save', enabled: canSave },
    ];
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

  enter(): void {}

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
    }
  }
}

import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';

type Phase = 'selectFirst' | 'selectSecond';

export class FieldOrderScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu!: Menu;
  private phase: Phase = 'selectFirst';
  private firstIdx = -1;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: 8, y: 8, width: 100, height: 64 });
    this.container.addChild(this.window);
  }

  enter(): void {
    this.phase = 'selectFirst';
    this.firstIdx = -1;
    this.buildMenu();
  }

  private buildMenu(): void {
    if (this.menu) this.window.removeChild(this.menu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({
      label: this.firstIdx === i ? `>${c.name}<` : c.name,
      value: String(i),
    }));
    this.menu = new Menu({
      items,
      x: this.window.contentX,
      y: this.window.contentY,
      onSelect: (item) => this.onSelect(Number(item.value)),
      onCancel: () => this.onCancel(),
    });
    this.window.addChild(this.menu);
  }

  private onSelect(idx: number): void {
    if (this.phase === 'selectFirst') {
      this.firstIdx = idx;
      this.phase = 'selectSecond';
      this.buildMenu();
    } else {
      if (idx !== this.firstIdx) this.game.party.swap(this.firstIdx, idx);
      this.phase = 'selectFirst';
      this.firstIdx = -1;
      this.buildMenu();
    }
  }

  private onCancel(): void {
    if (this.phase === 'selectSecond') {
      this.phase = 'selectFirst';
      this.firstIdx = -1;
      this.buildMenu();
    } else {
      this.game.scenes.pop();
    }
  }

  update(_dt: number): void {
    this.menu.update(this.game.input);
  }

  exit(): void {}
}

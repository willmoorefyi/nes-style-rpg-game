import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SaveManager, type SlotSummary } from '../systems/SaveManager.js';
import { GAME_WIDTH, SCREEN_MARGIN, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

export class LoadScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu!: Menu;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 500 });
    this.container.addChild(this.window);
    this.buildMenu();
  }

  /** The slot list is read fresh each time the scene opens (it is cached, and saves happen in between). */
  private buildMenu(): void {
    if (this.menu) this.window.removeChild(this.menu);
    const slots = SaveManager.getSaveSlots();
    const items: MenuItem[] = slots.map((s: SlotSummary | null, i: number) => ({
      label: this.formatSlot(s, i),
      value: String(i),
      enabled: s !== null,
    }));
    this.menu = new Menu({
      items,
      x: this.window.contentX,
      y: this.window.contentY,
      lineHeight: MENU_LINE_HEIGHT,
      onSelect: (item) => this.onSelect(parseInt(item.value)),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.window.addChild(this.menu);
  }

  private formatSlot(slot: SlotSummary | null, index: number): string {
    if (!slot) return `Slot ${index + 1}: Empty`;
    const time = this.formatTime(slot.playTime);
    return `Slot ${index + 1}: Lv${slot.level} ${time}`;
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  enter(): void { this.buildMenu(); }
  update(_dt: number): void { this.menu.update(this.game.input); }
  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  private onSelect(slotId: number): void {
    const data = SaveManager.load(slotId);
    if (!data) return;
    this.game.restoreState(data);
    this.game.pendingEntrance = null;
    this.game.battleRetry = null;
    this.game.pendingBattle = null;
    this.game.scenes.switchTo('exploration');
  }
}

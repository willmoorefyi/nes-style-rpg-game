import { Container, Text, TextStyle } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SaveManager, type SlotSummary } from '../systems/SaveManager.js';

export class SaveScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu: Menu;
  private confirmWindow?: Window;
  private confirmMenu?: Menu;
  private pendingSlot: number | null = null;
  private style = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xffffff });

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: 16, y: 16, width: 224, height: 100 });
    const slots = SaveManager.getSaveSlots();
    const items = slots.map((s: SlotSummary | null, i: number) => ({
      label: this.formatSlot(s, i),
      value: String(i),
    }));
    this.menu = new Menu({
      items,
      x: this.window.contentX,
      y: this.window.contentY,
      lineHeight: 24,
      onSelect: (item) => this.onSelect(parseInt(item.value)),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.window.addChild(this.menu);
    this.container.addChild(this.window);
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

  enter(): void {}
  update(_dt: number): void {
    if (this.confirmMenu) {
      this.confirmMenu.update(this.game.input);
    } else {
      this.menu.update(this.game.input);
    }
  }
  exit(): void {}

  private onSelect(slotId: number): void {
    const slots = SaveManager.getSaveSlots();
    if (slots[slotId] !== null) {
      this.showConfirm(slotId);
    } else {
      this.doSave(slotId);
    }
  }

  private showConfirm(slotId: number): void {
    this.pendingSlot = slotId;
    this.confirmWindow = new Window({ x: 64, y: 80, width: 128, height: 48 });
    const label = new Text({ text: 'Overwrite?', style: this.style });
    label.position.set(this.confirmWindow.contentX, this.confirmWindow.contentY);
    this.confirmWindow.addChild(label);
    this.confirmMenu = new Menu({
      items: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
      x: this.confirmWindow.contentX,
      y: this.confirmWindow.contentY + 16,
      onSelect: (item) => {
        if (item.value === 'yes' && this.pendingSlot !== null) this.doSave(this.pendingSlot);
        this.hideConfirm();
      },
      onCancel: () => this.hideConfirm(),
      eventBus: this.game.events,
    });
    this.confirmWindow.addChild(this.confirmMenu);
    this.container.addChild(this.confirmWindow);
  }

  private hideConfirm(): void {
    if (this.confirmWindow) {
      this.container.removeChild(this.confirmWindow);
      this.confirmWindow = undefined;
      this.confirmMenu = undefined;
      this.pendingSlot = null;
    }
  }

  private doSave(slotId: number): void {
    SaveManager.save(
      slotId,
      this.game.party,
      this.game.inventory,
      this.game.gameFlags,
      this.game.currentMapId,
      this.game.playerPosition,
      this.game.playTime
    );
    this.game.scenes.pop();
  }
}

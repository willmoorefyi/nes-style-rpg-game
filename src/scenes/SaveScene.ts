import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SaveManager, type SlotSummary } from '../systems/SaveManager.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

export class SaveScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private menu!: Menu;
  /** "Saved." / "Could not save." — the scene closes on the next confirm. */
  private resultWindow?: Window;
  private confirmWindow?: Window;
  private confirmMenu?: Menu;
  private pendingSlot: number | null = null;

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
    const items = slots.map((s: SlotSummary | null, i: number) => ({
      label: this.formatSlot(s, i),
      value: String(i),
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

  enter(): void {
    this.hideConfirm();
    if (this.resultWindow) this.container.removeChild(this.resultWindow);
    this.resultWindow = undefined;
    this.buildMenu();
  }
  update(_dt: number): void {
    if (this.resultWindow) {
      if (this.game.input.isJustPressed('confirm') || this.game.input.isJustPressed('cancel')) {
        this.container.removeChild(this.resultWindow);
        this.resultWindow = undefined;
        this.game.scenes.pop();
      }
    } else if (this.confirmMenu) {
      this.confirmMenu.update(this.game.input);
    } else {
      this.menu.update(this.game.input);
    }
  }
  onPause(): void {}
  onResume(): void {}

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
    this.confirmWindow = new Window({ x: (GAME_WIDTH - 500) / 2, y: 400, width: 500, height: 200 });
    const label = new BitmapText({ text: 'Overwrite?', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    label.position.set(this.confirmWindow.contentX, this.confirmWindow.contentY);
    this.confirmWindow.addChild(label);
    this.confirmMenu = new Menu({
      items: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
      x: this.confirmWindow.contentX,
      y: this.confirmWindow.contentY + 48,
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
    const ok = SaveManager.save(
      slotId,
      this.game.party,
      this.game.inventory,
      this.game.gameFlags,
      this.game.currentMapId,
      this.game.playerPosition,
      this.game.playTime
    );
    if (!ok) console.error(`Save to slot ${slotId + 1} failed`);
    this.showResult(ok ? 'Saved.' : 'Could not save.');
  }

  private showResult(message: string): void {
    this.resultWindow = new Window({ x: (GAME_WIDTH - 500) / 2, y: 400, width: 500, height: 140 });
    const label = new BitmapText({ text: message, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    label.position.set(this.resultWindow.contentX, this.resultWindow.contentY);
    this.resultWindow.addChild(label);
    this.container.addChild(this.resultWindow);
  }
}

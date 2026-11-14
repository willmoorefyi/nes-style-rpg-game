import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { SaveManager, type SlotSummary } from '../systems/SaveManager.js';
import { SLOT_RECTS, detailWindow, slotLabel, titleWindow } from './save/slotView.js';
import { MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

export const LOAD_TITLE = 'Load: choose a slot';

export class LoadScene implements Scene {
  readonly container = new Container();
  private readonly listWindow = new Window({ ...SLOT_RECTS.list });
  private readonly detail = detailWindow();
  private menu!: Menu;
  private slots: (SlotSummary | null)[] = [];
  private confirmBox?: ConfirmBox;

  constructor(private readonly game: Game) {
    this.container.addChild(titleWindow(LOAD_TITLE), this.listWindow, this.detail.window);
    this.buildMenu();
  }

  /** The highlighted slot's details. */
  get detailText(): string { return this.detail.text(); }
  /** The open Yes/No prompt, or ''. */
  get confirmPrompt(): string { return this.confirmBox?.prompt ?? ''; }

  /** The slot list is read fresh each time the scene opens (it is cached, and saves happen in between). */
  private buildMenu(): void {
    if (this.menu) this.listWindow.removeChild(this.menu);
    this.slots = SaveManager.getSaveSlots();
    this.menu = new Menu({
      items: this.slots.map((s, i) => ({ label: slotLabel(s, i), value: String(i), enabled: s !== null })),
      x: this.listWindow.contentX,
      y: this.listWindow.contentY,
      lineHeight: MENU_LINE_HEIGHT,
      onSelect: (item) => this.askToLoad(parseInt(item.value)),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.listWindow.addChild(this.menu);
    this.detail.show(this.slots[0] ?? null);
  }

  enter(): void {
    this.closeConfirm();
    this.buildMenu();
  }

  update(_dt: number): void {
    if (this.confirmBox) {
      this.confirmBox.update(this.game.input);
      return;
    }
    const prev = this.menu.selectedIndex;
    this.menu.update(this.game.input);
    if (!this.confirmBox && this.menu.selectedIndex !== prev) this.detail.show(this.slots[this.menu.selectedIndex] ?? null);
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}

  /** Loading always asks first (S5): unsaved progress would be lost. */
  private askToLoad(slotId: number): void {
    this.confirmBox = new ConfirmBox({
      prompt: `Load Slot ${slotId + 1}? Progress since your last save is lost.`,
      eventBus: this.game.events,
      onAnswer: (yes) => {
        this.closeConfirm();
        if (yes) this.load(slotId);
      },
    });
    this.container.addChild(this.confirmBox);
  }

  private closeConfirm(): void {
    if (this.confirmBox) this.container.removeChild(this.confirmBox);
    this.confirmBox = undefined;
  }

  private load(slotId: number): void {
    const data = SaveManager.load(slotId);
    if (!data) {
      console.error(`Load: slot ${slotId + 1} could not be read`);
      return;
    }
    this.game.restoreState(data);
    this.game.pendingEntrance = null;
    this.game.battleRetry = null;
    this.game.pendingBattle = null;
    this.game.scenes.switchTo('exploration');
  }
}

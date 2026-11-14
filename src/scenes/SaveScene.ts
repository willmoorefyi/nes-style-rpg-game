import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { ExplorationScene } from './ExplorationScene.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { SaveManager, type SlotSummary } from '../systems/SaveManager.js';
import { NES_FONT } from '../ui/NESFont.js';
import { SLOT_RECTS, detailWindow, slotLabel, titleWindow } from './save/slotView.js';
import { GAME_WIDTH, FONT_SIZE, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

export const SAVE_TITLE = 'Save: choose a slot';

export class SaveScene implements Scene {
  readonly container = new Container();
  private readonly listWindow = new Window({ ...SLOT_RECTS.list });
  private readonly detail = detailWindow();
  private menu!: Menu;
  private slots: (SlotSummary | null)[] = [];
  /** "Saved." / "Could not save." — the scene closes on the next confirm. */
  private resultWindow?: Window;
  private confirmBox?: ConfirmBox;

  constructor(private readonly game: Game) {
    this.container.addChild(titleWindow(SAVE_TITLE), this.listWindow, this.detail.window);
    this.buildMenu();
  }

  /** The highlighted slot's details. */
  get detailText(): string { return this.detail.text(); }
  /** The open Yes/No prompt, or ''. */
  get confirmPrompt(): string { return this.confirmBox?.prompt ?? ''; }

  /** The slot list is read fresh each time it is shown (the scene is cached, and saves happen in between). */
  private buildMenu(cursor = 0): void {
    if (this.menu) this.listWindow.removeChild(this.menu);
    this.slots = SaveManager.getSaveSlots();
    this.menu = new Menu({
      items: this.slots.map((s, i) => ({ label: slotLabel(s, i), value: String(i) })),
      x: this.listWindow.contentX,
      y: this.listWindow.contentY,
      lineHeight: MENU_LINE_HEIGHT,
      initialIndex: cursor,
      onSelect: (item) => this.onSelect(parseInt(item.value)),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.listWindow.addChild(this.menu);
    this.detail.show(this.slots[this.menu.selectedIndex] ?? null);
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
    } else if (this.confirmBox) {
      this.confirmBox.update(this.game.input);
    } else {
      const prev = this.menu.selectedIndex;
      this.menu.update(this.game.input);
      if (!this.confirmBox && this.menu.selectedIndex !== prev) this.detail.show(this.slots[this.menu.selectedIndex] ?? null);
    }
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}

  private onSelect(slotId: number): void {
    if (this.slots[slotId] !== null) {
      this.showConfirm(slotId);
    } else {
      this.doSave(slotId);
    }
  }

  private showConfirm(slotId: number): void {
    this.confirmBox = new ConfirmBox({
      prompt: `Overwrite Slot ${slotId + 1}?`,
      width: 600,
      eventBus: this.game.events,
      onAnswer: (yes) => {
        this.hideConfirm();
        if (yes) this.doSave(slotId);
      },
    });
    this.container.addChild(this.confirmBox);
  }

  private hideConfirm(): void {
    if (this.confirmBox) this.container.removeChild(this.confirmBox);
    this.confirmBox = undefined;
  }

  private doSave(slotId: number): void {
    // the map's display name, so the slot reads "Cornelia Castle 2F" (S5); '' falls back to the map id
    const location = this.game.scenes.get<ExplorationScene>('exploration')?.getMapName() || undefined;
    const ok = SaveManager.save(
      slotId,
      this.game.party,
      this.game.inventory,
      this.game.gameFlags,
      this.game.currentMapId,
      this.game.playerPosition,
      this.game.playTime,
      location,
    );
    if (!ok) console.error(`Save to slot ${slotId + 1} failed`);
    // the list behind the message shows the new save (S4)
    this.buildMenu(slotId);
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

import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { SaveManager, type LoadedSave, type SlotSummary } from '../systems/SaveManager.js';
import { resolveMapPath } from '../systems/MapLoader.js';
import { isPreviewAi } from '../core/artPreview.js';
import type { MapData } from '../types/index.js';
import { revalidateLoaded, type MapSource } from './save/loadRevalidate.js';
import { RESET_ENTRANCE, RESET_NOTICE } from '../systems/worldReset.js';
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
  private fromTitle = false;
  /** A v4 save's NW2 check is loading maps (input waits). */
  private checking = false;

  /** `maps` reads a map for the NW2 save check (default: the game's data loader, compiled maps as the field). */
  constructor(private readonly game: Game, private readonly maps: MapSource = (id) => defaultMaps(game, id)) {
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

  /**
   * Every opening starts as a game in progress (the field menu, Game Over); only the title's Continue then calls
   * `openedFromTitle` once the push has settled.
   */
  enter(): void {
    this.fromTitle = false;
    this.closeConfirm();
    this.buildMenu();
  }

  /** The title's Continue opened this screen (U6): nothing unsaved can be lost. */
  openedFromTitle(): void {
    this.fromTitle = true;
  }

  update(_dt: number): void {
    if (this.checking) return;
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

  /**
   * Loading always asks first (S5). During a game unsaved progress would be lost, so the prompt warns and starts on
   * No (U6); from the title it is a plain "Load Slot N?" on Yes.
   */
  private askToLoad(slotId: number): void {
    const warn = !this.fromTitle;
    this.confirmBox = new ConfirmBox({
      prompt: `Load Slot ${slotId + 1}?${warn ? ' Progress since your last save is lost.' : ''}`,
      defaultNo: warn && this.game.party.size > 0,
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

  /** Whether a v4 save's NW2 check is still loading maps (tests, the browser check). */
  get busy(): boolean { return this.checking; }

  private load(slotId: number): void {
    const data = SaveManager.load(slotId);
    if (!data) {
      console.error(`Load: slot ${slotId + 1} could not be read`);
      return;
    }
    if (!data.revalidate) {
      this.start(data);
      return;
    }
    // NW2 (docs/NW2_EDITS_PLAN.md 12): a v4 save is checked on the NW2 world first (the maps load async)
    this.checking = true;
    revalidateLoaded(data, this.maps)
      .catch((e: unknown) => {
        console.error('Load: the NW2 save check failed; loading the save as it was', e);
        return data;
      })
      .then((checked) => {
        this.checking = false;
        this.start(checked);
      });
  }

  private start(data: LoadedSave): void {
    this.game.restoreState(data);
    // NW-5 (docs/NATURAL_WORLD_PLAN.md 5.3): a pre-NW save moved to Cornelia arrives at its south gate, facing
    // south, and the field says so once
    this.game.pendingEntrance = data.reset ? RESET_ENTRANCE : null;
    this.game.pendingFacing = data.reset ? 'down' : null;
    this.game.pendingNotice = data.reset ? RESET_NOTICE : null;
    this.game.battleRetry = null;
    this.game.pendingBattle = null;
    this.game.scenes.switchTo('exploration');
  }
}

/** A map as the field reads it: the compiled file for the ids in the manifest (the preview rule), else the legacy one. */
async function defaultMaps(game: Game, id: string): Promise<MapData> {
  return game.data.loadMap(await resolveMapPath(game.data, id, isPreviewAi()));
}

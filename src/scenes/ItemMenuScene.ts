import { Container, BitmapText } from 'pixi.js';
import type { ItemData, Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { ExplorationScene } from './ExplorationScene.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { HelpWindow, HELP_RECT } from '../ui/HelpWindow.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { NES_FONT } from '../ui/NESFont.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { targetRows } from '../ui/partyTargetLabel.js';
import { initialItemTargetIndex } from '../entities/partyTargets.js';
import { FONT_SIZE, MENU_LINE_HEIGHT, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type Phase = 'selectItem' | 'selectTarget' | 'confirm';

/** A window's rectangle on screen (for layout tests). */
export interface ItemMenuRect { x: number; y: number; width: number; height: number }

const WINDOW_HEIGHT = HELP_RECT.y - 2 * SCREEN_MARGIN;
/** The item list (left) and the always-visible party window (right) never overlap (E7). */
export const ITEM_LIST_RECT: ItemMenuRect = { x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 1000 - SCREEN_MARGIN, height: WINDOW_HEIGHT };
export const ITEM_PARTY_RECT: ItemMenuRect = { x: 1016, y: SCREEN_MARGIN, width: 1896 - 1016, height: WINDOW_HEIGHT };

/** The confirm question for a party item: its data `prompt` (what resting does, E6), else "Use <name>?". */
export function restPrompt(item: Pick<ItemData, 'name' | 'prompt'> | undefined, itemId: string): string {
  return item?.prompt ?? `Use ${item?.name ?? itemId}?`;
}


export class ItemMenuScene implements Scene {
  readonly container = new Container();
  private readonly itemWindow = new Window({ ...ITEM_LIST_RECT });
  private readonly partyWindow = new Window({ ...ITEM_PARTY_RECT });
  private readonly descWindow = new HelpWindow();
  private readonly resultText: BitmapText;
  private itemMenu!: Menu;
  private targetMenu?: Menu;
  private partyRows: BitmapText[] = [];
  private confirmBox?: ConfirmBox;
  private phase: Phase = 'selectItem';
  private selectedItemId = '';

  constructor(private readonly game: Game) {
    this.resultText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.resultText.position.set(this.partyWindow.contentX, this.partyWindow.contentY + 5 * MENU_LINE_HEIGHT);
    this.partyWindow.addChild(this.resultText);
    this.container.addChild(this.itemWindow, this.partyWindow, this.descWindow);
  }

  enter(): void {
    this.phase = 'selectItem';
    this.closeConfirm();
    this.resultText.text = '';
    this.buildItemMenu();
    this.showParty(false);
  }

  /** The help bar's text (the highlighted item's description). */
  get helpText(): string { return this.descWindow.text; }
  /** The result of the last item used; it stays until the next item is chosen (E6). */
  get resultMessage(): string { return this.resultText.text; }
  /** The item list's cursor. */
  get selectedIndex(): number { return this.itemMenu.selectedIndex; }
  /** The item rows, with whether each can be chosen. */
  get itemRows(): Array<{ label: string; enabled: boolean }> {
    return this.listItems().map((i) => ({ label: i.label, enabled: i.enabled !== false }));
  }
  /** The party window's rows (`NAME  HP cur/max  STATUS`). */
  get partyLabels(): string[] {
    return this.targetMenu ? this.targetRows().map((r) => r.label) : this.partyRows.map((t) => t.text);
  }
  /** The target cursor while choosing who gets the item, or -1. */
  get targetIndex(): number { return this.targetMenu?.selectedIndex ?? -1; }
  /** The Yes/No prompt's text, or '' when none is open. */
  get confirmPrompt(): string { return this.confirmBox?.prompt ?? ''; }
  get listRect(): ItemMenuRect { return { ...ITEM_LIST_RECT }; }
  get partyRect(): ItemMenuRect { return { ...ITEM_PARTY_RECT }; }

  private listItems(): MenuItem[] {
    const items: MenuItem[] = this.game.inventory.getAll().map(({ itemId, quantity }) => {
      const data = ItemRegistry.getItem(itemId);
      // only consumables are used here; gear is changed in Equip, key items are never used (E7)
      return { label: `${data?.name ?? itemId} x${quantity}`, value: itemId, enabled: data?.type === 'consumable' };
    });
    if (items.length === 0) items.push({ label: 'No items', value: '', enabled: false });
    return items;
  }

  /** `keepIndex`: rebuild with the cursor where it was (clamped), e.g. after using an item. */
  private buildItemMenu(keepIndex = false): void {
    const initialIndex = keepIndex && this.itemMenu ? this.itemMenu.selectedIndex : undefined;
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    this.itemMenu = new Menu({
      items: this.listItems(),
      x: this.itemWindow.contentX,
      y: this.itemWindow.contentY,
      maxVisible: 10,
      initialIndex,
      eventBus: this.game.events,
      onSelect: (item) => this.onItemSelect(item),
      onCancel: () => this.game.scenes.pop(),
    });
    this.itemWindow.addChild(this.itemMenu);
    this.updateDescription();
  }

  private targetRows(): MenuItem[] {
    return targetRows(this.game.party.all);
  }

  /** The party's HP and status, always shown; `asTargets` puts the cursor on it to pick who gets the item. */
  private showParty(asTargets: boolean): void {
    for (const t of this.partyRows) this.partyWindow.removeChild(t);
    this.partyRows = [];
    if (this.targetMenu) this.partyWindow.removeChild(this.targetMenu);
    this.targetMenu = undefined;
    const rows = this.targetRows();
    if (asTargets) {
      this.targetMenu = new Menu({
        items: rows,
        x: this.partyWindow.contentX,
        y: this.partyWindow.contentY,
        initialIndex: initialItemTargetIndex(this.game.party.all, this.selectedItemId), // U8: who needs it
        eventBus: this.game.events,
        onSelect: (item) => this.onTargetSelect(item),
        onCancel: () => this.backToItems(),
      });
      this.partyWindow.addChild(this.targetMenu);
      return;
    }
    rows.forEach((r, i) => {
      const t = new BitmapText({ text: r.label, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      // lined up with the menu's labels (they sit one cursor width in)
      t.position.set(this.partyWindow.contentX + MENU_LINE_HEIGHT, this.partyWindow.contentY + i * MENU_LINE_HEIGHT);
      this.partyRows.push(this.partyWindow.addChild(t));
    });
  }

  update(_dt: number): void {
    if (this.phase === 'confirm') {
      this.confirmBox?.update(this.game.input);
    } else if (this.phase === 'selectItem') {
      const prevIdx = this.itemMenu.selectedIndex;
      this.itemMenu.update(this.game.input);
      if (this.phase === 'selectItem' && this.itemMenu.selectedIndex !== prevIdx) this.updateDescription();
    } else {
      this.targetMenu?.update(this.game.input);
    }
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}

  private updateDescription(): void {
    const item = ItemRegistry.getItem(this.itemMenu.selectedItem.value);
    const gear = item?.type === 'weapon' || item?.type === 'armor';
    this.descWindow.setText(gear ? 'Equip it from the Equip menu.' : item?.description ?? '');
  }

  private onItemSelect(item: MenuItem): void {
    this.selectedItemId = item.value;
    this.resultText.text = '';
    if (ItemEffects.isPartyItem(item.value)) {
      // MS-8: camping only where the map allows it (FF1: the world map); the item is kept
      const exploration = this.game.scenes.get<ExplorationScene>('exploration');
      if (!(exploration?.canCamp() ?? false)) {
        this.resultText.text = "You can't camp here.";
        return;
      }
      this.askToRest(item.value);
      return;
    }
    this.phase = 'selectTarget';
    this.itemMenu.setActive(false);
    this.showParty(true);
  }

  /** Tent and Cabin ask first (E6); Yes rests the party, No keeps the item. */
  private askToRest(itemId: string): void {
    this.phase = 'confirm';
    this.itemMenu.setActive(false);
    this.confirmBox = new ConfirmBox({
      prompt: restPrompt(ItemRegistry.getItem(itemId), itemId),
      eventBus: this.game.events,
      onAnswer: (yes) => {
        this.closeConfirm();
        if (yes) {
          const result = ItemEffects.applyPartyItemEffect(itemId, this.game.party.all, this.game.inventory);
          this.resultText.text = result.message;
        }
        this.backToItems();
      },
    });
    this.container.addChild(this.confirmBox);
  }

  private closeConfirm(): void {
    if (this.confirmBox) this.container.removeChild(this.confirmBox);
    this.confirmBox = undefined;
  }

  private onTargetSelect(item: MenuItem): void {
    const target = this.game.party.get(Number(item.value));
    if (target) this.resultText.text = ItemEffects.applyItemEffect(this.selectedItemId, target, this.game.inventory).message;
    this.backToItems();
  }

  /** Back to the list, keeping its place, with the party's new HP shown. */
  private backToItems(): void {
    this.phase = 'selectItem';
    this.buildItemMenu(true);
    this.showParty(false);
  }
}

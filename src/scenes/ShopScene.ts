import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { QuantitySelectorUI } from '../ui/QuantitySelector.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { buyItems, sellItems, isEquipmentShop } from './shop/shopLists.js';
import { NES_FONT } from '../ui/NESFont.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { ShopDetailPanel, DETAIL_RECT, type ShopRect } from './shop/ShopDetailPanel.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type ShopState = 'choice' | 'buy' | 'sell' | 'quantity';

const ITEM_WINDOW_Y = 288;
/** Ends at y 876, above the help bar (y 900). */
const ITEM_WINDOW_HEIGHT = 588;
const PANEL_GAP = 16;
const INPUT_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel'] as const;

export class ShopScene implements Scene {
  readonly container = new Container();
  private state: ShopState = 'choice';
  private prevState: ShopState = 'choice';
  private isBuying = true;
  private selectedItemId = '';
  private selectedPrice = 0;
  private maxQty = 1;

  private choiceWindow: Window;
  private itemWindow: Window;
  private goldWindow: Window;
  private detail = new ShopDetailPanel();
  private help = new HelpWindow();
  private choiceMenu!: Menu;
  private itemMenu?: Menu;
  private qtySelector?: QuantitySelectorUI;
  private goldText: BitmapText;
  private lastSelectedIndex = -1;
  private itemRect: ShopRect;
  private resultText: BitmapText;

  constructor(private readonly game: Game, private readonly shopId: string) {
    this.choiceWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 300, height: 240 });
    // As wide as the comparison panel below it, so "Bought N <item>." fits under the gold line.
    this.goldWindow = new Window({ x: DETAIL_RECT.x, y: SCREEN_MARGIN, width: DETAIL_RECT.width, height: 100 });
    this.itemRect = { x: SCREEN_MARGIN, y: ITEM_WINDOW_Y, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: ITEM_WINDOW_HEIGHT };
    this.itemWindow = new Window({ ...this.itemRect });
    this.itemWindow.visible = false;

    const line = (dy: number): BitmapText => {
      const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      t.position.set(this.goldWindow.contentX, this.goldWindow.contentY + dy);
      return this.goldWindow.addChild(t);
    };
    this.goldText = line(0);
    this.resultText = line(FONT_SIZE + 4);

    // the detail panel sits below the gold window (top right), so the party's gold stays visible while browsing
    this.help.visible = false;
    this.container.addChild(this.choiceWindow, this.goldWindow, this.itemWindow, this.detail.window, this.help);
  }

  enter(): void {
    this.state = 'choice';
    this.buildChoiceMenu();
    this.updateGold();
  }

  private buildChoiceMenu(): void {
    if (this.choiceMenu) this.choiceWindow.removeChild(this.choiceMenu);
    this.choiceMenu = new Menu({
      items: [
        { label: 'Buy', value: 'buy' },
        { label: 'Sell', value: 'sell' },
        { label: 'Exit', value: 'exit' },
      ],
      x: this.choiceWindow.contentX,
      y: this.choiceWindow.contentY,
      eventBus: this.game.events,
      onSelect: (item) => this.onChoiceSelect(item.value),
      onCancel: () => this.game.scenes.pop(),
    });
    this.choiceWindow.addChild(this.choiceMenu);
  }

  private onChoiceSelect(choice: string): void {
    if (choice === 'exit') {
      this.game.scenes.pop();
      return;
    }
    this.isBuying = choice === 'buy';
    this.state = this.isBuying ? 'buy' : 'sell';
    this.itemWindow.visible = true;
    this.buildItemMenu();
  }

  /** The item list's rectangle (narrowed while the comparison panel is shown). */
  get itemWindowRect(): ShopRect { return { ...this.itemRect }; }
  /** The comparison panel's rectangle. */
  get detailWindowRect(): ShopRect { return { ...DETAIL_RECT }; }
  /** Whether the comparison panel is shown. */
  get detailVisible(): boolean { return this.detail.visible; }
  /** The comparison panel's lines, with their top y inside the panel. */
  get detailLines(): Array<{ text: string; y: number }> { return this.detail.lines; }
  /** The comparison panel's description of the highlighted item. */
  get detailDescription(): string { return this.detail.description.text; }
  /** The help bar's text, or '' while it is hidden. */
  get helpText(): string { return this.help.visible ? this.help.text : ''; }
  /** The line under the gold ("Bought 2 Potion."), or ''. */
  get resultMessage(): string { return this.resultText.text; }
  /** The item list's cursor, or -1 when the list is closed. */
  get itemIndex(): number { return this.itemMenu?.selectedIndex ?? -1; }

  /** `keepIndex`: rebuild with the cursor where it was (clamped), e.g. after a sale. */
  private buildItemMenu(keepIndex = false): void {
    const initialIndex = keepIndex && this.itemMenu ? this.itemMenu.selectedIndex : undefined;
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const items: MenuItem[] = this.isBuying ? buyItems(this.shopId, this.game.party.gold) : sellItems(this.game.inventory);
    if (items.length === 0) items.push({ label: '(Nothing)', value: '', enabled: false });
    this.itemMenu = new Menu({
      items,
      x: this.itemWindow.contentX,
      y: this.itemWindow.contentY,
      maxVisible: 8,
      initialIndex,
      eventBus: this.game.events,
      onSelect: (item) => this.onItemSelect(item),
      onCancel: () => this.closeItemMenu(),
    });
    this.itemWindow.addChild(this.itemMenu);
    this.help.visible = true;
    this.setDetailVisible(this.isBuying && isEquipmentShop(this.shopId));
    this.refreshSelection();
  }

  private setDetailVisible(visible: boolean): void {
    this.detail.visible = visible;
    const width = visible ? DETAIL_RECT.x - PANEL_GAP - SCREEN_MARGIN : GAME_WIDTH - 2 * SCREEN_MARGIN;
    if (width !== this.itemRect.width) {
      this.itemRect = { ...this.itemRect, width };
      this.itemWindow.resize(width, this.itemRect.height);
    }
  }

  private onItemSelect(menuItem: MenuItem): void {
    if (!menuItem.value) return;
    this.selectedItemId = menuItem.value;
    const item = ItemRegistry.getItem(this.selectedItemId);
    if (!item) return;

    if (this.isBuying) {
      this.selectedPrice = item.price;
      this.maxQty = Math.min(99, Math.floor(this.game.party.gold / item.price));
    } else {
      this.selectedPrice = Math.floor(item.price / 2);
      this.maxQty = this.game.inventory.getQuantity(this.selectedItemId);
    }
    if (this.maxQty < 1) return;

    this.prevState = this.state;
    this.state = 'quantity';
    this.showQuantitySelector();
  }

  private showQuantitySelector(): void {
    if (this.qtySelector) this.itemWindow.removeChild(this.qtySelector);
    this.qtySelector = new QuantitySelectorUI(
      this.itemWindow.contentX + 500,
      this.itemWindow.contentY + 500,
      this.maxQty,
      (qty) => this.confirmTransaction(qty),
      () => this.cancelQuantity(),
      this.selectedPrice,
    );
    this.itemWindow.addChild(this.qtySelector);
  }

  private confirmTransaction(qty: number): void {
    const total = this.selectedPrice * qty;
    const name = ItemRegistry.getItem(this.selectedItemId)?.name ?? this.selectedItemId;
    if (this.isBuying) {
      if (this.game.party.spendGold(total)) {
        this.game.inventory.add(this.selectedItemId, qty);
        this.resultText.text = `Bought ${qty} ${name}.`;
      }
    } else {
      if (this.game.inventory.remove(this.selectedItemId, qty)) {
        this.game.party.addGold(total);
        this.resultText.text = `Sold ${qty} ${name}.`;
      }
    }
    this.updateGold();
    this.cancelQuantity();
    this.buildItemMenu(true);
  }

  private cancelQuantity(): void {
    if (this.qtySelector) this.itemWindow.removeChild(this.qtySelector);
    this.qtySelector = undefined;
    this.state = this.prevState;
  }

  private closeItemMenu(): void {
    this.itemWindow.visible = false;
    this.help.visible = false;
    this.setDetailVisible(false);
    if (this.itemMenu) {
      this.itemWindow.removeChild(this.itemMenu);
      this.itemMenu = undefined;
    }
    this.state = 'choice';
  }

  private updateGold(): void {
    this.goldText.text = `Gold: ${this.game.party.gold}G`;
  }

  update(_dt: number): void {
    // The transaction line stays until the next input.
    if (this.resultText.text && INPUT_ACTIONS.some((a) => this.game.input.isJustPressed(a))) {
      this.resultText.text = '';
    }
    if (this.state === 'choice') {
      this.choiceMenu.update(this.game.input);
    } else if (this.state === 'quantity' && this.qtySelector) {
      this.qtySelector.update(this.game.input);
    } else if (this.itemMenu) {
      this.itemMenu.update(this.game.input);
      // cancel closes the list inside update()
      if (this.itemMenu && this.itemMenu.selectedIndex !== this.lastSelectedIndex) this.refreshSelection();
    }
  }

  /** The help bar (any shop) and, while buying equipment, the comparison panel follow the cursor. */
  private refreshSelection(): void {
    this.lastSelectedIndex = this.itemMenu?.selectedIndex ?? -1;
    const value = this.itemMenu?.selectedItem?.value;
    const item = value ? ItemRegistry.getItem(value) : undefined;
    this.help.setText(item?.description ?? '');
    if (this.detail.visible) this.detail.show(item, this.game.party.all);
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}

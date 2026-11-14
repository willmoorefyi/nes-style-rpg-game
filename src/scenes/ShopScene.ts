import { Container, BitmapText } from 'pixi.js';
import type { ItemData, Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { QuantitySelectorUI } from '../ui/QuantitySelector.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { buyItems, sellItems, isEquipmentShop, shopHelp } from './shop/shopLists.js';
import { buy, sell, maxBuyQty, sellPrice, cantCarryMessage } from './shop/shopTransaction.js';
import { CHOICE_RECT, GOLD_RECT, listRect } from './shop/shopLayout.js';
import { NES_FONT } from '../ui/NESFont.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { ShopDetailPanel, DETAIL_RECT, type ShopRect } from './shop/ShopDetailPanel.js';
import { FONT_SIZE } from '../core/LayoutConstants.js';

type ShopState = 'choice' | 'buy' | 'sell' | 'quantity';

const INPUT_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel'] as const;

export class ShopScene implements Scene {
  readonly container = new Container();
  /** The town stays visible around the windows (E5). */
  readonly transparent = true;
  private state: ShopState = 'choice';
  private prevState: ShopState = 'choice';
  private isBuying = true;
  private selectedItem?: ItemData;
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
  private listItems: MenuItem[] = [];
  private itemRect: ShopRect;
  private resultText: BitmapText;

  constructor(private readonly game: Game, private readonly shopId: string) {
    this.choiceWindow = new Window({ ...CHOICE_RECT });
    // As wide as the comparison panel below it, so "Bought N <item>." fits under the gold line.
    this.goldWindow = new Window({ ...GOLD_RECT });
    this.itemRect = listRect(false);
    this.itemWindow = new Window({ ...this.itemRect });
    this.itemWindow.visible = false;

    const line = (dy: number): BitmapText => {
      const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      t.position.set(this.goldWindow.contentX, this.goldWindow.contentY + dy);
      return this.goldWindow.addChild(t);
    };
    this.goldText = line(0);
    this.resultText = line(FONT_SIZE + 4);
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
    this.choiceMenu.setActive(false); // focus moves to the list: the Buy/Sell cursor turns grey (E3)
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
  /** The help bar's text, or '' while it is hidden. */
  get helpText(): string { return this.help.visible ? this.help.text : ''; }
  /** The line under the gold ("Bought 2 Potion."), or ''. */
  get resultMessage(): string { return this.resultText.text; }
  /** The item list's cursor, or -1 when the list is closed. */
  get itemIndex(): number { return this.itemMenu?.selectedIndex ?? -1; }
  /** The item list's row labels, or [] while it is closed. */
  get itemLabels(): string[] { return this.itemMenu ? this.listItems.map((i) => i.label) : []; }
  /** Whether the Buy/Sell/Exit menu has the focus (white cursor). */
  get choiceActive(): boolean { return this.choiceMenu.isActive; }
  /** The quantity picker's maximum, or 0 while it is closed. */
  get quantityMax(): number { return this.qtySelector ? this.maxQty : 0; }

  /** `keepIndex`: rebuild with the cursor where it was (clamped), e.g. after a sale. */
  private buildItemMenu(keepIndex = false): void {
    const initialIndex = keepIndex && this.itemMenu ? this.itemMenu.selectedIndex : undefined;
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const items: MenuItem[] = this.isBuying
      ? buyItems(this.shopId, this.game.party.gold, this.game.inventory)
      : sellItems(this.game.inventory);
    if (items.length === 0) items.push({ label: '(Nothing)', value: '', enabled: false });
    this.listItems = items;
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
    const width = listRect(visible).width;
    if (width !== this.itemRect.width) {
      this.itemRect = { ...this.itemRect, width };
      this.itemWindow.resize(width, this.itemRect.height);
    }
  }

  private onItemSelect(menuItem: MenuItem): void {
    const item = menuItem.value ? ItemRegistry.getItem(menuItem.value) : undefined;
    if (!item) return;
    this.selectedItem = item;
    if (this.isBuying) {
      const space = this.game.inventory.space(item.id);
      // a full bag: say so instead of opening the picker (E1)
      if (space < 1) { this.resultText.text = cantCarryMessage(item.name); return; }
      this.selectedPrice = item.price;
      this.maxQty = maxBuyQty(this.game.party.gold, item.price, space);
    } else {
      this.selectedPrice = sellPrice(item);
      this.maxQty = this.game.inventory.getQuantity(item.id);
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
    if (this.selectedItem) {
      const deal = this.isBuying ? buy : sell;
      this.resultText.text = deal(this.game.party, this.game.inventory, this.selectedItem, qty).message;
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
    this.choiceMenu.setActive(true);
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
    this.help.setText(shopHelp(item, this.game.party.all));
    if (this.detail.visible) this.detail.show(item, this.game.party.all);
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}
}

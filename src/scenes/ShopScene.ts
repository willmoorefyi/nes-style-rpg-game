import type { ItemData, Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { QuantitySelectorUI } from '../ui/QuantitySelector.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { buyItems, sellItems, isEquipmentShop, shopHelp } from './shop/shopLists.js';
import { buy, sell, maxBuyQty, sellPrice } from './shop/shopTransaction.js';
import { ShopSceneView } from './shop/ShopSceneView.js';
import { EquipNowPrompt, offersEquipNow } from './shop/EquipNowPrompt.js';
import { cantCarryText } from '../systems/pickupText.js';

type ShopState = 'choice' | 'buy' | 'sell' | 'quantity' | 'equipNow';

const INPUT_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel'] as const;

export class ShopScene extends ShopSceneView implements Scene {
  private state: ShopState = 'choice';
  private prevState: ShopState = 'choice';
  private isBuying = true;
  private selectedItem?: ItemData;
  private selectedPrice = 0;
  private lastSelectedIndex = -1;

  constructor(private readonly game: Game, private readonly shopId: string) {
    super();
  }

  enter(): void {
    this.state = 'choice';
    this.message = '';
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

  private onItemSelect(menuItem: MenuItem): void {
    const item = menuItem.value ? ItemRegistry.getItem(menuItem.value) : undefined;
    if (!item) return;
    this.selectedItem = item;
    if (this.isBuying) {
      const space = this.game.inventory.space(item.id);
      // a full bag: say so instead of opening the picker (E1)
      if (space < 1) { this.showMessage(cantCarryText(item.id)); return; }
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

  /** Rebuild the list, then show the result (U revision 13); bought gear offers "Equip it now?" (U11). */
  private confirmTransaction(qty: number): void {
    const item = this.selectedItem;
    const result = item ? (this.isBuying ? buy : sell)(this.game.party, this.game.inventory, item, qty) : undefined;
    this.updateGold();
    this.cancelQuantity();
    this.buildItemMenu(true);
    if (result) this.showMessage(result.message);
    if (item && result?.ok && this.isBuying && offersEquipNow(item, this.game.party.all)) this.openEquipPrompt(item, qty);
  }

  private openEquipPrompt(item: ItemData, copies: number): void {
    this.state = 'equipNow';
    this.itemMenu?.setActive(false);
    this.equipPrompt = new EquipNowPrompt({
      item, copies, party: this.game.party.all, inventory: this.game.inventory, eventBus: this.game.events,
      onDone: (message) => {
        if (this.equipPrompt) this.container.removeChild(this.equipPrompt);
        this.equipPrompt = undefined;
        this.state = 'buy';
        this.buildItemMenu(true); // the Have counts and the comparison follow the new gear
        if (message) this.showMessage(message);
      },
    });
    this.container.addChild(this.equipPrompt);
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
    if (this.state === 'equipNow') {
      this.equipPrompt?.update(this.game.input);
      return;
    }
    // The result line stays until the next input, then the help bar describes the item again.
    if (this.message && INPUT_ACTIONS.some((a) => this.game.input.isJustPressed(a))) {
      this.message = '';
      this.refreshSelection();
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

  /** The help bar (any shop, unless a result shows) and, while buying equipment, the comparison panel follow the cursor. */
  private refreshSelection(): void {
    this.lastSelectedIndex = this.itemMenu?.selectedIndex ?? -1;
    const value = this.itemMenu?.selectedItem?.value;
    const item = value ? ItemRegistry.getItem(value) : undefined;
    if (!this.message) this.help.setText(shopHelp(item, this.game.party.all));
    if (this.detail.visible) this.detail.show(item, this.game.party.all);
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}
}

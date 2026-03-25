import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { QuantitySelectorUI } from '../ui/QuantitySelector.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type ShopState = 'choice' | 'buy' | 'sell' | 'quantity';

export class ShopScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private shopId: string;
  private state: ShopState = 'choice';
  private prevState: ShopState = 'choice';
  private isBuying = true;
  private selectedItemId = '';
  private selectedPrice = 0;
  private maxQty = 1;

  private choiceWindow: Window;
  private itemWindow: Window;
  private goldWindow: Window;
  private choiceMenu!: Menu;
  private itemMenu?: Menu;
  private qtySelector?: QuantitySelectorUI;
  private goldText: BitmapText;

  constructor(game: Game, shopId: string) {
    this.game = game;
    this.shopId = shopId;

    this.choiceWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 300, height: 240 });
    this.goldWindow = new Window({ x: GAME_WIDTH - 400, y: SCREEN_MARGIN, width: 376, height: 100 });
    this.itemWindow = new Window({ x: SCREEN_MARGIN, y: 288, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 700 });
    this.itemWindow.visible = false;

    this.goldText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.goldText.position.set(this.goldWindow.contentX, this.goldWindow.contentY);
    this.goldWindow.addChild(this.goldText);

    this.container.addChild(this.choiceWindow, this.goldWindow, this.itemWindow);
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

  private buildItemMenu(): void {
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const items: MenuItem[] = this.isBuying ? this.getBuyItems() : this.getSellItems();
    if (items.length === 0) {
      items.push({ label: '(Nothing)', value: '', enabled: false });
    }
    this.itemMenu = new Menu({
      items,
      x: this.itemWindow.contentX,
      y: this.itemWindow.contentY,
      maxVisible: 8,
      eventBus: this.game.events,
      onSelect: (item) => this.onItemSelect(item),
      onCancel: () => this.closeItemMenu(),
    });
    this.itemWindow.addChild(this.itemMenu);
  }

  private getBuyItems(): MenuItem[] {
    const shop = ShopRegistry.getShop(this.shopId);
    if (!shop) return [];
    return shop.inventory.map(id => {
      const item = ItemRegistry.getItem(id);
      if (!item) return { label: id, value: id, enabled: false };
      const canAfford = this.game.party.gold >= item.price;
      return { label: `${item.name.padEnd(12)}${String(item.price).padStart(5)}G`, value: id, enabled: canAfford };
    });
  }

  private getSellItems(): MenuItem[] {
    const entries = this.game.inventory.getAll()
      .map(({ itemId, quantity }) => ({ item: ItemRegistry.getItem(itemId), itemId, quantity }))
      .filter((e): e is { item: NonNullable<typeof e.item>; itemId: string; quantity: number } => 
        e.item != null && e.item.type !== 'key');
    const maxLen = Math.max(12, ...entries.map(e => e.item.name.length));
    return entries.map(({ item, itemId, quantity }) => {
      const sellPrice = Math.floor(item.price / 2);
      return { label: `${item.name.padEnd(maxLen)}x${quantity} ${String(sellPrice).padStart(4)}G`, value: itemId };
    });
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
      () => this.cancelQuantity()
    );
    this.itemWindow.addChild(this.qtySelector);
  }

  private confirmTransaction(qty: number): void {
    const total = this.selectedPrice * qty;
    if (this.isBuying) {
      if (this.game.party.spendGold(total)) {
        this.game.inventory.add(this.selectedItemId, qty);
      }
    } else {
      if (this.game.inventory.remove(this.selectedItemId, qty)) {
        this.game.party.addGold(total);
      }
    }
    this.updateGold();
    this.cancelQuantity();
    this.buildItemMenu();
  }

  private cancelQuantity(): void {
    if (this.qtySelector) {
      this.itemWindow.removeChild(this.qtySelector);
      this.qtySelector = undefined;
    }
    this.state = this.prevState;
  }

  private closeItemMenu(): void {
    this.itemWindow.visible = false;
    if (this.itemMenu) {
      this.itemWindow.removeChild(this.itemMenu);
      this.itemMenu = undefined;
    }
    this.state = 'choice';
  }

  private updateGold(): void {
    this.goldText.text = `${this.game.party.gold}G`;
  }

  update(_dt: number): void {
    if (this.state === 'choice') {
      this.choiceMenu.update(this.game.input);
    } else if (this.state === 'quantity' && this.qtySelector) {
      this.qtySelector.update(this.game.input);
    } else if (this.itemMenu) {
      this.itemMenu.update(this.game.input);
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}

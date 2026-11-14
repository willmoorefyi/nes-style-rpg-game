import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { QuantitySelectorUI } from '../ui/QuantitySelector.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import { NES_FONT } from '../ui/NESFont.js';
import { slotOf } from '../entities/EquipmentRules.js';
import { compareEquip, hitsSuffix } from './shopComparison.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type ShopState = 'choice' | 'buy' | 'sell' | 'quantity';

/** A window's rectangle on screen (for layout tests). */
export interface ShopRect { x: number; y: number; width: number; height: number }

const ITEM_WINDOW_Y = 288;
const ITEM_WINDOW_HEIGHT = 700;
/** The equipment comparison panel; the item list narrows to end before it while it is shown. */
const DETAIL_RECT: ShopRect = { x: 1200, y: SCREEN_MARGIN + 116, width: 696, height: 584 };
const PANEL_GAP = 16;
const LINE_STEP = FONT_SIZE + 8;
const INPUT_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel'] as const;

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
  private detailWindow: Window;
  private choiceMenu!: Menu;
  private itemMenu?: Menu;
  private qtySelector?: QuantitySelectorUI;
  private goldText: BitmapText;
  private detailTexts: BitmapText[] = [];
  private lastSelectedIndex = -1;
  private itemRect: ShopRect;
  private resultText: BitmapText;

  constructor(game: Game, shopId: string) {
    this.game = game;
    this.shopId = shopId;

    this.choiceWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 300, height: 240 });
    // As wide as the comparison panel below it, so "Bought N <item>." fits under the gold line.
    this.goldWindow = new Window({ x: DETAIL_RECT.x, y: SCREEN_MARGIN, width: DETAIL_RECT.width, height: 100 });
    this.itemRect = { x: SCREEN_MARGIN, y: ITEM_WINDOW_Y, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: ITEM_WINDOW_HEIGHT };
    this.itemWindow = new Window({ ...this.itemRect });
    this.itemWindow.visible = false;

    // below the gold window (top right), so the party's gold stays visible while browsing equipment
    this.detailWindow = new Window({ ...DETAIL_RECT });
    this.detailWindow.visible = false;

    this.goldText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.goldText.position.set(this.goldWindow.contentX, this.goldWindow.contentY);
    this.goldWindow.addChild(this.goldText);
    this.resultText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.resultText.position.set(this.goldWindow.contentX, this.goldWindow.contentY + FONT_SIZE + 4);
    this.goldWindow.addChild(this.resultText);

    this.container.addChild(this.choiceWindow, this.goldWindow, this.itemWindow, this.detailWindow);
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
  get detailVisible(): boolean { return this.detailWindow.visible; }
  /** The comparison panel's lines, with their top y inside the panel. */
  get detailLines(): Array<{ text: string; y: number }> {
    return this.detailTexts.map((t) => ({ text: t.text, y: t.position.y }));
  }
  /** The line under the gold ("Bought 2 Potion."), or ''. */
  get resultMessage(): string { return this.resultText.text; }
  /** The item list's cursor, or -1 when the list is closed. */
  get itemIndex(): number { return this.itemMenu?.selectedIndex ?? -1; }

  /** `keepIndex`: rebuild with the cursor where it was (clamped), e.g. after a sale. */
  private buildItemMenu(keepIndex = false): void {
    const initialIndex = keepIndex && this.itemMenu ? this.itemMenu.selectedIndex : undefined;
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
      initialIndex,
      eventBus: this.game.events,
      onSelect: (item) => this.onItemSelect(item),
      onCancel: () => this.closeItemMenu(),
    });
    this.itemWindow.addChild(this.itemMenu);
    this.lastSelectedIndex = -1;
    this.setDetailVisible(this.isBuying && this.isEquipmentShop());
  }

  private setDetailVisible(visible: boolean): void {
    this.detailWindow.visible = visible;
    const width = visible ? DETAIL_RECT.x - PANEL_GAP - SCREEN_MARGIN : GAME_WIDTH - 2 * SCREEN_MARGIN;
    if (width !== this.itemRect.width) {
      this.itemRect = { ...this.itemRect, width };
      this.itemWindow.resize(width, this.itemRect.height);
    }
  }

  private isEquipmentShop(): boolean {
    const shop = ShopRegistry.getShop(this.shopId);
    return shop?.type === 'weapon' || shop?.type === 'armor';
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
    if (this.qtySelector) {
      this.itemWindow.removeChild(this.qtySelector);
      this.qtySelector = undefined;
    }
    this.state = this.prevState;
  }

  private closeItemMenu(): void {
    this.itemWindow.visible = false;
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
      if (this.detailWindow.visible && this.itemMenu.selectedIndex !== this.lastSelectedIndex) {
        this.lastSelectedIndex = this.itemMenu.selectedIndex;
        this.updateDetailPanel();
      }
    }
  }

  private updateDetailPanel(): void {
    for (const t of this.detailTexts) this.detailWindow.removeChild(t);
    this.detailTexts = [];

    if (!this.itemMenu) return;
    const menuItem = this.itemMenu.selectedItem;
    if (!menuItem?.value) return;
    const item = ItemRegistry.getItem(menuItem.value);
    if (!item) return;

    const slot = slotOf(item);
    if (!slot) return;
    const isWeapon = item.type === 'weapon';
    const statLabel = isWeapon ? 'ATK' : 'DEF';
    const newStat = (isWeapon ? item.stats.attack : item.stats.defense) ?? 0;

    const cx = this.detailWindow.contentX;
    const cy = this.detailWindow.contentY;
    let y = cy;

    const addLine = (text: string, color: number = 0xffffff): void => {
      const bt = new BitmapText({ text, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: color } });
      bt.position.set(cx, y);
      this.detailWindow.addChild(bt);
      this.detailTexts.push(bt);
      y += LINE_STEP;
    };

    addLine(`${item.name}  ${statLabel}: ${newStat}`);
    y += 8;

    // One line per member: `NAME  ATK cur->new  +d` (MS-5), so four members fit the panel.
    const nameWidth = Math.max(0, ...this.game.party.all.map((c) => c.name.length));
    for (const char of this.game.party.all) {
      const name = char.name.padEnd(nameWidth);
      // same rule as EquipScene: members whose class can't use the item get no +/- value
      if (!char.canEquip(item)) {
        addLine(`${name}  n/a`, 0x808080);
        continue;
      }
      // the battle numbers with the item and without it (a Monk's bare hands can beat a weapon: negative)
      const cmp = compareEquip(char, item, slot);
      const diff = cmp.diff;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff > 0 ? 0x00ff00 : diff < 0 ? 0xff0000 : 0xffffff;
      const now = `${cmp.now}${hitsSuffix(cmp, cmp.nowHits)}`;
      const next = `${cmp.next}${hitsSuffix(cmp, cmp.nextHits)}`;
      addLine(`${name}  ${cmp.label} ${now}->${next}  ${diffStr}`, diffColor);
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}

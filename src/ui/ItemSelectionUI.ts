import { Container } from 'pixi.js';
import type { Inventory } from '../entities/Inventory.js';
import type { EventBus } from '../core/EventBus.js';
import type { InputManager } from '../core/InputManager.js';
import { Menu, type MenuItem } from './Menu.js';
import { ItemRegistry } from '../data/ItemRegistry.js';

export interface ItemSelectionResult {
  itemId: string;
  targetName: string;
}

export interface ItemSelectionConfig {
  inventory: Inventory;
  partyMembers: Array<{ name: string; id: string }>;
  contentX: number;
  contentY: number;
  eventBus?: EventBus;
  onSelect: (result: ItemSelectionResult) => void;
  onCancel: () => void;
  onNeedTarget?: (itemId: string) => void;
  /** Only consumables this accepts are listed (battle leaves out the camp items, BA-4); default: all. */
  isUsable?: (itemId: string) => boolean;
  /**
   * How many of an item can still be picked (B5: battle passes the inventory count minus the uses already queued this
   * round); it drives the "x N" label, and an item at 0 is not listed. Default: the inventory count.
   */
  quantityOf?: (itemId: string) => number;
  /** Worn items that cast a spell (pass EQ 7.3), listed after the consumables as "<name> (worn)". */
  worn?: string[];
  /** A worn row was picked. */
  onWorn?: (itemId: string) => void;
}

/** The value of a worn row in the menu (consumables use their item id). */
const WORN = 'worn:';

export class ItemSelectionUI extends Container {
  private config: ItemSelectionConfig;
  private itemMenu: Menu | null = null;

  constructor(config: ItemSelectionConfig) {
    super();
    this.config = config;
    this.showItemMenu();
  }

  private showItemMenu(): void {
    const { contentX, contentY, eventBus, onCancel } = this.config;
    const consumables = this.listedItems();
    const worn = this.config.worn ?? [];

    if (consumables.length === 0 && worn.length === 0) {
      onCancel();
      return;
    }

    const items: MenuItem[] = [...consumables.map(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return { label: `${item?.name ?? entry.itemId} x${entry.quantity}`, value: entry.itemId };
    }), ...worn.map((id) => ({ label: `${ItemRegistry.getItem(id)?.name ?? id} (worn)`, value: `${WORN}${id}` }))];

    this.itemMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      maxVisible: 4,
      onSelect: (item) => {
        if (item.value.startsWith(WORN)) {
          this.config.onWorn?.(item.value.slice(WORN.length));
          this.cleanup();
        } else if (this.config.onNeedTarget) {
          this.config.onNeedTarget(item.value);
        } else {
          // Fallback: no target
          this.config.onSelect({ itemId: item.value, targetName: '' });
          this.cleanup();
        }
      },
      onCancel: () => {
        this.cleanup();
        onCancel();
      },
      eventBus,
    });
    this.addChild(this.itemMenu);
  }

  private cleanup(): void {
    if (this.itemMenu) this.removeChild(this.itemMenu);
    this.itemMenu = null;
  }

  update(input: InputManager): void {
    this.itemMenu?.update(input);
  }

  hasNoItems(): boolean {
    return this.listedItems().length === 0 && (this.config.worn ?? []).length === 0;
  }

  /** The item ids in the menu, in order (worn rows last, as `worn:<id>`). */
  get listedItemIds(): string[] {
    return [...this.listedItems().map(entry => entry.itemId), ...(this.config.worn ?? []).map((id) => `${WORN}${id}`)];
  }

  private listedItems(): Array<{ itemId: string; quantity: number }> {
    const { inventory, isUsable, quantityOf } = this.config;
    return inventory.getAll()
      .map(entry => ({ itemId: entry.itemId, quantity: quantityOf ? quantityOf(entry.itemId) : entry.quantity }))
      .filter(entry => {
        const item = ItemRegistry.getItem(entry.itemId);
        return entry.quantity > 0 && item?.type === 'consumable' && (isUsable?.(entry.itemId) ?? true);
      });
  }
}

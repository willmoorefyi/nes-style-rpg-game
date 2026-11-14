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
}

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

    if (consumables.length === 0) {
      onCancel();
      return;
    }

    const items: MenuItem[] = consumables.map(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return { label: `${item?.name ?? entry.itemId} x${entry.quantity}`, value: entry.itemId };
    });

    this.itemMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      maxVisible: 4,
      onSelect: (item) => {
        if (this.config.onNeedTarget) {
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
    return this.listedItems().length === 0;
  }

  /** The item ids in the menu, in order. */
  get listedItemIds(): string[] {
    return this.listedItems().map(entry => entry.itemId);
  }

  private listedItems(): Array<{ itemId: string; quantity: number }> {
    const { inventory, isUsable } = this.config;
    return inventory.getAll().filter(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return item?.type === 'consumable' && (isUsable?.(entry.itemId) ?? true);
    });
  }
}

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
    const { inventory, contentX, contentY, eventBus, onCancel } = this.config;
    const consumables = inventory.getAll().filter(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return item?.type === 'consumable';
    });

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
    const { inventory } = this.config;
    return inventory.getAll().filter(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return item?.type === 'consumable';
    }).length === 0;
  }
}

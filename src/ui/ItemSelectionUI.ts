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
}

type ItemUIState = 'item' | 'target';

export class ItemSelectionUI extends Container {
  private config: ItemSelectionConfig;
  private state: ItemUIState = 'item';
  private itemMenu: Menu | null = null;
  private targetMenu: Menu | null = null;
  private selectedItemId: string | null = null;

  /** Whether the UI is currently in target selection mode */
  get isTargeting(): boolean { return this.state === 'target' && this.targetMenu !== null; }
  /** Index of the currently highlighted target, or -1 */
  get targetIndex(): number { return this.targetMenu?.selectedIndex ?? -1; }
  /** Items always target party members */
  get isTargetingParty(): boolean { return true; }

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
        this.selectedItemId = item.value;
        this.showTargetMenu();
      },
      onCancel: () => {
        this.cleanup();
        onCancel();
      },
      eventBus,
    });
    this.addChild(this.itemMenu);
    this.state = 'item';
  }

  private showTargetMenu(): void {
    const { partyMembers, contentX, contentY, eventBus } = this.config;
    const items: MenuItem[] = partyMembers.map(c => ({ label: c.name, value: c.id }));

    this.targetMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      onSelect: (item) => this.submitResult(item.value),
      onCancel: () => {
        this.hideTargetMenu();
        this.state = 'item';
      },
      eventBus,
    });
    this.addChild(this.targetMenu);
    if (this.itemMenu) this.itemMenu.visible = false;
    this.state = 'target';
  }

  private hideTargetMenu(): void {
    if (this.targetMenu) {
      this.removeChild(this.targetMenu);
      this.targetMenu = null;
    }
    if (this.itemMenu) this.itemMenu.visible = true;
  }

  private submitResult(targetName: string): void {
    if (this.selectedItemId) {
      this.config.onSelect({ itemId: this.selectedItemId, targetName });
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.targetMenu) this.removeChild(this.targetMenu);
    if (this.itemMenu) this.removeChild(this.itemMenu);
    this.targetMenu = null;
    this.itemMenu = null;
  }

  update(input: InputManager): void {
    switch (this.state) {
      case 'item':
        this.itemMenu?.update(input);
        break;
      case 'target':
        this.targetMenu?.update(input);
        break;
    }
  }

  hasNoItems(): boolean {
    const { inventory } = this.config;
    return inventory.getAll().filter(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return item?.type === 'consumable';
    }).length === 0;
  }
}

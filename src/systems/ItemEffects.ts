import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { ItemRegistry } from '../data/ItemRegistry.js';

export interface ItemEffectResult {
  success: boolean;
  message: string;
}

export class ItemEffects {
  static applyItemEffect(itemId: string, target: Character, inventory: Inventory): ItemEffectResult {
    const item = ItemRegistry.getItem(itemId);
    if (!item) return { success: false, message: 'Item not found' };
    if (item.type === 'key') return { success: false, message: 'Cannot use this item' };
    if (item.type !== 'consumable') return { success: false, message: 'Cannot use this item' };
    if (!inventory.has(itemId)) return { success: false, message: 'Item not in inventory' };

    let result: ItemEffectResult;
    switch (itemId) {
      case 'potion':
        result = this.heal(target, 30);
        break;
      case 'hi_potion':
        result = this.heal(target, 150);
        break;
      case 'ether':
        result = this.restoreCharges(target);
        break;
      case 'antidote':
        target.statusTracker.remove('poison');
        result = { success: true, message: `${target.name} is cured of poison` };
        break;
      case 'phoenix_down':
        result = this.revive(target);
        break;
      default:
        return { success: false, message: 'Cannot use this item' };
    }

    if (result.success) inventory.remove(itemId);
    return result;
  }

  private static heal(target: Character, amount: number): ItemEffectResult {
    if (target.currentHp <= 0) return { success: false, message: `${target.name} is KO'd` };
    if (target.currentHp >= target.maxHp) return { success: false, message: `${target.name} is already at full HP` };
    target.currentHp += amount;
    return { success: true, message: `${target.name} recovered ${amount} HP` };
  }

  private static restoreCharges(target: Character): ItemEffectResult {
    for (let level = 1; level <= 8; level++) {
      target.setSpellCharges(level, target.getSpellCharges(level) + 1);
    }
    return { success: true, message: `${target.name}'s spell charges restored` };
  }

  private static revive(target: Character): ItemEffectResult {
    if (target.currentHp > 0 && !target.statusTracker.has('death')) return { success: false, message: `${target.name} is not KO'd` };
    target.statusTracker.remove('death');
    target.currentHp = 1;
    return { success: true, message: `${target.name} was revived` };
  }
}
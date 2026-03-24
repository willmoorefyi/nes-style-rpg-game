import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { ItemRegistry } from '../data/ItemRegistry.js';

export interface ItemEffectResult {
  success: boolean;
  message: string;
}

export class ItemEffects {
  /** Check if an item is a party-wide consumable (skip target selection) */
  static isPartyItem(itemId: string): boolean {
    return itemId === 'tent' || itemId === 'cabin';
  }

  /** Apply a party-wide item effect (tent/cabin). Consumes the item. */
  static applyPartyItemEffect(
    itemId: string,
    party: readonly Character[],
    inventory: Inventory
  ): ItemEffectResult {
    if (!inventory.has(itemId)) return { success: false, message: 'Item not in inventory' };

    if (itemId === 'tent') {
      for (const member of party) {
        member.currentHp = Math.min(member.maxHp, member.currentHp + Math.floor(member.maxHp * 0.5));
        for (let lvl = 1; lvl <= 8; lvl++) {
          const max = member.getMaxCharges(lvl);
          const cur = member.getSpellCharges(lvl);
          member.setSpellCharges(lvl, Math.min(max, cur + Math.ceil(max / 2)));
        }
      }
      inventory.remove(itemId);
      return { success: true, message: 'The party rests in the tent.' };
    }

    if (itemId === 'cabin') {
      for (const member of party) {
        member.currentHp = member.maxHp;
        for (let lvl = 1; lvl <= 8; lvl++) {
          member.setSpellCharges(lvl, member.getMaxCharges(lvl));
        }
      }
      inventory.remove(itemId);
      return { success: true, message: 'The party rests in the cabin.' };
    }

    return { success: false, message: 'Cannot use this item' };
  }

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
      case 'soft':
        if (target.statusTracker.has('stone')) {
          target.statusTracker.remove('stone');
          result = { success: true, message: `${target.name} is no longer petrified` };
        } else {
          result = { success: false, message: `${target.name} is not petrified` };
        }
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
    // WP5 fix: cap charges at max when restoring
    for (let level = 1; level <= 8; level++) {
      const current = target.getSpellCharges(level);
      const max = target.getMaxCharges(level);
      target.setSpellCharges(level, Math.min(max, current + 1));
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

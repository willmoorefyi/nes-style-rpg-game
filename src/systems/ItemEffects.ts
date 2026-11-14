import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { isFallen } from './FieldSpellEffects.js';

export interface ItemEffectResult {
  success: boolean;
  message: string;
}

export class ItemEffects {
  /** Check if an item is a party-wide consumable (skip target selection) */
  static isPartyItem(itemId: string): boolean {
    return itemId === 'tent' || itemId === 'cabin';
  }

  /** Check if an item revives a fallen member (its targets are the KO'd, not the living) */
  static isReviveItem(itemId: string): boolean {
    return itemId === 'phoenix_down';
  }

  /** Apply a party-wide item effect (tent/cabin). Consumes the item. */
  static applyPartyItemEffect(
    itemId: string,
    party: readonly Character[],
    inventory: Inventory
  ): ItemEffectResult {
    if (!inventory.has(itemId)) return { success: false, message: 'Item not in inventory' };

    // resting doesn't revive the fallen (that's Phoenix Down's job, as in FF1): they get no HP or charges
    const resting = party.filter((m) => !isFallen(m));
    if (itemId === 'tent') {
      for (const member of resting) {
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
      for (const member of resting) {
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
      case 'hi_potion': {
        const amount = item.stats.hp;
        if (amount === undefined || amount <= 0) {
          console.error(`ItemEffects: ${itemId} has no stats.hp heal amount in items.yaml`);
          return { success: false, message: 'Cannot use this item' };
        }
        result = this.heal(target, amount);
        break;
      }
      case 'ether':
        result = this.restoreCharges(target);
        break;
      case 'antidote':
        if (target.statusTracker.has('poison')) {
          target.statusTracker.remove('poison');
          result = { success: true, message: `${target.name} is cured of poison` };
        } else {
          result = { success: false, message: `${target.name} is not poisoned.` };
        }
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
    const before = target.currentHp;
    target.currentHp += amount; // the setter clamps at maxHp
    return { success: true, message: `${target.name} recovers ${target.currentHp - before} HP` };
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
    return { success: true, message: `${target.name} is revived` };
  }
}

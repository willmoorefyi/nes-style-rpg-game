import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';

export interface SpellPurse {
  readonly gold: number;
  spendGold(amount: number): boolean;
}

export interface SpellPurchaseResult {
  ok: boolean;
  message: string;
}

/**
 * Teach `spell` to `member` for `price` gold. Gold is only taken once the spell is learned, so a
 * full spell level (or a spell already known) costs nothing.
 */
export function buySpell(purse: SpellPurse, member: Character, spell: SpellData, price: number): SpellPurchaseResult {
  if (member.getLearnedSpells().some((s) => s.spellId === spell.id)) {
    return { ok: false, message: `${member.name} already knows ${spell.name}.` };
  }
  if (purse.gold < price) return { ok: false, message: 'Not enough gold.' };
  if (!member.learnSpell(spell.id, spell.level)) {
    return { ok: false, message: `No room for level ${spell.level} spells.` };
  }
  if (!purse.spendGold(price)) {
    // cannot happen after the gold check above; logged so a future change can't make it silent
    console.error(`buySpell: could not take ${price}G after ${member.name} learned ${spell.id}`);
  }
  return { ok: true, message: `${member.name} learned ${spell.name}!` };
}

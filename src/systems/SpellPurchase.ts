import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';

/** FF1 spell prices by spell level 1-8 (fix plan T4 §2.2). */
export const SPELL_PRICE_BY_LEVEL: readonly number[] = [100, 400, 1500, 4000, 8000, 20000, 45000, 60000];

/** A spell's shop price: its own `price` when set, else the FF1 per-level price. */
export function spellPrice(spell: SpellData): number {
  if (spell.price !== undefined) return spell.price;
  const byLevel = SPELL_PRICE_BY_LEVEL[spell.level - 1];
  if (byLevel === undefined) {
    console.warn(`spellPrice: ${spell.id} has no price for spell level ${spell.level}`);
    return SPELL_PRICE_BY_LEVEL[SPELL_PRICE_BY_LEVEL.length - 1];
  }
  return byLevel;
}

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

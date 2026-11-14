import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';
import type { StatusEffect } from '../battle/StatusEffects.js';
import { healAmount } from '../battle/DamageFormula.js';

/** Spell effects usable from the field menu */
export const FIELD_VALID_EFFECTS = ['heal', 'cure_poison', 'cure_blind', 'cure_silence', 'revive'];

export interface FieldSpellResult {
  /** True if the spell did something; only then is a charge spent. */
  used: boolean;
  messages: string[];
}

const NO_EFFECT: FieldSpellResult = { used: false, messages: ['No effect.'] };

const CURES: Record<string, { status: StatusEffect; text: string }> = {
  cure_poison: { status: 'poison', text: 'is cured of poison' },
  cure_blind: { status: 'blind', text: 'can see again' },
  cure_silence: { status: 'silence', text: 'can speak again' },
};

/** A fallen member: KO'd (0 HP) or carrying the death status. */
export function isFallen(c: Character): boolean {
  return c.currentHp <= 0 || c.statusTracker.has('death');
}

export function isFieldSpell(spell: SpellData): boolean {
  return spell.type === 'white' && FIELD_VALID_EFFECTS.includes(spell.effect);
}

/**
 * Apply a field spell. Does not spend the charge: the caller spends it only when `used` is true,
 * so a CURE on a full-HP ally ("No effect.") costs nothing. The caster's stats do not change the
 * amount (FF1: INT has no effect), so `_caster` is only the caller's record of who cast it.
 */
export function castFieldSpell(
  spell: SpellData,
  _caster: Character,
  targets: readonly Character[],
  rng: () => number = Math.random,
): FieldSpellResult {
  if (spell.effect === 'heal') return heal(spell, targets, rng);
  if (spell.effect === 'revive') {
    const fallen = targets.filter(isFallen);
    if (fallen.length === 0) return NO_EFFECT;
    for (const t of fallen) {
      t.statusTracker.remove('death');
      t.currentHp = 1;
    }
    return { used: true, messages: fallen.map((t) => `${t.name} is revived`) };
  }
  const cure = CURES[spell.effect];
  if (!cure) return NO_EFFECT;
  const cured = targets.filter((t) => !isFallen(t) && t.statusTracker.has(cure.status));
  if (cured.length === 0) return NO_EFFECT;
  for (const t of cured) t.statusTracker.remove(cure.status);
  return { used: true, messages: cured.map((t) => `${t.name} ${cure.text}`) };
}

function heal(spell: SpellData, targets: readonly Character[], rng: () => number): FieldSpellResult {
  // the fallen are not healed (that is Phoenix Down's or LIFE's job), and a full-HP ally gains nothing
  const living = targets.filter((t) => !isFallen(t) && t.currentHp < t.maxHp);
  if (living.length === 0) return NO_EFFECT;
  const messages: string[] = [];
  for (const t of living) {
    const before = t.currentHp;
    t.currentHp = before + healAmount(spell, rng);
    messages.push(`${t.name} recovers ${t.currentHp - before} HP`);
  }
  return { used: true, messages };
}

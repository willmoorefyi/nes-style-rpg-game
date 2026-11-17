import type { Character } from '../entities/Character.js';
import type { SpellData } from '../types/index.js';
import type { StatusEffect } from '../battle/StatusEffects.js';
import { healAmount } from '../battle/DamageFormula.js';

/** White-magic effects usable from the field menu (CUR4's `heal_full` since W1-B). */
export const FIELD_VALID_EFFECTS = ['heal', 'cure_poison', 'cure_blind', 'cure_silence', 'revive', 'heal_full'];
/** The travel spells' effects (QUEST 4.1: spell ids `exit` and `warp`; W1-G adds the records, W1-B plays them). */
export const FIELD_TRAVEL_EFFECTS = ['field_exit', 'field_warp'] as const;
export type FieldTravelEffect = (typeof FIELD_TRAVEL_EFFECTS)[number];

/** EXIT (white) and WARP (black): cast from the field menu, they move the party (systems/fieldTravel.ts). */
export function isTravelSpell(spell: Pick<SpellData, 'effect'>): boolean {
  return (FIELD_TRAVEL_EFFECTS as readonly string[]).includes(spell.effect);
}

/** The statuses CUR4 (`heal_full`) cures in the field, as in battle (spellEffectsLate: every status but death). */
const FULL_CURES: readonly StatusEffect[] = ['poison', 'blind', 'silence', 'sleep', 'stun', 'stone', 'fear'];

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

/** A spell the field menu lists: the white healing and cure effects, plus the travel spells of either school. */
export function isFieldSpell(spell: SpellData): boolean {
  return (spell.type === 'white' && FIELD_VALID_EFFECTS.includes(spell.effect)) || isTravelSpell(spell);
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
  if (spell.effect === 'heal_full') return healFull(targets);
  if (spell.effect === 'revive') {
    const fallen = targets.filter(isFallen);
    if (fallen.length === 0) return NO_EFFECT;
    for (const t of fallen) {
      t.statusTracker.remove('death');
      // LIFE (power 0) revives at 1 HP; LIF2 (power 100) to power % of max HP, a full revive (W1-G)
      const power = spell.power ?? 0;
      t.currentHp = power > 0 ? Math.max(1, Math.floor((t.maxHp * power) / 100)) : 1;
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

/** CUR4: the living targets to full HP and free of every status but death; the fallen are not helped. */
function healFull(targets: readonly Character[]): FieldSpellResult {
  const messages: string[] = [];
  for (const t of targets) {
    if (isFallen(t)) continue;
    const cured = FULL_CURES.filter((s) => t.statusTracker.has(s));
    if (t.currentHp >= t.maxHp && cured.length === 0) continue;
    const before = t.currentHp;
    t.currentHp = t.maxHp;
    for (const s of cured) t.statusTracker.remove(s);
    messages.push(t.currentHp > before ? `${t.name} recovers ${t.currentHp - before} HP` : `${t.name} is cured`);
  }
  return messages.length > 0 ? { used: true, messages } : NO_EFFECT;
}

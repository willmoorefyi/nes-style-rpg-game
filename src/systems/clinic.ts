/**
 * The clinic (docs/WORLD_PLAN.md GAP-16; W1-B): an NPC with `action: clinic` and `clinicPrice: n` revives each fallen
 * member to 1 HP for n x the member's level in gold, after the player confirms. Pure logic; `ClinicScene` asks the
 * question and `FieldNpcActions` opens it.
 */
import type { Character } from '../entities/Character.js';
import { isFallen } from './FieldSpellEffects.js';

/** A clinic NPC's default price per level when its `clinicPrice` is missing. */
export const DEFAULT_CLINIC_PRICE = 10;

export interface ClinicQuote {
  fallen: Character[];
  /** The gold reviving all of them costs. */
  cost: number;
}

/** Who the clinic would revive and what it costs (`price` gold per level of each fallen member). */
export function clinicQuote(party: readonly Character[], price: number): ClinicQuote {
  const fallen = party.filter(isFallen);
  return { fallen, cost: fallen.reduce((sum, c) => sum + Math.max(0, price) * c.level, 0) };
}

/** The question the clinic asks before it revives. */
export function clinicPrompt(quote: ClinicQuote): string {
  const names = quote.fallen.map((c) => c.name).join(', ');
  return `Revive ${names} for ${quote.cost} G?`;
}

/** The party side of a clinic visit: its members and its gold. */
export interface ClinicParty {
  readonly all: readonly Character[];
  spendGold(amount: number): boolean;
}

/**
 * Revive every fallen member to 1 HP and take the gold, all or nothing. Returns the lines to show: who was revived,
 * or why nothing happened (nobody fallen, not enough gold).
 */
export function clinicRevive(party: ClinicParty, price: number): { revived: boolean; lines: string[] } {
  const quote = clinicQuote(party.all, price);
  if (quote.fallen.length === 0) return { revived: false, lines: ['Nobody here needs reviving.'] };
  if (!party.spendGold(quote.cost)) return { revived: false, lines: ["You don't have enough gold."] };
  for (const c of quote.fallen) {
    c.statusTracker.remove('death');
    c.currentHp = 1;
  }
  return { revived: true, lines: quote.fallen.map((c) => `${c.name} is revived!`) };
}

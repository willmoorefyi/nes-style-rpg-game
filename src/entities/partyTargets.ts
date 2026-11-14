/**
 * Where a party-target cursor starts (U8): shared by battle (`BattleFieldTargeting`) and the field menus
 * (item and magic). Pure: no rendering, no scene state.
 */
import type { Character } from './Character.js';
import type { StatusEffect, StatusTracker } from '../battle/StatusEffects.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ItemEffects } from '../systems/ItemEffects.js';

/** What a party target is chosen for. */
export type TargetKind = 'heal' | 'revive' | 'cure_status' | 'other';

/** The fields the helpers read (a `Character` fits). */
export type HpMember = Pick<Character, 'currentHp' | 'maxHp'>;
export type TargetMember = HpMember & { readonly statusTracker: Pick<StatusTracker, 'has'> };

/** The status each curing item removes (U revision 10). */
const ITEM_CURES: Readonly<Record<string, StatusEffect>> = { antidote: 'poison', soft: 'stone' };

/** The living member with the lowest HP / max (the first on a tie), or -1 when everyone has fallen. */
export function mostHurtIndex(party: readonly HpMember[]): number {
  let best = -1;
  party.forEach((c, i) => {
    if (c.currentHp <= 0) return;
    if (best < 0 || c.currentHp / c.maxHp < party[best].currentHp / party[best].maxHp) best = i;
  });
  return best;
}

/** The first fallen member (HP 0 or `death`), or -1. */
export function firstFallenIndex(party: readonly TargetMember[]): number {
  return party.findIndex((c) => c.currentHp <= 0 || c.statusTracker.has('death'));
}

/**
 * The index a target cursor starts on: `heal` the most hurt living member, `revive` the first fallen one,
 * `cure_status` the first member with `status`; otherwise (or when no member fits) 0.
 */
export function initialTargetIndex(party: readonly TargetMember[], kind: TargetKind, status?: StatusEffect): number {
  let i = -1;
  if (kind === 'heal') i = mostHurtIndex(party);
  else if (kind === 'revive') i = firstFallenIndex(party);
  else if (kind === 'cure_status' && status) i = party.findIndex((c) => c.statusTracker.has(status));
  return i >= 0 ? i : 0;
}

/**
 * The target kind of an item (U revision 10): `stats.hp > 0` heals, `ItemEffects.isReviveItem` revives,
 * antidote / soft cure poison / stone; anything else is `other`.
 */
export function itemTargetKind(itemId: string): { kind: TargetKind; status?: StatusEffect } {
  if (ItemEffects.isReviveItem(itemId)) return { kind: 'revive' };
  const cures = ITEM_CURES[itemId];
  if (cures) return { kind: 'cure_status', status: cures };
  if ((ItemRegistry.getItem(itemId)?.stats.hp ?? 0) > 0) return { kind: 'heal' };
  return { kind: 'other' };
}

/** `initialTargetIndex` for using `itemId` on the party. */
export function initialItemTargetIndex(party: readonly TargetMember[], itemId: string): number {
  const { kind, status } = itemTargetKind(itemId);
  return initialTargetIndex(party, kind, status);
}

import type { Character } from '../entities/Character.js';
import type { ClassGrowth, EnemyData, EquipmentSlot, ItemData } from '../types/index.js';
import type { EnemyInstance } from './BattleStateMachine.js';

/**
 * FF1 combat numbers for party members and enemies (pure; no PixiJS). The battle formulas in
 * `DamageFormula` read these. Missing data fields default to 0, except enemy hits (1) and crit (1).
 */

const ARMOUR_SLOTS: EquipmentSlot[] = ['armor', 'shield', 'helmet', 'hands'];
/** FF1 base evade before agility and armour weight. */
export const BASE_EVADE = 48;

function grown(g: ClassGrowth | undefined, level: number): number {
  return g ? g.base + g.growth * (level - 1) : 0;
}

/**
 * What the attack, hit and absorb numbers read from a party member: a `Character`, or a what-if view of one with
 * different equipment (`withEquipped`, for the shop comparison).
 */
export type MemberView = Pick<Character, 'baseStats' | 'level' | 'classData' | 'getEquipped' | 'getBuffAmount'>;

/** `c` with `item` in `slot` (null: the slot emptied); `c` itself is not changed. */
export function withEquipped(c: MemberView, slot: EquipmentSlot, item: ItemData | null): MemberView {
  return {
    baseStats: c.baseStats,
    level: c.level,
    classData: c.classData,
    getEquipped: (s: EquipmentSlot) => (s === slot ? item : c.getEquipped(s)),
    getBuffAmount: (stat: string) => c.getBuffAmount(stat),
  };
}

/** A class with `unarmedMartial: true` in classes.yaml (FF1 Black Belt / Master). */
function isMartial(c: MemberView): boolean {
  return c.classData.unarmedMartial === true;
}

/** A Monk or Master with no weapon. */
export function isUnarmedMartial(c: MemberView): boolean {
  return isMartial(c) && !c.getEquipped('weapon');
}

/** Weapon attack + ⌊STR/2⌋ + the TMPR buff; an unarmed Monk/Master gets ⌊STR/2⌋ + 2 × level. */
export function partyAttack(c: MemberView): number {
  const halfStr = Math.floor(c.baseStats.strength / 2);
  const weapon = c.getEquipped('weapon');
  const base = isUnarmedMartial(c) ? halfStr + 2 * c.level : halfStr + (weapon?.stats.attack ?? 0);
  return base + c.getBuffAmount('attack');
}

/** Class base + growth × (level − 1) + the weapon's `hit`. */
export function partyHitPercent(c: MemberView): number {
  return grown(c.classData.hitPercent, c.level) + (c.getEquipped('weapon')?.hit ?? 0);
}

/** 1 + ⌊hit% / 32⌋, doubled for an unarmed Monk/Master. */
export function partyHits(c: MemberView): number {
  const hits = 1 + Math.floor(Math.max(0, partyHitPercent(c)) / 32);
  return isUnarmedMartial(c) ? hits * 2 : hits;
}

function armourSum(c: MemberView, field: 'weight' | 'defense'): number {
  let sum = 0;
  for (const slot of ARMOUR_SLOTS) {
    const item = c.getEquipped(slot);
    if (!item) continue;
    sum += field === 'weight' ? item.weight ?? 0 : item.stats.defense ?? 0;
  }
  return sum;
}

/** 48 + AGI − Σ armour weight + the evade buff (RUSE / INVS). */
export function partyEvade(c: Character): number {
  return BASE_EVADE + c.stats.agility - armourSum(c, 'weight') + c.getBuffAmount('evade');
}

/** Σ armour defense + FOG; a Monk/Master without body armour gets at least their level. */
export function partyAbsorb(c: MemberView): number {
  const absorb = armourSum(c, 'defense') + c.getBuffAmount('defense');
  return isMartial(c) && !c.getEquipped('armor') ? Math.max(absorb, c.level) : absorb;
}

/** Class `magicDefense` base + growth × (level − 1). */
export function partyMagicDefense(c: Character): number {
  return grown(c.classData.magicDefense, c.level);
}

/** The weapon's crit (out of 200), or 0 unarmed. */
export function partyCrit(c: MemberView): number {
  return c.getEquipped('weapon')?.crit ?? 0;
}

/** Sleep or paralysis: the target loses its turn and is easier to hit. */
export function partyHelpless(c: Character): boolean {
  return c.statusTracker.isHelpless();
}

/** `evade` + the LOCK debuff, never below 0. */
export function enemyEvade(e: EnemyInstance): number {
  return Math.max(0, (e.data.stats.evade ?? 0) + (e.buffs.get('evade') ?? 0));
}

export function enemyAttack(e: EnemyInstance): number {
  return e.data.stats.attack + (e.buffs.get('attack') ?? 0);
}

export function enemyAbsorb(e: EnemyInstance): number {
  return e.data.stats.defense + (e.buffs.get('defense') ?? 0);
}

/** The data's hits plus the battle-only `hits` buff (a boss phase, B1). */
export function enemyHits(e: EnemyInstance): number {
  return (e.data.stats.hits ?? 1) + (e.buffs.get('hits') ?? 0);
}

export function enemyCrit(data: EnemyData): number {
  return data.stats.crit ?? 1;
}

export function enemyAccuracy(data: EnemyData): number {
  return data.stats.accuracy ?? 0;
}

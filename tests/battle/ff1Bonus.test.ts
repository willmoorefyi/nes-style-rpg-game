/**
 * Pass EQ 7.1 (docs/EQUIP_FF1_PLAN.md): FF1's "strong against" bonus. A weapon that names the enemy's family (or `all`,
 * Excalibur), or whose element the enemy is weak to, attacks with attack +4 and hit% +40 (so more hits, 1 + hit%/32).
 * The game's old x1.5 family damage bonus is gone; the Mythril weapons no longer slay undead (FF1).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { makeEnemyInstances } from '../../src/battle/enemyInstances.js';
import { resolvePartyAttack, strongAgainst, STRONG_ATTACK, STRONG_HIT } from '../../src/battle/PhysicalAttack.js';
import { partyAttack, partyHitPercent } from '../../src/battle/CombatStats.js';
import type { EnemyData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';

const foe = (extra: Partial<EnemyData>): EnemyData => ({
  id: 'dummy', name: 'Dummy', stats: { hp: 999, attack: 1, defense: 0, evade: 0, magicDefense: 0 } as EnemyData['stats'],
  xp: 0, gold: 0, ...extra,
} as EnemyData);
const enemy = (extra: Partial<EnemyData>) => makeEnemyInstances([foe(extra)])[0];

function knight(weapon: string | null): Character {
  const c = new Character({ name: 'KN', classData: ClassRegistry.getClass('knight')!, level: 20 });
  if (weapon) c.equip('weapon', ItemRegistry.getItem(weapon)!);
  return c;
}

describe('EQ 7.1: the FF1 strong-against bonus', () => {
  beforeAll(loadRealRegistries);

  it('a family slayer, a weak element and Excalibur are strong; a plain weapon, unarmed and the Mythril Sword are not', () => {
    const undead = enemy({ family: 'undead' });
    const fireWeak = enemy({ weakness: 'fire' });
    const plain = enemy({});
    const w = (id: string) => ItemRegistry.getItem(id)!;
    expect(strongAgainst(w('flame_sword'), undead)).toBe(true);
    expect(strongAgainst(w('flame_sword'), fireWeak)).toBe(true);
    expect(strongAgainst(w('flame_sword'), plain)).toBe(false);
    expect(strongAgainst(w('excalibur'), plain)).toBe(true);
    expect(strongAgainst(w('mythril_sword'), undead)).toBe(false);
    expect(strongAgainst(w('coral_sword'), enemy({ family: 'aquatic' }))).toBe(true);
    expect(strongAgainst(null, undead)).toBe(false);
  });

  it('a strong attack adds 4 attack and 40 hit%, and its hits come from the raised hit%', () => {
    expect([STRONG_ATTACK, STRONG_HIT]).toEqual([4, 40]);
    const kn = knight('flame_sword');
    const a = partyAttack(kn);
    const hitPct = partyHitPercent(kn);
    const always = () => 0;   // every roll hits and crits; damage rolls take their low end
    const hits = (h: number) => 1 + Math.floor(h / 32);
    // each hit: (a - absorb) + a with absorb 0 and rng 0
    expect(resolvePartyAttack(kn, enemy({}), always).damage).toBe(hits(hitPct) * 2 * a);
    expect(resolvePartyAttack(kn, enemy({ family: 'undead' }), always).damage).toBe(hits(hitPct + 40) * 2 * (a + 4));
  });

  it('the old x1.5 family bonus is gone: the Mythril Sword deals the same to undead and to anything', () => {
    const kn = knight('mythril_sword');
    const always = () => 0;
    expect(resolvePartyAttack(kn, enemy({ family: 'undead' }), always).damage)
      .toBe(resolvePartyAttack(kn, enemy({}), always).damage);
  });
});

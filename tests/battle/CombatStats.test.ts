import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import {
  partyAttack, partyHitPercent, partyHits, partyEvade, partyAbsorb, partyMagicDefense, partyCrit,
  enemyEvade, enemyHits, enemyCrit, enemyAccuracy,
} from '../../src/battle/CombatStats.js';
import type { EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import type { ItemData } from '../../src/types/index.js';
import { testClass, testEnemy } from '../helpers/testUtils.js';

const monkClass = testClass('monk', {
  baseStats: { hp: 33, strength: 15, agility: 10, intelligence: 4, vitality: 10, luck: 5 },
  hitPercent: { base: 5, growth: 3 },
  magicDefense: { base: 10, growth: 4 },
});
const warriorClass = testClass('warrior', {
  baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
});

const item = (id: string, over: Partial<ItemData>): ItemData => ({
  id, name: id, type: 'armor', stats: {}, price: 1, usableBy: ['monk', 'warrior'], ...over,
});
const nunchaku = item('wooden_nunchaku', { type: 'weapon', stats: { attack: 12 }, crit: 1 });
const rapier = item('rapier', { type: 'weapon', stats: { attack: 9 }, hit: 5, crit: 4 });
const leather = item('leather_armor', { slot: 'armor', stats: { defense: 4 }, weight: 8 });
const cap = item('cap', { slot: 'helmet', stats: { defense: 1 }, weight: 1 });

describe('CombatStats: party (FF1)', () => {
  it('an unarmed Lv1 Monk (STR 15) has attack 9 (⌊15/2⌋ + 2), 2 hits and absorb 1', () => {
    const monk = new Character({ name: 'M', classData: monkClass });
    expect(partyAttack(monk)).toBe(9);
    expect(partyHitPercent(monk)).toBe(5);
    expect(partyHits(monk)).toBe(2);
    expect(partyAbsorb(monk)).toBe(1);
    expect(partyCrit(monk)).toBe(0);
  });

  it('with a wooden nunchaku the Monk has attack 19 and 1 hit', () => {
    const monk = new Character({ name: 'M', classData: monkClass });
    monk.equip('weapon', nunchaku);
    expect(partyAttack(monk)).toBe(19);
    expect(partyHits(monk)).toBe(1);
    expect(partyCrit(monk)).toBe(1);
  });

  it('an unarmed Monk’s absorb is at least their level without body armour, armour defense with it', () => {
    const monk = new Character({ name: 'M', classData: monkClass, level: 6 });
    monk.equip('helmet', cap);
    expect(partyAbsorb(monk)).toBe(6);
    monk.equip('armor', leather);
    expect(partyAbsorb(monk)).toBe(5);
  });

  it('attack is weapon + ⌊STR/2⌋ + TMPR; hit% is class base + growth × (level − 1) + weapon hit', () => {
    const w = new Character({ name: 'W', classData: warriorClass, level: 3 });
    w.equip('weapon', rapier);
    expect(partyAttack(w)).toBe(9 + Math.floor(w.baseStats.strength / 2));
    expect(partyHitPercent(w)).toBe(10 + 3 * 2 + 5);
    w.applyBuff('attack', 14);
    expect(partyAttack(w)).toBe(9 + Math.floor(w.baseStats.strength / 2) + 14);
  });

  it('hit% 32 gives 2 hits', () => {
    const w = new Character({ name: 'W', classData: testClass('warrior', { hitPercent: { base: 32, growth: 0 } }) });
    expect(partyHits(w)).toBe(2);
  });

  it('evade = 48 + AGI − Σ armour weight + the evade buff', () => {
    const w = new Character({ name: 'W', classData: warriorClass });
    expect(partyEvade(w)).toBe(48 + 5);
    w.equip('armor', leather);
    w.equip('helmet', cap);
    expect(partyEvade(w)).toBe(48 + 5 - 9);
    w.applyBuff('evade', 80);
    expect(partyEvade(w)).toBe(48 + 5 - 9 + 80);
  });

  it('absorb = Σ armour defense + FOG', () => {
    const w = new Character({ name: 'W', classData: warriorClass });
    w.equip('armor', leather);
    w.equip('helmet', cap);
    expect(partyAbsorb(w)).toBe(5);
    w.applyBuff('defense', 8);
    expect(partyAbsorb(w)).toBe(13);
  });

  it('magic defence grows per level; missing class fields default to 0', () => {
    expect(partyMagicDefense(new Character({ name: 'M', classData: monkClass, level: 3 }))).toBe(18);
    const bare = testClass('thief', { hitPercent: undefined, magicDefense: undefined });
    const t = new Character({ name: 'T', classData: bare });
    expect(partyHitPercent(t)).toBe(0);
    expect(partyMagicDefense(t)).toBe(0);
  });
});

describe('CombatStats: enemies', () => {
  const inst = (data = testEnemy()): EnemyInstance => ({
    id: 'enemy_0', data, currentHp: data.stats.hp, status: new StatusTracker(), buffs: new Map(), displayName: data.name,
  });

  it('evade is the data value plus LOCK, never below 0', () => {
    const e = inst(testEnemy({ stats: { evade: 36 } }));
    expect(enemyEvade(e)).toBe(36);
    e.buffs.set('evade', -20);
    expect(enemyEvade(e)).toBe(16);
    e.buffs.set('evade', -60);
    expect(enemyEvade(e)).toBe(0);
  });

  it('hits, crit and accuracy default to 1, 1 and 0', () => {
    const plain = testEnemy({ stats: { accuracy: undefined } });
    expect(enemyHits(plain)).toBe(1);
    expect(enemyCrit(plain)).toBe(1);
    expect(enemyAccuracy(plain)).toBe(0);
    const boss = testEnemy({ stats: { hits: 2, crit: 5, accuracy: 15 } });
    expect([enemyHits(boss), enemyCrit(boss), enemyAccuracy(boss)]).toEqual([2, 5, 15]);
  });
});

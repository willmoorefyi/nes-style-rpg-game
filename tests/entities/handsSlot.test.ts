/**
 * Pass EQ T1 (docs/EQUIP_FF1_PLAN.md D-EQ1, D-EQ2, D-EQ5): the fifth equipment slot `hands` (FF1's glove slot:
 * gloves, gauntlets and the ProRing). Absorb and evade read it like the other armour; it is not body armour for the
 * Monk rule; saves carry it, and a save written before it loads with the slot empty.
 */
import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { equipFromBag, slotOf } from '../../src/entities/EquipmentRules.js';
import { partyAbsorb, partyEvade } from '../../src/battle/CombatStats.js';
import { SLOT_LABELS } from '../../src/ui/labels.js';
import type { CharacterClassData, CharacterSaveData, ItemData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';

const fighter: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
  statGrowth: { hp: 10, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};
const monk: CharacterClassData = { ...fighter, id: 'monk', name: 'Monk', unarmedMartial: true };
const gloves: ItemData = { id: 'gloves', name: 'Gloves', type: 'armor', slot: 'hands', stats: { defense: 1 }, weight: 1,
  price: 60, usableBy: ['warrior', 'monk'] };
const gauntlet: ItemData = { id: 'iron_gauntlet', name: 'Iron Gauntlet', type: 'armor', slot: 'hands',
  stats: { defense: 4 }, weight: 5, price: 750, usableBy: ['warrior'] };
const cap: ItemData = { id: 'cap', name: 'Cap', type: 'armor', slot: 'helmet', stats: { defense: 1 }, weight: 1, price: 80,
  usableBy: ['warrior'] };

describe('EQ T1: the hands slot', () => {
  it('a new character has an empty hands slot, labelled "Hands"', () => {
    const c = new Character({ name: 'A', classData: fighter });
    expect(c.getEquipped('hands')).toBeNull();
    expect(SLOT_LABELS.hands).toBe('Hands');
    expect(slotOf(gloves)).toBe('hands');
  });

  it('gloves fit the hands slot and nowhere else; a cap does not fit it', () => {
    const c = new Character({ name: 'A', classData: fighter });
    expect(c.canEquipIn('hands', gloves)).toBe(true);
    expect(c.canEquipIn('helmet', gloves)).toBe(false);
    expect(c.canEquipIn('armor', gloves)).toBe(false);
    expect(c.canEquipIn('hands', cap)).toBe(false);
    expect(c.equip('hands', gloves)).toBeNull();
    expect(c.equip('hands', gauntlet)).toBe(gloves);
    expect(c.unequip('hands')).toBe(gauntlet);
    expect(c.getEquipped('hands')).toBeNull();
  });

  it('absorb adds its DEF and evade loses its weight (D-EQ2)', () => {
    const c = new Character({ name: 'A', classData: fighter });
    const absorb = partyAbsorb(c);
    const evade = partyEvade(c);
    c.equip('hands', gauntlet);
    expect(partyAbsorb(c)).toBe(absorb + 4);
    expect(partyEvade(c)).toBe(evade - 5);
    expect(c.stats.defense).toBe(4);
  });

  it('gloves are not body armour: a Monk without body armour still absorbs at least his level', () => {
    const m = new Character({ name: 'M', classData: monk, level: 20 });
    m.equip('hands', gloves);
    expect(partyAbsorb(m)).toBe(20);
  });

  it('equipFromBag swaps gloves through the bag', () => {
    const c = new Character({ name: 'A', classData: fighter });
    const bag = new Inventory();
    bag.add('gloves', 1);
    bag.add('iron_gauntlet', 1);
    expect(equipFromBag(c, 'hands', gloves, bag)).toEqual({ ok: true });
    expect(equipFromBag(c, 'hands', gauntlet, bag)).toEqual({ ok: true });
    expect(c.getEquipped('hands')?.id).toBe('iron_gauntlet');
    expect(bag.getQuantity('gloves')).toBe(1);
    expect(bag.getQuantity('iron_gauntlet')).toBe(0);
  });

  it('toJSON writes all five slots', () => {
    const c = new Character({ name: 'A', classData: fighter });
    c.equip('hands', gloves);
    expect(Object.keys(c.toJSON().equipment)).toEqual(['weapon', 'armor', 'shield', 'helmet', 'hands']);
    expect(c.toJSON().equipment.hands).toBe('gloves');
  });

  it('a save from before the slot (four slots) loads with hands empty (D-EQ5: no SAVE_VERSION change)', async () => {
    await loadRealRegistries();
    const old: CharacterSaveData = {
      name: 'A', classId: 'warrior', level: 3, xp: 40, currentHp: 30,
      equipment: { weapon: 'rapier', armor: 'chain_mail', shield: null, helmet: null },
      spellCharges: [0, 0, 0, 0, 0, 0, 0, 0], learnedSpells: [],
    };
    const c = Character.fromJSON(old)!;
    expect(c.getEquipped('weapon')?.id).toBe('rapier');
    expect(c.getEquipped('hands')).toBeNull();
    expect(c.toJSON().equipment.hands).toBeNull();
  });
});

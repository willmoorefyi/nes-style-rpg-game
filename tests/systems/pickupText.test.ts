import { describe, it, expect, beforeAll } from 'vitest';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import { ITEMS, SHOPS } from '../helpers/balanceData.js';
import {
  article, itemPhrase, foundText, receivedText, cantCarryText, leftBehindText, pluralName, countedName,
} from '../../src/systems/pickupText.js';
import { buy } from '../../src/scenes/shop/shopTransaction.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { PartyManager } from '../../src/entities/PartyManager.js';

describe('pickupText (U9)', () => {
  beforeAll(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => ITEMS } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  it('picks the article from the name', () => {
    expect(article('Potion')).toBe('a');
    expect(article('Ether')).toBe('an');
    expect(article('Iron Helm')).toBe('an');
    expect(article('Hi-Potion')).toBe('a');
    expect(article('Lute')).toBe('a');
    expect(article('Wooden Armor')).toBe('');
    expect(article('Leather Armor')).toBe('');
    expect(article('Chain Mail')).toBe('');
  });

  it('phrases real items by id', () => {
    expect(itemPhrase('potion')).toBe('a Potion');
    expect(itemPhrase('ether')).toBe('an Ether');
    expect(itemPhrase('iron_helm')).toBe('an Iron Helm');
    expect(itemPhrase('hi_potion')).toBe('a Hi-Potion');
    expect(itemPhrase('lute')).toBe('the Lute');
    expect(itemPhrase('wooden_armor')).toBe('Wooden Armor');
    expect(itemPhrase('leather_armor')).toBe('Leather Armor');
  });

  it('builds the four strings', () => {
    expect(foundText('potion')).toBe('You found a Potion!');
    expect(foundText('iron_helm')).toBe('You found an Iron Helm!');
    expect(foundText('wooden_armor')).toBe('You found Wooden Armor!');
    expect(receivedText('potion')).toBe('You received a Potion!');
    expect(receivedText('lute')).toBe('You received the Lute!');
    expect(cantCarryText('potion')).toBe("You can't carry another Potion.");
    expect(leftBehindText('potion')).toBe("You can't carry another Potion, so you leave it.");
  });

  it('falls back to the id for an unknown item', () => {
    expect(foundText('mystery')).toBe('You found a mystery!');
  });

  describe('plurals', () => {
    const real = (id: string) => ItemRegistry.getItem(id)!;

    it('every item sold in a shop has the plural that reads right', () => {
      const expected: Record<string, string> = {
        wooden_nunchaku: 'Wooden Nunchaku', small_knife: 'Small Knives', staff: 'Staffs', rapier: 'Rapiers',
        hammer: 'Hammers', cloth: 'Cloth', leather_armor: 'Leather Armor', chain_mail: 'Chain Mail',
        wooden_shield: 'Wooden Shields', cap: 'Caps', potion: 'Potions', antidote: 'Antidotes', tent: 'Tents',
        mythril_sword: 'Mythril Swords', mythril_knife: 'Mythril Knives', great_axe: 'Great Axes',
        mythril_hammer: 'Mythril Hammers', iron_nunchaku: 'Iron Nunchaku', power_staff: 'Power Staffs',
        iron_armor: 'Iron Armor', mythril_mail: 'Mythril Mail', iron_shield: 'Iron Shields', iron_helm: 'Iron Helms',
        hi_potion: 'Hi-Potions', soft: 'Softs', cabin: 'Cabins', phoenix_down: 'Phoenix Downs',
        iron_sword: 'Iron Swords', hand_axe: 'Hand Axes',
      };
      const sold = new Set(SHOPS.filter((s) => s.type !== 'magic').flatMap((s) => s.inventory));
      expect([...sold].sort()).toEqual(Object.keys(expected).sort());
      for (const id of sold) expect(`${id}: ${pluralName(real(id))}`).toBe(`${id}: ${expected[id]}`);
    });

    it('applies the English rule when no plural is set', () => {
      expect(pluralName({ name: 'Glass' })).toBe('Glasses');
      expect(pluralName({ name: 'Ruby' })).toBe('Rubies');
      expect(pluralName({ name: 'Key' })).toBe('Keys');
      expect(pluralName({ name: 'Dragon Armor' })).toBe('Dragon Armor');
    });

    it('counts one in the singular', () => {
      expect(countedName(real('rapier'), 1)).toBe('1 Rapier');
      expect(countedName(real('rapier'), 2)).toBe('2 Rapiers');
    });

    it('the shop says "Bought 2 Rapiers." and "Bought 2 Leather Armor."', () => {
      const party = new PartyManager();
      party.addGold(1000);
      const inventory = new Inventory();
      expect(buy(party, inventory, real('rapier'), 2).message).toBe('Bought 2 Rapiers.');
      expect(buy(party, inventory, real('leather_armor'), 2).message).toBe('Bought 2 Leather Armor.');
      expect(buy(party, inventory, real('small_knife'), 3).message).toBe('Bought 3 Small Knives.');
    });
  });
});

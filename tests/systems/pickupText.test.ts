import { describe, it, expect, beforeAll } from 'vitest';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import { ITEMS } from '../helpers/balanceData.js';
import {
  article, itemPhrase, foundText, receivedText, cantCarryText, leftBehindText,
} from '../../src/systems/pickupText.js';

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
});

/** BA-4 (docs/FIX_PLAN_PENINSULA.md T5a): battle leaves Tent and Cabin out of the Item list via `isUsable`. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItemSelectionUI } from '../../src/ui/ItemSelectionUI.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { ItemEffects } from '../../src/systems/ItemEffects.js';
import { Inventory } from '../../src/entities/Inventory.js';
import type { DataLoader } from '../../src/core/DataLoader.js';

const items = [
  { id: 'potion', name: 'Potion', type: 'consumable' as const, stats: { hp: 30 }, price: 60, usableBy: [] },
  { id: 'tent', name: 'Tent', type: 'consumable' as const, stats: {}, price: 75, usableBy: [] },
  { id: 'cabin', name: 'Cabin', type: 'consumable' as const, stats: {}, price: 250, usableBy: [] },
];

const inBattle = (id: string) => !ItemEffects.isPartyItem(id);

function makeUI(inventory: Inventory, isUsable?: (id: string) => boolean) {
  return new ItemSelectionUI({
    inventory, partyMembers: [{ name: 'Hero', id: 'party_0' }], contentX: 0, contentY: 0,
    onSelect: vi.fn(), onCancel: vi.fn(), isUsable,
  });
}

describe('ItemSelectionUI isUsable (BA-4)', () => {
  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => items } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  it('{tent, potion} with the battle filter lists Potion only', () => {
    const inv = new Inventory();
    inv.add('tent');
    inv.add('potion', 3);
    const ui = makeUI(inv, inBattle);
    expect(ui.listedItemIds).toEqual(['potion']);
    expect(ui.hasNoItems()).toBe(false);
  });

  it('{tent} alone with the battle filter has no items', () => {
    const inv = new Inventory();
    inv.add('tent');
    inv.add('cabin');
    expect(makeUI(inv, inBattle).hasNoItems()).toBe(true);
  });

  it('with no filter every consumable is listed (field use)', () => {
    const inv = new Inventory();
    inv.add('tent');
    inv.add('potion');
    expect(makeUI(inv).listedItemIds).toEqual(['tent', 'potion']);
  });
});

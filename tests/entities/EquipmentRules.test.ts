import { describe, it, expect, beforeAll } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { CANT_EQUIP_TEXT, equipFromBag } from '../../src/entities/EquipmentRules.js';
import { loadRealRegistries } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const item = (id: string) => ItemRegistry.getItem(id)!;
function setup(cls = 'warrior', bag: Record<string, number> = {}) {
  const member = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass(cls)! });
  const inventory = new Inventory();
  for (const [id, n] of Object.entries(bag)) inventory.add(id, n);
  return { member, inventory };
}

describe('U9: equipFromBag', () => {
  it('equips from the bag into an empty slot', () => {
    const { member, inventory } = setup('warrior', { rapier: 1 });
    expect(equipFromBag(member, 'weapon', item('rapier'), inventory)).toEqual({ ok: true });
    expect(member.getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.has('rapier')).toBe(false);
  });

  it('a swap puts the worn item back in the bag', () => {
    const { member, inventory } = setup('warrior', { iron_sword: 1 });
    member.equip('weapon', item('rapier'));
    expect(equipFromBag(member, 'weapon', item('iron_sword'), inventory).ok).toBe(true);
    expect(member.getEquipped('weapon')?.id).toBe('iron_sword');
    expect(inventory.getQuantity('rapier')).toBe(1);
    expect(inventory.has('iron_sword')).toBe(false);
  });

  it('a full bag of the worn item refuses with the shared wording and moves nothing', () => {
    const { member, inventory } = setup('warrior', { rapier: 99, iron_sword: 1 });
    member.equip('weapon', item('rapier'));
    expect(equipFromBag(member, 'weapon', item('iron_sword'), inventory))
      .toEqual({ ok: false, message: "You can't carry another Rapier." });
    expect(equipFromBag(member, 'weapon', null, inventory))
      .toEqual({ ok: false, message: "You can't carry another Rapier." });
    expect(member.getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.getQuantity('rapier')).toBe(99);
    expect(inventory.getQuantity('iron_sword')).toBe(1);
  });

  it('a class that cannot use the item is refused, and keeps what it wore', () => {
    const { member, inventory } = setup('black_mage', { rapier: 1 });
    member.equip('weapon', item('small_knife'));
    expect(equipFromBag(member, 'weapon', item('rapier'), inventory)).toEqual({ ok: false, message: CANT_EQUIP_TEXT });
    expect(member.getEquipped('weapon')?.id).toBe('small_knife');
    expect(inventory.getQuantity('rapier')).toBe(1);
  });

  it('the wrong slot is refused', () => {
    const { member, inventory } = setup('warrior', { wooden_shield: 1 });
    expect(equipFromBag(member, 'armor', item('wooden_shield'), inventory).ok).toBe(false);
  });

  it('the same id is a no-op, even with 99 in the bag', () => {
    const { member, inventory } = setup('warrior', { rapier: 99 });
    member.equip('weapon', item('rapier'));
    expect(equipFromBag(member, 'weapon', item('rapier'), inventory)).toEqual({ ok: true });
    expect(member.getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.getQuantity('rapier')).toBe(99);
  });

  it('unequip puts the worn item in the bag', () => {
    const { member, inventory } = setup('warrior');
    member.equip('weapon', item('rapier'));
    expect(equipFromBag(member, 'weapon', null, inventory).ok).toBe(true);
    expect(member.getEquipped('weapon')).toBeNull();
    expect(inventory.getQuantity('rapier')).toBe(1);
  });
});

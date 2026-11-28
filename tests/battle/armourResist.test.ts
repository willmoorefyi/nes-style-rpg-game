/**
 * Pass EQ 7.2 (docs/EQUIP_FF1_PLAN.md): worn armour resists like FF1's. A worn item's `resist` makes the hero resist
 * that element or protection category: the ProRing blocks death spells, the Aegis Shield stone, Dragon Armor fire / ice /
 * lightning damage. A hero's battle resistances (WALL's categories) now block the matching status spells too (R-1b).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { isProtected } from '../../src/battle/SpellStatus.js';
import { loadRealRegistries } from '../helpers/realData.js';

const knight = (): Character => new Character({ name: 'KN', classData: ClassRegistry.getClass('knight')!, level: 30 });
const wear = (c: Character, ...ids: string[]): Character => {
  for (const id of ids) {
    const it = ItemRegistry.getItem(id)!;
    expect(c.equip(it.slot ?? 'armor', it)).not.toBe(false);
  }
  return c;
};

describe('EQ 7.2: armour resistances', () => {
  beforeAll(loadRealRegistries);

  it('a worn item\'s resist list is a resistance; taking it off ends it', () => {
    const kn = wear(knight(), 'dragon_armor', 'pro_ring', 'aegis_shield');
    for (const r of ['fire', 'ice', 'lightning', 'death', 'poison_stone']) expect(kn.hasTempResist(r), r).toBe(true);
    expect(kn.hasTempResist('time')).toBe(false);
    kn.unequip('hands');
    expect(kn.hasTempResist('death')).toBe(false);
  });

  it('the ProRing protects from death spells (RUB, XXXX) and the Aegis from stone; bare, nothing does', () => {
    const rub = SpellRegistry.getSpell('rub')!;
    const xxxx = SpellRegistry.getSpell('xxxx')!;
    expect(isProtected(knight(), rub)).toBe(false);
    expect(isProtected(wear(knight(), 'pro_ring'), rub)).toBe(true);
    expect(isProtected(wear(knight(), 'pro_ring'), xxxx)).toBe(true);
    const brak = SpellRegistry.getSpell('brak')!;   // BRAK: stone
    expect(isProtected(knight(), brak)).toBe(false);
    expect(isProtected(wear(knight(), 'aegis_shield'), brak)).toBe(true);
  });

  it('WALL-style battle resistances block status spells at heroes (R-1b)', () => {
    const hold = SpellRegistry.getSpell('hold')!;
    const kn = knight();
    expect(isProtected(kn, hold)).toBe(false);
    kn.addTempResist('status');
    expect(isProtected(kn, hold)).toBe(true);
  });
});

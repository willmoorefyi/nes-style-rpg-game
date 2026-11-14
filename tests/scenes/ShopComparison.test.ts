import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ShopScene } from '../../src/scenes/ShopScene.js';
import { compareEquip, hitsSuffix } from '../../src/scenes/shopComparison.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { partyAttack } from '../../src/battle/CombatStats.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

describe('MS-2: shop comparison respects who can equip the item', () => {
  it('a mage gets "n/a" for a Rapier, a warrior gets a +/- value', () => {
    const fighter = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    const mage = new Character({ name: 'B.MAG', classData: ClassRegistry.getClass('black_mage')! });
    const input = tapInput();
    const game = {
      input,
      inventory: new Inventory(),
      party: { all: [fighter, mage], gold: 10000 },
      events: { emit: vi.fn() },
      scenes: { pop: vi.fn() },
    };
    const scene = new ShopScene(game as unknown as Game, 'cornelia_weapon');
    scene.enter();
    input.tap('confirm', () => scene.update(1)); // Buy (Nunchaku, Knife, Staff, Rapier, Hammer)
    for (let i = 0; i < 3; i++) input.tap('down', () => scene.update(1)); // to the Rapier
    scene.update(1);                              // draws the comparison panel
    const labels = visibleLabels(scene.container);
    expect(labels).toContain('B.MAG  n/a');
    // MS-5: one line per member, `NAME  ATK cur->new  +d`
    expect(labels.some((l) => /^FGHTR  ATK \d+->\d+  \+\d+$/.test(l))).toBe(true); // the warrior's gain
    expect(labels.filter((l) => /->/.test(l))).toHaveLength(1); // only one member is compared
  });
});

describe('T4 review: the shop compares on the battle formulas (Monk unarmed / martial rules)', () => {
  /** The labels the comparison panel shows for the first item of `shopId` (the Wooden Nunchaku in Cornelia). */
  function panelFor(members: Character[], shopId = 'cornelia_weapon'): string[] {
    const input = tapInput();
    const game = {
      input,
      inventory: new Inventory(),
      party: { all: members, gold: 10000 },
      events: { emit: vi.fn() },
      scenes: { pop: vi.fn() },
    };
    const scene = new ShopScene(game as unknown as Game, shopId);
    scene.enter();
    input.tap('confirm', () => scene.update(1)); // Buy: the cursor is on the first item
    scene.update(1);
    return visibleLabels(scene.container);
  }
  const monk = (level: number): Character => new Character({ name: 'MONK', classData: ClassRegistry.getClass('monk')!, level });

  it('an unarmed Lv1 Monk sees the real Wooden Nunchaku gain: 9 with 2 hits now, 19 with 1 hit, +10', () => {
    const m = monk(1);
    // ⌊15/2⌋ + 2 × 1 = 9 bare-handed (2 hits); ⌊15/2⌋ + 12 = 19 with the nunchaku (1 hit)
    expect(compareEquip(m, ItemRegistry.getItem('wooden_nunchaku')!, 'weapon')).toEqual(
      { label: 'ATK', now: 9, next: 19, diff: 10, nowHits: 2, nextHits: 1 });
    const labels = panelFor([m]);
    expect(labels).toContain('Wooden Nunchaku  ATK: 12');
    expect(labels).toContain('MONK  ATK 9 (2 hits)->19 (1 hit)  +10');
  });

  it('a Lv7 Monk\'s bare hands beat the Wooden Nunchaku: a negative value', () => {
    const m = monk(7);
    // STR 15 + 4 × 6 = 39: ⌊39/2⌋ + 2 × 7 = 33 bare-handed, ⌊39/2⌋ + 12 = 31 with the nunchaku
    expect(compareEquip(m, ItemRegistry.getItem('wooden_nunchaku')!, 'weapon')).toEqual(
      { label: 'ATK', now: 33, next: 31, diff: -2, nowHits: 2, nextHits: 1 });
    const labels = panelFor([m]);
    expect(labels).toContain('MONK  ATK 33 (2 hits)->31 (1 hit)  -2');
  });

  it('a Warrior\'s comparison is weapon + ⌊STR/2⌋ against the current weapon, with no hit count at 1 hit', () => {
    const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    w.equip('weapon', ItemRegistry.getItem('rapier')!);
    const cmp = compareEquip(w, ItemRegistry.getItem('hammer')!, 'weapon');
    expect(cmp.diff).toBe(0); // both attack 9
    expect(cmp.now).toBe(partyAttack(w));
    expect(hitsSuffix(cmp, cmp.nowHits)).toBe('');
  });

  it('armour compares absorb: a Lv6 Monk without body armour (absorb 6) loses 2 with Leather Armor (4)', () => {
    const cmp = compareEquip(monk(6), ItemRegistry.getItem('leather_armor')!, 'armor');
    expect(cmp).toEqual({ label: 'DEF', now: 6, next: 4, diff: -2 });
  });
});

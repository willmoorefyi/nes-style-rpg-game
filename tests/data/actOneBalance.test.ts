/**
 * T4d act-1 data on the FF1 baseline (docs/FIX_PLAN_PENINSULA.md T4 §1, §3 "T4d (data)", revisions 1, 9 and 10).
 * T4e adds the "no pirate in an act-1 table" check on the map tables (revision 3).
 */
import { describe, it, expect } from 'vitest';
import {
  CLASSES, SHOPS, SPELLS, START_KIT, OVERWORLD, TEMPLE, enemy, item, kitCost, spell, makeMember, readMap,
} from '../helpers/balanceData.js';
import type { EncounterEntry } from '../../src/types/index.js';
import { spellPrice } from '../../src/systems/SpellPurchase.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import { healAmount, magicDamage } from '../../src/battle/DamageFormula.js';

const shop = (id: string) => {
  const s = SHOPS.find((x) => x.id === id);
  if (!s) throw new Error(`no shop ${id}`);
  return s;
};
const corneliaItems = [...shop('cornelia_weapon').inventory, ...shop('cornelia_armor').inventory, ...shop('cornelia_item').inventory];
const corneliaSpells = [...shop('cornelia_white').inventory, ...shop('cornelia_black').inventory];
const isBodyArmour = (id: string) => slotOf(item(id)) === 'armor';
const baseClasses = CLASSES.filter((c) => !c.upgradeFrom).map((c) => c.id);

describe('T4d Cornelia shops (FF1 Coneria lists)', () => {
  it('sell a body armour that both mages can wear (EB-7: Cloth)', () => {
    const body = shop('cornelia_armor').inventory.filter(isBodyArmour);
    for (const mage of ['white_mage', 'black_mage']) {
      expect(body.some((id) => item(id).usableBy.includes(mage)), mage).toBe(true);
    }
    expect(shop('cornelia_armor').inventory).toContain('cloth');
  });

  it('sell the Monk a weapon and a body armour (EB-8: nunchaku, leather)', () => {
    expect(shop('cornelia_weapon').inventory.some((id) => item(id).type === 'weapon' && item(id).usableBy.includes('monk'))).toBe(true);
    expect(shop('cornelia_weapon').inventory).toContain('wooden_nunchaku');
    expect(shop('cornelia_armor').inventory.some((id) => isBodyArmour(id) && item(id).usableBy.includes('monk'))).toBe(true);
    expect(item('leather_armor').usableBy).toContain('monk');
  });

  it('mark body armour with an explicit armor slot (the Monk rule is a slot check)', () => {
    for (const id of ['cloth', 'robe', 'leather_armor', 'chain_mail', 'iron_armor']) expect(item(id).slot, id).toBe('armor');
    expect(slotOf(item('cap'))).toBe('helmet');
  });

  it('price every item at 400 G or less, the Cap at 80 G and the Short Sword out of reach (550 G, not sold)', () => {
    for (const id of corneliaItems) expect(item(id).price, id).toBeLessThanOrEqual(400);
    expect(item('cap').price).toBe(80);
    expect(item('short_sword').price).toBe(550);
    expect(corneliaItems).not.toContain('short_sword');
    expect(item('tent').price).toBe(75);
  });

  it('sell every level-1 spell for 100 G', () => {
    for (const id of corneliaSpells) {
      expect(spell(id).level, id).toBe(1);
      expect(spellPrice(spell(id)), id).toBe(100);
    }
  });
});

describe('T4d starting kit (NG-5, revision 10)', () => {
  it('defines a kit for every base class, all bought in Cornelia and usable by that class', () => {
    expect(Object.keys(START_KIT).sort()).toEqual([...baseClasses].sort());
    for (const [cls, kit] of Object.entries(START_KIT)) {
      for (const id of kit.gear) expect(corneliaItems, `${cls} ${id}`).toContain(id);
      for (const id of kit.spells) expect(corneliaSpells, `${cls} ${id}`).toContain(id);
      expect(() => makeMember(cls, 1, kit)).not.toThrow();
    }
  });

  it('costs 400 G or less for every party of four different base classes; the plan\'s party costs 370', () => {
    const cost = (cls: string) => kitCost(START_KIT[cls], spellPrice);
    let parties = 0;
    for (let a = 0; a < baseClasses.length; a++) for (let b = a + 1; b < baseClasses.length; b++)
      for (let c = b + 1; c < baseClasses.length; c++) for (let d = c + 1; d < baseClasses.length; d++) {
        const four = [baseClasses[a], baseClasses[b], baseClasses[c], baseClasses[d]];
        expect(four.reduce((s, x) => s + cost(x), 0), four.join(' ')).toBeLessThanOrEqual(400);
        parties++;
      }
    expect(parties).toBe(15);
    expect(['warrior', 'thief', 'white_mage', 'black_mage'].reduce((s, x) => s + cost(x), 0)).toBe(370);
  });
});

describe('T4d act-1 enemies (FF1 counterparts)', () => {
  it('Garland (U1, decision U-1): 340 HP, attack 9, two hits, accuracy 15, no weakness; 3 hits at <= 25 % HP', () => {
    const g = enemy('garland');
    expect(g.stats.hp).toBe(340);
    expect(g.stats.attack).toBe(9);
    expect(g.stats.accuracy).toBe(15);
    expect(g.stats.hits).toBe(2);
    expect(g.weakness).toBeUndefined();
    expect(g.xpReward).toBe(130);
    expect(g.goldReward).toBe(250);
    expect(g.bossPhases).toEqual([{ hpThreshold: 0.25, patternId: 'aggressive', message: "Garland's attacks grow fiercer!", hits: 3 }]);
  });

  it('maps the field enemies to IMP, GrIMP, WOLF, GrWOLF and BONE', () => {
    const want: Record<string, [number, number, number, number]> = { // hp, attack, defense, xp
      goblin: [8, 4, 4, 6], gr_imp: [16, 8, 6, 18], wolf: [20, 8, 0, 24], gr_wolf: [72, 14, 0, 93], skeleton: [10, 10, 12, 9],
    };
    for (const [id, [hp, atk, def, xp]] of Object.entries(want)) {
      const e = enemy(id);
      expect([e.stats.hp, e.stats.attack, e.stats.defense, e.xpReward], id).toEqual([hp, atk, def, xp]);
      expect(e.stats.evade, `${id} evade`).toBeGreaterThan(0);
      expect(e.stats.accuracy, `${id} accuracy`).toBeGreaterThan(0);
    }
    expect(enemy('gr_imp').sprite).toBe('gr_imp');
    expect(enemy('gr_wolf').family).toBe('were');
  });
});

describe('T4d spells and classes', () => {
  it('CURE heals 16-32 and a Lv1 FIRE does at most 60 to a target weak to fire (EB-4)', () => {
    expect(healAmount(spell('cure'), () => 0)).toBe(16);
    expect(healAmount(spell('cure'), () => 0.9999)).toBe(32);
    const fire = spell('fire');
    const goblin = enemy('goblin');
    // rolls: the connect roll, then the damage roll
    const hit = (connect: number, roll: number) => {
      const rolls = [connect, roll];
      return magicDamage({ power: fire.power ?? 0, accuracy: fire.accuracy, element: fire.element },
        { magicDefense: goblin.stats.magicDefense, weakness: goblin.weakness, resist: goblin.resist }, () => rolls.shift() ?? 0).damage;
    };
    expect(hit(0.9999, 0)).toBe(15);      // no connect: rand(15, 30)
    expect(hit(0.9999, 0.9999)).toBe(30);
    expect(hit(0, 0)).toBe(30);           // connects: doubled
    expect(hit(0, 0.9999)).toBe(60);      // the most it can ever do
  });

  it('gives every class an FF1 hit% and magic defence', () => {
    for (const c of CLASSES) {
      expect(c.hitPercent, c.id).toBeDefined();
      expect(c.magicDefense, c.id).toBeDefined();
    }
    const warrior = CLASSES.find((c) => c.id === 'warrior')!;
    expect(warrior.hitPercent).toEqual({ base: 10, growth: 3 });
  });

  it('marks exactly the Monk and the Master as unarmed martial classes (data, not code)', () => {
    expect(CLASSES.filter((c) => c.unarmedMartial === true).map((c) => c.id).sort()).toEqual(['master', 'monk']);
  });

  it('has a power or an accuracy for every damage and status spell', () => {
    for (const s of SPELLS.filter((x) => x.effect.startsWith('damage') || x.effect.startsWith('status_'))) {
      expect(s.accuracy, s.id).toBeGreaterThan(0);
    }
  });
});

describe('T4e act-1 encounter tables (EB-1)', () => {
  const ids = (table: EncounterEntry[] | undefined): string[] =>
    (table ?? []).flatMap((e) => (e.groups ? e.groups.map((g) => g.id) : e.enemies));
  /** Every act-1 table: the compiled overworld (default and every zone), the temple, and the legacy 1x maps. */
  const tables: Array<[string, EncounterEntry[] | undefined]> = (['overworld', 'temple-of-fiends'] as const).flatMap(
    (id) => [false, true].flatMap((legacy): Array<[string, EncounterEntry[] | undefined]> => {
      const map = readMap(id, legacy);
      const tag = `${id}${legacy ? ' (legacy)' : ''}`;
      return [[tag, map.encounters], ...(map.encounterZones ?? []).map((z): [string, EncounterEntry[]] => [`${tag} zone ${z.id}`, z.encounters])];
    }));

  it('has no pirate in any act-1 table (overworld, all its zones, the temple; compiled and legacy)', () => {
    expect(tables.map(([where]) => where)).toEqual(expect.arrayContaining(
      ['overworld', 'overworld zone east_pocket', 'overworld zone temple_approach', 'temple-of-fiends', 'overworld (legacy)',
        'temple-of-fiends (legacy)']));
    for (const [where, table] of tables) {
      expect(table?.length ?? 0, where).toBeGreaterThan(0);
      expect(ids(table), where).not.toContain('pirate');
    }
  });

  it('gives the legacy maps the same default and temple tables as the compiled ones, with no zones', () => {
    expect(readMap('overworld', true).encounters).toEqual(OVERWORLD.encounters);
    expect(readMap('temple-of-fiends', true).encounters).toEqual(TEMPLE.encounters);
    expect(readMap('overworld', true).encounterZones).toBeUndefined();
  });
});

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { buySpell } from '../../src/systems/SpellPurchase.js';
import { maxChargesFor } from '../../src/entities/SpellCharges.js';
import { loadRealRegistries } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const blackMage = (level = 1) => new Character({ name: 'B.MAG', classData: ClassRegistry.getClass('black_mage')!, level });

describe('NG-4: spell charges', () => {
  it('a new character starts with full charges for its level', () => {
    const mage = blackMage();
    expect(mage.getSpellCharges(1)).toBe(mage.getMaxCharges(1));
    expect(mage.getSpellCharges(1)).toBeGreaterThan(0);
    const lv5 = blackMage(5);
    for (let l = 1; l <= 8; l++) expect(lv5.getSpellCharges(l)).toBe(lv5.getMaxCharges(l));
  });

  it('a new Black Mage that learns FIRE can cast it at once', () => {
    const mage = blackMage();
    expect(mage.learnSpell('fire', 1)).toBe(true);
    expect(mage.hasCharges(1)).toBe(true);
    expect(mage.useCharge(1)).toBe(true);
  });

  it('a Lv1 mage levelled to 5 who learns a level-2 spell has that level full', () => {
    const lv = blackMage();
    while (lv.level < 5) lv.addXp(lv.xpForNextLevel() - lv.xp);
    expect(lv.level).toBe(5);
    expect(lv.learnSpell('ice', 2)).toBe(true);
    expect(lv.getSpellCharges(2)).toBe(lv.getMaxCharges(2));
    expect(lv.getSpellCharges(2)).toBeGreaterThan(0);
  });

  it('on level-up current charges rise by however much the max rose (spent charges stay spent)', () => {
    const mage = blackMage();
    mage.learnSpell('fire', 1);
    mage.useCharge(1);
    mage.useCharge(1); // 0 / 2 left at level 1
    const before = mage.getMaxCharges(1);
    mage.addXp(mage.xpForNextLevel() - mage.xp); // Lv2
    expect(mage.level).toBe(2);
    const rise = mage.getMaxCharges(1) - before;
    expect(mage.getSpellCharges(1)).toBe(rise);
  });

  it('learning a second spell at a level does not refill that level', () => {
    const mage = blackMage();
    mage.learnSpell('fire', 1);
    mage.useCharge(1);
    mage.learnSpell('lit', 1);
    expect(mage.getSpellCharges(1)).toBe(mage.getMaxCharges(1) - 1);
  });

  it('a loaded save keeps its saved charges', () => {
    const mage = blackMage();
    mage.learnSpell('fire', 1);
    mage.useCharge(1);
    const loaded = Character.fromJSON(mage.toJSON())!;
    expect(loaded.getSpellCharges(1)).toBe(mage.getMaxCharges(1) - 1);
  });
});

describe('NG-4: per-class charge tables (FF1, T4 §1.4)', () => {
  const at = (classId: string, level: number) => {
    const c = new Character({ name: 'X', classData: ClassRegistry.getClass(classId)!, level });
    return [1, 2, 3, 4, 5, 6, 7, 8].map((l) => c.getMaxCharges(l));
  };

  it('Black Mage Lv1 has [2], Lv3 [3,1]', () => {
    expect(at('black_mage', 1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0]);
    expect(at('black_mage', 3)).toEqual([3, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('Red Mage Lv3 has [3,0]: its second spell level opens later', () => {
    expect(at('red_mage', 3)).toEqual([3, 0, 0, 0, 0, 0, 0, 0]);
    expect(at('red_mage', 4)).toEqual([3, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('a class with no spells has no charges', () => {
    for (const id of ['warrior', 'thief', 'monk', 'master']) expect(at(id, 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(at('warrior', 30)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('a value holds until the next breakpoint; the cap is 9', () => {
    expect(at('white_mage', 12)).toEqual(at('white_mage', 11));
    expect(at('black_mage', 50)).toEqual([9, 9, 9, 9, 9, 9, 9, 9]);
    expect(at('knight', 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(at('knight', 10)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('after a class upgrade the new class\'s table applies', () => {
    const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')!, level: 15 });
    expect(w.getMaxCharges(1)).toBe(0);
    w.upgrade(ClassRegistry.getClass('knight')!);
    expect([w.getMaxCharges(1), w.getMaxCharges(2)]).toEqual([2, 1]);
  });

  it('a class without the field has none (maxChargesFor)', () => {
    const cls = { ...ClassRegistry.getClass('black_mage')!, spellCharges: undefined };
    expect(maxChargesFor(cls, 10, 1)).toBe(0);
    expect(maxChargesFor(ClassRegistry.getClass('black_mage')!, 10, 9)).toBe(0);
  });

  it('a saved charge of 5 at Lv1 loads as 2', () => {
    const save = { ...blackMage().toJSON(), spellCharges: [5, 3, 0, 0, 0, 0, 0, 0] };
    const loaded = Character.fromJSON(save)!;
    expect([loaded.getSpellCharges(1), loaded.getSpellCharges(2)]).toEqual([2, 0]);
  });
});

describe('NG-4: magic shop takes gold only after learnSpell succeeds', () => {
  it('a full spell level costs no gold', () => {
    const party = new PartyManager();
    party.addGold(1000);
    const mage = blackMage();
    for (const id of ['fire', 'lit', 'slep']) mage.learnSpell(id, 1);
    const result = buySpell(party, mage, SpellRegistry.getSpell('lock')!, 100);
    expect(result.ok).toBe(false);
    expect(party.gold).toBe(1000);
    expect(mage.getSpellsAtLevel(1)).not.toContain('lock');
  });

  it('a successful purchase teaches the spell and takes the price', () => {
    const party = new PartyManager();
    party.addGold(150);
    const mage = blackMage();
    const result = buySpell(party, mage, SpellRegistry.getSpell('fire')!, 100);
    expect(result).toEqual({ ok: true, message: 'B.MAG learned FIRE!' });
    expect(party.gold).toBe(50);
    expect(mage.hasCharges(1)).toBe(true);
  });

  it('not enough gold teaches nothing', () => {
    const party = new PartyManager();
    party.addGold(10);
    const mage = blackMage();
    const spend = vi.spyOn(party, 'spendGold');
    expect(buySpell(party, mage, SpellRegistry.getSpell('fire')!, 100).ok).toBe(false);
    expect(spend).not.toHaveBeenCalled();
    expect(mage.getLearnedSpells()).toEqual([]);
  });
});

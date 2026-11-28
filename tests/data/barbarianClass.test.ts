/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md D-CB1..D-CB6, 9): the barbarian -> berserker class pair is a shallow copy of
 * warrior -> knight (user request 2026-11-26), selectable at party creation, upgraded by the same rule, equipping the
 * same items, with the same debug kits, and surviving a save round trip.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { CLASS_UPGRADES, upgradeParty } from '../../src/systems/ClassUpgradeSystem.js';
import { DEFAULT_NAMES } from '../../src/scenes/partyCreation/PartyCreationViews.js';
import { classLabel } from '../../src/data/classLabel.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';

const CLASSES = parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as CharacterClassData[];
const ITEMS = parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[];
const KITS = parse(readFileSync('assets/data/kits.yaml', 'utf-8')) as Record<string, Record<string, unknown>>;
const byId = new Map(CLASSES.map((c) => [c.id, c]));
const COPIED = ['baseStats', 'statGrowth', 'usableEquipment', 'spellLevels', 'hitPercent', 'magicDefense', 'spellCharges',
  'unarmedMartial'] as const;

describe('pass CB: barbarian / berserker are a shallow copy of warrior / knight', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['barbarian', 'warrior'], ['berserker', 'knight']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('barbarian')).toMatchObject({ name: 'Barbarian', abbr: 'BRB' });
    expect(byId.get('berserker')).toMatchObject({ name: 'Berserker', abbr: 'BSK', upgradeFrom: 'barbarian' });
    expect(byId.get('barbarian')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base.slice(0, 7)).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian']);
    expect(DEFAULT_NAMES.barbarian).toBe('BARB');
  });

  it('upgrades barbarian -> berserker by the warrior -> knight rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.barbarian).toBe('berserker');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'BARB', classData: reg.get('barbarian')!, level: 20 }),
      new Character({ name: 'WAR', classData: reg.get('warrior')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["BARB's Barbarian became Berserker!", "WAR's Warrior became Knight!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['berserker', 'knight']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the warrior / knight equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['barbarian', 'warrior', 'berserker', 'knight'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('barbarian'))).toHaveLength(0);   // pass EQ D-EQ4: a copy equips as its copyOf source
  });

  it('kits: barbarian = warrior in every kit, berserker = knight wherever a knight row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.warrior) expect(kit.barbarian, name).toEqual(kit.warrior);
      if (kit.knight) expect(kit.berserker, name).toEqual(kit.knight);
      else expect(kit.berserker, name).toBeUndefined();
    }
  });

  it('the cb_barbarians debug scenario fields both classes and a knight control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_barbarians');
    expect(sc?.party.map((m) => m.class)).toEqual(['barbarian', 'berserker', 'barbarian', 'knight']);
  });

  it('a berserker with its gear survives a save round trip', () => {
    const c = new Character({ name: 'BERS', classData: ClassRegistry.getClass('berserker')!, level: 30 });
    const sword = ItemRegistry.getItem('sun_blade')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('berserker');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('sun_blade');
  });
});

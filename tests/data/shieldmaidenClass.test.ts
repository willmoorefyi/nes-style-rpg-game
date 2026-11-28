/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the shieldmaiden -> valkyrie class pair is a shallow copy of
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

describe('pass CB: shieldmaiden / valkyrie are a shallow copy of warrior / knight', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['shieldmaiden', 'warrior'], ['valkyrie', 'knight']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('shieldmaiden')).toMatchObject({ name: 'Shieldmaiden', abbr: 'SHD' });
    expect(byId.get('valkyrie')).toMatchObject({ name: 'Valkyrie', abbr: 'VAL', upgradeFrom: 'shieldmaiden' });
    expect(byId.get('shieldmaiden')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero', 'arquebusier', 'shieldmaiden', 'bard', 'fencer', 'apothecary', 'tinker', 'clockmaker', 'witch_hunter', 'diver', 'dancer_hero']);   // the base classes in merge order (pass CB: + dancer_hero)
    expect(DEFAULT_NAMES.shieldmaiden).toBe('MAIDN');
  });

  it('upgrades shieldmaiden -> valkyrie by the warrior -> knight rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.shieldmaiden).toBe('valkyrie');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'MAIDN', classData: reg.get('shieldmaiden')!, level: 20 }),
      new Character({ name: 'WAR', classData: reg.get('warrior')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["MAIDN's Shieldmaiden became Valkyrie!", "WAR's Warrior became Knight!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['valkyrie', 'knight']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the warrior / knight equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['shieldmaiden', 'warrior', 'valkyrie', 'knight'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('shieldmaiden'))).toHaveLength(44);
  });

  it('kits: shieldmaiden = warrior in every kit, valkyrie = knight wherever a knight row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.warrior) expect(kit.shieldmaiden, name).toEqual(kit.warrior);
      if (kit.knight) expect(kit.valkyrie, name).toEqual(kit.knight);
      else expect(kit.valkyrie, name).toBeUndefined();
    }
  });

  it('the cb_shieldmaidens debug scenario fields both classes and a knight control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_shieldmaidens');
    expect(sc?.party.map((m) => m.class)).toEqual(['shieldmaiden', 'valkyrie', 'shieldmaiden', 'knight']);
  });

  it('a valkyrie with its gear survives a save round trip', () => {
    const c = new Character({ name: 'VALK', classData: ClassRegistry.getClass('valkyrie')!, level: 30 });
    const sword = ItemRegistry.getItem('sun_blade')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('valkyrie');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('sun_blade');
  });
});

/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the diver -> abyssal_knight class pair is a shallow copy of
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

describe('pass CB: diver / abyssal_knight are a shallow copy of warrior / knight', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['diver', 'warrior'], ['abyssal_knight', 'knight']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('diver')).toMatchObject({ name: 'Diver', abbr: 'DIV' });
    expect(byId.get('abyssal_knight')).toMatchObject({ name: 'Abyssal Knight', abbr: 'ABY', upgradeFrom: 'diver' });
    expect(byId.get('diver')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero', 'arquebusier', 'shieldmaiden', 'bard', 'fencer', 'apothecary', 'tinker', 'clockmaker', 'witch_hunter', 'diver', 'dancer_hero']);   // the base classes in merge order (pass CB: + dancer_hero)
    expect(DEFAULT_NAMES.diver).toBe('DIVER');
  });

  it('upgrades diver -> abyssal_knight by the warrior -> knight rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.diver).toBe('abyssal_knight');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'DIVER', classData: reg.get('diver')!, level: 20 }),
      new Character({ name: 'WAR', classData: reg.get('warrior')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["DIVER's Diver became Abyssal Knight!", "WAR's Warrior became Knight!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['abyssal_knight', 'knight']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the warrior / knight equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['diver', 'warrior', 'abyssal_knight', 'knight'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('diver'))).toHaveLength(44);
  });

  it('kits: diver = warrior in every kit, abyssal_knight = knight wherever a knight row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.warrior) expect(kit.diver, name).toEqual(kit.warrior);
      if (kit.knight) expect(kit.abyssal_knight, name).toEqual(kit.knight);
      else expect(kit.abyssal_knight, name).toBeUndefined();
    }
  });

  it('the cb_divers debug scenario fields both classes and a knight control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_divers');
    expect(sc?.party.map((m) => m.class)).toEqual(['diver', 'abyssal_knight', 'diver', 'knight']);
  });

  it('a abyssal_knight with its gear survives a save round trip', () => {
    const c = new Character({ name: 'ABYSS', classData: ClassRegistry.getClass('abyssal_knight')!, level: 30 });
    const sword = ItemRegistry.getItem('sun_blade')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('abyssal_knight');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('sun_blade');
  });
});

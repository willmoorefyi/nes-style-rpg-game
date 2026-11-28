/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the apothecary -> plague_doctor class pair is a shallow copy of
 * red_mage -> red_wizard (user request 2026-11-26), selectable at party creation, upgraded by the same rule, equipping the
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

describe('pass CB: apothecary / plague_doctor are a shallow copy of red_mage / red_wizard', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['apothecary', 'red_mage'], ['plague_doctor', 'red_wizard']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('apothecary')).toMatchObject({ name: 'Apothecary', abbr: 'APO' });
    expect(byId.get('plague_doctor')).toMatchObject({ name: 'Plague Doctor', abbr: 'PLG', upgradeFrom: 'apothecary' });
    expect(byId.get('apothecary')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero', 'arquebusier', 'shieldmaiden', 'bard', 'fencer', 'apothecary', 'tinker', 'clockmaker', 'witch_hunter']);   // the base classes in merge order (pass CB: + witch_hunter)
    expect(DEFAULT_NAMES.apothecary).toBe('APOTH');
  });

  it('upgrades apothecary -> plague_doctor by the red_mage -> red_wizard rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.apothecary).toBe('plague_doctor');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'APOTH', classData: reg.get('apothecary')!, level: 20 }),
      new Character({ name: 'MDL', classData: reg.get('red_mage')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["APOTH's Apothecary became Plague Doctor!", "MDL's Red Mage became Red Wizard!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['plague_doctor', 'red_wizard']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the red_mage / red_wizard equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['apothecary', 'red_mage', 'plague_doctor', 'red_wizard'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('apothecary'))).toHaveLength(29);
  });

  it('kits: apothecary = red_mage in every kit, plague_doctor = red_wizard wherever a red_wizard row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.red_mage) expect(kit.apothecary, name).toEqual(kit.red_mage);
      if (kit.red_wizard) expect(kit.plague_doctor, name).toEqual(kit.red_wizard);
      else expect(kit.plague_doctor, name).toBeUndefined();
    }
  });

  it('the cb_apothecaries debug scenario fields both classes and a red_wizard control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_apothecaries');
    expect(sc?.party.map((m) => m.class)).toEqual(['apothecary', 'plague_doctor', 'apothecary', 'red_wizard']);
  });

  it('a plague_doctor with its gear survives a save round trip', () => {
    const c = new Character({ name: 'ENH', classData: ClassRegistry.getClass('plague_doctor')!, level: 30 });
    const sword = ItemRegistry.getItem('mythril_sword')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('plague_doctor');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('mythril_sword');
  });
});

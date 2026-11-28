/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the dancer_hero -> blade_dancer class pair is a shallow copy of
 * monk -> master (user request 2026-11-26), selectable at party creation, upgraded by the same rule, equipping the
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

describe('pass CB: dancer_hero / blade_dancer are a shallow copy of monk / master', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['dancer_hero', 'monk'], ['blade_dancer', 'master']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('dancer_hero')).toMatchObject({ name: 'Dancer', abbr: 'DNC' });
    expect(byId.get('blade_dancer')).toMatchObject({ name: 'Blade Dancer', abbr: 'BLD', upgradeFrom: 'dancer_hero' });
    expect(byId.get('dancer_hero')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero', 'arquebusier', 'shieldmaiden', 'bard', 'fencer', 'apothecary', 'tinker', 'clockmaker', 'witch_hunter', 'diver', 'dancer_hero', 'aeronaut', 'gravity_adept']);   // the base classes in merge order (pass CB: + gravity_adept)
    expect(DEFAULT_NAMES.dancer_hero).toBe('DANCR');
  });

  it('upgrades dancer_hero -> blade_dancer by the monk -> master rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.dancer_hero).toBe('blade_dancer');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'DANCR', classData: reg.get('dancer_hero')!, level: 20 }),
      new Character({ name: 'MDL', classData: reg.get('monk')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["DANCR's Dancer became Blade Dancer!", "MDL's Monk became Master!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['blade_dancer', 'master']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the monk / master equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['dancer_hero', 'monk', 'blade_dancer', 'master'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('dancer_hero'))).toHaveLength(14);
  });

  it('kits: dancer_hero = monk in every kit, blade_dancer = master wherever a master row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.monk) expect(kit.dancer_hero, name).toEqual(kit.monk);
      if (kit.master) expect(kit.blade_dancer, name).toEqual(kit.master);
      else expect(kit.blade_dancer, name).toBeUndefined();
    }
  });

  it('the cb_dancers debug scenario fields both classes and a master control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_dancers');
    expect(sc?.party.map((m) => m.class)).toEqual(['dancer_hero', 'blade_dancer', 'dancer_hero', 'master']);
  });

  it('a blade_dancer with its gear survives a save round trip', () => {
    const c = new Character({ name: 'ENH', classData: ClassRegistry.getClass('blade_dancer')!, level: 30 });
    const sword = ItemRegistry.getItem('cat_claw')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('blade_dancer');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('cat_claw');
  });
});

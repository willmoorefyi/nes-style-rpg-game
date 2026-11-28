/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the witch_hunter -> inquisitor class pair is a shallow copy of
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

describe('pass CB: witch_hunter / inquisitor are a shallow copy of monk / master', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['witch_hunter', 'monk'], ['inquisitor', 'master']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('witch_hunter')).toMatchObject({ name: 'Witch Hunter', abbr: 'HUN' });
    expect(byId.get('inquisitor')).toMatchObject({ name: 'Inquisitor', abbr: 'INQ', upgradeFrom: 'witch_hunter' });
    expect(byId.get('witch_hunter')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero', 'arquebusier', 'shieldmaiden', 'bard', 'fencer', 'apothecary', 'tinker', 'clockmaker', 'witch_hunter', 'diver', 'dancer_hero', 'aeronaut', 'gravity_adept', 'automaton']);   // the base classes in merge order (pass CB: + automaton)
    expect(DEFAULT_NAMES.witch_hunter).toBe('WITCH');
  });

  it('upgrades witch_hunter -> inquisitor by the monk -> master rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.witch_hunter).toBe('inquisitor');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'WITCH', classData: reg.get('witch_hunter')!, level: 20 }),
      new Character({ name: 'MDL', classData: reg.get('monk')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["WITCH's Witch Hunter became Inquisitor!", "MDL's Monk became Master!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['inquisitor', 'master']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the monk / master equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['witch_hunter', 'monk', 'inquisitor', 'master'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('witch_hunter'))).toHaveLength(0);   // pass EQ D-EQ4: a copy equips as its copyOf source
  });

  it('kits: witch_hunter = monk in every kit, inquisitor = master wherever a master row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.monk) expect(kit.witch_hunter, name).toEqual(kit.monk);
      if (kit.master) expect(kit.inquisitor, name).toEqual(kit.master);
      else expect(kit.inquisitor, name).toBeUndefined();
    }
  });

  it('the cb_witchhunters debug scenario fields both classes and a master control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_witchhunters');
    expect(sc?.party.map((m) => m.class)).toEqual(['witch_hunter', 'inquisitor', 'witch_hunter', 'master']);
  });

  it('a inquisitor with its gear survives a save round trip', () => {
    const c = new Character({ name: 'ENH', classData: ClassRegistry.getClass('inquisitor')!, level: 30 });
    const sword = ItemRegistry.getItem('iron_nunchaku')!;   // pass EQ: Cat Claw is FF1's (Kn Ni RW BW)
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('inquisitor');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('iron_nunchaku');
  });
});

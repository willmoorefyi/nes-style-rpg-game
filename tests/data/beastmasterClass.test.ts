/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the beastmaster -> summoner class pair is a shallow copy of
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

describe('pass CB: beastmaster / summoner are a shallow copy of monk / master', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['beastmaster', 'monk'], ['summoner', 'master']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('beastmaster')).toMatchObject({ name: 'Beastmaster', abbr: 'BST' });
    expect(byId.get('summoner')).toMatchObject({ name: 'Summoner', abbr: 'SUM', upgradeFrom: 'beastmaster' });
    expect(byId.get('beastmaster')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin', 'shaman', 'beastmaster', 'warlock', 'rune_knight', 'scholar_hero']);   // the base classes in merge order (pass CB: + scholar_hero)
    expect(DEFAULT_NAMES.beastmaster).toBe('BEAST');
  });

  it('upgrades beastmaster -> summoner by the monk -> master rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.beastmaster).toBe('summoner');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'BEAST', classData: reg.get('beastmaster')!, level: 20 }),
      new Character({ name: 'MDL', classData: reg.get('monk')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["BEAST's Beastmaster became Summoner!", "MDL's Monk became Master!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['summoner', 'master']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the monk / master equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['beastmaster', 'monk', 'summoner', 'master'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('beastmaster'))).toHaveLength(0);   // pass EQ D-EQ4: a copy equips as its copyOf source
  });

  it('kits: beastmaster = monk in every kit, summoner = master wherever a master row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.monk) expect(kit.beastmaster, name).toEqual(kit.monk);
      if (kit.master) expect(kit.summoner, name).toEqual(kit.master);
      else expect(kit.summoner, name).toBeUndefined();
    }
  });

  it('the cb_beastmasters debug scenario fields both classes and a master control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_beastmasters');
    expect(sc?.party.map((m) => m.class)).toEqual(['beastmaster', 'summoner', 'beastmaster', 'master']);
  });

  it('a summoner with its gear survives a save round trip', () => {
    const c = new Character({ name: 'ENH', classData: ClassRegistry.getClass('summoner')!, level: 30 });
    const sword = ItemRegistry.getItem('iron_nunchaku')!;   // pass EQ: Cat Claw is FF1's (Kn Ni RW BW)
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('summoner');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('iron_nunchaku');
  });
});

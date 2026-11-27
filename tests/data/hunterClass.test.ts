/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 11): the hunter -> ranger class pair is a shallow copy of
 * thief -> ninja (user request 2026-11-26), selectable at party creation, upgraded by the same rule, equipping the
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

describe('pass CB: hunter / ranger are a shallow copy of thief / ninja', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['hunter', 'thief'], ['ranger', 'ninja']] as const) {
    it(`${copy} has every rule field of ${of} (D-CB2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations, the upgrade link and the order (D-CB1, D-CB5)', () => {
    expect(byId.get('hunter')).toMatchObject({ name: 'Hunter', abbr: 'HNT' });
    expect(byId.get('ranger')).toMatchObject({ name: 'Ranger', abbr: 'RNG', upgradeFrom: 'hunter' });
    expect(byId.get('hunter')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base).toEqual(['warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage', 'barbarian', 'landsknecht',
      'dark_fighter_hero', 'legionnaire', 'hunter', 'cleric', 'ronin']);   // int-classes: the 13 base classes in merge order
    expect(DEFAULT_NAMES.hunter).toBe('HUNT');
  });

  it('upgrades hunter -> ranger by the thief -> ninja rule (D-CB3)', () => {
    expect(CLASS_UPGRADES.hunter).toBe('ranger');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'HUNT', classData: reg.get('hunter')!, level: 20 }),
      new Character({ name: 'THF', classData: reg.get('thief')!, level: 20 })];
    const flags = new GameFlags();
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["HUNT's Hunter became Ranger!", "THF's Thief became Ninja!"]);
    expect(party.map((c) => c.classData.id)).toEqual(['ranger', 'ninja']);
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual([]);
  });

  it('equips exactly what the thief / ninja equip (D-CB4)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [barb, war, bers, kn] = ['hunter', 'thief', 'ranger', 'ninja'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => barb.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => bers.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('hunter'))).toHaveLength(16);
  });

  it('kits: hunter = thief in every kit, ranger = ninja wherever a ninja row exists (D-CB6)', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.thief) expect(kit.hunter, name).toEqual(kit.thief);
      if (kit.ninja) expect(kit.ranger, name).toEqual(kit.ninja);
      else expect(kit.ranger, name).toBeUndefined();
    }
  });

  it('the cb_hunters debug scenario fields both classes and a ninja control', () => {
    const sc = (parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string }[] }[])
      .find((s) => s.id === 'cb_hunters');
    expect(sc?.party.map((m) => m.class)).toEqual(['hunter', 'ranger', 'hunter', 'ninja']);
  });

  it('a ranger with its gear survives a save round trip', () => {
    const c = new Character({ name: 'BERS', classData: ClassRegistry.getClass('ranger')!, level: 30 });
    const sword = ItemRegistry.getItem('rune_knife')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('ranger');
    expect(back.level).toBe(30);
    expect(back.getEquipped('weapon')?.id).toBe('rune_knife');
  });
});

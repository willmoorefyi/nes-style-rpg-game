/**
 * Pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md D-DK1, D-DK2, D-DK7, 4): the dark_fighter_hero -> death_knight_hero class pair is a shallow
 * copy of warrior -> knight (the coordinator's default for the user's open question 1), selectable at party creation
 * (9th), upgraded by the same rule, equipping the same items, with the same debug kits, its party-creation preview
 * fitting its window, its field art aliased, and surviving a save round trip.
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
import { LINE_HEIGHT, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';

const CLASSES = parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as CharacterClassData[];
const ITEMS = parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[];
const KITS = parse(readFileSync('assets/data/kits.yaml', 'utf-8')) as Record<string, Record<string, unknown>>;
const ATLAS = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as {
  scale: number; sheets: Record<string, { cell?: [number, number] }>;
};
const FIELD = JSON.parse(readFileSync('assets/sprites/characters-ai.json', 'utf8')) as {
  sheets: Record<string, { x: number; y: number }>; aliases?: Record<string, string>;
};
const LEGACY = JSON.parse(readFileSync('assets/sprites/characters.json', 'utf8')) as { sheets: Record<string, unknown> };
const byId = new Map(CLASSES.map((c) => [c.id, c]));
const COPIED = ['baseStats', 'statGrowth', 'usableEquipment', 'spellLevels', 'hitPercent', 'magicDefense', 'spellCharges',
  'unarmedMartial'] as const;

describe('pass CD-K: dark_fighter_hero / death_knight_hero are a shallow copy of warrior / knight', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['dark_fighter_hero', 'warrior'], ['death_knight_hero', 'knight']] as const) {
    it(`${copy} has every rule field of ${of} (D-DK2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations DKF / DKN, the upgrade link, the 9th base class, the default name (D-DK1)', () => {
    expect(byId.get('dark_fighter_hero')).toMatchObject({ name: 'Dark Fighter', abbr: 'DKF' });
    expect(byId.get('death_knight_hero')).toMatchObject({ name: 'Death Knight', abbr: 'DKN', upgradeFrom: 'dark_fighter_hero' });
    expect(byId.get('dark_fighter_hero')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base.indexOf('dark_fighter_hero')).toBe(8);
    expect(DEFAULT_NAMES.dark_fighter_hero).toBe('DARK');
  });

  it('upgrades dark_fighter_hero -> death_knight_hero by the warrior -> knight rule', () => {
    expect(CLASS_UPGRADES.dark_fighter_hero).toBe('death_knight_hero');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'DARK', classData: reg.get('dark_fighter_hero')!, level: 20 })];
    const flags = new GameFlags();
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["DARK's Dark Fighter became Death Knight!"]);
    expect(party[0].classData.id).toBe('death_knight_hero');
  });

  it('equips exactly what the warrior / knight equip (no spear item exists yet)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [lan, war, drg, kn] = ['dark_fighter_hero', 'warrior', 'death_knight_hero', 'knight'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => lan.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => drg.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('dark_fighter_hero'))).toHaveLength(0);   // pass EQ D-EQ4: a copy equips as its copyOf source
  });

  it('kits: dark_fighter_hero = warrior in every kit, death_knight_hero = knight wherever a knight row exists', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.warrior) expect(kit.dark_fighter_hero, name).toEqual(kit.warrior);
      if (kit.knight) expect(kit.death_knight_hero, name).toEqual(kit.knight);
      else expect(kit.death_knight_hero, name).toBeUndefined();
    }
  });

  it('the dk_heroes scenarios put each class in every slot, with a kneel (hp 20), a KO (hp 0) and a hurt round', () => {
    const all = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string; hp?: number }[] }[];
    const sc = (id: string) => all.find((s) => s.id === id)!.party;
    const a = sc('dk_heroes'), b = sc('dk_heroes_b');
    for (const cid of ['dark_fighter_hero', 'death_knight_hero']) {
      const slots = new Set([...a.flatMap((m, i) => (m.class === cid ? [i] : [])), ...b.flatMap((m, i) => (m.class === cid ? [i] : []))]);
      expect([...slots].sort(), cid).toEqual([0, 1, 2, 3]);
    }
    expect([...a, ...b].some((m) => m.hp === 0)).toBe(true);
    expect([...a, ...b].some((m) => (m.hp ?? 99) > 0 && (m.hp ?? 99) <= 20)).toBe(true);
    expect(sc('dk_heroes_hurt').map((m) => m.class)).toEqual(['death_knight_hero', 'dark_fighter_hero', 'landsknecht', 'death_knight_hero']);
  });

  it('the party-creation preview shows the whole 160 x 144 ready frame inside its 600 x 800 window (7.5)', () => {
    const [w, h] = ATLAS.sheets.death_knight_hero.cell!;
    const pad = WINDOW_PADDING;                       // the Window's content inset
    expect(pad + w * ATLAS.scale).toBeLessThanOrEqual(600);
    expect(pad + 8 * LINE_HEIGHT + h * ATLAS.scale).toBeLessThanOrEqual(800);
  });

  it('field art: TEMPORARY aliases dark_fighter_hero -> warrior, death_knight_hero -> knight; 1x looks exist (D-DK7)', () => {
    expect(FIELD.aliases).toMatchObject({ dark_fighter_hero: 'warrior', death_knight_hero: 'knight' });
    expect(FIELD.sheets.dark_fighter_hero).toEqual(FIELD.sheets.warrior);
    expect(FIELD.sheets.death_knight_hero).toEqual(FIELD.sheets.knight);
    expect(LEGACY.sheets.dark_fighter_hero).toBeDefined();
    expect(LEGACY.sheets.death_knight_hero).toBeDefined();
  });

  it('a death_knight_hero with its gear survives a save round trip', () => {
    const c = new Character({ name: 'DKNT', classData: ClassRegistry.getClass('death_knight_hero')!, level: 30 });
    const sword = ItemRegistry.getItem('sun_blade')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('death_knight_hero');
    expect(back.getEquipped('weapon')?.id).toBe('sun_blade');
  });
});

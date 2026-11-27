/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md D-CL1, D-CL2, D-CL10, 7.5, 10): the landsknecht -> dragoon class pair is a shallow
 * copy of warrior -> knight (the coordinator's default for the user's open question 1), selectable at party creation
 * (8th), upgraded by the same rule, equipping the same items, with the same debug kits, its party-creation preview
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

describe('pass CL: landsknecht / dragoon are a shallow copy of warrior / knight', () => {
  beforeAll(loadRealRegistries);

  for (const [copy, of] of [['landsknecht', 'warrior'], ['dragoon', 'knight']] as const) {
    it(`${copy} has every rule field of ${of} (D-CL2)`, () => {
      const a = byId.get(copy)!, b = byId.get(of)!;
      for (const k of COPIED) expect(a[k], k).toEqual(b[k]);
    });
  }

  it('names, 3-letter abbreviations LKN / DRG, the upgrade link, the 8th base class, the default name (D-CL1)', () => {
    expect(byId.get('landsknecht')).toMatchObject({ name: 'Landsknecht', abbr: 'LKN' });
    expect(byId.get('dragoon')).toMatchObject({ name: 'Dragoon', abbr: 'DRG', upgradeFrom: 'landsknecht' });
    expect(byId.get('landsknecht')!.upgradeFrom).toBeUndefined();
    for (const c of CLASSES) expect(classLabel(c), c.id).toHaveLength(3);
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom).map((c) => c.id);
    expect(base.indexOf('landsknecht')).toBe(7);
    expect(DEFAULT_NAMES.landsknecht).toBe('LANZ');
  });

  it('upgrades landsknecht -> dragoon by the warrior -> knight rule', () => {
    expect(CLASS_UPGRADES.landsknecht).toBe('dragoon');
    const reg = new Map(CLASSES.map((c) => [c.id, c]));
    const party = [new Character({ name: 'LANZ', classData: reg.get('landsknecht')!, level: 20 })];
    const flags = new GameFlags();
    flags.set('SEAL');
    expect(upgradeParty(party, flags, reg, 'SEAL')).toEqual(["LANZ's Landsknecht became Dragoon!"]);
    expect(party[0].classData.id).toBe('dragoon');
  });

  it('equips exactly what the warrior / knight equip (no spear item exists yet)', () => {
    const ch = (id: string) => new Character({ name: id, classData: byId.get(id)!, level: 1 });
    const [lan, war, drg, kn] = ['landsknecht', 'warrior', 'dragoon', 'knight'].map(ch);
    const gear = ITEMS.filter((i) => i.usableBy?.length);
    expect(gear.filter((i) => lan.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => war.canEquip(i)).map((i) => i.id));
    expect(gear.filter((i) => drg.canEquip(i)).map((i) => i.id)).toEqual(gear.filter((i) => kn.canEquip(i)).map((i) => i.id));
    expect(ITEMS.filter((i) => i.usableBy?.includes('landsknecht'))).toHaveLength(44);
  });

  it('kits: landsknecht = warrior in every kit, dragoon = knight wherever a knight row exists', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.warrior) expect(kit.landsknecht, name).toEqual(kit.warrior);
      if (kit.knight) expect(kit.dragoon, name).toEqual(kit.knight);
      else expect(kit.dragoon, name).toBeUndefined();
    }
  });

  it('the cl_lances scenarios put each class in every slot, with a kneel (hp 20), a KO (hp 0) and 80 x 80 neighbours', () => {
    const all = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as { id: string; party: { class: string; hp?: number }[] }[];
    const sc = (id: string) => all.find((s) => s.id === id)!.party;
    const a = sc('cl_lances'), b = sc('cl_lances_b');
    for (const cid of ['landsknecht', 'dragoon']) {
      const slots = new Set([...a.flatMap((m, i) => (m.class === cid ? [i] : [])), ...b.flatMap((m, i) => (m.class === cid ? [i] : []))]);
      expect([...slots].sort(), cid).toEqual([0, 1, 2, 3]);
    }
    expect([...a, ...b].some((m) => m.hp === 0)).toBe(true);
    expect([...a, ...b].some((m) => (m.hp ?? 99) > 0 && (m.hp ?? 99) <= 20)).toBe(true);
    expect(sc('cl_lances_mix').map((m) => m.class)).toEqual(['knight', 'landsknecht', 'barbarian', 'dragoon']);
  });

  it('the party-creation preview shows the whole 160 x 144 ready frame inside its 600 x 800 window (7.5)', () => {
    const [w, h] = ATLAS.sheets.landsknecht.cell!;
    const pad = WINDOW_PADDING;                       // the Window's content inset
    expect(pad + w * ATLAS.scale).toBeLessThanOrEqual(600);
    expect(pad + 8 * LINE_HEIGHT + h * ATLAS.scale).toBeLessThanOrEqual(800);
  });

  it('field art: TEMPORARY aliases landsknecht -> warrior, dragoon -> knight; 1x looks exist (D-CL10)', () => {
    expect(FIELD.aliases).toMatchObject({ landsknecht: 'warrior', dragoon: 'knight' });
    expect(FIELD.sheets.landsknecht).toEqual(FIELD.sheets.warrior);
    expect(FIELD.sheets.dragoon).toEqual(FIELD.sheets.knight);
    expect(LEGACY.sheets.landsknecht).toBeDefined();
    expect(LEGACY.sheets.dragoon).toBeDefined();
  });

  it('a dragoon with its gear survives a save round trip', () => {
    const c = new Character({ name: 'DRAG', classData: ClassRegistry.getClass('dragoon')!, level: 30 });
    const sword = ItemRegistry.getItem('sun_blade')!;
    expect(c.canEquip(sword)).toBe(true);
    c.equip('weapon', sword);
    const back = Character.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))!;
    expect(back.classData.id).toBe('dragoon');
    expect(back.getEquipped('weapon')?.id).toBe('sun_blade');
  });
});

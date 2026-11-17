import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { SaveManager, SAVE_VERSION } from '../../src/systems/SaveManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { CharacterSaveData, SaveData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
});

const noGear = { weapon: null, armor: null, shield: null, helmet: null };
const member = (name: string, classId: string, level: number, xp: number, spellCharges: number[],
  learnedSpells: CharacterSaveData['learnedSpells'] = []): CharacterSaveData =>
  ({ name, classId, level, xp, currentHp: 20, equipment: noGear, spellCharges, learnedSpells, statusEffects: [] });

/**
 * A save written before T4: the old `25·lvl^2.6` XP curve and one charge table for every class
 * (Lv5 gave [4,2,1] to everyone, Warriors included).
 */
const PRE_T4_SAVE: SaveData = {
  version: 1,
  party: {
    gold: 321,
    members: [
      member('FGHTR', 'warrior', 5, 1700, [4, 2, 1, 0, 0, 0, 0, 0]),
      member('R.MAG', 'red_mage', 5, 1700, [4, 2, 1, 0, 0, 0, 0, 0], [{ spellId: 'fire', level: 1 }]),
      member('B.MAG', 'black_mage', 1, 5, [5, 0, 0, 0, 0, 0, 0, 0], [{ spellId: 'fire', level: 1 }]),
      member('W.MAG', 'white_mage', 1, 100, [1, 0, 0, 0, 0, 0, 0, 0], [{ spellId: 'cure', level: 1 }]),
    ],
  },
  inventory: [{ itemId: 'potion', quantity: 2 }],
  flags: {},
  currentMap: 'cornelia',
  playerPosition: { x: 3, y: 4 },
  playTime: 1234,
  saveDate: '2026-11-01T00:00:00.000Z',
  slotId: 0,
};

describe('T4 save compatibility (revision 16): a pre-T4 save', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    store.ff1_save_0 = JSON.stringify(PRE_T4_SAVE);
  });

  it('R0 (S5): an old save without a location summarises as Cornelia, with its members and gold', () => {
    const slot = SaveManager.getSaveSlots()[0]!;
    expect(slot.location).toBe('Cornelia');
    expect(slot.gold).toBe(321);
    expect(slot.members.map((m) => m.name)).toEqual(['FGHTR', 'R.MAG', 'B.MAG', 'W.MAG']);
    expect(slot.members[0]).toEqual({ name: 'FGHTR', classId: 'warrior', level: 5, currentHp: 20 });
  });

  it('loads without a version warning, on foot with no vehicles, and saves back as version 2 (W1-A save v2)', () => {
    const warn = vi.spyOn(console, 'warn');
    const loaded = SaveManager.load(0)!;
    expect(loaded).not.toBeNull();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('version'));
    expect(loaded.fieldMode).toBe('walking');
    expect(loaded.vehicles).toEqual([]);
    expect(SAVE_VERSION).toBe(2);
    SaveManager.save(1, loaded.party, new Inventory(), new GameFlags(), 'cornelia', { x: 0, y: 0 }, 0);
    expect(JSON.parse(store.ff1_save_1).version).toBe(2);
    warn.mockRestore();
  });

  it('a Warrior\'s charges become 0; level and XP are kept', () => {
    const fighter = SaveManager.load(0)!.party.get(0)!;
    expect(fighter.level).toBe(5);
    expect(fighter.xp).toBe(1700);
    for (let l = 1; l <= 8; l++) expect(fighter.getSpellCharges(l)).toBe(0);
  });

  it('a mage\'s charges are clamped to the class table (Red Mage Lv5: [4,1])', () => {
    const red = SaveManager.load(0)!.party.get(1)!;
    expect(red.level).toBe(5);
    expect(red.xp).toBe(1700);
    expect([1, 2, 3].map((l) => red.getSpellCharges(l))).toEqual([4, 1, 0]);
  });

  it('a saved charge of 5 at Lv1 loads as 2 (NG-4)', () => {
    expect(SaveManager.load(0)!.party.get(2)!.getSpellCharges(1)).toBe(2);
  });

  it('charges below the new maximum are kept (spent charges stay spent)', () => {
    const white = SaveManager.load(0)!.party.get(3)!;
    expect(white.getSpellCharges(1)).toBe(1);
  });

  it('recomputes the level upward from XP (100 XP is Lv2 on the FF1 table)', () => {
    const white = SaveManager.load(0)!.party.get(3)!;
    expect(white.level).toBe(2);
    expect(white.xp).toBe(100);
  });

  it('never lowers a saved level whose XP is short of the FF1 table', () => {
    store.ff1_save_0 = JSON.stringify({
      ...PRE_T4_SAVE,
      party: { gold: 0, members: [member('FGHTR', 'warrior', 10, 10000, [0, 0, 0, 0, 0, 0, 0, 0])] },
    });
    const fighter = SaveManager.load(0)!.party.get(0)!;
    expect(fighter.level).toBe(10); // FF1 Lv10 needs 11,116
    expect(fighter.xp).toBe(10000);
  });
});

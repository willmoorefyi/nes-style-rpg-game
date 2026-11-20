/**
 * Pass CHT: the boosts belong to the playthrough. Save v3 stores them; a v1 / v2 save loads with the defaults; a new
 * game starts from the defaults; a battle retry keeps them (they cannot change in battle).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager, SAVE_VERSION } from '../../src/systems/SaveManager.js';
import { captureBattleSnapshot, restoreBattleSnapshot } from '../../src/systems/BattleRetry.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { DEFAULT_BOOSTS, type Boosts } from '../../src/core/Boosts.js';

const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});

const BOOSTED: Boosts = { gold: 4, xp: 0.5, encounters: 0, battleSpeed: 4, walkSpeed: 2, alwaysEscape: true };

function oldSave(version: 1 | 2): string {
  return JSON.stringify({
    version, party: new PartyManager().toJSON(), inventory: new Inventory().toJSON(), flags: new GameFlags().toJSON(),
    currentMap: 'cornelia', playerPosition: { x: 3, y: 4 }, playTime: 5, saveDate: '2026-01-01T00:00:00.000Z', slotId: 0,
    ...(version === 2 ? { mode: 'walking', vehicles: [] } : {}),
  });
}

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; vi.restoreAllMocks(); });

describe('save v3: the boosts', () => {
  it('saves version 3 with the boosts and loads them back', () => {
    expect(SAVE_VERSION).toBe(4);   // NW-5: v4 (the NW world); the boosts came in v3
    SaveManager.save(0, new PartyManager(), new Inventory(), new GameFlags(), 'cornelia', { x: 1, y: 1 }, 0, 'Cornelia',
      { mode: 'walking', vehicles: [], boosts: BOOSTED });
    const raw = JSON.parse(store.ff1_save_0);
    expect(raw.version).toBe(4);
    expect(raw.boosts).toEqual(BOOSTED);
    expect(SaveManager.load(0)!.boosts).toEqual(BOOSTED);
  });

  it('a save without boosts given stores the defaults', () => {
    SaveManager.save(1, new PartyManager(), new Inventory(), new GameFlags(), 'cornelia', { x: 1, y: 1 }, 0);
    expect(JSON.parse(store.ff1_save_1).boosts).toEqual(DEFAULT_BOOSTS);
  });

  for (const version of [1, 2] as const) {
    it(`a version-${version} save loads with the default boosts and no version warning`, () => {
      const warn = vi.spyOn(console, 'warn');
      const err = vi.spyOn(console, 'error');
      store.ff1_save_2 = oldSave(version);
      const loaded = SaveManager.load(2)!;
      expect(loaded.boosts).toEqual(DEFAULT_BOOSTS);
      expect(loaded.playerPosition).toEqual({ x: 3, y: 4 });
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('version'));
      expect(err).not.toHaveBeenCalled();
    });
  }

  it('a malformed saved value is logged and loads as its default', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.ff1_save_0 = JSON.stringify({ ...JSON.parse(oldSave(2)), version: 3, boosts: { ...BOOSTED, gold: 9 } });
    expect(SaveManager.load(0)!.boosts).toEqual({ ...BOOSTED, gold: 1 });
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('Game: load, new game and retry', () => {
  it('restoreState takes a loaded save\'s boosts; resetState (a new game) starts from the defaults', async () => {
    const { Game } = await import('../../src/core/Game.js');
    const game = new Game();
    expect(game.boosts).toEqual(DEFAULT_BOOSTS);
    SaveManager.save(0, new PartyManager(), new Inventory(), new GameFlags(), 'cornelia', { x: 1, y: 1 }, 0, undefined,
      { boosts: BOOSTED });
    game.restoreState(SaveManager.load(0)!);
    expect(game.boosts).toEqual(BOOSTED);
    game.resetState();
    expect(game.boosts).toEqual(DEFAULT_BOOSTS);
  });

  it('a save round trip through the Game keeps a copy, not the live object', async () => {
    const { Game } = await import('../../src/core/Game.js');
    const game = new Game();
    game.boosts = { ...BOOSTED };
    SaveManager.save(0, game.party, game.inventory, game.gameFlags, 'cornelia', { x: 1, y: 1 }, 0, undefined,
      { boosts: game.boosts });
    game.boosts.gold = 0;
    expect(SaveManager.load(0)!.boosts.gold).toBe(4);
  });

  it('Retry Battle keeps the boosts in force', async () => {
    const { Game } = await import('../../src/core/Game.js');
    const game = new Game();
    game.currentMapId = 'overworld';
    game.boosts = { ...BOOSTED };
    const snap = captureBattleSnapshot(game, { enemyIds: ['goblin'] })!;
    restoreBattleSnapshot(game, snap);
    expect(game.boosts).toEqual(BOOSTED);
  });
});

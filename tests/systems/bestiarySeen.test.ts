/**
 * Fh test 9 (docs/BESTIARY_PLAN.md BS-2): every battle marks its enemies as seen (SEEN:<id>) before the retry
 * snapshot is taken; a caller-ended (sandbox) battle marks them too; the flags survive a save and load.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { seenFlag } from '../../src/scenes/bestiary/bestiaryModel.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame } from '../helpers/testUtils.js';

const snapshots: Record<string, unknown>[] = [];
vi.mock('../../src/systems/BattleRetry.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/systems/BattleRetry.js')>();
  return { ...orig, captureBattleSnapshot: vi.fn((game: { gameFlags: GameFlags }) => { snapshots.push(game.gameFlags.toJSON()); return null; }) };
});

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() } });

const enemy = (id: string) => ({ id, name: id, xpReward: 1, goldReward: 1, sprite: id,
  stats: { hp: 5, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1, attack: 1, defense: 0, magicDefense: 0 } });

function setup() {
  const base = createMockGame();
  const game = { ...base, party: { ...base.party, all: [{ name: 'Hero', currentHp: 10, maxHp: 10 }] } };
  game.data.loadEnemies.mockResolvedValue([enemy('goblin'), enemy('wolf')]);
  return { game, trigger: new BattleTrigger(game as unknown as Game) };
}

beforeEach(() => { snapshots.length = 0; store.clear(); });

describe('bestiary seen flags', () => {
  it('triggerBattle(goblin, wolf) sets SEEN:goblin and SEEN:wolf before the retry snapshot', async () => {
    const { game, trigger } = setup();
    await trigger.triggerBattle(['goblin', 'wolf']);
    expect(game.gameFlags.has(seenFlag('goblin'))).toBe(true);
    expect(game.gameFlags.has('SEEN:wolf')).toBe(true);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ 'SEEN:goblin': true, 'SEEN:wolf': true });
  });

  it('a caller-ended battle (the sandbox, { onEnd }) marks them too', async () => {
    const { game, trigger } = setup();
    await trigger.triggerBattle(['goblin', 'wolf'], undefined, undefined, undefined, undefined, { onEnd: () => {} });
    expect(game.gameFlags.has('SEEN:goblin') && game.gameFlags.has('SEEN:wolf')).toBe(true);
  });

  it('the flags survive a save and load', () => {
    const flags = new GameFlags();
    flags.set(seenFlag('garland'));
    expect(SaveManager.save(0, new PartyManager(), new Inventory(), flags, 'overworld', { x: 1, y: 1 }, 0)).toBe(true);
    expect(SaveManager.load(0)!.flags.has('SEEN:garland')).toBe(true);
  });
});

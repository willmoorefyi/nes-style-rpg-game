import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { startSandboxBattle, SANDBOX_SCENE } from '../../src/scenes/debugSandbox/sandboxBattle.js';
import { configKey, defaultConfig, type SandboxConfig, type SandboxData } from '../../src/scenes/debugSandbox/sandboxModel.js';
import { SandboxSession } from '../../src/scenes/debugSandbox/sandboxSession.js';
import { BattleTrigger, type BattleOutcomeData, type TriggerOptions } from '../../src/systems/BattleTrigger.js';
import type { Kits } from '../../src/systems/debugParty.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { testClass, testEnemy } from '../helpers/testUtils.js';

const DATA = parse(readFileSync('assets/data/debug-sandbox.yaml', 'utf-8')) as SandboxData;
const KITS = parse(readFileSync('assets/data/kits.yaml', 'utf-8')) as Kits;

/** A game the sandbox can build a party in; scenes are spies. */
function fakeGame() {
  const members: Character[] = [];
  return {
    party: {
      get all() { return members; },
      add: vi.fn((c: Character) => { members.push(c); return true; }),
      setGold: vi.fn(), distributeXp: vi.fn(), addGold: vi.fn(),
    },
    inventory: new Inventory(),
    scenes: {
      switchTo: vi.fn().mockResolvedValue(undefined), pop: vi.fn().mockResolvedValue(undefined),
      push: vi.fn().mockResolvedValue(undefined), register: vi.fn(), unregister: vi.fn(),
    },
    events: new EventBus(),
    gameFlags: new GameFlags(),
    resetState: vi.fn(() => { members.length = 0; }),
    battleRetry: null as unknown,
    data: { loadEnemies: vi.fn().mockResolvedValue([testEnemy()]), loadSpells: vi.fn().mockResolvedValue([]) },
    input: { isJustPressed: vi.fn(() => false), isPressed: vi.fn(() => false) },
  };
}

/** A BattleTrigger that only remembers how the battle would end. */
function fakeTrigger() {
  let onEnd: TriggerOptions['onEnd'];
  const triggerBattle = vi.fn(async (_ids: string[], ..._rest: unknown[]) => {
    onEnd = (_rest[4] as TriggerOptions | undefined)?.onEnd;
  });
  return {
    trigger: { triggerBattle } as unknown as BattleTrigger,
    triggerBattle,
    end: (data: Partial<BattleOutcomeData>) => onEnd?.({ victory: false, xpReward: 0, goldReward: 0, rounds: 3, ...data }),
  };
}

const garland: SandboxConfig = { ...defaultConfig(DATA), level: 'l2_garland' };

describe('Fg: every sandbox battle outcome returns to the sandbox', () => {
  beforeAll(async () => { await loadRealRegistries(); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const [what, data, field] of [
    ['a defeat', { victory: false }, 'loss'],
    ['a victory', { victory: true, xpReward: 99, goldReward: 99 }, 'win'],
    ['an escape', { victory: false, escaped: true }, 'escape'],
  ] as const) {
    it(`${what} ends in switchTo('debugSandbox') with no Game Over, and the tally counts it`, async () => {
      const game = fakeGame();
      const session = new SandboxSession();
      const t = fakeTrigger();
      expect(await startSandboxBattle(game as unknown as Game, DATA, garland, KITS, session, t.trigger)).toBe(true);
      expect(t.triggerBattle.mock.calls[0][0]).toEqual(['garland']);
      expect(t.triggerBattle.mock.calls[0][2]).toBe('assets/backgrounds/temple.webp');
      t.end(data);
      expect(game.scenes.switchTo).toHaveBeenCalledWith(SANDBOX_SCENE);
      expect(game.scenes.switchTo).not.toHaveBeenCalledWith('gameover');
      expect(game.scenes.switchTo).not.toHaveBeenCalledWith('title');
      expect(game.party.distributeXp).not.toHaveBeenCalled();
      const tally = session.tally(configKey(DATA, garland));
      expect(tally[field]).toBe(1);
      expect(tally.win + tally.loss + tally.escape).toBe(1);
      expect(session.last?.rounds).toBe(3);
    });
  }

  it('the party is the configured classes at the level, in the kit, with the level items', async () => {
    const game = fakeGame();
    const t = fakeTrigger();
    const config = { ...garland, party: ['warrior', 'monk', 'white_mage', 'black_mage'] };
    await startSandboxBattle(game as unknown as Game, DATA, config, KITS, new SandboxSession(), t.trigger);
    expect(game.resetState).toHaveBeenCalled();
    expect(game.party.all.map((c) => c.classData.id)).toEqual(config.party);
    expect(game.party.all.every((c) => c.level === 2)).toBe(true);
    expect(game.party.all[3].getLearnedSpells().map((s) => s.spellId)).toEqual(['fire', 'lit']);   // the lv2 kit
    expect(game.inventory.getQuantity('potion')).toBe(2);
  });
});

describe('Fg: BattleTrigger onEnd (a caller-ended battle)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('defeat goes to onEnd (rounds counted), not Game Over; there is no retry snapshot; the listener is removed', async () => {
    const game = fakeGame();
    game.party.add(new Character({ name: 'WAR', classData: testClass() }));
    const onEnd = vi.fn();
    await new BattleTrigger(game as unknown as Game).triggerBattle(['goblin'], undefined, undefined, undefined, undefined, { onEnd });
    expect(game.scenes.push).toHaveBeenCalledWith('battle');
    expect(game.battleRetry).toBeNull();
    game.events.emit('battleEnd', { victory: false, xpReward: 0, goldReward: 0 });
    game.events.emit('battleEnd', { victory: false, xpReward: 0, goldReward: 0 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0]).toMatchObject({ victory: false, rounds: 0 });
    expect(game.scenes.switchTo).not.toHaveBeenCalled();
    expect(game.scenes.pop).not.toHaveBeenCalled();
  });

  it('without onEnd the trigger adds no listener of its own (the field flow is unchanged)', async () => {
    const game = fakeGame();
    game.party.add(new Character({ name: 'WAR', classData: testClass() }));
    await new BattleTrigger(game as unknown as Game).triggerBattle(['goblin']);
    game.events.emit('battleEnd', { victory: false, xpReward: 0, goldReward: 0 });
    expect(game.scenes.switchTo).not.toHaveBeenCalled();   // the field's own listener (none here) ends it
  });
});

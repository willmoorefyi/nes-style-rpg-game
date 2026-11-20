import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { startSandboxBattle, SANDBOX_SCENE } from '../../src/scenes/debugSandbox/sandboxBattle.js';
import { configKey, CUSTOM, defaultConfig, type SandboxConfig, type SandboxData } from '../../src/scenes/debugSandbox/sandboxModel.js';
import { atlasArt, enemyData } from '../helpers/atlasFrames.js';
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
import { defaultBoosts } from '../../src/core/Boosts.js';

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
    boosts: defaultBoosts(),
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

describe('V8 F8: the sandbox refuses a formation that does not fit at an integer scale >= 2', () => {
  beforeAll(async () => { await loadRealRegistries(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const TIER_H = ['hill_gigas', 'fire_gigas', 'ice_gigas', 'minotaur', 'ochu', 'hydra', 'earth_elemental', 'fire_elemental',
    'water_elemental'];
  const custom = (ids: string[]): SandboxConfig => ({ ...defaultConfig(DATA), level: 'l30_lich', formation: CUSTOM, custom: ids });
  async function start(ids: string[]) {
    const game = fakeGame();
    game.data.loadEnemies = vi.fn().mockResolvedValue(enemyData);
    const t = fakeTrigger();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await startSandboxBattle(game as unknown as Game, DATA, custom(ids), KITS, new SandboxSession(), t.trigger, atlasArt);
    return { ok, warn, t, game };
  }

  it('9 tier-H: warned with the ids, false, no battle pushed, the party untouched', async () => {
    const r = await start(TIER_H);
    expect(r.ok).toBe(false);
    expect(r.warn).toHaveBeenCalledWith(`sandbox: formation does not fit at an integer scale >= 2: ${TIER_H.join(', ')}`);
    expect(r.t.triggerBattle).not.toHaveBeenCalled();
    expect(r.game.scenes.push).not.toHaveBeenCalled();
    expect(r.game.resetState).not.toHaveBeenCalled();
  });

  it.each([
    ['6 tier-H (pass 3, screen scale 2 by design)', TIER_H.slice(0, 6)],
    ['the 3-huge formation (anim_pass_v_huge)', ['dragon', 'hill_gigas', 'green_dragon']],
    ['the mixed formation (anim_pass_v_mixed)', ['ogre', 'guardian', 'shark', 'goblin', 'black_knight', 'vampire']],
  ])('%s starts without a warning', async (_, ids) => {
    const r = await start(ids);
    expect(r.ok).toBe(true);
    expect(r.t.triggerBattle.mock.calls[0][0]).toEqual(ids);
    expect(r.warn.mock.calls.filter((c) => String(c[0]).startsWith('sandbox:'))).toEqual([]);
  });
});

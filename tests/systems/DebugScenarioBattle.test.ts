import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugScenarioLoader, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Game } from '../../src/core/Game.js';

/** A debug battle started over the title: no field scene is listening (S6). */
function fakeGame() {
  return {
    party: { all: [] as unknown[], add: vi.fn(() => true), setGold: vi.fn(), distributeXp: vi.fn(), addGold: vi.fn() },
    inventory: { clear: vi.fn(), add: vi.fn() },
    scenes: { switchTo: vi.fn().mockResolvedValue(undefined), pop: vi.fn().mockResolvedValue(undefined), push: vi.fn() },
    events: new EventBus(),
    gameFlags: new GameFlags(),
    resetState: vi.fn(),
    battleRetry: null,
    currentMapId: '',
    playerPosition: { x: 0, y: 0 },
  };
}

const battle: DebugScenario = { id: 'b', name: 'b', party: [], items: {}, gold: 0, enemies: ['goblin'] };

describe('S6: a debug battle ends back on the title', () => {
  beforeEach(() => {
    vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('victory pops back to the title, once', async () => {
    const game = fakeGame();
    await new DebugScenarioLoader(game as unknown as Game).run(battle);
    game.events.emit('battleEnd', { victory: true, xpReward: 6, goldReward: 6 });
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
    game.events.emit('battleEnd', { victory: true, xpReward: 6, goldReward: 6 });
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
  });

  it('running away pops back to the title', async () => {
    const game = fakeGame();
    await new DebugScenarioLoader(game as unknown as Game).run(battle);
    game.events.emit('battleEnd', { victory: false, escaped: true, xpReward: 0, goldReward: 0 });
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
    expect(game.scenes.switchTo).not.toHaveBeenCalled();
  });

  it('defeat opens Game Over', async () => {
    const game = fakeGame();
    await new DebugScenarioLoader(game as unknown as Game).run(battle);
    game.events.emit('battleEnd', { victory: false, xpReward: 0, goldReward: 0 });
    expect(game.scenes.switchTo).toHaveBeenCalledWith('gameover');
    expect(game.scenes.pop).not.toHaveBeenCalled();
  });

  it('a battle that fails to start leaves no listener behind', async () => {
    vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockRejectedValue(new Error('no enemies'));
    const game = fakeGame();
    await expect(new DebugScenarioLoader(game as unknown as Game).run(battle)).rejects.toThrow('no enemies');
    game.events.emit('battleEnd', { victory: true, xpReward: 0, goldReward: 0 });
    expect(game.scenes.pop).not.toHaveBeenCalled();
  });
});

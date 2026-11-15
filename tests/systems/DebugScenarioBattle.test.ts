import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { DebugScenarioLoader, enemyStatusOf, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { BattleScene } from '../../src/scenes/BattleScene.js';
import { Character } from '../../src/entities/Character.js';
import { createMockBattleSceneDeps, testClass, testEnemy } from '../helpers/testUtils.js';
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

describe('F0: enemyStatus (statuses per enemy index)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('the loader passes the known statuses to the battle; an unknown one logs console.error and is dropped', async () => {
    const trigger = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scenario: DebugScenario = { ...battle, enemies: ['goblin', 'goblin'], enemyStatus: { 0: ['sleep', 'frozen'], 1: ['poison'] } };
    await new DebugScenarioLoader(fakeGame() as unknown as Game).run(scenario);
    expect(trigger.mock.calls[0][4]).toEqual({ 0: ['sleep'], 1: ['poison'] });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("unknown status 'frozen'");
    expect(enemyStatusOf({ id: 'x' })).toBeUndefined();
  });

  it('the battle scene applies them after the battle starts, and the screen shows them at once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const party = [new Character({ name: 'WAR', classData: testClass() })];
    const scene = new BattleScene(createMockBattleSceneDeps(), {
      party, enemies: [testEnemy(), testEnemy()], rng: () => 0.5, enemyStatus: { 0: ['sleep'], 1: ['poison', 'blind'], 5: ['stun'] },
    });
    scene.enter();
    expect(scene.enemyInstances[0].status.has('sleep')).toBe(true);
    expect(scene.enemyInstances[1].status.getAll().map((s) => s.effect)).toEqual(['poison', 'blind']);
    expect(error).toHaveBeenCalledTimes(1);           // index 5: there is no such enemy
  });

  it('the f_status_enemies scenario gives each of its seven goblins one status', () => {
    const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
    const s = scenarios.find((x) => x.id === 'f_status_enemies')!;
    expect(s.enemies).toHaveLength(7);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(Object.values(enemyStatusOf(s)!).map((v) => v.join())).toEqual(['sleep', 'poison', 'stun', 'blind', 'silence', 'fear', 'stone']);
    expect(error).not.toHaveBeenCalled();
  });
});

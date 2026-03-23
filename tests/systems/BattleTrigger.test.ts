import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame } from '../helpers/testUtils.js';

const mockEnemy = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 20, strength: 5, agility: 5, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 2, magicDefense: 1 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin.png',
};

function createBattleTriggerMock() {
  const base = createMockGame();
  return {
    ...base,
    party: {
      ...base.party,
      all: [{ name: 'Hero', currentHp: 100, maxHp: 100 }],
    },
  };
}

describe('BattleTrigger', () => {
  let game: ReturnType<typeof createBattleTriggerMock>;
  let trigger: BattleTrigger;

  beforeEach(() => {
    game = createBattleTriggerMock();
    game.data.loadEnemies.mockResolvedValue([mockEnemy]);
    trigger = new BattleTrigger(game as unknown as Game);
  });

  it('creates instance', () => {
    expect(trigger).toBeDefined();
  });

  it('handles battle end victory', () => {
    trigger.onBattleEnd({ victory: true, xpReward: 100, goldReward: 50 });
    expect(game.party.distributeXp).toHaveBeenCalledWith(100);
    expect(game.party.addGold).toHaveBeenCalledWith(50);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('handles battle end defeat', () => {
    trigger.onBattleEnd({ victory: false, xpReward: 0, goldReward: 0 });
    expect(game.scenes.switchTo).toHaveBeenCalledWith('gameover');
  });

  it('calls onBattleTriggered callback', async () => {
    const callback = vi.fn();
    trigger.setOnBattleTriggered(callback);
    await trigger.triggerBattle(['goblin']);
    expect(callback).toHaveBeenCalled();
  });
});

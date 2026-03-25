import { describe, it, expect, vi } from 'vitest';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import type { Game } from '../../src/core/Game.js';

function createMockGameForLevelUp() {
  return {
    scenes: { register: vi.fn(), unregister: vi.fn(), switchTo: vi.fn(), push: vi.fn(), pop: vi.fn() },
    input: { isPressed: vi.fn(), isJustPressed: vi.fn() },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    data: { loadMap: vi.fn(), loadEnemies: vi.fn().mockResolvedValue([]) },
    party: {
      all: [
        { name: 'FGHTR', level: 1, currentHp: 30, maxHp: 30 },
        { name: 'W.MAG', level: 1, currentHp: 20, maxHp: 20 },
      ],
      gold: 0,
      distributeXp: vi.fn(),
      addGold: vi.fn(),
    },
    audio: { playMusic: vi.fn(), stopMusic: vi.fn(), playSFX: vi.fn() },
    inventory: { add: vi.fn() },
    gameFlags: { set: vi.fn(), has: vi.fn().mockReturnValue(false), get: vi.fn() },
  };
}

describe('BattleTrigger - C4 Level-up notification', () => {
  it('emits showDialog for characters that leveled up', () => {
    const game = createMockGameForLevelUp();
    // Simulate level-up: distributeXp changes the level
    game.party.distributeXp.mockImplementation(() => {
      (game.party.all[0] as { level: number }).level = 2;
      return [true, false];
    });

    const trigger = new BattleTrigger(game as unknown as Game);
    trigger.onBattleEnd({ victory: true, xpReward: 100, goldReward: 50 });

    // Should emit showDialog for FGHTR level up
    const showDialogCalls = game.events.emit.mock.calls.filter(
      (call: unknown[]) => call[0] === 'showDialog'
    );
    expect(showDialogCalls.length).toBe(1);
    expect(showDialogCalls[0][1].text).toBe('FGHTR reached Level 2!');
  });

  it('does not emit showDialog when no level-ups occur', () => {
    const game = createMockGameForLevelUp();
    game.party.distributeXp.mockReturnValue([false, false]);

    const trigger = new BattleTrigger(game as unknown as Game);
    trigger.onBattleEnd({ victory: true, xpReward: 10, goldReward: 5 });

    const showDialogCalls = game.events.emit.mock.calls.filter(
      (call: unknown[]) => call[0] === 'showDialog'
    );
    expect(showDialogCalls.length).toBe(0);
  });

  it('emits showDialog for multiple level-ups', () => {
    const game = createMockGameForLevelUp();
    game.party.distributeXp.mockImplementation(() => {
      (game.party.all[0] as { level: number }).level = 2;
      (game.party.all[1] as { level: number }).level = 2;
      return [true, true];
    });

    const trigger = new BattleTrigger(game as unknown as Game);
    trigger.onBattleEnd({ victory: true, xpReward: 200, goldReward: 100 });

    const showDialogCalls = game.events.emit.mock.calls.filter(
      (call: unknown[]) => call[0] === 'showDialog'
    );
    expect(showDialogCalls.length).toBe(2);
    expect(showDialogCalls[0][1].text).toBe('FGHTR reached Level 2!');
    expect(showDialogCalls[1][1].text).toBe('W.MAG reached Level 2!');
  });
});

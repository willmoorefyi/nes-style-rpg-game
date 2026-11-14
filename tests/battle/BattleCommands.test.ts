import { describe, it, expect } from 'vitest';
import { retargetIfDead, calculateRunChance, type BattleCommand } from '../../src/battle/BattleCommands.js';

describe('retargetIfDead', () => {
  const aliveTargets = new Set(['enemy1', 'enemy2']);
  const isTargetAlive = (id: string) => aliveTargets.has(id);
  const getLivingEnemies = () => ['enemy1', 'enemy2'];

  it('returns command unchanged if target is alive', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'enemy1' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies);
    expect(result).toEqual(cmd);
  });

  it('retargets to living enemy if target is dead', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0);
    expect(result.targetId).toBe('enemy1');
  });

  it('returns command unchanged for non-fight commands', () => {
    const cmd: BattleCommand = { type: 'run', actorId: 'hero' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies);
    expect(result).toEqual(cmd);
  });

  it('returns command unchanged if no living enemies', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, () => false, () => []);
    expect(result).toEqual(cmd);
  });

  it('uses rng to select random target', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0.99);
    expect(result.targetId).toBe('enemy2');
  });
});

describe('calculateRunChance (FF1, EB-9)', () => {
  it('is luck / (level + 16): a Lv1 Thief with luck 15 escapes 15/17 of the time', () => {
    expect(calculateRunChance(15, 1)).toBeCloseTo(15 / 17);
  });

  it('a Lv1 Thief escapes on a 0.85 roll; a Lv1 Warrior (luck 5) fails on the same roll', () => {
    expect(0.85 < calculateRunChance(15, 1)).toBe(true);
    expect(0.85 < calculateRunChance(5, 1)).toBe(false);
  });

  it('higher levels make running harder and the chance stays in [0, 1]', () => {
    expect(calculateRunChance(15, 10)).toBeLessThan(calculateRunChance(15, 1));
    expect(calculateRunChance(99, 1)).toBe(1);
    expect(calculateRunChance(0, 1)).toBe(0);
  });
});
